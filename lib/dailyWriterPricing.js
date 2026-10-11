'use strict';
// lib/dailyWriterPricing.js
// Instagram Daily Production — Writer（OpenAI）の予約額と精算額の計算（純関数）。
//
//   単位: 金額は整数 micro_jpy（0.000001円）。単価は「USD / 100万トークン」の10進文字列、換算レートは「円 / USD」の10進文字列。
//     tokens × (USD / 1M tokens) × (円 / USD) ＝ tokens × 単価 × レート × 1e-6 円 ＝ tokens × 単価 × レート micro_jpy
//     小数は BigInt で正確に計算し、上限側（切り上げ）に丸める。
//
//   予約額 ＝ 計数 API の入力トークン × 通常入力単価 ＋ max_output_tokens × 出力単価（切り上げ）
//     - 入力はキャッシュ割引を見込まない（通常単価で計算＝上限側）。
//     - max_output_tokens は推論トークンを含む上限（公式 API reference）。pricing.maxOutputIncludesReasoning === true を
//       明示した設定だけを使う（対象モデルで確認していない設定は使用可能扱いにしない）。
//   精算額 ＝ (input − cached) × 入力単価 ＋ cached × キャッシュ入力単価 ＋ output × 出力単価（切り上げ）
//     - cached_tokens は input_tokens の内数、reasoning_tokens は output_tokens の内数として扱い、二重計上しない。
//     - usage の欠落・不整合・未知の応答モデル・料金不明は例外（呼び出し側は予約を保持する）。
//
//   ★ 料金表・換算レート・モデルはこのファイルに既定値として持たない（設定で明示的に渡す）。
//   非責務: 通信・環境変数・日付・乱数の参照。

const DECIMAL_RE = /^(0|[1-9]\d{0,8})(\.\d{1,9})?$/;
const SCALE = 9n;
const ONE = 10n ** SCALE;

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function _isNonNegativeInt(v) { return Number.isSafeInteger(v) && v >= 0; }

// 10進文字列 → 1e9 倍の BigInt（不正は null）
function parseDecimal(text) {
  if (typeof text !== 'string' || !DECIMAL_RE.test(text)) return null;
  const [i, f = ''] = text.split('.');
  return BigInt(i) * ONE + BigInt((f + '000000000').slice(0, 9));
}
// tokens × 単価 × レート（それぞれ 1e9 倍）→ micro_jpy の 1e18 倍の BigInt
function _scaledMicroJpy(tokens, price, rate) { return BigInt(tokens) * price * rate; }
function _ceilToMicroJpy(scaled) {
  const d = ONE * ONE;
  const q = scaled / d;
  return (scaled % d === 0n) ? q : q + 1n;
}

function validatePricing(p) {
  if (!_isPlainObject(p)) return { ok: false, reason: 'pricing_not_configured' };
  if (!_isNonEmptyString(p.pricingVersion)) return { ok: false, reason: 'pricing_version_missing' };
  if (!_isNonEmptyString(p.model)) return { ok: false, reason: 'pricing_model_missing' };
  if (!Array.isArray(p.acceptedResponseModels) || p.acceptedResponseModels.length === 0 || !p.acceptedResponseModels.every(_isNonEmptyString)) {
    return { ok: false, reason: 'accepted_response_models_missing' };
  }
  if (!_isPlainObject(p.usdPerMillion)) return { ok: false, reason: 'unit_prices_missing' };
  if (parseDecimal(p.usdPerMillion.input) === null || parseDecimal(p.usdPerMillion.input) === 0n) return { ok: false, reason: 'input_price_invalid' };
  if (parseDecimal(p.usdPerMillion.output) === null || parseDecimal(p.usdPerMillion.output) === 0n) return { ok: false, reason: 'output_price_invalid' };
  if (p.usdPerMillion.cachedInput !== undefined && parseDecimal(p.usdPerMillion.cachedInput) === null) return { ok: false, reason: 'cached_input_price_invalid' };
  if (parseDecimal(p.jpyPerUsd) === null || parseDecimal(p.jpyPerUsd) === 0n) return { ok: false, reason: 'jpy_rate_invalid' };
  if (!_isNonEmptyString(p.rateVersion)) return { ok: false, reason: 'rate_version_missing' };
  if (p.maxOutputIncludesReasoning !== true) return { ok: false, reason: 'reasoning_inclusion_unconfirmed' };
  return { ok: true };
}

// 予約額（呼び出し前）。countedInputTokens は計数 API の値だけを使う。
function estimateReservation({ countedInputTokens, maxOutputTokens, model, pricing }) {
  const v = validatePricing(pricing);
  if (!v.ok) return v;
  if (model !== pricing.model) return { ok: false, reason: 'pricing_model_mismatch' };
  if (!Number.isSafeInteger(countedInputTokens) || countedInputTokens <= 0) return { ok: false, reason: 'counted_input_invalid' };
  if (!Number.isSafeInteger(maxOutputTokens) || maxOutputTokens <= 0) return { ok: false, reason: 'max_output_tokens_invalid' };
  const rate = parseDecimal(pricing.jpyPerUsd);
  const scaled = _scaledMicroJpy(countedInputTokens, parseDecimal(pricing.usdPerMillion.input), rate) +
                 _scaledMicroJpy(maxOutputTokens, parseDecimal(pricing.usdPerMillion.output), rate);
  const amount = _ceilToMicroJpy(scaled);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER) || amount <= 0n) return { ok: false, reason: 'estimate_out_of_range' };
  return {
    ok: true,
    amount: Number(amount),
    unit: 'micro_jpy',
    basis: 'openai_estimate:' + pricing.model + ':pricing=' + pricing.pricingVersion + ':rate=' + pricing.rateVersion +
      ':counted_input=' + countedInputTokens + ':max_output=' + maxOutputTokens,
  };
}

// 精算額（呼び出し後）。usage は Writer アダプターの包み { provider, responseModel, responseId, raw }。
function costFromUsage(usage, pricing) {
  const v = validatePricing(pricing);
  if (!v.ok) throw new Error('pricing_invalid:' + v.reason);
  if (!_isPlainObject(usage) || usage.provider !== 'openai' || !_isPlainObject(usage.raw)) throw new Error('usage_missing');
  if (!_isNonEmptyString(usage.responseModel) || pricing.acceptedResponseModels.indexOf(usage.responseModel) === -1) throw new Error('unknown_response_model');
  const u = usage.raw;
  if (!_isNonNegativeInt(u.input_tokens) || !_isNonNegativeInt(u.output_tokens)) throw new Error('usage_tokens_invalid');
  if (u.total_tokens !== undefined && u.total_tokens !== u.input_tokens + u.output_tokens) throw new Error('usage_total_mismatch');
  const cached = _isPlainObject(u.input_tokens_details) && u.input_tokens_details.cached_tokens !== undefined ? u.input_tokens_details.cached_tokens : 0;
  const reasoning = _isPlainObject(u.output_tokens_details) && u.output_tokens_details.reasoning_tokens !== undefined ? u.output_tokens_details.reasoning_tokens : 0;
  if (!_isNonNegativeInt(cached) || cached > u.input_tokens) throw new Error('usage_cached_invalid');
  if (!_isNonNegativeInt(reasoning) || reasoning > u.output_tokens) throw new Error('usage_reasoning_invalid');
  if (cached > 0 && pricing.usdPerMillion.cachedInput === undefined) throw new Error('cached_input_price_unknown');
  const rate = parseDecimal(pricing.jpyPerUsd);
  const scaled = _scaledMicroJpy(u.input_tokens - cached, parseDecimal(pricing.usdPerMillion.input), rate) +
                 (cached > 0 ? _scaledMicroJpy(cached, parseDecimal(pricing.usdPerMillion.cachedInput), rate) : 0n) +
                 _scaledMicroJpy(u.output_tokens, parseDecimal(pricing.usdPerMillion.output), rate);   // reasoning は output の内数
  const amount = _ceilToMicroJpy(scaled);
  if (amount > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('cost_out_of_range');
  return {
    amount: Number(amount),
    unit: 'micro_jpy',
    basis: 'openai_usage:' + usage.responseModel + ':pricing=' + pricing.pricingVersion + ':rate=' + pricing.rateVersion +
      ':input=' + u.input_tokens + ':cached=' + cached + ':output=' + u.output_tokens + '(reasoning=' + reasoning + ')' +
      (_isNonEmptyString(usage.responseId) ? ':response=' + usage.responseId : ''),
  };
}

module.exports = { parseDecimal, validatePricing, estimateReservation, costFromUsage };
