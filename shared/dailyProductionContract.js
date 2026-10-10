// shared/dailyProductionContract.js
// Instagram Daily Production — Step 1: 制作契約（純関数）。
//
//   目的: 制作可能と判定されたテーマパックから、5枚カルーセルの制作仕様（スライドの役割・
//         使ってよい主張ID・文字量の上限）と Writer への指示文を決定論で作る。
//         出力型・投稿種別・枚数は明示値で固定し、本文のキーワードから型を推測しない。
//
//   責務:
//     - 明示値の定義（outputType / contentType / slideCount / 商品・ブランド・リンクなし）
//     - 5枚それぞれの役割と、各スライドで必須／使用可能な主張IDの割り当て
//     - 5枚で成立しないテーマを理由付きで止める（水増しして5枚にしない）
//     - 後工程（Writer の出力・dailyCopyValidator）が使う出力構造の定義
//     - Writer への指示文の組み立て
//
//   非責務:
//     - AI 呼び出し・Web 検索・DB／Storage への読み書き・既存 Draft 形式への保存
//     - detectOutputType 等のキーワード判定の利用
//     - 日付・乱数・環境変数の参照
//
//   ★ 入力は変更しない。同じ入力からは常に同じ結果（仕様・指示文）を返す。

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
    root.DailyProductionContract = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (topicPack) {
  'use strict';

  var CONTRACT_VERSION = 1;

  // 明示値（キーワード判定に依存しない）
  var OUTPUT_TYPE = 'instagram_carousel';
  var CONTENT_TYPE = 'value';
  var SLIDE_COUNT = 5;
  var PRODUCT_POLICY = Object.freeze({ productAllowed: false, brandAllowed: false, affiliateLinkAllowed: false });

  // スマホで読める文字量の上限（後工程の構造検査で使う）。
  //   ★ 仮値（provisional）。画像レンダラーでの実測と突き合わせていない。確定時は別工程で見直す。
  var LIMITS = Object.freeze({
    provisional: true,
    headlineMaxChars: 24,
    lineMaxChars: 36,
    linesPerSlideMax: 6,
    captionMaxChars: 600,
    hashtagsMax: 15,
  });

  // スライドの役割。各枚は別の役割を持つ。
  //   claimKinds: そのスライドで使える主張の種類（空＝主張を引用しない）
  //   linesMin: 最低行数（チェックリストは複数項目が必要）
  //   minCitedClaims: そのスライドで最低限引用する主張の数（異なる主張ID）。
  //     ★ パックの全主張を本文へ詰め込むことは求めない。使える主張（allowedClaimIds）の中から選ぶ。
  var SLIDE_ROLES = Object.freeze([
    Object.freeze({ index: 1, role: 'scene_problem', label: '生活の場面と悩み', claimKinds: Object.freeze([]), linesMin: 1, minCitedClaims: 0 }),
    Object.freeze({ index: 2, role: 'verified_reason', label: '確認済みの理由', claimKinds: Object.freeze(['reason']), linesMin: 1, minCitedClaims: 1 }),
    Object.freeze({ index: 3, role: 'steps', label: '具体的な手順', claimKinds: Object.freeze(['action']), linesMin: 1, minCitedClaims: 1 }),
    Object.freeze({ index: 4, role: 'additional_action_or_caution', label: '別の必要な行動・注意点', claimKinds: Object.freeze(['action', 'caution']), linesMin: 1, minCitedClaims: 1 }),
    Object.freeze({ index: 5, role: 'checklist', label: '保存して使えるチェックリスト', claimKinds: Object.freeze(['action', 'caution']), linesMin: 2, minCitedClaims: 2 }),
  ]);

  // スライド3に割り当てる行動主張の上限（残りはスライド4へ回す）。
  var STEPS_MAX_ACTIONS = 4;

  function _ids(list) { return list.map(function (c) { return c.claimId; }); }

  // 主張をスライドへ割り当てる。5枚で成立しない場合は理由を返して止める。
  function _assignClaims(claims) {
    var reasons = claims.filter(function (c) { return c.kind === 'reason'; });
    var actions = claims.filter(function (c) { return c.kind === 'action'; });
    var cautions = claims.filter(function (c) { return c.kind === 'caution'; });
    var stop = [];
    if (reasons.length === 0) stop.push('reason_claim_missing');            // スライド2の理由がない
    if (actions.length === 0) stop.push('action_claim_missing');            // スライド3の手順がない
    // スライド4は「別の」行動か注意点が必要。行動が1つだけで注意点もなければ、4枚目が3枚目の繰り返しになる。
    if (actions.length < 2 && cautions.length === 0) stop.push('slide4_has_no_distinct_content');
    // チェックリスト（5枚目）はすべての行動を載せるため、行動が行数上限を超えるテーマは1投稿に収まらない。
    if (actions.length > LIMITS.linesPerSlideMax) stop.push('checklist_exceeds_line_limit');
    if (stop.length) return { ok: false, reasons: stop };

    // 注意点がなければ、行動を最低1つスライド4へ残す（3枚目と4枚目で使える主張を重ねない）。
    var stepCount = Math.min(STEPS_MAX_ACTIONS, cautions.length > 0 ? actions.length : actions.length - 1);
    var stepActions = actions.slice(0, stepCount);
    var restActions = actions.slice(stepCount);
    if (restActions.length + cautions.length > LIMITS.linesPerSlideMax) return { ok: false, reasons: ['slide4_exceeds_line_limit'] };
    return {
      ok: true,
      bySlide: {
        1: { allowed: [] },
        2: { allowed: _ids(reasons) },
        3: { allowed: _ids(stepActions) },
        4: { allowed: _ids(restActions.concat(cautions)) },
        // チェックリストは3・4枚目の行動・注意点を「保存して使う形」に言い直す。
        5: { allowed: _ids(actions.concat(cautions)) },
      },
    };
  }

  // 制作仕様を作る。テーマパックが制作可能でなければ止める（理由付き）。
  function buildProductionSpec(pack) {
    if (!topicPack) return { ok: false, reason: 'topic_pack_module_unavailable', reasons: ['topic_pack_module_unavailable'], issues: [] };
    var v = topicPack.validateTopicPack(pack);
    if (!v.productionReady) {
      return { ok: false, reason: 'topic_pack_not_ready', reasons: ['topic_pack_not_ready'], issues: v.issues.slice() };
    }
    var claims = topicPack.getVerifiedClaims(pack);
    var assign = _assignClaims(claims);
    if (!assign.ok) {
      return { ok: false, reason: 'not_feasible_in_5_slides', reasons: assign.reasons.slice(), issues: [] };
    }
    var slides = SLIDE_ROLES.map(function (r) {
      var a = assign.bySlide[r.index];
      return {
        index: r.index,
        role: r.role,
        label: r.label,
        allowedClaimIds: a.allowed.slice(),
        minCitedClaims: r.minCitedClaims,
        linesMin: r.linesMin,
        linesMax: LIMITS.linesPerSlideMax,
      };
    });
    return {
      ok: true,
      spec: {
        contractVersion: CONTRACT_VERSION,
        topicId: pack.topicId,
        outputType: OUTPUT_TYPE,
        contentType: CONTENT_TYPE,
        slideCount: SLIDE_COUNT,
        productPolicy: { productAllowed: false, brandAllowed: false, affiliateLinkAllowed: false },
        limits: {
          provisional: LIMITS.provisional,
          headlineMaxChars: LIMITS.headlineMaxChars,
          lineMaxChars: LIMITS.lineMaxChars,
          linesPerSlideMax: LIMITS.linesPerSlideMax,
          captionMaxChars: LIMITS.captionMaxChars,
          hashtagsMax: LIMITS.hashtagsMax,
        },
        slides: slides,
        allowedNumbers: topicPack.getAllowedNumbers(pack),
        claimIds: _ids(claims),
      },
    };
  }

  // Writer の出力構造（後工程で使う）。値の例ではなく形の定義。
  //   { topicId, outputType, contentType,
  //     slides: [{ index, role, headline, lines: [{ text, claimIds: [] }] }],
  //     caption: { text, claimIds: [] }, cta, hashtags: [] }
  var COPY_SHAPE_DESCRIPTION = [
    '出力は次の JSON 形だけにする。',
    '{ "topicId": string, "outputType": "instagram_carousel", "contentType": "value",',
    '  "slides": [ { "index": 1〜5, "role": string, "headline": string,',
    '               "lines": [ { "text": string, "claimIds": [string] } ] } ],',
    '  "caption": { "text": string, "claimIds": [string] }, "cta": string, "hashtags": [string] }',
  ].join('\n');

  // Writer への指示文（決定論）。主張は ID 付きで渡し、各行で使った主張IDを返させる。
  function buildWriterInstruction(spec, pack) {
    if (!spec || spec.outputType !== OUTPUT_TYPE) return null;
    var claims = topicPack ? topicPack.getVerifiedClaims(pack) : [];
    var byId = {};
    claims.forEach(function (c) { byId[c.claimId] = c; });
    var L = [];
    L.push('【Instagram カルーセル制作（日次・明示指定）】');
    L.push('出力型: ' + spec.outputType + ' ／ 投稿種別: ' + spec.contentType + ' ／ 枚数: ' + spec.slideCount + '枚（固定）');
    L.push('商品名・ブランド名・アフィリエイトリンク・URL は入れない。');
    L.push('');
    L.push('■ テーマ');
    L.push('場面: ' + pack.concern.scene);
    L.push('悩み: ' + pack.concern.problem);
    L.push('今日の中心行動: ' + pack.coreAction);
    L.push('');
    L.push('■ 使ってよい主張（これ以外の事実・数値・理由は書かない）');
    spec.claimIds.forEach(function (id) { L.push('[' + id + '] (' + byId[id].kind + ') ' + byId[id].text); });
    L.push('');
    L.push('■ スライドの役割（各枚は別の役割。水増しして埋めない。主張を全部入れる必要はない）');
    spec.slides.forEach(function (s) {
      var req = s.allowedClaimIds.length
        ? ' 使える主張: ' + s.allowedClaimIds.join(', ') + '（このうち' + s.minCitedClaims + '個以上を使う）'
        : ' 主張は引用しない';
      L.push(s.index + '枚目: ' + s.label + '。' + req + '。');
    });
    L.push('');
    L.push('■ 書き方');
    L.push('・1行に1つの動作。何を、いつ、どうするかまで書く。');
    L.push('・各行の claimIds に、その行が根拠にした主張IDを入れる（1枚目は空）。');
    L.push('・見出しは' + spec.limits.headlineMaxChars + '字以内、1行は' + spec.limits.lineMaxChars + '字以内、1枚' + spec.limits.linesPerSlideMax + '行以内（仮の上限）。');
    L.push('・5枚目は保存して使えるチェックリストにする。「試しましょう」だけで終わらせない。');
    L.push('・効果や期間を保証しない。体験談・口コミ・ランキング・根拠のない数値は書かない。');
    L.push('・研究の結果を一般化しすぎない。診断や治療の代わりになる表現にしない。');
    L.push('');
    L.push(COPY_SHAPE_DESCRIPTION);
    return L.join('\n');
  }

  return {
    CONTRACT_VERSION: CONTRACT_VERSION,
    OUTPUT_TYPE: OUTPUT_TYPE,
    CONTENT_TYPE: CONTENT_TYPE,
    SLIDE_COUNT: SLIDE_COUNT,
    PRODUCT_POLICY: PRODUCT_POLICY,
    LIMITS: LIMITS,
    SLIDE_ROLES: SLIDE_ROLES,
    COPY_SHAPE_DESCRIPTION: COPY_SHAPE_DESCRIPTION,
    buildProductionSpec: buildProductionSpec,
    buildWriterInstruction: buildWriterInstruction,
  };
});
