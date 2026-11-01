'use strict';
// dailyWriterRealEntry.test.js
// Instagram Daily Production — 1回実行ツールの real モード（実通信の入口）を、偽 HTTP・偽 Supabase client・偽ストアだけで検証する。
//
//   ★ 実 OpenAI（計数 API を含む）・本番 Supabase・本番の鍵は使わない。親と子プロセスの Node の通信関数を遮断し、全ケースの後で試行 0 を確認する。
//   ★ 成功経路の確認に使う「実証済み」の偽ストア（kind 'test_verified_fake'）はこのテストの中だけのもの。ツールの既定の
//     本番ストアは実証フラグが false のため、必ず拒否される（12 で確認）。
//   ★ 鍵ファイルはテスト用の架空の値（OS の一時フォルダ）。
//
//   使い方: node dailyWriterRealEntry.test.js

['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY'].forEach(k => { delete process.env[k]; });
const fs = require('fs');
const os = require('os');
const path = require('path');

// ── 通信遮断（親はこのファイルの実行時に適用。子は node --require でこのファイルを読み込み、CLI より先に同じ処理を適用する）──
//   遮断した試行はファイルへ同期で追記する（呼び出し側が例外を捕捉しても記録は消えない）。追記できなければ終了コード 97 で止める。
//   実行ごとに各経路を自己確認する（127.0.0.1:9 宛て。遮断が効かない場合でも外部へ出ない宛先）。
const NET_IS_CHILD = process.env.DAILY_NET_BLOCK_ROLE === 'child';
if (require.main !== module && !NET_IS_CHILD) throw new Error('net block role missing');
const NET_DIR = NET_IS_CHILD ? null : fs.mkdtempSync(path.join(os.tmpdir(), 'daily-net-block-'));
const NET_LOG = NET_IS_CHILD ? process.env.DAILY_NET_BLOCK_LOG : path.join(NET_DIR, 'parent.jsonl');
const NET_LABEL = NET_IS_CHILD ? process.env.DAILY_NET_BLOCK_LABEL : 'parent';
let _netSelftest = false;
const _netRecord = entry => {
  try { fs.appendFileSync(NET_LOG, JSON.stringify(Object.assign({ label: NET_LABEL, pid: process.pid }, entry)) + '\n'); } catch (e) { process.exit(97); }
};
const _block = name => function () { _netRecord({ event: 'attempt', target: name, selftest: _netSelftest }); throw new Error('network blocked in test: ' + name); };
const _http = require('http'), _https = require('https'), _net = require('net'), _tls = require('tls'), _http2 = require('http2');
const NET_TARGETS = [['http.request', _http, 'request'], ['http.get', _http, 'get'], ['https.request', _https, 'request'], ['https.get', _https, 'get'],
  ['net.connect', _net, 'connect'], ['net.createConnection', _net, 'createConnection'], ['net.Socket.prototype.connect', _net.Socket.prototype, 'connect'],
  ['tls.connect', _tls, 'connect'], ['http2.connect', _http2, 'connect']];
NET_TARGETS.forEach(([name, obj, key]) => { obj[key] = _block(name); });
globalThis.fetch = async function () { return _block('fetch')(); };
const NET_NAMES = NET_TARGETS.map(t => t[0]).concat('fetch');
_netRecord({ event: 'init', cliLoadedBeforeBlock: Object.keys(require.cache).some(k => /runConnectedOnce/.test(k)), targets: NET_NAMES });
{
  _netSelftest = true;
  const blocked = NET_TARGETS.filter(([, obj, key]) => {
    try { obj[key]({ host: '127.0.0.1', port: 9 }); return false; } catch (e) { return /^network blocked in test/.test(e.message); }
  }).map(t => t[0]);
  globalThis.fetch('http://127.0.0.1:9/').catch(() => {});
  _netSelftest = false;
  _netRecord({ event: 'selftest', blocked });
}
if (NET_IS_CHILD) return;   // 子ではここまで（この後は親のテスト本体）

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

// 子プロセス: 遮断を先に読み込ませて起動する。環境は許可したものだけ渡す（鍵・本番 URL は渡さない）
const CHILD_RUNS = [];
const childRun = (label, nodeArgs) => {
  const log = path.join(NET_DIR, 'child-' + label + '.jsonl');
  const env = {};
  ['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP', 'USERPROFILE', 'HOME'].forEach(k => { if (process.env[k] !== undefined) env[k] = process.env[k]; });
  Object.assign(env, { DAILY_NET_BLOCK_ROLE: 'child', DAILY_NET_BLOCK_LOG: log, DAILY_NET_BLOCK_LABEL: label });
  const r = spawnSync(process.execPath, ['--require', __filename].concat(nodeArgs), { cwd: __dirname, env, encoding: 'utf8' });
  return { r, run: { label, log, pid: r.pid, status: r.status } };
};
const cliRun = (label, cliArgs) => {
  const { r, run } = childRun(label, ['tools/dailyProduction/runConnectedOnce.js'].concat(cliArgs));
  CHILD_RUNS.push(run);
  return r;
};
const readNetLog = file => { try { return fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)); } catch (e) { return []; } };
const realAttempts = entries => entries.filter(e => e.event === 'attempt' && e.selftest !== true).map(e => e.target);
// 遮断の確認（終了コードでは判定しない）: 初期化・CLI より先の適用・全経路の自己確認・自己確認以外の試行 0
function verifyNetBlock(run) {
  const entries = readNetLog(run.log);
  const init = entries.find(e => e.event === 'init' && e.pid === run.pid && e.label === run.label);
  const self = entries.find(e => e.event === 'selftest' && e.pid === run.pid);
  const logged = entries.filter(e => e.event === 'attempt' && e.selftest === true && e.pid === run.pid).map(e => e.target);
  const attempts = realAttempts(entries);
  const ok = !!init && init.cliLoadedBeforeBlock === false && !!self && self.blocked.length === NET_TARGETS.length &&
    NET_NAMES.every(n => logged.indexOf(n) !== -1) && attempts.length === 0;
  return { ok, init: !!init, attempts, logged: logged.length };
}

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
    const d = cliRun('1-1', ['--plan', planFile, '--pack', packFile]);
    allOutputs.push(d.stdout, d.stderr);
    assert(d.status === 0 && /偽 Writer・dry-run/.test(d.stdout) && /実行許可に書く hash/.test(d.stdout), '1-1. --mode 省略 → dry-run（偽 Writer）で実行し、実行許可に書く hash を表示', d.stdout.split('\n')[0]);
    const r = cliRun('1-2', ['--mode', 'real', '--plan', planFile, '--pack', packFile]);
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
    const netAt9 = realAttempts(readNetLog(NET_LOG));
    assert(netAt9.length === 0, '9-3. 親プロセスの遮断対象への試行 0 件（この時点。最終判定は 11）', netAt9);
  }

  caseHeader('10. 結果の記録（UTF-8 JSON・repo 外・上書きしない・通信前に確認）');
  {
    const RDIR = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-real-record-'));
    const rp = name => path.join(RDIR, name);
    const readRec = p => { const b = fs.readFileSync(p); return { bom: b[0] === 0xef && b[1] === 0xbb && b[2] === 0xbf, text: b.toString('utf8'), json: JSON.parse(b.toString('utf8')) }; };
    const JA = /[ぁ-んァ-ヶ一-龥]/;
    // 認証ヘッダー（bearer＋空白・authorization: 形式・JSON の "authorization" キー。いずれも大文字小文字を問わない）・cookie・apikey・環境変数名。
    // 制作認可の authorizationId・工程名の値 "authorization" はキー＋コロンの形ではないため対象外（単純な部分一致にしない）
    const AUTH_HEADER = /bearer\s|(^|[^a-z0-9_])"?authorization"?\s*:/i;
    const noSecret = t => t.indexOf(FAKE_OPENAI_KEY) === -1 && t.indexOf(FAKE_SUPABASE_KEY) === -1 &&
      !AUTH_HEADER.test(t) && !/cookie|apikey|OPENAI_API_KEY|SUPABASE_[A-Z_]*KEY|SUPABASE_URL/i.test(t);

    // 10-1 合格
    {
      const vs = verifiedStores(PLAN), inner = fakeInner(), client = fakeClient();
      const out = await runReal({ resultFile: rp('pass.json'), factories: { http: () => inner, supabaseClient: () => client, stores: vs.stores } });
      const rec = readRec(rp('pass.json')); allOutputs.push(rec.text, JSON.stringify(out));
      const j = rec.json;
      assert(out.ok && out.resultFile.ok && j.status === 'finished' && j.outcome.status === 'awaiting_human_review' && j.networkCalls.inputTokenCount === 1 && j.networkCalls.generate === 1,
        '10-1. 合格 → 記録 finished・awaiting_human_review・計数1・生成1', j.outcome);
      assert(j.writer.called && j.writer.responseModel === 'test-model-fixture-2026-01-01' && j.writer.responseId === 'resp_t' && j.writer.usage.input_tokens === 1500 && j.writer.usage.output_tokens === 900 &&
        j.copyCheck.ruleCheck === 'pass' && j.draft.saved === true && j.billing.state === 'settled' && Number.isSafeInteger(j.billing.settledAmount) && j.request.countedInputTokens === 1500,
        '10-2. 合格の記録に usage・応答モデル・応答 ID・予約と精算・Draft 保存を含む', { usage: j.writer.usage, billing: j.billing });
      assert(!rec.bom && JA.test(j.writer.text) && j.writer.text === fixture.FAKE_WRITER_OUTPUT && j.permitHashes.requestHash === permitFor(PLAN).requestHash && /^[a-f0-9]{64}$/.test(j.toolSha256),
        '10-3. BOM なしの UTF-8 で、日本語の文案がそのまま読める（工具の hash・許可の hash も記録）');
    }
    // 10-4 文案検査に不合格 → 文案と理由コードを記録・Draft には保存しない
    {
      const bad = JSON.parse(fixture.FAKE_WRITER_OUTPUT);
      bad.slides[0].headline = '洗顔のあと、顔がつっぱる感じがするのはなぜなのかを考えてみよう';   // 24 字超
      const badText = JSON.stringify(bad);
      const vs = verifiedStores(PLAN);
      const inner = fakeInner({ gen: () => ({ status: 200, data: { id: 'resp_bad', object: 'response', status: 'completed', model: 'test-model-fixture-2026-01-01',
        output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: badText }] }], usage: { input_tokens: 1500, output_tokens: 700, total_tokens: 2200 } } }) });
      const out = await runReal({ resultFile: rp('copyfail.json'), factories: { http: () => inner, supabaseClient: () => fakeClient(), stores: vs.stores } });
      const rec = readRec(rp('copyfail.json')); allOutputs.push(rec.text, JSON.stringify(out));
      const j = rec.json;
      const codes = (j.copyCheck && j.copyCheck.issues || []).map(i => i.code);
      assert(out.ok && j.outcome.status === 'failed' && j.outcome.failedStage === 'copy_check' && j.outcome.reason === 'copy_rule_check_failed' && codes.indexOf('headline_too_long') !== -1,
        '10-4. 文案検査に不合格 → 記録に理由コード（headline_too_long）', codes);
      assert(j.writer.text === badText && JA.test(j.writer.text) && j.copyCheck.issues.every(i => typeof i.message === 'string' && JA.test(i.message)) && j.billing.state === 'settled' && j.writer.usage.output_tokens === 700,
        '10-5. 不合格の文案・日本語の理由・usage・精算を記録（保存後に読める）');
      assert(j.draft.saved === false && vs.rows.size === 0 && j.networkCalls.generate === 1, '10-6. 不合格の文案は Draft に保存しない・生成は1回のまま', { rows: vs.rows.size });
    }
    // 10-7 通信失敗（生成の timeout）→ 結果不明を記録・予約は保持・再試行なし
    {
      const vs = verifiedStores(PLAN);
      const inner = fakeInner({ gen: () => { const e = new Error('timeout'); e.code = 'ECONNABORTED'; throw e; } });
      const out = await runReal({ resultFile: rp('netfail.json'), factories: { http: () => inner, supabaseClient: () => fakeClient(), stores: vs.stores } });
      const rec = readRec(rp('netfail.json')); allOutputs.push(rec.text, JSON.stringify(out));
      const j = rec.json;
      assert(j.outcome.failedStage === 'writer' && j.outcome.reason === 'writer_outcome_unknown' && j.writer.exception === 'writer_outcome_unknown:timeout' && j.writer.text === null && j.writer.usage === null &&
        j.billing.state === 'outcome_unknown' && j.networkCalls.generate === 1 && inner.calls.filter(c => /\/responses$/.test(c.url)).length === 1,
        '10-7. 生成の timeout → 結果不明・予約保持を記録・生成1回（再試行なし）', { writer: j.writer, billing: j.billing && j.billing.state });
    }
    // 10-8 記録先の問題は通信前に止める（既存ファイルは上書きしない）
    {
      fs.writeFileSync(rp('exists.json'), '{"keep":"既存の記録"}\n');
      for (const [label, p, code] of [
        ['既存ファイル', rp('exists.json'), 'result_file_exists'],
        ['repo 内', path.join(__dirname, 'tmp-daily-record-should-not-exist.json'), 'result_file_inside_repo'],
        ['相対パス', 'record.json', 'result_file_path_not_absolute'],
        ['json 以外', rp('record.txt'), 'result_file_not_json'],
        ['存在しないフォルダ', path.join(RDIR, 'no-such-dir', 'r.json'), 'result_file_not_writable'],
      ]) {
        const inner = fakeInner(), client = fakeClient();
        const out = await runReal({ resultFile: p, factories: { http: () => inner, supabaseClient: () => client, stores: verifiedStores(PLAN).stores } });
        assert(out.ok === false && out.stage === 'result_file' && out.errors[0] === code && inner.calls.length === 0 && client.calls.length === 0, '10-8. ' + label + ' → ' + code + '・通信0・DB 0', out.errors);
      }
      assert(fs.readFileSync(rp('exists.json'), 'utf8') === '{"keep":"既存の記録"}\n' && !fs.existsSync(path.join(__dirname, 'tmp-daily-record-should-not-exist.json')), '10-9. 既存の記録は変わらない・repo 内にファイルを作らない');
    }
    // 10-10 通信後に記録の書き込みが失敗 → 失敗を返す（再試行・再生成なし）
    {
      const vs = verifiedStores(PLAN);
      const p = rp('readonly.json');
      const inner = fakeInner({ gen: () => { fs.chmodSync(p, 0o444); return { status: 200, data: { id: 'resp_ro', object: 'response', status: 'completed', model: 'test-model-fixture-2026-01-01',
        output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: fixture.FAKE_WRITER_OUTPUT }] }], usage: { input_tokens: 1500, output_tokens: 900, total_tokens: 2400 } } }; } });
      const out = await runReal({ resultFile: p, factories: { http: () => inner, supabaseClient: () => fakeClient(), stores: vs.stores } });
      fs.chmodSync(p, 0o644);
      assert(out.ok && out.resultFile.ok === false && out.resultFile.reason === 'result_file_write_failed' && out.networkCalls.generate === 1 && inner.calls.length === 2,
        '10-10. 通信後の記録失敗 → resultFile.ok=false を返す・通信は計数1・生成1のまま', out.resultFile);
    }
    // 10-15 生成後に想定外の例外（精算結果の読み取りで例外）→ 既知の通信回数を保持・不明は 0 にしない・再通信なし
    {
      const vs = verifiedStores(PLAN), inner = fakeInner();
      const stores = () => { const s = vs.stores(); s.spendGate = Object.assign({}, s.spendGate, { settle: async () => ({ get ok() { throw new Error('fixture_unexpected_after_generate'); } }) }); return s; };
      const out = await runReal({ resultFile: rp('exception.json'), factories: { http: () => inner, supabaseClient: () => fakeClient(), stores } });
      const rec = readRec(rp('exception.json')); allOutputs.push(rec.text, JSON.stringify(out));
      const j = rec.json;
      assert(out.ok === false && out.stage === 'exception' && out.resultFile.ok === true && j.status === 'finished' && j.outcome.ok === false && j.outcome.refusedStage === 'exception' &&
        j.outcome.status === null && j.draft.saved === false && vs.rows.size === 0,
        '10-15. 生成後の想定外の例外 → 記録の保存は成功・制作は失敗（Draft なし）として区別', { stage: out.stage, resultFile: out.resultFile });
      assert(j.networkCalls.inputTokenCount === 1 && j.networkCalls.generate === 1 && out.networkCalls.generate === 1 && inner.calls.length === 2 &&
        inner.calls.filter(c => /\/responses$/.test(c.url)).length === 1,
        '10-16. 既存カウンターの値（計数1・生成1）を保持・再通信・再生成なし', j.networkCalls);
      // 取得できない値は null（不明）。一方だけ判明している場合もその値を失わない
      const rb = o => tool.buildResultRecord({ head: { target: {} }, out: o, capture: null, startedAt: 's', finishedAt: 'f' }).networkCalls;
      const cases = [
        [{ ok: false, stage: 'exception', networkCalls: null }, { inputTokenCount: null, generate: null }],
        [{ ok: false, stage: 'exception' }, { inputTokenCount: null, generate: null }],
        [{ ok: false, stage: 'exception', networkCalls: { generate: 1 } }, { inputTokenCount: null, generate: 1 }],
        [{ ok: false, stage: 'exception', networkCalls: { inputTokenCount: 1, generate: undefined } }, { inputTokenCount: 1, generate: null }],
        [{ ok: false, stage: 'plan', networkCalls: { inputTokenCount: 0, generate: 0 } }, { inputTokenCount: 0, generate: 0 }],
      ];
      const bad = cases.filter(([o, want]) => JSON.stringify(rb(o)) !== JSON.stringify(want)).map(([o]) => o.networkCalls);
      assert(bad.length === 0, '10-17. 通信回数の不明は null（0 にしない）・計数と生成を個別に保持・確認済みの 0 は 0', bad);
    }
    // 10-18 文案に小文字・混在表記の bearer → 文案を除いた記録に切り替え・ダミーの値を残さない
    {
      const DUMMY = 'dummy-token-FIXTURE-not-a-secret-0000';
      const failed = [];
      for (const [label, v] of [['小文字', 'bearer '], ['大文字', 'BEARER '], ['混在', 'BeArEr ']]) {
        const vs = verifiedStores(PLAN), name = 'bearer-' + label + '.json';
        const text = fixture.FAKE_WRITER_OUTPUT.replace('"cta":"', '"cta":"' + v + DUMMY + ' ');
        const inner = fakeInner({ gen: () => ({ status: 200, data: { id: 'resp_bearer', object: 'response', status: 'completed', model: 'test-model-fixture-2026-01-01',
          output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text }] }], usage: { input_tokens: 1500, output_tokens: 900, total_tokens: 2400 } } }) });
        const out = await runReal({ resultFile: rp(name), factories: { http: () => inner, supabaseClient: () => fakeClient(), stores: vs.stores } });
        const rec = readRec(rp(name));
        if (!(out.resultFile.ok && rec.json.secretScan === 'redacted' && rec.json.writer.text === null && rec.json.writer.textRedacted === true &&
          rec.text.indexOf(DUMMY) === -1 && !/bearer\s/i.test(rec.text))) failed.push(label);
      }
      assert(failed.length === 0, '10-18. bearer の小文字・大文字・混在 → 文案を除いた記録に切り替え・ダミーの値を保存しない', failed);
      // テストの検出式: 認証ヘッダーの表記揺れは拾い、業務項目は拾わない
      const hit = ['authorization: x', 'Authorization: x', 'AUTHORIZATION:x', '"authorization": "x"', '"Authorization":"x"', 'bearer x', 'Bearer x', 'BEARER x']
        .filter(s => noSecret(s));
      const miss = ['"authorizationId": "auth-real-0001"', '"stage": "authorization"', 'authorization_consume', '制作認可の確認']
        .filter(s => !noSecret(s));
      assert(hit.length === 0 && miss.length === 0, '10-19. 検出式は authorization: と bearer の表記揺れを拾い、authorizationId 等の業務項目は許容する', { notDetected: hit, falsePositive: miss });
    }
    // 10-11 秘密情報
    {
      const vs = verifiedStores(PLAN);
      const leak = fixture.FAKE_WRITER_OUTPUT.replace('"cta":"', '"cta":"' + FAKE_OPENAI_KEY + ' ');
      const inner = fakeInner({ gen: () => ({ status: 200, data: { id: 'resp_leak', object: 'response', status: 'completed', model: 'test-model-fixture-2026-01-01',
        output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: leak }] }], usage: { input_tokens: 1500, output_tokens: 900, total_tokens: 2400 } } }) });
      const out = await runReal({ resultFile: rp('leak.json'), factories: { http: () => inner, supabaseClient: () => fakeClient(), stores: vs.stores } });
      const rec = readRec(rp('leak.json'));
      assert(out.resultFile.ok && rec.json.secretScan === 'redacted' && rec.json.writer.text === null && rec.json.writer.textRedacted === true && rec.text.indexOf(FAKE_OPENAI_KEY) === -1,
        '10-11. 応答に鍵の値が混ざった場合は文案を除いた記録に切り替え、鍵を保存しない');
      const all = fs.readdirSync(RDIR).filter(f => f.endsWith('.json')).map(f => fs.readFileSync(path.join(RDIR, f), 'utf8')).join('\n');
      assert(noSecret(all), '10-12. どの記録にも鍵・認証ヘッダー・cookie・環境変数名が含まれない');
    }
    // 10-13 CLI は --result-file を必須にする（別プロセス・通信なし）
    {
      const planFile = path.join(TMP, 'plan10.json'), packFile = path.join(TMP, 'pack10.json'), permitFile = path.join(TMP, 'permit10.json');
      fs.writeFileSync(planFile, JSON.stringify(PLAN)); fs.writeFileSync(packFile, JSON.stringify(PACK)); fs.writeFileSync(permitFile, JSON.stringify(permitFor(PLAN)));
      const r = cliRun('10-13', ['--mode', 'real', '--plan', planFile, '--pack', packFile, '--permit', permitFile]);
      allOutputs.push(r.stdout, r.stderr);
      assert(r.status === 2 && /--result-file/.test(r.stderr), '10-13. real で --result-file が無ければ起動しない', r.stderr.trim());
    }
    // 10-14 resultFile を渡さない既存の呼び出しは従来どおり（記録しない・流れは同じ）
    {
      const vs = verifiedStores(PLAN);
      const out = await runReal({ factories: { http: () => fakeInner(), supabaseClient: () => fakeClient(), stores: vs.stores } });
      assert(out.ok && out.result.status === 'awaiting_human_review' && out.resultFile === undefined, '10-14. resultFile なしの呼び出しは従来どおり（記録項目なし）');
    }
    // 10-20 保存先の実体（使い捨てのテスト用 repo とジャンクション。本物の repo は使わない）
    {
      const JD = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-real-junction-'));
      const repo = path.join(JD, 'repoX'), inner = path.join(repo, 'inner'), sibling = path.join(JD, 'repoX-sibling'), realOut = path.join(JD, 'real-out');
      [path.join(inner, 'deep'), sibling, realOut].forEach(d => fs.mkdirSync(d, { recursive: true }));
      fs.symlinkSync(inner, path.join(JD, 'link-in'), 'junction');
      fs.symlinkSync(realOut, path.join(JD, 'link-out'), 'junction');
      const listRepo = () => fs.readdirSync(repo, { recursive: true }).filter(f => /\.json$/.test(String(f)));
      for (const [label, p] of [['親がジャンクション', path.join(JD, 'link-in', 'r.json')], ['上位がジャンクション', path.join(JD, 'link-in', 'deep', 'r.json')]]) {
        const http = fakeInner(), client = fakeClient();
        const out = await runReal({ resultFile: p, factories: { http: () => http, supabaseClient: () => client, stores: verifiedStores(PLAN).stores, repoRoot: repo } });
        assert(out.ok === false && out.stage === 'result_file' && out.errors[0] === 'result_file_inside_repo' && http.calls.length === 0 && client.calls.length === 0 && listRepo().length === 0,
          '10-20. ' + label + '（見かけは外・実体はテスト用 repo 内）→ 拒否・JSON なし・通信0・DB 0', { errors: out.errors, files: listRepo() });
      }
      const open = (p, root) => tool.openResultFile(p, { fixture: true }, root || repo);
      const upper = path.join(path.dirname(repo), path.basename(repo).toUpperCase(), 'c.json');
      const slash = path.join(repo, 's.json').split(path.sep).join('/');
      assert(open(upper).reason === 'result_file_inside_repo' && open(slash).reason === 'result_file_inside_repo' && listRepo().length === 0, '10-21. 大文字小文字・区切りが違っても repo 内として拒否', listRepo());
      const sib = open(path.join(sibling, 'r.json'));
      assert(sib.ok && fs.existsSync(path.join(sibling, 'r.json')), '10-22. 共通の名前で始まる別ディレクトリは repo 外として保存できる', sib);
      const viaOut = open(path.join(JD, 'link-out', 'r.json'));
      const expected = path.join(fs.realpathSync.native(realOut), 'r.json');
      assert(viaOut.ok && viaOut.path === expected && fs.existsSync(path.join(realOut, 'r.json')) && open(path.join(JD, 'link-out', 'r.json')).reason === 'result_file_exists',
        '10-23. repo 外への経由は親の実体パスで排他作成（既存は上書きしない）', viaOut);
      const noRoot = open(path.join(realOut, 'n.json'), path.join(JD, 'no-such-repo'));
      assert(noRoot.ok === false && noRoot.reason === 'result_file_repo_unresolved' && !fs.existsSync(path.join(realOut, 'n.json')), '10-24. repo の実体を確認できない → 作成前に拒否', noRoot);
    }
    // 10-25 最初の記録は固定の状態だけ。ID・hash は実行許可の検査を通った後にだけ記録する
    {
      const p = rp('started.json');
      let seen = null;
      const inner = fakeInner({ gen: () => { seen = fs.readFileSync(p, 'utf8'); return { status: 200, data: { id: 'resp_s', object: 'response', status: 'completed', model: 'test-model-fixture-2026-01-01',
        output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: fixture.FAKE_WRITER_OUTPUT }] }], usage: { input_tokens: 1500, output_tokens: 900, total_tokens: 2400 } } }; } });
      const vs = verifiedStores(PLAN);
      const out = await runReal({ resultFile: p, factories: { http: () => inner, supabaseClient: () => fakeClient(), stores: vs.stores } });
      const keys = seen ? Object.keys(JSON.parse(seen)).sort().join(',') : null;
      assert(keys === 'recordVersion,startedAt,status,tool,toolSha256', '10-25. 最初の記録は固定の項目だけ（ID・hash を含まない）', keys);
      const j = readRec(p).json;
      assert(out.ok && j.target.runId === PLAN.runId && j.permitHashes.contentHash === permitFor(PLAN).contentHash, '10-26. 検査を通った実行の最終の記録には ID・hash が載る', j.target);
      const MARK = 'UNVERIFIED-INPUT-MARK-0000';
      const c = fakeInner();
      const bad = await runReal({ resultFile: rp('unverified.json'), permit: permitFor(PLAN, { authorizationId: MARK, runId: 'run-mismatch-' + MARK, evidence: { x: MARK } }),
        factories: { http: () => c, supabaseClient: () => fakeClient(), stores: verifiedStores(PLAN).stores } });
      const rec = readRec(rp('unverified.json'));
      assert(bad.ok === false && bad.stage === 'permit' && rec.text.indexOf(MARK) === -1 && rec.json.target === null && rec.json.permitHashes === null && c.calls.length === 0,
        '10-27. 実行許可で拒否された入力の ID・hash は記録しない・通信0', { stage: bad.stage, target: rec.json.target });
    }
  }

  caseHeader('11. 外部通信の遮断の最終判定（全ケース・子プロセスの終了後）');
  {
    const expectedChildren = ['1-1', '1-2', '10-13'];
    assert(JSON.stringify(CHILD_RUNS.map(c => c.label)) === JSON.stringify(expectedChildren), '11-1. CLI の子プロセスは 3 つ（すべて遮断を読み込んで起動）', CHILD_RUNS.map(c => c.label));
    for (const c of CHILD_RUNS) {
      const v = verifyNetBlock(c);
      assert(v.ok, '11-2. 子 ' + c.label + '（終了コード ' + c.status + '）: 初期化・CLI より先の適用・全 ' + NET_NAMES.length + ' 経路の遮断を確認、自己確認以外の試行 0', v);
    }
    // 判定方法そのものの確認: 終了コードが期待どおりでも、遮断が無ければ不合格。捕捉された試行も検出する
    const noPreload = spawnSync(process.execPath, ['-e', 'process.exit(2)'], { encoding: 'utf8', env: { SystemRoot: process.env.SystemRoot || '' } });
    const v1 = verifyNetBlock({ label: 'none', log: path.join(NET_DIR, 'child-none.jsonl'), pid: noPreload.pid });
    assert(noPreload.status === 2 && v1.ok === false && v1.init === false, '11-3. 遮断なしで終了コード 2 の子は合格にならない', v1);
    const initFail = childRun('no-such-dir/x', ['-e', 'process.exit(2)']);   // 記録先の親が無いので初期化の記録に失敗する
    const v2 = verifyNetBlock(initFail.run);
    assert(initFail.r.status === 97 && v2.ok === false && v2.init === false, '11-4. 遮断の初期化に失敗した子は終了コード 97 で止まり、合格にならない', { status: initFail.r.status, v2 });
    const swallowed = childRun('control', ['-e', "try { require('http').get('http://127.0.0.1:9/'); } catch (e) {}"]);
    const v3 = verifyNetBlock(swallowed.run);
    assert(swallowed.r.status === 0 && v3.ok === false && v3.attempts.length === 1 && v3.attempts[0] === 'http.get', '11-5. 子の中で捕捉された試行も親が検出する（終了コード 0 でも不合格）', v3);
    const parent = readNetLog(NET_LOG);
    const pInit = parent.find(e => e.event === 'init' && e.pid === process.pid);
    const pSelf = parent.filter(e => e.event === 'attempt' && e.selftest === true).map(e => e.target);
    assert(!!pInit && pInit.cliLoadedBeforeBlock === false && NET_NAMES.every(n => pSelf.indexOf(n) !== -1), '11-6. 親: 初期化と全 ' + NET_NAMES.length + ' 経路の遮断を確認（捕捉された自己確認の試行も記録に残る）', pSelf.length);
    const pAttempts = realAttempts(parent);
    assert(pAttempts.length === 0, '11-7. 親: 全ケース終了後の遮断対象への試行 0 件', pAttempts);
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  console.log(_failed === 0 ? '🟢 All daily writer real-entry cases passed（偽 HTTP・偽 Supabase・偽ストア・実通信なし）' : '🔴 失敗あり');
  process.exit(_failed === 0 ? 0 : 1);
})().catch(e => { console.error('テスト実行エラー:', e && e.message); process.exit(2); });
