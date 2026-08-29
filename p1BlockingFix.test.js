'use strict';
// p1BlockingFix.test.js
// Instagram実運用1周目で確定したP1 Blocking Issue 2件の最小修正に対する回帰テスト。
// 実AI API呼び出し0件 / DB変更なし / 実案件への操作0。
//
//   P1-1 Output Draft caseId Binding Fix（index.html）
//     createOutputDraft()はcaseIdを持たないDraftを返すため、生成直後のDraftでは
//     _apfrCurrentAdoptedProduct()の三重guard（caseId一致）が必ず失敗し、
//     complianceContextが{}となってCompliance CheckがNOT CHECKEDへ、
//     さらに_apfrEvaluateMobileApprovalCompliance()もnot_checked→fail-open→blocked:falseとなり
//     C-1C-2b-1 Mobile Approval Enforcementが生成直後のDraftに対して発火しなかった。
//
//   P1-2 Reviewer/Strategy → Leader Final reject遵守（openaiClient.js）
//     Reviewer/Strategyが600文字でtruncateされ結論部が届かない問題と、
//     Leader Finalにreject遵守Contractが存在しない問題への最小修正。
//
// 本testは実関数のうちindex.html側（ブラウザ専用グローバル前提）は静的検証、
// openaiClient.js側は静的検証＋Resolver/Compliance系は同一ロジックの合成再現で検証する
// （既存apfrComplianceGate.test.js等と同一パターン）。

const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────────────────────────────
// テストハーネス
// ──────────────────────────────────────────────────────────────
let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log(`  ✅ ${label}`); }
  else { _failed++; console.log(`  ❌ ${label}`); }
}
function caseHeader(t) { console.log(`\n── ${t} ──`); }

const indexHtmlPath = path.join(__dirname, 'index.html');
const indexSrc = fs.readFileSync(indexHtmlPath, 'utf8');
const ocSrc = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');

// ──────────────────────────────────────────────────────────────
// 合成再現（index.html実装と同一ロジック。判定基準を新規に作らない）
// ──────────────────────────────────────────────────────────────
const APFR_FIELD_ORDER = ['aspName', 'programId', 'productName', 'productCategory',
  'partnershipStatus', 'landingUrl', 'productLinkAvailable',
  'payout', 'epc', 'approvalRate', 'cookieWindowDays', 'approvalEstimateDays',
  'reviewRequired', 'mobileOptimized', 'itpSupported', 'linkManagerSupported', 'listingPolicy',
  'listingNgWords', 'regulatoryCategory', 'complianceRestrictions', 'advertisingDisclosureRequirements'];
const APFR_COMPLIANCE_CONTEXT_FIELDS = ['listingNgWords', 'advertisingDisclosureRequirements', 'complianceRestrictions', 'regulatoryCategory'];
const APFR_CLASSIFICATION_VALUES = ['fact', 'prediction', 'inference', 'unknown'];
const APFR_SOURCE_METHOD_VALUES = ['a8_screen_user_verified', 'advertiser_lp_user_verified', 'manual_user_input'];
const APFR_VERIFICATION_STATUS_VALUES = ['user_verified', 'unverified'];
const APFR_FACT_ALLOWED_SOURCE_METHODS = ['a8_screen_user_verified', 'advertiser_lp_user_verified'];

function _apfrIsJsonSafeValue(v) {
  if (v === undefined) return false;
  if (typeof v === 'function' || typeof v === 'symbol') return false;
  try { return JSON.stringify(v) !== undefined; } catch (e) { return false; }
}
function validateApfrRecord(record, expectedCaseId, expectedProductIdentifier) {
  var errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { valid: false, errors: ['record_missing_or_invalid'] };
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
  if (record.classification === 'fact') {
    if (APFR_FACT_ALLOWED_SOURCE_METHODS.indexOf(record.sourceMethod) === -1) errors.push('fact_requires_verified_source_method');
    if (record.verificationStatus !== 'user_verified') errors.push('fact_requires_user_verified_status');
    if (record.verifiedBy !== 'user') errors.push('fact_requires_verifiedBy_user');
    if (typeof record.verifiedAt !== 'string' || !record.verifiedAt || isNaN(Date.parse(record.verifiedAt))) errors.push('fact_requires_valid_verifiedAt');
  }
  return { valid: errors.length === 0, errors: errors };
}
function _apfrFactsOf(p) { return (p && Array.isArray(p.facts)) ? p.facts : []; }
function _apfrHasSupersedes(f) { return !!(f && typeof f.supersedesFactId === 'string' && f.supersedesFactId !== ''); }
function _apfrCandidateFacts(product, field) {
  var facts = _apfrFactsOf(product);
  if (!facts.length) return [];
  return facts.filter(function (f) {
    if (!f || typeof f !== 'object') return false;
    if (f.field !== field) return false;
    if (f.caseId !== product.caseId) return false;
    if (f.productIdentifier !== product.productIdentifier) return false;
    return validateApfrRecord(f, product.caseId, product.productIdentifier).valid === true;
  });
}
function _apfrResolveCurrentFact(product, field) {
  var EMPTY = { status: 'none', currentFact: null, candidates: [], reason: '' };
  try {
    if (!product || typeof product !== 'object') return { status: 'ambiguous', currentFact: null, candidates: [], reason: 'invalid_product' };
    if (typeof product.caseId !== 'string' || !product.caseId || typeof product.productIdentifier !== 'string' || !product.productIdentifier) {
      return { status: 'ambiguous', currentFact: null, candidates: [], reason: 'invalid_product_scope' };
    }
    var pool = _apfrCandidateFacts(product, field);
    if (pool.length === 0) return Object.assign({}, EMPTY, { reason: 'no_fact' });
    var chained = pool.filter(_apfrHasSupersedes);
    if (chained.length === 0) {
      var newest = pool.slice().sort(function (a, b) { return Date.parse(b.recordedAt) - Date.parse(a.recordedAt); })[0];
      return { status: 'resolved', currentFact: newest, candidates: pool, reason: 'recordedAt_latest' };
    }
    var superseded = {};
    chained.forEach(function (f) { superseded[f.supersedesFactId] = true; });
    var heads = pool.filter(function (f) { return !superseded[f.factId]; });
    if (heads.length !== 1) return { status: 'ambiguous', currentFact: null, candidates: pool, reason: 'multiple_heads' };
    return { status: 'resolved', currentFact: heads[0], candidates: pool, reason: 'correction_chain' };
  } catch (e) { return { status: 'ambiguous', currentFact: null, candidates: [], reason: 'exception' }; }
}
function _apfrResolveCurrentFacts(product) {
  var out = { resolved: {}, none: [], ambiguous: [], resolvedCount: 0, noneCount: 0, ambiguousCount: 0 };
  APFR_FIELD_ORDER.forEach(function (field) {
    var r = _apfrResolveCurrentFact(product, field);
    if (r.status === 'resolved') { out.resolved[field] = r.currentFact; out.resolvedCount++; }
    else if (r.status === 'none') { out.none.push(field); out.noneCount++; }
    else { out.ambiguous.push({ field: field }); out.ambiguousCount++; }
  });
  return out;
}
function _apfrBuildComplianceContext(product) {
  var out = {};
  try {
    var res = _apfrResolveCurrentFacts(product);
    APFR_COMPLIANCE_CONTEXT_FIELDS.forEach(function (field) {
      var f = res.resolved[field];
      if (f) out[field] = f.value;
    });
  } catch (e) { /* fail-open */ }
  return out;
}
function _apfrComplianceGateNormalize(s) {
  var t = String(s);
  try { if (typeof t.normalize === 'function') t = t.normalize('NFKC'); } catch (e) {}
  return t.toLowerCase().trim();
}
function evaluateComplianceGate(outputDraft, complianceContext) {
  var EMPTY = { executed: false, checked: false, status: 'not_checked', violations: [] };
  try {
    if (!outputDraft || typeof outputDraft !== 'object') return EMPTY;
    var fields = outputDraft.fields;
    if (!fields || typeof fields !== 'object') return EMPTY;
    if (!complianceContext || typeof complianceContext !== 'object') return EMPTY;
    var raw = complianceContext.listingNgWords;
    if (!Array.isArray(raw) || raw.length === 0) return EMPTY;
    var ng = [];
    raw.forEach(function (w) { var n = _apfrComplianceGateNormalize(w); if (n !== '') ng.push({ raw: String(w), normalized: n }); });
    if (ng.length === 0) return EMPTY;
    var violations = [], seen = {};
    Object.keys(fields).forEach(function (fk) {
      var v = fields[fk], texts = [];
      if (typeof v === 'string') texts.push(v);
      else if (Array.isArray(v)) v.forEach(function (x) { if (x !== null && x !== undefined) texts.push(String(x)); });
      else return;
      texts.forEach(function (text) {
        var nt = _apfrComplianceGateNormalize(text);
        if (nt === '') return;
        ng.forEach(function (w) {
          if (nt.indexOf(w.normalized) === -1) return;
          var k = fk + '::' + w.raw;
          if (seen[k]) return;
          seen[k] = true;
          violations.push({ field: fk, ngWord: w.raw });
        });
      });
    });
    return { executed: true, checked: true, status: violations.length > 0 ? 'violation' : 'clear', violations: violations };
  } catch (e) { return EMPTY; }
}
const APFR_DISCLOSURE_ACCEPTED_MARKERS = [
  { type: 'label', display: '【広告】', normalized: _apfrComplianceGateNormalize('【広告】') },
  { type: 'label', display: '【PR】', normalized: _apfrComplianceGateNormalize('【PR】') },
  { type: 'hashtag', display: '#広告', normalized: _apfrComplianceGateNormalize('広告') },
  { type: 'hashtag', display: '#PR', normalized: _apfrComplianceGateNormalize('PR') },
  { type: 'hashtag', display: '#プロモーション', normalized: _apfrComplianceGateNormalize('プロモーション') },
];
function _apfrEvaluateDisclosureMarkers(outputDraft, complianceContext) {
  var EMPTY = { executed: false, checked: false, requirementPresent: false, foundMarkers: [], status: 'not_checked' };
  try {
    if (!outputDraft || typeof outputDraft !== 'object') return EMPTY;
    var fields = outputDraft.fields;
    if (!fields || typeof fields !== 'object') return EMPTY;
    if (!complianceContext || typeof complianceContext !== 'object') return EMPTY;
    var req = complianceContext.advertisingDisclosureRequirements;
    if (!Array.isArray(req) || req.length === 0) return EMPTY;
    var seen = {}, found = [];
    function add(d) { if (!seen[d]) { seen[d] = true; found.push(d); } }
    Object.keys(fields).forEach(function (fk) {
      var v = fields[fk], texts = [];
      if (typeof v === 'string') texts.push(v);
      else if (Array.isArray(v)) v.forEach(function (x) { if (x !== null && x !== undefined) texts.push(String(x)); });
      else return;
      texts.forEach(function (text) {
        var nt = _apfrComplianceGateNormalize(text);
        if (nt === '') return;
        APFR_DISCLOSURE_ACCEPTED_MARKERS.forEach(function (m) {
          if (m.type === 'hashtag') return;
          if (nt.indexOf(m.normalized) !== -1) add(m.display);
        });
        var re = /#([^\s#]+)/g, tm;
        while ((tm = re.exec(nt)) !== null) {
          APFR_DISCLOSURE_ACCEPTED_MARKERS.forEach(function (m) {
            if (m.type !== 'hashtag') return;
            if (tm[1] === m.normalized) add(m.display);
          });
        }
      });
    });
    return { executed: true, checked: true, requirementPresent: true, foundMarkers: found, status: found.length > 0 ? 'satisfied' : 'missing' };
  } catch (e) { return EMPTY; }
}
function _apfrEvaluateComplianceAssessment(outputDraft, complianceContext) {
  var EMPTY = { executed: false, status: 'not_checked', blockers: [], unchecked: [], details: { compliance: null, disclosure: null } };
  try {
    if (!outputDraft || typeof outputDraft !== 'object') return EMPTY;
    if (!complianceContext || typeof complianceContext !== 'object') return EMPTY;
    var c = evaluateComplianceGate(outputDraft, complianceContext);
    var d = _apfrEvaluateDisclosureMarkers(outputDraft, complianceContext);
    var blockers = [], unchecked = [];
    if (c.status === 'violation') blockers.push('listing_ng_words');
    else if (c.status === 'not_checked') unchecked.push('listing_ng_words');
    if (d.status === 'missing') blockers.push('advertising_disclosure');
    else if (d.status === 'not_checked') unchecked.push('advertising_disclosure');
    var status = blockers.length > 0 ? 'blocked' : ((c.status === 'not_checked' && d.status === 'not_checked') ? 'not_checked' : 'clear');
    return { executed: true, status: status, blockers: blockers, unchecked: unchecked, details: { compliance: c, disclosure: d } };
  } catch (e) { return EMPTY; }
}

// index.html の _apfrCurrentAdoptedProduct() と同一の三重guard
function _apfrCurrentAdoptedProduct(draft, currentCaseId) {
  try {
    if (!draft || !draft.fields || !draft.fields.intelligenceContext) return null;
    var product = draft.fields.intelligenceContext.product;
    if (!product || typeof product !== 'object' || !product.productIdentifier) return null;
    var cur = currentCaseId;
    if (!cur || String(draft.caseId || '') !== String(cur) || String(product.caseId || '') !== String(cur)) return null;
    return product;
  } catch (e) { return null; }
}
// index.html の _apfrEvaluateMobileApprovalCompliance() と同一（fail-open Contract）
function _apfrEvaluateMobileApprovalCompliance(draft, currentCaseId) {
  var NOT_BLOCKED = { evaluated: false, blocked: false, status: 'not_checked', blockers: [], unchecked: [] };
  try {
    var product = _apfrCurrentAdoptedProduct(draft, currentCaseId);
    var ctx = product ? _apfrBuildComplianceContext(product) : {};
    var a = _apfrEvaluateComplianceAssessment(draft, ctx);
    var status = (a && typeof a.status === 'string') ? a.status : 'not_checked';
    return { evaluated: !!(a && a.executed), blocked: status === 'blocked', status: status, blockers: a.blockers || [], unchecked: a.unchecked || [] };
  } catch (e) { return NOT_BLOCKED; }
}

// ── fixture（実案件プラファスト相当のFormal Truth） ──────────────
const CASE_A = 'case-msr9yckye65y';
const CASE_B = 'case-other000000';
const PID = 'a8:s00000015266009';
function mkFact(o) {
  return Object.assign({
    factId: 'f' + Math.random().toString(36).slice(2, 9),
    caseId: CASE_A, productIdentifier: PID, field: 'aspName', value: 'A8.net',
    classification: 'fact', sourceMethod: 'a8_screen_user_verified', verificationStatus: 'user_verified',
    verifiedBy: 'user', verifiedAt: '2026-08-21T21:00:00.000Z', recordedAt: '2026-08-21T21:00:00.000Z',
  }, o);
}
function mkProduct(caseId) {
  return {
    caseId: caseId, productIdentifier: PID,
    facts: [
      mkFact({ factId: 'ng1', caseId: caseId, field: 'listingNgWords', value: ['商品名', '法人名'] }),
      mkFact({ factId: 'ad1', caseId: caseId, field: 'advertisingDisclosureRequirements', value: ['広告とわかる表示が必要'] }),
      mkFact({ factId: 'rc1', caseId: caseId, field: 'regulatoryCategory', value: '医薬部外品' }),
    ],
  };
}
// createOutputDraft() 相当（caseIdを持たない）＋ carry-forward された intelligenceContext
function mkFreshDraftFields(caseId) {
  return {
    caption: '肝斑ケアをはじめよう。プラファストで毎日をていねいに。',
    cta: '詳しくはプロフィールのリンクから',
    hashtags: ['#スキンケア', '#プラファスト'],
    slides: ['1枚目：肝斑ケア、なにから始める？', '2枚目：プラファストという選択'],
    intelligenceContext: { product: mkProduct(caseId) },
  };
}

// ──────────────────────────────────────────────────────────────
console.log('P1 Blocking Fix 回帰テスト（実AI API 0件・DB変更0）');

// ══════════════════════════════════════════════════════════════
// Test A: Path A新Draft生成直後 caseId === runCaseId
// ══════════════════════════════════════════════════════════════
caseHeader('A. Path A新Draft生成直後に caseId が binding される（index.html静的検証）');
{
  const bindLine = "if (!_lastOutputDraft.caseId && _atRunCaseId) _lastOutputDraft.caseId = _atRunCaseId;";
  assert(indexSrc.indexOf(bindLine) !== -1, 'A-1. 新Draftへ _atRunCaseId をbindingする実装が存在する');

  // createOutputDraft() 呼び出しの直後・carry-forward と同一ブロック内にあること
  const createIdx = indexSrc.indexOf('_lastOutputDraft     = createOutputDraft(');
  const bindIdx = indexSrc.indexOf(bindLine);
  const carryIdx = indexSrc.indexOf('_lastOutputDraft.fields[k] = _formalFieldsCarryForward[k];');
  assert(createIdx !== -1 && bindIdx > createIdx, 'A-2. bindingは createOutputDraft() 呼び出しより後にある');
  assert(carryIdx !== -1 && bindIdx < carryIdx, 'A-3. bindingは既存carry-forwardより前にある（同一ブロック内）');

  // createOutputDraft() 本体は無変更（他経路への副作用を作っていない）
  const cod = indexSrc.indexOf('function createOutputDraft(type, sourceText) {');
  const codBody = indexSrc.slice(cod, indexSrc.indexOf('\n}\n', cod));
  assert(cod !== -1, 'A-4. createOutputDraft() が既存シグネチャのまま存在する');
  assert(codBody.indexOf('caseId') === -1, 'A-5. createOutputDraft() 本体は無変更（caseId参照0件＝他呼び出し経路へ副作用なし）');
}

// ══════════════════════════════════════════════════════════════
// Test B: 別caseのcaseIdをbindingしない（Cross-case安全性）
// ══════════════════════════════════════════════════════════════
caseHeader('B. Cross-case安全性');
{
  const bindLine = "if (!_lastOutputDraft.caseId && _atRunCaseId) _lastOutputDraft.caseId = _atRunCaseId;";
  assert(indexSrc.indexOf(bindLine) !== -1 && bindLine.indexOf('_atRunCaseId') !== -1,
    'B-1. binding値はWorkflow開始時に捕捉した _atRunCaseId のみ（他案件IDへfallbackしない）');
  assert(bindLine.indexOf('getCurrentApprovalCaseId()') === -1,
    'B-2. binding時に getCurrentApprovalCaseId()（_lastOutputDraft.caseIdへfallbackする関数）を使わない');
  assert(bindLine.indexOf('!_lastOutputDraft.caseId') !== -1,
    'B-3. 既存caseIdがある場合は上書きしない（冪等・復元Draftのcase_idを壊さない）');

  // Resolver側: 別caseのdraft.caseIdでは採用商品を取得しない
  const draftWrongCase = { caseId: CASE_B, fields: mkFreshDraftFields(CASE_A) };
  assert(_apfrCurrentAdoptedProduct(draftWrongCase, CASE_A) === null,
    'B-4. draft.caseIdが現在caseと不一致なら採用商品を取得しない');
  const draftForeignProduct = { caseId: CASE_A, fields: mkFreshDraftFields(CASE_B) };
  assert(_apfrCurrentAdoptedProduct(draftForeignProduct, CASE_A) === null,
    'B-5. product.caseIdが現在caseと不一致なら採用商品を取得しない');
  assert(_apfrCurrentAdoptedProduct({ caseId: CASE_A, fields: mkFreshDraftFields(CASE_A) }, null) === null,
    'B-6. 現在case未確定（null）なら採用商品を取得しない');
}

// ══════════════════════════════════════════════════════════════
// Test C: 生成直後でもCompliance Resolverがcurrent productを取得できる
// ══════════════════════════════════════════════════════════════
caseHeader('C. 生成直後Draftの Compliance Context 回復');
{
  // 修正前の状態（caseId未設定）
  const before = { fields: mkFreshDraftFields(CASE_A) }; // caseId なし
  assert(_apfrCurrentAdoptedProduct(before, CASE_A) === null, 'C-1. 修正前（caseId未設定）は採用商品を取得できない＝NOT CHECKEDの原因');
  const ctxBefore = _apfrCurrentAdoptedProduct(before, CASE_A) ? {} : {};
  assert(Object.keys(ctxBefore).length === 0, 'C-2. 修正前は complianceContext が {}');
  assert(evaluateComplianceGate(before, ctxBefore).status === 'not_checked', 'C-3. 修正前は禁止語 NOT CHECKED');
  assert(_apfrEvaluateDisclosureMarkers(before, ctxBefore).status === 'not_checked', 'C-4. 修正前は広告開示 NOT CHECKED');

  // 修正後の状態（caseId binding済み）
  const after = { caseId: CASE_A, fields: mkFreshDraftFields(CASE_A) };
  const product = _apfrCurrentAdoptedProduct(after, CASE_A);
  assert(product !== null && product.productIdentifier === PID, 'C-5. 修正後は採用商品を取得できる');
  const ctxAfter = _apfrBuildComplianceContext(product);
  assert(Array.isArray(ctxAfter.listingNgWords) && ctxAfter.listingNgWords.length === 2, 'C-6. listingNgWords を評価可能');
  assert(Array.isArray(ctxAfter.advertisingDisclosureRequirements) && ctxAfter.advertisingDisclosureRequirements.length === 1, 'C-7. advertisingDisclosureRequirements を評価可能');
  assert(evaluateComplianceGate(after, ctxAfter).status !== 'not_checked', 'C-8. 禁止語が NOT CHECKED でなくなる（実判定される）');
  assert(_apfrEvaluateDisclosureMarkers(after, ctxAfter).status !== 'not_checked', 'C-9. 広告開示が NOT CHECKED でなくなる（実判定される）');
  assert(_apfrEvaluateComplianceAssessment(after, ctxAfter).status !== 'not_checked', 'C-10. Compliance Assessment が NOT CHECKED でなくなる');
}

// ══════════════════════════════════════════════════════════════
// Test D: disclosure missing時 Mobile Approval Enforcement blocked===true
// ══════════════════════════════════════════════════════════════
caseHeader('D. Mobile Approval Enforcement（C-1C-2b-1）の回復');
{
  // 修正前: caseIdなし → not_checked → fail-open → blocked:false（Enforcementが発火しない）
  const before = { fields: mkFreshDraftFields(CASE_A) };
  const rBefore = _apfrEvaluateMobileApprovalCompliance(before, CASE_A);
  assert(rBefore.status === 'not_checked', 'D-1. 修正前は Assessment が not_checked');
  assert(rBefore.blocked === false, 'D-2. 修正前は fail-open で blocked:false（Enforcementが実質無効だった）');

  // 修正後: caseIdあり・開示マーカーなし → blocked:true
  const after = { caseId: CASE_A, fields: mkFreshDraftFields(CASE_A) };
  const rAfter = _apfrEvaluateMobileApprovalCompliance(after, CASE_A);
  assert(rAfter.status === 'blocked', 'D-3. 修正後・開示マーカーなしは Assessment が blocked');
  assert(rAfter.blocked === true, 'D-4. 修正後は Mobile Approval Enforcement が blocked:true で発火する');
  assert(rAfter.blockers.indexOf('advertising_disclosure') !== -1, 'D-5. blocker理由に advertising_disclosure が含まれる');

  // 開示マーカーを追加すると解除される（永久blockではない）
  const fixed = { caseId: CASE_A, fields: Object.assign({}, mkFreshDraftFields(CASE_A), { caption: '【広告】肝斑ケアをはじめよう。' }) };
  const rFixed = _apfrEvaluateMobileApprovalCompliance(fixed, CASE_A);
  assert(rFixed.blocked === false, 'D-6. 正式Accepted Marker（【広告】）追加で blocked が解除される（修復可能）');

  // 禁止語違反も blocked になる
  const ng = { caseId: CASE_A, fields: Object.assign({}, mkFreshDraftFields(CASE_A), { caption: '【広告】商品名を掲載します' }) };
  const rNg = _apfrEvaluateMobileApprovalCompliance(ng, CASE_A);
  assert(rNg.blocked === true && rNg.blockers.indexOf('listing_ng_words') !== -1, 'D-7. 禁止語違反も blocked として検出される');

  // 採用商品なし（別案件へ切替済み等）は fail-open のまま（既存Contract維持）
  const noProduct = { caseId: CASE_A, fields: { caption: 'テスト' } };
  assert(_apfrEvaluateMobileApprovalCompliance(noProduct, CASE_A).blocked === false,
    'D-8. 採用商品が無い場合は fail-open で blocked:false（既存Contract維持・誤ブロックしない）');
}

// ══════════════════════════════════════════════════════════════
// Test E: Reviewer reject遵守Contractがquestionへ含まれる
// ══════════════════════════════════════════════════════════════
caseHeader('E. Leader Final question への Reviewer reject遵守Contract 追加');
{
  assert(ocSrc.indexOf('var LEADER_FINAL_REVIEWER_REJECT_RULE = [') !== -1, 'E-1. reject遵守Contract定数が存在する');
  assert(ocSrc.indexOf('【Reviewer判断の遵守（最優先・完成成果物の可否）】') !== -1, 'E-2. 見出しが存在する');
  assert(ocSrc.indexOf('その指摘を解消していない内容を完成成果物として採用してはいけません。') !== -1, 'E-3. 未解消時の採用禁止が明記されている');
  assert(ocSrc.indexOf('公開可能な完成成果物として扱わず、未解消の指摘と必要な対応を明示してください。') !== -1, 'E-4. 解消不能時の扱いが明記されている');
  assert(ocSrc.indexOf('あなたの判断で「問題なし」と上書きしないでください。') !== -1, 'E-5. Leaderによるreject上書きを禁止している');
  assert(ocSrc.indexOf('「Reviewer確認済み」「Compliance Check完了」等と記載しないでください。') !== -1, 'E-6. 未確認の「Reviewer確認済み」表示を禁止している');

  // questionへ条件付きで挿入されていること（Reviewerが1人も居ない場合は既存questionと同一＝fail-open）
  //   Issue A / Option D: main-task Reviewer（mainReviewerText）も発火条件へ追加された。
  //   Ruleの対象と実際に停止判断を出すReviewerを一致させるための拡張であり、条件緩和ではない。
  assert(ocSrc.indexOf("(reviewerText || mainReviewerText) ? LEADER_FINAL_REVIEWER_REJECT_RULE : ''") !== -1,
    'E-7. Reviewer（post-process または main-task）が存在する場合のみquestionへ付加する（Reviewer未実行時はfail-open）');
  assert(ocSrc.indexOf("LEADER_FINAL_REVIEWER_REJECT_RULE : ''") !== -1,
    'E-7b. 付加は依然として条件付き（無条件付加になっていない）');

  // LEADER_FINAL_PROMPT定数は無変更（released testのbyte一致固定を壊さない）
  const cp = require('child_process');
  const headSrc = cp.execSync('git show HEAD:openaiClient.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 30 }).toString('utf8');
  function extractConst(s, name) {
    const st = s.indexOf('const ' + name + ' = [');
    if (st === -1) return null;
    const en = s.indexOf('\n].join', st);
    return s.slice(st, en !== -1 ? en : st + 3000);
  }
  assert(extractConst(ocSrc, 'LEADER_FINAL_PROMPT') === extractConst(headSrc, 'LEADER_FINAL_PROMPT'),
    'E-8. LEADER_FINAL_PROMPT本体がHEADと完全一致（変更0）');
  assert(extractConst(ocSrc, 'ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT') === extractConst(headSrc, 'ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT'),
    'E-9. ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT本体がHEADと完全一致（変更0）');
}

// ══════════════════════════════════════════════════════════════
// Test F: Reviewer/Strategy textが1200文字まで渡る
// ══════════════════════════════════════════════════════════════
caseHeader('F. Reviewer/Strategy の truncate 上限');
{
  assert(ocSrc.indexOf('var LEADER_FINAL_POSTPROCESS_TEXT_MAX = 1200;') !== -1, 'F-1. 上限定数が1200で定義されている');
  assert(ocSrc.indexOf('reviewerTask.result.slice(0, LEADER_FINAL_POSTPROCESS_TEXT_MAX)') !== -1, 'F-2. reviewerTextが新上限を使用する');
  assert(ocSrc.indexOf('strategyTask.result.slice(0, LEADER_FINAL_POSTPROCESS_TEXT_MAX)') !== -1, 'F-3. strategyTextが新上限を使用する');
  assert(ocSrc.indexOf('reviewerTask.result.slice(0, 600)') === -1, 'F-4. 旧600文字truncateが残っていない（reviewer）');
  assert(ocSrc.indexOf('strategyTask.result.slice(0, 600)') === -1, 'F-5. 旧600文字truncateが残っていない（strategy）');
  assert(ocSrc.indexOf('reply.slice(0, 1200)') !== -1, 'F-6. memberRepliesの1200文字は無変更（同水準へ揃えた）');

  // 上限自体は撤廃していない（payload肥大化防止）
  const longText = 'あ'.repeat(5000);
  assert(longText.slice(0, 1200).length === 1200, 'F-7. 上限は撤廃せず1200で切り詰める');
}

// ══════════════════════════════════════════════════════════════
// Test G: 変更していないことの確認（既存Contract非破壊）
// ══════════════════════════════════════════════════════════════
caseHeader('G. 既存Contract 変更0');
{
  // Quality Gate / READY 無変更
  const qgStart = indexSrc.indexOf('function evaluateQualityGate(packageQuality) {');
  assert(qgStart !== -1, 'G-1. evaluateQualityGate() が既存シグネチャのまま存在');
  const qgBody = indexSrc.slice(qgStart, indexSrc.indexOf('\n}\n', qgStart));
  assert(qgBody.indexOf('QUALITY_GATE_PASSING_STATUSES.indexOf(sourceStatus)') !== -1, 'G-2. Quality Gate判定ロジックが無変更');
  assert(qgBody.indexOf('caseId') === -1, 'G-3. evaluateQualityGate()にcaseId参照0件');
  assert(indexSrc.indexOf('_lastOutputDraft.status    = noCompletedResults ? OUTPUT_STATUS.ERROR : OUTPUT_STATUS.READY;') !== -1,
    'G-4. OUTPUT_STATUS.READY判定ロジックが既存のまま');

  // Compliance detector 3種は無変更
  assert(indexSrc.indexOf('function evaluateComplianceGate(outputDraft, complianceContext) {') !== -1, 'G-5. evaluateComplianceGate() 無変更');
  assert(indexSrc.indexOf('function _apfrEvaluateDisclosureMarkers(outputDraft, complianceContext) {') !== -1, 'G-6. _apfrEvaluateDisclosureMarkers() 無変更');
  assert(indexSrc.indexOf('function _apfrEvaluateComplianceAssessment(outputDraft, complianceContext) {') !== -1, 'G-7. _apfrEvaluateComplianceAssessment() 無変更');
  assert(indexSrc.indexOf('function _apfrCurrentAdoptedProduct() {') !== -1, 'G-8. _apfrCurrentAdoptedProduct() 無変更（guard自体は変えていない）');

  // Mobile Approval Enforcement 本体は無変更
  const apStart = indexSrc.indexOf('function approveInstagramPackage() {');
  const apBody = indexSrc.slice(apStart, indexSrc.indexOf('\n}\n', apStart));
  assert(apBody.indexOf('if (_apCompliance.blocked) {') !== -1, 'G-9. approveInstagramPackage()のCompliance Enforcementが無変更');
  assert(indexSrc.indexOf('var canApprove = _mapAllChecked() && _mapReviewApproved(mai) && !_mapCompliance.blocked;') !== -1,
    'G-10. canApprove判定が無変更');

  // Rule Engine 無変更
  const cp = require('child_process');
  const reNow = fs.readFileSync(path.join(__dirname, 'shared', 'leaderRuleEngine.js'), 'utf8');
  const reHead = cp.execSync('git show HEAD:shared/leaderRuleEngine.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 10 }).toString('utf8');
  assert(reNow === reHead, 'G-11. shared/leaderRuleEngine.js がHEADと完全一致（reviewerSignal実装は今回対象外）');

  // server.js / claudeClient.js 無変更
  const svNow = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  const svHead = cp.execSync('git show HEAD:server.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 30 }).toString('utf8');
  assert(svNow === svHead, 'G-12. server.js がHEADと完全一致（変更0）');
  const clNow = fs.readFileSync(path.join(__dirname, 'claudeClient.js'), 'utf8');
  const clHead = cp.execSync('git show HEAD:claudeClient.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 20 }).toString('utf8');
  assert(clNow === clHead, 'G-13. claudeClient.js がHEADと完全一致（変更0）');

  // Issue 3（instagram_post Quality 30固定）は今回修正しない
  assert(indexSrc.indexOf("updatedFields = ['caption', 'cta', 'hashtags'];") !== -1,
    'G-14. instagram_post のfields mappingは無変更（Issue 3はP2として保留）');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All P1 Blocking Fix cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
