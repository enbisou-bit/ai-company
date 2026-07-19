# 06HANDOVER_NEXT_CHAT.md

# ENBISOU AI COMPANY - 次チャット引き継ぎ書

更新日: 2026-07-17（**Phase54 正式Complete維持**・**改善案件 工程A（設定保持）完了**（Auto Task／自律相談を端末内localStorage保持・**autoStart復元は設定と表示のみ＝起動時のWorkflow・AI自動実行なし**・端末間同期は非対象）・**localhost確認済み**。HEAD=origin/main=**8c9ed58**（本docs更新commitが以降の最新HEAD）・最新code tag=**v1.01-phase54-agent-settings-persistence**。**Phase55未着手・工程B以降は未着手**・**前工程Hotfixの本番実機確認は保留**。以前：**Task新規作成 二重化 Hotfix 完了**（`submitTask()` の dbId 誤代入／`atCreateNextTasksFromItems()` の dbId 握り潰しを修正・全7作成経路を統一）・**localhost確認済み**・**本番反映済み**。HEAD=origin/main=**39b44d0**（本docs更新commitが以降の最新HEAD）・最新code tag=**v1.01-phase54-task-create-dbid**。先行して Task一括操作 Hotfix（同時5並列化）／Taskホーム表示改善／Task並び順統一／Case同期 Complete／Case Known Issue Complete／Case成功確認契約 完了。**Phase55未着手**・次工程はユーザー承認後に決定）

---

## 【現在地・最優先】社員向上B 工程B-1 — outputType正本化 **完了**（2026-07-20・localhost確認済み）

- **現在Version**：**Version1 Final Complete ／ Version1.1 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**／改善案件 **工程B-1 完了・工程B-2 未着手**
- **Git**：最新Code commit **066241f**（`Normalize output type boundaries`・index.htmlのみ +40/-7）／最新tag **v1.01-phase54-output-type-normalization**（→066241f）／Docs commit（本更新）／**main push＋当該tag push実施 → HEAD = origin/main**。
- **B-1内容**：`OUTPUT_TYPES`(13種)＝定義正本／`_lastOutputDraft.type`＝ランタイム正本／`output_drafts.type`＝永続化正本／`OUTPUT_TYPE_DEFINITIONS`＝表示定義正本／`outputType`＝派生値。`normalizeOutputType()` 追加（legacy alias 9件・空/null/undefined/unknown/未知→`document`・曖昧語は非alias）。境界（生成起点・createOutputDraft入口・DB復元・normalizeOutputDraft・保存Payload・Output Engine表示）で正規化。**server.js/lib/DB/API/schema.sql 無変更**。
- **確認**：dev-check 200/200/200・console 0・正規化 24/24 PASS・13種自己返却OK・非回帰・**AI API実行なし**。
- **本番反映状況**：main/tag push → Render反映確認 → 本番 非課金確認（HTTP200・console 0・配信コードに `normalizeOutputType`/`OUTPUT_TYPE_LEGACY_ALIASES` 存在・Output Engine/Draft/Preview/Publishing 非回帰・AI系POST 0件）。※本番の**書込みを伴う実機確認は行わない**。
- **保護対象（未commit）**：cost-logs.json・claude-cost-logs.json・claude-quality-history.json・backup-dup-candidates-20260714/。
- **Cost DB 後続完了（最新状態）**：main push完了・tag push完了・Render反映確認済み・本番API確認済み（`/api/cost`・`?provider=claude`・`?provider=all` 全HTTP200）。下記Cost DB節の「push未実施」は**過去履歴**。

### 次工程（未着手）
- **社員向上B 工程B-2「セクション動的化＋内部指示分離」の調査**（B-2はまだ開始しない）。
- `genre === outputType` 結合の後続判断（B-2以降）。

---

## 【現在地・最優先】Cost DB 完了 — Opening Balance／一意性／23505／schema.sql記録（2026-07-19・commit 81a5288・tag v1.01-phase54-cost-db-complete・**push未実施**）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **Cost DB 実装・実DB・schema記録 完了**：
  - Opening Balance＝OpenAI **54.05円**（id=1）／Claude **319.57円**（id=4）・active2件・**grand_total 373.66円**。
  - 業務一意性 `(provider, balance_type) WHERE is_active`（`uq_api_cost_ob_active_provider_type`）／技術的冪等 `source_fingerprint` UNIQUE。**旧 `uq_api_cost_ob_active_legacy` 廃止**。
  - `ensureOpeningBalance()` **23505 二段階判定**（`OPENING_BALANCE_ACTIVE_CONFLICT`）。stub全PASS・dev-check 200/200/200・実DB非接触・**冪等再実行 existing 確認済み**。
  - `supabase/schema.sql` へ Cost DB 全定義を **+181 純追記**（定義記録用・migrationではない・既存本番DBへの差分適用に使用しない）。
- **Git 現在地**：Code commit **81a5288**（`lib/costDb.js`＋`supabase/schema.sql`）・tag **v1.01-phase54-cost-db-complete**。本docs更新が Docs commit。**push未実施**（未push＝既存7 ＋ code ＋ docs）。
- **対象外・保護（未commit）**：`cost-logs.json`（ランタイム書込）・`claude-cost-logs.json`・`claude-quality-history.json`・`backup-dup-candidates-20260714/`。**stage/commitしない**。
- **次工程**：push 承認 → main/tag push → Render デプロイ確認 → `/api/cost` read-only 疎通 → 整合確認。**実DB構造は適用済み・schema.sql は本番を自動変更しない**。

---

## 【現在地・最優先】改善案件 工程A — 設定保持 **完了**（2026-07-17・**localhost確認済み**・本番確認は残）

- **現在Version**：**Version1 Final Complete ／ Version1.1 開発中**
- **現在Phase**：**Phase54 Complete維持**／**Phase55 未着手**／**工程B以降 未着手**
- **Git**：**HEAD = origin/main = `8c9ed58`**（本docs更新commitが以降の最新HEAD）。**最新code tag = `v1.01-phase54-agent-settings-persistence`**（annotated）。
- **内容**：Auto Task（`autoStart`）／自律相談（`autonomousConsult`）の選択状態を **localStorage で端末内保持**。**index.htmlのみ（+45/-7）**・server.js/lib/DB/API/SQL **無変更**。
  - **キー**：`enbisou_auto_start_v1` / `enbisou_autonomous_consult_v1`（既存 `enbisou_*_v1` 規則に準拠）
  - **保存**：各トグル直後 ／ **復元**：`restoreAgentSettings()` を `showApp()` 冒頭から（初回ロード・再ログインの両経路を通る唯一の入口）
  - **フォールバック**：保存値なし・不正値は**既存初期値 `false`**（localStorage不可でも起動を止めない）
  - **UI同期**：復元時に `updateAutoStartBtn()` / `updateAutonomousConsultBtn()` で**内部値と表示を一致**
- **【課金防止の維持（最重要）】**：**復元は設定値と表示のみ＝起動時に Workflow・AI・API を自動実行しない**。`autoStart` を消費するのは `atAutoStartWorkflow()` のみで、呼び出し元は `handleLeaderDispatch` 内3箇所（ユーザーがLeaderへ依頼した後）のみ。**起動経路からの呼び出しなし**。`if (!autoStart) return;` / `autoStart && !billingLock` ガードも健在。
  - ※ 永続化がなかったのは**実装漏れではなく「課金防止システム」節の意図的設計**（旧コメント：`localStorageには保存しない（起動毎にリセット）`）。**方針変更としてユーザー承認済み**。
- **確認（localhost）**：自動/手動・ON/OFF とも F5 で維持／案件切替・ホーム移動・**ログアウト→再ログイン**でも維持（再ログイン前に内部値を意図的に `false` へ落として復元を実証）／**起動時リクエストは全てGET・AI実行系POST 0件**・`_atCurrentWorkflowId` は `null`／**console 0**／**dev-check 200/200/200**。
- **非対象**：**端末間同期**（DB列がなくSQL変更が必要＝別途判断）／Auto Task・自律相談の処理内容／**工程B以降**。

### 次工程（ユーザー承認後に決定・未着手）
1. **工程A 本番確認** — **設定保持のみ**（自動→F5維持／ON→F5維持／再ログイン維持／起動時にWorkflowが始まらない・AI系POST 0件・console 0）。**Leader依頼・AI生成・Task生成は行わない＝課金APIテスト禁止**
2. **【保留】前工程（Task作成dbId Hotfix）の本番実機確認** — 未実施のまま（Task 1件作成→dbId→リロード後1件→アーカイブ）
3. **工程B以降**（未着手）— B-1 outputType正本化／B-2 セクション動的化＋内部指示分離／B-3 JSON構造化 → C slides/caption分離 → D Designer Prompt → E 品質判定 → F Leader要約 → G 並列化 → H Learning・Compare（要追加調査）
4. **既存重複データの整理判断（未整理）** — 本番DBに重複署名16グループ・余剰16行

---

## 【参考・完了済み】Task新規作成 二重化 Hotfix — **完了**（2026-07-17・本番反映済み・**localhost確認済み**）

- **現在Version**：Version1 Final Complete ／ Version1.1 Connected AI Company 開発中
- **現在Phase**：**Phase54 Complete維持**／**Phase55 未着手**
- **Git**：**HEAD = origin/main = `39b44d0`**（本docs更新commitが以降の最新HEAD）。**最新code tag = `v1.01-phase54-task-create-dbid`**。
- **内容**：Task新規作成時の **`dbId` 取り込み失敗＝二重表示**を解消（A案）。**index.htmlのみ（+15/-9）**・server.js/lib/DB/API/SQL **無変更**。
  - **原因（クライアント単独。サーバー・API・DBは正常）**：POST は成功し `{ ok:true, task:{id} }` を返しているのに dbId を取り込めず local-only 化 → merge の照合キーが **`dbId` のみ**のため、リロード時にサーバーコピーが別途 push され**二重表示**。backfill の署名照合は起動順（`sync`→`backfill`）により**採用できず自動解消しない**。
  - **① `submitTask()`**：非同期コールバック内で**配列先頭を再評価**（POST往復 約0.9秒の間に先頭が入れ替わると dbId が別Taskへ）＝**条件付き**。→ **捕捉変数**＋`_persistNewTask()` へ統一。
  - **② `atCreateNextTasksFromItems()`**：POST 投げっぱなしで**dbId を常に破棄**＝**常時発生**。**Decision 063 と同型**。→ `_persistNewTask()` へ統一。
  - **結果**：**全7作成経路が安全な方式に統一**（`_persistNewTask` ×5／`.then` 捕捉変数 ×2）。
- **確認**：fetchスタブ（実DB非接触）で連続作成の全Taskが**自分自身の dbId** を取得（**解決順逆転でも誤代入0**）・自動次Task 3件とも dbId 取得・**同期後 local 3件 = server 3行＝二重表示なし**／**対照実験で旧実装は local 4件・重複1件を再現**（修正が効く直接証拠）／console 0／dev-check 200/200/200／本番配信コードが**ローカルと完全一致**・欠陥パターン残存0件／一括操作Hotfix・Decision 064/065 **非回帰**。
- **DB無変更**：生存tasks **253**／archived **167**／deletedIds **127**／cases 生存**2**・削除済**2**・検証用Taskの混入**0件**。

### 次工程（ユーザー承認後に決定・未着手）
1. **本番実機確認（PC）** — 今回Hotfix（Task作成→リロードで二重表示されないこと）／先行の一括操作Hotfix（一括アーカイブ・復元・進捗表示・件数/バッジ一致・console 0）
2. **既存重複データの整理判断（未整理）** — 本番DBに**重複署名16グループ・余剰16行**（すべて2行重複・Leader依頼系が中心）。**本Hotfixは新規発生の停止のみ**で既存分は解消されない。整理には対象特定・削除方針・Server正本契約（`deletedIds`）への影響検討が必要
3. **Phase55へ進むか判断**／**Version1.1 の範囲確定**

---

## 【現在地・最優先】Task一括操作 Hotfix — **完了**（2026-07-17・本番反映済み・**localhost実機確認済み**）

- **現在Version**：Version1 Final Complete ／ Version1.1 Connected AI Company 開発中
- **現在Phase**：**Phase54 Complete維持**／**Phase55 未着手**
- **Git**：**HEAD = origin/main = `deba2ed`**（本docs更新commitが以降の最新HEAD）。**最新code tag = `v1.01-phase54-task-bulk-parallel`**。
- **内容**：Task一括操作（**アーカイブ／復元／完全削除**）を**同時5並列化**。**index.htmlのみ（+200/-65）**・server.js/lib/DB/API/SQL **無変更**。
  - **原因（確定）**：1件ずつ直列 `await`（本番RTT実測 約0.9秒 × 133件 ≒ **約2分**）＋UI無反応＋`saveTasks()` がループ完了後の1回のみ → **更新で中断** → PATCH完了分のみ Server正本から復元＝「全選択しても一部しか減らない」。**サーバー・DB・同期・件数制限はすべて正常**。
  - **対策**：`_taskBulkRunPooled()`（共有カーソル・同時5固定・重複0・1件の例外で停止しない）／進捗表示／`_taskBulkBusy` による二重実行防止（`finally` で確実解除）／処理中のみ `beforeunload`／**成功ごとの `saveTasks()`**（中断耐性）／**本描画は完了後1回**。
  - **不変**：`setTaskArchivedOnServer` / `softDeleteTaskOnServer` **無変更**・**Server成功後のみlocal反映**・失敗はlocal維持＋**選択維持**・Server正本契約（`archivedAt` / `deletedIds`）・Decision 064／065・Case系一括削除は対象外。
  - **効果**：133件で**約120秒 → 約24秒**。
- **確認**：localhost実機でアーカイブ3件→復元3件（原状回復）・完全削除3件（サーバー経路2＋local-only経路1）・件数/バッジ一致（86→83→86）・**console 0**・**dev-check 200/200/200**・本番トップ200・**配信コードがローカルと完全一致**。
- **DB実測（確認時点）**：生存tasks **253**／archived **167**／**deletedIds 127**／cases 生存**2**・削除済**2**（`deletedIds` は 125→127＝確認用テストTask2件の作成・完全削除による。**既存Taskの喪失なし**）。

### 次工程（ユーザー承認後に決定・未着手）
1. **本番でのPC実機確認**（一括アーカイブ・復元・進捗表示・件数/バッジ一致・console 0）
2. **【別Known Issue】Task新規作成時の2重化 — 原因調査のみ（実装禁止）**
   - **現象**：POST は成功しているのにクライアントが `dbId` を取り込めず local-only のまま残り、リロード後にサーバーコピーと**同一Taskが2件表示**される
   - **本Hotfixとは無関係の既存問題**（`submitTask()` / `createTask()` は本Hotfixのdiffに非該当）
   - **調査対象**：`submitTask()` / `createTask()` / `POST /api/tasks` の返却値 / `dbId` 取り込み / local-only TaskとServer Taskのmerge / **Decision 063（Case成功確認契約）と同型か**
3. **Phase55へ進むか判断**／**Version1.1 の範囲確定**

---

## 【現在地・最優先】Task表示仕様変更 — **完了**（2026-07-17・本番反映済み・**PC/iPhone実機確認完了**）

- **現在Version**：Version1 Final Complete ／ Version1.1 Connected AI Company 開発中
- **現在Phase**：**Phase54 Complete維持**／**Phase55 未着手**
- **Git**：**HEAD = origin/main = `bbfbc73`**（本docs更新commitが以降の最新HEAD）。**最新code tag = `v1.01-phase54-task-sort-newest`**。
  - `5fe2b64`（Task Home Overview・tag `v1.01-phase54-task-home-overview`）／`bbfbc73`（Task Sort Order・tag `v1.01-phase54-task-sort-newest`）
- **① Taskホーム表示改善 完了**（Decision 064・Decision 054 の表示仕様を改定）
  - **ホーム＝全案件Task＋横断Task（俯瞰）** ／ **案件画面＝選択案件＋横断（他案件は非表示）** ／ **最新一覧・案件一覧＝横断のみ（現状維持）**
  - `_taskIsHomeView()` 新規（`currentMember===null` のみホーム判定）＋`_taskInCurrentView()` にホーム分岐＋**`renderTaskList()` のインライン重複を同関数へ統一** → **一覧・Progress・バッジ・診断が同一可視集合**（件数不一致を構造的に防止）
  - **Timeline／Notification／Task History は変更なし**（ホームでは従来どおり横断のみ＝粒度差は仕様として許容）
- **② Task並び順統一 完了**（Decision 065）
  - **PC・iPhoneとも「上が最新・下が過去」**（`createdAt` 降順・同着は `id` 固定・**archived一覧も同一**）
  - 原因＝`renderTaskList()` にソートがなく、自端末作成（`unshift`＝先頭）と同期受信（`push`＝末尾）が混在し端末ごとに逆転していた
  - **表示用 `filtered` のみソート**／**`tasks` 配列本体・同期・backfill・localStorage・DB は不変**
- **PC/iPhone 実機確認完了**（ユーザー実施）／dev-check 200/200/200・console 0・本番配信コード一致・**DB無変更**（cases 2/2/4・tasks 253/125・archived 70・テストデータ作成なし）

### 次工程（ユーザー承認後に決定・未着手）
1. **Phase55へ進むか判断**
2. **Version1.1 最終確認**
3. **Version2（Affiliate Intelligence）準備**

---

## 【参考・完了済み】Case成功確認契約 — **完了**（2026-07-17・本番反映済み・commit aed5f7d・tag v1.01-phase54-case-sync-contract）

- **現在Version**：Version1 Final Complete ／ Version1.1 Connected AI Company 開発中
- **現在Phase**：**Phase54 Complete維持**／**Case同期 Complete**／**Case Known Issue Complete**／**Phase55 未着手**
- **Git**：**HEAD = origin/main = `aed5f7d`**（本docs更新commitが以降の最新HEAD）。**最新code tag = `v1.01-phase54-case-sync-contract`**。
- **内容**：案件の**作成・削除を「成功確認型」へ統一**（Decision 063・**index.htmlのみ +48/-11**・server.js/lib/DB/API/SQL **無変更**）。
  - **POST成功確認**：`_postCaseOnce()` 追加＋`pushCaseToServer()` async契約化（`{ ok, status, reason }`）。従来の `fetch(...).catch(() => {})` の**失敗握り潰しを解消**
  - **`data.ok` 検証**：サーバは Supabase 失敗時も **HTTP 200 + `{ ok:false }`** を返すため（P4）、成功＝**`res.ok` かつ JSON解析成功 かつ `data.ok === true`** の3条件
  - **再送1回**：5xx・通信失敗・`200+ok:false` のみ最大1回（合計2回・無限再試行禁止）／**4xxは再送しない**
  - **通知**：**案件作成時の同期失敗のみ**（`touchCase` 経由は通知しない＝毎メッセージ発火のスパム防止）
  - **local保持**：作成は成否に関わらず**常にlocal保持**／`createCase()` は**同期関数のまま**（UIブロックなし）／`touchCase()` **無変更**
  - **DELETE側（P5解消）**：404を先に判定→local-onlyとして削除可／それ以外は3条件のみ成功／**200+`ok:false`・5xx・通信失敗は失敗＝localを保持して通知**（Supabase障害時に「削除したのに復活する」事故を防止）
- **確認**：fetchスタブで localhost・本番とも全ケース合格・最大試行2回以内・dev-check 200/200/200・console 0・本番トップ200・旧配線 残存0件・**本番DB無変更（生存1/削除済み2/計3行）**・**テストデータ作成なし**
- **効果**：**local-only案件の再発防止**（一過性の通信断は自動再送で救済・恒久的失敗は即時に認知）＋P5解消

### 【参考】先行して完了：案件系Known Issue 全Close（2026-07-17・tag v1.01-phase54-known-issue-case-closed）
- **Git**：**HEAD = origin/main = `7c7d6ff`**（本docs更新commitが以降の最新HEAD）。**最新code tag = `v1.01-phase54-known-issue-case-closed`**。
  - 主要commit：`f36762c`（案件自動生成停止）／`ad83544`（Case削除同期）／`7c7d6ff`（案件診断パネル）
  - 主要tag：`v1.01-phase54-known-issue-case-auto-create` / `-case-delete-sync` / `-case-diagnosis` / `-case-closed`
- **成果（案件＝Case系のみ。Task系とは別工程）**：
  - **不具合① 案件自動増殖：解消済み** — `handleLeaderDispatch()` の無条件 `createCase()` を停止。**案件作成は「新規案件」操作のみ**／案件選択中は現在案件を継続／未選択・最新一覧・案件一覧は `caseId=null` の**横断**（Decision 060）
  - **不具合②-A Case削除同期：Complete** — `cases.deleted_at` 論理削除＋`deletedIds` によるServer正本化。**物理削除禁止**・**local-only案件保護**・**削除は成功後のみlocal反映**（200/冪等200/404=local削除可・5xx/通信失敗はlocal保持＋通知）・削除4経路を同一契約へ統一（Decision 061）。**PC⇔iPhone双方向の削除伝播を実機確認済み**
  - **②-B-1 診断：PC・iPhone双方で実施済み**（読み取り専用・`GET /api/cases` のみ）
  - **②-B-2 Backfill：対象なしのため未実装Close** ／ **②-C 残骸整理：対象なしのためClose**（Decision 062）
- **実機実測（PC・iPhone双方で完全一致）**：**DB生存 1／DB論理削除済み 2（合計3行＝物理削除なし）／PC local 1／iPhone local 1 ＝ DB生存 = PC = iPhone の三者一致／local-only 0／Review 0／Remove候補 0**
- **`DEBUG_CASE_DIAG = false`**（本番の「🔍 診断」ボタン非表示）／**診断ロジックは削除せず温存**（再調査時 `true` で復活・PhaseD-1 の `DEBUG_TASK_SYNC` と同方式）
- **SQL（ユーザー実行済み・非破壊）**：`ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;` ＋ `CREATE INDEX IF NOT EXISTS idx_cases_deleted_at ON cases (deleted_at);`
- **保護・不変**：**物理削除なし**（可逆な論理削除）／**`messages`・`conversations`・`task_history`・Learning は非連動・非削除**／local-only案件保護／`createCase()` 本体／`createNewCaseFromForm()`／**Task同期・Task History・Notification・Timeline・Approval・Output Draft・Provider・Routing・Cost・Phase53 非接触**／cost関連3ファイル・退避フォルダ 未操作
- **✅ `pushCaseToServer` 成功確認化は完了**（2026-07-17・commit `aed5f7d`・Decision 063・本ファイル冒頭参照）

### 残タスク（ユーザー承認後に決定・未着手）
- **✅ Phase54 Hotfix の Task側 PC⇔iPhone 実機確認は完了**（2026-07-17）。Task同期・DB保存は正常と確認。実機で判明した**表示上の2件**は Decision 064（ホーム全件表示）・Decision 065（並び順統一）として対応・本番反映・実機確認済み（本ファイル冒頭参照）
1. **Case同期契機の改善**（`visibilitychange` 等）— 現在は**起動時1回のみ**のため、他端末の削除反映に**相手端末のF5が必要**
2. **Phase55 判断**／**Version1.1 最終確認**／**Version2（Affiliate Intelligence）準備**

- **その他の残存項目は別工程**：Edge(Windows 125%)Taskスクロールバー判定ずれ／正当候補156件のTask整理／`backup-dup-candidates-20260714/` の最終処理方針／検証テスト行の整理／Cost同期・Learning残buffer・回答本文のtask_history保存（Version2候補）。**Phase55は別承認まで開始しない**

---

## 【参考・完了済み】Phase54 Known Issue（PC⇔iPhone Task表示不一致）— **Closed**（2026-07-16・archived/caseId Server正本化・本番反映済み）

- **現在Version**：Version1 Final Complete ／ Version1.1 Connected AI Company 開発中
- **現在Phase**：**Phase54 正式Complete維持**／**Phase54 Known Issue Closed**／**Phase55 未着手**
- **Git**：**HEAD = origin/main = `a5bbe27`**（PhaseD-1）。本docs更新commitが以降の最新HEAD。**最新code tag = `v1.01-phase54-known-issue-c2`**。
  - 主要commit：`5f23cf1`(A-0)／`76d0582`(A-1)／`0ed68e4`(C-1)／`6f0816a`(C-2)／`a5bbe27`(D-1・tagなし)
  - 主要tag：`v1.01-phase54-known-issue-a0`/`-a1`/`-c1`/`-c2`
- **成果**：Task field merge を**項目別Server正本化**（dbId一致の `archivedAt`/`caseId` を Server正本・rich status/その他は newer-wins維持・local-only保護）。**PC=iPhone で view69/badge69 一致**。
- **最終確認（本番・実機）**：total233・archived1・todo232・NULL caseId70・caseIdあり163・**PC/iPhone view69・badge69**・Task件数減少なし・backfill POST増加なし・Render API正常・診断は `DEBUG_TASK_SYNC=false` で本番非表示（ロジックは温存）。
- **原因（PhaseA-2確定）**：merge が単一 `updatedAt` の newer-wins で archived/caseId/rich status を一括処理していたため、iPhone localStorage の古い archived52件・端末caseId が同期後も温存され不一致。→ **Decision 059** 参照。
- **保護・不変**：local-only Task／rich status／newer-wins本体／deleted同期／Server-Authoritative Reconciliation／backfill安全化／件数統一／Task History／Learning／server.js/lib/DB/API/SQL/Supabase。
- **次工程（ユーザー承認後に決定・未着手）**：Phase55候補整理 または Version1.1残課題確認。診断は再調査時 `DEBUG_TASK_SYNC=true` で復活可。orphan caseId（tasks.case_id と cases表の不整合）整理は任意・別工程。**Phase55は別承認まで開始しない**。

---

## 【現在地・最優先】Phase54 Hotfix — Task同期/削除/アーカイブ/backfill安全化/Task生成上限 **本番反映済み**（2026-07-14・Phase54完了後Known Issue対応）

- **位置づけ**：**Phase54 正式Complete 維持**（tag `v1.01-phase54-complete` 不変）・**Phase55 未着手 維持**。Phase54完了後にユーザー実機で顕在化した Task同期 Known Issue への Hotfix。
- **Git**：commit **d512bad**（`Phase54 hotfix task sync archive and backfill safety`・4ファイル）・tag **v1.01-phase54-hotfix-task-sync**・**HEAD = origin/main = tag = d512bad**・**Render反映済み・本番確認済み**。
- **Known Issue（対応済み）**：Task削除がPC⇔iPhoneで非同期／削除がF5等で復活／一覧・Progress・バッジの件数不一致／backfill重複。調査で **backfillによるTask急増（75→354）**・**Task生成10件制限** も判明。
- **実装**：
  - **削除同期** `tasks.deleted_at`（論理削除・物理削除なし）＋`PATCH {deleted:true}`／dbId限定 reconciliation／local-only保護
  - **アーカイブ同期** `tasks.archived_at`＋`PATCH {archived:true|false}`（復元可・PC⇔iPhone・Task History/Learning温存）
  - **backfill安全化（B案）**：server同期後1回・in-flight lock・dbIdなしのみ・deletedSignatures照合・archived除外・**local重複除外**・成功後即dbId・失敗再試行なし・**POST上限20超過で自動停止＋通知**
  - **件数統一**：一覧/Progress/バッジ＝現在案件＋NULL・deleted除外・archived除外
  - **Task生成上限 10→20**（`MAX_AUTO_TASKS=20`・backfill上限とは別管理）
- **本番DBデータ整理**：重複候補 **123件を JSON/CSV 退避 → id限定 `deleted_at` 論理削除**。**生存233件／deletedIds125件**。**元75件・正当候補156件は保護（全生存）**。検証用 **arch-1=通常／arch-2=アーカイブ** 残置。**正当候補156件の個別整理は未実施**。
- **退避/除外**：`backup-dup-candidates-20260714/`（123件JSON/CSV）は**ローカル退避・Git対象外**。**cost関連3ファイルは対象外・未操作**。
- **確認状況（区別）**：
  - **実装済み**：コード4ファイル（index.html/server.js/lib/tasksDb.js/supabase/schema.sql）
  - **localhost確認済み**：dev-check 200/200/200・console 0・削除/アーカイブ/冪等/404/400・件数一致・backfillフラッド防止・F5維持
  - **本番確認済み**：Render top200・GET total233/deletedIds125・archived_at含む・arch-1 NULL/arch-2 NOT NULL・21件→400「最大20件」・console 0
  - **ユーザー実機確認：未実施**（PC⇔iPhone双方向の削除/アーカイブ/復元 同期の実機確認は今後）
- **次工程の残課題（未着手）**：正当候補156件の個別整理／PC⇔iPhoneユーザー実機確認／`backup-dup-candidates-20260714/` の最終処理方針。**Phase55は未着手**。

---

## 【参考・完了済み】Phase54 Remaining Realtime Sync — **正式Complete**（2026-07-14・最終統合確認合格）

- 現在Version：Version1 Final Complete ／ Version1.1 Connected AI Company 開発中
- **現在Phase**：**Phase54 正式Complete**（3a→3a-2→3b-1→3b-2→3b-3→最終統合確認 すべて完了）・tag **v1.01-phase54-complete**
- **成果＝Version1.1「PC⇔スマホ同一AI会社」の同期基盤成立**：
  - Approval Sync（54-1系）／Output Draft＋Review State永続化（54-2系）／Task同期＋案件分離（3a/3a-2・tasks.case_id）／Task History DB永続化＋案件分離（3b-1/3b-2・task_history）／Notification既読DB同期＝PC⇔iPhone双方向（3b-3a・notification_reads）／Timeline案件別表示（3b-3b）／Workflow Live履歴フォールバック復元（3b-3c）
- **最終統合確認（合格）**：案件A/B分離（Task/履歴/Timeline・混入なし）・NULL/空横断データ維持・Approval/Draft/Review State案件別復元・Task60件維持（重複0）・再起動直後DB復元（履歴12/既読6・dup0）・PC⇔iPhone既読双方向同期（実機）・F5/再ログイン維持・Messages復元・全consumer回帰なし・console 0・dev-check 200/200/200・本番全API正常
- **Known Issue（継続）**：Edge（Windows・表示倍率125%）Taskスクロールバー判定ずれ（軽微・UIリファイン時再調査）

### 次工程（ユーザー判断）
- **Phase55候補整理** または **Version1.1残課題確認**。候補：Cost同期（別工程・cost系3ファイル温存方針と整合要）／Learning残in-memory buffer（Version2候補）／回答本文のtask_history保存（Workflow Live完全復元の前提）／UIリファイン（Known Issue再調査含む）／検証テスト行の整理方針
- **Phase55実装は未着手**（着手前に設計レビュー・ユーザー承認）

---

## 【参考・完了済み】Phase54-3b-3 Notification既読永続化・Timeline案件別・Workflow Live復元 — **Completed**

- **Phase54-3b-3 Completed**（PC→iPhone／iPhone→PC 既読同期・F5/再ログイン維持・本番表示操作 ユーザー実機確認済み）／code = **3e3c432**・tag **v1.01-phase54-3b-3**

### 実装（commit 3e3c432・4ファイル・+200/-8）
- **3b-3a 既読DB永続化**：新規 `notification_reads`（history_id PK・case_id・seen_at・created_at）／`lib/notificationReadsDb.js`（getSeenIds{caseId,limit}／markSeen・冪等）／`GET/POST /api/notification-reads`（GET limit既定1000/上限5000）。client：showAppで既読復元・click/markAllでDB保存・即時UI維持。**単一共有アカウント(web-user)＝PC/iPhone既読同期基盤**
- **3b-3b Timeline案件別**：`_timelineEventVisibleInView`＋renderTimeline（空/NULL横断常時表示・case付きは現在案件のみ・ホームは横断のみ）
- **3b-3c Workflow Live復元**：wlProgressPoll found:false時のみ`_wlRestoreFromHistory`でtask_historyから静的復元（担当/action/status/caseId/時刻・本文対象外）

### 実DB確認済み（commit 3e3c432）
- 既読POST/GET・冪等(重複0)・limit・空POST400・`_notifSeenIds`復元（F5/再ログイン相当）／Timeline A/B分離＋空/NULL横断維持／Workflow Live復元(本文空)／既存consumer回帰なし／console 0／dev-check 200/200/200
- 検証行：`zzz-3b3-*`（既読・非活性・削除しない）

### 本番確認済み（Completed）
- push→Render反映→本番API確認（notification-reads GET/POST/limit/冪等・重複0・形不変）→**ユーザー実機確認済み（PC→iPhone／iPhone→PC 既読同期・F5/再ログイン維持・表示操作正常）**。Phase54最終統合確認も合格（冒頭参照）

---

## 【参考・完了済み】Phase54-3b-2 Task History Case Scoping — **Completed**（案件別履歴分離完成・push済み・Render反映済み・本番/ユーザー実機確認済み）

- **現在Phase**：**Phase54-3b-2 Completed**／origin/main = **3a95691**（code b5ab89d＋docs 3a95691）・tag **v1.01-phase54-3b-2**（→ b5ab89d）
- **目的達成**：Task History を案件単位で保存・取得・表示分離（**案件A専用履歴が他案件へ混入しないことをユーザー実機確認済み**・NULL横断は両案件表示）

### 実装（commit b5ab89d・2ファイル・+29/-12）
- `index.html`：auto-task・consult POST に `caseId: getCurrentApprovalCaseId() || null` 送信／`_historyVisibleInView`＋`renderNotifications` 案件別フィルタ
- `server.js`：auto-task・consult で caseId受領→履歴各行へ保存／`_hybridTaskHistory` 任意caseId／GET 2本に任意 `?caseId=`

### 仕様
- 引数なしGET＝全件（クライアント全保持・Hybrid/dedup維持）／`?caseId=X`＝該当案件のみ厳密（NULL含まず）／NULL横断はクライアント表示側（`_historyVisibleInView`）で担保＝案件画面＝該当案件＋NULL横断・ホーム/未選択＝NULL横断のみ
- Notificationに適用／Workflow Live(aiLivePoll)はworkflowId scopedで既存維持／workflow-dashboardは全社全件維持＋任意caseId／Learningは全社据え置き

### 確認済み（localhost・実DB・commit b5ab89d）
- **Auto Task実ワークフロー1回（案件A・実AI）**：生成6行全て case_id=A・history_id重複0・GET`?caseId=A`6件/`?caseId=B`0件・NULL横断存続・**Notification実描画 案件A=6/案件B=0**・workflow-dashboard形不変＋caseIdフィルタ／再起動後case_id維持・既存consumer回帰なし・console 0・dev-check 200/200/200
- 検証テスト行：`zzz-3b2-A/B/NULL`＋実consult/実Auto Task行（識別可能・非活性・削除しない）

### 本番確認済み（Completed）
- push `6d1f5b6..3a95691`（cost非混入）→ Render自動デプロイ反映（本番`?caseId=`フィルタ動作＝新コード稼働）→ 本番API確認（task-history/workflow-dashboard 200・レスポンス形不変・caseId付き履歴DB取得・重複0・console 0）→ **ユーザー実機確認済み（案件A専用履歴が他案件へ混入しない）**・F5/再ログイン/再起動後もDB永続・NULL横断維持・Notification案件分離・Workflow Live/Timeline回帰なし

### 次工程 — Phase54-3b-3（未着手）
- 候補：**Timeline案件別表示の最終確認／Notification未読永続化（`_notifSeenIds` 非永続の解消）／Workflow Live Restore／必要範囲の仕上げ**
- **実装は未開始**（着手前に設計レビュー・影響範囲・必要ならSQL提示・ユーザー承認）
- **目的**：`global.__taskHistory`（サーバーメモリ・非DB・**Render再起動で消失**）を新規 `task_history` テーブルへ永続化 → Timeline/Notification/Workflow Live/Auto Task/Live Status の再起動復元基盤。**今回は永続化基盤のみ（case_id配線・UI変更は3b-2以降）**
- **SQL実行済み（ユーザー）**：`CREATE TABLE task_history`（`history_id TEXT NOT NULL UNIQUE`・`case_id TEXT` nullable/FKなし・`status TEXT` CHECKなし・`meta JSONB`）＋3 index＋冪等RLS。Supabase作成成功

### 変更（commit 2e4b0fc・3ファイル・+195/-8）
- `supabase/schema.sql`：`task_history` 正式定義（CREATE＋index＋冪等RLS）
- `lib/taskHistoryDb.js`（新規）：`upsertHistoryEntry`／`upsertHistoryEntries`／`getHistory`（`history_id` 冪等upsert・app↔DBマッピング・meta退避/復元）
- `server.js`：`_persistTaskHistory`（fire-and-forget・DB失敗でWorkflow停止しない）＋`_hybridTaskHistory`（メモリ＋DB・history_id dedup・メモリlive優先）＋push時DB保存＋GET 2本Hybrid化（**レスポンス形不変**）

### 実DB確認済み（commit 2e4b0fc）
- round-trip＋meta復元／`history_id` 冪等upsert（running→completed **重複行0**）／Hybrid(memory+DB) dedup（実consult1回・appearCount=1・live優先）／**サーバー再起動2回後もDB復元**（2件・dupInGet 0・workflow-dashboard集約）／DB未作成でもgraceful／既存consumer回帰なし／console 0／dev-check 200/200/200
- 検証テスト行2件（`zzz-3b1-rt-*`／`consult-1783955050504-p53pn`・識別可能・非活性・削除しない）

### 本番確認済み（Completed）
- push `47d7417..6d1f5b6`（cost非混入）→ Render自動デプロイ反映（新Hybridコード稼働＝本番GETがDB履歴返却）→ 本番API確認（task-history/workflow-dashboard 200・レスポンス形不変・DB履歴取得・重複0・console 0）→ **Render再デプロイ後の新規インスタンス（メモリ空）もDB履歴復元**（本番再起動復元成立）

### 次工程 — Phase54-3b-2 Case ID配線
- `case_id` を `/api/auto-task`・`/api/consult` へclient配線（`getCurrentApprovalCaseId()`）→ server が生成する task history 各行へ保存 → GET `/api/task-history?caseId=`・`/api/workflow-dashboard?caseId=` 任意フィルタ（**引数なしは全件維持・Hybrid/dedup維持**）→ 消費側(Timeline/Notification/Workflow Live)の案件別表示（**case_id=NULL は横断履歴として全案件表示**・クライアント内部で全保持し表示時のみ絞る）

---

## 【現在地・最優先】Phase54-3a-2 Task Case Scoping — **Completed**（案件別Task分離完成・push済み・Render反映済み・本番PC/ユーザー実機確認済み）

- 現在Version：Version1 Final Complete ／ Version1.1 Connected AI Company 開発中
- **現在Phase**：**Phase54-3a-2 Completed**／origin/main = **4372576**（code bc98455＋docs 4372576）・tag **v1.01-phase54-3a-2**（→ bc98455）
- **採用＝A案（Decision 054）**：`tasks` へ nullable `case_id`（FKなし・既存行NULL維持・`messages.case_id`踏襲・追加のみ非破壊）。**Task Case Scoping 完成＝案件別Task分離完成・NULL横断Task維持・既存Task非破壊**
- **確定仕様**：案件画面＝該当案件Task＋NULL横断Task／ホーム・未選択＝NULL横断Taskのみ／既存55件はNULL温存／GET既定全件／`_taskSignature`不変

### SQL（ユーザー実行済み）
```sql
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS case_id TEXT;
CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON tasks (case_id);
```

### 変更（commit bc98455・4ファイル・+72/-20）
- `supabase/schema.sql`：tasks CREATEに`case_id TEXT`＋ALTER/index冪等コメント
- `lib/tasksDb.js`：`createTask` caseId（非null時のみ列送信）・`getTasks` 任意caseIdフィルタ（既定全件）
- `server.js`：POST caseId受領／GET 任意caseId（既定全件）／PATCH不変
- `index.html`：caseId送信/map/merge反映・`_ensureTaskCaseId`/`_taskViewCaseId`・全作成経路配線・`renderTaskList`案件別フィルタ・switchCase/_homeOpenCase/goHome再描画フック

### 確認済み（localhost＋本番・Completed）
- localhost（SQL実行済み・commit bc98455）：`tasks.case_id`実在／caseId付き保存・NULL保存・GET全件・GET?caseId=フィルタ／案件A/B分離（実DOM）／NULL横断（既存55件全view表示）／F5維持／**実ログアウト→再ログイン→案件A/B分離（実DOM）**／backfill重複POST 0・dbId重複0／既存55件減少0・DB60件／console 0／dev-check 200/200/200
- **本番**：push→Render自動デプロイ反映（新server.js GET`?caseId=`サーバーフィルタ稼働・新index.html新関数稼働・GET正常・エラーなし）→ **本番PC確認済み**（案件A/B分離・NULL横断・F5・再ログイン維持・重複なし・既存減少なし・console 0）→ **ユーザー実機確認済み**
- 検証テスト行5件（`ZZZ-TEST3a2-A/B/NULL`＋`ZZZ-RELOGIN-A/B`・識別可能・非活性・温存＝削除しない）

### 次工程 — Phase54-3b Task History Persistence（未着手）
- `global.__taskHistory`（server memory・非DB・Render再起動で消失）を新規 `task_history` テーブルへDB化 → Timeline/Notification/Workflow Live/Auto Task の端末間・F5・再起動復元を一括解錠。**詳細Live Status（working/reviewing等）はここで扱う**。server.js/lib/schema＋要SQL
- **推奨案＝案A：`task_history` 自身に nullable `case_id` を保持**（履歴は「その時点の事実」＝Task削除・欠損に独立して案件判定可・復元耐性/取得効率/同期単純さで有利・`messages.case_id`と同一思想）。案B（`task_id`のみ・`tasks.case_id`参照）はデータ重複少だがtasks欠損で案件不明化
- **実装は未開始**（着手前に設計レビュー・影響範囲・SQL提示・ユーザー承認）

---

## 【現在地・最優先】Phase54-3a Task Basic Sync — Completed（Known Issueあり）

- 現在Version：Version1 Final Complete ／ Version1.1 Connected AI Company 開発中
- **現在Phase**：**Phase54-3a Completed（Known Issueあり）**／origin/main = **82674b9**・tag **v1.01-phase54-3a**（→ dc439d5）
- **Phase54-2 Complete**（Output Draft Persistence＋Mobile Review State Persistence・commit f0f382f・tag v1.01-phase54-2f・push済み・Render反映済み・本番確認済み）
- **Phase54-3 正式化（Decision 053）**：実開発Phase54系＝**Version1.1 Realtime Sync系**。ROADMAP旧Phase54は旧計画として履歴保持・Version2は再採番。分割＝**3a Task Basic Sync（Completed）→ 3a-2 Task Case Scoping（案件別Task分離・`tasks.case_id`・未着手）→ 3b Task History Persistence（詳細Live Statusはここ・未着手）→ 3c Notification Unread/Workflow Live Restore（未着手）→ 3d 最終確認（未着手）**。Cost＝別工程・Learning残＝Version2候補

### Phase54-3a 完了内容（本番実機確認済み）
- **Task Basic Sync**（dc439d5・tag v1.01-phase54-3a）：`GET /api/tasks` を起動時・switchCase・_homeOpenCase で pull・merge（`syncTasksFromServer`/`_taskFromServerRow`/`_mapServerTaskStatus`/`_taskSyncInFlight`・index.htmlのみ・DB/API/SQL無・新規poll無）。merge安全規則：dbId重複排除／未存在のみ追加／サーバー`updated_at`厳密新しい時のみ採用／localのみTask保持／失敗・空で削除しない
- **3a-fix Task完全収束**（e96bdaa）：全Task作成経路（7724/7974/11821）を `syncTaskToServer` へ配線（`_persistNewTask`）＋起動時 `backfillLocalOnlyTasks`（ローカルのみTaskを削除せずサーバーへ押上げ・冪等・`_taskSignature`=title¦memberId¦sourceMessage¦body で重複防止・POST成功後のみdbId付与・`_taskBackfillInFlight`ガード・失敗/空で削除しない）。※11210は `atRunWorkflow` のworkflow定義配列（ボードTaskでない）ため非配線。**PC/iPhone 55件で一致・本番確認済み**
- **UI-A Task操作性**（4e56b44/ddc1c81/af4ab80/82674b9）：選択ツールバー`N件選択中`＋短縮ボタン・**最終は標準ネイティブスクロールバー（`scrollbar-width:auto`＋`scrollbar-color`）へ一本化**（webkit擬似要素撤去＝見た目=ヒット判定統一）。index.htmlのみ・CSS中心・JS最小
- **既知制約**：client status(10種) vs server CHECK(pending/in_progress/done)。rich statusのPATCHは失敗し`updated_at`が進まないため pull時に降格しない。双方向status統一は3b以降

### ⚠ Known Issue（Phase54-3a・修正継続しない）
- **Edge（Windows・表示倍率125%環境）でTaskスクロールバーのヒット判定が見た目より数px左へずれる場合がある**
- ホイールスクロール／タッチパッド2本指／キーボードスクロール／Task操作／iPhone は**すべて正常**
- 実運用への影響は軽微 → **Version1.1開発を優先し、UIリファイン時に再調査対象**とする

### 次工程（ユーザー判断）
- **3a-2 Task Case Scoping**（`tasks` へ nullable `case_id`・案件別Task分離・DB/server/lib/index・要SQL）／または
- **3b Task History Persistence**（`global.__taskHistory` を新規 `task_history` テーブルへDB化・Timeline/Notification/Workflow Live/Auto Task の端末間・F5・再起動復元を一括解錠・server.js/lib/schema＋SQL・既存API維持のhybrid・完了履歴のみ復元）
- localhost確認：起動pullで22件merge・dedup・空/失敗維持・in-flightガード(GET1回)・newer-wins＋rich status保護・F5復元・回帰OK・console0・dev-check 200/200/200
- **未実施**：commit（コード/docs）・tag・push・Render・本番実機・3a Complete確定

### 次工程
- 3a：ユーザー承認後に commit（`Phase54-3a sync tasks from server` / docs `Phase54-3a update documentation`）→ tag（承認後）→ push → Render → 本番実機 → 3a Complete。以後 3b（`task_history` DB化）へ

---

## 【参考・完了済み】Phase54-2 Output Draft Persistence **Complete**（Output Draトのサーバ永続化＝リロード復元・案件切替復元・Mobile Review状態永続化・B案・2b/2c/2d/2f・push済み・Render反映済み・本番確認済み）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-2 Complete**／本番: **Render反映済み・本番実機確認完了**
- Commit: **6dec27d**(2b)／**5eec84b**(2c)／**7589f4f**(2d)／**f0f382f**(2f `persist mobile review state`)／Tag **v1.01-phase54-2d**・**v1.01-phase54-2f**（→ f0f382f）／**origin/main = f0f382f**
- DB: `output_drafts`（output_id PK・case_id NOT NULL・FKなし・非破壊）＋`review_state JSONB`(2f) 作成済み
- **Phase54-2f**: スライド別レビュー状態（`statusBySlide`/`commentsBySlide`/`revisionTargetBySlide`/`approved`＝「OK x/10」）を `output_drafts.review_state` へ成果物単位で保存・復元。output_approvals・Approval Sync・Phase54-1f/1g・Publishing Ready・Mobile Approval 非接触
- **本番実機確認（ユーザー通常ブラウザ）**: OK x/10保持・コメント/修正依頼/修正担当保持・F5復元・案件切替・別案件混入なし・元案件復元・Mobile Approval/Publishing Ready回帰なし・Approval Sync正常・console 0 → **Phase54-2 Complete 確定**
- 次工程: **Phase54-3 開始前レビュー**（現状整理・影響範囲・採用案・実装計画のみ・実装しない）

---

## 【参考・完了済み】Phase54-2 実装詳細（2b/2c/2d・B案）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-2d 実装完了・localhost確認済み**／本番: **未確認**（push・Render反映は本リリースで実施）
- Commit: **6dec27d**(2b `add output draft persistence API`)／**5eec84b**(2c `save output drafts`)／**7589f4f**(2d `restore output drafts`)／docs commit＋Tag **v1.01-phase54-2d**（→ 7589f4f）
- DB: ユーザーが `output_drafts`（output_id PK・case_id NOT NULL・FKなし・非破壊）作成済み

### 現在地
**Phase54-2 = Output Draト永続化（B案）を 2b(サーバ基盤)→2c(保存)→2d(復元) で実装完了・localhost実機確認済み**。`output_id` を承認との共通キーにし、復元後は既存 Approval Sync が同 output_id で承認復元（**Phase54-1f/1g 非接触**）。**本番実機確認は未実施**。

### 実装
- **2b**：`lib/outputDraftsDb.js`＋`server.js` `GET/POST /api/output-drafts`＋`supabase/schema.sql`（実DB round-trip・400・回帰確認済み）
- **2c**（index.htmlのみ）：`buildOutputDraftFromLeaderFinal` 完成後に `pushOutputDraftToServer`（本文＋メタのみ・fire-and-forget・outputId/caseId/fields揃う時のみ・Approval Queue非接触）
- **2d**（index.htmlのみ）：起動/switchCase/_homeOpenCase で `scheduleOutputDraftRestore`→保存済 output_id のまま `_lastOutputDraft` 復元→既存Approval Sync承認復元。**未マークWorkflow Draト保護／Draトなし案件は前案件表示クリア(fix1)／高速連続切替で最新要求を再実行(fix2)**

### localhost実機確認済み（実ワークフロー1回＋実DB）
- 完成Draト保存（`out_1783814527200`/`case-mrgfnfgutvtb`・200・承認POST 0）→ **F5後に復元**・ID一致・Approval GETが同 output_id・復元中POST 0／案件別最新復元／**Draトなし案件で前案件クリア（POST 0）**／**高速連続切替で最終案件即時復元・stale不採用**／Output Engine・Mobile Review/Approval/Publishing Ready 回帰OK・コンソールエラー0・dev-check 200/200/200

### 非接触・保護
- Phase54-1f（output_id判定）／1g（Approval POST Queue）／Approval Sync GET／`mergeApprovalStateFromServer`／server.js・lib・DB・API（2c/2dはindex.htmlのみ）／Phase53／cost系 非接触。承認状態はDraft APIから復元しない。

### 対象外・残課題（Phase54-2e候補）
- polling／複数成果物履歴UI／PC⇔スマホ能動再取得／未完了Workflow Draト保持中の別案件自動置換 は対象外。検証行（`out_2btest_*`/`out_2ctest_*`/`out_1783814527200` 等）は非活性・DELETE未実施。

### 温存
- cost関連3ファイル＝未commit温存（Phase54-2非接触・stageに含めず）

### 次工程
- 本リリース：docs commit → tag `v1.01-phase54-2d` → push → Render反映・GET確認。**本番実機確認は未実施（次段・ユーザー承認後）**

---

## 【参考・完了済み】Phase54-1g Approval POST Ordering / Last Action Wins **Complete**（Approval POST直列化＋対象別Last Action Wins・着順逆転防止・index.htmlのみ・push済み・Render反映済み・本番確認済み）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-1g Complete**／本番: **Render反映済み**（`ai-company-l45x.onrender.com` = d6a6905）
- Commit: **d6a6905**（`Phase54-1g enforce last action wins`）／docs commit: **2bb5a86**（`Phase54-1g update documentation`）＋Complete確定docs／Tag: **v1.01-phase54-1g**（→ d6a6905）／**origin/main = d6a6905・push済み**
- 変更ファイル: **index.html のみ（+89/-7・追加のみ・`pushApprovalToServer` 内部の直列キュー化）**。cost系3ファイルは未commit温存（stageに含めない）

### 現在地
**Phase54-1g = 実装＋合成確認＋localhost実機確認＋push＋Render反映＋本番実機確認 まで完了＝正式Complete**。Approval POST の fire-and-forget 着順逆転（approve→reject→cancel 高速連続でローカル最終とDB最終が不一致）を、**POST直列化＋対象別 Last Action Wins** で解消。**本番でUI最終状態=DB最終状態を確認**。**Approval Sync(GET)の仕様変更ではない**。Phase54-1c由来の残課題を恒久解決（Phase54-1f起因ではない）。

### 実装（index.htmlのみ・追加のみ・変更は `pushApprovalToServer` 内部限定）
- グローバル直列 runner `_runApprovalPostQueue`（1件ずつ `await`・多重起動ガード）／対象別 pending `targetKey=caseId::outputId` 最新のみ保持（同一対象supersede＝Last Action Wins／別対象個別保持）＝`_approvalPostPendingByTarget`(Map)＋`_approvalPostTargetOrder`(配列)／`_enqueueApprovalPost` payload凍結／成功条件 `response.ok`（4xx/5xx/例外=失敗）／最大1回再送・失敗時に新pendingあればstale再送しない（新操作優先）・失敗継続／outputId無しはPOSTしない／外部IF維持・非ブロック（戻り値undefined）

### 非接触（保護対象すべて）
- GET同期（`scheduleApprovalSync`・`syncApprovalsFromServer`・`mergeApprovalStateFromServer`・`isRemoteApprovalNewer`）/ `_approvalSyncInFlight` / `_approvalSyncLastLocalChangeAt` / **output_id判定（Phase54-1f）** / `buildApprovalPayloadForServer`既存項目 / server.js / lib / DB / API / Phase53 / Phase54-1d・1e・1f / cost系

### 確認済み
- 合成（スタブ・実POST 0・課金なし）：Queue動作 / LAW（approve→reject→cancel → `[approve, cancel]`）/ 対象別保持（`outA:approve / outB:reject2 / outC:publish`）/ 失敗→最大1回再送（`[ng, ok]`）/ 新操作優先（stale再送なし）/ outputId無しPOST禁止 / 回帰・後始末原状復帰・コンソールエラー0
- localhost実機（実POST・実Supabase・透過ロガー・AI生成なし）：実成果物Draft＋実ハンドラで approve→reject→cancel → **実POST 2回のみ**（中間reject supersedeで未送信）・UI最終=cancel(null)＝**DB最終null 一致**／reject→cancel は postLog `[rejected:200, null:200]`（着順保持）でDB最終null 一致／別案件混入なし・output_id不一致=復元なし（1f保護健在）・回帰OK・コンソールエラー0 / dev-check 200/200/200
- **本番実機（Render `ai-company-l45x.onrender.com`・実POST・実Supabase・本番POST 6件・手動curl 0）**：approve→reject→cancel → **実POST 2件 `[null:200, null:200]`**（中間reject supersede）・**UI最終=cancel(null)＝DB最終null 一致**・pending残留0／reject→cancel `[rejected:200, null:200]`（着順保持）DB最終null 一致／別案件混入なし・output_id不一致=復元なし（**Phase54-1f保護維持**）／Approval Sync GET回帰なし・非ブロック・コンソールエラー0

### 実機検証で生成したテスト行（DB `output_approvals`・通常UI POST経由・最小・DELETE未実施）
- localhost：`case-1g-rm-*`（null）/ `case-1g-B-*`（null）/ `case-1g-C-*`（rejected）
- 本番：`case-1g-prod-A-*`（null）/ `case-1g-prod-B-*`（null）/ `case-1g-prod-C-*`（rejected）
- 手動curl POST 0回・DELETE未実施。非活性テストデータとして記録（対応Draftはメモリ消失済み・一致判定によりUIへ復元されない・他案件へ混入しない）。

### 残課題（Phase54-1g範囲外・継続）
- Output Draftはメモリのみ（リロード復元不可・PC/スマホ共有不可・複数成果物Approval履歴なし）／`getCurrentApprovalCaseId()` dead fallback（未修正・報告のみ）／Phase54-1f検証由来の孤立行 `case-mrf0d8vobb3y`（out_1783695572489/rejected・非活性・許容）＋本Phase検証のテスト3行

### 別Phase候補（ユーザー判断待ち）
- **Output Draft Persistence**（Draft永続化＝リロード復元・PC/スマホ共有・複数成果物履歴の前提）

### 温存（未コミット・保護対象すべて維持）
- cost関連（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝**未commit温存**（Phase54-1g非接触・stageに含めず）

### 次工程（別Phase候補・ユーザー判断待ち）
- **Output Draft Persistence**（Draft永続化＝リロード復元・PC/スマホ共有・複数成果物Approval履歴の前提）。※Phase54-1g自体は完了・追加作業なし

---

## 【参考・完了済み】Phase54-1f Approval Output Binding / Leakage Prevention Complete（Approval行へoutput_id紐付け・別成果物への誤復元防止・commit済み・push未実施）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-1f Complete**／本番: **未反映（push前・Render未反映）**
- Commit: **9fd25a0**（`Phase54-1f bind approvals to output`）／Tag: **v1.01-phase54-1f**（コードcommitを指す）／**HEAD = 9fd25a0・origin/main = 4c0ef2c・未Push 1**
- 変更ファイル: **`index.html` / `lib/approvalsDb.js` / `server.js` / `supabase/schema.sql`（4ファイル）**（追加のみ・+63/-11・**Phase54-1c同期は一致判定1つ追加以外は非変更 / Phase54-1d・1e非変更 / Phase53非接触 / cost系非接触 / 課金なし**）
- DB: ユーザーが `ALTER TABLE output_approvals ADD COLUMN IF NOT EXISTS output_id TEXT;` 実行済み（nullable・PK変更なし・移行なし・非破壊）。ClaudeはDDL未実行

### 現在地
**Phase54-1f = コードcommit＋Tag完了（push前）**。最新の案件Approval行（case_id PRIMARY KEY・1案件1行維持）へ **`output_id` を紐付け**、**現在成果物と一致する場合だけ復元**。同一案件で新成果物を生成しても旧承認が混入しない（Phase54-1eの残課題を恒久解消）。**完全な複数成果物履歴保存ではない**。

### 実装（追加のみ・4ファイル）
- lib：`upsertApproval(outputId任意・onConflict:case_id維持)` / `getApproval(caseId, outputId任意)`／server.js：GET/POSTに任意 `outputId`（新規エンドポイントなし）／index.html：`getCurrentApprovalOutputId()`＋payload `outputId`＋GET URL `&outputId=`＋`mergeApprovalStateFromServer` に **output_id一致判定**（不一致・NULL・Draftなしは復元しない）／schema.sql：`output_approvals` 定義追記（drift解消）

### 実機確認済み
- 新成果物：Review=unconfirmed / Approval=draft / PR=draft / 承認取消非表示／POSTへ現在outputId（手動POST 0回）→DB保存→draft.id一致／同一成果物内で承認維持（ガード健在・追加POST 0）／**同一案件の別成果物へ混入なし**／案件間混入なし／NULL行は復元しない／回帰OK／コンソールエラー0／dev-check 200/200/200

### 未確認・対象外
- Workflow Live 本文描画／認証無効環境のログイン・ログアウト／リロード後の同一成果物復元／PC⇔スマホ同一Draft共有

### 残課題
- Output Draftはメモリのみ（リロード復元不可・PC/スマホ共有不可・複数成果物Approval履歴なし）／`getCurrentApprovalCaseId()` dead fallback（未修正・報告のみ）／**Approval POST 着順逆転**（Phase54-1f起因ではない・Phase54-1c由来・別Phase候補）／**孤立Approval行**（`case-mrf0d8vobb3y`/`out_1783695572489`/rejected・非活性・許容・整理未実施）

### 別Phase候補（どちらを先に実施するかユーザー判断待ち）
- **Output Draft Persistence**（Draft永続化＝リロード復元・PC/スマホ共有・複数成果物履歴の前提）
- **Approval POST Ordering / Last Action Wins**（POST直列化・最終状態デバウンス・stale request破棄・着順逆転対策）

### 温存（未コミット・保護対象すべて維持）
- cost関連（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝**未commit温存**（Phase54-1f非接触・stageに含めず）

### 次工程
- **docs commit（別commit・要承認）→ push（origin/main同期・要承認）→ Tag個別push（`--tags` 不使用）→ Render反映 → 本番実機確認**

---

## 【参考・完了済み】Phase54-1e Approval State Reset / Case Isolation Complete（成果物単位で必ず未承認から開始・表示バグ修正・commit済み・push未実施）

- 現在Version: **Version1（Version1.1 Connected AI Company 工程）/ Phase54-1e Complete**／本番: **未反映（push前）**
- Commit: **06d07d5**（`Phase54-1e approval state reset per output draft`）／Tag: **v1.01-phase54-1e**／**HEAD = 06d07d5・origin/main = b29be90・未Push 1**
- 変更ファイル: **`index.html` のみ**（+20・追加のみ・**server.js / DB / API変更なし / Phase54-1c同期非変更 / Phase54-1d `_mrcRerender`非変更 / Phase53非接触 / cost系非接触 / 課金なし**）

### 現在地
**Phase54-1e Approval State Reset / Case Isolation = コードcommit完了（push前）**。承認/レビュー/公開の単一グローバル状態が新規案件・案件切替・新成果物生成で初期化されず前状態を引き継ぐ表示バグを修正。承認対象は「成果物（Output Draft）」単位で、**必ず未承認から開始**する。

### 実装（index.htmlのみ・追加のみ）
- 共通リセット関数 **`resetApprovalStatesToDefault()`** 新設：3グローバル状態（`_mobileReviewState`/`_mobileApprovalState`/`_publishingReadyState`）を既定へ＋draftキャッシュ（`mobileReviewCenter`/`mobileApproval`/`publishingReady`）無効化→次回再計算（Phase54-1d整合）。`pushApprovalToServer` 非呼出・`_approvalSyncLastLocalChangeAt` 不変（Phase54-1c非干渉）・既存描画経路のみ。将来の「成果物削除→再生成」でも再利用可
- 接続5境界：`createOutputDraft`（新成果物生成）／`switchCase`・`_homeOpenCase`（案件切替・この後の既存 `scheduleApprovalSync` が当該案件を復元）／`createCase`・`createNewCaseFromForm`（新規案件）

### 非変更（安全・スコープ外）
- **Phase54-1c 同期7関数 非変更**（GET復元仕様を複雑化しない）。新規case行なし→GET 0件→復元なし→未承認維持
- **Phase54-1d `_mrcRerender` 非変更**／判定ロジック（`createMobileApprovalDraft`/`canApprove`/`_mapAllChecked`/`_mapReviewApproved`/`_mrcOverallStatus`）無変更
- 成果物単位永続化（output_id）は **Phase54-1f** へ分離

### 確認済み
- ✅ dev-check 200/200/200 / node --check 0エラー / インラインJS parse OK
- ✅ 起動時コンソールエラー0 / `resetApprovalStatesToDefault` 定義 / Phase54-1c同期5関数 typeof function / `_mrcRerender` 健在
- ✅ 合成リセット検証：承認済み汚染→reset で全既定化（decision=null/checklist空/reviewApproved=false/published=false/archived=false）＋draftキャッシュ3種=null＋`_approvalSyncLastLocalChangeAt` 不変
- ✅ Phase53 `oe-aic` 67件維持 / Phase54-1c同期diff 0 / Phase54-1d `_mrcRerender` diff 0
- ⚠️ 実ワークフローでの実操作確認（新規案件→新成果物→未承認／案件A→B切替で混入なし／同一案件の作り直しで未承認）は成果物draft生成（API課金）を伴うため未実施（push/Render反映後にユーザー実機確認）

### 温存（未コミット・保護対象すべて維持）
- cost関連（`cost-logs.json` 未commit / `claude-cost-logs.json`・`claude-quality-history.json` 未追跡）＝**未commit温存**（Phase54-1e非接触・stageに含めず）

### 次工程
- **docs commit（別commit・要承認）→ push（origin/main同期・要承認）→ Render反映 → 実機確認**
- **Phase54-1f（今後予定・別設計・要承認）**: 承認の**成果物単位永続化**（`output_approvals` に `output_id`/`draft_id` 追加＝case_id単位→成果物単位へ拡張・Phase54-1c同期を output_id キーへ整合）。DB/server.js/API/Supabase作業を伴うため Phase54-1e とは完全分離。同一案件・既存承認×新成果物の再承認（case_id単位GET復元の残課題）を恒久解決

---

## 【参考・完了済み】Phase54-1d Mobile Approval Cache Fix Complete（Mobile Approval canApprove キャッシュ無効化漏れ修正・commit済み・push未実施）

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
