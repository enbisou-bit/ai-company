'use strict';
// tools/devAutopilot/realRepoPermit.js
// Development Autopilot V1 — Step 3C Preparation: Explicit Real Repo Permit（Decision 120 決定 10〜13）
//
//   ★ 本物の repo（executor 自身が置かれた ENBISOU 本体）への worktree 作成は、この Permit を consume して得た
//     opaque capability がある場合だけ、その 1 操作に限って executor の自 repo 拒否を解除できる。generic allowlist では解除しない。
//   ★ Permit は single-use／task-specific／repo-specific／baseHead-specific／operation-specific／short-lived（最大 30 分）。
//   ★ Human の明示承認後にだけ作成する Contract（このモジュールは承認そのものを代行しない）。
//   ★ raw remote URL は canonicalizeRemote の内部だけで扱い、Permit・result・error に含めない。credential 付きは fail-closed。
//   ★ consume は unconsumed file → validation → 原子的 rename（*.consumed.json）→ capability 発行。unconsume は提供しない
//     （consume 後に process が落ちた Permit は burned。再試行には新しい Human approval と Permit が必要）。
//   ★ capability は module-private な WeakSet に登録した object だけが有効（JSON clone / spread / 手書き object は無効、
//     process restart 後も無効 = fail-closed）。

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var wc = require('./worktreeController');

var PERMIT_VERSION = 1;
var MODE = 'controlled_real_repo_trial';
var DECISION_REF = 'Decision 120';
var OPERATION = 'worktree_add';
var MAX_TTL_MS = 30 * 60 * 1000;
var MAX_CLOCK_SKEW_MS = 60 * 1000;
var HEAD_RE = /^[0-9a-f]{40}$/;
var HASH12_RE = /^[0-9a-f]{12}$/;
var PERMIT_ID_RE = /^permit-[0-9a-f]{32}$/;
var ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z$/;
var PERMIT_KEYS = Object.freeze(['version', 'mode', 'permitId', 'decisionRef', 'repoIdentity', 'expectedHead', 'expectedOriginMain',
  'taskId', 'branch', 'worktreePath', 'operation', 'protectedFingerprint', 'autopilotStatusHash', 'approvedBy', 'approvedAt',
  'expiresAt', 'consumed']);
var IDENTITY_KEYS = Object.freeze(['repoPath', 'gitCommonDir', 'rootCommit', 'remoteIdentity']);

var _genuine = new WeakSet();   // consumePermit が発行した capability だけ
var _used = new WeakSet();      // executor が 1 回使った capability

function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _err(code, extra) { return Object.assign({ ok: false, error: code }, extra || {}); }
function _iso(v) { return typeof v === 'string' && ISO_RE.test(v) && !isNaN(Date.parse(v)); }
function _exactKeys(o, keys) { var k = Object.keys(o).sort(); var e = keys.slice().sort(); return k.length === e.length && k.every(function (x, i) { return x === e[i]; }); }

// ── Remote identity（credential-free・network なし）──────────────
// 戻り値の error は固定 code だけ。raw 値は一切含めない。
var SEG_RE = /^[A-Za-z0-9._~-]+$/;
function _normPath(p) {
  var s = String(p).replace(/^\/+/, '').replace(/\/+$/, '').replace(/\.git$/i, '');
  var segs = s.split('/');
  if (!s || segs.some(function (x) { return !x || x === '.' || x === '..' || !SEG_RE.test(x); })) return null;
  return segs.join('/');
}
function canonicalizeRemote(raw) {
  if (typeof raw !== 'string') return _err('remote_malformed');
  var r = raw.trim();
  if (!r || /[\s\u0000-\u001f\u007f]/.test(r)) return _err('remote_malformed');
  if (/[?#]/.test(r)) return _err('remote_query_or_fragment');
  // URL parser は `/../` や `%2e%2e`・`\` を解決・変換してしまうため、parse 前の raw で拒否する
  if (/[%\\]/.test(r) || /(^|[\/:])\.{1,2}(\/|$)/.test(r)) return _err('remote_malformed');
  var host, port = '', p;
  if (/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(r)) {
    var u;
    try { u = new URL(r); } catch (e) { return _err('remote_malformed'); }
    var scheme = u.protocol.replace(/:$/, '').toLowerCase();
    if (['https', 'http', 'ssh'].indexOf(scheme) === -1) return _err('remote_unsupported_scheme');
    if (u.password) return _err('remote_credentials_embedded');
    if (u.username && scheme !== 'ssh') return _err('remote_credentials_embedded');   // https://user@ / user:token@ は fail-closed
    if (u.search || u.hash) return _err('remote_query_or_fragment');
    host = u.hostname.toLowerCase(); port = u.port; p = u.pathname;
  } else {
    // SCP-like: [user@]host:path（transport user は identity に含めない）
    var m = /^(?:([A-Za-z0-9._-]+)@)?([A-Za-z0-9.-]+):(?!\/\/)(.+)$/.exec(r);
    if (!m || m[2].length < 2) return _err('remote_malformed');   // 1 文字 host は Windows drive（C:\...）とみなし拒否
    host = m[2].toLowerCase(); p = m[3];
  }
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/.test(host || '')) return _err('remote_malformed');
  var np = _normPath(p);
  if (!np) return _err('remote_malformed');
  return { ok: true, identity: host + (port ? ':' + port : '') + '/' + np };
}

// ── Permit record（pure）────────────────────────────────
function _identityErrors(id) {
  var e = [];
  if (!_isObj(id) || !_exactKeys(id, IDENTITY_KEYS)) return ['repo_identity_shape'];
  if (!wc.validateWindowsAbsPath(id.repoPath).ok) e.push('repo_path_invalid');
  if (!wc.validateWindowsAbsPath(id.gitCommonDir).ok) e.push('git_common_dir_invalid');
  if (typeof id.rootCommit !== 'string' || !HEAD_RE.test(id.rootCommit)) e.push('root_commit_invalid');
  if (typeof id.remoteIdentity !== 'string' || !canonicalizeRemote('https://' + id.remoteIdentity).ok || canonicalizeRemote('https://' + id.remoteIdentity).identity !== id.remoteIdentity) e.push('remote_identity_invalid');
  return e;
}

// 構造・binding・時間の検証（now 基準）。unknown key は拒否（secret field の混入を防ぐ）
function validatePermit(permit, opts) {
  var o = opts || {};
  var e = [];
  if (!_isObj(permit)) return { ok: false, errors: ['permit_invalid'] };
  if (!_exactKeys(permit, PERMIT_KEYS)) e.push('permit_keys_mismatch');
  if (permit.version !== PERMIT_VERSION) e.push('version_invalid');
  if (permit.mode !== MODE) e.push('mode_invalid');
  if (permit.decisionRef !== DECISION_REF) e.push('decision_ref_invalid');
  if (permit.operation !== OPERATION) e.push('operation_invalid');
  if (typeof permit.permitId !== 'string' || !PERMIT_ID_RE.test(permit.permitId)) e.push('permit_id_invalid');
  e = e.concat(_identityErrors(permit.repoIdentity));
  if (typeof permit.expectedHead !== 'string' || !HEAD_RE.test(permit.expectedHead)) e.push('expected_head_invalid');
  if (typeof permit.expectedOriginMain !== 'string' || !HEAD_RE.test(permit.expectedOriginMain)) e.push('expected_origin_main_invalid');
  else if (permit.expectedHead !== permit.expectedOriginMain) e.push('head_not_equal_origin_main');   // Decision 120 決定 15
  var b = wc.deriveBranchName(permit.taskId);
  if (!b.ok) e.push('task_id_invalid');
  else if (permit.branch !== b.branch) e.push('branch_mismatch');
  if (typeof permit.protectedFingerprint !== 'string' || !HASH12_RE.test(permit.protectedFingerprint)) e.push('protected_fingerprint_invalid');
  if (typeof permit.autopilotStatusHash !== 'string' || !HASH12_RE.test(permit.autopilotStatusHash)) e.push('autopilot_status_hash_invalid');
  if (permit.approvedBy !== 'human') e.push('approved_by_invalid');
  if (typeof permit.consumed !== 'boolean') e.push('consumed_invalid');
  if (!_iso(permit.approvedAt) || !_iso(permit.expiresAt)) e.push('time_invalid');
  else {
    var a = Date.parse(permit.approvedAt), x = Date.parse(permit.expiresAt);
    if (x <= a) e.push('expires_before_approved');
    if (x - a > MAX_TTL_MS) e.push('ttl_too_long');
    if (o.now !== undefined) {
      if (!_iso(o.now)) e.push('now_invalid');
      else {
        var n = Date.parse(o.now);
        if (a > n + MAX_CLOCK_SKEW_MS) e.push('approved_at_in_future');
        if (n >= x) e.push('expired');
      }
    } else e.push('now_required');
  }
  // worktreePath は repo 外・root 配下など controller の Contract で再導出して一致を確認
  if (b.ok && e.indexOf('repo_path_invalid') === -1 && _isObj(permit.repoIdentity)) {
    if (!wc.validateWindowsAbsPath(permit.worktreePath).ok) e.push('worktree_path_invalid');
    else {
      var d = wc.deriveWorktreePath(path.win32.dirname(permit.worktreePath), permit.taskId, permit.repoIdentity.repoPath);
      if (!d.ok || !wc.samePath(d.worktreePath, permit.worktreePath)) e.push('worktree_path_mismatch');
    }
  }
  return { ok: e.length === 0, errors: e };
}

// Human 承認の内容から Permit record を作る（pure。保存は writePermit）
// input: { repoIdentity, expectedHead, expectedOriginMain, taskId, worktreeRoot, branch?, worktreePath?,
//          protectedFingerprint, autopilotStatusHash, approvedBy, approvedAt, ttlMs, now }
function buildPermit(input) {
  var i = _isObj(input) ? input : {};
  var b = wc.deriveBranchName(i.taskId);
  if (!b.ok) return _err('permit_invalid', { errors: ['task_id_invalid'] });
  var repoPath = _isObj(i.repoIdentity) ? i.repoIdentity.repoPath : null;
  var wp = wc.deriveWorktreePath(i.worktreeRoot, i.taskId, repoPath);
  if (!wp.ok) return _err('permit_invalid', { errors: ['worktree_path_invalid'] });
  if (i.branch !== undefined && i.branch !== b.branch) return _err('permit_invalid', { errors: ['branch_mismatch'] });
  if (i.worktreePath !== undefined && !wc.samePath(i.worktreePath, wp.worktreePath)) return _err('permit_invalid', { errors: ['worktree_path_mismatch'] });
  var ttl = i.ttlMs;
  if (!Number.isInteger(ttl) || ttl <= 0 || ttl > MAX_TTL_MS) return _err('permit_invalid', { errors: ['ttl_invalid'] });
  if (!_iso(i.approvedAt)) return _err('permit_invalid', { errors: ['time_invalid'] });
  var permit = {
    version: PERMIT_VERSION, mode: MODE, permitId: 'permit-' + crypto.randomBytes(16).toString('hex'), decisionRef: DECISION_REF,
    repoIdentity: _isObj(i.repoIdentity) ? {
      repoPath: i.repoIdentity.repoPath, gitCommonDir: i.repoIdentity.gitCommonDir,
      rootCommit: i.repoIdentity.rootCommit, remoteIdentity: i.repoIdentity.remoteIdentity,
    } : i.repoIdentity,
    expectedHead: i.expectedHead, expectedOriginMain: i.expectedOriginMain,
    taskId: i.taskId, branch: b.branch, worktreePath: wp.worktreePath, operation: OPERATION,
    protectedFingerprint: i.protectedFingerprint, autopilotStatusHash: i.autopilotStatusHash,
    approvedBy: i.approvedBy, approvedAt: i.approvedAt, expiresAt: new Date(Date.parse(i.approvedAt) + ttl).toISOString(),
    consumed: false,
  };
  var v = validatePermit(permit, { now: i.now });
  return v.ok ? { ok: true, permit: permit } : _err('permit_invalid', { errors: v.errors });
}

// ── Storage（repo 外 root・exclusive create）─────────────────
function _insideOrSame(child, parent) {
  var rel = path.win32.relative(path.win32.resolve(parent).toLowerCase(), path.win32.resolve(child).toLowerCase());
  return rel === '' || (!!rel && rel.split('\\')[0] !== '..' && !path.win32.isAbsolute(rel));
}
function resolvePermitPaths(store, permitId) {
  if (!_isObj(store)) return _err('store_invalid');
  if (!wc.validateWindowsAbsPath(store.root).ok) return _err('permit_root_invalid');
  if (!wc.validateWindowsAbsPath(store.repoPath).ok) return _err('repo_path_required');
  if (_insideOrSame(store.root, store.repoPath) || _insideOrSame(store.repoPath, store.root)) return _err('permit_root_inside_repo');
  if (typeof permitId !== 'string' || !PERMIT_ID_RE.test(permitId)) return _err('permit_id_invalid');
  var root = path.win32.normalize(store.root);
  return { ok: true, root: root, file: path.win32.join(root, permitId + '.json'), consumedFile: path.win32.join(root, permitId + '.consumed.json') };
}
function _rootOk(root) {
  try {
    if (!fs.lstatSync(root).isDirectory()) return 'permit_root_not_directory';
    if (!wc.samePath(fs.realpathSync.native(root), root)) return 'permit_root_link_or_junction';
  } catch (e) { return e.code === 'ENOENT' ? 'permit_root_missing' : 'permit_root_unreadable'; }
  return null;
}

function writePermit(store, permit, opts) {
  var v = validatePermit(permit, opts);
  if (!v.ok) return _err('permit_invalid', { errors: v.errors });
  if (permit.consumed !== false) return _err('permit_already_consumed');
  if (!wc.samePath(permit.repoIdentity.repoPath, store && store.repoPath)) return _err('permit_repo_mismatch_store');
  var p = resolvePermitPaths(store, permit.permitId);
  if (!p.ok) return p;
  var bad = _rootOk(p.root);
  if (bad) return _err(bad);
  if (fs.existsSync(p.consumedFile)) return _err('permit_exists');
  try { fs.writeFileSync(p.file, JSON.stringify(permit, null, 2) + '\n', { flag: 'wx' }); }   // exclusive create（上書きしない）
  catch (e) { return _err(e.code === 'EEXIST' ? 'permit_exists' : 'permit_write_failed'); }
  return { ok: true, permitId: permit.permitId, file: p.file };
}

// ── Consume（原子的 rename → opaque capability）──────────────
// live: executor が read-only で実測した現在値
//   { repoIdentity{repoPath,gitCommonDir,rootCommit,remoteIdentity}, currentHead, currentOriginMain,
//     taskId, branch, worktreePath, protectedFingerprint, autopilotStatusHash }
var LIVE_BINDINGS = [['expectedHead', 'currentHead'], ['expectedOriginMain', 'currentOriginMain'], ['taskId', 'taskId'], ['branch', 'branch'],
  ['protectedFingerprint', 'protectedFingerprint'], ['autopilotStatusHash', 'autopilotStatusHash']];
function _bindingErrors(permit, live) {
  var e = [];
  if (!_isObj(live) || !_isObj(live.repoIdentity)) return ['live_invalid'];
  var a = permit.repoIdentity, b = live.repoIdentity;
  if (!wc.samePath(a.repoPath, b.repoPath)) e.push('binding:repoPath');
  if (!wc.samePath(a.gitCommonDir, b.gitCommonDir)) e.push('binding:gitCommonDir');
  if (a.rootCommit !== b.rootCommit) e.push('binding:rootCommit');
  if (a.remoteIdentity !== b.remoteIdentity) e.push('binding:remoteIdentity');
  LIVE_BINDINGS.forEach(function (k) { if (permit[k[0]] !== live[k[1]]) e.push('binding:' + k[0]); });
  if (!wc.samePath(permit.worktreePath, live.worktreePath)) e.push('binding:worktreePath');
  return e;
}

function consumePermit(store, permitId, live, opts) {
  var p = resolvePermitPaths(store, permitId);
  if (!p.ok) return p;
  var bad = _rootOk(p.root);
  if (bad) return _err(bad);
  var raw;
  try { raw = fs.readFileSync(p.file, 'utf8'); } catch (e) { return _err(e.code === 'ENOENT' ? 'permit_not_found_or_consumed' : 'permit_unreadable'); }
  var permit;
  try { permit = JSON.parse(raw); } catch (e) { return _err('permit_unparseable'); }
  var v = validatePermit(permit, opts);
  if (!v.ok) return _err('permit_invalid', { errors: v.errors });
  if (permit.permitId !== permitId || permit.consumed !== false) return _err('permit_invalid', { errors: ['permit_state_invalid'] });
  var be = _bindingErrors(permit, live);
  if (be.length) return _err('permit_binding_mismatch', { errors: be });
  if (fs.existsSync(p.consumedFile)) return _err('permit_already_consumed');
  try { fs.renameSync(p.file, p.consumedFile); }   // 原子的な state 遷移。以後この Permit は burned（unconsume しない）
  catch (e) { return _err(e.code === 'ENOENT' ? 'permit_not_found_or_consumed' : 'permit_consume_failed'); }
  var consumedAt = _iso(opts && opts.now) ? opts.now : new Date().toISOString();
  try {
    var rec = JSON.parse(fs.readFileSync(p.consumedFile, 'utf8'));
    if (JSON.stringify(rec) !== JSON.stringify(permit)) return _err('permit_changed_during_consume');
  } catch (e) { return _err('permit_consume_verify_failed'); }
  var cap = Object.freeze({
    permitId: permit.permitId, operation: permit.operation,
    repoPath: permit.repoIdentity.repoPath, gitCommonDir: permit.repoIdentity.gitCommonDir,
    expectedHead: permit.expectedHead, expectedOriginMain: permit.expectedOriginMain,
    taskId: permit.taskId, branch: permit.branch, worktreePath: permit.worktreePath, consumedAt: consumedAt,
  });
  _genuine.add(cap);
  return { ok: true, capability: cap, consumedFile: p.consumedFile };
}

// executor 用: consumePermit が発行した本物の capability か
function isGenuineCapability(cap) { return !!cap && typeof cap === 'object' && _genuine.has(cap); }
// executor 用: 1 回だけ使用可能（2 回目は false）。Git 実行の前に呼び、失敗時も戻さない（burned）
function redeemCapability(cap) {
  if (!isGenuineCapability(cap) || _used.has(cap)) return false;
  _used.add(cap);
  return true;
}

module.exports = {
  PERMIT_VERSION: PERMIT_VERSION,
  MODE: MODE,
  DECISION_REF: DECISION_REF,
  OPERATION: OPERATION,
  MAX_TTL_MS: MAX_TTL_MS,
  canonicalizeRemote: canonicalizeRemote,
  validatePermit: validatePermit,
  buildPermit: buildPermit,
  resolvePermitPaths: resolvePermitPaths,
  writePermit: writePermit,
  consumePermit: consumePermit,
  isGenuineCapability: isGenuineCapability,
  redeemCapability: redeemCapability,
};
