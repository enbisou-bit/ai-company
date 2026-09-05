'use strict';
// lib/carouselImageClient.js
// Instagram Carousel Image Production — Phase 2-D: provider-neutral 画像生成 adapter。
//
//   既存 callOpenAI / callOpenAIWebSearch とは完全に独立した経路。
//   OPENAI_API_KEY を扱うのは server-side ファイルのみ（ブラウザへ配信されない）。
//
//   ★ Phase 2-D: 実 API 呼び出しは 0 件。REAL_ENABLED=false を維持する。
//     generateBackgroundRaw() は provider 出口の唯一の境界であり、
//     成功時は必ず Buffer を返す契約（base64 文字列を外へ出さない）。
//
//   fail-closed 方針:
//     - quality は enum のみ（既定へ暗黙 fallback しない）
//     - aspectRatio は PROVIDER_REQUEST_SIZE の key のみ
//     - raw exception message を戻り値へ載せない（detail は固定 { stage } のみ）
//     - API key はログにも戻り値にも出さない

var axios = require('axios');

// ── provider / model ──────────────
//   Phase 2-D-0 でモデルを gpt-image-1 → gpt-image-2 へ正式変更。gpt-image-1 は使用しない。
var CAROUSEL_IMAGE_PROVIDER = 'openai';
var CAROUSEL_IMAGE_MODEL = 'gpt-image-2';
var OPENAI_IMAGE_API_URL = 'https://api.openai.com/v1/images/generations';

// ── provider へ実際に要求するサイズ ──────────────
//   ★ 旧 SIZE_BY_RATIO は「Carousel target(1080x1350)」と「provider request size」を
//     混同させるため廃止した。ここにあるのは provider へ送る値だけであり、
//     最終成果物のサイズではない（最終成果物は shared/carouselImageCore.js TARGET）。
//   gpt-image-2 の制約（公式 Docs）: 各辺は16の倍数 / 最大辺 3840px / 総画素 655,360〜8,294,400。
//   1080x1350 は 1080/16=67.5 で不可。4:5 かつ16の倍数の最小上位が 1088x1360。
//   1080/1088 === 1350/1360 のため、正規化は crop 不要の純粋等比縮小になる。
var PROVIDER_REQUEST_SIZE = Object.freeze({ '4:5': '1088x1360', '1:1': '1024x1024' });

// ── quality enum（暗黙 fallback 禁止） ──────────────
var QUALITY_ENUM = Object.freeze(['low', 'medium', 'high']);

// ── 価格（Phase 2-D-0 で OpenAI 公式情報のみから確定） ──────────────
//   出典1: developers.openai.com/api/docs/pricing
//          gpt-image-2 image output = $30.00 / 1M tokens
//   出典2: developers.openai.com/api/docs/guides/image-generation
//          公式 pricing calculator に width=1088 / height=1360 を入力して読み取った output tokens。
//          同 calculator の 1024x1024 / 1024x1536 の値 × $30/1M が公式静的価格表と 6/6 一致するため、
//          「tokens × $30/1M」という換算式自体が公式に裏付けられている。
//   ★ USD 枚単価を magic number として直接持たず、必ず下の2定数から算出する。
var IMAGE_OUTPUT_USD_PER_1M = 30.00;
var OUTPUT_TOKENS_BY_QUALITY = Object.freeze({ low: 181, medium: 1587, high: 6431 });
var OUTPUT_TOKENS_MEASURED_AT_SIZE = '1088x1360';

// 為替は社内既存の static 正本（costTracker.js / claudeCostTracker.js の USD_TO_JPY と同値）。
//   ★ これは OpenAI 公式情報ではない。由来を取り違えないよう source を明示する。
//   costTracker.js を require すると cost-logs.json の read/write 経路に触れるため、
//   本モジュールは同値を独立に保持する（Protected Working Tree 保護のため意図的な重複）。
var USD_TO_JPY_STATIC = 160;
var EXCHANGE_RATE_SOURCE = 'static';

// pre-flight estimate が公式確認済みであることを示すフラグ。
//   ★ 意味は「OpenAI 公式 calculator による事前見積りが公式確認済み」であり、
//     実課金額と完全一致することの保証値ではない。actual usage とは必ず分離して扱う。
var ESTIMATE_VERIFIED = true;

// ── 安全弁。実 API を有効化するには Phase 2-E でユーザー承認のうえ true にする ──
var REAL_ENABLED = false;

var DEFAULT_TIMEOUT_MS = 120000;
var MAX_TIMEOUT_MS = 300000;

// ── 見積り（純関数・外部 I/O なし） ──────────────
function outputTokensFor(quality) {
  if (!Object.prototype.hasOwnProperty.call(OUTPUT_TOKENS_BY_QUALITY, String(quality))) return null;
  return OUTPUT_TOKENS_BY_QUALITY[String(quality)];
}

// 1枚あたり USD（丸めない生値。running budget の累積誤差を避けるため）
function estimateImageUsdPerImage(quality) {
  var tok = outputTokensFor(quality);
  if (tok === null) return null;
  return (tok / 1000000) * IMAGE_OUTPUT_USD_PER_1M;
}

function estimateImageUsd(quality, count) {
  var per = estimateImageUsdPerImage(quality);
  if (per === null) return null;
  var n = Number(count);
  if (!Number.isInteger(n) || n < 0) return null;
  return per * n;
}

function estimateImageJpy(quality, count) {
  var usd = estimateImageUsd(quality, count);
  if (usd === null) return null;
  return usd * USD_TO_JPY_STATIC;
}

// 見積りの内訳（報告・監査用。由来を必ず添える）
function estimateBreakdown(quality, count) {
  var tok = outputTokensFor(quality);
  if (tok === null) return { ok: false, reason: 'invalid_quality' };
  var n = Number(count);
  if (!Number.isInteger(n) || n < 0) return { ok: false, reason: 'invalid_count' };
  return {
    ok: true,
    model: CAROUSEL_IMAGE_MODEL,
    size: OUTPUT_TOKENS_MEASURED_AT_SIZE,
    quality: String(quality),
    count: n,
    outputTokensPerImage: tok,
    outputTokensTotal: tok * n,
    usdPer1MOutputTokens: IMAGE_OUTPUT_USD_PER_1M,
    usd: estimateImageUsd(quality, n),
    jpy: estimateImageJpy(quality, n),
    exchangeRate: USD_TO_JPY_STATIC,
    exchangeRateSource: EXCHANGE_RATE_SOURCE,
    estimateVerified: ESTIMATE_VERIFIED,
    // 実課金額ではない。actual usage は provider レスポンスから取得できた場合のみ別枠で扱う。
    isActualCost: false,
  };
}

// ── 入力検証 ──────────────
function validateQuality(quality) {
  if (quality === undefined || quality === null || quality === '') {
    return { ok: false, reason: 'missing_quality' };
  }
  if (QUALITY_ENUM.indexOf(String(quality)) === -1) {
    return { ok: false, reason: 'invalid_quality' };
  }
  return { ok: true, value: String(quality) };
}

function validateAspectRatio(ratio) {
  if (ratio === undefined || ratio === null || ratio === '') {
    return { ok: false, reason: 'missing_aspect_ratio' };
  }
  if (!Object.prototype.hasOwnProperty.call(PROVIDER_REQUEST_SIZE, String(ratio))) {
    return { ok: false, reason: 'invalid_aspect_ratio' };
  }
  return { ok: true, value: PROVIDER_REQUEST_SIZE[String(ratio)] };
}

function validateTimeout(ms) {
  if (ms === undefined || ms === null || ms === '') return { ok: true, value: DEFAULT_TIMEOUT_MS };
  var n = Number(ms);
  if (!Number.isInteger(n) || n <= 0 || n > MAX_TIMEOUT_MS) return { ok: false, reason: 'invalid_timeout' };
  return { ok: true, value: n };
}

// prompt に日本語文字生成を要求していないか（防御的に検査。実運用では buildBackgroundPrompt が保証）。
function looksSafeBackgroundPrompt(prompt) {
  var p = String(prompt || '');
  if (!/no text/i.test(p)) return false;
  if (!/(4:5|1080x1350|vertical)/i.test(p)) return false;
  return true;
}

// base64 → Buffer（provider 出口を Buffer に統一するための唯一の変換点）
function base64ToBuffer(b64) {
  if (typeof b64 !== 'string' || b64.length === 0) return null;
  // base64 以外の文字が混じっていれば拒否（Buffer.from は黙って捨てるため事前に検査する）
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(b64.replace(/\s+/g, ''))) return null;
  var buf;
  try { buf = Buffer.from(b64, 'base64'); } catch (e) { return null; }
  if (!Buffer.isBuffer(buf) || buf.length === 0) return null;
  return buf;
}

// 決定的な mock メタ応答（既存互換。b64 は返さない＝実画像は作らない）。
function mockBackground(prompt, size) {
  var hash = 0;
  var s = String(prompt) + '|' + String(size);
  for (var i = 0; i < s.length; i++) { hash = (hash * 31 + s.charCodeAt(i)) >>> 0; }
  return {
    ok: true,
    mock: true,
    provider: CAROUSEL_IMAGE_PROVIDER,
    model: CAROUSEL_IMAGE_MODEL,
    size: size,
    promptHash: hash.toString(16),
    b64: null,
    note: 'mock — no real image generated',
  };
}

// ══════════════════════════════════════════════════════════════
// provider-neutral adapter 境界
//   ここが「外部 provider に触れる唯一の関数」。
//   成功時の契約: { ok:true, buffer:<Buffer>, ... } — base64 文字列は外へ出さない。
//   失敗時の契約: { ok:false, reason:<固定文字列>, detail?:{ stage } } — raw message を出さない。
// ══════════════════════════════════════════════════════════════
async function generateBackgroundRaw(opts) {
  opts = opts || {};
  var prompt = opts.prompt;
  var isMock = opts.mock !== false;   // 既定 mock

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return { ok: false, reason: 'empty_prompt' };
  }
  if (!looksSafeBackgroundPrompt(prompt)) {
    return { ok: false, reason: 'unsafe_prompt_shape' };
  }

  var q = validateQuality(opts.quality);
  if (!q.ok) return { ok: false, reason: q.reason };
  var ar = validateAspectRatio(opts.aspectRatio);
  if (!ar.ok) return { ok: false, reason: ar.reason };
  var to = validateTimeout(opts.timeoutMs);
  if (!to.ok) return { ok: false, reason: to.reason };

  var size = ar.value;

  if (isMock) {
    // mock でも「実画像を捏造しない」。呼び出し側が検証用の実 PNG Buffer を注入した場合のみ返す。
    // 注入が無ければ Buffer を持たないことを明示して停止する（空 Buffer や1x1 PNG を作らない）。
    if (Buffer.isBuffer(opts.mockBuffer) && opts.mockBuffer.length > 0) {
      return {
        ok: true, mock: true,
        provider: CAROUSEL_IMAGE_PROVIDER, model: CAROUSEL_IMAGE_MODEL,
        size: size, quality: q.value, buffer: opts.mockBuffer,
        usage: null,   // mock では actual usage は存在しない（推測値を入れない）
      };
    }
    return { ok: false, reason: 'mock_buffer_required', mock: true, size: size, quality: q.value };
  }

  // ── 実 API パス（Phase 2-D では到達しない） ──
  if (!REAL_ENABLED) {
    return { ok: false, reason: 'real_api_disabled' };
  }
  var key = process.env.OPENAI_API_KEY;
  if (!key) return { ok: false, reason: 'no_api_key' };

  var resp;
  try {
    var body = {
      model: CAROUSEL_IMAGE_MODEL,
      prompt: prompt,
      size: size,
      quality: q.value,
      n: 1,
    };
    resp = await axios.post(OPENAI_IMAGE_API_URL, body, {
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key },
      timeout: to.value,
    });
  } catch (e) {
    // raw exception message は返さない（URL / key / 内部情報の露出防止）。
    // Bearer [redacted] 方針は維持するが、そもそも message 自体を戻り値へ載せない。
    return { ok: false, reason: 'api_error', detail: { stage: 'request' } };
  }

  var d = resp && resp.data && Array.isArray(resp.data.data) ? resp.data.data[0] : null;
  if (!d || !d.b64_json) return { ok: false, reason: 'no_image_in_response' };

  var buf = base64ToBuffer(d.b64_json);
  if (!buf) return { ok: false, reason: 'invalid_base64', detail: { stage: 'decode' } };

  // actual usage: 公式レスポンス仕様で取得できた場合にのみ載せる。
  //   ★ usage フィールドの存在を前提にしない。無ければ null のままにし、
  //     pre-flight estimate を actual cost として保存しない。
  var usage = extractActualUsage(resp && resp.data);

  return {
    ok: true, mock: false,
    provider: CAROUSEL_IMAGE_PROVIDER, model: CAROUSEL_IMAGE_MODEL,
    size: size, quality: q.value, buffer: buf,
    usage: usage,
  };
}

// レスポンスから actual usage を「取れた場合のみ」抽出する。
//   取得不能なら null（推測値で埋めない）。呼び出し側は null を actual cost として扱ってはならない。
function extractActualUsage(data) {
  if (!data || typeof data !== 'object') return null;
  var u = data.usage;
  if (!u || typeof u !== 'object') return null;
  var out = Number(u.output_tokens);
  var inp = Number(u.input_tokens);
  var hasOut = Number.isFinite(out) && out >= 0;
  var hasIn = Number.isFinite(inp) && inp >= 0;
  if (!hasOut && !hasIn) return null;
  return {
    outputTokens: hasOut ? out : null,
    inputTokens: hasIn ? inp : null,
    source: 'provider_response',
    isActualCost: true,
  };
}

// 取得できた actual usage からのみ実コストを算出する。null なら null を返す（推測しない）。
function actualUsdFromUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  if (!Number.isFinite(Number(usage.outputTokens))) return null;
  return (Number(usage.outputTokens) / 1000000) * IMAGE_OUTPUT_USD_PER_1M;
}

// 既存互換 wrapper（メタのみ・Phase 1 からの呼び出し形を壊さない）。
async function generateBackground(opts) {
  opts = opts || {};
  var prompt = opts.prompt;
  var ratio = opts.aspectRatio || '4:5';
  var isMock = opts.mock !== false;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return { ok: false, reason: 'empty_prompt' };
  }
  if (!looksSafeBackgroundPrompt(prompt)) {
    return { ok: false, reason: 'unsafe_prompt_shape' };
  }
  var ar = validateAspectRatio(ratio);
  if (!ar.ok) return { ok: false, reason: ar.reason };

  if (isMock) return mockBackground(prompt, ar.value);
  if (!REAL_ENABLED) return { ok: false, reason: 'real_api_disabled' };
  return generateBackgroundRaw(Object.assign({}, opts, { aspectRatio: ratio }));
}

module.exports = {
  CAROUSEL_IMAGE_PROVIDER: CAROUSEL_IMAGE_PROVIDER,
  CAROUSEL_IMAGE_MODEL: CAROUSEL_IMAGE_MODEL,
  PROVIDER_REQUEST_SIZE: PROVIDER_REQUEST_SIZE,
  QUALITY_ENUM: QUALITY_ENUM,
  IMAGE_OUTPUT_USD_PER_1M: IMAGE_OUTPUT_USD_PER_1M,
  OUTPUT_TOKENS_BY_QUALITY: OUTPUT_TOKENS_BY_QUALITY,
  OUTPUT_TOKENS_MEASURED_AT_SIZE: OUTPUT_TOKENS_MEASURED_AT_SIZE,
  USD_TO_JPY_STATIC: USD_TO_JPY_STATIC,
  EXCHANGE_RATE_SOURCE: EXCHANGE_RATE_SOURCE,
  ESTIMATE_VERIFIED: ESTIMATE_VERIFIED,
  REAL_ENABLED: REAL_ENABLED,
  DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS: MAX_TIMEOUT_MS,
  outputTokensFor: outputTokensFor,
  estimateImageUsdPerImage: estimateImageUsdPerImage,
  estimateImageUsd: estimateImageUsd,
  estimateImageJpy: estimateImageJpy,
  estimateBreakdown: estimateBreakdown,
  validateQuality: validateQuality,
  validateAspectRatio: validateAspectRatio,
  validateTimeout: validateTimeout,
  looksSafeBackgroundPrompt: looksSafeBackgroundPrompt,
  base64ToBuffer: base64ToBuffer,
  extractActualUsage: extractActualUsage,
  actualUsdFromUsage: actualUsdFromUsage,
  mockBackground: mockBackground,
  generateBackgroundRaw: generateBackgroundRaw,
  generateBackground: generateBackground,
};
