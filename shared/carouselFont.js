'use strict';
// shared/carouselFont.js
// Instagram Carousel Image Production — Phase 2-B: 日本語 deterministic path 化のフォント層。
//
//   目的: system font 依存を完全に排除する。SVG に font-family を書かず、
//         同梱フォントの glyph outline から SVG <path> を生成することで、
//         Windows / Render Linux のどちらでも同一の描画結果を得る。
//
//   責務:
//     - 同梱フォント（assets/fonts/NotoSansJP-{Regular,Bold}.otf）の読み込み・キャッシュ
//     - text → SVG path data（deterministic）
//     - text の実グリフ幅計測（改行計算をフォントメトリクス基準にする）
//     - missing glyph 検出と fail-closed 停止
//
//   非責務: レイアウト決定（shared/carouselRenderer.js）・合成（lib/carouselCompositor.js）・
//           ファイル書き込み・network I/O。読み込みは同梱 asset の readFileSync のみ。
//
//   fail-closed 方針:
//     - 未対応 weight は暗黙 fallback せず throw（unsupported_weight）
//     - missing glyph が1件でもあれば path を生成せず throw（missing_glyph）
//       → .notdef / 豆腐 / 空白のまま「正常」として先へ進めない
//     - エラーには raw 本文を載せない（件数と先頭数件の U+XXXX のみ）
//
//   security: フォントパスは固定 asset のみ。呼び出し側から任意パスを指定できない
//             （weight は enum でのみ受け付け、FONT_FILES の値だけを path.join へ渡す）。

var fs = require('fs');
var path = require('path');
var opentype = require('opentype.js');

// ── 固定 asset パス（user input からは一切組み立てない） ──────────────
var FONT_DIR = path.join(__dirname, '..', 'assets', 'fonts');
var FONT_FILES = Object.freeze({
  regular: 'NotoSansJP-Regular.otf',
  bold: 'NotoSansJP-Bold.otf',
});
var FONT_FAMILY_EXPECTED = 'Noto Sans JP';

// 許可する weight は enum のみ。エイリアスも明示列挙し、それ以外は throw（fail-closed）。
var SUPPORTED_WEIGHTS = Object.freeze(['regular', 'bold']);
var WEIGHT_ALIASES = Object.freeze({
  regular: 'regular', normal: 'regular', '400': 'regular',
  bold: 'bold', '700': 'bold',
});

// path data の座標精度（固定＝deterministic）
var PATH_PRECISION = 2;

var _cache = Object.create(null);

// ── エラー: code と最小限の detail のみ。raw 本文は絶対に載せない ──────────────
function CarouselFontError(code, detail) {
  var e = new Error('carouselFont: ' + code);
  e.name = 'CarouselFontError';
  e.code = code;
  e.detail = detail || {};
  return e;
}

// code point 表現（raw 文字そのものではなく U+XXXX で扱う＝本文露出を最小化）
function _cp(ch) {
  return 'U+' + ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
}

// ── weight 正規化（未対応は fail-closed） ──────────────
function normalizeWeight(weight) {
  if (weight === undefined || weight === null || weight === '') {
    throw CarouselFontError('unsupported_weight', { received: '(missing)' });
  }
  var key = String(weight).toLowerCase().trim();
  if (!Object.prototype.hasOwnProperty.call(WEIGHT_ALIASES, key)) {
    // 受け取った値は先頭16文字までに切り詰めて記録（本文流入の防止）
    throw CarouselFontError('unsupported_weight', { received: key.slice(0, 16) });
  }
  return WEIGHT_ALIASES[key];
}

function fontPathFor(weight) {
  var w = normalizeWeight(weight);
  // FONT_FILES の値のみを使う（外部由来の文字列を path.join へ渡さない）
  return path.join(FONT_DIR, FONT_FILES[w]);
}

// ── フォント読み込み（同期・プロセス内キャッシュ） ──────────────
function getFont(weight) {
  var w = normalizeWeight(weight);
  if (_cache[w]) return _cache[w];
  var p = fontPathFor(w);
  var buf = fs.readFileSync(p);
  // Buffer → ArrayBuffer（opentype.parse は ArrayBuffer を要求）
  var ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  var font = opentype.parse(ab);
  _cache[w] = font;
  return font;
}

function isFontAvailable(weight) {
  try { getFont(weight); return true; } catch (e) { return false; }
}

// フォントのメタ情報（報告・テスト用）
function fontInfo(weight) {
  var w = normalizeWeight(weight);
  var f = getFont(w);
  var n = (f.names && (f.names.windows || f.names.macintosh || f.names.unicode)) || {};
  var pick = function (k) { var v = n[k]; return v ? (v.en || Object.values(v)[0]) : null; };
  return {
    weight: w,
    family: pick('fontFamily'),
    subfamily: pick('fontSubfamily'),
    version: pick('version'),
    unitsPerEm: f.unitsPerEm,
    numGlyphs: f.numGlyphs,
    outlinesFormat: f.outlinesFormat,
  };
}

// ── missing glyph 検出 ──────────────
//   内部 API として不足文字そのものを返す（呼び出し側の判断材料）。
//   ただしエラー・ログへ載せるのは件数と先頭数件の U+XXXX のみ（assertGlyphCoverage 参照）。
function findMissingGlyphs(text, weight) {
  var w = normalizeWeight(weight);
  var f = getFont(w);
  var seen = Object.create(null);
  var missing = [];
  var chars = Array.from(String(text == null ? '' : text));
  for (var i = 0; i < chars.length; i++) {
    var ch = chars[i];
    if (ch === '\n' || ch === '\r') continue;
    if (seen[ch]) continue;
    seen[ch] = true;
    var g = f.charToGlyph(ch);
    if (!g || g.index === 0) missing.push(ch);
  }
  return missing;
}

// glyph 被覆の事前検証。missing が1件でもあれば throw（.notdef/豆腐/空白のまま進めない）。
function assertGlyphCoverage(text, weight) {
  var w = normalizeWeight(weight);
  var missing = findMissingGlyphs(text, w);
  if (missing.length > 0) {
    throw CarouselFontError('missing_glyph', {
      weight: w,
      missingCount: missing.length,                 // 件数
      missingSample: missing.slice(0, 5).map(_cp),  // 先頭5件のみ U+XXXX
    });
  }
  return true;
}

// ── 実グリフ幅（px） ──────────────
function measureTextPx(text, fontSizePx, weight) {
  var w = normalizeWeight(weight);
  var f = getFont(w);
  return f.getAdvanceWidth(String(text == null ? '' : text), Number(fontSizePx));
}

// 1文字の幅（px）。改行計算で使用。
function measureCharPx(ch, fontSizePx, weight) {
  return measureTextPx(ch, fontSizePx, weight);
}

// ascender 比（baseline 位置の算出用）
function ascenderRatio(weight) {
  var w = normalizeWeight(weight);
  var f = getFont(w);
  return f.ascender / f.unitsPerEm;
}

// ── path command の座標フィールド（opentype.js の command 形状に対応） ──────────────
var PATH_COORD_KEYS = Object.freeze(['x', 'y', 'x1', 'y1', 'x2', 'y2']);

// ── path data 内で許可しない不正トークン（serializer 由来の破損検出用） ──────────────
//   ★ PA-16 実測: opentype.js 2.0.0 の roundDecimal() は
//     「小数部が指数表記になるほど微小（= ほぼ整数）」な座標に対して NaN を返し、
//     結果として文字列 "NaN" が d 属性へ混入する。
//     librsvg（sharp）は d の解析を NaN の時点で中断し、**以降のグリフを無警告で描画しない**。
//     すなわち従来は「エラーにならず視覚的にだけ壊れる」fail-open だった。
var INVALID_PATH_TOKEN_RE = /NaN|Infinity|undefined|null/;

// ── F-1: 直列化前の座標量子化（PA-16 Option F-1） ──────────────
//   小数部を必ず 0.00〜0.99 の clean な値にすることで、roundDecimal() が
//   指数表記文字列を組み立てる経路（= NaN 生成の唯一の原因）を構造的に発生させない。
//   ★ 量子化は「壊れた値を直す」ためではない。非 finite 値は F-2 で先に fail-closed する。
//     finite input → quantize → serialize → validate の順序を守る。
function _quantizePathCommands(commands, places) {
  var factor = Math.pow(10, places);
  for (var i = 0; i < commands.length; i++) {
    var cmd = commands[i];
    for (var k = 0; k < PATH_COORD_KEYS.length; k++) {
      var key = PATH_COORD_KEYS[k];
      var v = cmd[key];
      if (v === undefined) continue;              // 該当 command type に無いフィールドは触らない
      if (typeof v !== 'number' || !Number.isFinite(v)) {
        // fail-closed: 量子化で誤魔化さず停止する（raw 本文は載せない）
        throw CarouselFontError('invalid_path_coordinate', {
          commandIndex: i,
          commandType: String(cmd.type || '(unknown)').slice(0, 4),
          field: key,
        });
      }
      cmd[key] = Math.round(v * factor) / factor;
    }
  }
  return commands;
}

// ── text → SVG path data ──────────────
//   x, y は baseline 基準（opentype.js の仕様）。deterministic：
//   同一 font / text / x / y / size で常に同一の d 文字列を返す。
//
//   fail-closed の 3 段構え:
//     1. missing glyph / unsupported weight（従来どおり）
//     2. F-2 pre-serialization : command 座標が非 finite なら throw
//     3. F-2 post-serialization: 生成された d に不正トークンが残っていれば throw
//        （serializer 側の将来的な回帰も含めて「壊れた画像を成功扱いしない」）
function textToPathData(text, x, y, fontSizePx, weight) {
  var w = normalizeWeight(weight);                 // fail-closed（未対応 weight）
  var s = String(text == null ? '' : text);
  assertGlyphCoverage(s, w);                       // fail-closed（missing glyph）
  var f = getFont(w);
  var p = f.getPath(s, Number(x), Number(y), Number(fontSizePx), { kerning: true });

  // F-1 + F-2(pre): 非 finite は throw、finite は精度 PATH_PRECISION へ量子化
  _quantizePathCommands(p.commands, PATH_PRECISION);

  var d = p.toPathData(PATH_PRECISION);

  // F-2(post): 直列化結果を防御的に検証する（NaN / Infinity / undefined / null）
  if (typeof d !== 'string' || INVALID_PATH_TOKEN_RE.test(d)) {
    var m = typeof d === 'string' ? d.match(INVALID_PATH_TOKEN_RE) : null;
    throw CarouselFontError('invalid_path_data', {
      weight: w,
      token: m ? m[0] : '(non-string)',            // 検出トークン名のみ（本文は載せない）
      length: typeof d === 'string' ? d.length : 0,
    });
  }
  return d;
}

module.exports = {
  FONT_DIR: FONT_DIR,
  FONT_FILES: FONT_FILES,
  FONT_FAMILY_EXPECTED: FONT_FAMILY_EXPECTED,
  SUPPORTED_WEIGHTS: SUPPORTED_WEIGHTS,
  PATH_PRECISION: PATH_PRECISION,
  CarouselFontError: CarouselFontError,
  normalizeWeight: normalizeWeight,
  fontPathFor: fontPathFor,
  getFont: getFont,
  isFontAvailable: isFontAvailable,
  fontInfo: fontInfo,
  findMissingGlyphs: findMissingGlyphs,
  assertGlyphCoverage: assertGlyphCoverage,
  measureTextPx: measureTextPx,
  measureCharPx: measureCharPx,
  ascenderRatio: ascenderRatio,
  textToPathData: textToPathData,
};
