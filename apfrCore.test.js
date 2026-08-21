'use strict';
// apfrCore.test.js
// Decision108: ASP Product Fact Record（APFR）Step A Core 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / Web Search 0 / index.html変更不要
// index.html内の APFR_* / validateApfrRecord() / _apfrAppendRecord() 等と等価なロジックを
// Node環境で再現してCore（validation / Fact昇格禁止 / 重複防止 / Cross-case・Cross-product保護 / 保存復元 / 入力非破壊）を検証する。

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック（enum・純関数）
// ──────────────────────────────────────────────────────────────
const APFR_CLASSIFICATION_VALUES = ['fact', 'prediction', 'inference', 'unknown'];
const APFR_SOURCE_METHOD_VALUES = [
  'a8_screen_user_verified', 'advertiser_lp_user_verified', 'manual_user_input',
  'web_retrieved', 'generated_hypothesis', 'ai_interpretation', 'calculated',
];
const APFR_FACT_ALLOWED_SOURCE_METHODS = ['a8_screen_user_verified', 'advertiser_lp_user_verified'];
const APFR_VERIFICATION_STATUS_VALUES = ['unverified', 'user_verified'];
const INTEL_RELIABILITY_VALUES = ['high', 'medium', 'low', 'unknown'];

function _apfrNewFactId() {
  try {
    if (typeof crypto !== 'undefined' && crypto && typeof crypto.randomUUID === 'function') return 'apf_' + crypto.randomUUID();
  } catch (e) { /* fallback */ }
  return 'apf_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 10);
}

function _apfrIsJsonSafeValue(value) {
  if (value === undefined) return false;
  if (typeof value === 'function' || typeof value === 'symbol') return false;
  try {
    var s = JSON.stringify(value);
    return s !== undefined;
  } catch (e) { return false; }
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

function _apfrRecordsEqual(a, b) {
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

// ──────────────────────────────────────────────────────────────
// 2. index.html等価ロジック（_apfrAppendRecord・テスト用にstate注入で再現）
// ──────────────────────────────────────────────────────────────
function apfrAppendRecord(state, record) {
  // state = { curCaseId, draft, pushed: [] }
  try {
    var curCaseId = state.curCaseId;
    if (!state.draft || state.draft.caseId !== curCaseId) return { ok: false, reason: 'draft_case_mismatch' };
    var ic = state.draft.fields && state.draft.fields.intelligenceContext;
    var product = ic && ic.product;
    if (!product || !product.productIdentifier) return { ok: false, reason: 'no_adopted_product' };

    var toSave = Object.assign({}, record);
    if (!toSave.factId) toSave.factId = _apfrNewFactId();

    var v = validateApfrRecord(toSave, curCaseId, product.productIdentifier);
    if (!v.valid) return { ok: false, reason: 'invalid', errors: v.errors };

    var facts = _apfrFactsOf(product);
    if (facts.some(function (r) { return r && r.factId === toSave.factId; })) return { ok: false, reason: 'duplicate_factId' };
    if (facts.some(function (r) { return _apfrRecordsEqual(r, toSave); })) return { ok: false, reason: 'duplicate_record' };

    product.facts = facts.concat([toSave]);
    state.pushed.push(state.draft.id);
    return { ok: true, record: toSave };
  } catch (e) {
    return { ok: false, reason: 'exception', message: e.message };
  }
}

// ──────────────────────────────────────────────────────────────
// 3. index.html等価ロジック（FORMAL_CASE_FIELDS carry-forward。intelligenceContextは既存キーのため
//    APFR用の変更は不要＝product.factsは丸ごとintelligenceContextの一部として自動carry-forwardされる）
// ──────────────────────────────────────────────────────────────
const FORMAL_CASE_FIELDS = ['iadp', 'intelligenceContext', 'affiliateContext', 'approvedDecisionPackage', 'externalExecution'];

function carryForwardFormalFields(lastOutputDraft, runCaseId, newDraft) {
  var carry = {};
  if (lastOutputDraft && lastOutputDraft.caseId === runCaseId && lastOutputDraft.fields) {
    FORMAL_CASE_FIELDS.forEach(function (k) {
      if (lastOutputDraft.fields[k]) carry[k] = lastOutputDraft.fields[k];
    });
  }
  if (!newDraft.fields) newDraft.fields = {};
  Object.keys(carry).forEach(function (k) { newDraft.fields[k] = carry[k]; });
  return newDraft;
}

// ──────────────────────────────────────────────────────────────
// 4. Test runner
// ──────────────────────────────────────────────────────────────
let _passed = 0, _failed = 0;
function assert(condition, label) {
  if (condition) { console.log('  ✓', label); _passed++; }
  else { console.error('  ✗', label); _failed++; }
}
function caseHeader(name) { console.log('\n' + name); }

function baseProduct(caseId, productIdentifier) {
  return { caseId: caseId, productIdentifier: productIdentifier, productName: 'プラファスト', aspName: 'A8.net', facts: [] };
}
function baseDraft(id, caseId, product) {
  return { id: id, caseId: caseId, fields: { intelligenceContext: { caseId: caseId, product: product } } };
}

const VALID_FACT = {
  caseId: 'case-test-A', productIdentifier: 'pid-prafast', aspName: 'A8.net',
  field: 'epc', value: 34.24, classification: 'fact',
  sourceMethod: 'a8_screen_user_verified', sourceReference: 'A8.net管理画面',
  verificationStatus: 'user_verified', verifiedBy: 'user', verifiedAt: '2026-08-21T00:00:00.000Z',
  reliability: 'high', recordedAt: '2026-08-21T00:00:00.000Z',
};

// ──────────────────────────────────────────────────────────────
caseHeader('Validator正常系');
{
  const f1 = Object.assign({}, VALID_FACT, { factId: 'apf-1', field: 'epc', sourceMethod: 'a8_screen_user_verified' });
  assert(validateApfrRecord(f1).valid === true, '1. A8 user verified fact → PASS');

  const f2 = Object.assign({}, VALID_FACT, { factId: 'apf-2', field: 'payout', sourceMethod: 'advertiser_lp_user_verified' });
  assert(validateApfrRecord(f2).valid === true, '2. Advertiser LP user verified fact → PASS');

  const f3 = Object.assign({}, VALID_FACT, { factId: 'apf-3', field: 'igFit', classification: 'prediction', sourceMethod: 'ai_interpretation', verificationStatus: 'unverified', verifiedBy: null, verifiedAt: null });
  assert(validateApfrRecord(f3).valid === true, '3. prediction → PASS');

  const f4 = Object.assign({}, VALID_FACT, { factId: 'apf-4', field: 'estimatedProfit', classification: 'inference', sourceMethod: 'calculated', verificationStatus: 'unverified', verifiedBy: null, verifiedAt: null });
  assert(validateApfrRecord(f4).valid === true, '4. inference → PASS');

  const f5 = Object.assign({}, VALID_FACT, { factId: 'apf-5', field: 'productCategory', classification: 'unknown', sourceMethod: 'manual_user_input', verificationStatus: 'unverified', verifiedBy: null, verifiedAt: null });
  assert(validateApfrRecord(f5).valid === true, '5. unknown → PASS');
}

caseHeader('Fact禁止系（AI自己昇格禁止）');
{
  const r6 = Object.assign({}, VALID_FACT, { factId: 'apf-6', sourceMethod: 'manual_user_input' });
  const v6 = validateApfrRecord(r6);
  assert(v6.valid === false && v6.errors.indexOf('fact_requires_verified_source_method') !== -1, '6. manual_user_input + fact → FAIL');

  const r7 = Object.assign({}, VALID_FACT, { factId: 'apf-7', sourceMethod: 'web_retrieved' });
  assert(validateApfrRecord(r7).valid === false, '7. web_retrieved + fact → FAIL');

  const r8 = Object.assign({}, VALID_FACT, { factId: 'apf-8', sourceMethod: 'generated_hypothesis' });
  assert(validateApfrRecord(r8).valid === false, '8. generated_hypothesis + fact → FAIL');

  const r9 = Object.assign({}, VALID_FACT, { factId: 'apf-9', sourceMethod: 'ai_interpretation' });
  assert(validateApfrRecord(r9).valid === false, '9. ai_interpretation + fact → FAIL');

  const r10 = Object.assign({}, VALID_FACT, { factId: 'apf-10', sourceMethod: 'calculated' });
  assert(validateApfrRecord(r10).valid === false, '10. calculated + fact → FAIL');

  const r11 = Object.assign({}, VALID_FACT, { factId: 'apf-11', verifiedBy: 'ai' });
  const v11 = validateApfrRecord(r11);
  assert(v11.valid === false && v11.errors.indexOf('fact_requires_verifiedBy_user') !== -1, '11. user_verifiedだがverifiedByがuser以外 → FAIL');

  const r12 = Object.assign({}, VALID_FACT, { verifiedAt: null });
  delete r12.factId; r12.factId = 'apf-12';
  const v12 = validateApfrRecord(r12);
  assert(v12.valid === false && v12.errors.indexOf('fact_requires_valid_verifiedAt') !== -1, '12. verifiedAt欠落 → FAIL');
}

caseHeader('必須field欠落');
{
  const r13 = Object.assign({}, VALID_FACT); delete r13.factId;
  assert(validateApfrRecord(r13).valid === false, '13. factId欠落 → FAIL');

  const r14 = Object.assign({}, VALID_FACT, { factId: 'apf-14' }); delete r14.caseId;
  assert(validateApfrRecord(r14).valid === false, '14. caseId欠落 → FAIL');

  const r15 = Object.assign({}, VALID_FACT, { factId: 'apf-15' }); delete r15.productIdentifier;
  assert(validateApfrRecord(r15).valid === false, '15. productIdentifier欠落 → FAIL');

  const r16 = Object.assign({}, VALID_FACT, { factId: 'apf-16' }); delete r16.field;
  assert(validateApfrRecord(r16).valid === false, '16. field欠落 → FAIL');

  const r17 = Object.assign({}, VALID_FACT, { factId: 'apf-17', classification: 'not_a_real_value' });
  assert(validateApfrRecord(r17).valid === false, '17. classification不正 → FAIL');

  const r18 = Object.assign({}, VALID_FACT, { factId: 'apf-18', sourceMethod: 'totally_made_up' });
  assert(validateApfrRecord(r18).valid === false, '18. sourceMethod不正 → FAIL');

  const r19 = Object.assign({}, VALID_FACT, { factId: 'apf-19', recordedAt: 'not-a-date' });
  assert(validateApfrRecord(r19).valid === false, '19. recordedAt不正 → FAIL');
}

caseHeader('Input integrity');
{
  const original = Object.assign({}, VALID_FACT, { factId: 'apf-20' });
  const snapshot = JSON.stringify(original);
  validateApfrRecord(original, 'case-test-A', 'pid-prafast');
  assert(JSON.stringify(original) === snapshot, '20. 入力object非破壊');

  assert(validateApfrRecord(null).valid === false, '21a. record=null → 安全にreject（例外なし）');
  assert(validateApfrRecord(undefined).valid === false, '21b. record=undefined → 安全にreject（例外なし）');
  assert(validateApfrRecord(42).valid === false, '21c. record=number → 安全にreject（例外なし）');
  assert(validateApfrRecord([1, 2, 3]).valid === false, '21d. record=array → 安全にreject（例外なし）');
  assert(validateApfrRecord('a string').valid === false, '21e. record=string → 安全にreject（例外なし）');

  const rNull = Object.assign({}, VALID_FACT, { factId: 'apf-22', classification: 'unknown', sourceMethod: 'manual_user_input', verificationStatus: 'unverified', verifiedBy: null, verifiedAt: null, value: null });
  assert(validateApfrRecord(rNull).valid === true, '22. value=null → PASS（許容型）');

  const rUndef = Object.assign({}, VALID_FACT, { factId: 'apf-23', value: undefined });
  const vUndef = validateApfrRecord(rUndef);
  assert(vUndef.valid === false && vUndef.errors.indexOf('value_missing') !== -1, '23. value=undefined → FAIL');

  const rArr = Object.assign({}, VALID_FACT, { factId: 'apf-24', classification: 'unknown', sourceMethod: 'manual_user_input', verificationStatus: 'unverified', verifiedBy: null, verifiedAt: null, value: ['商品名', '法人名'] });
  assert(validateApfrRecord(rArr).valid === true, '24. value=array → PASS（listingNgWords等の許容型）');

  const rStr = Object.assign({}, VALID_FACT, { factId: 'apf-25', classification: 'unknown', sourceMethod: 'manual_user_input', verificationStatus: 'unverified', verifiedBy: null, verifiedAt: null, value: 'partnered' });
  assert(validateApfrRecord(rStr).valid === true, '25. value=string → PASS（partnershipStatus等の許容型）');

  const rFunc = Object.assign({}, VALID_FACT, { factId: 'apf-25b', value: function () {} });
  assert(validateApfrRecord(rFunc).valid === false, '25f. value=function → FAIL（JSON非安全）');
}

caseHeader('Cross-case');
{
  const state = { curCaseId: 'case-B', draft: baseDraft('out_1', 'case-B', baseProduct('case-B', 'pid-prafast')), pushed: [] };
  const rec = Object.assign({}, VALID_FACT, { factId: 'apf-26', caseId: 'case-A' }); // 別caseのRecordを混入させようとした場合
  const r = apfrAppendRecord(state, rec);
  assert(r.ok === false && r.reason === 'invalid' && r.errors.indexOf('caseId_mismatch') !== -1, '26. record.caseId不一致 → reject');

  const stateA = { curCaseId: 'case-A', draft: baseDraft('out_a', 'case-A', baseProduct('case-A', 'pid-x')), pushed: [] };
  const stateB = { curCaseId: 'case-B', draft: baseDraft('out_b', 'case-B', baseProduct('case-B', 'pid-x')), pushed: [] };
  apfrAppendRecord(stateA, Object.assign({}, VALID_FACT, { factId: 'apf-27a', caseId: 'case-A', productIdentifier: 'pid-x' }));
  assert(_apfrFactsOf(stateB.draft.fields.intelligenceContext.product).length === 0, '27. 他case facts非混入（別stateへ伝播しない）');
}

caseHeader('Product境界（Cross-product）');
{
  const state = { curCaseId: 'case-test-A', draft: baseDraft('out_1', 'case-test-A', baseProduct('case-test-A', 'pid-prafast')), pushed: [] };
  const rec = Object.assign({}, VALID_FACT, { factId: 'apf-28', productIdentifier: 'pid-other-product' });
  const r = apfrAppendRecord(state, rec);
  assert(r.ok === false && r.reason === 'invalid' && r.errors.indexOf('productIdentifier_mismatch') !== -1, '28. productIdentifier不一致 → reject');

  const stateP = { curCaseId: 'case-test-A', draft: baseDraft('out_1', 'case-test-A', baseProduct('case-test-A', 'pid-prafast')), pushed: [] };
  apfrAppendRecord(stateP, Object.assign({}, VALID_FACT, { factId: 'apf-29a', productIdentifier: 'pid-prafast' }));
  const facts = _apfrFactsOf(stateP.draft.fields.intelligenceContext.product);
  assert(facts.length === 1 && facts[0].productIdentifier === 'pid-prafast', '29. 同一case別商品facts非混入（現在採用商品以外は保存不可）');
}

caseHeader('Duplicate policy');
{
  const state = { curCaseId: 'case-test-A', draft: baseDraft('out_1', 'case-test-A', baseProduct('case-test-A', 'pid-prafast')), pushed: [] };
  const r1 = apfrAppendRecord(state, Object.assign({}, VALID_FACT, { factId: 'apf-30' }));
  assert(r1.ok === true, '前提: 1件目登録成功');
  const r30 = apfrAppendRecord(state, Object.assign({}, VALID_FACT, { factId: 'apf-30' })); // 同一factId
  assert(r30.ok === false && r30.reason === 'duplicate_factId', '30. 同一factId重複 → reject');

  const r31 = apfrAppendRecord(state, Object.assign({}, VALID_FACT, { factId: 'apf-31' })); // factIdのみ違う完全同一内容
  assert(r31.ok === false && r31.reason === 'duplicate_record', '31. 完全同一Record再追加（factId以外一致）→ 二重化しない');

  const r32 = apfrAppendRecord(state, Object.assign({}, VALID_FACT, { factId: 'apf-32', value: 40.0 })); // 同じfieldで新値
  assert(r32.ok === true, '32a. 同じfieldでも新値・新factId → 保存成功');
  const facts = _apfrFactsOf(state.draft.fields.intelligenceContext.product);
  assert(facts.filter(function (f) { return f.field === 'epc'; }).length === 2, '32b. 旧Record削除せず履歴保持（epc Record 2件共存）');
}

caseHeader('Persistence');
{
  const state = { curCaseId: 'case-test-A', draft: baseDraft('out_1', 'case-test-A', baseProduct('case-test-A', 'pid-prafast')), pushed: [] };
  apfrAppendRecord(state, Object.assign({}, VALID_FACT, { factId: 'apf-33a', field: 'epc' }));
  apfrAppendRecord(state, Object.assign({}, VALID_FACT, { factId: 'apf-33b', field: 'payout', value: 5000, classification: 'fact', sourceMethod: 'a8_screen_user_verified' }));

  const payload = JSON.stringify({ id: state.draft.id, caseId: state.draft.caseId, fields: state.draft.fields });
  const row = JSON.parse(payload);
  const restoredFields = row.fields || {};
  assert(JSON.stringify(restoredFields.intelligenceContext.product.facts) === JSON.stringify(state.draft.fields.intelligenceContext.product.facts),
    '33. JSON stringify/parse round-trip一致');
  assert(restoredFields.intelligenceContext.product.facts.length === 2, '34. product.facts保存／復元一致（2件）');

  const legacyDraft = { id: 'out_legacy', caseId: 'case-test-A', fields: { intelligenceContext: { caseId: 'case-test-A', product: { caseId: 'case-test-A', productIdentifier: 'pid-legacy' } } } };
  assert(Array.isArray(_apfrFactsOf(legacyDraft.fields.intelligenceContext.product)), '35. factsなし旧Draft → 空配列相当として扱える');
  assert(legacyDraft.fields.intelligenceContext.product.facts === undefined, '36. 旧Draftのproduct自体は勝手に書き換えない（factsキーは未追加のまま）');
}

caseHeader('FORMAL_CASE_FIELDS carry-forward（intelligenceContext経由でAPFRも自動継承・既存4キー無回帰）');
{
  const productWithFacts = baseProduct('case-test-A', 'pid-prafast');
  productWithFacts.facts = [Object.assign({}, VALID_FACT, { factId: 'apf-cf-1' })];
  const lastDraft = {
    id: 'out_old', caseId: 'case-test-A',
    fields: {
      iadp: { package: { packageId: 'iadp_x' } },
      intelligenceContext: { caseId: 'case-test-A', product: productWithFacts },
      affiliateContext: { product: 'x' },
      approvedDecisionPackage: { decisionId: 'd1' },
      externalExecution: [{ executionType: 'instagram_account_created' }],
    },
  };
  const newDraft = { id: 'out_new', caseId: 'case-test-A', fields: {} };
  const merged = carryForwardFormalFields(lastDraft, 'case-test-A', newDraft);
  assert(merged.fields.iadp && merged.fields.iadp.package.packageId === 'iadp_x', 'iadp carry-forward 無回帰');
  assert(merged.fields.affiliateContext.product === 'x', 'affiliateContext carry-forward 無回帰');
  assert(merged.fields.approvedDecisionPackage.decisionId === 'd1', 'approvedDecisionPackage carry-forward 無回帰');
  assert(merged.fields.externalExecution.length === 1, 'externalExecution(EER) carry-forward 無回帰');
  assert(merged.fields.intelligenceContext.product.facts.length === 1, 'APFR facts はintelligenceContext丸ごとcarry-forwardの一部として自動継承される（専用配線不要）');

  // Cross-case: 別caseへの新Draft生成ではintelligenceContext（product.facts含む）を引き継がない
  const newDraftOtherCase = { id: 'out_new2', caseId: 'case-B', fields: {} };
  const mergedOther = carryForwardFormalFields(lastDraft, 'case-B', newDraftOtherCase);
  assert(mergedOther.fields.intelligenceContext === undefined, 'Cross-case: 別caseのDraftへAPFR factsは混入しない');
}

// ──────────────────────────────────────────────────────────────
// 結果サマリー
// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All APFR Step A Core cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
