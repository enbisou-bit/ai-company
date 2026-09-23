'use strict';
// contentClaimSearchPlan.test.js
// Option B / B-1: Formal Claim Intent と Search Query の責務分離の deterministic テスト。
//
//   ★ 実行は必ずこのファイル名を明示指定する（node contentClaimSearchPlan.test.js）。
//   ★ shared/contentClaimPlanning.js（純関数）と、index.html の Content Evidence ブロック
//     （ce-approval-panel 直後の <script>）を vm で実行する。fetch は vm 内 mock のみ。
//   ★ server 側は lib/contentEvidenceResolutionService.js（純関数）だけを使い、canonical 境界を確認する。
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
const service = require('./lib/contentEvidenceResolutionService');
const guard = require('./lib/contentEvidenceResolutionGuard');

const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const blockStart = idx.indexOf('<div id="ce-approval-panel"');
const scriptStart = idx.indexOf('<script>', blockStart) + '<script>'.length;
const scriptEnd = idx.indexOf('</script>', scriptStart);
if (blockStart === -1 || scriptEnd === -1) throw new Error('Content Evidence block not found');
const CE_BLOCK = idx.slice(scriptStart, scriptEnd);

const CASE = 'case-x';
const OUT = 'out-1';

// ── Trial で使用する正式 Formal Intent（B-1 指示どおり） ──
const FORMAL = [
  { topic: '日焼け止めの比較対象の違い',
    question: '日本の公式・公的情報では、日焼け止めの紫外線吸収剤と紫外線散乱剤は、仕組みや特徴にどのような違いがあると説明されていますか？',
    concepts: ['紫外線吸収剤', '紫外線散乱剤'] },
  { topic: '日焼け止めの表示と条件',
    question: '日本の公式情報では、日焼け止めのSPFとPAの表示は何を意味すると説明されていますか？',
    concepts: ['SPF', 'PA'] },
  { topic: '日焼け止めの使い分け',
    question: '日本の公的機関は、日焼け止めを使用場面に応じてどのように選ぶよう案内していますか？',
    concepts: ['日焼け止め', '使用場面'] },
];
const SEARCH = [
  '紫外線吸収剤 紫外線散乱剤 違い 仕組み 日焼け止め 公的',
  '日焼け止め SPF PA 表示 意味 公式',
  '日焼け止め 使用場面 選び方 環境省',
];

// ── index.html CE ブロックの vm sandbox ──
function buildCtx(opts) {
  const o = opts || {};
  const ctx = { console: { log: function () {}, warn: function () {}, error: function () {} } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  ['evidenceAcquisition', 'contentClaimPlanning', 'contentEvidenceApproval'].forEach(function (m) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared', m + '.js'), 'utf8'), ctx);
  });
  const els = {};
  const mk = function (id, value) {
    return { id: id, value: value == null ? '' : value, style: {}, innerHTML: '', getAttribute: function () { return null; },
      insertAdjacentHTML: function (p, h) { this.innerHTML += h; }, querySelectorAll: function () { return []; } };
  };
  ctx.__calls = [];
  ctx.__getRows = o.getRows ? o.getRows.slice() : [];
  Object.assign(ctx, {
    document: { getElementById: function (id) { return els[id] || null; } },
    fetch: function (url, init) {
      const method = (init && init.method) || 'GET';
      ctx.__calls.push({ url: String(url), method: method, body: init && init.body ? JSON.parse(init.body) : null });
      if (method === 'GET') {
        const row = ctx.__getRows.length > 1 ? ctx.__getRows.shift() : ctx.__getRows[0];
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true, draft: row === undefined ? null : row, source: 'db' }); } });
      }
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true, contentEvidenceSummary: { contentEvidenceCount: 6, contentClaimsCount: 3 } }); } });
    },
    currentMember: { id: 'leader' },
    memberCaseView: { leader: CASE },
    cases: { 'case-x': { id: CASE, title: 'テスト案件' } },
    _ncActiveCaseId: function (m) { const v = ctx.memberCaseView[m]; return (v && v !== 'latest' && v !== '__caselist__') ? v : undefined; },
    URL: URL,   // B-2: ブラウザ標準の URL（Source Trust の host 解析に必要。無いと Tier 判定不能＝Gate が fail-closed）
    escapeHtml: function (x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
  });
  els['ce-approval-panel'] = mk('ce-approval-panel');
  if (o.rows && o.rows.length) {
    const rowsEl = mk('ce-intent-rows');
    rowsEl.querySelectorAll = function () { return o.rows.map(function (_, i) { return { getAttribute: function () { return String(i + 1); } }; }); };
    els['ce-intent-rows'] = rowsEl;
    o.rows.forEach(function (r, i) {
      const n = i + 1;
      els['ce-intent-topic-' + n] = mk(null, r.topic);
      els['ce-intent-question-' + n] = mk(null, r.question);
      els['ce-intent-type-' + n] = mk(null, 'general_practice');
      if (r.searchQuery !== undefined) els['ce-intent-searchquery-' + n] = mk(null, r.searchQuery);
      if (r.requiredConcepts !== undefined) els['ce-intent-concepts-' + n] = mk(null, r.requiredConcepts);
      if (r.prohibitedTerms !== undefined) els['ce-intent-prohibited-' + n] = mk(null, r.prohibitedTerms);
    });
  }
  vm.runInContext(CE_BLOCK, ctx);
  ctx.__els = els;
  ctx._lastOutputDraft = { id: OUT, caseId: CASE, fields: { slides: ['【1枚目】タイトル：x / 本文：y'] } };
  return ctx;
}
function posts(ctx) { return ctx.__calls.filter(function (c) { return c.method === 'POST'; }); }
function formalRows(withSearch) {
  return FORMAL.map(function (f, i) {
    const r = { topic: f.topic, question: f.question, requiredConcepts: f.concepts.join('、') };
    if (withSearch) r.searchQuery = SEARCH[i];
    return r;
  });
}
function claimWording(id) { return '提案claim文言（' + ({ 'CI-01': 'いち', 'CI-02': 'に', 'CI-03': 'さん' }[id] || 'x') + '）'; }
// Tier1〜6・別 publisher 2件 × Intent（server 側で grounded になる構成）
function prepareCandidates(ctx, intentIds) {
  const cands = [], decisions = {}, texts = {};
  intentIds.forEach(function (id) {
    ['https://www.env.go.jp/' + id + '.html', 'https://www.jcia.org/' + id + '.html'].forEach(function (u) {
      cands.push({ sourceUrl: u, sourceMethod: 'web_retrieved', createdBy: 'system', verificationStatus: 'unverified', intentId: id, query: 'search-for-' + id });
      decisions[cands.length - 1] = { claimType: 'general_practice', supportType: 'supports' };
    });
    texts[id] = claimWording(id);   // 数字を含めない（既存の未裏付け数値検出に掛からない文言）
  });
  ctx._ceState = 'completed';
  ctx._ceLastEvidenceCandidates = cands;
  ctx._ceMappingDecisions = decisions;
  ctx._ceClaimTextByCase = { 'case-x': texts };
}
function emptyRow() { return { output_id: OUT, case_id: CASE, content_claims: null, content_evidence: null, content_evidence_origin: null }; }
function canonRow() {
  const ids = ['CI-01', 'CI-02'];
  return {
    output_id: OUT, case_id: CASE,
    content_claims: ids.map(function (id) { return { claimId: id, topic: 'topic-' + id, text: 'claim text ' + id, claimType: 'general_practice', status: 'grounded' }; }),
    content_evidence: ids.map(function (id) { return { evidenceId: 'ev-' + id + '-0', claimId: id, caseId: CASE, claim: 'Formal question for ' + id, supportType: 'supports', verificationStatus: 'verified' }; }),
    content_evidence_origin: { mode: 'resolution', version: '1.0.0', caseId: CASE, outputId: OUT, revision: 'rev-' + 'a'.repeat(32) },
  };
}

(async () => {
  console.log('\n=== contentClaimSearchPlan.test.js (Option B / B-1: Formal Intent / Search Query 分離) ===');

  caseHeader('SB. sandbox 自己検証');
  {
    const sv = violations.length;
    let blocked = false;
    try { globalThis.fetch('https://example.com'); } catch (e) { blocked = String(e.message).indexOf('SANDBOX_BLOCKED_NETWORK') === 0; }
    assert(blocked, 'SB-1. 実 fetch 封鎖');
    let blockedMod = false;
    try { require('./openaiClient'); } catch (e) { blockedMod = String(e.message).indexOf('SANDBOX_BLOCKED_MODULE') === 0; }
    assert(blockedMod, 'SB-2. openaiClient 読込不可');
    violations.length = sv;
  }

  caseHeader('T1〜T3. Plan 生成と検索 query（shared 純関数）');
  {
    const intents = FORMAL.map(function (f, i) {
      return { intentId: 'CI-0' + (i + 1), caseId: CASE, topic: f.topic, question: f.question, claimTypeCandidate: 'general_practice',
        status: 'proposed', searchQuery: SEARCH[i], requiredConcepts: f.concepts.slice() };
    });
    const plan = cp.buildContentEvidenceQueries(intents);
    assert(plan.queries.length === 3 && plan.blocked.length === 0, 'T1. Formal question ≠ searchQuery でも3 Intent とも Plan 生成可能');
    assert(plan.queries.every(function (q, i) { return q.query === SEARCH[i] && q.intentId === 'CI-0' + (i + 1); }), 'T2. Search へ渡る query は searchQuery（intentId 維持）');
    assert(plan.queries.every(function (q, i) { return q.query !== FORMAL[i].question; }), 'T2b. Formal question は検索 query に使われていない');

    const legacy = { intentId: 'CI-01', caseId: CASE, topic: 't', question: '日焼け止めのSPFとは何か', claimTypeCandidate: 'general_practice', status: 'proposed' };
    const lp = cp.buildContentEvidenceQueries([legacy]);
    assert(lp.queries.length === 1 && lp.queries[0].query === legacy.question, 'T3. searchQuery なし → question へ fallback（旧データと同一 query）');
    const blank = Object.assign({}, legacy, { searchQuery: '   ' });
    assert(cp.buildContentEvidenceQueries([blank]).queries[0].query === legacy.question, 'T3b. 空白だけの searchQuery も fallback');
    assert(JSON.stringify(Object.keys(lp.queries[0]).sort()) === JSON.stringify(['category', 'intentId', 'query', 'reason']), 'T3c. query entry の shape は従来どおり（API 契約不変）');
  }

  caseHeader('T4〜T6. requiredConcepts / prohibitedTerms（deterministic）');
  {
    const base = { intentId: 'CI-01', caseId: CASE, topic: FORMAL[0].topic, question: FORMAL[0].question, claimTypeCandidate: 'general_practice', status: 'proposed' };
    const ok = cp.validateSearchPlan(Object.assign({}, base, { searchQuery: SEARCH[0], requiredConcepts: ['紫外線吸収剤', '紫外線散乱剤'] }));
    assert(ok.ok === true && ok.missingConcepts.length === 0, 'T4. requiredConcepts が全部ある → PASS');

    // Trial で実際に起きたドリフト（CI-01 を SPF/PA 中心で検索）
    const drift = Object.assign({}, base, { searchQuery: '日焼け止め SPF PA 違い UVB UVA 日本化粧品工業連合会', requiredConcepts: ['紫外線吸収剤', '紫外線散乱剤'] });
    const dr = cp.validateSearchPlan(drift);
    assert(dr.ok === false && dr.missingConcepts.length === 2, 'T5. Trial 実ドリフト query → requiredConcepts 不足で FAIL');
    const dq = cp.buildContentEvidenceQueries([drift]);
    assert(dq.queries.length === 0 && dq.blocked.length === 1 && dq.blocked[0].reason.indexOf('search_plan_invalid:required_concepts_missing') === 0, 'T5b. 不足 Intent は query を生成しない（search_plan_invalid）');
    const half = cp.validateSearchPlan(Object.assign({}, base, { searchQuery: '紫外線吸収剤 仕組み', requiredConcepts: ['紫外線吸収剤', '紫外線散乱剤'] }));
    assert(half.ok === false && half.missingConcepts.length === 1 && half.missingConcepts[0] === '紫外線散乱剤', 'T5c. 1語でも不足すれば FAIL');
    const fb = cp.validateSearchPlan(Object.assign({}, base, { requiredConcepts: ['紫外線吸収剤', '紫外線散乱剤'] }));
    assert(fb.ok === true && fb.usedQuestionFallback === true, 'T5d. searchQuery なしでは question に対して検証する');
    const fw = cp.validateSearchPlan(Object.assign({}, base, { searchQuery: '日焼け止め ＳＰＦ ＰＡ 表示', requiredConcepts: ['SPF', 'PA'] }));
    assert(fw.ok === true, 'T5e. 全角英字は NFKC 正規化で一致');
    const lc = cp.validateSearchPlan(Object.assign({}, base, { searchQuery: 'spf pa 表示', requiredConcepts: ['SPF', 'PA'] }));
    assert(lc.ok === true, 'T5f. requiredConcepts の Latin 文字は大文字小文字を区別しない（NFKC → 小文字化・既存 Gate と同一正規化）');

    // Latin 境界: 単語途中の誤一致を防ぐ（AI 判定なし・deterministic）
    const has = function (sq, concept) { return cp.validateSearchPlan(Object.assign({}, base, { searchQuery: sq, requiredConcepts: [concept] })).ok; };
    assert(has('日焼け止め SPF 表示', 'SPF') && has('日焼け止め spf 表示', 'SPF') && has('日焼け止め SPF50+ 表示', 'SPF'), 'T5g. SPF → SPF / spf / SPF50+ は PASS');
    assert(has('日焼け止め PA 表示', 'PA') && has('日焼け止め pa 表示', 'PA') && has('日焼け止め PA++++ 表示', 'PA'), 'T5h. PA → PA / pa / PA++++ は PASS');
    assert(!has('sunscreen japan 表示', 'PA') && !has('日焼け止め spa 表示', 'PA'), 'T5i. PA → japan / spa は FAIL（英単語途中の誤一致なし）');
    assert(!has('SPFA 表示', 'SPF') && !has('xspf 表示', 'SPF'), 'T5j. SPF → 前後が Latin 文字の単語途中は FAIL');
    assert(has('SPF値とPA値', 'PA') && has('PAの意味', 'PA') && has('(PA)', 'PA') && has('SPF/PA', 'PA'), 'T5k. 日本語・記号・数字との隣接は境界として PASS');
    assert(has('japan spa PA', 'PA'), 'T5l. 誤一致箇所の後に独立した PA があれば PASS（全出現を走査）');
    assert(has('ＳＰＦ５０＋ ｐａ', 'SPF') && has('ＳＰＦ５０＋ ｐａ', 'PA'), 'T5m. 全角英数は NFKC 後に同じ規則で判定');
    assert(has('日焼け止めの使用場面', '使用場面') && !has('日焼け止めの使用', '使用場面'), 'T5n. 日本語 concept は NFKC 部分一致のまま');

    const ph = cp.validateSearchPlan(Object.assign({}, base, { searchQuery: SEARCH[0] + ' SPF', requiredConcepts: ['紫外線吸収剤', '紫外線散乱剤'], prohibitedTerms: ['spf', 'PA'] }));
    assert(ph.ok === false && ph.matchedProhibitedTerms.length === 1 && ph.matchedProhibitedTerms[0] === 'spf', 'T6. prohibitedTerms 該当 → FAIL（大文字小文字を区別しない）');
    const phq = cp.buildContentEvidenceQueries([Object.assign({}, base, { searchQuery: SEARCH[0] + ' SPF', prohibitedTerms: ['SPF'] })]);
    assert(phq.queries.length === 0 && phq.blocked[0].reason.indexOf('prohibited_terms_matched') !== -1, 'T6b. 禁止語を含む Intent は query を生成しない');
    assert(cp.validateSearchPlan(Object.assign({}, base, { requiredConcepts: '紫外線吸収剤' })).ok === false, 'T6c. requiredConcepts が配列でなければ FAIL（fail-closed）');
    const med = cp.buildContentEvidenceQueries([Object.assign({}, base, { searchQuery: '日焼け止め 治療 効果' })]);
    assert(med.queries.length === 0 && med.blocked[0].reason === 'medical_therapeutic_topic_detected', 'T6d. searchQuery にも Safety Filter を適用');
  }

  caseHeader('T7. Formal Intent.question は searchQuery で上書きされない');
  {
    const intent = { intentId: 'CI-01', caseId: CASE, topic: FORMAL[0].topic, question: FORMAL[0].question, claimTypeCandidate: 'general_practice', status: 'proposed', searchQuery: SEARCH[0], requiredConcepts: FORMAL[0].concepts.slice() };
    const snap = JSON.stringify(intent);
    cp.buildContentEvidenceQueries([intent]);
    cp.validateSearchPlan(intent);
    assert(JSON.stringify(intent) === snap, 'T7. shared 関数は Intent を変更しない（非破壊）');

    const ctx = buildCtx({ rows: formalRows(true), getRows: [emptyRow()] });
    const plan = ctx._ceStartPlanFromForm();
    assert(plan && plan.intents.length === 3, 'T7b. UI フォーム（Formal question + searchQuery + requiredConcepts）から Plan 作成');
    assert(plan.intents.every(function (it, i) { return it.question === FORMAL[i].question && it.searchQuery === SEARCH[i]; }), 'T7c. Plan の Intent.question = Formal question・searchQuery は別 field');
    assert(plan.queries.every(function (q, i) { return q.query === SEARCH[i]; }), 'T7d. UI 経由でも検索 query は searchQuery');
    assert(JSON.stringify(plan.intents[0].requiredConcepts) === JSON.stringify(['紫外線吸収剤', '紫外線散乱剤']), 'T7e. requiredConcepts は「、」区切りから配列化');

    const bad = formalRows(false);
    bad[0].searchQuery = '日焼け止め SPF PA 違い UVB UVA 日本化粧品工業連合会';   // Trial 実ドリフト
    const ctxBad = buildCtx({ rows: bad, getRows: [emptyRow()] });
    const badPlan = ctxBad._ceStartPlanFromForm();
    assert(badPlan === null && ctxBad._cePlan === null && String(ctxBad._ceEntryMessage).indexOf('CI-01') !== -1, 'T7f. 1 Intent でも Search Plan 不成立なら Plan を作らない（UI fail-closed）');
    assert(ctxBad.__calls.length === 0, 'T7g. 不成立時は fetch 0 件');
  }

  caseHeader('T8〜T10. Resolution payload と canonical 境界');
  {
    const ctx = buildCtx({ rows: formalRows(true), getRows: [emptyRow()] });
    const plan = ctx._ceStartPlanFromForm();
    prepareCandidates(ctx, plan.intents.map(function (i) { return i.intentId; }));
    const r = await ctx._ceSubmitEvidenceForResolution();
    const p = posts(ctx);
    assert(r.ok === true && p.length === 1, 'T8a. Resolution POST 1回');
    const items = p[0].body.contentEvidenceCandidates;
    assert(items.every(function (it) { const i = Number(it.intentId.slice(3)) - 1; return it.question === FORMAL[i].question && it.topic === FORMAL[i].topic; }), 'T8. payload の topic / question は Formal Intent 由来');
    assert(items.every(function (it) { return JSON.stringify(it).indexOf('search-for-') === -1 && SEARCH.every(function (s) { return JSON.stringify(it).indexOf(s) === -1; }); }), 'T8b. payload に検索文字列（searchQuery / candidate.query）が含まれない');
    assert(guard.validateResolutionRequest({ caseId: CASE, body: p[0].body }).ok === true, 'T8c. payload は server guard 契約を満たす');

    const out = service.resolveContentEvidenceSubmission(items, { caseId: CASE, now: Date.parse('2026-09-23T00:00:00Z') });
    assert(out.contentEvidence.length === 6 && out.contentEvidence.every(function (e) { const i = Number(e.claimId.slice(3)) - 1; return e.claim === FORMAL[i].question; }), 'T9. canonical contentEvidence[].claim = Formal question');
    assert(out.contentEvidence.every(function (e) { return SEARCH.indexOf(e.claim) === -1; }), 'T9b. canonical claim に searchQuery が入らない');
    assert(out.contentClaims.length === 3 && out.contentClaims.every(function (c) { return c.text === claimWording(c.claimId) && c.status === 'grounded'; }), 'T10. contentClaims[].text = proposedClaimText（既存 Contract）');
  }

  caseHeader('T12. U2 既存 canonical 再取得で Formal question と searchQuery を再混同しない');
  {
    const ctx = buildCtx({ getRows: [canonRow()] });
    await ctx._ceLoadCanonicalForEntry();
    const html = ctx._ceBuildCanonicalSectionHtml(CASE);
    assert(html.indexOf('Formal question（canonical・変更不可）: Formal question for CI-01') !== -1, 'T12a. canonical の evidence.claim を Formal question として固定表示');
    assert(html.indexOf('id="ce-canon-searchquery-CI-01"') !== -1 && html.indexOf('id="ce-canon-searchquery-CI-01" oninput="_ceSyncCanonicalSearchQuery(\'CI-01\')" value=""') !== -1, 'T12b. searchQuery 入力は別欄・初期値は空（evidence.claim を自動コピーしない）');
    assert(html.indexOf('id="ce-canon-question-') === -1, 'T12c. Formal question を編集させる入力欄は無い');
    assert(typeof ctx._ceSyncCanonicalQuestion === 'undefined' && typeof ctx._ceCanonicalQuestionByCase === 'undefined' && CE_BLOCK.indexOf('_ceCanonicalQuestionByCase') === -1,
      'T12c-2. 旧 Formal question 書換経路（_ceSyncCanonicalQuestion / _ceCanonicalQuestionByCase）は存在しない');

    ctx._ceToggleCanonicalClaim('CI-01', true);
    ctx._ceToggleCanonicalClaim('CI-02', true);
    ctx.__els['ce-canon-searchquery-CI-01'] = { value: 'U2 再取得用 検索文字列' };
    ctx._ceSyncCanonicalSearchQuery('CI-01');
    const plan = ctx._ceStartPlanFromSelection();
    assert(plan && plan.resolutionScope.kind === 'existing', 'T12d. existing scope の Plan 作成');
    const i1 = plan.intents.filter(function (i) { return i.intentId === 'CI-01'; })[0];
    const i2 = plan.intents.filter(function (i) { return i.intentId === 'CI-02'; })[0];
    assert(i1.question === 'Formal question for CI-01' && i1.searchQuery === 'U2 再取得用 検索文字列', 'T12e. CI-01: question = Formal・searchQuery = 入力値');
    assert(i2.question === 'Formal question for CI-02' && !Object.prototype.hasOwnProperty.call(i2, 'searchQuery'), 'T12f. CI-02: searchQuery 未入力でも question を searchQuery へコピーしない');
    const q1 = plan.queries.filter(function (q) { return q.intentId === 'CI-01'; })[0];
    const q2 = plan.queries.filter(function (q) { return q.intentId === 'CI-02'; })[0];
    assert(q1.query === 'U2 再取得用 検索文字列' && q2.query === 'Formal question for CI-02', 'T12g. 検索 query は searchQuery 優先・未入力は Formal question へ fallback');
    assert(!ctx._ceCanonicalSearchQueryByCase[CASE].hasOwnProperty('CI-02'), 'T12h. 未入力 Claim の searchQuery state は作られない');

    prepareCandidates(ctx, ['CI-01', 'CI-02']);
    await ctx._ceSubmitEvidenceForResolution();
    const p = posts(ctx);
    assert(p.length === 1 && p[0].body.contentEvidenceCandidates.every(function (it) { return it.question === 'Formal question for ' + it.intentId; }), 'T12i. U2 の Resolution payload も question = Formal question');
  }

  caseHeader('T13. U2 searchQuery lifecycle（canonical 再読み込み / stale で当該 case のみ clear）');
  {
    const ctx = buildCtx({ getRows: [canonRow()] });
    await ctx._ceLoadCanonicalForEntry();
    // 別 case の入力（誤って消されないこと）
    ctx._ceCanonicalSearchQueryByCase['case-other'] = { 'CI-09': '別案件の検索文字列' };
    ctx.__els['ce-canon-searchquery-CI-01'] = { value: '再読み込み前の検索文字列' };
    ctx._ceSyncCanonicalSearchQuery('CI-01');
    assert(ctx._ceCanonicalSearchQueryByCase[CASE]['CI-01'] === '再読み込み前の検索文字列', 'T13a. U2 で searchQuery を入力（state に保持）');

    await ctx._ceLoadCanonicalForEntry();   // canonical 再読み込み
    assert(JSON.stringify(ctx._ceCanonicalSearchQueryByCase[CASE]) === '{}', 'T13b. canonical 再読み込みで当該 case の searchQuery を clear');
    assert(ctx._ceCanonicalByCase[CASE].questionByClaim['CI-01'] === 'Formal question for CI-01', 'T13c. 再読み込み後も Formal question は保持');
    const html = ctx._ceBuildCanonicalSectionHtml(CASE);
    assert(html.indexOf('id="ce-canon-searchquery-CI-01" oninput="_ceSyncCanonicalSearchQuery(\'CI-01\')" value=""') !== -1, 'T13d. 再描画された searchQuery 欄は空');
    assert(ctx._ceCanonicalSearchQueryByCase['case-other']['CI-09'] === '別案件の検索文字列', 'T13e. 別 case の searchQuery は消さない');

    ctx.__els['ce-canon-searchquery-CI-01'] = { value: 'stale 前の検索文字列' };
    ctx._ceSyncCanonicalSearchQuery('CI-01');
    ctx._ceMarkCanonicalStale(CASE, 'resolution_succeeded');   // canonical stale 化
    assert(JSON.stringify(ctx._ceCanonicalSearchQueryByCase[CASE]) === '{}', 'T13f. canonical stale 化で当該 case の searchQuery を clear');
    assert(ctx._ceCanonicalSearchQueryByCase['case-other']['CI-09'] === '別案件の検索文字列', 'T13g. stale 化でも別 case の searchQuery は消さない');
    assert(posts(ctx).length === 0, 'T13h. lifecycle 処理で POST 0 件');
  }

  caseHeader('T11. 回帰の前提（旧 UI・旧データ互換）');
  {
    // 新しい入力欄が存在しない（旧 DOM）場合も従来どおり question で Plan を作る
    const rows = FORMAL.map(function (f) { return { topic: f.topic, question: f.question }; });
    const ctx = buildCtx({ rows: rows, getRows: [emptyRow()] });
    const plan = ctx._ceStartPlanFromForm();
    assert(plan && plan.queries.length === 3 && plan.queries.every(function (q, i) { return q.query === FORMAL[i].question; }), 'T11a. 新欄なし → query = question（従来動作）');
    assert(plan.intents.every(function (it) { return !('searchQuery' in it) && !('requiredConcepts' in it) && !('prohibitedTerms' in it); }), 'T11b. 新欄なし → Intent の形は従来と同一');
  }

  caseHeader('P. Protected 10件 hash 不変');
  {
    const after = hashProtected();
    assert(PROTECTED_FILES.every(function (f) { return protectedBefore[f] === PROTECTED_BASELINE[f] && after[f] === PROTECTED_BASELINE[f]; }), 'P-1. Protected 10件の hash が開始時・終了時とも baseline 一致');
    assert(violations.length === 0, 'P-2. sandbox 違反 0（network / env / fs write / 禁止 module）');
  }

  console.log('\n────────────────────────────────────────────────────────────');
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exit(1); }
  console.log('🟢 All B-1 search plan cases passed');
})().catch(function (e) { console.log('❌ unexpected error: ' + (e && e.stack || e)); process.exit(1); });
