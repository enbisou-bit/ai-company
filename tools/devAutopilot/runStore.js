'use strict';
// tools/devAutopilot/runStore.js
// Development Autopilot V1 — Step 2: State Machine（純関数）＋ runStore（repo 外 local runtime への run.json 保存）
//
//   正本: stage / gate / outcome（derived status は保存せず、そこから導出する）
//     stage  : null | researching | designing | implementing | testing | reviewing
//     gate   : none | human_approval_required | awaiting_commit_approval
//     outcome: null | failed | blocked | completed
//   ★ State 関数は純関数（入力を変更しない・fs / network / env / 時刻に依存しない。now は注入）。
//   ★ 失敗は例外ではなく { ok:false, error } で返す（fail-closed）。
//   ★ runStore は任意 path を書ける汎用 writer ではない: runtimeRoot + taskId からのみ run directory を決める。
//     runtimeRoot は repo の外でなければならない（Windows / 大文字小文字を考慮）。
//   ★ secret（apiKey / token / secret / password / authorization / cookie / env 等）を含む run は保存しない。
//   ★ Git / worktree の操作はしない（resume 判定は入力された実測 snapshot と run.json の比較だけ）。

var fs = require('fs');
var path = require('path');

// schema v2（Stage 4C / S1）：isolation・invocations[] を追加し、明示 allowlist で検証する。
//   v1 の記録は変更・削除・自動移行しない。v1 は read-only 参照（inspectRunRecord / readRun）だけで、状態遷移・保存・再開は v2 のみ。
var SCHEMA_VERSION = 2;
var SCHEMA_VERSION_V1 = 1;
var STAGES = Object.freeze(['researching', 'designing', 'implementing', 'testing', 'reviewing']);
var GATES = Object.freeze(['none', 'human_approval_required', 'awaiting_commit_approval']);
var OUTCOMES = Object.freeze([null, 'failed', 'blocked', 'completed']);
var DERIVED = Object.freeze(['queued', 'running', 'interrupted', 'awaiting_human', 'failed', 'blocked', 'completed', 'invalid']);
var WORKTREE_STAGES = Object.freeze(['implementing', 'testing', 'reviewing']);   // 隔離 worktree は Implement から存在する
var TASK_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;
var ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
var HEAD_RE = /^[0-9a-f]{40}$/;
var DEFAULT_STALE_MS = 10 * 60 * 1000;
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
var SHA256_RE = /^[0-9a-f]{64}$/;                                   // 照合用 hash は 64 桁全体を保持する（表示だけ短縮）
var CODE_RE = /^[A-Za-z0-9_:.\/,@+=-]{1,200}$/;                    // 理由コード（固定分類・worktree 相対 path）
var CLI_VERSION_RE = /^\d{1,3}\.\d{1,3}\.\d{1,4} \(Claude Code\)$/;
var CHILD_VAR_NAME_RE = /^[A-Z][A-Z0-9_]{0,63}$/;                   // 子プロセスへ渡す変数の「名前」だけ（値は保存しない）
var MODEL_ID_RE = /^claude-[a-z0-9.-]{3,60}$/;
// Claude を呼ぶ stage（runStore の stage 名）→ sessionIds の key。testing は Claude を呼ばない
var SESSION_KEY_BY_STAGE = Object.freeze({ researching: 'research', designing: 'design', implementing: 'implement', reviewing: 'review' });
var COST_BASIS = 'cli_reported_estimate_not_billing';               // CLI の推定値。請求額・月額利用枠の消費量ではない

function _clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }
function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _str(v) { return typeof v === 'string' && v.trim().length > 0; }
function _err(code, extra) { return Object.assign({ ok: false, error: code }, extra || {}); }
function _isIso(v) { return typeof v === 'string' && ISO_RE.test(v) && !isNaN(Date.parse(v)); }

// ── secret 検出（key 名ベース＋明白な値パターン）──────────────
var SECRET_KEY_EXACT = ['apikey', 'token', 'secret', 'password', 'passwd', 'authorization', 'cookie', 'cookies', 'env',
  'environment', 'envvars', 'privatekey', 'credential', 'credentials', 'clientsecret'];
var SECRET_KEY_SUFFIX = ['apikey', 'token', 'secret', 'password', 'passwd', 'cookie', 'privatekey', 'credential', 'credentials'];
var SECRET_VALUE_RE = /(\bsk-(ant-)?[A-Za-z0-9_-]{16,}|\bBearer\s+[A-Za-z0-9._-]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY-----|\bgh[pousr]_[A-Za-z0-9]{20,})/;
function findSecrets(obj, p) {
  var found = [];
  var base = p || '';
  if (Array.isArray(obj)) {
    obj.forEach(function (v, i) { found = found.concat(findSecrets(v, base + '[' + i + ']')); });
  } else if (_isObj(obj)) {
    Object.keys(obj).forEach(function (k) {
      var nk = k.toLowerCase().replace(/[_\-\s]/g, '');
      var here = base ? base + '.' + k : k;
      if (nk !== 'sessionids' && (SECRET_KEY_EXACT.indexOf(nk) !== -1 || SECRET_KEY_SUFFIX.some(function (s) { return nk.length > s.length && nk.slice(-s.length) === s; }))) {
        found.push(here);
      }
      found = found.concat(findSecrets(obj[k], here));
    });
  } else if (typeof obj === 'string' && SECRET_VALUE_RE.test(obj)) {
    found.push(base || '(value)');
  }
  return found;
}

// ── schema ─────────────────────────────────────────────
function createInitialRun(input) {
  var i = _isObj(input) ? input : {};
  var t = _isObj(i.task) ? i.task : {};
  var b = _isObj(i.budget) ? i.budget : {};
  var run = {
    schemaVersion: SCHEMA_VERSION,
    taskId: i.taskId,
    task: {
      title: t.title,
      goal: t.goal,
      allowedPaths: Array.isArray(t.allowedPaths) ? t.allowedPaths.slice() : t.allowedPaths,
      forbiddenPaths: Array.isArray(t.forbiddenPaths) ? t.forbiddenPaths.slice() : [],
    },
    mainRepoPath: i.mainRepoPath,
    baseHead: i.baseHead,
    branch: i.branch,
    worktreePath: i.worktreePath,
    stage: null,
    gate: 'none',
    gateReason: null,
    outcome: null,
    completedStages: [],
    stageHistory: [],
    sessionIds: { research: null, design: null, implement: null, review: null },
    lock: null,
    startedAt: i.now,
    updatedAt: i.now,
    budget: { capUsd: b.capUsd, spentUsd: 0, invocations: 0, maxInvocations: b.maxInvocations, costUnknown: false },
    mainStatusHashAtStart: i.mainStatusHashAtStart,
    protectedMd5AtStart: _isObj(i.protectedMd5AtStart) ? _clone(i.protectedMd5AtStart) : i.protectedMd5AtStart,
    filesChanged: [],
    diffSummary: null,
    testResults: [],
    skippedTests: [],
    riskFindings: [],
    blockedReason: null,
    failureReason: null,
    finalGitStatus: null,
    finalStatus: null,
    // S1 ではデータ形だけ。research 前の worktree 作成（S5）への切替はしない
    isolation: { state: 'absent', worktreeHead: null, verifiedAt: null },
    invocations: [],
  };
  var v = validateRunState(run);
  return v.ok ? { ok: true, run: run } : _err('invalid_initial_run', { errors: v.errors });
}

// v1 / v2 共通の検証（v1 時点の条件をそのまま維持する）
function _validateCommon(run, e) {
  if (typeof run.taskId !== 'string' || !TASK_ID_RE.test(run.taskId)) e.push('task_id');
  var t = run.task;
  if (!_isObj(t) || !_str(t.title) || !_str(t.goal) || !Array.isArray(t.allowedPaths) || t.allowedPaths.length === 0
      || !t.allowedPaths.every(_str) || !Array.isArray(t.forbiddenPaths) || !t.forbiddenPaths.every(_str)) e.push('task');
  if (!_str(run.mainRepoPath) || !path.isAbsolute(run.mainRepoPath)) e.push('main_repo_path');
  if (typeof run.baseHead !== 'string' || !HEAD_RE.test(run.baseHead)) e.push('base_head');
  if (!_str(run.branch) || !/^dev\/[A-Za-z0-9_-]+$/.test(run.branch)) e.push('branch');
  if (!_str(run.worktreePath) || !path.isAbsolute(run.worktreePath)) e.push('worktree_path');
  if (run.stage !== null && STAGES.indexOf(run.stage) === -1) e.push('stage_enum');
  if (GATES.indexOf(run.gate) === -1) e.push('gate_enum');
  if (OUTCOMES.indexOf(run.outcome) === -1) e.push('outcome_enum');
  if (run.gateReason !== null && typeof run.gateReason !== 'string') e.push('gate_reason');
  if (!Array.isArray(run.completedStages) || !run.completedStages.every(function (s, idx) { return s === STAGES[idx]; })) e.push('completed_stages_order');
  if (!Array.isArray(run.stageHistory)) e.push('stage_history');
  var sid = run.sessionIds;
  if (!_isObj(sid) || ['research', 'design', 'implement', 'review'].some(function (k) { return sid[k] !== null && !_str(sid[k]); })
      || Object.keys(sid).some(function (k) { return ['research', 'design', 'implement', 'review'].indexOf(k) === -1; })) e.push('session_ids');
  if (run.lock !== null && !(_isObj(run.lock) && Number.isInteger(run.lock.pid) && run.lock.pid > 0 && _isIso(run.lock.startedAt) && _isIso(run.lock.heartbeatAt))) e.push('lock');
  if (!_isIso(run.startedAt) || !_isIso(run.updatedAt)) e.push('timestamps');
  var bd = run.budget;
  if (!_isObj(bd) || !(typeof bd.capUsd === 'number' && bd.capUsd > 0) || !(typeof bd.spentUsd === 'number' && bd.spentUsd >= 0)
      || !(Number.isInteger(bd.invocations) && bd.invocations >= 0) || !(Number.isInteger(bd.maxInvocations) && bd.maxInvocations > 0)
      || typeof bd.costUnknown !== 'boolean') e.push('budget');
  if (!_str(run.mainStatusHashAtStart)) e.push('main_status_hash');
  if (!_isObj(run.protectedMd5AtStart) || Object.keys(run.protectedMd5AtStart).length === 0) e.push('protected_md5');
  ['filesChanged', 'testResults', 'skippedTests', 'riskFindings'].forEach(function (k) { if (!Array.isArray(run[k])) e.push(k); });

  // 状態の組み合わせ整合（曖昧な状態を正本として受け入れない）
  var idx = run.stage === null ? -1 : STAGES.indexOf(run.stage);
  var cs = Array.isArray(run.completedStages) ? run.completedStages.length : -1;
  if (run.outcome !== null && run.gate !== 'none') e.push('outcome_with_gate');
  if (run.stage === null && run.gate !== 'none') e.push('gate_without_stage');
  if (run.gate === 'awaiting_commit_approval') {
    if (run.stage !== 'reviewing' || cs !== STAGES.length) e.push('commit_gate_before_review_complete');
  } else if (run.outcome === 'completed') {
    if (cs !== STAGES.length) e.push('completed_without_all_stages');
  } else if (run.outcome !== null && run.stage === 'reviewing' && cs === STAGES.length) {
    // review 完了後（commit 承認待ち）に却下・block された終了状態は整合
  } else if (idx !== -1 && cs !== idx) {
    e.push('completed_stages_mismatch');
  } else if (idx === -1 && cs !== 0) {
    e.push('completed_stages_without_stage');
  }
  if ((run.gate === 'human_approval_required' || run.gate === 'awaiting_commit_approval') && !_str(run.gateReason)) e.push('gate_reason_missing');
  if (run.outcome === 'blocked' && !_str(run.blockedReason)) e.push('blocked_reason_missing');
  if (run.outcome === 'failed' && !_str(run.failureReason)) e.push('failure_reason_missing');
  return e;
}

// v1 記録の read-only 検証（実行可否の判定には使わない）
function validateRunStateV1(run) {
  if (!_isObj(run)) return { ok: false, errors: ['run_not_object'] };
  var e = [];
  if (run.schemaVersion !== SCHEMA_VERSION_V1) e.push('schema_version');
  _validateCommon(run, e);
  var secrets = findSecrets(run);
  if (secrets.length) e.push('secret_detected:' + secrets.join(','));
  return { ok: e.length === 0, errors: e };
}

// v2（実行可能な記録）の検証：共通条件 ＋ top-level key allowlist ＋ isolation / invocations の型・enum・整合
function validateRunState(run) {
  if (!_isObj(run)) return { ok: false, errors: ['run_not_object'] };
  var e = [];
  if (run.schemaVersion !== SCHEMA_VERSION) e.push('schema_version');
  _validateCommon(run, e);
  _validateV2(run, e);
  var secrets = findSecrets(run);
  if (secrets.length) e.push('secret_detected:' + secrets.join(','));
  return { ok: e.length === 0, errors: e };
}

// ── v2 allowlist ───────────────────────────────────────
var RUN_KEYS_V2 = Object.freeze(['schemaVersion', 'taskId', 'task', 'mainRepoPath', 'baseHead', 'branch', 'worktreePath', 'stage', 'gate', 'gateReason',
  'outcome', 'completedStages', 'stageHistory', 'sessionIds', 'lock', 'startedAt', 'updatedAt', 'budget', 'mainStatusHashAtStart', 'protectedMd5AtStart',
  'filesChanged', 'diffSummary', 'testResults', 'skippedTests', 'riskFindings', 'blockedReason', 'failureReason', 'finalGitStatus', 'finalStatus',
  'isolation', 'invocations']);
var BUDGET_KEYS = ['capUsd', 'spentUsd', 'invocations', 'maxInvocations', 'costUnknown'];
var ISOLATION_KEYS = ['state', 'worktreeHead', 'verifiedAt'];
var INVOCATION_KEYS = ['invocationId', 'stage', 'sessionId', 'state', 'reservedAt', 'completedAt', 'launch', 'result'];
var INVOCATION_STATES = ['started', 'finished', 'unconfirmed'];
var LAUNCH_KEYS = ['exeSha256', 'cliVersion', 'argvSha256', 'promptSha256', 'settingsSha256', 'childVarNames', 'timeoutMs', 'maxBuffer'];
var RESULT_INPUT_KEYS = ['process', 'cost', 'envelope', 'schema', 'session', 'diff', 'safety', 'transcript', 'classification', 'structuredOutputSha256'];
var RESULT_KEYS = RESULT_INPUT_KEYS.concat(['disposition', 'dispositionReason']);
var PROCESS_KEYS = ['exitCode', 'signal', 'timedOut', 'bufferExceeded', 'errorClass', 'wallMs', 'stdoutBytes', 'stderrBytes', 'termination'];
var SIGNALS = [null, 'SIGKILL', 'SIGTERM', 'SIGINT'];
var ERROR_CLASSES = [null, 'ETIMEDOUT', 'ENOENT', 'EACCES', 'EPERM', 'ENOBUFS', 'spawn_error', 'other'];
var TERMINATIONS_CONFIRMED = ['exit_event_observed', 'not_started'];
var TERMINATIONS_UNCONFIRMED = ['exit_event_missing', 'descendants_unknown', 'probe_only'];
var COST_KEYS = ['basis', 'state', 'cliReportedUsd'];
var ENVELOPE_KEYS = ['parse', 'isError', 'subtype', 'apiErrorStatus', 'numTurns', 'permissionDenials', 'modelIds', 'unlistedModelCount'];
var ENVELOPE_PARSE = ['ok', 'invalid', 'absent'];
var SUBTYPES = [null, 'success', 'error_max_turns', 'error_during_execution', 'error_max_budget_usd', 'error_max_structured_output_retries', 'other'];
var API_STATUS_STATES = ['absent', 'null', 'number', 'invalid_number', 'wrong_type', 'not_applicable'];
var SCHEMA_RESULT_KEYS = ['ok', 'errorCodes', 'structuredSource'];
var STRUCTURED_SOURCES = [null, 'structured_output', 'result_json'];
var SESSION_RESULTS = ['match', 'mismatch', 'missing', 'invalid', 'unverified_no_envelope'];
var DIFF_KEYS = ['result', 'reasonCodes', 'changedCount'];
var DIFF_RESULTS = ['ok', 'blocked', 'human_approval_required', 'unavailable'];
var SAFETY_KEYS = ['result', 'reasonCodes'];
var SAFETY_RESULTS = ['ok', 'violated', 'unverified'];
var TRANSCRIPT_KEYS = ['verdict', 'toolCounts', 'unparseable', 'outside', 'missingResults', 'errorResults'];
var TRANSCRIPT_VERDICTS = ['ok', 'unverified_record_unparseable', 'unverified_unknown_tool', 'unverified_tool_error', 'unverified_expected_calls_missing',
  'outside_reference_observed', 'not_analyzed'];
var TOOL_COUNT_KEYS = ['Read', 'Glob', 'Grep', 'StructuredOutput', 'other'];   // 未知の tool 名は保存せず 'other' に数える
var CLASSIFICATION_KEYS = ['outcome', 'reasonCodes'];
var CLASSIFICATION_OUTCOMES = ['ok', 'failed', 'blocked', 'human_approval_required'];
var DISPOSITIONS = ['none', 'fail', 'block', 'human_gate'];
var MAX_CODES = 50;

function _has(o, k) { return Object.prototype.hasOwnProperty.call(o, k); }
function _exactKeys(o, keys) { return _isObj(o) && Object.keys(o).length === keys.length && keys.every(function (k) { return _has(o, k); }); }
function _int0(v) { return Number.isInteger(v) && v >= 0; }
function _intOrNull(v) { return v === null || Number.isInteger(v); }
function _in(list, v) { return list.indexOf(v) !== -1; }
function _codes(v) { return Array.isArray(v) && v.length <= MAX_CODES && v.every(function (s) { return typeof s === 'string' && CODE_RE.test(s); }); }
function _sha(v) { return typeof v === 'string' && SHA256_RE.test(v); }

function _launchErrors(l, p) {
  if (!_exactKeys(l, LAUNCH_KEYS)) return [p + 'keys'];
  var e = [];
  ['exeSha256', 'argvSha256', 'promptSha256', 'settingsSha256'].forEach(function (k) { if (!_sha(l[k])) e.push(p + k); });
  if (typeof l.cliVersion !== 'string' || !CLI_VERSION_RE.test(l.cliVersion)) e.push(p + 'cliVersion');
  if (!Array.isArray(l.childVarNames) || l.childVarNames.length === 0 || l.childVarNames.length > 32
    || !l.childVarNames.every(function (n) { return typeof n === 'string' && CHILD_VAR_NAME_RE.test(n); })) e.push(p + 'childVarNames');
  if (!(Number.isInteger(l.timeoutMs) && l.timeoutMs > 0)) e.push(p + 'timeoutMs');
  if (!(Number.isInteger(l.maxBuffer) && l.maxBuffer > 0)) e.push(p + 'maxBuffer');
  return e;
}

// completeInvocation の入力（disposition を除く観測値）の検証
function _resultInputErrors(r, p) {
  if (!_exactKeys(r, RESULT_INPUT_KEYS)) return [p + 'keys'];
  var e = [];
  var pr = r.process;
  if (!_exactKeys(pr, PROCESS_KEYS)) e.push(p + 'process.keys');
  else {
    if (!_intOrNull(pr.exitCode)) e.push(p + 'process.exitCode');
    if (!_in(SIGNALS, pr.signal)) e.push(p + 'process.signal');
    if (typeof pr.timedOut !== 'boolean' || typeof pr.bufferExceeded !== 'boolean') e.push(p + 'process.flags');
    if (!_in(ERROR_CLASSES, pr.errorClass)) e.push(p + 'process.errorClass');
    if (!_int0(pr.wallMs) || !_int0(pr.stdoutBytes) || !_int0(pr.stderrBytes)) e.push(p + 'process.numbers');
    if (!_in(TERMINATIONS_CONFIRMED.concat(TERMINATIONS_UNCONFIRMED), pr.termination)) e.push(p + 'process.termination');
  }
  var c = r.cost;
  if (!_exactKeys(c, COST_KEYS) || c.basis !== COST_BASIS || !_in(['known', 'unknown'], c.state)
    || (c.state === 'known' && !(typeof c.cliReportedUsd === 'number' && isFinite(c.cliReportedUsd) && c.cliReportedUsd >= 0))
    || (c.state === 'unknown' && c.cliReportedUsd !== null)) e.push(p + 'cost');       // 費用不明を 0 とみなさない
  var en = r.envelope;
  if (!_exactKeys(en, ENVELOPE_KEYS)) e.push(p + 'envelope.keys');
  else {
    if (!_in(ENVELOPE_PARSE, en.parse)) e.push(p + 'envelope.parse');
    if (!(en.isError === null || typeof en.isError === 'boolean')) e.push(p + 'envelope.isError');
    if (!_in(SUBTYPES, en.subtype)) e.push(p + 'envelope.subtype');
    var a = en.apiErrorStatus;
    if (!_exactKeys(a, ['state', 'value']) || !_in(API_STATUS_STATES, a.state)
      || (a.state === 'number' ? !(Number.isInteger(a.value) && a.value >= 100 && a.value <= 599) : a.value !== null)) e.push(p + 'envelope.apiErrorStatus');
    if (!(en.numTurns === null || _int0(en.numTurns)) || !(en.permissionDenials === null || _int0(en.permissionDenials))) e.push(p + 'envelope.numbers');
    if (!Array.isArray(en.modelIds) || en.modelIds.length > 10 || !en.modelIds.every(function (m) { return typeof m === 'string' && MODEL_ID_RE.test(m); })) e.push(p + 'envelope.modelIds');
    if (!_int0(en.unlistedModelCount)) e.push(p + 'envelope.unlistedModelCount');
    if (en.parse !== 'ok' && (en.isError !== null || en.subtype !== null)) e.push(p + 'envelope.parse_inconsistent');
  }
  var s = r.schema;
  if (!_exactKeys(s, SCHEMA_RESULT_KEYS) || typeof s.ok !== 'boolean' || !_codes(s.errorCodes) || !_in(STRUCTURED_SOURCES, s.structuredSource)
    || (s.ok && s.errorCodes.length > 0)) e.push(p + 'schema');
  if (!_in(SESSION_RESULTS, r.session)) e.push(p + 'session');
  var d = r.diff;
  if (!_exactKeys(d, DIFF_KEYS) || !_in(DIFF_RESULTS, d.result) || !_codes(d.reasonCodes) || !_int0(d.changedCount)) e.push(p + 'diff');
  var sf = r.safety;
  if (!_exactKeys(sf, SAFETY_KEYS) || !_in(SAFETY_RESULTS, sf.result) || !_codes(sf.reasonCodes) || (sf.result !== 'ok' && sf.reasonCodes.length === 0)) e.push(p + 'safety');
  var t = r.transcript;
  if (!_exactKeys(t, TRANSCRIPT_KEYS) || !_in(TRANSCRIPT_VERDICTS, t.verdict) || !_exactKeys(t.toolCounts, TOOL_COUNT_KEYS)
    || !TOOL_COUNT_KEYS.every(function (k) { return _int0(t.toolCounts[k]); })
    || !_int0(t.unparseable) || !_int0(t.outside) || !_int0(t.missingResults) || !_int0(t.errorResults)) e.push(p + 'transcript');
  var cl = r.classification;
  if (!_exactKeys(cl, CLASSIFICATION_KEYS) || !_in(CLASSIFICATION_OUTCOMES, cl.outcome) || !_codes(cl.reasonCodes)) e.push(p + 'classification');
  if (!(r.structuredOutputSha256 === null || _sha(r.structuredOutputSha256))) e.push(p + 'structuredOutputSha256');
  return e;
}

function _invocationErrors(inv, i) {
  var p = 'invocations[' + i + '].';
  if (!_exactKeys(inv, INVOCATION_KEYS)) return [p + 'keys'];
  var e = [];
  if (typeof inv.invocationId !== 'string' || !UUID_RE.test(inv.invocationId)) e.push(p + 'invocationId');
  if (!_has(SESSION_KEY_BY_STAGE, inv.stage)) e.push(p + 'stage');
  if (typeof inv.sessionId !== 'string' || !UUID_RE.test(inv.sessionId)) e.push(p + 'sessionId');
  if (!_in(INVOCATION_STATES, inv.state)) e.push(p + 'state');
  if (!_isIso(inv.reservedAt)) e.push(p + 'reservedAt');
  e = e.concat(_launchErrors(inv.launch, p + 'launch.'));
  if (inv.state === 'started') {
    if (inv.completedAt !== null || inv.result !== null) e.push(p + 'started_with_result');
  } else if (_in(INVOCATION_STATES, inv.state)) {
    if (!_isIso(inv.completedAt) || (_isIso(inv.reservedAt) && Date.parse(inv.completedAt) < Date.parse(inv.reservedAt))) e.push(p + 'completedAt');
    var r = inv.result;
    if (!_exactKeys(r, RESULT_KEYS)) e.push(p + 'result.keys');
    else {
      var input = {}; RESULT_INPUT_KEYS.forEach(function (k) { input[k] = r[k]; });
      e = e.concat(_resultInputErrors(input, p + 'result.'));
      if (!_in(DISPOSITIONS, r.disposition)) e.push(p + 'result.disposition');
      if (r.disposition === 'none' ? r.dispositionReason !== null : !(typeof r.dispositionReason === 'string' && CODE_RE.test(r.dispositionReason))) e.push(p + 'result.dispositionReason');
      var term = _isObj(r.process) ? r.process.termination : null;
      if (inv.state === 'finished' && !_in(TERMINATIONS_CONFIRMED, term)) e.push(p + 'finished_without_confirmed_termination');
      if (inv.state === 'unconfirmed' && (!_in(TERMINATIONS_UNCONFIRMED, term) || r.disposition !== 'block')) e.push(p + 'unconfirmed_must_block');
    }
  }
  return e;
}

function _validateV2(run, e) {
  var unknown = Object.keys(run).filter(function (k) { return RUN_KEYS_V2.indexOf(k) === -1; });
  if (unknown.length) e.push('unknown_keys:' + unknown.join(','));
  var missing = RUN_KEYS_V2.filter(function (k) { return !_has(run, k); });
  if (missing.length) e.push('missing_keys:' + missing.join(','));
  if (!_exactKeys(run.budget, BUDGET_KEYS)) e.push('budget_keys');
  var iso = run.isolation;
  if (!_exactKeys(iso, ISOLATION_KEYS)) e.push('isolation');
  else if (iso.state === 'absent') { if (iso.worktreeHead !== null || iso.verifiedAt !== null) e.push('isolation'); }
  else if (iso.state === 'verified') { if (typeof iso.worktreeHead !== 'string' || !HEAD_RE.test(iso.worktreeHead) || !_isIso(iso.verifiedAt)) e.push('isolation'); }
  else e.push('isolation');
  var sid = run.sessionIds;
  if (_isObj(sid) && Object.keys(sid).some(function (k) { return sid[k] !== null && !(typeof sid[k] === 'string' && UUID_RE.test(sid[k])); })) e.push('session_id_format');
  if (!Array.isArray(run.invocations)) { e.push('invocations'); return; }
  var ids = {}, sessions = {}, started = 0, known = 0, unknownCost = false, stageIdx = run.stage === null ? -1 : STAGES.indexOf(run.stage);
  run.invocations.forEach(function (inv, i) {
    var ie = _invocationErrors(inv, i);
    e.push.apply(e, ie);
    if (ie.length) return;
    if (ids[inv.invocationId]) e.push('duplicate_invocation_id'); ids[inv.invocationId] = true;
    if (sessions[inv.sessionId]) e.push('duplicate_session_id'); sessions[inv.sessionId] = true;
    if (inv.state === 'started') started++;
    if (STAGES.indexOf(inv.stage) > stageIdx) e.push('invocation_stage_ahead_of_run');
    var key = SESSION_KEY_BY_STAGE[inv.stage];
    if (!_isObj(sid) || sid[key] !== inv.sessionId) e.push('session_ids_mismatch:' + key);
    if (inv.result && inv.result.cost.state === 'known') known += inv.result.cost.cliReportedUsd;
    if (inv.result && inv.result.cost.state === 'unknown') unknownCost = true;
  });
  if (started > 1) e.push('multiple_started_invocations');
  // sessionIds は invocation と 1 対 1（V1：stage ごとに 1 回）
  if (_isObj(sid)) Object.keys(SESSION_KEY_BY_STAGE).forEach(function (st) {
    var key = SESSION_KEY_BY_STAGE[st];
    var n = run.invocations.filter(function (inv) { return _isObj(inv) && inv.stage === st; }).length;
    if (n > 1) e.push('multiple_invocations_for_stage:' + st);
    if (sid[key] !== null && n === 0) e.push('session_without_invocation:' + key);
  });
  var bd = run.budget;
  if (_isObj(bd)) {
    if (bd.invocations !== run.invocations.length) e.push('invocation_count_mismatch');
    if (typeof bd.spentUsd === 'number' && Math.abs(bd.spentUsd - known) > 1e-9) e.push('spent_usd_mismatch');
    if (bd.costUnknown !== unknownCost) e.push('cost_unknown_mismatch');
  }
}

// ── lock ───────────────────────────────────────────────
function lockStatus(lock, opts) {
  var o = _isObj(opts) ? opts : {};
  if (lock === null || lock === undefined) return 'none';
  if (!_isObj(lock) || !Number.isInteger(lock.pid) || lock.pid <= 0 || !_isIso(lock.startedAt) || !_isIso(lock.heartbeatAt)) return 'invalid';
  if (!_isIso(o.now)) return 'invalid';
  var staleMs = (typeof o.staleMs === 'number' && o.staleMs > 0) ? o.staleMs : DEFAULT_STALE_MS;
  var age = Date.parse(o.now) - Date.parse(lock.heartbeatAt);
  if (age < 0) return 'invalid';                              // 未来の heartbeat は曖昧
  return age <= staleMs ? 'active' : 'stale';
}

// ── derived status（保存しない）────────────────────────
function deriveRunStatus(run, opts) {
  if (!validateRunState(run).ok) return 'invalid';
  if (run.outcome === 'completed') return 'completed';
  if (run.outcome === 'blocked') return 'blocked';
  if (run.outcome === 'failed') return 'failed';
  if (run.gate !== 'none') return 'awaiting_human';
  var ls = lockStatus(run.lock, opts);
  if (ls === 'invalid') return 'invalid';
  if (run.stage === null) return ls === 'active' ? 'invalid' : 'queued';
  return ls === 'active' ? 'running' : 'interrupted';
}

// ── transitions（純関数）──────────────────────────────
function _next(run, now, mutate) {
  if (!_isIso(now)) return _err('invalid_now');
  var v = validateRunState(run);
  if (!v.ok) return _err('invalid_run', { errors: v.errors });
  var r = _clone(run);
  var res = mutate(r);
  if (res && res.ok === false) return res;
  r.updatedAt = now;
  var v2 = validateRunState(r);
  if (!v2.ok) return _err('invalid_result', { errors: v2.errors });
  return { ok: true, run: r };
}
function _requireActive(r) {
  if (r.outcome !== null) return _err('terminal_outcome:' + r.outcome);
  return null;
}
// 未確定（started / unconfirmed）の invocation が残っている間は、stage を進めない・commit 承認待ちへ進めない
function _unfinalized(r) {
  return r.invocations.some(function (inv) { return inv.state === 'started' || inv.state === 'unconfirmed'; }) ? _err('invocation_unfinalized') : null;
}

function transitionStage(run, nextStage, opts) {
  var now = _isObj(opts) ? opts.now : undefined;
  return _next(run, now, function (r) {
    var t = _requireActive(r); if (t) return t;
    if (r.gate !== 'none') return _err('gate_pending:' + r.gate);
    var u = _unfinalized(r); if (u) return u;
    if (STAGES.indexOf(nextStage) === -1) return _err('unknown_stage');
    var expected = r.stage === null ? STAGES[0] : STAGES[STAGES.indexOf(r.stage) + 1];
    if (nextStage !== expected) return _err('invalid_transition:' + String(r.stage) + '->' + nextStage);
    if (r.stage !== null) {
      r.completedStages.push(r.stage);
      var last = r.stageHistory[r.stageHistory.length - 1];
      if (last && last.stage === r.stage && last.endedAt === null) { last.endedAt = now; last.result = 'completed'; }
    }
    r.stage = nextStage;
    r.stageHistory.push({ stage: nextStage, startedAt: now, endedAt: null, invocations: 0, costUsd: 0, result: null });
  });
}

function requireHumanApproval(run, reason, opts) {
  var now = _isObj(opts) ? opts.now : undefined;
  return _next(run, now, function (r) {
    var t = _requireActive(r); if (t) return t;
    if (r.stage === null) return _err('no_stage');
    if (r.gate !== 'none') return _err('gate_pending:' + r.gate);
    if (!_str(reason)) return _err('reason_required');
    r.gate = 'human_approval_required';
    r.gateReason = reason;
  });
}

// 人の明示承認: 止まった stage から再開（stage は変えない）
function approveHumanGate(run, opts) {
  var o = _isObj(opts) ? opts : {};
  return _next(run, o.now, function (r) {
    var t = _requireActive(r); if (t) return t;
    if (r.gate !== 'human_approval_required') return _err('no_human_gate');
    if (o.actor !== 'human') return _err('human_actor_required');
    r.stageHistory.push({ stage: r.stage, startedAt: o.now, endedAt: o.now, invocations: 0, costUsd: 0, result: 'human_approved' });
    r.gate = 'none';
    r.gateReason = null;
  });
}

function rejectHumanGate(run, opts) {
  var o = _isObj(opts) ? opts : {};
  return _next(run, o.now, function (r) {
    var t = _requireActive(r); if (t) return t;
    if (r.gate !== 'human_approval_required' && r.gate !== 'awaiting_commit_approval') return _err('no_human_gate');
    if (o.actor !== 'human') return _err('human_actor_required');
    r.gate = 'none';
    r.gateReason = null;
    r.outcome = 'failed';
    r.failureReason = 'human_rejected' + (_str(o.detail) ? ':' + o.detail : '');
  });
}

function blockRun(run, reason, opts) {
  var now = _isObj(opts) ? opts.now : undefined;
  return _next(run, now, function (r) {
    var t = _requireActive(r); if (t) return t;
    if (!_str(reason)) return _err('reason_required');
    r.gate = 'none';
    r.gateReason = null;
    r.outcome = 'blocked';
    r.blockedReason = reason;
  });
}

function failRun(run, reason, opts) {
  var now = _isObj(opts) ? opts.now : undefined;
  return _next(run, now, function (r) {
    var t = _requireActive(r); if (t) return t;
    if (!_str(reason)) return _err('reason_required');
    r.gate = 'none';
    r.gateReason = null;
    r.outcome = 'failed';
    r.failureReason = reason;
  });
}

function markAwaitingCommitApproval(run, opts) {
  var now = _isObj(opts) ? opts.now : undefined;
  return _next(run, now, function (r) {
    var t = _requireActive(r); if (t) return t;
    if (r.gate !== 'none') return _err('gate_pending:' + r.gate);
    var u = _unfinalized(r); if (u) return u;
    if (r.stage !== 'reviewing') return _err('review_not_reached');
    r.completedStages.push('reviewing');
    var last = r.stageHistory[r.stageHistory.length - 1];
    if (last && last.stage === 'reviewing' && last.endedAt === null) { last.endedAt = now; last.result = 'completed'; }
    r.gate = 'awaiting_commit_approval';
    r.gateReason = 'commit_requires_human';
  });
}

// V1: completed は人が commit を確認した後だけ。Autopilot 自身は呼ばない。
function markCompletedByHuman(run, opts) {
  var o = _isObj(opts) ? opts : {};
  return _next(run, o.now, function (r) {
    var t = _requireActive(r); if (t) return t;
    if (r.gate !== 'awaiting_commit_approval') return _err('not_awaiting_commit_approval');
    if (o.actor !== 'human') return _err('human_actor_required');
    if (typeof o.commitHash !== 'string' || !/^[0-9a-f]{7,40}$/.test(o.commitHash)) return _err('commit_hash_required');
    r.stageHistory.push({ stage: r.stage, startedAt: o.now, endedAt: o.now, invocations: 0, costUsd: 0, result: 'human_commit_confirmed:' + o.commitHash });
    r.gate = 'none';
    r.gateReason = null;
    r.outcome = 'completed';
    r.finalStatus = 'completed';
  });
}

// ── invocation 記録（純関数・S1）─────────────────────────
//   ★ 返すのは「新しい状態」だけ。ディスクへの atomic 保存・所有者 lock・heartbeat は S2 以降（この関数は保存しない）。
//   ★ 不正入力では部分更新しない（_next が clone 上で mutate し、検証に通った場合だけ返す。入力の run は変更しない）。
//
// beginInvocation：予約・回数加算・session 割当・stageHistory 更新を 1 つの新しい状態として返す（この状態の保存に成功した場合だけ起動してよい）
//   input: { now, invocationId, sessionId, stage, launch:{ exeSha256, cliVersion, argvSha256, promptSha256, settingsSha256, childVarNames[], timeoutMs, maxBuffer } }
function beginInvocation(run, input) {
  var i = _isObj(input) ? input : {};
  if (!_exactKeys(i, ['now', 'invocationId', 'sessionId', 'stage', 'launch'])) return _err('input_keys_invalid');
  if (typeof i.invocationId !== 'string' || !UUID_RE.test(i.invocationId)) return _err('invocation_id_invalid');
  if (typeof i.sessionId !== 'string' || !UUID_RE.test(i.sessionId)) return _err('session_id_invalid');
  var le = _launchErrors(i.launch, 'launch.');
  if (le.length) return _err('launch_invalid', { errors: le });
  return _next(run, i.now, function (r) {
    var t = _requireActive(r); if (t) return t;
    if (r.gate !== 'none') return _err('gate_pending:' + r.gate);
    if (r.stage === null || !_has(SESSION_KEY_BY_STAGE, r.stage)) return _err('stage_not_invocable');
    if (i.stage !== r.stage) return _err('stage_mismatch');
    var u = _unfinalized(r); if (u) return u;
    var key = SESSION_KEY_BY_STAGE[r.stage];
    if (r.sessionIds[key] !== null) return _err('stage_already_invoked:' + key);            // 同一 stage の再起動は禁止（V1・retry 0）
    if (r.invocations.some(function (inv) { return inv.invocationId === i.invocationId; })) return _err('duplicate_invocation_id');
    if (r.invocations.some(function (inv) { return inv.sessionId === i.sessionId; })
      || Object.keys(r.sessionIds).some(function (k) { return r.sessionIds[k] === i.sessionId; })) return _err('duplicate_session_id');
    if (r.budget.invocations >= r.budget.maxInvocations) return _err('invocation_limit_reached');
    if (r.budget.costUnknown) return _err('cost_unknown_requires_human');                    // 費用不明のまま次を起動しない
    if (r.budget.spentUsd >= r.budget.capUsd) return _err('budget_cap_reached');
    var last = r.stageHistory[r.stageHistory.length - 1];
    if (!last || last.stage !== r.stage || last.endedAt !== null) return _err('stage_history_inconsistent');
    r.invocations.push({ invocationId: i.invocationId, stage: r.stage, sessionId: i.sessionId, state: 'started', reservedAt: i.now, completedAt: null,
      launch: _clone(i.launch), result: null });
    r.budget.invocations += 1;
    r.sessionIds[key] = i.sessionId;
    last.invocations += 1;
  });
}

// 観測値 → run の処理区分（Safety 最優先。未検証は成功扱いにしない）
function _deriveDisposition(state, res, budgetAfter) {
  if (state === 'unconfirmed') return { d: 'block', why: 'termination_unconfirmed' };
  if (res.safety.result !== 'ok') return { d: 'block', why: 'safety:' + res.safety.result };
  if (res.diff.result === 'blocked' || res.diff.result === 'unavailable') return { d: 'block', why: 'diff:' + res.diff.result };
  if (res.transcript.verdict === 'outside_reference_observed') return { d: 'block', why: 'transcript:outside_reference_observed' };
  if (res.classification.outcome === 'blocked') return { d: 'block', why: 'classification:blocked' };
  // 未検証（transcript が ok 以外）は失敗より優先して block（終了状態）。失敗の詳細は result.classification に保持される
  if (res.transcript.verdict !== 'ok') return { d: 'block', why: 'unverified:' + res.transcript.verdict };
  if (res.classification.outcome === 'failed') return { d: 'fail', why: 'classification:failed' };
  if (res.classification.outcome === 'human_approval_required') return { d: 'human_gate', why: 'classification:human_approval_required' };
  if (res.diff.result === 'human_approval_required') return { d: 'human_gate', why: 'diff:human_approval_required' };
  if (res.cost.state === 'unknown') return { d: 'human_gate', why: 'cost_unknown' };
  if (budgetAfter.spentUsd >= budgetAfter.capUsd) return { d: 'human_gate', why: 'budget_cap_reached' };
  return { d: 'none', why: null };
}
// classification が ok なのに観測値が矛盾する入力は受け付けない（fail-closed）
function _okConsistencyErrors(state, res) {
  var e = [];
  if (res.classification.outcome !== 'ok') return e;
  if (state !== 'finished') e.push('ok_but_not_finished');
  if (res.process.exitCode !== 0 || res.process.timedOut || res.process.bufferExceeded || res.process.termination !== 'exit_event_observed') e.push('ok_but_process_failed');
  if (res.envelope.parse !== 'ok' || res.envelope.isError !== false) e.push('ok_but_envelope_error');
  if (res.envelope.permissionDenials !== 0) e.push('ok_but_permission_denials');
  if (!res.schema.ok) e.push('ok_but_schema_invalid');
  if (res.session !== 'match') e.push('ok_but_session_not_matched');
  if (res.diff.result === 'blocked' || res.diff.result === 'unavailable') e.push('ok_but_diff_blocked');
  return e;
}

// completeInvocation：観測値・費用・invocation 状態・run の outcome / gate を 1 つの新しい状態として返す
//   input: { now, invocationId, state:'finished'|'unconfirmed', result:{ process, cost, envelope, schema, session, diff, safety, transcript, classification, structuredOutputSha256 } }
//   ★ 二重完了（state が started でない）は拒否する → 費用の二重計上も起きない。
//   ★ 費用不明は 0 とみなさず costUnknown を立て、Human 判断（human_gate）を要求する。費用は CLI 推定値であり請求額・月額利用枠ではない。
function completeInvocation(run, input) {
  var i = _isObj(input) ? input : {};
  if (!_exactKeys(i, ['now', 'invocationId', 'state', 'result'])) return _err('input_keys_invalid');
  if (i.state !== 'finished' && i.state !== 'unconfirmed') return _err('state_invalid');
  var re = _resultInputErrors(i.result, 'result.');
  if (re.length) return _err('result_invalid', { errors: re });
  if (i.state === 'finished' && !_in(TERMINATIONS_CONFIRMED, i.result.process.termination)) return _err('finished_requires_confirmed_termination');
  if (i.state === 'unconfirmed' && !_in(TERMINATIONS_UNCONFIRMED, i.result.process.termination)) return _err('unconfirmed_requires_unconfirmed_termination');
  var ce = _okConsistencyErrors(i.state, i.result);
  if (ce.length) return _err('result_inconsistent', { errors: ce });
  return _next(run, i.now, function (r) {
    var idx = -1;
    r.invocations.forEach(function (inv, k) { if (inv.invocationId === i.invocationId) idx = k; });
    if (idx === -1) return _err('invocation_not_found');
    var inv = r.invocations[idx];
    if (inv.state !== 'started') return _err('invocation_already_finalized');
    if (r.outcome !== null) return _err('terminal_outcome:' + r.outcome);
    if (r.gate !== 'none') return _err('gate_pending:' + r.gate);
    if (Date.parse(i.now) < Date.parse(inv.reservedAt)) return _err('clock_regression');
    var res = _clone(i.result);
    if (res.cost.state === 'known') {
      r.budget.spentUsd += res.cost.cliReportedUsd;
      var h = r.stageHistory.filter(function (x) { return x.stage === inv.stage; }).pop();
      if (h) h.costUsd += res.cost.cliReportedUsd;
    } else {
      r.budget.costUnknown = true;
    }
    var dsp = _deriveDisposition(i.state, res, r.budget);
    res.disposition = dsp.d;
    res.dispositionReason = dsp.why;
    inv.state = i.state;
    inv.completedAt = i.now;
    inv.result = res;
    if (dsp.d === 'block') { r.outcome = 'blocked'; r.blockedReason = 'invocation:' + dsp.why; }
    else if (dsp.d === 'fail') { r.outcome = 'failed'; r.failureReason = 'invocation:' + dsp.why; }
    else if (dsp.d === 'human_gate') { r.gate = 'human_approval_required'; r.gateReason = 'invocation:' + dsp.why; }
  });
}

// ── 記録の参照可否（v1 read-only / v2 実行可能）──────────────
function inspectRunRecord(run) {
  if (!_isObj(run)) return { schemaVersion: null, readable: false, executable: false, errors: ['run_not_object'] };
  if (run.schemaVersion === SCHEMA_VERSION_V1) { var v1 = validateRunStateV1(run); return { schemaVersion: 1, readable: v1.ok, executable: false, errors: v1.errors }; }
  if (run.schemaVersion === SCHEMA_VERSION) { var v2 = validateRunState(run); return { schemaVersion: 2, readable: v2.ok, executable: v2.ok, errors: v2.errors }; }
  return { schemaVersion: null, readable: false, executable: false, errors: ['schema_version'] };
}

function acquireLock(run, opts) {
  var o = _isObj(opts) ? opts : {};
  return _next(run, o.now, function (r) {
    var t = _requireActive(r); if (t) return t;
    if (!Number.isInteger(o.pid) || o.pid <= 0) return _err('invalid_pid');
    var ls = lockStatus(r.lock, { now: o.now, staleMs: o.staleMs });
    if (ls === 'active' || ls === 'invalid') return _err('lock_' + ls);
    if (ls === 'stale') return _err('lock_stale_requires_human');   // stale の自動奪取はしない
    r.lock = { pid: o.pid, startedAt: o.now, heartbeatAt: o.now };
  });
}

function heartbeatLock(run, opts) {
  var o = _isObj(opts) ? opts : {};
  return _next(run, o.now, function (r) {
    if (!r.lock || r.lock.pid !== o.pid) return _err('lock_not_owned');
    if (Date.parse(o.now) < Date.parse(r.lock.heartbeatAt)) return _err('clock_regression');
    r.lock.heartbeatAt = o.now;
  });
}

function releaseLock(run, opts) {
  var o = _isObj(opts) ? opts : {};
  return _next(run, o.now, function (r) {
    if (!r.lock || r.lock.pid !== o.pid) return _err('lock_not_owned');
    r.lock = null;
  });
}

// ── resume validation（Git / worktree は操作しない。入力 snapshot との比較のみ）─────
//   snapshot: { baseHeadExists, currentHead, currentOriginMain, worktreeExists, branchExists,
//               worktreeStatus: 'clean'|'dirty'|'absent', diffAllowed, protectedMd5Matches }
//   戻り値: { result: 'resumable' | 'human_approval_required' | 'blocked', reasons[] }
function validateResume(run, snapshot, opts) {
  var blocked = [], human = [];
  if (_isObj(run) && run.schemaVersion === SCHEMA_VERSION_V1) return { result: 'blocked', reasons: ['schema_v1_read_only'] };   // v1 は参照のみ・再開しない
  var v = validateRunState(run);
  if (!v.ok) return { result: 'blocked', reasons: ['run_invalid'].concat(v.errors) };
  if (run.outcome !== null) return { result: 'blocked', reasons: ['terminal_outcome:' + run.outcome] };   // 未検証 block を含む（自動で新 run も作らない）
  // 起動したか・終了したかが確定しない invocation は自動再開しない（保存失敗・クラッシュ・終了未確認を含む）
  run.invocations.forEach(function (inv) {
    if (inv.state === 'started') blocked.push('invocation_started_unfinalized');
    if (inv.state === 'unconfirmed') blocked.push('invocation_termination_unconfirmed');
  });
  // 現 stage の invocation が finished として保存済み（区分 none、または human_gate を人が承認済み）で次 stage への遷移前の場合は、
  //   再開して「次 stage へ進む」ことは妨げない。同じ stage の再起動は beginInvocation が stage_already_invoked で拒否する（人の承認でも解除されない）。
  //   完了記録の欠落（session だけあって invocation が無い）は validateRunState の整合違反として上で blocked になる。
  var s = snapshot;
  var shapeOk = _isObj(s) && typeof s.baseHeadExists === 'boolean' && typeof s.worktreeExists === 'boolean'
    && typeof s.branchExists === 'boolean' && typeof s.diffAllowed === 'boolean' && typeof s.protectedMd5Matches === 'boolean'
    && typeof s.currentHead === 'string' && HEAD_RE.test(s.currentHead)
    && typeof s.currentOriginMain === 'string' && HEAD_RE.test(s.currentOriginMain)
    && (s.worktreeStatus === 'clean' || s.worktreeStatus === 'dirty' || s.worktreeStatus === 'absent');
  if (!shapeOk) return { result: 'blocked', reasons: ['snapshot_invalid'] };

  if (!s.baseHeadExists) blocked.push('base_head_missing');
  if (!s.protectedMd5Matches) blocked.push('protected_mismatch');
  if (!s.diffAllowed) blocked.push('diff_outside_scope');

  var needsWorktree = run.stage !== null && WORKTREE_STAGES.indexOf(run.stage) !== -1;
  if (needsWorktree) {
    if (!s.worktreeExists || !s.branchExists || s.worktreeStatus === 'absent') blocked.push('worktree_or_branch_missing');
  } else if (s.worktreeExists || s.branchExists || s.worktreeStatus !== 'absent') {
    blocked.push('unexpected_worktree_before_implementation');   // 曖昧 → blocked
  }

  var ls = lockStatus(run.lock, opts);
  if (ls === 'invalid') blocked.push('lock_invalid');
  else if (ls === 'active') blocked.push('lock_active');           // 別 process が実行中の可能性
  else if (ls === 'stale') human.push('stale_lock');

  if (s.currentOriginMain !== run.baseHead) human.push('origin_advanced');
  if (s.currentHead !== run.baseHead) human.push('main_head_moved');
  if (run.gate === 'human_approval_required') human.push('awaiting_human_approval');
  if (run.gate === 'awaiting_commit_approval') human.push('awaiting_commit_approval');
  if (run.gate === 'none' && run.stage === 'implementing') human.push('interrupted_implementation');   // 実装途中の停止は人が確認

  if (blocked.length) return { result: 'blocked', reasons: blocked.concat(human) };
  if (human.length) return { result: 'human_approval_required', reasons: human };
  return { result: 'resumable', reasons: [] };
}

// ── runStore（file I/O）────────────────────────────────
function _normAbs(p) { return path.resolve(p).replace(/[\\\/]+$/, '').toLowerCase(); }
function _isInside(child, parent) {
  var rel = path.relative(_normAbs(parent), _normAbs(child));
  return rel === '' || (!!rel && rel.split(/[\\\/]/)[0] !== '..' && !path.isAbsolute(rel));
}

// runtimeRoot + taskId → run directory（repo の外であること・path traversal 拒否）
function resolveRunPaths(store, taskId) {
  if (!_isObj(store)) return _err('store_invalid');
  var root = store.runtimeRoot, repo = store.repoPath;
  if (typeof root !== 'string' || !root || /[\u0000-\u001f]/.test(root) || !path.isAbsolute(root)) return _err('runtime_root_invalid');
  if (root.split(/[\\\/]/).some(function (seg) { return seg === '..' || seg === '.'; })) return _err('runtime_root_traversal');
  if (typeof repo !== 'string' || !repo || !path.isAbsolute(repo)) return _err('repo_path_required');
  if (typeof taskId !== 'string' || !TASK_ID_RE.test(taskId)) return _err('task_id_invalid');
  var runDir = path.join(path.resolve(root), 'runs', taskId);
  if (_isInside(root, repo) || _isInside(runDir, repo)) return _err('runtime_root_inside_repo');
  if (_isInside(repo, runDir)) return _err('repo_inside_run_dir');
  if (!_isInside(runDir, root)) return _err('run_dir_escape');
  return { ok: true, runDir: runDir, runFile: path.join(runDir, 'run.json') };
}

var _tmpSeq = 0;
function _atomicWriteJson(fsx, file, obj) {
  var data = JSON.stringify(obj, null, 2) + '\n';
  var tmp = file + '.tmp-' + process.pid + '-' + (++_tmpSeq);
  var fd = null;
  try {
    fd = fsx.openSync(tmp, 'wx');
    fsx.writeSync(fd, data);
    fsx.fsyncSync(fd);
    fsx.closeSync(fd); fd = null;
    fsx.renameSync(tmp, file);
    return { ok: true };
  } catch (e) {
    if (fd !== null) { try { fsx.closeSync(fd); } catch (x) { /* ignore */ } }
    try { fsx.unlinkSync(tmp); } catch (x) { /* 自分が作った tmp だけを消す。失敗しても既存 run.json は無傷 */ }
    return _err('atomic_write_failed');
  }
}

function _readRaw(fsx, file) {
  var raw;
  try { raw = fsx.readFileSync(file, 'utf8'); } catch (e) { return e && e.code === 'ENOENT' ? _err('run_not_found') : _err('run_read_failed'); }
  try { return { ok: true, run: JSON.parse(raw) }; } catch (e) { return _err('run_json_invalid'); }
}

function createRun(store, run) {
  var fsx = (store && store.fs) || fs;
  var v = validateRunState(run);
  if (!v.ok) return _err('run_invalid', { errors: v.errors });
  var p = resolveRunPaths(store, run.taskId);
  if (!p.ok) return p;
  try { fsx.mkdirSync(p.runDir, { recursive: true }); } catch (e) { return _err('run_dir_create_failed'); }
  var exists = false;
  try { fsx.statSync(p.runFile); exists = true; } catch (e) { exists = false; }
  if (exists) return _err('run_exists');
  var w = _atomicWriteJson(fsx, p.runFile, run);
  return w.ok ? { ok: true, runFile: p.runFile } : w;
}

// v2 は { ok, run, schemaVersion:2, executable:true }、v1 は { ok, run, schemaVersion:1, executable:false }（read-only 参照）を返す。
//   既存呼び出しが使う ok / run / error / errors の意味は変えない（schemaVersion / executable は追加項目）。
function readRun(store, taskId) {
  var fsx = (store && store.fs) || fs;
  var p = resolveRunPaths(store, taskId);
  if (!p.ok) return p;
  var r = _readRaw(fsx, p.runFile);
  if (!r.ok) return r;
  var info = inspectRunRecord(r.run);
  if (!info.readable) return _err('run_invalid', { errors: info.errors });
  if (r.run.taskId !== taskId) return _err('task_id_mismatch');
  return { ok: true, run: r.run, schemaVersion: info.schemaVersion, executable: info.executable };
}

// 楽観的排他: 既存 run.json の updatedAt が expectedUpdatedAt と一致する場合だけ上書き
function saveRun(store, nextRun, opts) {
  var fsx = (store && store.fs) || fs;
  var o = _isObj(opts) ? opts : {};
  var v = validateRunState(nextRun);
  if (!v.ok) return _err('run_invalid', { errors: v.errors });
  var cur = readRun(store, nextRun.taskId);
  if (!cur.ok) return cur;
  if (!cur.executable) return _err('run_read_only_v1');   // v1 記録は上書きしない（自動移行しない）
  if (typeof o.expectedUpdatedAt !== 'string' || cur.run.updatedAt !== o.expectedUpdatedAt) return _err('stale_write');
  var p = resolveRunPaths(store, nextRun.taskId);
  var w = _atomicWriteJson(fsx, p.runFile, nextRun);
  return w.ok ? { ok: true, runFile: p.runFile } : w;
}

module.exports = {
  SCHEMA_VERSION: SCHEMA_VERSION,
  SCHEMA_VERSION_V1: SCHEMA_VERSION_V1,
  COST_BASIS: COST_BASIS,
  SESSION_KEY_BY_STAGE: SESSION_KEY_BY_STAGE,
  validateRunStateV1: validateRunStateV1,
  inspectRunRecord: inspectRunRecord,
  beginInvocation: beginInvocation,
  completeInvocation: completeInvocation,
  STAGES: STAGES,
  GATES: GATES,
  OUTCOMES: OUTCOMES,
  DERIVED: DERIVED,
  DEFAULT_STALE_MS: DEFAULT_STALE_MS,
  findSecrets: findSecrets,
  createInitialRun: createInitialRun,
  validateRunState: validateRunState,
  deriveRunStatus: deriveRunStatus,
  lockStatus: lockStatus,
  transitionStage: transitionStage,
  requireHumanApproval: requireHumanApproval,
  approveHumanGate: approveHumanGate,
  rejectHumanGate: rejectHumanGate,
  blockRun: blockRun,
  failRun: failRun,
  markAwaitingCommitApproval: markAwaitingCommitApproval,
  markCompletedByHuman: markCompletedByHuman,
  acquireLock: acquireLock,
  heartbeatLock: heartbeatLock,
  releaseLock: releaseLock,
  validateResume: validateResume,
  resolveRunPaths: resolveRunPaths,
  createRun: createRun,
  readRun: readRun,
  saveRun: saveRun,
};
