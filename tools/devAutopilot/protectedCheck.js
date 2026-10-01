'use strict';
// tools/devAutopilot/protectedCheck.js
// Development Autopilot V1 — Stage 4E：test 用 Protected 検証 helper（main repo / 隔離 worktree の両方で使う・read-only）
//
//   ★ 実行場所の判定は .git の構造だけで行う（環境変数・引数で検査を無効化 / 切替できる入口は作らない）。
//     main：<root>/.git が directory（HEAD file あり）。
//     worktree：<root>/.git が「gitdir: <common>/.git/worktrees/<name>」の file で、その gitdir の gitdir file が <root>/.git を指し返し、
//               commondir から求めた共通 .git が directory であること。それ以外・読めない場合は unknown（検証失敗）。
//   ★ main：Protected 10件の md5 が固定基準と開始時・終了時とも一致（従来の検証と同じ）。
//   ★ worktree：
//     ・main 側（.git から求めた main root）の Protected 10件も固定基準と開始時・終了時とも一致（main 側の固定基準検証は維持）。
//     ・worktree 側は「HEAD で tracked の Protected は存在して読めること・開始時と終了時で同じ内容」「untracked の Protected は存在しないこと」。
//       tracked / untracked の区別は git ls-files で確認済みの固定一覧（TRACKED_PROTECTED）。一覧と実物が合わなければ失敗（欠落を正常扱いしない）。
//   ★ Protected を copy・作成・変更しない。読取不能・link・特殊 file は失敗。

var path = require('path');
var fs = require('fs');
var crypto = require('crypto');

var PROTECTED_PATHS = Object.freeze(['cost-logs.json', 'data/conversations/_meta.json', 'claude-cost-logs.json', 'claude-quality-history.json',
  'backup-dup-candidates-20260714/dup-candidates-123.csv', 'backup-dup-candidates-20260714/dup-candidates-123.json',
  'data/conversations/user-cont-1_line_web.json', 'data/conversations/user-cont-2_line_estimate.json',
  'data/conversations/user-cont-3_line_leader.json', 'data/conversations/user-cont-4_line_video.json']);
// HEAD で tracked の Protected（2026-10-01 に git ls-files で確認）。それ以外の 8件は untracked（worktree には存在しないはず）
var TRACKED_PROTECTED = Object.freeze(['cost-logs.json', 'data/conversations/_meta.json']);
var MD5_RE = /^[0-9a-f]{32}$/;
var MAX_GIT_FILE = 4096;

function _md5(b) { return crypto.createHash('md5').update(b).digest('hex'); }
function _same(a, b) { return path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase(); }
function _readSmall(fsx, p) {
  var st = fsx.lstatSync(p);
  if (!st.isFile() || st.isSymbolicLink() || st.size > MAX_GIT_FILE) return null;
  return String(fsx.readFileSync(p, 'utf8'));
}

// 実行場所の判定（.git の構造だけ）
function detectLayout(root, opts) {
  var fsx = (opts && opts.fs) || fs;
  var dotGit = path.join(root, '.git'), st;
  try { st = fsx.lstatSync(dotGit); } catch (e) { return { mode: 'unknown', reason: 'dot_git_missing' }; }
  try {
    if (st.isSymbolicLink()) return { mode: 'unknown', reason: 'dot_git_link' };
    if (st.isDirectory()) {
      var h = fsx.lstatSync(path.join(dotGit, 'HEAD'));
      return h.isFile() ? { mode: 'main', mainRoot: path.resolve(root) } : { mode: 'unknown', reason: 'head_missing' };
    }
    if (!st.isFile()) return { mode: 'unknown', reason: 'dot_git_special' };
    var txt = _readSmall(fsx, dotGit);
    var m = txt && /^gitdir: (.+?)\s*$/.exec(txt.split(/\r?\n/)[0]);
    if (!m) return { mode: 'unknown', reason: 'gitdir_unparsed' };
    var gitdir = path.resolve(root, m[1]);
    if (path.basename(path.dirname(gitdir)).toLowerCase() !== 'worktrees') return { mode: 'unknown', reason: 'not_linked_worktree' };
    var back = _readSmall(fsx, path.join(gitdir, 'gitdir'));
    if (!back || !_same(back.trim(), dotGit)) return { mode: 'unknown', reason: 'gitdir_backlink_mismatch' };
    var cd = _readSmall(fsx, path.join(gitdir, 'commondir'));
    if (!cd) return { mode: 'unknown', reason: 'commondir_missing' };
    var common = path.resolve(gitdir, cd.trim());
    var cst = fsx.lstatSync(common);
    if (!cst.isDirectory() || cst.isSymbolicLink() || path.basename(common).toLowerCase() !== '.git' || !_same(path.dirname(gitdir), path.join(common, 'worktrees'))) return { mode: 'unknown', reason: 'common_dir_invalid' };
    return { mode: 'worktree', mainRoot: path.dirname(common), worktreeRoot: path.resolve(root) };
  } catch (e) { return { mode: 'unknown', reason: 'layout_unreadable' }; }
}

// Protected 10件の状態：md5 / 'absent' / 'unreadable:<code>' / 'not_regular'
function hashProtected(root, opts) {
  var fsx = (opts && opts.fs) || fs;
  var out = {};
  PROTECTED_PATHS.forEach(function (f) {
    var p = path.join(root, f), st;
    try { st = fsx.lstatSync(p); } catch (e) { out[f] = e && e.code === 'ENOENT' ? 'absent' : 'unreadable:' + ((e && e.code) || 'error'); return; }
    if (!st.isFile() || st.isSymbolicLink()) { out[f] = 'not_regular'; return; }
    try { out[f] = _md5(fsx.readFileSync(p)); } catch (e) { out[f] = 'unreadable:' + ((e && e.code) || 'error'); }
  });
  return out;
}

// 開始時・終了時に同じ関数で取る snapshot
function snapshot(root, opts) {
  var layout = detectLayout(root, opts);
  return { layout: layout, root: hashProtected(root, opts), main: layout.mode === 'worktree' ? hashProtected(layout.mainRoot, opts) : null };
}

// 検証（baseline は main の固定基準 { path: md5 }）
function verify(before, after, baseline) {
  var r = [];
  if (!before || !after || !before.layout || !after.layout) return { ok: false, mode: 'unknown', reasons: ['snapshot_missing'] };
  var mode = before.layout.mode;
  if (mode !== after.layout.mode || before.layout.mainRoot !== after.layout.mainRoot) r.push('layout_changed');
  if (!baseline || PROTECTED_PATHS.some(function (f) { return typeof baseline[f] !== 'string' || !MD5_RE.test(baseline[f]); })) r.push('baseline_invalid');
  if (mode === 'main') {
    PROTECTED_PATHS.forEach(function (f) { if (before.root[f] !== baseline[f] || after.root[f] !== baseline[f]) r.push('main_mismatch:' + f); });
  } else if (mode === 'worktree') {
    PROTECTED_PATHS.forEach(function (f) {
      if (!before.main || !after.main || before.main[f] !== baseline[f] || after.main[f] !== baseline[f]) r.push('main_mismatch:' + f);
      var b = before.root[f], a = after.root[f];
      if (TRACKED_PROTECTED.indexOf(f) !== -1) { if (!MD5_RE.test(String(b)) || a !== b) r.push('worktree_tracked_missing_or_changed:' + f); }
      else if (b !== 'absent' || a !== 'absent') r.push('worktree_untracked_present_or_unreadable:' + f);
    });
  } else r.push('layout_unknown:' + (before.layout.reason || 'unknown'));
  return { ok: r.length === 0, mode: mode, reasons: r.slice(0, 20) };
}

// Protected fingerprint（`md5sum <10 files> | md5sum | cut -c1-12` と同じ式）。md5 でない値があれば null
function fingerprint(map) {
  if (!map || PROTECTED_PATHS.some(function (f) { return !MD5_RE.test(String(map[f])); })) return null;
  return _md5(PROTECTED_PATHS.map(function (f) { return map[f] + ' *' + f + '\n'; }).join('')).slice(0, 12);
}

module.exports = { PROTECTED_PATHS: PROTECTED_PATHS, TRACKED_PROTECTED: TRACKED_PROTECTED, detectLayout: detectLayout, hashProtected: hashProtected,
  snapshot: snapshot, verify: verify, fingerprint: fingerprint };
