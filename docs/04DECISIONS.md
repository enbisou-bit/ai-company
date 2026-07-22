# DECISIONS.md

# ENBISOU AI COMPANY - 設計判断・意思決定ログ

更新日: 2026-07-22（**Phase54 正式Complete維持**。**Decision 071・Affiliate評価 Workflow Wiring の正式化**（案件境界D-1／保存は明示追加時のみ／`sourceFingerprint` はclient生成・`caseId`と実効scopeを必ず含む／`source_fingerprint` は**グローバルUNIQUE**／保存済み行は除外不可＝A案／POST成功時の一行統合条件／`recommendation`・`source`・`channelScope`・`productIdentifier` は送らない）。**localhost実DB検証 Case1〜9 全合格・テストデータ削除済み・未commit**。以前: **Decision 070・Affiliate評価のActive一意性を商材単位へ改訂**（`case_id + channel_scope + COALESCE(product_identifier,'')`／Decision 069-3 を改訂・**旧Index廃止・新Index適用済み**／`productIdentifier` はサーバー正本・**案A厳格**／`.eq()`・`.is()` によるsubject限定無効化／Code commit **2ef2ad3**／実DB POST検証 全8ケース成功／テストデータ削除済み）。**Phase55未着手**。以前: **Decision 068・社員向上B 正式完了**（目的は13型完全統一ではなく実用上十分な定義駆動基盤完成／13型中11型移行済み／**Flyer・LP 正式保留**／Instagram収益化を最優先の判断基準／次工程＝Instagram自動運営機能）。**localhost検証完了・push前・Render未反映**・HEAD 61dde05・**Phase55未着手**。以前: **Decision 064/065・Task表示仕様変更 完了**・本番反映済み・PC/iPhone実機確認完了・HEAD **bbfbc73**・tag v1.01-phase54-task-home-overview／v1.01-phase54-task-sort-newest。先行して **Decision 063・Case成功確認契約 完了**（aed5f7d）・**Decision 060/061/062・案件系Known Issue 全Close＝Case同期系Complete**。**Phase55未着手**。以前：Decision 059・Phase54 Known Issue（Task表示不一致）Closed／Decision 058・Phase54 Hotfix／Decision 057・3b-3 Completed）

---

# Decision 071
## Affiliate評価 Workflow Wiring（保存・復元・案件境界・冪等統合）を正式化（2026-07-22）

**背景**：Phase53の Affiliate Intelligence Core は `_affiliateCases` による**メモリ保持のみ**で、案件を区別する情報を持たず、F5・案件切替で全消失していた。工程1-A／1-B-0a〜0dで永続化APIとActive一意性（商材単位）が確立したため、UIとAPIを安全に接続する必要があった。

**決定（正式）**：

1. **評価の正本単位は案件**。`_affiliateCases` は**現在表示中案件の評価のみ**を保持する（**D-1案**）。案件別Mapは採用しない（既存 ranking／Export 関数の参照先変更を強制するため）。
2. **未保存・保存中・保存失敗行は `caseId` 付きの専用退避バッファ**で案件横断に保持し、案件切替でも**消さない**。保存失敗データを**無言で消す実装は禁止**とし、再送手段を必ず提供する。
3. **保存は `addAffiliateCase()` による明示追加時のみ**。**Leader Final・Workflow完了・Export時にはPOSTしない**（Exportは読み取り操作であり副作用でDB書込みを起こさない）。
4. **案件未確定時は登録処理自体を中止**する。`recordAffiliateCase()` より前に `getCurrentApprovalCaseId()` を確認し、`null` なら**メモリへの追加・fingerprint生成・POSTのいずれも行わない**（`caseId` を持たない未所属評価を作らない）。
5. **復元は案件確定時**。`switchCase` / `_homeOpenCase` / `createNewCaseFromForm` / `_homeOpenCaseList` の4経路へ個別配線する（**相互に呼び出していないため1操作＝1GET**）。`showApp()` 時は案件未確定のため単独では機能せず、配線しない。
6. **GET条件は明示する**：`caseId`（必須）＋ **`channelScope=all`** ＋ **`activeOnly=true`**。server既定への暗黙依存を避け、保存側の実効scopeと一致させる。
7. **同一案件の再同期では表示を消さない／別案件への切替では前案件を即時クリア**する。応答待ちの間に前案件が新案件画面へ映る窓を作らない。**request token ＋ 取得時caseIdと現在caseIdの再照合**で、古い応答を破棄する。
8. **GET失敗時（`source:'fallback'|'error'`）は空配列で上書きしない**。同一案件の再同期なら表示維持、別案件切替なら**前案件を残さず**当該案件の退避行のみを表示する。
9. **`sourceFingerprint` は client 生成**とする。現行APIで必須かつ server 側生成が存在せず、`server.js` を変更しない方針のため。構成は **`affiliate-evaluation-v1:` ＋ 固定順配列**（`caseId`・実効`channelScope`・正規化商品名/ASP名・API保存値・算出結果・`detail`保存分をすべて含む）。**オブジェクトの無条件 `JSON.stringify` は使わない**。
10. **`source_fingerprint` はテーブル全体でグローバルUNIQUE**（`affiliate_evaluations_fingerprint_key`）であり、冪等判定クエリに `case_id` フィルタが無い。したがって **fingerprint に `caseId` と実効 `channelScope` を含めることは必須**である（含めないと他案件の行が `idempotent:true` で返り、自案件に保存されないサイレント欠損が起きる）。POST応答の `case_id` が要求と異なる場合は**統合せず `save_failed`** とする。
11. **fingerprint に含めない**：timestamp／`Date.now()`／random／client一時ID（`aic-*`）／`createdAt`／`updatedAt`／DB `id`／表示順の `rank`。数値は **fingerprint内でのみ小数2桁へ正規化**し（浮動小数誤差で別fingerprintにしない）、**DBへ保存する元数値は丸めない**。
12. **`productIdentifier`（対象識別・サーバー正本）と `sourceFingerprint`（再送識別・client生成）は責務を分離**し、相互に代替しない。
13. **POST body から `productIdentifier`・`channelScope`・`recommendation`・`source` を送らない**。`recommendation` は CHECK 制約が `NULL` を正式許容することを実測確認済みで、UIに採用判定が無い現段階では**値を捏造しない**。`source` は server既定 `manual` を使用し、生成元は **`detail.origin = 'affiliate-intelligence-core'`** に分離する（新しい正本値を作らない）。
14. **API未対応項目は `detail`(JSONB) へ格納**する（評価補足7項目＋`origin`＋メタ2項目）。**専用列の追加＝DDLは行わない**。
15. **DB保存済み行の除外操作は無効化する（A案）**。inactive化／PATCH／DELETE API が未実装のため、除外してもGET復元で再表示され「削除したのに復活する」誤認を生む。**未保存・保存失敗行のみ除外可**とし、保存済み行には理由を表示する。
16. **POST成功時は一時行を応答内容で更新**し、新規行を追加しない。加えて**同一caseId内**で更新対象以外の重複行を除去する：①同一`serverId` ②同一`sourceFingerprint` ③**同一`channelScope`かつ同一`productIdentifier`**。**`caseId` が異なる行・`channelScope` が異なる行は決して除去しない**。
17. **表示上限 `AIC_CASE_MAX`（50）超過分は非表示にするだけ**とし、**DBからの削除・inactive化は行わない**。

**採用理由**：案件混入は本機能で最も重大なリスクであり、D-1＋即時クリア＋token照合で構造的に排除できる／退避バッファにより未保存データの消失を防ぎつつ案件境界を保てる／fingerprintに `caseId` を含めることでグローバルUNIQUEに起因するサイレント欠損を防止／除外操作の無効化は「文言で注意を促す」より確実に誤操作を防ぐ／API shape・server.js・DBを変更せず `index.html` のみで完結し回帰リスクを最小化。

**却下した案**：`_affiliateCasesByCaseId` による案件別Map（既存 ranking／Export 関数の変更を強制）／除外を「一時除外」と表示して許可する案（再読込で復活し誤認を生む）／登録前に同一fingerprintならPOSTを止める案（サーバー側の正式な冪等結果を受け取れなくなる）。

**検証（実測）**：`node --check` OK・**dev-check 200/200/200**・**純関数 46/46 PASS**・**localhost実DB Case 1〜9 全合格**（新規保存／F5復元／案件分離／冪等でDB行数不変／再評価は旧activeのみinactive／保存済み行は POST・PATCH・DELETE 0件／失敗→同一fingerprintで再送成功／案件未確定でGET0・POST0／同一案件GET失敗で表示維持）・**console error 0**・**テストデータ限定DELETE済み `remaining = 0`**。

**Git/反映**：**未commit**（`index.html` のみ +390/-4）。HEAD = origin/main = **d270ceb**。**Phase54 Complete維持・Phase55未着手**。

**未確認事項**：通常ログイン／通常案件選択経路の実操作（テストcaseIdが実案件として存在しないため未実施）／**F5後の `save_failed` 保持は保証対象外（Known Limitation）**／Render本番POST未実施／別 `channelScope` の実運用検証未実施。

---

# Decision 070
## Affiliate評価のActive一意性を「商材単位」へ改訂（Decision 069-3 の改訂・2026-07-22）

**背景**：Decision 069-3 は業務一意を **`(case_id, channel_scope)`** の partial UNIQUE（`uq_affiliate_eval_active_case`）と定めた。しかしこの単位では、**同一案件・同一チャネル内で2商材目のactive評価を保持できない**。Instagram自動運営では「1案件の中で複数商材を比較し、それぞれの最新評価を同時にactiveで持つ」ことが前提となるため、Active一意性の単位を見直す必要が生じた。

**決定（正式）**：

1. **Active一意性を商材単位へ改訂**する。正式単位は **`case_id + channel_scope + COALESCE(product_identifier, '')` WHERE `is_active`**（Index名 **`uq_affiliate_eval_active_product`**）。
2. **旧Index `uq_affiliate_eval_active_case` は廃止**する。旧Indexを残したまま新Indexを追加しても、旧Indexの制約により2商材目のinsertが拒否され移行目的を達成できないため、**DROPが必須**である。
3. **`product_identifier` の正本はサーバー側**（`lib/affiliateEvalDb.js`）とする。生成方式は **`JSON.stringify([normalizedProductName, normalizedAspName || null])`**。
4. **案A（厳格）を採用**する。`productName` があればサーバー側で**必ず再生成**し、**client送信の `productIdentifier` は保存値として使用しない**。`productName` が無い場合は **`null`**。
5. **正規化規則**：全角空白→半角／前後空白削除／連続空白を1つへ統一／英字小文字化。**Unicode NFKC・ASP別名辞書・商品名の記号除去・商品名変更時の自動統合は採用しない**。
6. **区切り文字連結（`"商品名|ASP名"`）・hash・timestamp・random・`aic-<timestamp>` を subject key に採用しない**。`aic-<timestamp>` は既存UI／メモリ内IDとしてのみ維持する。
7. **旧active無効化は同一subject限定**とする。値ありは `.eq('product_identifier', …)`、**nullは `.is('product_identifier', null)`**。`.eq(…, null)` は一致しないため**禁止**。
8. **`_str()` 共通関数は変更しない**（他17列と共用のため）。`product_identifier` の空文字→null保証は `buildProductIdentifier()` 側で担保する（**`''` をDBへ保存しない**）。
9. **API shape は変更しない**（必須項目・キー名・レスポンス構造すべて不変。`server.js` 無変更）。
10. **Migrationの正式経路はSupabase SQL Editor**とする。Claude Code環境にはDDL実行経路が存在しない（service_roleキー／`DATABASE_URL`／`pg`／`psql`／Supabase CLI いずれも未導入）。**これらをClaude Code環境へ追加しない**方針を維持する。
11. **テストデータの後始末も Supabase SQL Editor の限定DELETE**（`WHERE case_id = '<専用テストcaseId>'`）を正式経路とする。**条件なしDELETEは禁止**。

**採用理由**：1案件×複数商材の同時評価はInstagram自動運営の必須要件であり、旧単位ではそもそも成立しない／`product_identifier` をサーバー正本にすることでPC・iPhone・将来の自動実行経路で表記揺れ重複を構造的に防止できる／JSON配列採用で区切り文字衝突を回避／NFKC・別名辞書を持ち込まないことで**誤統合による評価履歴の喪失**を避ける（誤って統合するより別subjectとして保持する方を優先）／`_str()` を変えないことで他17列への回帰リスクをゼロにする。

**却下した案**：
- **案B（折衷）**＝`productName` があれば再生成・無ければclient値を採用 — client由来の非正規化値がDBへ入り得るため却下。
- **Unicode NFKC の同時採用** — 全角`Ａ`と半角`a`の統合など影響範囲が読み切れず、今回は不採用（将来ASPの商品ID・広告IDなど安定識別子が得られた時点で再検討）。
- **ASP別名辞書**（`A8` / `A8.net` / `エーハチ` の統合） — 誤統合リスクを優先して不採用。

**検証（実測）**：`node --check` OK／**dev-check 200/200/200**／GET非回帰OK／**純関数テスト 15/15 PASS**／**実DB POST検証 全8ケース成功**（Active **5件共存**・Inactive 2件・履歴 7件・**23505なし**・**HTTP 500なし**）／**`.eq()`・`.is()` を実DBで実証**（他商材・別ASP・null↔非null を巻き込まない）／**専用テストデータ限定DELETE済み `remaining = 0`**。

**Git/反映**：Code commit **2ef2ad3**（`lib/affiliateEvalDb.js` のみ +36/-6）。**Phase54 Complete維持・Phase55未着手**。

**残タスク**：`supabase/schema.sql` への定義記録（`affiliate_evaluations` は**テーブル定義自体が未記録**）・`index.html` 側の配線（工程1-B本体）・旧active無効化→insert のトランザクション化（RPC等）は、いずれも**別工程**とする。

---

# Decision 069
## Affiliate評価の永続化方式（冪等キー・履歴保持・fallback契約）を正式化（2026-07-21）

> **【改訂注記 2026-07-22】** 下記 **条項3（業務一意＝`(case_id, channel_scope)` partial UNIQUE）は Decision 070 により改訂**され、正式単位は **`(case_id, channel_scope, COALESCE(product_identifier,''))` WHERE `is_active`**（`uq_affiliate_eval_active_product`）となった。旧Index `uq_affiliate_eval_active_case` は廃止済み。**条項1・2・4〜9は引き続き有効**。履歴保持のため原文は削除せず残す。

**背景**：Instagram自動運営の前提として、会社共通のAffiliate評価（商材・ASP・利益率・承認率・統合スコア・推奨判定など）を**案件単位で永続化**し、再評価しても過去判断を失わない基盤が必要。既存の `casesDb` / `outputDraftsDb` / `approvalsDb` と同じエラー処理・返却形式を踏襲する。

**決定（正式）**：
1. **保存先は新規テーブル `affiliate_evaluations`**（案件そのものの正本は引き続き `cases`）。
2. **冪等キー＝`source_fingerprint` UNIQUE**。同一fingerprintの再送は**新規登録せず既存行を返す**（`idempotent:true`）。
3. **業務一意＝`(case_id, channel_scope)` の partial UNIQUE WHERE `is_active`**。再評価時は**旧activeを`false`化**してから新active1件をinsertし、**履歴を物理削除しない**。
4. **`channel_scope` を将来のチャネル別拡張の軸**とする（MVPは `'all'` 固定・未指定時のみ `'all'`）。
5. **返却契約は `source:'db'|'fallback'|'error'`** を区別（Supabase未設定・障害を空配列と同一扱いにしない）。
6. **入力検証**：`recommendation` は `adopt`/`watch`/`reject` のホワイトリスト、数値は有限数のみ（不正値はnull化＝ゴミを保存しない）、`detail` は **JSONB** として構造保持。
7. **生SQL・文字列連結を使わない**（supabase-js のパラメータ化クエリのみ）。
8. **今回はGET/POSTのみ実装**。`is_active=false` への直接変更手段（PATCH/DELETE API）は**実装しない**。
9. **旧active無効化→insert のトランザクション化（RPC等）は別工程**とし、失敗時は **`activeMayBeZero:true`** で明示通知する。

**採用理由**：既存lib群の規約を踏襲して学習コストと回帰リスクを最小化／冪等キーで二重計上を防止／履歴保持により再評価の判断根拠を失わない／fallback契約でDB障害を「0件」と誤認しない／Instagram自動運営の後続工程（商材選定・投稿計画）が参照できる正本を確立。

**Git/反映**：Code commit **047f4d3**（`server.js` +34/-1・`lib/affiliateEvalDb.js` 新規110行）。**Phase54 Complete維持・Phase55未着手**。

---

# Decision 068
## 社員向上B の目的・完了条件・移行範囲・保留方針を正式化（2026-07-21）

**背景**：
- 社員向上Bはoutput型の定義分散を解消し、定義駆動基盤を完成させる改善案件。工程B-1（outputType正本化）に続き、Section定義（`OUTPUT_SECTION_DEFINITIONS`）・抽出エンジン・wrapper適用・型別移行（document/pdf/image_prompt/video_prompt/powerpoint/excel/instagram_post/instagram_carousel/tiktok_video/youtube_shorts/html）を実装した（未push 7コミット・index.htmlのみ）。
- 「13型すべてを完全統一するのか」「どこを完了とするのか」「Flyer・LPをどう扱うか」を正式に確定する必要があった。

**決定（正式）**：
1. **社員向上Bの目的は13型すべての完全統一ではない**。目的は①定義分散の解消 ②定義駆動基盤の完成 ③既存出力との互換性維持 ④Instagram自動運営・収益化開発へ安全かつ最短で移行できる状態を作ること。
2. **実用上十分な定義駆動基盤の完成をもって完了条件**とする（①定義駆動基盤が実用上十分完成 ②Instagram収益化に必要な出力型が安全に運用可能 ③既存出力互換維持）。
3. **Instagram収益化を最優先の判断基準**とする。移行の順序・範囲はInstagram収益化を遅らせないことを基準に決める。
4. **Flyer・LPは正式保留**とする。**未完了・失敗ではなく**、優先順位判断による保留。必要性が生じた時点で、社員向上Bとは別の個別工程として再評価する。
5. **13型中11型の移行完了をもって社員向上Bを正式完了**とする（完全定義駆動6：document/pdf/powerpoint/excel/instagram_post/html／ハイブリッド5：image_prompt/video_prompt/instagram_carousel/tiktok_video/youtube_shorts）。
6. **次工程はInstagram自動運営機能**（市場調査／競合分析／ASP比較／商品選定／投稿企画／カルーセル／キャプション／ハッシュタグ／Learning／投稿承認）。
7. 13型完全統一を将来の必須条件へ戻さない。

**採用理由**：Instagram収益化への移行を遅らせない／既存出力を壊さず定義分散のみ解消／保留2型を安全に切り出し後日評価可能／最小変更・低リスクで基盤を確定。

**状態**：**localhost検証完了・push前・Render未反映**（本番実機確認は未実施）。HEAD 61dde05／origin/main ac2f5da／local ahead 7。server.js／lib／DB／API／schema.sql 無変更。**Phase54 Complete維持・Phase55未着手**。

---

# Decision 067
## outputTypeの正本・正規化境界・フォールバックを正式化（2026-07-20）

**背景**：
- `OUTPUT_TYPES` と `draft.type` は既に事実上の正本だったが、DB復元・保存・表示・学習周辺で `document`／`unknown`／`null`／`—` が混在していた。
- `normalizeOutputDraft()` は type値を正規化していなかった（警告のみの `validateOutputDraft` は補正しない）。
- 後続B-2／B-3が機械参照可能な列挙保証値を必要とする。

**決定（正式）**：
1. `OUTPUT_TYPES`（13種）を正式内部値の正本とする。
2. `_lastOutputDraft.type` をランタイム正本とする。
3. `output_drafts.type` を永続化正本とする。
4. `OUTPUT_TYPE_DEFINITIONS` を表示定義正本とする。
5. `outputType` は `draft.type` の派生値（**新たな並行正本を作らない**）。
6. `normalizeOutputType()` を正規化関門とする（正式値はそのまま・legacy alias 9件のみ許可）。
7. 未知・空・null・undefined・unknown は `document`。
8. 曖昧な自然言語（instagram/insta/ig/reel/video/post/carousel）は alias化せず `detectOutputType()` へ委ねる。
9. **DB CHECK制約は追加しない**（既存本番DBへ差分適用しない方針を踏襲）。
10. `genre === outputType` 結合（`selectRelevantKnowledge`）は今回変更しない（B-2以降の別調査）。
11. Learning／品質履歴の観測値 `unknown` は成果物正本とは別責務として残す。

**採用理由**：新しい正本を作らず既存構造を利用／DB・API・Case同期・PC⇔iPhone同期へ波及しない／後続B-2・B-3の前提を安全に整備／最小変更・低リスク。

**Git/反映**：Code commit **066241f**・tag **v1.01-phase54-output-type-normalization**（index.htmlのみ +40/-7）。**Phase54 Complete維持・Phase55未着手**。

---

# Decision 066
## Cost DB Opening Balance の一意性設計・23505処理・schema.sql の位置づけ（2026-07-19）

**背景**：Opening Balance 登録時、実DBの部分UNIQUE `uq_api_cost_ob_active_legacy`（`(balance_type) WHERE is_active`・provider非包含）により、Claude を同一 `balance_type=historical_usage` で登録すると 23505 で衝突し、現行の `source_fingerprint` 再SELECTでは救済できないことが判明。read-only 調査（ローカル → 実DB introspection）で制約定義を確定した。

**決定（正式）**：
1. **業務一意性 = `(provider, balance_type) WHERE is_active`**（部分UNIQUE `uq_api_cost_ob_active_provider_type`）。provider別に active な Opening Balance を1行保持。**旧 `uq_api_cost_ob_active_legacy` は廃止**。
2. **技術的冪等キー = `source_fingerprint` UNIQUE**（`api_cost_ob_fingerprint_key`・金額は含めない）。業務一意性とは別レイヤ。
3. **23505 処理 = 二段階照合**：① `source_fingerprint` で既存確認（冪等）② `(provider, balance_type, is_active)` で既存確認（業務競合＝`OPENING_BALANCE_ACTIVE_CONFLICT`・誤existingにしない）③ 特定不能なら元23505保持。**INDEX名の文字列解析には依存しない**。
4. **Claude Opening Balance = 319.57円**（`$1.997365 × 160`（静的会計レート `USD_TO_JPY`）`− 既存Cost Event 0.01円`）。為替は静的レート採用・外部為替API不使用。
5. **`supabase/schema.sql` は空DB再構築・定義記録用**であり、本番DBへ自動適用する migration ではない／既存本番DBへの差分適用には使用しない（既存 output_* と同方針）。実DDLは Supabase SQL Editor で手動適用済み。

**Git/反映**：commit **81a5288**・tag **v1.01-phase54-cost-db-complete**（`lib/costDb.js`＋`supabase/schema.sql`）。**push未実施**。**Phase54 Complete維持・Phase55未着手**。

---

# Decision 064
## ホームでは全案件Taskを表示する（Decision 054 の表示仕様を改定）

**背景**：Phase54 Hotfix の Task側 PC⇔iPhone 実機確認で「PCで作成したTaskがiPhoneの案件画面には出るが、**ホームでは『タスクはありません』・バッジも0**」と報告された。調査の結果、**Task同期・DB保存は正常**であり、**Decision 054 の表示仕様（ホーム・案件未選択＝`case_id=NULL` 横断Taskのみ）どおりの動作＝不具合ではない**と確定。ただし「ホームで会社全体のタスクが0件に見えるのは実運用に反する」というユーザー判断により、**表示ポリシーのみを改定**する。

**決定（正式・改定対象＝Decision 054 の表示仕様のうち「ホーム＝NULL横断のみ」）**：
- **ホーム＝全案件Task＋`case_id=NULL` 横断Task**（会社全体のTaskを俯瞰する画面とする）
- **案件画面＝選択案件Task＋`case_id=NULL` 横断Task**（**他案件のTaskは表示しない**＝案件別分離を維持）
- **最新一覧／案件一覧＝`case_id=NULL` 横断Taskのみ**（現状維持）
- **Timeline／Notification／Task History は変更しない**（ホームでは従来どおり横断のみ）
- **一覧・Progress・バッジ・診断は同一の可視集合で計算する**（**「バッジだけ全件」は禁止**＝Phase54 Hotfix の件数統一方針を継承）
- **`tasks.case_id` のデータ構造・保存・同期は一切変更しない**（Decision 054 のデータ分離は不変。変更するのは**表示ポリシーのみ**）

**実装（なぜこの形か）**：
- **ホーム判定は `currentMember === null` に限定**（`_taskIsHomeView()`）。`_taskViewCaseId() === null` は「ホーム」と「担当選択中＋案件未選択（最新一覧/案件一覧）」の**両方で真**になるため、それだけで判定すると**最新一覧でも他案件Taskが出てしまい**「案件画面では他案件を表示しない」に抵触する。
- **`_taskInCurrentView()` にホーム分岐を追加**し、**`renderTaskList()` のインライン重複判定を同関数へ統一**。
- ⚠️ **重要**：`renderTaskList()` は `_taskInCurrentView()` を**呼ばずに同じ判定を複製**していたため、`_taskInCurrentView()` だけを変更すると **Progress・バッジ・診断だけが全件になり一覧は0件のまま＝件数不一致**が発生するところだった。判定を**単一の真実の源**へ集約したことで、4者の一致が**構造的に保証**される。
- **`_taskViewCaseId()` は変更しない**（`_historyVisibleInView()`／`_timelineEventVisibleInView()` が共有しており、変更すると Timeline・Task History・Notification へ波及するため）。

**副作用（仕様として許容）**：ホームでは **Taskは全件／Timeline・Notification・Task History は横断のみ**という粒度差が生じる（Timeline等の仕様変更は今回対象外のため）。

**Git/反映**：commit **5fe2b64**・tag **v1.01-phase54-task-home-overview**・**index.htmlのみ（+15/-5）**。server.js・lib・DB・API・SQL・Task同期・backfill・削除/アーカイブ同期・Timeline・Notification・Task History は**すべて無変更**。dev-check 200/200/200・console 0・本番反映済み・**PC/iPhone実機確認完了**・**DB無変更**。

---

# Decision 065
## Task一覧は `createdAt` 降順を正式仕様とする（PC・iPhone同一順序）

**背景**：PCは「上が最新→下が過去」、**iPhoneは「上が過去→下が最新」**と並び順が逆転していた。調査の結果、**`renderTaskList()` にソートが存在せず**、`tasks` 配列の順序をそのまま描画していたことが原因と判明。配列への追加が2系統に分かれている：

| 追加方法 | 対象 | 入る位置 |
|---|---|---|
| `tasks.unshift(...)`（7か所） | **自端末で作成**したTask | **先頭＝上** |
| `tasks.push(mapped)`（`syncTasksFromServer` merge） | **他端末で作成**され同期で届いたTask | **末尾＝下** |

→ PC（`unshift` 主体）は上が最新、**iPhone（同期受信＝`push` 主体で新しいTaskほど末尾に積み上がる）は下が最新**となり、**表示順が「端末の操作履歴」に依存**していた（仕様ではなく構造上の欠陥）。

**決定（正式仕様）**：
- **Task一覧は `createdAt` 降順**（**上が最新・下が過去**）。**PC・iPhoneで同一順序**を保証する。
- **同一 `createdAt` は `id` を第2キー**として順序を固定（安定ソート）。
- **archived一覧も同一ソート**。
- **`updatedAt` は使用しない**（状態変更のたびに順序が動いてしまうため。案件一覧が `updatedAt` 順なのとは意図的に異なる）。
- **表示のみの変更**：`renderTaskList()` の**表示用 `filtered` のみ**を並べ替える。**`tasks` 配列本体・`unshift`/`push`・同期・backfill・localStorage・DB は一切変更しない**。

**なぜこの設計か（却下案）**：
- **`tasks.push` → `unshift` へ変更：却下**。同期の受信順に依存する点は変わらず**根本解決にならない**うえ、merge／Server-Authoritative Reconciliation への影響が大きい。
- **`loadTasks()` でソート：却下**。保存データの並べ替え＝**localStorage書き換え**が発生し、表示だけの問題に対して過剰。
- **`renderTaskList()` でソート：採用**。表示専用・データ非接触・端末非依存・最小変更（+10行）。既存コードでも案件一覧（`updatedAt` 降順）・Timeline・Notification が同方式（`localeCompare`）でソートしており**一貫**する。
- **Timeline／Notification／Task History は非接触**（各自が独自に `.sort()` 済みで `tasks` 配列に非依存）。Progress・バッジ・診断は件数のみ算出し順序を使わないため影響なし。

**Git/反映**：commit **bbfbc73**・tag **v1.01-phase54-task-sort-newest**・**index.htmlのみ（+10・追加のみ）**。確認：症状を再現した配列（PC想定＝新→古／iPhone想定＝古→新）から**同一の描画順へ統一**されることを実証／実データ253件で降順・同着はid固定・**`tasks` 配列本体が不変**／dev-check 200/200/200・console 0・本番配信コード一致（`tasks.sort(` 0件）・**PC/iPhone実機確認完了**・**DB無変更**（テストTaskの作成/削除/アーカイブなし）。

---

# Decision 063
## Case Success Contract — 案件の作成・削除を「成功確認型」へ統一する（`data.ok` 検証・再送1回・local保持）

**背景**：案件系Known Issue Close後も、`pushCaseToServer` は `fetch(...).catch(() => {})` で**失敗を完全に握り潰し**、`res.ok` も `data.ok` も検証していなかった。POST失敗が無音のため **local-only案件が再発し得る**構造が残っていた（②-Aで「削除」は成功確認型にしたが「**作成(push)」は未対策**）。調査でさらに2点が判明：
- **P4**：サーバは Supabase 失敗時も **HTTP 200 + `{ ok:false }`** を返す（`res.json({ ok: !result.error, error })`）。→ **HTTP status だけでは成否を判定できない**。
- **P5**：`deleteCaseFromServer`（②-A実装）が **HTTP status のみ**で判定していたため、Supabase障害時に `200 + ok:false` を**成功と誤判定 → localから削除 → DBは未削除 → 次回同期の merge で案件が復活**する穴があった（「削除したのに復活する」＝Close済み不具合の再現条件）。

**決定（採用＝A案・作成と削除の両方に適用）**：
- **POST成功確認**：`pushCaseToServer` を成功確認契約へ変更し、`{ ok, status, reason }` を返す（`deleteCaseFromServer` と同形）。
- **`data.ok` 確認**：成功判定は **`res.ok === true` かつ JSON解析成功 かつ `data.ok === true`** の3条件（P4対策）。JSON解析失敗は成功と見なさない。
- **local保持**：**作成は成否に関わらず local案件を常に保持**する。POST結果でユーザーの案件を消さない（＝削除とは意味論が反転する。削除は「成功後のみlocal反映」、作成は「localは常に残す・同期は事後確認」）。
- **再送1回**：5xx・通信失敗・`200+ok:false` のみ**最大1回だけ再送**（合計2回・**無限再試行禁止**＝Task backfill方針を踏襲）。**4xxは再送しない**（`id`/`title` 欠落等は再送しても直らない）。
- **通知は案件作成のみ**：`createCase` から `{ notifyOnFail:true }`。**`touchCase` 経由では通知しない**。
- **`touchCase` 通知禁止の理由**：`touchCase` は**メッセージ送信のたびに発火**するため、オフライン時に通知が連発し**通知スパム**になる。案件作成は低頻度の意図的操作なので都度通知が適切、`updatedAt` 同期の失敗は軽微で次回成功時に収束する。
- **delete側も同契約**：P5を同工程で解消。**404 は `data.ok` 判定より先に返す**（404の本文は `ok:false` のため）＝local-only として local削除可。それ以外は3条件のみ成功。**`200+ok:false`・5xx・通信失敗は失敗＝localを保持して既存通知**。
- **DB変更なし・API変更なし**：既存 `POST /api/cases`＋`upsertCase`（`onConflict:'id'` で冪等）をそのまま利用。SQLなし・新規エンドポイントなし。

**なぜこの設計か（却下案）**：
- **B案（`_unsynced` フラグ＋起動時backfill）は却下**。②-B backfill（対象なしでClose済み・Decision 062）の機構（上限・in-flightロック・セッション1回・復活防止）を丸ごと再導入することになり、**Close判断と矛盾**する。加えて `touchCase` による自己修復パス（メッセージ送信ごとに同一idを冪等再POST）が既に存在し、恒久的にlocal-onlyで残るのは「作成後に一度もメッセージを送っていない案件」に限られるため、追加の複雑さに見合わない。
- **C案（通知のみ・再送なし）は却下**。一過性の通信ブリップを救えない（再送1回で大半は救える）。
- **`createCase` の async 化は不採用**。呼び出し元 `createNewCaseFromForm` の同期的な `cases[caseId]` 参照が壊れるリスクを避け、変更を最小に保つ。`await` しない設計により**UIをブロックしない**（案件作成の体感速度は不変）。

**効果**：一過性の通信断は**自動再送で救済**、恒久的失敗は**ユーザーが即座に認知**でき、**local-only案件の再発を防止**。あわせてP5解消により、Supabase障害時に削除が黙って失敗して案件が復活する事故を防ぐ。

**Git/反映**：commit **aed5f7d**・tag **v1.01-phase54-case-sync-contract**・**index.htmlのみ（+48/-11）**。`_postCaseOnce` 追加／`pushCaseToServer` async契約化／`_notifyCasePushFailed` 追加／`createCase` の呼び出しへ `{ notifyOnFail:true }`／`deleteCaseFromServer` に `data.ok` 検証追加。server.js・lib・DB・API・SQL・`createCase` の同期性・`createNewCaseFromForm`・`touchCase`・Case merge/prune・Task同期・Task History・Notification・Timeline・Approval・Output Draft・Cost・Phase53 は**すべて無変更**。確認：dev-check 200/200/200・console 0・localhost/本番とも fetchスタブで全ケース合格（最大試行2回以内）・**本番DB無変更（生存1/削除済み2/計3行）**。**Phase54 Complete維持・Phase55未着手**。

---

# Decision 060
## 案件の作成は「新規案件」操作のみ — Leader Dispatchでは自動作成しない・未選択時は横断

**背景**：Phase54完了後の本番実機で、既存案件で会話中に**会話1ターンごとに新案件が増える**現象が発生。原因は `handleLeaderDispatch()` が振り分けのたび**無条件で `createCase(userText, assignedIds)`** を呼び、かつ `createCase` の重複判定が**送信本文（userText）基準**だったため、本文が変わるたび別案件として生成されていた（生成分は `pushCaseToServer` でDBにも流出）。一方ユーザー発言・AI返答は `_ncActiveCaseId` 基準で元案件に保存されるため、「同じ会話が元案件と新規案件の両方にある」ように見えていた。

**決定（正式・案件作成ルールの固定）**：
- **案件は「新規案件」操作（`createNewCaseFromForm`）を行った場合だけ作成する**。
- **既存案件を開いている場合**、Leaderへの追加指示・修正・再生成は**現在の案件を継続使用**する。
- **「最新一覧」「案件一覧」「案件未選択」でLeaderに話しかけても新規案件を自動生成しない**。その会話は **`caseId=null` の横断チャット**として扱う（＝(b)案採用。(a)「未選択時のみ1件自動生成」は不採用）。
- **会話文・依頼文・成果物タイトル・dispatch を理由に案件を自動作成しない**。
- 併せて、**案件未選択時に既存案件へ勝手に書き込まない**ことを徹底：`saveCaseMemory` の「先頭案件フォールバック」を停止（未選択時は保存しない＝他案件への誤保存防止）／`touchCase` の「先頭案件フォールバック」を停止（横断時は既存案件の `updatedAt`・並び順・`pushCaseToServer` を発火させない）。
- 横断Taskのタイトルは `[横断]` 表示（`[undefined]` 防止）。横断Taskの `caseId` は `null`＝Task Case Scoping の「NULL=横断」と整合。

**なぜこの設計か**：案件は「ユーザーが意図して立てる単位」であり、会話本文という**変動する値をキーに自動生成するのは構造的に誤り**。横断（null）は Messages（`messages.case_id`）・Task（`tasks.case_id`）で既に「case固有処理をしない」意味として確立しており、案件未選択時の会話をNULL扱いにするのが既存設計と一貫する。case memory は case固有構造で横断（null）の受け皿が無いため、**横断時は保存しない**を選択（新たな横断Memory基盤は追加しない）。

**Git/反映**：commit **f36762c**・tag **v1.01-phase54-known-issue-case-auto-create**。**index.htmlのみ4行**（@8081/@8149/@10050/@10116）。`createCase()` 本体・`createNewCaseFromForm()`・server.js/lib/DB/API/SQL は**無変更**。本番反映後に増殖停止を確認（当初の再現は本番が旧コード配信のままだったことが `curl` 実測で判明）。

---

# Decision 061
## Case削除同期は A案 — `deleted_at` 論理削除＋`deletedIds` によるServer正本化

**背景**：PCとiPhoneで案件数が一致しない（実測当時 DB=2／PC=15／iPhone=5 の三者不一致）。原因は、削除4経路はDBへ同期していたものの**物理DELETE**のため tombstone が残らず、`mergeServerCases` が他端末の削除を知る手段を持たなかったこと（＝削除が永久に伝播しない）。加えて `pushCaseToServer` の失敗握り潰しで local-only 案件が堆積していた。

**決定（採用＝A案）**：
- **`cases.deleted_at`（nullable）による論理削除**。**物理削除は禁止**（行は残す・`deleted_at=NULL` で復元可）。
- **全件GET（memberId未指定）時のみ `deletedIds` を返す**（部分GETは常に空＝誤prune防止）。`cases` は生存のみ返す。
- クライアントは **`deletedIds` に明示されたidだけ local から除去**する。**「GET結果に無い＝削除」とは推論しない**。
- **local-only案件は保護**（DBに行が無い＝tombstoneも生成されない＝構造的にprune対象になり得ない）。
- **削除は成功後のみ local へ反映**：200（冪等の `alreadyDeleted` 含む）＝local削除／**404＝DBに行なし（local-only）につきlocal削除可**／**5xx・通信失敗＝localを残す＋ユーザー通知**。**削除4経路すべて同一契約へ統一**。
- `upsertCase` は `deleted_at` を書かない＝**削除済み行へ他端末の `touchCase` が来ても復活しない**。
- **`messages`／`conversations`／`task_history`／Learning は非連動・非削除**（履歴保護）。

**なぜA案か（B案・C案の却下理由）**：
- **B案（物理DELETE維持＋GET結果に無い案件をlocalから除去）は却下**。実測 DB=2／PC=15 の状況で適用すると**PCの約13件が即時消失**し、「local-only案件を失わない」に真っ向から反する。「削除された」と「まだpushされていない」を**区別する手段が無い**ため構造的に不可。
- **C案（別テーブル／別レスポンスで削除IDを配信）は却下**。同じ効果に新規テーブル＋index＋RLSが必要でコストが高く、`cases` と tombstone の**二重管理による整合リスク**を負う。
- A案は **Task削除同期（Decision 058）の実績パターン**（`tasks.deleted_at`＋`deletedIds`＋Server-Authoritative Reconciliation＋local-only保護）を踏襲でき、`lib/tasksDb.js:getTasks` が参照実装として既存。**可逆**で「Supabase保存維持・物理削除しない・履歴削除禁止」の既存方針と完全に整合する。
- `cases` は **client生成の id がそのままDBのPK**（Taskの local id / dbId 分裂が無い）ため、prune・重複防止が id 一致で完結し、Taskより単純かつ安全。

**Git/反映**：commit **ad83544**・tag **v1.01-phase54-known-issue-case-delete-sync**・4ファイル（`supabase/schema.sql`／`lib/casesDb.js`／`server.js`／`index.html`）。**SQL（ユーザー実行済み・非破壊）**：`ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;`＋`CREATE INDEX IF NOT EXISTS idx_cases_deleted_at ON cases (deleted_at);`。`GET /api/cases` は `cases` 配列の形不変＝後方互換／`DELETE /api/cases/:id` はパス・IF不変・新規エンドポイントなし。**PC⇔iPhone双方向の削除伝播をユーザー実機確認済み**。

---

# Decision 062
## Case Backfill は診断先行方式（C案）— 実測0件につきBackfill未実装Close・診断は温存

**背景**：local-only案件をDBへ登録（backfill）する必要があるかを判断するには、各端末のlocalStorageの中身を知る必要があった。しかし**②-A以前に物理削除された案件には tombstone が存在しない**ため、「(a)一度もpushされていない正常案件」「(b)他端末で物理削除された残骸」「(c)不具合①由来のゴミ」が**まったく同一の状態（survivorsにもdeletedIdsにも無い）**となり、データから区別できなかった。

**決定（採用＝C案・診断先行）**：
- **A案（起動時に自動backfill）は却下**。(b)を判別できないため**削除済み案件を復活させる**ことが確実で、「区別できない状態で自動実行しない」に違反する。起動時フラッドの再発リスク（Task 75→354 の前例）もある。
- **B案（確認画面で選択実行）も先行させない**。判断材料（診断結果）が無い状態でユーザーに選ばせることになる。
- **C案を採用**：**読み取り専用の診断のみ**を実装し、DB状態（生存／削除済み／local-only）・推定区分（正常案件の可能性／不具合①由来の疑い／判定不能）・推奨アクション（Keep／Review／Remove候補）・`msgCount` を提示。**発行HTTPは `GET /api/cases` の1本のみ**（POST/PATCH/DELETE 0件）・**localStorage不変**・**実行系ボタンを置かない**・**推定は「疑い」「可能性」と明示**（signal内訳と score を併記）。
- **PC×iPhone の突き合わせを判断の要**とする：never-pushed案件は**作成した端末にしか存在し得ない**ため、「両端末にlocal-onlyで存在＝過去にDB経由で伝播した＝物理削除残骸の可能性が高い」「片端末のみ＝push未達＝backfill候補」と推論できる。単独端末では解けない曖昧さが2端末比較で解消する。

**実測結果（PC・iPhone双方・完全一致）**：**DB生存1／DB論理削除済み2（合計3行＝物理削除なし）／PC local 1／iPhone local 1／local-only 0／Review 0／Remove候補 0**。**DB生存 = PC = iPhone の三者一致**。

**結論**：
- **②-B-2 Backfill は対象なしのため未実装Close**（local-only 0件＝登録すべき案件が存在しない。**1件もDBへ書き込まずに結論に到達**）。
- **②-C 残骸整理は対象なしのためClose**（Remove候補 0件）。残骸は、不具合①修正で増殖が停止し、②-Aの削除契約（DB行ありは論理削除→`deletedIds`で両端末prune／DB行なしの local-only 残骸は 404→local削除可）により**②-Aの設計が先に解消**した。
- **`DEBUG_CASE_DIAG = false` で本番非表示とし、診断ロジックは削除せず温存**（再調査時 `true` で復活）。PhaseD-1 の `DEBUG_TASK_SYNC`（Decision 059）と同一方式に揃える。読み取り専用＝リスクゼロの再調査資産として残す。

**残存リスク（別工程）**：`pushCaseToServer` は現在も **fire-and-forget（失敗握り潰し）** のままであり、POST失敗時に local-only 案件が**再発し得る**。②-Aで「削除」は成功確認型にしたが「**作成（push）」は未対策**。次工程候補とする。

**Git/反映**：診断 commit **7c7d6ff**・tag **v1.01-phase54-known-issue-case-diagnosis**（index.htmlのみ+226・読み取り専用）。Close処理は `DEBUG_CASE_DIAG=false`＋docs更新。

---

# Decision 059
## Phase54 Known Issue — Task field merge の項目別 Server正本化（PC⇔iPhone Task表示一致）

**背景**：Phase54完了後、ユーザー実機で PC badge47/iPhone badge13 の Task表示不一致が顕在化。診断（PhaseA-0/A-1）で **GET /api/tasks=233・同期正常**を確認し、原因は Task field merge が単一 `updatedAt` の newer-wins で archived/caseId/rich status を一括処理していたため、端末ローカルの archived（iPhone 52件）・caseId が Server同期後も温存されていた（PhaseA-2で確定）。

**決定（正式・merge項目の責務分離）**：
- **Task存在・deleted は既存どおり Server正本**（deletedIds/deletedSignatures/reconciliation・変更なし）。
- **dbId一致Taskの `archivedAt` は Server正本**（newer-wins非依存・PhaseC-1）。stale archived を解除し端末間一致。
- **dbId一致Taskの `caseId` は Server正本**（newer-wins非依存・PhaseC-2）。
- **dbIdなし local-only Task は local保護**（merge対象外・Serverへ勝手に消さない/変えない）。
- **rich status（working/reviewing/consulting/strategy等）とその他フィールド（title/body/priority/member/updatedAt）は既存 newer-wins 維持**（進行状態を降格しない）。archived収束時も status は archived⇄非archivedのみで、`previousStatus` 等の新項目は追加しない。
- **診断コードは削除せず `DEBUG_TASK_SYNC=false` で温存**（本番非表示・再調査時 true で復活・PhaseD-1）。
- **Phase55 は別承認まで開始しない**。

**なぜこの設計か**：archived/caseId は「端末共通の事実（DB列で管理）」＝Server正本が正しい。rich status は server語彙（pending/in_progress/done）に無くlocalの進行状態＝newer-wins保護。項目別に責務を分けることで、PC/iPhone収束・local-only保護・rich status保護・件数233維持・backfill非再発・F5/再ログイン後の再発防止を同時に満たす（A案の全項目Server正本＝rich status降格は不採用）。

**Git/反映**：PhaseC-1 commit 0ed68e4・tag v1.01-phase54-known-issue-c1／PhaseC-2 commit 6f0816a・tag v1.01-phase54-known-issue-c2／PhaseD-1 commit a5bbe27（tagなし）。本番確認：PC=iPhone view69/badge69・total233/archived1/todo232・件数減少なし・診断本番非表示。index.htmlのみ・server.js/lib/DB/API/SQL/Supabase 非接触。

---

# Decision 058
## Phase54 Hotfix — 削除/アーカイブ同期・backfill安全化・Task生成上限・件数統一（Phase54完了後Known Issue対応）

**背景**：Phase54 正式Complete 後、ユーザー実機で Task同期の Known Issue（削除がPC⇔iPhoneで同期されない・削除がF5等で復活・一覧/Progress/バッジの件数不一致・backfill重複）が顕在化。調査で backfillによるTask急増（75→354）と Task生成10件制限も判明。**Phase54 Completed と既存 tag は維持し、Hotfix として対応**（Phase55 未着手も維持）。

**決定（なぜその設計か）**：
- **削除は物理DELETEせず論理削除（`deleted_at`）**：Supabase保存維持・履歴削除禁止の原則に整合。復元可能・監査可能。**Task History・Learningは連動削除しない**（`task_history.task_id` と `tasks.id` は別体系＝JOIN連動削除しない）。
- **アーカイブは削除と分離し `archived_at` で管理**：「通常一覧から一時的に外す・後で戻せる」操作を端末間同期。削除（最終）と役割を分ける。
- **同期は dbId限定 Server-Authoritative Reconciliation**：全件GETのみauthoritative・`deletedIds`/`deletedSignatures`で削除伝播・**local-only（dbIdなし）Taskは保護**・GET失敗時はlocal不変。
- **backfillは安全ガード（B案）**：起動時フラッド（今回の急増主因）を防ぐため、server同期後1回・local重複除外・POST上限20超過で自動停止＋通知。**A案（自動停止）ではなくB案採用**＝未同期Taskの保存機会は残しつつ暴走を防止。
- **Task生成上限とbackfill上限は別管理**：`/api/auto-task` は 10→20（Instagram運用考慮・無限ループ防止は維持）、backfillは安全上限20。混同しない。
- **件数は一覧/Progress/バッジを同一可視集合（現在案件＋NULL・deleted除外・archived除外）**で統一＝同一画面内の不一致を解消。

**データ整理**：重複候補123件は **JSON/CSV退避後に id限定 `deleted_at` 論理削除**（物理削除しない）。生存233・deletedIds125。元75・正当156は保護。正当156の個別整理は未実施。

**Git/反映**：commit **d512bad**・tag **v1.01-phase54-hotfix-task-sync**・**HEAD=origin/main=tag=d512bad**・Render反映済み・本番確認済み。**ユーザー実機確認は未実施**。`backup-dup-candidates-20260714/` はローカル退避・Git対象外。cost関連3ファイルは対象外・未操作。

## 目的
このファイルは「何を作ったか」ではなく、
「なぜその設計にしたのか」を記録する。

新しいチャットでは、このファイルを読むことで
設計思想を維持したまま開発を継続する。

---

# Decision 001
## AI会社の目的
AI会社はチャットAIではない。
回答ではなく、完成成果物を納品する会社を作る。

成果物例
- Instagramスライド / 投稿文 / 画像生成
- 動画生成 / チラシ / LP / HTML / PDF

---

# Decision 002
## Workflow固定

User → Leader → Company Brain → Knowledge → Workflow
→ AI社員 → Reviewer → Strategy → Leader Final → 完成成果物

この順序は原則変更しない。

---

# Decision 003
## モデル役割

Leader : OpenAI
Writer : Claude
Reviewer : Claude
Strategy : Claude

担当ごとの役割分担を維持する。

---

# Decision 004
## 成果物品質優先

速度より品質。

必要ならAI社員同士で相談し、
完成度を高めてから納品する。

---

# Decision 005
## 絶対ルール

・既存機能は壊さない
・削除禁止 / 追加のみ
・課金はユーザー許可制
・学習データ削除禁止
・Supabaseを維持
・git push禁止
・npm install禁止
・DBスキーマ変更禁止

---

# Decision 006
## Phase完了条件

1. dev-check 200/200/200
2. ブラウザ実機確認
3. Git Commit（ASCII短文）
4. Git Tag
5. 完了レポート

すべて終わって初めて完了。

---

# Decision 007
## ドキュメント運用

毎チャット開始時
1. 06HANDOVER_NEXT_CHAT.md
2. ENBISOU_AI_COMPANY_MASTER.md
3. PHASE_PROGRESS.md
4. CLAUDE_RULES.md
5. PROJECT_STATUS.md
6. DOC_UPDATE_PROTOCOL.md
7. DECISIONS.md

を読んでから開発を開始する。

チャット終了時はこれらのファイルを最新版へ更新する。

---

# Decision 008
## 今後追加する判断

このファイルには今後も、
- なぜその仕様にしたのか
- 却下した案
- 採用した理由
- 大きな設計変更

を追記し続ける。

このファイルはAI会社の「設計思想の履歴」である。

---

# Decision 009
## Phase44以降は成果物能力を最優先とする

Phase43でWorkflow Live（リアルタイム実行状況の見える化）が完成版に達した。

Phase44以降は、UIの見える化よりも「成果物を完成させる能力」を優先する。

対象成果物
- Instagramカルーセル（スライド10枚・キャプション・CTA・ハッシュタグ）
- チラシ（コピー・デザイン指示・画像生成プロンプト）
- LP（構成・コピー・HTML）
- 動画（企画・台本・画像プロンプト・動画プロンプト）
- PDF生成 / HTML生成

追記日: 2026-06-28（Phase43完了直後）

---

# Decision 010
## Knowledge注入はLeader contextへ安全に追記する

Phase45-7において、Injected KnowledgeをLeaderへ渡す方式を決定。

採用方式：
- `getRoutedKnowledgeContext('leader') + getInjectedKnowledgeContext()` の連結
- 既存Routing Knowledge（Phase25実装）を置換しない
- Injected Knowledgeを後ろに追記するだけ

理由：
- 既存Routing Engine（routeKnowledgeForMember）との競合を避ける
- Injected Knowledgeはあくまで補足情報
- 既存Knowledge Engineの優先順位を変えない

追記日: 2026-06-28（Phase45-7完了）

---

# Decision 011
## SNS自動投稿は後回しにする

Phase46以降の方針として決定。

理由：
- 自動投稿は課金・外部API連携が必要で承認制にする必要がある
- まず投稿直前までの成果物品質を高めることが優先
- 品質の高い画像プロンプト・動画プロンプト・投稿文・CTA・構成が先決

採用方針：
- 画像生成プロンプト作成：自動OK
- 実際の画像生成：ユーザー承認後
- 動画生成：ユーザー承認後
- SNS投稿：ユーザー承認後（現時点では実装しない）

追記日: 2026-06-29（Phase46-3完了）

---

# Decision 012
## Knowledge Compare Modeで品質効果を測定する

Phase46-3において、Knowledge注入の効果を比較できる3モードを実装。

with_knowledge: Injected Knowledge + Leader Execution Guide → Leaderへ渡す（通常）
without_knowledge: Knowledge取得・表示はするがLeaderへ渡さない（比較用）
guide_only: Leader Execution Guideのみ渡す（中間案）

理由：
- Knowledge注入が実際に成果物品質に寄与しているか検証が必要
- 同一依頼でモード切替して比較することで効果を定量評価できる
- 将来的にベストモードを自動選択する基盤になる

追記日: 2026-06-29（Phase46-3完了）

---

# Decision 013
## Claude Code 実装指示書の最終出力形式を正式仕様とする

Phase46-5前のドキュメント整備として、Claude Code へ渡す実装指示書の出力形式を正式仕様化。

採用方針：
- 最終実装指示書は通常テキスト形式で出力する（Markdownコードブロックで囲まない）
- ヘッダー「これをそのままClaude Codeへ貼ってください。」を必ず付ける
- 出力順序：① 改善案（必要時のみ）→ ② 最終実装指示書（1つだけ）
- 指示書構成順序を固定：目的→絶対ルール→実装内容→詳細仕様→ブラウザ確認→完了条件→Git→完了レポート
- コピーボタン1回でそのままClaude Codeへ貼り付けられる状態を維持する

理由：
- 毎Phase同じフォーマット・同じ品質で指示書を出力するため
- コピー性を高め、ユーザーの貼り付け操作を1回に統一するため
- 改善案と最終指示書の混在による混乱を防ぐため

参照: docs/08CLAUDE_PROMPT_TEMPLATE.md v1.1

追記日: 2026-06-29（Project Rule v1.1）

---

# Decision 014
## Compare Log を分析エンジン（Compare Intelligence）へ発展させる

Phase46-5において、単なる記録だった _knowledgeCompareLog[] を分析エンジンへ発展させた。

採用方針：
- analyzeCompareIntelligence() で mode別/outputType別/InjectionImpact を集計
- _lastCompareIntelligence に結果を保存（再利用可能）
- buildCompareIntelligenceHtml() で Output Engine に分析パネルを表示
- Export（markdown / json）に Compare Intelligence を自動反映
- _compareIntelligenceSummary は作らない（変数名を _lastCompareIntelligence に統一）

理由：
- Compare Log が蓄積されても読み解けなければ改善に繋がらない
- Winner Mode / InjectionImpact / recommendations を自動生成することで、AI会社が自己診断できる
- 将来的に recommendations を Workflow に自動反映する基盤になる

追記日: 2026-06-29（Phase46-5完了）

---

# Decision 015
## Compare Intelligence の分析結果を Recommendation Engine として具体的な改善提案へ変換する

Phase46-6において、Compare Intelligence（Phase46-5）の分析結果を「次に何をすべきか」の具体的改善提案へ変換するエンジンを追加した。

採用方針：
- buildCompareRecommendations() で priorityItems / outputTypeRecommendations / knowledgeRecommendations / reviewerHints / learningHints / cautionItems を生成
- getCompareRecommendationPriority() で high / medium / low を判定（winnerMode / injectionImpact / outputTypeスコアを基準に）
- Knowledge / Learning / Memory は自動変更しない（表示とExportのみ）
- _lastCompareRecommendations に結果を保持（再利用可能）

理由：
- Compare Intelligence の分析結果は「何が起きているか」を示すが、「次に何をすべきか」は別のレイヤーで整理が必要
- AI会社が自己診断だけでなく、改善方向を自動提案できる構造にする
- Priority chip（HIGH/MED/LOW）で優先度を明確化し、実案件改善のアクションを整理する

追記日: 2026-06-29（Phase46-6完了）

---

# Decision 016
## Compare 3機能の統合整合性を Integration Check で自動チェックする

Phase46-7において、Compare Log / Compare Intelligence / Compare Recommendation の3機能が揃って機能しているかを自動チェックする Integration Check を追加した。

採用方針：
- `buildCompareIntegrationCheck()` でログ件数 / モードカバレッジ / outputTypeカバレッジ / InjectionImpact / Recommendations の7項目をチェック
- `getCompareIntegrationStatus()` で ready / partial / insufficient を判定（ログ3件以上かつ2モード以上 + Recommendations ありで ready）
- nextTestActions でユーザーが次に何をすべきか具体的に提示
- cautionItems で不足・注意事項を警告
- Knowledge / Learning / Memory は自動変更しない（表示とExportのみ）

理由：
- 3つの Compare 機能が揃っていないと分析精度が低く、改善提案が意味を持たない
- Integration Check で「今の状態で推奨モードが信頼できるか」を自動判定できる
- nextTestActions により、次の実案件で何をテストすべきか明確にする

追記日: 2026-06-29（Phase46-7完了）

---

# Decision 017
## API料金管理の設計仕様

Phase47-1において、OpenAI + Claude の料金を統合管理する仕様を確定。

採用方針：
- OpenAI: costTracker.js → cost-logs.json（日次/月次/累計 + モデル別 + 日付リセット）
- Claude: claudeCostTracker.js → claude-cost-logs.json（日次/月次/累計 + モデル別 + 日付リセット）
- 表示: Provider別（OpenAI/Claude）を展開表示 + 上部に合計（OpenAI+Claude）
- 右上ヘッダー料金ボタン = OpenAI+Claude合計
- 今日/今月は日付変更でリセット / 累計(total)は絶対にリセットしない
- /api/claude-cost（永続データ）が優先 / /api/claude-status（インメモリ）はフォールバック

理由：
- OpenAIだけでは実際のAPI総コストが把握できない
- 月次上限管理はOpenAI+Claude合算で行うべき
- モデル別表示によりどのAI社員がコストを発生させているか把握できる

追記日: 2026-07-02（Phase47-1完了）

---

# Decision 018
## Claudeモデル最適化方針

Phase47-2（次工程）として、Claude AI社員のモデル選択を最適化する方針を決定。

採用方針（予定）：
- Writer: 最安モデル（品質より速度・コスト優先）
- Reviewer: 最安モデル（チェック用途）
- Strategy: 最高品質モデル（戦略判断は品質優先）
- Leader: OpenAI固定（変更禁止）

理由：
- Writer/Reviewerは大量生成が前提でコスト最小化が重要
- Strategyは重要な戦略判断をするため品質優先
- 全担当を同一モデルにするとコストが爆発する
- claude-cost-logs.jsonのモデル別集計でコスト効果を確認できる

参照: Phase47-2実装時に正式仕様確定

追記日: 2026-07-02（Phase47-1完了）

**追記（Phase47-2B完了時点）**: 上記方針は Phase47-2B にて実装完了。Writer/Reviewer=`claude-haiku-4-5`、Strategy=`claude-opus-4-8` を正式採用（Phase47-2D）。Phase47-2C で最適化前後の品質比較、Phase47-3〜47-5 で品質監視・時系列履歴・永続化まで完成した。

---

# Decision 019
## Output Engineは成果物完成を最優先とする

Phase48-1以降の方針として、Output Engineは回答生成ではなく成果物完成を最優先とすることを決定。

理由：
- AI会社の最終目的（Decision 001）と一致させるため
- Output Package Quality Checklistで「何が完成していないか」を可視化することが、成果物完成度を上げる第一歩になる

追記日: 2026-07-02（Phase48-3.2 / Phase48-1〜48-3完了反映）

---

# Decision 020
## Output Package Qualityは100点を目標とする

Phase48-1〜48-3において、Output Package Qualityのスコア基準を確定。

採用方針：
- score 0〜100（完成項目数 / 全項目数）
- status: 90以上=complete / 75以上=almost_ready / 50以上=needs_work / 49以下=insufficient
- 90点未満の場合はRecommendationsを優先表示する改善ループを設ける

理由：
- 明確な数値目標があることで、成果物テンプレート強化（Phase48-2）・自動反映（Phase48-3）の効果を客観的に検証できる
- 実際にInstagram/TikTok/Flyer/LP/PDF/HTML/Image Prompt/Video Promptの8タイプで100点到達を実証済み（Phase48-3）

追記日: 2026-07-02（Phase48-3.2 / Phase48-1〜48-3完了反映）

---

# Decision 021
## AI会社は画像生成・動画生成・SNS運用・マーケティングまで含めた会社として設計する

Phase48以降のロードマップ（docs/04ROADMAP.md）として、AI会社の対象範囲を拡張する方針を決定。

採用方針：
- Phase48-4: Output Preview Engine
- Phase48-5: Publishing Engine（SNS投稿データ生成）
- Phase49: AI Creative Engine（画像・動画生成、ユーザー承認後のみ実行）
- Phase50: Marketing Intelligence（市場・競合・SEO・SNS分析）
- Phase51: Sales Engine
- Phase52: Automation Engine（投稿自動化、ユーザー承認後のみ）
- Phase53: Business Intelligence
- Phase54: Company Brain v2

理由：
- 「完成成果物を納品するAI会社」という最終目的（Decision 001）を実現するには、成果物生成だけでなく、分析・投稿・自動化まで含めた会社機能が必要
- 課金・外部API実行は引き続きユーザー承認制を維持する

追記日: 2026-07-02（Phase48-3.2）

---

# Decision 022
## Previewを見ながら改善→品質向上→完成を繰り返す設計とする

Phase48-4（Output Preview Engine）に向けた設計方針を決定。

採用方針：
- Output Package Qualityで完成度をスコア化する（Phase48-1〜48-3で完成）
- Previewで完成イメージを画面表示する（Phase48-4）
- 90点未満の場合はRecommendationsを確認し改善する（改善ループ、Decision 020）
- Preview品質も評価対象に加える（Phase48-4以降）

理由：
- スコアだけでは完成イメージが掴みにくく、Previewと組み合わせることで実際の納品判断がしやすくなる
- 改善→品質向上→完成のループを明確にすることで、AI会社としての「品質が毎回向上していく」設計思想（Decision 004）と一致させる

追記日: 2026-07-02（Phase48-3.2）

---

# Decision 023
## AI会社の最終目標（Version 2.0 Ultimate Goal）

AI会社の最終目標は、ユーザーが依頼すると

市場分析 → 競合分析 → 企画 → 画像 → 動画 → LP → HTML → PDF → 投稿文 → CTA → ハッシュタグ → 改善案

まで完成品として納品することである。

理由：
- 「回答するAI」ではなく「完成成果物を納品するAI会社」という最終目的（Decision 001 / 本ファイル冒頭）を、Version 2.0で完全自律型として実現する
- 詳細は docs/04ROADMAP.md の「将来的な完成イメージ」「Ultimate Goal」を正式仕様とする

追記日: 2026-07-02（Phase48-3.2）

---

# Decision 024
## Output Preview EngineはPackage表示を置換せず追加する

Phase48-4において、成果物の完成イメージ表示（Preview Engine）の実装方式を決定。

採用方針：
- 既存の`buildXxxPackageHtml()`（ラベル+テキスト一覧型、コピー用途）は一切変更しない
- 新規`buildXxxPreviewHtml()`を追加し、Package表示の直後（Output Package Qualityスコアの下）に表示
- Previewは実物に近い見た目のモックアップ（Instagramスマホ枠・LPのwebページ風・チラシのA4カード・PDFのページ風カード・TikTok/YouTube Shortsの縦型動画枠）とし、HTMLタイプのみ`iframe sandbox=""`で実際に生成されたHTMLをそのまま描画する
- Preview右上にOutput Package Quality（Phase48-1）のスコアバッジを表示し、Decision 022の「Preview + Qualityスコアで改善ループ」を具体化する
- 新規API・外部通信・課金は一切追加しない（既存`_lastOutputDraft.fields`をクライアント側で描画するのみ）

理由：
- 「削除禁止・追加のみ」の絶対ルールに従い、Copy/Export用途のPackage表示とVisual確認用途のPreview表示を役割分担させる
- HTMLタイプは実際のHTML文字列を保持しているため、モックアップより実描画（iframe）の方が正確な完成イメージになる。ただしAI生成HTMLをそのまま描画するため`sandbox=""`で全権限を無効化しXSSを防止する

追記日: 2026-07-02（Phase48-4完了）

---

# Decision 025
## 未コミットのまま放置されたPhase47-1.6を正式化してからPhase48-5へ進む

Phase48-4完了後、作業ツリーに`costTracker.js`（OpenAI費用トラッカーへの`todayKey`/`monthKey`/`totalAmount`追加）と`cost-logs.json`の未コミット変更が残っていることが判明した。調査の結果、`index.html`は既にPhase47-2Aのコミット（5a7d2d3）で`// Phase47-1.6 累計`という対応コメント付きの`cp-oa-total`表示を含んでおり、フロントエンドとバックエンドが約10フェーズ分（Phase47-2A〜Phase48-4）不整合な状態のまま放置されていたことを確認した。

採用方針：
- 新規実装は行わず、既存の未コミット差分をそのまま検証（dev-check・ブラウザ確認）した上でコミットし、Phase47-1.6として正式に記録する
- `cost-logs.json`は既存の運用実績（Phase45-6B以降、コード変更時にデータスナップショットも一緒にコミットする前例あり）に合わせてコミット対象に含める
- `claude-cost-logs.json` / `claude-quality-history.json` は一度もgit追跡されたことがなく、`cost-logs.json`との追跡方針の統一が必要なため、今回はコミット対象外のまま据え置く

理由：
- コミット漏れのコードにフロントエンドが依存する不整合状態のまま新しいPhase（Publishing Engine）に進むと、問題の原因特定がさらに困難になる
- 「削除禁止・追加のみ・新規実装禁止」の原則のもと、既存の未コミット作業を検証してから記録することが最も安全な解消方法である
- git reset / git clean 等の破壊的操作は一切使わず、内容確認とコミットのみで解消した

追記日: 2026-07-02（Phase47-1.6正式化）

---

# Decision 026
## Publishing Engineはハッシュタグ数を確保しつつ事実の捏造はしない

Phase48-5において、Instagram（15〜30件）/TikTok（5〜15件）/YouTube Shorts（3〜10件）というハッシュタグ数要件を満たす設計を決定。

採用方針：
- 既存の生成済みハッシュタグ（`f.hashtags`）を最優先で使用する
- 不足分は`targetAudience`/`benefit`等の実データから抽出したキーワード、それでも足りない場合のみ`#PR`/`#おすすめ`/`#いいね`等の一般的なSNS慣用タグ（汎用フィラープール）で補う
- 連絡先・エリア・具体的な実績数値など「事実」に類する情報は一切生成しない（Phase48-3の誠実性方針を継承）
- Publishing EngineはOutput Package Quality（Phase48-1）のスコアを再利用し、80点未満の場合のみ警告を追加する。90/75/50という既存のstatus閾値とは別に、Publishing独自の80点閾値を「公開判断」の基準として新設した
- Preview Engine（Phase48-4）とは`sourcePreviewVersion`で緩やかに連携するのみとし、Previewが存在しない・対象外のタイプ（image_prompt/video_prompt）でもPublishing Engineは独立して動作する設計とした

理由：
- 「実在しない事実は捏造しない」というPhase48-3の誠実性方針（Decision群）とハッシュタグ数の要件を両立させるため、ハッシュタグは「事実」ではなく「一般的なSNS運用手法」として扱い、汎用タグでの補完を許容する
- Publishing EngineをPreview Engineに依存させると、Preview非対応の画像/動画プロンプトタイプで機能が使えなくなり、10タイプ対応という要件を満たせなくなるため、疎結合を維持した

追記日: 2026-07-02（Phase48-5完了）

---

# Decision 027
## Version2 Roadmapを責務分離型へ再構成する

Phase49-0（Version2設計レビュー）において、Roadmap（docs/04ROADMAP.md）のPhase49〜54に責務の重複・肥大化リスクが見つかったため、Phase49-0.1で6ファミリー（Creative Engine / Intelligence / Sales / Automation / Business Intelligence / Company Brain v2）へ正式に再構成した。

採用方針：
- Phase49をCreative生成ファミリーへ整理する（Phase49-1 AI Gateway Foundation〜Phase49-6 Asset Library）
- 旧Phase49-1「Instagram Intelligence」をPhase50-2「Platform Intelligence」へ移動する
- 旧Phase50-1「Image Prompt Intelligence」をPhase49-2へ移動し、Video Prompt Intelligence（Phase49-3）と共にCreative系プロンプト最適化として統合する
- Phase53は既存のCost Analysis（Phase47）/ Compare Intelligence（Phase46）/ Output Package Quality（Phase48-1）を再実装せず、横断集計（Cross Engine Dashboard）として設計する
- Phase54（Company Brain v2）は単一Phaseのまま実装せず、既存`autonomousConsult`フラグを土台に4つの段階（Consult Engine → Self Review Engine → Autonomous Quality Loop → Integration）へ分割する

理由：
- 責務の肥大化・重複実装・後戻り（Phase47-1.6のような未コミット放置の再発）を防ぐため
- Phase49本体（旧: 画像/動画/広告生成を1Phaseに集約）はPublishing Engine（Phase48-5）と同等以上の複雑度になる懸念があり、Phase48-5で採用した「1責務1関数」の設計思想をPhase単位でも踏襲する必要がある
- `loadCompanyBrain()`/`renderCompanyBrain()`の実装確認により、現行Company Brainが読み取り専用の集計ダッシュボードであることが判明し、Roadmapが掲げる自律実行（v2）との差が大きいことが分かったため、段階的移行が必要と判断した

追記日: 2026-07-02（Phase49-0.1完了）

---

# Decision 028
## AI Gatewayを将来の共通中継層として採用する

Phase49-0（Version2設計レビュー）において、Version2で新設する「AI Gateway」の役割・制約を決定した。

採用方針：
- API実行 / PCアプリ操作 / ブラウザ操作のうち最適な経路を自動選択する中継レイヤーとする
- 既存Provider設定（Leader=OpenAI固定 / Writer・Reviewer・Strategy=Claude固定）には一切影響させない。AI GatewayはPhase49以降の新規ドメイン（画像/動画生成、将来の営業/自動化ツール連携）専用の抽象化層と位置付ける
- どの経路を通っても、実際の生成実行は必ずユーザー承認ゲートを通過する（Decision 011・021を継承。承認をバイパスする層ではない）
- Phase47の料金メーター（costTracker.js / claudeCostTracker.js）と同一パターンの新規トラッカーを将来追加し、既存トラッカーは変更しない設計とすることでコスト最適化と連携する
- Phase49-1（AI Gateway Foundation）では設計・骨格構築のみを行い、実際のAPI/ブラウザ/PCアプリ実行連携は行わない

理由：
- 複数の画像/動画生成AI（GPT Image / Seedance / DOMOAI / Genspark 等）を将来使い分けるには、実行経路の抽象化が不可欠であり、Leader/Workflowの既存コードに影響を波及させない構成にする必要がある
- 課金・外部API実行はユーザー承認制という既存の絶対ルール（Decision 005・011・021）をAI Gatewayでも継続する

追記日: 2026-07-02（Phase49-0.1完了）

---

# Decision 029
## Asset LibraryをKnowledge Libraryとは別物として設計する

Phase49-0（Version2設計レビュー）において、Version2で新設する「Asset Library」とPhase45で完成済みの「Knowledge Library」の役割分担を決定した。

採用方針：
- Knowledge Libraryは「学習した知識・ルール（テキスト）」を保存する既存の仕組み（Phase45）であり、変更しない
- Asset Libraryは「完成した成果物そのもの（画像・動画・LP・PDF・HTML・チラシ・Instagram・プロンプト・Quality・Compare結果等）」を保存する新規の仕組みとする
- 保存フローはKnowledge Candidates（Phase45-4〜6）と同じ「候補生成 → 承認 → 保存」パターンを流用し、新しい承認UIパターンは発明しない
- Knowledge Chainの既存コード（fetchKnowledgeForOutputType / selectRelevantKnowledge 等）は一切変更しない

理由：
- テキスト知識（Knowledge）と実体成果物（Asset）は保存特性・検索特性が異なり、混同するとKnowledge Chainの責務が肥大化する
- 既に実証済みの承認パターン（Phase45）を流用することで、新規UI設計コストと事故リスクを抑える

追記日: 2026-07-02（Phase49-0.1完了）

---

# Decision 030
## AI Gateway Foundationは実行層ではなく判断層から開始する

Phase49-1において、AI Gatewayの初期実装スコープを「判断層のみ」に限定する方針を決定した。

内容：
- Phase49-1では外部AI実行をしない（API呼び出し・PC操作・ブラウザ自動操作は一切行わない）
- API / PC操作 / ブラウザ操作は将来候補（`recommendedRoute`: api_candidate / browser_candidate / desktop_candidate）として定義のみ行い、`allowedNow`は常にfalseとする
- 実行は必ずユーザー承認後のみ（`isAIGatewayExecutionAllowed()`で実行系アクションを恒久的にfalseとするハード安全ゲートを設置）
- AI Skill Registry（`AI_SKILL_REGISTRY`、13ツール）を判断材料として採用。ChatGPT/Claudeは本AI会社で実際にAPI接続済み（Leader/Writer・Reviewer・Strategy用途）だが、それ以外の11ツールは`not_connected`・cost/quality/speedは`unknown`として正直に表示し、実在しない接続状況を捏造しない
- AI会社の学習（Knowledge/Learning/Company Memory）は引き続きENBISOU本体（既存Knowledge Chain）に集約し、AI Gatewayは新設の判断・ルーティング層として独立させる

理由：
- Phase49-0（設計レビュー）・Decision 028で決定した通り、既存Provider構成（Leader=OpenAI固定 / Writer・Reviewer・Strategy=Claude固定）に影響を与えず、かつ課金・外部通信を伴わずに済む範囲から着手する必要がある
- 実行層（Phase49-4 Creative Engine Execution）を作る前に、まず「何を・どの経路で・なぜ」を判断できる骨格を安全に検証しておくことで、実行層実装時のリスクを下げる

追記日: 2026-07-02（Phase49-1完了）

---

# Decision 031
## AI Registry ExpansionをAI Gatewayの判断材料として採用する

Phase49-1.1において、Phase49-1のAI Gateway Foundationを拡張し、Capability/Health/Cost/Approval/Route Priority/Version Registryを判断材料として追加する方針を決定した。

内容：
- AI Gatewayはツール名だけでなく、Capability（能力値0〜5）/ Health（接続状態）/ Cost（費用タイプ）/ Approval（承認要否）/ Route Priority（用途別推奨順位）/ Version（Registry世代管理）を参照する
- 実行はしない（Phase49-1のisAIGatewayExecutionAllowed()による恒久的な安全ゲートは無変更のまま維持）
- 不明情報はunknownとして扱い、捏造しない（能力値・費用情報とも、検証していないものは`unknown`または安全側の低い値0〜2で表現する）
- 承認が必要な操作（apiExecution/browserAutomation/desktopAutomation/imageGeneration/videoGeneration/snsPosting）は、ツールに依らず一律requiresApproval相当（Approval Profile上はtrue）とする。promptGeneration/copyTextのみfalse（承認不要）
- 将来AIツールが増えてもRegistry追加（`AI_SKILL_REGISTRY`・`AI_CAPABILITY_REGISTRY`等へのエントリ追加）で対応できる設計とし、既存ツールの定義や`createAIGatewayDecision()`の既存12フィールドのロジックは変更しない（新規8フィールドの追加のみ）

理由：
- Phase49-1で「判断層」の骨格（ツール名ベースの推奨のみ）は完成したが、実際の判断精度を高めるには能力・健全性・費用・承認要否・優先順位という多角的な材料が必要
- Decision 030（判断層から開始する方針）を継承しつつ、実行層（Phase49-4）に進む前に判断材料を充実させることで、将来の実行層実装時の意思決定精度を高める
- Approval Profileをツール非依存の一律ルールとしたのは、承認要否は「どのツールか」ではなく「どの操作か」で決まるという既存のisAIGatewayExecutionAllowed()の設計思想と整合させるため

追記日: 2026-07-03（Phase49-1.1完了）

---

# Decision 032
## AI Registryは固定データだけでなくLearning情報を保持する

Phase49-1.2において、Phase49-1.1で完成した静的Registry（Capability/Health/Cost/Approval/Route Priority/Version）に加え、実績から成長するLearning Registryを追加する方針を決定した。

内容：
- AI Registryは固定データ（Capability等の静的Registry）だけでなく、Learning情報（`AI_REGISTRY_LEARNING`: successCount/failureCount/qualityAverage/speedAverage/costAverage/lastUsed/lastUpdated/confidence/recommendationScore）を保持する
- LearningはRecommendation（`recommendationScore`）に利用する。品質・速度・コスト・成功率・Confidenceの5要素から0〜100のスコアを算出する
- 実行はしない。`recordAIRegistryLearning()`は呼び出し可能な関数として用意するのみで、Workflow等からの自動呼び出しは行わない（実際のAPI実績はまだ保存しない）
- 推測で学習しない。実績のみ学習対象とする。実績が0件の場合は中立値50を返し、高評価・低評価どちらにも偏らせない。Confidenceが低いほどRecommendation Scoreは中立値50に近づける設計とし、少ない実績で極端なスコアが出ないようにする
- `createAIGatewayDecision()`の既存フィールド（Phase49-1の12フィールド + Phase49-1.1の8フィールド）は完全に無変更。新規`learning`オブジェクト1つを追加するのみ

理由：
- Phase49-1.1の静的Registryだけでは「今後どのツールを優先すべきか」を実績に基づいて判断できない。将来の実行層（Phase49-4）が本格稼働した際に、実績データを土台にした推奨精度向上の仕組みを先に用意しておく必要がある
- 実績0件の状態で高評価・低評価を推測すると、Phase48-3/48-5から継続している「実在しない事実は捏造しない」という誠実性方針に反するため、中立値とConfidence連動の設計で担保した

追記日: 2026-07-03（Phase49-1.2完了）

---

# Decision 033
## Image Prompt Intelligenceは画像生成実行ではなくプロンプト最適化層として実装する

Phase49-2において、Image Prompt Intelligenceのスコープを「プロンプト最適化のみ」に限定する方針を決定した。

内容：
- Phase49-2では画像生成APIを実行しない
- 外部AI連携（実際のGPT Image/Midjourney/Flux/Ideogram/Recraft等への通信）はしない
- AI Gateway（Phase49-1）/ Registry（Phase49-1.1）/ Learning（Phase49-1.2）を判断材料として使う（`sourceGatewayDecision`でrecommendedTool/recommendedRoute/routePriority/capabilityScore/learningを参照）
- 各画像AI（GPT Image/ChatGPT Image/Midjourney/Flux/Ideogram/Recraft）に貼り付けられる、ツール形式に応じたプロンプトを生成する（`platformPrompts`）
- Output Type別（Instagram/チラシ/LP/PDF・文書/Image Prompt高品質化/Generic）に最適化されたcomposition/lighting/camera/color/formatを生成する
- 実行は将来Phase49-4（Creative Engine Execution）以降、ユーザー承認後のみとする

理由：
- Decision 030（AI Gateway Foundationは実行層ではなく判断層から開始する）の方針を継承し、Image Prompt Intelligenceも同様に「実行しないプロンプト生成層」として設計することで、Phase49-4以前の全フェーズを安全に完結させる
- ツール別のプロンプト形式差異（Midjourneyの`--ar`/`--no`フラグ形式、Flux/SDのタグ形式、GPT Image/ChatGPTの自然文形式等）を吸収することで、ユーザーが手動コピー＆ペーストするだけで各ツールにそのまま使える完成品を提供する

追記日: 2026-07-03（Phase49-2完了）

---

# Decision 034
## Video Prompt Intelligenceは動画生成実行ではなくプロンプト最適化層として実装する

Phase49-3において、Video Prompt Intelligenceのスコープを「プロンプト最適化のみ」に限定する方針を決定した。

内容：
- Phase49-3では動画生成APIを実行しない
- 外部AI連携（実際のSeedance/Flow/Veo/Kling/Runway/Luma/Pika/Hailuo/DOMOAI等への通信）はしない
- AI Gateway（Phase49-1）/ Registry（Phase49-1.1）/ Learning（Phase49-1.2）を判断材料として使う（`sourceGatewayDecision`でrecommendedTool/recommendedRoute/routePriority/capabilityScore/learningを参照）
- Image Prompt Intelligence（Phase49-2）を動画化前提素材として参照する（`sourceImagePromptIntelligence`でmainPrompt/stylePrompt/compositionPromptを参照し、mainPromptをvisual base、stylePromptを動画style、compositionPromptをscenePromptへ反映）。ただし画像生成はしない
- 各動画AI（Seedance/Flow/Veo/Kling/Runway/Luma/Pika/Hailuo/DOMOAI）に貼り付けられる、ツール形式に応じたプロンプトを生成する（`platformPrompts`）
- Output Type別（TikTok/YouTube Shorts/Instagram/Video Prompt高品質化/Image-to-Video/LP/チラシ・PDF・文書の動画広告化/Generic）に最適化されたscene/motion/camera/lighting/style/audio/caption/duration/formatを生成する
- 実行は将来Phase49-4（Creative Engine Execution）以降、ユーザー承認後のみとする

理由：
- Decision 030・033（AI Gateway/Image Prompt Intelligenceは実行層ではなく判断層・プロンプト生成層から開始する）の方針を継承し、Phase49-4以前の全フェーズを安全に完結させる
- Image Prompt Intelligenceとの連携により、静止画から動画化する場合の一貫性（同じ被写体・スタイル・構図）を担保し、画像と動画で別々のプロンプトを一から作り直す手間を減らす

追記日: 2026-07-04（Phase49-3完了）

---

# Decision 035
## Creative Execution（Phase49-4）は自動実行ではなく実行計画・コピー・チェック層として実装する

Phase49-4において、「Creative Engine Execution」という名称のPhaseであっても、実際のAI自動実行は行わず、実行計画（Execution Plan）・コピー機能・チェック機能のみを提供する方針を決定した。

内容：
- `autoExecute` フィールドを常に `false` に固定し、`executionMode` を常に `'manual_only'` とする（コード上のハード固定。設定で変更不可）
- AI Gateway（Phase49-1）/ Image Prompt Intelligence（Phase49-2）/ Video Prompt Intelligence（Phase49-3）の判断ロジックは一切変更せず、`createAIGatewayDecision()` / `createImagePromptIntelligenceDraft()` / `createVideoPromptIntelligenceDraft()` を読み取り専用で参照する
- 16ツール（ChatGPT/Claude/GPT Image/Seedance/Flow/Veo/Runway/Kling/Pika/Luma/DOMOAI/Hailuo/Ideogram/Flux/Midjourney/Recraft）向けにSTEP1〜7の実行手順とツール別の手動貼り付け案内（Tool Planner）を生成するが、実際にツールへアクセス・実行することはない
- Output/Publishing/AI Gateway/Image・Video Prompt Intelligenceの各Qualityスコアを参照し、80点未満の場合は実行前の再確認を促す警告を表示する
- 実際の自動実行はPhase49-5（Creative Ad Assembly）以降でも即座には行わず、AI Gatewayの安全ゲート（`isAIGatewayExecutionAllowed()`）とユーザー承認を経て初めて検討される

理由：
- Decision 030・033・034（AI Gateway/Image/Video Prompt Intelligenceは実行層ではなく判断層・プロンプト生成層から開始する）の方針を一貫して継承し、「Execution」という名称に反して実装内容が自動実行を意味しないことを明確にする
- 既存の判断ロジック（AI Gateway等）を変更せず参照のみで完結させることで、Phase49-1〜49-3で築いた安全性・回帰耐性をそのまま維持する

追記日: 2026-07-04（Phase49-4完了）

---

# Decision 036
## Creative Ad Assemblyは広告素材の組み立て層として実装する

Phase49-5において、Creative Ad Assemblyのスコープを「広告素材の組み立てのみ」に限定する方針を決定した。

内容：
- 広告素材を構成するだけで実行しない（Headline/Caption/CTA/Visual Direction/Image・Video Assets Plan/Posting Planを組み立てて表示するのみ）
- 画像生成・動画生成・投稿は行わない（Assembly Only / No Auto Posting / No Image Generation / No Video Generation / No External AI Execution / Manual Use Onlyを固定バッジとして常時表示）
- Publishing（Phase48-5）/ AI Gateway（Phase49-1）/ Image Prompt Intelligence（Phase49-2）/ Video Prompt Intelligence（Phase49-3）/ Creative Execution（Phase49-4）を参照する（`sourcePublishing`/`sourceGatewayDecision`/`sourceImagePromptIntelligence`/`sourceVideoPromptIntelligence`/`sourceCreativeExecution`として必要項目のみ抽出。各Engineの判断ロジックは一切変更しない）
- 実行は将来の承認フェーズ（Phase49-4以降のAI Gateway安全ゲート・ユーザー承認）でのみ検討される
- Manual Use Onlyを維持する（コピー機能によるユーザーの手動作業を前提とした設計を継続）

理由：
- Decision 030・033・034・035（AI Gateway/Image・Video Prompt Intelligence/Creative Executionは実行層ではなく判断層・プロンプト生成層・実行計画層から開始する）の方針を一貫して継承する
- 「広告素材」という最終的にユーザー向けの成果物に近い概念でも、既存の安全設計（実行しない・参照のみ）を崩さないことで、Phase49系全体の回帰耐性と安全性を維持する

追記日: 2026-07-04（Phase49-5完了）

---

# Decision 037
## Creative Asset LibraryはCreative Engineファミリー最終Phaseとして既存Asset管理層のみを実装する

Phase49-6において、Creative Asset Libraryのスコープを「既存Assetの管理・分類・コピー・Exportのみ」に限定し、新規判断を一切行わない方針を決定した。

内容：
- Creative Ad Assembly（Phase49-5）/ Creative Execution（Phase49-4）/ Image Prompt Intelligence（Phase49-2）/ Video Prompt Intelligence（Phase49-3）/ Publishing（Phase48-5）/ AI Gateway（Phase49-1）の**既存6関数の呼び出しのみ**でAssetを構成し、新規の判断・生成ロジックは一切追加しない
- 画像生成・動画生成・SNS投稿・API実行は一切行わない（Asset Library Only / No External Execution / No AI Generation / Manual Reuse Only / Read Onlyを固定バッジとして常時表示）
- Favorite/Archiveは静的なプレースホルダーフィールド（常にfalse）とし、DB変更・新規永続化は行わない
- Asset Tags/Search Keywordsは既存データ（outputType/Output Type定義ラベル/Publishingのhashtags等）から機械的に抽出するのみで、AIによる新規タグ生成は行わない
- Creative Engineファミリー（Phase49-1〜49-6）はこのPhaseで完結し、次はIntelligenceファミリー（Phase50-1〜）へ移行する

理由：
- Decision 030・033・034・035・036（AI Gateway/Image・Video Prompt Intelligence/Creative Execution/Creative Ad Assemblyは実行層ではなく判断層・プロンプト生成層・実行計画層・組み立て層から開始する）の方針を一貫して継承し、Creative Engineファミリーの最終Phaseも同じ安全設計で締めくくる
- 「管理レイヤー」という性質上、新規のAI判断ロジックを追加する必要がないため、既存6関数の読み取りのみに限定することでAI Gateway等の既存判断ロジックへの影響を完全に排除できる

追記日: 2026-07-04（Phase49-6完了）

---

# Decision 038
## Creative Engineファミリー完了範囲の正式確定（Planning / Assembly / Library まで、Executionは今後の承認フェーズ）

Phase49-6完了に伴い、Creative Engineファミリー（Phase49-1〜49-6）の完成範囲を正式に確定した。

内容：
- Creative Engineは AI Gateway / Publishing Engine / Image Prompt Intelligence / Video Prompt Intelligence / Creative Execution / Creative Ad Assembly / Creative Asset Library まで完成した
- 画像生成・動画生成・SNS投稿・PC操作・ブラウザ操作・API自動実行はいずれも実装していない
- Creative Engineは **Planning（判断・プロンプト生成）／ Assembly（広告素材組み立て）／ Library（Asset管理）** までを担当する
- 実際の生成・投稿・外部AI実行を伴う **Execution（実行）は今後の承認フェーズでのみ実装する**（ユーザー承認・AI Gatewayの安全ゲートを経てから着手）

理由：
- Decision 030〜037で積み重ねてきた「判断層・プロンプト生成層・実行計画層・組み立て層・管理層はすべて実行しない」という設計方針を、Creative Engineファミリー完了時点で改めて明文化し、次のIntelligenceファミリー（Phase50-1〜）着手前に完成範囲の認識を統一する
- 「Execution」という名称のPhase（49-4）が存在しても実際には自動実行を行っていないという事実を踏まえ、真の実行機能は別途、ユーザー承認を前提とした将来フェーズで扱うことを正式に確定する

追記日: 2026-07-04（Phase49-6完了・Creative Engineファミリー完了確定）

---

# Decision 039
## Version1の最優先目的をInstagram収益化支援へ変更する

Creative Engineファミリー完了（Decision 038）を受け、Version1のRoadmap方針を「AI会社を作ること」から「AI会社自身が収益を生みながら成長すること」へ転換し、その最初の実運用対象をInstagramに定めた。

内容：
- Version1の最優先目的をInstagram収益化支援へ変更する
- AI会社はInstagram運用を最初の実運用対象とする
- Manual Only方針は維持する（画像生成・動画生成・SNS投稿は引き続きユーザー承認後の手動実行のみ）
- Version1完成基準を「Instagramを毎日運用できること」へ変更する（市場調査→テーマ決定→保存率が高い構成提案→スライド構成→画像プロンプト→動画プロンプト→投稿文→CTA→ハッシュタグ→Creative Assembly→Asset Library保存までを5分以内で完了できること）
- Phase50（Marketing Intelligence）はInstagram特化の分析（保存率/リーチ/プロフィール遷移/フォロー率/CTA/ハッシュタグ/投稿時間/カルーセル/リール/競合/トレンド分析）を最優先とし、汎用マーケティング/SEO分析はInstagram完成後に拡張する
- Asset LibraryはInstagram実運用結果（投稿/スライド/画像プロンプト/動画プロンプト/CTA/Headline/Caption/Asset/保存率/クリック率/フォロー率/CV）を蓄積し「勝ちパターン」を学習する会社資産として今後拡張していく

理由：
- ユーザーより、AI会社の最終目的は「AI会社を作ること」自体ではなく「AI会社自身が収益を生みながら成長すること」であるという方針転換の指示があったため
- Instagramは既存のCreative Engineファミリー（Phase49-1〜49-6）の成果物（Publishing/AI Gateway/Image・Video Prompt Intelligence/Creative Execution/Creative Ad Assembly/Asset Library）が既にInstagram Carouselを含む全13 OUTPUT_TYPEに対応済みであり、最短で実運用を開始できる対象であるため
- Manual Only方針を継続することで、Decision 030〜038で積み重ねてきた「画像生成・動画生成・SNS投稿はユーザー承認後のみ」という安全設計を一切変更せずに実運用フェーズへ移行できるため

追記日: 2026-07-04（Version1 Roadmap方針変更・Instagram収益化支援優先化）

注記: ユーザー指示では本Decisionは「Decision038」と記載されていたが、直前のPhase49-6.1で既にDecision 038（Creative Engineファミリー完了範囲の正式確定）を採番済みのため、番号重複を避けて**Decision 039**として採番した。

---

# Decision 040
## Instagram Marketing Intelligence（Phase50-1）は予測ヒューリスティック＋手動実績入力のみで実装する

Version1最優先ゴール（Instagram収益化支援・Decision 039）の第一歩として、Phase50-1でInstagram Marketing Intelligenceを実装した。実装スコープを以下に限定した。

内容：
- 分析対象は保存率/リーチ/プロフィール遷移/フォロー率/CTA/ハッシュタグ/投稿時間/カルーセル/リール/競合/トレンドの11種
- 投稿前分析は既存の`createPublishingDraft()`/`createCreativeAdAssemblyDraft()`の出力を読み取り専用で参照する**予測ヒューリスティック**（0〜100点）のみとする。実際のInstagram Graph API接続・自動データ取得は一切行わない
- 投稿後の実績分析（保存率/リーチ/プロフィール遷移/フォロー率/CV）は**ユーザーの手動入力のみ**で記録する（`recordInstagramResult()` / `submitInstagramResultEntry()`）。3件以上で平均集計を開始（`_instagramResultHistory` max30件・メモリ内）
- 競合分析・トレンド分析は自動収集せず、手動リサーチ用チェックリストの提示のみとする
- 固定Safetyバッジ4種（No Real API Connection / Manual Input Only / Prediction Heuristic Only / Read Only Analysis）を常時表示
- `index.html`のみ変更。既存Provider構成・Workflow・Knowledge Chain・Creative Engine各関数は無変更で参照のみ。画像/動画生成・SNS投稿・API実行・自動課金は一切なし

理由：
- Instagram Graph API等の実接続は外部API契約・課金を伴うため、Manual Only方針（Decision 039）に従い予測分析と手動入力に限定することで、承認なしに実運用支援を開始できる
- 既存Creative Engineファミリーの成果物（Publishing/Creative Ad Assembly）を読み取り専用で再利用することで、既存判断ロジックへの影響を完全に排除できる

追記日: 2026-07-04（Phase50-1 Instagram Marketing Intelligence完了）

---

# Decision 041
## Version1はInstagram APIを使わず手動運用を正式仕様とし、Version1完成を確定する

Phase50-2〜52-1でInstagram収益化パイプラインの全工程を実装完了し、Phase52-2でdocsへ正式記録した（コード変更なし・docsのみ）。これをもってInstagram収益化Version1を一区切り（完成）とする。

内容（Version1正式仕様）：
- **Instagram APIは使用しない**（Graph API等の実接続・自動データ取得は行わない）
- **手動投稿を正式仕様とする**（自動投稿は実装しない。投稿はユーザーがInstagramアプリ/Webから手動で行う）
- **Learningは投稿後に手入力**（実績はユーザーがInsightsを見て手入力。`_instagramLearningHistory`メモリのみ）
- **Asset Libraryは表示のみ**（保存候補の生成・表示のみ。実DB保存・Creative Asset Libraryへの書き込みは行わない）
- **Version2で実保存へ移行**（Asset Library実保存 / Learning永続化 / Instagram分析高度化 / TikTok / YouTube Shorts / LP連携 / AI自動改善）
- Version1完成9機能（すべてindex.htmlへ追加のみ・既存無変更）: Instagram Marketing Intelligence（Phase50-1）/ Instagram Content Planning（Phase50-2）/ Instagram Carousel Builder（Phase50-3）/ Instagram Design System（Phase50-4）/ Mobile Review Center（Phase50-5）/ Mobile Approval（Phase50-6）/ Publishing Ready Center（Phase50-7）/ Instagram Learning Center（Phase51-1）/ Creative Asset Library Save Center（Phase52-1）
- 現在Version: **v1.00-phase52-2** / 現在フェーズ: **Version1 Documentation Complete**

理由：
- 外部API接続・自動投稿・実DB保存は課金・契約・事故リスクを伴うため、Manual Only方針（Decision 039）を最後まで一貫させ、承認なしで安全に実運用を開始できる状態でVersion1を確定する
- まず実運用（実際のInstagram投稿）を回して実績データを蓄積し、その学びをもってVersion2（実保存・永続化・高度化・多プラットフォーム展開）へ進むことで、机上ではなく現場に基づいた拡張ができる

追記日: 2026-07-05（Phase52-2 Version1 Documentation Complete）

---

# Decision 042
## Version1 Operational Policy（Version1正式完成・実運用優先・Version2はAffiliate Intelligence最優先）

Phase52-3において、Version1を正式完成とし、実運用フェーズへの移行方針を確定する。

内容：
- **Version1は正式完成とする**（運用開始日 2026-07-04）
- Version1では：
  - Instagram APIは使用しない
  - 手動投稿を正式仕様とする
  - Learningは投稿後手入力
  - Asset Libraryは保存候補生成まで（実DB保存はVersion2）
  - **Version1実運用を優先する**（新機能開発より、実際のInstagram投稿・実績蓄積を優先）
- **Claude Codeクレジット不足などで開発停止した場合は、開発を停止し、Instagram運営 / A8案件調査 / 市場分析 / アカウント育成を優先する**
- **Version2ではAffiliate Intelligenceを最優先開発対象とする**
- 対象ASP: A8.net / もしもアフィリエイト / afb / アクセストレード / バリューコマース / 楽天アフィリエイト / Amazonアソシエイト

理由：
- Version1のパイプラインは完成済み（Decision 041）であり、次の価値は「机上の開発」ではなく「実運用で得られる実績データ」にある。開発が止まっても事業（Instagram運営・アフィリエイト収益化）は前進できるようにする
- AI会社が収益を生みながら成長する（Decision 039）という目的に対し、複数ASPを横断して利益率・Instagram適性・季節性・承認率・収益期待値を分析するAffiliate IntelligenceがVersion2の中核価値になるため、最優先開発対象と定める

追記日: 2026-07-05（Phase52-3 Version1 Operational）

---

# Decision 043
## Version2はAffiliate Intelligence Core（7層Intelligence）＋AI Gatewayで「経営判断まで行うAI会社」を目指す

Version1完成（Decision 041・042）を受け、Version2の全体設計を正式に確定する。Version2のテーマは **Instagram Affiliate Intelligence Company**（Instagramで何を売れば利益が最大になるかをAI会社全体が判断できる会社）とし、「Affiliate Intelligence → ASP分析 → 案件分析」で止まらず、AI会社全体が **利益を最大化する経営判断** まで行う会社へ進化させる。

内容：
- Version2の中核を **Affiliate Intelligence Core** とし、7層のIntelligenceを上から下へ連鎖させる:
  ① Market Opportunity Intelligence（今どの市場を狙うべきか）→ ② Product Intelligence（何を売るべきか）→ ③ ASP Intelligence（どのASPを使うべきか）→ ④ Competition Intelligence（競合分析）→ ⑤ Revenue Intelligence（利益・将来性分析）→ ⑥ Content Intelligence（Instagramで勝てる投稿企画）→ ⑦ Self Improvement Intelligence（実績から自動改善）
- AI会社が最終的に判断できる16項目を到達目標とする: 今売るべき市場 / 今売るべき商品 / どのASPを使うべきか / 利益率 / 承認率 / EPC / CVR / Instagramとの相性 / 競合数 / 案件寿命 / 季節性 / 保存率予測 / クリック率予測 / 想定売上 / 想定利益 / おすすめ順位。これらを統合し「おすすめ順位付きの利益ランキング」として出力できることを到達目標とする
- 最終形は、Leaderへ「今一番利益が出る案件は？」と聞くだけで、市場分析→案件分析→ASP分析→利益分析→競合分析→Instagram企画→Learning→改善まで一気通貫で判断できる会社とする
- AI Gatewayを正式な実行選択レイヤーとして構成へ組み込む: `Leader → Affiliate Intelligence → AI Gateway → { OpenAI / Claude / Browser Automation / PC Automation / 将来API }`。AI Gatewayは「最も低コストで最適な実行方法を自動選択するレイヤー」と定義する
- 実装配分（推奨・Phase53起点を維持）: Phase53 Affiliate Intelligence Core → Phase54 Market Opportunity → Phase55 Product → Phase56 ASP → Phase57 Competition → Phase58 Revenue → Phase59 Content → Phase60 Self Improvement → Phase61 AI Gateway v2 → Phase62 Leader Integration。既存の Multi ASP Compare / Trend Intelligence / Revenue Optimization / AI Campaign Planner は各Intelligence層へ統合・再配置する

安全設計（既存Decisionを継承・変更しない）：
- 実装はすべて `index.html` 追加のみ・既存関数は読み取り専用参照・予測ヒューリスティック＋手動入力・Safetyバッジ固定・実API/課金なし（Phase50-1 Decision 040の設計思想を踏襲）
- AI Gatewayは引き続き判断・ルーティング層とし、Browser Automation / PC Automation / API等の実行系はユーザー承認 + 安全ゲート（`isAIGatewayExecutionAllowed()`）を通過して初めて実行される（Decision 028・030・031を継承）
- 既存Provider構成（Leader=OpenAI固定 / Writer・Reviewer・Strategy=Claude固定）・Workflow・Knowledge Chain・Instagram収益化パイプライン（Version1完成9機能）は一切変更しない
- 課金・外部API契約・自動投稿・Instagram API接続・server.js変更・DB変更は引き続き禁止（ユーザー承認制）

理由：
- ユーザーより、Version2は「Affiliate Intelligence / ASP分析 / 案件分析」だけでなく、AI会社全体が「利益を最大化する経営判断」まで行う会社にしたいという方針が示されたため
- 7層Intelligenceに責務分離することで、Phase48-5以降で一貫している「1責務1関数・追加のみ・既存無変更」の設計思想をVersion2でも維持し、肥大化と後戻りを防ぐ
- AI Gatewayを実行選択レイヤーとして明文化しつつ、実行系は承認ゲートを維持することで、Manual Only方針（Decision 039）と収益最大化の自律判断を両立させる

追記日: 2026-07-05（Version2全体設計の正式反映）

---

# Decision 044
## Version1 Final Complete（運用可能な完成版として正式完成）

Phase52-10において、Version1を「機能完成」だけでなく「運用可能な完成版」として正式に完成と記録する。

内容:
- 正式Version: **v1.00-phase52-10 / Version1 Final Complete**（最新コミット f177fd2）
- 以下をすべて完了として記録する:
  - Instagram収益化パイプライン完成（Phase50-1〜52-1）
  - Mobile UI完成（Phase52-5）／ Mobile Touch Hotfix完成（Phase52-6）／ Mobile Topbar完成（Phase52-8/52-9/52-9b）
  - Render本番反映完了（ai-company-l45x.onrender.com = f177fd2）
  - iPhone Safari実機確認完了（縦向き・横向きともTopbar 1本横スクロール・全ボタン操作可能・入力/送信可能・横はみ出しなし）
  - PC表示正常（PC不変）
  - Manual Only維持（Instagram API/自動投稿/画像生成/課金なし）
- Phase52-10はdocsのみ更新（コード変更なし・index.html/server.js/DB/Workflow/Provider無変更）

理由:
- Version1のパイプラインはPhase52-2で機能完成（Decision 041）、Phase52-3で運用開始（Decision 042）していたが、スマホ（iPhone Safari）でのUI/タッチ/上部バーの実機課題が残っていた。Mobile UI（52-5/52-6）とMobile Topbar（52-8/52-9/52-9b）を本番反映し実機確認まで完了したことで、PC・スマホ双方から実際に運用できる状態になった
- 「作って終わり」ではなく「実運用できる完成版」であることを明確な節目として記録し、次のVersion1.01（Realtime Sync）・Version2（Affiliate Intelligence）への起点を確定する

追記日: 2026-07-05（Phase52-10 Version1 Final Complete）

---

# Decision 045
## Version2着手前にVersion1.01 Realtime Sync Editionを優先する

Version1 Final Complete（Decision 044）を受け、Version2（Affiliate Intelligence）着手前に、Version1.01「Realtime Sync Edition」を優先実装する方針を決定する。

内容:
- **Version1.01 = Realtime Sync Edition**。目的は「PCとiPhoneのどちらから利用しても同じAI会社になること」
- 同期対象: Task同期 / Conversation同期 / Timeline同期 / Notification同期 / Workflow Live同期 / Cost同期 / Learning同期 / Approval同期 / Auto Task同期 / Status同期
- すべて **Supabaseを利用** し、PCとスマホが同一状態になることを目的とする
- **Version2（Affiliate Intelligence）はVersion1.01完成後に開始する**。Version2開始前にRealtime同期を優先することをRoadmapへ正式記録する。Phase53開始前には必ずユーザー確認を取る

理由:
- Version1をスマホでも運用可能にした（Decision 044）結果、PC/スマホ両方で使う前提になったため、両者の状態が食い違うと実運用に支障が出る。実際の投稿・実績入力・承認・タスクをどちらの端末からでも同一状態で行えることが、収益化運用の安定に直結する
- Affiliate Intelligence（Version2）は判断・分析の中核であり、その前提として「どの端末からでも同じAI会社」という運用基盤（Realtime Sync）を整えておくことで、Version2の分析・承認フローが端末差なく機能する

追記日: 2026-07-05（Phase52-10 Version1 Final Complete）

---

# Decision 046
## 案件別チャットの端末間分離は messages.case_id（A案）で実装する

Phase52-12.2において、案件ごとのチャット履歴をPC/スマホ間で分離するための実装方式を決定した。

背景:
- 従来、`conversations` は (user_id, member_id, channel) の担当単位で、`messages` は conversation 配下。**どちらにも案件情報（case_id）が無い**。caseId はクライアントの localStorage（`chatHistory` の各メッセージ・`cases`）にしか存在しなかった
- そのため端末をまたぐと、同期取得したメッセージが caseId 無しで入り、`getFilteredHistory` の `|| !h.caseId` により全て「最新一覧」に集約され、案件別分離が失われていた

採用方針（A案・messages.case_id）:
- `messages` に `case_id TEXT`（**nullable・FKなし**）を1列追加する（`ALTER TABLE messages ADD COLUMN IF NOT EXISTS case_id TEXT;`・ユーザーがSupabase SQL Editorで実行）
- `POST /api/messages` で caseId を受領し `saveMessage` が case_id を保存、`GET /api/messages` は case_id を返却。クライアントは送信時に現在案件の caseId を付与し、merge 時に case_id を保持する
- `getFilteredHistory` は無変更（caseId が入れば `h.caseId === view` で案件別に自動分離）
- 会話（conversations）は担当単位のまま変更しない＝**メッセージ単位で case を判別**する

却下した案:
- **B案（conversations.case_id で会話を案件単位に分離）**: upsert/getMessages の鍵変更が大きく回帰リスクが高いため却下
- **C案（DB変更なし・クライアントのみ）**: サーバーに case 情報が無く他端末へ返せないため、真の端末間分離が実現できず却下

安全設計:
- **nullable・FKなし・デフォルトなし**とすることで、既存メッセージは自動的に `case_id=NULL`（データ移行なし・非破壊）。既存messagesは「最新一覧」に表示され続ける（後方互換）
- FKを付けないことで、案件削除（`DELETE /api/cases/:id`・Phase52-12.1）による messages への ON DELETE CASCADE 等の波及を防ぎ、「messages/conversations 非削除」設計を維持する
- 未更新端末は caseId を送らずNULL保存＝後方互換。dedup（sender+content+時刻）は無変更
- 変更範囲は `supabase/schema.sql` / `lib/conversationsDb.js` / `server.js` / `index.html` の4点のみ。Phase53・cost系は非接触

理由:
- 列追加1つ（nullable）で最小・非破壊・後方互換に案件別分離を実現でき、既存の会話同期（Phase52-11）・案件管理（Phase52-11.8〜12.1）の設計を崩さずに拡張できるため

追記日: 2026-07-08（Phase52-12.2 messages.case_id・commit aabf46c・push前）

---

# Decision 047
## Phase53 Affiliate Intelligence Core の先行開始（Decision 045 のB案運用判断）

判断:
- Decision 045 は「Version2（Affiliate Intelligence / Phase53）は **Version1.01 Realtime Sync Edition 完成後** に開始し、Phase53開始前に必ずユーザー確認を取る」と定めた。
- 実測レビューの結果、Version1.01 の10同期対象のうち **Conversation / Case / Messages の中核同期は完了・本番反映済み**、Task/Cost/Status/Auto Task はサーバー状態ベースで端末間共有済み（能動poll未配線）、**Approval（`_mobileApprovalState`）はセッション局所で未同期**であることを確認した。
- これを踏まえ、Decision 045 の運用判断として **「Conversation / Case / Messages の中核同期完了」をもって Phase53 の先行開始をユーザーが承認**（B案）した。

採用理由:
- Phase53 は `index.html` 追加のみ・`_affiliateCases` はメモリ内のみで、10同期ドメイン（messages/conversations/cases/tasks 等）を一切 read/write せず、既存 Realtime Sync / Workflow / Learning に**技術依存せず非破壊**（レビュー実測: server/DB/API/sync関数 非接触）。
- よって残同期の完成を待たずに Phase53 を進めても回帰リスクが無く、Version2 基盤整備を前倒しできる。

残同期の扱い（別Phase）:
- **未完了として別Phaseで管理**する: Task 自動更新poll / Cost 自動更新poll / Status 自動更新poll / Auto Task 自動更新poll（いずれも index.html のみで対応可）／ Learning 一部 in-memory 整理。
- **Approval 端末間同期のみ server.js / DB / API 検討が必要になる可能性があるため、Phase53 には混ぜず独立Phaseで扱う**。

実施結果:
- Phase53 Affiliate Intelligence Core を実装済み差分（index.html +380行）として検証（node --check / dev-check 200/200/200 / 新規ロジックsandbox / ユーザー実ブラウザ目視）のうえ、分離stage → commit **bcfba7d**（`Phase53 affiliate intelligence core base`）→ push → **Render本番反映済み**。origin/main = HEAD = bcfba7d / 未Push 0。
- DB変更なし / server.js変更なし / API追加なし / Supabase操作なし / 課金なし。cost系3ファイル（cost-logs.json / claude-cost-logs.json / claude-quality-history.json）は**未commit温存**（Phase53非接触）。

追記日: 2026-07-09（Phase53 Complete・commit bcfba7d・push済み・Render反映済み）

---

# Decision 048
## Phase54-1 Approval Sync のA案採用（case_idスコープ・最小サブセット・新規テーブル output_approvals）

背景:
- 調査により、承認状態 `_mobileApprovalState`・公開状態 `_publishingReadyState`・レビュー状態 `_mobileReviewState`、およびその母体 `_lastOutputDraft` は**すべてメモリ内のみ（localStorage/Supabase/API なし）**で、端末間同期が皆無であることを確認した。
- 承認は揮発ドラフトに紐づくため、「承認フラグ同期」だけでなく「承認対象を識別する安定キーの確立」が必要。

採用方針（A案）:
- **case_id をスコープキー**とする（cases は既に Phase52-11.9/12.2 で PC⇔スマホ同期済み）。新規ID採番を避け、既存同期基盤へ相乗りして最小・非破壊で実現。
- **最小サブセット**を同期対象とする: `approval_decision` / `approved_at` / `published` / `published_at` / `archived` / `updated_at` / `checklist`（任意）。**checklist詳細・review詳細（スライド別）・workflowId単位の厳密なドラフト同期は後段**。
- **新規テーブル `output_approvals`（FKなし・nullable中心・既存テーブル無変更・データ移行なし）**をユーザーがSupabaseで作成。FKなしは case削除の波及（CASCADE）を避けるため（Phase52-12.1/12.2 の非削除設計を継承）。
- サーバー（54-1b）とクライアント（54-1c）に段階分割し、各ゲートでユーザー承認。

却下した案:
- **B案（workflowId単位）**: ドラフト単位で厳密だが workflowId の端末間共有が弱く突合設計が増えるため、最小段階では見送り（将来拡張候補）。
- **C案（新規draftId採番＋別同期）**: 新ID同期の仕組みが増え重いため却下。
- **localStorage同期**: 「localStorage逆戻り禁止」ルールに反するため不可（サーバー永続で同期）。

安全設計:
- case_id 完全一致1件の upsert/GET に限定（別案件への承認誤反映を防止）。
- 54-1b はサーバーのみ（index.html非接触）＝UI未接続のため既存挙動は完全に不変。54-1c で Output Engine 中核状態（`_mobileApprovalState`/`_publishingReadyState`）へ反映する際は `_oeSafe` 保護・進行中ドラフト非上書きの順序制御を要する（回帰中リスク）。
- Phase53（`_affiliateCases`）・Workflow・Learning は非接触。DB I/Oのみで課金なし。

実施結果（54-1b）:
- 新規テーブル `output_approvals`＋RLS `FOR ALL` をユーザーがSupabaseで作成。`lib/approvalsDb.js`（新規・upsert/get）＋ server.js（遅延ローダー＋`GET/POST /api/approvals`）を追加。POSTはグローバル `app.use(express.json())` 依拠で per-route express.json() なし（既存規約に統一）。
- 検証: node --check 0エラー / dev-check 200/200/200 / POST localhost往復（`phase54-1b-test` 1件・DELETE未実行）/ GET 本番確認（source:db）/ 既存 `GET /api/cases` 回帰なし。commit **d9310d0** → push → **Render反映済み**（origin/main = HEAD = d9310d0 / 未Push 0）。cost系3ファイルは未commit温存・index.html非接触。

追記日: 2026-07-09（Phase54-1b Approval Sync Server API Complete・commit d9310d0・push済み・Render反映済み。次工程 Phase54-1c index.html 同期配線）

---

# Decision 049
## Phase54-1f は Approval行への output_id 紐付けで別成果物への誤復元を防ぐ（複数成果物履歴保存ではない・case_id PRIMARY KEY維持）

背景:
- Phase54-1c（Approval Sync）は case_id 単位で承認/公開状態を同期するが、承認対象の実体は **揮発するOutput Draft（`_lastOutputDraft`・メモリのみ）**。Phase54-1e で新規案件/案件切替/新成果物生成時に承認状態をリセットしたが、**同一案件に既存の承認済み行があると、case_id単位のGET復元が新成果物へ旧承認を再適用し得る**残課題が残っていた（どの成果物への承認かをサーバーが区別できないため）。

採用方針（A案・最小変更）:
- `output_approvals` に **nullable `output_id TEXT`** を追加（ユーザーがSupabaseで `ALTER ... ADD COLUMN IF NOT EXISTS` 実行・**PK（case_id）変更なし・データ移行なし・非破壊**）。
- 承認保存時に現在の Output Draft ID（`_lastOutputDraft.id`＝`'out_'+Date.now()`。**新規採番せず既存値を流用**）を `output_id` として保存。
- 復元時は **`row.output_id === 現在draft.id` の一致時のみ反映**。不一致・NULL・Draftなしは「正常な対象外」として復元しない（未承認維持・上書きなし・POSTなし・タイムスタンプ不変）。編集中3000msガード・`updated_at`新旧判定・`_approvalSyncInFlight`制御は無変更。
- lib/server.js/index.html/schema.sql の4ファイル・追加のみ。GET/POSTの `outputId` は任意（未指定の旧クライアントは従来動作）。

明示的に含めないもの（今回実現しない）:
- **1案件1Approval行（case_id PRIMARY KEY）を維持**。複数成果物のApproval履歴同時保存は行わない（＝「完全な成果物単位Approval永続化」ではない）。
- Output Draft自体の永続化・過去成果物の再表示・PC⇔スマホでの同一Draft共有・複合PK化・既存NULL行のデータ移行・output ID生成方式の変更 は対象外。

却下・保留:
- **既存 output_id=NULL 行の自動移行**: どの成果物への承認か特定できず推測紐付けは誤承認になるため行わない。既存NULL行は復元されず未承認扱い（**意図した仕様変更**）。
- **複合PK (case_id, output_id) 化**: PK/制約のDROPを伴い「削除禁止・既存を壊さない」に抵触するため却下。
- **Output Draft Persistence / Approval POST Ordering（着順逆転対策）**: それぞれ別Phase候補として分離（Phase54-1f範囲外）。

実施結果:
- commit **9fd25a0**（`Phase54-1f bind approvals to output`）/ tag **v1.01-phase54-1f**。実機確認（実ワークフロー2回＋実UI＋DB読み取り）で、POSTへの outputId 保存・DB `output_id` とdraft.id一致・同一案件の別成果物への承認混入なし・既存NULL行の非復元・回帰なし・dev-check 200/200/200・コンソールエラー0 を確認。**push未実施（未Push 1）**。cost系・Phase53・Phase54-1d/1e 非接触。

追記日: 2026-07-11（Phase54-1f Approval Output Binding / Leakage Prevention Complete・commit 9fd25a0・tag v1.01-phase54-1f・push前）

---

# Decision 050
## Phase54-1g は Approval POST を直列化＋対象別 Last Action Wins にして着順逆転を防ぐ（GET同期・output_id判定・DB/API は無変更）

背景:
- Phase54-1c 以降、承認/却下/取消/公開の各操作は `pushApprovalToServer` で **fire-and-forget（`fetch().catch()`・awaitなし）** に個別POSTしていた。同一成果物へ **approve→reject→cancel** 等を高速連続操作すると、各POSTのネットワーク完了順が発行順と逆転し、**中間状態（例: rejected）が最後にDBへ着信してローカル最終状態（cancel）とDB最終状態が不一致**になり得た（Phase54-1f実機確認時に確認・**Phase54-1f起因ではなくPhase54-1c由来**）。

採用方針（最小変更・`pushApprovalToServer` 内部限定・index.htmlのみ・追加のみ）:
- **グローバル直列 runner**：POST全体を1件ずつ `await` 送信し、同時に複数POSTを走らせない（着信順＝発行順を保証）。
- **対象別 Last Action Wins**：pending を `targetKey = caseId::outputId` 単位で**最新jobのみ保持**。同一対象の中間操作は後続操作が上書き（supersede）＝最後の操作が必ず採用。別対象は個別保持で喪失させない。
- **payload凍結**：キュー投入時に payload を確定（送信時に状態を読み直さない）。
- **成功条件は `response.ok`**（4xx/5xx/例外=失敗）。**最大1回だけ再送**。ただし失敗時に同一対象へ**より新しいpendingがあればstaleを再送しない（新操作優先）**。失敗してもキューは止めず他対象を失わない。
- **outputId無しはPOSTしない**（偽ID生成なし・case単位保存へ戻さない）。外部インターフェース維持・**非ブロック（戻り値undefined）**。

明示的に含めない/非変更:
- **Approval Sync（GET）の仕様は一切変更しない**：`scheduleApprovalSync`・`syncApprovalsFromServer`・`mergeApprovalStateFromServer`・`isRemoteApprovalNewer`・`_approvalSyncInFlight`・`_approvalSyncLastLocalChangeAt`・**output_id一致判定（Phase54-1f）** は無変更。
- **server.js / lib / DB / API は無変更**（POSTペイロード形式・エンドポイント不変）。Phase53 / Phase54-1d・1e・1f / cost系 非接触。
- 複数成果物Approval履歴・Output Draft永続化は対象外（別Phase候補「Output Draft Persistence」）。

却下・保留:
- **サーバー側での順序制御（updated_at比較で古い書込みを拒否 等）**：DB/APIに変更が及び「server.js/DB/API変更禁止」に抵触するため却下。クライアント直列化で最小・非破壊に解決。
- **デバウンスで中間POSTを間引く**：ネットワーク未発行の中間状態を握り潰す設計は、失敗再送・別対象保持との整合が複雑になるため、pending上書き（supersede）方式を採用。

確認結果:
- **合成（スタブ・実POST 0・課金なし）**：Queue動作 / Last Action Wins（approve→reject→cancel → 送信 `[approve, cancel]`）/ 対象別保持（`outA:approve / outB:reject2 / outC:publish`）/ POST失敗→最大1回再送（`[ng, ok]`）/ 新操作優先（stale再送なし）/ outputId無しPOST禁止 / 回帰・後始末原状復帰・コンソールエラー0。
- **localhost実機（実POST・実Supabase・透過ロガー・AI生成なし）**：実成果物Draft＋実ハンドラで approve→reject→cancel → **実POST 2回のみ**（中間reject supersedeで未送信）・UI最終=cancel(null)＝DB最終null 一致／reject→cancel は postLog `[rejected:200, null:200]`（着順保持）でDB最終null 一致／別案件混入なし・output_id不一致=復元なし（Phase54-1f保護健在）・回帰OK・コンソールエラー0。
- 実機検証で `output_approvals` にテスト行 `case-1g-rm-*`／`case-1g-B-*`／`case-1g-C-*` 生成（通常UI POST経由・手動curl 0回・DELETE未実施・非活性テストデータ）。

本番実機確認（Render `ai-company-l45x.onrender.com`・実POST・実Supabase・本番POST 6件・手動curl 0）:
- approve→reject→cancel → 実POST 2件 `[null:200, null:200]`（中間reject supersede）・UI最終=cancel(null)＝DB最終null 一致・pending残留0／reject→cancel は `[rejected:200, null:200]`（着順保持）DB最終null 一致／別案件混入なし・output_id不一致=復元なし（Phase54-1f保護維持）／Approval Sync GET回帰なし・非ブロック・コンソールエラー0。本番テスト行 `case-1g-prod-A/B/C-*`（非活性・DELETE未実施）。

状態: **正式Complete**。index.html commit **d6a6905**（+89/-7・追加のみ）／docs commit **2bb5a86** ＋ **2f Complete確定docs**／Tag **v1.01-phase54-1g**（→ d6a6905）／**origin/main = d6a6905・push済み・Render反映済み**。cost系3ファイルは未commit温存・stageに含めない。次は別Phase候補「Output Draft Persistence」（ユーザー判断待ち）。

追記日: 2026-07-11（Phase54-1g Approval POST Ordering / Last Action Wins **正式Complete**・commit d6a6905・tag v1.01-phase54-1g・push済み・Render反映済み・本番実機確認完了）


---

# Decision 051
## Phase54-2 は Output Draft を専用テーブル output_drafts へ永続化する（B案・保存/復元をindex.htmlのみで配線・Phase54-1f/1g非接触）

背景:
- Output Draft（`_lastOutputDraft`・本文/型/品質等）は**メモリのみ**で、リロード・PC⇔スマホで消失していた。Phase54-1b〜1g は承認状態(`output_approvals`)のみサーバ化し、Draト本体は対象外だった。Phase54-2a 調査で「専用テーブル追加（B案）」を推奨。

採用方針（B案・Phase54-2a）:
- **新規 `output_drafts`（output_id PRIMARY KEY・case_id NOT NULL・FKなし・非破壊・既存テーブル無変更）**。複数保存可だが今回のクライアント復元は**案件ごとの最新1件**（`updated_at DESC`）のみ。
- 既存 approvals/cases と**同型**：`lib/outputDraftsDb.js`＋`server.js` `GET/POST /api/output-drafts`＋`supabase/schema.sql`。保存/復元の配線は **index.htmlのみ**。
- 保存対象は**本文(fields)＋メタのみ**（output_id/case_id/type/status/title/source_text/fields/quality/package_quality/assigned_roles/schema_version/detection/日時）。**Approval状態・派生キャッシュ(mobileReviewCenter/mobileApproval/publishingReady)・exports・reviewNotes・providerRefs・Learning/Memory/Knowledge候補・cost は保存しない**。
- `output_id` を **drafts と approvals の共通キー**にし、復元後は既存 Approval Sync が同 output_id で承認復元（**Phase54-1f 判定を変更しない**）。

明示的に含めない/非変更:
- **Phase54-1f（output_id一致判定）／1g（Approval POST Queue）／Approval Sync GET／`mergeApprovalStateFromServer` は無変更**。承認状態はDraft APIから復元しない（output_approvals が正）。
- 複数成果物履歴UI・polling・PC⇔スマホ能動再取得・未完了Workflow Draト保持中の別案件自動置換 は **Phase54-2e候補（対象外）**。

段階分割:
- **2b**（サーバ基盤・server.js/lib/schema）→ **2c**（保存配線・index.html）→ **2d**（復元配線・index.html）。各段階でユーザー承認ゲート（DB作成・commit・push・Render）。

競合・保護設計（2d）:
- 復元は開始時caseId保持＋応答時の案件一致/スナップショット変化で**stale破棄**。上書きは**空スロットまたはサーバ復元済み(`_restoredFromServer`)Draトのみ**（未マーク=進行中Workflow生成Draトは保護）。
- **fix1**: 切替先に保存Draトが無い場合、前案件の復元済みDraト表示を null へクリア＋Output Engine再描画（POSTなし・Approvalは既存の案件切替リセットが正）。
- **fix2**: in-flight中の連続切替要求を破棄せず `_outputDraftRestorePending` に最新保持し、完了後に最新案件の復元を必ず再実行（再オープン不要）。

実施結果:
- DB: ユーザーが `output_drafts` 作成済み。commit **6dec27d**(2b)／**5eec84b**(2c)／**7589f4f**(2d)／Tag **v1.01-phase54-2d**（→ 7589f4f）。
- localhost実機（実ワークフロー1回＋実DB）：完成Draト保存（`out_1783814527200`/`case-mrgfnfgutvtb`）→ F5後復元・ID一致・Approval GETが同 output_id・復元中POST 0／案件別最新復元／Draトなし案件で前案件クリア（POST 0）／高速連続切替で最終案件即時復元・stale不採用／Output Engine・Mobile三種 回帰OK・コンソールエラー0・dev-check 200/200/200。
- push・Render反映は本リリースで実施。**本番実機確認は未実施（次段・ユーザー承認後）**。cost系3ファイルは未commit温存・stageに含めない。

追記日: 2026-07-12（Phase54-2 Output Draft Persistence・2b/2c/2d実装＋localhost確認完了・commit 6dec27d/5eec84b/7589f4f・tag v1.01-phase54-2d・本番実機未確認）

---

# Decision 052
## Phase54-2f は Mobile Review状態を output_drafts.review_state(JSONB) へ成果物単位で永続化する（Approval Sync/output_approvals 非接触・A案）

背景:
- Phase54-2d 本番実機確認で、スライド別レビュー状態 `_mobileReviewState`（「OK x/10」＝`statusBySlide`/`commentsBySlide`/`revisionTargetBySlide`/`approved`）が **メモリのみで F5・案件切替・再ログインで消失**することが判明。原因は、Draト本文は `output_drafts`、承認状態は `output_approvals` へ保存されるのに、`_mobileReviewState` だけ保存・復元経路が無かったこと（`setMobileReviewSlideOk` 等が一切POSTしていなかった）。**Phase54-2dのバグではなく、元々の保存対象外（仕様不足）**。

採用方針（A案・最小変更）:
- `output_drafts` に **nullable `review_state JSONB`** を追加（ユーザーが `ALTER ... ADD COLUMN IF NOT EXISTS`・非破壊・既存行NULL）。
- 成果物(output_id)単位で `statusBySlide`/`commentsBySlide`/`revisionTargetBySlide`/`approved` の4項目のみ保存。checklist/decision/Publishing Ready/cost/DOM/現在スライド/一時UI は保存しない。
- 復元は `restoreOutputDraftFromServer` で **同 output_id 行の review_state のみ** `_mobileReviewState` へ反映（NULLは既定維持・別output_id混入なし）。
- lib upsert は **指定(≠undefined)列のみ更新**へ変更し、「Draト本文保存(2c)」と「review_stateのみ保存(2f)」を同一upsertで互いに壊さず両立。server.js POST は `reviewState` 任意受領＋400を「outputId/caseId必須 かつ fields または reviewState」へ緩和（後方互換）。
- 保存タイミング: OK/修正依頼/修正対象/approved=即時、コメント(oninput)=デバウンス400ms。fire-and-forget・**Approval POST Queue 非利用（独立POST）**。

明示的に非変更（保護）:
- **output_approvals / Approval Sync GET / `mergeApprovalStateFromServer` / `pushApprovalToServer` / Approval POST Queue(1g) / output_id一致判定(1f) / Publishing Ready / Mobile Approval / Phase53 / cost系** は無変更。

却下:
- output_approvals へ per-slide を追加 → Phase54-1c/1f 保護領域の改変となるため不可。
- 内容から再計算 → statusBySlide はユーザー入力で再計算不可。

実施結果:
- DB: ユーザーが `ALTER TABLE output_drafts ADD COLUMN IF NOT EXISTS review_state JSONB;` 実行済み。commit **f0f382f**（`Phase54-2f persist mobile review state`・index.html/server.js/lib/outputDraftsDb.js/supabase/schema.sql の4ファイル）／Tag **v1.01-phase54-2f**（→ f0f382f）／push済み・Render反映済み。
- localhost実DB往復: OK→review_state保存（ローカル状態と完全一致・**fields無傷**）→F5→再オープンで「OK 2/10」＋コメント/修正依頼/修正対象/approved 復元・別案件混入なし・**Approval POST 0**・Mobile Approval/Publishing Ready回帰なし・console 0・dev-check 200/200/200。
- **本番実機確認（ユーザー通常ブラウザ）**: OK x/10保持・コメント/修正依頼/修正担当保持・F5復元・案件切替・別案件混入なし・元案件復元・Mobile Approval/Publishing Ready回帰なし・Approval Sync正常・console 0 → **Phase54-2 を正式 Complete とする**。

懸念（残・次候補）:
- review保存はfire-and-forget（1g Queue非利用）。同一スライド超高速連打時にPOST着順逆転で一時的にDBが最新でない可能性（各POSTは全snapshotを送るため次操作で収束）。厳密直列化が必要なら別Phase候補。コメントはデバウンス400msのため直後F5で最新コメント未保存の可能性（OK/修正/approvedは即時のため対象外）。

追記日: 2026-07-12（Phase54-2f Mobile Review State Persistence・Phase54-2 正式Complete・commit f0f382f・tag v1.01-phase54-2f・push済み・Render反映済み・本番実機確認完了）

---

# Decision 053
## Phase54番号整合＝実開発Phase54系はVersion1.1 Realtime Sync系（ROADMAP旧Phase54は履歴保持・Version2再採番）／Phase54-3 Remaining Realtime Sync の分割

背景:
- `04ROADMAP.md` は「Phase54」を **旧Version2計画**で使用（Version2 Core表＝Market Opportunity Intelligence／旧Company Brain v2ファミリー＝Phase54-1 Consult Engine/54-2 Self Review/54-3 Autonomous Quality Loop/54-4）。
- 一方、実開発の「Phase54-1x/2x/3x」は **Version1.1 Connected AI Company（Realtime Sync / Persistence）**（Approval Sync=54-1、Output Draft Persistence=54-2）。→ **Phase54番号が二重定義**。

決定（番号整合・非破壊）:
- **実開発Phase54系＝Version1.1 Realtime Sync系** と正式に定義する。
- **ROADMAP旧Phase54定義は削除・置換しない**。「旧Version2計画・superseded・実開発Phase54とは別」の**区別注記のみ追加**して履歴保持する。
- **Version2側は将来 `V2-Pxx` もしくは Phase60番台以降へ再採番**（Version2着手前に確定）。
- 以後の番号衝突を避けるため、Version1.1系は Phase54-x、Version2系は再採番後の名前空間を使う。

Phase54-3 Remaining Realtime Sync（残Realtime Sync完成工程）:
- 目的＝Task/Status/Auto Task/Timeline/Notification/Workflow Live の端末間同期完成（Version1.1「PC⇔スマホ同一AI会社」直結）。
- 調査結果の要点: Timeline/Notification/Workflow Live/Auto Task はすべて `global.__taskHistory`（**サーバーメモリ・非DB・Render再起動で消失**）から派生。Task は `tasks` テーブル/API完備だが**クライアントがGET pullしていない**（localStorageのみ）。通知未読 `_notifSeenIds` は非永続。Learning は主要DB化済み。Cost はJSON＋server-globalで端末非依存共有済み。
- **分割**：3a Task Basic Sync（全社共通Task・基本status 3値・pull配線・index.htmlのみ・案件分離なし）→ **3a-2 Task Case Scoping（`tasks.case_id`・案件別Task分離・DB/server/lib/index）** → 3b Task History Persistence（`task_history` DB化・**詳細Live Statusはここ**・要SQL）→ 3c Notification Unread/Workflow Live Restore → 3d 最終確認。**Cost＝別工程**（ファイル温存方針と整合要）。**Learning残buffer＝Version2候補**。3a以外は**未着手**。
- 採用理由：A案(Output Draft複数履歴)・C案(Review保存堅牢化)より、Version1.1の本来完成条件（端末間同一）へ直結するB案(残Realtime Sync)を優先。A/CはVersion1.1残同期完了後の候補として温存（却下ではない）。

Phase54-3a の設計判断（今回実装・localhost確認済み・未commit）:
- 既存 `GET /api/tasks`（DB由来）を pull・merge。**DB/API/SQL変更なし・新規pollingなし・index.htmlのみ**。
- **merge安全規則**：dbId(サーバーUUID)重複排除／未存在Taskのみ追加／同一Taskはサーバー `updated_at` 厳密新しい時のみ採用／localのみTask保持／失敗・空で削除しない／localStorageキャッシュ維持。
- **既知制約と対処**：クライアントstatus語彙(todo/working/reviewing等10種) vs `tasks.status` CHECK(pending/in_progress/done 3種)が不一致。rich statusのPATCHはCHECK違反で失敗し `updated_at` を進めないため、pull時に**rich statusを降格しない**設計とした（＝既存を壊さない）。完全な双方向status統一は 3b（task状態のサーバー語彙整合）以降で扱う。
- 保護：output_approvals/Approval Sync/Approval POST Queue/mergeApprovalStateFromServer/pushApprovalToServer/Phase54-1f/1g/output_drafts/review_state/Conversation/Case/Messages/Workflow Live/Notification/Cost/Learning 非接触。

追記日: 2026-07-12（Decision 053・Phase54番号整合＋Phase54-3 Remaining Realtime Sync 分割・3a Task Basic Sync 実装・localhost確認済み・未commit）

---

# Decision 054
## Phase54-3a-2 Task Case Scoping ＝ A案（`tasks` へ nullable `case_id`・messages.case_id 踏襲・NULL横断フォールバック）

背景:
- Phase54-3a で Task の端末間 pull・merge は完成したが、Task は **案件横断（`tasks.case_id` 列なし）**。Version1.1「PC/iPhoneで同じ案件を開くと同じTaskが見える」には案件別分離が必要。
- 既存55件のTaskは案件情報を持たない（`case_id=NULL`相当）。厳密分離すると既存Taskが全案件から消える＝既存機能破壊リスク。

決定（A案・追加のみ・非破壊）:
- `tasks` へ **nullable `case_id TEXT`（FKなし・既存行NULL維持）** を追加。**`messages.case_id`（Phase52-12.2）と同一設計思想**（null時は列を送らずNULL維持・後方互換）。
- **NULL横断フォールバック**：`case_id=NULL` のTaskは「横断Task」として **全案件・ホーム・未選択の全viewで常時表示**。既存55件を温存し非表示・強制分類しない。
- **case付きTask**：現在表示案件と一致する時のみ表示（別案件・未選択時は非表示）。表示フィルタは `renderTaskList`（`_taskViewCaseId()`）で表示時のみ適用し、クライアントは全Taskを内部保持（今後のHistory/Notification/Workflow Liveが全Task利用可）。
- **B案（即時厳密分離＋未分類専用ビュー）は不採用**（既存表示の挙動変更＝破壊リスク・UI追加大）。将来UIリファイン時の任意拡張として温存。

保護・契約維持:
- **`_taskSignature` は変更しない**（title¦memberId¦sourceMessage¦body）。case_idを署名へ足すと既存同期済みTaskと照合不一致→backfill重複POSTのため据え置き。
- **GET `/api/tasks` 既定は全件取得**（caseIdフィルタは任意のみ）。`backfillLocalOnlyTasks` の全件重複照合契約を維持。
- **caseId解決**：新規Task作成時のみ `_ensureTaskCaseId`（caseId未設定=undefinedのときだけ `getCurrentApprovalCaseId()` 付与・null明示/既存値は尊重）。**既存local-only Taskの再保存では現在案件を強制付与しない**（NULLのまま横断維持）。
- 保護：Approval/Output Draft/Review State/Conversation/Messages構造/Workflow/Timeline/Notification/Learning/Cost/Phase53 非接触。status CHECK問題は本Phase非対象（3b以降）。

Phase54-3b 接続方針（比較のみ・未着手）:
- **推奨＝案A（`task_history` 自身に nullable `case_id` を保持）**。理由＝履歴は「その時点の事実」であり、Task削除・欠損に独立して案件判定可（復元耐性・取得効率・同期単純さで有利）。`messages.case_id` と同一思想で一貫。案B（`task_id` のみ・`tasks.case_id` 参照）はデータ重複が少ない反面、tasks欠損時に案件不明化（FKなし方針）。

確認（localhost＋本番・Completed）:
- localhost（SQL実行済み・commit bc98455）：SQL反映（`tasks.case_id` 実在）／caseId付き保存・NULL保存・GET全件・GET?caseId=フィルタ／案件A/B分離（実DOM）／NULL横断（既存55件全view表示）／F5維持／**実ログアウト→再ログイン→案件A/B分離（実DOM）**／backfill重複POST 0・dbId重複0／既存55件減少なし／console 0／dev-check 200/200/200。
- **本番（Render `ai-company-l45x.onrender.com`）**：push→自動デプロイ反映（新server.js＝GET`?caseId=`サーバーフィルタ稼働・新index.html＝新関数稼働・GET正常・エラーなし・Render設定/環境変数変更なし）→ **本番PC確認済み**（案件A/B分離・NULL横断・F5・再ログイン維持・重複なし・既存減少なし・console 0）→ **ユーザー実機確認済み** ⇒ **Phase54-3a-2 Completed**。
- 検証テスト行5件（`ZZZ-TEST3a2-A/B/NULL`＋`ZZZ-RELOGIN-A/B`・識別可能・非活性・温存＝削除しない）。

追記日: 2026-07-13（Decision 054・Phase54-3a-2 Task Case Scoping A案採用・**Completed**・SQL実行済み・commit bc98455・tag v1.01-phase54-3a-2・push済み・Render反映済み・本番PC/ユーザー実機確認済み）

---

# Decision 055
## Phase54-3b-1 Task History Persistence ＝ 新規 `task_history` テーブル＋DB/メモリHybrid（永続化基盤先行・case_id配線は3b-2）

背景:
- Timeline/Notification/Workflow Live/Auto Task/Live Status はすべて `global.__taskHistory`（**サーバーメモリ・非DB・Render再起動/再デプロイ/スリープ復帰で全消失**）から派生。F5・再ログインでは消えないが**サーバー再起動で消える**のが本質課題。
- Phase54-3b を段階分割し、**3b-1＝永続化基盤（case_id配線・UI変更なし）** を先行実装。

決定（案A・追加のみ・非破壊）:
- **新規 `task_history` テーブル**へ永続化。**`case_id` は `task_history` 自身に nullable保持**（案A）。**案B（`task_history.task_id`→`tasks.case_id` 参照/JOIN）は不可**＝`task_history.taskId` は workflow task id（クライアントgenId）で `tasks.id` UUIDと一致せず信頼できるJOINキーが無いため。
- **`history_id TEXT NOT NULL UNIQUE`**：`onConflict: history_id` の冪等upsert（status running→completed の同一エントリ更新を単一行で反映・重複行を作らない）。
- **`status` はCHECKなしTEXT**（running/completed/error/skipped 等）＝tasks.status CHECKトラップを回避（本工程でstatus改善はしない）。
- **`meta JSONB`**：エントリの可変追加field（responseMs/ruleCount/knowledgeSummary 等）を吸収し、スキーマを安定化。
- **DB/メモリHybrid取得**：`GET /api/task-history`・`/api/workflow-dashboard` を「DB＋メモリを `history_id` でdedup・メモリlive優先」に変更。**レスポンス形は不変**（`{ok,history,total}`／`{ok,workflows,total}`）。再起動後はメモリ空→DBから復元。
- **保存はfire-and-forget**（`_persistTaskHistory`・非ブロック）＝**DB保存失敗でもWorkflowを止めない**／`global.__taskHistory` は従来どおり維持（メモリを正としつつDBを永続層に併設）。

保護・非対象:
- `case_id` は本工程では常にNULL（横断）＝実配線は**3b-2**。Timeline/Notification/Workflow Live の案件別表示・Notification永続化・status改善・polling/WebSocket追加は本工程外。
- Approval・Output Draft・tasks.case_id・NULL横断Task・Workflow・Provider・Routing・Cost 非接触。新規エンドポイントなし・既存API削除/置換なし。

確認（localhost・実DB・commit 2e4b0fc）:
- SQL実行済み（`task_history` 作成成功）／round-trip＋meta復元／`history_id` 冪等upsert（running→completed で**重複行0**）／Hybrid(memory+DB) dedup（実consult1回・appearCount=1・live優先）／**サーバー再起動2回後もDBから履歴復元**（lib挿入＋実consultの2件・dupInGet 0・workflow-dashboard集約）／DB未作成でもgraceful（throwなし・従来動作）／既存consumer回帰なし／console 0／dev-check 200/200/200。
- 検証テスト行2件（`zzz-3b1-rt-*`／`consult-1783955050504-p53pn`・識別可能・非活性・DELETE未実施）。
- **本番（Render）**：push→Render自動デプロイ反映（新Hybridコード稼働＝本番GETがDB履歴返却）→ 本番API確認（`/api/task-history`・`/api/workflow-dashboard` 200・レスポンス形不変・DB履歴取得・重複0・from filter・console 0）→ **Render再デプロイ後の新規インスタンス（メモリ空）もDB履歴復元** ⇒ **Phase54-3b-1 Completed**。

追記日: 2026-07-14（Decision 055・Phase54-3b-1 Task History Persistence 永続化基盤・**Completed**・commit 2e4b0fc・tag v1.01-phase54-3b-1・push済み・Render反映済み・本番API/再デプロイ後DB復元確認済み）

---

# Decision 056
## Phase54-3b-2 Task History Case Scoping ＝ case_id を task history 各行へ配線＋GET任意フィルタ＋クライアント表示側でNULL横断

背景:
- Phase54-3b-1 で `task_history` 永続化＋DB/メモリHybridが完成。次に **Task History を案件単位で分離**（案件Aの履歴が案件Bに出ない・NULL横断は両案件表示）。
- `task_history.case_id` 列は3b-1で既に用意（nullable・3b-1では常にNULL）。3b-2で実配線。

決定（追加のみ・非破壊・新規SQL不要）:
- **client送信**：`/api/auto-task`・`/api/consult` POST に `caseId: getCurrentApprovalCaseId() || null`（tasks/Approval/Draftと同一の現在案件解決関数を流用）。未確定時はnull＝横断履歴。
- **server保存**：受領 `caseId` を生成履歴の各エントリへ付与（`h.caseId == null` のときのみ＝既存値を尊重／auto-taskはworkflow全エントリへ一括付与・consultは単一エントリ）。永続化は3b-1の `_persistTaskHistory` がそのまま `case_id` を保存。
- **GET任意フィルタ**：`GET /api/task-history?caseId=`・`/api/workflow-dashboard?caseId=` を追加。**引数なしは従来どおり全件**（`backfill`相当＝クライアント全保持を維持）。`?caseId=X` は**該当案件のみ厳密**（NULL含まず）。`_hybridTaskHistory` にcaseId追加（メモリ・DB両方をcaseId厳密フィルタ）。
- **NULL横断はクライアント表示側で担保**：`_historyVisibleInView(entry)`＝`caseId==null ? 常時表示 : caseId===現在案件`。`renderNotifications` に適用。「**クライアントは全履歴を保持し、表示時のみ案件別に絞る**」方針（サーバーGETは全件のまま・厳密フィルタは任意用途）。案件画面＝該当案件＋NULL横断／ホーム・未選択＝NULL横断のみ。

適用範囲（既存表示を壊さない・Workflow Live大幅変更しない）:
- **Notification（renderNotifications）** に案件別表示フィルタ適用。
- **Workflow Live（aiLivePoll）** は workflowId scoped（1 workflow=1案件）で既にスコープ済み＝変更なし。
- **各種 workflow-dashboard** は全社サマリとして全件維持（大幅変更しない）。任意 `?caseId=` フィルタは提供。
- **Learning（refreshLearningPanel）** は全社学習で case非対象＝据え置き（Learning非接触）。

保護・非対象:
- レスポンス形不変（`{ok,history,total}`／`{ok,workflows,total}`）・3b-1のHybrid/dedup維持・`global.__taskHistory`維持・status改善せず・新規SQL/DB構造変更なし・polling/WebSocket追加なし。Notification未読永続化・Timeline独立案件化・Workflow Live Restore は 3b-3以降候補。

確認（localhost・実DB・commit b5ab89d）:
- consult(caseId)：entry.caseId保存・GET`?caseId`厳密・appearOnce=1。
- **Auto Task実ワークフロー1回（案件A・実AI）**：生成6行全て `case_id=A`・history_id重複0・GET`?caseId=A`→6/`?caseId=B`→0・NULL横断存続・**Notification実描画 案件A=6件/案件B=0件**・workflow-dashboard形不変＋`?caseId`フィルタ（Aに出現/Bに非出現）。
- サーバー再起動後も case_id 維持（DB復元・dup 0）／既存consumer回帰なし／console 0／dev-check 200/200/200。
- **本番（Render）**：push→自動デプロイ反映（本番`?caseId=`フィルタ動作＝新コード稼働）→ 本番API確認（レスポンス形不変・caseId付き履歴DB取得・重複0・`?caseId`厳密・console 0）→ **ユーザー実機確認済み（案件A専用履歴が他案件へ混入しないことを確認）** ⇒ **Phase54-3b-2 Completed**。F5/再ログイン/再起動後もDB永続・NULL横断維持・Notification案件分離確認・Workflow Live/Timeline回帰なし。

追記日: 2026-07-14（Decision 056・Phase54-3b-2 Task History Case Scoping・**Completed**・push済み・Render反映済み・本番/ユーザー実機確認済み・commit b5ab89d・tag v1.01-phase54-3b-2）

---

# Decision 057
## Phase54-3b-3 Notification既読DB永続化（B案）＋Timeline案件別表示＋Workflow Live履歴フォールバック復元

背景:
- `_notifSeenIds`（in-memory Set・非永続）は F5/再ログイン/再起動で消失＝全通知が再未読化。Timelineは案件混在表示。Workflow Live（`__workflowProgress`・メモリ・1時間TTL）は再起動で消失。

決定（追加のみ・非破壊）:
- **Notification既読＝B案（DB永続）採用**（A案 localStorage単独は不採用）。理由＝Version1.1「PC/iPhoneで同じAI会社」の**端末間既読一致**が要件。**Web認証は単一共有パスワード＝単一論理アカウント(web-user)** のため `notification_reads` は **user_id列なしのグローバル**で自然に端末間一致。
- `notification_reads(history_id PK, case_id, seen_at, created_at)`。**`history_id` PK＋`onConflict:history_id`＋`ignoreDuplicates`** で冪等（重複行なし・created_at初回値保持）。`GET ?limit=`（既定1000/上限5000・`created_at DESC`）で将来の大量データに対応・`?caseId=`任意。
- `_notifSeenIds` はクライアントキャッシュとして維持（即時UI）＋ DBを真実源として起動/再ログイン時に復元。保存はfire-and-forget（**DB失敗でもNotification表示を止めない**）。
- **Timeline案件別**：`_timelineEventVisibleInView`＝wfId空/NULLは横断（常時表示）・case付きは現在案件のみ。**空/NULL eventを消さない**（過剰フィルタ防止・learning/health/system/case無task維持）。client表示フィルタのみ（server/DB変更なし）。
- **Workflow Live復元**：`__workflowProgress`有り＝既存Live優先。**found:false時のみ** task_historyから静的復元（担当/action/status/caseId/開始・完了時刻）。**回答本文は復元対象外**（task_historyに本文列なし）。

保護・非対象:
- 既存APIレスポンス形不変・task_history Hybrid/dedup維持・3b-2案件分離非接触・`global.__taskHistory`維持・per-user識別なし（単一アカウント）・status改善なし・polling/WebSocket追加なし。回答本文復元・Phase54最終統合は範囲外。

確認（localhost・実DB・commit 3e3c432）:
- 既読 POST(count)/GET(`{ok,seenIds,total}`)・**冪等再POSTで重複行0**・limit・空POST400／`_notifSeenIds`をクリア→復元で既読反映（F5/再ログイン相当）／Timeline A/B分離＋空/NULL横断維持（8パターン）／Workflow Live復元(担当sns/status completed/caseId=A/本文空・履歴6件)／既存consumer回帰なし／console 0／dev-check 200/200/200。
- 検証行（`zzz-3b3-*` 既読・非活性・DELETE未実施）。
- **本番・実機（Completed）**：push→Render反映→本番API確認（notification-reads GET/POST/limit/冪等・重複0・形不変）→**ユーザー実機確認済み（PC→iPhone／iPhone→PC 通知既読同期・F5/再ログイン後も既読維持・表示操作正常）** ⇒ **Phase54-3b-3 Completed**。

Phase54 最終統合確認（2026-07-14・合格＝**Phase54 Remaining Realtime Sync 正式Complete**）:
- localhost（再起動直後＝メモリ空）＋本番の両方で、案件分離（Task/Task History/Timeline A/B・NULL横断維持）・Approval/Draft/Review State案件別復元（混入なし）・Task60件維持（重複0）・Task History DB復元（dup0）・既読DB復元（dup0・PC⊄iPhone双方向同期は実機確認済み）・Workflow Live既存経路＋historyフォールバック（本文なし＝仕様）・Messages復元・全consumer回帰なし・console 0・dev-check 200/200/200 を確認。
- **成果＝Version1.1「PC⇔スマホ同一AI会社」の同期基盤成立**（Approval／Draft／Task／Task History／Notification／Timeline／Workflow Live）。Cost同期＝別工程・Learning残buffer＝Version2候補・回答本文のtask_history保存＝将来候補。
- tag **v1.01-phase54-complete**（Phase54最終docs commitを指す）。

追記日: 2026-07-14（Decision 057・Phase54-3b-3 **Completed**＋Phase54 正式Complete・最終統合確認合格・tag v1.01-phase54-complete）
