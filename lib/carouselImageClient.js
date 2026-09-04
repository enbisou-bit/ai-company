'use strict';
// lib/carouselImageClient.js
// Instagram Carousel Image Production — C案 Phase 1: OpenAI 画像生成 interface。
//
//   既存 callOpenAI / callOpenAIWebSearch とは完全に独立した経路。
//   OPENAI_API_KEY を扱うのは server-side ファイルのみ（ブラウザへ配信されない）。
//
//   ★ Phase 1: 実 API 呼び出しは行わない。既定は mock。
//     - generateBackground({ mock:true }) → 決定的な mock 応答（b64 なし・擬似メタのみ）
//     - generateBackground({ mock:false }) → 実 API パスだが、REAL_ENABLED=false のため即 throw
//       （Phase 2 でユーザー承認のうえ REAL_ENABLED を有効化する）
//
//   API key はログに出さない。エラー時も key を含めない。

var axios = require('axios');

// EEA と同じ「別経路は別定数」方式。OPENAI_MODEL 等の既存定数は無変更。
var CAROUSEL_IMAGE_MODEL = 'gpt-image-1';
var OPENAI_IMAGE_API_URL = 'https://api.openai.com/v1/images/generations';

// gpt-image-1 の 4:5 相当（portrait）サイズ。
var SIZE_BY_RATIO = { '4:5': '1024x1536', '1:1': '1024x1024' };

// 概算単価（USD/枚・API 実行なしの見積り用。実測で更新すること）。
var EST_USD_BY_QUALITY = { low: 0.011, medium: 0.042, high: 0.167 };

// Phase 1 の安全弁。実 API を有効化するには Phase 2 でここを true にし、
// 呼び出し元（server route）にユーザー承認ゲート（billingLock 同型）を必ず置く。
var REAL_ENABLED = false;

function estimateUsd(quality, count) {
  var per = EST_USD_BY_QUALITY[quality] || EST_USD_BY_QUALITY.medium;
  return Math.round(per * Number(count || 1) * 1000) / 1000;
}

// 決定的な mock 応答（同一 prompt/size → 同一メタ）。b64 は返さない（実画像なし）。
function mockBackground(prompt, size) {
  var hash = 0;
  var s = String(prompt) + '|' + String(size);
  for (var i = 0; i < s.length; i++) { hash = (hash * 31 + s.charCodeAt(i)) >>> 0; }
  return {
    ok: true,
    mock: true,
    model: CAROUSEL_IMAGE_MODEL,
    size: size,
    promptHash: hash.toString(16),
    b64: null,
    note: 'Phase1 mock — no real image generated',
  };
}

// prompt に日本語文字生成を要求していないか（防御的に検査。実運用では buildBackgroundPrompt が保証）。
function looksSafeBackgroundPrompt(prompt) {
  var p = String(prompt || '');
  if (!/no text/i.test(p)) return false;
  if (!/(4:5|1080x1350|vertical)/i.test(p)) return false;
  return true;
}

async function generateBackground(opts) {
  opts = opts || {};
  var prompt = opts.prompt;
  var ratio = opts.aspectRatio || '4:5';
  var quality = opts.quality || 'medium';
  var size = SIZE_BY_RATIO[ratio] || SIZE_BY_RATIO['4:5'];
  var isMock = opts.mock !== false;   // 既定 mock

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return { ok: false, reason: 'empty_prompt' };
  }
  if (!looksSafeBackgroundPrompt(prompt)) {
    return { ok: false, reason: 'unsafe_prompt_shape' };
  }

  if (isMock) return mockBackground(prompt, size);

  // ── 実 API パス（Phase 1 では無効） ──
  if (!REAL_ENABLED) {
    return { ok: false, reason: 'real_api_disabled_phase1' };
  }
  var key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, reason: 'no_api_key' };
  try {
    var body = {
      model: CAROUSEL_IMAGE_MODEL,
      prompt: prompt,
      size: size,
      quality: quality,
      n: 1,
    };
    var resp = await axios.post(OPENAI_IMAGE_API_URL, body, {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      timeout: 120000,
    });
    var d = resp && resp.data && Array.isArray(resp.data.data) ? resp.data.data[0] : null;
    if (!d || !d.b64_json) return { ok: false, reason: 'no_image_in_response' };
    return { ok: true, mock: false, model: CAROUSEL_IMAGE_MODEL, size: size, b64: d.b64_json };
  } catch (e) {
    // key を含めない
    var msg = (e && e.message ? String(e.message) : 'error').replace(/Bearer\s+[A-Za-z0-9._-]+/g, 'Bearer [redacted]');
    return { ok: false, reason: 'api_error', detail: msg };
  }
}

module.exports = {
  CAROUSEL_IMAGE_MODEL: CAROUSEL_IMAGE_MODEL,
  SIZE_BY_RATIO: SIZE_BY_RATIO,
  EST_USD_BY_QUALITY: EST_USD_BY_QUALITY,
  REAL_ENABLED: REAL_ENABLED,
  estimateUsd: estimateUsd,
  looksSafeBackgroundPrompt: looksSafeBackgroundPrompt,
  mockBackground: mockBackground,
  generateBackground: generateBackground,
};
