# PHASE_PROGRESS.md

> ENBISOU AI COMPANY 開発進捗管理書

## 現在地
- 現在フェーズ: **Phase43 完了 / Phase44 開始前**
- 現在バージョン: **v0.97（Phase43完了）**

---

# Phase1～Phase35（基盤構築）
## 完了
- OpenAI接続
- Supabase接続
- ログイン
- 会話履歴保存
- AI社員基盤
- Workflow基盤
- Timeline基盤
- Task基盤

---

# Phase36
## Claude協業開始
### 完了
- Claude担当追加
- Leaderルーティング
- OpenAI/Claude切替基盤

---

# Phase37
## Provider管理
### 完了
- Writer=Claude
- Reviewer=Claude
- Strategy=Claude
- Leader=OpenAI

---

# Phase38
## Workflow Live
### 完了
- Workflow Live表示
- Timeline表示
- Provider表示

---

# Phase39
## AI Collaboration Engine
### 完了
- AI社員協業
- Git v0.9

---

# Phase40
## Company Brain
### 完了
- Goal
- Priority
- Complexity
- Workflow推奨
- Consultation
- Timeline保存

---

# Phase41
## Company Brain × Knowledge
### 完了
- Knowledge Lookup
- BrainへKnowledge注入
- Knowledge表示
- Timeline保存
- Fallback

Git:
v0.95

---

# Phase42
## Leader Final
### 完了
- Leader Final
- 成果物生成
- Leaderチャット保存
- AutoTask終了
- Workflow Live終了
- Claude/OpenAI表示
- Workflow進捗更新
- Provider表示
- TDZ修正
- Workflow Progress API

Git:
v0.96相当

---

# ブラウザ確認済

✅ Workflow Live即表示

✅ Company Brain

✅ Writer(Claude)

✅ Reviewer(Claude)

✅ Strategy(Claude)

✅ Leader Final

✅ AutoTask終了

✅ Workflow終了

---

# 現在残タスク（優先順）

## Priority A
1. Claude API準備画面を実接続状態へ同期
2. Workflow開始時に全担当カード生成
3. Workflow Live UI磨き込み

## Priority B
4. Progress Bar
5. Timeline改善
6. Workflow Live再表示

## Priority C
7. AI社員相談演出
8. 通知センター
9. ダッシュボード強化

---

# Phase43

目的:
Workflow Live完成版

## Phase43-1（完了）
### Claude API準備画面の表示同期

完了内容:
- AI Provider設定パネルのClaude CardにID追加→動的ステータス更新
- renderProviderSettings()にfetchClaudeStatus()同期追加
- renderClaudeReady()のチェックリストを動的生成（_claudeStatus参照）
- エージェントカード状態表示を動的化（接続済み/設定済み/設定待ち）
- 「予定Model（未導入）」→「使用Model」で実際のmodel表示へ変更
- toggleClaudeReady()がパネル開時にfetchClaudeStatus()を先行実行
- CR_SAFETY を現実の運用状態に合わせて更新
- KnowledgeEngine「未導入」テキストを「Phase42完了・稼働中」へ更新
- Provider選択肢「Claude（未導入）」→「Claude（Anthropic）」へ修正

ブラウザ確認: ✅
dev-check: 200/200/200 ✅
Git: a214caf
Tag: v0.97-phase43-1

## Phase43-2（完了）
### Workflow開始時に全担当カード生成

完了内容:
- `WL_FIXED_WORKFLOW_AGENTS` 定数追加（Leader/Writer/Reviewer/Strategy の固定4担当）
- `atRunWorkflow()` 開始時にプリポピュレートカードを生成し `_wlLastResults` に追加
  - 既存の `pendingTasks` に含まれない担当のみ追加（重複防止）
  - 各カードに `isPrePopulated:true` フラグを付与
- `_wlMergeWithPrePopulated()` 関数を追加
  - ポーリング実データとプリポピュレートカードをマージ
  - 実データに含まれた担当は自動的に実データへ置き換わる
- `wlProgressPoll()` でマージ処理を使用するよう変更
- 各担当のProvider表示は既存 `_wlProviderLabel()` で正常動作
  - Writer/Reviewer/Strategy → `🟣 Claude`
  - Leader → `🔵 OpenAI GPT`

ブラウザ確認: ✅
dev-check: 200/200/200 ✅
Git: 71d8e1d
Tag: v0.97-phase43-2

## Phase43-3（完了）
### Workflow Live Progress Bar追加

完了内容:
- CSS追加: `#wl-progress` / `.wl-pb-*` クラス群（既存スタイルの後ろに追加）
- HTML追加: `<div id="wl-progress">` を `#wl-header` 直後に固定配置（重複描画なし）
- `renderWorkflowLive()` に Progress Bar更新ロジック追加（即時実行関数で副作用を局所化）
  - 固定4担当（Leader/Writer/Reviewer/Strategy）を集計対象
  - 完了ステータス: completed / done / success / final / finished + isLeaderFinal
  - バー幅・色・ステータス文言を動的更新
  - 状態: 進行中（黄）/ 完了（緑）/ エラーあり（赤）
  - Workflow実行前は非表示（results がある場合のみ `visible` クラス付与）

ブラウザ確認: ✅
dev-check: 200/200/200 ✅
Git: f4f1ebb
Tag: v0.97-phase43-3

## Phase43-4（完了）
### Workflow Timeline改善

完了内容:
- CSS追加: `.wl-tl-step-icon` / `.wl-tl-workflow-done` クラス
- `renderWorkflowLive()` の `tlRows` 生成を全面改善
  - 既存: `taskHistory` の from→to 表示
  - 新: `_wlLastResults` から段階ステップ生成
  - 追加エントリ: 「Workflow 開始」（先頭）・「✅ Workflow 完了」（全員完了時）
  - 状態アイコン: 🟣開始 / 🟡待機中 / 🔵実行中 / 🟢完了 / 🔴エラー / 🏁完了
  - 時刻: taskHistory から agentId マッチで取得
  - 重複防止: seenKeys Set で agentId+status をキー管理
  - pre-populated pending はタイムライン非表示（ノイズ防止）

ブラウザ確認: ✅
dev-check: 200/200/200 ✅
Git: f0eeb28
Tag: v0.97-phase43-4

## Phase43-5（完了）
### Workflow Live再表示・UI磨き込み

完了内容:
- CSS追加: `#wl-reopen-btn` 固定位置の再表示ピルボタン（右下・z-index:490）
- CSS追加: `#wl-body { min-height:0 }` / `.wl-agent-card { min-height:46px }` / `.wl-card-provider { word-break:break-word }` UIポリッシュ
- CSS追加: モバイル(640px以下)で `#wl-progress` `#wl-reopen-btn` パディング調整
- HTML追加: `<button id="wl-reopen-btn">📡 直近Workflow</button>` をパネル直前に配置
- JS修正: `toggleWorkflowLive()` でパネル閉時にデータがあれば再表示ボタンを表示、開時に非表示
- JS追加: `renderWorkflowLive()` 末尾にボタン表示制御IIFE（パネルopen中は非表示）
- 二重ポーリング: 既存 `wlProgressStartPolling()` が stop→start で重複なし（変更不要）

ブラウザ確認: ✅
dev-check: 200/200/200 ✅
Git: ac34440
Tag: v0.97-phase43-5

---

# Phase44（次工程）
## 成果物エンジン

目的:
AI会社がチャット回答ではなく、完成成果物を納品する能力を強化する。

Decision 009 に基づき、UIの見える化よりも成果物完成能力を優先する。

対象成果物:
- Instagramカルーセル（スライド・キャプション・CTA・ハッシュタグ）
- チラシ（コピー・デザイン指示・画像生成プロンプト）
- LP（構成・コピー・HTML）
- 動画（企画・台本・画像プロンプト・動画プロンプト）
- PDF生成
- HTML生成

---

# v1.0まで

□ Company Brain完成
□ Knowledge完成
□ Workflow完成
□ 成果物エンジン完成
□ Instagram完成品生成
□ 動画完成品生成
□ チラシ完成品生成
□ LP完成品生成
□ PDF生成
□ HTML生成
□ AI会社UI完成
□ Company Memory
□ 自動学習
□ Cost Meter
□ 通知センター
□ v1.0正式版

---

# 最重要思想

AI会社は回答を返すことが目的ではない。

完成した成果物を納品することが目的である。

Instagramなら
企画→文章→画像→10枚スライド→投稿文→CTA→ハッシュタグまで。

チラシなら
企画→コピー→デザイン→画像→PDFまで。

動画なら
企画→台本→画像→動画→字幕→投稿文まで。

毎Phase終了後は

- dev-check
- ブラウザ確認
- Git Commit
- Tag
- 完了レポート

まで実施して完了とする。
