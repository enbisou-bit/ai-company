'use strict';
// devAutopilotStep1.test.js
// Development Autopilot V1 — Step 1（Risk Classifier / Test Safety Manifest / Test Selector）の deterministic テスト。
//
//   ★ 実行は必ずこのファイル名を明示指定する（node devAutopilotStep1.test.js）。
//   ★ 外部出口は冒頭で fail-closed に封鎖する（network / credential env / .env / 禁止 module / fs write）。
//   ★ Protected 10件の hash を開始時・終了時に read-only で取得し、全件一致を assert する。

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const violations = [];

const PROTECTED_BASELINE = {
  'cost-logs.json': 'ce24d4808bc7bbbf1b517b12c6bce65e',
  'data/conversations/_meta.json': 'b1f27d5f863f8fe20edc686157fbc992',
  'claude-cost-logs.json': '2f7fdd7d6105b92dbc022ea090f3399f',
  'claude-quality-history.json': '429a054a7898fcc78906b17a72b4d860',
  'backup-dup-candidates-20260714/dup-candidates-123.csv': 'c6800a3ff3b2e1acda3ccc5b8440b751',
  'backup-dup-candidates-20260714/dup-candidates-123.json': 'cdd3e71b3b295f4b094cf05a30cc79f7',
  'data/conversations/user-cont-1_line_web.json': 'dbceb6d32a3dda1fb9b5d721325089d5',
  'data/conversations/user-cont-2_line_estimate.json': '8124d35bad188d047ac162c1f38a0a69',
  'data/conversations/user-cont-3_line_leader.json': 'ab4e713e61a9ecc0496dad41c2f13536',
  'data/conversations/user-cont-4_line_video.json': '12ab03f1cc7d686de163ae4483b01c54',
};
const PROTECTED_FILES = Object.keys(PROTECTED_BASELINE);
// Protected の検証は共通 helper（main：固定基準と開始時・終了時とも一致／隔離 worktree：main 側の固定基準＋worktree 側の tracked 存在・不変と untracked 不在）。
// 実行場所は .git の構造だけで判定し、環境変数では切り替えない（tools/devAutopilot/protectedCheck.js）
const pc = require('./tools/devAutopilot/protectedCheck');
const protectedBefore = pc.snapshot(ROOT);

// ── sandbox（network / env / fs / module） ──
function blockedNetwork(name) { return function () { violations.push('network:' + name); throw new Error('SANDBOX_BLOCKED_NETWORK:' + name); }; }
['http', 'https'].forEach(function (m) { const mod = require(m); mod.request = blockedNetwork(m + '.request'); mod.get = blockedNetwork(m + '.get'); });
{ const net = require('net'); net.connect = blockedNetwork('net.connect'); net.createConnection = blockedNetwork('net.createConnection'); const tls = require('tls'); tls.connect = blockedNetwork('tls.connect'); }
globalThis.fetch = blockedNetwork('fetch');
const CREDENTIAL_ENV_PATTERN = /^(OPENAI|ANTHROPIC|CLAUDE|SUPABASE|NEXT_PUBLIC_SUPABASE|LINE_|WEB_SESSION|CAROUSEL_)/i;
Object.keys(process.env).forEach(function (k) { if (CREDENTIAL_ENV_PATTERN.test(k)) delete process.env[k]; });
function isEnvFile(p) { try { return /^\.env(\..*)?$/.test(path.basename(String(p))); } catch (e) { return false; } }
['readFileSync', 'readFile', 'existsSync', 'statSync', 'createReadStream'].forEach(function (n) {
  const orig = fs[n]; if (typeof orig !== 'function') return;
  fs[n] = function (p) { if (isEnvFile(p)) { violations.push('env_file_read:' + n); throw new Error('SANDBOX_BLOCKED_ENV_READ'); } return orig.apply(this, arguments); };
});
function blockedWrite(name) { return function () { violations.push('fs_write:' + name); throw new Error('SANDBOX_BLOCKED_FS_WRITE:' + name); }; }
['writeFileSync', 'appendFileSync', 'renameSync', 'unlinkSync', 'mkdirSync', 'rmSync', 'rmdirSync', 'copyFileSync', 'truncateSync',
  'symlinkSync', 'cpSync', 'writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir', 'copyFile', 'truncate', 'createWriteStream']
  .forEach(function (n) { if (typeof fs[n] === 'function') fs[n] = blockedWrite('fs.' + n); });
['writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir', 'copyFile', 'truncate'].forEach(function (n) { if (typeof fs.promises[n] === 'function') fs.promises[n] = blockedWrite('fs.promises.' + n); });
const BLOCKED_BARE = new Set(['axios', 'dotenv', '@supabase/supabase-js', '@anthropic-ai/sdk', 'http2', 'undici', 'child_process', 'node:http2', 'node:child_process']);
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

let _passed = 0, _failed = 0;
function assert(cond, label) { if (cond) { _passed++; console.log('  ✅ ' + label); } else { _failed++; console.log('  ❌ ' + label); } }
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const rc = require('./tools/devAutopilot/riskClassifier');
const ts = require('./tools/devAutopilot/testSelector');

const SCOPE = ['tools/devAutopilot/', 'devAutopilotStep1.test.js'];
function one(p, lines, extra) {
  return rc.classifyDevelopmentChange(Object.assign({ allowedPaths: SCOPE, files: [Object.assign({ path: p, status: 'modified', addedLines: lines || [] }, extra || {})] }, {}));
}
function hasRule(r, rule) { return r.findings.some(function (f) { return f.rule === rule; }); }

(function main() {
  console.log('\n=== devAutopilotStep1.test.js (Development Autopilot V1 Step 1: Safety Foundation Utilities) ===');

  caseHeader('SB. sandbox 自己検証');
  {
    const sv = violations.length; let blocked = false;
    try { globalThis.fetch('https://example.com'); } catch (e) { blocked = String(e.message).indexOf('SANDBOX_BLOCKED_NETWORK') === 0; }
    let blockedMod = false;
    try { require('child_process'); } catch (e) { blockedMod = String(e.message).indexOf('SANDBOX_BLOCKED_MODULE') === 0; }
    let blockedWriteOk = false;
    try { fs.writeFileSync(path.join(ROOT, 'cost-logs.json'), 'x'); } catch (e) { blockedWriteOk = String(e.message).indexOf('SANDBOX_BLOCKED_FS_WRITE') === 0; }
    assert(blocked && blockedMod && blockedWriteOk, 'SB-1. 実 fetch・child_process・fs write を封鎖');
    violations.length = sv;
  }

  caseHeader('RC. Risk Classifier');
  {
    const auto = one('tools/devAutopilot/reportFormat.js', ['module.exports = { a: 1 };'], { status: 'added' });
    assert(auto.classification === 'auto' && auto.findings.length === 0, 'RC-1. scope 内の通常 tools file → auto');

    const prot = one('cost-logs.json', ['{}']);
    const protWin = one('Data\\Conversations\\_META.json', ['{}']);
    const protRename = one('tools/devAutopilot/x.json', ['{}'], { status: 'renamed', oldPath: 'claude-cost-logs.json' });
    const protDelete = one('data/conversations/user-cont-1_line_web.json', null, { status: 'deleted' });
    assert(prot.classification === 'forbidden' && hasRule(prot, 'protected_path'), 'RC-2. Protected path → forbidden');
    assert(protWin.classification === 'forbidden' && protRename.classification === 'forbidden' && protDelete.classification === 'forbidden', 'RC-2b. Protected は区切り文字・大文字小文字・rename・削除でも forbidden');
    assert(rc.PROTECTED_PATHS.length === 10 && PROTECTED_FILES.every(function (p) { return rc.isProtectedPath(p); }), 'RC-2c. Protected 正本 10件が classifier と一致');

    const env = rc.classifyDevelopmentChange({ allowedPaths: ['.env.local'], files: [{ path: '.env.local', addedLines: ['X=1'] }] });
    assert(env.classification === 'human_required' && hasRule(env, 'env_file'), 'RC-3. .env* → human_required');

    const pkg = rc.classifyDevelopmentChange({ allowedPaths: ['package.json', 'package-lock.json'], files: [{ path: 'package.json', addedLines: ['"x": "1"'] }, { path: 'package-lock.json', addedLines: [] }] });
    assert(pkg.classification === 'human_required' && pkg.files.every(function (f) { return f.classification === 'human_required'; }) && hasRule(pkg, 'package_manifest'), 'RC-4. package.json / package-lock.json → human_required');

    const ws = rc.classifyDevelopmentChange({ allowedPaths: ['lib/'], files: [{ path: 'lib/webSession.js', addedLines: ['var a = 1;'] }] });
    const sess = one('tools/devAutopilot/session.js', ['var a = 1;']);
    const perm = one('tools/devAutopilot/permissions.js', ['var a = 1;']);
    assert(ws.classification === 'human_required' && hasRule(ws, 'web_session') && sess.classification === 'human_required' && perm.classification === 'human_required', 'RC-5. auth / session / permission → human_required');

    const sql = rc.classifyDevelopmentChange({ allowedPaths: ['supabase/'], files: [{ path: 'supabase/add_col.sql', addedLines: ['ALTER TABLE tasks ADD COLUMN x TEXT;'] }] });
    assert(sql.classification === 'human_required' && hasRule(sql, 'supabase_dir') && hasRule(sql, 'sql_or_migration'), 'RC-6. supabase / SQL / migration → human_required');

    const fetchExt = one('tools/devAutopilot/a.js', ["const r = await fetch('https://api.example.com/v1');"]);
    const axiosExt = one('tools/devAutopilot/a.js', ["const r = await axios.post('https://api.example.com/v1', {});"]);
    const netMod = one('tools/devAutopilot/a.js', ["const https = require('https');"]);
    const localFetch = one('tools/devAutopilot/a.js', ["const r = await fetch('/api/tasks');"]);
    assert(fetchExt.classification === 'human_required' && axiosExt.classification === 'human_required' && netMod.classification === 'human_required' && hasRule(fetchExt, 'external_network'), 'RC-7. 外部 host への fetch / axios / network module 追加 → human_required');
    assert(localFetch.classification === 'auto', 'RC-7b. 同一 origin の相対 fetch は external_network にしない');

    const del = one('tools/devAutopilot/a.js', ["await db.query('DELETE FROM tasks');"]);
    const drop = one('tools/devAutopilot/a.js', ['const q = "DROP TABLE tasks";']);
    const trunc = one('tools/devAutopilot/a.js', ["run('TRUNCATE TABLE tasks');"]);
    const sbDel = one('tools/devAutopilot/a.js', ["await supabase.from('tasks').delete().eq('id', x);"]);
    assert(del.classification === 'forbidden' && drop.classification === 'forbidden' && trunc.classification === 'forbidden' && sbDel.classification === 'forbidden', 'RC-8. DELETE / DROP / TRUNCATE / .delete() → forbidden');
    const cmt = one('tools/devAutopilot/a.js', ['// DROP TABLE は禁止（説明コメント）', ' * DELETE FROM は使わない']);
    const fixture = one('devAutopilotStep1.test.js', ["const fixtureLine = 'DELETE FROM tasks';"]);
    const mapDel = one('tools/devAutopilot/a.js', ['cache.delete(key);']);
    assert(cmt.classification === 'auto' && fixture.classification === 'auto' && mapDel.classification === 'auto', 'RC-8b. コメント・test fixture の文字列・引数つき Map.delete は forbidden にしない');

    const push = one('tools/devAutopilot/a.js', ["execSync('git push origin main');"]);
    const force = one('tools/devAutopilot/a.js', ["spawnSync('git', ['push', '--force']);"]);
    const commit = one('tools/devAutopilot/a.js', ['execSync(`git commit -m "x"`);']);
    const script = rc.classifyDevelopmentChange({ allowedPaths: ['tools/devAutopilot/'], files: [{ path: 'tools/devAutopilot/release.ps1', addedLines: ['git push origin main'] }] });
    const deploy = one('tools/devAutopilot/a.js', ["execSync('npm publish');"]);
    const docMention = rc.classifyDevelopmentChange({ allowedPaths: ['tools/devAutopilot/'], files: [{ path: 'tools/devAutopilot/README.md', addedLines: ['commit 前に git push はしない'] }] });
    assert(push.classification === 'forbidden' && force.classification === 'forbidden' && commit.classification === 'forbidden' && script.classification === 'forbidden' && deploy.classification === 'forbidden', 'RC-9. git push / --force / commit / deploy の実行追加 → forbidden');
    assert(docMention.classification === 'auto', 'RC-9b. 説明文中の git push 文字列は forbidden にしない');

    const bad = [
      rc.classifyDevelopmentChange(null),
      rc.classifyDevelopmentChange({}),
      rc.classifyDevelopmentChange({ allowedPaths: SCOPE, files: [] }),
      rc.classifyDevelopmentChange({ allowedPaths: SCOPE, files: 'x' }),
      rc.classifyDevelopmentChange({ allowedPaths: [], files: [{ path: 'tools/devAutopilot/a.js', addedLines: [] }] }),
      one('../outside.js', []),
      one('C:/Users/x/a.js', []),
      one('/etc/passwd', []),
      one('tools/devAutopilot/a.js', [], { addedLines: undefined }),   // diff 情報不足
      one('tools/devAutopilot/a.js', [42]),
      one('tools/devAutopilot/a.js', [], { status: 'copied' }),
      one('tools/devAutopilot/a.js', [], { status: 'renamed' }),
      rc.classifyDevelopmentChange({ allowedPaths: SCOPE, files: [null] }),
    ];
    assert(bad.every(function (r) { return r.classification === 'unknown'; }), 'RC-10. 入力異常・path 不正・diff 不足・status 不正 → unknown（' + bad.length + '件）');

    const mixed = rc.classifyDevelopmentChange({ allowedPaths: SCOPE, files: [{ path: 'tools/devAutopilot/a.js', addedLines: [] }, { path: '../x.js', addedLines: [] }] });
    const mixedF = rc.classifyDevelopmentChange({ allowedPaths: SCOPE, files: [{ path: 'cost-logs.json', addedLines: [] }, { path: '../x.js', addedLines: [] }] });
    const mixedH = rc.classifyDevelopmentChange({ allowedPaths: SCOPE, files: [{ path: 'package.json', addedLines: [] }, { path: '../x.js', addedLines: [] }] });
    assert(mixed.classification === 'unknown' && mixedH.classification === 'unknown' && mixedF.classification === 'forbidden', 'RC-11. unknown は auto / human_required へ fallback しない（forbidden のみ上位）');
    const g = ['auto', 'human_required', 'forbidden', 'unknown', 'weird', undefined].map(rc.gateForClassification);
    assert(g[0].proceed === true && g[1].gate === 'human_approval_required' && g[1].proceed === false
      && g[2].outcome === 'blocked' && g[3].outcome === 'blocked' && g[4].outcome === 'blocked' && g[5].outcome === 'blocked', 'RC-11b. gate 対応: auto→進行 / human_required→承認待ち / forbidden・unknown・想定外→blocked');

    const envDep = one('tools/devAutopilot/a.js', ['const k = process.env.SOME_KEY;']);
    const secret = one('tools/devAutopilot/a.js', ["const apiKey = 'sk-ant-abcdefghijklmnopqrstu';"]);
    const model = one('tools/devAutopilot/a.js', ["const LEADER_FINAL_MODEL = 'gpt-5.4-mini';"]);
    const server = rc.classifyDevelopmentChange({ allowedPaths: ['server.js'], files: [{ path: 'server.js', addedLines: ["app.get('/api/x', h);"] }] });
    const pubStatic = rc.classifyDevelopmentChange({ allowedPaths: ['lib/'], files: [{ path: 'lib/publicStatic.js', addedLines: [] }] });
    const scope = rc.classifyDevelopmentChange({ allowedPaths: SCOPE, files: [{ path: 'shared/foo.js', addedLines: ['var a = 1;'] }] });
    const delFile = one('tools/devAutopilot/a.js', null, { status: 'deleted' });
    const selfMod = one('tools/devAutopilot/riskClassifier.js', ['var a = 1;']);
    const childProc = one('tools/devAutopilot/a.js', ["const cp = require('child_process');"]);
    assert(envDep.classification === 'human_required' && secret.classification === 'human_required' && model.classification === 'human_required', 'RC-12. process.env 依存・secret らしい literal・provider/model 定数 → human_required');
    assert(server.classification === 'human_required' && pubStatic.classification === 'human_required' && scope.classification === 'human_required' && hasRule(scope, 'out_of_scope'), 'RC-13. server.js・publicStatic・scope 外 → human_required');
    assert(delFile.classification === 'human_required' && selfMod.classification === 'human_required' && childProc.classification === 'human_required', 'RC-14. ファイル削除・Safety Foundation 自身の変更・child_process 追加 → human_required');

    const exportSecret = one('tools/devAutopilot/a.js', ['console.log(process.env);']);
    const paid = one('tools/devAutopilot/a.js', ["await fetch('/api/carousel-image/produce', { method: 'POST' });"]);
    const publish = one('tools/devAutopilot/a.js', ['markInstagramPublished();']);
    assert(exportSecret.classification === 'forbidden' && paid.classification === 'forbidden' && publish.classification === 'forbidden', 'RC-15. secret 書き出し・有料画像生成経路・Publishing 経路 → forbidden');

    const input = { allowedPaths: SCOPE.slice(), files: [{ path: 'tools/devAutopilot/a.js', addedLines: ['var a = 1;'] }] };
    const snap = JSON.stringify(input);
    rc.classifyDevelopmentChange(input);
    assert(JSON.stringify(input) === snap, 'RC-16. classifier は入力を変更しない（純関数）');
    assert(JSON.stringify(one('tools/devAutopilot/a.js', ['x();'])) === JSON.stringify(one('tools/devAutopilot/a.js', ['x();'])), 'RC-17. 同一入力 → 同一出力（決定的）');
  }

  caseHeader('MF. Test Safety Manifest');
  const manifest = ts.loadTestManifest();
  const repoTests = ts.listRootTests(ROOT);
  {
    const v = ts.validateTestManifest(manifest, repoTests);
    assert(v.ok === true && v.errors.length === 0, 'MF-12. 実 repo の全 test を過不足なく網羅（errors ' + v.errors.length + '）');
    // Manifest Evolution Contract: 新規 test は manifest 登録と expected 同期が必須。固定値ではなく expected と実測の一致を検証する。
    const exp = manifest.expected || {};
    assert(Number.isInteger(exp.total) && repoTests.length === exp.total && v.counts.total === exp.total && v.counts.safe === exp.safe
      && v.counts.conditional === exp.conditional && v.counts.forbidden === exp.forbidden,
      'MF-12b. manifest.expected と repo 実測が一致（total ' + repoTests.length + ' / safe ' + v.counts.safe + ' / conditional ' + v.counts.conditional + ' / forbidden ' + v.counts.forbidden + '）');
    const pre = manifest.tests.filter(function (t) { return !/^devAutopilot/.test(t.file); });
    const preCount = pre.reduce(function (a, t) { a[t.class]++; return a; }, { safe: 0, conditional: 0, forbidden: 0 });
    assert(pre.length === 60 && preCount.safe === 43 && preCount.conditional === 13 && preCount.forbidden === 4, 'MF-12c. 既存 test は Safety Freeze 実測どおり 60（43 / 13 / 4）');
    const forb = manifest.tests.filter(function (t) { return t.class === 'forbidden'; }).map(function (t) { return t.file; }).sort();
    assert(JSON.stringify(forb) === JSON.stringify(['costTracker.eea8.test.js', 'costTrackerGpt54Mini.test.js', 'costTrackerTestIsolation.test.js', 'server.test.js']), 'MF-12d. 既知 forbidden 4件（server / costTracker 群）');
    const cond = manifest.tests.filter(function (t) { return t.class === 'conditional'; }).map(function (t) { return t.file; });
    assert(['leaderFinalGrounding.test.js', 'contentValueWiring.test.js', 'apfrComplianceInjection.test.js', 'carouselImageProduction.test.js'].every(function (f) { return cond.indexOf(f) !== -1; }), 'MF-12e. openaiClient / Supabase / costTracker 依存 test は conditional');
    ts.BASELINE_TESTS.forEach(function (b) { if (!manifest.tests.some(function (t) { return t.file === b && t.class === 'safe'; })) assert(false, 'baseline safe: ' + b); });
    assert(ts.BASELINE_TESTS.every(function (b) { return manifest.tests.some(function (t) { return t.file === b && t.class === 'safe'; }); }), 'MF-12f. baseline 4件は manifest 上 safe');

    const files = manifest.tests.map(function (t) { return t.file; });
    assert(files.length === new Set(files).size, 'MF-13. duplicate なし');
    assert(manifest.tests.every(function (t) { return ts.CLASSIFICATIONS.indexOf(t.class) !== -1 && typeof t.reason === 'string' && t.reason.length > 0; }), 'MF-14. classification 正当・reason 必須');
    assert(manifest.tests.filter(function (t) { return t.class === 'conditional'; }).every(function (t) { return Array.isArray(t.conditions) && t.conditions.length > 0; }), 'MF-15. conditional は conditions 必須');

    function mutated(fn) { const m = JSON.parse(JSON.stringify(manifest)); fn(m); return ts.validateTestManifest(m, repoTests); }
    const missing = mutated(function (m) { m.tests = m.tests.filter(function (t) { return t.file !== 'p1BlockingFix.test.js'; }); m.expected.total--; m.expected.safe--; });
    const nonexist = mutated(function (m) { m.tests.push({ file: 'ghost.test.js', class: 'safe', reason: 'x' }); m.expected.total++; m.expected.safe++; });
    const dup = mutated(function (m) { m.tests.push(JSON.parse(JSON.stringify(m.tests[0]))); });
    const badCls = mutated(function (m) { m.tests[0].class = 'unknown'; });
    const noCond = mutated(function (m) { m.tests.filter(function (t) { return t.class === 'conditional'; })[0].conditions = []; });
    const noReason = mutated(function (m) { m.tests[1].reason = ' '; });
    const expMis = mutated(function (m) { m.expected.safe = 1; });
    const baseUnsafe = mutated(function (m) { m.tests.filter(function (t) { return t.file === 'outputDraftAuth.test.js'; })[0].class = 'conditional'; m.tests.filter(function (t) { return t.file === 'outputDraftAuth.test.js'; })[0].conditions = ['x']; });
    assert(!missing.ok && missing.errors.some(function (e) { return e === 'missing_entry:p1BlockingFix.test.js'; }), 'MF-16. manifest 漏れを検知');
    assert(!nonexist.ok && nonexist.errors.some(function (e) { return e === 'nonexistent_entry:ghost.test.js'; }), 'MF-17. 実在しない entry を検知');
    assert(!dup.ok && dup.errors.some(function (e) { return /^duplicate:/.test(e); }) && !badCls.ok && !noCond.ok && !noReason.ok && !expMis.ok && !baseUnsafe.ok, 'MF-18. duplicate・不正 classification・condition 欠落・reason 欠落・件数不一致・baseline 非 safe を検知');
    assert(!ts.validateTestManifest(null, repoTests).ok && !ts.validateTestManifest({ tests: 'x' }, repoTests).ok && !ts.validateTestManifest(manifest, null).ok, 'MF-19. 不正 manifest / repoTests は ok=false');
  }

  caseHeader('SL. Test Selector（実 repo・read-only）');
  {
    const self = ts.selectTests({ changedFiles: ['tools/devAutopilot/riskClassifier.js'], manifest: manifest, repoRoot: ROOT });
    const selected = self.selected.map(function (s) { return s.file; });
    assert(selected.indexOf('devAutopilotStep1.test.js') !== -1 && ts.BASELINE_TESTS.every(function (b) { return selected.indexOf(b) !== -1; }), 'SL-26. Autopilot 自身の変更 → devAutopilot*.test.js と baseline を選択');
    const selfEntry = self.selected.filter(function (s) { return s.file === 'devAutopilotStep1.test.js'; })[0];
    assert(selfEntry && selfEntry.reasons.indexOf('require_closure') !== -1 && selfEntry.reasons.indexOf('autopilot_test_mapping') !== -1, 'SL-19. 直接 require の到達でも candidate 化（require_closure）');
    // Step 3B / Stage 4D（Step 6B）の integration test は conditional のため、Autopilot 自身の変更では skippedUnsafe に入り Human 実行となる
    const CONDITIONAL_INTEGRATION = ['devAutopilotStep3B.test.js', 'devAutopilotStep6B.test.js'];
    const selfSkipped = self.skippedUnsafe.filter(function (s) { return CONDITIONAL_INTEGRATION.indexOf(s.file) === -1 || s.classification !== 'conditional'; });
    assert(self.uncoveredFiles.length === 0 && selfSkipped.length === 0
      && (self.skippedUnsafe.length === 0 ? self.requiresHumanApproval === false : self.humanApprovalReasons.join(',') === 'unsafe_candidates_skipped'),
      'SL-26b. Autopilot 自身の変更は safe test で網羅。skip は conditional の integration test（Step 3B・Step 6B）だけ（その場合の Human 要求理由は unsafe_candidates_skipped のみ）');

    const idx = ts.selectTests({ changedFiles: ['index.html'], manifest: manifest, repoRoot: ROOT });
    const skipped = idx.skippedUnsafe.map(function (s) { return s.file; });
    assert(idx.selected.length > 0 && idx.selected.some(function (s) { return s.reasons.indexOf('references_path') !== -1; }), 'SL-18. 変更 path の文字列参照から candidate 取得');
    assert(idx.selected.every(function (s) { return manifest.tests.some(function (t) { return t.file === s.file && t.class === 'safe'; }); }), 'SL-20. selected は safe のみ');
    assert(skipped.indexOf('carouselImageProduction.test.js') !== -1 && idx.skippedUnsafe.every(function (s) { return typeof s.reason === 'string' && s.reason.length > 0 && s.classification; }), 'SL-21/23. conditional は skippedUnsafe（classification と理由を保持）');
    assert(idx.requiresHumanApproval === true && idx.humanApprovalReasons.indexOf('unsafe_candidates_skipped') !== -1, 'SL-23b. unsafe を skip した場合は human approval を要求');

    const ct = ts.selectTests({ changedFiles: ['costTracker.js'], manifest: manifest, repoRoot: ROOT });
    assert(ct.skippedUnsafe.some(function (s) { return s.file === 'server.test.js' && s.classification === 'forbidden'; }) && !ct.selected.some(function (s) { return s.file === 'server.test.js'; }), 'SL-22. forbidden は skippedUnsafe（server.test.js を選ばない）');
  }

  caseHeader('SL. Test Selector（fake repo・注入 io）');
  {
    const files = {
      'lib/util.js': 'module.exports = 1;',
      'lib/mid.js': "module.exports = require('./util');",
      'lib/lonely.js': 'module.exports = 2;',
      'a.test.js': "require('./lib/mid');",
      'b.test.js': "const s = 'lib/util.js';",
      'c.test.js': "require('./lib/util');",
      'indexInlineScriptSafety.test.js': '',
      'staticExposureBoundary.test.js': '',
      'apiAuthBoundary.test.js': '',
      'outputDraftAuth.test.js': '',
      'devAutopilotStep1.test.js': '',
      'newFeature.test.js': "require('./lib/lonely');",
    };
    const io = { readFile: function (p) { return Object.prototype.hasOwnProperty.call(files, p) ? files[p] : null; }, exists: function (p) { return Object.prototype.hasOwnProperty.call(files, p); } };
    const base = ['indexInlineScriptSafety.test.js', 'staticExposureBoundary.test.js', 'apiAuthBoundary.test.js', 'outputDraftAuth.test.js'];
    const repo = ['a.test.js', 'b.test.js', 'c.test.js', 'devAutopilotStep1.test.js'].concat(base);
    function man(extra) {
      const tests = repo.map(function (f) { return { file: f, class: 'safe', reason: 'r' }; });
      (extra || []).forEach(function (e) { tests.filter(function (t) { return t.file === e.file; })[0].class = e.class; if (e.class === 'conditional') tests.filter(function (t) { return t.file === e.file; })[0].conditions = ['c']; });
      const cnt = tests.reduce(function (a, t) { a[t.class]++; return a; }, { safe: 0, conditional: 0, forbidden: 0 });
      return { tests: tests, expected: { total: tests.length, safe: cnt.safe, conditional: cnt.conditional, forbidden: cnt.forbidden } };
    }
    const r1 = ts.selectTests({ changedFiles: ['lib/util.js'], manifest: man(), repoTests: repo, io: io });
    const sel1 = r1.selected.map(function (s) { return s.file; });
    assert(sel1.indexOf('a.test.js') !== -1 && sel1.indexOf('b.test.js') !== -1 && sel1.indexOf('c.test.js') !== -1, 'SL-19b. 2 段の require 到達（a→mid→util）・文字列参照（b）・直接 require（c）を検出');
    assert(r1.selected.filter(function (s) { return s.file === 'a.test.js'; })[0].reasons.indexOf('require_closure') !== -1, 'SL-19c. a.test.js は require_closure で選ばれる');
    assert(base.every(function (b) { return sel1.indexOf(b) !== -1; }) && r1.requiresHumanApproval === false, 'SL-25. baseline は常に candidate（safe 必須）');

    const r2 = ts.selectTests({ changedFiles: ['lib/util.js'], manifest: man([{ file: 'c.test.js', class: 'conditional' }, { file: 'b.test.js', class: 'forbidden' }]), repoTests: repo, io: io });
    assert(r2.skippedUnsafe.some(function (s) { return s.file === 'c.test.js' && s.classification === 'conditional' && s.conditions; })
      && r2.skippedUnsafe.some(function (s) { return s.file === 'b.test.js' && s.classification === 'forbidden'; })
      && !r2.selected.some(function (s) { return s.file === 'b.test.js' || s.file === 'c.test.js'; }) && r2.requiresHumanApproval === true, 'SL-21b/22b. conditional / forbidden は実行候補にせず理由つきで分離・human approval 要求');

    const r3 = ts.selectTests({ changedFiles: ['lib/lonely.js'], manifest: man(), repoTests: repo, io: io });
    assert(r3.uncoveredFiles.indexOf('lib/lonely.js') !== -1 && r3.requiresHumanApproval === true && r3.humanApprovalReasons.indexOf('no_safe_test_for_changed_file') !== -1, 'SL-24. baseline 以外の safe test が 0 の変更 → human approval 要求');

    const r4 = ts.selectTests({ changedFiles: ['lib/lonely.js', 'newFeature.test.js'], manifest: man(), repoTests: repo, io: io });
    assert(r4.skippedUnsafe.some(function (s) { return s.file === 'newFeature.test.js' && s.classification === 'unlisted'; }) && r4.requiresHumanApproval === true, 'SL-26c. manifest 未登録の新規 test は unlisted として実行しない（fail-closed）');

    const r5 = ts.selectTests({ changedFiles: ['tools/devAutopilot/newThing.js'], manifest: man(), repoTests: repo, io: io });
    assert(r5.selected.some(function (s) { return s.file === 'devAutopilotStep1.test.js' && s.reasons.indexOf('autopilot_test_mapping') !== -1; }), 'SL-26d. tools/devAutopilot/** の変更 → devAutopilot*.test.js を必ず candidate 化');

    const r6 = ts.selectTests({ changedFiles: ['README.md'], manifest: man(), repoTests: repo, io: io });
    assert(r6.uncoveredFiles.length === 0 && r6.requiresHumanApproval === false, 'SL-27. 説明文（.md）のみの変更は coverage 対象外');

    const badBase = man([{ file: 'outputDraftAuth.test.js', class: 'conditional' }]);
    const r7 = ts.selectTests({ changedFiles: ['lib/util.js'], manifest: badBase, repoTests: repo, io: io });
    const r8 = ts.selectTests({ changedFiles: ['../x.js'], manifest: man(), repoTests: repo, io: io });
    const r9 = ts.selectTests({ changedFiles: [], manifest: man(), repoTests: repo, io: io });
    const r10 = ts.selectTests({ changedFiles: ['lib/util.js'], manifest: { tests: [] }, repoTests: repo, io: io });
    const r11 = ts.selectTests(null);
    const r12 = ts.selectTests({ changedFiles: ['lib/util.js'], manifest: man(), repoTests: repo.concat(['ghost.test.js']), io: io });
    assert([r7, r8, r9, r10, r11, r12].every(function (r) { return r.selected.length === 0 && r.requiresHumanApproval === true && r.errors.length > 0; }), 'SL-28. baseline 非 safe・不正 path・空入力・不正 manifest・読めない test → selected 0 で fail-closed');

    assert(ts.isForbiddenCommand('npm run dev-check').forbidden && ts.isForbiddenCommand('powershell -File ./dev-check.ps1').forbidden
      && ts.isForbiddenCommand('npm test').forbidden && ts.isForbiddenCommand('node --test').forbidden && ts.isForbiddenCommand('node server.js').forbidden
      && ts.isForbiddenCommand('').forbidden && !ts.isForbiddenCommand('node indexInlineScriptSafety.test.js').forbidden, 'SL-29. dev-check・npm test・auto discovery・server 起動は reserved forbidden command');
  }

  caseHeader('P. Protected 10件 hash 不変・sandbox 違反 0');
  {
    const pv = pc.verify(protectedBefore, pc.snapshot(ROOT), PROTECTED_BASELINE);
    assert(pv.ok && PROTECTED_FILES.length === 10, 'P-1. Protected 10件の hash が開始時・終了時とも baseline 一致（' + pv.mode + (pv.ok ? '' : ' ' + pv.reasons.join(',')) + '）');
    assert(violations.length === 0, 'P-2. sandbox 違反 0（network / DB / provider / fs write / env file）');
  }

  console.log('\n────────────────────────────────────────────────────────────');
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exit(1); }
  console.log('🟢 All Development Autopilot Step 1 cases passed');
})();
