# PROJECT_STATUS.md

# ENBISOU AI COMPANY - 現在の開発状況

更新日: 2026-06-28

---

## 現在地

- 現在フェーズ: **Phase43 完了 / Phase44 開始前**
- 開発状況: Phase43 全5サブフェーズ完了・dev-check 200/200/200
- バージョン: **v0.97**（Phase43-5 完了時点）

---

## 完了済み

### AI基盤
- OpenAI 接続
- Claude 接続
- Supabase 接続
- ログイン機能
- 会話履歴保存
- AI社員基盤

### Workflow
- Company Brain
- Knowledge Engine
- Workflow Live
- Auto Task
- Leader Final
- Timeline
- Provider表示

### Claude担当
- Writer
- Reviewer
- Strategy

### OpenAI担当
- Leader

---

## ブラウザ確認済み

✅ Workflow Live が送信直後に開く

✅ Company Brain 実行

✅ Writer → Claude

✅ Reviewer → Claude

✅ Strategy → Claude

✅ Leader Final 完了

✅ Auto Task 完了

---

## 完了済み（Phase43 全サブフェーズ）

### Phase43-1 ✅
Claude API準備画面の表示同期
- Claude Card動的更新（接続状態と表示一致）
- renderProviderSettings() / toggleClaudeReady() に fetchClaudeStatus() 先行実行追加
- CR_SAFETY・KnowledgeEngine文言を稼働実態に合わせて更新
- Git: a214caf / Tag: v0.97-phase43-1

### Phase43-2 ✅
Workflow開始時に全担当カード生成
- WL_FIXED_WORKFLOW_AGENTS 定数で Leader/Writer/Reviewer/Strategy を固定4枚表示
- _wlMergeWithPrePopulated() で実データとプリポピュレートカードをマージ
- Git: 71d8e1d / Tag: v0.97-phase43-2

### Phase43-3 ✅
Workflow Live Progress Bar追加
- 0%→25%→50%→75%→100% 段階更新
- 進行中（黄）/ 完了（緑）/ エラー（赤）の3状態表示
- Git: f4f1ebb / Tag: v0.97-phase43-3

### Phase43-4 ✅
Timeline改善
- ステップ表示（Workflow開始→各担当実行中/完了→Workflow完了）
- seenKeys Set による重複防止
- 状態アイコン（🟣🟡🔵🟢🔴🏁）
- Git: f0eeb28 / Tag: v0.97-phase43-4

### Phase43-5 ✅
Workflow Live再表示・UI磨き込み
- 📡 直近Workflow 再表示ピルボタン（右下固定）
- UIポリッシュ（カード最小高さ・Provider折り返し・モバイル調整）
- 再表示時の重複防止・二重ポーリング防止を確認済み
- Git: ac34440 / Tag: v0.97-phase43-5

---

## 次に実装すること

**Phase44: 成果物エンジン**（最優先）

AI会社がチャット回答ではなく、完成成果物を納品する能力を強化する。

対象：
- Instagramカルーセル（スライド・キャプション・CTA・ハッシュタグ）
- チラシ（コピー・デザイン指示・画像プロンプト）
- LP（構成・コピー・HTML）
- 動画（企画・台本・画像プロンプト・動画プロンプト）
- PDF生成
- HTML生成

---

## 開発ルール

毎Phase終了時は必ず

- dev-check
- ブラウザ実機確認
- Git Commit
- Git Tag
- 完了レポート

を実施する。

---

## 成果物方針（最重要）

AI会社は回答を返すことが目的ではない。

完成した成果物を納品することが目的。

例

Instagram
- スライド
- キャプション
- CTA
- ハッシュタグ

動画
- 台本
- 画像
- 動画
- 字幕

チラシ
- デザイン
- PDF

LP
- HTML
- 公開レベル

---

## 次チャット開始手順

1.
MASTER.md を読む

2.
PHASE_PROGRESS.md を読む

3.
CLAUDE_RULES.md を読む

4.
PROJECT_STATUS.md を読む

5.
現在地を要約

6.
次工程から開発再開
