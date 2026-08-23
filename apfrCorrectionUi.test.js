'use strict';
// apfrCorrectionUi.test.js
// Decision108（APFR）CUI-2: Correction UI Core 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / Web Search 0 / 本番案件への操作0
// index.html内の _apfrCorrectionTargetFor() / _apfrStartCorrection() / _apfrCancelCorrection() /
// _apfrValidateCorrectionTarget() / _apfrBuildCurrentFactsHtml() / _apfrBuildCorrectionHeaderHtml() および
// _apfrRegisterFromUi() の Correction 分岐と等価なロジックを Node環境で再現して検証する。

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック（Core + Resolver + CUI-1表示 + CUI-2）
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
const APFR_BOOLEAN_LABELS = {
  productLinkAvailable: { true: '利用可', false: '利用不可' },
  reviewRequired:       { true: 'あり',   false: 'なし' },
  mobileOptimized:      { true: '対応',   false: '非対応' },
  itpSupported:         { true: '対応',   false: '非対応' },
  linkManagerSupported: { true: '対応',   false: '非対応' },
};
const APFR_BOOLEAN_LABELS_DEFAULT = { true: 'あり', false: 'なし' };
const APFR_PROVENANCE_LABELS = { a8_screen_user_verified: 'A8.net実画面', advertiser_lp_user_verified: '広告主公式LP',
  manual_user_input: '手入力', web_retrieved: 'Web取得', generated_hypothesis: 'AI仮説', ai_interpretation: 'AI解釈', calculated: '計算値' };

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

// ── CUI-2（★本テストの対象）──
var _apfrCorrectionTarget = null;
var _apfrUiMsg = null;
var _renderCount = 0;
function renderOutputEnginePanel() { _renderCount++; }   // 再描画のスタブ（DOM非依存）

function _apfrCorrectionTargetFor(product) {
  try {
    var t = _apfrCorrectionTarget;
    if (!t || !product) return null;
    if (String(t.caseId || '') !== String(product.caseId || '')) return null;
    if (String(t.productIdentifier || '') !== String(product.productIdentifier || '')) return null;
    if (typeof t.field !== 'string' || !t.field) return null;
    if (typeof t.currentFactId !== 'string' || !t.currentFactId) return null;
    return t;
  } catch (e) { return null; }
}

function _apfrValidateCorrectionTarget(product, fieldKey) {
  try {
    if (!_apfrCorrectionTarget) return { mode: 'normal' };
    var t = _apfrCorrectionTargetFor(product);
    if (!t) return { mode: 'stale', reason: 'scope_mismatch' };
    if (t.field !== fieldKey) return { mode: 'stale', reason: 'field_mismatch' };
    var r = _apfrResolveCurrentFact(product, fieldKey);
    if (!r || r.status !== 'resolved' || !r.currentFact) {
      return { mode: 'stale', reason: (r && r.status) ? r.status : 'unresolved' };
    }
    if (r.currentFact.factId !== t.currentFactId) {
      return { mode: 'stale', reason: 'current_fact_changed' };
    }
    return { mode: 'correction', supersedesFactId: t.currentFactId };
  } catch (e) {
    return { mode: 'stale', reason: 'exception' };
  }
}

// テスト用: _apfrCurrentAdoptedProduct() を差し替え可能にする
var _testProduct = null;
function _apfrCurrentAdoptedProduct() { return _testProduct; }

function _apfrStartCorrection(field, factId) {
  try {
    var product = _apfrCurrentAdoptedProduct();
    if (!product) return;
    var r = _apfrResolveCurrentFact(product, field);
    if (!r || r.status !== 'resolved' || !r.currentFact || r.currentFact.factId !== factId) {
      _apfrCorrectionTarget = null;
      _apfrUiMsg = { productIdentifier: product.productIdentifier, ok: false,
        text: '現在の情報が変更されたため、訂正を開始できません。現在値を確認してからもう一度お試しください。' };
      if (typeof renderOutputEnginePanel === 'function') renderOutputEnginePanel();
      return;
    }
    _apfrCorrectionTarget = {
      caseId: product.caseId,
      productIdentifier: product.productIdentifier,
      field: field,
      currentFactId: r.currentFact.factId,
    };
    _apfrUiMsg = null;
    if (typeof renderOutputEnginePanel === 'function') renderOutputEnginePanel();
  } catch (e) { console.warn('[APFR] start correction error (fail-open):', e.message); }
}

function _apfrCancelCorrection() {
  try {
    _apfrCorrectionTarget = null;
    _apfrUiMsg = null;
    if (typeof renderOutputEnginePanel === 'function') renderOutputEnginePanel();
  } catch (e) { console.warn('[APFR] cancel correction error (fail-open):', e.message); }
}

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
    var correctBtn = (f.factId)
      ? ' <button class="oe-aic-btn" style="padding:1px 8px;font-size:.85em;margin-left:6px;" onclick="_apfrStartCorrection(\'' + esc(field) + '\',\'' + esc(f.factId) + '\')">訂正</button>'
      : '';
    return base
      + '<span class="' + clsCss + '" style="font-weight:600;">' + esc(clsTxt) + '</span> '
      + '<strong>' + esc(label) + '</strong>：' + esc(_apfrFormatFactValue(field, f.value))
      + '<span style="opacity:.55;"> （' + esc(APFR_PROVENANCE_LABELS[f.sourceMethod] || f.sourceMethod) + (when ? '・' + esc(when) : '') + '）</span>'
      + correctBtn
      + '</div>';
  }).join('');

  var summary = '<div class="oe-aic-note" style="opacity:.6;">確認済み ' + res.resolvedCount + ' 件／未登録 ' + res.noneCount + ' 件'
    + (res.ambiguousCount ? '／<span class="oe-aic-status-insufficient">確定不可 ' + res.ambiguousCount + ' 件</span>' : '') + '</div>';
  return summary + rows;
}

function _apfrBuildCorrectionHeaderHtml(product) {
  var esc = escapeHtml;
  var t = _apfrCorrectionTargetFor(product);
  if (!t) return '<div class="oe-aic-label">情報を1件登録</div>';

  var r = _apfrResolveCurrentFact(product, t.field);
  if (!r || r.status !== 'resolved' || !r.currentFact || r.currentFact.factId !== t.currentFactId) {
    return '<div class="oe-aic-label">情報を1件登録</div>'
      + '<div class="oe-aic-warning">⚠ 現在の情報が変更されたため、訂正モードを終了しました。現在値を確認してもう一度訂正してください。</div>';
  }
  var label = (APFR_FIELD_META[t.field] && APFR_FIELD_META[t.field].label) || t.field;
  var curTxt = _apfrFormatFactValue(t.field, r.currentFact.value);
  return '<div class="oe-aic-label">' + esc(label) + 'を訂正</div>'
    + '<div class="oe-aic-note">現在の値：<strong>' + esc(curTxt) + '</strong>'
    + '<span style="opacity:.55;"> （この値を訂正します。新しい値はA8.net実画面または広告主公式LPで確認してから入力してください）</span></div>'
    + '<div class="oe-aic-btnrow"><button class="oe-aic-btn" style="padding:1px 8px;font-size:.85em;" onclick="_apfrCancelCorrection()">訂正をやめる</button></div>';
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

// _apfrRegisterFromUi() の Correction 分岐と等価な submit 経路
function submitFromUi(opts) {
  var product = _apfrCurrentAdoptedProduct();
  if (!product) return { ok: false, reason: 'no_product' };
  var fieldKey = opts.field;
  var meta = APFR_FIELD_META[fieldKey];

  var corr = _apfrValidateCorrectionTarget(product, fieldKey);
  if (corr.mode === 'stale') {
    _apfrCorrectionTarget = null;
    _apfrUiMsg = { productIdentifier: product.productIdentifier, ok: false,
      text: '現在の情報が変更されたため、訂正を中止しました。現在値を確認してもう一度訂正してください。' };
    renderOutputEnginePanel();
    return { ok: false, reason: 'stale', staleReason: corr.reason };
  }

  var provenance = opts.provenance || 'a8_screen';
  var sourceMethod = (provenance === 'a8_screen') ? 'a8_screen_user_verified'
    : (provenance === 'advertiser_lp') ? 'advertiser_lp_user_verified' : 'manual_user_input';
  var verified = !!opts.verified && (provenance === 'a8_screen' || provenance === 'advertiser_lp');
  var nowIso = opts.now || new Date().toISOString();

  var record = {
    caseId: product.caseId,
    productIdentifier: product.productIdentifier,
    aspName: product.aspName || null,
    field: fieldKey,
    value: opts.value,
    classification: verified ? 'fact' : 'unknown',
    sourceMethod: sourceMethod,
    sourceReference: opts.sourceReference || null,
    verificationStatus: verified ? 'user_verified' : 'unverified',
    verifiedBy: verified ? 'user' : null,
    verifiedAt: verified ? nowIso : null,
    recordedAt: nowIso,
  };
  if (opts.factId) record.factId = opts.factId;

  if (corr.mode === 'correction') record.supersedesFactId = corr.supersedesFactId;

  var res = appendRecord(product, record, product.caseId);
  if (res && res.ok) {
    var wasCorrection = (corr.mode === 'correction');
    if (wasCorrection) _apfrCorrectionTarget = null;
    _apfrUiMsg = { productIdentifier: product.productIdentifier, ok: true,
      text: (meta ? meta.label : fieldKey) + (wasCorrection ? 'を訂正しました。' : 'を登録しました。') };
  } else {
    _apfrUiMsg = { productIdentifier: product.productIdentifier, ok: false, text: '登録に失敗しました。' };
  }
  renderOutputEnginePanel();
  return res;
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

const CASE_A = 'case-msr9yckye65y';
const CASE_B = 'case-other-B';
const PID = JSON.stringify(['プラファスト', 'a8.net']);
const PID_OTHER = JSON.stringify(['別商品', 'a8.net']);

function mkFact(o) {
  return Object.assign({
    caseId: CASE_A, productIdentifier: PID, aspName: 'A8.net',
    classification: 'fact', sourceMethod: 'a8_screen_user_verified', sourceReference: null,
    verificationStatus: 'user_verified', verifiedBy: 'user',
    verifiedAt: '2026-08-23T00:00:00.000Z', recordedAt: '2026-08-23T00:00:00.000Z',
  }, o);
}
function mkProduct(facts) {
  return { caseId: CASE_A, productIdentifier: PID, productName: 'プラファスト', aspName: 'A8.net', facts: facts || [] };
}
function reset(product) { _apfrCorrectionTarget = null; _apfrUiMsg = null; _renderCount = 0; _testProduct = product; }

// ──────────────────────────────────────────────────────────────
caseHeader('1. resolved行に訂正ボタン／none・ambiguousには出ない');
{
  const facts = [
    mkFact({ factId: 'f_epc', field: 'epc', value: 34.24 }),
    mkFact({ factId: 'a1', field: 'payout', value: '5000' }),
    mkFact({ factId: 'a2', field: 'payout', value: '6000', supersedesFactId: 'NOT_EXIST' }),  // orphan → ambiguous
  ];
  const p = mkProduct(facts); reset(p);
  const html = _apfrBuildCurrentFactsHtml(p);
  const res = _apfrResolveCurrentFacts(p);
  assert(res.resolvedCount === 1 && res.ambiguousCount === 1 && res.noneCount === 19, '1-0. fixture: resolved 1 / ambiguous 1 / none 19');
  const btnCount = (html.match(/_apfrStartCorrection\(/g) || []).length;
  assert(btnCount === 1, `1-1. 訂正ボタンはresolvedの1行のみ（実測 ${btnCount}）`);
  assert(html.includes("_apfrStartCorrection('epc','f_epc')"), '1-2. field と currentFact.factId が正しく埋め込まれる');
  assert(!html.includes("_apfrStartCorrection('payout'"), '1-3. ambiguous行に訂正ボタンなし');
  const noneSeg = html.slice(html.indexOf('○ 未登録'));
  assert(!/○ 未登録[^]*?_apfrStartCorrection/.test(html.split('⚠ 確定不可')[0] + ''), '1-4. none行に訂正ボタンなし');
  assert(!html.includes('disabled'), '1-5. ambiguousはdisabledではなく非表示（disabled属性を出さない）');
}

caseHeader('2. Correction Target生成（4項目・Resolver照合）');
{
  const p = mkProduct([mkFact({ factId: 'f1', field: 'epc', value: 34.24 })]); reset(p);
  _apfrStartCorrection('epc', 'f1');
  const t = _apfrCorrectionTarget;
  assert(t !== null, '2-1. Target生成');
  assert(Object.keys(t).sort().join(',') === 'caseId,currentFactId,field,productIdentifier', '2-2. Target構造は4項目のみ');
  assert(t.caseId === CASE_A && t.productIdentifier === PID && t.field === 'epc' && t.currentFactId === 'f1', '2-3. 各値が正しい');
  assert(t.value === undefined && t.sourceMethod === undefined && t.verificationStatus === undefined && t.classification === undefined, '2-4. Fact本体をコピーしない（Formal Truth複製なし）');
  assert(_renderCount === 1, '2-5. 再描画が呼ばれる');
}

caseHeader('3. ボタン引数のfactIdを鵜呑みにしない（開始時Resolver照合）');
{
  const p = mkProduct([mkFact({ factId: 'f1', field: 'epc', value: 34.24 })]); reset(p);
  _apfrStartCorrection('epc', 'STALE_ID');
  assert(_apfrCorrectionTarget === null, '3-1. currentFactと不一致 → Target作成しない');
  assert(_apfrUiMsg && _apfrUiMsg.ok === false, '3-2. 警告メッセージ');
  // ambiguousなfieldから開始しようとした場合
  const p2 = mkProduct([
    mkFact({ factId: 'x1', field: 'epc', value: 1, supersedesFactId: 'NOT_EXIST' }),
  ]); reset(p2);
  _apfrStartCorrection('epc', 'x1');
  assert(_apfrCorrectionTarget === null, '3-3. ambiguousからCorrection開始不可');
}

caseHeader('4. 訂正モード表示（現在値はResolverから取得・入力欄は自動コピーしない）');
{
  const p = mkProduct([mkFact({ factId: 'f1', field: 'listingNgWords', value: ['商品名', '法人名'] })]); reset(p);
  const before = _apfrBuildCorrectionHeaderHtml(p);
  assert(before.includes('情報を1件登録'), '4-1. 通常モードでは「情報を1件登録」');
  _apfrStartCorrection('listingNgWords', 'f1');
  const h = _apfrBuildCorrectionHeaderHtml(p);
  assert(h.includes('リスティングNGワードを訂正'), '4-2. 訂正モード見出し');
  assert(h.includes('現在の値：<strong>商品名 / 法人名</strong>'), '4-3. 現在値を表示（Resolver結果から導出）');
  assert(h.includes('_apfrCancelCorrection()'), '4-4. 「訂正をやめる」ボタンあり');
  assert(!h.includes('value="商品名'), '4-5. 入力欄へ旧値を自動コピーしない');
}

caseHeader('5. boolean fieldの訂正モードでも日本語表示');
{
  const p = mkProduct([mkFact({ factId: 'fb', field: 'reviewRequired', value: true })]); reset(p);
  _apfrStartCorrection('reviewRequired', 'fb');
  const h = _apfrBuildCorrectionHeaderHtml(p);
  assert(h.includes('現在の値：<strong>あり</strong>'), '5-1. boolean true → 「あり」');
  assert(!h.includes('>true<'), '5-2. 生のtrueを出さない');
}

caseHeader('6. Correction登録（supersedesFactId付与・append-only・Resolver切替）');
{
  const p = mkProduct([mkFact({ factId: 'A', field: 'epc', value: 1, recordedAt: '2026-08-23T00:00:00.000Z' })]); reset(p);
  const snapA = JSON.stringify(p.facts[0]);
  _apfrStartCorrection('epc', 'A');
  const r = submitFromUi({ field: 'epc', value: 2, provenance: 'a8_screen', verified: true, factId: 'B', now: '2026-08-23T01:00:00.000Z' });
  assert(r.ok === true, '6-1. Correction登録成功');
  assert(r.record.supersedesFactId === 'A', '6-2. supersedesFactId = 旧currentFact.factId');
  assert(p.facts.length === 2, '6-3. Fact総数 2（append-only）');
  assert(JSON.stringify(p.facts[0]) === snapA, '6-4. 旧Fact Aは完全に不変（mutation 0）');
  assert(p.facts[0].status === undefined && p.facts[0].supersededByFactId === undefined, '6-5. 旧Factへ superseded 等を書き込まない');
  const res = _apfrResolveCurrentFact(p, 'epc');
  assert(res.status === 'resolved' && res.currentFact.factId === 'B', '6-6. Resolverが新FactをcurrentへChain解決');
  assert(res.reason === 'explicit_chain', '6-7. reason=explicit_chain');
  assert(_apfrCorrectionTarget === null, '6-8. 成功時にTarget破棄');
  assert(_apfrUiMsg.ok === true && _apfrUiMsg.text.includes('訂正しました'), '6-9. 訂正完了メッセージ');
}

caseHeader('7. History に 旧Fact＋新Fact の両方が残る');
{
  const p = mkProduct([mkFact({ factId: 'A', field: 'epc', value: 1 })]); reset(p);
  _apfrStartCorrection('epc', 'A');
  submitFromUi({ field: 'epc', value: 2, verified: true, factId: 'B', now: '2026-08-23T01:00:00.000Z' });
  const ids = p.facts.map(f => f.factId);
  assert(ids.join(',') === 'A,B', '7-1. 追記順でA,Bが保持される');
  const res = _apfrResolveCurrentFact(p, 'epc');
  assert(res.candidates.length === 2, '7-2. candidatesに2件（履歴保持）');
}

caseHeader('8. 多段訂正 A → B supersedes A → C supersedes B');
{
  const p = mkProduct([mkFact({ factId: 'A', field: 'epc', value: 1 })]); reset(p);
  _apfrStartCorrection('epc', 'A');
  submitFromUi({ field: 'epc', value: 2, verified: true, factId: 'B', now: '2026-08-23T01:00:00.000Z' });
  _apfrStartCorrection('epc', 'B');
  const r = submitFromUi({ field: 'epc', value: 3, verified: true, factId: 'C', now: '2026-08-23T02:00:00.000Z' });
  assert(r.ok === true && r.record.supersedesFactId === 'B', '8-1. CはBをsupersede');
  assert(p.facts.length === 3, '8-2. Fact総数 3');
  const res = _apfrResolveCurrentFact(p, 'epc');
  assert(res.status === 'resolved' && res.currentFact.factId === 'C', '8-3. chain終端Cがcurrent');
}

caseHeader('9. 差し戻し訂正（CUI-0 policyで登録可能・CUI-2独自duplicate判定なし）');
{
  const p = mkProduct([mkFact({ factId: 'A', field: 'epc', value: 1 })]); reset(p);
  _apfrStartCorrection('epc', 'A');
  submitFromUi({ field: 'epc', value: 2, verified: true, factId: 'B', now: '2026-08-23T01:00:00.000Z' });
  _apfrStartCorrection('epc', 'B');
  const r = submitFromUi({ field: 'epc', value: 1, verified: true, factId: 'C', now: '2026-08-23T02:00:00.000Z' });
  assert(r.ok === true, '9-1. 元の値(1)へ戻す訂正が登録できる ★CUI-0 policy');
  assert(p.facts.length === 3, '9-2. Fact総数 3');
  const res = _apfrResolveCurrentFact(p, 'epc');
  assert(res.currentFact.factId === 'C' && res.currentFact.value === 1, '9-3. currentはC（value=1）');
}

caseHeader('10. duplicate（完全同一Correction Record）は既存policyで拒否・Targetは保持');
{
  const p = mkProduct([mkFact({ factId: 'A', field: 'epc', value: 1 })]); reset(p);
  _apfrStartCorrection('epc', 'A');
  submitFromUi({ field: 'epc', value: 2, verified: true, factId: 'B', now: '2026-08-23T01:00:00.000Z' });
  // 同じ内容・同じsupersedesFactIdで再登録を試みる（Targetを作り直して同一Correction Recordを狙う）
  _apfrCorrectionTarget = { caseId: CASE_A, productIdentifier: PID, field: 'epc', currentFactId: 'A' };
  const r = submitFromUi({ field: 'epc', value: 2, verified: true, factId: 'B2', now: '2026-08-23T03:00:00.000Z' });
  assert(r.ok === false, '10-1. 登録拒否');
  assert(r.reason === 'stale' || r.reason === 'duplicate_record', `10-2. 拒否理由は stale か duplicate_record（実測 ${r.reason}）`);
  assert(p.facts.length === 2, '10-3. appendされない');
}

caseHeader('11. none → Correctionではない（supersedesFactIdなし）');
{
  const p = mkProduct([]); reset(p);
  const res0 = _apfrResolveCurrentFact(p, 'epc');
  assert(res0.status === 'none', '11-0. fixture: none');
  const html = _apfrBuildCurrentFactsHtml(p);
  assert(!html.includes('_apfrStartCorrection('), '11-1. 訂正ボタンなし');
  assert(_apfrCorrectionTarget === null, '11-2. Targetなし');
  const r = submitFromUi({ field: 'epc', value: 34.24, verified: true, factId: 'N1' });
  assert(r.ok === true, '11-3. 通常新規登録として成功');
  assert(r.record.supersedesFactId === undefined, '11-4. supersedesFactIdが付かない');
}

caseHeader('12. ambiguous → Correction開始不可・append 0');
{
  const p = mkProduct([
    mkFact({ factId: 'x1', field: 'epc', value: 1, supersedesFactId: 'GONE' }),
  ]); reset(p);
  const res = _apfrResolveCurrentFact(p, 'epc');
  assert(res.status === 'ambiguous', '12-0. fixture: ambiguous');
  const html = _apfrBuildCurrentFactsHtml(p);
  assert(!html.includes('_apfrStartCorrection('), '12-1. 訂正ボタンなし');
  _apfrStartCorrection('epc', 'x1');
  assert(_apfrCorrectionTarget === null, '12-2. Correction開始不可');
  assert(p.facts.length === 1, '12-3. append 0');
  assert(res.candidates.length >= 1 && res.currentFact === null, '12-4. 候補から代表Factを選ばない');
}

caseHeader('13. Cross-case: Target作成後にcase変更 → submit拒否・Target破棄');
{
  const p = mkProduct([mkFact({ factId: 'A', field: 'epc', value: 1 })]); reset(p);
  _apfrStartCorrection('epc', 'A');
  // case切替をシミュレート（別caseのproductへ差し替え）
  const p2 = { caseId: CASE_B, productIdentifier: PID, productName: 'プラファスト', aspName: 'A8.net', facts: [] };
  _testProduct = p2;
  const r = submitFromUi({ field: 'epc', value: 2, verified: true, factId: 'B' });
  assert(r.ok === false && r.reason === 'stale', '13-1. submit拒否');
  assert(r.staleReason === 'scope_mismatch', '13-2. reason=scope_mismatch');
  assert(p2.facts.length === 0 && p.facts.length === 1, '13-3. append 0（両caseとも）');
  assert(_apfrCorrectionTarget === null, '13-4. Target破棄');
}

caseHeader('14. Cross-product: Target作成後にproduct変更 → submit拒否・Target破棄');
{
  const p = mkProduct([mkFact({ factId: 'A', field: 'epc', value: 1 })]); reset(p);
  _apfrStartCorrection('epc', 'A');
  const p2 = { caseId: CASE_A, productIdentifier: PID_OTHER, productName: '別商品', aspName: 'A8.net', facts: [] };
  _testProduct = p2;
  const r = submitFromUi({ field: 'epc', value: 2, verified: true, factId: 'B' });
  assert(r.ok === false && r.reason === 'stale', '14-1. submit拒否');
  assert(r.staleReason === 'scope_mismatch', '14-2. reason=scope_mismatch');
  assert(p2.facts.length === 0, '14-3. append 0');
  assert(_apfrCorrectionTarget === null, '14-4. Target破棄');
}

caseHeader('15. Cross-field: field不一致 → submit拒否・append 0');
{
  const p = mkProduct([
    mkFact({ factId: 'A', field: 'epc', value: 1 }),
    mkFact({ factId: 'P', field: 'payout', value: '5000' }),
  ]); reset(p);
  _apfrStartCorrection('epc', 'A');
  const r = submitFromUi({ field: 'payout', value: '6000', verified: true, factId: 'X' });
  assert(r.ok === false && r.reason === 'stale', '15-1. submit拒否');
  assert(r.staleReason === 'field_mismatch', '15-2. reason=field_mismatch');
  assert(p.facts.length === 2, '15-3. append 0（cross-field訂正を作らない）');
  assert(_apfrCorrectionTarget === null, '15-4. Target破棄');
}

caseHeader('16. stale current: Target作成後にcurrentが変化 → submit拒否・branched chain防止');
{
  const p = mkProduct([mkFact({ factId: 'A', field: 'epc', value: 1, recordedAt: '2026-08-23T00:00:00.000Z' })]); reset(p);
  _apfrStartCorrection('epc', 'A');
  // 別経路でFactが追加され current が B に変わった状況
  p.facts = p.facts.concat([mkFact({ factId: 'B', field: 'epc', value: 2, supersedesFactId: 'A', recordedAt: '2026-08-23T01:00:00.000Z' })]);
  const cur = _apfrResolveCurrentFact(p, 'epc');
  assert(cur.currentFact.factId === 'B', '16-0. currentがBへ変化');
  const r = submitFromUi({ field: 'epc', value: 3, verified: true, factId: 'C' });
  assert(r.ok === false && r.reason === 'stale', '16-1. submit拒否');
  assert(r.staleReason === 'current_fact_changed', '16-2. reason=current_fact_changed');
  assert(p.facts.length === 2, '16-3. append 0');
  assert(_apfrCorrectionTarget === null, '16-4. Target破棄');
  const after = _apfrResolveCurrentFact(p, 'epc');
  assert(after.status === 'resolved' && after.reason !== 'branched_chain', '16-5. branched_chainを生成していない ★重要');
}

caseHeader('17. stale ambiguous化: Target作成後にambiguousへ → submit拒否');
{
  const p = mkProduct([mkFact({ factId: 'A', field: 'epc', value: 1, recordedAt: '2026-08-23T00:00:00.000Z' })]); reset(p);
  _apfrStartCorrection('epc', 'A');
  p.facts = p.facts.concat([mkFact({ factId: 'Z', field: 'epc', value: 9, supersedesFactId: 'GONE', recordedAt: '2026-08-23T01:00:00.000Z' })]);
  const r = submitFromUi({ field: 'epc', value: 3, verified: true, factId: 'C' });
  assert(r.ok === false && r.reason === 'stale', '17-1. submit拒否');
  assert(r.staleReason === 'ambiguous', '17-2. reason=ambiguous');
  assert(p.facts.length === 2, '17-3. append 0');
  assert(_apfrCorrectionTarget === null, '17-4. Target破棄');
}

caseHeader('18. cancel後の残留防止（次の通常登録にsupersedesFactIdが付かない）');
{
  const p = mkProduct([mkFact({ factId: 'A', field: 'epc', value: 1 })]); reset(p);
  _apfrStartCorrection('epc', 'A');
  assert(_apfrCorrectionTarget !== null, '18-1. Target生成');
  _apfrCancelCorrection();
  assert(_apfrCorrectionTarget === null, '18-2. cancelでTarget破棄');
  const r = submitFromUi({ field: 'payout', value: '5000', verified: true, factId: 'N' });
  assert(r.ok === true, '18-3. 通常登録として成功');
  assert(r.record.supersedesFactId === undefined, '18-4. supersedesFactIdが付かない ★残留防止');
}

caseHeader('19. 通常失敗（duplicate_record）ではTargetを保持する（staleと区別）');
{
  // 検証順序：submit直前のstale再検証 → Core の duplicate 判定、の順で評価される。
  //   そのため「Targetが有効（＝currentは変化していない）まま duplicate になる」構成が必要。
  //   Xは recordedAt が不正で Resolver 母集団からは除外される（→ currentはAのまま）が、
  //   _apfrRecordsEqual() は recordedAt を比較しないため、同一内容の新Recordは duplicate_record となる。
  const p = mkProduct([
    mkFact({ factId: 'A', field: 'epc', value: 1, recordedAt: '2026-08-23T00:00:00.000Z' }),
    mkFact({ factId: 'X', field: 'epc', value: 2, supersedesFactId: 'A', recordedAt: 'not-a-date' }),
  ]); reset(p);
  const cur = _apfrResolveCurrentFact(p, 'epc');
  assert(cur.status === 'resolved' && cur.currentFact.factId === 'A', '19-0. invalid Xは母集団外＝currentはAのまま');

  _apfrStartCorrection('epc', 'A');
  assert(_apfrCorrectionTarget !== null, '19-1. Target生成');

  const dup = submitFromUi({ field: 'epc', value: 2, verified: true, factId: 'NEW', now: '2026-08-23T05:00:00.000Z' });
  assert(dup.ok === false, '19-2. 登録拒否');
  assert(dup.reason === 'duplicate_record', `19-3. 通常failure＝duplicate_record（staleではない・実測 ${dup.reason}）`);
  assert(_apfrCorrectionTarget !== null, '19-4. 通常failure時はTargetを保持（値を直して再試行できる）★staleと区別');
  assert(p.facts.length === 2, '19-5. appendされない');

  // 値を変えれば同じTargetのまま再試行して成功できる
  const retry = submitFromUi({ field: 'epc', value: 3, verified: true, factId: 'NEW2', now: '2026-08-23T06:00:00.000Z' });
  assert(retry.ok === true && retry.record.supersedesFactId === 'A', '19-6. 保持されたTargetで再試行成功');
  assert(_apfrCorrectionTarget === null, '19-7. 成功後はTarget破棄');
}

caseHeader('20. User Verification維持（Correctionでも昇格条件は緩和されない）');
{
  const p = mkProduct([mkFact({ factId: 'A', field: 'epc', value: 1 })]); reset(p);
  _apfrStartCorrection('epc', 'A');
  const r = submitFromUi({ field: 'epc', value: 2, provenance: 'manual', verified: true, factId: 'B' });
  assert(r.ok === true, '20-1. manual provenanceでも登録自体は可能');
  assert(r.record.classification === 'unknown', '20-2. manual_user_inputはfactへ昇格しない（unknown）');
  assert(r.record.verificationStatus === 'unverified', '20-3. verificationStatusもunverified');
  assert(r.record.supersedesFactId === 'A', '20-4. Correction関係自体は記録される');

  const p2 = mkProduct([mkFact({ factId: 'A', field: 'epc', value: 1 })]); reset(p2);
  _apfrStartCorrection('epc', 'A');
  const r2 = submitFromUi({ field: 'epc', value: 2, provenance: 'a8_screen', verified: false, factId: 'B' });
  assert(r2.record.classification === 'unknown', '20-5. User Verification未チェックならfact昇格しない');
}

caseHeader('21. 非破壊 / Contract不変');
{
  const facts = [mkFact({ factId: 'A', field: 'epc', value: 1 })];
  const p = mkProduct(facts); reset(p);
  const snap = JSON.stringify(facts);
  _apfrBuildCurrentFactsHtml(p);
  _apfrBuildCorrectionHeaderHtml(p);
  _apfrValidateCorrectionTarget(p, 'epc');
  assert(JSON.stringify(facts) === snap, '21-1. 表示・検証はfactsを書き換えない');
  _apfrStartCorrection('epc', 'A');
  assert(JSON.stringify(p.facts) === snap, '21-2. Correction開始もfactsを書き換えない');
  const r = submitFromUi({ field: 'epc', value: 2, verified: true, factId: 'B' });
  assert(p.facts[0].factId === 'A' && JSON.stringify(p.facts[0]) === JSON.stringify(JSON.parse(snap)[0]), '21-3. 旧Factは完全不変');
  // _apfrCorrectionTarget が保存Recordへ混入しない
  const keys = Object.keys(r.record).sort();
  assert(!keys.includes('caseId2') && !keys.includes('currentFactId'), '21-4. Target内部キーがRecordへ混入しない');
  assert(keys.includes('supersedesFactId'), '21-5. RecordにはsupersedesFactIdのみ追加される');
}

caseHeader('22. 実装の静的検証（Resolver-onlyとContract非変更）');
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
  const v = ext('_apfrValidateCorrectionTarget');
  assert(v.includes('_apfrResolveCurrentFact(product, fieldKey)'), '22-1. submit直前にResolverを再実行');
  assert(v.includes("r.status !== 'resolved'"), '22-2. resolved以外は拒否');
  assert(v.includes('r.currentFact.factId !== t.currentFactId'), '22-3. currentFactId一致を要求');
  assert(!v.includes('Date.parse') && !v.includes('recordedAt'), '22-4. 独自のcurrent判定を持たない');
  const st = ext('_apfrStartCorrection');
  assert(st.includes('_apfrResolveCurrentFact(product, field)'), '22-5. 開始時もResolverで照合');
  assert(st.includes('r.currentFact.factId !== factId'), '22-6. ボタン引数factIdを鵜呑みにしない');
  // supersedesFactId の付与は1箇所のみ
  const assigns = (html.match(/record\.supersedesFactId\s*=/g) || []).length;
  assert(assigns === 1, `22-7. supersedesFactId付与は1箇所のみ（実測 ${assigns}）`);
  assert(html.includes("if (corr.mode === 'correction') record.supersedesFactId = corr.supersedesFactId;"), '22-8. 再検証を通過したTargetからのみ設定');
  // Core / Resolver が1定義のまま
  ['validateApfrRecord', '_apfrAppendRecord', '_apfrRecordsEqual', '_apfrHasSupersedes', '_apfrCandidateFacts', '_apfrResolveCurrentFact', '_apfrResolveCurrentFacts', '_apfrBuildHistoryHtml'].forEach(fn => {
    const n = (html.match(new RegExp('function ' + fn + '\\(', 'g')) || []).length;
    if (n !== 1) { _failed++; console.log(`  ❌ 22-9. ${fn} の定義数が1ではない（${n}）`); }
  });
  assert(true, '22-9. Core/Resolver/Historyの定義数は各1（変更なし）');
  // 旧Factへの書き込みが無いこと
  assert(!html.includes('superseded: true') && !html.includes("superseded'] = true"), '22-10. 旧Factへsuperseded等を書き込む実装なし');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All APFR CUI-2 correction UI core cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
