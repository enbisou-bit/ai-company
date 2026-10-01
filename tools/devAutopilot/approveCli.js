'use strict';
// tools/devAutopilot/approveCli.js
// Development Autopilot V1 — Stage 4D：Human が端末で実行する承認発行 CLI（Autopilot・Runner・Orchestrator からは呼ばない）
//
//   node tools/devAutopilot/approveCli.js prepare-run   --task-id <id> --title <t> --goal <g> --allowed <a,b> [--forbidden <x,y>]
//                                                        --cap-usd <n> --max-invocations <n> --max-budget-usd <n> --exe <path> --cli-version <v>
//                                                        [--ttl-minutes <n>] [--permit-ttl-minutes <n>]
//   node tools/devAutopilot/approveCli.js approve-tests --task-id <id> --approval-id <Orchestrator が通知した要求 ID> [--ttl-minutes <n>]
//
//   ★ stdin / stdout がともに TTY で、表示した確認コードを入力した場合だけ発行する。
//     これは「操作確認」であり、人間であることの証明ではない。TTY を持つ任意の process（同じ OS ユーザー）は実行でき、
//     同じ OS ユーザーの権限で動く process は承認 file を直接作れる。偽造は防げない（V1 の既知の限界）。
//     「子 process から発行できない」とは保証しない（Runner の子 process は Bash を持たず、audit 配下への書込みは auditGuard が検出する）。
//   ★ prepare-run は run（未開始）・Permit（worktree add の single-use・最大 30 分）・run の実行承認（4 stage・回数上限）を 1 回の確認で作る。
//     HEAD = origin/main（Decision 120 決定 15）でなければ発行しない。StructuredOutput 方針は 'block' 固定。
//   ★ approve-tests は、testing stage の run の現在の差分 hash と selector の test 一覧に束縛した single-use 承認を作る。
//     Orchestrator が待機中なら承認 file だけ。テスト承認 gate で停止（所有権解放済み）なら、Human の操作として gate も解除する（再開は resume_testing）。
//   ★ 失敗時に作成済みの記録を削除・巻き戻ししない（cleanup は Human-controlled）。
//   ★ credential・env 値・prompt 本文を表示しない。

var path = require('path');
var crypto = require('crypto');
var rs = require('./runStore');
var wc = require('./worktreeController');
var ex = require('./claudeExecutor');
var ha = require('./humanApproval');
var orch = require('./orchestrator');

var CONFIRM_NOTE = '確認コードの入力は操作確認です（人間であることの証明ではありません。同じ OS ユーザーによる承認 file の偽造は防げません）。';

function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function parseArgs(argv) {
  var out = { _: [] };
  for (var i = 0; i < argv.length; i++) {
    var a = argv[i];
    if (/^--[a-z-]+$/.test(a) && i + 1 < argv.length) { out[a.slice(2)] = argv[++i]; } else out._.push(a);
  }
  return out;
}
function _list(s) { return typeof s === 'string' && s.length ? s.split(',').map(function (x) { return x.trim(); }).filter(Boolean) : []; }
function _num(s) { var n = Number(s); return typeof s === 'string' && s.trim() !== '' && isFinite(n) ? n : NaN; }
function _code(rand) { var h = rand(5).toString('hex').toUpperCase(); return h.slice(0, 5) + '-' + h.slice(5, 10); }

// io: { isTTY:{stdin,stdout}, write(s), readLine()->Promise<string>, now()->iso, randomBytes(n)->Buffer, randomUUID() }
// deps: { store, permitStore, approvalStore, worktreeRoot, repoPath, observers, git, permit, selectTests }
async function main(argv, io, deps) {
  var args = parseArgs(argv || []);
  var cmd = args._[0];
  var w = function (s) { io.write(String(s) + '\n'); };
  if (!io || !io.isTTY || io.isTTY.stdin !== true || io.isTTY.stdout !== true) { if (io && io.write) w('拒否: 対話端末（TTY）から実行してください。'); return 2; }
  if (cmd !== 'prepare-run' && cmd !== 'approve-tests') { w('使い方: prepare-run | approve-tests（先頭のコメント参照）'); return 64; }
  var plan = cmd === 'prepare-run' ? prepareRunPlan(args, io, deps) : approveTestsPlan(args, io, deps);
  if (!plan.ok) { w('拒否: ' + plan.error + (plan.reasons ? ' (' + plan.reasons.join(',') + ')' : '')); return 3; }
  plan.summary.forEach(w);
  w(CONFIRM_NOTE);
  var code = _code(io.randomBytes);
  w('確認コード: ' + code + '  を入力してください（中止は空行）');
  var typed = String(await io.readLine() || '').trim();
  if (typed !== code) { w('中止: 確認コードが一致しません。何も作成していません。'); return 4; }
  var done = plan.commit();
  if (!done.ok) { w('失敗: ' + done.error + '（作成済みの記録は削除していません）'); return 5; }
  done.lines.forEach(w);
  return 0;
}

function prepareRunPlan(a, io, deps) {
  var now = io.now();
  var taskId = a['task-id'];
  var m = deps.observers.observeMain();
  if (!m) return { ok: false, error: 'main_unobservable' };
  if (!m.originMain || m.head !== m.originMain) return { ok: false, error: 'head_not_equal_origin_main' };   // Decision 120 決定 15
  if (m.currentBranch !== 'main' || m.stagedCount !== 0) return { ok: false, error: 'main_not_clean_branch' };
  var pmd5 = deps.observers.protectedMd5Map(deps.repoPath);
  if (!pmd5) return { ok: false, error: 'protected_unreadable' };
  var b = wc.deriveBranchName(taskId), wp = wc.deriveWorktreePath(deps.worktreeRoot, taskId, deps.repoPath);
  if (!b.ok || !wp.ok) return { ok: false, error: 'task_id_or_worktree_path_invalid' };
  var cap = _num(a['cap-usd']), maxInv = _num(a['max-invocations']), perInv = _num(a['max-budget-usd']);
  var cr = rs.createInitialRun({ taskId: taskId, task: { title: a.title, goal: a.goal, allowedPaths: _list(a.allowed), forbiddenPaths: _list(a.forbidden) },
    mainRepoPath: deps.repoPath, baseHead: m.head, branch: b.branch, worktreePath: wp.worktreePath, budget: { capUsd: cap, maxInvocations: maxInv },
    mainStatusHashAtStart: m.autopilotStatusHash, protectedMd5AtStart: pmd5, now: now });
  if (!cr.ok) return { ok: false, error: 'run_invalid', reasons: cr.errors || [cr.error] };
  var scope = ex.resolveExecutionScope(cr.run, {});
  if (!scope.ok) return { ok: false, error: 'scope_invalid', reasons: scope.reasons };
  if (ex.protectedFingerprintFromRun(cr.run) !== m.protectedFingerprint) return { ok: false, error: 'protected_record_mismatch' };
  var exeSha;
  try { exeSha = deps.observers.hashFile(a.exe); } catch (e) { return { ok: false, error: 'exe_unreadable' }; }
  var id = deps.git.readRepoIdentity(deps.repoPath);
  if (!id || !id.ok) return { ok: false, error: 'repo_identity_unavailable' };
  var ttl = Number.isFinite(_num(a['ttl-minutes'])) ? _num(a['ttl-minutes']) : 120;
  var pttl = Number.isFinite(_num(a['permit-ttl-minutes'])) ? _num(a['permit-ttl-minutes']) : 30;
  var bp = deps.permit.buildPermit({ repoIdentity: id.repoIdentity, expectedHead: m.head, expectedOriginMain: m.originMain, taskId: taskId, worktreeRoot: deps.worktreeRoot,
    protectedFingerprint: m.protectedFingerprint, autopilotStatusHash: m.autopilotStatusHash, approvedBy: 'human', approvedAt: now, ttlMs: pttl * 60000, now: now });
  if (!bp.ok) return { ok: false, error: 'permit_invalid', reasons: bp.errors || [bp.error] };
  var ap = ha.buildRunApproval({ approvalId: io.randomUUID(), run: cr.run, stages: orch.CLAUDE_STAGES.slice(), exeSha256: exeSha, cliVersion: a['cli-version'],
    maxInvocations: maxInv, maxBudgetUsdPerInvocation: perInv, issuedAt: now, expiresAt: new Date(Date.parse(now) + ttl * 60000).toISOString() });
  if (!ap.ok) return { ok: false, error: 'approval_invalid', reasons: ap.errors || [ap.error] };
  return {
    ok: true,
    summary: ['== 実行準備（run・Permit・実行承認）==', 'task: ' + taskId + ' / branch: ' + b.branch, 'worktree: ' + wp.worktreePath, 'baseHead: ' + m.head + '（= origin/main）',
      'allowed: ' + scope.allowedPaths.join(', ') + ' / forbidden: ' + (scope.forbiddenPaths.join(', ') || '(なし)'),
      'stages: ' + ap.approval.stages.join(' → ') + ' / 起動上限: ' + maxInv + ' / 1 回あたり上限(CLI 推定 USD): ' + perInv + ' / run 上限: ' + cap,
      '課金範囲: 月額プラン内限定・追加課金なし（USD 上限は CLI 推定値に対する停止条件で、追加課金の許可ではありません）',
      'CLI: ' + a['cli-version'] + ' / exe SHA-256: ' + exeSha, 'StructuredOutput: block（条件付き受け入れは未採用）',
      'Permit 有効期限: ' + bp.permit.expiresAt + ' / 実行承認 有効期限: ' + ap.approval.expiresAt],
    commit: function () {
      var c1 = rs.createRun(deps.store, cr.run);
      if (!c1.ok) return { ok: false, error: 'run_create_failed:' + c1.error };
      var c2 = deps.permit.writePermit(deps.permitStore, bp.permit, { now: io.now() });
      if (!c2.ok) return { ok: false, error: 'permit_write_failed:' + c2.error };
      var c3 = ha.writeApprovalRecord(deps.approvalStore, ha.wrapRecord(ha.KIND_RUN, ap.approval));
      if (!c3.ok) return { ok: false, error: 'approval_write_failed:' + c3.error };
      return { ok: true, lines: ['作成しました: run ' + taskId + ' / permitId ' + bp.permit.permitId + ' / runApprovalId ' + ap.approval.approvalId] };
    },
  };
}

function approveTestsPlan(a, io, deps) {
  var now = io.now();
  var rr = rs.readRun(deps.store, a['task-id']);
  if (!rr.ok || !rr.executable) return { ok: false, error: 'run_unreadable' };
  var run = rr.run;
  // 待機中（Orchestrator が所有・gate なし）：承認 file だけを作る。
  // gate 停止後（所有権解放済み・テスト承認 gate）：承認 file を作り、Human の操作として gate を解除する（再開は Orchestrator の resume_testing）
  var ol = rs.readOwnerLock(deps.store, run.taskId);
  var waiting = run.stage === 'testing' && run.gate === 'none' && run.outcome === null && run.lock !== null && ol.ok && ol.exists;
  var gated = run.stage === 'testing' && run.gate === 'human_approval_required' && run.gateReason === 'orchestrator:test_execution_approval_required'
    && run.outcome === null && run.lock === null && ol.ok && !ol.exists && run.testResults.length === 0;
  if (!waiting && !gated) return { ok: false, error: 'run_not_waiting_for_tests' };
  var reqId = a['approval-id'];
  if (typeof reqId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(reqId)) return { ok: false, error: 'approval_id_invalid' };
  var w = deps.observers.observeWorktree(run);
  if (!w) return { ok: false, error: 'worktree_unobservable' };
  var sel = deps.selectTests({ run: run, changedFiles: w.changedEntries.map(function (x) { return x.path; }) });
  if (!sel || !Array.isArray(sel.selected) || (sel.errors && sel.errors.length) || sel.requiresHumanApproval || !sel.selected.length) return { ok: false, error: 'test_plan_not_safe' };
  var files = sel.selected.map(function (s) { return _isObj(s) ? s.file : s; }).sort();
  var ttl = Number.isFinite(_num(a['ttl-minutes'])) ? _num(a['ttl-minutes']) : 30;
  var bt = ha.buildTestApproval({ approvalId: reqId, run: run, diffSha256: orch.diffSha256(w.changedEntries), testFiles: files, issuedAt: now,
    expiresAt: new Date(Date.parse(now) + ttl * 60000).toISOString() });
  if (!bt.ok) return { ok: false, error: 'test_approval_invalid', reasons: bt.errors };
  return {
    ok: true,
    summary: ['== テスト実行承認（single-use）==', 'task: ' + run.taskId + ' / worktree: ' + run.worktreePath, '差分 hash: ' + bt.approval.diffSha256 + '（' + w.changedEntries.length + ' 件）',
      'test: ' + files.join(', '), '注意: モデルが変更したコードをこの PC で実行します。差分を確認してから承認してください。', '有効期限: ' + bt.approval.expiresAt],
    commit: function () {
      var c1 = ha.writeApprovalRecord(deps.approvalStore, ha.wrapRecord(ha.KIND_TEST, bt.approval));
      if (!c1.ok) return { ok: false, error: 'approval_write_failed:' + c1.error };
      if (!gated) return { ok: true, lines: ['作成しました: テスト実行承認 ' + reqId] };
      var cur = rs.readRun(deps.store, run.taskId);
      if (!cur.ok || cur.run.revision !== run.revision) return { ok: false, error: 'run_changed_before_gate_release' };
      var ap = rs.approveHumanGate(cur.run, { now: io.now(), actor: 'human' });
      if (!ap.ok) return { ok: false, error: 'gate_release_refused:' + ap.error };
      var sv = rs.saveRun(deps.store, ap.run, { expectedUpdatedAt: cur.run.updatedAt, expectedRevision: cur.run.revision });
      return sv.ok ? { ok: true, lines: ['作成しました: テスト実行承認 ' + reqId + '（gate 解除済み。再開は resume_testing）'] } : { ok: false, error: 'gate_release_save_failed:' + sv.error };
    },
  };
}

// 本物の端末から Human が実行した場合だけの配線（この module を他から require しても実行されない）
if (require.main === module) {
  var os = require('os');
  var readline = require('readline');
  var repoRoot = path.resolve(__dirname, '..', '..');
  var auditRoot = path.resolve(repoRoot, '..', '.autopilot');
  var exe = require('./worktreeExecutor');
  var ts = require('./testSelector');
  var obs = require('./observers').createObservers({ repoPath: repoRoot, homeDir: os.homedir() });
  var rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
  var io = {
    isTTY: { stdin: process.stdin.isTTY === true, stdout: process.stdout.isTTY === true },
    write: function (s) { process.stdout.write(s); },
    readLine: function () { return new Promise(function (res) { rl.once('line', res); rl.once('close', function () { res(''); }); }); },
    now: function () { return new Date().toISOString(); }, randomBytes: crypto.randomBytes, randomUUID: crypto.randomUUID,
  };
  var deps = {
    repoPath: repoRoot, worktreeRoot: path.join(auditRoot, 'wt'), store: { runtimeRoot: auditRoot, repoPath: repoRoot },
    permitStore: { root: path.join(auditRoot, 'permits'), repoPath: repoRoot }, approvalStore: { root: auditRoot },
    observers: obs, git: exe, permit: require('./realRepoPermit'),
    selectTests: function (x) {
      var m = ts.loadTestManifest(path.join(x.run.worktreePath, 'tools', 'devAutopilot', 'testManifest.json'));
      return ts.selectTests({ changedFiles: x.changedFiles, manifest: m && m.manifest ? m.manifest : m, repoRoot: x.run.worktreePath });
    },
  };
  main(process.argv.slice(2), io, deps).then(function (code) { rl.close(); process.exitCode = code; }, function () { rl.close(); process.exitCode = 70; });
}

module.exports = { main: main, parseArgs: parseArgs, CONFIRM_NOTE: CONFIRM_NOTE };
