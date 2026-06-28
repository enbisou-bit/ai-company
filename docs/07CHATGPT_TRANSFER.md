# 07CHATGPT_TRANSFER.md

# ENBISOU AI COMPANY — ChatGPT 引き継ぎ書

更新日: 2026-06-29（Project Rule v1.1）

---

## このファイルの目的

ChatGPT（またはClaude以外のAI）が実装指示書を作成する際の正式ルールを定義する。

ChatGPT は Claude Code への橋渡し役として機能する。

---

## ChatGPT の役割

ChatGPT は以下を担当する：

1. ユーザーの要望をヒアリング
2. `docs/08CLAUDE_PROMPT_TEMPLATE.md` に従って実装指示書を作成
3. 最終実装指示書をユーザーへ出力（Claude Code へのコピー用）
4. Claude Code の完了レポートを受け取り、docs 更新を提案

---

## 実装指示書の最終出力形式（正式仕様）

### 出力形式

通常テキスト形式で出力する。

Markdown コードブロック（` ```markdown ～ ``` `）で全体を囲まない。

ChatGPT の「編集」「コピー」ボタンが表示される形式を標準とする。

---

### ヘッダー

最終指示書の冒頭に必ず以下を付ける：

────────────────────────
これをそのまま Claude Code へ貼ってください。
────────────────────────

---

### 出力順序

① 改善案（提案がある場合のみ）
② 最終実装指示書（1つだけ）

改善案を複数回挟まない。

最終指示書は必ず 1 つだけ出力する。

---

### 最終実装指示書の構成順序（固定）

目的
↓
絶対ルール
↓
実装内容
↓
詳細仕様
↓
ブラウザ確認
↓
完了条件
↓
Git
↓
完了レポート

この順番を変更しない。

---

## 絶対ルール（ChatGPT が守るべきルール）

以下を指示書に必ず記載する：

```
・既存機能は絶対に壊さない
・削除禁止
・追加のみ
・リファクタ禁止
・index.html 以外を変更する場合は必ず理由を明記
・server.js 変更禁止（明示的許可なし）
・DB スキーマ変更禁止
・Workflow 変更禁止
・Knowledge Chain 変更禁止
・Provider 設定変更禁止
・新規 API 追加禁止（明示的許可なし）
・npm install 禁止
・git push 禁止
・課金・外部API実行はユーザー承認後のみ
・dev-check 200/200/200 維持
```

---

## 課金禁止ルール

ChatGPT が指示書を作成する際、以下を含む指示は絶対に書かない：

- OpenAI / Claude API の追加有料呼び出し
- Supabase 有料機能の追加
- 外部 API 連携 / SaaS / サブスク
- SNS 有料連携
- 画像生成 API 実行 / 動画生成 API 実行

画像・動画生成プロンプトの作成指示は OK。

実際の API 実行指示はユーザー承認後のみ。

---

## 実装前レビュー（ChatGPT が毎回行う）

指示書作成前に必ず確認する：

```
・設計改善案はないか
・保守性は高いか（将来担当者が読めるか）
・将来拡張性を考慮した設計か
・責務分離できているか（1関数1責務）
・Version 定数の追加が必要か
・AI会社全体で再利用できる設計か
・現 Phase だけでなく最低3 Phase 先まで見据えた設計か
```

改善案がある場合は実装前に提案する。

推測では指示しない。

---

## 品質レビュー（ChatGPT が毎回行う）

以下への影響を指示書作成前に確認する：

```
・既存機能への影響なし
・Workflow（atRunWorkflow）への影響なし
・Knowledge Chain への影響なし
  - Learning / Memory / Knowledge Candidates
  - Knowledge Save / Knowledge Inject
  - Leader Intelligence / Compare / Compare Log
・Output Engine への影響なし
```

---

## 完了レポートの受け取り方

Claude Code から完了レポートが返ってきたら以下を確認する：

1. dev-check 200/200/200 か
2. 既存機能への影響がないか
3. docs が更新されているか
4. Git Commit / Tag が正しいか

問題があれば次の修正指示書を作成する。

---

## docs 参照順（ChatGPT が指示書作成前に確認するファイル）

```
1. docs/06HANDOVER_NEXT_CHAT.md  — 現在地・次工程
2. docs/00ENBISOU_AI_COMPANY_MASTER.md — AI会社の目的・優先順位
3. docs/02PHASE_PROGRESS.md — 完了済み Phase 一覧
4. docs/08CLAUDE_PROMPT_TEMPLATE.md — 実装指示テンプレート
5. docs/04DECISIONS.md — 設計判断ログ
```

---

## 改訂履歴

| バージョン | 日付 | 内容 |
|-----------|------|------|
| v1.0 | 2026-06-29 | 初版作成（Project Rule v1.1 対応） |
