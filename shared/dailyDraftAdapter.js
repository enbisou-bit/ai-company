// shared/dailyDraftAdapter.js
// Instagram Daily Production — Step 2A: 構造化文案 → 既存 Output Draft 形式への変換（純関数）。
//
//   目的: dailyCopyValidator のルール検査を通った文案（slides[].headline / lines[] / caption / cta / hashtags）を、
//         既存の Output Draft の fields 形式へ決定論で変換する。
//           fields.slides[i] = '【N枚目】タイトル：<見出し> / 本文：<行1>\n<行2>…'
//         （既存 shared/carouselImageCore.js の parseFieldSlide() がそのまま headline / body を取り出せる形）
//
//   責務:
//     - 明示値（type = instagram_carousel / contentType = value / 5枚）での Draft 形の組み立て
//     - 本文の明示的な改行（行の区切り）の保持
//     - parseFieldSlide の区切り記号（タイトル／本文／ビジュアル）を本文に含む文案の拒否
//     - 投稿本文（caption / cta / hashtags）と根拠メモ（出典URL・確認記録）の分離
//
//   非責務: 文案の検査（dailyCopyValidator）・保存・AI 呼び出し・キーワードによる型判定・
//           日付・乱数・環境変数の参照・入力の変更。
//
//   ★ 根拠メモ（fields.dailyProduction.evidenceMemo）は制作時の記録であり、canonical Evidence
//     （output_drafts.content_evidence）への登録ではない。出典URLは投稿本文へ入れない。

(function (root, factory) {
  var contract = null, topicPack = null;
  if (typeof module !== 'undefined' && module.exports) {
    try { contract = require('./dailyProductionContract'); } catch (e) { contract = null; }
    try { topicPack = require('./dailyTopicPack'); } catch (e) { topicPack = null; }
  }
  if (!contract && root && root.DailyProductionContract) contract = root.DailyProductionContract;
  if (!topicPack && root && root.DailyTopicPack) topicPack = root.DailyTopicPack;
  var api = factory(contract, topicPack);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (root) {
    root.DailyDraftAdapter = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (contract, topicPack) {
  'use strict';

  var ADAPTER_VERSION = 1;
  // parseFieldSlide が区切りとして使う記号。本文に含まれると見出し・本文の分解が崩れる。
  var RESERVED_MARKER_RE = /(タイトル|本文|ビジュアル)[：:]/;

  function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
  function _issue(code, path, message) { return { code: code, path: path, message: message }; }

  // 1枚分を既存形式の文字列にする。行は改行で区切る（行の中の改行は持たせない）。
  function formatFieldSlide(index, headline, lineTexts) {
    return '【' + index + '枚目】タイトル：' + headline + ' / 本文：' + lineTexts.join('\n');
  }

  // 使われた主張だけの根拠メモ（出典の確認記録つき）。投稿本文とは別のキーに置く。
  function _buildEvidenceMemo(usedIds, pack) {
    var sourcesById = {};
    (pack.sources || []).forEach(function (s) { sourcesById[s.sourceId] = s; });
    var memo = [];
    (pack.claims || []).forEach(function (c) {
      if (usedIds.indexOf(c.claimId) === -1) return;
      memo.push({
        claimId: c.claimId,
        kind: c.kind,
        text: c.text,
        sources: (c.sourceIds || []).map(function (sid) {
          var s = sourcesById[sid] || {};
          return {
            sourceId: sid,
            url: s.url || null,
            publisher: s.publisher || null,
            title: s.title || null,
            locator: s.locator || null,
            checkedOn: s.checkedOn || null,
            scope: s.scope || null,
            limitations: s.limitations || null,
            // パック内の申告（実際の確認・認可の記録ではない）
            declaredVerificationStatus: _isPlainObject(s.verification) ? (s.verification.status || null) : null,
          };
        }),
      });
    });
    return memo;
  }

  // 検査済みの文案を Draft 形へ変換する。copy は dailyCopyValidator でルール検査に合格したもの。
  function buildDraftFields(copy, spec, pack) {
    var issues = [];
    var result = { ok: false, issues: issues, draft: null };
    if (!contract || !topicPack) { issues.push(_issue('module_unavailable', '', '依存モジュールがありません')); return result; }
    if (!_isPlainObject(spec) || spec.outputType !== contract.OUTPUT_TYPE || spec.contentType !== contract.CONTENT_TYPE || spec.slideCount !== contract.SLIDE_COUNT) {
      issues.push(_issue('spec_mismatch', 'spec', '制作仕様が明示値（instagram_carousel / value / 5枚）ではありません'));
      return result;
    }
    if (!_isPlainObject(copy) || !Array.isArray(copy.slides) || copy.slides.length !== spec.slideCount) {
      issues.push(_issue('copy_shape_invalid', 'copy', '文案の形が不正です'));
      return result;
    }

    var fieldSlides = [];
    var lineClaimMap = [];
    var used = [];
    for (var i = 0; i < copy.slides.length; i++) {
      var s = copy.slides[i];
      var sp = 'slides[' + i + ']';
      if (!_isPlainObject(s) || !_isNonEmptyString(s.headline) || !Array.isArray(s.lines) || s.lines.length === 0) {
        issues.push(_issue('slide_shape_invalid', sp, 'スライドの形が不正です'));
        continue;
      }
      var headline = s.headline.trim();
      if (/[\r\n]/.test(headline)) issues.push(_issue('headline_contains_newline', sp + '.headline', '見出しに改行が含まれています'));
      if (RESERVED_MARKER_RE.test(headline)) issues.push(_issue('reserved_marker_in_text', sp + '.headline', '見出しに区切り記号（タイトル／本文／ビジュアル＋コロン）が含まれています'));
      var texts = [];
      for (var j = 0; j < s.lines.length; j++) {
        var ln = s.lines[j];
        var lp = sp + '.lines[' + j + ']';
        if (!_isPlainObject(ln) || !_isNonEmptyString(ln.text)) { issues.push(_issue('line_shape_invalid', lp, '行の形が不正です')); continue; }
        var t = ln.text.trim();
        if (/[\r\n]/.test(t)) issues.push(_issue('line_contains_newline', lp, '1行の中に改行が含まれています（行は lines で分ける）'));
        if (RESERVED_MARKER_RE.test(t)) issues.push(_issue('reserved_marker_in_text', lp, '本文に区切り記号（タイトル／本文／ビジュアル＋コロン）が含まれています'));
        texts.push(t);
        var ids = Array.isArray(ln.claimIds) ? ln.claimIds.slice() : [];
        lineClaimMap.push({ slide: i + 1, line: j + 1, claimIds: ids });
        ids.forEach(function (id) { if (used.indexOf(id) === -1) used.push(id); });
      }
      fieldSlides.push(formatFieldSlide(i + 1, headline, texts));
    }
    if (!_isPlainObject(copy.caption) || !_isNonEmptyString(copy.caption.text)) issues.push(_issue('caption_missing', 'caption', 'caption がありません'));
    if (!_isNonEmptyString(copy.cta)) issues.push(_issue('cta_missing', 'cta', 'CTA がありません'));
    if (!Array.isArray(copy.hashtags) || copy.hashtags.length === 0) issues.push(_issue('hashtags_missing', 'hashtags', 'ハッシュタグがありません'));
    if (issues.length) return result;

    var captionIds = Array.isArray(copy.caption.claimIds) ? copy.caption.claimIds.slice() : [];
    captionIds.forEach(function (id) { if (used.indexOf(id) === -1) used.push(id); });
    var packCheck = topicPack.validateTopicPack(pack);

    result.ok = true;
    result.draft = {
      type: contract.OUTPUT_TYPE,             // 明示値（キーワード判定を使わない）
      contentType: contract.CONTENT_TYPE,     // 明示値
      title: copy.slides[0].headline.trim(),
      fields: {
        slides: fieldSlides,
        caption: copy.caption.text.trim(),    // 投稿本文
        cta: copy.cta.trim(),                 // 投稿本文
        hashtags: copy.hashtags.slice(),      // 投稿本文
        // 制作時の記録（投稿本文ではない）。canonical Evidence ではない。
        dailyProduction: {
          adapterVersion: ADAPTER_VERSION,
          contractVersion: spec.contractVersion,
          topicId: spec.topicId,
          outputType: spec.outputType,
          contentType: spec.contentType,
          slideCount: spec.slideCount,
          slideRoles: spec.slides.map(function (x) { return x.role; }),
          lineClaimMap: lineClaimMap,
          captionClaimIds: captionIds,
          evidenceMemo: _buildEvidenceMemo(used, pack),
          verificationBasis: packCheck.verificationBasis,
          canonicalEvidenceRegistered: false,
          limitsProvisional: !!(spec.limits && spec.limits.provisional),
        },
      },
    };
    return result;
  }

  return {
    ADAPTER_VERSION: ADAPTER_VERSION,
    formatFieldSlide: formatFieldSlide,
    buildDraftFields: buildDraftFields,
  };
});
