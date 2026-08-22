'use strict';
// apfrCorrectionDuplicate.test.js
// Decision108（APFR）CUI-0: Correction-aware Duplicate Policy 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / Web Search 0 / 本番案件への操作0
// index.html内の _apfrRecordsEqual()（CUI-0でsupersedesFactIdをidentityへ追加）と
// _apfrAppendRecord() の duplicate 判定部を Node環境で再現して検証する。

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック
// ──────────────────────────────────────────────────────────────
const APFR_CLASSIFICATION_VALUES = ['fact', 'prediction', 'inference', 'unknown'];
const APFR_SOURCE_METHOD_VALUES = [
  'a8_screen_user_verified', 'advertiser_lp_user_verified', 'manual_user_input',
  'web_retrieved', 'generated_hypothesis', 'ai_interpretation', 'calculated',
];
const APFR_FACT_ALLOWED_SOURCE_METHODS = ['a8_screen_user_verified', 'advertiser_lp_user_verified'];
const APFR_VERIFICATION_STATUS_VALUES = ['unverified', 'user_verified'];
const INTEL_RELIABILITY_VALUES = ['high', 'medium', 'low', 'unknown'];

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

// ★CUI-0対象：supersedesFactId を identity へ追加
function _apfrRecordsEqual(a, b) {
  if (!a || !b) return false;
  if (a.caseId !== b.caseId) return false;
  if (a.productIdentifier !== b.productIdentifier) return false;
  if ((a.aspName || null) !== (b.aspName || null)) return false;
  if (a.field !== b.field) return false;
  if (a.classification !== b.classification) return false;
  if (a.sourceMethod !== b.sourceMethod) return false;
  if ((a.sourceReference || null) !== (b.sourceReference || null)) return false;
  if ((a.supersedesFactId || null) !== (b.supersedesFactId || null)) return false;
  try { if (JSON.stringify(a.value) !== JSON.stringify(b.value)) return false; } catch (e) { return false; }
  return true;
}

// CUI-0以前の実装（回帰比較用）
function _apfrRecordsEqual_BEFORE(a, b) {
  if (!a || !b) return false;
  if (a.caseId !== b.caseId) return false;
  if (a.productIdentifier !== b.productIdentifier) return false;
  if ((a.aspName || null) !== (b.aspName || null)) return false;
  if (a.field !== b.field) return false;
  if (a.classification !== b.classification) return false;
  if (a.sourceMethod !== b.sourceMethod) return false;
  if ((a.sourceReference || null) !== (b.sourceReference || null)) return false;
  try { if (JSON.stringify(a.value) !== JSON.stringify(b.value)) return false; } catch (e) { return false; }
  return true;
}

// _apfrAppendRecord() の duplicate/guard 部分のみ再現（DB保存・pushは行わない）
function appendRecord(product, record, curCaseId) {
  if (!product || !product.productIdentifier) return { ok: false, reason: 'no_adopted_product' };
  var toSave = Object.assign({}, record);
  if (!toSave.factId) toSave.factId = 'apf_gen_' + Math.random().toString(36).slice(2, 10);
  var v = validateApfrRecord(toSave, curCaseId, product.productIdentifier);
  if (!v.valid) return { ok: false, reason: 'invalid', errors: v.errors };
  var facts = _apfrFactsOf(product);
  if (facts.some(function (r) { return r && r.factId === toSave.factId; })) return { ok: false, reason: 'duplicate_factId' };
  if (facts.some(function (r) { return _apfrRecordsEqual(r, toSave); })) return { ok: false, reason: 'duplicate_record' };
  product.facts = facts.concat([toSave]);
  return { ok: true, record: toSave };
}

// Phase 1 Resolver（無回帰確認用・実装と同一）
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
      return { status: 'resolved', currentFact: live[0], candidates: pool, reason: chained.length > 0 ? 'explicit_chain' : 'single_fact' };
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
const CASE_A = 'case-test-A';
const CASE_B = 'case-test-B';
const PID = JSON.stringify(['プラファスト', 'a8.net']);
const PID_OTHER = JSON.stringify(['別商品', 'a8.net']);

function mkFact(o) {
  return Object.assign({
    caseId: CASE_A, productIdentifier: PID, aspName: 'A8.net',
    field: 'epc', classification: 'fact', sourceMethod: 'a8_screen_user_verified', sourceReference: null,
    verificationStatus: 'user_verified', verifiedBy: 'user',
    verifiedAt: '2026-08-22T00:00:00.000Z', recordedAt: '2026-08-22T00:00:00.000Z',
  }, o);
}
function mkProduct(facts) {
  return { caseId: CASE_A, productIdentifier: PID, productName: 'プラファスト', aspName: 'A8.net', facts: facts || [] };
}

// ──────────────────────────────────────────────────────────────
caseHeader('1. 通常Record同士の完全同一 → duplicate（従来挙動維持）');
{
  const A = mkFact({ factId: 'A', value: 1 });
  const A2 = mkFact({ factId: 'A2', value: 1 });
  assert(_apfrRecordsEqual(A, A2) === true, '1-1. 内容完全一致 → duplicate');
  assert(_apfrRecordsEqual_BEFORE(A, A2) === true, '1-2. CUI-0前後で結果が同一（通常Recordは無回帰）');
  const p = mkProduct([A]);
  const r = appendRecord(p, mkFact({ factId: 'A2', value: 1 }), CASE_A);
  assert(r.ok === false && r.reason === 'duplicate_record', '1-3. append時もduplicate_recordで拒否');
  assert(p.facts.length === 1, '1-4. facts件数は増えない');
}

caseHeader('2. 通常A(value=1) vs Correction B(value=2, supersedes A) → non-duplicate');
{
  const A = mkFact({ factId: 'A', value: 1 });
  const B = mkFact({ factId: 'B', value: 2, supersedesFactId: 'A' });
  assert(_apfrRecordsEqual(A, B) === false, '2-1. non-duplicate（値が違うため元々non-duplicate）');
  const p = mkProduct([A]);
  const r = appendRecord(p, B, CASE_A);
  assert(r.ok === true && p.facts.length === 2, '2-2. B登録成功・facts 2件');
}

caseHeader('3. A(1) → B(2, supersedes A) → C(1, supersedes B) 差し戻し訂正が登録可能');
{
  const p = mkProduct([]);
  const rA = appendRecord(p, mkFact({ factId: 'A', value: 1, recordedAt: '2026-08-22T00:00:00.000Z' }), CASE_A);
  const rB = appendRecord(p, mkFact({ factId: 'B', value: 2, supersedesFactId: 'A', recordedAt: '2026-08-22T01:00:00.000Z' }), CASE_A);
  const rC = appendRecord(p, mkFact({ factId: 'C', value: 1, supersedesFactId: 'B', recordedAt: '2026-08-22T02:00:00.000Z' }), CASE_A);
  assert(rA.ok === true, '3-1. A登録成功');
  assert(rB.ok === true, '3-2. B登録成功');
  assert(rC.ok === true && rC.reason === undefined, '3-3. C（元の値への差し戻し訂正）登録成功 ★CUI-0の目的');
  assert(p.facts.length === 3, '3-4. Fact総数 3件');
  // CUI-0前の実装では拒否されていたことを証明
  const before = p.facts.slice(0, 2).some(f => _apfrRecordsEqual_BEFORE(f, p.facts[2]));
  assert(before === true, '3-5. CUI-0前の実装ではAとCがduplicate扱い＝拒否されていた（問題の再現）');
}

caseHeader('4. 同一value・同一supersedesFactId・identity完全一致 → duplicate（二重登録防止維持）');
{
  const C1 = mkFact({ factId: 'C1', value: 1, supersedesFactId: 'B' });
  const C2 = mkFact({ factId: 'C2', value: 1, supersedesFactId: 'B' });
  assert(_apfrRecordsEqual(C1, C2) === true, '4-1. 同一Correction Recordはduplicate');
  const p = mkProduct([C1]);
  const r = appendRecord(p, C2, CASE_A);
  assert(r.ok === false && r.reason === 'duplicate_record', '4-2. append時も拒否');
  assert(p.facts.length === 1, '4-3. facts件数は増えない');
}

caseHeader('5. 同一value・異なるsupersedesFactId → non-duplicate');
{
  const C1 = mkFact({ factId: 'C1', value: 1, supersedesFactId: 'B' });
  const C2 = mkFact({ factId: 'C2', value: 1, supersedesFactId: 'X' });
  assert(_apfrRecordsEqual(C1, C2) === false, '5-1. 訂正関係が異なれば別Record');
}

caseHeader('6. supersedesFactIdなし同士 → 従来挙動維持');
{
  const A = mkFact({ factId: 'A', value: 1 });
  const A2 = mkFact({ factId: 'A2', value: 1 });
  const D = mkFact({ factId: 'D', value: 2 });
  assert(_apfrRecordsEqual(A, A2) === _apfrRecordsEqual_BEFORE(A, A2), '6-1. 同値: CUI-0前後で一致');
  assert(_apfrRecordsEqual(A, D) === _apfrRecordsEqual_BEFORE(A, D), '6-2. 異値: CUI-0前後で一致');
  // 全比較項目の差分パターンで前後一致を網羅
  const variants = [
    ['caseId', CASE_B], ['productIdentifier', PID_OTHER], ['aspName', 'other'],
    ['field', 'payout'], ['sourceMethod', 'advertiser_lp_user_verified'],
    ['sourceReference', 'memo'], ['value', 99],
  ];
  let allSame = true;
  variants.forEach(([k, v]) => {
    const X = mkFact({ factId: 'X', value: 1 }); X[k] = v;
    if (_apfrRecordsEqual(A, X) !== _apfrRecordsEqual_BEFORE(A, X)) allSame = false;
  });
  assert(allSame === true, '6-3. 全比較項目の差分パターンでCUI-0前後の結果が完全一致');
}

caseHeader('7. propertyなし vs undefined → 通常Recordとして従来duplicate判定維持');
{
  const A = mkFact({ factId: 'A', value: 1 });                         // propertyなし
  const B = mkFact({ factId: 'B', value: 1, supersedesFactId: undefined });
  assert(A.supersedesFactId === undefined && !('supersedesFactId' in A), '7-1. Aはproperty未存在');
  assert('supersedesFactId' in B && B.supersedesFactId === undefined, '7-2. Bはproperty存在・値undefined');
  assert(_apfrRecordsEqual(A, B) === true, '7-3. 両者はduplicate（同一意味に扱う）');
  assert(_apfrRecordsEqual(A, B) === _apfrRecordsEqual_BEFORE(A, B), '7-4. CUI-0前後で結果同一');
}

caseHeader('8. null / 空文字 の扱い → 「訂正関係なし」として同一');
{
  const A = mkFact({ factId: 'A', value: 1 });                          // なし
  const N = mkFact({ factId: 'N', value: 1, supersedesFactId: null });
  const E = mkFact({ factId: 'E', value: 1, supersedesFactId: '' });
  assert(_apfrRecordsEqual(A, N) === true, '8-1. なし vs null → duplicate');
  assert(_apfrRecordsEqual(A, E) === true, '8-2. なし vs 空文字 → duplicate');
  assert(_apfrRecordsEqual(N, E) === true, '8-3. null vs 空文字 → duplicate');
  const S = mkFact({ factId: 'S', value: 1, supersedesFactId: 'B' });
  assert(_apfrRecordsEqual(A, S) === false, '8-4. なし vs 実値 → non-duplicate');
  assert(_apfrRecordsEqual(N, S) === false, '8-5. null vs 実値 → non-duplicate');
  assert(_apfrRecordsEqual(E, S) === false, '8-6. 空文字 vs 実値 → non-duplicate');
}

caseHeader('9. 旧Fact不変（append-only / mutation禁止）');
{
  const p = mkProduct([]);
  appendRecord(p, mkFact({ factId: 'A', value: 1 }), CASE_A);
  const snapA = JSON.stringify(p.facts[0]);
  const keysA = Object.keys(p.facts[0]).sort().join(',');
  appendRecord(p, mkFact({ factId: 'B', value: 2, supersedesFactId: 'A' }), CASE_A);
  appendRecord(p, mkFact({ factId: 'C', value: 1, supersedesFactId: 'B' }), CASE_A);
  assert(JSON.stringify(p.facts[0]) === snapA, '9-1. 旧Fact Aの内容が不変');
  assert(Object.keys(p.facts[0]).sort().join(',') === keysA, '9-2. 旧Fact Aへkeyが追加されていない（superseded等を書かない）');
  assert(p.facts[0].factId === 'A' && p.facts[1].factId === 'B' && p.facts[2].factId === 'C', '9-3. 追記順が保持される');
}

caseHeader('10. Fact総数 A→B→C で3件');
{
  const p = mkProduct([]);
  appendRecord(p, mkFact({ factId: 'A', value: 1 }), CASE_A);
  appendRecord(p, mkFact({ factId: 'B', value: 2, supersedesFactId: 'A' }), CASE_A);
  appendRecord(p, mkFact({ factId: 'C', value: 1, supersedesFactId: 'B' }), CASE_A);
  assert(p.facts.length === 3, '10-1. 3件');
}

caseHeader('11. Resolver: A←B←C → C resolved');
{
  const p = mkProduct([]);
  appendRecord(p, mkFact({ factId: 'A', value: 1, recordedAt: '2026-08-22T00:00:00.000Z' }), CASE_A);
  appendRecord(p, mkFact({ factId: 'B', value: 2, supersedesFactId: 'A', recordedAt: '2026-08-22T01:00:00.000Z' }), CASE_A);
  appendRecord(p, mkFact({ factId: 'C', value: 1, supersedesFactId: 'B', recordedAt: '2026-08-22T02:00:00.000Z' }), CASE_A);
  const r = _apfrResolveCurrentFact(p, 'epc');
  assert(r.status === 'resolved' && r.currentFact.factId === 'C', '11-1. C resolved');
  assert(r.currentFact.value === 1, '11-2. current値は差し戻し後の 1');
  assert(r.reason === 'explicit_chain', '11-3. reason=explicit_chain');
  assert(r.candidates.length === 3, '11-4. candidatesに3件すべて残る（履歴保持）');
}

caseHeader('12. recordedAtが逆順でも explicit chain 優先 → C resolved');
{
  const p = mkProduct([]);
  appendRecord(p, mkFact({ factId: 'A', value: 1, recordedAt: '2026-08-22T09:00:00.000Z' }), CASE_A);
  appendRecord(p, mkFact({ factId: 'B', value: 2, supersedesFactId: 'A', recordedAt: '2026-08-22T08:00:00.000Z' }), CASE_A);
  appendRecord(p, mkFact({ factId: 'C', value: 1, supersedesFactId: 'B', recordedAt: '2026-08-22T07:00:00.000Z' }), CASE_A);
  const r = _apfrResolveCurrentFact(p, 'epc');
  assert(r.status === 'resolved' && r.currentFact.factId === 'C', '12-1. recordedAt最古でもC resolved');
}

caseHeader('13. append-only維持（既存Recordの置換・削除が発生しない）');
{
  const p = mkProduct([]);
  const ids = [];
  appendRecord(p, mkFact({ factId: 'A', value: 1 }), CASE_A); ids.push(p.facts.map(f => f.factId).join(','));
  appendRecord(p, mkFact({ factId: 'B', value: 2, supersedesFactId: 'A' }), CASE_A); ids.push(p.facts.map(f => f.factId).join(','));
  appendRecord(p, mkFact({ factId: 'C', value: 1, supersedesFactId: 'B' }), CASE_A); ids.push(p.facts.map(f => f.factId).join(','));
  assert(ids[0] === 'A' && ids[1] === 'A,B' && ids[2] === 'A,B,C', '13-1. 常に末尾追記のみ（置換・削除なし）');
}

caseHeader('14. duplicate factId拒否維持');
{
  const p = mkProduct([mkFact({ factId: 'A', value: 1 })]);
  const r = appendRecord(p, mkFact({ factId: 'A', value: 999, supersedesFactId: 'X' }), CASE_A);
  assert(r.ok === false && r.reason === 'duplicate_factId', '14-1. supersedesFactId有無に関わらずfactId重複は拒否');
  assert(p.facts.length === 1, '14-2. facts件数は増えない');
}

caseHeader('15. Cross-case guard無回帰');
{
  const p = mkProduct([]);
  const r = appendRecord(p, mkFact({ factId: 'X', value: 1, caseId: CASE_B, supersedesFactId: 'A' }), CASE_A);
  assert(r.ok === false && r.reason === 'invalid', '15-1. 別caseのRecordは拒否');
  assert(r.errors.indexOf('caseId_mismatch') !== -1, '15-2. caseId_mismatch');
  assert(p.facts.length === 0, '15-3. 保存されない');
}

caseHeader('16. Cross-product guard無回帰');
{
  const p = mkProduct([]);
  const r = appendRecord(p, mkFact({ factId: 'X', value: 1, productIdentifier: PID_OTHER, supersedesFactId: 'A' }), CASE_A);
  assert(r.ok === false && r.reason === 'invalid', '16-1. 別商品のRecordは拒否');
  assert(r.errors.indexOf('productIdentifier_mismatch') !== -1, '16-2. productIdentifier_mismatch');
  assert(p.facts.length === 0, '16-3. 保存されない');
}

caseHeader('17. Manual Input通常登録 無回帰（Fact昇格条件は不変）');
{
  const p = mkProduct([]);
  const bad = appendRecord(p, mkFact({ factId: 'X', value: 1, sourceMethod: 'ai_interpretation', supersedesFactId: 'A' }), CASE_A);
  assert(bad.ok === false && bad.errors.indexOf('fact_requires_verified_source_method') !== -1, '17-1. AI由来sourceMethodはsupersedes付きでもfact昇格不可');
  const bad2 = appendRecord(p, mkFact({ factId: 'Y', value: 1, verifiedBy: null, supersedesFactId: 'A' }), CASE_A);
  assert(bad2.ok === false && bad2.errors.indexOf('fact_requires_verifiedBy_user') !== -1, '17-2. verifiedBy必須は不変');
  const bad3 = appendRecord(p, mkFact({ factId: 'Z', value: 1, verificationStatus: 'unverified', supersedesFactId: 'A' }), CASE_A);
  assert(bad3.ok === false && bad3.errors.indexOf('fact_requires_user_verified_status') !== -1, '17-3. user_verified必須は不変');
  const ok = appendRecord(p, mkFact({ factId: 'G', value: 1 }), CASE_A);
  assert(ok.ok === true, '17-4. 通常の正当なFactは従来どおり登録可能');
}

caseHeader('18. 責務境界: 不正なsupersedesFactIdはduplicate関数で解決せずResolverがfail-closed');
{
  // orphan（存在しないfactIdを参照）はappend自体は通るが、Resolverがambiguousで安全に止める
  const p = mkProduct([]);
  appendRecord(p, mkFact({ factId: 'A', value: 1 }), CASE_A);
  const r = appendRecord(p, mkFact({ factId: 'G', value: 1, supersedesFactId: 'NOT_EXIST' }), CASE_A);
  assert(r.ok === true, '18-1. orphan参照Recordはduplicate関数では拒否しない（責務外）');
  const res = _apfrResolveCurrentFact(p, 'epc');
  assert(res.status === 'ambiguous' && res.reason === 'orphan_reference', '18-2. Resolverがorphan_referenceでambiguous＝fail-closed');
  assert(res.currentFact === null, '18-3. currentFact=null（Formal Truth読み取りは汚染されない）');
  // self reference も同様
  const p2 = mkProduct([]);
  appendRecord(p2, mkFact({ factId: 'S', value: 1, supersedesFactId: 'S' }), CASE_A);
  const res2 = _apfrResolveCurrentFact(p2, 'epc');
  assert(res2.status === 'ambiguous' && res2.reason === 'self_reference', '18-4. self referenceもResolver側でambiguous');
}

caseHeader('19. 入力非破壊');
{
  const A = mkFact({ factId: 'A', value: 1 });
  const B = mkFact({ factId: 'B', value: 2, supersedesFactId: 'A' });
  const sa = JSON.stringify(A), sb = JSON.stringify(B);
  _apfrRecordsEqual(A, B);
  assert(JSON.stringify(A) === sa && JSON.stringify(B) === sb, '19-1. _apfrRecordsEqualは引数を書き換えない');
  const p = mkProduct([A]);
  const input = mkFact({ factId: 'C', value: 3, supersedesFactId: 'A' });
  const si = JSON.stringify(input);
  appendRecord(p, input, CASE_A);
  assert(JSON.stringify(input) === si, '19-2. appendは入力recordを書き換えない（複製して保存）');
}

caseHeader('20. 多段訂正 A→B→C→D（4段）でも整合');
{
  const p = mkProduct([]);
  appendRecord(p, mkFact({ factId: 'A', value: 1 }), CASE_A);
  appendRecord(p, mkFact({ factId: 'B', value: 2, supersedesFactId: 'A' }), CASE_A);
  appendRecord(p, mkFact({ factId: 'C', value: 1, supersedesFactId: 'B' }), CASE_A);
  const rD = appendRecord(p, mkFact({ factId: 'D', value: 2, supersedesFactId: 'C' }), CASE_A);
  assert(rD.ok === true, '20-1. 4段目（再びvalue=2）も登録可能');
  assert(p.facts.length === 4, '20-2. Fact総数 4件');
  const r = _apfrResolveCurrentFact(p, 'epc');
  assert(r.status === 'resolved' && r.currentFact.factId === 'D' && r.currentFact.value === 2, '20-3. 終端Dがresolved');
}

caseHeader('21. Phase 0 carry-over 無回帰（訂正履歴を含むfactsがそのまま引き継がれる）');
{
  function _apfrCarryOverFacts(prevProduct, nextProduct) {
    try {
      if (!prevProduct || !nextProduct) return [];
      if (typeof prevProduct.caseId !== 'string' || typeof nextProduct.caseId !== 'string') return [];
      if (!prevProduct.caseId || prevProduct.caseId !== nextProduct.caseId) return [];
      if (typeof prevProduct.productIdentifier !== 'string' || typeof nextProduct.productIdentifier !== 'string') return [];
      if (!prevProduct.productIdentifier || prevProduct.productIdentifier !== nextProduct.productIdentifier) return [];
      var facts = _apfrFactsOf(prevProduct);
      if (facts.length === 0) return [];
      return JSON.parse(JSON.stringify(facts));
    } catch (e) { return []; }
  }
  const prev = mkProduct([]);
  appendRecord(prev, mkFact({ factId: 'A', value: 1 }), CASE_A);
  appendRecord(prev, mkFact({ factId: 'B', value: 2, supersedesFactId: 'A' }), CASE_A);
  appendRecord(prev, mkFact({ factId: 'C', value: 1, supersedesFactId: 'B' }), CASE_A);
  const next = { caseId: CASE_A, productIdentifier: PID, facts: [] };
  next.facts = _apfrCarryOverFacts(prev, next);
  assert(next.facts.length === 3, '21-1. 再Adopt後も3件維持');
  assert(next.facts[2].supersedesFactId === 'B', '21-2. supersedesFactIdが保持される');
  const r = _apfrResolveCurrentFact(Object.assign({ productName: 'x' }, next), 'epc');
  assert(r.status === 'resolved' && r.currentFact.factId === 'C', '21-3. 再Adopt後もResolverがCをcurrent採用');
}

caseHeader('22. 既存プラファスト実データ相当（legacy 2件）が無回帰');
{
  const p = mkProduct([
    mkFact({ factId: 'apf_06f0c5be', field: 'listingNgWords', value: ['法人名'], recordedAt: '2026-08-21T22:17:46.268Z' }),
    mkFact({ factId: 'apf_72a473ae', field: 'listingNgWords', value: ['商品名', '法人名'], recordedAt: '2026-08-21T22:23:17.266Z' }),
  ]);
  const r = _apfrResolveCurrentFact(p, 'listingNgWords');
  assert(r.status === 'resolved' && r.currentFact.factId === 'apf_72a473ae', '22-1. legacy fallbackで新Factがcurrent（無回帰）');
  assert(r.reason === 'latest_recordedAt', '22-2. reason=latest_recordedAt');
  // 同値の重複登録は従来どおり拒否されること
  const dup = appendRecord(p, mkFact({ factId: 'new', field: 'listingNgWords', value: ['商品名', '法人名'] }), CASE_A);
  assert(dup.ok === false && dup.reason === 'duplicate_record', '22-3. supersedesなしの同値再登録は従来どおり拒否');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All APFR CUI-0 correction duplicate policy cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
