# PHASE_PROGRESS.md

> ENBISOU AI COMPANY 開発進捗管理書
> 更新日: 2026-07-02（Phase47-2B完了）

## 現在地
- 現在フェーズ: **Phase47-2B 完了**
- 現在バージョン: **v1.00-phase47-2B**

---

# Phase1〜Phase35（基盤構築）
## 完了
- OpenAI接続 / Supabase接続 / ログイン / 会話履歴保存
- AI社員基盤 / Workflow基盤 / Timeline基盤 / Task基盤

---

# Phase36〜Phase42（Claude協業 / Workflow完成）
## 完了
- Claude担当追加（Writer / Reviewer / Strategy）
- Leader=OpenAI確立
- Workflow Live / Progress Bar / Timeline / Leader Final
- Auto Task完了 / Provider表示
Git: v0.96相当

---

# Phase43（Workflow Live完成版）
## 完了 — Tag: v0.97

### Phase43-1: Claude API準備画面の表示同期
### Phase43-2: Workflow開始時に全担当カード生成
### Phase43-3: Progress Bar追加（0%→100%）
### Phase43-4: Timeline改善（状態アイコン / 重複防止）
### Phase43-5: Workflow Live再表示・UI磨き込み

---

# Phase44（Output Engine）
## 完了 — Tag: v0.98

### Phase44-1: Output Engine基盤
- OUTPUT_TYPES（13種）/ OUTPUT_STATUS（6種）/ createOutputDraft()
- Git: 6ba1fc5 / Tag: v0.98-phase44-1

### Phase44-2: Leader成果物タイプ自動判定
- detectOutputType() / _lastOutputDetection
- Git: 65bb77e / Tag: v0.98-phase44-2

### Phase44-3: 担当別成果物フィールド割当
- OUTPUT_ROLE_ASSIGNMENTS / assignedRoles
- Git: fce51b1 / Tag: v0.98-phase44-3

### Phase44-4: Output Draft Builder基盤
- buildOutputDraftFromLeaderFinal()
- Git: e52e2d7 / Tag: v0.98-phase44-4

### Phase44-5: Instagram Carousel Package表示
- buildCarouselPackageHtml()
- Git: 95fd298 / Tag: v0.98-phase44-5

### Phase44-6: Package表示の汎用化
- buildFlyerPackageHtml / buildLpPackageHtml 等
- buildOutputPackageHtml() ディスパッチャー
- Git: 4a4496f / Tag: v0.98-phase44-6

### Phase44-7: 成果物コピー/エクスポートUI
- serializeOutputDraft(format) — markdown / json / html / text
- Git: a3987f4 / Tag: v0.98-phase44-7

### Phase44-8: 成果物UI最終確認・Phase44完了判定
- dev-check 200/200/200
- Tag: v0.98-phase44-8 / v0.98

---

# Phase45（Learning / Memory / Knowledge / Save / Inject）
## 完了 — Tag: v0.99

### Phase45-0: Output Schema v1.0固定
- OUTPUT_SCHEMA_VERSION 1.0.0 / normalizeOutputDraft() / validateOutputDraft()
- Git: 120a83a / Tag: v0.98-phase45-0

### Phase45-1: Reviewer Quality Engine v1
- OUTPUT_QUALITY_VERSION 1.0.0 / evaluateOutputQuality()
- QUALITY_METRIC_PRESETS（6タイプ）
- Git: 373bc79 / Tag: v0.98-phase45-1

### Phase45-2: Learning Engine v1
- OUTPUT_LEARNING_VERSION 1.0.0 / extractLearningItems()
- LEARNING_CATEGORIES（7種）
- Git: 8c505ea / Tag: v0.98-phase45-2

### Phase45-3: Company Memory基盤
- COMPANY_MEMORY_VERSION 1.0.0 / createCompanyMemoryCandidates()
- _companyMemoryBuffer（max50）
- Git: bcd5b48 / Tag: v0.98-phase45-3

### Phase45-4: Memory→Knowledge反映準備
- COMPANY_KNOWLEDGE_CANDIDATE_VERSION 1.0.0
- createKnowledgeCandidatesFromMemory()
- _companyKnowledgeCandidateBuffer（max50）
- Git: 1be7cb0 / Tag: v0.98-phase45-4

### Phase45-5: Knowledge承認UI + Recommendation Engine v1
- KNOWLEDGE_RECOMMENDATION（recommended / review / normal）
- calculateKnowledgeRecommendation() — スコアリング
- approveKnowledgeCandidate() — 承認/保留/却下
- Git: 6d38536 / Tag: v0.98-phase45-5

### Phase45-6A: Company Knowledge保存準備/DB設計確認
- COMPANY_KNOWLEDGE_VERSION 1.0.0 / COMPANY_KNOWLEDGE_RECORD_SCHEMA
- Git: 5108a56 / Tag: v0.98-phase45-6A

### Phase45-6B: Supabase保存方法の確認
- 既存 knowledge_library テーブル確認 / A案（既存API使用）を選択
- Git: 61f7e59 / Tag: v0.98-phase45-6B

### Phase45-6C: Knowledge正式保存の最小実装
- saveApprovedKnowledgeCandidates() — /api/knowledge-library へPOST
- _lastKnowledgeSaveResult / 保存結果UI
- Git: 9adaf1e / Tag: v0.98-phase45-6C

### Phase45-6D: Save Guard（重複保存防止）
- _knowledgeSaveHistory（max50） / getKnowledgeFingerprint()
- isKnowledgeDuplicate() / Save Summary / Skipped Duplicates表示
- Git: d0763d4 / Tag: v0.98-phase45-6D

### Phase45-7: Knowledge Inject
- fetchKnowledgeForOutputType() / selectRelevantKnowledge()（max5件）
- _lastInjectedKnowledge / Workflow開始時に自動取得
- Leader contextへ追記（getInjectedKnowledgeContext）
- Git: 4e9f535 / Tag: v0.98-phase45-7

### Phase45-8: Knowledge注入効果確認 / Phase45完了判定
- JSON Export強化（_knowledgeSaveResult / _injectedKnowledge）
- Git: 0cd8c48 / Tag: v0.98-phase45-8 / v0.99

---

# Phase46（Knowledge Verification / Leader Intelligence）
## 進行中

### Phase46-1: Knowledge Injection Preview ✅
- Workflow Liveに Injected Knowledge / Guide Summary 表示強化
- Output Engine: Leader Context Preview / Debug / Source/genre/confidence表示
- _kiLastFetchCount / _kiLastSelectedCount / _kiLastFetchStatus
- Git: c4e63b1 / Tag: v1.00-phase46-1

### Phase46-2: Leader Intelligence Upgrade ✅
- buildLeaderExecutionGuide() — cta/structure/brand/avoid/priorities分類
- getInjectedKnowledgeContext() 拡張 — 【Leader Execution Guide】追加
- buildLeaderExecutionGuideHtml() / Output Engine表示 / Export反映
- Git: dad89fe / Tag: v1.00-phase46-2

### Phase46-3: Knowledge Compare Mode ✅
- KNOWLEDGE_COMPARE_MODE（with_knowledge / without_knowledge / guide_only）
- switchKnowledgeCompareMode() / 3ボタンUI
- getInjectedKnowledgeContext() モード対応
- Leader Context Preview: Compare Mode / Injected to Leader表示
- Export: Knowledge Compare セクション追加
- Git: 42b70aa / Tag: v1.00-phase46-3

### Phase46-4: 実案件テストログ / 品質比較記録 ✅
- `_knowledgeCompareLog[]`（max30件）— Workflow完了ごとに自動記録
- `recordKnowledgeCompareEntry(draft)` — mode / score / outputType / injectedCount を記録
- `getCompareSummaryByMode()` — モード別平均スコア集計
- `buildCompareLogHtml()` — Output Engineに棒グラフ＋直近10件一覧表示
- Export（markdown / json）に比較ログ自動反映
- Git: d7ed771 / Tag: v1.00-phase46-4

### Phase46-5: Compare Intelligence v1 ✅
- `COMPARE_INTELLIGENCE_VERSION = '1.0.0'`
- `analyzeCompareIntelligence()` — mode別/outputType別/InjectionImpact集計 + recommendations生成
- `getCompareModeWinner()` — 平均スコア最高モードを判定
- `getOutputTypeCompareInsights()` — outputType別傾向コメント
- `getKnowledgeInjectionImpact()` — 注入あり/なし差分（positive/negative/neutral/unknown）
- `buildCompareIntelligenceHtml()` — Output Engineに分析パネル表示
- `appendCompareIntelligenceToExportMarkdown/Json()` — Export反映
- Git: 75c0bf4 / Tag: v1.00-phase46-5

### Phase46-6: Compare Recommendation Engine v1 ✅
- `COMPARE_RECOMMENDATION_VERSION = '1.0.0'`
- `buildCompareRecommendations()` — priorityItems / outputTypeRecommendations / knowledgeRecommendations / reviewerHints / learningHints / cautionItems 生成
- `getCompareRecommendationPriority()` — high/medium/low 判定
- `buildCompareRecommendationHtml()` — Output Engine に改善提案パネル表示
- `appendCompareRecommendationToExportMarkdown/Json()` — Export反映
- Git: 7a43619 / Tag: v1.00-phase46-6

### Phase46-7: Compare Quality Integration Check v1 ✅
- `COMPARE_INTEGRATION_CHECK_VERSION = '1.0.0'`
- `buildCompareIntegrationCheck()` — ログ/Intelligence/Recommendation の統合整合性チェック
- `getCompareIntegrationStatus()` — ready/partial/insufficient 判定
- `buildCompareIntegrationCheckHtml()` — Output Engine に Integration Check パネル表示
- `appendCompareIntegrationCheckToExportMarkdown/Json()` — Export反映
- Git: 9b64683 / Tag: v1.00-phase46-7

### Phase46-8: Compare Intelligence v2 ✅
- `COMPARE_IMPROVEMENT_VERSION = '2.0.0'`
- `buildCompareFailureAnalysis()` — Hook/CTA/Knowledge/Structure/Images/OutputType/Length 失敗率分析
- `buildImprovementScores()` — 5カテゴリ 0〜100点スコア（Knowledge注入効果・Guide有無反映）
- `buildCompareLearning()` — SUCCESS/FAIL/QUALITY/IMPROVEMENT 4パターン自動分類
- `buildLeaderImprovementSummary()` — 「今回改善すべきポイント」自動生成
- Output Engine: 📊 Improvement Score / 🔍 Failure Analysis / 🎓 Compare Learning / 💡 Leader Improvement Summary パネル追加
- Export（markdown / json）に Compare Improvement v2 セクション追加
- Git: 48e2e3c / Tag: v1.00-phase46-8

### Phase46-9: 次フェーズ ⬜

---

# Phase47（API料金メーター / コスト最適化）

### Phase47-1: API料金メーター ✅
- `costTracker.js` — 日次/月次/累計 + 日付リセット(todayKey/monthKey) + 旧データ移行
- `claudeCostTracker.js`（新規）— Claude API料金永続化 / claude-cost-logs.json / モデル別集計
- `claudeClient.js` — trackUsage()末尾でaddClaudeUsage()呼び出し（モジュールレベルrequire）
- `server.js` — /api/claude-cost エンドポイント追加
- `index.html` — #cost-panel-body 完全再構成（上部=合計 / Provider別=OpenAI+Claude / 右上ヘッダー=合計）
- `updateCostProviderPanel()` — 3エンドポイント並行取得・合計計算・上部+ヘッダー反映
- Git: Phase47-1 API cost meter / Tag: v1.00-phase47-1

### Phase47-2A: Claude Cost Analysis（分析のみ）✅
- `claudeCostTracker.js` — `CLAUDE_COST_ANALYSIS_VERSION = '1.0.0'` / `getClaudeCostAnalysis()`追加
  - totalRequests / totalInputTokens / totalOutputTokens / totalTokens / totalCost / todayCost / monthCost
  - byModel（モデル別料金・トークン・リクエスト数）
  - byRole（strategy=claude-opus-4-8専用のため実測、writer/reviewerはclaude-sonnet-4-6共有のため`writer_reviewer_combined`として合算・担当別判定なし）
  - topCostModel / topTokenModel / analysisWarnings
- `server.js` — 既存 `/api/claude-cost` に `analysis` フィールドとして追加（新規API追加なし）
- `index.html` — 料金メーターへ「🔍 Claude Cost Analysis」パネル追加（`renderClaudeCostAnalysis()`）
  - 総リクエスト数 / 総トークン数 / 総料金 / モデル別内訳 / 最高額モデル / 最多利用モデル / 担当別利用状況 / 分析上の注意（analysisWarnings）
  - Phase47-2Aは分析のみ・Provider構成変更なし・Claudeモデル変更なし・Phase47-2Bでモデル最適化予定 の注意書き表示
- モデル変更・Provider変更・Compare Intelligenceへの反映は一切なし
- Git: 5a7d2d3 / Tag: v1.00-phase47-2A

### Phase47-2B: モデル最適化 ✅
- `claudeClient.js` — `CLAUDE_MODEL_POLICY_VERSION = '1.0.0'` / `CLAUDE_MODEL_POLICY` / `getClaudeModelForRole(role)` 追加
  - `CLAUDE_HIGHEST_QUALITY_MODEL = 'claude-opus-4-8'`（既存モデル・strategy専用）
  - `CLAUDE_LOWEST_COST_MODEL = 'claude-haiku-4-5'`（既存コード内定義済みモデル・writer/reviewerに適用）
  - `CLAUDE_MODEL_MAP` は `getClaudeModelForRole()` の結果を反映する形に更新（strategy=opus / writer・reviewer=haiku）
  - `CLAUDE_PRICE_PER_1K` に haiku 価格を追加（claudeCostTracker.jsと同一値）
  - `callClaudeAI()` / `generateClaudeReply()` / `testClaudeAgent()` の呼び出し箇所を `getClaudeModelForRole()` 経由に変更
- `server.js` — `workflowAgentCaller()` のmodel表示を`getClaudeModelForRole()`経由に変更 / `/api/claude-cost` に `modelPolicy`（policy・currentModels・providerChanged・leader）を追加
- `index.html` — Claude Cost Analysis内に「⚙️ Claude Model Policy」パネル追加（`renderClaudeModelPolicy()`）
- 実API接続テストで確認: Strategy→claude-opus-4-8 / Writer→claude-haiku-4-5 / Reviewer→claude-haiku-4-5
- Provider構成（Leader=OpenAI / Strategy・Writer・Reviewer=Claude）は一切変更なし
- 既知の限界: `claudeCostTracker.js`のbyRole集計はsonnet固定ロジックのため、Phase47-2B以降のwriter/reviewer(haiku)利用は担当別集計に反映されない（byModelには正しく反映）。次フェーズ以降で対応要検討。
- Git: Phase47-2B claude model optimization / Tag: v1.00-phase47-2B

---

# v1.0まで

☑ Workflow Live完成（Phase43）
☑ Output Engine完成（Phase44）
☑ Learning Engine（Phase45-2）
☑ Company Memory（Phase45-3〜4）
☑ Knowledge Save + Guard（Phase45-6）
☑ Knowledge Inject（Phase45-7）
☑ Leader Intelligence（Phase46-2）
☑ Knowledge Compare（Phase46-3）
☑ 実案件品質比較記録（Phase46-4）
☑ Compare Intelligence v1（Phase46-5）
☑ Compare Recommendation Engine v1（Phase46-6）
☑ Compare Quality Integration Check v1（Phase46-7）
☑ Compare Intelligence v2 — Improvement Score / Failure Analysis / Learning / Summary（Phase46-8）
□ Instagram完成品生成
□ 動画完成品生成
□ チラシ完成品生成
□ LP完成品生成
□ PDF生成
□ HTML生成
□ Company Memory 永続化
☑ API料金メーター（Phase47-1）
☑ Claude Cost Analysis（Phase47-2A・分析のみ）
☑ Claude API コスト最適化（Phase47-2B）
□ v1.0正式版

---

# 最重要思想

AI会社は回答を返すことが目的ではない。

**完成した成果物を大量生産し、品質が毎回向上していく** ことが目的である。

SNS自動投稿は後回し。投稿直前までの成果物品質を最高水準に引き上げることを優先する。

毎Phase終了後は
- dev-check
- ブラウザ確認
- Git Commit
- Tag
- 完了レポート

まで実施して完了とする。
