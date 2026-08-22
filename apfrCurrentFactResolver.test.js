'use strict';
// apfrCurrentFactResolver.test.js
// Decision108（APFR）Phase 1: Current Fact Resolver 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / Web Search 0 / 本番案件への操作0
// index.html内の _apfrHasSupersedes() / _apfrCandidateFacts() / _apfrResolveCurrentFact() /
// _apfrResolveCurrentFacts() と等価なロジックをNode環境で再現して検証する。

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック（Core validator + Resolver）
// ──────────────────────────────────────────────────────────────
const APFR_CLASSIFICATION_VALUES = ['fact', 'prediction', 'inference', 'unknown'];
const APFR_SOURCE_METHOD_VALUES = [
  'a8_screen_user_verified', 'advertiser_lp_user_verified', 'manual_user_input',
  'web_retrieved', 'generated_hypothesis', 'ai_interpretation', 'calculated',
];
const APFR_FACT_ALLOWED_SOURCE_METHODS = ['a8_screen_user_verified', 'advertiser_lp_user_verified'];
const APFR_VERIFICATION_STATUS_VALUES = ['unverified', 'user_verified'];
const INTEL_RELIABILITY_VALUES = ['high', 'medium', 'low', 'unknown'];

const APFR_FIELD_ORDER = ['aspName', 'programId', 'productName', 'productCategory',
  'partnershipStatus', 'landingUrl', 'productLinkAvailable',
  'payout', 'epc', 'approvalRate', 'cookieWindowDays', 'approvalEstimateDays',
  'reviewRequired', 'mobileOptimized', 'itpSupported', 'linkManagerSupported', 'listingPolicy',
  'listingNgWords', 'regulatoryCategory', 'complianceRestrictions', 'advertisingDisclosureRequirements'];

function _apfrIsJsonSafeValue(value) {
  if (value === undefined) return false;
  if (typeof value === 'function' || typeof value === 'symbol') return false;
  try { return JSON.stringify(value) !== undefined; } catch (e) { return false; }
}

function validateApfrRecord(record, expectedCaseId, expectedProductIdentifier) {
  var errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { valid: false, errors: ['record_missing_or_invalid'] };
  }
  if (typeof record.factId !== 'string' || !record.factId) errors.push('factId_missing');
  if (typeof record.caseId !== 'string' || !record.caseId) errors.push('caseId_missing');
  else if (expectedCaseId && record.caseId !== expectedCaseId) errors.push('caseId_mismatch');
  if (typeof record.productIdentifier !== 'string' || !record.productIdentifier) errors.push('productIdentifier_missing');
  else if (expectedProductIdentifier && record.productIdentifier !== expectedProductIdentifier) errors.push('productIdentifier_mismatch');
  if (typeof record.field !== 'string' || !record.field) errors.push('field_missing');
  if (APFR_CLASSIFICATION_VALUES.indexOf(record.classification) === -1) errors.push('invalid_classification');
  if (APFR_SOURCE_METHOD_VALUES.indexOf(record.sourceMethod) === -1) errors.push('invalid_sourceMethod');
  if (APFR_VERIFICATION_STATUS_VALUES.indexOf(record.verificationStatus) === -1) errors.push('invalid_verificationStatus');
  if (typeof record.recordedAt !== 'string' || !record.recordedAt || isNaN(Date.parse(record.recordedAt))) errors.push('invalid_recordedAt');
  if (!_apfrIsJsonSafeValue(record.value)) {
    errors.push(record.value === undefined ? 'value_missing' : 'value_not_json_safe');
  }
  if (record.aspName != null && typeof record.aspName !== 'string') errors.push('invalid_aspName');
  if (record.sourceReference != null && typeof record.sourceReference !== 'string') errors.push('invalid_sourceReference');
  if (record.reliability != null && INTEL_RELIABILITY_VALUES.indexOf(record.reliability) === -1) errors.push('invalid_reliability');
  if (record.classification === 'fact') {
    if (APFR_FACT_ALLOWED_SOURCE_METHODS.indexOf(record.sourceMethod) === -1) errors.push('fact_requires_verified_source_method');
    if (record.verificationStatus !== 'user_verified') errors.push('fact_requires_user_verified_status');
    if (record.verifiedBy !== 'user') errors.push('fact_requires_verifiedBy_user');
    if (typeof record.verifiedAt !== 'string' || !record.verifiedAt || isNaN(Date.parse(record.verifiedAt))) errors.push('fact_requires_valid_verifiedAt');
  } else {
    if (record.verifiedBy != null && record.verifiedBy !== 'user') errors.push('invalid_verifiedBy');
    if (record.verifiedAt != null && (typeof record.verifiedAt !== 'string' || isNaN(Date.parse(record.verifiedAt)))) errors.push('invalid_verifiedAt');
  }
  return { valid: errors.length === 0, errors: errors };
}

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
    return validateApfrRecord(f, caseId, pid).valid === true;
  });
}

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
        if (outside) {
          if (outside.field !== field) return { status: 'ambiguous', currentFact: null, candidates: pool, reason: 'cross_field_reference' };
          if (outside.caseId !== product.caseId) return { status: 'ambiguous', currentFact: null, candidates: pool, reason: 'cross_case_reference' };
          if (outside.productIdentifier !== product.productIdentifier) return { status: 'ambiguous', currentFact: null, candidates: pool, reason: 'cross_product_reference' };
          return { status: 'ambiguous', currentFact: null, candidates: pool, reason: 'invalid_target_reference' };
        }
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
    var order = (typeof APFR_FIELD_ORDER !== 'undefined' && Array.isArray(APFR_FIELD_ORDER)) ? APFR_FIELD_ORDER : [];
    order.forEach(function (field) {
      var r = _apfrResolveCurrentFact(product, field);
      if (r.status === 'resolved') { out.resolved[field] = r.currentFact; out.resolvedCount++; }
      else if (r.status === 'none') { out.none.push(field); out.noneCount++; }
      else { out.ambiguous.push({ field: field, reason: r.reason, candidates: r.candidates }); out.ambiguousCount++; }
    });
  } catch (e) { /* fail-open */ }
  return out;
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
    verificationStatus: 'user_verified', verifiedBy: 'user',
    verifiedAt: '2026-08-21T22:00:00.000Z', recordedAt: '2026-08-21T22:00:00.000Z',
  }, o);
}
function mkProduct(facts, opts) {
  return Object.assign({ caseId: CASE_A, productIdentifier: PID, productName: 'プラファスト', aspName: 'A8.net', facts: facts }, opts || {});
}

// ──────────────────────────────────────────────────────────────
caseHeader('1. Fact 0件 → none');
{
  const r = _apfrResolveCurrentFact(mkProduct([]), 'epc');
  assert(r.status === 'none' && r.currentFact === null, '1-1. status=none / currentFact=null');
  assert(r.reason === 'no_fact', '1-2. reason=no_fact');
}

caseHeader('2. Fact 1件 → resolved');
{
  const f = mkFact({ factId: 'a1', field: 'epc', value: 34.24 });
  const r = _apfrResolveCurrentFact(mkProduct([f]), 'epc');
  assert(r.status === 'resolved' && r.currentFact.factId === 'a1', '2-1. resolved / 該当Fact');
  assert(r.reason === 'single_fact', '2-2. reason=single_fact');
}

caseHeader('3. legacy 2件 → recordedAt最新');
{
  const old = mkFact({ factId: 'a1', field: 'listingNgWords', value: ['法人名'], recordedAt: '2026-08-21T22:17:46.268Z' });
  const neu = mkFact({ factId: 'a2', field: 'listingNgWords', value: ['商品名', '法人名'], recordedAt: '2026-08-21T22:23:17.266Z' });
  const r = _apfrResolveCurrentFact(mkProduct([old, neu]), 'listingNgWords');
  assert(r.status === 'resolved' && r.currentFact.factId === 'a2', '3-1. 新しい方をresolved');
  assert(r.reason === 'latest_recordedAt', '3-2. reason=latest_recordedAt');
  assert(r.candidates.length === 2, '3-3. candidatesに旧Factも含まれる（履歴保持）');
}

caseHeader('4. legacy timestamp collision → ambiguous');
{
  const t = '2026-08-21T22:20:00.000Z';
  const f1 = mkFact({ factId: 'a1', field: 'epc', value: 1, recordedAt: t });
  const f2 = mkFact({ factId: 'a2', field: 'epc', value: 2, recordedAt: t });
  const r = _apfrResolveCurrentFact(mkProduct([f1, f2]), 'epc');
  assert(r.status === 'ambiguous' && r.currentFact === null, '4-1. ambiguous / currentFact=null');
  assert(r.reason === 'recordedAt_collision', '4-2. reason=recordedAt_collision（恣意的tie-breakerなし）');
}

caseHeader('5. explicit A→B → B');
{
  const A = mkFact({ factId: 'A', field: 'epc', value: 1, recordedAt: '2026-08-21T22:00:00.000Z' });
  const B = mkFact({ factId: 'B', field: 'epc', value: 2, recordedAt: '2026-08-21T22:10:00.000Z', supersedesFactId: 'A' });
  const r = _apfrResolveCurrentFact(mkProduct([A, B]), 'epc');
  assert(r.status === 'resolved' && r.currentFact.factId === 'B', '5-1. Bをresolved');
  assert(r.reason === 'explicit_chain', '5-2. reason=explicit_chain');
}

caseHeader('6. explicit A→B→C → C');
{
  const A = mkFact({ factId: 'A', field: 'epc', value: 1 });
  const B = mkFact({ factId: 'B', field: 'epc', value: 2, supersedesFactId: 'A' });
  const C = mkFact({ factId: 'C', field: 'epc', value: 3, supersedesFactId: 'B' });
  const r = _apfrResolveCurrentFact(mkProduct([A, B, C]), 'epc');
  assert(r.status === 'resolved' && r.currentFact.factId === 'C', '6-1. chain終端Cをresolved');
}

caseHeader('7. chainとrecordedAtが逆 → chain優先');
{
  // Cが最も古いrecordedAtだが、明示chainの終端であるCを採る
  const A = mkFact({ factId: 'A', field: 'epc', value: 1, recordedAt: '2026-08-21T23:00:00.000Z' });
  const B = mkFact({ factId: 'B', field: 'epc', value: 2, recordedAt: '2026-08-21T22:30:00.000Z', supersedesFactId: 'A' });
  const C = mkFact({ factId: 'C', field: 'epc', value: 3, recordedAt: '2026-08-21T22:00:00.000Z', supersedesFactId: 'B' });
  const r = _apfrResolveCurrentFact(mkProduct([A, B, C]), 'epc');
  assert(r.status === 'resolved' && r.currentFact.factId === 'C', '7-1. recordedAt最古でもchain終端Cを採用');
  assert(r.reason === 'explicit_chain', '7-2. reason=explicit_chain（recordedAtで上書きしない）');
}

caseHeader('8. self reference → ambiguous');
{
  const A = mkFact({ factId: 'A', field: 'epc', value: 1, supersedesFactId: 'A' });
  const r = _apfrResolveCurrentFact(mkProduct([A]), 'epc');
  assert(r.status === 'ambiguous' && r.reason === 'self_reference', '8-1. self_reference → ambiguous');
}

caseHeader('9. orphan → ambiguous');
{
  const B = mkFact({ factId: 'B', field: 'epc', value: 2, supersedesFactId: 'NOT_EXIST' });
  const r = _apfrResolveCurrentFact(mkProduct([B]), 'epc');
  assert(r.status === 'ambiguous' && r.reason === 'orphan_reference', '9-1. orphan_reference → ambiguous');
  assert(r.currentFact === null, '9-2. currentFact=null（単一Factでも安全側）');
}

caseHeader('10. cycle A→B→A → ambiguous');
{
  const A = mkFact({ factId: 'A', field: 'epc', value: 1, supersedesFactId: 'B' });
  const B = mkFact({ factId: 'B', field: 'epc', value: 2, supersedesFactId: 'A' });
  const r = _apfrResolveCurrentFact(mkProduct([A, B]), 'epc');
  assert(r.status === 'ambiguous' && r.reason === 'circular_chain', '10-1. circular_chain → ambiguous');
}

caseHeader('11. branch A→B / A→C → ambiguous');
{
  const A = mkFact({ factId: 'A', field: 'epc', value: 1 });
  const B = mkFact({ factId: 'B', field: 'epc', value: 2, supersedesFactId: 'A' });
  const C = mkFact({ factId: 'C', field: 'epc', value: 3, supersedesFactId: 'A' });
  const r = _apfrResolveCurrentFact(mkProduct([A, B, C]), 'epc');
  assert(r.status === 'ambiguous' && r.reason === 'branched_chain', '11-1. 同一Factを複数がsupersede → ambiguous');
}

caseHeader('12. multiple terminal → ambiguous');
{
  // A→B（chain1終端B）と、独立chain C→D（終端D）が並存
  const A = mkFact({ factId: 'A', field: 'epc', value: 1 });
  const B = mkFact({ factId: 'B', field: 'epc', value: 2, supersedesFactId: 'A' });
  const C = mkFact({ factId: 'C', field: 'epc', value: 3 });
  const D = mkFact({ factId: 'D', field: 'epc', value: 4, supersedesFactId: 'C' });
  const r = _apfrResolveCurrentFact(mkProduct([A, B, C, D]), 'epc');
  assert(r.status === 'ambiguous' && r.reason === 'multiple_chain_terminals', '12-1. 終端2件 → ambiguous');
}

caseHeader('13. cross-field supersedes → ambiguous');
{
  const X = mkFact({ factId: 'X', field: 'payout', value: '5000' });
  const B = mkFact({ factId: 'B', field: 'epc', value: 2, supersedesFactId: 'X' });
  const r = _apfrResolveCurrentFact(mkProduct([X, B]), 'epc');
  assert(r.status === 'ambiguous' && r.reason === 'cross_field_reference', '13-1. 別fieldへの参照 → ambiguous');
}

caseHeader('14. cross-case Fact混入 → 採用禁止');
{
  const foreign = mkFact({ factId: 'F', field: 'epc', value: 999, caseId: CASE_B, recordedAt: '2026-08-22T23:59:00.000Z' });
  const mine = mkFact({ factId: 'M', field: 'epc', value: 34.24, recordedAt: '2026-08-21T22:00:00.000Z' });
  const r = _apfrResolveCurrentFact(mkProduct([foreign, mine]), 'epc');
  assert(r.status === 'resolved' && r.currentFact.factId === 'M', '14-1. 別caseのFactは母集団から除外（より新しくても不採用）');
  assert(r.candidates.every(c => c.caseId === CASE_A), '14-2. candidatesに別caseが混入しない');
  const r2 = _apfrResolveCurrentFact(mkProduct([foreign]), 'epc');
  assert(r2.status === 'none', '14-3. 別caseのみ → none（誤採用しない）');
}

caseHeader('15. cross-product Fact混入 → 採用禁止');
{
  const foreign = mkFact({ factId: 'F', field: 'epc', value: 999, productIdentifier: PID_OTHER, recordedAt: '2026-08-22T23:59:00.000Z' });
  const mine = mkFact({ factId: 'M', field: 'epc', value: 34.24 });
  const r = _apfrResolveCurrentFact(mkProduct([foreign, mine]), 'epc');
  assert(r.status === 'resolved' && r.currentFact.factId === 'M', '15-1. 別商品のFactは母集団から除外');
  assert(r.candidates.every(c => c.productIdentifier === PID), '15-2. candidatesに別商品が混入しない');
  const r2 = _apfrResolveCurrentFact(mkProduct([foreign]), 'epc');
  assert(r2.status === 'none', '15-3. 別商品のみ → none');
}

caseHeader('16. invalid Fact混入 → 採用禁止');
{
  // AI由来sourceMethodでclassification=fact（Fact昇格Contract違反）
  const bad = mkFact({ factId: 'BAD', field: 'epc', value: 999, sourceMethod: 'ai_interpretation', recordedAt: '2026-08-22T23:59:00.000Z' });
  const good = mkFact({ factId: 'G', field: 'epc', value: 34.24 });
  const r = _apfrResolveCurrentFact(mkProduct([bad, good]), 'epc');
  assert(r.status === 'resolved' && r.currentFact.factId === 'G', '16-1. invalid Factは除外（AI生成値を採用しない）');
  const bad2 = mkFact({ factId: 'B2', field: 'epc', value: 1, recordedAt: 'not-a-date' });
  const r2 = _apfrResolveCurrentFact(mkProduct([bad2, good]), 'epc');
  assert(r2.status === 'resolved' && r2.currentFact.factId === 'G', '16-2. recordedAt不正Factは除外');
  const r3 = _apfrResolveCurrentFact(mkProduct([bad]), 'epc');
  assert(r3.status === 'none', '16-3. invalidのみ → none（昇格しない）');
}

caseHeader('17. sourceMethod差で優先しない');
{
  const a8 = mkFact({ factId: 'A8', field: 'regulatoryCategory', value: '医薬部外品', sourceMethod: 'a8_screen_user_verified', recordedAt: '2026-08-21T22:00:00.000Z' });
  const lp = mkFact({ factId: 'LP', field: 'regulatoryCategory', value: '化粧品', sourceMethod: 'advertiser_lp_user_verified', recordedAt: '2026-08-21T23:00:00.000Z' });
  const r = _apfrResolveCurrentFact(mkProduct([a8, lp]), 'regulatoryCategory');
  assert(r.status === 'resolved' && r.currentFact.factId === 'LP', '17-1. sourceMethodではなくrecordedAtで決まる（LPが新しい）');
  const a8new = mkFact({ factId: 'A8N', field: 'regulatoryCategory', value: '医薬部外品', sourceMethod: 'a8_screen_user_verified', recordedAt: '2026-08-22T00:00:00.000Z' });
  const r2 = _apfrResolveCurrentFact(mkProduct([lp, a8new]), 'regulatoryCategory');
  assert(r2.status === 'resolved' && r2.currentFact.factId === 'A8N', '17-2. 逆順でもsourceMethod優先は発生しない');
  const t = '2026-08-21T22:00:00.000Z';
  const r3 = _apfrResolveCurrentFact(mkProduct([
    mkFact({ factId: 'X1', field: 'epc', value: 1, sourceMethod: 'a8_screen_user_verified', recordedAt: t }),
    mkFact({ factId: 'X2', field: 'epc', value: 2, sourceMethod: 'advertiser_lp_user_verified', recordedAt: t }),
  ]), 'epc');
  assert(r3.status === 'ambiguous', '17-3. 同時刻でsourceMethodが違ってもambiguous（優劣をつけない）');
}

caseHeader('18. existing facts 入力非破壊');
{
  const A = mkFact({ factId: 'A', field: 'epc', value: 1, recordedAt: '2026-08-21T22:00:00.000Z' });
  const B = mkFact({ factId: 'B', field: 'epc', value: 2, recordedAt: '2026-08-21T23:00:00.000Z' });
  const facts = [A, B];
  const snapshot = JSON.stringify(facts);
  const order = facts.map(f => f.factId).join(',');
  _apfrResolveCurrentFact(mkProduct(facts), 'epc');
  assert(JSON.stringify(facts) === snapshot, '18-1. facts配列の内容が変わらない');
  assert(facts.map(f => f.factId).join(',') === order, '18-2. facts配列が並べ替えられない');
}

caseHeader('19. product 入力非破壊');
{
  const p = mkProduct([mkFact({ factId: 'A', field: 'epc', value: 1 })]);
  const before = JSON.stringify(p);
  _apfrResolveCurrentFact(p, 'epc');
  _apfrResolveCurrentFacts(p);
  assert(JSON.stringify(p) === before, '19-1. productが書き換わらない');
  const r1 = _apfrResolveCurrentFact(p, 'epc');
  const r2 = _apfrResolveCurrentFact(p, 'epc');
  assert(r1.currentFact.factId === r2.currentFact.factId, '19-2. 複数回呼んでも同一結果（副作用なし）');
}

caseHeader('20. Fact配列順非依存');
{
  const A = mkFact({ factId: 'A', field: 'epc', value: 1, recordedAt: '2026-08-21T22:00:00.000Z' });
  const B = mkFact({ factId: 'B', field: 'epc', value: 2, recordedAt: '2026-08-21T23:00:00.000Z' });
  const fwd = _apfrResolveCurrentFact(mkProduct([A, B]), 'epc');
  const rev = _apfrResolveCurrentFact(mkProduct([B, A]), 'epc');
  assert(fwd.currentFact.factId === 'B' && rev.currentFact.factId === 'B', '20-1. legacy: 配列順を変えても同じ結果');
  const C = mkFact({ factId: 'C', field: 'epc', value: 1 });
  const D = mkFact({ factId: 'D', field: 'epc', value: 2, supersedesFactId: 'C' });
  const f2 = _apfrResolveCurrentFact(mkProduct([C, D]), 'epc');
  const r2 = _apfrResolveCurrentFact(mkProduct([D, C]), 'epc');
  assert(f2.currentFact.factId === 'D' && r2.currentFact.factId === 'D', '20-2. chain: 配列順を変えても同じ結果');
}

// ──────────────────────────────────────────────────────────────
caseHeader('21. 21/21 プラファストfixture（本番相当・22 records）');
{
  const FIELDS_21 = [
    ['aspName', 'A8.net'], ['programId', 's00000015266009'], ['productName', 'プラファスト'],
    ['productCategory', 'スキンケア'], ['partnershipStatus', '提携中'],
    ['landingUrl', 'https://leona-beauty.jp/prafast/a8/'], ['productLinkAvailable', true],
    ['payout', '5000'], ['epc', 34.24], ['approvalRate', 100], ['cookieWindowDays', 90],
    ['approvalEstimateDays', 30], ['reviewRequired', true], ['mobileOptimized', true],
    ['itpSupported', true], ['linkManagerSupported', true], ['listingPolicy', '一部ok'],
    ['listingNgWords', ['商品名', '法人名']], ['regulatoryCategory', '医薬部外品'],
    ['complianceRestrictions', ['A8.netのルール遵守', '広告表示必須', '法律関連の禁止事項遵守', 'リスティング違反禁止']],
    ['advertisingDisclosureRequirements', ['広告とわかる表示が必要', 'ファーストビュー等の一般消費者が閲覧できる位置にわかりやすく表示']],
  ];
  const facts = [];
  let t = Date.parse('2026-08-21T21:00:00.000Z');
  FIELDS_21.forEach(function (pair, i) {
    if (pair[0] === 'listingNgWords') {
      facts.push(mkFact({ factId: 'apf_old_ng', field: 'listingNgWords', value: ['法人名'], recordedAt: '2026-08-21T22:17:46.268Z' }));
      facts.push(mkFact({ factId: 'apf_new_ng', field: 'listingNgWords', value: ['商品名', '法人名'], recordedAt: '2026-08-21T22:23:17.266Z' }));
      return;
    }
    const sm = (pair[0] === 'regulatoryCategory') ? 'advertiser_lp_user_verified' : 'a8_screen_user_verified';
    facts.push(mkFact({ factId: 'apf_' + i, field: pair[0], value: pair[1], sourceMethod: sm, recordedAt: new Date(t += 60000).toISOString() }));
  });
  assert(facts.length === 22, '21-0. fixtureは22レコード');

  const all = _apfrResolveCurrentFacts(mkProduct(facts));
  assert(all.resolvedCount === 21, `21-1. resolvedCount=21（実測 ${all.resolvedCount}）`);
  assert(all.noneCount === 0, `21-2. noneCount=0（実測 ${all.noneCount}）`);
  assert(all.ambiguousCount === 0, `21-3. ambiguousCount=0（実測 ${all.ambiguousCount}）`);
  assert(Object.keys(all.resolved).length === 21, '21-4. resolvedに21field');
  assert(APFR_FIELD_ORDER.every(f => all.resolved[f] !== undefined), '21-5. APFR_FIELD_ORDER全fieldがresolved');
  assert(all.resolved.epc.value === 34.24 && all.resolved.approvalRate.value === 100, '21-6. 成果グループの値が正しい');
  assert(all.resolved.regulatoryCategory.sourceMethod === 'advertiser_lp_user_verified', '21-7. regulatoryCategoryのsourceMethodが保持される');
}

caseHeader('22. listingNgWords訂正履歴 → 新Fact');
{
  const old = mkFact({ factId: 'apf_06f0c5be', field: 'listingNgWords', value: ['法人名'], recordedAt: '2026-08-21T22:17:46.268Z' });
  const neu = mkFact({ factId: 'apf_72a473ae', field: 'listingNgWords', value: ['商品名', '法人名'], recordedAt: '2026-08-21T22:23:17.266Z' });
  const r = _apfrResolveCurrentFact(mkProduct([old, neu]), 'listingNgWords');
  assert(r.status === 'resolved', '22-1. resolved');
  assert(JSON.stringify(r.currentFact.value) === JSON.stringify(['商品名', '法人名']), '22-2. 訂正Fact ["商品名","法人名"] がcurrent');
  assert(r.currentFact.factId === 'apf_72a473ae', '22-3. factIdが訂正Fact');
  assert(r.candidates.length === 2 && r.candidates.some(c => c.factId === 'apf_06f0c5be'), '22-4. 旧Factは削除されずcandidatesに残る');
}

caseHeader('23. legacy factsなし → none');
{
  const legacy = { caseId: CASE_A, productIdentifier: PID, productName: 'プラファスト' }; // factsキーなし
  const r = _apfrResolveCurrentFact(legacy, 'epc');
  assert(r.status === 'none' && r.currentFact === null, '23-1. factsキー未存在 → none（例外なし）');
  const all = _apfrResolveCurrentFacts(legacy);
  assert(all.noneCount === 21 && all.resolvedCount === 0 && all.ambiguousCount === 0, '23-2. 全21fieldがnone');
}

caseHeader('24. unknown field → 安全な明示結果');
{
  const f = mkFact({ factId: 'A', field: 'epc', value: 1 });
  const r = _apfrResolveCurrentFact(mkProduct([f]), 'notAField');
  assert(r.status === 'none' && r.currentFact === null, '24-1. APFR_FIELD_META外のfield → none');
  const r2 = _apfrResolveCurrentFact(mkProduct([f]), '');
  assert(r2.status === 'ambiguous' && r2.reason === 'invalid_field', '24-2. 空field → ambiguous（fail-closed）');
  const r3 = _apfrResolveCurrentFact(mkProduct([f]), null);
  assert(r3.status === 'ambiguous' && r3.reason === 'invalid_field', '24-3. null field → ambiguous');
}

caseHeader('25. malformed product → fail-closed');
{
  assert(_apfrResolveCurrentFact(null, 'epc').status === 'ambiguous', '25-1. product=null → ambiguous');
  assert(_apfrResolveCurrentFact(undefined, 'epc').status === 'ambiguous', '25-2. product=undefined → ambiguous');
  assert(_apfrResolveCurrentFact([], 'epc').status === 'ambiguous', '25-3. product=配列 → ambiguous');
  assert(_apfrResolveCurrentFact({}, 'epc').reason === 'invalid_product_scope', '25-4. caseId/pid欠落 → invalid_product_scope');
  assert(_apfrResolveCurrentFact({ caseId: CASE_A }, 'epc').status === 'ambiguous', '25-5. productIdentifier欠落 → ambiguous');
  assert(_apfrResolveCurrentFact({ caseId: '', productIdentifier: PID, facts: [] }, 'epc').status === 'ambiguous', '25-6. 空caseId → ambiguous');
  const bad = _apfrResolveCurrentFacts(null);
  assert(bad.resolvedCount === 0 && bad.ambiguousCount === 21, '25-7. _apfrResolveCurrentFacts(null) → 全field ambiguous');
}

// ──────────────────────────────────────────────────────────────
caseHeader('26. 案Dの核心: 明示chainと独立legacyの並存 → ambiguous');
{
  // A, B supersedes A, D（relationなし）
  const A = mkFact({ factId: 'A', field: 'epc', value: 1, recordedAt: '2026-08-21T22:00:00.000Z' });
  const B = mkFact({ factId: 'B', field: 'epc', value: 2, recordedAt: '2026-08-21T22:10:00.000Z', supersedesFactId: 'A' });
  const D = mkFact({ factId: 'D', field: 'epc', value: 9, recordedAt: '2026-08-21T22:20:00.000Z' });
  const r = _apfrResolveCurrentFact(mkProduct([A, B, D]), 'epc');
  assert(r.status === 'ambiguous', '26-1. chain終端Bと独立legacy Dの並存 → ambiguous');
  assert(r.reason === 'multiple_chain_terminals', '26-2. reason=multiple_chain_terminals');
  assert(r.currentFact === null, '26-3. currentFact=null（BとDを勝手に混ぜない）');
  // recordedAtが最新のDを採ることも、chain終端のBを採ることもしない
  assert(r.candidates.length === 3, '26-4. candidatesは3件すべて提示（判断材料は残す）');
}

caseHeader('27. Resolverはread-only（classification昇格をしない）');
{
  const pred = mkFact({ factId: 'P', field: 'epc', value: 1, classification: 'prediction', sourceMethod: 'ai_interpretation', verificationStatus: 'unverified', verifiedBy: null, verifiedAt: null });
  const r = _apfrResolveCurrentFact(mkProduct([pred]), 'epc');
  assert(r.status === 'resolved' && r.currentFact.classification === 'prediction', '27-1. predictionはpredictionのまま（昇格しない）');
  assert(r.currentFact.verificationStatus === 'unverified', '27-2. verificationStatusを書き換えない');
  const mixed = _apfrResolveCurrentFact(mkProduct([
    mkFact({ factId: 'F1', field: 'epc', value: 1, recordedAt: '2026-08-21T22:00:00.000Z' }),
    mkFact({ factId: 'P1', field: 'epc', value: 2, classification: 'prediction', sourceMethod: 'ai_interpretation', verificationStatus: 'unverified', verifiedBy: null, verifiedAt: null, recordedAt: '2026-08-21T23:00:00.000Z' }),
  ]), 'epc');
  assert(mixed.currentFact.factId === 'P1', '27-3. valid predictionもcurrent候補になりうる（利用側がclassificationで判断）');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All APFR Phase 1 current fact resolver cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
