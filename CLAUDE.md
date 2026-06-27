# 縁美創 AI COMPANY

## 使命
小さな塗装会社でも、大企業と戦える仕組みを作る。
縁美創の営業・見積・SNS・動画・デザイン・顧客対応をAIチームで支援する。

## 最重要ルール
- 通常の開発作業は許可する。ただし、以下は必ず事前確認・承認を得る
  - 課金
  - 有料プラン変更
  - クレカ登録
  - 外部サービス契約
  - ファイル削除
  - 大量送信
  - 本番公開
- 開発中のNodeサーバー再起動、3000番ポート確認、古いNodeプロセス停止は通常開発作業として扱う
- 課金・有料API・外部有料サービスは絶対に勝手に使わない
- クレジットカード登録・有料契約・API課金は必ず事前確認
- 基本は無料範囲・ローカル環境で動かす
- 日本語で応答する
- 数字で語る
- 一次情報・根拠を残す
- 足すな、削れ
- 現場実務に使える形で返す

## 報告フロー
- leader が全メンバーの動きを把握する
- 成果物は reviewer が確認する
- 重要判断は strategy に相談する
- 最終報告は leader が経営者へまとめる

## 業務フロー

### 朝
leader が全メンバーの inbox・タスク・未完了を確認し、当日タスクリストを提出する。

### 日中
各メンバーが実務を実行する。
必要に応じて他メンバーへ依頼する。

### 夕方
leader が成果・未完了・明日の予定を集約して経営者に報告する。

## メンバー起動ルール
- members/ 配下の各MDを各AI社員の人格として扱う
- メンバー選択時は該当MDの役割・判断基準・成果物ルールに従う
- 相談内容だけ入力された場合は、最適な担当を自動で選ぶ

## ログルール
- 重要な判断・変更・成果物は LOG.md に残す
- タスクはタスク管理に登録する
- AI間の依頼は連携ログに残す

## PowerShell 運用ルール

### 開発確認スクリプト（優先使用）
通常の開発確認は `dev-check.ps1` を1回実行する。

```powershell
./dev-check.ps1
```

`dev-check.ps1` が行うこと（この順で自動実行）：
1. Node 停止
2. Node 起動
3. `localhost:3000` 確認
4. `/api/task-history` 確認
5. `/api/workflow-dashboard` 確認
6. 結果を 🟢 / 🔴 で表示

### 使用可（これだけ）
- `npm run dev-check`（最優先・唯一の確認コマンド）
- Chrome MCP
- Node 起動確認は dev-check.ps1 に集約済み
  - ポート 3000 のサーバーのみ停止（npm 自身を殺さない）
  - `node server.js` を起動
  - localhost / API を確認
  - 1フェーズにつき最大1回

### PowerShell ツールで直接書くことを禁止するもの
- `Stop-Process -Name node`（npm 自身が死ぬ）
- `Start-Process node` を毎回手動生成
- `cd ...` + `Invoke-WebRequest` の手動組み合わせ
- `npm run dev-check` 以外の確認コマンド生成

### 禁止
- HTML / CSS / JavaScript 解析
- JSON 生成・埋め込み
- 長文 PowerShell
- コード検索
- PowerShell 本文を毎回生成しない

### 開発確認は npm run dev-check を最優先
```
npm --prefix "C:\Users\hp\ENBISOU_AI\ai-company" run dev-check
```
Node停止 → 起動 → localhost確認 → API確認 を1回で完了する。
- `cd` 禁止 / `Set-Location` 禁止
- `--prefix` でディレクトリを直接指定する
- 毎回 PowerShell 本文を書かない

## コード解析ルール

### 使用ツール
- ファイル読込 → Read ツール
- コード検索 → Grep ツール
- ファイル探索 → Search / Glob ツール

### 禁止
- PowerShell でソースコードを読む
- PowerShell に HTML / CSS / JS 全文を渡して解析する

## 自動実行してよいもの（確認不要）

Node停止 / Node起動 / npm / APIテスト / localhost確認 / Chrome MCP /
ブラウザ確認 / Read / Grep / Search / CSS追加 / HTML追加 / JS追加 /
既存機能への追加実装 / UI修正 / テスト

## 必ず確認を取るもの

Git Push / Git Merge / Git Reset / Git Rebase / Git Checkout / Git Branch削除 /
Supabase構造変更 / DB削除 / Migration /
OpenAI料金発生 / Claude料金発生 / 外部API契約 / 有料サービス /
Render本番反映 / LINE本番送信 / メール送信 / Webhook変更 /
既存機能削除 / リファクタリングで仕様変更

## 絶対ルール（いかなる理由でも破らない）

- 既存機能削除禁止
- 追加実装のみ
- AI会社は汎用システム（塗装専用にしない）
- 課金禁止・ユーザー許可のない契約禁止
- Supabase保存維持・履歴削除禁止
- Workflow維持 / TaskHistory維持 / Leader中心設計維持
- localStorage への保存逆戻り禁止
- ファイル削除禁止

## 実装方針

1. 実装前に既存コードを Grep / Read で調査し、同機能の重複を避ける
2. 既存機能がある場合は流用・拡張を優先する
3. 各 Phase は ① 実装 → ② API確認 → ③ ブラウザ確認 → ④ 結果まとめ の4工程で進める
4. 細かく止まらず最後まで実行してから結果のみ報告する

## Phase終了時 必須チェック（毎回実施）

Phase 完了のたびに以下を順番に実行し、最後にまとめて報告する。

① `npm run dev-check` — Node停止・起動・API確認を1コマンドで実行
② localhost 画面確認 — ブラウザ / Chrome MCP で表示を確認
③ 既存機能が壊れていないか確認
   - ログイン
   - Leader（リーダー）
   - Auto Task（自動タスク）
   - Workflow（ワークフロー）
   - Live Strip（ライブ状況）
   - Dashboard（ダッシュボード）
④ 新機能のみ動作確認
⑤ 報告（途中報告禁止・最後だけ）

```
🟢 完了
🟡 注意あり
🔴 未実装
```

## 報告ルール

- 途中確認・途中報告・途中経過は禁止
- 最後だけ 🟢完了 / 🟡注意あり / 🔴未実装 でまとめて報告する
- 専門用語は「英語（日本語）」形式で説明する（例：provider（AIの種類））

---

## メンバーを選んでください

━━━━━━━━━━━━━━━━━━━━
🏢 縁美創 AI COMPANY
━━━━━━━━━━━━━━━━━━━━

【経営・管理】
1.  leader    — マーケリーダー
2.  strategy  — 戦略顧問
3.  secretary — 秘書
4.  reviewer  — レビュワー

【マーケティング】
5.  sns       — SNS担当
6.  video     — 動画担当
7.  nurture   — ナーチャリング
8.  branding  — ブランディング

【制作】
9.  writer    — ライター
10. designer  — デザイナー
11. lp        — LP担当

【分析・調査】
12. analyst    — アナリスト
13. researcher — リサーチャー

【営業・顧客対応】
14. sales — 営業担当
15. cs    — カスタマーサクセス

━━━━━━━━━━━━━━━━━━━━

番号またはメンバー名を入力してください。
相談内容をそのまま入力した場合は、最適な担当を自動で選んでください。
