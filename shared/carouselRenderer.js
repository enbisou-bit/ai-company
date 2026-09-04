'use strict';
// shared/carouselRenderer.js
// Instagram Carousel Image Production — deterministic 日本語 overlay renderer。
//
//   Phase 2-B: system font 依存を完全排除。文字描画は shared/carouselFont.js の
//   glyph outline から生成した SVG <path> のみで行う（<text> / <tspan> / font-family を使わない）。
//   これにより Windows / Render Linux のどちらでも同一の描画結果になる。
//
//   責務: 承認済み Output Draft の headline / body（正本 fields.slides 由来の値）と
//         Design System 由来のレイアウト指定だけを入力に、1080×1350（4:5）の overlay SVG を
//         「同一入力 → 同一 SVG（byte 一致）」で生成する純関数。
//
//   非責務:
//     - 画像 API 呼び出し（lib/carouselImageClient.js）
//     - 背景 PNG との合成 / ラスタライズ（lib/carouselCompositor.js・sharp）
//     - DB / filesystem / network I/O 一切なし
//     - headline / body の生成・改変（呼び出し側が fields.slides から渡す・ここでは受け取るだけ。
//       要約・言い換え・削除・追加・自動補完は行わない。許可するのはレイアウト都合の改行のみ）
//
//   fail-closed: missing glyph は carouselFont 側で throw され、path を生成せず停止する。
//                system font / fallback font へ逃がさない。

var F = require('./carouselFont');

// ── キャンバス / セーフエリア（4:5 = 1080×1350 固定） ──────────────
var CANVAS = { width: 1080, height: 1350, ratio: '4:5' };
var SAFE = { top: 160, bottom: 160, left: 96, right: 96 };

// ── Design System（Minimal テンプレート）由来の基準値。4:5 キャンバスへスケール済み ──
//   出典: instagramDesignSystem template（titleSize 40 / bodySize 22 / margin 44 / padding 28 /
//   cornerRadius 8 / accentColor #111111 / backgroundColor #FFFFFF）。
//   ※ fontFamily は Phase 2-B で廃止（同梱フォントの glyph path を使うため SVG に書かない）。
var TYPO = {
  titlePx: 72,   // 40px 基準 → 1080幅で 72
  bodyPx: 36,    // 22px 基準 → 見出しの 50%
  pageNumPx: 24,
  badgePx: 40,
  ctaPx: 34,
  titleLineHeight: 1.3,
  bodyLineHeight: 1.6,
};

// weight は必ず明示する（carouselFont 側で未指定・未対応は throw）。
var WEIGHT = { title: 'bold', body: 'regular', badge: 'bold', pageNum: 'regular', cta: 'bold' };

// ── slide ごとの配色（S1 / S7 は dark、他は light） ──────────────
function slideTheme(slideIndex, totalSlides) {
  var isDark = (slideIndex === 1) || (slideIndex === totalSlides);
  return isDark
    ? { bg: '#111111', text: '#FFFFFF', accent: '#FFFFFF', mode: 'dark' }
    : { bg: '#FFFFFF', text: '#111111', accent: '#111111', mode: 'light' };
}

// ── 決定的な line wrapping（実グリフ幅・フォントメトリクス基準） ──────────────
//   日本語は分かち書きがないため文字単位で折る。元本文の文字順・内容は変更しない
//   （行を結合すると必ず元の文字列に戻る）。禁則は行頭回避のみの簡易処理。
var LINE_HEAD_AVOID = new Set(['、', '。', '，', '．', '）', '」', '』', '】', '〕', '！', '？', '・', 'ー']);

function wrapText(text, maxWidthPx, fontPx, weight) {
  var out = [];
  if (text == null) return out;
  var chars = Array.from(String(text));
  var line = '';
  var lineW = 0;
  for (var i = 0; i < chars.length; i++) {
    var ch = chars[i];
    if (ch === '\n') { out.push(line); line = ''; lineW = 0; continue; }
    var w = F.measureCharPx(ch, fontPx, weight);   // 実グリフ advance width
    if (lineW + w > maxWidthPx && line.length > 0) {
      // 行頭禁則: 次の文字が行頭回避対象なら現在行に入れてから折る
      if (LINE_HEAD_AVOID.has(ch)) {
        line += ch; lineW += w;
        out.push(line); line = ''; lineW = 0;
        continue;
      }
      out.push(line); line = ch; lineW = w;
    } else {
      line += ch; lineW += w;
    }
  }
  if (line.length > 0) out.push(line);
  return out;
}

// ── XML エスケープ（SVG は XML） ──────────────
function xmlEscape(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ── 数値を決定的に整形（小数は 2 桁固定・-0 を潰す） ──────────────
function n(v) {
  var x = Math.round(Number(v) * 100) / 100;
  if (Object.is(x, -0)) x = 0;
  return String(x);
}

// ── 1行を <path> にする（baseline 基準・anchor は実幅で自前計算） ──────────────
//   anchor: 'start' | 'middle' | 'end'（<path> に text-anchor は無いため x を算出する）
function linePath(line, opts) {
  var fontPx = opts.fontPx, weight = opts.weight, fill = opts.fill;
  var anchor = opts.anchor || 'start';
  var baselineY = opts.baselineY;
  var x = opts.x;
  if (anchor === 'middle' || anchor === 'end') {
    var w = F.measureTextPx(line, fontPx, weight);
    x = (anchor === 'middle') ? (x - w / 2) : (x - w);
  }
  var d = F.textToPathData(line, x, baselineY, fontPx, weight);   // missing glyph はここで throw
  if (!d) return '';
  return '<path d="' + d + '" fill="' + fill + '"/>';
}

// ── 複数行ブロック（Output Draft 本文はここで改変しない） ──────────────
//   blockTop から lineHeight 刻みで baseline を計算する。
//   baseline = 行の上端 + ascender比 × fontPx（carouselFont.ascenderRatio を明示利用）。
function textBlockPaths(lines, opts) {
  var fontPx = opts.fontPx, lineHeight = opts.lineHeight, weight = opts.weight;
  var asc = F.ascenderRatio(weight);
  var lh = fontPx * lineHeight;
  var parts = [];
  for (var i = 0; i < lines.length; i++) {
    var lineTop = opts.blockTop + i * lh;
    var baselineY = lineTop + asc * fontPx;
    var p = linePath(lines[i], {
      x: opts.x, baselineY: baselineY, fontPx: fontPx,
      weight: weight, fill: opts.fill, anchor: opts.anchor,
    });
    if (p) parts.push(p);
  }
  // data-text: 描画には影響しない検証用属性（Output Draft 本文の同一性をテストで確認するため）
  return '<g data-role="' + xmlEscape(opts.role || 'text') + '" data-weight="' + weight
    + '" data-text="' + xmlEscape(lines.join('')) + '">' + parts.join('') + '</g>';
}

// ── メイン: 1 スライドの overlay SVG（背景は透過。合成側で背景 PNG の上に重ねる想定） ──
//   slide: { slideIndex, slideId, headline, body, layout }
//   layout（Design System 由来・任意）: { badgeNumber, isCta, ctaText }
function renderSlideOverlaySvg(slide, ctx) {
  ctx = ctx || {};
  var total = ctx.totalSlides || 7;
  var idx = slide.slideIndex;
  var theme = slideTheme(idx, total);

  var contentLeft = SAFE.left;
  var contentRight = CANVAS.width - SAFE.right;
  var contentWidth = contentRight - contentLeft;
  var contentTop = SAFE.top;
  var contentBottom = CANVAS.height - SAFE.bottom;

  var headline = String(slide.headline == null ? '' : slide.headline);
  var body = String(slide.body == null ? '' : slide.body);
  var layout = slide.layout || {};
  var isCta = !!layout.isCta;
  var ctaText = isCta && layout.ctaText ? String(layout.ctaText) : '';

  // fail-closed: 描画前に glyph 被覆を検証（missing があればここで throw）
  if (headline) F.assertGlyphCoverage(headline, WEIGHT.title);
  if (body) F.assertGlyphCoverage(body, WEIGHT.body);
  if (ctaText) F.assertGlyphCoverage(ctaText, WEIGHT.cta);

  var parts = [];

  // 番号バッジ（本文 slide のみ・見出しの「N.」に一致する数字を使う。①②③ は使わない）
  var badgeNum = layout.badgeNumber != null ? String(layout.badgeNumber) : null;
  var badgeBottom = contentTop;
  if (badgeNum) {
    F.assertGlyphCoverage(badgeNum, WEIGHT.badge);
    var bSize = 88;
    // 枠（装飾図形はそのまま rect）
    parts.push('<rect x="' + n(contentLeft) + '" y="' + n(contentTop) + '" width="' + bSize + '" height="' + bSize + '" '
      + 'rx="8" fill="none" stroke="' + theme.accent + '" stroke-width="3"/>');
    // 数字は path（中央寄せ・baseline は em box 中心へ寄せる）
    var bw = F.measureTextPx(badgeNum, TYPO.badgePx, WEIGHT.badge);
    var bx = contentLeft + bSize / 2 - bw / 2;
    var by = contentTop + bSize / 2 + TYPO.badgePx * 0.36;
    parts.push('<g data-role="badge" data-weight="' + WEIGHT.badge + '" data-text="' + xmlEscape(badgeNum) + '">'
      + '<path d="' + F.textToPathData(badgeNum, bx, by, TYPO.badgePx, WEIGHT.badge) + '" fill="' + theme.text + '"/></g>');
    badgeBottom = contentTop + bSize + 24;
  }

  var isCoverCenter = (idx === 1);

  var headLines = wrapText(headline, contentWidth, TYPO.titlePx, WEIGHT.title);
  var bodyLines = wrapText(body, contentWidth, TYPO.bodyPx, WEIGHT.body);

  var headBlockH = headLines.length * TYPO.titlePx * TYPO.titleLineHeight;
  var bodyBlockH = bodyLines.length * TYPO.bodyPx * TYPO.bodyLineHeight;
  var gap = 40;

  var anchor = 'start';
  var textX = contentLeft;
  var startY;

  if (isCoverCenter || isCta) {
    // 中央寄せ（S1 表紙 / S7 まとめ）
    anchor = 'middle';
    textX = CANVAS.width / 2;
    var totalH = headBlockH + gap + bodyBlockH + (isCta ? (gap + TYPO.ctaPx * 1.6) : 0);
    startY = contentTop + Math.max(0, (contentBottom - contentTop - totalH) / 2);
  } else {
    startY = Math.max(badgeBottom, contentTop);
  }

  if (headLines.length) {
    parts.push(textBlockPaths(headLines, {
      x: textX, blockTop: startY, fontPx: TYPO.titlePx, lineHeight: TYPO.titleLineHeight,
      anchor: anchor, weight: WEIGHT.title, fill: theme.text, role: 'headline',
    }));
  }

  var bodyY = startY + headBlockH + gap;
  if (bodyLines.length) {
    parts.push(textBlockPaths(bodyLines, {
      x: textX, blockTop: bodyY, fontPx: TYPO.bodyPx, lineHeight: TYPO.bodyLineHeight,
      anchor: anchor, weight: WEIGHT.body, fill: theme.text, role: 'body',
    }));
  }

  // CTA（S7 のみ・下線様式）
  if (isCta && ctaText) {
    var ctaLines = wrapText(ctaText, contentWidth, TYPO.ctaPx, WEIGHT.cta);
    var ctaY = bodyY + bodyBlockH + gap;
    parts.push(textBlockPaths(ctaLines, {
      x: textX, blockTop: ctaY, fontPx: TYPO.ctaPx, lineHeight: 1.6,
      anchor: anchor, weight: WEIGHT.cta, fill: theme.text, role: 'cta',
    }));
    // 下線（1 行目の実幅・装飾図形なので rect のまま）
    var ulW = F.measureTextPx(ctaLines[0] || '', TYPO.ctaPx, WEIGHT.cta);
    var ulX = anchor === 'middle' ? (textX - ulW / 2) : textX;
    var ulY = ctaY + F.ascenderRatio(WEIGHT.cta) * TYPO.ctaPx + TYPO.ctaPx * 0.18;
    parts.push('<rect x="' + n(ulX) + '" y="' + n(ulY) + '" width="' + n(ulW) + '" height="3" fill="' + theme.text + '"/>');
  }

  // ページ番号（右下・全 slide 統一位置）
  var pageLabel = String(idx) + ' / ' + String(total);
  F.assertGlyphCoverage(pageLabel, WEIGHT.pageNum);
  var pw = F.measureTextPx(pageLabel, TYPO.pageNumPx, WEIGHT.pageNum);
  parts.push('<g data-role="pageNumber" data-weight="' + WEIGHT.pageNum + '" data-text="' + xmlEscape(pageLabel) + '">'
    + '<path d="' + F.textToPathData(pageLabel, contentRight - pw, contentBottom + 8, TYPO.pageNumPx, WEIGHT.pageNum)
    + '" fill="' + theme.text + '"/></g>');

  var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="' + CANVAS.width + '" height="' + CANVAS.height + '" '
    + 'viewBox="0 0 ' + CANVAS.width + ' ' + CANVAS.height + '">'
    + parts.join('')
    + '</svg>';
  return svg;
}

// ── デバッグ用: 背景無しの完全 SVG（薄いプレースホルダ背景付き。合成テスト用） ──
function renderSlideStandaloneSvg(slide, ctx) {
  var total = (ctx && ctx.totalSlides) || 7;
  var theme = slideTheme(slide.slideIndex, total);
  var overlay = renderSlideOverlaySvg(slide, ctx);
  var inner = overlay.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + CANVAS.width + '" height="' + CANVAS.height + '" '
    + 'viewBox="0 0 ' + CANVAS.width + ' ' + CANVAS.height + '">'
    + '<rect width="' + CANVAS.width + '" height="' + CANVAS.height + '" fill="' + theme.bg + '"/>'
    + inner + '</svg>';
}

module.exports = {
  CANVAS: CANVAS,
  SAFE: SAFE,
  TYPO: TYPO,
  WEIGHT: WEIGHT,
  slideTheme: slideTheme,
  wrapText: wrapText,
  xmlEscape: xmlEscape,
  renderSlideOverlaySvg: renderSlideOverlaySvg,
  renderSlideStandaloneSvg: renderSlideStandaloneSvg,
};
