'use strict';
// dailyWriterConnection.test.js
// Instagram Daily Production — Writer（OpenAI）・入力トークン計数・費用・1回限りの制作認可・新規 Draft 保存の接続を、
// 偽 HTTP・偽 DB・メモリ内の予算ストアだけで検証する（外部通信なし）。
//
//   ★ 実 OpenAI（計数 API を含む）・実 DB・本番の認証情報は使わない。モジュールを読み込む前に
//     http／https／net／fetch を差し替え、通信の試みを数えて 0 であることを確認する。
//   ★ モデル名・単価・換算レートはすべて TEST FIXTURE（本番の候補・既定値ではない）。
//   ★ 合格は「接続コードが偽 HTTP／偽 DB で契約どおりに動く」ことの確認であり、実 Writer・本番 DB での実証ではない。
//
//   使い方: node dailyWriterConnection.test.js

// ── 外部通信の遮断（どの require よりも先） ──
['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY'].forEach(k => { delete process.env[k]; });
let NET_ATTEMPTS = 0;
const _block = name => function () { NET_ATTEMPTS++; throw new Error('network blocked in test: ' + name); };
const _http = require('http'), _https = require('https'), _net = require('net');
_http.request = _block('http.request'); _http.get = _block('http.get');
_https.request = _block('https.request'); _https.get = _block('https.get');
_net.connect = _block('net.connect'); _net.createConnection = _block('net.createConnection');
globalThis.fetch = async () => { NET_ATTEMPTS++; throw new Error('network blocked in test: fetch'); };

const fs = require('fs');
const path = require('path');
const service = require('./lib/dailyProductionService');
const { createDailyProductionDeps } = require('./lib/dailyProductionConnect');
const { createMemoryAuthorizationStore, createUnconnectedAuthorizationStore } = require('./lib/dailyAuthorizationStore');
const { createSpendGate } = require('./lib/spendGate');
const reqLib = require('./lib/dailyWriterRequest');
const pricingLib = require('./lib/dailyWriterPricing');
const { createDailyWriterOpenAI, PATH_RESPONSES, PATH_INPUT_TOKENS } = require('./lib/dailyWriterOpenAI');
const contentValueQuality = require('./shared/contentValueQuality');
const fixture = require('./tools/dailyProduction/runOnce');

let _passed = 0, _failed = 0;
function assert(cond, label, detail) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label + (detail !== undefined ? ' :: ' + (typeof detail === 'string' ? detail : JSON.stringify(detail)) : '')); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const clone = v => JSON.parse(JSON.stringify(v));

// ── TEST FIXTURE（本番の候補・既定値ではない） ──
const FAKE_API_KEY = 'sk-test-FIXTURE-not-a-real-key-0000000000';
const TEST_MODEL = 'test-model-fixture';
const TEST_RESPONSE_MODEL = 'test-model-fixture-2026-01-01';
const writerConfig = () => ({ model: TEST_MODEL, maxOutputTokens: 2000, maxRequestBytes: 60000, timeoutMs: 30000, countTimeoutMs: 10000 });
const testPricing = () => ({
  pricingVersion: 'TEST-FIXTURE-pricing-v1', model: TEST_MODEL, acceptedResponseModels: [TEST_RESPONSE_MODEL],
  usdPerMillion: { input: '0.75', cachedInput: '0.075', output: '4.50' },
  jpyPerUsd: '160', rateVersion: 'TEST-FIXTURE-rate-160', maxOutputIncludesReasoning: true,
});
const TEST_LIMITS = Object.freeze({ amountUnit: 'micro_jpy', timeZone: 'Asia/Tokyo', dailyLimit: 20000000, monthlyLimit: 100000000, perRunLimit: 5000000 });
const DAILY_CASE = 'case-test-daily-fake';
const AUTH_ID = 'auth-test-0001';

function baseInput(over) {
  const i = fixture.localInput(Object.assign({ runId: 'run-test-0001', caseId: DAILY_CASE, outputId: 'out_test_daily_0001', writerProvider: 'openai' }, over || {}));
  delete i.estimate;   // 計数モードでは見積りを受け取らない
  return i;
}
function targetOf(i) { return { runId: i.runId, caseId: i.caseId, outputId: i.outputId, topicId: i.topicId, packVersion: i.packVersion, contentHash: i.contentHash }; }
function authRecord(i, over) {
  const t = targetOf(i);
  return Object.assign({ authorizationId: AUTH_ID, target: t, review: { reviewId: 'review-test-0001', topicId: t.topicId, packVersion: t.packVersion, contentHash: t.contentHash } }, over || {});
}
function genResponse(over) {
  return Object.assign({
    id: 'resp_test_0001', object: 'response', status: 'completed', model: TEST_RESPONSE_MODEL,
    output: [{ type: 'reasoning', summary: [] }, { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: fixture.FAKE_WRITER_OUTPUT }] }],
    usage: { input_tokens: 1500, input_tokens_details: { cached_tokens: 500 }, output_tokens: 900, output_tokens_details: { reasoning_tokens: 300 }, total_tokens: 2400 },
  }, over || {});
}

// 偽 HTTP（経路ごとの応答を差し替え可能。呼び出しを記録）
function createFakeHttp(h) {
  h = h || {};
  const calls = [];
  return {
    calls,
    count: p => calls.filter(c => c.path === p).length,
    async post(url, body, opts) {
      const p = url.replace('https://api.openai.com/v1', '');
      calls.push({ path: p, url, body: clone(body), hasAuth: !!(opts && opts.headers && /^Bearer /.test(opts.headers.Authorization || '')), timeoutMs: opts && opts.timeoutMs });
      if (p === PATH_INPUT_TOKENS) return h.count ? h.count(body) : { status: 200, data: { object: 'response.input_tokens', input_tokens: 1500 } };
      if (p === PATH_RESPONSES) { await sleep(h.genDelayMs || 20); return h.gen ? h.gen(body) : { status: 200, data: genResponse() }; }
      return { status: 404, data: null };
    },
  };
}
// 偽 Draft client（output_id の主キー一意性を模す）
function createFakeDraftClient() {
  const rows = new Map();
  const st = { mode: 'normal', insertCalls: 0 };
  return {
    kind: 'local_fake', rows, st,
    from(t) {
      if (t !== 'output_drafts') throw new Error('unexpected table');
      return {
        insert: async (row) => {
          st.insertCalls++;
          if (st.mode === 'throw') throw new Error('network');
          if (st.mode === 'nocode') return { error: { message: 'fetch failed', code: '' } };
          if (rows.has(row.output_id)) return { error: { code: '23505', message: 'duplicate key value violates unique constraint "output_drafts_pkey"' } };
          rows.set(row.output_id, clone(row));
          return { error: null, status: 201 };
        },
      };
    },
  };
}
// 超過精算で後続を停止するメモリ内ストア（DB の挙動はローカル Supabase の D-5 で確認済み。ここでは同じ契約の偽物）
function createStoppingStore() {
  const s = fixture.createMemorySpendStore();
  let stopped = false;
  const origReserve = s.reserveAtomic, origSettle = s.settle;
  s.reserveAtomic = async a => (stopped ? { outcome: 'spend_stopped' } : origReserve(a));
  s.settle = async a => {
    const r = s.rows.get(a.runId);
    const res = await origSettle(a);
    if (res.outcome === 'settled' && r && a.settledAmount > r.amount) stopped = true;
    return res;
  };
  s.isStopped = () => stopped;
  return s;
}

// 1 シナリオ分の環境
function env(o) {
  o = o || {};
  const input = o.input || baseInput();
  const http = o.http || createFakeHttp(o.httpHandlers);
  const spendStore = o.spendStore || createStoppingStore();
  const gate = o.gate || createSpendGate({ mode: 'local_verification', store: spendStore, limits: o.limits || TEST_LIMITS });
  const authStore = o.authStore || createMemoryAuthorizationStore([o.authRecord || authRecord(input)]);
  const draftClient = o.draftClient || createFakeDraftClient();
  const config = o.config || writerConfig();
  const pricing = o.pricing || testPricing();
  const built = createDailyProductionDeps({
    mode: o.mode || 'local_verification',
    writer: { http, apiKey: o.apiKey === undefined ? FAKE_API_KEY : o.apiKey, config, pricing },
    spendGate: gate, authorizationStore: authStore,
    caseBoundary: o.caseBoundary || { kind: 'local_fake', dailyCaseId: DAILY_CASE, caseExists: async id => id === DAILY_CASE },
    draftClient, computePackHash: fixture.computePackHash,
    evaluateContentValue: async (d, op) => contentValueQuality.evaluateContentValue(d, op),
  });
  return { input, http, spendStore, gate, authStore, draftClient, config, pricing, built, deps: built.deps };
}
const run = async (e, inputOver) => service.runDailyProduction(inputOver || e.input, e.deps);
const gen = e => e.http.count(PATH_RESPONSES);
const cnt = e => e.http.count(PATH_INPUT_TOKENS);

(async () => {
  console.log('Instagram Daily Production — Writer・計数・費用・認可・新規保存の接続（偽 HTTP・偽 DB）');

  caseHeader('1. 正常系（計数 → 予約 → 認可消費 → 生成1回 → 精算 → 新規保存・未承認）');
  {
    const e = env();
    assert(e.built.ok === true, '1-0. local_verification の依存一式を組み立てられる', e.built);
    const r = await run(e);
    assert(r.status === 'awaiting_human_review' && r.approval === 'not_approved' && r.retries === 0, '1-1. Human 確認待ち・未承認・再試行0', { status: r.status, reason: r.reason });
    assert(r.stages.map(s => s.stage).join(',') === service.COUNTED_STAGES.join(',') && r.stages.every(s => s.status === 'ok'), '1-2. 計数モードの全段階が順番どおり ok', r.stages.map(s => s.stage + ':' + s.status));
    assert(cnt(e) === 1 && gen(e) === 1 && r.counters.writerCalls === 1, '1-3. 計数 API 1回・生成 API 1回（実際の呼び出し回数）');
    // 予約額: 1500×0.75×160 + 2000×4.50×160 = 180,000 + 1,440,000 micro_jpy
    assert(r.billing.reservedAmount === 1620000 && r.request.countedInputTokens === 1500, '1-4. 予約額は計数値と max_output_tokens から 1,620,000 micro_jpy', r.billing);
    // 精算: (1000×0.75 + 500×0.075 + 900×4.50)×160 = 774,000（reasoning 300 は output の内数・二重計上なし）
    assert(r.billing.state === 'settled' && r.billing.settledAmount === 774000 && e.spendStore.rows.get(r.runId).state === 'settled', '1-5. usage に基づき 774,000 micro_jpy で精算', r.billing);
    assert(e.authStore.isConsumed(AUTH_ID) === true && e.authStore.log.filter(x => x.outcome === 'consumed').length === 1, '1-6. 制作認可は1回だけ消費された');
    const row = e.draftClient.rows.get(r.outputId);
    const f = row && row.fields;
    assert(!!row && row.case_id === DAILY_CASE && row.status === 'ready' && row.content_type === 'value' && row.review_state === undefined, '1-7. 新規行を挿入（status=ready は生成完了の語彙・review_state なし＝未承認）', row && { status: row.status, ct: row.content_type });
    assert(f && Array.isArray(f.slides) && f.slides.length === 5 && typeof f.caption === 'string' && f.caption.length > 0 && typeof f.cta === 'string' && f.cta.length > 0 && Array.isArray(f.hashtags) && f.hashtags.length > 0,
      '1-8. 完成 Draft は5枚・caption・CTA・hashtags 一式');
    assert(f && f.dailyProduction.runId === r.runId && f.dailyProduction.authorizationId === AUTH_ID && row.content_value && typeof row.content_value.status === 'string', '1-9. 制作の記録に runId・authorizationId、評価（content_value）を同時に保存');
    const g = e.http.calls.find(c => c.path === PATH_RESPONSES), c = e.http.calls.find(x => x.path === PATH_INPUT_TOKENS);
    assert(g.body.store === false && g.body.max_output_tokens === 2000 && g.body.model === TEST_MODEL && g.body.tools === undefined && g.body.previous_response_id === undefined && g.body.conversation === undefined &&
      g.body.text.format.type === 'json_schema' && g.body.text.format.strict === true, '1-10. 生成本文: store=false・max_output_tokens・tools／過去応答なし・strict JSON schema');
    const expectedCount = clone(g.body); delete expectedCount.max_output_tokens; delete expectedCount.store;
    assert(reqLib.canonicalJson(c.body) === reqLib.canonicalJson(expectedCount) && reqLib.sha256Canonical(g.body) === r.request.requestHash,
      '1-11. 計数本文＝生成本文から max_output_tokens・store を除いたもの（同じ内容）・送った本文の hash＝確定時の hash');
    assert(c.hasAuth && g.hasAuth && c.timeoutMs === 10000 && g.timeoutMs === 30000, '1-12. 認証ヘッダあり・計数／生成とも timeout を明示');
    const dump = JSON.stringify(r) + JSON.stringify([...e.draftClient.rows.values()]);
    assert(dump.indexOf(FAKE_API_KEY) === -1 && dump.indexOf('Bearer') === -1, '1-13. 結果・保存行に API キー・Authorization が含まれない');
  }

  caseHeader('2. 認可・確認記録・case 境界の不一致は計数・予約・Writer へ進まない');
  {
    const i = baseInput();
    const cases = [
      ['認可の contentHash 不一致', { authRecord: authRecord(i, { target: Object.assign(targetOf(i), { contentHash: '0'.repeat(64) }) }) }, 'not_authorized'],
      ['認可の runId 不一致', { authRecord: authRecord(i, { target: Object.assign(targetOf(i), { runId: 'run-other-0001' }) }) }, 'not_authorized'],
      ['確認記録の packVersion 不一致', { authRecord: authRecord(i, { review: { reviewId: 'review-test-0001', topicId: i.topicId, packVersion: 99, contentHash: i.contentHash } }) }, 'review_target_mismatch'],
      ['指定 case 以外', { input: baseInput({ caseId: 'case-other' }) }, 'not_authorized'],
      ['case が存在しない', { caseBoundary: { kind: 'local_fake', dailyCaseId: DAILY_CASE, caseExists: async () => false } }, 'not_authorized'],
      ['case 確認の例外', { caseBoundary: { kind: 'local_fake', dailyCaseId: DAILY_CASE, caseExists: async () => { throw new Error('x'); } } }, 'not_authorized'],
    ];
    for (const [label, o, reason] of cases) {
      const e = env(o);
      const r = await run(e);
      assert(r.failedStage === 'authorization' && r.reason === reason && e.http.calls.length === 0 && r.counters.reserveCalls === 0 && r.counters.writerCalls === 0,
        '2. ' + label + ' → ' + reason + '（' + (r.stages.find(s => s.status === 'failed') || {}).detail + '）・計数0・予約0・Writer 0', { stage: r.failedStage, reason: r.reason, http: e.http.calls.length });
    }
  }

  caseHeader('3. 計数失敗・入力変更・料金不明は Writer 0回（予約もしない）');
  {
    const variants = [
      ['計数 API の通信失敗', { count: () => { throw new Error('ECONNRESET'); } }, 'input_count_unreachable'],
      ['計数 API の HTTP 500', { count: () => ({ status: 500, data: { error: { message: 'x' } } }) }, 'input_count_http_500'],
      ['計数値が不正（0）', { count: () => ({ status: 200, data: { object: 'response.input_tokens', input_tokens: 0 } }) }, 'input_count_invalid'],
      ['計数応答の形が違う', { count: () => ({ status: 200, data: { tokens: 1500 } }) }, 'input_count_invalid'],
    ];
    for (const [label, h, reason] of variants) {
      const e = env({ httpHandlers: h });
      const r = await run(e);
      assert(r.failedStage === 'prepare' && r.reason === reason && gen(e) === 0 && r.counters.reserveCalls === 0, '3. ' + label + ' → ' + reason + '・生成0・予約0', { stage: r.failedStage, reason: r.reason });
    }
    // 計数の後に入力（設定）が変わる → 予約前の確認で停止
    {
      const cfg = writerConfig();
      const e = env({ config: cfg, httpHandlers: { count: () => { cfg.maxOutputTokens = 4000; return { status: 200, data: { object: 'response.input_tokens', input_tokens: 1500 } }; } } });
      const r = await run(e);
      assert(r.failedStage === 'prepare' && r.reason === 'request_changed_after_count' && gen(e) === 0 && r.counters.reserveCalls === 0, '3-5. 計数後に入力が変わった → request_changed_after_count・予約0・生成0', { stage: r.failedStage, reason: r.reason });
    }
    // 料金不明（推論トークンの扱い未確認・料金表のモデル違い・単価なし）→ 依存を組み立てない
    for (const [label, p, why] of [
      ['推論トークンを含むか未確認', Object.assign(testPricing(), { maxOutputIncludesReasoning: false }), 'reasoning_inclusion_unconfirmed'],
      ['料金表のモデルが違う', Object.assign(testPricing(), { model: 'other-model' }), 'pricing_model_mismatch'],
      ['出力単価なし', Object.assign(testPricing(), { usdPerMillion: { input: '0.75' } }), 'output_price_invalid'],
    ]) {
      const e = env({ pricing: p });
      assert(e.built.ok === false && e.built.reason === 'writer_not_configured' && e.built.missing[0] === 'writer:' + why && e.http.calls.length === 0, '3. 料金不明（' + label + '）→ 組み立てない（' + why + '）・通信0', e.built);
    }
    // モデル未設定・入力の大きさの防御
    const noModel = env({ config: Object.assign(writerConfig(), { model: '' }) });
    assert(noModel.built.ok === false && noModel.built.missing[0] === 'writer:writer_model_not_configured', '3-9. モデル未設定 → 組み立てない（既定のモデルを持たない）', noModel.built);
    const tiny = env({ config: Object.assign(writerConfig(), { maxRequestBytes: 100 }) });
    const rt = await run(tiny);
    assert(rt.failedStage === 'prepare' && rt.reason === 'request_too_large' && tiny.http.calls.length === 0, '3-10. 入力のバイト数が上限超え → 計数もしない（大きさの防御。トークン上限の根拠には使わない）', rt.reason);
  }

  caseHeader('4. 予算拒否・予約結果不明・呼び出し開始の結果不明は Writer 0回');
  {
    const e = env({ limits: Object.assign({}, TEST_LIMITS, { perRunLimit: 1000000 }) });
    const r = await run(e);
    assert(r.failedStage === 'reserve' && r.reason === 'per_run_limit_exceeded' && gen(e) === 0 && r.counters.authorizationConsumeCalls === 0 && !e.authStore.isConsumed(AUTH_ID), '4-1. 1回の上限 1,000,000 < 予約額 1,620,000 → 拒否・生成0・認可は未消費', r.reason);
    const s2 = createStoppingStore(); s2.reserveAtomic = async () => { throw new Error('db timeout'); };
    const e2 = env({ spendStore: s2 });
    const r2 = await run(e2);
    assert(r2.failedStage === 'reserve' && r2.reason === 'reservation_outcome_unknown' && r2.billing.state === 'reservation_unknown' && gen(e2) === 0, '4-2. 予約の結果不明 → 生成0', r2.reason);
    const s3 = createStoppingStore(); s3.markInvoked = async () => { throw new Error('db timeout'); };
    const e3 = env({ spendStore: s3 });
    const r3 = await run(e3);
    assert(r3.failedStage === 'invoke_mark' && r3.billing.state === 'reserved_or_invoked_unknown' && gen(e3) === 0, '4-3. 呼び出し開始（invoked への遷移）の結果不明 → 生成0・予約は保持（照合）', r3.billing.state);
    assert(e3.authStore.isConsumed(AUTH_ID) === true, '4-4. このとき認可は消費済み（再利用できない＝安全側。再制作には新しい認可が必要）');
    const s4 = createStoppingStore(); s4.markInvoked = async () => ({ outcome: 'invalid_state:invoked' });
    const e4 = env({ spendStore: s4 });
    const r4 = await run(e4);
    assert(r4.failedStage === 'invoke_mark' && gen(e4) === 0, '4-5.「すでに invoked」の応答は新しい呼び出し許可にしない → 生成0', r4.reason);
  }

  caseHeader('5. 同じ認可の並列実行でも Writer は最大1回（実際の呼び出し回数で確認）');
  {
    // 5-1: 同じ予算ストア・同じ runId ×5（予約の一意性で止まる）
    const shared = createStoppingStore();
    const auth = createMemoryAuthorizationStore([authRecord(baseInput())]);
    const http = createFakeHttp({ genDelayMs: 60 });
    const es = [1, 2, 3, 4, 5].map(() => env({ spendStore: shared, authStore: auth, http }));
    const rs = await Promise.all(es.map(e => run(e)));
    assert(http.count(PATH_RESPONSES) === 1 && rs.filter(r => r.status === 'awaiting_human_review').length === 1 && rs.filter(r => r.reason === 'duplicate_run').length === 4,
      '5-1. 同じ runId ×5 並列 → 生成1回・成功1・duplicate_run 4', rs.map(r => r.reason || r.status));
    // 5-2: 予算ストアが別（予約の一意性が効かない状況を模す）・同じ認可 ×5 並列 → 認可の1回限りの消費だけで勝者1
    const auth2 = createMemoryAuthorizationStore([authRecord(baseInput())]);
    const http2 = createFakeHttp({ genDelayMs: 60 });
    const es2 = [1, 2, 3, 4, 5].map(() => env({ spendStore: createStoppingStore(), authStore: auth2, http: http2 }));
    const rs2 = await Promise.all(es2.map(e => run(e)));
    const losers = rs2.filter(r => r.reason === 'authorization_already_consumed');
    assert(http2.count(PATH_RESPONSES) === 1 && rs2.filter(r => r.status === 'awaiting_human_review').length === 1 && losers.length === 4,
      '5-2. 予約が別でも同じ認可 ×5 並列 → 生成1回・勝者1・already_consumed 4', rs2.map(r => r.reason || r.status));
    assert(losers.every(r => r.billing.state === 'released' && r.counters.writerCalls === 0), '5-3. 敗者は呼び出し前なので予約を解放・Writer 0');
    assert(auth2.log.filter(x => x.outcome === 'consumed').length === 1, '5-4. 消費の記録は1件だけ');
  }

  caseHeader('6. 予算残額が戻っても、使用済みの認可では再呼び出しできない');
  {
    const auth = createMemoryAuthorizationStore([authRecord(baseInput())]);
    const http = createFakeHttp();
    const first = env({ authStore: auth, http });
    const r1 = await run(first);
    const again = env({ authStore: auth, http, spendStore: createStoppingStore() });   // 新しい予算ストア＝残額が戻った状態
    const r2 = await run(again);
    assert(r1.status === 'awaiting_human_review' && r2.failedStage === 'authorization_consume' && r2.reason === 'authorization_already_consumed' && http.count(PATH_RESPONSES) === 1 && r2.billing.state === 'released',
      '6-1. 1回目は成功・2回目（予算は新規）は already_consumed・生成は合計1回・2回目の予約は解放', { r1: r1.status, r2: r2.reason, gen: http.count(PATH_RESPONSES) });
    const unknownAuth = createMemoryAuthorizationStore([authRecord(baseInput())]);
    unknownAuth.consume = async () => { throw new Error('db timeout'); };
    const e3 = env({ authStore: unknownAuth });
    const r3 = await run(e3);
    assert(r3.failedStage === 'authorization_consume' && r3.reason === 'authorization_consume_unknown' && gen(e3) === 0 && r3.billing.state === 'released', '6-2. 認可消費の結果不明 → 生成0・呼び出し前なので予約は解放', r3.reason);
  }

  caseHeader('7. timeout・usage 欠落・不整合では予約を保持（再試行0）');
  {
    const e = env({ httpHandlers: { gen: () => { const err = new Error('timeout of 30000ms exceeded'); err.code = 'ECONNABORTED'; throw err; } } });
    const r = await run(e);
    assert(r.failedStage === 'writer' && r.reason === 'writer_outcome_unknown' && e.spendStore.rows.get(r.runId).state === 'outcome_unknown' && gen(e) === 1 && r.retries === 0,
      '7-1. 送信後の timeout → outcome_unknown として予約を保持・生成1回（再試行0）', { reason: r.reason, state: e.spendStore.rows.get(r.runId).state });
    for (const [label, data, expect] of [
      ['usage 欠落', genResponse({ usage: undefined }), 'invoked_usage_unknown'],
      ['usage 合計の不整合', genResponse({ usage: { input_tokens: 10, output_tokens: 10, total_tokens: 99 } }), 'invoked_usage_unknown'],
      ['cached が input を超える', genResponse({ usage: { input_tokens: 10, input_tokens_details: { cached_tokens: 20 }, output_tokens: 10, total_tokens: 20 } }), 'invoked_usage_unknown'],
      ['未知の応答モデル', genResponse({ model: 'some-other-model' }), 'invoked_usage_unknown'],
    ]) {
      const e2 = env({ httpHandlers: { gen: () => ({ status: 200, data: data }) } });
      const r2 = await run(e2);
      assert(r2.billing.state === expect && e2.spendStore.rows.get(r2.runId).state === 'invoked' && gen(e2) === 1, '7. ' + label + ' → 精算せず予約を保持（invoked）・生成1回', { billing: r2.billing.state });
    }
  }

  caseHeader('8. 超過精算の後は後続の予約を停止');
  {
    const store = createStoppingStore();
    const e = env({ spendStore: store, httpHandlers: { count: () => ({ status: 200, data: { object: 'response.input_tokens', input_tokens: 100 } }), gen: () => ({ status: 200, data: genResponse({ usage: { input_tokens: 20000, output_tokens: 1900, total_tokens: 21900 } }) }) } });
    const r = await run(e);
    // 予約: 100×0.75×160 + 2000×4.5×160 = 1,452,000 ／ 精算: (20000×0.75 + 1900×4.5)×160 = 3,768,000（超過）
    assert(r.billing.reservedAmount === 1452000 && r.billing.state === 'settled' && r.billing.settledAmount === 3768000 && store.isStopped(), '8-1. 実際の入力が計数より多い → 超過のまま精算（切り捨てない）・停止', r.billing);
    const i2 = baseInput({ runId: 'run-test-0002', outputId: 'out_test_daily_0002' });
    const e2 = env({ spendStore: store, input: i2, authRecord: authRecord(i2, { authorizationId: 'auth-test-0002' }) });
    const r2 = await run(e2);
    assert(r2.failedStage === 'reserve' && r2.reason === 'spend_stopped' && gen(e2) === 0 && !e2.authStore.isConsumed('auth-test-0002'), '8-2. 停止後の新しい run（別の認可）は spend_stopped・生成0・認可は未消費', r2.reason);
  }

  caseHeader('9. refusal・incomplete・HTTP エラー・文案不正は再生成しない');
  {
    for (const [label, data, reason, billing] of [
      ['refusal', genResponse({ output: [{ type: 'message', role: 'assistant', content: [{ type: 'refusal', refusal: 'cannot' }] }] }), 'writer_refusal', 'settled'],
      ['incomplete（max_output_tokens）', genResponse({ status: 'incomplete', incomplete_details: { reason: 'max_output_tokens' }, output: [] }), 'writer_incomplete', 'settled'],
      ['tool 呼び出し等の想定外の出力', genResponse({ output: [{ type: 'function_call', name: 'x' }] }), 'writer_unexpected_output', 'settled'],
      ['status failed', genResponse({ status: 'failed', output: [] }), 'writer_not_completed', 'settled'],
    ]) {
      const e = env({ httpHandlers: { gen: () => ({ status: 200, data: data }) } });
      const r = await run(e);
      assert(r.failedStage === 'writer' && r.reason === reason && r.billing.state === billing && gen(e) === 1 && e.draftClient.st.insertCalls === 0, '9. ' + label + ' → ' + reason + '・精算済み・生成1回・保存0', { reason: r.reason, billing: r.billing.state });
    }
    const eh = env({ httpHandlers: { gen: () => ({ status: 500, data: { error: { message: 'server' } } }) } });
    const rh = await run(eh);
    assert(rh.reason === 'writer_http_error' && rh.billing.state === 'invoked_usage_unknown' && eh.spendStore.rows.get(rh.runId).state === 'invoked' && gen(eh) === 1, '9-5. HTTP 500 → 課金の有無不明として予約を保持・生成1回', rh.billing.state);
    const bad = JSON.parse(fixture.FAKE_WRITER_OUTPUT); bad.slides.pop();
    const eb = env({ httpHandlers: { gen: () => ({ status: 200, data: genResponse({ output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: JSON.stringify(bad) }] }] }) }) } });
    const rb = await run(eb);
    assert(rb.failedStage === 'copy_check' && rb.billing.state === 'settled' && gen(eb) === 1 && eb.draftClient.st.insertCalls === 0, '9-6. 文案不正（4枚）→ copy_check で停止・費用は精算済み・再生成0・保存0', rb.reason);
  }

  caseHeader('10. 新規保存: 競合で上書き0・結果不明で再保存0');
  {
    const e = env();
    const existing = { output_id: 'out_test_daily_0001', case_id: DAILY_CASE, status: 'existing', fields: { slides: ['既存'] } };
    e.draftClient.rows.set(existing.output_id, clone(existing));
    const r = await run(e);
    assert(r.failedStage === 'save' && r.reason === 'output_already_exists' && JSON.stringify(e.draftClient.rows.get(existing.output_id)) === JSON.stringify(existing) && e.draftClient.st.insertCalls === 1,
      '10-1. 同じ outputId が既にある → already_exists・既存行は不変（上書き0）・挿入の試行1回', r.reason);
    for (const mode of ['throw', 'nocode']) {
      const e2 = env(); e2.draftClient.st.mode = mode;
      const r2 = await run(e2);
      assert(r2.failedStage === 'save' && r2.reason === 'save_outcome_unknown' && e2.draftClient.st.insertCalls === 1, '10-2. 保存結果不明（' + mode + '）→ save_outcome_unknown・再保存0', r2.reason);
    }
  }

  caseHeader('11. 送信前の不一致は送らない（notSent）');
  {
    const cfg = writerConfig();
    const store = createStoppingStore();
    const origInv = store.markInvoked;
    store.markInvoked = async a => { const res = await origInv(a); cfg.maxOutputTokens = 3000; return res; };   // invoked の後に設定が変わる
    const e = env({ config: cfg, spendStore: store });
    const r = await run(e);
    assert(r.failedStage === 'writer' && r.reason === 'writer_not_sent' && gen(e) === 0 && r.billing.state === 'invoked_not_sent' && store.rows.get(r.runId).state === 'invoked',
      '11-1. invoked 後に入力が変わる → 生成を送らない・予約は invoked のまま保持（照合）', { reason: r.reason, detail: (r.stages.find(s => s.status === 'failed') || {}).detail });
  }

  caseHeader('12. 本番の依存が未接続なら組み立てない（fail-closed）');
  {
    const prodGate = { mode: 'production', reserve: async () => ({}) };
    const p1 = createDailyProductionDeps({ mode: 'production', writer: { http: createFakeHttp(), apiKey: FAKE_API_KEY, config: writerConfig(), pricing: testPricing() }, spendGate: prodGate,
      authorizationStore: createUnconnectedAuthorizationStore(), caseBoundary: { kind: 'local_fake', dailyCaseId: DAILY_CASE, caseExists: async () => true }, draftClient: createFakeDraftClient(),
      computePackHash: fixture.computePackHash, evaluateContentValue: () => ({}) });
    assert(p1.ok === false && p1.reason === 'production_dependency_not_connected' && p1.missing.indexOf('authorizationStore(persistent)') !== -1 && p1.missing.indexOf('caseBoundary(production)') !== -1 && p1.missing.indexOf('draftClient(production)') !== -1,
      '12-1. production: 永続の認可ストア・case 確認・本番 Draft client が未接続 → 拒否', p1);
    const p2 = createDailyProductionDeps({ mode: 'production', writer: {}, spendGate: prodGate, authorizationStore: createMemoryAuthorizationStore([]), caseBoundary: { dailyCaseId: DAILY_CASE, caseExists: async () => true },
      draftClient: { from() {} }, computePackHash: fixture.computePackHash, evaluateContentValue: () => ({}) });
    assert(p2.ok === false && p2.missing.indexOf('authorizationStore(persistent)') !== -1, '12-2. production に偽の認可ストア（local_fake）→ 拒否', p2.missing);
    const p3 = env({ mode: 'local_verification', gate: prodGate });
    assert(p3.built.ok === false && p3.built.missing.indexOf('spendGate.mode=local_verification') !== -1, '12-3. 予算ゲートのモードが接続モードと違う → 拒否', p3.built.missing);
    const p4 = env({ apiKey: '' });
    assert(p4.built.ok === false && p4.built.missing[0] === 'writer:api_key_not_configured', '12-4. API キー未注入 → 拒否（環境変数を読まない）', p4.built.missing);
    const unc = createUnconnectedAuthorizationStore();
    const a = await unc.getAuthorization({ target: {} }), c = await unc.consume({});
    assert(a.authorized === false && a.reason === 'authorization_store_not_connected' && c.ok === false && c.outcome === 'not_connected', '12-5. 未接続の認可ストアは取得・消費とも拒否');
    const w = createDailyWriterOpenAI({});
    const pr = await w.prepare({ instruction: 'x', spec: {} }), cw = await w.callWriter({});
    assert(pr.ok === false && pr.reason === 'http_client_not_configured' && cw.notSent === true, '12-6. HTTP クライアント未注入のアダプターは計数も生成もしない');
  }

  caseHeader('13. 純関数・静的確認');
  {
    // 予約額・精算額（BigInt・切り上げ）
    const est = pricingLib.estimateReservation({ countedInputTokens: 1, maxOutputTokens: 1, model: TEST_MODEL, pricing: testPricing() });
    assert(est.ok && est.amount === 840, '13-1. 1×0.75×160 + 1×4.5×160 = 840 micro_jpy（正確）', est);
    const est2 = pricingLib.estimateReservation({ countedInputTokens: 1, maxOutputTokens: 1, model: TEST_MODEL, pricing: Object.assign(testPricing(), { jpyPerUsd: '150.123456789' }) });
    assert(est2.ok && est2.amount === 789, '13-2. 端数は上限側へ切り上げ（5.25×150.123456789＝788.148… → 789）', est2);
    const u = r => ({ provider: 'openai', responseModel: TEST_RESPONSE_MODEL, responseId: 'resp_x', raw: r });
    const a1 = pricingLib.costFromUsage(u({ input_tokens: 1000, output_tokens: 900, total_tokens: 1900, output_tokens_details: { reasoning_tokens: 0 } }), testPricing()).amount;
    const a2 = pricingLib.costFromUsage(u({ input_tokens: 1000, output_tokens: 900, total_tokens: 1900, output_tokens_details: { reasoning_tokens: 800 } }), testPricing()).amount;
    assert(a1 === a2, '13-3. reasoning_tokens は output の内数（増えても精算額は同じ＝二重計上しない）', [a1, a2]);
    let threw = '';
    try { pricingLib.costFromUsage(u({ input_tokens: 10, input_tokens_details: { cached_tokens: 5 }, output_tokens: 1, total_tokens: 11 }), Object.assign(testPricing(), { usdPerMillion: { input: '0.75', output: '4.50' } })); } catch (e) { threw = e.message; }
    assert(threw === 'cached_input_price_unknown', '13-4. cached があるのにキャッシュ単価が未設定 → 精算しない（予約保持）', threw);
    // 計数本文の項目
    const spec = require('./shared/dailyProductionContract').buildProductionSpec(fixture.LOCAL_FIXTURE_PACK).spec;
    const b = reqLib.buildWriterRequest('指示', spec, Object.assign(writerConfig(), { reasoning: { effort: 'low' } }));
    assert(b.ok && Object.keys(b.countBody).sort().join(',') === 'input,instructions,model,reasoning,text' && b.body.reasoning.effort === 'low' && Object.isFrozen(b.body) && Object.isFrozen(b.body.text.format.schema),
      '13-5. 計数本文の項目は model・instructions・input・text・reasoning（生成本文は凍結）', Object.keys(b.countBody));
    const sch = b.body.text.format.schema;
    assert(sch.additionalProperties === false && sch.required.length === 7 && sch.properties.topicId.enum[0] === spec.topicId && sch.properties.slides.items.properties.lines.items.properties.claimIds.items.enum.join() === spec.claimIds.join(),
      '13-6. strict schema: 追加項目なし・全項目必須・topicId と claimIds を仕様の値に限定');
    // 新規ファイルは環境変数・.env を読まない（静的確認）
    const newFiles = ['lib/dailyWriterRequest.js', 'lib/dailyWriterPricing.js', 'lib/dailyWriterOpenAI.js', 'lib/dailyAuthorizationStore.js', 'lib/dailyProductionConnect.js'];
    const codeOnly = f => fs.readFileSync(path.join(__dirname, f), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).map(l => l.replace(/\s\/\/.*$/, '')).join('\n');
    const offenders = newFiles.filter(f => /process\.env|dotenv|\.env\.local|require\(['"]axios['"]\)|console\.(log|error|warn)/.test(codeOnly(f)));
    assert(offenders.length === 0, '13-7. 新規ファイルのコード部分は process.env・.env・axios の直接 require・ログ出力を含まない（コメントを除いて確認）', offenders);
  }

  caseHeader('14. 外部通信');
  assert(NET_ATTEMPTS === 0, '14-1. http／https／net／fetch への到達 0 件（偽 HTTP・偽 DB だけで実行）', NET_ATTEMPTS);

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  console.log(_failed === 0 ? '🟢 All daily writer connection cases passed（偽 HTTP・偽 DB での検証・実 Writer／本番 DB での実証ではない）' : '🔴 失敗あり');
  process.exit(_failed === 0 ? 0 : 1);
})().catch(e => { console.error('テスト実行エラー:', e && e.message); process.exit(2); });
