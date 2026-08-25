'use strict';
// apfrCaseDataContext.test.js
// Instagram実運用 Data Context Wiring（LCC Phase2 + Option B）合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / 本番案件への操作0
// index.html内の _buildCaseDataContext() / _cdcBuildFormalTruthLines() / _cdcBuildIntelligenceLines() と
// 等価なロジックをNode環境で再現して検証する（既存apfr*.test.jsと同一パターン）。
// あわせて実ソース（index.html / server.js / openaiClient.js / claudeClient.js）へのstatic検証を行い、
//   ・Path A / Path B が同一helperを使用していること
//   ・server.jsがResolver再実装／facts参照を行っていないこと（C-1A Contract 10-6維持）
//   ・openaiClient.js / claudeClient.js へOption B由来の新規引数が追加されていないこと
//   ・LCC Phase2の既存Case Context配線が維持されていること
// を確認する。

const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック（Resolver + Case Data Context）
// ──────────────────────────────────────────────────────────────
const APFR_FIELD_ORDER = ['aspName', 'programId', 'productName', 'productCategory',
  'partnershipStatus', 'landingUrl', 'productLinkAvailable',
  'payout', 'epc', 'approvalRate', 'cookieWindowDays', 'approvalEstimateDays',
  'reviewRequired', 'mobileOptimized', 'itpSupported', 'linkManagerSupported', 'listingPolicy',
  'listingNgWords', 'regulatoryCategory', 'complianceRestrictions', 'advertisingDisclosureRequirements'];

const APFR_FIELD_META = {
  aspName:                           { label: 'ASP名',                  type: 'string' },
  programId:                         { label: 'Program ID',             type: 'string' },
  productName:                       { label: '商品名',                 type: 'string' },
  productCategory:                   { label: '商品カテゴリ',           type: 'string' },
  partnershipStatus:                 { label: '提携状態',               type: 'string' },
  landingUrl:                        { label: '商品リンクURL',          type: 'string' },
  productLinkAvailable:              { label: '商品リンク利用可否',     type: 'boolean' },
  payout:                            { label: '報酬額',                 type: 'string' },
  epc:                               { label: 'EPC',                    type: 'number' },
  approvalRate:                      { label: '確定率(%)',              type: 'number' },
  cookieWindowDays:                  { label: '再訪問期間(日)',         type: 'number' },
  approvalEstimateDays:              { label: '成果確定目安(日)',       type: 'number' },
  reviewRequired:                    { label: '審査有無',               type: 'boolean' },
  mobileOptimized:                   { label: 'スマホ最適化',           type: 'boolean' },
  itpSupported:                      { label: 'ITP対応',                type: 'boolean' },
  linkManagerSupported:              { label: 'リンクマネージャー対応', type: 'boolean' },
  listingPolicy:                     { label: 'リスティング可否',       type: 'string' },
  listingNgWords:                    { label: 'リスティングNGワード',   type: 'array' },
  regulatoryCategory:                { label: '規制カテゴリ',           type: 'string' },
  complianceRestrictions:            { label: 'コンプライアンス制約',   type: 'array' },
  advertisingDisclosureRequirements: { label: '広告表示義務',           type: 'array' },
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
    return true;
  });
}
// index.htmlの _apfrResolveCurrentFact() と等価（Phase1 Resolver）
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
function _apfrResolveCurrentFacts(product) {
  var out = { resolved: {}, none: [], ambiguous: [], resolvedCount: 0, noneCount: 0, ambiguousCount: 0 };
  try {
    APFR_FIELD_ORDER.forEach(function (field) {
      var r = _apfrResolveCurrentFact(product, field);
      if (r.status === 'resolved') { out.resolved[field] = r.currentFact; out.resolvedCount++; }
      else if (r.status === 'none') { out.none.push(field); out.noneCount++; }
      else { out.ambiguous.push({ field: field, reason: r.reason, candidates: r.candidates }); out.ambiguousCount++; }
    });
  } catch (e) { /* fail-open */ }
  return out;
}

// ── index.htmlの Option B helper 群と等価 ──
const CDC_INTEL_MODULES = [
  { key: 'product',     label: 'Product Intelligence' },
  { key: 'asp',         label: 'ASP Intelligence' },
  { key: 'revenue',     label: 'Revenue Intelligence' },
  { key: 'competition', label: 'Competition Intelligence' },
  { key: 'content',     label: 'Content Intelligence' },
  { key: 'market',      label: 'Market Opportunity Intelligence' },
];
const CDC_INTEL_DERIVED_KEYS = ['integratedScore', 'integratedScoreAverage', 'integratedScoreMax',
  'estimatedSales', 'estimatedProfit', 'knownFactors', 'totalFactors', 'productCount'];
const CDC_INTEL_TOP_KEYS = ['recommendedAspName', 'comparedAspCount', 'market', 'productStatus'];
const CDC_MAX_CHARS = 8000;

function _cdcFormatValue(v) {
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  try { return JSON.stringify(v); } catch (e) { return String(v); }
}
function _cdcIsScalar(v) {
  return v !== null && v !== undefined && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean');
}
function _cdcBuildFormalTruthLines(product) {
  var lines = [];
  try {
    var res = _apfrResolveCurrentFacts(product);
    APFR_FIELD_ORDER.forEach(function (field) {
      var f = res.resolved[field];
      if (!f) return;
      if (f.value === null || f.value === undefined) return;
      var meta = APFR_FIELD_META[field];
      var label = (meta && meta.label) || field;
      lines.push(label + '（' + field + '）: ' + _cdcFormatValue(f.value));
    });
  } catch (e) { /* fail-open */ }
  return lines;
}
function _cdcBuildIntelligenceLines(ctx) {
  var lines = [];
  try {
    if (!ctx || typeof ctx !== 'object') return lines;
    CDC_INTEL_MODULES.forEach(function (m) {
      var mod = ctx[m.key];
      if (!mod || typeof mod !== 'object') return;
      var parts = [];
      var derived = (mod.derived && typeof mod.derived === 'object') ? mod.derived : null;
      if (derived && typeof derived.status === 'string' && derived.status) parts.push('status=' + derived.status);
      var conf = (mod.confidence && typeof mod.confidence === 'object') ? mod.confidence : null;
      if (conf && typeof conf.confidenceLevel === 'string' && conf.confidenceLevel) {
        parts.push('Confidence=' + conf.confidenceLevel
          + (_cdcIsScalar(conf.confidenceScore) ? '(' + conf.confidenceScore + ')' : ''));
      }
      if (derived) {
        CDC_INTEL_DERIVED_KEYS.forEach(function (k) {
          if (_cdcIsScalar(derived[k])) parts.push(k + '=' + _cdcFormatValue(derived[k]));
        });
      }
      CDC_INTEL_TOP_KEYS.forEach(function (k) {
        if (_cdcIsScalar(mod[k])) parts.push(k + '=' + _cdcFormatValue(mod[k]));
      });
      if (parts.length === 0) return;
      lines.push(m.label + ': ' + parts.join(' / '));
    });
  } catch (e) { /* fail-open */ }
  return lines;
}
// expectedCaseId / draft を明示的に渡す形（index.htmlは _lastOutputDraft グローバルを読む）
function _buildCaseDataContext(expectedCaseId, draft) {
  try {
    if (!expectedCaseId) return '';
    if (!draft || String(draft.caseId || '') !== String(expectedCaseId)) return '';
    var fields = draft.fields;
    if (!fields || !fields.intelligenceContext) return '';
    var ctx = fields.intelligenceContext;
    var product = ctx.product;

    var ftLines = [];
    if (product && typeof product === 'object'
        && String(product.caseId || '') === String(expectedCaseId)
        && product.productIdentifier) {
      ftLines = _cdcBuildFormalTruthLines(product);
    }
    var intelLines = _cdcBuildIntelligenceLines(ctx);
    if (ftLines.length === 0 && intelLines.length === 0) return '';

    var out = ['【CASE DATA CONTEXT｜同一caseの保存済み正本（APFR Formal Truth／Intelligence要約）】'];
    if (ftLines.length > 0) {
      out.push('■ 商品Formal Truth（ユーザー本人が確認済みの正式値。推測ではない）');
      out = out.concat(ftLines);
    }
    if (intelLines.length > 0) {
      if (ftLines.length > 0) out.push('');
      out.push('■ Intelligence要約（保存済みの評価結果。新たな推測ではない）');
      out = out.concat(intelLines);
    }
    var text = out.join('\n');
    return text.length > CDC_MAX_CHARS ? text.slice(0, CDC_MAX_CHARS) : text;
  } catch (e) {
    return '';
  }
}

// ── server.js の _mergeCaseContextText() と等価 ──
const CASE_DATA_CONTEXT_MAX_CHARS = 8000;
function _mergeCaseContextText(serverContextText, clientContextText) {
  const parts = [];
  if (typeof serverContextText === 'string' && serverContextText) parts.push(serverContextText);
  if (typeof clientContextText === 'string' && clientContextText) {
    parts.push(clientContextText.length > CASE_DATA_CONTEXT_MAX_CHARS
      ? clientContextText.slice(0, CASE_DATA_CONTEXT_MAX_CHARS)
      : clientContextText);
  }
  return parts.join('\n\n');
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
// 3. fixture（本番 case-msr9yckye65y 相当）
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
// 本番実測値に一致するFormal Truth群
const PROD_FACTS = [
  mkFact({ factId: 'f1',  field: 'aspName', value: 'A8.net' }),
  mkFact({ factId: 'f2',  field: 'programId', value: 's00000015266009' }),
  mkFact({ factId: 'f3',  field: 'productName', value: 'プラファスト' }),
  mkFact({ factId: 'f4',  field: 'productCategory', value: 'スキンケア' }),
  mkFact({ factId: 'f5',  field: 'partnershipStatus', value: '提携中' }),
  mkFact({ factId: 'f6',  field: 'landingUrl', value: 'https://leona-beauty.jp/prafast/a8/' }),
  mkFact({ factId: 'f7',  field: 'productLinkAvailable', value: true }),
  mkFact({ factId: 'f8',  field: 'payout', value: '5000' }),
  mkFact({ factId: 'f9',  field: 'epc', value: 34.24 }),
  mkFact({ factId: 'f10', field: 'approvalRate', value: 100 }),
  mkFact({ factId: 'f11', field: 'cookieWindowDays', value: 90 }),
  mkFact({ factId: 'f12', field: 'approvalEstimateDays', value: 30 }),
  mkFact({ factId: 'f13', field: 'reviewRequired', value: true }),
  mkFact({ factId: 'f14', field: 'mobileOptimized', value: true }),
  mkFact({ factId: 'f15', field: 'itpSupported', value: true }),
  mkFact({ factId: 'f16', field: 'linkManagerSupported', value: true }),
  mkFact({ factId: 'f17', field: 'listingPolicy', value: '一部ok' }),
  mkFact({ factId: 'f18', field: 'regulatoryCategory', value: '医薬部外品' }),
  mkFact({ factId: 'f19', field: 'complianceRestrictions', value: ['A8.netのルール遵守', '広告表示必須'] }),
  mkFact({ factId: 'f20', field: 'advertisingDisclosureRequirements', value: ['広告とわかる表示が必要'] }),
  // listingNgWords: legacy fallback（訂正履歴あり・recordedAt最新が現在値）
  mkFact({ factId: 'f21', field: 'listingNgWords', value: ['法人名'], recordedAt: '2026-08-21T22:00:00.000Z' }),
  mkFact({ factId: 'f22', field: 'listingNgWords', value: ['商品名', '法人名'], recordedAt: '2026-08-22T09:00:00.000Z' }),
];

function mkIntelCtx(over) {
  return Object.assign({
    caseId: CASE_A,
    product: {
      caseId: CASE_A, productIdentifier: PID, productName: 'プラファスト', aspName: 'A8.net',
      facts: PROD_FACTS,
      inputs: { payout: 5000, epc: 34.24, approvalRate: 100 },
      derived: { status: 'watch', integratedScore: 55, knownFactors: 2, totalFactors: 7 },
      confidence: { confidenceLevel: 'Low', confidenceScore: 44 },
      fieldEvidence: { payout: ['ev1'] }, usedEvidenceIds: ['ev1', 'ev2'],
      productStatus: 'candidate',
    },
    asp: { derived: { status: 'insufficient', knownFactors: 3, totalFactors: 4 },
           confidence: { confidenceLevel: 'Medium', confidenceScore: 57 },
           recommendedAspName: 'A8.net', comparedAspCount: 1 },
    revenue: { derived: { status: 'watch', knownFactors: 3, totalFactors: 7, estimatedSales: null, estimatedProfit: null },
               confidence: { confidenceLevel: 'Low', confidenceScore: 49 } },
    competition: { derived: { status: 'insufficient', knownFactors: 0, totalFactors: 3 },
                   confidence: { confidenceLevel: 'Insufficient', confidenceScore: 0 } },
    content: { derived: { status: 'insufficient', knownFactors: 0, totalFactors: 3 },
               confidence: { confidenceLevel: 'Insufficient', confidenceScore: 0 } },
    market: { derived: { status: 'insufficient', integratedScoreAverage: 55, integratedScoreMax: 55, productCount: 1 },
              confidence: { confidenceLevel: 'Low', confidenceScore: 45 }, market: 'スキンケア' },
    evidence: [{ evidenceId: 'ev1', notes: 'x'.repeat(500) }, { evidenceId: 'ev2', notes: 'y'.repeat(500) }],
  }, over || {});
}
function mkDraft(over) {
  return Object.assign({ id: 'out_test', caseId: CASE_A, fields: { intelligenceContext: mkIntelCtx() } }, over || {});
}

const CTX_A = _buildCaseDataContext(CASE_A, mkDraft());

// ──────────────────────────────────────────────────────────────
caseHeader('Formal Truth 到達（4-13）');
{
  assert(CTX_A.indexOf('商品名（productName）: プラファスト') !== -1, '4. productName resolved到達');
  assert(CTX_A.indexOf('ASP名（aspName）: A8.net') !== -1, '5. aspName resolved到達');
  assert(CTX_A.indexOf('商品リンクURL（landingUrl）: https://leona-beauty.jp/prafast/a8/') !== -1, '6. landingUrl resolved到達');
  assert(CTX_A.indexOf('報酬額（payout）: 5000') !== -1 && CTX_A.indexOf('報酬額（payout）: "5000"') === -1,
    '7. payout はstring保存値をそのまま（数値化も引用符付与もしない）');
  assert(CTX_A.indexOf('EPC（epc）: 34.24') !== -1, '8. epc値保持（丸めなし）');
  assert(CTX_A.indexOf('確定率(%)（approvalRate）: 100') !== -1, '9. approvalRate値保持（scale変換なし）');
  assert(CTX_A.indexOf('規制カテゴリ（regulatoryCategory）: 医薬部外品') !== -1, '10. regulatoryCategory到達');
  assert(CTX_A.indexOf('A8.netのルール遵守') !== -1, '11. complianceRestrictions到達');
  assert(CTX_A.indexOf('広告とわかる表示が必要') !== -1, '12. advertisingDisclosureRequirements到達');
  assert(CTX_A.indexOf('商品名') !== -1 && CTX_A.indexOf('listingNgWords') !== -1, '13. listingNgWords到達');
}

caseHeader('Resolver status別の扱い（14-17）');
{
  // none: 対象fieldのFactが存在しない
  const noneDraft = mkDraft();
  noneDraft.fields.intelligenceContext.product.facts = PROD_FACTS.filter(function (f) { return f.field !== 'landingUrl'; });
  const noneCtx = _buildCaseDataContext(CASE_A, noneDraft);
  assert(noneCtx.indexOf('landingUrl') === -1, '14. none（未登録field）は出力されない（推測補完しない）');

  // ambiguous: 同一field・同一recordedAt・chainなし → recordedAt_collision
  const ambDraft = mkDraft();
  ambDraft.fields.intelligenceContext.product.facts = PROD_FACTS.concat([
    mkFact({ factId: 'amb1', field: 'productCategory', value: 'コスメ', recordedAt: '2026-08-21T22:00:00.000Z' }),
  ]);
  const ambCtx = _buildCaseDataContext(CASE_A, ambDraft);
  // ※ 'スキンケア' はMarket Intelligenceの market= にも出現するため、Formal Truth行の有無で判定する。
  assert(ambCtx.indexOf('（productCategory）') === -1, '15-1. ambiguous fieldのFormal Truth行が出力されない');
  assert(ambCtx.indexOf('コスメ') === -1, '15-2. ambiguous候補の代表選択をしない（対立候補も出力しない）');
  assert(_buildCaseDataContext(CASE_A, mkDraft()).indexOf('（productCategory）') !== -1,
    '15-3. 前提: resolvedならproductCategory行は出力される（15-1が実装差ではなくambiguous由来であることの確認）');

  // superseded: A → B(supersedes A)
  const supDraft = mkDraft();
  supDraft.fields.intelligenceContext.product.facts = PROD_FACTS.filter(function (f) { return f.field !== 'productName'; }).concat([
    mkFact({ factId: 'old', field: 'productName', value: '旧商品名', recordedAt: '2026-08-20T10:00:00.000Z' }),
    mkFact({ factId: 'new', field: 'productName', value: '新商品名', recordedAt: '2026-08-22T10:00:00.000Z', supersedesFactId: 'old' }),
  ]);
  const supCtx = _buildCaseDataContext(CASE_A, supDraft);
  assert(supCtx.indexOf('旧商品名') === -1, '16. superseded旧Factは出力されない');
  assert(supCtx.indexOf('新商品名') !== -1, '17. Correction後のCurrent Factのみ出力される');
}

caseHeader('payload制限（18-21, 50）');
{
  assert(CTX_A.indexOf('supersedesFactId') === -1 && CTX_A.indexOf('verifiedAt') === -1
    && CTX_A.indexOf('sourceMethod') === -1 && CTX_A.indexOf('factId') === -1,
    '18. facts履歴（provenance含む全件）を送信しない');
  assert(CTX_A.indexOf('evidenceId') === -1 && CTX_A.indexOf('ev1') === -1, '19. evidence[]を送信しない');
  assert(CTX_A.indexOf('fieldEvidence') === -1, '20. fieldEvidenceを送信しない');
  assert(CTX_A.indexOf('usedEvidenceIds') === -1, '21. usedEvidenceIdsを送信しない');
  const bytes = Buffer.byteLength(CTX_A, 'utf8');
  assert(CTX_A.length <= CDC_MAX_CHARS, '50-1. CDC_MAX_CHARS上限内');
  assert(bytes < 4000, '50-2. payloadサイズが実測4KB未満（intelligenceContext全体25KBの1/6以下）: ' + bytes + ' B');
}

caseHeader('Intelligence 到達（22-28）');
{
  assert(CTX_A.indexOf('Intelligence要約') !== -1, '22. Intelligence summary存在');
  assert(CTX_A.indexOf('Product Intelligence: status=watch') !== -1 && CTX_A.indexOf('integratedScore=55') !== -1, '23. Product Intelligence到達');
  assert(CTX_A.indexOf('ASP Intelligence:') !== -1 && CTX_A.indexOf('recommendedAspName=A8.net') !== -1, '24. ASP Intelligence到達');
  assert(CTX_A.indexOf('Revenue Intelligence: status=watch') !== -1, '25. Revenue Intelligence到達');
  assert(CTX_A.indexOf('Competition Intelligence: status=insufficient') !== -1, '26. Competition Intelligence到達');
  assert(CTX_A.indexOf('Content Intelligence: status=insufficient') !== -1, '27. Content Intelligence到達');
  assert(CTX_A.indexOf('Market Opportunity Intelligence:') !== -1 && CTX_A.indexOf('integratedScoreAverage=55') !== -1, '28. Market Opportunity到達');
}

caseHeader('Cross-case / Cross-product（29-30）');
{
  // 別案件のdraftを渡す＝expectedCaseId不一致
  const otherDraft = mkDraft({ caseId: CASE_B });
  assert(_buildCaseDataContext(CASE_A, otherDraft) === '', '29-1. draft.caseId不一致ではContextを構築しない');
  assert(_buildCaseDataContext(null, mkDraft()) === '', '29-2. caseId未確定ではContextを構築しない（横断fallbackなし）');

  // product.caseIdだけ別案件
  const xcaseDraft = mkDraft();
  xcaseDraft.fields.intelligenceContext.product.caseId = CASE_B;
  const xcaseCtx = _buildCaseDataContext(CASE_A, xcaseDraft);
  assert(xcaseCtx.indexOf('プラファスト') === -1, '29-3. product.caseId不一致でFormal Truthを出力しない（Cross-case混入0）');

  // 別productIdentifierのFactが混入していてもResolverが除外する
  const xprodDraft = mkDraft();
  xprodDraft.fields.intelligenceContext.product.facts = PROD_FACTS.concat([
    mkFact({ factId: 'xp1', field: 'productName', value: '別商品の名前', productIdentifier: PID_OTHER }),
  ]);
  const xprodCtx = _buildCaseDataContext(CASE_A, xprodDraft);
  assert(xprodCtx.indexOf('別商品の名前') === -1, '30-1. 別productIdentifierのFactは出力されない（Cross-product混入0）');
  assert(xprodCtx.indexOf('プラファスト') !== -1, '30-2. 自productのFactは正常に出力される');
}

caseHeader('server受動パススルー / combined（35, 38）');
{
  const clientText = CTX_A;
  // server側IADP Contextがnull（IADP未生成）でも、client Contextがあれば非空
  const combinedNoIadp = _mergeCaseContextText('', clientText);
  assert(combinedNoIadp === clientText, '38-1. server側IADP null + client contextあり → combined非空');
  assert(!!combinedNoIadp === true, '38-2. hasCaseContext相当（!!caseContext）がtrueになる');

  const serverText = '【CASE CONTEXT｜...】\nIADP Package ID: iadp_x';
  const combined = _mergeCaseContextText(serverText, clientText);
  assert(combined.indexOf(serverText) === 0, '35-1. server側Context（LCC Phase2）が先頭に維持される');
  assert(combined.indexOf(clientText) !== -1, '35-2. client側Contextが連結される');
  assert(combined.indexOf('\n\n') !== -1, '35-3. 2ブロックが区切られて連結される');

  // 上限強制（多重防御）
  const huge = 'x'.repeat(CASE_DATA_CONTEXT_MAX_CHARS + 500);
  assert(_mergeCaseContextText('', huge).length === CASE_DATA_CONTEXT_MAX_CHARS, '35-4. server側でも最大長を強制する');
}

caseHeader('旧client互換 / fail-open（51）');
{
  assert(_mergeCaseContextText('svr', '') === 'svr', '51-1. caseDataContext未送信（空）でserver Contextのみ＝既存動作');
  assert(_mergeCaseContextText('svr', undefined) === 'svr', '51-2. caseDataContext未定義（旧client）でも既存動作を維持');
  assert(_mergeCaseContextText('', '') === '', '51-3. 双方空なら空＝Context無し（既存fail-open）');
  assert(_buildCaseDataContext(CASE_A, { caseId: CASE_A, fields: {} }) === '', '51-4. intelligenceContext無しでは空を返す');
  assert(_buildCaseDataContext(CASE_A, { caseId: CASE_A, fields: { intelligenceContext: { caseId: CASE_A } } }) === '',
    '51-5. Formal Truth・Intelligenceとも無い場合は空（空Contextを「情報あり」と誤認させない）');
}

caseHeader('mutation 0（48）');
{
  const draft = mkDraft();
  const before = JSON.stringify(draft);
  _buildCaseDataContext(CASE_A, draft);
  assert(JSON.stringify(draft) === before, '48-1. draft/product/facts/intelligenceContextは実行前後で完全不変');
}

// ──────────────────────────────────────────────────────────────
// 4. 実ソースへのstatic検証
// ──────────────────────────────────────────────────────────────
const indexSrc  = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const serverSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const openaiSrc = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
const claudeSrc = fs.readFileSync(path.join(__dirname, 'claudeClient.js'), 'utf8');

caseHeader('static: 共通helper（1-3）');
{
  const defCount = (indexSrc.match(/function _buildCaseDataContext\(/g) || []).length;
  assert(defCount === 1, '1. 共通helperの定義が1つだけ存在する（Path別helperを作っていない）');

  const atRunIdx = indexSrc.indexOf('_caseDataContext = _buildCaseDataContext(_atRunCaseId)');
  assert(atRunIdx !== -1, '2-1. Path A（atRunWorkflow）が共通helperを使用している');
  assert(indexSrc.indexOf('caseDataContext: _caseDataContext') !== -1, '2-2. Path A POST bodyへcaseDataContextが追加されている（31）');

  assert(indexSrc.indexOf('caseDataContext: _buildCaseDataContext(_ncActiveCaseId(currentMember.id) || null)') !== -1,
    '3. Path B（sendMessage）が同一helperを使用しPOST bodyへ追加している（32）');
}

caseHeader('static: server受動パススルー（33-37）');
{
  // ※ C-1A released test 10-6 が 'complianceContext = null } = req.body' の厳密一致を検証しているため、
  //   caseDataContext は complianceContext より前に配置して既存契約文字列を保持している。
  assert(serverSrc.indexOf('caseDataContext = \'\', complianceContext = null } = req.body') !== -1,
    '33. /api/auto-task の req.body destructuring にcaseDataContextが追加されている（C-1A契約文字列を保持）');
  assert(serverSrc.indexOf('caseId = null, caseDataContext = \'\' } = req.body') !== -1,
    '34. /api/chat の req.body destructuring にcaseDataContextが追加されている');
  assert(serverSrc.indexOf('function _mergeCaseContextText(') !== -1, '35-5. server側は連結helperのみを持つ');
  assert(serverSrc.indexOf('_apfrResolveCurrentFact') === -1, '36. server.js側でResolver参照0（C-1A Contract 10-6維持）');
  assert(serverSrc.indexOf('.facts') === -1, '37. server.js側でfacts参照0（C-1A Contract 10-6維持）');

  // 連結helper本体が内容解釈をしていないこと
  const mStart = serverSrc.indexOf('function _mergeCaseContextText(');
  const mEnd = serverSrc.indexOf('\n}\n', mStart);
  const mBody = serverSrc.slice(mStart, mEnd);
  assert(mBody.indexOf('JSON.parse') === -1 && mBody.indexOf('resolved') === -1 && mBody.indexOf('supersedes') === -1,
    '35-6. 連結helperはJSON解釈・Fact解決を行わない（不透明文字列として扱う）');
}

caseHeader('static: openaiClient / claudeClient 無変更（41-42）');
{
  assert(openaiSrc.indexOf('caseDataContext') === -1, '41-1. openaiClient.jsへOption B由来の新規引数が追加されていない');
  assert(claudeSrc.indexOf('caseDataContext') === -1, '42-1. claudeClient.jsへOption B由来の新規引数が追加されていない');
  // LCC Phase2の既存caseContext配線が維持されていること
  assert(openaiSrc.indexOf('hasCaseContext: !!caseContext') !== -1, '41-2. openaiClient.jsのhasCaseContext判定が維持されている（39）');
  assert(claudeSrc.indexOf('hasCaseContext: !!caseContext') !== -1, '42-2. claudeClient.jsのhasCaseContext判定が維持されている（Claude経路保持）');
}

caseHeader('static: LCC Phase2 既存配線の維持（40, 43-47, 58）');
{
  assert(openaiSrc.indexOf('const formalTruthRule = hasCaseContext ?') !== -1, '40. formalTruthRuleがhasCaseContextで有効化される配線が維持されている');
  assert(openaiSrc.indexOf('const fullInstruction = caseContext ?') !== -1, '43-45. main担当（Writer/Researcher等）へのcaseContext配線が維持されている');
  assert(openaiSrc.indexOf("buildSystemPrompt('reviewer', null, null, { hasCaseContext: !!caseContext })") !== -1, '45. Reviewerへの配線が維持されている');
  assert(openaiSrc.indexOf("buildSystemPrompt('strategy', null, null, { hasCaseContext: !!caseContext })") !== -1, '46. Strategyへの配線が維持されている');
  assert(openaiSrc.indexOf('caseContext, // Formal Truth Priority Architecture: Workflow開始時snapshotをLeader Finalにも伝播') !== -1,
    '47. Leader Finalへの配線が維持されている');
  assert(serverSrc.indexOf('caseContext: autoTaskCaseContext') !== -1, '58. LCC Phase2のserver-side Case Context受け渡しが維持されている');
}

caseHeader('static: IADP必須ガード無変更 / 既存Contract非干渉（11, 52-57）');
{
  assert(serverSrc.indexOf('if (!draft || !draft.fields || !draft.fields.iadp || !draft.fields.iadp.package) return null;') !== -1,
    '11. buildLeaderCaseContext()のIADP必須ガードは変更していない');
  assert(indexSrc.indexOf('_complianceContext = _apfrBuildComplianceContext(') !== -1, '52. C-1A Compliance Context既存配線が維持されている');
  assert(indexSrc.indexOf('function evaluateQualityGate(packageQuality) {') !== -1, '53. evaluateQualityGate()が無変更で存在する');
  assert(indexSrc.indexOf('function evaluateComplianceGate(outputDraft, complianceContext) {') !== -1, '54. evaluateComplianceGate()が無変更で存在する');
  assert(indexSrc.indexOf('var canApprove = _mapAllChecked() && _mapReviewApproved(mai);') !== -1, '55. User Approval（canApprove）算出が無変更');
  assert(indexSrc.indexOf("READY:     'ready',") !== -1, '56. OUTPUT_STATUS.READYが無変更');
  assert(indexSrc.indexOf('function _aicIntegratedScore(c) {') !== -1, '57. _aicIntegratedScore()が無変更で存在する');

  // 新helperがscore/Gate/Approvalへ触れていないこと
  const hStart = indexSrc.indexOf('function _buildCaseDataContext(expectedCaseId) {');
  const hEnd = indexSrc.indexOf('\n}\n', hStart);
  const hBody = indexSrc.slice(hStart, hEnd);
  assert(hBody.indexOf('_aicIntegratedScore') === -1 && hBody.indexOf('evaluateQualityGate') === -1
    && hBody.indexOf('evaluateComplianceGate') === -1 && hBody.indexOf('canApprove') === -1,
    '53-57-2. 新helperはscore/Quality Gate/Compliance Gate/Approvalを一切参照しない');
  assert(hBody.indexOf('fetch(') === -1, '49. 新helperはfetch()を呼ばない（DB write 0）');
}

caseHeader('static: Resolver再実装0（Contract厳守）');
{
  const fStart = indexSrc.indexOf('function _cdcBuildFormalTruthLines(product) {');
  const fEnd = indexSrc.indexOf('\n}\n', fStart);
  const fBody = indexSrc.slice(fStart, fEnd);
  assert(fBody.indexOf('_apfrResolveCurrentFacts(') !== -1, 'R-1. 既存Resolverを呼んでいる');
  assert(fBody.indexOf('.facts') === -1, 'R-2. product.facts直接走査0');
  assert(fBody.indexOf('recordedAt') === -1, 'R-3. recordedAt独自判定0');
  assert(fBody.indexOf('supersedes') === -1, 'R-4. supersedes独自解決0');
  assert(fBody.indexOf('parseFloat') === -1 && fBody.indexOf('Number(') === -1, 'R-5. 数値変換0（値の忠実性）');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All LCC Phase2 + Option B case data context cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
