'use strict';
// lib/carouselAssetStorage.js
// Carousel Image Production — Phase 2-E Production Connection Step C-2: Supabase Storage helper。
//
//   責務: compositeSlide()（lib/carouselCompositor.js）が生成する最終 1080x1350 PNG Buffer を、
//   Supabase Storage（bucket: carousel-images）へ server-only で永続化する。
//   本ファイルは「保存すること」だけに責務を限定する——DB I/O・Output Draft 更新・
//   Image Review・Publishing 判断・署名URL発行は一切行わない（それぞれ別レイヤの責務）。
//
//   ★ Server-only boundary: 本ファイルは privileged Supabase client を自前で生成しない。
//     呼び出し側が opts.client（.storage.from(bucket).upload(...) を持つ client）を
//     dependency injection で渡す構造のみを提供する（lib/carouselExecutionDb.js が
//     reserve/complete/fail を opts.client 注入で deterministic test 可能にしている設計を踏襲）。
//     ★ Phase 2-E Production Connection Step C-2 の時点では、本ファイルから
//       SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY 等の環境変数を一切参照しない
//       （production 用 privileged client の配線は本Stepの範囲外＝server route 実装時に別途行う）。
//     opts.client が無い呼び出しは常に { ok:false, reason:'storage_unavailable' } で fail-closed する。
//
//   ★ upsert:false を固定使用する。同一 storagePath への再アップロードは
//     'storage_collision' として拒否する（同一 nonce/slide の再書込みで billing/persistence truth を
//     曖昧にしないため）。上書きしたい場合は新しい nonce（＝新しい execution）で行うこと。
//
//   ★ No public URL: upload 成功時に public URL / signed URL を一切生成しない。
//     正式 metadata は storagePath のみ。画像閲覧用 signed URL の発行は
//     GET /api/carousel-image/assets（Step C-3 以降）の責務であり、本ファイルの範囲外。
//
//   ★ No delete / rollback: batch upload が部分的に失敗しても、既に成功した asset の
//     自動削除は行わない（削除という新しい危険操作を暗黙で追加しないため）。
//     orphan cleanup は別工程・別Decision候補（Step C調査 Section 21 を参照）。
//
//   ★ Billing boundary: 本ファイルは carousel_image_executions（課金台帳）を一切変更しない。
//     provider成功 → ledger completed → asset persistence の順序を前提とし、
//     Storage失敗が発生済みの課金を取り消すことはない（呼び出し側がこの順序を守る責任を持つ）。
//
//   ★ 画像 dimensions（width/height/aspectRatio）は Buffer をデコードして検証しない
//     （sharp 等の decode dependency を新たに持ち込まない）。1080x1350 / 4:5 は
//     shared/carouselImageCore.js・lib/carouselImageNormalize.js と同一の固定契約値として
//     本ファイルにも同じ値を定義し、upstream（normalize/compositor）が保証した寸法を
//     そのまま metadata として返すだけに留める。
//
//   ★ raw prompt 全文・日本語 slide 本文・API key・provider raw response・raw Storage error は
//     戻り値・storagePath・metadata のいずれにも一切含めない（呼び出し側の責務でもあるが、
//     本ファイル自身もそれらを受け取らない設計にしている）。
//
//   fail-closed reason 一覧:
//     invalid_asset_input  … buffer 欠落／非Buffer／空Buffer／サイズ上限超過
//     invalid_storage_path … caseId/outputId/nonce/slideIndex が path-safe allowlist 不一致
//     invalid_png          … PNG signature（89 50 4E 47 0D 0A 1A 0A）不一致
//     storage_unavailable  … opts.client 未設定／upload 呼び出し自体が例外を投げた
//     storage_upload_failed… Storage provider がエラーを返した（409以外・sanitize済み）
//     storage_collision    … 同一 storagePath への upsert:false 違反（409）

var crypto = require('crypto');

// ── 固定契約値（shared/carouselImageCore.js・lib/carouselImageNormalize.js と同一値） ──
var TARGET = Object.freeze({ width: 1080, height: 1350, aspectRatio: '4:5' });

// PNG signature: 89 50 4E 47 0D 0A 1A 0A（lib/carouselImageNormalize.js と同一定義）。
var PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);

// 最終 composite（1080x1350・sharp PNG エンコード出力）の現実的上限を大きく超える値。
//   lib/carouselImageNormalize.js の MAX_INPUT_BYTES（1088x1360 provider 画像向け）と
//   同一の根拠・同一の値を採用する（ほぼ同寸法のため同じ安全側の桁で十分）。
var MAX_ASSET_BYTES = 32 * 1024 * 1024;

// bucket名はコード上の固定定数。client入力から自由指定させない。
var CAROUSEL_ASSET_BUCKET = 'carousel-images';

// path-safe allowlist（caseId / outputId / nonce 共通）。
//   許可文字のみの allowlist にすることで、'..' / '/' / '\' / 制御文字 / 空文字を
//   個別に禁止するのではなく構造的に排除する（denylist の抜け漏れを避ける）。
//   実際の形式: caseId='case-value-1788410623' / outputId='out_1788413020275' /
//   nonce=32桁程度の hex 文字列（crypto.randomBytes(...).toString('hex')・shared/carouselApproval.js）。
var SEGMENT_RE = /^[A-Za-z0-9_-]{1,128}$/;

// slideIndex の許容範囲（lib/carouselCompositor.js の SAFE_NAME_RE
//   ^(slide|background|overlay)-([1-9]|1[0-9])\.(png|svg)$ と同一の 1〜19 を踏襲）。
function _validSlideIndex(v) {
  var n = Number(v);
  return Number.isInteger(n) && n >= 1 && n <= 19;
}

// ══════════════════════════════════════════════════════════════
// computeSha256 — 保存前 PNG Buffer の SHA-256（hex lowercase）。
// ══════════════════════════════════════════════════════════════
function computeSha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// ══════════════════════════════════════════════════════════════
// validatePngBuffer — Buffer型・非空・サイズ上限・PNG signature を fail-closed で検証する。
// ══════════════════════════════════════════════════════════════
function validatePngBuffer(buffer) {
  if (!Buffer.isBuffer(buffer)) return { ok: false, reason: 'invalid_asset_input', field: 'buffer' };
  if (buffer.length === 0) return { ok: false, reason: 'invalid_asset_input', field: 'buffer' };
  if (buffer.length > MAX_ASSET_BYTES) return { ok: false, reason: 'invalid_asset_input', field: 'buffer' };
  if (buffer.length < PNG_MAGIC.length || !buffer.slice(0, PNG_MAGIC.length).equals(PNG_MAGIC)) {
    return { ok: false, reason: 'invalid_png' };
  }
  return { ok: true };
}

// ══════════════════════════════════════════════════════════════
// buildAssetPath — deterministic・scope-safe な storagePath を構築する。
//   carousel/<caseId>/<outputId>/<nonce>/slide-<N>.png
//   nonce を path へ含めることで、failed persistence / retry / 旧 generation 間の
//   asset collision を防ぐ（同一 output_id でも execution ごとに path が分離される）。
// ══════════════════════════════════════════════════════════════
function buildAssetPath(input) {
  var inp = input || {};
  var caseId = inp.caseId;
  var outputId = inp.outputId;
  var nonce = inp.nonce;
  var slideIndex = inp.slideIndex;

  if (typeof caseId !== 'string' || !SEGMENT_RE.test(caseId)) {
    return { ok: false, reason: 'invalid_storage_path', field: 'caseId' };
  }
  if (typeof outputId !== 'string' || !SEGMENT_RE.test(outputId)) {
    return { ok: false, reason: 'invalid_storage_path', field: 'outputId' };
  }
  if (typeof nonce !== 'string' || !SEGMENT_RE.test(nonce)) {
    return { ok: false, reason: 'invalid_storage_path', field: 'nonce' };
  }
  if (!_validSlideIndex(slideIndex)) {
    return { ok: false, reason: 'invalid_storage_path', field: 'slideIndex' };
  }

  var n = Number(slideIndex);
  var path = 'carousel/' + caseId + '/' + outputId + '/' + nonce + '/slide-' + n + '.png';
  return { ok: true, path: path };
}

// PostgreSQL 側の 23505 厳密一致分類（lib/carouselExecutionDb.js）と同じ方針:
//   Supabase Storage の upsert:false 衝突は HTTP 409 / statusCode '409' で返る。
//   厳密一致で確認できた場合のみ 'storage_collision' とし、それ以外の 23505 相当しない
//   エラーは推測分類せず 'storage_upload_failed' へ fail-closed する。
function _isStorageCollision(error) {
  if (!error) return false;
  return String(error.statusCode) === '409';
}

// ══════════════════════════════════════════════════════════════
// uploadCarouselAsset — 単一 slide の PNG Buffer を Supabase Storage へ保存する。
//
//   input: { caseId, outputId, nonce, slideIndex, buffer, slideId? }
//     ★ slideId は任意。Storage へは送らない（path/metadata の scope は
//       caseId/outputId/nonce/slideIndex のみで完結させる）。呼び出し側の相関用に
//       成功結果の asset.slideId としてのみ echo する。
//     ★ contentType は client 入力を一切信用せず、常に 'image/png' 固定。
//
//   戻り値:
//     { ok:true, asset:{ slideIndex, slideId?, storagePath, sha256, bytes, format:'png',
//                         width:1080, height:1350, aspectRatio:'4:5', status:'ready' } }
//     { ok:false, reason:'invalid_asset_input'|'invalid_storage_path'|'invalid_png'|
//                          'storage_unavailable'|'storage_upload_failed'|'storage_collision',
//       field? }
// ══════════════════════════════════════════════════════════════
async function uploadCarouselAsset(input, opts) {
  var inp = input || {};
  var client = (opts && opts.client) || null;

  var pngCheck = validatePngBuffer(inp.buffer);
  if (!pngCheck.ok) return pngCheck;

  var pathResult = buildAssetPath(inp);
  if (!pathResult.ok) return pathResult;

  // fail-closed: client 未設定時に「成功」や「実 network 呼び出しへ進むfallback」を絶対に返さない。
  if (!client || !client.storage || typeof client.storage.from !== 'function') {
    return { ok: false, reason: 'storage_unavailable' };
  }

  var sha256 = computeSha256(inp.buffer);
  var bytes = inp.buffer.length;

  var res;
  try {
    res = await client.storage.from(CAROUSEL_ASSET_BUCKET).upload(pathResult.path, inp.buffer, {
      contentType: 'image/png',
      upsert: false,
    });
  } catch (e) {
    // raw exception message は戻り値へ載せない（lib/carouselExecutionDb.js の方針を踏襲）。
    return { ok: false, reason: 'storage_unavailable' };
  }

  if (res.error) {
    if (_isStorageCollision(res.error)) return { ok: false, reason: 'storage_collision' };
    // raw provider error（message/stack/response/URL/credential）はそのまま返さない。
    return { ok: false, reason: 'storage_upload_failed' };
  }
  if (!res.data || !res.data.path) return { ok: false, reason: 'storage_upload_failed' };

  var asset = {
    slideIndex: Number(inp.slideIndex),
    storagePath: pathResult.path,
    sha256: sha256,
    bytes: bytes,
    format: 'png',
    width: TARGET.width,
    height: TARGET.height,
    aspectRatio: TARGET.aspectRatio,
    status: 'ready',
  };
  if (inp.slideId !== undefined && inp.slideId !== null) asset.slideId = String(inp.slideId);

  return { ok: true, asset: asset };
}

// ══════════════════════════════════════════════════════════════
// uploadCarouselAssets — 複数 slide をまとめて保存する batch helper。
//
//   全件のupload結果を収集してから判定する（1件失敗した時点で他を打ち切らない・
//   「7枚すべて成功したか」を呼び出し側が一括判断できるようにするため）。
//   ★ 1件でも失敗した場合、batch 全体は ok:false（すでに成功した slide の自動削除は行わない・
//     Output Draft への carouselAssets 正式登録は呼び出し側の責務であり、本関数は行わない）。
//
//   戻り値:
//     全件成功: { ok:true,  assets: [asset, ...] }
//     一部失敗: { ok:false, results: [ {ok:true,asset} | {ok:false,reason,field?}, ... ] }
//     入力不正: { ok:false, reason:'invalid_asset_input', field:'items' }
// ══════════════════════════════════════════════════════════════
async function uploadCarouselAssets(items, opts) {
  var list = Array.isArray(items) ? items : null;
  if (!list || list.length === 0) return { ok: false, reason: 'invalid_asset_input', field: 'items' };

  var results = await Promise.all(list.map(function (item) {
    return uploadCarouselAsset(item, opts);
  }));

  var allOk = results.every(function (r) { return r.ok === true; });
  if (allOk) {
    return { ok: true, assets: results.map(function (r) { return r.asset; }) };
  }
  return { ok: false, results: results };
}

module.exports = {
  CAROUSEL_ASSET_BUCKET: CAROUSEL_ASSET_BUCKET,
  TARGET: TARGET,
  PNG_MAGIC: PNG_MAGIC,
  MAX_ASSET_BYTES: MAX_ASSET_BYTES,
  computeSha256: computeSha256,
  validatePngBuffer: validatePngBuffer,
  buildAssetPath: buildAssetPath,
  uploadCarouselAsset: uploadCarouselAsset,
  uploadCarouselAssets: uploadCarouselAssets,
};
