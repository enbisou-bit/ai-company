'use strict';
// dailyAuthorizationPersistence.test.js
// Instagram Daily Production — 永続認可アダプター（rpc）・case の ID 取得・接続部の本番拒否・1回実行ツール（dry-run）を、
// 偽 rpc／偽 cases client・偽 HTTP だけで検証する（外部通信なし）。
//
//   ★ 実 DB の原子性・権限・トリガーはここでは確かめない（専用ローカル Supabase の結合検証で確かめる）。
//   ★ 実 OpenAI（計数 API を含む）・本番 DB・本番の認証情報は使わない。http／https／net／fetch を遮断して到達 0 を確認する。
//
//   使い方: node dailyAuthorizationPersistence.test.js

['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'OPENAI_API_KEY'].forEach(k => { delete process.env[k]; });
let NET_ATTEMPTS = 0;
const _block = name => function () { NET_ATTEMPTS++; throw new Error('network blocked in test: ' + name); };
const _http = require('http'), _https = require('https'), _net = require('net');
_http.request = _block('http.request'); _http.get = _block('http.get');
_https.request = _block('https.request'); _https.get = _block('https.get');
_net.connect = _block('net.connect'); _net.createConnection = _block('net.createConnection');
globalThis.fetch = async () => { NET_ATTEMPTS++; throw new Error('network blocked in test: fetch'); };

const { createSupabaseAuthorizationStore } = require('./lib/dailyAuthorizationStoreSupabase');
const { getCaseById } = require('./lib/casesDb');
const { createDailyProductionDeps, createCaseBoundaryFromDb } = require('./lib/dailyProductionConnect');
const tool = require('./tools/dailyProduction/runConnectedOnce');
const fixture = require('./tools/dailyProduction/runOnce');

let _passed = 0, _failed = 0;
function assert(cond, label, detail) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : '')); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const TARGET = { runId: 'run-p-0001', caseId: 'case-test-daily-fake', outputId: 'out_p_0001', topicId: 'face-wash-tightness', packVersion: 1, contentHash: 'a'.repeat(64) };
const REVIEW = { reviewId: 'review-p-0001', topicId: TARGET.topicId, packVersion: 1, contentHash: TARGET.contentHash };
// 偽 rpc client（関数名ごとの応答を差し替え・呼び出しを記録）
function fakeRpc(handlers) {
  const calls = [];
  return { calls, rpc: async (fn, params) => { calls.push({ fn, params }); const h = handlers[fn]; if (!h) return { data: null, error: { code: 'PGRST202' } }; return h(params); } };
}
const found = state => () => ({ data: { outcome: 'found', state, authorizationId: 'auth-p-0001', expiresAt: '2026-10-12T00:00:00+09:00', target: Object.assign({}, TARGET), review: Object.assign({}, REVIEW) }, error: null });
// 偽 cases client
function fakeCases(mode, rows) {
  return { from: (t) => ({ select: () => ({ eq: (c, v) => ({ limit: async () => {
    if (t !== 'cases') throw new Error('table');
    if (mode === 'throw') throw new Error('network');
    if (mode === 'nocode') return { data: null, error: { message: 'fetch failed', code: '' } };
    if (mode === 'dberr') return { data: null, error: { code: '42501', message: 'permission denied' } };
    return { data: (rows || []).filter(r => r.id === v), error: null };
  } }) }) }) };
}

(async () => {
  console.log('Instagram Daily Production — 永続認可アダプター・case 取得・本番拒否・1回実行ツール（偽 rpc／偽 HTTP）');

  caseHeader('1. 永続認可アダプター: 照合（get）');
  {
    assert(createSupabaseAuthorizationStore({}) === null && createSupabaseAuthorizationStore({ client: {} }) === null, '1-0. 接続先（rpc）が無ければストアを作らない');
    const s = createSupabaseAuthorizationStore({ client: fakeRpc({ get_daily_production_authorization: found('available') }) });
    assert(s.kind === 'postgres_rpc' && s.persistent === true && s.connected === true && s.productionVerified === false, '1-1. 永続・接続済み・productionVerified=false（本番は未実証）');
    const a = await s.getAuthorization({ target: TARGET });
    assert(a.authorized === true && a.kind === 'persistent_db' && a.authorizationId === 'auth-p-0001' && a.review.reviewId === 'review-p-0001', '1-2. available → 認可あり（対象と確認記録を返す）', a);
    for (const [label, h, reason] of [
      ['使用済み', found('consumed'), 'authorization_consumed'],
      ['期限切れ', found('expired'), 'authorization_expired'],
      ['未登録', () => ({ data: { outcome: 'not_found' }, error: null }), 'authorization_not_found'],
      ['対象不一致', () => ({ data: { outcome: 'target_mismatch' }, error: null }), 'authorization_target_mismatch'],
      ['rpc エラー', () => ({ data: null, error: { code: '42501' } }), 'authorization_lookup_error'],
      ['例外', () => { throw new Error('network'); }, 'authorization_lookup_unknown'],
      ['形が不正', () => ({ data: { outcome: 'found', state: 'available' }, error: null }), 'authorization_lookup_invalid'],
    ]) {
      const st = createSupabaseAuthorizationStore({ client: fakeRpc({ get_daily_production_authorization: h }) });
      const r = await st.getAuthorization({ target: TARGET });
      assert(r.authorized === false && r.reason === reason, '1. ' + label + ' → 認可なし（' + reason + '）', r);
    }
    const c = fakeRpc({ get_daily_production_authorization: found('available') });
    await createSupabaseAuthorizationStore({ client: c }).getAuthorization({ target: TARGET });
    assert(JSON.stringify(c.calls[0].params) === JSON.stringify({ p_run_id: TARGET.runId, p_case_id: TARGET.caseId, p_output_id: TARGET.outputId, p_topic_id: TARGET.topicId, p_pack_version: 1, p_content_hash: TARGET.contentHash }),
      '1-10. 照合は run／case／output／topic／版／hash の全部を DB へ渡す', c.calls[0].params);
  }

  caseHeader('2. 永続認可アダプター: 消費（consume）');
  {
    const c = fakeRpc({ consume_daily_production_authorization: () => ({ data: { outcome: 'consumed', authorizationId: 'auth-p-0001' }, error: null }) });
    const s = createSupabaseAuthorizationStore({ client: c });
    const r = await s.consume({ authorizationId: 'auth-p-0001', runId: TARGET.runId, target: TARGET });
    assert(r.ok === true && r.outcome === 'consumed' && c.calls[0].params.p_authorization_id === 'auth-p-0001' && c.calls[0].params.p_run_id === TARGET.runId && c.calls[0].params.p_content_hash === TARGET.contentHash,
      '2-1. consumed → 勝者（認可 ID と対象の全項目を DB へ渡す）', c.calls[0].params);
    for (const oc of ['already_consumed', 'not_found', 'target_mismatch', 'expired', 'not_consumable']) {
      const st = createSupabaseAuthorizationStore({ client: fakeRpc({ consume_daily_production_authorization: () => ({ data: { outcome: oc }, error: null }) }) });
      const x = await st.consume({ authorizationId: 'a', runId: TARGET.runId, target: TARGET });
      assert(x.ok === false && x.outcome === oc, '2. ' + oc + ' → 明確な拒否', x);
    }
    for (const [label, h] of [['rpc エラー', () => ({ data: null, error: { code: '57014' } })], ['例外', () => { throw new Error('timeout'); }], ['未知の応答', () => ({ data: { outcome: 'weird' }, error: null })]]) {
      const st = createSupabaseAuthorizationStore({ client: fakeRpc({ consume_daily_production_authorization: h }) });
      let msg = '';
      try { await st.consume({ authorizationId: 'a', runId: TARGET.runId, target: TARGET }); } catch (e) { msg = e.message; }
      assert(msg === 'authorization_consume_unknown', '2. ' + label + ' → 結果不明（例外）', msg);
    }
  }

  caseHeader('3. case を ID で取得（getCaseById）');
  {
    const rows = [{ id: 'case-a', deleted_at: null }, { id: 'case-del', deleted_at: '2026-10-01T00:00:00Z' }];
    const ok = await getCaseById('case-a', { client: fakeCases('normal', rows) });
    const none = await getCaseById('case-x', { client: fakeCases('normal', rows) });
    const del = await getCaseById('case-del', { client: fakeCases('normal', rows) });
    assert(ok.ok && ok.exists === true && none.ok && none.exists === false && del.ok && del.exists === false && del.deleted === true, '3-1. 存在／不存在／論理削除済み（削除済みは存在しない扱い）', [ok, none, del]);
    const dberr = await getCaseById('case-a', { client: fakeCases('dberr') });
    assert(dberr.ok === false && dberr.outcome === 'db_error' && dberr.code === '42501', '3-2. コード付き DB エラー → db_error', dberr);
    for (const m of ['throw', 'nocode']) {
      let msg = ''; try { await getCaseById('case-a', { client: fakeCases(m) }); } catch (e) { msg = e.message; }
      assert(msg === 'case_lookup_unknown', '3-3. 取得結果不明（' + m + '）→ 例外', msg);
    }
    const nc = await getCaseById('case-a'), bad = await getCaseById('', { client: fakeCases('normal', rows) });
    assert(nc.ok === false && nc.outcome === 'not_connected' && bad.ok === false && bad.outcome === 'invalid_input', '3-4. 接続先なし → not_connected・空 ID → invalid_input', [nc, bad]);
    const cb = createCaseBoundaryFromDb({ dailyCaseId: 'case-a', client: fakeCases('throw') });
    let msg = ''; try { await cb.caseExists('case-a'); } catch (e) { msg = e.message; }
    assert(cb.productionVerified === false && msg === 'case_lookup_unknown', '3-5. case 境界: 取得失敗は例外（authorize で case_check_error）・productionVerified=false', msg);
  }

  caseHeader('4. 本番の依存は引き続き拒否');
  {
    const store = createSupabaseAuthorizationStore({ client: fakeRpc({}) });
    const cb = createCaseBoundaryFromDb({ dailyCaseId: 'case-a', client: fakeCases('normal', []) });
    const p = createDailyProductionDeps({ mode: 'production', writer: {}, spendGate: { mode: 'production', reserve: async () => ({}) }, authorizationStore: store, caseBoundary: cb,
      draftClient: { from() {} }, computePackHash: () => '', evaluateContentValue: () => ({}) });
    assert(p.ok === false && p.reason === 'production_dependency_not_connected' && p.missing.indexOf('authorizationStore(productionVerified)') !== -1 && p.missing.indexOf('caseBoundary(productionVerified)') !== -1,
      '4-1. 永続ストア・DB の case 確認を使っても、本番未実証（productionVerified=false）なら本番モードは拒否', p.missing);
  }

  caseHeader('5. 1回実行ツール（require では何もしない・計画の検証・dry-run）');
  {
    assert(NET_ATTEMPTS === 0, '5-0. require しただけでは通信なし');
    const plan = {
      runId: 'run-dry-0001', caseId: 'case-dry', dailyCaseId: 'case-dry', outputId: 'out_dry_0001', packVersion: 1, writerProvider: 'openai', authorizationId: 'auth-dry-0001',
      writer: { model: 'test-model-fixture', maxOutputTokens: 2000, maxRequestBytes: 60000, timeoutMs: 30000, countTimeoutMs: 10000 },
      pricing: { pricingVersion: 'TEST-FIXTURE-pricing-v1', model: 'test-model-fixture', acceptedResponseModels: ['test-model-fixture-2026-01-01'], usdPerMillion: { input: '0.75', cachedInput: '0.075', output: '4.50' }, jpyPerUsd: '160', rateVersion: 'TEST-FIXTURE-rate-160', maxOutputIncludesReasoning: true },
      limits: { dailyLimit: 20000000, monthlyLimit: 100000000, perRunLimit: 5000000 },
      period: { dayKey: '2026-10-11', monthKey: '2026-10', timeZone: 'Asia/Tokyo' },
    };
    const real = tool.validatePlan('real', plan);
    assert(real.ok === false && real.errors.indexOf('real_mode_not_enabled') !== -1, '5-1. real モードは常に拒否（実通信の入口なし）', real.errors);
    for (const k of ['runId', 'outputId', 'packVersion', 'writer', 'pricing', 'limits', 'authorizationId']) {
      const p2 = Object.assign({}, plan); delete p2[k];
      const v = tool.validatePlan('dry-run', p2);
      assert(v.ok === false, '5-2. ' + k + ' が無い計画は実行前に拒否', v.errors);
    }
    const mism = tool.validatePlan('dry-run', Object.assign({}, plan, { caseId: 'case-other' }));
    assert(mism.ok === false && mism.errors.indexOf('caseId!=dailyCaseId') !== -1, '5-3. 指定の日次 case と違う case は拒否', mism.errors);
    assert(tool.parseArgs(['--mode']).error && tool.parseArgs(['mode', 'x']).error, '5-4. 引数の形が不正なら拒否');
    const out = await tool.runConnectedOnce({ mode: 'dry-run', plan, pack: fixture.LOCAL_FIXTURE_PACK, fakeWriter: { text: fixture.FAKE_WRITER_OUTPUT } });
    const r = out.result;
    const row = out.draftRows && out.draftRows.get('out_dry_0001');
    assert(out.ok && r.status === 'awaiting_human_review' && r.approval === 'not_approved' && out.fakeWriterCalls.count === 1 && out.fakeWriterCalls.generate === 1 && r.authorization.kind === 'local_fake' && r.billing.mode === 'local_verification',
      '5-5. dry-run: 偽 Writer（計数1・生成1）・偽認可・ローカル検証の予算で Human 確認待ち・未承認', { status: r.status, reason: r.reason, calls: out.fakeWriterCalls });
    assert(row && row.fields.slides.length === 5 && row.fields.caption && row.fields.cta && row.fields.hashtags.length > 0 && row.review_state === undefined, '5-6. dry-run の Draft は5枚と投稿文一式・未承認');
    const unk = await tool.runConnectedOnce({ mode: 'local-db', plan, pack: fixture.LOCAL_FIXTURE_PACK, localKeys: null });
    assert(unk.ok === false && unk.errors[0] === 'local-keys', '5-7. local-db で鍵ファイル未指定 → 実行しない（環境変数は読まない）', unk);
  }

  caseHeader('6. サービス経由: 永続認可（偽 rpc）の消費結果で Writer を止める');
  {
    for (const [label, handler, reason] of [
      ['使用済み', () => ({ data: { outcome: 'already_consumed' }, error: null }), 'authorization_already_consumed'],
      ['期限切れ', () => ({ data: { outcome: 'expired' }, error: null }), 'authorization_expired'],
      ['消費結果不明', () => { throw new Error('timeout'); }, 'authorization_consume_unknown'],
    ]) {
      const plan = { runId: 'run-svc-0001', caseId: 'case-svc', dailyCaseId: 'case-svc', outputId: 'out_svc_0001', packVersion: 1, writerProvider: 'openai',
        writer: { model: 'test-model-fixture', maxOutputTokens: 2000, maxRequestBytes: 60000, timeoutMs: 30000, countTimeoutMs: 10000 },
        pricing: { pricingVersion: 'TEST-FIXTURE-pricing-v1', model: 'test-model-fixture', acceptedResponseModels: ['test-model-fixture-2026-01-01'], usdPerMillion: { input: '0.75', output: '4.50' }, jpyPerUsd: '160', rateVersion: 'TEST-FIXTURE-rate-160', maxOutputIncludesReasoning: true },
        limits: { dailyLimit: 20000000, monthlyLimit: 100000000, perRunLimit: 5000000 }, period: { dayKey: '2026-10-11', monthKey: '2026-10', timeZone: 'Asia/Tokyo' } };
      const hash = tool.computePackHash(fixture.LOCAL_FIXTURE_PACK);
      const tgt = { runId: plan.runId, caseId: plan.caseId, outputId: plan.outputId, topicId: fixture.LOCAL_FIXTURE_PACK.topicId, packVersion: 1, contentHash: hash };
      const rpcClient = fakeRpc({
        get_daily_production_authorization: () => ({ data: { outcome: 'found', state: 'available', authorizationId: 'auth-svc-0001', target: tgt, review: { reviewId: 'review-svc', topicId: tgt.topicId, packVersion: 1, contentHash: hash } }, error: null }),
        consume_daily_production_authorization: handler,
        reserve_spend: () => ({ data: { outcome: 'reserved', dayKey: '2026-10-11', monthKey: '2026-10', dailyRemaining: 1, monthlyRemaining: 1 }, error: null }),
        release_spend: () => ({ data: { outcome: 'released' }, error: null }),
      });
      rpcClient.from = (t) => {
        if (t === 'cases') return fakeCases('normal', [{ id: 'case-svc', deleted_at: null }]).from('cases');
        return { insert: async () => ({ error: null }) };
      };
      const out = await tool.runConnectedOnce({ mode: 'local-db', plan, pack: fixture.LOCAL_FIXTURE_PACK, clients: { service: rpcClient }, fakeWriter: { text: fixture.FAKE_WRITER_OUTPUT } });
      const r = out.result;
      assert(out.ok && r.failedStage === 'authorization_consume' && r.reason === reason && out.fakeWriterCalls.generate === 0 && rpcClient.calls.some(c => c.fn === 'release_spend'),
        '6. ' + label + ' → ' + reason + '・偽 Writer の生成 0 回・呼び出し前なので予約を解放', { stage: r.failedStage, reason: r.reason, gen: out.fakeWriterCalls.generate });
    }
  }

  caseHeader('7. 外部通信');
  assert(NET_ATTEMPTS === 0, '7-1. http／https／net／fetch への到達 0 件', NET_ATTEMPTS);

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  console.log(_failed === 0 ? '🟢 All daily authorization persistence cases passed（偽 rpc／偽 HTTP・実 DB の原子性はローカル Supabase で別途確認）' : '🔴 失敗あり');
  process.exit(_failed === 0 ? 0 : 1);
})().catch(e => { console.error('テスト実行エラー:', e && e.message); process.exit(2); });
