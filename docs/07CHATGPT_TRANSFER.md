# 07CHATGPT_TRANSFER.md

# ENBISOU AI COMPANY — ChatGPT 引き継ぎ書

更新日: 2026-07-04（Version1 Roadmap方針変更・Instagram収益化支援優先化・Decision 039）

---

## このファイルの目的

ChatGPT（またはClaude以外のAI）が実装指示書を作成する際の正式ルールを定義する。

ChatGPT は Claude Code への橋渡し役として機能する。

---

## ChatGPT の役割

ChatGPT は以下を担当する：

1. ユーザーの要望をヒアリング
2. `docs/08CLAUDE_PROMPT_TEMPLATE.md` に従って実装指示書を作成
3. 最終実装指示書をユーザーへ出力（Claude Code へのコピー用）
4. Claude Code の完了レポートを受け取り、docs 更新を提案
5. Version管理
6. Roadmapレビュー（docs/04ROADMAP.md との整合性確認）
7. docs整合性確認（Version表記統一 / 現在フェーズ統一 / Git Tag統一 / 矛盾チェック）
8. Output品質レビュー
9. Preview品質レビュー
10. AI会社全体設計レビュー
11. 今後3Phase先まで考慮した実装指示作成

ChatGPTは毎Phase終了後、以下を確認する：
- docs更新漏れ
- Version更新漏れ
- Roadmap更新漏れ
- Git Tag整合性

---

## 実装指示書の最終出力形式（正式仕様 v1.2）

### ルール 1 — 説明文とコピー対象を分離する

説明文はコピー対象の外に出力する。

出力例：

以下をそのままClaude Codeへ貼ってください。

────────────────────────

Phase○○ 実装指示

（本文）

────────────────────────

コピー対象内に「これをそのままClaude Codeへ貼ってください。」などの説明文を書かない。

---

### ルール 2 — コピー対象の開始位置

コピー対象は「Phase○○ 実装指示」から開始する。

ヘッダー説明文はコピー対象の外に置く。

---

### ルール 3 — 分割禁止

コピー対象を途中で分割しない。

1回のコピーでそのままClaude Codeへ貼り付けられる完成形で出力する。

余計な説明・補足を途中に挟まない。

---

### ルール 4 — 見出しを固定する

目的
↓
絶対ルール
↓
実装内容
↓
詳細仕様
↓
ブラウザ確認
↓
完了条件
↓
Git
↓
完了レポート

この順番を変更しない。

---

### ルール 5 — 完成形で出力する

コピー後はそのままClaude Codeへ貼り付けられる完成形で出力する。

余計な説明は挟まない。

---

### 出力順序

① 改善案（提案がある場合のみ）
② 最終実装指示書（1つだけ）

改善案を複数回挟まない。最終指示書は必ず1つだけ出力する。

---

## 絶対ルール（ChatGPT が守るべきルール）

以下を指示書に必ず記載する：

```
・既存機能は絶対に壊さない
・削除禁止
・追加のみ
・リファクタ禁止
・index.html 以外を変更する場合は必ず理由を明記
・server.js 変更禁止（明示的許可なし）
・DB スキーマ変更禁止
・Workflow 変更禁止
・Knowledge Chain 変更禁止
・Provider 設定変更禁止
・新規 API 追加禁止（明示的許可なし）
・npm install 禁止
・git push 禁止
・課金・外部API実行はユーザー承認後のみ
・dev-check 200/200/200 維持
```

---

## 課金禁止ルール

ChatGPT が指示書を作成する際、以下を含む指示は絶対に書かない：

- OpenAI / Claude API の追加有料呼び出し
- Supabase 有料機能の追加
- 外部 API 連携 / SaaS / サブスク
- SNS 有料連携
- 画像生成 API 実行 / 動画生成 API 実行

画像・動画生成プロンプトの作成指示は OK。

実際の API 実行指示はユーザー承認後のみ。

---

## Phase49以降（Version2）の指示書作成ルール（Phase49-0.1追加）

Phase49以降はVersion2（Creative Engine / Intelligence / Sales / Automation / Business Intelligence / Company Brain v2 の6ファミリー、docs/04ROADMAP.md参照）の実装指示となるため、指示書作成時に以下を必ず明記する：

- AI Gateway（Phase49-1〜）に関わる指示では、既存Provider設定（Leader=OpenAI固定 / Writer・Reviewer・Strategy=Claude固定）を変更しないことを明記する
- 画像生成 API 実行 / 動画生成 API 実行 / PC アプリ操作 / ブラウザ操作を伴う指示は、すべてユーザー承認後のみ実行可能であることを明記する（プロンプト生成自体は自動でよい）
- 課金が発生する可能性がある操作（外部API契約・有料サービス・SNS投稿連携含む）は引き続き絶対に指示しない

## Phase50以降（Instagram収益化支援）の指示書作成ルール（Decision 039・追加）

Version1の最優先目的はInstagram収益化支援へ変更された。Phase50以降の指示書作成時は以下を必ず明記する：

- Phase50（Marketing Intelligence）ではInstagram特化の分析（保存率/リーチ/プロフィール遷移/フォロー率/CTA/ハッシュタグ/投稿時間/カルーセル/リール/競合/トレンド分析）を優先し、汎用マーケティング/SEO分析はInstagram完成後まで指示しない
- Version1完成基準は「Instagramを毎日運用できること」（市場調査→テーマ決定→保存率が高い構成提案→スライド構成→画像プロンプト→動画プロンプト→投稿文→CTA→ハッシュタグ→Creative Assembly→Asset Library保存を5分以内で完了）であることを踏まえて指示書を作成する
- 画像生成・動画生成・実際の投稿はManual Only（ユーザー承認後の手動実行のみ）を維持することを明記する
- Company Brain v2（Phase54）関連の指示は、Instagram Marketing Intelligence（Phase50）完了後まで作成しない

---

## 実装前レビュー（ChatGPT が毎回行う）

指示書作成前に必ず確認する：

```
・設計改善案はないか
・保守性は高いか（将来担当者が読めるか）
・将来拡張性を考慮した設計か
・責務分離できているか（1関数1責務）
・Version 定数の追加が必要か
・AI会社全体で再利用できる設計か
・現 Phase だけでなく最低3 Phase 先まで見据えた設計か
```

改善案がある場合は実装前に提案する。

推測では指示しない。

---

## 品質レビュー（ChatGPT が毎回行う）

以下への影響を指示書作成前に確認する：

```
・既存機能への影響なし
・Workflow（atRunWorkflow）への影響なし
・Knowledge Chain への影響なし
  - Learning / Memory / Knowledge Candidates
  - Knowledge Save / Knowledge Inject
  - Leader Intelligence / Compare / Compare Log
・Output Engine への影響なし
```

---

## 完了レポートの受け取り方

Claude Code から完了レポートが返ってきたら以下を確認する：

1. dev-check 200/200/200 か
2. 既存機能への影響がないか
3. docs が更新されているか
4. Git Commit / Tag が正しいか

問題があれば次の修正指示書を作成する。

---

## 現在地（Phase49-6完了 / Creative Engineファミリー完結・Version1最優先目的をInstagram収益化支援へ変更）

- 完了: Phase47-2A〜Phase48-5（Claude APIコスト最適化 + Output/Preview/Publishing Engine一式）+ Phase49-0〜Phase49-6（Version2設計レビュー〜Creative Asset Library）＝Creative Engineファミリー完結
- Version2はCreative Engine / Intelligence / Sales / Automation / Business Intelligence / Company Brain v2 の6ファミリーへ責務分離型で再構成済み（Decision 027〜029、docs/04ROADMAP.md参照）
- **Version1 Roadmap方針変更（Decision 039）**: Version1の最優先目的をInstagram収益化支援へ変更。AI会社はInstagram運用を最初の実運用対象とする。Manual Only方針は維持。Version1完成基準は「Instagramを毎日運用できること」（5分パイプライン）へ変更。詳細は docs/04ROADMAP.md「Version1 最優先ゴール」参照
- 次工程Priority 0: Phase50-1 Instagram Marketing Intelligence（旧Marketing Intelligence Foundationから優先順位変更・最優先へ格上げ）
- 現バージョン: v1.00-phase49-6 Complete
- 最新Tag: v1.00-phase49-6

## docs 参照順（ChatGPT が指示書作成前に確認するファイル）

```
1. docs/06HANDOVER_NEXT_CHAT.md  — 現在地・次工程
2. docs/00ENBISOU_AI_COMPANY_MASTER.md — AI会社の目的・優先順位
3. docs/01PROJECT_STATUS.md — 現在完成済み・完成度
4. docs/02PHASE_PROGRESS.md — 完了済み Phase 一覧
5. docs/04ROADMAP.md — v1.0残フェーズ・Version 2.0
6. docs/08CLAUDE_PROMPT_TEMPLATE.md — 実装指示テンプレート
7. docs/04DECISIONS.md — 設計判断ログ
```

---

## 改訂履歴

| バージョン | 日付 | 内容 |
|-----------|------|------|
| v1.0 | 2026-06-29 | 初版作成（Project Rule v1.1 対応） |
| v1.1 | 2026-06-29 | 出力形式詳細ルール確定（5ルール明文化 / 説明文分離 / 分割禁止 / 見出し固定） |
| v1.3 | 2026-07-02 | Phase47-1完了反映 / 現在Phase = Phase47-1 / 次工程 = Claude APIコスト最適化（Priority 0） |
| v1.4 | 2026-07-02 | Phase48-3完了反映 / ChatGPT役割拡張（Version管理・Roadmapレビュー・docs整合性確認・Output/Preview品質レビュー・3Phase先まで考慮） / 現在Phase = Phase48-3 / 次工程 = Output Preview Engine（Priority 0） |
| v1.5 | 2026-07-02 | Phase49-0.1完了反映 / Version2以降の指示書作成ルール追加（AI Gateway・課金禁止・外部AI操作承認制の明記義務） / 現在Phase = Phase49-0.1 / 次工程 = AI Gateway Foundation（Priority 0） |
| v1.6 | 2026-07-04 | Phase49-6完了反映（Creative Engineファミリー完結） / Version1 Roadmap方針変更（Decision 039・Instagram収益化支援優先化）反映 / Phase50以降の指示書作成ルール追加 / 現在Phase = Phase49-6 / 次工程 = Phase50-1 Instagram Marketing Intelligence（Priority 0） |
