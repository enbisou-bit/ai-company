'use strict';
// tools/dailyProduction/runConnectedOnce.js
// Instagram Daily Production — 計数モード（Writer・計数・予算・認可・case・新規保存の接続）で1本だけ制作する実行ツール。
//
//   ★ 現在使えるのは偽 Writer（偽 HTTP）だけ。実 OpenAI への通信（計数 API を含む）の入口は無い（--mode real は常に拒否）。
//     実通信を有効にするには、別途の承認と、このツールへの実装追加が必要。
//   ★ require しただけでは何もしない（通信・制作・.env／環境変数・本番キーの読み込みなし）。起動時も引数の検証が先。
//   ★ 対象 ID・モード・モデル・料金版・上限・パックはすべて明示（plan ファイル・引数）。不足があれば実行前に拒否する。
//   ★ 既存の tools/dailyProduction/runOnce.js（偽 Writer・偽認可・メモリ内）とは別物。どちらも本物の制作ではない。
//
//   モード:
//     dry-run   … 偽 HTTP の Writer・メモリ内の予算ストア・メモリ内の認可（local_fake）・メモリ内の case と Draft 保存
//     local-db  … 偽 HTTP の Writer ＋ 専用ローカル Supabase（127.0.0.1 のみ）の予算ストア・永続認可・cases・output_drafts
//                 鍵は --local-keys で指定したファイルから読む（環境変数は読まない）。本番 URL は拒否。
//     real      … 未実装・常に拒否
//
//   使い方:
//     node tools/dailyProduction/runConnectedOnce.js --mode dry-run --plan <plan.json> --pack <pack.json>
//     node --experimental-websocket tools/dailyProduction/runConnectedOnce.js --mode local-db --plan <plan.json> --pack <pack.json> --local-keys <keys.json>

const fs = require('fs');
const crypto = require('crypto');

const MODES = Object.freeze(['dry-run', 'local-db', 'real']);
const LOCAL_API_URL = 'http://127.0.0.1:54321';
const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{2,127}$/;

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function _isPositiveInt(v) { return Number.isSafeInteger(v) && v > 0; }

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!/^--[a-z-]+$/.test(a) || i + 1 >= argv.length) return { error: 'invalid_argument:' + a };
    out[a.slice(2)] = argv[++i];
  }
  return out;
}

// 実行計画の検証（通信の前）。不足・不正は理由の一覧で拒否する
function validatePlan(mode, plan) {
  const errs = [];
  if (MODES.indexOf(mode) === -1) errs.push('mode');
  if (mode === 'real') errs.push('real_mode_not_enabled');
  if (!_isPlainObject(plan)) return { ok: false, errors: errs.concat(['plan']) };
  ['runId'].forEach(k => { if (typeof plan[k] !== 'string' || !RUN_ID_RE.test(plan[k])) errs.push(k); });
  ['caseId', 'outputId', 'dailyCaseId', 'writerProvider'].forEach(k => { if (!_isNonEmptyString(plan[k])) errs.push(k); });
  if (!_isPositiveInt(plan.packVersion)) errs.push('packVersion');
  if (plan.writerProvider !== undefined && plan.writerProvider !== 'openai') errs.push('writerProvider(openai)');
  if (!_isPlainObject(plan.writer) || !_isNonEmptyString(plan.writer.model)) errs.push('writer.model');
  if (!_isPlainObject(plan.pricing) || !_isNonEmptyString(plan.pricing.pricingVersion)) errs.push('pricing.pricingVersion');
  if (!_isPlainObject(plan.limits) || !_isPositiveInt(plan.limits.dailyLimit) || !_isPositiveInt(plan.limits.monthlyLimit) || !_isPositiveInt(plan.limits.perRunLimit)) errs.push('limits');
  if (mode === 'dry-run' && !_isNonEmptyString(plan.authorizationId)) errs.push('authorizationId(dry-run)');
  if (_isPlainObject(plan) && plan.caseId !== plan.dailyCaseId) errs.push('caseId!=dailyCaseId');
  return { ok: errs.length === 0, errors: errs };
}

function tokyoPeriod(now) {
  const d = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Tokyo', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now || new Date());
  return { dayKey: d, monthKey: d.slice(0, 7), timeZone: 'Asia/Tokyo' };
}

// 偽 Writer（偽 HTTP）: 計数 API と生成 API の応答を固定で返し、呼び出しを数える。実際の OpenAI には接続しない
function createFakeWriterHttp(opts) {
  opts = opts || {};
  const calls = { count: 0, generate: 0 };
  return {
    calls,
    async post(url, body) {
      if (/\/responses\/input_tokens$/.test(url)) { calls.count++; return { status: 200, data: { object: 'response.input_tokens', input_tokens: opts.countedInputTokens || 1500 } }; }
      if (/\/responses$/.test(url)) {
        calls.generate++;
        if (typeof opts.onGenerate === 'function') await opts.onGenerate(body);
        return { status: 200, data: { id: 'resp_fake_' + calls.generate, object: 'response', status: 'completed', model: opts.responseModel,
          output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: opts.text }] }],
          usage: opts.usage || { input_tokens: opts.countedInputTokens || 1500, output_tokens: 900, total_tokens: (opts.countedInputTokens || 1500) + 900 } } };
      }
      return { status: 404, data: null };
    },
  };
}

function computePackHash(pack) {
  return require('../../lib/dailyWriterRequest').sha256Canonical(pack);
}

// 依存一式を組み立てて1本制作する。ctx は moduleOverrides（テスト用）・fakeWriter 設定を受け取る
async function runConnectedOnce({ mode, plan, pack, localKeys, fakeWriter, clients }) {
  const v = validatePlan(mode, plan);
  if (!v.ok) return { ok: false, stage: 'plan', errors: v.errors };
  if (!_isPlainObject(pack)) return { ok: false, stage: 'plan', errors: ['pack'] };
  const service = require('../../lib/dailyProductionService');
  const { createDailyProductionDeps, createCaseBoundaryFromDb } = require('../../lib/dailyProductionConnect');
  const { createSpendGate } = require('../../lib/spendGate');
  const contentValueQuality = require('../../shared/contentValueQuality');
  const contentHash = computePackHash(pack);
  const input = {
    runId: plan.runId, caseId: plan.caseId, outputId: plan.outputId, topicId: pack.topicId, packVersion: plan.packVersion,
    contentHash, pack, period: plan.period || tokyoPeriod(), writerProvider: plan.writerProvider,
  };
  const limits = Object.assign({ amountUnit: 'micro_jpy', timeZone: 'Asia/Tokyo' }, plan.limits);
  const http = createFakeWriterHttp(Object.assign({ responseModel: (plan.pricing.acceptedResponseModels || [])[0] }, fakeWriter || {}));
  let spendGate, authorizationStore, caseBoundary, draftClient;

  if (mode === 'dry-run') {
    const { createMemorySpendStore } = require('./runOnce');
    const { createMemoryAuthorizationStore } = require('../../lib/dailyAuthorizationStore');
    spendGate = createSpendGate({ mode: 'local_verification', store: createMemorySpendStore(), limits });
    authorizationStore = createMemoryAuthorizationStore([{ authorizationId: plan.authorizationId,
      target: { runId: input.runId, caseId: input.caseId, outputId: input.outputId, topicId: input.topicId, packVersion: input.packVersion, contentHash },
      review: { reviewId: 'review-dry-run-fake', topicId: input.topicId, packVersion: input.packVersion, contentHash } }]);
    caseBoundary = { kind: 'local_fake', dailyCaseId: plan.dailyCaseId, caseExists: async id => id === plan.dailyCaseId };
    const rows = new Map();
    draftClient = { kind: 'local_fake', rows, from: () => ({ insert: async row => { if (rows.has(row.output_id)) return { error: { code: '23505' } }; rows.set(row.output_id, row); return { error: null }; } }) };
  } else {
    // local-db: 専用ローカル Supabase（127.0.0.1）だけ
    let svc = clients && clients.service;
    if (!svc) {
      if (!_isPlainObject(localKeys) || !_isNonEmptyString(localKeys.secretKey)) return { ok: false, stage: 'plan', errors: ['local-keys'] };
      const { createClient } = require('@supabase/supabase-js');
      svc = createClient(LOCAL_API_URL, localKeys.secretKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
    }
    const { createSpendStoreSupabase } = require('../../lib/spendStoreSupabase');
    const { createSupabaseAuthorizationStore } = require('../../lib/dailyAuthorizationStoreSupabase');
    spendGate = createSpendGate({ mode: 'local_verification', store: createSpendStoreSupabase({ client: svc }), limits });
    authorizationStore = createSupabaseAuthorizationStore({ client: svc });
    caseBoundary = createCaseBoundaryFromDb({ dailyCaseId: plan.dailyCaseId, client: svc });
    draftClient = svc;
  }

  const built = createDailyProductionDeps({
    mode: 'local_verification',
    writer: { http, apiKey: 'fake-key-for-fake-http', config: plan.writer, pricing: plan.pricing },
    spendGate, authorizationStore, caseBoundary, draftClient, computePackHash,
    evaluateContentValue: async (d, o) => contentValueQuality.evaluateContentValue(d, o),
  });
  if (!built.ok) return { ok: false, stage: 'deps', reason: built.reason, missing: built.missing };
  const result = await service.runDailyProduction(input, built.deps);
  return { ok: true, mode, result, fakeWriterCalls: Object.assign({}, http.calls), draftRows: mode === 'dry-run' ? draftClient.rows : null };
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const fail = (msg, extra) => { console.error(msg + (extra ? ' ' + JSON.stringify(extra) : '')); process.exit(2); };
  if (args.error) fail('引数が不正です', args.error);
  if (args.mode === 'real') fail('実通信モードは無効です（未実装・未承認）。偽 Writer の dry-run／local-db だけを使えます。');
  if (MODES.indexOf(args.mode) === -1) fail('--mode は dry-run または local-db を指定してください');
  if (!args.plan || !args.pack) fail('--plan と --pack は必須です');
  if (args.mode === 'local-db' && !args['local-keys']) fail('local-db には --local-keys が必須です（環境変数は読みません）');
  let plan, pack, localKeys = null;
  try { plan = JSON.parse(fs.readFileSync(args.plan, 'utf8')); pack = JSON.parse(fs.readFileSync(args.pack, 'utf8')); } catch (e) { fail('plan／pack を読めません'); }
  if (args.mode === 'local-db') { try { localKeys = JSON.parse(fs.readFileSync(args['local-keys'], 'utf8')); } catch (e) { fail('--local-keys を読めません'); } }
  const v = validatePlan(args.mode, plan);
  if (!v.ok) fail('実行計画に不足・不正があります（実行していません）', v.errors);
  const fixture = require('./runOnce');
  runConnectedOnce({ mode: args.mode, plan, pack, localKeys, fakeWriter: { text: fixture.FAKE_WRITER_OUTPUT } }).then(out => {
    console.log('【計数モードの1本制作（偽 Writer・' + args.mode + '・本番制作ではない・実 OpenAI へは通信しない）】');
    if (!out.ok) { console.log('停止: ' + out.stage + ' ' + JSON.stringify(out.errors || out.missing || out.reason)); process.exit(1); }
    const r = out.result;
    r.stages.forEach(s => console.log('  ' + (s.status === 'ok' ? '✅' : '❌') + ' ' + s.stage + (s.reason ? '：' + s.reason : '')));
    console.log('結果: ' + r.status + ' ／ approval: ' + r.approval + ' ／ 認可: ' + (r.authorization ? r.authorization.kind : '-'));
    console.log('偽 Writer の呼び出し: 計数 ' + out.fakeWriterCalls.count + '回・生成 ' + out.fakeWriterCalls.generate + '回 ／ 予算: ' + r.billing.state + '（' + r.billing.mode + '）');
    process.exit(r.status === 'awaiting_human_review' ? 0 : 1);
  }).catch(e => { console.error('実行エラー:', e && e.message); process.exit(1); });
}

module.exports = { MODES, LOCAL_API_URL, parseArgs, validatePlan, tokyoPeriod, createFakeWriterHttp, computePackHash, runConnectedOnce };
