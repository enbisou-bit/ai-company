# PROJECT_STATUS.md

# ENBISOU AI COMPANY - 現在の開発状況

更新日: 2026-08-30（**Instagram実運用 P1〜Issue A/B 修正 4commit ─ 実AI Path A E2E PASS・docs正式化 Stage-1 → 正式リリースComplete（Decision108追記・stage-2 docs同期 2026-08-30）**。Instagram実運用1周目で確定したP1 Blocking Issue、およびその過程で判明したIssue A／Issue Bについて、**Code実装4commitがlocalhost実AI Path A E2Eで検証完了**した。**Instagram実運用 P1〜Issue A/B 修正は正式リリースComplete（stage-2 docs同期・2026-08-30）**。**【stage-2 docs同期・正式リリース実績】**Code修正4commit（`ba4d82e`／`c35b534`／`d8a09f1`／`08d15e3`）＋docs commit `e935056`（`docs: record instagram p1 and issue ab fixes`）を **main push済**（HEAD＝origin/main＝`e935056ab48049aeb60fa9b39e340c6168b40b69`・ahead/behind 0/0）。**Annotated Tag `v1.01-instagram-p1-issue-ab-release`**（tag object `6d957a8d097c3cd1f43e5875594ae27b812aa768`・peeled commit `e935056ab48049aeb60fa9b39e340c6168b40b69`）**local／remote反映済**（Tag再作成なし）。**Render Service `ai-company`（branch `main`・Trigger Auto-Deploy）Deploy `e935056`・Status Live**（2026-08-30 07:40:12 GMT+9・Duration 22.1s・Manual Deploy／再deployなし）。**本番AI COMPANYの認証後UIをユーザーが実画面で正常表示確認済**（対象case `case-msr9yckye65y`／Package `iadp_1787060839814_izhakb`／最新確認Draft `out_1787999232715`・caseId binding正常・Cross-case混線なし・致命的UI崩壊なし・Render本番read-only API取得も正常）。**P1〜Issue A/B 正式リリースComplete**。本stage-2同期はdocsのみ変更（Code変更0・test変更0・DB write 0・AI API実行0・Render再deploy 0・Tag再作成0）。**正式対象Code commit（4件・push済・正式リリース済）**：①`ba4d82e96668322bb57342927c692a0af6e9d76d`（`fix: restore instagram publishing safety gates`）＝**P1-1 Output Draft caseId Binding**＋**P1-2 Reviewer/Strategy → Leader Final stage-1**（reviewerText/strategyTextの600→1200文字化・`LEADER_FINAL_REVIEWER_REJECT_RULE`追加）。新規`p1BlockingFix.test.js`。②`c35b534d4d4165b541ed0d8a186f3a41567aa443`（`fix: scope listing ng words to listing ads only`）＝**listingNgWords Channel Scope Fix**。新規`apfrListingScope.test.js`。③`d8a09f1c39c0a9e3a2c598769e5aac15689cbfd3`（`fix: mark iadp values as account design not product facts`）＝**IADP Scope Boundary（Option E＋B）**。新規`iadpScopeBoundary.test.js`。④`08d15e3080d2e50113640671927dbc16ca9c29c8`（`fix: supply main task reviewer review to leader final`）＝**Issue A Option D**。新規`mainReviewerSupply.test.js`。**①P1-1 Output Draft caseId Binding**：`createOutputDraft()`がcaseIdを持たないDraftを返すため、生成直後Draftでは`_apfrCurrentAdoptedProduct()`の三重guard（caseId一致）が必ず失敗し、complianceContextが`{}`となってCompliance CheckがNOT CHECKEDへ、さらに`_apfrEvaluateMobileApprovalCompliance()`もnot_checked→fail-open→`blocked:false`となり**C-1C-2b-1 Mobile Approval Enforcementが生成直後Draftに対して発火しなかった**（復元経路`_outputDraftFromServerRow()`は`row.case_id`を設定済みのためF5後のみ正常という不一致）。`atRunWorkflow()`の既存carry-forwardブロック先頭でWorkflow開始時に捕捉済みの`_atRunCaseId`をbindingする1行のみ追加（`createOutputDraft()`本体は無変更＝他呼び出し経路へ副作用0）。**実AI E2E実測**：新規Draft`caseId=case-msr9yckye65y`・`restored:false`・Cross-case混線なし・Compliance Context 4field取得・Mobile Approval Enforcement `evaluated:true`。**②listingNgWords Channel Scope Fix**：A8.net公式定義上`listingNgWords`は「リスティング広告（検索連動型広告）で入札・出稿を禁止する検索キーワード」であり、**Instagram organic投稿本文の禁止語ではない**。実案件の実値`["商品名","法人名"]`をInstagram本文へsubstring適用していたため、①本文中の「商品名」という語自体がviolationとなりMobile Approvalが誤blockされ、②Leader Finalが「商品名はNGワード」と誤解しFormal Truthの`productName`（プラファスト）をIADPアカウント名（ナチュラルエッセンス）へ置換する二次被害が発生していた。**正式仕様**：**Formal Truth（APFR Fact）は`["商品名","法人名"]`のまま保持し書き換えない**（Correction・schema変更いずれも0。将来リスティング広告機能で使用）。Instagram organic出力タイプのときだけ**Compliance evaluation inputから当該fieldのみを除外**し、既存Contractどおり`not_checked`となる（detector本体`evaluateComplianceGate()`／`_apfrEvaluateDisclosureMarkers()`／`_apfrEvaluateComplianceAssessment()`／`_apfrBuildComplianceContext()`はいずれも無変更）。`not_checked`はAssessmentの`unchecked`へ明示され握りつぶさない。他チャネル（lp／flyer等）は従来どおり評価する。**実AI E2E実測**：violation 0件・Mobile Approval誤block 0件・`unchecked:["listing_ng_words"]`。**③IADP Scope Boundary（Option E＋B）**：`fields.iadp.package.finalProfile`の`brand.brandConcept`・`account.bio`等がserver側`_leaderCaseContextToText()`により【CASE CONTEXT｜…（Formal Truth）】ヘッダ下へフラット列挙されていたため、AI社員が「自然由来」（アカウントのブランドコンセプト）を対象商品の成分・特性の事実として転用するClass C（意味誤用）が発生していた。値はCASE CONTEXTに実在するため既存`formalTruthRule`の「記載のない情報を断定しない」では防げなかった。**正式仕様**：IADPの`accountName`／`username`／`bio`／`brandConcept`／`target`／採用ジャンル等は**媒体アカウント側の設計・方針**であり、対象商品の**成分・効能・効果・適性・品質・安全性・実施中キャンペーン・特典の商品事実ではない**。**Option E**＝`server.js _leaderCaseContextToText()`へ用途境界の見出し（`■ アカウント設計（IADP｜運用する媒体アカウント側の設計・方針です。対象商品の…商品事実ではありません）`）を追加（値・順序・件数は不変・増えたのは見出し1行のみ・IADP値0件時は見出しを出さない）。**Option B**＝`openaiClient.js _buildFormalTruthRuleText()`の【絶対禁止】へ意味変換禁止を1項追加（**単一ソースのためSNS／Writer／Reviewer／Strategy＋Leader Finalの全Agentへ同時適用**・Agentごとの重複追加なし）。**過剰禁止を避けるため、アカウント自体の説明・世界観・投稿トーンとしての利用は明示的に許可**（例「自然由来の美容と健康情報を発信するアカウントです」は適切）。**実AI E2E実測**：「自然由来」の商品成分・特性への転用**0件**（出現はアカウント説明のみ）、IADP targetの商品適性転用**0件**、未確認キャンペーン・特典・お試し・割引**0件**。**④Issue A Option D（main-task Reviewer → Leader Final供給）**：Path AではReviewerが**2系統**存在する——(a)Auto Task担当行として実行される**main-task Reviewer**（例`at-task-3`）と、(b)後処理で自動生成される**post-process Reviewer**（`at-postprocess-reviewer`）。main-taskは`workflowTasks.map()`生成物で`isPostProcess`プロパティを持たない（undefined）ため既存の`find(t => t.agentId===[reviewer] && t.isPostProcess)`にマッチせず、`reviewerText`は常に(b)だけを指していた。結果、停止・確認要求を出した(a)の本文は`memberReplies`内に他担当と横並びで埋もれ「AI社員の社内検討内容（正式回答ではない）」扱いとなり、`LEADER_FINAL_REVIEWER_REJECT_RULE`の対象外だった。**修正**：新変数`mainReviewerTask`（`reviewer`／`!isPostProcess`／`completed`／`result`有）を追加し、Leader Final questionへ**専用ラベル`【Reviewer（品質レビュー担当）の作業中レビュー】`**で追加供給（通常分岐・IADP分岐の両方）。上限は既存`LEADER_FINAL_POSTPROCESS_TEXT_MAX=1200`を再利用。reject遵守Contractの発火条件を`(reviewerText || mainReviewerText)`へ拡張（緩和ではなく拡張）。**既存の`reviewerTask`／`strategyTask`取得行は1文字も変更せず**、post-process Reviewerと統合・置換もしない（両方をLeader Finalへ渡す）。`memberReplies`の構造・内容・件数も無変更。**Issue A 実AI E2E結果＝PASS**：Reviewerが「CASE CONTEXTに存在しない商品固有情報（成分・処方・特徴）について確認が必要」と要求→Strategyが「CASE CONTEXTに存在しない情報であり、正本ルールに従い『使わずに成立する投稿』として作成済み。事実未確認の成分・効能・特典は一切含めていません」と解決→Leader Finalが**「商品の成分・効能・効果については記載せず、Formal Truthに基づく事実のみを掲載しています」と明示**し、実際に未確認事実を使用せず完成稿を生成。「Reviewer確認済み」「Compliance Check完了」等の**虚偽断定は0件**（むしろ「Reviewer・Strategy・Compliance担当へ詳細確認と最終承認を進めます」と未完了扱い）。**永久block 0**・Strategy override正常動作。**deterministic block／停止語のsubstring・regex判定／新Enforcementはいずれも追加していない**——Reviewer停止を無条件blockにすると、商品成分等がFormal Truthに構造上存在しない案件（APFRはASPプログラム事実のみを保持）が永久blockになるため。`shared/leaderRuleEngine.js`の`reviewerSignal: null`は偽陽性回避の既存設計判断を尊重し**維持**（Rule Engineはbyte一致で無変更）。`buildStrategyConsolidatePrompt()`のStrategy override権限（caseContextRule）も**維持**。**Not Required維持**：**APFR Compliance Restrictions deterministic化＝Not Required**（判定C）・**APFR Step C-3-1 Grounding Detection＝Not Required**（判定D）をいずれも維持し、新detectorは追加していない。**Class B残件（P3既知事項・正式リリースを止めない）**：最新E2E残存は`#美肌`・`#敏感肌`・`#保湿`の**ハッシュタグ3件のみ**で、**本文中の未確認商品事実は0件**。read-only調査の結論：(a)`#敏感肌`はH3（商品適性示唆）で医薬部外品案件では要注意だが、(b)`#美肌`はH2（悩み・関心タグ）、`#保湿`はH4境界だが投稿テーマとも読め、(c)**deterministic denylistは偽陽性・商品ごとの差・保守コストの観点から採用しない**（`listingNgWords`以外を機械Gate化しないC-1C-1判断および`leaderRuleEngine.js`「既存NGキーワード判定は使用しない（偽陽性回避）」方針と整合）、(d)根本原因の一因は**`LEADER_FINAL_PROMPT`の「ハッシュタグ20個程度」という量指示**（Formal Truthから根拠を持てるタグは`productName`／`productCategory`／`regulatoryCategory`／IADP`accountName`＋広告開示で最大6個程度であり、残りを一般美容タグで埋める生成圧力になる）。**将来必要ならPrompt Rule追加＋量指示緩和をP3として検討する**（今回実装しない）。**第1投稿運用方針**：Class BハッシュタグはMobile Approval時に人間が目視確認し不要・不適切なタグを削除できるため、第1投稿を止めない。**productName**：最新E2Eで`プラファスト`が**4件正常使用**され、`ナチュラルエッセンス`はアカウント名としてのみ使用（商品名への誤使用0件）。前回E2Eで観測された商品名の過剰回避（0件）は**再発なし**。追加修正不要。**テスト**：新規4スイート（`p1BlockingFix` 60/60・`apfrListingScope` 74/74・`iadpScopeBoundary` 84/84・`mainReviewerSupply` 72/72）すべてPASS。既存回帰も新規FAIL0（`apfrComplianceGate` 42/42・`apfrComplianceAssessment` 84/84・`apfrDisclosureDetection` 66/66・`apfrApprovalEnforcement` 76/76・`apfrComplianceUiScope` 60/60・`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62・`apfrCaseDataContext` 80/80・`iadpQualityContractRouting` 86/86 ほか）。**`leaderFinalGrounding.test.js`は52/53**（FAIL`20-2a`のみ＝Option F正式commit後に`openaiClient.js`のHEAD差分が0となるため構造上PASS不可の既知diff-state static guard制約。**53/53 PASSとは記録しない**）。released testの追随修正は`apfrComplianceInjection.test.js`（listingNgWordsのpromptラベル変更に伴う期待文字列3行）と`p1BlockingFix.test.js`（reject遵守Contract発火条件の拡張に伴うE-7・検証を弱めずE-7bを新規追加）の2件のみで、**test削除・skip・条件緩和は一切行っていない**。`server.test.js`は実行していない。**実AI費用**：Path A E2E計3回（listingNgWords検証・IADP Scope Boundary検証・Issue A検証）で約¥2.31（Leader chat各1回＋workflow各1回）。**過大表現の禁止**：以下は**記録しない**——Compliance Enforcement完全完成／Fully Compliant／Grounding Enforcement Complete／全ての広告表現が法的に保証済み／自動公開安全性100%保証。今回正式化するのは**P1修正・listingNgWords Channel Scope・IADP Scope Boundary・Issue A Option Dの各実AI E2E PASSとMobile Approval Enforcement正常動作まで**である。**Decision**：新規Decision番号は作成せず、P1-1／listingNgWords／IADP Scope Boundary／Class B調査はDecision108へ、Issue A（Reviewer→Leader Final供給・Approval Contractに接続しない情報供給のみ）もDecision108へ追記する（**Decision109（Mobile Approval Compliance Enforcement Contract）は変更なし**——本工程はEnforcementを追加せず、Mobile Approvalの`canApprove`条件も無変更のため）。**Version1 Final Complete／Version1.1 Connected AI Company開発中・Phase54 Complete維持・Phase55未着手（変更なし）**。**stage-2 docs同期時点**：docsのみ変更（Code変更0・test変更0・DB write 0・AI API実行0・Render再deploy 0・Tag再作成0）。push／Tag／Render Auto-Deployは正式リリースで実施済み・本同期での再実行なし。**現在地フロー**：C-1C-2a-1正式リリース → C-3-1 Not Required → Compliance Restrictions Not Required → 実運用1周目でP1発見 → P1修正 → listingNgWords Channel Scope → IADP Scope Boundary → Issue A Option D → **本docs正式化 Stage-1** → main push（HEAD＝origin/main＝`e935056`）→ Annotated Tag `v1.01-instagram-p1-issue-ab-release`（local／remote反映）→ Render Auto-Deploy（`e935056`・Live・2026-08-30 07:40 GMT+9）→ 本番UI確認（ユーザー実画面・`case-msr9yckye65y`）→ **P1〜Issue A/B 正式リリースComplete** → **stage-2 docs同期（本更新）** → 現在ここ。——以前の更新記録（履歴として保存）：**APFR Compliance Restrictions deterministic化 ─ Not Required 正式化（Decision108追記・docs-only stage-1）**。前工程のread-only調査（Opus・C-1系列 read-only）により、`complianceRestrictions` をdeterministic Compliance Detectorへ直接利用する設計は不適切と確定したため、**APFR Compliance Restrictions deterministic化＝Not Required（Detectorを新設しない）として正式化**した（**判定C**：deterministic対象は `listingNgWords` へ責務分離する）。**実測根拠（実案件プラファストの `complianceRestrictions` 実値）**：`A8.netのルール遵守`／`広告表示必須`／`法律関連の禁止事項遵守`／`リスティング違反禁止` の**4値すべてが単純禁止語ではなく directive／obligation／自然言語制約**であり、Type A（単一禁止語）・Type B（禁止フレーズ）の実データは0件。**substring実測（既存 `evaluateComplianceGate()` と同一の NFKC→lowercase→trim→substring 方式を仮適用）**：①残存表現（`#敏感肌`／「自然由来」／「肌に優しい」）の検出＝**0件（false negative 100%）**／②正しいCompliance遵守表明「A8.netのルール遵守のうえ作成」＝`violation` 誤検出／③正しい広告開示「広告表示必須の規定に従い【広告】と明記」＝`violation` 誤検出／④`広告表示必須` は禁止表現ではなく **positive obligation** であり「存在したら違反」となる substring detector では**意味が逆転**する。この時点で直接Detector化は不採用。**Source of Truth 責務分離（正式維持）**：**`listingNgWords`＝deterministic禁止語のSource of Truth**（閉じた語彙・既存 `evaluateComplianceGate()`）／**`advertisingDisclosureRequirements`＝開示義務trigger**（自然文値そのものを substring 検索せず、Formal Truth値の存在をtriggerに別途定義した閉じたmarker集合〔【広告】／【PR】／#広告／#PR／#プロモーション／定型文〕を検査する C-1C-1b whitelist marker detector）／**`complianceRestrictions`＝自然言語Compliance制約のSource of Truth**（既存 C-1B prompt injection で Writer／Reviewer へ伝達・semantic判断は AI／Reviewer の責務）／**`regulatoryCategory`＝参考情報**（カテゴリ名から追加の法令・規制を推測しない）。**C-1C-1 既存判断は変更しない**：「deterministic対象は `listingNgWords` のみ／`complianceRestrictions`・`regulatoryCategory`・`listingPolicy` は自然言語・意味的判断を要するため機械Gate化しない」という正式判断は、今回の実データ調査でも正しかったと確認された。**`advertisingDisclosureRequirements` が C-1C-1b で deterministic 化済みなのは自然文値そのものの substring 検索ではなく別 whitelist 方式のため、同じ成功パターンを `complianceRestrictions` へそのまま適用できない**。**残存3表現（`#敏感肌`／「自然由来」／「肌に優しい」）は現在の Formal Truth だけでは deterministic に NG 判定不能**（`listingNgWords` 一致なし・`complianceRestrictions` 一致なし・`regulatoryCategory` から法令知識を推測することは禁止・semantic判断が必要）。**C-3-1 Grounding Detection＝Not Required と今回の Compliance Restrictions deterministic化＝Not Required により、残存3表現は Grounding側・Compliance側の双方で安全な機械判定が成立しない**ことが確定。現状は Option F／Reviewer 等の AI 側責務に残す。**Compliance Assessment 変更0**（`_apfrEvaluateComplianceAssessment()` へ新Detectorを追加しない）。**Mobile Approval 変更0**（既存spine「Compliance Assessment blocked→Mobile Approval不可→Publishing Ready不可→markInstagramPublished不可」を維持）。**Quality Gate 変更0**（`complianceRestrictions` を `evaluateQualityGate()` へ接続しない）。**READY 変更0**（`complianceRestrictions` を `OUTPUT_STATUS.READY` へ接続しない）。**新規観察事項（別課題・今回は修正しない）**：実案件 `listingNgWords = ['商品名', '法人名']` は「Instagram投稿本文の禁止語」というより「リスティング広告における商品名・法人名キーワード入札禁止カテゴリ」を意味している可能性があり、現行 C-1C-1 detector が Instagram 成果物本文へ substring 検索する適用先との間に**チャネル意味ズレの可能性**がある。**今回この意味ズレは修正しない**（`listingNgWords` の意味変更／field rename／schema変更／detector変更／scan対象変更／ASPデータ変更／既存Fact訂正は禁止）。別課題としてのみ記録する。**Option D（deterministicに止めたい語句は `listingNgWords` へ登録する）の責務原則自体は維持候補だが、現在の `listingNgWords` field が Instagram 投稿用禁止語を正式に保持する Contract なのかは未確認のため「Option D 完全採用」とはまだ記録しない**。正式記録は「`complianceRestrictions` detector＝Not Required／deterministic禁止語の既存SoT＝`listingNgWords`／`listingNgWords` のチャネル意味定義には別途確認事項あり」までとする。**Decision**：新規Decision番号は作成せず Decision108 へ追記（本調査は APFR／Compliance Contract の責務境界の設計判断のため）。**Decision109（Mobile Approval Compliance Enforcement Contract）は変更なし**。**今回は docs-only stage-1（Code変更0・test変更0・DB変更0・AI API実行0・push未実施・新規Tag 0・Render操作0）**。**「Compliance Complete」「Compliance Enforcement Complete」とは記録しない**——正式意味は「調査の結果、`complianceRestrictions` の deterministic Detector 化は Not Required と判断した」である。次工程はまだ自動確定しない（技術的第一候補＝「`listingNgWords` チャネル意味定義確認調査」・ChatGPT確認待ち）。**現在地フロー**：C-1C-2a-1 正式リリースComplete → Quality Gate Grounding Enforcement 調査 → C-3-1 Grounding Detection＝Not Required → **APFR Compliance Restrictions deterministic化＝Not Required** → 現在ここ。——以前の更新記録（履歴として保存）：**APFR Step C-3-1 Grounding Detection ─ Not Required 正式化（Decision108追記・docs-only stage-1）**。前工程のread-only調査（Opus・Quality Gate Grounding Enforcement調査に続くC-3-1調査）により、deterministic Grounding Detectionを新設しても実際に発生したGrounding問題を有効に検出できないことが確定したため、**APFR Step C-3-1 Grounding Detection＝Not Required（実装しない）として正式化**した（**判定D**）。**決定的根拠（Option F前の実AI E2Eで確認されたGrounding問題15件）**：**Class A（Formal Truth直接矛盾。例「Formal Truth 報酬4000円 vs 成果物 8000円」）＝0件**／**Class B（Formal Truthに照合先fieldが存在しないContext外具体的捏造。自然由来成分・植物エキス・肌にやさしい成分設計・敏感肌・乾燥肌・悩みを解消・肌本来の美しさ・肌改善・今だけお得なキャンペーン・キャンペーン告知・特典あり等）＝12件**／**Class C（Formal Truth意味誤用。`approvalRate=100`→「100%審査通過済み」／`cookieWindowDays=90`→「90日間のクッキー期間中に購入すると特典あり」／`mobileOptimized=true`→「スマホ最適化済みで簡単購入」。**値自体はFormal Truthと一致しており、値の不一致ではなく意味・文脈の転用**）＝3件**。したがってFormal Truth Contradiction Detectionを実装しても実測15件を1件も検出できない。**APFR Formal Truth全21fieldを調査した結果、C-3-1の安全なdeterministic対象候補＝0件**（APFR＝ASPアフィリエイトプログラムの事実〔ASP名・Program ID・商品名・報酬・EPC・確定率・Cookie期間・技術対応・compliance制約等〕／Grounding問題の中心＝消費者向けマーケティング主張〔商品成分・効果・肌への適性・キャンペーン・特典・評価的表現〕でdomainが一致しない）。**claim extraction不成立**：X1（Formal Truth値との競合値検索）＝false positive過多（例`approvalRate=100`に対し「100人に聞きました」を誤検出）／X2（field-specific keyword proximity）＝実測Class Cは本文にfield labelを含まず検出不能／X3（値完全一致をsupported扱い）＝**禁止**（実測Class C 3件をすべて「supported」と誤肯定する）／X4（claim extraction／contradiction detection分割）＝claim extraction自体がsemantic判断のためdeterministicに成立しない。**status Contract**：Grounding用に`clear`／`supported`／`grounded`／`fully_grounded`を**新設しない**（「値が一致している」「矛盾が見つからない」ことを「Groundingされている」と読み替えると誤保証。特に実測Class CはFormal Truth値が完全一致しているのに意味誤用が発生している）。**C-3系列（仮提案の C-3-1 Grounding Detection／C-3-2a Grounding Assessment／C-3-2a-1 Grounding UI／C-3-2b Grounding Enforcement／C-3-3 Grounding E2E）は実装系列として取り下げ**（設計履歴として「調査した結果Not Requiredとなった」ことは正式記録として残す・単純削除は禁止）。**Leader Final Grounding現在地は変更なし**：Option F実AI E2E＝**A**／Leader Final Grounding＝**B**（軽微残存：`#敏感肌`・「自然由来のスキンケア」・「自然由来の美容と健康を追求するあなたに」・「肌に優しい医薬部外品」等）。**Grounding Complete／Fully Grounded／No Hallucination Guaranteed／Grounding Enforcement Completeとは記録しない**。**Option F責務**：今後もGeneration Preventionとして維持（deterministic Detectionではない）。正式構造＝Case Context／Formal Truth→Generation Prevention（Option F）→Reviewer／Strategy等AI評価→Leader Final。Groundingのdeterministic post-generation Detectorは新設しない。**Quality Gate変更0**（`packageQuality.status`のみを見る構造Gateであり通常Instagram投稿の公開spineを止めない・`evaluateQualityGate()`へGroundingを接続しない）。**READY変更0**（AI生成完了状態・主条件`integratedCount > 0`・Grounding接続しない・READY Grounding Enforcementも現時点では実装しない）。**Mobile Approval変更0**（`canApprove`へ新しいGrounding blockerを追加しない・現行spine「Compliance Assessment blocked→Mobile Approval不可→Publishing Ready不可→markInstagramPublished不可」を維持）。**C-2-1 Numeric Consistency変更0**（`product.inputs`とFormal Truthの照合であり成果物本文を評価しない・C-3とは別責務）。**C-2-2＝引き続き未着手・保留**。**Marketing Claim Formal Truth＝現時点では新設しない**（Formal Truth schemaを増やしても、成果物中のどの表現が「事実主張」かをdeterministicに抽出するclaim extraction問題が残る／allowlist方式＝false positive過多／denylist方式＝Complianceと同一責務）。**将来候補（実装・正式採用はしない）**：残存する軽微表現の一部（`#敏感肌`・「自然由来」・「肌に優しい」）はGroundingよりComplianceの責務に近く、Formal Truthには既に`regulatoryCategory`／`complianceRestrictions`が存在するが、既存C-1C-1は「`advertisingDisclosureRequirements`／`complianceRestrictions`／`regulatoryCategory`／`listingPolicy`は自然言語・意味的判断を要するため機械Gate化しない」と正式判断済み——**この判断は今回変更しない**。将来候補としてのみ「C-1系列：complianceRestrictions deterministic化可否調査」を記録する（まだ実装・正式採用しない）。**Decision**：新規Decision番号は作成せずDecision108へ追記（本C-3-1調査はAPFR／Formal Truth／Grounding境界の設計判断のため）。**Decision109（Mobile Approval Compliance Enforcement Contract）は変更なし**。**今回はdocs-only stage-1（Code変更0・test変更0・DB変更0・AI API実行0・push未実施・新規Tag 0・Render操作0）**。次工程はまだ自動確定しない（技術的第一候補＝「Compliance Restrictions deterministic化可否調査」・ChatGPT確認待ち）。**現在地フロー**：C-1C-2a-1 正式リリースComplete → Quality Gate Grounding Enforcement 調査（＝Quality Gate接続は不採用と判定）→ C-3-1 Grounding Detection 調査 → **C-3-1 Grounding Detection＝Not Required** → 現在ここ。——以前の更新記録（正式リリース実績を含む・履歴として保存）：**APFR Step C-1C-2a-1 Compliance UI Scope Correction 正式リリースComplete（Decision108追記・stage-2 docs同期）**。**【stage-2 docs同期・正式リリース実績】** APFR Step C-1C-2a-1 は正式リリースComplete。Code commit `112dafd6e9ff76f737a6240e2dee346656cfbed6`（`feat: scope compliance ui to scannable outputs`）／stage-1 docs commit `a97109bb2b840b464037b22719d92c00ad3cca62`（＝正式Tag target）を **main push済み**（正式リリース時 HEAD＝origin/main＝`a97109bb2b840b464037b22719d92c00ad3cca62`・ahead/behind 0/0）。**Annotated Tag `v1.01-apfr-compliance-ui-scope-correction`**（target `a97109bb2b840b464037b22719d92c00ad3cca62`）**push済み**（新規Tagは作成せず既存Tag targetも不変）。**Render自動Deploy反映確認済み**：本番 `/` 200・`/api/task-history` 200・`/api/workflow-dashboard` 200・fatal/startup error 0、本番配信 `index.html` に `_apfrComplianceHasScannableContent` と正式「NOT CHECKED」文言が存在、**本番配信 `index.html` とローカルHEADの `index.html` はbyte単位IDENTICAL確認済み**。**最新 `leaderFinalGrounding.test.js` 実測＝52/53 PASS（FAIL: `20-2a` のみ）**——`20-2a` はOption F正式commit後に `openaiClient.js` のHEAD差分が0となるため構造上PASS不可の既知diff-state static guard制約であり、C-1C-2a-1の機能FAILではない。**53/53 PASSとは記録しない**（stage-1実装中の途中値 49/53〔FAIL 18-1・20-1・20-2a・20-2b〕は `index.html` 未commit時のdiff-state由来で、正式commit後に 18-1・20-1・20-2b は解消済み）。**今回の正式化はCompliance UI Scope Correction＝正式リリースCompleteまで**——Compliance Enforcement全体Complete／Quality Gate Grounding Complete／READY Grounding Complete／Grounding Enforcement Complete／IADP Approval Enforcement Complete／server-side Enforcement Completeとは記録しない。新規Decision番号は作成せずDecision108へ追記（Decision109の責務は不変）。**次工程候補の第一＝Quality Gate Grounding Enforcement（未着手・調査/設計工程から開始）**。——以下は正式リリース前のstage-1実装時点の詳細記録（「push/Tag/Render未実施」表記および `leaderFinalGrounding.test.js` 49/53 表記を含むが、最新の正式リリース実績は上記のとおり）：IADPアカウント設計フェーズのdraft表示時に、投稿成果物が存在しないにもかかわらずCompliance Check UIが「禁止語：CLEAR」「広告開示：MISSING」「総合：BLOCKED」等の確定判定に見える表示false positiveを出す問題を発見・是正した。**根本原因**：Output Engineが全output type共通で`buildComplianceGateHtml()`を無条件表示しており、既存detectorはobject型フィールド（`fields.iadp`）をdeep recursionせず対象外とするため、検査対象テキスト0件のまま確定的な戻り値（`clear`/`missing`）を返していた。**責務判断**：投稿成果物がある場合Detector/Assessmentは正しく機能しているため**Detector Contract・Assessment Contractは変更せず**、UI表示スコープのみを補正（実装前調査で判定A：UI表示スコープのみの最小修正で安全に是正可能、と確定）。**新規helper**：`_apfrComplianceHasScannableContent(outputDraft)`——`fields`直下にstring/arrayが1件でも存在するかを、既存detectorと同一の浅い型判定のみで確認。scannable content無し時のみ禁止語/広告開示/総合の3項目をNOT CHECKED表示へ差し替え、「投稿成果物などの検査対象テキストがまだ存在しないため、Compliance Checkは未実施です。」を表示。内部の`evaluateComplianceGate()`・`_apfrEvaluateDisclosureMarkers()`・`_apfrEvaluateComplianceAssessment()`の呼び出し・戻り値は完全に無変更（表示直前でUI層のみ上書き）。**lifecycle carry-forward対応**：IADP存在 ≠ IADP-onlyのため判定軸は「scannable content存在」とし、投稿成果物とIADPが併存する場合はブラウザ実測で通常表示（実際の判定）が正しく表示されることを確認——false negativeを防止し本物の投稿Complianceを隠さない設計。**Mobile Approval Enforcement（C-1C-2b-1）／IADP Approval（C-1C-2b-2 Not Required）／Quality Gate／READYはいずれも変更0**（新helperはこれらへ一切接続しない）。**テスト**：新規`apfrComplianceUiScope.test.js` **60/60 PASS**。**released test追随修正**：`apfrDisclosureDetection.test.js`のtest 40が、`buildComplianceGateHtml()`本体の固定6000文字window切り出しにより、今回の正規UI追加で検証対象文言（オフセット6613文字目）がwindow外へ押し出され1件FAILしたため、既存test suite標準の`\n}\n`終端検出方式へ統一する追随修正を実施（assertion内容・ラベル・検証Contractは1文字も変更せず、`end`/`body`算出の2行のみ変更）。既存回帰：`apfrApprovalEnforcement` 76/76・`apfrComplianceAssessment` 84/84・`apfrDisclosureDetection` 66/66・`apfrComplianceGate` 42/42・`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62・`apfrCaseDataContext` 80/80・`iadpQualityContractRouting` 86/86、他既存重要回帰も新規FAIL0。**`leaderFinalGrounding.test.js` 49/53**（FAIL: 18-1・20-1・20-2a・20-2b。Option F commit時点のdiff-state static guardが正規`index.html`変更を検出した既知の非機能FAILでありC-1C-2a-1機能FAILではない。**53/53 PASSとは記録しない**）。`node --check`・`git diff --cached --check`いずれもCLEAN。**localhost**：`/`200・`/api/task-history`200・`/api/workflow-dashboard`200。**fixture確認**：A.IADP-only→NOT CHECKED/NOT CHECKED/NOT CHECKED、B.IADP+投稿成果物→通常Compliance表示、C.投稿+disclosure missing→MISSING/BLOCKED維持、D.投稿+disclosure satisfied→SATISFIED/CLEAR維持、E.listing violation→VIOLATION/BLOCKED維持、をブラウザ実測確認。Console Error0・POST発火0件・DB write0・AI API実行0。**今回の正式化はCompliance UI Scope Correction Code Implementation Completeまでであり、Compliance Enforcement全体Complete／Quality Gate Grounding Complete／READY Grounding Complete／Grounding Enforcement Complete／IADP Approval Enforcement Complete／server-side Enforcement Completeとは記録しない**。**Code commit `112dafd6e9ff76f737a6240e2dee346656cfbed6`（`feat: scope compliance ui to scannable outputs`）。対象3ファイルのみ（`index.html`／新規`apfrComplianceUiScope.test.js`／`apfrDisclosureDetection.test.js`）・push/Tag/Render未実施**。working treeの別系統runtime差分は本Code commit・本docs追記いずれにも不混入。新規Decision番号は作成せず、Enforcement Contract変更ではないためC-1C-2a記録済みのDecision108へ追記（C-1C-2b系のApproval Enforcement ContractはDecision109に分離済み）。**Version1 Final Complete／Version1.1 Connected AI Company開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）。以前: 更新日: 2026-08-27（**APFR Step C-1C-2b-2 IADP Approval Enforcement ─ Not Required正式化（Decision109追記）**。Mobile Approval Enforcement（C-1C-2b-1）正式リリース後、対称工程として検討されたIADP Approval Enforcementについて実装前調査（Opus）を実施した結果、**C-1C-2b-2は実装しない（Not Required）と正式判定**。理由はserver-side制約ではなく、**Compliance AssessmentとIADP Approvalが評価対象とする成果物そのものが異なるという責務不一致**。**技術的根拠**：`evaluateComplianceGate()`・`_apfrEvaluateDisclosureMarkers()`はいずれもobject型の値を`string/array以外（object等）は対象外・deep recursionしない`として明示的にスキップする実装であり、IADPアカウント設計パッケージ（`fields.iadp = {package, validation, quality, ...}`）はobjectのため**構造上Compliance Assessmentの評価対象に含まれない**。**ブラウザ実測**：`fields.iadp.package`内にNGワードや広告開示Accepted Marker（【広告】等）を配置してもDetectorは検出せず（`compliance:'clear'`／`disclosure:'missing'`のまま）、同内容をトップレベルstringに置くと正しく検出されることを確認し、IADPパッケージ内容とCompliance Assessmentが別スコープであることを実測で確定した。**false positiveリスク**：`advertisingDisclosureRequirements`登録済み案件でIADP設計フェーズのdraft（投稿ではないため本来【広告】/#PR不要）を評価すると`blocked（広告開示マーカー不足）`となり得ることを実測確認。IADPパッケージ内へマーカーを追加してもdeep recursionしないため解消できず、**接続していれば修復不能な永久blockを生み得た**。**責務境界**：IADP Approvalはアカウント設計パッケージ（accountName/bio/brandConcept等）を判定し、Compliance Assessmentは投稿成果物のトップレベルtext/arrayフィールド（slides/caption/hashtags等）を判定する——両者は別成果物。**Mobile Approvalが正しいchokepointである理由**：投稿向けCompliance問題は既にC-1C-2b-1で正しい責務境界にて強制済みであり、Mobile Approvalパネル自体`createMobileReviewCenterDraft()`が実際のカルーセルスライド存在を要件とするためアカウント設計のみのdraftでは描画されない＝**投稿成果物が存在する場合にのみ作動するよう既に正しくスコープ済み**。IADP Approvalへの二重接続は不要。**正式Enforcement spine**：Compliance Assessment blocked→Mobile Approvalは不可（C-1C-2b-1）→IADP Approvalは止めない（成果物が異なるため）→accountCreationReadinessは変更しない（既存IADP品質集約spineを維持）→OUTPUT_STATUS.READYは変更しない。**変更0（実装しないため）**：`_iadpApproveDesign()`／`accountCreationReadiness`（ready/conditional/not_readyのContract維持）／既存User Approval（プラファスト案件含む既存Approvedを遡及変更しない・新規DB write0）／EER（既存記録を無効化しない）／`evaluateQualityGate()`／`OUTPUT_STATUS.READY`／`server.js`。**IADPカードへの新規Compliance warning表示も追加しない**（現行Compliance判定はIADP package自体を評価していないため誤解を招く）。**将来の拡張余地**：IADPパッケージ自体のCompliance検査が将来必要になった場合は、C-1C-2b-2を復活させるのではなく「IADP Content Compliance Detection」という別工程として設計し、既存C-1C-1／C-1C-1bを勝手に拡張しない。**既知の残課題（分離・今回修正しない）**：`advertisingDisclosureRequirements`を持つ案件でIADP設計フェーズのdraftを表示するとCompliance Check UIが表示レベルでBLOCKEDと表示され得る問題（C-1C-2a表示スコープ問題として別課題・現時点ではnon-blocking）。**プラファスト案件で実投稿成果物が存在するMobile Approval段階でのadvertising disclosure missingは正しいCompliance blockerであり、C-1C-2b-1のEnforcementは引き続き維持する**。**今回の正式化はC-1C-2b-2 Not Requiredの判断のみであり、Compliance Enforcement Complete／Quality Gate Grounding Complete／READY Grounding Complete／IADP Content Compliance Complete／server-side Enforcement Completeとは記録しない**。Code変更0・test変更0・DB変更0・AI API実行0。新規Decision番号は作成せずDecision109へ追記。**Version1 Final Complete／Version1.1 Connected AI Company開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）。以前: 更新日: 2026-08-27（**APFR Step C-1C-2b-1 Mobile Approval Enforcement Code Implementation Complete・新規Decision 109**。C-1C-2aまではCompliance Assessmentがblockedでも誰も止まらない「検出のみ」状態だったため、Mobile Approval（通常Instagram投稿の単一chokepoint）へ実ブロックを接続した。**新規Decision番号（109）を採用**——Formal Truth保存契約（Decision108）ではなく、人間のUser Approval操作を初めてdeterministic判定で実際に拒否するApproval Contract自体の変更のため分離。**実装前調査で確定**：Mobile Approvalを止めればPublishing Ready（`createPublishingReadyDraft()`）・投稿記録（`markInstagramPublished()`の既存hard guard）は独立guard追加なしで自動的に停止する／APFR Resolverはclient専用でserver側再評価はC-1A Contract違反となるためserver-side Enforcement（C-1C-2b-3）は実装不可／IADP Approvalは別spine（`accountCreationReadiness`）でありC-1C-2b-2として分離。**正式Enforcement spine**：Compliance Assessment blocked→Mobile Approval不可→Publishing Ready到達不可（自動追従）→markInstagramPublished実行不可（自動）。変更0：`OUTPUT_STATUS.READY`（AI生成完了状態として維持）／`evaluateQualityGate()`／`accountCreationReadiness`／`_iadpApproveDesign()`／`_edRunDecisionEngine()`／`server.js`（client-only Enforcement・直接POSTでの技術的回避可能性は残るが目的は単一運用者の操作ミス防止）。**実装**（`index.html`のみ）：新規`_apfrEvaluateMobileApprovalCompliance()`が`_apfrEvaluateComplianceAssessment()`（C-1C-2a）を唯一の判定源とし、listingNgWords検索・広告marker検索・Resolver等の独自再実装は0。`canApprove = _mapAllChecked() && _mapReviewApproved(mai) && !_mapCompliance.blocked;`（既存2条件維持＋Enforcement条件追加）。`approveInstagramPackage()`内でsubmit直前に再評価（CUI-2のstale防止と同思想）し、blocked時は`decision`・`approvedAt`を変更せず`pushApprovalToServer()`へも進まずreturn。`not_checked`／例外はfail-open（既存条件のみで決定・承認を止めない）。warningsへblocker理由・not_checked警告を表示、**新規override UIは作成していない**。修正またはAPFR Fact訂正でAssessmentがclearへ戻れば自動復旧。**released test 4ファイルを正規追随修正**（`apfrCaseDataContext`／`apfrComplianceGate`／`apfrDisclosureDetection`／`apfrComplianceAssessment`。旧「Approval未接続」assertionを新Contract「既存2条件維持＋Enforcement接続済み＋detector非再実装」検証へ更新。assertion削除・弱化ではなく`apfrComplianceAssessment`は1件追加）。**テスト**：新規`apfrApprovalEnforcement.test.js` **76/76 PASS**。既存回帰：`apfrComplianceAssessment` 84/84・`apfrComplianceGate` 42/42・`apfrDisclosureDetection` 66/66・`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62・`apfrCaseDataContext` 80/80・`iadpQualityContractRouting` 86/86、他既存重要回帰も新規FAIL0。**`leaderFinalGrounding.test.js` 49/53**（FAIL: 18-1・20-1・20-2a・20-2b。Option F commit時点のdiff-state static guardが正規`index.html`変更を検出した既知の非機能FAILでありC-1C-2b-1機能FAILではない。**53/53 PASSとは記録しない**）。`node --check`・`git diff --cached --check`いずれもCLEAN。**localhost**：`/`200・`/api/task-history`200・`/api/workflow-dashboard`200・Console Error0。**fixture確認**：clear／blocked(listing)／blocked(disclosure)／not_checkedの4状態、blocked submit時の`decision=null`・`approvedAt=null`・**pushCount=0**、修正後の自動復旧を実測確認。fixture実行によるPOST発火0件・DB write0・AI API実行0。**実運用影響（重要）**：プラファスト実案件は`advertising disclosure missing`が既に実測されており、**次回のMobile Approval操作は実際にblockされる可能性が高い**（意図したEnforcement動作。解除には成果物へ【広告】/#PR等の追加が必要）。**今回の正式化はMobile Approval Enforcement Completeまでであり、Compliance Enforcement全体Complete／IADP Approval Enforcement Complete／Quality Gate Grounding Complete／READY Grounding Complete／accountCreationReadiness Enforcement Complete／server-side Enforcement Completeとは記録しない**。**Code commit `46b37dc2785bdd02c1cc578581c6b95f7ea8d95f`（`feat: enforce compliance on mobile approval`）。対象6ファイルのみ（`index.html`／新規`apfrApprovalEnforcement.test.js`／released test4件）・push/Tag/Render未実施**。working treeの別系統runtime差分（`cost-logs.json`／`data/conversations/_meta.json`・既存untracked7件）は本Code commit・本docs追記いずれにも不混入。**Version1 Final Complete／Version1.1 Connected AI Company開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）。以前: 更新日: 2026-08-27（**APFR Step C-1C-2a Compliance Assessment Aggregation Code Implementation Complete・Decision108追記**。既存C-1C-1（listingNgWords Deterministic Compliance Check）とC-1C-1b（Advertising Disclosure Detection）はそれぞれ独立したdetectorとして表示のみに使われていたため、この2つの結果を1つのCompliance Assessmentへ集約する`APFR_COMPLIANCE_ASSESSMENT_ITEMS`と新規純関数`_apfrEvaluateComplianceAssessment(outputDraft, complianceContext)`を`index.html`へ追加した。**今回の正式化はCompliance Assessment Aggregation Completeまでであり、Compliance Enforcement Complete／Quality Gate Grounding Complete／READY Grounding Complete／User Approval Enforcement Complete／accountCreationReadiness Enforcement Completeとは記録しない**。**Existing Detector再利用**：`evaluateComplianceGate(outputDraft, complianceContext)`と`_apfrEvaluateDisclosureMarkers(outputDraft, complianceContext)`を呼ぶだけで、listingNgWords検索・広告marker検索・`_apfrComplianceGateNormalize()`・`APFR_DISCLOSURE_ACCEPTED_MARKERS`・hashtag token判定・APFR Resolver・`.facts`直接走査のいずれも独自再実装0（前工程のOpus調査で「Quality GateへCompliance結果を直接集約する案は既存4 testのシグネチャ固定Contractを破壊するため不採用」と判断し、新規の集約層として分離した設計判断を踏襲）。**status Contract**：`clear`（blocker0件かつ少なくとも片方が実判定済み）／`blocked`（`evaluateComplianceGate().status==='violation'`または`_apfrEvaluateDisclosureMarkers().status==='missing'`のいずれか）／`not_checked`（両detector not_checked・input不正・例外）の3状態。**blockers**は既存detector結果の要約のみ（`{type, label, detail}`）で新しい意味判定を作らない。**unchecked**はnot_checked項目を握りつぶさず`unchecked[]`へ保持し、例えば`compliance clear + disclosure not_checked`は`status=clear・unchecked=['advertising_disclosure']`となり、**`clear`は「全Compliance完全確認済み」を意味しない**ことをUIでも明示。**fail-open/fail-closed**：明確な違反（violation/missing）のみblocked、判定不能（not_checked）は自動blockせずuncheckedへ保持、例外時もclearを返さずnot_checkedへfail-open。**Non-blocking Contract**：今回のblockedはCompliance Assessment上の状態のみで、`evaluateQualityGate()`／`packageQuality`／`OUTPUT_STATUS.READY`／`approveInstagramPackage()`／`_iadpApproveDesign()`／`pushApprovalToServer()`／`_enqueueApprovalPost()`／`accountCreationReadiness`／Executive Decision Engine／Publishing Readyはいずれも変更0・停止しない。UIにも「※現在は確認表示のみです（検出・集約のみ）。User Approval・READY・Quality Gate・Executive Decisionは自動停止しません。」を明示。**重要な構造ギャップ**：`accountCreationReadiness`はIADP専用のenforcement spineであり、非IADP案件（アフィリエイト記事等）には同等のEnforcement接続先が現状存在しない。これは**Step C-1C-2bの設計課題として未着手のまま残す**。**Numeric Consistency境界**：`_apfrEvaluateNumericConsistency()`（C-2-1）への参照・変更は0、mismatch/uncomparableをblockerに含めない（Step C-2-2として別工程）。**Leader Final Grounding境界**：Option Fはprompt-based preventionでありdeterministic Grounding detectorは存在しないため、「Grounding clear」等のstatusは新設していない。**UI**：既存Compliance Checkパネル内へ「禁止語」「広告開示」に加え「総合：CLEAR/BLOCKED/NOT CHECKED」を独立表示し、blocked時はblocker理由、unchecked項目がある場合は「未検査項目あり」を明示。**保存**：runtime onlyの純関数（DB・Output Draft・APFR Fact・Intelligence Context・Compliance Context・EER・IADP assessmentContext・Quality Gate fieldへの書き込みは0・呼び出しのたび再計算）。**テスト**：新規`apfrComplianceAssessment.test.js` **83/83 PASS**（status Contract 9パターン・fail-open4件・blockers/unchecked検証・Existing Detector再利用のstatic検証・Quality Gate/READY/User Approval/accountCreationReadiness/Numeric Consistency変更0のstatic検証を含む。実装過程でテスト側の検出方法の誤り〔コメント文中の説明語への誤ヒット〕1件を発見・修正）。既存回帰：`apfrComplianceGate` 42/42・`apfrDisclosureDetection` 66/66・`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62・`apfrCaseDataContext` 80/80・`apfrNumericConsistency` 53/53・`apfrCurrentFactResolver` 70/70・`apfrCore` 49/49・`iadpQualityContractRouting` 86/86、他既存重要回帰も新規FAIL0。**`leaderFinalGrounding.test.js` 49/53**（FAIL: 18-1・20-1・20-2a・20-2b。Option F commit時点のCode diff状態を固定するstatic guardが今回の正規`index.html`変更を検出した既知の非機能FAILであり、C-1C-2a機能のFAILではない。**53/53 PASSとは記録しない**。test修正・assertion削除はいずれも行っていない）。`node --check`・`git diff --cached --check`いずれもCLEAN。**localhost**：`/`200・`/api/task-history`200・`/api/workflow-dashboard`200・Console Error0。**fixture確認**：ブラウザ実行環境で`_apfrEvaluateComplianceAssessment()`・`buildComplianceGateHtml()`を一時的な状態差し替え（finally節で確実に復元）を用いて直接呼び出し、clear／blocked／not_checked／clear+uncheckedの4状態のHTML描画を実測確認。fixture実行によるPOST発火**0件**（GETリクエストのみを実測確認）・DB write0・AI API実行0。**Code commit `659e82ceefb899e794b08872b58d2820b357c1df`（`feat: aggregate apfr compliance assessment`）。対象2ファイルのみ（`index.html`／新規`apfrComplianceAssessment.test.js`）・push/Tag/Render未実施**。working treeの別系統runtime差分（`cost-logs.json`／`data/conversations/_meta.json`・既存untracked7件）は本Code commit・本docs追記いずれにも不混入。新規Decision番号は作成せずDecision108へ追記。**Version1 Final Complete／Version1.1 Connected AI Company開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）。以前: 更新日: 2026-08-26（**APFR Step C-1C-1b Advertising Disclosure Detection Code Implementation Complete・Decision108追記**。既存C-1C-1（Deterministic Compliance Check）は`listingNgWords`のみをdeterministicに確認しており、`advertisingDisclosureRequirements`はCompliance ContextとしてWriter/Reviewer/Leader Finalへ到達していたにもかかわらずdeterministic Gateでは一度も評価されていなかった（`evaluateComplianceGate()`は`complianceContext.listingNgWords`を見た時点で早期returnし、他3fieldに触れない実装だった）。Leader Final Grounding Option F実AI E2Eでも、`advertisingDisclosureRequirements`が存在するにもかかわらず【広告】／#PR／#広告等の広告明示が成果物へ反映されない事象を確認しており、この不足を可視化するため**APFR Step C-1C-1bとしてAdvertising Disclosure Detectionを追加した**。**今回の正式化はAdvertising Disclosure Detection Completeまでであり、Compliance Enforcement Complete／Compliance Gate Complete／Quality Gate Grounding Complete／READY Grounding Complete／User Approval Enforcement Completeとは記録しない**。**実装**（`index.html`のみ）：新規`APFR_DISCLOSURE_ACCEPTED_MARKERS`（whitelist：【広告】／【PR】／#広告／#PR／#プロモーション／明示文章3種）と新規純関数`_apfrEvaluateDisclosureMarkers(outputDraft, complianceContext)`を`evaluateComplianceGate()`の兄弟関数として追加（`evaluateComplianceGate()`本体は無変更・listingNgWords Contract非混在）。既存`_apfrComplianceGateNormalize()`（String化→NFKC→lowercase→trim）をそのまま再利用し新しい自然言語解析・fuzzy判定・AI判定は追加していない。ハッシュタグは単純`includes()`ではなくtoken境界完全一致で判定し、`#profile`を`#PR`として誤検出しない。`#アフィリエイト`／`#案件`／`#提供`／文章中の単なる「広告」「PR」等は単独でsatisfiedにしない（whitelist方式・deterministic判定で誤って適法・適切と認定しないことを優先）。**status Contract**：`satisfied`（requirementあり＋Marker1件以上）／`missing`（requirementあり＋Marker0件）／`not_checked`（requirementなし・none・ambiguous・empty array・invalid input・fields不正・例外時）の3状態。`complianceContext.advertisingDisclosureRequirements`が有効なnon-empty arrayとして存在する場合のみ`requirementPresent=true`（C-1Aの既存Contract上none/ambiguousはキー自体が出力されないため自然に`not_checked`となる・C-1Aのshapeは変更0）。**Non-blocking Contract**：`evaluateComplianceGate()`／`evaluateOutputPackageCompleteness()`／`evaluateQualityGate()`／`OUTPUT_STATUS.READY`／`approveInstagramPackage()`／`_iadpApproveDesign()`／`pushApprovalToServer()`／`_enqueueApprovalPost()`／Executive Decision Engine／Publishing Ready／APFR Resolver／C-1A Compliance Context／C-1B Compliance Injection／Leader Final Grounding Option Fはすべて変更0。missingでもQuality Gate／READY／User Approval／Publishing Readyをブロックしない。例外時はsatisfiedを返さずnot_checkedへfail-open。**UI**：既存Compliance Checkパネル内へ「禁止語：CLEAR/VIOLATION/NOT CHECKED」と並べて「広告開示：SATISFIED/MISSING/NOT CHECKED」を独立表示。Instagramのタイアップ投稿ラベル（Paid Partnershipラベル）は外部UI操作でありOutput Draft文字列からは実際に設定されたか確認できないため、Detection結果のsatisfied条件には含めず、UIには「Instagram投稿時はタイアップ投稿ラベルの設定も別途確認してください（本Detectionでは検証していません）」という補足のみを表示（新規Fact作成0・EER変更0・DB保存0）。**保存**：runtime onlyの純関数（DB・Output Draft・APFR Fact・Intelligence Context・Compliance Context・EERへの書き込みは0・呼び出しのたび再計算）。**テスト**：新規`apfrDisclosureDetection.test.js` **66/66 PASS**（Accepted Marker各種・missing・not_checked・NFKC正規化・hashtag token境界・`#profile`誤検出なし・`#アフィリエイト`単独では非satisfied・「広告表示義務について」等の無境界部分一致では非satisfied・mutation0・fetch0・DB write0・AI API0・Existing Compliance Gate/Quality Gate/READY/User Approval変更0のstatic検証を含む）。既存回帰：`apfrComplianceGate` 42/42・`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62・`apfrCaseDataContext` 80/80・`apfrCurrentFactResolver` 70/70・`apfrCore` 49/49・`iadpQualityContractRouting` 86/86、他既存重要回帰も新規FAIL0。**`leaderFinalGrounding.test.js` 49/53**（FAIL: 18-1・20-1・20-2a・20-2b。これはOption F commit時点のCode diff状態を固定するstatic guardが今回の正規`index.html`変更を検出した既知の非機能FAILであり、C-1C-1b機能のFAILではない。**53/53 PASSとは記録しない**。test修正・assertion削除はいずれも行っていない）。`node --check`・`git diff --cached --check`いずれもCLEAN。**localhost**（`npm run dev-check`）：`/`200・`/api/task-history`200・`/api/workflow-dashboard`200・Console Error0。fixture実行（ブラウザ実行環境で`_apfrEvaluateDisclosureMarkers()`・`buildComplianceGateHtml()`を一時的な状態差し替え・finally節で確実に復元して直接呼び出し）でsatisfied/missing/not_checkedの3状態を確認、fixture実行によるPOST発火0件・DB write0・AI API実行0。**Code commit `e23c0df88d7aca485f576124677735aa080441ee`（`feat: detect advertising disclosure markers`）。対象2ファイルのみ（`index.html`／新規`apfrDisclosureDetection.test.js`）・push/Tag/Render未実施**。working treeの別系統runtime差分（`cost-logs.json`／`data/conversations/_meta.json`・既存untracked7件）は本Code commit・本docs追記いずれにも不混入。新規Decision番号は作成せずDecision108へ追記。**Version1 Final Complete／Version1.1 Connected AI Company開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）。以前: 更新日: 2026-08-26（**Leader Final Grounding Option F Code Implementation Complete・実AI E2E Validated・Decision108追記**。Path A実AI E2Eで、LCC Phase2 + Option BによりContext自体はLeader Finalまで正常到達しているにもかかわらず、Writerが情報不足で正しく停止したのにLeader Finalがそれを乗り越えCASE CONTEXT外の具体的事実を捏造する問題を発見（**LCC Phase2 + Option Bの失敗ではなくLeader Final Grounding層限定の問題**）。Option F修正前の実測：Context外具体的捏造12件・Formal Truth意味誤用3件（例：`approvalRate=100`→「100%審査通過済み」等）・架空キャンペーン/特典あり・Writer停止判断の不正上書きあり（**捏造成果物でもQuality Gate=passed・READY相当のまま素通し**）。根本原因＝Leader Finalは`buildSystemPrompt()`を経由せず固定`LEADER_FINAL_PROMPT`を直接使用するため、Writer/Researcher/Reviewer/Strategyへ適用済みの`formalTruthRule`完全版が届いていなかった。**Option F実装**（`openaiClient.js`のみ）：①`formalTruthRule`を`_buildFormalTruthRuleText(hasCaseContext)`へ単一ソース化（挙動不変のリファクタ）②新規`_buildLeaderFinalGroundingBlock(caseContext, ruleFacts)`をcaseContext存在時のみquestion側へ追加（`LEADER_FINAL_PROMPT`本体は無変更・caseContextなし経路はfail-open維持）③Formal Truthのfield意味・用途を維持し別概念へ読み替え禁止という条項を新設（`approvalRate`／`cookieWindowDays`／`mobileOptimized`の実測誤用例を明示）④既存`shared/leaderRuleEngine.js`の`evaluateLeaderRuleFacts()`を再利用し`informationInsufficient.count>0`時のみ「Leaderが担当社員の停止判断を創作で上書きしてはならない」というfail-closed文を追加。`index.html`／`server.js`／`claudeClient.js`／`shared/leaderRuleEngine.js`／APFR Resolver／Quality Gate／READY／Compliance Gate／DB schemaはいずれも変更0。新規`leaderFinalGrounding.test.js` **53/53 PASS**（AI API呼び出し0・DB write0の合成テスト）、`apfrCaseDataContext.test.js`はtest 40のみ同一Contractへ追随修正し**80/80 PASSへ復旧**、既存回帰（`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62等）全PASS・新規FAIL0。**実AI E2E**（本物のPath A workflow・安全なcandidateOnly方式・本番Draft無変更・API6回・実測約16.4円）でOption F後は具体的捏造0件・Formal Truth意味誤用0件・架空キャンペーン/特典0件・Writer停止判断の不正上書き0件を確認。ただし`#敏感肌`「自然由来のスキンケア」等、Formal Truthに直接裏付けのない評価的・示唆的表現が軽微に残存。**正式判定：Leader Final Grounding＝B（軽微な表現問題のみ）・Option F実AI E2E＝A（成功）**。「Leader Final Grounding Complete」「Grounding Enforcement Complete」とは記録しない。**重要な非依存関係**：Option F実AI E2E成功 ≠ Compliance Enforcement Complete（`advertisingDisclosureRequirements`到達済みだが【広告】等の明示表示なし・別課題）≠ Quality Gate Grounding Complete（現行Gateは構造充足中心のまま変更0）≠ READY Grounding Complete（`integratedCount>0`が主条件のまま変更0）。**Data Safety**：E2E前後でfacts22件・intelligenceContext・IADP・EER3件・User Approvalいずれも完全一致・output_drafts write0・APFR/EER/IADP変更0。**Code commit `04e28a08793218ceaf59dd8fa228333bb58fcd0c`（`feat: ground leader final in formal truth context`）。対象3ファイルのみ（`openaiClient.js`／`apfrCaseDataContext.test.js`／新規`leaderFinalGrounding.test.js`）・push/Tag/Render未実施**。新規Decision番号は作成せずDecision108へ追記。working treeの別系統runtime差分（`cost-logs.json`／`data/conversations/_meta.json`・既存untracked7件）は本Code commit・本docs追記いずれにも不混入。**Version1 Final Complete／Version1.1 Connected AI Company開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）。以前: 更新日: 2026-08-25（**Leader Case Context Phase2 + Option B Code Implementation Complete・Decision108追記**。Instagram実運用で判明した「保存済み商品情報・Intelligence・APFR Formal Truthが存在するのにAI社員が『確認できない』と回答し情報不足のままReady到達する」不具合を解消。原因＝本番にCase Context配線（`caseContext`/`hasCaseContext`/`formalTruthRule`）自体が未commit（Leader Case Context Phase2）で、かつLCC Phase2単独でもAPFR Formal Truth・Intelligenceを含まないこと。LCC Phase2＝`caseContext`文字列契約をPath A/B・OpenAI/Claude両Providerへ配線。Option B＝新規`_buildCaseDataContext()`がAPFR Resolver（client専用維持）を呼びresolvedのみのFormal Truthと6 Intelligenceモジュール要約をserverへ受動パススルー（Resolver再実装0・C-1A test 10-6維持・payoutの数値変換等は行わない）。Payload実測約2,359B（全体25,008Bの約1/10.6）。実AI E2E（Path B・実案件`case-msr9yckye65y`・本番Draft無変更・API5回・¥11.5）でWriter/Researcher/Reviewer/Strategy全員のContext到達・捏造0・Formal Truth矛盾0を実証。テスト：新規`apfrCaseDataContext.test.js` 80/80 PASS・既存回帰16スイート全PASS・新規FAIL0。**Code commit `95eaa899`済み・push/Tag/Render未実施**。**LCC Phase2 + Option B Complete ≠ Leader Final Grounding Complete ≠ Quality Gate Grounding Complete ≠ READY Grounding Complete**（Path A実AI E2E・Quality Gate観察・READY観察・Leader Final fail-closed・Quality Gate Grounding Enforcementはいずれも未検証・未実装）。次工程は正式リリース前最終検証。新規Decision番号は作成せずDecision108へ追記）。以前: 2026-08-25（**APFR Step C-2-1 Formal Truth Numeric Consistency Check 正式リリースComplete・Decision108追記**。正式リリース前最終検証（C-2-1専用53/53・既存回帰15スイート全PASS・新規FAIL0・`node --check` OK・`git diff --check` CLEAN・LCC混入0・server/openaiClient/claudeClient変更0・Non-blocking Contract無変更を`git show`で直接再確認）ののち、クリーンなlocalhost状態でdev-checkを実行し**200/200/200を取得**。Code commit `9cf7ab9` ＋ docs commit `38ac9aa`を**main push**（HEAD/origin/main `38ac9aa...`・ahead/behind 0/0）、**正式Tag `v1.01-apfr-formal-truth-numeric-consistency`（Annotated・target `38ac9aa...`）を作成しtag push済み**。**Render**自動Deployで本番反映済み（本番3endpoint200・`_apfrEvaluateNumericConsistency`／`buildFormalTruthConsistencyHtml`／Output Engine配線の存在を直接curl取得で確認・LCCマーカー0）。実案件データによるmatch/mismatch/uncomparable表示の本番確認は、合言葉認証保護のため今回未実施（C-2-1専用テスト53件＋localhost fixture確認による代替確認済み）。**C-2-1 Complete ≠ Intelligence Score Enforcement Complete**（score接続はStep C-2-2として別工程・未着手）。次工程はユーザー承認後に選定。新規Decision番号は作成せずDecision108へ追記）。以前: 2026-08-25（**APFR Step C-2-1 Formal Truth Numeric Consistency Check Code Implementation Complete・Decision108追記**。Product Intelligenceのscore計算が使用する`product.inputs`側`payout`／`epc`／`approvalRate`とAPFR Formal Truth側の同名Fact（既存Resolver経由）の数値整合をread-onlyで確認する`_apfrEvaluateNumericConsistency()`／`buildFormalTruthConsistencyHtml()`を実装（Code commit `9cf7ab92028e4280e83153a3c046a588187aedff`）。4状態Contract＝match／mismatch／uncomparable／not_checked。payoutはAPFR側`type:'string'`のため常にuncomparable（数値変換を新設しない）。`_aicIntegratedScore()`／score／User Approval／READY／Quality Gate／Compliance Gateはいずれも無変更・判定結果は保存しない（runtimeのみ）。**C-2-1 Complete ≠ Intelligence Score Enforcement Complete**（score接続はStep C-2-2として別工程・未着手）。新規`apfrNumericConsistency.test.js` 53/53 PASS・既存回帰全PASS・新規FAIL0。LCC Phase2混入0（HEADベース合成patchで分離）。localhost fixture確認でConsole Error 0・DB書き込み0を確認。**Code commit済み・push/Tag/Render未実施**。次工程はC-2-1正式リリース前最終検証（C-2-2へは先に進まない）。新規Decision番号は作成せずDecision108へ追記）。以前: 2026-08-24（**APFR Step C-1C-1 正式リリースComplete・Decision108追記**。正式リリース前最終検証（C-1C-1 42/42・C-1A 48/48・C-1B 62/62・既存回帰全PASS・新規FAIL0・LCC混入0再確認）ののち、クリーンなlocalhost状態でdev-checkを実行し**200/200/200を取得**。Code commit `d8e7021` ＋ docs commit `a2bd95a`を**main push**（HEAD/origin/main `a2bd95a...`・ahead/behind 0/0）、**正式Tag `v1.01-apfr-deterministic-compliance-check`を作成しtag push済み**。**Render**自動Deployで本番反映済み（本番3endpoint200・`evaluateComplianceGate`/`buildComplianceGateHtml`とOutput Engine配線の存在確認）。実案件データによるCLEAR/VIOLATION/NOT CHECKED表示の本番確認は、合言葉認証保護・不要なAI API課金回避のため今回未実施（C-1C-1テスト42件による代替確認済み）。**C-1C-1 Complete ≠ Compliance Enforcement Complete**（User Approval／READYへの実ブロック接続はStep C-1C-2として別工程・未着手）。**次工程はC-1C-2含め未着手・ユーザー承認後に選定**。新規Decision番号は作成せずDecision108へ追記）。以前: 2026-08-24（**APFR Step C-1C-1 Deterministic Compliance Check Code実装Complete・Decision108追記**。C-1C調査・設計の結論どおり`listingNgWords`のみを対象とした非ブロッキングDeterministic Compliance Checkを実装（Code commit `d8e7021`）。新規`evaluateComplianceGate()`はC-1Aの`complianceContext`のみをconsumerとしfacts・Resolverを直接参照せず、NFKC正規化＋部分一致のみで判定（NLP・fuzzy matching不使用）。`clear`／`violation`／`not_checked`の3状態、`none`／`ambiguousは区別せず`not_checked`統一（fail-closed）。`advertisingDisclosureRequirements`／`complianceRestrictions`／`regulatoryCategory`／`listingPolicy`は今回対象外（理由は個別に明記）。新規`buildComplianceGateHtml()`はOutput Package Qualityと独立表示・非ブロッキング明示文言あり。**`packageQuality`／`evaluateQualityGate()`／`OUTPUT_STATUS.READY`／IADP `canApprove`／User Approvalはいずれも無変更**。**正式名称は「APFR Step C-1C-1 Deterministic Compliance Check」——実ブロック接続はStep C-1C-2として別工程・未着手**。テスト：C-1C-1専用42/42 PASS・既存回帰全PASS・新規FAIL0。localhost実機でCLEAR/VIOLATION/NOT CHECKEDの3表示・Console Error 0を確認。LCC Phase2混入0（HEADベース合成patchで分離・3 hunkとも削除行0）。**Code commit済み・push/Tag/Render未実施**。次工程＝**C-1C-1正式リリース前最終検証**（C-1C-2へは先に進まない）。新規Decision番号は作成せずDecision108へ追記）。以前: 2026-08-24（**APFR Step C-1A / C-1B 正式リリースComplete・Decision108追記**。正式リリース前最終検証（C-1A 48/48・C-1B 62/62・既存回帰全PASS・新規FAIL0・LCC混入0再確認）ののち、クリーンなlocalhost状態でdev-checkを再試行し**200/200/200を取得**。Code commit3件（`9d66525`／`f52511`／`3793752`）を**main push**（HEAD/origin/main `3793752...`・ahead/behind 0/0）、**正式Tag `v1.01-apfr-compliance-injection`を作成しtag push済み**。**Render**自動Deployで本番反映済み（本番3endpoint200・新関数`_apfrBuildComplianceContext`の存在確認）。Writer/Reviewerへの実際のCompliance Block注入は実AI API課金を避けるため本番実行では未確認（C-1Bテスト62件による代替確認済み）。**次工程はC-1C含め未着手・ユーザー承認後に選定**。新規Decision番号は作成せずDecision108へ追記）。以前: 2026-08-24（**APFR Step C-1A Compliance Context Foundation ＋ Step C-1B Writer/Reviewer Compliance Injection Code実装Complete・Decision108追記**。Step C-1A（Code commit `9d66525`）＝Compliance Formal Truth 4field（listingNgWords／advertisingDisclosureRequirements／complianceRestrictions／regulatoryCategory。listingPolicyは対象外）をResolverから`atRunWorkflow()`→`/api/auto-task`→server.js受動パススルー→`runAutoTaskWorkflow()`までread-only配線（prompt実注入0）。Step C-1B（Code commit `f52511`）＝`buildCompliancePromptBlock()`でWriter・Reviewerへ限定注入（Strategy/Leader Finalへは注入せず、Reviewerフィードバックは既存経路でLeader Finalへ統合）。Fact値はデータ枠として明示しsystem instruction化しない設計・empty時はC-1B前promptとbyte-identical。**Quality Gate Compliance EnforcementはStep C-1C候補として未実装**。テスト：C-1B専用62/62・C-1A更新後48/48・既存回帰全PASS・新規FAIL0。**dev-check**：`/api/workflow-dashboard`はC-1Bと無関係なSupabase応答時間変動によりこのセッション内で200未確定——**environment Pendingとして記録しPASS扱いにしない**。working treeのLeader Case Context Phase2はC-1A/Bとも混入0（HEADベース合成patchで分離）。**Code commit 2件済み・push/Tag/Render未実施**。次工程＝**C-1A+C-1B正式リリース前最終検証**（C-1Cへ先に進まない）。**docs更新のみ・DB/API/Fact変更0**。新規Decision番号は作成せずDecision108へ追記）。以前: 2026-08-24（**APFR Correction UI Core 本番認証後最終目視確認Complete・Decision108追記**。ユーザー本人が本番URLへ認証後ログインし実ブラウザで確認：resolved Fact行の「訂正」ボタン表示／Correction modeへの正常遷移／現在値の正常表示／field固定表示／新しい値入力欄が空（旧値自動コピーなし）／「訂正をやめる」正常表示／cancel後の通常モード復帰（Correction Target残留なし）。**「確認済みFactとして登録」は押していないためCorrection Fact登録0・本番Fact変更0・DB書き込み0を維持**。**Console Errorの追加実測は今回のスクリーンショット確認では未実施**（既存テスト・localhost確認のConsole Error 0記録は不変）。**Correction UI Core系列（CUI-0〜CUI-2）に残っていたリリース確認Pending＝本番認証後の実ブラウザ目視確認がComplete**となり、**Correction Contract／Resolver／CUI-0／CUI-1／CUI-2／正式リリース／本番認証後最終目視＝すべてComplete・Pendingは0**。**次工程＝APFR Correction UI後の次工程選定・調査**（CUI-3／CUI-4／ITP `7days` field／APFR Step Cの必要性を比較。未着手・ユーザー承認なしに自動開始しない）。**本docs更新のみ・Code/DB/API変更0・Fact登録0・新規Tag/Tag変更/Render操作0・LCC Phase2不混入**。新規Decision番号は作成せずDecision108へ追記）。以前: 2026-08-24（**APFR Correction UI Core CUI-0〜CUI-2 正式リリースComplete・Decision108追記**。Code commit **fd99134**・docs commit **186ec63** を**main pushし、HEAD／origin/main とも `186ec6371676e0ad9ab49368f2899bf9e4155f90` へ同期（ahead/behind 0/0）**。**正式Tag `v1.01-apfr-correction-ui-core`（Annotated・message「APFR Correction UI Core CUI-0 to CUI-2 complete」・target `186ec637...`）を作成しtag push済み**。**Render**：main push後の通常Deployで本番反映済み（本番トップ200／`/api/task-history`200／`/api/workflow-dashboard`200）。本番配信コードに`_apfrCorrectionTargetFor`／`_apfrStartCorrection`／`_apfrCancelCorrection`／`_apfrValidateCorrectionTarget`／`_apfrBuildCorrectionHeaderHtml`すべて存在確認、`buildLeaderCaseContext`は本番0件のまま（**LCC Phase2は引き続き本番未リリース**）。**本番検証（区別して記録）**：①**Complete**＝本番配信コードを本番Supabase実データ（`case-msr9yckye65y`／プラファスト22 Fact）へ**read-onlyで適用**し、Resolver結果`resolved`21／`none`0／`ambiguous`0、resolved行相当の訂正ボタン21件（`disabled`属性混入なし）、`listingNgWords`でのCorrection mode生成（見出し・現在値`["商品名","法人名"]`表示・入力欄への値注入なし・「訂正をやめる」存在）、submit直前検証（`{mode:'correction', supersedesFactId:...}`）が正常動作することを確認。Historyは22件・既定閉。**facts配列は実行前後で完全不変・DB書き込み0**。②**Pending**＝本番URLが「合言葉を入力してください」の認証画面で停止しており、**認証情報の提供を受けていない**ため、**認証後の実ブラウザ操作による最終目視確認のみ未実施**（Correction UI正式リリースの失敗を意味しない。「本番ログイン後の実画面で訂正→キャンセルを目視確認済み」とは記録しない）。テスト結果：CUI-2 105/105・CUI-1 78/78・CUI-0 65/65・Resolver 70/70・Phase 0 40/40・APFR Core 49/49・Manual Input UI 35/35・EER 51/51・IADP/Quality Gate 86/86・IADP Structured 13/13・Evidence 17/17・Cost 19/19、**新規FAIL 0**、dev-check **200/200/200**、`git diff --check` **CLEAN**（正式リリース前に再確認済み）。**Data Safety**：Correction Fact登録0・本番Fact変更0（プラファスト22 Factは不変）・DB schema変更0・API変更0・`server.js`変更0・Render設定変更0・環境変数変更0。**正式現在地＝Correction Contract／Current Fact Resolver／CUI-0／CUI-1／CUI-2すべてComplete・APFR Correction UI Core CUI-0〜CUI-2＝正式リリースComplete**。**次工程＝本番認証後のCorrection UI最終目視確認**（ユーザー本人が、訂正ボタン・訂正モード・field固定・現在値表示・入力欄空・訂正をやめる・cancel後通常表示・Console Errorを確認。**本番でCorrection Fact登録ボタンは押さない**）。新規Decision番号は作成せずDecision108へ追記。**docs更新のみ・Code/DB/API変更0・新規push/Tag/Render操作0・Leader Case Context Phase2不混入**。**Version1 Final Complete／Version1.1開発中・Phase54 Complete維持・Phase55未着手**（すべて変更なし）。詳細はDecision108参照。以前: 2026-08-23（**APFR CUI-2 Correction UI Core 正式化Complete・Decision108追記**。Code commit **fd99134**（`feat: add apfr correction ui core`・`index.html` +165/-5・`apfrCorrectionUi.test.js` 新規804行）。**CUI-2は、Resolverで`resolved`となった現在Factをユーザー操作によって正式なCorrection Recordとして訂正するUI**である。正式フローは`Resolver`→`resolved` current Fact→Current Fact UI「訂正」→**Correction Target**→Manual Input UIの訂正モード→**submit直前のResolver再検証**→`supersedesFactId`自動付与→**既存APFR Core**→append-only保存→Resolver再評価→新Factがcurrent／旧FactはHistory。**Correction Target**（`_apfrCorrectionTarget`）は`caseId`／`productIdentifier`／`field`／`currentFactId`の**4項目のみ**を保持し、**Fact本文（value/sourceMethod/verificationStatus/classification）は保持しない**（Formal Truthの複製を作らない）。**status別契約**：`resolved`のみ訂正可（対象はResolverの`currentFact`のみ）／`none`はCorrectionでなく通常新規登録で**`supersedesFactId`を付けない**／**`ambiguous`は訂正ボタン非表示・Correction禁止・候補Factの代表選択なし**（Ambiguity Contractのfail-closedをUIでも維持）。**stale Target対策（重要）**：Correction開始時だけでなく**submit直前にもResolverを再実行**し`status==='resolved' && currentFact.factId === target.currentFactId`を要求。不一致（current変化／ambiguous化／none化）時は**登録停止・append 0・Target破棄・fail-closed**とし、**古いFactへ訂正をつないで`branched_chain`を生成する事故を防止**（実測確認済み）。**scope安全性**：**Cross-case／Cross-product／Cross-field をいずれも禁止**し、fieldは**UI固定（`selected`＋`disabled`）＋submit時の一致再検証**の二重防御（UI固定だけに依存しない）。product scope比較は既存の`String()`厳密比較方式を流用。**append-only維持**（旧Factの編集・削除・置換・`superseded:true`等のmutationは実装なし）。**duplicate判定はCUI-0のCorrection-aware Duplicate Policyをそのまま再利用**しCUI-2独自判定は0（検証順序は stale再検証→Core duplicate判定。**stale時はTarget破棄／duplicate等の通常failure時はTarget保持**して値を直して再試行できる）。**User Verification維持**（Correction専用Validatorなし・`manual_user_input`やチェック未了は訂正でもfact昇格しない・**AI自動訂正禁止**）。追加state 1・追加helper 5（`_apfrCorrectionTargetFor`／`_apfrStartCorrection`／`_apfrCancelCorrection`／`_apfrValidateCorrectionTarget`／`_apfrBuildCorrectionHeaderHtml`）・変更関数5（`_apfrBuildCurrentFactsHtml`／`_apfrBuildPanelHtml`／`_apfrOnFormChange`／`_apfrRegisterFromUi`／`_apfrBuildFieldOptionsHtml`の任意引数対応）で、**Core 3関数・Resolver 4関数・`_apfrBuildHistoryHtml`はいずれも無変更**。`supersedesFactId`の代入はコード全体で**1箇所のみ**かつ**再検証を通過したTargetからのみ**（DOM値・ボタン引数・ユーザー入力から直接設定しない）。新規テスト`apfrCorrectionUi.test.js` **105/105 PASS**（22ケース群）、既存回帰全PASS（CUI-1 78/78・CUI-0 65/65・Resolver 70/70・Phase 0 40/40・APFR Core 49/49・Manual Input UI 35/35・EER 51/51・IADP Quality 86/86・IADP Structured 13/13・Evidence 17/17・Cost 19/19）・**新規FAIL 0**・`node --check` OK・`git diff --check` CLEAN・dev-check **200/200/200**・localhost合成fixtureで**Console Error 0**および通常Manual Input UI無回帰を確認。**実DBへのCorrection Fact登録0件・本番`case-msr9yckye65y`の22 Factは無操作**。**DB変更0・API変更0・`server.js`変更0**。新規Decision番号は作成せずDecision108へ追記。**⚠ CUI-2 Completeは「Correction UI Coreの完成」であり、CUI-3／CUI-4／APFR Step C／Product・ASP Intelligence接続／EEA問題／Quality Gate・Hold問題／Leader Case Context Phase2 のCompleteをいずれも意味しない**。**現在地の内訳＝Correction Contract／Current Fact Resolver／Correction-aware Duplicate Policy（CUI-0）／Current Fact・History UI（CUI-1）／Correction UI Core（CUI-2）＝すべてComplete。すなわちCorrection UI Core系列（CUI-0〜CUI-2）は実装Complete。ただし正式Tag・正式リリースは未実施**。**次工程＝CUI-0/CUI-1/CUI-2をまとめたCorrection UI全体の正式リリース**（Code＋docs push → Annotated Tag → Render反映 → 本番UI確認）。**docs更新のみ・Code変更0・DB/API/Fact変更0・Code push未実施・docs push未実施・Tag未作成・Render未操作・Leader Case Context Phase2不混入**。**Version1 Final Complete／Version1.1開発中・Phase54 Complete維持・Phase55未着手**（すべて変更なし）。詳細はDecision108参照。以前: 2026-08-23（**APFR CUI-1 Current Fact / History UI 正式化Complete・Decision108追記**。Code commit **1cf3b2e**（`feat: add apfr current fact ui`・main push済・Render自動Deploy反映確認済・**Tag未作成**）。Step B以降、APFRパネルの「登録済み情報」が`product.facts`を配列順に**全件フラット表示**していたため、本番実案件の`listingNgWords`で旧Fact`["法人名"]`と訂正Fact`["商品名","法人名"]`が同じ見た目で2行並び、**ユーザーがどちらを現在の正式値として扱うべきか画面上で判断できない**状態だった問題を解消した（Resolverは実装済みだがUIからは未使用だった）。**Phase 1 Current Fact Resolverを初めてUIへ接続**（表示専用・read-only）。**Current Fact UI Contract**として、現在値一覧は**`_apfrResolveCurrentFacts(product)`の結果のみを使用**し、UI側が`facts`配列末尾・`recordedAt`最新・`sourceMethod`・`value`・配列順から独自にcurrent Factを決定することを**禁止**（**ResolverはUIにおいてもcurrent Fact判定の唯一の口**。実装の静的検証をテストへ組み込み）。`resolved`のみ`currentFact`を「現在の情報」に表示し**旧Factを現在値一覧へ混在させない**（表示順は`APFR_FIELD_ORDER`）、`none`は「○ 未登録」で21フィールドの充足状態を可視化、**`ambiguous`は`currentFact`を表示せず**理由と候補件数のみ示し**候補Factのうち1つを勝手に代表表示しない**（Ambiguity Contractのfail-closedをUI上でも維持）。**全件フラット表示を廃止し「現在値一覧＋折りたたみHistory（`<details>`・既定閉）」へ分離**。Historyはappend-onlyの全Factを保持表示し、「現在値」「過去の記録」の区別は**Resolver結果から表示時に動的導出のみ**で**旧Factへ`superseded`状態等を保存しない**。通常表示は21行固定のため**Factが50件・100件に増えても通常画面が履歴件数に比例して長くならない**。**boolean日本語表示を同時実装**（`productLinkAvailable`＝利用可/利用不可、`reviewRequired`＝あり/なし、`mobileOptimized`・`itpSupported`・`linkManagerSupported`＝対応/非対応。Manual Input UIのboolean selectも`option value`は`true`/`false`のまま維持で**labelのみ**日本語化。**保存値は`boolean`のまま不変**）。`listingPolicy`の`"一部ok"`は**normalizeせず保存値のまま表示**（訂正は将来Correction UIでユーザー本人が実施）。**listingNgWords実例**：現在値一覧は`["商品名","法人名"]`のみ、Historyは旧・新2件保持、**旧FactのDB変更・削除・mutation 0件**。CUI-1専用テスト`apfrCurrentFactUi.test.js` **78/78 PASS**、既存回帰全PASS（CUI-0 65/65・Resolver 70/70・Phase 0 40/40・APFR Core 49/49・Manual Input UI 35/35・EER 51/51・IADP Quality 86/86・IADP Structured 13/13・Evidence 17/17・Cost 19/19）・**新規FAIL 0**・dev-check **200/200/200**・localhost実機**Console Error 0**。旧`_apfrBuildFactsListHtml()`は完全置換（残存参照0件）。新規Decision番号は作成せずDecision108へ追記。あわせて**陳腐化した2記述を訂正**（Phase 1「Resolver UI未接続」／Step C開始条件「UIにも未接続」→UIへは表示専用接続済み・Intelligence/scoreへは未接続）。**現在地の内訳＝Correction Contract／Resolver／Duplicate Policy（CUI-0）／Current Fact・History UI（CUI-1）＝Complete、Correction UI Core（CUI-2）＝未実装**。残課題3（boolean日本語表示）は**Complete**へ更新、残課題2・4〜9は未解決のまま維持。**docs更新のみ・Code/DB/API/Fact変更0・Tag未作成・push未実施・Render追加操作なし・Leader Case Context Phase2不混入**。**Version1 Final Complete／Version1.1開発中・Phase54 Complete維持・Phase55未着手**（すべて変更なし）。詳細はDecision108参照。以前: 2026-08-22（**APFR CUI-0 Correction-aware Duplicate Policy 正式化Complete・Decision108追記**。Code commit **9ad76f8**（`fix: support apfr correction duplicates`）。Phase 1で正式化したCorrection Contractが表現する多段訂正のうち、`A(value=1)`→`B(value=2, supersedes A)`→`C(value=1, supersedes B)`という**「元の値への正式な差し戻し訂正」が`_apfrRecordsEqual()`の比較に`supersedesFactId`が含まれていなかったため`duplicate_record`で誤拒否**されていた問題を解消した。**`supersedesFactId`をduplicate identityの比較要素へ追加**（8→9項目）し、`C`は`A`と`value`が同じでも訂正関係が異なるため別の正式Correction Recordとして扱う。一方で**全9項目（`caseId`/`productIdentifier`/`aspName`/`field`/`classification`/`sourceMethod`/`sourceReference`/`value`/`supersedesFactId`）が一致する完全同一Correction Recordは従来どおり`duplicate_record`で拒否**し、**duplicate防止自体は弱めていない**。未設定は既存`aspName`／`sourceReference`と同じ`(a.supersedesFactId || null)`方式に揃え、**property未存在／`undefined`／`null`／`''`をすべて「訂正関係なし」として同一扱い**、**通常Record同士のduplicate判定はCUI-0以前から一切変更なし**（CUI-0前実装との機械比較で全差分パターン一致を確認）。**責務境界**：chain異常（orphan／self／cross-field／cross-case／cross-product／branched／circular）の判定は**duplicate関数の責務ではなく**Phase 1 Resolverが`ambiguous`＋`currentFact:null`のfail-closedで処理する。**append-only原則は不変**（旧Factのmutation・削除・`superseded`書き込み0件・`A→B→C`はFact総数3件として全件保持）。CUI-0専用テスト`apfrCorrectionDuplicate.test.js` **65/65 PASS**、既存回帰全PASS（Resolver 70/70・Phase 0 40/40・APFR Core 49/49・Manual Input UI 35/35・EER 51/51・IADP Quality 86/86・IADP Structured 13/13・Evidence 17/17・Cost Tracker 19/19）・**新規FAIL 0**・dev-check **200/200/200**。main push済み・**Render自動Deployにより本番配信コードへの反映を確認済み**・**CUI-0用Tagは未作成**。新規Decision番号は作成せずDecision108へ追記（既存Correction Contractのduplicate policy側の補完のため）。**現在地の内訳＝Correction Contract：Complete／Current Fact Resolver：Complete／Correction-aware Duplicate Policy：Complete／Correction UI：未実装**。残課題2〜9（ITP日数field／boolean日本語表示／`listingPolicy`表記統一／フィールド選択UI／直接ジャンプ導線／入力省力化／EEA問題／Quality Gate・Hold問題）は未解決のまま維持。**docs更新のみ・Code/DB/API/Fact変更0・Tag未作成・push未実施・Render手動操作なし・Leader Case Context Phase2不混入**。**Version1 Final Complete／Version1.1開発中・Phase54 Complete維持・Phase55未着手**（すべて変更なし）。詳細はDecision108参照。以前: 2026-08-22（**APFR Phase 0 再Adopt時Fact消失防止＋Phase 1 Current Fact Resolver Contract 正式化Complete・Decision108追記**。**Phase 0**（Code commit **d69ff60**・`fix: preserve apfr facts on readopt`）＝商品採用処理が`_intelSyncProductFromAffiliate()`→`_intelBlankProduct()`（`facts:[]`）由来の新productを`ctx.product`へ丸ごと代入するため、**同一商品を再Adoptすると登録済みAPFR Factが全消失する**潜在的データ損失リスクを発見・解消した。純関数`_apfrCarryOverFacts()`により**同一caseId かつ 同一productIdentifier の場合のみ**carry-over（別case／別商品は0＝Cross-case/Cross-product guard）・deep clone・入力非破壊・配列順と訂正履歴を維持。合成テスト**40/40 PASS**。**Phase 1**（Code commit **46c51ef**・`feat: add apfr current fact resolver`）＝APFRが追記専用であることに対応する読み取り側の正本決定責務を、read-only純関数`_apfrResolveCurrentFact(product, field)`／`_apfrResolveCurrentFacts(product)`として実装し、**Current Fact Resolver／Correction／Ambiguity（fail-closed）／Legacy Fallback／Step C開始条件**の各Contractを正式化した。解決順序は①明示訂正chain（任意field`supersedesFactId`）を最優先→②明示関係が対象field内に皆無の場合のみ`recordedAt`最大→③一意決定不能は`ambiguous`＋`currentFact:null`。母集団はcaseId/productIdentifier/field完全一致かつ`validateApfrRecord()` validのみで**Cross-case・Cross-product・invalid Factを除外**。**明示chainと独立legacyの並存・timestamp collisionはいずれもambiguous**とし、**factId辞書順・配列順・sourceMethod優先・value比較といった恣意的tie-breakerは使わない**。**既存プラファスト22 Factはmigration不要**で`listingNgWords`はlegacy fallbackにより新Fact`["商品名","法人名"]`をresolved・旧Factは`candidates`に残存。本番相当fixture（21 field/22 records）で**resolvedCount=21・noneCount=0・ambiguousCount=0**。合成テスト**70/70 PASS**。既存回帰全PASS（APFR Core 49/49・Manual Input UI 35/35・EER 51/51・IADP Quality 86/86・IADP Structured 13/13・Evidence 17/17・Cost Tracker 19/19）・**新規FAIL 0**・dev-check **200/200/200**。**Resolverはread-only・UI未接続・Step C未接続・DB書き込み0**。既存enum・Fact昇格条件・保存先・責務境界・duplicate policy・append-onlyをいずれも変更しない読み取り規則の補完のため**新規Decision番号は作成せずDecision108へ追記**と判断。残課題1は「Contract明文化Complete／**Correction UIは未実装**」へ更新、残課題2〜9（ITP日数field／boolean日本語表示／`listingPolicy`表記統一／フィールド選択UI／直接ジャンプ導線／入力省力化／EEA問題／Quality Gate・Hold問題）は未解決のまま維持。**docs更新のみ・Code/DB/API/Fact変更0・Tag/Push/Render未実施・Leader Case Context Phase2不混入**。**Version1 Final Complete／Version1.1開発中・Phase54 Complete維持・Phase55未着手**（すべて変更なし）。詳細はDecision108参照。以前: 2026-08-22（**APFR プラファスト本番実運用検証Complete・Decision108追記**。対象実案件`case-msr9yckye65y`／productIdentifier`["プラファスト","a8.net"]`／ASP `A8.net`について、ユーザー本人が本番UIでAffiliate Evaluation登録・商品採用を実施しAPFRパネル出現を確認した上で、**APFR_FIELD_ORDER全21フィールドを1フィールドずつ登録**した。**21/21カバーComplete**・Fact総**22レコード**（`listingNgWords`のみ訂正履歴として旧Fact`["法人名"]`が残存。最新正Factは`["商品名","法人名"]`。**総レコード数ではなく「21フィールドすべてに正しい最新Factが存在するか」で判定**）・**Contract違反0件**・**Cross-case混入0件**（32案件・67 draft行走査）・Persistence確認済み。最新有効21Factはすべて`classification:'fact'`／`verificationStatus:'user_verified'`／`verifiedBy:'user'`、`sourceMethod`は`a8_screen_user_verified` 21件・`advertiser_lp_user_verified` 1件（`regulatoryCategory`のみ）で、**AI推測によるFact昇格0件・`manual_user_input`単独からのFact昇格0件**。無回帰実測：IADP Quality=**100/complete**・Quality Gate=**Passed**・Reviewer=**Passed**・Strategy=**Accepted**・User Approval=**Approved**・External Execution=**3件executed**・Evidence=**9件**。残課題9件（同一fieldへの複数Fact存在時の最新採用ルール未明文＝Step C前提／ITP「7days」保存field不在／boolean日本語表示／`listingPolicy`表記統一／フィールド選択UI／直接ジャンプ導線／入力省力化／EEA問題／Quality Gate・Hold問題）を分離記録。**APFR実運用Complete≠EEA問題Complete／≠Quality Gate・Hold問題Complete**。Claude Codeは読み取り専用確認のみでFact登録0件。**docs更新のみ・Code/DB/API/Fact変更0件・Tag/Push/Render未実施**。**Version1 Final Complete／Version1.1開発中・Phase54 Complete維持・Phase55未着手**（すべて変更なし）。詳細はDecision108参照。以前: 2026-08-21（**ASP Product Fact Record（APFR）Step A Core／Step B Manual Input UI 正式リリース・Decision108**。Step A（合成テスト49/49・Code commit **3113e53**）・Step B（Affiliate Intelligence Core内APFR入力パネル・provenance＋User Verificationからのみfact確定・合成テスト35/35・Code commit **1e8de4f**）を実装・実機検証・正式リリース。実商品APFR登録0件（プラファスト未登録）。次工程はプラファストAffiliate Evaluation登録・商品採用（ユーザー本人操作）。以前: **ASP Product Fact Record（APFR）Product Formal Truth Contract 正式採用・Decision108**。A8.net実商品「プラファスト」提携完了を背景に、EER（行為のFormal Truth）とは責務分離した「商品事実」のFormal Truth契約APFRを設計正式化。`classification`＝`fact`/`prediction`/`inference`/`unknown`の4値・AI自身の判断による`fact`昇格禁止・保存先は`intelligenceContext.product.facts`（既存JSONB）。既存Evidence/EEA/Product/ASP Intelligence/Quality Gate無変更。**今回はdocs正式化のみ。コード実装・実案件登録は一切なし**（実案件登録0件）。次工程はAPFR Step A（ユーザー承認後）。以前: **External Execution Completion Contract 正式化＋EER-1/EER-2/EER-3/EER-4 Complete・Decision107**。EER-3正式リリース（docs commit **ed14959**・Tag **v1.01-external-execution-record**・push・Render済み）後、ユーザー本人が本番UIから対象実案件`case-msr9yckye65y`へ3件のExternal Execution Record（instagram_account_created／asp_registered／asp_media_registered）を正式登録。Contract完全準拠・IADP無回帰・Claude Codeからの登録は0件（読み取り確認のみ）。以前: **正式化＋EER-1/EER-2実装Complete**。User Approval／Ready／Deliverable Completion／Evidence／IADP／Output Draftのいずれとも別に、現実世界での外部行為完了を保持するFormal Truthが存在しないことを確認し、正式Contract「External Execution Record（EER）」を設計。`FORMAL_CASE_FIELDS`へ独立キー`externalExecution`を追加（IADP配下案は不採用）した上でEER-1 Core（合成テスト51/51 PASS・Code commit **504b991**）・EER-2 User Confirmation UI（Leader Final Summary内へ登録ボタン・localhost実機検証済み・Code commit **58e9451**）を実装。Approved≠Executed・Ready≠Executed・AI推測禁止・source=`user_confirmation`のみ・status=`executed`のみ。初期executionType3種。**実案件`case-msr9yckye65y`へのEER登録は0件**（現実には完了済みだが未登録のまま維持）。次工程はDecision107正式リリース（docs commit・Tag・push・Render・本番確認）。以前: **Phase IG-QC-B1/B2 candidateOnly Quality Routing Fix / Production Re-evaluation 正式リリース・Decision106**。`buildOutputDraftFromLeaderFinal({candidateOnly:true})`ブランチへ Phase IG-QC routing 追加（B1・86/86 PASS・commit **0c076dd**）・本番 `out_1787060723866` 旧 snapshot を非課金再評価・限定保存（B2・iadp/100/complete・QG passed）。Annotated Tag **v1.01-iadp-quality-routing-complete**・main push・Render 反映・PC本番確認済み。OpenAI API 0・Claude API 0・Web Search 0。Leader Case Context Phase2 引き続き本番未 commit。以前: **Phase IG-QC / B-7F Quality Gate Package Routing Fix 正式リリース・Decision105**。IADPを含むOutput DraftがInstagram投稿用`instagram` Quality Contract（hook/slideTitles/hashtags等10項目）へ誤接続されていた根本原因（Phase IG-QC）と、全Path A Output Typeで`buildOutputDraftFromLeaderFinal()`のreturn値から`packageQuality`が欠落し`evaluateQualityGate(undefined)`が実行されていた配線バグ（Phase B-7F補完）を修正した。正式IADP（`validation.valid===true`・`packageId`存在・`quality`算出済み）には`evaluateInstagramAccountDesignQuality()`の事前算出済み結果をrouting（非IADP・guard失敗は既存`evaluateOutputPackageCompleteness()`へfall-through）。全Path A Output TypeでQuality Gateへ実評価値が接続。既存Quality Contract・Executive Decision責務は変更なし。正式回帰テスト48/48 PASS。Leader Case Context Phase2は引き続き本番未commit。OpenAI API call 0・Claude API call 0・Web Search 0・DB変更なし。**`index.html`（2 hunk）／`iadpQualityContractRouting.test.js`（新規）のみ**（Code commit **547ddac**）。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程は対象案件`case-msr9yckye65y`のIADP専用Quality/Quality Gate/Account Creation Readinessを本番で再確認。詳細はDecision105参照。以前: **Claude Pricing Correction 正式リリースComplete・Decision104**。Claude Cost Log調査でclaude-opus-4-8が公式単価の3.000倍・claude-haiku-4-5が0.800倍という単価定数誤りを特定し、`claudeCostTracker.js`／`claudeClient.js`の`CLAUDE_PRICE_PER_1K`（Opus/Haiku値のみ・Sonnet無変更）を訂正した。計算式・重複計上防止・JPY換算・cache token（未使用）にはいずれも問題なし。Claude側にはCost Gateがそもそも存在せず機能面への影響はなし（表示・報告上の金額のみ）。非課金fixtureテスト全PASS、2026年8月Supabase実績を公式単価で再計算した合計$4.051303がAnthropic公式実績$3.93と残差約3%まで一致。working tree別系統差分「Leader Case Context Phase2」はcommitから除外。過去Cost EventはAudit Trailとして保持し遡及修正なし。DB Migrationなし。node --test既知6 FAILは無関係・新規FAILは0件。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。詳細はDecision104参照。以前: 2026-08-18（**IADP Structured Output 正式リリースComplete・Decision103**。実運用予定案件`case-msr9yckye65y`でIADP生成がValidation FAILした根本原因（IADP Leader Final呼び出しが自由記述のみに依存し、`finalProfile`トップレベル配置と`candidateComparison`/`adoptionDecision`出力を逸脱）を特定し、OpenAI Responses APIの`text.format:{type:'json_schema',strict:true}`をIADP Leader Final呼び出し1箇所のみへ追加。SchemaはValidatorが実際に検証するフィールドのみを対象とし、`normalize()`が常に上書きする値はモデルへ要求しない設計。`shared/instagramAccountDesign.js`は無変更で既存安全契約（推測補完なし・自動水増しなし・validation緩和なし）を完全維持。合成テスト13件・EEA既存36件・Completion既存テスト全PASS。実AI E2E（1 workflow・8 call）でSchema受理・`valid:true`・candidateComparison3件・adoptedCandidateId整合・finalProfileトップレベル正配置を実測確認。Cross-case混入なし・User Approval不変。**別系統差分「Leader Case Context Phase2」（`buildLeaderCaseContext()`含む）は今回除外し、本番環境には現時点でこの関数が存在しない点を重要事項として記録**。変更ファイルは**`openaiClient.js`／`index.html`（最小限）／`iadpStructuredOutput.test.js`のみ**（Code commit **8a9d417**）。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程はEvidence充足（EEA経路・ユーザー承認後）。詳細はDecision103参照。以前: 2026-08-18（**Deliverable Completion Architecture（STEP 6）正式リリースComplete・Decision102**。「AIが処理を終えた」ことと「依頼が本当に完了した」ことを分離するCompletion判定軸を新規採用。純関数`evaluateDeliverableCompletion()`（Contract v1.0.0・追加AI call 0）がoutputType別required項目の充足から`complete`／`incomplete`／`blocked`を判定し、既存`package_quality`JSONBへ`completionAssessment`を同梱保存・F5復元でdraftトップレベルへ再展開（新DB列なし）。案件切替直後にAuto Taskが開始しOutput Draft復元完了前にFormal Truthが引き継がれない実測済みRace Conditionを`scheduleOutputDraftRestore()`のPromise化＋`atRunWorkflow()`側awaitガード（sleep/setTimeout不使用）で解消し、carry-forwardを単一field（iadp）限定から`FORMAL_CASE_FIELDS`契約全体（iadp／intelligenceContext／affiliateContext／approvedDecisionPackage）へ一般化。実AI E2E（`case-msoplrg6gdkr`・1 workflow）で事前見積り`estimateAutoTaskCalls()`のmax=5と実call数5（Claude3・OpenAI2）が一致・想定外カスケードなし・Web Search0回・Cross-case非混入（他7 case完全不変）を実測。Output Engineへ`buildCompletionStatusHtml()`による最小Completion表示（Complete/Incomplete/Blocked短縮表示のみ）を追加し、`completionAssessment`未生成の既存Draftは非表示（Complete扱い・推測表示のいずれもしない）。`detectOutputType()`の`instagram_post`キーワードへ`instagram`/`インスタ`裸トークンを追加し、carousel固有語のない一般的なInstagram投稿依頼が`instagram_carousel`へ誤判定される実バグを修正（13型回帰なし・既存fallback維持）。node --test 81 PASS／6 FAILは`server.test.js`のLeader固定返信文言ドリフトによるpre-existing failureで本リリースと無関係と確認（未修正）。EEA既存合成テスト36件全PASS。変更ファイルは**`index.html`のみ**（Code commit **364b65a**）。working treeに存在した別系統の未commit差分（Leader Case Context Phase2＝`claudeClient.js`／`openaiClient.js`／`server.js`および`index.html`一部hunk）はSTEP 6と機能的依存がないため意図的に除外し今回のcommit対象外（別途ユーザー判断でリリース）。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程はInstagram実運用を優先（ユーザー承認後）。詳細はDecision102参照。以前: 2026-08-13（**External Evidence Acquisition（EEA）正式リリースComplete・Decision101**。IADPのEvidence不足をAI会社自身がWeb Search経由で解消できる基盤（EEA-1〜EEA-12）を正式採用。Search Plan機械生成（$0円）→ユーザー明示承認→実Web Search→Trust Tier（8段階）×Independent Source（独立2 Publisher以上）×claimType条件を満たしたEvidenceのみverificationStatus:'verified'へ昇格する2段階Promotion方式（Phase1: sourceName事前計算→Phase2: batch全体＋既存正本を固定母集団として全candidate分先に判定確定→Phase3: 確定済み値で保存。処理順非依存を合成テストで確認）→既存Gate（`MIN_VERIFIED_EVIDENCE=3`／`MIN_INDEPENDENT_SOURCES=2`・無変更）評価、まで接続した（Code commit **4bcf42e**）。Cost Trackerがローカルgate用state（`cost-logs.json`・`monthlyLimit`/`stopped`/`canProcess()`）とSupabase実績正本（`api_cost_events`→`/api/cost`）の二層構造であることを正式記録し、過去の「Historical Cost Lost」表現を「**Local Cost Gate State Historical Values Lost**」へ訂正（Supabase側実費履歴は無傷。EEA-8・Code commit **40ff550**でgpt-5.6-terra料金・Web Search tool fee接続）。QA専用case`case-msoplrg6gdkr`での実機検証（EEA-11・承認済み3クエリのみ・追加検索なし）で、Trust Tier Selectionにより政府ドメイン5件（caa.go.jp×3／kokusen.go.jp／meti.go.jp）が保存され全件verified（独立Publisher3件）、`resolveIadpEvidence()`実測で`verifiedCount=5`・`independentSourceCount=3`・`status='sufficient'`（既存Gate無改修で到達）を確認。F5完全リロード後も全項目・billingLock状態とも完全復元。IADP全体assessment実測ではEvidence関連は全てComplete（structureValidation: passed／contentQuality: complete／reviewerStatus: passed／strategyStatus: accepted／qualityGateStatus: passed／score 100/100）だが、Account Creation Readinessは`conditional`（`ready`ではない）——唯一の理由はEvidenceと無関係な`userApproval: pending`（ユーザー承認操作は実行していない）。Search Planのquery数と実際のOpenAI `web_search_call`数は`tool_choice:'auto'`により一致しない場合がある（実測：3クエリ→合計6 tool calls）ため、事前表示は上限目安・実行後精算（`api_cost_events`実測）を正本とする仕様を記録した。Cost実測（Local／Supabase両系統一致）：Local before 0/0/0→after 34.42/34.42/34.42（差額+34.42円）、Supabase before today0・monthly41.05・total48.47→after today34.42・monthly75.47・total82.89（差額+34.42円）。両系統差額完全一致・二重計上なし。monetizationのclaimType mapping・Tier3/Tier6案件固有allowlist・Category Coverage Gate化はEEA Complete後の改善候補、Auto Task完全自動化接続・Researcher直接Web Search統合はEEA外の将来機能として保留（今回未実装）。**新規DB table・schema変更なし**（正本は既存`outputDraft.fields.intelligenceContext.evidence[]`のみ）。合成テスト計36件全PASS（EEA-8：19件／EEA-10B：17件）・Console Error 0・実Web Search1回（承認済み3クエリのみ）・追加API実行0回。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程はInstagram実運用（アカウント作成→プロフィール設定→ASP登録→商品調査→投稿企画→初回投稿→KPI取得→Learning実測）またはPhase55判断（ユーザー承認後に決定）。詳細はdocs/04DECISIONS.md Decision101参照。以前: 2026-08-12（**IADP / LFS Navigation & Scroll Usability Improvement 正式リリースComplete・Decision100**。Code commit **0309086**（`feat: improve IADP and LFS navigation usability`・`index.html`のみ・+99/-11）。①IADPカードへ「↓ Leader Final Summaryへ」を追加し`lfs-summary-display`へ`scrollIntoView`。②LFSへ「↑ Instagram Account Design Packageへ」を追加し既存`_lfsScrollToDetails()`を再利用（新規ロジックなし）。③`#chat-area`外側に固定ナビ`#chat-scroll-nav`（↑/↓）を追加し`chatEl.scrollTo({top:0/scrollHeight})`。④`#chat-area`スクロールバーを幅6px→14pxへ拡幅しtrack/thumbコントラスト強化・Windows既定矢印ボタン非表示化。⑤実機確認で「スクロールバーの一部分しかドラッグできない」不具合が判明し、`document.elementFromPoint()`のピクセル単位スイープ調査で根本原因を特定：コード内に`id="knowledge-panel"`を持つDOM要素が2つ存在する既存の重複IDバグ（📚ナレッジエンジン用と🧠顧客記憶パネル用、CSSも同一セレクタで2ブロック重複）により、ナレッジエンジン側の「閉」状態が画面外へ完全退避できず右端に約12px幅の帯が常時残留し、`position:fixed;z-index:300;pointer-events:auto`で`#chat-area`のスクロールバー帯（約15px）の大半を覆っていた。**Edge/Chromiumのネイティブスクロールバー仕様が原因でないことを実測で確認済み**（カスタムドラッグハンドルは不要と判断・未実装）。最小修正として衝突していたIDの片方（顧客記憶パネル側）のみ`company-memory-panel`へ改名（CSS2箇所・HTML1箇所・JS1箇所）。ナレッジエンジン側は無変更。副次効果として、従来一度も正しく開閉できていなかった顧客記憶パネル（🧠会社知識数）が今回初めて正しく開閉できるようになった。Cross-case安全性（IADPなし案件で残留0件・他案件への誤ジャンプなし・再描画後も固定DOM参照なしで正常動作）を実測確認。ユーザーのWindows/Edge実機でIADP⇄LFSジャンプ・↑/↓端ジャンプ・スクロールバー中央ドラッグを含め全項目正常動作を確認済み（Complete）。Console Error 0・dev-check 200/200/200・`git diff --check` CLEAN・実AI実行0回・追加API費用0円。IADP契約・LFS契約・Evidence判定・Quality Gate・Reviewer・Strategy・adoptionDecision・User Approval・Output Draft保存契約・Researcher・Analyst・DB・schema・APIはすべて無変更。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程はExternal Evidence Acquisition（設計調査完了・未実装。Researcherは現状Web検索能力を持たずLLM内部知識のみで市場・競合調査を行っており、Evidence正本`outputDraft.fields.intelligenceContext.evidence[]`はAffiliate Evaluation手入力経路からのみ生成される。推奨構成は薄いEvidence Acquisition Adapter）。詳細はdocs/04DECISIONS.md Decision100参照。以前: 2026-08-11（**IADP Post-Release Hotfix / Hotfix-Quality / Stability Hotfix 正式リリースComplete・Decision099**。Decision098（IG-2J-A〜I）後の実運用確認でIADP生成物の構造・品質不備（①JSON末尾`}`不足②finalProfile誤配置③adoptionDecision誤配置④KPI5がnull⑤first30DaysOperatingPolicyが配列）が判明し、Post-Release Hotfix（Code commit **585360c**＝Leader Final構造安定化・adoptionDecision/adoptedCandidateIdのSSOT維持・Final Profile統合・IADP保存/表示・Output Draft生JSON汚染防止・F5復元・Cross-case独立性・User Approval pending維持・AI Action/User Input境界維持）→Hotfix-Quality（Code commit **4b92f0d**＝顔出しなし・本人音声なし方針／KPI5項目／KPI改善条件／6リスク／リスク回避策／first30DaysOperatingPolicy／Reviewer指摘のLeader自律補完をAI会社自身が未完成のまま返さないよう強化）→Stability Hotfix（Code commit **936cd77**＝Leader Final Prompt出力安定化＋決定論的JSON Recovery`IADP_MAX_SYNTHETIC_CLOSERS=2`＋finalProfile/adoptionDecision誤配置救済）の3工程で解消した。専用新規テスト案件`case-msoplrg6gdkr`での実AI再検証（費用¥52.62・上限¥100以内）で前回FAILの5件すべて解消を確認：JSON parse成功・synthetic closer recovery不発動（Leader自身が正常JSON生成）／finalProfile・adoptionDecisionとも正位置／KPI5全項目number型（保存率15・プロフィール遷移8・フォロー率3・CTR4・CVR5）／first30DaysOperatingPolicyがstring型。Reviewer Passed／Strategy Accepted／Quality Gate Passed／User Approval Pending／Output Draft汚染なし／F5復元一致／Cross-case独立性維持（実案件3件・既存テスト案件2件をバイト単位で無傷確認）／Console Error 0／dev-check 200/200/200。**今回の結果はAccount Creation = Not Ready（Evidence Insufficient：確認済み0件・AI仮説9件）であり、これはFAILではなく構造充足100点でもEvidence不足ならReadyへ進めないDecision097 Ready正式条件が正常に機能した結果**（Decision097の判定契約は変更なし）。実AI dispatchは2回発生（1回目はAuto Task自動開始OFFのためLeaderチャット応答のみで終了・AI社員Workflow未実行。2回目でAuto Task一時ONにより全工程完走）。**成果物を生成した完全なAI社員Workflow実行は1回のみ**。1回目dispatchの残置pending Task 12件（`case-msoplrg6gdkr`配下）はDB直接削除禁止のためKnown Test Dataとして残置。過去引継ぎの実案件「4件」表記は今回実測3件（`case-msnarlxcjd13`／`case-mslvxioehypa`／`case-mshmumd8l93j`、3件ともバイト単位無傷）と異なることを記録する。KPI改善条件の判定期間記述が弱い点は軽微な残課題として将来へ記録し、今回の追加Hotfix・追加実AI実行は行わない。**server.js／DB／supabase/schema.sql／API契約は全工程で無変更・新規API/新規DBカラム/新Engineなし**。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。詳細はdocs/04DECISIONS.md Decision099参照。以前: 2026-08-10（**Phase IG-2J-A〜I Instagram Account Design Self-Completion / AI Action Rerun 正式リリースComplete**＝Decision097（IG-2F〜IG-2I）後の実運用確認で判明した9つのUX・品質問題（逆質問だけで停止／結論が見づらい／確認事項の分散／採用案不一致／構造99点と実運用品質の混同／Evidence不足でも完成に見える／生JSON残存／AI会社で決められる事までユーザーへ質問／自律処理不足）を、IG-2J-A〜Hの8工程で解消し、IG-2J-Iの最終統合検証を経てDecision098として統合正式採用した。**IG-2J-A**＝Self-Completion Mode（4担当が情報不足でも逆質問だけで停止せず事実／AI仮説／外部確認待ち／User Input Requiredを分離して成果物を返す。数値の捏造は禁止。通常WorkflowのSystem Promptは完全同一文字列を維持。Code commit **d95f196**）。**IG-2J-B**＝Leader Final Summary（チャット最新位置へ実運用可否/採用候補/採用理由/構造充足/Evidence/内容品質/Reviewer/Strategy/Quality Gate/Approvalを要約表示。既存カード・ELR・Leader Final本文は削除せず維持。構造充足99%と実運用品質を明確に分離。Code commit **7a33296**）。**IG-2J-C**＝AI Action / User Input分離（reason code＋決定論的分類でaiActions/userInputsへ正式分離。ターゲット・ジャンル・投稿頻度・KPI等はAI会社が決めユーザーへ質問しない。Code commit **244cad2**）。**IG-2J-D**＝採用案Single Source of Truth（正本を`intelligence.adoptionDecision.adoptedCandidateId`へ統一。**総合点1位を自動採用しない**。比較表は表示時のみ正本へ整合し保存副作用なし。Final Profile不一致は文字列補正せず安全側Not Ready。Code commit **144b0ff**）。**IG-2J-E**＝Intelligence実数値の担当指示注入（既存`fields.intelligenceContext`を4担当の指示文へ注入。Fact/Prediction/Unknownを分離し裏付けEvidenceのない数値は必ずPrediction。新Engine/新DB/新APIなし。Code commit **fa91cae**）。**IG-2J-F**＝Evidence正本接続（正本を`fields.intelligenceContext.evidence[]`へ接続。Verified/Derived/Unknownを分離し派生・推定を検証済み件数へ算入しない。fieldStatusはlegacy fallbackとして維持。Code commit **d7d21dd**）。**IG-2J-G**＝成果物正規化（reply wrapperとjson fenceの構造ノイズのみ除去。通常文章・一般コードブロック・正式構造JSONは不変。原文は`task.rawResult`へ保持。Code commit **7ff4140**）。**IG-2J-H**＝AI Action自律再実行接続（Summaryからユーザーが1回開始すると必要担当だけを既存Auto Task経路で再実行→Reviewer→Strategy→Leader Final→IADP再評価まで完走。新Workflow Engineなし。自動起動なし／二重実行防止／案件3回・code2回の上限／Cross-case guard／stale QG guard／Approval自動承認なし。Code commit **f845db0**）。**IG-2J-I**＝最終統合検証（回帰**441項目全PASS**・**実AI End-to-End 1回PASS**・API追加費用**約¥30**・実案件書き込み0件・テストデータ**remaining=0**・Console Error 0・dev-check 200/200/200）。**server.js／DB／supabase/schema.sql／API契約は全工程で無変更**。**Annotated Tag v1.01-instagram-account-design-self-complete・main push（540411e..32b0821）・tag push・Render反映・PC本番確認・iPhone Portrait実機確認すべて完了**（docs commit 32b0821／iPhone LandscapeはKnown Issue継続）。**Phase54 Complete維持・Phase55未着手**。次工程＝Instagram実運用準備／実運用開始。以前: 2026-08-09（**Phase IG-2F〜IG-2H IADP Quality / Approval / Quality Signals 正式採用（正式リリース）**＝Decision096（IG-2E）後の実運用確認で「チャット欄では担当成果物・Evidence・Leader統合回答がいずれも不足しているのに、IADPカードがComplete／品質スコア100／アカウント作成準備Ready／市場調査100／競合調査100と表示される」誤判定を発見し、IG-2F〜IG-2Hの3工程で解消した内容を統合して正式リリースした（Decision097）。**根本原因**＝IADP専用品質評価`evaluateInstagramAccountDesignQuality()`がJSONのフィールド存在のみでscore/status/readyを決めており、①Evidence件数は集計するのみで判定入力に含まれない、②担当実行状況（`data.results`）とLeader統合回答（`data.leaderFinalResult`）は評価時点で手元にあるのに未接続かつ未保存でF5消失、③`readyForAccountCreation`がstatus由来の派生のみでユーザー承認ゲートを持たない、の3点。加えてSummary領域が極端に小さい問題（chat-areaがflex columnのためカードが`flex-shrink:1`で約26pxへ潰れ、`overflow-x:hidden`が`overflow-y`をautoへ強制昇格させ内部スクロール化）も判明。**IG-2F**（Code commit **b5a3d5e**）＝判定を`structureValidation`／`contentQuality`／`evidenceStatus`／`accountCreationReadiness`／`userApproval`の5軸へ分離する新関数`assessInstagramAccountDesignPackage(iadp, context)`を`shared/instagramAccountDesignQuality.js`へ追加（純関数・非破壊・fail-open。既存`evaluateInstagramAccountDesignQuality()`は無変更のまま内部再利用＝後方互換）。構造検証Passedだけで内容品質をCompleteにせず、Evidence 0件（全AI仮説）で市場調査・競合調査を「実データ検証済み」と表示せず、Category Scoresを「構造充足／Evidence信頼度／内容品質」の3値へ分離（構造充足100は正直に出しつつ総合はNeeds Work）。担当成果物不足（error/skipped/空/情報不足スタブ＝逆質問で停止）とLeader統合回答不足（本文空またはintegratedCount 0）はComplete化を禁止。生成時コンテキストを`fields.iadp.generationContext`へ保存しF5復元可能にし、無い旧IADPは`not_evaluated`（legacy）として自動Complete/Ready化しない。Summary UIは`.iadp-card`へ`flex-shrink:0`／`overflow:visible`を適用（カード高さ26px→547px）し、重要判定を初期表示・詳細を`<details>`折りたたみへ（色だけでなく文字でも状態表示）。**IG-2G**（Code commit **18fc04b**）＝ユーザー承認を`fields.iadp.approval`（`{status, packageId, caseId, approvedAt}`・既存構造非破壊の任意サブキー）へ保存し既存`pushOutputDraftToServer()`／`POST /api/output-drafts`で永続化（新規API・新規DBカラムなし）。`_iadpEffectiveApprovalStatus()`が**caseId＋packageId一致時のみapproved**を返し、新IADP生成（新packageId）では旧承認を引き継がず`pending`へ戻す（セッションリセット＋保存側非同梱の二重ガード）。Summary内「この設計を承認」ボタンから承認でき、保存→再評価→再描画を同一操作内で完了（F5不要）。**IG-2H**（Code commit **4dd0400**）＝Reviewer／Strategy／Quality GateをIADP assessmentへ正式接続。**新しい独立判定基盤は作らず既存判定を再利用**し、Quality Gateは既存正本`inbox.qualityGate`（＝`_leaderIntegration.qualityGate`・Phase B-7E/B-7F確定値）を読むのみで再実行・契約変更なし。Reviewer／Strategyは既存に構造化された合否判定が存在しないため既存`data.results`（status＋本文）から多シグナル導出し、**単純キーワードだけでfailedを確定させない**（構造シグナル＝status error/skipped・本文空・逆質問スタブを第一根拠とし、否定フレーズ単独は`needs_work`に留め、構造的裏付けがある場合のみ`failed`／`needs_revision`へ昇格）。既知バグのある`LI_REVIEWER_REJECTION_KEYWORDS`は流用しない。既存Workflow順（IADP生成→`_liCollectIntegration()`でQuality Gate確定→Output Draft確定）は変更せず、`_liCollectIntegration()`直後へ新設`_iadpRefreshAfterIntegration(caseId)`を追加してQuality Gate確定後に後から再評価する方式を採用（F5不要・fail-open）。`fields.iadp.assessmentContext`へpackageId・caseIdを刻んだsnapshotを保存し、復元時にpackageId一致検証のうえ再利用（不一致なら破棄＝旧評価を新IADPへ流用しない）。**Ready正式条件**＝構造Passed＋内容Complete＋Evidence非Insufficient＋Reviewer重大不足なし＋Strategy再設計要求なし＋Quality Gate Passed＋Leader統合回答あり＋必須担当成果物あり＋User Approval Approved の全充足（品質条件のみ充足で承認待ちは`conditional`。**承認だけで品質不足を上書きしない**＝承認済みでもReviewer failed／Strategy needs_revision／Quality Gate failedならNot Ready）。未取得は`not_available`／`not_executed`として明示しComplete到達させない（failedとは区別）。**Path Bは`inbox.qualityGate===null`のためComplete/Readyへ到達しない安全側仕様として正式容認**し、Instagram Account Designの正式経路はPath A Auto Taskを基本とする（Path BへQuality Gateを新設しない・Decision087継承）。**Background Execution**はVersion1.1後半の大型工程として方針のみ正式記録（今回未実装。実装順＝正式化→Instagram実運用→KPI/Learning実測→ボトルネック確認→Background Execution。品質判断が安定する前にBackground化しない）。**Known Issue**＝Reviewer NG keyword partial-match issue（既存`LI_REVIEWER_REJECTION_KEYWORDS`の`NG`部分一致でBRANDING/MARKETINGを誤検出し得る。IADP側は厳格フレーズ＋構造シグナルで回避済み・本体修正は後続候補）／iPhoneチャット履歴の瞬間消失／iPhone Landscapeレイアウト崩れ。**データ保全ルール**＝IG-2Fで実案件IADPを上書きし元データを保全できなかった事故を教訓に、実案件の`fields.iadp`を検証目的で変更する場合は「backup→test→restore→restore確認」を必須とし原則専用テスト案件を使用（IG-2G＝`case-mslrf20t2nhk`／IG-2H＝`case-mslsddorhcso`で検証し実案件書き込みゼロ・検証後に削除済み）。**変更ファイルはindex.htmlとshared/instagramAccountDesignQuality.jsのみ**（server.js／shared/instagramAccountDesign.js／shared/leaderRuleEngine.js／supabase/schema.sql／DB／API契約は無変更。`_edRunDecisionEngine()`・`validateExecutiveDecision()`・`evaluateQualityGate()`等への非干渉をdiff実測で確認）。Core合成テスト（IG-2F 9件・IG-2H 10件）・Reviewer/Strategy導出11件・UI 10ケース全合格、`node --check` OK、`git diff --check` CLEAN、IADP関連Console Error 0、dev-check 200/200/200、**実AI追加実行なし**。tag **v1.01-instagram-account-design-quality-ready**・main push・Render反映（本番`ai-company-l45x.onrender.com` 200・配信物へIG-2F/2G/2H反映確認・`assessmentVersion 2.0.0`実測）・**PC本番確認 完了**（専用テスト案件でSummary可読性675px・Reviewer/Strategy/Quality Gate表示・承認→即時Ready・F5復元・legacy安全表示・Cross-case漏れなし・Console Error 0・既存Leader UI/Output Engine健全を実測。検証後テスト案件削除・実案件書き込みゼロ）・**iPhone実機確認 完了（2026-08-09・ユーザー実施）＝縦画面Complete**（本番表示・ログイン・Leader・案件表示・メニュー操作すべて正常・白画面なし・無限ロードなし・既存機能破壊なし）／**横画面はDecision096記録のLandscape Responsive未対応Known Issueが継続・未修正**（左サイドバーとメイン領域の占有が大きくメニュー表示時も画面の大部分が覆われ実用上ほぼ使用できない状態。**IG-2F〜IG-2I実装による新規不具合ではない**ため正式リリース判定には影響させず、後続のResponsive対応工程として管理）。**Phase IG-2F〜IG-2I 正式リリースComplete**。**Phase54 Complete維持・Phase55未着手**。次工程＝Instagram実運用（アカウント作成→プロフィール設定→ASP登録→商品調査→投稿企画→初回投稿→KPI取得→Learning実測）。実AI IADP End-to-End確認はAPI費用のユーザー承認後。Background Executionは実運用・Learning実測後。**iPhone Landscape Responsive対応**は独立工程として後続管理。Completion Gate設計・NG keyword本体修正・iPhoneチャット履歴瞬間消失対応は後続候補。以前: 2026-08-06（**Phase IG-2E Instagram Account Design Package Output Draft Integration 正式採用**＝IADP（Instagram Account Design Package）を既存Output Draft永続化へ正式接続した（Decision096）。IG-2D（実AI検証・IADP構造化JSON品質調整。`openaiClient.js`のIADP専用プロンプトへ実例JSON・厳守事項を追加し空値/プレースホルダー残留を抑制、`accountIntelligenceMode`時のみ`max_output_tokens`を4096→8192、`<IADP_JSON>`パース時に末尾カンマ耐性を追加、`_iadpStripJsonBlock()`が構造化ブロックのみで自由文が空の場合の案内文表示、genreId→genreName逆引き表示・adoptionReason優先表示。Code commit **ecfed0c**）に続き、IG-2Eで①保存＝IADP検証成功時に`_lastOutputDraft.fields.iadp`へ`{package, validation, quality, caseId, savedAt}`を格納し既存`pushOutputDraftToServer()`／`POST /api/output-drafts`をそのまま利用（新規API・新規DBカラムなし）。②復元＝新設`_iadpApplyRestoredFields()`が既存`restoreOutputDraftFromServer()`（起動時／案件切替時）の復元結果からIADPセッションキャッシュ（`_lastInstagramAccountDesignPackage`等4変数）を同期し`reRenderChatArea()`でIADPカードを自動再表示、案件に保存Draftが無ければキャッシュを確実にクリアしCross-case漏れを防止。③1 Case 1 正本＝`createOutputDraft()`が`fields`を毎回初期化する既存仕様に対し、実行直前に既存`fields.iadp`を退避し新Draftへ引き継ぐことで、同一案件内でIADP以外のAuto Taskを実行しても直前まで採用されていたIADPが消えないようにした（Code commit **0fb943e**）。**index.htmlのみ変更**（`server.js`／`shared/instagramAccountDesign.js`／`shared/leaderRuleEngine.js`／`supabase/schema.sql`無変更・新規API/DBカラム追加なし）。既存案件（「Instagramアカウト設計」）を利用し実AIを追加実行せずブラウザJS経由でダミーIADP（`normalizeAccountDesignPackage`／`validateAccountDesignPackage`／`evaluateInstagramAccountDesignQuality`を実際に通した`valid:true`パッケージ）を注入して実測（localhost）。保存＝`POST /api/output-drafts`200 OK、F5復元＝同一`output_id`のままIADPカード再表示、案件切替＝他案件へ切替でカード消滅・グローバルclear・元案件へ戻すと再表示、1 case 1 正本＝案件間混在なし、後方互換＝IADP未使用の旧Draft（type: document等）はエラーなく従来どおり復元、Console Error 0を確認。検証後は注入したダミーIADPを削除し実案件を原状復帰。node --check OK・git diff --check問題なし・dev-check 200/200/200。docs commit（**d36de10**）・Annotated Tag **v1.01-instagram-account-design-output-draft**・main push・Render反映後、本番URL（`ai-company-l45x.onrender.com`）でも同一案件「Instagramアカウント設計」でPC本番確認（保存・F5復元・案件切替・Console Error 0を実測・検証後原状復帰）を実施し、**iPhone実機確認も完了**（ユーザー実施：Render本番表示・ログイン・Leader・案件切替・Auto Task・Output Engイン正常・白画面/無限ロードなし・既存機能破壊なし）。**IG-2D／IG-2E 正式リリースComplete**。iPhone確認で今回の実装とは独立の**Known Issue 2件**を発見（①案件を開いた直後チャット履歴が一瞬消えAuto Task実行で復帰＝再描画競合の疑い、②iPhone Landscapeでレイアウト崩れ＝Responsive対応要）・後続工程へ記録。Path B／Content Planning／Carousel Builder／Publishing Readyはコード変更箇所と非重複のため影響可能性は低いと判断したが実動作回帰確認は今回未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Known Issue①②の対応／Path B／Content Planning／Carousel Builder／Publishing Readyの実動作回帰確認／IADP実AI生成からの自動保存End-to-End確認（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-06（**Phase B-9F Leader Rule Engine 正式リリース（Phase B-9C〜B-9F統合）**＝Decision094（Leader統合回答責務正式化）に基づき、Leader統合回答生成プロンプトの改善（Phase B-9C）と、共通Leader Rule Engine（`shared/leaderRuleEngine.js`）の新規実装・Path A／Path B／手動Leader再生成3経路への接続（Phase B-9D-1〜B-9D-5A）、統合検証（Phase B-9E前半：静的53アサーション全PASS／後半：実API3経路検証）を正式リリースした（Decision095）。**共通Leader Rule Engine**はUMD形式（Node/ブラウザ両対応・外部依存なし）で、`normalizeLeaderRuleInput()`／`evaluateLeaderRuleFacts()`／`buildLeaderRulePromptBlock()`の3公開APIを持ち、責務は事実整理専用（入力正規化・実行状況カウント・情報不足スタブ検出・Leaderへ渡す短い判断材料の生成）に限定し、採用/保留/却下・重複/矛盾/Evidence判定は一切行わない（v1契約から`duplicateTopics`／`conflicts`／`recommendedAdoptions`等は意図的に除外・信頼できる検出能力がないため）。Path A（`runLeaderFinalResponse()`・`_lfAdaptTaskToRuleArtifact()`）・Path B（`leaderSummary()`・`memberReplies`/`strategyReply`から構築）・手動Leader再生成（`atTriggerLeaderFinal()`・`_atBuildRuleArtifactsForManualRegen()`が既存`_liAdaptManualLeaderRegeneration()`を再利用し`ruleArtifacts`として`/api/leader-summary`へ任意項目送信・`leaderSummary()`が`ruleArtifacts`有無で入力元を分岐）の3経路すべてが同一Core・同一契約へ正規化される。Reviewer/StrategyはRule Engine入力へ`isPostProcess:true`で含めるがmain担当件数からは除外。Prompt Blockは1回のLeader Final生成につき最大1回のみ挿入・空時は見出しごと非表示・Rule Engine失敗時はfail-open（従来Promptのみで継続）・Prompt Injection耐性（AI社員本文原文・requestText・role自由文をPrompt Blockへ含めない）を維持。既存の`_liCompareArtifacts()`／`_liDetectConflictCandidates()`／`_liDecideAdoptionCandidates()`は変更せず別系統として温存。Phase B-9E統合検証では、静的照合（3経路因果順・共通契約・Reviewer/Strategy扱い・Cross-case保護・Quality Gate/Executive Decision/Output Draftへの非干渉）を53アサーション全PASSで確認したのち、実APIによる3経路検証（Path A Auto Task・手動Leader再生成・Path B dispatch各1回、同一テスト案件`PhaseB4B検証用テスト案件`を再利用）を実施し、Quality Gate（Path A/手動再生成でNot Passed・Path Bでnull=完全非表示）・Executive Decision（`decisionStatus:hold`一貫）・Constitution Validator（`passed:true`一貫）・Output Draft（Path A/手動再生成で保存・Path Bで非生成）がいずれも正常動作することを実測確認した（実費用約¥32.38・承認上限¥100以内・Console Error 0）。Code commit：`92cc49a`（B-9C）／`d194ba1`（B-9D-2 Core新設）／`0bd3a88`（B-9D-3 Path B接続）／`756d867`（B-9D-4 Path A接続）／`22ca87c`（B-9D-5A 手動Leader再生成ruleArtifacts分離接続）。**server.js/DB/schema.sql/API契約（Request/Response）はいずれも既存互換（`ruleArtifacts`は任意追加項目のみ）**。**Phase54 Complete維持・Phase55未着手**。次工程候補＝意味的重複/矛盾検出の実装検討／Evidence比較の実装検討／Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-05（**Phase B-9B Leader統合回答・会社正式回答責務 正式採用（Decision094・docs正式化のみ・コード変更なし）**＝Phase B-9A調査結果をもとに、Leader統合回答（Path Aの`LEADER_FINAL_PROMPT`／Path Bの`leaderSummary()`が生成しLeaderチャットへ表示する最終回答テキスト）の責務を正式化した。**用語分離**：「Leader Summary（ELR表示）」＝Executive Leader Report内でcandidateArtifacts等を3行抜粋・折りたたみ表示する事後表示セクション（`_elrBuildReportHtml()`・Phase B-8までに完成済み）と、「Leader統合回答」＝Path A/BがLeaderチャットへ表示する最終回答テキスト（今回Phase B-9の対象）を明確に区別し、今後docsでは後者を「Leader統合回答」と表記する。**正式採用内容**：①Leader統合回答はAI社員個々の回答の連結ではなく「ENBISOU AI COMPANYとしてユーザーへ提示する唯一の正式回答」と定義。②Writer／Researcher／Reviewer／Designer／Strategy等の個別回答は「社内検討資料」であり正式回答ではない（既存のAI社員タブ・dispatchカード・Workflow Live等の表示機能は維持・削除しない）。③Leaderは単なる要約担当ではなく、AI社員の意見収集・重複除去・矛盾解消・Evidence比較・採用/保留/却下判断・情報充足の最終判断・最終成果物生成・表現統一を担う「最終統合責任者（CEO相当）」と定義。④Leader統合回答の目的は「要約（短縮）」ではなく「統合（重複除去・矛盾解消・Evidence比較・採用/保留/却下判断・品質統一・依頼範囲への絞り込み・必要最小限の文章化）」であると明文化。⑤出力順序を「完成成果物→必要な場合のみ補足→必要な場合のみ採用理由→必要な場合のみ社内判断の概要」の成果物ファーストとして正式化（狭い依頼で不要なブランチを自動追加しない設計を目指す）。⑥各AI社員は安全側で「情報不足」と判断してよいが、追加質問へ切り替えるか完成品を生成するかの最終判断権限はLeaderに帰属する（依頼内容だけで実用的成果物を作成可能と判断できる場合は質問を経由せず完成品を生成し、成果物の骨格自体が成立しない場合のみ確認事項を提示）と正式採用。⑦Gate系との責務分離：Leader統合回答＝生成前〜生成中の判断（完成できるか／完成させるか／どの案を採用するか／質問へ切り替えるか）、Quality Gate＝生成済み候補の`packageQuality.status`評価のみ（内容の的確さ・統合品質は評価しない）、Completion Gate（未実装）＝将来、生成済み成果物が完成基準を満たすかの事後判定でありLeader統合回答の「生成するか・質問するか」の責務を先取りしない、Executive Decision＝Leader Final生成後の事後判断、Constitution Validator＝Executive Decisionの構造整合性検証のみで成果物内容の統合品質は評価しない、といずれも重複なく分離。⑧既存のLeader Integration Layer（`_liCompareArtifacts()`／`_liDetectConflictCandidates()`／`_liDecideAdoptionCandidates()`）は重複・矛盾・採否候補を事後観測する層として現存するが、現在はLeader統合回答生成「後」に実行される観測専用層であり、将来品質改善へ利用する場合はLeader Final生成「前」へ`{duplicateTopics, conflicts, recommendedAdoptions, holds, rejections, evidenceNotes}`形式の構造化された比較結果要約（全処理内容・不要な全文は渡さずトークン増加を抑制）として渡す接続が必要になる。⑨Path A（`/api/auto-task`がサーバー側単一リクエスト内で完結しクライアント側Leader Integration LayerがLeader Final生成前へ介入できない構造的制約・Decision087で確定済み）とPath B（クライアント側でdispatch・Strategy統合・Leader統合回答生成を制御しておりPath Aより比較結果接続がしやすい構造）の差異を記録し、二段階AI生成（追加コスト・遅延増）は第一候補にしない方針とした。**Phase B-9工程分割**：B-9A（調査・設計・完了）→B-9B（今回・責務正式化・docs反映のみ）→B-9C（LEADER_FINAL_PROMPT／leaderSummary()／必要に応じてstrategyConsolidate()のプロンプト改善）→B-9D（Rule Engine比較結果のLeader Final生成前接続・Path B先行）→B-9E（統合検証）→B-9F（正式リリース）。**今回はdocs正式化のみでコード・プロンプト・DB・API変更は一切なし**。tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-9C（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-04（**Phase B-8 Quality Gate Executive Leader Report表示 正式Complete（Phase B-8A〜B-8D統合・正式リリース）**＝Phase B-7で正式採用したQuality Gate結果（`inbox.qualityGate`）を、Executive Leader Report内へ表示専用のセクションとして追加した（Decision093）。既存の`inbox.qualityGate`構造（`{executed, passed, status, sourceStatus}`）をそのまま入力とし、新規decisionId／caseId／qualityGateVersion等のデータ契約は追加していない。表示位置はExecutive Summary→Constitution Structure Check→Quality Gate→Leader Summaryの順（Constitution Structure Check直後・Leader Summary直前）。通過時は「🟢 Passed（complete＝完成）」「🟢 Passed（almost_ready＝ほぼ完成）」、非通過時は「🟡 Not Passed（needs_work＝要改善）」「🟡 Not Passed（insufficient＝情報不足）」を表示し、`packageQuality.score`は表示しない。固定注記「現在のQuality Gateは成果物品質の初期判定（表示のみ）です。Executive Decision・Output Draft保存は制御しません。」を常設し、Quality Gate通過がExecutive Decision Approved／Approved Decision Package生成済み／Output Draft保存可否／Completion Gate通過／Publishing Ready／正式完成のいずれも意味しないことを明示する。表示対象はPath A Auto Task・手動Leader再生成のみで、Path B dispatch（`inbox.qualityGate===null`）は「対象外」「未評価」等の代替表示も含め完全非表示。新規表示関数`_elrBuildQualityGateHtml(qualityGate)`は表示専用の純粋関数（グローバル変数非参照・不正データ時は空文字列・入力オブジェクト非破壊・`escapeHtml`使用・Quality Gate専用CSSクラス`.elr-qg-*`使用）。既存`_elrBuildReportHtml(decision, inbox, validation)`のシグネチャ変更なし、既存`_elrRefreshInChatArea()`・`_elrRenderIntoChatArea()`のCross-case判定（caseId一致確認）をそのまま再利用。Quality Gate結果はセッション内保持のみで、F5後は`_leaderIntegration`／`_executiveDecision`／`_constitutionValidation`とともに消失する（永続化・F5復元は今回未実装）。Phase B-8A（調査・設計・コード変更なし）→Phase B-8B（表示実装・index.htmlのみ+52/-0・Code commit **04bf9c1**）→Phase B-8C（Path A・手動Leader再生成・Path B dispatchの3経路実API統合検証。案件`case-mschx3ex4z3c`でPath A=`sourceMode:'auto_task'`・Quality Gate=Not Passed（`sourceStatus:'needs_work'`）・Executive Decision=`hold`・Constitution Validator=`passed:true`（12/12）・Output Draft=`ready`・Output Draft保存1回・ELR/Quality Gateともに1件のみを実測。手動再生成=`sourceMode:'manual_regeneration'`で新規decisionId発行・Quality Gate再評価正常・古い表示の残留なし。Path B=`pathSource:'pathB'`・`inbox.qualityGate===null`・Quality Gateセクション完全非表示・Output Draft生成なし・`_lastOutputDraft`不変を実測。Cross-case誤表示なし・F5後は`_leaderIntegration`/`_executiveDecision`/`_constitutionValidation`ともnullへリセットされ表示も消失・Console Error 0・Network全200・実API概算1円未満）→Phase B-8D（正式リリース・docs更新・commit・Annotated Tag **v1.01-quality-gate-report-display**・main push・Render反映・PC/iPhone本番確認）の4段階で完成。**server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Quality Gate監査Version保存／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-04（**Phase B-7 Quality Gate 正式Complete（Phase B-7D〜B-7H統合・正式リリース）**＝Output Package Quality（`packageQuality`）を正本入力・単軸とするQuality Gateを正式採用した（Decision092）。`packageQuality.status === 'complete'`または`'almost_ready'`の場合のみ通過（`passed:true`）、それ以外（`needs_work`／`insufficient`／未知値／不正入力）はすべて非通過とし、`score`・数値thresholdは判定に使用しない。Phase B-7D（`buildOutputDraftFromLeaderFinal(finalText, opts, targetDraft)`へ第3引数`targetDraft`を追加しfields構築対象のみを引数化・省略時は`_lastOutputDraft`使用で既存呼び出し2箇所は完全後方互換・Code commit **f866d4d**）、Phase B-7E（`_lastOutputDraft`とは独立したcandidate Draft`{type,fields:{}}`を`_liCollectIntegration()`内`_edRunDecisionEngine()`直前で生成し`candidateOnly:true`早期returnでfields構築とpackageQuality算出のみを行い保存を伴わない・評価結果を`inbox.qualityGate`へ格納・Code commit **0f104d3**）、Phase B-7F（`evaluateQualityGate(packageQuality)`へ実判定ロジックを実装し`{executed:true,passed,status:'passed'|'failed',sourceStatus}`を返す・Code commit **1a92884**）の3段階で実装。Phase B-7G統合検証（index.htmlから実装コードを直接抽出した合成テスト14/14 PASS・Path A/手動再生成/Path Bの3経路実APIテストで因果順序を実測確認・コード変更なし）でPhase B-7H正式リリースへの進行可能性を確認。**Path Bは正式に対象外**（Output Draft候補生成契約が存在しないため`inbox.qualityGate===null`が正常仕様・Decision087の「Path B＝Output Draft制御対象外」を継承）。Quality Gate結果は現段階ではセッション内保持のみで、Executive Decision・Approved Decision Package・Constitution Gate・Output Draft保存・`OUTPUT_STATUS`のいずれも変更しない。Phase B-7H（正式リリース）でdocs更新・commit・Annotated Tag **v1.01-executive-quality-gate**・main push・Render反映・PC/iPhone本番確認まで完了。**server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Quality Gate監査Version保存／Decision Ledger／Quality Gate UI・Executive Leader Report表示／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-03（**Phase B-6 Constitution Gate 正式Complete（Phase B-6A〜B-6D統合・正式リリース）**＝Constitution Structure Check正式採用（Phase B-5C・Decision090）で表示のみだったConstitution Validator Coreの検証結果を、Approved Decision Packageの複製可否判定（Path A `atRunWorkflow()`／手動Leader再生成`atTriggerLeaderFinal()`それぞれの`fields.approvedDecisionPackage`受け渡し条件）へ「狭域Constitution Gate」として接続した（Decision091）。既存の`sourceDecisionId`一致・`caseId`一致に加え、`_constitutionValidation`存在／decisionId一致／caseId一致／`result.passed===true`の4条件をANDで追加し、いずれか不成立時は既存どおりfail-closed（nullのまま・例外なし）とした（Phase B-6B実装・Code commit **9436fec**・`index.htmlのみ+20/-2`・Path A/手動Leader再生成の2箇所に限定）。Validator本体・Executive Decision Engine本体・Package生成ロジック・Output Draft本文は無変更。Phase B-6A（調査・設計）で広域Gate案（Decision生成自体への組み込み）・狭域Gate案を比較検討し狭域案を正式採用。Phase B-6C実APIテスト（既存テスト案件を再利用・低コストプロンプトでAuto Task1回・手動Leader再生成1回・Path B dispatch1回を実施）で3経路とも正常完了・Executive Leader Report生成・Constitution Structure Check Passed（12/12）・Console Error 0・Network全リクエスト200 OKを確認。3経路とも`decisionStatus`は`hold`のため`approvedDecisionPackage`は常に`null`であり、Gate追加が既存正常系動作へ副作用を与えないことを実測確認済み。Phase B-6D（正式リリース）でdocs更新・commit・Annotated Tag **v1.01-executive-constitution-gate**・main push・Render反映まで完了。**server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-03（**Phase B-5C Constitution Structure Check 正式Complete（Phase B-5C-1〜B-5C-3統合・正式リリース）**＝Phase B-5 Constitution Validator Core（Decision089）の検証結果を、Executive Leader Report内の独立セクション「Constitution Structure Check（構造整合性チェック）」として表示し、Auto Task・手動Leader再生成・Path B（dispatch成立時）の完了直後に即時反映されるところまで完成した（Decision090）。**Phase B-5C-1（Decision対応契約）**：`_constitutionValidation`を`{decisionId, caseId, result}`のラッパー構造へ変更し、表示層がExecutive Decisionとの対応を安全に確認できるようにした（Validator戻り値自体・12検証項目は無変更・新規ID生成なし・Code commit **a2834d3**）。**Phase B-5C-2（表示実装）**：`_elrBuildReportHtml(decision, inbox, validation)`へ第3引数を追加し、Executive Summaryの直後・Leader Summaryの直前へConstitution Structure Checkを独立表示。Passed時は`checkedRules.length`から動的算出した「Passed（N/N）」の1行表示、Violations時は`violations[].message`を主表示・`rule`は`<details>`折りたたみ内のみに限定。`_elrRenderIntoChatArea()`側でdecisionId／caseId／現在案件caseIdの三重一致を確認し、不一致時はValidationセクションのみ非表示としReport本体は維持。不正データでも例外を出さない安全側正規化・既存`escapeHtml`によるエスケープを実装（Code commit **9e6d094**）。**Phase B-5C-3（即時再描画接続）**：`_elrRenderIntoChatArea()`のDOM挿入を`appendChild`から`insertBefore(先頭)`へ変更し、新設`_elrRefreshInChatArea()`（既存`.executive-leader-report`を除去して再描画するだけの限定更新・チャット全体は再構築しない）をAuto Task・手動Leader再生成・Path B（dispatch成立時のみ）の`_liCollectIntegration()`完了直後へ接続。調査の結果、既存`reRenderChatArea()`（チャット全体再構築）をそのまま使うとPath Bの`.leader-summary-block`直接追記スタイルが失われることが判明したため、限定更新方式を採用した（Code commit **58315ee**）。実APIテスト（Auto Task1回・手動Leader再生成1回・Path B dispatch1回・低コストプロンプト・既存テスト案件再利用・実測概算¥12）でPath A／手動再生成／Path B dispatch成立時とも追加のページ操作なしで即時反映を確認、dispatchなし時は従来どおり無反応・Cross-case（案件切替）で他案件のReport非表示・F5後は`_executiveDecision`/`_constitutionValidation`ともnullへリセットされること・Output Draft/Output Engineとも無変更であることを実測確認。Console Error 0・Network 200のみ。**Executive Constitution全14条の完全な意味論的検証・Evidence内容の十分性判定・Constitution違反によるOutput停止・Quality Gate・Completion Gate・Decision Ledger・Executive Memoryはいずれも未実装**。Code commit **ea1ae68（B-5 Core）＋a2834d3（B-5C-1）＋9e6d094（B-5C-2）＋58315ee（B-5C-3）**。**server.js/lib/DB/schema.sql/API無変更**。Decision 090・**Phase54 Complete維持・Phase55未着手**。次工程候補＝Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-03（**Phase B-5 Constitution Validator Core 正式Complete**＝Executive Decision Engineが確定させたDecision（Approved Decision Package内包）をExecutive Constitutionに照らして検証する読み取り専用の`validateExecutiveDecision(decision)`を追加。Decision・Package・Output Draftはいずれも書き換えず、判定結果`{version, passed, violations, checkedRules}`のみを`_constitutionValidation`へセッション内保持（F5で消失・永続化なし）。検証対象は`executive_decision_exists`／`decision_id_present`／`decision_status_present`／`executive_summary_present`／`decision_confidence_present`／`source_decision_id_consistency`／`package_only_when_approved`／`package_null_when_not_approved`／`output_draft_did_not_generate_package`／`package_holds_source_decision_id`／`cross_case_consistency`／`single_decision_authority`の12項目（Executive Decision・Approved Decision Package・案件スコープの構造整合性検証のみ）。`_edRunDecisionEngine()`内`_executiveDecision`確定直後に実行（Decision生成→確定→Validator実行→`_constitutionValidation`保持→既存後続処理の順を維持・確定前に実行される経路なし）。Node合成テスト13シナリオ26アサーション全PASS。実APIテスト（Auto Task1回＋手動Leader再生成1回・低コストプロンプト）でPath A（`sourceMode:'auto_task'`・`decisionId: ed-mscq548ee05g`）・手動再生成（`sourceMode:'manual_regeneration'`・`decisionId: ed-mscq6pcrymzi`）とも`passed:true・violations:[]・checkedRules12件`を実測。Path B直接チャットも試行したがdispatch非発生のため`_liCollectIntegration()`は起動せず（既存仕様どおり）、コード確認でdispatch発生時は同一Validator経路を通ることを確認。Executive Leader Report・Output Draft（`status:'ready'`・`packageQuality.score:71`・`fields.approvedDecisionPackage`キー不在を維持）・Output Engine・F5復元・案件切替いずれも既存挙動を維持（Console Error 0・Network 200のみ、実API概算¥13）。**Executive Constitution全14条の完全な意味論的検証・Evidence内容の十分性判定・成果物品質/完成度の実質評価・Constitution違反によるOutput停止・Validator結果のUI表示・Quality Gate・Completion Gate・Decision Ledger・Executive Memoryはいずれも未実装**。Code commit **ea1ae68**（`feat: add executive constitution validator`・index.htmlのみ+122/-1）。**server.js/lib/DB/schema.sql/API/UI無変更**。Decision 089・tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Validator結果のExecutive Leader Report表示／Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-03（**Phase B-4 Approved Decision Package 正式Complete（Phase B-4A〜B-4D統合）**＝Executive Decision Engineが会社判断イベント自体を表す`decisionId`を状態（approved/rejected/hold/insufficient）に関わらず必ず1回発行し（Phase B-4A）、Approved Decision Package（`sourceDecisionId`で元Decisionを参照・独自ID発行なし・Approved時のみ生成／Hold・Rejected・Insufficientはnull維持）を正式契約構造として確定。Path A通常フロー（Phase B-4B）・手動Leader再生成（Phase B-4C）の両経路からOutput Draft生成関数`buildOutputDraftFromLeaderFinal()`へPackageを受け渡し（正式取得元は`_executiveDecision.approvedDecisionPackage`のみ・caseId／sourceDecisionId不一致時は古いPackageを誤流用せず安全にnullへ破棄）、Phase B-4Dで`fields.approvedDecisionPackage`へ複製保存（Output Draftは所有者ではなく利用者・正本はExecutive Decision Engine側・将来Decision Ledgerが正式永続正本）。既存`fields` JSONB保存・POST1回・F5復元・案件切替・Cross-caseガードへ完全に相乗りし、DB・API・server.js・openaiClient.js変更なし。Phase B-4E統合検証で全13項目の合成テスト・Path A/手動再生成の実APIテスト（Auto Task1回＋手動再生成1回・decisionId/sourceDecisionId一致・fields.approvedDecisionPackage有無・F5復元・案件切替・Cross-case・Console Error0・Network異常なしを実測）を実施し、`buildOutputDraftFromLeaderFinal()`冒頭の古いコメント（Phase B-4D実装前の記述のまま）という軽微な不整合のみを発見・コメントのみ修正（ロジック変更なし）。通常運用ではdecisionStatusがApprovedへ到達しないため、Approved Decision Packageは常に`null`であることを正常結果として確認。`fields.executiveDecisionCache`・`_executiveDecision`のF5復元・Executive Leader ReportのF5再表示・Output EngineでのPackage表示・Constitution Validator・Quality Gate・Completion Gate・Decision Ledgerはいずれも未実装のまま（Phase B-5以降）。**Phase B-4 Approved Decision Package 正式Complete**。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-5 Constitution Validator（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-02（**Phase B-2 Executive Decision Control 正式工程分割（Phase B-2A／B-2B）・docs正式化のみ**＝Executive Decision Engine Core（Phase B-1・正式Complete維持）の次工程着手前に因果接続方式を調査。Path A通常フロー（`atRunWorkflow`）はAI社員実行〜Leader Final生成（`runLeaderFinalResponse()`）がサーバー側単一HTTPリクエスト内で完結し、クライアント側EDEはLeader Final生成前のデータへ介入できない構造的制約を実測確認。Leader Final候補生成後・Output Draft確定前にEDEを接続する段階導入方式（案D）を正式採用し、既存Phase B-2を**Phase B-2A（Executive Decision Control — Path A Causal Position・対象はatRunWorkflow()のみ）**と**Phase B-2B（Manual Leader Regeneration Alignment・対象はatTriggerLeaderFinal()）**へ正式分割（Decision087）。手動Leader再生成が完成成果物エンジンではなく軽量な`leaderSummary()`を使用し、EDE入力（`_wlLastResults`）が前回Auto Task時点のスナップショットのまま今回生成結果と紐づいていないことを実測発見したためB-2Bとして分離。Path B通常チャットはOutput Draft生成自体が存在しないためOutput Draft制御対象外のまま維持。Leader Final Candidate内部契約（`sourceEngine:'runLeaderFinalResponse'|'leaderSummary'`で区別）・Quality/Completion Gate未定義期間はdecisionStatusをapprovedへ到達させない方針・追加AI実行なしを正式決定。ロードマップをPhase B-1（Complete維持）→**B-2A→B-2B**→B-3（Executive Leader Report・旧B-2相当）→B-4（Approved Decision Package・旧B-3相当）→B-5（Constitution Validator・旧B-4相当）→A-2〜A-4→C-1〜C-3→D-safety→D→E→F-1〜F-2へ改訂。今回は**docs正式化のみでコード・DB・API・UI変更は一切なし**。tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-2A（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-02（**Phase A-1g Executive Constitution v1.0.0 正式化・docs正式化のみ**＝Leader Integration Layer Phase A（Decision084/085）正式Complete後、次工程着手前にAI COMPANY全体の上位アーキテクチャを正式設計。Executive Constitution（全14条・AI COMPANY最高位ルール）とExecutive Decision Engine（Leader Integration Layerの`_leaderIntegration`を因果連鎖内へ昇格させる会社判断層）を正式採用（Decision086）。`_leaderIntegration`は現時点では成果物確定後に情報を収集する観測・構造化層であり、Leader Final生成・Output Draft確定・Output Engine入力にはまだ接続されていない（Phase Aの未完成ではなく、回収・構造化・候補判定までがPhase Aの正式責務）。Executive ReportとOutput Engine完成成果物（既存`LEADER_FINAL_PROMPT`）は置き換えず併存させる方針・状態3軸分離（decisionStatus新設／既存`OUTPUT_STATUS`・`packageQuality.status`は無変更）・Decision Confidence（既存`_intelCalculateConfidence()`再利用＋Hard Gate）・Strategic Alternatives・Approved Decision Package（後方互換必須）・保存方式（段階導入案D・`output_drafts`をDecision Ledger正本として使用しない）を正式決定。正式ロードマップをPhase A-1g→B-1〜B-4（Executive Decision Engine Core／Executive Leader Report表示／Approved Decision Package契約化／Constitution Validator）→A-2〜A-4→C-1〜C-3→D-safety→D→E→F-1→F-2へ改訂。今回は**docs正式化のみでコード・DB・API・UI変更は一切なし**。tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-1 Executive Decision Engine Core（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-01（**AI COMPANY Leader Integration Layer（Phase A）後半 正式リリースComplete**＝Phase A本体（Decision084）に続き3工程を正式リリース。①messages案件別正本化：`server.js`の`/api/auto-task`・`/api/consult`の`saveMessage()`計4箇所へ既存受領済みcaseIdを追加（API/DB無変更）。②Leader Final状態サマリー分離：`runLeaderFinalResponse()`でcompleted成果は既存どおり統合しつつerror/skippedを状態サマリーとして分離しLeaderへ渡す（全員成功時は既存プロンプトと完全一致）。③Output Draft誤認防止：`buildOutputDraftFromLeaderFinal()`へ`noCompletedResults`判定を追加し、completed成果0件時はstatus:'ready'ではなく既存`OUTPUT_STATUS.ERROR`・Package Qualityを`score:0・insufficient`へ固定（工程3統合検証で「status:'ready'・Package Quality87点良好評価」という誤認問題を実測発見し工程3-2で解消）。正常系・一部成功・completed成果0件の3パターンをlocalhost実DBで再検証しCross-case混入なし・新規case_id=NULLなし・二重保存なし・Console Error 0・dev-check 200/200/200を確認。**`index.html`＋`openaiClient.js`のみ**（工程1 Code commit **5401b68**／工程2 Code commit **6032893**／工程3-2 Code commit **0d125e7**）。**server.js（messages案件別正本化を除き）・DB・schema.sql・API 無変更**。Decision 085・tag **v1.01-leader-integration-phase-a-complete**・**main push・Render反映・PC本番確認 完了**（ユーザー実施：ログイン/Auto Task/Leader Integration Layer/AI社員振り分け/Leader Final/Output Engine/Task同期/案件切替すべて正常・Cross-case混入なし・Console Error/Network異常なし・iPhone実機確認は対象外）。**AI COMPANY Leader Integration Layer（Phase A）正式Complete**。**Phase54 Complete維持・Phase55未着手**。次工程＝未定（Phase A-2 AI社員間再依頼／Phase A-3 成果物受け渡し／Phase A-4 Quality Loopは設計のみ完了・実装未着手・着手にはユーザー承認が必要。またはmessages RLS対応・Task skipped同期ギャップ対応等の残課題）。以前: 2026-07-31（**AI COMPANY Leader Integration Layer（Phase A）正式リリースComplete**＝LeaderをPath A（Auto Task）／Path B（Leader手動チャット）双方の成果物を回収・比較・矛盾候補検出・採否候補判定する統合管理層へ拡張。`_liCollectIntegration()`が各Pathの末尾（Leader Final受領直後／手動Leader Final再生成直後）から1回だけ呼ばれ、`_liAdaptPathA`/`_liAdaptPathB`が既存データ（`_wlLastResults`／`chatHistory`）を共通Leader Inbox形式へ変換。保存はクライアント一時メモリ（`_leaderIntegration`）のみ・新DB/新API/追加AI実行なし。Path Bは`interactionId`（`_liPathBSession`・chatHistory非接触）でworkflowIdと分離管理し過去回答混入を防止。矛盾候補・採否候補は必ずcandidate/hold（安全側既定値）でラベル付け、finalSummary生成（文章化）はPhase B以降。**実装過程で発見した既存不具合（案件切替後、手動Leader Final再生成`atTriggerLeaderFinal()`が古い案件のOutput Draftを別案件へ混入させ得る）を同一リリースでHotfix**＝冒頭に`_liCurrentCaseId()`と`_liLastPathAResultsCaseId`の厳格一致ガードを追加し、不一致時はAPI呼び出し・保存を一切行わず安全停止・再実行を案内。実機検証でHotfix適用前の実際の混入事故を確認（診断用Output Draft`out_1785449189461`が検証専用案件`case-ms82952wltd5`から既存案件「テスト」へ移動）・既存POST経路で案件`case-ms82952wltd5`へ復旧後、Supabase側で該当1行を限定削除・検証専用案件を削除。「テスト」「Instagramアカウント設計」等の既存案件・Leader横断ログ（`case_id: null`）は無変更。JavaScript構文OK・dev-check 200/200/200・git diff --check問題なし。**index.htmlのみ**（Phase A本体 Code commit **ad5eaf7** +336/-6／Hotfix Code commit **af43263** +11/-0）。**server.js/lib/DB/schema.sql/API/既存Path A・Path B内部処理/switchCase()/.at-result-card仕様/chatHistory構造/Output Draft保存仕様 無変更**。Decision 084・tag **v1.01-leader-integration-phase-a**・**main push・Render反映・PC本番確認・iPhone実機確認はこれから実施**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。次工程＝未定（Phase A-2 AI社員間再依頼／Phase A-3 成果物受け渡し／Phase A-4 Quality Loopは設計のみ完了・実装未着手・着手にはユーザー承認が必要）。以前: 2026-07-30（**Affiliate Intelligence Company 工程8-1/8-2/8-3A/8-3B/8-3B補正/8-3C Market Opportunity Intelligence 正式リリースComplete**＝ランキングカード・AIC最小パネル・Copy Full ReportへMarket Opportunity Intelligence表示追加（Competition直下）。`intelligenceContext.market`（既存受け皿）へ現在案件内の同一市場候補商材群を案件内集約（案C）で保存（新規入力なし・外部データなし）。共通ヘルパー`_intelSyncMarketGroupProductEvidence`が市場内対象商材群の既存Product Evidenceへ`usedBy:'market'`を冪等追記（新規Evidence生成なし）。保存済み判定はmarketKey＋caseId一致（productIdentifierではない点がContent/Competitionと異なる）。採用時に`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`＋`competition`＋`market`を同一Output Draftへ**七書き**し既存`pushOutputDraftToServer`を**1回**（**採用1回=POST1回維持・Market専用POSTなし**）。**実Supabase検証（専用caseId `case-ms79vojuf7g1`・商材2件）**：productCount=2・Evidence総数28件中22件が`usedBy:'market'`（両商材のproductIdentifierにまたがる＝母集団整合の実証）・derived集計値（想定利益合計23,840円/平均11,920円・Integrated Score平均52・IG適性平均65・他社競合数平均10）が実値と完全一致・F5復元一致・案件切替混入なし。**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts・cases の3テーブルとも）**確認。純関数・UI・保存・補正テスト計115アサーション全PASS・node --check OK・dev-check 200/200/200・Console 0。**index.htmlのみ**（foundation Code commit **2de9317** +172/-0／ui Code commit **4ef70ca** +174/-0／persist Code commit **e61e7d5** +32/-0／fix Code commit **3b1e5b7** +28/-9）。**server.js/lib/DB/schema.sql/API/output_drafts定義/`_icpDeriveTopic`/Workflow Wiring/ランキング順位/integratedScore/estimatedProfit式/Product/Revenue/ASP/Content/Competition Intelligence 無変更**。Decision 083・tag **v1.01-affiliate-market-opportunity-persistence**（予定）・**main push・Render反映・PC本番確認・iPhone実機確認はこれから実施**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。次工程＝未定（Market Opportunity完成によりVersion2 Core 7層のうち6層完成・残るは⑦Self Improvement Intelligenceのみ。Instagram実運用前のため着手判断は実績データ供給条件を再確認してから）。以前: 2026-07-29（**Affiliate Intelligence Company 工程7-1/7-2/7-3A/7-3B/7-3C Competition Intelligence 正式リリースComplete**＝ランキングカード・AIC最小パネル・Copy Full ReportへCompetition Intelligence表示追加（Content直下）。`intelligenceContext.competition`（新規モジュールキー）へ競合環境3項目（競合数・案件寿命・IG適性）をProduct Evidence共有参照で保存（新規Evidence生成なし）。未採用商材は使い捨てctxプレビュー（`_aicBuildCompetitionForRow`）・採用済み商材は保存済み`intelligenceContext.competition`を正本表示（💾・productIdentifier＋caseId一致・再計算しない）。★Competition Confidenceは競合環境の根拠充足度を示すのみで競合の強弱・参入余地・推奨可否は示さない・competitorsは生値のまま・新スコア/新閾値/参入余地判定なし。採用時に`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`＋`competition`を同一Output Draftへ**六書き**し既存`pushOutputDraftToServer`を**1回**（**採用1回=POST1回維持・Competition専用POSTなし**）。**実Supabase検証（専用caseId `case-ms5zz5g65x1p`）**：Evidence総数14件不変（product14/revenue9/asp4/content3/competition3・新規生成0）・Competition Confidence Medium（64点・independent3件）・F5復元完全一致・caseId分離確認。**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts・cases の3テーブルとも）**確認。純関数23/23 PASS・node --check OK・dev-check 200/200/200・Console 0・白画面/無限ロード/横スクロールなし。**index.htmlのみ**（foundation Code commit **675b3d0** +107/-1／ui Code commit **3feec7b** +117/-0／wire Code commit **d941cfd** +28/-0）。**server.js/lib/DB/schema.sql/API/output_drafts定義/`_icpDeriveTopic`/Workflow Wiring/ランキング順位/integratedScore/estimatedProfit式/Product/Revenue/ASP/Content Intelligence 無変更**。Decision 082・tag **v1.01-affiliate-competition-intelligence-persistence**（予定）・**main push・Render反映・PC本番確認・iPhone実機確認はこれから実施**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。次工程＝未定（Competition完成により残るIntelligence層＝Market Opportunity/Self Improvement等）。以前: 2026-07-29（**Affiliate Intelligence Company 工程6-1/6-2/6-3A/6-3B/6-3C Content Intelligence 正式リリースComplete**＝ランキングカード・AIC最小パネル・Copy Full ReportへContent Intelligence表示追加（ASP直下）。`intelligenceContext.content`へInstagram投稿適性3項目（保存率予測・クリック率予測・IG適性）をProduct Evidence共有参照で保存（新規Evidence生成なし）。未採用商材は使い捨てctxプレビュー（`_aicBuildContentForRow`）・採用済み商材は保存済み`intelligenceContext.content`を正本表示（💾・productIdentifier＋caseId一致・再計算しない）。採用時に`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`を同一Output Draftへ**五書き**し既存`pushOutputDraftToServer`を**1回**（**採用1回=POST1回維持・Content専用POSTなし**）。**実Supabase検証（専用caseId `case-ms3t75suuo2i`）**：Evidence総数14件不変（product14/revenue9/asp4/content3・重複なし）・Content Confidence Medium（64点・independent3件）確認。**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts とも）**確認。回帰テスト118/118 PASS・node --check OK・dev-check 200/200/200・Console 0・白画面/無限ロード/横スクロールなし。**index.htmlのみ**（foundation Code commit **2b3fdd0** +113/-0／ui Code commit **f2b0b5e** +126/-0）。**server.js/lib/DB/schema.sql/API/output_drafts定義/`_icpDeriveTopic`/Workflow Wiring/ランキング順位/integratedScore/estimatedProfit式/Product/Revenue/ASP Intelligence 無変更**。Decision 081・tag **v1.01-affiliate-content-intelligence-persistence**（予定）・**main push・Render反映・PC本番確認・iPhone実機確認はこれから実施**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。次工程＝未定（Content Intelligence完成により残るIntelligence層＝Competition/Market/Self Improvement等）。以前: 2026-07-28（**Affiliate Intelligence Company 工程5-3（5-3A/5-3B/5-3C）ASP Intelligence 表示UI・永続化 正式リリースComplete**＝ランキングカード・AIC最小パネル・Copy Full ReportへASP Intelligenceを表示（Revenue直下）。未採用商材は使い捨てctxプレビュー（`_affiliateCases`空/非配列でも例外なし）・採用済み商材は保存済み`intelligenceContext.asp`を正本表示（💾・再計算しない）。採用時に`affiliateContext`＋`product`＋`revenue`＋`asp`を同一Output Draftへ**四書き**し既存`pushOutputDraftToServer`を**1回**（**採用1回=POST1回維持・ASP専用POSTなし**）。**実Supabase検証（専用caseId）**：Evidence総数12件不変（product12/revenue9/asp4・重複なし）／F5復元で推奨ASP・Confidence・比較数・Independent件数・`updatedAt`完全一致＝再計算なしを実証／caseId分離（別案件混入なし）／Copy Full Report正常／Product・Revenue・ranking・integratedScore・estimatedProfit回帰なし／**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts とも）**確認。純関数 工程5-3A/5-3B 27＋工程5-1/5-2再実行44＝**71/71 PASS**・dev-check 200/200/200・Console 0。**index.htmlのみ +146/-0**（Code commit **b473053**）。**server.js/lib/DB/schema.sql/API/output_drafts定義/`_icpDeriveTopic`/Workflow Wiring/ランキング順位/integratedScore/estimatedProfit式/Product Intelligence/Revenue Intelligence 無変更**。Decision 080・tag **v1.01-affiliate-asp-intelligence-persistence**・**main push・Render反映**・**PC本番確認・iPhone実機確認 完了（2026-07-28・ユーザー実施：PC＝ログイン/ホーム/Output Engine/Affiliate Intelligence Core/Revenue Intelligence（空状態）/ASP Intelligence/おすすめ順位ランキング/Copy Full Report すべて正常・白画面/無限ロード/崩れなし。iPhone＝同項目に加え案件入力フォーム正常・Copy Full Report「コピーしました」表示確認・横スクロール/画面停止なし。保存済み案件なしのためProduct Intelligence保存済み表示/💾表示は確認対象外）**。**Phase54 Complete維持・Phase55未着手**。次工程＝未定（ASP Intelligence 7層構想の残りIntelligence層等）。以前: 2026-07-28（**Affiliate Intelligence Company 工程5-1・5-2 ASP Intelligence（③層）正式リリースComplete**＝③ASP層をProduct Intelligence上の**比較説明レイヤー**として追加。`intelligenceContext.asp`（正規化商品名×market単位グルーピング・ASP名はグループキーへ含めない）へ**Active評価（`_aicIsPersisted`）のみを候補化**（同一productIdentifier重複は1件に限定）／推奨ASPは既存`estimatedProfit`（`_aicEstimate`再利用・再算出なし）**最大**＋決定的タイブレーク（承認率→EPC→報酬→ASP名）・有効候補2件未満は推奨不可／Evidenceは新規生成せず**採用商品のEvidenceにのみ`usedBy:'asp'`を冪等追記**（他候補は読み取りのみ・永続Evidence書き戻しなし）／ASP Confidence（`_intelCalculateAspConfidence`）は既存`_intelCalculateConfidence`（工程2共通基盤）を再利用・母集団は`usedBy:'asp'`Evidenceのみ・**独立3件未満Insufficient**・**比較ASP数/有効利益候補2件未満は強制insufficient**・Product/Revenue Confidenceと分離／**順位・integratedScore・estimatedProfit式・Product/Revenue Intelligence 無変更**（説明レイヤーの原則）。純関数 工程5-1 18＋工程5-2 26＝**44/44 PASS**・JavaScript構文OK・dev-check 200/200/200・Console 0・Supabase書込み0・AI API実行0。**index.htmlのみ +212/-0**（Code commit **17587296c9413f53dcc05e4c72897ac4e8d0643a**）。**server.js/lib/DB/schema.sql/API/output_drafts/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation 無変更**。**表示UI接続・Output Draft永続化・F5復元は工程5-3へ分離（今回未実装）**。Decision 079・tag **v1.01-affiliate-asp-intelligence**・**main push・Render反映**・**iPhone実機確認 完了（2026-07-28・ユーザー実施・ログイン/ホーム/案件一覧/案件切替/Task/Auto Task/Leader/Output Engine/Affiliate Intelligence Core/Revenue Intelligence 正常・レイアウト崩れ/横スクロール/白画面/無限ロード/画面停止 いずれもなし）**。**Phase54 Complete維持・Phase55未着手**。次工程＝**ASP Intelligence 工程5-3（表示UI・永続化・F5復元、仕様未確定）**）。以前: 2026-07-27（**Affiliate Intelligence Company 工程4 Revenue Intelligence 正式リリースComplete（4-1〜4-4）**＝⑤Revenue層を Product Intelligence 上の**読み取り専用説明層**として追加。`intelligenceContext.revenue`（財務入力7＋派生2）へ Product Evidence を `usedBy:'revenue'` で**共有参照**（新規Evidence生成なし・件数不変・usedBy冪等）／Revenue Confidence は `_intelCalculateConfidence` 再利用・**財務入力Evidenceのみ母集団**（派生は二重計上しない）・独立3件未満Insufficient・Product Confidenceと分離／AIC最小パネル＋カードRevenueライン（円/月・null情報なし・0有効・**順位不変**）／採用時に `affiliateContext`＋`product`＋`revenue` を同一Draftへ**両書き**・**既存 `pushOutputDraftToServer` で採用1回=POST1回**・**保存済みRevenue優先表示（💾）**・旧Draftは非永続プレビューへfallback。**実Supabase保存/F5復元（Confidence保存値維持・再計算なし）/採用1回=POST1/表示・復元POST0/テストデータ限定削除 remaining=0（draft=null）** を確認。純関数（4-1）31＋（4-2）31・表示12ケース・永続化15ケース 全PASS・dev-check 200/200/200・Console 0・回帰なし。**index.htmlのみ +230/-1**（Code commit **8cde936**）。**server.js/lib/DB/schema.sql/API/output_drafts/`_icpDeriveTopic`/Workflow Wiring/ランキング順位/integratedScore/estimatedProfit式/`_intelCalculateConfidence`本体/Product Intelligence 無変更**。Decision 078・tag **v1.01-affiliate-revenue-intelligence**・**main push・Render反映**・**iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・横スクロールなし・空状態正常）**。**Phase54 Complete維持・Phase55未着手**。次工程＝**ASP Intelligence 開始前調査・設計（未着手）**）。以前: 2026-07-27（**Affiliate Intelligence Company 工程3 Product Intelligence 正式化・工程3-3 正式Complete**＝採用時に `fields.affiliateContext` ＋ `fields.intelligenceContext.product` を同一Output Draftへ**両書き**し既存 `pushOutputDraftToServer` で**1回保存**（採用1回=POST1回）。一時変数で両context構築→必須項目/caseId6項目一致ガード→全成功時のみ一括反映（片方だけ書かない）・intelligenceContextはdeep copy後にproduct生成・`_intelSaveContext`不使用。**実Supabase保存/F5復元/同一商品Evidence非増殖(14→14)/別商品Product置換・旧Evidence保持(14→28)/テストデータ限定削除 remaining=0(API読戻し draft=null)** を確認。隔離テストA〜F全合格・dev-check 200/200/200・Console 0・回帰なし。**index.htmlのみ**（工程3-1 **28fa51c** +159/-0 Productスキーマ・Evidence配線／工程3-2 **1d04f31** +49/-0 ランキングConfidence表示／工程3-3 **3ef7495** +58/-10 両書き永続化）。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/ランキング順位/Confidence計算式/工程3-2表示関数 無変更**。Decision 077・tag **v1.01-affiliate-product-intelligence-persistence**・**main push・Render反映**・**iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・空状態正常）**。**Phase54 Complete維持・Phase55未着手**）。以前: 2026-07-26（**Affiliate Intelligence Company 工程2 Evidence/Confidence 共通基盤 実装・実機検証完了**＝`outputDraft.fields.intelligenceContext`（JSONB）へ Evidence共通型（7種・`ev-<UUID>`・検証・派生/独立区別）／Confidence共通型（**独立Evidence3件未満は点数不問で Insufficient**・推定依存で減点）／`_intel*` helper／AICパネル最小表示を追加。**index.htmlのみ +372/-0**・**server.js/lib/DB/schema.sql/API 無変更・新DB列/新APIなし**・**affiliateContext/_icpDeriveTopic/Workflow Wiring 未変更**。純関数18/18・dev-check 200/200/200・実Supabase保存/F5復元/POST1回/affiliateContext併存/テストデータ削除 remaining=0 確認・Code commit **29d82c1**・tag **v1.01-affiliate-intelligence-evidence-confidence**・**main push・Render反映済み・iPhone実機確認完了＝工程2 正式Complete**（Decision 076）。**Phase54 Complete維持・Phase55未着手**）。以前: 2026-07-24（**Instagram自動運営 Workflow Wiring 本体 完了・本番反映済み**＝採用Affiliate商材を既存Instagram Output Draftの `fields.affiliateContext` へ非破壊スナップショットし Content Planning の topic導出へ接続。**commit 745dd1e・main push済み・Render反映済み・iPhone実機確認完了**・tag **v1.01-instagram-planning-wiring**（Decision 075））。以前: 2026-07-23（**Affiliate Evaluation 工程1 完了（クローズ）**＝工程1-D調査の結論として **P2〜P6は現時点で実装不要・保留継続を正式決定**（Decision 074）。工程1-A（永続化API）／1-B（Active一意性の商材単位化・Workflow Wiring・Active Case Hotfix）／1-C（schema.sql記録）／1-D（保留の正式決定）が揃い、**商材選定→投稿企画への接続基盤が完成**。**実装なし・docs更新のみ**。次工程＝**Instagram自動運営（Workflow Wiring）**。**Phase54 Complete維持・Phase55未着手**）。以前の記録: **Affiliate Evaluation 工程1-C（案A）schema.sql記録 完了**＝実DB定義を読み取り専用SELECTで実測（30列・PK・UNIQUE・CHECK・Index・RLS・Trigger/FKなし）し、**正本として `supabase/schema.sql` へ純追記**（+76/-0・実測とdriftなし）。**記録用でありMigrationではない**。**DDL実行なし・実DB無変更・server.js/lib/index.html/API 無変更**。P2〜P6を工程1-D以降候補として保留（Decision 073）。**Phase54 Complete維持・Phase55未着手**・**commit未実施**。以前の記録: **工程1-B本体 Active Case Hotfix**＝本番通常経路の読み取り確認で「案件未確定ビューでも『案件を追加』が有効になり直前案件へ保存され得る」不具合を検出し修正。原因＝`getCurrentApprovalCaseId()` の **`_lastOutputDraft.caseId` フォールバック**。Affiliate専用 **`_aicCurrentCaseId()`** を追加しAIC内4箇所を統一。**`getCurrentApprovalCaseId()` は無変更**。**index.htmlのみ +17/-4**・localhost Case1〜4合格・**POST/PATCH/DELETE 0回**。以前の記録: **Instagram自動運営 工程1-B本体（Workflow Wiring）Complete**＝Affiliate Intelligence Core と永続化APIを接続。**index.htmlのみ +390/-4**・`server.js`／`lib`／DB／Migration／API shape **無変更**。案件境界D-1・退避バッファ・冪等統合・channelScope安全補強を実装。**第2段階 localhost実DB検証 Case1〜9 全合格**・**テストデータ削除完了（`remaining = 0` 確認済み）**。**未commit**。以前の記録: **工程1-B-0a〜0d 完了**＝Affiliate評価のActive一意性を**商材単位**へ移行。**Migration完了**（`uq_affiliate_eval_active_case` 廃止 → `uq_affiliate_eval_active_product` 適用）・**`lib/affiliateEvalDb.js` 実装完了**（Code commit **2ef2ad3**）・**実DB POST検証 全8ケース成功**・**専用テストデータ削除済み**（`remaining = 0`）。`server.js`／`index.html`／`schema.sql` **無変更**・**API shape維持**。**Phase54 Complete維持・Phase55未着手**）。以前の記録: 2026-07-21（**社員向上B 正式完了**（定義駆動基盤完成・**13型中11型移行済み**〔完全定義駆動6・ハイブリッド5〕・**Flyer/LP 正式保留**）・**localhost検証完了・push前・Render未反映**。HEAD **61dde05**／origin/main **ac2f5da**／local ahead **7**／最新Tag **v1.01-phase54-video-html-section-migration**。**Phase54 Complete維持・Phase55未着手**。次の最優先＝**Instagram自動運営機能**。※本番実機確認は未実施）。以前の記録: 2026-07-17（**Phase54 正式Complete維持**。**改善案件 工程A（設定保持）完了・localhost確認済み**（commit **8c9ed58**・tag **v1.01-phase54-agent-settings-persistence**）＝Auto Task／自律相談の選択状態を**端末内**でlocalStorage保持。**autoStart復元は設定・表示のみで起動時のWorkflow・AI自動実行なし**（課金防止設計を維持）。**端末間同期は非対象**。**Phase55未着手・工程B以降は未着手**。**前工程Hotfixの本番実機確認は保留**。以前の記録：**Task新規作成 二重化 Hotfix 完了・本番反映済み・localhost確認済み**（commit **39b44d0**・tag **v1.01-phase54-task-create-dbid**）＝`submitTask()` の dbId 誤代入と `atCreateNextTasksFromItems()` の dbId 握り潰しを修正・**全7作成経路を統一**。既存の**重複16グループは未整理・別途判断**。以前の記録：**Task一括操作 Hotfix 完了・本番反映済み・localhost実機確認済み**（commit **deba2ed**・tag **v1.01-phase54-task-bulk-parallel**）＝一括アーカイブ／復元／完全削除を**同時5並列化**・**進捗表示／二重実行防止／成功ごとの保存**を追加。**Phase55未着手**。以前の記録：**Task表示仕様変更 完了・本番反映済み・PC/iPhone実機確認完了**（**Task Home Overview** commit **5fe2b64**・tag **v1.01-phase54-task-home-overview**／**Task Sort Order** commit **bbfbc73**・tag **v1.01-phase54-task-sort-newest**）。先行して **Case成功確認契約 完了**（aed5f7d・tag v1.01-phase54-case-sync-contract）・**案件系Known Issue 全Close＝Case同期系Complete**（tag v1.01-phase54-known-issue-case-closed）。HEAD = origin/main = **bbfbc73**（docs更新後は本更新commitが最新HEAD）。**Phase55未着手**。以前の記録：Phase54 Known Issue（Task表示不一致）Closed・tag v1.01-phase54-known-issue-c2／Phase54 Remaining Realtime Sync 正式Complete・tag v1.01-phase54-complete）

---

## IADP Structured Output 正式リリースComplete（2026-08-18・Decision103）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**（Version変更なし）
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（Phase55へは移行しない）
- **状態**：**IADP Structured Output ＝ 正式リリースComplete**。実運用予定のInstagram案件`case-msr9yckye65y`にIADPを正式生成する過程で発生したValidation FAILを解消した。
  1. **根本原因**：IADP Leader Final呼び出し（`openaiClient.js`）が自由記述（フリーテキスト補完）のみに依存しており、Promptは正式schemaを正確に要求していた（正しい完全サンプルJSON・絶対規則の明示・10点自己チェックリストを含む）にもかかわらず、実生成結果が`finalProfile`のトップレベル配置と`intelligence.candidateComparison`/`intelligence.adoptionDecision`の出力を2重に逸脱した。過去に同一Prompt・同一APIパスで正しいIADPが生成された実例（`case-msoplrg6gdkr`）が存在することから、Prompt契約自体の欠陥ではなく自由記述への依存という構造的脆弱性と判断。
  2. **IADP Structured Output**：OpenAI Responses APIの`text.format:{type:'json_schema',strict:true}`（公式ドキュメントで仕様を実測確認・推測せず）を`callOpenAI()`へ`options.structuredOutput={name,schema}`という新規任意経路として追加し、**IADP Leader Final呼び出し1箇所のみ**で有効化。他の全`callOpenAI()`呼び出しは無影響（合成テストで実測確認）。
  3. **Schemaの設計原則**：`shared/instagramAccountDesign.js`のValidatorが実際に検証・消費するフィールドのみを対象とし、Validatorより強い意味制約は追加しない。`normalizeAccountDesignPackage()`が常に上書き・自動生成する`version`／`packageId`／`caseId`／`approval`／`decisionMadeBy`／`evaluationAxes`／`minCandidates`はモデルへ要求しない。strict:true制約（全プロパティrequired・全objectにadditionalProperties:false）を静的自己検証しエラー0件。`fieldStatus`は動的辞書をstrict modeで表現できないため`{path,status}[]`配列として受け取り、`extractIadpJsonFromLeaderText()`側の最小adapterで既存の辞書形へ変換する。
  4. **プロンプト本文は無変更**：`ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT`は意図的に一切変更していない。strict modeの制約付きデコードが出力チャネル自体をschema準拠JSONへ強制するため、旧来のタグ関連指示は実行時に無害化される。
  5. **後方互換**：`extractIadpJsonFromLeaderText()`の既存タグ抽出ロジックは1行も変更なし。タグが見つからない場合のみ直接JSON抽出を試みる経路を追加のみ。
  6. **Formal Truth安全契約の完全維持**：`adoptedCandidateId`の推測生成なし・candidate不足時の自動水増しなし・`marketResearch.candidates`（市場ジャンル候補）から`candidateComparison.candidates`（アカウント設計案比較）への自動コピーなし（別責務と確定）・`finalProfile`の推測補完なし・validation失敗時の非保存維持・validation条件の緩和なし。`shared/instagramAccountDesign.js`は1行も変更していない。
  7. **実AI E2E検証**：`case-msr9yckye65y`で1 workflow・実call8（見積り一致）を実行。Responses APIがSchemaを受理（`fallback:false`・純粋JSON応答・`<IADP_JSON>`タグ0件）。`validateAccountDesignPackage()`が`valid:true`、`candidateComparison.candidates`3件（10軸スコア充足）・`adoptionDecision.adoptedCandidateId`が実在候補と一致・`finalProfile`がトップレベルに正しく配置（前回FAILの直接原因が再発しないことを実測確認）。Evidence 0件・Quality Gate failed・Readiness not_readyは正直な未達状態として維持（推測補完なし）。他7 case・STABILITY案件は完全不変（Cross-case混入なし）。User Approvalはpending不変。OpenAI cost増分+$0.96・Claude cost増分+$0.2028838。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - working treeに存在した別系統の未commit差分「Leader Case Context Phase2」（`buildLeaderCaseContext()`／`_leaderCaseContextToText()`を含むcaseId伝播一式）は、今回のIADP Structured Outputと機能的依存がないため意図的に除外した。同一ファイル内で隣接・混在していた箇所（`openaiClient.js`の`runLeaderFinalResponse`関数シグネチャ等）はクリーンHEADを基点に本リリース分のみを再構成した専用パッチで、hunk単位ではなく行単位で分離しcommitした。
  - **本番環境には現時点で`buildLeaderCaseContext()`が存在しない**（clean HEADに一度も含まれたことがない）。Formal Truthの一括参照が必要な作業では、この関数が別途正式リリースされているか必ず確認すること。
- **変更範囲**：**`openaiClient.js`／`index.html`（最小限）／`iadpStructuredOutput.test.js`のみ**（Code commit **8a9d417**）。**`shared/instagramAccountDesign.js`・server.js・claudeClient.js・DB・schema.sql・APIはすべて無変更**。
- **Git現在地**：branch **main**／Code commit **8a9d417**／docs commit＝本更新（以降の最新HEAD）／Annotated Tag **v1.01-iadp-structured-output**（作成予定）／push＝本記録後に実施。
- **次工程候補**：Instagram実運用案件`case-msr9yckye65y`のEvidence充足（EEA経路：Search Plan→ユーザー承認→Web Search）。IADP自体は正式生成・保存済みのため、Evidence充足後にQuality Gate再評価→Account Creation Readiness確認→User Approval→Instagramアカウント実作成という残工程へ進む。「Leader Case Context Phase2」の別途リリース判断は今回自動着手しない。**Phase55未着手のまま維持**（Decision 103）。

---

## Deliverable Completion Architecture（STEP 6）正式リリースComplete（2026-08-18・Decision102）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**（Version変更なし）
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（Phase55へは移行しない）
- **状態**：**STEP 6 Deliverable Completion Architecture ＝ 正式リリースComplete**。「AIが処理を終えた」ことと「依頼が本当に完了した」ことを分離するCompletion判定軸を新規採用した。
  1. **Completion Core（工程1）**：`OUTPUT_PACKAGE_QUALITY_CHECKS`へ`required:true/false`属性を追加のみ（既存score計算は無変更）。純関数`evaluateDeliverableCompletion(draft, context)`（Contract v1.0.0・追加AI call 0）がoutputType別required項目の充足から`complete`／`incomplete`／`blocked`を判定。`blocked`は必須成果物充足済み＋外部実行語＋User Approval pendingの組み合わせでのみ発火する安全側限定判定。
  2. **Completion保存・復元（工程2）**：新DB列・新テーブルなし。既存`package_quality`（JSONB）へ`completionAssessment`を同梱保存し、F5復元時にdraftトップレベルへ再展開（`_outputDraftFromServerRow()`）。`FORMAL_CASE_FIELDS`には含めない（成果物固有の評価のため次Draftへcarry-forwardしない）。
  3. **Formal Truth Race Condition安全化**：案件切替直後にAuto Taskが開始するとOutput Draft復元完了前に走り、`FORMAL_CASE_FIELDS`（iadp／intelligenceContext／affiliateContext／approvedDecisionPackage）のcarry-forwardが不成立になる実測済み競合を発見。`scheduleOutputDraftRestore()`を実際の復元Promiseを返す方式へ変更し、`atRunWorkflow()`が`_lastOutputDraft.caseId`不一致時のみ復元完了をawaitするガードを追加（sleep/setTimeout不使用）。従来`iadp`単一field限定だったcarry-forwardも契約全体（4項目）へ一般化し、`intelligenceContext`が別種Auto Task実行のたびに欠落する問題も同時解消。
  4. **Formal Truth復旧**：上記Race Conditionの再現検証中に`case-msoplrg6gdkr`で発生した`iadp`/`intelligenceContext`欠落を、ユーザー承認を得たうえで直前の正常Draftからの2項目限定マージ（他fields・他列は不変）で復旧。Cross-case書き込みなし。
  5. **実AI E2E検証**：`estimateAutoTaskCalls()`（純関数・追加AI call 0）の事前見積りmax=5に対し実call数5（Claude3＝Company Brain`claude-opus-4-8`・Reviewer・Strategy／OpenAI2＝sns・Leader Final`gpt-4.1-nano`系）で一致。新規Draft`out_1786976475516`でFormal Truth carry-forward・completionAssessment DB保存/F5復元一致・他7 case完全不変（Cross-case非混入）・想定外カスケードなし・Web Search0回を実測。OpenAI cost増分+$0.17・Claude cost増分+$0.1632238。
  6. **Completion UI（工程3-A）**：Output Engineパネルへ`buildCompletionStatusHtml()`による最小表示（Complete/Incomplete/Blockedの短縮バッジのみ・contract全体は非表示）を追加。`completionAssessment`が存在しない既存Draftは非表示（Complete扱い・推測表示のいずれもしない）。
  7. **Output Type判定精度改善（工程3-C）**：`detectOutputType()`の`instagram_post`キーワードへ`instagram`/`インスタ`裸トークンを追加し、carousel固有語（カルーセル／スライド／10枚／投稿画像／リール）を含まない一般的なInstagram投稿依頼が`instagram_carousel`へ誤判定される実バグを修正。13型代表フレーズ再判定で既存分類に回帰なし・既存fallback（`document`）は維持。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - Completionは「依頼に必要な成果物が揃ったか」のみを判定する。Quality Gate（成果物品質）・Constitution（会社原則）・User Approval（本人承認・読み取り専用参照のみ）・Formal Truth Priority（Case Context正本利用）とは責務分離し、いずれも重複判定・書き換えを行わない。`status=ready`をCompletion=completeへ読み替える経路も存在しない。
  - `node --test`は81 PASS／6 FAIL。FAIL6件は`server.test.js`のLeader固定返信テキスト正規表現不一致（応答文言ドリフト）で、本リリース（`index.html`のみ）とは無関係のpre-existing failureと確認済み。今回は修正していない。
  - working treeに存在した別系統の未commit差分「Leader Case Context Phase2」（Leader dispatch各関数への`caseId`伝播。`claudeClient.js`／`openaiClient.js`／`server.js`および`index.html`一部hunk）はSTEP 6と機能的依存がないため意図的にhunk単位で分離し、今回のcommit対象から除外した。別途ユーザー判断でリリースする。
- **変更範囲**：**`index.html`のみ**（Code commit **364b65a**）。**server.js・openaiClient.js・claudeClient.js・DB・schema.sql・APIはすべて無変更**。
- **Git現在地**：branch **main**／Code commit **364b65a**／docs commit＝本更新（以降の最新HEAD）／Annotated Tag **v1.01-deliverable-completion-architecture**（作成予定）／push＝本記録後に実施。
- **次工程候補**：Instagram実運用（アカウント作成→プロフィール設定→ASP登録→商品調査→投稿企画→初回投稿→KPI取得→Learning実測）を優先。「Leader Case Context Phase2」の別途リリース判断・`server.test.js`既知6件FAILの扱いは今回自動着手しない。iPhone実機確認（Output Engine表示・Completion UI・既存画面非崩壊・案件切替後の正常動作）はユーザー実施待ち。**Phase55未着手のまま維持**（Decision 102）。

---

## Phase B-2 Executive Decision Control 正式工程分割（Phase B-2A／B-2B・2026-08-02・docs正式化のみ）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **状態**：Executive Decision Engine Core（Phase B-1・正式Complete・維持）の次工程Executive Decision Controlについて因果接続方式を正式調査・設計した（Decision087）。
  1. **構造的制約（実測）**：Path A（`atRunWorkflow()`）はAI社員実行〜Leader Final生成（`runLeaderFinalResponse()`）がサーバー側単一HTTPリクエスト内で完結し、クライアント側EDEはLeader Final生成前のデータへ介入できない。
  2. **接続方式**：Leader Final候補生成後・Output Draft確定前にEDEを接続する段階導入方式（案D）を正式採用。追加AI実行なし。
  3. **工程分割**：既存Phase B-2を**Phase B-2A（Path A通常フローの因果位置確立）**と**Phase B-2B（手動Leader再生成の整合化）**へ正式分割。
  4. **Path A手動再生成の実測発見**：`atTriggerLeaderFinal()`は完成成果物エンジン`runLeaderFinalResponse()`ではなく軽量な`leaderSummary()`を使用し、EDE入力（`_wlLastResults`）が前回Auto Task時点のスナップショットのまま今回生成結果と紐づいていない。この整合化をPhase B-2Bへ分離。
  5. **Path B通常チャット**：Output Draft生成自体が存在しないため、Output Draft制御対象外のまま維持（Executive Decision Engine実行自体は許可）。
  6. **Leader Final Candidate**：`candidateArtifacts`（AI社員個別成果物）とは別の内部契約として新設方針。`sourceEngine:'runLeaderFinalResponse'|'leaderSummary'`で完成成果物と軽量方針サマリーを区別。
  7. **Approved暫定条件**：Quality Gate・Completion Gate未定義の間はdecisionStatusをapprovedへ到達させない（Auto Task・既存Leader Final・既存Output Draftは従来どおり継続）。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - Phase B-2Aの目的は正式な成果物制御ではなく、**因果位置と入力契約の確立**。既存Output Draft挙動・POST回数（1回）は完全無変更のまま検証する。
  - Phase B-2Bは**Phase B-2A完了後に開始**（同時実装しない）。
  - `_executiveDecision`は引き続き`executionMode:'post_observation'`／`affectsLeaderFinal:false`／`affectsOutputDraft:false`／`affectsOutputEngine:false`を維持しており、**Executive Decision EngineがOutputを既に制御しているとは記述しない**。
- **変更範囲**：**docsのみ**（01PROJECT_STATUS.md／02PHASE_PROGRESS.md／04DECISIONS.md／04ROADMAP.md／06HANDOVER_NEXT_CHAT.md／CHANGELOG.md）。**index.html・openaiClient.js・server.js・lib・DB・schema.sql・API・UI・Render・Supabaseはすべて無変更**。
- **Git現在地**：branch **main**／docs commit＝本更新（以降の最新HEAD）／Tag作成なし／**push未実施**（ユーザー確認後に別途判断）。
- **次工程候補**：Phase B-2A Executive Decision Control — Path A Causal Position（未着手）。ただしユーザー承認なしに開始しない。**Phase55未着手のまま維持**（Decision 087）。

---

## Phase A-1g Executive Constitution v1.0.0 正式化 ／ Executive Decision Engine 正式採用（2026-08-02・docs正式化のみ）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **状態**：Leader Integration Layer Phase A（正式Complete・維持）の次工程着手前に、AI COMPANY全体の上位アーキテクチャを正式設計・docs採用した（Decision086）。
  1. **Executive Constitution v1.0.0**：AI COMPANY全体の最高位ルールとして全14条を正式採用。Evidence原則／Quality原則／Completion原則／Approved Decision Package原則／ユーザー承認原則／事実性原則／Constitution優先原則／案件分離原則／正本一意性原則／監査可能性原則／過去記録不変原則／学習の安全境界原則／状態軸分離原則／安全側既定値原則。変更統制（ユーザー承認・Version更新・`04DECISIONS.md`への記録の3条件必須）も正式採用。
  2. **Executive Decision Engine**：新規独立Engineではなく、既存Leader Integration Layer Phase Aの`_leaderIntegration`／Leader Inboxを因果連鎖内へ昇格させる会社判断層として正式採用。正式責務＝統合・矛盾確認・採否判断・Decision Confidence算出・Strategic Alternatives管理・Approved Decision Package生成。非責務＝Leader Final本文生成・Output Engine成果物生成・`OUTPUT_STATUS`/`packageQuality.status`の所有。
  3. **Executive Report併存**：完成成果物（既存`LEADER_FINAL_PROMPT`）を置き換えず、Executive Summary（結論／採用案／採用理由／却下・保留案／期待成果／主要リスク／次工程）を上位判断層として将来追加する方針。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - `_leaderIntegration`（Phase A）は現時点で**成果物確定後の事後観測層**であり、Leader Final生成・Output Draft確定・Output Engine入力のいずれにも接続されていない。Phase B-1でこれを因果連鎖内へ昇格させることが次工程の中核。
  - Decision Confidenceは既存`_intelCalculateConfidence()`の再利用＋Hard Gateの上乗せを正式方針とし、新加重式は発明しない。
  - 保存方式は段階導入案D（Phase B＝メモリのみ→Phase B後半候補＝Output Draftへの一時キャッシュ限定→Phase C-1＝専用`executive_decisions`永続化）。**`output_drafts`はPRIMARY KEY`output_id`のupsert上書き方式のため、Decision Ledgerの正本として使用しない**。
  - Executive Memoryの着手条件（Decision Ledger永続化済み・Learning Center永続化済み・Outcome Record存在・Instagram実運用データ存在・Self Improvement利用可能）が揃うまでPhase F-2（最後段）に配置。
- **変更範囲**：**docsのみ**（01PROJECT_STATUS.md／02PHASE_PROGRESS.md／04DECISIONS.md／04ROADMAP.md／06HANDOVER_NEXT_CHAT.md／CHANGELOG.md）。**index.html・openaiClient.js・server.js・lib・DB・schema.sql・API・UI・Render・Supabaseはすべて無変更**。
- **Git現在地**：branch **main**／docs commit＝本更新（以降の最新HEAD）／Tag作成なし／**push未実施**（ユーザー確認後に別途判断）。
- **次工程候補**：Phase B-1 Executive Decision Engine Core（未着手）。ただしユーザー承認なしに開始しない。**Phase55未着手のまま維持**（Decision 086）。

---

## AI COMPANY Leader Integration Layer（Phase A） **正式Complete**（2026-08-01・Code commit 5401b68/6032893/0d125e7・main push・Render反映・PC本番確認 完了）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（Phase A完成を理由にPhase55を開始しない）
- **状態**：Phase A本体（Decision084）に続き、messages案件別正本化（工程1）・Leader Final状態サマリー分離（工程2）・Output Draft誤認防止（工程3-2、工程3統合検証で発見した問題への対応）の3工程を正式リリースし、PC本番確認も完了。**Leader Integration Layer Phase A 正式Complete**。
- **PC本番確認結果（ユーザー実施）**：ログイン正常・Auto Task正常・Leader Integration Layer正常・AI社員振り分け正常・Leader Final正常生成・Output Engine正常表示・Task同期正常・案件切替正常・Cross-case混入なし・Console Errorなし・Network異常なし。Task表示は全案件13件・案件を開くと該当案件のみ表示（既存の正常仕様）。Output Engineの内容差分はLeader Integration Layer改善に伴う正常な更新として確認・異常なし。iPhone実機確認は対象外。
- **変更範囲**：`index.html`＋`openaiClient.js`のみ（工程1 +4/-3・工程2 +62/-14・工程3-2 +236/-18）。**server.js（messages案件別正本化を除き）・DB・schema.sql・API 無変更**。
- **Git現在地**：branch **main**／Code commit **5401b68（工程1）＋6032893（工程2）＋0d125e7（工程3-2）**／Annotated Tag **v1.01-leader-integration-phase-a-complete**。
- **既知の残課題**：Task管理⇔サーバー`skipped`状態同期ギャップ／F5復元時の`isLeaderFinal`メタフラグ欠落／`messages`テーブルRLS DELETEポリシー不在（テストデータ累計remaining約53件）／`enabled:false`スキップ時のtask_history.workflowId欠落。いずれも既存挙動・別工程で対応判断。

---

## AI COMPANY Leader Integration Layer（Phase A） **正式リリースComplete**（2026-07-31・Code commit ad5eaf7/af43263・main push・Render反映・PC本番確認・iPhone実機確認はこれから実施）

> 記録日: 2026-07-31。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（Leader Integration Layer完成を理由にPhase55を開始しない）。変更は **`index.html` の1ファイルのみ（Phase A本体 +336/-6・Hotfix +11/-0）**。**server.js・lib・DB・schema.sql・API・既存Path A/Path B内部処理・`switchCase()`・`.at-result-card`仕様・chatHistory構造・Output Draft保存仕様 はすべて無変更**。

### 目的
Leaderを「各AI社員の回答を要約する司会者」から「成果物を回収・比較・矛盾候補検出・採否候補判定する統合管理層」へ拡張する。

### 実装ライン（Phase A-1a〜A-1f）
- **A-1a 共通基盤**：`_leaderIntegration`（初期null・クライアント一時メモリのみ）／`_liPathBSessions`／`_liLastPathAResultsCaseId`／`_liCurrentCaseId()`（Decision072方式・`_lastOutputDraft.caseId`フォールバックなし）／`_liSafeRawText`（`LI_RAWTEXT_MAX_LENGTH=2000`で安全切り詰め）／Leader Inbox・artifact・comparison・conflict・decision構造定義。
- **A-1b Path A Adapter**：`_liAdaptPathA()`。**`_atTaskHistory`は`agentId`/`result`フィールドを持たないため採用せず**、直近Auto Task結果を正しく保持する`_wlLastResults`をソースに採用（実装時の実測確認に基づく判断）。
- **A-1c Path B Adapter**：`_liAdaptPathB()`。`interactionId`（`'li-'+genId()`）を`handleLeaderDispatch()`冒頭で1回生成し、`_liPathBSession`（`caseId`/`cardId`/`dispatchTs`/`memberIds`）でchatHistoryを一切変更せずdispatchTs以降・対象memberId限定の対応を取得。Strategy統合・Leader Summaryも同一interactionId単位で収集。
- **A-1d 純関数ロジック**：`_liCompareArtifacts()`／`_liDetectConflictCandidates()`（すべて`label:'candidate'`）／`_liDecideAdoptionCandidates()`（情報不足時は必ず`hold`が既定値・Reviewer未実行を合格扱いにしない）。追加AI実行なし。
- **A-1e 共通オーケストレーション**：`_liCollectIntegration(pathSource, requestText, extra)`。`atRunWorkflow()`のLeader Final受領直後、`atTriggerLeaderFinal()`のOutput Draft生成直後の2箇所へ接続（既存処理は無変更・末尾へ呼び出し追加のみ）。caseId取得不能・不一致時は`_leaderIntegration`を生成せず安全停止。

### 案件混入Hotfix
実装検証中に、既存のOutput Draft復元保護ロジック（Phase54-2d・`_canReplaceDraftWithRestore`）と手動Leader Final再生成（`atTriggerLeaderFinal()`）の組み合わせで、案件切替後も前案件の`_lastOutputDraft`と`.at-result-card`が残り、現在案件のcaseIdで同一output_idをPOSTすると別案件へDraft行が移動する既存不具合を発見。`atTriggerLeaderFinal()`冒頭に`_liCurrentCaseId()`と`_liLastPathAResultsCaseId`の厳格一致ガードを追加し、不一致時は`/api/leader-summary`・chatHistory追加・Output Draft保存・次Task生成のいずれも実行せず、「現在案件でAuto Taskを再実行してください」と通知して安全停止する（案件切替時のDOM一括クリアは不採用）。

### 検証（実測）
Path A（Auto Task）／Path B（Leader手動チャット）とも実機検証で`pathSource`／`workflowId`／`interactionId`／`caseId`の正しい分離を確認。同一案件での手動Leader Final再生成は正常動作。別案件切替後の混入テストでは、Hotfix適用前に実際の混入事故（診断用Output Draft`out_1785449189461`が検証専用案件`case-ms82952wltd5`から既存案件「テスト」へ移動）を確認し、既存POST経路（`/api/output-drafts`）で復旧。Hotfix適用後は同一条件で`/api/leader-summary`・`/api/output-drafts`とも呼び出しなし・chatHistory追加なし・Draft移動なしを実測。JavaScript構文OK・dev-check 200/200/200・git diff --check問題なし。

### 診断データ整理
孤立Output Draft（`output_id: out_1785449189461`・`case_id: case-ms82952wltd5`）をSupabase SQL Editorで限定削除（複合条件・1行のみ）。検証専用案件（`case-ms83tudez570`／`case-ms8409r7thuw`）も削除。「テスト」（`case-ms7n2jqdt6t6`）・「Instagramアカウント設計」等の既存案件・`case_id: null`のLeader横断ログは無変更。

### Git・反映
Code commit **ad5eaf7**（`feat: add leader integration layer`・+336/-6）＋**af43263**（`fix: prevent cross-case leader final draft overwrite`・+11/-0）・docs commit＝本更新／Annotated Tag **v1.01-leader-integration-phase-a**／**main push・Render反映はこれから**（ユーザー承認後）。**PC本番確認・iPhone実機確認はpush・Render反映後にユーザー実施予定**。Decision 084。**Phase54 Complete維持・Phase55未着手**。

### 対象外・未実装
AI社員間の自動差し戻し（Phase A-2）・成果物受け渡しの汎用化（Phase A-3）・Quality Loop（Phase A-4）・成果物添付表示／Progress UI／Knowledge Summary（Phase B）・Output Draftへの永続化・Leader Integration専用DB・新規APIは対象外（今回はPath A/B共通の回収・比較・矛盾候補・採否候補の構造化とHotfixのみ）。

### 次工程
未定（Phase A-2〜A-4は設計のみ完了・実装は未着手。着手にはユーザー承認が必要）。

---

## Affiliate Intelligence Company 工程8-1/8-2/8-3A/8-3B/8-3B補正/8-3C — Market Opportunity Intelligence（①層） **正式リリースComplete**（2026-07-30・Code commit 2de9317/4ef70ca/e61e7d5/3b1e5b7・main push・Render反映・PC本番確認・iPhone実機確認はこれから実施）

> 記録日: 2026-07-30。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（Market Opportunity Intelligence完成を理由にPhase55を開始しない）。変更は **`index.html` の1ファイルのみ（foundation +172/-0・ui +174/-0・persist +32/-0・fix +28/-9）**。**server.js・lib・DB・schema.sql・API・output_drafts定義・`_icpDeriveTopic`・Workflow Wiring・Affiliate Evaluation・ランキング順位・integratedScore・estimatedProfit式・Product/Revenue/ASP/Content/Competition Intelligence はすべて無変更**。

### 工程ライン（工程8-1/8-2 → 8-3A → 8-3B → 8-3B補正 → 8-3C）
- **工程8-1/8-2 データ構造・案件内市場集約・Evidence共有・Confidence**：`INTEL_MARKET_MIN_PRODUCT_COUNT=2`（商材2件未満は強制insufficient・ASP同型）／`_intelBlankMarket`／`_intelBuildMarketFromCases`（案C＝案件内集約・`_aicNormalizeKeyPart`再利用・新規入力なし・外部データなし）／`_intelCalculateMarketConfidence`（既存`_intelCalculateConfidence`再利用）。純関数26 PASS。
- **工程8-3A 表示UI**：`_aicBuildMarketForRow`（使い捨てctxプレビュー）／`_aicCurrentSavedMarket`／`_aicSavedMarketForRow`（保存済み`intelligenceContext.market`をmarketKey＋caseId一致で正本取得・再計算しない＝productIdentifierではなくmarketKey単位である点が他5層と異なる）／`_aicMarketParts`／`_aicBuildMarketCardLine`／`_aicBuildMarketHtml`（AIC最小パネル・Competition直下・Safety表記を画面上に必ず表示・登録候補商材数とCompetition競合数を文言で明確に区別）。UIテスト24 PASS。
- **工程8-3B 永続化・Copy**：採用時に`nextIntelligenceContext.market = _intelBuildMarketFromCases(...)`をCompetition構築の直後へ追加し、`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`＋`competition`＋`market`の**七書き**を既存push1回で保存（採用1回=POST1回・Market専用POSTなし）。`_aicBuildMarketReportText`をCopy Full Reportへ追記（Competition直後・Ranking手前）。保存テスト35 PASS。
- **工程8-3B補正（Evidence母集団整合性）**：derived集計は市場内複数商材対象だがEvidence/Confidence母集団は採用商材1件分のみという不整合を発見。共通ヘルパー`_intelSyncMarketGroupProductEvidence`（表示・保存の両方から共通利用）を新設し、市場内対象商材群のProduct Evidenceを保存前にctxへ同期するよう修正。既存5層Confidenceへの回帰なしを確認。補正テスト30 PASS（累計115アサーション全PASS）。
- **工程8-3C 実Supabase検証**：専用caseId（`case-ms79vojuf7g1`・商材2件）で七書き保存確認・productCount=2・Evidence総数28件中22件が両商材のproductIdentifierにまたがることを確認（母集団整合の実証）・derived集計値（想定利益合計23,840円/平均11,920円・IG適性平均65・他社競合数平均10）が実値と完全一致・F5復元一致・案件切替混入なし・Copy Full Report確認。**テストデータ限定削除 remaining=0**（affiliate_evaluations・output_drafts・cases の3テーブルとも）。

### 検証（実測）
純関数・UI・保存・補正テスト計115アサーション全PASS・JavaScript構文OK（インラインJS抽出チェック）・dev-check 200/200/200・Console error 0・Product/Revenue/ASP/Content/Competition Intelligence/ranking/integratedScore/estimatedProfit いずれも不変。

### Git・反映
Code commit **2de9317**（`feat: add market opportunity foundation and confidence`・+172/-0）＋**4ef70ca**（`feat: add market opportunity intelligence UI`・+174/-0）＋**e61e7d5**（`feat: persist market opportunity intelligence`・+32/-0）＋**3b1e5b7**（`fix: align market confidence with grouped product evidence`・+28/-9）・docs commit＝本更新／Annotated Tag **v1.01-affiliate-market-opportunity-persistence**（作成予定）／**main push・Render反映はこれから**（ユーザー承認後）。**PC本番確認・iPhone実機確認はpush・Render反映後にユーザー実施予定**。Decision 083。**Phase54 Complete維持・Phase55未着手**。保護対象4件は未stage・未commitで保護。

### 対象外・未実装
新しいIntelligence層（⑦Self Improvement）・実検索数/実トレンド/市場規模/市場成長率等の外部データ接続・新規入力項目・市場需要の自動判定は対象外（今回は案件内集約による説明・永続化配線のみ）。

### 次工程
未定（Market Opportunity Intelligence完成によりVersion2 Core 7層のうち6層完成・残るは⑦Self Improvement Intelligenceのみ。Instagram実運用前のため実績データ供給条件を再確認してから着手判断。またはVersion1.1 Realtime Sync残課題等）。

---

## Affiliate Intelligence Company 工程7-1/7-2/7-3A/7-3B/7-3C — Competition Intelligence（④層） **正式リリースComplete**（2026-07-29・Code commit 675b3d0/3feec7b/d941cfd・main push・Render反映・PC本番確認・iPhone実機確認はこれから実施）

> 記録日: 2026-07-29。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（Competition Intelligence完成を理由にPhase55を開始しない）。変更は **`index.html` の1ファイルのみ（foundation +107/-1・ui +117/-0・wire +28/-0）**。**server.js・lib・DB・schema.sql・API・output_drafts定義・`_icpDeriveTopic`・Workflow Wiring・Affiliate Evaluation・ランキング順位・integratedScore・estimatedProfit式・Product/Revenue/ASP/Content Intelligence はすべて無変更**。

### 工程ライン（工程7-1/7-2 → 7-3A → 7-3B → 7-3C）
- **工程7-1/7-2 データ構造・Evidence共有・Confidence**：`INTEL_MODULE_KEYS`へ`'competition'`追加（後方互換）／`INTEL_COMPETITION_INPUT_FIELDS`（competitors/lifespanMonths/igFit）／`_intelBlankCompetition`／`_intelSyncCompetitionFromProduct`（既存Product Evidenceにのみ`usedBy:'competition'`冪等追記・新規Evidence生成なし・Product非破壊）／`_intelCalculateCompetitionConfidence`（既存`_intelCalculateConfidence`再利用・独立3件未満Insufficient・`confidenceOwner:'competition'`で分離）。純関数23 PASS。
- **工程7-3A 表示UI**：`_aicBuildCompetitionForRow`（使い捨てctxプレビュー）／`_aicCurrentSavedCompetition`／`_aicSavedCompetitionForRow`（保存済み`intelligenceContext.competition`をproductIdentifier＋caseId一致で正本取得・再計算しない＝単一商材紐づきのためRevenue/Content方式を採用）／`_aicCompetitionParts`／`_aicBuildCompetitionCardLine`（ランキングカード1行）／`_aicBuildCompetitionHtml`（AIC最小パネル・Content直下・★Confidenceは競合環境の根拠充足度を示すのみで競合の強弱・参入余地・推奨可否は示さない旨を明示）。
- **工程7-3B 永続化・Copy**：採用時に`nextIntelligenceContext.competition = _intelSyncCompetitionFromProduct(...)`をContent構築の直後へ追加し、`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`＋`competition`の**六書き**を既存push1回で保存（採用1回=POST1回・Competition専用POSTなし）。`_aicBuildCompetitionReportText`をCopy Full Reportへ追記（Product→Revenue→ASP→Content→Competition→Ranking）。
- **工程7-3C 実Supabase検証**：専用caseId（`case-ms5zz5g65x1p`）で六書き保存確認・Evidence総数14件不変（product14/revenue9/asp4/content3/competition3・新規生成0）・Competition Confidence Medium（64点・independent3件）・F5復元完全一致・caseId分離・Copy Full Report順序。**テストデータ限定削除 remaining=0**（affiliate_evaluations・output_drafts・cases の3テーブルとも）。

### 検証（実測）
純関数23/23 PASS・JavaScript構文OK（`node --check`相当のインラインJS抽出チェック）・dev-check 200/200/200・Console error 0・白画面/無限ロード/横スクロールなし・Product/Revenue/ASP/Content Intelligence/ranking/integratedScore/estimatedProfit いずれも不変。

### Git・反映
Code commit **675b3d0**（`feat: add competition intelligence foundation`・+107/-1）＋**3feec7b**（`feat: add competition intelligence ui`・+117/-0）＋**d941cfd**（`feat: wire competition intelligence display and persistence`・+28/-0）・docs commit＝本更新／Annotated Tag **v1.01-affiliate-competition-intelligence-persistence**（作成予定）／**main push・Render反映はこれから**（ユーザー承認後）。**PC本番確認・iPhone実機確認はpush・Render反映後にユーザー実施予定**。Decision 082。**Phase54 Complete維持・Phase55未着手**。保護対象4件は未stage・未commitで保護。

### 対象外・未実装
新しいIntelligence層（Market Opportunity/Self Improvement）・競合の強弱/参入余地の自動判定・Competition専用スコア・外部API接続は対象外（今回は表示・永続化配線のみ）。

### 次工程
未定（Competition Intelligence完成により残るIntelligence層＝Market Opportunity/Self Improvement等）。

---

## Affiliate Intelligence Company 工程6-1/6-2/6-3A/6-3B/6-3C — Content Intelligence（⑥層） **正式リリースComplete**（2026-07-29・Code commit 2b3fdd0/f2b0b5e・main push・Render反映・PC本番確認・iPhone実機確認はこれから実施）

> 記録日: 2026-07-29。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（Content Intelligence完成を理由にPhase55を開始しない）。変更は **`index.html` の1ファイルのみ（foundation +113/-0・ui +126/-0）**。**server.js・lib・DB・schema.sql・API・output_drafts定義・`_icpDeriveTopic`・Workflow Wiring・Affiliate Evaluation・ランキング順位・integratedScore・estimatedProfit式・Product/Revenue/ASP Intelligence はすべて無変更**。

### 工程ライン（工程6-1/6-2 → 6-3A → 6-3B → 6-3C）
- **工程6-1/6-2 データ構造・Evidence共有・Confidence**：`INTEL_CONTENT_INPUT_FIELDS`（saveRatePred/clickRatePred/igFit）／`_intelBlankContent`／`_intelSyncContentFromProduct`（既存Product Evidenceにのみ`usedBy:'content'`冪等追記・新規Evidence生成なし・Product非破壊）／`_intelCalculateContentConfidence`（既存`_intelCalculateConfidence`再利用・独立3件未満Insufficient・`confidenceOwner:'content'`で分離）。
- **工程6-3A 表示UI**：`_aicBuildContentForRow`（使い捨てctxプレビュー）／`_aicCurrentSavedContent`／`_aicSavedContentForRow`（保存済み`intelligenceContext.content`をproductIdentifier＋caseId一致で正本取得・再計算しない＝単一商材紐づきのためRevenue方式を採用）／`_aicContentParts`／`_aicBuildContentCardLine`（ランキングカード1行）／`_aicBuildContentHtml`（AIC最小パネル・ASP直下・保存率予測/クリック率予測は予測値であることを明示）。
- **工程6-3B 永続化・Copy**：採用時に`nextIntelligenceContext.content = _intelSyncContentFromProduct(...)`をASP構築の直後へ追加し、`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`の**五書き**を既存push1回で保存（採用1回=POST1回・Content専用POSTなし）。`_aicBuildContentReportText`をCopy Full Reportへ追記（新規Copyボタンなし）。
- **工程6-3C 実Supabase検証**：専用caseId（`case-ms3t75suuo2i`）で採用後`fields.intelligenceContext`に`product`/`revenue`/`asp`/`content`が揃うことを確認・Evidence総数14件不変（product14/revenue9/asp4/content3・重複なし）・Content Confidence Medium（64点・independent3件・knownFactors3/3）確認。**テストデータ限定削除 remaining=0**（affiliate_evaluations・output_drafts とも・ユーザーがSupabase SQL Editorで`case_id`限定DELETE実施）。

### 検証（実測）
回帰テスト118/118 PASS・JavaScript構文OK（`node --check`）・dev-check 200/200/200・Console error 0・白画面/無限ロード/横スクロールなし・Product Intelligence/Revenue Intelligence/ASP Intelligence/ranking/integratedScore/estimatedProfit いずれも不変。

### Git・反映
Code commit **2b3fdd0**（`feat: add content intelligence foundation`・+113/-0）＋**f2b0b5e**（`feat: add content intelligence ui`・+126/-0）・docs commit＝本更新／Annotated Tag **v1.01-affiliate-content-intelligence-persistence**（作成予定）／**main push・Render反映はこれから**（ユーザー承認後）。**PC本番確認・iPhone実機確認はpush・Render反映後にユーザー実施予定**。Decision 081。**Phase54 Complete維持・Phase55未着手**。保護対象4件は未stage・未commitで保護。

### 対象外・未実装
新しいIntelligence層（Competition/Market/Self Improvement）・実測値（actualSaveRate等）接続・AI自動選定は対象外（今回は表示・永続化配線のみ）。

### 次工程
未定（Content Intelligence完成により残るIntelligence層＝Competition/Market/Self Improvement等）。

---

## Affiliate Intelligence Company 工程5-3（5-3A/5-3B/5-3C） — ASP Intelligence 表示UI・永続化 **正式リリースComplete**（2026-07-28・Code commit b473053・main push・Render反映・PC本番確認・iPhone実機確認 完了（2026-07-28・ユーザー実施・崩れなし・横スクロールなし・白画面/無限ロードなし））

> 記録日: 2026-07-28。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（ASP Intelligence完成を理由にPhase55を開始しない）。変更は **`index.html` の1ファイルのみ（+146/-0）**。**server.js・lib・DB・schema.sql・API・output_drafts定義・`_icpDeriveTopic`・Workflow Wiring・Affiliate Evaluation・ランキング順位・integratedScore・estimatedProfit式・Product Intelligence・Revenue Intelligence はすべて無変更**。

### 工程ライン（工程5-3A → 5-3B → 5-3C）
- **工程5-3A 表示UI**：`_aicBuildAspForRow`（使い捨てctxプレビュー・`_affiliateCases`空/非配列でも例外なし）／`_aicCurrentSavedAsp`／`_aicSavedAspForRow`（保存済み`intelligenceContext.asp`を正本取得・再計算しない）／`_aicAspParts`／`_aicBuildAspCardLine`（ランキングカード1行）／`_aicBuildAspHtml`（AIC最小パネル・Revenue直下）。
- **工程5-3B 永続化・Copy**：採用時に`nextIntelligenceContext.asp = _intelBuildAspFromProduct(...)`をRevenue構築の直後へ追加し、`affiliateContext`＋`product`＋`revenue`＋`asp`の**四書き**を既存push1回で保存（採用1回=POST1回・ASP専用POSTなし）。`_aicBuildAspReportText`をCopy Full Reportへ追記（新規Copyボタンなし）。
- **工程5-3C 実Supabase検証**：専用caseId（`case-ms3t75suuo2i`）でOutput Draft POST 2回（scaffold作成1＋採用四書き1）・Evidence総数12件不変（product12/revenue9/asp4・重複なし）・F5復元で推奨/Confidence/比較数/Independent/`updatedAt`完全一致（再計算なし実証）・caseId分離確認・Copy Full Report確認・Product/Revenue/ranking回帰なし。**テストデータ限定削除 remaining=0**（affiliate_evaluations・output_drafts とも・ユーザーがSupabase SQL Editorで`case_id`限定DELETE実施）。

### 検証（実測）
純関数 工程5-3A/5-3B新規27＋工程5-1/5-2再実行44＝**71/71 PASS**・JavaScript構文OK・dev-check 200/200/200・Console error 0・実ブラウザ確認でSupabase書込みは意図した2回のみ（他GET）・AI API実行0・Product Intelligence/Revenue Intelligence/ranking/integratedScore/estimatedProfit いずれも不変。

### Git・反映
Code commit **b473053**（`feat: wire ASP intelligence display and persistence`・index.htmlのみ +146/-0）・docs commit＝本更新／Annotated Tag **v1.01-affiliate-asp-intelligence-persistence**／**main push・Render反映**。**PC本番確認・iPhone実機確認 完了（2026-07-28・ユーザー実施：PC＝ログイン/ホーム/Output Engine/Affiliate Intelligence Core/Revenue Intelligence（空状態）/ASP Intelligence/おすすめ順位ランキング/Copy Full Report すべて正常・白画面/無限ロード/崩れなし。iPhone＝同項目に加え案件入力フォーム正常・Copy Full Report「コピーしました」表示確認・横スクロール/画面停止なし。保存済み案件なしのためProduct Intelligence保存済み表示/💾表示は確認対象外）＝工程5-3 正式リリースComplete**。Decision 080。**Phase54 Complete維持・Phase55未着手**。保護対象4件は未stage・未commitで保護。

### 対象外・未実装
新しいIntelligence層（Competition/Content/Market/Self Improvement）・ASP外部API接続・AI自動選定は対象外（今回は表示・永続化配線のみ）。

### 次工程
未定（ASP Intelligence 7層構想の残り、またはVersion1.1 Realtime Sync残課題等）。

---

## Affiliate Intelligence Company 工程5-1・5-2 — ASP Intelligence（③層）**正式リリースComplete**（2026-07-28・Code commit 17587296c9413f53dcc05e4c72897ac4e8d0643a・main push・Render反映・iPhone実機確認 完了（2026-07-28・ユーザー実施・崩れなし・横スクロールなし・白画面なし・無限ロードなし・画面停止なし））

> 記録日: 2026-07-28。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（ASP Intelligence完成を理由にPhase55を開始しない）。変更は **`index.html` の1ファイルのみ（+212/-0）**。**server.js・lib・DB・schema.sql・API・output_drafts定義・`_icpDeriveTopic`・Workflow Wiring・Affiliate Evaluation・ランキング順位・integratedScore・estimatedProfit式・`_intelCalculateConfidence`本体・Product Intelligence・Revenue Intelligence はすべて無変更**。

### 工程ライン（工程5-1 → 工程5-2）
- **工程5-1 ASP Intelligence Data Structure**：`intelligenceContext.asp`（既存受け皿を使用）／`_intelAspGroupKey`（正規化商品名×market・ASP名は含めない）／`_intelBlankAsp`／`_intelBuildAspCandidate`（Active評価のみ候補化・読み取り専用・新規Evidence生成なし）／`_intelDetermineAspRecommendation`（既存`estimatedProfit`最大＋決定的タイブレーク）／`_intelBuildAspFromProduct`（採用商品のEvidenceにのみ`usedBy:'asp'`冪等追記）。純関数18 PASS。
- **工程5-2 ASP Confidence**：`_intelCalculateAspConfidence`＝**`usedBy:'asp'`のEvidenceのみ**を母集団に既存`_intelCalculateConfidence`を再利用（新式なし）／独立3件未満Insufficient／**比較ASP数2件未満・有効estimatedProfit候補2件未満は強制insufficient**（Confidence連動と併用）／`confidenceOwner:'asp'`でProduct/Revenueと分離。追加テスト26 PASS（工程5-1既存18 PASSも再実行し回帰なし・合計44/44）。

### 検証（実測）
純関数44/44 PASS・JavaScript構文OK・dev-check 200/200/200・Console error 0・**Supabase書込み0（GETのみ）・AI API実行0**（実ブラウザ確認）・Product Intelligence/Revenue Intelligence/Affiliate Evaluation/Workflow Wiring/ランキング順位/integratedScore/estimatedProfit いずれも不変。

### Git・反映
Code commit **17587296c9413f53dcc05e4c72897ac4e8d0643a**（`feat: add ASP intelligence confidence`・index.htmlのみ +212/-0）／docs commit＝本更新／Annotated Tag **v1.01-affiliate-asp-intelligence**／**main push・Render反映**。**iPhone実機確認 完了（2026-07-28・ユーザー実施：ログイン/ホーム/案件一覧・切替/Task/Auto Task/Leader/Output Engine/Affiliate Intelligence Core/Revenue Intelligence すべて正常・レイアウト崩れ/横スクロール/白画面/無限ロード/画面停止 いずれもなし）＝工程5-1・5-2 正式リリースComplete**。保護対象4件は未stage・未commitで保護（Decision 079）。

### 対象外・未実装（工程5-3以降）
ASP Confidence表示UI・Output Draft永続化・F5復元・端末同期は**未実装**。今回はデータ構造・計算ロジックのみ。

### 次工程
**ASP Intelligence 工程5-3**（表示UI接続・Output Draft永続化・F5復元・端末同期・仕様未確定）。**Phase55未着手のまま維持**。

---

## Affiliate Intelligence Company 工程4 — Revenue Intelligence（⑤層）**正式リリースComplete（4-1〜4-4）**（2026-07-27・Code commit 8cde936・main push・Render反映・実Supabase検証/remaining=0・iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・横スクロールなし・空状態正常））

> 記録日: 2026-07-27。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（Revenue完成を理由にPhase55を開始しない）。変更は **`index.html` の1ファイルのみ（+230/-1）**。**server.js・lib・DB・schema.sql・API・output_drafts定義・`_icpDeriveTopic`・Workflow Wiring・ランキング順位・integratedScore・estimatedProfit式・`_intelCalculateConfidence`本体・Product Intelligence はすべて無変更**。

### 工程4ライン（4-0設計 → 4-1 → 4-2 → 4-3 → 4-4）
- **工程4-0 設計確定**：Revenue責務・境界・`intelligenceContext.revenue`採用・Evidence再利用・Confidence分離・表示方針・永続化方針を確定（Decision 078）。
- **工程4-1 スキーマ＋Evidence配線**：`INTEL_MODULE_KEYS` に `'revenue'` 追加（後方互換）／`INTEL_REVENUE_INPUT_FIELDS`（7）・`INTEL_REVENUE_DERIVED_FIELDS`（2）／`_intelBlankRevenue`／`_intelSyncRevenueFromProduct`（Product Evidenceを `usedBy:'revenue'` で**共有参照**・新規Evidence生成なし・件数不変・Product非破壊）。純関数31 PASS。
- **工程4-2 Revenue Confidence**：`_intelCalculateRevenueConfidence`＝**財務入力Evidenceのみ**を母集団に既存 `_intelCalculateConfidence` を再利用（派生は二重計上しない）／独立3件未満Insufficient／status＝`Insufficient→insufficient`・それ以外は `_aicStatusFromScore(score)`（既存ヘルパ）／Product Confidenceと分離。純関数31 PASS。
- **工程4-3 表示**：AIC最小パネル（rank1/採用商材）＋各カードRevenueライン（`_aicBuildRevenueHtml`/`_aicBuildRevenueCardLine`/`_aicBuildRevenueForRow`）。**使い捨てContextの非永続プレビュー**（実context非変更・POST0）・円/月・null情報なし・0有効・**順位不変**・HTMLエスケープ・375px横はみ出しなし。表示12ケース PASS。
- **工程4-4 両書き永続化・復元**：採用処理で `nextIntelligenceContext.revenue = _intelSyncRevenueFromProduct(...)` を追加し、`affiliateContext`＋`product`＋`revenue` を同一Draftへ**既存 push 1回**で保存。`_aicCurrentSavedRevenue`/`_aicSavedRevenueForRow` で**保存済みRevenue優先表示（💾）**・旧Draftは非永続プレビューへfallback。永続化15ケース PASS。

### 実Supabase検証（専用caseId `intel-4-4-verify-20260727`）
両書き保存（**採用1回=POST1回**・source:db）／Product・Revenue識別子一致（evaluationId/productIdentifier/caseId）／Revenue（inputs7・derived2・Known7/7・status watch・Confidence Medium64・owner revenue・used9）／**Evidence総数10＝Product分のみ（Revenue専用生成なし・件数不変・usedBy重複なし）**／**F5復元でConfidence保存値維持（再計算なし）**・**保存済み優先表示💾**・**表示/復元POST0**／**テストデータ限定削除 remaining=0（GET draft=null・既存データ無影響）**。

### Git・反映
Code commit **8cde936**（`feat: add revenue intelligence confidence display and persistence`・index.htmlのみ +230/-1）／docs commit＝本更新／Annotated Tag **v1.01-affiliate-revenue-intelligence**／**main push・Render反映**。**iPhone実機確認はユーザー実施（待ち）**。保護対象4件は未stage・未commitで保護（Decision 078）。

### 次工程
**ASP Intelligence（③層）開始前調査・設計**（未着手）。実装順は Product→**Revenue（完了）**→ASP→Competition→Content→Market→Self Improvement。**Phase55未着手のまま維持**。

---

## Affiliate Intelligence Company 工程3 — Product Intelligence 正式化（3-1/3-2/3-3）**工程3-3 正式リリース完全確定**（2026-07-27・Code commit 3ef7495・main push・Render反映・実Supabase検証/remaining=0・iPhone実機確認完了）

> 記録日: 2026-07-27。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（本工程でPhase55を開始しない）。変更は **`index.html` の1ファイルのみ**。**server.js・lib・DB・Migration・supabase/schema.sql・API・`_icpDeriveTopic()`・Workflow Wiring・Content Planning本体・ランキング順位・Confidence計算式・工程3-2表示関数 はすべて無変更**。

### 工程3ライン（3-1 → 3-2 → 3-3）
- **工程3-1 Productスキーマ・Evidence配線**（Code commit **28fa51c**・index.html **+159/-0**）：`intelligenceContext.product`（リッチ正本）・`products[]`（将来用・初期空）・Product Evidence（入力/派生・冪等 `_intelProductEvidenceRef`＋`_intelFindEvidenceByRef`）・calculated Evidence（独立件数に含めない）・`product.confidence`（工程2 `_intelCalculateConfidence` 再利用）・`productStatus`/`confidenceOwner`/`learningSummary` を **生成helper `_intelSyncProductFromAffiliate` として実装**（本工程では自動実行しない）。後方互換（旧Draft安全）。
- **工程3-2 ランキングConfidence表示**（Code commit **1d04f31**・index.html **+49/-0**）：ランキングカードへ **表示時Confidenceプレビュー**（`_aicBuildProductConfidence`／`_aicBuildConfidenceHtml`）。工程3-1の `product.confidence` を**使い捨て blank context 上で非永続に再算出**し Level/Score/Independent/Evidence総数/Insufficient/Known を表示。**順位（integratedScore→estimatedProfit）は不変**・実contextへ書かない・副作用なし。純関数14/14。
- **工程3-3 採用時の両書き・保存・F5復元**（Code commit **3ef7495**・index.html **+58/-10**・**正式Complete**）：`adoptAffiliateForContentPlanning()` を両書き化。

### 工程3-3 実装（両書き・原子性・POST exactly once）
採用時、**一時変数**で `nextAffiliateContext`（既存軽量サブセット・フィールド名不変）と `nextIntelligenceContext`（実contextを `_intelGetContext`→`JSON.parse(JSON.stringify())` で deep copy→`_intelSyncProductFromAffiliate` で product生成→rank/evaluationId/productIdentifier/caseId/updatedAt 補完→`ctx.product` へ明示代入）を構築。**必須項目（productIdentifier/evaluationId）と caseId 6項目一致**（currentCase/draft.caseId/src.caseId/affiliate.caseId/intel.caseId/product.caseId＋`_intelContextCaseMatches`）を確認し、**全成功時のみ**実Draftへ `affiliateContext`＋`intelligenceContext` を**一括反映**（片方だけ書かない）。保存は**既存 `pushOutputDraftToServer` を1回**（`_intelSaveContext` 不使用＝POST二重化しない）。生成失敗/必須欠落/caseId不一致は**反映も保存もせず**エラー表示＋`console.warn`。`products[]` は後方互換で維持し新規履歴追加なし。`channelScope` は affiliate='all'/product='instagram' の二値併存（設計どおり非統一）。

### 検証（実測）
- 構文OK（インラインJS2ブロック）・**隔離テスト A〜F 全合格**（正常両書き/既存field保持/同一商品Evidence非増殖/別商品置換・旧保持/caseId不一致でpush0/Product失敗でpush0/採用1回=push1）・**dev-check 200/200/200**・**Console Error 0**・回帰なし（工程3-2表示関数・収益導線 不変）。
- **実Supabase検証（localhost・source:db・専用caseId `intel-3-3-verify-20260727`／outputId `out-intel-3-3-verify-20260727`）**：両書き保存成功（採用1回=**POST 1回**）／**F5復元成功**（`restoreOutputDraftFromServer` 実GET＋復元変換で affiliateContext＋product＋`productStatus/confidenceOwner/learningSummary/fieldEvidence(11)/usedEvidenceIds(14)/calculated Evidence(6)/evaluationId/productIdentifier/confidence(Medium 61)/evidence履歴(28)` 維持）／**同一商品再採用 Evidence 14→14（増殖なし）**／**別商品採用 product置換・Evidence 14→28（旧履歴保持）・新usedは旧非参照(0)**。
- **テストデータ限定削除 完了（remaining=0）**：ユーザーが Supabase SQL Editor で `DELETE FROM public.output_drafts WHERE case_id = 'intel-3-3-verify-20260727';` を実行し `SELECT COUNT(*) = 0`。API読戻し（byCase/byOutput とも **draft=null**）で一致確認。**条件なしDELETE不使用・他案件無影響**。

### Git・反映
Code commit **28fa51c / 1d04f31 / 3ef7495**（index.htmlのみ）／docs commit＝本更新／Annotated Tag **v1.01-affiliate-product-intelligence-persistence**／**main push・Render反映**。**iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・空状態正常）**（本番URLで採用/保存/復元/既存Workflow回帰なしを確認）。保護対象4件（`cost-logs.json`・`claude-cost-logs.json`・`claude-quality-history.json`・`backup-dup-candidates-20260714/`）は未stage・未commitで保護（Decision 077）。

### 次工程
未定（候補：ランキング表示で採用済み商品の保存済みConfidence優先＝案A／Product Intelligence本体・他Intelligence層）。**Phase55未着手のまま維持**。

---

## Affiliate Intelligence Company 工程2 — Evidence / Confidence 共通基盤 **正式Complete**（2026-07-26・Code commit 29d82c1・main push・Render反映済み・iPhone実機確認完了）

> 記録日: 2026-07-26。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（本工程でPhase55を開始しない）。**`index.html` の1ファイルのみ（+372/-0・純追加）**。**server.js・lib・DB・Migration・supabase/schema.sql・API・新DB列・新API はすべて無変更**。設計工程1で確定した Affiliate Intelligence Company の共通基盤（横断層A）のみを実装（B〜D層本体は対象外）。

### 実装内容（index.htmlのみ +372/-0）
- **`fields.intelligenceContext`**（JSONB）：version/generatedAt/updatedAt/caseId/channelScope('instagram')／12モジュール受け皿(market〜learning)／evidence[]／confidence{overall,byModule}。helper: `_intelBlankContext`／`_intelNormalizeContext`（古Draft安全補完）／`_intelGetContext`（副作用なし）／`_intelAttachContext`（非破壊）／`_intelSaveContext`（**caseId一致時のみ**既存 `pushOutputDraftToServer`・**自動保存なし**）。
- **Evidence共通型**：7種（public_fact/manual_observation/user_input/calculated/heuristic/learning_result/ai_interpretation）／**`ev-<UUID>`**（crypto.randomUUID優先・fallbackあり）／reliability(high/medium/low/**unknown**・未指定はunknown＝medium化しない)／`derivedFromEvidenceIds`／`usedBy`。helper: create/normalize/validate(型・caseId一致・日付・ID重複・自己参照・循環・PII警告)／add(上限200は**警告のみ・自動削除なし**)／find/listForModule/markUsedBy/isIndependent/**countIndependent(同一source+対象+日は畳む＝派生を二重計上しない)**。
- **Confidence共通型**：confidenceScore/Level(High/Medium/Low/Insufficient)/knownFactors/unknownFactors/evidenceCount/**independentEvidenceCount**/evidenceCoverage/dataFreshness/learningSampleCount/heuristicDependency/confidenceReason/calculatedAt。しきい値定数(75/55/35)／**独立Evidence3件未満は点数不問で Insufficient**／推定依存で最大30%減点。**Decision 032統合**（未入力は中立値・knownFactors併記・予測明示・過信させない）。
- **AICパネル最小表示**（Leader統合判断の直下・読み取り専用）：Intelligence Context / Evidence件数 / Independent件数 / Overall Confidence / Known Factors。**空データは必ず Insufficient**（高評価を誤表示しない）。

### 既存維持（非変更）
`affiliateContext`／`_icpDeriveTopic()`／`adoptAffiliateForContentPlanning()`／Workflow Wiring／Content Planning入力経路／server.js／lib／DB／schema.sql／API はすべて**無変更**。`intelligenceContext.product` は**空の受け皿**（自動ミラー・正本切替なし）。**採用商材の現在正本は引き続き `affiliateContext`**。

### 検証（実測）
- インラインJS 2ブロック構文OK／**純粋関数テスト 18/18 PASS**／**dev-check 200/200/200**／localhost console error 0。
- **AICパネル実描画OK**（PC・375pxモバイルとも横はみ出しなし・Evidence0件時 Insufficient・既存表示非回帰）。
- **実Supabase保存成功**（専用テストcaseId `intel-foundation-test-20260726`・POST **1回のみ**・無限ループなし）／**F5復元成功**（GET source:db・Evidence1件・ID/type/caseId/usedBy一致・reliability=unknown維持・confidence構造健在）／**affiliateContext併存維持**／他fields維持。
- **テストデータ削除済み**（ユーザーが Supabase SQL Editor で限定DELETE実行・GET `draft:null`・**remaining=0**・テストマーカー残存なし）。

### Git・反映
- **Code commit 29d82c1**（`feat: add affiliate intelligence evidence confidence foundation`・index.htmlのみ +372/-0）。docs commit＝本更新。Annotated Tag **v1.01-affiliate-intelligence-evidence-confidence**。**main push・Render自動デプロイ**。保護対象4件（cost-logs.json・claude-cost-logs.json・claude-quality-history.json・backup-dup-candidates-20260714/）は未stage・未commitで保護。

### iPhone実機確認 完了（2026-07-26・ユーザー実施）
本番URLで「業務」→「Output Engine」を開き、Affiliate Intelligence Core内に **Intelligence Context v1 / instagram・Evidence 0件・Independent Evidence 0件・Overall Confidence Insufficient（0点）・Known Factors 0** を **Leader統合判断の直下**に表示。**文字切れ・重なり・横幅崩れなし**・**Affiliate Intelligence Core全体も正常表示**。→ **工程2 正式Complete**。

### 未確認事項（残・隠さず記録）
- **Confidence重みは初期ヒューリスティック**（業務精度未確定・将来Learningで調整）。
- **後続 Product Intelligence との実接続は未実施**（工程3）。

### 次工程
**Affiliate Intelligence Company 工程3 — Product Intelligence 正式化**（未着手）。**Phase55未着手のまま維持**（Decision 076）。

---

## Instagram自動運営 Workflow Wiring 本体（Affiliate選定→Instagram投稿企画）**完了・本番反映済み**（2026-07-24・commit 745dd1e・main push済み・Render反映済み・iPhone実機確認完了）

> 記録日: 2026-07-24。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（本工程でPhase55を開始しない）。**`index.html` の1ファイルのみ（+89/-0・純追加）**。**AI実行・新API・`server.js`・`lib`・DB・Migration・`supabase/schema.sql`・API shape はすべて無変更**。Affiliate Evaluation 工程1 完了（クローズ）後の次工程「Instagram自動運営（Workflow Wiring）」の本体。

### 実装内容

工程1完了で整った**商材選定→投稿企画への接続基盤**を、実際のInstagram投稿企画（Content Planning）へ流す配線。ユーザーがAffiliateランキングから採用した商材を、既存Instagram Output Draft へ非破壊で反映する。

- **`adoptAffiliateForContentPlanning(evalId)` 追加**：採用商材1件を選ぶと、既存Instagram Output Draft の **`fields.affiliateContext` へ非破壊スナップショット** → **`createInstagramContentPlanningDraft(draft)` を再生成**して topic導出へ反映 → **既存の正式保存 `pushOutputDraftToServer(draft)`** で `fields`(JSONB) として永続化。
- **`_icpDeriveTopic()` 改修**：`fields.affiliateContext` があり、**かつ現在Draftと `caseId` が一致する場合のみ**最優先で topic に使用（`市場の商品「商品名」` 形式・既存の40字長さ抑制方針に準拠）。**caseId不一致・未設定は使わず既存導出へ安全フォールバック**（別案件混入防止）。**非Affiliate Draftの挙動は不変**。
- **ランキングUIに「この商材で投稿企画を作る」ボタン追加**：**保存済みActive評価のみ有効**（`persistenceState==='saved'` かつ `serverId`）。未保存・`save_failed` は `disabled`＋理由 `title`。**rank1 は「（推奨）」で強調**。採用結果は成功/失敗メッセージ（`_aicAdoptMsg`）をカード内に表示。

### 安全設計（Manual Only維持・課金なし）

- **採用元は `_affiliateCases` の実レコード**（rank由来ではなく内部フィールドを持つ正本）。
- **保存済みActive評価のみ採用可**（未保存・`save_failed` は不可）。
- **AICの案件判定は `_aicCurrentCaseId()`**（Decision 072を継承）。**現在案件が取得でき、採用評価が現在案件に属し、反映先Draftの `caseId` も一致する三条件**を満たす時のみ反映。**別案件フォールバックしない**。
- **反映先は現在案件に属する既存 Instagram系 Output Draft（`INSTAGRAM_CAROUSEL`/`INSTAGRAM_POST`）が存在する場合のみ再利用**。**新規Draftは生成しない**（通常のDraft生成は Workflow＝AI実行と結合し課金が発生するため、AI実行禁止の本工程では独自生成しない）。存在しなければ「先にInstagram成果物を生成してください」と案内表示のみ。
- **スナップショット `affiliateContext`** ＝ `productName`／`market`／`caseId`／`evaluationId`(serverId)／`productIdentifier`／`channelScope`／`adoptedAt`（＋任意で `aspName`／`rank`／`integratedScore`／`estimatedProfit`）。**存在しない任意項目は生成しない**。
- **`fields.affiliateContext` へ非破壊付加**（他fieldは保持）。**別商材採用時は置換・同一商材は冪等**。
- `pushOutputDraftToServer` は fire-and-forget（失敗握り潰しでUI維持）。

### 無変更（保護）

`getCurrentApprovalCaseId()`／`createInstagramContentPlanningDraft()`／`pushOutputDraftToServer()`／`buildAffiliateIntelligenceRanking()` の本体・`server.js`・`lib`・DB・`supabase/schema.sql`・API shape はすべて**無変更**。新API・新DB列なし（`affiliateContext` は既存 `output_drafts.fields`(JSONB) として既存保存経路で永続化）。

### Git・反映

- **commit 745dd1e**（`feat: wire affiliate selection to instagram planning`・`index.html` のみ +89/-0）。
- **main push済み（HEAD = origin/main = 745dd1e）**・**Render反映済み**・**iPhone実機確認完了**（ユーザー実施）。
- docs更新（本更新）→ docs commit → Annotated Tag **`v1.01-instagram-planning-wiring`** → tag push。
- 保護対象4件（`cost-logs.json`・`claude-cost-logs.json`・`claude-quality-history.json`・`backup-dup-candidates-20260714/`）は**未stage・未commitで保護**。`git add .` / `git add -A` は不使用。

### テストデータ削除 **完了**（remaining = 0）

検証で使用した専用テストcaseId **2件のみ**を対象に、Supabase SQL Editor で**限定DELETE**を実行し **`remaining = 0`** を確認済み（**`affiliate_evaluations` / `output_drafts` とも remaining = 0**）。**条件なしDELETE不使用・既存案件/既存データ無影響**。

- `case-mrxmpfx78ua2`（案件名 `WW_IPHONE_TEST_20260723`）
- `WW_TEST_20260723`

```sql
DELETE FROM public.affiliate_evaluations WHERE case_id IN ('case-mrxmpfx78ua2','WW_TEST_20260723');
DELETE FROM public.output_drafts        WHERE case_id IN ('case-mrxmpfx78ua2','WW_TEST_20260723');
-- 削除後: affiliate_evaluations_remaining = 0 / output_drafts_remaining = 0 を確認済み
```

### 次工程

Instagramアカウント準備（A8.net等ASP登録）→ AI会社による市場調査/競合分析/商品選定/投稿企画/カルーセル/キャプション/ハッシュタグ生成 → ユーザー確認 → Instagram手動投稿（運用開始）。**Manual Only維持**。**Phase55は未着手のまま維持**。

---

## Affiliate Evaluation 工程1 完了（クローズ）— 工程1-D 保留課題の正式決定（2026-07-23）

> 記録日: 2026-07-23。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（工程1のクローズはPhaseの進行ではない）。**実装なし・docs更新のみ**（index.html・server.js・lib・DB・schema.sql・API すべて無変更）。

### 工程1-D の結論

工程1-D（開始前調査）で Decision 073 保留の **P2〜P6 を個別評価**し、**現時点で実装不要・保留継続を正式決定**（Decision 074）。Affiliate Evaluation の実運用特性（**手動入力のみ・小規模・低頻度・本番0件**）を土台に、いずれも「実害が無いか緩和済み／Instagram自動運営の開始を妨げない／後回し可能」と判定した。

- **P2** inactive化API：実害なし・IG開始前不要 → 保留（実運用で取り消しニーズが出た時に再評価）
- **P3** RPCトランザクション化：`activeMayBeZero` で緩和済・影響最大（DBへRPCデプロイ＝前例なし） → 保留（安易に採用しない）
- **P4** save_failed 永続化：軽微・再送で復旧・Known Limitation → 保留
- **P5** channelScope 拡張：実害なし・IGは単一運用・DB側は対応済 → 保留（マルチチャネル展開時に再評価）
- **P6** GET件数上限：実害なし・手動小規模 → 保留（P2実装時などに“ついで”で）

### Affiliate Evaluation 工程1 完了内容（工程1-A〜1-D）

- **工程1-A**：永続化API（`affiliate_evaluations` テーブル・`lib/affiliateEvalDb.js`・GET/POST・冪等・fallback契約・履歴保持）
- **工程1-B**：Active一意性を商材単位へ（`uq_affiliate_eval_active_product`・Migration済）／Workflow Wiring（案件境界D-1・退避バッファ・冪等統合・channelScope安全補強）／Active Case Hotfix（`_aicCurrentCaseId()`・案件未確定時の保存防止）
- **工程1-C**：実DB定義を正本として `supabase/schema.sql` へ記録（案A・drift なし）
- **工程1-D**：P2〜P6 の保留を正式決定し工程1をクローズ

**商材選定→投稿企画への接続に必要な基盤は完成**。永続化・案件別分離・冪等・再評価・誤保存防止・定義記録がすべて揃った。

### 次工程

**Instagram自動運営（Workflow Wiring）** — Affiliate評価の上位ランキングを Instagram Content Planning へ渡す接続。Version1の最優先目的「Instagram収益化支援」に直結。ロードマップ：工程1完了 → Instagram自動運営（Workflow Wiring）→ Instagramアカウント準備（A8.net等ASP登録）→ AI会社による市場調査/競合分析/商品選定/投稿企画/カルーセル/キャプション/ハッシュタグ生成 → ユーザー確認 → Instagram手動投稿（運用開始）。**Manual Only 維持**（自動投稿・課金なし）。

### Git

docs更新のみ（Decision 074＋現在位置整理）。**Phase54 Complete維持・Phase55未着手**。

---

## Affiliate Evaluation 工程1-C（案A）— 実DB定義を schema.sql へ記録（2026-07-23・commit adf1c0a / cd81488）

> 記録日: 2026-07-23。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（本工程はPhase55開始ではない）。**`supabase/schema.sql` の1ファイルのみ純追記（+76/-0）**。`server.js`・`lib/affiliateEvalDb.js`・`index.html`・API shape・**実DB**は無変更。

### 目的・位置付け

`affiliate_evaluations` は工程1-A時にダッシュボードでDBへ直接作成されたため、**テーブル定義自体が `supabase/schema.sql` に未記録**（drift・再構築不能）だった。工程1-C（案A）は**新機能追加ではなく、既存実DB定義の正式記録工程**であり、Instagram自動運営ラインの**保守性・再構築性の改善**を目的とする。**Phase54 Complete維持・Phase55未着手**（工程1-CはPhase55の開始ではない）。

### 実施内容（読み取りのみ→記録）

- **実DB定義を読み取り専用SELECTで実測**（Supabase SQL Editor）：列定義・PK・UNIQUE・通常Index・Partial UNIQUE Index・CHECK・RLS状態・Policy全文・Trigger・外部キー。
- **確定した実測結果**：**30列**／`id` は `bigint GENERATED ALWAYS AS IDENTITY`／`case_id`・`source_fingerprint` は `NOT NULL`／`evaluation_version='v1'`・`channel_scope='all'`・`source='manual'`・`is_active=true`・`created_at/updated_at=now()` の各DEFAULT／数値型（`profit_rate/approval_rate/cvr/ig_fit=numeric(6,2)`・`epc=numeric(12,4)`・`competitors/lifespan_months/integrated_score=integer`・`estimated_sales/estimated_profit=numeric(14,2)`）／`detail=JSONB`／**Trigger なし・外部キー なし**。
- **実測を正本として `supabase/schema.sql` へ純追記**（実測と全項目一致＝drift なし）。

### schema.sql 記録内容

`CREATE TABLE IF NOT EXISTS public.affiliate_evaluations`（30列）／`affiliate_evaluations_pkey`／`affiliate_evaluations_fingerprint_key`（source_fingerprint グローバルUNIQUE）／`affiliate_evaluations_reco_chk`（recommendation は NULL 可＋adopt/watch/reject）／`idx_affiliate_eval_case`／`uq_affiliate_eval_active_product`（`(case_id, channel_scope, COALESCE(product_identifier,''))` WHERE `is_active`）／`ENABLE ROW LEVEL SECURITY`／`affiliate_evaluations_all` Policy（`FOR ALL TO anon USING(true) WITH CHECK(true)`・冪等DO block）。既存 Cost DB 節と同一スタイル・**IF NOT EXISTS / 冪等DO block で再実行安全**。冒頭コメントに**「実DB定義の記録用でありMigrationではない・実DBを自動変更しない」**旨を明記。

### 完了条件（本工程は dev-check を必須としない）

`node --check` は対象外（schema.sqlのみ）。server.js・lib・index.html・APIを変更しない工程のため **dev-check は必須完了条件としない**。中核の検証は**schema.sql の記録内容と実DB実測値の一致**（達成済み・全項目 drift なし）。

### 残課題（工程1-D以降の候補・保留）

- **P2**：保存済み評価の**inactive化API（PATCH/DELETE）未実装**。現在はUI除外抑止＋必要時のSQL Editor手動対応。実運用で必要性が出た時点で再評価。
- **P3**：保存処理が**非トランザクション**（旧active無効化→新insert）。`activeMayBeZero:true` 通知あり。RPC化は未着手・現時点で優先度を上げない。
- **P4**：`save_failed` 行がF5で消失（メモリ保持のみ・**Known Limitation**・保証対象外）。
- **P5**：`channelScope` が `'all'` 固定。Instagram以外への拡張時に値体系を再設計・現時点では変更しない。
- **P6**：GET件数上限の明示設定なし（PostgREST既定上限内・件数増加時に再評価）。

### Git

**commit未実施**（`supabase/schema.sql` のみ未commit）。HEAD = origin/main = **4a14ad5**。保護対象4件は未stage・未commitで保護。

---

## 工程1-B本体 Active Case Hotfix — 案件未確定時の保存防止（2026-07-22・本番通常経路確認で検出・localhost検証完了）

> 記録日: 2026-07-22。**Phase54 Complete維持・Phase55未着手**（本Hotfixは工程1-B本体の一部であり、工程1-C・Phase55の開始ではない）。**`index.html` の1ファイルのみ（+17/-4）**。`server.js`・`lib/affiliateEvalDb.js`・DB・Migration・API shape は**無変更**。

### 本番通常経路の読み取り確認（先行実施・書込みなし）

Render本番（`https://ai-company-l45x.onrender.com`）へ最新コード配信済みを確認のうえ、**通常ログイン**（ユーザー実施）・**通常の案件タブ操作**で読み取りのみを確認した。

- **案件選択1操作につき `GET /api/affiliate-evaluations` は1回**（`?caseId=…&channelScope=all&activeOnly=true` → 200）。重複GETなし。
- **最新一覧（案件未確定ビュー）では GET 0回**。
- 案件切替時に**別案件の評価は混入しない**（全行が現在案件に属する）。
- 本番実案件の評価は**0件**のため0件表示の正常完了までを確認（既存評価の復元確認は未実施）。
- **console error 0件**。**本番への評価書込み（POST/PATCH/DELETE）は0件**（`POST /api/login` はユーザーのログイン操作）。

### 検出した不具合

案件を1件開いた後に**最新一覧（`__caselist__`）へ戻ると、「案件を追加」ボタンが有効のまま**になり、押下すると**直前に開いていた案件へ保存され得る**。

```
memberCaseView['leader']   = "__caselist__"      ← 案件未確定
_ncActiveCaseId('leader')  = undefined           ← 正しく未確定を返す
_lastOutputDraft.caseId    = 直前案件のcaseId    ← 残存
getCurrentApprovalCaseId() = 直前案件のcaseId    ← ★フォールバックで値を返す
_aicSyncState.status       = "no_case"           ← 表示側は正しくクリア済み
表示件数                    = 0                   ← 正しくクリア済み
```

**原因**：`getCurrentApprovalCaseId()` は `_ncActiveCaseId()` が `undefined` のとき **`_lastOutputDraft.caseId` へフォールバック**する既存仕様を持つ。Affiliate側がこれを案件判定に用いていたため、未確定ビューを「案件確定済み」と誤認していた。表示クリア・GET/POST未発行は設計どおり動作しており、**データ破損や別案件評価の表示は発生しない**。

**localhostで検出できなかった理由**：ローカル検証では `_lastOutputDraft` が `null` でフォールバックが発火しなかった。本番の実案件（Output Draft保有）で初めて再現した。

### 修正内容

**Affiliate専用ヘルパ `_aicCurrentCaseId()` を追加**し、AIC内の案件判定4箇所を統一した。

```javascript
function _aicCurrentCaseId() {
  try {
    if (currentMember && currentMember.id) {
      return _ncActiveCaseId(currentMember.id) || null;   // latest / __caselist__ は undefined → null
    }
  } catch (e) { /* 取得不可 */ }
  return null;                                            // 担当未選択（ホーム等）も未確定扱い
}
```

**統一した4箇所**：①復元応答適用前の案件再照合 ②復元リトライ対象の取得 ③`addAffiliateCase()` の保存前案件判定 ④「案件を追加」ボタンの有効/無効判定。`restoreAffiliateEvaluationsForCase(caseId)` のように**明示的に caseId を受け取る関数の引数は変更していない**。

**`getCurrentApprovalCaseId()` は無変更**（他機能が依存するため。総使用箇所17件を維持し、Approval／Output Draft／Leader dispatch／Agent consult はすべて温存）。

### localhost検証（Case 1〜4 全合格）

| Case | 結果 |
|---|---|
| 1 案件を開いた状態 | `_aicCurrentCaseId()` が現在案件を返す／ボタン有効／**GET 1回**／`status=ok` |
| 2 案件を開いた後に最新一覧へ戻る（`_lastOutputDraft.caseId` を残した再現条件） | `getCurrentApprovalCaseId()` は直前案件を返すが **`_aicCurrentCaseId()` は `null`**／`status=no_case`／表示0件／**ボタン `disabled`・onclickなし**／**GET 0・POST 0** |
| 3 未確定ビューで `addAffiliateCase()` を直接実行 | **即時中止**／`_affiliateCases`・退避バッファへ追加なし／**POST 0**／「保存先の案件を選択してください」 |
| 4 別案件へ切替 | 切替先caseIdを取得／**GET 1回**／前案件へ保存されず／**案件混入なし**／ボタン有効へ復帰 |

**補助確認**：担当未選択（ホーム）でも `null`＝ボタン `disabled`／`latest` ビューでも `null`／既存関数（`getCurrentApprovalCaseId`・`getCurrentApprovalOutputId`・`scheduleApprovalSync`・`scheduleOutputDraftRestore`・`syncTasksFromServer`・`switchCase`・`recordAffiliateCase`・`buildAffiliateIntelligenceRanking`）はすべて非回帰。

**通算**：GET 2／**POST 0・PATCH 0・DELETE 0**／**console error 0**／`node --check` OK／**dev-check 200/200/200**／**実DBへの書込みなし**。

---

## Instagram自動運営 工程1-B本体（Workflow Wiring）**Complete**（2026-07-22・localhost実DB検証完了・commit 69465f3 / d871f95）

> 記録日: 2026-07-22。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（本工程でPhase55を開始しない）。変更は **`index.html` の1ファイルのみ（+390/-4）**。`server.js`・`lib/affiliateEvalDb.js`・DB・Migration・**API shape** はすべて**無変更**。

### 実装内容

Phase53の **Affiliate Intelligence Core**（`_affiliateCases`・従来はメモリ保持のみでDB接続ゼロ）と、工程1-A/1-Bで完成した**永続化API**を接続した。

- **案件境界 D-1**：`_affiliateCases` は**現在表示中案件の評価のみ**を保持。未保存/保存中/保存失敗行は **`_affiliateUnsavedBuffer`（caseId付き）** で案件横断に保持し、案件切替でも失われない。
- **保存**：`addAffiliateCase()` の**明示追加時のみ**POST。**Leader Final／Workflow完了／Export時にはPOSTしない**。案件未確定時は `recordAffiliateCase()` より**前に中止**し、fingerprint生成もPOSTも行わない（未所属評価をメモリ上に作らない）。
- **復元**：案件確定4経路（`switchCase` / `_homeOpenCase` / `createNewCaseFromForm` / `_homeOpenCaseList`）に個別配線。**4経路は相互に呼び出しておらず1操作＝1GET**。GET条件は **`caseId` ＋ `channelScope=all` ＋ `activeOnly=true` を明示**。
- **`sourceFingerprint`（client生成）**：`affiliate-evaluation-v1:` ＋ **固定順配列**（`caseId`・実効`channelScope`・正規化商品名/ASP名・評価入力値・算出結果・`detail`保存分をすべて含む）。timestamp／random／client一時ID／`createdAt`／DB id／`rank` は**含めない**。数値は **fingerprint内でのみ小数2桁へ正規化**（DB保存値は丸めない）。
- **POST payload**：`productIdentifier`・`channelScope`・`recommendation`・`source` は**送らない**（サーバー正本／server既定に委ねる）。API未対応の**評価補足7項目＋`origin`＋メタ2項目**を `detail`(JSONB) へ格納（`origin: 'affiliate-intelligence-core'`）。
- **保存状態**：`unsaved` / `saving` / `saved` / `save_failed` を内部管理（APIへは送らない）。保存済み判定は **`serverId` またはGET復元由来**で行い、client側IDでは判定しない。
- **除外（A案）**：**DB保存済み行は除外不可**（ボタン `disabled` ＋理由表示）。inactive化APIが未実装で「削除したのに復活する」誤認を生むため。未保存/失敗行のみ除外可。
- **失敗時**：`save_failed` で**無言消失させない**。エラーバッジ＋**同一fingerprintでの再送ボタン**を提供。

### 重複表示修正（第2段階 Case 4 で検出→修正）

復元済みサーバー行が表示中に同一内容を再登録すると、同一 `serverId`／同一 fingerprint の行が**UIに2行表示**される不具合を検出（**DBは正常・表示のみの不整合**）。原因は `_affiliateCases` 側の fingerprint 突合欠落。

- **`_aicDedupeSavedRow()` 追加**：POST成功後、**同一caseId内**で更新対象以外の重複行を除去。条件＝①同一`serverId` ②同一`sourceFingerprint` ③同一`channelScope`かつ同一`productIdentifier`。
- **`caseId` が異なる行は決して除去しない**。更新対象行自身は必ず保持。
- POST応答の `serverId`・`source_fingerprint`・`channel_scope`・`product_identifier` を**正本として取り込む**。

### channelScope 安全補強

条件③に **`channelScope` 一致**を追加（`_aicScopeOf()` で未設定は `'all'` へ正規化）。サーバーのActive一意性単位が `case_id + channel_scope + COALESCE(product_identifier,'')` であるため、**将来 `all` 以外のscopeが追加されても別scopeの行を誤って除去しない**。

### 第2段階 localhost実DB検証（Case 1〜9 全合格）

専用テスト `caseId`（`aic-wiring-test-a/b-20260722`）・専用商品名（`__AIC_WIRING_TEST_PRODUCT_A/B__`）で実施。

| Case | 結果 |
|---|---|
| 1 新規保存 | POST1回・`case_id`一致・`channel_scope=all`・`product_identifier` サーバー生成・**`recommendation=NULL`**・**`source=manual`**・`saved`・二重表示なし |
| 2 F5後の復元 | GET1回（条件明示）・1件復元・snake→camel正常・二重なし |
| 3 案件分離 | 案件B切替で**A行が即時消失**・混入なし・GET各1回・Bへの登録がAに無影響・A復帰でA行のみ |
| 4 冪等再送 | POST1回・**DB行数不変**・返却serverId一致・**UI 1行**・重複なし |
| 5 再評価 | 新fingerprint・新行active・**旧activeのみinactive**・**UI 1行（旧Active表示なし）**・案件B無影響 |
| 6 保存済み行の除外不可 | 除去されず・**POST/PATCH/DELETE 0件**・DB不変・`disabled=true`＋理由表示・F5後も復元 |
| 7 保存失敗・再送 | `save_failed` 保持（無言消失なし）・案件切替で混入なし・復帰で復活・**同一fingerprintで再送1回**→`saved`・バッファ除去・UI1行 |
| 8 案件未確定ビュー | 表示0件・**GET 0/POST 0**・案内表示・登録ボタン無効・**退避バッファ保持** |
| 9 同一案件GET失敗 | **既存表示を維持**（空にしない）・失敗表示＋再取得ボタン・復旧後成功・重複なし |

**Network通算**：PATCH/DELETE **0件**／1操作1POST・1切替1GET を維持／**console error 0**／`node --check` OK／**dev-check 200/200/200**。

### テストデータ削除完了

Supabase SQL Editor で `WHERE case_id IN ('aic-wiring-test-a-20260722','aic-wiring-test-b-20260722')` の**限定DELETE**を実行し **`remaining = 0`** を確認。localhost GET（`activeOnly=0`）でも **A=0件 / B=0件**（`source:"db"`）を確認。**条件なしDELETE不使用・実案件データ無影響**。

### 未確認事項（隠さず記録）

1. **通常ログイン／通常案件選択経路での実操作確認は未実施** — 専用テストcaseIdはアプリの案件（`cases`）として存在せず、通常操作で開くには案件作成が必要なため。実運用案件は使用しない方針。検証は**ブラウザランタイムで案件選択をstubし実装関数を直接実行**する方式で行った（ソース・server.js・APIは無変更）。4経路への配線は実行時の関数ソースで確認済み。
2. **F5後の `save_failed` 行の保持は保証対象外**（退避バッファはメモリ保持・**Known Limitation**）。
3. **Render本番POSTは未実施**（本番書込み禁止のため）。
4. **別 `channelScope` の実運用検証は未実施**（現時点 `'all'` 固定のため机上・ランタイム検証のみ）。

### Git

**未commit**（`index.html` のみ変更）。HEAD = origin/main = **d270ceb**。保護対象4件は未stage・未commitで保護。

---

## Instagram自動運営 工程1-B-0a〜0d — Affiliate評価 Active一意性の商材単位化 **完了**（2026-07-22・Code commit 2ef2ad3・Migration完了・実DB検証完了）

> 記録日: 2026-07-22。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（本工程でPhase55を開始しない）。変更は **`lib/affiliateEvalDb.js` の1ファイルのみ**（`server.js`・`index.html`・`supabase/schema.sql`・他lib・他APIは**無変更**）。**API shape維持**。

### 工程の内訳

- **工程1-B-0a（本番DB実測調査）完了** — `affiliate_evaluations` 0件・旧Index `uq_affiliate_eval_active_case` 存在・Active重複なしを実測。
- **工程1-B-0b（最終設計確認）完了** — `productIdentifier` 正式方式・正規化規則・Migration SQLを確定。
- **工程1-B-0c（Migration）完了** — 実行はSupabase SQL Editor（**Claude Code環境にDDL実行経路がないため**：service_roleキー／`DATABASE_URL`／`pg`／`psql`／Supabase CLI いずれも未存在）。
- **工程1-B-0d（実装＋実DB検証）完了** — コード実装・純関数検証・実DB POST検証・テストデータ削除まで完了。

### Migration（適用済み）

```sql
DROP INDEX IF EXISTS public.uq_affiliate_eval_active_case;
CREATE UNIQUE INDEX uq_affiliate_eval_active_product
ON public.affiliate_evaluations (case_id, channel_scope, (COALESCE(product_identifier, '')))
WHERE is_active;
```

- **旧Index `uq_affiliate_eval_active_case` は不在**・**新Index定義一致**・**件数不変（0件）**を `pg_indexes` 実測で確認。
- `pg_constraint` に旧Active一意性相当のConstraintは**存在しない**（`affiliate_evaluations_pkey` / `affiliate_evaluations_fingerprint_key` / `affiliate_evaluations_reco_chk` のみ）。
- **経緯**：Migration本体の再実行時に **42P07（新Indexが既に存在）** が発生。`BEGIN〜COMMIT` 内のため**全体がロールバックされDB状態は不変**。その後の読み取り実測でIndex構成が目的どおりであることを確認し、**追加DDL・Rollbackは不要**と判定した。

### 実装（`lib/affiliateEvalDb.js` +36/-6）

- **`normalizeAffiliateKeyPart()` 追加**：全角空白→半角／前後空白削除／連続空白を1つへ統一／英字小文字化。**Unicode NFKC・ASP別名辞書・記号除去は不採用**（誤統合より別subject保持を優先）。
- **`buildProductIdentifier()` 追加**：`JSON.stringify([normalizedProductName, normalizedAspName || null])`。`productName` なしは **`null`**。JSON配列採用により**区切り文字衝突**（`"商品|ASP"` 形式）を回避。**空文字を返さない＝`''` をDBへ保存しない**。
- **案A（厳格）採用**：`productName` があればサーバー側で**必ず再生成**し、**client送信の `ev.productIdentifier` は保存値に使用しない**（正本はサーバー＝`lib/affiliateEvalDb.js`）。
- **旧active無効化を subject 単位へ限定**：`case_id + channel_scope + product_identifier + is_active`。値ありは `.eq('product_identifier', …)`、**nullは `.is('product_identifier', null)`**（`.eq(…, null)` は一致しないため禁止）。
- **`_str()` 共通関数は無変更**（他17列への副作用ゼロ）。`getAffiliateEvaluations()`・`module.exports`・処理順（①冪等判定→②旧active false化→③insert）も**不変**。

### 検証（実測）

- `node --check` OK ／ **dev-check 200/200/200** ／ GET非回帰OK（`source:"db"`・caseId欠落は400）。
- **純関数テスト 15/15 PASS**（実ファイル本文から関数ソースを抽出して実行。**検証目的のexport追加なし・本番コードへテスト処理を残していない**）。
- **実DB POST検証 全8ケース成功**（専用 `caseId=test-aff-eval-1b0d-20260722` / `channelScope=test-instagram-1b0d`）：①商品A初回 ②商品B共存 ③同一fingerprint再送＝`idempotent:true`・行数不変 ④商品A再評価＝旧Aのみinactive ⑤同一商品・別ASP＝別subject共存 ⑥client指定 `productIdentifier` 無視 ⑦`productName` なし＝`product_identifier` null ⑧null subject再評価＝旧nullのみinactive。
- **最終状態**：Active **5件共存**（旧Indexでは不可能）／Inactive 2件／履歴 7件／**23505なし**／**HTTP 500なし**／全POST `ok:true`・`source:"db"`。
- **`.eq()` / `.is()` を実DBで実証**：同一subject以外（他商材・別ASP・null↔非null）を**一切巻き込まない**ことを確認。
- **後始末完了**：Supabase SQL Editorで `WHERE case_id = 'test-aff-eval-1b0d-20260722'` の**限定DELETE**を実行し `remaining = 0`。localhost GET（`activeOnly=0`）でも**履歴込み0件**を独立確認。**条件なしDELETEは未使用・実案件データ無影響**。

### Git

- Code commit **2ef2ad3**（`Fix affiliate evaluation active uniqueness by product`・`lib/affiliateEvalDb.js` のみ +36/-6）。docs commit＝本更新。
- 保護対象4件（`cost-logs.json`・`claude-cost-logs.json`・`claude-quality-history.json`・`backup-dup-candidates-20260714/`）は**未stage・未commitで保護**。`git add .` / `git add -A` は不使用。

### 残タスク・既知事項（隠さず記録）

1. **`supabase/schema.sql` へ未記録** — `affiliate_evaluations` は**テーブル定義そのものが schema.sql に存在しない**（工程1-A時にDBへ直接作成）。新Index定義を含めた記録は**別工程**とする。
2. **`index.html` 側の配線は未着手**（`_affiliateCases` は現在もメモリ保持のみ。当該APIへの `fetch` はゼロ）。**工程1-B本体**で実施する。
3. **旧active無効化→insert のトランザクション化（RPC等）は未実施**（工程1-A由来の既知事項を継続）。
4. **inactive化／PATCH／DELETE API は未実装**（後始末はSupabase SQL Editorが正式経路）。
5. **`product_identifier = ''`（空文字）行が将来混入した場合の非対称性** — 新Indexは `COALESCE(…,'')` でnullと`''`を同一視するが、アプリの `.is(null)` は `''` 行を掴めない。現行実装は `''` を書き込まないため**構造的に発生しない**が、前提条件として維持する。
6. **1 case に active 評価が複数件**存在し得る。GETは元々配列返却のため shape は不変だが、「active＝1件」を前提とする利用側を今後作らないこと。
7. **Phase55は未着手のまま維持**。

---

## Instagram自動運営 工程1-A — Affiliate Evaluation Persistence API **完了**（2026-07-21・Code commit 047f4d3・localhost検証完了）

> 記録日: 2026-07-21。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（本工程でPhase55を開始しない）。社員向上B完了後の最優先＝**Instagram自動運営機能**の第一歩。変更は **`server.js` ＋ `lib/affiliateEvalDb.js` の2ファイルのみ**（index.html・schema.sql・他lib・他APIは無変更）。

- **実装内容**：
  - **`affiliate_evaluations` Supabaseテーブル**（会社共通Affiliate Intelligenceの永続化先）
  - **`lib/affiliateEvalDb.js` 新規**（110行／export＝`getAffiliateEvaluations`・`saveAffiliateEvaluation` の2関数のみ）
  - **`GET /api/affiliate-evaluations`**：`caseId`単位の評価取得（必須）／`channelScope`対応（任意）／`activeOnly` 既定true・`0`で履歴（inactive含む）／`created_at` 降順
  - **`POST /api/affiliate-evaluations`**：`caseId`・`sourceFingerprint` 必須
  - **`source_fingerprint` による冪等性**：同一fingerprint再送は新規登録せず既存を返す（`idempotent:true`）
  - **同一 `case_id`＋`channel_scope` の旧activeを `false` 化**してから新active 1件をinsert＝**評価履歴を保持**（物理削除しない）
  - **Supabase未設定・障害時のfallback**：`source:'db'|'fallback'|'error'` を区別（空配列と同一扱いにしない）
  - **JSONB `detail` 対応**（`_str()` を通さず構造を保持）／数値は `_num()` で不正値をnull化／`recommendation` は `adopt`/`watch`/`reject` のみ許可
- **確認済み**：`node --check` 2ファイルとも成功／**dev-check 200/200/200**／localhost **GET成功**（`source:"db"`）／localhost **POST成功**／2回目の同一POSTで **`idempotent:true`**（新規行なし）／**履歴込み1件**を確認／テストデータ削除後に **履歴込み0件**を確認／**実案件データ・他テーブルへの影響なし**（書込み対象は `affiliate_evaluations` のみ）。
- **Git**：Code commit **047f4d3**（`server.js` +34/-1／`lib/affiliateEvalDb.js` 新規110行）。docs commit＝本更新。記録時点で origin/main **908ed03**・**未push**（本docs commit後に main＋tag を push 予定）。保護対象4件（`cost-logs.json`・`claude-cost-logs.json`・`claude-quality-history.json`・`backup-dup-candidates-20260714/`）は**未stage・未commitで保護**。

### 既知事項（隠さず記録）
1. **旧active無効化 → 新規insert は現時点でDBトランザクションではない**（②update → ③insert の2段構成）。
2. insert失敗時に **active 0件となり得る**。その場合レスポンスへ **`activeMayBeZero:true`** を付与して通知する（旧行は残存するため復元可能）。
3. **RPC／DB transaction 化は別工程**（工程1-Aの範囲外）。
4. 検証時の**日本語文字化けはAPI不具合ではない**。Windowsシェル経由でcurlへ渡した際の**文字コード問題**（ASCII・数値・JSONB構造はすべて正常動作）。
5. 日本語POSTを再確認する場合は **UTF-8のJSONファイル＋`curl --data-binary @file.json`** を使用する。
6. **inactive化／PATCH／DELETE API は今回未実装**（`is_active=false` への直接変更手段はAPIに存在しない）。
7. **Phase55は未着手のまま維持**する。

---

## 社員向上B 正式完了 — 定義駆動基盤完成／13型中11型移行（2026-07-21・localhost検証完了・push前・Render未反映・HEAD 61dde05）

> 記録日: 2026-07-21。**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**。**Phase54 Complete維持・Phase55未着手**（本更新でPhase55を開始しない）。改善案件「社員向上B」の実装工程を**正式完了**として記録。**index.htmlのみ**（未push 7コミット・server.js／lib／DB／API／schema.sql 無変更）。

### 目的（13型完全統一ではない）
社員向上Bの目的は13型すべての完全統一ではなく、以下を達成すること。
- **定義分散の解消**
- **定義駆動基盤の完成**
- **既存出力との互換性維持**
- **Instagram自動運営・収益化開発へ安全かつ最短で移行できる状態を作ること**

### 正式完了条件（充足）
- **定義駆動基盤が実用上十分完成**（`OUTPUT_SECTION_DEFINITIONS` によるSection定義層＋定義からdraft fieldを構築する抽出エンジン＋wrapperによる安全適用＋`implemented:false`対応＋型別fallback維持＋既存inline処理との互換性維持）。
- **Instagram収益化に必要な出力型が安全に運用可能**。
- **既存出力との互換性を維持**。
- 13型すべての完全統一は必須条件ではない。

### 最終移行状況（13型中11型移行済み）
- **完全定義駆動（6）**：document ／ pdf ／ powerpoint ／ excel ／ instagram_post ／ html
- **ハイブリッド（5）**：image_prompt ／ video_prompt ／ instagram_carousel ／ tiktok_video ／ youtube_shorts
- **正式保留（2）**：flyer ／ lp — **未完了扱いではなく**、Instagram収益化を遅らせないための正式な優先順位判断として保留。必要性が生じた時点で、社員向上Bとは別の個別工程として再評価する。

### 品質確認（各工程で確認済み・ローカル）
旧処理と新処理の等価性／mismatch 0／updatedFields一致／wrapper非回帰／二重生成なし／二重代入なし／JavaScript構文OK／dev-check 200/200/200／console error 0／**AI API実行なし**／POST・PATCH・DELETEなし。**現時点はローカル実装・ローカル検証完了、push前・Render未反映**（本番実機確認は未実施）。

### Git現在地
- HEAD **61dde05**（`Migrate TikTok, YouTube Shorts, and HTML draft fields`）／origin/main **ac2f5da**／**local ahead 7**（未push）／最新Tag **v1.01-phase54-video-html-section-migration**。
- 未push 7コミット（工程順）：c38df55 Section定義 → 6fc3616 Section抽出 → a48380c document/pdf → 43598a6 image_prompt/video_prompt → 83fbad3 powerpoint/excel → 51caede instagram_post/instagram_carousel → 61dde05 tiktok_video/youtube_shorts/html。対応するローカルTagも存在。
- **push・Render反映は未実施**（ユーザー承認後）。保護対象4件（cost-logs.json・claude-cost-logs.json・claude-quality-history.json・backup-dup-candidates-20260714/）は未commitで保護。

### 次の最優先
本番反映後、**Instagram自動運営機能**の開発開始（市場調査／競合分析／ASP比較／商品選定／投稿企画／カルーセル／キャプション／ハッシュタグ／Learning／投稿承認）。

---

## 社員向上B 工程B-1 — outputType正本化 **完了**（2026-07-20・localhost確認済み・commit 066241f・tag v1.01-phase54-output-type-normalization）

> 記録日: 2026-07-20。**Version1 Final Complete ／ Version1.1 開発中**。**Phase54 Complete維持・Phase55未着手**。改善案件の**工程B-1**。**index.htmlのみ（+40/-7）**／server.js・lib・DB・API・schema.sql は**無変更**。

- **正本の明文化**：定義の正本＝`OUTPUT_TYPES`（13種・増減なし）／ランタイム正本＝`_lastOutputDraft.type`／永続化正本＝`output_drafts.type`／表示定義正本＝`OUTPUT_TYPE_DEFINITIONS`。各処理の `outputType` は `draft.type` の**派生値**（新たな並行正本は作らない）。
- **`normalizeOutputType()` 追加**（正規化関門）：正式値はそのまま／legacy alias 9件（`ppt`・`pptx`→`powerpoint`／`landing_page`・`landing-page`→`lp`／`youtube_short`→`youtube_shorts`／`image-prompt`→`image_prompt`／`video-prompt`→`video_prompt`／`instagram-carousel`→`instagram_carousel`／`instagram-post`→`instagram_post`）／**空・null・undefined・unknown・未知値は `document`**／曖昧語（instagram/insta/ig/reel/video/post/carousel）は**alias化せず** `detectOutputType()` の責務として維持。
- **境界で正規化**：Workflow生成起点（`atRunWorkflow`）／`createOutputDraft()` 入口／DB復元（`_outputDraftFromServerRow`）／`normalizeOutputDraft()`／保存Payload（`buildOutputDraftPayloadForServer`・**null不送出**）／Output Engine主要表示を定義label経由へ統一。**DB CHECK制約は追加しない**。
- **Learning観測値の `unknown`** は成果物正本とは**別責務**として温存（server.js・無変更）。
- **確認**：インラインJS 2ブロック構文OK／dev-check 200/200/200／console 0／正規化テスト **24/24 PASS**／OUTPUT_TYPES 13種自己返却OK／Draft生成・DB復元・保存Payload・Output Engine表示・Export派生・Preview/Publishing 非回帰／**AI API実行なし**。
- **Git**：Code commit **066241f**（index.htmlのみ）・tag **v1.01-phase54-output-type-normalization**（→066241f）・Docs commit（本更新）。**main push＋当該tag push実施**。保護対象4件（cost-logs.json・claude-cost-logs.json・claude-quality-history.json・backup-dup-candidates-20260714/）は未commitで保護。
- **次工程**：本番反映・確認後に **工程B-2「セクション動的化＋内部指示分離」の調査**（未着手）。

### Cost DB工程 後続完了（最新状態・「push未実施」記録は過去履歴）
- 下記「Cost DB 基盤 完了」節の **「push未実施／Render確認前／`/api/cost`確認前」は記録時点（過去履歴）**。**最新状態は以下で確定**：
  - **HEAD = origin/main = `532b3f3`ライン＝main push完了・tag push完了**
  - **Render反映確認済み・本番API確認済み**：`GET /api/cost`／`GET /api/cost?provider=claude`／`GET /api/cost?provider=all` すべて **HTTP200**。
- これは**履歴情報と最新状態の差**であり更新漏れではない。

---

## Cost DB 基盤 完了 — Opening Balance／一意性設計／23505改善／schema.sql記録（2026-07-19・commit 81a5288・tag v1.01-phase54-cost-db-complete・**push未実施**）

> 記録日: 2026-07-19。**Version1 Final Complete ／ Version1.1 開発中**。**Phase54 Complete維持・Phase55未着手**。本項は「Cost DB層」（コードが先行しdocs未記載だった意図的な二層のうち Cost DB 関連）を正式記録するもの。**実DB構造は既に適用済み**。

- **Cost DB 4オブジェクト完成**：`api_cost_events`（利用イベント正本・`usage_event_id` UNIQUE冪等・provider CHECK・token/request/金額の非負CHECK・`usage_date`／`usage_date+provider` INDEX）／`api_cost_settings`（単一行 id=1・`monthly_limit`・`stopped`）／`api_cost_opening_balance`（移行前累積）／`api_cost_daily_v`（日次集計VIEW）。RLS有効・`<table>_all` FOR ALL TO anon。
- **Opening Balance 登録済み**：OpenAI **54.05円**（id=1・historical_usage）／Claude **319.57円**（id=4・historical_usage・`$1.997365 × 160 − 既存Event0.01`）。**active合計 373.62円**・events 0.04円・**grand_total 373.66円**。
- **一意性設計**：業務一意性＝`(provider, balance_type) WHERE is_active`（部分UNIQUE `uq_api_cost_ob_active_provider_type`）／技術的冪等＝`source_fingerprint` UNIQUE（`api_cost_ob_fingerprint_key`）。**旧 `uq_api_cost_ob_active_legacy` は廃止済み**。
- **23505 二段階判定**（`lib/costDb.js` `ensureOpeningBalance()`・+43/-2）：①`source_fingerprint`再SELECT＝冪等 ②`(provider,balance_type,is_active)`再SELECT＝業務競合を `OPENING_BALANCE_ACTIVE_CONFLICT` で明示（誤existingにしない）③どちらも不能なら元23505保持。stub全PASS・dev-check 200/200/200・実DB非接触・冪等再実行 existing 確認済み。
- **schema.sql 正式記録**：末尾へ Cost DB セクションを **+181/-0 純追記**（既存行無変更）。**空DB再構築・定義記録用であり本番migrationではない／既存本番DBへの差分適用には使用しない**。
- **Git**：Code commit **81a5288**（`lib/costDb.js`＋`supabase/schema.sql`）・tag **v1.01-phase54-cost-db-complete**。**push未実施**。対象外（`cost-logs.json`・`claude-cost-logs.json`・`claude-quality-history.json`・`backup-dup-candidates-20260714/`）は未commitで保護。

---

## 改善案件 工程A — 設定保持 **完了**（2026-07-17・localhost確認済み・commit 8c9ed58・tag v1.01-phase54-agent-settings-persistence）

- **位置づけ**：**Version1 Final Complete ／ Version1.1 開発中**。Phase54 Complete後に確認された「運用品質・表示・設定保持の改善案件」の**工程A**。**Phase54 正式Complete維持**・**Phase55 未着手**・**工程B以降は未着手**。**index.htmlのみ（+45/-7）**／server.js・lib・DB・API・SQL は**無変更**。
- **現象**：ページ更新後に Auto Task「自動→手動」・自律相談「ON→OFF」へ戻る。
- **原因**：永続化処理が存在せず、起動毎に初期値 `false` へ戻っていた。**ただしこれは実装漏れではなく「課金防止システム」節の意図的な設計**（旧コメント：`localStorageには保存しない（起動毎にリセット）`）。方針変更としてユーザー承認のうえ実施。
- **実装**：`enbisou_auto_start_v1` / `enbisou_autonomous_consult_v1` へ保存（既存の設定系規則 `enbisou_*_v1` に準拠）。トグル直後に `_saveAgentSetting()` で保存し、`restoreAgentSettings()` を **`showApp()` 冒頭**（初回ロード・再ログインの両経路を通る唯一の入口）から呼んで復元。保存値なし・不正値は**既存初期値 `false` へフォールバック**。復元時は `updateAutoStartBtn()` / `updateAutonomousConsultBtn()` で**内部値と表示を必ず一致**させる。
- **【課金防止の維持（最重要）】**：**復元するのは設定値と表示のみ。起動時に Workflow・AI・API を自動実行しない。** `autoStart` を消費するのは `atAutoStartWorkflow()` のみで、呼び出し元は `handleLeaderDispatch` 内の3箇所（ユーザーがLeaderへ依頼した後）のみ＝**起動経路からの呼び出しは存在しない**。`if (!autoStart) return;` と `autoStart && !billingLock` ガードも従来どおり有効。

### 確認（localhost）
- 自動→F5→「自動」維持／手動→F5→「手動」維持／ON→F5→「ON」維持／OFF→F5→「OFF」維持
- 案件切替・ホーム移動・**ログアウト→再ログイン**でも維持（再ログイン前に内部値を意図的に `false` へ落として復元を実証）
- 内部値と表示の一致を全ケースで確認／未保存・不正値のフォールバックを実測
- **起動時リクエストはすべてGET・AI実行系POSTは0件**（`_atCurrentWorkflowId` は `null`）
- **console 0**／**dev-check 200/200/200**／インラインJS 2ブロック構文OK
- 既存機能の健在を実測（一括操作Hotfix・Decision 064・Task作成dbId Hotfix・billingLockガード）

### 状態・次工程
- **Phase54 Complete維持**／**Phase55未着手**／**工程B以降は未着手**
- **非対象**：**端末間同期**（DB列がなくSQL変更が必要なため別途判断）／Auto Task・自律相談の処理内容
- **残**：本番確認（設定保持のみ。**Leader依頼・AI生成・Task生成は行わない＝課金APIテスト禁止**）
- **保留**：**前工程（Task作成dbId Hotfix）の本番実機確認は未実施のまま**

---

## Task新規作成 二重化 Hotfix **完了**（2026-07-17・本番反映済み・localhost確認済み・commit 39b44d0・tag v1.01-phase54-task-create-dbid）

- **位置づけ**：**Phase54 Complete後に発見された Known Issue の Hotfix**（A案採用）。**Phase54 正式Complete は維持**・**Phase55 未着手**。**index.htmlのみ（+15/-9）**／server.js・lib・DB・API・SQL は**無変更**。
- **現象**：Task作成後、POST は成功しているのにクライアントが `dbId` を取り込めず local-only のまま残り、リロード後にサーバーコピーと**同一Taskが2件表示**される。
- **原因（クライアント単独。サーバー・API・DBは正常）**
  - **① `submitTask()` の dbId 誤代入**：非同期コールバック内で**配列先頭を再評価**していたため、POST往復（本番RTT実測 約0.9秒）の間に他経路の先頭挿入（7か所）が割り込むと**dbId が別Taskへ代入**され、本来のTaskは永久に local-only 化。**条件付き発生**。
  - **② `atCreateNextTasksFromItems()` の握り潰し**：POST を投げっぱなしにして**返却された dbId を常に破棄**。この経路のTaskは**必ず** local-only 化。**Decision 063（Case成功確認契約）と同型**。
  - **自動解消しない理由**：merge の照合キーは **`dbId` のみ**。backfill の署名照合（Pass A）は起動順が `sync` → `backfill` のため、**同期済みコピーが既に dbId を確保済み**となり採用条件を満たさない。
- **修正（2箇所のみ）**：作成Taskを**捕捉変数**で保持し、①②とも既存の **`_persistNewTask()` へ統一**（内部で `_ensureTaskCaseId` → 成功時のみ dbId 付与・冪等）。→ **全7作成経路が安全な方式に統一**（`_persistNewTask` ×5／`.then` 捕捉変数 ×2）。
- **不変**：`syncTaskToServer()` 本体（正常）／**`syncTasksFromServer()` の merge は無変更**／Server正本契約（`archivedAt` / `deletedIds`）／backfill／一括操作Hotfix／Decision 063・064・065。

### 確認
- **fetchスタブ（実DB非接触）**：連続作成の全Taskが**自分自身の dbId** を取得（**解決順を逆転させた条件でも誤代入0**＝調査で指摘した潜在リスクも解消）／自動次Task 3件とも dbId 取得・重複0／**同期後も local 3件 = server 3行・重複0＝二重表示なし**
- **対照実験**：旧実装を局所再現すると同一条件で **local 4件（server 3行）・重複1件**を再現 → 修正が原因に効くことの直接証拠
- **console 0**／**dev-check 200/200/200**／インラインJS 2ブロック構文OK／本番トップ200・**配信コードがローカルと完全一致**／欠陥パターン残存**0件**（本番配信コードで確認）／一括操作Hotfix・Decision 064/065 **非回帰**
- **DB無変更**：生存tasks **253**／archived **167**／deletedIds **127**／cases 生存**2**・削除済**2**。**検証用Taskの混入0件**

### 状態・次工程
- **Phase54 Complete維持**／**Phase55未着手**
- **残**：**本番実機確認（PC）**
- **未整理（別途判断）**：本番DBの**重複署名16グループ・余剰16行**（すべて2行重複・Leader依頼系が中心）。本Hotfixは**新規発生の停止のみ**で、**既存の二重化データは自動解消されない**。整理する場合は対象特定・削除方針・Server正本契約への影響を別途検討する

---

## Task一括操作 Hotfix **完了**（2026-07-17・本番反映済み・localhost実機確認済み・commit deba2ed・tag v1.01-phase54-task-bulk-parallel）

- **位置づけ**：**Phase54 Complete後に発見された Known Issue の Hotfix**。**Phase54 正式Complete は維持**・**Phase55 未着手**。**index.htmlのみ（+200/-65）**／server.js・lib・DB・API・SQL は**無変更**。
- **現象**：ホームで全選択（133件）→アーカイブしても、更新すると一部（24件など）しか減らない。繰り返すと徐々に減る。
- **原因**：**クライアント単独**の問題。1件ずつ直列 `await`（本番RTT実測 約0.9秒 × 133件 ≒ **約2分**）で、その間UI無反応・`saveTasks()` はループ完了後の1回のみ。ユーザーが待ちきれず更新すると処理が中断し、**PATCH完了分のみ Server正本（`archivedAt`）から復元**されていた。**サーバー・DB・Task同期・件数制限はすべて正常**（`.limit()` / `.range()` は0件）。
- **対策（A案）**：**同時5並列**（`_taskBulkRunPooled()`・共有カーソル方式・重複処理なし・1件の例外で全体停止なし）／**進捗表示**（`_taskBulkProgress()`）／**二重実行防止**（`_taskBulkBusy`・`finally` で確実解除）／**離脱警告**（処理中のみ `beforeunload`）／**成功ごとの `saveTasks()`**（中断されても成功分が残る）。
- **不変**：`setTaskArchivedOnServer` / `softDeleteTaskOnServer` **無変更**・**Server成功後のみlocal反映**・失敗はlocal維持＋**選択維持**・**本描画は完了後1回のみ**・Server正本契約（`archivedAt` / `deletedIds`）・Decision 064／065。
- **効果**：133件で**約120秒 → 約24秒**（同時5並列）。処理中の進捗可視化と逐次保存により、**中断による「一部しか消えない」現象を解消**。

### 確認
- **localhost実機**：アーカイブ3件 → 復元3件（**原状回復**）／完全削除3件（サーバー経路2＋local-only経路1）／件数・バッジ一致（86→83→86）／失敗0時の全選択解除／処理中の全ボタンdisable／**console 0**／**dev-check 200/200/200**／インラインJS 2ブロック構文OK
- **本番**：Render自動デプロイ反映・トップ200・**配信コードがローカルと完全一致**・Decision 064/065 非回帰
- **DB実測（確認時点）**：生存tasks **253**／archived **167**／**deletedIds 127**／cases 生存**2**・削除済**2**（※`deletedIds` は 125→127。確認用テストTask 2件の作成・完全削除による。**既存Taskの喪失なし**）

### 状態・次工程
- **Phase54 Complete維持**／**Phase55未着手**
- **残**：**本番でのPC実機確認**（一括アーカイブ・復元・進捗表示・件数/バッジ一致・console 0）
- **別Known Issue（次工程で原因調査のみ・実装禁止）**：**Task新規作成時の2重化**。POSTは成功しているがクライアントが `dbId` を取り込めず local-only のまま残り、リロード後にサーバーコピーと**2件表示**になる。**本Hotfixとは無関係の既存問題**（`submitTask()` / `createTask()` は本Hotfixのdiffに含まれない）。**Decision 063（Case成功確認契約）と同型か**を含め調査予定

---

## Task表示仕様変更 **完了**（2026-07-17・本番反映済み・PC/iPhone実機確認完了）

- **位置づけ**：**Phase54 正式Complete は維持**・**Phase55 未着手**。Phase54 Hotfix の Task側 PC⇔iPhone 実機確認で判明した**表示上の2件**への対応。**index.htmlのみ**／server.js・lib・DB・API・SQL は**無変更**。

### ① Task Home Overview（commit **5fe2b64**・tag **v1.01-phase54-task-home-overview**・Decision 064）
- **ホームでは全案件Task＋横断Task（`case_id=NULL`）を表示**する（会社全体のTaskを俯瞰する画面）
- **案件画面では選択案件Task＋横断Task**を表示（**他案件のTaskは表示しない**＝案件別分離を維持）
- **最新一覧／案件一覧は横断Taskのみ**（現状維持）
- **Timeline／Notification／Task History は変更しない**（ホームでは従来どおり横断のみ）
- 判定を `_taskInCurrentView()` へ集約し、**一覧・Progress・バッジ・診断が同一の可視集合**になるよう統一（バッジだけ全件＝件数不一致を構造的に防止）

### ② Task Sort Order（commit **bbfbc73**・tag **v1.01-phase54-task-sort-newest**・Decision 065）
- **PC・iPhoneとも Task一覧は「上が最新・下が過去」で統一**（`createdAt` 降順）
- 同一 `createdAt` は `id` を第2キーとして順序を固定
- **archived一覧も同一ソート**
- 原因：一覧が `tasks` 配列の順序をそのまま描画しており、自端末作成Task（`unshift`＝先頭）と他端末作成Taskの同期受信（`syncTasksFromServer` の `push`＝末尾）が混在して、**PCとiPhoneで並び順が逆転**していた
- **表示用 `filtered` のみをソート**。`tasks` 配列本体・同期・backfill・localStorage・DB は**一切変更しない**

### 確認
- **本番実機確認完了**（PC・iPhone）
- dev-check 200/200/200／console 0（localhost・本番とも）／本番トップ200・配信コード一致
- **DB無変更**：cases 生存2/削除済み2/合計4・tasks 生存253/deletedIds125・archived70＝いずれも変更前と同値。**テストデータの作成・削除・アーカイブなし**

### 状態・次工程
- **Phase54 Complete維持**／**Phase55未着手**
- **次工程候補**：① **Phase55へ進むか判断** ／ ② **Version1.1 最終確認** ／ ③ **Version2（Affiliate Intelligence）準備**

---

## Case成功確認契約 **完了**（2026-07-17・本番反映済み・commit aed5f7d・tag v1.01-phase54-case-sync-contract）

- **位置づけ**：**Phase54 正式Complete は維持**・**Phase55 未着手**。案件系Known Issue Close後の残課題（`pushCaseToServer` の失敗握り潰し構造）への恒久対応。**index.htmlのみ（+48/-11）／server.js・lib・DB・API・SQL は無変更**。
- **Git**：HEAD = origin/main = **aed5f7d**（docs更新後は本docs commitが最新HEAD）／最新code tag = **v1.01-phase54-case-sync-contract**。
- **背景（問題点）**：`pushCaseToServer` が `fetch(...).catch(() => {})` で**失敗を完全に握り潰し**、`res.ok` も `data.ok` も検証していなかった。POST失敗が無音のため **local-only案件が再発し得る**構造だった（案件作成が唯一の入口となった今も残存していたリスク）。
- **P4（新発見）**：サーバは Supabase 失敗時も **HTTP 200 + `{ ok:false }`** を返す（`res.json({ ok: !result.error, ... })`）。**HTTP status だけでは成否を判定できない**。
- **P5（新発見・②-Aの潜在ギャップ／本工程で解消）**：`deleteCaseFromServer` が **HTTP status のみ**で判定していたため、Supabase障害時に `HTTP 200 + ok:false` を**成功と誤判定 → localから削除 → DBは未削除 → 次回同期の merge で案件が復活**する穴があった（「削除したのに復活する」＝Close済み不具合の再現条件）。

### 実装（A案採用・Decision 063）
- **`_postCaseOnce(body)` 新規**：POST 1回分。**成功 = `res.ok` かつ JSON解析成功 かつ `data.ok === true`** の3条件（**POST成功確認・JSON `data.ok` 確認**）。4xx=`client`（再送しない）／5xx・200+`ok:false`=`server_ok_false`／通信失敗=`network`。
- **`pushCaseToServer(caseId, opts)` async契約化**：`{ ok, status, reason }` を返す（`deleteCaseFromServer` と同形）。**5xx・通信失敗・200+`ok:false` のみ最大1回再送**（合計2回・無限再試行禁止）／**4xxは再送しない**／**local案件は成否に関わらず常に保持**（作成はユーザーの意図した事実・POST結果で消さない）／`opts.notifyOnFail` の時のみ通知。
- **`_notifyCasePushFailed(name)` 新規**：**案件作成時の同期失敗のみ通知**（`createCase` から `{ notifyOnFail:true }`）。**`touchCase` 経由は通知しない**（毎メッセージ発火＝通知スパム防止）。
- **`createCase()` は同期関数のまま**（await しない＝UIをブロックしない）。`touchCase()` は**無変更**。
- **DELETE側（P5解消）**：**404 を先に判定**（本文が `ok:false` のため）→ local-only として成功／それ以外は **`res.ok` かつ JSON解析成功 かつ `data.ok === true`** のみ成功／**200+`ok:false`・5xx・通信失敗は失敗＝localを保持して既存通知**。

### 確認（localhost・本番とも fetchスタブ／**実DBへのテストデータ作成なし**）
- POST：200+ok:true=1回・通知0／200+ok:false=**2回**・通知1／**400=1回（再送なし）**・通知1／500=2回・通知1／通信失敗=2回・通知1／**touchCase経由=通知0**／再送で成功（500→200）=ok。**全ケースで local保持**。
- DELETE：200+ok:true=成功／**200+ok:false=失敗・local残存**／404=成功（local-only）／500・通信失敗=失敗・local残存。
- **最大試行回数2回以内**（POST最大2／DELETE最大1）／`node --check` 0エラー／**dev-check 200/200/200**／**console 0**（localhost・本番）。
- **本番反映済み**：Render自動デプロイ・トップ200・配信コード一致（旧 fire-and-forget／旧DELETE判定は**残存0件**）。
- **データ保護**：本番DB **生存1／削除済み2／合計3行**＝Close時点と一致＝**無変更**。localStorage も復元一致。

### 効果
- **local-only案件の再発防止**：一過性の通信断は**自動再送で救済**、恒久的失敗は**ユーザーが即座に認知**できる。
- **P5解消**：Supabase障害時に削除が黙って失敗し案件が復活する事故を防止（今後は**localを保持して通知**）。

### 状態・次工程
- **Phase54 Complete維持**／**Phase55未着手**／Case同期系＝**成功確認契約 適用済み**。
- **次工程候補（未着手）**：① **Phase54 Hotfix の Task側 PC⇔iPhone 実機確認**（未実施）／② **Case同期契機の改善**（現在は起動時1回のみ＝他端末の削除反映に相手端末のF5が必要・`visibilitychange` 等）／③ **Phase55判断**。

---

## 案件系Known Issue **全Close**（2026-07-17・Case同期系Complete・本番反映済み・PC⇔iPhone実機確認済み）

- **位置づけ**：**Phase54 正式Complete は維持**（tag `v1.01-phase54-complete` 不変）・**Phase55 未着手**。Phase54完了後にユーザー本番実機で顕在化した**案件（Case）系**Known Issueへの恒久対応。**Task同期系とは別工程**。
- **不具合① 案件自動増殖 — 解消済み**（commit **f36762c**・tag `v1.01-phase54-known-issue-case-auto-create`・index.htmlのみ4行）
  - 原因：`handleLeaderDispatch()` が振り分けのたびに無条件で `createCase(userText,…)` を呼び、dedupキーが送信本文だったため**会話1ターンごとに新案件が生成**されていた。
  - 修正：`_ncActiveCaseId('leader') || null` へ変更＝**案件選択中は現在案件を継続／未選択・最新一覧・案件一覧は `caseId=null` の横断扱い・自動生成しない**（Decision 060）。併せて横断Taskタイトルの `[undefined]` 防止、案件未選択時の `saveCaseMemory` 先頭案件フォールバック停止、`touchCase` 先頭案件フォールバック停止。
  - **案件作成は「新規案件」操作（`createNewCaseFromForm`）のみ**。`createCase()` 本体は無変更。
- **不具合②-A Case削除同期 — Complete**（commit **ad83544**・tag `v1.01-phase54-known-issue-case-delete-sync`・4ファイル）
  - 原因：物理DELETEでDB行が消えるため tombstone が無く、`mergeServerCases` が他端末の削除を知る手段がなかった（＝削除が永久に伝播しない）。
  - 修正：**`cases.deleted_at` による論理削除＋`deletedIds` によるServer正本化**（Decision 061）。**物理削除禁止**・**local-only案件保護**・**削除は成功後のみlocal反映**（200/冪等200/404=local削除可／5xx・通信失敗はlocal保持＋通知）・削除4経路すべて同一契約へ統一。
  - **SQL（ユーザー実行済み・非破壊）**：`ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;` ＋ `CREATE INDEX IF NOT EXISTS idx_cases_deleted_at ON cases (deleted_at);`
  - **PC⇔iPhone双方向の削除伝播をユーザー実機確認済み**。
- **②-B-1 案件診断 — 実施済み**（commit **7c7d6ff**・tag `v1.01-phase54-known-issue-case-diagnosis`・index.htmlのみ+226・読み取り専用）
  - `GET /api/cases` のみ発行（POST/PATCH/DELETE 0件）・localStorage 不変・実行系ボタンなし。**PC・iPhone双方で実施済み**。
- **実機確認の実測値（PC・iPhone双方で完全一致）**：
  - **DB 生存 1 件／DB 論理削除済み 2 件**（合計3行が残存＝**物理削除なし**）
  - **PC local 1 件／iPhone local 1 件** ＝ **DB生存 = PC = iPhone の三者一致**
  - **local-only 0 件／Review 0 件／Remove候補 0 件**
- **②-B-2 Backfill：対象なしのため未実装Close**（local-only 0件＝backfill不要・Decision 062）
- **②-C 残骸整理：対象なしのためClose**（Remove候補 0件＝整理対象なし）
- **`DEBUG_CASE_DIAG = false`**（本番の「🔍 診断」ボタン非表示）／**診断ロジックは削除せず温存**（再調査時は `true` で復活・PhaseD-1 の `DEBUG_TASK_SYNC` と同方式）
- **保護（不変）**：`messages`／`conversations`／`task_history`／Learning は**非連動・非削除**（履歴保護維持）／`createCase()` 本体／`createNewCaseFromForm()`／Task同期・Task History・Notification・Timeline・Approval・Output Draft・Provider・Routing・Cost・Phase53 **非接触**。
- **状態**：**Case同期系Complete**・**Phase54 Complete維持**・**Phase55未着手**。
- **次工程候補（未着手・別工程）**：① `pushCaseToServer` 成功確認化（作成側は現在も fire-and-forget＝POST失敗時に local-only 案件が再発し得る）／② Phase54 Hotfix の **Task側** PC⇔iPhone 実機確認（未実施）。その後 Phase55 判断。

---

## Phase54 Known Issue（PC⇔iPhone Task表示不一致）**Closed**（2026-07-16・archived/caseId Server正本化・本番反映済み・HEAD a5bbe27）

- **位置づけ**：**Phase54 正式Complete は維持**（tag `v1.01-phase54-complete` 不変）・**Phase55 未着手**。Phase54完了後にユーザー実機で顕在化した **Task同期 Known Issue** への恒久対応（PhaseA-0〜D-1）。
- **修正前**：PC badge47/ホーム案件11・iPhone badge13/ホーム案件1（GET /api/tasks=233・GET /api/cases=1）。
- **原因**：Task field merge が単一 `updatedAt` の newer-wins だったため、iPhone localStorage の古い `archived`（52件）と端末ローカル `caseId` が Server同期後も温存され、PCとiPhoneで可視Task集合が不一致。
- **修正**：
  - **PhaseC-1**：dbId一致Taskの `archivedAt` を **Server正本化**（newer-wins非依存）・commit **0ed68e4**・tag `v1.01-phase54-known-issue-c1`
  - **PhaseC-2**：dbId一致Taskの `caseId` を **Server正本化**・commit **6f0816a**・tag `v1.01-phase54-known-issue-c2`
  - **local-only Task（dbIdなし）は保護**／rich status・newer-wins本体・deleted同期・backfill・件数統一は維持
  - **PhaseD-1**：診断コードは削除せず `DEBUG_TASK_SYNC=false` で本番非表示化・commit **a5bbe27**（tagなし）
- **最終確認（本番・実機）**：total**233**・archived**1**・todo**232**・NULL caseId**70**・caseIdあり**163**・**PC view/badge 69/69**・**iPhone view/badge 69/69**（PC=iPhone一致）・Task件数減少なし・backfill POST増加なし・Render API正常・診断表示は本番UIで非表示。
- **調査工程**：PhaseA-0（同期診断＋showApp同期・commit 5f23cf1）→ PhaseA-1（分布診断・commit 76d0582）→ PhaseA-2（原因確定・設計）→ PhaseC-1 → PhaseC-2 → PhaseD-1。
- **次工程**：**Phase55未着手**。次工程はユーザー承認後に決定。

---

## Phase54 Hotfix — Task同期/削除同期/アーカイブ同期/backfill安全化/Task生成上限 **本番反映済み**（2026-07-14・Phase54完了後Known Issue対応・commit d512bad・tag v1.01-phase54-hotfix-task-sync）

- **位置づけ**：**Phase54 正式Complete は維持**（既存 tag `v1.01-phase54-complete` 不変）・**Phase55 未着手 は維持**。本件は Phase54 完了後にユーザー実機で顕在化した **Task同期 Known Issue** への Hotfix。
- **Known Issue（記録）**：Task削除がPC⇔iPhoneで同期されない／削除がF5・再ログイン・案件切替で復活／Task一覧・Progress・バッジの件数定義不一致／backfillによる重複再登録。調査中に **backfillによるTask急増（75→354）** と **Task生成10件制限** も判明。
- **Git**：commit **d512bad**（`Phase54 hotfix task sync archive and backfill safety`・4ファイル：`index.html`/`server.js`/`lib/tasksDb.js`/`supabase/schema.sql`）・tag **v1.01-phase54-hotfix-task-sync**。**HEAD = origin/main = tag = d512bad**・**Render反映済み・本番確認済み**。
- **実装内容**：
  - 削除同期：`tasks.deleted_at`（論理削除・**物理削除しない**）＋`PATCH {deleted:true}`／dbId限定 Server-Authoritative Reconciliation／local-only保護
  - アーカイブ同期：`tasks.archived_at`＋`PATCH {archived:true|false}`（復元可・PC⇔iPhone同期・**Task History/Learningは残す**）
  - backfill安全化（B案）：server同期完了後1回・in-flight lock・dbIdなしのみ・deletedSignatures照合・archived除外・local重複除外・成功後即dbId反映・失敗再試行なし・**POST安全上限20（超過は自動停止＋通知＝フラッド防止）**
  - 件数統一：一覧／Progress／バッジを **同一可視集合（現在案件＋NULL・deleted除外・archived除外）** で計算
  - Task生成上限：`/api/auto-task` **10→20**（`MAX_AUTO_TASKS=20`・無限ループ防止は維持）・**backfill上限とは別管理**
- **データ整理（本番DB）**：重複候補 **123件を JSON/CSV 退避後に `deleted_at` で論理削除**（id限定・物理削除なし）。**生存Task 233件／deletedIds 125件**。**元75件・正当候補156件は保護（全生存）**。検証用 **arch-1=通常／arch-2=アーカイブ** 状態で残置。**正当候補156件の個別整理は未実施**。
- **退避・除外**：`backup-dup-candidates-20260714/`（123件JSON/CSV）は **ローカル退避・Git対象外**。**cost関連3ファイル（cost-logs.json/claude-cost-logs.json/claude-quality-history.json）は対象外・未操作**。
- **確認状況（区別）**：
  - **実装済み**：上記コード4ファイル
  - **localhost確認済み**：dev-check 200/200/200・console 0・削除/アーカイブ/冪等/404/400・件数一致・backfillフラッド防止・F5維持
  - **本番確認済み**：Render（top 200・GET /api/tasks 200・total 233・deletedIds 125・archived_at含む・arch-1 NULL/arch-2 NOT NULL・21件→400「最大20件」・console 0）
  - **ユーザー実機確認：未実施**（PC⇔iPhone双方向の削除/アーカイブ/復元 同期の実機確認は今後）

---

## Phase54 Remaining Realtime Sync **正式Complete**（2026-07-14・最終統合確認合格・tag v1.01-phase54-complete）

- **Phase54全体成果**：3a Task Basic Sync → 3a-2 Task Case Scoping → 3b-1 Task History Persistence → 3b-2 Task History Case Scoping → 3b-3 Notification既読永続化＋Timeline案件別＋Workflow Live復元 → **最終統合確認** すべてComplete
- **最終統合確認結果（localhost＝サーバー再起動直後＋本番）**：
  - **案件分離**：Task A/B分離（実オブジェクト）・Task History `?caseId`厳密（A=Aのみ/B=Bのみ）・Timeline A/B分離・**NULL/空横断データ全view維持**（Task 55件・履歴・timeline空event）
  - **Approval/Draft**：案件別GET混入なし（approvals/output_drafts とも case_id一致行のみ）・review_state列復元・復元関数群健在（scheduleOutputDraftRestore/scheduleApprovalSync/mergeApprovalStateFromServer/_applyReviewStateFromServerRow）
  - **Task**：DB60件維持（減少なし）・dbId重複0・状態変更/描画正常
  - **Task History/Notification**：再起動直後（メモリ空）にDB復元12件・重複0／既読DB復元6件・重複0・**PC⇔iPhone双方向既読同期はユーザー実機確認済み**・F5/再ログイン維持
  - **Timeline/Workflow Live**：Timeline119event描画・案件分離・横断維持／Live既存進行中経路健在（workflow-progress ok）＋progress消失時のtask_historyフォールバック復元（本文なし＝仕様どおり）
  - **回帰**：Conversation/Messages（50件・case_id付き復元・restoreHistory ok）・loadNotifications/loadWorkflowDashboard/renderWorkflowLive/renderTaskList ok・ログイン/ログアウト/ホーム/案件切替関数健在・console 0・dev-check 200/200/200
  - **本番**：tasks 60／task-history 12(dup0)／workflow-dashboard 7／notification-reads 6(dup0)／caseId厳密フィルタ 全正常
- **Known Issue（継続）**：Edge（Windows・表示倍率125%）Taskスクロールバー判定ずれ（軽微・UIリファイン時再調査）
- **次工程**：**Phase55候補整理 または Version1.1残課題確認**（Cost同期=別工程・Learning残buffer=Version2候補・回答本文のtask_history保存=候補）。**Phase55実装は未着手**

---

## Phase54-3b-3 Notification既読永続化・Timeline案件別・Workflow Live復元 **Completed**（PC/iPhone実機確認済み・commit 3e3c432・tag v1.01-phase54-3b-3）

- **現在Phase**：**Phase54-3b-3 Completed**（PC→iPhone／iPhone→PC 既読双方向同期・F5/再ログイン維持・本番表示操作 ユーザー実機確認済み）
- **3b-3a Notification既読DB永続化**：新規 `notification_reads`（`history_id` PK・`case_id`・`seen_at`・`created_at`）＋`lib/notificationReadsDb.js`（`getSeenIds{caseId,limit}`／`markSeen`・history_id冪等）＋`GET/POST /api/notification-reads`（GET limit対応・既定1000/上限5000）。client：`showApp`（起動/再ログイン）で既読復元→`_notifSeenIds`反映・click/markAllでDB保存（即時UI維持）。**単一共有アカウント(web-user)でPC/iPhone間既読同期基盤完成**
- **3b-3b Timeline案件別表示**：`_timelineEventVisibleInView`＋`renderTimeline` フィルタ。現在案件event＋**NULL/空の横断event表示**／別案件case付きは非表示／ホーム・未選択は横断のみ（クライアント全event保持・表示時のみ絞る）
- **3b-3c Workflow Live復元**：`wlProgressPoll` が progress有り時は既存Live優先／**found:false時のみ** `_wlRestoreFromHistory` で task_history から静的復元（担当・action・status・caseId・開始/完了時刻。**回答本文は対象外**）
- **既存APIレスポンス形不変**（`{ok,history,total}`／`{ok,workflows,total}`／新規 `{ok,seenIds,total}`）／task_history Hybrid/dedup・3b-2案件分離 非接触
- **実DB確認**：既読 POST/GET・**冪等（重複行0）**・limit・空POST400／`_notifSeenIds`復元（F5/再ログイン相当）／Timeline A/B分離＋NULL/空横断維持／Workflow Live復元（本文空）／既存consumer回帰なし（loadNotifications/loadTimeline 122event/workflowDashboard/renderWorkflowLive）／console 0／dev-check 200/200/200
- **本番確認済み（Completed）**：push・Render反映・本番API（notification-reads GET/POST/limit/冪等・形不変）確認済み → **ユーザー実機確認済み（PC→iPhone／iPhone→PC 通知既読同期・F5/再ログイン後も既読維持・本番表示操作正常）** ⇒ **Phase54-3b-3 Completed**

---

## Phase54-3b-2 Task History Case Scoping **Completed**（Task History案件別分離完成・push済み・Render反映済み・本番/ユーザー実機確認済み・commit b5ab89d・tag v1.01-phase54-3b-2）

- **現在Phase**：**Phase54-3b-2 Completed** ／ origin/main = **3a95691**（code b5ab89d＋docs 3a95691）・tag **v1.01-phase54-3b-2**（→ b5ab89d）
- **目的**：Task History を案件単位で保存・取得・表示分離。**Phase54-3b-1（永続化基盤）は Completed**
- **実装（commit b5ab89d・2ファイル・+29/-12）**：
  - `index.html`：`/api/auto-task`・`/api/consult` POST に `caseId: getCurrentApprovalCaseId() || null` 送信／`_historyVisibleInView`（NULL横断は常時表示・case付きは現在案件のみ）＋`renderNotifications` に案件別表示フィルタ
  - `server.js`：auto-task・consult で `caseId` 受領→生成履歴各行へ保存（`h.caseId == null` のときのみ＝既存値尊重）／`_hybridTaskHistory` に任意caseIdフィルタ／GET `/api/task-history`・`/api/workflow-dashboard` に任意 `?caseId=`
- **仕様**：**引数なしGET＝全件**（クライアント全保持・Hybrid/dedup維持）／`?caseId=X`＝該当案件のみ厳密（NULL含まず）／NULL横断はクライアント表示側（`_historyVisibleInView`）で担保＝案件画面＝該当案件＋NULL横断／ホーム・未選択＝NULL横断のみ
- **保護**：既存APIレスポンス形不変（`{ok,history,total}`／`{ok,workflows,total}`）／3b-1のHybrid/dedup維持／`global.__taskHistory`維持／Learning(refreshLearningPanel)は全社で据え置き／Workflow Live(aiLivePoll)はworkflowId scopedで既存維持・大幅変更なし／Approval・Output Draft・tasks.case_id・Provider・Routing・Cost 非接触・**新規SQL/DB変更なし**
- **確認済み（localhost・実DB・commit b5ab89d）**：
  - consult(caseId)：entry.caseId保存・GET`?caseId`厳密・appearOnce=1
  - **Auto Task実ワークフロー1回**（案件A・実AI）：生成6行**全て case_id=A**・history_id重複0・GET`?caseId=A`→6/`?caseId=B`→0・NULL横断存続・**Notification実描画 案件A=6件/案件B=0件**・workflow-dashboard形不変＋`?caseId`フィルタ（Aに出現/Bに非出現）
  - サーバー再起動後も case_id 維持（DB復元・dup 0）／既存consumer回帰なし（loadNotifications/learningPanel/workflow-dashboard）／console 0／dev-check 200/200/200
- **検証テスト行（DB残存・識別可能・非活性・削除しない）**：`zzz-3b2-A/B/NULL`＋実consult/実Auto Task行（wf-3b2consult / wf-3b2autotask-*）
- **本番反映・確認済み（Completed）**：push（`6d1f5b6..3a95691`・cost非混入）→ Render自動デプロイ反映（新コード稼働＝本番`?caseId=`フィルタ動作）→ 本番API確認（task-history/workflow-dashboard 200・レスポンス形不変・caseId付き履歴DB取得・重複0・`?caseId`厳密・console 0）→ **ユーザー実機確認済み（案件A専用履歴が他案件へ混入しないことを確認）**
- **F5／再ログイン／再起動後もDB永続**（case_id保持）／**NULL横断履歴維持**／**Notification案件分離確認済み**／**Workflow Live・Timeline回帰なし**
- **次工程**：**Phase54-3b-3**（候補：Timeline案件別表示の最終確認／Notification未読永続化／Workflow Live Restore／必要範囲の仕上げ）。**未着手**

---

## Phase54-3b-1 Task History Persistence **Completed**（Task History永続化基盤・commit 2e4b0fc・tag v1.01-phase54-3b-1・push済み・Render反映済み・本番API確認済み）

- **現在Phase**：**Phase54-3b-1 Completed** ／ origin/main = **6d1f5b6**（code 2e4b0fc＋docs 6d1f5b6）・tag **v1.01-phase54-3b-1**（→ 2e4b0fc）
- **目的**：`global.__taskHistory`（サーバーメモリ・非DB・Render再起動で消失）を新規 `task_history` テーブルへ永続化 → Timeline/Notification/Workflow Live/Auto Task/Live Status の再起動復元基盤。**今回は永続化基盤のみ（case_id配線・UI変更は3b-2以降）**
- **SQL実行済み（ユーザー）**：`CREATE TABLE task_history`（`history_id TEXT NOT NULL UNIQUE`・`case_id TEXT` nullable/FKなし・`status TEXT` CHECKなし・`meta JSONB`）＋3 index＋冪等RLS。Supabase作成成功
- **変更ファイル（commit 2e4b0fc・3ファイル・+195/-8）**：
  - `supabase/schema.sql`：`task_history` 正式定義（CREATE＋3 index＋冪等RLS DO$$）追記
  - `lib/taskHistoryDb.js`（新規）：`upsertHistoryEntry`／`upsertHistoryEntries`／`getHistory`（`history_id` 冪等upsert・app↔DBマッピング・可変fieldは `meta JSONB` 退避/復元）
  - `server.js`：遅延require＋`_persistTaskHistory`（fire-and-forget・非ブロック・失敗でWorkflow停止しない）＋`_hybridTaskHistory`（メモリ＋DB・`history_id` dedup・メモリlive優先）／auto-task・consult push時にDB保存／`GET /api/task-history`・`/api/workflow-dashboard` をHybrid化
- **既存APIレスポンス形 不変**：`{ok,history,total}`／`{ok,workflows,total}`・from/to filter維持・新規エンドポイントなし・既存API削除/置換なし
- **保護**：`global.__taskHistory` 従来維持／status改善せず（CHECKなしTEXT）／case_idは本工程常にNULL（横断）／polling/WebSocket追加なし／Approval・Output Draft・tasks.case_id・NULL横断Task・Workflow・Provider・Routing 非接触
- **実DB確認済み（SQL実行済み・commit 2e4b0fc）**：
  - round-trip（保存→取得→**meta復元** responseMs/ruleCount）／`history_id` 冪等upsert（running→completed で**重複行0・単一行更新**）
  - Hybrid(DB+Memory)：実consult1回でmemory＋DB dedup（**appearCount=1**・memory live優先）
  - **サーバー再起動復元**：2回再起動後もDBから履歴復元（lib挿入＋実consultの2件・dupInGet 0・workflow-dashboard集約）
  - DB未作成でも従来動作（graceful・throwなし）／既存consumer回帰なし（loadNotifications ok）／console 0／dev-check 200/200/200
- **検証テスト行（DB残存・識別可能・非活性・DELETE未実施＝削除禁止順守）**：`zzz-3b1-rt-*`（wf-3b1test）＋`consult-1783955050504-p53pn`（wf-3b1consult）
- **本番反映・確認済み（Completed）**：push（`47d7417..6d1f5b6`・cost非混入）→ Render自動デプロイ反映（新Hybridコード稼働＝本番GETがDB履歴を返却）→ **本番API確認済み**（`/api/task-history`・`/api/workflow-dashboard` 200・レスポンス形不変・DB履歴取得・重複0・from filter動作・console 0）→ **Render再デプロイ後（新規インスタンス＝メモリ空）もDB履歴復元を確認**（本番再起動復元成立）
- **次工程**：**Phase54-3b-2**（`case_id` client配線・案件別履歴・GET `?caseId`任意フィルタ・消費側案件別表示）

---

## Phase54-3a-2 Task Case Scoping **Completed**（案件別Task分離・A案・push済み・Render反映済み・本番PC確認済み・ユーザー実機確認済み・commit bc98455・tag v1.01-phase54-3a-2）

- **現在Phase**：**Phase54-3a-2 Completed** ／ origin/main = **4372576**（code bc98455＋docs 4372576）・tag **v1.01-phase54-3a-2**（→ bc98455）
- **採用＝A案（Decision 054）**：`tasks` へ **nullable `case_id TEXT`（FKなし・既存行NULL維持）**。**`messages.case_id` 踏襲・追加のみ・非破壊**。**Task Case Scoping 完成＝案件別Task分離完成**
- **SQL実行済み（ユーザー実行）**：`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS case_id TEXT;` ＋ `CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON tasks (case_id);`
- **表示仕様**：案件画面＝該当案件Task＋`case_id=NULL`横断Task／ホーム・案件未選択＝`case_id=NULL`横断Taskのみ。**既存55件はNULLのまま温存・非破壊・非表示/強制分類なし（NULL横断Task維持）**
- **変更ファイル（commit bc98455・4ファイル・+72/-20）**：
  - `supabase/schema.sql`：tasks CREATEに `case_id TEXT` 追記＋ALTER/index冪等コメント
  - `lib/tasksDb.js`：`createTask` caseId受領（非null時のみ列送信）・`getTasks` 任意caseIdフィルタ（既定全件）
  - `server.js`：POST `/api/tasks` caseId受領／GET `/api/tasks` 任意caseId query（**既定全件維持**）／PATCH変更なし
  - `index.html`：`syncTaskToServer` caseId送信・`_taskFromServerRow` case_id map・merge反映・`_ensureTaskCaseId`/`_taskViewCaseId` 追加・全Task作成経路へcaseId配線・`renderTaskList` 案件別フィルタ・switchCase/_homeOpenCase/goHome にパネル再描画フック
- **保護**：**`_taskSignature` 不変**（title¦memberId¦sourceMessage¦body）／GET既定全件（backfill契約維持）／既存local-only TaskへcaseId強制付与しない／status CHECK非対象（3b以降）／Approval・Output Draft・Review State・Conversation・Messages・Workflow・Timeline・Notification・Learning・Cost・Phase53 非接触
- **localhost確認結果（SQL実行済み・commit bc98455）**：`tasks.case_id` 実DB存在／caseId付き保存・NULL保存・GET全件・GET?caseId=フィルタ／案件A/B分離（実DOM）・NULL横断（既存55件全view表示）・F5維持・**実ログアウト→再ログイン→案件A/B分離（実DOM）**／backfill重複POST 0・dbId重複0・既存55件減少なし・DB60件・console 0・dev-check 200/200/200
- **本番反映・確認済み**：push（`a71ca79..4372576` fast-forward・cost非混入）→ Render自動デプロイ反映（新server.js＝GET`?caseId=`サーバーフィルタ稼働・新index.html＝新関数稼働・GET正常・エラーなし・Render設定/環境変数変更なし）→ **本番PC確認済み**（案件A/B分離・NULL横断・F5・再ログイン維持・重複なし・既存減少なし・console 0）→ **ユーザー実機確認済み**
- **検証テスト行（識別可能・非活性・温存＝削除しない）**：`ZZZ-TEST3a2-A/B/NULL`（案件A/B合成id・NULL）＋`ZZZ-RELOGIN-A/B`（実案件A `case-mrc0zr7w0w4k`／実案件B `case-mrc0zyatv78y`）
- **Known Issue（継続・非修正・従来どおり維持）**：Edge（Windows・表示倍率125%）Taskスクロールバー判定ずれ（軽微・UIリファイン時再調査）
- **次工程**：**Phase54-3b Task History Persistence**（`global.__taskHistory` を新規 `task_history` テーブルへDB化・**推奨=案A：`task_history` 自身に nullable `case_id` を保持**・詳細Live Statusはここ・要SQL・未着手）

---

## Phase54-3 Remaining Realtime Sync（残Realtime Sync完成工程・Version1.1「PC⇔スマホ同一AI会社」直結）

- **現在Phase**：**Phase54-3a Completed（Known Issueあり）** ／ 次は **3a-2 Task Case Scoping**（未着手）
- **Phase54-2 Complete**（Output Draft Persistence＋Mobile Review State Persistence・commit f0f382f・tag v1.01-phase54-2f・push済み・Render反映済み・本番確認済み）

### Phase54-3a 結果：Completed（Known Issueあり）
- **Task Basic Sync**（commit dc439d5・tag v1.01-phase54-3a）：`GET /api/tasks` を pull・merge。PC⇔スマホでTask集合が一致
- **3a-fix Task完全収束**（commit e96bdaa）：全Task作成経路を `syncTaskToServer` へ配線＋起動時 `backfillLocalOnlyTasks`（ローカルのみTaskを削除せずサーバーへ押上げ・冪等・署名重複防止）。**PC/iPhone 55件で一致・本番実機確認済み**
- **UI-A Task操作性改善**（commit 4e56b44 / ddc1c81 / af4ab80 / 82674b9）：PCスクロールバー改善・選択ツールバーコンパクト化（`N件選択中`＋短縮ボタン）・**最終は標準ネイティブスクロールバー（`scrollbar-width:auto`＋`scrollbar-color`）へ一本化**（見た目=ヒット判定の統一）。index.htmlのみ・CSS中心
- **Known Issue（修正継続しない）**：**Edge（Windows・表示倍率125%環境）でTaskスクロールバーのヒット判定が見た目より数px左へずれる場合がある**。ホイール／タッチパッド2本指／キーボードスクロール／Task操作／iPhone は**すべて正常**。実運用への影響は軽微のため **Version1.1開発を優先し、UIリファイン時に再調査対象**とする
- 非接触：Task同期/バックフィル/並び順/本文表示条件/Approval/Draft/review_state/Conversation/Case/Messages/server.js/lib/DB/API/cost
- **目的**：Task/Status/Auto Task/Timeline/Notification/Workflow Live の端末間同期を完成し、Version1.1「PC/iPhoneで同じAI会社」を満たす
- **Phase分割**：
  - **3a Task Basic Sync**（今回・実装済み・localhost確認済み）＝**全社共通Taskの基本同期**（`tasks` 全件pull・基本status 3値・案件分離なし）
  - **3a-2 Task Case Scoping**（案件別Task分離＝`tasks.case_id` A案・**未着手**）
  - 3b Task History Persistence（`global.__taskHistory` のDB化・**詳細Live Statusはここで扱う**・**未着手**）
  - 3c Notification Unread / Workflow Live Restore（**未着手**）
  - 3d Version1.1 Sync Final Verification（**未着手**）
  - **Cost同期＝別工程**（cost系3ファイル温存・server-globalで端末非依存に共有済み・Version1.1必須ではない）
  - **Learning残部分（in-memory buffer）＝Version2候補**（主要はDB化済み）

### Phase54-3a Task Basic Sync（Completed・push済み・Render反映済み・本番確認済み／詳細実装記録）
- **スコープ**：**全社共通Taskの基本同期のみ**（`tasks.status` は基本3値 pending/in_progress/done）。**案件別Task分離は含めない → 3a-2 Task Case Scoping で扱う**。**詳細Live Status（working/reviewing等）は task_history 側（3b）で扱う**
- **内容**：既存 `GET /api/tasks`（DB由来）をクライアントが起動時・案件切替時・ホーム案件を開いた時に pull・merge。**index.htmlのみ・DB/API/SQL変更なし・新規pollingなし**
- **追加関数**：`syncTasksFromServer`／`_taskFromServerRow`／`_mapServerTaskStatus`（`_taskSyncInFlight` ガード）
- **merge安全規則**：dbId(サーバーUUID)で重複排除／未存在Taskのみ追加（他端末作成Task表示）／同一Taskはサーバー `updated_at` が厳密に新しい時のみ採用／localのみ(dbIdなし)Task保持／取得失敗・空レスポンスで既存を削除しない／localStorageはキャッシュ維持
- **重要制約（既知）**：クライアントstatus語彙（todo/working/reviewing等10種）と `tasks.status` CHECK（pending/in_progress/done 3種）が不一致。rich statusのPATCHはCHECK違反で失敗＝`updated_at` が進まないため、pull時に**rich statusを降格しない**（＝既存を壊さない）。完全な双方向status統一は 3b 以降で扱う
- **localhost確認**：起動pullでサーバー22件merge（pending→todo/done→done写像）・dedup重複なし・空/失敗で既存維持・in-flightガードで重複GET 1回・newer-wins採用＋rich status保護・F5後22件復元・回帰（Approval/Draft/review_state/Case/Notification関数健在）・console 0・dev-check 200/200/200
- **完了**：commit dc439d5＋3a-fix e96bdaa＋UI-A(4e56b44/ddc1c81/af4ab80/82674b9)・tag v1.01-phase54-3a・push済み・Render反映済み・本番実機確認済み（**Known Issue: Edge125%スクロールバー判定ずれ・軽微・再調査対象**）

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
