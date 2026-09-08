'use strict';
// lib/carouselAssetAccess.js
// Carousel Image Production — Phase 2-E Production Connection Step C-3: signed URL helper。
//
//   責務: lib/carouselAssetStorage.js が永続化した storagePath を、短時間の signed URL へ
//   変換するだけ。public URL は作らない（bucket は public 前提にしない）。
//
//   ★ Server-only boundary: lib/carouselAssetStorage.js と同じ方針で、本ファイルも
//     privileged Supabase Storage client を自前で生成しない。opts.client の dependency
//     injection のみを受け付ける（production wiring は呼び出し側の責務）。
//   ★ CAROUSEL_ASSET_BUCKET は lib/carouselAssetStorage.js の値をそのまま再利用する
//     （同じbucket定数を二重に矛盾定義しない）。
//   ★ expiresIn は呼び出し側が自由な値を渡しても、範囲外なら DEFAULT_EXPIRES_IN へ
//     fail-safe する（client にexpiryを自由指定させない、という上位route側の方針を
//     本helper自身でも構造的に担保する）。

var assetStorage = require('./carouselAssetStorage');

var CAROUSEL_ASSET_BUCKET = assetStorage.CAROUSEL_ASSET_BUCKET;
var DEFAULT_EXPIRES_IN = 300;   // 5分
var MAX_EXPIRES_IN = 3600;      // 1時間（これを超える値は要求されてもDEFAULTへ丸める）

// ══════════════════════════════════════════════════════════════
// createSignedUrl — 単一 storagePath の signed URL を発行する。
//
//   戻り値:
//     { ok:true, url, expiresIn }
//     { ok:false, reason:'invalid_storage_path' | 'storage_unavailable' | 'asset_access_failed' }
// ══════════════════════════════════════════════════════════════
async function createSignedUrl(storagePath, expiresIn, opts) {
  var client = (opts && opts.client) || null;

  if (typeof storagePath !== 'string' || !storagePath) {
    return { ok: false, reason: 'invalid_storage_path' };
  }

  var ttl = Number.isFinite(Number(expiresIn)) ? Math.floor(Number(expiresIn)) : DEFAULT_EXPIRES_IN;
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > MAX_EXPIRES_IN) ttl = DEFAULT_EXPIRES_IN;

  if (!client || !client.storage || typeof client.storage.from !== 'function') {
    return { ok: false, reason: 'storage_unavailable' };
  }

  var res;
  try {
    res = await client.storage.from(CAROUSEL_ASSET_BUCKET).createSignedUrl(storagePath, ttl);
  } catch (e) {
    // raw exception message は戻り値へ載せない。
    return { ok: false, reason: 'storage_unavailable' };
  }

  if (res.error || !res.data || typeof res.data.signedUrl !== 'string' || !res.data.signedUrl) {
    // raw provider error（message/stack/response）はそのまま返さない。
    return { ok: false, reason: 'asset_access_failed' };
  }

  return { ok: true, url: res.data.signedUrl, expiresIn: ttl };
}

module.exports = {
  CAROUSEL_ASSET_BUCKET: CAROUSEL_ASSET_BUCKET,
  DEFAULT_EXPIRES_IN: DEFAULT_EXPIRES_IN,
  MAX_EXPIRES_IN: MAX_EXPIRES_IN,
  createSignedUrl: createSignedUrl,
};
