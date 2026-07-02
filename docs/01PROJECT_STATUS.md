# PROJECT_STATUS.md

# ENBISOU AI COMPANY - 現在の開発状況

更新日: 2026-07-02（Phase47-S v1.00 Stable確定）

---

## 現在地

- 現在フェーズ: **Phase47-S 完了（v1.00 Stable）**
- 開発状況: Claude APIコスト最適化トラック（Phase47-2A〜47-4）最終確認・安定化完了・dev-check 200/200/200・不具合なし
- バージョン: **v1.00-stable**

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

### API料金メーター（Phase47-1）
- `costTracker.js` — OpenAI: 日次(todayAmount) / 月次(monthlyAmount) / 累計(totalAmount) + 日付リセット(todayKey/monthKey)
- `claudeCostTracker.js` — Claude: 日次/月次/累計 + モデル別(sonnet/opus/haiku) + claude-cost-logs.json 永続保存
- `claudeClient.js` — trackUsage() 末尾で addClaudeUsage() を呼び出し（モジュールレベルrequire）
- `server.js` — /api/claude-cost エンドポイント追加（getSummary from claudeCostTracker）
- `index.html` — #cost-panel-body 完全再構成:
  - 上部: 本日合計(cp-today) / 今月合計(cp-month) / 残り / バー = OpenAI+Claude合計
  - Provider別: OpenAI(今日/今月/累計/モデル別) + Claude(今日/今月/累計/トークン/モデル別)
  - 右上ヘッダー💰ボタン = OpenAI+Claude合計
- `updateCostProviderPanel()` — /api/cost + /api/claude-cost + /api/claude-status を並行取得、合計を上部に反映
- 永続ファイル: cost-logs.json（OpenAI） / claude-cost-logs.json（Claude）

### Claude Cost Analysis（Phase47-2A・分析のみ）
- `claudeCostTracker.js` — `CLAUDE_COST_ANALYSIS_VERSION = '1.0.0'` / `getClaudeCostAnalysis()` 追加
  - totalRequests / totalInputTokens / totalOutputTokens / totalTokens / totalCost / todayCost / monthCost
  - byModel（モデル別料金・トークン・リクエスト数）/ topCostModel / topTokenModel / analysisWarnings
  - byRole: strategy=claude-opus-4-8専用のため実測、writer/reviewerはclaude-sonnet-4-6共有のため`writer_reviewer_combined`として合算表示（担当別判定なし）
- `server.js` — 既存 `/api/claude-cost` に `analysis` フィールドを追加（新規API追加なし）
- `index.html` — 料金メーターに「🔍 Claude Cost Analysis」パネル追加（`renderClaudeCostAnalysis()`）
- モデル変更・Provider構成変更・Compare Intelligenceへの反映は一切なし（Phase47-2Bでモデル最適化予定）

### Claudeモデル最適化（Phase47-2B）
- `claudeClient.js` — `CLAUDE_MODEL_POLICY_VERSION = '1.0.0'` / `CLAUDE_MODEL_POLICY` / `getClaudeModelForRole(role)` 追加
  - Strategy = 最高品質モデル（`claude-opus-4-8`・既存モデルのまま変更なし）
  - Writer / Reviewer = 最安モデル（`claude-haiku-4-5`・既存コード内定義済みモデルへ変更）
  - Default Claude Role = 最安モデル（今後追加するClaude担当のデフォルト）
  - `CLAUDE_MODEL_MAP` は `getClaudeModelForRole()` の結果を反映、`CLAUDE_PRICE_PER_1K` にhaiku価格を追加
  - `callClaudeAI()` / `generateClaudeReply()` / `testClaudeAgent()` の呼び出し箇所を更新
- `server.js` — `workflowAgentCaller()` / `/api/claude-cost` に `modelPolicy`（現在の担当別モデル・Provider変更なしフラグ）を追加
- `index.html` — Claude Cost Analysis内に「⚙️ Claude Model Policy」パネル追加
- 実API接続テスト(`/api/claude-test`)で実測確認: strategy→claude-opus-4-8 / writer→claude-haiku-4-5 / reviewer→claude-haiku-4-5
- Provider構成（Leader=OpenAI固定 / Strategy・Writer・Reviewer=Claude固定）は一切変更なし
- 既知の限界: `claudeCostTracker.js`のbyRole集計はsonnet固定ロジックのため、今後のwriter/reviewer(haiku)利用は担当別集計（byRole）には反映されない（byModelには正しく反映される）。Phase47-2C以降で対応要検討。

### Claude Model Quality Compare（Phase47-2C・比較のみ）
- `claudeCostTracker.js` — `CLAUDE_MODEL_QUALITY_COMPARE_VERSION = '1.0.0'` / `buildClaudeModelQualityCompare(currentModels)` 追加
  - `CLAUDE_PREVIOUS_POLICY`（Phase47-2B前の固定構成）: strategy=claude-opus-4-8 / writer・reviewer=claude-sonnet-4-6
  - currentPolicy: `getClaudeModelForRole()`／modelPolicyから取得（strategy=opus / writer・reviewer=haiku）
  - costImpact: 既存 `CLAUDE_PRICE_PER_1K` から算出。Sonnet→Haikuで入力・出力単価とも73.3%減
  - qualityCheckItems（9項目）/ adoptionReadiness（`readyForPhase47_2D: false` 固定）/ warnings
- `server.js` — `/api/claude-cost` に `qualityCompare` を追加
- `index.html` — 「🧪 Claude Model Quality Compare」パネル追加（Before/After/Cost Impact/Quality Check Items/Adoption Readiness/Warnings）
- モデル変更は行っていない（比較フェーズのみ）。Provider構成変更なし
- 正式採用判断はPhase47-2Dへ

### Claude Model Formal Adoption（Phase47-2D・正式採用）
- `claudeCostTracker.js` — `CLAUDE_MODEL_ADOPTION_VERSION = '1.0.0'` / `buildClaudeModelAdoptionStatus(currentModels, qualityCompare)` 追加
  - adoptedPolicy: Strategy=claude-opus-4-8（維持） / Writer・Reviewer=claude-haiku-4-5（正式採用） / Default Claude Role=claude-haiku-4-5 / Leader=OpenAI固定
  - adoptionReason（コスト削減見込み・品質維持方針・Provider不変・Workflow等への非影響を明記）
  - costReductionSummary（Phase47-2Cの costImpact を再利用、入力・出力単価とも73.3%減）
  - qualityDecision: qualityRisk="monitoring_required"（正式採用するが今後の実案件で品質監視を継続）
  - adoptionReadiness更新: `readyForPhase47_2D: true` / `formalAdoptionCompleted: true` / `qualityComparisonPending: false`
- `server.js` — `/api/claude-cost` に `adoptionStatus` を追加
- `index.html` — 「✅ Claude Model Formal Adoption」パネル追加（Status/Adopted Policy/Cost Reduction/Quality Monitoring/Provider Status/Next Actions）
- モデル変更なし（正式採用の記録・表示のみ）。実API接続テストでwriter→claude-haiku-4-5、strategy→claude-opus-4-8のまま変化なしを確認
- Provider構成変更なし
- 次工程: Phase47-3以降でCompare Intelligenceと連携した品質監視を継続

### Claude Quality Monitor（Phase47-3・Compare Intelligence連携）
- `claudeCostTracker.js` — `CLAUDE_QUALITY_MONITOR_VERSION = '1.0.0'` / `buildClaudeQualityMonitor(compareData)` 追加
  - compareDataはCompare Intelligence v2 `buildImprovementScores()`（index.html内メモリのみ・サーバー非永続）と同一形状。スコアは推測せず既存値のみ利用
  - qualityStatus（excellent/good/watch/critical） / monitoringRequired / qualityScore / recommendation（Keep Current Policy / Monitor Quality / Consider Sonnet / Need Manual Review） / issues / categoryScores / summary / warnings
  - データ不足時（サンプル数3未満）は`watch`+`Need Manual Review`で保留
- `server.js` — `/api/claude-cost` に `qualityMonitor` を追加。Compare Intelligenceデータはブラウザ側にしかないため、query パラメータ（overall/sampleSize/各カテゴリスコア）経由で受け取る方式
- `index.html` — `updateCostProviderPanel()`が既存 `buildImprovementScores()` を呼び出しqueryへ付与。「📊 Claude Quality Monitor」パネル追加（Current Quality / Monitoring Status / Overall Score / Recommendation / Detected Issues / Warnings）
- Compare Intelligenceの新しい比較ロジックは追加せず、既存スコアのみ利用
- モデル変更・自動切替は一切なし。Provider構成変更なし
- 次工程: 実案件での品質監視継続・Compare Intelligenceデータ蓄積

### Claude Quality History（Phase47-4・時系列品質監視）
- `claudeCostTracker.js` — `recordClaudeQualityHistory(entry)` / `getClaudeQualityHistory()` / `buildClaudeQualityTrend()` / `buildClaudeQualityWarning()` 追加
  - `_claudeQualityHistory[]`（メモリ内・最大20件・FIFO）: timestamp/workflowId/outputType/provider/model/overallScore/status/recommendation/cost/tokens
  - Quality Trend: Excellent/Good/Watch/Critical件数・平均/最高/最低スコア
  - Quality Warning: 直近5件平均と前5件平均を比較し5%以上低下でWarning（履歴10件未満は保留）。モデル自動変更は行わない
- `server.js` — `/api/claude-cost` に `qualityHistory` / `qualityTrend` / `qualityWarning` を追加（新規APIなし）。実スコア受信時のみ履歴記録
- `index.html` — 「📈 Claude Quality History」パネル追加。Export（Markdown/JSON）へQuality History/Trend/Warningを追加（`appendClaudeQualityHistoryToExportMarkdown/Json()`）
- 動作確認: 高スコア5件→低スコア5件投入でdegradationDetected: true（33.3%低下）を確認、20件キャップ・FIFO動作を確認
- モデル変更・自動切替は一切なし。Provider構成変更なし
- 既知の制限: 履歴はメモリ内のみ（サーバー再起動でリセット・永続化なし）
- 次工程: 実案件データ蓄積・履歴の永続化要否を検討

### Phase47-S: v1.00 Stable確定（最終確認・安定化）
Phase47-2A〜Phase47-4で完成した以下6機能の最終動作確認を実施。新機能追加なし・不具合修正のみ許可（今回は不具合なし・コード変更なし）。

確認済み項目:
- API: `/api/claude-cost` の analysis / modelPolicy / qualityCompare / adoptionStatus / qualityMonitor / qualityHistory / qualityTrend / qualityWarning が全て正常取得
- モデル: Strategy=claude-opus-4-8 / Writer=claude-haiku-4-5 / Reviewer=claude-haiku-4-5 を実API接続テストで実測確認、自動切替機構が存在しないことを確認
- Provider: Leader=OpenAI固定 / Strategy・Writer・Reviewer=Claude固定を維持（変更なし）
- UI表示順: Claude Cost Analysis → Claude Model Policy → Claude Model Quality Compare → Claude Model Formal Adoption → Claude Quality Monitor → Claude Quality History（index.html DOM順で確認）
- Export: Markdown/JSON双方でappendClaudeQualityHistoryToExport系関数の接続を確認
- 重複関数定義なし（Phase47系9関数を確認）
- 既存主要API（/, task-history, workflow-dashboard, cost, claude-status, knowledge-stats）全て200
- dev-check 200/200/200
- 次工程: Phase48（Claude APIコスト最適化トラック以外の新規テーマ、またはv1.0正式版に向けた残タスク: Instagram/動画/チラシ/LP/PDF/HTML完成品生成・Company Memory永続化）

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

### Priority 0: 実案件での品質履歴蓄積・永続化検討（Phase47-5候補）

Phase47-4でClaude Quality History（時系列品質監視）を追加済み（メモリ内・最大20件）。
実案件を蓄積してqualityHistory/qualityTrend/qualityWarningの推移を確認する。
degradationDetectedが継続する場合はSonnetへの切り戻しを検討する（自動切替は行わない）。
履歴がサーバー再起動でリセットされる制限があるため、永続化（ファイル/Supabase）の要否を検討する。
Leader は OpenAI 固定（変更禁止）。

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
7. v1.00-stable確定済み。Phase47-5（品質履歴永続化検討）またはPhase48（新規テーマ）から開発再開
