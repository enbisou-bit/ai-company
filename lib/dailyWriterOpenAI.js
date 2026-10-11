'use strict';
// lib/dailyWriterOpenAI.js
// Instagram Daily Production — OpenAI Writer アダプター（入力トークン計数 → 生成 → 結果の分類）。
//
//   使い方（接続部 lib/dailyProductionConnect.js から）:
//     const w = createDailyWriterOpenAI({ http, apiKey, config, pricing });
//     w.prepare({ instruction, spec })            … 生成リクエストを確定し、計数 API で入力トークンを数え、予約額を出す
//     w.verify({ prepared, instruction, spec })  … 計数後に入力が変わっていないか（予約の前に確認）
//     w.callWriter({ prepared, ... })            … 確定済みの本文をそのまま1回だけ送る
//     w.estimateCostFromUsage(usage)             … usage から精算額（例外なら呼び出し側は予約を保持）
//
//   ★ require しただけでは通信・秘密の読み込み・起動をしない。http・apiKey・config・pricing はすべて依存注入
//     （環境変数・.env.local を読まない。既定のモデル・料金・HTTP クライアントを持たない）。
//   ★ 自動再試行なし（このファイルは再試行しない。http は timeout を必ず渡し、HTTP エラーで例外にしない形で注入する）。
//   ★ 送信後の timeout・通信エラー（応答の有無が分からない）は例外 WriterOutcomeUnknownError を投げる
//     → 呼び出し側（dailyProductionService）は outcome_unknown として予約を保持する（解放・再試行しない）。
//   ★ HTTP の非 2xx は「応答あり・使用量不明」として返す（課金の有無が分からないため予約は保持される）。
//   ★ API キー・Authorization・生の秘密を戻り値・例外メッセージ・ログに含めない（このファイルはログを書かない）。

const req = require('./dailyWriterRequest');
const pricingLib = require('./dailyWriterPricing');

const OPENAI_BASE_URL = 'https://api.openai.com/v1';
const PATH_RESPONSES = '/responses';
const PATH_INPUT_TOKENS = '/responses/input_tokens';

class WriterOutcomeUnknownError extends Error {
  constructor(code) { super('writer_outcome_unknown:' + code); this.name = 'WriterOutcomeUnknownError'; this.code = code; }
}

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }

// 既存の axios を HTTP 依存として包む（再試行なし・リダイレクトなし・HTTP エラーでも例外にしない）
function createAxiosHttp(axios) {
  if (!axios || typeof axios.post !== 'function') return null;
  return {
    async post(url, body, opts) {
      const res = await axios.post(url, body, {
        headers: opts.headers,
        timeout: opts.timeoutMs,
        maxRedirects: 0,
        validateStatus: () => true,
      });
      return { status: res.status, data: res.data };
    },
  };
}

// 生成応答（POST /v1/responses の 2xx 本文）を分類する
function classifyResponse(data) {
  if (!_isPlainObject(data)) return { outcome: 'invalid_response' };
  const usage = _isPlainObject(data.usage)
    ? { provider: 'openai', responseModel: typeof data.model === 'string' ? data.model : null, responseId: typeof data.id === 'string' ? data.id : null, raw: data.usage }
    : undefined;
  const base = { usage, responseId: typeof data.id === 'string' ? data.id : null, responseModel: typeof data.model === 'string' ? data.model : null };
  if (data.status === 'incomplete') {
    const reason = _isPlainObject(data.incomplete_details) && _isNonEmptyString(data.incomplete_details.reason) ? data.incomplete_details.reason : 'unknown';
    return Object.assign(base, { outcome: 'incomplete', incompleteReason: reason });
  }
  if (data.status !== 'completed') return Object.assign(base, { outcome: 'not_completed', responseStatus: typeof data.status === 'string' ? data.status : null });
  const output = Array.isArray(data.output) ? data.output : [];
  const texts = [];
  let refusal = false, unexpected = false;
  for (const item of output) {
    if (!_isPlainObject(item)) { unexpected = true; continue; }
    if (item.type === 'reasoning') continue;              // 推論の要約（本文ではない）
    if (item.type !== 'message') { unexpected = true; continue; }   // tool 呼び出し等は想定外（tools を送っていない）
    for (const c of (Array.isArray(item.content) ? item.content : [])) {
      if (_isPlainObject(c) && c.type === 'output_text' && typeof c.text === 'string') texts.push(c.text);
      else if (_isPlainObject(c) && c.type === 'refusal') refusal = true;
      else unexpected = true;
    }
  }
  if (refusal) return Object.assign(base, { outcome: 'refusal' });
  if (unexpected) return Object.assign(base, { outcome: 'unexpected_output' });
  if (texts.length !== 1) return Object.assign(base, { outcome: 'invalid_output' });
  return Object.assign(base, { outcome: 'completed', text: texts[0] });
}

function createDailyWriterOpenAI(opts) {
  opts = _isPlainObject(opts) ? opts : {};
  const http = opts.http;
  const apiKey = opts.apiKey;
  const config = opts.config;
  const pricing = opts.pricing;
  const baseUrl = opts.baseUrl || OPENAI_BASE_URL;

  // 依存の確認（不足なら通信しない）
  function _depsError() {
    if (!http || typeof http.post !== 'function') return 'http_client_not_configured';
    if (!_isNonEmptyString(apiKey)) return 'api_key_not_configured';
    const c = req.validateWriterConfig(config);
    if (!c.ok) return c.reason;
    const p = pricingLib.validatePricing(pricing);
    if (!p.ok) return p.reason;
    if (pricing.model !== config.model) return 'pricing_model_mismatch';
    return null;
  }
  const _headers = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + apiKey });

  // 生成リクエストを確定 → 計数 API → 予約額。失敗は { ok:false } で返す（例外にしない・生成しない）
  async function prepare({ instruction, spec }) {
    const de = _depsError();
    if (de) return { ok: false, reason: de };
    const built = req.buildWriterRequest(instruction, spec, config);
    if (!built.ok) return { ok: false, reason: built.reason };
    let res;
    try {
      res = await http.post(baseUrl + PATH_INPUT_TOKENS, built.countBody, { headers: _headers(), timeoutMs: config.countTimeoutMs });
    } catch (e) {
      return { ok: false, reason: 'input_count_unreachable' };
    }
    if (!_isPlainObject(res) || !Number.isInteger(res.status)) return { ok: false, reason: 'input_count_invalid_response' };
    if (res.status < 200 || res.status >= 300) return { ok: false, reason: 'input_count_http_' + res.status };
    const d = res.data;
    if (!_isPlainObject(d) || d.object !== 'response.input_tokens' || !Number.isSafeInteger(d.input_tokens) || d.input_tokens <= 0) {
      return { ok: false, reason: 'input_count_invalid' };
    }
    const est = pricingLib.estimateReservation({ countedInputTokens: d.input_tokens, maxOutputTokens: built.maxOutputTokens, model: built.model, pricing });
    if (!est.ok) return { ok: false, reason: est.reason };
    return {
      ok: true,
      body: built.body,
      requestHash: built.requestHash,
      countHash: built.countHash,
      countBytes: built.countBytes,
      countedInputTokens: d.input_tokens,
      model: built.model,
      maxOutputTokens: built.maxOutputTokens,
      estimate: { amount: est.amount, unit: est.unit, basis: est.basis },
    };
  }

  function verify({ prepared, instruction, spec }) {
    const de = _depsError();
    if (de) return { ok: false, reason: de };
    return req.verifyWriterRequest(prepared, instruction, spec, config);
  }

  // 確定済みの本文を1回だけ送る。送信前の不一致は notSent で返す（通信しない）。
  async function callWriter({ prepared, instruction, spec }) {
    const de = _depsError();
    if (de) return { notSent: true, reason: de };
    const v = req.verifyWriterRequest(prepared, instruction, spec, config);
    if (!v.ok) return { notSent: true, reason: v.reason };
    let res;
    try {
      res = await http.post(baseUrl + PATH_RESPONSES, prepared.body, { headers: _headers(), timeoutMs: config.timeoutMs });
    } catch (e) {
      throw new WriterOutcomeUnknownError(e && e.code === 'ECONNABORTED' ? 'timeout' : 'transport');
    }
    if (!_isPlainObject(res) || !Number.isInteger(res.status)) throw new WriterOutcomeUnknownError('invalid_transport_response');
    if (res.status < 200 || res.status >= 300) return { outcome: 'http_error', httpStatus: res.status, usage: undefined };
    return Object.assign(classifyResponse(res.data), { httpStatus: res.status });
  }

  function estimateCostFromUsage(usage) { return pricingLib.costFromUsage(usage, pricing); }

  return { prepare, verify, callWriter, estimateCostFromUsage, depsError: _depsError };
}

module.exports = {
  OPENAI_BASE_URL, PATH_RESPONSES, PATH_INPUT_TOKENS,
  WriterOutcomeUnknownError, createAxiosHttp, classifyResponse, createDailyWriterOpenAI,
};
