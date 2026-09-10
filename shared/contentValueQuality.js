'use strict';
// shared/contentValueQuality.js
// Evidence-Based Content Value Quality — CV-3b: Content Value Quality Core（6軸）。
//
//   目的: 前工程 read-only 調査で確認された「Quality 判定系が一度も文章の意味を読んでいない」
//         （packageQuality は presence-only・score 100 / complete で薄い一般論が通過した）
//         状態への対応。Evidence Grounding と Content Value の **両方** が成立して初めて
//         高品質と判定する独立 Core。
//
//   責務:
//     - 6軸評価: evidenceGrounding / specificity / informationGain / actionability /
//                saveValue / nonGeneric
//     - 独立 gate（evidenceGrounding / nonGeneric）と score（残り4軸）の分離
//     - 既存語彙のみの status（complete / almost_ready / needs_work / insufficient）
//     - Product Content の productClaimGate（APFR classification='fact' のみ参照・最小）
//
//   非責務（このファイルが絶対にやらないこと）:
//     - Evidence 判定ロジックの重複実装
//       （shared/contentEvidence.js の resolveContentEvidence / isVerifiedContentEvidence を再利用）
//     - 既存 packageQuality / evaluateQualityGate / evaluateOutputQuality の参照・変更
//     - APFR facts[] / IADP intelligenceContext.evidence[] への書き込み
//     - Writer / Reviewer / Leader Final / Output Draft 生成フローの変更
//     - LLM 呼び出し（semantic signal は options.reviewerNovelty として **外部から注入**される）
//     - DB / Network / DOM / filesystem write / AI API
//
//   determinism: 純関数。固定辞書・固定正規表現・固定閾値のみ。乱数なし・時刻依存なし
//                （now は呼び出し側が注入）・外部 I/O なし。入力を一切変更しない（非破壊）。
//
//   設計上の必須制約（shared/instagramAccountDesignQuality.js の教訓を適用）:
//     「構造チェックを score へ含めると『必須欠損0』＝常に score100 となり階層が区別できなくなる」
//     → gates.evidenceGrounding / gates.nonGeneric は score に算入せず、独立 boolean gate とする。
//       score が 100 でも gate が false なら complete / almost_ready へ昇格させない。

var contentEvidence = require('./contentEvidence');   // CV-3a（read-only 再利用・変更しない）

var CONTENT_VALUE_VERSION = '1.0.0';

// 既存語彙のみ（shared/instagramAccountDesignQuality.js:44 と同一の4値）
var CONTENT_VALUE_STATUS_VALUES = Object.freeze(['complete', 'almost_ready', 'needs_work', 'insufficient']);

// semantic signal（Writer/Reviewer 由来。欠落は unclear 扱い＝FAIL）
var REVIEWER_NOVELTY_VALUES = Object.freeze(['novel', 'restatement', 'unclear']);

var CONTENT_TYPES = Object.freeze(['value', 'bridge', 'product']);

// ══════════════════════════════════════════════════════════════
// 閾値（本 Core 固有。Evidence 側の閾値は contentEvidence.js の既存値を使用する）
// ══════════════════════════════════════════════════════════════
var MIN_HOWCHECK_RATIO = 0.5;          // 本文 slide の過半が HOW/CHECK を持つこと
var MAX_COMMON_KNOWLEDGE_RATIO = 0.4;  // 一般論辞書一致率の上限（超過で informationGain FAIL）
var MIN_GROUNDED_SPECIFIC_CLAIMS = 2;  // informationGain に必要な grounded 具体 claim 数
var MIN_GROUNDED_ACTIONS = 1;          // actionability に必要な grounded executable action 数
var MIN_SAVE_VALUE_TYPES = 2;          // saveValue に必要なカテゴリ種類数
var SCORE_ALMOST_READY = 75;
var SCORE_COMPLETE = 90;

// ══════════════════════════════════════════════════════════════
// 一般論辞書（negative signal 専用）
//   ★ 「辞書非一致 ＝ 有益」とは絶対にしない。informationGain は AND 3条件のうちの1つとしてのみ使う。
//   ★ 明らかな一般論の検出にのみ用いる保守的な最小セット（過剰に広げない）。
// ══════════════════════════════════════════════════════════════
var COMMON_KNOWLEDGE_PATTERNS = [
  /やさしく洗/, /優しく洗/, /こすりすぎ/, /洗いすぎ/,
  /早めに保湿/, /しっかり保湿/, /保湿(を|が)?(大切|重要|意識)/, /乾く前に保湿/,
  /減らしすぎ/, /適量を(守|使)/,
  /触りすぎ/, /触らないよう/, /顔を(何度も)?触/,
  /続けやすく/, /毎日続け/, /無理なく続け/, /継続(が|は)(大切|重要)/,
  /基本を(整|見直)/, /まず見直/, /いちど見直/, /見直してみ/,
  /バランスの(よい|良い)食事/, /睡眠をしっかり/, /水分を(こまめに|しっかり)/,
  /自分に合った(もの|ケア)/, /肌に合(う|った)もの/,
];

// ══════════════════════════════════════════════════════════════
// 具体性シグナル（deterministic 正規表現）
// ══════════════════════════════════════════════════════════════

// 測定可能な単位のみ。★ つ / 個 / 点 / 項目 / 種類 等の「列挙カウンタ」は測定ではないため除外する
//   （「この5つをまずチェック」を具体的数値と誤認しないため）。
var MEASURABLE_NUMERIC = /[0-9０-９]+\s*(秒|分|時間|日|週間|週|ヶ月|か月|回|滴|プッシュ|ml|mL|cc|g|kg|℃|度|cm|mm|%|％|割|円玉|円)/;

// 判断基準（読者が自分で判定できる語）
var CRITERION_PATTERN = /(目安|基準|見分け|見極め|かどうか|サイン|判断でき|チェックポイント|確認ポイント)/;

// 条件節（条件マーカー ＋ 帰結）。★ 「〜は」の主題提示（例: 洗顔後は）は条件に数えない。
var CONDITION_PATTERN = /(なら(ば)?|場合(は|に)|とき(は|に)|際(は|に)|以上(は|なら)|未満(は|なら)|であれば)/;

// 手順（順序が明示されているもの）
var PROCEDURE_PATTERN = /(まず[^。]{0,40}(次に|そのあと|その後)|①|②|③|手順\s*[0-9１-９]|ステップ\s*[0-9１-９]|STEP\s*[0-9])/;

// 比較（決定に使える比較。単独の「より」は文体上のことが多いため帰結語を要求する）
var COMPARISON_PATTERN = /(より[^。]{0,20}(ほうが|方が)|に比べ|の違い|どちらが|とは異な)/;

// 注意点（明示的な注意喚起のみ。「〜すぎ」だけでは注意点に数えない）
var CAUTION_PATTERN = /(注意(点|して|が必要)|避けた(い|ほうが)|避けてくださ|NG|逆効果|やりがちな|落とし穴|failしやす)/;

// 失敗例
var FAILURE_PATTERN = /(よくある失敗|失敗例|やってしまいがち|ありがちな(ミス|失敗)|逆効果)/;

// 選び方
var CHOICE_PATTERN = /(選び方|選ぶとき|選ぶ際|どれを選|選定基準)/;

// 心構え表現（これ「だけ」では加点しない）
var MINDSET_PATTERN = /(意識し(ます|ましょう|て)|心がけ(ます|ましょう|て)|大切です|重要です|気をつけ(ます|ましょう|て)|してみませんか|大丈夫です|おすすめです)/;

// 実行を促す形（命令・依頼・手続き形）
var IMPERATIVE_PATTERN = /(してください|しましょう|します。|決めておく|置き換え|変えてみ|試してみ|測っ|塗っ|使っ|取り出し|セットし|確認し)/;

// 断定を避けたヘッジ（decidable ではない）
var HEDGE_PATTERN = /(ことがあります|かもしれません|と言われて|場合があります|人もいます|とされて)/;

// 因果（WHY）
var CAUSAL_PATTERN = /(ため|から(です)?。|理由は|なぜなら|ので、|によって)/;

// ══════════════════════════════════════════════════════════════
// helpers（純関数）
// ══════════════════════════════════════════════════════════════
function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _str(v) { return (v === null || v === undefined) ? '' : String(v); }
function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function _clamp100(n) { return Math.max(0, Math.min(100, Math.round(n))); }

function _normalize(s) {
  var t = _str(s);
  try { if (typeof t.normalize === 'function') t = t.normalize('NFKC'); } catch (e) { /* ignore */ }
  return t.toLowerCase().replace(/\s+/g, '');
}

// slide 文字列 → { headline, body }
//   既存 Output Draft の形式 `【N枚目】タイトル：X / 本文：Y / ビジュアル：Z` を読む。
//   ★ 「ビジュアル：」以降は画像生成用の指示であり読者が読む本文ではないため、評価対象から除外する。
function parseSlideText(raw) {
  var s = _str(raw);
  var out = { headline: '', body: '' };
  if (!s) return out;

  var mH = s.match(/タイトル\s*[:：]\s*([^\/]*)/);
  var mB = s.match(/本文\s*[:：]\s*([^\/]*)/);
  if (mH) out.headline = mH[1].trim();
  if (mB) out.body = mB[1].trim();

  if (!mH && !mB) {
    // ラベルが無い形式は、先頭行を headline・残りを body として扱う（推測補完はしない）
    var lines = s.split(/\n+/).map(function (x) { return x.trim(); }).filter(Boolean);
    out.headline = lines[0] || '';
    out.body = lines.slice(1).join(' ');
  }
  // 【N枚目】等の接頭辞を headline から除去
  out.headline = out.headline.replace(/^【[^】]*】\s*/, '').trim();
  return out;
}

function _sentences(text) {
  return _str(text).split(/[。！？\n]/).map(function (x) { return x.trim(); }).filter(Boolean);
}

// 1文が「測定可能・判定可能な具体要素」を持つか
function _concreteSignals(sentence) {
  var s = _str(sentence);
  return {
    numeric: MEASURABLE_NUMERIC.test(s),
    criterion: CRITERION_PATTERN.test(s),
    condition: CONDITION_PATTERN.test(s),
    procedure: PROCEDURE_PATTERN.test(s),
    comparison: COMPARISON_PATTERN.test(s),
  };
}
// 「測定可能・判定可能」と認めるのは、数値／判断基準／手順／比較のいずれか。
//   ★ 条件マーカー（なら／場合は／ときは）は **単独では具体要素に数えない**。
//     「今日から見直すならこの5つ」のような条件形の言い回しだけで具体的と誤認しないため、
//     条件は「実行を促す帰結」を伴う場合にのみ具体要素として認める。
function _hasConcrete(sig, sentence) {
  if (sig.numeric || sig.criterion || sig.procedure || sig.comparison) return true;
  if (sig.condition && IMPERATIVE_PATTERN.test(_str(sentence))) return true;
  return false;
}

// 心構えのみか（具体要素が無く、心構え表現で終わっている / ヘッジのみ）
function _isMindsetOnly(sentence) {
  var s = _str(sentence);
  var sig = _concreteSignals(s);
  if (_hasConcrete(sig, s) && IMPERATIVE_PATTERN.test(s) && !HEDGE_PATTERN.test(s)) return false;
  if (MINDSET_PATTERN.test(s)) return true;
  if (HEDGE_PATTERN.test(s)) return true;
  return !_hasConcrete(sig, s);
}

// HOW/CHECK 要素か（具体要素あり かつ 心構えのみでない かつ ヘッジでない）
function _isHowCheck(sentence) {
  var s = _str(sentence);
  var sig = _concreteSignals(s);
  if (!_hasConcrete(sig, s)) return false;
  if (HEDGE_PATTERN.test(s)) return false;
  if (MINDSET_PATTERN.test(s) && !IMPERATIVE_PATTERN.test(s)) return false;
  return true;
}

// 実行可能行動か（対象＋動作 ＋ 条件/タイミング/量/判断基準/手順 のいずれか。心構えのみは 0 件扱い）
function _isExecutableAction(sentence) {
  var s = _str(sentence);
  if (!_isHowCheck(s)) return false;
  return IMPERATIVE_PATTERN.test(s);
}

// ══════════════════════════════════════════════════════════════
// claim 抽出（Evidence を必要とする具体的主張）
//   ★ grounding は「宣言された linkage」でのみ成立する（推測でひも付けない）。
//     draft.fields.contentClaims[] = [{ claimId, slideIndex?, text, claimScope? }]
//     が無い / 一致しない場合、その claim は ungrounded（fail-closed）。
// ══════════════════════════════════════════════════════════════
function extractClaimCandidates(slides) {
  var out = [];
  var arr = Array.isArray(slides) ? slides : [];
  for (var i = 0; i < arr.length; i++) {
    var p = parseSlideText(arr[i]);
    var texts = _sentences(p.headline).concat(_sentences(p.body));
    for (var j = 0; j < texts.length; j++) {
      var s = texts[j];
      var sig = _concreteSignals(s);
      var causal = CAUSAL_PATTERN.test(s);
      var requires = _hasConcrete(sig, s) || causal;
      if (!requires) continue;
      out.push({
        slideIndex: i + 1,
        text: s,
        requiresEvidence: true,
        signals: sig,
        causal: causal,
      });
    }
  }
  return out;
}

// 宣言 claim との突合（正規化後の相互包含）
function _matchDeclaredClaim(candidateText, declaredClaims) {
  var n = _normalize(candidateText);
  if (!n) return null;
  for (var i = 0; i < declaredClaims.length; i++) {
    var d = declaredClaims[i];
    if (!_isPlainObject(d) || !_isNonEmptyString(d.claimId) || !_isNonEmptyString(d.text)) continue;
    var dn = _normalize(d.text);
    if (!dn) continue;
    if (n.indexOf(dn) !== -1 || dn.indexOf(n) !== -1) return d;
  }
  return null;
}

// ══════════════════════════════════════════════════════════════
// evaluateContentValue — 本 Core の唯一の公開評価関数
// ══════════════════════════════════════════════════════════════
function evaluateContentValue(draft, options) {
  var opts = _isPlainObject(options) ? options : {};
  var res = {
    version: CONTENT_VALUE_VERSION,
    contentType: CONTENT_TYPES.indexOf(opts.contentType) !== -1 ? opts.contentType : 'value',
    status: 'insufficient',
    evidenceStatus: 'insufficient',
    gates: { evidenceGrounding: false, nonGeneric: false, productClaim: true },
    score: 0,
    axes: {
      specificity: { pass: false, score: 0, detail: {} },
      informationGain: { pass: false, score: 0, detail: {} },
      actionability: { pass: false, score: 0, detail: {} },
      saveValue: { pass: false, score: 0, detail: {} },
    },
    claims: [],
    evidence: null,
    blockingReasons: [],
    recommendations: [],
    nextActions: [],
    aiActions: [],
    evaluatedAt: null,
  };

  try {
    if (!_isPlainObject(draft)) {
      res.blockingReasons.push('draft_missing_or_invalid');
      return res;
    }
    var fields = _isPlainObject(draft.fields) ? draft.fields : {};
    var slides = Array.isArray(fields.slides) ? fields.slides : [];
    var declaredClaims = Array.isArray(fields.contentClaims) ? fields.contentClaims : [];
    var evidenceRecords = Array.isArray(fields.contentEvidence) ? fields.contentEvidence : [];

    res.evaluatedAt = new Date(typeof opts.now === 'number' && isFinite(opts.now) ? opts.now : Date.now()).toISOString();

    if (slides.length === 0) {
      res.blockingReasons.push('no_slides');
      res.nextActions.push('スライド本文が空です。Output Draft を確認してください');
      return res;
    }

    // ── Evidence 集計（CV-3a を再利用・重複実装しない） ──
    var ev = contentEvidence.resolveContentEvidence(evidenceRecords, {
      caseId: draft.caseId,
      outputId: draft.outputId,
      now: opts.now,
      officialDomains: opts.officialDomains,
      industryDomains: opts.industryDomains,
    });
    res.evidence = {
      status: ev.status,
      verifiedCount: ev.verifiedCount,
      independentSourceCount: ev.independentSourceCount,
      contradictsCount: ev.contradictsCount,
      excludedCrossCase: ev.excludedCrossCase,
      staleCount: ev.staleCount,
    };
    res.evidenceStatus = ev.status;

    // ── claim 抽出 → 宣言 claim 突合 → grounded 判定 ──
    var candidates = extractClaimCandidates(slides);
    var ungrounded = 0, groundedSpecific = 0, contradictedClaims = 0;
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      var decl = _matchDeclaredClaim(c.text, declaredClaims);
      var byClaim = (decl && ev.byClaim && ev.byClaim[decl.claimId]) ? ev.byClaim[decl.claimId] : null;
      var grounded = !!(byClaim && byClaim.grounded === true);
      if (byClaim && byClaim.contradicts === true) contradictedClaims++;
      if (grounded) groundedSpecific++; else ungrounded++;
      res.claims.push({
        slideIndex: c.slideIndex,
        text: c.text,
        requiresEvidence: true,
        claimId: decl ? decl.claimId : null,
        claimScope: decl && _isNonEmptyString(decl.claimScope) ? decl.claimScope : null,
        grounded: grounded,
        contradicted: !!(byClaim && byClaim.contradicts === true),
      });
    }

    // ══════════════════════════════════════════════════════════
    // 軸1: evidenceGrounding（独立 gate・score 非算入）
    // ══════════════════════════════════════════════════════════
    var egPass = (ungrounded === 0) && (contradictedClaims === 0) && (ev.contradictsCount === 0) && (ev.status !== 'insufficient');
    res.gates.evidenceGrounding = egPass;
    if (ev.status === 'insufficient') res.blockingReasons.push('evidence_insufficient');
    if (ungrounded > 0) res.blockingReasons.push('ungrounded_claim:' + ungrounded);
    if (contradictedClaims > 0 || ev.contradictsCount > 0) res.blockingReasons.push('contradicting_evidence');

    // ══════════════════════════════════════════════════════════
    // 軸2: specificity（POINT / WHY / HOW·CHECK。文章量は加点しない）
    // ══════════════════════════════════════════════════════════
    var pointCount = 0, whyCount = 0, howCount = 0, bodySlides = 0;
    for (var s2 = 0; s2 < slides.length; s2++) {
      var p = parseSlideText(slides[s2]);
      if (_isNonEmptyString(p.headline)) pointCount++;
      // HOW/CHECK・WHY は headline / body のどちらに置かれていてもよい（読者が読む本文全体を対象にする）。
      //   ビジュアル指示は parseSlideText() の時点で除外済み。
      var sents = _sentences(p.headline).concat(_sentences(p.body));
      if (_sentences(p.body).length > 0) bodySlides++;
      var slideHasHow = false, slideHasWhy = false;
      for (var k = 0; k < sents.length; k++) {
        if (_isHowCheck(sents[k])) slideHasHow = true;
        // WHY は grounded な場合のみ有効
        if (CAUSAL_PATTERN.test(sents[k])) {
          var d2 = _matchDeclaredClaim(sents[k], declaredClaims);
          var bc2 = (d2 && ev.byClaim && ev.byClaim[d2.claimId]) ? ev.byClaim[d2.claimId] : null;
          if (bc2 && bc2.grounded === true) slideHasWhy = true;
        }
      }
      if (slideHasHow) howCount++;
      if (slideHasWhy) whyCount++;
    }
    var pointRatio = slides.length > 0 ? pointCount / slides.length : 0;
    var howRatio = bodySlides > 0 ? howCount / bodySlides : 0;
    var whyRatio = bodySlides > 0 ? whyCount / bodySlides : 0;
    var specPass = (pointRatio >= 1) && (howRatio >= MIN_HOWCHECK_RATIO);
    res.axes.specificity = {
      pass: specPass,
      score: _clamp100(pointRatio * 20 + howRatio * 55 + whyRatio * 25),
      detail: { pointCount: pointCount, whyCount: whyCount, howCheckCount: howCount, bodySlides: bodySlides,
        pointRatio: pointRatio, howCheckRatio: howRatio, whyRatio: whyRatio, minHowCheckRatio: MIN_HOWCHECK_RATIO },
    };
    if (!specPass) res.recommendations.push('抽象論のみです。判断基準・条件・タイミング・量・手順のいずれかを本文に入れてください');

    // ══════════════════════════════════════════════════════════
    // 軸3: informationGain（AND 3条件。辞書非一致だけでは絶対に PASS しない）
    // ══════════════════════════════════════════════════════════
    var commonHits = 0;
    for (var s3 = 0; s3 < slides.length; s3++) {
      var pp = parseSlideText(slides[s3]);
      var joined = pp.headline + ' ' + pp.body;
      var hit = false;
      for (var m = 0; m < COMMON_KNOWLEDGE_PATTERNS.length; m++) {
        if (COMMON_KNOWLEDGE_PATTERNS[m].test(joined)) { hit = true; break; }
      }
      if (hit) commonHits++;
    }
    var commonRatio = slides.length > 0 ? commonHits / slides.length : 0;

    var novelty = REVIEWER_NOVELTY_VALUES.indexOf(opts.reviewerNovelty) !== -1 ? opts.reviewerNovelty : 'unclear';

    var condDict = commonRatio <= MAX_COMMON_KNOWLEDGE_RATIO;                 // ① negative signal
    var condClaims = groundedSpecific >= MIN_GROUNDED_SPECIFIC_CLAIMS;        // ② Evidence 構造
    var condSemantic = (novelty === 'novel');                                 // ③ semantic signal
    var igPass = condDict && condClaims && condSemantic;                      // ★ AND

    res.axes.informationGain = {
      pass: igPass,
      score: igPass ? _clamp100((1 - commonRatio) * 50 + Math.min(groundedSpecific / 3, 1) * 50) : 0,
      detail: { commonKnowledgeRatio: commonRatio, commonKnowledgeHits: commonHits,
        maxCommonKnowledgeRatio: MAX_COMMON_KNOWLEDGE_RATIO,
        groundedSpecificClaims: groundedSpecific, minGroundedSpecificClaims: MIN_GROUNDED_SPECIFIC_CLAIMS,
        reviewerNovelty: novelty,
        conditions: { dictionary: condDict, groundedClaims: condClaims, semantic: condSemantic } },
    };
    if (!condDict) res.recommendations.push('一般論の言い換えが多すぎます（' + commonHits + '/' + slides.length + ' slide）');
    if (!condClaims) res.recommendations.push('grounded な具体 claim が ' + groundedSpecific + ' 件です（' + MIN_GROUNDED_SPECIFIC_CLAIMS + ' 件以上必要）');
    if (!condSemantic) res.recommendations.push('reviewerNovelty が ' + novelty + ' です（novel が必要・欠落は unclear 扱い）');

    // ══════════════════════════════════════════════════════════
    // 軸4: actionability（心構え文は 0 件扱い・最低 1 件は grounded）
    // ══════════════════════════════════════════════════════════
    var executable = 0, groundedExecutable = 0;
    for (var s4 = 0; s4 < slides.length; s4++) {
      var p4 = parseSlideText(slides[s4]);
      var sents4 = _sentences(p4.body).concat(_sentences(p4.headline));
      for (var q = 0; q < sents4.length; q++) {
        if (!_isExecutableAction(sents4[q])) continue;
        executable++;
        var d4 = _matchDeclaredClaim(sents4[q], declaredClaims);
        var bc4 = (d4 && ev.byClaim && ev.byClaim[d4.claimId]) ? ev.byClaim[d4.claimId] : null;
        if (bc4 && bc4.grounded === true) groundedExecutable++;
      }
    }
    var actPass = (executable >= 1) && (groundedExecutable >= MIN_GROUNDED_ACTIONS);
    res.axes.actionability = {
      pass: actPass,
      score: _clamp100(Math.min(executable / 3, 1) * 45 + Math.min(groundedExecutable / 2, 1) * 55),
      detail: { executableActions: executable, groundedExecutableActions: groundedExecutable, minGroundedActions: MIN_GROUNDED_ACTIONS },
    };
    if (!actPass) res.recommendations.push('読了後に実行できる具体的行動が不足しています（心構え表現のみは加点しません）');

    // ══════════════════════════════════════════════════════════
    // 軸5: saveValue（本文のみ。CTA の「保存してください」は絶対に加点しない）
    // ══════════════════════════════════════════════════════════
    var svTypes = {};
    for (var s5 = 0; s5 < slides.length; s5++) {
      var p5 = parseSlideText(slides[s5]);
      var text5 = p5.headline + ' ' + p5.body;   // ★ cta / caption / saveSharePrompt は対象外
      if (MEASURABLE_NUMERIC.test(text5)) svTypes['numeric'] = true;
      if (CRITERION_PATTERN.test(text5)) svTypes['criterion'] = true;
      if (CONDITION_PATTERN.test(text5)) svTypes['condition'] = true;
      if (PROCEDURE_PATTERN.test(text5)) svTypes['procedure'] = true;
      if (COMPARISON_PATTERN.test(text5)) svTypes['comparison'] = true;
      if (CAUTION_PATTERN.test(text5)) svTypes['caution'] = true;
      if (FAILURE_PATTERN.test(text5)) svTypes['failureExample'] = true;
      if (CHOICE_PATTERN.test(text5)) svTypes['howToChoose'] = true;
      if (/(チェックリスト|確認ポイント|チェックすべき)/.test(text5)) svTypes['checkpoint'] = true;
    }
    var svTypeList = Object.keys(svTypes);
    var svPass = svTypeList.length >= MIN_SAVE_VALUE_TYPES;
    res.axes.saveValue = {
      pass: svPass,
      score: _clamp100(Math.min(svTypeList.length / 4, 1) * 100),
      detail: { types: svTypeList, typeCount: svTypeList.length, minTypes: MIN_SAVE_VALUE_TYPES, ctaExcluded: true },
    };
    if (!svPass) res.recommendations.push('後で見返す価値（判断基準・比較・手順・数字・条件・注意点・失敗例・選び方）が不足しています');

    // ══════════════════════════════════════════════════════════
    // 軸6: nonGeneric（独立 gate。informationGain AND specificity）
    // ══════════════════════════════════════════════════════════
    res.gates.nonGeneric = (res.axes.informationGain.pass === true) && (res.axes.specificity.pass === true);
    if (!res.gates.nonGeneric) res.blockingReasons.push('generic_gate_failed');

    // ══════════════════════════════════════════════════════════
    // Product Content: productClaimGate（APFR classification='fact' のみ参照・最小）
    // ══════════════════════════════════════════════════════════
    if (res.contentType === 'product') {
      var facts = Array.isArray(opts.apfrFacts) ? opts.apfrFacts : [];
      var productClaims = res.claims.filter(function (c) { return c.claimScope === 'product'; });
      var unbacked = 0;
      for (var pc = 0; pc < productClaims.length; pc++) {
        var ok = false;
        for (var f = 0; f < facts.length; f++) {
          var ft = facts[f];
          if (!_isPlainObject(ft)) continue;
          if (ft.classification !== 'fact') continue;   // prediction / inference / unknown は不可
          if (!_isNonEmptyString(ft.factId)) continue;
          var declared = _matchDeclaredClaim(productClaims[pc].text, declaredClaims);
          if (declared && _isNonEmptyString(declared.apfrFactId) && declared.apfrFactId === ft.factId) { ok = true; break; }
        }
        if (!ok) unbacked++;
      }
      res.gates.productClaim = (unbacked === 0);
      if (unbacked > 0) res.blockingReasons.push('product_claim_not_backed_by_apfr_fact:' + unbacked);
    }

    // ══════════════════════════════════════════════════════════
    // score（4軸のみ。gate は算入しない）
    // ══════════════════════════════════════════════════════════
    res.score = _clamp100(
      (res.axes.specificity.score + res.axes.informationGain.score +
       res.axes.actionability.score + res.axes.saveValue.score) / 4
    );

    // ══════════════════════════════════════════════════════════
    // status 決定（既存語彙のみ・gate が false なら昇格させない）
    // ══════════════════════════════════════════════════════════
    if (!res.gates.evidenceGrounding || !res.gates.nonGeneric || !res.gates.productClaim) {
      res.status = 'insufficient';
    } else if (ev.status === 'insufficient') {
      res.status = 'insufficient';
    } else if (ev.status === 'partial') {
      res.status = 'needs_work';   // partial は最大 needs_work
    } else if (res.score >= SCORE_COMPLETE) {
      res.status = 'complete';
    } else if (res.score >= SCORE_ALMOST_READY) {
      res.status = 'almost_ready';
    } else {
      res.status = 'needs_work';
    }

    // ── nextActions / aiActions（既存 IADP と同型の語彙） ──
    if (ev.status === 'insufficient') {
      res.nextActions.push('検証済み contentEvidence を取得してから再評価してください');
      res.aiActions.push({ id: 'ai.content_evidence_acquire', type: 'ai_rerun', role: 'researcher',
        label: 'Content Evidence を取得して claim を grounding する' });
    } else if (ev.status === 'partial') {
      res.nextActions.push('独立 source を追加し検証済み Evidence を増やしてください');
      res.aiActions.push({ id: 'ai.content_evidence_reinforce', type: 'ai_rerun', role: 'researcher',
        label: '独立 source を追加取得して補強する' });
    }
    if (!res.gates.nonGeneric) {
      res.nextActions.push('一般論の言い換えを、判断基準・条件・数値を伴う具体情報へ書き換えてください');
    }

    return res;
  } catch (e) {
    // fail-closed: 例外時も insufficient のまま（突然 complete にしない）
    res.status = 'insufficient';
    res.gates.evidenceGrounding = false;
    res.gates.nonGeneric = false;
    res.blockingReasons.push('exception:' + (e && e.message ? e.message : 'unknown'));
    return res;
  }
}

module.exports = {
  version: CONTENT_VALUE_VERSION,
  CONTENT_VALUE_STATUS_VALUES: CONTENT_VALUE_STATUS_VALUES,
  REVIEWER_NOVELTY_VALUES: REVIEWER_NOVELTY_VALUES,
  CONTENT_TYPES: CONTENT_TYPES,
  MIN_HOWCHECK_RATIO: MIN_HOWCHECK_RATIO,
  MAX_COMMON_KNOWLEDGE_RATIO: MAX_COMMON_KNOWLEDGE_RATIO,
  MIN_GROUNDED_SPECIFIC_CLAIMS: MIN_GROUNDED_SPECIFIC_CLAIMS,
  MIN_GROUNDED_ACTIONS: MIN_GROUNDED_ACTIONS,
  MIN_SAVE_VALUE_TYPES: MIN_SAVE_VALUE_TYPES,
  SCORE_ALMOST_READY: SCORE_ALMOST_READY,
  SCORE_COMPLETE: SCORE_COMPLETE,
  parseSlideText: parseSlideText,
  extractClaimCandidates: extractClaimCandidates,
  evaluateContentValue: evaluateContentValue,
};
