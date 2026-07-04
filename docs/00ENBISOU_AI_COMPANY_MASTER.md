# ENBISOU_AI_COMPANY_MASTER.md

> ENBISOU AI COMPANY 開発マスター（Version 2.2）
> 更新日: 2026-07-04（Version1 Roadmap方針変更・Instagram収益化支援優先化・Decision 039）

---

## 【Version1 最重要目的】（最優先・すべての実装判断の基準）

Version1では

「AI会社を完成させること」

ではありません。

Instagramカルーセルを毎日運用し、

アフィリエイト収益を生みながら

AI会社自身を Learning・Asset Library で成長させること

を Version1 最優先目的とします。

今後の全ての実装は、この目的を最優先基準として判断してください。

---

## 【Version1 完成条件】（正式リリース条件）

Version1 正式リリース条件は

AI会社が Instagram 運用を毎日支援できること。

具体的には

市場分析
↓
テーマ提案
↓
カルーセル構成
↓
画像生成
↓
背景画像＋文字レイアウト済みカルーセル完成
↓
投稿文
↓
CTA
↓
ハッシュタグ
↓
iPhone成果物確認
↓
iPhone修正依頼
↓
iPhone承認
↓
Instagram手動投稿
↓
Learning
↓
Asset Library保存

この一連の流れを毎日運用できることを Version1 完成条件とします。

なお、Instagram投稿は最後までユーザー承認後の手動投稿を維持してください。

### Version1 完成条件チェック（Phase52-2 記録・すべて完成済み）

Version1 = **完成**（現在Version v1.00-phase52-2 / Version1 Documentation Complete・Decision 041）。

- ☑ 市場分析（Instagram Marketing Intelligence / Phase50-1）
- ☑ コンテンツ企画（Instagram Content Planning / Phase50-2）
- ☑ カルーセル作成（Instagram Carousel Builder / Phase50-3）
- ☑ デザイン設計（Instagram Design System / Phase50-4）
- ☑ Mobile Review（Mobile Review Center / Phase50-5）
- ☑ Mobile Approval（Mobile Approval / Phase50-6）
- ☑ Publishing Ready（Publishing Ready Center / Phase50-7）
- ☑ 手動投稿（Publishing Readyの「投稿しました」手動ボタン・自動投稿なし）
- ☑ Instagram Learning（Instagram Learning Center / Phase51-1）
- ☑ Asset Library Save（Creative Asset Library Save Center / Phase52-1・表示のみ）

すべて完成済みとして記録する。次はVersion1の実運用（実際のInstagram投稿）を開始し、その後にVersion2（Asset Library実保存 / Learning永続化 / Instagram分析高度化 / TikTok / YouTube Shorts / LP連携 / AI自動改善）へ進む。

### ■ Version1 正式運用開始（Phase52-3記録）

運用開始日: **2026-07-04**

現在は

開発フェーズ
↓
Instagram実運用フェーズ

へ移行。

Version1は実運用しながら改善する（作って終わりではなく、投稿→実績手入力→Learning→Asset Library候補蓄積のループを実際に回す）。

---

## 1. AI会社の最終目的（最重要）

ENBISOU AI COMPANY は「AIチャット」ではない。

**AI会社自身が収益を生みながら成長すること**が最終目的である（Decision 039）。「AI会社を作ること」自体がゴールではない。

そのための第一歩として、**完成した成果物を大量生産し、会社全体が学習し、品質が毎回向上していくAI会社**を作る。

回答を返すことではなく、そのまま使える完成品を納品する。

ENBISOU AI COMPANYは「回答するAI」ではなく、「完成成果物を納品するAI会社」である。

Version1の最優先目的は**Instagram収益化支援**である。AI会社はInstagram運用を最初の実運用対象とする（詳細は docs/04ROADMAP.md「Version1 最優先ゴール」参照）。画像生成・動画生成・実際の投稿はManual Only（ユーザー承認後の手動実行のみ）を維持する。

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

## 5. 優先順位（Phase47以降）

### Priority 0: APIコスト最適化（緊急）
- Claude Writer / Reviewer / Strategy → 最安モデルへ切替（コスト削減優先）
- Strategy → 最高品質モデルへ切替（品質担保）
- Leader は OpenAI 固定（変更禁止）
- コストと品質のバランスを毎Phase確認する

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

## 5.1 現在の最優先（Phase49-6完了時点 / Version1最優先目的をInstagram収益化支援へ変更・Decision 039）

Version2はCreative Engine / Intelligence / Sales / Automation / Business Intelligence / Company Brain v2 の6ファミリーへ再編済み（Decision 027）。Creative Engineファミリー（Phase49-1〜49-6）は完結済み。Creative Engine完了後はCompany Brainより先にInstagram Marketing Intelligenceを優先する（Decision 039）。詳細は [docs/04ROADMAP.md](04ROADMAP.md) を参照。

### Priority 0: Instagram Marketing Intelligence（Phase50-1・最優先へ格上げ）
- 保存率分析・リーチ分析・プロフィール遷移分析・フォロー率分析・CTA分析・ハッシュタグ分析・投稿時間分析・カルーセル分析・リール分析・競合分析・トレンド分析
- Instagram実運用を開始し、Learningを蓄積しながらVersion1（Instagramを毎日運用できること）を完成させる
- 汎用マーケティング/SEO分析（旧Phase50-1）はInstagram完成後に拡張する（Phase50-3へ後回し）

### Priority 1: AB Test & Buzz Analysis（Phase50-2）
- LP分析・広告分析・ABテスト提案・バズ要因分析。Instagram運用データを主対象とする

### Priority 2: Automation Engine
- Publishing Engine出力を利用した投稿・予約投稿の自動化（Phase52、ユーザー承認後のみ）

### Priority 3: Company Brain v2
- Instagram Marketing Intelligenceの後に着手する（Phase54、Decision 039）

完成済み（Creative Engineファミリー）:
- AI Gateway Foundation（Phase49-1）/ Image・Video Prompt Intelligence（Phase49-2・49-3）/ Creative Execution（Phase49-4）/ Creative Ad Assembly（Phase49-5）/ Creative Asset Library（Phase49-6）— いずれも判断層・プロンプト生成層・実行計画層・組み立て層・管理層のみ。画像生成・動画生成・SNS投稿はユーザー承認後のみ

詳細ロードマップは [docs/04ROADMAP.md](04ROADMAP.md) を参照。

## 6. 現状（Phase49-6完了 / Creative Engineファミリー完結・Version1最優先目的をInstagram収益化支援へ変更）

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

- API料金メーター（Phase47-1）
  - OpenAI Cost Tracker（costTracker.js）: 日次/月次/累計 + モデル別 + 日付リセット
  - Claude Cost Tracker（claudeCostTracker.js）: 日次/月次/累計 + モデル別 + 永続保存
  - Provider別表示: OpenAI / Claude それぞれ今日・今月・累計
  - 合計表示: 右上ヘッダー料金ボタン = OpenAI + Claude 合計
  - 永続保存: cost-logs.json / claude-cost-logs.json
  - 新エンドポイント: /api/claude-cost / /api/claude-status

- Claude Cost Analysis（Phase47-2A） — モデル別料金・トークン集計 / 担当別集計
- Claude Model Policy（Phase47-2B） — Writer/Reviewer=最安モデル(claude-haiku-4-5) / Strategy=最高品質モデル(claude-opus-4-8)へ正式最適化
- Claude Model Quality Compare（Phase47-2C） — 最適化前後の品質比較パネル
- Claude Model Formal Adoption（Phase47-2D） — モデルポリシー正式採用の記録
- Claude Quality Monitor（Phase47-3） — Compare Intelligenceと連携した品質監視エンジン
- Claude Quality History（Phase47-4 / 永続化はPhase47-5） — 時系列品質監視・JSON永続保存
- Output Package Quality（Phase48-1） — 成果物ごとの完成度チェックリスト（0〜100点）
- Output Template Enhancement（Phase48-2） — 全11成果物タイプへテンプレートフィールド拡張
- Output Auto Fill Engine（Phase48-3） — Leader Final・Writer/Strategy/Designer回答からフィールド自動反映
- Output Quality Score（100点対応） — Instagram/TikTok/Flyer/LP/PDF/HTML/Image Prompt/Video Promptの8タイプで100点到達可能なことを実証済み
- Output Preview Engine（Phase48-4） — Instagram/LP/チラシ/PDF/HTML/TikTok/YouTube Shortsを完成イメージ（モックアップ・HTMLはiframe実描画）で画面表示。Package Qualityスコアをバッジ連動表示
- Publishing Engine（Phase48-5） — 10タイプ（Instagram/TikTok/YouTube Shorts/チラシ/LP/HTML/PDF/画像プロンプト/動画プロンプト/汎用文書）でタイトル・説明文・ハッシュタグ・投稿時間・画像/動画一覧・CTA・公開前チェックリストを自動生成。Copy 5ボタン・Markdown/JSON Export反映済み

- Version2設計レビュー（Phase49-0） — Roadmap責務分離・AI Gateway/Asset Library追加案・Creative Engine再構成案・Company Brain v2分割案をレビュー（コード変更なし）
- Version2 Roadmap Formalization（Phase49-0.1） — 上記レビュー内容をdocsへ正式反映（コード変更なし）

次工程（Priority 0）：
- Instagram Marketing Intelligence（Phase50-1） — 保存率/リーチ/プロフィール遷移/フォロー率/CTA/ハッシュタグ/投稿時間/カルーセル/リール/競合/トレンド分析。Instagram実運用を開始しVersion1（Instagramを毎日運用できること）を完成させる（Decision 039）

## 7. v1.0完成像

- AI会社全体が自律協業
- 成果物品質を Knowledge → Learning → Memory → 次回Workflow で継続改善
- 画像・動画・PDF・HTMLまで含めた納品
- 学習結果を次回へ確実に反映
- 品質スコアが毎回向上していく仕組み
