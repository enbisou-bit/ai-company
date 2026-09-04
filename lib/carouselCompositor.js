'use strict';
// lib/carouselCompositor.js
// Instagram Carousel Image Production — C案 Phase 1: 背景 PNG + 日本語 overlay SVG → 完成 PNG。
//
//   合成には sharp（SVG ラスタライズ + composite）が必要。
//   ★ Phase 1: sharp は未インストール。lazy require し、無ければ graceful degradation:
//     { ok:false, reason:'sharp_unavailable', svg, backgroundPath } を返す（例外を投げない）。
//   sharp 導入はユーザー承認後（npm install を勝手に実行しない）。
//
//   path traversal 防止: 出力パスは呼び出し側が渡す固定パスのみを受け付け、
//   ".." やディレクトリ区切りの異常を拒否する。

var path = require('path');

var _sharp = undefined;   // undefined=未試行 / null=不在 / object=あり
function getSharp() {
  if (_sharp !== undefined) return _sharp;
  try { _sharp = require('sharp'); }
  catch (e) { _sharp = null; }
  return _sharp;
}

function isSharpAvailable() { return getSharp() !== null; }

// 出力ファイル名の安全性（slide-<n>.png / background-<n>.png / overlay-<n>.svg のみ許可）
var SAFE_NAME_RE = /^(slide|background|overlay)-([1-9]|1[0-9])\.(png|svg)$/;
function safeAssetName(name) {
  var base = path.basename(String(name || ''));
  return SAFE_NAME_RE.test(base) ? base : null;
}

// dir の安全性（generated/<caseId>/<outputId> 形式・.. 禁止）
var SAFE_DIR_RE = /^generated\/[a-zA-Z0-9_-]+\/[a-zA-Z0-9_-]+$/;
function safeDir(dir) {
  var d = String(dir || '').replace(/\\/g, '/').replace(/\/+$/, '');
  if (d.indexOf('..') !== -1) return null;
  return SAFE_DIR_RE.test(d) ? d : null;
}

// 合成（Phase 1: sharp 無ければ degrade）
//   input: { backgroundBuffer|backgroundPath, overlaySvg, width, height }
async function compositeSlide(input) {
  input = input || {};
  var width = Number(input.width) || 1080;
  var height = Number(input.height) || 1350;
  var overlaySvg = input.overlaySvg;

  if (!overlaySvg || typeof overlaySvg !== 'string') {
    return { ok: false, reason: 'missing_overlay_svg' };
  }

  var sharp = getSharp();
  if (!sharp) {
    return {
      ok: false,
      reason: 'sharp_unavailable',
      degraded: true,
      note: 'sharp 未導入。overlay SVG と背景を返すのみ（合成は Phase 2）。',
      overlaySvg: overlaySvg,
      backgroundPath: input.backgroundPath || null,
      width: width, height: height,
    };
  }

  try {
    var bg;
    if (input.backgroundBuffer) {
      bg = sharp(input.backgroundBuffer).resize(width, height, { fit: 'cover' });
    } else if (input.backgroundPath) {
      bg = sharp(input.backgroundPath).resize(width, height, { fit: 'cover' });
    } else {
      // 背景なし → 単色（overlay 側の theme に合わせるのは呼び出し側の責務）
      bg = sharp({ create: { width: width, height: height, channels: 4, background: { r: 255, g: 255, b: 255, alpha: 1 } } });
    }
    var out = await bg
      .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
      .png()
      .toColourspace('srgb')
      .toBuffer();
    return { ok: true, buffer: out, width: width, height: height, format: 'png' };
  } catch (e) {
    return { ok: false, reason: 'composite_error', detail: (e && e.message) || 'error' };
  }
}

module.exports = {
  isSharpAvailable: isSharpAvailable,
  safeAssetName: safeAssetName,
  safeDir: safeDir,
  compositeSlide: compositeSlide,
};
