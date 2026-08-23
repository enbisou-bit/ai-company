'use strict';
// apfrCurrentFactUi.test.js
// Decision108（APFR）CUI-1: Current Fact / History UI 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / Web Search 0 / 本番案件への操作0
// index.html内の _apfrBooleanLabels() / _apfrFormatFactValue() /
// _apfrBuildCurrentFactsHtml() / _apfrBuildHistoryHtml() と等価なロジックを Node環境で再現して検証する。

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック（Core + Resolver + CUI-1表示層）
// ──────────────────────────────────────────────────────────────
const APFR_CLASSIFICATION_VALUES = ['fact', 'prediction', 'inference', 'unknown'];
const APFR_SOURCE_METHOD_VALUES = [
  'a8_screen_user_verified', 'advertiser_lp_user_verified', 'manual_user_input',
  'web_retrieved', 'generated_hypothesis', 'ai_interpretation', 'calculated',
];
const APFR_FACT_ALLOWED_SOURCE_METHODS = ['a8_screen_user_verified', 'advertiser_lp_user_verified'];
const APFR_VERIFICATION_STATUS_VALUES = ['unverified', 'user_verified'];
const INTEL_RELIABILITY_VALUES = ['high', 'medium', 'low', 'unknown'];

const APFR_FIELD_META = {
  aspName:                          { label: 'ASP名',                 type: 'string',  group: '識別' },
  programId:                        { label: 'Program ID',            type: 'string',  group: '識別' },
  productName:                      { label: '商品名',                type: 'string',  group: '識別' },
  productCategory:                  { label: '商品カテゴリ',          type: 'string',  group: '識別' },
  partnershipStatus:                { label: '提携状態',              type: 'string',  group: 'ASP状態' },
  landingUrl:                       { label: '商品リンクURL',         type: 'string',  group: 'ASP状態' },
  productLinkAvailable:             { label: '商品リンク利用可否',    type: 'boolean', group: 'ASP状態' },
  payout:                           { label: '報酬額',                type: 'string',  group: '成果' },
  epc:                              { label: 'EPC',                   type: 'number',  group: '成果' },
  approvalRate:                     { label: '確定率(%)',             type: 'number',  group: '成果' },
  cookieWindowDays:                 { label: '再訪問期間(日)',        type: 'number',  group: '成果' },
  approvalEstimateDays:             { label: '成果確定目安(日)',      type: 'number',  group: '成果' },
  reviewRequired:                   { label: '審査有無',              type: 'boolean', group: '技術' },
  mobileOptimized:                  { label: 'スマホ最適化',          type: 'boolean', group: '技術' },
  itpSupported:                     { label: 'ITP対応',               type: 'boolean', group: '技術' },
  linkManagerSupported:             { label: 'リンクマネージャー対応', type: 'boolean', group: '技術' },
  listingPolicy:                    { label: 'リスティング可否',      type: 'string',  group: '技術' },
  listingNgWords:                   { label: 'リスティングNGワード',  type: 'array',   group: 'Compliance' },
  regulatoryCategory:               { label: '規制カテゴリ',          type: 'string',  group: 'Compliance' },
  complianceRestrictions:           { label: 'コンプライアンス制約',  type: 'array',   group: 'Compliance' },
  advertisingDisclosureRequirements:{ label: '広告表示義務',          type: 'array',   group: 'Compliance' },
};
const APFR_FIELD_ORDER = ['aspName', 'programId', 'productName', 'productCategory',
  'partnershipStatus', 'landingUrl', 'productLinkAvailable',
  'payout', 'epc', 'approvalRate', 'cookieWindowDays', 'approvalEstimateDays',
  'reviewRequired', 'mobileOptimized', 'itpSupported', 'linkManagerSupported', 'listingPolicy',
  'listingNgWords', 'regulatoryCategory', 'complianceRestrictions', 'advertisingDisclosureRequirements'];
const APFR_CLASSIFICATION_LABELS = { fact: '✅ 確認済み', prediction: '🔮 予測', inference: '🧮 推論', unknown: '❔ 未確認' };
const APFR_CLASSIFICATION_CSS = { fact: 'iadp-status-complete', prediction: 'iadp-status-needs_work', inference: 'iadp-status-needs_work', unknown: 'iadp-status-insufficient' };

function escapeHtml(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

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

// ── CUI-1 表示層（★本テストの対象）──
const APFR_BOOLEAN_LABELS = {
  productLinkAvailable: { true: '利用可', false: '利用不可' },
  reviewRequired:       { true: 'あり',   false: 'なし' },
  mobileOptimized:      { true: '対応',   false: '非対応' },
  itpSupported:         { true: '対応',   false: '非対応' },
  linkManagerSupported: { true: '対応',   false: '非対応' },
};
const APFR_BOOLEAN_LABELS_DEFAULT = { true: 'あり', false: 'なし' };

function _apfrBooleanLabels(field) {
  return APFR_BOOLEAN_LABELS[field] || APFR_BOOLEAN_LABELS_DEFAULT;
}

function _apfrFormatFactValue(field, value) {
  if (Array.isArray(value)) return value.join(' / ');
  if (typeof value === 'boolean') {
    var L = _apfrBooleanLabels(field);
    return value ? L['true'] : L['false'];
  }
  return String(value);
}

const APFR_PROVENANCE_LABELS = { a8_screen_user_verified: 'A8.net実画面', advertiser_lp_user_verified: '広告主公式LP',
  manual_user_input: '手入力', web_retrieved: 'Web取得', generated_hypothesis: 'AI仮説', ai_interpretation: 'AI解釈', calculated: '計算値' };

function _apfrBuildCurrentFactsHtml(product) {
  var esc = escapeHtml;
  var res = _apfrResolveCurrentFacts(product);
  var ambiguousByField = {};
  (res.ambiguous || []).forEach(function (a) { ambiguousByField[a.field] = a; });
  var noneSet = {};
  (res.none || []).forEach(function (f) { noneSet[f] = true; });

  var rows = APFR_FIELD_ORDER.map(function (field) {
    var label = (APFR_FIELD_META[field] && APFR_FIELD_META[field].label) || field;
    var base = '<div class="oe-aic-note" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:4px;margin-top:4px;">';

    var amb = ambiguousByField[field];
    if (amb) {
      return base
        + '<span class="oe-aic-status-insufficient" style="font-weight:600;">⚠ 確定不可</span> '
        + '<strong>' + esc(label) + '</strong>：現在値を確定できません'
        + '<span style="opacity:.55;"> （理由: ' + esc(amb.reason || 'unknown') + '・候補' + ((amb.candidates || []).length) + '件は履歴で確認できます）</span>'
        + '</div>';
    }
    if (noneSet[field]) {
      return base
        + '<span style="opacity:.45;font-weight:600;">○ 未登録</span> '
        + '<strong style="opacity:.7;">' + esc(label) + '</strong>'
        + '</div>';
    }
    var f = res.resolved[field];
    if (!f) return '';
    var clsTxt = APFR_CLASSIFICATION_LABELS[f.classification] || f.classification;
    var clsCss = APFR_CLASSIFICATION_CSS[f.classification] || '';
    var when = f.verifiedAt ? String(f.verifiedAt).slice(0, 16).replace('T', ' ') : '';
    return base
      + '<span class="' + clsCss + '" style="font-weight:600;">' + esc(clsTxt) + '</span> '
      + '<strong>' + esc(label) + '</strong>：' + esc(_apfrFormatFactValue(field, f.value))
      + '<span style="opacity:.55;"> （' + esc(APFR_PROVENANCE_LABELS[f.sourceMethod] || f.sourceMethod) + (when ? '・' + esc(when) : '') + '）</span>'
      + '</div>';
  }).join('');

  var summary = '<div class="oe-aic-note" style="opacity:.6;">確認済み ' + res.resolvedCount + ' 件／未登録 ' + res.noneCount + ' 件'
    + (res.ambiguousCount ? '／<span class="oe-aic-status-insufficient">確定不可 ' + res.ambiguousCount + ' 件</span>' : '') + '</div>';
  return summary + rows;
}

function _apfrBuildHistoryHtml(product) {
  var esc = escapeHtml;
  var facts = _apfrFactsOf(product);
  if (facts.length === 0) return '<div class="oe-aic-note">まだ登録されていません。</div>';

  var res = _apfrResolveCurrentFacts(product);
  var currentIds = {};
  Object.keys(res.resolved || {}).forEach(function (k) {
    var cf = res.resolved[k];
    if (cf && cf.factId) currentIds[cf.factId] = true;
  });

  var rows = facts.map(function (f) {
    var label = (APFR_FIELD_META[f.field] && APFR_FIELD_META[f.field].label) || f.field;
    var clsTxt = APFR_CLASSIFICATION_LABELS[f.classification] || f.classification;
    var clsCss = APFR_CLASSIFICATION_CSS[f.classification] || '';
    var when = f.recordedAt ? String(f.recordedAt).slice(0, 16).replace('T', ' ') : '';
    var isCurrent = !!currentIds[f.factId];
    var mark = isCurrent
      ? '<span class="oe-aic-status-complete" style="font-weight:600;">現在値</span> '
      : '<span style="opacity:.45;">過去の記録（現在は使用されていません）</span> ';
    return '<div class="oe-aic-note" style="border-top:1px solid rgba(255,255,255,0.06);padding-top:4px;margin-top:4px;' + (isCurrent ? '' : 'opacity:.65;') + '">'
      + mark
      + '<span class="' + clsCss + '">' + esc(clsTxt) + '</span> '
      + '<strong>' + esc(label) + '</strong>：' + esc(_apfrFormatFactValue(f.field, f.value))
      + '<span style="opacity:.55;"> （' + esc(APFR_PROVENANCE_LABELS[f.sourceMethod] || f.sourceMethod) + (when ? '・' + esc(when) : '') + '）</span>'
      + '</div>';
  }).join('');

  return '<details class="oe-aic-note"><summary style="cursor:pointer;">▼ 履歴を見る（' + facts.length + '件）</summary>'
    + '<div class="oe-aic-note" style="opacity:.6;">訂正しても過去の記録は削除されません（追記のみ）。</div>'
    + rows + '</details>';
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
// 3. fixture（本番プラファスト構成 21 field / 22 records）
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
    verifiedAt: '2026-08-22T00:00:00.000Z', recordedAt: '2026-08-22T00:00:00.000Z',
  }, o);
}
function mkProduct(facts) {
  return { caseId: CASE_A, productIdentifier: PID, productName: 'プラファスト', aspName: 'A8.net', facts: facts || [] };
}

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

function build22Facts() {
  const out = [];
  let t = Date.parse('2026-08-21T21:00:00.000Z');
  FIELDS_21.forEach(function (pair, i) {
    if (pair[0] === 'listingNgWords') {
      out.push(mkFact({ factId: 'apf_06f0c5be', field: 'listingNgWords', value: ['法人名'], recordedAt: '2026-08-21T22:17:46.268Z', verifiedAt: '2026-08-21T22:17:46.268Z' }));
      out.push(mkFact({ factId: 'apf_72a473ae', field: 'listingNgWords', value: ['商品名', '法人名'], recordedAt: '2026-08-21T22:23:17.266Z', verifiedAt: '2026-08-21T22:23:17.266Z' }));
      return;
    }
    const sm = (pair[0] === 'regulatoryCategory') ? 'advertiser_lp_user_verified' : 'a8_screen_user_verified';
    const ts = new Date(t += 60000).toISOString();
    out.push(mkFact({ factId: 'apf_' + i, field: pair[0], value: pair[1], sourceMethod: sm, recordedAt: ts, verifiedAt: ts }));
  });
  return out;
}

// ──────────────────────────────────────────────────────────────
caseHeader('1. 21 resolved → Current 21件');
{
  const p = mkProduct(build22Facts());
  const html = _apfrBuildCurrentFactsHtml(p);
  const res = _apfrResolveCurrentFacts(p);
  assert(res.resolvedCount === 21, '1-1. resolvedCount=21');
  assert(html.indexOf('確認済み 21 件') !== -1, '1-2. サマリーに「確認済み 21 件」');
  assert(html.indexOf('未登録 0 件') !== -1, '1-3. サマリーに「未登録 0 件」');
  assert(html.indexOf('確定不可') === -1, '1-4. 確定不可の表示なし');
  const rowCount = (html.match(/border-top:1px solid/g) || []).length;
  assert(rowCount === 21, `1-5. 現在値の行数が21（実測 ${rowCount}）`);
}

caseHeader('2. listingNgWords旧新2件 → Currentは新1件のみ');
{
  const p = mkProduct(build22Facts());
  const html = _apfrBuildCurrentFactsHtml(p);
  assert(html.indexOf('商品名 / 法人名') !== -1, '2-1. 現在値に「商品名 / 法人名」が表示される');
  // 「法人名」単独行（旧Fact）が現在値一覧に混ざっていないこと
  const ngRows = html.split('リスティングNGワード').length - 1;
  assert(ngRows === 1, `2-2. リスティングNGワードの行は1行のみ（実測 ${ngRows}）`);
  assert(html.indexOf('</strong>：法人名<') === -1, '2-3. 旧Fact ["法人名"] 単独は現在値一覧に出ない');
}

caseHeader('3. Historyは旧新2件とも保持');
{
  const p = mkProduct(build22Facts());
  const h = _apfrBuildHistoryHtml(p);
  assert(h.indexOf('履歴を見る（22件）') !== -1, '3-1. 履歴件数22件と表示');
  assert(h.indexOf('：法人名<') !== -1, '3-2. 旧Fact ["法人名"] が履歴に残る');
  assert(h.indexOf('：商品名 / 法人名<') !== -1, '3-3. 新Fact ["商品名","法人名"] も履歴にある');
  assert(h.indexOf('現在値') !== -1, '3-4. 現在値マークがある');
  assert(h.indexOf('過去の記録（現在は使用されていません）') !== -1, '3-5. 旧Factに「過去の記録」表示');
  const rows = (h.match(/border-top:1px solid/g) || []).length;
  assert(rows === 22, `3-6. 履歴の行数が22（実測 ${rows}）`);
}

caseHeader('4. none field表示');
{
  const facts = build22Facts().filter(f => f.field !== 'epc' && f.field !== 'payout');
  const p = mkProduct(facts);
  const html = _apfrBuildCurrentFactsHtml(p);
  const res = _apfrResolveCurrentFacts(p);
  assert(res.noneCount === 2, '4-1. noneCount=2');
  assert(html.indexOf('未登録 2 件') !== -1, '4-2. サマリーに「未登録 2 件」');
  assert((html.match(/○ 未登録/g) || []).length === 2, '4-3. 「○ 未登録」が2行');
  assert(html.indexOf('EPC') !== -1 && html.indexOf('報酬額') !== -1, '4-4. 未登録fieldもラベル表示され充足状況が分かる');
}

caseHeader('5-6. ambiguous → current表示禁止 / reason表示');
{
  const facts = build22Facts();
  // epc に orphan supersedes を追加して ambiguous を作る
  facts.push(mkFact({ factId: 'apf_orphan', field: 'epc', value: 99.9, supersedesFactId: 'NOT_EXIST', recordedAt: '2026-08-22T09:00:00.000Z', verifiedAt: '2026-08-22T09:00:00.000Z' }));
  const p = mkProduct(facts);
  const html = _apfrBuildCurrentFactsHtml(p);
  const res = _apfrResolveCurrentFacts(p);
  assert(res.ambiguousCount === 1, '5-1. ambiguousCount=1');
  assert(html.indexOf('⚠ 確定不可') !== -1, '5-2. 「⚠ 確定不可」表示');
  assert(html.indexOf('現在値を確定できません') !== -1, '5-3. 現在値を確定できない旨の表示');
  assert(html.indexOf('34.24') === -1, '5-4. ambiguous時に候補値(34.24)を代表表示しない ★fail-closed');
  assert(html.indexOf('99.9') === -1, '5-5. もう一方の候補(99.9)も表示しない');
  assert(html.indexOf('理由: orphan_reference') !== -1, '6-1. reasonを表示');
  assert(html.indexOf('候補2件は履歴で確認できます') !== -1, '6-2. 候補件数を示し履歴へ誘導');
  assert(html.indexOf('確定不可 1 件') !== -1, '6-3. サマリーにも確定不可件数');
}

caseHeader('7-11. boolean日本語表示');
{
  assert(_apfrFormatFactValue('reviewRequired', true) === 'あり', '7. reviewRequired true → あり');
  assert(_apfrFormatFactValue('reviewRequired', false) === 'なし', '8. reviewRequired false → なし');
  assert(_apfrFormatFactValue('mobileOptimized', true) === '対応', '9. mobileOptimized true → 対応');
  assert(_apfrFormatFactValue('itpSupported', false) === '非対応', '10. itpSupported false → 非対応');
  assert(_apfrFormatFactValue('productLinkAvailable', true) === '利用可', '11-1. productLinkAvailable true → 利用可');
  assert(_apfrFormatFactValue('productLinkAvailable', false) === '利用不可', '11-2. productLinkAvailable false → 利用不可');
  assert(_apfrFormatFactValue('linkManagerSupported', true) === '対応', '11-3. linkManagerSupported true → 対応');
  assert(_apfrFormatFactValue('unknownBoolField', true) === 'あり', '11-4. 未定義fieldは既定「あり／なし」（表示が壊れない）');
  const p = mkProduct(build22Facts());
  const html = _apfrBuildCurrentFactsHtml(p);
  assert(html.indexOf('>true<') === -1 && html.indexOf('：true') === -1, '11-5. 現在値一覧に生の true が出ない');
  assert(html.indexOf('：false') === -1, '11-6. 現在値一覧に生の false が出ない');
  assert(html.indexOf('審査有無</strong>：あり') !== -1, '11-7. 審査有無が「あり」で表示される');
}

caseHeader('12-14. array / number / string 表示');
{
  assert(_apfrFormatFactValue('listingNgWords', ['商品名', '法人名']) === '商品名 / 法人名', '12. array は「 / 」区切り');
  assert(_apfrFormatFactValue('epc', 34.24) === '34.24', '13. number はそのまま');
  assert(_apfrFormatFactValue('listingPolicy', '一部ok') === '一部ok', '14. string はそのまま');
}

caseHeader('15-17. 保存値 / Fact object / facts配列 非変更');
{
  const facts = build22Facts();
  const p = mkProduct(facts);
  const snapshot = JSON.stringify(facts);
  const order = facts.map(f => f.factId).join(',');
  _apfrBuildCurrentFactsHtml(p);
  _apfrBuildHistoryHtml(p);
  assert(JSON.stringify(facts) === snapshot, '15. 保存値（value含む）が変わらない');
  assert(facts.every(f => f.status === undefined && f.supersededByFactId === undefined), '16. Fact objectへ status/superseded 等を書き込まない');
  assert(facts.map(f => f.factId).join(',') === order, '17. facts配列が並べ替えられない');
  assert(JSON.stringify(p.facts) === snapshot, '17-2. product.facts も不変');
}

caseHeader('18. APFR_FIELD_ORDER順で表示');
{
  const p = mkProduct(build22Facts());
  const html = _apfrBuildCurrentFactsHtml(p);
  const positions = APFR_FIELD_ORDER.map(f => html.indexOf('>' + APFR_FIELD_META[f].label + '</strong>'));
  assert(positions.every(x => x >= 0), '18-1. 全21fieldのラベルが出現');
  let ascending = true;
  for (let i = 1; i < positions.length; i++) if (positions[i] < positions[i - 1]) ascending = false;
  assert(ascending, '18-2. APFR_FIELD_ORDERの正式順で並ぶ');
}

caseHeader('19. History既定は閉じている');
{
  const p = mkProduct(build22Facts());
  const h = _apfrBuildHistoryHtml(p);
  assert(h.indexOf('<details') !== -1, '19-1. <details>で折りたたみ');
  assert(h.indexOf('<details open') === -1 && h.indexOf(' open>') === -1, '19-2. open属性なし＝既定で閉じている');
  assert(h.indexOf('<summary') !== -1, '19-3. <summary>あり');
}

caseHeader('20. Current と History のFact数整合');
{
  const p = mkProduct(build22Facts());
  const res = _apfrResolveCurrentFacts(p);
  const h = _apfrBuildHistoryHtml(p);
  const historyRows = (h.match(/border-top:1px solid/g) || []).length;
  const currentMarks = (h.match(/現在値<\/span>/g) || []).length;
  assert(historyRows === 22, '20-1. 履歴は全22件');
  assert(currentMarks === res.resolvedCount, `20-2. 履歴内の「現在値」マーク数(${currentMarks}) = resolvedCount(${res.resolvedCount})`);
  assert(historyRows - currentMarks === 1, '20-3. 過去の記録は1件（listingNgWords旧Fact）');
}

caseHeader('23-24. Resolver経由確認 / facts直接最新判定なし（実装の静的検証）');
{
  const fs = require('fs');
  const html = fs.readFileSync('index.html', 'utf-8');
  function ext(fn) {
    const s = html.indexOf('function ' + fn + '(');
    if (s < 0) return '';
    let i = html.indexOf('{', s), d = 0;
    for (let j = i; j < html.length; j++) { if (html[j] === '{') d++; else if (html[j] === '}') { d--; if (d === 0) return html.slice(s, j + 1); } }
    return '';
  }
  const cur = ext('_apfrBuildCurrentFactsHtml');
  assert(cur.indexOf('_apfrResolveCurrentFacts(product)') !== -1, '23-1. 現在値一覧はResolver経由');
  assert(cur.indexOf('_apfrFactsOf(') === -1, '24-1. 現在値一覧はfacts配列を直接走査しない');
  assert(cur.indexOf('recordedAt) ===') === -1 && cur.indexOf('Date.parse') === -1, '24-2. 現在値一覧にrecordedAt比較ロジックなし');
  assert(cur.indexOf('.slice(-1)') === -1 && cur.indexOf('facts[facts.length') === -1, '24-3. 配列末尾を現在値にする実装なし');
  const hist = ext('_apfrBuildHistoryHtml');
  assert(hist.indexOf('_apfrResolveCurrentFacts(product)') !== -1, '23-2. 履歴の「現在値」判定もResolver経由');
  assert(hist.indexOf('Date.parse') === -1, '24-4. 履歴側にも独自の最新判定なし');
  assert(html.indexOf('function _apfrBuildFactsListHtml(') === -1, '24-5. 旧フラット表示関数は完全に置換済み');
}

caseHeader('25. listingPolicy 保存値・表示値ともに変更なし');
{
  const p = mkProduct(build22Facts());
  const html = _apfrBuildCurrentFactsHtml(p);
  assert(html.indexOf('一部ok') !== -1, '25-1. 表示は保存値のまま「一部ok」');
  assert(html.indexOf('一部OK') === -1, '25-2. 勝手に「一部OK」へnormalizeしない');
  const f = p.facts.filter(x => x.field === 'listingPolicy')[0];
  assert(f.value === '一部ok', '25-3. 保存値も「一部ok」のまま');
}

caseHeader('26-27. Cross-case / Cross-product が現在値へ混入しない');
{
  const facts = build22Facts();
  facts.push(mkFact({ factId: 'apf_foreign_case', field: 'epc', value: 999, caseId: CASE_B, recordedAt: '2026-08-23T00:00:00.000Z', verifiedAt: '2026-08-23T00:00:00.000Z' }));
  facts.push(mkFact({ factId: 'apf_foreign_pid', field: 'payout', value: '99999', productIdentifier: PID_OTHER, recordedAt: '2026-08-23T00:00:00.000Z', verifiedAt: '2026-08-23T00:00:00.000Z' }));
  const p = mkProduct(facts);
  const html = _apfrBuildCurrentFactsHtml(p);
  assert(html.indexOf('999<') === -1 && html.indexOf('：999') === -1, '26-1. 別caseの値(999)が現在値に出ない');
  assert(html.indexOf('99999') === -1, '27-1. 別商品の値(99999)が現在値に出ない');
  assert(html.indexOf('34.24') !== -1, '26-2. 自caseのEPC(34.24)が正しく現在値');
  assert(html.indexOf('5000') !== -1, '27-2. 自商品のpayout(5000)が正しく現在値');
  const res = _apfrResolveCurrentFacts(p);
  assert(res.resolvedCount === 21 && res.ambiguousCount === 0, '26-3. Cross混入があってもresolved 21/ambiguous 0');
}

caseHeader('28. legacy fallback 表示');
{
  const p = mkProduct(build22Facts());
  const r = _apfrResolveCurrentFact(p, 'listingNgWords');
  assert(r.reason === 'latest_recordedAt', '28-1. legacy fallbackで解決');
  const html = _apfrBuildCurrentFactsHtml(p);
  assert(html.indexOf('商品名 / 法人名') !== -1, '28-2. fallback結果が現在値として表示される');
}

caseHeader('29. explicit chain 表示');
{
  const facts = build22Facts().filter(f => f.field !== 'epc');
  facts.push(mkFact({ factId: 'E1', field: 'epc', value: 10, recordedAt: '2026-08-22T05:00:00.000Z', verifiedAt: '2026-08-22T05:00:00.000Z' }));
  facts.push(mkFact({ factId: 'E2', field: 'epc', value: 20, supersedesFactId: 'E1', recordedAt: '2026-08-22T04:00:00.000Z', verifiedAt: '2026-08-22T04:00:00.000Z' }));
  const p = mkProduct(facts);
  const r = _apfrResolveCurrentFact(p, 'epc');
  assert(r.reason === 'explicit_chain' && r.currentFact.factId === 'E2', '29-1. recordedAt逆順でもchain終端E2がcurrent');
  const html = _apfrBuildCurrentFactsHtml(p);
  assert(html.indexOf('EPC</strong>：20') !== -1, '29-2. 現在値にchain終端の20が表示');
  assert(html.indexOf('EPC</strong>：10') === -1, '29-3. 旧値10は現在値に出ない');
  const h = _apfrBuildHistoryHtml(p);
  assert(h.indexOf('：10') !== -1, '29-4. 旧値10は履歴に残る');
}

caseHeader('30. legacy product（factsなし）でも安全');
{
  const legacy = { caseId: CASE_A, productIdentifier: PID, productName: 'プラファスト' };
  const html = _apfrBuildCurrentFactsHtml(legacy);
  assert(html.indexOf('確認済み 0 件') !== -1, '30-1. 0件サマリー');
  assert((html.match(/○ 未登録/g) || []).length === 21, '30-2. 全21fieldが未登録表示');
  const h = _apfrBuildHistoryHtml(legacy);
  assert(h.indexOf('まだ登録されていません') !== -1, '30-3. 履歴は「まだ登録されていません」');
}

caseHeader('31. HTMLエスケープ（表示専用の安全性）');
{
  const facts = [mkFact({ factId: 'X', field: 'productName', value: '<script>alert(1)</script>' })];
  const p = mkProduct(facts);
  const html = _apfrBuildCurrentFactsHtml(p);
  assert(html.indexOf('<script>') === -1, '31-1. value内のタグがエスケープされる');
  assert(html.indexOf('&lt;script&gt;') !== -1, '31-2. エスケープ済み文字列で出力');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All APFR CUI-1 current fact / history UI cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
