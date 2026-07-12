# PHASE_PROGRESS.md

> ENBISOU AI COMPANY 開発進捗管理書
> 更新日: 2026-07-12（Phase54-2 Output Draft Persistence **正式Complete**・2b/2c/2d＋2f(Mobile Review State Persistence)・commit f0f382f・tag v1.01-phase54-2f・push済み・Render反映済み・本番実機確認完了）

---

## Phase54-2: Output Draft Persistence **Complete**（Output Draftのサーバ永続化＝リロード復元・案件切替復元・Mobile Review状態永続化・B案・2b/2c/2d/2f・push済み・Render反映済み・本番確認済み）

> 記録日: 2026-07-12。B案（既存 approvals/cases と同型・追加のみ・Phase54-1f/1g非接触）。DB: `output_drafts`（output_id PK・case_id NOT NULL・FKなし・非破壊）＋`review_state JSONB`(2f) 作成済み。commit **6dec27d**(2b)／**5eec84b**(2c)／**7589f4f**(2d)／**f0f382f**(2f)／Tag **v1.01-phase54-2d**・**v1.01-phase54-2f**。**origin/main = f0f382f・push済み・Render反映済み・本番実機確認完了**。
>
> **Phase54-2f Mobile Review State Persistence**（本番実機で判明した不足の解消）: スライド別レビュー状態 `_mobileReviewState`（「OK x/10」）がメモリのみで F5/案件切替/再ログインで消失していた問題を、`output_drafts.review_state JSONB` へ `statusBySlide`/`commentsBySlide`/`revisionTargetBySlide`/`approved` を成果物単位で保存・復元して解消。**output_approvals・Approval Sync・Phase54-1f/1g・Publishing Ready・Mobile Approval 非接触**。保存: OK/修正依頼/修正対象/approved=即時・コメント=デバウンス400ms・独立POST。lib は指定列のみ更新でDraト本文を壊さない。
>
> **本番実機確認結果（ユーザー通常ブラウザ）**: OK x/10保持・コメント保持・修正依頼保持・修正担当保持・F5復元・案件切替・別案件混入なし・元案件復元・Mobile Approval回帰なし・Publishing Ready回帰なし・Approval Sync正常・console error 0。**localhost実DB往復**: OK→review_state保存(状態一致・fields無傷)→F5→「OK 2/10」復元・Approval POST 0・dev-check 200/200/200。

### 目的
- メモリのみだった Output Draft をサーバ永続化し **リロード後の成果物復元／案件ごとの最新Draト復元** を実現。`output_id` を承認(output_approvals)との共通キーにして整合。**完全な複数成果物履歴ではない**（最新1件）。

### 実装
- **2b サーバ基盤**：`lib/outputDraftsDb.js`（`upsertOutputDraft`/`getOutputDraft`・approvalsDb踏襲）＋`server.js` `GET/POST /api/output-drafts`（グローバルexpress.json依拠）＋`supabase/schema.sql` 定義（index2本・RLS冪等）。実DB round-trip・400・回帰確認済み
- **2c 保存**（index.htmlのみ +61）：`_outputDraftTitle`/`buildOutputDraftPayloadForServer`/`pushOutputDraftToServer`。`buildOutputDraftFromLeaderFinal` 完成後に本文＋メタのみ保存（fire-and-forget・outputId/caseId/fields揃う時のみ・Approval Queue非接触・cost非送信）
- **2d 復元**（index.htmlのみ +104）：`_outputDraftFromServerRow`/`fetchLatestOutputDraftForCase`/`_canReplaceDraftWithRestore`/`restoreOutputDraftFromServer`/`scheduleOutputDraftRestore`。起動/switchCase/_homeOpenCase で復元→既存Approval Syncが同 output_id で承認復元。**未マークWorkflow Draト保護／Draトなし案件は前案件表示クリア（fix1）／高速連続切替で最新要求を再実行（fix2）**

### localhost実機確認（実ワークフロー1回＋実DB）
- 完成Draト保存（`out_1783814527200`/`case-mrgfnfgutvtb`・200・承認POST 0）→ F5後に復元・ID一致・Approval GETが同 output_id・復元中POST 0／案件別最新復元／Draトなし案件で前案件クリア（POST 0）／高速連続切替で最終案件即時復元・stale不採用／Output Engine・Mobile三種 回帰OK・コンソールエラー0・dev-check 200/200/200

### 非接触・保護
- Phase54-1f（output_id判定）／1g（Approval POST Queue）／Approval Sync GET／`mergeApprovalStateFromServer`／server.js・lib・DB・API（2c/2dはindex.htmlのみ）／Phase53／cost系 非接触。承認状態はDraft APIから復元しない。

### 対象外・残課題
- polling／複数成果物履歴UI／PC⇔スマホ能動再取得／未完了Workflow Draト保持中の別案件自動置換 は **Phase54-2e候補（対象外）**。検証行は非活性・DELETE未実施。

### 次工程
- 本リリース：docs commit → tag → push → Render反映・GET確認。**本番実機確認は未実施（ユーザー承認後）**

---

## Phase54-1g: Approval POST Ordering / Last Action Wins **Complete**（Approval POST直列化＋対象別Last Action Wins・着順逆転防止・index.htmlのみ・push済み・Render反映済み・本番確認済み）

> 記録日: 2026-07-11。**変更1ファイル・追加のみ（index.html +89/-7）**＝`pushApprovalToServer` 内部の直列キュー化のみ。commit **d6a6905**（`Phase54-1g enforce last action wins`）／docs commit **2bb5a86**／Tag **v1.01-phase54-1g**（→ d6a6905）／**origin/main = d6a6905・push済み・Render反映済み**。Phase54-1c同期／54-1d/1e/1f／Phase53／server.js/lib/DB/API／cost系 非接触・課金なし。

### 目的
- Approval POST の fire-and-forget 着順逆転（同一成果物へ approve→reject→cancel を高速連続 → POST到着順逆転でローカル最終とDB最終が不一致）を解消し **Last Action Wins** を保証。Phase54-1c由来の残課題（Phase54-1f起因ではない）を恒久解決。**Approval Sync(GET)の仕様変更ではない**。

### 実装（index.htmlのみ・追加のみ・変更は `pushApprovalToServer` 内部限定）
- グローバル直列 runner `_runApprovalPostQueue`（1件ずつ `await`・多重起動ガード）／対象別 pending `targetKey=caseId::outputId` 最新のみ保持（同一対象supersede＝Last Action Wins／別対象個別保持）＝`_approvalPostPendingByTarget`(Map)＋`_approvalPostTargetOrder`(配列)／`_enqueueApprovalPost` でpayload凍結／成功条件 `response.ok`（4xx/5xx/例外=失敗・`_sendApprovalPostOnce`）／最大1回再送・失敗時により新しいpendingがあればstale再送しない（新操作優先）・失敗継続／outputId無しはPOSTしない（偽ID生成なし）／外部IF維持・非ブロック（戻り値undefined）。

### 非接触（保護対象）
- `buildApprovalPayloadForServer` 既存項目 / GET同期（`scheduleApprovalSync`・`syncApprovalsFromServer`・`mergeApprovalStateFromServer`・`isRemoteApprovalNewer`）/ `_approvalSyncInFlight` / `_approvalSyncLastLocalChangeAt` / output_id判定 / server.js / lib / DB / API / Phase53 / Phase54-1d・1e・1f / cost系。

### ブラウザ合成確認（スタブ・実POST 0・課金なし）
- Queue動作 / Last Action Wins（approve→reject→cancel → 送信 `[approve, cancel]`）/ 対象別保持（`outA:approve / outB:reject2 / outC:publish`）/ POST失敗→最大1回再送（`[ng, ok]`）/ 新操作優先（stale再送なし）/ outputId無しPOST禁止 / 回帰（通常1件・戻り値undefined）/ 後始末原状復帰・コンソールエラー0

### localhost実機確認（実POST・実Supabase・透過ロガー・AI生成なし）
- 通常/LAW：実成果物Draft＋実ハンドラ（`approveInstagramPackage`/`rejectMobileApproval`/`cancelApproval`）で approve→reject→cancel → **実POST 2回のみ**（中間reject supersedeで未送信）・両200・pending残留0・**UI最終=cancel(null)＝DB最終null 一致**
- 着順保持：reject→cancel → postLog `[rejected:200, null:200]`・DB最終null 一致（中間rejectがDBに残らない）
- 対象分離：別案件 target2=rejected / target1=null不変 / output_id不一致=復元なし（Phase54-1f保護健在）
- 回帰：GET同期・review/approval描画関数 健在 / `pushApprovalToServer` 戻り値undefined（非ブロック）/ コンソールエラー0

### 本番実機確認（Render `ai-company-l45x.onrender.com`・実POST・実Supabase・透過ロガー・AI生成なし・本番POST 6件）
- 通常/LAW：approve→reject→cancel → **実POST 2件 `[null:200, null:200]`**（中間reject supersedeで未送信）・**UI最終=cancel(null)＝DB最終null 一致**・pending残留0
- 着順保持/中間非上書き：reject→cancel → `[rejected:200, null:200]`・DB最終null 一致
- 別案件/別成果物 混入なし：target3=rejected / target2=null不変 / output_id不一致=復元なし（Phase54-1f保護維持）
- 回帰：Approval Sync GET回帰なし・描画関数健在・`pushApprovalToServer` 戻り値undefined（非ブロック）・コンソールエラー0

### 実機検証で生成したテスト行（DB `output_approvals`・通常UI POST経由・最小・DELETE未実施）
- localhost：`case-1g-rm-*`（null）/ `case-1g-B-*`（null）/ `case-1g-C-*`（rejected）
- 本番：`case-1g-prod-A-*`（null）/ `case-1g-prod-B-*`（null）/ `case-1g-prod-C-*`（rejected）
- 手動curl POST 0回・DELETE未実施。非活性テストデータとして記録（対応Draftはメモリ消失済み・一致判定によりUIへ復元されない・他案件へ混入しない）。

### 温存
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は未コミット温存（Phase54-1g非接触・stageに含めず）

### 次工程（別Phase候補・ユーザー判断待ち）
- **Output Draft Persistence**（Draft永続化＝リロード復元・PC/スマホ共有・複数成果物Approval履歴の前提）

---

## Phase54-1f: Approval Output Binding / Leakage Prevention（Approval行へoutput_id紐付け・別成果物への誤復元防止・commit済み・push前）

> 記録日: 2026-07-11。**変更4ファイル・追加のみ（+63/-11）**：`index.html` / `lib/approvalsDb.js` / `server.js` / `supabase/schema.sql`。Phase54-1c同期の判定に一致条件を1つ追加以外は非変更・Phase54-1d/1e/Phase53/cost系 非接触。
> Commit: `9fd25a0`（`Phase54-1f bind approvals to output`）/ Tag: `v1.01-phase54-1f`（コードcommitを指す）/ **HEAD=9fd25a0・origin/main=4c0ef2c・未Push 1**。
> DB: ユーザーが `ALTER TABLE output_approvals ADD COLUMN IF NOT EXISTS output_id TEXT;` 実行済み（nullable・PK変更なし・移行なし・非破壊）。ClaudeはDDL未実行。

### 正式目的
- 最新の案件Approval行（`output_approvals` は **case_id PRIMARY KEY・1案件1行を維持**）へ **`output_id` を紐付け**、**現在成果物と `output_id` が一致する場合だけ復元**する。別成果物への誤復元を防止。**完全な複数成果物履歴保存ではない**。Phase54-1eのリセットと連携し新成果物を未承認に保つ。

### 実装（追加のみ）
- **DB**: nullable `output_id TEXT` 追加（ユーザー実行済み・非破壊）
- **supabase/schema.sql**: `output_approvals` 定義を追記（drift解消・DEFAULT/NOT NULL/RLS本文は未introspectのため推測記載せずコメント明記）
- **lib/approvalsDb.js**: `upsertApproval` に任意 `outputId`（指定時のみ書き込み・`onConflict:'case_id'` 維持）／`getApproval(caseId, outputId)`（outputId指定時のみ一致行）
- **server.js**: 既存 GET/POST `/api/approvals` に任意 `outputId` 受領（新規エンドポイントなし・レスポンス不変）
- **index.html**: `getCurrentApprovalOutputId()` 追加／payloadに `outputId`／GET URLに任意 `&outputId=`／`mergeApprovalStateFromServer` 先頭に **output_id一致判定**（不一致・NULL・Draftなしは復元しない・上書きなし・POSTなし・タイムスタンプ不変）

### 実機確認済み（実ワークフロー2回＋実UI＋DB読み取り）
- 新成果物生成時：Mobile Review=unconfirmed / Mobile Approval=draft / Publishing Ready=draft / 承認取消ボタン非表示
- POST bodyへ現在 `outputId`（通常UI経由・手動curl POST 0回）→ DBへ `output_id` 保存 → 現在 `draft.id` と完全一致（既存項目も正常保存）
- 同一成果物内で承認維持（同期でGET URLに outputId・編集中3000msガード健在・`_approvalSyncInFlight` 解除・追加POST 0）
- **同一案件の別成果物へ承認混入なし**（新draft ID→Phase54-1eリセット→同期後も旧承認を復元せず未承認）／案件間混入なし／既存 `output_id=NULL` 行は復元しない
- Mobile Review / Mobile Approval / Publishing Ready / Output Engine / Phase53 回帰・コンソールエラー0・dev-check 200/200/200

### 未確認・対象外
- Workflow Live 本文描画／認証無効環境のログイン・ログアウト／リロード後の同一成果物復元（Draft未永続・対象外）／PC⇔スマホの同一Draft共有（対象外）

### 現Phaseで変更しなかったもの
Output Draft Persistence／複数成果物Approval履歴／過去成果物再表示／PC・スマホ同一Draft共有／PRIMARY KEY・複合PK／新規Approvalテーブル／既存NULL行のデータ移行／output ID生成方式／`getCurrentApprovalCaseId()` dead fallback／UI／Phase53／Version1完成部分／他Realtime Sync

### 残課題
- Output Draftはメモリのみ（リロード復元不可・PC/スマホ共有不可・複数成果物Approval履歴なし）
- `getCurrentApprovalCaseId()` の dead fallback（未修正・報告のみ）
- Approval POST の fire-and-forget 着順逆転（**Phase54-1f起因ではない**・Phase54-1c由来・別Phase候補）
- 検証で生じた孤立Approval行（`case-mrf0d8vobb3y` / `output_id=out_1783695572489` / `rejected`。対応Draftはメモリ消失済み・同output_idは再生成されず一致判定によりUIへ復元されない**非活性の孤立データ**として許容。DELETE・手動POST未実施）

### 別Phase候補（どちらを先に実施するかユーザー判断待ち）
- Output Draft Persistence／Approval POST Ordering / Last Action Wins

### 温存
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は未コミット温存（stageに含めず）

### 次工程
- docs commit（別commit）→ push（要承認）→ Tag個別push → Render反映 → 本番実機確認

---

## Phase54-1e: Approval State Reset / Case Isolation（成果物単位で未承認から開始・表示バグ修正・index.htmlのみ・commit済み・push前）

> 記録日: 2026-07-10。**index.htmlのみ・追加のみ（+20）**。共通リセット関数1個＋5境界呼び出し。server.js / DB / API / Workflow / Provider / Phase54-1c同期 / Phase54-1d `_mrcRerender` / Phase53 / cost系 いずれも無変更・非接触。
> Commit: `06d07d5`（`Phase54-1e approval state reset per output draft`）/ Tag: `v1.01-phase54-1e` / **HEAD=06d07d5・origin/main=b29be90・未Push 1**。

### 不具合
- 承認/レビュー/公開の状態が単一グローバル（`_mobileReviewState`/`_mobileApprovalState`/`_publishingReadyState`）で、新規案件・案件切替・新成果物生成のいずれでも初期化されず、前状態が引き継がれて「承認済み／投稿準備完了／『承認を取消』」が誤表示。

### 目的（限定）
- **表示バグ修正に限定**。承認対象は「成果物（Output Draft）」単位。新規案件・案件切替・新成果物生成では必ず Mobile Review / Mobile Approval / Publishing Ready が**未承認から開始**する。

### 実装（index.htmlのみ・追加のみ）
- 共通リセット関数 **`resetApprovalStatesToDefault()`** 新設：
  - `_mobileReviewState`/`_mobileApprovalState`/`_publishingReadyState` を既定へ
  - `_lastOutputDraft.mobileReviewCenter`/`.mobileApproval`/`.publishingReady` を無効化（次回描画で再計算・Phase54-1d整合）
  - `pushApprovalToServer` 非呼出（不要POSTなし）／`_approvalSyncLastLocalChangeAt` 不変（Phase54-1c非干渉）／既存描画経路のみ
  - 将来の「成果物削除→再生成」でも再利用可能な共通関数
- 接続5境界：`createOutputDraft`（新成果物生成・唯一の生成点／冒頭）／`switchCase`・`_homeOpenCase`（案件切替／冒頭。この後の既存 `scheduleApprovalSync('caseSwitch')` が当該案件を復元）／`createCase`（新規作成分岐・dedup早期returnには入れない）／`createNewCaseFromForm`（フォーム経由・新規/dedup両対応）

### 非変更（安全・スコープ外）
- **Phase54-1c 同期7関数 非変更**（GET復元仕様を複雑化しない）。新規case行なし→GET 0件→復元なし→未承認維持
- **Phase54-1d `_mrcRerender` 非変更**
- `createMobileApprovalDraft`/`canApprove`/`_mapAllChecked`/`_mapReviewApproved`/`_mrcOverallStatus` 判定ロジック無変更
- 成果物単位永続化（output_id）は **Phase54-1f** へ分離（本Phase対象外）

### dev-check / ブラウザ確認
- 🟢 dev-check 200/200/200 / node --check 0エラー / インラインJS 2ブロックparse OK
- 🟢 起動時コンソールエラー0 / `resetApprovalStatesToDefault` 定義 / Phase54-1c同期5関数 typeof function / `_mrcRerender` 健在
- 🟢 合成リセット検証：承認済み汚染→reset で decision=null・checklist空・reviewApproved=false・published=false・archived=false・draftキャッシュ3種=null・`_approvalSyncLastLocalChangeAt` 不変
- 🟢 Phase53 `oe-aic` 67件維持 / Phase54-1c同期diff 0 / Phase54-1d `_mrcRerender` diff 0
- ⚠️ 実ワークフローでの実操作確認（新規案件→新成果物→未承認／案件A→B切替で混入なし／同一案件の作り直しで未承認）は成果物draft生成（API課金）を伴うため未実施（push/Render反映後にユーザー実機確認）

### 温存
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は未コミット温存（stageに含めず）

### 次工程
- docs commit（別commit）→ push（要承認）→ Render反映 → 実機確認
- **Phase54-1f（今後予定・別設計・要承認）**: 承認の成果物単位永続化（`output_approvals` に `output_id`/`draft_id` 追加・Phase54-1c同期を output_id キーへ整合。DB/server.js/API/Supabase作業を伴う）。同一案件・既存承認×新成果物の再承認（case_id単位GET復元の残課題）を恒久解決

---

## Phase54-1d: Mobile Approval Cache Fix（canApprove キャッシュ無効化漏れ修正・index.htmlのみ・commit済み・push前）

> 記録日: 2026-07-10。**index.htmlのみ・追加のみ（+10）**。`_mrcRerender()` のみ対象。server.js / DB / API / Workflow / Provider / Phase54-1c同期 / Phase53 / cost系 いずれも無変更・非接触。
> Commit: `43513cc`（`Phase54-1d mobile approval cache fix`）/ Tag: `v1.01-phase54-1d` / **HEAD=43513cc・origin/main=1574241・未Push 1**。

### 不具合
- Mobile Review で全スライドOK＋独自の「この内容で承認する」で承認済み（reviewStatus=approved）にしても、Mobile Approval の「この内容で承認する」が disabled のまま。7項目チェックを1つ外して再チェックすると `_mapRerender()` が走り有効化される（キャッシュ無効化漏れ）。

### 根本原因
- `canApprove` を内包する `_lastOutputDraft.mobileApproval` は Mobile Approval 自身の `_mapRerender()` でしか再生成されない（`buildMobileApprovalHtml` はキャッシュ優先）。Mobile Review 側の `_mrcRerender()` は `mobileReviewCenter` のみ更新し `mobileApproval` を無効化しないため、reviewStatus が approved になっても canApprove が再計算されず disabled 固定。

### 修正（A案'・index.htmlのみ・追加のみ・`_mrcRerender()` のみ）
- `_mrcRerender()` に「**reviewStatus 変化時のみ `_lastOutputDraft.mobileApproval` を無効化**」する分岐を追加。
  - 新 reviewStatus = `_lastOutputDraft.mobileReviewCenter.mobileApprovalInput.reviewStatus`、旧 = `_lastOutputDraft.mobileApproval.summary.reviewStatus` を比較し、**異なる時だけ** `mobileApproval = null`（null ガード付き）。
  - 無効化後は次回 `buildMobileApprovalHtml()` が `createMobileApprovalDraft()` を走らせ `canApprove` を追従。
  - **スライド移動 / 前後移動 / サムネイル選択（reviewStatus不変）ではキャッシュ維持＝不要な再計算を回避**。承認/修正依頼で reviewStatus が変化した場合のみ無効化（逆方向の自動無効化も成立）。
- 既存2行（`mobileReviewCenter` 再生成／`renderOutputEnginePanel()`）は不変。`createMobileApprovalDraft`/`canApprove`/`_mapAllChecked`/`_mapReviewApproved` のロジック・`_mobileApprovalState`（checklist/decision/approvedAt）は無変更。

### 安全設計
- 状態不変：7項目チェック・decision・承認済み状態を保持（`createMobileApprovalDraft` は `_mobileApprovalState` を読むだけ）。
- Phase54-1c 非接触：同期5関数無変更。無効化・再計算経路は `pushApprovalToServer` を呼ばない（不要POSTなし）。

### dev-check / ブラウザ確認
- 🟢 dev-check 200/200/200 / node --check 0エラー / インラインJS 2ブロックparse OK
- 🟢 起動時コンソールエラー0 / `_mrcRerender`・`_mapRerender` 健在 / Phase54-1c同期5関数 typeof function
- 🟢 合成ロジック検証：reviewStatus 変化→無効化 / 同一→維持 / ナビ相当→維持 / Phase53 `oe-aic` 67件維持
- ⚠️ 実ワークフローでの実操作確認（承認→自動有効化／修正依頼→自動無効化）は成果物draft生成（API課金）を伴うため未実施（push/Render反映後にユーザー実機確認）

### 温存
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は未コミット温存（stageに含めず）

### 次工程
- docs commit（別commit）→ push（要承認）→ Render反映 → 実機確認。その後 残同期の別Phase または Phase54系Intelligence

---

## Phase54-1c: Approval Sync Client（承認/公開状態のPC⇔スマホ同期・index.htmlのみ・commit済み・push前）

> 記録日: 2026-07-09。**index.htmlのみ・追加のみ（+135 / -2）**。server.js / DB / API / Workflow / Provider / Phase53 / cost系 いずれも無変更・非接触。
> Commit: `4f53dd5`（`Phase54-1c approval sync client`）/ Tag: `v1.01-phase54-1c` / **HEAD=4f53dd5・origin/main=5bfaf6b・未Push 1**。

### 目的
Phase54-1b の既存API（`GET/POST /api/approvals`）を index.html から利用し、承認/却下/公開/アーカイブ状態を case_id 単位で PC⇔スマホ同期する（A案・単一グローバル状態を現在case_idへマッピング・Decision 048継承）。

### 実装（index.htmlのみ・追加のみ）
- **追加関数7**: `getCurrentApprovalCaseId` / `buildApprovalPayloadForServer` / `pushApprovalToServer` / `syncApprovalsFromServer` / `mergeApprovalStateFromServer` / `isRemoteApprovalNewer` / `scheduleApprovalSync`
- **追加変数3**: `_approvalSyncInFlight`（多重実行防止・成功/失敗/早期return問わずfinallyで必ず解除＝解除漏れ防止）/ `_approvalSyncLastLocalChangeAt`（編集中ガード起点）/ `_approvalSyncLastReason`
- **定数/Version**: `APPROVAL_SYNC_EDIT_GUARD_MS = 3000` / `APPROVAL_SYNC_CLIENT_VERSION = '1.0.0'`
- **push接続（確定時に非同期送信＋ガード起点更新）**: `approveInstagramPackage`(approve) / `rejectMobileApproval`(reject) / `cancelApproval`(cancel・空状態) / `markInstagramPublished`(publish) / `archivePublishingReady`(archive) / `resetPublishingReadyStatus`(reset・空状態)。`toggleApprovalCheck` はガード起点更新のみ（push対象外）
- **pull接続（契機）**: 起動時（`syncCasesFromServer()`直後に`scheduleApprovalSync('startup')`）/ `switchCase`・`_homeOpenCase`（`'caseSwitch'`）/ `visibilitychange`（`'visible'`・既存`syncCurrentMemberFromServer()`は残置）

### 同期・merge・安全設計
- case_id は `_ncActiveCaseId(currentMember)` 優先 → `_lastOutputDraft.caseId` 補助 → 無ければ null（push/pullスキップ＝現状のephemeral挙動維持）
- GET `?caseId=` 単件（`data.approval`）を取得。**編集中ガード（最終ローカル操作から3000ms以内はローカル優先）** ＋ **updated_at がリモート新しい時のみ反映**。古い/同値/新旧不明は上書きしない。反映時のみ `_mapRerender()`/`_prcRerender()`（`renderOutputEnginePanel`・`_oeSafe`保護下）
- 全通信は非同期・try/catch握り潰し・UIブロックなし。`scheduleApprovalSync` はマイクロタスク遅延で起動時TDZ回避＋多重実行防止

### dev-check / ブラウザ確認
- 🟢 dev-check 200/200/200 / node --check 0エラー / インラインJS 2ブロックparse OK
- 🟢 起動時コンソールエラー0 / 全7関数 typeof function / 定数一致 / 起動同期発火（reason=startup）→ `_approvalSyncInFlight=false`（解除漏れ防止が実機で機能）/ `isRemoteApprovalNewer` 新旧判定正常
- 🟢 既存API回帰なし（`GET /api/cases`・`GET /api/approvals`）/ Phase53 `oe-aic` 67件維持
- ⚠️ PC⇔スマホ実機ラウンドトリップ（実POST）は未実施（実DBへ勝手にテストデータ作成しない方針・push/Render反映後にユーザー実機確認）

### 温存
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は未コミット温存（stageに含めず）

### 次工程
- docs commit（別commit）→ push（要承認）→ Render反映 → 実機同期確認。その後 残同期の別Phase（Task/Cost/Status/Auto Task poll）または Phase54系Intelligence

---

## Phase52-10: Version1 Final Complete（docsのみ・コード変更なし）

> 記録日: 2026-07-05。**docsのみ更新・コード変更なし**（index.html/server.js/DB/Workflow/Provider無変更）。
> 最新コミット: `f177fd2`（Phase52-8-9 mobile topbar unified scroll）— **Render本番反映済み・iPhone Safari実機確認完了**。

- 正式Version: **v1.00-phase52-10 / Version1 Final Complete**
- Version1を「運用可能な完成版」として正式完成と記録:
  - Instagram収益化パイプライン完成（Phase50-1〜52-1）
  - Mobile UI完成（52-5）／ Mobile Touch Hotfix完成（52-6）／ Mobile Topbar完成（52-8/52-9/52-9b）
  - Render本番反映完了（ai-company-l45x.onrender.com = f177fd2）
  - iPhone Safari実機確認完了（縦向き・横向きともTopbar 1本横スクロール・全ボタン操作可能・入力/送信可能・横はみ出しなし・PC不変）
  - Manual Only維持（Instagram API/自動投稿/画像生成/課金なし）
- 次工程: **Version1.01 Realtime Sync Edition**（PC/iPhone同一状態・Supabase同期）→ その後 Version2 Affiliate Intelligence（Decision 044・045）
- Phase53（Affiliate Intelligence Core）は作業ツリーに未着手で温存（本Phaseには一切混ぜていない）

---

## 現在地
- 現在フェーズ: **Phase49-6 完了（Creative Asset Library）＝Creative Engineファミリー（Phase49-1〜49-6）完結**
- **Phase49: 100%完了**（AI Gateway Foundation〜Creative Asset Libraryの全8サブフェーズ完了）
- **Creative Engine Family: Complete**
- 現在バージョン: **v1.00-phase49-6**
- **Version1 Roadmap方針変更（Decision 039）**: Version1の最優先目的をInstagram収益化支援へ変更。AI会社はInstagram運用を最初の実運用対象とする。Manual Only方針は維持（詳細は docs/04ROADMAP.md「Version1 最優先ゴール」参照）
- **Phase50-1 完了（Instagram Marketing Intelligence）**: 予測ヒューリスティック11分析＋手動実績入力。dev-check 200/200/200・ブラウザ実機確認済み（Decision 040）
- 次フェーズ: **Phase50-2以降**（Content Planning / Carousel Builder / Image Layout Engine / iPhone成果物確認・承認 / 投稿予約 の順にInstagramマネタイズシステムを構築）

---

## Version1 完成記録（Phase52-2 / Documentation Complete）

- 現在フェーズ: **Version1 Documentation Complete**
- 現在バージョン: **v1.00-phase52-2**
- Version1状態: **Instagram収益化パイプライン完成**（Phase50-2〜52-1で全工程実装完了）
- 本フェーズ（Phase52-2）はコード変更なし・docsのみ更新（Version1正式記録・Decision 041）

Phase50-2〜52-1（すべてindex.htmlへ追加のみ・既存機能無変更・Manual Only・dev-check 200/200/200・Node vmロジック検証済み）:

| Phase | 内容 | Tag |
|-------|------|-----|
| Phase50-2 | Instagram Content Planning（テーマ5件+・priorityScore・carouselBuilderInput） | v1.00-phase50-2 |
| Phase50-3 | Instagram Carousel Builder（10枚構成・carouselScore・imageLayoutEngineInput） | v1.00-phase50-3 |
| Phase50-4 | Instagram Design System / Image Layout Engine（8テンプレ・designScore・mobileReviewInput） | v1.00-phase50-4 |
| Phase50-5 | Mobile Review Center（スマホ完結・スワイプ/サムネ・OK/修正/承認・mobileApprovalInput） | v1.00-phase50-5 |
| Phase50-6 | Mobile Approval（4状態・承認ゲート・publishingReadyInput/approvalPackage） | v1.00-phase50-6 |
| Phase50-7 | Publishing Ready Center（投稿直前一式集約・Publishing Score・手動「投稿しました」） | v1.00-phase50-7 |
| Phase51-1 | Instagram Learning Center / Learning Engine v1（14入力・6指標+5段階評価・AI分析9・Learning Output7） | v1.00-phase51-1 |
| Phase52-1 | Asset Library Save Center / Save Integration v1（保存候補15項目・4状態・Asset Summary5・表示のみ） | v1.00-phase52-1 |
| Phase52-2 | Version1 Documentation Complete（docsのみ・コード変更なし） | v1.00-phase52-2 |

各Phaseは新規パネルをindex.htmlへ追加し、`renderOutputEnginePanel()`のchain末尾（Creative Asset Library→Marketing Intelligence→Content Planning→Carousel Builder→Design System→Mobile Review→Mobile Approval→Publishing Ready→Learning Center→Asset Library Save の順）とMarkdown/JSON Exportへ接続。既存Provider構成・Workflow・Knowledge Chain・Learning Engine・Publishing Engine・Creative Asset Libraryは無変更（読み取り専用参照のみ）。

---

## Phase52-5 / 52-6: Mobile UI Polish & Touch Hotfix（実装済み・本番反映済み）

> 記録日: 2026-07-05（記録漏れの遡及正式化）。**実装・コミット・Render本番反映まで完了済み**。
> Git: コミット `a983c35 "Phase52-5-6 mobile ui polish and touch hotfix"` / Tag `v1.00-phase52-6-mobile-ui` / `git push origin main`（fast-forward）済み → Render自動デプロイ済み。`index.html`のみ・追加のみ・PC不変。

### Phase52-5: Mobile UI Final Polish ✅
- 目的: iPhone Safariのスマホ表示品質向上（機能追加なし・UIのみ・PC不変）。
- `index.html`（追加のみ）:
  - `<meta viewport>` に **`viewport-fit=cover`** を追加（safe-area env() を有効化。PCでは無効＝無害）。
  - `@media (max-width:768px)` ブロック追加:
    - `#topbar-quick` を横スクロール化（`flex:1 1 0`/`overflow-x:auto`/スクロールバー非表示、ボタン`flex-shrink:0`）→ 上部メニュー見切れ対策。
    - `#current-info { flex:0 1 auto }`（クイックへ幅を譲る）／`#topbar-right { max-width:46vw }`（💰料金等を表示しつつ内部スクロール維持）→ ステータス見切れ対策。
    - `#topbar`/`#mega-menu-nav`/`#input-area` に safe-area余白（top/left/right/bottom）→ ノッチ・ホームバー回避。
    - `html { overflow-x:hidden }`（横スクロール抑制の保険）。
- 検証: dev-check 200/200/200・配信CSS反映・インラインJS構文OK・`<style>`ブレース均衡・PC非影響（全て@media内＋metaはPC無効）。

### Phase52-6: Mobile Touch Hotfix ✅
- 目的/原因: Phase52-5で追加した **`html { overflow-x:hidden }` が iOS Safari でタッチ/横スクロール/入力欄タップを阻害**していたため補正（`body { overflow:hidden }` が既に横スクロールを抑制済みで、html側指定は不要かつ有害だった）。
- `index.html`（追加のみ・Phase52-5は残し阻害要因のみ補正）: `@media (max-width:768px)` に Phase52-6ブロック追加:
  - `html { overflow-x:visible }`（52-5のhiddenを後勝ちで無効化。横スクロール抑制は既存`body/#main`の`overflow:hidden`が担保）。
  - `#topbar-quick, #mega-menu-nav` に `overflow-x:auto`＋`-webkit-overflow-scrolling:touch`＋`touch-action:pan-x`（横スワイプ復旧）。
  - `#input-area { z-index:30; pointer-events:auto }`＋`#msg-input, #send-btn { pointer-events:auto; touch-action:manipulation }`（入力欄・送信タップ復旧。既存`position:sticky`は維持）。
- 検証: dev-check 200/200/200・配信JSパースOK・html上書き順序OK（visibleが後勝ち）・CSSブレース均衡・PC非影響。
- 禁止事項遵守: 親に`pointer-events:none`なし／透明fixedレイヤーで入力欄を覆わない／body全体のtouch-action制限なし。

### Phase52-5/52-6 共通
- 変更ファイル: `index.html` のみ。server.js/DB/Workflow/API/環境変数・既存関数は無変更。
- PC影響: なし（CSSは全て`@media (max-width:768px)`内、`viewport-fit=cover`はPCで無効）。
- 本番: `ai-company-l45x.onrender.com` に `a983c35` として反映済み（Render自動デプロイ）。

---

## Phase52-8 / 52-9 / 52-9b: Mobile Topbar 一連（iPhone上部UI最終調整）

> 記録日: 2026-07-05。**index.htmlのみ・追加のみ・PC不変**。スマホ（iPhone Safari）の上部バーを段組み＋1本の横スクロールへ再設計。
> 前提: 本番(Render)は `a983c35`（Phase52-5/52-6）まで反映済み。本一連（52-8/52-9/52-9b）は分離ステージ済みで**コミット予定メッセージ `Phase52-8-9 mobile topbar unified scroll`**（Phase53・docs・cost-logsは除外）。

### 目的
iPhone Safari（縦・横）で上部タブ（タスク/通知/Timeline/Brain/社長室/Auto Task/自律相談/課金ロック/料金）を、窮屈さ・見切れなく**1本の横スクロール**で自然に操作できるようにする。

### 原因（段階的に判明）
- Phase52-8時点: `#topbar`をスマホでも1段に3ブロック（現在担当＋`#topbar-quick`＋`#topbar-right`）で圧縮し窮屈だった。
- Phase52-9時点: `#topbar-quick`と`#topbar-right`が**別`<div>`**のため、`display:contents`＋CSSだけではiOS Safariで1本に統合できず、実機で分断が残存。
- さらに `@media (max-width:768px)` のみでは**iPhone横向き（幅>768px）に適用されず**PCレイアウトのままだった。

### 変更ファイル
`index.html` のみ（+232行・追加のみ／既存ルール・関数・Workflow・AIロジックは無変更）。

### HTML変更
- Phase52-9: `#topbar-quick`＋`#topbar-right`を薄いラッパ `<div id="tb-scroll">` で囲む（既存要素・id・onclick・バッジは無変更で内包するのみ）。
- ※JSからこれらidへのロジック参照は無し（全てCSSセレクタ）を確認済み。

### CSS変更
- `#tb-scroll { display: contents; }`（base）… PCではラッパを透過し従来レイアウト完全維持。
- Phase52-8ブロック `@media (max-width:768px)`: `#topbar{flex-wrap:wrap}` 段組み化。
- Phase52-9ブロック `@media (max-width:768px)`: `#tb-scroll`をflex+overflow-x:autoで実体化（暫定）。
- Phase52-9bブロック `@media (max-width:768px), (pointer:coarse)`: `#mobile-quickbar` を全幅1本の横スクロール（`overflow-x:auto` / `-webkit-overflow-scrolling:touch` / `touch-action:pan-x` / `scroll-snap-type:none`）。ボタンは `flex:0 0 auto` / `white-space:nowrap` / `min-width:max-content` / `height:32px`。safe-area(52-5)維持。
- **`(pointer:coarse)` によりiPhone縦・横 両方に適用**（幅768超の横向きも網羅）。PCの`(pointer:fine)`では非適用。

### JS変更
- Phase52-9b: `</body>`直前に独立`<script>`で `buildMobileTopbar()` を追加。
  - モバイル（`matchMedia('(pointer:coarse)')` または 幅≤768）のとき、`#topbar-quick`＋`#topbar-right`の**全9ボタンを実体ごと** `#mobile-quickbar` へ移動（onclick/id/バッジ保持）→物理的に1本化。旧`#tb-scroll`は`display:none`。
  - PC（`pointer:fine`かつ幅>768）では何もしない。二重実行防止・try/catchで失敗時も既存UI維持。
  - 既存関数・Workflow・AI社員ロジックは無変更（ボタン移動のみ）。

### PCへの影響
**なし**。CSSは全て`@media`内、`#tb-scroll`はPCで`display:contents`（透過）、JSは`pointer:fine`かつ幅>768で不発火。ブラウザ実測でPC相当（fine・>768）では`#mobile-quickbar`未生成・従来`#topbar-quick`/`#topbar-right`のまま。

### iPhone縦向き対応（ブラウザ実描画375pxで実測）
`#mobile-quickbar`に9ボタン集約／scrollWidth **827px** > clientWidth 355px（1本の横スクロール成立）／scrollLeft=472で末尾「料金」まで到達／旧`#tb-scroll`は`display:none`／3段構成（1段=☰＋担当／2段=統合バー／3段=カテゴリ）／入力欄中心の最前面=`msg-input`（被りなし）。

### iPhone横向き対応
`(pointer:coarse)`＋JSの`matchMedia('(pointer:coarse)')`により、**横向き（幅>768）でも同一UI**を適用。回転しても`#mobile-quickbar`維持（coarseは向きで変わらない）。※headless制約でcoarseエミュ不可のため、横向きの最終確認は実機に委ねる。

### dev-check結果
🟢 200/200/200。補助: インラインscript 2/2パースOK・DOMリペアレント・シミュレーション7/7・CSSブレース均衡・Phase53マーカー6件保持。

### 未解決事項
- 本番(Render)未反映（コミット/push前）。iPhone実機での最終目視確認は本番デプロイ後に必要。
- headless環境では`pointer:coarse`をエミュできないため、横向きcoarse挙動はコード上の担保のみ（実機確認推奨）。
- `#tb-scroll`の暫定スクロール指定（Phase52-9）は`#mobile-quickbar`導入後は不使用だが、追加のみ方針で残置（無害）。

### 次フェーズへの引き継ぎ
- 分離ステージ済み（Topbar 5ハンク・232行）。**Phase53(+380)・Version2設計docs・cost-logs系は未コミットで温存**。コミット→`git push origin main`（force無し/`--tags`無し）→Render自動デプロイ→iPhone実機確認、の順で反映する。
- Phase53（Affiliate Intelligence Core）は引き続き作業ツリー保持。Version2着手時に別途コミット判断。

---

### Phase50-1: Instagram Marketing Intelligence ✅
- `index.html`（追加のみ・427行insert / 0 delete）
  - `INSTAGRAM_MARKETING_INTELLIGENCE_VERSION = '1.0.0'` / `IMI_SAFETY_LABELS`（No Real API Connection / Manual Input Only / Prediction Heuristic Only / Read Only Analysis の4固定バッジ）
  - `createInstagramMarketingIntelligenceDraft(outputDraft)` — 既存`createPublishingDraft()`/`createCreativeAdAssemblyDraft()`を読み取り専用参照。保存率/リーチ/プロフィール遷移/フォロー率/CTA/ハッシュタグ/投稿時間/カルーセル/リールの予測分析（0〜100点）を生成
  - 実績分析: `recordInstagramResult()` / `submitInstagramResultEntry()`（手動入力のみ・`_instagramResultHistory` max30件メモリ内・3件以上で平均集計）
  - 競合/トレンド分析は手動リサーチ用チェックリスト提示のみ
  - `buildInstagramMarketingIntelligenceHtml()` — `renderOutputEnginePanel()`内、`buildCreativeAssetLibraryHtml`の直後に表示。9分析カード＋5手動入力欄＋Copy 3ボタン＋Record Resultボタン
  - `copyInstagramMarketingIntelligenceField()`（Predictive/Checklist/Full の3ケース）
  - Markdown Export（`## Instagram Marketing Intelligence (Phase50-1)`）/ JSON Export（`instagramMarketingIntelligence`キー・`_instagramResultHistory`）に反映
- ブラウザ実機確認（Chrome Preview・mock draft注入方式）: instagram_carousel（保存率85/ハッシュタグ85/カルーセル85点）で9分析カード・4バッジ・5入力欄表示、手動実績3件入力→平均集計（saveRate 5.37/reach 1200）、Export markdown/json反映、powerpointでカルーセル/リールが対象外(null)へ正しくfallback、null draftで例外なし、console.errorなしを確認
- 実際のInstagram API接続・自動データ取得・自動投稿・自動課金は一切なし。既存Provider構成・Workflow・Knowledge Chain・Creative Engine各関数は無変更
- Git: Phase50-1 instagram marketing intelligence / Tag: v1.00-phase50-1

---

# Phase1〜Phase35（基盤構築）
## 完了
- OpenAI接続 / Supabase接続 / ログイン / 会話履歴保存
- AI社員基盤 / Workflow基盤 / Timeline基盤 / Task基盤

---

# Phase36〜Phase42（Claude協業 / Workflow完成）
## 完了
- Claude担当追加（Writer / Reviewer / Strategy）
- Leader=OpenAI確立
- Workflow Live / Progress Bar / Timeline / Leader Final
- Auto Task完了 / Provider表示
Git: v0.96相当

---

# Phase43（Workflow Live完成版）
## 完了 — Tag: v0.97

### Phase43-1: Claude API準備画面の表示同期
### Phase43-2: Workflow開始時に全担当カード生成
### Phase43-3: Progress Bar追加（0%→100%）
### Phase43-4: Timeline改善（状態アイコン / 重複防止）
### Phase43-5: Workflow Live再表示・UI磨き込み

---

# Phase44（Output Engine）
## 完了 — Tag: v0.98

### Phase44-1: Output Engine基盤
- OUTPUT_TYPES（13種）/ OUTPUT_STATUS（6種）/ createOutputDraft()
- Git: 6ba1fc5 / Tag: v0.98-phase44-1

### Phase44-2: Leader成果物タイプ自動判定
- detectOutputType() / _lastOutputDetection
- Git: 65bb77e / Tag: v0.98-phase44-2

### Phase44-3: 担当別成果物フィールド割当
- OUTPUT_ROLE_ASSIGNMENTS / assignedRoles
- Git: fce51b1 / Tag: v0.98-phase44-3

### Phase44-4: Output Draft Builder基盤
- buildOutputDraftFromLeaderFinal()
- Git: e52e2d7 / Tag: v0.98-phase44-4

### Phase44-5: Instagram Carousel Package表示
- buildCarouselPackageHtml()
- Git: 95fd298 / Tag: v0.98-phase44-5

### Phase44-6: Package表示の汎用化
- buildFlyerPackageHtml / buildLpPackageHtml 等
- buildOutputPackageHtml() ディスパッチャー
- Git: 4a4496f / Tag: v0.98-phase44-6

### Phase44-7: 成果物コピー/エクスポートUI
- serializeOutputDraft(format) — markdown / json / html / text
- Git: a3987f4 / Tag: v0.98-phase44-7

### Phase44-8: 成果物UI最終確認・Phase44完了判定
- dev-check 200/200/200
- Tag: v0.98-phase44-8 / v0.98

---

# Phase45（Learning / Memory / Knowledge / Save / Inject）
## 完了 — Tag: v0.99

### Phase45-0: Output Schema v1.0固定
- OUTPUT_SCHEMA_VERSION 1.0.0 / normalizeOutputDraft() / validateOutputDraft()
- Git: 120a83a / Tag: v0.98-phase45-0

### Phase45-1: Reviewer Quality Engine v1
- OUTPUT_QUALITY_VERSION 1.0.0 / evaluateOutputQuality()
- QUALITY_METRIC_PRESETS（6タイプ）
- Git: 373bc79 / Tag: v0.98-phase45-1

### Phase45-2: Learning Engine v1
- OUTPUT_LEARNING_VERSION 1.0.0 / extractLearningItems()
- LEARNING_CATEGORIES（7種）
- Git: 8c505ea / Tag: v0.98-phase45-2

### Phase45-3: Company Memory基盤
- COMPANY_MEMORY_VERSION 1.0.0 / createCompanyMemoryCandidates()
- _companyMemoryBuffer（max50）
- Git: bcd5b48 / Tag: v0.98-phase45-3

### Phase45-4: Memory→Knowledge反映準備
- COMPANY_KNOWLEDGE_CANDIDATE_VERSION 1.0.0
- createKnowledgeCandidatesFromMemory()
- _companyKnowledgeCandidateBuffer（max50）
- Git: 1be7cb0 / Tag: v0.98-phase45-4

### Phase45-5: Knowledge承認UI + Recommendation Engine v1
- KNOWLEDGE_RECOMMENDATION（recommended / review / normal）
- calculateKnowledgeRecommendation() — スコアリング
- approveKnowledgeCandidate() — 承認/保留/却下
- Git: 6d38536 / Tag: v0.98-phase45-5

### Phase45-6A: Company Knowledge保存準備/DB設計確認
- COMPANY_KNOWLEDGE_VERSION 1.0.0 / COMPANY_KNOWLEDGE_RECORD_SCHEMA
- Git: 5108a56 / Tag: v0.98-phase45-6A

### Phase45-6B: Supabase保存方法の確認
- 既存 knowledge_library テーブル確認 / A案（既存API使用）を選択
- Git: 61f7e59 / Tag: v0.98-phase45-6B

### Phase45-6C: Knowledge正式保存の最小実装
- saveApprovedKnowledgeCandidates() — /api/knowledge-library へPOST
- _lastKnowledgeSaveResult / 保存結果UI
- Git: 9adaf1e / Tag: v0.98-phase45-6C

### Phase45-6D: Save Guard（重複保存防止）
- _knowledgeSaveHistory（max50） / getKnowledgeFingerprint()
- isKnowledgeDuplicate() / Save Summary / Skipped Duplicates表示
- Git: d0763d4 / Tag: v0.98-phase45-6D

### Phase45-7: Knowledge Inject
- fetchKnowledgeForOutputType() / selectRelevantKnowledge()（max5件）
- _lastInjectedKnowledge / Workflow開始時に自動取得
- Leader contextへ追記（getInjectedKnowledgeContext）
- Git: 4e9f535 / Tag: v0.98-phase45-7

### Phase45-8: Knowledge注入効果確認 / Phase45完了判定
- JSON Export強化（_knowledgeSaveResult / _injectedKnowledge）
- Git: 0cd8c48 / Tag: v0.98-phase45-8 / v0.99

---

# Phase46（Knowledge Verification / Leader Intelligence）
## 進行中

### Phase46-1: Knowledge Injection Preview ✅
- Workflow Liveに Injected Knowledge / Guide Summary 表示強化
- Output Engine: Leader Context Preview / Debug / Source/genre/confidence表示
- _kiLastFetchCount / _kiLastSelectedCount / _kiLastFetchStatus
- Git: c4e63b1 / Tag: v1.00-phase46-1

### Phase46-2: Leader Intelligence Upgrade ✅
- buildLeaderExecutionGuide() — cta/structure/brand/avoid/priorities分類
- getInjectedKnowledgeContext() 拡張 — 【Leader Execution Guide】追加
- buildLeaderExecutionGuideHtml() / Output Engine表示 / Export反映
- Git: dad89fe / Tag: v1.00-phase46-2

### Phase46-3: Knowledge Compare Mode ✅
- KNOWLEDGE_COMPARE_MODE（with_knowledge / without_knowledge / guide_only）
- switchKnowledgeCompareMode() / 3ボタンUI
- getInjectedKnowledgeContext() モード対応
- Leader Context Preview: Compare Mode / Injected to Leader表示
- Export: Knowledge Compare セクション追加
- Git: 42b70aa / Tag: v1.00-phase46-3

### Phase46-4: 実案件テストログ / 品質比較記録 ✅
- `_knowledgeCompareLog[]`（max30件）— Workflow完了ごとに自動記録
- `recordKnowledgeCompareEntry(draft)` — mode / score / outputType / injectedCount を記録
- `getCompareSummaryByMode()` — モード別平均スコア集計
- `buildCompareLogHtml()` — Output Engineに棒グラフ＋直近10件一覧表示
- Export（markdown / json）に比較ログ自動反映
- Git: d7ed771 / Tag: v1.00-phase46-4

### Phase46-5: Compare Intelligence v1 ✅
- `COMPARE_INTELLIGENCE_VERSION = '1.0.0'`
- `analyzeCompareIntelligence()` — mode別/outputType別/InjectionImpact集計 + recommendations生成
- `getCompareModeWinner()` — 平均スコア最高モードを判定
- `getOutputTypeCompareInsights()` — outputType別傾向コメント
- `getKnowledgeInjectionImpact()` — 注入あり/なし差分（positive/negative/neutral/unknown）
- `buildCompareIntelligenceHtml()` — Output Engineに分析パネル表示
- `appendCompareIntelligenceToExportMarkdown/Json()` — Export反映
- Git: 75c0bf4 / Tag: v1.00-phase46-5

### Phase46-6: Compare Recommendation Engine v1 ✅
- `COMPARE_RECOMMENDATION_VERSION = '1.0.0'`
- `buildCompareRecommendations()` — priorityItems / outputTypeRecommendations / knowledgeRecommendations / reviewerHints / learningHints / cautionItems 生成
- `getCompareRecommendationPriority()` — high/medium/low 判定
- `buildCompareRecommendationHtml()` — Output Engine に改善提案パネル表示
- `appendCompareRecommendationToExportMarkdown/Json()` — Export反映
- Git: 7a43619 / Tag: v1.00-phase46-6

### Phase46-7: Compare Quality Integration Check v1 ✅
- `COMPARE_INTEGRATION_CHECK_VERSION = '1.0.0'`
- `buildCompareIntegrationCheck()` — ログ/Intelligence/Recommendation の統合整合性チェック
- `getCompareIntegrationStatus()` — ready/partial/insufficient 判定
- `buildCompareIntegrationCheckHtml()` — Output Engine に Integration Check パネル表示
- `appendCompareIntegrationCheckToExportMarkdown/Json()` — Export反映
- Git: 9b64683 / Tag: v1.00-phase46-7

### Phase46-8: Compare Intelligence v2 ✅
- `COMPARE_IMPROVEMENT_VERSION = '2.0.0'`
- `buildCompareFailureAnalysis()` — Hook/CTA/Knowledge/Structure/Images/OutputType/Length 失敗率分析
- `buildImprovementScores()` — 5カテゴリ 0〜100点スコア（Knowledge注入効果・Guide有無反映）
- `buildCompareLearning()` — SUCCESS/FAIL/QUALITY/IMPROVEMENT 4パターン自動分類
- `buildLeaderImprovementSummary()` — 「今回改善すべきポイント」自動生成
- Output Engine: 📊 Improvement Score / 🔍 Failure Analysis / 🎓 Compare Learning / 💡 Leader Improvement Summary パネル追加
- Export（markdown / json）に Compare Improvement v2 セクション追加
- Git: 48e2e3c / Tag: v1.00-phase46-8

### Phase46-9: 次フェーズ ⬜

---

# Phase47（API料金メーター / コスト最適化）

### Phase47-1: API料金メーター ✅
- `costTracker.js` — 日次/月次/累計 + 日付リセット(todayKey/monthKey) + 旧データ移行
- `claudeCostTracker.js`（新規）— Claude API料金永続化 / claude-cost-logs.json / モデル別集計
- `claudeClient.js` — trackUsage()末尾でaddClaudeUsage()呼び出し（モジュールレベルrequire）
- `server.js` — /api/claude-cost エンドポイント追加
- `index.html` — #cost-panel-body 完全再構成（上部=合計 / Provider別=OpenAI+Claude / 右上ヘッダー=合計）
- `updateCostProviderPanel()` — 3エンドポイント並行取得・合計計算・上部+ヘッダー反映
- Git: Phase47-1 API cost meter / Tag: v1.00-phase47-1

### Phase47-1.6: OpenAI費用トラッカー累計対応（正式化）✅
Phase47-1完了直後にOpenAI版`costTracker.js`へ日次/月次/累計トラッキングを追加する作業が行われ、対応するフロントエンド（`index.html`の`cp-oa-total`表示、`// Phase47-1.6 累計`コメント）はPhase47-2Aのコミット（5a7d2d3）に含まれてコミット済みだったが、バックエンド側`costTracker.js`のコミットが漏れ、Phase47-2A〜Phase48-4まで未コミットのまま作業ツリーに残存していたことが判明。今回、内容を検証したうえで正式にコミットし、Phase47-1.6として記録する。

- `costTracker.js`
  - `_todayKey()` / `_monthKey()` — 日付キー生成ヘルパー追加
  - `DEFAULT_STATE` / `normalizeState()` に `todayKey` / `monthKey` / `totalAmount` を追加（`claudeCostTracker.js`と同一の設計パターン）
  - `ensureState()` — 旧データ移行（`todayKey`未設定時に既存`monthlyAmount`を`totalAmount`へ退避し、today/monthlyを0からリスタート）+ 日付変更時のtoday/monthly個別リセット（total は変更しない）
  - `addOpenAIUsage()` / `costTracker.recordUsage()` — `totalAmount`への加算処理を追加
  - `costTracker.getSummary()` — 戻り値に `totalAmount` / `todayKey` / `monthKey` を追加
- `cost-logs.json` — 上記コードの実行結果として、旧`monthlyAmount`（37.21円）が`totalAmount`へ移行され、その後の実利用分を含め`totalAmount: 49.20`円として永続化
- 検証内容:
  - dev-check 200/200/200 を実施し、既存コードとの整合性を確認
  - `/api/cost` で `todayAmount` / `monthlyAmount` / `totalAmount` / `todayKey` / `monthKey` の5項目すべてが正常に返ることを確認
  - ブラウザ実機確認（Chrome Preview）でAPI料金メーターパネルの「OpenAI API」内「累計」が `49.20円` と正しく表示されることを確認（`cp-oa-total`要素）
  - console.errorなし。既存のOpenAI/Claude Provider別表示・右上ヘッダー合計・Claude側の集計には影響なし
- `claude-cost-logs.json` / `claude-quality-history.json` は今回はコミット対象外とする（Phase47-1・Phase47-5で実装済みのコード生成データだが、一度もgit追跡されたことがなく、`cost-logs.json`との追跡方針の統一は別途判断が必要なため）
- モデル変更・Provider構成変更・新規API追加・DB変更は一切なし
- Git: Phase47-1.6 openai cost tracker total / Tag: v1.00-phase47-1.6

### Phase47-2A: Claude Cost Analysis（分析のみ）✅
- `claudeCostTracker.js` — `CLAUDE_COST_ANALYSIS_VERSION = '1.0.0'` / `getClaudeCostAnalysis()`追加
  - totalRequests / totalInputTokens / totalOutputTokens / totalTokens / totalCost / todayCost / monthCost
  - byModel（モデル別料金・トークン・リクエスト数）
  - byRole（strategy=claude-opus-4-8専用のため実測、writer/reviewerはclaude-sonnet-4-6共有のため`writer_reviewer_combined`として合算・担当別判定なし）
  - topCostModel / topTokenModel / analysisWarnings
- `server.js` — 既存 `/api/claude-cost` に `analysis` フィールドとして追加（新規API追加なし）
- `index.html` — 料金メーターへ「🔍 Claude Cost Analysis」パネル追加（`renderClaudeCostAnalysis()`）
  - 総リクエスト数 / 総トークン数 / 総料金 / モデル別内訳 / 最高額モデル / 最多利用モデル / 担当別利用状況 / 分析上の注意（analysisWarnings）
  - Phase47-2Aは分析のみ・Provider構成変更なし・Claudeモデル変更なし・Phase47-2Bでモデル最適化予定 の注意書き表示
- モデル変更・Provider変更・Compare Intelligenceへの反映は一切なし
- Git: 5a7d2d3 / Tag: v1.00-phase47-2A

### Phase47-2B: モデル最適化 ✅
- `claudeClient.js` — `CLAUDE_MODEL_POLICY_VERSION = '1.0.0'` / `CLAUDE_MODEL_POLICY` / `getClaudeModelForRole(role)` 追加
  - `CLAUDE_HIGHEST_QUALITY_MODEL = 'claude-opus-4-8'`（既存モデル・strategy専用）
  - `CLAUDE_LOWEST_COST_MODEL = 'claude-haiku-4-5'`（既存コード内定義済みモデル・writer/reviewerに適用）
  - `CLAUDE_MODEL_MAP` は `getClaudeModelForRole()` の結果を反映する形に更新（strategy=opus / writer・reviewer=haiku）
  - `CLAUDE_PRICE_PER_1K` に haiku 価格を追加（claudeCostTracker.jsと同一値）
  - `callClaudeAI()` / `generateClaudeReply()` / `testClaudeAgent()` の呼び出し箇所を `getClaudeModelForRole()` 経由に変更
- `server.js` — `workflowAgentCaller()` のmodel表示を`getClaudeModelForRole()`経由に変更 / `/api/claude-cost` に `modelPolicy`（policy・currentModels・providerChanged・leader）を追加
- `index.html` — Claude Cost Analysis内に「⚙️ Claude Model Policy」パネル追加（`renderClaudeModelPolicy()`）
- 実API接続テストで確認: Strategy→claude-opus-4-8 / Writer→claude-haiku-4-5 / Reviewer→claude-haiku-4-5
- Provider構成（Leader=OpenAI / Strategy・Writer・Reviewer=Claude）は一切変更なし
- 既知の限界: `claudeCostTracker.js`のbyRole集計はsonnet固定ロジックのため、Phase47-2B以降のwriter/reviewer(haiku)利用は担当別集計に反映されない（byModelには正しく反映）。次フェーズ以降で対応要検討。
- Git: Phase47-2B claude model optimization / Tag: v1.00-phase47-2B

### Phase47-2C: Claude Model Quality Compare ✅
- `claudeCostTracker.js` — `CLAUDE_MODEL_QUALITY_COMPARE_VERSION = '1.0.0'` / `buildClaudeModelQualityCompare(currentModels)` 追加
  - `CLAUDE_PREVIOUS_POLICY`（Phase47-2B前の固定構成: strategy=opus / writer・reviewer=sonnet）
  - previousPolicy / currentPolicy / comparisonItems / costImpact（Sonnet→Haiku単価差: 入力・出力とも73.3%減） / qualityCheckItems（9項目） / adoptionReadiness / warnings を返却
  - `readyForPhase47_2D: false` 固定（今回は比較準備フェーズ、正式採用は未判定）
- `server.js` — `/api/claude-cost` に `qualityCompare` を追加（currentModelsを渡して生成）
- `index.html` — Claude Model Policyパネル下に「🧪 Claude Model Quality Compare」パネル追加（`renderClaudeModelQualityCompare()`）
  - Before Optimization / After Optimization / Cost Impact / Quality Check Items / Adoption Readiness / Warnings を表示
- モデル変更は一切なし（実API接続テストでwriter→claude-haiku-4-5のまま変化なしを確認）
- Provider構成変更なし
- Git: Phase47-2C claude quality compare / Tag: v1.00-phase47-2C

### Phase47-2D: Claude Model Formal Adoption ✅
- `claudeCostTracker.js` — `CLAUDE_MODEL_ADOPTION_VERSION = '1.0.0'` / `buildClaudeModelAdoptionStatus(currentModels, qualityCompare)` 追加
  - adoptionStatus（status="adopted" / phase="Phase47-2D" / adoptedAt / readyForNextPhase=true）
  - adoptedPolicy: strategy=claude-opus-4-8（維持） / writer・reviewer=claude-haiku-4-5（正式採用） / defaultClaudeRole=claude-haiku-4-5 / leader=openai
  - adoptionReason / costReductionSummary（qualityCompare.costImpactを再利用） / qualityDecision（qualityRisk="monitoring_required"） / providerStatus / nextActions / warnings
  - adoptionReadiness更新: `readyForPhase47_2D: true` / `formalAdoptionCompleted: true` / `qualityComparisonPending: false`
- `server.js` — `/api/claude-cost` に `adoptionStatus` を追加
- `index.html` — Claude Model Quality Comparingパネル下に「✅ Claude Model Formal Adoption」パネル追加（`renderClaudeModelAdoptionStatus()`）
  - Formal Adoption Status / Adopted Claude Model Policy / Cost Reduction Summary / Quality Monitoring Note / Provider Status / Next Actions
- モデル変更は行っていない（正式採用の記録・表示のみ。実API接続テストでwriter→claude-haiku-4-5、strategy→claude-opus-4-8のまま変化なしを確認）
- Provider構成変更なし
- Git: Phase47-2D claude model adoption / Tag: v1.00-phase47-2D

### Phase47-3: Claude Quality Monitor（Compare Intelligence連携） ✅
- `claudeCostTracker.js` — `CLAUDE_QUALITY_MONITOR_VERSION = '1.0.0'` / `buildClaudeQualityMonitor(compareData)` 追加
  - `compareData`はCompare Intelligence v2 `buildImprovementScores()`（index.html・ブラウザ内メモリのみ、サーバー側に永続化なし）の戻り値と同一形状 `{ overall, hook, cta, knowledge, structure, images, sampleSize }` を呼び出し側から受け取る設計。スコアは推測せず既存値のみ使用
  - qualityStatus（excellent/good/watch/critical・overallスコアの閾値判定） / monitoringRequired / qualityScore / recommendation（Keep Current Policy/Monitor Quality/Consider Sonnet/Need Manual Review） / issues（カテゴリ別60点未満を検出） / categoryScores / summary / warnings
  - サンプル数3未満・データ未受信時は`watch`+`Need Manual Review`で保留表示（モデル自動切替は一切行わない）
- `server.js` — `/api/claude-cost` に `qualityMonitor` を追加。Compare Intelligenceのスコアはブラウザ内メモリにしか存在しないため、任意のqueryパラメータ（overall/sampleSize/hookScore等）経由で受け取る方式で連携（未指定時はデータ不足として扱う）
- `index.html` — `updateCostProviderPanel()`が既存の `buildImprovementScores()` を呼び出し、結果を `/api/claude-cost` のqueryへ付与。Claude Model Formal Adoptionパネル下に「📊 Claude Quality Monitor」パネル追加（`renderClaudeQualityMonitor()`）
  - Current Quality / Monitoring Status / Overall Score / Recommendation / Detected Issues / Warnings を表示
- Compare Intelligenceの新しい比較ロジックは追加せず、既存の`buildImprovementScores()`のスコアのみ利用
- モデル変更・自動切替は一切なし（実API接続テストでwriter→claude-haiku-4-5、strategy→claude-opus-4-8のまま変化なしを確認）。Provider構成変更なし
- Git: Phase47-3 quality monitor / Tag: v1.00-phase47-3

### Phase47-4: Claude Quality History（時系列品質監視） ✅
- `claudeCostTracker.js` — 追加関数・Version
  - `CLAUDE_QUALITY_HISTORY_VERSION = '1.0.0'` / `recordClaudeQualityHistory(entry)` / `getClaudeQualityHistory()`
    - `_claudeQualityHistory[]`（メモリ内・最大20件・FIFO。timestamp/workflowId/outputType/provider/model/overallScore/status/recommendation/cost/tokensを保持）
    - 短時間内（3秒以内）の同一スコア連続記録は重複防止のためスキップ
  - `CLAUDE_QUALITY_TREND_VERSION = '1.0.0'` / `buildClaudeQualityTrend()` — Excellent/Good/Watch/Critical件数・平均/最高/最低スコアを集計
  - `CLAUDE_QUALITY_WARNING_VERSION = '1.0.0'` / `buildClaudeQualityWarning()` — 直近5件平均 vs 前5件平均で5%以上低下ならWarning（履歴10件未満は判定保留）。モデル自動変更は一切行わない
- `server.js` — `/api/claude-cost` に `qualityHistory` / `qualityTrend` / `qualityWarning` を追加（新規APIなし）。実スコア受信時（overallパラメータあり）のみ履歴へ記録
- `index.html` — Claude Quality Monitorパネル下に「📈 Claude Quality History」パネル追加（`renderClaudeQualityHistory()`）
  - 平均品質 / Excellent・Good・Watch・Critical件数 / 品質推移（直近10件） / 品質悪化Warning
  - Export（Markdown/JSON）へ`appendClaudeQualityHistoryToExportMarkdown()` / `appendClaudeQualityHistoryToExportJson()`を追加（既存Export関数群と同じ呼び出しパターンで連結）
  - `_lastClaudeCostResponse`をキャッシュし、Export時に最新の qualityHistory/qualityTrend/qualityWarning を利用
- 動作確認: 高スコア5件→低スコア5件を連続投入し、Excellent:5/Watch:5・degradationDetected:true（33.3%低下）を確認。15件追加投入で20件キャップ・FIFO動作を確認
- モデル変更・自動切替は一切なし（実API接続テストでwriter→claude-haiku-4-5、strategy→claude-opus-4-8のまま変化なしを確認）。Provider構成変更なし
- 既知の制限: 履歴はメモリ内のみでサーバー再起動によりリセットされる（永続化なし）→ Phase47-5でJSON永続化により解消
- Git: Phase47-4 quality history / Tag: v1.00-phase47-4

### Phase47-S: v1.00 Stable確定 ✅
Phase47-2A〜Phase47-4で完成したClaude APIコスト最適化・品質監視機能一式の最終確認・安定化フェーズ。新機能追加なし、不具合修正のみ許可（今回は不具合なし）。

確認結果:
- `/api/claude-cost` に必要な全フィールド（analysis / modelPolicy / qualityCompare / adoptionStatus / qualityMonitor / qualityHistory / qualityTrend / qualityWarning）が正常取得できることを確認
- 正式採用モデル維持を確認: Strategy=claude-opus-4-8 / Writer=claude-haiku-4-5 / Reviewer=claude-haiku-4-5（実API接続テストで実測確認）、自動切替の仕組みは存在しないことを確認
- Provider構成変更なしを確認: Leader=OpenAI固定 / Strategy・Writer・Reviewer=Claude固定
- UIパネル表示順序を確認: Claude Cost Analysis → Claude Model Policy → Claude Model Quality Compare → Claude Model Formal Adoption → Claude Quality Monitor → Claude Quality History（index.html DOM順で確認）
- Export（Markdown/JSON）にQuality History等が正しく接続されていることを確認（`appendClaudeQualityHistoryToExportMarkdown/Json`の呼び出しを確認）
- Phase47-2A〜47-4で追加した全関数（9関数）に重複定義がないことを確認
- 既存API（/, /api/task-history, /api/workflow-dashboard, /api/cost, /api/claude-status, /api/knowledge-stats）が全て200を維持していることを確認
- dev-check 200/200/200
- 修正ファイル: なし（不具合が見つからなかったため、コード変更は今回発生せず）
- Git: Phase47-S v1.00 stable / Tag: v1.00-stable

### Phase47-5: Claude Quality History永続化 ✅
- `claudeCostTracker.js`
  - `CLAUDE_QUALITY_HISTORY_STORAGE_PATH`（`claude-quality-history.json`・既存`claude-cost-logs.json`と同様のJSON永続化パターン、新規DB作成なし）
  - `_ensureClaudeQualityHistoryLoaded()` — 遅延ロード。`recordClaudeQualityHistory()` / `buildClaudeQualityTrend()` / `buildClaudeQualityWarning()` / `getClaudeQualityHistory()` の各関数冒頭で呼び出し、初回アクセス時にディスクから復元
  - `_saveClaudeQualityHistory()` — `recordClaudeQualityHistory()`実行時に自動でJSONファイルへ保存（最大20件・古いものから削除は既存仕様のまま維持）
- `server.js` / `index.html` / Export: 変更なし（既存`/api/claude-cost`のqualityHistory/qualityTrend/qualityWarningが復元後データを返す。新規APIなし）
- 動作確認: 3件記録→ファイル保存確認→dev-check再起動→GETのみ（recordを呼ばず）で3件復元・qualityTrend正常再計算を確認。さらに20件投入で永続化状態でも20件キャップ・FIFOが正常動作することを確認
- モデル変更・自動切替は一切なし（実API接続テストでwriter→claude-haiku-4-5、strategy→claude-opus-4-8のまま変化なしを確認）。Provider構成変更なし
- Git: Phase47-5 quality history persistence / Tag: v1.00-phase47-5

---

# Phase48（成果物品質強化）

### Phase48-1: Output Package Quality Checklist ✅
- `index.html`
  - `OUTPUT_PACKAGE_QUALITY_VERSION = '1.0.0'`
  - `OUTPUT_PACKAGE_QUALITY_TYPE_MAP` — 実際のOUTPUT_TYPE_DEFINITIONS（13種）→ チェックリストカテゴリ（instagram/video/flyer/lp/pdf/html/generic）の対応。存在しない型名（video_script/proposal/estimate等）は追加せず、実在する型のみ対応
  - `OUTPUT_PACKAGE_QUALITY_CHECKS` — カテゴリ別チェック項目定義。各項目は`d.fields`内の候補キー（fieldKeys）で存在確認。fieldKeysが空の項目は現行テンプレートに対応フィールドが存在しないため常に「未検出」として扱う（Phase48-2のテンプレート拡張候補として活用）
  - `evaluateOutputPackageCompleteness(draft)` 追加 — version/outputType/category/score/status/missingItems/completedItems/recommendations/nextActionsを返却
  - score: 0〜100（完成項目数/全項目数）、status: 90以上=complete / 75以上=almost_ready / 50以上=needs_work / 49以下=insufficient
  - `buildOutputPackageQualityHtml()` — Output Engineパネル内「✅ Output Package Quality」表示、`renderOutputEnginePanel()`のbuild chainへ追加
  - Export: `appendOutputPackageQualityToExportMarkdown/Json()` をserializeOutputDraft()のMarkdown/JSON両方に接続
- ロジック検証（Node vm実行）: instagram_carousel部分入力→30点(insufficient)、全schema埋まった状態→70点(needs_work、targetAudience/benefit/saveSharePromptがテンプレート未対応のため上限)、pdf→57点、未知の型→genericへフォールバック、ドラフト未生成→0点で正常動作を確認
- 成果物生成ロジックの変更なし（品質チェックのみ追加）。画像/動画生成API・SNS投稿機能・PDF生成ライブラリ・HTML自動保存機能は追加していない
- モデル変更・Provider構成変更は一切なし
- 既知の発見: 複数の成果物タイプでチェック項目の一部（CTA等）が現行テンプレートに対応フィールドを持たないことが判明（例: flyer/pdf/html/videoにCTA用フィールドなし）。Phase48-2の成果物テンプレート強化で対応検討
- Git: Phase48-1 output package quality / Tag: v1.00-phase48-1

### Phase48-2: 成果物テンプレート強化 ✅
- `index.html`
  - `OUTPUT_PACKAGE_QUALITY_VERSION` を`1.0.0`→`1.1.0`へ更新、`OUTPUT_PACKAGE_TEMPLATE_VERSION = '1.0.0'`追加
  - `OUTPUT_TYPE_DEFINITIONS.outputFields` を全11対象タイプ（instagram_carousel/tiktok_video/youtube_shorts/lp/flyer/pdf/html/image_prompt/video_prompt/document）へ既存フィールドを維持したまま追加（削除・リネームなし）
  - `OUTPUT_PACKAGE_QUALITY_TYPE_MAP` — image_prompt/video_promptを専用カテゴリへ変更（従来generic/video共有）。documentをpdfカテゴリへ統一（PDF/document/proposal系を同一構成に）
  - `OUTPUT_PACKAGE_QUALITY_CHECKS` — 新規フィールドに対応するfieldKeysを設定し、多数の項目が`hasSchemaField: false`→`true`へ改善。image_prompt/video_promptの専用チェックリストを新規追加
  - `OUTPUT_PACKAGE_QUALITY_RECOMMENDATIONS` — 新規チェック項目（subject/style/composition/lighting/background/negativePrompt/usage/scene/cameraMotion/subjectMotion）の改善提案文を追加
- ロジック検証（Node vm実行）: 全対象タイプ（instagram_carousel/tiktok_video/flyer/pdf/html/image_prompt/video_prompt/document/lp）で全フィールド入力時に**score=100, status=complete**を確認。特にInstagram Carouselは従来上限70点→100点まで到達可能に改善
- 後方互換性確認: 新規フィールド未入力の既存データ相当（旧5フィールドのみ）でもscore=70のまま変化なし（回帰なし）。ただし`hasSchemaField`がtrueに変わり「テンプレート未対応」の注記が解消
- 生成ロジック（`buildOutputDraftFromLeaderFinal()`等）は一切変更していない（スキーマ・チェックリスト定義のみ追加）。画像/動画生成API・SNS投稿機能・PDF生成ライブラリ・外部API追加はなし
- モデル変更・Provider構成変更は一切なし（実API接続テストでwriter→claude-haiku-4-5、strategy→claude-opus-4-8のまま変化なしを確認）
- Git: Phase48-2 output templates enhancement / Tag: v1.00-phase48-2

### Phase48-3: Output Auto Fill Engine ✅
- `index.html`
  - `_extractLabeledSection()` / `_extractHashtagsFromText()` / `_extractCtaFromText()` — テキスト解析ベースの汎用抽出ヘルパーを新設（新規AI呼び出し・課金なし）
  - `_getRoleReplyText(agentId)` — `_atTaskHistory`からWriter/Strategy/Designer個別回答を検索し補助情報として利用
  - `buildOutputDraftFromLeaderFinal()` を11タイプ全てへ拡張し、Phase48-2で追加した新規フィールドをラベル抽出・キーワード検出・汎用フォールバックで自動反映
  - `buildOutputPackageQualityHtml()` に90点未満時の改善バナーを追加（改善ループ）
  - 生成直後に`evaluateOutputPackageCompleteness()`を実行し`_lastOutputDraft.packageQuality`へ保持
- ロジック検証（Node vm実行、`buildOutputDraftFromLeaderFinal()`を実際に実行）: instagram_carousel/tiktok_video/flyer/lp/pdf/html/image_prompt/video_promptの8タイプ全てでラベル付きサンプルテキストからscore=100・status=completeへ到達することを確認
- Writer/Designer補助の実動作確認: finalTextに情報がなくてもWriter個別回答からoffer/proof/area/contact、Designer個別回答からlayoutInstruction/imageInstructionが正しく反映されることを確認（混在テストでscore=89）
- 誠実性の担保: 連絡先・エリア・具体的オファー等の実在しない事実は捏造せず、ラベル未検出時は空のまま。スタイル系項目のみ汎用既定値を設定
- Workflow / Compare / Learning の呼び出し箇所は一切変更なし。Provider構成・Claudeモデル変更なし
- index.htmlのみ変更（指示書により今回はdocs更新スキップ、Phase48-3.1で正式反映）
- Git: Phase48-3 output draft builder enhancement / Tag: v1.00-phase48-3

### Phase48-3.1: docs正式反映・ロードマップ整備 ✅
- Phase47-5〜48-3の完成状況を docs/01PROJECT_STATUS.md へ正式反映
- docs/04ROADMAP.md を新規作成（v1.0〜v2.0開発ロードマップ）
- コード変更なし（docsのみ）

### Phase48-4: Output Preview Engine ✅
- `index.html`
  - CSS: `.oe-preview-*` / `.oe-ig-*`（Instagram） / `.oe-lp-*`（LP・HTML共有） / `.oe-flyer-*` / `.oe-pdf-*` / `.oe-html-frame*` / `.oe-vid-*`（TikTok・YouTube Shorts）を新規追加（既存`.oe-pkg-*`は無変更）
  - `OUTPUT_PREVIEW_VERSION = '1.0.0'` / `OUTPUT_PREVIEW_TYPES`（instagram_carousel/lp/flyer/pdf/document/html/tiktok_video/youtube_shorts の8タイプ、ROADMAP記載の7カテゴリ相当）
  - `buildInstagramCarouselPreviewHtml()` — スマホ枠+スライド1枚+ドット+キャプション+ハッシュタグのInstagram風モックアップ
  - `buildLpPreviewHtml()` — ブラウザ風枠+ヒーロー見出し+セクション（problem/solution/benefits/proof/flow/faq、無ければ`sections`配列にフォールバック）+CTAボタン
  - `buildFlyerPreviewHtml()` — A4比率カード+キャッチコピー+画像プレースホルダー+オファー枠+連絡先
  - `buildPdfPreviewHtml()` — ページ風カード+タイトル+要約+セクション一覧（pdf/document両方で共用）
  - `buildHtmlPreviewHtml()` — `f.html`があれば`<iframe sandbox="" srcdoc="...">`で実際に生成されたHTMLをそのまま描画（scriptは`sandbox=""`で完全ブロック、XSS対策済み）。無ければLP風の構造化フォールバック表示
  - `buildVideoPreviewHtml()` — 縦型動画枠+台本+尺/BGM/エンディング/CTAメタ表示（tiktok_video・youtube_shorts共用）
  - `buildOutputPreviewHtml()` — Preview汎用ディスパッチャー。`_lastOutputDraft.packageQuality`（Phase48-1のスコア）を右上バッジ表示（Decision 022のPreview+Qualityスコア連動ループを実装）。対象外タイプ・データなし・型未対応時は空文字を返し例外を出さない
  - `_escSrcdoc()` — srcdoc属性への埋め込み用エスケープ（`&`と`"`のみ。iframe内容としての`<``>`はそのまま保持）
  - `renderOutputEnginePanel()` の `_oeSafe()` チェーンへ `buildOutputPreviewHtml` を `buildOutputPackageQualityHtml` の直後に追加（Package表示・Export・既存パネルは無変更で維持）
- ブラウザ実機確認（Chrome Preview、`_lastOutputDraft`にサンプルデータを注入し`renderOutputEnginePanel()`を直接呼び出す方式 = Phase48-1〜48-3と同じNode vm検証に相当するAPI課金なしの確認手法）
  - instagram_carousel（100点）/ lp（89点）/ flyer（67点）/ pdf（71点）/ html（33点、iframeで実際にHTML描画確認）/ tiktok_video（70点）の6サンプルで正常表示・バッジ色（complete/almost_ready/needs_work/insufficient）を確認
  - HTMLプレビューの`<script>`タグ注入テストでJS実行がブロックされること（`window.top.__xssFired`が発火しない）を確認
  - 空フィールド・未対応タイプ（image_prompt）・ドラフト未生成（null）で例外が発生せず空文字を返すことを確認
  - console.errorなし
- 生成ロジック（`buildOutputDraftFromLeaderFinal()`）・Package表示・Export・Workflow・Knowledge Chainは一切変更していない。新規API・外部通信・課金は一切なし（既存`_lastOutputDraft.fields`をクライアント側で描画するのみ）
- モデル変更・Provider構成変更は一切なし
- `.claude/launch.json` を実サーバー（`node server.js`）起動に修正（従来`npx serve`の静的配信設定は本アプリのExpressサーバーと不整合だったため）
- 次工程: Phase48-5 Publishing Engine
- Git: Phase48-4 output preview engine / Tag: v1.00-phase48-4

### Phase48-5: Publishing Engine ✅
- `index.html`
  - CSS: `.oe-pub-*`（section/title/hashtags/list-item/check-item/warning/copyrow/copybtn/copymsg）を新規追加（既存`.oe-pkg-*`/`.oe-preview-*`は無変更）
  - `PUBLISHING_ENGINE_VERSION = '1.0.0'` / `PUBLISHING_SUPPORTED_TYPES`（instagram_carousel/tiktok_video/youtube_shorts/flyer/lp/html/pdf/image_prompt/video_prompt/documentの10タイプ）
  - `createPublishingDraft(outputDraft)` — Publishing Draft生成の中核ディスパッチャー。type別に`_fillPublishingXxx(base, f)`（1責務1関数）を呼び分け、共通スキーマ（version/outputType/title/description/hashtags/publishTimeSuggestion/imageList/videoList/cta/copyText/checklist/warnings/sourcePreviewVersion/qualityScore）を返す
  - `_fillPublishingInstagram()` 他9関数 — 各Output Typeごとのタイトル/説明文/ハッシュタグ/画像・動画一覧/CTA/チェックリストを既存`_lastOutputDraft.fields`から抽出・整形（不足データは安全なfallback、実在しない事実は捏造しない）
  - `_pubPadHashtags()` — Instagram（15〜30件）/TikTok（5〜15件）/YouTube Shorts（3〜10件、`#Shorts`含む）のハッシュタグ数を既存ハッシュタグ+キーワード抽出+汎用フィラータグ（`#PR`/`#おすすめ`等の一般的SNSタグのみ、具体的な事実は含まない）で調整
  - `_pubTruncate()` / `_pubToHashtagArray()` / `_pubBuildCopyText()` — 汎用ヘルパー
  - Quality連携: `outputDraft.packageQuality`（Phase48-1）の`score`を`qualityScore`へ格納し、80点未満の場合のみ`warnings`へ「公開前にHook・CTA・構成を再確認してください」を追加
  - Preview連携: `type`が`OUTPUT_PREVIEW_TYPES`（Phase48-4）に含まれる場合のみ`sourcePreviewVersion`へ`OUTPUT_PREVIEW_VERSION`を格納。image_prompt/video_promptなどPreview非対応タイプでもPublishing Engineは独立して動作することを確認済み
  - `buildPublishingEngineHtml()` — `renderOutputEnginePanel()`の`_oeSafe()`チェーンへ`buildOutputPreviewHtml`の直後に追加。Publish Title/Description/Hashtags/Best Time/Media List（画像・動画）/CTA/Checklist/Warnings/Copyボタン群を表示
  - `copyPublishingField(fieldKey)` — Copy Title/Description/Hashtags/CTA/All Publishing Dataの5ボタンに対応。`navigator.clipboard.writeText()`＋フォールバック（オフスクリーンtextarea+execCommand）。既存`copyExportOutput()`/`oe-export-textarea`は無変更
  - `appendPublishingToExportMarkdown(lines)` / `appendPublishingToExportJson(payload)` — `serializeOutputDraft()`のMarkdown（`## Publishing Engine (Phase48-5)`）/JSON（`publishing`キー）両方に反映。既存Export構造・他セクションは無変更
- ブラウザ実機確認（Chrome Preview、`_lastOutputDraft`にサンプルデータを注入し`renderOutputEnginePanel()`を直接呼び出す方式 = Phase48-4と同じAPI課金なしの確認手法）
  - 10タイプ全て（instagram_carousel/tiktok_video/youtube_shorts/flyer/lp/html/pdf/image_prompt/video_prompt/document）でPublishing Engineパネル表示・各フィールド値を確認
  - Instagram: ハッシュタグ15件（15〜30件の範囲内）、TikTok: 5件（5〜15件）、YouTube Shorts: 3件（3〜10件、`#Shorts`含む）を確認
  - Quality連携: instagram_carousel（100点・warnings無し）/ tiktok_video（80点・境界値で警告無し=「未満」判定が正しいことを確認）/ その他80点未満の全タイプで警告文が正しく追加されることを確認
  - Preview連携: image_prompt/video_promptで`sourcePreviewVersion`が`null`（Preview非対応）でもPublishing Engineが正常動作することを確認
  - Export: Markdown/JSON双方に`Publishing Engine`セクション・`publishing`キーが正しく反映されることを確認
  - Copy機能: 5ボタンとも例外なく実行されることを確認（`navigator.clipboard.writeText()`呼び出し成功）
  - console.errorなし。既存Package表示・Preview Engine・Quality Score・Knowledge/Compare各パネルへの影響なし
- 生成ロジック（`buildOutputDraftFromLeaderFinal()`）・Preview Engine・Package表示・Workflow・Knowledge Chainは一切変更していない。新規API・外部通信・画像/動画生成・SNS投稿・課金は一切なし（既存`_lastOutputDraft.fields`からクライアント側で投稿用データを整形するのみ）
- モデル変更・Provider構成変更は一切なし
- 次工程: Phase49 AI Creative Engine（画像・動画生成、ユーザー承認後のみ）
- Git: Phase48-5 publishing engine / Tag: v1.00-phase48-5

---

# Phase49（Version2着手 / Roadmap整理）

### Phase49-0: Version2設計レビュー ✅
- コード変更なし・docs変更なし（レビューのみ、チャット上で提出）
- Phase49〜54の責務レビューを実施し、以下の問題を確認
  - Phase49系にCreative（生成）とIntelligence（分析）が混在（旧Phase49-1 Instagram Intelligenceは分析、Phase49本体・49-2は生成系）
  - 旧Phase49-1（Instagram Intelligence）とPhase50（Marketing Intelligence）のアルゴリズム分析が重複
  - 旧Phase50-1（Image Prompt Intelligence）が家族違い（Creative系なのにIntelligence系の番号）
  - Phase51・53・54がPhase49・50と異なりサブフェーズ化されておらず肥大化リスクあり
  - Phase53の「コスト分析」「品質分析」が既存Phase47/46/48と重複するリスク
  - `loadCompanyBrain()`/`renderCompanyBrain()`を確認し、現行Company Brainは読み取り専用の集計ダッシュボードであることを実コードで確認。一方`autonomousConsult`フラグ・`toggleAutonomousConsult()`は既存の自律相談機能の下地として存在することを確認
- 改善案として、Creative/Intelligence/Sales/Automation/Business Intelligence/Company Brainの6ファミリーへの責務再編、AI Gateway・Asset Libraryの新設、Company Brain v2のサブフェーズ分割を提案
- 次工程: Phase49-0.1 Version2 Roadmap Formalization（docs正式反映）

### Phase49-0.1: Version2 Roadmap Formalization ✅
- Phase49-0のレビュー内容をdocsへ正式反映（コード変更なし・index.html/server.js/package.json/DB関連ファイル一切変更なし）
- `docs/04ROADMAP.md` — Version 2.0を6ファミリー（Creative Engine / Intelligence / Sales / Automation / Business Intelligence / Company Brain v2）× 全19サブフェーズへ正式整理。旧Phase49-1（Instagram Intelligence）→Phase50-2（Platform Intelligence）、旧Phase50-1（Image Prompt Intelligence）→Phase49-2へ移動
- `docs/00ENBISOU_AI_COMPANY_MASTER.md` — 現在Version・Version2最優先（AI Gateway/Creative Prompt Intelligence/Asset Library）・Provider構成維持を明記
- `docs/04DECISIONS.md` — Decision 027（Roadmap責務分離型再構成）/ Decision 028（AI Gateway採用）/ Decision 029（Asset LibraryはKnowledge Libraryとは別物）を追記
- `docs/06HANDOVER_NEXT_CHAT.md` / `docs/01PROJECT_STATUS.md` — 現在地・次工程（Phase49-1 AI Gateway Foundation）を更新
- 次工程: Phase49-1 AI Gateway Foundation（設計・骨格構築。実行連携は行わない）
- Git: Phase49-0.1 roadmap formalization / Tag: v1.00-phase49-0.1

### Phase49-1: AI Gateway Foundation ✅
- `index.html`
  - CSS: `.oe-gw-*`（section/title/badge/warning/registry-chip/copyrow/copybtn/copymsg）を新規追加（既存`.oe-pkg-*`/`.oe-preview-*`/`.oe-pub-*`は無変更）
  - `AI_GATEWAY_VERSION = '1.0.0'` / `AI_SKILL_REGISTRY`（ChatGPT/Claude/GPT Image/Seedance/DOMOAI/Genspark/Flow/Veo/Kling/Runway/Luma/Pika/Hailuoの13ツール、各id/name/type/supportedModes/strengths/costLevel/qualityLevel/speedLevel/executionStatus/requiresApproval/notesを保持）
  - `AI_GATEWAY_TASK_TOOL_MAP` — OUTPUT_TYPE_DEFINITIONS全13タイプに候補ツールを対応（image系: instagram_carousel/instagram_post/flyer/image_prompt→GPT Image、video系: tiktok_video/youtube_shorts/video_prompt→Seedance、text系: lp/html/pdf/document/powerpoint/excel→ChatGPT・`textOnly`フラグでprompt_only固定）
  - `getAISkillById(id)` / `createAIGatewayDecision(outputDraft)` — Registry+マップからrecommendedTool/recommendedRoute/reason/costLevel/qualityLevel/speedLevel/requiresApproval/allowedNow/warnings/fallbackToolsを算出。`allowedNow`は`recommendedRoute`が`prompt_only`/`manual_copy`の場合のみtrue（api_candidate/browser_candidate/desktop_candidateは常にrequiresApproval:true・allowedNow:false）
  - `isAIGatewayExecutionAllowed(decision, actionType)` — api/external_comm/pc_operation/browser_operation/image_generation/video_generation/sns_postは恒久的にfalse、prompt_generation/copy_textのみtrue、未知のactionTypeはfalse（安全側デフォルト）を返すハード安全ゲート
  - `_gwBuildDecisionSummary()` / `_gwBuildToolPrompt()`（既存`_pubTruncate`等Publishing Engineヘルパーを流用） / `_gwBuildManualInstructions()` — Copy用テキスト生成ヘルパー
  - `buildAIGatewayHtml()` — `renderOutputEnginePanel()`の`_oeSafe()`チェーンへ`buildPublishingEngineHtml`の直後に追加。Recommended Tool/Route/Reason/Cost・Quality・Speed/Approval Required/Allowed Now/Warnings/Fallback Tools/AI Skill Registry Summary（接続数バッジ付き）を表示
  - `copyGatewayField(fieldKey)` — Copy Gateway Decision/Copy Tool Prompt/Copy Manual Instructionsの3ボタンに対応。`navigator.clipboard.writeText()`＋フォールバック（既存Publishing Copyと同一パターン、独立実装）
  - `appendAIGatewayToExportMarkdown(lines)` / `appendAIGatewayToExportJson(payload)` — `serializeOutputDraft()`のMarkdown（`## AI Gateway (Phase49-1)`）/JSON（`aiGateway`キー）に反映。既存Export構造・他セクションは無変更
  - Publishing Engine連携: `outputDraft.publishing`（Phase48-5）が存在すればタイトルを判断理由に使用、`packageQuality`/`publishing.qualityScore`が80点未満の場合はwarningsへ追加。Publishing Draftが存在しない・未生成でも安全に動作することを確認（fallback）
- ブラウザ実機確認（Chrome Preview、`_lastOutputDraft`にサンプルデータを注入し`renderOutputEnginePanel()`を直接呼び出す方式 = Phase48-4/48-5と同じAPI課金なしの確認手法）
  - OUTPUT_TYPE_DEFINITIONS全13タイプでAI Gatewayパネル表示・判断結果を確認
  - image系（instagram_carousel/instagram_post/flyer/image_prompt）→ recommendedTool=GPT Image・route=api_candidate・allowedNow=false・requiresApproval=trueを確認
  - video系（tiktok_video/youtube_shorts/video_prompt）→ recommendedTool=Seedance・route=browser_candidate・allowedNow=false・requiresApproval=trueを確認
  - text系（lp/html/pdf/document/powerpoint/excel）→ recommendedTool=ChatGPT・route=prompt_only・allowedNow=true・requiresApproval=falseを確認（fallback表示を確認）
  - 未定義の将来タイプ・`_lastOutputDraft`がnullの場合・Publishing Draft未生成の場合でも例外が発生せず安全にfallback（manual_copy等）することを確認
  - `isAIGatewayExecutionAllowed()`の全アクション種別（api/external_comm/pc_operation/browser_operation/image_generation/video_generation/sns_post/prompt_generation/copy_text/未知の値）で正しい真偽値を返すことを確認
  - Markdown/JSON Export双方に`AI Gateway`セクション・`aiGateway`キーが正しく反映されることを確認
  - Copy 3ボタンとも例外なく実行されることを確認
  - console.errorなし。既存Package表示・Preview Engine・Publishing Engine・Quality Score・Knowledge/Compare各パネルへの影響なし
- 生成ロジック（`buildOutputDraftFromLeaderFinal()`）・Preview/Publishing Engine・Workflow・Knowledge Chainは一切変更していない。新規API・外部通信・実際の画像/動画生成・PCアプリ操作・ブラウザ自動操作・SNS投稿・課金は一切なし（判断材料の算出とプロンプト/コピー用テキストの表示のみ）
- モデル変更・Provider構成変更は一切なし（Leader=OpenAI固定 / Writer・Reviewer・Strategy=Claude固定を維持。AI Skill Registry内のChatGPT/Claudeエントリも「Provider構成は変更しない」旨をnotesに明記）
- 次工程: Phase49-2 Image Prompt Intelligence
- Git: Phase49-1 ai gateway foundation / Tag: v1.00-phase49-1

### Phase49-1.1: AI Registry Expansion ✅
- `index.html`（Phase49-1のAI Gateway Foundationを壊さず拡張。既存12フィールド・`AI_SKILL_REGISTRY`・`AI_GATEWAY_TASK_TOOL_MAP`・`isAIGatewayExecutionAllowed()`は無変更）
  - `AI_REGISTRY_EXPANSION_VERSION = '1.0.0'`
  - `AI_CAPABILITY_REGISTRY` — 13ツール×12能力（writing/review/coding/imagePrompt/imageGeneration/videoPrompt/videoGeneration/research/marketing/design/automation/businessAnalysis）を0〜5または`'unknown'`で定義。推測での高評価はせず、未検証の能力は安全な低い値または`unknown`とした
  - `AI_HEALTH_REGISTRY` — 各ツールのconnectionStatus/apiStatus/browserStatus/desktopStatus/lastChecked/riskLevel/healthNotes。ChatGPT/Claudeのみ`connected_text_only`（実際にAPI接続済みだがテキスト用途のみ）、他11ツールは`not_connected`。実際の疎通確認は行っていない（静的定義のみ）
  - `AI_COST_PROFILE` — costType/costLevel/subscriptionRequired/apiBilling/freePlanAvailable/costNotes。ChatGPT/Claudeは`api_usage`（Phase47コストメーターと整合）、他11ツールは`unknown`
  - `AI_APPROVAL_PROFILE_TEMPLATE` / `getApprovalProfile(toolId)` — 承認要否はツールではなくアクション種別で一律決定（promptGeneration/copyTextのみ不要、他6項目は全て要承認）。`isAIGatewayExecutionAllowed()`と同じ安全方針をProfile化
  - `AI_ROUTE_PRIORITY` — 12用途（text_generation/review/coding/image_prompt/image_generation/video_prompt/video_generation/research/marketing/design/sales_document/automation）別の推奨ツール順位
  - `AI_GATEWAY_TASK_USECASE_MAP` / `AI_USECASE_CAPABILITY_KEY` — OUTPUT_TYPE_DEFINITIONS全13タイプを12用途へ対応付け
  - `AI_VERSION_REGISTRY` — `AI_SKILL_REGISTRY`から機械的に生成（手動重複定義なし）。toolId/registryVersion/supportedSince/lastPolicyReview/notes
  - `_gwGetCapability()` / `_gwGetHealthStatus()` / `_gwGetCostProfile()` / `_gwIsToolConnected()` / `_gwGetRoutePriority()` / `_gwComputeSelectionConfidence()` — 1責務1関数のRegistry参照ヘルパー
  - `createAIGatewayDecision()` — 既存12フィールド（version/taskType/recommendedTool/recommendedRoute/reason/costLevel/qualityLevel/speedLevel/requiresApproval/allowedNow/warnings/fallbackTools）は完全に無変更。返り値へ`capabilityScore`/`healthStatus`/`costProfile`/`approvalProfile`/`routePriority`/`registryVersion`/`selectionConfidence`/`registryWarnings`の8フィールドを追加のみ
  - `_gwBuildRegistrySummary()` / `_gwBuildRouteRecommendation()` — Copy用テキスト生成の追加ヘルパー
  - `copyGatewayField()` — `registrySummary`/`routeRecommendation`の2ケースを追加（既存3ケースは無変更）
  - `buildAIGatewayHtml()` — Capability Score/Health Status/Cost Profile/Approval Profile/Route Priority/Selection Confidence/Registry Warningsをコンパクト表示。Copy Registry Summary/Copy Route Recommendationの2ボタンを追加（既存3ボタンは無変更）
  - `appendAIGatewayToExportMarkdown()` — 新規7項目を追記（既存項目は無変更）。JSON Exportは`payload.aiGateway = decision`が`decision`全体を代入する既存実装のため、新規フィールドは自動的に反映される（コード変更不要）
  - CSSは既存`.oe-gw-*`を再利用（新規クラス追加なし）
- ブラウザ実機確認（Chrome Preview、`_lastOutputDraft`にサンプルデータを注入する方式）
  - OUTPUT_TYPE_DEFINITIONS全13タイプでPhase49-1の既存4フィールド（recommendedTool/recommendedRoute/allowedNow/requiresApproval）が完全に同一の値を返すことを確認（回帰なし）
  - 新規8フィールドが全13タイプで正しく算出されることを確認（例: instagram_carousel→capabilityScore=5/GPT Image・image_generation用途、video_prompt→capabilityScore=1/Seedance・低スコアで正しくselectionConfidence=low、tiktok_video/youtube_shorts→routePriorityCount=9で全video系ツールを列挙）
  - 未定義の将来タイプ・draft自体がnullの場合でも新規フィールドが安全にfallback（capabilityScore='unknown'、healthStatus=null、routePriority=[]、selectionConfidence='low'）することを確認
  - Markdown/JSON Export双方に新規7項目が反映されることを確認
  - Copy 5ボタン（Registry Summary・Route Recommendationの新規2つ含む）とも例外なく実行されることを確認
  - `isAIGatewayExecutionAllowed()`の回帰確認（全アクション種別で従来通りの真偽値）
  - console.errorなし。既存Package表示・Preview Engine・Publishing Engine・Quality Score・Knowledge/Compare各パネルへの影響なし
- 生成ロジック・Preview/Publishing Engine・Workflow・Knowledge Chainは一切変更していない。新規API・外部通信・実際の画像/動画生成・PCアプリ操作・ブラウザ自動操作・SNS投稿・課金は一切なし
- モデル変更・Provider構成変更は一切なし
- 次工程: Phase49-2 Image Prompt Intelligence
- Git: Phase49-1.1 ai registry expansion / Tag: v1.00-phase49-1.1

### Phase49-1.2: AI Registry Learning ✅
- `index.html`（Phase49-1/49-1.1のAI Gateway Foundation・Registry Expansionを壊さず拡張。既存フィールド・関数は無変更）
  - `AI_REGISTRY_LEARNING_VERSION = '1.0.0'`
  - `AI_REGISTRY_LEARNING` — `AI_SKILL_REGISTRY`から機械的に初期化（13ツール分、手動重複定義なし）。各エントリ: successCount/failureCount/qualityAverage/speedAverage/costAverage/lastUsed/lastUpdated/confidence/recommendationScore/learningVersion。初期状態は全ツールとも実績0件
  - `calculateAIConfidence(toolId)` — 実績数・成功率・更新日時の鮮度から low/medium/high を判定（実績5件未満または30日超の陳腐化でlow、20件未満または成功率60%未満でmedium、それ以外high）
  - `calculateAIRecommendationScore(toolId)` — 成功率(35%)・品質(30%)・速度(15%)・コスト(20%)の加重平均をConfidenceで中立値50へブレンドし0〜100を算出。実績0件は中立値50を返す（推測で高評価/低評価にしない）
  - `recordAIRegistryLearning(toolId, quality, cost, speed, success, actionType)` — 呼び出し関数のみ用意。Workflow等からの自動呼び出しは行っていない（実際のAPI実績はまだ保存しない）。未登録toolIdは安全にnullを返す
  - `buildAIRegistryLearningSummary()` — 全13ツールの現在のLearning状況（totalRuns/successRate/recommendationScore/confidence/lastUsed）を生成
  - `_gwLearningStatus(totalRuns, confidence)` — no_data/learning/building_confidence/established の4段階判定
  - `createAIGatewayDecision()` — 既存フィールド（Phase49-1の12種+Phase49-1.1の8種）は完全に無変更。返り値へ`learning`オブジェクト（version/recommendationScore/confidence/status/count/successRate/warnings）を1つ追加のみ
  - `_gwBuildLearningSummary()` — Copy用テキスト生成の追加ヘルパー
  - `copyGatewayField()` — `learningSummary`ケースを追加（既存5ケースは無変更）
  - `buildAIGatewayHtml()` — Learning Status/Recommendation Score/Learning Confidence/Success Rate/Learning Count/Learning Warningsを追加表示。Copy Learning Summaryボタンを追加（既存5ボタンは無変更）
  - `appendAIGatewayToExportMarkdown()` — Learning Summary/Recommendation Score/Confidence/Learning Count/Success Rate/Learning Warningsを追記（既存項目は無変更）。JSON Exportは`payload.aiGateway = decision`が`decision.learning`を自動的に含むため、コード変更不要で`aiGateway.learning`が反映される
- ブラウザ実機確認（Chrome Preview、`_lastOutputDraft`にサンプルデータを注入する方式）
  - 全13 OUTPUT_TYPEで既存フィールド（recommendedTool/recommendedRoute等）が完全に同一の値を返すことを確認（回帰なし）。初期状態では全タイプで`learning.status='no_data'`・`count=0`・`recommendationScore=50`・`successRate=null`を確認
  - `recordAIRegistryLearning('gpt_image', ...)`を3回手動呼び出し（成功2件・失敗1件）し、successCount/failureCount/qualityAverage（移動平均）/confidence/recommendationScoreが正しく更新されることを確認。呼び出し前の`beforeCount=0`により、Workflow等からの自動呼び出しが一切発生していないことも確認
  - 未登録toolId（存在しないツールID）への記録が安全にnullを返すことを確認
  - `buildAIRegistryLearningSummary()`が13ツール分のサマリーを正しく生成することを確認
  - 学習データ反映後、同一ツールを推奨する別のOutputType（image_prompt）で`learning`情報が正しく更新済みの値を返すことを確認（セッション内の学習反映を確認）
  - Markdown Export（Learning Summary等6項目）・JSON Export（`aiGateway.learning`）双方への反映を確認
  - Copy 6ボタン（Learning Summary含む）とも例外なく実行されることを確認
  - console.errorなし。既存Package表示・Preview/Publishing Engine・Quality Score・AI Gateway Foundation（Phase49-1）・Registry Expansion（Phase49-1.1）への影響なし
  - dev-check再起動によりテスト用Learningデータ（インメモリ）がリセットされ、コードベースは初期状態（全ツール実績0件）を維持することを確認
- 生成ロジック・Preview/Publishing Engine・Workflow・Knowledge Chainは一切変更していない。新規API・外部通信・実際の画像/動画生成・PCアプリ操作・ブラウザ自動操作・SNS投稿・課金は一切なし
- モデル変更・Provider構成変更は一切なし
- 次工程: Phase49-2 Image Prompt Intelligence
- Git: Phase49-1.2 ai registry learning / Tag: v1.00-phase49-1.2

### Phase49-2: Image Prompt Intelligence ✅
- `index.html`（Phase49-1/49-1.1/49-1.2のAI Gateway一式・Publishing/Preview Engineを壊さず拡張。既存コードは無変更）
  - `IMAGE_PROMPT_INTELLIGENCE_VERSION = '1.0.0'`
  - `createImagePromptIntelligenceDraft(outputDraft)` — version/outputType/mainPrompt/negativePrompt/stylePrompt/compositionPrompt/lightingPrompt/cameraPrompt/colorPrompt/formatPrompt/platformPrompts/safetyChecklist/copyText/warnings/sourceGatewayDecision/qualityScoreを生成
  - Output Type別最適化（1責務1関数）: `_ipiFillInstagram()`（縦長4:5・統一感・読みやすさ）/ `_ipiFillFlyer()`（A4・余白・文字配置）/ `_ipiFillLp()`（ヒーロー画像・CTA導線・Web向け）/ `_ipiFillDocument()`（資料用ビジュアル・説明図・清潔感、pdf/document共用）/ `_ipiFillImagePromptEnhance()`（既存プロンプトの高品質化）/ `_ipiFillGeneric()`（安全な汎用プロンプト、上記以外の全タイプ）
  - `_ipiBuildPlatformPrompts()` — GPT Image/ChatGPT Image/Midjourney/Flux/Ideogram/Recraftの6ツール形式でプロンプトを整形（Midjourneyは`--ar`/`--no`フラグ形式、Flux/SDはタグ形式、GPT Image/ChatGPTは自然文形式、Ideogramは画像内テキスト指定に対応）。実行は一切しない
  - `_ipiSafetyChecklist()` / `_ipiBuildWarnings()` / `_ipiBuildCopyText()` — 共通ヘルパー
  - AI Gateway連携: `outputDraft.aiGateway || createAIGatewayDecision(outputDraft)`からrecommendedTool/recommendedRoute/routePriority/capabilityScore/learningを`sourceGatewayDecision`として参照（コピーではなく必要項目のみ抽出、実行はしない）
  - `_ipiToolKeyForGatewayTool()` — AI Gatewayの推奨ツール名（GPT Image/ChatGPT）をplatformPromptsキーへ対応付け。画像特化ツールが明確でない場合はGPT Imageへ安全にfallback
  - `copyImagePromptField()` — Copy Main Prompt/Copy Negative Prompt/Copy Tool Prompt（AI Gateway推奨ツールのプロンプトをコピー）/Copy All Image Promptsの4ケース
  - `buildImagePromptIntelligenceHtml()` — `renderOutputEnginePanel()`内、`buildAIGatewayHtml`の直後に表示。Main/Negative/Style/Composition/Lighting/Camera/Color/Format/Tool Prompts（6ツール）/Safety Checklist/Warningsを表示
  - `appendImagePromptIntelligenceToExportMarkdown()` / `appendImagePromptIntelligenceToExportJson()` — Export（Markdown`## Image Prompt Intelligence`セクション/JSON`imagePromptIntelligence`キー）に反映
  - CSS: `.oe-ipi-*`（section/title/tool-card/tool-name/check-item/warning/copyrow/copybtn/copymsg）を新規追加
- ブラウザ実機確認（Chrome Preview、`_lastOutputDraft`にサンプルデータを注入する方式）
  - OUTPUT_TYPE_DEFINITIONS全13タイプ（instagram_carousel/instagram_post/flyer/lp/pdf/document/image_prompt/tiktok_video/youtube_shorts/video_prompt/powerpoint/excel/html）でImage Prompt Intelligenceパネル表示・6ツール分のTool Promptsが生成されることを確認。html/tiktok_video等の未分類タイプはGeneric fallbackへ正しく分岐することを確認
  - AI Gateway連携: instagram_carousel/flyer/image_prompt→GPT Image、tiktok_video/youtube_shorts/video_prompt→Seedance、lp/pdf/document等→ChatGPTがsourceGatewayDecision.recommendedToolに正しく反映されることを確認
  - Markdown/JSON Export双方への反映を確認（JSON: platformPrompts 6キー全て確認）
  - Copy 4ボタンとも例外なく実行されることを確認
  - console.errorなし。既存Package表示・Preview Engine・Publishing Engine・AI Gateway（Foundation/Expansion/Learning）・Quality各パネルへの影響なし
- 生成ロジック・Preview/Publishing/AI Gateway・Workflow・Knowledge Chainは一切変更していない。新規API・外部通信・実際の画像生成・PCアプリ操作・ブラウザ自動操作・SNS投稿・課金は一切なし（プロンプト・コピー用テキストの生成のみ）
- モデル変更・Provider構成変更は一切なし
- 次工程: Phase49-3 Video Prompt Intelligence
- Git: Phase49-2 image prompt intelligence / Tag: v1.00-phase49-2

### Phase49-3: Video Prompt Intelligence ✅
- `index.html`（Phase49-1〜49-1.2のAI Gateway一式・Phase49-2のImage Prompt Intelligence・Publishing/Preview Engineを壊さず拡張。既存コードは無変更）
  - `VIDEO_PROMPT_INTELLIGENCE_VERSION = '1.0.0'`
  - `createVideoPromptIntelligenceDraft(outputDraft)` — version/outputType/mainPrompt/scenePrompt/motionPrompt/cameraPrompt/lightingPrompt/stylePrompt/audioPrompt/captionPrompt/durationPrompt/formatPrompt/negativePrompt/platformPrompts/safetyChecklist/copyText/warnings/sourceGatewayDecision/sourceImagePromptIntelligence/qualityScoreを生成
  - Output Type別最適化（1責務1関数）: `_vpiFillTikTok()`（縦型・冒頭フック・テンポ・字幕） / `_vpiFillYouTubeShorts()`（縦型・3秒フック・視聴維持・サムネ想定） / `_vpiFillInstagram()`（Reels/カルーセル動画化・統一感・短尺） / `_vpiFillVideoPromptEnhance()`（既存動画プロンプト高品質化） / `_vpiFillImagePromptToVideo()`（Image-to-Video前提） / `_vpiFillLp()`（ヒーロー動画・CTA導線） / `_vpiFillFlyerPdfDocument()`（チラシ・資料の動画広告化、flyer/pdf/document共用） / `_vpiFillGeneric()`（それ以外の全タイプへの安全な汎用fallback）
  - `_vpiBuildPlatformPrompts()` — Seedance/Flow/Veo/Kling/Runway/Luma/Pika/Hailuo/DOMOAIの9ツール形式でプロンプトを整形（各ツールの特性差異を軽く反映、実行はしない）
  - `_vpiSafetyChecklist()` / `_vpiBuildWarnings()` / `_vpiBuildCopyText()` — 共通ヘルパー
  - AI Gateway連携: `outputDraft.aiGateway || createAIGatewayDecision(outputDraft)`からrecommendedTool/recommendedRoute/routePriority/capabilityScore/learningを`sourceGatewayDecision`として参照
  - Image Prompt Intelligence連携: `outputDraft.imagePromptIntelligence || createImagePromptIntelligenceDraft(outputDraft)`からmainPrompt（visual base）/stylePrompt（動画style）/compositionPrompt（scenePromptへ反映）を`sourceImagePromptIntelligence`として参照。画像生成はしない
  - `_vpiToolKeyForGatewayTool()` — AI Gatewayの推奨ツール名（Seedance/Flow/Veo/Kling/Runway/Luma/Pika/Hailuo/DOMOAI）をplatformPromptsキーへ対応付け。不明な場合はSeedanceへ安全にfallback
  - `copyVideoPromptField()` — Copy Main Video Prompt/Copy Tool Video Prompt（AI Gateway推奨ツールのプロンプトをコピー）/Copy Scene Prompt/Copy All Video Promptsの4ケース
  - `buildVideoPromptIntelligenceHtml()` — `renderOutputEnginePanel()`内、`buildImagePromptIntelligenceHtml`の直後に表示。Main/Scene/Motion/Camera/Lighting/Style/Audio/Caption/Duration/Format/Negative Prompt/Tool Prompts（9ツール）/Safety Checklist/Warningsを表示
  - `appendVideoPromptIntelligenceToExportMarkdown()` / `appendVideoPromptIntelligenceToExportJson()` — Export（Markdown`## Video Prompt Intelligence`セクション/JSON`videoPromptIntelligence`キー）に反映
  - CSS: `.oe-vpi-*`（section/title/tool-card/tool-name/check-item/warning/copyrow/copybtn/copymsg）を新規追加
- ブラウザ実機確認（Chrome Preview、`_lastOutputDraft`にサンプルデータを注入する方式）
  - OUTPUT_TYPE_DEFINITIONS全13タイプ（tiktok_video/youtube_shorts/instagram_carousel/instagram_post/video_prompt/image_prompt/lp/flyer/pdf/document/powerpoint/excel/html）でVideo Prompt Intelligenceパネル表示・9ツール分のTool Promptsが生成されることを確認。powerpoint/excel/html等はGeneric fallbackへ正しく分岐することを確認
  - AI Gateway連携: tiktok_video/youtube_shorts/video_prompt→Seedance、instagram/flyer/image_prompt→GPT Image、lp/pdf/document等→ChatGPTがsourceGatewayDecision.recommendedToolに正しく反映されることを確認
  - Image Prompt Intelligence連携: 全13タイプで`sourceImagePromptIntelligence`が正しく参照されることを確認（Image Prompt Intelligence自体もGeneric fallbackを持つため、未分類タイプでも連携が途切れないことを確認）
  - Markdown/JSON Export双方への反映を確認（JSON: platformPrompts 9キー全て確認）
  - Copy 4ボタンとも例外なく実行されることを確認
  - console.errorなし。既存Package表示・Preview Engine・Publishing Engine・AI Gateway（Foundation/Expansion/Learning）・Image Prompt Intelligence・Quality各パネルへの影響なし
- 生成ロジック・Preview/Publishing/AI Gateway/Image Prompt Intelligence・Workflow・Knowledge Chainは一切変更していない。新規API・外部通信・実際の動画生成・画像生成・PCアプリ操作・ブラウザ自動操作・SNS投稿・課金は一切なし（プロンプト・コピー用テキストの生成のみ）
- モデル変更・Provider構成変更は一切なし
- 次工程: Phase49-4 Creative Engine Execution
- Git: Phase49-3 video prompt intelligence / Tag: v1.00-phase49-3

### Phase49-4: Creative Execution ✅
- `index.html`（Phase49-1〜49-3のAI Gateway/Image・Video Prompt Intelligence・Publishing/Preview Engineを一切変更せず参照のみで拡張。名称は「Execution」だが自動実行は行わない）
  - `CREATIVE_EXECUTION_VERSION = '1.0.0'` / `CREATIVE_TOOL_PLANNER`（ChatGPT/Claude/GPT Image/Seedance/Flow/Veo/Runway/Kling/Pika/Luma/DOMOAI/Hailuo/Ideogram/Flux/Midjourney/Recraftの16ツール。貼り付け先の案内のみ、実行しない）
  - `createCreativeExecutionDraft(outputDraft)` — executionName/executionType/targetTool/targetRoute/requiredInputs/generatedPrompt/copyTarget/executionSteps/manualSteps/estimatedTime/estimatedCost/difficulty/approvalRequired/warnings/checklist/fallback/notes/autoExecute/executionMode/toolPlanner/sourceGatewayDecision/copyTextを生成
  - `autoExecute` は常に`false`、`executionMode`は常に`'manual_only'`にハード固定（Decision 035）
  - `_ceExecutionTypeFor()` — OutputTypeをimage_generation/video_generation/text_generationへ分類
  - `_ceSelectGeneratedPrompt()` — Image Prompt Intelligence（`_ipiToolKeyForGatewayTool()`）/ Video Prompt Intelligence（`_vpiToolKeyForGatewayTool()`）の既存関数を呼び出すのみで再利用し、AI Gateway推奨ツールに応じたプロンプトを選択。text系はPublishing Engineの`copyText`を流用
  - `_ceBuildExecutionSteps()` — STEP1（Output Preview確認）〜STEP7（成果物保存）の7段階を生成
  - `_ceBuildManualSteps()` / `_ceBuildChecklist()` — ツール別の手動貼り付け手順・チェック項目を生成（Image/Video Prompt Intelligenceの安全チェックリスト有無に応じて項目を追加）
  - `copyCreativeExecutionField()` — Copy Execution Plan/Copy Manual Steps/Copy Full Workflow/Copy Checklistの4ケース
  - `buildCreativeExecutionHtml()` — `renderOutputEnginePanel()`内、`buildVideoPromptIntelligenceHtml`の直後に表示。「MANUAL ONLY」バッジ・Execution Summary/Generated Prompt/Execution Steps/Manual Workflow/Tool Planner（16種、推奨ツールをハイライト）/Execution Checklist/Warningsを表示
  - `appendCreativeExecutionToExportMarkdown()` / `appendCreativeExecutionToExportJson()` — Export（Markdown`## Creative Execution`セクション/JSON`creativeExecution`キー）に反映
  - CSS: `.oe-ce-*`（section/title/step-item/tool-chip/check-item/warning/badge/copyrow/copybtn/copymsg）を新規追加
- ブラウザ実機確認（Chrome Preview、`_lastOutputDraft`にサンプルデータを注入する方式）
  - OUTPUT_TYPE_DEFINITIONS全13タイプでCreative Executionパネル表示・`autoExecute===false`・`executionMode==='manual_only'`・Tool Planner16種を確認
  - executionType判定: instagram/flyer/image_prompt→image_generation（targetTool=GPT Image）、tiktok/youtube/video_prompt→video_generation（targetTool=Seedance）、その他→text_generation（targetTool=ChatGPT）を確認
  - Generated PromptがImage/Video Prompt Intelligenceの該当ツール向けプロンプトを正しく再利用していることを確認
  - Tool Plannerの推奨ツールチップ（`recommended`クラス）がAI Gateway推奨ツールと一致することを確認
  - Markdown/JSON Export双方への反映を確認（JSON: `autoExecute: false`・`toolPlanner`16件を確認）
  - Copy 4ボタンとも例外なく実行されることを確認
  - console.errorなし。既存Package表示・Preview Engine・Publishing Engine・AI Gateway（Foundation/Expansion/Learning）・Image/Video Prompt Intelligence・Quality各パネルへの影響なし
- AI Gateway判断ロジック（`createAIGatewayDecision`）・Image Prompt Intelligence（`createImagePromptIntelligenceDraft`）・Video Prompt Intelligence（`createVideoPromptIntelligenceDraft`）は一切変更せず、読み取り専用で参照するのみ。新規API・外部通信・実際の画像/動画生成・PCアプリ操作・ブラウザ自動操作・SNS投稿・課金は一切なし（実行計画・コピー・チェックのみ）
- モデル変更・Provider構成変更は一切なし
- 次工程: Phase49-5 Creative Ad Assembly
- Git: Phase49-4 creative engine execution / Tag: v1.00-phase49-4

### Phase49-5: Creative Ad Assembly ✅
- `index.html`（Phase49-1〜49-4のAI Gateway/Image・Video Prompt Intelligence/Creative Execution・Publishing/Preview Engineを一切変更せず参照のみで拡張。広告素材を「組み立てる」層であり実行・投稿はしない）
  - `CREATIVE_AD_ASSEMBLY_VERSION = '1.0.0'` / `CREATIVE_AD_ASSEMBLY_SAFETY_LABELS`（Assembly Only/No Auto Posting/No Image Generation/No Video Generation/No External AI Execution/Manual Use Onlyの6ラベルを固定バッジとして常時表示）
  - `createCreativeAdAssemblyDraft(outputDraft)` — version/outputType/campaignName/adGoal/targetPlatform/creativeSet/headlineSet/captionSet/ctaSet/visualDirection/imageAssetsPlan/videoAssetsPlan/lpDirection/postingPlan/manualAssemblySteps/qualityChecklist/copyText/warnings/sourcePublishing/sourceGatewayDecision/sourceImagePromptIntelligence/sourceVideoPromptIntelligence/sourceCreativeExecutionを生成
  - Output Type別最適化（1責務1関数）: `_caaFillInstagram()`（カルーセル広告/Reels広告） / `_caaFillTikTok()`（縦型動画広告/冒頭フック） / `_caaFillYouTubeShorts()`（Shorts広告/サムネ方針） / `_caaFillFlyer()`（チラシ広告セット/QR誘導） / `_caaFillLp()`（広告→LP誘導/ヒーローコピー） / `_caaFillHtml()`（Web広告素材） / `_caaFillDocument()`（営業資料広告、pdf/document共用） / `_caaFillImagePrompt()`（画像広告素材セット） / `_caaFillVideoPrompt()`（動画広告素材セット） / `_caaFillGeneric()`（それ以外の全タイプへの安全な汎用fallback）
  - Publishing（`createPublishingDraft`）/ AI Gateway（`createAIGatewayDecision`）/ Image Prompt Intelligence（`createImagePromptIntelligenceDraft`）/ Video Prompt Intelligence（`createVideoPromptIntelligenceDraft`）/ Creative Execution（`createCreativeExecutionDraft`）の**既存関数を呼び出すのみ**で必要項目を抽出（各判断ロジックは無変更）
  - `_caaBuildCreativeSet()` / `_caaBuildQualityChecklist()` / `_caaBuildWarnings()` / `_caaBuildCopyText()` — 共通ヘルパー
  - `copyCreativeAdAssemblyField()` — Copy Ad Set/Copy Headlines/Copy Captions/Copy CTA Set/Copy Assembly Checklistの5ケース
  - `buildCreativeAdAssemblyHtml()` — `renderOutputEnginePanel()`内、`buildCreativeExecutionHtml`の直後に表示。Safetyバッジ6種・Campaign Name/Ad Goal/Target Platform/Headline Set/Caption Set/CTA Set/Visual Direction/Image・Video Assets Plan/LP Direction/Posting Plan/Quality Checklist/Warningsを表示
  - `appendCreativeAdAssemblyToExportMarkdown()` / `appendCreativeAdAssemblyToExportJson()` — Export（Markdown`## Creative Ad Assembly`セクション/JSON`creativeAdAssembly`キー）に反映
  - CSS: `.oe-caa-*`（section/title/item/check-item/warning/badge/copyrow/copybtn/copymsg）を新規追加
- ブラウザ実機確認（Chrome Preview、`_lastOutputDraft`にサンプルデータを注入する方式）
  - OUTPUT_TYPE_DEFINITIONS全13タイプでCreative Ad Assemblyパネル表示・Output Type別のadGoal/targetPlatform/headline/CTA件数が正しく生成されることを確認
  - Instagram（保存・シェア促進/CTA2件）/ TikTok（視聴維持/CTA1件）/ YouTube Shorts（登録・視聴維持）/ Flyer（来店促進/QR誘導CTA含む）/ LP（CV獲得）/ HTML（サイト誘導）/ PDF・Document（商談化）/ Image・Video Prompt（広告訴求力向上）/ powerpoint・excel（汎用fallback）を確認
  - Markdown/JSON Export双方への反映を確認
  - Copy 5ボタンとも例外なく実行されることを確認
  - console.errorなし。既存Package表示・Preview Engine・Publishing Engine・AI Gateway（Foundation/Expansion/Learning）・Image/Video Prompt Intelligence・Creative Execution・Quality各パネルへの影響なし
- AI Gateway/Image Prompt Intelligence/Video Prompt Intelligence/Creative Executionの判断ロジックは一切変更せず、読み取り専用で参照するのみ。新規API・外部通信・実際の画像/動画生成・PCアプリ操作・ブラウザ自動操作・SNS投稿・課金は一切なし（広告素材の組み立て・コピー・チェックのみ）
- モデル変更・Provider構成変更は一切なし
- 次工程: Phase49-6 Asset Library（Creative Engineファミリー最終Phase）
- Git: Phase49-5 creative ad assembly / Tag: v1.00-phase49-5

### Phase49-6: Creative Asset Library ✅（Creative Engineファミリー最終Phase）
- `index.html`（Phase49-1〜49-5のAI Gateway/Image・Video Prompt Intelligence/Creative Execution/Creative Ad Assembly・Publishing/Preview Engineを一切変更せず、既存6関数の呼び出しのみで構成。新規判断・生成ロジックは追加していない）
  - `CREATIVE_ASSET_LIBRARY_VERSION = '1.0.0'` / `CREATIVE_ASSET_LIBRARY_SAFETY_LABELS`（Asset Library Only/No External Execution/No AI Generation/Manual Reuse Only/Read Onlyの5ラベルを固定バッジとして常時表示）
  - `createCreativeAssetLibraryDraft(outputDraft)` — `createCreativeAdAssemblyDraft()` / `createCreativeExecutionDraft()` / `createImagePromptIntelligenceDraft()` / `createVideoPromptIntelligenceDraft()` / `createPublishingDraft()` / `createAIGatewayDecision()`の**既存6関数の呼び出しのみ**でassetCollection/campaign/createdTime/headlineAssets/captionAssets/ctaAssets/imagePromptAssets/videoPromptAssets/publishingAssets/creativeExecutionAssets/assemblyAssets/assetTags/reusableAssets/favorite/archive/searchKeywords/warnings/copyTextを生成。Output Type別の分岐・新規判断は一切行わない（Decision 037）
  - `favorite`/`archive`は常に`false`固定（静的プレースホルダー、新規永続化・DB変更なし）
  - `_calBuildAssetTags()` / `_calBuildReusableAssets()` / `_calBuildSearchKeywords()` / `_calBuildWarnings()` / `_calBuildCopyText()` — 既存データからの機械的抽出のみ（AIによる新規タグ生成なし）
  - `copyCreativeAssetLibraryField()` — Copy Asset Package/Copy Headline Assets/Copy Caption Assets/Copy Prompt Assets/Copy Tags/Copy Full Asset Libraryの6ケース
  - `buildCreativeAssetLibraryHtml()` — `renderOutputEnginePanel()`内、`buildCreativeAdAssemblyHtml`の直後に表示。Asset Collection/Campaign/Output Type/Created Time/Headline・Caption・CTA・Image Prompt・Video Prompt Assets/Publishing・Creative Execution・Assembly Assets/Asset Tags/Reusable Assets/Favorite・Archive/Search Keywords/Warningsを表示
  - `appendCreativeAssetLibraryToExportMarkdown()` / `appendCreativeAssetLibraryToExportJson()` — Export（Markdown`## Creative Asset Library`セクション/JSON`creativeAssetLibrary`キー）に反映
  - CSS: `.oe-cal-*`（section/title/item/tag-chip/warning/badge/copyrow/copybtn/copymsg）を新規追加
- ブラウザ実機確認（Chrome Preview、`_lastOutputDraft`にサンプルデータを注入する方式）
  - OUTPUT_TYPE_DEFINITIONS全13タイプでAsset Libraryパネル表示・favorite/archiveが常にfalseであることを確認
  - Instagram（タグ8件、ハッシュタグ含む）等、Output Type別にAsset Tags/Search Keywordsの件数が既存データに応じて変動することを確認（新規判断ではなく既存データの機械的抽出であることを確認）
  - Markdown/JSON Export双方への反映を確認
  - Copy 6ボタンとも例外なく実行されることを確認
  - console.errorなし。既存Package表示・Preview Engine・Publishing Engine・AI Gateway（Foundation/Expansion/Learning）・Image/Video Prompt Intelligence・Creative Execution・Creative Ad Assembly・Quality各パネルへの影響なし
- AI Gateway/Image Prompt Intelligence/Video Prompt Intelligence/Creative Execution/Creative Ad Assemblyの判断ロジックは一切変更せず、読み取り専用（既存6関数の呼び出しのみ）で参照するのみ。新規API・外部通信・実際の画像/動画生成・PCアプリ操作・ブラウザ自動操作・SNS投稿・課金は一切なし（Asset管理・コピー・Exportのみ）
- モデル変更・Provider構成変更は一切なし
- Creative Engineファミリー（Phase49-1〜49-6）完結。次工程: Phase50-1 Marketing Intelligence Foundation（Intelligenceファミリー）
- Git: Phase49-6 creative asset library / Tag: v1.00-phase49-6

---

# v1.0まで

☑ Workflow Live完成（Phase43）
☑ Output Engine完成（Phase44）
☑ Learning Engine（Phase45-2）
☑ Company Memory（Phase45-3〜4）
☑ Knowledge Save + Guard（Phase45-6）
☑ Knowledge Inject（Phase45-7）
☑ Leader Intelligence（Phase46-2）
☑ Knowledge Compare（Phase46-3）
☑ 実案件品質比較記録（Phase46-4）
☑ Compare Intelligence v1（Phase46-5）
☑ Compare Recommendation Engine v1（Phase46-6）
☑ Compare Quality Integration Check v1（Phase46-7）
☑ Compare Intelligence v2 — Improvement Score / Failure Analysis / Learning / Summary（Phase46-8）
□ Instagram完成品生成
□ 動画完成品生成
□ チラシ完成品生成
□ LP完成品生成
□ PDF生成
□ HTML生成
□ Company Memory 永続化
☑ API料金メーター（Phase47-1）
☑ Claude Cost Analysis（Phase47-2A・分析のみ）
☑ Claude API コスト最適化（Phase47-2B）
☑ Claude Model Quality Compare（Phase47-2C・比較のみ）
☑ Claudeモデル正式採用判断（Phase47-2D）
☑ Claude Quality Monitor / Compare Intelligence連携（Phase47-3）
☑ Claude Quality History / 時系列品質監視（Phase47-4）
☑ Claude APIコスト最適化トラック v1.00 Stable確定（Phase47-S）
☑ Claude Quality History永続化（Phase47-5）
☑ Output Package Quality Checklist（Phase48-1）
☑ 成果物テンプレート強化（Phase48-2）
☑ Output Auto Fill Engine（Phase48-3）
☑ Output Preview Engine（Phase48-4）
☑ Publishing Engine（Phase48-5）
□ v1.0正式版（AI Creative Engine以降・Company Memory永続化が未完了のため引き続き未達成）

---

# 最重要思想

AI会社は回答を返すことが目的ではない。

**完成した成果物を大量生産し、品質が毎回向上していく** ことが目的である。

SNS自動投稿は後回し。投稿直前までの成果物品質を最高水準に引き上げることを優先する。

毎Phase終了後は
- dev-check
- ブラウザ確認
- Git Commit
- Tag
- 完了レポート

まで実施して完了とする。
