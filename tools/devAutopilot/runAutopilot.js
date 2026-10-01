'use strict';
// tools/devAutopilot/runAutopilot.js
// Development Autopilot V1 — Stage 4E / Decision 121：実接続用の入口（本物の git・observers・spawn・test 実行と orchestrator を接続する）
//
//   新規 run：
//     node tools/devAutopilot/runAutopilot.js --task-id <id> --permit-id <permit-...> --run-approval-id <uuid>
//          --exe <claude.exe の path> --cli-version <版> --build-file <stage 別 build の JSON> [--start] [--test-approval-wait-minutes <n>]
//   テスト承認 gate からの再開（Human が approveCli approve-tests で承認・gate 解除した後）：
//     node tools/devAutopilot/runAutopilot.js --resume-testing --task-id <id> --run-approval-id <uuid> --test-approval-id <uuid>
//          --exe <path> --cli-version <版> --build-file <JSON> [--start]
//
//   ★ 既定は「事前確認だけ」（read-only。run・Permit・承認・Git を変更しない）。--start を付けた場合だけ、全条件を満たしたときに orchestrator を 1 回起動する。
//   ★ 起動前に停止する条件：必須引数の欠落・main repo 以外（worktree 等）からの実行・Git 不可・run の状態が mode と合わない・実行承認が無い / 不一致 / 期限切れ・
//     StructuredOutput 方針が 'block' でも「承認する CLI に束縛した conditional」でもない・Permit が無い / 消費済み（新規）・テスト実行承認が無い / 消費済み（再開）・
//     HEAD ≠ origin/main（Decision 120 決定 15）・main の状態が run 記録と不一致・CLI の exe SHA / 版が承認と不一致・build file が不正。
//   ★ 再開は research / design / implement を再実行しない（orchestrator の resume_testing：3 stage が各 1 回成功・test 未実行・Human が gate 解除済みの run だけ）。
//   ★ ホストでの test 実行（Decision 121）は、Human が差分を確認して発行した single-use のテスト実行承認を orchestrator が消費した後だけ testRunner が行う。
//     env の制限や Safety 監視は OS レベルの隔離ではない。
//   ★ 承認の自動発行・自動 retry・自動 commit はしない（承認は Human が approveCli で発行する。commit は Human が手動で行う）。
//   ★ 実 spawn（child_process）は --start で起動する場合だけ、その時点で読み込む（この module の読込・事前確認では読み込まない）。

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var rs = require('./runStore');
var ex = require('./claudeExecutor');
var ha = require('./humanApproval');
var pc = require('./protectedCheck');

var BUILD_STAGES = ['researching', 'designing', 'implementing', 'reviewing'];
var BUILD_KEYS = ['objective', 'acceptanceCriteria', 'stopConditions', 'appendSystemPrompt', 'maxBudgetUsd', 'model'];
var MAX_BUILD_BYTES = 64 * 1024;
var REQUIRED_FRESH = ['task-id', 'permit-id', 'run-approval-id', 'exe', 'cli-version', 'build-file'];
var REQUIRED_RESUME = ['task-id', 'run-approval-id', 'test-approval-id', 'exe', 'cli-version', 'build-file'];
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function parseArgs(argv) {
  var out = { _: [] };
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (a === '--start') out.start = true;
    else if (a === '--resume-testing') out.resume = true;
    else if (/^--[a-z-]+$/.test(a) && i + 1 < argv.length) out[a.slice(2)] = argv[++i];
    else out._.push(a);
  }
  return out;
}
function _fileState(fsx, p) {
  try { var st = fsx.lstatSync(p); return st.isFile() && !st.isSymbolicLink() ? 'file' : 'not_regular'; }
  catch (e) { return e && e.code === 'ENOENT' ? 'absent' : 'unknown'; }
}
// 再開できる run：テスト承認 gate を Human が解除済み・research / design / implement が各 1 回成功・test 未実行・lock なし
function _resumeRunErrors(run) {
  var e = [];
  if (run.stage !== 'testing' || run.gate !== 'none' || run.outcome !== null || run.lock !== null || run.isolation.state !== 'verified') e.push('run_not_waiting_after_test_gate');
  if (run.testResults.length) e.push('tests_already_recorded');
  var st3 = ['researching', 'designing', 'implementing'];
  if (run.invocations.length !== 3 || !run.invocations.every(function (x, k) { return x.stage === st3[k] && x.state === 'finished' && x.result && x.result.disposition === 'none'; })) e.push('completed_stages_invalid');
  var h = run.stageHistory[run.stageHistory.length - 1];
  if (!h || h.stage !== 'testing' || h.result !== 'human_approved') e.push('test_gate_not_released_by_human');
  return e;
}

// 事前確認（read-only）。deps: { repoPath, auditRoot, worktreeRoot, store, approvalStore, permitStore, fs, git, observers, detectLayout?, clock }
function preflight(a, deps) {
  var r = [];
  var req = a.resume ? REQUIRED_RESUME : REQUIRED_FRESH;
  var missing = req.filter(function (k) { return typeof a[k] !== 'string' || !a[k]; });
  if (missing.length) return { ok: false, reasons: ['args_missing:' + missing.join(',')] };
  if (a._.length || (a.resume && a['permit-id'] !== undefined) || (!a.resume && a['test-approval-id'] !== undefined)) return { ok: false, reasons: ['args_unexpected'] };
  var layout = (deps.detectLayout || pc.detectLayout)(deps.repoPath);
  if (!layout || layout.mode !== 'main') return { ok: false, reasons: ['not_main_repo:' + (layout && layout.mode)] };
  var gv = deps.git.validateGitAvailable();
  if (!gv || !gv.ok) return { ok: false, reasons: ['git_unavailable'] };
  var now = deps.clock();
  var rr = rs.readRun(deps.store, a['task-id']);
  if (!rr.ok || !rr.executable) return { ok: false, reasons: ['run_unreadable'] };
  var run = rr.run;
  if (!a.resume) {
    if (run.stage !== null || run.isolation.state !== 'absent' || run.outcome !== null || run.gate !== 'none' || run.lock !== null || run.invocations.length) r.push('run_not_fresh');
  } else r = r.concat(_resumeRunErrors(run));
  var la = ha.loadRunApproval(deps.approvalStore, a['run-approval-id']);
  if (!la.ok) return { ok: false, reasons: r.concat(['run_approval_unavailable:' + la.error]) };
  var ap = la.approval;
  if (ap.taskId !== run.taskId || ap.runStartedAt !== run.startedAt) r.push('approval_run_mismatch');
  if (!(Date.parse(now) >= Date.parse(ap.issuedAt) && Date.parse(now) < Date.parse(ap.expiresAt))) r.push('approval_expired_or_not_yet_valid');
  // StructuredOutput（Decision 121）：既定 block。conditional は承認する CLI（exe SHA・版）に束縛されている場合だけ
  var sop = ap.structuredOutputPolicy;
  if (!(sop === 'block' || (_isObj(sop) && sop.mode === 'conditional' && sop.exeSha256 === ap.exeSha256 && sop.cliVersion === ap.cliVersion))) r.push('structured_output_policy_invalid');
  if (!BUILD_STAGES.every(function (s) { return ap.stages.indexOf(s) !== -1; })) r.push('approval_stages_incomplete');
  if (!a.resume) {
    if (!/^permit-[0-9a-f]{32}$/.test(a['permit-id'])) r.push('permit_id_invalid');
    else {
      if (_fileState(deps.fs, path.join(deps.permitStore.root, a['permit-id'] + '.json')) !== 'file') r.push('permit_missing');
      if (_fileState(deps.fs, path.join(deps.permitStore.root, a['permit-id'] + '.consumed.json')) !== 'absent') r.push('permit_already_consumed_or_unknown');
    }
  } else {
    if (!UUID_RE.test(a['test-approval-id'])) r.push('test_approval_id_invalid');
    else {
      if (_fileState(deps.fs, path.join(deps.approvalStore.root, 'approvals', a['test-approval-id'] + '.json')) !== 'file') r.push('test_approval_missing');
      if (_fileState(deps.fs, path.join(deps.approvalStore.root, 'approvals', a['test-approval-id'] + '.consumed.json')) !== 'absent') r.push('test_approval_already_consumed_or_unknown');
    }
  }
  var m = deps.observers.observeMain();
  var em = ex.expectedMainFromRun(run);
  if (!m) r.push('main_unobservable');
  else {
    if (!m.originMain || m.head !== m.originMain) r.push('head_not_equal_origin_main');   // Decision 120 決定 15
    if (m.head !== run.baseHead) r.push('head_not_run_base');
    if (m.currentBranch !== 'main' || m.stagedCount !== 0) r.push('main_not_clean_branch');
    if (!em || m.autopilotStatusHash !== em.autopilotStatusHash || m.protectedFingerprint !== em.protectedFingerprint) r.push('main_state_mismatch');
  }
  var exeSha = null;
  try { exeSha = deps.observers.hashFile(a.exe); } catch (e) { exeSha = null; }
  if (!exeSha || exeSha !== ap.exeSha256) r.push('cli_exe_mismatch');
  if (a['cli-version'] !== ap.cliVersion) r.push('cli_version_mismatch');
  var builds = null;
  try {
    var bst = deps.fs.lstatSync(a['build-file']);
    if (!bst.isFile() || bst.isSymbolicLink() || bst.size > MAX_BUILD_BYTES) r.push('build_file_invalid');
    else builds = JSON.parse(String(deps.fs.readFileSync(a['build-file'], 'utf8')));
  } catch (e) { r.push('build_file_unreadable'); }
  if (builds !== null && (!_isObj(builds) || Object.keys(builds).sort().join() !== BUILD_STAGES.slice().sort().join()
    || !BUILD_STAGES.every(function (s) { return _isObj(builds[s]) && Object.keys(builds[s]).every(function (k) { return BUILD_KEYS.indexOf(k) !== -1; }); }))) r.push('build_file_shape');
  if (builds !== null && rs.findSecrets(builds).length) r.push('build_file_contains_secret');
  var w = a['test-approval-wait-minutes'];
  var waitMs = w === undefined || a.resume ? 0 : Number(w) * 60000;
  if (!(Number.isFinite(waitMs) && waitMs >= 0 && waitMs <= 60 * 60000)) r.push('test_approval_wait_invalid');
  return r.length ? { ok: false, reasons: r } : { ok: true, run: run, approval: ap, builds: builds, exeSha256: exeSha, testApprovalWaitMs: Math.round(waitMs) };
}

// io: { write(s) }, deps: preflight の deps ＋ { orchestrator, makeSpawn()->spawn, runTests, selectTests, readWorktreeLines, randomUUID, sleep, parentEnv, pid }
async function main(argv, io, deps) {
  var a = parseArgs(argv || []);
  var w = function (s) { io.write(String(s) + '\n'); };
  var p;
  try { p = preflight(a, deps); } catch (e) { p = { ok: false, reasons: ['preflight_internal_error'] }; }
  if (!p.ok) { w('停止（起動前）: ' + p.reasons.join(', ')); return 3; }
  var sop = p.approval.structuredOutputPolicy === 'block' ? 'block' : 'conditional（この CLI に限る）';
  w('事前確認 OK（' + (a.resume ? 'テスト承認 gate からの再開' : '新規 run') + '）: task ' + p.run.taskId + ' / baseHead ' + p.run.baseHead + ' / 実行承認 ' + p.approval.approvalId
    + ' / StructuredOutput: ' + sop + ' / test 実行: single-use のテスト実行承認がある場合だけ');
  if (!a.start) { w('--start が無いため起動しません（事前確認のみ）。'); return 0; }
  var spawn = deps.makeSpawn();   // 実 spawn はここで初めて用意する
  var res = await deps.orchestrator.runOrchestration({
    mode: a.resume ? 'resume_testing' : undefined, testApprovalId: a.resume ? a['test-approval-id'] : undefined,
    store: deps.store, auditRoot: deps.auditRoot, auditFs: deps.auditFs, approvalStore: deps.approvalStore, permitStore: deps.permitStore,
    taskId: p.run.taskId, ownerId: deps.randomUUID(), pid: deps.pid, clock: deps.clock, permitId: a.resume ? undefined : a['permit-id'], runApprovalId: p.approval.approvalId,
    worktreeRoot: deps.worktreeRoot, cli: { exePath: a.exe, exeSha256: p.exeSha256, cliVersion: a['cli-version'] }, builds: p.builds, parentEnv: deps.parentEnv,
    testApprovalWaitMs: p.testApprovalWaitMs, pollMs: 5000, onEvent: function (e) { w('event: ' + JSON.stringify(e)); },
    deps: { git: deps.git, permit: deps.permit, observers: deps.observers, spawn: spawn, selectTests: deps.selectTests, readWorktreeLines: deps.readWorktreeLines,
      runTests: deps.runTests, randomUUID: deps.randomUUID, sleep: deps.sleep },
  });
  w('結果: ' + JSON.stringify({ ok: res.ok, phase: res.phase, error: res.error, gate: res.gate, testApprovalId: res.testApprovalId }));
  return res.ok ? 0 : 1;   // 自動 retry しない
}

// 本物の端末から Human が実行した場合だけの配線（この module を require しても実行されない）
if (require.main === module) {
  var os = require('os');
  var repoRoot = path.resolve(__dirname, '..', '..');
  var auditRoot = path.resolve(repoRoot, '..', '.autopilot');
  var exe = require('./worktreeExecutor');
  var ts = require('./testSelector');
  var tr = require('./testRunner');
  var obs = require('./observers').createObservers({ repoPath: repoRoot, homeDir: os.homedir() });
  var deps = {
    repoPath: repoRoot, auditRoot: auditRoot, worktreeRoot: path.join(auditRoot, 'wt'), store: { runtimeRoot: auditRoot, repoPath: repoRoot },
    approvalStore: { root: auditRoot }, permitStore: { root: path.join(auditRoot, 'permits'), repoPath: repoRoot }, fs: fs,
    git: exe, permit: require('./realRepoPermit'), observers: obs, orchestrator: require('./orchestrator'),
    makeSpawn: function () { return require('child_process').spawn; },
    // test 実行は orchestrator が消費したテスト実行承認と一緒にだけ呼ばれる（testRunner も承認の一覧・場所を再確認する）
    runTests: function (x) { return tr.runSafeTests({ worktreePath: x.worktreePath, files: x.files, testApproval: x.testApproval, parentEnv: process.env }); },
    selectTests: function (x) {
      var m = ts.loadTestManifest(path.join(x.run.worktreePath, 'tools', 'devAutopilot', 'testManifest.json'));
      return ts.selectTests({ changedFiles: x.changedFiles, manifest: m, repoRoot: x.run.worktreePath });
    },
    readWorktreeLines: function (run, rel) {
      try { var p = path.join(run.worktreePath, rel), st = fs.lstatSync(p); if (!st.isFile() || st.isSymbolicLink() || st.size > 1024 * 1024) return null; return fs.readFileSync(p, 'utf8').split(/\r?\n/); }
      catch (e) { return null; }
    },
    clock: function () { return new Date().toISOString(); }, randomUUID: crypto.randomUUID,
    sleep: function (ms) { return new Promise(function (res) { setTimeout(res, ms); }); }, parentEnv: process.env, pid: process.pid,
  };
  main(process.argv.slice(2), { write: function (s) { process.stdout.write(s); } }, deps).then(function (code) { process.exitCode = code; }, function () { process.exitCode = 70; });
}

module.exports = { parseArgs: parseArgs, preflight: preflight, main: main };
