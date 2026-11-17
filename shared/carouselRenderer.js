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
//   Decision 128（2026-11-07）：スマホでの読みやすさのため、見出し 72→76px・本文 36→46px（収まらない枚は 36px まで縮小）・
//   CTA 34→40px・本文の行間 1.6→1.45 に変更し、本文の項目の間・見出しと本文の間の余白を加えた。
var TYPO = {
  titlePx: 76,
  bodyPx: 46,    // 収まらないときは BODY_PX_MIN まで 2px ずつ小さくする
  pageNumPx: 24,
  badgePx: 40,
  ctaPx: 40,
  titleLineHeight: 1.3,
  bodyLineHeight: 1.45,
  ctaLineHeight: 1.5,
  itemGapPx: 26,   // 本文の項目（本文の 1 行）の間
  headGapPx: 76,   // 見出しと本文の間（間に見出しの下の線を置く）
  ctaGapPx: 48,    // 本文と CTA の間
};
var BODY_PX_MIN = 36;
var BADGE = { size: 88, gap: 24 };
var HEAD_RULE = { width: 72, height: 5, offset: 22 };
var CHECK_BOX = { size: 40, gap: 22 };
// Decision 130: 手順番号の印（丸の中の数字・本文の文字ではない）と、太字の範囲がある項目の折り返し幅の余裕
var STEP_MARK = { size: 52, gap: 22, numPx: 30, stroke: 3 };
var EMPHASIS_SLACK_PX = 28;

// weight は必ず明示する（carouselFont 側で未指定・未対応は throw）。
var WEIGHT = { title: 'bold', body: 'regular', badge: 'bold', pageNum: 'regular', cta: 'bold' };

// ── slide ごとの配色（S1 / S7 は dark、他は light） ──────────────
function slideTheme(slideIndex, totalSlides) {
  var isDark = (slideIndex === 1) || (slideIndex === totalSlides);
  return isDark
    ? { bg: '#111111', text: '#FFFFFF', accent: '#FFFFFF', mode: 'dark' }
    : { bg: '#FFFFFF', text: '#111111', accent: '#111111', mode: 'light' };
}

// ── F-3: dark theme 用 deterministic gradient scrim（PA-16 Option F-3） ──────────────
//   背景（AI写真）と文字の間へ敷く固定の暗幕。AI画像の解析・動的判断は一切行わない
//   （同一入力 → 同一 SVG を維持するため）。
//
//   PA-16 実測の問題: slideTheme() は S1 / 最終slide に text='#FFFFFF' を返すが、
//   theme.bg('#111111') を塗るのは debug 用 renderSlideStandaloneSvg() だけで、
//   本番 overlay は透過のまま。結果、白文字が明るいAI写真へ直接描かれ、
//   slide1 では背景平均輝度 235 / コントラスト約 1.2:1 となり判読困難だった。
//
//   SCRIM_PEAK_ALPHA=0.55 の根拠（最悪ケース = 純白 #FFFFFF 背景で計算）:
//     合成後の背景 = 255*(1-0.55) ≈ 114.75 → 相対輝度 ≈ 0.171
//     白文字とのコントラスト比 = (1.0+0.05)/(0.171+0.05) ≈ 4.76:1 → WCAG AA(4.5:1) を満たす。
//   端（0% / 100%）は 0.30 に留め、写真全体を必要以上に潰さない。
//   強い帯（12%〜88%）はコンテンツ領域（SAFE.top 160 〜 CANVAS.height-SAFE.bottom 1190）を覆う。
var SCRIM = Object.freeze({
  id: 'carouselDarkScrim',
  edgeAlpha: 0.3,
  peakAlpha: 0.55,
  peakStartPct: 12,
  peakEndPct: 88,
});

function darkScrimSvg() {
  return '<defs><linearGradient id="' + SCRIM.id + '" x1="0" y1="0" x2="0" y2="1">'
    + '<stop offset="0%" stop-color="#000000" stop-opacity="' + SCRIM.edgeAlpha + '"/>'
    + '<stop offset="' + SCRIM.peakStartPct + '%" stop-color="#000000" stop-opacity="' + SCRIM.peakAlpha + '"/>'
    + '<stop offset="' + SCRIM.peakEndPct + '%" stop-color="#000000" stop-opacity="' + SCRIM.peakAlpha + '"/>'
    + '<stop offset="100%" stop-color="#000000" stop-opacity="' + SCRIM.edgeAlpha + '"/>'
    + '</linearGradient></defs>'
    + '<rect data-role="scrim" x="0" y="0" width="' + CANVAS.width + '" height="' + CANVAS.height + '" '
    + 'fill="url(#' + SCRIM.id + ')"/>';
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

// ── Decision 130: 明示された太字の範囲だけを bold にして 1 行を描く（左寄せの本文のみ・文字の順序と内容は変えない） ──
//   ranges: [{ start, end }]（項目の先頭からの文字位置・呼び出し側で検査済み）。offset: この行の先頭が項目の何文字目か。
function emphasisLinePaths(line, offset, ranges, x, baselineY, fontPx, fill) {
  var chars = Array.from(line);
  var segs = [], cur = '', curB = null;
  for (var i = 0; i < chars.length; i++) {
    var pos = offset + i;
    var b = ranges.some(function (r) { return pos >= r.start && pos < r.end; });
    if (curB === null || b === curB) { cur += chars[i]; curB = b; } else { segs.push([cur, curB]); cur = chars[i]; curB = b; }
  }
  if (cur) segs.push([cur, curB]);
  var xx = x, parts = [];
  for (var s = 0; s < segs.length; s++) {
    var w = segs[s][1] ? 'bold' : WEIGHT.body;
    var d = F.textToPathData(segs[s][0], xx, baselineY, fontPx, w);
    if (d) parts.push('<path d="' + d + '" fill="' + fill + '"' + (segs[s][1] ? ' data-emphasis="1"' : '') + '/>');
    xx += F.measureTextPx(segs[s][0], fontPx, w);
  }
  return parts.join('');
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

// ── 読みやすい改行（Decision 128・2026-11-07） ──────────────
//   1 行に収まらない文は、読点・句点の後か助詞の後で折る。2 行で収まる文は 2 行の長さが近くなる位置、
//   それより長い文は行をなるべく埋める位置（幅の 6 割以上）を選ぶ。末尾が 1〜2 文字だけの行は作らない。
//   候補が無いときだけ既存の文字単位の折り返し（wrapText）を使う。どの場合も文字の順序・内容は変えない。
var BREAK_PARTICLES = new Set(['は', 'を', 'に', 'で', 'と', 'が', 'も', 'や', 'へ']);
var BREAK_HEAD_AVOID = new Set(['、', '。', '，', '．', '）', '」', '』', '】', '〕', '！', '？', '・', 'ー',
  'ぁ', 'ぃ', 'ぅ', 'ぇ', 'ぉ', 'っ', 'ゃ', 'ゅ', 'ょ', 'ァ', 'ィ', 'ゥ', 'ェ', 'ォ', 'ッ', 'ャ', 'ュ', 'ョ']);
var MIN_TAIL_CHARS = 3;

function smartWrap(text, maxWidthPx, fontPx, weight) {
  var s = String(text == null ? '' : text);
  if (s === '') return [];
  if (F.measureTextPx(s, fontPx, weight) <= maxWidthPx) return [s];
  var chars = Array.from(s);
  var cands = [];
  for (var i = 1; i <= chars.length - MIN_TAIL_CHARS; i++) {
    var prev = chars[i - 1], next = chars[i];
    if (BREAK_HEAD_AVOID.has(next)) continue;
    var head = chars.slice(0, i).join('');
    var headW = F.measureTextPx(head, fontPx, weight);
    if (headW > maxWidthPx) break;
    var score = (prev === '、' || prev === '。') ? 0 : ((BREAK_PARTICLES.has(prev) && !BREAK_PARTICLES.has(next)) ? 1 : null);
    if (score === null) continue;
    var tail = chars.slice(i).join('');
    var tailW = F.measureTextPx(tail, fontPx, weight);
    cands.push({ score: score, head: head, tail: tail, headW: headW, tailW: tailW, diff: Math.abs(headW - tailW) });
  }
  var best = null;
  if (F.measureTextPx(s, fontPx, weight) <= 2 * maxWidthPx) {
    var fit = cands.filter(function (c) { return c.tailW <= maxWidthPx; });
    fit.sort(function (a, b) { return a.score - b.score || a.diff - b.diff; });
    best = fit[0] || null;
  }
  if (!best) {
    var full = cands.filter(function (c) { return c.headW >= 0.6 * maxWidthPx; });
    var pool = full.length ? full : cands;
    pool.sort(function (a, b) { return a.score - b.score || b.headW - a.headW; });
    best = pool[0] || null;
  }
  if (!best) {
    var lines = wrapText(s, maxWidthPx, fontPx, weight);
    if (lines.length >= 2 && Array.from(lines[lines.length - 1]).length < MIN_TAIL_CHARS) {
      var both = Array.from(lines[lines.length - 2] + lines[lines.length - 1]);
      var mid = Math.ceil(both.length / 2);
      lines.splice(lines.length - 2, 2, both.slice(0, mid).join(''), both.slice(mid).join(''));
    }
    return lines;
  }
  return [best.head].concat(smartWrap(best.tail, maxWidthPx, fontPx, weight));
}

// ── 1 スライドの配置の計算（描画の前に、収まるかを判定する） ──────────────
//   本文は 46px から 2px ずつ 36px まで小さくして収まる大きさを探す。36px でも収まらなければ fits=false。
//   文字を省略・削除して収めることはしない。呼び出し側（planCarouselImageJob）は fits=false を有料生成の前に止める。
function measureSlideLayout(slide, ctx) {
  ctx = ctx || {};
  var total = ctx.totalSlides || 7;
  var idx = slide.slideIndex;
  var layout = slide.layout || {};
  var headline = String(slide.headline == null ? '' : slide.headline);
  var body = String(slide.body == null ? '' : slide.body);
  var isCta = !!layout.isCta;
  var isChecklist = layout.isChecklist === true;
  var ctaText = isCta && layout.ctaText ? String(layout.ctaText) : '';
  var badgeNum = layout.badgeNumber != null ? String(layout.badgeNumber) : null;
  var contentWidth = CANVAS.width - SAFE.left - SAFE.right;
  var available = CANVAS.height - SAFE.top - SAFE.bottom;
  // Decision 130: 手順番号（手順の枚だけ・呼び出し側で検査済み）と、明示された太字の範囲。指定が無ければ従来どおり。
  var stepMarkers = layout.stepMarkers === true && !isChecklist;
  var emphasis = Array.isArray(layout.emphasis) ? layout.emphasis : null;
  var itemWidth = contentWidth - (isChecklist ? CHECK_BOX.size + CHECK_BOX.gap : 0) - (stepMarkers ? STEP_MARK.size + STEP_MARK.gap : 0);
  var headLines = smartWrap(headline, contentWidth, TYPO.titlePx, WEIGHT.title);
  var ctaLines = ctaText ? smartWrap(ctaText, contentWidth, TYPO.ctaPx, WEIGHT.cta) : [];
  var sentences = body.split('\n').filter(function (x) { return x.length > 0; });
  var result = null;
  for (var px = TYPO.bodyPx; px >= BODY_PX_MIN; px -= 2) {
    var items = sentences.map(function (t, k) {
      // 太字は通常の文字より幅が広いので、太字の範囲がある項目は少し狭い幅で折る
      var hasEm = emphasis && Array.isArray(emphasis[k]) && emphasis[k].length > 0;
      return smartWrap(t, itemWidth - (hasEm ? EMPHASIS_SLACK_PX : 0), px, WEIGHT.body);
    });
    var lineCount = items.reduce(function (a, it) { return a + it.length; }, 0);
    var bodyH = lineCount * px * TYPO.bodyLineHeight + Math.max(0, items.length - 1) * TYPO.itemGapPx;
    var totalH = (badgeNum ? BADGE.size + BADGE.gap : 0)
      + headLines.length * TYPO.titlePx * TYPO.titleLineHeight
      + (items.length ? TYPO.headGapPx : 0) + bodyH
      + (ctaLines.length ? TYPO.ctaGapPx + ctaLines.length * TYPO.ctaPx * TYPO.ctaLineHeight : 0);
    result = { bodyPx: px, headLines: headLines, items: items, ctaLines: ctaLines, totalH: totalH, available: available,
      fits: totalH <= available, isCta: isCta, isChecklist: isChecklist, badgeNumber: badgeNum, slideIndex: idx, totalSlides: total };
    if (stepMarkers) result.stepMarkers = true;
    if (emphasis) result.emphasis = emphasis;
    if (result.fits) break;
  }
  return result;
}

// ── メイン: 1 スライドの overlay SVG（背景は透過。合成側で背景 PNG の上に重ねる想定） ──
//   slide: { slideIndex, slideId, headline, body, layout }
//   layout（Design System 由来・任意）: { badgeNumber, isCta, ctaText, isChecklist }
//   配置：表紙と最後の枚は中央寄せで縦の中央。チェックリストの枚（isChecklist）は左寄せ・枠付きで縦の中央。
//         それ以外は従来どおり左上から（写真の被写体は中央からずらす指示で作るため、本文の枚の位置は変えない）。
function renderSlideOverlaySvg(slide, ctx) {
  ctx = ctx || {};
  var total = ctx.totalSlides || 7;
  var idx = slide.slideIndex;
  var theme = slideTheme(idx, total);

  var contentLeft = SAFE.left;
  var contentRight = CANVAS.width - SAFE.right;
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

  // 収まらない場合は描かずに止める（文字を欠落させた画像を作らない）
  var m = measureSlideLayout(slide, ctx);
  if (!m.fits) {
    var err = new Error('text_overflow: slide ' + idx);
    err.code = 'text_overflow';
    throw err;
  }

  var parts = [];

  // F-3: dark theme のみ、最背面（文字・バッジ・ページ番号より前）へ scrim を敷く。
  //   light theme（S2〜S6）は文字が #111111 で明るい背景と十分なコントラストを持つため適用しない。
  if (theme.mode === 'dark') {
    parts.push(darkScrimSvg());
  }

  // Decision 131：手順番号のある最後の枚は左寄せ（中央寄せだと番号と本文が重なる）。CTA は中央のまま
  var centered = (idx === 1) || (isCta && !m.isChecklist && !m.stepMarkers);
  var anchor = centered ? 'middle' : 'start';
  var textX = centered ? CANVAS.width / 2 : contentLeft;
  var startY = (centered || m.isChecklist)
    ? contentTop + Math.max(0, (m.available - m.totalH) / 2)
    : contentTop;

  // 番号バッジ（本文 slide のみ・見出しの「N.」に一致する数字を使う。①②③ は使わない）
  if (m.badgeNumber) {
    F.assertGlyphCoverage(m.badgeNumber, WEIGHT.badge);
    var bSize = BADGE.size;
    var bLeft = centered ? CANVAS.width / 2 - bSize / 2 : contentLeft;
    parts.push('<rect x="' + n(bLeft) + '" y="' + n(startY) + '" width="' + bSize + '" height="' + bSize + '" '
      + 'rx="8" fill="none" stroke="' + theme.accent + '" stroke-width="3"/>');
    var bw = F.measureTextPx(m.badgeNumber, TYPO.badgePx, WEIGHT.badge);
    var bx = bLeft + bSize / 2 - bw / 2;
    var by = startY + bSize / 2 + TYPO.badgePx * 0.36;
    parts.push('<g data-role="badge" data-weight="' + WEIGHT.badge + '" data-text="' + xmlEscape(m.badgeNumber) + '">'
      + '<path d="' + F.textToPathData(m.badgeNumber, bx, by, TYPO.badgePx, WEIGHT.badge) + '" fill="' + theme.text + '"/></g>');
    startY += bSize + BADGE.gap;
  }

  // 見出し
  if (m.headLines.length) {
    parts.push(textBlockPaths(m.headLines, {
      x: textX, blockTop: startY, fontPx: TYPO.titlePx, lineHeight: TYPO.titleLineHeight,
      anchor: anchor, weight: WEIGHT.title, fill: theme.text, role: 'headline',
    }));
  }
  var headBottom = startY + m.headLines.length * TYPO.titlePx * TYPO.titleLineHeight;

  // 見出しの下の短い線（見出しと本文の強弱。装飾図形なので rect）
  if (m.headLines.length && m.items.length) {
    var ruleX = centered ? CANVAS.width / 2 - HEAD_RULE.width / 2 : contentLeft;
    parts.push('<rect data-role="headRule" x="' + n(ruleX) + '" y="' + n(headBottom + HEAD_RULE.offset) + '" width="' + HEAD_RULE.width
      + '" height="' + HEAD_RULE.height + '" fill="' + theme.accent + '"/>');
  }

  // 本文（本文の 1 行 ＝ 1 項目。項目の間に余白。data-text は本文全体を保持する）
  var y = headBottom + (m.items.length ? TYPO.headGapPx : 0);
  var lh = m.bodyPx * TYPO.bodyLineHeight;
  var bodyParts = [];
  var itemX = m.isChecklist ? contentLeft + CHECK_BOX.size + CHECK_BOX.gap
    : (m.stepMarkers ? contentLeft + STEP_MARK.size + STEP_MARK.gap : textX);
  var asc = F.ascenderRatio(WEIGHT.body);
  for (var k = 0; k < m.items.length; k++) {
    if (m.isChecklist) {
      bodyParts.push('<rect data-role="checkBox" x="' + n(contentLeft) + '" y="' + n(y + (lh - CHECK_BOX.size) / 2) + '" width="' + CHECK_BOX.size
        + '" height="' + CHECK_BOX.size + '" rx="6" fill="none" stroke="' + theme.text + '" stroke-width="3"/>');
    }
    if (m.stepMarkers) {
      // 手順番号：手順の枚の項目の順序から付ける印（本文の文字ではない・本文の数字の検査とは別）
      var num = String(k + 1);
      F.assertGlyphCoverage(num, WEIGHT.badge);
      var mcx = contentLeft + STEP_MARK.size / 2, mcy = y + lh / 2;
      var nw = F.measureTextPx(num, STEP_MARK.numPx, WEIGHT.badge);
      bodyParts.push('<g data-role="stepMarker" data-text="' + num + '"><circle cx="' + n(mcx) + '" cy="' + n(mcy) + '" r="' + n(STEP_MARK.size / 2)
        + '" fill="none" stroke="' + theme.text + '" stroke-width="' + STEP_MARK.stroke + '"/>'
        + '<path d="' + F.textToPathData(num, mcx - nw / 2, mcy + STEP_MARK.numPx * 0.36, STEP_MARK.numPx, WEIGHT.badge) + '" fill="' + theme.text + '"/></g>');
    }
    var ranges = m.emphasis && Array.isArray(m.emphasis[k]) ? m.emphasis[k] : null;
    var offset = 0;
    for (var j = 0; j < m.items[k].length; j++) {
      var baseY = y + j * lh + asc * m.bodyPx;
      if (ranges && ranges.length && anchor === 'start') {
        bodyParts.push(emphasisLinePaths(m.items[k][j], offset, ranges, itemX, baseY, m.bodyPx, theme.text));
      } else {
        var p = linePath(m.items[k][j], { x: itemX, baselineY: baseY, fontPx: m.bodyPx, weight: WEIGHT.body, fill: theme.text, anchor: anchor });
        if (p) bodyParts.push(p);
      }
      offset += Array.from(m.items[k][j]).length;
    }
    y += m.items[k].length * lh + TYPO.itemGapPx;
  }
  if (bodyParts.length) {
    parts.push('<g data-role="body" data-weight="' + WEIGHT.body + '" data-body-px="' + m.bodyPx + '" data-text="'
      + xmlEscape(body.split('\n').join('')) + '">' + bodyParts.join('') + '</g>');
  }
  var bodyBottom = m.items.length ? y - TYPO.itemGapPx : headBottom;

  // CTA（最後の枚のみ・下線様式）
  if (m.ctaLines.length) {
    var ctaY = bodyBottom + TYPO.ctaGapPx;
    parts.push(textBlockPaths(m.ctaLines, {
      x: CANVAS.width / 2, blockTop: ctaY, fontPx: TYPO.ctaPx, lineHeight: TYPO.ctaLineHeight,
      anchor: 'middle', weight: WEIGHT.cta, fill: theme.text, role: 'cta',
    }));
    // 下線（1 行目の実幅・装飾図形なので rect のまま）
    var ulW = F.measureTextPx(m.ctaLines[0] || '', TYPO.ctaPx, WEIGHT.cta);
    var ulX = CANVAS.width / 2 - ulW / 2;
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
  smartWrap: smartWrap,
  measureSlideLayout: measureSlideLayout,
  BODY_PX_MIN: BODY_PX_MIN,
  STEP_MARK: STEP_MARK,
  EMPHASIS_SLACK_PX: EMPHASIS_SLACK_PX,
  xmlEscape: xmlEscape,
  renderSlideOverlaySvg: renderSlideOverlaySvg,
  renderSlideStandaloneSvg: renderSlideStandaloneSvg,
};
