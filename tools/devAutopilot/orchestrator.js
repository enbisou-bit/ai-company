'use strict';
// tools/devAutopilot/orchestrator.js
// Development Autopilot V1 — Stage 4D：1 run の制御フロー（隔離 → research → design → implement → test → review → commit 承認待ち）
//
//   ★ run は作らない（Human が approveCli で作成・承認した既存の run だけを扱う）。自動 retry・自動修正・新 run の自動作成はしない。
//   ★ 実接続は有効にしない：依存（git・Permit・観測・spawn・test 実行）はすべて呼び出し側が明示的に渡す。既定で本物の CLI・実 spawn・
//     ホストでの test 実行へつながる経路は持たない（allowRealSpawn を渡さない。spawn 未指定なら停止）。この module に CLI 入口はない。
//   ★ HEAD = origin/main（Decision 120 決定 15）を隔離の前に確認する（Permit も同じ条件を検査する）。
//   ★ Permit（worktree add の single-use 許可）は隔離で 1 回だけ消費する。run の実行承認は消費済みにせず、起動ごとに executor が
//     予約済み invocation から計上して検査する。テスト実行承認は差分 hash・test file 一覧に束縛した single-use で、未承認なら停止する。
//   ★ 各窓（所有権取得・隔離・各 stage・test・最終）の前後で audit を snapshot し、期待する更新だけを許す（auditGuard）。
//   ★ 停止条件：失敗・未検証・終了未確認・費用不明・上限・Safety 違反・想定外の差分・test 失敗・audit 違反・観測不能・例外。
//     失敗・block では run 記録と lock を残す。Human 判断待ち（human gate）と commit 承認待ちでは自分の所有権を解放する
//     （lock を残すと Human 判断の後に再開できなくなるため。解放は自分の lock・未確定 invocation なしの場合だけ。自動奪取はしない）。
//   ★ 再開は mode:'resume_testing' だけ：テスト承認 gate を Human が解除した run を、implement を再実行せずに test → review → commit 承認待ちへ進める。
//     review に渡す design / implement の出力は、成功時に audit 配下へ保存したものを、記録済みの structuredOutputSha256 と照合して使う。
//     差分 hash が承認時と変われば、テスト実行承認を拒否する。
//   ★ commit はしない（Human が手動で行う）。markCompletedByHuman は呼ばない。

var rs = require('./runStore');
var wc = require('./worktreeController');
var rc = require('./riskClassifier');
var tc = require('./transcriptCheck');
var ex = require('./claudeExecutor');
var ha = require('./humanApproval');
var ag = require('./auditGuard');
var path = require('path');

var CLAUDE_STAGES = Object.freeze(['researching', 'designing', 'implementing', 'reviewing']);
var PREV_REQUIRED = Object.freeze({ researching: [], designing: ['research'], implementing: ['research', 'design'], reviewing: ['design', 'implement'] });
var BUILD_KEYS = ['objective', 'acceptanceCriteria', 'stopConditions', 'appendSystemPrompt', 'maxBudgetUsd', 'model'];
var MAX_OUTPUT_BYTES = 64 * 1024;   // 再開用に保存する stage 出力 1 件の上限（保存・読込の両方で検査）

function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

// worktree 差分の正規化 hash（path 順・path / status / 内容 hash / symlink）
function diffSha256(entries) {
  var list = (Array.isArray(entries) ? entries : []).map(function (x) { return { path: x.path, status: x.status, hash: x.hash, isSymlink: x.isSymlink }; })
    .sort(function (a, b) { return a.path < b.path ? -1 : a.path > b.path ? 1 : 0; });
  return tc.canonicalSha256(list);
}

// ctx は README 相当の説明を省略：{ store, auditRoot, auditFs?, approvalStore, permitStore, taskId, ownerId, pid, clock, permitId, runApprovalId,
//   worktreeRoot, mutationRepoAllowlist?, cli, builds{stage:{objective,...}}, parentEnv, limits?, testApprovalWaitMs?, pollMs?, onEvent?,
//   deps:{ git, permit, observers, spawn, runTests?, selectTests, readWorktreeLines, randomUUID, sleep, timers? } }
async function runOrchestration(ctx) {
  var c = _isObj(ctx) ? ctx : {};
  var d = _isObj(c.deps) ? c.deps : {};
  var obs = d.observers;
  var now = function () { return c.clock(); };
  var ev = function (e) { try { if (typeof c.onEvent === 'function') c.onEvent(e); } catch (x) { /* noop */ } };
  var result = function (ok, phase, code, extra) { return Object.assign({ ok: ok, phase: phase }, code ? { error: code } : {}, extra || {}); };
  var auditOpts = { fs: c.auditFs };
  var runSnap = null;   // 直近に読んだ run（観測関数に渡す。場所・branch は run 作成後に変わらない）

  // ── 0. 入力（実接続を有効にしない：spawn・git・観測・Permit は明示的な差し替えだけ）──
  if (typeof c.clock !== 'function' || typeof c.ownerId !== 'string' || !Number.isInteger(c.pid)) return result(false, 'input', 'ctx_invalid');
  if (typeof d.spawn !== 'function') return result(false, 'input', 'real_connection_not_enabled');
  if (!_isObj(d.git) || !_isObj(d.permit) || !_isObj(obs) || typeof d.selectTests !== 'function' || typeof d.readWorktreeLines !== 'function'
    || typeof d.randomUUID !== 'function' || typeof d.sleep !== 'function') return result(false, 'input', 'deps_incomplete');
  if (!_isObj(c.builds) || !CLAUDE_STAGES.every(function (s) { return _isObj(c.builds[s]) && Object.keys(c.builds[s]).every(function (k) { return BUILD_KEYS.indexOf(k) !== -1; }); })) return result(false, 'input', 'builds_invalid');

  try {
    // ── 1. run と実行承認（run は作らない）──
    var rr = rs.readRun(c.store, c.taskId);
    if (!rr.ok || !rr.executable) return result(false, 'load', 'run_unreadable');
    var run = rr.run;
    var resume = c.mode === 'resume_testing';
    if (!resume && (run.stage !== null || run.isolation.state !== 'absent' || run.outcome !== null || run.gate !== 'none' || run.lock !== null || run.invocations.length))
      return result(false, 'load', 'run_not_fresh');
    if (resume) { var re = resumeErrors(run); if (re.length) return result(false, 'load', 'run_not_resumable_for_testing', { reasons: re }); }
    var wtRel = path.relative(path.join(c.auditRoot, 'wt'), run.worktreePath);
    if (!wtRel || wtRel.indexOf('..') === 0 || path.isAbsolute(wtRel) || wtRel.indexOf(path.sep) !== -1 || wtRel !== c.taskId) return result(false, 'load', 'worktree_not_under_audit_wt');
    var la = ha.loadRunApproval(c.approvalStore, c.runApprovalId);
    if (!la.ok) return result(false, 'load', 'run_approval_unavailable', { cause: la.error });
    var approval = la.approval;
    if (!CLAUDE_STAGES.every(function (s) { return approval.stages.indexOf(s) !== -1; })) return result(false, 'load', 'run_approval_stages_incomplete');
    if (approval.maxInvocations < CLAUDE_STAGES.length || run.budget.maxInvocations < CLAUDE_STAGES.length) return result(false, 'load', 'invocation_limit_below_stage_count');
    var expectedMain = ex.expectedMainFromRun(run);
    if (!expectedMain) return result(false, 'load', 'run_main_record_unusable');

    // ── 2. 所有権（窓 A）──
    var a0 = ag.snapshotAudit(c.auditRoot, auditOpts);
    var own = rs.acquireOwnership(c.store, c.taskId, { ownerId: c.ownerId, pid: c.pid, now: now() });
    if (!own.ok) return result(false, 'ownership', 'ownership_failed', { cause: own.error });
    var a1 = ag.snapshotAudit(c.auditRoot, auditOpts);
    var vA = ag.verifyAuditTransition(a0, a1, { runs: _o(c.taskId, { ownerId: c.ownerId, revision: own.revision, lock: 'set', approvalId: approval.approvalId }),
      ownerLock: _o(c.taskId, { mode: 'created', ownerId: c.ownerId }) });
    if (!vA.ok) return await stopBlock('audit', 'audit_violation', { violations: vA.violations });

    var outputs = {};
    var wImpl, tr;
    if (resume) {
      // ── 再開（テスト承認 gate の後）：implement は再実行しない。保存済み stage 出力を記録の hash と照合して使う ──
      if (!current()) return result(false, 'resume', 'run_unreadable', { recordLeft: true, lockLeft: true });
      var wtProtBase = obs.worktreeProtectedSnapshot(runSnap);
      if (!wtProtBase || !wtProtBase.ok) return await stopBlock('resume', 'worktree_protected_unexpected', { reasons: wtProtBase && wtProtBase.reasons });
      for (var q = 0; q < 2; q++) {
        var rsn = ['design', 'implement'][q];
        var lo = loadOutput(rsn);
        if (!lo.ok) return await stopBlock('resume', 'stage_output_integrity_failed', { cause: lo.error, stage: rsn });
        outputs[rsn] = lo.output;
      }
      wImpl = obs.observeWorktree(current());
      if (!wImpl) return await stopBlock('resume', 'worktree_unobservable');
      var dc = rs.classifyResumeDiff(runSnap, wImpl.changedEntries.map(function (x) { return { path: x.path, status: x.status }; }));
      if (dc !== 'recorded_within_scope') return await stopBlock('resume', 'worktree_diff_not_recorded', { classification: dc });
      var rk = riskCheck(wImpl);
      if (rk) return await rk;
      tr = await testWindow(wImpl, a1, c.testApprovalId);
      if (!tr.ok) return tr;
    } else {

    // ── 3. 隔離（HEAD = origin/main・Permit 消費・worktree add・作成直後の検証・isolation 確定）──
    var iso = isolate();
    if (!iso.ok) return iso.stop ? await stopBlock('isolation', iso.error, iso.extra) : result(false, 'isolation', iso.error, Object.assign({ recordLeft: true, lockLeft: true }, iso.extra));
    var a2 = ag.snapshotAudit(c.auditRoot, auditOpts);
    var vB = ag.verifyAuditTransition(a1, a2, { runs: _o(c.taskId, { ownerId: c.ownerId, revision: iso.revision, isolationVerify: true, approvalId: approval.approvalId }), ownerLock: _o(c.taskId, 'same'),
      permitsConsumed: [c.permitId], worktreesAdded: [c.taskId] });
    if (!vB.ok) return await stopBlock('audit', 'audit_violation', { violations: vB.violations });
    wtProtBase = obs.worktreeProtectedSnapshot(runSnap);
    if (!wtProtBase || !wtProtBase.ok) return await stopBlock('isolation', 'worktree_protected_unexpected', { reasons: wtProtBase && wtProtBase.reasons });

    // ── 4. research → design → implement ──
    var aPrev = a2;
    for (var k = 0; k < 3; k++) {
      var st = CLAUDE_STAGES[k];
      var sr = await stageWindow(st, aPrev);
      if (!sr.ok) return sr;
      outputs[ex.RUNNER_STAGE[st]] = sr.stageOutput;
      aPrev = sr.audit;
    }

    // implement 差分の risk 分類（human 相当は gate・forbidden / unknown は block）
    wImpl = obs.observeWorktree(runSnap);
    if (!wImpl) return await stopBlock('risk', 'worktree_unobservable');
    var rk2 = riskCheck(wImpl);
    if (rk2) return await rk2;

    // ── 5. testing（mandatory safe test・テスト実行承認が必要）──
    tr = await testWindow(wImpl, aPrev, null);
    if (!tr.ok) return tr;
    }

    // ── 6. review（read-only）──
    var rv = await stageWindow('reviewing', tr.audit, { design: outputs.design, implement: outputs.implement });
    if (!rv.ok) return rv;

    // ── 7. 最終 Safety → commit 承認待ち → 所有権の解放 ──
    var wFinal = obs.observeWorktree(runSnap);
    if (!wFinal) return await stopBlock('final', 'worktree_unobservable');
    if (diffSha256(wFinal.changedEntries) !== tr.diffSha256) return await stopBlock('final', 'diff_changed_after_tests');
    var mFinal = obs.observeMain();
    if (!mFinal || mFinal.autopilotStatusHash !== expectedMain.autopilotStatusHash || mFinal.protectedFingerprint !== expectedMain.protectedFingerprint) return await stopBlock('final', 'main_state_changed');
    var wtProtFinal = obs.worktreeProtectedSnapshot(runSnap);
    if (!wtProtFinal || !wtProtFinal.ok || JSON.stringify(wtProtFinal.entries) !== JSON.stringify(wtProtBase.entries)) return await stopBlock('final', 'worktree_protected_changed');
    var cur = rs.readRun(c.store, c.taskId).run;
    var mk = rs.markAwaitingCommitApproval(cur, { now: now(), currentDiffSha256: tr.diffSha256, safety: 'ok' });
    if (!mk.ok) return await stopBlock('final', 'commit_gate_refused', { cause: mk.error, errors: mk.errors });
    var svm = rs.saveRunAsOwner(c.store, mk.run, { ownerId: c.ownerId, expectedRevision: cur.revision, now: now() });
    if (!svm.ok) return result(false, 'final', 'commit_gate_save_failed', { cause: svm.error, recordLeft: true, lockLeft: true });
    var rel = rs.releaseOwnership(c.store, c.taskId, { ownerId: c.ownerId, expectedRevision: svm.revision, now: now() });
    if (!rel.ok) return result(false, 'final', 'release_failed', { cause: rel.error, gate: 'awaiting_commit_approval' });
    var aF = ag.snapshotAudit(c.auditRoot, auditOpts);
    var vF = ag.verifyAuditTransition(rv.audit, aF, { runs: _o(c.taskId, { ownerId: c.ownerId, revision: rel.revision, lock: 'cleared', gateTo: 'awaiting_commit_approval', approvalId: approval.approvalId }),
      ownerLock: _o(c.taskId, 'removed') });
    if (!vF.ok) return result(false, 'audit', 'audit_violation', { violations: vF.violations, gate: 'awaiting_commit_approval' });
    return result(true, 'done', null, { gate: 'awaiting_commit_approval', diffSha256: tr.diffSha256, revision: rel.revision });
  } catch (e) {
    return result(false, 'internal', 'orchestrator_internal_error', { recordLeft: true, lockLeft: true });
  }

  // ── helpers ─────────────────────────────────────────────
  function _o(k, v) { var o = {}; o[k] = v; return o; }
  function current() { var r = rs.readRun(c.store, c.taskId); if (r.ok) runSnap = r.run; return r.ok ? r.run : null; }
  // 停止（block）：記録して停止。lock は残す（自動再開しない）
  async function stopBlock(phase, code, extra) {
    var cur2 = current();
    if (cur2 && cur2.outcome === null && cur2.gate === 'none' && !cur2.invocations.some(function (x) { return x.state !== 'finished'; })) {
      var b = rs.blockRun(cur2, 'orchestrator:' + code, { now: now() });
      if (b.ok) rs.saveRunAsOwner(c.store, b.run, { ownerId: c.ownerId, expectedRevision: cur2.revision, now: now() });
    }
    ev({ type: 'stopped', phase: phase, error: code });
    return result(false, phase, code, Object.assign({ recordLeft: true, lockLeft: true }, extra || {}));
  }
  // Human gate（待機）：記録した後、自分の所有権を解放する（lock を残すと Human 判断後に再開できなくなるため）。
  //   解放は自分の lock・未確定 invocation なしの場合だけ（releaseOwnership の条件）。lock の自動奪取はしない。
  async function stopGate(phase, code, extra) {
    var cur2 = current();
    if (cur2 && cur2.outcome === null && cur2.gate === 'none') {
      var g = rs.requireHumanApproval(cur2, 'orchestrator:' + code, { now: now() });
      if (g.ok) rs.saveRunAsOwner(c.store, g.run, { ownerId: c.ownerId, expectedRevision: cur2.revision, now: now() });
    }
    var released = releaseForHuman();
    ev({ type: 'human_gate', phase: phase, error: code });
    return result(false, phase, code, Object.assign({ gate: 'human_approval_required', recordLeft: true, lockLeft: !released }, extra || {}));
  }
  function releaseForHuman() {
    var cur3 = current();
    if (!cur3 || cur3.gate !== 'human_approval_required' || !cur3.lock || cur3.lock.ownerId !== c.ownerId) return false;
    var rl = rs.releaseOwnership(c.store, c.taskId, { ownerId: c.ownerId, expectedRevision: cur3.revision, now: now() });
    return !!rl.ok;
  }
  // 再開（resume_testing）の条件：テスト承認 gate を Human が解除済み・research / design / implement が各 1 回成功・test 未実行・lock なし
  function resumeErrors(r) {
    var e = [];
    if (r.stage !== 'testing' || r.gate !== 'none' || r.outcome !== null || r.lock !== null || r.isolation.state !== 'verified') e.push('state');
    if (r.testResults.length) e.push('tests_already_recorded');
    var st3 = ['researching', 'designing', 'implementing'];
    if (r.invocations.length !== 3 || !r.invocations.every(function (x, i) {
      return x.stage === st3[i] && x.state === 'finished' && x.result && x.result.disposition === 'none' && rs.VERIFIED_VERDICTS.indexOf(x.result.transcript.verdict) !== -1;
    })) e.push('invocations');
    var h = r.stageHistory[r.stageHistory.length - 1];
    if (!h || h.stage !== 'testing' || h.result !== 'human_approved') e.push('gate_not_approved_by_human');
    return e;
  }
  // stage 出力の保存（再開用）：秘密情報なし・記録済みの structuredOutputSha256 と一致するものだけを新規作成
  function _outPath(runnerStage) { return path.join(c.auditRoot, 'runs', c.taskId, 'outputs', runnerStage + '.json'); }
  //   保存・読込とも同じ検査を通す：stage schema（未知 key なし＝raw stdout / stderr / transcript / env 値は入らない）・サイズ上限・秘密情報の検査・
  //   記録済み hash との一致。hash 一致は「記録と同じ内容」の確認であり、内容が安全であることの判断には使わない。
  //   ★ 秘密情報の検査は key 名と明白な値パターンによるもので、漏えいを完全に防ぐ保証ではない。不正・検査不能なら停止する。
  function _outputErrors(runnerStage, out, bytes, expectedSha) {
    if (!Number.isInteger(bytes) || bytes <= 0 || bytes > MAX_OUTPUT_BYTES) return 'output_size_invalid';
    if (!require('./claudeRunner').validateStageOutput(runnerStage, out).ok) return 'output_invalid';
    if (rs.findSecrets(out).length) return 'output_contains_secret';
    if (typeof expectedSha !== 'string' || expectedSha !== tc.canonicalSha256(out)) return 'output_hash_mismatch';
    return null;
  }
  function writeOutput(runnerStage, out, invocationId) {
    var fsx = (c.store && c.store.fs) || require('fs');
    var cur3 = current();
    var inv = cur3 && cur3.invocations.filter(function (x) { return x.invocationId === invocationId; })[0];
    var data;
    try { data = JSON.stringify(out, null, 2) + '\n'; } catch (x) { return { ok: false, error: 'output_unserializable' }; }
    var oe = _outputErrors(runnerStage, out, Buffer.byteLength(data), inv && inv.result ? inv.result.structuredOutputSha256 : null);
    if (oe) return { ok: false, error: oe };
    var p = _outPath(runnerStage), fd = null;
    try {
      fsx.mkdirSync(path.dirname(p), { recursive: true });
      fd = fsx.openSync(p, 'wx'); fsx.writeSync(fd, data); fsx.fsyncSync(fd); fsx.closeSync(fd); fd = null;
    } catch (x) { if (fd !== null) { try { fsx.closeSync(fd); } catch (y) { /* ignore */ } } return { ok: false, error: 'output_write_failed' }; }
    return { ok: true, path: 'runs/' + c.taskId + '/outputs/' + runnerStage + '.json', sha256: require('crypto').createHash('sha256').update(data).digest('hex') };
  }
  function loadOutput(runnerStage) {
    var fsx = (c.store && c.store.fs) || require('fs');
    var raw, out, p = _outPath(runnerStage);
    try {
      var st = fsx.lstatSync(p);
      if (!st.isFile() || st.isSymbolicLink() || st.size > MAX_OUTPUT_BYTES) return { ok: false, error: 'output_size_invalid' };   // 読む前に大きさ・種別を確認
      raw = fsx.readFileSync(p, 'utf8'); out = JSON.parse(raw);
    } catch (x) { return { ok: false, error: 'output_unreadable' }; }
    var stageName = Object.keys(ex.RUNNER_STAGE).filter(function (k) { return ex.RUNNER_STAGE[k] === runnerStage; })[0];
    var inv = runSnap.invocations.filter(function (x) { return x.stage === stageName; })[0];
    var oe = _outputErrors(runnerStage, out, Buffer.byteLength(raw), inv && inv.result ? inv.result.structuredOutputSha256 : null);
    if (oe) return { ok: false, error: oe };
    return { ok: true, output: out };
  }
  // implement 差分の risk 分類（human 相当は gate・forbidden / unknown は block）。停止する場合は停止処理の Promise を返す
  function riskCheck(w) {
    if (!w.changedEntries.length) return stopGate('risk', 'no_changes_after_implement');
    var files = [];
    for (var j = 0; j < w.changedEntries.length; j++) {
      var e = w.changedEntries[j];
      var lines = e.status === 'deleted' ? [] : d.readWorktreeLines(runSnap, e.path);   // 変更後の内容全体を追加行として扱う（安全側に判定）
      if (!Array.isArray(lines)) return stopBlock('risk', 'worktree_file_unreadable');
      files.push({ path: e.path, status: e.status === 'untracked' ? 'added' : e.status, addedLines: lines });
    }
    var cls = rc.classifyDevelopmentChange({ allowedPaths: runSnap.task.allowedPaths, files: files });
    var gate = rc.gateForClassification(cls.classification);
    if (gate.proceed) return null;
    if (gate.gate === 'human_approval_required') return stopGate('risk', 'implementation_requires_human:' + cls.classification);
    return stopBlock('risk', 'implementation_' + cls.classification);
  }

  function isolate() {
    var g = d.git;
    var cur2 = current();
    var repo = cur2.mainRepoPath;
    var m = obs.observeMain();
    if (!m) return { ok: false, stop: true, error: 'main_unobservable' };
    if (m.head !== cur2.baseHead) return { ok: false, stop: true, error: 'head_mismatch' };
    if (!m.originMain || m.originMain !== m.head) return { ok: false, stop: true, error: 'head_not_equal_origin_main' };   // Decision 120 決定 15
    if (m.autopilotStatusHash !== expectedMain.autopilotStatusHash || m.protectedFingerprint !== expectedMain.protectedFingerprint) return { ok: false, stop: true, error: 'main_state_changed' };
    var b = wc.deriveBranchName(c.taskId);
    var wp = wc.deriveWorktreePath(c.worktreeRoot, c.taskId, repo);
    if (!b.ok || b.branch !== cur2.branch || !wp.ok || !wc.samePath(wp.worktreePath, cur2.worktreePath)) return { ok: false, stop: true, error: 'run_isolation_plan_mismatch' };
    var st = g.readRepoState(repo), id = g.readRepoIdentity(repo);
    if (!st.ok || !id.ok) return { ok: false, stop: true, error: 'repo_unobservable' };
    var tip = g.runGitReadOnly('verifyDevRef', { dir: repo, ref: b.ref });
    var anc = g.runGitReadOnly('isAncestor', { dir: repo, ancestor: m.originMain, descendant: st.head });
    var target = g.inspectTargetPath(wp.worktreePath), hooks = g.detectActiveHooks(repo);
    var ls = g.runGitReadOnly('lsFilesZ', { dir: repo });
    if (!ls.ok) return { ok: false, stop: true, error: 'repo_unobservable' };
    var maxTracked = ls.stdout.split('\u0000').reduce(function (mx, p) { return Math.max(mx, p.length); }, 0);
    var pf = wc.validateIsolationPreflight({
      currentBranch: st.currentBranch, stagedCount: st.stagedCount, currentHead: st.head, originMain: m.originMain,
      originIsAncestor: anc.ok ? true : (anc.exitCode === 1 ? false : undefined), protectedFingerprint: m.protectedFingerprint, mainStatusHash: st.autopilotStatusHash,
      existingBranchRefs: st.branchRefs, targetBranchExists: tip.ok ? true : (tip.exitCode === 1 ? false : undefined),
      targetWorktreeExists: target.ok ? target.exists : undefined, pathCollision: false, pathHasLinkOrJunction: target.ok ? target.hasLinkOrJunction : undefined,
      activeHooks: hooks.active, worktreeListPorcelain: st.worktreeListPorcelain, maxTrackedPathLength: maxTracked || 1,
    }, { taskId: c.taskId, repoPath: repo, worktreeRoot: c.worktreeRoot, baseHead: cur2.baseHead, protectedFingerprint: expectedMain.protectedFingerprint,
      mainStatusHash: expectedMain.autopilotStatusHash, run: cur2 });
    if (pf.result !== 'pass') return { ok: false, stop: true, error: 'isolation_preflight_blocked', extra: { reasons: pf.reasons } };
    var cp = d.permit.consumePermit(c.permitStore, c.permitId, { repoIdentity: id.repoIdentity, currentHead: st.head, currentOriginMain: m.originMain, taskId: c.taskId,
      branch: b.branch, worktreePath: wp.worktreePath, protectedFingerprint: m.protectedFingerprint, autopilotStatusHash: st.autopilotStatusHash }, { now: now() });
    if (!cp.ok) return { ok: false, stop: true, error: 'permit_consume_failed', extra: { cause: cp.error } };
    var self = typeof g.SELF_REPO_ROOT === 'string' && wc.samePath(repo, g.SELF_REPO_ROOT);
    var exr = g.executeWorktreeCreate(pf, self ? { realRepoCapability: cp.capability } : { mutationRepoAllowlist: c.mutationRepoAllowlist || [] });
    if (!exr.ok) return { ok: false, stop: true, error: 'worktree_create_failed', extra: { cause: exr.error } };
    var ws = g.readWorktreeState(wp.worktreePath), stA = g.readRepoState(repo), mA = obs.observeMain();
    if (!ws.ok || !stA.ok || !mA) return { ok: false, stop: true, error: 'created_worktree_unobservable' };
    var changed = ws.statusLines.map(function (l) { return l.slice(3); });
    var created = wc.validateCreatedWorktree({
      worktreeHead: ws.head, worktreeBranchRef: ws.branchRef, worktreeStatusCount: ws.statusLines.length, worktreeGitCommonDir: ws.gitCommonDir, mainGitCommonDir: stA.gitCommonDir,
      worktreeListPorcelain: stA.worktreeListPorcelain, worktreeEnvFiles: ws.envFiles || [], worktreeProtectedChanged: changed.some(function (p) { return rc.isProtectedPath(p); }),
      mainHeadBefore: st.head, mainHeadAfter: stA.head, mainStatusHashBefore: st.autopilotStatusHash, mainStatusHashAfter: stA.autopilotStatusHash,
      mainProtectedFingerprintBefore: m.protectedFingerprint, mainProtectedFingerprintAfter: mA.protectedFingerprint,
    }, cur2);
    if (created.result !== 'valid') return { ok: false, stop: true, error: 'created_worktree_invalid', extra: { reasons: created.reasons } };
    var cur3 = current();
    var mi = rs.markIsolationVerified(cur3, { now: now(), worktreeHead: ws.head });
    if (!mi.ok) return { ok: false, stop: true, error: 'isolation_record_refused', extra: { cause: mi.error } };
    var sv = rs.saveRunAsOwner(c.store, mi.run, { ownerId: c.ownerId, expectedRevision: cur3.revision, now: now() });
    if (!sv.ok) return { ok: false, stop: false, error: 'isolation_save_failed', extra: { cause: sv.error } };
    runSnap = sv.run;
    return { ok: true, revision: sv.revision };
  }

  // stage の窓：遷移 → 起動（executor）→ audit 検証 → 結果判定
  async function stageWindow(stage, aBefore, prevOverride) {
    var cur2 = current();
    var t = rs.transitionStage(cur2, stage, { now: now() });
    if (!t.ok) return await stopBlock('stage:' + stage, 'transition_refused', { cause: t.error });
    var sv = rs.saveRunAsOwner(c.store, t.run, { ownerId: c.ownerId, expectedRevision: cur2.revision, now: now() });
    if (!sv.ok) return result(false, 'stage:' + stage, 'transition_save_failed', { cause: sv.error, recordLeft: true, lockLeft: true });
    runSnap = sv.run;
    var prev = {};
    PREV_REQUIRED[stage].forEach(function (s) { prev[s] = prevOverride ? prevOverride[s] : outputs[s]; });
    if (Object.keys(prev).some(function (s) { return !_isObj(prev[s]); })) return await stopBlock('stage:' + stage, 'previous_output_missing');
    var res = await ex.runInvocation({
      store: c.store, taskId: c.taskId, ownerId: c.ownerId, clock: c.clock, cli: c.cli, approval: approval,
      build: Object.assign({}, c.builds[stage], { previousOutputs: prev }),
      deps: { spawn: d.spawn, hashFile: obs.hashFile, parentEnv: c.parentEnv || {}, observeMain: obs.observeMain, observeWorktree: function () { return obs.observeWorktree(runSnap); },
        readTranscript: obs.readTranscript, randomUUID: d.randomUUID, timers: d.timers },
      limits: c.limits,
    });
    // 成功した stage の出力は、再開用に audit 配下へ保存する（記録済みの hash と一致・秘密情報なし・新規作成だけ）。review の出力は保存しない
    var succeeded = res && res.ok && res.disposition === 'none' && res.runOutcome === null && res.runGate === 'none' && _isObj(res.stageOutput);
    var wo = null;
    if (succeeded && stage !== 'reviewing') {
      wo = writeOutput(ex.RUNNER_STAGE[stage], res.stageOutput, res.invocationId);
      if (!wo.ok) return await stopBlock('stage:' + stage, 'stage_output_save_failed', { cause: wo.error });
    }
    var aAfter = ag.snapshotAudit(c.auditRoot, auditOpts);
    var allow = { ownerId: c.ownerId, stageTo: stage, newInvocationIds: res && res.invocationId ? [res.invocationId] : [], terminalAllowed: true, approvalId: approval.approvalId };
    var afterRun = aAfter.ok && aAfter.entries['runs/' + c.taskId + '/run.json'] ? aAfter.entries['runs/' + c.taskId + '/run.json'].json : null;
    allow.revision = res && res.ok ? res.revision : (afterRun ? afterRun.revision : -1);   // 失敗時は予約の有無が不定のため、内容の遷移（承認・stage・件数）だけを検証する
    if (!(res && res.ok) && afterRun) allow.newInvocationIds = afterRun.invocations.filter(function (x) { return !cur2.invocations.some(function (y) { return y.invocationId === x.invocationId; }); }).map(function (x) { return x.invocationId; }).slice(0, 1);
    var vS = ag.verifyAuditTransition(aBefore, aAfter, { runs: _o(c.taskId, allow), ownerLock: _o(c.taskId, 'same'), outputsWritten: wo ? [{ path: wo.path, sha256: wo.sha256 }] : [] });
    if (!vS.ok) return await stopBlock('audit', 'audit_violation', { violations: vS.violations, stage: stage });
    if (!res || !res.ok) return result(false, 'stage:' + stage, 'invocation_failed', { cause: res && res.error, invocationPhase: res && res.phase, recordLeft: true, lockLeft: true });
    runSnap = current();
    if (res.disposition !== 'none' || res.runOutcome !== null || res.runGate !== 'none') {
      var rel2 = res.runGate === 'human_approval_required' ? releaseForHuman() : false;   // Human 判断待ち（費用不明など）は所有権を解放する
      return result(false, 'stage:' + stage, 'stage_not_successful', { disposition: res.disposition, dispositionReason: res.dispositionReason, runOutcome: res.runOutcome, runGate: res.runGate, recordLeft: true, lockLeft: !rel2 });
    }
    if (!_isObj(res.stageOutput)) return await stopBlock('stage:' + stage, 'stage_output_missing');
    var wp = obs.worktreeProtectedSnapshot(runSnap);
    if (!wp || !wp.ok || JSON.stringify(wp.entries) !== JSON.stringify(wtProtBase.entries)) return await stopBlock('stage:' + stage, 'worktree_protected_changed');
    return { ok: true, stageOutput: res.stageOutput, audit: aAfter };
  }

  // testing の窓：selector → テスト実行承認（single-use・差分 hash 束縛）→ 実行（差し替えのみ）→ 記録
  //   resumeApprovalId：再開時に Human が発行した承認 ID（stage は既に testing・遷移しない・待たない）
  async function testWindow(wImpl, aBefore, resumeApprovalId) {
    var cur2 = current();
    if (!resumeApprovalId) {
      var t = rs.transitionStage(cur2, 'testing', { now: now() });
      if (!t.ok) return await stopBlock('testing', 'transition_refused', { cause: t.error });
      var sv = rs.saveRunAsOwner(c.store, t.run, { ownerId: c.ownerId, expectedRevision: cur2.revision, now: now() });
      if (!sv.ok) return result(false, 'testing', 'transition_save_failed', { cause: sv.error, recordLeft: true, lockLeft: true });
      runSnap = sv.run;
    } else if (cur2.stage !== 'testing') return await stopBlock('testing', 'resume_not_in_testing');
    var dsha = diffSha256(wImpl.changedEntries);
    var sel = d.selectTests({ run: runSnap, changedFiles: wImpl.changedEntries.map(function (x) { return x.path; }) });
    if (!sel || !Array.isArray(sel.selected) || (sel.errors && sel.errors.length) || sel.requiresHumanApproval || !sel.selected.length) return await stopGate('testing', 'test_plan_requires_human');
    var testFiles = sel.selected.map(function (s) { return _isObj(s) ? s.file : s; }).slice().sort();
    // テスト実行承認：要求 ID を通知し、上限時間内だけ待つ（既定 0 = 待たずに停止）。承認は Human が approveCli で発行する。
    //   再開時は Human が発行済みの ID だけを使い、現在の差分 hash・test 一覧と一致しなければ拒否する
    var reqId = resumeApprovalId || d.randomUUID();
    if (!resumeApprovalId) ev({ type: 'test_approval_required', approvalId: reqId, diffSha256: dsha, testFiles: testFiles });
    var waitMs = !resumeApprovalId && Number.isInteger(c.testApprovalWaitMs) && c.testApprovalWaitMs > 0 ? c.testApprovalWaitMs : 0;
    var pollMs = Number.isInteger(c.pollMs) && c.pollMs > 0 ? c.pollMs : 5000;
    var started = Date.now(), cons = null;
    for (;;) {
      cons = ha.consumeTestApproval(c.approvalStore, reqId, { run: runSnap, diffSha256: dsha, testFiles: testFiles, now: now() });
      if (cons.ok || cons.error !== 'approval_not_found') break;
      if (Date.now() - started >= waitMs) break;
      await d.sleep(pollMs);
    }
    if (!cons.ok) return cons.error === 'approval_not_found' && !resumeApprovalId ? await stopGate('testing', 'test_execution_approval_required', { testApprovalId: reqId })
      : await stopBlock('testing', 'test_approval_rejected', { cause: cons.error, reasons: cons.reasons });
    if (typeof d.runTests !== 'function') return await stopGate('testing', 'host_test_execution_not_enabled');
    var before = obs.worktreeProtectedSnapshot(runSnap);
    // Decision 121：消費済みのテスト実行承認（差分 hash・test 一覧に束縛）を実行側にも渡し、一覧・場所の一致を再確認させる
    var out = d.runTests({ worktreePath: runSnap.worktreePath, files: testFiles, testApproval: cons.approval });
    var after = obs.worktreeProtectedSnapshot(runSnap);
    if (!before || !before.ok || !after || !after.ok || JSON.stringify(before.entries) !== JSON.stringify(after.entries) || JSON.stringify(after.entries) !== JSON.stringify(wtProtBase.entries))
      return await stopBlock('testing', 'worktree_protected_changed');
    if (!out || !out.ok || !Array.isArray(out.results) || out.results.length !== testFiles.length) return await stopBlock('testing', 'test_execution_failed', { cause: out && out.error });
    var wAfter = obs.observeWorktree(runSnap);
    if (!wAfter || diffSha256(wAfter.changedEntries) !== dsha) return await stopBlock('testing', 'tests_changed_worktree');
    var cur3 = current();
    var rec = rs.recordTestResults(cur3, { now: now(), batchId: d.randomUUID(), diffSha256: dsha, results: out.results.map(function (x) { return { file: x.file, exitCode: x.exitCode, timedOut: x.timedOut }; }) });
    if (!rec.ok) return await stopBlock('testing', 'test_results_refused', { cause: rec.error });
    var sv2 = rs.saveRunAsOwner(c.store, rec.run, { ownerId: c.ownerId, expectedRevision: cur3.revision, now: now() });
    if (!sv2.ok) return result(false, 'testing', 'test_results_save_failed', { cause: sv2.error, recordLeft: true, lockLeft: true });
    runSnap = sv2.run;
    var aAfter = ag.snapshotAudit(c.auditRoot, auditOpts);
    var vT = ag.verifyAuditTransition(aBefore, aAfter, { runs: _o(c.taskId, { ownerId: c.ownerId, revision: sv2.revision, stageTo: 'testing', testResultsAdded: true, approvalId: approval.approvalId }),
      ownerLock: _o(c.taskId, 'same'), approvalsConsumed: [{ id: reqId, sha256: cons.fileSha256 }] });
    if (!vT.ok) return await stopBlock('audit', 'audit_violation', { violations: vT.violations });
    if (!sv2.run.testResults.filter(function (x) { return x.diffSha256 === dsha; }).every(function (x) { return x.passed; })) {
      var f = rs.failRun(sv2.run, 'orchestrator:tests_failed', { now: now() });
      if (f.ok) rs.saveRunAsOwner(c.store, f.run, { ownerId: c.ownerId, expectedRevision: sv2.run.revision, now: now() });
      return result(false, 'testing', 'tests_failed', { recordLeft: true, lockLeft: true });   // 自動修正・retry しない
    }
    return { ok: true, diffSha256: dsha, audit: aAfter };
  }
}

module.exports = { CLAUDE_STAGES: CLAUDE_STAGES, PREV_REQUIRED: PREV_REQUIRED, diffSha256: diffSha256, runOrchestration: runOrchestration };
