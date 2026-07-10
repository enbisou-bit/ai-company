# CHANGELOG — ENBISOU AI COMPANY

> 本番反映済みの主要変更履歴（新しい順）。詳細は docs/02PHASE_PROGRESS.md を参照。

---

## Phase54-1e — Approval State Reset / Case Isolation（成果物単位で必ず未承認から開始・表示バグ修正・2026-07-10・commit済み・push未実施）

- Commit: **06d07d5**（`Phase54-1e approval state reset per output draft`）／Tag: **v1.01-phase54-1e**／**HEAD = 06d07d5・origin/main = b29be90・未Push 1**
- 本番: **未反映（push前）**。dev-check 200/200/200 / node --check 0エラー / ブラウザ起動時コンソールエラー0
- 変更ファイル: **`index.html` のみ**（+20・追加のみ・**server.js / DB / API変更なし / Phase54-1c同期非変更 / Phase54-1d `_mrcRerender`非変更 / Phase53非接触 / cost系非接触 / 課金なし**）

### 不具合 → 修正
- 不具合: 承認/レビュー/公開の状態が単一グローバル（`_mobileReviewState`/`_mobileApprovalState`/`_publishingReadyState`）で、新規案件・案件切替・新成果物生成でも初期化されず前状態を引き継ぎ「承認済み／投稿準備完了／『承認を取消』」が誤表示
- 目的（限定）: 承認対象は成果物（Output Draft）単位。新規案件・案件切替・新成果物生成では必ず未承認から開始
- 修正（index.htmlのみ・追加のみ）: 共通リセット関数 **`resetApprovalStatesToDefault()`** 新設（3状態を既定へ＋draftキャッシュ3種を無効化→次回再計算）。接続5境界＝`createOutputDraft`／`switchCase`・`_homeOpenCase`／`createCase`・`createNewCaseFromForm`。`pushApprovalToServer` 非呼出・`_approvalSyncLastLocalChangeAt` 不変（Phase54-1c非干渉）

### 非変更（安全）
- **Phase54-1c 同期7関数 非変更**（新規case行なし→GET 0件→復元なし→未承認維持）／**Phase54-1d `_mrcRerender` 非変更**／判定ロジック無変更
- 成果物単位永続化（output_id）は **Phase54-1f** へ分離（今後予定）

### 確認
- dev-check 200/200/200 / node --check 0エラー / 起動時コンソールエラー0 / 合成リセット検証（承認済み汚染→全既定化＋draftキャッシュnull＋`_approvalSyncLastLocalChangeAt`不変）/ Phase54-1c同期5関数健在・diff 0 / Phase54-1d `_mrcRerender` diff 0 / Phase53 `oe-aic` 67件維持
- ⚠️ 実ワークフローでの実操作確認（新規案件→新成果物→未承認／案件A→B切替で混入なし／同一案件の作り直しで未承認）は未実施（push/Render反映後にユーザー実機確認）

### 温存
- cost系3ファイル（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝未commit温存（Phase54-1e非接触・stageに含めず）

### 今後予定（Phase54-1f・別設計・要承認）
- 承認の成果物単位永続化：`output_approvals` に `output_id`/`draft_id` を追加し case_id単位→成果物単位へ拡張、Phase54-1c同期を output_id キーへ整合。DB/server.js/API/Supabase作業を伴うため Phase54-1e とは完全分離。同一案件・既存承認×新成果物の再承認（case_id単位GET復元の残課題）を恒久解決

---

## Phase54-1d — Mobile Approval Cache Fix（canApprove キャッシュ無効化漏れ修正・2026-07-10・commit済み・push未実施）

- Commit: **43513cc**（`Phase54-1d mobile approval cache fix`）／Tag: **v1.01-phase54-1d**／**HEAD = 43513cc・origin/main = 1574241・未Push 1**
- 本番: **未反映（push前）**。dev-check 200/200/200 / node --check 0エラー / ブラウザ起動時コンソールエラー0
- 変更ファイル: **`index.html` のみ**（+10・追加のみ・**server.js / DB / API変更なし / Phase54-1c同期非接触 / Phase53非接触 / cost系非接触 / 課金なし**）

### 不具合 → 修正
- 不具合: Mobile Review で承認済み（reviewStatus=approved）にしても Mobile Approval の「この内容で承認する」が disabled のまま（`canApprove` キャッシュ無効化漏れ。7項目チェックを1つ外して再チェックで解ける）
- 根本原因: `canApprove` を内包する `_lastOutputDraft.mobileApproval` は `_mapRerender()` でのみ再生成。Mobile Review の `_mrcRerender()` は `mobileReviewCenter` のみ更新し `mobileApproval` を無効化しない
- 修正（A案'・`_mrcRerender()` のみ・追加のみ）: **reviewStatus 変化時のみ `mobileApproval` を無効化**（新 `mobileReviewCenter.mobileApprovalInput.reviewStatus` と旧 `mobileApproval.summary.reviewStatus` を比較し異なる時だけ `mobileApproval = null`→次回描画で `createMobileApprovalDraft` 再計算）。スライド移動/前後/サムネ選択（reviewStatus不変）ではキャッシュ維持＝不要な再計算を回避

### 変更なし（安全）
- `createMobileApprovalDraft`/`canApprove`/`_mapAllChecked`/`_mapReviewApproved` ロジック・`_mobileApprovalState`（checklist/decision/approvedAt）は無変更。Phase54-1c 同期5関数 非接触・POST 非発火

### 確認
- dev-check 200/200/200 / node --check 0エラー / 起動時コンソールエラー0 / 合成ロジック検証（変化→無効化・同一→維持・ナビ→維持）/ Phase54-1c同期5関数健在 / Phase53 `oe-aic` 67件維持
- ⚠️ 実ワークフローでの実操作確認（承認→自動有効化／修正依頼→自動無効化）は未実施（push/Render反映後にユーザー実機確認）

### 温存
- cost系3ファイル（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝未commit温存（Phase54-1d非接触・stageに含めず）

---

## Phase54-1c — Approval Sync Client（承認/公開状態のPC⇔スマホ同期・クライアント配線・2026-07-09・commit済み・push未実施）

- Commit: **4f53dd5**（`Phase54-1c approval sync client`）／Tag: **v1.01-phase54-1c**／**HEAD = 4f53dd5・origin/main = 5bfaf6b・未Push 1**
- 本番: **未反映（push前）**。dev-check 200/200/200 / node --check 0エラー / ブラウザ起動時コンソールエラー0
- 変更ファイル: **`index.html` のみ**（+135 / -2・追加のみ・**server.js / DB / API変更なし / Phase53非接触 / cost系非接触 / 課金なし**）

### 目的
Phase54-1b の既存API（`GET/POST /api/approvals`）を index.html から利用し、承認/却下/公開/アーカイブ状態を case_id 単位で PC⇔スマホ同期（A案・単一グローバル状態を現在case_idへマッピング）。UI挙動・既存Output Engine描画は不変。

### 内容（index.htmlのみ・追加のみ）
- 追加関数7（`getCurrentApprovalCaseId` / `buildApprovalPayloadForServer` / `pushApprovalToServer` / `syncApprovalsFromServer` / `mergeApprovalStateFromServer` / `isRemoteApprovalNewer` / `scheduleApprovalSync`）＋追加変数3（`_approvalSyncInFlight`〔finallyで必ず解除〕/ `_approvalSyncLastLocalChangeAt` / `_approvalSyncLastReason`）＋定数 `APPROVAL_SYNC_EDIT_GUARD_MS=3000` / `APPROVAL_SYNC_CLIENT_VERSION='1.0.0'`
- push接続: 承認/却下/取消(空状態)/公開/アーカイブ/公開取消(空状態)の確定関数。pull接続: 起動時/案件切替(`switchCase`・`_homeOpenCase`)/`visibilitychange`
- 同期: case_id取得不可時スキップ（現状維持）・updated_atが新しい方採用・編集中3000msはローカル優先・通信失敗は既存UI維持

### 確認
- dev-check 200/200/200 / node --check 0エラー / 起動時コンソールエラー0 / 全7関数定義・定数一致 / 起動同期発火→`_approvalSyncInFlight`解除確認 / 既存API（cases・approvals）回帰なし / Phase53 `oe-aic` 67件維持
- ⚠️ PC⇔スマホ実機ラウンドトリップ（実POST）は未実施（push/Render反映後にユーザー実機確認）

### 温存
- cost系3ファイル（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝未commit温存（Phase54-1c非接触・stageに含めず）

---

## Phase54-1b — Approval Sync Server API（承認/公開状態のSupabase永続化・サーバー側・2026-07-09・push済み・Render反映済み）

- Commit: **d9310d0**（`Phase54-1b approval sync server api`）／**origin/main = HEAD = d9310d0 / 未Push 0**
- 本番: **Render反映済み**（`GET /api/approvals` 本番確認済み・既存API回帰なし・Phase53維持）
- 変更ファイル: **`server.js`（+2ルート+遅延ローダー）/ `lib/approvalsDb.js`（新規）**（追加のみ・**index.html変更なし / Phase53非接触 / cost系非接触 / 課金なし**）

### 目的
Version1.01 残同期の独立Phase（Decision 047）。承認（Mobile Approval）・公開（Publishing Ready）状態を case_id 単位で Supabase 永続化するサーバー基盤（A案・最小サブセット）。UI反映は Phase54-1c。

### DB変更（ユーザーがSupabase SQL Editorで実行済み・非破壊）
- **新規テーブル `output_approvals` のみ**（`case_id TEXT PRIMARY KEY` 他・**FKなし・nullable中心・既存テーブル無変更・データ移行なし**）＋RLS `output_approvals_all FOR ALL`。

### 内容（追加のみ）
- **lib/approvalsDb.js**（新規）: `upsertApproval`（onConflict: case_id）/ `getApprovals` / `getApproval(caseId)`
- **server.js**: 遅延ローダー `getApprovalsDb` ＋ `GET /api/approvals`（`?caseId=`任意）＋ `POST /api/approvals`（upsert・グローバルexpress.json依拠）

### 確認
- node --check 0エラー / dev-check 200/200/200 / GET /api/approvals 本番確認済み（source:db）/ POST /api/approvals localhost確認済み（`phase54-1b-test` 1件・往復成功・DELETE未実行）/ 既存 GET /api/cases 回帰なし

### 温存
- cost系3ファイル（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝未commit温存（Phase54-1b非接触）

---

## Phase53 — Affiliate Intelligence Core（Version2 Core先行搭載・2026-07-09・push済み・Render反映済み）

- Commit: **bcfba7d**（`Phase53 affiliate intelligence core base`）／**origin/main = HEAD = bcfba7d / 未Push 0**
- 本番: **Render反映済み**（HTTP 200・Phase53マーカー本番反映済み・既存機能マーカー維持）
- 変更ファイル: **`index.html` のみ**（追加のみ・+380行・**DB変更なし / server.js変更なし / API追加なし / Supabase操作なし / 課金なし**）

### 目的
Version2「Instagram Affiliate Intelligence Company」の中核となる器を Version1 に非破壊で先行搭載。16判断項目を手動入力で登録し、統合スコア＋おすすめ順位ランキング＋Leader統合判断を算出・Copy・Export。

### 内容（追加のみ・index.htmlのみ・5箇所）
- CSS `.oe-aic-*` ／ AIC関数群（`_affiliateCases`〔メモリ内・最大50件〕/ `recordAffiliateCase` / `buildAffiliateIntelligenceRanking` / `_aicIntegratedScore` / `_aicEstimate` / `buildAffiliateIntelligenceCoreHtml` 他・+356行）／ `renderOutputEnginePanel` に `_oeSafe` 経由で1行／ Export（JSON/Markdown）各1行（案件0件時は不出力＝既存Export不変）／ 4 Safetyバッジ固定

### 確認
- node --check 0エラー / dev-check 200/200/200 / 配信HTML Phase53搭載＋既存維持 / 新規ロジックsandbox正常 / ユーザー実ブラウザ目視OK / push後 Render本番マーカー反映・既存維持

### 開始条件（Decision 045 運用判断＝B案・Decision 047）
- Conversation / Case / Messages 中核同期完了をもってPhase53先行開始をユーザー承認（B案）。残同期（Task/Cost/Status/Auto Task poll・Learning一部in-memory整理・Approval端末間同期）は別Phase扱い。

### 温存
- cost系3ファイル（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝未commit温存（Phase53非接触）

---

## Phase52-12.2 — messages.case_id 案件別チャット分離（2026-07-08・push済み・Render反映済み）

- Commit: **aabf46c**（`Phase52-12.2 messages case id for per case chat separation`）
- 本番: **未反映（push前）**。dev-check 200/200/200 / node --check OK / 実ブラウザ確認OK
- 変更ファイル: `supabase/schema.sql` / `lib/conversationsDb.js` / `server.js` / `index.html`（追加のみ・非破壊・**Phase53/cost非接触**）

### 目的
案件ごとのチャット履歴をPC/スマホ間で分離する（従来 messages に案件情報が無く端末間で最新一覧に混在していた）。

### DB変更（ユーザーがSupabase SQL Editorで実行済み・非破壊）
```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS case_id TEXT;
```
nullable・FKなし・既存はNULL（移行なし）。messages/conversations非削除。

### 内容（追加のみ）
- **supabase/schema.sql**: messages に `case_id TEXT`（nullable・FKなし）
- **lib/conversationsDb.js**: `saveMessage({..., caseId})` で case_id 保存（未指定NULL）／`getMessages` select に `case_id`
- **server.js**: `POST /api/messages` で caseId 受領（`caseId || null`）。GETは case_id を返却
- **index.html**: 送信POST（user/assistant）に `caseId` 付与／`mergeServerHistory` norm＋サーバー→ローカル変換3箇所で `case_id` 保持。`getFilteredHistory` 無変更（caseIdで案件別自動分離）

### 確認
- node --check（server.js・conversationsDb.js・index.htmlインラインJS）0エラー / dev-check 200/200/200
- localhost 読み取りGET: `GET /api/messages` 応答に `case_id`（既存はNULL＝後方互換）/ 実ブラウザ確認OK
- API往復テスト・DBテストデータ作成なし

### 既存挙動維持
- 既存messages（case_id=NULL）は「最新一覧」に表示継続。未更新端末はNULL保存（後方互換）

---

## Phase52-12.1b — F5/ログイン直後のホーム案件一覧0件表示 修正（2026-07-08・commit前・push前）

- Commit: **未commit**／本番: **未反映**。dev-check 200/200/200 / node --check OK / **実ブラウザ確認OK**
- 変更ファイル: `index.html` のみ（追加のみ・server.js/lib/DB/API/Workflow無変更・**Phase53/cost非接触**）

### 不具合
- F5更新直後 / ログイン直後にホーム案件一覧が0件表示になる（Leader移動→ホーム復帰で復活）。データ消失ではなくタイミング問題

### 原因
- `syncCasesFromServer()`（Supabase同期・非同期）が同期完了後、`currentMember` がある時のみ `renderCaseNav()` を再描画し、ホーム表示中（`currentMember=null`）は再描画していなかった

### 修正（index.htmlのみ・追加のみ）
- `syncCasesFromServer()` 完了時、ホーム表示中なら `renderHomeCaseList()`＋`renderHomeCaseNav()` を再描画。既存 `renderCaseNav`（担当選択中）パスは無変更、案件0件は既存 empty-state 維持、try/catch保護
- F5直後・ログイン直後どちらでも、案件同期完了後にホーム案件一覧が正しく再描画される

### 確認
- node --check（index.htmlインラインJS）0エラー / dev-check 200/200/200 / **実ブラウザ確認OK**
- server.js/lib/DB/API変更なし・Phase53/cost非接触・API往復テスト/DBテストデータ作成なし

---

## Phase52-12.1a — 選択削除UI 追加改善 実装完了（2026-07-08・commit前・push前）

- Commit: **未commit**／本番: **未反映**。dev-check 200/200/200 / node --check OK。**実ブラウザ実操作確認はユーザー確認項目**
- 変更ファイル: `index.html` のみ（追加のみ・server.js/lib/DB/API/Workflow無変更・**Phase53/cost非接触**）

### 内容（追加のみ・UI統一）
- 共通ビルダー `_buildCaseSelectBar()` でホーム・Leaderの選択ツールバーを統一（☑選択／全選択／全解除／🗑選択削除(n件)）
- **全選択 / 全解除**（ホーム・Leader両方）
- **Leader画面の選択削除**: `renderCaseListScreen` に選択モード・チェックボックス・一括削除（`_clSelectMode`/`_clSelectAll`/`_clDeselectAll`/`_clBulkDelete` 他）追加
- **選択削除バー上部固定**: 新CSS `.case-select-bar { position:sticky; top:0; z-index:6 }`
- **ホーム案件タブ×削除**: `renderHomeCaseNav` を `case-tab-wrap`+`case-del-btn` でLeaderと統一（× で `_homeDeleteCase`）
- 個別削除ボタン維持 ／ **messages・conversations 非削除**（cases のみ削除）

### 確認
- node --check 0エラー / dev-check 200/200/200 / localhost配信HTML反映（HTTP 200）
- **実ブラウザ実操作確認はユーザー確認項目**（API往復テスト・DBテストデータ作成は不実施方針）

### DB/安全
- DBスキーマ変更なし・API追加なし（`DELETE /api/cases/:id` 流用）・課金なし・Phase53/cost非接触

---

## Phase52-12.1 — 案件削除Supabase同期 実装完了（2026-07-08・commit前・push前）

- Commit: **未commit**（承認後に分離stage→commit）
- 本番: **未反映**。dev-check 200/200/200 / node --check OK。**実ブラウザ実操作確認はユーザー確認項目**
- 変更ファイル: `server.js` / `lib/casesDb.js` / `index.html`（すべて追加のみ・**DBスキーマ変更なし**・Phase53/cost非接触）

### 目的
ホームから案件を削除した際に Supabase `cases` も同期削除し、リロードで復活しないようにする。

### 内容（追加のみ）
- **lib/casesDb.js**: `deleteCase(id)` 追加（`supabase.from('cases').delete().eq('id', id)`・id完全一致1件・未設定時error返却）
- **server.js**: `DELETE /api/cases/:id` 追加（id必須→`deleteCase`。**messages/conversationsは削除しない**）
- **index.html**: `deleteCaseFromServer()` 新設／既存 `deleteCase()` にサーバ削除1行追加／ホームカード「🗑 削除」ボタン＋ `_homeDeleteCase()`／選択モード（`_homeSelectMode`）＋「☑ 選択」トグル／チェックボックス／一括削除 `_homeBulkDelete()`／削除確認ダイアログ

### 確認
- dev-check 200/200/200 / node --check（server.js・casesDb.js・index.htmlインラインJS）0エラー
- **実ブラウザ実操作確認はユーザー確認項目**（作成→ホーム削除→Supabase同期→リロード復活なし・PC/スマホ）。DB書込/削除のAPI往復テストは実施しない方針

### DB/安全
- DBスキーマ変更なし（既存`cases`＋RLSで削除可）。API追加＝`DELETE /api/cases/:id` 1本。課金なし
- messages/conversations非削除（`cases`は会話テーブルから参照されておらず波及しない）
- 既知の制約: 他端末localStorageの自動prune（クロス端末即時反映）は未実装（誤削除回避）

### 温存
- cost関連 / Phase53 Affiliate Intelligence Core は未コミット温存

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
