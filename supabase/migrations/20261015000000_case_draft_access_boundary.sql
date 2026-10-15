-- ════════════════════════════════════════════════════════════════════════════
-- supabase/migrations/20261015000000_case_draft_access_boundary.sql
-- 既存表 cases／output_drafts のアクセス境界（提案段階・未承認）
--
--   ★★ 本番（Supabase）には未適用。適用はユーザーの明示承認後のみ。
--       必ず「サーバー用キーの設定確認 → コード反映（lib/caseDraftSupabase.js を使う版）→ 反映確認」の後に適用する。
--       先に適用すると、anon キーで接続している旧コードの cases／output_drafts の読み書きが全て失敗する。
--
--   対象: public.cases・public.output_drafts の2表だけ。
--         既定権限（ALTER DEFAULT PRIVILEGES）・他の表・関数・スキーマの権限は変更しない。
--
--   権限:
--     - 2表とも PUBLIC／anon／authenticated／service_role の表権限（列権限を含む）をいったん全て取り消す。
--       PUBLIC からの継承も含めて、anon／authenticated に実効権限を残さない。
--     - service_role には現行機能に必要な SELECT／INSERT／UPDATE だけを付与する。
--         cases         : getCases・getCaseById（SELECT）、upsertCase（INSERT＋UPDATE）、updateCasePurpose・softDeleteCase（UPDATE）
--         output_drafts : getOutputDraft 等（SELECT）、upsertOutputDraft（INSERT＋UPDATE）、insertOutputDraftIfAbsent（INSERT）、
--                         setContentTypeIfUnset・updateContentValue・writeCanonicalContentEvidence（UPDATE）
--       DELETE は付与しない（cases の削除は論理削除＝UPDATE。lib/casesDb.deleteCase は未配線）。
--       TRUNCATE・REFERENCES・TRIGGER・MAINTAIN も付与しない。
--
--   ポリシー（変更理由）:
--     - 既存の cases_all／output_drafts_all は「TO public・USING (true)・WITH CHECK (true)」で、表権限を持つどの role にも
--       全行の読み書きを許す（行を絞っていない）。表権限を取り消した後は不要で、将来どこかの role に権限が付くと
--       そのまま全行を許すため削除する。
--     - RLS は有効のまま（ポリシー 0 件＝BYPASSRLS を持たない role は全行拒否）。service_role は BYPASSRLS のためポリシー不要。
--     - DB で制限しても、サーバー経由の操作の認可（session 等）は各 API route の責務として別に必要。
--
--   取り消し: 本 migration を取り消す SQL は repo 外の反映資料（rollback SQL）として別に用意する（このファイルには含めない）。
-- ════════════════════════════════════════════════════════════════════════════

begin;

set local lock_timeout = '5s';

-- 1. 表権限（列権限を含む）を全て取り消す
revoke all on table public.cases from public, anon, authenticated, service_role;
revoke all on table public.output_drafts from public, anon, authenticated, service_role;

-- 2. service_role に現行機能に必要な権限だけを付与する
grant select, insert, update on table public.cases to service_role;
grant select, insert, update on table public.output_drafts to service_role;

-- 3. 全行を許す public 向けポリシーを削除する（RLS は有効のまま）
drop policy if exists "cases_all" on public.cases;
drop policy if exists "output_drafts_all" on public.output_drafts;
alter table public.cases enable row level security;
alter table public.output_drafts enable row level security;

commit;
