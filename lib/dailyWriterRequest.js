'use strict';
// lib/dailyWriterRequest.js
// Instagram Daily Production — OpenAI Writer への生成リクエストの最終形と、入力トークン計数用の本文を作る（純関数）。
//
//   目的: 生成リクエスト（POST /v1/responses）を先に確定し、同じ内容から計数リクエスト
//         （POST /v1/responses/input_tokens）の本文を作る。両者を canonical JSON の SHA-256 で対応づける。
//
//   公式仕様（2026-10-11 に developers.openai.com の API reference で確認）:
//     - 計数 API が受け付ける項目: model / input / instructions / text / reasoning / tools / tool_choice /
//       conversation / previous_response_id / parallel_tool_calls / truncation / personality。
//       max_output_tokens と store は計数 API の項目に無い → 計数本文から除く（生成専用の項目）。
//     - 計数 API の返り値: { object: 'response.input_tokens', input_tokens: <int> }。
//       リクエスト構造の書式トークンを含む正確な数と説明されている。
//     - max_output_tokens は「表示される出力トークンと推論トークンを含む」生成量の上限。
//   ★ 外部ツール・Web 検索・画像・過去応答（previous_response_id / conversation）は使わない（本文に入れない）。
//   ★ store: false（応答をサーバーに保存させない）。temperature は推論モデルで扱いが異なるため送らない。
//   ★ バイト数の上限は入力サイズの防御であり、入力トークン数の上限保証の根拠にはしない（上限の根拠は計数 API の値）。
//
//   非責務: 通信・API キー・環境変数・日付・乱数の参照。

const crypto = require('crypto');

const OUTPUT_TYPE = 'instagram_carousel';
const CONTENT_TYPE = 'value';
const SCHEMA_NAME = 'daily_carousel_copy';
const WRITER_INSTRUCTIONS = [
  'あなたは Instagram カルーセルの文案担当です。',
  'ユーザーの指示に書かれた主張と条件だけを使い、指定の JSON 形だけを返します。',
  '指示にない事実・数値・商品名・URL は書きません。',
].join('\n');

const MODEL_RE = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,99}$/;
const REASONING_EFFORTS = Object.freeze(['minimal', 'low', 'medium', 'high']);
// 計数 API へ送る項目（生成本文からこの項目だけを取り出す。max_output_tokens・store は含めない）
const COUNT_FIELDS = Object.freeze(['model', 'instructions', 'input', 'text', 'reasoning']);
const GENERATION_ONLY_FIELDS = Object.freeze(['max_output_tokens', 'store']);

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _isPositiveInt(v) { return Number.isSafeInteger(v) && v > 0; }

// キー順を固定した JSON（hash の対応づけに使う）
function canonicalJson(v) {
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  if (_isPlainObject(v)) return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
function sha256Canonical(v) { return crypto.createHash('sha256').update(canonicalJson(v), 'utf8').digest('hex'); }
function deepFreeze(v) {
  if (v && typeof v === 'object' && !Object.isFrozen(v)) { Object.freeze(v); Object.keys(v).forEach(k => deepFreeze(v[k])); }
  return v;
}

// Writer 設定の検証（モデル・出力上限・timeout・入力バイト上限は明示必須。既定値を持たない）
function validateWriterConfig(config) {
  if (!_isPlainObject(config)) return { ok: false, reason: 'writer_config_missing' };
  if (typeof config.model !== 'string' || !MODEL_RE.test(config.model)) return { ok: false, reason: 'writer_model_not_configured' };
  if (!_isPositiveInt(config.maxOutputTokens) || config.maxOutputTokens > 32768) return { ok: false, reason: 'max_output_tokens_not_configured' };
  if (!_isPositiveInt(config.maxRequestBytes) || config.maxRequestBytes > 1000000) return { ok: false, reason: 'max_request_bytes_not_configured' };
  if (!_isPositiveInt(config.timeoutMs) || config.timeoutMs < 1000 || config.timeoutMs > 600000) return { ok: false, reason: 'timeout_not_configured' };
  if (!_isPositiveInt(config.countTimeoutMs) || config.countTimeoutMs < 1000 || config.countTimeoutMs > 120000) return { ok: false, reason: 'count_timeout_not_configured' };
  if (config.reasoning !== undefined) {
    if (!_isPlainObject(config.reasoning) || Object.keys(config.reasoning).some(k => k !== 'effort') || REASONING_EFFORTS.indexOf(config.reasoning.effort) === -1) {
      return { ok: false, reason: 'reasoning_config_invalid' };
    }
  }
  return { ok: true };
}

// 制作仕様に合わせた厳格な JSON schema（Structured Outputs・strict）。件数・文字量の検査は dailyCopyValidator が行う。
function buildCopyJsonSchema(spec) {
  const claimIds = Array.isArray(spec.claimIds) ? spec.claimIds.slice() : [];
  const claimIdSchema = claimIds.length ? { type: 'string', enum: claimIds } : { type: 'string' };
  const roles = Array.isArray(spec.slides) ? spec.slides.map(s => s.role) : [];
  const roleSchema = roles.length ? { type: 'string', enum: roles } : { type: 'string' };
  return {
    type: 'object',
    additionalProperties: false,
    required: ['topicId', 'outputType', 'contentType', 'slides', 'caption', 'cta', 'hashtags'],
    properties: {
      topicId: { type: 'string', enum: [spec.topicId] },
      outputType: { type: 'string', enum: [OUTPUT_TYPE] },
      contentType: { type: 'string', enum: [CONTENT_TYPE] },
      slides: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['index', 'role', 'headline', 'lines'],
          properties: {
            index: { type: 'integer' },
            role: roleSchema,
            headline: { type: 'string' },
            lines: {
              type: 'array',
              items: {
                type: 'object',
                additionalProperties: false,
                required: ['text', 'claimIds'],
                properties: { text: { type: 'string' }, claimIds: { type: 'array', items: claimIdSchema } },
              },
            },
          },
        },
      },
      caption: {
        type: 'object',
        additionalProperties: false,
        required: ['text', 'claimIds'],
        properties: { text: { type: 'string' }, claimIds: { type: 'array', items: claimIdSchema } },
      },
      cta: { type: 'string' },
      hashtags: { type: 'array', items: { type: 'string' } },
    },
  };
}

// 生成リクエストの最終形（POST /v1/responses の本文）
function buildGenerationBody(instruction, spec, config) {
  const body = {
    model: config.model,
    instructions: WRITER_INSTRUCTIONS,
    input: instruction,
    text: { format: { type: 'json_schema', name: SCHEMA_NAME, strict: true, schema: buildCopyJsonSchema(spec) } },
    max_output_tokens: config.maxOutputTokens,
    store: false,
  };
  if (config.reasoning) body.reasoning = { effort: config.reasoning.effort };
  return body;
}

// 生成本文から計数本文を作る（計数 API が受け付ける項目だけ・内容は同一）
function countBodyFrom(body) {
  const c = {};
  COUNT_FIELDS.forEach(k => { if (body[k] !== undefined) c[k] = body[k]; });
  return c;
}

// 生成リクエストと計数リクエストを確定する。hash で対応づけ、凍結して返す。
function buildWriterRequest(instruction, spec, config) {
  const cfg = validateWriterConfig(config);
  if (!cfg.ok) return cfg;
  if (typeof instruction !== 'string' || instruction.trim().length === 0) return { ok: false, reason: 'instruction_missing' };
  if (!_isPlainObject(spec) || spec.outputType !== OUTPUT_TYPE || typeof spec.topicId !== 'string') return { ok: false, reason: 'spec_invalid' };
  const body = buildGenerationBody(instruction, spec, config);
  const countBody = countBodyFrom(body);
  const countBytes = Buffer.byteLength(canonicalJson(countBody), 'utf8');
  if (countBytes > config.maxRequestBytes) return { ok: false, reason: 'request_too_large', countBytes };
  return {
    ok: true,
    body: deepFreeze(body),
    countBody: deepFreeze(countBody),
    requestHash: sha256Canonical(body),
    countHash: sha256Canonical(countBody),
    countBytes,
    model: config.model,
    maxOutputTokens: config.maxOutputTokens,
  };
}

// 計数後に入力が変わっていないことの確認（同じ instruction・spec・config から作り直して hash が一致するか）
function verifyWriterRequest(prepared, instruction, spec, config) {
  if (!_isPlainObject(prepared) || !_isPlainObject(prepared.body)) return { ok: false, reason: 'prepared_request_missing' };
  if (sha256Canonical(prepared.body) !== prepared.requestHash) return { ok: false, reason: 'prepared_body_hash_mismatch' };
  if (sha256Canonical(countBodyFrom(prepared.body)) !== prepared.countHash) return { ok: false, reason: 'count_body_hash_mismatch' };
  const rebuilt = buildWriterRequest(instruction, spec, config);
  if (!rebuilt.ok) return { ok: false, reason: 'rebuild_failed:' + rebuilt.reason };
  if (rebuilt.requestHash !== prepared.requestHash) return { ok: false, reason: 'request_changed_after_count' };
  return { ok: true };
}

module.exports = {
  OUTPUT_TYPE, CONTENT_TYPE, SCHEMA_NAME, WRITER_INSTRUCTIONS, COUNT_FIELDS, GENERATION_ONLY_FIELDS, REASONING_EFFORTS,
  canonicalJson, sha256Canonical, deepFreeze,
  validateWriterConfig, buildCopyJsonSchema, buildGenerationBody, countBodyFrom, buildWriterRequest, verifyWriterRequest,
};
