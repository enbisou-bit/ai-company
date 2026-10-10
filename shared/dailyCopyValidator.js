// shared/dailyCopyValidator.js
// Instagram Daily Production — Step 1: 文案のルール検査（純関数）。
//
//   目的: Writer が返した5枚カルーセルの文案を、制作仕様（dailyProductionContract）と
//         テーマパック（dailyTopicPack）に照らして、ルールで判定できる範囲だけ検査する。
//
//   責務:
//     - 構造・枚数・役割・必須項目・文字量の検査
//     - 主張IDの対応（存在・確認済み・スライドで使用可能・必須主張の網羅・同一行内の重複）
//     - 根拠パックの確認済み主張にない数値の検出
//     - 商品・ブランド・リンクの混入、弱い締め（「試しましょう」だけ）、要注意語の検出
//     - Reviewer／Human が意味を確認すべき項目の一覧化
//
//   ★ このファイルの合格（ruleCheck === 'pass'）は、医学的な正しさ・効果保証がないこと・
//     主張の範囲を超えていないことを保証しない。要注意語が0件でも保証表現がないとは断定しない。
//     主張IDの対応は「どの主張を根拠にしたと書かれているか」の照合であり、行の内容が主張と
//     一致していること（意味の正しさ）は保証しない。
//     結果は常に approval: 'not_approved'。未検証の内容を自動承認する経路は持たない。
//   ★ URL 検出の対象は投稿本文（見出し・行・caption・CTA）だけ。根拠パックの出典URL（根拠メモ）は
//     本文ではないため検査対象にしない（出典URLを本文へ載せることは別途禁止）。
//   ★ 文字量の上限は仮値（spec.limits.provisional）。
//
//   非責務: AI 呼び出し・Web 検索・DB／Storage・日付・乱数・環境変数の参照・入力の変更。

(function (root, factory) {
  var topicPack = null;
  if (typeof module !== 'undefined' && module.exports) {
    try { topicPack = require('./dailyTopicPack'); } catch (e) { topicPack = null; }
  }
  if (!topicPack && root && root.DailyTopicPack) topicPack = root.DailyTopicPack;
  var api = factory(topicPack);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else if (root) {
    root.DailyCopyValidator = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (topicPack) {
  'use strict';

  // ルールで検出する要注意語。検出は「問題あり」の目印であり、0件は「問題なし」を意味しない。
  var FLAGGED_PATTERNS = Object.freeze([
    { code: 'guarantee_wording', re: /保証|必ず|絶対|確実に|間違いなく/ },
    { code: 'cure_wording', re: /治る|治ります|治せ|完治|改善します|効きます/ },
    { code: 'testimonial_wording', re: /体験談|私も|口コミ|レビューで|愛用/ },
    { code: 'ranking_wording', re: /ランキング|第\s*[0-9０-９]+\s*位|No\.?\s*1|ナンバーワン|一番人気/i },
  ]);
  var LINK_RE = /https?:\/\/|www\.|\.com\b|\.jp\b|@[A-Za-z0-9_]/i;
  var AD_RE = /#PR\b|【広告】|\bPR\b|アフィリエイト|プロモーション/;
  var WEAK_CLOSING_RE = /^[\s　]*(今日から|ぜひ|まずは)?[\s　]*(試しましょう|試してみましょう|試してください|試してみてください|やってみましょう|やってみてください)[。！!]?[\s　]*$/;

  // ルール検査では判定しない（Reviewer／Human の確認が必要）項目。常に返す。
  var SEMANTIC_REVIEW_ITEMS = Object.freeze([
    Object.freeze({ item: 'medical_accuracy', label: '医学的に正しいか（出典の範囲内か）' }),
    Object.freeze({ item: 'claim_text_match', label: '各行の内容が、対応づけた主張の内容と一致しているか（IDの対応だけでは確認できない）' }),
    Object.freeze({ item: 'claim_scope', label: '主張を一般化しすぎていないか（研究の対象・規模の限界）' }),
    Object.freeze({ item: 'one_action_per_line', label: '1行が1つの動作になっているか' }),
    Object.freeze({ item: 'guarantee_nuance', label: '言い回しが効果や期間の保証になっていないか' }),
    Object.freeze({ item: 'scene_naturalness', label: '1枚目の生活場面が自然で、読者が自分のことと感じられるか' }),
    Object.freeze({ item: 'no_fabrication', label: '体験談・誇張・架空の事例が含まれていないか' }),
    Object.freeze({ item: 'distinct_roles', label: '各スライドが別の役割を持ち、水増しになっていないか' }),
  ]);

  function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
  function _len(s) { return Array.from(String(s)).length; }
  function _issue(code, path, message) { return { code: code, path: path, message: message }; }

  function _checkText(text, path, allowedNumbers, issues) {
    if (LINK_RE.test(text)) issues.push(_issue('link_or_handle_detected', path, 'URL・ドメイン・アカウント名が含まれています'));
    if (AD_RE.test(text)) issues.push(_issue('ad_marker_detected', path, '広告・PR・アフィリエイトの表記が含まれています'));
    for (var i = 0; i < FLAGGED_PATTERNS.length; i++) {
      if (FLAGGED_PATTERNS[i].re.test(text)) issues.push(_issue(FLAGGED_PATTERNS[i].code, path, '要注意の表現が含まれています'));
    }
    var nums = topicPack ? topicPack.extractNumbers(text) : [];
    for (var j = 0; j < nums.length; j++) {
      if (allowedNumbers.indexOf(nums[j]) === -1) issues.push(_issue('number_not_in_evidence', path, '根拠パックにない数値です: ' + nums[j]));
    }
  }

  // claimIds 配列を検査し、有効なIDだけを返す。
  function _checkClaimIds(ids, path, ctx, slideSpec, issues) {
    if (!Array.isArray(ids)) { issues.push(_issue('claim_ids_not_array', path, 'claimIds が配列ではありません')); return []; }
    var seen = {};
    var valid = [];
    for (var i = 0; i < ids.length; i++) {
      var id = ids[i];
      var p = path + '[' + i + ']';
      if (Object.prototype.hasOwnProperty.call(seen, id)) { issues.push(_issue('duplicate_claim_id', p, '同じ主張IDが重複しています: ' + id)); continue; }
      seen[id] = true;
      if (ctx.knownIds.indexOf(id) === -1) { issues.push(_issue('unknown_claim_id', p, '存在しない主張IDです: ' + id)); continue; }
      if (ctx.verifiedIds.indexOf(id) === -1) { issues.push(_issue('unverified_claim_id', p, '確認済みではない主張IDです: ' + id)); continue; }
      if (slideSpec && slideSpec.allowedClaimIds.indexOf(id) === -1) { issues.push(_issue('claim_not_allowed_on_slide', p, 'このスライドで使えない主張IDです: ' + id)); continue; }
      valid.push(id);
    }
    return valid;
  }

  // 文案を検査する。spec は buildProductionSpec().spec、pack はテーマパック。
  function validateCopy(copy, spec, pack) {
    var issues = [];
    var result = {
      ruleCheck: 'fail',
      issues: issues,
      semanticReviewRequired: SEMANTIC_REVIEW_ITEMS.map(function (s) { return { item: s.item, label: s.label }; }),
      medicalCorrectnessVerified: false,   // ルール検査では判定しない（常に false）
      claimTextMatchVerified: false,       // 主張IDの対応は内容の一致を保証しない（常に false）
      limitsProvisional: true,             // 文字量の上限は仮値
      approval: 'not_approved',            // 自動承認しない（常に not_approved）
    };
    if (!topicPack) { issues.push(_issue('topic_pack_module_unavailable', '', 'テーマパックのモジュールがありません')); return result; }
    if (!_isPlainObject(spec) || !Array.isArray(spec.slides)) { issues.push(_issue('spec_missing', 'spec', '制作仕様がありません')); return result; }
    var packCheck = topicPack.validateTopicPack(pack);
    if (!packCheck.productionReady) { issues.push(_issue('topic_pack_not_ready', 'pack', 'テーマパックが制作可能ではありません')); return result; }
    if (!_isPlainObject(copy)) { issues.push(_issue('copy_not_object', '', '文案がオブジェクトではありません')); return result; }

    var ctx = {
      knownIds: (Array.isArray(pack.claims) ? pack.claims : []).map(function (c) { return c && c.claimId; }),
      verifiedIds: packCheck.verifiedClaimIds,
    };
    var allowedNumbers = Array.isArray(spec.allowedNumbers) ? spec.allowedNumbers : [];

    if (copy.topicId !== spec.topicId) issues.push(_issue('topic_id_mismatch', 'topicId', 'テーマIDが制作仕様と一致しません'));
    if (copy.outputType !== spec.outputType) issues.push(_issue('output_type_mismatch', 'outputType', '出力型が制作仕様と一致しません'));
    if (copy.contentType !== spec.contentType) issues.push(_issue('content_type_mismatch', 'contentType', '投稿種別が制作仕様と一致しません'));

    var slides = Array.isArray(copy.slides) ? copy.slides : null;
    if (!slides) issues.push(_issue('slides_not_array', 'slides', 'slides が配列ではありません'));
    else if (slides.length !== spec.slideCount) issues.push(_issue('slide_count_mismatch', 'slides', '枚数が ' + spec.slideCount + ' 枚ではありません: ' + slides.length));

    var used = {};   // slideIndex -> 使用した主張ID
    var lineTexts = {};
    if (slides) {
      for (var i = 0; i < slides.length; i++) {
        var s = slides[i];
        var sp = 'slides[' + i + ']';
        if (!_isPlainObject(s)) { issues.push(_issue('slide_not_object', sp, 'スライドがオブジェクトではありません')); continue; }
        var slideSpec = spec.slides[i] || null;
        if (s.index !== i + 1) issues.push(_issue('slide_index_mismatch', sp + '.index', 'スライド番号が順番どおりではありません'));
        if (slideSpec && s.role !== slideSpec.role) issues.push(_issue('slide_role_mismatch', sp + '.role', '役割が制作仕様と一致しません（期待: ' + slideSpec.role + '）'));
        if (!_isNonEmptyString(s.headline)) issues.push(_issue('missing_headline', sp + '.headline', '見出しがありません'));
        else {
          if (_len(s.headline) > spec.limits.headlineMaxChars) issues.push(_issue('headline_too_long', sp + '.headline', '見出しが長すぎます'));
          _checkText(s.headline, sp + '.headline', allowedNumbers, issues);
        }
        var lines = Array.isArray(s.lines) ? s.lines : null;
        if (!lines || lines.length === 0) { issues.push(_issue('missing_lines', sp + '.lines', '本文の行がありません')); continue; }
        if (slideSpec && lines.length < slideSpec.linesMin) issues.push(_issue('too_few_lines', sp + '.lines', '行数が足りません（最低 ' + slideSpec.linesMin + ' 行）'));
        if (lines.length > spec.limits.linesPerSlideMax) issues.push(_issue('too_many_lines', sp + '.lines', '行数が多すぎます'));
        used[i + 1] = used[i + 1] || [];
        for (var j = 0; j < lines.length; j++) {
          var ln = lines[j];
          var lp = sp + '.lines[' + j + ']';
          if (!_isPlainObject(ln) || !_isNonEmptyString(ln.text)) { issues.push(_issue('missing_line_text', lp, '行の本文がありません')); continue; }
          if (_len(ln.text) > spec.limits.lineMaxChars) issues.push(_issue('line_too_long', lp, '1行が長すぎます'));
          var norm = ln.text.trim();
          if (Object.prototype.hasOwnProperty.call(lineTexts, norm)) issues.push(_issue('duplicate_line_text', lp, '同じ行が繰り返されています'));
          else lineTexts[norm] = true;
          _checkText(ln.text, lp + '.text', allowedNumbers, issues);
          var ids = _checkClaimIds(ln.claimIds, lp + '.claimIds', ctx, slideSpec, issues);
          // 理由・手順・注意点・チェックリストの行は、確認済みの主張に結びつける（1枚目は主張を引用しない）。
          if (slideSpec && slideSpec.index > 1 && Array.isArray(ln.claimIds) && ids.length === 0) {
            issues.push(_issue('uncited_line', lp, '主張IDに結びついていない行です'));
          }
          for (var k = 0; k < ids.length; k++) if (used[i + 1].indexOf(ids[k]) === -1) used[i + 1].push(ids[k]);
        }
        // 最低限引用する主張の数（異なる主張ID）。パックの全主張を入れることは求めない。
        if (slideSpec && used[i + 1].length < slideSpec.minCitedClaims) {
          issues.push(_issue('too_few_cited_claims', sp, '引用した主張が足りません（最低 ' + slideSpec.minCitedClaims + ' 個）'));
        }
        // 最後のスライドが「試しましょう」等だけで終わらないこと
        if (slideSpec && slideSpec.role === 'checklist') {
          var last = lines[lines.length - 1];
          if (_isPlainObject(last) && typeof last.text === 'string' && WEAK_CLOSING_RE.test(last.text)) {
            issues.push(_issue('weak_closing', sp + '.lines[' + (lines.length - 1) + ']', '最後が「試しましょう」だけで終わっています'));
          }
        }
      }
    }

    // caption / cta / hashtags
    if (!_isPlainObject(copy.caption) || !_isNonEmptyString(copy.caption.text)) issues.push(_issue('missing_caption', 'caption.text', 'caption がありません'));
    else {
      if (_len(copy.caption.text) > spec.limits.captionMaxChars) issues.push(_issue('caption_too_long', 'caption.text', 'caption が長すぎます'));
      _checkText(copy.caption.text, 'caption.text', allowedNumbers, issues);
      _checkClaimIds(copy.caption.claimIds, 'caption.claimIds', ctx, null, issues);
    }
    if (!_isNonEmptyString(copy.cta)) issues.push(_issue('missing_cta', 'cta', 'CTA がありません'));
    else _checkText(copy.cta, 'cta', allowedNumbers, issues);
    if (!Array.isArray(copy.hashtags) || copy.hashtags.length === 0) issues.push(_issue('missing_hashtags', 'hashtags', 'ハッシュタグがありません'));
    else {
      if (copy.hashtags.length > spec.limits.hashtagsMax) issues.push(_issue('too_many_hashtags', 'hashtags', 'ハッシュタグが多すぎます'));
      var seenTag = {};
      for (var h = 0; h < copy.hashtags.length; h++) {
        var tag = copy.hashtags[h];
        var hp = 'hashtags[' + h + ']';
        if (typeof tag !== 'string' || !/^#[^\s#]+$/.test(tag)) { issues.push(_issue('invalid_hashtag', hp, 'ハッシュタグの形式が不正です')); continue; }
        if (Object.prototype.hasOwnProperty.call(seenTag, tag)) issues.push(_issue('duplicate_hashtag', hp, 'ハッシュタグが重複しています'));
        seenTag[tag] = true;
        if (AD_RE.test(tag)) issues.push(_issue('ad_marker_detected', hp, '広告・PR の表記が含まれています'));
      }
    }

    result.ruleCheck = issues.length === 0 ? 'pass' : 'fail';
    return result;
  }

  return {
    SEMANTIC_REVIEW_ITEMS: SEMANTIC_REVIEW_ITEMS,
    validateCopy: validateCopy,
  };
});
