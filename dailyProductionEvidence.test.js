'use strict';
// dailyProductionEvidence.test.js
// Instagram Daily Production — 本番での実証の証拠による3項目の個別有効化（lib/dailyProductionEvidence.js）と、
// 1回実行ツール real モードでの照合（実行許可の permit.evidence が信頼元）を、偽 HTTP・偽 Supabase client だけで検証する。
//
//   ★ 実 OpenAI・本番 Supabase・本番の鍵は使わない。http／https／net／fetch を遮断して到達 0 を確認する。
//   ★ 証拠ファイル・鍵ファイル・接続先はすべて TEST FIXTURE（OS の一時フォルダ）。本番用の証拠は発行しない。
//
//   使い方: node dailyProductionEvidence.test.js

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
const ev = require('./lib/dailyProductionEvidence');
const tool = require('./tools/dailyProduction/runConnectedOnce');
const fixture = require('./tools/dailyProduction/runOnce');
const { createSpendStoreSupabase } = require('./lib/spendStoreSupabase');
const { createSupabaseAuthorizationStore } = require('./lib/dailyAuthorizationStoreSupabase');

let _passed = 0, _failed = 0;
function assert(cond, label, detail) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : '')); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── TEST FIXTURE ──
const REPO = __dirname;
const readFile = p => fs.readFileSync(p);
const URL1 = 'https://testfixtureref.supabase.co';
const NOW = new Date('2026-10-15T09:00:00+09:00');
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'daily-evidence-test-'));
function evidenceObj(component, over) {
  const codeHashes = {};
  ev.CODE_FILES[component].forEach(rel => { codeHashes[rel] = ev.sha256(fs.readFileSync(path.join(REPO, rel))); });
  return Object.assign({
    evidenceVersion: 1, component,
    target: { supabaseUrl: URL1, projectRef: 'testfixtureref' },
    migrations: ev.MIGRATIONS[component].map(m => Object.assign({}, m)),
    codeHashes,
    verificationCode: [{ path: 'TEST-FIXTURE/verify_prod.js', sha256: 'a'.repeat(64) }],
    records: ['TEST-FIXTURE/records/RECORD.md'],
    result: { status: 'passed', cases: [{ id: 'fixture-case-1', passed: true }] },
    verifiedAt: '2026-10-14T00:00:00Z', validUntil: '2026-11-01T00:00:00Z', approvedBy: 'TEST FIXTURE',
  }, over || {});
}
const textOf = o => JSON.stringify(o, null, 2) + '\n';
const verify = (component, text, approved, url, now) => ev.verifyEvidence({ component, evidenceText: text, approvedSha256: approved === undefined ? ev.sha256(text) : approved, supabaseUrl: url || URL1, repoRoot: REPO, readFile, now: now || NOW });

(async () => {
  console.log('Instagram Daily Production — 本番実証の証拠による3項目の個別有効化（偽 HTTP・偽 Supabase）');

  caseHeader('1. 証拠の照合（lib/dailyProductionEvidence.js）');
  {
    for (const c of ev.COMPONENTS) {
      const t = textOf(evidenceObj(c));
      const v = verify(c, t);
      assert(v.ok === true && v.component === c && v.projectRef === 'testfixtureref', '1-1. ' + c + ': 承認 hash・接続先・migration・現在のコード・結果・期限が一致 → 照合成功', v);
    }
    const t = textOf(evidenceObj('spendStore'));
    const cases = [
      ['承認 hash なし', verify('spendStore', t, null), 'approved_hash_missing'],
      ['1文字改変（承認 hash は元のまま）', verify('spendStore', t + ' ', ev.sha256(t)), 'evidence_hash_mismatch'],
      ['自己申告 verified:true だけ（承認 hash 不一致）', verify('spendStore', textOf(Object.assign(evidenceObj('spendStore'), { verified: true })), ev.sha256(t)), 'evidence_hash_mismatch'],
      ['別項目の証拠（認可の証拠を予算に使う）', verify('spendStore', textOf(evidenceObj('authorizationStore'))), 'component_mismatch'],
      ['接続先が違う', verify('spendStore', t, undefined, 'https://otherref.supabase.co'), 'target_mismatch'],
      ['接続先の形式が不正', verify('spendStore', t, undefined, 'http://127.0.0.1:54321'), 'connection_url_invalid'],
      ['migration hash 違い', verify('spendStore', textOf(evidenceObj('spendStore', { migrations: [{ path: ev.MIGRATIONS.spendStore[0].path, sha256: '0'.repeat(64) }] }))), 'migration_hash_mismatch'],
      ['関連コードが証拠の時点から変わった', verify('spendStore', textOf(evidenceObj('spendStore', { codeHashes: Object.assign({}, evidenceObj('spendStore').codeHashes, { 'lib/spendGate.js': '0'.repeat(64) }) }))), 'code_hash_mismatch:lib/spendGate.js'],
      ['関連コードの hash が無い', verify('spendStore', textOf(evidenceObj('spendStore', { codeHashes: {} }))), 'code_hash_missing:lib/spendGate.js'],
      ['検証コードの記録なし', verify('spendStore', textOf(evidenceObj('spendStore', { verificationCode: [] }))), 'verification_code_missing'],
      ['記録の参照先なし', verify('spendStore', textOf(evidenceObj('spendStore', { records: [] }))), 'records_missing'],
      ['未合格のケースを含む（verified:true を併記しても）', verify('spendStore', textOf(evidenceObj('spendStore', { verified: true, result: { status: 'passed', cases: [{ id: 'a', passed: true }, { id: 'b', passed: false }] } }))), 'result_not_passed'],
      ['期限切れ', verify('spendStore', textOf(evidenceObj('spendStore', { validUntil: '2026-10-14T12:00:00Z' }))), 'evidence_expired'],
      ['検証日時が未来', verify('spendStore', textOf(evidenceObj('spendStore', { verifiedAt: '2026-10-16T00:00:00Z', validUntil: '2026-11-01T00:00:00Z' }))), 'verified_in_future'],
      ['有効期間 90 日超', verify('spendStore', textOf(evidenceObj('spendStore', { verifiedAt: '2026-10-01T00:00:00Z', validUntil: '2027-01-15T00:00:00Z' }))), 'validity_out_of_range'],
      ['版が違う', verify('spendStore', textOf(evidenceObj('spendStore', { evidenceVersion: 2 }))), 'evidence_version'],
    ];
    for (const [label, v, reason] of cases) assert(v.ok === false && v.reason === reason, '1. ' + label + ' → ' + reason, v);
  }

  caseHeader('2. 有効化は照合済みの結果だけ（偽造・別項目は拒否・元の依存は変えない）');
  {
    const store = createSpendStoreSupabase({ client: { rpc: async () => ({}) } });
    const vSpend = verify('spendStore', textOf(evidenceObj('spendStore')));
    const vAuth = verify('authorizationStore', textOf(evidenceObj('authorizationStore')));
    const up = ev.elevateSpendStore(store, vSpend);
    assert(up.capabilities.atomicityVerified === true && up.capabilities.verifiedProjectRef === 'testfixtureref' && store.capabilities.atomicityVerified === false, '2-1. 予算ストアだけ有効化（元のストアは false のまま）');
    const err = f => { try { f(); return null; } catch (e) { return e.message; } };
    assert(err(() => ev.elevateSpendStore(store, { ok: true, component: 'spendStore', projectRef: 'x' })) === 'evidence_not_verified:spendStore', '2-2. 照合を経ない偽の結果（ok:true の物体）では有効化できない');
    assert(err(() => ev.elevateSpendStore(store, vAuth)) === 'evidence_not_verified:spendStore', '2-3. 認可の照合結果で予算ストアは有効化できない（項目は個別）');
    const auth = createSupabaseAuthorizationStore({ client: { rpc: async () => ({}) } });
    const upA = ev.elevateAuthorizationStore(auth, vAuth);
    assert(upA.productionVerified === true && auth.productionVerified === false, '2-4. 認可ストアも個別に有効化（元は false のまま）');
    assert(createSpendStoreSupabase({ client: { rpc: async () => ({}) } }).capabilities.atomicityVerified === false && createSupabaseAuthorizationStore({ client: { rpc: async () => ({}) } }).productionVerified === false,
      '2-5. アダプターの既定は無効のまま');
  }

  caseHeader('3. 1回実行ツール real: 証拠の不足・改変・不一致では生成通信へ進まない');
  {
    const PACK = fixture.LOCAL_FIXTURE_PACK;
    const PLAN = {
      runId: 'run-evid-0001', caseId: 'case-evid-daily', dailyCaseId: 'case-evid-daily', outputId: 'out_evid_0001', packVersion: 1, writerProvider: 'openai',
      writer: { model: 'test-model-fixture', maxOutputTokens: 2000, maxRequestBytes: 60000, timeoutMs: 30000, countTimeoutMs: 10000 },
      pricing: { pricingVersion: 'TEST-FIXTURE-pricing-v1', model: 'test-model-fixture', acceptedResponseModels: ['test-model-fixture-2026-01-01'], usdPerMillion: { input: '0.75', cachedInput: '0.075', output: '4.50' }, jpyPerUsd: '160', rateVersion: 'TEST-FIXTURE-rate-160', maxOutputIncludesReasoning: true },
      limits: { dailyLimit: 20000000, monthlyLimit: 100000000, perRunLimit: 5000000 },
      period: { dayKey: '2026-10-15', monthKey: '2026-10', timeZone: 'Asia/Tokyo' },
    };
    const keyA = path.join(TMP, 'openai.key'), keyS = path.join(TMP, 'supabase.key');
    fs.writeFileSync(keyA, 'sk-test-FIXTURE-evidence-not-a-key-000000'); fs.writeFileSync(keyS, 'sb_secret_TEST_FIXTURE_evidence_not_a_key_00');
    const h = tool.computePlanHashes(PLAN, PACK);
    const evFile = (c, obj) => { const f = path.join(TMP, c + '-' + Math.random().toString(36).slice(2) + '.json'); const t = textOf(obj || evidenceObj(c)); fs.writeFileSync(f, t); return { file: f, sha: ev.sha256(t) }; };
    const goodFiles = () => { const o = {}; ev.COMPONENTS.forEach(c => { o[c] = evFile(c); }); return o; };
    const permitFor = (files, over) => Object.assign({
      permitVersion: 1, runId: PLAN.runId, caseId: PLAN.caseId, outputId: PLAN.outputId, authorizationId: 'auth-evid-0001',
      requestHash: h.requestHash, settingsHash: h.settingsHash, contentHash: h.contentHash, allowedCalls: { inputTokenCount: 1, generate: 1 },
      approvedBy: 'TEST FIXTURE', approvedAt: '2026-10-15T08:00:00+09:00', expiresAt: '2026-10-15T17:00:00+09:00',
      evidence: files ? { spendStore: files.spendStore.sha, authorizationStore: files.authorizationStore.sha, caseBoundary: files.caseBoundary.sha } : undefined,
    }, over || {});
    const secretsFor = (files, url) => ({ openaiKeyFile: keyA, supabaseUrl: url || URL1, supabaseKeyFile: keyS,
      evidenceFiles: files ? { spendStore: files.spendStore && files.spendStore.file, authorizationStore: files.authorizationStore && files.authorizationStore.file, caseBoundary: files.caseBoundary && files.caseBoundary.file } : undefined });
    // 偽 Supabase client（rpc と表を最小限で模す・呼び出しを数える）
    function fakeClient() {
      const calls = [];
      const tgt = { runId: PLAN.runId, caseId: PLAN.caseId, outputId: PLAN.outputId, topicId: PACK.topicId, packVersion: 1, contentHash: h.contentHash };
      let consumed = false, state = null;
      const handlers = {
        get_daily_production_authorization: () => ({ outcome: 'found', state: consumed ? 'consumed' : 'available', authorizationId: 'auth-evid-0001', target: tgt, review: { reviewId: 'review-evid', topicId: tgt.topicId, packVersion: 1, contentHash: tgt.contentHash } }),
        consume_daily_production_authorization: () => { if (consumed) return { outcome: 'already_consumed' }; consumed = true; return { outcome: 'consumed' }; },
        reserve_spend: () => { if (state) return { outcome: 'duplicate_run' }; state = 'reserved'; return { outcome: 'reserved', dayKey: '2026-10-15', monthKey: '2026-10', dailyRemaining: 1, monthlyRemaining: 1 }; },
        mark_spend_invoked: () => { if (state !== 'reserved') return { outcome: 'invalid_state:' + state }; state = 'invoked'; return { outcome: 'invoked' }; },
        settle_spend: () => { state = 'settled'; return { outcome: 'settled', overrun: false }; },
        release_spend: () => { state = 'released'; return { outcome: 'released' }; },
        mark_spend_unknown: () => { state = 'outcome_unknown'; return { outcome: 'outcome_unknown' }; },
      };
      return {
        calls,
        rpc: async (fn, p) => { calls.push('rpc:' + fn); return handlers[fn] ? { data: handlers[fn](p), error: null } : { data: null, error: { code: 'PGRST202' } }; },
        from: (t) => {
          calls.push('from:' + t);
          if (t === 'cases') return { select: () => ({ eq: (c, v) => ({ limit: async () => ({ data: v === PLAN.dailyCaseId ? [{ id: v, deleted_at: null }] : [], error: null }) }) }) };
          return { insert: async () => ({ error: null }) };
        },
      };
    }
    function fakeHttp() {
      const calls = [];
      return { calls, post: async (url) => {
        calls.push(url);
        if (/input_tokens$/.test(url)) return { status: 200, data: { object: 'response.input_tokens', input_tokens: 1500 } };
        await sleep(10);
        return { status: 200, data: { id: 'resp_e', object: 'response', status: 'completed', model: 'test-model-fixture-2026-01-01',
          output: [{ type: 'message', role: 'assistant', content: [{ type: 'output_text', text: fixture.FAKE_WRITER_OUTPUT }] }], usage: { input_tokens: 1500, output_tokens: 900, total_tokens: 2400 } } };
      } };
    }
    const run = async (permit, secrets) => {
      const http = fakeHttp(), client = fakeClient();
      const out = await tool.runRealOnce({ plan: PLAN, pack: PACK, permit, secrets, now: NOW, factories: { http: () => http, supabaseClient: () => client } });
      return { out, http, client };
    };

    // 3-1: 正しい証拠3つ（許可の hash と一致）→ 既定の本番ストアが有効化され、計数1・生成1（偽 HTTP）
    {
      const files = goodFiles();
      const { out, http, client } = await run(permitFor(files), secretsFor(files));
      const r = out.result || {};
      assert(out.ok && r.status === 'awaiting_human_review' && r.billing.mode === 'production' && out.networkCalls.inputTokenCount === 1 && out.networkCalls.generate === 1 &&
        client.calls.indexOf('rpc:consume_daily_production_authorization') !== -1 && http.calls.length === 2,
        '3-1. 3項目の証拠が照合できた場合だけ、既定の本番ストアで生成まで進む（偽 HTTP・偽 Supabase）', { ok: out.ok, stage: out.stage, errors: out.errors, status: r.status, reason: r.reason });
    }
    // 不一致・不足はすべて通信0・DB 0
    const files0 = goodFiles();
    const tampered = goodFiles(); fs.appendFileSync(tampered.spendStore.file, ' ');
    const expired = goodFiles(); expired.caseBoundary = evFile('caseBoundary', evidenceObj('caseBoundary', { validUntil: '2026-10-14T23:00:00Z' }));
    const codeChanged = goodFiles(); codeChanged.authorizationStore = evFile('authorizationStore', evidenceObj('authorizationStore', { codeHashes: Object.assign({}, evidenceObj('authorizationStore').codeHashes, { 'lib/dailyAuthorizationStoreSupabase.js': '0'.repeat(64) }) }));
    const swapped = goodFiles(); const tmp = swapped.spendStore; swapped.spendStore = swapped.caseBoundary; swapped.caseBoundary = tmp;
    const notPassed = goodFiles(); notPassed.spendStore = evFile('spendStore', evidenceObj('spendStore', { verified: true, result: { status: 'failed', cases: [{ id: 'x', passed: false }] } }));
    const missingOne = goodFiles(); delete missingOne.caseBoundary;
    const cases = [
      ['証拠なし（許可にも無い）', permitFor(null), secretsFor(null), 'deps'],
      ['許可に証拠 hash があるがファイル未指定', permitFor(files0), secretsFor(null), 'evidence', 'evidence_incomplete'],
      ['ファイルはあるが許可に証拠 hash が無い', permitFor(null), secretsFor(files0), 'evidence', 'evidence_incomplete'],
      ['3つのうち1つ欠落', permitFor(files0), secretsFor(missingOne), 'evidence', 'evidence_incomplete'],
      ['証拠ファイルの改変（承認 hash と不一致）', permitFor(tampered), secretsFor(tampered), 'evidence', 'spendStore:evidence_hash_mismatch', true],
      ['接続先が証拠と違う', permitFor(files0), secretsFor(files0, 'https://otherref.supabase.co'), 'evidence', 'spendStore:target_mismatch'],
      ['期限切れの証拠', permitFor(expired), secretsFor(expired), 'evidence', 'caseBoundary:evidence_expired'],
      ['関連コードが証拠の時点から変わった', permitFor(codeChanged), secretsFor(codeChanged), 'evidence', 'authorizationStore:code_hash_mismatch:lib/dailyAuthorizationStoreSupabase.js'],
      ['項目の取り違え（予算と case の証拠を入れ替え）', permitFor(swapped), secretsFor(swapped), 'evidence', 'spendStore:component_mismatch'],
      ['未合格の証拠（verified:true を自己申告）', permitFor(notPassed), secretsFor(notPassed), 'evidence', 'spendStore:result_not_passed'],
      ['許可の証拠 hash の形式不正（2項目だけ）', permitFor(files0, { evidence: { spendStore: files0.spendStore.sha, authorizationStore: files0.authorizationStore.sha } }), secretsFor(files0), 'permit', 'permit.evidence(3 hashes)'],
      ['許可が期限切れ（証拠は正しい）', permitFor(files0, { approvedAt: '2026-10-15T01:00:00+09:00', expiresAt: '2026-10-15T08:30:00+09:00' }), secretsFor(files0), 'permit', 'permit_expired'],
    ];
    for (const [label, permit, secrets, stage, code, permitUsesOrig] of cases) {
      void permitUsesOrig;
      const { out, http, client } = await run(permit, secrets);
      const okStage = out.ok === false && out.stage === stage && (code ? out.errors.indexOf(code) !== -1 : true);
      assert(okStage && http.calls.length === 0 && client.calls.length === 0, '3. ' + label + ' → ' + stage + (code ? '（' + code + '）' : '') + '・生成通信0・計数0・DB 0', { ok: out.ok, stage: out.stage, errors: out.errors, http: http.calls.length, db: client.calls.length });
    }
  }

  caseHeader('4. 外部通信');
  assert(NET_ATTEMPTS === 0, '4-1. http／https／net／fetch への到達 0 件', NET_ATTEMPTS);

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  console.log(_failed === 0 ? '🟢 All daily production evidence cases passed（偽 HTTP・偽 Supabase・TEST FIXTURE の証拠・本番の証拠は未発行）' : '🔴 失敗あり');
  process.exit(_failed === 0 ? 0 : 1);
})().catch(e => { console.error('テスト実行エラー:', e && e.message); process.exit(2); });
