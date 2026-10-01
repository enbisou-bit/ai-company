'use strict';
// devAutopilotStep3CPrep.test.js
// Development Autopilot V1 — Step 3C Preparation（Explicit Real Repo Permit / Canonical Status Hash / executor の自 repo guard）の test。
//
//   ★ 実行は必ずこのファイル名を明示指定する（node devAutopilotStep3CPrep.test.js）。
//   ★ Git の mutation は 0。本物の repo へは read-only Git（--no-optional-locks）だけ。
//   ★ fs write は OS temp に作った自己所有 sandbox（owner marker 付き）の内側だけ。Permit file もその中にだけ作る。
//     本物の Permit root（C:\Users\hp\ENBISOU_AI\.autopilot\permits）は作らない。
//   ★ 本物の repo に対する executor guard の検証は Git 実行を spy に差し替えて行う。さらに多重防御として、
//     baseHead には本物の repo に存在しない SHA を、worktree 先には sandbox 内の path を使う（spy が効かなくても mutation は起きない）。
//   ★ network / 危険 module / .env 読込は冒頭で封鎖。process.env は変更しない。env の値・raw remote URL は log に出さない。

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');
const cp = require('child_process');

const ROOT = __dirname;
const violations = [];

const PROTECTED_FILES = ['cost-logs.json', 'data/conversations/_meta.json', 'claude-cost-logs.json', 'claude-quality-history.json',
  'backup-dup-candidates-20260714/dup-candidates-123.csv', 'backup-dup-candidates-20260714/dup-candidates-123.json',
  'data/conversations/user-cont-1_line_web.json', 'data/conversations/user-cont-2_line_estimate.json',
  'data/conversations/user-cont-3_line_leader.json', 'data/conversations/user-cont-4_line_video.json'];
function md5(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }
// 実行場所（main / 隔離 worktree）は .git の構造だけで判定する（環境変数では切り替えない）。
//   固定基準（fingerprint d1fd4bd36f69）の検証は常に main 側で行い、worktree で実行した場合は worktree 側の Protected も別に検証する
const pc = require('./tools/devAutopilot/protectedCheck');
const LAYOUT = pc.detectLayout(ROOT);
const MAIN_ROOT = LAYOUT.mode === 'worktree' ? LAYOUT.mainRoot : ROOT;
function protectedFingerprint() {
  try { return md5(PROTECTED_FILES.map(function (f) { return md5(fs.readFileSync(path.join(MAIN_ROOT, f))) + ' *' + f + '\n'; }).join('')).slice(0, 12); }
  catch (e) { return 'unreadable:' + e.code; }
}
const fpBefore = protectedFingerprint();
const protectedSnapBefore = pc.snapshot(ROOT);
// Z-54: 本物の .autopilot（Permit root・Step 3C の audit artifact を含む）をこのテストが変更しないことの snapshot。
//   監視範囲は <repo の親>\.autopilot 配下全体。Step 3C 以降は consumed Permit 等が意図的に残置されているため「存在しないこと」は前提にしない。
//   比較するのは相対 path・種別・size・内容の sha256 だけ（Permit 本文は出力しない）。atime / mtime は同一性の条件にしない。
//   link / junction・特殊ファイル・読取失敗は「変更なし」とみなさず snapshot 失敗（ok:false）とする。
//   worktree で実行した場合、監視先は main の親の .autopilot（worktree 自身 = 実行中の test の作業場所は除外し、差分は git status で検証する）
const REAL_AUTOPILOT_ROOT = path.join(path.dirname(MAIN_ROOT), '.autopilot');
const SNAPSHOT_EXCLUDE = LAYOUT.mode === 'worktree' ? path.resolve(ROOT).toLowerCase() : null;
function snapshotTree(root) {
  const res = { ok: true, exists: false, entries: [], errors: [] };
  let st;
  try { st = fs.lstatSync(root); } catch (e) { return e.code === 'ENOENT' ? res : { ok: false, exists: null, entries: [], errors: ['lstat_root:' + e.code] }; }
  res.exists = true;
  if (st.isSymbolicLink() || !st.isDirectory()) return { ok: false, exists: true, entries: [], errors: ['root_not_plain_directory'] };
  try { if (fs.realpathSync.native(root).toLowerCase() !== path.resolve(root).toLowerCase()) return { ok: false, exists: true, entries: [], errors: ['root_realpath_mismatch'] }; }
  catch (e) { return { ok: false, exists: true, entries: [], errors: ['realpath_root:' + e.code] }; }
  (function walk(dir, rel) {
    let names;
    try { names = fs.readdirSync(dir).sort(); } catch (e) { res.ok = false; res.errors.push('readdir:' + (rel || '.') + ':' + e.code); return; }
    names.forEach(function (n) {
      const p = path.join(dir, n), r = rel ? rel + '/' + n : n;
      let s;
      try { s = fs.lstatSync(p); } catch (e) { res.ok = false; res.errors.push('lstat:' + r + ':' + e.code); return; }
      if (s.isSymbolicLink()) { res.ok = false; res.errors.push('link:' + r); return; }
      if (s.isDirectory()) { res.entries.push({ path: r, type: 'dir' }); if (SNAPSHOT_EXCLUDE !== null && path.resolve(p).toLowerCase() === SNAPSHOT_EXCLUDE) return; walk(p, r); return; }
      if (!s.isFile()) { res.ok = false; res.errors.push('special:' + r); return; }
      let h;
      try { h = crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } catch (e) { res.ok = false; res.errors.push('read:' + r + ':' + String(e.code || 'blocked')); return; }
      res.entries.push({ path: r, type: 'file', size: s.size, sha256: h });
    });
  })(root, '');
  return res;
}
function sameTree(a, b) { return a.ok && b.ok && a.exists === b.exists && JSON.stringify(a.entries) === JSON.stringify(b.entries); }
const autopilotBefore = snapshotTree(REAL_AUTOPILOT_ROOT);

// ── OS temp の自己所有 sandbox（blocker 導入前に作成）──
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'devAutopilotStep3CPrep-'));
const OWNER_MARKER = '.devautopilot-sandbox-owner';
const OWNER_TOKEN = crypto.randomBytes(16).toString('hex');
fs.writeFileSync(path.join(SANDBOX, OWNER_MARKER), OWNER_TOKEN);
const ORIG_RM = fs.rmSync;
function insideDir(p, dir) {
  const rel = path.relative(String(dir).toLowerCase(), path.resolve(String(p)).toLowerCase());
  return rel === '' || (!!rel && rel.split(/[\\\/]/)[0] !== '..' && !path.isAbsolute(rel));
}
function insideSandbox(p) { return (typeof p === 'string' || p instanceof URL) && insideDir(String(p), SANDBOX); }

// ── sandbox（network / env file / fs write / module）──
function blockedNetwork(name) { return function () { violations.push('network:' + name); throw new Error('SANDBOX_BLOCKED_NETWORK:' + name); }; }
['http', 'https'].forEach(function (m) { const mod = require(m); mod.request = blockedNetwork(m + '.request'); mod.get = blockedNetwork(m + '.get'); });
{ const net = require('net'); net.connect = blockedNetwork('net.connect'); net.createConnection = blockedNetwork('net.createConnection'); const tls = require('tls'); tls.connect = blockedNetwork('tls.connect'); }
globalThis.fetch = blockedNetwork('fetch');
function isEnvFile(p) { try { return /^\.env(\..*)?$/i.test(path.basename(String(p))); } catch (e) { return false; } }
['readFileSync', 'readFile', 'createReadStream'].forEach(function (n) {
  const orig = fs[n]; if (typeof orig !== 'function') return;
  fs[n] = function (p) { if (isEnvFile(p)) { violations.push('env_file_read:' + n); throw new Error('SANDBOX_BLOCKED_ENV_READ'); } return orig.apply(this, arguments); };
});
function guardedWrite(name, orig) {
  return function (a, b) {
    const two = /rename|copy|symlink|cp/i.test(name);
    if (insideSandbox(a) && (!two || insideSandbox(b))) return orig.apply(this, arguments);
    violations.push('fs_write:' + name + ':' + String(a));
    throw new Error('SANDBOX_BLOCKED_FS_WRITE:' + name);
  };
}
['writeFileSync', 'appendFileSync', 'renameSync', 'unlinkSync', 'mkdirSync', 'rmSync', 'rmdirSync', 'copyFileSync', 'truncateSync',
  'symlinkSync', 'cpSync', 'writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir', 'copyFile', 'truncate', 'createWriteStream']
  .forEach(function (n) { if (typeof fs[n] === 'function') fs[n] = guardedWrite('fs.' + n, fs[n]); });
const BLOCKED_BARE = new Set(['axios', 'dotenv', '@supabase/supabase-js', '@anthropic-ai/sdk', 'http2', 'undici', 'node:http2']);
const BLOCKED_FILES = new Set(['openaiClient.js', 'claudeClient.js', 'costTracker.js', 'lib/costDb.js', 'conversationHistory.js', 'server.js', 'lib/supabase.js', 'lib/outputDraftsDb.js']
  .map(function (p) { return path.join(ROOT, p); }));
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (BLOCKED_BARE.has(request)) { violations.push('module:' + request); throw new Error('SANDBOX_BLOCKED_MODULE:' + request); }
  let filename = null;
  try { filename = Module._resolveFilename(request, parent, isMain); } catch (e) { filename = null; }
  if (filename && BLOCKED_FILES.has(filename)) { violations.push('module:' + path.relative(ROOT, filename)); throw new Error('SANDBOX_BLOCKED_MODULE:' + request); }
  return origLoad.apply(this, arguments);
};
const envKeysBefore = JSON.stringify(Object.keys(process.env).sort());

let _passed = 0, _failed = 0;
function assert(cond, label) { if (cond) { _passed++; console.log('  ✅ ' + label); } else { _failed++; console.log('  ❌ ' + label); } }
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }
function hasErr(r, code) { return !!r && Array.isArray(r.errors) && r.errors.indexOf(code) !== -1; }

const wc = require('./tools/devAutopilot/worktreeController');
const exe = require('./tools/devAutopilot/worktreeExecutor');
const pm = require('./tools/devAutopilot/realRepoPermit');
const rs = require('./tools/devAutopilot/runStore');

// test 自身の read-only Git（executor と同じ env）
function gitRead(args) {
  return cp.execFileSync('git', ['--no-optional-locks', '-C', ROOT].concat(args),
    { cwd: ROOT, env: exe.buildGitChildEnv(process.env).env, shell: false, windowsHide: true, timeout: 15000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function realSnapshot() {
  const st = exe.readRepoState(ROOT);
  // worktree で実行した場合は main repo の状態も read-only で取る（main 側の不変も検証する）
  const mainSt = LAYOUT.mode === 'worktree' ? exe.readRepoState(MAIN_ROOT) : null;
  return { st: st, mainSt: mainSt, origin: gitRead(['rev-parse', 'origin/main']).trim(), fp: protectedFingerprint() };
}
function cleanupSandbox(p) {
  if (typeof p !== 'string' || path.resolve(p).toLowerCase() !== path.resolve(SANDBOX).toLowerCase()) return { ok: false, error: 'not_exact_sandbox' };
  if (!insideDir(p, os.tmpdir()) || path.resolve(p).toLowerCase() === path.resolve(os.tmpdir()).toLowerCase()) return { ok: false, error: 'not_under_os_temp' };
  if (insideDir(p, ROOT) || insideDir(ROOT, p)) return { ok: false, error: 'related_to_real_repo' };
  let token = null;
  try { token = fs.readFileSync(path.join(p, OWNER_MARKER), 'utf8'); } catch (e) { return { ok: false, error: 'owner_marker_missing' }; }
  if (token !== OWNER_TOKEN) return { ok: false, error: 'owner_marker_mismatch' };
  try { ORIG_RM(p, { recursive: true, force: true, maxRetries: 3 }); } catch (e) { return { ok: false, error: 'rm_failed:' + e.code }; }
  let gone = false; try { fs.statSync(p); } catch (e) { gone = e.code === 'ENOENT'; }
  return gone ? { ok: true } : { ok: false, error: 'residue' };
}

const NOW = '2026-09-29T00:00:00.000Z';
function at(min) { return new Date(Date.parse(NOW) + min * 60000).toISOString(); }
const FAKE_HEAD = '1111111111111111111111111111111111111111';   // 本物の repo に存在しない SHA（多重防御）
const OTHER_HEAD = '2222222222222222222222222222222222222222';
const PERMIT_ROOT = path.join(SANDBOX, 'permits');
const WT_ROOT = path.join(SANDBOX, 'wt');
const STORE = { root: PERMIT_ROOT, repoPath: ROOT };

let realBefore = null;
const collected = [];   // secret / raw URL の漏洩確認用に result を集める

(function main() {
  try {
    caseHeader('0. 前提');
    realBefore = realSnapshot();
    assert(realBefore.st.ok && realBefore.fp === 'd1fd4bd36f69', '0-1. 本物の repo を read-only 実測（Protected ' + realBefore.fp + '）');
    assert(LAYOUT.mode === 'main' || (LAYOUT.mode === 'worktree' && realBefore.mainSt && realBefore.mainSt.ok), '0-1b. 実行場所を .git の構造で判定（' + LAYOUT.mode + '）・不明なら失敗');
    assert(!insideDir(SANDBOX, ROOT) && insideDir(SANDBOX, os.tmpdir()), '0-2. sandbox は OS temp 配下で本物の repo の外');

    caseHeader('H. Canonical Status Hash');
    const st = realBefore.st;
    const autoOut = gitRead(['status', '--short', '--untracked-files=all']);
    const dispOut = gitRead(['status', '--short']);
    assert(/^[0-9a-f]{12}$/.test(st.autopilotStatusHash) && st.autopilotStatusHash === md5(autoOut).slice(0, 12), 'H-43. autopilotStatusHash は `status --short --untracked-files=all` の md5 先頭12文字（' + st.autopilotStatusHash + '）');
    assert(/^[0-9a-f]{12}$/.test(st.displayStatusHash) && st.displayStatusHash === md5(dispOut).slice(0, 12), 'H-44. displayStatusHash は `status --short` の md5 先頭12文字（' + st.displayStatusHash + '）');
    const hasUntrackedDir = dispOut.split(/\r?\n/).some(function (l) { return /^\?\? .+\/$/.test(l); });
    assert(!hasUntrackedDir || st.autopilotStatusHash !== st.displayStatusHash, 'H-45. untracked ディレクトリがある場合は両者が異なる（untracked dir ' + (hasUntrackedDir ? 'あり' : 'なし') + '）');
    assert(!('statusHash' in st), 'H-47. executor の結果に曖昧な statusHash は無い');

    caseHeader('I. Repo Identity（read-only・raw remote を出さない）');
    const idr = exe.readRepoIdentity(ROOT);
    collected.push(idr);
    const REAL_ID = idr.repoIdentity;
    assert(idr.ok && wc.samePath(REAL_ID.repoPath, ROOT) && /^[0-9a-f]{40}$/.test(REAL_ID.rootCommit) && wc.samePath(REAL_ID.gitCommonDir, path.join(ROOT, '.git')),
      'I-1. repoPath / gitCommonDir / rootCommit を取得');
    assert(typeof REAL_ID.remoteIdentity === 'string' && !/[@?#]|:\/\//.test(REAL_ID.remoteIdentity) && !/\.git$/.test(REAL_ID.remoteIdentity), 'I-2. remoteIdentity は credential-free（scheme / @ / query / .git なし）');
    assert(JSON.stringify(idr).indexOf('://') === -1, 'I-3. readRepoIdentity の結果に raw remote URL を含めない');
    assert(exe.KIND_NAMES.indexOf('originUrl') === -1 && exe.runGitReadOnly('originUrl', { dir: ROOT }).error === 'kind_not_allowed', 'I-4. raw remote を返す public kind は無い');
    assert(!exe.readRepoIdentity('relative\\path').ok, 'I-5. 不正 path は拒否');

    caseHeader('R. Remote canonicalization');
    {
      const c = pm.canonicalizeRemote;
      assert(c('https://github.com/Enbisou-Bit/ai-company.git').identity === 'github.com/Enbisou-Bit/ai-company' && c('https://GitHub.COM/o/r').identity === 'github.com/o/r', 'R-15. clean HTTPS を正規化（host 小文字化）');
      assert(c('ssh://git@github.com/owner/repo.git').identity === 'github.com/owner/repo' && c('ssh://git@host.example:2222/owner/repo').identity === 'host.example:2222/owner/repo', 'R-16. clean SSH を正規化（transport user は含めない・port 保持）');
      assert(c('git@github.com:owner/repo.git').identity === 'github.com/owner/repo', 'R-17. SCP-like を正規化');
      assert(c('https://github.com/o/r.git').identity === c('https://github.com/o/r').identity && c('git@github.com:o/r.git').identity === c('https://github.com/o/r/').identity, 'R-18. `.git` / 末尾 slash を正規化');
      const creds = [c('https://user:tok3nSECRET@github.com/o/r.git'), c('https://tok3nSECRET@github.com/o/r'), c('ssh://git:tok3nSECRET@host/o/r'), c('http://user:tok3nSECRET@host/o/r')];
      collected.push.apply(collected, creds);
      assert(creds.every(function (r) { return !r.ok && r.error === 'remote_credentials_embedded'; }), 'R-19. credential 埋め込み（https / http / ssh password）→ fail-closed');
      const qf = [c('https://github.com/o/r?token=tok3nSECRET'), c('https://github.com/o/r#tok3nSECRET')];
      collected.push.apply(collected, qf);
      assert(qf.every(function (r) { return !r.ok && r.error === 'remote_query_or_fragment'; }), 'R-20. query / fragment → blocked');
      const bad = ['', '   ', 'not a url', 'C:\\repo', 'file:///C:/repo', '/local/path', 'https://github.com/../x', 'https://github.com/%2e%2e/x', 'https://github.com/o/./r', 'git@host:../r', 'https://github.com\\o\\r', 'git@host:', 'git@host:o/r extra', 'ftp://host/o/r', null, 'https://host/o/r\u0000'];
      assert(bad.every(function (x) { return c(x).ok === false; }), 'R-21. malformed / local / 非対応 scheme → blocked');
      assert(collected.every(function (r) { return JSON.stringify(r).indexOf('tok3nSECRET') === -1 && JSON.stringify(r).indexOf('user:') === -1; }), 'R-22. result / error に raw remote・credential を含めない');
    }

    // ── Permit fixture（本物の repo identity に束縛・保存先は sandbox）──
    fs.mkdirSync(PERMIT_ROOT);
    function input(extra) {
      return Object.assign({
        repoIdentity: Object.assign({}, REAL_ID), expectedHead: FAKE_HEAD, expectedOriginMain: FAKE_HEAD, taskId: 'prep-3c-001', worktreeRoot: WT_ROOT,
        protectedFingerprint: 'd1fd4bd36f69', autopilotStatusHash: st.autopilotStatusHash, approvedBy: 'human', approvedAt: NOW, ttlMs: 10 * 60000, now: NOW,
      }, extra || {});
    }
    function liveFor(permit, extra) {
      return Object.assign({
        repoIdentity: Object.assign({}, permit.repoIdentity), currentHead: permit.expectedHead, currentOriginMain: permit.expectedOriginMain,
        taskId: permit.taskId, branch: permit.branch, worktreePath: permit.worktreePath,
        protectedFingerprint: permit.protectedFingerprint, autopilotStatusHash: permit.autopilotStatusHash,
      }, extra || {});
    }
    function mut(permit, patch) { return Object.assign(JSON.parse(JSON.stringify(permit)), patch); }

    caseHeader('S. Permit Schema / Binding');
    const good = pm.buildPermit(input());
    const P = good.permit;
    assert(good.ok && P.decisionRef === 'Decision 120' && P.mode === 'controlled_real_repo_trial' && P.operation === 'worktree_add' && P.branch === 'dev/prep-3c-001'
      && wc.samePath(P.worktreePath, path.join(WT_ROOT, 'prep-3c-001')) && P.consumed === false && /^permit-[0-9a-f]{32}$/.test(P.permitId), 'S-1. valid permit（branch / worktreePath は taskId から導出）');
    function invalidBy(patch, code) { return hasErr(pm.validatePermit(mut(P, patch), { now: NOW }), code); }
    assert(invalidBy({ decisionRef: 'Decision 119' }, 'decision_ref_invalid'), 'S-2. Decision 120 以外 → 拒否');
    assert(invalidBy({ mode: 'anything' }, 'mode_invalid'), 'S-3. mode 違い → 拒否');
    assert(invalidBy({ operation: 'worktree_remove' }, 'operation_invalid'), 'S-4. operation 違い → 拒否');
    assert(invalidBy({ expectedHead: 'abc' }, 'expected_head_invalid') && invalidBy({ expectedOriginMain: 'HEAD' }, 'expected_origin_main_invalid'), 'S-5. 40桁 SHA でない → 拒否');
    assert(invalidBy({ expectedOriginMain: OTHER_HEAD }, 'head_not_equal_origin_main') && hasErr(pm.buildPermit(input({ expectedOriginMain: OTHER_HEAD })), 'head_not_equal_origin_main'), 'S-6. expectedHead ≠ expectedOriginMain → 拒否');
    assert(hasErr(pm.buildPermit(input({ taskId: 'Bad_Task' })), 'task_id_invalid') && invalidBy({ taskId: '../x' }, 'task_id_invalid'), 'S-7. 不正 taskId → 拒否');
    assert(hasErr(pm.buildPermit(input({ branch: 'dev/other' })), 'branch_mismatch') && invalidBy({ branch: 'dev/other' }, 'branch_mismatch'), 'S-8. branch 不一致 → 拒否');
    assert(hasErr(pm.buildPermit(input({ worktreePath: path.join(WT_ROOT, 'other') })), 'worktree_path_mismatch') && invalidBy({ worktreePath: path.join(WT_ROOT, 'other') }, 'worktree_path_mismatch')
      && invalidBy({ worktreePath: path.join(ROOT, 'wt', 'prep-3c-001') }, 'worktree_path_mismatch'), 'S-9. worktreePath 不一致（repo 内を含む）→ 拒否');
    assert(invalidBy({ protectedFingerprint: 'xyz' }, 'protected_fingerprint_invalid') && invalidBy({ autopilotStatusHash: 'ZZZZZZZZZZZZ' }, 'autopilot_status_hash_invalid'), 'S-10. hash 形式不正 → 拒否');
    assert(invalidBy({ approvedBy: 'claude' }, 'approved_by_invalid'), 'S-10b. approvedBy は human のみ');
    assert(invalidBy({ token: 'x' }, 'permit_keys_mismatch') && invalidBy({ remoteUrl: 'https://github.com/o/r' }, 'permit_keys_mismatch'), 'S-10c. 未定義 key（secret / raw URL 用 field 等）→ 拒否');
    assert(invalidBy({ repoIdentity: Object.assign({}, REAL_ID, { remoteIdentity: 'https://github.com/o/r' }) }, 'remote_identity_invalid')
      && invalidBy({ repoIdentity: Object.assign({}, REAL_ID, { rawUrl: 'x' }) }, 'repo_identity_shape'), 'S-10d. repoIdentity は credential-free identity の 4 項目だけ');

    caseHeader('T. Time');
    assert(pm.validatePermit(P, { now: at(9) }).ok, 'T-11. TTL 内（10 分・9 分経過）は有効');
    assert(hasErr(pm.validatePermit(P, { now: at(10) }), 'expired') && hasErr(pm.validatePermit(P, { now: at(60) }), 'expired'), 'T-12. 期限切れ → 拒否');
    assert(hasErr(pm.buildPermit(input({ ttlMs: 31 * 60000 })), 'ttl_invalid') && invalidBy({ expiresAt: at(31) }, 'ttl_too_long') && pm.buildPermit(input({ ttlMs: 30 * 60000 })).ok, 'T-13. 30 分超 → 拒否（30 分ちょうどは可）');
    assert(hasErr(pm.validatePermit(mut(P, { approvedAt: at(5), expiresAt: at(15) }), { now: NOW }), 'approved_at_in_future'), 'T-14. 未来の approvedAt → 拒否');
    assert(hasErr(pm.validatePermit(P, {}), 'now_required'), 'T-14b. now 未指定 → fail-closed');

    caseHeader('G. Storage');
    {
      const rp = pm.resolvePermitPaths(STORE, P.permitId);
      assert(rp.ok && insideDir(rp.file, PERMIT_ROOT) && /\.json$/.test(rp.file) && /\.consumed\.json$/.test(rp.consumedFile), 'G-23. repo 外の permit root');
      assert(pm.resolvePermitPaths({ root: path.join(ROOT, '.autopilot', 'permits'), repoPath: ROOT }, P.permitId).error === 'permit_root_inside_repo'
        && pm.resolvePermitPaths({ root: path.dirname(path.dirname(ROOT)), repoPath: ROOT }, P.permitId).error === 'permit_root_inside_repo', 'G-24. repo 内 / repo を内包する root → 拒否');
      assert(pm.resolvePermitPaths(STORE, '../evil').error === 'permit_id_invalid' && pm.resolvePermitPaths(STORE, 'permit-' + 'a'.repeat(31) + '/').error === 'permit_id_invalid'
        && pm.resolvePermitPaths({ root: PERMIT_ROOT + '\\..\\x', repoPath: ROOT }, P.permitId).error === 'permit_root_invalid', 'G-25. traversal（permitId / root）→ 拒否');
      const w1 = pm.writePermit(STORE, P, { now: NOW });
      const bytes1 = fs.readFileSync(w1.file);
      const w2 = pm.writePermit(STORE, P, { now: NOW });
      assert(w1.ok && !w2.ok && w2.error === 'permit_exists', 'G-26. 同じ permitId の重複作成 → 拒否');
      assert(Buffer.compare(bytes1, fs.readFileSync(w1.file)) === 0, 'G-27. exclusive create（既存 file を上書きしない）');
      assert(pm.writePermit({ root: path.join(SANDBOX, 'missing'), repoPath: ROOT }, pm.buildPermit(input()).permit, { now: NOW }).error === 'permit_root_missing', 'G-27b. root が無ければ作らずに拒否');
      assert(pm.writePermit(STORE, mut(P, { consumed: true, permitId: 'permit-' + 'b'.repeat(32) }), { now: NOW }).error === 'permit_already_consumed', 'G-27c. consumed 状態の Permit は書けない');
    }

    caseHeader('C. Consumption（原子的 rename・single-use）');
    let CAP = null;
    {
      const rp = pm.resolvePermitPaths(STORE, P.permitId);
      const mis1 = pm.consumePermit(STORE, P.permitId, liveFor(P, { autopilotStatusHash: st.displayStatusHash }), { now: at(1) });
      const mis2 = pm.consumePermit(STORE, P.permitId, liveFor(P, { currentHead: OTHER_HEAD }), { now: at(1) });
      const mis3 = pm.consumePermit(STORE, P.permitId, liveFor(P, { repoIdentity: Object.assign({}, REAL_ID, { remoteIdentity: 'github.com/other/repo' }) }), { now: at(1) });
      assert(mis1.error === 'permit_binding_mismatch' && mis1.errors.indexOf('binding:autopilotStatusHash') !== -1 && mis2.error === 'permit_binding_mismatch'
        && mis3.error === 'permit_binding_mismatch' && fs.existsSync(rp.file), 'C-32. binding 不一致（displayStatusHash を渡す・HEAD・remote identity）→ 拒否（consume されない）');
      assert(st.autopilotStatusHash === st.displayStatusHash || mis1.errors.indexOf('binding:autopilotStatusHash') !== -1, 'H-46. Permit binding は autopilotStatusHash（displayStatusHash では通らない）');
      const c1 = pm.consumePermit(STORE, P.permitId, liveFor(P), { now: at(1) });
      collected.push(c1);
      CAP = c1.capability;
      assert(c1.ok && Object.isFrozen(CAP) && CAP.permitId === P.permitId, 'C-28. 1 回目の consume 成功（capability 発行）');
      assert(!fs.existsSync(rp.file) && fs.existsSync(rp.consumedFile), 'C-29. unconsumed file は消え、*.consumed.json へ原子的に rename');
      const c2 = pm.consumePermit(STORE, P.permitId, liveFor(P), { now: at(2) });
      assert(!c2.ok && c2.error === 'permit_not_found_or_consumed', 'C-30. 2 回目の consume → 拒否');
      const Pexp = pm.buildPermit(input({ taskId: 'prep-3c-002' })).permit;
      pm.writePermit(STORE, Pexp, { now: NOW });
      const ce = pm.consumePermit(STORE, Pexp.permitId, liveFor(Pexp), { now: at(11) });
      assert(!ce.ok && hasErr(ce, 'expired') && fs.existsSync(pm.resolvePermitPaths(STORE, Pexp.permitId).file), 'C-31. 期限切れの consume → 拒否');
      assert(['unconsumePermit', 'restorePermit', 'rollbackPermit', 'resetPermit'].every(function (k) { return !(k in pm); }) && fs.existsSync(rp.consumedFile)
        && !fs.existsSync(rp.file), 'C-33. consumed 後の rollback 手段は無い（burned のまま）');
      const tampered = pm.buildPermit(input({ taskId: 'prep-3c-003' })).permit;
      pm.writePermit(STORE, tampered, { now: NOW });
      const tf = pm.resolvePermitPaths(STORE, tampered.permitId).file;
      fs.writeFileSync(tf, JSON.stringify(Object.assign({}, tampered, { expectedHead: OTHER_HEAD, expectedOriginMain: OTHER_HEAD })));
      assert(pm.consumePermit(STORE, tampered.permitId, liveFor(tampered), { now: at(1) }).error === 'permit_binding_mismatch', 'C-33b. file を書き換えた Permit は live と一致せず拒否');
    }

    caseHeader('K. Opaque capability');
    assert(pm.isGenuineCapability(CAP), 'K-34. consumePermit が発行した capability は有効');
    assert(!pm.isGenuineCapability(Object.assign({}, CAP)) && !pm.isGenuineCapability({ permitId: CAP.permitId, operation: 'worktree_add' }), 'K-35. 手書き object / Object.assign clone は無効');
    assert(!pm.isGenuineCapability(JSON.parse(JSON.stringify(CAP))), 'K-36. JSON clone は無効');
    assert(!pm.isGenuineCapability(Object.freeze({ ...CAP })) && !pm.isGenuineCapability(null) && !pm.isGenuineCapability('x'), 'K-37. spread clone / 非 object は無効');

    caseHeader('E. Executor の自 repo guard（Git は spy・mutation 0）');
    {
      const calls = [];
      const spy = function (file, args) { calls.push(args.slice()); return ''; };
      const fwd = ROOT.replace(/\\/g, '/');
      function preflightFor(taskId, head) {
        const r0 = rs.createInitialRun({
          taskId: taskId, task: { title: 'prep', goal: 'prep', allowedPaths: ['tools/'], forbiddenPaths: [] },
          mainRepoPath: ROOT, baseHead: head, branch: 'dev/' + taskId, worktreePath: path.join(WT_ROOT, taskId),
          budget: { capUsd: 1, maxInvocations: 1 }, mainStatusHashAtStart: st.autopilotStatusHash, protectedMd5AtStart: { 'cost-logs.json': '0'.repeat(32) }, now: NOW,
        }).run;
        const r = r0;   // S5：worktree は stage 未開始（隔離の確定前）の run でのみ作る
        return wc.validateIsolationPreflight({
          currentBranch: 'main', stagedCount: 0, currentHead: head, originMain: head, originIsAncestor: true,
          protectedFingerprint: 'd1fd4bd36f69', mainStatusHash: st.autopilotStatusHash, existingBranchRefs: ['refs/heads/main'],
          targetBranchExists: false, targetWorktreeExists: false, pathCollision: false, pathHasLinkOrJunction: false, activeHooks: false,
          worktreeListPorcelain: 'worktree ' + fwd + '\nHEAD ' + head + '\nbranch refs/heads/main\n', maxTrackedPathLength: 67,
        }, { taskId: taskId, repoPath: ROOT, worktreeRoot: WT_ROOT, baseHead: head, protectedFingerprint: 'd1fd4bd36f69', mainStatusHash: st.autopilotStatusHash, run: r });
      }
      const pf = preflightFor('prep-3c-001', FAKE_HEAD);
      assert(pf.result === 'pass', 'E-0. 本物の repo 向けの pass 形 plan（純関数・存在しない SHA・sandbox 内 worktree 先）');
      const r38 = exe.executeWorktreeCreate(pf, { _execFileSync: spy });
      assert(!r38.ok && r38.error === 'repo_protected' && calls.length === 0, 'E-38. 自 repo ＋ Permit なし → 拒否（Git 呼び出し 0）');
      const r39 = exe.executeWorktreeCreate(pf, { mutationRepoAllowlist: [ROOT], _execFileSync: spy });
      assert(!r39.ok && r39.error === 'repo_protected' && calls.length === 0, 'E-39. 自 repo ＋ generic allowlist → 拒否');
      const fake = Object.freeze(Object.assign({}, CAP));
      const r40 = exe.executeWorktreeCreate(pf, { realRepoCapability: fake, _execFileSync: spy });
      const r40b = exe.executeWorktreeCreate(pf, { realRepoCapability: JSON.parse(JSON.stringify(CAP)), mutationRepoAllowlist: [ROOT], _execFileSync: spy });
      assert(r40.error === 'capability_invalid' && r40b.error === 'capability_invalid' && calls.length === 0, 'E-40. 偽 capability（clone / JSON）→ 拒否');
      // 別 task の本物の capability（binding 不一致）
      const P4 = pm.buildPermit(input({ taskId: 'prep-3c-004' })).permit;
      pm.writePermit(STORE, P4, { now: NOW });
      const CAP4 = pm.consumePermit(STORE, P4.permitId, liveFor(P4), { now: at(1) }).capability;
      const r41 = exe.executeWorktreeCreate(pf, { realRepoCapability: CAP4, _execFileSync: spy });
      const pfOtherHead = preflightFor('prep-3c-001', OTHER_HEAD);
      const r41b = exe.executeWorktreeCreate(pfOtherHead, { realRepoCapability: CAP, _execFileSync: spy });
      assert(r41.error === 'capability_binding_mismatch' && r41b.error === 'capability_binding_mismatch' && calls.length === 0, 'E-41. binding 不一致の本物 capability（taskId・baseHead 違い）→ Git を呼ぶ前に拒否');
      const ok1 = exe.executeWorktreeCreate(pf, { realRepoCapability: CAP, _execFileSync: spy });
      assert(ok1.ok && calls.length === 1 && JSON.stringify(calls[0]) === JSON.stringify(pf.plan.command.args), 'E-41c. binding が全一致する本物 capability だけ Git 実行へ到達（spy・exact argv・1 回）');
      const again = exe.executeWorktreeCreate(pf, { realRepoCapability: CAP, _execFileSync: spy });
      assert(!again.ok && again.error === 'capability_already_used' && calls.length === 1, 'E-41d. 同じ capability の 2 回目 → 拒否（single-use）');
      // temp repo（自 repo 以外）の既存挙動
      const TMP_REPO = path.join(SANDBOX, 'repo');
      const run2 = rs.createInitialRun({
        taskId: 'prep-3c-005', task: { title: 't', goal: 'g', allowedPaths: ['lib/'], forbiddenPaths: [] }, mainRepoPath: TMP_REPO, baseHead: OTHER_HEAD,
        branch: 'dev/prep-3c-005', worktreePath: path.join(WT_ROOT, 'prep-3c-005'), budget: { capUsd: 1, maxInvocations: 1 },
        mainStatusHashAtStart: 'aaaaaaaaaaaa', protectedMd5AtStart: { a: 'b' }, now: NOW }).run;   // S5：stage 未開始の run
      const pfTmp = wc.validateIsolationPreflight({
        currentBranch: 'main', stagedCount: 0, currentHead: OTHER_HEAD, originMain: OTHER_HEAD, originIsAncestor: true, protectedFingerprint: 'cccccccccccc',
        mainStatusHash: 'aaaaaaaaaaaa', existingBranchRefs: ['refs/heads/main'], targetBranchExists: false, targetWorktreeExists: false, pathCollision: false,
        pathHasLinkOrJunction: false, activeHooks: false, worktreeListPorcelain: 'worktree ' + TMP_REPO.replace(/\\/g, '/') + '\nHEAD ' + OTHER_HEAD + '\nbranch refs/heads/main\n', maxTrackedPathLength: 67,
      }, { taskId: 'prep-3c-005', repoPath: TMP_REPO, worktreeRoot: WT_ROOT, baseHead: OTHER_HEAD, protectedFingerprint: 'cccccccccccc', mainStatusHash: 'aaaaaaaaaaaa', run: run2 });
      const t1 = exe.executeWorktreeCreate(pfTmp, { _execFileSync: spy });
      const t2 = exe.executeWorktreeCreate(pfTmp, { mutationRepoAllowlist: [TMP_REPO], realRepoCapability: CAP4, _execFileSync: spy });
      const t3 = exe.executeWorktreeCreate(pfTmp, { mutationRepoAllowlist: [TMP_REPO], _execFileSync: spy });
      assert(pfTmp.result === 'pass' && t1.error === 'repo_not_allowlisted_for_mutation' && t2.error === 'capability_unexpected' && t3.ok && calls.length === 2,
        'E-42. temp repo は従来どおり allowlist で実行（allowlist なしは拒否・capability 混入は拒否）');
      assert(calls.every(function (a) { return a.indexOf(FAKE_HEAD) !== -1 || a.indexOf(OTHER_HEAD) !== -1; }), 'E-42b. spy に渡った argv は存在しない SHA だけ（本物の repo に対して意味を持たない）');
    }

    caseHeader('X. Secret / 保存内容');
    {
      const consumedFile = pm.resolvePermitPaths(STORE, P.permitId).consumedFile;
      const saved = fs.readFileSync(consumedFile, 'utf8');
      const obj = JSON.parse(saved);
      assert(Object.keys(obj).sort().join(',') === ['approvedAt', 'approvedBy', 'autopilotStatusHash', 'branch', 'consumed', 'decisionRef', 'expectedHead', 'expectedOriginMain', 'expiresAt',
        'mode', 'operation', 'permitId', 'protectedFingerprint', 'repoIdentity', 'taskId', 'version', 'worktreePath'].join(','), 'X-48. Permit の key は schema の 17 項目だけ（secret field なし）');
      assert(saved.indexOf('://') === -1 && saved.indexOf('@') === -1, 'X-49. 保存された Permit に raw remote URL / userinfo なし');
      const envVals = Object.keys(process.env).filter(function (k) { return /(KEY|TOKEN|SECRET|PASSWORD|AUTH|COOKIE)$/i.test(k); })
        .map(function (k) { return process.env[k]; }).filter(function (v) { return typeof v === 'string' && v.length >= 6; });
      const dump = JSON.stringify(collected) + saved;
      assert(envVals.every(function (v) { return dump.indexOf(v) === -1; }) && dump.indexOf('tok3nSECRET') === -1, 'X-50. result / Permit に env の secret 値・credential を含めない');
    }

    caseHeader('Y. Z-54 の snapshot 比較 self-test（sandbox 内の fixture だけ）');
    {
      const T = path.join(SANDBOX, 'snapshot-selftest');
      fs.mkdirSync(path.join(T, 'permits'), { recursive: true });
      fs.writeFileSync(path.join(T, 'permits', 'a.consumed.json'), '{"x":1}');
      const s0 = snapshotTree(T);
      assert(s0.ok && s0.exists && sameTree(s0, snapshotTree(T)), 'Y-1. 読み取りだけなら同一（atime 等に依存しない）');
      fs.writeFileSync(path.join(T, 'permits', 'b.json'), '{}');
      const sAdd = snapshotTree(T);
      fs.unlinkSync(path.join(T, 'permits', 'b.json'));
      fs.writeFileSync(path.join(T, 'permits', 'a.consumed.json'), '{"x":2}');   // 同 size・内容違い
      const sMod = snapshotTree(T);
      fs.unlinkSync(path.join(T, 'permits', 'a.consumed.json'));
      const sDel = snapshotTree(T);
      assert(!sameTree(s0, sAdd) && !sameTree(s0, sMod) && !sameTree(s0, sDel), 'Y-2. 追加・内容変更（同 size）・削除を検出');
      const none = snapshotTree(path.join(SANDBOX, 'does-not-exist'));
      assert(none.ok && none.exists === false && sameTree(none, snapshotTree(path.join(SANDBOX, 'does-not-exist'))) && !sameTree(none, s0), 'Y-3. 開始時に無ければ終了時も無いことを検証できる');
      assert(!sameTree({ ok: false, exists: true, entries: [], errors: ['x'] }, { ok: false, exists: true, entries: [], errors: ['x'] }), 'Y-4. snapshot 失敗同士は「変更なし」とみなさない');
      assert(JSON.stringify(s0).indexOf('"x":1') === -1, 'Y-5. snapshot に file 本文を含めない（hash のみ）');
    }
  } catch (e) {
    _failed++;
    console.log('  ❌ 例外: ' + (e && e.message ? e.message : String(e)));
  } finally {
    caseHeader('Z. Cleanup・本物の repo 不変');
    {
      assert(!cleanupSandbox(ROOT).ok && !cleanupSandbox(os.tmpdir()).ok && !cleanupSandbox(PERMIT_ROOT).ok, 'Z-52. 自己所有でない path（本物の repo / OS temp root / sandbox の一部）は cleanup 拒否');
      const done = cleanupSandbox(SANDBOX);
      assert(done.ok, 'Z-51. 自己所有 sandbox（Permit file を含む）を後始末' + (done.ok ? '' : '（' + done.error + ' / residue: ' + SANDBOX + '）'));
      let residue = true; try { fs.statSync(SANDBOX); } catch (e) { residue = false; }
      assert(!residue, 'Z-53. temp 残骸なし');
      const autopilotAfter = snapshotTree(REAL_AUTOPILOT_ROOT);
      assert(autopilotBefore.ok && autopilotAfter.ok, 'Z-54a. 本物の .autopilot の snapshot を安全に取得（link / 特殊ファイル / 読取失敗なし）' + (autopilotBefore.ok && autopilotAfter.ok ? '' : '（' + autopilotBefore.errors.concat(autopilotAfter.errors).join(',') + '）'));
      assert(sameTree(autopilotBefore, autopilotAfter), 'Z-54. 本物の .autopilot（Permit root・audit artifact）をこのテストが追加・削除・変更していない（監視先 ' + path.resolve(REAL_AUTOPILOT_ROOT)
        + '・exists=' + autopilotBefore.exists + '・dir ' + autopilotBefore.entries.filter(function (x) { return x.type === 'dir'; }).map(function (x) { return x.path; }).join('|')
        + '・file ' + autopilotBefore.entries.filter(function (x) { return x.type === 'file'; }).map(function (x) { return x.path + '#sha256:' + x.sha256.slice(0, 12); }).join('|') + '）');
      const after = realSnapshot();
      assert(realBefore && after.st.head === realBefore.st.head && after.origin === realBefore.origin, 'Z-55. 本物の repo の HEAD / origin/main 不変');
      assert(realBefore && after.st.autopilotStatusHash === realBefore.st.autopilotStatusHash && after.st.displayStatusHash === realBefore.st.displayStatusHash, 'Z-56. autopilotStatusHash / displayStatusHash 不変');
      assert(after.fp === fpBefore && after.fp === 'd1fd4bd36f69', 'Z-57. Protected fingerprint 不変（' + after.fp + '）');
      // 実行場所ごとの Protected 検証：main は開始時と同じ（固定基準は Z-57）・worktree は main 側の不変＋tracked の存在と不変・untracked の不在
      const psAfter = pc.snapshot(ROOT);
      const pv = pc.verify(protectedSnapBefore, psAfter, LAYOUT.mode === 'worktree' ? protectedSnapBefore.main : protectedSnapBefore.root);
      assert(pv.ok && pc.fingerprint(LAYOUT.mode === 'worktree' ? psAfter.main : psAfter.root) === 'd1fd4bd36f69', 'Z-57b. Protected（' + pv.mode + '）の開始時・終了時の検証' + (pv.ok ? '' : '（' + pv.reasons.join(',') + '）'));
      assert(LAYOUT.mode !== 'worktree' || (after.mainSt && after.mainSt.ok && after.mainSt.head === realBefore.mainSt.head && after.mainSt.autopilotStatusHash === realBefore.mainSt.autopilotStatusHash),
        'Z-56b. worktree で実行した場合は main repo の HEAD・autopilotStatusHash も不変');
      assert(realBefore && after.st.branchRefs.length === realBefore.st.branchRefs.length && after.st.worktreeCount === realBefore.st.worktreeCount, 'Z-58. branch 数 / worktree 数 不変（' + after.st.branchRefs.length + ' / ' + after.st.worktreeCount + '）');
      assert(violations.length === 0, 'Z-59. sandbox 違反 0（network / sandbox 外 fs write / 危険 module / .env 読込）' + (violations.length ? ' ' + violations.join(',') : ''));
      assert(JSON.stringify(Object.keys(process.env).sort()) === envKeysBefore, 'Z-60. process.env を変更していない');
    }
    console.log('\n────────────────────────────────────────────────────────────');
    console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
    if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
    else console.log('🟢 All Development Autopilot Step 3C Preparation cases passed');
  }
})();
