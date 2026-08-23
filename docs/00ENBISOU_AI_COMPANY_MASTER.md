# ENBISOU_AI_COMPANY_MASTER.md

> ENBISOU AI COMPANY 開発マスター（Version 2.3）
> 更新日: 2026-08-24（**ASP Product Fact Record（APFR）正式採用＋プラファスト本番実運用検証Complete＋Correction UI Core CUI-0〜CUI-2 正式リリース・本番認証後最終目視確認Complete・Decision108**。Decision104以降、本MASTERへ未反映だったDecision105〜108の正式現在地をここで整合させる。**Decision105／106**＝Quality Gate Package Routing Fix（IADPを含むOutput DraftがInstagram投稿用Quality Contractへ誤接続されていた根本原因と、全Path A Output Typeで`packageQuality`がQuality Gateへ未接続だった配線バグを修正。candidateOnly経路も同一routingへ統一し、本番`out_1787060723866`を非課金再評価してiadp/100/complete・QG passedへ是正）。**Decision107**＝External Execution Record（EER）正式採用。**現実世界の「行為」のFormal Truth**を`FORMAL_CASE_FIELDS.externalExecution`へ保持する契約で、`source:'user_confirmation'`・`actor:'user'`のみ受理しAI推測からの自動生成を禁止する。**Approved≠Ready≠Executed**を正式原則化。実案件`case-msr9yckye65y`へユーザー本人が3件（Instagramアカウント作成／ASP登録／ASPメディア登録）を本番登録済み。**Decision108**＝ASP Product Fact Record（APFR）正式採用。**現実世界の「商品事実」のFormal Truth**を`intelligenceContext.product.facts`へ保持する契約で、EER（行為）と責務分離する。`classification`は`fact`/`prediction`/`inference`/`unknown`の4値とし、**AI自身の判断による`fact`昇格を禁止**（`a8_screen_user_verified`／`advertiser_lp_user_verified`かつ`verificationStatus:'user_verified'`かつ`verifiedBy:'user'`の場合のみFact昇格可。`manual_user_input`単独では不可）。Step A Core／Step B Manual Input UIを正式リリース（Tag **v1.01-apfr-core-manual-input**）した上で、**2026-08-22にプラファスト（`case-msr9yckye65y`／`["プラファスト","a8.net"]`／A8.net）で初回本番実運用検証をCompleteした**：ユーザー本人が全21フィールドを1件ずつ登録し**21/21カバー**・Fact総22レコード（`listingNgWords`訂正履歴1件含む・**最新有効Fact基準で判定**）・**Contract違反0件**・**Cross-case混入0件**・Persistence確認済み・**AI推測Fact昇格0件**。IADP 100/complete・Quality Gate Passed・Reviewer Passed・Strategy Accepted・User Approval Approved・EER 3件executed・Evidence 9件はすべて無回帰。**重要な非依存関係**：APFR実運用Complete ≠ External Evidence Acquisition問題Complete、APFR実運用Complete ≠ Quality Gate／Hold問題Complete（いずれもAPFR後の別工程で再評価）。さらに同日、**APFR Phase 0**（Code commit **d69ff60**）で商品再Adopt時に登録済みFactが全消失する潜在的データ損失リスクを解消（**同一caseId かつ 同一productIdentifier のみcarry-over**）し、**APFR Phase 1**（Code commit **46c51ef**）で**Current Fact Resolver Contract**を正式採用した。APFRは追記専用（訂正しても旧Factを削除・変更しない）であるため、**読み取り側で現在の正本を一意に決める規則**を`_apfrResolveCurrentFact()`／`_apfrResolveCurrentFacts()`として明文化する：①明示訂正chain（任意field`supersedesFactId`）を最優先→②明示関係が皆無の場合のみ`recordedAt`最大（legacy fallback・既存22 Factはmigration不要）→③**一意決定できない場合は`ambiguous`＋`currentFact:null`のfail-closed**。母集団はcaseId/productIdentifier/field完全一致かつvalidなFactのみとし、Cross-case・Cross-product・invalid Factを除外する。**明示chainと独立legacyの並存・timestamp collisionはいずれもambiguousとし、factId辞書順・配列順・sourceMethod優先・value比較といった恣意的tie-breakerは使わない**（A8実画面とAdvertiser LPに自動的な優劣を設けない）。**今後のStep C以降のIntelligence接続は、このResolverをFormal Truthの唯一の読み取り口とし、`resolved`のみを利用し、`facts`配列を直接走査して独自に「最新」を判断してはならない**（ambiguousはscore計算・AI入力へ使用禁止）。Resolverはread-onlyでDB書き込みを一切行わない。その後**CUI-0**（Code commit **9ad76f8**）で`supersedesFactId`をduplicate identityへ含め「元の値への正式な差し戻し訂正」が誤拒否されない**Correction-aware Duplicate Policy**を採用し（全9項目一致の完全同一Correction Recordは従来どおり拒否＝duplicate防止は弱めない）、**CUI-1**（Code commit **1cf3b2e**）で**このResolverを初めてUIへ表示専用接続**した：APFRパネルは`facts`全件フラット表示を廃止し「**現在値一覧＋折りたたみHistory（既定閉）**」へ分離、現在値は**Resolverの結果のみ**を用いて決定し（UI側が配列末尾・`recordedAt`最新・`sourceMethod`から独自に判断することを禁止）、`ambiguous`では`currentFact`も候補代表も表示しない**fail-closedをUI上でも維持**する。Historyの「現在値／過去の記録」表示はResolver結果からの**動的導出のみ**で旧Factへ`superseded`状態等を保存しない（append-only不変）。あわせてbooleanの**表示のみ**日本語化した（保存値は`boolean`のまま不変）。**Step C（Intelligence・score計算）へは引き続き未接続**。さらに**CUI-2**（Code commit **fd99134**）で**Correction UI Core**を実装した：Resolverで`resolved`となった現在Factに対しユーザーが「訂正」を開始し、`caseId`/`productIdentifier`/`field`/`currentFactId`のみを保持する一時Target（**Fact本文は複製しない**）を経て、**submit直前にResolverを再実行して現在Factが変化していないことを確認したうえでのみ**`supersedesFactId`を自動付与し、既存Core経由でappend-only登録する。**`resolved`のみ訂正可・`none`は通常登録・`ambiguous`は訂正ボタン非表示（候補の代表選択もしない）**。**Cross-case／Cross-product／Cross-field を禁止**し、fieldはUI固定とsubmit時再検証の二重防御とする。**旧Factの編集・削除・mutationは一切行わない**。これにより**Correction UI Core系列（CUI-0〜CUI-2）は実装Complete**となり、2026-08-24に**main push・正式Tag `v1.01-apfr-correction-ui-core`（Annotated）作成・Render本番反映・本番実データread-only検証まで完了して正式リリースComplete**となった。続けて同日、ユーザー本人が本番URLへ認証後ログインし実ブラウザでCorrection UIを目視確認：resolved Fact行の「訂正」ボタン表示・Correction modeへの正常遷移・現在値の正常表示・field固定表示・新しい値入力欄が空（旧値自動コピーなし）・「訂正をやめる」正常表示・cancel後の通常モード復帰（Correction Target残留なし）をすべて確認し、**「確認済みFactとして登録」は押していないためCorrection Fact登録0・本番Fact変更0・DB書き込み0を維持**（Console Errorの追加実測は今回のスクリーンショット確認では未実施）。**これにより本番認証後の実ブラウザ最終目視確認もCompleteとなり、Correction UI Core系列（CUI-0〜CUI-2）に残るリリース確認Pendingは0**。ただし**CUI-2 Completeは「Correction UI Coreの完成」であり、CUI-3／CUI-4／Step C／Intelligence接続／EEA問題／Quality Gate・Hold問題のCompleteをいずれも意味しない**。残課題（**正本選択Contract・Duplicate Policy・Current Fact/History UI・Correction UI CoreはいずれもComplete**／ITP日数field不在／`listingPolicy`表記統一／フィールド選択UI／直接ジャンプ導線／入力省力化／EEA／Quality Gate・Hold）は分離記録済み（**boolean日本語表示はCUI-1でComplete**）。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。詳細はDecision105〜108参照。以前: 2026-08-20（**Claude Pricing Correction 正式リリースComplete・Decision104**。Claude Cost Log調査の過程で、`claudeCostTracker.js`／`claudeClient.js`に重複定義された`CLAUDE_PRICE_PER_1K`のうち、claude-opus-4-8が公式単価（input $5／output $25 per 1M）の正確に**3.000倍**（input $15／output $75 per 1M）、claude-haiku-4-5が公式単価（input $1／output $5 per 1M）の**0.800倍**（input $0.80／output $4 per 1M）という単価定数の入力誤りを特定した。claude-sonnet-4-6は公式単価と完全一致し誤りなし。計算式・重複計上防止（`usage_event_id`一意制約）・JPY換算（`USD_TO_JPY=160`固定）・cache token（Prompt Caching未使用のため非該当）にはいずれも問題がなく、単価定数のみが原因。Claude側には`costTracker.js`（OpenAI側）のようなCost Gate（`canProcess()`/`stopped`）がそもそも存在しないため、機能面（AI call拒否・budget超過停止）への影響はなく、表示・報告上の金額のみに影響していた。**`claudeCostTracker.js`／`claudeClient.js`の`CLAUDE_PRICE_PER_1K`（Opus/Haiku値のみ・Sonnet無変更）**を訂正。working treeに存在する別系統差分「Leader Case Context Phase2」（`claudeClient.js`に混在していた`caseContext`関連の未commit差分）は今回のcommitから明確に分離し除外。非課金fixtureテスト（Opus/Haiku/Sonnet計6件）全PASS、2026年8月Supabase実績を公式単価で再計算した合計$4.051303がAnthropic公式実績$3.93と残差$0.12（約3%）まで一致することを実測確認。過去Cost Event（Supabase `api_cost_events`・`claude-cost-logs.json`）はAudit Trailとして保持し遡及修正なし。DB Migrationなし。node --test既知6 FAILは無関係のpre-existing failureで新規FAILは0件。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。詳細はDecision104参照。以前: 2026-08-18（**IADP Structured Output 正式リリースComplete・Decision103**。実運用予定案件`case-msr9yckye65y`でIADP生成がValidation FAILした根本原因（IADP Leader Final呼び出しが自由記述のみに依存し、Promptは正式schemaを正確に要求していたにもかかわらず`finalProfile`トップレベル配置と`candidateComparison`/`adoptionDecision`出力を逸脱）を特定し、OpenAI Responses APIの`text.format:{type:'json_schema',strict:true}`（公式ドキュメントで仕様確認）をIADP Leader Final呼び出し1箇所のみへ追加した。SchemaはValidatorが実際に検証するフィールドのみを対象とし、`normalize()`が常に上書きする値（version/packageId/caseId/approval等）はモデルへ要求しない設計。`shared/instagramAccountDesign.js`（Validator/Normalizer）は1行も変更せず、既存の「生成→extract→normalize→validate→validのみ保存」安全契約（推測補完禁止・自動水増し禁止）を完全維持。実AI E2E（1 workflow・8 call）でSchema受理・`valid:true`・candidateComparison3件・adoptedCandidateId整合・finalProfileトップレベル正配置を実測確認。Cross-case混入なし・User Approval不変。**working treeに存在した別系統差分「Leader Case Context Phase2」（`buildLeaderCaseContext()`含む）は今回除外し、本番環境には現時点でこの関数が存在しない点を重要な引き継ぎ事項として記録**。**`openaiClient.js`／`index.html`（最小限）／`iadpStructuredOutput.test.js`のみ**（Code commit **8a9d417**）。node --test既知6 FAILは無関係のpre-existing failureで未修正。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程はEvidence充足（EEA経路・ユーザー承認後）。詳細はDecision103参照。以前: 2026-08-18（**Deliverable Completion Architecture（STEP 6）正式リリースComplete・Decision102**。「AIが処理を終えた」ことと「依頼が本当に完了した」ことを分離するCompletion判定軸を新規採用した。純関数`evaluateDeliverableCompletion()`（Contract v1.0.0・追加AI call 0）がoutputType別required項目の充足から`complete`／`incomplete`／`blocked`を判定し、既存`package_quality`JSONBへ同梱保存・F5復元でdraftトップレベルへ再展開（新DB列なし）。案件切替直後のAuto Task開始でOutput Draft復元前にFormal Truthが引き継がれない実測済みRace Conditionを`scheduleOutputDraftRestore()`のPromise化＋`atRunWorkflow()`側awaitガード（sleep/setTimeout不使用）で解消し、carry-forwardを`FORMAL_CASE_FIELDS`契約全体へ一般化した。実AI E2E（`case-msoplrg6gdkr`）で事前見積りmax=5と実call数5が一致・Cross-case非混入を実測。Output EngineへComplete/Incomplete/Blockedの最小表示を追加し、`detectOutputType()`の`instagram_post`誤判定（`instagram_carousel`混同）も修正した。Completion／Quality Gate／Constitution／User Approval／Formal Truthの責務分離は維持（重複判定・書き換えなし）。**`index.html`のみ**（Code commit **364b65a**）。working treeに存在した別系統差分（Leader Case Context Phase2）は機能的依存がないため今回のcommitから意図的に除外（別途ユーザー判断）。node --test 81 PASS／6 FAILは既知pre-existing failure（本リリースと無関係）。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程はInstagram実運用を優先（ユーザー承認後）。詳細はDecision102参照。以前: 2026-08-13（**External Evidence Acquisition（EEA）正式リリースComplete・Decision101**。IADPのEvidence不足をAI会社自身がWeb Search経由で解消できる基盤（EEA-1〜EEA-12）を正式採用。Search Plan機械生成（$0円）→ユーザー明示承認→実Web Search→Trust Tier（8段階）×Independent Source（独立2 Publisher以上）×claimType条件を満たしたEvidenceのみverificationStatus:'verified'へ昇格する2段階Promotion方式（処理順非依存を合成テストで確認）→既存Gate（`MIN_VERIFIED_EVIDENCE=3`／`MIN_INDEPENDENT_SOURCES=2`・無変更）評価、まで接続した。Cost Trackerがローカルgate用state（`cost-logs.json`）とSupabase実績正本（`api_cost_events`）の二層構造であることを正式記録し、過去の「Historical Cost Lost」表現を「Local Cost Gate State Historical Values Lost」へ訂正（Supabase側実費履歴は無傷）。QA専用case`case-msoplrg6gdkr`での実機検証（承認済み3クエリのみ）でverified Evidence5件・独立Publisher3件・Gate`sufficient`到達・F5復元Completeを確認。Account Creation Readinessは`conditional`（Evidence関連は全てComplete・唯一の理由はEvidenceと無関係な`userApproval: pending`）。Search Planのquery数と実際のOpenAI `web_search_call`数は`tool_choice:'auto'`により一致しない場合がある（実測3クエリ→6 tool calls）ため、事前表示は上限目安・実行後精算を正本とする仕様を記録。monetizationのclaimType mapping・Tier3/Tier6 allowlistは改善候補、Auto Task接続・Researcher直接統合は将来機能として保留（未実装）。新規DB table・schema変更なし。Code commit **40ff550**（EEA-8）・**4bcf42e**（EEA-10B）。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程はInstagram実運用またはPhase55判断（ユーザー承認後）。詳細はDecision101参照。以前: 2026-08-12（**IADP / LFS Navigation & Scroll Usability Improvement 正式リリースComplete・Decision100**。IADP⇄LFS直接ジャンプ・チャット上端/下端固定ジャンプ・`#chat-area`スクロールバー操作性改善を追加し、実機確認で判明した「スクロールバーの一部分しかドラッグできない」不具合の根本原因（既存の`id="knowledge-panel"`重複バグにより顧客記憶パネルがスクロールバー領域を覆いpointer eventを奪っていた）を特定・最小修正した（Code commit **0309086**・`index.html`のみ）。Edge/Chromiumのネイティブスクロールバー仕様が原因でないことを実測で確認済み。純粋なUI操作性改善のみで、IADP契約・LFS契約・Evidence判定・Quality Gate・Reviewer・Strategy・adoptionDecision・User Approval・Output Draft保存契約・Researcher・Analyst・DB・schema・APIはすべて無変更。ユーザー実機（Windows/Edge）確認Complete・Console Error 0・dev-check 200/200/200・実AI実行0回。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程はExternal Evidence Acquisition（設計調査完了・未実装。Researcherは現状Web検索能力なし、Evidence正本はAffiliate Evaluation手入力経路のみ）。詳細はDecision100参照。以前: 2026-08-11（**IADP Post-Release Hotfix / Hotfix-Quality / Stability Hotfix 正式リリースComplete・Decision099**。Decision098後の実運用確認で判明したIADP生成の構造・品質不備（JSON末尾括弧不足／finalProfile・adoptionDecision誤配置／KPI5がnull／first30DaysOperatingPolicyが配列）をPost-Release Hotfix（Code commit **585360c**）・Hotfix-Quality（Code commit **4b92f0d**）・Stability Hotfix（Code commit **936cd77**）の3工程で解消し、専用新規テスト案件`case-msoplrg6gdkr`での実AI再検証で前回FAILの5件すべて解消・回帰・Cross-case独立性・F5復元・User Approval pending・AI Action/User Input境界・総合点1位自動採用禁止契約の維持を確認した（API追加費用¥52.62・上限¥100以内。実AI dispatchは2回発生したが成果物を生成した完全なAI社員Workflow実行は1回のみ）。今回の結果はAccount Creation = Not Ready（Evidence Insufficient）であり、これはFAILではなく構造充足100点でもEvidence不足ならReadyへ進めないDecision097の判定契約が正常に機能した結果。**server.js／DB／supabase/schema.sql／API契約は無変更**。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。詳細はDecision099参照。以前: 2026-08-10（**Phase IG-2J-A〜I Instagram Account Design Self-Completion / AI Action Rerun 正式リリースComplete・Decision098**。IADPが「AI会社自身が不足を判定し、必要なAI社員を再実行し、Leader Finalを再生成して再評価できる」状態へ到達。**採用案の正本＝`intelligence.adoptionDecision.adoptedCandidateId`（総合点1位を自動採用しない）／Evidenceの正本＝`outputDraft.fields.intelligenceContext.evidence[]`（fieldStatusはlegacy fallback）／確認事項はAI Action・User Inputへ分離しuserInputsはAuto Task化しない／User ApprovalはAI会社が代行しない**を正式契約として採用。新Engine・新DB・新schema・新APIなし。回帰441項目全PASS・実AI E2E 1回PASS・API追加費用約¥30・テストデータremaining=0。**Annotated Tag v1.01-instagram-account-design-self-complete・main push（540411e..32b0821）・tag push・Render反映・PC本番確認・iPhone Portrait実機確認すべて完了**（iPhone LandscapeはKnown Issue継続）。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。以前: 2026-08-09（Phase IG-2F〜IG-2I IADP Quality / Approval / Quality Signals 正式リリースComplete・Decision 097。PC本番確認完了・iPhone実機確認完了＝縦画面Complete／横画面はLandscape Responsive未対応Known Issue継続。Background ExecutionをVersion1.1後半の大型工程として方針記録・未実装）。以前: 2026-08-06（Phase IG-2E Instagram Account Design Package Output Draft Integration 正式採用・Decision 096）。以前: 2026-08-06（Phase B-9F 共通Leader Rule Engine 正式リリース・Decision 095）。以前: 2026-08-05（Phase B-9B Leader統合回答・会社正式回答責務 正式採用・Decision 094）。以前: 2026-08-04（Phase B-8 Quality Gate Executive Leader Report表示 正式Complete・Decision 093）。以前: 2026-07-05（Version1 Final Complete・Mobile Topbar本番反映・iPhone実機確認完了・Version1.01 Realtime Sync Edition追加・Decision 044/045）

---

## 【Version1 最重要目的】（最優先・すべての実装判断の基準）

Version1では

「AI会社を完成させること」

ではありません。

Instagramカルーセルを毎日運用し、

アフィリエイト収益を生みながら

AI会社自身を Learning・Asset Library で成長させること

を Version1 最優先目的とします。

今後の全ての実装は、この目的を最優先基準として判断してください。

---

## 【Version1 完成条件】（正式リリース条件）

Version1 正式リリース条件は

AI会社が Instagram 運用を毎日支援できること。

具体的には

市場分析
↓
テーマ提案
↓
カルーセル構成
↓
画像生成
↓
背景画像＋文字レイアウト済みカルーセル完成
↓
投稿文
↓
CTA
↓
ハッシュタグ
↓
iPhone成果物確認
↓
iPhone修正依頼
↓
iPhone承認
↓
Instagram手動投稿
↓
Learning
↓
Asset Library保存

この一連の流れを毎日運用できることを Version1 完成条件とします。

なお、Instagram投稿は最後までユーザー承認後の手動投稿を維持してください。

### Version1 完成条件チェック（Phase52-2 記録・すべて完成済み）

Version1 = **完成**（現在Version v1.00-phase52-2 / Version1 Documentation Complete・Decision 041）。

- ☑ 市場分析（Instagram Marketing Intelligence / Phase50-1）
- ☑ コンテンツ企画（Instagram Content Planning / Phase50-2）
- ☑ カルーセル作成（Instagram Carousel Builder / Phase50-3）
- ☑ デザイン設計（Instagram Design System / Phase50-4）
- ☑ Mobile Review（Mobile Review Center / Phase50-5）
- ☑ Mobile Approval（Mobile Approval / Phase50-6）
- ☑ Publishing Ready（Publishing Ready Center / Phase50-7）
- ☑ 手動投稿（Publishing Readyの「投稿しました」手動ボタン・自動投稿なし）
- ☑ Instagram Learning（Instagram Learning Center / Phase51-1）
- ☑ Asset Library Save（Creative Asset Library Save Center / Phase52-1・表示のみ）

すべて完成済みとして記録する。次はVersion1の実運用（実際のInstagram投稿）を開始し、その後にVersion2（Asset Library実保存 / Learning永続化 / Instagram分析高度化 / TikTok / YouTube Shorts / LP連携 / AI自動改善）へ進む。

### ■ Version1 正式運用開始（Phase52-3記録）

運用開始日: **2026-07-04**

現在は

開発フェーズ
↓
Instagram実運用フェーズ

へ移行。

Version1は実運用しながら改善する（作って終わりではなく、投稿→実績手入力→Learning→Asset Library候補蓄積のループを実際に回す）。

---

## 【Version1 Final Complete】（Phase52-10記録・正式完成・Decision 044）

正式Version: **v1.00-phase52-10 / Version1 Final Complete**（最新コミット f177fd2）

Version1は「機能完成」だけではなく、**運用可能な完成版**として正式に完成した。以下をすべて完了として記録する。

- ☑ Instagram収益化パイプライン完成（Phase50-1〜52-1）
- ☑ Mobile UI完成（Phase52-5）
- ☑ Mobile Touch Hotfix完成（Phase52-6）
- ☑ Mobile Topbar完成（Phase52-8/52-9/52-9b）
- ☑ Render本番反映完了（ai-company-l45x.onrender.com = f177fd2）
- ☑ iPhone Safari実機確認完了（縦向き・横向きともTopbar 1本横スクロール・全ボタン操作可能・入力/送信可能・横はみ出しなし）
- ☑ PC表示正常（PC不変）
- ☑ Manual Only維持（Instagram API/自動投稿/画像生成/課金なし）

次工程は **Version1.01 Realtime Sync Edition**（PC/iPhoneで同一状態のAI会社）。Version2（Affiliate Intelligence）は Version1.01 完成後に開始する（Decision 045）。

## 【Version1.01 ビジョン】Realtime Sync Edition（Version2着手前に優先・Decision 045）

目的は **PC / iPhone どちらから利用しても同じAI会社になること**。すべてSupabaseを利用し、PCとスマホが同一状態になることを目的とする。

実装予定: Task同期 / Conversation同期 / Timeline同期 / Notification同期 / Workflow Live同期 / Cost同期 / Learning同期 / Approval同期 / Auto Task同期 / Status同期。

Version2（Affiliate Intelligence）着手前にRealtime同期を優先する。詳細は [docs/04ROADMAP.md](04ROADMAP.md)「Version1.01 Realtime Sync Edition」および Decision 045 を参照。

---

## 【Version2 ビジョン】Instagram Affiliate Intelligence Company（Decision 043）

Version2のテーマは **Instagram Affiliate Intelligence Company** ＝「Instagramで何を売れば利益が最大になるかをAI会社全体が判断できる会社」。
Affiliate Intelligence / ASP分析 / 案件分析で止まらず、AI会社全体が **利益を最大化する経営判断** まで行う。

Version2 Core = **Affiliate Intelligence Core**（7層Intelligence）:

```
Affiliate Intelligence Core
  → ① Market Opportunity Intelligence（今どの市場を狙うべきか）
  → ② Product Intelligence（何を売るべきか）
  → ③ ASP Intelligence（どのASPを使うべきか）
  → ④ Competition Intelligence（競合分析）
  → ⑤ Revenue Intelligence（利益・将来性分析）
  → ⑥ Content Intelligence（Instagramで勝てる投稿企画）
  → ⑦ Self Improvement Intelligence（実績から自動改善）
```

AI Gateway 正式構成: `Leader → Affiliate Intelligence → AI Gateway → { OpenAI / Claude / Browser Automation / PC Automation / 将来API }`。
AI Gatewayは「最も低コストで最適な実行方法を自動選択するレイヤー」。実行系（Browser/PC Automation/API）はユーザー承認 + 安全ゲートを維持する（Decision 028・030を継承）。

最終形: Leaderへ「今一番利益が出る案件は？」と聞くだけで、市場分析→案件分析→ASP分析→利益分析→競合分析→Instagram企画→Learning→改善まで一気通貫で判断できる会社。
到達目標16項目・実装配分・安全設計の詳細は [docs/04ROADMAP.md](04ROADMAP.md)「Version2 Core 全体設計」および [docs/04DECISIONS.md](04DECISIONS.md) Decision 043 を参照。実装はすべて追加のみ・既存無変更・Manual Only。

---

## 【Executive Constitution】AI COMPANY最高位ルール（Phase A-1g・2026-08-02・Decision 086で正式採用）

AI COMPANY全体の最高位ルールとして **Executive Constitution v1.0.0**（全14条）を正式採用した。既存Provider構成・絶対ルール・Workflow順序を含む本MASTERの各規定は、Executive Constitutionの範囲内で有効とする。

- Executive Constitutionは、Executive Decision Engine・Leader・Leader Integration Layer・Output Engine・Instagram Workflow・Learning Center・Self Improvement・Executive Memory・各Intelligence・将来追加されるすべてのEngine/Workflowに適用される。
- **変更統制**：Executive Constitutionの変更・追加・削除・緩和には、①ユーザーの明示的承認、②Version更新、③`docs/04DECISIONS.md`（暫定正本。将来はDecision Ledgerが正式正本）への記録、の3条件をすべて必須とする。Self Improvement・Executive Memory・Executive Decision Engineを含むいかなるEngineも、Constitutionを自ら変更・緩和してはならない（変更提案のみ可）。
- **Executive Decision Engine**は、AI社員・各Intelligenceの成果物を統合し会社としての採否・優先順位・リスクを判断する上位層として正式採用する。既存Leader Integration Layer（Phase A・`_leaderIntegration`）を土台として拡張し、新たな重複Engineとしては実装しない。
- **完成成果物と経営判断の併存**：既存Leader Final（Instagramスライド・Caption・CTA・ハッシュタグ・LP文章等の完成成果物）は今後も変更せず維持する。Executive Decision Engineが将来生成する経営判断サマリー（Executive Report）は、完成成果物を置き換えるものではなく、上位に併存する。

条文全文・Executive Decision Engineの詳細責務・保存方式・ロードマップは `docs/04DECISIONS.md` Decision 086 および `docs/04ROADMAP.md` を参照。**2026-08-03時点でExecutive Decision Engine Core（Phase B-1）・Path A/手動再生成因果接続（Phase B-2A／B-2B）・Executive Leader Report表示（Phase B-3）・Approved Decision Package契約化（Phase B-4）・Constitution Validator Core（Phase B-5・Decision089）・Constitution Structure Check表示（Phase B-5C・Decision090）が正式Complete。ただし通常運用ではdecisionStatusがapprovedへ到達しないためApproved Decision Packageは常にnullが正常状態であり、Executive Decision EngineがOutputを既に制御しているものではない（`affectsLeaderFinal`／`affectsOutputDraft`／`affectsOutputEngine`はいずれも常にfalse）。**Constitution Validator Coreは`validateExecutiveDecision(decision)`によるdecisionId／decisionStatus／Executive Summary／Decision Confidence／Approved Package生成条件／sourceDecisionId／Cross-case／単一判断主体等12項目の構造整合性検証（読み取り専用・判定のみ）であり、Executive Constitution全14条の完全な意味論的検証・Evidence内容の十分性判定・成果物品質/完成度の実質評価・Constitution違反によるOutput停止ではない**。検証結果は「Constitution Structure Check」としてExecutive Leader Report内の独立セクションに表示され、Auto Task・手動Leader再生成・Path B（dispatch成立時）の完了直後に即時反映される（表示のみ・Decision/Package/Output Draftへの書き込み・Output制御は一切行わない）。2026-08-04時点でConstitution Gate（Phase B-6・Decision091）・Quality Gate（Phase B-7・Decision092）・Quality Gate Executive Leader Report表示（Phase B-8・Decision093）も正式Complete。Quality Gate表示は`inbox.qualityGate`（`packageQuality`から`complete`／`almost_ready`のみ通過とする判定結果）をExecutive Leader Report内へ表示するのみで、Executive Decision・Output Draft保存・Constitution Gateのいずれも制御しない。2026-08-05時点でLeader統合回答・会社正式回答責務（Phase B-9B・Decision094）も正式採用済み。**AI社員（Writer/Researcher/Reviewer/Designer/Strategy等）の個別回答は社内検討資料であり、Leaderチャットへ表示される最終回答（Leader統合回答）こそがENBISOU AI COMPANYとしてユーザーへ提示する唯一の正式回答である**（既存のAI社員タブ・dispatchカード等の表示機能自体は削除しない）。LeaderはAI社員の意見収集・重複除去・矛盾解消・採用/保留/却下判断・情報充足の最終判断・最終成果物生成を担う最終統合責任者と位置づける。プロンプト・Leader統合ロジックの変更はPhase B-9C以降で改めて検討する（今回はdocs正式化のみ）。2026-08-06時点でLeader統合回答プロンプト改善（Phase B-9C）と、事実整理専用の共通Leader Rule Engine（`shared/leaderRuleEngine.js`）のPath A／Path B／手動Leader再生成3経路への正式接続（Phase B-9D〜B-9F・Decision095）も正式リリース済み。Rule Engineは入力正規化・実行状況カウント・情報不足スタブ検出・Leaderへ渡す短い判断材料の生成のみを行い、採用/保留/却下・重複/矛盾/Evidence判定はLeaderが最終判断する（Rule Engine自身は確定しない）。次工程はCompletion Gate調査・設計・意味的重複/矛盾検出の実装検討等の複数候補があり、いずれも未着手（着手はユーザー承認後）。

---

## 1. AI会社の最終目的（最重要）

ENBISOU AI COMPANY は「AIチャット」ではない。

**AI会社自身が収益を生みながら成長すること**が最終目的である（Decision 039）。「AI会社を作ること」自体がゴールではない。

そのための第一歩として、**完成した成果物を大量生産し、会社全体が学習し、品質が毎回向上していくAI会社**を作る。

回答を返すことではなく、そのまま使える完成品を納品する。

ENBISOU AI COMPANYは「回答するAI」ではなく、「完成成果物を納品するAI会社」である。

Version1の最優先目的は**Instagram収益化支援**である。AI会社はInstagram運用を最初の実運用対象とする（詳細は docs/04ROADMAP.md「Version1 最優先ゴール」参照）。画像生成・動画生成・実際の投稿はManual Only（ユーザー承認後の手動実行のみ）を維持する。

例：
- Instagram：スライド10枚・画像プロンプト・キャプション・CTA・ハッシュタグまで
- TikTok：企画・台本・画像プロンプト・動画プロンプト・投稿文まで
- チラシ：コピー・デザイン指示・画像プロンプト・PDF構成まで
- LP：構成・コピー・画像プロンプト・HTML・CTAまで

## 2. 絶対ルール

- 既存機能は壊さない
- 削除禁止
- 追加のみ
- AI会社は汎用設計（塗装専用禁止）
- Supabase永続化を維持
- 学習データ削除禁止
- 勝手な課金・API契約禁止
- 画像生成・動画生成・SNS投稿はユーザー承認後のみ
- Git管理を徹底
- dev-check 200/200/200成功後のみ完了扱い
- git push禁止（ユーザー確認必須）

## 3. Workflow

User
→ Leader
→ Company Brain
→ Knowledge（Injected Knowledge + Leader Execution Guide 注入）
→ Workflow生成
→ AI社員（Writer / Reviewer / Strategy）
→ Reviewer
→ Strategy
→ Leader Final
→ 完成成果物納品

## 4. 成果物品質

- 回答では終わらない
- 完成品まで作る
- 他担当へ積極的に相談
- Leaderは統合・品質向上・最終責任を持つ
- Knowledge注入で成果物品質を毎回改善する

## 5. 優先順位（Phase47以降）

### Priority 0: APIコスト最適化（緊急）
- Claude Writer / Reviewer / Strategy → 最安モデルへ切替（コスト削減優先）
- Strategy → 最高品質モデルへ切替（品質担保）
- Leader は OpenAI 固定（変更禁止）
- コストと品質のバランスを毎Phase確認する

### Priority 1: 成果物品質向上（最優先）
- Instagram / TikTok / X / ブログ / LP / チラシ / PDF / 動画台本

### Priority 2: AI会社の学習能力向上
- Learning / Memory / Knowledge / Leader Intelligence / Reviewer Quality / Company Brain

### Priority 3: SNS自動投稿は後回し
- 現時点では自動投稿は実装しない
- まずは手動投稿前提で、投稿直前までの成果物品質を高める
- 画像・動画・投稿文・ハッシュタグ・CTA・構成・プロンプトを高品質化する

### Priority 4: 画像生成・動画生成は承認制
- 画像生成プロンプト作成は自動OK
- 実際の画像生成はユーザー承認後
- 動画生成もユーザー承認後
- 外部API・有料サービス・SNS投稿連携は必ずユーザー承認制

## 5.1 現在の最優先（Phase49-6完了時点 / Version1最優先目的をInstagram収益化支援へ変更・Decision 039）

Version2はCreative Engine / Intelligence / Sales / Automation / Business Intelligence / Company Brain v2 の6ファミリーへ再編済み（Decision 027）。Creative Engineファミリー（Phase49-1〜49-6）は完結済み。Creative Engine完了後はCompany Brainより先にInstagram Marketing Intelligenceを優先する（Decision 039）。詳細は [docs/04ROADMAP.md](04ROADMAP.md) を参照。

### Priority 0: Instagram Marketing Intelligence（Phase50-1・最優先へ格上げ）
- 保存率分析・リーチ分析・プロフィール遷移分析・フォロー率分析・CTA分析・ハッシュタグ分析・投稿時間分析・カルーセル分析・リール分析・競合分析・トレンド分析
- Instagram実運用を開始し、Learningを蓄積しながらVersion1（Instagramを毎日運用できること）を完成させる
- 汎用マーケティング/SEO分析（旧Phase50-1）はInstagram完成後に拡張する（Phase50-3へ後回し）

### Priority 1: AB Test & Buzz Analysis（Phase50-2）
- LP分析・広告分析・ABテスト提案・バズ要因分析。Instagram運用データを主対象とする

### Priority 2: Automation Engine
- Publishing Engine出力を利用した投稿・予約投稿の自動化（Phase52、ユーザー承認後のみ）

### Priority 3: Company Brain v2
- Instagram Marketing Intelligenceの後に着手する（Phase54、Decision 039）

完成済み（Creative Engineファミリー）:
- AI Gateway Foundation（Phase49-1）/ Image・Video Prompt Intelligence（Phase49-2・49-3）/ Creative Execution（Phase49-4）/ Creative Ad Assembly（Phase49-5）/ Creative Asset Library（Phase49-6）— いずれも判断層・プロンプト生成層・実行計画層・組み立て層・管理層のみ。画像生成・動画生成・SNS投稿はユーザー承認後のみ

詳細ロードマップは [docs/04ROADMAP.md](04ROADMAP.md) を参照。

## 6. 現状（Phase49-6完了 / Creative Engineファミリー完結・Version1最優先目的をInstagram収益化支援へ変更）

完成：
- Company Brain
- Knowledge Engine
- Workflow Live（完成版 v0.97）
- Auto Task / Leader Final
- Claude/OpenAI役割分担（Writer/Reviewer/Strategy=Claude / Leader=OpenAI）
- Output Engine（Phase44）
  - 13種の成果物タイプ / 自動判定 / 担当割当 / Packageビュー / Export
- Learning Engine（Phase45-2）
- Company Memory（Phase45-3）
- Knowledge Candidates + 承認UI（Phase45-4〜5）
- Knowledge Save + 重複防止（Phase45-6C〜6D）
- Knowledge Inject + Leader Execution Guide（Phase45-7 / Phase46-2）
- Knowledge Compare Mode（Phase46-3）
  - with_knowledge / without_knowledge / guide_only
  - 品質比較のための3モード切替
- Compare Log（Phase46-4）
  - _knowledgeCompareLog[]（max30件）
  - モード別平均スコア / 棒グラフ表示 / Export反映
- Compare Intelligence v1（Phase46-5）
  - analyzeCompareIntelligence() — mode別集計 / InjectionImpact / recommendations
  - buildCompareIntelligenceHtml() — Output Engine に分析パネル表示
  - Export（markdown / json）に自動反映

- Compare Recommendation Engine v1（Phase46-6）
  - buildCompareRecommendations() — priorityItems / knowledgeRecommendations / reviewerHints / learningHints
  - buildCompareRecommendationHtml() — Output Engine に改善提案パネル
  - Export（markdown / json）に自動反映

- Compare Quality Integration Check v1（Phase46-7）
  - buildCompareIntegrationCheck() — Log/Intelligence/Recommendation 統合チェック
  - getCompareIntegrationStatus() — ready/partial/insufficient 判定
  - buildCompareIntegrationCheckHtml() — Output Engine に Integration Check パネル
  - Export（markdown / json）に自動反映

- API料金メーター（Phase47-1）
  - OpenAI Cost Tracker（costTracker.js）: 日次/月次/累計 + モデル別 + 日付リセット
  - Claude Cost Tracker（claudeCostTracker.js）: 日次/月次/累計 + モデル別 + 永続保存
  - Provider別表示: OpenAI / Claude それぞれ今日・今月・累計
  - 合計表示: 右上ヘッダー料金ボタン = OpenAI + Claude 合計
  - 永続保存: cost-logs.json / claude-cost-logs.json
  - 新エンドポイント: /api/claude-cost / /api/claude-status

- Claude Cost Analysis（Phase47-2A） — モデル別料金・トークン集計 / 担当別集計
- Claude Model Policy（Phase47-2B） — Writer/Reviewer=最安モデル(claude-haiku-4-5) / Strategy=最高品質モデル(claude-opus-4-8)へ正式最適化
- Claude Model Quality Compare（Phase47-2C） — 最適化前後の品質比較パネル
- Claude Model Formal Adoption（Phase47-2D） — モデルポリシー正式採用の記録
- Claude Quality Monitor（Phase47-3） — Compare Intelligenceと連携した品質監視エンジン
- Claude Quality History（Phase47-4 / 永続化はPhase47-5） — 時系列品質監視・JSON永続保存
- Output Package Quality（Phase48-1） — 成果物ごとの完成度チェックリスト（0〜100点）
- Output Template Enhancement（Phase48-2） — 全11成果物タイプへテンプレートフィールド拡張
- Output Auto Fill Engine（Phase48-3） — Leader Final・Writer/Strategy/Designer回答からフィールド自動反映
- Output Quality Score（100点対応） — Instagram/TikTok/Flyer/LP/PDF/HTML/Image Prompt/Video Promptの8タイプで100点到達可能なことを実証済み
- Output Preview Engine（Phase48-4） — Instagram/LP/チラシ/PDF/HTML/TikTok/YouTube Shortsを完成イメージ（モックアップ・HTMLはiframe実描画）で画面表示。Package Qualityスコアをバッジ連動表示
- Publishing Engine（Phase48-5） — 10タイプ（Instagram/TikTok/YouTube Shorts/チラシ/LP/HTML/PDF/画像プロンプト/動画プロンプト/汎用文書）でタイトル・説明文・ハッシュタグ・投稿時間・画像/動画一覧・CTA・公開前チェックリストを自動生成。Copy 5ボタン・Markdown/JSON Export反映済み

- Version2設計レビュー（Phase49-0） — Roadmap責務分離・AI Gateway/Asset Library追加案・Creative Engine再構成案・Company Brain v2分割案をレビュー（コード変更なし）
- Version2 Roadmap Formalization（Phase49-0.1） — 上記レビュー内容をdocsへ正式反映（コード変更なし）

次工程（Priority 0）：
- Instagram Marketing Intelligence（Phase50-1） — 保存率/リーチ/プロフィール遷移/フォロー率/CTA/ハッシュタグ/投稿時間/カルーセル/リール/競合/トレンド分析。Instagram実運用を開始しVersion1（Instagramを毎日運用できること）を完成させる（Decision 039）

## 7. v1.0完成像

- AI会社全体が自律協業
- 成果物品質を Knowledge → Learning → Memory → 次回Workflow で継続改善
- 画像・動画・PDF・HTMLまで含めた納品
- 学習結果を次回へ確実に反映
- 品質スコアが毎回向上していく仕組み
