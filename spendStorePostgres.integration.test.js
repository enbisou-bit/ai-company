'use strict';
// spendStorePostgres.integration.test.js
// Instagram Daily Production — 予算予約ストアの実 PostgreSQL 結合テスト（ローカルの隔離検証 DB 専用）。
//
//   ★ 本番・Supabase には接続しない。接続先は次の明示的な変数だけから決める（.env.local や SUPABASE_* は読まない）:
//       SPEND_VERIFY_PSQL      psql 実行ファイルのパス
//       SPEND_VERIFY_PASSFILE  検証用管理ユーザーのパスワードファイル（値は出力しない）
//       SPEND_VERIFY_PORT      ポート（localhost 専用）
//     ホストは 127.0.0.1、DB 名は spend_gate_verify、ユーザーは verify_admin に固定。
//     実行前にサーバーのデータフォルダ名に 'pg-verify' が含まれること・DB 名が一致することを確認し、
//     一致しなければ SQL を1つも実行せずに停止する。変数がなければ SKIPPED として終了する（失敗ではない）。
//   ★ 各 psql は別プロセス＝別の DB 接続。同時実行の確認はこの別接続で行う。
//   ★ 検証用の上限値は、この検証 DB にだけ登録する（本番設定ではない）。各ケースの前に検証 DB の2表を初期化する。
//   ★ これはローカル PostgreSQL 17 での検証であり、Supabase 固有の挙動（PostgREST 経由の rpc・JWT による役割切替・
//     service_role の実際の属性）の実証ではない。

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const { createSpendGate } = require('./lib/spendGate');
const { createSpendStoreSupabase } = require('./lib/spendStoreSupabase');

const PSQL = process.env.SPEND_VERIFY_PSQL;
const PASSFILE = process.env.SPEND_VERIFY_PASSFILE;
const PORT = process.env.SPEND_VERIFY_PORT;
const HOST = '127.0.0.1';
const DB = 'spend_gate_verify';
const USER = 'verify_admin';

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }
const sleep = ms => new Promise(r => setTimeout(r, ms));

if (!PSQL || !PASSFILE || !PORT) {
  console.log('SKIPPED: SPEND_VERIFY_PSQL / SPEND_VERIFY_PASSFILE / SPEND_VERIFY_PORT が未設定（隔離検証 DB 専用のテスト）');
  process.exit(0);
}
const PASSWORD = fs.readFileSync(PASSFILE, 'utf8').trim();

// psql を1回起動して SQL（標準入力）を実行する。別プロセス＝別接続。パスワードは環境変数で渡し、出力しない。
function psql(sql, vars) {
  return new Promise((resolve) => {
    const args = ['-X', '-q', '-At', '-v', 'ON_ERROR_STOP=1', '-h', HOST, '-p', String(PORT), '-U', USER, '-d', DB];
    Object.keys(vars || {}).forEach(k => { args.push('-v', k + '=' + vars[k]); });
    const env = { PGPASSWORD: PASSWORD, PGCLIENTENCODING: 'UTF8', SYSTEMROOT: process.env.SYSTEMROOT, PATH: path.dirname(PSQL) };
    const p = spawn(PSQL, args, { env, windowsHide: true });
    let out = '', err = '';
    p.stdout.on('data', d => { out += d; });
    p.stderr.on('data', d => { err += d; });
    p.on('close', code => resolve({ code, out: out.trim(), err: err.trim(), endedAt: Date.now() }));
    p.stdin.end(sql);
  });
}

// service_role として関数を1回呼ぶ。引数は psql 変数（:'name'）で渡す（SQL へ直接埋め込まない）。
const FN_ARGS = {
  reserve_spend: ['p_run_id', 'p_purpose', 'p_provider', 'p_amount:bigint', 'p_amount_unit', 'p_day_key', 'p_month_key', 'p_time_zone', 'p_expected_daily_limit:bigint', 'p_expected_monthly_limit:bigint', 'p_expected_per_run_limit:bigint'],
  mark_spend_invoked: ['p_run_id'],
  release_spend: ['p_run_id', 'p_reason'],
  mark_spend_unknown: ['p_run_id', 'p_detail'],
  settle_spend: ['p_run_id', 'p_settled_amount:bigint', 'p_basis'],
  get_spend_reservation: ['p_run_id'],
};
function callSql(fn, params, opts) {
  opts = opts || {};
  const vars = {};
  const parts = FN_ARGS[fn].map(spec => {
    const [name, cast] = spec.split(':');
    const v = params[name];
    if (v === null || v === undefined) return name + ' => null';
    vars[name] = String(v);
    return name + ' => :\'' + name + '\'' + (cast ? '::' + cast : '');
  });
  const role = opts.role || 'service_role';
  const body = 'select public.' + fn + '(' + parts.join(', ') + ');';
  if (opts.holdMs) {
    return 'begin;\nset local role ' + role + ';\n' + body + '\nselect pg_sleep(' + (opts.holdMs / 1000) + ');\ncommit;\n';
  }
  return 'begin;\nset local role ' + role + ';\n' + body + '\ncommit;\n';
}
async function rpcRaw(fn, params, opts) {
  const r = await psql(callSql(fn, params, opts), {});
  return r;
}
// spendStoreSupabase に渡す rpc client（psql で実 DB を呼ぶ）
const pgClient = {
  async rpc(fn, params) {
    const r = await psql(callSql(fn, params), Object.fromEntries(Object.keys(params).filter(k => params[k] !== null && params[k] !== undefined).map(k => [k, String(params[k])])));
    if (r.code !== 0) return { data: null, error: { message: 'psql_error' } };
    const line = r.out.split('\n').filter(Boolean).pop();
    try { return { data: JSON.parse(line), error: null }; } catch (e) { return { data: null, error: { message: 'parse_error' } }; }
  },
};
// callSql は psql 変数で値を渡すため、rpcRaw でも変数を付ける
async function call(fn, params, opts) {
  const vars = Object.fromEntries(Object.keys(params).filter(k => params[k] !== null && params[k] !== undefined).map(k => [k, String(params[k])]));
  const r = await psql(callSql(fn, params, opts), vars);
  const line = r.out.split('\n').filter(Boolean).pop() || '';
  let data = null; try { data = JSON.parse(line); } catch (e) { data = null; }
  return Object.assign(r, { data });
}

const LIM = { daily: 100, monthly: 250, perRun: 80 };   // 検証 DB 専用の値（本番設定ではない）
async function resetDb(scopes) {
  scopes = scopes || ['global', 'daily_copy_writer', 'daily_reviewer'];
  const rows = scopes.map(s => "('" + s + "', 'micro_jpy', 'Asia/Tokyo', " + LIM.daily + ', ' + LIM.monthly + ', ' + LIM.perRun + ')').join(', ');
  const r = await psql('delete from public.spend_reservations;\ndelete from public.spend_limit_scopes;\n' +
    (rows ? 'insert into public.spend_limit_scopes (scope, amount_unit, time_zone, daily_limit, monthly_limit, per_run_limit) values ' + rows + ';\n' : ''), {});
  if (r.code !== 0) throw new Error('reset failed');
}
async function adminQuery(sql) { const r = await psql(sql, {}); return r; }

(async function main() {
  // ── 接続先の隔離確認（ここで違えば SQL を実行せずに止める）──
  const id = await psql("select current_database() || '|' || host(inet_server_addr()) || '|' || inet_server_port() || '|' || (select setting from pg_settings where name = 'data_directory') || '|' || split_part(version(), ' ', 2);", {});
  const [db, addr, port, dataDir, ver] = (id.out || '').split('|');
  if (id.code !== 0 || db !== DB || addr !== HOST || port !== String(PORT) || !/pg-verify/.test(dataDir || '')) {
    console.error('隔離検証 DB を確認できないため停止します（SQL は実行していません）。');
    process.exit(1);
  }
  console.log('接続先: ' + db + ' @ ' + addr + ':' + port + '（データフォルダ: pg-verify 配下・PostgreSQL ' + ver + '）');
  const dayRes = await psql("select to_char((now() at time zone 'Asia/Tokyo')::date, 'YYYY-MM-DD');", {});
  const DAY = dayRes.out;
  const MONTH = DAY.slice(0, 7);
  const PERIOD = { dayKey: DAY, monthKey: MONTH, timeZone: 'Asia/Tokyo' };
  const GATE_LIMITS = { amountUnit: 'micro_jpy', timeZone: 'Asia/Tokyo', dailyLimit: LIM.daily, monthlyLimit: LIM.monthly, perRunLimit: LIM.perRun };
  const store = createSpendStoreSupabase({ client: pgClient });
  const gate = createSpendGate({ mode: 'local_verification', store, limits: GATE_LIMITS });
  const req = (runId, amount, purpose) => ({ runId, purpose: purpose || 'daily_copy_writer', provider: 'openai', estimateAmount: amount, period: PERIOD });
  const rsvArgs = (runId, amount, purpose, over) => Object.assign({ p_run_id: runId, p_purpose: purpose || 'daily_copy_writer', p_provider: 'openai', p_amount: amount, p_amount_unit: 'micro_jpy', p_day_key: DAY, p_month_key: MONTH, p_time_zone: 'Asia/Tokyo', p_expected_daily_limit: LIM.daily, p_expected_monthly_limit: LIM.monthly, p_expected_per_run_limit: LIM.perRun }, over || {});
  const stateOf = async runId => (await adminQuery("select state from public.spend_reservations where run_id = '" + runId + "';")).out;

  caseHeader('1. 60＋60／上限100 の同時予約（別接続）で成功は1件だけ');
  {
    await resetDb();
    const [a, b] = await Promise.all([gate.reserve(req('run-c1', 60)), gate.reserve(req('run-c2', 60))]);
    assert([a, b].filter(x => x.approved).length === 1 && [a, b].some(x => x.reason === 'daily_limit_exceeded' && x.definitive === true), '1-1. gate＋実 DB で1件だけ予約（もう1件は明確な拒否）');
    await resetDb();
    // A がロックを保持している間に B が予約 → B は A の commit を待ち、A の予約を見て拒否される
    const pA = call('reserve_spend', rsvArgs('run-h1', 60), { holdMs: 1500 });
    await sleep(400);
    const startedB = Date.now();
    const pB = call('reserve_spend', rsvArgs('run-h2', 60));
    const [ra, rb] = await Promise.all([pA, pB]);
    assert(ra.data && ra.data.outcome === 'reserved' && rb.data && rb.data.outcome === 'daily_limit_exceeded', '1-2. ロック保持中の別接続は待たされ、commit 後の合計で拒否される');
    assert(rb.endedAt >= ra.endedAt - 50 && rb.endedAt - startedB >= 800, '1-3. B は A の commit まで待った（' + (rb.endedAt - startedB) + 'ms）');
    const many = await Promise.all([1, 2, 3, 4, 5, 6].map(i => gate.reserve(req('run-m' + i, 20, 'daily_reviewer'))));
    assert(many.filter(x => x.approved).length === 2, '1-4. 20×6 の同時予約（既に60使用済み）で2件だけ予約（合計100）');
  }

  caseHeader('2. 用途が違っても global 上限を超えない');
  {
    await resetDb();
    const [x, y] = await Promise.all([gate.reserve(req('run-g1', 70, 'daily_copy_writer')), gate.reserve(req('run-g2', 40, 'daily_reviewer'))]);
    assert([x, y].filter(v => v.approved).length === 1 && [x, y].some(v => v.reason === 'daily_limit_exceeded'), '2-1. 70（writer）＋40（reviewer）は global 100 を超えるため1件だけ');
    const sum = await adminQuery("select coalesce(sum(amount),0) from public.spend_reservations where state <> 'released';");
    assert(Number(sum.out) <= 100, '2-2. 予約合計が global 上限以内（' + sum.out + '）');
  }

  caseHeader('3. 同じ runId の同時予約は1件だけ');
  {
    await resetDb();
    const rs = await Promise.all([1, 2, 3, 4].map(() => gate.reserve(req('run-same', 10))));
    const cnt = await adminQuery("select count(*) from public.spend_reservations where run_id = 'run-same';");
    assert(rs.filter(r => r.approved).length === 1 && rs.filter(r => r.reason === 'duplicate_run').length === 3 && cnt.out === '1', '3-1. 4並列で予約1件・重複3件・行は1件');
  }

  caseHeader('4. reserve と settle の競合でも計上が正しい');
  {
    await resetDb();
    await call('reserve_spend', rsvArgs('run-s1', 60)); await call('mark_spend_invoked', { p_run_id: 'run-s1' });
    // settle（60→30）がロックを保持している間に、別接続が 70 を予約
    const pS = call('settle_spend', { p_run_id: 'run-s1', p_settled_amount: 30, p_basis: 'usage' }, { holdMs: 1500 });
    await sleep(400);
    const pR = call('reserve_spend', rsvArgs('run-s2', 70));
    const [rs, rr] = await Promise.all([pS, pR]);
    assert(rs.data.outcome === 'settled' && rr.data.outcome === 'reserved' && rr.data.dailyRemaining === 0, '4-1. 予約は settle の commit 後の合計（30）で判定され、70 を予約できる（残り0）');
    const total = await adminQuery("select sum(case state when 'released' then 0 when 'settled' then settled_amount else amount end) from public.spend_reservations;");
    assert(total.out === '100', '4-2. 計上の合計は 30＋70＝100');
    await resetDb();
    await call('reserve_spend', rsvArgs('run-s3', 30)); await call('mark_spend_invoked', { p_run_id: 'run-s3' });
    const pS2 = call('settle_spend', { p_run_id: 'run-s3', p_settled_amount: 60, p_basis: 'usage' }, { holdMs: 1500 });
    await sleep(400);
    const pR2 = call('reserve_spend', rsvArgs('run-s4', 50, 'daily_reviewer'));
    const [, rr2] = await Promise.all([pS2, pR2]);
    assert(rr2.data.outcome === 'spend_stopped', '4-3. 超過精算（30→60）の commit 後は、待っていた予約も停止で拒否される');
  }

  caseHeader('5. invoked / outcome_unknown の予約は解放できない');
  {
    await resetDb();
    await call('reserve_spend', rsvArgs('run-r1', 10)); await call('mark_spend_invoked', { p_run_id: 'run-r1' });
    const r1 = await call('release_spend', { p_run_id: 'run-r1', p_reason: 'abort' });
    await call('reserve_spend', rsvArgs('run-r2', 10)); await call('mark_spend_invoked', { p_run_id: 'run-r2' }); await call('mark_spend_unknown', { p_run_id: 'run-r2', p_detail: 'timeout' });
    const r2 = await call('release_spend', { p_run_id: 'run-r2', p_reason: 'timeout' });
    assert(r1.data.outcome === 'release_refused:invoked' && (await stateOf('run-r1')) === 'invoked', '5-1. invoked は解放拒否');
    assert(r2.data.outcome === 'release_refused:outcome_unknown' && (await stateOf('run-r2')) === 'outcome_unknown', '5-2. outcome_unknown は解放拒否・予約は残る');
    await call('reserve_spend', rsvArgs('run-r3', 10));
    const r3 = await call('release_spend', { p_run_id: 'run-r3', p_reason: 'abort_before_call' });
    assert(r3.data.outcome === 'released', '5-3. reserved（呼び出し前）は解放できる');
    const bad = await call('release_spend', { p_run_id: 'run-r3', p_reason: null });
    assert(bad.data.outcome === 'release_reason_missing', '5-4. 理由なしの解放は拒否');
  }

  caseHeader('6. 期限切れだけでは予約は解放されない');
  {
    await resetDb();
    await call('reserve_spend', rsvArgs('run-x1', 60)); await call('mark_spend_invoked', { p_run_id: 'run-x1' }); await call('mark_spend_unknown', { p_run_id: 'run-x1', p_detail: 'timeout' });
    await adminQuery("update public.spend_reservations set created_at = now() - interval '45 days', updated_at = now() - interval '45 days' where run_id = 'run-x1';");
    const r = await call('reserve_spend', rsvArgs('run-x2', 50));
    assert((await stateOf('run-x1')) === 'outcome_unknown' && r.data.outcome === 'daily_limit_exceeded', '6-1. 45日前の結果不明の予約も残り、残額に計上され続ける');
  }

  caseHeader('7. 同額の再精算は冪等・別額は拒否');
  {
    await resetDb();
    await call('reserve_spend', rsvArgs('run-q1', 10)); await call('mark_spend_invoked', { p_run_id: 'run-q1' });
    const [a, b] = await Promise.all([call('settle_spend', { p_run_id: 'run-q1', p_settled_amount: 8, p_basis: 'usage' }), call('settle_spend', { p_run_id: 'run-q1', p_settled_amount: 8, p_basis: 'usage' })]);
    const outs = [a.data.outcome, b.data.outcome].sort().join(',');
    assert(outs === 'already_settled_same,settled', '7-1. 同額の同時精算は1件が settled、もう1件は冪等（' + outs + '）');
    const c = await call('settle_spend', { p_run_id: 'run-q1', p_settled_amount: 9, p_basis: 'usage' });
    assert(c.data.outcome === 'settle_conflict', '7-2. 別額の再精算は拒否');
    const g = await gate.settle({ runId: 'run-q1', settledAmount: 8, basis: 'usage' });
    assert(g.ok === true && g.idempotent === true, '7-3. gate 経由でも同額は冪等');
  }

  caseHeader('8. 予約額を超える精算は切り捨てず記録し、global と用途別の後続予約を停止');
  {
    await resetDb();
    await call('reserve_spend', rsvArgs('run-o1', 20)); await call('mark_spend_invoked', { p_run_id: 'run-o1' });
    const s = await call('settle_spend', { p_run_id: 'run-o1', p_settled_amount: 35, p_basis: 'usage' });
    const row = await adminQuery("select settled_amount || '|' || overrun from public.spend_reservations where run_id = 'run-o1';");
    const scopes = await adminQuery("select string_agg(scope || ':' || stopped, ',' order by scope) from public.spend_limit_scopes;");
    assert(s.data.outcome === 'settled' && s.data.overrun === true && row.out === '35|true', '8-1. 精算額 35（予約 20）を切り捨てずに記録・overrun');
    assert(scopes.out === 'daily_copy_writer:true,daily_reviewer:false,global:true', '8-2. global と用途別（writer）が停止');
    const n1 = await gate.reserve(req('run-o2', 1, 'daily_copy_writer'));
    const n2 = await gate.reserve(req('run-o3', 1, 'daily_reviewer'));
    assert(n1.reason === 'spend_stopped' && n2.reason === 'spend_stopped' && n1.definitive === true, '8-3. 後続予約は（別用途も global 停止で）拒否・明確な拒否として返る');
  }

  caseHeader('9. 日付／月の偽装は拒否');
  {
    await resetDb();
    const prev = new Date(Date.parse(DAY + 'T00:00:00Z') - 86400000).toISOString().slice(0, 10);
    const a = await call('reserve_spend', rsvArgs('run-p1', 10, null, { p_day_key: prev, p_month_key: prev.slice(0, 7) }));
    const b = await call('reserve_spend', rsvArgs('run-p2', 10, null, { p_day_key: '2099-01-01', p_month_key: '2099-01' }));
    const c = await call('reserve_spend', rsvArgs('run-p3', 10, null, { p_day_key: DAY, p_month_key: '2099-01' }));
    const cnt = await adminQuery('select count(*) from public.spend_reservations;');
    assert(a.data.outcome === 'period_mismatch' && b.data.outcome === 'period_mismatch' && c.data.outcome === 'period_mismatch' && cnt.out === '0', '9-1. 前日・未来・月だけ違う申告はすべて拒否・予約0件');
    const g = await gate.reserve(Object.assign(req('run-p4', 10), { period: { dayKey: '2099-01-01', monthKey: '2099-01', timeZone: 'Asia/Tokyo' } }));
    assert(g.approved === false && g.reason === 'period_mismatch' && g.definitive === true, '9-2. gate 経由でも明確な拒否（結果不明ではない）');
  }

  caseHeader('10. 上限未設定・不一致なら予約不可');
  {
    await resetDb(['global']);
    const a = await gate.reserve(req('run-l1', 10));
    assert(a.approved === false && a.reason === 'limits_not_configured', '10-1. 用途別の上限がなければ予約不可');
    await resetDb([]);
    const b = await gate.reserve(req('run-l2', 10));
    assert(b.reason === 'limits_not_configured', '10-2. global の上限がなければ予約不可');
    await resetDb();
    const gMismatch = createSpendGate({ mode: 'local_verification', store, limits: Object.assign({}, GATE_LIMITS, { perRunLimit: 50 }) });
    const c = await gMismatch.reserve(req('run-l3', 10));
    assert(c.approved === false && c.reason === 'limits_mismatch' && (await adminQuery('select count(*) from public.spend_reservations;')).out === '0', '10-3. gate と DB の上限が違えば limits_mismatch で拒否（制限を弱めない）');
    const gProd = createSpendGate({ mode: 'production', store, limits: GATE_LIMITS });
    const d = await gProd.reserve(req('run-l4', 10));
    assert(d.approved === false && d.reason === 'store_atomicity_not_verified', '10-4. 検証に成功しても production モードでは未実証ストアを使えない');
  }

  caseHeader('11. anon／authenticated の権限では実行不可（service_role も DELETE 不可）');
  {
    await resetDb();
    for (const role of ['anon', 'authenticated']) {
      const f = await call('reserve_spend', rsvArgs('run-a-' + role, 10), { role });
      const t = await psql('begin;\nset local role ' + role + ';\nselect count(*) from public.spend_reservations;\ncommit;\n', {});
      const l = await psql('begin;\nset local role ' + role + ';\nselect count(*) from public.spend_limit_scopes;\ncommit;\n', {});
      assert(f.code !== 0 && /permission denied/.test(f.err) && t.code !== 0 && l.code !== 0, '11. ' + role + ': 関数・2つの表とも permission denied');
    }
    const del = await psql('begin;\nset local role service_role;\ndelete from public.spend_reservations;\ncommit;\n', {});
    const ins = await psql("begin;\nset local role service_role;\ninsert into public.spend_limit_scopes (scope, amount_unit, time_zone, daily_limit, monthly_limit, per_run_limit) values ('x_scope','micro_jpy','Asia/Tokyo',1,1,1);\ncommit;\n", {});
    assert(del.code !== 0 && ins.code !== 0, '11-3. service_role でも予約の削除・上限の追加はできない');
    const attrs = await adminQuery("select rolname || ':' || rolbypassrls from pg_roles where rolname = 'service_role';");
    const ok = await call('reserve_spend', rsvArgs('run-svc', 10));
    assert(attrs.out === 'service_role:false' && ok.data.outcome === 'reserved', '11-4. BYPASSRLS なしの service_role でも、明示した権限と RLS ポリシーで予約できる');
  }

  caseHeader('12. CHECK 制約で不正な状態・金額を拒否');
  {
    await resetDb();
    const base = "insert into public.spend_reservations (run_id, purpose, provider, day_key, month_key, amount, state";
    const day = "'" + DAY + "'::date", mon = "'" + MONTH + "'";
    const cases = [
      ['金額0', base + ") values ('run-k1','daily_copy_writer','openai'," + day + ',' + mon + ",0,'reserved');"],
      ['負の金額', base + ") values ('run-k2','daily_copy_writer','openai'," + day + ',' + mon + ",-5,'reserved');"],
      ['未知の状態', base + ") values ('run-k3','daily_copy_writer','openai'," + day + ',' + mon + ",10,'bogus');"],
      ['金額なしの settled', base + ") values ('run-k4','daily_copy_writer','openai'," + day + ',' + mon + ",10,'settled');"],
      ['global 用途', base + ") values ('run-k5','global','openai'," + day + ',' + mon + ",10,'reserved');"],
      ['日付と月の不一致', base + ") values ('run-k6','daily_copy_writer','openai'," + day + ",'2099-01',10,'reserved');"],
      ['理由なしの released', base + ") values ('run-k7','daily_copy_writer','openai'," + day + ',' + mon + ",10,'released');"],
      ['不正な runId', base + ") values ('x','daily_copy_writer','openai'," + day + ',' + mon + ",10,'reserved');"],
      ['超過フラグの偽装', base + ", settled_amount, settle_basis, overrun) values ('run-k8','daily_copy_writer','openai'," + day + ',' + mon + ",10,'settled',5,'u',true);"],
    ];
    for (const [label, sql] of cases) {
      const r = await adminQuery(sql);
      assert(r.code !== 0 && /violates (check|foreign key) constraint/.test(r.err), '12. ' + label + ' → 制約違反で拒否');
    }
    const lim = await adminQuery("insert into public.spend_limit_scopes (scope, amount_unit, time_zone, daily_limit, monthly_limit, per_run_limit) values ('bad_scope','jpy','Asia/Tokyo',100,50,200);");
    assert(lim.code !== 0, '12-x. 上限の単位違い・月<日・1実行>日次も拒否');
    const cnt = await adminQuery('select count(*) from public.spend_reservations;');
    assert(cnt.out === '0', '12-y. 不正な行は1件も入らない');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed === 0) {
    console.log('🟢 All spend store PostgreSQL integration cases passed（ローカル隔離 DB・PostgreSQL ' + ver + '。Supabase 固有の挙動は未検証）');
  } else {
    console.log('🔴 Some cases failed');
    process.exit(1);
  }
})().catch(function (e) { console.error('テスト実行エラー:', e && e.message); process.exit(1); });
