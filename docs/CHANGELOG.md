# CHANGELOG — ENBISOU AI COMPANY

> 本番反映済みの主要変更履歴（新しい順）。詳細は docs/02PHASE_PROGRESS.md を参照。

---

## Phase52-12.0a — ホーム案件タブ表示＋入力無効化 完了（2026-07-08・push前）

- Commit: **04e3a63**（`Phase52-12.0a home case tabs and disabled input`）
- 本番: **未反映（push前）**。ユーザー実ブラウザ確認OK + dev-check 200/200/200 で確認済み
- 変更ファイル: `index.html` のみ（追加のみ・**server.js / lib / DB / API / Workflow 無変更**・Phase53/cost混入なし）

### 内容
- **ホーム案件タブ表示**: `renderHomeCaseNav()` を新設し `goHome()` から呼び出し。ホーム画面でも Leader画面と同じ `case-nav`/`case-tab` UIで 🕒最新一覧＋各案件タブを表示（操作感統一）。click=`_homeOpenCase`/`_homeOpenCaseList`・案件0件時はタブ非表示・削除ボタンはホームに置かない（削除同期はPhase52-12.1）
- **ホーム入力欄無効化**: ホーム表示中は入力欄・送信ボタンを無効化（既存goHomeで成立）、placeholderを「ホームでは入力できません。案件を選択するか、新規案件を作成してください。」へ変更。Enterは既存 `sendMessage()` の `!currentMember` ガードで発火せず、案件を開くと `selectMember()` が再有効化
- **案件カード一覧は維持**: Phase52-12.0 のホーム案件カード一覧はそのまま。タブ・カード両方から案件を開ける

### 確認
- ユーザー実ブラウザ確認OK / dev-check 200/200/200 / node --check（インラインJS構文）OK
- 分離stage→commit `04e3a63`。ステージ/コミット差分の Phase53マーカー（oe-aic/affiliate/AFFILIATE_INTELLIGENCE）= 0件・cost系0件

### 温存
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は未コミット温存
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行）は Version2 まで保留

### 次工程（Phase52-12.1 案件削除同期・実装前に必ずユーザー承認）
- 実装候補: Supabase `cases` 削除API／1件削除同期／ホームカード削除ボタン／選択モード／チェックボックス表示／選択案件まとめて削除／削除確認ダイアログ／**messages は削除しない**。server.js / lib / DB / 新規削除APIを含むため **実装前に必ずユーザー承認**

---

## Phase52-12.0 — ホーム案件一覧化＋削除後挙動改善 完了（2026-07-07・push前）

- Commit: **7e1568c**（`Phase52-12.0 home case list and delete return behavior`）
- 本番: **未反映（push承認待ち）**。localhost + dev-check 200/200/200 で確認済み
- 変更ファイル: `index.html` のみ（追加のみ・**server.js / lib / DB / API / Workflow 無変更**・Phase53混入なし）

### 内容
- **ホーム案件一覧化**: 「🏠 ホーム」押下時、案件が1件以上あれば案件一覧カード（🕒最新一覧／各案件／＋新規案件）を表示。0件時は従来 empty-state を維持
  - 追加関数: `renderHomeCaseList()` / `_homeOpenCase()` / `_homeOpenCaseList()` / `_homeMakeCard()`（既存 `case-card` CSS・`getCasesForMember`・`selectMember`・`showNewCaseForm` を流用）
  - `goHome()` を案件一覧優先に変更（0件は従来 empty-state）
- **削除後挙動改善**（`deleteCase()` 末尾）: 案件が残っていれば毎回ホームへ戻さず連続削除しやすくする。**0件になった時のみ** `goHome()`。選択中だった案件を削除した時だけ古いチャットを出さず「案件一覧」ビューへ、それ以外は現在画面を維持

### 確認
- localhost 実画面確認（ホーム一覧／カード開く／連続削除／0件時empty-state）完了
- dev-check 200/200/200 / node --check（インラインJS構文）OK / 削除挙動スモークテスト OK
- commit `7e1568c` 内 Phase53マーカー（oe-aic / affiliate）= 0件

### 温存
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は未コミット温存
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行）は Version2 まで保留

### 既知の未対応（次工程で対応）
- **削除済み案件がリロードでSupabaseから復活**する件は **Phase52-12.1 案件削除同期** で対応予定
- **Phase52-12.1 は server.js / lib / 新規削除API を含むため、実装前に必ずユーザー承認が必要**
- **messages.case_id**（案件ごとの会話完全分離）は **Phase52-12.2** で調査・DB変更承認相談

### 次工程
- **push承認待ち**（`git push origin main` → Render本番自動デプロイ → curlで `renderHomeCaseList`/`oe-aic`=0 確認）→ その後 Phase52-12.1 案件削除同期（要承認）

---

## Phase52-11.9 — 案件メタデータSupabase同期 A案 完了（2026-07-07・push前）

- Commit: **1fff426**（`Phase52-11.9 sync case metadata via existing cases api`）
- 本番: **未反映（push承認待ち）**。localhost + dev-check 200/200/200 で確認済み
- 変更ファイル: `index.html` のみ（追加のみ・**server.js / lib / DB / API / Workflow 無変更**・Phase53混入なし）

### 内容（A案 = 既存 `/api/cases` 配線のみ）
- 案件メタデータ（案件一覧 / 案件タブ / caseId / title / userText / memberIds / updatedAt）を既存 `GET/POST /api/cases`（Supabase `cases` テーブル）経由で端末間同期
- 起動時 `syncCasesFromServer()` で `GET /api/cases` → 既存localStorage案件へ安全merge（updatedAtが新しい方を採用・local限定案件は削除しない）
- `createCase()` / `touchCase()` に `pushCaseToServer()` を追加し作成・更新時に `POST /api/cases`
- 追加関数（index.htmlのみ）: `_caseServerToLocal` / `_caseLocalToServer` / `mergeServerCases` / `syncCasesFromServer` / `pushCaseToServer`
- localStorage（`ai-company-cases-v1`）はキャッシュとして維持（逆戻りなし）

### 確認
- dev-check 200/200/200 / node --check（インラインJS構文）OK / mergeロジック スモークテスト OK
- `/api/cases` GET→POST→GET 往復で Supabase 永続化を実証（往復テスト行は削除済み）
- staged差分の Phase53マーカー（oe-aic / affiliate / AFFILIATE_INTELLIGENCE）= 0件

### A案の制約（未対応・仕様として許容）
- **template**: `cases` テーブルに列が無いため端末間同期対象外（各端末localStorage値を保持）
- **案件削除の端末間同期**: DELETE APIが無いためローカルのみ（他端末には残存し得る）
- **メッセージの案件別振り分け（端末間）**: `messages` に case_id 列が無いため、他端末では同期メッセージは caseId 無し＝最新一覧に表示（既存挙動）
- 上記は将来のB案（template列＋DELETE）/ C案（messages.case_id）で解消予定

### 温存
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は未コミット温存
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行）は Version2 まで保留

### 次工程
- **push承認待ち**（`git push origin main` → Render本番自動デプロイ → curlでマーカー確認 → PC⇔携帯実機同期確認）

---

## Phase52-11.8 — 案件管理UI Version1 完成（2026-07-07）

- Commit: **5faa3f6**（`Phase52-11.8 complete case creation and navigation UI`）
- 本番: **Render反映済み / Deploy live = 5faa3f6**（`ai-company-l45x.onrender.com`）
- 変更ファイル: `index.html` のみ（追加のみ・server.js/DB/API/Workflow無変更・Phase53混入なし）

### 内容
- ホーム追加（🏠 ホームへ戻る導線）
- ＋新規案件（テンプレ選択つき作成）
- 案件タブ（上部・クリック切替）
- 最新一覧（全案件ビュー・名称明確化「🕒 最新一覧」）
- 案件一覧画面（🕒 最新一覧クリックで案件カード一覧を表示）
- 案件カード（案件名/テンプレ/最終更新/直近メッセージ/担当）
- 案件カード「開く」
- 案件削除（一覧・タブ両方）
- 削除確認ダイアログ
- 案件更新順表示（最終更新日時の新しい順）
- PC改善
- Mobile改善

### 内訳サブフェーズ
- **11.8** 新規案件作成UI（`createNewCaseFromForm` / 既存 `createCase` 流用 / localStorage cases）
- **11.8b** ホーム復帰導線（`goHome`）
- **11.8c** 案件ナビ改善（案件タブ切替修正・最終更新順ソート・横スクロール・タブ削除）
- **11.8d** 最新一覧を案件カード一覧画面化（`renderCaseListScreen`）

### 確認
- PC確認完了 / 携帯確認完了 / 本番確認完了
- dev-check 200/200/200 / インラインJS構文エラー0

### 既知の未完成
- 案件メタデータ（案件一覧 / 案件タブ / caseId）は localStorage 専用 = 端末間で未同期（メッセージ本体は Supabase 同期済み）。次工程 **Phase52-11.9 案件メタデータSupabase同期調査**。

---

## Phase52-11.7 — 会話保存順の直列化（原因1修正）

- Commit: **20e4cbb**（`Phase52-11.7 serialize conversation save order`）／Render反映済み
- `sendMessage` の user/assistant `/api/messages` POST を直列化し、サーバー `created_at` を user → assistant 順に保証（表示順逆転の根本原因1を解消）。

---

## Phase52-11 〜 11.5 — Conversation Sync（Version1.1 第1工程）

- Commit: **18b1d00** ほか／Render反映済み
- PC/iPhone会話一致のための Conversation Sync 基盤（15秒poll＋visibilitychange＋担当切替pull）、timestamp正規化、最新50件取得、mergeServerHistory統一、Dedup強化・時系列Sort保証。
