# DECISIONS.md

# ENBISOU AI COMPANY - 設計判断・意思決定ログ

更新日: 2026-06-28（Phase43完了・Phase44開始前）

## 目的
このファイルは「何を作ったか」ではなく、
「なぜその設計にしたのか」を記録する。

新しいチャットでは、このファイルを読むことで
設計思想を維持したまま開発を継続する。

---

# Decision 001
## AI会社の目的
AI会社はチャットAIではない。
回答ではなく、完成成果物を納品する会社を作る。

成果物例
- Instagramスライド
- 投稿文
- 画像生成
- 動画生成
- チラシ
- LP
- HTML
- PDF

---

# Decision 002
## Workflow固定

User
↓
Leader
↓
Company Brain
↓
Knowledge
↓
Workflow
↓
AI社員
↓
Reviewer
↓
Strategy
↓
Leader Final
↓
完成成果物

この順序は原則変更しない。

---

# Decision 003
## モデル役割

Leader : OpenAI

Writer : Claude

Reviewer : Claude

Strategy : Claude

必要に応じて将来変更可能だが、
担当ごとの役割分担を維持する。

---

# Decision 004
## 成果物品質優先

速度より品質。

必要ならAI社員同士で相談し、
完成度を高めてから納品する。

---

# Decision 005
## 絶対ルール

・既存機能は壊さない
・削除禁止
・追加のみ
・課金はユーザー許可制
・学習データ削除禁止
・Supabaseを維持

---

# Decision 006
## Phase完了条件

1. dev-check
2. ブラウザ実機確認
3. Git Commit
4. Git Tag
5. 完了レポート

すべて終わって初めて完了。

---

# Decision 007
## ドキュメント運用

毎チャット開始時

1. ENBISOU_AI_COMPANY_MASTER.md
2. PHASE_PROGRESS.md
3. CLAUDE_RULES.md
4. PROJECT_STATUS.md
5. DOC_UPDATE_PROTOCOL.md
6. DECISIONS.md

を読んでから開発を開始する。

チャット終了時は
これらのファイルを最新版へ更新する。

---

# Decision 008
## 今後追加する判断

このファイルには今後も、

- なぜその仕様にしたのか
- 却下した案
- 採用した理由
- 大きな設計変更

を追記し続ける。

このファイルはAI会社の「設計思想の履歴」である。

---

# Decision 009
## Phase44以降は成果物能力を最優先とする

Phase43でWorkflow Live（リアルタイム実行状況の見える化）が完成版に達した。

Phase44以降は、UIの見える化よりも「成果物を完成させる能力」を優先する。

### 理由

ENBISOU AI COMPANYの目的は「チャット回答を返すこと」ではなく、
「完成成果物を納品すること」である（Decision 001）。

Workflow LiveによってAI社員の実行状況がリアルタイムで確認できるようになった。
次のステップは、そのWorkflowが実際に使える成果物を出力することである。

### 優先順位の変更

Phase43まで: UIの見える化・Workflow Live整備を優先
Phase44以降: 成果物エンジン（Instagram/チラシ/LP/動画/PDF/HTML）を優先

### 対象成果物

- Instagramカルーセル（スライド10枚・キャプション・CTA・ハッシュタグ）
- チラシ（コピー・デザイン指示・画像生成プロンプト）
- LP（構成・コピー・HTML）
- 動画（企画・台本・画像プロンプト・動画プロンプト）
- PDF生成
- HTML生成

追記日: 2026-06-28（Phase43完了直後）
