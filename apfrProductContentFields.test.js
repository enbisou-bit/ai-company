'use strict';
// apfrProductContentFields.test.js
// APFR Product Content Formal Truth Extension — Minimum Implementation の回帰テスト。
//   目的: 現行 APFR 21 field には Instagram 商品投稿に必要な「消費者向け商品情報」の格納先が無い問題に対し、
//   productDescription / productFeatures / productUsage / targetUser の4 field を APFR_FIELD_META /
//   APFR_FIELD_ORDER への追加のみで導入したことを検証する。
//
//   実AI API呼び出し0件 / DB変更なし / 実案件への操作0（index.html から実定数・実関数を静的抽出して Node 実行）。
//
//   Contract 維持の検証:
//     - Fact昇格Contract（Decision108）は新 field でも既存のまま適用される
//     - Resolver / Case Data Context は field 定数追加だけで新 field を扱う
//     - 新 field は Compliance Context へ混入しない（責務分離）
//     - 既存 21 field / 既存 22 Fact fixture の resolved 結果は不変

const fs = require('fs');
const path = require('path');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log(`  ✅ ${label}`); }
  else { _failed++; console.log(`  ❌ ${label}`); }
}
function caseHeader(t) { console.log(`\n── ${t} ──`); }

const src = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// ── index.html から実定数・実関数を静的抽出 ──────────────────────────
function extractBalanced(startNeedle, open, close) {
  const i = src.indexOf(startNeedle);
  if (i < 0) throw new Error('not found: ' + startNeedle);
  // 先頭の open まで送る
  let k = src.indexOf(open, i);
  let depth = 0, j = k;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === open) depth++;
    else if (c === close) { depth--; if (depth === 0) { j++; break; } }
  }
  return src.slice(k, j);
}
function extractFn(startNeedle) {
  const i = src.indexOf(startNeedle);
  if (i < 0) throw new Error('not found: ' + startNeedle);
  let depth = 0, started = false, j = i;
  for (; j < src.length; j++) {
    const c = src[j];
    if (c === '{') { depth++; started = true; }
    else if (c === '}') { depth--; if (started && depth === 0) { j++; break; } }
  }
  return src.slice(i, j);
}

// eslint-disable-next-line no-eval
const APFR_FIELD_META = eval('(' + extractBalanced('const APFR_FIELD_META = {', '{', '}') + ')');
// eslint-disable-next-line no-eval
const APFR_FIELD_ORDER = eval(extractBalanced('const APFR_FIELD_ORDER = [', '[', ']'));
// eslint-disable-next-line no-eval
const APFR_COMPLIANCE_CONTEXT_FIELDS = eval(extractBalanced('const APFR_COMPLIANCE_CONTEXT_FIELDS = [', '[', ']'));

// Validator / Resolver に必要な enum（index.html と同一値）
const APFR_CLASSIFICATION_VALUES = ['fact', 'prediction', 'inference', 'unknown'];
const APFR_SOURCE_METHOD_VALUES = ['a8_screen_user_verified', 'advertiser_lp_user_verified', 'manual_user_input', 'web_retrieved', 'generated_hypothesis', 'ai_interpretation', 'calculated'];
const APFR_FACT_ALLOWED_SOURCE_METHODS = ['a8_screen_user_verified', 'advertiser_lp_user_verified'];
const APFR_VERIFICATION_STATUS_VALUES = ['unverified', 'user_verified'];
const INTEL_RELIABILITY_VALUES = ['high', 'medium', 'low', 'unknown'];
global.APFR_FIELD_ORDER = APFR_FIELD_ORDER;
global.APFR_FIELD_META = APFR_FIELD_META;

// eslint-disable-next-line no-eval
const _apfrIsJsonSafeValue = eval('(' + extractFn('function _apfrIsJsonSafeValue(') + ')');
// eslint-disable-next-line no-eval
const validateApfrRecord = eval('(' + extractFn('function validateApfrRecord(') + ')');
// eslint-disable-next-line no-eval
const _apfrFactsOf = eval('(' + extractFn('function _apfrFactsOf(') + ')');
// eslint-disable-next-line no-eval
const _apfrHasSupersedes = eval('(' + extractFn('function _apfrHasSupersedes(') + ')');
// eslint-disable-next-line no-eval
const _apfrCandidateFacts = eval('(' + extractFn('function _apfrCandidateFacts(') + ')');
// eslint-disable-next-line no-eval
const _apfrResolveCurrentFact = eval('(' + extractFn('function _apfrResolveCurrentFact(') + ')');
// eslint-disable-next-line no-eval
const _apfrResolveCurrentFacts = eval('(' + extractFn('function _apfrResolveCurrentFacts(') + ')');
// eslint-disable-next-line no-eval
const _cdcFormatValue = eval('(' + extractFn('function _cdcFormatValue(') + ')');
// eslint-disable-next-line no-eval
const _cdcBuildFormalTruthLines = eval('(' + extractFn('function _cdcBuildFormalTruthLines(') + ')');

const NEW_FIELDS = ['productDescription', 'productFeatures', 'productUsage', 'targetUser'];
const EXISTING_21 = ['aspName', 'programId', 'productName', 'productCategory', 'partnershipStatus', 'landingUrl',
  'productLinkAvailable', 'payout', 'epc', 'approvalRate', 'cookieWindowDays', 'approvalEstimateDays',
  'reviewRequired', 'mobileOptimized', 'itpSupported', 'linkManagerSupported', 'listingPolicy',
  'listingNgWords', 'regulatoryCategory', 'complianceRestrictions', 'advertisingDisclosureRequirements'];

const CASE_A = 'case-msr9yckye65y';
const PID = '["プラファスト","a8.net"]';

function mkFact(field, value, over) {
  const now = new Date().toISOString();
  return Object.assign({
    factId: 'apf_' + field + '_' + Math.random().toString(36).slice(2, 8),
    caseId: CASE_A, productIdentifier: PID, aspName: 'A8.net',
    field: field, value: value,
    classification: 'fact', sourceMethod: 'advertiser_lp_user_verified',
    verificationStatus: 'user_verified', verifiedBy: 'user', verifiedAt: now, recordedAt: now,
  }, over || {});
}

// 本番相当 fixture: 既存 21 field を1件ずつ（内容は簡略・型のみ整合させる）
function buildProduct(extraFacts) {
  const facts = EXISTING_21.map(function (f) {
    const meta = APFR_FIELD_META[f];
    let v;
    if (meta.type === 'boolean') v = true;
    else if (meta.type === 'number') v = 1;
    else if (meta.type === 'array') v = ['x'];
    else v = 'v_' + f;
    return mkFact(f, v);
  });
  return { caseId: CASE_A, productIdentifier: PID, productName: 'プラファスト',
    facts: facts.concat(extraFacts || []) };
}

// ── Test 1: 新4 field が META / ORDER に存在 ─────────────────────────
caseHeader('1. 新4 field が APFR_FIELD_META / APFR_FIELD_ORDER に存在する');
{
  NEW_FIELDS.forEach(function (f) {
    assert(!!APFR_FIELD_META[f], `1-1. APFR_FIELD_META.${f} が定義されている`);
    assert(APFR_FIELD_ORDER.indexOf(f) !== -1, `1-2. APFR_FIELD_ORDER に ${f} が含まれる`);
  });
  assert(APFR_FIELD_ORDER.length === 25, `1-3. APFR_FIELD_ORDER は 25 field（21 + 4）（実際: ${APFR_FIELD_ORDER.length}）`);
  assert(NEW_FIELDS.every(function (f) { return APFR_FIELD_META[f].group === '商品内容'; }), '1-4. 新4 field の group は「商品内容」（既存 group と分離）');
}

// ── Test 2: 型 ─────────────────────────────────────────────────────
caseHeader('2. 新 field の型');
{
  assert(APFR_FIELD_META.productDescription.type === 'string', '2-1. productDescription = string');
  assert(APFR_FIELD_META.productFeatures.type === 'array', '2-2. productFeatures = array');
  assert(APFR_FIELD_META.productUsage.type === 'string', '2-3. productUsage = string');
  assert(APFR_FIELD_META.targetUser.type === 'string', '2-4. targetUser = string');
  assert(NEW_FIELDS.every(function (f) { return ['string', 'number', 'boolean', 'array'].indexOf(APFR_FIELD_META[f].type) !== -1; }), '2-5. 全て既存4型（string/number/boolean/array）のいずれか');
}

// ── Test 3: 正しい advertiser_lp_user_verified Fact が valid ─────────
caseHeader('3. 新 field の正しい確認済み Fact が validateApfrRecord で valid');
{
  const rDesc = mkFact('productDescription', 'プラファストは〜という商品です。');
  assert(validateApfrRecord(rDesc, CASE_A, PID).valid === true, '3-1. productDescription / advertiser_lp_user_verified / fact → valid');
  const rFeat = mkFact('productFeatures', ['特徴A', '特徴B']);
  assert(validateApfrRecord(rFeat, CASE_A, PID).valid === true, '3-2. productFeatures（array）→ valid');
  const rA8 = mkFact('productUsage', '朝晩に使用します。', { sourceMethod: 'a8_screen_user_verified' });
  assert(validateApfrRecord(rA8, CASE_A, PID).valid === true, '3-3. productUsage / a8_screen_user_verified / fact → valid');
}

// ── Test 4: Decision108 Contract 維持 ──────────────────────────────
caseHeader('4. Fact昇格Contract（Decision108）が新 field でも維持される');
{
  const rManual = mkFact('productDescription', 'x', { sourceMethod: 'manual_user_input' });
  const v1 = validateApfrRecord(rManual, CASE_A, PID);
  assert(v1.valid === false && v1.errors.indexOf('fact_requires_verified_source_method') !== -1,
    '4-1. manual_user_input + classification:fact → invalid（fact_requires_verified_source_method）');
  const rUnver = mkFact('productDescription', 'x', { verificationStatus: 'unverified', verifiedBy: null, verifiedAt: null });
  const v2 = validateApfrRecord(rUnver, CASE_A, PID);
  assert(v2.valid === false && v2.errors.indexOf('fact_requires_user_verified_status') !== -1,
    '4-2. verificationStatus:unverified + classification:fact → invalid');
  const rNoUser = mkFact('targetUser', 'x', { verifiedBy: 'system' });
  const v3 = validateApfrRecord(rNoUser, CASE_A, PID);
  assert(v3.valid === false && v3.errors.indexOf('fact_requires_verifiedBy_user') !== -1,
    '4-3. verifiedBy:system + classification:fact → invalid');
  const rWebFact = mkFact('productFeatures', ['x'], { sourceMethod: 'web_retrieved' });
  assert(validateApfrRecord(rWebFact, CASE_A, PID).valid === false,
    '4-4. web_retrieved + classification:fact → invalid（EEA verified だけで Fact 昇格しない）');
  // non-fact は従来どおり許容
  const rUnknown = mkFact('productUsage', 'x', { classification: 'unknown', sourceMethod: 'manual_user_input', verificationStatus: 'unverified', verifiedBy: null, verifiedAt: null });
  assert(validateApfrRecord(rUnknown, CASE_A, PID).valid === true, '4-5. manual_user_input + classification:unknown → valid（非Factは従来どおり）');
}

// ── Test 5: 本番相当 fixture で resolved 21 / none 4 / ambiguous 0 ──
caseHeader('5. 既存 21 field fixture → resolved 21 / none 4 / ambiguous 0');
{
  const p = buildProduct();
  const res = _apfrResolveCurrentFacts(p);
  assert(res.resolvedCount === 21, `5-1. resolvedCount === 21（実際: ${res.resolvedCount}）`);
  assert(res.noneCount === 4, `5-2. noneCount === 4（新4 field は未登録）（実際: ${res.noneCount}）`);
  assert(res.ambiguousCount === 0, `5-3. ambiguousCount === 0（実際: ${res.ambiguousCount}）`);
  assert(NEW_FIELDS.every(function (f) { return res.none.indexOf(f) !== -1; }), '5-4. none に新4 field すべてが含まれる');
  assert(NEW_FIELDS.every(function (f) { return res.resolved[f] === undefined; }), '5-5. resolved に新 field は入らない');
}

// ── Test 6: 新 field に Fact を追加 → _cdcBuildFormalTruthLines に出力 ─
caseHeader('6. 新 field に Fact 登録済みなら Case Data Context に出力される');
{
  const p = buildProduct([
    mkFact('productDescription', 'プラファストは〜という説明。'),
    mkFact('productFeatures', ['特徴1', '特徴2']),
  ]);
  const res = _apfrResolveCurrentFacts(p);
  assert(res.resolvedCount === 23, `6-1. resolvedCount === 23（21 + 2）（実際: ${res.resolvedCount}）`);
  const lines = _cdcBuildFormalTruthLines(p);
  const joined = lines.join('\n');
  assert(joined.indexOf('商品説明（productDescription）: プラファストは〜という説明。') !== -1, '6-2. 商品説明の行が Formal Truth に出力される');
  assert(joined.indexOf('商品特徴（productFeatures）') !== -1 && joined.indexOf('特徴1') !== -1, '6-3. 商品特徴（array）の行が出力される');
  assert(lines.length === 23, `6-4. Formal Truth 行数 === 23（実際: ${lines.length}）`);
  // 未登録の productUsage / targetUser は行が出ない
  assert(joined.indexOf('使用方法（productUsage）') === -1 && joined.indexOf('対象者（targetUser）') === -1, '6-5. 未登録の新 field は行を出さない（none は出力しない）');
}

// ── Test 7: Compliance Context への非混入 ──────────────────────────
caseHeader('7. 新4 field は Compliance Context / Compliance Prompt へ混入しない');
{
  NEW_FIELDS.forEach(function (f) {
    assert(APFR_COMPLIANCE_CONTEXT_FIELDS.indexOf(f) === -1, `7-1. APFR_COMPLIANCE_CONTEXT_FIELDS に ${f} が無い`);
  });
  assert(APFR_COMPLIANCE_CONTEXT_FIELDS.length === 4, `7-2. APFR_COMPLIANCE_CONTEXT_FIELDS は4 field のまま（実際: ${APFR_COMPLIANCE_CONTEXT_FIELDS.length}）`);
  // openaiClient.js 側の Compliance Prompt field order も不変
  const oc = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
  const m = oc.match(/APFR_COMPLIANCE_PROMPT_FIELD_ORDER\s*=\s*\[([^\]]*)\]/);
  assert(m && NEW_FIELDS.every(function (f) { return m[1].indexOf(f) === -1; }), '7-3. openaiClient.js の APFR_COMPLIANCE_PROMPT_FIELD_ORDER に新 field が無い');
}

// ── Test 8: 既存 21 field の Resolver 結果不変 ─────────────────────
caseHeader('8. 既存 21 field の Resolver 結果は field 追加後も不変');
{
  const p = buildProduct();
  EXISTING_21.forEach(function (f) {
    const r = _apfrResolveCurrentFact(p, f);
    assert(r.status === 'resolved' && r.currentFact && r.currentFact.field === f, `8-1. ${f} → resolved（不変）`);
  });
  // 新 field を追加しても既存 field の解決に影響しない
  const p2 = buildProduct([mkFact('productDescription', 'x'), mkFact('productUsage', 'y')]);
  assert(EXISTING_21.every(function (f) { return _apfrResolveCurrentFact(p2, f).status === 'resolved'; }),
    '8-2. 新 field に Fact 追加後も既存21 field は全て resolved');
  // Cross-field guard: 新 field の Fact が既存 field の候補に混入しない
  assert(_apfrResolveCurrentFact(p2, 'productName').currentFact.field === 'productName', '8-3. Cross-field 混入なし');
}

// ── Test 9: index.html 静的確認（変更が定数追加のみ） ────────────────
caseHeader('9. index.html: 変更は APFR_FIELD_META / APFR_FIELD_ORDER の追加のみ');
{
  assert(src.indexOf("productDescription:               { label: '商品説明',              type: 'string',  group: '商品内容' }") !== -1, '9-1. APFR_FIELD_META に productDescription エントリ');
  assert(src.indexOf("'productDescription','productFeatures','productUsage','targetUser']") !== -1, '9-2. APFR_FIELD_ORDER 末尾に新4 field');
  // Resolver 関数本体は無変更（前工程で確認済みの実装文字列）
  assert(src.indexOf('function _apfrResolveCurrentFact(product, field) {') !== -1, '9-3. _apfrResolveCurrentFact シグネチャ不変');
  assert(src.indexOf("var order = (typeof APFR_FIELD_ORDER !== 'undefined' && Array.isArray(APFR_FIELD_ORDER)) ? APFR_FIELD_ORDER : [];") !== -1, '9-4. Resolver / CDC は APFR_FIELD_ORDER 駆動のまま');
  // validateApfrRecord に field allowlist 照合が追加されていない（field 自由・21/25 依存なし）
  const vBody = extractFn('function validateApfrRecord(');
  assert(vBody.indexOf('APFR_FIELD_ORDER') === -1, '9-5. validateApfrRecord は APFR_FIELD_ORDER と照合しない（Validator 無変更）');
  // Compliance 4 field リストは不変
  assert(src.indexOf("const APFR_COMPLIANCE_CONTEXT_FIELDS = ['listingNgWords', 'advertisingDisclosureRequirements', 'complianceRestrictions', 'regulatoryCategory'];") !== -1, '9-6. APFR_COMPLIANCE_CONTEXT_FIELDS 不変');
}

console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
console.log(_failed === 0 ? '🟢 All APFR Product Content Fields cases passed' : '🔴 FAILED');
process.exitCode = _failed === 0 ? 0 : 1;
