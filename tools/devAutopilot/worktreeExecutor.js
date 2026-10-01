'use strict';
// tools/devAutopilot/worktreeExecutor.js
// Development Autopilot V1 — Step 3B: Git 限定の薄い executor
//
//   ★ worktree policy（branch / path / preflight / 検証）の正本は worktreeController.js。ここでは重複実装しない。
//   ★ 実行は execFileSync('git', argv, { shell: false }) のみ。exec / shell / PowerShell / cmd 文字列は使わない。
//   ★ 任意 argv は受け付けない。実行できるのは下の KINDS（read-only）と、Step 3A preflight が pass した worktree add だけ。
//   ★ child env は必ず worktreeController.buildChildEnv（allowlist）を通し、GIT_CONFIG_GLOBAL=NUL を固定で上書きする
//     （user global config を読ませない。system config は維持）。raw env を result に含めない。
//   ★ mutation（worktree add）は mutationRepoAllowlist に明示された repo だけ。
//     この executor 自身が置かれた repo（ENBISOU 本体）は既定で常に拒否する。generic allowlist では解除できず、
//     realRepoPermit.consumePermit が発行した opaque capability の binding が全一致する 1 操作だけ解除する（Decision 120 決定 10〜13）。
//   ★ status hash は autopilotStatusHash（safety 判断の正本）と displayStatusHash（表示用）に分離する（Decision 120 決定 14）。
//   ★ 失敗時の自動 repair / cleanup / retry / force はしない。

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var childProcess = require('child_process');
var wc = require('./worktreeController');
var permitMod = require('./realRepoPermit');

var HEAD_RE = /^[0-9a-f]{40}$/;
var DEV_REF_RE = /^refs\/heads\/dev\/[a-z0-9][a-z0-9-]{2,40}$/;
var DEFAULT_TIMEOUT_MS = 15000;
var MIN_TIMEOUT_MS = 1000;
var MAX_TIMEOUT_MS = 60000;
var MAX_BUFFER = 4 * 1024 * 1024;
var SELF_REPO_ROOT = path.resolve(__dirname, '..', '..');   // この executor を含む repo（mutation 常時拒否）
// Git for Windows は HOME / USERPROFILE が無くても user global config を読むため、固定値で無効化する。
// system config（autocrlf 等）は main と worktree の整合に必要なので維持する（GIT_CONFIG_NOSYSTEM は設定しない）。
var GIT_FIXED_ENV = Object.freeze({ GIT_CONFIG_GLOBAL: 'NUL' });
var CONFIG_PROBE_SCOPES = Object.freeze(['global', 'system']);
var CONFIG_PROBE_KEYS = Object.freeze(['user.name', 'user.email', 'core.autocrlf', 'core.hookspath', 'credential.helper', 'http.proxy']);

function _dirOk(d) { return wc.validateWindowsAbsPath(d).ok; }

// Git child 用 env: buildChildEnv（allowlist）の結果に固定値を上書きする。parentEnv 由来の同名値は使わない
function buildGitChildEnv(parentEnv) {
  var r = wc.buildChildEnv(parentEnv);
  if (!r.ok) return r;
  var env = {};
  Object.keys(r.env).forEach(function (k) { if (!Object.prototype.hasOwnProperty.call(GIT_FIXED_ENV, k.toUpperCase())) env[k] = r.env[k]; });
  Object.keys(GIT_FIXED_ENV).forEach(function (k) { env[k] = GIT_FIXED_ENV[k]; });
  return { ok: true, env: env, dropped: r.dropped };
}

// read-only の Git command（--no-optional-locks で index の refresh 書き込みもしない）
var KINDS = Object.freeze({
  version: function () { return ['--version']; },
  revParseHead: function (p) { return ['--no-optional-locks', '-C', p.dir, 'rev-parse', '--verify', 'HEAD']; },
  symbolicHead: function (p) { return ['--no-optional-locks', '-C', p.dir, 'symbolic-ref', '--quiet', 'HEAD']; },
  statusShort: function (p) { return ['--no-optional-locks', '-C', p.dir, 'status', '--short', '--untracked-files=all']; },   // autopilotStatusHash 用
  statusShortDisplay: function (p) { return ['--no-optional-locks', '-C', p.dir, 'status', '--short']; },                     // displayStatusHash 用
  stagedNames: function (p) { return ['--no-optional-locks', '-C', p.dir, 'diff', '--cached', '--name-only']; },
  branchRefs: function (p) { return ['--no-optional-locks', '-C', p.dir, 'for-each-ref', '--format=%(refname)', 'refs/heads/']; },
  worktreeList: function (p) { return ['--no-optional-locks', '-C', p.dir, 'worktree', 'list', '--porcelain']; },
  gitCommonDir: function (p) { return ['--no-optional-locks', '-C', p.dir, 'rev-parse', '--path-format=absolute', '--git-common-dir']; },
  hooksDir: function (p) { return ['--no-optional-locks', '-C', p.dir, 'rev-parse', '--path-format=absolute', '--git-path', 'hooks']; },
  hooksPathConfig: function (p) { return ['--no-optional-locks', '-C', p.dir, 'config', '--get', 'core.hooksPath']; },
  isAncestor: function (p) {
    if (!HEAD_RE.test(p.ancestor || '') || !HEAD_RE.test(p.descendant || '')) return null;
    return ['--no-optional-locks', '-C', p.dir, 'merge-base', '--is-ancestor', p.ancestor, p.descendant];
  },
  // Stage 4D（observers）用の read-only kind
  showToplevel: function (p) { return ['--no-optional-locks', '-C', p.dir, 'rev-parse', '--path-format=absolute', '--show-toplevel']; },
  statusPorcelainZ: function (p) { return ['--no-optional-locks', '-C', p.dir, 'status', '--porcelain=v1', '-z', '--untracked-files=all']; },
  lsFilesZ: function (p) { return ['--no-optional-locks', '-C', p.dir, 'ls-files', '-z']; },
  originMain: function (p) { return ['--no-optional-locks', '-C', p.dir, 'rev-parse', '--verify', '--quiet', 'refs/remotes/origin/main']; },
  verifyDevRef: function (p) {
    if (!DEV_REF_RE.test(p.ref || '')) return null;
    return ['--no-optional-locks', '-C', p.dir, 'rev-parse', '--verify', '--quiet', p.ref];
  },
  // config の存在確認（read-only・scope と key は固定 allowlist）。呼び出し側は exitCode だけを見て値を log しない
  configProbe: function (p) {
    if (CONFIG_PROBE_SCOPES.indexOf(p.scope) === -1 || CONFIG_PROBE_KEYS.indexOf(String(p.key).toLowerCase()) === -1) return null;
    return ['--no-optional-locks', '-C', p.dir, 'config', '--' + p.scope, '--get', p.key];
  },
});

function _normalizeTimeout(t) {
  if (t === undefined) return DEFAULT_TIMEOUT_MS;
  return Number.isInteger(t) && t >= MIN_TIMEOUT_MS && t <= MAX_TIMEOUT_MS ? t : null;
}

// execFileSync を 1 回だけ呼び、結果を正規化する（例外を投げない）
function _exec(kind, args, cwd, opts) {
  var o = opts || {};
  var timeout = _normalizeTimeout(o.timeoutMs);
  if (timeout === null) return { ok: false, kind: kind, error: 'timeout_invalid' };
  var envRes = buildGitChildEnv(o.parentEnv !== undefined ? o.parentEnv : process.env);
  if (!envRes.ok) return { ok: false, kind: kind, error: 'child_env_invalid' };
  var run = typeof o._execFileSync === 'function' ? o._execFileSync : childProcess.execFileSync;   // test からの注入のみ
  var res = { ok: false, kind: kind, args: args.slice(), exitCode: null, stdout: '', stderr: '', timedOut: false, error: null };
  try {
    var out = run('git', args, {
      cwd: cwd, env: envRes.env, shell: false, windowsHide: true, timeout: timeout, killSignal: 'SIGKILL',
      maxBuffer: MAX_BUFFER, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'],
    });
    res.ok = true; res.exitCode = 0; res.stdout = typeof out === 'string' ? out : '';
  } catch (e) {
    res.exitCode = typeof e.status === 'number' ? e.status : null;
    res.stdout = typeof e.stdout === 'string' ? e.stdout : (e.stdout ? String(e.stdout) : '');
    res.stderr = typeof e.stderr === 'string' ? e.stderr : (e.stderr ? String(e.stderr) : '');
    res.timedOut = e.code === 'ETIMEDOUT' || (e.signal === 'SIGKILL' && res.exitCode === null);
    res.error = res.timedOut ? 'timeout' : (e.code === 'ENOENT' ? 'git_or_cwd_not_found' : 'git_failed');
  }
  return res;
}

// read-only command を kind 名で実行（任意 argv は不可）
function runGitReadOnly(kind, params, opts) {
  if (!Object.prototype.hasOwnProperty.call(KINDS, kind)) return { ok: false, kind: kind, error: 'kind_not_allowed' };
  var p = params || {};
  if (kind !== 'version' && !_dirOk(p.dir)) return { ok: false, kind: kind, error: 'dir_invalid' };
  var args = KINDS[kind](p);
  if (!args) return { ok: false, kind: kind, error: 'params_invalid' };
  var cwd = kind === 'version' ? (p.dir && _dirOk(p.dir) ? p.dir : require('os').tmpdir()) : p.dir;
  return _exec(kind, args, cwd, opts);
}

function validateGitAvailable(opts) {
  var r = runGitReadOnly('version', {}, opts);
  var m = r.ok ? /git version (\d+)\.(\d+)/.exec(r.stdout) : null;
  if (!m) return { ok: false, error: r.error || 'git_version_unparsed' };
  var major = Number(m[1]), minor = Number(m[2]);
  // --path-format（2.31）と worktree list --porcelain の prunable（2.31）を使う
  if (major < 2 || (major === 2 && minor < 31)) return { ok: false, error: 'git_too_old', version: r.stdout.trim() };
  return { ok: true, version: r.stdout.trim() };
}

function _lines(s) { return String(s || '').split(/\r?\n/).filter(function (l) { return l.length > 0; }); }
// status hash の共通 helper（`<git status 出力> | md5sum | cut -c1-12` と同じ値）
function _statusHash(stdout) { return crypto.createHash('md5').update(stdout).digest('hex').slice(0, 12); }

// main repo 側の read-only 実測（preflight / 前後比較用）
//   autopilotStatusHash: safety 判断の正本（--untracked-files=all。Decision 120 決定 14）
//   displayStatusHash:   Human / handover 表示用（git status --short）。safety 判断・Permit・resume には使わない
function readRepoState(repoPath, opts) {
  if (!_dirOk(repoPath)) return { ok: false, error: 'repo_path_invalid' };
  var q = function (k, extra) { return runGitReadOnly(k, Object.assign({ dir: repoPath }, extra || {}), opts); };
  var head = q('revParseHead'), sym = q('symbolicHead'), st = q('statusShort'), std = q('statusShortDisplay'), staged = q('stagedNames'),
    refs = q('branchRefs'), wl = q('worktreeList'), cd = q('gitCommonDir');
  var failed = [head, st, std, staged, refs, wl, cd].filter(function (r) { return !r.ok; });
  if (failed.length) return { ok: false, error: 'git_read_failed', kinds: failed.map(function (r) { return r.kind + ':' + r.error; }) };
  var symRef = sym.ok ? sym.stdout.trim() : null;
  var parsed = wc.parseWorktreeListPorcelain(wl.stdout);
  return {
    ok: true,
    head: head.stdout.trim(),
    currentBranch: symRef && symRef.indexOf('refs/heads/') === 0 ? symRef.slice('refs/heads/'.length) : null,
    stagedCount: _lines(staged.stdout).length,
    statusLines: _lines(st.stdout),
    autopilotStatusHash: _statusHash(st.stdout),
    displayStatusHash: _statusHash(std.stdout),
    branchRefs: _lines(refs.stdout),
    worktreeListPorcelain: wl.stdout,
    worktreeCount: parsed.ok ? parsed.worktrees.length : null,
    gitCommonDir: cd.stdout.trim(),
  };
}

// worktree 側の read-only 実測
function readWorktreeState(worktreePath, opts) {
  if (!_dirOk(worktreePath)) return { ok: false, error: 'worktree_path_invalid' };
  var q = function (k) { return runGitReadOnly(k, { dir: worktreePath }, opts); };
  var head = q('revParseHead'), sym = q('symbolicHead'), st = q('statusShort'), cd = q('gitCommonDir');
  var failed = [head, st, cd].filter(function (r) { return !r.ok; });
  if (failed.length) return { ok: false, error: 'git_read_failed', kinds: failed.map(function (r) { return r.kind + ':' + r.error; }) };
  return {
    ok: true,
    head: head.stdout.trim(),
    branchRef: sym.ok ? sym.stdout.trim() : null,
    statusLines: _lines(st.stdout),
    gitCommonDir: cd.stdout.trim(),
    envFiles: listEnvFiles(worktreePath),
  };
}

// repo identity 専用の read-only kind（runGitReadOnly からは呼べない。raw remote を public result に出さないため）
var IDENTITY_KINDS = Object.freeze({
  rootCommits: function (p) { return ['--no-optional-locks', '-C', p.dir, 'rev-list', '--max-parents=0', 'HEAD']; },
  originUrl: function (p) { return ['--no-optional-locks', '-C', p.dir, 'config', '--get', 'remote.origin.url']; },
});

// Permit 用の repo identity（canonical path・common dir・root commit・credential-free remote identity）
// raw remote URL は canonicalize の入力にだけ使い、戻り値・error に含めない
function readRepoIdentity(repoPath, opts) {
  if (!_dirOk(repoPath)) return { ok: false, error: 'repo_path_invalid' };
  var real;
  try { real = fs.realpathSync.native(repoPath); } catch (e) { return { ok: false, error: 'repo_path_unreadable' }; }
  if (!wc.samePath(real, repoPath)) return { ok: false, error: 'repo_path_link_or_junction' };
  var cd = runGitReadOnly('gitCommonDir', { dir: repoPath }, opts);
  var roots = _exec('rootCommits', IDENTITY_KINDS.rootCommits({ dir: repoPath }), repoPath, opts);
  var origin = _exec('originUrl', IDENTITY_KINDS.originUrl({ dir: repoPath }), repoPath, opts);
  if (!cd.ok || !roots.ok) return { ok: false, error: 'git_read_failed' };
  if (!origin.ok) return { ok: false, error: 'remote_identity_unavailable' };
  var rootList = _lines(roots.stdout);
  if (rootList.length !== 1 || !HEAD_RE.test(rootList[0])) return { ok: false, error: 'root_commit_ambiguous' };
  var rem = permitMod.canonicalizeRemote(origin.stdout.trim());
  origin = null;   // raw 値を保持しない
  if (!rem.ok) return { ok: false, error: 'remote_identity_unavailable:' + rem.error };
  return {
    ok: true,
    repoIdentity: { repoPath: path.win32.normalize(repoPath), gitCommonDir: cd.stdout.trim(), rootCommit: rootList[0], remoteIdentity: rem.identity },
  };
}

// worktree root 直下の .env* 名（中身は読まない）。dotenv は cwd 直下を読むため root を対象にする
function listEnvFiles(dir) {
  try { return fs.readdirSync(dir).filter(function (n) { return /^\.env(\..*)?$/i.test(n); }).sort(); }
  catch (e) { return ['<unreadable:' + e.code + '>']; }   // 読めない場合は存在扱い（fail-closed）
}

// hooks dir の非 sample file、または core.hooksPath 設定があれば active とみなす（判定不能も active）
function detectActiveHooks(repoPath, opts) {
  var cfg = runGitReadOnly('hooksPathConfig', { dir: repoPath }, opts);
  if (cfg.ok) return { active: true, reason: 'core_hooks_path_set' };
  if (cfg.exitCode !== 1) return { active: true, reason: 'hooks_path_unknown' };
  var hd = runGitReadOnly('hooksDir', { dir: repoPath }, opts);
  if (!hd.ok) return { active: true, reason: 'hooks_dir_unknown' };
  var dir = hd.stdout.trim();
  var names;
  try { names = fs.readdirSync(dir); } catch (e) { return e.code === 'ENOENT' ? { active: false, hooks: [] } : { active: true, reason: 'hooks_dir_unreadable' }; }
  var hooks = names.filter(function (n) { return !/\.sample$/.test(n); });
  return { active: hooks.length > 0, hooks: hooks };
}

// target path の存在と、既存祖先に symlink / junction が無いかを lstat で確認（read-only）
function inspectTargetPath(targetPath) {
  if (!_dirOk(targetPath)) return { ok: false, error: 'path_invalid' };
  var p = path.resolve(targetPath), exists = false, link = false;
  try { fs.lstatSync(p); exists = true; } catch (e) { if (e.code !== 'ENOENT') return { ok: false, error: 'lstat_failed' }; }
  var cur = p;
  for (;;) {
    try { if (fs.lstatSync(cur).isSymbolicLink()) link = true; } catch (e) { if (e.code !== 'ENOENT') return { ok: false, error: 'lstat_failed' }; }
    var parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  var real = null;
  if (!link) {
    try { var anc = p; while (!fs.existsSync(anc)) anc = path.dirname(anc); real = fs.realpathSync.native(anc); if (!wc.samePath(real, anc)) link = true; }
    catch (e) { return { ok: false, error: 'realpath_failed' }; }
  }
  return { ok: true, exists: exists, hasLinkOrJunction: link };
}

function _insideOrSame(child, parent) {
  var rel = path.win32.relative(path.win32.resolve(parent).toLowerCase(), path.win32.resolve(child).toLowerCase());
  return rel === '' || (!!rel && rel.split('\\')[0] !== '..' && !path.win32.isAbsolute(rel));
}

// Step 3A preflight が pass した plan の worktree add だけを実行する
function executeWorktreeCreate(preflight, opts) {
  var o = opts || {};
  if (!preflight || preflight.result !== 'pass' || !Array.isArray(preflight.reasons) || preflight.reasons.length || !preflight.plan) {
    return { ok: false, kind: 'worktreeAdd', error: 'preflight_not_pass' };
  }
  var plan = preflight.plan, cmd = plan.command;
  if (!cmd || cmd.ok !== true || cmd.file !== 'git' || cmd.shell !== false || !Array.isArray(cmd.args) || cmd.args.length !== 8) {
    return { ok: false, kind: 'worktreeAdd', error: 'command_invalid' };
  }
  var a = cmd.args;
  var taskId = typeof plan.branch === 'string' ? plan.branch.slice(wc.BRANCH_PREFIX.length) : null;
  var b = wc.deriveBranchName(taskId);
  var shapeOk = a[0] === '-C' && a[2] === 'worktree' && a[3] === 'add' && a[4] === '-b'
    && b.ok && a[5] === b.branch && plan.branch === b.branch
    && wc.samePath(a[6], plan.worktreePath) && HEAD_RE.test(a[7]) && a[7] === plan.baseHead
    && _dirOk(a[1]) && _dirOk(a[6]) && a.every(function (x, i) { return typeof x === 'string' && (x.charAt(0) !== '-' || i === 0 || i === 4); });
  if (!shapeOk) return { ok: false, kind: 'worktreeAdd', error: 'command_shape_invalid' };
  var repo = a[1], wt = a[6];
  var extraRoots = Array.isArray(o.protectedRepoRoots) ? o.protectedRepoRoots : [];
  // worktree は自 repo・追加 protected root の外でなければならない（Permit があっても例外なし）
  if (_insideOrSame(wt, SELF_REPO_ROOT) || extraRoots.some(function (r) { return typeof r !== 'string' || _insideOrSame(wt, r); })) {
    return { ok: false, kind: 'worktreeAdd', error: 'repo_protected' };
  }
  // 追加 protected root は Permit でも解除しない
  if (extraRoots.some(function (r) { return _insideOrSame(repo, r) || _insideOrSame(r, repo); })) return { ok: false, kind: 'worktreeAdd', error: 'repo_protected' };
  var cap = o.realRepoCapability;
  if (_insideOrSame(repo, SELF_REPO_ROOT) || _insideOrSame(SELF_REPO_ROOT, repo)) {
    // 自 repo（ENBISOU 本体）は既定で常に拒否。generic allowlist では解除しない。
    // Decision 120 決定 10: consumePermit が発行した opaque capability があり、全 binding が一致する 1 操作だけ解除する
    if (cap === undefined || cap === null || !wc.samePath(repo, SELF_REPO_ROOT)) return { ok: false, kind: 'worktreeAdd', error: 'repo_protected' };
    if (!permitMod.isGenuineCapability(cap)) return { ok: false, kind: 'worktreeAdd', error: 'capability_invalid' };
    var bindOk = cap.operation === permitMod.OPERATION && wc.samePath(cap.repoPath, repo)
      && cap.expectedHead === a[7] && cap.expectedHead === plan.baseHead
      && cap.expectedOriginMain === cap.expectedHead && cap.expectedOriginMain === plan.originMainAtStart
      && cap.taskId === taskId && cap.branch === a[5] && wc.samePath(cap.worktreePath, wt);
    if (!bindOk) return { ok: false, kind: 'worktreeAdd', error: 'capability_binding_mismatch' };
    if (!permitMod.redeemCapability(cap)) return { ok: false, kind: 'worktreeAdd', error: 'capability_already_used' };   // 以後この capability は使えない
    return _exec('worktreeAdd', a, repo, o);
  }
  if (cap !== undefined && cap !== null) return { ok: false, kind: 'worktreeAdd', error: 'capability_unexpected' };   // temp repo に capability は不要
  var allow = Array.isArray(o.mutationRepoAllowlist) ? o.mutationRepoAllowlist : [];
  if (!allow.some(function (r) { return wc.samePath(r, repo); })) return { ok: false, kind: 'worktreeAdd', error: 'repo_not_allowlisted_for_mutation' };
  return _exec('worktreeAdd', a, repo, o);
}

module.exports = {
  DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
  KIND_NAMES: Object.freeze(Object.keys(KINDS)),
  SELF_REPO_ROOT: SELF_REPO_ROOT,
  GIT_FIXED_ENV: GIT_FIXED_ENV,
  buildGitChildEnv: buildGitChildEnv,
  runGitReadOnly: runGitReadOnly,
  validateGitAvailable: validateGitAvailable,
  readRepoState: readRepoState,
  readWorktreeState: readWorktreeState,
  readRepoIdentity: readRepoIdentity,
  listEnvFiles: listEnvFiles,
  detectActiveHooks: detectActiveHooks,
  inspectTargetPath: inspectTargetPath,
  executeWorktreeCreate: executeWorktreeCreate,
};
