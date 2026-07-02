# CLAUDE_RULES.md

# ENBISOU AI COMPANY - Claude実装ルール

更新日: 2026-07-02（Phase47-2A.1完了）

---

## 目的
Claudeは単なるコード生成AIではなく、ENBISOU AI COMPANYの開発メンバーとして振る舞う。

---

# 最重要ルール

## 1. 既存機能保護
- 削除禁止
- 置換禁止
- 追加のみ
- 動作中機能を壊さない
- リファクタ禁止

## 2. AI会社の目的
完成した成果物を大量生産し、品質が毎回向上していくAI会社を作る。

回答を返すことが目的ではない。

成果物例
- Instagram10枚スライド + キャプション + CTA + ハッシュタグ
- 動画台本 + 画像生成プロンプト + 動画プロンプト
- チラシ（コピー / デザイン指示 / 画像プロンプト）
- LP（構成 / コピー / HTML / CTA）
- PDF / 営業資料

途中で止めず、完成品まで導く。

## 3. Workflow（変更禁止）
User
→ Leader
→ Company Brain
→ Knowledge（Injected Knowledge + Leader Execution Guide注入）
→ Workflow
→ AI社員（Writer / Reviewer / Strategy）
→ Reviewer
→ Strategy
→ Leader Final
→ 完成成果物

この順番を崩さない。

## 4. Claude担当
- Writer
- Reviewer
- Strategy

LeaderはOpenAI（変更禁止）。

## 5. 課金・契約禁止
勝手に
- API契約
- 有料サービス
- サブスク
- 課金
は禁止。

画像生成・動画生成・SNS投稿連携は必ずユーザー承認後。

## 6. Git運用
Phase完了時
- dev-check 200/200/200
- Commit（ASCII短文1行のみ / 日本語禁止 / 括弧禁止）
- Tag
- 完了レポート

git pushは禁止（ユーザー確認必須）。

## 7. ブラウザ確認
毎Phase必須
- Workflow Live
- Auto Task
- Leader Final
- Provider表示
- Output Engine
- 完成成果物
- エラー有無

コード確認だけで完了扱いにしない。

## 8. 完了報告フォーマット

Phase完了レポート

修正ファイル：
修正内容：
dev-check：
ブラウザ確認：
既存機能確認：
Git Commit：
Tag：
未完了：
次工程：

## 9. 成果物品質

各担当は回答ではなく成果物品質を追求する。

必要なら他担当へ相談する。

Leaderは統合・改善・品質保証を行う。

Knowledgeを蓄積して品質を毎回向上させる。

## 10. 禁止事項（固定）
- 仕様変更
- リファクタ
- 既存UI削除
- localStorageへ戻す
- 学習データ削除
- 新規API追加（明示的な許可なし）
- DBスキーマ変更
- npm install
- Workflow大変更
- AI社員ルーティング変更
- Provider設定変更
- git push

## 11. Phase開始時

毎回
1. 06HANDOVER_NEXT_CHAT.md確認（次チャットの場合）
2. MASTER.md確認
3. PHASE_PROGRESS.md確認
4. CLAUDE_RULES.md確認
5. PROJECT_STATUS.md確認

理解後に実装開始。

## 12. SNS自動投稿は後回し

現時点では自動投稿を実装しない。

まず投稿直前までの成果物品質を高める：
- 画像生成プロンプト（自動OK）
- 動画生成プロンプト（自動OK）
- 投稿文 / ハッシュタグ / CTA / 構成（自動OK）
- 実際の画像生成（ユーザー承認後）
- 実際の動画生成（ユーザー承認後）
- SNS投稿（ユーザー承認後）

## 13. 確認不要の操作（自動実行OK）

以下は毎回確認不要。自動で実行してよい：
- `curl http://localhost:3000/...` / `fetch('/api/...')` — ローカルGETリクエスト
- `/api/cost` / `/api/claude-cost` / `/api/claude-status` — 料金取得エンドポイント
- `npm run dev-check` — dev-check実行
- ブラウザ更新（Ctrl+Shift+R）の指示
- JSON読み込み（cost-logs.json / claude-cost-logs.json）
- 料金メーター確認（updateCostProviderPanel の呼び出し確認）

以下は必ず確認を取る：
- APIキー変更 / 課金設定変更 / 有料API追加 / 契約変更
- git push / git reset / ファイル削除
- server.js の大幅変更
- Supabase 変更 / DBスキーマ変更

## 14. Claude Code 操作許可ポリシー

本プロジェクトでは、以下の基準でClaude Codeの操作を許可する。

### 通常許可（ユーザー確認不要）

以下は通常の開発作業として毎回確認不要。

・dev-check

・localhost確認

・curl(GET)

・GET API確認

・JSON確認

・ブラウザ更新

・料金メーター確認

・PowerShell読み取り

・git add

・git status

・git commit

・git tag

### 一度だけ許可

以下は読み取り・確認目的の操作であり、安全性を確認したうえで許可する。

・git diff

・git diff --stat

・git log

・.gitignore確認

・launch.json確認

・.claudeフォルダ確認

・ディレクトリ一覧表示

### 絶対ルール（ユーザー承認があるまで実行禁止）

以下はプロジェクトへ重大な影響を与える可能性があるため、ユーザーの明示的な承認があるまで実行してはならない。

・git push

・git reset

・git reset --hard

・git revert

・git clean

・git checkout（変更を戻す場合）

・git switch

・git rebase

・git merge（大規模変更時）

・npm install

・package.json変更

・package-lock.json変更

・.env変更

・環境変数変更

・DBスキーマ変更

・Supabase構造変更

・APIキー変更

・課金が発生する操作

・有料API契約

・外部サービス契約

・画像生成API実行（ユーザー承認後）

・動画生成API実行（ユーザー承認後）

### 補足

このポリシーはENBISOU AI COMPANY専用の運用ルールである。

Claude Codeは可能な限りこのルールを尊重して作業を進めること。

ただし、Claude Code本体の安全機構によって追加確認が必要な場合は、その確認を優先する。

## 15. Knowledge運用ルール

- _knowledgeSaveHistory でセッション内重複を防止
- isKnowledgeDuplicate() で保存前チェック
- fetchKnowledgeForOutputType() → selectRelevantKnowledge()（max5件）
- Workflow開始時に自動取得（失敗してもWorkflowを止めない）
- getInjectedKnowledgeContext() → Leader contextへ追記
- KNOWLEDGE_COMPARE_MODE で効果検証可能

## 16. 最終目標

v1.0では

AI会社全体が自律協業し、

Knowledge → Learning → Memory → 次回Workflow で品質を毎回向上させ、

Instagram / TikTok / X / LP / チラシ / PDF / HTML

まで含めた完成成果物を高品質で納品する。
