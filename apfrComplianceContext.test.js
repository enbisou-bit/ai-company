'use strict';
// apfrComplianceContext.test.js
// APFR Step C-1A: Compliance Context Foundation 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / Web Search 0 / 本番案件への操作0
// index.html内の _apfrResolveCurrentFact() / _apfrResolveCurrentFacts() / _apfrBuildComplianceContext()
// と等価なロジックをNode環境で再現して検証する（既存apfrCurrentFactResolver.test.jsと同一パターン）。
// あわせて、実ソース（index.html / openaiClient.js）へのstatic検証を行い、
//   ・_apfrBuildComplianceContext が facts 配列を直接走査していないこと
//   ・runAutoTaskWorkflow の complianceContext が buildSystemPrompt() 文字列生成に一切使われていないこと（C-1A時点）
// を確認する。

const fs = require('fs');
const path = require('path');

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック（Resolver + Compliance Context Foundation）
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

// APFR Step C-1A対象4field（listingPolicyは対象外）
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
    var order = APFR_FIELD_ORDER;
    order.forEach(function (field) {
      var r = _apfrResolveCurrentFact(product, field);
      if (r.status === 'resolved') { out.resolved[field] = r.currentFact; out.resolvedCount++; }
      else if (r.status === 'none') { out.none.push(field); out.noneCount++; }
      else { out.ambiguous.push({ field: field, reason: r.reason, candidates: r.candidates }); out.ambiguousCount++; }
    });
  } catch (e) { /* fail-open */ }
  return out;
}

// index.htmlの _apfrBuildComplianceContext() と等価（Resolverのみ使用・4fieldのみ・listingPolicy対象外）
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

// ──────────────────────────────────────────────────────────────
caseHeader('1. resolved: 4fieldのresolved値だけ取得される');
{
  const ngWords = mkFact({ factId: 'f1', field: 'listingNgWords', value: ['商品名', '法人名'], recordedAt: '2026-08-22T10:00:00.000Z' });
  const disclosure = mkFact({ factId: 'f2', field: 'advertisingDisclosureRequirements', value: ['#PR表記必須'], recordedAt: '2026-08-22T10:00:00.000Z' });
  const restrictions = mkFact({ factId: 'f3', field: 'complianceRestrictions', value: ['未成年への訴求禁止'], recordedAt: '2026-08-22T10:00:00.000Z' });
  const category = mkFact({ factId: 'f4', field: 'regulatoryCategory', value: '健康食品', recordedAt: '2026-08-22T10:00:00.000Z' });
  const payout = mkFact({ factId: 'f5', field: 'payout', value: '3000円', recordedAt: '2026-08-22T10:00:00.000Z' }); // 対象外field（score系）
  const ctx = _apfrBuildComplianceContext(mkProduct([ngWords, disclosure, restrictions, category, payout]));
  assert(Array.isArray(ctx.listingNgWords) && ctx.listingNgWords.length === 2, '1-1. listingNgWordsが正しく取得される');
  assert(Array.isArray(ctx.advertisingDisclosureRequirements) && ctx.advertisingDisclosureRequirements[0] === '#PR表記必須', '1-2. advertisingDisclosureRequirementsが正しく取得される');
  assert(Array.isArray(ctx.complianceRestrictions) && ctx.complianceRestrictions.length === 1, '1-3. complianceRestrictionsが正しく取得される');
  assert(ctx.regulatoryCategory === '健康食品', '1-4. regulatoryCategoryが正しく取得される');
  assert(Object.keys(ctx).length === 4, '1-5. 対象外field（payout等）は含まれない＝4fieldのみ');
}

caseHeader('2. none: 未登録fieldはoutputに含めない');
{
  const ngWords = mkFact({ factId: 'f1', field: 'listingNgWords', value: ['商品名'] });
  const ctx = _apfrBuildComplianceContext(mkProduct([ngWords])); // 他3fieldは未登録＝none
  assert(Object.keys(ctx).length === 1, '2-1. resolvedの1fieldのみ含まれる');
  assert(!('advertisingDisclosureRequirements' in ctx), '2-2. none fieldはキー自体が存在しない');
  assert(!('complianceRestrictions' in ctx), '2-3. none fieldはキー自体が存在しない');
  assert(!('regulatoryCategory' in ctx), '2-4. none fieldはキー自体が存在しない');
  const empty = _apfrBuildComplianceContext(mkProduct([]));
  assert(Object.keys(empty).length === 0, '2-5. Fact 0件 → 空オブジェクト {}');
}

caseHeader('3. ambiguous: ambiguous field値は含めない（candidate代表選択0）');
{
  // 同一field・同一recordedAt・chain関係なし → recordedAt_collision → ambiguous
  const a = mkFact({ factId: 'a', field: 'listingNgWords', value: ['A'], recordedAt: '2026-08-22T10:00:00.000Z' });
  const b = mkFact({ factId: 'b', field: 'listingNgWords', value: ['B'], recordedAt: '2026-08-22T10:00:00.000Z' });
  const ctx = _apfrBuildComplianceContext(mkProduct([a, b]));
  assert(Object.keys(ctx).length === 0, '3-1. ambiguous field はcontextに含まれない');
  assert(!('listingNgWords' in ctx), '3-2. candidateのどちらか（A/B）も代表として採用しない');
  // Resolver自体はambiguousを検出していることを確認（前提の健全性チェック）
  const r = _apfrResolveCurrentFact(mkProduct([a, b]), 'listingNgWords');
  assert(r.status === 'ambiguous' && r.reason === 'recordedAt_collision', '3-3. 前提: Resolver自体がambiguousと判定している');
}

caseHeader('4. Correction: A → B supersedes A の場合Bだけ取得');
{
  const a = mkFact({ factId: 'a', field: 'advertisingDisclosureRequirements', value: ['旧表記'], recordedAt: '2026-08-22T10:00:00.000Z' });
  const b = mkFact({ factId: 'b', field: 'advertisingDisclosureRequirements', value: ['新表記'], recordedAt: '2026-08-22T11:00:00.000Z', supersedesFactId: 'a' });
  const ctx = _apfrBuildComplianceContext(mkProduct([a, b]));
  assert(ctx.advertisingDisclosureRequirements[0] === '新表記', '4-1. 訂正後（B）の値のみ取得される');
  assert(ctx.advertisingDisclosureRequirements.length === 1, '4-2. 旧値（A）は混入しない');
}

caseHeader('5. Cross-case: 他case Fact混入0');
{
  const own = mkFact({ factId: 'o1', field: 'listingNgWords', value: ['自case'] });
  const other = mkFact({ factId: 'x1', caseId: CASE_B, field: 'listingNgWords', value: ['他case'] });
  const ctx = _apfrBuildComplianceContext(mkProduct([own, other]));
  assert(ctx.listingNgWords.length === 1 && ctx.listingNgWords[0] === '自case', '5-1. 他caseのFactは混入しない');
}

caseHeader('6. Cross-product: 他product Fact混入0');
{
  const own = mkFact({ factId: 'o1', field: 'listingNgWords', value: ['自product'] });
  const other = mkFact({ factId: 'x1', productIdentifier: PID_OTHER, field: 'listingNgWords', value: ['他product'] });
  const ctx = _apfrBuildComplianceContext(mkProduct([own, other]));
  assert(ctx.listingNgWords.length === 1 && ctx.listingNgWords[0] === '自product', '6-1. 他productのFactは混入しない');
}

caseHeader('7. mutation: 実行前後でproduct/factsがdeep equal');
{
  const facts = [
    mkFact({ factId: 'a', field: 'listingNgWords', value: ['A'] }),
    mkFact({ factId: 'b', field: 'regulatoryCategory', value: '金融' }),
  ];
  const product = mkProduct(facts);
  const before = JSON.stringify(product);
  _apfrBuildComplianceContext(product);
  const after = JSON.stringify(product);
  assert(before === after, '7-1. _apfrBuildComplianceContext()実行後もproductが完全不変（deep equal）');
  assert(product.facts.length === 2, '7-2. facts配列の件数も不変');
}

caseHeader('8. direct scan: 実ソース（index.html）で product.facts を直接走査していないこと');
{
  const indexHtmlPath = path.join(__dirname, 'index.html');
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const marker = 'function _apfrBuildComplianceContext(product) {';
  const startIdx = src.indexOf(marker);
  assert(startIdx !== -1, '8-1. index.htmlに _apfrBuildComplianceContext() が実在する');
  if (startIdx !== -1) {
    // 関数本体を次の "\n}\n" までの範囲として素朴に切り出す（同ファイル内の既存関数群と同じ書式に依拠）
    const bodyStart = src.indexOf('{', startIdx + marker.length - 1);
    const endIdx = src.indexOf('\n}\n', bodyStart);
    const body = src.slice(startIdx, endIdx !== -1 ? endIdx : bodyStart + 500);
    assert(body.indexOf('_apfrResolveCurrentFacts(') !== -1, '8-2. _apfrResolveCurrentFacts() を呼び出している');
    assert(body.indexOf('.facts') === -1, '8-3. product.facts / .facts を直接参照していない（Resolver経由のみ）');
    assert(body.indexOf('APFR_COMPLIANCE_CONTEXT_FIELDS') !== -1, '8-4. 対象fieldリスト定数を使用している');
  }
}

caseHeader('9. listingPolicy: Compliance Contextへ含まれないこと');
{
  const policy = mkFact({ factId: 'p1', field: 'listingPolicy', value: '一部ok' });
  const ngWords = mkFact({ factId: 'n1', field: 'listingNgWords', value: ['A'] });
  const ctx = _apfrBuildComplianceContext(mkProduct([policy, ngWords]));
  assert(!('listingPolicy' in ctx), '9-1. listingPolicyはいかなる場合もキーとして出現しない');
  assert(Object.keys(ctx).length === 1, '9-2. listingNgWordsのみ含まれる（対象4fieldの原則どおり）');

  const indexHtmlPath = path.join(__dirname, 'index.html');
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const constMarker = "const APFR_COMPLIANCE_CONTEXT_FIELDS = [";
  const cIdx = src.indexOf(constMarker);
  assert(cIdx !== -1, '9-3. index.htmlに APFR_COMPLIANCE_CONTEXT_FIELDS 定数が実在する');
  if (cIdx !== -1) {
    const lineEnd = src.indexOf(';', cIdx);
    const line = src.slice(cIdx, lineEnd);
    assert(line.indexOf('listingPolicy') === -1, '9-4. 定数定義自体にlistingPolicyが含まれていない');
  }
}

// ──────────────────────────────────────────────────────────────
caseHeader('10. 配線（wiring）: atRunWorkflow / server.js / openaiClient.js への接続をstaticに確認');
{
  const indexHtmlPath = path.join(__dirname, 'index.html');
  const indexSrc = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(indexSrc.indexOf('_complianceContext = _apfrBuildComplianceContext(') !== -1, '10-1. atRunWorkflow()内でhelperが呼ばれている');
  assert(indexSrc.indexOf('complianceContext: _complianceContext') !== -1, '10-2. /api/auto-task のPOST bodyへcomplianceContextが追加されている');
  // IADPの既存経路（_iadpRequested依存）とは独立していること＝IADP判定ブロックの外側で算出されていること
  const iadpBlockIdx = indexSrc.indexOf('_iadpExistingIntelligenceContext = null;\n  }\n\n  // APFR Step C-1A');
  assert(iadpBlockIdx !== -1, '10-3. Compliance Context算出がIADP判定ブロック（catch節）の直後＝独立して配置されている');

  const serverPath = path.join(__dirname, 'server.js');
  const serverSrc = fs.readFileSync(serverPath, 'utf8');
  assert(serverSrc.indexOf('complianceContext = null } = req.body') !== -1, '10-4. server.jsのreq.body destructuringにcomplianceContextが追加されている');
  assert(serverSrc.indexOf('complianceContext, // APFR Step C-1A') !== -1, '10-5. runAutoTaskWorkflow()呼び出しへcomplianceContextがパススルーされている');
  assert(serverSrc.indexOf('_apfrResolveCurrentFact') === -1 && serverSrc.indexOf('.facts') === -1, '10-6. server.js側でResolver再実装／facts参照が行われていない（受動パススルーのみ）');

  const openaiPath = path.join(__dirname, 'openaiClient.js');
  const openaiSrc = fs.readFileSync(openaiPath, 'utf8');
  assert(openaiSrc.indexOf('complianceContext = null }) {') !== -1, '10-7. runAutoTaskWorkflow()のシグネチャにcomplianceContextが追加されている');
}

caseHeader('11. Prompt接続契約（C-1B以降）: complianceContextはhelper経由でのみ・Product facts直接走査0・Resolver再実装0');
// 【契約の変遷】C-1A完了時点では「buildSystemPrompt()へ一切注入しない」ことを保証する時限的な
//   アサーションだったが、C-1Bで意図的にWriter/Reviewerへの正式prompt注入を実装したため、
//   「注入しないこと」の検証はC-1B以降の実態と矛盾する。本節はC-1B以降も引き続き有効な、
//   より狭い契約（helper経由のみ・facts直接走査0・Resolver非再実装）へ更新する。
{
  const openaiPath = path.join(__dirname, 'openaiClient.js');
  const src = fs.readFileSync(openaiPath, 'utf8');
  const fnStart = src.indexOf('function buildSystemPrompt(');
  assert(fnStart !== -1, '11-1. buildSystemPrompt() が実在する');
  if (fnStart !== -1) {
    // 次のトップレベル関数定義（"\nfunction " or "\nasync function "）までを関数本体とみなす
    const searchFrom = fnStart + 30;
    const nextFn = (function () {
      const a = src.indexOf('\nfunction ', searchFrom);
      const b = src.indexOf('\nasync function ', searchFrom);
      if (a === -1) return b;
      if (b === -1) return a;
      return Math.min(a, b);
    })();
    const body = src.slice(fnStart, nextFn !== -1 ? nextFn : fnStart + 20000);
    assert(body.indexOf('complianceContext') !== -1, '11-2. buildSystemPrompt()本体がcomplianceContextを扱っている（C-1Bで正式接続。C-1A時点の「参照0件」契約から更新）');
    assert(body.indexOf('buildCompliancePromptBlock(') !== -1, '11-2b. complianceContextの利用はbuildCompliancePromptBlock()helper経由のみ（本体に直接ロジックを書いていない）');
    assert(body.indexOf('.facts') === -1, '11-2c. buildSystemPrompt()本体はproduct.facts等を直接走査していない');
    assert(body.indexOf('_apfrResolveCurrentFact') === -1, '11-2d. buildSystemPrompt()本体はResolverを再実装していない（Resolverはindex.html側の専任・C-1Bはread-only consumer）');
  }
  // buildCompliancePromptBlock() 自体もfacts直接走査・Resolver再実装をしていないことを確認（二重防御）。
  //   agent制限（writer/reviewer限定）の実際の挙動検証はapfrComplianceInjection.test.jsが担当する
  //   （本ファイルはC-1A Foundationのstatic構造検証に専念し、重複した実行時テストは持たない）。
  const helperStart = src.indexOf('function buildCompliancePromptBlock(');
  assert(helperStart !== -1, '11-2e. buildCompliancePromptBlock() が実在する');
  if (helperStart !== -1) {
    const helperEnd = src.indexOf('\n}\n', helperStart);
    const helperBody = src.slice(helperStart, helperEnd !== -1 ? helperEnd : helperStart + 3000);
    assert(helperBody.indexOf("agent !== 'writer' && agent !== 'reviewer'") !== -1, '11-2f. writer/reviewer以外を除外するagent guardが存在する');
    assert(helperBody.indexOf('_apfrResolveCurrentFacts(') === -1 && helperBody.indexOf('_apfrResolveCurrentFact(') === -1, '11-2g. helper内でResolverを再実装していない（受け取った値を整形するのみ）');
    assert(helperBody.indexOf('.facts') === -1, '11-2h. helper内でfacts配列を直接参照していない');
  }
  // runAutoTaskWorkflow内でcomplianceContextを受け取り、C-1Bでbuild SystemPrompt呼び出しへ正式に渡していること
  const rfStart = src.indexOf('async function runAutoTaskWorkflow(');
  assert(rfStart !== -1, '11-3. runAutoTaskWorkflow() が実在する');
  if (rfStart !== -1) {
    const rfEnd = src.indexOf('\nasync function runLeaderFinalResponse', 0); // 定義順に依存しない安全側フォールバック
    const scanEnd = src.indexOf('\nmodule.exports', rfStart);
    const body = src.slice(rfStart, scanEnd !== -1 ? scanEnd : rfStart + 40000);
    const callSites = body.match(/buildSystemPrompt\([^)]*\)/g) || [];
    assert(callSites.length > 0, '11-4. buildSystemPrompt()呼び出し箇所が検出できる');
    const injected = callSites.filter(function (c) { return c.indexOf('complianceContext') !== -1; });
    assert(injected.length > 0, '11-5. buildSystemPrompt()呼び出しへcomplianceContextが渡されている（C-1Bで正式接続。C-1A時点の「渡さない」契約から更新）');
    const stillHasAccountIntelligenceMode = injected.some(function (c) { return c.indexOf('accountIntelligenceMode') !== -1; });
    const stillHasIntelligenceContextAvailable = injected.some(function (c) { return c.indexOf('intelligenceContextAvailable') !== -1; });
    assert(stillHasAccountIntelligenceMode, '11-5b. 既存accountIntelligenceModeは引き続きoptionsに含まれている（無回帰）');
    assert(stillHasIntelligenceContextAvailable, '11-5c. 既存intelligenceContextAvailableは引き続きoptionsに含まれている（無回帰）');
  }
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All APFR Step C-1A compliance context foundation cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
