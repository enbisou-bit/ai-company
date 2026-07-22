# CHANGELOG — ENBISOU AI COMPANY

> 本番反映済みの主要変更履歴（新しい順）。詳細は docs/02PHASE_PROGRESS.md を参照。

---

## Instagram自動運営 工程1-B本体（Workflow Wiring）（2026-07-22・localhost実DB検証完了・**未commit／Render未反映**）

**Affiliate Intelligence Core（Phase53・従来はメモリ保持のみ）を永続化APIへ接続**。**`index.html`（+390/-4）の1ファイルのみ**・`server.js`／`lib`／DB／Migration／**API shape** 無変更。**Phase54 Complete維持・Phase55未着手**。

- **案件境界 D-1**：`_affiliateCases` は現在案件のみ保持。未保存・保存失敗行は **caseId付き退避バッファ**で案件横断に保持し、案件切替でも消さない。
- **保存**：`addAffiliateCase()` の明示追加時のみPOST。**Leader Final／Workflow完了／Export時はPOSTしない**。案件未確定時は登録自体を中止（未所属評価を作らない）。
- **復元**：案件確定4経路へ個別配線（相互呼出なし＝**1操作1GET**）。GETは **`caseId`＋`channelScope=all`＋`activeOnly=true`** を明示。**同一案件の再同期は表示を消さず／別案件切替は前案件を即時クリア**。request tokenとcaseId再照合で**古い応答を破棄**。
- **`sourceFingerprint`（client生成）**：`affiliate-evaluation-v1:` ＋固定順配列。**`caseId` と実効 `channelScope` を必ず含む**（`source_fingerprint` はテーブル全体でグローバルUNIQUEのため）。timestamp／random／client一時ID は含めない。fingerprint内のみ小数2桁正規化（**DB保存値は丸めない**）。
- **POST payload**：`productIdentifier`・`channelScope`・`recommendation`・`source` は**送らず**サーバー正本／server既定に委ねる。`detail`(JSONB) に**評価補足7項目＋`origin='affiliate-intelligence-core'`＋メタ2項目**。
- **重複表示修正**：`_aicDedupeSavedRow()` 追加。同一caseId内で ①同一`serverId` ②同一`sourceFingerprint` ③**同一`channelScope`かつ同一`productIdentifier`** の重複行を統合。**別caseId・別scopeは除去しない**。
- **保存状態UI**：`unsaved|saving|saved|save_failed` バッジ／**保存済み行は除外不可**（inactive化API未実装のため誤認防止）／失敗行は**無言消失させず再送ボタン**を提供。
- **検証**：`node --check` OK・**dev-check 200/200/200**・**純関数 46/46 PASS**・**localhost実DB Case 1〜9 全合格**（冪等でDB行数不変／再評価は旧activeのみinactive／案件分離・混入ゼロ／保存済み行は POST・PATCH・DELETE 0件／失敗→同一fingerprintで再送成功／案件未確定でGET0・POST0／同一案件GET失敗で表示維持）・**console error 0**・**PATCH/DELETE 通算0件**。
- **後始末**：Supabase SQL Editorで専用caseIdの**限定DELETE**を実行し **`remaining = 0`**。localhost GETでも **A=0件／B=0件**を確認。
- **未確認**：通常ログイン経路の実操作／F5後の `save_failed` 保持（**Known Limitation**）／Render本番POST／別scopeの実運用検証。
- **Git**：**未commit**（HEAD = origin/main = **d270ceb**）。保護対象4件は未stage。

---

## Instagram自動運営 工程1-B-0a〜0d — Affiliate評価 Active一意性の商材単位化（2026-07-22・Code commit **2ef2ad3**・Migration完了・実DB検証完了）

**Affiliate評価のActive一意性を「案件×チャネル」から「案件×チャネル×商材」へ移行**。**`lib/affiliateEvalDb.js`（+36/-6）の1ファイルのみ**・`server.js`／`index.html`／`schema.sql`／他lib／他API **無変更**・**API shape維持**。**Phase54 Complete維持・Phase55未着手**（Decision 070）。

- **Migration**：`DROP INDEX uq_affiliate_eval_active_case` → `CREATE UNIQUE INDEX uq_affiliate_eval_active_product ON affiliate_evaluations (case_id, channel_scope, (COALESCE(product_identifier,''))) WHERE is_active`。**Supabase SQL Editorで実行**（Claude Code環境にDDL経路なし）。旧Index不在・新Index定義一致・件数不変を `pg_indexes` 実測で確認。
- **productIdentifier**：**サーバー正本**（`lib/affiliateEvalDb.js`）。`JSON.stringify([normalizedProductName, normalizedAspName || null])`。正規化＝全角空白→半角／trim／連続空白統一／英字小文字化。**NFKC・ASP別名辞書・記号除去は不採用**。JSON配列採用で**区切り文字衝突を回避**。
- **案A（厳格）**：`productName` があればサーバー側で**必ず再生成**し、**client送信の `productIdentifier` は保存しない**。`productName` なしは **null**。
- **旧active無効化を subject 限定**：値ありは `.eq('product_identifier', …)`／**nullは `.is('product_identifier', null)`**。`.eq(…, null)` は不使用。**`_str()` 共通関数は無変更**。
- **検証**：`node --check` OK・**dev-check 200/200/200**・GET非回帰OK・**純関数テスト 15/15 PASS**・**実DB POST検証 全8ケース成功**（Active **5件共存**／Inactive 2件／履歴 7件／**23505なし**／**HTTP 500なし**／全POST `ok:true`・`source:"db"`）。**`.eq()`／`.is()` が他商材・別ASP・null↔非null を巻き込まないことを実DBで実証**。
- **後始末**：Supabase SQL Editorで専用 `case_id` の**限定DELETE**を実行し **`remaining = 0`**。localhost GET（`activeOnly=0`）でも履歴込み0件を独立確認。**条件なしDELETE不使用・実案件データ無影響**。
- **既知事項**：①**`schema.sql` 未記録**（`affiliate_evaluations` は定義自体が未記録・別工程） ②**`index.html` 配線は未着手**（工程1-B本体） ③RPC/transaction化は未実施 ④**inactive化／PATCH／DELETE APIは未実装** ⑤**1 case に active 複数件**があり得る（「active＝1件」前提の利用側を作らない） ⑥**Phase55未着手を維持**。
- **Git**：Code commit **2ef2ad3**（`Fix affiliate evaluation active uniqueness by product`）／docs commit＝本更新（確定SHAは完了報告に記載）。保護対象4件は未stage。

---

## Instagram自動運営 工程1-A — Affiliate Evaluation Persistence API（2026-07-21・Code commit **047f4d3**・localhost検証完了）

**会社共通Affiliate評価の永続化APIを追加**。**`server.js`（+34/-1）＋ `lib/affiliateEvalDb.js`（新規110行）の2ファイルのみ**・index.html／schema.sql／他lib／他API **無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 069）。

- **API**：`GET /api/affiliate-evaluations`（`caseId`必須・`channelScope`任意・`activeOnly` 既定true／`0`で履歴込み・`created_at`降順）／`POST /api/affiliate-evaluations`（`caseId`・`sourceFingerprint` 必須）。入力不備は **400**、それ以外は **200＋`ok:false`**（既存API方針を踏襲）。
- **冪等性**：`source_fingerprint` UNIQUE。同一fingerprint再送は**新規登録せず既存を返す**（`idempotent:true`）。
- **履歴保持**：同一 `case_id`＋`channel_scope` の**旧activeを`false`化**してから新active1件をinsert。**物理削除しない**。
- **fallback契約**：`source:'db'|'fallback'|'error'` を区別（Supabase未設定・障害を空配列と同一扱いにしない）。
- **データ健全性**：**JSONB `detail`** は構造保持／数値は有限数のみ（不正値null化）／`recommendation` は `adopt`/`watch`/`reject` のみ／生SQL不使用（supabase-jsのパラメータ化クエリのみ）／書込みは **`affiliate_evaluations` のみ**。
- **確認**：`node --check` 2ファイル成功・**dev-check 200/200/200**・localhost GET成功（`source:"db"`）・localhost POST成功・再送 **`idempotent:true`**・**履歴込み1件**→テストデータ削除後 **履歴込み0件**・**実案件／他テーブル影響なし**。
- **既知事項**：①旧active無効化→insert は**非トランザクション** ②insert失敗時 active 0件の可能性を **`activeMayBeZero:true`** で通知 ③RPC/transaction化は別工程 ④日本語文字化けは**API不具合ではなくWindowsシェル→curlの文字コード問題** ⑤日本語POST再確認は **UTF-8 JSONファイル＋`curl --data-binary @file.json`** ⑥**inactive化／PATCH／DELETE APIは未実装** ⑦**Phase55未着手を維持**。
- **Git**：Code commit **047f4d3**／docs commit＝本更新（確定SHAは完了報告に記載）／tag **v1.01-affiliate-evaluation-step1a**（docs commit を指す）。

---

## 社員向上B 正式完了 — 定義駆動セクション移行（2026-07-21・localhost検証完了・**push前・Render未反映**・HEAD **61dde05**）

**改善案件「社員向上B」を正式完了**。定義分散を解消し、`OUTPUT_SECTION_DEFINITIONS` による定義駆動基盤を完成。**13型中11型移行済み**（Flyer/LP 正式保留）。**index.htmlのみ**・未push 7コミット・server.js/lib/DB/API/schema.sql **無変更**。**Phase54 Complete維持・Phase55未着手**。※本項は**push前・Render未反映**（本番実機確認は未実施）で、上記B-1までとは反映状態が異なる。

7コミットを工程順に記録（各工程の目的→到達点）：

1. **c38df55 — Section定義（B-2-1）**：目的＝output型の各セクション（見出し／構成要素）を定義データとして一元化。到達＝`OUTPUT_SECTION_DEFINITIONS` Section定義層を新設（index.html +191）。定義の正本を確立。
2. **6fc3616 — Section抽出エンジン（B-2-2a）**：目的＝定義からdraft fieldを機械的に構築し、inline実装への分散を解消。到達＝抽出エンジン＋wrapperによる安全適用（`implemented:false`対応・型別fallback維持）を追加（+222/-4）。旧inline処理と等価。
3. **a48380c — document / pdf（B-2-2b）**：目的＝両型のdraft fieldを定義駆動へ移行。到達＝移行完了・旧新等価・mismatch 0（+33/-9）。
4. **43598a6 — image_prompt / video_prompt（B-2-2c）**：目的＝プロンプト系2型を定義駆動へ移行。到達＝ハイブリッド移行完了・非回帰（+48/-20）。
5. **83fbad3 — powerpoint / excel（B-2-2d）**：目的＝資料系2型を定義駆動へ移行。到達＝移行完了・updatedFields一致（+37/-3）。
6. **（B-2-2e 調査）**：目的＝instagram/video系型の移行方式を確定。到達＝調査完了（コミット無し・実装は下記f/gで反映）。
7. **51caede — instagram_post / instagram_carousel（B-2-2f）**：目的＝Instagram系2型を移行。到達＝instagram_post 完全定義駆動・instagram_carousel ハイブリッド移行完了（+40/-12）。
8. **61dde05 — tiktok_video / youtube_shorts / html（B-2-2g）**：目的＝動画系2型＋htmlを移行。到達＝html 完全定義駆動・tiktok/youtube ハイブリッド移行完了＝**社員向上B 正式完了**（+45/-18）。

**最終移行状況**：完全定義駆動6（document/pdf/powerpoint/excel/instagram_post/html）／ハイブリッド5（image_prompt/video_prompt/instagram_carousel/tiktok_video/youtube_shorts）／正式保留2（flyer/lp・優先順位判断・別工程で再評価）。
**品質確認（ローカル）**：旧新等価・mismatch 0・updatedFields一致・wrapper非回帰・二重生成なし・二重代入なし・JS構文OK・dev-check 200/200/200・console error 0・**AI API実行なし**・POST/PATCH/DELETEなし。
**Git**：HEAD **61dde05**／origin/main **ac2f5da**／**local ahead 7**（未push）／最新Tag **v1.01-phase54-video-html-section-migration**。**push・Render反映は未実施**（ユーザー承認後）。Decision **068** 参照。

---

## Output Type Normalization（社員向上B 工程B-1）（2026-07-20・localhost確認済み・commit **066241f**・tag **v1.01-phase54-output-type-normalization**）

**outputType の正本を明文化し、正規化関門を追加**。**index.htmlのみ（+40/-7）**・server.js/lib/DB/API/schema.sql **無変更**。**Phase54 Complete維持・Phase55未着手**。

- **正本**：定義=`OUTPUT_TYPES`（13種・増減なし）／ランタイム=`_lastOutputDraft.type`／永続化=`output_drafts.type`／表示定義=`OUTPUT_TYPE_DEFINITIONS`／`outputType`=`draft.type` 派生値（新たな並行正本なし）。
- **`normalizeOutputType()` 追加**：正式値そのまま／legacy alias 9件（`ppt`/`pptx`→`powerpoint`・`landing_page`/`landing-page`→`lp`・`youtube_short`→`youtube_shorts`・`image-prompt`→`image_prompt`・`video-prompt`→`video_prompt`・`instagram-carousel`→`instagram_carousel`・`instagram-post`→`instagram_post`）／空・null・undefined・unknown・未知値→`document`／曖昧語（instagram/insta/ig/reel/video/post/carousel）は非alias（`detectOutputType()` 責務）。
- **境界正規化**：Workflow生成起点・`createOutputDraft()` 入口・DB復元・`normalizeOutputDraft()`・保存Payload（null不送出）・Output Engine主要表示（定義label経由）。DB CHECK制約は追加しない。
- **確認**：dev-check 200/200/200・console 0・正規化テスト **24/24 PASS**・13種自己返却OK・Draft/復元/保存/Export/Preview/Publishing 非回帰・**AI API実行なし**。
- **Git**：Code commit **066241f**・tag **v1.01-phase54-output-type-normalization**（→066241f）・Docs commit（本更新）。

---

## Cost DB Opening Balance / 一意性 / 23505 / schema.sql 記録（2026-07-19・commit **81a5288**・tag **v1.01-phase54-cost-db-complete**・**push未実施**）

**Cost DB 完成の記録**。**Phase54 Complete維持・Phase55未着手**。

- **Opening Balance**：OpenAI 54.05円／Claude 319.57円（`$1.997365 × 160 − 既存Event0.01`）登録済み。active2件・grand_total 373.66円。
- **一意性**：業務＝`(provider, balance_type) WHERE is_active`（`uq_api_cost_ob_active_provider_type`）／技術的冪等＝`source_fingerprint` UNIQUE。**旧 `uq_api_cost_ob_active_legacy` 廃止**。
- **23505 二段階判定**：`lib/costDb.js` `ensureOpeningBalance()`（+43/-2）。fingerprint → 業務キーで区別（`OPENING_BALANCE_ACTIVE_CONFLICT`）。stub全PASS・dev-check 200/200/200・実DB非接触。
- **schema.sql**：Cost DB 全定義を **+181 純追記**（定義記録用・本番migrationではない）。
- **変更ファイル**：`lib/costDb.js` / `supabase/schema.sql` / docs（01/02/04/06/CHANGELOG）。

---

## Agent Settings Persistence（工程A）（2026-07-17・**localhost確認済み**・commit **8c9ed58**・tag **v1.01-phase54-agent-settings-persistence**）

**Auto Task（autoStart）／自律相談（autonomousConsult）の選択状態を localStorage で端末内保持**。**index.htmlのみ（+45/-7）**・server.js/lib/DB/API/SQL **無変更**。**Phase54 Complete維持・Phase55未着手・工程B以降は未着手**。

- **原因**：永続化処理が存在せず、起動毎に初期値 `let autoStart = false` / `let autonomousConsult = false`（＝「手動」「OFF」）へ戻っていた。**なお、これは実装漏れではなく「課金防止システム」節の意図的な設計**（旧コメント：`localStorageには保存しない（起動毎にリセット）`）であり、方針変更としてユーザー承認のうえ実施。
- **追加キー**（既存の設定系規則 `enbisou_*_v1` に準拠）：`enbisou_auto_start_v1` / `enbisou_autonomous_consult_v1`（値は `'1'`/`'0'`）。
- **保存**：`toggleAutoStart()` / `toggleAutonomousConsult()` のトグル直後に `_saveAgentSetting()`。
- **復元**：`restoreAgentSettings()` を新規追加し **`showApp()` 冒頭**から呼ぶ（初回ロード・再ログインの両経路を通る唯一の入口）。保存値なし・不正値は**既存初期値 `false` へフォールバック**（localStorage不可でも起動を止めない）。
- **UI同期**：復元時に `updateAutoStartBtn()` / `updateAutonomousConsultBtn()` を必ず呼び、**内部値と表示を一致**させる。自律相談の表示更新はトグル内インラインだったため、`updateAutoStartBtn()` と同形の関数へ切り出し（重複実装の回避・表示内容と挙動は従来と同一）。
- **【課金防止の維持（最重要）】**：**復元するのは設定値と表示のみで、起動時に Workflow / AI / API を自動実行しない**。`autoStart` を参照して実行するのは `atAutoStartWorkflow()` のみで、その呼び出し元は `handleLeaderDispatch` 内の3箇所（＝ユーザーがLeaderへ依頼した後）のみ。**起動経路からの呼び出しは存在しない**。`if (!autoStart) return;` と `autoStart && !billingLock` のガードも従来どおり有効。
- **確認（localhost）**：自動→F5→「自動」維持／手動→F5→「手動」維持／ON→F5→「ON」維持／OFF→F5→「OFF」維持／案件切替・ホーム移動・**ログアウト→再ログイン**でも維持（再ログイン前に内部値を意図的に `false` へ落として復元を実証）／内部値と表示の一致を全ケースで確認／**起動時リクエストはすべてGET・AI実行系POSTは0件**（`chat|dispatch|auto-task|workflow|consult|openai|claude` 一致0件・`_atCurrentWorkflowId` は `null`）／**console 0**／**dev-check 200/200/200**／インラインJS 2ブロック構文OK。
- **非対象**：**端末間同期（DB列がなくSQL変更が必要なため別判断）**／Auto Task・自律相談の処理内容／Workflow成果物改善／Leader要約／テンプレート混入修正／Publishing／並列化／Learning・Compare／**工程B以降**。
- **非接触**：`LEADER_FINAL_PROMPT` / `extractSlides` / `imagePrompts` / `_taskBulkRunPooled` / `_persistNewTask` / `syncTasksFromServer`（diffに非該当を実測確認）。
- **保留**：**前工程（Task作成dbId Hotfix）の本番実機確認は未実施のまま**。

---

## Task Create dbId Hotfix（2026-07-17・本番反映済み・**localhost確認済み**・commit **39b44d0**・tag **v1.01-phase54-task-create-dbid**）

Task新規作成時の **`dbId` 取り込み失敗＝二重表示**を解消。**index.htmlのみ（+15/-9）**・server.js/lib/DB/API/SQL **無変更**。**Phase54 Complete維持・Phase55未着手**。

- **原因（クライアント単独。サーバー・API・DBは正常）**：POST は成功し `{ ok:true, task:{id} }` を返しているのに、クライアントが `dbId` を取り込めず local-only のまま残存 → リロード時の merge（照合キーは `dbId` のみ）で**サーバーコピーが別途 push され二重表示**。backfill の署名照合（Pass A）は、起動順が `sync` → `backfill` のため**同期済みコピーが既に dbId を確保済み**となり採用できず、**二重化は自動解消されない**。
- **① `submitTask()` の dbId 誤代入**：非同期コールバック内で**配列先頭を再評価**していたため、POST往復（本番RTT実測 約0.9秒）の間に他経路の先頭挿入（7か所）が割り込むと**dbId が別Taskへ代入**され、本来のTaskは永久に local-only 化。**条件付き発生**。→ 作成Taskを**捕捉変数**で保持し `_persistNewTask()` へ統一。
- **② `atCreateNextTasksFromItems()` の握り潰し**：POST を投げっぱなしにして**返却された dbId を常に破棄**していたため、この経路のTaskは**必ず** local-only 化。**Decision 063（Case成功確認契約）と同型**。→ `_persistNewTask()` へ統一。
- **結果**：**全7つの作成経路が安全な方式に統一**（`_persistNewTask` ×5／`.then` 捕捉変数 ×2）。`tasks[0].dbId` / `syncTaskToServer(task).catch` / `syncTaskToServer(tasks[0])` の残存は**本番配信コードで0件**を確認。
- **確認**：fetchスタブ（実DB非接触）で、連続作成の全Taskが**自分自身の dbId** を取得（**解決順を逆転させた条件でも誤代入0**＝潜在リスクも解消）／自動次Task 3件とも dbId 取得・重複0／**同期後も local 3件 = server 3行・重複0＝二重表示なし**。**対照実験**で旧実装を局所再現すると同一条件で**local 4件・重複1件を再現**（修正が原因に効くことの直接証拠）。**console 0**・**dev-check 200/200/200**・インラインJS 2ブロック構文OK・本番配信コードがローカルと**完全一致**。
- **非接触**：`syncTaskToServer()` 本体（正常）／**`syncTasksFromServer()` の merge・reconciliation は無変更**／Server正本契約（`archivedAt` / `deletedIds`）／backfill／一括操作Hotfix（`_taskBulkRunPooled` 等）／Decision 063・064・065。
- **DB実測（確認時点・無変更）**：生存tasks **253**／archived **167**／deletedIds **127**／cases 生存**2**・削除済**2**。検証用Taskの混入**0件**。
- **未整理（別途判断）**：本番DBの**重複署名16グループ・余剰16行**（すべて2行重複）は**今回触っていない**。本Hotfixは**新規発生の停止**のみで、**既存の二重化データは自動解消されない**。
- **残**：**本番実機確認**（PC）。

---

## Task Bulk Action Hotfix（2026-07-17・本番反映済み・**localhost実機確認済み**・commit **deba2ed**・tag **v1.01-phase54-task-bulk-parallel**）

Task一括操作（**アーカイブ／復元／完全削除**）を**同時5並列化**し、**進捗表示・二重実行防止・成功ごとの保存**を追加。**index.htmlのみ（+200/-65）**・server.js/lib/DB/API/SQL **無変更**。**Phase54 Complete維持・Phase55未着手**。

- **原因**：1件ずつ直列 `await`（本番RTT実測 約0.9秒 × 133件 ≒ **約2分**）で、その間UI無反応・`saveTasks()` もループ完了後の1回のみ。待ちきれず画面更新すると処理が中断し、**PATCH完了分のみ Server正本から復元**されるため「全選択しても一部しかアーカイブされない」ように見えていた（**サーバー・DB・Task同期・件数制限はいずれも正常＝クライアント単独の問題**）。
- **対策**：`_taskBulkRunPooled()`（共有カーソル方式・同時**5**固定・`Promise.all` の無制限展開は不使用・重複処理なし・1件の例外で全体を止めない）／`_taskBulkSetBusy()`（フラグ・ボタンdisable・`beforeunload` を一元管理・`finally` で確実解除）／`_taskBulkProgress()`（進捗のみ更新）。
- **成功確認契約は不変**：`setTaskArchivedOnServer` / `softDeleteTaskOnServer` は**無変更**。**Server成功後のみlocal反映**・失敗はlocal維持＋**選択を維持**（再試行が容易）・**成功Taskのみ選択解除**。
- **逐次保存**：成功確定ごとに `saveTasks()`（中断されても成功分が残る）。**本描画（`renderTaskList` / `updateTaskBadge`）は完了後に1回だけ**。
- **確認**：localhost実機で**アーカイブ3件→復元3件（原状回復）／完全削除3件**（サーバー経路2＋local-only経路1）・進捗表示「アーカイブ処理中 0 / 3件」等・処理中の全ボタンdisable・失敗0時の全選択解除・件数/バッジ一致（86→83→86）・**console 0**・**dev-check 200/200/200**・インラインJS 2ブロック構文OK・本番配信コードがローカルと**完全一致**・Decision 064/065 非回帰。
- **非接触**：Server正本契約（`archivedAt` / `deletedIds`）／Task同期・backfill／並び順（Decision 065）／Home表示仕様（Decision 064）／Timeline・Notification・Task History・Approval・Output Draft・Case・Conversation・Message／Case系一括削除（`_clBulkDelete` / `_homeBulkDelete` は対象外・未変更）。
- **DB実測（2026-07-17 確認時点）**：生存tasks **253**／archived **167**／deletedIds **127**／cases 生存**2**・削除済**2**。※`deletedIds` は 125 → **127**（確認用テストTask 2件を作成・完全削除したため。既存Taskの喪失なし）。
- **残**：本番でのPC実機確認／**Task新規作成時の2重化（本Hotfixとは無関係の既存問題・別Known Issueとして次工程で原因調査）**。

---

## Task Sort Order（2026-07-17・本番反映済み・**PC/iPhone実機確認済み**・commit **bbfbc73**・tag **v1.01-phase54-task-sort-newest**）

Task一覧の並び順を **`createdAt` 降順（上が最新・下が過去）** で PC・iPhone 統一。**index.htmlのみ（+10・追加のみ）**（Decision 065）。

- **原因**：`renderTaskList()` に**ソートが存在せず** `tasks` 配列順をそのまま描画していた。配列追加が **自端末作成＝`tasks.unshift()`（先頭・7か所）／他端末作成の同期受信＝`syncTasksFromServer` の `tasks.push(mapped)`（末尾）** の2系統に分かれるため、**PCは上が最新／iPhoneは下が最新**と逆転していた（表示順が端末の操作履歴に依存）。
- **仕様**：`createdAt` 降順 ／ **同一 `createdAt` は `id` を第2キーで固定** ／ **archived一覧も同一ソート** ／ `updatedAt` は使用しない（状態変更で順序が動かないため）。
- **表示のみ変更**：**表示用 `filtered` のみ**を `.sort()`。**`tasks` 配列本体・`unshift`/`push`・同期・backfill・localStorage・DB は一切変更なし**（本番配信コードで `tasks.sort(` の出現 **0件** を確認）。
- **非接触**：Timeline／Notification／Task History（各自が独自ソート済み・`tasks` 配列に非依存）／Progress・バッジ・診断（件数のみで順序不使用）／server.js・lib・DB・API・SQL。
- **確認**：症状を再現した配列（PC想定＝新→古／iPhone想定＝古→新）から**同一の描画順へ統一**を実証／実データ253件で降順・同着id固定・**`tasks` 配列不変**を実証／dev-check 200/200/200・console 0・本番トップ200・インラインJS parse成功・**PC/iPhone実機確認済み**・**DB無変更**（cases 2/2/4・tasks 253/125・archived 70／テストTaskの作成・削除・アーカイブなし）。

---

## Task Home Overview（2026-07-17・本番反映済み・**PC/iPhone実機確認済み**・commit **5fe2b64**・tag **v1.01-phase54-task-home-overview**）

ホームで**全案件Taskを俯瞰表示**する仕様へ変更。**index.htmlのみ（+15/-5）**（Decision 064・Decision 054 の表示仕様を改定）。

- **背景**：PC作成TaskがiPhoneの案件画面には出るがホームでは「タスクはありません」・バッジ0。調査で **Task同期・DB保存は正常**、**Decision 054 の仕様どおり＝不具合ではない**と確定 → ユーザー判断で**表示ポリシーのみ改定**。
- **仕様**：**ホーム＝全案件Task＋`case_id=NULL` 横断Task** ／ **案件画面＝選択案件＋横断（他案件は非表示）** ／ **最新一覧・案件一覧＝横断のみ（現状維持）** ／ **Timeline・Notification・Task History は変更しない**。
- **表示集合の統一**：`_taskIsHomeView()` 新規（`currentMember === null` のときだけホーム判定）＋`_taskInCurrentView()` にホーム分岐＋**`renderTaskList()` のインライン重複判定を `_taskInCurrentView(t)` へ統一** → **一覧・Progress・バッジ・診断が同一可視集合**となり「バッジだけ全件＝件数不一致」を構造的に防止。
- ⚠️ **`renderTaskList()` は `_taskInCurrentView()` を呼ばず同判定を複製**していたため、同関数だけの変更では**一覧だけ0件のまま＝件数不一致**になるところだった。
- **保護（不変）**：**`_taskViewCaseId()`**（Timeline/History/Notification が共有）／`_historyVisibleInView()`／`_timelineEventVisibleInView()`／`updateTaskBadge()` 本体／Task同期・backfill・削除/アーカイブ同期／server.js・lib・DB・API・SQL。
- **確認**：ホーム=全件（A/B/横断）・案件A=A+横断（B非表示）・案件B=B+横断（A非表示）・最新一覧=横断のみ・**一覧/Progress/バッジ件数一致**・archived除外維持・**ホームでTimeline/Historyは横断のみを維持（非回帰）**・dev-check 200/200/200・console 0・**PC/iPhone実機確認済み**・**DB無変更**。

---

## Case Success Contract（2026-07-17・本番反映済み・commit **aed5f7d**・tag **v1.01-phase54-case-sync-contract**）

案件の作成・削除を「成功確認型」へ統一。**index.htmlのみ（+48/-11）**・server.js/lib/DB/API/SQL **無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 063）。

- **POST success contract**：`_postCaseOnce()` 追加＋`pushCaseToServer()` を async 契約化（`{ ok, status, reason }`＝`deleteCaseFromServer` と同形）。従来の `fetch(...).catch(() => {})` による**失敗の握り潰しを解消**。
- **data.ok validation**：サーバは Supabase 失敗時も **HTTP 200 + `{ ok:false }`** を返すため（P4）、成功判定を **`res.ok` かつ JSON解析成功 かつ `data.ok === true`** の3条件へ。JSON解析失敗は成功と見なさない。
- **retry**：5xx・通信失敗・`200+ok:false` のみ**最大1回だけ再送**（合計2回・**無限再試行禁止**）。**4xxは再送しない**。
- **notification**：**案件作成時の同期失敗のみ通知**（`createCase` → `{ notifyOnFail:true }`／`_notifyCasePushFailed`）。**`touchCase` 経由は通知しない**（毎メッセージ発火＝通知スパム防止）。
- **local protection**：**作成は成否に関わらず local案件を常に保持**（POST結果でユーザーの案件を消さない）。`createCase()` は**同期関数のまま**（await しない＝UIブロックなし）、`touchCase()` は**無変更**。
- **DELETE success contract（P5解消）**：`deleteCaseFromServer` が HTTP status のみで判定していたため、Supabase障害時に `200+ok:false` を成功と誤判定し「localから消えたのにDBは未削除→次回同期で復活」する穴があった。**404 を先に判定**（本文が `ok:false` のため）→ local-only として local削除可／それ以外は3条件のみ成功／**`200+ok:false`・5xx・通信失敗は失敗＝localを保持して既存通知**。
- **確認**：fetchスタブで localhost・本番とも全ケース合格（POST 200+ok:true=1回/通知0・200+ok:false=2回/通知1・**400=1回（再送なし）**・500=2回・通信失敗=2回・**touchCase経由=通知0**／DELETE 200+ok:true=成功・**200+ok:false=失敗でlocal残存**・404=成功・5xx/通信失敗=失敗でlocal残存）・**最大試行2回以内**・`node --check` 0エラー・**dev-check 200/200/200**・**console 0**・本番トップ200・旧 fire-and-forget／旧DELETE判定は**残存0件**。
- **データ保護**：**実DBへのテストデータ作成なし**・本番DB **生存1/削除済み2/合計3行**＝無変更・localStorage 復元一致。
- **効果**：一過性の通信断は自動再送で救済／恒久的失敗はユーザーが即座に認知／**local-only案件の再発防止**／P5解消。
- **残存項目（別工程）**：① Task側 PC⇔iPhone 実機確認／② Case同期契機の改善（現在は起動時1回のみ）／③ Phase55判断。

---

## 案件系Known Issue **Close**（2026-07-17・Case同期系Complete・本番反映済み・tag v1.01-phase54-known-issue-case-closed）

Phase54完了後にユーザー本番実機で顕在化した**案件（Case）系**Known Issueを恒久解決し、正式Close（時系列・新しい順）。**Phase54 Complete維持・Phase55未着手**。**Task同期系とは別工程**。

- **Case Known Issue Close**（本commit・`DEBUG_CASE_DIAG=false`＋docs更新）
  - 目的：案件系Known Issueの正式Close記録。変更：`index.html` の `DEBUG_CASE_DIAG` を `false`（本番の「🔍 診断」ボタン非表示）。**診断ロジック・変数・関数は削除せず温存**（再調査時 `true` で復活・PhaseD-1 の `DEBUG_TASK_SYNC` と同方式）。docs 5ファイル更新（01/02/04DECISIONS/06HANDOVER/CHANGELOG）＋**Decision 060/061/062**。
  - **実機実測（PC・iPhone双方で完全一致）**：**DB生存1／DB論理削除済み2（合計3行＝物理削除なし）／PC local 1／iPhone local 1＝DB生存 = PC = iPhone の三者一致／local-only 0／Review 0／Remove候補 0**。
  - **②-B-2 Backfill：対象なしのため未実装Close**／**②-C 残骸整理：対象なしのためClose**（Decision 062）。
- **Case diagnosis panel**（commit **7c7d6ff**・tag **v1.01-phase54-known-issue-case-diagnosis**・index.htmlのみ **+226**・読み取り専用）
  - 目的：各端末のlocal案件を DB状態（生存／削除済み／local-only）・推定区分（正常案件の可能性／不具合①由来の疑い／判定不能）・推奨アクション（Keep／Review／Remove候補）へ分類し、②-C判断材料を作る（C案・診断先行）。
  - 内容：`DEBUG_CASE_DIAG`／`diagnoseCases`／`_diagnoseOneCase`／`_diagAction`／`_diagSummary`／`_diagDevice`／`renderCaseDiagnosis`／`_diagCopyJson`／`_diagCopyFallback`＋ホーム一覧の「🔍 診断」ボタン。JSON schema `case-diagnosis/v1`（`msgCount`・signals・score 併記）。
  - **絶対条件を構造的に担保**：発行HTTPは **`GET /api/cases` 1本のみ**（POST/PATCH/DELETE **0件**）／**localStorage不変**／`syncCasesFromServer`・`mergeServerCases` 不使用（mutationのため）／**実行系ボタンなし**（コピーと閉じるのみ）／推定は「疑い」「可能性」と明示。
  - 確認：dev-check 200/200/200・console 0・本番トップ200・iPhone幅(390×844)で横スクロールなし・**PC・iPhone双方で実施済み**。
- **Case deletion sync**（commit **ad83544**・tag **v1.01-phase54-known-issue-case-delete-sync**・**4ファイル**）
  - 目的：PC⇔iPhoneで案件削除が伝播しない問題の恒久解決（原因＝物理DELETEでtombstoneが残らず、`mergeServerCases` が他端末の削除を知る手段が無かった）。
  - **SQL（ユーザー実行済み・非破壊）**：`ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;` ＋ `CREATE INDEX IF NOT EXISTS idx_cases_deleted_at ON cases (deleted_at);`（nullable・既存行NULL＝生存・移行なし）
  - 実装：`supabase/schema.sql`（`cases.deleted_at` 定義）／`lib/casesDb.js`（`getCases` 生存フィルタ＋**全件GET時のみ `deletedIds`**＋`total`・**`softDeleteCase` 新規**〔notFound／`alreadyDeleted` 冪等〕・物理 `deleteCase` は残置未配線・`upsertCase` 無変更＝**削除済み行は復活しない**）／`server.js`（`GET` に `deletedIds`/`total` 追加＝**`cases` 配列は形不変・後方互換**／`DELETE /api/cases/:id` を `softDeleteCase` へ委譲＝**404／200冪等・パス・IF不変**）／`index.html`（`mergeServerCases(serverCases, deletedIds)` で **deletedIds に明示されたidだけprune**＝「GET結果に無い＝削除」とは推論しない＝**local-only案件保護**／`deleteCaseFromServer` を成否契約へ／`_deleteCaseWithContract`・`_notifyCaseDeleteFailed` 新規／**削除4経路を同一契約へ統一**＝200・冪等200・**404=local削除可**／**5xx・通信失敗はlocal保持＋通知**・一括は順次でフラッド防止）。
  - **物理削除禁止**（可逆な論理削除）／**`messages`・`conversations`・`task_history`・Learning は非連動・非削除**。
  - 確認：dev-check 200/200/200・console 0・本番 `deletedIds`/`total` 返却・生存のみ返却・**合計3行＝物理削除なし**・DELETE 404・旧DELETE配線0件／**PC⇔iPhone双方向の削除伝播をユーザー実機確認済み**（Decision 061）。
- **Case auto-create stop**（commit **f36762c**・tag **v1.01-phase54-known-issue-case-auto-create**・**index.htmlのみ4行**）
  - 目的：既存案件で会話するたび新案件が増える不具合の停止。原因＝`handleLeaderDispatch()` @8081 が**無条件で `createCase(userText, assignedIds)`** を実行し、`createCase` の dedup が**送信本文基準**のため会話ターンごとに新案件を生成（`pushCaseToServer` でDBにも流出）。**`createCase` の呼出は全コードで2か所のみ**で増殖源を1つに特定・二重定義なし。
  - 変更：@8081 `_ncActiveCaseId('leader') || null`（**案件選択中は継続／未選択・最新一覧・案件一覧は `null`＝横断・自動生成しない**）／@8149 横断Taskタイトル `[横断]`（`[undefined]` 防止）／@10116 `saveCaseMemory` を `_ncActiveCaseId(_mid)` へ（**未選択時は保存しない＝先頭案件への誤保存防止**）／@10050 `touchCase` の先頭案件フォールバック停止（**横断時は既存案件の `updatedAt`・並び順・`pushCaseToServer` を発火させない**）。
  - **案件作成は「新規案件」操作のみ**（`createNewCaseFromForm`）。`createCase()` 本体・server.js/lib/DB/API/SQL は**無変更**（Decision 060）。
  - ⚠️ 当初の実機再現は**本番が旧コード配信のまま**（push未実施）だったことが `curl` 実測で確定。本番反映後に増殖停止を確認。
- **状態**：**Case同期系Complete**／**Phase54 Complete維持**／**Phase55未着手**。
- **残存項目（別工程・未着手）**：① `pushCaseToServer` の成功確認化（**作成側は現在も fire-and-forget**＝POST失敗時に local-only 案件が再発し得る）／② Phase54 Hotfix の **Task側** PC⇔iPhone 実機確認（未実施）／③ Case同期契機の追加（現在は起動時1回のみ＝他端末の削除反映に相手端末のF5が必要）。

---

## Phase54 Known Issue（PC⇔iPhone Task表示不一致）**Closed**（2026-07-16・archived/caseId Server正本化・本番反映済み）

Phase54完了後にユーザー実機で顕在化した Task同期 Known Issue（PC badge47/iPhone badge13）を、Task field merge の Server正本化で恒久解決（時系列・新しい順）。

- **PhaseD-1 診断表示 非表示化**（commit **a5bbe27**・tagなし）
  - 目的：原因解決後、診断表示を本番UIから隠す。変更：`DEBUG_TASK_SYNC=false` 追加・`renderTaskSyncDiag` 表示のみ抑制（診断ロジック/変数/関数/localStorage記録は削除せず温存）。検証：dev-check 200/200/200・console 0・診断非表示・view69/badge69維持・本番反映確認。
- **PhaseC-2 caseId Server正本化**（commit **6f0816a**・tag **v1.01-phase54-known-issue-c2**）
  - 目的：dbId一致Taskの caseId 端末温存を解消。変更：merge で `existing.caseId = mapped.caseId` を newer-wins非依存で常時採用（+3行・追加のみ）。local-only（dbなし）保護。検証：dev-check 200/200/200・console 0・PC view69/badge69維持・backfill POST 0・本番 total233/archived1/NULL70/deletedIds125。
- **PhaseC-1 archived Server正本化**（commit **0ed68e4**・tag **v1.01-phase54-known-issue-c1**）
  - 目的：iPhone localStorage の古い archived 52件（Server同期後も温存）を解消。変更：merge で archivedAt を Server正本化（newer-wins非依存・stale archived解除／rich status温存／status は archived⇄非archivedのみ・previousStatus等の新項目追加なし・+16行）。検証：dev-check 200/200/200・console 0・PC無回帰(view69)・un-archiveロジック実証・本番 archived1維持。
- **PhaseA-1 分布診断**（commit **76d0582**・tag **v1.01-phase54-known-issue-a1**）
  - 目的：233→13/69 の絞り込み箇所を数値確定。変更：診断に caseId/status/archived/deleted 分布を追加（観測のみ）。結果：excl[case163 arch1 done0]＝**caseId が支配的**と確定。
- **PhaseA-0 同期診断＋showApp同期**（commit **5f23cf1**・tag **v1.01-phase54-known-issue-a0**）
  - 目的：iPhoneでの同期停止段階を画面で可視化＋再ログイン時の同期ギャップ解消。変更：build marker・Task同期診断（HTTP/received/merge/save/render）・`showApp()`後のsync 1回保証（in-flight時1回再試行・backfill非呼出）。結果：iPhone recv233/complete＝同期は正常と確定（原因は表示側caseId/archived）。
- **原因（PhaseA-2で確定）**：Task field merge が単一 `updatedAt` の newer-wins だったため、archived/caseId が端末ローカル値で温存され PC⇔iPhone不一致。
- **最終確認（Closed）**：total233・archived1・todo232・NULL70・case163・**PC=iPhone view69/badge69**・件数減少なし・backfill POST増加なし・Render API正常・診断本番非表示。

---

## Phase54 Hotfix — Task同期/削除同期/アーカイブ同期/backfill安全化/Task生成上限20 **本番反映済み**（2026-07-14・Phase54完了後Known Issue対応・commit d512bad・tag v1.01-phase54-hotfix-task-sync）

- **位置づけ**：**Phase54 正式Complete 維持**（tag `v1.01-phase54-complete` 不変）・**Phase55 未着手 維持**。Phase54完了後にユーザー実機で顕在化した Task同期 Known Issue への Hotfix。
- **Known Issue**：Task削除がPC⇔iPhoneで同期されない／削除がF5・再ログイン・案件切替で復活／一覧・Progress・バッジの件数不一致／backfill重複。調査で **backfillによるTask急増（75→354）**・**Task生成10件制限** も判明。
- **実装（4ファイル・+404/-61）**：
  - **削除同期**：`tasks.deleted_at`（論理削除・**物理削除なし**）＋`PATCH {deleted:true}`／dbId限定 Server-Authoritative Reconciliation／local-only保護
  - **アーカイブ同期**：`tasks.archived_at`＋`PATCH {archived:true|false}`（復元可・PC⇔iPhone同期・**Task History/Learning温存**）
  - **backfill安全化（B案）**：server同期後1回・in-flight lock・dbIdなしのみ・deletedSignatures照合・archived除外・**local重複除外**・成功後即dbId反映・失敗再試行なし・**POST上限20超過で自動停止＋通知（フラッド防止）**
  - **件数統一**：一覧／Progress／バッジ＝現在案件＋NULL・deleted除外・archived除外の同一可視集合
  - **Task生成上限 10→20**（`/api/auto-task` `MAX_AUTO_TASKS=20`・無限ループ防止維持・**backfill上限とは別管理**）
- **本番DBデータ整理**：重複候補 **123件を JSON/CSV 退避 → id限定 `deleted_at` 論理削除**。**生存233件／deletedIds125件**。**元75件・正当候補156件は保護（全生存）**。検証 **arch-1=通常／arch-2=アーカイブ**。**正当候補156件の個別整理は未実施**。
- **Git/反映**：commit **d512bad**・tag **v1.01-phase54-hotfix-task-sync**・**HEAD=origin/main=tag=d512bad**・Render反映済み・本番確認済み。
- **退避/除外**：`backup-dup-candidates-20260714/`（123件JSON/CSV）は**ローカル退避・Git対象外**。**cost関連3ファイルは対象外・未操作**。
- **確認状況**：**実装済み**（4ファイル）／**localhost確認済み**（dev-check 200/200/200・console 0・削除/アーカイブ/冪等/404/400・件数一致・F5維持・フラッド防止）／**本番確認済み**（Render top200・GET total233/deletedIds125・archived_at・arch-1 NULL/arch-2 NOT NULL・21件→400・console 0）／**ユーザー実機確認：未実施**。

---

## Phase54 — Remaining Realtime Sync **正式Complete**（2026-07-14・最終統合確認合格・tag v1.01-phase54-complete）

- **Phase54全体**：3a Task Basic Sync → 3a-2 Task Case Scoping（tasks.case_id）→ 3b-1 Task History Persistence（task_history＋Hybrid）→ 3b-2 Task History Case Scoping → 3b-3 Notification既読永続化（notification_reads）＋Timeline案件別＋Workflow Live復元 → 最終統合確認 すべてComplete
- **成果＝Version1.1「PC⇔スマホ同一AI会社」の同期基盤成立**：Approval／Output Draft＋Review State／Task（案件分離）／Task History（DB永続＋案件分離）／Notification（既読PC⇔iPhone双方向同期）／Timeline（案件別）／Workflow Live（履歴フォールバック復元）
- **最終統合確認（localhost再起動直後＋本番）**：案件A/B分離（混入なし）・NULL/空横断データ維持・Approval/Draft/Review State案件別復元・Task60件維持（重複0）・履歴/既読DB復元（dup0）・PC⇔iPhone既読双方向同期（ユーザー実機）・F5/再ログイン維持・Messages復元・全consumer回帰なし・console 0・dev-check 200/200/200・本番全API正常
- **Known Issue（継続）**：Edge（Windows・表示倍率125%）Taskスクロールバー判定ずれ（軽微・UIリファイン時再調査）
- **次工程**：Phase55候補整理 または Version1.1残課題確認（Cost同期＝別工程／Learning残buffer＝Version2候補／回答本文のtask_history保存＝候補）。**Phase55未着手**

---

## Phase54-3b-3 — Notification既読永続化・Timeline案件別・Workflow Live復元 **Completed**（2026-07-14・push済み・Render反映済み・本番/ユーザー実機確認済み・commit 3e3c432・tag v1.01-phase54-3b-3）

- **3b-3a Notification既読DB永続化**：新規 `notification_reads`（`history_id` PK・`case_id`・`seen_at`・`created_at`＋index＋冪等RLS）／新規 `lib/notificationReadsDb.js`（`getSeenIds({caseId,limit})`／`markSeen`・`onConflict:history_id`+`ignoreDuplicates`＝冪等）／`GET/POST /api/notification-reads`（GET `?limit=` 既定1000/上限5000・`?caseId=`任意・DB失敗でも表示止めない）。client：`showApp`で既読復元→`_notifSeenIds`／click・markAllでDB保存（即時UI維持）。**単一共有アカウント(web-user)＝PC/iPhone間既読同期基盤完成・回答本文復元は対象外**
- **3b-3b Timeline案件別表示**：`_timelineEventVisibleInView`＋`renderTimeline`（wfId空/NULL=横断常時表示・case付きは現在案件のみ・ホーム/未選択は横断のみ）。**NULL/空event横断表示維持**
- **3b-3c Workflow Live復元**：`wlProgressPoll` found:true＝既存Live優先／found:false時のみ`_wlRestoreFromHistory`でtask_historyから静的復元（担当/action/status/caseId/開始・完了時刻・**本文対象外**）
- **保護**：既存APIレスポンス形不変（`{ok,history,total}`／`{ok,workflows,total}`／新規`{ok,seenIds,total}`）・task_history Hybrid/dedup維持・3b-2案件分離非接触・`global.__taskHistory`維持・新規SQL(notification_readsのみ)以外のDB変更なし・Approval/Output Draft/Provider/Routing/Cost 非接触
- **実DB確認**：既読POST/GET・冪等(重複0)・limit・空POST400・`_notifSeenIds`復元／Timeline A/B分離＋横断維持／Live復元(本文空)／既存consumer回帰なし／console 0／dev-check 200/200/200
- **本番・実機確認（Completed）**：push→Render反映→本番API確認（GET/POST/limit/冪等・重複0・形不変）→**ユーザー実機確認済み（PC→iPhone／iPhone→PC 通知既読同期・F5/再ログイン後も既読維持・表示操作正常）**

---

## Phase54-3b-2 — Task History Case Scoping **Completed**（案件別履歴分離完成・2026-07-14・push済み・Render反映済み・本番/ユーザー実機確認済み・commit b5ab89d・tag v1.01-phase54-3b-2・origin/main=3a95691）

- **目的**：Task History を案件単位で保存・取得・表示分離（案件A履歴が案件Bに出ない・NULL横断は両案件表示）。Phase54-3b-1（永続化基盤）は Completed
- **client（index.html）**：`/api/auto-task`・`/api/consult` POST に `caseId: getCurrentApprovalCaseId() || null` 送信／`_historyVisibleInView`（NULL横断常時表示・case付きは現在案件のみ）＋`renderNotifications` に案件別表示フィルタ
- **server（server.js）**：auto-task・consult で `caseId` 受領→生成履歴各行へ保存（`h.caseId==null`のときのみ＝既存値尊重）／`_hybridTaskHistory` 任意caseIdフィルタ／GET `/api/task-history`・`/api/workflow-dashboard` に任意 `?caseId=`
- **仕様**：**引数なしGET＝全件**（クライアント全保持・Hybrid/dedup維持）／`?caseId=X`＝該当案件のみ厳密（NULL含まず）／NULL横断はクライアント表示側で担保＝案件画面＝該当案件＋NULL横断・ホーム/未選択＝NULL横断のみ
- **保護**：既存APIレスポンス形不変（`{ok,history,total}`／`{ok,workflows,total}`）・3b-1 Hybrid/dedup維持・`global.__taskHistory`維持・Learning据え置き・Workflow Live(aiLivePoll workflowId scoped)大幅変更なし・**新規SQL/DB構造変更なし**・Approval/Output Draft/tasks.case_id/Provider/Routing/Cost 非接触
- **確認（commit b5ab89d）**：consult(caseId)保存／**Auto Task実ワークフロー1回（案件A・実AI）＝生成6行全て case_id=A・history_id重複0・GET`?caseId=A`6件/`?caseId=B`0件・NULL横断存続・Notification実描画A=6/B=0・workflow-dashboard形不変＋caseIdフィルタ**／再起動後case_id維持・既存consumer回帰なし・console 0・dev-check 200/200/200
- **本番反映・確認（Completed）**：push `6d1f5b6..3a95691`（cost非混入）→ Render自動デプロイ反映（本番`?caseId=`フィルタ動作＝新コード稼働）→ 本番API確認（レスポンス形不変・caseId付き履歴DB取得・重複0・console 0）→ **ユーザー実機確認済み（案件A専用履歴が他案件へ混入しない）**・F5/再ログイン/再起動後もDB永続・NULL横断維持・Notification案件分離・Workflow Live/Timeline回帰なし。次工程＝**Phase54-3b-3**（Timeline案件別最終確認／Notification未読永続化／Workflow Live Restore・未着手）

---

## Phase54-3b-1 — Task History Persistence **Completed**（永続化基盤・2026-07-14・push済み・Render反映済み・本番API確認済み・Render再デプロイ後DB復元確認済み・commit 2e4b0fc・tag v1.01-phase54-3b-1）

- **目的**：`global.__taskHistory`（サーバーメモリ・非DB・**Render再起動で消失**）を新規 `task_history` テーブルへ永続化＝Timeline/Notification/Workflow Live/Auto Task/Live Status の再起動復元基盤。**今回は永続化基盤のみ（case_id配線・UI変更は3b-2以降）**
- **SQL実行済み（ユーザー）**：`CREATE TABLE task_history`（`history_id TEXT NOT NULL UNIQUE`／`workflow_id`／`case_id TEXT`(nullable/FKなし)／`from_agent`/`to_agent`/`task_id`(FKなし)／`action`/`instruction`/`type`/`note`／`status TEXT`(**CHECKなし**)／`meta JSONB`／`requested_at`/`completed_at`/`created_at`）＋3 index＋冪等RLS
- **変更（commit 2e4b0fc・3ファイル・+195/-8）**：`supabase/schema.sql`（task_history正式定義）／`lib/taskHistoryDb.js`（新規：upsertHistoryEntry/upsertHistoryEntries/getHistory・`history_id` 冪等upsert・meta退避復元）／`server.js`（`_persistTaskHistory` fire-and-forget＋`_hybridTaskHistory` メモリ＋DB dedup・メモリlive優先＋push時DB保存＋GET 2本Hybrid化）
- **既存APIレスポンス形 不変**：`{ok,history,total}`／`{ok,workflows,total}`・from/to filter維持・新規エンドポイントなし・既存API削除/置換なし
- **保護**：`global.__taskHistory` 維持／status改善せず(CHECKなし)／case_idは本工程常にNULL(横断・配線は3b-2)／**DB保存失敗でWorkflow停止しない**／polling/WebSocket追加なし／Approval・Output Draft・tasks.case_id・Workflow・Provider・Routing 非接触
- **実DB確認**：round-trip＋meta復元／`history_id` 冪等upsert(重複行0)／Hybrid(memory+DB) dedup(appearCount=1・live優先)／**サーバー再起動2回後もDB復元**(2件・dupInGet 0)／DB未作成でもgraceful／既存consumer回帰なし／console 0／dev-check 200/200/200
- **本番反映・確認（Completed）**：push `47d7417..6d1f5b6`（cost非混入）→ Render自動デプロイ反映（新Hybridコード稼働＝本番GETがDB履歴返却）→ 本番API確認（task-history/workflow-dashboard 200・レスポンス形不変・DB履歴取得・重複0・console 0）→ **Render再デプロイ後の新規インスタンス（メモリ空）もDB履歴復元**。次工程＝**Phase54-3b-2（case_id client配線・案件別履歴）**

---

## Phase54-3a-2 — Task Case Scoping **Completed**（案件別Task分離完成・A案・2026-07-13・push済み・Render反映済み・本番PC確認済み・ユーザー実機確認済み・commit bc98455・tag v1.01-phase54-3a-2）

- **採用＝A案（Decision 054）**：`tasks` へ **nullable `case_id TEXT`（FKなし・既存行NULL維持）**。`messages.case_id`（Phase52-12.2）踏襲・追加のみ・非破壊。**Task Case Scoping 完成＝案件別Task分離完成・NULL横断Task維持・既存Task非破壊**
- **SQL実行済み（ユーザー）**：`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS case_id TEXT;` ＋ `CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON tasks (case_id);`
- **表示仕様**：案件画面＝該当案件Task＋`case_id=NULL`横断Task／ホーム・未選択＝`case_id=NULL`横断Taskのみ。**既存55件はNULL温存・非表示/強制分類なし**
- **変更（commit bc98455・4ファイル・+72/-20）**：`supabase/schema.sql`（case_id定義＋ALTER/index冪等コメント）／`lib/tasksDb.js`（createTask caseId非null時のみ列送信・getTasks任意caseIdフィルタ）／`server.js`（POST caseId受領・GET任意caseId・**既定全件維持**）／`index.html`（caseId送信/map/merge・`_ensureTaskCaseId`/`_taskViewCaseId`・全作成経路配線・`renderTaskList`案件別フィルタ・switchCase/_homeOpenCase/goHome再描画フック）
- **保護**：**`_taskSignature`不変**（backfill重複防止）／GET既定全件（backfill契約）／既存local-only TaskへcaseId強制付与なし／status CHECK非対象／Approval・Output Draft・Review State・Conversation・Messages・Workflow・Timeline・Notification・Learning・Cost・Phase53 非接触
- **localhost確認**：case_id実在・caseId付き/NULL保存・GET全件/フィルタ・案件A/B分離（実DOM）・NULL横断（既存55件全view）・F5維持・**実ログアウト→再ログイン→分離（実DOM）**・backfill重複0・dbId重複0・既存55件減少0・DB60件（テスト5件）・console 0・dev-check 200/200/200
- **本番反映・確認（Completed）**：push `a71ca79..4372576`（fast-forward・cost非混入）→ Render自動デプロイ反映（新server.js GET`?caseId=`サーバーフィルタ稼働・新index.html新関数稼働・GET正常・エラーなし・Render設定/環境変数変更なし）→ **本番PC確認済み**（案件A/B分離・NULL横断・F5・再ログイン維持・重複なし・既存減少なし・console 0）→ **ユーザー実機確認済み**
- **Known Issue（従来どおり維持）**：Edge（Windows・表示倍率125%）Taskスクロールバー判定ずれ（軽微・UIリファイン時再調査）
- **次工程**：**Phase54-3b Task History Persistence**（`task_history` DB化・推奨=案A：`task_history`自身にnullable case_id保持・詳細Live Statusはここ・要SQL・未着手）

---

## Phase54-3 — Remaining Realtime Sync 正式化／Phase54-3a **Completed（Known Issueあり）**（2026-07-13・push済み・Render反映済み・本番実機確認済み・tag v1.01-phase54-3a）

- **Phase54-3a Completed（Known Issueあり）**：origin/main=82674b9。Task Basic Sync（dc439d5）＋3a-fix Task完全収束（e96bdaa）＋UI-A Task操作性（4e56b44/ddc1c81/af4ab80/82674b9）。**PC/iPhone 55件一致・本番実機確認済み**
  - **3a-fix**：全Task作成経路をPOST配線（`_persistNewTask`）＋起動時 `backfillLocalOnlyTasks`（ローカルのみTaskを削除せずサーバーへ押上げ・冪等・`_taskSignature`で重複防止・POST成功後のみdbId付与）
  - **UI-A**：選択ツールバー`N件選択中`＋短縮ボタン・**標準ネイティブスクロールバー一本化**（`scrollbar-width:auto`＋`scrollbar-color`・webkit擬似要素撤去＝見た目=ヒット判定統一）。index.htmlのみ・CSS中心
  - **⚠ Known Issue（修正継続しない）**：Edge（Windows・表示倍率125%）でTaskスクロールバーのヒット判定が見た目より数px左へずれる場合あり。ホイール/タッチパッド2本指/キーボード/Task操作/iPhone は正常。影響軽微のためVersion1.1優先・UIリファイン時に再調査
- **Phase54-3正式化（Decision 053）**：実開発Phase54系＝Version1.1 Realtime Sync系。ROADMAP旧Phase54は旧計画として履歴保持・Version2再採番。分割＝3a Task Basic Sync（**Completed**）／3a-2 Task Case Scoping（`tasks.case_id`）／3b Task History Persistence（詳細Live Statusはここ）／3c Notification Unread・Workflow Live Restore／3d 最終確認。Cost＝別工程・Learning残＝Version2候補。**3a-2/3b/3c/3d未着手**
- **Phase54-3a Task Basic Sync**：既存 `GET /api/tasks`（DB由来）をクライアントが起動時・案件切替時・ホーム案件を開いた時に pull・merge。**index.htmlのみ・DB/API/SQL変更なし・新規pollingなし**
  - 追加：`syncTasksFromServer`/`_taskFromServerRow`/`_mapServerTaskStatus`＋`_taskSyncInFlight`ガード
  - merge安全規則：dbId重複排除／未存在のみ追加／サーバー `updated_at` 厳密新しい時のみ採用／localのみTask保持／失敗・空で削除しない／localStorageキャッシュ維持
  - 既知制約：client status(10種) vs server CHECK(3種)不一致。rich statusのPATCH失敗で `updated_at` 不進行のため pull時に降格しない（rich status保護）。双方向status統一は3b以降
  - 確認：起動pullで22件merge・dedup・空/失敗維持・in-flightガード(GET1回)・newer-wins＋rich status保護・F5復元・回帰OK・console0・dev-check 200/200/200
  - 非接触：Approval系/output_drafts/review_state/Conversation・Case・Messages/Workflow Live/Notification/Cost/Learning・server.js/lib/DB/API/schema

---

## Phase54-2 — Output Draft Persistence **Complete**（Output Draトのサーバ永続化＝リロード復元・案件切替復元・Mobile Review状態永続化・B案・2b/2c/2d/2f・2026-07-12・push済み・Render反映済み・本番確認済み）

- Commit: **6dec27d**(2b `add output draft persistence API`)／**5eec84b**(2c `save output drafts`)／**7589f4f**(2d `restore output drafts`)／**f0f382f**(2f `persist mobile review state`)／各docs commit＋Tag **v1.01-phase54-2d**・**v1.01-phase54-2f**（→ f0f382f）／**origin/main = f0f382f・push済み**
- DB: `output_drafts`（output_id PK・case_id NOT NULL・FKなし・非破壊）＋`review_state JSONB`(2f) 作成済み
- **Phase54-2f Mobile Review State Persistence**: スライド別レビュー状態（`statusBySlide`/`commentsBySlide`/`revisionTargetBySlide`/`approved`＝「OK x/10」）を `output_drafts.review_state` へ成果物単位で保存・復元。**output_approvals・Approval Sync・Phase54-1f/1g・Publishing Ready・Mobile Approval 非接触**。保存: OK/修正/対象/approved=即時・コメント=デバウンス400ms・独立POST
- **本番実機確認（ユーザー通常ブラウザ）**: OK x/10保持・コメント/修正依頼/修正担当保持・F5復元・案件切替・別案件混入なし・元案件復元・Mobile Approval/Publishing Ready回帰なし・Approval Sync正常・console 0
- 変更範囲: **2b=`lib/outputDraftsDb.js`新規＋`server.js`＋`supabase/schema.sql`／2c・2d=`index.html`のみ**（**Phase54-1f/1g・Approval Sync GET・`mergeApprovalStateFromServer`・Approval POST Queue・Phase53・cost系 非接触**・課金なし）

### 目的
- メモリのみだった Output Draット をサーバ(`output_drafts`)へ永続化し **リロード後の成果物復元／案件別最新Draト復元** を実現。`output_id` を承認(output_approvals)との共通キーにして整合（**完全な複数履歴ではない＝最新1件**）。

### 内容
- **2b**: `outputDraftsDb`(upsert/get)＋`GET/POST /api/output-drafts`＋schema（index2本・RLS冪等）。実DB round-trip・400・回帰OK
- **2c**: `buildOutputDraftFromLeaderFinal` 完成後に `pushOutputDraftToServer`（本文＋メタのみ・fire-and-forget・outputId/caseId/fields揃う時のみ）
- **2d**: 起動/switchCase/_homeOpenCase で `scheduleOutputDraftRestore`→保存済 output_id のまま復元→既存Approval Sync承認復元。未マークWorkflow Draト保護／Draトなし案件は前案件表示クリア(fix1)／高速連続切替で最新要求再実行(fix2)

### 確認（localhost・実ワークフロー1回＋実DB）
- 完成Draト保存（`out_1783814527200`/`case-mrgfnfgutvtb`・200・承認POST 0）→ F5後復元・ID一致・Approval GETが同 output_id・復元中POST 0／案件別最新復元／Draトなし案件で前案件クリア（POST 0）／高速連続切替で最終案件即時復元・stale不採用／Output Engine・Mobile三種 回帰OK・コンソールエラー0・dev-check 200/200/200
- **本番実機確認は未実施（次段）**。検証行は非活性・DELETE未実施。polling/複数履歴UI/PC⇔スマホ能動再取得は Phase54-2e候補（対象外）

### 温存
- cost系3ファイル＝未commit温存（Phase54-2非接触・stageに含めず）

---

## Phase54-1g — Approval POST Ordering / Last Action Wins **Complete**（Approval POST直列化＋対象別Last Action Wins・着順逆転防止・2026-07-11・push済み・Render反映済み・本番確認済み）

- Commit: **d6a6905**（`Phase54-1g enforce last action wins`）／docs commit: **2bb5a86**（`Phase54-1g update documentation`）＋Complete確定docs／Tag: **v1.01-phase54-1g**（→ d6a6905）／**origin/main = d6a6905・push済み**
- 本番: **Render反映済み**（`ai-company-l45x.onrender.com` = d6a6905・`_runApprovalPostQueue` 反映確認）。**本番実機確認完了**（Last Action Wins・UI最終状態=DB最終状態）
- 変更範囲: **index.html のみ（+89/-7・追加のみ・`pushApprovalToServer` 内部の直列キュー化）**（**server.js / lib / DB / API / Approval Sync(GET) / output_id判定 / Phase53 / Phase54-1d・1e・1f / cost系 非接触**・課金なし）

### 目的
- Approval POST の fire-and-forget 着順逆転（同一成果物へ approve→reject→cancel を高速連続 → POST到着順逆転でローカル最終とDB最終が不一致）を解消し **Last Action Wins** を保証。Phase54-1c由来の残課題（Phase54-1f起因ではない）を恒久解決。**Approval Sync(GET)の仕様変更ではない**。

### 内容（追加のみ・`pushApprovalToServer` 内部限定）
- グローバル直列 runner `_runApprovalPostQueue`（1件ずつ `await`・多重起動ガード）／対象別 pending `targetKey=caseId::outputId` 最新のみ保持（同一対象supersede＝Last Action Wins／別対象個別保持）＝`_approvalPostPendingByTarget`(Map)＋`_approvalPostTargetOrder`(配列)／payload凍結／成功条件 `response.ok`（4xx/5xx/例外=失敗）／最大1回再送・新操作優先（stale再送しない）・失敗継続／outputId無しはPOSTしない／外部IF維持・非ブロック（戻り値undefined）

### 確認
- 合成（スタブ・実POST 0・課金なし）: Queue動作 / LAW（approve→reject→cancel → `[approve, cancel]`）/ 対象別保持 / 失敗→最大1回再送 / 新操作優先 / outputId無しPOST禁止 / 回帰・コンソールエラー0
- localhost実機（実POST・実Supabase・透過ロガー・AI生成なし）: approve→reject→cancel → 実POST 2回のみ（中間reject supersede）・UI最終=cancel(null)＝DB最終null 一致／reject→cancel は `[rejected:200, null:200]`（着順保持）DB最終null 一致／別案件混入なし・output_id不一致=復元なし（1f保護健在）・回帰OK / dev-check 200/200/200
- **本番実機（Render `ai-company-l45x.onrender.com`・実POST・実Supabase・本番POST 6件・手動curl 0）**: approve→reject→cancel → 実POST 2件 `[null:200, null:200]`（中間reject supersede）・UI最終=cancel(null)＝DB最終null 一致・pending残留0／reject→cancel `[rejected:200, null:200]`（着順保持）DB最終null 一致／別案件混入なし・output_id不一致=復元なし（Phase54-1f保護維持）／Approval Sync GET回帰なし・非ブロック・コンソールエラー0
- 実機検証テスト行（DB `output_approvals`・通常UI POST経由・最小・DELETE未実施）: localhost `case-1g-rm-*`／`case-1g-B-*`／`case-1g-C-*`・本番 `case-1g-prod-A/B/C-*`（手動curl 0回・非活性）

### 温存
- cost系3ファイル（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝未commit温存（Phase54-1g非接触・stageに含めず）

### 次Phase候補（ユーザー判断待ち）
- Output Draft Persistence（Draft永続化＝リロード復元・PC/スマホ共有・複数成果物Approval履歴の前提）

---

## Phase54-1f — Approval Output Binding / Leakage Prevention（Approval行へoutput_id紐付け・別成果物への誤復元防止・2026-07-11・commit済み・push未実施）

- Commit: **9fd25a0**（`Phase54-1f bind approvals to output`）／Tag: **v1.01-phase54-1f**（コードcommitを指す）／**HEAD = 9fd25a0・origin/main = 4c0ef2c・未Push 1**
- 本番: **未反映（push前・Render未反映）**。実機確認完了 / dev-check 200/200/200 / node --check 0エラー / コンソールエラー0
- 変更ファイル: **`index.html` / `lib/approvalsDb.js` / `server.js` / `supabase/schema.sql`（4ファイル）**（追加のみ・+63/-11・**Phase54-1c同期は一致判定1つ追加以外は非変更 / Phase54-1d・1e非変更 / Phase53非接触 / cost系非接触 / 課金なし**）
- DB: ユーザーが `ALTER TABLE output_approvals ADD COLUMN IF NOT EXISTS output_id TEXT;` 実行済み（nullable・PK変更なし・移行なし・非破壊）。ClaudeはDDL未実行

### 正式目的
- 最新の案件Approval行（case_id PRIMARY KEY・1案件1行維持）へ `output_id` を紐付け、現在成果物と一致する場合だけ復元＝別成果物への誤復元防止。**完全な複数成果物履歴保存ではない**。Phase54-1eのリセットと連携し新成果物を未承認に保つ。

### 内容（追加のみ）
- lib: `upsertApproval(outputId任意)` / `getApproval(caseId, outputId任意)`（onConflict:case_id維持）／server.js: GET/POSTに任意 `outputId`（新規エンドポイントなし・レスポンス不変）／index.html: `getCurrentApprovalOutputId()`＋payload `outputId`＋GET URL `&outputId=`＋`mergeApprovalStateFromServer` に output_id一致判定（不一致・NULL・Draftなしは復元しない）／schema.sql: `output_approvals` 定義追記（drift解消）

### 確認
- 実機（実ワークフロー2回＋実UI＋DB読み取り）: 新成果物未承認・POSTへoutputId・DB保存・draft.id一致・同一成果物内で承認維持・同一案件の別成果物へ混入なし・案件間混入なし・NULL行復元しない・回帰OK・コンソールエラー0 / dev-check 200/200/200
- 未確認・対象外: Workflow Live本文描画／認証無効環境ログイン／リロード後復元／PC⇔スマホ同一Draft共有

### 残課題／別Phase候補
- 残課題: Output Draft未永続／複数成果物Approval履歴なし／`getCurrentApprovalCaseId()` dead fallback／Approval POST着順逆転（Phase54-1f起因ではない）／孤立Approval行（`case-mrf0d8vobb3y`/`out_1783695572489`/rejected・非活性・許容）
- 別Phase候補: Output Draft Persistence ／ Approval POST Ordering / Last Action Wins

### 温存
- cost系3ファイル（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝未commit温存（Phase54-1f非接触・stageに含めず）

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
