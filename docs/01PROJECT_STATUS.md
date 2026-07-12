# PROJECT_STATUS.md

# ENBISOU AI COMPANY - 現在の開発状況

更新日: 2026-07-12（Phase54-2 Output Draft Persistence **正式Complete**・2b/2c/2d＋2f(Mobile Review State Persistence)・commit f0f382f・tag v1.01-phase54-2f・push済み・Render反映済み・本番実機確認完了）

---

## Phase54-2 Output Draft Persistence **Complete**（Output Draftのサーバ永続化＝リロード復元・案件切替復元・Mobile Review状態永続化・B案／2b/2c/2d/2f・push済み・Render反映済み・本番確認済み）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-2 Complete**
- Commit: **6dec27d**(2b)／**5eec84b**(2c)／**7589f4f**(2d)／**f0f382f**(2f `persist mobile review state`)／各docs commit／Tag **v1.01-phase54-2d**(→7589f4f)・**v1.01-phase54-2f**(→f0f382f)／**origin/main = f0f382f・push済み・Render反映済み**
- DB: ユーザーが `output_drafts`（output_id PK・case_id NOT NULL・FKなし・非破壊）作成済み＋`review_state JSONB` 列追加済み（Phase54-2f・非破壊・既存行NULL）

### Phase54-2f Mobile Review State Persistence（本番実機確認判明の不足を解消）
- 症状: スライド別レビュー状態（`_mobileReviewState`＝「OK x/10」）がメモリのみで、F5/案件切替/再ログインで消失（Phase54-2dのバグではなく元々保存対象外だった仕様不足）
- 修正（A案）: `output_drafts` に `review_state JSONB` 追加。`statusBySlide`/`commentsBySlide`/`revisionTargetBySlide`/`approved` を成果物(output_id)単位で保存・復元。**output_approvals・Approval Sync・Phase54-1f/1g・Publishing Ready・Mobile Approval は非接触**
- 実装: server.js/lib（review_state任意受領・指定列のみ更新でDraト本文を壊さない）＋index.html（`pushReviewStateToServer`/`scheduleReviewStateSave`/`_applyReviewStateFromServerRow`＋5ハンドラ配線＋復元適用）
- 保存: OK/修正依頼/修正対象/approved=即時、コメント=デバウンス400ms。独立POST（Approval Queue非利用）

### 本番実機確認結果（ユーザー通常ブラウザ）
- ✅ OK x/10保持・コメント保持・修正依頼保持・修正担当保持・F5復元・案件切替・**別案件混入なし**・元案件復元・Mobile Approval回帰なし・Publishing Ready回帰なし・Approval Sync正常・console error 0

### localhost実DB往復確認（Phase54-2f）
- OK→実DB `review_state` 保存（ローカル状態と完全一致・fields無傷）→ F5→再オープンで「OK 2/10」＋コメント/修正依頼/修正対象/approved 復元・別案件混入なし・**Approval POST 0**・Mobile Approval/Publishing Ready回帰なし・console 0・dev-check 200/200/200

### 目的（B案・Phase54-2a設計）
- メモリのみだった Output Draft をサーバ（`output_drafts`）へ永続化し、**リロード後の成果物復元／案件ごとの最新Draト復元**を実現。既存 approvals/cases と同型・追加のみ・**Phase54-1f/1g 完成部分に非接触**。`output_id` を承認(output_approvals)との共通キーにして整合。

### 実装（2b/2c/2d）
- **2b サーバ基盤**（`lib/outputDraftsDb.js` 新規＋`server.js` `GET/POST /api/output-drafts`＋`supabase/schema.sql` 定義・実DB round-trip確認済み）
- **2c 保存**（index.htmlのみ・`buildOutputDraftFromLeaderFinal` 完成後に `pushOutputDraftToServer` で本文＋メタのみ保存・fire-and-forget・outputId/caseId/fields揃う時のみ・Approval Queue非接触）
- **2d 復元**（index.htmlのみ・起動/switchCase/_homeOpenCase の各 `scheduleApprovalSync` 直前で `scheduleOutputDraftRestore`→保存済 output_id のまま `_lastOutputDraft` 復元→既存Approval Syncが同 output_id で承認復元）

### localhost実機確認済み（実ワークフロー1回＋実DB）
- 実ワークフロー完成Draト保存（`out_1783814527200`/`case-mrgfnfgutvtb`・200）→ **F5リロード後に復元**・復元ID＝保存値一致・Approval GETが同 output_id 使用・復元中POST 0
- 案件切替で案件別最新Draト復元／**Draトなし案件で前案件Draト表示をクリア（POST 0）**／**高速連続切替で最終案件の最新Draトを即時復元・staleは不採用**／Output Engine・Mobile Review/Approval/Publishing Ready 回帰OK・コンソールエラー0・dev-check 200/200/200

### 保護・非接触
- **Phase54-1f（output_id一致判定）／1g（Approval POST Queue）／Approval Sync GET／`mergeApprovalStateFromServer` 非接触**。承認状態はDraft APIから復元しない（output_approvals が正）。polling/複数履歴UIは未実装（Phase54-2e候補）。

### 完了（Phase54-2 Complete）
- 実装・localhost実DB確認・commit・tag・push・Render反映・GET確認・**本番実機確認（ユーザー通常ブラウザ）まで完了**。Phase54-2 を正式 Complete とする

### 残課題・対象外（次候補・今回スコープ外）
- 検証行（`out_2btest_*`/`out_2ctest_*`/`out_1783814527200`/`case-2f-*` 等）は実DBに残存（非活性・DELETE未実施）／未マーク(進行中Workflow)Draト保持中の別案件切替は自動置換しない（保護・意図的仕様）／review保存はfire-and-forget（超高速連打時の一時的着順逆転は次操作で収束）・コメントは400msデバウンス／polling・複数履歴UI・PC⇔スマホ能動再取得は Phase54-2e候補

### 温存
- cost関連3ファイル（`cost-logs.json`/`claude-cost-logs.json`/`claude-quality-history.json`）＝未commit温存（Phase54-2非接触・stageに含めず）

### 次工程
- **Phase54-3 開始前レビュー**（現状整理・影響範囲・採用案・実装計画のみ／実装は行わない）

---

## Phase54-1g Approval POST Ordering / Last Action Wins **Complete**（Approval POSTを直列化＋対象別Last Action Wins・着順逆転防止・index.htmlのみ・push済み・Render反映済み・本番確認済み）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-1g Complete**
- Commit: **d6a6905**（`Phase54-1g enforce last action wins`）／docs commit: **2bb5a86**（`Phase54-1g update documentation`）／Tag: **v1.01-phase54-1g**（→ d6a6905）／**origin/main = d6a6905・push済み**
- 変更ファイル: **index.html のみ（+89/-7・追加のみ・`pushApprovalToServer` 内部の直列キュー化）**（server.js / lib / DB / API / Approval Sync(GET) / output_id判定 / Phase53 / Phase54-1d・1e・1f / cost系 非接触・課金なし）
- 本番: **Render反映済み**（`ai-company-l45x.onrender.com` = d6a6905・`_runApprovalPostQueue` 反映確認）。**本番実機確認完了**（Last Action Wins・UI最終状態=DB最終状態）／dev-check 200/200/200 / コンソールエラー0

### 目的
- Approval POST の fire-and-forget 着順逆転（同一成果物へ approve→reject→cancel を高速連続操作するとPOST到着順が逆転し、ローカル最終状態とDB最終状態が不一致になる）を解消し、**Last Action Wins（最後の操作が必ずDB最終になる）**を保証する。Phase54-1c由来の残課題（Phase54-1f起因ではない）を恒久解決。**Approval Sync（GET）の仕様変更ではない**。

### 実装（index.htmlのみ・追加のみ・変更は `pushApprovalToServer` 内部に限定）
- **グローバル直列 runner** `_runApprovalPostQueue`：POSTを1件ずつ `await` 送信（多重起動を先頭ガードで防止）。
- **対象別 pending**：`targetKey = caseId::outputId` 単位で最新jobのみ保持（同一対象は上書き＝supersede＝Last Action Wins／別対象は個別保持で喪失させない）。`_approvalPostPendingByTarget`(Map)＋`_approvalPostTargetOrder`(配列)。
- **payload凍結**：`_enqueueApprovalPost` でキュー投入時に `buildApprovalPayloadForServer` を凍結（送信時に読み直さない）。
- **成功条件 `response.ok`**：4xx/5xx/ネットワーク例外は失敗扱い（`_sendApprovalPostOnce`）。
- **最大1回再送**（合計2試行）。ただし失敗時に同一targetKeyへ**より新しいpendingが既にあればstaleを再送しない（新操作優先）**。失敗継続（キューは止めない・他対象jobを失わない）。
- **outputId無しはPOSTしない**（偽ID生成なし・case単位保存へ戻さない）。
- 外部インターフェース維持・**非ブロック（戻り値undefined・fire-and-forget維持）**。

### 非接触（保護対象すべて）
- `buildApprovalPayloadForServer` 既存項目 / GET同期（`scheduleApprovalSync`・`syncApprovalsFromServer`・`mergeApprovalStateFromServer`・`isRemoteApprovalNewer`）/ `_approvalSyncInFlight` / `_approvalSyncLastLocalChangeAt` / output_id判定 / server.js / lib / DB / API / Phase53 / Phase54-1d・1e・1f / cost系。

### 確認済み（合成＝スタブ・実POST 0・課金なし）
- Queue動作 / Last Action Wins（approve→reject→cancel → 送信 `[approve, cancel]`・reject supersede）/ 対象別保持（`outA:approve / outB:reject2 / outC:publish`・別対象喪失なし）/ POST失敗→最大1回再送（`[ng, ok]`）/ 新操作優先（stale再送なし）/ outputId無しPOST禁止（送信0）/ 回帰（通常1件・戻り値undefined）/ 後始末原状復帰・コンソールエラー0

### 確認済み（localhost実機＝実POST・実Supabase・透過ロガー・AI生成なし）
- **通常/LAW**：実成果物Draft（AI生成なし）＋実ハンドラ `approveInstagramPackage`/`rejectMobileApproval`/`cancelApproval` を高速連続実行。approve→reject→cancel の3操作 → **実POST 2回のみ**（中間rejectはsupersedeで未送信）・両200・pending残留0・**UI最終=cancel(null)＝DB最終null 一致**
- **着順保持**：reject→cancel → postLog `[rejected:200, null:200]`（reject先行→cancel最終）・**DB最終null 一致**（中間rejectがDBに残らない）
- **対象分離**：別案件 target2=rejected / target1=null不変（混入なし）/ output_id不一致=復元なし（Phase54-1f保護健在）
- **回帰**：GET同期・review/approval描画関数 健在 / `pushApprovalToServer` 戻り値undefined（非ブロック）/ コンソールエラー0

### 確認済み（本番実機＝Render `ai-company-l45x.onrender.com`・実POST・実Supabase・透過ロガー・AI生成なし・本番POST 6件）
- **通常/LAW**：approve→reject→cancel（実ハンドラ高速連続）→ **実POST 2件 `[null:200, null:200]`**（中間reject supersedeで未送信）・**UI最終=cancel(null)＝DB最終null 一致**・pending残留0
- **着順保持/中間非上書き**：reject→cancel → postLog `[rejected:200, null:200]`・**DB最終null 一致**（中間rejectがDBに残らない）
- **別案件/別成果物 混入なし**：target3=rejected / target2=null不変 / output_id不一致=復元なし（**Phase54-1f保護維持**）
- **回帰**：Approval Sync GET（`mergeApprovalStateFromServer`・`syncApprovalsFromServer`・`scheduleApprovalSync`・`isRemoteApprovalNewer`）健在・GET回帰なし / `pushApprovalToServer` 戻り値undefined（非ブロック）/ **コンソールエラー0**

### 実機検証で生成したテスト行（DB `output_approvals`・通常UI POST経由・最小・DELETE未実施）
- localhost：`case-1g-rm-*`（null）/ `case-1g-B-*`（null）/ `case-1g-C-*`（rejected）
- 本番：`case-1g-prod-A-*`（null）/ `case-1g-prod-B-*`（null）/ `case-1g-prod-C-*`（rejected）
- **手動curl POST 0回・DELETE未実施**。Phase54-1f孤立行（`case-mrf0d8vobb3y`）と同様、非活性テストデータとして記録（対応Draftはメモリ消失済み・同output_idは再生成されず一致判定によりUIへ復元されない・他案件へ混入しない）。

### 温存（未コミット・保護対象すべて維持）
- cost関連（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝**未commit温存**（Phase54-1g非接触・stageに含めず）

### 次工程（別Phase候補・ユーザー判断待ち）
- **Output Draft Persistence**（Draft永続化＝リロード復元・PC/スマホ共有・複数成果物Approval履歴の前提）

---

## Phase54-1f Approval Output Binding / Leakage Prevention Complete（Approval行へoutput_id紐付け・別成果物への誤復元防止・commit済み・push未実施）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-1f Complete**
- Commit: **9fd25a0**（`Phase54-1f bind approvals to output`）／Tag: **v1.01-phase54-1f**（コードcommitを指す）／**HEAD = 9fd25a0・origin/main = 4c0ef2c・未Push 1（push未実施）**
- 本番: **未反映（push前・Render未反映）**。実機確認完了 / dev-check 200/200/200 / node --check 0エラー / コンソールエラー0
- 変更ファイル: **`index.html` / `lib/approvalsDb.js` / `server.js` / `supabase/schema.sql` の4ファイル**（追加のみ・+63/-11・**Phase54-1c同期の判定に一致条件を1つ追加以外は非変更 / Phase54-1d・1e非変更 / Phase53非接触 / cost系非接触 / 課金なし**）
- DB: ユーザーが `ALTER TABLE output_approvals ADD COLUMN IF NOT EXISTS output_id TEXT;` を実行済み（nullable・PK変更なし・データ移行なし・非破壊）。**ClaudeはDDL未実行**

### 正式目的（＝完全な複数成果物履歴保存ではない）
- 最新の案件Approval行（`output_approvals` は case_id PRIMARY KEY・1案件1行を維持）へ **`output_id` を紐付け**、**現在成果物と `output_id` が一致する場合だけ復元**する。
- 同一案件で新しい成果物を生成した際に、以前の成果物の承認状態が混入する（Phase54-1eの残課題）を恒久防止。Phase54-1eのリセットと連携し新成果物を未承認に保つ。

### 実装済み（追加のみ）
- **DB**: nullable `output_id TEXT` 追加（ユーザー実行済み・非破壊）
- **supabase/schema.sql**: `output_approvals` 定義を追記（schema drift解消。DEFAULT/NOT NULL/RLS本文は未introspectのため推測記載せずコメント明記）
- **lib/approvalsDb.js**: `upsertApproval` に任意 `outputId`（指定時のみ `output_id` 書き込み＝undefinedで既存値を壊さない・`onConflict:'case_id'` 維持）／`getApproval(caseId, outputId)`（outputId指定時のみ `output_id` 一致行を返す）
- **server.js**: 既存 GET/POST `/api/approvals` に任意 `outputId` を受領しlibへ委譲（新規エンドポイントなし・レスポンス形式不変）
- **index.html**: `getCurrentApprovalOutputId()` 追加（`_lastOutputDraft.id`・無ければnull・ID新規生成なし）／`buildApprovalPayloadForServer` に `outputId` 追加／`syncApprovalsFromServer` のGET URLに任意 `&outputId=`／`mergeApprovalStateFromServer` の先頭に **output_id一致判定**（不一致・NULL・Draftなしは復元しない・上書きなし・POSTなし・タイムスタンプ不変）

### 実機確認済み（実ワークフロー2回＋実UI操作＋DB読み取り）
- ✅ 新成果物生成時：Mobile Review=unconfirmed / Mobile Approval=draft / Publishing Ready=draft / 承認取消ボタン非表示
- ✅ POST body に現在 `outputId`（通常UI経由・手動curl POST 0回）→ DBへ `output_id` 保存 → 現在 `draft.id` と完全一致（既存項目も正常保存）
- ✅ 同一成果物内で承認維持（同期でGET URLに outputId・編集中3000msガード健在・`_approvalSyncInFlight` 解除・同期による追加POST 0）
- ✅ **同一案件の別成果物へ承認混入なし**（新draft ID発行→Phase54-1eリセット→同期後も旧承認を復元せず未承認）
- ✅ 案件間の承認混入なし／既存 `output_id=NULL` 行は復元しない（未承認）
- ✅ Mobile Review / Mobile Approval / Publishing Ready / Output Engine / Phase53 回帰・コンソールエラー0 / dev-check 200/200/200

### 未確認・対象外
- Workflow Live 本文描画（Auto Task経路のため）／認証無効環境のログイン・ログアウト（`auth-required:false` で画面なし）／ページリロード後の同一成果物復元（Draft未永続・対象外）／PC⇔スマホでの同一Draft共有（対象外）

### 現Phaseで変更しなかったもの
Output Draft Persistence／複数成果物Approval履歴／過去成果物再表示／PC・スマホ同一Draft共有／PRIMARY KEY・複合PK／新規Approvalテーブル／既存NULL行のデータ移行／output ID生成方式（`'out_'+Date.now()`）／`getCurrentApprovalCaseId()` dead fallback／UI／Phase53／Version1完成部分／他Realtime Sync

### 残課題
- Output Draftはメモリのみ（リロード後の同一成果物復元不可・PC/スマホ共有不可・複数成果物Approval履歴なし）
- `getCurrentApprovalCaseId()` の dead fallback（`_lastOutputDraft.caseId` 未設定・未修正・報告のみ）
- **Approval POST の fire-and-forget 着順逆転**（同一tick内で approve→reject→cancel を連続実行するとPOST着順が逆転しローカル/DB一時不一致。**Phase54-1f起因ではない**・Phase54-1c由来。別Phase候補）
- **検証で生じた孤立Approval行**：検証案件 `case-mrf0d8vobb3y`（`output_id=out_1783695572489` / `approval_decision=rejected`）。対応Draftはメモリ消失済みで**今後同じoutput_idのDraftは再生成されない**ため、output_id一致判定によりUIへ復元されず他案件へ混入しない**非活性の孤立データ**として許容。DELETE・手動POSTによる整理は実施していない

### 別Phase候補（どちらを先に実施するかはユーザー判断待ち）
- **Output Draft Persistence**（Draft永続化＝リロード復元・PC/スマホ共有・複数成果物履歴の前提）
- **Approval POST Ordering / Last Action Wins**（POST直列化・最終状態デバウンス・stale request破棄・着順逆転対策）

### 温存（未コミット）
- cost関連（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝**未commit温存**（Phase54-1f非接触・stageに含めず）

### 次工程
- **docs commit（別commit）→ push（origin/main同期・要承認）→ Tag個別push → Render反映 → 本番実機確認**

---

## Phase54-1e Approval State Reset / Case Isolation Complete（成果物単位で必ず未承認から開始・表示バグ修正・commit済み・push未実施）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-1e Complete**
- Commit: **06d07d5**（`Phase54-1e approval state reset per output draft`）／Tag: **v1.01-phase54-1e**／**HEAD = 06d07d5・origin/main = b29be90・未Push 1（push未実施）**
- 本番: **未反映（push前）**。dev-check 200/200/200 / node --check 0エラー / ブラウザ起動時コンソールエラー0
- 変更ファイル: **`index.html` のみ**（+20・追加のみ・**server.js / DB / API変更なし / Phase54-1c同期非変更 / Phase54-1d `_mrcRerender`非変更 / Phase53非接触 / cost系非接触 / 課金なし**）

### 不具合 → 修正（表示バグ修正に限定）
- **不具合**: 承認/レビュー/公開の状態が単一グローバル（`_mobileReviewState`/`_mobileApprovalState`/`_publishingReadyState`）で、新規案件・案件切替・新成果物生成のいずれでも初期化されず、前案件・前成果物の承認状態が引き継がれて「Mobile Review 承認済み／Mobile Approval 承認済み／Publishing Ready 投稿準備完了／『承認を取消』」が誤表示された
- **目的**: **新規案件・案件切替・新しい成果物生成では必ず Mobile Review / Mobile Approval / Publishing Ready が未承認状態から開始する**（承認対象は「成果物（Output Draft）」単位）
- **修正（index.htmlのみ・追加のみ）**: 共通リセット関数 **`resetApprovalStatesToDefault()`** を新設し、3グローバル状態を既定へ戻す＋draftキャッシュ（`mobileReviewCenter`/`mobileApproval`/`publishingReady`）を無効化して再計算。以下5境界から呼ぶ：`createOutputDraft`（新成果物生成）／`switchCase`・`_homeOpenCase`（案件切替）／`createCase`・`createNewCaseFromForm`（新規案件）
- **制約遵守**: `pushApprovalToServer` を呼ばない（不要POSTなし）／`_approvalSyncLastLocalChangeAt` 不変（Phase54-1c同期セマンティクス非干渉）／既存描画経路（`renderOutputEnginePanel`）のみ使用

### 非変更（安全）
- **Phase54-1c Approval Sync（同期7関数）非変更**：GET復元仕様は変えない。新規案件・新成果物は当該case行が無く GET 0件→復元なし→未承認のまま
- **Phase54-1d `_mrcRerender` キャッシュ無効化ロジック非変更**
- `createMobileApprovalDraft`/`canApprove`/`_mapAllChecked`/`_mapReviewApproved`/`_mrcOverallStatus` の判定ロジック無変更

### 確認済み
- ✅ dev-check 200/200/200 / node --check 0エラー / インラインJS 2ブロックparse OK
- ✅ ブラウザ起動時コンソールエラー0 / `resetApprovalStatesToDefault` 定義・Phase54-1c同期5関数 typeof function・`_mrcRerender` 健在
- ✅ 合成リセット検証：承認済み汚染→reset で decision=null / checklist空 / reviewApproved=false / published=false / archived=false / draftキャッシュ3種=null / `_approvalSyncLastLocalChangeAt` 不変
- ✅ Phase53 `oe-aic` 67件維持 / Phase54-1c同期関数diff 0 / Phase54-1d `_mrcRerender` diff 0
- ⚠️ 実ワークフローでの実操作確認（新規案件→新成果物→未承認／案件A→B切替で混入なし／同一案件の作り直しで未承認）は成果物draft生成（API課金）を伴うため未実施（push/Render反映後にユーザー実機確認）

### 温存（未コミット）
- cost関連（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝**未commit温存**（Phase54-1e非接触・stageに含めず）

### 次工程
- **docs commit（別commit）→ push（origin/main同期・要承認）→ Render反映 → 実機確認**
- **Phase54-1f（今後予定・別設計・要承認）**: 承認の**成果物単位永続化**（`output_approvals` に `output_id`/`draft_id` 追加＝case_id単位→成果物単位へ拡張・Phase54-1c同期を output_id キーへ整合）。DB/server.js/API/Phase54-1c変更・Supabase作業を伴うため Phase54-1e とは完全分離。これにより「同一案件に既存承認がある状態での新成果物の再承認（case_id単位GET復元の残課題）」を恒久解決する

---

## Phase54-1d Mobile Approval Cache Fix Complete（Mobile Approval canApprove キャッシュ無効化漏れ修正・commit済み・push未実施）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-1d Complete**
- Commit: **43513cc**（`Phase54-1d mobile approval cache fix`）／Tag: **v1.01-phase54-1d**／**HEAD = 43513cc・origin/main = 1574241・未Push 1（push未実施）**
- 本番: **未反映（push前）**。dev-check 200/200/200 / node --check 0エラー / ブラウザ起動時コンソールエラー0
- 変更ファイル: **`index.html` のみ**（+10・追加のみ・**server.js / DB / API変更なし / Phase54-1c同期非接触 / Phase53非接触 / cost系非接触 / 課金なし**）

### 不具合 → 修正
- **不具合**: Mobile Review で全スライドOK＋「この内容で承認する」で承認済み（reviewStatus=approved）にしても、Mobile Approval の「この内容で承認する」が **disabled のまま**（7項目チェックを1つ外して再チェックすると `_mapRerender()` が走り有効化される、というキャッシュ無効化漏れ）
- **根本原因**: `canApprove` を含む `_lastOutputDraft.mobileApproval` は Mobile Approval 自身の `_mapRerender()` でしか再生成されず、Mobile Review 側の `_mrcRerender()` は `mobileReviewCenter` のみ更新して `mobileApproval` を無効化しなかった
- **修正（A案'・index.htmlのみ・追加のみ）**: `_mrcRerender()` に「**reviewStatus 変化時のみ `_lastOutputDraft.mobileApproval` を無効化**」する分岐を追加。新 reviewStatus（`mobileReviewCenter.mobileApprovalInput.reviewStatus`）と旧キャッシュ（`mobileApproval.summary.reviewStatus`）を比較し、異なる時だけ `mobileApproval = null`（次回 `buildMobileApprovalHtml` で `createMobileApprovalDraft` 再計算→`canApprove` 追従）。**スライド移動/前後/サムネ選択（reviewStatus不変）ではキャッシュ維持＝不要な再計算を回避**

### 変更していないもの（安全策）
- `createMobileApprovalDraft` / `canApprove` / `_mapAllChecked` / `_mapReviewApproved` のロジック無変更
- `_mobileApprovalState`（checklist / decision / approvedAt）不変（7項目チェック・承認済み状態を保持・勝手に解除しない）
- Phase54-1c 同期関数（`pushApprovalToServer` / `syncApprovalsFromServer` / `mergeApprovalStateFromServer` / `scheduleApprovalSync` / `getCurrentApprovalCaseId`）非接触・無効化経路から POST 非発火（不要POSTなし）

### 確認済み
- ✅ dev-check 200/200/200 / node --check 0エラー / インラインJS 2ブロックparse OK
- ✅ ブラウザ起動時コンソールエラー0 / `_mrcRerender`・`_mapRerender` 健在 / Phase54-1c同期5関数すべて typeof function
- ✅ 合成ロジック検証：reviewStatus 変化→無効化 / 同一→維持 / ナビ相当→維持
- ✅ Phase53 `oe-aic` 67件維持
- ⚠️ 実ワークフローでの「承認→自動有効化／修正依頼→自動無効化」実操作確認は成果物draft生成（Workflow実行＝API課金）を伴うため未実施（push/Render反映後にユーザー実機確認）

### 温存（未コミット）
- cost関連（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝**未commit温存**（Phase54-1d非接触・stageに含めず）

### 次工程
- **docs commit（別commit）→ push（origin/main同期・要承認）→ Render反映 → 実機確認**。その後：残同期の別Phase（Task/Cost/Status/Auto Task poll）または Phase54系Intelligence

---

## Phase54-1c Approval Sync Client Complete（承認/公開状態のPC⇔スマホ同期・クライアント配線・commit済み・push未実施）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-1c Complete**
- Commit: **4f53dd5**（`Phase54-1c approval sync client`）／Tag: **v1.01-phase54-1c**／**HEAD = 4f53dd5・origin/main = 5bfaf6b・未Push 1（push未実施）**
- 本番: **未反映（push前）**。dev-check 200/200/200 / node --check 0エラー / ブラウザ起動時コンソールエラー0
- 変更ファイル: **`index.html` のみ**（+135 / -2・追加のみ・**server.js / DB / API変更なし / Phase53非接触 / cost系非接触 / 課金なし**）

### 目的
Phase54-1b の既存API（`GET/POST /api/approvals`）を index.html から利用し、承認/却下/公開/アーカイブ状態を **case_id 単位で PC⇔スマホ同期**（A案・単一グローバル状態を現在case_idへマッピング）。UI挙動・既存Output Engine描画は不変。

### 完了内容（index.htmlのみ・追加のみ）
- **追加関数7**: `getCurrentApprovalCaseId`（現在案件優先→`_lastOutputDraft.caseId`補助→無ければnull=同期スキップ）/ `buildApprovalPayloadForServer`（POSTキーへ写像・読み取り専用）/ `pushApprovalToServer`（fire-and-forget）/ `syncApprovalsFromServer`（GET・finallyで`_approvalSyncInFlight`必ず解除）/ `mergeApprovalStateFromServer`（編集中ガード＋updated_at新しい方のみ反映）/ `isRemoteApprovalNewer`（updated_at比較のみ）/ `scheduleApprovalSync`（起動/切替/visibility一本化・多重実行防止・マイクロタスク遅延でTDZ回避）
- **追加変数3**: `_approvalSyncInFlight` / `_approvalSyncLastLocalChangeAt` / `_approvalSyncLastReason`
- **定数/Version**: `APPROVAL_SYNC_EDIT_GUARD_MS = 3000` / `APPROVAL_SYNC_CLIENT_VERSION = '1.0.0'`
- **push接続（確定時）**: `approveInstagramPackage` / `rejectMobileApproval` / `cancelApproval`（空状態）/ `markInstagramPublished` / `archivePublishingReady` / `resetPublishingReadyStatus`（空状態）。`toggleApprovalCheck` はガード起点更新のみ（push対象外）
- **pull接続（契機）**: 起動時（`syncCasesFromServer()`直後）/ `switchCase`・`_homeOpenCase`（案件切替）/ `visibilitychange`
- **同期仕様**: case_id取得不可時は push/pull ともスキップ（現状のephemeral挙動維持）。updated_atが新しい方を採用・古い状態で上書きしない。編集中3000msはローカル優先。取消/公開取消は空状態POST（case未確定時はPOSTしない）。通信失敗は握り潰しで既存UI維持

### 確認済み
- ✅ dev-check 200/200/200 / node --check 0エラー / index.htmlインラインJS 2ブロックparse OK
- ✅ ブラウザ起動時コンソールエラー0 / 全7関数 typeof function / `APPROVAL_SYNC_CLIENT_VERSION='1.0.0'` / `EDIT_GUARD_MS=3000`
- ✅ 起動同期発火（`_approvalSyncLastReason='startup'`）→ 終了後 `_approvalSyncInFlight=false`（解除漏れ防止が実機で機能）
- ✅ `isRemoteApprovalNewer` 新旧判定正常（新規=採用 / 未来ローカル=ローカル優先）
- ✅ GET単件が `data.approval` 形でmerge受理形と一致（読み取り実証）/ 既存 `GET /api/cases`・`GET /api/approvals` 回帰なし
- ✅ Phase53マーカー `oe-aic` 67件維持・`buildAffiliateIntelligenceCoreHtml` 健在（非接触）
- ⚠️ **PC⇔スマホ実機ラウンドトリップ（実POST書き込み）は未実施**（実DBへ勝手にテストデータ作成しない方針・push/Render反映後にユーザー実機確認）

### 温存（未コミット・保護対象すべて維持）
- cost関連（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝**未commit温存**（Phase54-1c非接触・stageに含めていない）

### 次工程
- **docs commit（別commit）→ push（origin/main同期・要承認）→ Render反映 → 実機PC⇔スマホ同期確認**。その後：残同期の別Phase（Task/Cost/Status/Auto Task poll・index.htmlのみ）または Phase54系Intelligence

---

## Phase54-1b Approval Sync Server API Complete（承認/公開状態のSupabase永続化・サーバー側・push済み・Render反映済み）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-1b Complete**
- Commit: **d9310d0**（`Phase54-1b approval sync server api`）／**origin/main = HEAD = d9310d0 / 未Push 0**
- 本番: **Render反映済み**（`ai-company-l45x.onrender.com`・`GET /api/approvals` 本番確認済み・既存API回帰なし・Phase53維持）
- 変更ファイル: **`server.js`（+2ルート+遅延ローダー）/ `lib/approvalsDb.js`（新規）**（追加のみ・**index.html変更なし / Phase53非接触 / cost系非接触 / 課金なし**）

### 目的
Version1.01 残同期の独立Phase（Decision 047 で別Phase扱い確定）。PC/スマホの承認（Mobile Approval）・公開（Publishing Ready）状態を **case_id 単位で Supabase 永続化**する**サーバー基盤**を用意（A案・最小サブセット）。UI反映は Phase54-1c。

### DB変更（ユーザーがSupabase SQL Editorで実行済み・非破壊）
- **新規テーブル `output_approvals` のみ**（`case_id TEXT PRIMARY KEY` / `approval_decision` / `approved_at` / `published` / `published_at` / `archived` / `checklist` / `review_status` / `updated_at`・**FKなし・nullable中心・既存テーブル無変更・データ移行なし**）＋RLS `output_approvals_all FOR ALL`。
- **DBスキーマ変更は output_approvals 新規のみ**。Supabase SQL はユーザー実行済み（Claudeは実行していない）。

### 完了内容（追加のみ）
- **lib/approvalsDb.js**（新規）: `upsertApproval`（case_id完全一致1件・onConflict: case_id）/ `getApprovals`（全件）/ `getApproval(caseId)`（1件・maybeSingle）。casesDb.js と同型・`source:'db'|'fallback'|'error'` 規約。
- **server.js**: 遅延ローダー `getApprovalsDb`（`_approvalsDb`）＋ `GET /api/approvals`（`?caseId=`任意）＋ `POST /api/approvals`（upsert）。POSTはグローバル `app.use(express.json())`〔417行〕依拠で per-route express.json() なし。既存ルート・Workflow・Provider 無変更。

### 確認済み
- ✅ node --check（server.js・approvalsDb.js）0エラー / dev-check 200/200/200（既存API回帰なし）
- ✅ **GET /api/approvals 本番確認済み**（`source:"db"`・全件/1件/存在しないID すべて正常）
- ✅ **POST /api/approvals localhost確認済み**（最小1件 `phase54-1b-test` upsert→GET往復成功・DELETE未実行・round-trip禁止遵守）
- ✅ 既存API `GET /api/cases` 本番正常（回帰なし）/ Phase53マーカー本番維持
- ※ テストデータ `phase54-1b-test` 1件が `output_approvals` に残存（DELETE禁止のため保持）

### 温存（未コミット・保護対象すべて維持）
- cost関連（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝**未commit温存**（Phase54-1b非接触）

### 次工程
- **Phase54-1c（index.html 同期配線）**: 承認/公開確定時の `pushApprovalToServer`（POST）＋起動/case切替/visibilitychange時の `syncApprovalsFromServer`（GET→updated_at新しい方でmerge→`renderOutputEnginePanel`再描画・`_oeSafe`保護）。index.htmlのみ・追加のみ。

---

## Phase53 Affiliate Intelligence Core Complete（Version2 Core先行搭載・push済み・Render反映済み）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase53 Complete**
- Commit: **bcfba7d**（`Phase53 affiliate intelligence core base`）
- 本番: **Render反映済み**（`ai-company-l45x.onrender.com` HTTP 200・Phase53マーカー本番反映済み・既存機能マーカー維持）
- Git: **origin/main = HEAD = bcfba7d / 未Push 0**
- 変更ファイル: **`index.html` のみ**（追加のみ・+380行・**DB変更なし / server.js変更なし / API追加なし / Supabase操作なし / 課金なし**）

### 目的
Version2「Instagram Affiliate Intelligence Company」の中核となる器を Version1 に非破壊で先行搭載。16判断項目（市場/商品/ASP/利益率/承認率/EPC/CVR/IG相性/競合数/案件寿命/季節性/保存率予測/クリック率予測/想定売上/想定利益/おすすめ順位）を**手動入力**で登録し、統合スコア＋おすすめ順位ランキング＋Leader統合サマリーを算出・Copy・Export。

### 完了内容（追加のみ・index.htmlのみ・5箇所）
- CSS `.oe-aic-*` クラス群
- AIC関数群（`AFFILIATE_INTELLIGENCE_CORE_VERSION='1.0.0'` / `_affiliateCases`〔メモリ内・最大50件〕/ `recordAffiliateCase` / `buildAffiliateIntelligenceRanking` / `_aicIntegratedScore` / `_aicEstimate` / `_aicBuildLeaderSummary` / `buildAffiliateIntelligenceCoreHtml` 他・+356行）
- `renderOutputEnginePanel` に `_oeSafe(buildAffiliateIntelligenceCoreHtml,…)` を1行追加
- `serializeOutputDraft`（JSON/Markdown）に Export関数を各1行追加（案件0件時は出力せず＝既存Export不変）
- 4 Safetyバッジ固定（No Real API / Manual Input Only / Prediction Heuristic Only / Read Only）

### 確認済み（STEP0検証・全合格）
- ✅ node --check（インラインJS 2ブロック・Phase53込み）0エラー / dev-check 200/200/200
- ✅ 配信HTML：Phase53搭載＋既存機能マーカー維持（回帰なし）
- ✅ 新規ロジックsandbox実行：統合スコア/想定売上・利益/ランキング/Leader統合判断/Export 正常
- ✅ ユーザー実ブラウザ目視確認OK（AIC表示・Leader統合判断・ランキング・計算結果・既存画面崩れなし）
- ✅ push後 Render本番マーカー反映確認・既存マーカー維持

### 開始条件（Decision 045 運用判断＝B案・Decision 047）
- Decision045「Version1.01 Realtime Sync完成後＋ユーザー承認でPhase53開始」を、**Conversation / Case / Messages 中核同期完了をもってPhase53先行開始承認**（B案）としてユーザーが運用判断。
- **残同期（Task/Cost/Status/Auto Task 自動更新poll・Learning一部in-memory整理・Approval端末間同期）は未完了として別Phase扱い**。特にApproval端末間同期はserver.js/DB/API検討が必要なため独立Phaseで管理。

### 温存（未コミット・保護対象すべて維持）
- cost関連（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）は**未commit温存**（Phase53に非接触）

---

## Phase52-12.2 Committed（messages.case_id 案件別チャット分離・push済み・Render反映済み）

- 現在Version: **Version1 / Phase52-12.2 code commit完了（push前）**
- Commit: **aabf46c**（`Phase52-12.2 messages case id for per case chat separation`）
- 本番: **未反映（push前）**。dev-check 200/200/200 / node --check OK / 実ブラウザ確認OK
- 変更ファイル: **`supabase/schema.sql` / `lib/conversationsDb.js` / `server.js` / `index.html`**（追加のみ・非破壊・**Phase53/cost非接触**）

### 目的
案件ごとのチャット履歴をPC/スマホ間で分離する。従来 `messages`/`conversations` に案件情報が無く、caseId がローカルにしか存在しないため、端末をまたぐと案件別チャットが「最新一覧」に混在していた。

### DB変更（ユーザーがSupabase SQL Editorで実行済み・非破壊）
```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS case_id TEXT;
```
- **nullable・FKなし**。既存メッセージは自動的に `case_id = NULL`（データ移行なし・非破壊）
- **messages / conversations は削除しない**（列追加のみ・FKなしでcases削除と疎結合）

### 完了内容（追加のみ）
- **supabase/schema.sql**: `messages` 定義に `case_id TEXT`（nullable・FKなし）＋ALTERコメント追記
- **lib/conversationsDb.js**: `saveMessage({..., caseId})` で `case_id` 保存（未指定はNULL）／`getMessages()` の select に `case_id` 追加
- **server.js**: `POST /api/messages` で `caseId` を受領し保存（`caseId || null`）。GETは `getMessages` 返却がそのまま流れ `case_id` を返す
- **index.html**: 送信POST（user/assistant両方）に `caseId: _ncActiveCaseId()` 付与／`mergeServerHistory` の norm＋サーバー→ローカル変換3箇所（restore/担当切替補完/syncCurrentMember）で `case_id` を保持。`getFilteredHistory` は無変更（caseId が入れば案件別に自動分離）
- **POST / GET /api/messages で caseId 授受・client mergeで caseId保持** → 案件ごとの会話分離に対応

### 確認済み / 未確認
- ✅ node --check（server.js・conversationsDb.js・index.htmlインラインJS）0エラー / dev-check 200/200/200
- ✅ localhost 読み取りGET確認: `GET /api/messages` 応答に `case_id` キーが含まれ、既存メッセージは全て `null`（ALTER成功・後方互換）
- ✅ 実ブラウザ確認（大きな問題なし）
- API往復テスト・DBテストデータ作成なし

### 既存挙動維持
- 既存messagesは `case_id=NULL` のまま → 従来どおり「最新一覧」に表示（`getFilteredHistory` の `|| !h.caseId`）
- 未更新端末は caseId を送らずNULL保存（後方互換）

### 温存
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は未コミット温存
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行）は Version2 まで保留

### 次アクション
- **push承認待ち**（`git push origin main` → Render本番自動デプロイ → curlで `case_id`/`caseId`反映・`oe-aic`=0 確認）

---

## Phase52-12.1b Fixed（F5/ログイン直後のホーム案件一覧0件表示 修正・実ブラウザ確認OK・commit前・push前）

- 現在Version: **Version1 / Phase52-12.1b 修正完了（未commit）**
- Commit: **未commit**／本番: **未反映**。dev-check 200/200/200 / node --check OK / **実ブラウザ確認OK**
- 変更ファイル: **`index.html` のみ**（追加のみ・server.js/lib/DB/API/Workflow 無変更・**Phase53/cost非接触**）

### 不具合内容
F5更新直後 / ログイン直後に、ホーム案件一覧が0件表示になる（Leaderへ移動→ホーム復帰で復活）。データ消失ではなくタイミング問題。

### 根本原因
`syncCasesFromServer()`（Supabase同期・非同期）は同期完了後、`currentMember` がある時のみ `renderCaseNav()` を再描画し、**ホーム表示中（`currentMember=null`）は再描画していなかった**。localStorageに案件が無くSupabaseのみに案件がある状態でF5/ログインすると、初期ホーム描画が同期完了前に走り0件のまま残る。

### 修正内容（index.htmlのみ・追加のみ）
- `syncCasesFromServer()` の同期完了処理に、ホーム表示中（`currentMember=null`）は `renderHomeCaseList()` ＋ `renderHomeCaseNav()` を再描画する分岐を追加。既存の `renderCaseNav`（担当選択中）パスは無変更
- `renderHomeCaseList()` は案件0件なら `false` を返し既存 empty-state を維持。try/catchで描画失敗時も既存表示を維持
- **F5直後・ログイン直後どちらでも、案件同期完了後にホーム案件一覧が正しく再描画される**

### 確認
- ✅ node --check（index.htmlインラインJS）エラー0 / dev-check 200/200/200 / localhost配信反映
- ✅ **実ブラウザ確認OK**（F5更新後にホーム案件一覧が表示される）
- API往復テスト・DBテストデータ作成なし

### DB/安全
- server.js / lib / DB / API 変更なし（index.htmlのみ）・課金なし・Phase53/cost非接触

---

## Phase52-12.1a Implemented（選択削除UI 追加改善・実装完了・commit前・push前）

- 現在Version: **Version1 / Phase52-12.1a 実装完了（未commit）**（選択削除UI追加改善）
- Commit: **未commit**／本番: **未反映**。dev-check 200/200/200 / node --check OK。**実ブラウザ実操作確認はユーザー確認項目**
- 変更ファイル: **`index.html` のみ**（追加のみ・server.js/lib/DB/API/Workflow 無変更・**Phase53/cost非接触**）

### 完了内容（追加のみ・UI統一）
- **全選択 / 全解除**: 選択ツールバーに「全選択」「全解除」ボタン追加（ホーム／Leader両方）
- **ホーム/Leader両方の選択削除**: 共通ビルダー `_buildCaseSelectBar()` を新設し、ホーム(`renderHomeCaseList`)とLeader画面(`renderCaseListScreen`)で同一の選択ツールバー（☑選択／全選択／全解除／🗑選択削除(n件)）を使用。Leader側は `_clSelectMode`/`_clSelectedIds`＋`_clToggleSelectMode`/`_clSelectAll`/`_clDeselectAll`/`_clToggleSelected`/`_clBulkDelete` を新設
- **選択削除バー上部固定**: 新CSS `.case-select-bar { position: sticky; top:0; z-index:6 }` によりスクロール時も常時上部固定
- **ホーム案件タブ×削除**: `renderHomeCaseNav` の各タブを `case-tab-wrap`＋`case-del-btn`（×）でLeaderと統一。× で `_homeDeleteCase()`
- **個別削除ボタン維持**: ホームカード「🗑 削除」／Leaderカード「削除」／タブ「×」いずれも維持
- **messages / conversations は削除しない**（削除対象は `cases`〔local＋Supabase〕のみ・既存 `deleteCaseFromServer` 経由）

### 確認済み / 未確認
- ✅ node --check（index.htmlインラインJS）エラー0 / dev-check 200/200/200 / localhost配信HTMLに新要素反映（HTTP 200）
- ⏳ **実ブラウザ実操作確認はユーザー確認項目**（ホーム/Leaderの選択モード・全選択・全解除・一括削除・タブ×削除・カード個別削除・スクロール時の上部固定バー・リロード復活なし・PC/スマホ）。API往復テスト／DBテストデータ作成は実施しない方針

### DB/安全
- **DBスキーマ変更なし**・API追加なし（前Phase52-12.1の `DELETE /api/cases/:id` を流用）。課金なし・Phase53/cost非接触

### 温存
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は未コミット温存
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行）は Version2 まで保留

---

## Phase52-12.1 Implemented（案件削除Supabase同期・実装完了・commit前・push前）

- 現在Version: **Version1 / Phase52-12.1 実装完了（未commit）**（案件削除Supabase同期）
- Commit: **未commit**（承認後に分離stage→commit）
- 本番: **未反映**。dev-check 200/200/200 / node --check OK。**実ブラウザ実操作確認はユーザー確認項目**
- 変更ファイル: **`server.js` / `lib/casesDb.js` / `index.html`**（すべて追加のみ・**DBスキーマ変更なし**・Phase53/cost非接触）

### 目的
ホーム画面から案件を削除した際に Supabase `cases` も同期削除し、リロードで復活しないようにする（従来は localStorage のみ削除→リロードで `syncCasesFromServer` がSupabaseから再mergeし復活していた）。

### 完了内容（追加のみ）
- **lib/casesDb.js**: `deleteCase(id)` 追加（`supabase.from('cases').delete().eq('id', id)`・id完全一致1件・Supabase未設定時は既存同様のerror返却）。`module.exports` に追加
- **server.js**: `DELETE /api/cases/:id` 追加（id必須チェック→`getCasesDb().deleteCase(id)`。**messages/conversationsは一切触らない**）
- **index.html**:
  - `deleteCaseFromServer(caseId)` 新設（`DELETE /api/cases/:id`・`pushCaseToServer` と同じfire-and-forget）
  - 既存 `deleteCase()`（Leader画面の×削除）に `deleteCaseFromServer()` 呼び出しを1行追加（Leader画面削除もSupabase同期）
  - **ホーム案件カードに「🗑 削除」ボタン追加**＋ `_homeDeleteCase()`（確認ダイアログ→local+Supabase削除→ホーム再描画）
  - **選択モード**（`_homeSelectMode` / `_homeSelectedIds`）＋ ホーム一覧ヘッダの「☑ 選択」トグル
  - **チェックボックス表示**（選択モード時に各カードへ）＋「🗑 選択削除（n件）」ボタン
  - **一括削除** `_homeBulkDelete()`（確認ダイアログ→選択案件をlocal+Supabase削除→再描画）
- **messages / conversations は削除しない**（`cases` テーブルは `conversations`/`messages` から参照されておらず、cases削除は会話履歴に波及しない設計）

### 確認済み / 未確認
- ✅ dev-check 200/200/200 / node --check（server.js・casesDb.js・index.htmlインラインJS）エラー0
- ⏳ **実ブラウザ実操作確認はユーザー確認項目**（案件作成→ホームから削除→Supabase同期→リロードで復活しないこと・PC/スマホ）。API往復テストは実施しない方針

### DB/安全
- **DBスキーマ変更なし**（既存`cases`＋RLS `cases_all FOR ALL` で削除可能）。API追加＝`DELETE /api/cases/:id` 1本のみ。課金操作なし
- 既知の制約（次段階候補）: 他端末側localStorageに残る案件の自動prune（クロス端末即時反映）は未実装（誤削除リスク回避のため）。削除操作した端末はリロードで復活しない（Supabase側が削除済みのため）

### 温存
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は未コミット温存
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行）は Version2 まで保留

### 次アクション
- 実ブラウザ実操作確認 → 承認 → 分離stage（server.js / lib/casesDb.js / index.htmlの本Phase分のみ・Phase53/cost除外）→ commit → docs commit → push → Render確認

---

## Phase52-12.0a Complete（ホーム案件タブ表示＋入力無効化 完了・push前）

- 現在Version: **Version1 / Phase52-12.0a Complete**（ホーム案件タブ表示＋入力無効化）
- Commit: **04e3a63**（`Phase52-12.0a home case tabs and disabled input`）
- 本番: **未反映（push前）**。ユーザー実ブラウザ確認OK + localhost + dev-check 200/200/200 で確認済み
- 変更ファイル: **`index.html` のみ**（追加のみ・**server.js / lib / DB / API / Workflow 無変更**・Phase53/cost混入なし）

### 完了内容
- **ホーム案件タブ表示**: `renderHomeCaseNav()` を新設し `goHome()` から呼び出し。ホーム画面でも Leader画面と同じ `case-nav`/`case-tab` UIで 🕒最新一覧＋各案件タブを表示し操作感を統一
  - タブclickは `_homeOpenCase(id)` / `_homeOpenCaseList()`（`switchCase` は currentMember 依存のためホーム専用ハンドラを使用）。案件0件時はタブ非表示（従来 empty-state 維持）
  - **削除ボタンはホームに置かない**（案件削除の端末間同期は Phase52-12.1・現状ローカルのみのため）
- **ホーム入力欄無効化**: ホーム表示中は入力欄・送信ボタンを無効化し、placeholder を「ホームでは入力できません。案件を選択するか、新規案件を作成してください。」へ変更
  - 入力欄・送信ボタンの disabled は既存 `goHome()` で成立済み。Enter送信も既存 `sendMessage()` 冒頭 `!currentMember` ガードで発火しないため、placeholder 文言のみ更新
  - 案件を開くと既存 `selectMember()` が入力欄を再有効化（無効のまま残らない）
- **案件カード一覧は維持**: Phase52-12.0 のホーム案件カード一覧は削除せず、タブ・カード両方から案件を開ける状態

### 確認済み
- ユーザー実ブラウザ確認OK（案件タブ表示／タブから開く／カードから開く／入力欄無効／指定文言／案件を開くと入力可）
- dev-check 200/200/200 / node --check（インラインJS構文）OK
- 分離stage（Phase52-12.0aハンクのみ）で commit `04e3a63`。ステージ/コミット差分の Phase53マーカー（oe-aic/affiliate/AFFILIATE_INTELLIGENCE）= 0件・cost系混入 0件

### 温存
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は未コミット温存
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行）は Version2 まで保留

### 次工程（Phase52-12.1 案件削除同期・実装前に必ずユーザー承認）
実装候補: Supabase `cases` 削除API（server.js 削除ルート）／1件削除の端末間同期／**ホームカードの削除ボタン**／**選択モード**／**チェックボックス表示**／**選択案件まとめて削除**／削除確認ダイアログ／**messages は削除しない**。server.js / lib / 新規削除API / DB操作を含むため **実装前に必ずユーザー承認が必要**。安全条件＝id完全一致1件のみ削除・messages非削除・削除確認ダイアログ維持

### 次アクション
- **push承認待ち** → 承認後 `git push origin main` → Render本番自動デプロイ → curlで `renderHomeCaseNav`/`oe-aic`=0 確認

---

## Phase52-12.0 Complete（ホーム案件一覧化＋削除後挙動改善 完了・push前）

- 現在Version: **Version1 / Phase52-12.0 Complete**（ホーム案件一覧化＋削除後挙動改善）
- Commit: **7e1568c**（`Phase52-12.0 home case list and delete return behavior`）
- 本番: **未反映（push承認待ち）**。localhost 実画面確認 + dev-check 200/200/200 で確認済み
- 変更ファイル: **`index.html` のみ**（追加のみ・**server.js / lib / DB / API / Workflow 無変更**・Phase53混入なし）

### 完了内容
- **ホーム案件一覧化**: 「🏠 ホーム」押下時、案件が1件以上あれば案件一覧カード（🕒最新一覧／各案件／＋新規案件）を表示。0件時は従来 empty-state を維持
  - 追加関数: `renderHomeCaseList()` / `_homeOpenCase()` / `_homeOpenCaseList()` / `_homeMakeCard()`（既存 `case-card` CSS・`getCasesForMember`・`selectMember`・`showNewCaseForm` を流用）
  - `goHome()` を案件一覧優先に変更（0件は従来 empty-state）
- **削除後挙動改善**（`deleteCase()`）: 案件が残っていれば毎回ホームへ戻さず連続削除しやすく。**0件時のみ** `goHome()`。選択中だった案件を削除した時だけ古いチャットを出さず「案件一覧」ビューへ、それ以外は現在画面を維持

### 確認済み
- localhost 実画面確認（ホーム一覧／カード開く／連続削除／0件時empty-state）完了
- dev-check 200/200/200 / node --check OK / 削除挙動スモークテスト OK
- commit `7e1568c` 内 Phase53マーカー（oe-aic / affiliate）= 0件

### 温存
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は未コミット温存
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行）は Version2 まで保留

### 既知の未対応（次工程）
- **削除済み案件がリロードでSupabaseから復活**する件 → **Phase52-12.1 案件削除同期** で対応予定
- **Phase52-12.1 は server.js / lib / 新規削除API を含むため、実装前に必ずユーザー承認が必要**
- **messages.case_id**（案件ごとの会話完全分離）→ **Phase52-12.2** で調査・DB変更承認相談

### 次工程
- **push承認待ち**（`git push origin main` → Render本番自動デプロイ → curlで反映確認）→ その後 Phase52-12.1 案件削除同期（要承認）

---

## Phase52-11.9 Complete（案件メタデータSupabase同期 A案 完了・push前）

- 現在Version: **Version1 / Phase52-11.9 Complete**（案件メタデータSupabase同期 A案）
- Commit: **1fff426**（`Phase52-11.9 sync case metadata via existing cases api`）
- 本番: **未反映（push承認待ち）**。localhost + dev-check 200/200/200 で確認済み
- 変更ファイル: **`index.html` のみ**（追加のみ・**server.js / lib / DB / API / Workflow 無変更**・Phase53混入なし）

### 完了内容（A案 = 既存 `/api/cases` 配線のみ）
- 案件メタデータ（案件一覧 / 案件タブ / caseId / title / userText / memberIds / updatedAt）を既存 `GET/POST /api/cases`（Supabase `cases` テーブル）経由で端末間同期
- 起動時 `syncCasesFromServer()` → 既存localStorage案件へ安全merge（updatedAtが新しい方を採用・local限定案件は削除しない）
- `createCase()` / `touchCase()` に `pushCaseToServer()` を追加（作成・更新時に `POST /api/cases`）
- 追加関数: `_caseServerToLocal` / `_caseLocalToServer` / `mergeServerCases` / `syncCasesFromServer` / `pushCaseToServer`
- localStorage（`ai-company-cases-v1`）はキャッシュとして維持（逆戻りなし）

### 確認済み
- dev-check 200/200/200 / node --check（インラインJS構文）OK / mergeロジック スモークテスト OK
- `/api/cases` GET→POST→GET 往復で Supabase 永続化を実証（往復テスト行は削除済み）
- commit内 Phase53マーカー（oe-aic / affiliate / AFFILIATE_INTELLIGENCE）= 0件

### A案の制約（未対応・仕様として許容 / B案・C案で将来対応）
- **template**: `cases` に列が無く端末間同期対象外（各端末localStorage値を保持）
- **案件削除の端末間同期**: DELETE APIが無くローカルのみ
- **メッセージの案件別振り分け（端末間）**: `messages` に case_id 列が無く、他端末では同期メッセージは最新一覧に表示（既存挙動）

### 温存
- cost関連（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は未コミット温存
- Phase53 Affiliate Intelligence Core（index.html 未ステージ +380行）は Version2 まで保留

### 次工程
- **push承認待ち**（`git push origin main` → Render本番自動デプロイ → curlでマーカー確認 → PC⇔携帯実機同期確認）

---

## Phase52-11.8 Complete（案件管理UI Version1 完成・本番反映済み）

- 現在Version: **Version1 / Phase52-11.8 Complete**（案件管理UI Version1 完成）
- 本番Commit: **5faa3f6**（`Phase52-11.8 complete case creation and navigation UI`）
- Render: **GitHub Push 完了 / Render 本番反映済み / Deploy live = 5faa3f6**（`ai-company-l45x.onrender.com`・`Phase52-11.8`マーカー21件・Phase53混入なし=oe-aic 0件）

### 現在完成済み（案件管理UI Version1）
- ホーム追加（🏠 ホームへ戻る導線）
- ＋新規案件（テンプレ選択つき作成）
- 案件タブ（上部・クリック切替）
- 案件一覧（🕒 最新一覧の案件カード画面）
- 最新一覧（全案件ビュー・名称明確化）
- 案件カード（案件名/テンプレ/最終更新/直近メッセージ/担当）
- 案件カード「開く」
- 案件削除
- 削除確認ダイアログ
- 案件並び替え（最終更新日時の新しい順）
- PC表示改善
- 携帯表示改善

### 現在確認済み
- PC: **正常**
- 携帯: **正常**
- 本番: **正常**

### 現在未完成
- 案件メタデータ同期: **現在 localStorage**（端末間で案件タブ/caseId は共有されない）
- 次Phase: **Phase52-11.9**（案件メタデータSupabase同期調査）

構成の詳細（11.8 / 11.8b ホーム復帰 / 11.8c 案件ナビ改善 / 11.8d 案件カード一覧画面）は docs/CHANGELOG.md を参照。

---

## Version1 Final Complete（Phase52-10 / 運用可能な完成版として正式完成）

- 現在Version: **v1.00-phase52-10**
- Current: **Version1 Final Complete**
- 最新コミット: **f177fd2**（Phase52-8-9 mobile topbar unified scroll・Render本番反映済み・iPhone Safari実機確認完了）

Version1は「機能完成」だけでなく、**運用可能な完成版**として正式完成した。以下をすべて完了として記録する。

- ☑ Instagram収益化パイプライン完成（Phase50-1〜52-1）
- ☑ Mobile UI完成（Phase52-5）／ Mobile Touch Hotfix完成（Phase52-6）
- ☑ Mobile Topbar完成（Phase52-8/52-9/52-9b）
- ☑ Render本番反映完了（ai-company-l45x.onrender.com = f177fd2）
- ☑ iPhone Safari実機確認完了（縦向き・横向きともTopbar 1本横スクロール・全ボタン操作可能・入力/送信可能・横はみ出しなし）
- ☑ PC表示正常（PC不変）
- ☑ Manual Only維持

次工程: **Version1.01 Realtime Sync Edition**（PC/iPhoneで同一状態のAI会社。Task/Conversation/Timeline/Notification/Workflow Live/Cost/Learning/Approval/Auto Task/Status を Supabase同期）。Version2（Affiliate Intelligence）はVersion1.01完成後に開始する（Decision 044・045）。Phase52-10はdocsのみ更新（コード変更なし）。

---

## Version1 運用開始（Phase52-3 / Instagram収益化運用開始）

- 現在Version: **v1.00-phase52-3**
- Current: **Version1 Operational**
- Status: **Instagram収益化運用開始**（運用開始日 2026-07-04）
- 開発フェーズ → Instagram実運用フェーズ へ移行（Version1は実運用しながら改善する・Decision 042）

現在の優先順位:
1. **Instagram運用**（実際の投稿・アカウント育成）
2. **A8登録**（A8.net等ASPへの登録・案件確保）
3. **Learningデータ蓄積**（投稿後の実績を手入力しInstagram Learning Centerへ）
4. **Version2設計**（Affiliate Intelligenceを最優先・Decision 042）

Claude Code停止中（クレジット不足等）は開発を停止し、Instagram運営 / A8案件調査 / 市場分析 / アカウント育成を優先する（Decision 042）。

---

## Version1 完成記録（Phase52-2 / Instagram収益化パイプライン完成）

- 現在Version: **v1.00-phase52-2**
- 現在フェーズ: **Version1 Documentation Complete**
- Version1状態: **Instagram収益化パイプライン完成**

Phase50-2〜52-1でInstagram収益化パイプラインが全工程実装完了に到達した（すべてindex.htmlへ追加のみ・既存機能無変更・Manual Only・Instagram API/自動投稿/画像生成/課金なし）。全工程:

```
市場分析（Instagram Marketing Intelligence / Phase50-1）
  ↓
企画（Instagram Content Planning / Phase50-2）
  ↓
カルーセル生成（Instagram Carousel Builder / Phase50-3）
  ↓
デザイン設計（Instagram Design System / Phase50-4）
  ↓
レビュー（Mobile Review Center / Phase50-5）
  ↓
承認（Mobile Approval / Phase50-6）
  ↓
投稿準備（Publishing Ready Center / Phase50-7）
  ↓
手動投稿（ユーザーが手動・自動投稿なし）
  ↓
Learning（Instagram Learning Center / Phase51-1）
  ↓
Asset Library候補生成（Asset Library Save Center / Phase52-1）
  ↓
完成
```

Version1完成済み機能（すべて追加のみ・既存無変更）:
- Instagram Marketing Intelligence（Phase50-1 / Tag v1.00-phase50-1）
- Instagram Content Planning（Phase50-2 / Tag v1.00-phase50-2）
- Instagram Carousel Builder（Phase50-3 / Tag v1.00-phase50-3）
- Instagram Design System / Image Layout Engine（Phase50-4 / Tag v1.00-phase50-4）
- Mobile Review Center（Phase50-5 / Tag v1.00-phase50-5）
- Mobile Approval（Phase50-6 / Tag v1.00-phase50-6）
- Publishing Ready Center（Phase50-7 / Tag v1.00-phase50-7）
- Instagram Learning Center / Learning Engine v1（Phase51-1 / Tag v1.00-phase51-1）
- Creative Asset Library Save Center / Save Integration v1（Phase52-1 / Tag v1.00-phase52-1）

Version2予定（Decision 041）: Asset Library実保存 / Learning永続化 / Instagram分析高度化 / TikTok展開 / YouTube Shorts展開 / LP連携 / AI自動改善。

---

## 現在地

- **Phase49-6 Complete**（Creative Asset Library）＝Creative Engineファミリー完結
- 現在Version: **v1.00-phase49-6**（Version1機能はPhase48-5で完成。Phase49-1〜49-6でCreative Engineファミリー完結）
- 開発状況: Creative Ad Assembly等の既存6関数（Publishing/AI Gateway/Image・Video Prompt Intelligence/Creative Execution/Creative Ad Assembly）を読み取り専用で参照し、Assetを管理・分類・コピー・ExportするCreative Asset Library（Phase49-6）を追加。新規判断・画像/動画生成・投稿は一切なし（Read Only固定）。dev-check 200/200/200
- **現在ステータス: Creative Engine Family Complete + Phase50-1 Instagram Marketing Intelligence Complete**
- **Version1 Roadmap方針変更（Decision 039）**: Version1の最優先目的をInstagram収益化支援へ変更。AI会社はInstagram運用を最初の実運用対象とする。Manual Only方針は維持。詳細は [docs/04ROADMAP.md](04ROADMAP.md) の「Version1 最優先ゴール」参照
- **Phase50-1 完了（Instagram Marketing Intelligence）**: 保存率/リーチ/プロフィール遷移/フォロー率/CTA/ハッシュタグ/投稿時間/カルーセル/リールの予測ヒューリスティック分析＋競合/トレンドの手動リサーチ支援＋手動実績入力（保存率/リーチ/プロフィール遷移/フォロー率/CV）。実API接続・自動投稿・自動課金なし（Decision 040）。現Version: **v1.00-phase50-1**
- 次工程: **Instagramマネタイズシステム構築の残り7ステップ**（Content Planning → Carousel Builder → Image Layout Engine → iPhone成果物確認画面 → iPhone承認機能 → 投稿予約 → Instagram運用開始）

### Creative Engine Family（全8 Phase・Completed）

| Phase | 内容 | ステータス |
|-------|------|-----------|
| Phase49-1 | AI Gateway Foundation | ✅ Completed |
| Phase49-1.1 | Registry Expansion | ✅ Completed |
| Phase49-1.2 | Registry Learning | ✅ Completed |
| Phase49-2 | Image Prompt Intelligence | ✅ Completed |
| Phase49-3 | Video Prompt Intelligence | ✅ Completed |
| Phase49-4 | Creative Execution | ✅ Completed |
| Phase49-5 | Creative Ad Assembly | ✅ Completed |
| Phase49-6 | Creative Asset Library | ✅ Completed |

---

## 現在完成済み

- AI Company Core
- Workflow Engine
- Knowledge Engine
- Knowledge Compare
- Learning Engine
- Company Memory
- Conversation History
- Supabase Persistence
- OpenAI Routing
- Claude Routing
- Provider Cost Meter
- Claude Quality History
- Output Package Quality
- Output Template Engine
- Output Auto Fill
- Output Preview Engine（完成イメージモックアップ表示）
- Publishing Engine（投稿タイトル/説明文/ハッシュタグ/投稿時間/CTA/チェックリスト自動生成）
- AI Gateway Foundation（判断層のみ。AI Skill Registry 13ツール・Gateway判断・安全ゲート・Copy・Export反映）
- AI Registry Expansion（Capability/Health/Cost/Approval/Route Priority/Version Registry。Gateway判断へ8項目追加）
- AI Registry Learning（実績ベースのrecommendationScore/confidence算出。Gateway判断へlearningオブジェクト追加。呼び出し関数のみ・自動呼び出しなし）
- Image Prompt Intelligence（GPT Image/ChatGPT Image/Midjourney/Flux/Ideogram/Recraft向けプロンプト自動生成。Output Type別最適化・AI Gateway連携。画像生成は未実行）
- Video Prompt Intelligence（Seedance/Flow/Veo/Kling/Runway/Luma/Pika/Hailuo/DOMOAI向けプロンプト自動生成。Output Type別最適化・AI Gateway/Image Prompt Intelligence連携。動画生成は未実行）
- Creative Execution（実行計画・コピー・チェック機能。16ツール対応Tool Planner。autoExecute=false固定・Manual Only）
- Creative Ad Assembly（広告素材セットの組み立て。Headline/Caption/CTA/Visual Direction/Image・Video Assets Plan。Assembly Only固定・投稿/生成は未実行）
- Creative Asset Library（既存Asset管理・分類・コピー・Export。Asset Tags/Search Keywords/Reusable Assets。Read Only固定・新規判断なし）
- Writer / Strategy / Designer Assist
- Output Quality Score（100点対応）
- Markdown Export
- JSON Export

---

## 現在の完成度

```
Core Engine
████████████████████ 100%

Workflow
████████████████████ 100%

Knowledge
████████████████████ 100%

Learning
████████████████████ 100%

Compare
████████████████████ 100%

Output Engine
██████████████████░░ 92%

Preview Engine
████████████████████ 100%

Content Generation
███████████░░░░░░░░ 55%

Publishing
████████████████████ 100%

AI Gateway（判断層）
████████████████████ 100%

AI Gateway（実行層 / Version2以降）
░░░░░░░░░░░░░░░░░░░░ 0%
```

---

詳細な開発ロードマップ（Phase48-4以降、v1.0〜v2.0）は [docs/04ROADMAP.md](04ROADMAP.md) を参照。

---

## 完了済み

### AI基盤
- OpenAI 接続
- Claude 接続
- Supabase 接続
- ログイン機能
- 会話履歴保存
- AI社員基盤（15名）

### Workflow
- Company Brain
- Knowledge Engine
- Workflow Live（完成版）
- Auto Task
- Leader Final
- Timeline
- Provider表示

### Claude担当
- Writer / Reviewer / Strategy

### OpenAI担当
- Leader

### Output Engine（Phase44）
- 13種 OUTPUT_TYPES 定義
- Leader による成果物タイプ自動判定
- 担当別フィールド割当
- Package表示（Instagram / Flyer / LP / Document / HTML / Generic）
- Copy / Export UI（markdown / json / html / text）

### Learning Engine（Phase45-2）
- OUTPUT_LEARNING_VERSION 1.0.0
- extractLearningItems() — 品質評価から学習項目生成
- 7カテゴリ分類 / Output Engine表示 / Export反映

### Company Memory（Phase45-3〜4）
- COMPANY_MEMORY_VERSION 1.0.0
- createCompanyMemoryCandidates() — Learning → Memory変換
- _companyMemoryBuffer（max50件）
- Knowledge Candidates 生成 / 承認UI（承認/保留/却下）

### Knowledge Save（Phase45-6C〜6D）
- saveApprovedKnowledgeCandidates() — /api/knowledge-library へPOST
- 重複防止（fingerprint照合 / _knowledgeSaveHistory max50件）
- Save Summary / Skipped Duplicates / Save History表示

### Knowledge Inject（Phase45-7）
- fetchKnowledgeForOutputType() — /api/knowledge-library GET
- selectRelevantKnowledge() — スコアリングで最大5件選定
- Workflow開始時に自動取得 / 失敗時はWorkflow継続
- Leader contextへ追記（getRoutedKnowledgeContext + getInjectedKnowledgeContext）

### Leader Intelligence（Phase46-2）
- buildLeaderExecutionGuide() — cta/structure/brand/avoid/prioritiesに分類
- Leader Execution Guide → Leader contextへ追記
- Workflow Live / Output Engine / Export に表示

### Knowledge Compare（Phase46-3）
- KNOWLEDGE_COMPARE_MODE（with_knowledge / without_knowledge / guide_only）
- switchKnowledgeCompareMode() — ボタン切替UI
- getInjectedKnowledgeContext() — モード別でLeaderへの注入を制御
- Leader Context Preview に Compare Mode / Injected to Leader 表示
- Debug に Compare Mode 追加 / Export に Knowledge Compare セクション追加

### Compare Log（Phase46-4）
- `_knowledgeCompareLog[]`（max30件）— Workflow完了ごとに自動記録
- `recordKnowledgeCompareEntry(draft)` — mode / score / outputType / injectedCount 記録
- `getCompareSummaryByMode()` — モード別平均スコア集計
- `buildCompareLogHtml()` — Output Engineに棒グラフ＋直近10件一覧
- Export（markdown / json）に自動反映

### Compare Intelligence（Phase46-5）
- `COMPARE_INTELLIGENCE_VERSION = '1.0.0'` / `_lastCompareIntelligence`
- `analyzeCompareIntelligence()` — mode別/outputType別/InjectionImpact集計 + recommendations生成
- `getCompareModeWinner()` / `getOutputTypeCompareInsights()` / `getKnowledgeInjectionImpact()`
- `buildCompareIntelligenceHtml()` — Output Engineに分析パネル（Winner/スコア/Impact/推奨）
- `appendCompareIntelligenceToExportMarkdown/Json()` — Export自動反映

### Compare Recommendation（Phase46-6）
- `COMPARE_RECOMMENDATION_VERSION = '1.0.0'` / `_lastCompareRecommendations`
- `buildCompareRecommendations(summary)` — priorityItems / outputTypeRecommendations / knowledgeRecommendations / reviewerHints / learningHints / cautionItems 生成
- `getCompareRecommendationPriority(item)` — high / medium / low 判定
- `buildCompareRecommendationHtml()` — Output Engine に改善提案パネル表示（HIGH/MED/LOW chip付き）
- `appendCompareRecommendationToExportMarkdown/Json()` — Export自動反映

### Compare Quality Integration Check（Phase46-7）
- `COMPARE_INTEGRATION_CHECK_VERSION = '1.0.0'` / `_lastCompareIntegrationCheck`
- `buildCompareIntegrationCheck()` — Log/Intelligence/Recommendation 統合チェック・checklist/nextTestActions/cautionItems生成
- `getCompareIntegrationStatus(check)` — ready/partial/insufficient 判定
- `buildCompareIntegrationCheckHtml()` — Output Engine に Integration Check パネル表示
- `appendCompareIntegrationCheckToExportMarkdown/Json()` — Export自動反映

### Compare Intelligence v2（Phase46-8）
- `COMPARE_IMPROVEMENT_VERSION = '2.0.0'`
- `buildCompareFailureAnalysis()` — Hook/CTA/Knowledge/Structure/Images/OutputType/Length 失敗率分析
- `buildImprovementScores()` — 5カテゴリ 0〜100点スコア（Knowledge注入効果・Guide有無反映）
- `buildCompareLearning()` — SUCCESS/FAIL/QUALITY/IMPROVEMENT 4パターン自動分類
- `buildLeaderImprovementSummary()` — 「今回改善すべきポイント」自動生成
- `buildImprovementScoreHtml()` / `buildCompareFailureAnalysisHtml()` / `buildCompareLearningHtml()` / `buildLeaderImprovementSummaryHtml()` — Output Engine パネル表示
- `appendImprovementToExportMarkdown/Json()` — Export自動反映

### API料金メーター（Phase47-1）
- `costTracker.js` — OpenAI: 日次(todayAmount) / 月次(monthlyAmount) / 累計(totalAmount) + 日付リセット(todayKey/monthKey)
- `claudeCostTracker.js` — Claude: 日次/月次/累計 + モデル別(sonnet/opus/haiku) + claude-cost-logs.json 永続保存
- `claudeClient.js` — trackUsage() 末尾で addClaudeUsage() を呼び出し（モジュールレベルrequire）
- `server.js` — /api/claude-cost エンドポイント追加（getSummary from claudeCostTracker）
- `index.html` — #cost-panel-body 完全再構成:
  - 上部: 本日合計(cp-today) / 今月合計(cp-month) / 残り / バー = OpenAI+Claude合計
  - Provider別: OpenAI(今日/今月/累計/モデル別) + Claude(今日/今月/累計/トークン/モデル別)
  - 右上ヘッダー💰ボタン = OpenAI+Claude合計
- `updateCostProviderPanel()` — /api/cost + /api/claude-cost + /api/claude-status を並行取得、合計を上部に反映
- 永続ファイル: cost-logs.json（OpenAI） / claude-cost-logs.json（Claude）

### Claude Cost Analysis（Phase47-2A・分析のみ）
- `claudeCostTracker.js` — `CLAUDE_COST_ANALYSIS_VERSION = '1.0.0'` / `getClaudeCostAnalysis()` 追加
  - totalRequests / totalInputTokens / totalOutputTokens / totalTokens / totalCost / todayCost / monthCost
  - byModel（モデル別料金・トークン・リクエスト数）/ topCostModel / topTokenModel / analysisWarnings
  - byRole: strategy=claude-opus-4-8専用のため実測、writer/reviewerはclaude-sonnet-4-6共有のため`writer_reviewer_combined`として合算表示（担当別判定なし）
- `server.js` — 既存 `/api/claude-cost` に `analysis` フィールドを追加（新規API追加なし）
- `index.html` — 料金メーターに「🔍 Claude Cost Analysis」パネル追加（`renderClaudeCostAnalysis()`）
- モデル変更・Provider構成変更・Compare Intelligenceへの反映は一切なし（Phase47-2Bでモデル最適化予定）

### Claudeモデル最適化（Phase47-2B）
- `claudeClient.js` — `CLAUDE_MODEL_POLICY_VERSION = '1.0.0'` / `CLAUDE_MODEL_POLICY` / `getClaudeModelForRole(role)` 追加
  - Strategy = 最高品質モデル（`claude-opus-4-8`・既存モデルのまま変更なし）
  - Writer / Reviewer = 最安モデル（`claude-haiku-4-5`・既存コード内定義済みモデルへ変更）
  - Default Claude Role = 最安モデル（今後追加するClaude担当のデフォルト）
  - `CLAUDE_MODEL_MAP` は `getClaudeModelForRole()` の結果を反映、`CLAUDE_PRICE_PER_1K` にhaiku価格を追加
  - `callClaudeAI()` / `generateClaudeReply()` / `testClaudeAgent()` の呼び出し箇所を更新
- `server.js` — `workflowAgentCaller()` / `/api/claude-cost` に `modelPolicy`（現在の担当別モデル・Provider変更なしフラグ）を追加
- `index.html` — Claude Cost Analysis内に「⚙️ Claude Model Policy」パネル追加
- 実API接続テスト(`/api/claude-test`)で実測確認: strategy→claude-opus-4-8 / writer→claude-haiku-4-5 / reviewer→claude-haiku-4-5
- Provider構成（Leader=OpenAI固定 / Strategy・Writer・Reviewer=Claude固定）は一切変更なし
- 既知の限界: `claudeCostTracker.js`のbyRole集計はsonnet固定ロジックのため、今後のwriter/reviewer(haiku)利用は担当別集計（byRole）には反映されない（byModelには正しく反映される）。Phase47-2C以降で対応要検討。

### Claude Model Quality Compare（Phase47-2C・比較のみ）
- `claudeCostTracker.js` — `CLAUDE_MODEL_QUALITY_COMPARE_VERSION = '1.0.0'` / `buildClaudeModelQualityCompare(currentModels)` 追加
  - `CLAUDE_PREVIOUS_POLICY`（Phase47-2B前の固定構成）: strategy=claude-opus-4-8 / writer・reviewer=claude-sonnet-4-6
  - currentPolicy: `getClaudeModelForRole()`／modelPolicyから取得（strategy=opus / writer・reviewer=haiku）
  - costImpact: 既存 `CLAUDE_PRICE_PER_1K` から算出。Sonnet→Haikuで入力・出力単価とも73.3%減
  - qualityCheckItems（9項目）/ adoptionReadiness（`readyForPhase47_2D: false` 固定）/ warnings
- `server.js` — `/api/claude-cost` に `qualityCompare` を追加
- `index.html` — 「🧪 Claude Model Quality Compare」パネル追加（Before/After/Cost Impact/Quality Check Items/Adoption Readiness/Warnings）
- モデル変更は行っていない（比較フェーズのみ）。Provider構成変更なし
- 正式採用判断はPhase47-2Dへ

### Claude Model Formal Adoption（Phase47-2D・正式採用）
- `claudeCostTracker.js` — `CLAUDE_MODEL_ADOPTION_VERSION = '1.0.0'` / `buildClaudeModelAdoptionStatus(currentModels, qualityCompare)` 追加
  - adoptedPolicy: Strategy=claude-opus-4-8（維持） / Writer・Reviewer=claude-haiku-4-5（正式採用） / Default Claude Role=claude-haiku-4-5 / Leader=OpenAI固定
  - adoptionReason（コスト削減見込み・品質維持方針・Provider不変・Workflow等への非影響を明記）
  - costReductionSummary（Phase47-2Cの costImpact を再利用、入力・出力単価とも73.3%減）
  - qualityDecision: qualityRisk="monitoring_required"（正式採用するが今後の実案件で品質監視を継続）
  - adoptionReadiness更新: `readyForPhase47_2D: true` / `formalAdoptionCompleted: true` / `qualityComparisonPending: false`
- `server.js` — `/api/claude-cost` に `adoptionStatus` を追加
- `index.html` — 「✅ Claude Model Formal Adoption」パネル追加（Status/Adopted Policy/Cost Reduction/Quality Monitoring/Provider Status/Next Actions）
- モデル変更なし（正式採用の記録・表示のみ）。実API接続テストでwriter→claude-haiku-4-5、strategy→claude-opus-4-8のまま変化なしを確認
- Provider構成変更なし
- 次工程: Phase47-3以降でCompare Intelligenceと連携した品質監視を継続

### Claude Quality Monitor（Phase47-3・Compare Intelligence連携）
- `claudeCostTracker.js` — `CLAUDE_QUALITY_MONITOR_VERSION = '1.0.0'` / `buildClaudeQualityMonitor(compareData)` 追加
  - compareDataはCompare Intelligence v2 `buildImprovementScores()`（index.html内メモリのみ・サーバー非永続）と同一形状。スコアは推測せず既存値のみ利用
  - qualityStatus（excellent/good/watch/critical） / monitoringRequired / qualityScore / recommendation（Keep Current Policy / Monitor Quality / Consider Sonnet / Need Manual Review） / issues / categoryScores / summary / warnings
  - データ不足時（サンプル数3未満）は`watch`+`Need Manual Review`で保留
- `server.js` — `/api/claude-cost` に `qualityMonitor` を追加。Compare Intelligenceデータはブラウザ側にしかないため、query パラメータ（overall/sampleSize/各カテゴリスコア）経由で受け取る方式
- `index.html` — `updateCostProviderPanel()`が既存 `buildImprovementScores()` を呼び出しqueryへ付与。「📊 Claude Quality Monitor」パネル追加（Current Quality / Monitoring Status / Overall Score / Recommendation / Detected Issues / Warnings）
- Compare Intelligenceの新しい比較ロジックは追加せず、既存スコアのみ利用
- モデル変更・自動切替は一切なし。Provider構成変更なし
- 次工程: 実案件での品質監視継続・Compare Intelligenceデータ蓄積

### Claude Quality History（Phase47-4・時系列品質監視）
- `claudeCostTracker.js` — `recordClaudeQualityHistory(entry)` / `getClaudeQualityHistory()` / `buildClaudeQualityTrend()` / `buildClaudeQualityWarning()` 追加
  - `_claudeQualityHistory[]`（メモリ内・最大20件・FIFO）: timestamp/workflowId/outputType/provider/model/overallScore/status/recommendation/cost/tokens
  - Quality Trend: Excellent/Good/Watch/Critical件数・平均/最高/最低スコア
  - Quality Warning: 直近5件平均と前5件平均を比較し5%以上低下でWarning（履歴10件未満は保留）。モデル自動変更は行わない
- `server.js` — `/api/claude-cost` に `qualityHistory` / `qualityTrend` / `qualityWarning` を追加（新規APIなし）。実スコア受信時のみ履歴記録
- `index.html` — 「📈 Claude Quality History」パネル追加。Export（Markdown/JSON）へQuality History/Trend/Warningを追加（`appendClaudeQualityHistoryToExportMarkdown/Json()`）
- 動作確認: 高スコア5件→低スコア5件投入でdegradationDetected: true（33.3%低下）を確認、20件キャップ・FIFO動作を確認
- モデル変更・自動切替は一切なし。Provider構成変更なし
- 既知の制限: 履歴はメモリ内のみ（サーバー再起動でリセット・永続化なし）
- 次工程: 実案件データ蓄積・履歴の永続化要否を検討

### Phase47-S: v1.00 Stable確定（最終確認・安定化）
Phase47-2A〜Phase47-4で完成した以下6機能の最終動作確認を実施。新機能追加なし・不具合修正のみ許可（今回は不具合なし・コード変更なし）。

確認済み項目:
- API: `/api/claude-cost` の analysis / modelPolicy / qualityCompare / adoptionStatus / qualityMonitor / qualityHistory / qualityTrend / qualityWarning が全て正常取得
- モデル: Strategy=claude-opus-4-8 / Writer=claude-haiku-4-5 / Reviewer=claude-haiku-4-5 を実API接続テストで実測確認、自動切替機構が存在しないことを確認
- Provider: Leader=OpenAI固定 / Strategy・Writer・Reviewer=Claude固定を維持（変更なし）
- UI表示順: Claude Cost Analysis → Claude Model Policy → Claude Model Quality Compare → Claude Model Formal Adoption → Claude Quality Monitor → Claude Quality History（index.html DOM順で確認）
- Export: Markdown/JSON双方でappendClaudeQualityHistoryToExport系関数の接続を確認
- 重複関数定義なし（Phase47系9関数を確認）
- 既存主要API（/, task-history, workflow-dashboard, cost, claude-status, knowledge-stats）全て200
- dev-check 200/200/200
- 次工程: Phase48（Claude APIコスト最適化トラック以外の新規テーマ、またはv1.0正式版に向けた残タスク: Instagram/動画/チラシ/LP/PDF/HTML完成品生成・Company Memory永続化）

### Phase47-5: Claude Quality History永続化
- `claudeCostTracker.js`
  - `CLAUDE_QUALITY_HISTORY_STORAGE_PATH`（`claude-quality-history.json`・既存`claude-cost-logs.json`と同様のJSON永続化パターンを使用。新規DB作成なし）
  - `_ensureClaudeQualityHistoryLoaded()`（遅延ロード。初回アクセス時にディスクから復元） / `_saveClaudeQualityHistory()`（`recordClaudeQualityHistory()`実行時に自動保存）
  - 最大20件・古いものから削除の既存仕様を維持
- `server.js` / `index.html` / Export: 変更なし。既存`/api/claude-cost`のqualityHistory/qualityTrend/qualityWarningが復元後データを返す。新規APIなし
- 動作確認: 3件記録→JSONファイル保存確認→サーバー再起動（dev-check）→GETのみで3件復元・qualityTrend正常再計算を確認。20件投入でキャップ・FIFOも永続化状態で正常動作を確認
- モデル変更・自動切替は一切なし。Provider構成変更なし
- 次工程: Phase48（新規テーマ、またはv1.0正式版残タスク）

### Phase48-1: Output Package Quality Checklist（成果物品質強化）
- `index.html`
  - `OUTPUT_PACKAGE_QUALITY_VERSION = '1.0.0'` / `OUTPUT_PACKAGE_QUALITY_TYPE_MAP`（実際のOUTPUT_TYPE_DEFINITIONS13種→チェックカテゴリ対応。存在しない型名は追加せず実在型のみ対応） / `OUTPUT_PACKAGE_QUALITY_CHECKS`（カテゴリ別チェック項目） / `evaluateOutputPackageCompleteness(draft)` 追加
  - score(0-100) / status(complete≥90 / almost_ready≥75 / needs_work≥50 / insufficient≤49) / missingItems / completedItems / recommendations / nextActions
  - `buildOutputPackageQualityHtml()` — Output Engineパネルへ「✅ Output Package Quality」表示追加
  - Export: `appendOutputPackageQualityToExportMarkdown/Json()` を既存Export関数群に接続
- 成果物生成ロジックは変更せず、既存`d.fields`の有無を確認するチェックのみ追加。画像/動画生成API・SNS投稿機能・PDF生成ライブラリ・HTML自動保存機能は追加していない
- ロジック検証（Node vm実行）で正常動作を確認（instagram_carousel部分入力→30点insufficient、schema上限まで埋めた状態→70点needs_work、pdf→57点、未知の型→genericフォールバック、ドラフト未生成→0点）
- モデル変更・Provider構成変更は一切なし
- 発見事項: flyer/pdf/html/videoなど複数タイプでCTA等のチェック項目に対応フィールドが現行テンプレートに存在しないことが判明。Phase48-2の成果物テンプレート強化で対応検討
- 次工程: Phase48-2 成果物テンプレート強化

### Phase48-2: 成果物テンプレート強化
- `index.html`
  - `OUTPUT_PACKAGE_QUALITY_VERSION`を`1.1.0`へ更新、`OUTPUT_PACKAGE_TEMPLATE_VERSION = '1.0.0'`追加
  - `OUTPUT_TYPE_DEFINITIONS.outputFields`を11タイプへ追加（instagram_carousel: targetAudience/benefit/saveSharePrompt、tiktok_video・youtube_shorts: cta/duration/musicMood/ending/visualPrompts/motionPrompts、flyer: subheadline/proof/area/cta/layoutInstruction/imageInstruction/contact、lp: firstView/problem/solution/benefits/proof/flow/faq/htmlStructure、pdf: visualInstruction/proof/cta/nextAction、html: copy/sections/htmlStructure/cta/responsiveNote/visualInstruction、image_prompt: subject/composition/lighting/background/usage、video_prompt: scene/cameraMotion/subjectMotion/ending/negativePrompt、document: sections/visualInstruction/proof/cta/nextAction）。既存フィールドは全て維持
  - `OUTPUT_PACKAGE_QUALITY_TYPE_MAP`: image_prompt/video_promptを専用カテゴリへ変更、documentをpdfカテゴリへ統一
  - `OUTPUT_PACKAGE_QUALITY_CHECKS`: 新規フィールドに対応するfieldKeysを設定（多くの項目がhasSchemaField: false→trueへ改善）、image_prompt/video_prompt専用チェックリスト新規追加
  - `OUTPUT_PACKAGE_QUALITY_RECOMMENDATIONS`: 新規項目の改善提案文を追加
- ロジック検証（Node vm実行）: 全対象タイプで全フィールド入力時にscore=100・status=completeを確認。Instagram Carouselは従来上限70点→100点に改善
- 後方互換性確認: 新規フィールド未入力時はscore=70のまま変化なし（回帰なし、hasSchemaFieldのみtrueへ変化）
- 成果物生成ロジック（buildOutputDraftFromLeaderFinal等）は変更なし。画像/動画生成API・SNS投稿機能・PDF生成ライブラリ・外部API追加はなし
- モデル変更・Provider構成変更は一切なし
- 次工程: Phase48-3 成果物テンプレート別プレビュー強化

### Phase48-3: Output Auto Fill Engine
- `index.html`
  - `_extractLabeledSection()` / `_extractHashtagsFromText()` / `_extractCtaFromText()` — テキスト解析ベースの汎用抽出ヘルパー新設（新規AI呼び出し・課金なし）
  - `_getRoleReplyText(agentId)` — `_atTaskHistory`からWriter/Strategy/Designer個別回答を検索し補助情報として利用
  - `buildOutputDraftFromLeaderFinal()`を11タイプへ拡張し、Phase48-2の新規フィールドをラベル抽出・キーワード検出・汎用フォールバックで自動反映
  - `buildOutputPackageQualityHtml()`に90点未満時の改善バナーを追加（改善ループ）
- ロジック検証（Node vmで`buildOutputDraftFromLeaderFinal()`を実行）: instagram_carousel/tiktok_video/flyer/lp/pdf/html/image_prompt/video_promptの8タイプ全てでscore=100・status=completeへ到達を確認
- Writer/Designer補助の実動作確認: Writer個別回答からoffer/proof/area/contact、Designer個別回答からlayoutInstruction/imageInstructionが正しく反映されることを確認
- 誠実性の担保: 連絡先・エリア・具体的オファー等の実在しない事実は捏造せず、ラベル未検出時は空のまま
- 成果物生成の中核ロジック・Workflow・Compare・Learningの呼び出し箇所は変更なし。モデル変更・Provider構成変更なし
- 次工程: Phase48-4 Output Preview Engine

### Phase48-4: Output Preview Engine
- `index.html`
  - `OUTPUT_PREVIEW_VERSION = '1.0.0'` / `buildOutputPreviewHtml()` を新設し、Instagram Carousel / LP / チラシ / PDF / HTML / TikTok・YouTube Shorts の完成イメージをスマホ枠・ブラウザ枠・A4カード・ページ風カード・iframe描画・縦型動画枠として画面表示
  - HTMLタイプは`f.html`があれば`<iframe sandbox="" srcdoc="...">`で実際のHTMLをそのまま描画（script実行はsandboxで完全ブロック）
  - Output Package Qualityスコア（Phase48-1）をPreview右上バッジに連動表示（Decision 022の実装）
  - 既存Package表示・Export・Workflow・Knowledge Chainは無変更
- ブラウザ実機確認: `_lastOutputDraft`にサンプルデータを注入し6タイプで表示確認、XSS注入テストでスクリプトブロックを確認、空データ・未対応タイプで例外なしを確認
- 次工程: Phase48-5 Publishing Engine

### Phase48-5: Publishing Engine
- `index.html`
  - `PUBLISHING_ENGINE_VERSION = '1.0.0'` / `createPublishingDraft()` を新設し、Instagram/TikTok/YouTube Shorts/チラシ/LP/HTML/PDF/画像プロンプト/動画プロンプト/汎用文書の10タイプでタイトル・説明文・ハッシュタグ・投稿時間・画像/動画一覧・CTA・公開前チェックリストを自動生成
  - Instagram=15〜30件・TikTok=5〜15件・YouTube Shorts=3〜10件（`#Shorts`含む）のハッシュタグ数を自動調整
  - Output Package Qualityスコア（Phase48-1）が80点未満の場合のみ警告文を追加
  - Output Preview Engine（Phase48-4）のバージョンを`sourcePreviewVersion`へ連携（Preview非対応タイプでも独立動作）
  - Copy Title/Description/Hashtags/CTA/All Publishing Dataの5ボタン、Markdown/JSON Export反映を追加
  - 既存Package表示・Preview Engine・Export・Workflow・Knowledge Chainは無変更
- ブラウザ実機確認: 10タイプ全てでPublishing Engineパネル表示、ハッシュタグ数範囲、Quality連携（80点境界値判定含む）、Export反映、Copy機能を確認
- 次工程: Phase49 AI Creative Engine

---

## ブラウザ確認済み

✅ Workflow Live が送信直後に開く
✅ Company Brain 実行
✅ Writer → Claude
✅ Reviewer → Claude
✅ Strategy → Claude
✅ Leader Final 完了
✅ Auto Task 完了
✅ Output Engine 成果物表示
✅ Knowledge Save / Guard / Inject

---

## 次に実装すること

### Priority 0: Phase50-1 Instagram Marketing Intelligence（旧Marketing Intelligence Foundationから優先順位変更・Decision 039）

Phase49-1〜49-5でAI Gateway一式・Image/Video Prompt Intelligence・Creative Execution・Creative
Ad Assemblyを実装し、Phase49-6でCreative Asset Library（`createCreativeAssetLibraryDraft()`）を
実装した。既存6関数（`createCreativeAdAssemblyDraft()` / `createCreativeExecutionDraft()` /
`createImagePromptIntelligenceDraft()` / `createVideoPromptIntelligenceDraft()` /
`createPublishingDraft()` / `createAIGatewayDecision()`）の呼び出しのみでAssetを構成し、新規判断
は一切行っていない。Asset Library Only/No External Execution/No AI Generation/Manual Reuse Only/
Read Onlyの5ラベルを固定バッジとして常時表示。Output Engineパネル・Copy 6ボタン・Markdown/JSON
Export反映まで実証済み。実際の画像/動画生成・投稿・外部AI通信は一切行っていない（Decision
030〜037）。これによりCreative Engineファミリー（Phase49-1〜49-6）が完結した。

Version1のRoadmap方針を変更し（Decision 039）、最優先目的をInstagram収益化支援へ変更した。次工程は
Phase50-1 Instagram Marketing Intelligence（旧Platform Intelligenceを改称・最優先へ格上げ。保存率/
リーチ/プロフィール遷移/フォロー率/CTA/ハッシュタグ/投稿時間/カルーセル/リール/競合/トレンド分析。
汎用市場分析/SEO分析はPhase50-3へ後回し、詳細は docs/04ROADMAP.md 参照）。Manual Only方針は維持。

### Priority 1: 実案件での品質履歴蓄積

Phase47-5でClaude Quality Historyを`claude-quality-history.json`へ永続化済み（最大20件・サーバー再起動対応）。
実案件を蓄積してqualityHistory/qualityTrend/qualityWarningの推移を確認する。
degradationDetectedが継続する場合はSonnetへの切り戻しを検討する（自動切替は行わない）。
Leader は OpenAI 固定（変更禁止）。

---

## 開発ルール

毎Phase終了時は必ず
- dev-check 200/200/200
- ブラウザ実機確認
- Git Commit
- Git Tag
- 完了レポート

を実施する。

---

## 成果物方針（最重要）

AI会社は回答を返すことが目的ではない。

**完成した成果物を大量生産し、品質が毎回向上していく**ことが目的。

SNS自動投稿は後回し。まず投稿直前までの成果物品質を最高水準に引き上げる。

---

## 次チャット開始手順

1. docs/06HANDOVER_NEXT_CHAT.md を読む
2. MASTER.md を読む
3. PHASE_PROGRESS.md を読む
4. CLAUDE_RULES.md を読む
5. PROJECT_STATUS.md を読む
6. 現在地を要約
7. Phase48-5（Publishing Engine）完了＝Version1機能完成。Phase49-0〜49-6（Version2 Roadmap正式化〜Creative Asset Library）完了済み＝Creative Engineファミリー完結。Version1の最優先目的をInstagram収益化支援へ変更（Decision 039）。Phase50-1（Instagram Marketing Intelligence）から開発再開（docs/04ROADMAP.md参照）
