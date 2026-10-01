'use strict';
// tools/devAutopilot/humanApproval.js
// Development Autopilot V1 — Stage 4D：実行承認・テスト実行承認の記録（作成・保存・読込・検証・消費）
//
//   ★ 承認記録は approveCli（Human が端末で実行し、確認コードを入力する操作）だけが作る想定。
//     ただしこれは「操作確認」であり、人間であることの証明ではない。同じ OS ユーザーの権限で動く process は
//     この file を直接作れるため、偽造を防げない（V1 の既知の限界）。Runner の子 process（Bash なし）による audit 配下への
//     書込みは auditGuard の窓検査で検出する。「子 process から発行できない」とは保証しない。
//   ★ run の実行承認（複数 stage・回数上限つき）は single-use ではない。消費は run 記録の予約済み invocation から計上し
//     （claudeExecutor.approvalUseCount）、最初の stage で承認全体を消費済みにしない。承認 file は変更・rename しない。
//   ★ テスト実行承認は single-use。差分 hash・test file 一覧・run に束縛し、使用前に原子的 rename（*.consumed.json）で消費する。
//   ★ Permit（worktree add の single-use 許可）は realRepoPermit が扱う（ここでは扱わない）。
//   ★ 本文（prompt・出力・env 値）を含めない。

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var ex = require('./claudeExecutor');
var tc = require('./transcriptCheck');

var RECORD_VERSION = 1;
var CONFIRMATION = Object.freeze({ method: 'tty_confirmation_code', meaning: 'operation_confirmation_only_not_proof_of_human_identity' });
var RECORD_KEYS = ['version', 'kind', 'confirmation', 'approval'];
var KIND_RUN = 'run_execution', KIND_TEST = 'test_execution';
var TEST_APPROVAL_KIND = 'enbisou-test-execution-approval';
var TEST_APPROVAL_KEYS = ['kind', 'approvalId', 'approvedBy', 'taskId', 'runStartedAt', 'worktreePath', 'diffSha256', 'testFiles', 'issuedAt', 'expiresAt'];
var MAX_TEST_APPROVAL_MS = 60 * 60 * 1000;
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
var SHA256_RE = /^[0-9a-f]{64}$/;
var TEST_FILE_RE = /^[A-Za-z0-9._-]+\.test\.js$/;
var ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;

function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _err(code, extra) { return Object.assign({ ok: false, error: code }, extra || {}); }
function _exactKeys(o, keys) { return _isObj(o) && Object.keys(o).length === keys.length && keys.every(function (k) { return Object.prototype.hasOwnProperty.call(o, k); }); }
function _iso(v) { return typeof v === 'string' && ISO_RE.test(v) && !isNaN(Date.parse(v)); }

// store: { root（audit root）, fs? }。approvals/<approvalId>.json（未消費）・<approvalId>.consumed.json（消費済み）
function _paths(store, approvalId) {
  if (!_isObj(store) || typeof store.root !== 'string' || !path.isAbsolute(store.root)) return _err('store_invalid');
  if (typeof approvalId !== 'string' || !UUID_RE.test(approvalId)) return _err('approval_id_invalid');
  var dir = path.join(store.root, 'approvals');
  return { ok: true, dir: dir, file: path.join(dir, approvalId + '.json'), consumedFile: path.join(dir, approvalId + '.consumed.json') };
}

// ── 作成（純関数）──────────────────────────────────────
// run の実行承認：run 記録から束縛値を取り、CLI 識別・上限・期間を加える。
//   StructuredOutput（Decision 121）：既定 'block'。structuredOutputPolicy: 'conditional' を明示した場合だけ、承認する CLI の exe SHA・版に束縛した
//   条件付き受け入れ方針を記録する（判定条件は transcriptCheck.evaluateStructuredOutputConditional。副作用がないことの証明ではない）。
//   input: { approvalId, run, stages[], exeSha256, cliVersion, maxInvocations, maxBudgetUsdPerInvocation, issuedAt, expiresAt, structuredOutputPolicy? }
function buildRunApproval(input) {
  var i = _isObj(input) ? input : {};
  var run = i.run;
  if (!_isObj(run)) return _err('run_required');
  var em = ex.expectedMainFromRun(run);
  if (!em) return _err('run_main_record_unusable');
  var sop = i.structuredOutputPolicy === undefined || i.structuredOutputPolicy === 'block' ? 'block'
    : i.structuredOutputPolicy === 'conditional' ? { mode: 'conditional', exeSha256: i.exeSha256, cliVersion: i.cliVersion } : null;
  if (sop === null) return _err('run_approval_invalid', { errors: ['structured_output_policy'] });
  var a = {
    kind: 'enbisou-runner-invocation-approval', approvalId: i.approvalId, approvedBy: 'human', taskId: run.taskId, runStartedAt: run.startedAt,
    mainRepoPath: run.mainRepoPath, baseHead: run.baseHead, branch: run.branch, worktreePath: run.worktreePath,
    stages: Array.isArray(i.stages) ? i.stages.slice() : i.stages, exeSha256: i.exeSha256, cliVersion: i.cliVersion,
    maxInvocations: i.maxInvocations, maxBudgetUsdPerInvocation: i.maxBudgetUsdPerInvocation, billingScope: ex.BILLING_SCOPE,
    mainAutopilotStatusHash: em.autopilotStatusHash, protectedFingerprint: em.protectedFingerprint, issuedAt: i.issuedAt, expiresAt: i.expiresAt,
    structuredOutputPolicy: sop,
  };
  var e = [];
  if (typeof a.approvalId !== 'string' || !UUID_RE.test(a.approvalId)) e.push('approval_id');
  if (!Array.isArray(a.stages) || !a.stages.length || !a.stages.every(function (s) { return Object.prototype.hasOwnProperty.call(ex.RUNNER_STAGE, s); })) e.push('stages');
  if (typeof a.exeSha256 !== 'string' || !SHA256_RE.test(a.exeSha256) || typeof a.cliVersion !== 'string' || !a.cliVersion) e.push('cli');
  if (!Number.isInteger(a.maxInvocations) || a.maxInvocations < 1 || a.maxInvocations > run.budget.maxInvocations) e.push('max_invocations');
  if (typeof a.maxBudgetUsdPerInvocation !== 'number' || !(a.maxBudgetUsdPerInvocation > 0) || a.maxBudgetUsdPerInvocation > run.budget.capUsd) e.push('max_budget');
  if (!_iso(a.issuedAt) || !_iso(a.expiresAt) || Date.parse(a.expiresAt) <= Date.parse(a.issuedAt) || Date.parse(a.expiresAt) - Date.parse(a.issuedAt) > 24 * 3600000) e.push('time');
  return e.length ? _err('run_approval_invalid', { errors: e }) : { ok: true, approval: a };
}

// テスト実行承認（single-use）：run・worktree・差分 hash・test file 一覧に束縛
//   input: { approvalId, run, diffSha256, testFiles[], issuedAt, expiresAt }
function buildTestApproval(input) {
  var i = _isObj(input) ? input : {};
  var run = i.run;
  if (!_isObj(run)) return _err('run_required');
  var files = Array.isArray(i.testFiles) ? i.testFiles.slice().sort() : null;
  var a = { kind: TEST_APPROVAL_KIND, approvalId: i.approvalId, approvedBy: 'human', taskId: run.taskId, runStartedAt: run.startedAt, worktreePath: run.worktreePath,
    diffSha256: i.diffSha256, testFiles: files, issuedAt: i.issuedAt, expiresAt: i.expiresAt };
  var e = _testApprovalShapeErrors(a);
  return e.length ? _err('test_approval_invalid', { errors: e }) : { ok: true, approval: a };
}
function _testApprovalShapeErrors(a) {
  var e = [];
  if (!_exactKeys(a, TEST_APPROVAL_KEYS)) return ['shape'];
  if (a.kind !== TEST_APPROVAL_KIND || a.approvedBy !== 'human') e.push('kind');
  if (typeof a.approvalId !== 'string' || !UUID_RE.test(a.approvalId)) e.push('approval_id');
  if (typeof a.diffSha256 !== 'string' || !SHA256_RE.test(a.diffSha256)) e.push('diff_sha256');
  if (!Array.isArray(a.testFiles) || !a.testFiles.length || a.testFiles.length > 200 || !a.testFiles.every(function (f) { return typeof f === 'string' && TEST_FILE_RE.test(f); })
    || a.testFiles.some(function (f, k) { return k > 0 && a.testFiles[k - 1] >= f; })) e.push('test_files');
  if (!_iso(a.issuedAt) || !_iso(a.expiresAt) || Date.parse(a.expiresAt) <= Date.parse(a.issuedAt) || Date.parse(a.expiresAt) - Date.parse(a.issuedAt) > MAX_TEST_APPROVAL_MS) e.push('time');
  return e;
}
// テスト実行承認の束縛検証。binding: { run, diffSha256, testFiles[], now }
function validateTestApproval(a, binding) {
  var b = _isObj(binding) ? binding : {};
  var e = _testApprovalShapeErrors(a);
  if (e.length) return e;
  var run = b.run;
  if (!_isObj(run) || a.taskId !== run.taskId || a.runStartedAt !== run.startedAt || a.worktreePath !== run.worktreePath) e.push('test_approval_run_mismatch');
  if (a.diffSha256 !== b.diffSha256) e.push('test_approval_diff_mismatch');
  var want = Array.isArray(b.testFiles) ? b.testFiles.slice().sort() : [];
  if (JSON.stringify(want) !== JSON.stringify(a.testFiles)) e.push('test_approval_files_mismatch');
  var now = Date.parse(b.now);
  if (!(now >= Date.parse(a.issuedAt) && now < Date.parse(a.expiresAt))) e.push('test_approval_expired_or_not_yet_valid');
  return e;
}

// ── 保存・読込 ──────────────────────────────────────────
function wrapRecord(kind, approval) { return { version: RECORD_VERSION, kind: kind, confirmation: Object.assign({}, CONFIRMATION), approval: approval }; }
function writeApprovalRecord(store, record) {
  var fsx = (store && store.fs) || fs;
  if (!_exactKeys(record, RECORD_KEYS) || record.version !== RECORD_VERSION || [KIND_RUN, KIND_TEST].indexOf(record.kind) === -1
    || JSON.stringify(record.confirmation) !== JSON.stringify(CONFIRMATION) || !_isObj(record.approval)) return _err('record_invalid');
  var p = _paths(store, record.approval.approvalId);
  if (!p.ok) return p;
  try { fsx.mkdirSync(p.dir, { recursive: true }); } catch (e) { return _err('approvals_dir_failed'); }
  try { fsx.statSync(p.consumedFile); return _err('approval_exists'); } catch (e) { if (!e || e.code !== 'ENOENT') return _err('approval_state_unknown'); }
  var fd = null;
  try { fd = fsx.openSync(p.file, 'wx'); } catch (e) { return _err(e && e.code === 'EEXIST' ? 'approval_exists' : 'approval_write_failed'); }
  try { fsx.writeSync(fd, JSON.stringify(record, null, 2) + '\n'); fsx.fsyncSync(fd); fsx.closeSync(fd); }
  catch (e) { try { fsx.closeSync(fd); } catch (x) { /* ignore */ } return _err('approval_write_failed'); }   // 中途半端な記録は残す（読込時に不正として拒否）
  return { ok: true, file: p.file };
}
function _readRecord(fsx, file, kind) {
  var raw;
  try { raw = fsx.readFileSync(file, 'utf8'); } catch (e) { return _err(e && e.code === 'ENOENT' ? 'approval_not_found' : 'approval_unreadable'); }
  var rec;
  try { rec = JSON.parse(raw); } catch (e) { return _err('approval_unparseable'); }
  if (!_exactKeys(rec, RECORD_KEYS) || rec.version !== RECORD_VERSION || rec.kind !== kind || JSON.stringify(rec.confirmation) !== JSON.stringify(CONFIRMATION)) return _err('approval_record_invalid');
  return { ok: true, record: rec, fileSha256: crypto.createHash('sha256').update(raw).digest('hex') };
}
// run の実行承認の読込（消費しない）。形は claudeExecutor.APPROVAL_KEYS と完全一致であること（束縛の検証は起動ごとに executor が行う）
function loadRunApproval(store, approvalId) {
  var fsx = (store && store.fs) || fs;
  var p = _paths(store, approvalId);
  if (!p.ok) return p;
  var r = _readRecord(fsx, p.file, KIND_RUN);
  if (!r.ok) return r;
  var a = r.record.approval;
  if (!_exactKeys(a, ex.APPROVAL_KEYS) || a.approvalId !== approvalId) return _err('approval_record_invalid');
  return { ok: true, approval: a, fileSha256: r.fileSha256, approvalSha256: tc.canonicalSha256(a) };
}
// run の実行承認の残り回数（予約済み invocation から計上。完了前の記録も数える）
function runApprovalRemaining(run, approval) {
  if (!_isObj(run) || !_isObj(approval) || !Number.isInteger(approval.maxInvocations)) return 0;
  return Math.max(0, approval.maxInvocations - ex.approvalUseCount(run, approval.approvalId));
}
// テスト実行承認の読込と消費（検証 → 原子的 rename → 再読込で内容一致を確認）。消費後は戻さない
function consumeTestApproval(store, approvalId, binding) {
  var fsx = (store && store.fs) || fs;
  var p = _paths(store, approvalId);
  if (!p.ok) return p;
  var r = _readRecord(fsx, p.file, KIND_TEST);
  if (!r.ok) return r;
  var a = r.record.approval;
  if (a.approvalId !== approvalId) return _err('approval_record_invalid');
  var e = validateTestApproval(a, binding);
  if (e.length) return _err('test_approval_rejected', { reasons: e });
  try { fsx.statSync(p.consumedFile); return _err('approval_already_consumed'); } catch (x) { if (!x || x.code !== 'ENOENT') return _err('approval_state_unknown'); }
  try { fsx.renameSync(p.file, p.consumedFile); } catch (x) { return _err('approval_consume_failed'); }
  var again = _readRecord(fsx, p.consumedFile, KIND_TEST);
  if (!again.ok || again.fileSha256 !== r.fileSha256) return _err('approval_changed_during_consume');
  return { ok: true, approval: a, approvalSha256: tc.canonicalSha256(a), fileSha256: r.fileSha256 };
}

module.exports = {
  CONFIRMATION: CONFIRMATION,
  KIND_RUN: KIND_RUN,
  KIND_TEST: KIND_TEST,
  TEST_APPROVAL_KEYS: TEST_APPROVAL_KEYS,
  buildRunApproval: buildRunApproval,
  buildTestApproval: buildTestApproval,
  validateTestApproval: validateTestApproval,
  wrapRecord: wrapRecord,
  writeApprovalRecord: writeApprovalRecord,
  loadRunApproval: loadRunApproval,
  runApprovalRemaining: runApprovalRemaining,
  consumeTestApproval: consumeTestApproval,
};
