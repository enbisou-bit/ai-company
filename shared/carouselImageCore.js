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

var crypto = require('crypto');
var renderer = require('./carouselRenderer');
var client = require('../lib/carouselImageClient');
var approval = require('./carouselApproval');

// ── 定数 ──────────────
var ID_RE = /^[a-zA-Z0-9_-]+$/;
var TARGET = { width: 1080, height: 1350, aspectRatio: '4:5' };
var MAX_REGEN_PER_SLIDE = 3;
// ※ Phase 2-E Gate 1 Step③以降、本定数は「UI initial display の初期表示値」専用。
//   planning / estimate / approval token 発行 / real guard では使用しない（暗黙 default 禁止）。
var IMAGE_QUALITY_DEFAULT = 'medium';   // low | medium | high
// 実 API 実行時の 1 投稿あたり pre-execution authorization ceiling。
//   Phase 2-E Gate 1 Step④: medium 7枚の authorized total（output + reserve）実測 ¥92.5232。
//   ★ actual provider usage・最終 invoice が必ずこの上限以内になることを保証する値ではない。
var BUDGET_JPY_PER_POST_DEFAULT = 100;

// ── 背景 prompt に必ず付ける安全固定句（商品 / Value Content 両対応） ──
var SAFE_SUFFIX = [
  'no text', 'no letters', 'no words', 'no logos', 'no brand names', 'no readable labels',
  // PA-17B(F-4): AI背景がUI風要素を描くと deterministic overlay（バッジ枠・文字）と競合するため明示禁止。
  //   PA-15B-2 実測: Output Draft のビジュアル指示「チェックリスト風デザイン」に忠実に反応し、
  //   slide1 の背景へチェックボックス状の図形が生成された（overlay 由来ではない）。
  //   Output Draft 本文・imagePrompt は変更せず、SAFE_SUFFIX 側でのみ制約する。
  'no UI elements', 'no checkboxes', 'no icons', 'no watermark', 'no frames',
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

  // ── Phase 2-E Gate 1 Step③: planning 以降は quality を明示必須にする ──────────────
  //   旧実装の `input.quality || IMAGE_QUALITY_DEFAULT` による暗黙 default を撤廃した。
  //   理由: planning で fallback した quality は estimate → approval token payload →
  //   real guard へそのまま流れるため、ユーザーが明示選択していない quality が
  //   署名済み scope に入り得た（fail-closed 方針の中で唯一の暗黙 fallback だった）。
  //   語彙は既存の client.validateQuality() をそのまま使う（新しい error 語彙を増やさない）:
  //     undefined / null / '' → missing_quality ／ enum 外 → invalid_quality
  //   ※ IMAGE_QUALITY_DEFAULT は UI initial display 用の定数としてのみ残す（planning では使わない）。
  var q = client.validateQuality(input.quality);
  if (!q.ok) return { ok: false, reason: q.reason };

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
    quality: q.value,   // validateQuality() 通過値のみ（暗黙 default へ落ちない）
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

// ══════════════════════════════════════════════════════════════
// Phase 2-D: draftFingerprint
//   「承認したのはこの Draft のこの内容」を一意に固定する SHA-256。
//   slides の1文字変更・built_at 変更・updated_at 変更のいずれでも hash が変わる。
// ══════════════════════════════════════════════════════════════
function draftFingerprint(draftRow) {
  var d = draftRow || {};
  var outputId = d.output_id != null ? d.output_id : d.id;
  var fields = d.fields || {};
  var slides = Array.isArray(fields.slides) ? fields.slides : [];
  // canonical: キー順固定・全て文字列化（JSON の型ゆれで hash が動かないようにする）
  var canonical = JSON.stringify({
    outputId: String(outputId == null ? '' : outputId),
    built_at: String(d.built_at == null ? '' : d.built_at),
    updated_at: String(d.updated_at == null ? '' : d.updated_at),
    slides: slides.map(function (s) { return String(s == null ? '' : s); }),
  });
  return crypto.createHash('sha256').update(canonical, 'utf8').digest('hex');
}

// ══════════════════════════════════════════════════════════════
// Phase 2-D: 実 provider 呼び出しの単一 guard
//
//   ★ すべての条件の完全 AND。1つでも false なら provider call = 0 で停止する。
//   ★ REAL_ENABLED=true 単独では絶対に通らない構造（他条件も同時に成立する必要がある）。
//   ★ costTracker は require しない（cost-logs.json は Protected Working Tree のため、
//     read/write 経路に触れない）。canProcess() の結果は呼び出し側が boolean で注入する。
// ══════════════════════════════════════════════════════════════
function assertRealCallAllowed(ctx) {
  ctx = ctx || {};
  var checks = [];
  function fail(reason) { checks.push({ reason: reason, ok: false }); return { ok: false, reason: reason, checks: checks }; }
  function pass(name) { checks.push({ reason: name, ok: true }); }

  // 1. 見積りが公式確認済みでなければ課金しない
  if (client.ESTIMATE_VERIFIED !== true) return fail('estimate_not_verified');
  pass('estimate_verified');

  // 2. 実 API 有効化フラグ（これ単独では通らない）
  if (client.REAL_ENABLED !== true) return fail('real_api_disabled');
  pass('real_enabled');

  // 3. 課金ロック（明示的に false でなければ通さない）
  if (ctx.billingLock !== false) return fail('billing_locked');
  pass('billing_unlocked');

  // 4. costTracker.canProcess()（注入 boolean。true 以外は通さない）
  if (ctx.costTrackerCanProcess !== true) return fail('cost_limit_stopped');
  pass('cost_tracker_ok');

  // 5. scope（caseId / outputId / draft の帰属）
  var scope = validateScope({ caseId: ctx.caseId, outputId: ctx.outputId, draftRow: ctx.draftRow });
  if (!scope.ok) return fail(scope.reason);
  pass('scope_valid');

  // 6. 承認済みであること
  var appr = validateApproval(ctx.approvalRow);
  if (!appr.ok) return fail(appr.reason);
  pass('approved');

  // 7. 未 published であること
  var pub = validateNotPublished(ctx.approvalRow);
  if (!pub.ok) return fail(pub.reason);
  pass('not_published');

  // 8. stale でないこと（承認時点と現在の built_at / updated_at が一致）
  var stale = validateNotStale(ctx.staleBefore, ctx.staleAfter);
  if (!stale.ok) return fail(stale.reason);
  pass('not_stale');

  // 9. quality enum
  var q = client.validateQuality(ctx.quality);
  if (!q.ok) return fail(q.reason);
  pass('quality_valid');

  // 10. slideCount が実際の slides 数と一致
  var fields = (ctx.draftRow && ctx.draftRow.fields) || {};
  var slides = Array.isArray(fields.slides) ? fields.slides : [];
  var slideCount = Number(ctx.slideCount);
  if (!Number.isInteger(slideCount) || slideCount < 1) return fail('invalid_slide_count');
  if (slideCount !== slides.length) return fail('slide_count_mismatch');
  pass('slide_count_valid');

  // 11. 見積り額が呼び出し側の主張値と一致（改竄検出）
  //   Phase 2-E Gate 1 Step④: estimatedCostJpy の正式意味は
  //   「authorized total cost = output estimate + conservative text input reserve」。
  //   approval token 発行側（shared/carouselApproval.js 利用側）と real guard 側で
  //   必ず同一の estimateAuthorizedTotalJpy() を使う（output-only を署名し guard だけ
  //   total を見る、またはその逆、を構造的に起こさせないため）。
  var budget = Number.isFinite(Number(ctx.budgetJpyPerPost)) ? Number(ctx.budgetJpyPerPost) : BUDGET_JPY_PER_POST_DEFAULT;
  var computedJpy = client.estimateAuthorizedTotalJpy(q.value, slideCount);
  if (computedJpy === null) return fail('estimate_unavailable');
  if (approval.normalizeCostJpy(ctx.estimatedCostJpy) !== approval.normalizeCostJpy(computedJpy)) {
    return fail('estimated_cost_mismatch');
  }
  pass('estimated_cost_matches');

  // 12. 予算 hard stop（pre-flight）
  if (computedJpy > budget) return fail('budget_exceeded');
  pass('within_budget');

  // 13. draftFingerprint が現在の Draft と一致
  var fp = draftFingerprint(ctx.draftRow);
  if (String(ctx.draftFingerprint || '') !== fp) return fail('draft_fingerprint_mismatch');
  pass('fingerprint_matches');

  // 14. Approval Token（HMAC / TTL / scope / nonce 未使用）
  var v = approval.verifyApprovalToken(ctx.approvalToken, {
    caseId: ctx.caseId,
    outputId: ctx.outputId,
    draftFingerprint: fp,
    quality: q.value,
    slideCount: slideCount,
    estimatedCostJpy: computedJpy,
  }, { secret: ctx.approvalSecret, now: ctx.now });
  if (!v.ok) return fail(v.reason);
  pass('approval_token_valid');

  return { ok: true, checks: checks, scope: v.scope, estimatedCostJpy: computedJpy, budgetJpyPerPost: budget };
}

// ══════════════════════════════════════════════════════════════
// Phase 2-D: all-or-nothing orchestration（running budget 付き）
//
//   deps（注入必須。既定で実 provider を掴まない＝テストから実 API へ落ちない）:
//     deps.provider({ prompt, quality, aspectRatio, slideIndex }) → { ok, buffer }
//     deps.normalize({ buffer, mimeType })                        → { ok, buffer }
//     deps.composite({ backgroundBuffer, overlaySvg, width, height }) → { ok, buffer }
//
//   予算: provider call の直前ごとに
//         spentEstimatedJpy + nextCallEstimatedJpy <= budget
//         を検証する。再生成分も同じ累計へ含める（MAX_REGEN_PER_SLIDE だけでは予算保証にならない）。
//
//   all-or-nothing: 1枚でも失敗したら completed asset を正式成果物として返さず、
//                   後続 provider call を止め、filesystem にも一切書かない。
// ══════════════════════════════════════════════════════════════
async function runCarouselImageJob(input, deps) {
  input = input || {};
  deps = deps || {};

  var result = {
    ok: false, reason: null,
    mode: input.real === true ? 'real' : 'mock',
    realApiCalled: false, dbWritten: false, filesWritten: false,
    providerCalls: 0,
    successfulProviderCalls: 0,   // provider 呼び出し自体が ok:true+buffer だった回数（normalize/composite失敗とは別軸）
    formalAssets: [],          // 全枚成功時のみ埋まる
    failedSlides: [],
    spentEstimatedJpy: 0,
    budgetJpyPerPost: null,
    // Phase 2-E Gate 1 Step⑤: actual usage（post-execution observability）。
    //   Step④ の reserve（pre-execution authorization）とは完全に分離する。
    //   observed していない値を actual へ昇格させない（推測値は入れない）。
    actualUsage: null,            // 1回も provider attempt がなければ null のまま
    usageCompleteness: null,      // 'complete' | 'partial' | 'unavailable'（attempt が無ければ null）
    actualCostJpy: null,          // usageCompleteness==='complete' の場合のみ数値
    knownActualCostJpy: null,     // usageCompleteness==='partial' の場合のみ数値（観測できた分のみの合計）
    // Phase 2-E Gate 1 Step⑥: reserve が実際に成功した job（reserved===true）でのみ更新される。
    //   reserve が発生しなかった job（mock mode・pre-reserve での拒否）では null のまま。
    ledgerUpdated: null,
    ledgerError: null,
  };

  if (typeof deps.provider !== 'function') { result.reason = 'provider_not_injected'; return result; }
  if (typeof deps.normalize !== 'function') { result.reason = 'normalize_not_injected'; return result; }
  if (typeof deps.composite !== 'function') { result.reason = 'composite_not_injected'; return result; }

  // 実 provider を呼ぶ場合のみ、単一 guard を全通過させる（mock は課金しないため対象外）。
  if (input.real === true) {
    var guard = assertRealCallAllowed(input);
    if (!guard.ok) { result.reason = guard.reason; return result; }
    // Phase 2-E Gate 1 Step⑥: real mode では executionStore の注入を必須とする
    //   （mock mode では従来どおり未注入でよい＝既存動作を維持）。
    if (!deps.executionStore
        || typeof deps.executionStore.reserve !== 'function'
        || typeof deps.executionStore.complete !== 'function'
        || typeof deps.executionStore.fail !== 'function') {
      result.reason = 'execution_store_not_injected';
      return result;
    }
  }

  var plan = planCarouselImageJob(input);
  if (!plan.ok) { result.reason = plan.reason; return result; }

  var q = client.validateQuality(plan.quality);
  if (!q.ok) { result.reason = q.reason; return result; }

  var budget = Number.isFinite(Number(plan.budgetJpyPerPost)) ? Number(plan.budgetJpyPerPost) : BUDGET_JPY_PER_POST_DEFAULT;
  result.budgetJpyPerPost = budget;

  // Phase 2-E Gate 1 Step④: perCallJpy / totalJpy は output-only ではなく
  //   authorized total（output estimate + conservative text input reserve）で判定する。
  //   estimateImageJpy() 自体は output-only の意味を維持したまま変更していない
  //   （estimated_output_cost_jpy・既存 unit tests がこの意味に依存するため）。
  var perCallJpy = client.estimateAuthorizedPerCallJpy(q.value);
  if (perCallJpy === null) { result.reason = 'estimate_unavailable'; return result; }

  // Phase 2-E Production Connection Step B: alreadySpentEstimatedJpy は pre-flight より前で
  //   確定させる（running budget 側は元々ここを参照していたが、pre-flight は totalJpy 単体しか
  //   見ておらず、cumulative（同一 output_id への過去 execution の累積）を無視すると
  //   「pre-flight は通過したが running budget の途中で budget_exceeded になり、
  //   数枚分の有料生成が all-or-nothing で無駄になる」経路が生じるため、pre-flight にも算入する）。
  var spent = Number(input.alreadySpentEstimatedJpy) || 0;   // 再生成・per-post累積を同じ値へ持ち越す
  result.spentEstimatedJpy = spent;

  // pre-flight: alreadySpentEstimatedJpy 込みの全枚分見積り（authorized total）が予算を
  //   超えるなら provider を1回も呼ばない（high は7枚単体でも超過するため、ここで必ず拒否される。
  //   個別ハードコードではなく計算結果で判定）。
  var totalJpy = client.estimateAuthorizedTotalJpy(q.value, plan.totalSlides);
  if (totalJpy === null) { result.reason = 'estimate_unavailable'; return result; }
  if (spent + totalJpy > budget) {
    result.reason = 'budget_exceeded';
    result.detail = {
      quality: q.value, slideCount: plan.totalSlides,
      alreadySpentEstimatedJpy: Math.round(spent * 100) / 100,
      estimatedJpy: Math.round(totalJpy * 100) / 100,
      budgetJpyPerPost: budget,
    };
    return result;
  }

  var completed = [];       // 成功分は memory にのみ保持（正式成果物として返すのは全枚成功時だけ）

  // Phase 2-E Gate 1 Step⑤: job-level usage accumulator（null-until-observed。0 補完しない）。
  var usageAgg = {
    textInputTokens: null, imageInputTokens: null, outputTokens: null, totalTokens: null,
    attemptedCalls: 0, attemptsWithCompleteUsage: 0,
  };
  function _accumulateComponent(key, value) {
    if (typeof value !== 'number') return;   // null / undefined は寄与させない（観測なし）
    usageAgg[key] = (usageAgg[key] === null ? 0 : usageAgg[key]) + value;
  }

  // ══════════════════════════════════════════════════════════════
  // Phase 2-E Gate 1 Step⑥: atomic execution reserve / ledger finalizer
  //
  //   nonce single-use の正本は carousel_image_executions.nonce の UNIQUE 制約（DB）。
  //   in-memory nonce Set（shared/carouselApproval.js）は補助的な早期拒否のみで billing
  //   authority としては使わない。consumeNonce() をここから新たに呼ばない。
  //
  //   reserved フラグ: 1 job で reserve は必ず1回だけ（同一 nonce の2回目 INSERT は
  //   UNIQUE 違反で nonce_reused になり得るため、そもそも呼ばない設計にする）。
  //   reserve 成功から最初の provider call までの間に、他の分岐・I/O を置かない。
  //   mock mode（input.real !== true）では reserved は常に false のまま
  //   （executionStore は real mode でのみ必須・mock は課金しないため対象外）。
  // ══════════════════════════════════════════════════════════════
  var reserved = false;

  function _ledgerPayload() {
    return {
      nonce: guard.scope.nonce,
      attemptedProviderCalls: result.providerCalls,
      successfulProviderCalls: result.successfulProviderCalls,
      spentEstimatedJpy: result.spentEstimatedJpy,
      actualUsage: result.actualUsage,
      usageCompleteness: result.usageCompleteness,
      actualCostJpy: result.actualCostJpy,
      knownActualCostJpy: result.knownActualCostJpy,
    };
  }

  // failed_before_charge / failed_after_charge / unknown_billing の分類。
  //   ★ providerCalls===0 での fail は現在の reserve 配置（reserve 成功→即 provider call）
  //     では到達しない防御的分岐（reserve と provider の間に失敗点を置かない設計のため）。
  //   ★ successfulProviderCalls===0 でも usage を観測できていれば課金確実 → failed_after_charge。
  //     usageCompleteness==='unavailable'（何も観測できていない）の場合のみ unknown_billing。
  function _classifyFailureStatus() {
    if (result.providerCalls === 0) return 'failed_before_charge';
    if (result.successfulProviderCalls >= 1 || result.usageCompleteness !== 'unavailable') return 'failed_after_charge';
    return 'unknown_billing';
  }

  // reserved===true の場合のみ complete()/fail() を1回だけ実行する。すべての return 経路は
  //   これを経由すること（散らすと ledger 更新漏れが発生するため）。
  //   DB 更新自体が失敗しても result.ok は書き換えない（provider/成果物の実際の成否を維持）。
  //   nonce の reserve 行は DB に残ったままになる（release/reclaim はここで行わない・別課題）。
  async function _finalizeLedger() {
    if (!reserved) return result;
    var payload = _ledgerPayload();
    var ledgerRes;
    try {
      if (result.ok === true) {
        ledgerRes = await deps.executionStore.complete(payload);
      } else {
        ledgerRes = await deps.executionStore.fail(Object.assign(
          { status: _classifyFailureStatus(), lastErrorCode: result.reason || null }, payload
        ));
      }
    } catch (e) {
      ledgerRes = { ok: false, reason: 'ledger_update_unavailable' };   // raw exception は載せない
    }
    result.ledgerUpdated = !!(ledgerRes && ledgerRes.ok === true);
    result.ledgerError = result.ledgerUpdated ? null : ((ledgerRes && ledgerRes.reason) || 'ledger_update_unavailable');
    return result;
  }

  for (var i = 0; i < plan.items.length; i++) {
    var it = plan.items[i];

    // ── running budget check（provider call の直前・毎回） ──
    //   budget 拒否の場合は reserve を呼ばない（ここで return する時点では reserved は未だ
    //   false のため、_finalizeLedger() は no-op になる＝nonce を無駄に消費しない）。
    if (spent + perCallJpy > budget) {
      result.reason = 'budget_exceeded';
      result.failedSlides = [it.slideIndex];
      result.detail = { stage: 'running_budget', spentEstimatedJpy: Math.round(spent * 100) / 100, nextCallJpy: Math.round(perCallJpy * 10000) / 10000, budgetJpyPerPost: budget };
      result.formalAssets = [];
      result.spentEstimatedJpy = spent;
      return await _finalizeLedger();
    }

    // ── Phase 2-E Gate 1 Step⑥: atomic reserve（1 job で1回のみ・real mode限定） ──
    //   全無償検証（guard/plan/quality/pre-flight budget/running budget）を通過した後、
    //   最初の provider call の直前にのみ実行する。reserve 成功からこの直後の provider call
    //   までの間に、他の分岐・I/O を置かない。
    if (input.real === true && !reserved) {
      var reservePayload = {
        nonce: guard.scope.nonce,
        caseId: plan.caseId,
        workflowId: (input.workflowId === undefined || input.workflowId === null) ? null : input.workflowId,
        outputId: plan.outputId,
        draftFingerprint: guard.scope.draftFingerprint,
        model: client.CAROUSEL_IMAGE_MODEL,
        quality: q.value,
        slideCount: plan.totalSlides,
        estimatedOutputTokens: client.outputTokensFor(q.value) * plan.totalSlides,
        reservedInputTokens: client.INITIAL_TEXT_INPUT_RESERVE_TOKENS_PER_SLIDE * plan.totalSlides,
        estimatedOutputCostJpy: client.estimateImageJpy(q.value, plan.totalSlides),
        reservedInputCostJpy: client.estimateReservedInputJpy(plan.totalSlides),
        estimatedTotalCostJpy: totalJpy,
      };
      var rr;
      try { rr = await deps.executionStore.reserve(reservePayload); }
      catch (e) { rr = { ok: false, reason: 'reserve_unavailable' }; }   // raw exception は載せない
      if (!rr || rr.ok !== true) {
        result.reason = (rr && rr.reason) ? rr.reason : 'reserve_unavailable';
        result.failedSlides = [];
        result.formalAssets = [];
        return result;   // reserved は false のまま＝providerCalls=0・finalize不要（そもそも未reserve）
      }
      reserved = true;
    }

    var pr;
    try {
      pr = await deps.provider({
        prompt: it.asset.bgPrompt,
        quality: q.value,
        aspectRatio: plan.aspectRatio,
        slideIndex: it.slideIndex,
      });
    } catch (e) {
      pr = { ok: false, reason: 'provider_threw' };   // raw message は載せない
    }
    result.providerCalls++;
    spent += perCallJpy;
    result.spentEstimatedJpy = spent;
    if (input.real === true) result.realApiCalled = true;

    // ── Phase 2-E Gate 1 Step⑤: actual usage 集約（早期return より必ず前） ──
    //   ok:false・provider throw・normalize/composite 失敗のいずれでも、ここまでに観測できた
    //   usage は失わない（formalAssets=0 になっても billing observability は保持する）。
    //   pr.usage は generateBackgroundRaw() 側で extractActualUsage() 済みの正規化形（または null）。
    usageAgg.attemptedCalls = result.providerCalls;
    var au = (pr && pr.usage && typeof pr.usage === 'object') ? pr.usage : null;
    if (au) {
      _accumulateComponent('textInputTokens', au.textInputTokens);
      _accumulateComponent('imageInputTokens', au.imageInputTokens);
      _accumulateComponent('outputTokens', au.outputTokens);
      _accumulateComponent('totalTokens', au.totalTokens);
      if (au.completeness === 'complete') usageAgg.attemptsWithCompleteUsage++;
    }

    var usageCompletenessNow;
    if (usageAgg.attemptsWithCompleteUsage === usageAgg.attemptedCalls) {
      usageCompletenessNow = 'complete';
    } else if (usageAgg.textInputTokens !== null || usageAgg.imageInputTokens !== null || usageAgg.outputTokens !== null) {
      usageCompletenessNow = 'partial';
    } else {
      usageCompletenessNow = 'unavailable';
    }
    result.actualUsage = {
      textInputTokens: usageAgg.textInputTokens,
      imageInputTokens: usageAgg.imageInputTokens,
      outputTokens: usageAgg.outputTokens,
      totalTokens: usageAgg.totalTokens,
      attemptedCalls: usageAgg.attemptedCalls,
      attemptsWithCompleteUsage: usageAgg.attemptsWithCompleteUsage,
      source: 'provider_response',
    };
    result.usageCompleteness = usageCompletenessNow;
    // complete のときだけ actualCostJpy を確定し、partial は known（観測できた分のみ）へ留める。
    //   推定値で穴埋めしない（Decision 111 のreserveとactualUsageの分離を維持）。
    var observedJpy = client.actualJpyFromUsage({
      textInputTokens: usageAgg.textInputTokens,
      imageInputTokens: usageAgg.imageInputTokens,
      outputTokens: usageAgg.outputTokens,
    });
    result.actualCostJpy = (usageCompletenessNow === 'complete') ? observedJpy : null;
    result.knownActualCostJpy = (usageCompletenessNow === 'partial') ? observedJpy : null;

    if (!pr || pr.ok !== true || !Buffer.isBuffer(pr.buffer)) {
      result.reason = (pr && pr.reason) ? pr.reason : 'provider_failed';
      result.failedSlides = [it.slideIndex];
      result.formalAssets = [];
      return await _finalizeLedger();
    }
    result.successfulProviderCalls++;   // provider 自体は成功（normalize/composite 失敗とは別軸）

    // ── 正規化（1088x1360 → 1080x1350・crop なし） ──
    var nr;
    try { nr = await deps.normalize({ buffer: pr.buffer, mimeType: 'image/png' }); }
    catch (e) { nr = { ok: false, reason: 'normalize_threw' }; }
    if (!nr || nr.ok !== true || !Buffer.isBuffer(nr.buffer)) {
      result.reason = (nr && nr.reason) ? nr.reason : 'normalize_failed';
      result.failedSlides = [it.slideIndex];
      result.formalAssets = [];
      return await _finalizeLedger();
    }

    // ── overlay 生成 → 合成（compositor は Phase 2-C のまま・resize しない） ──
    var svg = renderer.renderSlideOverlaySvg({
      slideIndex: it.slideIndex, slideId: it.slideId,
      headline: it.headline, body: it.body, layout: it.layout,
    }, { totalSlides: plan.totalSlides });

    var cr;
    try {
      cr = await deps.composite({
        backgroundBuffer: nr.buffer, overlaySvg: svg,
        width: TARGET.width, height: TARGET.height,
      });
    } catch (e) { cr = { ok: false, reason: 'composite_threw' }; }
    if (!cr || cr.ok !== true || !Buffer.isBuffer(cr.buffer)) {
      result.reason = (cr && cr.reason) ? cr.reason : 'composite_failed';
      result.failedSlides = [it.slideIndex];
      result.formalAssets = [];
      return await _finalizeLedger();
    }

    completed.push({
      slideIndex: it.slideIndex, slideId: it.slideId,
      width: TARGET.width, height: TARGET.height, aspectRatio: TARGET.aspectRatio,
      format: 'png', buffer: cr.buffer, bytes: cr.buffer.length,
    });
  }

  // 全枚成功したときだけ正式成果物として返す
  result.ok = true;
  result.formalAssets = completed;
  result.estimatedCostJpy = Math.round(spent * 100) / 100;
  return await _finalizeLedger();
}

module.exports = {
  TARGET: TARGET,
  ID_RE: ID_RE,
  draftFingerprint: draftFingerprint,
  assertRealCallAllowed: assertRealCallAllowed,
  runCarouselImageJob: runCarouselImageJob,
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
