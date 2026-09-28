'use strict';
// tools/devAutopilot/worktreeController.js
// Development Autopilot V1 — Step 3A: Pure Git Isolation Contract（純関数のみ）
//
//   ★ このモジュールは Git を実行しない。child_process / fs / network / process.env を一切使わない。
//     Git command は argv 配列を組み立てて返すだけ。実行・実測（realpath / junction / git 出力の取得）は Step 3B executor の責務。
//   ★ 判定はすべて「executor が取得した snapshot」と「run / expected」の比較。不明値・型不一致は blocked（fail-closed）。
//   ★ Windows 前提の path 判定は path.win32 で行い、実行 platform に依存しない deterministic な結果にする。
//   ★ 自動 repair・cleanup 実行・branch 削除・force 系操作は返さない。cleanup は Human が行う plan（表示用）だけ。

var path = require('path');
var win = path.win32;

var BRANCH_PREFIX = 'dev/';
var BRANCH_TASK_ID_RE = /^[a-z0-9][a-z0-9-]{2,40}$/;    // runStore の TASK_ID_RE より厳格（大文字・_・. を禁止）
var HEAD_RE = /^[0-9a-f]{40}$/;
var HASH_RE = /^[0-9a-f]{12,64}$/;
var MAX_WORKTREE_PATH_LENGTH = 150;
var DEFAULT_MAX_TRACKED_PATH_LENGTH = 100;               // 実測の最長 tracked path は 67
var WIN_MAX_PATH = 259;                                  // MAX_PATH 260 − 終端 NUL
var WIN_RESERVED = Object.freeze(['CON', 'PRN', 'AUX', 'NUL',
  'COM1', 'COM2', 'COM3', 'COM4', 'COM5', 'COM6', 'COM7', 'COM8', 'COM9',
  'LPT1', 'LPT2', 'LPT3', 'LPT4', 'LPT5', 'LPT6', 'LPT7', 'LPT8', 'LPT9']);
var PREFLIGHT_RUN_STAGE = 'designing';                   // worktree は designing → implementing の境界でのみ作る（Step 2 WORKTREE_STAGES と整合）

// child process へ渡す env の allowlist（大文字で比較）。実際に必要な最小集合は Step 3B で検証する。
var CHILD_ENV_ALLOWLIST = Object.freeze(['PATH', 'PATHEXT', 'SYSTEMROOT', 'SYSTEMDRIVE', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP']);
// allowlist に入っていても落とす（deny が常に優先）
var SENSITIVE_ENV_PATTERNS = Object.freeze([
  /^(SUPABASE|NEXT_PUBLIC_SUPABASE|OPENAI|ANTHROPIC|CLAUDE|LINE_|WEB_SESSION|CAROUSEL_|RENDER_)/i,
  /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|CREDENTIALS|AUTH|COOKIE|SESSION)$/i,
  /^(AUTHORIZATION|COOKIE)$/i,
]);
var FORBIDDEN_CLEANUP_TOKENS = Object.freeze(['--force', '-f', '-D', '--delete', 'reset', 'clean', 'prune', 'stash', 'push', 'checkout', 'switch']);

function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _str(v) { return typeof v === 'string' && v.length > 0; }
function _bool(v) { return typeof v === 'boolean'; }
function _err(code, extra) { return Object.assign({ ok: false, error: code }, extra || {}); }
function _freezeDeep(o) { Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') _freezeDeep(o[k]); }); return Object.freeze(o); }

// ── Branch Contract ─────────────────────────────────────
function isValidBranchTaskId(taskId) {
  return typeof taskId === 'string' && BRANCH_TASK_ID_RE.test(taskId);
}

function deriveBranchName(taskId) {
  if (!isValidBranchTaskId(taskId)) return _err('task_id_invalid_for_branch');
  var branch = BRANCH_PREFIX + taskId;
  return { ok: true, branch: branch, ref: 'refs/heads/' + branch };
}

// existingRefs: 'refs/heads/x' または 'x' の配列（executor が for-each-ref で取得）。
// case-insensitive（core.ignorecase=true / NTFS の loose ref）で重複と D/F conflict を検出する。
function checkBranchCollision(branch, existingRefs) {
  if (typeof branch !== 'string' || branch.indexOf(BRANCH_PREFIX) !== 0 || !isValidBranchTaskId(branch.slice(BRANCH_PREFIX.length))) {
    return { ok: false, reasons: ['branch_invalid'] };
  }
  if (!Array.isArray(existingRefs) || !existingRefs.every(_str)) return { ok: false, reasons: ['existing_refs_invalid'] };
  var target = branch.toLowerCase(), reasons = [];
  existingRefs.forEach(function (r) {
    var name = r.indexOf('refs/heads/') === 0 ? r.slice('refs/heads/'.length) : r;
    var n = name.toLowerCase();
    if (n === target) reasons.push(name === branch ? 'branch_exists:' + name : 'branch_case_collision:' + name);
    else if (target.indexOf(n + '/') === 0) reasons.push('branch_df_conflict:' + name);      // 例: branch `dev` が存在
    else if (n.indexOf(target + '/') === 0) reasons.push('branch_df_conflict:' + name);      // 例: dev/foo/bar が存在
  });
  return reasons.length ? { ok: false, reasons: reasons } : { ok: true, reasons: [] };
}

// ── Windows Path Contract ───────────────────────────────
// drive 絶対 path（C:\...）のみ許可。UNC / device path（\\?\）/ 相対 / drive 相対（C:foo）は拒否。
function validateWindowsAbsPath(p) {
  var errors = [];
  if (typeof p !== 'string' || !p) return { ok: false, errors: ['path_not_string'] };
  if (/[\u0000-\u001f\u007f]/.test(p)) errors.push('control_char');
  if (!/^[A-Za-z]:[\\\/]/.test(p)) errors.push('not_drive_absolute');
  if (errors.length) return { ok: false, errors: errors };
  var rest = p.slice(3).replace(/[\\\/]$/, '');
  var segs = rest === '' ? [] : rest.split(/[\\\/]/);
  segs.forEach(function (s) {
    if (s === '') errors.push('empty_segment');
    else if (s === '.' || s === '..') errors.push('traversal');
    else {
      if (/[<>:"|?*]/.test(s)) errors.push('forbidden_char:' + s);
      if (/[. ]$/.test(s)) errors.push('trailing_dot_or_space:' + s);
      if (WIN_RESERVED.indexOf(s.split('.')[0].trim().toUpperCase()) !== -1) errors.push('reserved_name:' + s);
      if (/~\d/.test(s)) errors.push('short_name_alias:' + s);     // 8.3 短縮名は別名で repo を指し得る
    }
  });
  if (errors.length) return { ok: false, errors: errors };
  return { ok: true, errors: [], normalized: win.normalize(p).replace(/[\\]+$/, '') || p };
}

function _normWin(p) {
  var n = win.normalize(String(p)).replace(/\//g, '\\');
  if (n.length > 3) n = n.replace(/\\+$/, '');
  return n.toLowerCase();
}
function samePath(a, b) {
  if (!_str(a) || !_str(b)) return false;
  if (!validateWindowsAbsPath(a).ok || !validateWindowsAbsPath(b).ok) return false;
  return _normWin(a) === _normWin(b);
}
function _isInsideWin(child, parent) {
  var rel = win.relative(_normWin(parent), _normWin(child));
  return rel === '' || (!!rel && rel.split('\\')[0] !== '..' && !win.isAbsolute(rel));
}
function _drive(p) { return String(p).slice(0, 2).toLowerCase(); }

function deriveWorktreePath(root, taskId, repoPath, opts) {
  var o = _isObj(opts) ? opts : {};
  var errors = [];
  var vr = validateWindowsAbsPath(root), vp = validateWindowsAbsPath(repoPath);
  if (!vr.ok) errors = errors.concat(vr.errors.map(function (e) { return 'root:' + e; }));
  if (!vp.ok) errors = errors.concat(vp.errors.map(function (e) { return 'repo:' + e; }));
  if (!isValidBranchTaskId(taskId)) errors.push('task_id_invalid_for_branch');
  if (errors.length) return _err('worktree_path_invalid', { errors: errors });
  if (_drive(root) !== _drive(repoPath)) return _err('worktree_path_invalid', { errors: ['different_drive'] });
  var wt = win.join(vr.normalized, taskId);
  if (_isInsideWin(root, repoPath) || _isInsideWin(wt, repoPath)) errors.push('inside_repo');
  if (_isInsideWin(repoPath, root)) errors.push('repo_inside_root');
  if (!_isInsideWin(wt, root) || _normWin(wt) === _normWin(root)) errors.push('escape_root');
  var maxTracked = Number.isInteger(o.maxTrackedPathLength) && o.maxTrackedPathLength > 0 ? o.maxTrackedPathLength : DEFAULT_MAX_TRACKED_PATH_LENGTH;
  if (wt.length > MAX_WORKTREE_PATH_LENGTH) errors.push('worktree_path_too_long');
  if (wt.length + 1 + maxTracked > WIN_MAX_PATH) errors.push('tracked_path_would_exceed_max_path');
  if (errors.length) return _err('worktree_path_invalid', { errors: errors });
  return { ok: true, worktreePath: wt };
}

// ── worktree list --porcelain parser ────────────────────
// 形式: "worktree <path>" で始まる record を空行で区切る。属性は HEAD / branch / detached / bare / locked / prunable。
// 未知属性・重複属性・HEAD 欠落・branch/detached/bare の不整合は malformed（fail-closed）。
function parseWorktreeListPorcelain(text) {
  if (typeof text !== 'string') return _err('porcelain_not_string');
  var lines = text.replace(/\r\n/g, '\n').split('\n');
  var records = [], cur = null;
  function close() { if (cur) { records.push(cur); cur = null; } }
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    if (line === '') { close(); continue; }
    if (/[\u0000-\u001f]/.test(line)) return _err('porcelain_malformed', { line: i + 1, reason: 'control_char' });
    var sp = line.indexOf(' ');
    var key = sp === -1 ? line : line.slice(0, sp);
    var val = sp === -1 ? null : line.slice(sp + 1);
    if (key === 'worktree') {
      if (cur) return _err('porcelain_malformed', { line: i + 1, reason: 'missing_separator' });
      if (!_str(val)) return _err('porcelain_malformed', { line: i + 1, reason: 'worktree_path_missing' });
      cur = { path: val, head: null, branch: null, detached: false, bare: false, locked: false, lockedReason: null, prunable: false, prunableReason: null, _seen: {} };
      continue;
    }
    if (!cur) return _err('porcelain_malformed', { line: i + 1, reason: 'attribute_outside_record' });
    if (cur._seen[key]) return _err('porcelain_malformed', { line: i + 1, reason: 'duplicate_attribute:' + key });
    cur._seen[key] = true;
    if (key === 'HEAD') { if (!HEAD_RE.test(val || '')) return _err('porcelain_malformed', { line: i + 1, reason: 'head_invalid' }); cur.head = val; }
    else if (key === 'branch') { if (!/^refs\/heads\/\S+$/.test(val || '')) return _err('porcelain_malformed', { line: i + 1, reason: 'branch_invalid' }); cur.branch = val; }
    else if (key === 'detached' && val === null) cur.detached = true;
    else if (key === 'bare' && val === null) cur.bare = true;
    else if (key === 'locked') { cur.locked = true; cur.lockedReason = val; }
    else if (key === 'prunable') { cur.prunable = true; cur.prunableReason = val; }
    else return _err('porcelain_malformed', { line: i + 1, reason: 'unknown_attribute:' + key });
  }
  close();
  if (!records.length) return _err('porcelain_malformed', { reason: 'no_worktree' });
  for (var j = 0; j < records.length; j++) {
    var r = records[j];
    delete r._seen;
    var kinds = (r.branch ? 1 : 0) + (r.detached ? 1 : 0) + (r.bare ? 1 : 0);
    if (kinds !== 1) return _err('porcelain_malformed', { record: j, reason: 'branch_detached_bare_inconsistent' });
    if (!r.bare && !r.head) return _err('porcelain_malformed', { record: j, reason: 'head_missing' });
  }
  return { ok: true, worktrees: records };
}

function _findRegistered(worktrees, p) {
  return worktrees.filter(function (w) { return samePath(w.path, p); });
}

// ── run の isolation 項目（Step 2 run.json の shape に対応）──
function _runIsolationErrors(run) {
  var e = [];
  if (!_isObj(run)) return ['run_invalid'];
  var b = deriveBranchName(run.taskId);
  if (!b.ok) e.push('run_task_id_invalid_for_branch');
  else if (run.branch !== b.branch) e.push('run_branch_mismatch');
  if (typeof run.baseHead !== 'string' || !HEAD_RE.test(run.baseHead)) e.push('run_base_head_invalid');
  if (!validateWindowsAbsPath(run.mainRepoPath).ok) e.push('run_main_repo_path_invalid');
  if (!validateWindowsAbsPath(run.worktreePath).ok) e.push('run_worktree_path_invalid');
  if (!e.length && _isInsideWin(run.worktreePath, run.mainRepoPath)) e.push('run_worktree_inside_repo');
  return e;
}

// ── Preflight ───────────────────────────────────────────
// expected: { taskId, repoPath, worktreeRoot, baseHead, protectedFingerprint, mainStatusHash, run }
// snapshot（executor の read-only 実測）:
//   { currentBranch, stagedCount, currentHead, originMain, originIsAncestor, protectedFingerprint, mainStatusHash,
//     existingBranchRefs[], targetBranchExists, targetWorktreeExists, pathCollision, pathHasLinkOrJunction,
//     activeHooks, worktreeListPorcelain, maxTrackedPathLength }
// 戻り値: { result: 'pass' | 'blocked', reasons[], plan? }（pass 時のみ plan に create command を含める）
function validateIsolationPreflight(snapshot, expected) {
  var r = [], s = snapshot, x = expected;
  if (!_isObj(x)) return { result: 'blocked', reasons: ['expected_invalid'] };
  if (!_isObj(s)) return { result: 'blocked', reasons: ['snapshot_invalid'] };

  if (typeof x.baseHead !== 'string' || !HEAD_RE.test(x.baseHead)) r.push('expected_base_head_invalid');
  if (typeof x.protectedFingerprint !== 'string' || !HASH_RE.test(x.protectedFingerprint)) r.push('expected_protected_fingerprint_invalid');
  if (typeof x.mainStatusHash !== 'string' || !HASH_RE.test(x.mainStatusHash)) r.push('expected_main_status_hash_invalid');
  var b = deriveBranchName(x.taskId);
  if (!b.ok) r.push('expected_task_id_invalid');
  var maxTracked = Number.isInteger(s.maxTrackedPathLength) && s.maxTrackedPathLength > 0 ? s.maxTrackedPathLength : null;
  if (maxTracked === null) r.push('snapshot_invalid:maxTrackedPathLength');
  var wp = deriveWorktreePath(x.worktreeRoot, x.taskId, x.repoPath, { maxTrackedPathLength: maxTracked || DEFAULT_MAX_TRACKED_PATH_LENGTH });
  if (!wp.ok) r = r.concat((wp.errors || [wp.error]).map(function (e) { return 'worktree_path:' + e; }));

  // snapshot の型（不明値は blocked）
  var types = {
    currentBranch: _str, stagedCount: function (v) { return Number.isInteger(v) && v >= 0; },
    currentHead: function (v) { return typeof v === 'string' && HEAD_RE.test(v); },
    originMain: function (v) { return typeof v === 'string' && HEAD_RE.test(v); },
    originIsAncestor: _bool, protectedFingerprint: _str, mainStatusHash: _str,
    existingBranchRefs: function (v) { return Array.isArray(v) && v.every(_str); },
    targetBranchExists: _bool, targetWorktreeExists: _bool, pathCollision: _bool, pathHasLinkOrJunction: _bool,
    activeHooks: _bool, worktreeListPorcelain: function (v) { return typeof v === 'string'; },
  };
  var shapeOk = true;
  Object.keys(types).forEach(function (k) { if (!types[k](s[k])) { shapeOk = false; r.push('snapshot_invalid:' + k); } });

  if (shapeOk) {
    if (s.currentBranch !== 'main') r.push('not_on_main');
    if (s.stagedCount !== 0) r.push('staged_not_empty');
    if (s.currentHead !== x.baseHead) r.push('head_mismatch');
    if (s.originIsAncestor !== true) r.push('origin_not_ancestor');   // origin/main ≠ HEAD 自体は許可。ancestor であることが条件
    if (s.protectedFingerprint !== x.protectedFingerprint) r.push('protected_mismatch');
    if (s.mainStatusHash !== x.mainStatusHash) r.push('main_status_hash_mismatch');
    if (s.targetBranchExists !== false) r.push('target_branch_exists');
    if (s.targetWorktreeExists !== false) r.push('target_worktree_exists');
    if (s.pathCollision !== false) r.push('path_collision');
    if (s.pathHasLinkOrJunction !== false) r.push('path_link_or_junction');
    if (s.activeHooks !== false) r.push('active_hooks');
    if (b.ok) { var c = checkBranchCollision(b.branch, s.existingBranchRefs); if (!c.ok) r = r.concat(c.reasons); }
    var wl = parseWorktreeListPorcelain(s.worktreeListPorcelain);
    if (!wl.ok) r.push('worktree_list_malformed');
    else {
      var main = wl.worktrees[0];
      if (!samePath(main.path, x.repoPath) || main.branch !== 'refs/heads/main' || main.head !== s.currentHead) r.push('main_worktree_mismatch');
      if (wp.ok && _findRegistered(wl.worktrees, wp.worktreePath).length) r.push('worktree_already_registered');
      if (b.ok && wl.worktrees.some(function (w) { return w.branch && w.branch.toLowerCase() === b.ref.toLowerCase(); })) r.push('branch_checked_out_elsewhere');
    }
  }

  // run state 整合（Step 2 run.json）
  var run = x.run;
  if (!_isObj(run)) r.push('run_missing');
  else {
    r = r.concat(_runIsolationErrors(run));
    if (run.taskId !== x.taskId) r.push('run_task_id_mismatch');
    if (run.baseHead !== x.baseHead) r.push('run_base_head_mismatch');
    if (wp.ok && !samePath(run.worktreePath, wp.worktreePath)) r.push('run_worktree_path_mismatch');
    if (!samePath(run.mainRepoPath, x.repoPath)) r.push('run_main_repo_path_mismatch');
    if (run.stage !== PREFLIGHT_RUN_STAGE || run.gate !== 'none' || run.outcome !== null) r.push('run_state_not_ready_for_worktree');
  }

  if (r.length) return { result: 'blocked', reasons: r };
  var cmd = buildWorktreeCreateCommand({ repoPath: x.repoPath, worktreeRoot: x.worktreeRoot, taskId: x.taskId, baseHead: x.baseHead, maxTrackedPathLength: maxTracked });
  if (!cmd.ok) return { result: 'blocked', reasons: ['command_build_failed:' + cmd.error] };
  return {
    result: 'pass', reasons: [],
    plan: { branch: b.branch, ref: b.ref, worktreePath: wp.worktreePath, baseHead: x.baseHead, originMainAtStart: s.originMain, command: cmd },
  };
}

// ── Create Command Builder（argv を返すだけ・実行しない）─────
// branch / path は taskId から導出する。任意 flag・任意 branch・任意 path を input から受け付けない。
var CREATE_INPUT_KEYS = Object.freeze(['repoPath', 'worktreeRoot', 'taskId', 'baseHead', 'maxTrackedPathLength']);
function buildWorktreeCreateCommand(input) {
  if (!_isObj(input)) return _err('input_invalid');
  var extra = Object.keys(input).filter(function (k) { return CREATE_INPUT_KEYS.indexOf(k) === -1; });
  if (extra.length) return _err('unexpected_input_keys', { keys: extra });
  if (typeof input.baseHead !== 'string' || !HEAD_RE.test(input.baseHead)) return _err('base_head_invalid');   // 暗黙 HEAD 禁止
  var b = deriveBranchName(input.taskId);
  if (!b.ok) return _err(b.error);
  var wp = deriveWorktreePath(input.worktreeRoot, input.taskId, input.repoPath,
    { maxTrackedPathLength: input.maxTrackedPathLength });
  if (!wp.ok) return _err(wp.error, { errors: wp.errors });
  var repo = validateWindowsAbsPath(input.repoPath).normalized;
  var args = ['-C', repo, 'worktree', 'add', '-b', b.branch, wp.worktreePath, input.baseHead];
  return _freezeDeep({ ok: true, file: 'git', args: args, argv: ['git'].concat(args), shell: false, branch: b.branch, worktreePath: wp.worktreePath, baseHead: input.baseHead });
}

// ── Created Worktree Validation ─────────────────────────
// snapshot: { worktreeHead, worktreeBranchRef, worktreeStatusCount, worktreeGitCommonDir, mainGitCommonDir,
//             worktreeListPorcelain, worktreeEnvFiles[], worktreeProtectedChanged,
//             mainHeadBefore, mainHeadAfter, mainStatusHashBefore, mainStatusHashAfter,
//             mainProtectedFingerprintBefore, mainProtectedFingerprintAfter }
function validateCreatedWorktree(snapshot, run) {
  var r = _runIsolationErrors(run), s = snapshot;
  if (!_isObj(s)) return { result: 'blocked', reasons: r.concat(['snapshot_invalid']) };
  var isHead = function (v) { return typeof v === 'string' && HEAD_RE.test(v); };
  var types = {
    worktreeHead: isHead, worktreeBranchRef: _str, worktreeStatusCount: function (v) { return Number.isInteger(v) && v >= 0; },
    worktreeGitCommonDir: _str, mainGitCommonDir: _str, worktreeListPorcelain: function (v) { return typeof v === 'string'; },
    worktreeEnvFiles: function (v) { return Array.isArray(v) && v.every(_str); }, worktreeProtectedChanged: _bool,
    mainHeadBefore: isHead, mainHeadAfter: isHead, mainStatusHashBefore: _str, mainStatusHashAfter: _str,
    mainProtectedFingerprintBefore: _str, mainProtectedFingerprintAfter: _str,
  };
  var shapeOk = true;
  Object.keys(types).forEach(function (k) { if (!types[k](s[k])) { shapeOk = false; r.push('snapshot_invalid:' + k); } });
  if (!shapeOk || r.length) return { result: 'blocked', reasons: r };

  var ref = 'refs/heads/' + run.branch;
  if (s.worktreeHead !== run.baseHead) r.push('worktree_head_mismatch');
  if (s.worktreeBranchRef !== ref) r.push('worktree_branch_mismatch');
  if (s.worktreeStatusCount !== 0) r.push('worktree_dirty');
  if (!samePath(s.worktreeGitCommonDir, s.mainGitCommonDir)) r.push('common_git_dir_mismatch');
  if (s.worktreeEnvFiles.length) r.push('env_file_present');
  if (s.worktreeProtectedChanged !== false) r.push('worktree_protected_changed');
  var wl = parseWorktreeListPorcelain(s.worktreeListPorcelain);
  if (!wl.ok) r.push('worktree_list_malformed');
  else {
    var hit = _findRegistered(wl.worktrees, run.worktreePath);
    if (hit.length !== 1) r.push('worktree_not_registered');
    else if (hit[0].head !== run.baseHead || hit[0].branch !== ref || hit[0].locked || hit[0].prunable) r.push('registered_worktree_mismatch');
  }
  if (s.mainHeadBefore !== run.baseHead || s.mainHeadAfter !== s.mainHeadBefore) r.push('main_head_changed');
  if (s.mainStatusHashAfter !== s.mainStatusHashBefore) r.push('main_status_changed');
  if (typeof run.mainStatusHashAtStart === 'string' && s.mainStatusHashBefore !== run.mainStatusHashAtStart) r.push('main_status_changed_since_run_start');
  if (s.mainProtectedFingerprintAfter !== s.mainProtectedFingerprintBefore) r.push('main_protected_changed');
  return r.length ? { result: 'blocked', reasons: r } : { result: 'valid', reasons: [] };
}

// ── Resume Isolation（runStore を mutation しない。Step 2 validateResume と合成できる形式）──
// snapshot: { worktreeExists, branchExists, worktreeHead, branchTip, worktreeGitCommonDir, mainGitCommonDir,
//             worktreeListPorcelain, mainStatusHash, mainProtectedMd5{}, worktreeEnvFiles[], diffAllowed, worktreeProtectedChanged }
// 実装中は worktree が dirty で正常。Autopilot は commit しないので worktree HEAD / branch tip は常に baseHead。
function _sameMd5Map(a, b) {
  if (!_isObj(a) || !_isObj(b)) return false;
  var ka = Object.keys(a).sort(), kb = Object.keys(b).sort();
  return ka.length > 0 && ka.length === kb.length && ka.every(function (k, i) { return k === kb[i] && typeof a[k] === 'string' && a[k] === b[k]; });
}
function validateIsolationResume(run, snapshot) {
  var r = _runIsolationErrors(run), s = snapshot;
  if (!_isObj(s)) return { result: 'blocked', reasons: r.concat(['snapshot_invalid']) };
  var isHead = function (v) { return typeof v === 'string' && HEAD_RE.test(v); };
  var types = {
    worktreeExists: _bool, branchExists: _bool, worktreeHead: isHead, branchTip: isHead,
    worktreeGitCommonDir: _str, mainGitCommonDir: _str, worktreeListPorcelain: function (v) { return typeof v === 'string'; },
    mainStatusHash: _str, mainProtectedMd5: _isObj, worktreeEnvFiles: function (v) { return Array.isArray(v) && v.every(_str); },
    diffAllowed: _bool, worktreeProtectedChanged: _bool,
  };
  var shapeOk = true;
  Object.keys(types).forEach(function (k) { if (!types[k](s[k])) { shapeOk = false; r.push('snapshot_invalid:' + k); } });
  if (!shapeOk || r.length) return { result: 'blocked', reasons: r };

  var ref = 'refs/heads/' + run.branch;
  if (s.worktreeExists !== true) r.push('worktree_missing');
  if (s.branchExists !== true) r.push('branch_missing');
  if (s.worktreeHead !== run.baseHead) r.push('worktree_head_mismatch');
  if (s.branchTip !== run.baseHead) r.push('branch_tip_mismatch');
  if (!samePath(s.worktreeGitCommonDir, s.mainGitCommonDir)) r.push('common_git_dir_mismatch');
  var wl = parseWorktreeListPorcelain(s.worktreeListPorcelain);
  if (!wl.ok) r.push('worktree_list_malformed');
  else {
    var hit = _findRegistered(wl.worktrees, run.worktreePath);
    if (hit.length !== 1) r.push('worktree_not_registered');
    else if (hit[0].branch !== ref || hit[0].prunable) r.push('registered_worktree_mismatch');
  }
  if (typeof run.mainStatusHashAtStart !== 'string' || s.mainStatusHash !== run.mainStatusHashAtStart) r.push('main_status_changed');
  if (!_sameMd5Map(s.mainProtectedMd5, run.protectedMd5AtStart)) r.push('main_protected_mismatch');
  if (s.worktreeEnvFiles.length) r.push('env_file_present');
  if (s.diffAllowed !== true) r.push('diff_outside_scope');
  if (s.worktreeProtectedChanged !== false) r.push('worktree_protected_changed');
  return r.length ? { result: 'blocked', reasons: r } : { result: 'resumable', reasons: [] };
}

// Step 2 validateResume の結果と isolation の結果を合成（blocked > human_approval_required > resumable）
function combineResumeResults(storeResult, isolationResult) {
  var ok = function (x) { return _isObj(x) && Array.isArray(x.reasons) && ['resumable', 'human_approval_required', 'blocked'].indexOf(x.result) !== -1; };
  if (!ok(storeResult) || !ok(isolationResult)) return { result: 'blocked', reasons: ['resume_result_invalid'] };
  var reasons = storeResult.reasons.concat(isolationResult.reasons);
  if (storeResult.result === 'blocked' || isolationResult.result === 'blocked') return { result: 'blocked', reasons: reasons };
  if (storeResult.result === 'human_approval_required' || isolationResult.result === 'human_approval_required') return { result: 'human_approval_required', reasons: reasons };
  return { result: 'resumable', reasons: [] };
}

// ── Child Env（allowlist・deny 優先・case-insensitive）──
function buildChildEnv(parentEnv) {
  if (!_isObj(parentEnv)) return _err('parent_env_invalid');
  var env = {}, dropped = [], seen = {};
  var keys = Object.keys(parentEnv);
  for (var i = 0; i < keys.length; i++) {
    var k = keys[i], up = k.toUpperCase();
    if (seen[up]) return _err('ambiguous_env_key', { key: up });   // PATH と Path の併存など
    seen[up] = true;
    var sensitive = SENSITIVE_ENV_PATTERNS.some(function (re) { return re.test(k); });
    if (sensitive || CHILD_ENV_ALLOWLIST.indexOf(up) === -1 || typeof parentEnv[k] !== 'string') { dropped.push(k); continue; }
    env[k] = parentEnv[k];
  }
  return { ok: true, env: env, dropped: dropped };
}

// ── Cleanup Plan（Human 用の表示のみ。実行しない）─────────
function buildSafeCleanupPlan(run) {
  var e = _runIsolationErrors(run);
  if (e.length) return _err('run_invalid', { errors: e });
  if (['completed', 'failed', 'blocked'].indexOf(run.outcome) === -1) return _err('run_not_terminal');
  if (run.lock !== null && run.lock !== undefined) return _err('run_locked');
  var repo = validateWindowsAbsPath(run.mainRepoPath).normalized, wt = validateWindowsAbsPath(run.worktreePath).normalized;
  var steps = [
    { description: 'worktree の未 commit 変更を確認する（read-only）', argv: ['git', '-C', wt, 'status', '--porcelain'] },
    { description: '登録 worktree を確認する（read-only）', argv: ['git', '-C', repo, 'worktree', 'list', '--porcelain'] },
    { description: '変更が不要と Human が確認した後だけ、non-force で worktree を外す（dirty なら Git が拒否する）', argv: ['git', '-C', repo, 'worktree', 'remove', wt] },
    { description: 'merge 済み、または不要と Human が判断した後だけ branch を safe delete する（未 merge なら Git が拒否する）', argv: ['git', '-C', repo, 'branch', '-d', run.branch] },
  ];
  steps.forEach(function (st) {
    st.argv.forEach(function (a) { if (FORBIDDEN_CLEANUP_TOKENS.indexOf(a) !== -1) throw new Error('cleanup_plan_forbidden_token:' + a); });
  });
  return _freezeDeep({
    ok: true, mode: 'human_only', autoExecute: false,
    preconditions: [
      'run.outcome が completed / failed / blocked であること（' + run.outcome + '）',
      'run の lock が無いこと',
      'main の Protected fingerprint と status hash が run 開始時と一致すること',
      '必要な変更が commit 済み、または破棄してよいと Human が判断していること',
    ],
    steps: steps,
    notAllowed: ['--force', 'branch -D', 'reset', 'clean', 'worktree prune', 'stash'],
  });
}

module.exports = {
  BRANCH_PREFIX: BRANCH_PREFIX,
  BRANCH_TASK_ID_RE: BRANCH_TASK_ID_RE,
  MAX_WORKTREE_PATH_LENGTH: MAX_WORKTREE_PATH_LENGTH,
  CHILD_ENV_ALLOWLIST: CHILD_ENV_ALLOWLIST,
  PREFLIGHT_RUN_STAGE: PREFLIGHT_RUN_STAGE,
  isValidBranchTaskId: isValidBranchTaskId,
  deriveBranchName: deriveBranchName,
  checkBranchCollision: checkBranchCollision,
  validateWindowsAbsPath: validateWindowsAbsPath,
  samePath: samePath,
  deriveWorktreePath: deriveWorktreePath,
  parseWorktreeListPorcelain: parseWorktreeListPorcelain,
  validateIsolationPreflight: validateIsolationPreflight,
  buildWorktreeCreateCommand: buildWorktreeCreateCommand,
  validateCreatedWorktree: validateCreatedWorktree,
  validateIsolationResume: validateIsolationResume,
  combineResumeResults: combineResumeResults,
  buildChildEnv: buildChildEnv,
  buildSafeCleanupPlan: buildSafeCleanupPlan,
};
