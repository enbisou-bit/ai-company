# CHANGELOG — ENBISOU AI COMPANY

> 本番反映済みの主要変更履歴（新しい順）。詳細は docs/02PHASE_PROGRESS.md を参照。

---

## ASP Product Fact Record（APFR）─ Step A Core／Step B Manual Input UI **正式リリース**（2026-08-21）／プラファスト **本番実運用検証Complete**（2026-08-22）／**Phase 0 再Adopt時Fact消失防止＋Phase 1 Current Fact Resolver＋CUI-0 Correction-aware Duplicate Policy＋CUI-1 Current Fact / History UI＋CUI-2 Correction UI Core**（2026-08-22〜23）／**APFR Correction UI Core CUI-0〜CUI-2 正式リリースComplete**（2026-08-24・Decision108）／**本番認証後Correction UI最終目視確認Complete**（2026-08-24・Decision108）／**Step C-1A Compliance Context Foundation ＋ Step C-1B Writer/Reviewer Compliance Injection 正式リリースComplete**（2026-08-24・Decision108・Tag `v1.01-apfr-compliance-injection`）／**Step C-1C-1 Deterministic Compliance Check 正式リリースComplete**（2026-08-24・Decision108・Tag `v1.01-apfr-deterministic-compliance-check`）／**Step C-2-1 Formal Truth Numeric Consistency Check 正式リリースComplete**（2026-08-25・Decision108・Tag `v1.01-apfr-formal-truth-numeric-consistency`）／**Leader Case Context Phase2 + Option B Code Implementation Complete**（2026-08-25・Decision108・Code commit `95eaa899`）／**Leader Final Grounding Option F Code Implementation Complete**（2026-08-26・Decision108・Code commit `04e28a08`）／**APFR Step C-1C-1b Advertising Disclosure Detection Code Implementation Complete**（2026-08-26・Decision108・Code commit `e23c0df8`）／**APFR Step C-1C-2a Compliance Assessment Aggregation Code Implementation Complete**（2026-08-27・Decision108・Code commit `659e82ce`）／**APFR Step C-1C-2b-1 Mobile Approval Enforcement Code Implementation Complete**（2026-08-27・**新規Decision 109**・Code commit `46b37dc2`）／**APFR Step C-1C-2b-2 IADP Approval Enforcement ─ Not Required正式化**（2026-08-27・Decision109追記・Code変更0）／**APFR Step C-1C-2a-1 Compliance UI Scope Correction 正式リリースComplete**（2026-08-27・Decision108追記・Code commit `112dafd6`・stage-1 docs commit `a97109bb`・main push済み・Annotated Tag `v1.01-apfr-compliance-ui-scope-correction`（target `a97109bb`）push済み・Render反映確認済み〔本番3endpoint 200・本番 `index.html` とローカルHEAD byte-identical〕・最新 `leaderFinalGrounding.test.js` 52/53 PASS〔FAIL `20-2a` のみ・既知制約・53/53 PASSとは記録しない〕・Compliance Enforcement全体／Quality Gate Grounding／READY Grounding Completeとは記録しない）／**APFR Step C-3-1 Grounding Detection ─ Not Required 正式化**（2026-08-28・Decision108追記・docs-only stage-1・Code変更0・実測15件中 Class A 0件／B 12件／C 3件・Formal Truth 21field中 deterministic対象0件・claim extraction不成立・`clear`／`supported`等は新設しない・C-3系列〔C-3-1〜C-3-3〕は実装系列として取り下げ・Leader Final Grounding＝B／Option F E2E＝A維持・Grounding Complete等とは記録しない・Quality Gate／READY／Mobile Approval／C-2-1 変更0・C-2-2 未着手）／**APFR Compliance Restrictions deterministic化 ─ Not Required 正式化**（2026-08-28・Decision108追記・docs-only stage-1・Code変更0・判定C・実案件 `complianceRestrictions` 4値すべて directive／obligation・Type A/B 実データ0件・substring実測で残存3表現 検出0件〔false negative 100%〕かつ遵守表明／正しい開示を violation 誤検出・`広告表示必須` は positive obligation で意味逆転・SoT分離〔`listingNgWords`＝deterministic禁止語／`complianceRestrictions`＝自然言語制約〕・C-1C-1判断は維持・`_apfrEvaluateComplianceAssessment()`／Mobile Approval／Quality Gate／READY 変更0・`listingNgWords` チャネル意味ズレは別課題・Option D 完全採用とは記録しない・Compliance Complete／Compliance Enforcement Complete とは記録しない）

- **Contract**：正式Contract「ASP Product Fact Record（APFR）」を設計正式化。A8.net等ASP・広告主LPで確認された商品単位の事実を、出典・検証状態・分類付きでcase-scoped Product Formal Truthとして保持する契約。EER（Decision107・行為のFormal Truth）とは責務分離（EER=行為／APFR=商品事実）。`classification`は`fact`/`prediction`/`inference`/`unknown`の4値。**AI自身の判断による`fact`昇格を禁止**——`sourceMethod`が`a8_screen_user_verified`/`advertiser_lp_user_verified`かつ`verificationStatus:user_verified`かつ`verifiedBy:user`の場合のみFact昇格可、`manual_user_input`単独では不可。
- **Step A Core**：`_intelBlankProduct()`へ`facts:[]`追加。純関数`validateApfrRecord()`（必須field検証・Fact昇格条件・入力非破壊・推測補完なし）と`_apfrAppendRecord()`（caseId/productIdentifier guard・重複防止・履歴保持・既存`pushOutputDraftToServer()`経由保存）を実装。`product.facts`は既存`intelligenceContext`（既存`FORMAL_CASE_FIELDS`の1つ）内にあるため専用carry-forward配線は不要だった。合成テスト`apfrCore.test.js`：**49/49 PASS**。Code commit **3113e53**。
- **Step B Manual Input UI**：Affiliate Intelligence Coreパネル内、ASP Intelligence表示の直後へAPFR入力パネルを追加。classificationは自由入力させず、provenance（A8実画面／広告主LP／その他手入力）選択＋User Verification明示チェックの組み合わせからのみ内部で確定。A8/LP選択時に未チェックだと登録ボタンをdisabledにし安全に停止。必ずStep A Coreを経由し独自Validatorは実装していない。削除・直接編集UIは実装しない。localhost実機検証（専用テスト案件`case-msoplrg6gdkr`）でA8/広告主LP/manual各provenance・ボタンdisabled/enabled切替・重複登録防止・履歴保持・F5復元・別案件（本番実案件含む）でのCross-case非混入を実測、検証後は原状復帰済み。合成テスト`apfrManualInputUi.test.js`：**35/35 PASS**。Code commit **1e8de4f**。
- **実商品登録（Step A/B正式リリース時点・2026-08-21）**：実案件`case-msr9yckye65y`へのAPFR登録は0件（プラファスト未登録。同案件には採用済み商品自体が存在しないためAPFRパネルもまだ出現しない＝正常）。
- **本番実運用検証Complete（2026-08-22）**：ユーザー本人が本番UIでプラファストのAffiliate Evaluation登録・商品採用を実施しAPFRパネル出現を確認した上で、対象`case-msr9yckye65y`／productIdentifier`["プラファスト","a8.net"]`／ASP `A8.net`へ**APFR_FIELD_ORDER全21フィールドを1フィールドずつ登録＝21/21 Complete**。Fact総**22レコード**（`listingNgWords`のみ訂正履歴として旧Fact`["法人名"]`が残存し最新正Factは`["商品名","法人名"]`。**総レコード数ではなく「21フィールドすべてに正しい最新Factが存在するか」で判定**）。**Contract違反0件**（type/classification/sourceMethod/verificationStatus/verifiedBy/caseId/productIdentifier全件整合・`factId` 22件unique）・**Cross-case混入0件**（32案件・67 draft行走査）・Persistence確認済み（Supabase `output_drafts` `out_1787060723866`）。`sourceMethod`は`a8_screen_user_verified` 21件・`advertiser_lp_user_verified` 1件（`regulatoryCategory`のみ）で**AI推測によるFact昇格0件・`manual_user_input`単独からのFact昇格0件**。無回帰実測：IADP Quality=**100/complete**・Quality Gate=**Passed**・Reviewer=**Passed**・Strategy=**Accepted**・User Approval=**Approved**・External Execution=**3件executed**・Evidence=**9件**。Claude Codeは全工程で読み取り専用確認のみ・Fact登録0件。**docs更新のみ・Code変更0・DB変更0・API変更0・Fact追加/削除/編集0・Tag/Push/Render未実施**。Leader Case Context Phase2は不混入・引き続き本番未commit。
- **Phase 0 再Adopt時Fact消失防止（2026-08-22・Code commit `d69ff60`）**：商品採用処理が`_intelSyncProductFromAffiliate()`→`_intelBlankProduct()`（`facts:[]`）由来の新productを`ctx.product`へ丸ごと代入するため、**同一商品を再Adoptすると登録済みAPFR Factが全消失する**潜在的データ損失リスクを発見・解消。純関数`_apfrCarryOverFacts()`を追加し**同一caseId かつ 同一productIdentifier の場合のみ**carry-over（別case／別商品は0）。`productIdentifier`は既存仕様どおり文字列として厳密一致比較。deep clone・入力非破壊・配列順と訂正履歴を維持。永続化経路は商品採用の1箇所のみで他5箇所は使い捨てctxであることを実測確認。合成テスト`apfrReadoptCarryOver.test.js` **40/40 PASS**。APFR Contract変更なし・本番再Adopt実行0。
- **Phase 1 Current Fact Resolver（2026-08-22・Code commit `46c51ef`）**：APFRは追記専用のため読み取り側で正本を決める責務が必要。read-only純関数`_apfrResolveCurrentFact(product, field)`／`_apfrResolveCurrentFacts(product)`を追加し、**Current Fact Resolver／Correction／Ambiguity（fail-closed）／Legacy Fallback／Step C開始条件**の各Contractを正式化。解決順序は①明示訂正chain（任意field`supersedesFactId`）を最優先（`recordedAt`より優先）→②明示関係が対象field内に皆無の場合のみ`recordedAt`最大→③一意決定不能は`ambiguous`＋`currentFact:null`。母集団はcaseId/productIdentifier/field完全一致かつ`validateApfrRecord()` validのみで**Cross-case・Cross-product・invalid Factを除外**。**明示chainと独立legacyの並存（`multiple_chain_terminals`）・timestamp collision（`recordedAt_collision`）はいずれもambiguous**とし、**factId辞書順・配列順・sourceMethod優先・value比較といった恣意的tie-breakerは使わない**。ambiguous reason 12種を実装。**既存プラファスト22 Factはmigration不要**で`listingNgWords`はlegacy fallbackにより新Fact`["商品名","法人名"]`をresolved・旧Factは`candidates`に残存。本番相当fixture（21 field/22 records）で**resolvedCount=21・noneCount=0・ambiguousCount=0**。合成テスト`apfrCurrentFactResolver.test.js` **70/70 PASS**・実装との等価性を機械比較で確認。**Resolverはread-only・UI未接続・Step C未接続・DB書き込み0**。
- **Phase 0/1 回帰**：`apfrCore.test.js`（49/49）／`apfrManualInputUi.test.js`（35/35）／`externalExecutionRecord.eer1.test.js`（51/51）／`iadpQualityContractRouting.test.js`（86/86）／`iadpStructuredOutput.test.js`（13/13）／`evidencePromotion.eea10b.test.js`（17/17）／`costTracker.eea8.test.js`（19/19）**全PASS・新規FAIL 0**。dev-check **200/200/200**。DB変更0・API変更0・`server.js`変更0・APFR Fact変更0・Leader Case Context Phase2不混入。新規Decision番号は作成せずDecision108へ追記。
- **CUI-0 Correction-aware Duplicate Policy（2026-08-22・Code commit `9ad76f8`）**：Phase 1で正式化したCorrection Contractが表現する多段訂正のうち、`A(value=1)`→`B(value=2, supersedes A)`→`C(value=1, supersedes B)`という**「元の値への正式な差し戻し訂正」が`_apfrRecordsEqual()`の比較に`supersedesFactId`が含まれていなかったため`duplicate_record`で誤拒否**されていた問題を解消。**`supersedesFactId`をduplicate identityへ追加**（比較項目を8→9項目へ拡張）し、`C`は`A`と同値でも訂正関係が異なるため別の正式Correction Recordとして扱う。一方で**全9項目（`caseId`/`productIdentifier`/`aspName`/`field`/`classification`/`sourceMethod`/`sourceReference`/`value`/`supersedesFactId`）が一致する完全同一Correction Recordは従来どおり拒否**し、**duplicate防止自体は弱めていない**。未設定は既存`aspName`／`sourceReference`と同じ`(a.supersedesFactId || null)`方式に揃え、**property未存在／`undefined`／`null`／`''`をすべて「訂正関係なし」として同一扱い**。**通常Record同士のduplicate判定はCUI-0以前から一切変更なし**（CUI-0前実装との機械比較で全差分パターン一致を確認）。**責務境界**：chain異常（orphan／self／cross-field／cross-case／cross-product／branched／circular）の判定はduplicate関数の責務ではなく、Phase 1 Resolverが`ambiguous`＋`currentFact:null`のfail-closedで処理する（orphan参照Recordは登録が通るがResolverが`orphan_reference`を返しFormal Truth読み取りは汚染されないことを実測）。**append-only原則は不変**で旧Factのmutation・削除・`superseded`書き込みは一切なく、`A→B→C`はFact総数3件として全件保持。CUI-0専用テスト`apfrCorrectionDuplicate.test.js` **65/65 PASS**（差し戻し訂正成功・Resolverが`explicit_chain`でCをresolved・recordedAt逆順でもchain優先・4段訂正整合・二重登録拒否維持）。既存回帰全PASS（Resolver 70/70・Phase 0 40/40・APFR Core 49/49・Manual Input UI 35/35・EER 51/51・IADP Quality 86/86・IADP Structured 13/13・Evidence 17/17・Cost Tracker 19/19）・**新規FAIL 0**・dev-check 200/200/200。変更は`index.html` +11行（実質は比較1行）／テスト新規503行のみで`_apfrAppendRecord()`／`validateApfrRecord()`／Resolver／Fact schema／Fact昇格条件は無変更。main push済み・**Render自動Deployにより本番配信コードへの反映を確認済み**・**CUI-0用Tagは未作成**。DB変更0・API変更0・`server.js`変更0・APFR Fact変更0。
- **CUI-1 Current Fact / History UI（2026-08-23・Code commit `1cf3b2e`）**：Step B以降「登録済み情報」が`product.facts`を配列順に全件フラット表示していたため、本番`listingNgWords`で旧`["法人名"]`と訂正`["商品名","法人名"]`が同じ見た目で2行並び、**ユーザーがどちらを現在の正式値として扱うべきか画面上で判断できない**状態だった問題を解消。**Phase 1 Current Fact Resolverを初めてUIへ接続**（表示専用・read-only）。**Current Fact UI Contract**：現在値一覧は**`_apfrResolveCurrentFacts(product)`の結果のみを使用**し、UI側が`facts`配列末尾・`recordedAt`最新・`sourceMethod`・`value`・配列順から独自にcurrent Factを決定することを**禁止**（**ResolverはUIにおいてもcurrent Fact判定の唯一の口**。実装の静的検証をテストへ組み込み）。`resolved`のみ`currentFact`を「現在の情報」に表示し**旧Factを混在させない**（表示順は`APFR_FIELD_ORDER`）、`none`は「○ 未登録」で21フィールドの充足状態を可視化、**`ambiguous`は`currentFact`を表示せず**理由と候補件数のみ示し**候補の代表表示もしない**（Ambiguity Contractのfail-closedをUIでも維持）。**History UI**：全件フラット表示を廃止し「現在値一覧＋折りたたみHistory」へ分離（`<details>`・**既定は閉**）。Historyはappend-onlyの全Factを保持表示し、「現在値」「過去の記録（現在は使用されていません）」の区別は**Resolver結果から動的導出のみ**で**旧Factへ`status:'superseded'`等を保存しない**。通常表示は21行固定のため**Factが50件・100件に増えても通常画面が履歴件数に比例して長くならない**。**boolean日本語表示を同時実装**（`productLinkAvailable`＝利用可/利用不可、`reviewRequired`＝あり/なし、`mobileOptimized`・`itpSupported`・`linkManagerSupported`＝対応/非対応。Manual Input UIのboolean selectも`option value`は`'true'`/`'false'`維持で**labelのみ**日本語化。**保存値は`boolean`のまま不変**）。`listingPolicy`の`"一部ok"`は**normalizeせず保存値のまま表示**（訂正は将来Correction UIでユーザー本人が実施）。**listingNgWords実例**：現在値一覧は`["商品名","法人名"]`のみ、Historyは旧・新2件保持、**旧FactのDB変更・削除・mutation 0件**。CUI-1専用テスト`apfrCurrentFactUi.test.js` **78/78 PASS**、既存回帰全PASS（CUI-0 65/65・Resolver 70/70・Phase 0 40/40・APFR Core 49/49・Manual Input UI 35/35・EER 51/51・IADP Quality 86/86・IADP Structured 13/13・Evidence 17/17・Cost 19/19）・**新規FAIL 0**・dev-check 200/200/200・localhost実機**Console Error 0**。変更は`index.html`（+126/-12）／テスト新規587行のみで旧`_apfrBuildFactsListHtml()`は完全置換（残存参照0件）。main push済み・**Render自動Deploy反映確認済み**・**Tag未作成**。DB変更0・API変更0・`server.js`変更0・APFR Fact変更0。
- **CUI-2 Correction UI Core（2026-08-23・Code commit `fd99134`）**：**Resolverで`resolved`となった現在Factを、ユーザー操作によって正式なCorrection Recordとして訂正するUI**を実装。正式フローは`Resolver`→`resolved` current Fact→Current Fact UI「訂正」→**Correction Target**→Manual Input UIの訂正モード→**submit直前のResolver再検証**→`supersedesFactId`自動付与→**既存APFR Core**→append-only保存→Resolver再評価→新Factがcurrent／旧FactはHistory。**Correction Target**（`_apfrCorrectionTarget`）は`caseId`／`productIdentifier`／`field`／`currentFactId`の**4項目のみ**を保持し**Fact本文は保持しない**（Formal Truthの複製を作らない）。**status別契約**：`resolved`のみ訂正可（対象はResolverの`currentFact`のみ）／`none`はCorrectionでなく通常新規登録で`supersedesFactId`を付けない／**`ambiguous`は訂正ボタン非表示・Correction禁止・候補の代表選択なし**（fail-closedをUIでも維持）。**stale Target対策（重要）**：開始時に加え**submit直前にもResolverを再実行**し`status==='resolved' && currentFact.factId === target.currentFactId`を要求。不一致時は**登録停止・append 0・Target破棄**とし、**古いFactへ訂正をつないで`branched_chain`を生成する事故を防止**。**scope安全性**：Cross-case／Cross-product／Cross-field をいずれも禁止し、fieldは**UI固定（`selected`＋`disabled`）＋submit時の一致再検証**の二重防御。**append-only維持**（旧Factの編集・削除・置換・`superseded:true`等のmutationは実装なし）。**duplicate判定はCUI-0のpolicyをそのまま再利用**しCUI-2独自判定は0（検証順序は stale再検証→Core duplicate判定。**stale時はTarget破棄／duplicate等の通常failure時はTarget保持**して再試行可能）。**User Verification維持**（Correction専用Validatorなし・`manual_user_input`やチェック未了は訂正でもfact昇格しない・**AI自動訂正禁止**）。追加state 1・追加helper 5・変更関数5で、**Core 3関数・Resolver 4関数・`_apfrBuildHistoryHtml`はいずれも無変更**。`supersedesFactId`の代入は**1箇所のみ**かつ**再検証を通過したTargetからのみ**。新規テスト`apfrCorrectionUi.test.js` **105/105 PASS**（22ケース群）、既存回帰全PASS（CUI-1 78/78・CUI-0 65/65・Resolver 70/70・Phase 0 40/40・APFR Core 49/49・Manual Input UI 35/35・EER 51/51・IADP Quality 86/86・IADP Structured 13/13・Evidence 17/17・Cost 19/19）・**新規FAIL 0**・dev-check 200/200/200・localhost**Console Error 0**・通常Manual Input UI無回帰。変更は`index.html`（+165/-5）／テスト新規804行のみ。**実DBへのCorrection Fact登録0件・本番`case-msr9yckye65y`の22 Factは無操作**。**DB変更0・API変更0・`server.js`変更0**。**⚠ CUI-2 Completeは「Correction UI Coreの完成」であり、CUI-3／CUI-4／Step C／Intelligence接続／EEA問題／Quality Gate・Hold問題／LCC Phase2 のCompleteをいずれも意味しない**。**本エントリ時点でCUI-2のCode push・docs push・Tag・Render反映はいずれも未実施**。
- **APFR Correction UI Core CUI-0〜CUI-2 正式リリースComplete（2026-08-24）**：Code commit `fd99134`・docs commit `186ec63` をmain pushし、HEAD／origin/main とも `186ec6371676e0ad9ab49368f2899bf9e4155f90` へ同期（ahead/behind 0/0）。**正式Tag `v1.01-apfr-correction-ui-core`（Annotated・message「APFR Correction UI Core CUI-0 to CUI-2 complete」・target `186ec637...`）を作成しtag push済み**。**Render**：本番反映済み（トップ200／`/api/task-history`200／`/api/workflow-dashboard`200）。本番配信コードに`_apfrCorrectionTargetFor`／`_apfrStartCorrection`／`_apfrCancelCorrection`／`_apfrValidateCorrectionTarget`／`_apfrBuildCorrectionHeaderHtml`すべて存在確認、`buildLeaderCaseContext`は本番0件（**LCC Phase2は引き続き本番未リリース**）。**本番検証（区別して記録）**：①**Complete**＝本番配信コードを本番Supabase実データ（`case-msr9yckye65y`／プラファスト22 Fact）へread-onlyで適用し、`resolved`21／`none`0／`ambiguous`0、訂正ボタン21件（`disabled`混入なし）、`listingNgWords`でのCorrection mode正常生成（現在値`["商品名","法人名"]`表示・入力欄への値注入なし）、submit直前検証正常、History22件既定閉、**facts配列は実行前後で完全不変・DB書き込み0**を確認。②**Pending**＝本番URLが合言葉認証画面で停止しており認証情報未提供のため、**認証後の実ブラウザ操作による最終目視確認のみ未実施**（正式リリース失敗ではない。「本番ログイン後の実画面で確認済み」とは記録しない）。**Data Safety**：Correction Fact登録0・本番Fact変更0・DB schema変更0・API変更0・`server.js`変更0・Render設定変更0・環境変数変更0。
- **本番認証後Correction UI最終目視確認Complete（2026-08-24）**：ユーザー本人が本番URLへ認証後ログインし実ブラウザで確認。resolved Fact行の「訂正」ボタン表示／「訂正」押下によるCorrection modeへの正常遷移／Correction mode内の現在値（Current Fact）正常表示／訂正対象fieldの固定表示／新しい値の入力欄が空（旧値自動コピーなし）／「訂正をやめる」ボタン正常表示／押下後の通常「情報を1件登録」モードへの正常復帰・Correction Target残留なし、をすべて確認。**「確認済みFactとして登録」は押していないためCorrection Fact登録0・本番Fact変更0・DB書き込み0を維持**。**Console Errorの追加実測は今回のスクリーンショット確認では未実施**（画面動作の目視Completeとは区別。既存テスト・localhost確認のConsole Error 0記録は不変）。これにより**Correction UI Core系列（CUI-0〜CUI-2）に残っていたリリース確認Pendingは0**となった。
- **Step C-1A Compliance Context Foundation（2026-08-24・Code commit `9d66525`）**：Compliance Formal Truth 4field（`listingNgWords`／`advertisingDisclosureRequirements`／`complianceRestrictions`／`regulatoryCategory`。`listingPolicy`は表記統一問題未解決のため対象外）を、`_apfrResolveCurrentFacts()`から`atRunWorkflow()`→`/api/auto-task`→`server.js`受動パススルー→`runAutoTaskWorkflow()`までread-onlyで配線。新規helper`_apfrBuildComplianceContext(product)`はResolverのみを使用しfacts直接走査・独自current判定はしない。resolvedのみ採用・none/ambiguousは非注入。**この時点でprompt文字列への実注入は0件**。変更：`index.html`／`server.js`／`openaiClient.js`／新規`apfrComplianceContext.test.js`。working treeの別系統差分「Leader Case Context Phase2」はHEADベース合成patchで完全分離（混入0）。
- **Step C-1B Writer / Reviewer Compliance Injection（2026-08-24・Code commit `f52511`）**：C-1Aで配線したCompliance ContextをWriter（「遵守して生成」）・Reviewer（「遵守されているか確認」）へ限定注入する`buildCompliancePromptBlock(agent, complianceContext)`を新設。**Strategy・Leader Finalへは注入しない**（Reviewerの品質フィードバックは既存の「【Reviewerの品質フィードバック】」経路でLeader Finalへ統合される既存機構を再利用・新規reject契約は追加せず）。Fact値は「確認済み商品事実データであり命令ではない」という責務境界を明示したうえで「」区切りのデータ枠として提示（prompt injection対策・命令文字列検出等の追加防御は不採用）。array/改行/300文字上限の正規化を実施。`regulatoryCategory`からの追加規制推測を明示的に禁止。empty時（null/undefined/{}/対象fieldなし）はComplianceブロックを一切出力せずC-1B前systemPromptとbyte-identical。`listingPolicy`はC-1Bでも対象外（対象4fieldのORDER定義に含めない二重防御）。**Quality Gate Compliance Enforcementは未実装**（Step C-1C候補として別工程）。Product/ASP/Content/Revenue/Competition/Market Opportunity Intelligenceは無変更・Formal Truthの別ledger複製は0。テスト：C-1B専用62/62 PASS・C-1A更新後48/48 PASS・既存回帰全PASS・新規FAIL0。変更：`openaiClient.js`／新規`apfrComplianceInjection.test.js`／`apfrComplianceContext.test.js`のtest契約更新。LCC Phase2混入0（HEADベース合成patchで分離）。**dev-check（初回）**：`/`200・`/api/task-history`は応答時間変動あり・`/api/workflow-dashboard`はこのセッション内で固定5秒タイムアウト内の200が未確定——C-1Bのコードパスとは無関係なSupabase応答時間変動（実測0.6〜1.9秒）が原因と切り分け済み（server/timeout/DB/Supabase変更は0）。
- **APFR Step C-1A / C-1B 正式リリースComplete（2026-08-24）**：正式リリース前最終検証（C-1A 48/48・C-1B 62/62・既存回帰全PASS・新規FAIL0・`node --check` OK・`git diff --check` CLEAN・LCC混入0）を実施したうえで、クリーンなlocalhost状態からdev-checkを再試行し**200/200/200を取得**（前回observedのenvironment Pendingは再現せず）。Code commit3件（`9d66525`／`f52511`／docs`3793752`）を**main push**（HEAD/origin/main `3793752...`・ahead/behind 0/0）。**正式Tag `v1.01-apfr-compliance-injection`（Annotated・target `3793752...`）を作成しtag push済み**。**Render**：自動Deployで本番反映済み。本番トップ200・`/api/task-history`200・`/api/workflow-dashboard`200を確認、本番配信HTMLに新関数`_apfrBuildComplianceContext`の存在を確認し新コード反映を確認済み（起動エラー0）。**Writer/Reviewerへの実際のCompliance Block注入は、実AI API課金を避けるため本番実行による確認は今回未実施**（C-1B専用テスト62件が実関数を直接呼び出して検証済みであることをもって代替。実案件登録時に確認予定）。DB変更0・API変更0・Supabase設定変更0・timeout変更0。
- **Step C-1C-1 Deterministic Compliance Check（2026-08-24・Code commit `d8e7021`）**：C-1C調査・設計の結論に基づき、Compliance 4fieldのうち機械判定可能な**`listingNgWords`のみ**を対象とした非ブロッキングDeterministic Compliance Checkを実装。新規`evaluateComplianceGate(outputDraft, complianceContext)`はC-1Aの`complianceContext`のみをconsumerとして利用（APFR facts直接走査・Resolver直接呼び出しはともに0件）、NFKC正規化＋lowercase＋部分一致のみで判定（regex/NLP/fuzzy matching不使用）。`clear`／`violation`／`not_checked`の3状態。C-1Aの設計上`none`と`ambiguous`を区別する情報が存在しないため両方とも`not_checked`として統一処理。`advertisingDisclosureRequirements`（自然言語要求）・`complianceRestrictions`（意味的制約と禁止語の混在）・`regulatoryCategory`（カテゴリ自体は違反ではない）・`listingPolicy`（表記統一未解決）はいずれも対象外。新規`buildComplianceGateHtml()`はOutput Package Qualityとは独立パネルで「現在は確認表示のみ」を明示。**`packageQuality`／`evaluateQualityGate()`／`OUTPUT_STATUS.READY`／IADP `canApprove`／Executive Decision Engine／User Approvalはいずれも無変更**。判定結果は保存せずruntime計算のみ。**正式名称は「APFR Step C-1C-1 Deterministic Compliance Check」——「Quality Gate Enforcement Complete」ではない**（実ブロック接続はStep C-1C-2として別途）。テスト：C-1C-1専用42/42 PASS・既存回帰全PASS・新規FAIL0。localhost実機確認でCLEAR/VIOLATION/NOT CHECKEDの3表示・Console Error 0を確認。LCC Phase2混入0（HEADベース合成patchで分離・3 hunkとも削除行0の純粋追加）。
- **APFR Step C-1C-1 正式リリースComplete（2026-08-24）**：正式リリース前最終検証（C-1C-1 42/42・C-1A 48/48・C-1B 62/62・既存回帰全PASS・新規FAIL0・LCC混入0再確認）ののち、クリーンなlocalhost状態でdev-checkを実行し**200/200/200を取得**。Code commit `d8e7021` ＋ docs commit `a2bd95a`を**main push**（HEAD/origin/main `a2bd95a...`・ahead/behind 0/0）。**正式Tag `v1.01-apfr-deterministic-compliance-check`（Annotated・target `a2bd95a...`）を作成しtag push済み**。**Render**：自動Deployで本番反映済み。本番トップ200・`/api/task-history`200・`/api/workflow-dashboard`200を確認、本番配信コードに`evaluateComplianceGate`／`buildComplianceGateHtml`とOutput Engine配線の存在を確認済み（起動エラー0）。**実案件データによるCLEAR/VIOLATION/NOT CHECKED表示の本番確認は、合言葉認証保護および不要なAI API課金・本番Fact汚染回避のため今回未実施**（C-1C-1専用テスト42件による代替確認済み・実運用時に確認予定）。DB変更0・API変更0・Supabase設定変更0。
- **Step C-2-1 Formal Truth Numeric Consistency Check（2026-08-25・Code commit `9cf7ab92028e4280e83153a3c046a588187aedff`）**：Product Intelligenceのscore計算が現在使用している`product.inputs`側の`payout`／`epc`／`approvalRate`と、APFR Formal Truth側の同名Fact（既存`_apfrResolveCurrentFact()`経由）の数値整合をread-onlyで確認する新規純関数`_apfrEvaluateNumericConsistency(product)`／表示関数`buildFormalTruthConsistencyHtml()`を実装。**4状態Contract＝match／mismatch／uncomparable／not_checked**。`payout`はAPFR側`type:'string'`（自由記述Formal Truth）とIntelligence側`number`の型が根本的に異なるため、parseFloat・正規表現抽出・円記号除去等の数値変換を一切行わず常に`uncomparable`（既存Contractにない変換規則を新規に作らない）。`epc`・`approvalRate`は両側`number`で厳密数値一致（`===`）のみを採用し、`0.8`と`80`のような自動scale変換は行わない。Resolverが`none`／`ambiguous`、またはIntelligence側`null`の場合は`not_checked`へ統一（C-1C-1と同じ前例踏襲）。**`product.facts`直接走査・独自Correction chain判定は0件**（既存Resolverのみ消費）。CUI-2の訂正（`A → B supersedes A`）後は追加実装なしで最新current Factへ自動追従することを確認。**UI**：Output Package Quality（Phase48-1）・Compliance Check（C-1C-1）とは独立した新規パネル「Formal Truth 数値整合確認（Step C-2-1）」をOutput Engineへ追加。**Non-blocking Contract**：`_aicIntegratedScore()`／score／ranking／recommendation／User Approval／`OUTPUT_STATUS.READY`／`evaluateQualityGate()`／`evaluateComplianceGate()`はいずれも無変更（commit差分内の該当識別子への一致は新規コメント文中の説明のみ）。判定結果は保存しない（DB・Output Draft・APFR Fact・Product/ASP/Revenue Intelligence・Intelligence Contextいずれへも保存0）。**正式名称は「APFR Step C-2-1 Formal Truth Numeric Consistency Check」とし、「Formal Truth Score Enforcement Complete」「Intelligence Score Enforcement Complete」とは記録しない**（**C-2-1 Complete ≠ Intelligence Score Enforcement Complete**。mismatch検出結果をscore／confidence／warningへ実際に接続するかはStep C-2-2として別設計工程・未着手）。working treeの別系統差分「Leader Case Context Phase2」は、HEADベースの合成patch（HEAD:index.htmlへ直接3editを再適用して生成した合成版とHEADとの差分をpatch化し`git apply --cached`でINDEXへのみ適用）によりLCC Phase2を一切経由せず分離、LCCマーカー0件をcommit差分・INDEX blob双方から直接確認済み。テスト：新規`apfrNumericConsistency.test.js` **53/53 PASS**、既存回帰（C-1C-1 42/42・C-1A 48/48・C-1B 62/62・CUI-2 105/105・CUI-1 78/78・CUI-0 65/65・Resolver 70/70・APFR Core 49/49・Manual Input 35/35・Phase0 40/40・EER 51/51・IADP Quality Gate 86/86・IADP Structured 13/13・Evidence Promotion 17/17・Cost Tracker 19/19）全PASS・**新規FAIL 0**。`node --check`（working tree版・INDEX blob版とも）OK・`git diff --cached --check`／`git diff --check` CLEAN。localhost実機確認（`npm run dev-check`＝`/`200・`/api/task-history`200・`/api/workflow-dashboard`200。fixture注入方式）でpayout=uncomparable／epc=match／approvalRate=mismatch／Factなし=全field not_checkedの4状態すべてを確認、**Console Error 0**、fixture操作によるPOST発火0件（DB書き込み0）。**Code commit `9cf7ab92028e4280e83153a3c046a588187aedff`済み・push/Tag/Render未実施**。
- **APFR Step C-2-1 正式リリースComplete（2026-08-25）**：正式リリース前最終検証（C-2-1専用53/53・既存回帰15スイート全PASS・新規FAIL0・`node --check` OK・`git diff --check` CLEAN・LCC混入0・`server.js`/`openaiClient.js`/`claudeClient.js`変更0・Non-blocking Contract無変更をgit showで直接再確認）ののち、クリーンなlocalhost状態でdev-checkを実行し**200/200/200を取得**。Code commit `9cf7ab92028e4280e83153a3c046a588187aedff` ＋ docs commit `38ac9aa34e963d6168c44f46d010289ab646b11d`を**main push**（`d68658b..38ac9aa`）、**HEAD／origin/main とも `38ac9aa34e963d6168c44f46d010289ab646b11d`（ahead/behind 0/0）**。**正式Tag `v1.01-apfr-formal-truth-numeric-consistency`（Annotated・target `38ac9aa...`）を作成しtag push済み**（既存Tagとの命名重複なしを事前確認）。**Render**：自動Deployで本番反映済み。本番トップ200・`/api/task-history`200・`/api/workflow-dashboard`200を直接curl取得で確認、本番配信コードに`_apfrEvaluateNumericConsistency`／`buildFormalTruthConsistencyHtml`とOutput Engineへの配線の存在を確認済み（起動エラー0・LCCマーカー0件）。**実案件データによるmatch/mismatch/uncomparable/not_checked表示の本番確認は、合言葉認証で保護されており認証情報を持たないこと、および不要なAI API課金・本番Fact汚染を避ける方針のため今回は未実施**（C-2-1専用テスト53件＋localhost fixture確認による代替確認済み・実運用時に確認予定）。DB変更0・API変更0・Supabase設定変更0。
- **Leader Case Context Phase2 + Option B（2026-08-25・Code commit `95eaa8990016ea6567a9d6ff1133f44217ad1af2`）**：Instagram実運用テストで判明した「保存済み商品情報・Intelligence・APFR Formal Truthが存在するのにWriter/Researcher/Reviewerが『確認できない』と回答し、情報不足のままLeader Finalが根拠のない一般的投稿を生成してReady到達する」不具合を原因調査し解消。**原因**：本番HEADにCase Context配線（`buildLeaderCaseContext`／`caseContext`／`hasCaseContext`／`formalTruthRule`）自体が存在せず（working tree専用の未commit差分＝**Leader Case Context Phase2**として保護されてきた）、かつLCC Phase2単独でもAPFR Formal Truth・Intelligenceを含まない（IADP由来項目のみ）ことを特定。**LCC Phase2**＝`caseContext`という文字列の共通入力契約をPath A（`atRunWorkflow`）／Path B（`sendMessage`）・OpenAI／Claude両Providerへ配線し`hasCaseContext`で`formalTruthRule`を有効化。**Option B**＝新規純関数`_buildCaseDataContext(expectedCaseId)`をPath A/B共通の唯一の構築口としてclient側へ追加し、既存**APFR Resolverはclient専用のまま維持**してresolvedのみのFormal Truthと6 Intelligenceモジュール（Product/ASP/Revenue/Competition/Content/Market Opportunity）のderived/confidence要約を構築、`server.js`は新規`_mergeCaseContextText()`で不透明な文字列として連結するのみ（**Resolver再実装0・`.facts`直接走査0・C-1A test 10-6維持**）。payout（string型）の数値変換・approvalRateのscale変換はいずれも行わず保存値を忠実に渡す。IADP必須ガードは変更せず。**Payload**：`intelligenceContext`全体25,008 Bに対し実測約2,359 B（約1/10.6）、facts履歴・evidence[]・fieldEvidence・usedEvidenceIdsは非送信。**実AI E2E**（Path B・実案件`case-msr9yckye65y`・本番Draft無変更・API 5回・実測¥11.5）でWriter/Researcher/Reviewer/Strategyの4社員全てでContext到達を実証。ResearcherがFormal Truth全21項目（productName／aspName／landingUrl／payout="5000"／epc=34.24／approvalRate=100／regulatoryCategory=医薬部外品等）を正確に列挙、Reviewerがserver側LCC ContextとclientサイドOption B Contextを**2ソース同時に引用**し植え込んだ捏造4種（「初期投資不要」「必ず結果が出ます」等）を全て違反として検出、Strategyが6 Intelligenceモジュールを正確な値で引用し判断材料が無い軸は数値創作せず「判定材料なし」と明示。**生成側3社員（Writer／Researcher／Strategy）の捏造0・Formal Truth矛盾0**。「無料説明会」等の架空CTAは再発せず。本番Draft`out_1787613075018`のfacts22件・intelligenceContextはE2E前後で完全一致、IADP・EER（3件）とも維持、APFR Fact変更0。更新されたのは`cost-logs.json`（ローカルCost Gate state・通常挙動）のみ。テスト：新規`apfrCaseDataContext.test.js` **80/80 PASS**、既存回帰16スイート（C-1C-1 42/42・C-1A 48/48・C-1B 62/62・C-2-1 53/53・CUI-2 105/105・CUI-1 78/78・CUI-0 65/65・Resolver 70/70・APFR Core 49/49・Manual Input 35/35・Phase0 40/40・EER 51/51・IADP Quality Gate 86/86・IADP Structured 13/13・Evidence Promotion 17/17・Cost Tracker 19/19）全PASS・**新規FAIL 0**。`node --check`（server.js／index.html inline／openaiClient.js／claudeClient.js）OK・`git diff --check`／`git diff --cached --check` CLEAN。**Code commit `95eaa8990016ea6567a9d6ff1133f44217ad1af2`（`feat: wire case context and apfr formal truth to ai workflow`）済み・push/Tag/Render未実施**。**正式名称は「Leader Case Context Phase2」＋「APFR Step Option B」とし、「Leader Final Grounding Complete」「Quality Gate Grounding Complete」「READY Grounding Complete」とは記録しない**（**LCC Phase2 + Option B Complete ≠ Leader Final Grounding Complete ≠ Quality Gate Grounding Complete ≠ READY Grounding Complete**。Path A（Auto Task）でのLeader Final実AI E2E・Quality Gate実AI観察・READY実AI観察・`LEADER_FINAL_PROMPT`の情報不足時fail-closed修正・Quality Gate Grounding Enforcementはいずれも今回**未検証・未実装**——Path A実行は対象案件のCurrent Output Draftを新Draftへ切り替える既存動作があるため今回は意図的に未実施）。
- **Leader Final Grounding Option F（2026-08-26・Code commit `04e28a08793218ceaf59dd8fa228333bb58fcd0c`）**：Path A実AI E2Eで、LCC Phase2 + Option BによりContext自体はLeader Finalまで正常到達しているにもかかわらず、**Writerが情報不足を正しく検出して停止したのにLeader Finalがその停止判断を乗り越えてCASE CONTEXT外の具体的事実を捏造し完成品を生成する**問題を発見した（**LCC Phase2 + Option Bの失敗ではなくLeader Final Grounding層限定の問題**）。**Option F修正前の実測**：Context外具体的捏造12件（自然由来成分・植物エキス・肌にやさしい成分設計・キャンペーン・特典等）、Formal Truth意味誤用3件（`approvalRate=100`→「100%審査通過済み」、`cookieWindowDays=90`→「90日間のクッキー期間中に購入すると特典あり」、`mobileOptimized=true`→「スマホ最適化済みで簡単購入」）、架空キャンペーンあり、架空特典あり、Writer停止判断の不正上書きあり。**捏造成果物でもpackageQuality=100/complete・Quality Gate=passed・READY相当のまま素通しすることを実測確認**。**根本原因**：`LEADER_FINAL_PROMPT`／`ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT`は`buildSystemPrompt()`を経由しない独立の固定System Prompt定数のため、Writer/Researcher/Reviewer/Strategyに適用される`formalTruthRule`完全版がLeader Finalへ届いていなかった。**Option F実装**（`openaiClient.js`のみ）：①`buildSystemPrompt()`内のformalTruthRule inline定義を`_buildFormalTruthRuleText(hasCaseContext)`という純関数へ抽出し単一ソース化（本文の意味は無変更・二重管理なし・Leader Finalも同じ関数を再利用）。②新規純関数`_buildLeaderFinalGroundingBlock(caseContext, ruleFacts)`を追加し、`runLeaderFinalResponse()`でcaseContext存在時のみquestion側へ付加（`LEADER_FINAL_PROMPT`／`ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT`定数本体はいずれも無変更・caseContextなし経路は既存question不変でfail-open維持）。③Formal Truthのfield名・意味・用途を維持し別概念へ読み替えてはいけないという意味維持条項を新設（`approvalRate`／`cookieWindowDays`／`mobileOptimized`の実測誤用パターンを具体例として明示）。④既存`shared/leaderRuleEngine.js`の`evaluateLeaderRuleFacts()`をそのまま再利用し（`shared/leaderRuleEngine.js`自体・新規schemaいずれも変更0）、`informationInsufficient.count > 0`の場合のみ「情報不足と判断した担当社員が本来提供すべきだった具体的事実をLeader Finalが代わりに創作してその担当の判断を上書きしてはならない」というfail-closed文を追加（count===0では追加せず、ruleFacts null/undefinedでも例外を出さず既存挙動を維持）。**変更0**：`index.html`／`server.js`／`claudeClient.js`／`shared/leaderRuleEngine.js`／APFR Resolver／Quality Gate／READY／Compliance Gate／DB schema。**テスト**：新規`leaderFinalGrounding.test.js`（AI API呼び出し0・fetch0・DB write0・runtimeデータ変更0の合成テスト）**53/53 PASS**。既存`apfrCaseDataContext.test.js`はtest 40のみ、旧: inline formalTruthRule定義の直接文字列一致検証を、新: `_buildFormalTruthRuleText()`経由でhasCaseContextがformalTruthRuleを有効化するという同一Contractへ検証対象を追随させる修正（Contract弱化ではない）で**80/80 PASSへ復旧**。既存回帰：`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62、他既存18スイート全PASS・新規FAIL 0。`node --check`・`git diff --check`いずれもCLEAN。**実AI E2E**（本物のPath A workflow・安全なcandidateOnly方式・本番Draft`out_1787613075018`read-only取得→`_buildCaseDataContext()`→実サーバー側Path A workflow→Leader Final→`buildOutputDraftFromLeaderFinal(candidateOnly:true, 独立targetDraft)`→`evaluateQualityGate()`・通常UIの`atRunWorkflow()`／`pushOutputDraftToServer()`は未使用・API6回・実測約16.4円）：**Option F後はContext外具体的捏造0件・Formal Truth意味誤用0件・Formal Truth直接矛盾0件・架空キャンペーン0件・架空特典0件・Writer停止判断の不正上書き0件**（Writerは情報不足を正しく報告し続け〔【現状仮説】【確認したいこと】〕、Leader FinalはA8.net提携・報酬5,000円・医薬部外品・スマホ対応済み・効果効能表現回避等、Formal Truth範囲内で成果物を作成）。**ただし軽微な残存あり**：`#敏感肌`・「自然由来のスキンケア」・「自然由来の美容と健康を追求するあなたに」・「肌に優しい医薬部外品」等、Formal Truthに直接裏付けのない評価的・示唆的表現が残った（具体的数値・キャンペーン・特典・効能の断定とは質的に異なるが、厳密なGrounding上は軽微な残存）。**正式判定：Leader Final Grounding＝B（軽微な表現問題のみ）・Option F実AI E2E＝A（成功）**。**「Leader Final Grounding Complete」「Grounding Enforcement Complete」とは記録しない**。**Data Safety**：E2E前後でoutputId・updated_at同一、facts22件→22件完全一致、intelligenceContext完全一致、IADP完全一致、EER3件→3件完全一致、User Approval approved→approved、output_drafts write0・APFR/EER/IADP/User Approval変更0（task_history／conversations／messages／cost-logs.jsonへの実行履歴追加は許可済みruntime副作用として区別）。**重要な非依存関係**：**Option F実AI E2E成功 ≠ Compliance Enforcement Complete**（`advertisingDisclosureRequirements`はCASE CONTEXTへ到達しているが成果物に【広告】／#PR／#広告等の明示表示なし・`#アフィリエイト`は存在・Step C-1C-2として別課題のまま）。**Option F実AI E2E成功 ≠ Quality Gate Grounding Complete**（現行Gateは構造充足中心のまま変更0・Option F前は捏造成果物でも100/complete/passedとなったことを実証済み）。**Option F実AI E2E成功 ≠ READY Grounding Complete**（READYは`integratedCount > 0`が主条件のままREADYロジック変更0）。**Code commit `04e28a08793218ceaf59dd8fa228333bb58fcd0c`（`feat: ground leader final in formal truth context`）。対象3ファイルのみ（`openaiClient.js`／`apfrCaseDataContext.test.js`／新規`leaderFinalGrounding.test.js`）・push/Tag/Render未実施**。commit前の最終テストでstage後に`leaderFinalGrounding.test.js`が一時的にFAIL（`git diff --name-only`がunstaged差分のみを見るためstage後にopenaiClient.js等が変更対象一覧から消えた既知のtestハーネス限界。Option F本体の機能的後退ではない）→同ファイル内のみ`git diff --name-only HEAD`（staged+unstaged合算）へ検出方法を修正し、assertion削除・Contract弱化なしで**53/53 PASSへ復旧**したうえでcommit。working treeの別系統runtime差分（`cost-logs.json`／`data/conversations/_meta.json`・既存untracked7件）は本Code commitへ不混入。新規Decision番号は作成せずDecision108へ追記。
- **APFR Step C-1C-1b Advertising Disclosure Detection（2026-08-26・Code commit `e23c0df88d7aca485f576124677735aa080441ee`）**：既存C-1C-1（Deterministic Compliance Check）は`listingNgWords`のみをdeterministicに確認しており、`advertisingDisclosureRequirements`はC-1Aが構築するCompliance ContextとしてWriter/Reviewer/Leader Finalへ到達していたにもかかわらず`evaluateComplianceGate()`では一度も評価されていなかった（同関数は`complianceContext.listingNgWords`のみを見て他3fieldに触れない実装だった）。Leader Final Grounding Option F実AI E2Eでも、`advertisingDisclosureRequirements`が存在するにもかかわらず【広告】／#PR／#広告等の広告明示が成果物へ反映されない事象を確認しており、この不足を可視化するため**APFR Step C-1C-1bとしてAdvertising Disclosure Detectionを追加した**。**今回の正式化はAdvertising Disclosure Detection Completeまでであり、Compliance Enforcement Complete／Compliance Gate Complete／Quality Gate Grounding Complete／READY Grounding Complete／User Approval Enforcement Completeとは記録しない**。**実装**（`index.html`のみ・`evaluateComplianceGate()`の兄弟関数として追加）：新規`APFR_DISCLOSURE_ACCEPTED_MARKERS`（whitelist方式：ラベル【広告】／【PR】、ハッシュタグ#広告／#PR／#プロモーション、明示文章3種の8マーカー）と新規純関数`_apfrEvaluateDisclosureMarkers(outputDraft, complianceContext)`。既存`_apfrComplianceGateNormalize()`（String化→NFKC→lowercase→trim）をそのまま再利用し新しい自然言語解析・fuzzy判定・AI判定は追加していない。ハッシュタグは`/#([^\s#]+)/g`によるtoken境界完全一致で判定し`#profile`を`#PR`として誤検出しない。`#アフィリエイト`／`#案件`／`#提供`／文章中の単なる「広告」「PR」の無境界部分一致は単独でsatisfiedにしない（deterministic判定で誤って適法・適切と認定しないことを最優先したwhitelist設計）。**status Contract**：`satisfied`（requirementあり＋Marker1件以上）／`missing`（requirementあり＋Marker0件）／`not_checked`（requirementなし・none・ambiguous・empty array・invalid input・fields不正・例外時）の3状態。`complianceContext.advertisingDisclosureRequirements`が有効なnon-empty arrayとして存在する場合のみ`requirementPresent=true`（C-1Aの既存Contract上none/ambiguousはキー非出力のため自然に`not_checked`・C-1Aのshape変更0）。**Non-blocking Contract**：`evaluateComplianceGate()`／`evaluateOutputPackageCompleteness()`／`evaluateQualityGate()`／`OUTPUT_STATUS.READY`／`approveInstagramPackage()`／`_iadpApproveDesign()`／`pushApprovalToServer()`／`_enqueueApprovalPost()`／Executive Decision Engine／Publishing Ready／APFR Resolver／C-1A／C-1B／Leader Final Grounding Option Fはいずれも変更0。missingでもQuality Gate／READY／User Approval／Publishing Readyをブロックしない。例外時はsatisfiedを返さずnot_checkedへfail-open。**UI**：既存Compliance Checkパネル内へ「禁止語：CLEAR/VIOLATION/NOT CHECKED」と並べて「広告開示：SATISFIED/MISSING/NOT CHECKED」を独立表示。**Instagramタイアップ投稿ラベル境界**：Paid Partnershipラベルは外部UI操作でありOutput Draft文字列からは実際に設定されたか確認できないため、satisfied条件には含めず架空の「設定済み」判定を作らない（新規Fact作成0・EER変更0・DB保存0）。UIには「Instagram投稿時はタイアップ投稿ラベルの設定も別途確認してください（本Detectionでは検証していません）」という補足のみ表示。**保存**：runtime onlyの純関数（DB・Output Draft・APFR Fact・Intelligence Context・Compliance Context・EERへの書き込みは0・呼び出しのたび再計算）。**テスト**：新規`apfrDisclosureDetection.test.js` **66/66 PASS**（振る舞い27件＋static検証39件）。既存回帰：`apfrComplianceGate` 42/42・`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62・`apfrCaseDataContext` 80/80・`apfrCurrentFactResolver` 70/70・`apfrCore` 49/49・`iadpQualityContractRouting` 86/86、他既存重要回帰も新規FAIL0。**`leaderFinalGrounding.test.js` 49/53**（FAIL: 18-1・20-1・20-2a・20-2b。Option F commit時点のCode diff状態を固定するstatic guardが今回の正規`index.html`変更を検出した既知の非機能FAILであり、C-1C-1b機能のFAILではない。**53/53 PASSとは記録しない**。test修正・assertion削除はいずれも行っていない）。`node --check`・`git diff --cached --check`いずれもCLEAN。**localhost**：`/`200・`/api/task-history`200・`/api/workflow-dashboard`200・Console Error0。fixture確認（ブラウザ実行環境でsatisfied/missing/not_checkedの3状態のHTML描画を実測）：POST発火0件・DB write0・AI API実行0。**Code commit `e23c0df88d7aca485f576124677735aa080441ee`（`feat: detect advertising disclosure markers`）。対象2ファイルのみ（`index.html`／新規`apfrDisclosureDetection.test.js`）・push/Tag/Render未実施**。working treeの別系統runtime差分は本Code commitへ不混入。新規Decision番号は作成せずDecision108へ追記。
- **APFR Step C-1C-2a Compliance Assessment Aggregation（2026-08-27・Code commit `659e82ceefb899e794b08872b58d2820b357c1df`）**：既存C-1C-1（listingNgWords）とC-1C-1b（広告開示）はそれぞれ独立したdetectorとして`buildComplianceGateHtml()`内で個別表示のみで、両者を横断した1つの総合Assessmentは存在しなかった。**本工程着手前にQuality Gate Grounding Enforcementの調査を実施し、「Quality GateへCompliance結果を直接集約する案は`apfrCaseDataContext`／`apfrComplianceGate`／`apfrDisclosureDetection`／`apfrNumericConsistency`の4正式リリース済みtestが固定するevaluateQualityGate() Contractを破壊するため不採用」と判断し、別Gateとして本C-1C-2aを新設する設計判断を確定した**。新規`APFR_COMPLIANCE_ASSESSMENT_ITEMS`と新規純関数`_apfrEvaluateComplianceAssessment(outputDraft, complianceContext)`（`index.html`のみ変更）を追加し、`evaluateComplianceGate()`と`_apfrEvaluateDisclosureMarkers()`を「呼ぶだけ」で独自のlistingNgWords検索・広告marker検索・正規化・APFR Resolver・`.facts`直接走査はいずれも実装していない。**status Contract**：`clear`（blocker0件かつ少なくとも片方が実判定済み）／`blocked`（violationまたはmissingのいずれか1件以上）／`not_checked`（両detector not_checked・input不正・例外）の3状態。**blockers**は既存detector結果の要約のみ（新しい意味判定を作らない）。**unchecked**はnot_checked項目を握りつぶさず保持し、`clear`が「全Compliance完全確認済み」を意味しないことをUI（「未検査項目あり」表示）でも明示。**Non-blocking Contract**：`evaluateQualityGate()`／`evaluateOutputPackageCompleteness()`／`OUTPUT_STATUS.READY`／`approveInstagramPackage()`／`_iadpApproveDesign()`／`pushApprovalToServer()`／`_enqueueApprovalPost()`／`accountCreationReadiness`／Executive Decision Engine／Publishing Readyはいずれも変更0。今回のblockedはAssessment上の状態のみで実際には何も停止しない。**重要な構造ギャップ**：`accountCreationReadiness`はIADP専用のenforcement spineであり、非IADP案件には同等のEnforcement接続先が現状存在しない（Step C-1C-2bの設計課題として未着手のまま残す）。Numeric Consistency（C-2-1）への参照・変更は0（Step C-2-2として分離維持）。Leader Final Grounding（Option F）はdeterministic detectorが存在しないため「Grounding clear」等のstatusは新設していない。**今回の正式化はCompliance Assessment Aggregation Completeまでで、Compliance Enforcement Complete／Quality Gate Grounding Complete／READY Grounding Complete／User Approval Enforcement Complete／accountCreationReadiness Enforcement Completeとは記録しない**。**テスト**：新規`apfrComplianceAssessment.test.js` **83/83 PASS**。既存回帰：`apfrComplianceGate` 42/42・`apfrDisclosureDetection` 66/66・`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62・`apfrCaseDataContext` 80/80・`apfrNumericConsistency` 53/53、他既存重要回帰も新規FAIL0。**`leaderFinalGrounding.test.js` 49/53**（FAIL: 18-1・20-1・20-2a・20-2b。Option F commit時点のCode diff状態を固定するstatic guardが正規`index.html`変更を検出した既知の非機能FAILでありC-1C-2a機能のFAILではない。**53/53 PASSとは記録しない**）。`node --check`・`git diff --cached --check`いずれもCLEAN。**localhost**：`/`200・`/api/task-history`200・`/api/workflow-dashboard`200・Console Error0。fixture確認（clear/blocked/not_checked/clear+uncheckedの4状態のHTML描画を実測）：POST発火0件・DB write0・AI API実行0。**Code commit `659e82ceefb899e794b08872b58d2820b357c1df`（`feat: aggregate apfr compliance assessment`）。対象2ファイルのみ（`index.html`／新規`apfrComplianceAssessment.test.js`）・push/Tag/Render未実施**。working treeの別系統runtime差分は本Code commitへ不混入。新規Decision番号は作成せずDecision108へ追記。
- **APFR Step C-1C-2b-1 Mobile Approval Enforcement（2026-08-27・**新規Decision 109**・Code commit `46b37dc2785bdd02c1cc578581c6b95f7ea8d95f`）**：C-1C-2aまではCompliance Assessmentがblockedでも誰も止まらない「検出のみ」状態だったため、通常Instagram投稿の単一chokepointであるMobile Approvalへ実ブロックを接続した。**新規Decision番号（109）を採用**——Formal Truth保存契約（Decision108）ではなく、人間のUser Approval操作を初めてdeterministic判定で実際に拒否するApproval Contract自体の変更のため分離。**実装前調査で確定**：Mobile Approvalを止めればPublishing Ready・投稿記録（既存hard guard）は独立guard追加なしで自動的に停止する／APFR ResolverはClient専用でserver側再評価はC-1A Contract違反となるためserver-side Enforcement（C-1C-2b-3）は実装不可／IADP Approvalは別spine（accountCreationReadiness）でありC-1C-2b-2として分離。**Enforcement spine**：Compliance Assessment blocked→Mobile Approval不可→Publishing Ready到達不可（自動追従）→markInstagramPublished実行不可（自動）。変更0：`OUTPUT_STATUS.READY`（AI生成完了状態として維持）／`evaluateQualityGate()`／`accountCreationReadiness`／`_iadpApproveDesign()`／`_edRunDecisionEngine()`／`server.js`（client-only Enforcement）。**実装**（`index.html`のみ）：新規`_apfrEvaluateMobileApprovalCompliance()`が`_apfrEvaluateComplianceAssessment()`を唯一の判定源とし独自detector再実装0。`canApprove = _mapAllChecked() && _mapReviewApproved(mai) && !_mapCompliance.blocked;`（既存2条件維持＋Enforcement条件追加）。`approveInstagramPackage()`内でsubmit直前に再評価（stale防止）し、blocked時は`decision`・`approvedAt`を変更せず`pushApprovalToServer()`へも進まずreturn。not_checked／例外はfail-open。新規override UIは0。修正後Assessmentがclearへ戻れば自動復旧。**released test4ファイルを正規追随修正**（`apfrCaseDataContext`／`apfrComplianceGate`／`apfrDisclosureDetection`／`apfrComplianceAssessment`。旧「Approval未接続」を新Contract「既存2条件維持＋Enforcement接続済み＋detector非再実装」検証へ更新。assertion削除ではなく`apfrComplianceAssessment`は1件追加）。**テスト**：新規`apfrApprovalEnforcement.test.js` **76/76 PASS**。既存回帰：`apfrComplianceAssessment` 84/84・`apfrComplianceGate` 42/42・`apfrDisclosureDetection` 66/66・`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62・`apfrCaseDataContext` 80/80・`iadpQualityContractRouting` 86/86、他既存重要回帰も新規FAIL0。**`leaderFinalGrounding.test.js` 49/53**（FAIL: 18-1・20-1・20-2a・20-2b。Option F commit時点のdiff-state static guardが正規`index.html`変更を検出した既知の非機能FAILでありC-1C-2b-1機能のFAILではない。**53/53 PASSとは記録しない**）。`node --check`・`git diff --cached --check`いずれもCLEAN。**localhost**：`/`200・`/api/task-history`200・`/api/workflow-dashboard`200・Console Error0。fixture確認（clear/blocked(listing)/blocked(disclosure)/not_checkedの4状態、blocked submit時のdecision/approvedAt変更0・pushCount=0、修正後の自動復旧を実測）：POST発火0件・DB write0・AI API実行0。**実運用影響（重要）**：プラファスト実案件は`advertising disclosure missing`が既に実測されており、**次回のMobile Approval操作は実際にblockされる可能性が高い**（意図した動作。解除には成果物へ【広告】/#PR等の追加が必要）。**今回の正式化はMobile Approval Enforcement Completeまでであり、Compliance Enforcement全体Complete／IADP Approval Enforcement Complete／Quality Gate Grounding Complete／READY Grounding Complete／accountCreationReadiness Enforcement Complete／server-side Enforcement Completeとは記録しない**。**Code commit `46b37dc2785bdd02c1cc578581c6b95f7ea8d95f`（`feat: enforce compliance on mobile approval`）。対象6ファイルのみ・push/Tag/Render未実施**。working treeの別系統runtime差分は本Code commitへ不混入。**新規Decision 109**として`docs/04DECISIONS.md`へ記録。
- **APFR Step C-1C-2b-2 IADP Approval Enforcement ─ Not Required正式化（2026-08-27・Decision109追記）**：Mobile Approval Enforcement（C-1C-2b-1）正式リリース後、対称工程として検討されたIADP Approval Enforcementについて実装前調査（Opus）を実施した結果、**C-1C-2b-2は実装しない（Not Required）と正式判定**。理由はserver-side制約ではなく、**Compliance AssessmentとIADP Approvalが評価対象とする成果物そのものが異なるという責務不一致**。**技術的根拠**：`evaluateComplianceGate()`・`_apfrEvaluateDisclosureMarkers()`はいずれもobject型の値を`string/array以外（object等）は対象外・deep recursionしない`として明示的にスキップする実装であり、IADPアカウント設計パッケージ（`fields.iadp = {package, validation, quality, ...}`）はobjectのため**構造上Compliance Assessmentの評価対象に含まれない**。**ブラウザ実測**：`fields.iadp.package`内にNGワードや広告開示Accepted Marker（【広告】等）を配置してもDetectorは検出せず、同内容をトップレベルstringに置くと正しく検出されることを確認し、IADPパッケージ内容とCompliance Assessmentが別スコープであることを実測で確定した。**false positiveリスク**：`advertisingDisclosureRequirements`登録済み案件でIADP設計フェーズのdraft（投稿ではないため本来【広告】/#PR不要）を評価すると`blocked（広告開示マーカー不足）`となり得ることを実測確認。IADPパッケージ内へマーカーを追加してもdeep recursionしないため解消できず、**接続していれば修復不能な永久blockを生み得た**。**責務境界**：IADP Approvalはアカウント設計パッケージ（accountName/bio/brandConcept等）を判定し、Compliance Assessmentは投稿成果物のトップレベルtext/arrayフィールド（slides/caption/hashtags等）を判定する——両者は別成果物。**Mobile Approvalが正しいchokepointである理由**：投稿向けCompliance問題は既にC-1C-2b-1で正しい責務境界にて強制済みであり、Mobile Approvalパネル自体`createMobileReviewCenterDraft()`が実際のカルーセルスライド存在を要件とするためアカウント設計のみのdraftでは描画されない＝投稿成果物が存在する場合にのみ作動するよう既に正しくスコープ済み。**正式Enforcement spine**：Compliance Assessment blocked→Mobile Approvalは不可（C-1C-2b-1）→IADP Approvalは止めない（成果物が異なるため）→accountCreationReadinessは変更しない（既存IADP品質集約spineを維持）→OUTPUT_STATUS.READYは変更しない。**変更0（実装しないため）**：`_iadpApproveDesign()`／`accountCreationReadiness`（ready/conditional/not_readyのContract維持）／既存User Approval（プラファスト案件含む既存Approvedを遡及変更しない・新規DB write0）／EER（既存記録を無効化しない）／`evaluateQualityGate()`／`OUTPUT_STATUS.READY`／`server.js`。IADPカードへの新規Compliance warning表示も追加しない（現行Compliance判定はIADP package自体を評価していないため誤解を招く）。**将来の拡張余地**：IADPパッケージ自体のCompliance検査が将来必要になった場合は、C-1C-2b-2を復活させるのではなく「IADP Content Compliance Detection」という別工程として設計し、既存C-1C-1／C-1C-1bを勝手に拡張しない。**既知の残課題（分離・今回修正しない）**：`advertisingDisclosureRequirements`を持つ案件でIADP設計フェーズのdraftを表示するとCompliance Check UIが表示レベルでBLOCKEDと表示され得る問題（C-1C-2a表示スコープ問題として別課題・現時点ではnon-blocking）。プラファスト案件で実投稿成果物が存在するMobile Approval段階でのadvertising disclosure missingは正しいCompliance blockerであり、C-1C-2b-1のEnforcementは引き続き維持する。**今回の正式化はC-1C-2b-2 Not Requiredの判断のみであり、Compliance Enforcement Complete／Quality Gate Grounding Complete／READY Grounding Complete／IADP Content Compliance Complete／server-side Enforcement Completeとは記録しない**。Code変更0・test変更0・DB変更0・AI API実行0。新規Decision番号は作成せずDecision109へ追記。
- **APFR Step C-1C-2a-1 Compliance UI Scope Correction ─ 正式リリースComplete（2026-08-27・Code commit `112dafd6e9ff76f737a6240e2dee346656cfbed6`・stage-1 docs commit `a97109bb2b840b464037b22719d92c00ad3cca62`＝正式Tag target・main push済み・Annotated Tag `v1.01-apfr-compliance-ui-scope-correction`（target `a97109bb2b840b464037b22719d92c00ad3cca62`）push済み・Render反映確認済み）**：IADPアカウント設計フェーズのdraft表示時に、投稿成果物が存在しないにもかかわらずCompliance Check UIが「禁止語：CLEAR」「広告開示：MISSING」「総合：BLOCKED」等の確定判定に見える表示false positiveを出す問題を発見・是正した。**根本原因**：Output Engineが全output type共通で`buildComplianceGateHtml()`を無条件表示しており、既存detector（`evaluateComplianceGate()`／`_apfrEvaluateDisclosureMarkers()`）はobject型フィールド（`fields.iadp`）をdeep recursionせず対象外とするため、検査対象テキスト0件のまま確定的な戻り値（`clear`/`missing`）を返していた。**責務判断**：投稿成果物がある場合Detector/Assessmentは正しく機能しているため**Detector Contract・Assessment Contractは変更せず**、UI表示スコープのみを補正（実装前調査で判定A：UI表示スコープのみの最小修正で安全に是正可能、と確定）。**新規helper**：`_apfrComplianceHasScannableContent(outputDraft)`——`fields`直下にstring/arrayが1件でも存在するかを、既存detectorと同一の浅い型判定のみで確認。scannable content無し時のみ禁止語/広告開示/総合の3項目をNOT CHECKED表示へ差し替え、「投稿成果物などの検査対象テキストがまだ存在しないため、Compliance Checkは未実施です。」を表示。内部の`evaluateComplianceGate()`・`_apfrEvaluateDisclosureMarkers()`・`_apfrEvaluateComplianceAssessment()`の呼び出し・戻り値は完全に無変更（表示直前でUI層のみ上書き）。**lifecycle carry-forward対応**：IADP存在 ≠ IADP-onlyのため判定軸は「scannable content存在」とし、投稿成果物とIADPが併存する場合はブラウザ実測で通常表示（実際の判定）が正しく表示されることを確認——false negativeを防止し本物の投稿Complianceを隠さない設計。**Mobile Approval Enforcement（C-1C-2b-1）／IADP Approval（C-1C-2b-2 Not Required）／Quality Gate／READYはいずれも変更0**（新helperはこれらへ一切接続しない）。**テスト**：新規`apfrComplianceUiScope.test.js` **60/60 PASS**。**released test追随修正**：`apfrDisclosureDetection.test.js`のtest 40が、`buildComplianceGateHtml()`本体の固定6000文字window切り出しにより、今回の正規UI追加で検証対象文言（オフセット6613文字目）がwindow外へ押し出され1件FAILしたため、既存test suite標準の`\n}\n`終端検出方式へ統一する追随修正を実施（assertion内容・ラベル・検証Contractは1文字も変更せず、`end`/`body`算出の2行のみ変更・assert行の変更差分0件をcommit内で機械確認済み）。既存回帰：`apfrApprovalEnforcement` 76/76・`apfrComplianceAssessment` 84/84・`apfrDisclosureDetection` 66/66・`apfrComplianceGate` 42/42・`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62・`apfrCaseDataContext` 80/80・`iadpQualityContractRouting` 86/86、他既存重要回帰も新規FAIL0。**`leaderFinalGrounding.test.js` 49/53**（FAIL: 18-1・20-1・20-2a・20-2b。Option F commit時点のdiff-state static guardが正規`index.html`変更を検出した既知の非機能FAILでありC-1C-2a-1機能のFAILではない。**53/53 PASSとは記録しない**）。`node --check`・`git diff --cached --check`いずれもCLEAN。**localhost**：`/`200・`/api/task-history`200・`/api/workflow-dashboard`200。fixture確認（A.IADP-only→NOT CHECKED/NOT CHECKED/NOT CHECKED、B.IADP+投稿成果物→通常Compliance表示、C.投稿+disclosure missing→MISSING/BLOCKED維持、D.投稿+disclosure satisfied→SATISFIED/CLEAR維持、E.listing violation→VIOLATION/BLOCKED維持）：POST発火0件・DB write0・AI API実行0。**今回の正式化はCompliance UI Scope Correction Code Implementation Completeまでであり、Compliance Enforcement全体Complete／Quality Gate Grounding Complete／READY Grounding Complete／Grounding Enforcement Complete／IADP Approval Enforcement Complete／server-side Enforcement Completeとは記録しない**。**Code commit `112dafd6e9ff76f737a6240e2dee346656cfbed6`（`feat: scope compliance ui to scannable outputs`）。対象3ファイルのみ（`index.html`／新規`apfrComplianceUiScope.test.js`／`apfrDisclosureDetection.test.js`）・（stage-1時点）push/Tag/Render未実施——その後 stage-2 で main push・Annotated Tag `v1.01-apfr-compliance-ui-scope-correction`（target `a97109bb2b840b464037b22719d92c00ad3cca62`）push・Render反映確認（本番3endpoint 200・本番 `index.html` とローカルHEAD `index.html` byte-identical）・最新 `leaderFinalGrounding.test.js` 52/53〔FAIL `20-2a` のみ・53/53とは記録しない〕まで完了**。working treeの別系統runtime差分は本Code commitへ不混入。新規Decision番号は作成せず、Enforcement Contract変更ではないためC-1C-2a記録済みのDecision108へ追記（C-1C-2b系のApproval Enforcement ContractはDecision109に分離済み）。
- **APFR Step C-3-1 Grounding Detection ─ Not Required 正式化（2026-08-28・Decision108追記・docs-only stage-1・Code変更0）**：前工程「Quality Gate Grounding Enforcement 調査」で Quality Gate は `packageQuality.status` のみを見る構造Gateであり通常Instagram投稿の公開spineを止めないことが判明したため、Grounding独立系列 C-3 の第一工程 C-3-1 Grounding Detection を実装前調査（Opus・read-only）した。結論は**判定D＝deterministic Grounding Detectionは実装しない（Not Required）**。**実測根拠**：Option F前の実AI E2Eで確認された Grounding問題15件の内訳は Class A（Formal Truth直接矛盾）**0件**／Class B（照合先fieldなしのContext外捏造）**12件**／Class C（Formal Truth意味誤用・**値は一致**）**3件**。Formal Truth Contradiction Detectorを実装しても実測15件を1件も検出できず、素朴な値一致判定（X3）は実測Class C 3件を「supported」と誤肯定する。**APFR Formal Truth 21field 調査で deterministic対象候補＝0件**（APFR＝ASPプログラム事実／Grounding問題＝消費者向けマーケ主張でdomainが一致しない）。claim extraction は semantic のため X1〜X4 いずれも不成立。**status Contract**：`clear`／`supported`／`grounded`／`fully_grounded` を新設しない（値一致・矛盾なしを「Grounded」と誤保証しない）。**C-3系列（C-3-1〜C-3-3）は実装系列として取り下げ**（設計履歴は正式記録として保存・単純削除禁止）。**Leader Final Grounding＝B・Option F実AI E2E＝A は維持**。**Grounding Complete／Fully Grounded／No Hallucination Guaranteed／Grounding Enforcement Complete とは記録しない**。Option F は今後も Generation Prevention として維持（deterministic Detection ではない）。**Quality Gate（`evaluateQualityGate()`）／READY（`integratedCount > 0`・AI生成完了状態）／Mobile Approval（`canApprove`）／C-2-1 Numeric Consistency はいずれも変更0**。**C-2-2 は引き続き未着手・保留**。**Marketing Claim Formal Truth は現時点では新設しない**（schema拡張してもclaim extraction問題が残る）。**将来候補（実装・正式採用しない）**：残存軽微表現（`#敏感肌`・「自然由来」・「肌に優しい」）はGroundingよりComplianceの責務に近く、C-1C-1が「`complianceRestrictions`等は機械Gate化しない」と正式判断済みのため**この判断は変更せず**、「C-1系列 complianceRestrictions deterministic化可否調査」を将来候補としてのみ記録。新規Decision番号は作成せず Decision108 へ追記（Decision109 は変更なし）。**docs-only：Code／test／DB／AI API／Render／新規Tag いずれも0・push未実施**。
- **APFR Compliance Restrictions deterministic化 ─ Not Required 正式化（2026-08-28・Decision108追記・docs-only stage-1・Code変更0）**：C-3-1 Grounding Detection＝Not Required の後、残存軽微表現（`#敏感肌`・「自然由来」・「肌に優しい」）を Compliance 側で deterministic に扱えるか——具体的には `complianceRestrictions` を deterministic Compliance Detector へ利用できるか——を実装前調査（Opus・read-only）した。結論は**判定C＝`complianceRestrictions` 自体の Detector は新設せず、deterministic 対象は `listingNgWords` へ責務分離する（Not Required）**。**実測根拠**：実案件プラファストの `complianceRestrictions` 実値 `['A8.netのルール遵守','広告表示必須','法律関連の禁止事項遵守','リスティング違反禁止']` は4値すべてが単純禁止語ではなく directive／obligation。既存 `evaluateComplianceGate()` と同一の substring 方式を仮適用すると、残存3表現の検出は**0件（false negative 100%）**、逆に「A8.netのルール遵守のうえ作成」「広告表示必須の規定に従い【広告】と明記」等の**正しい遵守／開示表明を `violation` と誤検出**した（`広告表示必須` は positive obligation のため「存在したら違反」で意味が逆転）。restriction 本文から禁止語を抽出する方式（Option B）も述部解釈が semantic のため不成立。**Source of Truth 責務分離を正式維持**：`listingNgWords`＝deterministic 禁止語（閉じた語彙）／`advertisingDisclosureRequirements`＝開示義務 trigger（C-1C-1b の whitelist marker 方式・自然文の substring 検索ではない）／`complianceRestrictions`＝自然言語 Compliance 制約（C-1B prompt injection で Writer／Reviewer へ伝達・semantic 判断は AI／Reviewer）／`regulatoryCategory`＝参考情報（法令推論禁止）。**C-1C-1 の既存判断（`complianceRestrictions`／`regulatoryCategory`／`listingPolicy` は機械Gate化しない）は今回の実データ調査でも正しかったと確認され、変更しない**。**残存3表現は Grounding 側（C-3-1）・Compliance 側（本調査）の双方で deterministic 判定が不成立**と確定し、Option F／Reviewer 等の AI 側責務に残す。**`_apfrEvaluateComplianceAssessment()`／Mobile Approval（`canApprove`）／Quality Gate（`evaluateQualityGate()`）／READY（`OUTPUT_STATUS.READY`）はいずれも変更0**。**新規観察事項（別課題・今回修正しない）**：実案件 `listingNgWords=['商品名','法人名']` はリスティング広告のキーワード入札禁止カテゴリを意味する可能性があり、Instagram 成果物本文へ substring 検索する現行 detector の適用先とチャネル意味ズレの可能性がある——`listingNgWords` の意味変更／rename／schema変更／detector変更／ASPデータ変更／既存Fact訂正はいずれも禁止、別課題としてのみ記録。**Option D（止めたい語句は `listingNgWords` へ登録）の責務原則は維持候補だが、現行 `listingNgWords` field が Instagram 投稿用禁止語を保持する Contract かは未確認のため「Option D 完全採用」とはまだ記録しない**。新規 Decision 番号は作成せず Decision108 へ追記（Decision109 は変更なし）。**「Compliance Complete」「Compliance Enforcement Complete」とは記録しない**。docs-only：Code／test／DB／AI API／Render／新規Tag いずれも0・push未実施。
- **残課題（Completeとは分離）**：①同一fieldへの複数Fact存在時の**正本選択Contract・Correction-aware Duplicate Policy（CUI-0）・Current Fact・History UI（CUI-1）・Correction UI Core（CUI-2）はすべてComplete、かつCorrection UI Core系列（CUI-0〜CUI-2）は正式リリース・本番認証後最終目視ともComplete**（現在地の内訳＝Correction Contract／Resolver／Duplicate Policy／Current Fact・History UI／Correction UI Core／本番認証後最終目視＝すべて**Complete**）。実データ上の`listingNgWords`は引き続きlegacy fallbackで解決（後付けmigrationは行わない方針を維持）②ITP「7days」の専用保存field不在（`itpSupported`はbooleanのみ）③boolean値の日本語表示（**CUI-1でComplete**）④`listingPolicy`「一部ok」の表記統一（**Step C-1A/BともAI指示への注入は引き続き対象外**）⑤APFRフィールド選択UI（巨大select・スクロール・検索性）⑥APFR直接ジャンプ導線⑦入力省力化（21項目1件ずつの負担）⑧EEA問題（Decision101・別途未解決）⑨Quality Gate／Hold制御問題（別問題）⑩**Deterministic Compliance Check（listingNgWordsのみ）はStep C-1CでComplete。広告開示マーカーのdeterministic検出はStep C-1C-1b（2026-08-26）でCode Implementation Complete**（whitelist方式のsatisfied/missing/not_checked判定・非ブロッキング）。**2つのdetector結果の集約はStep C-1C-2a（2026-08-27）でCode Implementation Complete**（`_apfrEvaluateComplianceAssessment()`・clear/blocked/not_checked・非ブロッキング）。**通常Instagram投稿のMobile Approvalへの実ブロック接続はStep C-1C-2b-1（2026-08-27・新規Decision 109）でCode Implementation Complete**（`canApprove`へのCompliance Enforcement接続・submit直前再評価・Publishing Ready/markInstagramPublishedは既存下流guardで自動追従）。**IADP Approval（`_iadpApproveDesign()`・accountCreationReadiness）への実ブロック接続はStep C-1C-2b-2として実装前調査を実施し、Compliance AssessmentがIADPパッケージ（object型）をdeep recursionせず評価対象成果物が異なるという責務不一致・false positiveリスクが実測確認されたため、Not Requiredと正式判定した（2026-08-27・Decision109追記。非IADP案件のenforcement spineギャップはMobile Approval Enforcementにより既に解消済みであり、IADP側への追加接続は不要）**。**server-side validation（Step C-1C-2b-3）はAPFR ResolverがClient専用Contractのため実装不可**と判定済み（client-only Enforcementとして確定）⑪`advertisingDisclosureRequirements`／`complianceRestrictions`の構造化サブschema検討（Step C-1C-3候補・APFR schema変更を伴うため別Decision・未着手。C-1C-1bはwhitelist方式のマーカー存在検査に限定しており、schema構造化を代替するものではない）⑫**APFR Step C-2-1（payout/epc/approvalRateのFormal Truth数値突合・**Code Implementation Complete**）／**APFR Step C-2-2（C-2-1のmismatch検出結果をscore／confidence／warningへ接続するか否かの設計・未着手。C-2-1 Complete ≠ Intelligence Score Enforcement Complete）**⑬**Leader Final Grounding（Option F・2026-08-26・Code Implementation Complete・実AI E2E Validated。formalTruthRule単一ソース化＋Leader Final Grounding Block＋fail-closed文追加により、Context外具体的捏造・Formal Truth意味誤用・架空キャンペーン/特典・Writer停止判断の不正上書きはいずれも実AI E2Eで0件を確認。ただし`#敏感肌`等の軽微な評価的表現残存ありのため正式判定はB＝軽微な表現問題のみで「Grounding Complete」とは記録しない）**⑭**Quality Gate Grounding Enforcement（根拠のない事実が残ったままPassedになる状況を防ぐ仕組み・未着手）**。**APFR実運用Complete≠EEA問題Complete／≠Quality Gate・Hold問題Complete／≠Compliance Enforcement（C-1C-2）Complete／≠Leader Final Grounding Complete／≠Quality Gate Grounding Complete**。
- **既存回帰**：`externalExecutionRecord.eer1.test.js`（51/51）／`iadpQualityContractRouting.test.js`（86/86）／`iadpStructuredOutput.test.js`／`evidencePromotion.eea10b.test.js`全PASS。IADP・User Approval・Quality Gate・EER・Product/ASP Intelligence scoreいずれも無回帰。dev-check 200/200/200。Leader Case Context Phase2は引き続き本番未commit。OpenAI API 0・Claude API 0・Web Search 0・DB schema変更0。

---

## External Execution Completion Contract ＋ EER-1/EER-2/EER-3/EER-4 **正式リリース・本番実運用完了**（2026-08-21・Decision107）

- **Contract**：正式Contract「External Execution Record（EER）」を設計正式化。現実世界・外部サービス上で実際に完了した行為をFormal Truthとして記録する契約。`FORMAL_CASE_FIELDS`へ独立キー`externalExecution`を追加（IADP配下案は不採用）。Approved≠Executed・Ready≠Executed・Deliverable Complete≠External Execution Complete・Evidence Verified≠Execution Verifiedを正式原則として採用。AI推測からの自動生成は禁止（source=`user_confirmation`のみ）。
- **EER-1 Core**：純関数`validateExternalExecutionRecord()`（executionType/status/source/actor/caseId/executedAt/packageIdを検証・入力非破壊・推測補完なし）と`_eerAppendRecord()`（重複防止・Cross-case guard・既存`pushOutputDraftToServer()`経由保存）を実装。既存`FORMAL_CASE_FIELDS`carry-forwardループ・`restoreOutputDraftFromServer()`のfieldsワイルドカード復元へ無改修で接続。合成テスト`externalExecutionRecord.eer1.test.js`：**51/51 PASS**。Code commit **504b991**。
- **EER-2 User Confirmation UI**：Leader Final Summary内、ユーザー承認ブロック直後へEER登録状況（未登録／✅ Executed）と「実行完了として登録」ボタンを追加。登録の起点はユーザーのボタン操作のみで、Ready/Approved/IADP Complete等の内部状態からの自動登録は一切ない。localhost実機検証（既存専用テスト案件`case-msoplrg6gdkr`）でボタンクリック→POST 200→サーバー永続化→フルリロード後復元一致→別案件切替でCross-case混入なしを実測し、検証後は原状復帰。Code commit **58e9451**。
- **EER-3 正式リリース**：docs release commit **ed14959**・Annotated Tag **v1.01-external-execution-record**・main push・tag push・Render反映済み。
- **EER-4 本番実運用完了**：ユーザー本人が本番UIから対象実案件`case-msr9yckye65y`へ3件（`instagram_account_created`／`asp_registered`／`asp_media_registered`）を正式登録。いずれも`status:executed`／`source:user_confirmation`／`actor:user`でContract完全準拠・重複なし。Claude Codeからの登録・変更・削除は0件（読み取り専用API確認のみ）。登録後もIADP Quality=100/Complete・Quality Gate=Passed・Evidence=Sufficient・User Approval=Approvedは無回帰、ユーザー本人がF5フルリロード後の復元も本番PC画面で確認済み。
- **既存回帰**：`iadpQualityContractRouting.test.js`（86/86）／`externalExecutionRecord.eer1.test.js`（51/51）／`iadpStructuredOutput.test.js`／`costTracker.eea8.test.js`／`evidencePromotion.eea10b.test.js`全PASS。IADP・User Approval・Quality Gate・Deliverable Completionいずれも無回帰。Leader Case Context Phase2は引き続き本番未commit。OpenAI API 0・Claude API 0・Web Search 0・DB変更0（EER-4はユーザー本人の本番UI操作のみ・テスト専用案件への一時検証データは検証後に削除済み）。

---

## Phase IG-QC-B1/B2 candidateOnly Quality Routing Fix / Production Re-evaluation **正式リリース**（2026-08-20・Decision106）

- **Phase IG-QC-B1（candidateOnly routing fix）**：`buildOutputDraftFromLeaderFinal({candidateOnly:true})`ブランチが Phase IG-QC routing 前に early return していたため、Quality Gate 候補評価で IADP へ Instagram 10 項目 Contract が誤適用されていた根本原因を修正。通常経路と完全同一の IADP Quality routing contract を candidateOnly ブランチへ追加（非 IADP・guard 失敗は`evaluateOutputPackageCompleteness()`へ fallback・後方互換維持）。`iadpQualityContractRouting.test.js`に Cases CO-A〜CO-I を追加し全 **86/86 PASS**。Code commit **0c076dd**。
- **Phase IG-QC-B2（Production Re-evaluation）**：本番 `out_1787060723866`（`case-msr9yckye65y`・IADP `iadp_1787060839814_izhakb`）の旧 snapshot（instagram/20/insufficient・QG failed）を既存`evaluateQualityGate()`関数で非課金再評価・`package_quality`と`assessmentContext.qualityGate`のみ限定保存。保存後実測：category=iadp / score=100 / status=complete / QG passed=true。Evidence・IADP 本体・User Approval・他 case は変更なし。
- **B3 正式リリース**：docs commit・Annotated Tag **v1.01-iadp-quality-routing-complete**・main push・Render 反映・PC本番確認済み。OpenAI API 0・Claude API 0・Web Search 0。Leader Case Context Phase2 引き続き本番未 commit。

---

## Phase IG-QC / B-7F Quality Gate Package Routing Fix **正式リリース**（2026-08-20・Decision105）

IADPを含むOutput DraftがInstagram投稿用`instagram` Quality Contract（hook/slideTitles/hashtags等10項目）へ誤接続されていた根本原因（Phase IG-QC）と、全Path A Output Typeで`buildOutputDraftFromLeaderFinal()`のreturn値から`packageQuality`が欠落し`evaluateQualityGate(undefined)`が実行されていた配線バグ（Phase B-7F補完）を修正した。**`index.html`（2 hunk）／`iadpQualityContractRouting.test.js`（新規・正式回帰テスト48件）のみ**（Code commit **547ddac**）。

- **Phase IG-QC（IADP Quality Contract誤接続修正）**：正式IADP（`fields.iadp.quality`存在・`validation.valid===true`・`packageId`存在）が存在する場合は`evaluateInstagramAccountDesignQuality()`の事前算出済み結果を`packageQuality`へrouting。誤評価（`score:20/instagram/insufficient`）を解消。非IADP・guard失敗は既存`evaluateOutputPackageCompleteness()`へfall-through（後方互換維持）。
- **Phase B-7F補完（全Path A Quality Gate配線修正）**：`buildOutputDraftFromLeaderFinal()`return値へ`packageQuality`を追加し全Path A Output TypeでQuality Gateへ実評価値を正式接続。これはIADP限定Hotfixではなく全Path A共通の既存配線バグ修正。
- **非干渉**：既存Quality Contract（instagram/document等）の算出内容は変更なし。Executive Decision（`qualityGate: null`責務）・User Approval・Evidence・Formal Truth・DB・API契約は変更なし。UIのQuality Gate表示（`🟢 Passed`/`🟡 Not Passed`）が実評価値に基づいて機能するようになる（`sourceStatus=null`時は非表示・既存安全側動作維持）。
- **回帰検証**：`iadpQualityContractRouting.test.js` 48/48 PASS・`iadpStructuredOutput.test.js` 13/13 PASS・`costTracker.eea8.test.js` 19/19 PASS・`evidencePromotion.eea10b.test.js` 17/17 PASS。inline JS構文OK・`git diff --check` CLEAN。Leader Case Context Phase2混入なし。OpenAI API call 0・Claude API call 0・Web Search 0・DB変更なし。
- **Version1 Final Complete／Version1.1 Connected AI Company 開発中・Phase54 Complete維持・Phase55未着手**（すべて変更なし）。次工程は対象案件`case-msr9yckye65y`のIADP専用Quality/packageQuality/Quality Gate/Account Creation Readinessを本番で再確認。詳細は docs/04DECISIONS.md Decision105参照。

---
## Claude Pricing Correction **正式リリース**（2026-08-20・Decision104）

Claude Cost Log調査の過程で、`claudeCostTracker.js`／`claudeClient.js`に重複定義された`CLAUDE_PRICE_PER_1K`のうち、claude-opus-4-8が公式単価の**3.000倍**（$15/$75 per 1M、正しくは$5/$25）、claude-haiku-4-5が公式単価の**0.800倍**（$0.80/$4 per 1M、正しくは$1/$5）という単価誤りを特定・修正した。**`claudeCostTracker.js`／`claudeClient.js`の`CLAUDE_PRICE_PER_1K`（Opus/Haiku値のみ）**。claude-sonnet-4-6は公式単価と一致しており無変更。

- **原因**：単価定数の入力誤り（計算式・重複計上防止・JPY換算・Cost Gateにはいずれも問題なし）。Claude側にはOpenAI側`costTracker.js`のようなCost Gate（`canProcess()`/`stopped`）がそもそも存在しないため、AI call拒否・budget超過停止等の機能面への影響はなし（表示・報告上の金額のみに影響）。
- **検証**：非課金fixtureテスト（Opus/Haiku/Sonnet各input/output・計6件）全PASS。2026年8月Supabase実績（`api_cost_events`正本）を公式単価で再計算した合計$4.051303が、Anthropic公式実績$3.93と残差$0.12（約3%）まで一致することを実測確認。
- **過去ログ**：Supabase `api_cost_events`・`claude-cost-logs.json`の過去記録はAudit Trailとして保持し、遡及修正はしない。修正後の新規Claude API呼び出しからのみ訂正後単価を使用。
- **非干渉**：OpenAI側`costTracker.js`・Web Search料金・IADP・EEA・Completion・Formal Truth・User Approval・working tree上の別系統差分「Leader Case Context Phase2」（`claudeClient.js`に混在していた`caseContext`関連の未commit差分）はいずれも無変更・非対象。DB Migration・DB書き込みなし。既存test既知6 FAILは無関係のpre-existing failureで新規FAILは0件。
- **Version1 Final Complete／Version1.1 Connected AI Company 開発中・Phase54 Complete維持・Phase55未着手**（すべて変更なし）。詳細は docs/04DECISIONS.md Decision104参照。

---

## IADP Structured Output **正式リリース**（2026-08-18・Decision103）

実運用予定のInstagram案件`case-msr9yckye65y`でIADP生成がValidation FAILした根本原因（自由記述の指示遵守のみに依存する構造的脆弱性）を解消。**`openaiClient.js`／`index.html`（最小限）／`iadpStructuredOutput.test.js`のみ**（Code commit **8a9d417**）。`shared/instagramAccountDesign.js`（Validator/Normalizer）は無変更。

- **API側スキーマ強制**：OpenAI Responses APIの`text.format:{type:'json_schema',strict:true}`をIADP Leader Final呼び出し1箇所のみに追加。他の全`callOpenAI()`呼び出しは無影響。
- **Schemaの範囲**：Validatorが実際に検証・消費するフィールドのみを対象とし、Validatorより強い制約は追加しない。`normalize()`が常に上書きする値（version/packageId/caseId/approval等）はモデルへ要求しない。
- **後方互換**：既存`<IADP_JSON>`タグ抽出は無変更。タグなし直接JSON（Structured Output応答）を受理する最小adapterを追加のみ。
- **Formal Truth安全契約を完全維持**：推測補完・自動水増し・validation緩和はいずれも行わず、`shared/instagramAccountDesign.js`は1行も変更していない。
- **実AI E2E**：1 workflow・8 callでResponses APIがSchemaを受理し、`validateAccountDesignPackage()`が`valid:true`。candidateComparison3件・adoptedCandidateId整合・finalProfileトップレベル正配置（前回FAILの直接原因が再発しないことを確認）。Cross-case混入なし。
- **既知の重要事項**：working treeに存在した別系統差分「Leader Case Context Phase2」（`buildLeaderCaseContext()`含む）は今回除外。本番環境には現時点で`buildLeaderCaseContext()`が存在しない。
- 合成テスト13件・EEA既存36件・Completion既存テスト全PASS。node --test 既知6 FAILは無関係のpre-existing failureで未修正。
- **Version1 Final Complete／Version1.1 Connected AI Company 開発中・Phase54 Complete維持・Phase55未着手**（すべて変更なし）。次工程はEvidence充足（EEA経路・ユーザー承認後）。詳細は docs/04DECISIONS.md Decision103参照。

---

## Deliverable Completion Architecture（STEP 6）**正式リリース**（2026-08-18・Decision102）

「AIが処理を終えた」ことと「依頼が本当に完了した」ことを分離するCompletion判定軸を新規採用。**`index.html`のみ**（Code commit **364b65a**）。Quality Gate・Constitution・User Approval・Formal Truth（Case Context）はいずれも無変更・非干渉。

- **Completion Core**：純関数`evaluateDeliverableCompletion()`（Contract v1.0.0・追加AI call 0）が`OUTPUT_PACKAGE_QUALITY_CHECKS`のrequired属性からoutputType別必須成果物の充足を判定し、`complete`／`incomplete`／`blocked`の3値を返す。`blocked`は必須成果物充足済み＋外部実行語＋User Approval pendingの組み合わせでのみ発火する安全側限定判定。
- **Completion保存・復元**：新DB列・新テーブルなし。既存`package_quality`（JSONB）へ`completionAssessment`を同梱保存し、F5復元時にdraftトップレベルへ再展開。`FORMAL_CASE_FIELDS`（次Draftへcarry-forwardする案件正式fields契約）には含めない。
- **Formal Truth Race Condition安全化**：案件切替直後にAuto Taskが開始するとOutput Draft復元完了前に走り`iadp`/`intelligenceContext`が新Draftへ引き継がれない実測済みの競合を、`scheduleOutputDraftRestore()`のPromise化と`atRunWorkflow()`側のawaitガードで解消（sleep/setTimeout不使用）。単一field（iadp）限定だったcarry-forwardを`FORMAL_CASE_FIELDS`契約全体（4項目）へ一般化。
- **実AI E2E（`case-msoplrg6gdkr`・1 workflow）**：`estimateAutoTaskCalls()`事前見積りmax=5と実call数5（Claude3・OpenAI2）が一致・想定外カスケードなし・Web Search0回。新規Draft`out_1786976475516`でFormal Truth carry-forward・completionAssessment DB保存/F5復元一致・他7 case完全不変（Cross-case非混入）を実測。
- **Completion UI**：Output Engineパネルへ最小表示（Complete/Incomplete/Blockedの短縮バッジのみ・contract全体は非表示）。`completionAssessment`が存在しない既存Draftは非表示（Complete扱い・推測表示のいずれもしない）。
- **Output Type判定精度改善**：`detectOutputType()`の`instagram_post`キーワードへ`instagram`/`インスタ`裸トークンを追加し、carousel固有語を含まない一般的なInstagram投稿依頼が`instagram_carousel`へ誤判定される実バグを修正（13型代表テスト回帰なし・既存fallback`document`維持）。
- **既知の未commit差分（今回対象外）**：working treeに存在した別系統差分「Leader Case Context Phase2」（`claudeClient.js`／`openaiClient.js`／`server.js`および`index.html`一部）はSTEP 6と機能的依存がないため今回のcommitから意図的に除外（別途ユーザー判断でリリース）。
- node --test 81 PASS／6 FAIL（`server.test.js`のLeader固定返信文言ドリフトによるpre-existing failure・本リリースと無関係・未修正）。EEA既存合成テスト36件全PASS。inline script構文OK・`git diff --check` CLEAN・dev-check 200/200/200。
- **Version1 Final Complete／Version1.1 Connected AI Company 開発中・Phase54 Complete維持・Phase55未着手**（すべて変更なし）。次工程はInstagram実運用を優先（ユーザー承認後）。詳細は docs/04DECISIONS.md Decision102参照。

---

## External Evidence Acquisition（EEA）**正式リリース**（2026-08-13・Decision101）

Instagram Account Design Package（IADP）のEvidence不足を、AI会社自身がWeb Search経由で解消できる基盤。**新規DB table・schema変更なし**（正本は既存`outputDraft.fields.intelligenceContext.evidence[]`のみ）。

- **User Approval型Web Search**：Search Plan（LLM不使用・$0円・機械生成）を表示し、ユーザーが「🔎 Web Evidence検索を実行」を明示押下するまで実行しない。billingLockはサーバー側で明示assertion必須。
- **Verified Promotion（2段階方式）**：取得したEvidence Candidateを、Trust Tier（8段階）×Independent Source（独立2 Publisher以上）×claimTypeの既存決定論的条件で評価し、条件を満たしたもののみ`verificationStatus:'verified'`へ昇格。処理順に依存しないことを合成テストで確認。market/competitionは対応、monetizationは現時点claimType未対応のため安全側でunverified固定。
- **Cost Trackerの二層構造を正式記録**：ローカルGate用state（`cost-logs.json`）とSupabase実績正本（`api_cost_events`→`/api/cost`）は完全に独立。過去の「Historical Cost Lost」表現を「**Local Cost Gate State Historical Values Lost**」へ訂正（Supabase側実費履歴は無傷）。
- **実測toolCallCount精算の仕様化**：`tool_choice:'auto'`によりSearch Planのquery数と実際のOpenAI `web_search_call`数が一致しない場合があることを実測（3クエリ→実測6 tool calls）。事前表示は上限目安、実行後精算（`api_cost_events`実測）を正本とする。
- **実機検証（EEA-11）**：QA専用case`case-msoplrg6gdkr`で承認済み3クエリのみ実Web Searchを実施。政府ドメイン5件が全件verified・独立Publisher3件・`resolveIadpEvidence()`実測で既存Gate（`MIN_VERIFIED_EVIDENCE=3`／`MIN_INDEPENDENT_SOURCES=2`・無変更）が`status:'sufficient'`へ到達。F5復元Complete。Account Creation Readinessは`conditional`（Evidence関連は全てComplete・唯一の理由はEvidenceと無関係な`userApproval: pending`）。
- Console Error 0・合成テスト計36件全PASS（EEA-8：19件／EEA-10B：17件）・実Web Search1回（3クエリ・承認済み）・追加API実行0回。
- **Version1 Final Complete／Version1.1 Connected AI Company 開発中・Phase54 Complete維持・Phase55未着手**（すべて変更なし）。Tier3/Tier6 allowlist・monetization mapping・Category Coverage Gate化は改善候補として保留。次工程はInstagram実運用またはPhase55判断（ユーザー承認後）。詳細は docs/04DECISIONS.md Decision101参照。

---

## IADP / LFS Navigation & Scroll Usability Improvement **正式リリース**（2026-08-12・Decision100）

純粋なUI操作性改善。**index.htmlのみ**（Code commit **0309086**・+99/-11）。IADP契約・LFS契約・Evidence判定・Quality Gate・Reviewer・Strategy・adoptionDecision・User Approval・Output Draft保存契約・Researcher・Analyst・DB・schema・APIはすべて無変更。

- **IADP→LFS直接ジャンプ**：IADPカードへ「↓ Leader Final Summaryへ」を追加。
- **LFS→IADP直接ジャンプ**：Leader Final Summaryへ「↑ Instagram Account Design Packageへ」を追加（既存`_lfsScrollToDetails()`を再利用）。
- **チャット上端／下端固定ジャンプ**：`#chat-scroll-nav`（↑/↓）を追加。
- **`#chat-area`スクロールバー操作性改善**：幅6px→14px、track/thumbコントラスト強化、Windows既定矢印ボタン非表示化。
- **スクロールバー不具合の根本原因修正**：実機確認で「一部分しかドラッグできない」症状が判明し、`document.elementFromPoint()`のピクセル単位スイープで原因を特定。既存の`id="knowledge-panel"`重複バグ（📚ナレッジエンジン用・🧠顧客記憶パネル用が同一ID）により、ナレッジエンジン側の「閉」状態が画面外へ完全退避できず、右端の帯が`#chat-area`のスクロールバー領域の大半を覆っていた。**Edge/Chromiumのネイティブスクロールバー仕様が原因でないことを実測確認済み**。衝突IDの片方（顧客記憶パネル側）のみ`company-memory-panel`へ改名する最小修正で解消。副次効果として、従来一度も正しく開閉できていなかった顧客記憶パネルが今回初めて正しく開閉できるようになった。
- Cross-case安全性・ユーザーWindows/Edge実機確認とも完了。Console Error 0・dev-check 200/200/200・`git diff --check` CLEAN・実AI実行0回・追加API費用0円。
- **Version1 Final Complete／Version1.1 Connected AI Company 開発中・Phase54 Complete維持・Phase55未着手**（すべて変更なし）。次工程はExternal Evidence Acquisition（設計調査完了・未実装）。詳細は docs/04DECISIONS.md Decision100参照。

---

## IADP Post-Release Hotfix / Hotfix-Quality / Stability Hotfix **正式リリース**（2026-08-11・Decision099）

Decision098（IG-2J-A〜I）後の実運用確認で、IADP生成物に構造・品質面の不備が判明した。**index.html／openaiClient.js／shared/instagramAccountDesign.js／shared/instagramAccountDesignQuality.js／shared/agentResultNormalizer.js**。**server.js／DB／supabase/schema.sql／API契約は無変更・新規API/新規DBカラム/新Engineなし**。

- **Post-Release Hotfix**（Code commit **585360c**）＝Leader Final構造安定化・`adoptionDecision`/`adoptedCandidateId`のSSOT維持・Final Profile統合・IADP保存/表示・Output Draft生JSON汚染防止・invalid時安全案内・F5復元・Cross-case独立性・User Approval pending維持・AI Action/User Input境界維持。
- **Hotfix-Quality**（Code commit **4b92f0d**）＝AI会社自身が決定できる運用設計項目（顔出しなし・本人音声なし方針／KPI5項目／KPI改善条件／6リスク／リスク回避策／`first30DaysOperatingPolicy`／Reviewer指摘のLeader自律補完）を未完成のままユーザーへ返さないよう強化。専用テスト案件`case-msolp1yuv5rq`での実AI再検証で①JSON末尾`}`不足②finalProfile誤配置③adoptionDecision誤配置④KPI5がnull⑤`first30DaysOperatingPolicy`が配列、の5件FAILが判明。
- **Stability Hotfix**（Code commit **936cd77**）＝Leader Final Prompt出力安定化（KPI5=number明示・`first30DaysOperatingPolicy`=string明示・サンプルJSON型仕様整合・出力前チェックリスト・JSON括弧を最後まで閉じる契約。`max_output_tokens`は8192のまま変更なし）＋決定論的JSON Recovery（`IADP_MAX_SYNTHETIC_CLOSERS=2`・末尾閉じ括弧不足のみ限定補修・内容の発明/推測は禁止・補修結果を監査保持・parse失敗時は`json_parse_failed`診断でinvalid再生成導線へ接続）＋finalProfile/adoptionDecision誤配置救済（正位置優先・adoptedCandidateIdを発明しない・総合点1位を自動採用しない）。
- **実AI最終再検証**＝専用新規テスト案件`case-msoplrg6gdkr`（費用**¥52.62**・上限¥100以内）で前回FAILの5件すべて解消を確認。JSON parse成功・synthetic closer recovery不発動／finalProfile・adoptionDecisionとも正位置／KPI5全項目number型／`first30DaysOperatingPolicy`がstring型／Reviewer Passed・Strategy Accepted・Quality Gate Passed・User Approval Pending／Output Draft汚染なし・F5復元一致・Cross-case独立性維持（実案件3件・既存テスト案件2件をバイト単位で無傷確認）・Console Error 0・dev-check 200/200/200。**結果はAccount Creation = Not Ready（Evidence Insufficient）＝Decision097 Ready正式条件が正常に機能した結果でありFAILではない**。
- 実AI dispatchは2回発生（1回目はAuto Task自動開始OFFでLeaderチャット応答のみ・AI社員Workflow未実行。2回目でAuto Task一時ONにより全工程完走）し、**成果物を生成した完全なAI社員Workflow実行は1回のみ**。1回目dispatchの残置pending Task 12件はDB直接削除禁止のためKnown Test Dataとして残置。過去引継ぎの実案件「4件」表記は今回実測3件（無傷）と異なることを記録。
- **Version1 Final Complete／Version1.1 Connected AI Company 開発中・Phase54 Complete維持・Phase55未着手**（すべて変更なし）。詳細は docs/04DECISIONS.md Decision099参照。

---

## Phase IG-2J-A〜I Instagram Account Design Self-Completion / AI Action Rerun **正式リリース**（2026-08-10）

**IADPを「AI会社自身が不足を判定し、必要なAI社員を再実行し、Leader Finalを再生成して再評価できる」状態まで到達させた**（Decision098）。**index.html／openaiClient.js／shared/instagramAccountDesign.js／shared/instagramAccountDesignQuality.js／shared/iadpIntelligenceContext.js（新規）／shared/agentResultNormalizer.js（新規）**。**server.js／DB／supabase/schema.sql／API契約は無変更・新規API/新規DBカラム/新Engineなし**。**Version1.1 Connected AI Company 開発中・Phase54 Complete維持・Phase55未着手**。

- **IG-2J-A Self-Completion Mode**（Code commit **d95f196**・`openaiClient.js`のみ）＝IADP対象4担当（Researcher／Analyst／Branding／SNS）が情報不足でも逆質問だけで停止せず、**事実／AI仮説／外部確認待ち／User Input Required**を分離した成果物を必ず返す。`buildSystemPrompt()`へ任意第4引数を追加し、通常Workflowは完全に同一文字列を維持。
- **IG-2J-B Leader Final Summary**（Code commit **7a33296**・`index.html`のみ・削除ゼロ）＝チャット最新位置へ実運用可否／採用候補／採用理由／構造充足／Evidence／内容品質／Reviewer／Strategy／Quality Gate／Approvalを要約表示。**「構造充足99%」と実運用品質を明確に分離**。
- **IG-2J-C AI Action / User Input分離**（Code commit **244cad2**）＝確認事項を`actionItems.aiActions`／`userInputs`へreason code＋決定論的分類で正式分離。**ターゲット・ジャンル・投稿頻度・KPI等はAI会社が決める＝ユーザーへ質問しない**。
- **IG-2J-D 採用案 Single Source of Truth**（Code commit **144b0ff**）＝正式正本を`intelligence.adoptionDecision.adoptedCandidateId`へ統一。**総合点1位を自動採用しない**（順位差はLeaderの判断結果として説明表示）。比較表decisionは表示時のみ正本へ整合（保存副作用なし）。Final Profile不一致は文字列補正せず安全側でNot Ready。
- **IG-2J-E Intelligence実数値の担当指示注入**（Code commit **fa91cae**・`shared/iadpIntelligenceContext.js`新規）＝既存`outputDraft.fields.intelligenceContext`（6層＋Evidence＋Confidence）を4担当の指示文へ注入。**Fact／Prediction／Unknownを分離**し、裏付けEvidenceのない数値は必ずPrediction。caseId guard・stale明示・Token上限あり。
- **IG-2J-F Evidence正本接続**（Code commit **d7d21dd**）＝Evidence正本を`outputDraft.fields.intelligenceContext.evidence[]`へ接続。**Verified／Derived／Unknownを分離**し派生・推定Evidenceを検証済み件数へ算入しない。`fieldStatus`はlegacy fallbackとして維持（過去データが突然Insufficientへ落ちない）。
- **IG-2J-G 成果物正規化**（Code commit **7ff4140**・`shared/agentResultNormalizer.js`新規）＝`{"reply":...}` wrapperと```json fenceの構造ノイズのみを除去。**通常文章・一般コードブロック・reply以外の正式構造JSONは一切変更しない**。原文は`task.rawResult`へ保持。空成果物を`hasMeaningfulResult`で検出（statusは書き換えない）。
- **IG-2J-H AI Action Required 自律再実行接続**（Code commit **f845db0**・`index.html`のみ）＝Summaryからユーザーが1回開始すると、reason codeに応じた**必要担当だけ**を既存`atRunWorkflow()`／`POST /api/auto-task`で再実行し、Reviewer→Strategy→Leader Final→IADP再評価まで既存経路で完走する。**新Workflow Engineなし**。安全弁＝自動起動なし／二重実行防止／案件あたり3回・同一reason code 2回の上限／Cross-case guard／stale Quality Gate guard／**Approval自動承認なし**。
- **IG-2J-I 最終統合検証**（Code変更なし）＝回帰**441項目全PASS**（A 26／D 111／E 87／F 93／G 71／H 53）。**実AI End-to-End 1回実施**（専用検証案件・Researcher→Analyst再実行→Reviewer→Strategy→Leader Final 9,229字→新IADP生成→SSOT解決→Evidence判定→Quality Gate再評価→F5復元）。**API追加費用 約¥30**（上限¥100内）。実案件は読み取り専用・書き込み0件・完全一致。検証用テストデータは`remaining=0`を実測確認。
- **実データで確認できた効果**：実AI応答が実際に`{"reply":...}`形式で返り、IG-2J-Gの正規化が実運用で機能（原文は保持）。採用案は総合点1位ではない候補が正本として正しく解決され、Quality Gate通過後もReviewer needs_workのため`not_ready`／`pending`を維持（**承認だけ・QGだけでReadyにしない**設計を実証）。
- **Known Issue（IG-2Jの正式リリース判定をBlockしないと評価）**：①チャット経路`generateReply`のreply wrapper残存（IADP経路とは別サブシステム）②Reviewer NG partial-match（Leader Inboxの矛盾*候補*のみ・IADPは回避済み）③iPhone Landscapeレイアウト崩れ④iPhoneチャット履歴の瞬間消失⑤Background Execution未実装。
- **Render本番反映（2026-08-10実測）**：本番`/`・`/api/task-history`・`/api/workflow-dashboard`いずれも**200**。配信物へIG-2J全工程の反映を10項目で確認（B Summary／C 分類表示／D SSOT／E Adapter読込／F Evidence正本／G 正規化読込・ラッパ／H 再実行計画・実行導線・上限guard）。新規共有モジュール`shared/iadpIntelligenceContext.js`・`shared/agentResultNormalizer.js`を含む4モジュールとも**200**。build error／runtime errorなし。
- **PC本番確認 完了（2026-08-10）**：本番URLで保存済み実データ（実AI再実行なし・**書き込み0件**）により、Leader Final Summary／IADPカード／採用候補（正本解決）／Evidence／Quality Gate／Reviewer・Strategy／AI Action・User Input分離／Approval／「AI会社に修正させる」導線をすべて表示確認。**横はみ出しなし・Console Error 0**。
- **iPhone Portrait実機確認 完了（2026-08-10・ユーザー実施）**：本番表示・Leader Final Summary・IADPカード・1カラム表示・横はみ出しなし・AI Action / User Input表示・承認ボタン・詳細ボタン・チャット入力欄・スクロールいずれも正常。**Landscapeは既存Known Issue継続**（Responsive未対応・IG-2J実装による新規不具合ではない・正式リリース判定には影響させない）。
- **Git・反映**：Code commit **d95f196＋7a33296＋244cad2＋144b0ff＋fa91cae＋d7d21dd＋7ff4140＋f845db0**＋docs commit **32b0821**（＋本追記commit）。Decision **098**。Annotated Tag **v1.01-instagram-account-design-self-complete**（→`32b0821`）。**main push完了**（`540411e..32b0821`）・**tag push完了**・**Render反映完了**・**PC本番確認完了**・**iPhone Portrait実機確認完了**。**Phase IG-2J-A〜I 正式リリースComplete**。次工程＝Instagram実運用準備／実運用開始。

---

## Phase IG-2F〜IG-2H IADP Quality / Approval / Quality Signals **正式リリース**（2026-08-09）

**IADPがComplete／100点／Readyと誤表示される問題（Evidence 0件・担当成果物不足・Leader統合回答なしでも100点）をIG-2F〜IG-2Hの3工程で解消し、IADP品質基盤を統合正式リリースした**（Decision097）。**index.html／shared/instagramAccountDesignQuality.js**。**server.js／shared/instagramAccountDesign.js／shared/leaderRuleEngine.js／supabase/schema.sql／DB／API契約は無変更・新規API/新規DBカラムなし**。**Phase54 Complete維持・Phase55未着手**（Decision097）。

- **根本原因**：`evaluateInstagramAccountDesignQuality()`がJSONのフィールド存在のみでscore/status/readyを決定しており、①Evidence件数が判定入力に含まれない、②担当実行状況とLeader統合回答が未接続かつ未保存でF5消失、③readyにユーザー承認ゲートなし。Summary潰れは`flex-shrink:1`＋`overflow-x:hidden`によるもの。
- **Phase IG-2F（階層品質判定・Summary UI改善）**：`assessInstagramAccountDesignPackage()`新設で構造検証／内容品質／Evidence／Readiness／User Approvalの5軸へ分離（既存評価関数は無変更で内部再利用＝後方互換）。Evidence 0件を「実データ検証済み」と表示せず、Category Scoresを「構造充足／Evidence信頼度／内容品質」へ分離。担当成果物不足・Leader統合回答不足はComplete化禁止。legacy安全判定。`.iadp-card`へ`flex-shrink:0`／`overflow:visible`（26px→547px）。Code commit **b5a3d5e**。
- **Phase IG-2G（User Approval Flow）**：`fields.iadp.approval`へ永続化・**caseId＋packageId一致時のみapproved**・新IADP生成で旧承認無効化・承認後は同一操作内でReady再評価（F5不要）。Code commit **18fc04b**。
- **Phase IG-2H（Reviewer／Strategy／Quality Gate 正式接続）**：**新しい独立判定基盤は作らず既存判定を再利用**。Quality Gateは既存正本`inbox.qualityGate`を読むのみで再実行なし。Reviewer／Strategyは既存`data.results`から多シグナル導出（**単純キーワードだけでfailed判定しない**・既知バグの`LI_REVIEWER_REJECTION_KEYWORDS`は流用しない）。既存Workflow順は変更せず`_liCollectIntegration()`直後の`_iadpRefreshAfterIntegration()`で後から再評価。`fields.iadp.assessmentContext`へsnapshot保存・packageId一致検証。Code commit **4dd0400**。
- **Ready正式条件**：構造Passed＋内容Complete＋Evidence非Insufficient＋Reviewer重大不足なし＋Strategy再設計要求なし＋Quality Gate Passed＋Leader統合回答あり＋必須担当成果物あり＋User Approval Approved の全充足。**承認だけで品質不足を上書きしない**。未取得は`not_available`／`not_executed`として明示。
- **Path B**：`inbox.qualityGate === null`のためComplete／Readyへ到達しない安全側仕様として正式容認。正式経路はPath A Auto Task（Path BへQuality Gateを新設しない）。
- **Background Execution（方針記録のみ・今回未実装）**：Version1.1後半の大型工程。実装順＝正式化→Instagram実運用→KPI/Learning実測→ボトルネック確認→Background Execution。将来対象＝Job Queue／Background Processing／状態遷移／Progress保存／Resume／Retry／Cancel／Multiple Jobs／完了通知／Cross-case guard／二重実行防止／古い結果による上書き防止／コスト制御。**品質判断が安定する前にBackground化しない**。
- **Known Issue**：Reviewer NG keyword partial-match issue（`NG`部分一致でBRANDING/MARKETINGを誤検出し得る既存バグ。IADP側は回避済み・本体修正は後続候補）／iPhoneチャット履歴の瞬間消失／**iPhone Landscapeレイアウト崩れ（2026-08-09実機確認で継続を再確認・左サイドバーとメイン領域の占有が大きくメニュー表示時も画面の大部分が覆われ実用上ほぼ使用不可。Responsive未対応が原因でIG-2F〜IG-2I実装による新規不具合ではない・独立したResponsive対応工程として後続管理）**。
- **iPhone実機確認（2026-08-09・ユーザー実施）**：**縦画面＝Complete**（本番表示・ログイン・Leader・案件表示・メニュー操作正常・白画面なし・無限ロードなし・既存機能破壊なし）。**横画面＝Known Issue継続・未修正**（正式リリース判定には影響させない）。
- **データ保全ルール**：実案件の`fields.iadp`変更時は「backup→test→restore→restore確認」を必須とし原則専用テスト案件を使用（IG-2G/IG-2Hは専用テスト案件で実案件書き込みゼロ・検証後削除）。
- **検証**：Core合成テスト（IG-2F 9件・IG-2H 10件）／Reviewer・Strategy導出11件／UI 10ケース全合格。Reviewer failed・Strategy needs_revision・Quality Gate failedはApproved済みでもNot Ready、packageId変更で旧評価流用なし、案件切替でCross-case漏れなし、F5でsnapshot復元、legacyは自動Passedなし、iPhone相当幅375pxで横はみ出しなし。`node --check` OK・`git diff --check` CLEAN・Console Error 0・dev-check 200/200/200・**実AI追加実行なし**。Executive Decision／Constitution Validator／Quality Gate契約への非干渉をdiff実測で確認。
- **Git・反映**：Code commit **b5a3d5e**＋**18fc04b**＋**4dd0400**＋docs commit **42508c8**（IG-2I正式化）＋docs commit（本追記・iPhone実機確認結果）。Annotated Tag **v1.01-instagram-account-design-quality-ready**。main push・Render反映（本番200・配信物反映確認）・**PC本番確認 完了**・**iPhone実機確認 完了**。**Phase IG-2F〜IG-2I 正式リリースComplete**。次工程＝Instagram実運用（アカウント作成→プロフィール設定→ASP登録→商品調査→投稿企画→初回投稿→KPI取得→Learning実測）／iPhone Landscape Responsive対応（独立工程）。実AI End-to-EndはAPI費用承認後。Background Executionは実運用・Learning実測後。

---

## Phase IG-2D〜IG-2E Instagram Account Design Package Output Draft Integration **正式採用**（2026-08-06）

**IADP（Instagram Account Design Package）の実AI検証・品質調整（IG-2D）に続き、IADPを既存Output Draft永続化へ正式接続した（IG-2E）**（Decision096）。**index.htmlのみ**（IG-2D・IG-2Eとも）。**server.js／shared/instagramAccountDesign.js／shared/leaderRuleEngine.js／supabase/schema.sql 無変更**。**新規API・新規DBカラムなし**。**Phase54 Complete維持・Phase55未着手**（Decision096）。

- **IG-2D（IADP構造化JSON品質調整）**：`openaiClient.js`のIADP専用プロンプトへ実例JSON・厳守事項（10軸スコアの意味ある差・decision/adoptedCandidateId整合・括弧の対応関係）を追加し空値/プレースホルダー残留を抑制。`accountIntelligenceMode`時のみ`max_output_tokens`を4096→8192（通常Leader Finalは無変更）。`extractIadpJsonFromLeaderText()`へ末尾カンマ耐性parseを追加。`_iadpStripJsonBlock()`が構造化ブロックのみで自由文が空の場合に案内文を表示。`_iadpBuildCardHtml()`でgenreId→genreName逆引き表示・adoptionReason優先表示。Code commit **ecfed0c**。
- **IG-2E-1（Output Draft保存）**：IADP検証成功時（`validateAccountDesignPackage().valid===true`）に`_lastOutputDraft.fields.iadp`へ`{package,validation,quality,caseId,savedAt}`を格納し、既存`pushOutputDraftToServer()`（＝既存`POST /api/output-drafts`）でそのまま送信。affiliateContext／intelligenceContextと同じ「`fields`配下への相乗り保存」パターンを踏襲。
- **IG-2E-2（F5復元・案件切替復元）**：新設`_iadpApplyRestoredFields(fields, caseId)`が既存`restoreOutputDraftFromServer()`（起動時／案件切替時）の復元結果からIADPセッションキャッシュ（`_lastInstagramAccountDesignPackage`等4変数）を同期し`reRenderChatArea()`でIADPカードを自動再表示。案件に保存Draftが無ければキャッシュを確実にクリアしCross-case漏れを防止。
- **IG-2E-3（1 Case 1 正本）**：`createOutputDraft()`が`fields`を毎回初期化する既存仕様に対し、実行直前に既存`fields.iadp`を退避し新Draftへ引き継ぐことで、同一案件内でIADP以外のAuto Taskを実行しても消えないようにした。
- **未実装（区別して記録）**：IADP実AI生成からの自動保存End-to-End確認（今回はダミーパッケージによる保存/復元/切替機構の検証のみ）、Path B／Content Planning／Carousel Builder／Publishing Readyの実動作回帰確認（コード変更箇所との非重複はdiffで確認済みだが実動作は未検証）。
- **検証（localhost）**：既存案件を利用し実AIを追加実行せずブラウザJS経由でダミーIADP（`normalizeAccountDesignPackage`／`validateAccountDesignPackage`／`evaluateInstagramAccountDesignQuality`を実際に通した`valid:true`パッケージ）を注入して実測。保存＝`POST /api/output-drafts`200 OK、F5復元＝同一`output_id`のままIADPカード再表示、案件切替＝他案件へ切替でカード消滅・グローバルclear・元案件へ戻すと再表示、1 case 1 正本＝案件間混在なし、後方互換＝IADP未使用の旧Draft（type: document等）はエラーなく従来どおり復元、Console Error 0を確認。検証後は注入したダミーIADPを削除し実案件を原状復帰。`node --check` OK・`git diff --check`問題なし・`npm run dev-check` 200/200/200。
- **検証（Render本番・PC・iPhone）**：本番URL200 OK・配信物にIG-2E新規コード反映を確認。既存案件「Instagramアカウント設計」でlocalhostと同一手順のPC本番確認（保存・F5復元・案件切替・Console Error 0・検証後原状復帰）を実施。**iPhone実機確認も完了**（ユーザー実施：Render本番表示・ログイン・Leader・案件切替・Auto Task・Output Engine正常・白画面/無限ロードなし・既存機能破壊なし）。
- **Known Issue（今回の実装とは独立・後続工程で対応）**：①iPhoneで案件を開いた直後チャット履歴が一瞬消えAuto Task実行で復帰（保存/復元自体は正常・再描画競合の疑い）。②iPhone Landscapeでレイアウト崩れ（Responsive対応要）。いずれもIG-2D／IG-2Eの保存・復元機能自体の不具合ではない。
- **Git・反映**：Code commit **ecfed0c**（IG-2D）＋**0fb943e**（IG-2E）＋docs commit **d36de10**（Decision096含む7ファイル）。Annotated Tag **v1.01-instagram-account-design-output-draft**。main push・Render反映・PC本番確認・iPhone実機確認 完了。**IG-2D／IG-2E 正式リリースComplete**。次工程候補＝Known Issue①②の対応／Path B／Content Planning／Carousel Builder／Publishing Readyの実動作回帰確認／IADP実AI生成からの自動保存End-to-End確認（いずれも未着手・正式な次工程はユーザー承認後に決定）。

---

## Phase B-9F 共通Leader Rule Engine **正式リリース**（Phase B-9C〜B-9F統合・2026-08-06）

**Decision094の責務正式化に基づき、Leader統合回答プロンプト改善（Phase B-9C）と、事実整理専用の共通Leader Rule Engine（`shared/leaderRuleEngine.js`）の新規実装・Path A/Path B/手動Leader再生成3経路接続（Phase B-9D-1〜B-9D-5A）・統合検証（Phase B-9E）を正式リリースした**（Decision095）。**index.html／openaiClient.js／server.js／shared/leaderRuleEngine.js（新規）**。**DB/schema.sql/API契約は既存互換**。**Phase54 Complete維持・Phase55未着手**（Decision095）。

- **Phase B-9C（Leader統合回答プロンプト改善）**：`LEADER_FINAL_PROMPT`（Path A）・`leaderSummary()`（Path B）へ「会社の唯一の正式回答」「AI社員回答は社内検討資料」「CEO相当の最終統合責任者」「要約ではなく統合」「成果物ファースト」「情報不足の最終判断はLeader」を明文化。案件種別見出しへ「依頼された場合のみ出力」を付記。Code commit **92cc49a**。
- **Phase B-9D-1（Rule Engine接続 調査・正式設計）**：既存`_liCompareArtifacts()`／`_liDetectConflictCandidates()`／`_liDecideAdoptionCandidates()`は件数比較・単純キーワード検出に留まり`adopt`を返す経路がないことを確認。既存NGキーワード判定の偽陽性（BRANDING/MARKETING等の誤検出）も発見。これら3関数は温存し新規Core別系統を設計。コード変更なし。
- **Phase B-9D-2（共通Leader Rule Engine Core実装）**：`shared/leaderRuleEngine.js`新規（UMD・Node/ブラウザ両対応・外部依存/DOM依存/Network呼び出しなし）。公開API＝`normalizeLeaderRuleInput()`／`evaluateLeaderRuleFacts()`／`buildLeaderRulePromptBlock()`。v1結果契約に`duplicateTopics`/`conflicts`/`recommendedAdoptions`等は含めない（信頼できる検出能力がないため）。合成テスト90アサーション全PASS。Code commit **d194ba1**。
- **Phase B-9D-3（Path B接続）**：`leaderSummary()`内でCoreを呼び出し`memberReplies`/`strategyReply`から構造化サマリーを生成し`context`へ1回だけ挿入。合成テスト29アサーション全PASS。Code commit **0bd3a88**。
- **Phase B-9D-4（Path A接続）**：`runLeaderFinalResponse()`へ薄いAdapter`_lfAdaptTaskToRuleArtifact()`を追加。`mainTasks.length>0`分岐のみへ接続・`completedCount===0`分岐は無変更。合成テスト29アサーション全PASS。Code commit **756d867**。
- **Phase B-9D-5（手動Leader再生成 接続調査）**：`atTriggerLeaderFinal()`が独自のLeader Final生成を持たずPath Bと同一の`leaderSummary()`へ委譲している構造を発見。既存`memberReplies`がReviewer/Strategyをmain扱いのまま送信しerror/skippedを不可視化するデータ品質ギャップを特定。`leaderSummary()`変更が当時禁止のため実装せず報告のみ。
- **Phase B-9D-5A（手動Leader再生成 ruleArtifacts分離接続）**：既存`memberReplies`は無変更のまま、`_atBuildRuleArtifactsForManualRegen()`（新設・薄いマッピングのみ）が既存`_liAdaptManualLeaderRegeneration()`を再利用し`ruleArtifacts`を`/api/leader-summary`へ**任意項目**として追加。`leaderSummary()`は`ruleArtifacts`有無で入力元を分岐（未指定時はPath Bと完全同一ロジック）。Response契約`{ok,reply}`は無変更。合成テスト26アサーション全PASS。Code commit **22ca87c**。
- **Phase B-9E前半（静的統合検証）**：3経路の因果順・共通入力契約（`{memberId,role,status,text/reply/result,isPostProcess}`）・Reviewer/Strategy扱い・Cross-case保護・Prompt Injection耐性・Gate系非干渉（`evaluateQualityGate()`等がRule Engine出力を一切参照しないことをgrepで確認）を統合合成テスト53アサーションで実測（全PASS）。
- **Phase B-9E後半（実API統合検証）**：同一テスト案件「PhaseB4B検証用テスト案件」を再利用し、Path A Auto Task・手動Leader再生成・Path B dispatch（1回失敗→Rule Engineと無関係な既存の非決定性のため1回再送信→成功）を実施。Path A/手動再生成でQuality Gate=Not Passed（`sourceStatus:'insufficient'`）・Path Bで`qualityGate:null`（完全非表示）を実測。`decisionStatus`は一貫して`hold`・Constitution Validatorは一貫して`passed:true`・Output DraftはPath A/手動再生成で保存・Path Bで非生成を確認。Console Error 0。実費用約¥32.38（承認上限¥100以内）。
- **対象経路**：Path A（Auto Task）・Path B（dispatch）・手動Leader再生成のすべてが共通Leader Rule Engineへ正式接続。
- **未実装（区別して記録）**：意味的重複/矛盾検出・Evidence比較・`recommendedAdoptions`等の採否候補生成・`reviewerSignal`実質化・既存NGキーワードバグ修正・Claude応答JSON汚染の根本修正・UI上の「社内検討」明示・Completion Gate・Publishing Ready・Decision Ledger。
- **検証**：JavaScript構文OK・`npm run dev-check` 200/200/200・`git diff --check`問題なし・Console Error 0（全工程）。
- **Git・反映**：Code commit **92cc49a**＋**d194ba1**＋**0bd3a88**＋**756d867**＋**22ca87c**＋docs commit（本更新）。Annotated Tag。main push・Render反映。次工程候補＝意味的重複/矛盾検出の実装検討／Evidence比較の実装検討／Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。

---

## Phase B-9B Leader統合回答・会社正式回答責務 **正式採用**（2026-08-05・docs正式化のみ）

**Phase B-9Aの調査結果をもとに、Leader統合回答（Path Aの`LEADER_FINAL_PROMPT`／Path Bの`leaderSummary()`が生成しLeaderチャットへ表示する最終回答テキスト）の責務を正式化した**（Decision094）。**docsのみ**。**index.html/openaiClient.js/server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**（Decision094）。

- **用語分離**：「Leader Summary（ELR表示）」＝Executive Leader Report内でcandidateArtifacts等を3行抜粋・折りたたみ表示する事後表示セクション（`_elrBuildReportHtml()`・Phase B-8までに完成済み）と、「Leader統合回答」＝Path A/BがLeaderチャットへ表示する最終回答テキスト（今回の対象）を区別。今後docsでは後者を「Leader統合回答」と表記する。
- **会社の唯一の正式回答**：Leader統合回答はAI社員個々の回答の連結ではなく「ENBISOU AI COMPANYとしてユーザーへ提示する唯一の正式回答」と定義。
- **AI社員回答＝社内検討資料**：Writer/Researcher/Reviewer/Designer/Strategy等の個別回答は正式回答ではない。責務フロー＝`社内検討→Leader統合（重複除去・矛盾解消・採用・保留・却下）→会社回答`。既存のAI社員タブ・dispatchカード・Workflow Live等の表示機能は削除しない（今回UI変更なし）。
- **LeaderはCEO相当の最終統合責任者**：意見収集・重複除去・矛盾解消・Evidence比較・採用/保留/却下判断・情報充足の最終判断・最終成果物生成・表現統一を担う。
- **要約ではなく統合**：目的は文章短縮ではなく、重複除去・矛盾解消・Evidence比較・採用/保留/却下判断・品質統一・依頼範囲への絞り込み。
- **成果物ファースト**：出力順序＝「完成成果物→必要な場合のみ補足→必要な場合のみ採用理由→必要な場合のみ社内判断の概要」。狭い依頼では不要なブランチを自動追加しない構造を目指す。
- **情報不足の最終判断はLeaderに帰属**：各担当は安全側で情報不足と判断してよいが、追加質問か完成品生成かの最終判断権限はLeaderが持つ。
- **Gate系との責務分離**：Leader統合回答＝生成前〜生成中の判断／Quality Gate＝生成済み候補の`packageQuality.status`評価のみ／Completion Gate（未実装）＝将来の事後判定／Executive Decision＝生成後の事後判断／Constitution Validator＝構造整合性検証のみ。
- **既存Leader Integration Layerとの関係**：`_liCompareArtifacts()`等は現在Leader統合回答生成「後」の事後観測層。将来品質改善へ利用する場合はLeader Final生成「前」へ構造化JSON要約として接続する方針。
- **Path A／Path Bの構造差**：Path Aはサーバー側単一リクエスト内完結のため介入不可（Decision087の制約を継承）、Path Bはクライアント側制御のため接続しやすい。二段階AI生成は第一候補にしない。
- **未実装（区別して記録）**：LEADER_FINAL_PROMPT／leaderSummary()／strategyConsolidate()のプロンプト文言変更・Leader統合ロジック変更・Rule Engine比較結果のLeader Final生成前接続・UI上での「社内検討」明示・Completion Gate。
- **Git・反映**：docs commit（本更新）のみ。Tag作成なし・push未実施。次工程候補＝Phase B-9C Leader統合回答プロンプト改善（未着手・正式な次工程はユーザー承認後に決定）。

---

## Phase B-8 Quality Gate Executive Leader Report表示 **正式Complete**（Phase B-8A〜B-8D統合・2026-08-04・Code commit 04bf9c1）

**Phase B-7で正式採用したQuality Gate結果（`inbox.qualityGate`）を、Executive Leader Report内へ表示専用のセクションとして追加した**（Decision093）。既存の`inbox.qualityGate`構造をそのまま入力とし、新規decisionId／caseId／Version等のデータ契約は追加していない。**index.htmlのみ**。**server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**（Decision093）。

- **Phase B-8A（調査・設計）**：Executive Leader Report生成構造（`_elrBuildReportHtml`／`_elrRenderIntoChatArea`／`_elrRefreshInChatArea`）とConstitution Structure Check表示パターン（`_elrBuildConstitutionCheckHtml`）を実コード調査。`inbox.qualityGate`は既存の第2引数`inbox`から利用可能であり新規引数追加は不要と判断。表示位置・表示内容・固定注記・データ契約（既存構造をそのまま使用）を設計。コード変更なし。
- **Phase B-8B（表示実装）**：`_elrBuildQualityGateHtml(qualityGate)`を新設（`_elrBuildConstitutionCheckHtml`と同型の防御的実装・純粋関数・グローバル変数非参照・不正データ時は空文字列・入力オブジェクト非破壊・`escapeHtml`使用）。`QUALITY_GATE_SOURCE_STATUS_LABELS`（`complete`＝完成／`almost_ready`＝ほぼ完成／`needs_work`＝要改善／`insufficient`＝情報不足の4値のみ許容）を追加。`_elrBuildReportHtml()`内で`_elrBuildQualityGateHtml(inbox && inbox.qualityGate)`を呼び出し、`constitutionCheckHtml`と`summaryRowsHtml`（Leader Summary）の間へ挿入。表示位置はExecutive Summary→Constitution Structure Check→Quality Gate→Leader Summaryの順。通過時「🟢 Passed（complete＝完成／almost_ready＝ほぼ完成）」・非通過時「🟡 Not Passed（needs_work＝要改善／insufficient＝情報不足）」を表示し`score`は非表示。固定注記「現在のQuality Gateは成果物品質の初期判定（表示のみ）です。Executive Decision・Output Draft保存は制御しません。」を常設。CSS新規クラス`.elr-qg-passed`／`.elr-qg-warning`／`.elr-qg-note`を追加（Constitution専用`.elr-cv-*`とは分離）。合成テスト21アサーション全PASS（Passed/Not Passed表示・日本語補助・score非表示・固定注記・不正入力12種で空文字列・入力非破壊）。Code commit **04bf9c1**（`index.htmlのみ+52/-0`）。
- **Phase B-8C（Path A／手動Leader再生成／Path B 3経路実API統合検証）**：既存テスト案件（`case-mschx3ex4z3c`）で実施。課金ロック（billingLock）がON状態では`atAutoStartWorkflow()`が自動起動をスキップするため、ユーザー承認のもと一時解除して検証後に復元。**Path A**：`sourceMode:'auto_task'`・Quality Gate=Not Passed（`sourceStatus:'needs_work'`）・`decisionStatus:'hold'`・Constitution Validator`passed:true`（12/12）・Output Draft`status:'ready'`（`quality.status:'good'`・candidate Draftの`needs_work`とは独立して確定＝状態軸分離を実測）・`.executive-leader-report`1件・`.elr-qg-warning`1件・`/api/output-drafts` POST1回・表示順を`.elr-section-title`のDOM順で実測確認・Console Error 0・Network全200。**手動Leader再生成**：新規decisionId発行・`sourceMode:'manual_regeneration'`・Quality Gate再評価正常・`.at-leader-final-card`1件維持・ELR重複なし・Output Draft POST1回。**Path B**：`handleLeaderDispatch()`成立時でも`inbox.qualityGate===null`・Quality Gateセクション完全非表示（`.elr-qg-*`0件）・`.leader-summary-block`1件・Output Draft生成なし・`_lastOutputDraft`不変。**Cross-case**：案件切替で誤表示なし・案件へ戻すと正しく復元。**F5**：リロード後`_leaderIntegration`／`_executiveDecision`／`_constitutionValidation`ともnull・`.executive-leader-report`0件。**モバイル幅**：375px幅で横スクロールなし。コード変更なし・追加commitなし。
- **Phase B-8D（正式リリース）**：docs更新・commit・Annotated Tag **v1.01-quality-gate-report-display**・main push・Render反映・PC/iPhone本番確認。
- **対象経路**：Path A（Auto Task）・手動Leader再生成。**Path Bは`inbox.qualityGate===null`により完全非表示**（Decision092・Decision087を継承）。
- **未実装（区別して記録）**：Quality Gate結果のDB保存／Output Draft保存／Decision Ledger保存／decisionId・caseId付きラッパー／`qualityGateVersion`／`qualityGateThresholdVersion`／F5復元／Executive Decisionへの制御接続／Approved Decision Package生成条件への接続／Output停止／Output Draft保存拒否／Completion Gate／Publishing Ready／AI社員カード期限表示廃止。
- **検証**：JavaScript構文OK・`npm run dev-check` 200/200/200・`git diff --check`問題なし・Console Error 0・Network全200 OK。
- **Git・反映**：Code commit **04bf9c1**＋docs commit（本更新）・Annotated Tag **v1.01-quality-gate-report-display**・main push・Render反映。次工程候補＝Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Quality Gate監査Version保存／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。
- **補足**：Phase B-8C検証中、UI探索の誤操作により`applyLeaderTemplate('sns_flow')`からテンプレートタスク9件が生成された（AI API呼び出しなし・追加コストなし・Quality Gate表示への影響なし・Phase B-8の不具合ではない）。削除は本工程の対象外・ユーザー側で後日手動削除可能。

---

## Phase B-7 Quality Gate **正式Complete**（Phase B-7D〜B-7H統合・2026-08-04・Code commit f866d4d/0f104d3/1a92884）

**Output Package Quality（`packageQuality`）を正本入力・単軸とするQuality Gateを正式採用した**（Decision092）。`packageQuality.status`が`complete`または`almost_ready`の場合のみ通過し、`score`・数値thresholdは判定に使用しない。**index.htmlのみ**。**server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**（Decision092）。

- **Phase B-7A〜B-7C（調査・設計・責務再定義・閾値実データ調査）**：Quality Gateの正本入力を`packageQuality`単軸とし、Constitution Gate（判断プロセスの構造整合性）と責務分離。実データ調査で通過基準を`complete`／`almost_ready`（status方式）と確定。
- **Phase B-7D（安全リファクタ）**：`buildOutputDraftFromLeaderFinal(finalText, opts, targetDraft)`へ第3引数`targetDraft`を追加し、fields構築対象のみを引数化（省略時は`_lastOutputDraft`使用・既存呼び出し2箇所は完全後方互換）。Code commit **f866d4d**（`index.htmlのみ+12/-5`）。
- **Phase B-7E（評価位置接続）**：`_lastOutputDraft`とは独立したcandidate Draft`{type, fields:{}}`を`_liCollectIntegration()`内`_edRunDecisionEngine()`直前で生成。`opts.candidateOnly===true`早期returnによりfields構築とpackageQuality算出のみを行い、status確定・POSTには到達しない（candidate Draftは保存されない）。評価結果を`inbox.qualityGate`へ格納。Code commit **0f104d3**（`index.htmlのみ+43/-0`）。
- **Phase B-7F（実判定実装）**：`evaluateQualityGate(packageQuality)`へ実判定ロジックを実装。戻り値`{executed:true, passed, status:'passed'|'failed', sourceStatus}`。`sourceStatus`によりpackageQuality.status自体とQuality Gate結果を分離。Code commit **1a92884**（`index.htmlのみ+15/-7`）。
- **Phase B-7G（統合検証）**：index.htmlから実装コードを直接抽出した合成テスト14/14 PASS。Path A・手動Leader再生成・Path B 3経路の実APIテストで因果順序（candidate Draft→fields構築→packageQuality算出→Quality Gate評価→Executive Decision→正式Output Draft確定→Output Draft保存）を実測確認。Path Bは`inbox.qualityGate===null`・candidate Draft生成なし・Output Draft新規生成なしを確認（コード変更なし）。
- **Phase B-7H（正式リリース）**：docs更新・commit・Annotated Tag **v1.01-executive-quality-gate**・main push・Render反映・PC/iPhone本番確認。
- **対象経路**：Path A（Auto Task）・手動Leader再生成。**Path Bは正式に対象外**（`detectOutputType()`／`createOutputDraft()`／`buildOutputDraftFromLeaderFinal()`いずれも呼び出されずcandidate Draft生成契約が存在しないため。Decision087の「Path B＝Output Draft制御対象外」を継承）。
- **未実装（区別して記録）**：数値score閾値・threshold・`qualityGateVersion`等の監査Version保存・Quality Gate結果のDB保存/Decision Ledger保存・F5復元・UI表示・Executive Leader Reportへの表示・Output停止・Output Draft保存拒否・Executive Decision/Approved Decision Package生成条件への統合・Completion Gate・Publishing Ready判定。
- **検証**：JavaScript構文OK・`npm run dev-check` 200/200/200・`git diff --check`問題なし・Console Error 0・Network全200 OK。
- **Git・反映**：Code commit **f866d4d**＋**0f104d3**＋**1a92884**＋docs commit（本更新）・Annotated Tag **v1.01-executive-quality-gate**・main push・Render反映。次工程候補＝Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Quality Gate監査Version保存／Decision Ledger／Quality Gate UI・Executive Leader Report表示／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。

---

## Phase B-6 Constitution Gate **正式Complete**（Phase B-6A〜B-6D統合・2026-08-03・Code commit 9436fec）

**Constitution Structure Check正式採用（Phase B-5C・正式Complete・維持）で表示のみだったConstitution Validator Coreの検証結果を、Approved Decision Packageの複製可否判定（Path A／手動Leader再生成それぞれの`fields.approvedDecisionPackage`受け渡し条件）へ「狭域Constitution Gate」として接続した**（Decision091）。**index.htmlのみ**。**server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**（Decision091）。

- **Phase B-6A（調査・設計）**：Constitution Gateの接続方式として「広域Gate」（Executive Decision Engine本体・Package生成ロジックへの組み込み）と「狭域Gate」（Package複製可否のみへの限定接続）を比較検討し、既存Workflow保護原則（第14条・安全側既定値）の観点から狭域Gate案を正式採用。
- **Phase B-6B（実装）**：Path A（`atRunWorkflow()`）・手動Leader再生成（`atTriggerLeaderFinal()`）双方の`fields.approvedDecisionPackage`受け渡し条件へ、既存の`sourceDecisionId`一致・`caseId`一致に加え、`_constitutionValidation`存在／decisionId一致／caseId一致／`result.passed===true`の4条件をANDで追加。いずれか不成立時は既存どおりfail-closed（nullのまま・例外なし）。Validator本体・Executive Decision Engine本体・Package生成ロジック・Output Draft本文は無変更。Code commit **9436fec**（`index.htmlのみ+20/-2`・Path A/手動Leader再生成の2箇所に限定）。
- **Phase B-6C（実APIテスト・回帰確認）**：既存テスト案件を再利用し、低コストプロンプトでAuto Task1回・手動Leader再生成1回・Path B dispatch1回を実施。3経路とも正常完了・Executive Leader Report生成・**Constitution Structure Check：Passed（12/12）**を確認。3経路とも`decisionStatus`は`hold`のため`approvedDecisionPackage`は常に`null`であり、Gate追加が既存正常系動作へ副作用を与えないことを実測確認。Console Error 0・Network全リクエスト200 OK。
- **Phase B-6D（正式リリース）**：docs更新・commit・tag・push・Render反映。
- **未実装（区別して記録）**：Executive Constitution全14条の完全な意味論的検証・Evidence内容の十分性判定・成果物品質/完成度の実質評価・Validator違反によるOutput停止・Quality Gate・Completion Gate・Decision Ledger・Executive Memory。AI社員カードの「期限」表示は本工程でも変更していない。
- **検証**：JavaScript構文OK・`npm run dev-check` 200/200/200・`git diff --check`問題なし。
- **Git・反映**：Code commit **9436fec**（`feat: gate approved package by constitution`）＋docs commit（本更新）・Annotated Tag **v1.01-executive-constitution-gate**・main push・Render反映。次工程候補＝Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。

---

## Phase B-5C Constitution Structure Check **正式Complete**（Phase B-5C-1〜B-5C-3統合・2026-08-03・Code commit a2834d3/9e6d094/58315ee）

**Constitution Validator Core（Phase B-5・正式Complete・維持）の検証結果を、Executive Leader Report内の独立セクション「Constitution Structure Check」として表示し、Auto Task・手動Leader再生成・Path B（dispatch成立時）の完了直後に即時反映される状態まで完成した**（Decision090）。**index.htmlのみ**。**server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**（Decision090）。

- **Phase B-5C-1（Decision対応契約）**：`_constitutionValidation`を`{decisionId, caseId, result}`のセッション内ラッパーへ変更。Validator関数自体・戻り値構造（`{version, passed, violations, checkedRules}`）・12検証項目は無変更。新規ID生成なし・Validator実行1回のまま。代入は`_edRunDecisionEngine()`内2箇所（ラッパー設定／早期return時null）に限定。Node合成テスト22アサーション全PASS。
- **Phase B-5C-2（Executive Leader Report表示）**：`_elrBuildReportHtml(decision, inbox, validation)`へ第3引数追加（グローバル直接参照なし・純粋関数性維持）。Executive Summary直後・Leader Summary直前へ独立セクション表示。Passed時は`checkedRules.length`から動的算出した「Passed（N/N）」1行のみ、Violations時は`message`常時表示・`rule`は技術詳細折りたたみ内のみ。「現在は構造整合性チェックです。Evidence十分性・Quality Gate・Completion Gateとは別軸です」の固定注記を常設し全14条完全検証との誤認を防止。`decisionStatus`／`constitutionValidation.passed`／`OUTPUT_STATUS`／`packageQuality.status`の4軸を混同しない設計。不正データ（resultなし／非配列／非boolean等）でも例外を出さず安全に非表示化。既存`escapeHtml`を再利用しmessage/ruleをエスケープ。CSS新規追加は3行のみ。Node合成テスト29アサーション全PASS。
- **Phase B-5C-3（即時再描画接続）**：`_elrRenderIntoChatArea()`の挿入を`appendChild`から`insertBefore(先頭)`へ変更（既存呼び出しへの影響なし）。新設`_elrRefreshInChatArea()`（既存`.executive-leader-report`を除去し再描画するだけの限定更新・チャット全体は再構築しない）をPath A・手動Leader再生成・Path B（dispatch成立時のみ）の`_liCollectIntegration()`完了直後へ接続。**設計上の発見**：Path Bは`.leader-summary-block`という専用DOM直接追記スタイルを使用しており、既存`reRenderChatArea()`（チャット全体再構築）をそのまま使うとこのスタイルが失われることが判明したため、限定更新方式を新設して採用。
- **実APIテスト**：既存テスト案件を再利用し、Auto Task1回・手動Leader再生成1回・Path B dispatch1回（`handleLeaderDispatch()`で明示的に発生）を実施。3経路とも追加のページ操作なしで即時反映を実測（Path A/手動再生成/Path Bでそれぞれ異なる`decisionId`・正しい`sourceMode`/`pathSource`を確認）。`.executive-leader-report`重複なし・`.leader-summary-block`表示スタイル無変更・dispatchなし時の無反応（コード構造上100%スキップ）・Cross-case（案件切替で他案件非表示）・F5後`_executiveDecision`/`_constitutionValidation`ともnullリセット・Output Draft/Output Engine無変更を確認。Console Error 0・Network 200のみ。実API概算¥12。
- **未実装（区別して記録）**：Executive Constitution全14条の完全な意味論的検証・Evidence内容の十分性判定・成果物品質/完成度の実質評価・Constitution違反によるOutput停止・Quality Gate・Completion Gate・Decision Ledger・Executive Memory。AI社員カードの「期限」表示は本工程でも変更していない。
- **検証**：JavaScript構文OK（インラインJS抽出・`node --check`）・`npm run dev-check` 200/200/200（各工程で実施）・`git diff --check`問題なし。
- **Git・反映**：Code commit **a2834d3**（B-5C-1）＋**9e6d094**（B-5C-2）＋**58315ee**（B-5C-3）＋docs commit（本更新）。次工程候補＝Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。

---

## Phase B-5 Constitution Validator Core **正式Complete**（2026-08-03・Code commit ea1ae68）

**Approved Decision Package契約構造正式実装（Phase B-4・正式Complete・維持）の次工程Constitution Validatorについて、`validateExecutiveDecision(decision)`をExecutive Decision Engine Core内へ正式実装した**（Decision089）。**index.htmlのみ**。**server.js/lib/DB/schema.sql/API/UI（Executive Leader Report・AI社員カード期限表示含む）無変更**。**Phase54 Complete維持・Phase55未着手**（Decision089）。**今回正式Completeとする範囲は「Constitution Validator Core」（12項目の構造整合性検証・読み取り専用）のみであり、Executive Constitution全14条の完全な意味論的検証ではない**。

- **Validator本体**：`validateExecutiveDecision(decision)`を独立関数として新設。引数`decision`は読み取り専用。新しいDecisionを生成せず、Decision・Approved Decision Package・Output Draftのいずれも変更しない。戻り値は`{version, passed, violations, checkedRules}`のみ。
- **呼び出し位置**：`_edRunDecisionEngine()`内`_executiveDecision`確定直後にのみ実行し、結果を新設のセッション内変数`_constitutionValidation`へ保持（F5で消失・永続化なし）。因果順序（Decision生成→確定→Validator実行→保持→既存後続処理）を維持し、判断確定前に実行される経路はない。
- **検証項目（12項目）**：`executive_decision_exists`／`decision_id_present`／`decision_status_present`／`executive_summary_present`／`decision_confidence_present`／`source_decision_id_consistency`／`package_only_when_approved`／`package_null_when_not_approved`／`output_draft_did_not_generate_package`（既存`affectsOutputDraft===false`参照）／`package_holds_source_decision_id`／`cross_case_consistency`／`single_decision_authority`。
- **Path別接続確認**：Node合成テスト13シナリオ26アサーション全PASS。実APIテスト（Auto Task1回＋手動Leader再生成1回・低コストプロンプト・既存テスト案件再利用）でPath A（`decisionId: ed-mscq548ee05g`・`sourceMode:'auto_task'`）・手動再生成（`decisionId: ed-mscq6pcrymzi`・`sourceMode:'manual_regeneration'`）とも`passed:true・violations:[]・checkedRules12件`を実測。Path B直接チャットはdispatch非発生のため`_liCollectIntegration()`非起動（既存仕様どおり）。コード確認でdispatch発生時は同一Validator経路を通ることを確認。
- **非破壊性**：`git show --stat ea1ae68`で変更範囲がExecutive Decision Engine Coreセクション内3箇所（`_constitutionValidation`宣言・Validator関数本体・`_edRunDecisionEngine()`内の呼び出し）に限定されることを確認。Executive Leader Report・Output Draft生成・F5復元・Approved判定ロジックは無変更。
- **未実装（区別して記録）**：Executive Constitution全14条の完全な意味論的検証・Evidence内容の十分性判定・成果物品質/完成度の実質評価・Constitution違反によるOutput停止・Validator結果のUI表示・Quality Gate・Completion Gate・Decision Ledger・Executive Memory。AI社員カードの「期限」表示は本工程でも変更していない。
- **検証**：JavaScript構文OK（インラインJS抽出・`node --check`）・`npm run dev-check` 200/200/200・`git diff --check`問題なし・Console Error 0・Network異常なし（すべて200 OK）・実API概算¥13。
- **Git・反映**：Code commit **ea1ae68**（`feat: add executive constitution validator`）＋docs commit（本更新）。Tag作成なし・**push未実施**（ユーザー確認後に別途判断）。次工程候補＝Validator結果のExecutive Leader Report表示／Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。

---

## Phase B-4 Approved Decision Package **契約構造正式実装・統合検証正式Complete**（Phase B-4A〜B-4E・2026-08-03・Code commit 718f200/67ab6cb/95beda3/65fe551/b423acd）

**Executive Leader Report表示（Phase B-3・正式Complete）の次工程Approved Decision Packageを段階実装し、統合検証で正式完了と判定した**（Decision088）。**index.htmlのみ**。**server.js/lib/DB/schema.sql/API/UI（AI社員カード期限表示含む）無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 088）。

- **Decision ID常時発行（Phase B-4A）**：`_edRunDecisionEngine()`冒頭で`decisionId`をdecisionStatus（approved/rejected/hold/insufficient）に関わらず必ず1回発行。
- **Approved Decision Package契約構造（Phase B-4A）**：Approved時のみ生成・独自ID発行を廃し`sourceDecisionId`のみで元Decisionを参照する派生契約として確定。
- **Path A接続（Phase B-4B）**：`atRunWorkflow()`がcaseId／sourceDecisionId三重一致確認のうえPackageを取得し`buildOutputDraftFromLeaderFinal()`へ渡す。既存Output Draft挙動・POST回数（1回）は完全無変更。
- **手動Leader再生成接続（Phase B-4C）**：`atTriggerLeaderFinal()`に独立変数命名で同型ロジックを実装。旧Package誤適用防止4ケース（caseId不一致／sourceDecisionId不一致／今回非Approved／Decision不在）を確認。
- **fields保存・F5復元・後方互換（Phase B-4D）**：`fields.approvedDecisionPackage`へ参照をそのまま格納・Packageなし時は明示的にキー削除し残留防止。旧形式Draftでも例外なく動作。新規deepClone等の共通基盤は追加なし。
- **統合検証・正式完了判定（Phase B-4E）**：Node合成テスト13項目全PASS。実APIテスト（Auto Task1回＋手動再生成1回）でdecisionId相違・fields保存・F5復元・Cross-case・Console Error0・Network200のみを実測。`buildOutputDraftFromLeaderFinal()`冒頭の古いコメント不整合のみを発見・コメントのみ修正（commit **b423acd**・ロジック変更なし・機能commit群とは別コミット）。
- **所有関係**：Executive Decision Engine＝正本。`fields.approvedDecisionPackage`＝Output Draft側の複製（将来Decision Ledgerが永続正本）。
- **Git・反映**：Code commit 718f200／67ab6cb／95beda3／65fe551／b423acd＋docs commit（本更新）・Tag作成なし・**push未実施**（ユーザー確認後に別途判断）。次工程＝Phase B-5 Constitution Validator（未着手・ユーザー承認なしに開始しない）。

---

## Phase B-2 Executive Decision Control **正式工程分割Complete**（Phase B-2A／B-2B・2026-08-02・docs正式化のみ・Code変更なし）

**Executive Decision Engine Core（Phase B-1・正式Complete・維持）の次工程Executive Decision Controlについて因果接続方式を正式調査・設計し、docs採用した**（Decision087）。**本工程はコード実装ではなく、docs正式化のみである**。**docsのみ**（01PROJECT_STATUS.md／02PHASE_PROGRESS.md／04DECISIONS.md／04ROADMAP.md／06HANDOVER_NEXT_CHAT.md／CHANGELOG.md）・**index.html/openaiClient.js/server.js/lib/DB/schema.sql/API/UI 無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 087）。

- **構造的制約（実測）**：Path A（`atRunWorkflow()`）が呼ぶ`/api/auto-task`は、AI社員実行→Reviewer→Strategy統合→`runLeaderFinalResponse()`（完成成果物生成）までを単一の非同期関数・単一HTTPリクエスト/レスポンス往復の中で完結させる。クライアント側EDEはLeader Final生成前のデータへ介入できない。
- **接続方式**：案D（段階導入）を正式採用。Leader Final候補生成後・Output Draft確定前にEDEを接続。追加AI実行なし。
- **正式工程分割**：既存Phase B-2を**Phase B-2A（Executive Decision Control — Path A Causal Position・対象はatRunWorkflow()のみ・因果位置と入力契約の確立が目的）**と**Phase B-2B（Manual Leader Regeneration Alignment・対象はatTriggerLeaderFinal()）**へ分割。
- **Path A手動再生成の実測発見**：`atTriggerLeaderFinal()`は完成成果物エンジン`runLeaderFinalResponse()`ではなく軽量な`leaderSummary()`を使用し、EDE入力（`_wlLastResults`）が前回Auto Task時点のスナップショットのまま今回生成結果と紐づいていない。この整合化をPhase B-2Bへ分離（Phase B-2A完了後に開始）。
- **Path B通常チャット**：Output Draft生成が存在しないため制御対象外のまま維持（Leader Inbox生成・EDE実行自体は許可）。
- **Leader Final Candidate**：`candidateArtifacts`とは別の内部契約として新設方針。`sourceEngine:'runLeaderFinalResponse'|'leaderSummary'`で完成成果物と軽量方針サマリーを区別。
- **Approved暫定条件**：Quality Gate・Completion Gate未定義の間はdecisionStatusをapprovedへ到達させない（無条件通過でも無条件停止でもない第三の移行方式）。
- **正式ロードマップ改訂**：Phase B-1（Complete維持）→**Phase B-2A→Phase B-2B**→Phase B-3（Executive Leader Report・旧B-2相当）→Phase B-4（Approved Decision Package・旧B-3相当）→Phase B-5（Constitution Validator・旧B-4相当）→Phase A-2〜A-4→Phase C-1〜C-3→Phase D-safety→Phase D→Phase E→Phase F-1〜F-2。
- **検証**：既存コード（`atRunWorkflow()`／`server.js`の`/api/auto-task`／`runAutoTaskWorkflow()`／`runLeaderFinalResponse()`／`leaderSummary()`／`atTriggerLeaderFinal()`／`triggerStrategyConsolidate()`／`triggerLeaderSummary()`／`buildOutputDraftFromLeaderFinal()`の全呼び出し箇所）を読み取り専用で調査し、方針の実装可否・整合性を確認。**コード・DB・API・UIの変更は一切なし**。
- **Git・反映**：docs commit（本更新）のみ・Tag作成なし・**push未実施**（ユーザー確認後に別途判断）。次工程＝未定（候補：Phase B-2A Executive Decision Control — Path A Causal Position。ユーザー承認なしに開始しない）。

---

## Phase A-1g Executive Constitution v1.0.0 正式化 ／ Executive Decision Engine **正式設計・docs採用Complete**（2026-08-02・docs正式化のみ・Code変更なし）

**Leader Integration Layer Phase A（正式Complete・維持）の次工程着手前に、AI COMPANY全体の上位アーキテクチャを正式設計・docs採用した**（Decision086）。**本工程はコード実装ではなく、docs正式化のみである**（「Executive Decision Engine実装Complete」ではない）。**docsのみ**（01PROJECT_STATUS.md／02PHASE_PROGRESS.md／04DECISIONS.md／04ROADMAP.md／06HANDOVER_NEXT_CHAT.md／CHANGELOG.md）・**index.html/openaiClient.js/server.js/lib/DB/schema.sql/API/UI 無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 086）。

- **Executive Constitution v1.0.0**：AI COMPANY全体の最高位ルールとして全14条を正式採用。変更統制（ユーザー承認・Version更新・`04DECISIONS.md`〔暫定正本〕またはDecision Ledger〔正式正本〕への記録の3条件必須）も正式採用。
- **Executive Decision Engine**：新規独立Engineではなく、既存Leader Integration Layer Phase Aの`_leaderIntegration`／Leader Inboxを因果連鎖内へ昇格させる会社判断層として正式採用。`_leaderIntegration`は現時点では成果物確定後の事後観測層であり、Leader Final生成・Output Draft確定・Output Engine入力にはまだ接続されていない（Phase Aの未完成ではない）。
- **Executive Report併存**：既存`LEADER_FINAL_PROMPT`（完成成果物生成）は無変更。Executive Summaryを上位判断層として将来追加し、完成成果物を置き換えない方針。
- **状態3軸分離**：`decisionStatus`（新設候補）／`outputStatus`（既存`OUTPUT_STATUS`）／`qualityStatus`（既存`packageQuality.status`）。既存2軸は無変更。
- **Decision Confidence方針**：既存`_intelCalculateConfidence()`再利用＋Hard Gate上乗せ。新加重式は発明しない。
- **保存方式**：段階導入案D（Phase Bメモリのみ→Phase C-1で専用`executive_decisions`永続化）。`output_drafts`はupsert上書き方式のためDecision Ledger正本として使用しない。
- **正式ロードマップ改訂**：Phase A-1g→**Phase B-1〜B-4**（Executive Decision Engine Core／Executive Leader Report表示／Approved Decision Package契約化／Constitution Validator）→Phase A-2〜A-4（内容無変更・順序後退）→**Phase C-1〜C-3**→D-safety→D→E→**Phase F-1〜F-2**（Executive Memoryは最後段）。
- **検証**：既存コード（Leader Integration Layer・`runLeaderFinalResponse()`・Output Engine状態定義・Evidence/Confidence共通基盤・`isAIGatewayExecutionAllowed()`）およびDB定義（`output_drafts`のPRIMARY KEY・upsert方式）を読み取り専用で調査し、方針の実装可否・整合性を確認。**コード・DB・API・UIの変更は一切なし**。
- **Git・反映**：docs commit（本更新）のみ・Tag作成なし・**push未実施**（ユーザー確認後に別途判断）。次工程＝未定（候補：Phase B-1 Executive Decision Engine Core。ユーザー承認なしに開始しない）。

---

## AI COMPANY Leader Integration Layer（Phase A）後半 **正式リリースComplete**（2026-08-01・Code commit 5401b68/6032893/0d125e7・main push・Render反映）

Phase A本体（Decision084）に続き、**3工程を正式リリース**。①**messages案件別正本化**：`server.js`の`/api/auto-task`・`/api/consult`の`saveMessage()`計4箇所へ既存受領済みの`caseId`を追加（`caseId: caseId || null`・既存`/api/messages`と同一形式・API/DB無変更）。②**Leader Final状態サマリー分離**：`runLeaderFinalResponse()`で`completed`成果は既存どおり統合しつつ、`error`/`skipped`を状態サマリーとして分離しLeaderへ渡す（全員成功時は既存プロンプトと完全一致・error理由は1行80文字以内に安全短文化）。③**Output Draft誤認防止**：`buildOutputDraftFromLeaderFinal()`へ`noCompletedResults`判定を追加し、completed成果0件時はOutput Draftを`status:'error'`・Package Qualityを`score:0・insufficient`へ固定（従来は`status:'ready'`・機械評価で「良好87点」と誤表示されうる問題を工程3統合検証で発見し解消）。**`index.html`＋`openaiClient.js`のみ**・**server.js（messages案件別正本化を除き）・DB・schema.sql・API無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 085）。

- **工程1（messages案件別正本化）**：`/api/auto-task`のuser/assistant保存・`/api/consult`のuser/assistant保存、計4箇所へcaseId追加。保存対象・保存回数・`saveMessage()`本体は無変更。
- **工程2（Leader Final状態サマリー）**：`_lfShortReason()`・`_lfStatusLine()`をローカル追加し、`error`/`skipped`（`!isPostProcess`）の状態サマリーを構築。全員成功／一部成功／completed成果0件の3分岐でLeaderプロンプトを構築。
- **工程3（統合検証）**：正常系・一部成功・completed成果0件をlocalhost実DBで検証し、一部成功時の状態サマリーが独立セクション化されない問題・completed成果0件時のOutput Draft誤評価を発見。
- **工程3-2（誤認防止修正）**：`buildOutputDraftFromLeaderFinal(finalText, opts)`に`opts.noCompletedResults`を追加（`integratedCount===0`で判定・返却形式は無変更）。Leader Finalプロンプトへ「完成成果物出力後、必ず末尾に独立見出し『## 担当実行状況』を追加」の指示を強化。再検証で正常系71点needs_work（従来どおり）・一部成功で独立見出し出力・completed成果0件でstatus:'error'/score:0/insufficientを実測確認。
- **検証**：JavaScript構文OK・dev-check 200/200/200・git diff --check問題なし・Cross-case混入なし・新規`case_id=NULL`なし・二重保存なし・Console Error 0（全パターン）。error/skipped再現はlocalhost限定で`AGENT_WORKFLOW_CONFIG.enabled`を一時変更し検証直後に完全復元（永続コード差分なし）。
- **Git・反映**：Code commit **5401b68**（`fix: scope auto task messages by case`）＋**6032893**（`feat: include task status in leader final`）＋**0d125e7**（`fix: prevent output misrepresentation on zero completed tasks`）・docs commit＝本更新・tag **v1.01-leader-integration-phase-a-complete**・main push・Render反映。**PC本番確認 完了**（ユーザー実施：ログイン/Auto Task/Leader Integration Layer/AI社員振り分け/Leader Final/Output Engine/Task同期/案件切替すべて正常・Cross-case混入なし・Console Error/Network異常なし。Task表示は全案件13件／案件内は該当案件のみの正常仕様を確認。iPhone実機確認は対象外）。**AI COMPANY Leader Integration Layer（Phase A）正式Complete**。次工程＝未定（Phase A-2〜A-4は設計のみ完了・実装未着手。またはmessages RLS対応・Task skipped同期ギャップ対応等の残課題）。

---

## AI COMPANY Leader Integration Layer（Phase A） **正式リリースComplete**（2026-07-31・Code commit ad5eaf7/af43263・main push・Render反映）

**LeaderをPath A（Auto Task）／Path B（Leader手動チャット）双方の成果物を回収・比較・矛盾候補検出・採否候補判定する統合管理層へ拡張**。`_liCollectIntegration()`が各Pathの末尾（Leader Final受領直後・手動Leader Final再生成直後）から1回だけ呼ばれ、既存処理は無変更のまま`_liAdaptPathA`/`_liAdaptPathB`が既存データを共通Leader Inbox形式へ変換。保存はクライアント一時メモリ（`_leaderIntegration`）のみ。**`index.html`（Phase A本体 +336/-6・Hotfix +11/-0）の1ファイルのみ**・**server.js/lib/DB/schema.sql/API/既存Path A・Path B内部処理/switchCase()/chatHistory構造/Output Draft保存仕様 無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 084）。

- **Phase A本体（A-1a〜A-1e）**：`_leaderIntegration`／`_liPathBSessions`／`_liLastPathAResultsCaseId`／`_liCurrentCaseId()`（`_aicCurrentCaseId()`方式踏襲・フォールバックなし）／Leader Inbox・artifact・comparison・conflict・decision構造／`_liAdaptPathA()`（`_wlLastResults`ソース）／`_liAdaptPathB()`（`interactionId`＋`_liPathBSession`でchatHistory非接触）／`_liCompareArtifacts()`・`_liDetectConflictCandidates()`（ルールベースのみ・矛盾は必ずcandidate）／`_liDecideAdoptionCandidates()`（情報不足時hold既定値）／`_liCollectIntegration()`をPath A・Path B・手動Leader Final再生成の3箇所へ接続。
- **案件混入Hotfix**：既存のOutput Draft復元保護ロジック（Phase54-2d）と手動Leader Final再生成（`atTriggerLeaderFinal()`）の相互作用により、案件切替後も前案件のOutput Draftが別案件へ混入し得る既存不具合を実装検証中に発見。`atTriggerLeaderFinal()`冒頭に`_liCurrentCaseId()`と`_liLastPathAResultsCaseId`の厳格一致ガードを追加し、不一致時はAPI呼び出し・保存を一切行わず安全停止・再実行を案内。
- **実機検証**：Hotfix適用前に実際の混入事故（診断用Output Draft`out_1785449189461`が検証専用案件から既存案件「テスト」へ移動）を確認し、既存POST経路で復旧。Hotfix適用後は同一条件で`/api/leader-summary`・`/api/output-drafts`とも呼び出しなし・chatHistory追加なし・Draft移動なしを実測。孤立Draft・検証専用案件はSupabase SQL Editor／既存案件削除経路で限定削除。既存案件・Leader横断ログは無変更。
- **検証**：JavaScript構文OK・dev-check 200/200/200・git diff --check問題なし・回帰なし。
- **Git・反映**：Code commit **ad5eaf7**（`feat: add leader integration layer`）＋**af43263**（`fix: prevent cross-case leader final draft overwrite`）・docs commit＝本更新・tag **v1.01-leader-integration-phase-a**・main push・Render反映。**PC本番確認・iPhone実機確認 待ち**（ユーザー承認後）。次工程＝未定（Phase A-2 AI社員間再依頼／Phase A-3 成果物受け渡し／Phase A-4 Quality Loopは設計のみ完了・実装未着手）。

---

## Affiliate Intelligence Company 工程8-1/8-2/8-3A/8-3B/8-3B補正/8-3C — Market Opportunity Intelligence（①層） **正式リリースComplete**（2026-07-30・Code commit 2de9317/4ef70ca/e61e7d5/3b1e5b7・main push・Render反映）

**Version2 Core ① Market Opportunity Intelligence を案件内市場集約による説明層として追加**。`intelligenceContext.market`（既存受け皿）へ現在案件内の同一市場候補商材群を集約保存。ランキングカード・AIC最小パネル・Copy Full ReportへMarket Opportunity Intelligenceを表示（Competition直下）。**`index.html`（foundation +172/-0・ui +174/-0・persist +32/-0・fix +28/-9）の1ファイルのみ**・**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue/ASP/Content/Competition Intelligence/ランキング順位/integratedScore/estimatedProfit 無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 083）。

- **工程8-1/8-2 データ構造・案件内市場集約・Evidence共有・Confidence**：`INTEL_MARKET_MIN_PRODUCT_COUNT=2`（商材2件未満は強制insufficient・ASP同型）・`_intelBlankMarket`・`_intelBuildMarketFromCases`（案C＝案件内集約・`_aicNormalizeKeyPart`再利用・新規入力なし）・`_intelCalculateMarketConfidence`（既存`_intelCalculateConfidence`再利用）。純関数26 PASS。
- **工程8-3A 表示UI**：`_aicBuildMarketForRow`・`_aicCurrentSavedMarket`/`_aicSavedMarketForRow`（marketKey＋caseId一致で正本表示・productIdentifierではない点がContent/Competitionと異なる）・`_aicMarketParts`・`_aicBuildMarketCardLine`・`_aicBuildMarketHtml`（Safety表記必須表示・登録候補商材数とCompetition競合数を文言で区別）。UIテスト24 PASS。
- **工程8-3B 永続化・Copy**：採用時`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`＋`competition`＋`market`を同一Output Draftへ**七書き**・既存push1回（採用1回=POST1回・Market専用POSTなし）。`_aicBuildMarketReportText`をCopy Full Reportへ追記（Competition直後・Ranking手前）。保存テスト35 PASS。
- **工程8-3B補正**：初回実装で「derived集計は複数商材対象だがEvidence/Confidence母集団は採用商材1件分のみ」という不整合を発見・修正。共通ヘルパー`_intelSyncMarketGroupProductEvidence`を新設し、市場内対象商材群のProduct Evidenceを保存前に同期。既存5層Confidenceへの回帰なしを確認。補正テスト30 PASS。
- **工程8-3C 実Supabase検証**（専用caseId・商材2件）：七書き保存確認・productCount=2・Evidence22件が両商材のproductIdentifierにまたがることを確認（母集団整合の実証）・derived集計値が実値と完全一致・F5復元一致・案件切替混入なし・Copy Full Report確認。**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts・cases の3テーブルとも）**確認。
- **検証**：純関数・UI・保存・補正テスト計115アサーション全PASS・JavaScript構文OK・dev-check 200/200/200・Console 0・回帰なし。
- **Git・反映**：Code commit **2de9317**（foundation）＋**4ef70ca**（ui）＋**e61e7d5**（persist）＋**3b1e5b7**（Evidence整合修正）・docs commit＝本更新・tag **v1.01-affiliate-market-opportunity-persistence**・main push・Render反映。**PC本番確認・iPhone実機確認 待ち**（ユーザー承認後）。次工程＝未定（残るVersion2 Core層＝⑦Self Improvement Intelligence等）。

---

## Affiliate Intelligence Company 工程7-1/7-2/7-3A/7-3B/7-3C — Competition Intelligence（④層） **正式リリースComplete**（2026-07-29・Code commit 675b3d0/3feec7b/d941cfd・main push・Render反映）

**Version2 Core ④ Competition Intelligence を Product Intelligence 上の競合環境説明層として追加**。`intelligenceContext.competition`（新規モジュールキー）へ競合環境3項目（競合数・案件寿命・IG適性）をProduct Evidence共有参照で保存。ランキングカード・AIC最小パネル・Copy Full ReportへCompetition Intelligenceを表示（Content直下）。**`index.html`（foundation +107/-1・ui +117/-0・wire +28/-0）の1ファイルのみ**・**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue/ASP/Content Intelligence/ランキング順位/integratedScore/estimatedProfit 無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 082）。

- **工程7-1/7-2 データ構造・Evidence共有・Confidence**：`INTEL_MODULE_KEYS`へ`'competition'`追加（後方互換）・`INTEL_COMPETITION_INPUT_FIELDS`（competitors/lifespanMonths/igFit）・`_intelBlankCompetition`・`_intelSyncCompetitionFromProduct`（既存Product Evidenceにのみ`usedBy:'competition'`冪等追記・新規Evidence生成なし）・`_intelCalculateCompetitionConfidence`（既存`_intelCalculateConfidence`再利用・独立3件未満Insufficient・`confidenceOwner:'competition'`で分離）。純関数23 PASS。
- **工程7-3A 表示UI**：`_aicBuildCompetitionForRow`（使い捨てプレビュー）・`_aicCurrentSavedCompetition`/`_aicSavedCompetitionForRow`（保存済み`intelligenceContext.competition`をproductIdentifier＋caseId一致で正本表示・再計算しない）・`_aicCompetitionParts`・`_aicBuildCompetitionCardLine`・`_aicBuildCompetitionHtml`（★Confidenceは競合環境の根拠充足度を示すのみで競合の強弱・参入余地・推奨可否は示さない旨を明示）。
- **工程7-3B 永続化・Copy**：採用時`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`＋`competition`を同一Output Draftへ**六書き**・既存push1回（**採用1回=POST1回・Competition専用POSTなし**）。`_aicBuildCompetitionReportText`をCopy Full Reportへ追記（Product→Revenue→ASP→Content→Competition→Ranking）。
- **工程7-3C 実Supabase検証**（専用caseId `case-ms5zz5g65x1p`）：六書き保存確認・Evidence総数14件不変（product14/revenue9/asp4/content3/competition3・新規生成0）・Competition Confidence Medium（64点・independent3件）・F5復元完全一致・caseId分離・Copy Full Report順序。**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts・cases の3テーブルとも）**確認。
- **検証**：純関数23/23 PASS・JavaScript構文OK・dev-check 200/200/200・Console 0・白画面/無限ロード/横スクロールなし・回帰なし。
- **Git・反映**：Code commit **675b3d0**（foundation）＋**3feec7b**（ui）＋**d941cfd**（wire）・docs commit＝本更新・tag **v1.01-affiliate-competition-intelligence-persistence**・main push・Render反映。**PC本番確認・iPhone実機確認 待ち**（ユーザー承認後）。次工程＝未定（Market Opportunity/Self Improvement Intelligence等）。

---

## Affiliate Intelligence Company 工程6-1/6-2/6-3A/6-3B/6-3C — Content Intelligence（⑥層） **正式リリースComplete**（2026-07-29・Code commit 2b3fdd0/f2b0b5e・main push・Render反映）

**Version2 Core ⑥ Content Intelligence を Product Intelligence 上の投稿適性説明層として追加**。`intelligenceContext.content`（既存受け皿）へInstagram投稿適性3項目（保存率予測・クリック率予測・IG適性）をProduct Evidence共有参照で保存。ランキングカード・AIC最小パネル・Copy Full ReportへContent Intelligenceを表示（ASP直下）。**`index.html`（foundation +113/-0・ui +126/-0）の1ファイルのみ**・**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue/ASP Intelligence/ランキング順位/integratedScore/estimatedProfit 無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 081）。

- **工程6-1/6-2 データ構造・Evidence共有・Confidence**：`INTEL_CONTENT_INPUT_FIELDS`（saveRatePred/clickRatePred/igFit）・`_intelBlankContent`・`_intelSyncContentFromProduct`（既存Product Evidenceにのみ`usedBy:'content'`冪等追記・新規Evidence生成なし）・`_intelCalculateContentConfidence`（既存`_intelCalculateConfidence`再利用・独立3件未満Insufficient・`confidenceOwner:'content'`で分離）。
- **工程6-3A 表示UI**：`_aicBuildContentForRow`（使い捨てプレビュー）・`_aicCurrentSavedContent`/`_aicSavedContentForRow`（保存済み`intelligenceContext.content`をproductIdentifier＋caseId一致で正本表示・再計算しない）・`_aicContentParts`・`_aicBuildContentCardLine`・`_aicBuildContentHtml`（保存率予測・クリック率予測は予測値であることを明示表示）。
- **工程6-3B 永続化・Copy**：採用時`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`を同一Output Draftへ**五書き**・既存push1回（**採用1回=POST1回・Content専用POSTなし**）。`_aicBuildContentReportText`をCopy Full Reportへ追記（新規Copyボタンなし）。
- **工程6-3C 実Supabase検証**（専用caseId `case-ms3t75suuo2i`）：採用後`fields.intelligenceContext`に`product`/`revenue`/`asp`/`content`が揃うことを確認・Evidence総数14件不変（product14/revenue9/asp4/content3・重複なし）・Content Confidence Medium（64点・independent3件）。**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts とも）**確認。
- **検証**：回帰テスト118/118 PASS・JavaScript構文OK・dev-check 200/200/200・Console 0・白画面/無限ロード/横スクロールなし・回帰なし。
- **Git・反映**：Code commit **2b3fdd0**（foundation）＋**f2b0b5e**（ui）・docs commit＝本更新・tag **v1.01-affiliate-content-intelligence-persistence**・main push・Render反映。**PC本番確認・iPhone実機確認 待ち**（ユーザー承認後）。次工程＝未定（Competition/Market/Self Improvement Intelligence等）。

---

## Affiliate Intelligence Company 工程5-3（5-3A/5-3B/5-3C） — ASP Intelligence 表示UI・永続化 **正式リリースComplete**（2026-07-28・Code commit b473053・main push・Render反映）

**Version2 Core ③ ASP Intelligence の表示UI・Output Draft永続化を追加**。ランキングカード・AIC最小パネル・Copy Full ReportへASP Intelligenceを表示（Revenue直下）。**`index.html`（+146/-0）の1ファイルのみ**・**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue Intelligence/ランキング順位/integratedScore/estimatedProfit 無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 080）。

- **工程5-3A 表示UI**：`_aicBuildAspForRow`（使い捨てctxプレビュー・`_affiliateCases`空/非配列でも例外なし）・`_aicCurrentSavedAsp`/`_aicSavedAspForRow`（保存済み`intelligenceContext.asp`を正本表示・再計算しない）・`_aicAspParts`・`_aicBuildAspCardLine`・`_aicBuildAspHtml`。
- **工程5-3B 永続化・Copy**：採用時`affiliateContext`＋`product`＋`revenue`＋`asp`を同一Output Draftへ**四書き**・既存push1回（**採用1回=POST1回・ASP専用POSTなし**）。`_aicBuildAspReportText`をCopy Full Reportへ追記（新規Copyボタンなし）。
- **工程5-3C 実Supabase検証**（専用caseId）：Output Draft POST2回（scaffold1＋採用四書き1）／Evidence12件不変（product12/revenue9/asp4・重複なし）／F5復元で推奨ASP・Confidence・比較数・Independent・`updatedAt`完全一致（再計算なし実証）／caseId分離／Copy Full Report確認／Product・Revenue・ranking回帰なし／**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts とも）**。
- **検証**：純関数 工程5-3A/5-3B新規27＋工程5-1/5-2再実行44＝**71/71 PASS**・JavaScript構文OK・dev-check 200/200/200・Console 0・回帰なし・実ブラウザ確認でSupabase書込みは意図した2回のみ・AI API実行0。
- **Git・反映**：Code commit **b473053**・docs commit＝本更新・tag **v1.01-affiliate-asp-intelligence-persistence**・main push・Render反映。**PC本番確認・iPhone実機確認 完了（2026-07-28・ユーザー実施・崩れなし・横スクロールなし・白画面/無限ロードなし。保存済み案件なしのためProduct Intelligence保存済み表示/💾表示は確認対象外）＝ASP Intelligence 工程5-3 正式リリースComplete**。次工程＝未定（ASP Intelligence 7層構想の残り等）。

---

## Affiliate Intelligence Company 工程5-1・5-2 — ASP Intelligence（③層）**正式リリースComplete**（2026-07-28・Code commit 17587296c9413f53dcc05e4c72897ac4e8d0643a・main push・Render反映）

**Version2 Core ③ ASP Intelligence を Product Intelligence 上の比較説明レイヤーとして追加**。`intelligenceContext.asp`（既存受け皿）へ正規化商品名×market単位でグルーピングし、Active評価のみを候補化。**`index.html`（+212/-0）の1ファイルのみ**・**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue Intelligence 無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 079）。

- **工程5-1 データ構造・Evidence配線**：`_intelAspGroupKey`（正規化商品名×market・ASP名は含めない）・`_intelBlankAsp`・`_intelBuildAspCandidate`（Active評価のみ・読み取り専用）・`_intelDetermineAspRecommendation`（既存`estimatedProfit`最大＋決定的タイブレーク）・`_intelBuildAspFromProduct`（採用商品のEvidenceにのみ`usedBy:'asp'`冪等追記）。純関数18 PASS。
- **工程5-2 ASP Confidence**：`_intelCalculateAspConfidence`＝**`usedBy:'asp'`Evidenceのみ**を母集団に既存`_intelCalculateConfidence`再利用（派生Evidence二重計上なし）・独立3件未満Insufficient・**比較ASP数/有効利益候補2件未満は強制insufficient**・`confidenceOwner:'asp'`でProduct/Revenue Confidenceと分離。追加テスト26 PASS（合計44/44）。
- **対象外**：ASP Confidence表示UI・Output Draft永続化・F5復元・端末同期は**工程5-3へ分離・今回未実装**。
- **検証**：純関数44/44 PASS・JavaScript構文OK・dev-check 200/200/200・Console 0・回帰なし・実ブラウザ確認で**Supabase書込み0（GETのみ）・AI API実行0**。
- **Git・反映**：Code commit **17587296c9413f53dcc05e4c72897ac4e8d0643a**・docs commit **a1f9753**・tag **v1.01-affiliate-asp-intelligence**・main push・Render反映。**iPhone実機確認 完了（2026-07-28・ユーザー実施・崩れなし・横スクロールなし・空状態正常）＝ASP Intelligence 工程5-1・5-2 正式リリースComplete**。次工程＝ASP Intelligence 工程5-3（表示UI・永続化・F5復元、仕様未確定）。

---

## Affiliate Intelligence Company 工程4 — Revenue Intelligence（⑤層）**正式リリースComplete（4-1〜4-4）**（2026-07-27・Code commit 8cde936・main push・Render反映）

**Version2 Core ⑤ Revenue Intelligence を Product Intelligence 上の読み取り専用説明層として追加**。`intelligenceContext.revenue`（財務入力7＋派生2）へ Product Evidence を `usedBy:'revenue'` で共有参照。**`index.html`（+230/-1）の1ファイルのみ**・**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/ランキング順位/`_intelCalculateConfidence`本体/Product 無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 078）。

- **4-1 スキーマ/Evidence**：`INTEL_MODULE_KEYS`へ`'revenue'`追加（後方互換）・Revenue定数・`_intelBlankRevenue`/`_intelSyncRevenueFromProduct`（Product Evidence共有・**新規生成なし**・件数不変・Product非破壊）。
- **4-2 Confidence**：`_intelCalculateRevenueConfidence`＝**財務入力Evidenceのみ**で`_intelCalculateConfidence`再利用（派生二重計上なし）・独立3件未満Insufficient・status既存ヘルパ再利用・Product Confidenceと分離。
- **4-3 表示**：AIC最小パネル＋カードRevenueライン（使い捨てプレビュー・非永続・POST0・円/月・null情報なし・0有効・**順位不変**・HTMLエスケープ・375px対応）。
- **4-4 両書き永続化**：採用時に `affiliateContext`＋`product`＋`revenue` を同一Draftへ既存push1回で保存（**採用1回=POST1回**）・**保存済みRevenue優先表示💾**・旧Draトはプレビューfallback。
- **検証**：純関数31＋31・表示12・永続化15 全PASS・dev-check 200/200/200・Console 0・回帰なし・**実Supabase保存（POST1）/F5復元（Confidence保存値維持・再計算なし）/表示復元POST0/Evidence件数不変（総数10・Revenue専用生成なし）/テストデータ限定削除 remaining=0（draft=null・既存データ無影響）**。
- **Git・反映**：Code commit **8cde936**・tag **v1.01-affiliate-revenue-intelligence**・main push・Render反映。**iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・横スクロールなし・空状態正常）＝Revenue Intelligence 工程4 正式リリースComplete**。次工程＝ASP Intelligence 開始前調査・設計。

---

## Affiliate Intelligence Company 工程3 — Product Intelligence 正式化（3-1/3-2/3-3）**工程3-3 正式Complete**（2026-07-27・Code commit 3ef7495・main push・Render反映）

**採用商材の Product Intelligence を永続化**。ユーザーが保存済みAffiliate評価を採用すると、`fields.affiliateContext` と `fields.intelligenceContext.product` を**同一Output Draftへ両書き**し、既存 `pushOutputDraftToServer` で**1回保存**（採用1回=POST1回）。**`index.html` の1ファイルのみ**・**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/ランキング順位/Confidence計算式/工程3-2表示関数 無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 077）。

- **工程3-1**（**28fa51c**・+159/-0）：`intelligenceContext.product` スキーマ・Product Evidence配線・calculated Evidence・`product.confidence`（工程2ロジック再利用）・生成helper `_intelSyncProductFromAffiliate`（自動実行なし）・後方互換。
- **工程3-2**（**1d04f31**・+49/-0）：ランキングカードへ表示時Confidenceプレビュー（`_aicBuildProductConfidence`/`_aicBuildConfidenceHtml`・使い捨てctx・非永続・順位不変）。
- **工程3-3**（**3ef7495**・+58/-10）：`adoptAffiliateForContentPlanning()` 両書き化。一時変数で構築→必須項目・**caseId 6項目一致**ガード→全成功時のみ一括反映（片方だけ書かない）→既存保存1回（`_intelSaveContext`不使用）。deep copy後にproduct生成し実evidence非破壊。失敗/欠落/不一致は反映も保存もせずエラー表示。
- **検証**：隔離テスト A〜F 全合格・dev-check 200/200/200・Console 0・回帰なし・**実Supabase保存（POST1回）**・**F5復元成功**（product子項目/calculated Evidence/confidence/evidence履歴維持）・**同一商品Evidence 14→14**・**別商品Product置換・Evidence 14→28（旧保持）・新usedは旧非参照**・**テストデータ限定削除 remaining=0（API読戻し draft=null・ユーザーがSQL Editorで限定DELETE）**。
- **Git・反映**：Code commit 28fa51c/1d04f31/3ef7495・tag **v1.01-affiliate-product-intelligence-persistence**・main push・Render反映。**iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・空状態正常）**。

---

## Affiliate Intelligence Company 工程2 — Evidence / Confidence 共通基盤 **正式Complete**（2026-07-26・Code commit 29d82c1・main push・Render反映済み・iPhone実機確認完了）

**全Intelligence横断の Evidence（根拠）/ Confidence（信頼度）共通基盤を追加**。保存先は既存 `outputDraft.fields.intelligenceContext`（JSONB）。**`index.html`（+372/-0）の1ファイルのみ**・**server.js/lib/DB/schema.sql/API 無変更・新DB列/新APIなし**。**Phase54 Complete維持・Phase55未着手**（Decision 076）。

- **Evidence共通型**：7種（public_fact/manual_observation/user_input/calculated/heuristic/learning_result/ai_interpretation）・**`ev-<UUID>`**・reliability unknown既定・`derivedFromEvidenceIds`・検証（型/caseId一致/日付/ID重複/自己参照/循環/PII警告）・上限200警告のみ（自動削除なし）・**派生は独立件数に含めない**。
- **Confidence共通型**：Level High/Medium/Low/Insufficient・**独立Evidence3件未満は点数不問で Insufficient**・推定依存で減点・**Decision 032統合**。しきい値/重み/最低件数は定数化（将来Learning調整前提）。
- **AICパネル最小表示**（Leader判断直下・読み取り専用・空データは Insufficient）。**`affiliateContext`/`_icpDeriveTopic()`/Workflow Wiring は未変更**（採用商材正本は当面 `affiliateContext`）。
- **検証**：純関数18/18・dev-check 200/200/200・console error 0・AICパネル実描画OK（PC/375pxモバイル）・**実Supabase保存(POST1回)/F5復元/affiliateContext併存/テストデータ削除 remaining=0** 確認。
- **Git**：Code commit **29d82c1**・tag **v1.01-affiliate-intelligence-evidence-confidence**・main push・Render反映済み。**iPhone実機確認完了（2026-07-26）＝工程2 正式Complete**。

---

## Instagram自動運営 Workflow Wiring 本体（Affiliate選定→Instagram投稿企画）（2026-07-24・commit 745dd1e・本番反映済み・iPhone実機確認完了）

**採用したAffiliate商材を既存Instagram Output Draftへ非破壊反映し、投稿企画（Content Planning）の topic導出へ流す接続を追加**。**`index.html`（+89/-0）の1ファイルのみ**・**AI実行/新API/server.js/lib/DB/schema.sql/API shape 無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 075）。

- **実装**：`adoptAffiliateForContentPlanning()`（**保存済みActive評価のみ採用可**・rank1「（推奨）」）／`_icpDeriveTopic()` が `fields.affiliateContext` を **caseId一致時のみ**最優先使用（不一致・未設定は既存導出へ安全フォールバック・非Affiliate Draft不変）／ランキングUIに「この商材で投稿企画を作る」ボタン追加。
- **安全（Manual Only・課金なし）**：案件判定は **`_aicCurrentCaseId()`** で厳格一致（別案件フォールバックなし）／反映先は**現在案件の既存 Instagram Draft（carousel/post）のみ再利用・新規Draft生成なし＝AI実行なし**／`affiliateContext` は非破壊スナップショット（別商材は置換・同一は冪等）／既存 `pushOutputDraftToServer()` で `fields`(JSONB) として永続化。
- **Git・反映**：commit **745dd1e**・**main push済み（HEAD=origin/main=745dd1e）**・**Render反映済み**・**iPhone実機確認完了**・tag **v1.01-instagram-planning-wiring**。
- **テストデータ削除 完了**：専用テストcaseId 2件（`case-mrxmpfx78ua2`／`WW_TEST_20260723`）を**限定DELETE**（`WHERE case_id IN (...)`）で削除し、**`affiliate_evaluations` / `output_drafts` とも `remaining = 0`** を確認（条件なしDELETE不使用・既存無影響）。

---

## Affiliate Evaluation 工程1 完了（クローズ）— 工程1-D 保留課題の正式決定（2026-07-23・docs更新のみ）

**Affiliate Evaluation 工程1 を完了（クローズ）**。工程1-D調査の結論として **P2〜P6 は現時点で実装不要・保留継続を正式決定**（Decision 074）。**実装なし・docs更新のみ**（index.html/server.js/lib/DB/schema.sql/API 無変更）。**Phase54 Complete維持・Phase55未着手**。

- **工程1 完了内容（1-A〜1-D）**：永続化API／Active一意性の商材単位化（`uq_affiliate_eval_active_product`）／Workflow Wiring（D-1・退避バッファ・冪等統合・channelScope安全補強）／Active Case Hotfix（`_aicCurrentCaseId()`）／schema.sql記録／保留の正式決定。
- **保留（工程1-E以降候補・Decision 074）**：P2 inactive化API／P3 RPCトランザクション化／P4 save_failed永続化／P5 channelScope拡張／P6 GET件数上限。実害なし/緩和済みでIG開始を妨げないため、実運用で必要性が生じた時に個別再評価。
- **次工程**：**Instagram自動運営（Workflow Wiring）**（Affiliate評価ランキング→Instagram Content Planning接続・Manual Only維持）。

---

## Affiliate Evaluation 工程1-C（案A）— 実DB定義を schema.sql へ記録（2026-07-23・commit未実施）

**`affiliate_evaluations` の実DB定義を実測し、正本として `supabase/schema.sql` へ純追記**（P1解消）。**`supabase/schema.sql`（+76/-0）の1ファイルのみ**・`server.js`／`lib`／`index.html`／API shape／**実DB** 無変更。**Migrationではなく記録用**。**Phase54 Complete維持・Phase55未着手**（Decision 073）。

- **実測（読み取りのみ）**：Supabase SQL Editorで列定義・PK・UNIQUE・Index・CHECK・RLS・Policy・Trigger・FKを取得。**30列**／`id` bigint IDENTITY／数値型 numeric(6,2)・(12,4)・(14,2)・integer／detail JSONB／**Trigger なし・FK なし**／RLS enabled・Policy `affiliate_evaluations_all`（FOR ALL TO anon）。
- **記録要素**：CREATE TABLE(30列)・`affiliate_evaluations_pkey`・`affiliate_evaluations_fingerprint_key`・`affiliate_evaluations_reco_chk`・`idx_affiliate_eval_case`・`uq_affiliate_eval_active_product`・RLS有効化・Policy・冪等DO block・「記録用でありMigrationではない」コメント。**実測と全項目一致（drift なし）**。
- **DDL実行なし・実DB無変更**。本工程は dev-check を必須完了条件とせず、中核検証は schema.sql記録内容と実DB実測値の一致。
- **残課題（工程1-D以降候補・保留）**：P2 inactive化API未実装／P3 保存の非トランザクション／P4 `save_failed` のF5消失（Known Limitation）／P5 `channelScope='all'` 固定／P6 GET件数上限未設定。

---

## 工程1-B本体 Active Case Hotfix — 案件未確定時の保存防止（2026-07-22・本番通常経路確認で検出）

**案件未確定ビューから直前案件へAffiliate評価が保存され得る不具合を修正**。**`index.html`（+17/-4）の1ファイルのみ**・`server.js`／`lib`／DB／Migration／API shape **無変更**。**Phase54 Complete維持・Phase55未着手**（Decision 072）。

- **本番通常経路の読み取り確認（先行実施）**：通常ログイン→案件タブ操作で **1操作＝GET 1回**（`caseId`＋`channelScope=all`＋`activeOnly=true` → 200）・**最新一覧ではGET 0回**・**案件混入なし**・**console error 0**・**本番評価書込み 0件**。
- **不具合**：案件を開いた後に最新一覧（`__caselist__`）へ戻ると「案件を追加」が有効のままで、押下すると**直前案件へ保存され得る**。表示クリア・GET/POST未発行は正常で、データ破損や別案件評価の表示は発生しない。
- **原因**：`getCurrentApprovalCaseId()` が `_ncActiveCaseId()` の `undefined` 時に **`_lastOutputDraft.caseId` へフォールバック**する既存仕様。ローカルでは `_lastOutputDraft` が `null` のため未検出だった。
- **修正**：Affiliate専用 **`_aicCurrentCaseId()`** を追加（担当未選択・`latest`・`__caselist__` は **`null`**・**フォールバックしない**）。AIC内**4箇所**（復元応答適用前の再照合／復元リトライ対象取得／`addAffiliateCase()` の保存前判定／ボタン有効判定）を統一。**`getCurrentApprovalCaseId()` は無変更**（総使用箇所17件を維持し既存機能を温存）。
- **検証**：`node --check` OK・**dev-check 200/200/200**・**localhost Case 1〜4 全合格**（未確定ビューでボタン `disabled`／`addAffiliateCase()` 直接実行も即時中止／`_lastOutputDraft.caseId` 残存下でも `null`／別案件混入なし）・既存8関数の非回帰・**POST/PATCH/DELETE 0回**・**実DB書込みなし**。

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
