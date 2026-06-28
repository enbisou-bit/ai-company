# DOC_UPDATE_PROTOCOL.md

# ENBISOU AI COMPANY - ドキュメント更新運用ルール

更新日: 2026-06-27

---

## 目的

このファイルは、ENBISOU AI COMPANY の開発ドキュメントを
毎チャット・毎Phaseで正しく引き継ぎ、更新し続けるための運用ルールです。

AI会社の開発が長期化しても、設計思想・進捗・ルール・現在地が失われないようにする。

---

# 公式ドキュメント一覧

今後、次チャット開始時には以下のファイルを読み込ませる。

## 必須4ファイル

1. ENBISOU_AI_COMPANY_MASTER.md
   - AI会社の憲法
   - 最終目的
   - 設計思想
   - 成果物エンジン
   - v1.0完成像

2. PHASE_PROGRESS.md
   - Phase進捗
   - 完了済み
   - 未完了
   - 次工程
   - ロードマップ

3. CLAUDE_RULES.md
   - Claude実装ルール
   - 禁止事項
   - 完了報告形式
   - Git / dev-check / ブラウザ確認

4. PROJECT_STATUS.md
   - 今の現在地
   - 今日終わったこと
   - 現在修正中
   - 次にやること

---

# 将来追加・育てるファイル

必要に応じて以下を追加していく。

## AI_MEMBERS.md

AI社員の役割定義。

含める内容：
- Leader
- Writer
- Designer
- SNS
- Video
- LP
- Researcher
- Analyst
- Reviewer
- Strategy
- Secretary
- Sales
- CS
- Branding
- Nurture
- 今後追加する社員

## DB_SCHEMA.md

Supabase / DB構造の管理。

含める内容：
- conversations
- messages
- tasks
- timeline
- knowledge
- memory
- learning
- cost_logs
- provider_logs
- workflow_logs

## API_SPEC.md

API仕様書。

含める内容：
- /api/auto-task
- /api/workflow-progress
- /api/task-history
- /api/workflow-dashboard
- /api/claude-test
- /api/provider
- 今後追加API

## UI_SPEC.md

UI仕様書。

含める内容：
- Mega Menu
- Workflow Live
- Auto Task Panel
- Timeline
- Cost Meter
- Claude API準備画面
- Control Center
- President Dashboard

## DELIVERABLE_ENGINE.md

成果物エンジン仕様書。

含める内容：
- Instagramスライド10枚
- TikTok動画
- YouTube Shorts
- LP
- チラシ
- PDF
- HTML
- 画像生成
- 動画生成
- Canva構成
- Flow/Kling/Runway/Veoプロンプト

---

# 次チャット開始時の指示文

次チャットでは以下を貼る。

```text
このチャットはENBISOU AI COMPANY開発の続きです。

添付した公式ドキュメントをすべて読んで理解してください。

必須：
1. ENBISOU_AI_COMPANY_MASTER.md
2. PHASE_PROGRESS.md
3. CLAUDE_RULES.md
4. PROJECT_STATUS.md
5. DOC_UPDATE_PROTOCOL.md

内容を読んだら、

・現在の進捗
・現在修正中の内容
・次にやるPhase
・絶対ルール
・注意事項

を簡潔にまとめてください。

その後、PROJECT_STATUS.mdの「次に実装すること」から開発を再開してください。

仕様変更は禁止。
既存機能は壊さず、追加のみで実装してください。
AI会社は回答ではなく完成成果物を納品する会社です。
```

---

# チャット終了時の指示文

チャット容量が重くなったら、最後に以下を依頼する。

```text
今回のチャットで進んだ内容をもとに、
最初に読み込ませた公式ドキュメントを更新してください。

対象：
1. ENBISOU_AI_COMPANY_MASTER.md
2. PHASE_PROGRESS.md
3. CLAUDE_RULES.md
4. PROJECT_STATUS.md
5. DOC_UPDATE_PROTOCOL.md
必要なら追加ファイルも提案してください。

更新内容：
・完了したPhase
・修正した内容
・残タスク
・次にやること
・新しく決まった絶対ルール
・成果物品質に関する追加方針
・Claude/OpenAI構成
・Git Tag / Commit
・ブラウザ確認結果

更新後、次チャットへそのまま添付できるMarkdownファイルとして出してください。
```

---

# 更新ルール

## MASTER.md
大きな設計変更・思想・完成像が変わった時に更新。

## PHASE_PROGRESS.md
Phase完了ごとに必ず更新。

## CLAUDE_RULES.md
ルールや禁止事項が変わった時だけ更新。

## PROJECT_STATUS.md
チャット終了時に必ず更新。

## DOC_UPDATE_PROTOCOL.md
ドキュメント運用自体を変えた時だけ更新。

---

# 重要思想

ENBISOU AI COMPANY は「回答AI」ではない。

完成成果物を納品するAI会社である。

ドキュメントも同じで、
ただのメモではなく、開発を継続するための公式仕様書として扱う。

今後すべてのチャットは、この公式ドキュメント群を起点に開発を再開する。
