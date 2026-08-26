'use strict';
// apfrComplianceGate.test.js
// APFR Step C-1C-1: Deterministic Compliance Check 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / 本番案件への操作0
// index.html内の evaluateComplianceGate() / _apfrComplianceGateNormalize() と等価なロジックを
// Node環境で再現して検証する（既存apfr*.test.jsと同一パターン）。
// あわせて実ソース（index.html）へのstatic検証を行い、
//   ・evaluateComplianceGate() が facts / Resolver を一切参照していないこと
//   ・packageQuality / evaluateQualityGate() 等が無変更であること
// を確認する。

const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック（Resolver + Compliance Context + Compliance Gate）
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

const APFR_COMPLIANCE_CONTEXT_FIELDS = ['listingNgWords', 'advertisingDisclosureRequirements', 'complianceRestrictions', 'regulatoryCategory'];

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
    APFR_FIELD_ORDER.forEach(function (field) {
      var r = _apfrResolveCurrentFact(product, field);
      if (r.status === 'resolved') { out.resolved[field] = r.currentFact; out.resolvedCount++; }
      else if (r.status === 'none') { out.none.push(field); out.noneCount++; }
      else { out.ambiguous.push({ field: field, reason: r.reason, candidates: r.candidates }); out.ambiguousCount++; }
    });
  } catch (e) { /* fail-open */ }
  return out;
}
// index.htmlの _apfrBuildComplianceContext() と等価
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

// index.htmlの _apfrComplianceGateNormalize() と等価
function _apfrComplianceGateNormalize(s) {
  var t = String(s);
  try { if (typeof t.normalize === 'function') t = t.normalize('NFKC'); } catch (e) { /* noop */ }
  return t.toLowerCase().trim();
}

// index.htmlの evaluateComplianceGate() と等価
function evaluateComplianceGate(outputDraft, complianceContext) {
  var EMPTY_NOT_CHECKED = { executed: false, checked: false, status: 'not_checked', violations: [] };
  try {
    if (!outputDraft || typeof outputDraft !== 'object') return EMPTY_NOT_CHECKED;
    var fields = outputDraft.fields;
    if (!fields || typeof fields !== 'object') return EMPTY_NOT_CHECKED;
    if (!complianceContext || typeof complianceContext !== 'object') return EMPTY_NOT_CHECKED;

    var rawNgWords = complianceContext.listingNgWords;
    if (!Array.isArray(rawNgWords) || rawNgWords.length === 0) return EMPTY_NOT_CHECKED;

    var ngWords = [];
    rawNgWords.forEach(function (w) {
      var normalized = _apfrComplianceGateNormalize(w);
      if (normalized !== '') ngWords.push({ raw: String(w), normalized: normalized });
    });
    if (ngWords.length === 0) return EMPTY_NOT_CHECKED;

    var violations = [];
    var seen = {};
    Object.keys(fields).forEach(function (fieldKey) {
      var value = fields[fieldKey];
      var texts = [];
      if (typeof value === 'string') {
        texts.push(value);
      } else if (Array.isArray(value)) {
        value.forEach(function (v) { if (v !== null && v !== undefined) texts.push(String(v)); });
      } else {
        return;
      }
      texts.forEach(function (text) {
        var normalizedText = _apfrComplianceGateNormalize(text);
        if (normalizedText === '') return;
        ngWords.forEach(function (ng) {
          if (normalizedText.indexOf(ng.normalized) === -1) return;
          var dedupeKey = fieldKey + '::' + ng.raw;
          if (seen[dedupeKey]) return;
          seen[dedupeKey] = true;
          violations.push({ field: fieldKey, ngWord: ng.raw });
        });
      });
    });

    return {
      executed: true,
      checked: true,
      status: violations.length > 0 ? 'violation' : 'clear',
      violations: violations,
    };
  } catch (e) {
    return EMPTY_NOT_CHECKED;
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
function mkProduct(facts, opts) {
  return Object.assign({ caseId: CASE_A, productIdentifier: PID, productName: 'プラファスト', aspName: 'A8.net', facts: facts }, opts || {});
}
function mkDraft(fields) {
  return { id: 'out_test', type: 'instagram_carousel', status: 'ready', fields: fields || {} };
}

// ──────────────────────────────────────────────────────────────
caseHeader('1. hit: listingNgWordsが成果物に存在 → violation');
{
  const ctx = { listingNgWords: ['無料'] };
  const draft = mkDraft({ caption: '今なら無料でお試しいただけます' });
  const r = evaluateComplianceGate(draft, ctx);
  assert(r.status === 'violation', '1-1. status=violation');
  assert(r.executed === true && r.checked === true, '1-2. executed/checked=true');
  assert(r.violations.length === 1 && r.violations[0].field === 'caption' && r.violations[0].ngWord === '無料', '1-3. violation詳細が正しい');
}

caseHeader('2. no hit: 禁止語が存在しない → clear');
{
  const ctx = { listingNgWords: ['無料'] };
  const draft = mkDraft({ caption: 'とても良い商品です' });
  const r = evaluateComplianceGate(draft, ctx);
  assert(r.status === 'clear', '2-1. status=clear');
  assert(r.violations.length === 0, '2-2. violations=0件');
}

caseHeader('3. none: listingNgWordsが存在しない → not_checked');
{
  const r1 = evaluateComplianceGate(mkDraft({ caption: 'test' }), {});
  assert(r1.status === 'not_checked' && r1.executed === false, '3-1. complianceContext={} → not_checked');
  const r2 = evaluateComplianceGate(mkDraft({ caption: 'test' }), { advertisingDisclosureRequirements: ['PR表記'] });
  assert(r2.status === 'not_checked', '3-2. listingNgWordsキー自体が無い → not_checked');
}

caseHeader('4. empty: 空配列・空文字要素 → not_checked');
{
  assert(evaluateComplianceGate(mkDraft({ caption: 'test' }), { listingNgWords: [] }).status === 'not_checked', '4-1. 空配列 → not_checked');
  assert(evaluateComplianceGate(mkDraft({ caption: 'test' }), { listingNgWords: [''] }).status === 'not_checked', '4-2. 空文字1件 → not_checked');
  assert(evaluateComplianceGate(mkDraft({ caption: 'test' }), { listingNgWords: [' '] }).status === 'not_checked', '4-3. 空白のみ → not_checked');
  assert(evaluateComplianceGate(mkDraft({ caption: '' }), { listingNgWords: ['無料'] }).status === 'clear', '4-4. 出力側が空文字 → clear（違反なし）');
}

caseHeader('5. ambiguous: C-1Aで非出力となるfixture → not_checked');
{
  // 同一field・同一recordedAtでchain関係なし → recordedAt_collision → ambiguous → complianceContextに出現しない
  const a = mkFact({ factId: 'a', field: 'listingNgWords', value: ['A'], recordedAt: '2026-08-22T10:00:00.000Z' });
  const b = mkFact({ factId: 'b', field: 'listingNgWords', value: ['B'], recordedAt: '2026-08-22T10:00:00.000Z' });
  const ctx = _apfrBuildComplianceContext(mkProduct([a, b]));
  assert(!('listingNgWords' in ctx), '5-1. 前提: ambiguousなfieldはcomplianceContextに出現しない');
  const r = evaluateComplianceGate(mkDraft({ caption: 'A' }), ctx);
  assert(r.status === 'not_checked', '5-2. ambiguous由来のcomplianceContext → not_checked（noneと区別しない）');
}

caseHeader('6. Correction: A→B supersedes A → Bのみ検査対象');
{
  const a = mkFact({ factId: 'a', field: 'listingNgWords', value: ['無料'], recordedAt: '2026-08-22T10:00:00.000Z' });
  const b = mkFact({ factId: 'b', field: 'listingNgWords', value: ['絶対'], recordedAt: '2026-08-22T11:00:00.000Z', supersedesFactId: 'a' });
  const ctx = _apfrBuildComplianceContext(mkProduct([a, b]));
  const rOld = evaluateComplianceGate(mkDraft({ caption: '無料でお試し' }), ctx);
  assert(rOld.status === 'clear', '6-1. 訂正前（A）の語は検査対象外のためclear');
  const rNew = evaluateComplianceGate(mkDraft({ caption: '絶対にお得' }), ctx);
  assert(rNew.status === 'violation' && rNew.violations[0].ngWord === '絶対', '6-2. 訂正後（B）の語のみ検査対象');
}

caseHeader('7. NFKC正規化: 全角・半角差異でもhit');
{
  const ctx = { listingNgWords: ['ＡＢＣ'] }; // 全角
  const r = evaluateComplianceGate(mkDraft({ caption: 'This is abc test' }), ctx); // 半角小文字
  assert(r.status === 'violation', '7-1. 全角NGwordが半角小文字出力にもhitする（NFKC+lowercase）');
}

caseHeader('8. case-insensitive: 英語NGwordの大文字小文字差異');
{
  const ctx = { listingNgWords: ['FREE'] };
  const r = evaluateComplianceGate(mkDraft({ caption: 'Get it for free today' }), ctx);
  assert(r.status === 'violation', '8-1. 大文字NGwordが小文字出力にもhitする');
}

caseHeader('9. array output: hashtags配列内でのhit');
{
  const ctx = { listingNgWords: ['最安値'] };
  const r = evaluateComplianceGate(mkDraft({ hashtags: ['商品名', '最安値保証', 'PR'] }), ctx);
  assert(r.status === 'violation' && r.violations[0].field === 'hashtags', '9-1. array要素内のhitを検出');
}

caseHeader('10. multi-field: 複数fieldでhit・field情報を正しく保持');
{
  const ctx = { listingNgWords: ['無料', '最安値'] };
  const r = evaluateComplianceGate(mkDraft({ caption: '今なら無料', hashtags: ['最安値保証'] }), ctx);
  assert(r.violations.length === 2, '10-1. 2件のviolationを検出');
  const fields = r.violations.map(function (v) { return v.field; }).sort();
  assert(fields[0] === 'caption' && fields[1] === 'hashtags', '10-2. field情報がそれぞれ正しい');
}

caseHeader('11. duplicate: 同一field/ngWordの重複violationsを制御');
{
  const ctx = { listingNgWords: ['無料'] };
  const r = evaluateComplianceGate(mkDraft({ caption: '無料！無料！今すぐ無料で試す' }), ctx);
  assert(r.status === 'violation', '11-1. status=violation');
  assert(r.violations.length === 1, '11-2. 同一field内の複数出現は1件に重複排除される');
}

caseHeader('12. mutation: 実行前後でoutputDraft/complianceContextがdeep equal');
{
  const draft = mkDraft({ caption: '無料でお試し', hashtags: ['A', 'B'] });
  const ctx = { listingNgWords: ['無料'] };
  const draftBefore = JSON.stringify(draft);
  const ctxBefore = JSON.stringify(ctx);
  evaluateComplianceGate(draft, ctx);
  assert(JSON.stringify(draft) === draftBefore, '12-1. outputDraftは実行前後で完全不変');
  assert(JSON.stringify(ctx) === ctxBefore, '12-2. complianceContextは実行前後で完全不変');
}

caseHeader('13. direct Resolver use: 実ソースでfacts/Resolver参照0件');
{
  const indexHtmlPath = path.join(__dirname, 'index.html');
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function evaluateComplianceGate(');
  assert(start !== -1, '13-1. evaluateComplianceGate() が実在する');
  if (start !== -1) {
    const end = src.indexOf('\n}\n', start);
    const body = src.slice(start, end !== -1 ? end : start + 4000);
    assert(body.indexOf('.facts') === -1, '13-2. .facts参照が0件');
    assert(body.indexOf('_apfrResolveCurrentFact(') === -1, '13-3. _apfrResolveCurrentFact()呼び出しが0件');
    assert(body.indexOf('_apfrResolveCurrentFacts(') === -1, '13-4. _apfrResolveCurrentFacts()呼び出しが0件');
  }
}

caseHeader('14. packageQuality回帰: 既存関数が無変更');
{
  const indexHtmlPath = path.join(__dirname, 'index.html');
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(src.indexOf('function evaluateOutputPackageCompleteness(draft) {') !== -1, '14-1. evaluateOutputPackageCompleteness()が既存シグネチャのまま存在');
  const pqStart = src.indexOf('function evaluateOutputPackageCompleteness(draft) {');
  const pqEnd = src.indexOf('\n}\n', pqStart);
  const pqBody = src.slice(pqStart, pqEnd);
  assert(pqBody.indexOf('complianceGate') === -1 && pqBody.indexOf('evaluateComplianceGate') === -1, '14-2. evaluateOutputPackageCompleteness()本体にComplianceGateへの参照が0件（責務混在なし）');
}

caseHeader('15. evaluateQualityGate回帰: 既存関数が無変更');
{
  const indexHtmlPath = path.join(__dirname, 'index.html');
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const qgStart = src.indexOf('function evaluateQualityGate(packageQuality) {');
  assert(qgStart !== -1, '15-1. evaluateQualityGate()が既存シグネチャのまま存在');
  const qgEnd = src.indexOf('\n}\n', qgStart);
  const qgBody = src.slice(qgStart, qgEnd);
  assert(qgBody.indexOf('complianceGate') === -1 && qgBody.indexOf('evaluateComplianceGate') === -1, '15-2. evaluateQualityGate()本体にComplianceGateへの参照が0件');
  assert(qgBody.indexOf('QUALITY_GATE_PASSING_STATUSES.indexOf(sourceStatus)') !== -1, '15-3. 既存のpassed判定ロジックが無変更');
}

caseHeader('16. User Approval非ブロック: 表示関数がUser Approval/READY関連識別子を変更していない');
{
  const indexHtmlPath = path.join(__dirname, 'index.html');
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function buildComplianceGateHtml() {');
  assert(start !== -1, '16-1. buildComplianceGateHtml() が実在する');
  if (start !== -1) {
    const end = src.indexOf('\n}\n', start);
    const body = src.slice(start, end !== -1 ? end : start + 3000);
    assert(body.indexOf('OUTPUT_STATUS.READY') === -1, '16-2. READY遷移への参照0件');
    assert(body.indexOf('canApprove') === -1, '16-3. canApprove（IADP承認）への参照0件');
    assert(body.indexOf('pushApprovalToServer') === -1 && body.indexOf('_enqueueApprovalPost') === -1, '16-4. User Approval送信処理への参照0件');
    assert(body.indexOf('確認表示のみ') !== -1, '16-5. 非ブロッキングである旨の明示文言が存在する');
  }
}

caseHeader('17. IADP無回帰: canApprove算出ロジック・Executive Decision Engineが無変更');
{
  const indexHtmlPath = path.join(__dirname, 'index.html');
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  // C-1C-2b-1（Mobile Approval Enforcement）でcanApproveへ `!_mapCompliance.blocked` が追加された。
  //   本test（C-1C-1）の関心は「evaluateComplianceGate()がUser Approvalを直接操作していないこと」であり、
  //   既存2条件が維持されていることを引き続き検証する（Enforcementはhelper経由でありC-1C-1の責務外）。
  assert(src.indexOf('var canApprove = _mapAllChecked() && _mapReviewApproved(mai) && !_mapCompliance.blocked;') !== -1,
    '17-1. canApprove算出が既存2条件を維持している（C-1C-2b-1のEnforcement条件追加後も_mapAllChecked/_mapReviewApprovedは不変）');
  assert(src.indexOf('inbox.qualityGate = (typeof evaluateQualityGate === ') !== -1, '17-2. Executive Decision Engine内のevaluateQualityGate呼び出し箇所が既存のまま（変更なし）');
}

caseHeader('18. Output Engine配線確認: buildComplianceGateHtmlが独立パネルとして接続されている');
{
  const indexHtmlPath = path.join(__dirname, 'index.html');
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(src.indexOf("_oeSafe(buildComplianceGateHtml,           'ComplianceGate')") !== -1, '18-1. Output Engineパネル合成リストへ接続されている');
  assert(src.indexOf("_oeSafe(buildOutputPackageQualityHtml,     'OutputPackageQuality')\n    + _oeSafe(buildComplianceGateHtml") !== -1, '18-2. Output Package Quality直後に配置されている（packageQualityとは別パネル）');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All APFR Step C-1C-1 deterministic compliance check cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
