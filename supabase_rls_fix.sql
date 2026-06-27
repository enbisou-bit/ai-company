-- ════════════════════════════════════════════════════════
-- Supabase RLS 修正 SQL
-- 実行場所: Supabase Dashboard → SQL Editor
-- URL: https://supabase.com/dashboard/project/exkquhbznhhyusfbwsci/sql
-- ════════════════════════════════════════════════════════

-- Step1: LINE_AGENT_PROFILES に存在するが members テーブルに未登録の担当を追加
-- ※ ON CONFLICT DO NOTHING で既存レコードは変更しない（安全）
INSERT INTO members (id, name, role, icon, is_active)
VALUES
  ('estimate', 'Estimate', '見積・原価計算担当', '🧮', true)
ON CONFLICT (id) DO NOTHING;


-- Step2: members テーブルに anon INSERT Policy を追加
-- 目的: サーバー起動時の syncProfilesToSupabase() による自動同期を有効化
--       新担当を LINE_AGENT_PROFILES に追加した際、Supabase members テーブルへ
--       自動登録できるようにする。
-- ※ 既存の SELECT / UPDATE / DELETE Policy は変更しない
CREATE POLICY "allow_server_insert_members" ON members
FOR INSERT TO anon
WITH CHECK (true);


-- ════════════════════════════════════════════════════════
-- 確認クエリ（実行後に動作確認）
-- ════════════════════════════════════════════════════════

-- members テーブルの全担当を確認
SELECT id, name, role, icon, is_active FROM members ORDER BY id;

-- Policy 一覧を確認
SELECT policyname, cmd, roles, qual, with_check
FROM pg_policies
WHERE tablename = 'members';
