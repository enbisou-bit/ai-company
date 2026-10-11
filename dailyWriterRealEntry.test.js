'use strict';
// dailyWriterRealEntry.test.js
// Instagram Daily Production — 1回実行ツールの real モード（実通信の入口）を、偽 HTTP・偽 Supabase client・偽ストアだけで検証する。
//
//   ★ 実 OpenAI（計数 API を含む）・本番 Supabase・本番の鍵は使わない。http／https／net／fetch を遮断して到達 0 を確認する。
//   ★ 成功経路の確認に使う「実証済み」の偽ストア（kind 'test_verified_fake'）はこのテストの中だけのもの。ツールの既定の
//     本番ストアは実証フラグが false のため、必ず拒否される（12 で確認）。
//   ★ 鍵ファイルはテスト用の架空の値（OS の一時フォルダ）。
//
//   使い方: node dailyWriterRealEntry.test.js

['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY'].forEach(k => { delete process.env[k]; });
let NET_ATTEMPTS = 0;
const _block = name => function () { NET_ATTEMPTS++; throw new Error('network blocked in test: ' + name); };
const _http = require('http'), _https = require('https'), _net = require('net');
_http.request = _block('http.request'); _http.get = _block('http.get');
_https.request = _block('https.request'); _https.get = _block('https.get');
_net.connect = _block('net.connect'); _net.createConnection = _block('net.createConnection');
globalThis.fetch = async () => { NET_ATTEMPTS++; throw new Error('network blocked in test: fetch'); };

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const tool = require('./tools/dailyProduction/runConnectedOnce');
const fixture = require('./tools/dailyProduction/runOnce');
const { createSpendGate } = require('./lib/spendGate');
const { createMemoryAuthorizationStore } = require('./lib/dailyAuthorizationStore');

let _passed = 0, _failed = 0;
function assert(cond, label, detail) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : '')); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── TEST FIXTURE ──
const FAKE_OPENAI_KEY = 'sk-test-FIXTURE-real-entry-not-a-key-00000000';
const FAKE_SUPABASE_KEY = 'sb_secret_TEST_FIXTURE_not_a_key_000000000000';
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-real-entry-test-'));
const OPENAI_KEY_FILE = path.join(TMP, 'openai.key'), SUPA_KEY_FILE = path.join(TMP, 'supabase.key');
fs.writeFileSync(OPENAI_KEY_FILE, FAKE_OPENAI_KEY + '\n'); fs.writeFileSync(SUPA_KEY_FILE, FAKE_SUPABASE_KEY + '\n');
const SECRETS = { openaiKeyFile: OPENAI_KEY_FILE, supabaseUrl: 'https://testfixtureref.supabase.co', supabaseKeyFile: SUPA_KEY_FILE };
const PACK = fixture.LOCAL_FIXTURE_PACK;
const PLAN = {
  runId: 'run-real-0001', caseId: 'case-real-daily', dailyCaseId: 'case-real-daily', outputId: 'out_real_0001', packVersion: 1, writerProvider: 'openai',
  writer: { model: 'test-model-fixture', maxOutputTokens: 2000, maxRequestBytes: 60000, timeoutMs: 30000, countTimeoutMs: 10000 },
  pricing: { pricingVersion: 'TEST-FIXTURE-pricing-v1', model: 'test-model-fixture', acceptedResponseModels: ['test-model-fixture-2026-01-01'], usdPerMillion: { input: '0.75', cachedInput: '0.075', output: '4.50' }, jpyPerUsd: '160', rateVersion: 'TEST-FIXTURE-rate-160', maxOutputIncludesReasoning: true },
  limits: { dailyLimit: 20000000, monthlyLimit: 100000000, perRunLimit: 5000000 },
  period: { dayKey: '2026-10-11', monthKey: '2026-10', timeZone: 'Asia/Tokyo' },
};
const NOW = new Date('2026-10-11T12:00:00+09:00');
function permitFor(plan, over) {
  const h = tool.computePlanHashes(plan, PACK);
  return Object.assign({
    permitVersion: 1, runId: plan.runId, caseId: plan.caseId, outputId: plan.outputId, authorizationId: 'auth-real-0001',
    requestHash: h.requestHash, settingsHash: h.settingsHash, contentHash: h.contentHash,
    allowedCalls: { inputTokenCount: 1, generate: 1 }, approvedBy: 'TEST FIXTURE', approvedAt: '2026-10-11T11:00:00+09:00', expiresAt: '2026-10-11T18:00:00+09:00',
  }, over || {});
}
function authRecord(plan, authId) {
  const h = tool.computePlanHashes(plan, PACK);
  const t = { runId: plan.runId, caseId: plan.caseId, outputId: plan.outputId, topicId: PACK.topicId, packVersion: plan.packVersion, contentHash: h.contentHash };
  return { authorizationId: authId || 'auth-real-0001', target: t, review: { reviewId: 'review-real-test', topicId: t.topicId, packVersion: t.packVersion, contentHash: t.contentHash } };
}
// 偽 HTTP（内側）: 計数・生成の応答と呼び出しを記録
function fakeInner(h) {
  h = h || {};
  const calls = [];
  return { calls, async post(url, body, opts) {
    calls.push({ url, hasAuth: !!(opts && opts.headers && /^Bearer /.test(opts.headers.Authorization || '')) });
    if (/input_tokens$/.test(url)) return h.count ? h.count() : { status: 200, data: { object: 'response.input_tokens', input_tokens: 1500 } };
    await sleep(h.genDelayMs || 20);
    if (h.gen) return h.gen();
    return { status: 200, data: { id: 'resp_t', object: 'response', status: 'completed', model: 'test-model-fixture-2026-01-01',
      output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: fixture.FAKE_WRITER_OUTPUT }] }],
      usage: { input_tokens: 1500, output_tokens: 900, total_tokens: 2400 } } };
  } };
}
// 偽 Supabase client（呼び出しを数えるだけ）
function fakeClient() { const calls = []; return { calls, rpc: async (...a) => { calls.push(['rpc', a[0]]); return { data: null, error: { code: 'X' } }; }, from: (t) => { calls.push(['from', t]); return {}; } }; }
// テスト専用の「実証済み」偽ストア一式（ツールの既定ではない）
function verifiedStores(plan, records) {
  const mem = fixture.createMemorySpendStore();
  mem.capabilities = { kind: 'test_verified_fake', atomicReserve: true, atomicityVerified: true };
  const auth = createMemoryAuthorizationStore(records || [authRecord(plan)]);
  auth.kind = 'test_verified_fake'; auth.productionVerified = true; auth.persistent = true;
  const rows = new Map();
  return {
    mem, auth, rows,
    stores: () => ({
      spendGate: createSpendGate({ mode: 'production', store: mem, limits: Object.assign({ amountUnit: 'micro_jpy', timeZone: 'Asia/Tokyo' }, plan.limits) }),
      authorizationStore: auth,
      caseBoundary: { kind: 'test_verified_fake', productionVerified: true, dailyCaseId: plan.dailyCaseId, caseExists: async id => id === plan.dailyCaseId },
      draftClient: { kind: 'test_verified_fake', from: () => ({ insert: async row => { if (rows.has(row.output_id)) return { error: { code: '23505' } }; rows.set(row.output_id, row); return { error: null }; } }) },
    }),
  };
}
const runReal = (o) => tool.runRealOnce(Object.assign({ plan: PLAN, pack: PACK, permit: permitFor(PLAN), secrets: SECRETS, now: NOW }, o));
const allOutputs = [];

(async () => {
  console.log('Instagram Daily Production — 1回実行ツール real モードの入口（偽 HTTP・偽 Supabase・偽ストア）');

  caseHeader('1. 既定は dry-run・real は必須入力が無ければ起動しない（別プロセス）');
  {
    const planFile = path.join(TMP, 'plan.json'), packFile = path.join(TMP, 'pack.json');
    fs.writeFileSync(planFile, JSON.stringify(Object.assign({}, PLAN, { authorizationId: 'auth-dry-0001' }))); fs.writeFileSync(packFile, JSON.stringify(PACK));
    const env = Object.assign({}, process.env); ['OPENAI_API_KEY', 'SUPABASE_URL', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'].forEach(k => delete env[k]);
    const d = spawnSync(process.execPath, ['tools/dailyProduction/runConnectedOnce.js', '--plan', planFile, '--pack', packFile], { cwd: __dirname, env, encoding: 'utf8' });
    allOutputs.push(d.stdout, d.stderr);
    assert(d.status === 0 && /偽 Writer・dry-run/.test(d.stdout) && /実行許可に書く hash/.test(d.stdout), '1-1. --mode 省略 → dry-run（偽 Writer）で実行し、実行許可に書く hash を表示', d.stdout.split('\n')[0]);
    const r = spawnSync(process.execPath, ['tools/dailyProduction/runConnectedOnce.js', '--mode', 'real', '--plan', planFile, '--pack', packFile], { cwd: __dirname, env, encoding: 'utf8' });
    allOutputs.push(r.stdout, r.stderr);
    assert(r.status === 2 && /--permit が必須/.test(r.stderr), '1-2. --mode real だけでは起動しない（--permit なし）', r.stderr.trim());
  }

  caseHeader('2. 実行許可の不足・期限・不一致では通信0');
  {
    const base = permitFor(PLAN);
    for (const [label, permit, code] of [
      ['許可なし', null, 'permit_missing'],
      ['期限切れ', Object.assign({}, base, { approvedAt: '2026-10-11T08:00:00+09:00', expiresAt: '2026-10-11T11:59:59+09:00' }), 'permit_expired'],
      ['承認時刻が未来', Object.assign({}, base, { approvedAt: '2026-10-11T13:00:00+09:00', expiresAt: '2026-10-11T18:00:00+09:00' }), 'permit.approvedAt'],
      ['有効期間 24 時間超', Object.assign({}, base, { approvedAt: '2026-10-11T11:00:00+09:00', expiresAt: '2026-10-12T12:00:00+09:00' }), 'permit.validity(<=24h)'],
      ['runId 不一致', Object.assign({}, base, { runId: 'run-other-0001' }), 'permit.runId_mismatch'],
      ['outputId 不一致', Object.assign({}, base, { outputId: 'out_other' }), 'permit.outputId_mismatch'],
      ['caseId 不一致', Object.assign({}, base, { caseId: 'case-other' }), 'permit.caseId_mismatch'],
      ['確定リクエスト不一致', Object.assign({}, base, { requestHash: '0'.repeat(64) }), 'permit.requestHash_mismatch'],
      ['設定版不一致', Object.assign({}, base, { settingsHash: '0'.repeat(64) }), 'permit.settingsHash_mismatch'],
      ['パック不一致', Object.assign({}, base, { contentHash: '0'.repeat(64) }), 'permit.contentHash_mismatch'],
      ['通信回数 2', Object.assign({}, base, { allowedCalls: { inputTokenCount: 1, generate: 2 } }), 'permit.allowedCalls(1/1)'],
      ['承認者なし', Object.assign({}, base, { approvedBy: '' }), 'permit.approvedBy'],
    ]) {
      const inner = fakeInner(), client = fakeClient();
      const out = await runReal({ permit, factories: { http: () => inner, supabaseClient: () => client, stores: verifiedStores(PLAN).stores } });
      allOutputs.push(JSON.stringify(out));
      assert(out.ok === false && out.stage === 'permit' && out.errors.indexOf(code) !== -1 && inner.calls.length === 0 && client.calls.length === 0, '2. ' + label + ' → ' + code + '・通信0・DB 0', out.errors);
    }
    // 設定を変えると requestHash／settingsHash が変わる（同じ許可は使えない）
    const p2 = Object.assign({}, PLAN, { writer: Object.assign({}, PLAN.writer, { maxOutputTokens: 4000 }) });
    const out = await runReal({ plan: p2, permit: base, factories: { http: () => fakeInner(), supabaseClient: () => fakeClient(), stores: verifiedStores(p2).stores } });
    assert(out.ok === false && out.errors.indexOf('permit.requestHash_mismatch') !== -1 && out.errors.indexOf('permit.settingsHash_mismatch') !== -1, '2-13. 許可の後に出力上限を変えた plan → 確定リクエスト・設定版とも不一致で拒否', out.errors);
  }

  caseHeader('3. 鍵・接続先の不足では通信0（鍵の値は出力しない）');
  {
    for (const [label, secrets, code] of [
      ['OpenAI 鍵ファイルなし', Object.assign({}, SECRETS, { openaiKeyFile: path.join(TMP, 'none.key') }), 'openai-key-file:unreadable'],
      ['Supabase 鍵ファイル未指定', Object.assign({}, SECRETS, { supabaseKeyFile: '' }), 'supabase-key-file:path_missing'],
      ['ローカル URL', Object.assign({}, SECRETS, { supabaseUrl: 'http://127.0.0.1:54321' }), 'supabase-url(https://<ref>.supabase.co)'],
    ]) {
      const inner = fakeInner(), client = fakeClient();
      const out = await runReal({ secrets, factories: { http: () => inner, supabaseClient: () => client, stores: verifiedStores(PLAN).stores } });
      allOutputs.push(JSON.stringify(out));
      assert(out.ok === false && out.stage === 'secrets' && out.errors.indexOf(code) !== -1 && inner.calls.length === 0 && client.calls.length === 0, '3. ' + label + ' → ' + code + '・通信0', out.errors);
    }
    const bad = path.join(TMP, 'bad.key'); fs.writeFileSync(bad, 'short');
    const r = tool.readSecretFile(bad);
    assert(r.ok === false && r.reason === 'invalid_format' && JSON.stringify(r).indexOf('short') === -1, '3-4. 形式の不正な鍵は値を返さずに拒否');
  }

  caseHeader('4. 本番の依存が未実証（既定の本番ストア）なら通信0');
  {
    const inner = fakeInner(), client = fakeClient();
    const out = await runReal({ factories: { http: () => inner, supabaseClient: () => client } });   // stores は既定（実証フラグ false）
    allOutputs.push(JSON.stringify(out));
    assert(out.ok === false && out.stage === 'deps' && out.reason === 'production_dependency_not_connected' &&
      out.errors.indexOf('authorizationStore(productionVerified)') !== -1 && out.errors.indexOf('caseBoundary(productionVerified)') !== -1 && inner.calls.length === 0 && client.calls.length === 0,
      '4-1. 既定の本番ストア（productionVerified=false）→ 接続部が拒否・計数0・生成0・DB 0', out.errors);
  }

  caseHeader('5. 実証済みの偽ストアなら計数1・生成1（実通信の入口の経路確認）');
  {
    const vs = verifiedStores(PLAN);
    const inner = fakeInner();
    const out = await runReal({ factories: { http: () => inner, supabaseClient: () => fakeClient(), stores: vs.stores } });
    allOutputs.push(JSON.stringify(out));
    const r = out.result;
    assert(out.ok && r.status === 'awaiting_human_review' && r.approval === 'not_approved' && out.networkCalls.inputTokenCount === 1 && out.networkCalls.generate === 1 && inner.calls.length === 2 && inner.calls.every(c => c.hasAuth),
      '5-1. 計数1・生成1・Human 確認待ち・未承認', { status: r && r.status, reason: r && r.reason, calls: out.networkCalls });
    assert(r.request.requestHash === permitFor(PLAN).requestHash && r.billing.mode === 'production' && r.billing.state === 'settled' && vs.auth.isConsumed('auth-real-0001'), '5-2. 送った確定リクエストは許可の hash と一致・本番モードの予約→精算・認可は消費済み');
    const again = await runReal({ factories: { http: () => inner, supabaseClient: () => fakeClient(), stores: vs.stores } });
    // メモリ内の偽認可ストアは照合時に使用済みを返さないため、ここでは予約の重複（同じ runId）で止まる。DB の永続ストアでは照合で止まる（ローカル Supabase 検証済み）
    assert(again.ok && again.result.status === 'failed' && ['duplicate_run', 'authorization_already_consumed'].indexOf(again.result.reason) !== -1 && inner.calls.filter(c => /\/responses$/.test(c.url)).length === 1,
      '5-3. 同じ許可で再実行 → 予約の重複または使用済み認可で停止・生成は合計1回のまま', { stage: again.result.failedStage, reason: again.result.reason });
  }

  caseHeader('6. 二重起動（同じ許可・同じ認可の3並列）でも生成1回');
  {
    const vs = verifiedStores(PLAN);
    const inner = fakeInner({ genDelayMs: 60 });
    const outs = await Promise.all([1, 2, 3].map(() => runReal({ factories: { http: () => inner, supabaseClient: () => fakeClient(), stores: vs.stores } })));
    const gens = inner.calls.filter(c => /\/responses$/.test(c.url)).length;
    assert(gens === 1 && outs.filter(o => o.ok && o.result.status === 'awaiting_human_review').length === 1, '6-1. 3 並列 → 生成1回・成功1', outs.map(o => o.ok ? (o.result.reason || o.result.status) : o.stage));
  }

  caseHeader('7. 許可と違う認可・計数失敗・timeout は追加通信なし');
  {
    const vs = verifiedStores(PLAN, [authRecord(PLAN, 'auth-other-0001')]);
    const inner = fakeInner();
    const out = await runReal({ factories: { http: () => inner, supabaseClient: () => fakeClient(), stores: vs.stores } });
    const d = (out.result.stages.find(s => s.status === 'failed') || {}).detail;
    assert(out.ok && out.result.failedStage === 'authorization' && d === 'permit_authorization_mismatch' && inner.calls.length === 0, '7-1. DB の認可 ID が許可と違う → 計数0・生成0', { stage: out.result.failedStage, detail: d });
    const inner2 = fakeInner({ count: () => { throw new Error('ECONNRESET'); } });
    const o2 = await runReal({ factories: { http: () => inner2, supabaseClient: () => fakeClient(), stores: verifiedStores(PLAN).stores } });
    assert(o2.ok && o2.result.failedStage === 'prepare' && o2.networkCalls.inputTokenCount === 1 && o2.networkCalls.generate === 0, '7-2. 計数失敗 → 生成0（計数の再試行なし）', o2.networkCalls);
    const vs3 = verifiedStores(PLAN);
    const inner3 = fakeInner({ gen: () => { const e = new Error('timeout'); e.code = 'ECONNABORTED'; throw e; } });
    const o3 = await runReal({ factories: { http: () => inner3, supabaseClient: () => fakeClient(), stores: vs3.stores } });
    assert(o3.ok && o3.result.reason === 'writer_outcome_unknown' && o3.networkCalls.generate === 1 && inner3.calls.length === 2 && vs3.mem.rows.get(PLAN.runId).state === 'outcome_unknown',
      '7-3. 生成の timeout → 結果不明として予約を保持・生成1回（再試行なし）', { reason: o3.result.reason, calls: o3.networkCalls });
  }

  caseHeader('8. 通信回数の予算（送信前に止める）');
  {
    const inner = fakeInner();
    const b = tool.createCallBudgetHttp(inner, tool.ALLOWED_CALLS);
    const err = async f => { try { await f(); return null; } catch (e) { return e.message; } };
    const e1 = await err(() => b.post('https://api.openai.com/v1/responses', {}, {}));
    await b.post('https://api.openai.com/v1/responses/input_tokens', {}, {});
    const e2 = await err(() => b.post('https://api.openai.com/v1/responses/input_tokens', {}, {}));
    await b.post('https://api.openai.com/v1/responses', {}, {});
    const e3 = await err(() => b.post('https://api.openai.com/v1/responses', {}, {}));
    const e4 = await err(() => b.post('https://example.com/v1/responses', {}, {}));
    const e5 = await err(() => b.post('https://api.openai.com/v1/chat/completions', {}, {}));
    assert(e1 === 'call_blocked:generate_without_count' && e2 === 'call_blocked:inputTokenCount' && e3 === 'call_blocked:generate' && e4 === 'call_blocked:path' && e5 === 'call_blocked:path' && inner.calls.length === 2,
      '8-1. 計数前の生成・2回目の計数・2回目の生成・OpenAI 以外・別経路はすべて送信前に拒否（内側へ届いたのは2回だけ）', [e1, e2, e3, e4, e5]);
  }

  caseHeader('9. 秘密情報・外部通信');
  {
    const dump = allOutputs.join('\n');
    assert(dump.indexOf(FAKE_OPENAI_KEY) === -1 && dump.indexOf(FAKE_SUPABASE_KEY) === -1, '9-1. 結果・エラー・別プロセスの出力に鍵の値が含まれない');
    const src = fs.readFileSync(path.join(__dirname, 'tools/dailyProduction/runConnectedOnce.js'), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert(!/process\.env|dotenv/.test(src), '9-2. ツールのコード部分は環境変数・.env を読まない');
    assert(NET_ATTEMPTS === 0, '9-3. http／https／net／fetch への到達 0 件', NET_ATTEMPTS);
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  console.log(_failed === 0 ? '🟢 All daily writer real-entry cases passed（偽 HTTP・偽 Supabase・偽ストア・実通信なし）' : '🔴 失敗あり');
  process.exit(_failed === 0 ? 0 : 1);
})().catch(e => { console.error('テスト実行エラー:', e && e.message); process.exit(2); });
