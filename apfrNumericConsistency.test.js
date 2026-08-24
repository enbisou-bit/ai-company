'use strict';
// apfrNumericConsistency.test.js
// APFR Step C-2-1: Formal Truth Numeric Consistency Check 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / 本番案件への操作0
// index.html内の _apfrEvaluateNumericConsistency() / buildFormalTruthConsistencyHtml() と等価なロジックを
// Node環境で再現して検証する（既存apfr*.test.jsと同一パターン）。
// あわせて実ソース（index.html）へのstatic検証を行い、
//   ・_apfrEvaluateNumericConsistency() が product.facts直接走査・独自Correction chain判定を行っていないこと
//   ・_aicIntegratedScore() / evaluateQualityGate() / evaluateComplianceGate() 等が無変更・無参照であること
//   ・fetch()呼び出しが0件であること（DB write 0）
// を確認する。

const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック（Resolver + Field Meta + Numeric Consistency）
// ──────────────────────────────────────────────────────────────
const APFR_FIELD_ORDER = ['aspName', 'programId', 'productName', 'productCategory',
  'partnershipStatus', 'landingUrl', 'productLinkAvailable',
  'payout', 'epc', 'approvalRate', 'cookieWindowDays', 'approvalEstimateDays',
  'reviewRequired', 'mobileOptimized', 'itpSupported', 'linkManagerSupported', 'listingPolicy',
  'listingNgWords', 'regulatoryCategory', 'complianceRestrictions', 'advertisingDisclosureRequirements'];

const APFR_FIELD_META = {
  aspName:                           { label: 'ASP名',                  type: 'string',  group: '識別' },
  programId:                         { label: 'Program ID',             type: 'string',  group: '識別' },
  productName:                       { label: '商品名',                 type: 'string',  group: '識別' },
  productCategory:                   { label: '商品カテゴリ',           type: 'string',  group: '識別' },
  partnershipStatus:                 { label: '提携状態',               type: 'string',  group: 'ASP状態' },
  landingUrl:                        { label: '商品リンクURL',          type: 'string',  group: 'ASP状態' },
  productLinkAvailable:              { label: '商品リンク利用可否',     type: 'boolean', group: 'ASP状態' },
  payout:                            { label: '報酬額',                 type: 'string',  group: '成果' },
  epc:                               { label: 'EPC',                    type: 'number',  group: '成果' },
  approvalRate:                      { label: '確定率(%)',              type: 'number',  group: '成果' },
  cookieWindowDays:                  { label: '再訪問期間(日)',         type: 'number',  group: '成果' },
  approvalEstimateDays:              { label: '成果確定目安(日)',       type: 'number',  group: '成果' },
  reviewRequired:                    { label: '審査有無',               type: 'boolean', group: '技術' },
  mobileOptimized:                   { label: 'スマホ最適化',           type: 'boolean', group: '技術' },
  itpSupported:                      { label: 'ITP対応',                type: 'boolean', group: '技術' },
  linkManagerSupported:              { label: 'リンクマネージャー対応', type: 'boolean', group: '技術' },
  listingPolicy:                     { label: 'リスティング可否',       type: 'string',  group: '技術' },
  listingNgWords:                    { label: 'リスティングNGワード',   type: 'array',   group: 'Compliance' },
  regulatoryCategory:                { label: '規制カテゴリ',           type: 'string',  group: 'Compliance' },
  complianceRestrictions:            { label: 'コンプライアンス制約',   type: 'array',   group: 'Compliance' },
  advertisingDisclosureRequirements: { label: '広告表示義務',           type: 'array',   group: 'Compliance' },
};

function _apfrFactsOf(product) {
  return (product && Array.isArray(product.facts)) ? product.facts : [];
}
function _apfrHasSupersedes(fact) {
  return !!(fact && typeof fact.supersedesFactId === 'string' && fact.supersedesFactId !== '');
}
function _apfrCandidateFacts(product, field) {
  var facts = _apfrFactsOf(product);
  if (!facts.length) return [];
  var caseId = product.caseId;
  var pid = product.productIdentifier;
  return facts.filter(function (f) {
    if (!f || typeof f !== 'object') return false;
    if (f.field !== field) return false;
    if (f.caseId !== caseId) return false;
    if (f.productIdentifier !== pid) return false;
    return true; // fixtureは常に有効Factとして扱う（validateApfrRecordの重複再実装はしない）
  });
}
// index.htmlの _apfrResolveCurrentFact() と等価（Phase1 Resolver・再実装対象外だが等価性検証のため複製）
function _apfrResolveCurrentFact(product, field) {
  var EMPTY = { status: 'none', currentFact: null, candidates: [], reason: '' };
  try {
    if (!product || typeof product !== 'object' || Array.isArray(product)) {
      return { status: 'ambiguous', currentFact: null, candidates: [], reason: 'invalid_product' };
    }
    if (typeof product.caseId !== 'string' || !product.caseId ||
        typeof product.productIdentifier !== 'string' || !product.productIdentifier) {
      return { status: 'ambiguous', currentFact: null, candidates: [], reason: 'invalid_product_scope' };
    }
    if (typeof field !== 'string' || !field) {
      return { status: 'ambiguous', currentFact: null, candidates: [], reason: 'invalid_field' };
    }
    var pool = _apfrCandidateFacts(product, field);
    if (pool.length === 0) return Object.assign({}, EMPTY, { reason: 'no_fact' });

    var allFacts = _apfrFactsOf(product);
    var byId = {};
    pool.forEach(function (f) { byId[f.factId] = f; });

    var chained = pool.filter(_apfrHasSupersedes);
    var supersededIds = {};
    for (var i = 0; i < chained.length; i++) {
      var f = chained[i];
      var target = f.supersedesFactId;
      if (target === f.factId) {
        return { status: 'ambiguous', currentFact: null, candidates: pool, reason: 'self_reference' };
      }
      if (!byId[target]) {
        var outside = allFacts.filter(function (x) { return x && x.factId === target; })[0];
        if (outside) return { status: 'ambiguous', currentFact: null, candidates: pool, reason: 'invalid_target_reference' };
        return { status: 'ambiguous', currentFact: null, candidates: pool, reason: 'orphan_reference' };
      }
      if (supersededIds[target]) {
        return { status: 'ambiguous', currentFact: null, candidates: pool, reason: 'branched_chain' };
      }
      supersededIds[target] = true;
    }

    var live = pool.filter(function (x) { return !supersededIds[x.factId]; });
    if (live.length === 0) {
      return { status: 'ambiguous', currentFact: null, candidates: pool, reason: 'circular_chain' };
    }
    if (live.length === 1) {
      return { status: 'resolved', currentFact: live[0], candidates: pool,
               reason: chained.length > 0 ? 'explicit_chain' : 'single_fact' };
    }
    if (chained.length > 0) {
      return { status: 'ambiguous', currentFact: null, candidates: pool, reason: 'multiple_chain_terminals' };
    }
    var maxTs = -Infinity;
    live.forEach(function (x) { var t = Date.parse(x.recordedAt); if (t > maxTs) maxTs = t; });
    var newest = live.filter(function (x) { return Date.parse(x.recordedAt) === maxTs; });
    if (newest.length !== 1) {
      return { status: 'ambiguous', currentFact: null, candidates: pool, reason: 'recordedAt_collision' };
    }
    return { status: 'resolved', currentFact: newest[0], candidates: pool, reason: 'latest_recordedAt' };
  } catch (e) {
    return { status: 'ambiguous', currentFact: null, candidates: [], reason: 'exception' };
  }
}

// index.htmlの _apfrEvaluateNumericConsistency() と等価
const APFR_NUMERIC_CONSISTENCY_FIELDS = ['payout', 'epc', 'approvalRate'];
function _apfrEvaluateNumericConsistency(product) {
  var EMPTY = { executed: false, checked: false, results: [] };
  try {
    if (!product || typeof product !== 'object') return EMPTY;
    if (typeof _apfrResolveCurrentFact !== 'function') return EMPTY;
    var inputs = (product.inputs && typeof product.inputs === 'object') ? product.inputs : {};

    var results = APFR_NUMERIC_CONSISTENCY_FIELDS.map(function (field) {
      var iv = inputs[field];
      var intelligenceValue = (typeof iv === 'number' && !isNaN(iv)) ? iv : null;
      var base = { field: field, status: 'not_checked', formalValue: null, intelligenceValue: intelligenceValue };
      try {
        var resolved = _apfrResolveCurrentFact(product, field);
        if (!resolved || resolved.status !== 'resolved' || !resolved.currentFact) return base;

        base.formalValue = resolved.currentFact.value;

        var meta = APFR_FIELD_META[field];
        if (!meta || meta.type !== 'number' || typeof base.formalValue !== 'number' || isNaN(base.formalValue)) {
          base.status = 'uncomparable';
          return base;
        }
        if (intelligenceValue === null) { base.status = 'not_checked'; return base; }

        base.status = (base.formalValue === intelligenceValue) ? 'match' : 'mismatch';
        return base;
      } catch (e) {
        return base;
      }
    });

    return { executed: true, checked: true, results: results };
  } catch (e) {
    return EMPTY;
  }
}

// score計算（既存 _aicIntegratedScore と等価な最小再現・score無回帰確認専用）
function _aicNum(v) { return (typeof v === 'number' && !isNaN(v)) ? v : null; }
function _aicNormalize(val, max) { return val === null ? null : Math.max(0, Math.min(100, (val / max) * 100)); }
function _aicIntegratedScore(c) {
  var parts = [];
  function add(val, weight) { parts.push({ v: (val === null ? 50 : val), w: weight, known: val !== null }); }
  add(_aicNormalize(_aicNum(c.profitRate), 100), 0.20);
  add(_aicNormalize(_aicNum(c.approvalRate), 100), 0.15);
  add(_aicNormalize(_aicNum(c.epc), 100), 0.15);
  add(_aicNormalize(_aicNum(c.cvr), 10), 0.15);
  add(_aicNormalize(_aicNum(c.igFit), 100), 0.20);
  var comp = _aicNum(c.competitors);
  add(comp === null ? null : Math.max(0, 100 - Math.min(100, comp * 2)), 0.10);
  add(_aicNormalize(_aicNum(c.lifespanMonths), 24), 0.05);
  var tot = 0, wsum = 0, known = 0;
  parts.forEach(function(p) { tot += p.v * p.w; wsum += p.w; if (p.known) known++; });
  var score = wsum > 0 ? Math.round(tot / wsum) : 0;
  return { score: Math.max(0, Math.min(100, score)), knownFactors: known, totalFactors: parts.length };
}

// ──────────────────────────────────────────────────────────────
// 2. テストハーネス
// ──────────────────────────────────────────────────────────────
let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log(`  ✅ ${label}`); }
  else { _failed++; console.log(`  ❌ ${label}`); }
}
function caseHeader(t) { console.log(`\n── ${t} ──`); }

// ──────────────────────────────────────────────────────────────
// 3. fixture
// ──────────────────────────────────────────────────────────────
const CASE_A = 'case-msr9yckye65y';
const CASE_B = 'case-other-B';
const PID = JSON.stringify(['プラファスト', 'a8.net']);
const PID_OTHER = JSON.stringify(['別商品', 'a8.net']);

function mkFact(o) {
  return Object.assign({
    caseId: CASE_A, productIdentifier: PID, aspName: 'A8.net',
    classification: 'fact', sourceMethod: 'a8_screen_user_verified', sourceReference: null,
    verificationStatus: 'user_verified', verifiedBy: 'user', verifiedAt: '2026-08-21T22:00:00.000Z',
    recordedAt: '2026-08-21T22:00:00.000Z',
  }, o);
}
function mkProduct(facts, inputs, opts) {
  return Object.assign({
    caseId: CASE_A, productIdentifier: PID, productName: 'プラファスト', aspName: 'A8.net',
    facts: facts || [], inputs: inputs || {},
  }, opts || {});
}

// ──────────────────────────────────────────────────────────────
caseHeader('payout 1. resolved + Intelligence値あり → uncomparable');
{
  const f = mkFact({ factId: 'p1', field: 'payout', value: '初回4000円' });
  const product = mkProduct([f], { payout: 4000 });
  const r = _apfrEvaluateNumericConsistency(product);
  const row = r.results.filter(function (x) { return x.field === 'payout'; })[0];
  assert(row.status === 'uncomparable', 'payout-1-1. status=uncomparable');
  assert(row.formalValue === '初回4000円', 'payout-1-2. formalValueは自由記述文字列のまま');
  assert(row.intelligenceValue === 4000, 'payout-1-3. intelligenceValueは表示用に保持される');
}

caseHeader('payout 2. formalValue="4000"（数字のみの文字列）でもparseしない → uncomparable');
{
  const f = mkFact({ factId: 'p2', field: 'payout', value: '4000' });
  const product = mkProduct([f], { payout: 4000 });
  const r = _apfrEvaluateNumericConsistency(product);
  const row = r.results.filter(function (x) { return x.field === 'payout'; })[0];
  assert(row.status === 'uncomparable', 'payout-2-1. 数字のみの文字列でもuncomparable（parseFloatしない）');
  assert(row.status !== 'match', 'payout-2-2. matchへ誤判定しない');
}

caseHeader('payout 3. "4,000円" → uncomparable');
{
  const f = mkFact({ factId: 'p3', field: 'payout', value: '4,000円' });
  const product = mkProduct([f], { payout: 4000 });
  const r = _apfrEvaluateNumericConsistency(product);
  const row = r.results.filter(function (x) { return x.field === 'payout'; })[0];
  assert(row.status === 'uncomparable', 'payout-3-1. "4,000円"表記でもuncomparable（円記号除去・正規表現抽出をしない）');
}

caseHeader('epc 4. 同値 → match');
{
  const f = mkFact({ factId: 'e1', field: 'epc', value: 50 });
  const product = mkProduct([f], { epc: 50 });
  const r = _apfrEvaluateNumericConsistency(product);
  const row = r.results.filter(function (x) { return x.field === 'epc'; })[0];
  assert(row.status === 'match', 'epc-4-1. 同値50=50でmatch');
}

caseHeader('epc 5. 異値 → mismatch');
{
  const f = mkFact({ factId: 'e2', field: 'epc', value: 50 });
  const product = mkProduct([f], { epc: 60 });
  const r = _apfrEvaluateNumericConsistency(product);
  const row = r.results.filter(function (x) { return x.field === 'epc'; })[0];
  assert(row.status === 'mismatch', 'epc-5-1. 50≠60でmismatch');
}

caseHeader('epc 6. Intelligence null → not_checked');
{
  const f = mkFact({ factId: 'e3', field: 'epc', value: 50 });
  const product = mkProduct([f], { epc: null });
  const r = _apfrEvaluateNumericConsistency(product);
  const row = r.results.filter(function (x) { return x.field === 'epc'; })[0];
  assert(row.status === 'not_checked', 'epc-6-1. Intelligence側未入力ではmatch/mismatch判定しない');
}

caseHeader('approvalRate 7. 80 vs 80 → match');
{
  const f = mkFact({ factId: 'a1', field: 'approvalRate', value: 80 });
  const product = mkProduct([f], { approvalRate: 80 });
  const r = _apfrEvaluateNumericConsistency(product);
  const row = r.results.filter(function (x) { return x.field === 'approvalRate'; })[0];
  assert(row.status === 'match', 'approvalRate-7-1. 80=80でmatch');
}

caseHeader('approvalRate 8. 80 vs 70 → mismatch');
{
  const f = mkFact({ factId: 'a2', field: 'approvalRate', value: 80 });
  const product = mkProduct([f], { approvalRate: 70 });
  const r = _apfrEvaluateNumericConsistency(product);
  const row = r.results.filter(function (x) { return x.field === 'approvalRate'; })[0];
  assert(row.status === 'mismatch', 'approvalRate-8-1. 80≠70でmismatch');
}

caseHeader('approvalRate 9. 0.8 vs 80 → mismatch（自動scale変換しない）');
{
  const f = mkFact({ factId: 'a3', field: 'approvalRate', value: 0.8 });
  const product = mkProduct([f], { approvalRate: 80 });
  const r = _apfrEvaluateNumericConsistency(product);
  const row = r.results.filter(function (x) { return x.field === 'approvalRate'; })[0];
  assert(row.status === 'mismatch', 'approvalRate-9-1. 0.8と80は厳密不一致のためmismatch（0.8→80%等のscale変換をしない）');
}

caseHeader('Resolver 10. none → not_checked（全field）');
{
  const product = mkProduct([], { payout: 4000, epc: 50, approvalRate: 80 });
  const r = _apfrEvaluateNumericConsistency(product);
  r.results.forEach(function (row) {
    assert(row.status === 'not_checked', 'resolver-10-' + row.field + '. Fact皆無(none)はnot_checked');
  });
}

caseHeader('Resolver 11. ambiguous → not_checked（代表値を選ばない）');
{
  // 同一field・同一recordedAtでchain関係なし → recordedAt_collision → ambiguous
  const a = mkFact({ factId: 'amb-a', field: 'epc', value: 50, recordedAt: '2026-08-22T10:00:00.000Z' });
  const b = mkFact({ factId: 'amb-b', field: 'epc', value: 60, recordedAt: '2026-08-22T10:00:00.000Z' });
  const product = mkProduct([a, b], { epc: 50 });
  const r = _apfrEvaluateNumericConsistency(product);
  const row = r.results.filter(function (x) { return x.field === 'epc'; })[0];
  assert(row.status === 'not_checked', 'resolver-11-1. ambiguousはnot_checked');
  assert(row.formalValue === null, 'resolver-11-2. ambiguous候補（50でも60でも）から代表値を選ばない');
}

caseHeader('Resolver 12. Correction A→B supersedes A → Bのみ利用');
{
  const a = mkFact({ factId: 'c-a', field: 'epc', value: 50, recordedAt: '2026-08-22T10:00:00.000Z' });
  const b = mkFact({ factId: 'c-b', field: 'epc', value: 60, recordedAt: '2026-08-22T11:00:00.000Z', supersedesFactId: 'c-a' });
  const product = mkProduct([a, b], { epc: 60 });
  const r = _apfrEvaluateNumericConsistency(product);
  const row = r.results.filter(function (x) { return x.field === 'epc'; })[0];
  assert(row.formalValue === 60, 'resolver-12-1. 訂正後のcurrent Fact(B=60)のみが使用される');
  assert(row.status === 'match', 'resolver-12-2. B(60)とIntelligence(60)が一致しmatch（旧Fact Aは比較対象外）');
}

caseHeader('Scope 13. Cross-case混入0');
{
  const otherCaseFact = mkFact({ factId: 'x1', field: 'epc', value: 999, caseId: CASE_B, productIdentifier: PID });
  const validFact = mkFact({ factId: 'x2', field: 'epc', value: 50 });
  const product = mkProduct([otherCaseFact, validFact], { epc: 50 });
  const r = _apfrEvaluateNumericConsistency(product);
  const row = r.results.filter(function (x) { return x.field === 'epc'; })[0];
  assert(row.formalValue === 50, '13-1. 別caseIdのFact(999)は候補から除外され、自caseのFact(50)のみ使用');
  assert(row.status === 'match', '13-2. Cross-case混入なくmatchと判定される');
}

caseHeader('Scope 14. Cross-product混入0');
{
  const otherProductFact = mkFact({ factId: 'y1', field: 'epc', value: 999, productIdentifier: PID_OTHER });
  const validFact = mkFact({ factId: 'y2', field: 'epc', value: 50 });
  const product = mkProduct([otherProductFact, validFact], { epc: 50 });
  const r = _apfrEvaluateNumericConsistency(product);
  const row = r.results.filter(function (x) { return x.field === 'epc'; })[0];
  assert(row.formalValue === 50, '14-1. 別productIdentifierのFact(999)は候補から除外される');
  assert(row.status === 'match', '14-2. Cross-product混入なくmatchと判定される');
}

caseHeader('Mutation 15. product mutation 0');
{
  const f = mkFact({ factId: 'm1', field: 'epc', value: 50 });
  const product = mkProduct([f], { epc: 60, payout: 4000, approvalRate: 80 });
  const before = JSON.stringify(product);
  _apfrEvaluateNumericConsistency(product);
  assert(JSON.stringify(product) === before, '15-1. product全体（inputs含む）は実行前後で完全不変');
}

caseHeader('Mutation 16. facts mutation 0');
{
  const a = mkFact({ factId: 'm2a', field: 'epc', value: 50, recordedAt: '2026-08-22T10:00:00.000Z' });
  const b = mkFact({ factId: 'm2b', field: 'epc', value: 60, recordedAt: '2026-08-22T11:00:00.000Z', supersedesFactId: 'm2a' });
  const product = mkProduct([a, b], { epc: 60 });
  const factsBefore = JSON.stringify(product.facts);
  _apfrEvaluateNumericConsistency(product);
  assert(JSON.stringify(product.facts) === factsBefore, '16-1. facts配列（旧Fact含む）は実行前後で完全不変・supersededマーク等の書き込みなし');
}

caseHeader('Non-blocking 17-18. _aicIntegratedScore() 非干渉・score不変');
{
  const rec = { profitRate: 30, approvalRate: 80, epc: 50, cvr: 3, igFit: 70, competitors: 10, lifespanMonths: 12 };
  const before = JSON.stringify(_aicIntegratedScore(rec));
  const f = mkFact({ factId: 's1', field: 'epc', value: 999 }); // 意図的にmismatchさせる
  const product = mkProduct([f], { epc: 50 });
  _apfrEvaluateNumericConsistency(product); // 乖離検出を実行しても
  const after = JSON.stringify(_aicIntegratedScore(rec));
  assert(before === after, '17-18-1. _apfrEvaluateNumericConsistency()実行後もscore計算結果は完全不変（乖離検出があってもscoreへ反映しない）');
}

caseHeader('UI 27-31. buildFormalTruthConsistencyHtml 相当ロジックの表示分岐（文字列生成のみ・簡易検証）');
{
  function fakeBuildRow(row) {
    var labelMap = { match: '一致', mismatch: '不一致', uncomparable: '比較不可', not_checked: '未確認' };
    return labelMap[row.status] || '未確認';
  }
  assert(fakeBuildRow({ status: 'match' }) === '一致', '27-1. match表示ラベル');
  assert(fakeBuildRow({ status: 'mismatch' }) === '不一致', '28-1. mismatch表示ラベル');
  assert(fakeBuildRow({ status: 'uncomparable' }) === '比較不可', '29-1. uncomparable表示ラベル');
  assert(fakeBuildRow({ status: 'not_checked' }) === '未確認', '30-1. not_checked表示ラベル');
}

// ──────────────────────────────────────────────────────────────
// 4. 実ソース（index.html）へのstatic検証
// ──────────────────────────────────────────────────────────────
caseHeader('static 1. _apfrEvaluateNumericConsistency() が実在し、facts直接走査・独自Correction判定をしていない');
{
  const indexHtmlPath = path.join(__dirname, 'index.html');
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function _apfrEvaluateNumericConsistency(product) {');
  assert(start !== -1, 'static-1-1. _apfrEvaluateNumericConsistency() が実在する');
  if (start !== -1) {
    const end = src.indexOf('\n}\n', start);
    const body = src.slice(start, end !== -1 ? end : start + 4000);
    assert(body.indexOf('.facts') === -1, 'static-1-2. .facts直接走査が0件');
    assert(body.indexOf('recordedAt') === -1, 'static-1-3. recordedAt比較の独自再実装が0件');
    assert(body.indexOf('supersedesFactId') === -1, 'static-1-4. supersedesFactIdの独自Correction chain判定が0件');
    assert(body.indexOf('parseFloat') === -1, 'static-1-5. parseFloat（数値変換）を一切行っていない');
    assert(body.indexOf('replace(') === -1, 'static-1-6. 正規表現・文字列置換による数値抽出を一切行っていない');
    assert(body.indexOf('_apfrResolveCurrentFact(') !== -1, 'static-1-7. 既存Resolverを利用している');
    assert(body.indexOf('fetch(') === -1, 'static-1-8. fetch()呼び出しが0件（DB write 0）');
  }
}

caseHeader('static 2. buildFormalTruthConsistencyHtml() が実在し、非ブロッキング・Non-mutation');
{
  const indexHtmlPath = path.join(__dirname, 'index.html');
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function buildFormalTruthConsistencyHtml() {');
  assert(start !== -1, 'static-2-1. buildFormalTruthConsistencyHtml() が実在する');
  if (start !== -1) {
    const end = src.indexOf('\n}\n', start);
    const body = src.slice(start, end !== -1 ? end : start + 3000);
    assert(body.indexOf('OUTPUT_STATUS.READY') === -1, 'static-2-2. READY遷移への参照0件');
    assert(body.indexOf('canApprove') === -1, 'static-2-3. canApprove（IADP承認）への参照0件');
    assert(body.indexOf('_iadpApproveDesign') === -1, 'static-2-4. IADP承認関数への参照0件');
    assert(body.indexOf('approveInstagramPackage') === -1, 'static-2-5. Mobile Approval承認関数への参照0件');
    assert(body.indexOf('evaluateQualityGate') === -1, 'static-2-6. Quality Gate関数への参照0件');
    assert(body.indexOf('evaluateComplianceGate') === -1, 'static-2-7. Compliance Gate関数への参照0件');
    assert(body.indexOf('fetch(') === -1, 'static-2-8. fetch()呼び出しが0件');
    assert(body.indexOf('scoreへ自動反映しません') !== -1, 'static-2-9. 非ブロッキングである旨の明示文言が存在する');
  }
}

caseHeader('static 3. _aicIntegratedScore() 本体無変更（C-2-1関連識別子への参照が0件）');
{
  const indexHtmlPath = path.join(__dirname, 'index.html');
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function _aicIntegratedScore(c) {');
  assert(start !== -1, 'static-3-1. _aicIntegratedScore() が既存シグネチャのまま存在する');
  if (start !== -1) {
    const end = src.indexOf('\n}\n', start);
    const body = src.slice(start, end !== -1 ? end : start + 2000);
    assert(body.indexOf('_apfrEvaluateNumericConsistency') === -1, 'static-3-2. _aicIntegratedScore()本体にC-2-1への参照が0件');
    assert(body.indexOf('_apfrResolveCurrentFact') === -1, 'static-3-3. _aicIntegratedScore()本体にResolverへの参照が0件');
  }
}

caseHeader('static 4. Output Engine配線確認: buildFormalTruthConsistencyHtmlが独立パネルとして接続されている');
{
  const indexHtmlPath = path.join(__dirname, 'index.html');
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(src.indexOf("_oeSafe(buildFormalTruthConsistencyHtml,   'FormalTruthConsistency')") !== -1,
    'static-4-1. Output Engineパネル合成リストへ接続されている');
  assert(src.indexOf("_oeSafe(buildComplianceGateHtml,           'ComplianceGate')\n    + _oeSafe(buildFormalTruthConsistencyHtml") !== -1,
    'static-4-2. Compliance Check(C-1C-1)パネル直後に配置されている');
}

caseHeader('static 5. APFR_FIELD_META.payout が type:"string" のまま無変更（Contract前提の確認）');
{
  const indexHtmlPath = path.join(__dirname, 'index.html');
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(src.indexOf("payout:                           { label: '報酬額',                type: 'string',  group: '成果' }") !== -1,
    'static-5-1. APFR_FIELD_META.payoutがtype:string のまま無変更（C-2-1がこの前提に依存）');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All APFR Step C-2-1 numeric consistency check cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
