# 08CLAUDE_PROMPT_TEMPLATE.md

# ENBISOU AI COMPANY — Claude Code 実装指示テンプレート

更新日: 2026-06-29（v1.00-project-rule-template）

---

## このファイルの目的

Claude Code へ渡す実装指示書の正式テンプレートを定義する。

今後すべての Phase 実装指示はこのテンプレートを基準として作成する。

テンプレートの品質が実装品質を決める。

---

## 絶対ルール（全 Phase 共通 / 変更禁止）

```
・既存機能は絶対に壊さない
・削除禁止
・追加のみ
・リファクタ禁止
・index.html 以外を変更する場合は必ず理由を明記する
・server.js 変更禁止（明示的許可なし）
・DB スキーマ変更禁止
・Workflow 変更禁止
・Knowledge Chain 変更禁止
・Provider 設定変更禁止（Leader=OpenAI / Writer・Reviewer・Strategy=Claude）
・新規 API 追加禁止（明示的許可なし）
・npm install 禁止
・git push 禁止（ユーザー確認必須）
・Render 設定変更禁止
・GitHub 設定変更禁止
・環境変数変更禁止
```

---

## 課金禁止ルール（全 Phase 共通）

以下は必ずユーザー承認後のみ実行する：

- OpenAI API 追加呼び出し
- Claude API 追加呼び出し
- Supabase 有料機能
- 外部 API 連携
- SaaS / サブスクリプション
- SNS 有料連携
- 画像生成 API 実行
- 動画生成 API 実行

画像・動画生成プロンプトの作成は自動 OK。

実際の API 実行はユーザー承認後のみ。

---

## 実装指示書テンプレート

以下の順番で作成する。順番を変更しない。

---

### 1. 目的

このPhaseで何を達成するか。

```
目的：
[1〜3行で簡潔に記述]
```

---

### 2. 実装前レビュー

実装前に必ず確認すること。

```
確認項目：
・設計改善案はないか
・保守性は高いか（将来担当者が読めるか）
・将来拡張性を考慮した設計か
・責務分離できているか（1関数1責務）
・Version 定数の追加が必要か
・AI会社全体で再利用できる設計か
・現 Phase だけでなく最低3 Phase 先まで見据えた設計か

改善案がある場合は実装前に提案する。
推測では実装しない。
```

---

### 3. 品質レビュー

以下への影響を必ず確認してから実装する。

```
・既存機能への影響なし
・Workflow（atRunWorkflow）への影響なし
・Knowledge Chain への影響なし
  - Learning（extractLearningItems）
  - Memory（createCompanyMemoryCandidates）
  - Knowledge Candidates（createKnowledgeCandidatesFromMemory）
  - Knowledge Save（saveApprovedKnowledgeCandidates）
  - Knowledge Inject（fetchKnowledgeForOutputType / selectRelevantKnowledge）
  - Leader Intelligence（buildLeaderExecutionGuide）
  - Compare（switchKnowledgeCompareMode / getInjectedKnowledgeContext）
  - Compare Log（recordKnowledgeCompareEntry）
・Output Engine（buildOutputDraftFromLeaderFinal / renderOutputEnginePanel）への影響なし
```

---

### 4. 安全レビュー

毎 Phase 必ず確認する。

```
以下に該当する変更は禁止（ユーザー承認なしに実行しない）：
・課金・API 契約・有料サービス
・OpenAI / Claude / Supabase の新規有料呼び出し
・外部 API / SaaS / サブスク連携
・SNS 有料連携
・画像生成 API / 動画生成 API 実行
・GitHub 設定変更
・Render 設定変更
・環境変数変更
・git push
・DB 変更
・npm install
・新規 API エンドポイント追加（明示的許可なし）
```

---

### 5. 実装内容

変更・追加するファイルと関数を列挙する。

```
修正ファイル：
  - index.html（原則これのみ）

追加する関数：
  - 関数名() — 説明
  - 関数名() — 説明

追加するグローバル変数：
  - 変数名 — 型 / 用途

追加する定数：
  - CONSTANT_NAME — 説明

Version 定数（追加が必要な場合）：
  - XXXX_VERSION = 'x.x.x'
```

---

### 6. 詳細仕様

各関数・変数の具体的な仕様を記述する。

```
関数名(引数):
  入力: 型 / 説明
  処理: 箇条書き
  出力: 型 / 説明
  注意: 既存機能との関係・呼び出しタイミング
```

---

### 7. ブラウザ確認

Phase 完了後に確認する項目。

```
必須確認：
・Workflow Live が正常に動くか
・Auto Task が動くか
・Leader Final が完了するか
・Output Engine が表示されるか
・既存機能が壊れていないか
  - ログイン
  - Leader / Auto Task / Workflow / Live Strip / Dashboard

新機能確認：
・[新機能固有の確認項目を記述]
```

---

### 8. 完了条件

```
すべて満たして初めて完了とする：
□ dev-check 200/200/200
□ ブラウザ実機確認
□ 既存機能が壊れていない
□ 新機能が動作する
□ Git Commit（ASCII 短文 1 行 / 日本語・括弧禁止）
□ Git Tag
□ docs 更新
□ 完了レポート作成
```

---

### 9. Git

```
git add index.html
git commit -m "PhaseXX-Y [short description]"
git tag vX.XX-phaseXX-Y
```

- コミットメッセージは ASCII 短文 1 行のみ
- 日本語禁止 / 括弧禁止 / 改行禁止
- git push 禁止（ユーザー確認必須）

---

### 10. 完了レポート

毎回必ず以下の形式で報告する。

```
Phase完了レポート

■ 修正ファイル：
■ 追加した関数一覧：
■ 追加したグローバル変数：
■ 追加した定数：
■ 追加した Version：
■ ブラウザ確認：
■ dev-check：
■ 既存機能確認：
■ 更新した docs：
■ Git Commit：
■ Git Tag：
■ 次工程候補：
```

---

## docs 更新ルール

毎 Phase 終了時に以下を確認する。

```
確認対象：
・docs/00ENBISOU_AI_COMPANY_MASTER.md
・docs/01PROJECT_STATUS.md
・docs/02PHASE_PROGRESS.md
・docs/03CLAUDE_RULES.md
・docs/04DECISIONS.md
・docs/06HANDOVER_NEXT_CHAT.md
・docs/07CHATGPT_TRANSFER.md（存在する場合）
・docs/08CLAUDE_PROMPT_TEMPLATE.md（本ファイル）

更新基準：
・バージョン / フェーズ番号を更新する
・完了済みリストを更新する
・次工程候補を更新する
・新しい関数・定数を重要機能リストへ追記する
・更新不要なら「更新不要 / 理由」を完了レポートへ記載する
```

---

## テンプレート改善ルール

このテンプレート自体もプロジェクトの一部とする。

各 Phase 終了時、より良い指示書になる改善案があれば `08CLAUDE_PROMPT_TEMPLATE.md` を更新する。

更新が不要な場合はその理由を完了レポートへ記載する。

---

## 実装指示書サンプル

以下はテンプレートを使った指示書の記述例。

```
# PhaseXX-Y 実装指示

## 目的
_knowledgeCompareLog を活用して、Reviewer の評価精度を向上させる。

## 実装内容
修正ファイル: index.html

追加する関数:
- analyzeCompareLogTrends() — Compare Log から傾向を分析
- buildTrendSummaryHtml()  — 傾向サマリーを Output Engine に表示

追加するグローバル変数:
- _compareTrendSummary — Object / 傾向分析結果

Version:
- COMPARE_TREND_VERSION = '1.0.0'

## 詳細仕様
analyzeCompareLogTrends():
  入力: _knowledgeCompareLog[]
  処理: モード別スコア / 改善傾向 / Injection効果を集計
  出力: { byMode, trend, improvementRate }
  注意: _knowledgeCompareLog が空の場合は null を返す

## 完了条件
□ dev-check 200/200/200
□ Output Engine に傾向サマリーが表示される
□ 既存機能が壊れていない
□ Git Commit / Tag
```

---

## 改訂履歴

| バージョン | 日付 | 内容 |
|-----------|------|------|
| v1.0 | 2026-06-29 | 初版作成（Phase46-5前のドキュメント整備） |
