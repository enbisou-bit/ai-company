-- ════════════════════════════════════════════════════════════════════════════
-- supabase/migrations/20261010000000_daily_spend_gate.sql
-- Instagram Daily Production — 永続的な予算予約ストア（lib/spendGate.js の契約を PostgreSQL で実装）
--
--   ★★ ローカル PostgreSQL の隔離検証 DB にだけ適用して結合テスト済み（Supabase 固有の挙動は未検証）。
--       本番（Supabase）には未適用。本番への適用はユーザーの明示承認後のみ。
--   ★★ 予算上限の具体額はここに入れない（本番用の値もテスト値も登録しない）。
--       spend_limit_scopes の行は、適用後に Human が別途登録する。行が無い間は予約できない（fail-closed）。
--
--   契約:
--     - 金額は整数（bigint）、単位は 'micro_jpy'（0.000001円）に固定。
--     - scope は 'global'（全 provider・全用途の合計）と用途別（purpose）の2層。
--       予約は同じ transaction で global と用途別の両方の日次・月次・1実行の上限を確認する。
--     - ロック順序は固定: spend_limit_scopes の 'global' 行 → 用途別の行 → spend_reservations の行。
--       すべての関数が同じ順序でロックする（デッドロックと、reserve と settle の競合による合計の誤りを防ぐ）。
--     - 期間（day_key / month_key）は DB の now() を Asia/Tokyo で解釈して決める。
--       呼び出し側が渡した値は照合だけに使い、一致しなければ拒否する（別の日・月へ逃がせない）。
--     - run_id は主キー（DB で重複を拒否）。
--     - 状態遷移: reserved → invoked → settled ／ reserved → released ／ invoked → outcome_unknown → settled
--       呼び出し後（invoked / outcome_unknown）の予約は解放できない。期限切れによる自動解放はない。
--     - 同額の再精算は冪等、別額は拒否。
--     - 精算額が予約額を超えた場合は切り捨てずに記録し、global と用途別の scope を停止（stopped）する。
--       停止の解除はこの migration では実装しない（Human の照合後に別工程で行う）。
--     - anon / authenticated / public からは表にも関数にも直接アクセスできない。service_role だけが関数を実行できる。
--       関数は SECURITY INVOKER（呼び出し元の権限で実行）。search_path を固定し、参照先は public.* で修飾する。
--       service_role に必要な表権限（SELECT / INSERT / UPDATE。DELETE は付与しない）と RLS ポリシーを明示し、
--       既定の表権限や BYPASSRLS には依存しない。
--     - 呼び出し側（spendGate）が想定する用途別の上限を照合し、DB の値と一致しなければ limits_mismatch で拒否する。
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── 上限（scope ごと）──────────────────────────────────────────────────────
create table if not exists public.spend_limit_scopes (
  scope          text primary key check (scope ~ '^[a-z][a-z0-9_]{1,63}$'),
  amount_unit    text not null check (amount_unit = 'micro_jpy'),
  time_zone      text not null check (time_zone = 'Asia/Tokyo'),
  daily_limit    bigint not null check (daily_limit > 0),
  monthly_limit  bigint not null check (monthly_limit >= daily_limit),
  per_run_limit  bigint not null check (per_run_limit > 0 and per_run_limit <= daily_limit),
  stopped        boolean not null default false,
  stopped_reason text,
  stopped_at     timestamptz,
  updated_at     timestamptz not null default now(),
  check (stopped = (stopped_at is not null))
);

-- ── 予約（実行ごと）────────────────────────────────────────────────────────
create table if not exists public.spend_reservations (
  run_id         text primary key check (run_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{2,127}$'),
  purpose        text not null references public.spend_limit_scopes(scope),
  provider       text not null check (char_length(provider) between 1 and 64),
  day_key        date not null,
  month_key      text not null check (month_key ~ '^[0-9]{4}-[0-9]{2}$'),
  amount         bigint not null check (amount > 0),                   -- 見積額（予約額）
  state          text not null check (state in ('reserved','invoked','outcome_unknown','settled','released')),
  settled_amount bigint check (settled_amount >= 0),                   -- 呼び出し後の推定費用（切り捨てない）
  settle_basis   text,
  release_reason text,
  unknown_detail text,
  overrun        boolean not null default false,                       -- 精算額 > 予約額
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (purpose <> 'global'),
  check (to_char(day_key, 'YYYY-MM') = month_key),
  check ((state = 'settled') = (settled_amount is not null)),
  check ((state = 'settled') or (settle_basis is null)),
  check ((state = 'released') = (release_reason is not null)),
  check (overrun = (state = 'settled' and settled_amount > amount))
);
create index if not exists spend_reservations_day_idx           on public.spend_reservations (day_key);
create index if not exists spend_reservations_month_idx         on public.spend_reservations (month_key);
create index if not exists spend_reservations_purpose_day_idx   on public.spend_reservations (purpose, day_key);
create index if not exists spend_reservations_purpose_month_idx on public.spend_reservations (purpose, month_key);

-- RLS を有効にし、ポリシーは service_role 用だけを作る（下記。anon / authenticated 用は作らない＝行を読めない・書けない）
alter table public.spend_limit_scopes enable row level security;
alter table public.spend_reservations enable row level security;
revoke all on table public.spend_limit_scopes from public, anon, authenticated;
revoke all on table public.spend_reservations from public, anon, authenticated;

-- service_role に必要な権限だけを明示（DELETE は付与しない。上限の行は Human が管理者権限で登録する）
grant select, update         on table public.spend_limit_scopes to service_role;
grant select, insert, update on table public.spend_reservations to service_role;
create policy spend_limit_scopes_service_role on public.spend_limit_scopes for all to service_role using (true) with check (true);
create policy spend_reservations_service_role on public.spend_reservations for all to service_role using (true) with check (true);

-- 計上額: released は 0、settled は推定費用、それ以外（reserved / invoked / outcome_unknown）は見積額
-- （関数内の SQL に同じ式を直接書く。補助関数は作らない＝権限の面を増やさない）

-- ── reserve_spend: global と用途別の上限を同じ transaction で確認して予約 ───────
create or replace function public.reserve_spend(
  p_run_id text, p_purpose text, p_provider text, p_amount bigint,
  p_amount_unit text, p_day_key text, p_month_key text, p_time_zone text,
  p_expected_daily_limit bigint, p_expected_monthly_limit bigint, p_expected_per_run_limit bigint
) returns jsonb
language plpgsql
security invoker
set search_path = pg_catalog, public
as $$
declare
  g public.spend_limit_scopes;
  s public.spend_limit_scopes;
  v_day date;
  v_month text;
  v_existing text;
  gd bigint; gm bigint; sd bigint; sm bigint;
begin
  if p_purpose is null or p_purpose = 'global' then return jsonb_build_object('outcome', 'invalid_purpose'); end if;
  if p_amount is null or p_amount <= 0 then return jsonb_build_object('outcome', 'invalid_amount'); end if;

  -- ロック順序: global → 用途別
  select * into g from public.spend_limit_scopes where scope = 'global' for update;
  if not found then return jsonb_build_object('outcome', 'limits_not_configured', 'scope', 'global'); end if;
  select * into s from public.spend_limit_scopes where scope = p_purpose for update;
  if not found then return jsonb_build_object('outcome', 'limits_not_configured', 'scope', p_purpose); end if;

  -- 呼び出し側が想定する用途別の上限と DB の値が違えば拒否（不一致を黙って無視しない）
  if p_expected_daily_limit is distinct from s.daily_limit
     or p_expected_monthly_limit is distinct from s.monthly_limit
     or p_expected_per_run_limit is distinct from s.per_run_limit then
    return jsonb_build_object('outcome', 'limits_mismatch', 'scope', p_purpose);
  end if;

  if p_amount_unit is distinct from g.amount_unit or p_amount_unit is distinct from s.amount_unit then
    return jsonb_build_object('outcome', 'unit_mismatch');
  end if;
  if p_time_zone is distinct from g.time_zone then return jsonb_build_object('outcome', 'timezone_mismatch'); end if;

  -- 期間は DB の時刻から決める。呼び出し側の値は照合だけ。
  v_day := (now() at time zone g.time_zone)::date;
  v_month := to_char(v_day, 'YYYY-MM');
  if p_day_key is distinct from to_char(v_day, 'YYYY-MM-DD') or p_month_key is distinct from v_month then
    return jsonb_build_object('outcome', 'period_mismatch', 'serverDayKey', to_char(v_day, 'YYYY-MM-DD'), 'serverMonthKey', v_month);
  end if;

  if g.stopped or s.stopped then
    return jsonb_build_object('outcome', 'spend_stopped', 'scope', case when g.stopped then 'global' else p_purpose end);
  end if;

  select state into v_existing from public.spend_reservations where run_id = p_run_id;
  if found then return jsonb_build_object('outcome', 'duplicate_run', 'existingState', v_existing); end if;

  if p_amount > least(g.per_run_limit, s.per_run_limit) then
    return jsonb_build_object('outcome', 'per_run_limit_exceeded');
  end if;

  select
    coalesce(sum(case state when 'released' then 0 when 'settled' then settled_amount else amount end) filter (where day_key = v_day), 0),
    coalesce(sum(case state when 'released' then 0 when 'settled' then settled_amount else amount end) filter (where month_key = v_month), 0),
    coalesce(sum(case state when 'released' then 0 when 'settled' then settled_amount else amount end) filter (where day_key = v_day and purpose = p_purpose), 0),
    coalesce(sum(case state when 'released' then 0 when 'settled' then settled_amount else amount end) filter (where month_key = v_month and purpose = p_purpose), 0)
  into gd, gm, sd, sm
  from public.spend_reservations
  where month_key = v_month;

  if gd + p_amount > g.daily_limit   then return jsonb_build_object('outcome', 'daily_limit_exceeded',   'scope', 'global'); end if;
  if gm + p_amount > g.monthly_limit then return jsonb_build_object('outcome', 'monthly_limit_exceeded', 'scope', 'global'); end if;
  if sd + p_amount > s.daily_limit   then return jsonb_build_object('outcome', 'daily_limit_exceeded',   'scope', p_purpose); end if;
  if sm + p_amount > s.monthly_limit then return jsonb_build_object('outcome', 'monthly_limit_exceeded', 'scope', p_purpose); end if;

  begin
    insert into public.spend_reservations (run_id, purpose, provider, day_key, month_key, amount, state)
    values (p_run_id, p_purpose, p_provider, v_day, v_month, p_amount, 'reserved');
  exception when unique_violation then
    return jsonb_build_object('outcome', 'duplicate_run', 'existingState',
      (select state from public.spend_reservations where run_id = p_run_id));
  end;

  return jsonb_build_object(
    'outcome', 'reserved',
    'dayKey', to_char(v_day, 'YYYY-MM-DD'),
    'monthKey', v_month,
    'dailyRemaining',   least(g.daily_limit - (gd + p_amount),   s.daily_limit - (sd + p_amount)),
    'monthlyRemaining', least(g.monthly_limit - (gm + p_amount), s.monthly_limit - (sm + p_amount))
  );
end;
$$;

-- ── 共通: 予約行を固定のロック順序で取得（global → 用途別 → 予約行）───────────
--   各遷移関数の先頭で同じ手順を書く（補助関数を公開しない）。

-- ── mark_spend_invoked: reserved → invoked ──────────────────────────────────
create or replace function public.mark_spend_invoked(p_run_id text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_purpose text; r public.spend_reservations;
begin
  select purpose into v_purpose from public.spend_reservations where run_id = p_run_id;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;
  perform 1 from public.spend_limit_scopes where scope = 'global' for update;
  perform 1 from public.spend_limit_scopes where scope = v_purpose for update;
  select * into r from public.spend_reservations where run_id = p_run_id for update;
  if r.state <> 'reserved' then return jsonb_build_object('outcome', 'invalid_state:' || r.state); end if;
  update public.spend_reservations set state = 'invoked', updated_at = now() where run_id = p_run_id;
  return jsonb_build_object('outcome', 'invoked');
end;
$$;

-- ── release_spend: reserved → released（呼び出し前の中止だけ）─────────────────
create or replace function public.release_spend(p_run_id text, p_reason text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_purpose text; r public.spend_reservations;
begin
  if p_reason is null or char_length(p_reason) = 0 then return jsonb_build_object('outcome', 'release_reason_missing'); end if;
  select purpose into v_purpose from public.spend_reservations where run_id = p_run_id;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;
  perform 1 from public.spend_limit_scopes where scope = 'global' for update;
  perform 1 from public.spend_limit_scopes where scope = v_purpose for update;
  select * into r from public.spend_reservations where run_id = p_run_id for update;
  if r.state <> 'reserved' then return jsonb_build_object('outcome', 'release_refused:' || r.state); end if;
  update public.spend_reservations set state = 'released', release_reason = p_reason, updated_at = now() where run_id = p_run_id;
  return jsonb_build_object('outcome', 'released');
end;
$$;

-- ── mark_spend_unknown: invoked → outcome_unknown（予約は保持）─────────────────
create or replace function public.mark_spend_unknown(p_run_id text, p_detail text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_purpose text; r public.spend_reservations;
begin
  select purpose into v_purpose from public.spend_reservations where run_id = p_run_id;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;
  perform 1 from public.spend_limit_scopes where scope = 'global' for update;
  perform 1 from public.spend_limit_scopes where scope = v_purpose for update;
  select * into r from public.spend_reservations where run_id = p_run_id for update;
  if r.state not in ('invoked', 'outcome_unknown') then return jsonb_build_object('outcome', 'invalid_state:' || r.state); end if;
  update public.spend_reservations set state = 'outcome_unknown', unknown_detail = p_detail, updated_at = now() where run_id = p_run_id;
  return jsonb_build_object('outcome', 'outcome_unknown');
end;
$$;

-- ── settle_spend: invoked / outcome_unknown → settled（超過は記録して停止）──────
create or replace function public.settle_spend(p_run_id text, p_settled_amount bigint, p_basis text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare v_purpose text; r public.spend_reservations; v_overrun boolean;
begin
  if p_settled_amount is null or p_settled_amount < 0 then return jsonb_build_object('outcome', 'invalid_settled_amount'); end if;
  if p_basis is null or char_length(p_basis) = 0 then return jsonb_build_object('outcome', 'settle_basis_missing'); end if;
  select purpose into v_purpose from public.spend_reservations where run_id = p_run_id;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;
  perform 1 from public.spend_limit_scopes where scope = 'global' for update;
  perform 1 from public.spend_limit_scopes where scope = v_purpose for update;
  select * into r from public.spend_reservations where run_id = p_run_id for update;
  if r.state = 'settled' then
    return jsonb_build_object('outcome', case when r.settled_amount = p_settled_amount then 'already_settled_same' else 'settle_conflict' end);
  end if;
  if r.state not in ('invoked', 'outcome_unknown') then return jsonb_build_object('outcome', 'invalid_state:' || r.state); end if;
  v_overrun := p_settled_amount > r.amount;
  update public.spend_reservations
     set state = 'settled', settled_amount = p_settled_amount, settle_basis = p_basis, overrun = v_overrun, updated_at = now()
   where run_id = p_run_id;
  if v_overrun then
    -- 切り捨てずに記録し、global と用途別の後続予約を停止する（解除はこの migration では実装しない）
    update public.spend_limit_scopes
       set stopped = true, stopped_reason = 'settle_overrun:' || p_run_id, stopped_at = now(), updated_at = now()
     where scope in ('global', v_purpose) and stopped = false;
  end if;
  return jsonb_build_object('outcome', 'settled', 'overrun', v_overrun);
end;
$$;

-- ── get_spend_reservation: 同じ run_id での照合（読み取りのみ）──────────────────
create or replace function public.get_spend_reservation(p_run_id text) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare r public.spend_reservations;
begin
  select * into r from public.spend_reservations where run_id = p_run_id;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;
  return jsonb_build_object('outcome', 'found', 'runId', r.run_id, 'state', r.state, 'amount', r.amount,
    'settledAmount', r.settled_amount, 'overrun', r.overrun, 'dayKey', to_char(r.day_key, 'YYYY-MM-DD'), 'monthKey', r.month_key);
end;
$$;

-- ── 権限: public / anon / authenticated から実行不可。service_role のみ ───────────
revoke all on function public.reserve_spend(text, text, text, bigint, text, text, text, text, bigint, bigint, bigint) from public, anon, authenticated;
revoke all on function public.mark_spend_invoked(text)                                      from public, anon, authenticated;
revoke all on function public.release_spend(text, text)                                     from public, anon, authenticated;
revoke all on function public.mark_spend_unknown(text, text)                                from public, anon, authenticated;
revoke all on function public.settle_spend(text, bigint, text)                              from public, anon, authenticated;
revoke all on function public.get_spend_reservation(text)                                   from public, anon, authenticated;
grant execute on function public.reserve_spend(text, text, text, bigint, text, text, text, text, bigint, bigint, bigint) to service_role;
grant execute on function public.mark_spend_invoked(text)                                      to service_role;
grant execute on function public.release_spend(text, text)                                     to service_role;
grant execute on function public.mark_spend_unknown(text, text)                                to service_role;
grant execute on function public.settle_spend(text, bigint, text)                              to service_role;
grant execute on function public.get_spend_reservation(text)                                   to service_role;

commit;
