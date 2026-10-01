'use strict';
// tools/devAutopilot/observers.js
// Development Autopilot V1 — Stage 4D：本物の観測関数（read-only）
//   observeMain / observeWorktree / readTranscript / hashFile ＋ worktree 内 Protected の snapshot
//
//   ★ Git は worktreeExecutor の read-only kind だけ（shell:false・env allowlist・GIT_CONFIG_GLOBAL=NUL）。書込みはしない。
//   ★ fs は読み取りだけ（lstat / readdir / read）。symlink・junction・特殊 file は観測不能として null を返す（fail-closed）。
//   ★ 観測できない・判定できない値は null（呼び出し側 = claudeExecutor / orchestrator が起動前・完了時に拒否 / 未検証にする）。
//   ★ 本文を返すのは readTranscript だけ（呼び出し側が限定解析し、保存しない）。
//   ★ deps（exe・fs）は差し替え可能（safe テストでは偽物を使う）。既定は本物の worktreeExecutor / fs。

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');
var rc = require('./riskClassifier');

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
var HEAD_RE = /^[0-9a-f]{40}$/;
var MAX_TRANSCRIPT_BYTES = 8 * 1024 * 1024;
var MAX_ENTRY_BYTES = 16 * 1024 * 1024;
var CHUNK = 1024 * 1024;

function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _md5(b) { return crypto.createHash('md5').update(b).digest('hex'); }
function _relOk(p) { return typeof p === 'string' && p.length > 0 && p.length <= 400 && !/[\\\u0000-\u001f]/.test(p) && !/^([A-Za-z]:|\/)/.test(p) && p.split('/').every(function (s) { return s && s !== '.' && s !== '..'; }); }

// porcelain v1 -z の解析。不正・判定不能なら null
function parsePorcelainZ(out) {
  if (typeof out !== 'string') return null;
  var tok = out.split('\u0000');
  if (tok.length && tok[tok.length - 1] === '') tok.pop();
  var res = [];
  for (var i = 0; i < tok.length; i++) {
    var t = tok[i];
    if (t.length < 4 || t.charAt(2) !== ' ') return null;
    var xy = t.slice(0, 2), p = t.slice(3), status;
    if (xy === '??') status = 'untracked';
    else if (xy === '!!') return null;
    else if (xy.indexOf('D') !== -1) status = 'deleted';
    else if (xy.charAt(0) === 'R' || xy.charAt(0) === 'C') { status = 'renamed'; i++; if (i >= tok.length) return null; }
    else if (xy.indexOf('A') !== -1) status = 'added';
    else status = 'modified';
    if (!_relOk(p)) return null;
    res.push({ path: p, status: status });
  }
  return res;
}

// cfg: { repoPath, homeDir, exe?, fs?, gitOpts? }
function createObservers(cfg) {
  var c = _isObj(cfg) ? cfg : {};
  var exe = c.exe || require('./worktreeExecutor');
  var fsx = c.fs || fs;
  var repoPath = c.repoPath, gitOpts = c.gitOpts;

  function hashFile(p) {
    var st = fsx.lstatSync(p);
    if (!st.isFile() || st.isSymbolicLink()) throw new Error('not_regular_file');
    var h = crypto.createHash('sha256'), fd = fsx.openSync(p, 'r'), buf = Buffer.alloc(CHUNK), n;
    try { while ((n = fsx.readSync(fd, buf, 0, CHUNK, null)) > 0) h.update(n === CHUNK ? buf : buf.subarray(0, n)); }
    finally { fsx.closeSync(fd); }
    return h.digest('hex');
  }
  function _readRegular(p, max) {
    var st = fsx.lstatSync(p);
    if (!st.isFile() || st.isSymbolicLink() || st.size > max) return null;
    return fsx.readFileSync(p);
  }
  // Protected の md5（main 側の固定基準。run 作成時の protectedMd5AtStart・観測時の fingerprint）
  function protectedMd5Map(root) {
    var m = {};
    for (var k = 0; k < rc.PROTECTED_PATHS.length; k++) {
      var f = rc.PROTECTED_PATHS[k], b;
      try { b = _readRegular(path.join(root, f), MAX_ENTRY_BYTES); } catch (e) { return null; }
      if (!b) return null;
      m[f] = _md5(b);
    }
    return m;
  }
  function observeMain() {
    var st = exe.readRepoState(repoPath, gitOpts);
    if (!st || !st.ok) return null;
    var m = protectedMd5Map(repoPath);
    if (!m) return null;
    var fp = _md5(rc.PROTECTED_PATHS.map(function (f) { return m[f] + ' *' + f + '\n'; }).join('')).slice(0, 12);
    var om = exe.runGitReadOnly('originMain', { dir: repoPath }, gitOpts);
    return { autopilotStatusHash: st.autopilotStatusHash, protectedFingerprint: fp, head: st.head, currentBranch: st.currentBranch, stagedCount: st.stagedCount,
      originMain: om.ok && HEAD_RE.test(om.stdout.trim()) ? om.stdout.trim() : null };
  }
  function observeWorktree(run) {
    try {
      var wt = run.worktreePath;
      var top = exe.runGitReadOnly('showToplevel', { dir: wt }, gitOpts);
      var head = exe.runGitReadOnly('revParseHead', { dir: wt }, gitOpts);
      var sym = exe.runGitReadOnly('symbolicHead', { dir: wt }, gitOpts);
      var st = exe.runGitReadOnly('statusPorcelainZ', { dir: wt }, gitOpts);
      var tip = exe.runGitReadOnly('verifyDevRef', { dir: run.mainRepoPath, ref: 'refs/heads/' + run.branch }, gitOpts);
      if (![top, head, sym, st, tip].every(function (r) { return r && r.ok; })) return null;
      var entries = parsePorcelainZ(st.stdout);
      if (!entries) return null;
      var changed = [];
      for (var k = 0; k < entries.length; k++) {
        var x = entries[k], abs = path.join(wt, x.path), hash = null, isLink = false;
        if (x.status !== 'deleted') {
          var ls = fsx.lstatSync(abs);
          if (ls.isSymbolicLink()) isLink = true;
          else if (ls.isFile()) { if (ls.size > MAX_ENTRY_BYTES) return null; hash = hashFile(abs); }
          else return null;   // directory・特殊 file は判定不能
        }
        changed.push({ path: x.path, status: x.status, hash: hash, isSymlink: isLink });
      }
      var gitFile = _readRegular(path.join(wt, '.git'), 64 * 1024);
      if (!gitFile) return null;   // worktree の .git は file（directory・link は想定外）
      return { worktreePath: path.win32.normalize(top.stdout.trim()), worktreeHead: head.stdout.trim(), branchTip: tip.stdout.trim(), worktreeBranchRef: sym.stdout.trim(),
        changedEntries: changed, gitFileHash: crypto.createHash('sha256').update(gitFile).digest('hex') };
    } catch (e) { return null; }
  }
  // worktree 内 Protected の snapshot：HEAD で tracked のものは存在すること・untracked のものは存在しないこと（欠落を無条件に正常扱いしない）
  function worktreeProtectedSnapshot(run) {
    try {
      var ls = exe.runGitReadOnly('lsFilesZ', { dir: run.worktreePath }, gitOpts);
      if (!ls || !ls.ok) return { ok: false, reasons: ['tracked_list_unavailable'] };
      var tracked = {};
      ls.stdout.split('\u0000').forEach(function (p) { if (p) tracked[p] = true; });
      var entries = {}, reasons = [];
      rc.PROTECTED_PATHS.forEach(function (f) {
        var abs = path.join(run.worktreePath, f), b = null, exists = true;
        try { b = _readRegular(abs, MAX_ENTRY_BYTES); } catch (e) { if (e && e.code === 'ENOENT') exists = false; else reasons.push('unreadable:' + f); }
        if (exists && !b) reasons.push('not_regular:' + f);
        entries[f] = exists && b ? _md5(b) : 'absent';
        if (tracked[f] && entries[f] === 'absent') reasons.push('tracked_protected_missing:' + f);
        if (!tracked[f] && entries[f] !== 'absent') reasons.push('untracked_protected_present:' + f);
      });
      return reasons.length ? { ok: false, reasons: reasons } : { ok: true, entries: entries };
    } catch (e) { return { ok: false, reasons: ['snapshot_failed'] }; }
  }
  // 当該 session の transcript 1 件だけ（候補が 0 件・複数・link・大きすぎる場合は null）
  function readTranscript(sessionId) {
    if (typeof sessionId !== 'string' || !UUID_RE.test(sessionId) || typeof c.homeDir !== 'string' || !path.isAbsolute(c.homeDir)) return null;
    try {
      var base = path.join(c.homeDir, '.claude', 'projects');
      var hits = [];
      fsx.readdirSync(base).forEach(function (d) {
        var f = path.join(base, d, sessionId + '.jsonl');
        try { var st = fsx.lstatSync(f); if (st.isFile() && !st.isSymbolicLink()) hits.push(f); } catch (e) { /* 無い */ }
      });
      if (hits.length !== 1) return null;
      var b = _readRegular(hits[0], MAX_TRANSCRIPT_BYTES);
      return b ? String(b) : null;
    } catch (e) { return null; }
  }
  return { observeMain: observeMain, observeWorktree: observeWorktree, worktreeProtectedSnapshot: worktreeProtectedSnapshot, readTranscript: readTranscript,
    hashFile: hashFile, protectedMd5Map: protectedMd5Map };
}

module.exports = { createObservers: createObservers, parsePorcelainZ: parsePorcelainZ };
