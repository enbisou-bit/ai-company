# ENBISOU AI COMPANY Roadmap

> 作成日: 2026-07-02（Phase48-3.1） / 更新日: 2026-07-04（Version1 Roadmap方針変更・Instagram収益化支援優先化・Decision 039）
> 現在Version: v1.00-phase49-6 Complete（Creative Engineファミリー完結）
> Version2は責務分離型（Creative Engine / Intelligence / Sales / Automation / Business Intelligence / Company Brain v2 の6ファミリー）へ正式再構成（Decision 027〜029参照）
> Version1の最優先目的をInstagram収益化支援へ変更（Decision 039）。詳細は下記「Version1 最優先ゴール」参照
> **Version1 完成（Phase52-2記録・Decision 041）**: Instagram収益化パイプラインが全工程実装完了。現在Version v1.00-phase52-2 / Version1 Documentation Complete。

---

## ASP Product Fact Record（APFR）─ Step A Core／Step B Manual Input UI（正式リリース・2026-08-21）／プラファスト本番実運用検証Complete（2026-08-22）／Phase 0 再Adopt時Fact消失防止＋Phase 1 Current Fact Resolver＋CUI-0 Correction-aware Duplicate Policy（2026-08-22）／CUI-1 Current Fact / History UI＋CUI-2 Correction UI Core（2026-08-23・Decision 108）／Step C-2-1 Formal Truth Numeric Consistency Check 正式リリースComplete（2026-08-25・Decision 108・Tag `v1.01-apfr-formal-truth-numeric-consistency`）／Leader Case Context Phase2 + Option B（Formal Truth / Intelligence Case Data Context Wiring）Code Implementation Complete（2026-08-25・Decision 108・Code commit `95eaa899`）

> 追記日: 2026-08-31（**Leader Final 実行モデルを gpt-4.1-nano → gpt-5.4-mini へ変更（Blocking Fix・docs-only Stage-1・Decision108追記）**。Instagram第1投稿の実AI Path A（前工程調査・workflow `wf-1788103235478`／case `case-msr9yckye65y`）で、**Reviewerの否認・`LEADER_FINAL_REVIEWER_REJECT_RULE`・formalTruthRule（正本参照義務）・IADP Scope Boundary（IADP値を商品事実へ意味変換しない）がいずれもLeader Final promptへ正しく供給されていた**にもかかわらず、旧 `gpt-4.1-nano` のLeader Finalがそれらを遵守せず、CASE CONTEXTに存在しない商品事実（植物由来・肌に優しい・安全性・口コミ・継続効果・キャンペーン等）を最終成果物へ再生成した。出力が `LEADER_FINAL_PROMPT` のテンプレート見出しを逐語コピーし末尾が「※※※」の反復で崩壊していたことから、**供給経路の欠落ではなくLeader Final実行モデルの能力不足が直接原因**と判定した。**修正方針**：既存Contract・Prompt構造（`LEADER_FINAL_PROMPT`・question組み立て・Reviewer/Strategy供給・reject遵守Contract・Grounding Block）を1文字も変更せず、**通常Leader Finalの実行モデルだけを最小変更で引き上げる**。**Code commit ①`41634f3e67311bf04c3c0ad6c39ebb7a6c6c05b6`（`fix: run leader final on dedicated gpt-5.4-mini model`）**：`openaiClient.js` へ専用定数 `LEADER_FINAL_MODEL='gpt-5.4-mini'` を新設（`EEA_WEB_SEARCH_MODEL` と同じ「別経路は別定数」方式）。`callOpenAI()` に任意の `options.model`（未指定時は従来どおり `OPENAI_MODEL`）を追加し、**通常Leader Final（`_iadpMode=false`）のときだけ** `LEADER_FINAL_MODEL` を指定する。新規 `leaderFinalModel.test.js`（50/50）。**グローバル `OPENAI_MODEL='gpt-4.1-nano'` は無変更**。各AI社員・Company Brain・`leaderSummary`・`strategyConsolidate` 等の既存OpenAI呼び出しは全て従来モデルのまま。**Provider は OpenAI のまま（変更なし）**。**IADP用Leader Final（`structuredOutput`／8192 tokens）は今回の対象外**（別責務・別検証のため従来モデル）。Reviewer=Claude／Strategy=Claude も無変更。**Code commit ②`6b9b2caf013c17cb5cf76d28407a173cb71aee8d`（`fix: register gpt-5.4-mini pricing in cost tracker`）**：`costTracker.js` の `MODEL_PRICES` へ `gpt-5.4-mini` を登録——input `$0.75 / 1M tokens`、cached input `$0.075 / 1M tokens`、output `$4.50 / 1M tokens`（本表の既存形式＝USD/100万トークンと同一・換算不要）。**料金計算構造（`calculateOpenAICost()`・cached按分・USD→JPY）は一切変更していない**（`gpt-5.6-terra` と同じ按分ロジックがそのまま機能）。新規 `costTrackerGpt54Mini.test.js`（8/8・純関数のみ・`cost-logs.json` 非書き込み）。**実AI Path A E2E 実績（1回・正式記録）**：gpt-5.4-mini 変更後、実AI Path A E2Eを **1回** 実施し、**未確認商品事実0件を実測**。workflowId `wf-1788126291305`／caseId `case-msr9yckye65y`／Leader Final `modelUsed = gpt-5.4-mini`（実測）／Reviewer `claude-haiku-4-5`／Strategy `claude-opus-4-8`／他OpenAI担当モデル変更なし。**未確認商品事実0件**（31語の機械走査・画像生成プロンプトも対象）。キャプション冒頭 `【広告】` あり・`#PR` あり。**Reviewer否認 → Strategy分類A（Formal Truthで解消／該当表現削除の方針明示）→ Leader Final遵守**。テンプレート逐語コピー症状消滅・「※※※」生成崩壊症状消滅。**この結果は1回の実測結果として記録する**——Blocking解消Complete／Grounding Complete／Fully Compliant／deterministic guarantee／永続的に再発しない／完全解決 とは**記録しない**。**Cost 再計算**：前回E2E Leader Final の実測token（`api_cost_events` から取得・input `7,969`／output `1,745`）を新料金表で再計算 → **USD `$0.013829` / JPY `¥2.21`**。ただし cached token は `api_cost_events` に保持されないため、**¥2.21 は全inputを通常input単価で計算した上限側の値**として記録する。**`cost-logs.json` は runtime累積ファイルであり正式化対象外**（deterministic test 実行時に既存テスト基盤の `resetCostTracker()` が上書きしたが、durable正本は Supabase `api_cost_events`・無傷。編集・restore・stage・commit いずれもしない）。**テスト記録**：`leaderFinalModel.test.js` 50/50・`costTrackerGpt54Mini.test.js` 8/8・`costTracker.eea8.test.js` 19/19・P1／Reviewer／APFR／IADP関連回帰は新規FAIL 0。**`leaderFinalGrounding.test.js` は 52/53**——現在のFAILは `20-2a`（commit後は `openaiClient.js` がHEAD差分から消えるため、Option F由来のdiff-state static guardが構造上PASSしない既知制約。handover記録済み）。**`53/53 PASS` とは書かない**・機能的な新規回帰とは扱わない。**P2（別系統・今回スコープ外・未修正）**：slides 10→1／imagePrompts取込失敗／targetAudience・benefitの断片化／packageQuality表示乖離。これは Output Draft parser 側の別系統であり、今回のLeader Finalモデル変更とは混同しない。このP2を理由に今回のCode変更をFAIL扱いしない。docs Stage-1中にP2を実装しない。**Decision**：新規Decision番号は作成せず Decision 108 へ追記（P1・C-3-1・Compliance Restrictions と同じ扱い）。**Version1 Final Complete／Version1.1 Connected AI Company 開発中・Phase54 Complete 維持・Phase55 未着手（変更なし・今回のBlocking FixでPhase55を開始しない）**。**今回はdocs-only Stage-1**：Code変更は上記2commitで完了済み・test変更0（新規追加のみ）・DB write 0・AI API追加実行0・Render操作0。**Stage-1時点のGit**：Code commit ①`41634f3e67311bf04c3c0ad6c39ebb7a6c6c05b6` ②`6b9b2caf013c17cb5cf76d28407a173cb71aee8d`・**origin/main = `306d8a513ec19a06223f1b7e03c29db8d1bb40b8`（未push）・local ahead 2 / behind 0・push未実施・Annotated Tag未作成・Render未反映**。**「正式リリース完了」とはまだ書かない**。次工程：docs commit → push → Annotated Tag `v1.01-leader-final-model-blocking-fix` → Render Auto-Deploy → 本番確認 → docs Stage-2同期）

> 追記日: 2026-08-29（**Instagram実運用 P1〜Issue A/B 修正 4commit ─ 実AI Path A E2E PASS・docs正式化 Stage-1 → 正式リリースComplete（Decision108追記・stage-2 docs同期 2026-08-30）**。Instagram実運用1周目で確定したP1 Blocking Issue、およびその過程で判明したIssue A／Issue Bについて、**Code実装4commitがlocalhost実AI Path A E2Eで検証完了**した。**Instagram実運用 P1〜Issue A/B 修正は正式リリースComplete（stage-2 docs同期・2026-08-30）**。**【stage-2 docs同期・正式リリース実績】**Code修正4commit（`ba4d82e`／`c35b534`／`d8a09f1`／`08d15e3`）＋docs commit `e935056`（`docs: record instagram p1 and issue ab fixes`）を **main push済**（HEAD＝origin/main＝`e935056ab48049aeb60fa9b39e340c6168b40b69`・ahead/behind 0/0）。**Annotated Tag `v1.01-instagram-p1-issue-ab-release`**（tag object `6d957a8d097c3cd1f43e5875594ae27b812aa768`・peeled commit `e935056ab48049aeb60fa9b39e340c6168b40b69`）**local／remote反映済**（Tag再作成なし）。**Render Service `ai-company`（branch `main`・Trigger Auto-Deploy）Deploy `e935056`・Status Live**（2026-08-30 07:40:12 GMT+9・Duration 22.1s・Manual Deploy／再deployなし）。**本番AI COMPANYの認証後UIをユーザーが実画面で正常表示確認済**（対象case `case-msr9yckye65y`／Package `iadp_1787060839814_izhakb`／最新確認Draft `out_1787999232715`・caseId binding正常・Cross-case混線なし・致命的UI崩壊なし・Render本番read-only API取得も正常）。**P1〜Issue A/B 正式リリースComplete**。本stage-2同期はdocsのみ変更（Code変更0・test変更0・DB write 0・AI API実行0・Render再deploy 0・Tag再作成0）。**正式対象Code commit（4件・push済・正式リリース済）**：①`ba4d82e96668322bb57342927c692a0af6e9d76d`（`fix: restore instagram publishing safety gates`）＝**P1-1 Output Draft caseId Binding**＋**P1-2 Reviewer/Strategy → Leader Final stage-1**（reviewerText/strategyTextの600→1200文字化・`LEADER_FINAL_REVIEWER_REJECT_RULE`追加）。新規`p1BlockingFix.test.js`。②`c35b534d4d4165b541ed0d8a186f3a41567aa443`（`fix: scope listing ng words to listing ads only`）＝**listingNgWords Channel Scope Fix**。新規`apfrListingScope.test.js`。③`d8a09f1c39c0a9e3a2c598769e5aac15689cbfd3`（`fix: mark iadp values as account design not product facts`）＝**IADP Scope Boundary（Option E＋B）**。新規`iadpScopeBoundary.test.js`。④`08d15e3080d2e50113640671927dbc16ca9c29c8`（`fix: supply main task reviewer review to leader final`）＝**Issue A Option D**。新規`mainReviewerSupply.test.js`。**①P1-1 Output Draft caseId Binding**：`createOutputDraft()`がcaseIdを持たないDraftを返すため、生成直後Draftでは`_apfrCurrentAdoptedProduct()`の三重guard（caseId一致）が必ず失敗し、complianceContextが`{}`となってCompliance CheckがNOT CHECKEDへ、さらに`_apfrEvaluateMobileApprovalCompliance()`もnot_checked→fail-open→`blocked:false`となり**C-1C-2b-1 Mobile Approval Enforcementが生成直後Draftに対して発火しなかった**（復元経路`_outputDraftFromServerRow()`は`row.case_id`を設定済みのためF5後のみ正常という不一致）。`atRunWorkflow()`の既存carry-forwardブロック先頭でWorkflow開始時に捕捉済みの`_atRunCaseId`をbindingする1行のみ追加（`createOutputDraft()`本体は無変更＝他呼び出し経路へ副作用0）。**実AI E2E実測**：新規Draft`caseId=case-msr9yckye65y`・`restored:false`・Cross-case混線なし・Compliance Context 4field取得・Mobile Approval Enforcement `evaluated:true`。**②listingNgWords Channel Scope Fix**：A8.net公式定義上`listingNgWords`は「リスティング広告（検索連動型広告）で入札・出稿を禁止する検索キーワード」であり、**Instagram organic投稿本文の禁止語ではない**。実案件の実値`["商品名","法人名"]`をInstagram本文へsubstring適用していたため、①本文中の「商品名」という語自体がviolationとなりMobile Approvalが誤blockされ、②Leader Finalが「商品名はNGワード」と誤解しFormal Truthの`productName`（プラファスト）をIADPアカウント名（ナチュラルエッセンス）へ置換する二次被害が発生していた。**正式仕様**：**Formal Truth（APFR Fact）は`["商品名","法人名"]`のまま保持し書き換えない**（Correction・schema変更いずれも0。将来リスティング広告機能で使用）。Instagram organic出力タイプのときだけ**Compliance evaluation inputから当該fieldのみを除外**し、既存Contractどおり`not_checked`となる（detector本体`evaluateComplianceGate()`／`_apfrEvaluateDisclosureMarkers()`／`_apfrEvaluateComplianceAssessment()`／`_apfrBuildComplianceContext()`はいずれも無変更）。`not_checked`はAssessmentの`unchecked`へ明示され握りつぶさない。他チャネル（lp／flyer等）は従来どおり評価する。**実AI E2E実測**：violation 0件・Mobile Approval誤block 0件・`unchecked:["listing_ng_words"]`。**③IADP Scope Boundary（Option E＋B）**：`fields.iadp.package.finalProfile`の`brand.brandConcept`・`account.bio`等がserver側`_leaderCaseContextToText()`により【CASE CONTEXT｜…（Formal Truth）】ヘッダ下へフラット列挙されていたため、AI社員が「自然由来」（アカウントのブランドコンセプト）を対象商品の成分・特性の事実として転用するClass C（意味誤用）が発生していた。値はCASE CONTEXTに実在するため既存`formalTruthRule`の「記載のない情報を断定しない」では防げなかった。**正式仕様**：IADPの`accountName`／`username`／`bio`／`brandConcept`／`target`／採用ジャンル等は**媒体アカウント側の設計・方針**であり、対象商品の**成分・効能・効果・適性・品質・安全性・実施中キャンペーン・特典の商品事実ではない**。**Option E**＝`server.js _leaderCaseContextToText()`へ用途境界の見出し（`■ アカウント設計（IADP｜運用する媒体アカウント側の設計・方針です。対象商品の…商品事実ではありません）`）を追加（値・順序・件数は不変・増えたのは見出し1行のみ・IADP値0件時は見出しを出さない）。**Option B**＝`openaiClient.js _buildFormalTruthRuleText()`の【絶対禁止】へ意味変換禁止を1項追加（**単一ソースのためSNS／Writer／Reviewer／Strategy＋Leader Finalの全Agentへ同時適用**・Agentごとの重複追加なし）。**過剰禁止を避けるため、アカウント自体の説明・世界観・投稿トーンとしての利用は明示的に許可**（例「自然由来の美容と健康情報を発信するアカウントです」は適切）。**実AI E2E実測**：「自然由来」の商品成分・特性への転用**0件**（出現はアカウント説明のみ）、IADP targetの商品適性転用**0件**、未確認キャンペーン・特典・お試し・割引**0件**。**④Issue A Option D（main-task Reviewer → Leader Final供給）**：Path AではReviewerが**2系統**存在する——(a)Auto Task担当行として実行される**main-task Reviewer**（例`at-task-3`）と、(b)後処理で自動生成される**post-process Reviewer**（`at-postprocess-reviewer`）。main-taskは`workflowTasks.map()`生成物で`isPostProcess`プロパティを持たない（undefined）ため既存の`find(t => t.agentId===[reviewer] && t.isPostProcess)`にマッチせず、`reviewerText`は常に(b)だけを指していた。結果、停止・確認要求を出した(a)の本文は`memberReplies`内に他担当と横並びで埋もれ「AI社員の社内検討内容（正式回答ではない）」扱いとなり、`LEADER_FINAL_REVIEWER_REJECT_RULE`の対象外だった。**修正**：新変数`mainReviewerTask`（`reviewer`／`!isPostProcess`／`completed`／`result`有）を追加し、Leader Final questionへ**専用ラベル`【Reviewer（品質レビュー担当）の作業中レビュー】`**で追加供給（通常分岐・IADP分岐の両方）。上限は既存`LEADER_FINAL_POSTPROCESS_TEXT_MAX=1200`を再利用。reject遵守Contractの発火条件を`(reviewerText || mainReviewerText)`へ拡張（緩和ではなく拡張）。**既存の`reviewerTask`／`strategyTask`取得行は1文字も変更せず**、post-process Reviewerと統合・置換もしない（両方をLeader Finalへ渡す）。`memberReplies`の構造・内容・件数も無変更。**Issue A 実AI E2E結果＝PASS**：Reviewerが「CASE CONTEXTに存在しない商品固有情報（成分・処方・特徴）について確認が必要」と要求→Strategyが「CASE CONTEXTに存在しない情報であり、正本ルールに従い『使わずに成立する投稿』として作成済み。事実未確認の成分・効能・特典は一切含めていません」と解決→Leader Finalが**「商品の成分・効能・効果については記載せず、Formal Truthに基づく事実のみを掲載しています」と明示**し、実際に未確認事実を使用せず完成稿を生成。「Reviewer確認済み」「Compliance Check完了」等の**虚偽断定は0件**（むしろ「Reviewer・Strategy・Compliance担当へ詳細確認と最終承認を進めます」と未完了扱い）。**永久block 0**・Strategy override正常動作。**deterministic block／停止語のsubstring・regex判定／新Enforcementはいずれも追加していない**——Reviewer停止を無条件blockにすると、商品成分等がFormal Truthに構造上存在しない案件（APFRはASPプログラム事実のみを保持）が永久blockになるため。`shared/leaderRuleEngine.js`の`reviewerSignal: null`は偽陽性回避の既存設計判断を尊重し**維持**（Rule Engineはbyte一致で無変更）。`buildStrategyConsolidatePrompt()`のStrategy override権限（caseContextRule）も**維持**。**Not Required維持**：**APFR Compliance Restrictions deterministic化＝Not Required**（判定C）・**APFR Step C-3-1 Grounding Detection＝Not Required**（判定D）をいずれも維持し、新detectorは追加していない。**Class B残件（P3既知事項・正式リリースを止めない）**：最新E2E残存は`#美肌`・`#敏感肌`・`#保湿`の**ハッシュタグ3件のみ**で、**本文中の未確認商品事実は0件**。read-only調査の結論：(a)`#敏感肌`はH3（商品適性示唆）で医薬部外品案件では要注意だが、(b)`#美肌`はH2（悩み・関心タグ）、`#保湿`はH4境界だが投稿テーマとも読め、(c)**deterministic denylistは偽陽性・商品ごとの差・保守コストの観点から採用しない**（`listingNgWords`以外を機械Gate化しないC-1C-1判断および`leaderRuleEngine.js`「既存NGキーワード判定は使用しない（偽陽性回避）」方針と整合）、(d)根本原因の一因は**`LEADER_FINAL_PROMPT`の「ハッシュタグ20個程度」という量指示**（Formal Truthから根拠を持てるタグは`productName`／`productCategory`／`regulatoryCategory`／IADP`accountName`＋広告開示で最大6個程度であり、残りを一般美容タグで埋める生成圧力になる）。**将来必要ならPrompt Rule追加＋量指示緩和をP3として検討する**（今回実装しない）。**第1投稿運用方針**：Class BハッシュタグはMobile Approval時に人間が目視確認し不要・不適切なタグを削除できるため、第1投稿を止めない。**productName**：最新E2Eで`プラファスト`が**4件正常使用**され、`ナチュラルエッセンス`はアカウント名としてのみ使用（商品名への誤使用0件）。前回E2Eで観測された商品名の過剰回避（0件）は**再発なし**。追加修正不要。**テスト**：新規4スイート（`p1BlockingFix` 60/60・`apfrListingScope` 74/74・`iadpScopeBoundary` 84/84・`mainReviewerSupply` 72/72）すべてPASS。既存回帰も新規FAIL0（`apfrComplianceGate` 42/42・`apfrComplianceAssessment` 84/84・`apfrDisclosureDetection` 66/66・`apfrApprovalEnforcement` 76/76・`apfrComplianceUiScope` 60/60・`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62・`apfrCaseDataContext` 80/80・`iadpQualityContractRouting` 86/86 ほか）。**`leaderFinalGrounding.test.js`は52/53**（FAIL`20-2a`のみ＝Option F正式commit後に`openaiClient.js`のHEAD差分が0となるため構造上PASS不可の既知diff-state static guard制約。**53/53 PASSとは記録しない**）。released testの追随修正は`apfrComplianceInjection.test.js`（listingNgWordsのpromptラベル変更に伴う期待文字列3行）と`p1BlockingFix.test.js`（reject遵守Contract発火条件の拡張に伴うE-7・検証を弱めずE-7bを新規追加）の2件のみで、**test削除・skip・条件緩和は一切行っていない**。`server.test.js`は実行していない。**実AI費用**：Path A E2E計3回（listingNgWords検証・IADP Scope Boundary検証・Issue A検証）で約¥2.31（Leader chat各1回＋workflow各1回）。**過大表現の禁止**：以下は**記録しない**——Compliance Enforcement完全完成／Fully Compliant／Grounding Enforcement Complete／全ての広告表現が法的に保証済み／自動公開安全性100%保証。今回正式化するのは**P1修正・listingNgWords Channel Scope・IADP Scope Boundary・Issue A Option Dの各実AI E2E PASSとMobile Approval Enforcement正常動作まで**である。**Decision**：新規Decision番号は作成せず、P1-1／listingNgWords／IADP Scope Boundary／Class B調査はDecision108へ、Issue A（Reviewer→Leader Final供給・Approval Contractに接続しない情報供給のみ）もDecision108へ追記する（**Decision109（Mobile Approval Compliance Enforcement Contract）は変更なし**——本工程はEnforcementを追加せず、Mobile Approvalの`canApprove`条件も無変更のため）。**Version1 Final Complete／Version1.1 Connected AI Company開発中・Phase54 Complete維持・Phase55未着手（変更なし）**。**stage-2 docs同期時点**：docsのみ変更（Code変更0・test変更0・DB write 0・AI API実行0・Render再deploy 0・Tag再作成0）。push／Tag／Render Auto-Deployは正式リリースで実施済み・本同期での再実行なし。**現在地フロー**：C-1C-2a-1正式リリース → C-3-1 Not Required → Compliance Restrictions Not Required → 実運用1周目でP1発見 → P1修正 → listingNgWords Channel Scope → IADP Scope Boundary → Issue A Option D → **本docs正式化 Stage-1** → main push（HEAD＝origin/main＝`e935056`）→ Annotated Tag `v1.01-instagram-p1-issue-ab-release`（local／remote反映）→ Render Auto-Deploy（`e935056`・Live・2026-08-30 07:40 GMT+9）→ 本番UI確認（ユーザー実画面・`case-msr9yckye65y`）→ **P1〜Issue A/B 正式リリースComplete** → **stage-2 docs同期（本更新）** → 現在ここ。——以前の更新記録（履歴として保存）：**APFR Compliance Restrictions deterministic化 ─ Not Required 正式化（Decision108追記・docs-only stage-1）**。前工程のread-only調査（Opus・C-1系列 read-only）により、`complianceRestrictions` をdeterministic Compliance Detectorへ直接利用する設計は不適切と確定したため、**APFR Compliance Restrictions deterministic化＝Not Required（Detectorを新設しない）として正式化**した（**判定C**：deterministic対象は `listingNgWords` へ責務分離する）。**実測根拠（実案件プラファストの `complianceRestrictions` 実値）**：`A8.netのルール遵守`／`広告表示必須`／`法律関連の禁止事項遵守`／`リスティング違反禁止` の**4値すべてが単純禁止語ではなく directive／obligation／自然言語制約**であり、Type A（単一禁止語）・Type B（禁止フレーズ）の実データは0件。**substring実測（既存 `evaluateComplianceGate()` と同一の NFKC→lowercase→trim→substring 方式を仮適用）**：①残存表現（`#敏感肌`／「自然由来」／「肌に優しい」）の検出＝**0件（false negative 100%）**／②正しいCompliance遵守表明「A8.netのルール遵守のうえ作成」＝`violation` 誤検出／③正しい広告開示「広告表示必須の規定に従い【広告】と明記」＝`violation` 誤検出／④`広告表示必須` は禁止表現ではなく **positive obligation** であり「存在したら違反」となる substring detector では**意味が逆転**する。この時点で直接Detector化は不採用。**Source of Truth 責務分離（正式維持）**：**`listingNgWords`＝deterministic禁止語のSource of Truth**（閉じた語彙・既存 `evaluateComplianceGate()`）／**`advertisingDisclosureRequirements`＝開示義務trigger**（自然文値そのものを substring 検索せず、Formal Truth値の存在をtriggerに別途定義した閉じたmarker集合〔【広告】／【PR】／#広告／#PR／#プロモーション／定型文〕を検査する C-1C-1b whitelist marker detector）／**`complianceRestrictions`＝自然言語Compliance制約のSource of Truth**（既存 C-1B prompt injection で Writer／Reviewer へ伝達・semantic判断は AI／Reviewer の責務）／**`regulatoryCategory`＝参考情報**（カテゴリ名から追加の法令・規制を推測しない）。**C-1C-1 既存判断は変更しない**：「deterministic対象は `listingNgWords` のみ／`complianceRestrictions`・`regulatoryCategory`・`listingPolicy` は自然言語・意味的判断を要するため機械Gate化しない」という正式判断は、今回の実データ調査でも正しかったと確認された。**`advertisingDisclosureRequirements` が C-1C-1b で deterministic 化済みなのは自然文値そのものの substring 検索ではなく別 whitelist 方式のため、同じ成功パターンを `complianceRestrictions` へそのまま適用できない**。**残存3表現（`#敏感肌`／「自然由来」／「肌に優しい」）は現在の Formal Truth だけでは deterministic に NG 判定不能**（`listingNgWords` 一致なし・`complianceRestrictions` 一致なし・`regulatoryCategory` から法令知識を推測することは禁止・semantic判断が必要）。**C-3-1 Grounding Detection＝Not Required と今回の Compliance Restrictions deterministic化＝Not Required により、残存3表現は Grounding側・Compliance側の双方で安全な機械判定が成立しない**ことが確定。現状は Option F／Reviewer 等の AI 側責務に残す。**Compliance Assessment 変更0**（`_apfrEvaluateComplianceAssessment()` へ新Detectorを追加しない）。**Mobile Approval 変更0**（既存spine「Compliance Assessment blocked→Mobile Approval不可→Publishing Ready不可→markInstagramPublished不可」を維持）。**Quality Gate 変更0**（`complianceRestrictions` を `evaluateQualityGate()` へ接続しない）。**READY 変更0**（`complianceRestrictions` を `OUTPUT_STATUS.READY` へ接続しない）。**新規観察事項（別課題・今回は修正しない）**：実案件 `listingNgWords = ['商品名', '法人名']` は「Instagram投稿本文の禁止語」というより「リスティング広告における商品名・法人名キーワード入札禁止カテゴリ」を意味している可能性があり、現行 C-1C-1 detector が Instagram 成果物本文へ substring 検索する適用先との間に**チャネル意味ズレの可能性**がある。**今回この意味ズレは修正しない**（`listingNgWords` の意味変更／field rename／schema変更／detector変更／scan対象変更／ASPデータ変更／既存Fact訂正は禁止）。別課題としてのみ記録する。**Option D（deterministicに止めたい語句は `listingNgWords` へ登録する）の責務原則自体は維持候補だが、現在の `listingNgWords` field が Instagram 投稿用禁止語を正式に保持する Contract なのかは未確認のため「Option D 完全採用」とはまだ記録しない**。正式記録は「`complianceRestrictions` detector＝Not Required／deterministic禁止語の既存SoT＝`listingNgWords`／`listingNgWords` のチャネル意味定義には別途確認事項あり」までとする。**Decision**：新規Decision番号は作成せず Decision108 へ追記（本調査は APFR／Compliance Contract の責務境界の設計判断のため）。**Decision109（Mobile Approval Compliance Enforcement Contract）は変更なし**。**今回は docs-only stage-1（Code変更0・test変更0・DB変更0・AI API実行0・push未実施・新規Tag 0・Render操作0）**。**「Compliance Complete」「Compliance Enforcement Complete」とは記録しない**——正式意味は「調査の結果、`complianceRestrictions` の deterministic Detector 化は Not Required と判断した」である。次工程はまだ自動確定しない（技術的第一候補＝「`listingNgWords` チャネル意味定義確認調査」・ChatGPT確認待ち）。**現在地フロー**：C-1C-2a-1 正式リリースComplete → Quality Gate Grounding Enforcement 調査 → C-3-1 Grounding Detection＝Not Required → **APFR Compliance Restrictions deterministic化＝Not Required** → 現在ここ。——以前の更新記録（履歴として保存）：**APFR Step C-3-1 Grounding Detection ─ Not Required 正式化（Decision108追記・docs-only stage-1）**。前工程のread-only調査（Opus・Quality Gate Grounding Enforcement調査に続くC-3-1調査）により、deterministic Grounding Detectionを新設しても実際に発生したGrounding問題を有効に検出できないことが確定したため、**APFR Step C-3-1 Grounding Detection＝Not Required（実装しない）として正式化**した（**判定D**）。**決定的根拠（Option F前の実AI E2Eで確認されたGrounding問題15件）**：**Class A（Formal Truth直接矛盾。例「Formal Truth 報酬4000円 vs 成果物 8000円」）＝0件**／**Class B（Formal Truthに照合先fieldが存在しないContext外具体的捏造。自然由来成分・植物エキス・肌にやさしい成分設計・敏感肌・乾燥肌・悩みを解消・肌本来の美しさ・肌改善・今だけお得なキャンペーン・キャンペーン告知・特典あり等）＝12件**／**Class C（Formal Truth意味誤用。`approvalRate=100`→「100%審査通過済み」／`cookieWindowDays=90`→「90日間のクッキー期間中に購入すると特典あり」／`mobileOptimized=true`→「スマホ最適化済みで簡単購入」。**値自体はFormal Truthと一致しており、値の不一致ではなく意味・文脈の転用**）＝3件**。したがってFormal Truth Contradiction Detectionを実装しても実測15件を1件も検出できない。**APFR Formal Truth全21fieldを調査した結果、C-3-1の安全なdeterministic対象候補＝0件**（APFR＝ASPアフィリエイトプログラムの事実〔ASP名・Program ID・商品名・報酬・EPC・確定率・Cookie期間・技術対応・compliance制約等〕／Grounding問題の中心＝消費者向けマーケティング主張〔商品成分・効果・肌への適性・キャンペーン・特典・評価的表現〕でdomainが一致しない）。**claim extraction不成立**：X1（Formal Truth値との競合値検索）＝false positive過多（例`approvalRate=100`に対し「100人に聞きました」を誤検出）／X2（field-specific keyword proximity）＝実測Class Cは本文にfield labelを含まず検出不能／X3（値完全一致をsupported扱い）＝**禁止**（実測Class C 3件をすべて「supported」と誤肯定する）／X4（claim extraction／contradiction detection分割）＝claim extraction自体がsemantic判断のためdeterministicに成立しない。**status Contract**：Grounding用に`clear`／`supported`／`grounded`／`fully_grounded`を**新設しない**（「値が一致している」「矛盾が見つからない」ことを「Groundingされている」と読み替えると誤保証。特に実測Class CはFormal Truth値が完全一致しているのに意味誤用が発生している）。**C-3系列（仮提案の C-3-1 Grounding Detection／C-3-2a Grounding Assessment／C-3-2a-1 Grounding UI／C-3-2b Grounding Enforcement／C-3-3 Grounding E2E）は実装系列として取り下げ**（設計履歴として「調査した結果Not Requiredとなった」ことは正式記録として残す・単純削除は禁止）。**Leader Final Grounding現在地は変更なし**：Option F実AI E2E＝**A**／Leader Final Grounding＝**B**（軽微残存：`#敏感肌`・「自然由来のスキンケア」・「自然由来の美容と健康を追求するあなたに」・「肌に優しい医薬部外品」等）。**Grounding Complete／Fully Grounded／No Hallucination Guaranteed／Grounding Enforcement Completeとは記録しない**。**Option F責務**：今後もGeneration Preventionとして維持（deterministic Detectionではない）。正式構造＝Case Context／Formal Truth→Generation Prevention（Option F）→Reviewer／Strategy等AI評価→Leader Final。Groundingのdeterministic post-generation Detectorは新設しない。**Quality Gate変更0**（`packageQuality.status`のみを見る構造Gateであり通常Instagram投稿の公開spineを止めない・`evaluateQualityGate()`へGroundingを接続しない）。**READY変更0**（AI生成完了状態・主条件`integratedCount > 0`・Grounding接続しない・READY Grounding Enforcementも現時点では実装しない）。**Mobile Approval変更0**（`canApprove`へ新しいGrounding blockerを追加しない・現行spine「Compliance Assessment blocked→Mobile Approval不可→Publishing Ready不可→markInstagramPublished不可」を維持）。**C-2-1 Numeric Consistency変更0**（`product.inputs`とFormal Truthの照合であり成果物本文を評価しない・C-3とは別責務）。**C-2-2＝引き続き未着手・保留**。**Marketing Claim Formal Truth＝現時点では新設しない**（Formal Truth schemaを増やしても、成果物中のどの表現が「事実主張」かをdeterministicに抽出するclaim extraction問題が残る／allowlist方式＝false positive過多／denylist方式＝Complianceと同一責務）。**将来候補（実装・正式採用はしない）**：残存する軽微表現の一部（`#敏感肌`・「自然由来」・「肌に優しい」）はGroundingよりComplianceの責務に近く、Formal Truthには既に`regulatoryCategory`／`complianceRestrictions`が存在するが、既存C-1C-1は「`advertisingDisclosureRequirements`／`complianceRestrictions`／`regulatoryCategory`／`listingPolicy`は自然言語・意味的判断を要するため機械Gate化しない」と正式判断済み——**この判断は今回変更しない**。将来候補としてのみ「C-1系列：complianceRestrictions deterministic化可否調査」を記録する（まだ実装・正式採用しない）。**Decision**：新規Decision番号は作成せずDecision108へ追記（本C-3-1調査はAPFR／Formal Truth／Grounding境界の設計判断のため）。**Decision109（Mobile Approval Compliance Enforcement Contract）は変更なし**。**今回はdocs-only stage-1（Code変更0・test変更0・DB変更0・AI API実行0・push未実施・新規Tag 0・Render操作0）**。次工程はまだ自動確定しない（技術的第一候補＝「Compliance Restrictions deterministic化可否調査」・ChatGPT確認待ち）。**現在地フロー**：C-1C-2a-1 正式リリースComplete → Quality Gate Grounding Enforcement 調査（＝Quality Gate接続は不採用と判定）→ C-3-1 Grounding Detection 調査 → **C-3-1 Grounding Detection＝Not Required** → 現在ここ。——以前の更新記録（正式リリース実績を含む・履歴として保存）：**APFR Step C-1C-2a-1 Compliance UI Scope Correction 正式リリースComplete（Decision108追記・stage-2 docs同期）**。**【stage-2 docs同期・正式リリース実績】** APFR Step C-1C-2a-1 は正式リリースComplete。Code commit `112dafd6e9ff76f737a6240e2dee346656cfbed6`（`feat: scope compliance ui to scannable outputs`）／stage-1 docs commit `a97109bb2b840b464037b22719d92c00ad3cca62`（＝正式Tag target）を **main push済み**（正式リリース時 HEAD＝origin/main＝`a97109bb2b840b464037b22719d92c00ad3cca62`・ahead/behind 0/0）。**Annotated Tag `v1.01-apfr-compliance-ui-scope-correction`**（target `a97109bb2b840b464037b22719d92c00ad3cca62`）**push済み**（新規Tagは作成せず既存Tag targetも不変）。**Render自動Deploy反映確認済み**：本番 `/` 200・`/api/task-history` 200・`/api/workflow-dashboard` 200・fatal/startup error 0、本番配信 `index.html` に `_apfrComplianceHasScannableContent` と正式「NOT CHECKED」文言が存在、**本番配信 `index.html` とローカルHEADの `index.html` はbyte単位IDENTICAL確認済み**。**最新 `leaderFinalGrounding.test.js` 実測＝52/53 PASS（FAIL: `20-2a` のみ）**——`20-2a` はOption F正式commit後に `openaiClient.js` のHEAD差分が0となるため構造上PASS不可の既知diff-state static guard制約であり、C-1C-2a-1の機能FAILではない。**53/53 PASSとは記録しない**（stage-1実装中の途中値 49/53〔FAIL 18-1・20-1・20-2a・20-2b〕は `index.html` 未commit時のdiff-state由来で、正式commit後に 18-1・20-1・20-2b は解消済み）。**今回の正式化はCompliance UI Scope Correction＝正式リリースCompleteまで**——Compliance Enforcement全体Complete／Quality Gate Grounding Complete／READY Grounding Complete／Grounding Enforcement Complete／IADP Approval Enforcement Complete／server-side Enforcement Completeとは記録しない。新規Decision番号は作成せずDecision108へ追記（Decision109の責務は不変）。**次工程候補の第一＝Quality Gate Grounding Enforcement（未着手・調査/設計工程から開始）**。——以下は正式リリース前のstage-1時点の記録：IADPアカウント設計フェーズのdraft表示時にCompliance Check UIが「禁止語CLEAR／広告開示MISSING／総合BLOCKED」等の確定判定に見える表示false positiveを出す問題を発見。原因はOutput Engineが全output type共通で`buildComplianceGateHtml()`を無条件表示し、既存detectorがobject型（`fields.iadp`）をdeep recursionせず対象外とするため。Detector/Assessment Contractは変更せず、新規helper`_apfrComplianceHasScannableContent(outputDraft)`（`fields`直下にstring/arrayが1件でも存在するかの浅い型判定のみ）でscannable content無し時のみ3項目をNOT CHECKED表示へ差し替え。内部判定の呼び出し・戻り値は完全に無変更（表示直前でUI層のみ上書き）。IADP存在≠IADP-onlyのため判定軸はscannable content存在とし、投稿成果物とIADP併存時は通常表示（実際の判定）を維持——false negativeを防止。Mobile Approval Enforcement（C-1C-2b-1）／IADP Approval（C-1C-2b-2 Not Required）／Quality Gate／READYはいずれも変更0。新規`apfrComplianceUiScope.test.js` 60/60 PASS・既存回帰全PASS・新規FAIL0。`apfrDisclosureDetection.test.js`のtest 40固定windowアーティファクトを既存標準の`\n}\n`終端検出方式へ追随修正（assertion内容変更0）。`leaderFinalGrounding.test.js`は49/53（既知の非機能FAIL・53/53とは記録しない）。**今回はCompliance UI Scope Correction Code Implementation Completeまでで、Compliance Enforcement全体／Quality Gate Grounding／READY Grounding／IADP Approval Enforcement／server-side Enforcement Completeとは記録しない**。Code commit `112dafd6e9ff76f737a6240e2dee346656cfbed6`（`feat: scope compliance ui to scannable outputs`）。対象3ファイルのみ・push/Tag/Render未実施。新規Decision番号は作成せずC-1C-2a記録済みのDecision108へ追記（C-1C-2b系のApproval Enforcement ContractはDecision109に分離済み）。**Version1 Final Complete／Version1.1開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）／ 追記日: 2026-08-27（**APFR Step C-1C-2b-2 IADP Approval Enforcement ─ Not Required正式化（Decision109追記）**。実装前調査（Opus）とブラウザ実測の結果、Compliance AssessmentのDetectorはobject型フィールド（IADPアカウント設計パッケージ`fields.iadp`）をdeep recursionせず対象外とするため、IADP ApprovalとCompliance Assessmentは評価対象成果物が異なる責務不一致であることを確認し、**C-1C-2b-2は実装しないと正式判定**。接続していればadvertisingDisclosureRequirements登録済み案件のIADP設計フェーズで修復不能なfalse positive（永久block）を生み得たことも実測確認。**正式spine**：Compliance blocked→Mobile Approvalは不可（C-1C-2b-1・維持）→IADP Approvalは止めない→accountCreationReadinessは変更しない→OUTPUT_STATUS.READYは変更しない。`_iadpApproveDesign()`／`accountCreationReadiness`／既存User Approval／EER／`evaluateQualityGate()`／`OUTPUT_STATUS.READY`／`server.js`いずれも変更0。IADPカードへの新規Compliance warning表示も追加しない。将来IADPパッケージ自体のCompliance検査が必要になれば「IADP Content Compliance Detection」という別工程で設計する。既知の残課題：IADP設計フェーズ表示時のCompliance Check UI表示レベルfalse positive（C-1C-2a表示スコープ問題として別課題・non-blocking）。**今回の正式化はC-1C-2b-2 Not Requiredの判断のみで、Compliance Enforcement Complete等とは記録しない**。Code変更0・test変更0・DB変更0・AI API実行0。新規Decision番号は作成せずDecision109へ追記。**Version1 Final Complete／Version1.1開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）／ 追記日: 2026-08-27（**APFR Step C-1C-2b-1 Mobile Approval Enforcement Code Implementation Complete・新規Decision 109**。C-1C-2aまで検出のみだったCompliance Assessment blockedを、通常Instagram投稿の単一chokepointであるMobile Approvalへ実接続。Formal Truth契約（Decision108）ではなくUser Approval Contract自体の変更のため新規Decision番号（109）を採用。**Enforcement spine**：Compliance Assessment blocked→Mobile Approval不可→Publishing Ready到達不可（自動追従）→markInstagramPublished実行不可（既存hard guardで自動）。`OUTPUT_STATUS.READY`／Quality Gate／`accountCreationReadiness`／IADP Approval／Executive Decision／server-sideはいずれも変更0（server-side EnforcementはAPFR ResolverがClient専用のためC-1A Contract上実装不可）。`_apfrEvaluateMobileApprovalCompliance()`が`_apfrEvaluateComplianceAssessment()`を唯一の判定源とし独自detector再実装0。`canApprove`は既存2条件維持＋Enforcement条件追加。submit直前再評価あり（stale防止）。not_checked/例外はfail-open。released test4件を正規追随修正（弱化ではない）。新規`apfrApprovalEnforcement.test.js` 76/76 PASS・既存回帰全PASS・新規FAIL0。`leaderFinalGrounding.test.js`は49/53（既知の非機能FAIL・53/53とは記録しない）。**実運用影響**：プラファスト案件はdisclosure missingが実測済みのため次回Mobile Approval操作は実際にblockされる可能性が高い（意図した動作）。**今回はMobile Approval Enforcement Completeまでで、Compliance Enforcement全体／IADP Approval／Quality Gate Grounding／READY Grounding／accountCreationReadiness Enforcement／server-side Enforcement Completeとは記録しない**。Code commit `46b37dc2785bdd02c1cc578581c6b95f7ea8d95f`（`feat: enforce compliance on mobile approval`）。対象6ファイルのみ・push/Tag/Render未実施。**Version1 Final Complete／Version1.1開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）／ 追記日: 2026-08-27（**APFR Step C-1C-2a Compliance Assessment Aggregation Code Implementation Complete**。既存C-1C-1（listingNgWords）とC-1C-1b（広告開示）はそれぞれ独立detectorとして表示のみだったため、この2つの結果を1つのCompliance Assessmentへ集約する新規`_apfrEvaluateComplianceAssessment(outputDraft, complianceContext)`を`index.html`のみへ追加（Existing Detector `evaluateComplianceGate()`／`_apfrEvaluateDisclosureMarkers()`を呼ぶだけで独自再実装0）。status Contract：`clear`／`blocked`（violationまたはmissingのいずれか）／`not_checked`の3状態、非ブロッキング（blockedでもQuality Gate/READY/User Approval/accountCreationReadinessを止めない）。unchecked項目を握りつぶさず`clear`＝全Compliance完全確認済みと誤解させない設計。新規`apfrComplianceAssessment.test.js` 83/83 PASS・既存回帰全PASS・新規FAIL0。`leaderFinalGrounding.test.js`は49/53（FAIL4件はOption F commit時点のdiff-state static guardが正規index.html変更を検出した既知の非機能FAILでありC-1C-2a機能FAILではない・53/53とは記録しない）。**今回はCompliance Assessment Aggregation Completeまでで、Compliance Enforcement Complete／Quality Gate Grounding Complete／READY Grounding Complete／User Approval Enforcement Complete／accountCreationReadiness Enforcement Completeとは記録しない**。**重要な構造ギャップ**：非IADP案件には`accountCreationReadiness`相当のenforcement spineが存在せず、Step C-1C-2bの設計課題として未着手のまま残す。Code commit `659e82ceefb899e794b08872b58d2820b357c1df`（`feat: aggregate apfr compliance assessment`）。対象2ファイルのみ（`index.html`／新規`apfrComplianceAssessment.test.js`）・push/Tag/Render未実施。新規Decision番号は作成せずDecision108へ追記。**Version1 Final Complete／Version1.1開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）／ 追記日: 2026-08-26（**APFR Step C-1C-1b Advertising Disclosure Detection Code Implementation Complete**。既存C-1C-1は`listingNgWords`のみをdeterministicに確認しており、`advertisingDisclosureRequirements`はCompliance Contextとして到達済みだがGateでは未評価だった（Option F実AI E2Eで【広告】／#PR等の広告明示欠落を実測）。この不足を可視化するため新規`APFR_DISCLOSURE_ACCEPTED_MARKERS`（whitelist：【広告】／【PR】／#広告／#PR／#プロモーション／明示文章3種）と新規純関数`_apfrEvaluateDisclosureMarkers()`を`evaluateComplianceGate()`の兄弟関数として追加（`index.html`のみ変更・`evaluateComplianceGate()`本体・`evaluateQualityGate()`・`OUTPUT_STATUS.READY`・`approveInstagramPackage()`・Publishing Ready・APFR Resolver・C-1A/C-1B・Leader Final Grounding Option Fはいずれも変更0）。status Contract：satisfied／missing／not_checkedの3状態、非ブロッキング（missingでもQuality Gate/READY/User Approvalを止めない）。ハッシュタグはtoken境界完全一致で判定し`#profile`を`#PR`と誤検出しない。`#アフィリエイト`等は単独でsatisfiedにしない。新規`apfrDisclosureDetection.test.js` 66/66 PASS・既存回帰全PASS・新規FAIL0。`leaderFinalGrounding.test.js`は49/53（FAIL4件はOption F commit時点のdiff-state static guardが正規index.html変更を検出した既知の非機能FAILでありC-1C-1b機能FAILではない・53/53とは記録しない）。**今回はAdvertising Disclosure Detection Completeまでで、Compliance Enforcement Complete／Compliance Gate Complete／Quality Gate Grounding Complete／READY Grounding Complete／User Approval Enforcement Completeとは記録しない**。Code commit `e23c0df88d7aca485f576124677735aa080441ee`（`feat: detect advertising disclosure markers`）。対象2ファイルのみ（`index.html`／新規`apfrDisclosureDetection.test.js`）・push/Tag/Render未実施。新規Decision番号は作成せずDecision108へ追記。**Version1 Final Complete／Version1.1開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）／ 追記日: 2026-08-26（**Leader Final Grounding Option F Code Implementation Complete・実AI E2E Validated**。Path A実AI E2Eで、LCC Phase2 + Option BによりContextは正常到達しているにもかかわらずLeader FinalがWriterの停止判断を乗り越えCASE CONTEXT外の事実を捏造する問題（Context外具体的捏造12件・Formal Truth意味誤用3件・架空キャンペーン/特典あり・Quality Gate=passed/READY相当のまま素通し）を発見・修正。原因＝Leader Finalは`buildSystemPrompt()`を経由せず固定`LEADER_FINAL_PROMPT`を使用するためformalTruthRule完全版が届いていなかったこと。`openaiClient.js`のみ変更：`formalTruthRule`単一ソース化（`_buildFormalTruthRuleText`）＋新規`_buildLeaderFinalGroundingBlock`をcaseContext存在時のみ追加（`LEADER_FINAL_PROMPT`本体・`index.html`／`server.js`／`claudeClient.js`／`shared/leaderRuleEngine.js`／Quality Gate／READY／Compliance Gateはいずれも変更0）。新規`leaderFinalGrounding.test.js` 53/53 PASS・既存回帰全PASS・新規FAIL0。実AI E2E（API6回・約16.4円）でOption F後は具体的捏造0・Formal Truth意味誤用0・架空キャンペーン/特典0を確認したが、`#敏感肌`等の軽微な評価的表現が残存。**正式判定：Leader Final Grounding＝B（軽微な表現問題のみ）・Option F実AI E2E＝A（成功）**。「Grounding Complete」とは記録しない。Option F実AI E2E成功 ≠ Compliance Enforcement Complete ≠ Quality Gate Grounding Complete ≠ READY Grounding Complete（いずれも別途未実装）。Code commit `04e28a08793218ceaf59dd8fa228333bb58fcd0c`（`feat: ground leader final in formal truth context`）。対象3ファイルのみ（`openaiClient.js`／`apfrCaseDataContext.test.js`／新規`leaderFinalGrounding.test.js`）・push/Tag/Render未実施。新規Decision番号は作成せずDecision108へ追記。**Version1 Final Complete／Version1.1開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）／ 追記日: 2026-08-25（**Leader Case Context Phase2 + Option B Code Implementation Complete**。Instagram実運用で判明した「保存済み商品情報・Intelligence・APFR Formal Truthが存在するのにAI社員が『確認できない』と回答し情報不足のままReady到達する」不具合を解消。原因＝本番にCase Context配線（`caseContext`/`hasCaseContext`/`formalTruthRule`）自体が未commit（Leader Case Context Phase2）で、LCC Phase2単独でもAPFR Formal Truth・Intelligenceを含まないこと。LCC Phase2＝`caseContext`文字列契約をPath A/B・OpenAI/Claude両Providerへ配線。Option B＝新規`_buildCaseDataContext()`がAPFR Resolver（client専用維持）を呼びresolvedのみのFormal Truthと6 Intelligenceモジュール要約をserverへ受動パススルー（Resolver再実装0・C-1A test 10-6維持）。Payload実測約2,359B（全体25,008Bの約1/10.6）。実AI E2E（Path B・実案件`case-msr9yckye65y`・本番Draft無変更・API5回・¥11.5）でWriter/Researcher/Reviewer/Strategy全員のContext到達・捏造0・Formal Truth矛盾0を実証。新規`apfrCaseDataContext.test.js` 80/80 PASS・既存回帰16スイート全PASS・新規FAIL0。**Code commit `95eaa899`済み・push/Tag/Render未実施**。**LCC Phase2 + Option B Complete ≠ Leader Final Grounding Complete ≠ Quality Gate Grounding Complete ≠ READY Grounding Complete**（Path A実AI E2E・Quality Gate観察・READY観察・Leader Final fail-closed・Quality Gate Grounding Enforcementはいずれも未検証・未実装）。次工程は正式リリース前最終検証。新規Decision番号は作成せずDecision108へ追記）／2026-08-25（**APFR Step C-2-1 Formal Truth Numeric Consistency Check 正式リリースComplete**。正式リリース前最終検証（C-2-1専用53/53・既存回帰15スイート全PASS・新規FAIL0・LCC混入0・server/openaiClient/claudeClient変更0・Non-blocking Contract無変更をgit showで直接再確認）ののち、クリーンなlocalhost状態でdev-checkを実行し**200/200/200を取得**。Code commit `9cf7ab9` ＋ docs commit `38ac9aa`を**main push**（HEAD/origin/main `38ac9aa...`・ahead/behind 0/0）、**正式Tag `v1.01-apfr-formal-truth-numeric-consistency`（Annotated・target `38ac9aa...`）を作成しtag push済み**。**Render**自動Deployで本番反映済み（本番3endpoint200・`_apfrEvaluateNumericConsistency`／`buildFormalTruthConsistencyHtml`／Output Engine配線の存在を直接curl取得で確認・LCCマーカー0）。実案件データによるmatch/mismatch/uncomparable表示の本番確認は、合言葉認証保護のため今回未実施（C-2-1専用テスト53件＋localhost fixture確認による代替確認済み）。**C-2-1 Complete ≠ Intelligence Score Enforcement Complete**（score接続はStep C-2-2として別工程・未着手）。次工程はユーザー承認後に選定。新規Decision番号は作成せずDecision108へ追記）／2026-08-25（**APFR Step C-2-1 Formal Truth Numeric Consistency Check Code Implementation Complete**。Product Intelligenceのscore計算が現在使用している`product.inputs`側の`payout`／`epc`／`approvalRate`と、APFR Formal Truth側の同名Fact（既存Resolver経由）の数値整合をread-onlyで確認する`_apfrEvaluateNumericConsistency()`／`buildFormalTruthConsistencyHtml()`を実装（Code commit `9cf7ab92028e4280e83153a3c046a588187aedff`）。**4状態Contract＝match／mismatch／uncomparable／not_checked**。`payout`はAPFR側`type:'string'`（自由記述）のため常に`uncomparable`（数値変換を新設しない）、`epc`／`approvalRate`は両側`number`で厳密数値一致（`===`）のみを採用（scale自動変換なし）。**`_aicIntegratedScore()`／score／ranking／recommendation／User Approval／READY／Quality Gate／Compliance Gate（C-1C-1）はいずれも無変更**。判定結果は保存しない（runtimeのみ）。**C-2-1 Complete ≠ Intelligence Score Enforcement Complete**（mismatch検出結果をscoreへ実際に接続するかはStep C-2-2として別工程・未着手）。新規`apfrNumericConsistency.test.js` **53/53 PASS**・既存回帰全PASS・新規FAIL0。LCC Phase2混入0（HEADベース合成patchで分離・commit差分／INDEX blob双方でLCCマーカー0件確認）。localhost fixture確認で4状態表示・Console Error 0・DB書き込み0を確認。**Code commit済み・push/Tag/Render未実施**。次工程はC-2-1正式リリース前最終検証（C-2-2へは先に進まない）。新規Decision番号は作成せずDecision108へ追記）／2026-08-24（**APFR Step C-1C-1 正式リリースComplete**。正式リリース前最終検証全PASSののち、dev-check 200/200/200を取得。Code commit `d8e7021` ＋ docs commit `a2bd95a`をmain push（ahead/behind 0/0）、正式Tag `v1.01-apfr-deterministic-compliance-check`をtag push。Render自動Deployで本番反映済み（本番3endpoint200・新関数の存在確認）。**C-1C-1 Complete ≠ Compliance Enforcement Complete**（C-1C-2は別工程・未着手）。次工程はC-1C-2含め未着手）／2026-08-24（**APFR Step C-1C-1 Deterministic Compliance Check Code実装Complete**。`listingNgWords`のみを対象とした非ブロッキングDeterministic Compliance Checkを実装（Code commit `d8e7021`）。新規`evaluateComplianceGate()`／`buildComplianceGateHtml()`。`packageQuality`／`evaluateQualityGate()`／`OUTPUT_STATUS.READY`／IADP `canApprove`／User Approvalはいずれも無変更。**正式名称は「APFR Step C-1C-1」——実ブロック接続はStep C-1C-2として別工程・未着手**。テスト42/42 PASS・既存回帰全PASS。LCC混入0。**Code commit済み・push/Tag/Render未実施**。次工程＝C-1C-1正式リリース前最終検証）／2026-08-24（**APFR Step C-1A / C-1B 正式リリースComplete**。正式リリース前最終検証（C-1A 48/48・C-1B 62/62・既存回帰全PASS・新規FAIL0）ののち、クリーンなlocalhost状態でdev-checkを再試行し**200/200/200を取得**。Code commit3件を**main push**（ahead/behind 0/0）、**正式Tag `v1.01-apfr-compliance-injection`を作成しtag push済み**。**Render**自動Deployで本番反映済み（本番3endpoint200・新コード反映確認）。次工程はC-1C含め未着手・ユーザー承認後に選定）／2026-08-24（**APFR Step C-1A Compliance Context Foundation ＋ Step C-1B Writer/Reviewer Compliance Injection Code実装Complete**。Step C-1A（Code commit `9d66525`）＝Compliance Formal Truth 4field（listingNgWords／advertisingDisclosureRequirements／complianceRestrictions／regulatoryCategory。listingPolicyは対象外）をResolverから`atRunWorkflow()`→`/api/auto-task`→server.js受動パススルー→`runAutoTaskWorkflow()`までread-only配線（prompt実注入0）。Step C-1B（Code commit `f52511`）＝`buildCompliancePromptBlock()`でWriter・Reviewerへ限定注入（Strategy/Leader Finalへは注入せず）。**Quality Gate Compliance EnforcementはStep C-1C候補として未実装**。テスト：C-1B専用62/62・C-1A更新後48/48・既存回帰全PASS・新規FAIL0。**dev-check**：`/api/workflow-dashboard`はC-1Bと無関係なSupabase応答時間変動によりこのセッション内で200未確定——**environment Pendingとして記録**。LCC Phase2混入0（HEADベース合成patchで分離）。**Code commit 2件済み・push/Tag/Render未実施**。次工程＝**C-1A+C-1B正式リリース前最終検証**（C-1Cへ先に進まない）。docs更新のみ）／2026-08-24（**APFR Correction UI Core 本番認証後最終目視確認Complete**。ユーザー本人が本番URLへ認証後ログインし実ブラウザで確認：訂正ボタン表示／Correction modeへの正常遷移／現在値の正常表示／field固定表示／新しい値入力欄が空／「訂正をやめる」正常表示／cancel後の通常モード復帰。Correction Fact登録0・本番Fact変更0・DB書き込み0を維持。**Correction UI Core系列（CUI-0〜CUI-2）に残るリリース確認Pendingは0**。次工程＝APFR Correction UI後の次工程選定・調査（CUI-3／CUI-4／ITP `7days` field／APFR Step Cの必要性を比較。未着手）。docs更新のみ・Code/DB/API変更0・Tag/Render操作0）／2026-08-24（Correction UI Core CUI-0〜CUI-2 正式リリースComplete。Code commit `fd99134`・docs commit `186ec63` をmain push、HEAD/origin/main `186ec637...`（ahead/behind 0/0）。正式Tag `v1.01-apfr-correction-ui-core`（Annotated・target `186ec637...`）作成・tag push済み。Render本番反映済み。本番実データread-only検証Complete・本番認証後の実ブラウザ目視確認もComplete）／2026-08-23（CUI-2 Correction UI Core）／2026-08-23（CUI-1 Current Fact / History UI）／2026-08-22（CUI-0 Correction-aware Duplicate Policy）／2026-08-22（Phase 0／Phase 1 Contract正式化）／2026-08-22（本番実運用検証Complete）／2026-08-21（Step A/B 正式リリース）。**Version1 Final Complete／Version1.1 Connected AI Company 開発中**（Version 変更なし）。**Phase54 Complete 維持・Phase55 未着手**。

A8.net実商品「プラファスト」提携完了を背景に、正式Contract「ASP Product Fact Record（APFR）」を設計正式化した上でStep A Core・Step B Manual Input UIを実装・正式リリースした。EER（行為のFormal Truth）とは責務分離（EER=行為／APFR=商品事実）。`classification`＝`fact`/`prediction`/`inference`/`unknown`の4値を正式採用し、AI自身の判断による`fact`昇格を禁止。保存先は`intelligenceContext.product.facts`（既存JSONB）。既存Evidence/EEA/Product Intelligence/ASP Intelligence/Quality Gateはいずれも変更せず、APFR Complete≠全Quality/Hold/EEA問題Completeを明記。

- **Step A Core**：`validateApfrRecord()`／`_apfrAppendRecord()`。合成テスト49/49 PASS。Code commit **3113e53**。
- **Step B Manual Input UI**：Affiliate Intelligence Core内へAPFR入力パネル。provenance＋User Verificationからのみfact確定。合成テスト35/35 PASS。localhost実機検証済み。Code commit **1e8de4f**。
- **正式リリース（2026-08-21）**：docs commit **f6caf23**・Annotated Tag **v1.01-apfr-core-manual-input**・main push・tag push・Render反映済み。この時点で実案件APFR登録0件・プラファスト未登録。
- **本番実運用検証Complete（2026-08-22）**：ユーザー本人が本番UIでプラファストのAffiliate Evaluation登録・商品採用を実施後、対象`case-msr9yckye65y`／`["プラファスト","a8.net"]`へ**全21フィールドを1件ずつ登録＝21/21 Complete**。Fact総**22レコード**（`listingNgWords`訂正履歴1件含む・最新正Fact`["商品名","法人名"]`・**最新有効Fact基準で判定**）。**Contract違反0件**・**Cross-case混入0件**・Persistence確認済み。**AI推測Fact昇格0件・`manual_user_input`単独Fact昇格0件**。無回帰：IADP 100/complete・Quality Gate Passed・Reviewer Passed・Strategy Accepted・User Approval Approved・EER 3件executed・Evidence 9件。Claude Codeは読み取り専用確認のみ・Fact登録0件。**docs更新のみ・Code/DB/API/Fact変更0・Tag/Push/Render未実施**。
- **残課題（Completeとは分離）**：①同一fieldへの複数Fact存在時の最新採用ルール未明文（**Step Cの前提**）②ITP「7days」保存field不在③boolean日本語表示④`listingPolicy`表記統一⑤フィールド選択UI（巨大select・スクロール・検索性）⑥APFR直接ジャンプ導線⑦入力省力化⑧EEA問題（Decision101）⑨Quality Gate／Hold制御問題。**APFR実運用Complete≠EEA問題Complete／≠Quality Gate・Hold問題Complete**。
- **Phase 0 再Adopt時Fact消失防止（Code commit `d69ff60`）**：商品再Adopt時に`product`が丸ごと置換され登録済みFactが全消失する潜在リスクを`_apfrCarryOverFacts()`で解消。**同一caseId かつ 同一productIdentifier のみcarry-over**（Cross-case/Cross-product は0）・deep clone・入力非破壊・配列順と訂正履歴を維持。合成テスト40/40 PASS。APFR Contract変更なし。
- **Phase 1 Current Fact Resolver（Code commit `46c51ef`）**：read-only純関数`_apfrResolveCurrentFact()`／`_apfrResolveCurrentFacts()`を追加し、**Current Fact Resolver／Correction／Ambiguity（fail-closed）／Legacy Fallback／Step C開始条件**を正式化。解決順序は①明示訂正chain（`supersedesFactId`）優先→②明示関係が皆無の場合のみ`recordedAt`最大→③一意決定不能は`ambiguous`。**明示chainと独立legacyの並存・timestamp collisionはいずれもambiguous**（恣意的tie-breaker／sourceMethod優先は不採用）。**既存22 Factはmigration不要**・本番相当fixtureで**resolved 21 / none 0 / ambiguous 0**。合成テスト70/70 PASS・既存回帰全PASS・dev-check 200/200/200。**UI未接続・Step C未接続・DB書き込み0**。
- **Step C開始条件（確定）**：Step CはResolverをFormal Truthの唯一の読み取り口とし、`resolved`のみ利用可・`ambiguous`は利用禁止（fail-closed）。**`facts`配列を直接走査して独自に最新判断する方式は禁止**。
- **CUI-0 Correction-aware Duplicate Policy（Code commit `9ad76f8`）**：`A(1)`→`B(2, supersedes A)`→`C(1, supersedes B)`という**「元の値への正式な差し戻し訂正」が`duplicate_record`で誤拒否**されていた問題を解消。**`supersedesFactId`をduplicate identityへ追加**（8→9項目）。**全9項目一致の完全同一Correction Recordは従来どおり拒否＝duplicate防止は弱めない**。未設定は`|| null`方式で property未存在／undefined／null／'' を「訂正関係なし」として同一扱いし、**通常Recordのduplicate判定は不変**。**chain異常判定はduplicate関数の責務外**でResolverが`ambiguous`＋fail-closed処理する責務境界を明記。**append-only不変**（`A→B→C`は3件保持）。CUI-0専用テスト**65/65 PASS**・既存回帰全PASS・新規FAIL 0・dev-check 200/200/200・main push済み・Render自動Deploy反映確認済み・**CUI-0用Tag未作成**。DB/API/Fact変更0。
- **CUI-1 Current Fact / History UI（Code commit `1cf3b2e`）**：全件フラット表示により本番`listingNgWords`で旧`["法人名"]`と訂正`["商品名","法人名"]`のどちらが現在値か画面上で判断できなかった問題を解消。**Phase 1 Resolverを初めてUIへ表示専用接続**し、現在値一覧は**`_apfrResolveCurrentFacts()`の結果のみ使用**（UI独自のcurrent判定を禁止・静的検証をテスト化）。`resolved`のみ表示／`none`は「○ 未登録」／**`ambiguous`はcurrentFactも候補代表も表示せず**理由のみ（fail-closed維持）。**「現在値一覧＋折りたたみHistory（既定閉）」へ分離**し、Historyは全Fact保持・区別は**Resolver結果から動的導出のみ**（旧Factへ`superseded`等を保存しない）。通常表示21行固定で**Factが増えても画面が比例して伸びない**。**boolean日本語表示を同時実装**（保存値`boolean`・`option value`とも不変）。`listingPolicy`は**normalizeせず保存値のまま表示**。CUI-1専用テスト**78/78 PASS**・既存回帰全PASS・新規FAIL 0・dev-check 200/200/200・localhost実機Console Error 0・main push済み・Render自動Deploy反映確認済み・**Tag未作成**。DB/API/Fact変更0。
- **CUI-2 Correction UI Core（Code commit `fd99134`）**：**Resolverで`resolved`となった現在Factをユーザー操作で正式なCorrection Recordとして訂正するUI**を実装。`Resolver`→`resolved`→「訂正」→**Correction Target**（`caseId`/`productIdentifier`/`field`/`currentFactId`の4項目のみ・Fact本文非保持）→訂正モード→**submit直前Resolver再検証**→`supersedesFactId`自動付与→既存Core→append-only→新Factがcurrent／旧FactはHistory。`resolved`のみ訂正可／`none`は通常登録（`supersedesFactId`なし）／**`ambiguous`は訂正ボタン非表示・候補代表選択なし**（fail-closed維持）。**stale Target対策**として開始時とsubmit直前の二重Resolver照合を行い、不一致時は登録停止・append 0・Target破棄で**`branched_chain`生成を防止**。**Cross-case／Cross-product／Cross-field禁止**（fieldはUI固定＋submit再検証の二重防御）。**append-only維持**（旧Factのmutation 0）・**CUI-0 duplicate policy再利用**（独自判定0／stale時Target破棄・通常failure時Target保持）・**User Verification維持／AI自動訂正禁止**。**Core 3関数・Resolver 4関数・History関数は無変更**。新規テスト**105/105 PASS**・既存回帰全PASS・新規FAIL 0・dev-check 200/200/200・localhost**Console Error 0**・**実DBへのFact登録0件**。DB/API/`server.js`変更0。
- **⚠ CUI-2 Completeの意味**：Correction UI Coreの完成であり、**CUI-3／CUI-4／Step C／Product・ASP Intelligence接続／EEA問題／Quality Gate・Hold問題／LCC Phase2 のCompleteをいずれも意味しない**。
- **現在地の内訳**：Correction Contract＝**Complete**／Current Fact Resolver＝**Complete**／Correction-aware Duplicate Policy（CUI-0）＝**Complete**／Current Fact・History UI（CUI-1）＝**Complete**／Correction UI Core（CUI-2）＝**Complete**。**Correction UI Core系列（CUI-0〜CUI-2）は実装Complete**。**ただし正式Tag・正式リリースは未実施**。
- **APFR Correction UI Core CUI-0〜CUI-2 正式リリースComplete（2026-08-24）**：main push（Code commit `fd99134`・docs commit `186ec63`）でHEAD/origin/main `186ec6371676e0ad9ab49368f2899bf9e4155f90`（ahead/behind 0/0）に同期。**正式Tag `v1.01-apfr-correction-ui-core`（Annotated・target `186ec637...`）を作成しtag push済み**。Render自動Deployで本番反映（トップ200／API 2件200）、本番配信コードにCUI-2の5関数すべて存在確認。**本番検証**：①**Complete**＝本番実データ（プラファスト22 Fact）read-only検証で`resolved`21／`none`0／`ambiguous`0・facts不変・DB書き込み0を確認。②**Pending**＝合言葉認証のため実ブラウザ目視のみ未実施。
- **現在地の内訳（最終）**：Correction Contract／Current Fact Resolver／CUI-0／CUI-1／CUI-2＝すべて**Complete**、**APFR Correction UI Core CUI-0〜CUI-2＝正式リリースComplete**。
- **次工程**：**最優先＝本番認証後のCorrection UI最終目視確認**（ユーザー本人が実施・Fact登録ボタンは押さない）。その後：①**CUI-3**（「訂正済み」バッジ・旧値参考表示。独立工程として必要かは次工程選定時に再評価）②**CUI-4**（APFR直接ジャンプ）③残課題2（ITP日数field）の仕様判断④残課題4〜7のUI改善⑤Step C（ASP/Product Intelligence接続・Resolver経由のみ）→ Step D（Compliance Contract）→ Step E（Content Planning/Writer接続）。いずれもユーザー承認後に着手・自動開始しない。

---

## External Execution Completion Contract ＋ EER-1/EER-2/EER-3/EER-4（正式リリース・本番実運用完了・2026-08-21・Decision 107）

> 追記日: 2026-08-21。**Version1 Final Complete／Version1.1 Connected AI Company 開発中**（Version 変更なし）。**Phase54 Complete 維持・Phase55 未着手**。

対象案件`case-msr9yckye65y`はシステム上Ready到達後、ユーザーが現実世界でInstagramアカウント作成・A8.net登録・A8.netメディア登録まで実行済みだが、これを保持するFormal Truthが現在の設計に存在しないことを確認。正式Contract「External Execution Record（EER）」を設計し、`FORMAL_CASE_FIELDS`へ独立キー`externalExecution`を追加（IADP配下案は不採用）した上でEER-1/EER-2を実装した。Approved≠Executed・Ready≠Executed・AI推測による昇格禁止を正式原則とする。初期source=`user_confirmation`のみ・初期status=`executed`のみ（`verified`は将来Decision）・caseId必須／packageId任意・carry-forward対象・Cross-case禁止。初期executionType3種＝`instagram_account_created`／`asp_registered`／`asp_media_registered`。DB/API/新規Engineはいずれも不要。

- **EER-1 Core**：`validateExternalExecutionRecord()`／`_eerAppendRecord()`。合成テスト51/51 PASS。Code commit **504b991**。
- **EER-2 User Confirmation UI**：Leader Final Summary内へ登録状況表示・「実行完了として登録」ボタン。localhost実機検証（テスト案件`case-msoplrg6gdkr`）で登録→復元→Cross-case確認→原状復帰済み。Code commit **58e9451**。
- **EER-3 正式リリース**：docs commit **ed14959**・Tag **v1.01-external-execution-record**・main push・tag push・Render反映済み。
- **EER-4 本番実運用完了**：ユーザー本人が本番UIから対象実案件`case-msr9yckye65y`へ3件（instagram_account_created／asp_registered／asp_media_registered）を正式登録。Contract完全準拠・重複なし・IADP無回帰・F5復元済み。Claude Codeからの登録は0件（読み取り確認のみ）。
- **今回の範囲**：EER-1〜EER-4完了。実案件データ変更はユーザー本人の本番UI操作による3件登録のみ。
- **次工程**：EER登録3件を踏まえたAccount Creation Readiness最終確認、またはInstagram実運用側（別チャット）の進行。

---

## Phase IG-QC-B1/B2 candidateOnly Quality Routing Fix / Production Re-evaluation（正式リリース・2026-08-20・Decision 106）

> 追記日: 2026-08-20。**Version1 Final Complete／Version1.1 Connected AI Company 開発中**（Version 変更なし）。**Phase54 Complete 維持・Phase55 未着手**。

Phase IG-QC-B1 ─ `buildOutputDraftFromLeaderFinal({candidateOnly:true})`ブランチへ通常経路と完全同一の IADP Quality routing を追加。86/86 PASS。Code commit **0c076dd**。
Phase IG-QC-B2 ─ 本番 `out_1787060723866` の旧 snapshot（instagram/20/insufficient）を既存`evaluateQualityGate()`で非課金再評価・限定保存。category=iadp / score=100 / complete / QG passed。
B3 ─ docs commit・Annotated Tag **v1.01-iadp-quality-routing-complete**・main push・Render 反映・PC本番確認済み。OpenAI API 0・Claude API 0・B2 DB 変更は対象 Output Draft のみ。

- **次工程**：本番で Account Creation Readiness の正しい評価（conditional 相当）を確認する。User Approval はまだ変更しない。Instagram アカウント作成へはまだ進まない。

---

## Phase IG-QC / B-7F Quality Gate Package Routing Fix（正式リリース・2026-08-20・Decision 105）

> 追記日: 2026-08-20。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**（Version変更なし）。**Phase54 Complete維持・Phase55未着手**。**`index.html`（2 hunk）／`iadpQualityContractRouting.test.js`（新規）のみ**（Code commit `547ddac`）。

**Instagram実運用中**のQuality Contract / Quality Gate Wiring Fix正式完了。案件`case-msr9yckye65y`のOutput Draft（IADP `iadp_1787060839814_izhakb`）のQuality評価が誤接続されていた根本原因と、全Path A Output TypeのQuality Gate配線バグを解消した。

- **Phase IG-QC（IADP Quality Contract Routing Fix）**：IADPを含むOutput DraftがInstagram投稿用`instagram` Quality Contract（hook/slideTitles/hashtags等10項目）へ誤接続されていたため`score:20/status:insufficient`・Quality Gate常時Failedになっていた。正式IADP（`fields.iadp.quality`存在・`validation.valid===true`・`packageId`存在）は`evaluateInstagramAccountDesignQuality()`の事前算出済み結果を`packageQuality`へrouting。非IADP・guard失敗は既存`evaluateOutputPackageCompleteness()`へfall-through（後方互換維持）。
- **Phase B-7F補完（全Path A Quality Gate配線）**：`buildOutputDraftFromLeaderFinal()`のreturn値に`packageQuality`が含まれていなかったため全Path A Output Typeで`evaluateQualityGate(undefined)`が実行され`sourceStatus=null`（Quality Gate表示不能）だった。return値に`packageQuality`を追加し全Output TypeでQuality Gateへ実評価値を正式接続。IADP限定Hotfixではなく全Path Aの共通配線バグ修正。
- **Executive Decision**：`qualityGate:null`の既存責務は変更なし。Quality Gate結果はExecutive Decisionの判断ロジックに影響しない（表示専用影響のみ）。User Approval・Evidence・DB・API契約は変更なし。
- **回帰検証**：`iadpQualityContractRouting.test.js` **48/48 PASS**。非課金回帰全PASS。Leader Case Context Phase2混入なし。
- **次工程**：対象案件`case-msr9yckye65y`のIADP専用Quality/packageQuality/Quality Gate/Account Creation Readinessを本番で再確認後、次工程を判断する（まだUser Approvalへは進まない）。

---
## IADP Structured Output（正式リリース・2026-08-18・Decision 103）

> 追記日: 2026-08-18。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**（Version変更なし）。**Phase54 Complete維持・Phase55未着手**（Phase55へは移行しない）。**`openaiClient.js`／`index.html`（最小限）／`iadpStructuredOutput.test.js`のみ**（Code commit `8a9d417`）。

- **API側スキーマ強制**：OpenAI Responses API `text.format:{type:'json_schema',strict:true}`をIADP Leader Final呼び出し1箇所のみへ追加。他の全`callOpenAI()`呼び出しは無影響。
- **根本原因**：IADP Leader Finalが自由記述のみに依存し、Promptは正式schemaを正確に要求していたにもかかわらず、`finalProfile`のトップレベル配置と`candidateComparison`/`adoptionDecision`の出力を実生成で逸脱していた（実測確認・過去の正常生成実例も存在）。
- **Formal Truth安全契約を完全維持**：`shared/instagramAccountDesign.js`（Validator/Normalizer）は無変更。推測補完・自動水増し・validation緩和なし。
- **実AI E2E**：1 workflow・8 callでSchema受理・`validateAccountDesignPackage()`が`valid:true`。Cross-case混入なし。
- **既知の重要事項**：別系統差分「Leader Case Context Phase2」（`buildLeaderCaseContext()`含む）は今回除外。本番環境には現時点でこの関数が存在しない。
- Console Error 0・合成テスト13件・EEA既存36件全PASS。
- **次工程 ＝ Evidence充足（EEA経路・ユーザー承認後）**。IADP自体は正式生成・保存済み。

---

## Deliverable Completion Architecture（正式リリース・2026-08-18・Decision 102）

> 追記日: 2026-08-18。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**（Version変更なし）。**Phase54 Complete維持・Phase55未着手**（Phase55へは移行しない）。新規DB table・schema変更なし。**index.htmlのみ**（Code commit `364b65a`）。

- **Completion Core**：`evaluateDeliverableCompletion()`（Contract v1.0.0・追加AI call 0）がoutputType別required項目の充足から`complete`／`incomplete`／`blocked`を判定。Quality Gate・Constitution・User Approval・Formal Truthとは責務分離（重複判定・書き換えなし）。
- **Completion保存・復元**：既存`package_quality`JSONBへ同梱保存・F5復元でdraftトップレベルへ再展開（新DB列なし）。`FORMAL_CASE_FIELDS`には含めない（次Draftへcarry-forwardしない）。
- **Formal Truth Race Condition安全化**：案件切替直後のAuto Task開始でOutput Draft復元前にFormal Truthが引き継がれない実測済み競合を、`scheduleOutputDraftRestore()`のPromise化＋`atRunWorkflow()`側awaitガードで解消（sleep/setTimeout不使用）。carry-forwardを`FORMAL_CASE_FIELDS`契約全体（iadp／intelligenceContext／affiliateContext／approvedDecisionPackage）へ一般化。
- **実AI E2E**：`case-msoplrg6gdkr`で1 workflow・実call5（見積りmax=5と一致）・Web Search0回・Cross-case非混入を実測確認。
- **Completion UI**：Output EngineへComplete/Incomplete/Blockedの最小表示を追加。旧Draット（completionAssessment未生成）は非表示。
- **Output Type判定精度改善**：`instagram_post`の一般的な投稿依頼が`instagram_carousel`へ誤判定される実バグを修正（13型回帰なし）。
- Console Error 0・EEA既存合成テスト36件全PASS・node --test 81 PASS/6 FAIL（既知pre-existing・本リリースと無関係）・実AI追加費用は事前見積り内（5 call）。
- **既知の未commit差分（今回対象外）**：「Leader Case Context Phase2」（Leader dispatch関連へのcaseId伝播）は本リリースと機能的依存がないため今回除外。別途ユーザー判断でリリース。
- **次工程 ＝ Instagram実運用を優先**（ユーザー承認後）。iPhone実機確認（Output Engine・Completion UI表示・既存画面非崩壊・案件切替後の正常動作）待ち。

---

## External Evidence Acquisition（正式リリース・2026-08-13・Decision 101）

> 追記日: 2026-08-13。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**（Version変更なし）。**Phase54 Complete維持・Phase55未着手**（Phase55へは移行しない）。新規DB table・schema変更なし。

- **EEA-1〜EEA-12 正式Complete**：Evidence schema extension／External Web Search Adapter／Search Plan + User Approval Gate／Evidence Normalization + Persistence／実Web Search限定検証／Source Trust・Independent Source・Verified Promotion評価／Trust Tier優先Selection + Category Coverage／Web Search Cost Tracker接続／Completion Gap Review／Verified Promotion Application（設計＋実装）／Final Regression／Formal Release。
- **User Approval型Web Search**：Search Plan機械生成（LLM不使用・$0円）→ユーザー明示承認→billingLock解除→実Web Search、の順を厳守。`MAX_QUERIES_PER_APPROVAL=3`／`MAX_EVIDENCE_PER_BATCH=5`。
- **Verified Promotion（2段階方式）**：Trust Tier（8段階）×Independent Source（独立2 Publisher以上）×claimType条件を満たしたEvidenceのみ`verified`へ昇格。処理順非依存を合成テストで確認。monetizationはclaimType未対応のためunverified固定（安全側）。
- **Cost Tracker二層構造を正式記録**：ローカルGate用state（`cost-logs.json`）とSupabase実績正本（`api_cost_events`）は独立。「Historical Cost Lost」は「**Local Cost Gate State Historical Values Lost**」へ表現訂正（Supabase側実費は無傷）。
- **実測toolCallCount精算**：`tool_choice:'auto'`によりquery数と実tool call数は一致しない場合がある（実測：3クエリ→6 tool calls）。事前表示は上限目安・実行後精算を正本とする仕様を明記。
- **EEA-11実機検証**：QA専用case`case-msoplrg6gdkr`でverified Evidence5件・独立Publisher3件・`resolveIadpEvidence()`が既存Gate無改修で`sufficient`へ到達・F5復元Complete。Account Creation Readinessは`conditional`（Evidence起因ではなくuserApproval pending）。
- Console Error 0・合成テスト36件全PASS・実Web Search1回（承認済み3クエリのみ）・追加API実行0回。
- **次工程 ＝ Instagram実運用またはPhase55判断**（ユーザー承認後に決定）。Tier3/Tier6案件固有allowlist・monetization claimType mapping・Category Coverage Gate化はEEA Complete後の改善候補。Auto Task完全自動化・Researcher直接Web Search統合はEEA外の将来機能として保留。

---

## IADP / LFS Navigation & Scroll Usability Improvement（正式リリース・2026-08-12・Decision 100）

> 追記日: 2026-08-12。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**（Version変更なし）。**Phase54 Complete維持・Phase55未着手**。**index.htmlのみ**（Code commit `0309086`・+99/-11）。IADP/LFS契約・Evidence判定・Quality Gate・Reviewer・Strategy・adoptionDecision・User Approval・Output Draft保存契約・Researcher・Analyst・DB・schema・APIは無変更。

- **① IADP→LFS直接ジャンプ**／**② LFS→IADP直接ジャンプ**（既存`_lfsScrollToDetails()`再利用）／**③ チャット上端/下端固定ジャンプ**（`#chat-scroll-nav`）／**④ `#chat-area`スクロールバー操作性改善**（幅6px→14px・矢印ボタン非表示化）。
- **⑤ スクロールバー不具合の根本原因修正**：実機確認で「一部分しかドラッグできない」症状が判明。`document.elementFromPoint()`のピクセル単位スイープ調査により、既存の`id="knowledge-panel"`重複バグ（📚ナレッジエンジン用・🧠顧客記憶パネル用が同一ID、CSSも同一セレクタで2ブロック重複）が根本原因と特定。ナレッジエンジン側の「閉」状態が画面外へ完全退避できず、右端約12px幅の帯が`#chat-area`スクロールバー帯（約15px）の大半を`position:fixed;z-index:300;pointer-events:auto`で覆っていた。**Edge/Chromiumのネイティブスクロールバー仕様が原因でないことを実測確認済み**（カスタムドラッグハンドルは不要と判断・未実装）。最小修正として衝突IDの片方（顧客記憶パネル側）のみ`company-memory-panel`へ改名。副次効果として、従来一度も正しく開閉できていなかった顧客記憶パネルが今回初めて正しく開閉できるようになった。
- Cross-case安全性・ユーザーWindows/Edge実機確認とも完了（Complete）。Console Error 0・dev-check 200/200/200・`git diff --check` CLEAN・実AI実行0回・追加API費用0円。
- **次工程 ＝ External Evidence Acquisition**（設計調査完了・未実装。Researcherは現状Web検索能力を持たずLLM内部知識のみで市場・競合調査を行っており、Evidence正本`outputDraft.fields.intelligenceContext.evidence[]`はAffiliate Evaluation手入力経路からのみ生成される。推奨構成は薄いEvidence Acquisition Adapter）。

---

## IADP Post-Release Hotfix / Hotfix-Quality / Stability Hotfix（正式リリース・2026-08-11・Decision 099）

> 追記日: 2026-08-11。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**（Version変更なし）。**Phase54 Complete維持・Phase55未着手**（Phase55へは移行しない）。**index.html／openaiClient.js／shared/instagramAccountDesign.js／shared/instagramAccountDesignQuality.js／shared/agentResultNormalizer.js**。**server.js／DB／supabase/schema.sql／API契約は無変更・新規API/新規DBカラム/新Engineなし**。

- **背景**：Decision098（IG-2J-A〜I）後の実運用確認で、IADP生成物に構造・品質面の不備が判明した。
- **Post-Release Hotfix**（Code commit `585360c`）＝Leader Final構造安定化・SSOT維持・IADP保存/表示・Output Draft生JSON汚染防止・F5復元・Cross-case独立性・User Approval pending維持・AI Action/User Input境界維持。
- **Hotfix-Quality**（Code commit `4b92f0d`）＝顔出しなし・本人音声なし方針／KPI5項目／KPI改善条件／6リスク／リスク回避策／`first30DaysOperatingPolicy`／Reviewer指摘のLeader自律補完を強化。専用テスト案件での実AI再検証で①JSON末尾括弧不足②finalProfile誤配置③adoptionDecision誤配置④KPI5がnull⑤`first30DaysOperatingPolicy`が配列、の5件FAILが判明。
- **Stability Hotfix**（Code commit `936cd77`）＝Leader Final Prompt出力安定化＋決定論的JSON Recovery（`IADP_MAX_SYNTHETIC_CLOSERS=2`）＋finalProfile/adoptionDecision誤配置救済で上記5件を解消。
- **実AI最終再検証**：専用新規テスト案件`case-msoplrg6gdkr`（費用¥52.62・上限¥100以内）で前回FAILの5件すべて解消。Reviewer Passed／Strategy Accepted／Quality Gate Passed／User Approval Pending／Output Draft汚染なし／F5復元一致／Cross-case独立性維持（実案件3件・既存テスト案件2件無傷）／Console Error 0／dev-check 200/200/200。結果はAccount Creation = Not Ready（Evidence Insufficient）＝Decision097 Ready正式条件が正常機能した結果でFAILではない。
- **正直な記録**：実AI dispatchは2回発生し、成果物を生成した完全なAI社員Workflow実行は1回のみ（詳細はDecision099参照）。総合点1位自動採用禁止契約は今回のサンプルでは1位=採用案が一致したため実地未確認だが、契約・回帰テストは維持。
- 次工程 ＝ **Instagram実運用準備／実運用開始**（Decision098時点から変更なし）。

---

## Instagram Account Design Self-Completion / AI Action Rerun（Phase IG-2J-A〜I統合・正式リリース・2026-08-10・Decision 098）

> 追記日: 2026-08-10。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**（Version変更なし）。**Phase54 Complete維持・Phase55未着手**（Phase55へは移行しない）。**index.html／openaiClient.js／shared/instagramAccountDesign.js／shared/instagramAccountDesignQuality.js／shared/iadpIntelligenceContext.js（新規）／shared/agentResultNormalizer.js（新規）**。**server.js／DB／supabase/schema.sql／API契約は無変更・新規API/新規DBカラム/新Engineなし**。

- **Phase IG-2J ＝ Complete（Code Complete）**。IG-2J-A〜Iをもって、IADPは「**AI会社自身が不足を判定し、必要なAI社員を再実行し、Leader Finalを再生成して再評価できる**」状態へ到達した。
  - A Self-Completion（`d95f196`）／B Leader Final Summary（`7a33296`）／C AI Action・User Input分離（`244cad2`）／D 採用案SSOT（`144b0ff`）／E Intelligence注入（`fa91cae`）／F Evidence正本接続（`d7d21dd`）／G 成果物正規化（`7ff4140`）／H AI Action自律再実行（`f845db0`）／I 最終統合検証（Code変更なし）。
- **正式契約（今後の実装が守るべき正本）**：採用案の正本＝`intelligence.adoptionDecision.adoptedCandidateId`（**総合点1位を自動採用しない**）。Evidenceの正本＝`outputDraft.fields.intelligenceContext.evidence[]`（`fieldStatus`はlegacy fallback）。確認事項は`actionItems.aiActions`／`userInputs`へ分離し、**userInputsはAuto Task化しない**。User Approvalは**AI会社が代行しない**（新packageId・採用案変更で承認は無効化。承認だけ・Quality Gate通過だけではReadyにしない）。
- **検証実績**：回帰**441項目全PASS**／**実AI End-to-End 1回PASS**（Researcher→Analystの部分再実行→Reviewer→Strategy→Leader Final→新IADP生成→SSOT解決→Evidence判定→Quality Gate再評価→F5復元）／API追加費用**約¥30**（上限¥100内）／実案件書き込み0件／テストデータ**remaining=0**。
- **正式リリース実績（2026-08-10）**：docs commit `32b0821`／Annotated Tag **v1.01-instagram-account-design-self-complete**／main push（`540411e..32b0821`）／tag push／**Render反映完了**（本番200・配信物へ全10項目反映確認）／**PC本番確認完了**（横はみ出しなし・Console Error 0）／**iPhone Portrait実機確認完了**（ユーザー実施）。**iPhone LandscapeはKnown Issue継続**（Responsive未対応・IG-2J実装による新規不具合ではない）。
- **次工程（第一候補）**：**Instagram実運用準備／実運用開始**（アカウント作成→プロフィール設定→ASP登録→商品調査→投稿企画→初回投稿→KPI取得→Learning実測）。**新しいPhase番号は作らない**。Phase55へは移行しない。
- **後続工程候補（未着手）**：iPhone Landscape Responsive対応（独立工程）／Background Execution（実運用・Learning実測後・Version1.1後半の大型工程）／Completion Gate設計／Reviewer NG keyword本体修正／チャット経路`generateReply`のreply wrapper修正／iPhoneチャット履歴瞬間消失対応。

---

## IADP Quality / Approval / Quality Signals 正式採用（Phase IG-2F〜IG-2H統合・正式リリース・2026-08-09・Decision 097）

> 追記日: 2026-08-09。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**。**index.html／shared/instagramAccountDesignQuality.js**。**server.js／shared/instagramAccountDesign.js／shared/leaderRuleEngine.js／supabase/schema.sql／DB／API契約は無変更・新規API/新規DBカラムなし**。

IADPがComplete／100点／Readyと誤表示される問題（Evidence 0件・担当成果物不足・Leader統合回答なしでも100点）をIG-2F〜IG-2Hの3工程で解消し、IADP品質基盤を正式リリースした（詳細はDecision097）。

**正式ロードマップ（改訂・確定・実装順）**：

```
Phase IG-2D   IADP構造化JSON品質調整 ────────────────── 正式Complete（2026-08-06・Decision096）
  ↓
Phase IG-2E   Output Draft保存・F5復元・1 Case 1 正本 ── 正式Complete（2026-08-06・Decision096）
  ↓
Phase IG-2F   階層品質判定・Summary UI改善 ──────────── 正式Complete（Code commit b5a3d5e）
              構造検証／内容品質／Evidence／Readiness／User Approvalの5軸分離
  ↓
Phase IG-2G   User Approval Flow ───────────────────── 正式Complete（Code commit 18fc04b）
              approval永続化・caseId＋packageId一致・承認後Ready即時再評価
  ↓
Phase IG-2H   Reviewer／Strategy／Quality Gate 接続 ─── 正式Complete（Code commit 4dd0400）
              既存正本の再利用のみ・Quality Gate再実行なし・多シグナル導出
  ↓
Phase IG-2I   docs正式化・Tag・Push・Render・本番確認 ─ 正式Complete（2026-08-09・Decision097）
              PC本番確認 完了／iPhone実機確認 完了（縦画面Complete・横画面はKnown Issue継続）
  ↓
【次工程】     Instagram実運用 ─────────────────────── 進行中（Quality Contract/QG Wiring Fix完了・本番QA中）
              アカウント作成 → プロフィール設定 → ASP登録 → 商品調査
              → 投稿企画 → 初回投稿 → KPI取得 → Learning実測
  ↓
【独立工程】   iPhone Landscape Responsive対応 ─────── 未着手（Known Issue・実運用と並行可）
              サイドバー制御・レイアウト占有率最適化
  ↓
【後半工程】   Background Execution ────────────────── 未着手（実運用・Learning実測後）
```

**Ready正式条件**：①Structure Validation Passed ②Content Quality Complete ③Evidence Status ≠ Insufficient ④Reviewer重大不足なし ⑤Strategy再設計要求なし ⑥Quality Gate Passed ⑦Leader統合回答あり ⑧必須担当成果物あり ⑨User Approval Approved の全充足。承認だけで品質不足を上書きしない。

**Path B（安全側仕様として正式化）**：Path Bは`inbox.qualityGate === null`となるためIADPはComplete／Readyへ到達しない。正式経路はPath A Auto Taskを基本とし、Path BへQuality Gateを新設しない（Decision087継承）。

**Background Execution（Version1.1後半の大型工程・今回未実装）**：目的＝ユーザーがPC／iPhone／ブラウザを開き続けなくてもAI会社がサーバー側で処理を継続できる状態。将来対象＝Job Queue／Background Processing／queued・running・completed・failed・cancelled・retrying／Progress保存／Resume／Retry／Cancel／Multiple Jobs／完了通知／Cross-case guard／二重実行防止／古い結果による上書き防止／コスト制御。基本方針＝既存のIntelligence・Evidence・Leader Rule Engine・Reviewer・Strategy・Quality Gate・Executive Decision・Output Draftを可能な限り維持し、実行基盤を段階的にサーバー側へ移行する。**品質判断が安定する前にBackground化しない**（実運用・Learning実測後に着手）。

**Known Issue**：Reviewer NG keyword partial-match issue（既存`LI_REVIEWER_REJECTION_KEYWORDS`の`NG`部分一致でBRANDING/MARKETINGを誤検出し得る。IADP側は回避済み・本体修正は後続候補）／iPhoneチャット履歴の瞬間消失／**iPhone Landscapeレイアウト崩れ（2026-08-09実機確認で継続を再確認・左サイドバーとメイン領域の占有が大きく実用上ほぼ使用不可・Responsive未対応が原因でIG-2F〜IG-2I実装による新規不具合ではない）**。

**iPhone実機確認（2026-08-09・ユーザー実施）**：縦画面＝**Complete**（本番表示・ログイン・Leader・案件表示・メニュー操作正常・白画面なし・無限ロードなし）。横画面＝**Known Issue継続・未修正**（正式リリース判定には影響させず、独立したResponsive対応工程として後続管理）。

**次工程**：Instagram実運用を最優先とし、実AI IADP End-to-End確認はAPI費用のユーザー承認後に実施する。**iPhone Landscape Responsive対応**は実運用と並行可能な独立工程として管理する。Background Executionは実運用・Learning実測後。Completion Gate設計・NG keyword本体修正・iPhoneチャット履歴瞬間消失対応を後続候補として並列に記録する。正式な次工程はユーザー承認後に決定する。詳細はdocs/04DECISIONS.md Decision097を参照。

---

## Instagram Account Design Package Output Draft Integration 正式採用（Phase IG-2D〜IG-2E統合・2026-08-06・Decision 096）

> 追記日: 2026-08-06。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**。**index.htmlのみ**。**server.js／shared/instagramAccountDesign.js／shared/leaderRuleEngine.js／supabase/schema.sql 無変更・新規API/新規DBカラムなし**。

Instagram Account Design Package（IADP）の実AI検証・品質調整（IG-2D）に続き、IADPを既存Output Draft永続化へ正式接続（IG-2E）した（詳細はDecision096）。

**正式ロードマップ（改訂・確定・実装順）**：

```
Phase IG-2D   IADP構造化JSON品質調整 ────────────────── 正式Complete（Code commit ecfed0c）
              openaiClient.jsの実例JSON・厳守事項追加／max_output_tokens 8192化／
              末尾カンマ耐性parse／genreId→genreName逆引き表示
  ↓
Phase IG-2E-1 Output Draft保存 ───────────────────────── 正式Complete（Code commit 0fb943e）
              IADP検証成功時にfields.iadpへ格納・既存pushOutputDraftToServer()を利用
  ↓
Phase IG-2E-2 F5復元・案件切替復元 ───────────────────── 正式Complete（Code commit 0fb943e）
              新設_iadpApplyRestoredFields()がrestoreOutputDraftFromServer()の
              復元結果からIADPカードを自動再表示
  ↓
Phase IG-2E-3 1 Case 1 正本・Cross-case漏れ防止 ──────── 正式Complete（Code commit 0fb943e）
              createOutputDraft()前後でfields.iadpを退避・引き継ぎ
```

**対象**：`_lastOutputDraft.fields.iadp`（新規サブキー・既存`fields`JSONBへ相乗り）／`_iadpApplyRestoredFields()`（新設）／`restoreOutputDraftFromServer()`（呼び出し追加のみ）／`atRunWorkflow()`（carry-forward追加のみ）。既存の読み取り専用IADPカード表示・コピー機能は無変更。

**検証**：既存案件を利用し実AI追加実行なしでブラウザJS経由のダミーIADP注入により保存・F5復元・案件切替・cross-case guard・後方互換をlocalhost・Render本番PCの両方で実測確認（Console Error 0・検証後は原状復帰）。**PC本番確認・iPhone実機確認 完了（ユーザー実施）**。iPhone確認で今回の実装とは独立のKnown Issue 2件（①チャット履歴瞬間消失＝再描画競合の疑い、②iPhone Landscapeレイアウト崩れ＝Responsive対応要）を発見・後続工程へ記録。詳細はDecision096参照。

**次工程**：Known Issue①②の対応、Path B／Content Planning／Carousel Builder／Publishing Readyの実動作回帰確認、IADP実AI生成からの自動保存End-to-End確認を次工程候補として並列に記録する。正式な次工程はユーザー承認後に決定する。共通Leader Rule Engineの入力契約に変更はない（本Phaseとは独立系統）。詳細はdocs/04DECISIONS.md Decision096を参照。

---

## 共通Leader Rule Engine 正式リリース（Phase B-9C〜B-9F統合・2026-08-06・Decision 095）

> 追記日: 2026-08-06。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**。**index.html／openaiClient.js／server.js／shared/leaderRuleEngine.js（新規）**。**DB/schema.sql/API契約は既存互換**。

Decision094の責務正式化に基づき、Leader統合回答プロンプト改善（Phase B-9C）と、事実整理専用の共通Leader Rule Engine新規実装・Path A/Path B/手動Leader再生成3経路接続（Phase B-9D-1〜B-9D-5A）・統合検証（Phase B-9E）を正式リリースした（詳細はDecision095）。

**正式ロードマップ（改訂・確定・実装順）**：

```
Phase B-9A   Leader統合回答 現状調査・設計 ──────────── 完了（2026-08-04）
  ↓
Phase B-9B   Leader統合回答・会社正式回答責務 正式採用 ─ 正式Complete（2026-08-05・Decision094）
  ↓
Phase B-9C   Leader統合回答プロンプト改善 ──────────── 正式Complete（Code commit 92cc49a）
             LEADER_FINAL_PROMPT／leaderSummary()へDecision094の6原則を反映
  ↓
Phase B-9D-1 Rule Engine接続 調査・正式設計 ─────────── 完了（コード変更なし）
             既存3関数（_liCompareArtifacts等）は温存・新規Core別系統を設計
  ↓
Phase B-9D-2 共通Leader Rule Engine Core実装 ────────── 正式Complete（Code commit d194ba1）
             shared/leaderRuleEngine.js新規（UMD・Node/ブラウザ両対応・合成テスト90 PASS）
  ↓
Phase B-9D-3 Path B接続 ─────────────────────────────── 正式Complete（Code commit 0bd3a88）
  ↓
Phase B-9D-4 Path A接続 ─────────────────────────────── 正式Complete（Code commit 756d867）
  ↓
Phase B-9D-5 手動Leader再生成 接続調査 ──────────────── 完了（実装保留・データ品質ギャップを特定）
  ↓
Phase B-9D-5A 手動Leader再生成 ruleArtifacts分離接続 ── 正式Complete（Code commit 22ca87c）
  ↓
Phase B-9E   統合検証（前半：静的53アサーション全PASS／後半：実API3経路検証）── 正式Complete
  ↓
Phase B-9F   正式リリース ───────────────────────────── 正式Complete（本docs・tag・push・Render）
  ↓
（次工程候補・優先順位未確定・特定の1つを自動確定しない・着手はユーザー承認後）
             候補A：意味的重複/矛盾検出の実装検討
             候補B：Evidence比較の実装検討
             候補C：Completion Gate調査・設計
             候補D：Publishing Readyとの接続設計
             候補E：Quality Gate結果のExecutive Decision接続検討
             候補F：Decision Ledger
             候補G：AI社員カード期限表示廃止
```

**対象**：Path A（Auto Task）・Path B（dispatch）・手動Leader再生成のすべてが共通Leader Rule Engineへ正式接続。Rule Engineは事実整理専用でありLeader Final生成前の参考情報作成のみを担当し、Quality Gate/Executive Decision/Constitution Validator/Output Draft/Completion Gate/Publishing Readyのいずれにも直接介入しない。

**次工程**：上記7候補を実装候補として並列に記録する。**ユーザー承認後に着手する**。

**共通Leader Rule Engineの入力契約・出力契約・3経路接続詳細・実API検証結果は`docs/04DECISIONS.md` Decision095を参照**。

---

## Leader統合回答・会社正式回答責務 正式採用（Phase B-9B・2026-08-05・Decision 094・docs正式化のみ）

> 追記日: 2026-08-05。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**。**docsのみ・index.html/openaiClient.js/server.js/lib/DB/schema.sql/API無変更**。

Phase B-9Aの調査結果をもとに、Leader統合回答（Path A `LEADER_FINAL_PROMPT`／Path B `leaderSummary()`が生成する最終回答テキスト）の責務を正式化した（詳細はDecision094）。

**用語分離**：「Leader Summary（ELR表示）」＝Phase B-8までに完成済みの事後表示セクション（`_elrBuildReportHtml()`）と、「Leader統合回答」＝Path A/BがLeaderチャットへ表示する最終回答テキスト（今回の対象）を区別。

**正式ロードマップ（改訂・確定・実装順）**：

```
Phase B-8    Quality Gate Executive Leader Report表示 ─ 正式Complete（2026-08-04・Decision093・維持）
  ↓
Phase B-9A   Leader統合回答 現状調査・設計 ──────────── 完了（2026-08-04）
  ↓
Phase B-9B   Leader統合回答・会社正式回答責務 正式採用 ─ 正式Complete（2026-08-05・Decision094）
             ・用語分離（Leader Summary(ELR表示) と Leader統合回答）
             ・Leader統合回答＝会社として唯一の正式回答
             ・AI社員回答＝社内検討資料（既存表示機能は削除しない）
             ・Leader＝CEO相当の最終統合責任者
             ・要約ではなく統合（重複除去・矛盾解消・Evidence比較・採用/保留/却下判断）
             ・成果物ファースト
             ・情報不足の最終判断はLeaderに帰属
             ・Quality Gate/Completion Gate/Executive Decision/Constitution Validatorとの責務分離
             ・既存Leader Integration Layerを将来Leader Final生成前へ構造化JSONで接続する方針
             ・Path A（サーバー側単一リクエスト完結・介入不可）／Path B（クライアント側制御）の構造差
  ↓
（次工程・実装候補・優先順位確定済み・着手はユーザー承認後）
             Phase B-9C：Leader統合回答プロンプト改善
                          （LEADER_FINAL_PROMPT／leaderSummary()／必要に応じてstrategyConsolidate()）
             Phase B-9D：Rule Engine比較結果のLeader Final生成前接続
                          （重複除去/矛盾検出/Evidence比較/採用/保留/却下候補・Path B先行・Path Aはサーバー側共通ロジック化を再調査）
             Phase B-9E：統合検証
                          （狭い/複合成果物依頼・情報充足/不足依頼・AI社員間一致/矛盾・Reviewer不採用・
                           Path A/B・既存13出力タイプ回帰・API費用・重複除去・不要ブランチ抑制）
             Phase B-9F：正式リリース（docs・commit・Tag・push・Render・PC/iPhone確認）
```

**対象**：Path A（`LEADER_FINAL_PROMPT`）・Path B（`leaderSummary()`）双方のLeader統合回答生成。

**次工程**：Phase B-9C〜B-9Fを実装候補として並列に記録する。**ユーザー承認後に着手する**。

**Leader統合回答の正式責務・用語分離・Gate系との責務分離の詳細は`docs/04DECISIONS.md` Decision094を参照**。

---

## Quality Gate Executive Leader Report表示 正式Complete（Phase B-8A〜B-8D統合・2026-08-04・Decision 093）

> 追記日: 2026-08-04。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**。**index.html（Code commit 04bf9c1）のみ・server.js/lib/DB/schema.sql/API無変更**。

Phase B-7で正式採用したQuality Gate結果（`inbox.qualityGate`）を、Executive Leader Report内へ表示専用のセクションとして追加した（詳細はDecision093）。

**正式ロードマップ（改訂・確定・実装順）**：

```
Phase B-7    Quality Gate ─────────────────────── 正式Complete（2026-08-04・Decision092・維持）
  ↓
Phase B-8    Quality Gate Executive Leader Report表示 ─ 正式Complete（2026-08-04・Decision093）
             B-8A: 調査・設計（ELR生成構造・Constitution Structure Check表示パターン調査・
                    inbox.qualityGateを既存inbox引数から利用する設計を確定・コード変更なし）
             B-8B: 表示実装（_elrBuildQualityGateHtml(qualityGate)新設・
                    _elrBuildReportHtml()へ統合・Quality Gate専用CSS追加・Code commit 04bf9c1）
             B-8C: 3経路実API統合検証（Path A/手動Leader再生成/Path Bの実測確認・
                    Cross-case・F5後消失・ELR重複なし・.leader-summary-block非破壊を実証）
             B-8D: 正式リリース（docs・commit・tag v1.01-quality-gate-report-display・push・
                    Render・PC/iPhone確認）
  ↓
（次工程候補・優先順位未確定・特定の1つを自動確定しない・着手はユーザー承認後）
             候補A：Completion Gate調査・設計
             候補B：Publishing Readyとの接続設計
             候補C：Quality Gate結果のExecutive Decision接続検討
             候補D：Quality Gate監査Version保存（qualityGateVersion等）
             候補E：Decision Ledger
             候補F：AI社員カード期限表示廃止・状態表示化（pending/in_progress/completed/error/skipped）
```

**表示位置**：Executive Summary→Constitution Structure Check→Quality Gate→Leader Summaryの順。**表示対象**：Path A（Auto Task）・手動Leader再生成。**Path Bは完全非表示**（`inbox.qualityGate===null`が正常仕様・Decision092・Decision087を継承）。

**次工程候補**：上記6候補を比較対象として並列に記録する。ユーザー承認後に正式な次工程を決定する。

**Quality Gate表示の入力契約・表示内容・検証詳細は`docs/04DECISIONS.md` Decision093を参照**。

---

## Quality Gate 正式Complete（Phase B-7A〜B-7H統合・2026-08-04・Decision 092）

> 追記日: 2026-08-04。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**。**index.html（Code commit f866d4d／0f104d3／1a92884）のみ・server.js/lib/DB/schema.sql/API無変更**。

Output Package Quality（`packageQuality`）を正本入力・単軸とするQuality Gateを正式採用した（詳細はDecision092）。

**正式ロードマップ（改訂・確定・実装順）**：

```
Phase B-6    Constitution Gate ──────────────── 正式Complete（2026-08-03・Decision091・維持）
  ↓
Phase B-7    Quality Gate ─────────────────────── 正式Complete（2026-08-04・Decision092）
             B-7A〜B-7C: 調査・設計・責務再定義・閾値実データ調査
                          （packageQuality単軸・complete/almost_ready通過基準を正式確定）
             B-7D: 安全リファクタ（buildOutputDraftFromLeaderFinal()へtargetDraft引数追加・
                    Code commit f866d4d）
             B-7E: 評価位置接続（candidate Draft生成→fields構築→packageQuality算出→
                    Quality Gate評価をExecutive Decision実行前へ接続・Code commit 0f104d3）
             B-7F: 実判定実装（evaluateQualityGate(packageQuality)へcomplete/almost_ready
                    通過ロジックを実装・score/threshold未使用・Code commit 1a92884）
             B-7G: 統合検証（合成テスト14/14 PASS・Path A/手動再生成/Path B 3経路実測確認）
             B-7H: 正式リリース（docs・commit・tag v1.01-executive-quality-gate・push・
                    Render・PC/iPhone確認）
  ↓
（次工程候補・優先順位未確定・特定の1つを自動確定しない・着手はユーザー承認後）
             候補A：Completion Gate調査・設計
             候補B：Publishing Readyとの接続設計
             候補C：Quality Gate結果のExecutive Decision接続検討
             候補D：Quality Gate監査Version保存（qualityGateVersion等）
             候補E：Decision Ledger
             候補F：Quality Gate UI／Executive Leader Report表示
             候補G：AI社員カード期限表示廃止・状態表示化（pending/in_progress/completed/error/skipped）
```

**対象経路**：Path A（Auto Task）・手動Leader再生成。**Path Bは正式に対象外**（Output Draft候補生成契約が存在しないため`inbox.qualityGate===null`が正常仕様・Decision087の「Path B＝Output Draft制御対象外」を継承）。

**次工程候補**：上記7候補を比較対象として並列に記録する。ユーザー承認後に正式な次工程を決定する。

**Quality Gateの入力契約詳細・却下案（案A＝観測のみ）・実データ調査結果・実APIテスト詳細は`docs/04DECISIONS.md` Decision092を参照**。

---

## Constitution Gate 正式Complete（Phase B-6A〜B-6D統合・2026-08-03・Decision 091）

> 追記日: 2026-08-03。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**。**index.html（Code commit 9436fec）のみ・server.js/lib/DB/schema.sql/API無変更**。

Constitution Structure Check正式採用（Phase B-5C・正式Complete・維持）で表示のみだったConstitution Validator Coreの検証結果を、Approved Decision Packageの複製可否判定（Path A／手動Leader再生成それぞれの`fields.approvedDecisionPackage`受け渡し条件）へ「狭域Constitution Gate」として接続した（詳細はDecision091）。

**正式ロードマップ（改訂・確定・実装順）**：

```
Phase B-5C   Constitution Structure Check ─────── 正式Complete（2026-08-03・Decision090・維持）
  ↓
Phase B-6    Constitution Gate ─────────────────── 正式Complete（2026-08-03・Decision091）
             B-6A: 調査・設計（広域Gate案・狭域Gate案を比較検討し狭域Gate案を正式採用）
             B-6B: 実装（Path A／手動Leader再生成のfields.approvedDecisionPackage受け渡し条件へ
                    _constitutionValidation存在／decisionId一致／caseId一致／result.passed===true
                    の4条件をAND追加・不成立時はfail-closed・Code commit 9436fec）
             B-6C: 実APIテスト・回帰確認（Auto Task／手動Leader再生成／Path B dispatch成立時の
                    3経路で正常動作・Constitution Structure Check Passed12/12・Console Error 0を確認）
             B-6D: 正式リリース（docs更新・commit・tag v1.01-executive-constitution-gate・push・Render反映）
  ↓
（次工程候補・優先順位未確定・特定の1つを自動確定しない・着手はユーザー承認後）
             候補A：Validator違反時の制御設計
             候補B：Quality Gate調査・設計
             候補C：Completion Gate調査・設計
             候補D：Decision Ledger
             候補E：AI社員カード期限表示廃止・状態表示化（pending/in_progress/completed/error/skipped）
```

**次工程候補**：上記5候補を比較対象として並列に記録する。ユーザー承認後に正式な次工程を決定する。

**Constitution Gateの4条件詳細・却下案（広域Gate案）・実APIテスト詳細は`docs/04DECISIONS.md` Decision091を参照**。

---

## Constitution Structure Check 正式Complete（Phase B-5C-1〜B-5C-3統合・2026-08-03・Decision 090）

> 追記日: 2026-08-03。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**。**index.html（Code commit a2834d3／9e6d094／58315ee）のみ・server.js/lib/DB/schema.sql/API無変更**。

Constitution Validator Core（Phase B-5・正式Complete・維持）の検証結果を、Executive Leader Report内の独立セクション「Constitution Structure Check」として表示し、Auto Task・手動Leader再生成・Path B（dispatch成立時）の完了直後に即時反映される状態まで完成した（詳細はDecision090）。

**正式ロードマップ（改訂・確定・実装順）**：

```
Phase B-5    Constitution Validator Core ──────── 正式Complete（2026-08-03・Decision089・維持）
  ↓
Phase B-5C   Constitution Structure Check ─────── 正式Complete（2026-08-03・Decision090）
             B-5C-1: Decision対応契約（{decisionId, caseId, result}ラッパー・Code commit a2834d3）
             B-5C-2: Executive Leader Report表示（Passed/Violations・rule技術詳細折りたたみ・
                      安全側正規化・状態4軸分離・Code commit 9e6d094）
             B-5C-3: 即時再描画接続（insertBefore化・_elrRefreshInChatArea()限定更新を
                      Path A／手動再生成／Path B dispatch成立時へ接続・Code commit 58315ee）
             実APIテスト：Auto Task1回・手動再生成1回・Path B dispatch1回で即時反映を実測確認
  ↓
（次工程候補・優先順位未確定・特定の1つを自動確定しない・着手はユーザー承認後）
             候補A：Validator違反時の制御設計
             候補B：Quality Gate調査・設計
             候補C：Completion Gate調査・設計
             候補D：Decision Ledger
             候補E：AI社員カード期限表示廃止・状態表示化（pending/in_progress/completed/error/skipped）
```

**次工程候補**：上記5候補を比較対象として並列に記録する。ユーザー承認後に正式な次工程を決定する。

**Constitution Structure Checkの表示仕様詳細・設計判断（チャット全体再構築を採用しなかった理由等）・却下案は`docs/04DECISIONS.md` Decision090を参照**。

---

## Constitution Validator Core 正式Complete（Phase B-5・2026-08-03・Decision 089）

> 追記日: 2026-08-03。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**。**index.html（Code commit ea1ae68）のみ・server.js/lib/DB/schema.sql/API/UI 無変更**。

Approved Decision Package契約構造正式実装（Phase B-4・正式Complete・維持）の次工程Constitution Validatorについて、`validateExecutiveDecision(decision)`をExecutive Decision Engine Core内へ正式実装した（詳細はDecision089）。**今回正式Completeとする範囲は「Constitution Validator Core」（12項目の構造整合性検証・読み取り専用）のみであり、Executive Constitution全14条の完全な意味論的検証ではない**。

**正式ロードマップ（改訂・確定・実装順）**：

```
Phase B-4    Approved Decision Package契約化 ───── 正式Complete（2026-08-03・Decision088・維持）
  ↓
Phase B-5    Constitution Validator Core ──────── 正式Complete（2026-08-03・Decision089）
             validateExecutiveDecision(decision)：12項目の構造整合性検証（読み取り専用・判定のみ）
             検証対象：decisionId／decisionStatus／Executive Summary／Decision Confidence／
                      Approved Package生成条件／sourceDecisionId整合／Cross-case整合／単一判断主体
             呼び出し位置：_edRunDecisionEngine()内_executiveDecision確定直後
             Decision／Package／Output Draft無変更・_constitutionValidationへセッション内保持のみ（F5で消失）
             Path A（atRunWorkflow）・手動再生成（atTriggerLeaderFinal）で実APIテスト済み
             Path Bはdispatch発生時のみ同一経路を通る（既存仕様・無変更）
             【未実装・区別して記録】全14条の完全な意味論的検証／Evidence内容の十分性判定／
             成果物品質・完成度の実質評価／Constitution違反によるOutput停止／
             Validator結果のUI表示／Quality Gate／Completion Gate／Decision Ledger／Executive Memory
  ↓
（次工程候補・優先順位未確定・特定の1つを自動確定しない・着手はユーザー承認後）
             候補A：Validator結果のExecutive Leader Report表示
             候補B：Validator違反時の制御設計
             候補C：Quality Gate調査・設計
             候補D：Completion Gate調査・設計
             候補E：Decision Ledger
             候補F：AI社員カード期限表示廃止・状態表示化（pending/in_progress/completed/error/skipped）
```

**次工程候補**：上記6候補を比較対象として並列に記録する。ユーザー承認後に正式な次工程を決定する。

**Constitution Validator Coreの正式条文適用範囲・検証項目詳細・却下案・Path別接続確認の詳細は`docs/04DECISIONS.md` Decision089を参照**。

---

## Approved Decision Package 契約構造正式実装・統合検証正式Complete（Phase B-4A〜B-4E・2026-08-03・Decision 088）

> 追記日: 2026-08-03。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**。**index.html（Code commit 718f200／67ab6cb／95beda3／65fe551／b423acd）のみ・server.js/lib/DB/schema.sql/API/UI 無変更**。

Executive Leader Report表示（Phase B-3・正式Complete・維持）の次工程Approved Decision Packageについて、契約構造（decisionId常時発行・sourceDecisionId参照・独自ID廃止）をPhase B-4A、Path A接続をPhase B-4B、手動Leader再生成接続をPhase B-4C、`fields.approvedDecisionPackage`複製保存・F5復元・後方互換をPhase B-4Dとして段階実装し、Phase B-4Eで統合検証・正式完了判定を行った（詳細はDecision088）。

**正式ロードマップ（改訂・確定・実装順）**：

```
Phase B-3    Executive Leader Report表示 ─────────── 正式Complete（維持）
  ↓
Phase B-4    Approved Decision Package契約化 ───── 正式Complete（2026-08-03・Decision088）
             decisionId常時発行（_edRunDecisionEngine()冒頭）
             Package契約: sourceDecisionIdのみで元Decisionを参照・独自ID廃止
             Path A（atRunWorkflow）／手動再生成（atTriggerLeaderFinal）双方から取得・三重一致確認
             fields.approvedDecisionPackage複製保存・F5復元・旧Draft後方互換
             正本＝Executive Decision Engine／Output Draft側は複製（利用者）
  ↓
Phase B-5    Constitution Validator ───────────── 未着手
             warning／block／critical・状態降格・安全停止
             Quality Gate／Completion Gate強制
```

**次工程候補**：Phase B-5 Constitution Validator（未着手・ユーザー承認なしに開始しない）。

---

## Executive Decision Control 正式工程分割（Phase B-2A／B-2B・2026-08-02・Decision 087）

> 追記日: 2026-08-02。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**。**docs正式化のみ・コード/DB/API変更なし**。

Executive Decision Engine Core（Phase B-1・正式Complete・維持）の次工程Executive Decision Control（当初Phase B-2）について、因果接続方式を正式調査した結果、Path A通常フロー・Path A手動再生成・Path B通常チャットが構造的に異なることを実測確認し、単一工程での一括実装を避け正式に分割した（詳細はDecision087）。

**構造的制約（実測）**：Path A（`atRunWorkflow()`）が呼ぶ`/api/auto-task`は、AI社員実行→Reviewer→Strategy統合→`runLeaderFinalResponse()`（完成成果物生成）までを単一の非同期関数（`runAutoTaskWorkflow()`）内・単一のHTTPリクエスト/レスポンス往復の中で完結させる。**クライアント側のExecutive Decision Engineは、Leader Final生成前のデータへ介入する経路を持たない**。この制約に基づき、Leader Final候補生成後・Output Draft確定前にEDEを接続する段階導入方式（案D）を正式採用した。

**正式ロードマップ（改訂・確定・実装順）**：

```
Phase B-1    Executive Decision Engine Core ──────── 正式Complete（維持・2026-08-02）
  ↓
Phase B-2A   Executive Decision Control ─────────── 未着手
             Path A Causal Position
             対象: atRunWorkflow()（Path A通常フローのみ）
             Leader Final Candidate入力契約の確立（sourceEngine:'runLeaderFinalResponse'）
             EDE実行位置をbuildOutputDraftFromLeaderFinal()より前へ移動
             既存Output Draft挙動・POST回数（1回）は完全無変更
             decisionStatusはまだOutput Draftへ保存しない
  ↓
Phase B-2B   Manual Leader Regeneration Alignment ── 未着手
             対象: atTriggerLeaderFinal()
             leaderSummary()とrunLeaderFinalResponse()の責務差の整合化
             _wlLastResults陳腐化判定・data.replyとの対応付け
             noCompletedResults判定欠落の対応
             Phase B-2A完了後に開始（同時実装しない）
  ↓
Phase B-3    Executive Leader Report表示 ─────────── 未着手（旧Phase B-2相当）
             Executive Summary／Leader Summary／社員分析折りたたみ
             既存完成成果物（Leader Final・Output Engine）と併存
  ↓
Phase B-4    Approved Decision Package契約化 ───── 正式Complete（2026-08-03・Decision088）
             decisionId常時発行・Package契約(sourceDecisionId)確定
             Path A／手動再生成接続・fields複製保存・F5復元・後方互換
  ↓
Phase B-5    Constitution Validator ───────────── 未着手（旧Phase B-4相当）
             warning／block／critical・状態降格・安全停止
             Quality Gate／Completion Gate強制
  ↓
Phase A-2    AI社員間再依頼（Employee Rework Request） ── 未着手
  ↓
Phase A-3    成果物受け渡し（Artifact Handoff） ──── 未着手
  ↓
Phase A-4    Quality Loop（品質ループ・上限付き） ── 未着手
  ↓
Phase C-1    Decision Ledger永続化（executive_decisions） ── 未着手
  ↓
Phase C-2    Output Engine Knowledge Base化 ────── 未着手
  ↓
Phase C-3    Learning Center／Outcome Record永続化 ── 未着手
  ↓
Phase D-safety  自律実行安全ゲート ──────────────── 未着手
  ↓
Phase D      自律Workflow ─────────────────────── 未着手
  ↓
Phase E      毎日自律実行 ──────────────────────── 未着手
  ↓
Phase F-1    Self Improvement Intelligence（Version2 Core⑦層と共通） ── 未着手
  ↓
Phase F-2    Executive Memory ──────────────────── 未着手
```

**Path B通常チャットの扱い**：`handleLeaderDispatch()`〜`triggerStrategyConsolidate()`〜`triggerLeaderSummary()`の経路にはOutput Draft生成が存在しないため（`buildOutputDraftFromLeaderFinal()`／`createOutputDraft()`の呼び出しなし・全文検索で確認済み）、**Phase B-2A／B-2BのOutput Draft制御対象には含めない**。Path Bでは引き続きLeader Inbox生成・Executive Decision Engine実行（`decisionStatus`／Decision Confidence／Strategic Alternatives／Executive Summary内部生成）を許可するが、Output Draft制御・Approved Decision Package接続は行わない。

**Approved暫定条件（Gate未定義期間の第三の移行方式）**：completed成果なし→insufficient、completed成果あり→hold、**Quality Gate・Completion Gate未定義の間はdecisionStatusをapprovedへ到達させない**。Auto Task自体・既存Leader Final・既存Output Draftは従来どおり継続する。

**旧ロードマップとの関係**：本セクション直下に残る「Executive Constitution ＆ Executive Decision Engine」セクション（Decision086）記載の旧ロードマップ（B-1→B-2→B-3→B-4）は**削除せず保持**する。本Decision087により、**旧B-2はB-2A（因果位置確立）とB-2B（手動再生成整合化）へ分割**、**旧B-3はB-3（Executive Leader Report・番号維持）**、**旧B-3後段の内容はB-4（Approved Decision Package）**、**旧B-4はB-5（Constitution Validator）**として再配置されたものが正式ロードマップとなる。

**Executive Constitution正式条文・Decision Confidence方針・Strategic Alternatives方針・Approved Decision Package方針・Leader Final Candidate内部契約・sourceEngine分離の詳細は`docs/04DECISIONS.md` Decision087を参照**。

**Phase B-2A以降は未着手**。着手前に必ずユーザー確認を取る（本Roadmapへの追記のみでは着手権限としない）。

---

## Executive Constitution ＆ Executive Decision Engine — 正式設計・ロードマップ改訂（Phase A-1g・2026-08-02・Decision 086）

> 追記日: 2026-08-02。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**。**docs正式化のみ・コード/DB/API変更なし**。

Leader Integration Layer Phase A（Decision084・085・正式Complete維持）の次工程着手前に、AI COMPANY全体の上位アーキテクチャを正式設計した（詳細はDecision086）。**Executive Constitution v1.0.0**（全14条・AI COMPANY全体の最高位ルール）と、**Executive Decision Engine**（Leader Integration Layerの`_leaderIntegration`を因果連鎖内へ昇格させる会社判断層）を正式採用。今回は設計・docs正式化のみで実装は未着手。

**重要な現在地**：`_leaderIntegration`は現時点では成果物確定「後」に情報を収集する観測・構造化層であり、Leader Final生成・Output Draft確定・Output Engine入力の判断にはまだ接続されていない。これはPhase Aの未完成を意味しない。Phase Aは回収・構造化・候補判定までを責務として正式Completeしている。判断結果を因果連鎖へ接続する責務はPhase B-1（Executive Decision Engine Core）とする。

**正式ロードマップ（改訂・確定・実装順）**：

```
Phase A      Leader Integration Layer ──────────── 正式Complete（2026-08-01・維持）
  ↓
Phase A-1g   Executive Constitution v1.0.0正式化 ── docsのみ（2026-08-02・Decision086・本更新）
  ↓
Phase B-1    Executive Decision Engine Core ────── 未着手
             Leader Integration Layerを因果連鎖内へ昇格
             decisionStatus／Decision Confidence／Strategic Alternatives
             保存はメモリのみ・表示なし
  ↓
Phase B-2    Executive Leader Report表示 ───────── 未着手
             Executive Summary／Leader Summary／社員分析折りたたみ
             既存完成成果物（Leader Final・Output Engine）と併存
  ↓
Phase B-3    Approved Decision Package契約化 ───── 未着手
             Output Engine接続・後方互換必須
  ↓
Phase B-4    Constitution Validator ───────────── 未着手
             warning／block／critical・状態降格・安全停止
  ↓
Phase A-2    AI社員間再依頼（Employee Rework Request） ── 未着手（EDEのconflict/holdを起点に順序変更）
  ↓
Phase A-3    成果物受け渡し（Artifact Handoff） ──── 未着手
  ↓
Phase A-4    Quality Loop（品質ループ・上限付き） ── 未着手
  ↓
Phase C-1    Decision Ledger永続化（executive_decisions） ── 未着手
  ↓
Phase C-2    Output Engine Knowledge Base化 ────── 未着手
  ↓
Phase C-3    Learning Center／Outcome Record永続化 ── 未着手
  ↓
Phase D-safety  自律実行安全ゲート ──────────────── 未着手
  ↓
Phase D      自律Workflow ─────────────────────── 未着手
  ↓
Phase E      毎日自律実行 ──────────────────────── 未着手
  ↓
Phase F-1    Self Improvement Intelligence（Version2 Core⑦層と共通） ── 未着手
  ↓
Phase F-2    Executive Memory ──────────────────── 未着手
             （着手条件：Decision Ledger永続化済み・Learning Center永続化済み・
              Outcome Record存在・Instagram実運用データ存在・Self Improvement利用可能）
```

**旧ロードマップとの関係**：本セクション直下に残る「AI COMPANY Leader Experience — Leader Integration Layer（Phase A完了・2026-07-31・Decision 084）」記載の旧ロードマップ（Phase A→A-2→A-3→A-4→B→C→D-safety→D→E→F）は**削除せず保持**する。本Decision086により、**Phase A-2〜A-4はPhase B-1〜B-4完了後へ順序変更**（内容・責務は無変更）、**Phase BはB-1〜B-4へ4分割**、**Phase CはC-1〜C-3へ分割**、**Phase FはF-1〜F-2へ分割**したものが正式ロードマップとなる。

**Executive Constitution正式条文（全14条）・Executive Decision Engine正式責務／非責務・Decision Confidence方針・Strategic Alternatives方針・Approved Decision Package方針・保存方式（段階導入案D）の詳細は`docs/04DECISIONS.md` Decision086を参照**。

**Phase A-2以降・Phase B-1以降は未着手**。着手前に必ずユーザー確認を取る（本Roadmapへの追記のみでは着手権限としない）。

---

## AI COMPANY Leader Experience — Leader Integration Layer（Phase A完了・2026-07-31・Decision 084）

> 追記日: 2026-07-31。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**。

Leaderを「各AI社員の回答を要約する司会者」から「成果物を回収・比較・矛盾候補検出・採否候補判定する統合管理層」へ進化させるLeader Experience再設計に着手し、**Phase A（Leader Integration Layer）を正式リリースComplete**。Path A（Auto Task）／Path B（Leader手動チャット）共通の回収・比較・矛盾候補・採否候補構造化を実現し、実装検証中に発見した既存の案件混入不具合も同一リリースでHotfix。詳細はDecision 084・01PROJECT_STATUS・02PHASE_PROGRESS・06HANDOVER_NEXT_CHATを参照。

**正式ロードマップ（確定・実装順）**：

```
Phase A   Leader Integration Layer ── Complete（2026-07-31）
  ↓
Phase A-2 AI社員間再依頼（Employee Rework Request） ── 未着手
  ↓
Phase A-3 成果物受け渡し（Artifact Handoff・workflowContext汎用化） ── 未着手
  ↓
Phase A-4 Quality Loop（品質ループ・上限付き） ── 未着手
  ↓
Phase B   Leader成果物表示（Deliverable Card・Progress UI・Knowledge Summary） ── 未着手
  ↓
Phase C   Output Engine Knowledge Base化 ── 未着手
  ↓
Phase D-safety  自律実行安全ゲート ── 未着手
  ↓
Phase D   自律Workflow ── 未着手
  ↓
Phase E   毎日自律実行 ── 未着手
  ↓
Phase F   Self Improvement Intelligence（実運用データ後・Version2 Core⑦層と共通） ── 未着手
```

**Phase A完了内容**：
- `_liCollectIntegration()`を共通オーケストレーションとし、Path A Adapter（`_wlLastResults`ソース）・Path B Adapter（`interactionId`＋`_liPathBSession`）で差異吸収。保存はクライアント一時メモリ（`_leaderIntegration`）のみ・新DB/新API/追加AI実行なし。
- 比較・矛盾候補検出はルールベースのみ・矛盾は必ず`candidate`。採否候補は情報不足時`hold`が既定値（Reviewer未実行を合格扱いにしない）。
- **案件混入Hotfix**：`atTriggerLeaderFinal()`（手動Leader Final再生成）冒頭に厳格caseId一致ガードを追加し、既存のOutput Draft復元保護ロジックとの相互作用による案件混入事故を防止。

**Phase A-2以降は未着手**。着手前に必ずユーザー確認を取る（本Roadmapへの追記のみでは着手権限としない）。

---

## 社員向上B 正式完了 → Instagram自動運営へ優先移行（2026-07-21・push前・Render未反映）

> 追記日: 2026-07-21。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**。

改善案件「社員向上B」（定義駆動基盤）を**正式完了**（13型中11型移行済み・**Flyer/LP 正式保留**・詳細はDecision 068／01PROJECT_STATUS／02PHASE_PROGRESS）。現時点は**localhost検証完了・push前・Render未反映**。

**今後の正式な開発優先順位**：
1. 社員向上B 正式完了（本記録）
2. 未push 7コミットとTagのpush（ユーザー承認後）
3. Render反映・本番確認（ユーザー承認後）
4. **Instagram自動運営機能**の開発開始（市場調査／競合分析／ASP比較／商品選定／投稿企画／カルーセル／キャプション／ハッシュタグ／Learning／投稿承認）
5. Instagram収益化開始
6. **Flyer・LPは必要時に個別工程として再評価**（未完了・失敗ではなく優先順位判断による保留）

---

## Version1 完成（Phase52-2 記録）

**Version1 = 完成**。Instagram収益化パイプラインの全工程を実装完了（Phase50-2〜52-1・すべてindex.htmlへ追加のみ・Manual Only・Instagram API/自動投稿/画像生成/課金なし）。

```
市場分析 → 企画 → カルーセル生成 → デザイン設計 → レビュー → 承認
  → 投稿準備 → 手動投稿 → Learning → Asset Library候補生成 → 完成
```

対応機能: Instagram Marketing Intelligence（50-1）/ Content Planning（50-2）/ Carousel Builder（50-3）/ Design System（50-4）/ Mobile Review Center（50-5）/ Mobile Approval（50-6）/ Publishing Ready Center（50-7）/ Instagram Learning Center（51-1）/ Creative Asset Library Save Center（52-1）。

---

## Version1 Final Complete（Phase52-10 記録・Decision 044）

**Version1 = Final Complete**（v1.00-phase52-10・最新コミット f177fd2）。機能完成に加え、Mobile UI（52-5）/ Mobile Touch Hotfix（52-6）/ Mobile Topbar（52-8/52-9/52-9b）を本番反映し、iPhone Safari実機確認（縦向き・横向きともTopbar 1本横スクロール・全ボタン操作可能・入力/送信可能・横はみ出しなし・PC不変）まで完了。**運用可能な完成版**として正式完成。Manual Only維持。

---

## Version1.01 Realtime Sync Edition（Version2着手前に優先・Decision 045）

**目的**: PC / iPhone どちらから利用しても **同じAI会社になること**。

**実装予定（すべてSupabaseを利用し、PCとスマホが同一状態になることを目的とする）**:
- Task同期
- Conversation同期
- Timeline同期
- Notification同期
- Workflow Live同期
- Cost同期
- Learning同期
- Approval同期
- Auto Task同期
- Status同期

**Version2開始条件**: Version2 Affiliate Intelligence は **Version1.01 Realtime Sync Edition 完成後に開始する**。Version2着手前にRealtime同期を優先する。Phase53開始前には必ずユーザー確認を取る。

**進捗（Conversation同期・案件管理系）**:
- Phase52-11〜11.9: Conversation Sync／案件メタデータSupabase同期
- Phase52-11.8〜12.0a: 案件管理UI／ホーム案件一覧・タブ・入力無効化
- Phase52-12.1〜12.1b: 案件削除Supabase同期／選択削除UI／F5・ログイン直後のホーム再描画修正
- **Phase52-12.2: `messages.case_id`（nullable・FKなし）追加＝案件別チャットの端末間分離**（commit aabf46c・push済み・Render反映済み・Decision 046）。既存messagesはNULL維持・非破壊
- **Phase53先行開始をB案運用判断で承認（Decision 047）**: Conversation / Case / Messages 中核同期完了をもってPhase53を先行開始。**残同期（Task/Cost/Status/Auto Task 自動更新poll・Learning一部in-memory整理・Approval端末間同期）は未完了として別Phase扱い**（Approval端末間同期はserver.js/DB/API検討要・独立Phase）
- **Phase54-1 Approval Sync（独立Phase・Decision 048）**: 承認/公開状態のPC⇔スマホ同期。**54-1a 設計（A案・case_idスコープ・最小サブセット）承認済み → 54-1b サーバー側 ✅ Complete**（commit d9310d0・push済み・Render反映済み・新規テーブル `output_approvals`〔FKなし〕＋`lib/approvalsDb.js`＋server.js `GET/POST /api/approvals`・index.html非接触）→ **54-1c クライアント配線 ✅ Complete**（commit 4f53dd5・tag v1.01-phase54-1c・**push未実施/未Push 1**・index.htmlのみ+135行・既存API利用でserver.js/DB/API変更なし・Phase53/cost非接触。case_id単位・updated_atが新しい方採用・編集中3000msガード・取消/公開取消は空状態POST・通信失敗は既存UI維持）。**Approval Sync Client 完成＝承認/公開のPC⇔スマホ同期に対応**（実機ラウンドトリップはpush/Render反映後に確認）→ **54-1d キャッシュ修正 ✅ Complete**（commit 43513cc・tag v1.01-phase54-1d・push済み。Mobile Review承認後に Mobile Approval の canApprove を追従。index.htmlのみ）→ **54-1e 状態リセット ✅ Complete**（commit 06d07d5・tag v1.01-phase54-1e・push済み。新規案件/案件切替/新成果物生成で承認状態を未承認へリセット＝成果物単位で未承認から開始。index.htmlのみ）→ **54-1f Approval Output Binding ✅ Complete**（commit 9fd25a0・tag v1.01-phase54-1f・**push未実施/未Push 1**。`output_approvals` に nullable `output_id` を追加し、現在成果物と一致する場合だけ復元＝別成果物への誤復元防止。index.html/lib/server.js/schema.sql の4ファイル・案件Approval行は1案件1行維持・**複数成果物履歴保存ではない**）。**残課題**: Approval POST着順逆転（別Phase候補 Approval POST Ordering / Last Action Wins）・Output Draft未永続（別Phase候補 Output Draft Persistence）。残る Task/Cost/Status/Auto Task poll・Learning in-memory整理 は引き続き別Phase

---

## Version2 予定

---

## 【Version2 Core 全体設計（正式版・Decision 043）】

> 追記日: 2026-07-05（Version2全体設計の正式反映・Decision 043）
> Version2のテーマ: **Instagram Affiliate Intelligence Company**（Instagramで何を売れば利益が最大になるかをAI会社全体が判断できる会社）。
> 本セクションはVersion2の最上位設計であり、下記「Version2 開発順（Phase53〜57）」を包含・拡張する（既存記述は削除せず、本Core設計で正式に体系化する）。
> **開始条件（Decision 045）**: Version2は Version1.01 Realtime Sync Edition 完成後に開始する。着手前にRealtime同期を優先し、Phase53開始前に必ずユーザー確認を取る。

### Version2の目的（経営判断まで行うAI会社）

Version2は「Affiliate Intelligence → ASP分析 → 案件分析」で止まらず、AI会社全体が
**「利益を最大化する経営判断」**まで行う会社へ進化させる。

最終形は、Leaderへ

> 「今一番利益が出る案件は？」

と聞くだけで、AI会社全体が

```
市場分析 → 案件分析 → ASP分析 → 利益分析 → 競合分析 → Instagram企画 → Learning → 改善
```

まで一気通貫で判断できる会社を目指す。

### Version2 Core: Affiliate Intelligence Core（7層Intelligenceパイプライン）

Version2の中核は **Affiliate Intelligence Core** とし、以下の7つのIntelligence層を上から下へ連鎖させる。

```
Affiliate Intelligence Core
  ↓
① Market Opportunity Intelligence  （今どの市場を狙うべきか）
  ↓
② Product Intelligence             （何を売るべきか）
  ↓
③ ASP Intelligence                 （どのASPを使うべきか）
  ↓
④ Competition Intelligence         （競合分析）
  ↓
⑤ Revenue Intelligence             （利益・将来性分析）
  ↓
⑥ Content Intelligence             （Instagramで勝てる投稿企画）
  ↓
⑦ Self Improvement Intelligence    （実績から自動改善）
```

各層の責務:

| 層 | 名称 | 責務 |
|----|------|------|
| ① | Market Opportunity Intelligence | 今狙うべき市場・ジャンルの機会を判断（需要・季節性・伸び）|
| ② | Product Intelligence | その市場で何を売るべきか（商品・案件カテゴリ選定）|
| ③ | ASP Intelligence | どのASPを使うべきか（A8/もしも/afb/アクセストレード/バリューコマース/楽天/Amazon 比較）|
| ④ | Competition Intelligence | 競合数・競合の強さ・参入余地の分析 |
| ⑤ | Revenue Intelligence | 利益率・承認率・EPC・CVR・案件寿命・想定売上・想定利益・将来性 |
| ⑥ | Content Intelligence | Instagramで勝てる投稿企画（保存率予測・クリック率予測・構成）※既存Instagramパイプラインと連携 |
| ⑦ | Self Improvement Intelligence | 実績（保存率/クリック率/フォロー率/CV/売上）から勝ちパターンを学習し自動改善 |

### AI会社が最終的に判断できる16項目（Version2到達目標）

1. 今売るべき市場
2. 今売るべき商品
3. どのASPを使うべきか
4. 利益率
5. 承認率
6. EPC
7. CVR
8. Instagramとの相性
9. 競合数
10. 案件寿命
11. 季節性
12. 保存率予測
13. クリック率予測
14. 想定売上
15. 想定利益
16. おすすめ順位

これら16項目を統合し、**「おすすめ順位」付きの利益ランキング**として出力できることをVersion2の到達目標とする。

### AI Gateway 正式構成（Version2以降の実行レイヤー）

以前から設計しているAI Gateway（Phase49-1で判断層として実装済み）を、Version2の正式な実行選択レイヤーとして構成へ組み込む。

```
Leader
  ↓
Affiliate Intelligence（7層Intelligence Core）
  ↓
AI Gateway  ← 「最も低コストで最適な実行方法を自動選択するレイヤー」
  ↓
┌──────────┬──────────┬────────────────────┬────────────────┬──────────┐
OpenAI     Claude     Browser Automation   PC Automation    将来API
```

AI Gatewayの役割:
- 各Intelligence層が必要とする実行（分析・生成・データ取得）に対し、**最も低コストで最適な実行方法を自動選択**する
- 実行経路の候補: OpenAI / Claude / Browser Automation / PC Automation / 将来API

**安全設計（既存Decision 028・030・031を継承・変更しない）**:
- AI Gatewayは引き続き**判断・ルーティング層**であり、Browser Automation / PC Automation / API 等の実行系は**ユーザー承認 + 安全ゲート（`isAIGatewayExecutionAllowed()`）を通過して初めて実行される**
- 既存Provider構成（Leader=OpenAI固定 / Writer・Reviewer・Strategy=Claude固定）は一切変更しない。AI GatewayはVersion2新規ドメイン専用の抽象化層
- 課金・外部API契約・自動投稿・Instagram API接続は引き続きユーザー承認制（承認をバイパスする層ではない）

### Version2 Core 推奨Phase構成（Decision 043・Phase53起点を維持）

Affiliate Intelligence最優先（Decision 042）を維持したまま、7層Intelligence + AI Gateway v2を以下のPhaseへ配分する。**すべて`index.html`追加のみ・既存関数は読み取り専用参照・予測ヒューリスティック＋手動入力・Safetyバッジ固定・実API/課金なし**（Phase50-1 Decision 040の設計思想を踏襲）。

> ⚠️ **【番号整合の注記・Decision 053】** 本表の「Phase54（Market Opportunity Intelligence）」は**旧Version2計画（superseded）**であり、**現在の実開発 Phase54-1〜54-3（Version1.1 Connected AI Company / Realtime Sync系）とは別物**である。旧定義は履歴として保持し、削除・置換しない。**Version2側のPhase番号は着手前に `V2-Pxx` もしくは Phase60番台以降へ再採番**する。実開発の現在地は docs/01・02・DECISIONS(053) を正とする。

| Phase | 内容 | 対応層 |
|-------|------|--------|
| **Phase53 ✅ Complete** | **Affiliate Intelligence Core**（16判断項目の器・案件データ構造・統合スコア・利益ランキング基盤）**／commit bcfba7d・push済み・Render反映済み・index.htmlのみ+380行・DB/server.js/API/Supabase/課金なし** | Core |
| Phase54 | Market Opportunity Intelligence | ① |
| Phase55 | Product Intelligence | ② |
| Phase56 | ASP Intelligence（Multi ASP Compare含む）| ③ |
| Phase57 | Competition Intelligence | ④ |
| Phase58 | Revenue Intelligence（利益率/承認率/EPC/CVR/案件寿命/想定売上・利益/将来性）| ⑤ |
| Phase59 | Content Intelligence（保存率予測/クリック率予測・既存Instagramパイプライン連携）| ⑥ |
| Phase60 | Self Improvement Intelligence（実績Learning→勝ちパターン→自動改善）| ⑦ |
| Phase61 | AI Gateway v2（低コスト最適経路の自動選択・実行は承認ゲート維持）| Gateway |
| Phase62 | Leader Integration（「今一番利益が出る案件は？」で全層を統合実行）| 統合 |

（注: 既存の「Version2 開発順（Phase53〜57）」の Multi ASP Compare / Trend Intelligence / Revenue Optimization / AI Campaign Planner は、本Core設計の各Intelligence層へ統合・再配置する。Phase番号は実装着手時に最終確定する。）

---

### Version2 開発順（Phase53〜57・Affiliate Intelligence最優先・Decision 042）

#### Phase53 Affiliate Intelligence（Version2最優先・中核機能）

Instagram収益化AI会社の中核機能。複数ASPを比較し、以下をAI会社が分析する：
- 利益率
- Instagram適性
- 競合
- 季節性
- 承認率
- 投稿ネタ数
- 収益期待値

対象ASP: A8.net / もしもアフィリエイト / afb / アクセストレード / バリューコマース / 楽天アフィリエイト / Amazonアソシエイト。

#### Phase54 Multi ASP Compare

複数ASP横断比較（同一案件のASP間条件比較・最適ASP選定）。

#### Phase55 Trend Intelligence

トレンド・季節性・需要予測の高度化。

#### Phase56 Revenue Optimization

収益最適化（案件×投稿×時期の最適配分）。

#### Phase57 AI Campaign Planner

キャンペーン自動企画（月次/シーズン単位の投稿・案件計画）。

### Version2 その他予定

- Asset Library 実保存（表示のみ → 実DB保存へ移行）
- Learning 永続化（メモリ → JSON/DB）
- Instagram分析 高度化
- TikTok 展開
- YouTube Shorts 展開
- LP 連携
- AI 自動改善

（Version2着手前に、まずVersion1の実運用＝実際のInstagram投稿を開始する。詳細は docs/06HANDOVER_NEXT_CHAT.md「運用フェーズ」参照）

---

## Version 1.0

完成目標（旧・Phase48-5完了時点で達成済み）

AI会社として

- OpenAI
- Claude
- Knowledge
- Learning
- Compare
- Workflow
- Output Engine

を完成させる。

---

## Version1 最優先ゴール（Instagram収益化支援・Decision 039）

AI会社の最終目的は「AI会社を作ること」ではなく、**AI会社自身が収益を生みながら成長すること**である。

Version1の最優先目的をInstagram収益化支援へ変更する。AI会社はInstagram運用を最初の実運用対象とする。

### 5分パイプライン（Version1完成条件）

以下を5分以内で完了できることをVersion1の完成条件とする。

```
市場調査
  ↓
テーマ決定
  ↓
保存率が高い構成提案
  ↓
スライド構成
  ↓
画像プロンプト
  ↓
動画プロンプト
  ↓
投稿文
  ↓
CTA
  ↓
ハッシュタグ
  ↓
Creative Assembly
  ↓
Asset Library保存
```

画像生成・動画生成・実際の投稿はVersion1では**Manual Only**（ユーザー承認後の手動実行のみ）を維持する。

### 毎日の運用ループ（Version1完成後に開始）

```
毎朝: 「今日バズりそうなテーマ」をAI会社が複数提案
  ↓
ユーザーが1つ選択
  ↓
Instagram投稿一式が完成（構成/画像プロンプト/動画プロンプト/投稿文/CTA/ハッシュタグ）
  ↓
画像生成（手動）
  ↓
投稿（手動）
  ↓
結果分析
  ↓
Learning
  ↓
Asset Library保存
  ↓
次回改善
```

### Version1完成基準（変更後）

Version1完成 = **Instagramを毎日運用できること**。AI会社が短時間でInstagram投稿一式を毎日生成でき、実際の運用を開始できる状態を正式なVersion1リリース条件とする。

---

## 残フェーズ

### Phase48-4 ✅ 完了

Output Preview Engine

- Instagram
- LP
- PDF
- HTML
- チラシ
- YouTube
- TikTok

成果物を完成イメージで画面表示

---

### Phase48-5 ✅ 完了

Publishing Engine

SNS投稿データ生成

- タイトル
- 説明文
- ハッシュタグ
- 投稿時間
- 画像一覧
- 動画一覧
- CTA

---

## Version 2.0 Roadmap（Phase49-0.1で正式化 / Decision 027）

責務分離のため、Phase49〜54を6ファミリーへ再編する。旧Phase49-1「Instagram Intelligence」はPhase50-2「Platform Intelligence」へ統合し、旧Phase50-1「Image Prompt Intelligence」はPhase49-2へ移動した（Creative系プロンプト最適化をPhase49ファミリー内へ統一するため）。

### Creative Engine ファミリー

#### Phase49-0.1

Version2 Roadmap Formalization

Phase49-0（設計レビュー）の内容をdocsへ正式反映する。コード実装は行わない。

---

#### Phase49-1

AI Gateway Foundation

API / PCアプリ操作 / ブラウザ操作を将来選択できる中継層の設計・骨格。

今回は実行連携ではなく設計と安全ゲートを優先する。既存Provider構成（Leader=OpenAI / Writer・Reviewer・Strategy=Claude）には影響させない。

---

#### Phase49-2

Image Prompt Intelligence

GPT Image / Midjourney / Flux / Ideogram / Recraft / ChatGPT画像生成などに対応した画像プロンプト最適化。

生成実行はしない（旧Phase50-1から移動）。

---

#### Phase49-3

Video Prompt Intelligence

Seedance / Flow / Veo / Kling / Runway / Luma / Pika / Hailuo / DOMOAI などに対応した動画プロンプト最適化。

生成実行はしない。

---

#### Phase49-4

Creative Engine Execution

画像生成・動画生成・広告生成の実行本体。

ユーザー承認後のみ。AI Gateway経由。

---

#### Phase49-5

Creative Ad Assembly

ロゴ / バナー / Instagramカルーセル / ショート動画 / 広告素材の組み立て。

Output / Preview / Publishing と連携。

---

#### Phase49-6

Asset Library

生成資産・既存成果物を保存、検索、再利用する資産管理。

画像 / 動画 / LP / PDF / HTML / チラシ / Instagram / プロンプト / Quality / Compare結果を対象候補とする。Knowledge Libraryとは別物（Decision 029）。

---

### Intelligence ファミリー（Instagram Marketing Intelligenceを最優先へ格上げ・Decision 039）

Creative Engine完了後はCompany Brainより先にInstagram Marketing Intelligenceを優先する。Instagram実運用を開始し、Learningを蓄積しながらVersion1を完成させる。

旧Phase50-1「Marketing Intelligence Foundation」（汎用市場分析/SEO分析）と旧Phase50-2「Platform Intelligence」（Instagram中心のプラットフォーム分析）の優先順位を入れ替え、Instagram特化の分析をPhase50-1へ格上げする。

#### Phase50-1

Instagram Marketing Intelligence（旧Phase50-2 Platform Intelligenceを改称・最優先へ格上げ）

Instagram運用に直結する分析を最優先で実装する：
- 保存率分析
- リーチ分析
- プロフィール遷移分析
- フォロー率分析
- CTA分析
- ハッシュタグ分析
- 投稿時間分析
- カルーセル分析
- リール分析
- 競合分析
- トレンド分析

旧Instagram Intelligence（旧Phase49-1）・旧Platform Intelligence（旧Phase50-2）はここへ統合。TikTok / YouTubeの分析は本Phase完了後に拡張する。

本Phase完了後、Creative Asset Library（Phase49-6）を拡張し、投稿/スライド/画像プロンプト/動画プロンプト/CTA/Headline/Caption/Assetに加え、保存率/クリック率/フォロー率/CVなどの実運用結果を蓄積する「勝ちパターン学習」機能を追加する（新規Phase番号は今後決定）。

---

#### Phase50-2

AB Test & Buzz Analysis（旧Phase50-3・順序維持）

LP分析 / 広告分析 / ABテスト提案 / バズ要因分析。Instagram運用データを主対象とする。

---

#### Phase50-3

Marketing Intelligence Foundation（旧Phase50-1・汎用マーケティングへ後回し）

市場分析 / 競合分析 / SEO分析 / トレンド分析（汎用・プラットフォーム非依存）。

Instagram Marketing Intelligence（Phase50-1）完成後に拡張する。

---

### Sales ファミリー

#### Phase51-1

Sales Document Engine

見積書 / 提案書 / 契約書 / 営業資料。

既存Output EngineのPDF/Documentパイプラインを拡張し、新規エンジン乱立は避ける。

---

#### Phase51-2

Presentation Engine

プレゼン資料生成。

---

### Automation ファミリー

#### Phase52-1

Publishing to Automation Bridge

Phase48-5 Publishing Engineの出力を投稿データとして利用する。

タイトル・説明文・ハッシュタグ・CTAを再生成しない。

---

#### Phase52-2

Posting Automation

Instagram / TikTok / YouTube / ブログ / WordPress / LINE / メール投稿・予約投稿。

ユーザー承認後のみ。

---

### Business Intelligence ファミリー

#### Phase53-1

Cross Engine Dashboard

Phase47コスト分析、Phase46 Compare、Phase48 Quality、Phase48-5 Publishingを横断集計。

既存機能を再実装しない。

---

#### Phase53-2

Business KPI Intelligence

売上 / 利益 / 案件 / 社員 / ROI分析。

新規分析のみ。

---

### Company Brain v2 ファミリー（Decision 039によりInstagram Marketing Intelligenceより後回し）

> ⚠️ **【番号整合の注記・Decision 053】** 以下の「Phase54-1 Consult Engine / 54-2 Self Review / 54-3 Autonomous Quality Loop / 54-4」は**旧Version2 Company Brain v2 計画（superseded）**であり、**現在の実開発 Phase54-1（Approval Sync）/ 54-2（Output Draft Persistence）/ 54-3（Remaining Realtime Sync）＝Version1.1 Realtime Sync系 とは別物**である。旧定義は履歴として保持（削除・置換しない）。**Version2側は着手前に再採番**する。

Creative Engine完了後はCompany BrainよりInstagram Marketing Intelligence（Phase50-1）を優先する。Instagram実運用開始・Learning蓄積・Version1完成を優先し、Company Brain v2は引き続きPhase54で着手する。

#### Phase54-1

Consult Engine

既存`autonomousConsult`フラグとcollaborators機構を正式Workflow機能へ昇格。

---

#### Phase54-2

Self Review Engine

Reviewer / Strategy の自動相互レビュー。

---

#### Phase54-3

Autonomous Quality Loop

Compare Intelligence → Learning → Knowledge の改善ループ自律化。

---

#### Phase54-4

Company Brain v2 Integration

読み取り専用ダッシュボードから自律実行層へ昇格。

---

## Version 2.0 完成時の姿（Autonomous Mode）

AI Company Autonomous Mode

```
依頼
  ↓
Leader判断
  ↓
各AI社員
  ↓
相談
  ↓
改善
  ↓
レビュー
  ↓
品質判定
  ↓
完成品生成
  ↓
画像生成
  ↓
動画生成
  ↓
投稿データ生成
  ↓
分析
  ↓
学習
  ↓
会社全体へ反映
```

完全自律型AI会社

---

## Ultimate Goal

ユーザーが

「美容系Instagramを作って」

と依頼すると

```
市場分析
  ↓
競合分析
  ↓
ターゲット分析
  ↓
戦略立案
  ↓
カルーセル
  ↓
画像生成プロンプト
  ↓
動画生成プロンプト
  ↓
Flow
  ↓
Veo
  ↓
Kling
  ↓
LP
  ↓
HTML
  ↓
PDF
  ↓
投稿タイトル
  ↓
投稿文
  ↓
CTA
  ↓
ハッシュタグ
  ↓
投稿時間
  ↓
改善提案
  ↓
品質チェック
  ↓
完成品
```

までAI会社が自動で納品できることをVersion2.0の最終目標とする。

（下記「将来的な完成イメージ」は本Ultimate Goalを具体的な依頼例で示したものであり、同一の最終目標を指す）

---

## 将来的な完成イメージ

AI会社へ

「Instagramでバズる美容アカウントを作って」

と依頼すると、

- 市場分析
- 競合分析
- ターゲット分析
- カルーセル作成
- 動画台本作成
- Flow用プロンプト生成
- Veo用プロンプト生成
- Kling用プロンプト生成
- 画像生成プロンプト
- 投稿タイトル
- 説明文
- CTA
- ハッシュタグ
- 投稿時間
- LP
- HTML
- PDF資料

まで全自動で完成するAI会社を目指す。
