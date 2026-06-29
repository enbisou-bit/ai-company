# DECISIONS.md

# ENBISOU AI COMPANY - 設計判断・意思決定ログ

更新日: 2026-06-29（Project Rule v1.1 追加）

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
- Instagramスライド / 投稿文 / 画像生成
- 動画生成 / チラシ / LP / HTML / PDF

---

# Decision 002
## Workflow固定

User → Leader → Company Brain → Knowledge → Workflow
→ AI社員 → Reviewer → Strategy → Leader Final → 完成成果物

この順序は原則変更しない。

---

# Decision 003
## モデル役割

Leader : OpenAI
Writer : Claude
Reviewer : Claude
Strategy : Claude

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
・削除禁止 / 追加のみ
・課金はユーザー許可制
・学習データ削除禁止
・Supabaseを維持
・git push禁止
・npm install禁止
・DBスキーマ変更禁止

---

# Decision 006
## Phase完了条件

1. dev-check 200/200/200
2. ブラウザ実機確認
3. Git Commit（ASCII短文）
4. Git Tag
5. 完了レポート

すべて終わって初めて完了。

---

# Decision 007
## ドキュメント運用

毎チャット開始時
1. 06HANDOVER_NEXT_CHAT.md
2. ENBISOU_AI_COMPANY_MASTER.md
3. PHASE_PROGRESS.md
4. CLAUDE_RULES.md
5. PROJECT_STATUS.md
6. DOC_UPDATE_PROTOCOL.md
7. DECISIONS.md

を読んでから開発を開始する。

チャット終了時はこれらのファイルを最新版へ更新する。

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

対象成果物
- Instagramカルーセル（スライド10枚・キャプション・CTA・ハッシュタグ）
- チラシ（コピー・デザイン指示・画像生成プロンプト）
- LP（構成・コピー・HTML）
- 動画（企画・台本・画像プロンプト・動画プロンプト）
- PDF生成 / HTML生成

追記日: 2026-06-28（Phase43完了直後）

---

# Decision 010
## Knowledge注入はLeader contextへ安全に追記する

Phase45-7において、Injected KnowledgeをLeaderへ渡す方式を決定。

採用方式：
- `getRoutedKnowledgeContext('leader') + getInjectedKnowledgeContext()` の連結
- 既存Routing Knowledge（Phase25実装）を置換しない
- Injected Knowledgeを後ろに追記するだけ

理由：
- 既存Routing Engine（routeKnowledgeForMember）との競合を避ける
- Injected Knowledgeはあくまで補足情報
- 既存Knowledge Engineの優先順位を変えない

追記日: 2026-06-28（Phase45-7完了）

---

# Decision 011
## SNS自動投稿は後回しにする

Phase46以降の方針として決定。

理由：
- 自動投稿は課金・外部API連携が必要で承認制にする必要がある
- まず投稿直前までの成果物品質を高めることが優先
- 品質の高い画像プロンプト・動画プロンプト・投稿文・CTA・構成が先決

採用方針：
- 画像生成プロンプト作成：自動OK
- 実際の画像生成：ユーザー承認後
- 動画生成：ユーザー承認後
- SNS投稿：ユーザー承認後（現時点では実装しない）

追記日: 2026-06-29（Phase46-3完了）

---

# Decision 012
## Knowledge Compare Modeで品質効果を測定する

Phase46-3において、Knowledge注入の効果を比較できる3モードを実装。

with_knowledge: Injected Knowledge + Leader Execution Guide → Leaderへ渡す（通常）
without_knowledge: Knowledge取得・表示はするがLeaderへ渡さない（比較用）
guide_only: Leader Execution Guideのみ渡す（中間案）

理由：
- Knowledge注入が実際に成果物品質に寄与しているか検証が必要
- 同一依頼でモード切替して比較することで効果を定量評価できる
- 将来的にベストモードを自動選択する基盤になる

追記日: 2026-06-29（Phase46-3完了）

---

# Decision 013
## Claude Code 実装指示書の最終出力形式を正式仕様とする

Phase46-5前のドキュメント整備として、Claude Code へ渡す実装指示書の出力形式を正式仕様化。

採用方針：
- 最終実装指示書は通常テキスト形式で出力する（Markdownコードブロックで囲まない）
- ヘッダー「これをそのままClaude Codeへ貼ってください。」を必ず付ける
- 出力順序：① 改善案（必要時のみ）→ ② 最終実装指示書（1つだけ）
- 指示書構成順序を固定：目的→絶対ルール→実装内容→詳細仕様→ブラウザ確認→完了条件→Git→完了レポート
- コピーボタン1回でそのままClaude Codeへ貼り付けられる状態を維持する

理由：
- 毎Phase同じフォーマット・同じ品質で指示書を出力するため
- コピー性を高め、ユーザーの貼り付け操作を1回に統一するため
- 改善案と最終指示書の混在による混乱を防ぐため

参照: docs/08CLAUDE_PROMPT_TEMPLATE.md v1.1

追記日: 2026-06-29（Project Rule v1.1）

---

# Decision 014
## Compare Log を分析エンジン（Compare Intelligence）へ発展させる

Phase46-5において、単なる記録だった _knowledgeCompareLog[] を分析エンジンへ発展させた。

採用方針：
- analyzeCompareIntelligence() で mode別/outputType別/InjectionImpact を集計
- _lastCompareIntelligence に結果を保存（再利用可能）
- buildCompareIntelligenceHtml() で Output Engine に分析パネルを表示
- Export（markdown / json）に Compare Intelligence を自動反映
- _compareIntelligenceSummary は作らない（変数名を _lastCompareIntelligence に統一）

理由：
- Compare Log が蓄積されても読み解けなければ改善に繋がらない
- Winner Mode / InjectionImpact / recommendations を自動生成することで、AI会社が自己診断できる
- 将来的に recommendations を Workflow に自動反映する基盤になる

追記日: 2026-06-29（Phase46-5完了）

---

# Decision 015
## Compare Intelligence の分析結果を Recommendation Engine として具体的な改善提案へ変換する

Phase46-6において、Compare Intelligence（Phase46-5）の分析結果を「次に何をすべきか」の具体的改善提案へ変換するエンジンを追加した。

採用方針：
- buildCompareRecommendations() で priorityItems / outputTypeRecommendations / knowledgeRecommendations / reviewerHints / learningHints / cautionItems を生成
- getCompareRecommendationPriority() で high / medium / low を判定（winnerMode / injectionImpact / outputTypeスコアを基準に）
- Knowledge / Learning / Memory は自動変更しない（表示とExportのみ）
- _lastCompareRecommendations に結果を保持（再利用可能）

理由：
- Compare Intelligence の分析結果は「何が起きているか」を示すが、「次に何をすべきか」は別のレイヤーで整理が必要
- AI会社が自己診断だけでなく、改善方向を自動提案できる構造にする
- Priority chip（HIGH/MED/LOW）で優先度を明確化し、実案件改善のアクションを整理する

追記日: 2026-06-29（Phase46-6完了）

