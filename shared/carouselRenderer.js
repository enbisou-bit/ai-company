'use strict';
// shared/carouselRenderer.js
// Instagram Carousel Image Production — C案 Phase 1 Core: deterministic 日本語 overlay renderer。
//
//   責務: 承認済み Output Draft の headline / body（正本 fields.slides から取得済みの値）と
//         Design System 由来のレイアウト指定だけを入力に、1080×1350（4:5）の SVG overlay を
//         「同一入力 → 同一 SVG（byte 一致）」で生成する純関数。
//
//   非責務:
//     - 画像 API 呼び出し（lib/carouselImageClient.js）
//     - 背景 PNG との合成 / ラスタライズ（lib/carouselCompositor.js・sharp）
//     - DB / filesystem / network I/O 一切なし
//     - headline / body の生成・改変（呼び出し側が fields.slides から渡す・ここでは受け取るだけ）
//
//   font: SVG は font-family="'Noto Sans JP', sans-serif" を参照するのみ。実フォント WOFF の
//         base64 埋め込み（真の pixel deterministic 化）は Phase 2（フォント資産取得後）。
//   line wrapping: フォントメトリクス非依存の固定幅ヒューリスティック（CJK=1.0em / ASCII可視=0.5em /
//         空白=0.33em）で決定的に改行する。pixel 完全一致ではないが「同一入力→同一改行」を保証。

// ── キャンバス / セーフエリア（4:5 = 1080×1350 固定） ──────────────
var CANVAS = { width: 1080, height: 1350, ratio: '4:5' };
var SAFE = { top: 160, bottom: 160, left: 96, right: 96 };

// ── Design System（Minimal テンプレート）由来の基準値。4:5 キャンバスへスケール済み ──
//   出典: instagramDesignSystem template（titleSize 40 / bodySize 22 / margin 44 / padding 28 /
//   cornerRadius 8 / accentColor #111111 / backgroundColor #FFFFFF / fontFamily 'Noto Sans JP'）。
var TYPO = {
  fontFamily: "'Noto Sans JP', 'Hiragino Sans', 'Yu Gothic', sans-serif",
  titlePx: 72,   // 40px 基準 → 1080幅で 72
  bodyPx: 36,    // 22px 基準 → 見出しの 50%
  pageNumPx: 24,
  badgePx: 40,
  ctaPx: 34,
  titleWeight: 700,
  bodyWeight: 400,
  titleLineHeight: 1.3,
  bodyLineHeight: 1.6,
};

// ── slide ごとの配色（S1 / S7 は dark、他は light） ──────────────
function slideTheme(slideIndex, totalSlides) {
  var isDark = (slideIndex === 1) || (slideIndex === totalSlides);
  return isDark
    ? { bg: '#111111', text: '#FFFFFF', accent: '#FFFFFF', mode: 'dark' }
    : { bg: '#FFFFFF', text: '#111111', accent: '#111111', mode: 'light' };
}

// ── 決定的な文字幅（em 単位） ──────────────
function charWidthEm(ch) {
  var code = ch.codePointAt(0);
  if (ch === ' ' || ch === '　') return ch === '　' ? 1.0 : 0.33;
  // ASCII 可視 + Latin-1
  if (code >= 0x20 && code <= 0x24F) return 0.55;
  // 半角カナ
  if (code >= 0xFF61 && code <= 0xFF9F) return 0.55;
  // それ以外（ひらがな・カタカナ・漢字・全角記号・絵文字近似）は全角扱い
  return 1.0;
}

// ── 決定的な line wrapping（maxWidthPx / fontPx から最大 em 幅を出し、文字単位で折る） ──
//   日本語は分かち書きがないため文字単位で折る（禁則処理は簡易: 行頭に来ると不自然な記号のみ前行へ寄せる）。
var LINE_HEAD_AVOID = new Set(['、', '。', '，', '．', '）', '」', '』', '】', '〕', '！', '？', '・', 'ー']);

function wrapText(text, maxWidthPx, fontPx) {
  var out = [];
  if (text == null) return out;
  var maxEm = maxWidthPx / fontPx;
  var chars = Array.from(String(text));
  var line = '';
  var lineEm = 0;
  for (var i = 0; i < chars.length; i++) {
    var ch = chars[i];
    if (ch === '\n') { out.push(line); line = ''; lineEm = 0; continue; }
    var w = charWidthEm(ch);
    if (lineEm + w > maxEm && line.length > 0) {
      // 行頭禁則: 次の文字が行頭回避対象なら現在行に無理に入れる
      if (LINE_HEAD_AVOID.has(ch)) {
        line += ch; lineEm += w;
        out.push(line); line = ''; lineEm = 0;
        continue;
      }
      out.push(line); line = ch; lineEm = w;
    } else {
      line += ch; lineEm += w;
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

// ── <text> ブロック（複数行・tspan） ──────────────
function textBlock(lines, opts) {
  var x = opts.x, yStart = opts.y, fontPx = opts.fontPx, lineHeight = opts.lineHeight;
  var anchor = opts.anchor || 'start';
  var weight = opts.weight || 400;
  var fill = opts.fill;
  var lh = fontPx * lineHeight;
  var tspans = lines.map(function (ln, i) {
    return '<tspan x="' + n(x) + '" dy="' + (i === 0 ? '0' : n(lh)) + '">' + xmlEscape(ln) + '</tspan>';
  }).join('');
  return '<text x="' + n(x) + '" y="' + n(yStart + fontPx) + '" '
    + 'font-family="' + xmlEscape(TYPO.fontFamily) + '" '
    + 'font-size="' + n(fontPx) + '" font-weight="' + weight + '" '
    + 'fill="' + fill + '" text-anchor="' + anchor + '" '
    + 'xml:space="preserve">' + tspans + '</text>';
}

// ── メイン: 1 スライドの overlay SVG（背景は透過。合成側で背景 PNG の上に重ねる想定） ──
//   slide: { slideIndex, slideId, headline, body, role, layout }
//   layout（Design System 由来・任意）: { textPosition, badgeNumber, isCta, ctaText }
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

  var parts = [];

  // 番号バッジ（本文 slide のみ・見出しの「N.」に一致する数字を使う。①②③ は使わない）
  var badgeNum = slide.layout && slide.layout.badgeNumber != null ? String(slide.layout.badgeNumber) : null;
  var badgeBottom = contentTop;
  if (badgeNum) {
    var bSize = 88;
    parts.push('<rect x="' + n(contentLeft) + '" y="' + n(contentTop) + '" width="' + bSize + '" height="' + bSize + '" '
      + 'rx="8" fill="none" stroke="' + theme.accent + '" stroke-width="3"/>');
    parts.push('<text x="' + n(contentLeft + bSize / 2) + '" y="' + n(contentTop + bSize / 2 + TYPO.badgePx * 0.36) + '" '
      + 'font-family="' + xmlEscape(TYPO.fontFamily) + '" font-size="' + n(TYPO.badgePx) + '" font-weight="700" '
      + 'fill="' + theme.text + '" text-anchor="middle">' + xmlEscape(badgeNum) + '</text>');
    badgeBottom = contentTop + bSize + 24;
  }

  // 見出し / 本文の配置基準 y
  var isCta = !!(slide.layout && slide.layout.isCta);
  var isCoverCenter = (idx === 1);

  var headLines = wrapText(slide.headline, contentWidth, TYPO.titlePx);
  var bodyLines = wrapText(slide.body, contentWidth, TYPO.bodyPx);

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

  parts.push(textBlock(headLines, {
    x: textX, y: startY, fontPx: TYPO.titlePx, lineHeight: TYPO.titleLineHeight,
    anchor: anchor, weight: TYPO.titleWeight, fill: theme.text,
  }));

  var bodyY = startY + headBlockH + gap;
  if (bodyLines.length) {
    parts.push(textBlock(bodyLines, {
      x: textX, y: bodyY, fontPx: TYPO.bodyPx, lineHeight: TYPO.bodyLineHeight,
      anchor: anchor, weight: TYPO.bodyWeight, fill: theme.text,
    }));
  }

  // CTA（S7 のみ・下線様式）
  if (isCta && slide.layout && slide.layout.ctaText) {
    var ctaLines = wrapText(slide.layout.ctaText, contentWidth, TYPO.ctaPx);
    var ctaY = bodyY + bodyBlockH + gap;
    parts.push(textBlock(ctaLines, {
      x: textX, y: ctaY, fontPx: TYPO.ctaPx, lineHeight: 1.6,
      anchor: anchor, weight: 700, fill: theme.text,
    }));
    // 下線（1 行目相当の幅の概算）
    var ulEm = 0;
    Array.from(ctaLines[0] || '').forEach(function (c) { ulEm += charWidthEm(c); });
    var ulW = ulEm * TYPO.ctaPx;
    var ulX = anchor === 'middle' ? (textX - ulW / 2) : textX;
    parts.push('<rect x="' + n(ulX) + '" y="' + n(ctaY + TYPO.ctaPx * 1.35) + '" width="' + n(ulW) + '" height="3" fill="' + theme.text + '"/>');
  }

  // ページ番号（右下・全 slide 統一位置）
  parts.push('<text x="' + n(contentRight) + '" y="' + n(contentBottom + 8) + '" '
    + 'font-family="' + xmlEscape(TYPO.fontFamily) + '" font-size="' + n(TYPO.pageNumPx) + '" font-weight="400" '
    + 'fill="' + theme.text + '" text-anchor="end">' + n(idx) + ' / ' + n(total) + '</text>');

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
  slideTheme: slideTheme,
  charWidthEm: charWidthEm,
  wrapText: wrapText,
  xmlEscape: xmlEscape,
  renderSlideOverlaySvg: renderSlideOverlaySvg,
  renderSlideStandaloneSvg: renderSlideStandaloneSvg,
};
