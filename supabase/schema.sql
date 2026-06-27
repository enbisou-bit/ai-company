-- ============================================================
-- 縁美創 AI COMPANY — Supabase スキーマ
-- Supabase ダッシュボード > SQL Editor で実行してください
-- ============================================================

-- AI社員テーブル
CREATE TABLE IF NOT EXISTS members (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  role        TEXT,
  icon        TEXT,
  personality TEXT,
  specialty   TEXT,
  tone        TEXT,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- 会話テーブル
CREATE TABLE IF NOT EXISTS conversations (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    TEXT NOT NULL DEFAULT 'web-user',
  member_id  TEXT REFERENCES members(id),
  channel    TEXT DEFAULT 'web',  -- 'web' | 'line'
  title      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- メッセージテーブル
CREATE TABLE IF NOT EXISTS messages (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  sender          TEXT NOT NULL CHECK (sender IN ('user', 'assistant')),
  content         TEXT NOT NULL,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- タスクテーブル
CREATE TABLE IF NOT EXISTS tasks (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  description        TEXT,
  status             TEXT NOT NULL DEFAULT 'pending'
                       CHECK (status IN ('pending', 'in_progress', 'done')),
  priority           TEXT DEFAULT 'mid'
                       CHECK (priority IN ('high', 'mid', 'low')),
  assigned_member_id TEXT REFERENCES members(id),
  created_by         TEXT DEFAULT 'web-user',
  source_message     TEXT,
  created_at         TIMESTAMPTZ DEFAULT NOW(),
  updated_at         TIMESTAMPTZ DEFAULT NOW()
);

-- タスクログテーブル
CREATE TABLE IF NOT EXISTS task_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id    UUID REFERENCES tasks(id) ON DELETE CASCADE,
  member_id  TEXT REFERENCES members(id),
  action     TEXT NOT NULL,
  message    TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 初期AI社員データ（15名）
-- ============================================================
INSERT INTO members (id, name, role, icon, specialty, tone, is_active) VALUES
  ('leader',     'Leader',     'マーケリーダー',   '🎯', '全体判断・担当振り分け・方針整理',        '明快で頼りがいがあり、結論から先に伝える。',      true),
  ('strategy',   'Strategy',   '戦略顧問',         '♟️', '事業戦略・売上改善・優先順位整理',        '論理的で、ROIを意識した数字ベースの回答。',       true),
  ('secretary',  'Secretary',  '秘書',             '📋', '予定・タスク・情報整理',                  '丁寧で几帳面。箇条書きと期限を使って整理。',      true),
  ('reviewer',   'Reviewer',   'レビュワー',       '🔎', '文章・提案・見積・UIのチェック',           '建設的。良い点・改善点・修正案の3段構成。',       true),
  ('sns',        'SNS',        'SNS担当',          '📱', 'TikTok・Instagram・ショート動画集客',     'テンポよく行動喚起を強める。',                  true),
  ('video',      'Video',      '動画担当',         '🎬', '動画構成・台本・生成AI動画プロンプト',     'クリエイティブで具体的。台本は秒数付き。',        true),
  ('nurture',    'Nurture',    'ナーチャリング',   '💌', '見込み客育成・LINE導線・追客',             '温かく信頼感があり押し付けない。',               true),
  ('branding',   'Branding',   'ブランディング',   '✨', '会社イメージ・世界観・ブランド設計',        '感情に訴える。キャッチコピーは複数案。',          true),
  ('writer',     'Writer',     'ライター',         '✍️', 'チラシ文・営業文・LP文章',                '読者視点で分かりやすく。完成文そのまま使える形。', true),
  ('designer',   'Designer',   'デザイナー',       '🎨', 'チラシ・LP・配色・レイアウト改善',         '視覚的・具体的。Before→Afterの形で修正案。',     true),
  ('lp',         'LP',         'LP/Web担当',      '📄', 'ホームページ・LP・SEO・問い合わせ導線',    '実務的でCV率を意識する。',                      true),
  ('analyst',    'Analyst',    'アナリスト',       '📊', '数値分析・反響分析・改善提案',             '現状→問題点→改善策→期待効果の順で返す。',        true),
  ('researcher', 'Researcher', 'リサーチャー',     '🔍', '競合調査・市場調査・情報収集',             '事実と推測を分ける。末尾に示唆を入れる。',        true),
  ('sales',      'Sales',      '営業担当',         '🤝', '営業文・提案・クロージング',               '決断サポート型。営業トークは口語体で返す。',       true),
  ('cs',         'CS',         '顧客対応担当',     '💬', '返信文・クレーム対応・顧客フォロー',        '丁寧で誠実。返信文はそのまま送れる完成形。',      true)
ON CONFLICT (id) DO NOTHING;

-- ============================================================
-- 案件テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS cases (
  id          TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  user_text   TEXT,
  genre       TEXT,
  member_ids  TEXT[]    DEFAULT '{}',
  purpose     TEXT,
  proposals   TEXT[]    DEFAULT '{}',
  result      TEXT,
  ts          TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 顧客テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS customers (
  id               TEXT PRIMARY KEY,
  name             TEXT NOT NULL,
  industry         TEXT,
  problems         TEXT[]  DEFAULT '{}',
  contract_status  TEXT    DEFAULT '未成約',
  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),
  updated_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS customer_proposals (
  id          BIGSERIAL PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  proposal    TEXT NOT NULL,
  added_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 担当評価テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS member_scores (
  id           BIGSERIAL PRIMARY KEY,
  member_id    TEXT NOT NULL,
  case_id      TEXT,
  contribution INTEGER CHECK (contribution BETWEEN 1 AND 5),
  accuracy     INTEGER CHECK (accuracy     BETWEEN 1 AND 5),
  speed        INTEGER CHECK (speed        BETWEEN 1 AND 5),
  avg_score    NUMERIC(3,1),
  rated_at     TIMESTAMPTZ DEFAULT NOW()
);

-- 担当スコアサマリー（移動平均を保持）
CREATE TABLE IF NOT EXISTS member_score_summary (
  member_id        TEXT PRIMARY KEY,
  contribution_avg NUMERIC(3,1) DEFAULT 0,
  accuracy_avg     NUMERIC(3,1) DEFAULT 0,
  speed_avg        NUMERIC(3,1) DEFAULT 0,
  total_score      NUMERIC(3,1) DEFAULT 0,
  case_count       INTEGER      DEFAULT 0,
  updated_at       TIMESTAMPTZ  DEFAULT NOW()
);

-- ============================================================
-- 学習テーブル（担当×ジャンル別の成長記録）
-- ============================================================
CREATE TABLE IF NOT EXISTS member_learning (
  id            BIGSERIAL PRIMARY KEY,
  member_id     TEXT NOT NULL,
  genre         TEXT NOT NULL,
  success_count INTEGER  DEFAULT 0,
  failure_count INTEGER  DEFAULT 0,
  avg_rating    NUMERIC(3,1) DEFAULT 0,
  case_count    INTEGER  DEFAULT 0,
  improvements  TEXT[]   DEFAULT '{}',
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (member_id, genre)
);

CREATE TABLE IF NOT EXISTS best_practices (
  id           BIGSERIAL PRIMARY KEY,
  member_id    TEXT NOT NULL,
  genre        TEXT,
  user_message TEXT,
  reply        TEXT,
  rating       INTEGER,
  saved_at     TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS avoid_practices (
  id           BIGSERIAL PRIMARY KEY,
  member_id    TEXT NOT NULL,
  genre        TEXT,
  user_message TEXT,
  reason       TEXT,
  rating       INTEGER,
  saved_at     TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 会社記憶テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS company_memory (
  id          TEXT PRIMARY KEY,
  memory_type TEXT NOT NULL,   -- success|failure|high_profit|high_rating|complaint|improvement
  genre       TEXT,
  summary     TEXT,
  members     TEXT[]  DEFAULT '{}',
  rating      INTEGER,
  reason      TEXT,
  complaint   TEXT,
  resolution  TEXT,
  before_text TEXT,
  after_text  TEXT,
  saved_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 業種別ノウハウテーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS knowledge_library (
  id       TEXT PRIMARY KEY,
  genre    TEXT NOT NULL,
  title    TEXT NOT NULL,
  content  TEXT,
  source   TEXT DEFAULT 'manual',
  added_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 会社スコアテーブル（単一行）
-- ============================================================
CREATE TABLE IF NOT EXISTS company_score (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  total_cases          INTEGER DEFAULT 0,
  success_count        INTEGER DEFAULT 0,
  failure_count        INTEGER DEFAULT 0,
  rating_sum           NUMERIC DEFAULT 0,
  rating_count         INTEGER DEFAULT 0,
  avg_rating           NUMERIC(3,1) DEFAULT 0,
  revenue_contribution BIGINT  DEFAULT 0,
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  CHECK (id = 1)  -- 常に1行のみ
);
INSERT INTO company_score (id) VALUES (1) ON CONFLICT DO NOTHING;

-- ============================================================
-- RLS（Row Level Security）設定 — anon keyでの読み書きを許可
-- ============================================================
ALTER TABLE members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks         ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_logs     ENABLE ROW LEVEL SECURITY;

-- membersは全員読み取り可
CREATE POLICY "members_read_all"  ON members  FOR SELECT USING (true);

-- tasks: 読み書き可（anon key使用時）
CREATE POLICY "tasks_read_all"    ON tasks    FOR SELECT USING (true);
CREATE POLICY "tasks_insert_all"  ON tasks    FOR INSERT WITH CHECK (true);
CREATE POLICY "tasks_update_all"  ON tasks    FOR UPDATE USING (true);

-- task_logs: 書き込み可
CREATE POLICY "task_logs_insert"  ON task_logs FOR INSERT WITH CHECK (true);
CREATE POLICY "task_logs_read"    ON task_logs FOR SELECT USING (true);

-- conversations / messages: 読み書き可
CREATE POLICY "conv_read_all"     ON conversations FOR SELECT USING (true);
CREATE POLICY "conv_insert_all"   ON conversations FOR INSERT WITH CHECK (true);
CREATE POLICY "conv_update_all"   ON conversations FOR UPDATE USING (true);
CREATE POLICY "msg_read_all"      ON messages FOR SELECT USING (true);
CREATE POLICY "msg_insert_all"    ON messages FOR INSERT WITH CHECK (true);

-- 新テーブルのRLS有効化
ALTER TABLE cases                ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers            ENABLE ROW LEVEL SECURITY;
ALTER TABLE customer_proposals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_scores        ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_score_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE member_learning      ENABLE ROW LEVEL SECURITY;
ALTER TABLE best_practices       ENABLE ROW LEVEL SECURITY;
ALTER TABLE avoid_practices      ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_memory       ENABLE ROW LEVEL SECURITY;
ALTER TABLE knowledge_library    ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_score        ENABLE ROW LEVEL SECURITY;

-- 新テーブルのポリシー（anon key 読み書き許可）
CREATE POLICY "cases_all"            ON cases                FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "customers_all"        ON customers            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "cust_prop_all"        ON customer_proposals   FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "m_scores_all"         ON member_scores        FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "m_score_sum_all"      ON member_score_summary FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "m_learning_all"       ON member_learning      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "best_prac_all"        ON best_practices       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "avoid_prac_all"       ON avoid_practices      FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "co_memory_all"        ON company_memory       FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "knowledge_all"        ON knowledge_library    FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "co_score_all"         ON company_score        FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 戦略顧問学習テーブル（単一行）
-- ============================================================
CREATE TABLE IF NOT EXISTS strategy_learning (
  id                   INTEGER PRIMARY KEY DEFAULT 1,
  total_interventions  INTEGER DEFAULT 0,
  positive_outcomes    INTEGER DEFAULT 0,
  rating_sum           NUMERIC DEFAULT 0,
  avg_post_rating      NUMERIC(3,1) DEFAULT 0,
  updated_at           TIMESTAMPTZ DEFAULT NOW(),
  CHECK (id = 1)
);
INSERT INTO strategy_learning (id) VALUES (1) ON CONFLICT DO NOTHING;

ALTER TABLE strategy_learning ENABLE ROW LEVEL SECURITY;
CREATE POLICY "strategy_learning_all" ON strategy_learning FOR ALL USING (true) WITH CHECK (true);
