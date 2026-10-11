-- ════════════════════════════════════════════════════════════════════════════
-- supabase/migrations/20261011000000_daily_production_authorization.sql
-- Instagram Daily Production — テーマ根拠の Human 確認記録と、1回限りの制作認可（永続ストア）
--
--   ★★ 専用ローカル検証環境（enbisou-spend-verify）でだけ適用・検証する。本番（Supabase）には未適用。
--       本番への適用はユーザーの明示承認後のみ。実案件の確認記録・認可はこの migration では作らない。
--
--   区別する記録:
--     daily_topic_reviews             … テーマパック（topic／版／内容 hash）を Human が確認した記録。パック内の申告とは別。
--     daily_production_authorizations … 確認済みパックで、この run／case／output の制作を1回だけ許す認可。
--     （生成後の Mobile Approval（output_drafts.review_state）・画像生成の承認とは無関係。それらの表は変更しない）
--
--   契約:
--     - 認可は run／case／output／topic／版／hash と確認記録へ束縛する。確認記録との対応は複合外部キーで DB が保証する
--       （確認記録の topic／版／hash と認可の topic／版／hash が一致しない認可は作れない）。
--     - run_id・output_id は一意（同じ run・同じ出力に認可は1件だけ）。有効期限は発行から最大 7 日。
--     - 消費は consume_daily_production_authorization() の条件付き UPDATE（未消費・期限内・対象一致・確認記録あり）で行う。
--       同時に呼ばれても勝者は1件（行ロックの後に条件を再評価するため、後続は 0 行更新 → already_consumed）。
--     - 消費済みを未消費へ戻す手段は作らない。認可・確認記録の内容の変更と削除はトリガーで拒否する（所有者・管理者も含む）。
--     - 確認記録の作成・認可の発行は Human の明示操作として、管理者（postgres）だけが実行できる関数に分ける。
--       service_role（自動制作の実行者）は読み取りと消費だけ。自分で確認記録や認可を作れない。
--
--   権限（RLS だけに依存しない）:
--     - 2 表とも public／anon／authenticated／service_role の権限をいったん全て取り消し、service_role に SELECT だけを付与。
--       （Supabase の既定権限で付く INSERT／UPDATE／DELETE／TRUNCATE 等を残さない。service_role は BYPASSRLS を持つ前提）
--     - 関数も全て取り消してから、照合（get）と消費（consume）の EXECUTE だけを service_role に付与。
--     - consume は SECURITY DEFINER: service_role に表の UPDATE 権限を与えずに、消費列（consumed_at／consumed_run_id）だけを
--       条件付きで更新させるため。search_path を pg_catalog, public に固定し、参照はすべて public.* で修飾する。
--       引数は照合にしか使わず、更新する列は固定（内容列は更新しない。トリガーでも拒否）。
--     - その他の関数は SECURITY INVOKER。トリガー関数は誰にも EXECUTE を付与しない。
-- ════════════════════════════════════════════════════════════════════════════

begin;

-- ── Human 確認記録（テーマパック単位）──────────────────────────────────────
create table if not exists public.daily_topic_reviews (
  review_id     text primary key check (review_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{2,127}$'),
  topic_id      text not null check (char_length(topic_id) between 1 and 128),
  pack_version  integer not null check (pack_version > 0),
  content_hash  text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  reviewed_by   text not null check (char_length(reviewed_by) between 1 and 128),
  reviewed_at   timestamptz not null default now(),
  note          text check (note is null or char_length(note) <= 2000),
  unique (review_id, topic_id, pack_version, content_hash)
);

-- ── 制作認可（1回限り）─────────────────────────────────────────────────────
create table if not exists public.daily_production_authorizations (
  authorization_id text primary key check (authorization_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{2,127}$'),
  review_id        text not null,
  run_id           text not null unique check (run_id ~ '^[A-Za-z0-9][A-Za-z0-9_.:-]{2,127}$'),
  case_id          text not null check (char_length(case_id) between 1 and 200),
  output_id        text not null unique check (char_length(output_id) between 1 and 200),
  topic_id         text not null check (char_length(topic_id) between 1 and 128),
  pack_version     integer not null check (pack_version > 0),
  content_hash     text not null check (content_hash ~ '^[a-f0-9]{64}$'),
  issued_by        text not null check (char_length(issued_by) between 1 and 128),
  issued_at        timestamptz not null default now(),
  expires_at       timestamptz not null,
  consumed_at      timestamptz,
  consumed_run_id  text,
  foreign key (review_id, topic_id, pack_version, content_hash)
    references public.daily_topic_reviews (review_id, topic_id, pack_version, content_hash),
  check (expires_at > issued_at and expires_at <= issued_at + interval '7 days'),
  check ((consumed_at is null) = (consumed_run_id is null)),
  check (consumed_run_id is null or consumed_run_id = run_id)
);

-- ── 改変・削除の拒否（トリガー）────────────────────────────────────────────
-- 確認記録: 更新・削除を拒否
create or replace function public.daily_topic_reviews_immutable() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  raise exception 'daily_topic_reviews is append-only (%)', tg_op using errcode = '42501';
end;
$$;
-- 認可: 内容列の変更・消費の取り消し・削除を拒否。許すのは未消費 → 消費（consumed_at／consumed_run_id の設定）だけ
create or replace function public.daily_production_authorizations_guard() returns trigger
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if tg_op <> 'UPDATE' then
    raise exception 'daily_production_authorizations rows cannot be removed (%)', tg_op using errcode = '42501';
  end if;
  if (new.authorization_id, new.review_id, new.run_id, new.case_id, new.output_id, new.topic_id, new.pack_version,
      new.content_hash, new.issued_by, new.issued_at, new.expires_at)
     is distinct from
     (old.authorization_id, old.review_id, old.run_id, old.case_id, old.output_id, old.topic_id, old.pack_version,
      old.content_hash, old.issued_by, old.issued_at, old.expires_at) then
    raise exception 'authorization content is immutable' using errcode = '42501';
  end if;
  if old.consumed_at is not null then
    raise exception 'authorization already consumed' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists daily_topic_reviews_no_update on public.daily_topic_reviews;
create trigger daily_topic_reviews_no_update before update or delete on public.daily_topic_reviews
  for each row execute function public.daily_topic_reviews_immutable();
drop trigger if exists daily_topic_reviews_no_truncate on public.daily_topic_reviews;
create trigger daily_topic_reviews_no_truncate before truncate on public.daily_topic_reviews
  for each statement execute function public.daily_topic_reviews_immutable();
drop trigger if exists daily_production_authorizations_guard on public.daily_production_authorizations;
create trigger daily_production_authorizations_guard before update or delete on public.daily_production_authorizations
  for each row execute function public.daily_production_authorizations_guard();
drop trigger if exists daily_production_authorizations_no_truncate on public.daily_production_authorizations;
create trigger daily_production_authorizations_no_truncate before truncate on public.daily_production_authorizations
  for each statement execute function public.daily_production_authorizations_guard();

-- ── Human の明示操作（管理者だけ）: 確認記録の作成・認可の発行 ─────────────────
create or replace function public.create_daily_topic_review(
  p_review_id text, p_topic_id text, p_pack_version integer, p_content_hash text, p_reviewed_by text, p_note text
) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  insert into public.daily_topic_reviews (review_id, topic_id, pack_version, content_hash, reviewed_by, note)
  values (p_review_id, p_topic_id, p_pack_version, p_content_hash, p_reviewed_by, p_note);
  return jsonb_build_object('outcome', 'created', 'reviewId', p_review_id);
end;
$$;

create or replace function public.issue_daily_production_authorization(
  p_authorization_id text, p_review_id text, p_run_id text, p_case_id text, p_output_id text,
  p_topic_id text, p_pack_version integer, p_content_hash text, p_issued_by text, p_valid_for interval
) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
begin
  if p_valid_for is null or p_valid_for <= interval '0' or p_valid_for > interval '7 days' then
    return jsonb_build_object('outcome', 'invalid_validity');
  end if;
  -- 確認記録との対応（topic／版／hash）は複合外部キーで保証される（一致しなければ 23503 で失敗）
  insert into public.daily_production_authorizations
    (authorization_id, review_id, run_id, case_id, output_id, topic_id, pack_version, content_hash, issued_by, issued_at, expires_at)
  values (p_authorization_id, p_review_id, p_run_id, p_case_id, p_output_id, p_topic_id, p_pack_version, p_content_hash, p_issued_by, now(), now() + p_valid_for);
  return jsonb_build_object('outcome', 'issued', 'authorizationId', p_authorization_id);
end;
$$;

-- ── 照合（読み取りのみ・service_role）───────────────────────────────────────
create or replace function public.get_daily_production_authorization(
  p_run_id text, p_case_id text, p_output_id text, p_topic_id text, p_pack_version integer, p_content_hash text
) returns jsonb
language plpgsql security invoker set search_path = pg_catalog, public as $$
declare a public.daily_production_authorizations; r public.daily_topic_reviews;
begin
  select * into a from public.daily_production_authorizations where run_id = p_run_id;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;
  if a.case_id is distinct from p_case_id or a.output_id is distinct from p_output_id or a.topic_id is distinct from p_topic_id
     or a.pack_version is distinct from p_pack_version or a.content_hash is distinct from p_content_hash then
    return jsonb_build_object('outcome', 'target_mismatch');
  end if;
  select * into r from public.daily_topic_reviews where review_id = a.review_id;
  if not found then return jsonb_build_object('outcome', 'review_missing'); end if;
  return jsonb_build_object(
    'outcome', 'found',
    'state', case when a.consumed_at is not null then 'consumed' when a.expires_at <= now() then 'expired' else 'available' end,
    'authorizationId', a.authorization_id,
    'expiresAt', a.expires_at,
    'target', jsonb_build_object('runId', a.run_id, 'caseId', a.case_id, 'outputId', a.output_id, 'topicId', a.topic_id,
                                 'packVersion', a.pack_version, 'contentHash', a.content_hash),
    'review', jsonb_build_object('reviewId', r.review_id, 'topicId', r.topic_id, 'packVersion', r.pack_version, 'contentHash', r.content_hash)
  );
end;
$$;

-- ── 1回限りの消費（service_role・SECURITY DEFINER）──────────────────────────
create or replace function public.consume_daily_production_authorization(
  p_authorization_id text, p_run_id text, p_case_id text, p_output_id text, p_topic_id text, p_pack_version integer, p_content_hash text
) returns jsonb
language plpgsql security definer set search_path = pg_catalog, public as $$
declare a public.daily_production_authorizations;
begin
  update public.daily_production_authorizations d
     set consumed_at = now(), consumed_run_id = p_run_id
   where d.authorization_id = p_authorization_id
     and d.consumed_at is null
     and d.expires_at > now()
     and d.run_id = p_run_id and d.case_id = p_case_id and d.output_id = p_output_id
     and d.topic_id = p_topic_id and d.pack_version = p_pack_version and d.content_hash = p_content_hash
     and exists (select 1 from public.daily_topic_reviews r
                  where r.review_id = d.review_id and r.topic_id = d.topic_id and r.pack_version = d.pack_version and r.content_hash = d.content_hash)
  returning * into a;
  if found then
    return jsonb_build_object('outcome', 'consumed', 'authorizationId', a.authorization_id, 'consumedAt', a.consumed_at);
  end if;
  select * into a from public.daily_production_authorizations where authorization_id = p_authorization_id;
  if not found then return jsonb_build_object('outcome', 'not_found'); end if;
  if a.consumed_at is not null then return jsonb_build_object('outcome', 'already_consumed'); end if;
  if a.run_id is distinct from p_run_id or a.case_id is distinct from p_case_id or a.output_id is distinct from p_output_id
     or a.topic_id is distinct from p_topic_id or a.pack_version is distinct from p_pack_version or a.content_hash is distinct from p_content_hash then
    return jsonb_build_object('outcome', 'target_mismatch');
  end if;
  if a.expires_at <= now() then return jsonb_build_object('outcome', 'expired'); end if;
  return jsonb_build_object('outcome', 'not_consumable');
end;
$$;

-- ── 権限: RLS ＋ 明示の REVOKE／GRANT ─────────────────────────────────────
alter table public.daily_topic_reviews enable row level security;
alter table public.daily_production_authorizations enable row level security;
revoke all on table public.daily_topic_reviews from public, anon, authenticated, service_role;
revoke all on table public.daily_production_authorizations from public, anon, authenticated, service_role;
grant select on table public.daily_topic_reviews to service_role;
grant select on table public.daily_production_authorizations to service_role;
drop policy if exists daily_topic_reviews_service_role_select on public.daily_topic_reviews;
create policy daily_topic_reviews_service_role_select on public.daily_topic_reviews for select to service_role using (true);
drop policy if exists daily_production_authorizations_service_role_select on public.daily_production_authorizations;
create policy daily_production_authorizations_service_role_select on public.daily_production_authorizations for select to service_role using (true);

revoke all on function public.daily_topic_reviews_immutable() from public, anon, authenticated, service_role;
revoke all on function public.daily_production_authorizations_guard() from public, anon, authenticated, service_role;
revoke all on function public.create_daily_topic_review(text, text, integer, text, text, text) from public, anon, authenticated, service_role;
revoke all on function public.issue_daily_production_authorization(text, text, text, text, text, text, integer, text, text, interval) from public, anon, authenticated, service_role;
revoke all on function public.get_daily_production_authorization(text, text, text, text, integer, text) from public, anon, authenticated, service_role;
revoke all on function public.consume_daily_production_authorization(text, text, text, text, text, integer, text) from public, anon, authenticated, service_role;
grant execute on function public.get_daily_production_authorization(text, text, text, text, integer, text) to service_role;
grant execute on function public.consume_daily_production_authorization(text, text, text, text, text, integer, text) to service_role;

commit;
