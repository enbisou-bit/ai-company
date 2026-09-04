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

// 寸法の検証（Phase 2-C: silent fallback を作らない）。
//   未指定・非整数・0以下・非現実的な大きさはすべて拒否する。
var MAX_DIM = 10000;
function _validateDim(v, name) {
  if (v === undefined || v === null || v === '') return { ok: false, reason: 'missing_' + name };
  var num = Number(v);
  if (!Number.isFinite(num) || !Number.isInteger(num)) return { ok: false, reason: 'invalid_' + name };
  if (num <= 0 || num > MAX_DIM) return { ok: false, reason: 'invalid_' + name };
  return { ok: true, value: num };
}

// 合成（背景 PNG + overlay SVG → PNG Buffer）
//   input: { backgroundBuffer | backgroundPath, overlaySvg, width, height }
//   Phase 2-C: 入力はすべて必須。既定値による silent fallback は行わない（fail-closed）。
async function compositeSlide(input) {
  input = input || {};
  var overlaySvg = input.overlaySvg;

  if (!overlaySvg || typeof overlaySvg !== 'string') {
    return { ok: false, reason: 'missing_overlay_svg' };
  }

  // 寸法: 既定値へ落とさず明示指定を要求する
  var wv = _validateDim(input.width, 'width');
  if (!wv.ok) return { ok: false, reason: wv.reason };
  var hv = _validateDim(input.height, 'height');
  if (!hv.ok) return { ok: false, reason: hv.reason };
  var width = wv.value, height = hv.value;

  // 背景: 未指定を単色でごまかさない（呼び出し側が明示的に用意する）
  var hasBuf = Buffer.isBuffer(input.backgroundBuffer);
  var hasPath = typeof input.backgroundPath === 'string' && input.backgroundPath.length > 0;
  if (!hasBuf && !hasPath) return { ok: false, reason: 'missing_background' };
  if (hasBuf && input.backgroundBuffer.length === 0) return { ok: false, reason: 'empty_background' };

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
    // 背景の実寸を検証する（silent resize / cover / crop で不一致をごまかさない）
    var bgMeta;
    try {
      bgMeta = hasBuf
        ? await sharp(input.backgroundBuffer).metadata()
        : await sharp(input.backgroundPath).metadata();
    } catch (e) {
      // malformed / 解析不能な背景はここで停止（composite へ進めない）。
      // raw exception message は返さない（ローカルパス等の内部情報が混入しうるため）。
      return { ok: false, reason: 'invalid_background', detail: { stage: 'background_metadata' } };
    }
    if (!bgMeta || !Number.isInteger(bgMeta.width) || !Number.isInteger(bgMeta.height)) {
      return { ok: false, reason: 'invalid_background', detail: { stage: 'background_metadata' } };
    }
    if (bgMeta.width !== width || bgMeta.height !== height) {
      return {
        ok: false,
        reason: 'background_dimension_mismatch',
        detail: { expected: width + 'x' + height, actual: bgMeta.width + 'x' + bgMeta.height },
      };
    }

    // 実寸一致を確認できた背景のみ、リサイズせずそのまま合成する（resize() は使わない）
    var bg = hasBuf ? sharp(input.backgroundBuffer) : sharp(input.backgroundPath);
    var out = await bg
      .composite([{ input: Buffer.from(overlaySvg), top: 0, left: 0 }])
      .png()
      .toColourspace('srgb')
      .toBuffer();
    return { ok: true, buffer: out, width: width, height: height, format: 'png' };
  } catch (e) {
    // raw exception message は返さない（内部情報の露出防止）
    return { ok: false, reason: 'composite_error', detail: { stage: 'composite' } };
  }
}

module.exports = {
  isSharpAvailable: isSharpAvailable,
  safeAssetName: safeAssetName,
  safeDir: safeDir,
  compositeSlide: compositeSlide,
};
