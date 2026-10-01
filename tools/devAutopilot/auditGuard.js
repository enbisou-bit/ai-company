'use strict';
// tools/devAutopilot/auditGuard.js
// Development Autopilot V1 — Stage 4D：audit root（.autopilot）の「期待する更新だけ」を許す検査
//
//   ★ audit には正当な更新（run 記録の予約・heartbeat・完了保存・stage 遷移・test 結果、owner.lock の作成 / 削除、Permit・承認の消費、
//     worktree の追加）がある。全体 fingerprint の単純比較ではなく、窓（before → after）ごとに期待する更新を宣言し、
//     それ以外の追加・削除・変更をすべて違反として検出する。
//   ★ runs/ を検査対象外にしない。run.json は内容（identity・revision・invocation・testResults・lock・stage）で遷移を検証する。
//   ★ wt/ は直下の entry（worktree の追加）だけを扱う。worktree の中身は Runner の差分検証（claudeRunner.validatePostRunDiff）で扱う。
//   ★ symlink / junction・一時 file（write.lock・.create.lock・*.tmp-*）の残存は常に違反。
//   ★ 読み取り専用。修復・削除・巻き戻しはしない。

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var rs = require('./runStore');

var MAX_ENTRIES = 5000;
var MAX_FILE_BYTES = 4 * 1024 * 1024;
var RUN_IDENTITY_KEYS = ['schemaVersion', 'taskId', 'task', 'mainRepoPath', 'baseHead', 'branch', 'worktreePath', 'startedAt', 'mainStatusHashAtStart', 'protectedMd5AtStart', 'budget.capUsd', 'budget.maxInvocations'];

function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _sha(b) { return crypto.createHash('sha256').update(b).digest('hex'); }
function _same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function _get(o, k) { return k.split('.').reduce(function (x, p) { return _isObj(x) ? x[p] : undefined; }, o); }
function _rel(p) { return p.split(path.sep).join('/'); }

// root 配下の snapshot（file は SHA-256、runs/*/run.json は内容も保持）。読めない entry は ok:false（検査不能 = 違反扱い）
function snapshotAudit(root, opts) {
  var fsx = (opts && opts.fs) || fs;
  var entries = {}, count = 0, errors = [];
  function walk(dirAbs, dirRel, depth) {
    var names;
    try { names = fsx.readdirSync(dirAbs); } catch (e) { errors.push('unreadable:' + (dirRel || '.')); return; }
    names.forEach(function (n) {
      if (++count > MAX_ENTRIES) { errors.push('too_many_entries'); return; }
      var abs = path.join(dirAbs, n), rel = dirRel ? dirRel + '/' + n : n, st;
      try { st = fsx.lstatSync(abs); } catch (e) { errors.push('unreadable:' + rel); return; }
      if (st.isSymbolicLink()) { entries[rel] = { type: 'link' }; return; }
      if (st.isDirectory()) {
        entries[rel] = { type: 'dir' };
        if (dirRel === 'wt') return;               // worktree の中身は対象外（直下 entry のみ）
        walk(abs, rel, depth + 1);
        return;
      }
      if (!st.isFile()) { entries[rel] = { type: 'other' }; return; }
      if (st.size > MAX_FILE_BYTES) { entries[rel] = { type: 'file', sha256: 'too_large', size: st.size }; return; }
      var buf;
      try { buf = fsx.readFileSync(abs); } catch (e) { errors.push('unreadable:' + rel); return; }
      var ent = { type: 'file', sha256: _sha(buf), size: buf.length };
      if (/^runs\/[^\/]+\/(run\.json|owner\.lock)$/.test(rel)) { try { ent.json = JSON.parse(String(buf)); } catch (e) { ent.json = null; } }
      entries[rel] = ent;
    });
  }
  var st0;
  try { st0 = fsx.lstatSync(root); } catch (e) { return { ok: false, errors: ['root_unreadable'] }; }
  if (!st0.isDirectory() || st0.isSymbolicLink()) return { ok: false, errors: ['root_not_directory'] };
  walk(root, '', 0);
  return errors.length ? { ok: false, errors: errors } : { ok: true, entries: entries };
}

// run.json の遷移検証（before → after）
//   allow: { ownerId, revision, lock:'same'|'set'|'cleared', stageTo?, isolationVerify?, newInvocationIds?[], testResultsAdded?, terminalAllowed?, gateTo? }
function validateRunTransition(before, after, allow) {
  var e = [];
  var a = _isObj(allow) ? allow : {};
  if (!_isObj(after) || !rs.validateRunState(after).ok) return ['run_after_invalid'];
  if (!_isObj(before) || !rs.validateRunState(before).ok) return ['run_before_invalid'];
  RUN_IDENTITY_KEYS.forEach(function (k) { if (!_same(_get(before, k), _get(after, k))) e.push('run_identity_changed:' + k); });
  if (after.revision !== a.revision) e.push('run_revision_unexpected');
  var lk = a.lock || 'same';
  if (lk === 'same' && !(before.lock && after.lock && after.lock.ownerId === a.ownerId && before.lock.ownerId === a.ownerId && after.lock.pid === before.lock.pid)) e.push('run_lock_changed');
  if (lk === 'set' && !(before.lock === null && after.lock && after.lock.ownerId === a.ownerId)) e.push('run_lock_not_set_by_owner');
  if (lk === 'cleared' && !(before.lock && before.lock.ownerId === a.ownerId && after.lock === null)) e.push('run_lock_not_cleared');
  var stageTo = a.stageTo === undefined ? before.stage : a.stageTo;
  if (after.stage !== stageTo) e.push('run_stage_unexpected');
  if (a.isolationVerify) { if (!(before.isolation.state === 'absent' && after.isolation.state === 'verified')) e.push('run_isolation_unexpected'); }
  else if (!_same(before.isolation, after.isolation)) e.push('run_isolation_changed');
  // invocation：既存（すべて確定済みであること）は不変・新規は宣言した ID だけ
  var ids = {};
  before.invocations.forEach(function (x) {
    ids[x.invocationId] = true;
    if (x.state === 'started') e.push('run_had_unfinalized_invocation');
    var y = after.invocations.filter(function (z) { return z.invocationId === x.invocationId; })[0];
    if (!y || !_same(x, y)) e.push('run_invocation_rewritten');
  });
  var added = after.invocations.filter(function (z) { return !ids[z.invocationId]; });
  var allowIds = Array.isArray(a.newInvocationIds) ? a.newInvocationIds : [];
  if (added.length > 1 || added.some(function (z) { return allowIds.indexOf(z.invocationId) === -1; })) e.push('run_invocation_unexpected');
  // 新しい予約は、この窓の stage・この run の実行承認によるものだけ（launch の承認 ID を照合）
  if (added.some(function (z) { return z.stage !== after.stage || !_isObj(z.launch) || z.launch.approvalId !== a.approvalId; })) e.push('run_invocation_not_from_expected_approval');
  if (!_same(after.testResults.slice(0, before.testResults.length), before.testResults)) e.push('run_test_results_rewritten');
  if (after.testResults.length > before.testResults.length && !a.testResultsAdded) e.push('run_test_results_unexpected');
  if (!_same(after.filesChanged.slice(0, before.filesChanged.length), before.filesChanged)) e.push('run_files_changed_rewritten');
  // outcome / gate：invocation の窓では Runner が block / fail / human gate を記録し得る（terminalAllowed）。それ以外は宣言した gate だけ
  var gateTo = a.gateTo === undefined ? before.gate : a.gateTo;
  // terminalAllowed でも Runner が記録し得るのは blocked / failed / human gate だけ（completed・commit 承認待ちは不可）
  var runnerTerminal = a.terminalAllowed && before.outcome === null && ((after.outcome === 'blocked' || after.outcome === 'failed') && after.gate === 'none'
    || (after.outcome === null && after.gate === 'human_approval_required'));
  if (!(after.outcome === before.outcome && after.gate === gateTo) && !runnerTerminal) e.push('run_outcome_or_gate_unexpected');
  return e;
}

// 窓の検証。expect: { runs:{ [taskId]: allow（approvalId を含む） }, ownerLock:{ [taskId]: 'same'|{ mode:'created', ownerId }|'removed' }, permitsConsumed:[permitId],
//   approvalsConsumed:[{ id, sha256 }], outputsWritten:[{ path, sha256 }], worktreesAdded:[taskId] }
//   宣言されていない追加・削除・変更（runs 配下の未知 file・一時 file・link を含む）はすべて違反。
function verifyAuditTransition(before, after, expect) {
  var v = [];
  if (!before || !before.ok || !after || !after.ok) return { ok: false, violations: ['snapshot_unavailable'] };
  var x = _isObj(expect) ? expect : {};
  var B = before.entries, A = after.entries, handled = {};
  var mark = function (k) { handled[k] = true; };
  Object.keys(A).forEach(function (k) {
    if (A[k].type === 'link' || A[k].type === 'other') v.push('link_or_special:' + k);
    if (/(^|\/)(write\.lock|\.create\.lock)$/.test(k) || /\.tmp-/.test(k)) v.push('transient_present:' + k);
  });
  // runs
  Object.keys(_isObj(x.runs) ? x.runs : {}).forEach(function (taskId) {
    var k = 'runs/' + taskId + '/run.json';
    mark(k);
    if (!B[k] || !A[k]) { v.push('run_file_missing:' + taskId); return; }
    validateRunTransition(B[k].json, A[k].json, x.runs[taskId]).forEach(function (m) { v.push(m + ':' + taskId); });
  });
  Object.keys(_isObj(x.ownerLock) ? x.ownerLock : {}).forEach(function (taskId) {
    var k = 'runs/' + taskId + '/owner.lock', m = x.ownerLock[taskId];
    mark(k);
    // created は { mode:'created', ownerId }：存在だけでなく内容（kind・taskId・ownerId）を検証する
    if (_isObj(m) && m.mode === 'created') {
      var j = A[k] && A[k].json;
      if (!(!B[k] && A[k] && A[k].type === 'file' && _isObj(j) && j.kind === 'owner' && j.taskId === taskId && j.ownerId === m.ownerId)) v.push('owner_lock_not_created_by_owner:' + taskId);
      return;
    }
    if (m === 'created') { v.push('owner_lock_expectation_invalid:' + taskId); return; }
    if (m === 'removed' && !(B[k] && !A[k])) v.push('owner_lock_not_removed:' + taskId);
    if (m === 'same' && !(B[k] && A[k] && B[k].sha256 === A[k].sha256)) v.push('owner_lock_changed:' + taskId);
  });
  (Array.isArray(x.permitsConsumed) ? x.permitsConsumed : []).forEach(function (id) {
    var u = 'permits/' + id + '.json', c = 'permits/' + id + '.consumed.json';
    mark(u); mark(c);
    if (!(B[u] && !A[u] && !B[c] && A[c] && A[c].sha256 === B[u].sha256)) v.push('permit_not_consumed_as_expected:' + id);
  });
  // テスト実行承認は窓の途中で Human が発行し、同じ窓で消費される（発行済み → 消費、または 窓内で発行 → 消費 のどちらか）
  //   各要素は { id, sha256 }：消費後の file 内容が、Orchestrator が検証して消費した承認記録の内容（file SHA-256）と一致すること
  (Array.isArray(x.approvalsConsumed) ? x.approvalsConsumed : []).forEach(function (ac) {
    var id = _isObj(ac) ? ac.id : null, sha = _isObj(ac) ? ac.sha256 : null;
    var u = 'approvals/' + id + '.json', c = 'approvals/' + id + '.consumed.json';
    mark(u); mark(c);
    if (!B.approvals && A.approvals && A.approvals.type === 'dir') mark('approvals');
    var preIssued = B[u] && !A[u] && !B[c] && A[c] && A[c].sha256 === B[u].sha256;
    var inWindow = !B[u] && !B[c] && !A[u] && A[c] && A[c].type === 'file';
    if (!(preIssued || inWindow) || typeof sha !== 'string' || !A[c] || A[c].sha256 !== sha) v.push('approval_not_consumed_as_expected:' + id);
  });
  // stage 出力（再開用）：宣言した path に、宣言した内容（file SHA-256）で新規作成されたものだけ
  (Array.isArray(x.outputsWritten) ? x.outputsWritten : []).forEach(function (ow) {
    var k = _isObj(ow) ? ow.path : null;
    if (typeof k !== 'string' || !/^runs\/[^\/]+\/outputs\/[a-z]+\.json$/.test(k)) { v.push('output_expectation_invalid'); return; }
    mark(k);
    var dir = k.replace(/\/[^\/]+$/, '');
    if (!B[dir] && A[dir] && A[dir].type === 'dir') mark(dir);
    if (!(!B[k] && A[k] && A[k].type === 'file' && A[k].sha256 === ow.sha256)) v.push('output_not_written_as_expected:' + k);
  });
  (Array.isArray(x.worktreesAdded) ? x.worktreesAdded : []).forEach(function (taskId) {
    var k = 'wt/' + taskId;
    mark(k);
    if (!(!B[k] && A[k] && A[k].type === 'dir')) v.push('worktree_not_added:' + taskId);
  });
  // 宣言外の差分
  Object.keys(B).concat(Object.keys(A)).forEach(function (k) {
    if (handled[k]) return;
    handled[k] = true;
    if (!B[k]) v.push('unexpected_added:' + k);
    else if (!A[k]) v.push('unexpected_removed:' + k);
    else if (B[k].type !== A[k].type || B[k].sha256 !== A[k].sha256) v.push('unexpected_changed:' + k);
  });
  return { ok: v.length === 0, violations: v.slice(0, 50) };
}

module.exports = {
  snapshotAudit: snapshotAudit,
  validateRunTransition: validateRunTransition,
  verifyAuditTransition: verifyAuditTransition,
};
