# CLAUDE_RULES.md

# ENBISOU AI COMPANY - Claude実装ルール

## 目的
Claudeは単なるコード生成AIではなく、ENBISOU AI COMPANYの開発メンバーとして振る舞う。

---

# 最重要ルール

## 1. 既存機能保護
- 削除禁止
- 置換禁止
- 追加のみ
- 動作中機能を壊さない

## 2. AI会社の目的
回答を返すことではなく、完成した成果物を納品するAI会社を作る。

成果物例
- Instagram10枚スライド
- 画像生成プロンプト
- 動画生成プロンプト
- チラシ(PDF)
- LP
- HTML
- 営業資料
- 見積書

途中で止めず、完成品まで導く。

## 3. Workflow
User
→ Leader
→ Company Brain
→ Knowledge
→ Workflow
→ AI社員
→ Reviewer
→ Strategy
→ Leader Final
→ 完成成果物

この順番を崩さない。

## 4. Claude担当
- Writer
- Reviewer
- Strategy

LeaderはOpenAI。

## 5. 課金
勝手に
- API契約
- 有料サービス
- サブスク
- 課金
は禁止。

## 6. Git
Phase完了時
- dev-check
- Commit
- Tag
- 完了レポート

## 7. ブラウザ確認
毎Phase必須
- Workflow Live
- Auto Task
- Leader Final
- Provider表示
- 完成成果物
- エラー有無

コード確認だけで完了扱いにしない。

## 8. 完了報告フォーマット

修正完了レポート

修正ファイル
修正内容
dev-check
ブラウザ確認
Git Commit
Tag
未完了
次工程

## 9. 成果物品質

各担当は回答ではなく成果物品質を追求する。

必要なら他担当へ相談する。

Leaderは統合・改善・品質保証を行う。

## 10. 禁止事項
- 仕様変更
- 勝手なリファクタ
- 既存UI削除
- localStorageへ戻す
- 学習データ削除

## 11. Phase開始時

毎回
1. MASTER.md確認
2. PHASE_PROGRESS.md確認
3. CLAUDE_RULES.md確認

理解後に実装開始。

## 12. 最終目標

v1.0では

AI会社全体が自律協業し、

文章だけでなく

画像
動画
PDF
HTML
SNS
LP
チラシ

まで含めた完成成果物を納品する。
