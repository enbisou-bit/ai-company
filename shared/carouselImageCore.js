'use strict';
// shared/carouselImageCore.js
// Instagram Carousel Image Production — C案 Phase 1 Core（純関数のみ）。
//
//   責務:
//     - 背景 prompt builder（raw userMessage / caption を使わない・allowlist フィルタ）
//     - asset model（fields.carouselAssets の形・DB schema 変更なし・既存 fields JSONB 利用）
//     - scope / slideIndex / approval / published / stale の validator（純関数・注入データで判定）
//     - orchestration（mock）: 実画像 API / DB write / filesystem write を一切行わず、
//       「何を生成すべきか」の plan と mock 成果物を返すだけ
//
//   非責務: 画像 API 呼び出し（lib/carouselImageClient.js）・合成（lib/carouselCompositor.js）・
//           DB I/O・filesystem I/O・network I/O。ここには一切書かない。

var renderer = require('./carouselRenderer');

// ── 定数 ──────────────
var ID_RE = /^[a-zA-Z0-9_-]+$/;
var TARGET = { width: 1080, height: 1350, aspectRatio: '4:5' };
var MAX_REGEN_PER_SLIDE = 3;
var IMAGE_QUALITY_DEFAULT = 'medium';   // low | medium | high
var BUDGET_JPY_PER_POST_DEFAULT = 100;  // 実 API 実行時の 1 投稿あたり上限（想定 ~45円/7枚）

// ── 背景 prompt に必ず付ける安全固定句（商品 / Value Content 両対応） ──
var SAFE_SUFFIX = [
  'no text', 'no letters', 'no words', 'no logos', 'no brand names', 'no readable labels',
  'no medical imagery', 'no clinical setting', 'no before and after', 'no skin comparison',
  'no celebrity', 'no recognizable real person', 'no prominent face', 'faces are small or absent',
  'clean minimal beauty-media background', '4:5 ratio, vertical, 1080x1350',
];

// ── visual direction から背景 prompt へ入れてよい文字だけ通す allowlist ──
//   日本語（ひらがな/カタカナ/漢字/全角記号の一部）＋ 英数 ＋ 基本記号のみ。
//   制御文字・引用符・波括弧・バックスラッシュ・prompt injection 的トークンを除去。
function sanitizeVisualDirection(s) {
  if (s == null) return '';
  var t = String(s);
  // 制御文字（U+0000..U+001F, U+007F）を空白へ
  t = t.replace(/[\u0000-\u001F\u007F]/g, ' ');
  // 明らかな injection トークンを除去
  t = t.replace(/\b(?:ignore|disregard|system|assistant|instruction|override|jailbreak|prompt)s?\b/gi, ' ');
  // 許可: 和文（ひらがな/カタカナ/漢字）・英数・空白・限定記号のみ。その他は空白へ。
  // 許可文字: ひらがな/カタカナ U+3040-30FF・漢字 U+4E00-9FFF・英数・空白・限定記号のみ。
  //   Unicode property escape を避け明示 \u レンジで判定（範囲順厳守・構文エラー回避）。
  var _allow = /[\u3040-\u30FF\u4E00-\u9FFF0-9A-Za-z \u3000,.\/:\-\u3001\u3002\u30FB\u30FC\uFF08\uFF09\u300C\u300D]/;
  t = Array.from(t).map(function (c) { return _allow.test(c) ? c : ' '; }).join('');
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t.slice(0, 240);
}

// ── slide の headline から番号バッジ（"3. …" → "3"）を決定的に抽出 ──
function badgeNumberFromHeadline(headline) {
  var m = /^\s*(\d{1,2})[\.\．]/.exec(String(headline || ''));
  return m ? Number(m[1]) : null;
}

// ── 正本 fields.slides エントリ（"【N枚目】タイトル：… / 本文：… / ビジュアル：…"）を分解 ──
//   ここで headline / body / visualDirection を「取り出すだけ」。改変・生成はしない。
function parseFieldSlide(raw) {
  var s = String(raw == null ? '' : raw);
  var title = null, body = null, visual = null;
  var mt = /タイトル[：:]\s*([\s\S]*?)(?:\s*\/\s*本文[：:]|$)/.exec(s);
  var mb = /本文[：:]\s*([\s\S]*?)(?:\s*\/\s*ビジュアル[：:]|$)/.exec(s);
  var mv = /ビジュアル[：:]\s*([\s\S]*?)$/.exec(s);
  if (mt) title = mt[1].trim();
  if (mb) body = mb[1].trim();
  if (mv) visual = mv[1].trim();
  // フォールバック: マーカーなしなら全体を headline とみなす
  if (title == null && body == null) title = s.trim();
  return { headline: title || '', body: body || '', visualDirection: visual || '' };
}

// ── 背景 prompt を server 側テンプレで構築（raw user text 不使用） ──
//   base: fields.imagePrompts[i]（sanitize 済み）＋ slide.visualDirection（sanitize 済み）＋ SAFE_SUFFIX
function buildBackgroundPrompt(opts) {
  var i = opts.slideIndex;
  var total = opts.totalSlides || 7;
  var isDark = (i === 1) || (i === total);
  var base = sanitizeVisualDirection(opts.imagePromptText || '');
  var vd = sanitizeVisualDirection(opts.visualDirection || '');
  var bgTone = isDark
    ? 'solid dark charcoal (#111111) background, minimal, premium, generous empty space for text'
    : 'clean white (#FFFFFF) background, soft natural light, pale calm tones, generous whitespace for text';
  var scene = [base, vd].filter(Boolean).join(', ');
  var prompt = [
    'Instagram carousel slide background',
    bgTone,
    scene || 'minimal beauty-media composition',
  ].concat(SAFE_SUFFIX).join(', ');
  // 決定的: 余分な空白を潰し、同一入力→同一 prompt
  return prompt.replace(/\s{2,}/g, ' ').trim();
}

// ── asset model（1 slide 分の初期エントリ） ──────────────
function makeAssetEntry(slideIndex, slideId) {
  return {
    slideIndex: slideIndex,
    slideId: slideId,
    width: TARGET.width,
    height: TARGET.height,
    aspectRatio: TARGET.aspectRatio,
    bgPrompt: null,
    bgUrl: null,
    overlaySvgPath: null,
    compositeUrl: null,
    status: 'pending',       // pending | generating | ready | error | stale
    imageReviewOk: false,
    generatedAt: null,
    regenCount: 0,
  };
}

// ── validators（純関数・注入データで判定・DB 呼び出しなし） ──────────────

// scope: caseId / outputId の形式 ＋ output が case に属するか
function validateScope(input) {
  var caseId = input.caseId, outputId = input.outputId, draftRow = input.draftRow;
  if (!ID_RE.test(String(caseId || ''))) return { ok: false, reason: 'invalid_caseId' };
  if (!ID_RE.test(String(outputId || ''))) return { ok: false, reason: 'invalid_outputId' };
  if (!draftRow || typeof draftRow !== 'object') return { ok: false, reason: 'draft_not_found' };
  var rowCase = draftRow.case_id != null ? draftRow.case_id : draftRow.caseId;
  var rowOut = draftRow.output_id != null ? draftRow.output_id : draftRow.id;
  if (String(rowCase) !== String(caseId)) return { ok: false, reason: 'cross_case' };
  if (String(rowOut) !== String(outputId)) return { ok: false, reason: 'output_mismatch' };
  return { ok: true };
}

// slideIndex: 1..slides.length の整数のみ
function validateSlideIndex(slideIndex, slidesLength) {
  var v = Number(slideIndex);
  if (!Number.isInteger(v)) return { ok: false, reason: 'slideIndex_not_integer' };
  if (v < 1 || v > Number(slidesLength)) return { ok: false, reason: 'slideIndex_out_of_range' };
  return { ok: true };
}

// approval: output_approvals 行が approved かつ 未 published
function validateApproval(approvalRow) {
  if (!approvalRow || typeof approvalRow !== 'object') return { ok: false, reason: 'no_approval' };
  var decision = approvalRow.approval_decision != null ? approvalRow.approval_decision : approvalRow.approvalDecision;
  if (String(decision) !== 'approved') return { ok: false, reason: 'not_approved' };
  return { ok: true };
}

// published: published===true なら生成・再生成・上書きすべて拒否
function validateNotPublished(approvalRow) {
  var published = approvalRow && (approvalRow.published === true || approvalRow.published === 'true');
  if (published) return { ok: false, reason: 'already_published' };
  return { ok: true };
}

// stale: 生成開始時と完了時の built_at / updated_at が一致するか
function validateNotStale(before, after) {
  if (!before || !after) return { ok: false, reason: 'missing_stale_marker' };
  if (String(before.built_at) !== String(after.built_at)) return { ok: false, reason: 'stale_built_at' };
  if (String(before.updated_at) !== String(after.updated_at)) return { ok: false, reason: 'stale_updated_at' };
  return { ok: true };
}

// slide 単位独立性: regenerate 対象 index 以外の asset が byte 一致で不変か
function assertSlideIsolation(prevAssets, nextAssets, changedIndex) {
  var issues = [];
  for (var i = 0; i < prevAssets.length; i++) {
    var si = prevAssets[i].slideIndex;
    if (si === changedIndex) continue;
    if (JSON.stringify(prevAssets[i]) !== JSON.stringify(nextAssets[i])) {
      issues.push({ slideIndex: si, reason: 'unexpected_mutation' });
    }
  }
  return { ok: issues.length === 0, issues: issues };
}

// ── plan: 「何を生成すべきか」（実行なし・純関数） ──────────────
function planCarouselImageJob(input) {
  var caseId = input.caseId, outputId = input.outputId;
  var draftRow = input.draftRow || {};
  var fields = draftRow.fields || {};
  var slides = Array.isArray(fields.slides) ? fields.slides : [];
  var imagePrompts = Array.isArray(fields.imagePrompts) ? fields.imagePrompts : [];

  var scope = validateScope({ caseId: caseId, outputId: outputId, draftRow: draftRow });
  if (!scope.ok) return { ok: false, reason: scope.reason };

  var appr = validateApproval(input.approvalRow);
  if (!appr.ok) return { ok: false, reason: appr.reason };
  var pub = validateNotPublished(input.approvalRow);
  if (!pub.ok) return { ok: false, reason: pub.reason };

  if (slides.length < 2) return { ok: false, reason: 'not_enough_slides' };

  var total = slides.length;
  var items = slides.map(function (raw, i) {
    var idx = i + 1;
    var parsed = parseFieldSlide(raw);
    var entry = makeAssetEntry(idx, 'icb-' + idx);
    entry.bgPrompt = buildBackgroundPrompt({
      slideIndex: idx, totalSlides: total,
      imagePromptText: imagePrompts[i] || '',
      visualDirection: parsed.visualDirection,
    });
    var layout = {
      textPosition: idx === 1 ? 'center' : (idx === total ? 'center' : 'left-or-top'),
      badgeNumber: badgeNumberFromHeadline(parsed.headline),
      isCta: idx === total,
      ctaText: idx === total ? sliceCtaText(fields.cta) : null,
    };
    return {
      slideIndex: idx,
      slideId: entry.slideId,
      headline: parsed.headline,   // 正本由来・改変なし
      body: parsed.body,           // 正本由来・改変なし
      layout: layout,
      asset: entry,
    };
  });

  return {
    ok: true,
    caseId: caseId,
    outputId: outputId,
    aspectRatio: TARGET.aspectRatio,
    width: TARGET.width,
    height: TARGET.height,
    quality: input.quality || IMAGE_QUALITY_DEFAULT,
    budgetJpyPerPost: input.budgetJpyPerPost || BUDGET_JPY_PER_POST_DEFAULT,
    maxRegenPerSlide: MAX_REGEN_PER_SLIDE,
    totalSlides: total,
    items: items,
    staleMarker: { built_at: draftRow.built_at, updated_at: draftRow.updated_at },
  };
}

function sliceCtaText(cta) {
  var s = String(cta == null ? '' : cta);
  // CTA は 1 文だけ（「保存」を含む中立文を優先）
  var first = s.split(/[。\n]/).map(function (x) { return x.trim(); }).filter(Boolean)[0] || s.trim();
  return first ? first + '。' : '';
}

// ── mock 実行: 実 API / DB / filesystem に触れず、成果物の「形」だけ返す ──────────────
//   Phase 1 の検証用。実行系（lib/carouselImageClient・carouselCompositor・DB write）は
//   Phase 2 で接続する。ここで返す url は擬似パス（実ファイルは作らない）。
function runCarouselImageJobMock(input) {
  var plan = planCarouselImageJob(input);
  if (!plan.ok) return plan;

  var dir = 'generated/' + plan.caseId + '/' + plan.outputId;
  var ctxTotal = plan.totalSlides;

  var assets = plan.items.map(function (it) {
    var a = it.asset;
    a.bgPrompt = it.layout ? a.bgPrompt : a.bgPrompt;
    a.bgUrl = '/' + dir + '/background-' + it.slideIndex + '.png';
    a.overlaySvgPath = dir + '/overlay-' + it.slideIndex + '.svg';
    a.compositeUrl = '/' + dir + '/slide-' + it.slideIndex + '.png';
    a.status = 'ready';
    a.generatedAt = '(mock)';
    // overlay SVG（deterministic・実ファイルは書かない）
    a._overlaySvg = renderer.renderSlideOverlaySvg({
      slideIndex: it.slideIndex, slideId: it.slideId,
      headline: it.headline, body: it.body, layout: it.layout,
    }, { totalSlides: ctxTotal });
    return a;
  });

  return {
    ok: true,
    mode: 'mock',
    realApiCalled: false,
    dbWritten: false,
    filesWritten: false,
    caseId: plan.caseId,
    outputId: plan.outputId,
    dir: dir,
    fieldsPatch: { carouselAssets: assets.map(function (a) { var c = Object.assign({}, a); delete c._overlaySvg; return c; }), carouselAspectRatio: plan.aspectRatio },
    overlaySvgs: assets.map(function (a) { return { slideIndex: a.slideIndex, svg: a._overlaySvg }; }),
    plan: plan,
  };
}

// ── regenerate（mock・slide 単位） ──────────────
function regenerateSlideMock(input) {
  var slideIndex = Number(input.slideIndex);
  var plan = planCarouselImageJob(input);
  if (!plan.ok) return plan;

  var si = validateSlideIndex(slideIndex, plan.totalSlides);
  if (!si.ok) return { ok: false, reason: si.reason };

  var prevAssets = Array.isArray(input.prevAssets) ? input.prevAssets : plan.items.map(function (it) { return it.asset; });
  var target = prevAssets.find(function (a) { return a.slideIndex === slideIndex; });
  if (!target) return { ok: false, reason: 'asset_not_found' };
  if ((target.regenCount || 0) >= MAX_REGEN_PER_SLIDE) return { ok: false, reason: 'regen_limit' };

  var nextAssets = prevAssets.map(function (a) {
    if (a.slideIndex !== slideIndex) return a;   // 他 slide は同一参照＝byte 不変
    var patched = Object.assign({}, a);
    patched.bgUrl = '/generated/' + plan.caseId + '/' + plan.outputId + '/background-' + slideIndex + '.png';
    patched.status = 'ready';
    patched.generatedAt = '(mock-regen)';
    patched.regenCount = (a.regenCount || 0) + 1;
    return patched;
  });

  var iso = assertSlideIsolation(prevAssets, nextAssets, slideIndex);
  return {
    ok: iso.ok,
    mode: 'mock',
    realApiCalled: false,
    dbWritten: false,
    filesWritten: false,
    slideIndex: slideIndex,
    isolation: iso,
    nextAssets: nextAssets,
  };
}

module.exports = {
  TARGET: TARGET,
  ID_RE: ID_RE,
  SAFE_SUFFIX: SAFE_SUFFIX,
  MAX_REGEN_PER_SLIDE: MAX_REGEN_PER_SLIDE,
  IMAGE_QUALITY_DEFAULT: IMAGE_QUALITY_DEFAULT,
  BUDGET_JPY_PER_POST_DEFAULT: BUDGET_JPY_PER_POST_DEFAULT,
  sanitizeVisualDirection: sanitizeVisualDirection,
  badgeNumberFromHeadline: badgeNumberFromHeadline,
  parseFieldSlide: parseFieldSlide,
  buildBackgroundPrompt: buildBackgroundPrompt,
  makeAssetEntry: makeAssetEntry,
  validateScope: validateScope,
  validateSlideIndex: validateSlideIndex,
  validateApproval: validateApproval,
  validateNotPublished: validateNotPublished,
  validateNotStale: validateNotStale,
  assertSlideIsolation: assertSlideIsolation,
  planCarouselImageJob: planCarouselImageJob,
  runCarouselImageJobMock: runCarouselImageJobMock,
  regenerateSlideMock: regenerateSlideMock,
};
