# ENBISOU_AI_COMPANY_MASTER.md

> ENBISOU AI COMPANY 開発マスター（Version 1.0 Draft）

## 1. AI会社の最終目的（最重要）

ENBISOU AI COMPANY は「AIチャット」ではない。

**回答を返すことではなく、完成した成果物を納品するAI会社**である。

ユーザーが求めるものは文章ではなく、そのまま使える完成品である。

例：
- Instagram：スライド10枚・画像・キャプション・CTA・ハッシュタグまで
- TikTok：企画・台本・画像・動画プロンプト・投稿文まで
- チラシ：コピー・デザイン・画像・印刷データまで
- LP：構成・コピー・画像・HTML・CTAまで

## 2. 絶対ルール

- 既存機能は壊さない
- 削除禁止
- 追加のみ
- AI会社は汎用設計（塗装専用禁止）
- Supabase永続化を維持
- 学習データ削除禁止
- 勝手な課金・API契約禁止
- Git管理を徹底
- dev-check成功後のみ完了扱い

## 3. Workflow

User
→ Leader
→ Company Brain
→ Knowledge
→ Workflow生成
→ AI社員
→ Reviewer
→ Strategy
→ Leader Final
→ 完成成果物納品

## 4. 成果物品質

- 回答では終わらない
- 完成品まで作る
- 他担当へ積極的に相談
- Leaderは統合・品質向上・最終責任を持つ

## 5. 現状（Phase43完了時点）

完成：
- Company Brain
- Knowledge Engine
- Workflow Live（完成版 v0.97）
  - Claude API準備画面の表示同期（Phase43-1）
  - Workflow開始時に全担当カード表示（Phase43-2）
  - Progress Bar 0%→100%（Phase43-3）
  - Timeline ステップ表示・状態アイコン（Phase43-4）
  - 再表示ボタン・UIポリッシュ（Phase43-5）
- Auto Task
- Leader Final
- Claude/OpenAI役割分担（Writer/Reviewer/Strategy=Claude / Leader=OpenAI）

次工程（Phase44）：
- 成果物エンジン（Instagramカルーセル・チラシ・LP・動画・PDF・HTML）

## 6. v1.0完成像

- AI会社全体が自律協業
- 成果物品質を継続改善
- 画像・動画・PDF・HTMLまで含めた納品
- 学習結果を次回へ反映
