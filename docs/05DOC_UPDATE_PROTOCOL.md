# DOC_UPDATE_PROTOCOL.md

# ENBISOU AI COMPANY - ドキュメント更新運用ルール

更新日: 2026-07-02（Phase48-3.2完了）

---

## 目的

このファイルは、ENBISOU AI COMPANY の開発ドキュメントを
毎チャット・毎Phaseで正しく引き継ぎ、更新し続けるための運用ルールです。

AI会社の開発が長期化しても、設計思想・進捗・ルール・現在地が失われないようにする。

---

# 公式ドキュメント一覧

## 必須ファイル（次チャット開始時に全て読む）

1. **06HANDOVER_NEXT_CHAT.md**（新設）
   - 次チャットへの引き継ぎ情報
   - 現在地 / 絶対ルール / 次にやること / 注意事項
   - このファイルから読み始める

2. **00ENBISOU_AI_COMPANY_MASTER.md**
   - AI会社の憲法
   - 最終目的 / 設計思想 / 優先順位 / v1.0完成像

3. **02PHASE_PROGRESS.md**
   - Phase進捗 / 完了済み / 未完了 / 次工程

4. **03CLAUDE_RULES.md**
   - Claude実装ルール / 禁止事項 / 完了報告形式 / Knowledge運用 / Output品質

5. **01PROJECT_STATUS.md**
   - 今の現在地 / 完了済み機能 / 次にやること

6. **05DOC_UPDATE_PROTOCOL.md**（このファイル）

7. **04DECISIONS.md**
   - なぜその設計にしたかの記録

8. **07CHATGPT_TRANSFER.md**
   - ChatGPT → Claude Code 引き継ぎルール / 出力形式仕様

9. **08CLAUDE_PROMPT_TEMPLATE.md**
   - Claude Code 実装指示テンプレート正式仕様

10. **04ROADMAP.md**（Phase48-3.1で正式追加）
    - v1.0残フェーズ（Phase48-4〜54） / Version 2.0 / 将来的な完成イメージ
    - ※ファイル名の先頭番号は04DECISIONS.mdと重複するが、意図的な命名のためリネームしない

---

# 次チャット開始時の指示文

次チャットでは以下を貼る。

```text
このチャットはENBISOU AI COMPANY開発の続きです。

まず docs/06HANDOVER_NEXT_CHAT.md を読んでください。
その後、以下の公式ドキュメントもすべて読んで理解してください。

1. docs/06HANDOVER_NEXT_CHAT.md
2. docs/00ENBISOU_AI_COMPANY_MASTER.md
3. docs/02PHASE_PROGRESS.md
4. docs/03CLAUDE_RULES.md
5. docs/01PROJECT_STATUS.md
6. docs/04ROADMAP.md（v1.0残フェーズ / Version 2.0）

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
AI会社は完成成果物を大量生産し、品質を毎回向上させる会社です。
```

---

# チャット終了時の指示文

チャット容量が重くなったら、最後に以下を依頼する。

```text
今回のチャットで進んだ内容をもとに、
最初に読み込ませた公式ドキュメントを更新してください。

対象：
1. docs/00ENBISOU_AI_COMPANY_MASTER.md
2. docs/01PROJECT_STATUS.md
3. docs/02PHASE_PROGRESS.md
4. docs/03CLAUDE_RULES.md
5. docs/04DECISIONS.md
6. docs/05DOC_UPDATE_PROTOCOL.md
7. docs/06HANDOVER_NEXT_CHAT.md（更新または作成）
8. docs/07CHATGPT_TRANSFER.md
9. docs/08CLAUDE_PROMPT_TEMPLATE.md
10. docs/04ROADMAP.md

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

更新後、dev-check・Git Commit・Tagまで完了させてください。
```

---

# 更新ルール

## MASTER.md
大きな設計変更・思想・完成像・優先順位が変わった時に更新。

## PHASE_PROGRESS.md
Phase完了ごとに必ず更新。

## CLAUDE_RULES.md
ルールや禁止事項が変わった時に更新。

## PROJECT_STATUS.md
チャット終了時に必ず更新。

## DECISIONS.md
大きな設計判断・採用理由・却下案があった時に追記。

## DOC_UPDATE_PROTOCOL.md
ドキュメント運用自体を変えた時だけ更新。

## 06HANDOVER_NEXT_CHAT.md
チャット終了時に必ず最新版に更新する。
次チャットが安全に始められる状態にする。

## 04ROADMAP.md
Phase完了ごと、またはRoadmap自体（v1.0残フェーズ / Version 2.0）に変更があった時に更新。

## Phase終了時の同期ルール（Phase48-3.2追加）

Phase終了時は以下を必ず同期する：
- PROJECT_STATUS（01PROJECT_STATUS.md）
- PHASE_PROGRESS（02PHASE_PROGRESS.md）
- ROADMAP（04ROADMAP.md）
- HANDOVER（06HANDOVER_NEXT_CHAT.md）

さらに、以下も同期対象であることを明記する：
- MASTER（00ENBISOU_AI_COMPANY_MASTER.md）— 大きな設計変更・優先順位変更時
- CLAUDE_RULES（03CLAUDE_RULES.md）— ルール変更時
- DECISIONS（04DECISIONS.md）— 大きな設計判断があった時

---

# 重要思想

ENBISOU AI COMPANY は「回答AI」ではない。

完成成果物を大量生産し、品質が毎回向上していくAI会社である。

ドキュメントも同じで、
ただのメモではなく、開発を継続するための公式仕様書として扱う。

今後すべてのチャットは、この公式ドキュメント群を起点に開発を再開する。
