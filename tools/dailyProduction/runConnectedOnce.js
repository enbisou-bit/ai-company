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
//     real      … 実 OpenAI（計数 API 1回・生成 最大1回）＋ 本番 Supabase。次がすべて揃わない限り通信しない:
//                 実行許可ファイル（--permit：run／case／output／認可 ID・確定リクエストの hash・設定の hash・
//                 許可された通信回数 {inputTokenCount:1, generate:1}・有効期限）、鍵ファイルの明示指定、
//                 本番の依存の実証（productionVerified・atomicityVerified）。実証フラグが false の間は必ず拒否される。
//                 HTTP は「回数の予算」で包み、許可外の経路・回数は送信前に止める（自動再試行・fallback なし）。
//   --mode を省略したときは dry-run。
//   ★ 鍵は --openai-key-file／--supabase-key-file のファイルからだけ読む（値を引数に書かない・表示しない）。
//     repo の .env・既存の本番設定・環境変数は読まない。
//
//   使い方:
//     node tools/dailyProduction/runConnectedOnce.js --mode dry-run --plan <plan.json> --pack <pack.json>
//     node --experimental-websocket tools/dailyProduction/runConnectedOnce.js --mode local-db --plan <plan.json> --pack <pack.json> --local-keys <keys.json>
//     node tools/dailyProduction/runConnectedOnce.js --mode real --plan <plan.json> --pack <pack.json> --permit <permit.json> \
//          --openai-key-file <file> --supabase-url <https://….supabase.co> --supabase-key-file <file>

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

// ── real モード: 実行許可・鍵・本番実証を確かめてから、回数の予算つきで1本だけ制作する ─────────────
const OPENAI_V1 = 'https://api.openai.com/v1/';
const ALLOWED_CALLS = Object.freeze({ inputTokenCount: 1, generate: 1 });
const PERMIT_MAX_VALIDITY_MS = 24 * 3600 * 1000;
const HASH_RE = /^[a-f0-9]{64}$/;

// 実行許可に書く hash（通信なしで計算できる）。requestHash は生成リクエストの最終形、settingsHash は設定一式
function computePlanHashes(plan, pack) {
  const contract = require('../../shared/dailyProductionContract');
  const reqLib = require('../../lib/dailyWriterRequest');
  const built = contract.buildProductionSpec(pack);
  if (!built.ok) return { ok: false, reason: 'spec:' + built.reason };
  const instruction = contract.buildWriterInstruction(built.spec, pack);
  const r = reqLib.buildWriterRequest(instruction, built.spec, plan.writer);
  if (!r.ok) return { ok: false, reason: 'request:' + r.reason };
  return {
    ok: true,
    contentHash: computePackHash(pack),
    requestHash: r.requestHash,
    settingsHash: reqLib.sha256Canonical({ writerProvider: plan.writerProvider, writer: plan.writer, pricing: plan.pricing, limits: plan.limits }),
  };
}

// 実行許可の検証（通信の前）。不一致・期限切れ・回数の違いは理由の一覧で拒否
function validatePermit(permit, plan, hashes, now) {
  const errs = [];
  if (!_isPlainObject(permit)) return { ok: false, errors: ['permit_missing'] };
  if (permit.permitVersion !== 1) errs.push('permitVersion');
  ['runId', 'caseId', 'outputId'].forEach(k => { if (permit[k] !== plan[k]) errs.push('permit.' + k + '_mismatch'); });
  if (!_isNonEmptyString(permit.authorizationId)) errs.push('permit.authorizationId');
  if (!HASH_RE.test(String(permit.requestHash)) || permit.requestHash !== hashes.requestHash) errs.push('permit.requestHash_mismatch');
  if (!HASH_RE.test(String(permit.settingsHash)) || permit.settingsHash !== hashes.settingsHash) errs.push('permit.settingsHash_mismatch');
  if (!HASH_RE.test(String(permit.contentHash)) || permit.contentHash !== hashes.contentHash) errs.push('permit.contentHash_mismatch');
  const ac = permit.allowedCalls;
  if (!_isPlainObject(ac) || ac.inputTokenCount !== 1 || ac.generate !== 1 || Object.keys(ac).length !== 2) errs.push('permit.allowedCalls(1/1)');
  if (!_isNonEmptyString(permit.approvedBy)) errs.push('permit.approvedBy');
  const t = (now || new Date()).getTime(), ap = Date.parse(permit.approvedAt), ex = Date.parse(permit.expiresAt);
  if (!isFinite(ap) || !isFinite(ex) || ap > t) errs.push('permit.approvedAt');
  else if (ex <= ap || ex - ap > PERMIT_MAX_VALIDITY_MS) errs.push('permit.validity(<=24h)');
  else if (t >= ex) errs.push('permit_expired');
  return { ok: errs.length === 0, errors: errs };
}

// 鍵ファイルの読み込み（値は返り値の中だけ。エラー・ログに含めない）
function readSecretFile(p) {
  if (!_isNonEmptyString(p)) return { ok: false, reason: 'path_missing' };
  let v;
  try { v = fs.readFileSync(p, 'utf8').trim(); } catch (e) { return { ok: false, reason: 'unreadable' }; }
  if (v.length < 20 || /\s/.test(v)) return { ok: false, reason: 'invalid_format' };
  return { ok: true, value: v };
}

// 通信回数の予算（許可外の経路・回数は送信前に例外。計数の例外は生成へ進まない／生成の例外は結果不明として予約を保持）
function createCallBudgetHttp(inner, allowed) {
  const used = { inputTokenCount: 0, generate: 0, blocked: [] };
  return {
    used,
    async post(url, body, opts) {
      const kind = typeof url !== 'string' || url.indexOf(OPENAI_V1) !== 0 ? null
        : /\/responses\/input_tokens$/.test(url) ? 'inputTokenCount' : /\/responses$/.test(url) ? 'generate' : null;
      if (!kind) { used.blocked.push('path'); throw new Error('call_blocked:path'); }
      if (kind === 'generate' && used.inputTokenCount !== 1) { used.blocked.push('generate_without_count'); throw new Error('call_blocked:generate_without_count'); }
      if (used[kind] >= allowed[kind]) { used.blocked.push(kind); throw new Error('call_blocked:' + kind); }
      used[kind]++;
      return inner.post(url, body, opts);
    },
  };
}

// 本番の依存（既定）: Supabase の予算ストア・永続認可・cases・output_drafts。実証フラグは false のまま（→ 接続部が拒否）
function defaultProductionStores(client, plan) {
  const { createSpendGate } = require('../../lib/spendGate');
  const { createSpendStoreSupabase } = require('../../lib/spendStoreSupabase');
  const { createSupabaseAuthorizationStore } = require('../../lib/dailyAuthorizationStoreSupabase');
  const { createCaseBoundaryFromDb } = require('../../lib/dailyProductionConnect');
  return {
    spendGate: createSpendGate({ mode: 'production', store: createSpendStoreSupabase({ client }), limits: Object.assign({ amountUnit: 'micro_jpy', timeZone: 'Asia/Tokyo' }, plan.limits) }),
    authorizationStore: createSupabaseAuthorizationStore({ client }),
    caseBoundary: createCaseBoundaryFromDb({ dailyCaseId: plan.dailyCaseId, client }),
    draftClient: client,
  };
}

async function runRealOnce({ plan, pack, permit, secrets, factories, now }) {
  factories = factories || {};
  const refuse = (stage, errors) => ({ ok: false, stage, errors, networkCalls: { inputTokenCount: 0, generate: 0 } });
  const v = validatePlan('local-db', plan);
  if (!v.ok) return refuse('plan', v.errors);
  if (!_isPlainObject(pack)) return refuse('plan', ['pack']);
  const hashes = computePlanHashes(plan, pack);
  if (!hashes.ok) return refuse('plan', [hashes.reason]);
  const pv = validatePermit(permit, plan, hashes, now);
  if (!pv.ok) return refuse('permit', pv.errors);
  const s = _isPlainObject(secrets) ? secrets : {};
  if (!_isNonEmptyString(s.supabaseUrl) || !/^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(s.supabaseUrl)) return refuse('secrets', ['supabase-url(https://<ref>.supabase.co)']);
  const ok = readSecretFile(s.openaiKeyFile), sk = readSecretFile(s.supabaseKeyFile);
  if (!ok.ok || !sk.ok) return refuse('secrets', [].concat(ok.ok ? [] : ['openai-key-file:' + ok.reason], sk.ok ? [] : ['supabase-key-file:' + sk.reason]));

  // ここまで通信なし。クライアントと HTTP を作る（作成だけでは通信しない）
  const client = (factories.supabaseClient || ((url, key) => {
    const { createClient } = require('@supabase/supabase-js');
    return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
  }))(s.supabaseUrl, sk.value);
  const inner = (factories.http || (() => require('../../lib/dailyWriterOpenAI').createAxiosHttp(require('axios'))))();
  const http = createCallBudgetHttp(inner, ALLOWED_CALLS);
  const stores = (factories.stores || defaultProductionStores)(client, plan);
  // 認可は実行許可の認可 ID と一致するものだけを使う
  const store = stores.authorizationStore;
  if (store && typeof store.getAuthorization === 'function') {
    const g0 = store.getAuthorization;
    store.getAuthorization = async x => {
      const r = await g0(x);
      if (r && r.authorized === true && r.authorizationId !== permit.authorizationId) return { authorized: false, reason: 'permit_authorization_mismatch' };
      return r;
    };
  }
  const { createDailyProductionDeps } = require('../../lib/dailyProductionConnect');
  const contentValueQuality = require('../../shared/contentValueQuality');
  const built = createDailyProductionDeps({
    mode: 'production',
    writer: { http, apiKey: ok.value, config: plan.writer, pricing: plan.pricing },
    spendGate: stores.spendGate, authorizationStore: store, caseBoundary: stores.caseBoundary, draftClient: stores.draftClient,
    computePackHash, evaluateContentValue: async (d, o) => contentValueQuality.evaluateContentValue(d, o),
  });
  if (!built.ok) return Object.assign(refuse('deps', built.missing || []), { reason: built.reason });
  const service = require('../../lib/dailyProductionService');
  const input = { runId: plan.runId, caseId: plan.caseId, outputId: plan.outputId, topicId: pack.topicId, packVersion: plan.packVersion,
    contentHash: hashes.contentHash, pack, period: plan.period || tokyoPeriod(now), writerProvider: plan.writerProvider };
  const result = await service.runDailyProduction(input, built.deps);
  return { ok: true, mode: 'real', result, networkCalls: { inputTokenCount: http.used.inputTokenCount, generate: http.used.generate }, blocked: http.used.blocked.slice() };
}

if (require.main === module) {
  const args = parseArgs(process.argv.slice(2));
  const fail = (msg, extra) => { console.error(msg + (extra ? ' ' + JSON.stringify(extra) : '')); process.exit(2); };
  if (args.error) fail('引数が不正です', args.error);
  if (args.mode === undefined) args.mode = 'dry-run';   // 既定は dry-run（通信なし）
  if (MODES.indexOf(args.mode) === -1) fail('--mode は dry-run／local-db／real のいずれかです');
  if (args.mode === 'real') {
    if (!args.plan || !args.pack || !args.permit) fail('real には --plan・--pack・--permit が必須です（実行していません）');
    let plan, pack, permit;
    try { plan = JSON.parse(fs.readFileSync(args.plan, 'utf8')); pack = JSON.parse(fs.readFileSync(args.pack, 'utf8')); permit = JSON.parse(fs.readFileSync(args.permit, 'utf8')); } catch (e) { fail('plan／pack／permit を読めません'); }
    runRealOnce({ plan, pack, permit, secrets: { openaiKeyFile: args['openai-key-file'], supabaseUrl: args['supabase-url'], supabaseKeyFile: args['supabase-key-file'] } }).then(out => {
      console.log('【計数モードの1本制作（real）】');
      if (!out.ok) { console.log('停止（通信していません）: ' + out.stage + ' ' + JSON.stringify(out.errors) + (out.reason ? ' ' + out.reason : '')); process.exit(1); }
      const r = out.result;
      r.stages.forEach(x => console.log('  ' + (x.status === 'ok' ? '✅' : '❌') + ' ' + x.stage + (x.reason ? '：' + x.reason : '')));
      console.log('結果: ' + r.status + ' ／ approval: ' + r.approval + ' ／ 通信: 計数 ' + out.networkCalls.inputTokenCount + '回・生成 ' + out.networkCalls.generate + '回 ／ 予算: ' + r.billing.state);
      process.exit(r.status === 'awaiting_human_review' ? 0 : 1);
    }).catch(() => { console.error('実行エラー（詳細は出力しません）'); process.exit(1); });
    return;
  }
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
    const h = computePlanHashes(plan, pack);
    if (h.ok) console.log('実行許可に書く hash（この plan／pack の場合）: requestHash=' + h.requestHash + ' settingsHash=' + h.settingsHash + ' contentHash=' + h.contentHash);
    process.exit(r.status === 'awaiting_human_review' ? 0 : 1);
  }).catch(e => { console.error('実行エラー:', e && e.message); process.exit(1); });
}

module.exports = {
  MODES, LOCAL_API_URL, parseArgs, validatePlan, tokyoPeriod, createFakeWriterHttp, computePackHash, runConnectedOnce,
  ALLOWED_CALLS, PERMIT_MAX_VALIDITY_MS, computePlanHashes, validatePermit, readSecretFile, createCallBudgetHttp, defaultProductionStores, runRealOnce,
};
