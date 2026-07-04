# 06HANDOVER_NEXT_CHAT.md

# ENBISOU AI COMPANY - 次チャット引き継ぎ書

更新日: 2026-07-04（Phase49-4完了 / Creative Execution）

---

## このファイルの使い方

次チャット開始時に最初に読む。
現在地・絶対ルール・次にやることが全てここに入っている。

---

## 現在バージョン

**v1.00-phase49-4**（Creative Execution・実行計画/コピー/チェック層のみ）

最新Tag: `v1.00-phase49-4`

補足: `v1.00-phase47-1.6` はPhase48-4完了後に発見された過去の未コミット差分（OpenAI費用トラッカーの累計対応）を正式化した**遡及タグ**。作成日時の順序と機能の進行フェーズ番号は一致しない（Phase47-1系の一部）。詳細はPHASE_PROGRESS.mdのPhase47-1.6セクション・Decision 025（04DECISIONS.md）を参照。

---

## 現在地

Phase48-5（Publishing Engine）完了＝**Version1機能完成**。
Phase49-0（Version2設計レビュー）・Phase49-0.1（Roadmap Formalization）・Phase49-1（AI Gateway Foundation）・Phase49-1.1（AI Registry Expansion）・Phase49-1.2（AI Registry Learning）・Phase49-2（Image Prompt Intelligence）・Phase49-3（Video Prompt Intelligence）・**Phase49-4（Creative Execution）完了**。

Version2は6ファミリー（Creative Engine / Intelligence / Sales / Automation / Business Intelligence / Company Brain v2）へ責務分離型で再構成済み（Decision 027）。Phase49-1〜49-3でAI Gateway一式・Image/Video Prompt Intelligence、Phase49-4でCreative Execution（実行計画・コピー・チェックのみ。自動実行なし）を追加した（Decision 030〜035）。

次工程: **Phase49-5 — Creative Ad Assembly**（ロゴ/バナー/Instagramカルーセル/ショート動画/広告素材の組み立て。Output/Preview/Publishingと連携）

AI Gateway（`AI_SKILL_REGISTRY` / `createAIGatewayDecision()` / `isAIGatewayExecutionAllowed()` 等）・Image Prompt Intelligence（`createImagePromptIntelligenceDraft()`）・Video Prompt Intelligence（`createVideoPromptIntelligenceDraft()`）・Creative Execution（`createCreativeExecutionDraft()`）は全て判断層/プロンプト生成層/実行計画層のみで、実際の画像/動画生成・API実行・PC操作・ブラウザ自動操作は一切行っていない。Creative Executionは`autoExecute: false`・`executionMode: 'manual_only'`をハード固定しており、設定変更では変わらない。

画像生成・動画生成・外部AI操作（PCアプリ操作/ブラウザ操作含む）は引き続きユーザー承認後のみ実行可能。git pushは引き続き禁止。

未追跡ファイル `claude-cost-logs.json` / `claude-quality-history.json` は引き続き方針未決定のまま据え置き（Decision 025参照）。

---

## 完了済みPhase一覧

| Phase | 内容 | Tag |
|-------|------|-----|
| Phase43 | Workflow Live完成版（Progress Bar / Timeline / 再表示ボタン） | v0.97 |
| Phase44 | Output Engine（13種タイプ / Packageビュー / Export UI） | v0.98 |
| Phase45-0 | Output Schema v1.0 | v0.98-phase45-0 |
| Phase45-1 | Quality Engine v1（evaluateOutputQuality） | v0.98-phase45-1 |
| Phase45-2 | Learning Engine v1（extractLearningItems） | v0.98-phase45-2 |
| Phase45-3 | Company Memory基盤 | v0.98-phase45-3 |
| Phase45-4 | Knowledge Candidates準備 | v0.98-phase45-4 |
| Phase45-5 | Knowledge承認UI + Recommendation Engine | v0.98-phase45-5 |
| Phase45-6A〜D | Knowledge保存 + 重複防止 | v0.98-phase45-6D |
| Phase45-7 | Knowledge Inject（Workflow開始時に自動取得） | v0.98-phase45-7 |
| Phase45-8 | Phase45完了判定 | v0.99 |
| Phase46-1 | Knowledge Injection Preview強化 | v1.00-phase46-1 |
| Phase46-2 | Leader Intelligence Upgrade（Execution Guide） | v1.00-phase46-2 |
| Phase46-3 | Knowledge Compare Mode（3モード切替） | v1.00-phase46-3 |
| Phase46-4 | 実案件テストログ / 品質比較記録 | v1.00-phase46-4 |
| Phase46-5 | Compare Intelligence v1 | v1.00-phase46-5 |
| Phase46-6 | Compare Recommendation Engine v1 | v1.00-phase46-6 |
| Phase46-7 | Compare Quality Integration Check v1 | v1.00-phase46-7 |
| Phase46-8 | Compare Intelligence v2（Improvement Score / Failure Analysis / Learning / Summary） | v1.00-phase46-8 |
| Phase47-1 | API料金メーター（OpenAI+Claude統合 / Provider別 / 永続保存 / 右上ヘッダー合計） | v1.00-phase47-1 |
| Phase47-2A | Claude Cost Analysis（モデル別・担当別料金/トークン分析） | v1.00-phase47-2A |
| Phase47-2B | Claude Model Policy（Writer/Reviewer=最安 / Strategy=最高品質へ最適化） | v1.00-phase47-2B |
| Phase47-2C | Claude Model Quality Compare（最適化前後の比較） | v1.00-phase47-2C |
| Phase47-2D | Claude Model Formal Adoption（モデルポリシー正式採用） | v1.00-phase47-2D |
| Phase47-3 | Claude Quality Monitor（Compare Intelligence連携の品質監視） | v1.00-phase47-3 |
| Phase47-4 | Claude Quality History（時系列品質監視・Trend/Warning） | v1.00-phase47-4 |
| Phase47-S | Claude APIコスト最適化トラック v1.00 Stable確定 | v1.00-stable |
| Phase47-5 | Claude Quality History永続化（claude-quality-history.json） | v1.00-phase47-5 |
| Phase48-1 | Output Package Quality Checklist（成果物完成度0〜100点） | v1.00-phase48-1 |
| Phase48-2 | Output Template Enhancement（全11タイプへフィールド拡張） | v1.00-phase48-2 |
| Phase48-3 | Output Auto Fill Engine（Leader Final/Writer/Strategy/Designerから自動反映） | v1.00-phase48-3 |
| Phase48-3.1 | docs正式反映 / Roadmap新設 | v1.00-phase48-3.1 |
| Phase48-3.2 | docs全体整合性確認・強化 | v1.00-phase48-3.2 |
| Phase48-4 | Output Preview Engine（Instagram/LP/チラシ/PDF/HTML/TikTok/YouTube Shortsの完成イメージ表示） | v1.00-phase48-4 |
| Phase47-1.6 | OpenAI費用トラッカー累計対応の正式化（Phase48-4完了後に発見した未コミット差分を検証・コミット、遡及記録） | v1.00-phase47-1.6 |
| Phase48-5 | Publishing Engine（10タイプでタイトル/説明文/ハッシュタグ/投稿時間/画像・動画一覧/CTA/チェックリスト自動生成） | v1.00-phase48-5 |
| Phase49-0 | Version2設計レビュー（コード変更なし。責務整理・AI Gateway/Asset Library案・Creative Engine再構成案・Company Brain v2分割案） | （タグなし・レビューのみ） |
| Phase49-0.1 | Version2 Roadmap Formalization（レビュー内容をdocsへ正式反映。コード変更なし） | v1.00-phase49-0.1 |
| Phase49-1 | AI Gateway Foundation（AI Skill Registry 13ツール・Gateway判断・安全ゲート・UI/Copy/Export、判断層のみ・実行なし） | v1.00-phase49-1 |
| Phase49-1.1 | AI Registry Expansion（Capability/Health/Cost/Approval/Route Priority/Version Registryを追加、既存12フィールドは無変更） | v1.00-phase49-1.1 |
| Phase49-1.2 | AI Registry Learning（実績ベースのrecommendationScore/confidence算出、`learning`オブジェクト追加。recordAIRegistryLearning()は呼び出し関数のみ・自動呼び出しなし） | v1.00-phase49-1.2 |
| Phase49-2 | Image Prompt Intelligence（GPT Image/ChatGPT Image/Midjourney/Flux/Ideogram/Recraft向けプロンプト自動生成。Output Type別最適化・AI Gateway連携。画像生成は未実行） | v1.00-phase49-2 |
| Phase49-3 | Video Prompt Intelligence（Seedance/Flow/Veo/Kling/Runway/Luma/Pika/Hailuo/DOMOAI向けプロンプト自動生成。Output Type別最適化・AI Gateway/Image Prompt Intelligence連携。動画生成は未実行） | v1.00-phase49-3 |
| Phase49-4 | Creative Execution（実行計画・コピー・チェックのみ。16ツール対応Tool Planner。autoExecute=false固定・Manual Only。既存判断ロジックは無変更で参照のみ） | v1.00-phase49-4 |

---

## AI会社の最終目的（最重要）

ENBISOU AI COMPANY は「チャットを返すAI」ではない。

**完成した成果物を大量生産し、会社全体が学習し、品質が毎回向上していくAI会社**を作る。

成果物例：
- Instagram: スライド10枚 + キャプション + CTA + ハッシュタグ
- TikTok: 企画 + 台本 + 画像プロンプト + 動画プロンプト
- チラシ: コピー + デザイン指示 + 画像プロンプト
- LP: 構成 + コピー + HTML + CTA

---

## 絶対ルール（変更禁止）

```
・既存機能は壊さない
・削除禁止
・追加のみ
・リファクタ禁止
・新規API追加禁止（明示的許可なし）
・DBスキーマ変更禁止
・npm install禁止
・Workflow変更禁止
・AI社員ルーティング変更禁止
・Provider設定変更禁止（Leader=OpenAI / Writer・Reviewer・Strategy=Claude）
・localStorageへ戻さない
・git push禁止（ユーザー確認必須）
・dev-check 200/200/200維持
・コミットメッセージはASCII短文1行（日本語・括弧・改行禁止）
```

---

## 課金禁止ルール

以下は絶対に勝手にやらない：
- API契約・有料サービス・サブスク・課金
- 外部有料API連携
- SNS投稿連携（承認なし）
- 画像生成（プロンプト作成はOK / 実行はユーザー承認後）
- 動画生成（同上）

---

## SNS自動投稿は後回し

現時点では自動投稿を実装しない。

まず「投稿直前まで」の成果物品質を高める：
- 画像生成プロンプト（自動OK）
- 動画生成プロンプト（自動OK）
- 投稿文 / ハッシュタグ / CTA / 構成（自動OK）
- 実際の画像・動画生成（ユーザー承認後）
- SNS投稿（ユーザー承認後 / 現時点では実装しない）

---

## 画像・動画生成は承認制

- 画像生成プロンプト：自動で生成してOK
- 実際の画像生成API呼び出し：ユーザー承認後のみ
- 動画生成：ユーザー承認後のみ
- 外部API・有料サービス連携：必ずユーザー承認制

---

## Phase46-4までの重要機能（次チャットが把握すべき実装）

### Workflow
- `atRunWorkflow()` — Workflow開始 / Knowledge取得 / Guide生成 / Leaderへ注入
- `getRoutedKnowledgeContext('leader') + getInjectedKnowledgeContext()` → Leader contextへ連結

### Output Engine
- `buildOutputDraftFromLeaderFinal(finalText)` — Leader Final後にquality / learning / memory / knowledge を連鎖生成
- `renderOutputEnginePanel()` — Output Engineパネル描画

### Knowledge Chain（Phase45）
- `evaluateOutputQuality()` → `extractLearningItems()` → `createCompanyMemoryCandidates()` → `createKnowledgeCandidatesFromMemory()`
- `approveKnowledgeCandidate(id, action)` — 承認/保留/却下
- `saveApprovedKnowledgeCandidates(draft)` — /api/knowledge-library へPOST（approved候補のみ）
- `isKnowledgeDuplicate(candidate)` / `_knowledgeSaveHistory`（max50）

### Knowledge Inject（Phase45-7 / 46-1 / 46-2）
- `fetchKnowledgeForOutputType(outputType)` — /api/knowledge-library GET
- `selectRelevantKnowledge(items, outputType, sourceText)` — max5件
- `buildLeaderExecutionGuide(knowledgeItems, outputType)` — cta/structure/brand/avoid/priorities分類
- `_lastInjectedKnowledge[]` / `_lastLeaderExecutionGuide`

### Knowledge Compare（Phase46-3）
- `KNOWLEDGE_COMPARE_MODE` — with_knowledge / without_knowledge / guide_only
- `_knowledgeCompareMode` — 現在のモード（デフォルト: with_knowledge）
- `switchKnowledgeCompareMode(mode)` — 切替関数
- `getInjectedKnowledgeContext()` — モード別でLeaderへの注入を制御

### Compare Log（Phase46-4）
- `_knowledgeCompareLog[]` — 比較ログ（max30件 / セッション内）
- `recordKnowledgeCompareEntry(draft)` — Leader Final完了時に自動記録
- `getCompareSummaryByMode()` — モード別平均スコア集計
- `buildCompareLogHtml()` — Output Engineパネルに比較ログ表示
- Export（markdown/json）に比較ログ自動反映

### Compare Intelligence（Phase46-5）
- `COMPARE_INTELLIGENCE_VERSION = '1.0.0'`
- `_lastCompareIntelligence` — 最新分析結果を保持
- `analyzeCompareIntelligence()` — Compare Log を分析し _lastCompareIntelligence に保存
- `getCompareModeWinner(summary)` — 最も平均スコアが高い mode を返す
- `getOutputTypeCompareInsights(summary)` — outputType別傾向を集計
- `getKnowledgeInjectionImpact(summary)` — 注入あり/なしの差分を分析
- `buildCompareIntelligenceHtml()` — Output Engine に分析結果を表示
- `appendCompareIntelligenceToExportMarkdown(lines)` — Markdown Export に追記
- `appendCompareIntelligenceToExportJson(payload)` — JSON Export に追記

### Compare Recommendation（Phase46-6）
- `COMPARE_RECOMMENDATION_VERSION = '1.0.0'`
- `_lastCompareRecommendations` — 最新改善提案を保持
- `buildCompareRecommendations(summary)` — Intelligence から priorityItems / knowledgeRecommendations / outputTypeRecommendations / reviewerHints / learningHints / cautionItems を生成
- `getCompareRecommendationPriority(item)` — high / medium / low を判定
- `buildCompareRecommendationHtml()` — Output Engine に改善提案パネルを表示
- `appendCompareRecommendationToExportMarkdown(lines)` — Markdown Export に追記
- `appendCompareRecommendationToExportJson(payload)` — JSON Export に `compareRecommendations` として追加

### Compare Quality Integration Check（Phase46-7）
- `COMPARE_INTEGRATION_CHECK_VERSION = '1.0.0'`
- `_lastCompareIntegrationCheck` — 最新チェック結果を保持
- `buildCompareIntegrationCheck()` — Log/Intelligence/Recommendation の統合整合性チェック / checklist(7項目) / nextTestActions / cautionItems を生成
- `getCompareIntegrationStatus(check)` — ready / partial / insufficient を判定（ログ3件以上 + 2モード + Recommendations ありで ready）
- `buildCompareIntegrationCheckHtml()` — Output Engine に Integration Check パネルを表示（READY/PARTIAL/INSUFFICIENT バッジ付き）
- `appendCompareIntegrationCheckToExportMarkdown(lines)` — Markdown Export に追記
- `appendCompareIntegrationCheckToExportJson(payload)` — JSON Export に `compareIntegrationCheck` として追加

### Compare Intelligence v2（Phase46-8）
- `COMPARE_IMPROVEMENT_VERSION = '2.0.0'`
- `buildCompareFailureAnalysis()` — Hook/CTA/Knowledge/Structure/Images/OutputType/Length 失敗率分析 → `_lastCompareFailureAnalysis`
- `buildImprovementScores()` — 5カテゴリ 0〜100点スコア → `_lastImprovementScores`
- `buildCompareLearning()` — SUCCESS/FAIL/QUALITY/IMPROVEMENT 4パターン分類 → `_lastCompareLearning`
- `buildLeaderImprovementSummary()` — 「今回改善すべきポイント」テキスト生成 → `_lastLeaderImprovementSummary`
- HTML: `buildImprovementScoreHtml()` / `buildCompareFailureAnalysisHtml()` / `buildCompareLearningHtml()` / `buildLeaderImprovementSummaryHtml()`
- `appendImprovementToExportMarkdown(lines)` / `appendImprovementToExportJson(payload)` — Export自動反映

---

## 次にやること

### Priority 0: Phase49-5 — Creative Ad Assembly

目的：
ロゴ / バナー / Instagramカルーセル / ショート動画 / 広告素材の組み立て。Output / Preview / Publishingと連携。

詳細は docs/04ROADMAP.md の「Version 2.0 Roadmap」を参照。

### Phase49-4で完成した内容（次チャットが把握すべき実装）

- `CREATIVE_EXECUTION_VERSION = '1.0.0'` / `CREATIVE_TOOL_PLANNER`（16ツール: ChatGPT/Claude/GPT Image/Seedance/Flow/Veo/Runway/Kling/Pika/Luma/DOMOAI/Hailuo/Ideogram/Flux/Midjourney/Recraft。貼り付け先の案内のみ）
- `createCreativeExecutionDraft(outputDraft)` — executionName/executionType/targetTool/targetRoute/requiredInputs/generatedPrompt/copyTarget/executionSteps/manualSteps/estimatedTime/estimatedCost/difficulty/approvalRequired/warnings/checklist/fallback/notes/autoExecute/executionMode/toolPlanner/sourceGatewayDecision/copyTextを生成
- **`autoExecute`は常に`false`、`executionMode`は常に`'manual_only'`にハード固定**（Decision 035）。設定変更では変わらない
- `_ceSelectGeneratedPrompt()` — Image Prompt Intelligence（`_ipiToolKeyForGatewayTool()`）/ Video Prompt Intelligence（`_vpiToolKeyForGatewayTool()`）の**既存関数を呼び出すのみ**で再利用（変更なし）。AI Gateway推奨ツールに応じたプロンプトを選択
- `_ceBuildExecutionSteps()` — STEP1（Output Preview確認）〜STEP7（成果物保存）
- `copyCreativeExecutionField()` — Copy Execution Plan/Copy Manual Steps/Copy Full Workflow/Copy Checklistの4ケース
- `buildCreativeExecutionHtml()` — `renderOutputEnginePanel()`内、`buildVideoPromptIntelligenceHtml`の直後に表示。「MANUAL ONLY」バッジ付き
- Markdown Export（`## Creative Execution`）/ JSON Export（`creativeExecution`キー、`autoExecute: false`含む）に反映
- 全13 OUTPUT_TYPEで動作確認済み。AI Gateway/Image Prompt Intelligence/Video Prompt Intelligenceの判断ロジックは**一切変更せず参照のみ**
- 実際の画像/動画生成・外部AI通信・PC操作・ブラウザ自動操作は一切なし
- 詳細は Decision 035（docs/04DECISIONS.md）を参照

### Phase49-3で完成した内容（次チャットが把握すべき実装）

- `VIDEO_PROMPT_INTELLIGENCE_VERSION = '1.0.0'` / `createVideoPromptIntelligenceDraft(outputDraft)` — version/outputType/mainPrompt/scenePrompt/motionPrompt/cameraPrompt/lightingPrompt/stylePrompt/audioPrompt/captionPrompt/durationPrompt/formatPrompt/negativePrompt/platformPrompts/safetyChecklist/copyText/warnings/sourceGatewayDecision/sourceImagePromptIntelligence/qualityScoreを生成
- Output Type別最適化（1責務1関数）: `_vpiFillTikTok()` / `_vpiFillYouTubeShorts()` / `_vpiFillInstagram()` / `_vpiFillVideoPromptEnhance()`（既存プロンプト高品質化） / `_vpiFillImagePromptToVideo()`（Image-to-Video前提） / `_vpiFillLp()` / `_vpiFillFlyerPdfDocument()`（動画広告化） / `_vpiFillGeneric()`（それ以外の全タイプへの安全な汎用fallback）
- `_vpiBuildPlatformPrompts()` — Seedance/Flow/Veo/Kling/Runway/Luma/Pika/Hailuo/DOMOAIの9ツール形式でプロンプトを整形。実行は一切しない
- AI Gateway連携（`sourceGatewayDecision`）+ Image Prompt Intelligence連携（`sourceImagePromptIntelligence`: mainPromptをvisual base、stylePromptを動画style、compositionPromptをscenePromptへ反映）。画像生成・動画生成はしない
- `copyVideoPromptField()` — Copy Main Video Prompt/Copy Tool Video Prompt（AI Gateway推奨ツールのプロンプト）/Copy Scene Prompt/Copy All Video Prompts
- `buildVideoPromptIntelligenceHtml()` — `renderOutputEnginePanel()`内、`buildImagePromptIntelligenceHtml`の直後に表示
- Markdown Export（`## Video Prompt Intelligence`）/ JSON Export（`videoPromptIntelligence`キー、`platformPrompts`9キー含む）に反映
- 全13 OUTPUT_TYPEで動作確認済み（powerpoint/excel/html等はGeneric fallbackへ正しく分岐）
- 既存Package/Preview/Publishing/AI Gateway/Image Prompt Intelligence・Workflow・Knowledge Chainは無変更。実際の動画生成・画像生成・外部AI通信は一切なし
- 詳細は Decision 034（docs/04DECISIONS.md）を参照

### Phase49-2で完成した内容（次チャットが把握すべき実装）

- `IMAGE_PROMPT_INTELLIGENCE_VERSION = '1.0.0'` / `createImagePromptIntelligenceDraft(outputDraft)` — version/outputType/mainPrompt/negativePrompt/stylePrompt/compositionPrompt/lightingPrompt/cameraPrompt/colorPrompt/formatPrompt/platformPrompts/safetyChecklist/copyText/warnings/sourceGatewayDecision/qualityScoreを生成
- Output Type別最適化（1責務1関数）: `_ipiFillInstagram()` / `_ipiFillFlyer()` / `_ipiFillLp()` / `_ipiFillDocument()`（pdf/document共用） / `_ipiFillImagePromptEnhance()`（既存プロンプト高品質化） / `_ipiFillGeneric()`（それ以外の全タイプへの安全な汎用fallback）
- `_ipiBuildPlatformPrompts()` — GPT Image/ChatGPT Image/Midjourney/Flux/Ideogram/Recraftの6ツール形式でプロンプトを整形。実行は一切しない
- AI Gateway連携: `outputDraft.aiGateway || createAIGatewayDecision(outputDraft)`からrecommendedTool/recommendedRoute/routePriority/capabilityScore/learningを`sourceGatewayDecision`として参照（コピーせず必要項目のみ抽出）
- `copyImagePromptField()` — Copy Main Prompt/Copy Negative Prompt/Copy Tool Prompt（AI Gateway推奨ツールのプロンプト）/Copy All Image Prompts
- `buildImagePromptIntelligenceHtml()` — `renderOutputEnginePanel()`内、`buildAIGatewayHtml`の直後に表示
- Markdown Export（`## Image Prompt Intelligence`）/ JSON Export（`imagePromptIntelligence`キー、`platformPrompts`6キー含む）に反映
- 全13 OUTPUT_TYPEで動作確認済み（html/tiktok_video等はGeneric fallbackへ正しく分岐）
- 既存Package/Preview/Publishing/AI Gateway・Workflow・Knowledge Chainは無変更。実際の画像生成・外部AI通信は一切なし
- 詳細は Decision 033（docs/04DECISIONS.md）を参照

### Phase49-1.2で完成した内容（次チャットが把握すべき実装）

- `AI_REGISTRY_LEARNING_VERSION = '1.0.0'` / `AI_REGISTRY_LEARNING`（`AI_SKILL_REGISTRY`から機械的初期化、13ツール分、全て実績0件の初期状態）
- `calculateAIConfidence(toolId)` — 実績数・成功率・更新日時の鮮度から low/medium/high を判定
- `calculateAIRecommendationScore(toolId)` — 成功率35%/品質30%/速度15%/コスト20%の加重平均をConfidenceで中立値50へブレンド。実績0件は中立値50（推測で高評価/低評価にしない）
- `recordAIRegistryLearning(toolId, quality, cost, speed, success, actionType)` — **呼び出し関数のみ用意。Workflow等からの自動呼び出しは一切行っていない**（実際のAPI実績はまだ保存されない。次チャットでも安全に呼び出しなしの状態から開始できる）
- `buildAIRegistryLearningSummary()` — 全13ツールのLearning状況サマリー生成
- `createAIGatewayDecision()`の既存フィールド（Phase49-1の12種+Phase49-1.1の8種）は完全に無変更。返り値へ`learning`オブジェクト（version/recommendationScore/confidence/status/count/successRate/warnings）を1つ追加のみ
- `buildAIGatewayHtml()`にLearning Status/Recommendation Score/Learning Confidence/Success Rate/Learning Count/Learning Warningsを追加表示。Copy Learning Summaryボタンを追加（既存5ボタンは無変更）
- Markdown Export（Learning Summary等6項目追記）/ JSON Export（`payload.aiGateway = decision`が`decision.learning`を自動的に含むためコード変更不要で`aiGateway.learning`が反映）
- 全13 OUTPUT_TYPEで既存フィールドが完全に同一の値を返すことを回帰確認済み
- 詳細は Decision 032（docs/04DECISIONS.md）を参照

### Phase49-1.1で完成した内容（次チャットが把握すべき実装）

- `AI_CAPABILITY_REGISTRY`（13ツール×12能力、0〜5または'unknown'） / `AI_HEALTH_REGISTRY`（connectionStatus等） / `AI_COST_PROFILE`（costType等） / `AI_APPROVAL_PROFILE_TEMPLATE`+`getApprovalProfile()`（承認要否はアクション種別で一律決定） / `AI_ROUTE_PRIORITY`（12用途別ツール順位） / `AI_VERSION_REGISTRY`（`AI_SKILL_REGISTRY`から機械的に生成）
- `createAIGatewayDecision()`の既存12フィールドは完全に無変更。返り値へ`capabilityScore`/`healthStatus`/`costProfile`/`approvalProfile`/`routePriority`/`registryVersion`/`selectionConfidence`/`registryWarnings`の8フィールドを追加のみ
- `buildAIGatewayHtml()`にCapability Score/Health Status/Cost Profile/Approval Profile/Route Priority/Selection Confidence/Registry Warningsの表示を追加、Copy Registry Summary/Copy Route Recommendationの2ボタンを追加（既存3ボタンは無変更）
- Markdown Export（新規7項目追記）/ JSON Export（`payload.aiGateway = decision`が全フィールドを自動反映するためコード変更不要）
- 全13 OUTPUT_TYPEで既存4フィールド（recommendedTool/route/allowedNow/requiresApproval）が完全に同一の値を返すことを回帰確認済み
- 詳細は Decision 031（docs/04DECISIONS.md）を参照

### Phase49-1で完成した内容（次チャットが把握すべき実装）

- `index.html` の `AI_SKILL_REGISTRY`（13ツール: ChatGPT/Claude/GPT Image/Seedance/DOMOAI/Genspark/Flow/Veo/Kling/Runway/Luma/Pika/Hailuo） / `AI_GATEWAY_TASK_TOOL_MAP`（OUTPUT_TYPE_DEFINITIONS全13タイプに候補ツール対応済み）
- `createAIGatewayDecision(outputDraft)` — recommendedTool/recommendedRoute/reason/costLevel/qualityLevel/speedLevel/requiresApproval/allowedNow/warnings/fallbackToolsを算出。`allowedNow`はrecommendedRouteがprompt_only/manual_copyの場合のみtrue
- `isAIGatewayExecutionAllowed(decision, actionType)` — api/external_comm/pc_operation/browser_operation/image_generation/video_generation/sns_postは恒久的にfalse、prompt_generation/copy_textのみtrue、未知の値もfalse（安全側デフォルト）のハード安全ゲート
- `buildAIGatewayHtml()` — `renderOutputEnginePanel()`内、`buildPublishingEngineHtml`の直後に表示。Copy Gateway Decision/Copy Tool Prompt/Copy Manual Instructionsの3ボタン付き
- `appendAIGatewayToExportMarkdown()` / `appendAIGatewayToExportJson()` — Export（Markdown`## AI Gateway`セクション/JSON`aiGateway`キー）に反映
- Publishing Engine（`outputDraft.publishing`）が存在すれば判断理由に利用。存在しなくても安全にfallback動作することを確認済み
- 既存Package表示・Preview/Publishing Engine・Export構造・Workflow・Knowledge Chain・Provider構成（Leader=OpenAI固定/Writer・Reviewer・Strategy=Claude固定）は無変更
- 実際のAPI実行・PC操作・ブラウザ自動操作・画像/動画生成・SNS投稿は一切行っていない
- 詳細は Decision 030（docs/04DECISIONS.md）を参照

### Phase49-0 / Phase49-0.1で完成した内容（次チャットが把握すべき事項）

- Roadmap（docs/04ROADMAP.md）をCreative Engine / Intelligence / Sales / Automation / Business Intelligence / Company Brain v2 の6ファミリーへ責務分離型で再構成済み（Decision 027）
- 旧Phase49-1「Instagram Intelligence」→ Phase50-2「Platform Intelligence」へ移動、旧Phase50-1「Image Prompt Intelligence」→ Phase49-2へ移動（Creative系プロンプト最適化をPhase49ファミリー内に統一）
- AI Gateway（Decision 028）・Asset Library（Decision 029）を新規コンセプトとして採用。どちらも今回は設計のみで実装は行っていない
- `loadCompanyBrain()`/`renderCompanyBrain()`を確認し、現行Company Brainが読み取り専用の集計ダッシュボードであることを実コードで確認済み。`autonomousConsult`フラグ・`toggleAutonomousConsult()`をCompany Brain v2（Phase54-1 Consult Engine）の土台として活用する方針
- コード変更は一切なし（index.html/server.js/package.json/DB関連ファイルとも無変更）

### Phase48-5で完成した実装（次チャットが把握すべき実装）

- `index.html` の `createPublishingDraft()` — Instagram/TikTok/YouTube Shorts/チラシ/LP/HTML/PDF/画像プロンプト/動画プロンプト/汎用文書の10タイプでPublishing Draft（title/description/hashtags/publishTimeSuggestion/imageList/videoList/cta/copyText/checklist/warnings/sourcePreviewVersion/qualityScore）を生成
- ハッシュタグ数: Instagram 15〜30件 / TikTok 5〜15件 / YouTube Shorts 3〜10件（`#Shorts`含む）。既存タグ+キーワード抽出+汎用フィラータグで調整（事実は捏造しない、Decision 026）
- Quality連携: `packageQuality.score`が80点未満の時のみ`warnings`に追加（90/75/50という既存status閾値とは別のPublishing独自基準）
- Preview連携: `OUTPUT_PREVIEW_TYPES`に含まれる場合のみ`sourcePreviewVersion`を格納。image_prompt/video_promptなどPreview非対応でも独立動作
- `buildPublishingEngineHtml()` — `renderOutputEnginePanel()`内、`buildOutputPreviewHtml`の直後に表示。Copy Title/Description/Hashtags/CTA/All Publishing Dataの5ボタン付き
- `appendPublishingToExportMarkdown()` / `appendPublishingToExportJson()` — Export（Markdown`## Publishing Engine`セクション/JSON`publishing`キー）に反映
- 既存Package表示・Preview Engine・Export構造・Workflow・Knowledge Chainは無変更
- 詳細は Decision 026（docs/04DECISIONS.md）を参照

### Phase47-1.6で解消した内容（次チャットが把握すべき事項）

- `costTracker.js`（OpenAI費用トラッカー）に`todayKey`/`monthKey`/`totalAmount`を追加し、`index.html`側（Phase47-2Aで既にコミット済みだった`cp-oa-total`表示）との不整合を解消・正式コミット済み
- `cost-logs.json`も合わせてコミット済み（既存運用に合わせてデータスナップショットも追跡）
- `claude-cost-logs.json` / `claude-quality-history.json` は今回もコミット対象外のまま（未追跡）。`cost-logs.json`との追跡方針の統一は未着手 — 次回以降で判断が必要
- 詳細はPHASE_PROGRESS.mdのPhase47-1.6セクション・Decision 025（04DECISIONS.md）を参照
- 教訓: Phaseごとに`git status --short`で未コミット差分がないか確認する運用を今後も徹底する

### Phase48-4で完成した実装（次チャットが把握すべき実装）

- `index.html` の `buildOutputPreviewHtml()` — Instagram/LP/チラシ/PDF/HTML/TikTok・YouTube Shortsの完成イメージモックアップを`renderOutputEnginePanel()`内、`buildOutputPackageQualityHtml`の直後に表示
- HTMLタイプは`f.html`があれば`<iframe sandbox="" srcdoc="...">`で実描画（script実行はブロック済み、XSS対策確認済み）
- Preview右上に`_lastOutputDraft.packageQuality`（Phase48-1のスコア）をバッジ表示
- 既存`buildXxxPackageHtml()`（コピー用途）・Export・Workflow・Knowledge Chainは無変更
- 詳細は Decision 024（docs/04DECISIONS.md）を参照

### 次工程チェーン（Phase49-1完了時点のRoadmap / Decision 027で責務分離型へ再構成済み）

```
Phase49-1 AI Gateway Foundation ✅ 完了
  ↓
Phase49-2 Image Prompt Intelligence
  ↓
Phase49-3 Video Prompt Intelligence
  ↓
Phase49-4 Creative Engine Execution
  ↓
Phase49-5 Creative Ad Assembly
  ↓
Phase49-6 Asset Library
  ↓
Phase50-1 Marketing Intelligence Foundation
  ↓
Phase50-2 Platform Intelligence
  ↓
Phase50-3 AB Test & Buzz Analysis
  ↓
Phase51-1 Sales Document Engine
  ↓
Phase51-2 Presentation Engine
  ↓
Phase52-1 Publishing to Automation Bridge
  ↓
Phase52-2 Posting Automation
  ↓
Phase53-1 Cross Engine Dashboard
  ↓
Phase53-2 Business KPI Intelligence
  ↓
Phase54-1 Consult Engine
  ↓
Phase54-2 Self Review Engine
  ↓
Phase54-3 Autonomous Quality Loop
  ↓
Phase54-4 Company Brain v2 Integration
```

### Phase47-2〜48-3で完成した実装（次チャットが把握すべき実装の要約）

- Claude Model Policy: `claudeClient.js` の `getClaudeModelForRole(role)` — Writer/Reviewer=`claude-haiku-4-5` / Strategy=`claude-opus-4-8`
- Claude Quality History: `claudeCostTracker.js` の `recordClaudeQualityHistory()` / `claude-quality-history.json`永続化（最大20件）
- Output Package Quality: `index.html` の `evaluateOutputPackageCompleteness(draft)` — score 0〜100 / status 4段階
- Output Auto Fill: `index.html` の `buildOutputDraftFromLeaderFinal()` 拡張 — `_extractLabeledSection()` 等でテキスト解析ベースの自動反映（新規AI呼び出しなし）
- 詳細は docs/02PHASE_PROGRESS.md の各Phaseセクション、docs/04DECISIONS.md の Decision 017〜023 を参照

### Phase47-1で追加した機能（次チャットが把握すべき実装）

**API料金メーター（Phase47-1）:**
- `costTracker.js` — addOpenAIUsage() / recordUsage() → todayAmount・monthlyAmount・totalAmount 更新。日付変更で today/month リセット、total は永続
- `claudeCostTracker.js`（新規） — addClaudeUsage(model, inputTokens, outputTokens) → claude-cost-logs.json 永続保存 / ensureState()で日付リセット
- `claudeClient.js` — モジュールレベルで `_addClaudeCost = require('./claudeCostTracker').addClaudeUsage` / trackUsage()末尾で呼び出し
- `server.js` — GET /api/claude-cost → getSummary() from claudeCostTracker
- `index.html` — updateCostProviderPanel(): /api/cost + /api/claude-cost + /api/claude-status を Promise.all で取得、OpenAI+Claude合計を cp-today/cp-month/cp-remain/cost-today に反映
- Provider別パネル: cp-oa-today/cp-oa-month/cp-oa-total/cp-oa-41/cp-oa-mini/cp-oa-nano（OpenAI） + cp-cl-today/cp-cl-month/cp-cl-total/cp-cl-sonnet/cp-cl-opus/cp-cl-in/cp-cl-out/cp-cl-req（Claude）
- フォールバック条件: cc.ok && cc.today.requests > 0 → 永続データ使用 / それ以外 → claude-status インメモリ使用

---

## 実装指示書ルール（正式仕様 / Decision 013）

Phase46-5以降のすべての実装指示書は `docs/08CLAUDE_PROMPT_TEMPLATE.md` に従う。

最終出力形式：
- 通常テキスト形式（Markdownコードブロックで囲まない）
- ヘッダー「これをそのままClaude Codeへ貼ってください。」を付ける
- 出力順序：① 改善案（必要時のみ）→ ② 最終実装指示書（1つだけ）
- 指示書順序固定：目的→絶対ルール→実装内容→詳細仕様→ブラウザ確認→完了条件→Git→完了レポート

---

## Claude Codeへの注意点

1. 既存コードを読まずに実装しない（必ずGrep/Readで確認）
2. `atRunWorkflow()` は複雑な非同期処理 — 変更は最小限に
3. `renderOutputEnginePanel()` は多くの関数を連結 — 追加は末尾に
4. PowerShell git commitは1行ASCII短文のみ（日本語・括弧厳禁）
5. `getRoutedKnowledgeContext()` は既存Knowledge Routing Engine — 変更禁止
6. `buildOutputDraftFromLeaderFinal()` の chain順序は変更禁止
7. 修正ファイルは `index.html` のみ（server.jsは原則変更しない）
   - 例外: Claude APIコスト最適化トラック（Phase47-1〜47-5）では `claudeCostTracker.js` / `claudeClient.js` / `server.js` への変更が正式に承認・実施された。Output Engineトラック（Phase48-1〜）は原則通り `index.html` のみで完結している

---

## dev-check コマンド

```
npm --prefix "C:\Users\hp\ENBISOU_AI\ai-company" run dev-check
```

200/200/200 が必須。

---

## Git Commit形式

```
cd "C:\Users\hp\ENBISOU_AI\ai-company"
git add index.html
git commit -m "Phase46-4 Compare Log"
git tag v1.00-phase46-4
```

日本語禁止 / 括弧禁止 / 1行のみ。

---

## 次チャット開始時の確認手順

新しいClaudeセッションでは、以下 00〜08（+04ROADMAP.md）だけ読めば開発を継続できる状態にしてある。

1. docs/06HANDOVER_NEXT_CHAT.md（このファイル）を読む
2. docs/00ENBISOU_AI_COMPANY_MASTER.md を読む
3. docs/01PROJECT_STATUS.md を読む
4. docs/02PHASE_PROGRESS.md を読む
5. docs/03CLAUDE_RULES.md を読む
6. docs/04ROADMAP.md を読む（v1.0残フェーズ / Version 2.0）
7. docs/05DOC_UPDATE_PROTOCOL.md を読む
8. docs/07CHATGPT_TRANSFER.md を読む（ChatGPT側の場合）
9. docs/08CLAUDE_PROMPT_TEMPLATE.md を読む
10. docs/04DECISIONS.md を読む（設計判断の背景確認）
11. 現在地を要約する
12. Phase49-5（Creative Ad Assembly）から開発再開
