'use strict';
// lib/contentValueService.js
// Evidence-Based Content Value Quality — CV-4b: server-side Content Value 再計算の
// HTTP 非依存 service 層（既存 lib/carouselImageService.js と同じ設計方針）。
// CV-4c-1: reviewerNovelty の canonical source 解決を追加（Content Value Activation Wiring）。
//
//   責務:
//     - client 供給の contentValue を **一切信用せず**、server 側で再計算する
//     - contentType の canonical 解決（atomic first-write-wins ＋ canonical 再読込）
//     - contentType === 'product' のときだけ APFR facts を Core へ注入する
//     - reviewerNovelty の canonical source 解決（fields.contentReviewerSignal.novelty の
//       enum whitelist 検証のみ。トップレベル reviewerNovelty パラメータは参照しない）
//
//   非責務（このファイルが絶対にやらないこと）:
//     - Content Value 判定ロジック本体（shared/contentValueQuality.js の責務）
//     - Evidence 判定ロジック（shared/contentEvidence.js の責務）
//     - packageQuality / evaluateQualityGate / evaluateOutputQuality の参照・変更
//     - Mobile Approval / Publishing eligibility / Carousel / Image Review への接続
//     - APFR facts の書き換え（read-only 参照のみ）
//     - 投稿種別の推測（散文解析・productIdentifier からの分類は行わない）
//     - Reviewer への構造化出力生成の指示（AI prompt 変更は CV-4c-1 の scope 外）
//     - AI API / Web Evidence 取得 / 画像生成
//
//   ★ 投稿種別の唯一の SoT は canonical な output_drafts.content_type。
//     client payload の contentType は「初回宣言の候補」に過ぎず、
//     canonical が既に確定していれば無視される（downgrade 不可）。
//
//   ★ fail-open / fail-closed の使い分け:
//     - DB 側（列未追加・接続失敗）→ **fail-open**（Output Draft 本体の保存を巻き込まない）
//     - 判定側（contentType 未解決・Evidence 不足）→ **fail-closed**（status='insufficient'）

var contentValueQuality = require('../shared/contentValueQuality');

var DECLARABLE_CONTENT_TYPES = ['value', 'bridge', 'product'];

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

// client 供給 contentType を「宣言候補」として正規化する。列挙外・欠落は null（＝宣言しない）。
function normalizeDeclaredContentType(v) {
  return DECLARABLE_CONTENT_TYPES.indexOf(v) !== -1 ? v : null;
}

// contentType==='product' のときだけ APFR facts を取り出す（read-only・非破壊）。
//   ★ value / bridge では絶対に呼ばない（APFR 誤注入の防止）。
//   ★ classification のフィルタは Core 側（'fact' のみ採用）が行う。ここでは配列を渡すだけ。
function extractApfrFacts(fields) {
  var f = _isPlainObject(fields) ? fields : {};
  var ic = _isPlainObject(f.intelligenceContext) ? f.intelligenceContext : null;
  var product = ic && _isPlainObject(ic.product) ? ic.product : null;
  return (product && Array.isArray(product.facts)) ? product.facts : [];
}

// CV-4c-1: reviewerNovelty の canonical source 解決（read-only・非破壊）。
//   ★ Core（shared/contentValueQuality.js）の evaluateContentValue() は options.reviewerNovelty を
//     そのまま信用する契約のため、ここで「何を canonical source とみなすか」を一箇所に固定する。
//   ★ canonical source は必ず fields.contentReviewerSignal.novelty という構造化 field のみ。
//     トップレベルの reviewerNovelty パラメータ（input.reviewerNovelty 等）は一切参照しない
//     （client が生の文字列を直接送る経路を作らない＝contentValue score/gate/status と同じ
//     「client 値は信用しない」原則を維持する）。
//   ★ 現時点（CV-4c-1）では Reviewer の実 AI 出力にこの構造化 field を生成させる経路は未実装。
//     そのため実運用では通常 missing → 'unclear'（fail-closed）のまま評価される。
//     将来（CV-4c-2 以降）Reviewer 側の構造化出力が配線されたときに、この enum 検証だけで
//     安全に受理できるようにするための配線を今回用意する。
//   ★ 列挙外・欠落・型不正はすべて 'unclear'（Core 側の REVIEWER_NOVELTY_VALUES を再利用し、
//     新しい語彙・新しい判定基準は作らない）。
function resolveReviewerNoveltySignal(fields) {
  var f = _isPlainObject(fields) ? fields : {};
  var sig = _isPlainObject(f.contentReviewerSignal) ? f.contentReviewerSignal : null;
  var novelty = sig ? sig.novelty : null;
  return contentValueQuality.REVIEWER_NOVELTY_VALUES.indexOf(novelty) !== -1 ? novelty : 'unclear';
}

// ══════════════════════════════════════════════════════════════
// resolveContentValueForSave — 保存時の Content Value 再計算
//
//   input: { outputId, caseId, declaredContentType, fields }
//   deps : { setContentTypeIfUnset, getContentTypeCanonical, evaluateContentValue?, now? }
//
//   戻り値:
//     { contentType, contentTypeApplied, contentTypeSource, contentValue, reasons }
//       contentType       … 評価に使った実効値（'value'|'bridge'|'product'|'unknown'）
//       contentTypeApplied… 本呼び出しが canonical を確定させたか
//       contentTypeSource … 'canonical' | 'unresolved'
//       contentValue      … evaluateContentValue() の結果（再整形しない）
// ══════════════════════════════════════════════════════════════
async function resolveContentValueForSave(input, deps) {
  var inp = _isPlainObject(input) ? input : {};
  var d = _isPlainObject(deps) ? deps : {};
  var evaluate = typeof d.evaluateContentValue === 'function'
    ? d.evaluateContentValue : contentValueQuality.evaluateContentValue;
  var reasons = [];

  var declared = normalizeDeclaredContentType(inp.declaredContentType);
  var applied = false;

  // ── 1. 初回宣言のみ atomic に書き込む（既に確定していれば無視される） ──
  if (declared !== null && typeof d.setContentTypeIfUnset === 'function') {
    var w;
    try { w = await d.setContentTypeIfUnset({ outputId: inp.outputId, contentType: declared }); }
    catch (e) { w = { ok: false, applied: false, reason: 'exception:' + (e && e.message) }; }
    applied = !!(w && w.applied);
    if (w && w.ok !== true) reasons.push('content_type_write_skipped:' + ((w && w.reason) || 'unknown'));
  } else if (declared === null) {
    reasons.push('content_type_not_declared');
  }

  // ── 2. canonical を再読込（client 値ではなく DB の値を正本にする） ──
  var canonical = null;
  if (typeof d.getContentTypeCanonical === 'function') {
    var r;
    try { r = await d.getContentTypeCanonical({ outputId: inp.outputId }); }
    catch (e) { r = { contentType: null, source: 'error', error: e && e.message }; }
    canonical = (r && DECLARABLE_CONTENT_TYPES.indexOf(r.contentType) !== -1) ? r.contentType : null;
    if (r && r.error) reasons.push('content_type_read_failed:' + r.error);
  }

  // canonical が読めなければ 'unknown'（宣言値へは絶対に fallback しない＝fail-closed）
  var effective = canonical !== null ? canonical : 'unknown';
  if (canonical === null) reasons.push('content_type_unresolved');

  // ── 3. APFR は product のときだけ注入する ──
  var apfrFacts = (effective === 'product') ? extractApfrFacts(inp.fields) : [];

  // ── 3b. CV-4c-1: reviewerNovelty の canonical source を解決する（client 直接値は使わない） ──
  var reviewerNovelty = resolveReviewerNoveltySignal(inp.fields);

  // ── 4. Content Value を server 側で再計算（client 供給値は使わない） ──
  var contentValue = evaluate(
    { caseId: inp.caseId, outputId: inp.outputId, type: inp.type, fields: inp.fields },
    { contentType: effective, apfrFacts: apfrFacts, reviewerNovelty: reviewerNovelty, now: d.now }
  );

  return {
    contentType: effective,
    contentTypeApplied: applied,
    contentTypeSource: canonical !== null ? 'canonical' : 'unresolved',
    reviewerNovelty: reviewerNovelty,
    contentValue: contentValue,
    reasons: reasons,
  };
}

module.exports = {
  DECLARABLE_CONTENT_TYPES: DECLARABLE_CONTENT_TYPES,
  normalizeDeclaredContentType: normalizeDeclaredContentType,
  extractApfrFacts: extractApfrFacts,
  resolveReviewerNoveltySignal: resolveReviewerNoveltySignal,
  resolveContentValueForSave: resolveContentValueForSave,
};
