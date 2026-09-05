'use strict';
// lib/carouselImageNormalize.js
// Instagram Carousel Image Production — Phase 2-D: provider native → Carousel target 正規化層。
//
//   provider(gpt-image-2) は 1088x1360 を返す。最終成果物は 1080x1350。
//   両者は厳密に同一の 4:5（1080*1360 === 1350*1088）であるため、
//   ★ crop は禁止。純粋な等比縮小のみを行う。
//
//   処理順（すべて fail-closed・silent fallback なし）:
//     1. Buffer 化（base64 も受けるが、出口は必ず Buffer）
//     2. MIME allowlist
//     3. magic bytes（signature）検証
//     4. metadata 検証（format / width===1088 / height===1360）
//     5. 明示的 resize（1080x1350・kernel 固定・fit:'fill'＝crop なし）
//     6. PNG / sRGB 出力
//     7. metadata 再検証（1080x1350 / png）
//
//   非責務: 合成（lib/carouselCompositor.js は Phase 2-C 完成済み・変更しない）。
//           ★ resize は必ずこの層で完結させ、compositor へ戻さない。
//   filesystem write / network I/O / DB I/O は一切行わない（Buffer 完結）。

var NATIVE = Object.freeze({ width: 1088, height: 1360 });
var TARGET = Object.freeze({ width: 1080, height: 1350 });

// 縮小カーネルは固定（決定的処理のため。sharp の既定変更に影響されないよう明示する）。
var RESIZE_KERNEL = 'lanczos3';
// fit は 'fill'。NATIVE と TARGET が厳密同一比のため crop も歪みも発生しない。
//   'cover' は crop を、'inside'/'outside' は寸法の揺れを生むため使わない。
var RESIZE_FIT = 'fill';

var MIME_ALLOWLIST = Object.freeze(['image/png']);
var ALLOWED_FORMATS = Object.freeze(['png']);

// PNG signature: 89 50 4E 47 0D 0A 1A 0A
var PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

// 入力 Buffer の上限（異常サイズを metadata 前に弾く）。1088x1360 PNG の現実的上限を大きく超える値。
var MAX_INPUT_BYTES = 32 * 1024 * 1024;

// ── 比率不変条件（module load 時に自己検証）──────────────
//   crop なしの等比縮小が成立することを、実行前に構造的に保証する。
//   将来 NATIVE / TARGET を触ったときにここで必ず落ちる。
if (TARGET.width * NATIVE.height !== TARGET.height * NATIVE.width) {
  throw new Error('carouselImageNormalize: NATIVE と TARGET のアスペクト比が一致しません（crop なし縮小が不成立）');
}
if (!(TARGET.width < NATIVE.width && TARGET.height < NATIVE.height)) {
  throw new Error('carouselImageNormalize: TARGET は NATIVE より小さい必要があります（縮小のみ許可）');
}

var _sharp = undefined;   // undefined=未試行 / null=不在 / object=あり
function getSharp() {
  if (_sharp !== undefined) return _sharp;
  try { _sharp = require('sharp'); }
  catch (e) { _sharp = null; }
  return _sharp;
}
function isSharpAvailable() { return getSharp() !== null; }

// ── 1. Buffer 化 ──────────────
//   base64 文字列も受け付けるが、以降はすべて Buffer だけを扱う。
function toBuffer(input) {
  if (Buffer.isBuffer(input)) {
    if (input.length === 0) return { ok: false, reason: 'empty_buffer' };
    return { ok: true, value: input };
  }
  if (typeof input === 'string') {
    var s = input.replace(/\s+/g, '');
    if (s.length === 0) return { ok: false, reason: 'empty_buffer' };
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(s)) return { ok: false, reason: 'invalid_base64' };
    var buf;
    try { buf = Buffer.from(s, 'base64'); } catch (e) { return { ok: false, reason: 'invalid_base64' }; }
    if (!Buffer.isBuffer(buf) || buf.length === 0) return { ok: false, reason: 'invalid_base64' };
    return { ok: true, value: buf };
  }
  return { ok: false, reason: 'missing_buffer' };
}

// ── 2. MIME allowlist ──────────────
function validateMime(mimeType) {
  if (mimeType === undefined || mimeType === null || mimeType === '') {
    return { ok: false, reason: 'missing_mime' };
  }
  // パラメータ（"image/png; charset=..."）は許さない。完全一致のみ。
  var m = String(mimeType).trim().toLowerCase();
  if (MIME_ALLOWLIST.indexOf(m) === -1) return { ok: false, reason: 'mime_not_allowed' };
  return { ok: true, value: m };
}

// ── 3. magic bytes ──────────────
function validateMagicBytes(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < PNG_MAGIC.length) {
    return { ok: false, reason: 'signature_mismatch' };
  }
  if (buf.subarray(0, PNG_MAGIC.length).equals(PNG_MAGIC) !== true) {
    return { ok: false, reason: 'signature_mismatch' };
  }
  return { ok: true };
}

// ── 4/7. metadata 検証（共通） ──────────────
async function readMetadata(sharp, buf) {
  try {
    var meta = await sharp(buf).metadata();
    if (!meta || typeof meta !== 'object') return { ok: false, reason: 'invalid_image', detail: { stage: 'metadata' } };
    return { ok: true, value: meta };
  } catch (e) {
    // raw exception message は返さない（内部情報の露出防止）
    return { ok: false, reason: 'invalid_image', detail: { stage: 'metadata' } };
  }
}

function checkDimensions(meta, expectW, expectH, stage) {
  if (ALLOWED_FORMATS.indexOf(String(meta.format)) === -1) {
    return { ok: false, reason: 'format_not_allowed', detail: { stage: stage } };
  }
  if (!Number.isInteger(meta.width) || !Number.isInteger(meta.height)) {
    return { ok: false, reason: 'invalid_image', detail: { stage: stage } };
  }
  if (meta.width !== expectW || meta.height !== expectH) {
    return {
      ok: false,
      reason: 'dimension_mismatch',
      detail: { stage: stage, expected: expectW + 'x' + expectH, actual: meta.width + 'x' + meta.height },
    };
  }
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════
// normalizeBackground
//   input: { buffer | base64, mimeType }
//   成功: { ok:true, buffer:<Buffer>, width:1080, height:1350, format:'png', resize:{...} }
//   失敗: { ok:false, reason:<固定文字列>, detail?:{ stage, ... } }
//   ★ どの失敗でも raw exception message は返さない。
// ══════════════════════════════════════════════════════════════
async function normalizeBackground(input) {
  input = input || {};

  // 1. Buffer 化
  var src = Buffer.isBuffer(input.buffer) || typeof input.buffer === 'string' ? input.buffer : input.base64;
  var b = toBuffer(src);
  if (!b.ok) return { ok: false, reason: b.reason };
  var buf = b.value;
  if (buf.length > MAX_INPUT_BYTES) return { ok: false, reason: 'input_too_large' };

  // 2. MIME allowlist
  var mime = validateMime(input.mimeType);
  if (!mime.ok) return { ok: false, reason: mime.reason };

  // 3. magic bytes
  var magic = validateMagicBytes(buf);
  if (!magic.ok) return { ok: false, reason: magic.reason };

  var sharp = getSharp();
  if (!sharp) return { ok: false, reason: 'sharp_unavailable' };

  // 4. metadata 検証（provider native 寸法であること）
  var m1 = await readMetadata(sharp, buf);
  if (!m1.ok) return { ok: false, reason: m1.reason, detail: m1.detail };
  var d1 = checkDimensions(m1.value, NATIVE.width, NATIVE.height, 'source_metadata');
  if (!d1.ok) return { ok: false, reason: d1.reason, detail: d1.detail };

  // 5〜6. 明示的 resize（crop なし・等比・kernel 固定）→ PNG / sRGB
  var out;
  try {
    out = await sharp(buf)
      .resize(TARGET.width, TARGET.height, { kernel: RESIZE_KERNEL, fit: RESIZE_FIT })
      .png()
      .toColourspace('srgb')
      .toBuffer();
  } catch (e) {
    return { ok: false, reason: 'normalize_error', detail: { stage: 'resize' } };
  }
  if (!Buffer.isBuffer(out) || out.length === 0) {
    return { ok: false, reason: 'normalize_error', detail: { stage: 'resize' } };
  }

  // 7. metadata 再検証（出力が確実に 1080x1350 PNG であること）
  var m2 = await readMetadata(sharp, out);
  if (!m2.ok) return { ok: false, reason: m2.reason, detail: { stage: 'output_metadata' } };
  var d2 = checkDimensions(m2.value, TARGET.width, TARGET.height, 'output_metadata');
  if (!d2.ok) return { ok: false, reason: d2.reason, detail: d2.detail };
  // 出力の signature も再確認（PNG 以外が出ていないこと）
  var magic2 = validateMagicBytes(out);
  if (!magic2.ok) return { ok: false, reason: 'signature_mismatch', detail: { stage: 'output_metadata' } };

  return {
    ok: true,
    buffer: out,
    width: TARGET.width,
    height: TARGET.height,
    format: 'png',
    source: { width: NATIVE.width, height: NATIVE.height },
    resize: { kernel: RESIZE_KERNEL, fit: RESIZE_FIT, cropped: false, scale: TARGET.width / NATIVE.width },
  };
}

module.exports = {
  NATIVE: NATIVE,
  TARGET: TARGET,
  RESIZE_KERNEL: RESIZE_KERNEL,
  RESIZE_FIT: RESIZE_FIT,
  MIME_ALLOWLIST: MIME_ALLOWLIST,
  ALLOWED_FORMATS: ALLOWED_FORMATS,
  PNG_MAGIC: PNG_MAGIC,
  MAX_INPUT_BYTES: MAX_INPUT_BYTES,
  isSharpAvailable: isSharpAvailable,
  toBuffer: toBuffer,
  validateMime: validateMime,
  validateMagicBytes: validateMagicBytes,
  normalizeBackground: normalizeBackground,
};
