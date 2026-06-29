# ENBISOU_AI_COMPANY_MASTER.md

> ENBISOU AI COMPANY 開発マスター（Version 2.0）
> 更新日: 2026-06-29（Phase46-7完了）

## 1. AI会社の最終目的（最重要）

ENBISOU AI COMPANY は「AIチャット」ではない。

**完成した成果物を大量生産し、会社全体が学習し、品質が毎回向上していくAI会社**を作る。

回答を返すことではなく、そのまま使える完成品を納品する。

例：
- Instagram：スライド10枚・画像プロンプト・キャプション・CTA・ハッシュタグまで
- TikTok：企画・台本・画像プロンプト・動画プロンプト・投稿文まで
- チラシ：コピー・デザイン指示・画像プロンプト・PDF構成まで
- LP：構成・コピー・画像プロンプト・HTML・CTAまで

## 2. 絶対ルール

- 既存機能は壊さない
- 削除禁止
- 追加のみ
- AI会社は汎用設計（塗装専用禁止）
- Supabase永続化を維持
- 学習データ削除禁止
- 勝手な課金・API契約禁止
- 画像生成・動画生成・SNS投稿はユーザー承認後のみ
- Git管理を徹底
- dev-check 200/200/200成功後のみ完了扱い
- git push禁止（ユーザー確認必須）

## 3. Workflow

User
→ Leader
→ Company Brain
→ Knowledge（Injected Knowledge + Leader Execution Guide 注入）
→ Workflow生成
→ AI社員（Writer / Reviewer / Strategy）
→ Reviewer
→ Strategy
→ Leader Final
→ 完成成果物納品

## 4. 成果物品質

- 回答では終わらない
- 完成品まで作る
- 他担当へ積極的に相談
- Leaderは統合・品質向上・最終責任を持つ
- Knowledge注入で成果物品質を毎回改善する

## 5. 優先順位（Phase46以降）

### Priority 1: 成果物品質向上（最優先）
- Instagram / TikTok / X / ブログ / LP / チラシ / PDF / 動画台本

### Priority 2: AI会社の学習能力向上
- Learning / Memory / Knowledge / Leader Intelligence / Reviewer Quality / Company Brain

### Priority 3: SNS自動投稿は後回し
- 現時点では自動投稿は実装しない
- まずは手動投稿前提で、投稿直前までの成果物品質を高める
- 画像・動画・投稿文・ハッシュタグ・CTA・構成・プロンプトを高品質化する

### Priority 4: 画像生成・動画生成は承認制
- 画像生成プロンプト作成は自動OK
- 実際の画像生成はユーザー承認後
- 動画生成もユーザー承認後
- 外部API・有料サービス・SNS投稿連携は必ずユーザー承認制

## 6. 現状（Phase46-3完了）

完成：
- Company Brain
- Knowledge Engine
- Workflow Live（完成版 v0.97）
- Auto Task / Leader Final
- Claude/OpenAI役割分担（Writer/Reviewer/Strategy=Claude / Leader=OpenAI）
- Output Engine（Phase44）
  - 13種の成果物タイプ / 自動判定 / 担当割当 / Packageビュー / Export
- Learning Engine（Phase45-2）
- Company Memory（Phase45-3）
- Knowledge Candidates + 承認UI（Phase45-4〜5）
- Knowledge Save + 重複防止（Phase45-6C〜6D）
- Knowledge Inject + Leader Execution Guide（Phase45-7 / Phase46-2）
- Knowledge Compare Mode（Phase46-3）
  - with_knowledge / without_knowledge / guide_only
  - 品質比較のための3モード切替
- Compare Log（Phase46-4）
  - _knowledgeCompareLog[]（max30件）
  - モード別平均スコア / 棒グラフ表示 / Export反映
- Compare Intelligence v1（Phase46-5）
  - analyzeCompareIntelligence() — mode別集計 / InjectionImpact / recommendations
  - buildCompareIntelligenceHtml() — Output Engine に分析パネル表示
  - Export（markdown / json）に自動反映

- Compare Recommendation Engine v1（Phase46-6）
  - buildCompareRecommendations() — priorityItems / knowledgeRecommendations / reviewerHints / learningHints
  - buildCompareRecommendationHtml() — Output Engine に改善提案パネル
  - Export（markdown / json）に自動反映

- Compare Quality Integration Check v1（Phase46-7）
  - buildCompareIntegrationCheck() — Log/Intelligence/Recommendation 統合チェック
  - getCompareIntegrationStatus() — ready/partial/insufficient 判定
  - buildCompareIntegrationCheckHtml() — Output Engine に Integration Check パネル
  - Export（markdown / json）に自動反映

次工程（Phase46-8〜）：
- Compare Integration Check の結果を活用した実案件品質向上
- 成果物品質の継続向上

## 7. v1.0完成像

- AI会社全体が自律協業
- 成果物品質を Knowledge → Learning → Memory → 次回Workflow で継続改善
- 画像・動画・PDF・HTMLまで含めた納品
- 学習結果を次回へ確実に反映
- 品質スコアが毎回向上していく仕組み
