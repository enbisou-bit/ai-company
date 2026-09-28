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

var SCHEMA_VERSION = 1;
var STAGES = Object.freeze(['researching', 'designing', 'implementing', 'testing', 'reviewing']);
var GATES = Object.freeze(['none', 'human_approval_required', 'awaiting_commit_approval']);
var OUTCOMES = Object.freeze([null, 'failed', 'blocked', 'completed']);
var DERIVED = Object.freeze(['queued', 'running', 'interrupted', 'awaiting_human', 'failed', 'blocked', 'completed', 'invalid']);
var WORKTREE_STAGES = Object.freeze(['implementing', 'testing', 'reviewing']);   // 隔離 worktree は Implement から存在する
var TASK_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{2,63}$/;
var ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
var HEAD_RE = /^[0-9a-f]{40}$/;
var DEFAULT_STALE_MS = 10 * 60 * 1000;

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
  };
  var v = validateRunState(run);
  return v.ok ? { ok: true, run: run } : _err('invalid_initial_run', { errors: v.errors });
}

function validateRunState(run) {
  var e = [];
  if (!_isObj(run)) return { ok: false, errors: ['run_not_object'] };
  if (run.schemaVersion !== SCHEMA_VERSION) e.push('schema_version');
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
  var secrets = findSecrets(run);
  if (secrets.length) e.push('secret_detected:' + secrets.join(','));
  return { ok: e.length === 0, errors: e };
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

function transitionStage(run, nextStage, opts) {
  var now = _isObj(opts) ? opts.now : undefined;
  return _next(run, now, function (r) {
    var t = _requireActive(r); if (t) return t;
    if (r.gate !== 'none') return _err('gate_pending:' + r.gate);
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
  var v = validateRunState(run);
  if (!v.ok) return { result: 'blocked', reasons: ['run_invalid'].concat(v.errors) };
  if (run.outcome !== null) return { result: 'blocked', reasons: ['terminal_outcome:' + run.outcome] };
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

function readRun(store, taskId) {
  var fsx = (store && store.fs) || fs;
  var p = resolveRunPaths(store, taskId);
  if (!p.ok) return p;
  var r = _readRaw(fsx, p.runFile);
  if (!r.ok) return r;
  var v = validateRunState(r.run);
  if (!v.ok) return _err('run_invalid', { errors: v.errors });
  if (r.run.taskId !== taskId) return _err('task_id_mismatch');
  return { ok: true, run: r.run };
}

// 楽観的排他: 既存 run.json の updatedAt が expectedUpdatedAt と一致する場合だけ上書き
function saveRun(store, nextRun, opts) {
  var fsx = (store && store.fs) || fs;
  var o = _isObj(opts) ? opts : {};
  var v = validateRunState(nextRun);
  if (!v.ok) return _err('run_invalid', { errors: v.errors });
  var cur = readRun(store, nextRun.taskId);
  if (!cur.ok) return cur;
  if (typeof o.expectedUpdatedAt !== 'string' || cur.run.updatedAt !== o.expectedUpdatedAt) return _err('stale_write');
  var p = resolveRunPaths(store, nextRun.taskId);
  var w = _atomicWriteJson(fsx, p.runFile, nextRun);
  return w.ok ? { ok: true, runFile: p.runFile } : w;
}

module.exports = {
  SCHEMA_VERSION: SCHEMA_VERSION,
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
