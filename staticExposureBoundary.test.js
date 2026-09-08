'use strict';
// staticExposureBoundary.test.js
// Phase 2-E Production Activation Step PA-3A — Public Static Asset Boundary の
// deterministic テスト。
//   実HTTP listen 0 / 実network 0 / 実Supabase 0 / 実Storage 0 / 実OpenAI 0 /
//   paid generation 0 / server.js は require しない（起動副作用・process.exit を避けるため
//   ソース文字列としてのみ検証する）。
//
// 検証対象:
//   1. ブラウザが実際に要求する asset（index.html / shared の5ファイル / members/*.md）が
//      引き続き配信許可されること（UI互換）。
//   2. server-only の内部ファイル（docs/ lib/ shared/ supabase/ data/ server.js
//      package.json node_modules *.test.js 等）が配信されないこと。
//   3. traversal / percent-encoding / backslash / dot segment / case variation で
//      internal path へ到達できないこと。
//   4. blocked path が index.html へ 200 fallback されないこと（＝middleware が
//      next() へ委譲し、静的配信へは一切渡らないこと）。
//   5. /api/* が static correction の影響を受けないこと。

const fs = require('fs');
const path = require('path');

const publicStatic = require('./lib/publicStatic');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const ROOT = __dirname;
const BACKSLASH = String.fromCharCode(92);
const NUL = String.fromCharCode(0);

// ── middleware harness ────────────────────────────────────────────────
//   express.static を DI で差し替え、「静的配信へ委譲されたか / next() へ落ちたか」だけを
//   観測する。実ファイルI/O・実HTTP・実listen は一切発生しない。
function runMiddleware(urlPath, method) {
  const served = [];
  const mw = publicStatic.createPublicStaticMiddleware({
    rootDir: ROOT,
    staticFactory: function (root, opts) {
      return function fakeServe(req, res, next) {
        served.push({ root: root, opts: opts, url: req.path });
      };
    },
  });
  let nexted = false;
  mw({ method: method || 'GET', path: urlPath }, {}, function () { nexted = true; });
  return { served: served, nexted: nexted };
}

function isServed(urlPath, method) {
  const r = runMiddleware(urlPath, method);
  return r.served.length === 1 && r.nexted === false;
}
function isPassedThrough(urlPath, method) {
  const r = runMiddleware(urlPath, method);
  return r.served.length === 0 && r.nexted === true;
}

console.log('════════ PA-3A Static Exposure Boundary ════════');

// ═══ 1. 公開すべき asset（UI互換） ═══
caseHeader('1. Public asset allowlist（既存UIが要求する asset）');
assert(publicStatic.resolvePublicAsset('/') === 'index.html', '1a: / → index.html');
assert(publicStatic.resolvePublicAsset('/index.html') === 'index.html', '1b: /index.html 許可');
const SHARED_PUBLIC = [
  'shared/agentResultNormalizer.js',
  'shared/evidenceAcquisition.js',
  'shared/iadpIntelligenceContext.js',
  'shared/instagramAccountDesign.js',
  'shared/instagramAccountDesignQuality.js',
];
SHARED_PUBLIC.forEach(function (rel, i) {
  assert(publicStatic.resolvePublicAsset('/' + rel) === rel, '1c-' + (i + 1) + ': /' + rel + ' 許可');
});
assert(publicStatic.resolvePublicAsset('/members/leader.md') === 'members/leader.md', '1d: /members/leader.md 許可');
assert(publicStatic.resolvePublicAsset('/members/designer_inbox.md') === 'members/designer_inbox.md', '1e: /members/<id>.md は id 動的のため許可');
assert(isServed('/index.html'), '1f: middleware が /index.html を静的配信へ委譲する');
assert(isServed('/'), '1g: middleware が / を静的配信へ委譲する');
assert(isServed('/members/leader.md'), '1h: middleware が /members/leader.md を委譲する');

// 許可 asset が実在すること（allowlist の綴り間違いで UI が壊れないことの保証）
assert(fs.existsSync(path.join(ROOT, 'index.html')), '1i: index.html が実在する');
SHARED_PUBLIC.forEach(function (rel, i) {
  assert(fs.existsSync(path.join(ROOT, rel)), '1j-' + (i + 1) + ': ' + rel + ' が実在する');
});

// ═══ 2. index.html 実走査による UI 互換回帰 ═══
caseHeader('2. index.html が参照する local asset がすべて許可されている');
const indexSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const tagRefs = [];
const tagRe = /(?:src|href)="([^"]+)"/g;
let m;
while ((m = tagRe.exec(indexSrc)) !== null) {
  const v = m[1];
  if (/^(https?:|data:|mailto:|tel:|javascript:|#|\/\/)/i.test(v)) continue;
  if (tagRefs.indexOf(v) === -1) tagRefs.push(v);
}
assert(tagRefs.length > 0, '2a: index.html から local asset 参照を抽出できた（' + tagRefs.length + '件）');
const notAllowed = tagRefs.filter(function (v) {
  return publicStatic.resolvePublicAsset('/' + v.replace(/^\.?\//, '')) === null;
});
assert(notAllowed.length === 0, '2b: index.html のタグ参照はすべて配信許可（不許可: ' + JSON.stringify(notAllowed) + '）');

// fetch() の相対 local path（/api/ 以外）は members/<id>.md のみであること
const fetchRe = /fetch\(\s*[`'"]([^`'"]+)/g;
const fetchRefs = [];
while ((m = fetchRe.exec(indexSrc)) !== null) {
  const v = m[1];
  if (v.indexOf('/api/') === 0 || v.indexOf('api/') === 0) continue;
  if (/^(https?:|data:|\/\/)/i.test(v)) continue;
  if (fetchRefs.indexOf(v) === -1) fetchRefs.push(v);
}
assert(
  fetchRefs.length === 1 && fetchRefs[0].indexOf('members/') === 0 && /\.md$/.test(fetchRefs[0]),
  '2c: 非API fetch は members/<id>.md のみ（実測: ' + JSON.stringify(fetchRefs) + '）'
);

// ═══ 3. blocked internal paths（PA-3A 指示 §12 必須項目） ═══
caseHeader('3. Blocked internal paths');
const MUST_BLOCK = [
  '/docs/04DECISIONS.md',
  '/docs/06HANDOVER_NEXT_CHAT.md',
  '/docs/01PROJECT_STATUS.md',
  '/docs/02PHASE_PROGRESS.md',
  '/docs/CHANGELOG.md',
  '/lib/webSession.js',
  '/lib/carouselAssetStorageSupabase.js',
  '/lib/carouselImageService.js',
  '/lib/carouselImageRoutes.js',
  '/lib/carouselExecutionSupabase.js',
  '/lib/publicStatic.js',
  '/supabase/schema.sql',
  '/supabase_rls_fix.sql',
  '/server.js',
  '/data/conversations/_meta.json',
  '/package.json',
  '/package-lock.json',
  '/cost-logs.json',
  '/claude-cost-logs.json',
  '/claude-quality-history.json',
  '/custom-members.json',
  '/CLAUDE.md',
  '/AI_COMPANY_V1.md',
  '/openaiClient.js',
  '/claudeClient.js',
  '/costTracker.js',
  '/server.log',
  '/server.err',
  '/dev-check.ps1',
  '/shared/carouselImageCore.js',
  '/shared/carouselApproval.js',
  '/carouselImageProduction.test.js',
  '/staticExposureBoundary.test.js',
  '/node_modules/express/package.json',
  '/assets/fonts/NotoSansJP-Regular.otf',
  '/backup-dup-candidates-20260714/',
  '/.env.local',
  '/.env',
  '/.gitignore',
  '/.git/config',
];
MUST_BLOCK.forEach(function (p, i) {
  assert(publicStatic.resolvePublicAsset(p) === null, '3-' + (i + 1) + ': BLOCK ' + p);
});
assert(isPassedThrough('/docs/04DECISIONS.md'), '3z-1: middleware が docs を静的配信へ渡さない');
assert(isPassedThrough('/lib/webSession.js'), '3z-2: middleware が lib を静的配信へ渡さない');
assert(isPassedThrough('/server.js'), '3z-3: middleware が server.js を静的配信へ渡さない');
assert(isPassedThrough('/data/conversations/_meta.json'), '3z-4: middleware が data を静的配信へ渡さない');

// blocked path は「index.html を 200 で返す」形にならない
//   （resolvePublicAsset が index.html を返さない＝SPA fallback による誤検知が無い）
MUST_BLOCK.forEach(function (p, i) {
  assert(publicStatic.resolvePublicAsset(p) !== 'index.html', '3f-' + (i + 1) + ': ' + p + ' は index.html へ fallback されない');
});

// ═══ 4. traversal / dot segments ═══
caseHeader('4. Traversal / dot segments');
const TRAVERSAL = [
  '/../server.js',
  '/members/../server.js',
  '/members/../../server.js',
  '/shared/../lib/webSession.js',
  '/./index.html',
  '/members/./leader.md',
  '/index.html/../server.js',
  '//server.js',
  '/members//leader.md',
  '/docs/',
  '/lib/',
  '/members/',
  '/members/sub/leader.md',
];
TRAVERSAL.forEach(function (p, i) {
  assert(publicStatic.resolvePublicAsset(p) === null, '4-' + (i + 1) + ': REJECT ' + JSON.stringify(p));
});

// ═══ 5. percent encoding ═══
caseHeader('5. Percent encoding');
const ENCODED = [
  '/%2e%2e/server.js',
  '/%2E%2E/server.js',
  '/members/%2e%2e/server.js',
  '/%252e%252e/server.js',
  '/lib%2FwebSession.js',
  '/lib/%77ebSession.js',
  '/docs%2f04DECISIONS.md',
  '/index.html%00',
  '/index%2ehtml',
  '/members/leader.md%20',
];
ENCODED.forEach(function (p, i) {
  assert(publicStatic.resolvePublicAsset(p) === null, '5-' + (i + 1) + ': REJECT ' + JSON.stringify(p));
});

// ═══ 6. backslash / control chars ═══
caseHeader('6. Backslash / control characters');
const RAW = [
  '/lib' + BACKSLASH + 'webSession.js',
  BACKSLASH + 'server.js',
  '/members' + BACKSLASH + '..' + BACKSLASH + 'server.js',
  '/index.html' + NUL,
  '/index.html' + NUL + '.png',
  '/index.html' + String.fromCharCode(10),
  '/index.html' + String.fromCharCode(13),
  '/index.html' + String.fromCharCode(127),
];
RAW.forEach(function (p, i) {
  assert(publicStatic.resolvePublicAsset(p) === null, '6-' + (i + 1) + ': REJECT raw#' + (i + 1));
});
assert(publicStatic.resolvePublicAsset('index.html') === null, '6z: 先頭スラッシュ無しは拒否');
assert(publicStatic.resolvePublicAsset('') === null, '6z2: 空文字は拒否');
assert(publicStatic.resolvePublicAsset(null) === null, '6z3: null は拒否');
assert(publicStatic.resolvePublicAsset(undefined) === null, '6z4: undefined は拒否');
assert(publicStatic.resolvePublicAsset(123) === null, '6z5: 非文字列は拒否');

// ═══ 7. case variation ═══
caseHeader('7. Case variation（case-insensitive filesystem 経由の別名を防ぐ）');
const CASE_VARIANTS = [
  '/SERVER.js',
  '/Server.js',
  '/DOCS/04DECISIONS.md',
  '/Docs/04DECISIONS.md',
  '/LIB/webSession.js',
  '/Lib/WebSession.js',
  '/PACKAGE.json',
  '/Index.HTML',
  '/INDEX.HTML',
  '/SHARED/evidenceAcquisition.js',
  '/MEMBERS/leader.md',
];
CASE_VARIANTS.forEach(function (p, i) {
  assert(publicStatic.resolvePublicAsset(p) === null, '7-' + (i + 1) + ': REJECT ' + p);
});

// ═══ 8. HTTP method / API pass-through ═══
caseHeader('8. Method gating と API pass-through');
assert(isPassedThrough('/index.html', 'POST'), '8a: POST /index.html は静的配信へ渡らない');
assert(isPassedThrough('/index.html', 'PUT'), '8b: PUT は静的配信へ渡らない');
assert(isPassedThrough('/index.html', 'DELETE'), '8c: DELETE は静的配信へ渡らない');
assert(isServed('/index.html', 'HEAD'), '8d: HEAD は静的配信へ委譲する');
const API_PATHS = [
  '/api/cost', '/api/login', '/api/logout', '/api/members', '/api/tasks',
  '/api/output-drafts', '/api/approvals',
  '/api/carousel-image/approval', '/api/carousel-image/generate', '/api/carousel-image/assets',
  '/webhook',
];
API_PATHS.forEach(function (p, i) {
  assert(publicStatic.resolvePublicAsset(p) === null, '8e-' + (i + 1) + ': ' + p + ' は static 対象外');
  assert(isPassedThrough(p, 'GET'), '8f-' + (i + 1) + ': ' + p + ' GET は next() へ素通り');
  assert(isPassedThrough(p, 'POST'), '8g-' + (i + 1) + ': ' + p + ' POST は next() へ素通り');
});

// ═══ 9. middleware 構成 ═══
caseHeader('9. Middleware 構成');
(function () {
  let captured = null;
  publicStatic.createPublicStaticMiddleware({
    rootDir: ROOT,
    staticFactory: function (root, opts) { captured = { root: root, opts: opts }; return function () {}; },
  });
  assert(captured !== null, '9a: staticFactory が生成時に1回だけ呼ばれる');
  assert(captured.root === path.join(ROOT), '9b: root は repo root');
  assert(captured.opts.dotfiles === 'ignore', '9c: dotfiles=ignore');
  assert(captured.opts.index === 'index.html', "9d: index='index.html'（'/' の既存挙動維持）");
  assert(captured.opts.extensions === false, '9e: extensions=false（/server → server.js 補完を無効化）');
  assert(captured.opts.redirect === false, '9f: redirect=false');
})();
let threw = false;
try { publicStatic.createPublicStaticMiddleware({}); } catch (e) { threw = true; }
assert(threw, '9g: rootDir 未指定は throw（fail-closed）');

// allowlist が凍結されており実行時に拡張できない
assert(Object.isFrozen(publicStatic.PUBLIC_FILES), '9h: PUBLIC_FILES は凍結');
assert(Object.isFrozen(publicStatic.PUBLIC_DIR_RULES), '9i: PUBLIC_DIR_RULES は凍結');
assert(publicStatic.PUBLIC_FILES.length === 6, '9j: PUBLIC_FILES は6件（index.html + shared 5件）');

// ═══ 10. server.js 配線（ソース検証・require しない） ═══
caseHeader('10. server.js 配線');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const codeLines = serverSrc.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; });
const codeSrc = codeLines.join('\n');
assert(
  /app\.use\(\s*express\.static\s*\(\s*path\.join\(\s*__dirname\s*\)\s*\)\s*\)/.test(codeSrc) === false,
  '10a: repo root 全体の express.static がコードから除去されている'
);
assert(
  codeSrc.indexOf("require('./lib/publicStatic')") !== -1,
  '10b: server.js が lib/publicStatic を require している'
);
assert(
  /app\.use\(\s*publicStatic\.createPublicStaticMiddleware\(/.test(codeSrc),
  '10c: publicStatic middleware が app.use で登録されている'
);
// SPA fallback（全 path を index.html へ 200 で返す catch-all）が存在しない
assert(
  /app\.get\(\s*['"`]\*/.test(codeSrc) === false && /app\.use\(\s*function[^)]*sendFile/.test(codeSrc) === false,
  '10d: SPA catch-all fallback が存在しない（内部path要求は 404 になる）'
);
// Carousel の安全境界が server.js 上に維持されている
assert(codeSrc.indexOf('registerCarouselImageRoutes') !== -1, '10e: Carousel route 登録が維持されている');
assert(codeSrc.indexOf('_issueWebSessionCookie') !== -1, '10f: session cookie 発行が維持されている');

// ═══ 11. publicStatic.js 自体の衛生 ═══
caseHeader('11. lib/publicStatic.js の衛生');
const psSrc = fs.readFileSync(path.join(ROOT, 'lib', 'publicStatic.js'), 'utf8');
// コメント行（説明文）を除いた「実コード」だけを対象にする
//   ※ 本moduleのヘッダコメントは変更しない設計上の説明として billingLock 等の語を含むため、
//     素の文字列検索では偽陽性になる（carouselExecutionDb.test.js 14h/14i と同じ規約）。
const psCode = psSrc.split('\n').filter(function (l) {
  const t = l.trim();
  return t.indexOf('//') !== 0 && t.indexOf('*') !== 0 && t.indexOf('/*') !== 0;
}).join('\n');
assert(/console\.(log|warn|error|info|debug)\s*\(/.test(psCode) === false, '11a: console 出力を持たない');
assert(psCode.indexOf('process.env') === -1, '11b: env に依存しない（環境で境界が変わらない）');
assert(/\bfs\.(readFile|readFileSync|existsSync|statSync)/.test(psCode) === false, '11c: 自前のファイルI/Oを持たない');
assert(psCode.indexOf('REAL_ENABLED') === -1, '11d: REAL_ENABLED に触れない');
assert(psCode.indexOf('billingLock') === -1, '11e: billingLock に触れない');
assert(psCode.indexOf('createSignedUrl') === -1, '11f: Storage signed URL に触れない');

console.log('\n════════════════════════════════════');
console.log('passed: ' + _passed + ' / failed: ' + _failed);
console.log('════════════════════════════════════');
if (_failed > 0) process.exitCode = 1;
