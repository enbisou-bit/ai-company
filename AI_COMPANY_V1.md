# 縁美創 AI COMPANY — マスタードキュメント Ver1.0
更新日：2026-06-25

---

## ▋ ブラウザ確認結果

| # | 確認項目 | 状態 | 備考 |
|---|---|---|---|
| ① | 4択提案（fixedSuggestions） | 🟢 完了 | 全14担当に設定済み。/api/profiles 正常。ブラウザ操作確認は次回 |
| ② | Strategy（戦略顧問）自動割り込み | 🟢 完了 | /api/strategy-monitor 正常。介入精度はブラウザ実操作で最終確認 |
| ③ | タスク自動進行（Auto-task workflow） | 🟢 完了 | /api/auto-task 正常。ブラウザでの実行確認は次回 |
| ④ | taskHistory（タスク履歴） | 🟢 完了 | /api/task-history 正常（total=0。自動タスク実行後に蓄積） |
| ⑤ | collaborators（相談可能担当）表示 | 🟢 完了 | /api/workflow-config 正常。全担当に設定済み |
| ⑥ | organizationMap（組織図）取得 | 🟢 完了 | /api/org-map 正常。16担当登録済み |

---

## ▋ 絶対ルール（変更禁止）

| # | ルール |
|---|---|
| 1 | 課金・有料API・外部有料サービスは絶対に勝手に使わない |
| 2 | クレジットカード登録・有料契約・API課金は必ず事前確認 |
| 3 | git commit / push 禁止 |
| 4 | ファイル削除禁止 |
| 5 | 既存機能削除禁止・追加のみで実装 |
| 6 | 動作確認はブラウザ http://localhost:3000 基準 |
| 7 | Leader自動振り分け・Strategy統合・履歴保存・ログイン機能は変更しない |
| 8 | Supabase を唯一の永続DB として使用。localStorageへ戻さない |
| 9 | Claude API・OpenAI設定変更・APIキー追加は必ず事前確認 |

---

## ▋ 技術構成

| 項目 | 内容 |
|---|---|
| バックエンド | Node.js + Express（server.js） |
| フロントエンド | Vanilla JS 単一ファイル（index.html / 6500行超） |
| AI（provider） | OpenAI gpt-4.1-nano（/v1/responses） |
| DB（永続化） | Supabase（conversations / messages / members テーブル） |
| 認証 | パスワード認証（WEB_APP_PASSWORD） |
| ポート | localhost:3000 |
| 環境変数 | .env.local |

---

## ▋ ファイル構成

| ファイル | 役割 |
|---|---|
| server.js | Express API・ルーティング・全エンドポイント |
| openaiClient.js | LINE_AGENT_PROFILES・AGENT_WORKFLOW_CONFIG・ORGANIZATION_MAP・buildSystemPrompt・AI呼び出し |
| index.html | フロントエンド全体（6500行超） |
| costTracker.js | API料金追跡・月額上限管理 |
| conversationHistory.js | 会話履歴のローカル管理 |
| lib/conversationsDb.js | 会話・メッセージのSupabase操作 |
| lib/membersDb.js | members取得・FALLBACK_MEMBERS動的生成 |
| lib/supabase.js | Supabaseクライアント |
| .env.local | 環境変数（API KEY・DB接続・パスワード） |
| AI_COMPANY_V1.md | 本マスタードキュメント |

---

## ▋ 担当一覧（15担当）

| カテゴリ | ID | 表示名 | provider（AIの種類） | enabled（有効） |
|---|---|---|---|---|
| 経営・管理 | leader | 🎯 Leader｜蓮 | openai | true |
| 経営・管理 | strategy | ♟️ 戦略顧問 | openai（将来 claude） | true |
| 経営・管理 | secretary | 📅 Secretary | openai（将来 claude） | true |
| 経営・管理 | reviewer | 🔍 Reviewer | openai（将来 claude） | true |
| マーケティング | sns | 📱 SNS担当 | openai | true |
| マーケティング | video | 🎬 Video担当 | openai | true |
| マーケティング | nurture | 💌 Nurture | openai（将来 claude） | true |
| マーケティング | branding | ✨ Branding | openai（将来 claude） | true |
| 制作 | writer | ✍️ Writer | openai（将来 claude） | true |
| 制作 | designer | 🎨 Designer | openai（将来 claude） | true |
| 制作 | lp | 🌐 LP担当 | openai（将来 claude） | true |
| 分析・調査 | analyst | 📊 Analyst | openai | true |
| 分析・調査 | researcher | 🔍 Researcher | openai | true |
| 営業・顧客対応 | sales | 💪 Sales | openai | true |
| 営業・顧客対応 | cs | 🤝 CS | openai | true |
| （将来）営業 | estimate | 🧮 Estimate | openai | **false**（未実装） |

> ※ 将来追加予定：現場写真解析担当・画像生成担当・LINE人格分離

---

## ▋ organizationMap（組織図）

```
Leader（最上位・最終承認者）
├── 直属部下（children）13名
│   ├── 経営・管理：Secretary / Reviewer
│   ├── マーケティング：SNS / Video / Nurture / Branding
│   ├── 制作：Writer / Designer / LP
│   ├── 分析・調査：Analyst / Researcher
│   └── 営業・顧客対応：Sales / CS
└── 相談（collaborators）：Strategy / Secretary

Strategy（顧問・Leaderと同格）
├── parent（上司）：なし
└── collaborators（相談先）：Leader / Analyst / Researcher
```

### 全担当の組織情報

| 担当 | parent（上司） | reviewer（確認担当） | finalApprover（最終承認） |
|---|---|---|---|
| leader | なし | reviewer | leader |
| strategy | なし | なし | leader |
| secretary | leader | reviewer | leader |
| reviewer | leader | なし | leader |
| sns | leader | reviewer | leader |
| video | leader | reviewer | leader |
| nurture | leader | reviewer | leader |
| branding | leader | reviewer | leader |
| writer | leader | reviewer | leader |
| designer | leader | reviewer | leader |
| lp | leader | reviewer | leader |
| analyst | leader | reviewer | leader |
| researcher | leader | reviewer | leader |
| sales | leader | reviewer | leader |
| cs | leader | reviewer | leader |

---

## ▋ collaborators（相談可能担当）一覧

| 担当 | 相談できる担当（collaborators） |
|---|---|
| leader | strategy / secretary（全担当へ振り分け可） |
| strategy | leader / analyst / researcher |
| secretary | leader / reviewer |
| reviewer | writer / designer / lp / branding / sns / video / nurture / sales / cs |
| sns | designer / writer / video / branding |
| video | sns / writer / designer |
| nurture | writer / cs / branding |
| branding | writer / designer / lp |
| writer | researcher / reviewer / branding |
| designer | writer / branding / lp |
| lp | writer / designer / analyst |
| analyst | researcher / strategy |
| researcher | analyst / strategy |
| sales | writer / cs / branding |
| cs | sales / nurture |

> ※ 現時点は設計定義のみ。実際の相談処理は将来実装。

---

## ▋ workflow（作業の流れ）— タスク自動進行

```
ユーザー → Leader に依頼
    ↓
Leader が担当を選定（dispatch）
    ↓
【並列または順次】各担当が実行
    ↓  dependsOn（前工程）があれば前の成果を引き継ぐ
    ↓
Strategy（戦略顧問）が必要時のみ自動割り込み
    ↓
Leader が統合提案（最終まとめ）
    ↓
4択提案（fixedSuggestions）表示
    ↓
ユーザーが選択
    ↓
taskHistory（タスク履歴）に記録（Supabaseへ保存）
```

### タスク1件の構造（task structure）

| フィールド | 型 | 内容 |
|---|---|---|
| id | string | タスクの一意ID |
| agentId | string | 担当ID |
| instruction | string | 担当への指示内容 |
| dependsOn | string[] | 前工程タスクIDの配列 |
| provider | string | AIの種類（"openai" / 将来 "claude"） |
| enabled | boolean | 有効・無効 |
| collaborators | string[] | 相談可能担当IDの配列 |
| status | string | 進行状態（pending/running/completed/error/skipped） |
| result | string\|null | 実行結果テキスト |
| startedAt | string\|null | 実行開始日時（ISO 8601） |
| completedAt | string\|null | 実行完了日時（ISO 8601） |

---

## ▋ taskHistory（タスク履歴）の構造

| フィールド | 内容 |
|---|---|
| historyId | 履歴の一意ID |
| from（依頼元） | leader または前工程の担当ID |
| to（依頼先） | 実行担当ID |
| taskId | 対応するタスクID |
| instruction（指示内容） | 担当への指示テキスト |
| status（進行状態） | completed / error / skipped |
| requestedAt（依頼日時） | ISO 8601 |
| completedAt（完了日時） | ISO 8601 |
| note | エラーメモ等 |

---

## ▋ API一覧

### 既存API（変更禁止）

| メソッド | エンドポイント | 用途 |
|---|---|---|
| POST | /api/chat | 各担当への通常チャット |
| POST | /api/login | ログイン認証 |
| GET | /api/profiles | 担当一覧・カテゴリ取得 |
| GET | /api/members | Supabase担当一覧取得 |
| GET | /api/cost | API料金メーター |
| POST | /api/strategy-monitor | Strategy自動割り込み判定 |
| POST | /api/strategy-consolidate | 全担当統合意見生成 |
| POST | /api/leader-summary | Leader最終まとめ生成 |
| GET/POST | /api/messages | Supabaseメッセージ保存・取得 |
| GET/POST | /api/cases | 案件管理（Supabase） |

### 追加API（Ver1.0 新規）

| メソッド | エンドポイント | 用途 |
|---|---|---|
| POST | /api/auto-task | タスク自動進行（workflow実行） |
| GET | /api/workflow-config | 担当ごとのprovider/enabled/collaborators取得 |
| GET | /api/task-history | taskHistory（タスク履歴）取得 |
| GET | /api/org-map | organizationMap（組織図）取得 |

---

## ▋ 完了済み機能

| 機能 | 状態 |
|---|---|
| 15担当のpersonaRegistry（LINE_AGENT_PROFILES） | 🟢 完了 |
| 担当追加 = LINE_AGENT_PROFILES に1オブジェクト追加のみ | 🟢 完了 |
| Leader 自動振り分け（dispatch） | 🟢 完了 |
| UI左メニュー（カテゴリ別・動的生成） | 🟢 完了 |
| 各担当の4択提案（fixedSuggestions） | 🟢 完了 |
| 4択ボタンのF5・担当切替後復元 | 🟢 完了 |
| voiceOpener（担当識別1行目） | 🟢 完了 |
| 会話保存（Supabase conversations / messages） | 🟢 完了 |
| F5・再ログイン後の履歴復元 | 🟢 完了 |
| Supabase members RLS修正 | 🟢 完了 |
| Strategy（戦略顧問）自動割り込みUI | 🟢 完了 |
| Strategy割り込み監視（/api/strategy-monitor） | 🟢 完了 |
| チャットタスク進行ステータス | 🟢 完了 |
| 料金メーター（/api/cost） | 🟢 完了 |
| タスク自動進行（/api/auto-task） | 🟢 完了 |
| AGENT_WORKFLOW_CONFIG（provider/enabled/collaborators） | 🟢 完了 |
| taskHistory（タスク履歴）記録・取得 | 🟢 完了 |
| organizationMap（組織図） | 🟢 完了 |

---

## ▋ 未実装機能

| 機能 | 状態 | 備考 |
|---|---|---|
| AI社員間の実際の相談処理 | 🔴 未実装 | collaborators 設計のみ完了 |
| 組織図に基づく上司確認・最終承認ルーティング | 🔴 未実装 | organizationMap 設計のみ完了 |
| taskHistory の画面表示 | 🔴 未実装 | データ蓄積のみ |
| タスク自動進行のリアルタイム進捗表示 | 🔴 未実装 | 完了後一括表示 |
| 料金メーターの担当別集計（現在の15担当対応） | 🔴 未実装 | Claude API実装後に両provider対応で修正予定 |
| Estimate（見積担当）＋見積アプリ | 🔴 未実装 | 見積アプリ完成後に接続 |
| 現場写真解析担当 | 🔴 未実装 | 将来追加 |
| 画像生成担当 | 🔴 未実装 | 将来追加 |
| LINE人格分離 | 🔴 未実装 | 将来追加 |
| Claude API切り替え（strategy/writer他7担当） | 🔴 未実装 | 設計済み・実装待ち |

---

## ▋ 今後の優先順位

| 優先 | 機能 | 内容 |
|---|---|---|
| 1 | 4択提案・Strategy割り込みのブラウザ実動作確認 | ブラウザで各担当に話しかけて動作確認 |
| 2 | タスク自動進行のブラウザ実動作確認 | Leaderへ依頼→「⚡自動タスク実行」で確認 |
| 3 | taskHistory の画面表示 | 履歴ログパネルを追加 |
| 4 | AI社員間の相談処理実装 | collaborators 参照→相談API実装 |
| 5 | 料金メーターの15担当対応 | Claude API実装後に両provider分離集計 |
| 6 | Estimate担当＋見積アプリ | 見積アプリ完成後に接続 |
| 7 | 現場写真解析担当 | 将来追加 |
| 8 | 画像生成担当 | 将来追加 |
| 9 | LINE人格分離 | 将来追加 |

---

## ▋ 新担当追加手順（確定仕様）

`openaiClient.js` の `LINE_AGENT_PROFILES` に1オブジェクト追加するだけで以下が自動反映される：

1. Leader dispatch（自動認識）
2. UI左メニュー（カテゴリ別自動表示）
3. Supabase members テーブル（サーバー起動時に自動登録）
4. persona / voiceOpener（即時反映）
5. /api/profiles / /api/members（即時反映）

追加後は `AGENT_WORKFLOW_CONFIG` と `ORGANIZATION_MAP` にも1エントリ追加する。

---

## ▋ 開発ルール（自動着手・要確認・禁止）

### 自動で進めてよい作業
小修正・バグ修正・UI修正・新補助関数追加・ブラウザ確認・既存機能に影響しない新ファイル追加・4択確認と修正・Strategy確認と修正・タスク自動進行の追加実装

### 必ず事前確認が必要な作業
課金可能性のある作業・有料API追加・Claude API実装・OpenAI設定変更・APIキー追加変更削除・外部サービス契約・Supabaseテーブル・データ削除・ファイル削除・git commit/push・デプロイ・ログイン/履歴/Leader振り分けの大幅変更・既存機能削除・大きな仕様変更

### 絶対禁止
勝手な課金・契約・APIキー追加・ファイル削除・Supabaseデータ削除・git commit/push・既存機能削除・localStorageへの保存逆戻り

---

*このドキュメントは AI_COMPANY_V1.md として ai-company/ フォルダに保存されています。*
*機能追加のたびに更新してください。*
