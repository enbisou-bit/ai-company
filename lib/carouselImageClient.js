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

// text input 価格（Phase 2-E Gate 1 Step④ で OpenAI 公式 Pricing のみから確認）。
//   出典: developers.openai.com/api/docs/pricing（gpt-image-2 text input = $5.00 / 1M tokens）。
var TEXT_INPUT_USD_PER_1M = 5.00;

// image input 価格（Phase 2-E Gate 1 Step⑤ で OpenAI 公式 Pricing のみから確認）。
//   出典: developers.openai.com/api/docs/pricing（gpt-image-2 image input = $8.00 / 1M tokens）。
//   ★ cached image input（$2.00/1M）は使用しない（slide毎にpromptが異なりcache hitを前提にできないため）。
//   本コードは reference image を provider へ送っていない（body に画像パラメータなし）ため、
//   通常運用では imageInputTokens は observed 0 または null になる想定。この定数は
//   actual usage 側（Step⑤・観測値からの算出）でのみ使用し、Conservative Reserve（Step④）
//   の見積りには使わない（reserve は text input のみを対象とする設計のため）。
var IMAGE_INPUT_USD_PER_1M = 8.00;

// ══════════════════════════════════════════════════════════════
// Conservative Reserve（Phase 2-E Gate 1 Step④・Final Design 正式承認済み）
//
//   意味: pre-execution authorization reserve。実行前に課金リスクを保守的に見積もる
//   ための内部 authorization allowance であり、以下のいずれでもない:
//     tokenizer maximum / actual usage maximum / billing maximum / invoice guarantee。
//   この値を実 usage が超えないことを保証するものではない。
//
//   初期値 7000 は較正前の initial reserve（ユーザー正式承認済み）。実画像生成から
//   actual usage を収集した後、より小さい値へ縮小するかどうかは別 Decision とする。
//   この定数を変更すると、既発行の approval token は estimated_cost_mismatch で
//   自動的に失効する（署名値と guard 再計算値が一致しなくなるため。意図した安全側動作）。
// ══════════════════════════════════════════════════════════════
var INITIAL_TEXT_INPUT_RESERVE_TOKENS_PER_SLIDE = 7000;

// pre-flight estimate が公式確認済みであることを示すフラグ。
//   ★ 意味は「OpenAI 公式 calculator による事前見積りが公式確認済み」であり、
//     実課金額と完全一致することの保証値ではない。actual usage とは必ず分離して扱う。
var ESTIMATE_VERIFIED = true;

// ── 安全弁（source gate）。実 API を有効化するには Phase 2-E でユーザー承認のうえ true にする ──
//   ★ Production Activation Step PA-1: このsource constantは削除しない。envだけで実APIを
//     有効化できる構造にしないための一次ゲートとして残す（下の dual-key を参照）。
//   ★ Production Activation Step PA-13: ユーザー承認のうえ true へ変更。source gateのみの
//     変更であり、dual-keyのAND条件・env gate（CAROUSEL_IMAGE_REAL_ENABLED）は無変更。
//     Render側env gateが未設定である限り、effective REAL generationは引き続きdisabled。
var _sourceRealEnabled = true;

// ══════════════════════════════════════════════════════════════
// Production Activation Step PA-1: Real Image Generation Dual-Key Kill Switch
//
//   実Image APIへ到達可能なのは、以下2条件を **両方** 満たす場合のみ:
//     (1) source gate : _sourceRealEnabled === true（このファイルの編集でのみ変更可能）
//     (2) env gate     : process.env.CAROUSEL_IMAGE_REAL_ENABLED === 'true'（厳密一致）
//
//   ★ env gateはserver-only。NEXT_PUBLIC_* 名を使わず、browserへ値を返さず、
//     ログへ値を出力しない（本ファイルはこの変数の値を一切ログしない）。
//   ★ fail-closed: 未設定 / '' / 'false' / 'False' / 'TRUE' / '1' / 'yes' / その他任意文字列は
//     すべて disabled。文字列 'true' の完全一致のみ enable（大文字小文字を許容しない）。
//   ★ source gateを残す理由: env変数だけで実解禁できる構造を作らない
//     （Renderの環境変数は本コードよりも変更頻度・変更経路が多く、単独の有効化スイッチには
//     しない）。env gateを追加する理由: source変更にはcommit/push/deployが必要だが、
//     緊急停止（無効化）はRenderのenv変更＋restartだけで即座に行えるようにするため
//     （Render env変更後はprocess restartが必要になる場合がある）。
//   ★ 既存 shared/carouselImageCore.js の assertRealCallAllowed() は
//     `client.REAL_ENABLED !== true` を直接読む（このファイルを変更せず同ファイルは無変更）。
//     そのため REAL_ENABLED の exported値そのものを dual-key の結果にする（下部の
//     Object.defineProperty 参照）。こうすることで、reserve（nonce消費）に到達する前に
//     assertRealCallAllowed の時点で dual-key 不成立を検出できる
//     （env gateだけを generateBackground() 側にしか適用しないと、source=true・env未設定の
//     ときに reserve が先に成功し、providerだけが real_api_disabled で失敗して
//     nonce/budgetを無駄に消費する経路が生まれてしまうため、それを避ける）。
var CAROUSEL_IMAGE_REAL_ENABLED_ENV = 'CAROUSEL_IMAGE_REAL_ENABLED';

function isRealGenerationEnabled() {
  return _sourceRealEnabled === true && process.env[CAROUSEL_IMAGE_REAL_ENABLED_ENV] === 'true';
}

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

// ══════════════════════════════════════════════════════════════
// Conservative Reserve 見積り（純関数・外部 I/O なし）
//
//   ★ estimateImageJpy() は output-only の意味を維持する（変更禁止）。
//     estimated_output_cost_jpy・既存 unit tests がこの意味に依存しているため。
//   以下は authorization reserve（text input 分）を別枠で見積る新規関数群。
// ══════════════════════════════════════════════════════════════

// text input reserve（USD・丸めない生値）。1 slide あたり固定 reserve × 枚数。
function estimateReservedInputUsd(count) {
  var n = Number(count);
  if (!Number.isInteger(n) || n < 0) return null;
  var tokens = INITIAL_TEXT_INPUT_RESERVE_TOKENS_PER_SLIDE * n;
  return (tokens / 1000000) * TEXT_INPUT_USD_PER_1M;
}

// text input reserve（JPY）。
function estimateReservedInputJpy(count) {
  var usd = estimateReservedInputUsd(count);
  if (usd === null) return null;
  return usd * USD_TO_JPY_STATIC;
}

// authorized total = output estimate（output-only・既存 estimateImageJpy）＋ text input reserve。
//   ★ approval token 発行時と real guard 再計算時の両方で、必ずこの関数を使うこと
//     （output-only を署名し guard だけ total を見る、またはその逆、を禁止する）。
function estimateAuthorizedTotalJpy(quality, count) {
  var outputJpy = estimateImageJpy(quality, count);
  if (outputJpy === null) return null;
  var reservedJpy = estimateReservedInputJpy(count);
  if (reservedJpy === null) return null;
  return outputJpy + reservedJpy;
}

// 1 枚あたりの authorized cost（running budget の判定単位）。
function estimateAuthorizedPerCallJpy(quality) {
  return estimateAuthorizedTotalJpy(quality, 1);
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

  // ── 実 API パス（PA-1時点でも到達しない・dual-key未成立） ──
  if (!isRealGenerationEnabled()) {
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

// ══════════════════════════════════════════════════════════════
// Phase 2-E Gate 1 Step⑤: actual usage 抽出（component 単位・観測なしは null）
//
//   ★ reserve（Step④・pre-execution authorization）と actualUsage（本節・post-execution
//     observability）は別概念として完全に分離する。observed していない値を actual へ
//     昇格させない（missing → 0 補完は禁止。provider が明示的に数値 0 を返した場合のみ
//     actual 0 として受理する）。
//   ★ 数値として受理するのは typeof number かつ Number.isFinite かつ >= 0 のみ。
//     文字列（数字に見えるものを含む）・null・undefined・NaN・Infinity・負値は拒否して null。
// ══════════════════════════════════════════════════════════════

// v が「observed な非負有限数値」なら v を、そうでなければ null を返す（0 は正当な観測値として保持）。
function _numOrNull(v) {
  if (typeof v !== 'number') return null;
  return (Number.isFinite(v) && v >= 0) ? v : null;
}

// レスポンスから actual usage を「取れた場合のみ」抽出する。
//   取得不能（cost component が1つも観測できない）なら null（推測値で埋めない）。
//   呼び出し側は null を actual cost として扱ってはならない。
//   mapping: textInputTokens ← usage.input_tokens_details.text_tokens
//            imageInputTokens ← usage.input_tokens_details.image_tokens
//            outputTokens     ← usage.output_tokens
//            totalTokens      ← usage.total_tokens（observability のみ・cost 計算に使わない）
function extractActualUsage(data) {
  if (!data || typeof data !== 'object') return null;
  var u = data.usage;
  if (!u || typeof u !== 'object') return null;
  var details = (u.input_tokens_details && typeof u.input_tokens_details === 'object') ? u.input_tokens_details : null;

  var textInputTokens = details ? _numOrNull(details.text_tokens) : null;
  var imageInputTokens = details ? _numOrNull(details.image_tokens) : null;
  var outputTokens = _numOrNull(u.output_tokens);
  var totalTokens = _numOrNull(u.total_tokens);

  // cost component（text/image/output）が1つも観測できなければ「取得不能」として null。
  var componentCount = (textInputTokens !== null ? 1 : 0) + (imageInputTokens !== null ? 1 : 0) + (outputTokens !== null ? 1 : 0);
  if (componentCount === 0) return null;

  return {
    textInputTokens: textInputTokens,
    imageInputTokens: imageInputTokens,
    outputTokens: outputTokens,
    totalTokens: totalTokens,
    source: 'provider_response',
    completeness: componentCount === 3 ? 'complete' : 'partial',
  };
}

// 取得できた component だけから実コスト（USD）を算出する。observed のない component は
//   0 として合算に寄与させない（合算対象から除外する。0 補完ではなく「無視」）。
//   3 component すべてが null（何も観測できていない）なら null を返す（推測しない）。
//   ★ complete/partial の判定は呼び出し側（job aggregation）の責務。本関数は「観測できた
//     ものだけの合計」を返すのみで、その合計を actual_cost_jpy として確定してよいか
//     known_actual_cost_jpy に留めるべきかは呼び出し側が completeness で判断する。
function actualUsdFromUsage(usage) {
  if (!usage || typeof usage !== 'object') return null;
  var t = _numOrNull(usage.textInputTokens);
  var i = _numOrNull(usage.imageInputTokens);
  var o = _numOrNull(usage.outputTokens);
  if (t === null && i === null && o === null) return null;
  var usd = 0;
  if (t !== null) usd += (t / 1000000) * TEXT_INPUT_USD_PER_1M;
  if (i !== null) usd += (i / 1000000) * IMAGE_INPUT_USD_PER_1M;
  if (o !== null) usd += (o / 1000000) * IMAGE_OUTPUT_USD_PER_1M;
  return usd;
}

// actualUsdFromUsage() の JPY 版（社内 static 為替を使用）。null 伝播は同一。
function actualJpyFromUsage(usage) {
  var usd = actualUsdFromUsage(usage);
  if (usd === null) return null;
  return usd * USD_TO_JPY_STATIC;
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
  if (!isRealGenerationEnabled()) return { ok: false, reason: 'real_api_disabled' };
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
  TEXT_INPUT_USD_PER_1M: TEXT_INPUT_USD_PER_1M,
  IMAGE_INPUT_USD_PER_1M: IMAGE_INPUT_USD_PER_1M,
  INITIAL_TEXT_INPUT_RESERVE_TOKENS_PER_SLIDE: INITIAL_TEXT_INPUT_RESERVE_TOKENS_PER_SLIDE,
  USD_TO_JPY_STATIC: USD_TO_JPY_STATIC,
  EXCHANGE_RATE_SOURCE: EXCHANGE_RATE_SOURCE,
  ESTIMATE_VERIFIED: ESTIMATE_VERIFIED,
  CAROUSEL_IMAGE_REAL_ENABLED_ENV: CAROUSEL_IMAGE_REAL_ENABLED_ENV,
  isRealGenerationEnabled: isRealGenerationEnabled,
  DEFAULT_TIMEOUT_MS: DEFAULT_TIMEOUT_MS,
  MAX_TIMEOUT_MS: MAX_TIMEOUT_MS,
  outputTokensFor: outputTokensFor,
  estimateImageUsdPerImage: estimateImageUsdPerImage,
  estimateImageUsd: estimateImageUsd,
  estimateImageJpy: estimateImageJpy,
  estimateBreakdown: estimateBreakdown,
  estimateReservedInputUsd: estimateReservedInputUsd,
  estimateReservedInputJpy: estimateReservedInputJpy,
  estimateAuthorizedTotalJpy: estimateAuthorizedTotalJpy,
  estimateAuthorizedPerCallJpy: estimateAuthorizedPerCallJpy,
  validateQuality: validateQuality,
  validateAspectRatio: validateAspectRatio,
  validateTimeout: validateTimeout,
  looksSafeBackgroundPrompt: looksSafeBackgroundPrompt,
  base64ToBuffer: base64ToBuffer,
  extractActualUsage: extractActualUsage,
  actualUsdFromUsage: actualUsdFromUsage,
  actualJpyFromUsage: actualJpyFromUsage,
  mockBackground: mockBackground,
  generateBackgroundRaw: generateBackgroundRaw,
  generateBackground: generateBackground,
};

// ── REAL_ENABLED を accessor property として公開する ──────────────
//   ★ 既存 shared/carouselImageCore.js（変更禁止）は `client.REAL_ENABLED !== true` を
//     直接読む単一の checkpoint であるため、その読み取り値自体を dual-key の結果にする。
//     こうすることで、source gate だけがtrueでenv gateが未成立のとき、
//     reserve（nonce消費）より前の assertRealCallAllowed の時点で確実に停止する
//     （generateBackground() 側だけに dual-key を追加すると、reserve成功後に
//     provider呼び出しでだけ失敗し、nonce/budgetを無駄に消費する経路が生まれるため避ける）。
//   ★ 既存テストの `client.REAL_ENABLED = true` / `= false` という save/restore パターン
//     （carouselImageProduction.test.js 等）はこの setter が引き続き受理する
//     （= source gate 側を切り替えるという既存の意味のまま）。読み取り値は
//     source gate と env gate の AND になる点だけが変わる。
Object.defineProperty(module.exports, 'REAL_ENABLED', {
  enumerable: true,
  configurable: true,
  get: function () { return isRealGenerationEnabled(); },
  set: function (v) { _sourceRealEnabled = v; },
});
