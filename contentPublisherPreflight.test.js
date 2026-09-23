'use strict';
// contentPublisherPreflight.test.js
// Option B / B-2: Independent Publisher Preflight Gate の deterministic テスト。
//
//   ★ 実行は必ずこのファイル名を明示指定する（node contentPublisherPreflight.test.js）。
//   ★ shared/contentClaimPlanning.js（純関数）と、index.html の Content Evidence ブロック
//     （ce-approval-panel 直後の <script>）を vm で実行する。fetch は vm 内 mock のみ。
//   ★ 外部出口は冒頭で fail-closed に封鎖する（network / credential env / .env / 禁止 module / fs write）。
//   ★ Protected 10件の hash を開始時・終了時に read-only で取得し、全件一致を assert する。

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');
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
function hashProtected() {
  const out = {};
  PROTECTED_FILES.forEach(function (rel) {
    try { out[rel] = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'); }
    catch (e) { out[rel] = 'unreadable:' + e.code; }
  });
  return out;
}
const protectedBefore = hashProtected();

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
const BLOCKED_BARE = new Set(['axios', 'dotenv', '@supabase/supabase-js', 'http2', 'undici', 'child_process', 'node:http2', 'node:child_process']);
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

const cp = require('./shared/contentClaimPlanning');
const ea = require('./shared/evidenceAcquisition');

const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const blockStart = idx.indexOf('<div id="ce-approval-panel"');
const scriptStart = idx.indexOf('<script>', blockStart) + '<script>'.length;
const scriptEnd = idx.indexOf('</script>', scriptStart);
if (blockStart === -1 || scriptEnd === -1) throw new Error('Content Evidence block not found');
const CE_BLOCK = idx.slice(scriptStart, scriptEnd);

const CASE = 'case-x';
const OUT = 'out-1';
const GP = 'general_practice';
function intent(id, ct) { return { intentId: id, caseId: CASE, topic: 't-' + id, question: 'Formal question ' + id, claimTypeCandidate: ct || GP, status: 'proposed' }; }
function cand(id, url) { return { intentId: id, sourceUrl: url, sourceMethod: 'web_retrieved', verificationStatus: 'unverified', createdBy: 'system', sourceName: null, query: 'q-' + id }; }

// ── 実 Trial（2026-09-23）の構成を再現する fixture ──
const CI01 = ['https://www.jcia.org/user/public/uv/glossary', 'https://www.jcia.org/user/public/faq', 'https://www.jstage.jst.go.jp/article/sccj/47/4/47_271/_article/-char/ja/',
  'https://www.reddit.com/r/AsianBeauty/comments/s9hnlv', 'https://en.wikipedia.org/wiki/Sunscreen', 'https://www.menard.co.jp/faq/detail_1001204.html'].map(function (u) { return cand('CI-01', u); });
const CI02 = ['https://www.jcia.org/user/business/guideline/uvprotection', 'https://www.jcia.org/user/public/uv/glossary', 'https://jcia.org/user/business/guideline/ingredientlabelling'].map(function (u) { return cand('CI-02', u); });
const CI03 = ['https://www.env.go.jp/chemi/uv/uv_pdf/03.pdf', 'https://www.env.go.jp/chemi/uv/uv_manual.html', 'https://www.wbgt.env.go.jp/heatillness_manual_ov.php'].map(function (u) { return cand('CI-03', u); });
const TRIAL_INTENTS = [intent('CI-01'), intent('CI-02'), intent('CI-03')];
const TRIAL_CANDS = CI01.concat(CI02, CI03);

// ── index.html CE ブロックの vm sandbox（URL はブラウザ標準として渡す） ──
function buildCtx() {
  const ctx = { console: { log: function () {}, warn: function () {}, error: function () {} } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  ['evidenceAcquisition', 'contentClaimPlanning', 'contentEvidenceApproval'].forEach(function (m) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared', m + '.js'), 'utf8'), ctx);
  });
  const els = {};
  ctx.__calls = [];
  Object.assign(ctx, {
    URL: URL,
    document: { getElementById: function (id) { return els[id] || null; } },
    fetch: function (url, init) {
      ctx.__calls.push({ url: String(url), method: (init && init.method) || 'GET' });
      // GET は canonical 無しの row（既存 contentEvidenceUiResolutionContract.test.js の emptyRow と同形）
      const row = { output_id: OUT, case_id: CASE, content_claims: null, content_evidence: null, content_evidence_origin: null };
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true, draft: row, source: 'db' }); } });
    },
    currentMember: { id: 'leader' },
    memberCaseView: { leader: CASE },
    cases: { 'case-x': { id: CASE, title: 'テスト案件' } },
    _ncActiveCaseId: function (m) { const v = ctx.memberCaseView[m]; return (v && v !== 'latest' && v !== '__caselist__') ? v : undefined; },
    escapeHtml: function (x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
  });
  els['ce-approval-panel'] = { id: 'ce-approval-panel', style: {}, innerHTML: '' };
  vm.runInContext(CE_BLOCK, ctx);
  ctx.__els = els;
  ctx._lastOutputDraft = { id: OUT, caseId: CASE, fields: { slides: ['【1枚目】タイトル：x / 本文：y'] } };
  return ctx;
}
// Evidence Search 完了直後の状態を再現（fetch は呼ばない）
function completedCtx(intents, cands) {
  const ctx = buildCtx();
  const plan = ctx._ceBuildPlan(intents, CASE);
  plan.resolutionScope = { kind: 'new', targetClaimIds: intents.map(function (i) { return i.intentId; }), baseClaimIds: [], baseRevision: null, outputId: null };
  ctx._ceState = 'completed';
  ctx._ceLastEvidenceCandidates = cands;
  ctx._ceRenderPanel();
  return ctx;
}
function html(ctx) { return ctx.__els['ce-approval-panel'].innerHTML; }
function count(s, needle) { return s.split(needle).length - 1; }

(async () => {
  console.log('\n=== contentPublisherPreflight.test.js (Option B / B-2: Independent Publisher Preflight Gate) ===');

  caseHeader('SB. sandbox 自己検証');
  {
    const sv = violations.length;
    let blocked = false;
    try { globalThis.fetch('https://example.com'); } catch (e) { blocked = String(e.message).indexOf('SANDBOX_BLOCKED_NETWORK') === 0; }
    assert(blocked, 'SB-1. 実 fetch 封鎖');
    violations.length = sv;
  }

  caseHeader('Case A〜E（shared 純関数・実 Trial 構成）');
  {
    const r = cp.evaluateIndependentPublisherPreflight(TRIAL_INTENTS, TRIAL_CANDS);
    const a = r.byIntent['CI-01'], b = r.byIntent['CI-02'], c = r.byIntent['CI-03'];
    assert(a.status === 'pass' && a.independentPublisherCount === 2 && a.publishers.map(function (p) { return p.key; }).sort().join(',') === 'domain:jcia.org,domain:jst.go.jp',
      'Case A. CI-01: jcia.org（Tier6）+ jst.go.jp（Tier1）→ 独立 publisher 2 → PASS（内容 supports は保証しない）');
    assert(a.ineligibleCandidateCount === 3 && a.eligibleCandidateCount === 3, 'Case A-2. reddit（Tier8）/ wikipedia・menard（Tier7）は算入しない');
    assert(b.status === 'fail' && b.independentPublisherCount === 1 && b.publishers[0].urlCount === 3, 'Case B. CI-02: jcia.org 複数 URL のみ → 1 publisher → FAIL');
    assert(c.status === 'fail' && c.independentPublisherCount === 1 && c.publishers[0].key === 'domain:env.go.jp', 'Case C. CI-03: env.go.jp + wbgt.env.go.jp → 同一 publisher → FAIL');
    assert(r.status === 'fail' && JSON.stringify(r.failedIntentIds) === JSON.stringify(['CI-02', 'CI-03']), 'Gate. 1 Intent でも FAIL なら全体 FAIL（実 Trial は CI-02 / CI-03 が FAIL）');

    const d = cp.evaluateIndependentPublisherPreflight([intent('CI-09')], [
      cand('CI-09', 'https://www.mhlw.go.jp/a.html'),
      cand('CI-09', 'https://www.reddit.com/r/x/1'), cand('CI-09', 'https://www.reddit.com/r/x/2'), cand('CI-09', 'https://x.com/a/1'),
      cand('CI-09', 'https://en.wikipedia.org/wiki/A'), cand('CI-09', 'https://blog.example.com/a'), cand('CI-09', 'https://news.example.net/b'),
    ]);
    assert(d.status === 'fail' && d.byIntent['CI-09'].independentPublisherCount === 1 && d.byIntent['CI-09'].ineligibleCandidateCount === 6,
      'Case D. Tier7 / Tier8 が多数でも Tier1〜6 publisher が1件なら FAIL');

    const e = cp.evaluateIndependentPublisherPreflight([intent('CI-10')], [
      cand('CI-10', 'https://www.env.go.jp/a'), cand('CI-10', 'https://wbgt.env.go.jp/b'), cand('CI-10', 'https://www.data.env.go.jp/c'),
    ]);
    assert(e.byIntent['CI-10'].independentPublisherCount === 1 && e.status === 'fail', 'Case E. 同一 registrable domain の複数 subdomain は 1 publisher');
    const e2 = cp.evaluateIndependentPublisherPreflight([intent('CI-11')], [cand('CI-11', 'https://www.mhlw.go.jp/a'), cand('CI-11', 'https://www.env.go.jp/b')]);
    assert(e2.status === 'pass' && e2.byIntent['CI-11'].independentPublisherCount === 2, 'Case E-2. go.jp の別機関（mhlw / env）は別 publisher（既存 Q2 Contract どおり）');
  }

  caseHeader('Contract（既存純関数の再利用・付け替えなし・対象 claimType）');
  {
    // 判定は既存 evaluateVerifiedPromotion（market ルール）と一致する
    const byHand = ea.evaluateVerifiedPromotion('market', CI02[0], CI02.slice(1));
    assert(byHand.eligible === false && byHand.reason === 'insufficient_independent_sources', 'C-1. CI-02 は既存 evaluateVerifiedPromotion でも独立 source 不足（同一ルール）');
    // 別 Intent の candidate を流用しない
    const r = cp.evaluateIndependentPublisherPreflight([intent('CI-02')], CI02.concat(CI01));
    assert(r.byIntent['CI-02'].independentPublisherCount === 1 && r.status === 'fail', 'C-2. 別 Intent（CI-01）の jst.go.jp を CI-02 へ付け替えない');
    const noIntent = cp.evaluateIndependentPublisherPreflight([intent('CI-02')], CI02.concat([{ sourceUrl: 'https://www.mhlw.go.jp/x' }]));
    assert(noIntent.status === 'fail', 'C-3. intentId の無い candidate は算入しない');
    const law = cp.evaluateIndependentPublisherPreflight([intent('CI-20', 'law_regulation')], [cand('CI-20', 'https://elaws.e-gov.go.jp/a')]);
    assert(law.status === 'not_evaluated' && law.byIntent['CI-20'].applicable === false && law.byIntent['CI-20'].status === 'not_applicable', 'C-4. general_practice 以外は対象外（Gate を止めない・新ルールを作らない）');
    const zero = cp.evaluateIndependentPublisherPreflight([intent('CI-21')], []);
    assert(zero.status === 'fail' && zero.byIntent['CI-21'].candidateCount === 0, 'C-5. candidate 0件の general_practice Intent は FAIL');
    const named = cp.evaluateIndependentPublisherPreflight([intent('CI-22')], [
      Object.assign(cand('CI-22', 'https://www.jcia.org/a'), { sourceName: '日本化粧品工業会' }), cand('CI-22', 'https://www.jcia.org/b')]);
    assert(named.byIntent['CI-22'].independentPublisherCount === 2, 'C-6. publisher key は既存 publisherKeyOf（sourceName 優先→registrable domain）のまま（Identity Contract 不変）');
  }

  caseHeader('Hard Gate UI（FAIL：実 Trial 構成）');
  {
    const ctx = completedCtx(TRIAL_INTENTS, TRIAL_CANDS);
    const h = html(ctx);
    assert(h.indexOf('Independent Publisher Preflight：FAIL') !== -1 && h.indexOf('Independent Publisher不足のため、Verified Excerpt工程へ進めません') !== -1, 'U-1. Evidence Search 完了後に自動評価し FAIL を明示');
    assert(h.indexOf('CI-01：eligible publishers 2') !== -1 && h.indexOf('CI-02：eligible publishers 1') !== -1 && h.indexOf('CI-03：eligible publishers 1') !== -1, 'U-2. Intent 単位の publisher 数を表示');
    assert(h.indexOf('jcia.org（Tier 6）') !== -1 && h.indexOf('env.go.jp（Tier 1）') !== -1, 'U-3. publisher（domain）と Tier を表示');
    assert(count(h, '<textarea id="ce-excerpt-') === 0 && count(h, 'id="ce-excerpt-ok-') === 0, 'U-4. FAIL 中は Verified Excerpt textarea / checkbox を出さない');
    assert(count(h, '<li><strong>') === TRIAL_CANDS.length && count(h, '（出典を開く）') === TRIAL_CANDS.length, 'U-5. candidate 一覧・出典リンクは閲覧可能');
    assert(count(h, 'onchange="_ceSyncMappingFromSelects(0)" disabled') === 2 && h.indexOf('id="ce-submit-btn" onclick="_ceSubmitEvidenceForResolution()" disabled') !== -1, 'U-6. Mapping select / Evidence確定ボタンは disabled');

    // DOM を迂回して state を作っても user_verified にも Resolution にも進まない
    ctx._ceVerifiedExcerpts[0] = { excerpt: '原文', confirmed: true };
    assert(ctx._ceVerifiedExcerptFor(0) === null, 'U-7. FAIL 中は user_verified 化しない（state があっても null）');
    // 既存の送信前検証（Mapping・target・intent）はすべて満たした状態を作る＝Gate だけが止める理由になる
    TRIAL_CANDS.forEach(function (c, i) { ctx._ceMappingDecisions[i] = { claimType: GP, supportType: 'supports' }; });
    ctx._ceClaimTextByCase = { 'case-x': { 'CI-01': 'a', 'CI-02': 'b', 'CI-03': 'c' } };
    const r = await ctx._ceSubmitEvidenceForResolution();
    assert(r.ok === false && r.error === 'independent_publisher_preflight_failed', 'U-8. FAIL 中は Resolution へ進めない（既存検証の後・送信直前で停止）');
    assert(ctx.__calls.filter(function (c) { return c.method !== 'GET'; }).length === 0
      && ctx.__calls.every(function (c) { return c.url.indexOf('/api/output-drafts?') === 0; })
      && ctx.__calls.filter(function (c) { return c.url.indexOf('/api/evidence/web-search') !== -1; }).length === 0,
      'U-9. Resolution POST 0・Evidence Search 0（自動再検索しない）。通信は既存の送信前 canonical 再取得 GET のみ');
    assert(html(ctx).indexOf('Independent Publisher不足のため、Verified Excerpt工程・Evidence確定へ進めません') !== -1, 'U-10. error code に対応する文言を表示');
    assert(ctx._ceLastEvidenceCandidates.length === TRIAL_CANDS.length && ctx._ceState === 'completed', 'U-11. Evidence Search 結果（candidate）は保持');
  }

  caseHeader('Hard Gate UI（PASS）');
  {
    const cands = [cand('CI-01', 'https://www.jcia.org/a'), cand('CI-01', 'https://www.mhlw.go.jp/b'), cand('CI-02', 'https://www.env.go.jp/c'), cand('CI-02', 'https://www.dermatol.or.jp/d')];
    const ctx = completedCtx([intent('CI-01'), intent('CI-02')], cands);
    const h = html(ctx);
    assert(h.indexOf('Independent Publisher Preflight：PASS') !== -1 && h.indexOf('本文が claim を支えるかは未確認です') !== -1, 'P-1. PASS 表示（supports 未確認であることを明示・Resolution PASS と表示しない）');
    assert(h.indexOf('Resolution PASS') === -1, 'P-1b. 「Resolution PASS」とは表示しない');
    assert(count(h, '<textarea id="ce-excerpt-') === cands.length && count(h, 'id="ce-excerpt-ok-') === cands.length, 'P-2. PASS 時は Q4 textarea / checkbox を表示（既存 Q4 UI 維持）');
    assert(h.indexOf('id="ce-submit-btn" onclick="_ceSubmitEvidenceForResolution()">') !== -1 && count(h, '_ceSyncMappingFromSelects(0)" disabled') === 0 && count(h, '_ceSyncMappingFromSelects(0)">') === 2,
      'P-3. PASS 時は Mapping / Evidence確定を disabled にしない');
    ctx._ceVerifiedExcerpts[0] = { excerpt: '原文', confirmed: true };
    assert(ctx._ceVerifiedExcerptFor(0) === '原文', 'P-4. PASS 時は既存どおり user_verified 経路が使える');
  }

  caseHeader('P. Protected 10件 hash 不変');
  {
    const after = hashProtected();
    assert(PROTECTED_FILES.every(function (f) { return protectedBefore[f] === PROTECTED_BASELINE[f] && after[f] === PROTECTED_BASELINE[f]; }), 'P-9. Protected 10件の hash が開始時・終了時とも baseline 一致');
    assert(violations.length === 0, 'P-10. sandbox 違反 0（network / env / fs write / 禁止 module）');
  }

  console.log('\n────────────────────────────────────────────────────────────');
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exit(1); }
  console.log('🟢 All B-2 publisher preflight cases passed');
})().catch(function (e) { console.log('❌ unexpected error: ' + (e && e.stack || e)); process.exit(1); });
