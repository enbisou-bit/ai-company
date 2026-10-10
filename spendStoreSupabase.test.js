'use strict';
// spendStoreSupabase.test.js
// Instagram Daily Production — 予算予約ストア（lib/spendStoreSupabase.js）と migration SQL の検証。
//
//   実HTTP 0 / 実DB 0 / Supabase 0 / 環境変数 0 / 永続書き込み 0。
//   ★ 偽 rpc は SQL 関数の状態遷移を JS で模したもの（プロセス内でだけ原子的）。
//     この合格は PostgreSQL での原子性・ロック・権限・RLS の実証ではない。SQL は一度も実行していない。
//   ★ SQL の検査は文字列の静的検査であり、構文や動作の確認ではない。

const fs = require('fs');
const path = require('path');
const { createSpendStoreSupabase, RPC } = require('./lib/spendStoreSupabase');
const { createSpendGate } = require('./lib/spendGate');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const SQL_PATH = path.join(__dirname, 'supabase', 'migrations', '20261010000000_daily_spend_gate.sql');
const GATE_LIMITS = { amountUnit: 'micro_jpy', timeZone: 'Asia/Tokyo', dailyLimit: 100, monthlyLimit: 250, perRunLimit: 80 };
const DAY = { dayKey: '2026-10-10', monthKey: '2026-10', timeZone: 'Asia/Tokyo' };

// SQL 関数の動きを模した偽 rpc（テスト用。上限はテスト値で、本番設定ではない）
function makeFakeRpc(opts) {
  opts = opts || {};
  const serverDay = opts.serverDay || '2026-10-10';
  const scopes = new Map(Object.entries(opts.scopes || {
    global: { daily: 100, monthly: 250, perRun: 80, stopped: false },
    daily_copy_writer: { daily: 100, monthly: 250, perRun: 80, stopped: false },
    daily_reviewer: { daily: 100, monthly: 250, perRun: 80, stopped: false },
  }));
  const rows = new Map();
  const calls = [];
  const counted = r => r.state === 'released' ? 0 : r.state === 'settled' ? r.settled : r.amount;
  const sum = f => { let t = 0; rows.forEach(r => { if (f(r)) t += counted(r); }); return t; };
  function lockRow(runId) { const r = rows.get(runId); return r || null; }
  const fns = {
    reserve_spend(p) {
      if (!p.p_purpose || p.p_purpose === 'global') return { outcome: 'invalid_purpose' };
      const g = scopes.get('global'), s = scopes.get(p.p_purpose);
      if (!g) return { outcome: 'limits_not_configured', scope: 'global' };
      if (!s) return { outcome: 'limits_not_configured', scope: p.p_purpose };
      if (p.p_expected_daily_limit !== s.daily || p.p_expected_monthly_limit !== s.monthly || p.p_expected_per_run_limit !== s.perRun) return { outcome: 'limits_mismatch', scope: p.p_purpose };
      if (p.p_amount_unit !== 'micro_jpy') return { outcome: 'unit_mismatch' };
      if (p.p_time_zone !== 'Asia/Tokyo') return { outcome: 'timezone_mismatch' };
      if (p.p_day_key !== serverDay || p.p_month_key !== serverDay.slice(0, 7)) return { outcome: 'period_mismatch', serverDayKey: serverDay };
      if (g.stopped || s.stopped) return { outcome: 'spend_stopped' };
      if (rows.has(p.p_run_id)) return { outcome: 'duplicate_run', existingState: rows.get(p.p_run_id).state };
      if (p.p_amount > Math.min(g.perRun, s.perRun)) return { outcome: 'per_run_limit_exceeded' };
      const day = serverDay, month = serverDay.slice(0, 7);
      const gd = sum(r => r.day === day), gm = sum(r => r.month === month);
      const sd = sum(r => r.day === day && r.purpose === p.p_purpose), sm = sum(r => r.month === month && r.purpose === p.p_purpose);
      if (gd + p.p_amount > g.daily) return { outcome: 'daily_limit_exceeded', scope: 'global' };
      if (gm + p.p_amount > g.monthly) return { outcome: 'monthly_limit_exceeded', scope: 'global' };
      if (sd + p.p_amount > s.daily) return { outcome: 'daily_limit_exceeded', scope: p.p_purpose };
      if (sm + p.p_amount > s.monthly) return { outcome: 'monthly_limit_exceeded', scope: p.p_purpose };
      rows.set(p.p_run_id, { runId: p.p_run_id, purpose: p.p_purpose, day, month, amount: p.p_amount, state: 'reserved', settled: null });
      return { outcome: 'reserved', dayKey: day, monthKey: month,
        dailyRemaining: Math.min(g.daily - gd - p.p_amount, s.daily - sd - p.p_amount),
        monthlyRemaining: Math.min(g.monthly - gm - p.p_amount, s.monthly - sm - p.p_amount) };
    },
    mark_spend_invoked(p) { const r = lockRow(p.p_run_id); if (!r) return { outcome: 'not_found' }; if (r.state !== 'reserved') return { outcome: 'invalid_state:' + r.state }; r.state = 'invoked'; return { outcome: 'invoked' }; },
    release_spend(p) { if (!p.p_reason) return { outcome: 'release_reason_missing' }; const r = lockRow(p.p_run_id); if (!r) return { outcome: 'not_found' }; if (r.state !== 'reserved') return { outcome: 'release_refused:' + r.state }; r.state = 'released'; return { outcome: 'released' }; },
    mark_spend_unknown(p) { const r = lockRow(p.p_run_id); if (!r) return { outcome: 'not_found' }; if (r.state !== 'invoked' && r.state !== 'outcome_unknown') return { outcome: 'invalid_state:' + r.state }; r.state = 'outcome_unknown'; return { outcome: 'outcome_unknown' }; },
    settle_spend(p) {
      const r = lockRow(p.p_run_id); if (!r) return { outcome: 'not_found' };
      if (r.state === 'settled') return { outcome: r.settled === p.p_settled_amount ? 'already_settled_same' : 'settle_conflict' };
      if (r.state !== 'invoked' && r.state !== 'outcome_unknown') return { outcome: 'invalid_state:' + r.state };
      r.state = 'settled'; r.settled = p.p_settled_amount;
      const over = p.p_settled_amount > r.amount;
      if (over) { scopes.get('global').stopped = true; scopes.get(r.purpose).stopped = true; }
      return { outcome: 'settled', overrun: over };
    },
    get_spend_reservation(p) { const r = rows.get(p.p_run_id); if (!r) return { outcome: 'not_found' }; return { outcome: 'found', runId: r.runId, state: r.state, amount: r.amount }; },
  };
  const client = {
    async rpc(fn, params) {
      calls.push({ fn, params: JSON.parse(JSON.stringify(params)) });
      if (opts.throwOn === fn) throw new Error('network reset');
      if (opts.errorOn === fn) return { data: null, error: { message: 'permission denied', code: '42501' } };
      if (opts.errorWithDataOn === fn) return { data: fns[fn](params), error: { message: 'statement timeout', code: '57014' } };
      if (opts.nullOn === fn) return { data: null, error: null };
      if (opts.badOn === fn) return { data: { ok: true }, error: null };
      return { data: fns[fn](params), error: null };
    },
  };
  return { client, rows, scopes, calls };
}
function gateFor(fake) { return createSpendGate({ mode: 'local_verification', store: createSpendStoreSupabase({ client: fake.client }), limits: GATE_LIMITS }); }
function req(runId, amount, purpose, period) { return { runId, purpose: purpose || 'daily_copy_writer', provider: 'openai', estimateAmount: amount, period: period || DAY }; }

(async function main() {
  caseHeader('1. 接続先は依存として受け取る（なければ作らない）');
  {
    assert(createSpendStoreSupabase({}) === null && createSpendStoreSupabase({ client: {} }) === null, '1-1. rpc を持つ client がなければ null（fail-closed）');
    const g = createSpendGate({ mode: 'local_verification', store: createSpendStoreSupabase({}), limits: GATE_LIMITS });
    assert((await g.reserve(req('run-x1', 10))).reason === 'store_missing', '1-2. ストアがなければ予約不可');
    const s = createSpendStoreSupabase({ client: makeFakeRpc().client });
    assert(s.capabilities.atomicReserve === true && s.capabilities.atomicityVerified === false && s.capabilities.kind === 'postgres_rpc', '1-3. 原子性は設計上の宣言で、未実証と明示');
    const gp = createSpendGate({ mode: 'production', store: s, limits: GATE_LIMITS });
    assert((await gp.reserve(req('run-x2', 10))).reason === 'store_atomicity_not_verified', '1-4. production モードでは未実証のストアを使えない');
  }

  caseHeader('2. rpc への引数の対応（上限は DB が正本・送らない）');
  {
    const f = makeFakeRpc(); const g = gateFor(f);
    const r = await g.reserve(req('run-m1', 30));
    const c = f.calls[0];
    assert(r.approved === true && c.fn === RPC.reserve, '2-1. reserve_spend を呼ぶ');
    assert(c.params.p_run_id === 'run-m1' && c.params.p_amount === 30 && c.params.p_amount_unit === 'micro_jpy' && c.params.p_day_key === '2026-10-10' && c.params.p_month_key === '2026-10' && c.params.p_time_zone === 'Asia/Tokyo' && c.params.p_purpose === 'daily_copy_writer', '2-2. runId・金額・単位・期間・用途を渡す');
    assert(c.params.p_expected_daily_limit === 100 && c.params.p_expected_monthly_limit === 250 && c.params.p_expected_per_run_limit === 80, '2-3. 用途別の上限を照合用として DB へ送る');
    const fm = makeFakeRpc(); const gm = createSpendGate({ mode: 'local_verification', store: createSpendStoreSupabase({ client: fm.client }), limits: Object.assign({}, GATE_LIMITS, { perRunLimit: 50 }) });
    const rm = await gm.reserve(req('run-mm', 10));
    assert(rm.approved === false && rm.reason === 'limits_mismatch' && rm.definitive === true && fm.rows.size === 0, '2-3b. 上限の不一致は明確な拒否・予約0件');
    await g.markInvoked({ runId: 'run-m1' }); await g.settle({ runId: 'run-m1', settledAmount: 20, basis: 'usage' });
    assert(f.calls.map(x => x.fn).join(',') === 'reserve_spend,mark_spend_invoked,settle_spend', '2-4. 状態遷移の rpc 名が対応');
  }

  caseHeader('3. rpc の失敗・不明な応答を許可扱いにしない（再試行0）');
  {
    for (const [label, opt] of [['例外', { throwOn: 'reserve_spend' }], ['error 応答（権限なし等）', { errorOn: 'reserve_spend' }], ['data なし', { nullOn: 'reserve_spend' }], ['形の不明な data', { badOn: 'reserve_spend' }]]) {
      const f = makeFakeRpc(opt); const r = await gateFor(f).reserve(req('run-e1', 10));
      assert(r.approved === false && r.reason === 'reservation_outcome_unknown' && f.calls.length === 1, '3. ' + label + ' → 結果不明・許可しない・呼び出し1回');
    }
    const fe = makeFakeRpc({ errorWithDataOn: 'reserve_spend' });
    const re = await gateFor(fe).reserve(req('run-e4', 10));
    assert(re.approved === false && re.reason === 'reservation_outcome_unknown', '3-4b. error と一緒に「予約済み」の data が返っても許可しない（error を優先）');
    const f2 = makeFakeRpc({ throwOn: 'mark_spend_invoked' }); const g2 = gateFor(f2);
    await g2.reserve(req('run-e2', 10));
    const inv = await g2.markInvoked({ runId: 'run-e2' });
    assert(inv.ok === false && inv.reason === 'store_outcome_unknown' && f2.calls.filter(c => c.fn === 'mark_spend_invoked').length === 1, '3-5. 遷移の例外も結果不明・再試行なし');
    const f3 = makeFakeRpc({ throwOn: 'reserve_spend' }); const st = createSpendStoreSupabase({ client: f3.client });
    await gateFor(f3).reserve(req('run-e3', 10));
    const look = await createSpendStoreSupabase({ client: makeFakeRpc().client }).getReservation('run-e3');
    assert(look.outcome === 'not_found' && typeof st.getReservation === 'function', '3-6. 結果不明は同じ runId で照合できる（getReservation）');
  }

  caseHeader('4. 偽 rpc での契約（DB 原子性の実証ではない）');
  {
    const f = makeFakeRpc(); const g = gateFor(f);
    const [a, b] = await Promise.all([g.reserve(req('run-c1', 60)), g.reserve(req('run-c2', 60))]);
    assert([a, b].filter(x => x.approved).length === 1, '4-1. 60＋60（上限100）で1件だけ予約');
    const f2 = makeFakeRpc(); const g2 = gateFor(f2);
    await g2.reserve(req('run-g1', 70, 'daily_copy_writer'));
    const rg = await g2.reserve(req('run-g2', 40, 'daily_reviewer'));
    assert(rg.approved === false && rg.reason === 'daily_limit_exceeded', '4-2. 用途が違っても global の上限を超えない');
    const f3 = makeFakeRpc(); const g3 = gateFor(f3);
    const [d1, d2] = await Promise.all([g3.reserve(req('run-same', 10)), g3.reserve(req('run-same', 10))]);
    assert([d1, d2].filter(x => x.approved).length === 1 && [d1, d2].some(x => x.reason === 'duplicate_run'), '4-3. 同じ runId の同時要求は1件だけ予約');
    const f4 = makeFakeRpc(); const g4 = gateFor(f4);
    await g4.reserve(req('run-t1', 50)); await g4.markInvoked({ runId: 'run-t1' }); await g4.markOutcomeUnknown({ runId: 'run-t1', detail: 'timeout' });
    assert(f4.rows.get('run-t1').state === 'outcome_unknown', '4-4. timeout 後の予約が残る');
    const rel = await g4.releaseBeforeCall({ runId: 'run-t1', reason: 'timeout' });
    assert(rel.ok === false && f4.rows.get('run-t1').state === 'outcome_unknown', '4-5. 呼び出し後の解放は拒否');
    const f5 = makeFakeRpc(); const g5 = gateFor(f5);
    await g5.reserve(req('run-o1', 10)); await g5.markInvoked({ runId: 'run-o1' });
    const so = await g5.settle({ runId: 'run-o1', settledAmount: 15, basis: 'usage' });
    assert(so.ok === true && f5.rows.get('run-o1').settled === 15, '4-6. 精算額が予約額を超えても切り捨てずに記録');
    const after = await g5.reserve(req('run-o2', 1, 'daily_reviewer'));
    assert(after.approved === false && f5.scopes.get('global').stopped === true, '4-7. 精算超過後は（別用途でも）次の予約を拒否');
    const f6 = makeFakeRpc({ serverDay: '2026-10-10' }); const g6 = gateFor(f6);
    const fake = await g6.reserve(req('run-p1', 10, null, { dayKey: '2026-10-09', monthKey: '2026-10', timeZone: 'Asia/Tokyo' }));
    assert(fake.approved === false && f6.rows.size === 0, '4-8. 日付の偽装（前日を申告）は拒否・予約0件');
    const fake2 = await g6.reserve(req('run-p2', 10, null, { dayKey: '2026-11-01', monthKey: '2026-11', timeZone: 'Asia/Tokyo' }));
    assert(fake2.approved === false && f6.rows.size === 0, '4-9. 月の偽装（翌月を申告）も拒否');
    const f7 = makeFakeRpc({ errorOn: 'reserve_spend' });
    const perm = await gateFor(f7).reserve(req('run-perm', 10));
    assert(perm.approved === false, '4-10. 権限エラー（error 応答）は許可しない（※DB の権限設定の実証ではない）');
    const f8 = makeFakeRpc({ scopes: { global: { daily: 100, monthly: 250, perRun: 80, stopped: false } } });
    const nl = await gateFor(f8).reserve(req('run-nl', 10));
    assert(nl.approved === false && f8.rows.size === 0, '4-11. 用途別の上限が未登録なら予約しない');
  }

  caseHeader('5. 精算の冪等性・別額の拒否');
  {
    const f = makeFakeRpc(); const g = gateFor(f);
    await g.reserve(req('run-s1', 10)); await g.markInvoked({ runId: 'run-s1' });
    const a = await g.settle({ runId: 'run-s1', settledAmount: 8, basis: 'usage' });
    const b = await g.settle({ runId: 'run-s1', settledAmount: 8, basis: 'usage' });
    const c = await g.settle({ runId: 'run-s1', settledAmount: 9, basis: 'usage' });
    assert(a.ok && b.ok && b.idempotent === true && c.ok === false && c.reason === 'settle_conflict', '5-1. 同額は冪等・別額は拒否');
  }

  caseHeader('6. 静的境界（JS）');
  {
    const src = fs.readFileSync(path.join(__dirname, 'lib', 'spendStoreSupabase.js'), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert(!/process\.env|dotenv|\.env\.local/.test(src), '6-1. 環境変数・.env.local を読まない');
    assert(!/require\(/.test(src), '6-2. Supabase client などを require しない（接続先は依存のみ）');
    assert(!/while\s*\(|retry|setTimeout/i.test(src), '6-3. 再試行・待機の経路がない');
  }

  caseHeader('7. migration SQL の静的検査（未実行・構文や動作の確認ではない）');
  {
    const sql = fs.readFileSync(SQL_PATH, 'utf8');
    const code = sql.split('\n').filter(l => !/^\s*--/.test(l)).join('\n');
    assert(/^\s*begin;/m.test(code) && /^\s*commit;\s*$/m.test(code), '7-1. 1つの transaction で適用する');
    assert(/check \(amount_unit = 'micro_jpy'\)/.test(code) && /amount\s+bigint not null check \(amount > 0\)/.test(code), '7-2. 金額は bigint・単位は micro_jpy に固定');
    assert(/daily_limit\s+bigint not null/.test(code) && /monthly_limit\s+bigint not null/.test(code) && /per_run_limit\s+bigint not null/.test(code), '7-3. 日次・月次・1実行の上限が必須（NOT NULL）');
    assert(!/insert into public\.spend_limit_scopes/i.test(code), '7-4. 上限の具体額を登録しない（本番値もテスト値も入れない）');
    assert(/run_id\s+text primary key/.test(code), '7-5. run_id を主キーにして重複を DB で拒否');
    const fnBodies = code.split(/create or replace function /).slice(1);
    const mutating = fnBodies.filter(b => /^(public\.)?(reserve_spend|mark_spend_invoked|release_spend|mark_spend_unknown|settle_spend)\(/.test(b));
    assert(mutating.length === 5, '7-6. 5つの状態変更関数がある');
    const lockOrderOk = mutating.every(b => {
      const gi = b.search(/scope = 'global' for update/), pi = b.search(/scope = (p_purpose|v_purpose) for update/), ri = b.search(/from public\.spend_reservations where run_id = p_run_id for update/);
      return gi !== -1 && pi !== -1 && gi < pi && (ri === -1 || pi < ri);
    });
    assert(lockOrderOk, '7-7. すべての状態変更関数でロック順序が global → 用途別 → 予約行');
    assert(/release_refused:/.test(code) && /if r\.state <> 'reserved' then return jsonb_build_object\('outcome', 'release_refused:'/.test(code), '7-8. 解放は reserved のときだけ');
    assert(!/expire|interval|delete from/i.test(code), '7-9. 期限切れによる自動解放・削除の経路がない');
    assert(/already_settled_same/.test(code) && /settle_conflict/.test(code), '7-10. 同額の再精算は冪等・別額は拒否');
    assert(/v_overrun := p_settled_amount > r\.amount/.test(code) && /set stopped = true/.test(code) && /scope in \('global', v_purpose\)/.test(code), '7-11. 精算超過は切り捨てずに記録し、global と用途別を停止');
    assert(!/stopped = false,|set stopped = false/.test(code), '7-12. 停止の解除は実装しない');
    assert(/now\(\) at time zone g\.time_zone/.test(code) && /period_mismatch/.test(code), '7-13. 期間は DB の時刻で決め、申告と違えば拒否');
    assert((code.match(/from public, anon, authenticated;/g) || []).length === 8 && (code.match(/^grant execute on function .* to service_role;$/gm) || []).length === 6, '7-14. 表2つ・関数6つで anon/authenticated/public を剥奪し、関数は service_role だけに付与');
    assert(/grant select, update\s+on table public\.spend_limit_scopes to service_role;/.test(code) && /grant select, insert, update on table public\.spend_reservations to service_role;/.test(code) && !/grant[^;]*delete/i.test(code), '7-14b. service_role の表権限を明示（DELETE なし・上限表は INSERT なし）');
    const pols = code.match(/create policy [^;]*;/gi) || [];
    assert((code.match(/enable row level security/g) || []).length === 2 && pols.length === 2 && pols.every(p => / to service_role /.test(p)), '7-15. RLS を有効にし、ポリシーは service_role 向けの2つだけ');
    assert(/p_expected_daily_limit is distinct from s\.daily_limit/.test(code) && /'limits_mismatch'/.test(code), '7-17. 呼び出し側の上限と DB の上限を照合する');
    assert(!/security definer/i.test(code) && (code.match(/set search_path = pg_catalog, public/g) || []).length === 6, '7-16. SECURITY DEFINER を使わず、全関数で search_path を固定');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed === 0) {
    console.log('🟢 All spendStoreSupabase cases passed（偽 rpc と静的検査のみ・SQL 未実行・DB 原子性の実証ではない）');
  } else {
    console.log('🔴 Some cases failed');
    process.exit(1);
  }
})().catch(function (e) { console.error('テスト実行エラー:', e && e.stack); process.exit(1); });
