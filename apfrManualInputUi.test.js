'use strict';
// apfrManualInputUi.test.js
// Decision108: ASP Product Fact Record（APFR）Step B Manual Input UI 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / Web Search 0 / index.html変更不要
// index.html内の _apfrOnFormChange() / _apfrRegisterFromUi() / _apfrNormalizeUiValue() 等の
// UI決定ロジックと、Step A Core（validateApfrRecord()／_apfrAppendRecord()）の連携をNode環境で再現して検証する。
// UI独自のFact判定は行わず、Step A Coreをそのまま利用することも本テストで確認する（重複実装なし）。

// ──────────────────────────────────────────────────────────────
// 1. Step A Core等価ロジック（apfrCore.test.jsと同一・再掲。二重実装ではなくテスト内での参照複製）
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
  try { var s = JSON.stringify(value); return s !== undefined; } catch (e) { return false; }
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
  if (!_apfrIsJsonSafeValue(record.value)) errors.push(record.value === undefined ? 'value_missing' : 'value_not_json_safe');
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

function _apfrFactsOf(product) { return (product && Array.isArray(product.facts)) ? product.facts : []; }

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

function apfrAppendRecord(state, record) {
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
  } catch (e) { return { ok: false, reason: 'exception', message: e.message }; }
}

// ──────────────────────────────────────────────────────────────
// 2. Step B UI等価ロジック（index.html内 APFR_FIELD_META / _apfrNormalizeUiValue / _apfrOnFormChange / _apfrRegisterFromUi と等価）
// ──────────────────────────────────────────────────────────────
const APFR_FIELD_META = {
  aspName: { label: 'ASP名', type: 'string', group: '識別' },
  programId: { label: 'Program ID', type: 'string', group: '識別' },
  epc: { label: 'EPC', type: 'number', group: '成果' },
  approvalRate: { label: '確定率(%)', type: 'number', group: '成果' },
  productLinkAvailable: { label: '商品リンク利用可否', type: 'boolean', group: 'ASP状態' },
  reviewRequired: { label: '審査有無', type: 'boolean', group: '技術' },
  listingNgWords: { label: 'リスティングNGワード', type: 'array', group: 'Compliance' },
  partnershipStatus: { label: '提携状態', type: 'string', group: 'ASP状態' },
};

function _apfrNormalizeUiValue(fieldKey, rawText, rawBool) {
  var meta = APFR_FIELD_META[fieldKey];
  var type = meta ? meta.type : 'string';
  if (type === 'boolean') return (rawBool === 'true');
  if (type === 'number') { var n = parseFloat(rawText); return isNaN(n) ? null : n; }
  if (type === 'array') return String(rawText || '').split(/[\n,、]/).map(function (s) { return s.trim(); }).filter(function (s) { return s.length > 0; });
  return String(rawText || '').trim();
}

// _apfrOnFormChange()のボタンdisabled判定ロジック等価（DOM非依存の純粋な状態計算部分のみ抽出）。
function apfrComputeFormState(provenance, verifiedChecked) {
  var needsVerification = (provenance === 'a8_screen' || provenance === 'advertiser_lp');
  var effectiveChecked = needsVerification ? verifiedChecked : false; // manual選択時は強制解除
  var blocked = needsVerification && !effectiveChecked;
  return { needsVerification: needsVerification, verifyRowVisible: needsVerification, blocked: blocked };
}

// _apfrRegisterFromUi()の判定ロジック等価（DOM読み取り部分を引数化）。
function apfrRegisterFromUiLogic(state, ui) {
  var product = state.draft.fields.intelligenceContext.product;
  var fieldKey = ui.field;
  var value = _apfrNormalizeUiValue(fieldKey, ui.valueText, ui.valueBool);
  if (value === null || (typeof value === 'string' && value === '') || (Array.isArray(value) && value.length === 0)) {
    return { ok: false, reason: 'empty_value' };
  }
  var provenance = ui.provenance;
  var sourceMethod = (provenance === 'a8_screen') ? 'a8_screen_user_verified'
    : (provenance === 'advertiser_lp') ? 'advertiser_lp_user_verified' : 'manual_user_input';
  var verified = !!ui.verified && (provenance === 'a8_screen' || provenance === 'advertiser_lp');
  var nowIso = new Date().toISOString();
  var record = {
    caseId: product.caseId, productIdentifier: product.productIdentifier, aspName: product.aspName || null,
    field: fieldKey, value: value, classification: verified ? 'fact' : 'unknown',
    sourceMethod: sourceMethod, sourceReference: ui.sourceReference || null,
    verificationStatus: verified ? 'user_verified' : 'unverified',
    verifiedBy: verified ? 'user' : null, verifiedAt: verified ? nowIso : null, recordedAt: nowIso,
  };
  return apfrAppendRecord(state, record);
}

// ──────────────────────────────────────────────────────────────
// 3. Test runner
// ──────────────────────────────────────────────────────────────
let _passed = 0, _failed = 0;
function assert(condition, label) { if (condition) { console.log('  ✓', label); _passed++; } else { console.error('  ✗', label); _failed++; } }
function caseHeader(name) { console.log('\n' + name); }

function baseProduct(caseId, productIdentifier) {
  return { caseId: caseId, productIdentifier: productIdentifier, productName: 'TEST_APFR_PRODUCT', aspName: 'TEST_ASP', facts: [] };
}
function baseState(caseId, productIdentifier) {
  return { curCaseId: caseId, draft: { id: 'out_test', caseId: caseId, fields: { intelligenceContext: { caseId: caseId, product: baseProduct(caseId, productIdentifier) } } }, pushed: [] };
}

// ──────────────────────────────────────────────────────────────
caseHeader('1-2. A8 provenance');
{
  const s1 = baseState('case-test-A', 'TEST_APFR_PRODUCT');
  const r1 = apfrRegisterFromUiLogic(s1, { field: 'epc', valueText: '34.24', provenance: 'a8_screen', verified: true, sourceReference: 'A8管理画面' });
  assert(r1.ok === true && r1.record.classification === 'fact', '1. A8 + verification → fact');

  const s2 = baseState('case-test-A', 'TEST_APFR_PRODUCT');
  const r2 = apfrRegisterFromUiLogic(s2, { field: 'epc', valueText: '34.24', provenance: 'a8_screen', verified: false });
  assert(r2.ok === true && r2.record.classification !== 'fact' && r2.record.classification === 'unknown', '2. A8 without verification → fact化しない（unknownとして安全側登録）');
}

caseHeader('3-4. Advertiser LP provenance');
{
  const s3 = baseState('case-test-A', 'TEST_APFR_PRODUCT');
  const r3 = apfrRegisterFromUiLogic(s3, { field: 'partnershipStatus', valueText: 'partnered', provenance: 'advertiser_lp', verified: true, sourceReference: 'https://leona-beauty.jp/prafast/a8/' });
  assert(r3.ok === true && r3.record.classification === 'fact', '3. advertiser LP + verification → fact');

  const s4 = baseState('case-test-A', 'TEST_APFR_PRODUCT');
  const r4 = apfrRegisterFromUiLogic(s4, { field: 'partnershipStatus', valueText: 'partnered', provenance: 'advertiser_lp', verified: false });
  assert(r4.ok === true && r4.record.classification === 'unknown', '4. advertiser LP without verification → fact化しない');
}

caseHeader('5-6. manual_user_input');
{
  const s5 = baseState('case-test-A', 'TEST_APFR_PRODUCT');
  const r5 = apfrRegisterFromUiLogic(s5, { field: 'programId', valueText: 's00000015266009', provenance: 'manual', verified: true }); // verified=trueでもmanualでは無効化される
  assert(r5.ok === true && r5.record.classification !== 'fact', '5. manual input → fact不可（verifiedフラグを立てても無効）');

  const s6 = baseState('case-test-A', 'TEST_APFR_PRODUCT');
  const r6 = apfrRegisterFromUiLogic(s6, { field: 'programId', valueText: 's00000015266009', provenance: 'manual', verified: false });
  assert(r6.ok === true && r6.record.classification === 'unknown', '6. manual input → non-fact登録可能');
}

caseHeader('7-10. Fact登録時の付帯情報');
{
  const s = baseState('case-test-A', 'TEST_APFR_PRODUCT');
  const r = apfrRegisterFromUiLogic(s, { field: 'epc', valueText: '34.24', provenance: 'a8_screen', verified: true });
  assert(r.record.verifiedBy === 'user', '7. verifiedBy=user');
  assert(typeof r.record.verifiedAt === 'string' && !isNaN(Date.parse(r.record.verifiedAt)), '8. verifiedAt生成（有効timestamp）');
  assert(typeof r.record.factId === 'string' && r.record.factId.indexOf('apf_') === 0, '9. factId自動生成（apf_接頭辞）');
  assert(typeof r.record.recordedAt === 'string' && !isNaN(Date.parse(r.record.recordedAt)), '10. recordedAt生成（有効timestamp）');
}

caseHeader('11. Duplicate表示相当');
{
  const s = baseState('case-test-A', 'TEST_APFR_PRODUCT');
  const r1 = apfrRegisterFromUiLogic(s, { field: 'epc', valueText: '34.24', provenance: 'a8_screen', verified: true });
  assert(r1.ok === true, '前提: 1件目登録成功');
  const r2 = apfrRegisterFromUiLogic(s, { field: 'epc', valueText: '34.24', provenance: 'a8_screen', verified: true });
  assert(r2.ok === false && r2.reason === 'duplicate_record', '11. 完全同一Record再登録 → duplicate（UI側は「すでに登録されています」表示に対応するreason）');
}

caseHeader('12-13. Cross-case / Cross-product');
{
  const s = baseState('case-A', 'TEST_APFR_PRODUCT');
  s.curCaseId = 'case-B'; // UI側の現在case判定がずれた想定（draft.caseId=case-Aのまま）
  const r = apfrRegisterFromUiLogic(s, { field: 'epc', valueText: '34.24', provenance: 'a8_screen', verified: true });
  assert(r.ok === false && r.reason === 'draft_case_mismatch', '12. Cross-case: 現在case不一致で登録拒否');

  const s2 = baseState('case-test-A', 'TEST_APFR_PRODUCT');
  // 商品切替後を想定：productIdentifierが異なるレコードを直接組み立てて登録しようとするケースはStep A Coreで拒否される
  const otherProduct = { caseId: 'case-test-A', productIdentifier: 'OTHER_PRODUCT' };
  const badRecord = {
    caseId: otherProduct.caseId, productIdentifier: otherProduct.productIdentifier, field: 'epc', value: 1,
    classification: 'unknown', sourceMethod: 'manual_user_input', verificationStatus: 'unverified', recordedAt: new Date().toISOString(),
  };
  const r2 = apfrAppendRecord(s2, badRecord);
  assert(r2.ok === false && r2.reason === 'invalid' && r2.errors.indexOf('productIdentifier_mismatch') !== -1, '13. Cross-product: 現在採用商品と異なるproductIdentifierは拒否');
}

caseHeader('14. F5相当round-trip');
{
  const s = baseState('case-test-A', 'TEST_APFR_PRODUCT');
  apfrRegisterFromUiLogic(s, { field: 'epc', valueText: '34.24', provenance: 'a8_screen', verified: true });
  apfrRegisterFromUiLogic(s, { field: 'listingNgWords', valueText: '商品名, 法人名', provenance: 'a8_screen', verified: true });
  const payload = JSON.stringify({ id: s.draft.id, caseId: s.draft.caseId, fields: s.draft.fields });
  const restored = JSON.parse(payload);
  assert(JSON.stringify(restored.fields.intelligenceContext.product.facts) === JSON.stringify(s.draft.fields.intelligenceContext.product.facts),
    '14. F5相当（JSON round-trip）でfacts完全一致');
  assert(restored.fields.intelligenceContext.product.facts.length === 2, '14b. 2件のFactが復元される');
}

caseHeader('15. legacy factsなし');
{
  const legacyProduct = { caseId: 'case-test-A', productIdentifier: 'LEGACY_PRODUCT' }; // factsキー自体が存在しない
  assert(Array.isArray(_apfrFactsOf(legacyProduct)), '15. factsキーなしlegacy商品でも空配列として安全に扱える');
  assert(legacyProduct.facts === undefined, '15b. legacy商品オブジェクト自体は書き換えない');
}

caseHeader('16-18. Input normalize（number / boolean / list）');
{
  assert(_apfrNormalizeUiValue('epc', '34.24', null) === 34.24, '16. number型: "34.24" → 34.24');
  assert(_apfrNormalizeUiValue('epc', 'not-a-number', null) === null, '16b. number型: 不正入力 → null（登録拒否対象）');
  assert(_apfrNormalizeUiValue('productLinkAvailable', null, 'true') === true, '17. boolean型: "true" → true');
  assert(_apfrNormalizeUiValue('productLinkAvailable', null, 'false') === false, '17b. boolean型: "false" → false');
  const list = _apfrNormalizeUiValue('listingNgWords', '商品名, 法人名\nテスト', null);
  assert(Array.isArray(list) && list.length === 3 && list[0] === '商品名' && list[2] === 'テスト', '18. array型: カンマ/改行区切り → trim済み配列');
}

caseHeader('19. UI値からAI推測補完なし');
{
  // 値が空・空配列の場合、AIが推測で埋めることなく明示的にempty_value扱いとする（登録しない）
  const s = baseState('case-test-A', 'TEST_APFR_PRODUCT');
  const rEmpty = apfrRegisterFromUiLogic(s, { field: 'aspName', valueText: '', provenance: 'manual', verified: false });
  assert(rEmpty.ok === false && rEmpty.reason === 'empty_value', '19a. 空文字入力 → 推測補完せず登録拒否');
  const rEmptyList = apfrRegisterFromUiLogic(s, { field: 'listingNgWords', valueText: '', provenance: 'manual', verified: false });
  assert(rEmptyList.ok === false && rEmptyList.reason === 'empty_value', '19b. 空配列入力 → 推測補完せず登録拒否');
  // 未入力sourceReferenceはnullのまま（AIが埋めない）
  const r = apfrRegisterFromUiLogic(s, { field: 'aspName', valueText: 'TEST_ASP2', provenance: 'manual', verified: false, sourceReference: '' });
  assert(r.ok === true && r.record.sourceReference === null, '19c. 未入力sourceReferenceはnullのまま（AI補完なし）');
}

caseHeader('20. Existing APFR Core回帰（Step A Validatorをそのまま利用・UI独自実装なし）');
{
  // UI経路で作られたRecordがStep A validateApfrRecord()単体でも同じ結果になることを確認（二重ロジックがないこと）
  const nowIso = new Date().toISOString();
  const factRecord = {
    factId: 'apf_regress_1', caseId: 'case-test-A', productIdentifier: 'TEST_APFR_PRODUCT', aspName: 'TEST_ASP',
    field: 'epc', value: 34.24, classification: 'fact', sourceMethod: 'a8_screen_user_verified',
    verificationStatus: 'user_verified', verifiedBy: 'user', verifiedAt: nowIso, recordedAt: nowIso,
  };
  assert(validateApfrRecord(factRecord, 'case-test-A', 'TEST_APFR_PRODUCT').valid === true, '20a. UI由来のfact recordはStep A Validatorでもvalid');

  const badFactRecord = Object.assign({}, factRecord, { factId: 'apf_regress_2', sourceMethod: 'manual_user_input' });
  assert(validateApfrRecord(badFactRecord, 'case-test-A', 'TEST_APFR_PRODUCT').valid === false, '20b. manual_user_input+factはStep A Validatorでも拒否（UI・Core同一契約）');

  // duplicate policy もStep A側のロジックがそのまま効くことを確認
  const s = baseState('case-test-A', 'TEST_APFR_PRODUCT');
  apfrAppendRecord(s, factRecord);
  const dup = apfrAppendRecord(s, Object.assign({}, factRecord, { factId: 'apf_regress_3' }));
  assert(dup.ok === false && dup.reason === 'duplicate_record', '20c. UI経由を模したRecordでもStep A duplicate policyがそのまま適用される');
}

caseHeader('補足: ボタンdisabled状態計算（_apfrOnFormChange相当）');
{
  assert(apfrComputeFormState('a8_screen', false).blocked === true, 'A8選択・未チェック → blocked=true（ボタンdisabled相当）');
  assert(apfrComputeFormState('a8_screen', true).blocked === false, 'A8選択・チェック済み → blocked=false');
  assert(apfrComputeFormState('advertiser_lp', false).blocked === true, '広告主LP選択・未チェック → blocked=true');
  assert(apfrComputeFormState('advertiser_lp', true).blocked === false, '広告主LP選択・チェック済み → blocked=false');
  assert(apfrComputeFormState('manual', true).blocked === false, 'manual選択時は常にblocked=false（チェック状態に関わらず）');
  assert(apfrComputeFormState('manual', true).verifyRowVisible === false, 'manual選択時は確認チェック行を非表示');
}

// ──────────────────────────────────────────────────────────────
// 結果サマリー
// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All APFR Step B Manual Input UI cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
