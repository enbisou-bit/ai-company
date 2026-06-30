# PROJECT_STATUS.md

# ENBISOU AI COMPANY - 現在の開発状況

更新日: 2026-07-01（Phase46-8完了）

---

## 現在地

- 現在フェーズ: **Phase46-8 完了**
- 開発状況: Phase46-8（Compare Intelligence v2）完了・dev-check 200/200/200
- バージョン: **v1.00-phase46-8**

---

## 完了済み

### AI基盤
- OpenAI 接続
- Claude 接続
- Supabase 接続
- ログイン機能
- 会話履歴保存
- AI社員基盤（15名）

### Workflow
- Company Brain
- Knowledge Engine
- Workflow Live（完成版）
- Auto Task
- Leader Final
- Timeline
- Provider表示

### Claude担当
- Writer / Reviewer / Strategy

### OpenAI担当
- Leader

### Output Engine（Phase44）
- 13種 OUTPUT_TYPES 定義
- Leader による成果物タイプ自動判定
- 担当別フィールド割当
- Package表示（Instagram / Flyer / LP / Document / HTML / Generic）
- Copy / Export UI（markdown / json / html / text）

### Learning Engine（Phase45-2）
- OUTPUT_LEARNING_VERSION 1.0.0
- extractLearningItems() — 品質評価から学習項目生成
- 7カテゴリ分類 / Output Engine表示 / Export反映

### Company Memory（Phase45-3〜4）
- COMPANY_MEMORY_VERSION 1.0.0
- createCompanyMemoryCandidates() — Learning → Memory変換
- _companyMemoryBuffer（max50件）
- Knowledge Candidates 生成 / 承認UI（承認/保留/却下）

### Knowledge Save（Phase45-6C〜6D）
- saveApprovedKnowledgeCandidates() — /api/knowledge-library へPOST
- 重複防止（fingerprint照合 / _knowledgeSaveHistory max50件）
- Save Summary / Skipped Duplicates / Save History表示

### Knowledge Inject（Phase45-7）
- fetchKnowledgeForOutputType() — /api/knowledge-library GET
- selectRelevantKnowledge() — スコアリングで最大5件選定
- Workflow開始時に自動取得 / 失敗時はWorkflow継続
- Leader contextへ追記（getRoutedKnowledgeContext + getInjectedKnowledgeContext）

### Leader Intelligence（Phase46-2）
- buildLeaderExecutionGuide() — cta/structure/brand/avoid/prioritiesに分類
- Leader Execution Guide → Leader contextへ追記
- Workflow Live / Output Engine / Export に表示

### Knowledge Compare（Phase46-3）
- KNOWLEDGE_COMPARE_MODE（with_knowledge / without_knowledge / guide_only）
- switchKnowledgeCompareMode() — ボタン切替UI
- getInjectedKnowledgeContext() — モード別でLeaderへの注入を制御
- Leader Context Preview に Compare Mode / Injected to Leader 表示
- Debug に Compare Mode 追加 / Export に Knowledge Compare セクション追加

### Compare Log（Phase46-4）
- `_knowledgeCompareLog[]`（max30件）— Workflow完了ごとに自動記録
- `recordKnowledgeCompareEntry(draft)` — mode / score / outputType / injectedCount 記録
- `getCompareSummaryByMode()` — モード別平均スコア集計
- `buildCompareLogHtml()` — Output Engineに棒グラフ＋直近10件一覧
- Export（markdown / json）に自動反映

### Compare Intelligence（Phase46-5）
- `COMPARE_INTELLIGENCE_VERSION = '1.0.0'` / `_lastCompareIntelligence`
- `analyzeCompareIntelligence()` — mode別/outputType別/InjectionImpact集計 + recommendations生成
- `getCompareModeWinner()` / `getOutputTypeCompareInsights()` / `getKnowledgeInjectionImpact()`
- `buildCompareIntelligenceHtml()` — Output Engineに分析パネル（Winner/スコア/Impact/推奨）
- `appendCompareIntelligenceToExportMarkdown/Json()` — Export自動反映

### Compare Recommendation（Phase46-6）
- `COMPARE_RECOMMENDATION_VERSION = '1.0.0'` / `_lastCompareRecommendations`
- `buildCompareRecommendations(summary)` — priorityItems / outputTypeRecommendations / knowledgeRecommendations / reviewerHints / learningHints / cautionItems 生成
- `getCompareRecommendationPriority(item)` — high / medium / low 判定
- `buildCompareRecommendationHtml()` — Output Engine に改善提案パネル表示（HIGH/MED/LOW chip付き）
- `appendCompareRecommendationToExportMarkdown/Json()` — Export自動反映

### Compare Quality Integration Check（Phase46-7）
- `COMPARE_INTEGRATION_CHECK_VERSION = '1.0.0'` / `_lastCompareIntegrationCheck`
- `buildCompareIntegrationCheck()` — Log/Intelligence/Recommendation 統合チェック・checklist/nextTestActions/cautionItems生成
- `getCompareIntegrationStatus(check)` — ready/partial/insufficient 判定
- `buildCompareIntegrationCheckHtml()` — Output Engine に Integration Check パネル表示
- `appendCompareIntegrationCheckToExportMarkdown/Json()` — Export自動反映

### Compare Intelligence v2（Phase46-8）
- `COMPARE_IMPROVEMENT_VERSION = '2.0.0'`
- `buildCompareFailureAnalysis()` — Hook/CTA/Knowledge/Structure/Images/OutputType/Length 失敗率分析
- `buildImprovementScores()` — 5カテゴリ 0〜100点スコア（Knowledge注入効果・Guide有無反映）
- `buildCompareLearning()` — SUCCESS/FAIL/QUALITY/IMPROVEMENT 4パターン自動分類
- `buildLeaderImprovementSummary()` — 「今回改善すべきポイント」自動生成
- `buildImprovementScoreHtml()` / `buildCompareFailureAnalysisHtml()` / `buildCompareLearningHtml()` / `buildLeaderImprovementSummaryHtml()` — Output Engine パネル表示
- `appendImprovementToExportMarkdown/Json()` — Export自動反映

---

## ブラウザ確認済み

✅ Workflow Live が送信直後に開く
✅ Company Brain 実行
✅ Writer → Claude
✅ Reviewer → Claude
✅ Strategy → Claude
✅ Leader Final 完了
✅ Auto Task 完了
✅ Output Engine 成果物表示
✅ Knowledge Save / Guard / Inject

---

## 次に実装すること

**Phase46-8: 実案件品質改善**

Compare Integration Check の結果を活用し、実案件ベースで成果物品質を継続改善する。

候補：
- Quality Score判定精度向上
- Learning精度向上
- Instagram / TikTok / LP など特定タイプ品質強化
- Compare Recommendation HIGH 優先項目の実装対応

---

## 開発ルール

毎Phase終了時は必ず
- dev-check 200/200/200
- ブラウザ実機確認
- Git Commit
- Git Tag
- 完了レポート

を実施する。

---

## 成果物方針（最重要）

AI会社は回答を返すことが目的ではない。

**完成した成果物を大量生産し、品質が毎回向上していく**ことが目的。

SNS自動投稿は後回し。まず投稿直前までの成果物品質を最高水準に引き上げる。

---

## 次チャット開始手順

1. docs/06HANDOVER_NEXT_CHAT.md を読む
2. MASTER.md を読む
3. PHASE_PROGRESS.md を読む
4. CLAUDE_RULES.md を読む
5. PROJECT_STATUS.md を読む
6. 現在地を要約
7. Phase46-7から開発再開
