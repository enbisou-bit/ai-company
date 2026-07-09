# ENBISOU AI COMPANY Roadmap

> 作成日: 2026-07-02（Phase48-3.1） / 更新日: 2026-07-04（Version1 Roadmap方針変更・Instagram収益化支援優先化・Decision 039）
> 現在Version: v1.00-phase49-6 Complete（Creative Engineファミリー完結）
> Version2は責務分離型（Creative Engine / Intelligence / Sales / Automation / Business Intelligence / Company Brain v2 の6ファミリー）へ正式再構成（Decision 027〜029参照）
> Version1の最優先目的をInstagram収益化支援へ変更（Decision 039）。詳細は下記「Version1 最優先ゴール」参照
> **Version1 完成（Phase52-2記録・Decision 041）**: Instagram収益化パイプラインが全工程実装完了。現在Version v1.00-phase52-2 / Version1 Documentation Complete。

---

## Version1 完成（Phase52-2 記録）

**Version1 = 完成**。Instagram収益化パイプラインの全工程を実装完了（Phase50-2〜52-1・すべてindex.htmlへ追加のみ・Manual Only・Instagram API/自動投稿/画像生成/課金なし）。

```
市場分析 → 企画 → カルーセル生成 → デザイン設計 → レビュー → 承認
  → 投稿準備 → 手動投稿 → Learning → Asset Library候補生成 → 完成
```

対応機能: Instagram Marketing Intelligence（50-1）/ Content Planning（50-2）/ Carousel Builder（50-3）/ Design System（50-4）/ Mobile Review Center（50-5）/ Mobile Approval（50-6）/ Publishing Ready Center（50-7）/ Instagram Learning Center（51-1）/ Creative Asset Library Save Center（52-1）。

---

## Version1 Final Complete（Phase52-10 記録・Decision 044）

**Version1 = Final Complete**（v1.00-phase52-10・最新コミット f177fd2）。機能完成に加え、Mobile UI（52-5）/ Mobile Touch Hotfix（52-6）/ Mobile Topbar（52-8/52-9/52-9b）を本番反映し、iPhone Safari実機確認（縦向き・横向きともTopbar 1本横スクロール・全ボタン操作可能・入力/送信可能・横はみ出しなし・PC不変）まで完了。**運用可能な完成版**として正式完成。Manual Only維持。

---

## Version1.01 Realtime Sync Edition（Version2着手前に優先・Decision 045）

**目的**: PC / iPhone どちらから利用しても **同じAI会社になること**。

**実装予定（すべてSupabaseを利用し、PCとスマホが同一状態になることを目的とする）**:
- Task同期
- Conversation同期
- Timeline同期
- Notification同期
- Workflow Live同期
- Cost同期
- Learning同期
- Approval同期
- Auto Task同期
- Status同期

**Version2開始条件**: Version2 Affiliate Intelligence は **Version1.01 Realtime Sync Edition 完成後に開始する**。Version2着手前にRealtime同期を優先する。Phase53開始前には必ずユーザー確認を取る。

**進捗（Conversation同期・案件管理系）**:
- Phase52-11〜11.9: Conversation Sync／案件メタデータSupabase同期
- Phase52-11.8〜12.0a: 案件管理UI／ホーム案件一覧・タブ・入力無効化
- Phase52-12.1〜12.1b: 案件削除Supabase同期／選択削除UI／F5・ログイン直後のホーム再描画修正
- **Phase52-12.2: `messages.case_id`（nullable・FKなし）追加＝案件別チャットの端末間分離**（commit aabf46c・push済み・Render反映済み・Decision 046）。既存messagesはNULL維持・非破壊
- **Phase53先行開始をB案運用判断で承認（Decision 047）**: Conversation / Case / Messages 中核同期完了をもってPhase53を先行開始。**残同期（Task/Cost/Status/Auto Task 自動更新poll・Learning一部in-memory整理・Approval端末間同期）は未完了として別Phase扱い**（Approval端末間同期はserver.js/DB/API検討要・独立Phase）
- **Phase54-1 Approval Sync（独立Phase・Decision 048）**: 承認/公開状態のPC⇔スマホ同期。**54-1a 設計（A案・case_idスコープ・最小サブセット）承認済み → 54-1b サーバー側 ✅ Complete**（commit d9310d0・push済み・Render反映済み・新規テーブル `output_approvals`〔FKなし〕＋`lib/approvalsDb.js`＋server.js `GET/POST /api/approvals`・index.html非接触）。**次: 54-1c index.html 同期配線**（未着手）。残る Task/Cost/Status/Auto Task poll・Learning in-memory整理 は引き続き別Phase

---

## Version2 予定

---

## 【Version2 Core 全体設計（正式版・Decision 043）】

> 追記日: 2026-07-05（Version2全体設計の正式反映・Decision 043）
> Version2のテーマ: **Instagram Affiliate Intelligence Company**（Instagramで何を売れば利益が最大になるかをAI会社全体が判断できる会社）。
> 本セクションはVersion2の最上位設計であり、下記「Version2 開発順（Phase53〜57）」を包含・拡張する（既存記述は削除せず、本Core設計で正式に体系化する）。
> **開始条件（Decision 045）**: Version2は Version1.01 Realtime Sync Edition 完成後に開始する。着手前にRealtime同期を優先し、Phase53開始前に必ずユーザー確認を取る。

### Version2の目的（経営判断まで行うAI会社）

Version2は「Affiliate Intelligence → ASP分析 → 案件分析」で止まらず、AI会社全体が
**「利益を最大化する経営判断」**まで行う会社へ進化させる。

最終形は、Leaderへ

> 「今一番利益が出る案件は？」

と聞くだけで、AI会社全体が

```
市場分析 → 案件分析 → ASP分析 → 利益分析 → 競合分析 → Instagram企画 → Learning → 改善
```

まで一気通貫で判断できる会社を目指す。

### Version2 Core: Affiliate Intelligence Core（7層Intelligenceパイプライン）

Version2の中核は **Affiliate Intelligence Core** とし、以下の7つのIntelligence層を上から下へ連鎖させる。

```
Affiliate Intelligence Core
  ↓
① Market Opportunity Intelligence  （今どの市場を狙うべきか）
  ↓
② Product Intelligence             （何を売るべきか）
  ↓
③ ASP Intelligence                 （どのASPを使うべきか）
  ↓
④ Competition Intelligence         （競合分析）
  ↓
⑤ Revenue Intelligence             （利益・将来性分析）
  ↓
⑥ Content Intelligence             （Instagramで勝てる投稿企画）
  ↓
⑦ Self Improvement Intelligence    （実績から自動改善）
```

各層の責務:

| 層 | 名称 | 責務 |
|----|------|------|
| ① | Market Opportunity Intelligence | 今狙うべき市場・ジャンルの機会を判断（需要・季節性・伸び）|
| ② | Product Intelligence | その市場で何を売るべきか（商品・案件カテゴリ選定）|
| ③ | ASP Intelligence | どのASPを使うべきか（A8/もしも/afb/アクセストレード/バリューコマース/楽天/Amazon 比較）|
| ④ | Competition Intelligence | 競合数・競合の強さ・参入余地の分析 |
| ⑤ | Revenue Intelligence | 利益率・承認率・EPC・CVR・案件寿命・想定売上・想定利益・将来性 |
| ⑥ | Content Intelligence | Instagramで勝てる投稿企画（保存率予測・クリック率予測・構成）※既存Instagramパイプラインと連携 |
| ⑦ | Self Improvement Intelligence | 実績（保存率/クリック率/フォロー率/CV/売上）から勝ちパターンを学習し自動改善 |

### AI会社が最終的に判断できる16項目（Version2到達目標）

1. 今売るべき市場
2. 今売るべき商品
3. どのASPを使うべきか
4. 利益率
5. 承認率
6. EPC
7. CVR
8. Instagramとの相性
9. 競合数
10. 案件寿命
11. 季節性
12. 保存率予測
13. クリック率予測
14. 想定売上
15. 想定利益
16. おすすめ順位

これら16項目を統合し、**「おすすめ順位」付きの利益ランキング**として出力できることをVersion2の到達目標とする。

### AI Gateway 正式構成（Version2以降の実行レイヤー）

以前から設計しているAI Gateway（Phase49-1で判断層として実装済み）を、Version2の正式な実行選択レイヤーとして構成へ組み込む。

```
Leader
  ↓
Affiliate Intelligence（7層Intelligence Core）
  ↓
AI Gateway  ← 「最も低コストで最適な実行方法を自動選択するレイヤー」
  ↓
┌──────────┬──────────┬────────────────────┬────────────────┬──────────┐
OpenAI     Claude     Browser Automation   PC Automation    将来API
```

AI Gatewayの役割:
- 各Intelligence層が必要とする実行（分析・生成・データ取得）に対し、**最も低コストで最適な実行方法を自動選択**する
- 実行経路の候補: OpenAI / Claude / Browser Automation / PC Automation / 将来API

**安全設計（既存Decision 028・030・031を継承・変更しない）**:
- AI Gatewayは引き続き**判断・ルーティング層**であり、Browser Automation / PC Automation / API 等の実行系は**ユーザー承認 + 安全ゲート（`isAIGatewayExecutionAllowed()`）を通過して初めて実行される**
- 既存Provider構成（Leader=OpenAI固定 / Writer・Reviewer・Strategy=Claude固定）は一切変更しない。AI GatewayはVersion2新規ドメイン専用の抽象化層
- 課金・外部API契約・自動投稿・Instagram API接続は引き続きユーザー承認制（承認をバイパスする層ではない）

### Version2 Core 推奨Phase構成（Decision 043・Phase53起点を維持）

Affiliate Intelligence最優先（Decision 042）を維持したまま、7層Intelligence + AI Gateway v2を以下のPhaseへ配分する。**すべて`index.html`追加のみ・既存関数は読み取り専用参照・予測ヒューリスティック＋手動入力・Safetyバッジ固定・実API/課金なし**（Phase50-1 Decision 040の設計思想を踏襲）。

| Phase | 内容 | 対応層 |
|-------|------|--------|
| **Phase53 ✅ Complete** | **Affiliate Intelligence Core**（16判断項目の器・案件データ構造・統合スコア・利益ランキング基盤）**／commit bcfba7d・push済み・Render反映済み・index.htmlのみ+380行・DB/server.js/API/Supabase/課金なし** | Core |
| Phase54 | Market Opportunity Intelligence | ① |
| Phase55 | Product Intelligence | ② |
| Phase56 | ASP Intelligence（Multi ASP Compare含む）| ③ |
| Phase57 | Competition Intelligence | ④ |
| Phase58 | Revenue Intelligence（利益率/承認率/EPC/CVR/案件寿命/想定売上・利益/将来性）| ⑤ |
| Phase59 | Content Intelligence（保存率予測/クリック率予測・既存Instagramパイプライン連携）| ⑥ |
| Phase60 | Self Improvement Intelligence（実績Learning→勝ちパターン→自動改善）| ⑦ |
| Phase61 | AI Gateway v2（低コスト最適経路の自動選択・実行は承認ゲート維持）| Gateway |
| Phase62 | Leader Integration（「今一番利益が出る案件は？」で全層を統合実行）| 統合 |

（注: 既存の「Version2 開発順（Phase53〜57）」の Multi ASP Compare / Trend Intelligence / Revenue Optimization / AI Campaign Planner は、本Core設計の各Intelligence層へ統合・再配置する。Phase番号は実装着手時に最終確定する。）

---

### Version2 開発順（Phase53〜57・Affiliate Intelligence最優先・Decision 042）

#### Phase53 Affiliate Intelligence（Version2最優先・中核機能）

Instagram収益化AI会社の中核機能。複数ASPを比較し、以下をAI会社が分析する：
- 利益率
- Instagram適性
- 競合
- 季節性
- 承認率
- 投稿ネタ数
- 収益期待値

対象ASP: A8.net / もしもアフィリエイト / afb / アクセストレード / バリューコマース / 楽天アフィリエイト / Amazonアソシエイト。

#### Phase54 Multi ASP Compare

複数ASP横断比較（同一案件のASP間条件比較・最適ASP選定）。

#### Phase55 Trend Intelligence

トレンド・季節性・需要予測の高度化。

#### Phase56 Revenue Optimization

収益最適化（案件×投稿×時期の最適配分）。

#### Phase57 AI Campaign Planner

キャンペーン自動企画（月次/シーズン単位の投稿・案件計画）。

### Version2 その他予定

- Asset Library 実保存（表示のみ → 実DB保存へ移行）
- Learning 永続化（メモリ → JSON/DB）
- Instagram分析 高度化
- TikTok 展開
- YouTube Shorts 展開
- LP 連携
- AI 自動改善

（Version2着手前に、まずVersion1の実運用＝実際のInstagram投稿を開始する。詳細は docs/06HANDOVER_NEXT_CHAT.md「運用フェーズ」参照）

---

## Version 1.0

完成目標（旧・Phase48-5完了時点で達成済み）

AI会社として

- OpenAI
- Claude
- Knowledge
- Learning
- Compare
- Workflow
- Output Engine

を完成させる。

---

## Version1 最優先ゴール（Instagram収益化支援・Decision 039）

AI会社の最終目的は「AI会社を作ること」ではなく、**AI会社自身が収益を生みながら成長すること**である。

Version1の最優先目的をInstagram収益化支援へ変更する。AI会社はInstagram運用を最初の実運用対象とする。

### 5分パイプライン（Version1完成条件）

以下を5分以内で完了できることをVersion1の完成条件とする。

```
市場調査
  ↓
テーマ決定
  ↓
保存率が高い構成提案
  ↓
スライド構成
  ↓
画像プロンプト
  ↓
動画プロンプト
  ↓
投稿文
  ↓
CTA
  ↓
ハッシュタグ
  ↓
Creative Assembly
  ↓
Asset Library保存
```

画像生成・動画生成・実際の投稿はVersion1では**Manual Only**（ユーザー承認後の手動実行のみ）を維持する。

### 毎日の運用ループ（Version1完成後に開始）

```
毎朝: 「今日バズりそうなテーマ」をAI会社が複数提案
  ↓
ユーザーが1つ選択
  ↓
Instagram投稿一式が完成（構成/画像プロンプト/動画プロンプト/投稿文/CTA/ハッシュタグ）
  ↓
画像生成（手動）
  ↓
投稿（手動）
  ↓
結果分析
  ↓
Learning
  ↓
Asset Library保存
  ↓
次回改善
```

### Version1完成基準（変更後）

Version1完成 = **Instagramを毎日運用できること**。AI会社が短時間でInstagram投稿一式を毎日生成でき、実際の運用を開始できる状態を正式なVersion1リリース条件とする。

---

## 残フェーズ

### Phase48-4 ✅ 完了

Output Preview Engine

- Instagram
- LP
- PDF
- HTML
- チラシ
- YouTube
- TikTok

成果物を完成イメージで画面表示

---

### Phase48-5 ✅ 完了

Publishing Engine

SNS投稿データ生成

- タイトル
- 説明文
- ハッシュタグ
- 投稿時間
- 画像一覧
- 動画一覧
- CTA

---

## Version 2.0 Roadmap（Phase49-0.1で正式化 / Decision 027）

責務分離のため、Phase49〜54を6ファミリーへ再編する。旧Phase49-1「Instagram Intelligence」はPhase50-2「Platform Intelligence」へ統合し、旧Phase50-1「Image Prompt Intelligence」はPhase49-2へ移動した（Creative系プロンプト最適化をPhase49ファミリー内へ統一するため）。

### Creative Engine ファミリー

#### Phase49-0.1

Version2 Roadmap Formalization

Phase49-0（設計レビュー）の内容をdocsへ正式反映する。コード実装は行わない。

---

#### Phase49-1

AI Gateway Foundation

API / PCアプリ操作 / ブラウザ操作を将来選択できる中継層の設計・骨格。

今回は実行連携ではなく設計と安全ゲートを優先する。既存Provider構成（Leader=OpenAI / Writer・Reviewer・Strategy=Claude）には影響させない。

---

#### Phase49-2

Image Prompt Intelligence

GPT Image / Midjourney / Flux / Ideogram / Recraft / ChatGPT画像生成などに対応した画像プロンプト最適化。

生成実行はしない（旧Phase50-1から移動）。

---

#### Phase49-3

Video Prompt Intelligence

Seedance / Flow / Veo / Kling / Runway / Luma / Pika / Hailuo / DOMOAI などに対応した動画プロンプト最適化。

生成実行はしない。

---

#### Phase49-4

Creative Engine Execution

画像生成・動画生成・広告生成の実行本体。

ユーザー承認後のみ。AI Gateway経由。

---

#### Phase49-5

Creative Ad Assembly

ロゴ / バナー / Instagramカルーセル / ショート動画 / 広告素材の組み立て。

Output / Preview / Publishing と連携。

---

#### Phase49-6

Asset Library

生成資産・既存成果物を保存、検索、再利用する資産管理。

画像 / 動画 / LP / PDF / HTML / チラシ / Instagram / プロンプト / Quality / Compare結果を対象候補とする。Knowledge Libraryとは別物（Decision 029）。

---

### Intelligence ファミリー（Instagram Marketing Intelligenceを最優先へ格上げ・Decision 039）

Creative Engine完了後はCompany Brainより先にInstagram Marketing Intelligenceを優先する。Instagram実運用を開始し、Learningを蓄積しながらVersion1を完成させる。

旧Phase50-1「Marketing Intelligence Foundation」（汎用市場分析/SEO分析）と旧Phase50-2「Platform Intelligence」（Instagram中心のプラットフォーム分析）の優先順位を入れ替え、Instagram特化の分析をPhase50-1へ格上げする。

#### Phase50-1

Instagram Marketing Intelligence（旧Phase50-2 Platform Intelligenceを改称・最優先へ格上げ）

Instagram運用に直結する分析を最優先で実装する：
- 保存率分析
- リーチ分析
- プロフィール遷移分析
- フォロー率分析
- CTA分析
- ハッシュタグ分析
- 投稿時間分析
- カルーセル分析
- リール分析
- 競合分析
- トレンド分析

旧Instagram Intelligence（旧Phase49-1）・旧Platform Intelligence（旧Phase50-2）はここへ統合。TikTok / YouTubeの分析は本Phase完了後に拡張する。

本Phase完了後、Creative Asset Library（Phase49-6）を拡張し、投稿/スライド/画像プロンプト/動画プロンプト/CTA/Headline/Caption/Assetに加え、保存率/クリック率/フォロー率/CVなどの実運用結果を蓄積する「勝ちパターン学習」機能を追加する（新規Phase番号は今後決定）。

---

#### Phase50-2

AB Test & Buzz Analysis（旧Phase50-3・順序維持）

LP分析 / 広告分析 / ABテスト提案 / バズ要因分析。Instagram運用データを主対象とする。

---

#### Phase50-3

Marketing Intelligence Foundation（旧Phase50-1・汎用マーケティングへ後回し）

市場分析 / 競合分析 / SEO分析 / トレンド分析（汎用・プラットフォーム非依存）。

Instagram Marketing Intelligence（Phase50-1）完成後に拡張する。

---

### Sales ファミリー

#### Phase51-1

Sales Document Engine

見積書 / 提案書 / 契約書 / 営業資料。

既存Output EngineのPDF/Documentパイプラインを拡張し、新規エンジン乱立は避ける。

---

#### Phase51-2

Presentation Engine

プレゼン資料生成。

---

### Automation ファミリー

#### Phase52-1

Publishing to Automation Bridge

Phase48-5 Publishing Engineの出力を投稿データとして利用する。

タイトル・説明文・ハッシュタグ・CTAを再生成しない。

---

#### Phase52-2

Posting Automation

Instagram / TikTok / YouTube / ブログ / WordPress / LINE / メール投稿・予約投稿。

ユーザー承認後のみ。

---

### Business Intelligence ファミリー

#### Phase53-1

Cross Engine Dashboard

Phase47コスト分析、Phase46 Compare、Phase48 Quality、Phase48-5 Publishingを横断集計。

既存機能を再実装しない。

---

#### Phase53-2

Business KPI Intelligence

売上 / 利益 / 案件 / 社員 / ROI分析。

新規分析のみ。

---

### Company Brain v2 ファミリー（Decision 039によりInstagram Marketing Intelligenceより後回し）

Creative Engine完了後はCompany BrainよりInstagram Marketing Intelligence（Phase50-1）を優先する。Instagram実運用開始・Learning蓄積・Version1完成を優先し、Company Brain v2は引き続きPhase54で着手する。

#### Phase54-1

Consult Engine

既存`autonomousConsult`フラグとcollaborators機構を正式Workflow機能へ昇格。

---

#### Phase54-2

Self Review Engine

Reviewer / Strategy の自動相互レビュー。

---

#### Phase54-3

Autonomous Quality Loop

Compare Intelligence → Learning → Knowledge の改善ループ自律化。

---

#### Phase54-4

Company Brain v2 Integration

読み取り専用ダッシュボードから自律実行層へ昇格。

---

## Version 2.0 完成時の姿（Autonomous Mode）

AI Company Autonomous Mode

```
依頼
  ↓
Leader判断
  ↓
各AI社員
  ↓
相談
  ↓
改善
  ↓
レビュー
  ↓
品質判定
  ↓
完成品生成
  ↓
画像生成
  ↓
動画生成
  ↓
投稿データ生成
  ↓
分析
  ↓
学習
  ↓
会社全体へ反映
```

完全自律型AI会社

---

## Ultimate Goal

ユーザーが

「美容系Instagramを作って」

と依頼すると

```
市場分析
  ↓
競合分析
  ↓
ターゲット分析
  ↓
戦略立案
  ↓
カルーセル
  ↓
画像生成プロンプト
  ↓
動画生成プロンプト
  ↓
Flow
  ↓
Veo
  ↓
Kling
  ↓
LP
  ↓
HTML
  ↓
PDF
  ↓
投稿タイトル
  ↓
投稿文
  ↓
CTA
  ↓
ハッシュタグ
  ↓
投稿時間
  ↓
改善提案
  ↓
品質チェック
  ↓
完成品
```

までAI会社が自動で納品できることをVersion2.0の最終目標とする。

（下記「将来的な完成イメージ」は本Ultimate Goalを具体的な依頼例で示したものであり、同一の最終目標を指す）

---

## 将来的な完成イメージ

AI会社へ

「Instagramでバズる美容アカウントを作って」

と依頼すると、

- 市場分析
- 競合分析
- ターゲット分析
- カルーセル作成
- 動画台本作成
- Flow用プロンプト生成
- Veo用プロンプト生成
- Kling用プロンプト生成
- 画像生成プロンプト
- 投稿タイトル
- 説明文
- CTA
- ハッシュタグ
- 投稿時間
- LP
- HTML
- PDF資料

まで全自動で完成するAI会社を目指す。
