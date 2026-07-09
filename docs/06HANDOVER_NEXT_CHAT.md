# 06HANDOVER_NEXT_CHAT.md

# ENBISOU AI COMPANY - 次チャット引き継ぎ書

更新日: 2026-07-10（Phase54-1d Mobile Approval Cache Fix Complete・commit 43513cc・tag v1.01-phase54-1d・push未実施）

---

## 【現在地・最優先】Phase54-1d Mobile Approval Cache Fix Complete（Mobile Approval canApprove キャッシュ無効化漏れ修正・commit済み・push未実施）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-1d Complete**／本番: **未反映（push前）**
- Commit: **43513cc**（`Phase54-1d mobile approval cache fix`）／Tag: **v1.01-phase54-1d**／**HEAD = 43513cc・origin/main = 1574241・未Push 1**
- 変更ファイル: **`index.html` のみ**（+10・追加のみ・**server.js / DB / API変更なし / Phase54-1c同期非接触 / Phase53非接触 / cost系非接触 / 課金なし**）

### 現在地
**Phase54-1d Mobile Approval Cache Fix = コードcommit完了（push前）**。Mobile Review で承認済み（reviewStatus=approved）にした後、Mobile Approval の「この内容で承認する」ボタンが自動で有効にならない **canApprove キャッシュ無効化漏れ**を修正。`_mrcRerender()` のみ・追加のみ（A案'）。

### 不具合 → 修正
- **不具合**: `canApprove` を内包する `_lastOutputDraft.mobileApproval` は `_mapRerender()`（Mobile Approval自身の操作）でしか再生成されず、Mobile Review の `_mrcRerender()` は `mobileReviewCenter` のみ更新→ reviewStatus が approved になっても Mobile Approval のボタンが disabled 固定（7項目の1つを外して再チェックで解ける）
- **修正（A案'）**: `_mrcRerender()` に「**reviewStatus 変化時のみ `mobileApproval` を無効化**」する分岐を追加。新 reviewStatus（`mobileReviewCenter.mobileApprovalInput.reviewStatus`）と旧（`mobileApproval.summary.reviewStatus`）を比較し異なる時だけ `mobileApproval = null`（次回 `buildMobileApprovalHtml`→`createMobileApprovalDraft` 再計算で canApprove 追従）。**スライド移動/前後/サムネ選択（reviewStatus不変）ではキャッシュ維持＝不要な再計算を回避**。修正依頼で reviewStatus が変化した場合も自動無効化

### 変更していないもの（安全策）
- `createMobileApprovalDraft`/`canApprove`/`_mapAllChecked`/`_mapReviewApproved` ロジック無変更／`_mobileApprovalState`（checklist/decision/approvedAt）不変（7項目チェック・承認済み状態を保持）
- Phase54-1c 同期5関数（push/sync/merge/schedule/getCurrentApprovalCaseId）非接触・無効化経路から **POST 非発火**

### 確認済み
- ✅ dev-check 200/200/200 / node --check 0エラー / インラインJS parse OK
- ✅ 起動時コンソールエラー0 / `_mrcRerender`・`_mapRerender` 健在 / Phase54-1c同期5関数 typeof function
- ✅ 合成ロジック検証：reviewStatus 変化→無効化 / 同一→維持 / ナビ相当→維持 / Phase53 `oe-aic` 67件維持
- ⚠️ 実ワークフローでの実操作確認（承認→自動有効化／修正依頼→自動無効化）は成果物draft生成（API課金）を伴うため未実施（push/Render反映後にユーザー実機確認）

### 温存（未コミット）
- cost関連（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝**未commit温存**（Phase54-1d非接触・stageに含めず）

### 次工程
- **docs commit（別commit・要承認）→ push（origin/main同期・要承認）→ Render反映 → 実機確認**。その後：残同期の別Phase（Task/Cost/Status/Auto Task poll・index.htmlのみ）または Phase54系Intelligence（Market Opportunity 等）

---

## 【参考・完了済み】Phase54-1c Approval Sync Client Complete（承認/公開状態のPC⇔スマホ同期・クライアント配線・commit済み・push未実施）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-1c Complete**／本番: **未反映（push前）**
- Commit: **4f53dd5**（`Phase54-1c approval sync client`）／Tag: **v1.01-phase54-1c**／**HEAD = 4f53dd5・origin/main = 5bfaf6b・未Push 1**
- 変更ファイル: **`index.html` のみ**（+135 / -2・追加のみ・**server.js / DB / API変更なし / Phase53非接触 / cost系非接触 / 課金なし**）

### 現在地
**Phase54-1c Approval Sync Client = コードcommit完了（push前）**。Phase54-1b の既存API（`GET/POST /api/approvals`）を index.html から利用し、承認/却下/公開/アーカイブ状態を **case_id 単位で PC⇔スマホ同期**（A案・単一グローバル状態を現在case_idへマッピング）。UI挙動・既存Output Engine描画は不変。**Approval Sync Client 完成**。

### 実装（index.htmlのみ・追加のみ）
- 追加関数7: `getCurrentApprovalCaseId`（現在案件優先→`_lastOutputDraft.caseId`補助→無ければnull=同期スキップ）/ `buildApprovalPayloadForServer` / `pushApprovalToServer`（fire-and-forget）/ `syncApprovalsFromServer`（GET・finallyで`_approvalSyncInFlight`必ず解除＝解除漏れ防止）/ `mergeApprovalStateFromServer` / `isRemoteApprovalNewer` / `scheduleApprovalSync`（マイクロタスク遅延でTDZ回避・多重実行防止）
- 追加変数3: `_approvalSyncInFlight` / `_approvalSyncLastLocalChangeAt` / `_approvalSyncLastReason`。定数: `APPROVAL_SYNC_EDIT_GUARD_MS=3000` / Version `APPROVAL_SYNC_CLIENT_VERSION='1.0.0'`
- push接続（実名）: `approveInstagramPackage`/`rejectMobileApproval`/`cancelApproval`(空状態)/`markInstagramPublished`/`archivePublishingReady`/`resetPublishingReadyStatus`(空状態)。`toggleApprovalCheck` はガード起点更新のみ（push対象外）
- pull接続: 起動時（`syncCasesFromServer()`直後）/ `switchCase`・`_homeOpenCase`（案件切替）/ `visibilitychange`
- 同期仕様: case_id取得不可時スキップ（ephemeral維持）・updated_atが新しい方採用・古い状態で上書きしない・編集中3000msはローカル優先・取消/公開取消は空状態POST（case未確定時POSTしない）・通信失敗は既存UI維持・反映時のみ `_mapRerender`/`_prcRerender`（`_oeSafe`保護）

### 確認済み
- ✅ dev-check 200/200/200 / node --check 0エラー / インラインJS 2ブロックparse OK
- ✅ ブラウザ起動時コンソールエラー0 / 全7関数 typeof function / 定数一致 / 起動同期発火（reason=startup）→ `_approvalSyncInFlight=false`（解除漏れ防止が実機で機能）/ `isRemoteApprovalNewer` 新旧判定正常
- ✅ 既存API `GET /api/cases`・`GET /api/approvals` 回帰なし / Phase53 `oe-aic` 67件維持・`buildAffiliateIntelligenceCoreHtml` 健在
- ⚠️ **PC⇔スマホ実機ラウンドトリップ（実POST書き込み）は未実施**（実DBへ勝手にテストデータ作成しない方針。push/Render反映後にユーザー実機確認）

### 温存（未コミット・保護対象すべて維持）
- cost関連（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝**未commit温存**（Phase54-1c非接触・stageに含めず）
- テストデータ `phase54-1b-test` 1件が `output_approvals` に残存（DELETE禁止のため保持・case_id一致時のみ同期対象）

### 次工程
- **docs commit（別commit・要承認）→ push（origin/main同期・要承認）→ Render反映 → 実機PC⇔スマホ同期確認**。その後：残同期の別Phase（Task/Cost/Status/Auto Task poll・index.htmlのみ）または Phase54系Intelligence（Market Opportunity 等）

---

## 【参考・完了済み】Phase54-1b Approval Sync Server API Complete（承認/公開状態のSupabase永続化・サーバー側・push済み・Render反映済み）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-1b Complete**／本番: **Render反映済み**
- Commit: **d9310d0**（`Phase54-1b approval sync server api`）／**origin/main = HEAD = d9310d0 / 未Push 0**
- 変更ファイル: **`server.js`（+2ルート+ローダー）/ `lib/approvalsDb.js`（新規）**（追加のみ・**index.html変更なし / Phase53非接触 / cost系非接触 / 課金なし**）

### 現在地
**Phase54-1b Approval Sync（サーバー側）= 本番反映完了**。承認（Mobile Approval）・公開（Publishing Ready）状態を **case_id 単位で Supabase 永続化**するAPIを用意（A案・最小サブセット）。`GET/POST /api/approvals` 本番稼働。**UI反映は未実装＝Phase54-1c**（54-1b時点でUI未接続のため既存挙動は完全に不変）。

### DB / 実装
- **新規テーブル `output_approvals` のみ**（FKなし・nullable中心・非破壊・RLS `FOR ALL`）。**Supabase SQL はユーザー実行済み**。
- `lib/approvalsDb.js`（新規・upsert/get）＋ server.js（遅延ローダー＋GET/POST）。POSTはグローバルexpress.json依拠。

### 確認済み
- ✅ node --check 0エラー / dev-check 200/200/200 / **GET /api/approvals 本番確認済み**（source:db）/ **POST localhost確認済み**（`phase54-1b-test` 1件・往復成功・DELETE未実行）/ 既存 `GET /api/cases` 回帰なし / Phase53維持

### 温存（未コミット・保護対象すべて維持）
- cost関連（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝**未commit温存**（Phase54-1b非接触）
- テストデータ `phase54-1b-test` 1件が `output_approvals` に残存（DELETE禁止のため保持）

### 次工程（Phase54-1c index.html 同期配線）
- `pushApprovalToServer(caseId)`（`approveMobileApproval`/`rejectMobileApproval`/`markAsPublished`/`archive` 等の確定時にPOST・fire-and-forget）
- `syncApprovalsFromServer()`（起動/case切替/visibilitychange時にGET→`updated_at`新しい方でmerge→`_mobileApprovalState`/`_publishingReadyState`反映→`renderOutputEnginePanel`再描画・`_oeSafe`保護）
- index.htmlのみ・追加のみ・Output Engine中核状態を扱うため回帰注意（中リスク）。実装前にユーザー承認。

---

## 【参考・完了済み】Phase53 Affiliate Intelligence Core Complete（Version2 Core先行搭載・push済み・Render反映済み）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase53 Complete**／本番: **Render反映済み**
- Commit: **bcfba7d**（`Phase53 affiliate intelligence core base`）／**origin/main = HEAD = bcfba7d / 未Push 0**
- 変更ファイル: **`index.html` のみ**（追加のみ・+380行・**DB変更なし / server.js変更なし / API追加なし / Supabase操作なし / 課金なし**）

### 現在地
**Phase53 Affiliate Intelligence Core = 本番反映完了**。Version2「Instagram Affiliate Intelligence Company」の中核（16判断項目の器・統合スコア・おすすめ順位ランキング・Leader統合判断）を Version1 に非破壊で先行搭載。`_affiliateCases` はメモリ内のみ（localStorage/DB非依存）・4 Safetyバッジ固定（No Real API / Manual Input Only / Prediction Heuristic Only / Read Only）。既存Workflow/Provider/Realtime Sync/Learning 無変更。

### 確認済み
- ✅ node --check 0エラー / dev-check 200/200/200 / 配信HTML Phase53搭載＋既存維持 / 新規ロジックsandbox正常 / ユーザー実ブラウザ目視OK / push後 Render本番マーカー反映・既存維持

### 開始条件（Decision 045 運用判断＝B案・Decision 047）
- **Conversation / Case / Messages 中核同期完了をもってPhase53先行開始をユーザー承認**（B案）。
- **残同期は別Phase扱い**（未完了）: Task/Cost/Status/Auto Task 自動更新poll（index.htmlのみ）／Learning一部in-memory整理／**Approval端末間同期（server.js/DB/API検討要・独立Phase）**。

### 温存（未コミット・保護対象すべて維持）
- cost関連（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝**未commit温存**（Phase53非接触）

### 次アクション候補
- 残同期の別Phase着手（Task/Cost/Status/Auto Task poll化＝index.htmlのみ）、またはApproval端末間同期の独立Phase設計（server.js/DB要検討・要承認）、またはPhase54（Market Opportunity Intelligence）。

---

## 【参考・完了済み】Phase52-12.2 Committed（messages.case_id 案件別チャット分離・push済み・Render反映済み）

- 現在Version: **Version1 / Phase52-12.2 code commit完了（push前）**／本番: **未反映（push前）**
- Commit: **aabf46c**（`Phase52-12.2 messages case id for per case chat separation`）
- dev-check 200/200/200 / node --check OK / 実ブラウザ確認OK

### 現在地
**Phase52-12.2 code commit完了（push前）**。案件ごとのチャットをPC/スマホ間で分離するため `messages.case_id` を追加。**追加のみ・非破壊・Phase53/cost非接触**。

### DB変更（ユーザーがSupabase実行済み・非破壊）
```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS case_id TEXT;
```
nullable・FKなし・既存はNULL（移行なし）。messages/conversations非削除。

### 実装（4ファイル・追加のみ）
- **supabase/schema.sql**: messages に `case_id TEXT`（nullable・FKなし）
- **lib/conversationsDb.js**: `saveMessage(caseId)` 保存／`getMessages` select に `case_id`
- **server.js**: `POST /api/messages` で caseId 受領（GETは自動で case_id 返却）
- **index.html**: 送信POSTに `caseId` 付与／merge 4箇所（norm・restore・担当切替補完・syncCurrentMember）で `case_id` 保持。`getFilteredHistory` 無変更

### 確認済み / 未確認
- ✅ node --check 0エラー / dev-check 200/200/200 / localhost GET応答に `case_id`（既存はNULL＝後方互換）/ 実ブラウザ確認OK
- API往復テスト・DBテストデータ作成なし

### 既存挙動維持
- 既存messages（case_id=NULL）は「最新一覧」に表示継続（`getFilteredHistory` の `|| !h.caseId`）

### 温存（未コミット）
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行・Version2まで保留）

### 次アクション
- **push承認待ち**（docs commit → `git push origin main` → Render自動デプロイ → curlで `case_id` 反映・`oe-aic`=0 確認）

---

## 【参考・完了済み】Phase52-12.1b Fixed（F5/ログイン直後のホーム案件一覧0件表示 修正・実ブラウザ確認OK・commit前・push前）

- 現在Version: **Version1 / Phase52-12.1b 修正完了（未commit）**／本番: **未反映**
- dev-check 200/200/200 / node --check OK / **実ブラウザ確認OK**

### 不具合 → 修正
- **不具合**: F5更新直後 / ログイン直後にホーム案件一覧が0件表示（Leader移動→ホーム復帰で復活）。データ消失ではなくタイミング問題
- **原因**: `syncCasesFromServer()`（Supabase同期・非同期）が同期完了後、`currentMember` がある時のみ `renderCaseNav()` 再描画し、ホーム表示中（`currentMember=null`）は再描画していなかった
- **修正**: `syncCasesFromServer()` 完了時、ホーム表示中なら `renderHomeCaseList()`＋`renderHomeCaseNav()` を再描画（既存 `renderCaseNav` パス無変更・0件は empty-state 維持・try/catch保護）。**index.htmlのみ・追加のみ**

### 確認
- ✅ node --check 0エラー / dev-check 200/200/200 / **実ブラウザ確認OK**
- server.js/lib/DB/API 変更なし・Phase53/cost非接触・API往復テスト/DBテストデータ作成なし

### 次アクション
- 承認 → 分離stage（server.js/lib/casesDb.js/index.htmlのPhase52-12.1＋12.1a＋12.1b分のみ・Phase53/cost除外）→ commit → docs commit → push → Render確認

---

## 【参考・完了済み】Phase52-12.1a Implemented（選択削除UI 追加改善・実装完了・commit前・push前）

- 現在Version: **Version1 / Phase52-12.1a 実装完了（未commit）**／本番: **未反映**
- dev-check 200/200/200 / node --check OK / localhost配信反映OK。**実ブラウザ実操作確認はユーザー確認項目**

### 現在地
**Phase52-12.1a 実装完了（index.htmlのみ・追加のみ・UI統一）**。選択削除UIの追加改善。server.js/lib/DB/API/Workflow 無変更・**Phase53/cost非接触**。

### 実装（index.htmlのみ）
- 共通ビルダー `_buildCaseSelectBar()`（☑選択／全選択／全解除／🗑選択削除(n件)）でホーム・Leaderの選択UIを統一
- **全選択/全解除**（ホーム: `_homeSelectAll`/`_homeDeselectAll`／Leader: `_clSelectAll`/`_clDeselectAll`）
- **Leader画面**(`renderCaseListScreen`)に選択モード・チェックボックス・一括削除（`_clSelectMode`/`_clBulkDelete` 他）追加
- **選択削除バー上部固定**（新CSS `.case-select-bar { position:sticky; top:0 }`）
- **ホーム案件タブ×削除**（`renderHomeCaseNav` を `case-tab-wrap`+`case-del-btn` でLeaderと統一・× で `_homeDeleteCase`）
- 個別削除ボタン維持／messages・conversations 非削除（cases のみ削除）

### 確認済み / 未確認
- ✅ node --check 0エラー / dev-check 200/200/200 / localhost配信HTML反映（HTTP 200）
- ⏳ **実ブラウザ実操作確認はユーザー確認項目**（選択モード・全選択・全解除・一括削除・タブ×・個別削除・スクロール時の上部固定バー・リロード復活なし・PC/スマホ）

### DB/安全
- **DBスキーマ変更なし・API追加なし**（`DELETE /api/cases/:id` 流用）・課金なし・Phase53/cost非接触

### 温存（未コミット）
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行・Version2まで保留）

### 次アクション
- 実ブラウザ実操作確認 → 承認 → 分離stage（server.js/lib/casesDb.js/index.htmlのPhase52-12.1＋12.1a分のみ・Phase53/cost除外）→ commit → docs commit → push → Render確認

---

## 【Run許可範囲・要約】（2026-07-08・詳細は docs/03CLAUDE_RULES.md「18. Run許可範囲」）

- **停止不要でまとめて実行OK**: git status / git diff / grep / node --check / dev-check / localhost・Render GET確認 / HTML取得 / 構文・静的確認 / 調査 / 実装 / docs下書き更新
- **必ず停止して承認**: git add(分離stage) / git commit / git push / Render本番反映 / DBスキーマ変更 / Supabase直接操作 / POST・DELETE等のDB書込自動APIテスト / テストデータ自動作成 / npm install / 環境変数・APIキー / 課金・契約 / 判断に迷う操作
- **検証ルール**: 実DBへ勝手にテストデータ作成しない・POST→DELETE自動round-tripテスト禁止・確認は原則localhost実ブラウザ操作優先・DB書込テストは承認後のみ

---

## 【参考・完了済み】Phase52-12.1 Implemented（案件削除Supabase同期・実装完了・commit前・push前）

- 現在Version: **Version1 / Phase52-12.1 実装完了（未commit）**
- Commit: **未commit**（承認後に分離stage→commit）／本番: **未反映**
- dev-check 200/200/200 / node --check OK。**実ブラウザ実操作確認はユーザー確認項目**（API往復テストは実施しない方針・Decision的運用）

### 現在地
**Phase52-12.1 実装完了（未commit）**。ホーム案件削除をSupabase `cases` へ同期削除（リロード復活の解消）。**server.js / lib/casesDb.js / index.html を変更（追加のみ・DBスキーマ変更なし）**・Phase53/cost非接触。

### 実装（追加のみ）
- **lib/casesDb.js**: `deleteCase(id)`（`cases` を id完全一致1件のみ削除。messages/conversations不変）
- **server.js**: `DELETE /api/cases/:id`（id必須→`deleteCase`。messages/conversations非削除）
- **index.html**: `deleteCaseFromServer()` 新設／既存 `deleteCase()` にサーバ削除1行追加／ホームカード「🗑 削除」＋ `_homeDeleteCase()`／選択モード `_homeSelectMode`＋「☑ 選択」トグル／チェックボックス／一括削除 `_homeBulkDelete()`／削除確認ダイアログ

### 確認済み / 未確認
- ✅ dev-check 200/200/200 / node --check（server.js・casesDb.js・index.htmlインラインJS）0エラー
- ⏳ **実ブラウザ実操作確認はユーザー確認項目**（案件作成→ホーム削除→Supabase同期→リロード復活なし・PC/スマホ）

### DB/安全
- **DBスキーマ変更なし**（既存`cases`＋RLSで削除可）。API追加＝`DELETE /api/cases/:id` 1本。課金なし。messages/conversations非削除（設計上cases削除は波及しない）
- 既知の制約: 他端末localStorageの自動prune（クロス端末即時反映）は未実装（誤削除回避）。削除操作端末はリロード復活なし

### 温存（未コミット）
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行・Version2まで保留）

### 次アクション
- 実ブラウザ実操作確認 → 承認 → 分離stage（本Phase分のみ・Phase53/cost除外）→ commit → docs commit → push → Render確認

---

## 【参考・完了済み】Phase52-12.0a Complete（ホーム案件タブ表示＋入力無効化 完了・push前）

- 現在Version: **Version1 / Phase52-12.0a Complete**（ホーム案件タブ表示＋入力無効化）
- Commit: **04e3a63**（`Phase52-12.0a home case tabs and disabled input`）
- 本番: **未反映（push前）**。ユーザー実ブラウザ確認OK + localhost + dev-check 200/200/200

### 現在地
**Phase52-12.0a 完了（index.htmlのみ・追加のみ）**。ホーム画面に案件タブを表示（Leader画面と操作統一）＋ホーム入力欄を無効化。案件カード一覧（12.0）は維持。**server.js / lib / DB / API / Workflow 無変更**・Phase53/cost混入なし。

### 実装（index.htmlのみ）
- `renderHomeCaseNav()` 新設（既存 `case-nav`/`case-tab` UI流用）。ホームで 🕒最新一覧＋各案件タブを表示。click=`_homeOpenCase`/`_homeOpenCaseList`（switchCaseはcurrentMember依存のため不使用）。案件0件時はタブ非表示。削除ボタンはホームに置かない（削除同期はPhase52-12.1）
- `goHome()` に `renderHomeCaseNav()` 呼び出し追加＋placeholderを「ホームでは入力できません。案件を選択するか、新規案件を作成してください。」へ変更
- 入力欄/送信ボタンの disabled は既存 `goHome()` で成立・Enterは既存 `sendMessage()` の `!currentMember` ガードで発火しない・案件を開くと `selectMember()` が再有効化（既存挙動）

### 確認済み
- ユーザー実ブラウザ確認OK（案件タブ表示／タブ・カードから開く／入力無効／指定文言）
- dev-check 200/200/200 / node --check OK
- 分離stage→commit `04e3a63`。ステージ/コミット差分の Phase53マーカー（oe-aic/affiliate/AFFILIATE_INTELLIGENCE）= 0件・cost系0件

### 温存（未コミット）
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行・Version2まで保留）

### 次工程（Phase52-12.1 案件削除同期・実装前に必ずユーザー承認）
- 実装候補: Supabase `cases` 削除API（server.js 削除ルート）／1件削除の端末間同期／**ホームカードの削除ボタン**／**選択モード**／**チェックボックス表示**／**選択案件まとめて削除**／削除確認ダイアログ／**messages は削除しない**
- **server.js / lib / 新規削除API / DB操作を含むため実装前に必ずユーザー承認**。安全条件＝id完全一致1件のみ削除・messages非削除・削除確認ダイアログ維持
- 現状の未対応制約: 削除済み案件がリロードでSupabaseから復活（Phase52-12.1で解消予定）

### 次アクション
- **push承認待ち** → 承認後 `git push origin main` → Render本番自動デプロイ → curlで `renderHomeCaseNav`/`oe-aic`=0 確認

---

## 【参考・完了済み】Phase52-12.0 Complete（ホーム案件一覧化＋削除後挙動改善 完了・push前）

- 現在Version: **Version1 / Phase52-12.0 Complete**（ホーム案件一覧化＋削除後挙動改善）
- Commit: **7e1568c**（`Phase52-12.0 home case list and delete return behavior`）
- 本番: **未反映（push承認待ち）**。localhost 実画面確認 + dev-check 200/200/200 で確認済み

### 現在地
**Phase52-12.0 完了（index.htmlのみ・追加のみ）**。ホーム画面の案件一覧化と、案件削除後の画面挙動改善。**server.js / lib / DB / API 無変更**・Phase53混入なし。

### 実装（index.htmlのみ）
- `renderHomeCaseList()` / `_homeOpenCase()` / `_homeOpenCaseList()` / `_homeMakeCard()` 追加（既存 `case-card` CSS・`getCasesForMember`・`selectMember`・`showNewCaseForm` を流用）
- `goHome()` を案件一覧優先に変更（案件≥1件→ホーム一覧、0件→従来 empty-state）
- `deleteCase()` 末尾: **0件時のみ** `goHome()`／残あれば連続削除しやすく画面維持（選択中案件削除時のみ `__caselist__` ビューへ・古いチャット非表示）

### 確認済み
- localhost 実画面確認（ホーム一覧／カード開く／連続削除／0件時empty-state）完了
- dev-check 200/200/200 / node --check OK / 削除挙動スモークテスト OK
- commit `7e1568c` 内 Phase53マーカー = 0件（分離ステージで3hunkのみcommit）

### 温存（未コミット）
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）
- docs更新（01 / 06 / CHANGELOG・本更新分。commitは別途承認）
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行・Version2まで保留）

### 次工程（Phase52-12.x）
- **Phase52-12.1 案件削除同期**: 案件タブの×削除を Supabase `cases` からも削除し、リロードで復活しないようにする。**server.js（削除ルート追加）+ lib/casesDb.js（delete関数追加）+ 新規削除API + index.html配線**を含むため **実装前に必ずユーザー承認が必要**。安全条件=id完全一致1件のみ削除・会話履歴(messages)は削除しない・削除確認ダイアログ維持。クロス端末prune（他端末自動反映）は誤削除リスクのため方針決定後に別途
- **Phase52-12.2 messages.case_id**: 案件ごとの会話完全分離。`messages.case_id` 列追加（DBスキーマ変更）+ conversationsDb + server.js + index.html。**DBスキーマ変更承認が必要**。今回は調査・計画のみ
- 現状の未対応制約: **削除済み案件がリロードでSupabaseから復活**（Phase52-12.1で解消予定）

### 次アクション
- **push承認待ち** → 承認後 `git push origin main` → Render本番自動デプロイ → curlで `renderHomeCaseList`/`oe-aic`=0 確認

---

## 【参考・完了済み】Phase52-11.9 Complete（案件メタデータSupabase同期 A案 完了・push前）

- 現在Version: **Version1 / Phase52-11.9 Complete**（案件メタデータSupabase同期 A案）
- Commit: **1fff426**（`Phase52-11.9 sync case metadata via existing cases api`）
- 本番: **未反映（push承認待ち）**。localhost + dev-check 200/200/200 で確認済み

### 現在地
**Phase52-11.9 完了（A案・既存 `/api/cases` 配線のみ）**。案件メタデータ（案件一覧 / 案件タブ / caseId / title / userText / memberIds / updatedAt）を既存 `GET/POST /api/cases`（Supabase `cases`）で端末間同期。`index.html`のみ・追加のみ・**server.js / lib / DB / API 無変更**・Phase53混入なし。

### 実装（index.htmlのみ・追加関数5つ）
- `syncCasesFromServer()`（起動時 `loadCases()` 直後・GET→安全merge・失敗時localStorage継続）
- `mergeServerCases()`（updatedAtが新しい方を採用・localのtemplate保持・local限定案件は削除しない）
- `pushCaseToServer()`（`createCase()` と `touchCase()` から `POST /api/cases`）
- `_caseServerToLocal()` / `_caseLocalToServer()`（DB行↔local変換）

### 確認済み
- dev-check 200/200/200 / node --check OK / mergeスモークテスト OK
- `/api/cases` GET→POST→GET 往復で Supabase 永続化を実証（往復テスト行 `case-test-1783421436` は削除済み）
- commit `1fff426` 内 Phase53マーカー = 0件（分離ステージで4hunkのみcommit）

### A案の制約（未対応・仕様として許容 / 将来B案・C案で解消）
- **template**: `cases` に列なし → 端末間同期対象外（localStorage値を保持）
- **案件削除の端末間同期**: DELETE APIなし → ローカルのみ
- **メッセージの案件別振り分け（端末間）**: `messages` に case_id 列なし → 他端末では最新一覧に表示（既存挙動）

### 温存（未コミット）
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）
- docs更新（01 / 06 / CHANGELOG・本更新分。commitは別途承認）
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行・Version2まで保留）

### 次工程
- **push承認待ち** → 承認後 `git push origin main` → Render本番自動デプロイ → curlで `Phase52-11.9`/`oe-aic` マーカー確認 → PC⇔携帯実機同期確認

---

## 【参考・完了済み】Phase52-11.8 Complete（案件管理UI Version1 完成・本番反映済み）

- 現在Version: **Version1 / Phase52-11.8 Complete**（案件管理UI Version1 完成）
- 本番Commit: **5faa3f6** / Render: **反映済み / Deploy live = 5faa3f6**（`ai-company-l45x.onrender.com`）

### 現在地
**Phase52-11.8 完了**（11.8 新規案件作成UI / 11.8b ホーム復帰導線 / 11.8c 案件ナビ改善 / 11.8d 最新一覧を案件カード一覧画面化）。index.htmlのみ・追加のみ・dev-check 200/200/200・インラインJS構文エラー0。

### 確認済み
- PC / 携帯 / ホーム / 新規案件 / 最新一覧 / 案件カード / 開く / 削除 / 削除確認 / 案件切替 — すべて正常（本番確認完了）

### 同期状況
- **Supabase同期済み**: メッセージ / 会話履歴
- **未同期**: 案件一覧 / 案件タブ / caseId（現状 localStorage 専用）

### 現在仕様（案件メタデータ）
- PC案件 → 携帯へ同期しない
- 携帯案件 → PCへ同期しない
- ※メッセージ本体は Supabase 同期される

### 現在未コミット（作業ツリー温存）
- `cost-logs.json`
- `docs/01PROJECT_STATUS.md`（今回更新）
- `docs/06HANDOVER_NEXT_CHAT.md`（今回更新）
- `docs/CHANGELOG.md`（今回新規）
- `claude-cost-logs.json`
- `claude-quality-history.json`
- `index.html` の **Phase53 Affiliate Intelligence Core（約+380行）** — 未ステージ / Version2まで保留

### 次Phase
**Phase52-11.9 案件メタデータSupabase同期**（※まだ開始していない）。
次チャットでは **調査のみ・実装禁止**。既存 `/api/cases`（server.js既存）や `conversations` テーブルの活用可否、caseId同期方式、DBスキーマ変更要否（要ならユーザー承認）、既存localStorage案件との移行整合を調査し、報告→承認後に実装。

---

## 【参考・完了済み】Phase52-11 Conversation Sync（Version1.1 Connected AI Company 第1工程）

> 本番Commit: **18b1d00** / 本番URL `ai-company-l45x.onrender.com` は **Phase52-11.5 まで反映済み**。
> Version1.1「Connected AI Company」の目的＝PC / iPhone / 将来PWA で同一状態のAI会社にする。その第1工程が Conversation Sync。

### これまでに実装・本番反映済み（すべて本番デプロイ完了）

| Phase | 内容 | Commit |
|-------|------|--------|
| Phase52-11 | Conversation Sync 基盤（15秒poll＋visibilitychange＋担当切替pull・既存GET/POST /api/messages再利用・Supabase Realtime不使用・localStorageはキャッシュ維持） | ec86b1a |
| Phase52-11.1 | timestamp正規化（`normalizeMessageTime`）＋merge重複判定を数値比較化（+00:00 と Z の形式差吸収） | ec86b1a同梱 |
| Phase52-11.2 | `lib/conversationsDb.js` `getMessages()` を **最新50件取得**へ（降順取得→昇順返却）。古い50件で頭打ちする問題を解消 | 0e2c2b1 |
| Phase52-11.3 | 表示同期の原因調査（Supabase env未接続＝Render環境変数不足を特定→ユーザーがRenderへ `NEXT_PUBLIC_SUPABASE_URL`/`NEXT_PUBLIC_SUPABASE_ANON_KEY` 追加で接続復旧・`/api/cases` が `source:db` 化） | 調査 |
| Phase52-11.4 | 復元3経路（F5復元 / 担当切替pull / 15秒poll）をすべて **`mergeServerHistory()` に統一**。REPLACE方式（srvLatest>localLatestの丸ごと置換）を廃止＝取りこぼし解消 | 4d5d714 |
| Phase52-11.5 | Dedup強化（sender一致＋content強正規化〔全角空白→半角/連続空白・改行→1つ/trim〕＋時刻許容 **3秒→10秒**）＋**自己重複除去**（既存localStorageの重複も掃除）＋時系列Sort保証 | 18b1d00 |

### 現状（正常）
- Conversation保存(POST) 正常 / 取得(GET) 正常 / Supabase接続 正常 / Merge 正常 / Dedup 実装済み / Render反映 正常

### 現在残っている問題（未解決・調査中）
Conversation Sync自体は動作しているが、**PCブラウザのみ表示順が崩れるケース**がある：
- AI返信が表示されないことがある
- F5後に表示位置が変わる
- AI返信が質問より先に表示される
- 「質問→返信→更新→質問」のような並びになる
- iPhone側は正常表示のケースあり

→ 保存ではなく **PC描画 / 表示順 / Render(表示) 周辺**の可能性が高い。

### 次チャットで最優先＝原因調査のみ（修正禁止）
以下①〜⑦のどこで順番が崩れるかをログで切り分け、**100%特定してからのみ修正する**：
① 保存 ② 取得 ③ Merge ④ Dedup ⑤ Sort ⑥ `renderChatArea()`/`reRenderChatArea()` ⑦ `buildChatHtml()`（バブル描画）
- 既知の別課題候補: 案件フィルタ（特定案件タブ選択時に caseId無し同期メッセージが `getFilteredHistory` で非表示）／メッセージにidが無くdedupが content+時刻ヒューリスティック依存（`getMessages` が id未取得）

### Version1.1 Connected AI Company 優先順位
① **Conversation Sync 完成**（現在ここ・PC表示順のみ残） → ② Task Sync → ③ Connected AI Company 完成 → ④ Instagram運用開始 → ⑤ A8.net等ASP登録 → ⑥ Learning蓄積 → ⑦ Version2 Affiliate Intelligence

### Version1完了条件（変更しない）
PC・iPhone両方で **Conversation / Task / Workflow / Learning / Approval / Publishing** がすべて正常同期すること。その後 Instagram自動運用へ移行する。

### Phase53（Affiliate Intelligence）の扱い
- Phase53コードは作業ツリー（index.html 未ステージ +380行）に存在するが、**正式Versionへは反映禁止・Version2まで保留・未着手扱い**。
- 各Phase52-11コミットは Phase53 を混ぜず分離stage（`git apply --cached` でhunk限定）で実施済み。作業ツリーの Phase53 / cost-logs.json / claude-cost-logs.json / claude-quality-history.json は温存。

---

## 【最重要】Version1 Final Complete（Phase52-10・運用可能な完成版）

- **Version1 = Final Complete**。正式Version **v1.00-phase52-10**。最新コミット **f177fd2**（Phase52-8-9 mobile topbar unified scroll）
- Mobile Topbar（52-8/52-9/52-9b）を **Render本番反映完了**（`ai-company-l45x.onrender.com` = f177fd2）＋ **iPhone Safari実機確認完了**（縦向き・横向きともTopbar 1本横スクロール・全ボタン操作可能・入力/送信可能・横はみ出しなし・PC不変）
- Version1は「機能完成」だけでなく **運用可能な完成版**として正式完成（Decision 044）。Manual Only維持
- **次工程 = Version1.01 Realtime Sync Edition**（PC/iPhoneで同一状態のAI会社。Task/Conversation/Timeline/Notification/Workflow Live/Cost/Learning/Approval/Auto Task/Status を **Supabase同期**）
- **Version2（Affiliate Intelligence / Phase53）は Version1.01 完成後に開始**する（Decision 045）。Version2着手前にRealtime同期を優先する。**Phase53開始前に必ずユーザー確認を取ること**
- 作業ツリー: Phase53 Affiliate Intelligence Core（index.html未ステージ +380行）は**未着手で温存**。cost-logs.json / claude-cost-logs.json / claude-quality-history.json は方針未決定のまま据え置き
- Phase52-10はdocsのみ更新（コード変更なし）

---

## 【Version2 全体設計 正式反映済み（Decision 043）】

- Version2テーマ: **Instagram Affiliate Intelligence Company**（何を売れば利益が最大かをAI会社全体が判断）
- Version2 Core = **Affiliate Intelligence Core（7層Intelligence）**: ① Market Opportunity → ② Product → ③ ASP → ④ Competition → ⑤ Revenue → ⑥ Content → ⑦ Self Improvement Intelligence
- AI Gateway正式構成: `Leader → Affiliate Intelligence → AI Gateway → { OpenAI / Claude / Browser Automation / PC Automation / 将来API }`（最も低コストで最適な実行方法を自動選択。実行系は承認ゲート維持）
- 到達目標16項目・Phase配分（Phase53 Core → 〜 Phase62 Leader Integration）は [docs/04ROADMAP.md](04ROADMAP.md)「Version2 Core 全体設計」/ Decision 043 参照
- **次工程: Phase53 Affiliate Intelligence Core**（index.html追加のみ・既存無変更・予測ヒューリスティック＋手動入力・Safetyバッジ固定・実API/課金/自動投稿/server.js変更/DB変更なし）
- 設計反映のみ完了。実装は未着手

---

## 【Mobile UI（Phase52-5 / 52-6）実装済み・本番反映済み】

- **Phase52-5 Mobile UI Final Polish**: `<meta viewport>`に`viewport-fit=cover`追加＋`@media (max-width:768px)`で`#topbar-quick`横スクロール化・`#topbar-right` max-width:46vw・safe-area余白・`html{overflow-x:hidden}`。スマホ表示品質向上（機能追加なし・PC不変）。
- **Phase52-6 Mobile Touch Hotfix**: 52-5の`html{overflow-x:hidden}`がiOS Safariでタッチ/横スクロール/入力を阻害したため補正（`html{overflow-x:visible}`＝body/#mainのoverflow:hiddenで横スクロール抑制は担保／`#topbar-quick`・`#mega-menu-nav`にtouch-action:pan-x＋-webkit-overflow-scrolling／入力欄・送信のpointer-events/touch-action復旧）。
- 変更: `index.html`のみ・追加のみ・PC不変。詳細は [docs/02PHASE_PROGRESS.md](02PHASE_PROGRESS.md)「Phase52-5 / 52-6」参照。
- **Git: コミット `a983c35 "Phase52-5-6 mobile ui polish and touch hotfix"` / Tag `v1.00-phase52-6-mobile-ui` / push済み → Render本番反映済み**（`ai-company-l45x.onrender.com`）。

---

## 【Mobile Topbar UI（Phase52-8 / 52-9 / 52-9b）】

- iPhone上部バーを段組み＋1本の横スクロールへ再設計（`index.html`のみ・PC不変・追加のみ）。詳細は [docs/02PHASE_PROGRESS.md](02PHASE_PROGRESS.md)「Phase52-8 / 52-9 / 52-9b」参照。
- 実装: HTMLラッパ `#tb-scroll`（PCは`display:contents`透過）＋ `@media (max-width:768px),(pointer:coarse)` CSS ＋ JS `buildMobileTopbar()`（モバイル時に9ボタンを`#mobile-quickbar`へ実体移動＝1本の横スクロール）。ブラウザ実描画375pxで9ボタン統合・末尾到達を実測。
- 本番反映: **分離ステージ済み（Topbar 5ハンク・232行）。コミット予定 `Phase52-8-9 mobile topbar unified scroll` → `git push origin main`（force無し/`--tags`無し）→ Render**。Phase53(+380)・Version2設計docs・cost-logsは**未コミットで温存**。
- 本番URL `ai-company-l45x.onrender.com` は現状 `a983c35`（Phase52-5/6）まで＝上部バー再設計は**未反映**。デプロイ後に実機確認が必要。

---

## 【最重要】Version1 完成・運用フェーズ（Phase52-2記録）

- **Version1 = 完成**。現在Version **v1.00-phase52-2** / 現在フェーズ **Version1 Documentation Complete**
- **Instagram収益化を最優先**（Decision 039）。Version1のInstagram収益化パイプラインは全工程実装完了（市場分析→企画→カルーセル生成→デザイン設計→レビュー→承認→投稿準備→手動投稿→Learning→Asset Library候補生成）
- **現在は運用フェーズ**。次チャットは新機能追加より先に、まず**実運用（実際のInstagram投稿）を開始**することを最優先とする
- **新機能追加前に実運用開始**。Version2（Asset Library実保存 / Learning永続化 / Instagram分析高度化 / TikTok / YouTube Shorts / LP連携 / AI自動改善）はVersion1運用が回り始めてから着手する
- Version1の正式仕様（Decision 041）: Instagram APIは使用しない / 手動投稿が正式仕様 / Learningは投稿後に手入力 / Asset Libraryは表示のみ（実保存はVersion2）
- 完成9機能: Instagram Marketing Intelligence / Instagram Content Planning / Instagram Carousel Builder / Instagram Design System / Mobile Review Center / Mobile Approval / Publishing Ready Center / Instagram Learning Center / Creative Asset Library Save Center（すべてindex.htmlへ追加のみ・既存無変更）
- 最新Tag: **v1.00-phase52-3**（Phase50-2〜52-1の各Tag: v1.00-phase50-2 〜 v1.00-phase52-1 / Phase52-2 docs記録 / Phase52-3 運用開始記録）

### Version1 実運用フェーズ（Phase52-3記録・最重要）

- **Version1は完成済み**（運用開始日 2026-07-04・Decision 042）。現在Version **v1.00-phase52-3** / Current **Version1 Operational**
- 現在は次を最優先とする：
  1. **Instagram実運用**（実際の投稿）
  2. **Learningデータ蓄積**（投稿後に実績を手入力）
  3. **Asset Library候補蓄積**
- **Claude Code停止中（クレジット不足等）は開発を停止し、Instagram運営 / A8登録 / 市場分析 / アカウント育成 を進める**
- **Version2開始時は Affiliate Intelligence（Phase53）を最優先で実装する**（複数ASP比較: 利益率/Instagram適性/競合/季節性/承認率/投稿ネタ数/収益期待値。対象ASP: A8.net / もしもアフィリエイト / afb / アクセストレード / バリューコマース / 楽天アフィリエイト / Amazonアソシエイト）
- 新機能追加より先に、まず実運用を開始する

---

## このファイルの使い方

次チャット開始時に最初に読む。
現在地・絶対ルール・次にやることが全てここに入っている。

---

## 現在バージョン

**v1.00-phase49-6**（Creative Asset Library・既存Asset管理層のみ）

最新Tag: `v1.00-phase49-6`

補足: `v1.00-phase47-1.6` はPhase48-4完了後に発見された過去の未コミット差分（OpenAI費用トラッカーの累計対応）を正式化した**遡及タグ**。作成日時の順序と機能の進行フェーズ番号は一致しない（Phase47-1系の一部）。詳細はPHASE_PROGRESS.mdのPhase47-1.6セクション・Decision 025（04DECISIONS.md）を参照。

---

## 現在地

**Phase49-6 Complete**
**Creative Engine Family Completed**（Phase49-1〜49-6の全8サブフェーズ完了）

Phase48-5（Publishing Engine）完了＝**Version1機能完成**。
Phase49-0（Version2設計レビュー）〜Phase49-6（Creative Asset Library）完了。

Version2は6ファミリー（Creative Engine / Intelligence / Sales / Automation / Business Intelligence / Company Brain v2）へ責務分離型で再構成済み（Decision 027）。Phase49-1〜49-5でAI Gateway一式・Image/Video Prompt Intelligence・Creative Execution・Creative Ad Assembly、Phase49-6でCreative Asset Library（既存6関数の呼び出しのみでAssetを管理・分類・コピー・Export。新規判断なし）を追加した（Decision 030〜037）。Decision 038でCreative Engineの完成範囲（Planning/Assembly/Libraryまで。Executionは今後の承認フェーズ）を正式確定。

**Version1 Roadmap方針変更（Decision 039）**: Version1の最優先目的をInstagram収益化支援へ変更した。AI会社はInstagram運用を最初の実運用対象とする。Manual Only方針は維持する（画像生成・動画生成・投稿はユーザー承認後の手動実行のみ）。Version1完成基準は「Instagramを毎日運用できること」（市場調査→テーマ決定→保存率が高い構成提案→スライド構成→画像プロンプト→動画プロンプト→投稿文→CTA→ハッシュタグ→Creative Assembly→Asset Library保存を5分以内で完了）へ変更した。詳細は docs/04ROADMAP.md「Version1 最優先ゴール」を参照。

**Phase50-1 — Instagram Marketing Intelligence 完了**（Decision 040）: `createInstagramMarketingIntelligenceDraft()`で保存率/リーチ/プロフィール遷移/フォロー率/CTA/ハッシュタグ/投稿時間/カルーセル/リールの予測ヒューリスティック分析（0〜100点、既存Publishing/Creative Ad Assemblyを読み取り参照）、競合/トレンドの手動リサーチ用チェックリスト、`recordInstagramResult()`/`submitInstagramResultEntry()`による手動実績入力（保存率/リーチ/プロフィール遷移/フォロー率/CV、`_instagramResultHistory` max30・3件以上で平均集計）を実装。`renderOutputEnginePanel()`内`buildCreativeAssetLibraryHtml`直後に表示。Markdown/JSON Export反映済み。実Instagram API接続・自動投稿・自動課金なし（4 Safetyバッジ固定）。dev-check 200/200/200・ブラウザ実機確認済み。Tag: `v1.00-phase50-1`

次工程: **Instagramマネタイズシステムの残り7ステップ**（ユーザー最優先方針・2026-07-04）: ① Content Planning ② Carousel Builder ③ Image Layout Engine（背景画像＋文字レイアウト済みのカルーセル品質を目指す）④ iPhone成果物確認画面 ⑤ iPhone承認機能 ⑥ 投稿予約 ⑦ Instagram運用開始。画像生成・投稿はユーザー承認後のみ・無断投稿禁止・自動課金禁止・既存機能削除禁止・追加のみ。

AI Gateway・Image Prompt Intelligence・Video Prompt Intelligence・Creative Execution・Creative Ad Assembly・Creative Asset Library（`createCreativeAssetLibraryDraft()`）は全て判断層/プロンプト生成層/実行計画層/組み立て層/管理層のみで、実際の画像/動画生成・投稿・API実行・PC操作・ブラウザ自動操作は一切行っていない。Creative Asset Libraryは常時5つのSafetyバッジ（Asset Library Only/No External Execution/No AI Generation/Manual Reuse Only/Read Only）を表示し、favorite/archiveは常にfalse（新規永続化なし）。

画像生成・動画生成・外部AI操作（PCアプリ操作/ブラウザ操作含む）は引き続きユーザー承認後のみ実行可能。git pushは引き続き禁止。

未追跡ファイル `claude-cost-logs.json` / `claude-quality-history.json` は引き続き方針未決定のまま据え置き（Decision 025参照）。

---

## 完了済みPhase一覧

| Phase | 内容 | Tag |
|-------|------|-----|
| Phase43 | Workflow Live完成版（Progress Bar / Timeline / 再表示ボタン） | v0.97 |
| Phase44 | Output Engine（13種タイプ / Packageビュー / Export UI） | v0.98 |
| Phase45-0 | Output Schema v1.0 | v0.98-phase45-0 |
| Phase45-1 | Quality Engine v1（evaluateOutputQuality） | v0.98-phase45-1 |
| Phase45-2 | Learning Engine v1（extractLearningItems） | v0.98-phase45-2 |
| Phase45-3 | Company Memory基盤 | v0.98-phase45-3 |
| Phase45-4 | Knowledge Candidates準備 | v0.98-phase45-4 |
| Phase45-5 | Knowledge承認UI + Recommendation Engine | v0.98-phase45-5 |
| Phase45-6A〜D | Knowledge保存 + 重複防止 | v0.98-phase45-6D |
| Phase45-7 | Knowledge Inject（Workflow開始時に自動取得） | v0.98-phase45-7 |
| Phase45-8 | Phase45完了判定 | v0.99 |
| Phase46-1 | Knowledge Injection Preview強化 | v1.00-phase46-1 |
| Phase46-2 | Leader Intelligence Upgrade（Execution Guide） | v1.00-phase46-2 |
| Phase46-3 | Knowledge Compare Mode（3モード切替） | v1.00-phase46-3 |
| Phase46-4 | 実案件テストログ / 品質比較記録 | v1.00-phase46-4 |
| Phase46-5 | Compare Intelligence v1 | v1.00-phase46-5 |
| Phase46-6 | Compare Recommendation Engine v1 | v1.00-phase46-6 |
| Phase46-7 | Compare Quality Integration Check v1 | v1.00-phase46-7 |
| Phase46-8 | Compare Intelligence v2（Improvement Score / Failure Analysis / Learning / Summary） | v1.00-phase46-8 |
| Phase47-1 | API料金メーター（OpenAI+Claude統合 / Provider別 / 永続保存 / 右上ヘッダー合計） | v1.00-phase47-1 |
| Phase47-2A | Claude Cost Analysis（モデル別・担当別料金/トークン分析） | v1.00-phase47-2A |
| Phase47-2B | Claude Model Policy（Writer/Reviewer=最安 / Strategy=最高品質へ最適化） | v1.00-phase47-2B |
| Phase47-2C | Claude Model Quality Compare（最適化前後の比較） | v1.00-phase47-2C |
| Phase47-2D | Claude Model Formal Adoption（モデルポリシー正式採用） | v1.00-phase47-2D |
| Phase47-3 | Claude Quality Monitor（Compare Intelligence連携の品質監視） | v1.00-phase47-3 |
| Phase47-4 | Claude Quality History（時系列品質監視・Trend/Warning） | v1.00-phase47-4 |
| Phase47-S | Claude APIコスト最適化トラック v1.00 Stable確定 | v1.00-stable |
| Phase47-5 | Claude Quality History永続化（claude-quality-history.json） | v1.00-phase47-5 |
| Phase48-1 | Output Package Quality Checklist（成果物完成度0〜100点） | v1.00-phase48-1 |
| Phase48-2 | Output Template Enhancement（全11タイプへフィールド拡張） | v1.00-phase48-2 |
| Phase48-3 | Output Auto Fill Engine（Leader Final/Writer/Strategy/Designerから自動反映） | v1.00-phase48-3 |
| Phase48-3.1 | docs正式反映 / Roadmap新設 | v1.00-phase48-3.1 |
| Phase48-3.2 | docs全体整合性確認・強化 | v1.00-phase48-3.2 |
| Phase48-4 | Output Preview Engine（Instagram/LP/チラシ/PDF/HTML/TikTok/YouTube Shortsの完成イメージ表示） | v1.00-phase48-4 |
| Phase47-1.6 | OpenAI費用トラッカー累計対応の正式化（Phase48-4完了後に発見した未コミット差分を検証・コミット、遡及記録） | v1.00-phase47-1.6 |
| Phase48-5 | Publishing Engine（10タイプでタイトル/説明文/ハッシュタグ/投稿時間/画像・動画一覧/CTA/チェックリスト自動生成） | v1.00-phase48-5 |
| Phase49-0 | Version2設計レビュー（コード変更なし。責務整理・AI Gateway/Asset Library案・Creative Engine再構成案・Company Brain v2分割案） | （タグなし・レビューのみ） |
| Phase49-0.1 | Version2 Roadmap Formalization（レビュー内容をdocsへ正式反映。コード変更なし） | v1.00-phase49-0.1 |
| Phase49-1 | AI Gateway Foundation（AI Skill Registry 13ツール・Gateway判断・安全ゲート・UI/Copy/Export、判断層のみ・実行なし） | v1.00-phase49-1 |
| Phase49-1.1 | AI Registry Expansion（Capability/Health/Cost/Approval/Route Priority/Version Registryを追加、既存12フィールドは無変更） | v1.00-phase49-1.1 |
| Phase49-1.2 | AI Registry Learning（実績ベースのrecommendationScore/confidence算出、`learning`オブジェクト追加。recordAIRegistryLearning()は呼び出し関数のみ・自動呼び出しなし） | v1.00-phase49-1.2 |
| Phase49-2 | Image Prompt Intelligence（GPT Image/ChatGPT Image/Midjourney/Flux/Ideogram/Recraft向けプロンプト自動生成。Output Type別最適化・AI Gateway連携。画像生成は未実行） | v1.00-phase49-2 |
| Phase49-3 | Video Prompt Intelligence（Seedance/Flow/Veo/Kling/Runway/Luma/Pika/Hailuo/DOMOAI向けプロンプト自動生成。Output Type別最適化・AI Gateway/Image Prompt Intelligence連携。動画生成は未実行） | v1.00-phase49-3 |
| Phase49-4 | Creative Execution（実行計画・コピー・チェックのみ。16ツール対応Tool Planner。autoExecute=false固定・Manual Only。既存判断ロジックは無変更で参照のみ） | v1.00-phase49-4 |
| Phase49-5 | Creative Ad Assembly（広告素材セットの組み立てのみ。Headline/Caption/CTA/Visual Direction/Assets Plan。Assembly Only固定・既存Engine判断ロジックは無変更で参照のみ） | v1.00-phase49-5 |
| Phase49-6 | Creative Asset Library（既存6関数の呼び出しのみでAsset管理・分類・コピー・Export。Read Only固定・新規判断なし。Creative Engineファミリー完結） | v1.00-phase49-6 |

---

## AI会社の最終目的（最重要）

ENBISOU AI COMPANY は「チャットを返すAI」ではない。

**完成した成果物を大量生産し、会社全体が学習し、品質が毎回向上していくAI会社**を作る。

成果物例：
- Instagram: スライド10枚 + キャプション + CTA + ハッシュタグ
- TikTok: 企画 + 台本 + 画像プロンプト + 動画プロンプト
- チラシ: コピー + デザイン指示 + 画像プロンプト
- LP: 構成 + コピー + HTML + CTA

---

## 絶対ルール（変更禁止）

```
・既存機能は壊さない
・削除禁止
・追加のみ
・リファクタ禁止
・新規API追加禁止（明示的許可なし）
・DBスキーマ変更禁止
・npm install禁止
・Workflow変更禁止
・AI社員ルーティング変更禁止
・Provider設定変更禁止（Leader=OpenAI / Writer・Reviewer・Strategy=Claude）
・localStorageへ戻さない
・git push禁止（ユーザー確認必須）
・dev-check 200/200/200維持
・コミットメッセージはASCII短文1行（日本語・括弧・改行禁止）
```

---

## 課金禁止ルール

以下は絶対に勝手にやらない：
- API契約・有料サービス・サブスク・課金
- 外部有料API連携
- SNS投稿連携（承認なし）
- 画像生成（プロンプト作成はOK / 実行はユーザー承認後）
- 動画生成（同上）

---

## SNS自動投稿は後回し

現時点では自動投稿を実装しない。

まず「投稿直前まで」の成果物品質を高める：
- 画像生成プロンプト（自動OK）
- 動画生成プロンプト（自動OK）
- 投稿文 / ハッシュタグ / CTA / 構成（自動OK）
- 実際の画像・動画生成（ユーザー承認後）
- SNS投稿（ユーザー承認後 / 現時点では実装しない）

---

## 画像・動画生成は承認制

- 画像生成プロンプト：自動で生成してOK
- 実際の画像生成API呼び出し：ユーザー承認後のみ
- 動画生成：ユーザー承認後のみ
- 外部API・有料サービス連携：必ずユーザー承認制

---

## Phase46-4までの重要機能（次チャットが把握すべき実装）

### Workflow
- `atRunWorkflow()` — Workflow開始 / Knowledge取得 / Guide生成 / Leaderへ注入
- `getRoutedKnowledgeContext('leader') + getInjectedKnowledgeContext()` → Leader contextへ連結

### Output Engine
- `buildOutputDraftFromLeaderFinal(finalText)` — Leader Final後にquality / learning / memory / knowledge を連鎖生成
- `renderOutputEnginePanel()` — Output Engineパネル描画

### Knowledge Chain（Phase45）
- `evaluateOutputQuality()` → `extractLearningItems()` → `createCompanyMemoryCandidates()` → `createKnowledgeCandidatesFromMemory()`
- `approveKnowledgeCandidate(id, action)` — 承認/保留/却下
- `saveApprovedKnowledgeCandidates(draft)` — /api/knowledge-library へPOST（approved候補のみ）
- `isKnowledgeDuplicate(candidate)` / `_knowledgeSaveHistory`（max50）

### Knowledge Inject（Phase45-7 / 46-1 / 46-2）
- `fetchKnowledgeForOutputType(outputType)` — /api/knowledge-library GET
- `selectRelevantKnowledge(items, outputType, sourceText)` — max5件
- `buildLeaderExecutionGuide(knowledgeItems, outputType)` — cta/structure/brand/avoid/priorities分類
- `_lastInjectedKnowledge[]` / `_lastLeaderExecutionGuide`

### Knowledge Compare（Phase46-3）
- `KNOWLEDGE_COMPARE_MODE` — with_knowledge / without_knowledge / guide_only
- `_knowledgeCompareMode` — 現在のモード（デフォルト: with_knowledge）
- `switchKnowledgeCompareMode(mode)` — 切替関数
- `getInjectedKnowledgeContext()` — モード別でLeaderへの注入を制御

### Compare Log（Phase46-4）
- `_knowledgeCompareLog[]` — 比較ログ（max30件 / セッション内）
- `recordKnowledgeCompareEntry(draft)` — Leader Final完了時に自動記録
- `getCompareSummaryByMode()` — モード別平均スコア集計
- `buildCompareLogHtml()` — Output Engineパネルに比較ログ表示
- Export（markdown/json）に比較ログ自動反映

### Compare Intelligence（Phase46-5）
- `COMPARE_INTELLIGENCE_VERSION = '1.0.0'`
- `_lastCompareIntelligence` — 最新分析結果を保持
- `analyzeCompareIntelligence()` — Compare Log を分析し _lastCompareIntelligence に保存
- `getCompareModeWinner(summary)` — 最も平均スコアが高い mode を返す
- `getOutputTypeCompareInsights(summary)` — outputType別傾向を集計
- `getKnowledgeInjectionImpact(summary)` — 注入あり/なしの差分を分析
- `buildCompareIntelligenceHtml()` — Output Engine に分析結果を表示
- `appendCompareIntelligenceToExportMarkdown(lines)` — Markdown Export に追記
- `appendCompareIntelligenceToExportJson(payload)` — JSON Export に追記

### Compare Recommendation（Phase46-6）
- `COMPARE_RECOMMENDATION_VERSION = '1.0.0'`
- `_lastCompareRecommendations` — 最新改善提案を保持
- `buildCompareRecommendations(summary)` — Intelligence から priorityItems / knowledgeRecommendations / outputTypeRecommendations / reviewerHints / learningHints / cautionItems を生成
- `getCompareRecommendationPriority(item)` — high / medium / low を判定
- `buildCompareRecommendationHtml()` — Output Engine に改善提案パネルを表示
- `appendCompareRecommendationToExportMarkdown(lines)` — Markdown Export に追記
- `appendCompareRecommendationToExportJson(payload)` — JSON Export に `compareRecommendations` として追加

### Compare Quality Integration Check（Phase46-7）
- `COMPARE_INTEGRATION_CHECK_VERSION = '1.0.0'`
- `_lastCompareIntegrationCheck` — 最新チェック結果を保持
- `buildCompareIntegrationCheck()` — Log/Intelligence/Recommendation の統合整合性チェック / checklist(7項目) / nextTestActions / cautionItems を生成
- `getCompareIntegrationStatus(check)` — ready / partial / insufficient を判定（ログ3件以上 + 2モード + Recommendations ありで ready）
- `buildCompareIntegrationCheckHtml()` — Output Engine に Integration Check パネルを表示（READY/PARTIAL/INSUFFICIENT バッジ付き）
- `appendCompareIntegrationCheckToExportMarkdown(lines)` — Markdown Export に追記
- `appendCompareIntegrationCheckToExportJson(payload)` — JSON Export に `compareIntegrationCheck` として追加

### Compare Intelligence v2（Phase46-8）
- `COMPARE_IMPROVEMENT_VERSION = '2.0.0'`
- `buildCompareFailureAnalysis()` — Hook/CTA/Knowledge/Structure/Images/OutputType/Length 失敗率分析 → `_lastCompareFailureAnalysis`
- `buildImprovementScores()` — 5カテゴリ 0〜100点スコア → `_lastImprovementScores`
- `buildCompareLearning()` — SUCCESS/FAIL/QUALITY/IMPROVEMENT 4パターン分類 → `_lastCompareLearning`
- `buildLeaderImprovementSummary()` — 「今回改善すべきポイント」テキスト生成 → `_lastLeaderImprovementSummary`
- HTML: `buildImprovementScoreHtml()` / `buildCompareFailureAnalysisHtml()` / `buildCompareLearningHtml()` / `buildLeaderImprovementSummaryHtml()`
- `appendImprovementToExportMarkdown(lines)` / `appendImprovementToExportJson(payload)` — Export自動反映

---

## 次にやること

### Priority 0（最新）: Version1.01 Realtime Sync Edition（Version2着手前に優先・Decision 045）

Version1 Final Complete（Decision 044）後の最優先は **Version1.01 Realtime Sync Edition**。目的は「PC / iPhone どちらから利用しても同じAI会社になること」。すべてSupabaseを利用し、PCとスマホが同一状態になることを目的とする。

同期対象: Task同期 / Conversation同期 / Timeline同期 / Notification同期 / Workflow Live同期 / Cost同期 / Learning同期 / Approval同期 / Auto Task同期 / Status同期。

Version2（Affiliate Intelligence / Phase53）はVersion1.01完成後に開始する。Version2着手前にRealtime同期を優先し、**Phase53開始前に必ずユーザー確認を取る**。詳細は docs/04ROADMAP.md「Version1.01 Realtime Sync Edition」/ Decision 045 を参照。

### Priority 0（旧・完了済み）: Phase50-1 — Instagram Marketing Intelligence（Decision 039で優先順位変更）

目的：
保存率分析 / リーチ分析 / プロフィール遷移分析 / フォロー率分析 / CTA分析 / ハッシュタグ分析 / 投稿時間分析 / カルーセル分析 / リール分析 / 競合分析 / トレンド分析。Instagram実運用を開始し、Learningを蓄積しながらVersion1（Instagramを毎日運用できること）を完成させる。

旧Phase50-1「Marketing Intelligence Foundation」（汎用市場分析/SEO分析）はPhase50-3へ後回し、Instagram完成後に拡張する。

詳細は docs/04ROADMAP.md の「Version1 最優先ゴール」「Version 2.0 Roadmap」を参照。

### Phase49-6で完成した内容（次チャットが把握すべき実装・Creative Engineファミリー完結）

- `CREATIVE_ASSET_LIBRARY_VERSION = '1.0.0'` / `CREATIVE_ASSET_LIBRARY_SAFETY_LABELS`（Asset Library Only/No External Execution/No AI Generation/Manual Reuse Only/Read Onlyの5ラベル、固定バッジとして常時表示）
- `createCreativeAssetLibraryDraft(outputDraft)` — **既存6関数の呼び出しのみ**（`createCreativeAdAssemblyDraft()` / `createCreativeExecutionDraft()` / `createImagePromptIntelligenceDraft()` / `createVideoPromptIntelligenceDraft()` / `createPublishingDraft()` / `createAIGatewayDecision()`）でAssetを構成。新規判断・Output Type別分岐は一切行わない
- `favorite`/`archive`は常に`false`固定（静的プレースホルダー、新規永続化・DB変更なし）
- `assetTags`/`searchKeywords`は既存データ（outputType/Output Type定義ラベル/Publishingのhashtags等）からの機械的抽出のみ
- `copyCreativeAssetLibraryField()` — Copy Asset Package/Copy Headline Assets/Copy Caption Assets/Copy Prompt Assets/Copy Tags/Copy Full Asset Libraryの6ケース
- `buildCreativeAssetLibraryHtml()` — `renderOutputEnginePanel()`内、`buildCreativeAdAssemblyHtml`の直後に表示
- Markdown Export（`## Creative Asset Library`）/ JSON Export（`creativeAssetLibrary`キー）に反映
- 全13 OUTPUT_TYPEで動作確認済み
- 既存Package/Preview/Publishing/AI Gateway/Image・Video Prompt Intelligence/Creative Execution/Creative Ad Assembly・Workflow・Knowledge Chainは無変更。実際の画像/動画生成・投稿・外部AI通信は一切なし
- **これによりCreative Engineファミリー（Phase49-1〜49-6）が完結**。次工程はIntelligenceファミリー（Phase50-1〜）
- 詳細は Decision 037（docs/04DECISIONS.md）を参照

### Phase49-5で完成した内容（次チャットが把握すべき実装）

- `CREATIVE_AD_ASSEMBLY_VERSION = '1.0.0'` / `CREATIVE_AD_ASSEMBLY_SAFETY_LABELS`（Assembly Only/No Auto Posting/No Image Generation/No Video Generation/No External AI Execution/Manual Use Onlyの6ラベル、固定バッジとして常時表示）
- `createCreativeAdAssemblyDraft(outputDraft)` — campaignName/adGoal/targetPlatform/creativeSet/headlineSet/captionSet/ctaSet/visualDirection/imageAssetsPlan/videoAssetsPlan/lpDirection/postingPlan/manualAssemblySteps/qualityChecklist/warnings/sourcePublishing/sourceGatewayDecision/sourceImagePromptIntelligence/sourceVideoPromptIntelligence/sourceCreativeExecutionを生成
- Output Type別最適化（1責務1関数）: `_caaFillInstagram()` / `_caaFillTikTok()` / `_caaFillYouTubeShorts()` / `_caaFillFlyer()` / `_caaFillLp()` / `_caaFillHtml()` / `_caaFillDocument()`（pdf/document共用） / `_caaFillImagePrompt()` / `_caaFillVideoPrompt()` / `_caaFillGeneric()`（それ以外の全タイプへの安全な汎用fallback）
- Publishing/AI Gateway/Image Prompt Intelligence/Video Prompt Intelligence/Creative Executionの**既存関数を呼び出すのみ**で必要項目を抽出（各判断ロジックは無変更）
- `copyCreativeAdAssemblyField()` — Copy Ad Set/Copy Headlines/Copy Captions/Copy CTA Set/Copy Assembly Checklistの5ケース
- `buildCreativeAdAssemblyHtml()` — `renderOutputEnginePanel()`内、`buildCreativeExecutionHtml`の直後に表示
- Markdown Export（`## Creative Ad Assembly`）/ JSON Export（`creativeAdAssembly`キー）に反映
- 全13 OUTPUT_TYPEで動作確認済み（powerpoint/excel等はGeneric fallbackへ正しく分岐）
- 既存Package/Preview/Publishing/AI Gateway/Image・Video Prompt Intelligence/Creative Execution・Workflow・Knowledge Chainは無変更。実際の画像/動画生成・投稿・外部AI通信は一切なし
- 詳細は Decision 036（docs/04DECISIONS.md）を参照

### Phase49-4で完成した内容（次チャットが把握すべき実装）

- `CREATIVE_EXECUTION_VERSION = '1.0.0'` / `CREATIVE_TOOL_PLANNER`（16ツール: ChatGPT/Claude/GPT Image/Seedance/Flow/Veo/Runway/Kling/Pika/Luma/DOMOAI/Hailuo/Ideogram/Flux/Midjourney/Recraft。貼り付け先の案内のみ）
- `createCreativeExecutionDraft(outputDraft)` — executionName/executionType/targetTool/targetRoute/requiredInputs/generatedPrompt/copyTarget/executionSteps/manualSteps/estimatedTime/estimatedCost/difficulty/approvalRequired/warnings/checklist/fallback/notes/autoExecute/executionMode/toolPlanner/sourceGatewayDecision/copyTextを生成
- **`autoExecute`は常に`false`、`executionMode`は常に`'manual_only'`にハード固定**（Decision 035）。設定変更では変わらない
- `_ceSelectGeneratedPrompt()` — Image Prompt Intelligence（`_ipiToolKeyForGatewayTool()`）/ Video Prompt Intelligence（`_vpiToolKeyForGatewayTool()`）の**既存関数を呼び出すのみ**で再利用（変更なし）。AI Gateway推奨ツールに応じたプロンプトを選択
- `_ceBuildExecutionSteps()` — STEP1（Output Preview確認）〜STEP7（成果物保存）
- `copyCreativeExecutionField()` — Copy Execution Plan/Copy Manual Steps/Copy Full Workflow/Copy Checklistの4ケース
- `buildCreativeExecutionHtml()` — `renderOutputEnginePanel()`内、`buildVideoPromptIntelligenceHtml`の直後に表示。「MANUAL ONLY」バッジ付き
- Markdown Export（`## Creative Execution`）/ JSON Export（`creativeExecution`キー、`autoExecute: false`含む）に反映
- 全13 OUTPUT_TYPEで動作確認済み。AI Gateway/Image Prompt Intelligence/Video Prompt Intelligenceの判断ロジックは**一切変更せず参照のみ**
- 実際の画像/動画生成・外部AI通信・PC操作・ブラウザ自動操作は一切なし
- 詳細は Decision 035（docs/04DECISIONS.md）を参照

### Phase49-3で完成した内容（次チャットが把握すべき実装）

- `VIDEO_PROMPT_INTELLIGENCE_VERSION = '1.0.0'` / `createVideoPromptIntelligenceDraft(outputDraft)` — version/outputType/mainPrompt/scenePrompt/motionPrompt/cameraPrompt/lightingPrompt/stylePrompt/audioPrompt/captionPrompt/durationPrompt/formatPrompt/negativePrompt/platformPrompts/safetyChecklist/copyText/warnings/sourceGatewayDecision/sourceImagePromptIntelligence/qualityScoreを生成
- Output Type別最適化（1責務1関数）: `_vpiFillTikTok()` / `_vpiFillYouTubeShorts()` / `_vpiFillInstagram()` / `_vpiFillVideoPromptEnhance()`（既存プロンプト高品質化） / `_vpiFillImagePromptToVideo()`（Image-to-Video前提） / `_vpiFillLp()` / `_vpiFillFlyerPdfDocument()`（動画広告化） / `_vpiFillGeneric()`（それ以外の全タイプへの安全な汎用fallback）
- `_vpiBuildPlatformPrompts()` — Seedance/Flow/Veo/Kling/Runway/Luma/Pika/Hailuo/DOMOAIの9ツール形式でプロンプトを整形。実行は一切しない
- AI Gateway連携（`sourceGatewayDecision`）+ Image Prompt Intelligence連携（`sourceImagePromptIntelligence`: mainPromptをvisual base、stylePromptを動画style、compositionPromptをscenePromptへ反映）。画像生成・動画生成はしない
- `copyVideoPromptField()` — Copy Main Video Prompt/Copy Tool Video Prompt（AI Gateway推奨ツールのプロンプト）/Copy Scene Prompt/Copy All Video Prompts
- `buildVideoPromptIntelligenceHtml()` — `renderOutputEnginePanel()`内、`buildImagePromptIntelligenceHtml`の直後に表示
- Markdown Export（`## Video Prompt Intelligence`）/ JSON Export（`videoPromptIntelligence`キー、`platformPrompts`9キー含む）に反映
- 全13 OUTPUT_TYPEで動作確認済み（powerpoint/excel/html等はGeneric fallbackへ正しく分岐）
- 既存Package/Preview/Publishing/AI Gateway/Image Prompt Intelligence・Workflow・Knowledge Chainは無変更。実際の動画生成・画像生成・外部AI通信は一切なし
- 詳細は Decision 034（docs/04DECISIONS.md）を参照

### Phase49-2で完成した内容（次チャットが把握すべき実装）

- `IMAGE_PROMPT_INTELLIGENCE_VERSION = '1.0.0'` / `createImagePromptIntelligenceDraft(outputDraft)` — version/outputType/mainPrompt/negativePrompt/stylePrompt/compositionPrompt/lightingPrompt/cameraPrompt/colorPrompt/formatPrompt/platformPrompts/safetyChecklist/copyText/warnings/sourceGatewayDecision/qualityScoreを生成
- Output Type別最適化（1責務1関数）: `_ipiFillInstagram()` / `_ipiFillFlyer()` / `_ipiFillLp()` / `_ipiFillDocument()`（pdf/document共用） / `_ipiFillImagePromptEnhance()`（既存プロンプト高品質化） / `_ipiFillGeneric()`（それ以外の全タイプへの安全な汎用fallback）
- `_ipiBuildPlatformPrompts()` — GPT Image/ChatGPT Image/Midjourney/Flux/Ideogram/Recraftの6ツール形式でプロンプトを整形。実行は一切しない
- AI Gateway連携: `outputDraft.aiGateway || createAIGatewayDecision(outputDraft)`からrecommendedTool/recommendedRoute/routePriority/capabilityScore/learningを`sourceGatewayDecision`として参照（コピーせず必要項目のみ抽出）
- `copyImagePromptField()` — Copy Main Prompt/Copy Negative Prompt/Copy Tool Prompt（AI Gateway推奨ツールのプロンプト）/Copy All Image Prompts
- `buildImagePromptIntelligenceHtml()` — `renderOutputEnginePanel()`内、`buildAIGatewayHtml`の直後に表示
- Markdown Export（`## Image Prompt Intelligence`）/ JSON Export（`imagePromptIntelligence`キー、`platformPrompts`6キー含む）に反映
- 全13 OUTPUT_TYPEで動作確認済み（html/tiktok_video等はGeneric fallbackへ正しく分岐）
- 既存Package/Preview/Publishing/AI Gateway・Workflow・Knowledge Chainは無変更。実際の画像生成・外部AI通信は一切なし
- 詳細は Decision 033（docs/04DECISIONS.md）を参照

### Phase49-1.2で完成した内容（次チャットが把握すべき実装）

- `AI_REGISTRY_LEARNING_VERSION = '1.0.0'` / `AI_REGISTRY_LEARNING`（`AI_SKILL_REGISTRY`から機械的初期化、13ツール分、全て実績0件の初期状態）
- `calculateAIConfidence(toolId)` — 実績数・成功率・更新日時の鮮度から low/medium/high を判定
- `calculateAIRecommendationScore(toolId)` — 成功率35%/品質30%/速度15%/コスト20%の加重平均をConfidenceで中立値50へブレンド。実績0件は中立値50（推測で高評価/低評価にしない）
- `recordAIRegistryLearning(toolId, quality, cost, speed, success, actionType)` — **呼び出し関数のみ用意。Workflow等からの自動呼び出しは一切行っていない**（実際のAPI実績はまだ保存されない。次チャットでも安全に呼び出しなしの状態から開始できる）
- `buildAIRegistryLearningSummary()` — 全13ツールのLearning状況サマリー生成
- `createAIGatewayDecision()`の既存フィールド（Phase49-1の12種+Phase49-1.1の8種）は完全に無変更。返り値へ`learning`オブジェクト（version/recommendationScore/confidence/status/count/successRate/warnings）を1つ追加のみ
- `buildAIGatewayHtml()`にLearning Status/Recommendation Score/Learning Confidence/Success Rate/Learning Count/Learning Warningsを追加表示。Copy Learning Summaryボタンを追加（既存5ボタンは無変更）
- Markdown Export（Learning Summary等6項目追記）/ JSON Export（`payload.aiGateway = decision`が`decision.learning`を自動的に含むためコード変更不要で`aiGateway.learning`が反映）
- 全13 OUTPUT_TYPEで既存フィールドが完全に同一の値を返すことを回帰確認済み
- 詳細は Decision 032（docs/04DECISIONS.md）を参照

### Phase49-1.1で完成した内容（次チャットが把握すべき実装）

- `AI_CAPABILITY_REGISTRY`（13ツール×12能力、0〜5または'unknown'） / `AI_HEALTH_REGISTRY`（connectionStatus等） / `AI_COST_PROFILE`（costType等） / `AI_APPROVAL_PROFILE_TEMPLATE`+`getApprovalProfile()`（承認要否はアクション種別で一律決定） / `AI_ROUTE_PRIORITY`（12用途別ツール順位） / `AI_VERSION_REGISTRY`（`AI_SKILL_REGISTRY`から機械的に生成）
- `createAIGatewayDecision()`の既存12フィールドは完全に無変更。返り値へ`capabilityScore`/`healthStatus`/`costProfile`/`approvalProfile`/`routePriority`/`registryVersion`/`selectionConfidence`/`registryWarnings`の8フィールドを追加のみ
- `buildAIGatewayHtml()`にCapability Score/Health Status/Cost Profile/Approval Profile/Route Priority/Selection Confidence/Registry Warningsの表示を追加、Copy Registry Summary/Copy Route Recommendationの2ボタンを追加（既存3ボタンは無変更）
- Markdown Export（新規7項目追記）/ JSON Export（`payload.aiGateway = decision`が全フィールドを自動反映するためコード変更不要）
- 全13 OUTPUT_TYPEで既存4フィールド（recommendedTool/route/allowedNow/requiresApproval）が完全に同一の値を返すことを回帰確認済み
- 詳細は Decision 031（docs/04DECISIONS.md）を参照

### Phase49-1で完成した内容（次チャットが把握すべき実装）

- `index.html` の `AI_SKILL_REGISTRY`（13ツール: ChatGPT/Claude/GPT Image/Seedance/DOMOAI/Genspark/Flow/Veo/Kling/Runway/Luma/Pika/Hailuo） / `AI_GATEWAY_TASK_TOOL_MAP`（OUTPUT_TYPE_DEFINITIONS全13タイプに候補ツール対応済み）
- `createAIGatewayDecision(outputDraft)` — recommendedTool/recommendedRoute/reason/costLevel/qualityLevel/speedLevel/requiresApproval/allowedNow/warnings/fallbackToolsを算出。`allowedNow`はrecommendedRouteがprompt_only/manual_copyの場合のみtrue
- `isAIGatewayExecutionAllowed(decision, actionType)` — api/external_comm/pc_operation/browser_operation/image_generation/video_generation/sns_postは恒久的にfalse、prompt_generation/copy_textのみtrue、未知の値もfalse（安全側デフォルト）のハード安全ゲート
- `buildAIGatewayHtml()` — `renderOutputEnginePanel()`内、`buildPublishingEngineHtml`の直後に表示。Copy Gateway Decision/Copy Tool Prompt/Copy Manual Instructionsの3ボタン付き
- `appendAIGatewayToExportMarkdown()` / `appendAIGatewayToExportJson()` — Export（Markdown`## AI Gateway`セクション/JSON`aiGateway`キー）に反映
- Publishing Engine（`outputDraft.publishing`）が存在すれば判断理由に利用。存在しなくても安全にfallback動作することを確認済み
- 既存Package表示・Preview/Publishing Engine・Export構造・Workflow・Knowledge Chain・Provider構成（Leader=OpenAI固定/Writer・Reviewer・Strategy=Claude固定）は無変更
- 実際のAPI実行・PC操作・ブラウザ自動操作・画像/動画生成・SNS投稿は一切行っていない
- 詳細は Decision 030（docs/04DECISIONS.md）を参照

### Phase49-0 / Phase49-0.1で完成した内容（次チャットが把握すべき事項）

- Roadmap（docs/04ROADMAP.md）をCreative Engine / Intelligence / Sales / Automation / Business Intelligence / Company Brain v2 の6ファミリーへ責務分離型で再構成済み（Decision 027）
- 旧Phase49-1「Instagram Intelligence」→ Phase50-2「Platform Intelligence」へ移動、旧Phase50-1「Image Prompt Intelligence」→ Phase49-2へ移動（Creative系プロンプト最適化をPhase49ファミリー内に統一）
- AI Gateway（Decision 028）・Asset Library（Decision 029）を新規コンセプトとして採用。どちらも今回は設計のみで実装は行っていない
- `loadCompanyBrain()`/`renderCompanyBrain()`を確認し、現行Company Brainが読み取り専用の集計ダッシュボードであることを実コードで確認済み。`autonomousConsult`フラグ・`toggleAutonomousConsult()`をCompany Brain v2（Phase54-1 Consult Engine）の土台として活用する方針
- コード変更は一切なし（index.html/server.js/package.json/DB関連ファイルとも無変更）

### Phase48-5で完成した実装（次チャットが把握すべき実装）

- `index.html` の `createPublishingDraft()` — Instagram/TikTok/YouTube Shorts/チラシ/LP/HTML/PDF/画像プロンプト/動画プロンプト/汎用文書の10タイプでPublishing Draft（title/description/hashtags/publishTimeSuggestion/imageList/videoList/cta/copyText/checklist/warnings/sourcePreviewVersion/qualityScore）を生成
- ハッシュタグ数: Instagram 15〜30件 / TikTok 5〜15件 / YouTube Shorts 3〜10件（`#Shorts`含む）。既存タグ+キーワード抽出+汎用フィラータグで調整（事実は捏造しない、Decision 026）
- Quality連携: `packageQuality.score`が80点未満の時のみ`warnings`に追加（90/75/50という既存status閾値とは別のPublishing独自基準）
- Preview連携: `OUTPUT_PREVIEW_TYPES`に含まれる場合のみ`sourcePreviewVersion`を格納。image_prompt/video_promptなどPreview非対応でも独立動作
- `buildPublishingEngineHtml()` — `renderOutputEnginePanel()`内、`buildOutputPreviewHtml`の直後に表示。Copy Title/Description/Hashtags/CTA/All Publishing Dataの5ボタン付き
- `appendPublishingToExportMarkdown()` / `appendPublishingToExportJson()` — Export（Markdown`## Publishing Engine`セクション/JSON`publishing`キー）に反映
- 既存Package表示・Preview Engine・Export構造・Workflow・Knowledge Chainは無変更
- 詳細は Decision 026（docs/04DECISIONS.md）を参照

### Phase47-1.6で解消した内容（次チャットが把握すべき事項）

- `costTracker.js`（OpenAI費用トラッカー）に`todayKey`/`monthKey`/`totalAmount`を追加し、`index.html`側（Phase47-2Aで既にコミット済みだった`cp-oa-total`表示）との不整合を解消・正式コミット済み
- `cost-logs.json`も合わせてコミット済み（既存運用に合わせてデータスナップショットも追跡）
- `claude-cost-logs.json` / `claude-quality-history.json` は今回もコミット対象外のまま（未追跡）。`cost-logs.json`との追跡方針の統一は未着手 — 次回以降で判断が必要
- 詳細はPHASE_PROGRESS.mdのPhase47-1.6セクション・Decision 025（04DECISIONS.md）を参照
- 教訓: Phaseごとに`git status --short`で未コミット差分がないか確認する運用を今後も徹底する

### Phase48-4で完成した実装（次チャットが把握すべき実装）

- `index.html` の `buildOutputPreviewHtml()` — Instagram/LP/チラシ/PDF/HTML/TikTok・YouTube Shortsの完成イメージモックアップを`renderOutputEnginePanel()`内、`buildOutputPackageQualityHtml`の直後に表示
- HTMLタイプは`f.html`があれば`<iframe sandbox="" srcdoc="...">`で実描画（script実行はブロック済み、XSS対策確認済み）
- Preview右上に`_lastOutputDraft.packageQuality`（Phase48-1のスコア）をバッジ表示
- 既存`buildXxxPackageHtml()`（コピー用途）・Export・Workflow・Knowledge Chainは無変更
- 詳細は Decision 024（docs/04DECISIONS.md）を参照

### 次工程チェーン（Phase49-1完了時点のRoadmap / Decision 027で責務分離型へ再構成済み）

```
Phase49-1 AI Gateway Foundation ✅ 完了
  ↓
Phase49-2 Image Prompt Intelligence ✅ 完了
  ↓
Phase49-3 Video Prompt Intelligence ✅ 完了
  ↓
Phase49-4 Creative Engine Execution ✅ 完了
  ↓
Phase49-5 Creative Ad Assembly ✅ 完了
  ↓
Phase49-6 Asset Library ✅ 完了（Creative Engineファミリー完結）
  ↓
Phase50-1 Instagram Marketing Intelligence（旧Platform Intelligence・最優先へ格上げ・Decision 039）
  ↓
Phase50-2 AB Test & Buzz Analysis（旧Phase50-3・順序維持）
  ↓
Phase50-3 Marketing Intelligence Foundation（旧Phase50-1・汎用マーケティングへ後回し）
  ↓
Phase51-1 Sales Document Engine
  ↓
Phase51-2 Presentation Engine
  ↓
Phase52-1 Publishing to Automation Bridge
  ↓
Phase52-2 Posting Automation
  ↓
Phase53-1 Cross Engine Dashboard
  ↓
Phase53-2 Business KPI Intelligence
  ↓
Phase54-1 Consult Engine
  ↓
Phase54-2 Self Review Engine
  ↓
Phase54-3 Autonomous Quality Loop
  ↓
Phase54-4 Company Brain v2 Integration
```

### Phase47-2〜48-3で完成した実装（次チャットが把握すべき実装の要約）

- Claude Model Policy: `claudeClient.js` の `getClaudeModelForRole(role)` — Writer/Reviewer=`claude-haiku-4-5` / Strategy=`claude-opus-4-8`
- Claude Quality History: `claudeCostTracker.js` の `recordClaudeQualityHistory()` / `claude-quality-history.json`永続化（最大20件）
- Output Package Quality: `index.html` の `evaluateOutputPackageCompleteness(draft)` — score 0〜100 / status 4段階
- Output Auto Fill: `index.html` の `buildOutputDraftFromLeaderFinal()` 拡張 — `_extractLabeledSection()` 等でテキスト解析ベースの自動反映（新規AI呼び出しなし）
- 詳細は docs/02PHASE_PROGRESS.md の各Phaseセクション、docs/04DECISIONS.md の Decision 017〜023 を参照

### Phase47-1で追加した機能（次チャットが把握すべき実装）

**API料金メーター（Phase47-1）:**
- `costTracker.js` — addOpenAIUsage() / recordUsage() → todayAmount・monthlyAmount・totalAmount 更新。日付変更で today/month リセット、total は永続
- `claudeCostTracker.js`（新規） — addClaudeUsage(model, inputTokens, outputTokens) → claude-cost-logs.json 永続保存 / ensureState()で日付リセット
- `claudeClient.js` — モジュールレベルで `_addClaudeCost = require('./claudeCostTracker').addClaudeUsage` / trackUsage()末尾で呼び出し
- `server.js` — GET /api/claude-cost → getSummary() from claudeCostTracker
- `index.html` — updateCostProviderPanel(): /api/cost + /api/claude-cost + /api/claude-status を Promise.all で取得、OpenAI+Claude合計を cp-today/cp-month/cp-remain/cost-today に反映
- Provider別パネル: cp-oa-today/cp-oa-month/cp-oa-total/cp-oa-41/cp-oa-mini/cp-oa-nano（OpenAI） + cp-cl-today/cp-cl-month/cp-cl-total/cp-cl-sonnet/cp-cl-opus/cp-cl-in/cp-cl-out/cp-cl-req（Claude）
- フォールバック条件: cc.ok && cc.today.requests > 0 → 永続データ使用 / それ以外 → claude-status インメモリ使用

---

## 実装指示書ルール（正式仕様 / Decision 013）

Phase46-5以降のすべての実装指示書は `docs/08CLAUDE_PROMPT_TEMPLATE.md` に従う。

最終出力形式：
- 通常テキスト形式（Markdownコードブロックで囲まない）
- ヘッダー「これをそのままClaude Codeへ貼ってください。」を付ける
- 出力順序：① 改善案（必要時のみ）→ ② 最終実装指示書（1つだけ）
- 指示書順序固定：目的→絶対ルール→実装内容→詳細仕様→ブラウザ確認→完了条件→Git→完了レポート

---

## Claude Codeへの注意点

1. 既存コードを読まずに実装しない（必ずGrep/Readで確認）
2. `atRunWorkflow()` は複雑な非同期処理 — 変更は最小限に
3. `renderOutputEnginePanel()` は多くの関数を連結 — 追加は末尾に
4. PowerShell git commitは1行ASCII短文のみ（日本語・括弧厳禁）
5. `getRoutedKnowledgeContext()` は既存Knowledge Routing Engine — 変更禁止
6. `buildOutputDraftFromLeaderFinal()` の chain順序は変更禁止
7. 修正ファイルは `index.html` のみ（server.jsは原則変更しない）
   - 例外: Claude APIコスト最適化トラック（Phase47-1〜47-5）では `claudeCostTracker.js` / `claudeClient.js` / `server.js` への変更が正式に承認・実施された。Output Engineトラック（Phase48-1〜）は原則通り `index.html` のみで完結している

---

## dev-check コマンド

```
npm --prefix "C:\Users\hp\ENBISOU_AI\ai-company" run dev-check
```

200/200/200 が必須。

---

## Git Commit形式

```
cd "C:\Users\hp\ENBISOU_AI\ai-company"
git add index.html
git commit -m "Phase46-4 Compare Log"
git tag v1.00-phase46-4
```

日本語禁止 / 括弧禁止 / 1行のみ。

---

## 次チャット開始時の確認手順

新しいClaudeセッションでは、以下 00〜08（+04ROADMAP.md）だけ読めば開発を継続できる状態にしてある。

1. docs/06HANDOVER_NEXT_CHAT.md（このファイル）を読む
2. docs/00ENBISOU_AI_COMPANY_MASTER.md を読む
3. docs/01PROJECT_STATUS.md を読む
4. docs/02PHASE_PROGRESS.md を読む
5. docs/03CLAUDE_RULES.md を読む
6. docs/04ROADMAP.md を読む（v1.0残フェーズ / Version 2.0）
7. docs/05DOC_UPDATE_PROTOCOL.md を読む
8. docs/07CHATGPT_TRANSFER.md を読む（ChatGPT側の場合）
9. docs/08CLAUDE_PROMPT_TEMPLATE.md を読む
10. docs/04DECISIONS.md を読む（設計判断の背景確認）
11. 現在地を要約する
12. Phase50-1（Instagram Marketing Intelligence）から開発再開。Version1の最優先目的はInstagram収益化支援（Decision 039）
