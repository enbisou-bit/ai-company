# PHASE_PROGRESS.md

> ENBISOU AI COMPANY 開発進捗管理書
> 更新日: 2026-08-28（**APFR Compliance Restrictions deterministic化 ─ Not Required 正式化（Decision108追記・docs-only stage-1）**。前工程のread-only調査（Opus・C-1系列 read-only）により、`complianceRestrictions` をdeterministic Compliance Detectorへ直接利用する設計は不適切と確定したため、**APFR Compliance Restrictions deterministic化＝Not Required（Detectorを新設しない）として正式化**した（**判定C**：deterministic対象は `listingNgWords` へ責務分離する）。**実測根拠（実案件プラファストの `complianceRestrictions` 実値）**：`A8.netのルール遵守`／`広告表示必須`／`法律関連の禁止事項遵守`／`リスティング違反禁止` の**4値すべてが単純禁止語ではなく directive／obligation／自然言語制約**であり、Type A（単一禁止語）・Type B（禁止フレーズ）の実データは0件。**substring実測（既存 `evaluateComplianceGate()` と同一の NFKC→lowercase→trim→substring 方式を仮適用）**：①残存表現（`#敏感肌`／「自然由来」／「肌に優しい」）の検出＝**0件（false negative 100%）**／②正しいCompliance遵守表明「A8.netのルール遵守のうえ作成」＝`violation` 誤検出／③正しい広告開示「広告表示必須の規定に従い【広告】と明記」＝`violation` 誤検出／④`広告表示必須` は禁止表現ではなく **positive obligation** であり「存在したら違反」となる substring detector では**意味が逆転**する。この時点で直接Detector化は不採用。**Source of Truth 責務分離（正式維持）**：**`listingNgWords`＝deterministic禁止語のSource of Truth**（閉じた語彙・既存 `evaluateComplianceGate()`）／**`advertisingDisclosureRequirements`＝開示義務trigger**（自然文値そのものを substring 検索せず、Formal Truth値の存在をtriggerに別途定義した閉じたmarker集合〔【広告】／【PR】／#広告／#PR／#プロモーション／定型文〕を検査する C-1C-1b whitelist marker detector）／**`complianceRestrictions`＝自然言語Compliance制約のSource of Truth**（既存 C-1B prompt injection で Writer／Reviewer へ伝達・semantic判断は AI／Reviewer の責務）／**`regulatoryCategory`＝参考情報**（カテゴリ名から追加の法令・規制を推測しない）。**C-1C-1 既存判断は変更しない**：「deterministic対象は `listingNgWords` のみ／`complianceRestrictions`・`regulatoryCategory`・`listingPolicy` は自然言語・意味的判断を要するため機械Gate化しない」という正式判断は、今回の実データ調査でも正しかったと確認された。**`advertisingDisclosureRequirements` が C-1C-1b で deterministic 化済みなのは自然文値そのものの substring 検索ではなく別 whitelist 方式のため、同じ成功パターンを `complianceRestrictions` へそのまま適用できない**。**残存3表現（`#敏感肌`／「自然由来」／「肌に優しい」）は現在の Formal Truth だけでは deterministic に NG 判定不能**（`listingNgWords` 一致なし・`complianceRestrictions` 一致なし・`regulatoryCategory` から法令知識を推測することは禁止・semantic判断が必要）。**C-3-1 Grounding Detection＝Not Required と今回の Compliance Restrictions deterministic化＝Not Required により、残存3表現は Grounding側・Compliance側の双方で安全な機械判定が成立しない**ことが確定。現状は Option F／Reviewer 等の AI 側責務に残す。**Compliance Assessment 変更0**（`_apfrEvaluateComplianceAssessment()` へ新Detectorを追加しない）。**Mobile Approval 変更0**（既存spine「Compliance Assessment blocked→Mobile Approval不可→Publishing Ready不可→markInstagramPublished不可」を維持）。**Quality Gate 変更0**（`complianceRestrictions` を `evaluateQualityGate()` へ接続しない）。**READY 変更0**（`complianceRestrictions` を `OUTPUT_STATUS.READY` へ接続しない）。**新規観察事項（別課題・今回は修正しない）**：実案件 `listingNgWords = ['商品名', '法人名']` は「Instagram投稿本文の禁止語」というより「リスティング広告における商品名・法人名キーワード入札禁止カテゴリ」を意味している可能性があり、現行 C-1C-1 detector が Instagram 成果物本文へ substring 検索する適用先との間に**チャネル意味ズレの可能性**がある。**今回この意味ズレは修正しない**（`listingNgWords` の意味変更／field rename／schema変更／detector変更／scan対象変更／ASPデータ変更／既存Fact訂正は禁止）。別課題としてのみ記録する。**Option D（deterministicに止めたい語句は `listingNgWords` へ登録する）の責務原則自体は維持候補だが、現在の `listingNgWords` field が Instagram 投稿用禁止語を正式に保持する Contract なのかは未確認のため「Option D 完全採用」とはまだ記録しない**。正式記録は「`complianceRestrictions` detector＝Not Required／deterministic禁止語の既存SoT＝`listingNgWords`／`listingNgWords` のチャネル意味定義には別途確認事項あり」までとする。**Decision**：新規Decision番号は作成せず Decision108 へ追記（本調査は APFR／Compliance Contract の責務境界の設計判断のため）。**Decision109（Mobile Approval Compliance Enforcement Contract）は変更なし**。**今回は docs-only stage-1（Code変更0・test変更0・DB変更0・AI API実行0・push未実施・新規Tag 0・Render操作0）**。**「Compliance Complete」「Compliance Enforcement Complete」とは記録しない**——正式意味は「調査の結果、`complianceRestrictions` の deterministic Detector 化は Not Required と判断した」である。次工程はまだ自動確定しない（技術的第一候補＝「`listingNgWords` チャネル意味定義確認調査」・ChatGPT確認待ち）。**現在地フロー**：C-1C-2a-1 正式リリースComplete → Quality Gate Grounding Enforcement 調査 → C-3-1 Grounding Detection＝Not Required → **APFR Compliance Restrictions deterministic化＝Not Required** → 現在ここ。——以前の更新記録（履歴として保存）：**APFR Step C-3-1 Grounding Detection ─ Not Required 正式化（Decision108追記・docs-only stage-1）**。前工程のread-only調査（Opus・Quality Gate Grounding Enforcement調査に続くC-3-1調査）により、deterministic Grounding Detectionを新設しても実際に発生したGrounding問題を有効に検出できないことが確定したため、**APFR Step C-3-1 Grounding Detection＝Not Required（実装しない）として正式化**した（**判定D**）。**決定的根拠（Option F前の実AI E2Eで確認されたGrounding問題15件）**：**Class A（Formal Truth直接矛盾。例「Formal Truth 報酬4000円 vs 成果物 8000円」）＝0件**／**Class B（Formal Truthに照合先fieldが存在しないContext外具体的捏造。自然由来成分・植物エキス・肌にやさしい成分設計・敏感肌・乾燥肌・悩みを解消・肌本来の美しさ・肌改善・今だけお得なキャンペーン・キャンペーン告知・特典あり等）＝12件**／**Class C（Formal Truth意味誤用。`approvalRate=100`→「100%審査通過済み」／`cookieWindowDays=90`→「90日間のクッキー期間中に購入すると特典あり」／`mobileOptimized=true`→「スマホ最適化済みで簡単購入」。**値自体はFormal Truthと一致しており、値の不一致ではなく意味・文脈の転用**）＝3件**。したがってFormal Truth Contradiction Detectionを実装しても実測15件を1件も検出できない。**APFR Formal Truth全21fieldを調査した結果、C-3-1の安全なdeterministic対象候補＝0件**（APFR＝ASPアフィリエイトプログラムの事実〔ASP名・Program ID・商品名・報酬・EPC・確定率・Cookie期間・技術対応・compliance制約等〕／Grounding問題の中心＝消費者向けマーケティング主張〔商品成分・効果・肌への適性・キャンペーン・特典・評価的表現〕でdomainが一致しない）。**claim extraction不成立**：X1（Formal Truth値との競合値検索）＝false positive過多（例`approvalRate=100`に対し「100人に聞きました」を誤検出）／X2（field-specific keyword proximity）＝実測Class Cは本文にfield labelを含まず検出不能／X3（値完全一致をsupported扱い）＝**禁止**（実測Class C 3件をすべて「supported」と誤肯定する）／X4（claim extraction／contradiction detection分割）＝claim extraction自体がsemantic判断のためdeterministicに成立しない。**status Contract**：Grounding用に`clear`／`supported`／`grounded`／`fully_grounded`を**新設しない**（「値が一致している」「矛盾が見つからない」ことを「Groundingされている」と読み替えると誤保証。特に実測Class CはFormal Truth値が完全一致しているのに意味誤用が発生している）。**C-3系列（仮提案の C-3-1 Grounding Detection／C-3-2a Grounding Assessment／C-3-2a-1 Grounding UI／C-3-2b Grounding Enforcement／C-3-3 Grounding E2E）は実装系列として取り下げ**（設計履歴として「調査した結果Not Requiredとなった」ことは正式記録として残す・単純削除は禁止）。**Leader Final Grounding現在地は変更なし**：Option F実AI E2E＝**A**／Leader Final Grounding＝**B**（軽微残存：`#敏感肌`・「自然由来のスキンケア」・「自然由来の美容と健康を追求するあなたに」・「肌に優しい医薬部外品」等）。**Grounding Complete／Fully Grounded／No Hallucination Guaranteed／Grounding Enforcement Completeとは記録しない**。**Option F責務**：今後もGeneration Preventionとして維持（deterministic Detectionではない）。正式構造＝Case Context／Formal Truth→Generation Prevention（Option F）→Reviewer／Strategy等AI評価→Leader Final。Groundingのdeterministic post-generation Detectorは新設しない。**Quality Gate変更0**（`packageQuality.status`のみを見る構造Gateであり通常Instagram投稿の公開spineを止めない・`evaluateQualityGate()`へGroundingを接続しない）。**READY変更0**（AI生成完了状態・主条件`integratedCount > 0`・Grounding接続しない・READY Grounding Enforcementも現時点では実装しない）。**Mobile Approval変更0**（`canApprove`へ新しいGrounding blockerを追加しない・現行spine「Compliance Assessment blocked→Mobile Approval不可→Publishing Ready不可→markInstagramPublished不可」を維持）。**C-2-1 Numeric Consistency変更0**（`product.inputs`とFormal Truthの照合であり成果物本文を評価しない・C-3とは別責務）。**C-2-2＝引き続き未着手・保留**。**Marketing Claim Formal Truth＝現時点では新設しない**（Formal Truth schemaを増やしても、成果物中のどの表現が「事実主張」かをdeterministicに抽出するclaim extraction問題が残る／allowlist方式＝false positive過多／denylist方式＝Complianceと同一責務）。**将来候補（実装・正式採用はしない）**：残存する軽微表現の一部（`#敏感肌`・「自然由来」・「肌に優しい」）はGroundingよりComplianceの責務に近く、Formal Truthには既に`regulatoryCategory`／`complianceRestrictions`が存在するが、既存C-1C-1は「`advertisingDisclosureRequirements`／`complianceRestrictions`／`regulatoryCategory`／`listingPolicy`は自然言語・意味的判断を要するため機械Gate化しない」と正式判断済み——**この判断は今回変更しない**。将来候補としてのみ「C-1系列：complianceRestrictions deterministic化可否調査」を記録する（まだ実装・正式採用しない）。**Decision**：新規Decision番号は作成せずDecision108へ追記（本C-3-1調査はAPFR／Formal Truth／Grounding境界の設計判断のため）。**Decision109（Mobile Approval Compliance Enforcement Contract）は変更なし**。**今回はdocs-only stage-1（Code変更0・test変更0・DB変更0・AI API実行0・push未実施・新規Tag 0・Render操作0）**。次工程はまだ自動確定しない（技術的第一候補＝「Compliance Restrictions deterministic化可否調査」・ChatGPT確認待ち）。**現在地フロー**：C-1C-2a-1 正式リリースComplete → Quality Gate Grounding Enforcement 調査（＝Quality Gate接続は不採用と判定）→ C-3-1 Grounding Detection 調査 → **C-3-1 Grounding Detection＝Not Required** → 現在ここ。——以前の更新記録（正式リリース実績を含む・履歴として保存）：**APFR Step C-1C-2a-1 Compliance UI Scope Correction 正式リリースComplete（Decision108追記・stage-2 docs同期）**。**【stage-2 docs同期・正式リリース実績】** APFR Step C-1C-2a-1 は正式リリースComplete。Code commit `112dafd6e9ff76f737a6240e2dee346656cfbed6`（`feat: scope compliance ui to scannable outputs`）／stage-1 docs commit `a97109bb2b840b464037b22719d92c00ad3cca62`（＝正式Tag target）を **main push済み**（正式リリース時 HEAD＝origin/main＝`a97109bb2b840b464037b22719d92c00ad3cca62`・ahead/behind 0/0）。**Annotated Tag `v1.01-apfr-compliance-ui-scope-correction`**（target `a97109bb2b840b464037b22719d92c00ad3cca62`）**push済み**（新規Tagは作成せず既存Tag targetも不変）。**Render自動Deploy反映確認済み**：本番 `/` 200・`/api/task-history` 200・`/api/workflow-dashboard` 200・fatal/startup error 0、本番配信 `index.html` に `_apfrComplianceHasScannableContent` と正式「NOT CHECKED」文言が存在、**本番配信 `index.html` とローカルHEADの `index.html` はbyte単位IDENTICAL確認済み**。**最新 `leaderFinalGrounding.test.js` 実測＝52/53 PASS（FAIL: `20-2a` のみ）**——`20-2a` はOption F正式commit後に `openaiClient.js` のHEAD差分が0となるため構造上PASS不可の既知diff-state static guard制約であり、C-1C-2a-1の機能FAILではない。**53/53 PASSとは記録しない**（stage-1実装中の途中値 49/53〔FAIL 18-1・20-1・20-2a・20-2b〕は `index.html` 未commit時のdiff-state由来で、正式commit後に 18-1・20-1・20-2b は解消済み）。**今回の正式化はCompliance UI Scope Correction＝正式リリースCompleteまで**——Compliance Enforcement全体Complete／Quality Gate Grounding Complete／READY Grounding Complete／Grounding Enforcement Complete／IADP Approval Enforcement Complete／server-side Enforcement Completeとは記録しない。新規Decision番号は作成せずDecision108へ追記（Decision109の責務は不変）。**次工程候補の第一＝Quality Gate Grounding Enforcement（未着手・調査/設計工程から開始）**。——以下は正式リリース前のstage-1実装時点の詳細記録（「push/Tag/Render未実施」表記および `leaderFinalGrounding.test.js` 49/53 表記を含むが、最新の正式リリース実績は上記のとおり）：IADPアカウント設計フェーズのdraft表示時に、投稿成果物が存在しないにもかかわらずCompliance Check UIが「禁止語：CLEAR」「広告開示：MISSING」「総合：BLOCKED」等の確定判定に見える表示false positiveを出す問題を発見・是正した。**根本原因**：Output Engineが全output type共通で`buildComplianceGateHtml()`を無条件表示しており、既存detectorはobject型フィールド（`fields.iadp`）をdeep recursionせず対象外とするため、検査対象テキスト0件のまま確定的な戻り値（`clear`/`missing`）を返していた。**責務判断**：投稿成果物がある場合Detector/Assessmentは正しく機能しているため**Detector Contract・Assessment Contractは変更せず**、UI表示スコープのみを補正（実装前調査で判定A：UI表示スコープのみの最小修正で安全に是正可能、と確定）。**新規helper**：`_apfrComplianceHasScannableContent(outputDraft)`——`fields`直下にstring/arrayが1件でも存在するかを、既存detectorと同一の浅い型判定のみで確認。scannable content無し時のみ禁止語/広告開示/総合の3項目をNOT CHECKED表示へ差し替え、「投稿成果物などの検査対象テキストがまだ存在しないため、Compliance Checkは未実施です。」を表示。内部の`evaluateComplianceGate()`・`_apfrEvaluateDisclosureMarkers()`・`_apfrEvaluateComplianceAssessment()`の呼び出し・戻り値は完全に無変更（表示直前でUI層のみ上書き）。**lifecycle carry-forward対応**：IADP存在 ≠ IADP-onlyのため判定軸は「scannable content存在」とし、投稿成果物とIADPが併存する場合はブラウザ実測で通常表示（実際の判定）が正しく表示されることを確認——false negativeを防止し本物の投稿Complianceを隠さない設計。**Mobile Approval Enforcement（C-1C-2b-1）／IADP Approval（C-1C-2b-2 Not Required）／Quality Gate／READYはいずれも変更0**（新helperはこれらへ一切接続しない）。**テスト**：新規`apfrComplianceUiScope.test.js` **60/60 PASS**。**released test追随修正**：`apfrDisclosureDetection.test.js`のtest 40が、`buildComplianceGateHtml()`本体の固定6000文字window切り出しにより、今回の正規UI追加で検証対象文言（オフセット6613文字目）がwindow外へ押し出され1件FAILしたため、既存test suite標準の`\n}\n`終端検出方式へ統一する追随修正を実施（assertion内容・ラベル・検証Contractは1文字も変更せず、`end`/`body`算出の2行のみ変更）。既存回帰：`apfrApprovalEnforcement` 76/76・`apfrComplianceAssessment` 84/84・`apfrDisclosureDetection` 66/66・`apfrComplianceGate` 42/42・`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62・`apfrCaseDataContext` 80/80・`iadpQualityContractRouting` 86/86、他既存重要回帰も新規FAIL0。**`leaderFinalGrounding.test.js` 49/53**（FAIL: 18-1・20-1・20-2a・20-2b。Option F commit時点のdiff-state static guardが正規`index.html`変更を検出した既知の非機能FAILでありC-1C-2a-1機能FAILではない。**53/53 PASSとは記録しない**）。`node --check`・`git diff --cached --check`いずれもCLEAN。**localhost**：`/`200・`/api/task-history`200・`/api/workflow-dashboard`200。**fixture確認**：A.IADP-only→NOT CHECKED/NOT CHECKED/NOT CHECKED、B.IADP+投稿成果物→通常Compliance表示、C.投稿+disclosure missing→MISSING/BLOCKED維持、D.投稿+disclosure satisfied→SATISFIED/CLEAR維持、E.listing violation→VIOLATION/BLOCKED維持、をブラウザ実測確認。Console Error0・POST発火0件・DB write0・AI API実行0。**今回の正式化はCompliance UI Scope Correction Code Implementation Completeまでであり、Compliance Enforcement全体Complete／Quality Gate Grounding Complete／READY Grounding Complete／Grounding Enforcement Complete／IADP Approval Enforcement Complete／server-side Enforcement Completeとは記録しない**。**Code commit `112dafd6e9ff76f737a6240e2dee346656cfbed6`（`feat: scope compliance ui to scannable outputs`）。対象3ファイルのみ（`index.html`／新規`apfrComplianceUiScope.test.js`／`apfrDisclosureDetection.test.js`）・push/Tag/Render未実施**。working treeの別系統runtime差分は本Code commit・本docs追記いずれにも不混入。新規Decision番号は作成せず、Enforcement Contract変更ではないためC-1C-2a記録済みのDecision108へ追記（C-1C-2b系のApproval Enforcement ContractはDecision109に分離済み）。**Version1 Final Complete／Version1.1 Connected AI Company開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）。以前: 更新日: 2026-08-27（**APFR Step C-1C-2b-2 IADP Approval Enforcement ─ Not Required正式化（Decision109追記）**。Mobile Approval Enforcement（C-1C-2b-1）正式リリース後、対称工程として検討されたIADP Approval Enforcementについて実装前調査（Opus）を実施した結果、**C-1C-2b-2は実装しない（Not Required）と正式判定**。理由はserver-side制約ではなく、**Compliance AssessmentとIADP Approvalが評価対象とする成果物そのものが異なるという責務不一致**。**技術的根拠**：`evaluateComplianceGate()`・`_apfrEvaluateDisclosureMarkers()`はいずれもobject型の値を`string/array以外（object等）は対象外・deep recursionしない`として明示的にスキップする実装であり、IADPアカウント設計パッケージ（`fields.iadp = {package, validation, quality, ...}`）はobjectのため**構造上Compliance Assessmentの評価対象に含まれない**。**ブラウザ実測**：`fields.iadp.package`内にNGワードや広告開示Accepted Marker（【広告】等）を配置してもDetectorは検出せず（`compliance:'clear'`／`disclosure:'missing'`のまま）、同内容をトップレベルstringに置くと正しく検出されることを確認し、IADPパッケージ内容とCompliance Assessmentが別スコープであることを実測で確定した。**false positiveリスク**：`advertisingDisclosureRequirements`登録済み案件でIADP設計フェーズのdraft（投稿ではないため本来【広告】/#PR不要）を評価すると`blocked（広告開示マーカー不足）`となり得ることを実測確認。IADPパッケージ内へマーカーを追加してもdeep recursionしないため解消できず、**接続していれば修復不能な永久blockを生み得た**。**責務境界**：IADP Approvalはアカウント設計パッケージ（accountName/bio/brandConcept等）を判定し、Compliance Assessmentは投稿成果物のトップレベルtext/arrayフィールド（slides/caption/hashtags等）を判定する——両者は別成果物。**Mobile Approvalが正しいchokepointである理由**：投稿向けCompliance問題は既にC-1C-2b-1で正しい責務境界にて強制済みであり、Mobile Approvalパネル自体`createMobileReviewCenterDraft()`が実際のカルーセルスライド存在を要件とするためアカウント設計のみのdraftでは描画されない＝**投稿成果物が存在する場合にのみ作動するよう既に正しくスコープ済み**。IADP Approvalへの二重接続は不要。**正式Enforcement spine**：Compliance Assessment blocked→Mobile Approvalは不可（C-1C-2b-1）→IADP Approvalは止めない（成果物が異なるため）→accountCreationReadinessは変更しない（既存IADP品質集約spineを維持）→OUTPUT_STATUS.READYは変更しない。**変更0（実装しないため）**：`_iadpApproveDesign()`／`accountCreationReadiness`（ready/conditional/not_readyのContract維持）／既存User Approval（プラファスト案件含む既存Approvedを遡及変更しない・新規DB write0）／EER（既存記録を無効化しない）／`evaluateQualityGate()`／`OUTPUT_STATUS.READY`／`server.js`。**IADPカードへの新規Compliance warning表示も追加しない**（現行Compliance判定はIADP package自体を評価していないため誤解を招く）。**将来の拡張余地**：IADPパッケージ自体のCompliance検査が将来必要になった場合は、C-1C-2b-2を復活させるのではなく「IADP Content Compliance Detection」という別工程として設計し、既存C-1C-1／C-1C-1bを勝手に拡張しない。**既知の残課題（分離・今回修正しない）**：`advertisingDisclosureRequirements`を持つ案件でIADP設計フェーズのdraftを表示するとCompliance Check UIが表示レベルでBLOCKEDと表示され得る問題（C-1C-2a表示スコープ問題として別課題・現時点ではnon-blocking）。**プラファスト案件で実投稿成果物が存在するMobile Approval段階でのadvertising disclosure missingは正しいCompliance blockerであり、C-1C-2b-1のEnforcementは引き続き維持する**。**今回の正式化はC-1C-2b-2 Not Requiredの判断のみであり、Compliance Enforcement Complete／Quality Gate Grounding Complete／READY Grounding Complete／IADP Content Compliance Complete／server-side Enforcement Completeとは記録しない**。Code変更0・test変更0・DB変更0・AI API実行0。新規Decision番号は作成せずDecision109へ追記。**Version1 Final Complete／Version1.1 Connected AI Company開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）。以前: 更新日: 2026-08-27（**APFR Step C-1C-2b-1 Mobile Approval Enforcement Code Implementation Complete・新規Decision 109**。C-1C-2aまではCompliance Assessmentがblockedでも誰も止まらない「検出のみ」状態だったため、Mobile Approval（通常Instagram投稿の単一chokepoint）へ実ブロックを接続した。**新規Decision番号（109）を採用**——Formal Truth保存契約（Decision108）ではなく、人間のUser Approval操作を初めてdeterministic判定で実際に拒否するApproval Contract自体の変更のため分離。**実装前調査で確定**：Mobile Approvalを止めればPublishing Ready（`createPublishingReadyDraft()`）・投稿記録（`markInstagramPublished()`の既存hard guard）は独立guard追加なしで自動的に停止する／APFR Resolverはclient専用でserver側再評価はC-1A Contract違反となるためserver-side Enforcement（C-1C-2b-3）は実装不可／IADP Approvalは別spine（`accountCreationReadiness`）でありC-1C-2b-2として分離。**正式Enforcement spine**：Compliance Assessment blocked→Mobile Approval不可→Publishing Ready到達不可（自動追従）→markInstagramPublished実行不可（自動）。変更0：`OUTPUT_STATUS.READY`（AI生成完了状態として維持）／`evaluateQualityGate()`／`accountCreationReadiness`／`_iadpApproveDesign()`／`_edRunDecisionEngine()`／`server.js`（client-only Enforcement・直接POSTでの技術的回避可能性は残るが目的は単一運用者の操作ミス防止）。**実装**（`index.html`のみ）：新規`_apfrEvaluateMobileApprovalCompliance()`が`_apfrEvaluateComplianceAssessment()`（C-1C-2a）を唯一の判定源とし、listingNgWords検索・広告marker検索・Resolver等の独自再実装は0。`canApprove = _mapAllChecked() && _mapReviewApproved(mai) && !_mapCompliance.blocked;`（既存2条件維持＋Enforcement条件追加）。`approveInstagramPackage()`内でsubmit直前に再評価（CUI-2のstale防止と同思想）し、blocked時は`decision`・`approvedAt`を変更せず`pushApprovalToServer()`へも進まずreturn。`not_checked`／例外はfail-open（既存条件のみで決定・承認を止めない）。warningsへblocker理由・not_checked警告を表示、**新規override UIは作成していない**。修正またはAPFR Fact訂正でAssessmentがclearへ戻れば自動復旧。**released test 4ファイルを正規追随修正**（`apfrCaseDataContext`／`apfrComplianceGate`／`apfrDisclosureDetection`／`apfrComplianceAssessment`。旧「Approval未接続」assertionを新Contract「既存2条件維持＋Enforcement接続済み＋detector非再実装」検証へ更新。assertion削除・弱化ではなく`apfrComplianceAssessment`は1件追加）。**テスト**：新規`apfrApprovalEnforcement.test.js` **76/76 PASS**。既存回帰：`apfrComplianceAssessment` 84/84・`apfrComplianceGate` 42/42・`apfrDisclosureDetection` 66/66・`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62・`apfrCaseDataContext` 80/80・`iadpQualityContractRouting` 86/86、他既存重要回帰も新規FAIL0。**`leaderFinalGrounding.test.js` 49/53**（FAIL: 18-1・20-1・20-2a・20-2b。Option F commit時点のdiff-state static guardが正規`index.html`変更を検出した既知の非機能FAILでありC-1C-2b-1機能FAILではない。**53/53 PASSとは記録しない**）。`node --check`・`git diff --cached --check`いずれもCLEAN。**localhost**：`/`200・`/api/task-history`200・`/api/workflow-dashboard`200・Console Error0。**fixture確認**：clear／blocked(listing)／blocked(disclosure)／not_checkedの4状態、blocked submit時の`decision=null`・`approvedAt=null`・**pushCount=0**、修正後の自動復旧を実測確認。fixture実行によるPOST発火0件・DB write0・AI API実行0。**実運用影響（重要）**：プラファスト実案件は`advertising disclosure missing`が既に実測されており、**次回のMobile Approval操作は実際にblockされる可能性が高い**（意図したEnforcement動作。解除には成果物へ【広告】/#PR等の追加が必要）。**今回の正式化はMobile Approval Enforcement Completeまでであり、Compliance Enforcement全体Complete／IADP Approval Enforcement Complete／Quality Gate Grounding Complete／READY Grounding Complete／accountCreationReadiness Enforcement Complete／server-side Enforcement Completeとは記録しない**。**Code commit `46b37dc2785bdd02c1cc578581c6b95f7ea8d95f`（`feat: enforce compliance on mobile approval`）。対象6ファイルのみ（`index.html`／新規`apfrApprovalEnforcement.test.js`／released test4件）・push/Tag/Render未実施**。working treeの別系統runtime差分（`cost-logs.json`／`data/conversations/_meta.json`・既存untracked7件）は本Code commit・本docs追記いずれにも不混入。**Version1 Final Complete／Version1.1 Connected AI Company開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）。以前: 更新日: 2026-08-27（**APFR Step C-1C-2a Compliance Assessment Aggregation Code Implementation Complete・Decision108追記**。既存C-1C-1（listingNgWords Deterministic Compliance Check）とC-1C-1b（Advertising Disclosure Detection）はそれぞれ独立したdetectorとして表示のみに使われていたため、この2つの結果を1つのCompliance Assessmentへ集約する`APFR_COMPLIANCE_ASSESSMENT_ITEMS`と新規純関数`_apfrEvaluateComplianceAssessment(outputDraft, complianceContext)`を`index.html`へ追加した。**今回の正式化はCompliance Assessment Aggregation Completeまでであり、Compliance Enforcement Complete／Quality Gate Grounding Complete／READY Grounding Complete／User Approval Enforcement Complete／accountCreationReadiness Enforcement Completeとは記録しない**。**Existing Detector再利用**：`evaluateComplianceGate(outputDraft, complianceContext)`と`_apfrEvaluateDisclosureMarkers(outputDraft, complianceContext)`を呼ぶだけで、listingNgWords検索・広告marker検索・`_apfrComplianceGateNormalize()`・`APFR_DISCLOSURE_ACCEPTED_MARKERS`・hashtag token判定・APFR Resolver・`.facts`直接走査のいずれも独自再実装0（前工程のOpus調査で「Quality GateへCompliance結果を直接集約する案は既存4 testのシグネチャ固定Contractを破壊するため不採用」と判断し、新規の集約層として分離した設計判断を踏襲）。**status Contract**：`clear`（blocker0件かつ少なくとも片方が実判定済み）／`blocked`（`evaluateComplianceGate().status==='violation'`または`_apfrEvaluateDisclosureMarkers().status==='missing'`のいずれか）／`not_checked`（両detector not_checked・input不正・例外）の3状態。**blockers**は既存detector結果の要約のみ（`{type, label, detail}`）で新しい意味判定を作らない。**unchecked**はnot_checked項目を握りつぶさず`unchecked[]`へ保持し、例えば`compliance clear + disclosure not_checked`は`status=clear・unchecked=['advertising_disclosure']`となり、**`clear`は「全Compliance完全確認済み」を意味しない**ことをUIでも明示。**fail-open/fail-closed**：明確な違反（violation/missing）のみblocked、判定不能（not_checked）は自動blockせずuncheckedへ保持、例外時もclearを返さずnot_checkedへfail-open。**Non-blocking Contract**：今回のblockedはCompliance Assessment上の状態のみで、`evaluateQualityGate()`／`packageQuality`／`OUTPUT_STATUS.READY`／`approveInstagramPackage()`／`_iadpApproveDesign()`／`pushApprovalToServer()`／`_enqueueApprovalPost()`／`accountCreationReadiness`／Executive Decision Engine／Publishing Readyはいずれも変更0・停止しない。UIにも「※現在は確認表示のみです（検出・集約のみ）。User Approval・READY・Quality Gate・Executive Decisionは自動停止しません。」を明示。**重要な構造ギャップ**：`accountCreationReadiness`はIADP専用のenforcement spineであり、非IADP案件（アフィリエイト記事等）には同等のEnforcement接続先が現状存在しない。これは**Step C-1C-2bの設計課題として未着手のまま残す**。**Numeric Consistency境界**：`_apfrEvaluateNumericConsistency()`（C-2-1）への参照・変更は0、mismatch/uncomparableをblockerに含めない（Step C-2-2として別工程）。**Leader Final Grounding境界**：Option Fはprompt-based preventionでありdeterministic Grounding detectorは存在しないため、「Grounding clear」等のstatusは新設していない。**UI**：既存Compliance Checkパネル内へ「禁止語」「広告開示」に加え「総合：CLEAR/BLOCKED/NOT CHECKED」を独立表示し、blocked時はblocker理由、unchecked項目がある場合は「未検査項目あり」を明示。**保存**：runtime onlyの純関数（DB・Output Draft・APFR Fact・Intelligence Context・Compliance Context・EER・IADP assessmentContext・Quality Gate fieldへの書き込みは0・呼び出しのたび再計算）。**テスト**：新規`apfrComplianceAssessment.test.js` **83/83 PASS**（status Contract 9パターン・fail-open4件・blockers/unchecked検証・Existing Detector再利用のstatic検証・Quality Gate/READY/User Approval/accountCreationReadiness/Numeric Consistency変更0のstatic検証を含む。実装過程でテスト側の検出方法の誤り〔コメント文中の説明語への誤ヒット〕1件を発見・修正）。既存回帰：`apfrComplianceGate` 42/42・`apfrDisclosureDetection` 66/66・`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62・`apfrCaseDataContext` 80/80・`apfrNumericConsistency` 53/53・`apfrCurrentFactResolver` 70/70・`apfrCore` 49/49・`iadpQualityContractRouting` 86/86、他既存重要回帰も新規FAIL0。**`leaderFinalGrounding.test.js` 49/53**（FAIL: 18-1・20-1・20-2a・20-2b。Option F commit時点のCode diff状態を固定するstatic guardが今回の正規`index.html`変更を検出した既知の非機能FAILであり、C-1C-2a機能のFAILではない。**53/53 PASSとは記録しない**。test修正・assertion削除はいずれも行っていない）。`node --check`・`git diff --cached --check`いずれもCLEAN。**localhost**：`/`200・`/api/task-history`200・`/api/workflow-dashboard`200・Console Error0。**fixture確認**：ブラウザ実行環境で`_apfrEvaluateComplianceAssessment()`・`buildComplianceGateHtml()`を一時的な状態差し替え（finally節で確実に復元）を用いて直接呼び出し、clear／blocked／not_checked／clear+uncheckedの4状態のHTML描画を実測確認。fixture実行によるPOST発火**0件**（GETリクエストのみを実測確認）・DB write0・AI API実行0。**Code commit `659e82ceefb899e794b08872b58d2820b357c1df`（`feat: aggregate apfr compliance assessment`）。対象2ファイルのみ（`index.html`／新規`apfrComplianceAssessment.test.js`）・push/Tag/Render未実施**。working treeの別系統runtime差分（`cost-logs.json`／`data/conversations/_meta.json`・既存untracked7件）は本Code commit・本docs追記いずれにも不混入。新規Decision番号は作成せずDecision108へ追記。**Version1 Final Complete／Version1.1 Connected AI Company開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）。以前: 更新日: 2026-08-26（**APFR Step C-1C-1b Advertising Disclosure Detection Code Implementation Complete・Decision108追記**。既存C-1C-1（Deterministic Compliance Check）は`listingNgWords`のみをdeterministicに確認しており、`advertisingDisclosureRequirements`はCompliance ContextとしてWriter/Reviewer/Leader Finalへ到達していたにもかかわらずdeterministic Gateでは一度も評価されていなかった（`evaluateComplianceGate()`は`complianceContext.listingNgWords`を見た時点で早期returnし、他3fieldに触れない実装だった）。Leader Final Grounding Option F実AI E2Eでも、`advertisingDisclosureRequirements`が存在するにもかかわらず【広告】／#PR／#広告等の広告明示が成果物へ反映されない事象を確認しており、この不足を可視化するため**APFR Step C-1C-1bとしてAdvertising Disclosure Detectionを追加した**。**今回の正式化はAdvertising Disclosure Detection Completeまでであり、Compliance Enforcement Complete／Compliance Gate Complete／Quality Gate Grounding Complete／READY Grounding Complete／User Approval Enforcement Completeとは記録しない**。**実装**（`index.html`のみ）：新規`APFR_DISCLOSURE_ACCEPTED_MARKERS`（whitelist：【広告】／【PR】／#広告／#PR／#プロモーション／明示文章3種）と新規純関数`_apfrEvaluateDisclosureMarkers(outputDraft, complianceContext)`を`evaluateComplianceGate()`の兄弟関数として追加（`evaluateComplianceGate()`本体は無変更・listingNgWords Contract非混在）。既存`_apfrComplianceGateNormalize()`（String化→NFKC→lowercase→trim）をそのまま再利用し新しい自然言語解析・fuzzy判定・AI判定は追加していない。ハッシュタグは単純`includes()`ではなくtoken境界完全一致で判定し、`#profile`を`#PR`として誤検出しない。`#アフィリエイト`／`#案件`／`#提供`／文章中の単なる「広告」「PR」等は単独でsatisfiedにしない（whitelist方式・deterministic判定で誤って適法・適切と認定しないことを優先）。**status Contract**：`satisfied`（requirementあり＋Marker1件以上）／`missing`（requirementあり＋Marker0件）／`not_checked`（requirementなし・none・ambiguous・empty array・invalid input・fields不正・例外時）の3状態。`complianceContext.advertisingDisclosureRequirements`が有効なnon-empty arrayとして存在する場合のみ`requirementPresent=true`（C-1Aの既存Contract上none/ambiguousはキー自体が出力されないため自然に`not_checked`となる・C-1Aのshapeは変更0）。**Non-blocking Contract**：`evaluateComplianceGate()`／`evaluateOutputPackageCompleteness()`／`evaluateQualityGate()`／`OUTPUT_STATUS.READY`／`approveInstagramPackage()`／`_iadpApproveDesign()`／`pushApprovalToServer()`／`_enqueueApprovalPost()`／Executive Decision Engine／Publishing Ready／APFR Resolver／C-1A Compliance Context／C-1B Compliance Injection／Leader Final Grounding Option Fはすべて変更0。missingでもQuality Gate／READY／User Approval／Publishing Readyをブロックしない。例外時はsatisfiedを返さずnot_checkedへfail-open。**UI**：既存Compliance Checkパネル内へ「禁止語：CLEAR/VIOLATION/NOT CHECKED」と並べて「広告開示：SATISFIED/MISSING/NOT CHECKED」を独立表示。Instagramのタイアップ投稿ラベル（Paid Partnershipラベル）は外部UI操作でありOutput Draft文字列からは実際に設定されたか確認できないため、Detection結果のsatisfied条件には含めず、UIには「Instagram投稿時はタイアップ投稿ラベルの設定も別途確認してください（本Detectionでは検証していません）」という補足のみを表示（新規Fact作成0・EER変更0・DB保存0）。**保存**：runtime onlyの純関数（DB・Output Draft・APFR Fact・Intelligence Context・Compliance Context・EERへの書き込みは0・呼び出しのたび再計算）。**テスト**：新規`apfrDisclosureDetection.test.js` **66/66 PASS**（Accepted Marker各種・missing・not_checked・NFKC正規化・hashtag token境界・`#profile`誤検出なし・`#アフィリエイト`単独では非satisfied・「広告表示義務について」等の無境界部分一致では非satisfied・mutation0・fetch0・DB write0・AI API0・Existing Compliance Gate/Quality Gate/READY/User Approval変更0のstatic検証を含む）。既存回帰：`apfrComplianceGate` 42/42・`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62・`apfrCaseDataContext` 80/80・`apfrCurrentFactResolver` 70/70・`apfrCore` 49/49・`iadpQualityContractRouting` 86/86、他既存重要回帰も新規FAIL0。**`leaderFinalGrounding.test.js` 49/53**（FAIL: 18-1・20-1・20-2a・20-2b。これはOption F commit時点のCode diff状態を固定するstatic guardが今回の正規`index.html`変更を検出した既知の非機能FAILであり、C-1C-1b機能のFAILではない。**53/53 PASSとは記録しない**。test修正・assertion削除はいずれも行っていない）。`node --check`・`git diff --cached --check`いずれもCLEAN。**localhost**（`npm run dev-check`）：`/`200・`/api/task-history`200・`/api/workflow-dashboard`200・Console Error0。fixture実行（ブラウザ実行環境で`_apfrEvaluateDisclosureMarkers()`・`buildComplianceGateHtml()`を一時的な状態差し替え・finally節で確実に復元して直接呼び出し）でsatisfied/missing/not_checkedの3状態を確認、fixture実行によるPOST発火0件・DB write0・AI API実行0。**Code commit `e23c0df88d7aca485f576124677735aa080441ee`（`feat: detect advertising disclosure markers`）。対象2ファイルのみ（`index.html`／新規`apfrDisclosureDetection.test.js`）・push/Tag/Render未実施**。working treeの別系統runtime差分（`cost-logs.json`／`data/conversations/_meta.json`・既存untracked7件）は本Code commit・本docs追記いずれにも不混入。新規Decision番号は作成せずDecision108へ追記。**Version1 Final Complete／Version1.1 Connected AI Company開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）。以前: 更新日: 2026-08-26（**Leader Final Grounding Option F Code Implementation Complete・実AI E2E Validated・Decision108追記**。Path A実AI E2Eで、LCC Phase2 + Option BによりContext自体はLeader Finalまで正常到達しているにもかかわらず、Writerが情報不足で正しく停止したのにLeader Finalがそれを乗り越えCASE CONTEXT外の具体的事実を捏造する問題を発見（**LCC Phase2 + Option Bの失敗ではなくLeader Final Grounding層限定の問題**）。Option F修正前の実測：Context外具体的捏造12件・Formal Truth意味誤用3件（例：`approvalRate=100`→「100%審査通過済み」等）・架空キャンペーン/特典あり・Writer停止判断の不正上書きあり（**捏造成果物でもQuality Gate=passed・READY相当のまま素通し**）。根本原因＝Leader Finalは`buildSystemPrompt()`を経由せず固定`LEADER_FINAL_PROMPT`を直接使用するため、Writer/Researcher/Reviewer/Strategyへ適用済みの`formalTruthRule`完全版が届いていなかった。**Option F実装**（`openaiClient.js`のみ）：①`formalTruthRule`を`_buildFormalTruthRuleText(hasCaseContext)`へ単一ソース化（挙動不変のリファクタ）②新規`_buildLeaderFinalGroundingBlock(caseContext, ruleFacts)`をcaseContext存在時のみquestion側へ追加（`LEADER_FINAL_PROMPT`本体は無変更・caseContextなし経路はfail-open維持）③Formal Truthのfield意味・用途を維持し別概念へ読み替え禁止という条項を新設（`approvalRate`／`cookieWindowDays`／`mobileOptimized`の実測誤用例を明示）④既存`shared/leaderRuleEngine.js`の`evaluateLeaderRuleFacts()`を再利用し`informationInsufficient.count>0`時のみ「Leaderが担当社員の停止判断を創作で上書きしてはならない」というfail-closed文を追加。`index.html`／`server.js`／`claudeClient.js`／`shared/leaderRuleEngine.js`／APFR Resolver／Quality Gate／READY／Compliance Gate／DB schemaはいずれも変更0。新規`leaderFinalGrounding.test.js` **53/53 PASS**（AI API呼び出し0・DB write0の合成テスト）、`apfrCaseDataContext.test.js`はtest 40のみ同一Contractへ追随修正し**80/80 PASSへ復旧**、既存回帰（`apfrComplianceContext` 48/48・`apfrComplianceInjection` 62/62等）全PASS・新規FAIL0。**実AI E2E**（本物のPath A workflow・安全なcandidateOnly方式・本番Draft無変更・API6回・実測約16.4円）でOption F後は具体的捏造0件・Formal Truth意味誤用0件・架空キャンペーン/特典0件・Writer停止判断の不正上書き0件を確認。ただし`#敏感肌`「自然由来のスキンケア」等、Formal Truthに直接裏付けのない評価的・示唆的表現が軽微に残存。**正式判定：Leader Final Grounding＝B（軽微な表現問題のみ）・Option F実AI E2E＝A（成功）**。「Leader Final Grounding Complete」「Grounding Enforcement Complete」とは記録しない。**重要な非依存関係**：Option F実AI E2E成功 ≠ Compliance Enforcement Complete（`advertisingDisclosureRequirements`到達済みだが【広告】等の明示表示なし・別課題）≠ Quality Gate Grounding Complete（現行Gateは構造充足中心のまま変更0）≠ READY Grounding Complete（`integratedCount>0`が主条件のまま変更0）。**Data Safety**：E2E前後でfacts22件・intelligenceContext・IADP・EER3件・User Approvalいずれも完全一致・output_drafts write0・APFR/EER/IADP変更0。**Code commit `04e28a08793218ceaf59dd8fa228333bb58fcd0c`（`feat: ground leader final in formal truth context`）。対象3ファイルのみ（`openaiClient.js`／`apfrCaseDataContext.test.js`／新規`leaderFinalGrounding.test.js`）・push/Tag/Render未実施**。新規Decision番号は作成せずDecision108へ追記。working treeの別系統runtime差分（`cost-logs.json`／`data/conversations/_meta.json`・既存untracked7件）は本Code commit・本docs追記いずれにも不混入。**Version1 Final Complete／Version1.1 Connected AI Company開発中・Phase54 Complete維持・Phase55未着手（変更なし）**）。以前: 更新日: 2026-08-25（**Leader Case Context Phase2 + Option B Code Implementation Complete・Decision108追記**。Instagram実運用で判明した「保存済み商品情報・Intelligence・APFR Formal Truthが存在するのにAI社員が『確認できない』と回答し情報不足のままReady到達する」不具合を解消。原因＝本番にCase Context配線（`caseContext`/`hasCaseContext`/`formalTruthRule`）自体が未commit（Leader Case Context Phase2）で、かつLCC Phase2単独でもAPFR Formal Truth・Intelligenceを含まないこと。LCC Phase2＝`caseContext`文字列契約をPath A/B・OpenAI/Claude両Providerへ配線。Option B＝新規`_buildCaseDataContext()`がAPFR Resolver（client専用維持）を呼びresolvedのみのFormal Truthと6 Intelligenceモジュール要約をserverへ受動パススルー（Resolver再実装0・C-1A test 10-6維持・payoutの数値変換等は行わない）。Payload実測約2,359B（全体25,008Bの約1/10.6）。実AI E2E（Path B・実案件`case-msr9yckye65y`・本番Draft無変更・API5回・¥11.5）でWriter/Researcher/Reviewer/Strategy全員のContext到達・捏造0・Formal Truth矛盾0を実証。テスト：新規`apfrCaseDataContext.test.js` 80/80 PASS・既存回帰16スイート全PASS・新規FAIL0。**Code commit `95eaa899`済み・push/Tag/Render未実施**。**LCC Phase2 + Option B Complete ≠ Leader Final Grounding Complete ≠ Quality Gate Grounding Complete ≠ READY Grounding Complete**（Path A実AI E2E・Quality Gate観察・READY観察・Leader Final fail-closed・Quality Gate Grounding Enforcementはいずれも未検証・未実装）。次工程は正式リリース前最終検証。新規Decision番号は作成せずDecision108へ追記）。以前: 2026-08-25（**APFR Step C-2-1 Formal Truth Numeric Consistency Check 正式リリースComplete・Decision108追記**。正式リリース前最終検証（C-2-1専用53/53・既存回帰15スイート全PASS・新規FAIL0・`node --check` OK・`git diff --check` CLEAN・LCC混入0・server/openaiClient/claudeClient変更0・Non-blocking Contract無変更を`git show`で直接再確認）ののち、クリーンなlocalhost状態でdev-checkを実行し**200/200/200を取得**。Code commit `9cf7ab9` ＋ docs commit `38ac9aa`を**main push**（HEAD/origin/main `38ac9aa...`・ahead/behind 0/0）、**正式Tag `v1.01-apfr-formal-truth-numeric-consistency`（Annotated・target `38ac9aa...`）を作成しtag push済み**。**Render**自動Deployで本番反映済み（本番3endpoint200・`_apfrEvaluateNumericConsistency`／`buildFormalTruthConsistencyHtml`／Output Engine配線の存在を直接curl取得で確認・LCCマーカー0）。実案件データによるmatch/mismatch/uncomparable表示の本番確認は、合言葉認証保護のため今回未実施（C-2-1専用テスト53件＋localhost fixture確認による代替確認済み）。**C-2-1 Complete ≠ Intelligence Score Enforcement Complete**（score接続はStep C-2-2として別工程・未着手）。次工程はユーザー承認後に選定。新規Decision番号は作成せずDecision108へ追記）。以前: 2026-08-25（**APFR Step C-2-1 Formal Truth Numeric Consistency Check Code Implementation Complete・Decision108追記**。Product Intelligenceのscore計算が使用する`product.inputs`側`payout`／`epc`／`approvalRate`とAPFR Formal Truth側の同名Fact（既存Resolver経由）の数値整合をread-onlyで確認する`_apfrEvaluateNumericConsistency()`／`buildFormalTruthConsistencyHtml()`を実装（Code commit `9cf7ab92028e4280e83153a3c046a588187aedff`）。4状態Contract＝match／mismatch／uncomparable／not_checked。payoutはAPFR側`type:'string'`のため常にuncomparable（数値変換を新設しない）。`_aicIntegratedScore()`／score／User Approval／READY／Quality Gate／Compliance Gateはいずれも無変更・判定結果は保存しない（runtimeのみ）。**C-2-1 Complete ≠ Intelligence Score Enforcement Complete**（score接続はStep C-2-2として別工程・未着手）。新規`apfrNumericConsistency.test.js` 53/53 PASS・既存回帰全PASS・新規FAIL0。LCC Phase2混入0（HEADベース合成patchで分離）。localhost fixture確認でConsole Error 0・DB書き込み0を確認。**Code commit済み・push/Tag/Render未実施**。次工程はC-2-1正式リリース前最終検証（C-2-2へは先に進まない）。新規Decision番号は作成せずDecision108へ追記）。以前: 2026-08-24（**APFR Step C-1C-1 正式リリースComplete・Decision108追記**。正式リリース前最終検証（C-1C-1 42/42・C-1A 48/48・C-1B 62/62・既存回帰全PASS・新規FAIL0・LCC混入0再確認）ののち、クリーンなlocalhost状態でdev-checkを実行し**200/200/200を取得**。Code commit `d8e7021` ＋ docs commit `a2bd95a`を**main push**（HEAD/origin/main `a2bd95a...`・ahead/behind 0/0）、**正式Tag `v1.01-apfr-deterministic-compliance-check`を作成しtag push済み**。**Render**自動Deployで本番反映済み（本番3endpoint200・`evaluateComplianceGate`/`buildComplianceGateHtml`とOutput Engine配線の存在確認）。実案件データによるCLEAR/VIOLATION/NOT CHECKED表示の本番確認は、合言葉認証保護・不要なAI API課金回避のため今回未実施（C-1C-1テスト42件による代替確認済み）。**C-1C-1 Complete ≠ Compliance Enforcement Complete**（User Approval／READYへの実ブロック接続はStep C-1C-2として別工程・未着手）。**次工程はC-1C-2含め未着手・ユーザー承認後に選定**。**Phase54 Complete維持・Phase55未着手**。新規Decision番号は作成せずDecision108へ追記）。以前: 2026-08-24（**APFR Step C-1C-1 Deterministic Compliance Check Code実装Complete・Decision108追記**。C-1C調査・設計の結論どおり`listingNgWords`のみを対象とした非ブロッキングDeterministic Compliance Checkを実装（Code commit `d8e7021`）。新規`evaluateComplianceGate()`はC-1Aの`complianceContext`のみをconsumerとしfacts・Resolverを直接参照せず、NFKC正規化＋部分一致のみで判定（NLP・fuzzy matching不使用）。`clear`／`violation`／`not_checked`の3状態、`none`／`ambiguous`は区別せず`not_checked`統一（fail-closed）。`advertisingDisclosureRequirements`／`complianceRestrictions`／`regulatoryCategory`／`listingPolicy`は今回対象外（理由は個別に明記）。新規`buildComplianceGateHtml()`はOutput Package Qualityと独立表示・非ブロッキング明示文言あり。**`packageQuality`／`evaluateQualityGate()`／`OUTPUT_STATUS.READY`／IADP `canApprove`／User Approvalはいずれも無変更**。**正式名称は「APFR Step C-1C-1 Deterministic Compliance Check」——実ブロック接続はStep C-1C-2として別工程・未着手**。テスト：C-1C-1専用42/42 PASS・既存回帰全PASS・新規FAIL0。localhost実機でCLEAR/VIOLATION/NOT CHECKEDの3表示・Console Error 0を確認。LCC Phase2混入0（HEADベース合成patchで分離・3 hunkとも削除行0）。**Code commit済み・push/Tag/Render未実施**。次工程＝**C-1C-1正式リリース前最終検証**（C-1C-2へは先に進まない）。**Phase54 Complete維持・Phase55未着手**。新規Decision番号は作成せずDecision108へ追記）。以前: 2026-08-24（**APFR Step C-1A / C-1B 正式リリースComplete・Decision108追記**。正式リリース前最終検証（C-1A 48/48・C-1B 62/62・既存回帰全PASS・新規FAIL0・LCC混入0再確認）ののち、クリーンなlocalhost状態でdev-checkを再試行し**200/200/200を取得**。Code commit3件（`9d66525`／`f52511`／`3793752`）を**main push**（HEAD/origin/main `3793752...`・ahead/behind 0/0）、**正式Tag `v1.01-apfr-compliance-injection`を作成しtag push済み**。**Render**自動Deployで本番反映済み（本番3endpoint200・新関数`_apfrBuildComplianceContext`の存在確認）。Writer/Reviewerへの実際のCompliance Block注入は実AI API課金を避けるため本番実行では未確認（C-1Bテスト62件による代替確認済み）。**次工程はC-1C含め未着手・ユーザー承認後に選定**。**Phase54 Complete維持・Phase55未着手**。新規Decision番号は作成せずDecision108へ追記）。以前: 2026-08-24（**APFR Step C-1A Compliance Context Foundation ＋ Step C-1B Writer/Reviewer Compliance Injection Code実装Complete・Decision108追記**。Step C-1A（Code commit `9d66525`）＝Compliance Formal Truth 4field（listingNgWords／advertisingDisclosureRequirements／complianceRestrictions／regulatoryCategory。listingPolicyは対象外）をResolverから`atRunWorkflow()`→`/api/auto-task`→server.js受動パススルー→`runAutoTaskWorkflow()`までread-only配線（prompt実注入0）。Step C-1B（Code commit `f52511`）＝`buildCompliancePromptBlock()`でWriter・Reviewerへ限定注入（Strategy/Leader Finalへは注入せず、Reviewerフィードバックは既存経路でLeader Finalへ統合）。Fact値はデータ枠として明示しsystem instruction化しない設計・empty時はC-1B前promptとbyte-identical。**Quality Gate Compliance EnforcementはStep C-1C候補として未実装**。テスト：C-1B専用62/62・C-1A更新後48/48・既存回帰全PASS・新規FAIL0。**dev-check**：`/api/workflow-dashboard`はC-1Bと無関係なSupabase応答時間変動によりこのセッション内で200未確定——**environment Pendingとして記録しPASS扱いにしない**。working treeのLeader Case Context Phase2はC-1A/Bとも混入0（HEADベース合成patchで分離）。**Code commit 2件済み・push/Tag/Render未実施**。次工程＝**C-1A+C-1B正式リリース前最終検証**（C-1Cへ先に進まない）。**docs更新のみ・Phase54 Complete維持・Phase55未着手**。以前: 2026-08-24（**APFR Correction UI Core 本番認証後最終目視確認Complete・Decision108追記**。ユーザー本人が本番URLへ認証後ログインし実ブラウザで確認：resolved Fact行の「訂正」ボタン表示／Correction modeへの正常遷移／現在値の正常表示／field固定表示／新しい値入力欄が空（旧値自動コピーなし）／「訂正をやめる」正常表示／cancel後の通常モード復帰（Correction Target残留なし）。**「確認済みFactとして登録」は押していないためCorrection Fact登録0・本番Fact変更0・DB書き込み0を維持**。**Console Errorの追加実測は今回のスクリーンショット確認では未実施**（既存テスト・localhost確認のConsole Error 0記録は不変）。**Correction UI Core系列（CUI-0〜CUI-2）に残っていたリリース確認Pending＝本番認証後の実ブラウザ目視確認がComplete**となり、**Correction Contract／Resolver／CUI-0／CUI-1／CUI-2／正式リリース／本番認証後最終目視＝すべてComplete・Pendingは0**。**次工程＝APFR Correction UI後の次工程選定・調査**（CUI-3／CUI-4／ITP `7days` field／APFR Step Cの必要性を比較。未着手・ユーザー承認なしに自動開始しない）。**docs更新のみ・Code/DB/API変更0・Phase54 Complete維持・Phase55未着手**。以前: 2026-08-24（**APFR Correction UI Core CUI-0〜CUI-2 正式リリースComplete・Decision108追記**。Code commit **fd99134**・docs commit **186ec63** をmain pushし、HEAD／origin/main とも `186ec6371676e0ad9ab49368f2899bf9e4155f90` へ同期（ahead/behind 0/0）。**正式Tag `v1.01-apfr-correction-ui-core`（Annotated・target `186ec637...`）を作成しtag push済み**。**Render**：本番反映済み（トップ200／`/api/task-history`200／`/api/workflow-dashboard`200）。本番配信コードにCUI-2の5関数（`_apfrCorrectionTargetFor`／`_apfrStartCorrection`／`_apfrCancelCorrection`／`_apfrValidateCorrectionTarget`／`_apfrBuildCorrectionHeaderHtml`）すべて存在確認、`buildLeaderCaseContext`は本番0件のまま（**LCC Phase2は引き続き本番未リリース**）。**本番検証（区別）**：①**Complete**＝本番実データ（`case-msr9yckye65y`／プラファスト22 Fact）へread-onlyで適用し`resolved`21／`none`0／`ambiguous`0・訂正ボタン21件・Correction mode正常・facts不変・DB書き込み0を確認。②**Pending**＝本番URLが合言葉認証画面で停止しており**認証後の実ブラウザ目視確認のみ未実施**（正式リリース失敗ではない）。テスト（CUI-2 105/105ほか全PASS・新規FAIL 0・dev-check 200/200/200）は正式リリース前に再確認済み。**Data Safety**：Correction Fact登録0・本番Fact変更0・DB/API/`server.js`変更0・Render設定変更0。**正式現在地＝Correction Contract／Resolver／CUI-0／CUI-1／CUI-2すべてComplete・Correction UI Core CUI-0〜CUI-2＝正式リリースComplete**。**次工程＝本番認証後のCorrection UI最終目視確認**（ユーザー本人が実施・Fact登録ボタンは押さない）。**docs更新のみ・Code/DB/API変更0・Phase54 Complete維持・Phase55未着手**。以前: 2026-08-23（**APFR CUI-1 Current Fact / History UI 正式化Complete・Decision108追記**。Code commit **1cf3b2e**（main push済・Render自動Deploy反映確認済・**Tag未作成**）。APFRパネルが`product.facts`を全件フラット表示していたため、本番`listingNgWords`で旧`["法人名"]`と訂正`["商品名","法人名"]`が同じ見た目で並び**どちらが現在値か判断できない**状態を解消。**Phase 1 Resolverを初めてUIへ表示専用接続**し、現在値一覧は**`_apfrResolveCurrentFacts()`の結果のみ使用**（UI独自のcurrent判定を禁止・静的検証をテスト化）。`resolved`のみ表示／`none`は「○ 未登録」／**`ambiguous`はcurrentFactも候補代表も表示せず**理由のみ（fail-closed維持）。**全件フラット表示を廃止し「現在値一覧＋折りたたみHistory（既定閉）」へ分離**、Historyは全Fact保持・「現在値/過去の記録」は**Resolver結果から動的導出のみ**（旧Factへ`superseded`等を保存しない）。通常表示21行固定で**Factが増えても画面が比例して伸びない**。**boolean日本語表示を同時実装**（保存値`boolean`・`option value`とも不変）。`listingPolicy`は**normalizeせず保存値のまま表示**。CUI-1専用テスト**78/78 PASS**・既存回帰全PASS・**新規FAIL 0**・dev-check 200/200/200・localhost実機**Console Error 0**。残課題3（boolean日本語表示）は**Complete**へ、**CUI-2 Correction UI Coreは未実装**。**docs更新のみ・Code/DB/API/Fact変更0・Phase54 Complete維持・Phase55未着手**。以前: 2026-08-22（**APFR CUI-0 Correction-aware Duplicate Policy 正式化Complete・Decision108追記**。Code commit **9ad76f8**。Correction Contractの多段訂正のうち`A(1)`→`B(2, supersedes A)`→`C(1, supersedes B)`という**「元の値への差し戻し訂正」が`_apfrRecordsEqual()`に`supersedesFactId`が無く`duplicate_record`で誤拒否**されていた問題を解消。**`supersedesFactId`をduplicate identityへ追加**（8→9項目）。**全9項目一致の完全同一Correction Recordは従来どおり拒否＝duplicate防止は弱めない**。未設定は`|| null`方式で**property未存在／undefined／null／''を「訂正関係なし」として同一扱い**、**通常Recordのduplicate判定は不変**。**chain異常判定はduplicate関数の責務外でResolverがfail-closed処理**する責務境界を明記。**append-only不変**（`A→B→C`は3件保持・旧Fact mutation 0）。CUI-0専用テスト**65/65 PASS**・既存回帰全PASS・**新規FAIL 0**・dev-check 200/200/200・main push済み・**Render自動Deploy反映確認済み**・**CUI-0用Tag未作成**。現在地は Correction Contract／Resolver／Duplicate Policy＝**Complete**、**Correction UI＝未実装**。**docs更新のみ・Code/DB/API/Fact変更0・Phase54 Complete維持・Phase55未着手**。以前: 2026-08-22（**APFR Phase 0 再Adopt時Fact消失防止＋Phase 1 Current Fact Resolver Contract 正式化Complete・Decision108追記**。**Phase 0**（Code commit **d69ff60**）＝商品再Adopt時に登録済みAPFR Factが全消失する潜在的データ損失リスクを`_apfrCarryOverFacts()`で解消（**同一caseId かつ 同一productIdentifier のみcarry-over**・Cross-case/Cross-product 0・deep clone・入力非破壊・順序と訂正履歴を維持・40/40 PASS）。**Phase 1**（Code commit **46c51ef**）＝read-only純関数`_apfrResolveCurrentFact()`／`_apfrResolveCurrentFacts()`を追加し**Current Fact Resolver／Correction／Ambiguity（fail-closed）／Legacy Fallback／Step C開始条件**を正式化（①明示訂正chain優先→②明示関係皆無時のみ`recordedAt`最大→③一意決定不能は`ambiguous`＋`currentFact:null`）。**明示chain+独立legacy並存はambiguous／timestamp collisionは恣意的tie-breakerを使わずambiguous／sourceMethod自動優先なし**。**既存22 Factはmigration不要**・本番相当fixtureで**resolved 21/none 0/ambiguous 0**・70/70 PASS。既存回帰全PASS・**新規FAIL 0**・dev-check 200/200/200。**Resolverはread-only・UI未接続・Step C未接続**。新規Decisionは作成せずDecision108追記と判断。**docs更新のみ・Code/DB/API/Fact変更0・Tag/Push/Render未実施・Phase54 Complete維持・Phase55未着手**。以前: 2026-08-22（**APFR プラファスト本番実運用検証Complete・Decision108追記**。対象実案件`case-msr9yckye65y`／`["プラファスト","a8.net"]`／A8.netへユーザー本人が本番UIでAPFR_FIELD_ORDER全21フィールドを1件ずつ登録し、**21/21カバーComplete**・Fact総**22レコード**（`listingNgWords`訂正履歴1件含む・最新正Fact`["商品名","法人名"]`・**最新有効Fact基準で判定**）・**Contract違反0件**・**Cross-case混入0件**（32案件67 draft行走査）・Persistence確認済み。`sourceMethod`は`a8_screen_user_verified` 21／`advertiser_lp_user_verified` 1、**AI推測Fact昇格0件・`manual_user_input`単独Fact昇格0件**。無回帰：IADP 100/complete・Quality Gate Passed・Reviewer Passed・Strategy Accepted・User Approval Approved・EER 3件executed・Evidence 9件。残課題9件を分離記録（残課題1＝同一fieldへの複数Fact存在時の最新採用ルール未明文＝**Step Cの前提**）。**APFR実運用Complete≠EEA問題Complete／≠Quality Gate・Hold問題Complete**。**docs更新のみ・Code/DB/API/Fact変更0・Tag/Push/Render未実施・Phase54 Complete維持・Phase55未着手**。以前: 2026-08-20（**Phase IG-QC / B-7F Quality Gate Package Routing Fix 正式リリース・Decision105**。IADPを含むOutput DraftがInstagram投稿用`instagram` Quality Contract（hook/slideTitles/hashtags等10項目）へ誤接続されていた根本原因（Phase IG-QC）と、全Path A Output Typeで`buildOutputDraftFromLeaderFinal()`のreturn値から`packageQuality`が欠落し`evaluateQualityGate(undefined)`が実行されていた配線バグ（Phase B-7F補完）を修正した。正式IADP（`validation.valid===true`・`packageId`存在・`quality`算出済み）には`evaluateInstagramAccountDesignQuality()`の事前算出済み結果をrouting（非IADP・guard失敗は既存`evaluateOutputPackageCompleteness()`へfall-through）。全Path A Output TypeでQuality Gateへ実評価値が接続。既存Quality Contract・Executive Decision責務は変更なし。正式回帰テスト48/48 PASS。Leader Case Context Phase2は引き続き本番未commit。OpenAI API call 0・Claude API call 0・Web Search 0・DB変更なし。**`index.html`（2 hunk）／`iadpQualityContractRouting.test.js`（新規）のみ**（Code commit **547ddac**）。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程は対象案件`case-msr9yckye65y`のIADP専用Quality/Quality Gate/Account Creation Readinessを本番で再確認。詳細はDecision105参照。以前: **Claude Pricing Correction 正式リリースComplete・Decision104**。Claude Cost Log調査でclaude-opus-4-8が公式単価の3.000倍・claude-haiku-4-5が0.800倍という単価定数誤りを特定し、`claudeCostTracker.js`／`claudeClient.js`の`CLAUDE_PRICE_PER_1K`（Opus/Haiku値のみ・Sonnet無変更）を訂正した。計算式・重複計上防止・JPY換算・cache token（未使用）にはいずれも問題なし。Claude側にはCost Gateがそもそも存在せず機能面への影響はなし（表示・報告上の金額のみ）。非課金fixtureテスト全PASS、2026年8月Supabase実績を公式単価で再計算した合計$4.051303がAnthropic公式実績$3.93と残差約3%まで一致。working tree別系統差分「Leader Case Context Phase2」はcommitから除外。過去Cost EventはAudit Trailとして保持し遡及修正なし。DB Migrationなし。node --test既知6 FAILは無関係・新規FAILは0件。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。詳細はDecision104参照。以前: 2026-08-18（**IADP Structured Output 正式リリースComplete・Decision103**。実運用予定案件`case-msr9yckye65y`でIADP生成のValidation FAIL根本原因（IADP Leader Final呼び出しが自由記述のみに依存し、`finalProfile`トップレベル配置と`candidateComparison`/`adoptionDecision`出力を逸脱）を特定し、OpenAI Responses API `text.format:{type:'json_schema',strict:true}`をIADP Leader Final呼び出し1箇所のみへ追加。`shared/instagramAccountDesign.js`は無変更で既存安全契約（推測補完なし・自動水増しなし・validation緩和なし）を完全維持。合成テスト13件・EEA既存36件全PASS。実AI E2E（1 workflow・8 call）でSchema受理・`valid:true`・candidateComparison3件・adoptedCandidateId整合・finalProfileトップレベル正配置を実測確認。Cross-case混入なし。**別系統差分「Leader Case Context Phase2」（`buildLeaderCaseContext()`含む）は今回除外し、本番環境には現時点でこの関数が存在しない点を重要事項として記録**。**`openaiClient.js`／`index.html`（最小限）／`iadpStructuredOutput.test.js`のみ**（Code commit **8a9d417**）。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程はEvidence充足（EEA経路・ユーザー承認後）。詳細はDecision103参照。以前: 2026-08-18（**Deliverable Completion Architecture（STEP 6）正式リリースComplete・Decision102**。「AIが処理を終えた」ことと「依頼が本当に完了した」ことを分離するCompletion判定軸（`evaluateDeliverableCompletion()`・Contract v1.0.0・追加AI call 0）を新規採用し、既存`package_quality`JSONBへ`completionAssessment`を同梱保存・F5復元でdraftトップレベルへ再展開（新DB列なし）。案件切替直後のAuto Task開始でOutput Draft復元前にFormal Truthが引き継がれない実測済みRace Conditionを`scheduleOutputDraftRestore()`のPromise化＋`atRunWorkflow()`側awaitガード（sleep/setTimeout不使用）で解消し、carry-forwardを`FORMAL_CASE_FIELDS`契約全体（iadp／intelligenceContext／affiliateContext／approvedDecisionPackage）へ一般化。実AI E2E（`case-msoplrg6gdkr`・1 workflow）で事前見積りmax=5と実call数5が一致・Cross-case非混入を実測。Output EngineへComplete/Incomplete/Blockedの最小表示を追加し、`detectOutputType()`の`instagram_post`誤判定（`instagram_carousel`への混同）も修正。**`index.html`のみ**（Code commit **364b65a**）。node --test 81 PASS／6 FAILは既知pre-existing failure（`server.test.js`・本リリースと無関係）。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程はInstagram実運用を優先（ユーザー承認後）。詳細はDecision102参照。以前: 2026-08-13（**External Evidence Acquisition（EEA）正式リリースComplete・Decision101**。EEA-1〜EEA-12（Evidence schema拡張・Web Search Adapter・Search Plan+User Approval Gate・Evidence保存・実Web Search限定検証・Trust Tier/Independent Source/Verified Promotion評価・Trust Tier優先Selection+Category Coverage・Cost Tracker接続・Completion Gap Review・Verified Promotion Application設計+実装・Final Regression・Formal Release）を正式採用。2段階Promotion方式（batch全体＋既存正本を固定母集団として全candidate分先に判定確定・処理順非依存を合成テストで確認）でTrust Tier×Independent Source×claimType条件を満たしたWeb EvidenceのみverifiedへPromotion（Code commit **4bcf42e**）。Cost Trackerの二層構造（ローカルgate用state`cost-logs.json` vs Supabase実績正本`api_cost_events`）を正式記録し「Historical Cost Lost」表現を「Local Cost Gate State Historical Values Lost」へ訂正（Code commit **40ff550**）。QA専用case`case-msoplrg6gdkr`での実機検証（承認済み3クエリのみ）でverified Evidence5件・独立3件・Gate`sufficient`到達・F5復元Complete。Account Creation Readinessは`conditional`（Evidence起因ではなくuserApproval pending）。Search Planのquery数と実tool call数が一致しない場合がある仕様（実測3クエリ→6 tool calls）を記録。monetization mapping・Tier3/Tier6 allowlist・Category Coverage Gate化は改善候補、Auto Task接続・Researcher直接統合は将来機能として保留。新規DB table・schema変更なし。合成テスト36件全PASS・Console Error 0・実Web Search1回（承認済み3クエリのみ）・追加API実行0回。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程はInstagram実運用またはPhase55判断（ユーザー承認後）。詳細はDecision101参照。以前: 2026-08-12（**IADP / LFS Navigation & Scroll Usability Improvement 正式リリースComplete・Decision100**。Code commit **0309086**（`index.html`のみ・+99/-11）。IADP⇄LFS直接ジャンプ・チャット上端/下端固定ジャンプ・`#chat-area`スクロールバー操作性改善（幅6px→14px・Windows既定矢印ボタン非表示化）を追加。実機確認で「スクロールバーの一部分しかドラッグできない」不具合が判明し、`document.elementFromPoint()`のピクセル単位スイープ調査で根本原因を特定：既存の`id="knowledge-panel"`重複バグ（📚ナレッジエンジン用と🧠顧客記憶パネル用が同一ID）により顧客記憶パネル側が画面外へ完全退避できず`#chat-area`のスクロールバー帯の大半を覆っていた。**Edge/Chromiumのネイティブスクロールバー仕様が原因でないことを実測で確認済み**。最小修正として衝突IDの片方（顧客記憶パネル側）のみ`company-memory-panel`へ改名。副次効果として顧客記憶パネル（🧠会社知識数）が今回初めて正しく開閉できるようになった。Cross-case安全性・ユーザーWindows/Edge実機確認とも完了（Complete）。Console Error 0・dev-check 200/200/200・`git diff --check` CLEAN・実AI実行0回。IADP/LFS/Evidence/Quality Gate/Reviewer/Strategy/adoptionDecision/User Approval/Output Draft保存契約/Researcher/Analyst/DB/schema/APIはすべて無変更。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程はExternal Evidence Acquisition（設計調査完了・未実装）。詳細はdocs/04DECISIONS.md Decision100参照。以前: 2026-08-11（**IADP Post-Release Hotfix / Hotfix-Quality / Stability Hotfix 正式リリースComplete・Decision099**。Decision098（IG-2J-A〜I）後の実運用確認でIADP生成物の構造・品質不備（①JSON末尾`}`不足②finalProfile誤配置③adoptionDecision誤配置④KPI5がnull⑤first30DaysOperatingPolicyが配列）が判明し、Post-Release Hotfix（Code commit **585360c**）→Hotfix-Quality（Code commit **4b92f0d**）→Stability Hotfix（Code commit **936cd77**）の3工程で解消した。専用新規テスト案件`case-msoplrg6gdkr`での実AI再検証（費用¥52.62・上限¥100以内）で前回FAILの5件すべて解消を確認：JSON parse成功・synthetic closer recovery不発動／finalProfile・adoptionDecisionとも正位置／KPI5全項目number型（保存率15・プロフィール遷移8・フォロー率3・CTR4・CVR5）／first30DaysOperatingPolicyがstring型。Reviewer Passed／Strategy Accepted／Quality Gate Passed／User Approval Pending／Output Draft汚染なし／F5復元一致／Cross-case独立性維持（実案件3件・既存テスト案件2件をバイト単位で無傷確認）／Console Error 0／dev-check 200/200/200。**結果はAccount Creation = Not Ready（Evidence Insufficient）＝Decision097 Ready正式条件が正常に機能した結果でありFAILではない**。実AI dispatchは2回発生（1回目はAuto Task自動開始OFFでLeaderチャット応答のみ、2回目でAuto Task一時ONにより全工程完走）し、**成果物を生成した完全なAI社員Workflow実行は1回のみ**。1回目dispatchの残置pending Task 12件はDB直接削除禁止のためKnown Test Dataとして残置。過去引継ぎの実案件「4件」表記は今回実測3件と異なる。KPI改善条件の判定期間記述が弱い点は将来の軽微な品質改善候補として記録。**server.js／DB／supabase/schema.sql／API契約は全工程で無変更**。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。詳細はdocs/04DECISIONS.md Decision099参照。以前: 2026-08-10（**Phase IG-2J-A〜I Instagram Account Design Self-Completion / AI Action Rerun 正式リリースComplete**＝Decision097（IG-2F〜IG-2I）後の実運用確認で判明した9つのUX・品質問題（逆質問だけで停止／結論が見づらい／確認事項の分散／採用案不一致／構造99点と実運用品質の混同／Evidence不足でも完成に見える／生JSON残存／AI会社で決められる事までユーザーへ質問／自律処理不足）を、IG-2J-A〜Hの8工程で解消し、IG-2J-Iの最終統合検証を経てDecision098として統合正式採用した。**IG-2J-A**＝Self-Completion Mode（4担当が情報不足でも逆質問だけで停止せず事実／AI仮説／外部確認待ち／User Input Requiredを分離して成果物を返す。数値の捏造は禁止。通常WorkflowのSystem Promptは完全同一文字列を維持。Code commit **d95f196**）。**IG-2J-B**＝Leader Final Summary（チャット最新位置へ実運用可否/採用候補/採用理由/構造充足/Evidence/内容品質/Reviewer/Strategy/Quality Gate/Approvalを要約表示。既存カード・ELR・Leader Final本文は削除せず維持。構造充足99%と実運用品質を明確に分離。Code commit **7a33296**）。**IG-2J-C**＝AI Action / User Input分離（reason code＋決定論的分類でaiActions/userInputsへ正式分離。ターゲット・ジャンル・投稿頻度・KPI等はAI会社が決めユーザーへ質問しない。Code commit **244cad2**）。**IG-2J-D**＝採用案Single Source of Truth（正本を`intelligence.adoptionDecision.adoptedCandidateId`へ統一。**総合点1位を自動採用しない**。比較表は表示時のみ正本へ整合し保存副作用なし。Final Profile不一致は文字列補正せず安全側Not Ready。Code commit **144b0ff**）。**IG-2J-E**＝Intelligence実数値の担当指示注入（既存`fields.intelligenceContext`を4担当の指示文へ注入。Fact/Prediction/Unknownを分離し裏付けEvidenceのない数値は必ずPrediction。新Engine/新DB/新APIなし。Code commit **fa91cae**）。**IG-2J-F**＝Evidence正本接続（正本を`fields.intelligenceContext.evidence[]`へ接続。Verified/Derived/Unknownを分離し派生・推定を検証済み件数へ算入しない。fieldStatusはlegacy fallbackとして維持。Code commit **d7d21dd**）。**IG-2J-G**＝成果物正規化（reply wrapperとjson fenceの構造ノイズのみ除去。通常文章・一般コードブロック・正式構造JSONは不変。原文は`task.rawResult`へ保持。Code commit **7ff4140**）。**IG-2J-H**＝AI Action自律再実行接続（Summaryからユーザーが1回開始すると必要担当だけを既存Auto Task経路で再実行→Reviewer→Strategy→Leader Final→IADP再評価まで完走。新Workflow Engineなし。自動起動なし／二重実行防止／案件3回・code2回の上限／Cross-case guard／stale QG guard／Approval自動承認なし。Code commit **f845db0**）。**IG-2J-I**＝最終統合検証（回帰**441項目全PASS**・**実AI End-to-End 1回PASS**・API追加費用**約¥30**・実案件書き込み0件・テストデータ**remaining=0**・Console Error 0・dev-check 200/200/200）。**server.js／DB／supabase/schema.sql／API契約は全工程で無変更**。**Annotated Tag v1.01-instagram-account-design-self-complete・main push（540411e..32b0821）・tag push・Render反映・PC本番確認・iPhone Portrait実機確認すべて完了**（docs commit 32b0821／iPhone LandscapeはKnown Issue継続）。**Phase54 Complete維持・Phase55未着手**。次工程＝Instagram実運用準備／実運用開始。以前: 2026-08-09（**Phase IG-2F〜IG-2H IADP Quality / Approval / Quality Signals 正式採用（正式リリース）**＝IADPがComplete/100点/Readyと誤表示される問題を3工程で解消し統合正式採用（Decision097）。**IG-2F**＝判定を構造検証／内容品質／Evidence／Readiness／User Approvalの5軸へ分離する`assessInstagramAccountDesignPackage()`追加（既存評価関数は無変更で内部再利用）。Evidence 0件・担当成果物不足・Leader統合回答不足をComplete化禁止、legacy安全判定、Summary UI潰れ（26px）解消（Code commit **b5a3d5e**）。**IG-2G**＝User Approvalを`fields.iadp.approval`へ永続化・caseId＋packageId一致時のみ有効・新IADPで旧承認無効化・承認後即時Ready再評価（Code commit **18fc04b**）。**IG-2H**＝Reviewer／Strategy／Quality Gateを正式接続。Quality Gateは既存正本を読むのみで再実行せず、Reviewer／Strategyは既存resultsから多シグナル導出（単純キーワードだけでfailed判定しない）。既存Workflow順は変更せず`_liCollectIntegration()`直後に後から再評価する方式、`fields.iadp.assessmentContext`へsnapshot保存・packageId一致検証（Code commit **4dd0400**）。**Ready正式条件**＝構造Passed＋内容Complete＋Evidence非Insufficient＋Reviewer重大不足なし＋Strategy再設計要求なし＋Quality Gate Passed＋Leader統合回答あり＋必須担当成果物あり＋User Approval Approved。**Path B**は`qualityGate===null`のためComplete/Readyへ到達しない安全側仕様として正式容認。**Background Execution**はVersion1.1後半の大型工程として方針のみ記録（未実装）。**Known Issue**＝Reviewer NG keyword partial-match issue追加。**データ保全ルール**＝実案件変更時はbackup→test→restore→restore確認必須（IG-2G/2Hは専用テスト案件・実案件書き込みゼロ）。詳細は下記「Phase IG-2F〜IG-2H」セクション参照。**index.html／shared/instagramAccountDesignQuality.jsのみ変更・server.js/DB/schema.sql/API契約は無変更**。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Instagram実運用（未着手・実AI費用はユーザー承認後）。以前: 2026-08-06（**Phase IG-2E Instagram Account Design Package Output Draft Integration 正式採用**＝IADPを既存Output Draft永続化へ正式接続（Decision096）。①保存＝IADP検証成功時に`fields.iadp`へ格納し既存`pushOutputDraftToServer()`／`POST /api/output-drafts`を利用。②復元＝新設`_iadpApplyRestoredFields()`が`restoreOutputDraftFromServer()`（起動時／案件切替時）の復元結果からIADPセッションキャッシュを同期しIADPカードを自動再表示。③1 Case 1 正本＝`createOutputDraft()`実行直前に既存`fields.iadp`を退避し新Draftへ引き継ぎ、同一案件内で他Auto Taskを実行しても消えないようにした。IG-2D（実AI検証・IADP構造化JSON品質調整・Code commit **ecfed0c**）に続くIG-2E（Code commit **0fb943e**）。**index.htmlのみ変更**（`server.js`/`shared/instagramAccountDesign.js`/`shared/leaderRuleEngine.js`/`supabase/schema.sql`無変更・新規API/DBカラムなし）。既存案件を利用し実AI追加実行なしでブラウザJS経由の保存・F5復元・案件切替・cross-case guard・後方互換を実測確認（Console Error 0）。詳細は下記「Phase IG-2E」セクション参照。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Path B／Content Planning／Carousel Builder／Publishing Readyの実動作回帰確認（未着手・ユーザー承認後）。以前: 2026-08-06（**Phase B-9F Leader Rule Engine 正式リリース（Phase B-9C〜B-9F統合）**＝Decision094に基づくLeader統合回答プロンプト改善（B-9C）と、共通Leader Rule Engine（`shared/leaderRuleEngine.js`）の新規実装・Path A/Path B/手動Leader再生成3経路接続（B-9D-1〜5A）・統合検証（B-9E前半静的53アサーション全PASS・後半実API3経路検証）を正式リリースした（Decision095）。共通Core（`normalizeLeaderRuleInput`/`evaluateLeaderRuleFacts`/`buildLeaderRulePromptBlock`）は事実整理専用（採否・重複・矛盾・Evidence判定は行わない）。Reviewer/Strategyはmain件数除外・Prompt Block単一挿入・fail-open・Injection耐性を維持。Code commit：92cc49a/d194ba1/0bd3a88/756d867/22ca87c。実API検証費用約¥32.38（承認上限¥100以内）。詳細は下記「Phase B-9F」セクション参照。**server.js/DB/schema.sql/API契約は既存互換**。**Phase54 Complete維持・Phase55未着手**。次工程候補＝意味的重複/矛盾検出実装検討・Completion Gate調査（未着手・ユーザー承認後）。以前: 2026-08-05（**Phase B-9B Leader統合回答・会社正式回答責務 正式採用（Decision094・docs正式化のみ）**＝Phase B-9A調査結果をもとに、Leader統合回答（Path A `LEADER_FINAL_PROMPT`／Path B `leaderSummary()`が生成する最終回答テキスト）の責務を正式化した。用語分離（「Leader Summary（ELR表示）」＝Phase B-8までに完成済みの事後表示セクション／「Leader統合回答」＝今回の対象）・Leader統合回答は会社として唯一の正式回答・AI社員回答は社内検討資料・LeaderはCEO相当の最終統合責任者・要約ではなく統合（重複除去/矛盾解消/Evidence比較/採用/保留/却下判断/品質統一/依頼範囲への絞り込み）・成果物ファースト・情報不足の最終判断はLeaderに帰属・Gate系（Quality Gate/Completion Gate/Executive Decision/Constitution Validator）との責務分離・既存Leader Integration Layer（`_liCompareArtifacts()`等）を将来Leader Final生成前へ構造化JSON（`{duplicateTopics,conflicts,recommendedAdoptions,holds,rejections,evidenceNotes}`）として接続する方針・Path A/Bの構造差（Path Aはサーバー側単一リクエスト内完結のため介入不可・Path Bはクライアント側制御のため接続しやすい）を正式記録。詳細は下記「Phase B-9B」セクション参照。**今回はdocs正式化のみでコード・プロンプト・DB・API変更は一切なし**。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-9C（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-04（**Phase B-8 Quality Gate Executive Leader Report表示 正式Complete（Phase B-8A〜B-8D統合・正式リリース）**＝Phase B-7で正式採用したQuality Gate結果（`inbox.qualityGate`）をExecutive Leader Report内へ表示専用セクションとして追加した（Decision093）。新規表示関数`_elrBuildQualityGateHtml(qualityGate)`（純粋関数・グローバル非参照・不正データ時は空文字列）を追加し、既存`_elrBuildReportHtml(decision, inbox, validation)`のシグネチャは変更せず、既存の第2引数`inbox`から`inbox.qualityGate`を読み取る。表示位置はExecutive Summary→Constitution Structure Check→Quality Gate→Leader Summaryの順。通過時「🟢 Passed（complete＝完成／almost_ready＝ほぼ完成）」・非通過時「🟡 Not Passed（needs_work＝要改善／insufficient＝情報不足）」を表示し`score`は非表示。固定注記「現在のQuality Gateは成果物品質の初期判定（表示のみ）です。Executive Decision・Output Draft保存は制御しません。」を常設。表示対象はPath A・手動Leader再生成のみでPath B（`inbox.qualityGate===null`）は完全非表示。Phase B-8A（調査・設計・コード変更なし）→B-8B（表示実装・index.htmlのみ+52/-0・Code commit **04bf9c1**）→B-8C（Path A・手動Leader再生成・Path B dispatch3経路の実API統合検証。Path A=`sourceMode:'auto_task'`・Quality Gate=Not Passed（`needs_work`）・Output Draft保存1回・ELR/Quality Gateとも1件を実測。手動再生成=新規decisionId発行・再評価正常。Path B=`inbox.qualityGate===null`・Quality Gateセクション完全非表示・Output Draft生成なしを実測。Cross-case誤表示なし・F5後消失・Console Error 0・Network全200）→B-8D（正式リリース）の4段階で完成。既存`_elrRefreshInChatArea()`・Cross-case判定はそのまま再利用（変更なし）。**server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**。詳細は下記「Phase B-8」セクション参照。以前: 2026-08-04（**Phase B-7 Quality Gate 正式Complete（Phase B-7D〜B-7H統合・正式リリース）**＝Output Package Quality（`packageQuality`）を正本入力・単軸とするQuality Gateを正式採用した（Decision092）。Phase B-7A〜B-7C（調査・設計・責務再定義・閾値実データ調査）で通過基準を`packageQuality.status IN ('complete','almost_ready')`と確定、Phase B-7D（安全リファクタ・Code commit **f866d4d**）で`buildOutputDraftFromLeaderFinal(finalText, opts, targetDraft)`へ第3引数`targetDraft`を追加しfields構築対象のみを引数化（省略時は`_lastOutputDraft`使用・既存呼び出し2箇所は完全後方互換）、Phase B-7E（評価位置接続・Code commit **0f104d3**）で`_lastOutputDraft`とは独立したcandidate Draft`{type,fields:{}}`を`_liCollectIntegration()`内`_edRunDecisionEngine()`直前で生成し`candidateOnly:true`早期returnでfields構築とpackageQuality算出のみを行い保存を伴わず`inbox.qualityGate`へ結果格納、Phase B-7F（実判定実装・Code commit **1a92884**）で`evaluateQualityGate(packageQuality)`へ`{executed:true,passed,status:'passed'|'failed',sourceStatus}`を返す実判定ロジックを実装、Phase B-7G（統合検証・コード変更なし）でindex.htmlから直接抽出した合成テスト14/14 PASSと3経路（Path A・手動再生成・Path B）の実APIテストで因果順序を実測確認、Phase B-7H（正式リリース）でdocs更新・commit・tag・push・Render反映・PC/iPhone本番確認まで完了した。**Path Bは正式に対象外**（Output Draft候補生成契約が存在しないため`inbox.qualityGate===null`が正常仕様・Decision087継承）。詳細は下記「Phase B-7」セクション参照。以前: 2026-08-03（**Phase B-6 Constitution Gate 正式Complete（Phase B-6A〜B-6D統合・正式リリース）**＝Constitution Structure Check正式採用（Phase B-5C・Decision090）で表示のみだったConstitution Validator Coreの検証結果を、Approved Decision Packageの複製可否判定（Path A `atRunWorkflow()`／手動Leader再生成`atTriggerLeaderFinal()`それぞれの`fields.approvedDecisionPackage`受け渡し条件）へ「狭域Constitution Gate」として接続した（Decision091）。Phase B-6A（調査・設計）で広域Gate案・狭域Gate案を比較検討し狭域案を正式採用、Phase B-6B（実装・Code commit **9436fec**）で既存のsourceDecisionId一致・caseId一致に加え`_constitutionValidation`存在／decisionId一致／caseId一致／`result.passed===true`の4条件をANDで追加（不成立時はfail-closed・例外なし。Validator本体・Executive Decision Engine本体・Package生成ロジック・Output Draft本文は無変更）、Phase B-6C（実APIテスト・回帰確認）でAuto Task1回・手動Leader再生成1回・Path B dispatch1回を実施し3経路とも正常完了・Constitution Structure Check Passed（12/12）・Console Error 0・Network全200 OKを確認、Phase B-6D（正式リリース）でdocs更新・commit・tag・push・Render反映まで完了した。3経路とも`decisionStatus`は`hold`のため`approvedDecisionPackage`は常に`null`であり、Gate追加が既存正常系動作へ副作用を与えないことを実測確認済み。詳細は下記「Phase B-6」セクション参照。以前: 2026-08-03（**Phase B-5C Constitution Structure Check 正式Complete（Phase B-5C-1〜B-5C-3統合・正式リリース）**＝Constitution Validator Core（Phase B-5・Decision089）の検証結果をExecutive Leader Report内の独立セクション「Constitution Structure Check」として表示し、Auto Task・手動Leader再生成・Path B（dispatch成立時）の完了直後に即時反映されるところまで完成（Decision090）。Phase B-5C-1で`_constitutionValidation`を`{decisionId, caseId, result}`ラッパー化（Code commit **a2834d3**）、Phase B-5C-2で`_elrBuildReportHtml()`へvalidation引数を追加しPassed/Violations表示・rule技術詳細折りたたみ・安全側正規化を実装（Code commit **9e6d094**）、Phase B-5C-3で`_elrRenderIntoChatArea()`の挿入方式を`insertBefore`化し新設`_elrRefreshInChatArea()`（チャット全体を再構築しない限定更新）を3経路へ接続（Code commit **58315ee**）。実APIテスト（Auto Task1回・手動再生成1回・Path B dispatch1回・実測概算¥12）で即時反映・dispatchなし時の無反応・Cross-case・F5リセット・Output Draft/Output Engine無変更を確認。詳細は下記「Phase B-5C」セクション参照。以前: 2026-08-03（**Phase B-5 Constitution Validator Core 正式Complete**＝Executive Decision Engineが確定させたDecision（Approved Decision Package内包）をExecutive Constitutionに照らして検証する読み取り専用の`validateExecutiveDecision(decision)`を追加した（`_edRunDecisionEngine()`内`_executiveDecision = decision;`確定直後に実行・失敗時もEDE本体・後続処理は止めない）。戻り値`{version, passed, violations, checkedRules}`のみを`_constitutionValidation`へセッション内保持（F5で消失・永続化なし・Decision/Package/Output Draftへの書き込みは一切なし）。検証対象は`executive_decision_exists`／`decision_id_present`／`decision_status_present`／`executive_summary_present`／`decision_confidence_present`／`source_decision_id_consistency`／`package_only_when_approved`／`package_null_when_not_approved`／`output_draft_did_not_generate_package`（既存`affectsOutputDraft===false`を参照）／`package_holds_source_decision_id`／`cross_case_consistency`／`single_decision_authority`の12項目（Executive Decision・Approved Decision Package・案件スコープの構造整合性検証のみ）。Node合成テスト13シナリオ26アサーション全PASS・実APIテスト（Auto Task1回＋手動Leader再生成1回・低コストプロンプト）でPath A（`sourceMode:'auto_task'`）・手動再生成（`sourceMode:'manual_regeneration'`）とも`passed:true・violations:[]・checkedRules12件`を実測確認・Executive Leader Report／Output Draft／Output Engine／F5復元／案件切替いずれも既存挙動を維持（Console Error 0・Network 200のみ）。Path B直接チャットも試行したがdispatch非発生のため`_liCollectIntegration()`は起動せず（既存仕様どおり）、コードレベルでPath Bも同一経路（`_liCollectIntegration()→_edRunDecisionEngine()→validateExecutiveDecision()`）を通ることを確認。**Executive Constitution全14条の完全な意味論的検証・Evidence内容の十分性判定・成果物品質/完成度の実質評価・Constitution違反によるOutput停止・Validator結果のUI表示（Executive Leader Report含む）・Quality Gate・Completion Gate・Decision Ledger・Executive Memoryはいずれも未実装**。Code commit **ea1ae68**（`feat: add executive constitution validator`・+122/-1・index.htmlのみ）。**server.js/lib/DB/schema.sql/API/UI（Executive Leader Report・AI社員カード期限表示含む）無変更**。Decision 089・tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Validator結果のExecutive Leader Report表示／Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-03（**Phase B-4 Approved Decision Package 正式Complete（Phase B-4A〜B-4D統合・Phase B-4E統合検証）**＝Executive Decision Engineが会社判断イベントを表す`decisionId`を状態（approved/rejected/hold/insufficient）に関わらず必ず1回発行（Phase B-4A・`_edRunDecisionEngine()`冒頭で生成）。Approved Decision Packageは`sourceDecisionId`で元Decisionを参照する派生契約とし、独自ID発行なし・Approved時のみ生成（Hold/Rejected/Insufficientは常にnull）。Path A通常フロー（Phase B-4B・`atRunWorkflow()`）と手動Leader再生成（Phase B-4C・`atTriggerLeaderFinal()`・専用変数`_manualApprovedPackageForOutput`/`_manualPkgCandidate`で誤流用防止）の両経路から`buildOutputDraftFromLeaderFinal()`へPackageを受け渡し、caseId・sourceDecisionId不一致時は古いPackageを流用せず安全にnullへ破棄。Phase B-4Dで`fields.approvedDecisionPackage`へ複製保存（参照そのまま格納・Packageなし時は明示的にキー削除し残留防止）。所有関係はExecutive Decision Engineが正本・Output Draftの`fields.approvedDecisionPackage`は利用者側の複製（将来Decision Ledgerが永続正本）。Phase B-4Eで13項目の合成テスト全PASS・実APIテスト（Auto Task1回＋手動再生成1回・decisionId相違確認・fields保存確認・F5復元確認・案件切替Cross-case確認・Console Error0・Network200のみ）を実施し、`buildOutputDraftFromLeaderFinal()`冒頭の古いコメント（Phase B-4D実装前の記述のまま）という軽微な不整合のみを発見しコメントのみ修正（commit **b423acd**・ロジック変更なし）。通常運用ではdecisionStatusがApprovedへ到達しないためApproved Decision Packageは常に`null`が正常結果。Constitution Validator・Quality Gate・Completion Gate・Decision Ledger・`fields.executiveDecisionCache`はいずれも未実装のまま次工程（Phase B-5以降）。**Code commit 718f200（B-4A）＋67ab6cb（B-4B）＋95beda3（B-4C）＋65fe551（B-4D）＋b423acd（コメント修正・単独commit）**。**server.js/lib/DB/schema.sql/API/UI（AI社員カード期限表示含む）無変更**。Decision 088・tagなし・**push未実施**（ユーザー確認後に別途判断）。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-5 Constitution Validator（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-02（**Phase B-2 Executive Decision Control 正式工程分割（Phase B-2A／B-2B）・docs正式化のみ**＝Executive Decision Engine Core（Phase B-1・正式Complete維持）の次工程着手前に因果接続方式を調査。Path A通常フロー（`atRunWorkflow`）はAI社員実行〜Leader Final生成（`runLeaderFinalResponse()`）がサーバー側単一HTTPリクエスト内で完結し、クライアント側EDEはLeader Final生成前のデータへ介入できない構造的制約を実測確認。Leader Final候補生成後・Output Draft確定前にEDEを接続する段階導入方式（案D）を正式採用し、既存Phase B-2を**Phase B-2A（Path A通常フローの因果位置確立・対象はatRunWorkflow()のみ）**と**Phase B-2B（手動Leader再生成の整合化・対象はatTriggerLeaderFinal()）**へ正式分割（Decision087）。手動Leader再生成が完成成果物エンジンではなく軽量な`leaderSummary()`を使用し、EDE入力（`_wlLastResults`）が前回Auto Task時点のスナップショットのまま今回生成結果と紐づいていないことを実測発見したためB-2Bとして分離。Path B通常チャットはOutput Draft生成自体が存在しないためOutput Draft制御対象外のまま維持。Leader Final Candidate内部契約（`sourceEngine`で区別）・Quality/Completion Gate未定義期間はdecisionStatusをapprovedへ到達させない方針・追加AI実行なしを正式決定。ロードマップをPhase B-1（Complete維持）→**B-2A→B-2B**→B-3（旧B-2相当）→B-4（旧B-3相当）→B-5（旧B-4相当）→A-2〜A-4→C-1〜C-3→D-safety→D→E→F-1〜F-2へ改訂。今回は**docs正式化のみでコード・DB・API・UI変更は一切なし**。tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-2A（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-02（**Phase A-1g Executive Constitution v1.0.0 正式化・docs正式化のみ**＝Leader Integration Layer Phase A（Decision084/085）正式Complete後、次工程着手前にAI COMPANY全体の上位アーキテクチャを正式設計。Executive Constitution（全14条・AI COMPANY最高位ルール）とExecutive Decision Engine（既存`_leaderIntegration`を因果連鎖内へ昇格させる会社判断層。新規独立Engineではない）を正式採用（Decision086）。Executive ReportとOutput Engine完成成果物（既存`LEADER_FINAL_PROMPT`）は置き換えず併存。状態3軸分離（decisionStatus新設・既存`OUTPUT_STATUS`/`packageQuality.status`は無変更）・Decision Confidence（既存`_intelCalculateConfidence()`再利用＋Hard Gate・新加重式は発明しない）・Strategic Alternatives（Primary1/Secondary2/Hold3・順位と判断状態は別軸）・Approved Decision Package（後方互換必須・Package不在時は既存Workflow維持）・保存方式（段階導入案D・Phase Bメモリのみ→Phase C-1で専用`executive_decisions`永続化・`output_drafts`はPRIMARY KEY`output_id`のupsert上書き方式のためDecision Ledger正本として使用しない）を正式決定。正式ロードマップをPhase A-1g→**Phase B-1〜B-4**（Executive Decision Engine Core／Executive Leader Report表示／Approved Decision Package契約化／Constitution Validator）→Phase A-2〜A-4（順序変更・内容無変更）→**Phase C-1〜C-3**→D-safety→D→E→**Phase F-1〜F-2**（Executive Memoryは最後段）へ改訂。今回は**docs正式化のみでコード・DB・API・UI変更は一切なし**。tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-1 Executive Decision Engine Core（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-01（**AI COMPANY Leader Integration Layer（Phase A）後半 正式リリースComplete**＝Phase A本体に続き3工程を正式リリース。①messages案件別正本化：`server.js`の`/api/auto-task`・`/api/consult`の`saveMessage()`計4箇所へ既存受領済みcaseIdを追加。②Leader Final状態サマリー分離：`runLeaderFinalResponse()`でcompleted成果は既存どおり統合しつつerror/skippedを分離しLeaderへ渡す（全員成功時は既存プロンプトと完全一致）。③Output Draft誤認防止：`buildOutputDraftFromLeaderFinal()`へ`noCompletedResults`判定を追加し、completed成果0件時はstatus:'ready'ではなく`OUTPUT_STATUS.ERROR`・Package Qualityを`score:0・insufficient`へ固定（工程3統合検証で「status:'ready'・87点良好評価」という誤認問題を実測発見し工程3-2で解消）。正常系・一部成功・completed成果0件の3パターンをlocalhost実DBで検証しCross-case混入なし・新規case_id=NULLなし・二重保存なし・Console Error 0・dev-check 200/200/200。**`index.html`＋`openaiClient.js`のみ**（工程1 Code commit **5401b68**／工程2 Code commit **6032893**／工程3-2 Code commit **0d125e7**）。**server.js（messages案件別正本化を除き）・DB・schema.sql・API 無変更**。Decision 085・tag **v1.01-leader-integration-phase-a-complete**・**main push・Render反映・PC本番確認 完了**（ユーザー実施・ログイン/Auto Task/Leader Integration Layer/AI社員振り分け/Leader Final/Output Engine/Task同期/案件切替すべて正常・Cross-case混入なし・Console Error/Network異常なし・iPhone実機確認は対象外）・**AI COMPANY Leader Integration Layer（Phase A）正式Complete**・**Phase54 Complete維持・Phase55未着手**。次工程＝未定（Phase A-2〜A-4は設計のみ完了・実装未着手。またはmessages RLS対応・Task skipped同期ギャップ対応等の残課題）。以前: 2026-07-31（**AI COMPANY Leader Integration Layer（Phase A）正式リリースComplete**＝LeaderをPath A（Auto Task）／Path B（Leader手動チャット）双方の成果物を回収・比較・矛盾候補検出・採否候補判定する統合管理層へ拡張。`_liCollectIntegration()`が各Pathの末尾（Leader Final受領直後／手動Leader Final再生成直後）から1回だけ呼ばれ、`_liAdaptPathA`/`_liAdaptPathB`が既存データ（`_wlLastResults`／`chatHistory`）を共通Leader Inbox形式へ変換。保存はクライアント一時メモリ（`_leaderIntegration`）のみ・新DB/新API/追加AI実行なし。Path Bは`interactionId`（`_liPathBSession`）でworkflowIdと分離管理し過去回答混入を防止。矛盾候補・採否候補は必ずcandidate/hold（安全側既定値）。**実装過程で発見した既存不具合を同一リリースでHotfix**＝`atTriggerLeaderFinal()`冒頭に`_liCurrentCaseId()`と`_liLastPathAResultsCaseId`の厳格一致ガードを追加し不一致時は安全停止。実機検証でHotfix適用前の混入事故を確認し既存POST経路で復旧・孤立Draft限定削除・検証専用案件削除。dev-check 200/200/200・Console 0。**index.htmlのみ**（Phase A本体 +336/-6 Code commit **ad5eaf7**／Hotfix +11/-0 Code commit **af43263**）。**server.js/lib/DB/schema.sql/API/既存Path A・Path B内部処理/switchCase()/chatHistory構造/Output Draft保存仕様 無変更**。Decision 084・tag **v1.01-leader-integration-phase-a**・**main push・Render反映・PC/iPhone実機確認はこれから**（ユーザー承認後）・**Phase54 Complete維持・Phase55未着手**。次工程＝未定（Phase A-2〜A-4は設計のみ完了・実装未着手）。以前: 2026-07-30（**Affiliate Intelligence Company 工程8-1/8-2/8-3A/8-3B/8-3B補正/8-3C Market Opportunity Intelligence 正式リリースComplete**＝ランキングカード・AIC最小パネル・Copy Full ReportへMarket Opportunity表示追加（Competition直下）。`intelligenceContext.market`へ現在案件内の同一市場候補商材群を案件内集約（案C）で保存（新規入力なし・外部データなし）。共通ヘルパー`_intelSyncMarketGroupProductEvidence`が市場内対象商材群の既存Product Evidenceへ`usedBy:'market'`冪等追記。採用時七書き・既存push1回（採用1回=POST1回・Market専用POSTなし）。**工程8-3B補正**：derived集計対象とEvidence/Confidence母集団の不一致を発見・共通ヘルパー新設で修正。実Supabase検証（専用caseId・商材2件）：productCount=2・Evidence28件中22件が両商材にまたがる・derived集計値実測一致・**テストデータ限定削除 remaining=0**（3テーブル）。純関数・UI・保存・補正テスト計115アサーション全PASS・dev-check 200/200/200・Console 0。**index.htmlのみ**（foundation +172/-0 Code commit **2de9317**／ui +174/-0 Code commit **4ef70ca**／persist +32/-0 Code commit **e61e7d5**／fix +28/-9 Code commit **3b1e5b7**）。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue/ASP/Content/Competition/ランキング順位/integratedScore/estimatedProfit 無変更**。Decision 083・tag **v1.01-affiliate-market-opportunity-persistence**（予定）・**main push・Render反映・PC/iPhone実機確認はこれから**（ユーザー承認後）・**Phase54 Complete維持・Phase55未着手**。次工程＝未定。以前: 2026-07-29（**Affiliate Intelligence Company 工程7-1/7-2/7-3A/7-3B/7-3C Competition Intelligence 正式リリースComplete**＝ランキングカード・AIC最小パネル・Copy Full ReportへCompetition表示追加（Content直下）。`intelligenceContext.competition`（新規モジュールキー）へ競合環境3項目（競合数・案件寿命・IG適性）をProduct Evidence共有参照で保存（新規生成なし）。採用時`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`＋`competition`六書き・既存push1回（採用1回=POST1回・Competition専用POSTなし）。★Confidenceは競合環境の根拠充足度を示すのみで競合の強弱・参入余地・推奨可否は示さない。実Supabase検証（専用caseId）：Evidence14件不変（product14/revenue9/asp4/content3/competition3・新規0）・Competition Confidence Medium（64点・independent3件）・F5復元一致・**テストデータ限定削除 remaining=0**（affiliate_evaluations・output_drafts・cases の3テーブル）。純関数23/23 PASS・dev-check 200/200/200・Console 0。**index.htmlのみ**（foundation +107/-1 Code commit **675b3d0**／ui +117/-0 Code commit **3feec7b**／wire +28/-0 Code commit **d941cfd**）。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue/ASP/Content/ランキング順位/integratedScore/estimatedProfit 無変更**。Decision 082・tag **v1.01-affiliate-competition-intelligence-persistence**（予定）・**main push・Render反映・PC/iPhone実機確認はこれから**（ユーザー承認後）・**Phase54 Complete維持・Phase55未着手**。次工程＝未定。以前: 2026-07-29（**Affiliate Intelligence Company 工程6-1/6-2/6-3A/6-3B/6-3C Content Intelligence 正式リリースComplete**＝ランキングカード・AIC最小パネル・Copy Full ReportへContent表示追加（ASP直下）。`intelligenceContext.content`へInstagram投稿適性3項目（保存率予測・クリック率予測・IG適性）をProduct Evidence共有参照で保存（新規生成なし）。採用時`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`五書き・既存push1回（採用1回=POST1回・Content専用POSTなし）。実Supabase検証（専用caseId）：Evidence14件不変（product14/revenue9/asp4/content3）・Content Confidence Medium（64点・independent3件）・**テストデータ限定削除 remaining=0**（両テーブル）。回帰テスト118/118 PASS・node --check OK・dev-check 200/200/200・Console 0。**index.htmlのみ**（foundation +113/-0 Code commit **2b3fdd0**／ui +126/-0 Code commit **f2b0b5e**）。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue/ASP/ランキング順位/integratedScore/estimatedProfit 無変更**。Decision 081・tag **v1.01-affiliate-content-intelligence-persistence**（予定）・**main push・Render反映・PC/iPhone実機確認はこれから**（ユーザー承認後）・**Phase54 Complete維持・Phase55未着手**。次工程＝未定。以前: 2026-07-28（**Affiliate Intelligence Company 工程5-3（5-3A/5-3B/5-3C）ASP Intelligence 表示UI・永続化 正式リリースComplete**＝ランキングカード・AIC最小パネル・Copy Full ReportへASP表示追加（Revenue直下）。採用時`affiliateContext`＋`product`＋`revenue`＋`asp`四書き・既存push1回（採用1回=POST1回・ASP専用POSTなし）。実Supabase検証（専用caseId）：Evidence12件不変（product12/revenue9/asp4・重複なし）・F5復元で推奨/Confidence/比較数/Independent/updatedAt完全一致（再計算なし実証）・caseId分離・Copy確認・Product/Revenue/ranking回帰なし・**テストデータ限定削除 remaining=0**（両テーブル）。純関数 工程5-3A/5-3B27＋工程5-1/5-2再実行44＝**71/71 PASS**・dev-check 200/200/200・Console 0。**index.htmlのみ +146/-0**（Code commit **b473053**）。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue/ランキング順位/integratedScore/estimatedProfit 無変更**。Decision 080・tag **v1.01-affiliate-asp-intelligence-persistence**・**main push・Render反映**・**PC本番確認・iPhone実機確認 完了（2026-07-28・ユーザー実施・崩れなし・横スクロールなし・白画面/無限ロードなし。保存済み案件なしのためProduct Intelligence保存済み表示/💾表示は確認対象外）**・**Phase54 Complete維持・Phase55未着手**。次工程＝未定）。以前: 2026-07-28（**Affiliate Intelligence Company 工程5-1・5-2 ASP Intelligence正式リリースComplete**＝③ASP層を比較説明レイヤーとして追加。`intelligenceContext.asp`（正規化商品名×market単位グルーピング）へActive評価のみ候補化（`_aicIsPersisted`）／推奨ASPは既存`estimatedProfit`最大＋決定的タイブレーク（新式なし）／Evidenceは新規生成せず採用商品Evidenceにのみ`usedBy:'asp'`冪等追記／ASP Confidence（`_intelCalculateAspConfidence`）は既存`_intelCalculateConfidence`再利用・母集団`usedBy:'asp'`のみ・独立3件未満Insufficient・**比較ASP数/有効利益候補2件未満は強制insufficient**・Product/Revenue Confidenceと分離／順位・integratedScore・estimatedProfit式・Product/Revenue Intelligence 無変更。純関数 工程5-1 18＋工程5-2 26＝**44/44 PASS**・dev-check 200/200/200・Console 0・Supabase書込み0・AI API実行0。**index.htmlのみ +212/-0**（Code commit **17587296c9413f53dcc05e4c72897ac4e8d0643a**）。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue 無変更**。**表示UI・永続化・F5復元は工程5-3へ分離（未実装）**。Decision 079・tag **v1.01-affiliate-asp-intelligence**・**main push・Render反映**・**iPhone実機確認 完了（2026-07-28・ユーザー実施・崩れなし）**・**Phase54 Complete維持・Phase55未着手**。次工程＝ASP Intelligence 工程5-3（表示UI・永続化・F5復元））。以前: 2026-07-27（**Affiliate Intelligence Company 工程4 Revenue Intelligence 正式リリースComplete（4-1〜4-4）**＝⑤Revenue層を読み取り専用説明層として追加。`intelligenceContext.revenue`（財務入力7＋派生2）へProduct Evidenceを `usedBy:'revenue'` 共有参照（新規生成なし・件数不変）／Revenue Confidence＝`_intelCalculateConfidence`再利用・財務入力Evidenceのみ母集団・独立3件未満Insufficient・Product Confidenceと分離／AIC最小パネル＋カードRevenueライン（順位不変）／採用時 `affiliateContext`＋`product`＋`revenue` 同一Draト両書き・**採用1回=POST1回**・保存済み優先表示💾・旧Draトはプレビューfallback。**実Supabase保存/F5復元/POST1/表示復元POST0/限定削除 remaining=0** 確認。純関数31＋31・表示12・永続化15 全PASS・dev-check 200/200/200・Console 0・回帰なし。**index.htmlのみ +230/-1**（Code commit **8cde936**）。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/順位/`_intelCalculateConfidence`本体/Product 無変更**。Decision 078・tag **v1.01-affiliate-revenue-intelligence**・**main push・Render反映**・**iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・横スクロールなし・空状態正常）**・**Phase54 Complete維持・Phase55未着手**。次工程＝ASP Intelligence調査・設計）。以前: 2026-07-27（**Affiliate Intelligence Company 工程3 Product Intelligence 正式化・工程3-3 正式Complete**＝採用時に `fields.affiliateContext` ＋ `fields.intelligenceContext.product` を同一Output Draftへ**両書き**し既存 `pushOutputDraftToServer` で**1回保存**（採用1回=POST1回）。一時変数で構築→必須項目/caseId6項目一致ガード→全成功時のみ一括反映・deep copy後にproduct生成・`_intelSaveContext`不使用。**実Supabase保存/F5復元/同一商品Evidence非増殖(14→14)/別商品Product置換・旧Evidence保持(14→28)/テストデータ限定削除 remaining=0(draft=null)** 確認。隔離テストA〜F全合格・dev-check 200/200/200・Console 0・回帰なし。**index.htmlのみ**（工程3-1 **28fa51c** +159/-0／工程3-2 **1d04f31** +49/-0／工程3-3 **3ef7495** +58/-10）。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/ランキング順位/Confidence計算式/工程3-2表示関数 無変更**。Decision 077・tag **v1.01-affiliate-product-intelligence-persistence**・**main push・Render反映**・**iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・空状態正常）**・**Phase54 Complete維持・Phase55未着手**）。以前: 2026-07-26（**Affiliate Intelligence Company 工程2 Evidence/Confidence 共通基盤 実装・実機検証完了**＝`outputDraft.fields.intelligenceContext`（JSONB）へ Evidence共通型/Confidence共通型/`_intel*` helper/AICパネル最小表示を追加。**index.htmlのみ +372/-0**・**server.js/lib/DB/schema.sql/API 無変更・新DB列/新APIなし**・**affiliateContext/_icpDeriveTopic/Workflow Wiring 未変更**。純関数18/18・dev-check 200/200/200・実Supabase保存/F5復元/POST1回/affiliateContext併存/削除remaining=0 確認・Code commit **29d82c1**・tag **v1.01-affiliate-intelligence-evidence-confidence**・**main push・Render反映済み・iPhone実機確認完了＝工程2 正式Complete**・Decision 076・**Phase54 Complete維持・Phase55未着手**）。以前: 2026-07-24（**Instagram自動運営 Workflow Wiring 本体 完了・本番反映済み**＝commit 745dd1e・tag v1.01-instagram-planning-wiring・Decision 075）。以前: 2026-07-23（**Affiliate Evaluation 工程1 完了（クローズ）**＝工程1-D調査の結論として **P2〜P6は実装不要・保留継続を正式決定**（Decision 074）。工程1-A〜1-Dが揃い商材選定→投稿企画への接続基盤が完成。**実装なし・docs更新のみ**。次工程＝**Instagram自動運営（Workflow Wiring）**。**Phase54 Complete維持・Phase55未着手**）。以前: **Affiliate Evaluation 工程1-C（案A）schema.sql記録 完了**＝実DB定義を読み取り専用SELECTで実測（30列・PK・UNIQUE・CHECK・Index・RLS・Trigger/FKなし）し正本として **`supabase/schema.sql` へ純追記**（+76/-0・driftなし）。**記録用でありMigrationではない**・**DDL実行なし・実DB無変更・server.js/lib/index.html/API 無変更**。P2〜P6を工程1-D以降候補として保留（Decision 073）。**Phase54 Complete維持・Phase55未着手**・**commit未実施**）。以前: **工程1-B本体 Active Case Hotfix**＝本番通常経路の読み取り確認で「案件未確定ビューでも『案件を追加』が有効＝直前案件へ保存され得る」不具合を検出・修正。原因＝`getCurrentApprovalCaseId()` の `_lastOutputDraft.caseId` フォールバック。Affiliate専用 **`_aicCurrentCaseId()`** 追加・AIC内4箇所を統一・**`getCurrentApprovalCaseId()` 無変更**。**index.htmlのみ +17/-4**・localhost Case1〜4合格・**POST/PATCH/DELETE 0回**。**Phase54 Complete維持・Phase55未着手**）。以前: **Instagram自動運営 工程1-B本体（Workflow Wiring）Complete**＝Affiliate Intelligence Core と永続化APIを接続。**index.htmlのみ +390/-4**・server.js／lib／DB／Migration／API shape **無変更**。**第2段階 localhost実DB検証 Case1〜9 全合格**・**テストデータ削除完了（remaining = 0）**・**未commit**。**Phase54 Complete維持・Phase55未着手**）。以前: **工程1-B-0a〜0d 完了**＝Affiliate評価のActive一意性を**商材単位**へ移行。**Migration完了**（`uq_affiliate_eval_active_product` 適用・旧 `uq_affiliate_eval_active_case` 廃止）・**`lib/affiliateEvalDb.js` 実装完了**（Code commit **2ef2ad3**・+36/-6）・**実DB POST検証 全8ケース成功**・**専用テストデータ削除済み**（`remaining = 0`）。**Phase54 Complete維持・Phase55未着手**）。以前の更新: 2026-07-21（**社員向上B 正式完了**（B-1／B-2-1／B-2-2a〜g 完了・定義駆動基盤完成・**13型中11型移行済み**・**Flyer/LP 正式保留**）・**localhost検証完了・push前・Render未反映**。HEAD **61dde05**／origin/main **ac2f5da**／local ahead **7**／最新Tag **v1.01-phase54-video-html-section-migration**。**Phase54 Complete維持・Phase55未着手**。次の最優先＝**Instagram自動運営機能**）。以前の更新: 2026-07-17（**Phase54 正式Complete維持**。**改善案件 工程A（設定保持）完了**・**localhost確認済み**・**HEAD 8c9ed58**・tag **v1.01-phase54-agent-settings-persistence**＝Auto Task／自律相談を端末内localStorage保持。**autoStart復元は設定・表示のみ＝起動時のWorkflow・AI自動実行なし**（課金防止設計を維持）。**端末間同期は非対象**。**Phase55未着手・工程B以降は未着手**。**前工程Hotfixの本番実機確認は保留**。以前：**Task新規作成 二重化 Hotfix 完了**・本番反映済み・**localhost確認済み**・**HEAD 39b44d0**・tag **v1.01-phase54-task-create-dbid**＝`submitTask()` の dbId 誤代入と `atCreateNextTasksFromItems()` の dbId 握り潰しを修正・全7作成経路を統一。既存の重複16グループは**未整理・別途判断**。**Phase55未着手**。以前：**Task一括操作 Hotfix 完了**・本番反映済み・**localhost実機確認済み**・**HEAD deba2ed**・tag **v1.01-phase54-task-bulk-parallel**＝一括アーカイブ／復元／完全削除を**同時5並列化**・進捗表示／二重実行防止／成功ごとの保存を追加。**Phase55未着手**。以前：**Task表示仕様変更 完了**・本番反映済み・**PC/iPhone実機確認完了**・**HEAD bbfbc73**・最新tag **v1.01-phase54-task-sort-newest**。先行して **Case成功確認契約 完了**（aed5f7d）・**案件系Known Issue 全Close＝Case同期系Complete**。**Phase55未着手**。以前：Phase54 Known Issue（Task表示不一致）Complete・HEAD a5bbe27／Phase54 Remaining Realtime Sync 正式Complete・tag v1.01-phase54-complete／Phase54 Hotfix・commit d512bad）

---

## IADP Structured Output（正式リリース・2026-08-18・Decision103）

> 記録日: 2026-08-18。**Phase54 Complete維持・Phase55未着手**。**`openaiClient.js`／`index.html`（最小限）／`iadpStructuredOutput.test.js`のみ**（Code commit **8a9d417**）。**`shared/instagramAccountDesign.js`／server.js／claudeClient.js／DB／supabase/schema.sql／API契約は無変更**。

- **進捗**：実運用予定案件のIADP生成FAIL調査 → 根本原因確定（自由記述依存の構造的脆弱性） → IADP Structured Output実装 → 非課金検証 → 実AI E2E ＝ **正式リリースComplete**。
- **起点**：Instagram実運用へ戻る過程で、実運用予定の既存案件`case-msr9yckye65y`に正式IADPを生成しようとしたところ、`InstagramAccountDesign.validateAccountDesignPackage()`がinvalidを返し`fields.iadp`が未保存となるFAILが発生した。
- **根本原因調査**：`extractIadpJsonFromLeaderText()`はJSON抽出に成功し`normalizeAccountDesignPackage()`も正常完了したが、`finalProfile`がトップレベルではなく`fieldStatus`内へオブジェクト値として誤配置され正規化時に内容が消失、かつ`intelligence.candidateComparison`／`intelligence.adoptionDecision`自体が出力されていなかった。IADP Leader Finalの`ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT`は正しい完全サンプルJSON・絶対規則の明示・10点自己チェックリストまで含めて正式schemaを正確に要求しており、Prompt契約自体に不備はなかった。`callOpenAI()`が`response_format`/`json_schema`等のAPI側スキーマ強制を一切使わない素のフリーテキスト補完（`temperature:0.7`のみ）であることを実測確認し、過去に同一Prompt・同一APIパスで正しいIADPが生成された実例（`case-msoplrg6gdkr`）も存在することから、自由記述の指示遵守のみに依存する構造的脆弱性と判定した。
- **IADP Structured Output実装**：OpenAI Responses API（`https://api.openai.com/v1/responses`）の`text.format:{type:'json_schema',strict:true}`（`developers.openai.com/api/docs/guides/structured-outputs`で仕様を実測確認・推測せず）を`callOpenAI()`へ`options.structuredOutput={name,schema}`という新規任意経路として追加し、**IADP Leader Final呼び出し1箇所のみ**で有効化。他の全`callOpenAI()`呼び出し（Researcher/Analyst/Branding/SNS/Reviewer/Strategy/通常Leader Final等）は無影響（合成テストで実測確認）。
- **Schema設計**：`IADP_STRUCTURED_OUTPUT_SCHEMA`は`shared/instagramAccountDesign.js`のValidatorが実際に検証・消費するフィールドのみを対象とし、Validatorより強い意味制約は追加しない。`normalizeAccountDesignPackage()`が常に上書き・自動生成する`version`／`packageId`／`caseId`／`approval`／`decisionMadeBy`／`evaluationAxes`／`minCandidates`はモデルへ要求しない。strict:true制約（全プロパティrequired・全objectにadditionalProperties:false）を静的自己検証しエラー0件。`candidateComparison.candidates`は`minItems:3`でAPI側強制。`fieldStatus`は動的辞書をstrict modeで表現できないため`{path,status}[]`配列として受け取る設計。
- **プロンプト本文は無変更**：`ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT`は意図的に一切変更していない。strict modeの制約付きデコードが出力チャネル自体をschema準拠JSONへ強制するため、旧来のタグ関連指示は実行時に単に無害化される（大規模プロンプト書き換えという高リスク変更を回避）。
- **`extractIadpJsonFromLeaderText()`の後方互換拡張**：既存の`<IADP_JSON>`タグ抽出ロジックは1行も変更せず、タグが見つからない場合のみ応答全体を直接JSONとしてパースする最小adapterを追加。`fieldStatus`配列は`normalizeFieldStatusMap()`が期待する既存の辞書形へこの場でのみ変換する。
- **Formal Truth安全契約の完全維持**：`adoptedCandidateId`の推測生成なし・candidate不足時の自動水増しなし・`marketResearch.candidates`（市場ジャンル候補）から`candidateComparison.candidates`（アカウント設計案比較）への自動コピーなし（両者は別責務と確定）・`finalProfile`の推測補完なし・validation失敗時の非保存維持・validation条件の緩和なし。`shared/instagramAccountDesign.js`は1行も変更していない。
- **非課金合成テスト（`iadpStructuredOutput.test.js`・新規13件）**：Schema strict-mode自己検証・callOpenAI()の非structuredOutput呼び出し非干渉確認・Schema指定時のtext.format送信確認・有効fixture・candidate不足・adoptedCandidateId欠落・adoptedCandidateId不整合・正常系・finalProfile誤配置Hotfix確認・今回実際に発生したfieldStatus内オブジェクト誤配置パターンの再現とFormal Truthへの非流出確認・タグ付き/タグなし両経路のフルパイプライン確認、全13件PASS。EEA既存36件・`FORMAL_CASE_FIELDS`（4項目不変）・Completion Case A/B/C・既存`<IADP_JSON>`タグ形式後方互換もあわせて再確認しPASS。
- **実AI E2E検証**：`case-msr9yckye65y`で1 workflow・実call8（見積り一致）を実行。Responses APIがSchemaを受理（`fallback:false`・純粋JSON応答・`<IADP_JSON>`タグ0件・400エラー等の拒否なし）。`validateAccountDesignPackage()`が`valid:true`（`errors:[]`）、`candidateComparison.candidates`3件（10軸スコア充足・水増しなし）・`adoptionDecision.adoptedCandidateId`が実在候補と一致・`finalProfile`がトップレベルに正しく配置（前回FAILの直接原因が再発しないことを実測確認）。Evidence 0件・Quality Gate failed・Readiness not_readyは正直な未達状態として維持（推測補完なし）。他7 case・STABILITY案件（`case-msoplrg6gdkr`）は完全不変（Cross-case混入なし）。User Approvalはpending不変。OpenAI cost増分+$0.96・Claude cost増分+$0.2028838・Web Search 0回。
- **⚠ 重要な引き継ぎ事項**：working treeに存在した別系統の未commit差分「Leader Case Context Phase2」（`buildLeaderCaseContext()`／`_leaderCaseContextToText()`を含むcaseId伝播一式）は、今回のIADP Structured Outputと機能的依存がないため意図的に除外した。同一ファイル内で隣接・混在していた箇所（`openaiClient.js`の`runLeaderFinalResponse`関数シグネチャ等）はクリーンHEADを基点に本リリース分のみを再構成した専用パッチで、hunk単位ではなく行単位で分離しcommitした。**本番環境には現時点で`buildLeaderCaseContext()`が存在しない**（clean HEADに一度も含まれたことがない）。Formal Truthの一括参照が必要な今後の作業では、この関数が別途正式リリースされているか必ず確認すること。

---

## Deliverable Completion Architecture（STEP 6）（正式リリース・2026-08-18・Decision102）

> 記録日: 2026-08-18。**Phase54 Complete維持・Phase55未着手**。**`index.html`のみ**（Code commit **364b65a**）。**server.js／openaiClient.js／claudeClient.js／DB／supabase/schema.sql／API契約は無変更・新規API/新規DBカラム/新Engineなし**。

- **進捗**：STEP 6 工程1（Completion Core）→ 工程2（Completion保存接続）→ Formal Truth Race Condition安全化 → Formal Truth復旧 → 実AI E2E → 工程3（Completion UI／Output Type改善）＝ **正式リリースComplete**。
- **本Phaseの起点**：既存システムには「AIが処理を終えた」ことと「依頼が本当に完了した」ことを分離する正式なCompletion判定がなく、`task.status='completed'`や`Output Draft status='ready'`がAIの返答だけで成立し得た。
- **STEP 6 工程1 Completion Core**：`OUTPUT_PACKAGE_QUALITY_CHECKS`へ`required:true/false`属性を追加のみ（既存score計算は無変更）。純関数`evaluateDeliverableCompletion(draft, context)`（Contract v1.0.0）がoutputType別required項目の充足から`complete`／`incomplete`／`blocked`を判定。`blocked`は必須成果物充足済み＋外部実行語（公開して／投稿して等）＋User Approval pendingの組み合わせでのみ発火。合成テストCase A（complete）／Case B（incomplete）／Case C（blocked）全PASS。
- **STEP 6 工程2 Completion保存接続**：`buildOutputDraftPayloadForServer()`が既存`package_quality`（JSONB）へ`completionAssessment`を同梱保存（新DB列なし）。`_outputDraftFromServerRow()`がDB復元時に`package_quality.completionAssessment`をdraftトップレベルへ再展開。`completionAssessment`は`FORMAL_CASE_FIELDS`へ含めない（次Draftへcarry-forwardしない・成果物固有の評価のため）。
- **Formal Truth Race Condition安全化**：`switchCase()`がOutput Draft復元（`restoreOutputDraftFromServer()`）の完了を待たないfire-and-forget設計のため、案件切替直後にAuto Taskを開始すると`FORMAL_CASE_FIELDS`のcarry-forwardが不成立になる実測済み競合を発見。`scheduleOutputDraftRestore()`を実際の復元Promiseを返す方式へ変更し、`atRunWorkflow()`が`_lastOutputDraft.caseId`不一致時のみ復元完了をawaitするガードを追加（sleep/setTimeout不使用）。単一field（iadp）限定だったcarry-forwardを契約全体（iadp／intelligenceContext／affiliateContext／approvedDecisionPackage）へ一般化。
- **Formal Truth復旧**：上記競合の再現検証中に`case-msoplrg6gdkr`で発生した`iadp`/`intelligenceContext`欠落を、ユーザー承認を得て直前の正常Draftから2項目限定マージで復旧（他fields・他列は不変・Cross-case書き込みなし）。復旧後`buildLeaderCaseContext()`実測でEvidence sufficient／Verified5／Independent Source3／Quality Gate passed／Readiness conditional／User Approval pendingを確認。
- **実AI E2E**：`estimateAutoTaskCalls()`（純関数・追加AI call 0）の事前見積りmax=5に対し実call数5（Claude3＝Company Brain`claude-opus-4-8`・Reviewer・Strategy／OpenAI2＝sns・Leader Final`gpt-4.1-nano`系）で一致。新規Draft`out_1786976475516`（type=`instagram_post`）でFormal Truth carry-forward・completionAssessment DB保存/F5復元一致・他7 case完全不変（Cross-case非混入）・想定外カスケードなし・Web Search0回を実測。OpenAI cost増分+$0.17・Claude cost増分+$0.1632238。
- **STEP 6 工程3-A Completion UI**：Output Engineパネルへ`buildCompletionStatusHtml()`による最小表示（Complete/Incomplete/Blockedの短縮バッジのみ・内部contract全体は非表示）を追加。`completionAssessment`が存在しない既存Draftは非表示（Complete扱い・推測表示のいずれもしない）。
- **STEP 6 工程3-C Output Type判定精度改善**：`detectOutputType()`の`instagram_post`キーワードへ`instagram`/`インスタ`裸トークンを追加。carousel固有語（カルーセル／スライド／10枚／投稿画像／リール）を含まない一般的なInstagram投稿依頼が、裸`instagram`トークンしか持たない`instagram_carousel`側へ誤判定される実バグを修正（13型代表フレーズ再判定で回帰なし・既存fallback`document`維持）。
- **非課金回帰確認**：inline script構文OK・`git diff --check` CLEAN・dev-check 200/200/200・EEA既存合成テスト36件全PASS・Completion Case A/B/C全PASS・Output Type代表テスト全PASS・`FORMAL_CASE_FIELDS`不変（4項目のまま）・Quality Gate不変・User Approval不変・`draft.status`不変・Cross-case安全性確認済み。
- **node --testの既知状態**：81 PASS／6 FAIL。FAIL6件は`server.test.js`のLeader固定返信テキスト正規表現不一致（応答文言ドリフト）であり、本リリース（`index.html`のみ）とは無関係のpre-existing failureと確認。今回は修正していない。
- **未commit差分の扱い**：working treeに存在した別系統の差分「Leader Case Context Phase2」（Leader dispatch各関数への`caseId`伝播。`claudeClient.js`／`openaiClient.js`／`server.js`および`index.html`一部hunk）はSTEP 6と機能的依存がないため、`index.html`をhunk単位で分離し今回のcommit対象から意図的に除外した。別途ユーザー判断でリリースする。
- **責務境界**：Completionは「依頼に必要な成果物が揃ったか」のみを判定する。Quality Gate（成果物品質）・Constitution（会社原則）・User Approval（本人承認・読み取り専用参照のみ）・Formal Truth Priority（Case Context正本利用）とは責務分離し重複判定・書き換えを行わない。`status=ready`をCompletion=completeへ読み替える経路もない。

---

## ASP Product Fact Record（APFR）─ Step A Core／Step B Manual Input UI（正式リリース・2026-08-21）／プラファスト本番実運用検証Complete（2026-08-22）／Phase 0 再Adopt時Fact消失防止＋Phase 1 Current Fact Resolver＋CUI-0 Correction-aware Duplicate Policy（2026-08-22）／CUI-1 Current Fact / History UI＋CUI-2 Correction UI Core（2026-08-23・Decision108）

- **背景**：Instagram実運用側（別チャット）でA8.net実商品「肝斑シミ用美白ジェル プラファスト」の提携が完了し、Program ID・報酬額・EPC・確定率・Cookie期間・提携状態・商品リンク・法令/ASP制約等の実値が取得された。既存Evidence Contractの読み取り調査（判定B）で、Affiliate Evaluation手動入力経路は`sourceMethod`/`verificationStatus`が常に`null`・`reliability`が固定`unknown`であり、「A8実画面確認」と「一般的な手入力」を区別できないこと、Program ID・提携状態・商品リンクURL・法令/ASP制約を保持するfield自体が存在しないことを確認した。
- **Contract**：正式名称「ASP Product Fact Record（APFR）」。EER（行為のFormal Truth）とは責務分離し、APFRは「現実世界の商品事実」のFormal Truthを保持する契約。`classification`は`fact`/`prediction`/`inference`/`unknown`の4値。**AI自身の判断による`fact`昇格を禁止**——`sourceMethod`が`a8_screen_user_verified`/`advertiser_lp_user_verified`かつ`verificationStatus:user_verified`の場合のみFact昇格可、`manual_user_input`単独では不可。
- **保存方針**：`output_drafts.fields.intelligenceContext.product.facts`（既存JSONB・1 Record=1 field）。新規DB table/column/API/Migrationいずれも不要。既存`intelligenceContext.evidence[]`/`product.inputs{}`/`asp`/`affiliateContext`・Product/ASP Intelligenceのscore式・Quality Gate等の既存判定は一切変更しない。
- **重要原則**：APFR Complete≠全Quality/Hold/EEA問題Complete（Evidence不足でもQuality Gate Passedとなりうる経路等はAPFR後の別工程で再評価）。
- **Step A Core正式実装**：`_intelBlankProduct()`へ`facts:[]`追加。`validateApfrRecord()`（必須field・Fact昇格条件・入力非破壊）と`_apfrAppendRecord()`（caseId/productIdentifier guard・重複防止・履歴保持）を実装。`intelligenceContext`の既存carry-forwardにそのまま乗るため専用配線不要。合成テスト`apfrCore.test.js`：**49/49 PASS**。Code commit **3113e53**。
- **Step B Manual Input UI正式実装**：Affiliate Intelligence Core内、ASP Intelligence直後へAPFR入力パネルを追加。classificationは自由入力させず、provenance（A8実画面／広告主LP／その他手入力）＋User Verification明示チェックからのみ内部確定。A8/LP選択時は未チェックだと登録ボタンdisabled。必ずStep A Coreを経由し独自Validatorは実装しない。localhost実機検証（専用テスト案件）で13項目確認・検証後原状復帰済み。合成テスト`apfrManualInputUi.test.js`：**35/35 PASS**。Code commit **1e8de4f**。
- **正式リリース（2026-08-21）**：docs release commit **f6caf23**・Annotated Tag **v1.01-apfr-core-manual-input**・main push・tag push・Render反映済み。この時点では実案件（`case-msr9yckye65y`）へのAPFR登録・プラファスト評価・投稿生成はいずれも未実施（実案件登録0件・プラファスト未登録）。
- **本番実運用検証Complete（2026-08-22）**：ユーザー本人が本番UIでプラファストのAffiliate Evaluation登録・商品採用を実施しAPFRパネル出現を確認した上で、**APFR_FIELD_ORDER全21フィールドを1フィールドずつ登録**（対象`case-msr9yckye65y`／productIdentifier`["プラファスト","a8.net"]`／ASP `A8.net`）。結果は**21/21カバーComplete**・Fact総**22レコード**（`listingNgWords`のみ訂正履歴として旧Fact`["法人名"]`が残存し最新正Factは`["商品名","法人名"]`。**総レコード数ではなく「21フィールドすべてに正しい最新Factが存在するか」で判定**）。
- **Contract整合性・Provenance**：全22レコードで**Contract違反0件**（宣言type（string/number/boolean/array）と実保存値type全一致・`caseId`／`productIdentifier`全件一致・`factId` 22件unique）。最新有効21Factはすべて`classification:'fact'`／`verificationStatus:'user_verified'`／`verifiedBy:'user'`。`sourceMethod`は`a8_screen_user_verified` 21件・`advertiser_lp_user_verified` 1件（`regulatoryCategory`のみ）で、**AI推測によるFact昇格0件・`manual_user_input`単独からのFact昇格0件**（Fact昇格禁止原則を実運用で完全維持）。
- **Persistence／Cross-case**：Supabase `output_drafts`（`out_1787060723866`）から直接read-only再取得し全22レコードの永続化を確認。全32案件・67 draft行を走査し`case-msr9yckye65y`以外のAPFR Fact保持draftは**0件**・外部Fact混入**0件**。
- **無回帰（実測）**：IADP Quality=**100/complete**（validation valid・missingRequiredFields 0）・Quality Gate=**Passed**・Reviewer=**Passed**・Strategy=**Accepted**・User Approval=**Approved**（approvedAt不変）・External Execution=**3件executed**・Evidence=**9件**（異常変化なし）。
- **実運用で判明した仕様事実**：①配列型は`_apfrNormalizeUiValue()`が改行／半角カンマ／全角読点の3種のみで分割（JSON配列形式は非対応）。②同一fieldへの再登録は既存Factを置換せず追記（履歴保持設計どおり）。そのため**同一fieldに複数Factが存在する場合の最新採用ルールがContract上未明文**であることが判明（残課題1・Step C前提）。③`itpSupported`はbooleanのみでA8表示「ITP対応 7days」の日数保存field不在（残課題2）。
- **残課題（Completeとは分離）**：①最新採用ルール未明文（Step C前提）②ITP日数field不在③boolean日本語表示④`listingPolicy`「一部ok」表記統一⑤フィールド選択UI（巨大select・スクロール・検索性）⑥APFR直接ジャンプ導線⑦入力省力化（21項目1件ずつの負担）⑧EEA問題（Decision101・別途未解決）⑨Quality Gate／Hold制御問題（別問題）。**APFR実運用Complete≠EEA問題Complete／≠Quality Gate・Hold問題Complete**。
- **今回の変更範囲**：docs更新のみ。**Code変更0・DB変更0・API変更0・Fact追加/削除/編集0**（Claude Codeは全工程読み取り専用確認のみ）。**Tag作成・push・Render反映は未実施**。Leader Case Context Phase2は本docs commitへ不混入・引き続き本番未commit。
- **Phase 0 再Adopt時Fact消失防止（2026-08-22・Code commit `d69ff60`）**：商品採用処理が`_intelSyncProductFromAffiliate()`→`_intelBlankProduct()`（`facts:[]`）由来の新productを`ctx.product`へ丸ごと代入するため、**同一商品を再Adoptすると登録済みAPFR Factが全消失する**潜在的データ損失リスクを発見・解消した。純関数`_apfrCarryOverFacts()`を追加し、**同一caseId かつ 同一productIdentifier の場合のみ**carry-over（別case／別商品は0＝Cross-case/Cross-product guard）。`productIdentifier`は既存仕様どおり**文字列**として厳密一致比較（独自normalizeなし）。deep clone・入力非破壊・配列順と訂正履歴を維持。永続化される経路は商品採用の1箇所のみで他5箇所は使い捨てctxであることを実測確認。合成テスト`apfrReadoptCarryOver.test.js` **40/40 PASS**。APFR Contract変更なし・本番再Adopt実行0。
- **Phase 1 Current Fact Resolver（2026-08-22・Code commit `46c51ef`）**：APFRは追記専用のため読み取り側で正本を決める責務が必要になる。read-only純関数`_apfrResolveCurrentFact(product, field)`／`_apfrResolveCurrentFacts(product)`を追加し、**Current Fact Resolver／Correction／Ambiguity（fail-closed）／Legacy Fallback／Step C開始条件**の各Contractを正式化した。戻り値は`{status:'resolved'|'none'|'ambiguous', currentFact, candidates, reason}`。合成テスト`apfrCurrentFactResolver.test.js` **70/70 PASS**、実装との等価性を機械比較で確認済み。
- **解決順序**：①明示訂正chain（任意field`supersedesFactId`）を最優先（`recordedAt`より優先）→②明示関係が対象field内に皆無の場合のみ`recordedAt`最大（legacy fallback）→③一意決定不能は`ambiguous`＋`currentFact:null`。母集団はcaseId/productIdentifier/field完全一致かつ`validateApfrRecord()` validのみで、**Cross-case・Cross-product・invalid Factは除外**（より新しくても採用しない）。
- **安全側の設計判断**：**明示chainと独立legacyの並存は`multiple_chain_terminals`でambiguous**（どちらも勝手に選ばない）／**timestamp collisionは恣意的tie-breaker（factId辞書順・配列順・sourceMethod・value）を使わずambiguous**／**sourceMethodによる自動優先順位を設けない**／単一Factでもorphan・self referenceがあればambiguous。ambiguous reasonは12種（`self_reference`／`orphan_reference`／`cross_field_reference`／`cross_case_reference`／`cross_product_reference`／`branched_chain`／`circular_chain`／`multiple_chain_terminals`／`recordedAt_collision`／`invalid_product`／`invalid_product_scope`／`invalid_field`）。
- **既存Factへの影響**：**migration不要**。`listingNgWords`はlegacy fallbackにより新Fact`["商品名","法人名"]`をresolvedし、旧Fact`["法人名"]`は削除されず`candidates`に残存。本番相当fixture（21 field/22 records）で**resolvedCount=21・noneCount=0・ambiguousCount=0**。
- **Step C開始条件**：Step CはResolverをFormal Truthの唯一の読み取り口として使用し、`resolved`のみ利用可・`none`はFactなし・`ambiguous`は利用禁止（fail-closed）。**Step C側が`facts`配列を直接走査して独自に「最新」を判断する方式は禁止**。今回Step Cは実装しない（Resolverはread-only・UI未接続・Step C未接続・DB書き込み0）。
- **Phase 0/1 回帰**：`apfrCore.test.js`（49/49）／`apfrManualInputUi.test.js`（35/35）／`externalExecutionRecord.eer1.test.js`（51/51）／`iadpQualityContractRouting.test.js`（86/86）／`iadpStructuredOutput.test.js`（13/13）／`evidencePromotion.eea10b.test.js`（17/17）／`costTracker.eea8.test.js`（19/19）**全PASS・新規FAIL 0**。dev-check **200/200/200**。DB変更0・API変更0・`server.js`変更0・APFR Fact変更0・Leader Case Context Phase2不混入。
- **CUI-0 Correction-aware Duplicate Policy（2026-08-22・Code commit `9ad76f8`）**：Phase 1で正式化したCorrection Contractが表現する多段訂正のうち、`A(value=1)`→`B(value=2, supersedes A)`→`C(value=1, supersedes B)`という**「元の値への正式な差し戻し訂正」が`_apfrRecordsEqual()`の比較に`supersedesFactId`が含まれていなかったため`duplicate_record`で誤拒否**されていた問題を解消。**`supersedesFactId`をduplicate identityへ追加**（比較項目は8→9項目へ拡張）。`C`は`A`と同値でも訂正関係が異なるため別の正式Correction Recordとして扱う。
- **duplicate防止は弱めない**：全9項目（`caseId`/`productIdentifier`/`aspName`/`field`/`classification`/`sourceMethod`/`sourceReference`/`value`/`supersedesFactId`）一致の完全同一Correction Recordは従来どおり拒否。未設定は既存`aspName`／`sourceReference`と同じ`|| null`方式で**property未存在／`undefined`／`null`／`''`を「訂正関係なし」として同一扱い**。**通常Record同士のduplicate判定はCUI-0以前から不変**（CUI-0前実装との機械比較で全差分パターン一致を確認）。
- **責務境界**：chain異常（orphan／self／cross-field／cross-case／cross-product／branched／circular）の判定は**duplicate関数の責務ではなく**Phase 1 Resolverが`ambiguous`＋`currentFact:null`のfail-closedで処理する。orphan参照Recordは登録が通るがResolverが`orphan_reference`でambiguousを返し**Formal Truth読み取りは汚染されない**ことを実測。
- **append-only不変**：旧Factのmutation・削除・`superseded`書き込みは一切なし。`A→B→C`はFact総数3件として全件保持（旧FactへのKey追加0件・内容不変・追記順保持を実測）。
- **実測**：CUI-0専用テスト`apfrCorrectionDuplicate.test.js` **65/65 PASS**（差し戻し訂正成功・Resolverが`explicit_chain`でCをresolved・recordedAt逆順でもchain優先・4段訂正整合・二重登録拒否維持）。既存回帰全PASS（Resolver 70/70・Phase 0 40/40・APFR Core 49/49・Manual Input UI 35/35・EER 51/51・IADP Quality 86/86・IADP Structured 13/13・Evidence 17/17・Cost Tracker 19/19）・**新規FAIL 0**・dev-check 200/200/200。変更は`index.html` +11行（実質は比較1行）／テスト新規503行のみで、`_apfrAppendRecord()`／`validateApfrRecord()`／Resolver／Fact schema／Fact昇格条件は無変更。main push済み・**Render自動Deploy反映確認済み**・**CUI-0用Tagは未作成**。DB変更0・API変更0・`server.js`変更0・APFR Fact変更0。
- **CUI-1 Current Fact / History UI（2026-08-23・Code commit `1cf3b2e`）**：Step B以降「登録済み情報」が`product.facts`を全件フラット表示していたため、本番`listingNgWords`で旧`["法人名"]`と訂正`["商品名","法人名"]`が同じ見た目で2行並び**どちらが現在値か画面上で判断できない**状態だった問題を解消。**Phase 1 Resolverを初めてUIへ接続**（表示専用・read-only）。
- **Current Fact UI Contract**：現在値一覧は**`_apfrResolveCurrentFacts(product)`の結果のみを使用**し、UI側が`facts`配列末尾・`recordedAt`最新・`sourceMethod`・`value`・配列順から独自にcurrentを決めることを**禁止**（**ResolverはUIにおいてもcurrent判定の唯一の口**）。実装の静的検証（`_apfrFactsOf(`直接走査・`Date.parse`比較・配列末尾参照が存在しないことの機械確認）をテストへ組み込み。`resolved`のみ`currentFact`を表示し**旧Factを現在値一覧へ混在させない**、表示順は`APFR_FIELD_ORDER`。`none`は「○ 未登録」で21フィールドの充足状態を可視化。**`ambiguous`は`currentFact`を表示せず**理由と候補件数のみ示し**候補の代表表示もしない**（Ambiguity Contractのfail-closedをUIでも維持）。
- **History UI**：全件フラット表示を廃止し「**現在値一覧＋折りたたみHistory**」へ分離（`<details>`・**既定は閉**）。Historyはappend-onlyの全Factを保持表示し、「現在値」「過去の記録（現在は使用されていません）」の区別は**Resolver結果から表示時に動的導出のみ**で、**旧Factへ`status:'superseded'`等を保存しない**（旧FactへのKey追加0件を機械検証）。通常表示は常に21行固定のため、**Factが50件・100件に増えても通常画面が履歴件数に比例して長くならない**。
- **boolean日本語表示（同時実装）**：**表示のみ**日本語化し保存値は`boolean`のまま不変。`productLinkAvailable`＝利用可/利用不可、`reviewRequired`＝あり/なし、`mobileOptimized`・`itpSupported`・`linkManagerSupported`＝対応/非対応（未定義fieldは既定「あり／なし」）。Manual Input UIのboolean selectも`option value`は`'true'`/`'false'`を維持したまま**labelのみ**日本語化。純関数`_apfrFormatFactValue(field, value)`を追加（表示専用・意味変換やnormalizeは行わない）。
- **listingPolicy**：CUI-1では変更なし。`"一部ok"`を**normalizeせず保存値のまま表示**（表記訂正は将来のCorrection UIでユーザー本人が正式Factとして登録する候補）。
- **listingNgWords実例**：現在値一覧は`["商品名","法人名"]`のみ表示、Historyは旧・新の2件を保持、**旧FactのDB変更・削除・mutationは0件**。
- **実測**：CUI-1専用テスト`apfrCurrentFactUi.test.js` **78/78 PASS**。既存回帰全PASS（CUI-0 65/65・Resolver 70/70・Phase 0 40/40・APFR Core 49/49・Manual Input UI 35/35・EER 51/51・IADP Quality 86/86・IADP Structured 13/13・Evidence 17/17・Cost 19/19）・**新規FAIL 0**・dev-check 200/200/200。localhost実機（合成fixture・本番Fact不使用）で現在値21行・History既定閉・boolean日本語・生の`true`/`false`非露出・facts配列不変・**Console Error 0**を確認。変更は`index.html`（+126/-12）／テスト新規587行のみで、旧`_apfrBuildFactsListHtml()`は完全置換（残存参照0件）。`id="apfr-panel"`・Manual Input登録フォーム・`_apfrRegisterFromUi()`／`_apfrAppendRecord()`は維持。main push済み・**Render自動Deploy反映確認済み**・**Tag未作成**。DB変更0・API変更0・`server.js`変更0・APFR Fact変更0。
- **CUI-2 Correction UI Core（2026-08-23・Code commit `fd99134`）**：**Resolverで`resolved`となった現在Factを、ユーザー操作によって正式なCorrection Recordとして訂正するUI**を実装。正式フローは`Resolver`→`resolved` current Fact→Current Fact UI「訂正」→**Correction Target**→Manual Input UIの訂正モード→**submit直前のResolver再検証**→`supersedesFactId`自動付与→**既存APFR Core**→append-only保存→Resolver再評価→新Factがcurrent／旧FactはHistory。
- **Correction Target**：一時UI state`_apfrCorrectionTarget`は`caseId`／`productIdentifier`／`field`／`currentFactId`の**4項目のみ**を保持し、**Fact本文（value/sourceMethod/verificationStatus/classification）は保持しない**（Formal Truthの複製を作らない・表示用の現在値は描画時にResolverから都度取得）。
- **status別の安全契約**：`resolved`のみ訂正可（対象はResolverの`currentFact`のみ）／`none`はCorrectionではなく通常新規登録で**`supersedesFactId`を付けない**／**`ambiguous`は訂正ボタン非表示**（disabledではない）・Correction禁止・**候補Factの代表選択なし**（fail-closedをUIでも維持）。
- **stale Target対策（重要）**：Correction開始時だけでなく**submit直前にもResolverを再実行**し、`status==='resolved' && currentFact.factId === target.currentFactId`を要求。不一致（current変化／ambiguous化／none化）時は**登録停止・append 0・Target破棄**。これにより**古いFactへ訂正をつないで`branched_chain`を生成する事故を防止**（実測確認済み）。
- **scope安全性**：**Cross-case／Cross-product／Cross-field をいずれも禁止**。fieldは**UI固定（`selected`＋`disabled`）＋submit時の一致再検証**の二重防御。product scope比較は既存の`String()`厳密比較方式を流用し独自ロジックを追加しない。
- **append-only／CUI-0再利用／User Verification**：旧Factの編集・削除・置換・`superseded:true`等のmutationは実装なし（新Factを追加するのみ）。**duplicate判定はCUI-0のpolicyをそのまま利用**しCUI-2独自判定は0（検証順序は stale再検証→Core duplicate判定。**stale時はTarget破棄／duplicate等の通常failure時はTarget保持**して再試行可能）。Fact昇格条件は通常登録と同一で**Correction専用Validatorなし**・**AI自動訂正禁止**。
- **UI**：`resolved`行のみ「訂正」ボタン／`none`・`ambiguous`にはなし／訂正モード中はfield固定／現在値を参考表示／**新値の入力欄は空**（旧値を自動コピーしない）／「訂正をやめる」あり／成功時・cancel時・stale時はTarget破棄、duplicate等の通常失敗時はTarget保持。
- **実装範囲**：追加state 1・追加helper 5（`_apfrCorrectionTargetFor`／`_apfrStartCorrection`／`_apfrCancelCorrection`／`_apfrValidateCorrectionTarget`／`_apfrBuildCorrectionHeaderHtml`）・変更関数5（`_apfrBuildCurrentFactsHtml`／`_apfrBuildPanelHtml`／`_apfrOnFormChange`／`_apfrRegisterFromUi`／`_apfrBuildFieldOptionsHtml`の任意引数対応）。**Core 3関数・Resolver 4関数・`_apfrBuildHistoryHtml`は無変更**。`supersedesFactId`の代入は**1箇所のみ**かつ**再検証を通過したTargetからのみ**。
- **実測**：新規テスト`apfrCorrectionUi.test.js` **105/105 PASS**（22ケース群）。既存回帰全PASS（CUI-1 78/78・CUI-0 65/65・Resolver 70/70・Phase 0 40/40・APFR Core 49/49・Manual Input UI 35/35・EER 51/51・IADP Quality 86/86・IADP Structured 13/13・Evidence 17/17・Cost 19/19）・**新規FAIL 0**・`node --check` OK・`git diff --check` CLEAN・dev-check **200/200/200**。localhost合成fixtureで「resolved行のみ訂正ボタン／none 0／ambiguous 0／訂正モード／field固定／現在値表示／入力欄空／cancel／**Console Error 0**／通常Manual Input UI無回帰」を確認。変更は`index.html`（+165/-5）／テスト新規804行のみ。**実DBへのCorrection Fact登録0件・本番`case-msr9yckye65y`の22 Factは無操作**。**DB変更0・API変更0・`server.js`変更0**。
- **⚠ CUI-2 Completeの意味**：**Correction UI Coreが完成した**という意味であり、**CUI-3／CUI-4／APFR Step C／Product・ASP Intelligence接続／EEA問題／Quality Gate・Hold問題／Leader Case Context Phase2 のCompleteをいずれも意味しない**。
- **現在地の内訳**：Correction Contract＝**Complete**／Current Fact Resolver＝**Complete**／Correction-aware Duplicate Policy（CUI-0）＝**Complete**／Current Fact・History UI（CUI-1）＝**Complete**／Correction UI Core（CUI-2）＝**Complete**。すなわち**Correction UI Core系列（CUI-0〜CUI-2）は実装Complete**。**ただし正式Tag・正式リリースは未実施**（CUI-2はCode push未実施）。
- **APFR Correction UI Core CUI-0〜CUI-2 正式リリースComplete（2026-08-24）**：Code commit `fd99134`・docs commit `186ec63` をmain pushし、HEAD／origin/main とも `186ec6371676e0ad9ab49368f2899bf9e4155f90` へ同期（ahead/behind 0/0）。**正式Tag `v1.01-apfr-correction-ui-core`（Annotated・target `186ec637...`）を作成しtag push済み**。Render自動Deployで本番反映済み（本番トップ200／`/api/task-history`200／`/api/workflow-dashboard`200）。本番配信コードにCUI-2の5関数すべて存在確認、`buildLeaderCaseContext`は本番0件のまま。**本番検証**：①**Complete**＝本番実データ（プラファスト22 Fact）をread-onlyで検証し`resolved`21／`none`0／`ambiguous`0・訂正ボタン21件・Correction mode正常・facts不変・DB書き込み0を確認。②**Pending**＝本番URLが合言葉認証画面のため**認証後の実ブラウザ目視確認のみ未実施**（正式リリース失敗ではない）。Correction Fact登録0・本番Fact変更0・DB/API/`server.js`変更0。
- **現在地の内訳（最終）**：Correction Contract＝**Complete**／Current Fact Resolver＝**Complete**／CUI-0＝**Complete**／CUI-1＝**Complete**／CUI-2＝**Complete**／**APFR Correction UI Core CUI-0〜CUI-2＝正式リリースComplete**。
- **次工程**：**最優先＝本番認証後のCorrection UI最終目視確認**（ユーザー本人が実施：訂正ボタン・訂正モード・field固定・現在値表示・入力欄空・訂正をやめる・cancel後通常表示・Console Errorを確認。**本番でCorrection Fact登録ボタンは押さない**）。その後：①**CUI-3**（「訂正済み」バッジ・旧値参考表示。独立工程として必要かは次工程選定時に再評価）②**CUI-4**（APFR直接ジャンプ）③残課題2（ITP日数field）の仕様判断④残課題4〜7のUI改善⑤APFR Step C（ASP/Product Intelligence接続・Resolver経由のみ）→ Step D → Step E。いずれもユーザー承認後に着手・自動開始しない。

---

## External Execution Completion Contract ＋ EER-1/EER-2/EER-3/EER-4（正式リリース・本番実運用完了・2026-08-21・Decision107）

- **背景**：Decision106後、対象案件`case-msr9yckye65y`はシステム上User Approval=Approved／Account Creation Readiness=Readyまで到達し、ユーザーが現実世界でInstagramアカウント作成・A8.net登録・A8.netメディア登録まで実行済みであることが判明。読み取り専用調査で、これを保持するFormal Truthが現在の設計に存在しないことを確認した（User Approval／Ready／Deliverable Completion／Evidence／IADP／Output Draftのいずれも責務外）。
- **Contract**：正式名称「External Execution Record（EER）」。現実世界・外部サービス上で実際に完了した行為をFormal Truthとして記録する契約。内部判断・承認・準備完了状態とは分離。
- **責務分離原則**：Approved≠Executed（User Approvalは進行承認の事実）・Ready≠Executed（Readinessは非永続の内部判定）・Deliverable Complete≠External Execution Complete（Decision102とは別責務）・Evidence Verified≠Execution Verified（情報の信頼性と行為の完了確認は別軸）。IADP配下（`fields.iadp.externalExecution`）案は不採用とし、`FORMAL_CASE_FIELDS`への独立キー`externalExecution`追加方針を正式採用。
- **初期契約**：1 Record=1 executionTypeの複数Recordコレクション。最小fieldは`executionType`/`status`/`caseId`/`packageId`/`source`/`actor`/`executedAt`（caseId必須・packageId任意）。初期status=`executed`のみ（`verified`は外部確認経路が存在しないため将来Decisionへ保留）。初期source=`user_confirmation`のみ（AI推測による昇格は原則禁止＝AI inference cannot create External Execution Formal Truth）。初期executionType3種：`instagram_account_created`／`asp_registered`／`asp_media_registered`（ASP登録とメディア登録は別イベント）。
- **Cross-case・carry-forward**：caseId必須でCross-case混入禁止。carry-forward対象（package単位でリセットされるapprovalとは異なり、現実の事実は覆らないためcase単位で永続）。復元は既存`restoreOutputDraftFromServer()`／Formal Case Fields復元契約を利用する方針。
- **DB/API/Engine**：新規DB table・column・API・Engine いずれも不要。既存`output_drafts.fields` JSONBと既存Output Draft保存APIを利用する方針（実装工程開始時に再確認）。
- **現実側の初期Formal Truth候補**：`case-msr9yckye65y`についてユーザーが明示済みの事実（Instagram Account Created=Complete／Account Name「ナチュラルエッセンス」／Username `naturalessence.jp`／A8.net Registered=Complete／A8.net Media Registered=Complete／健康・美容カテゴリ）を記録。**今回はDBへ保存しない**（実装完了後の別工程）。
- **EER-1 Core正式実装**：`FORMAL_CASE_FIELDS`へ`externalExecution`を追加。純関数`validateExternalExecutionRecord()`（executionType/status/source/actor/caseId/executedAt/packageIdを検証・入力非破壊・推測補完なし）と`_eerAppendRecord()`（重複防止・Cross-case guard・既存`pushOutputDraftToServer()`経由保存）を実装。既存carry-forwardループ・`restoreOutputDraftFromServer()`のfieldsワイルドカード復元にそのまま乗るため専用配線コードは不要だった。合成テスト`externalExecutionRecord.eer1.test.js`：**51/51 PASS**。変更ファイル：`index.html`（+61行）／テスト新規。Code commit **504b991**。
- **EER-2 User Confirmation UI正式実装**：Leader Final Summary（`_lfsBuildSummaryHtml()`）内、ユーザー承認ブロック直後へEER状態表示（未登録／✅ Executed）と「実行完了として登録」ボタンを追加。登録はボタンクリック起点のみ・`_eerAppendRecord()`必須経由・AI自動登録経路なし。localhost実機検証（既存専用テスト案件`case-msoplrg6gdkr`）でボタンクリック→POST 200→永続化→フルリロード後復元一致→別案件切替でCross-case混入なしを実測し、検証後は原状復帰（`fields.externalExecution`削除・`fields.iadp`無傷）。対象実案件`case-msr9yckye65y`は表示確認のみでボタン未クリック（3種とも未登録のまま）。変更ファイル：`index.html`（+72行）。Code commit **58e9451**。
- **EER-3 正式リリース**：docs release commit **ed14959**・Annotated Tag **v1.01-external-execution-record**・main push・tag push・Render反映。本番読み取り専用確認（API経由）でIADP Quality=100/Complete・Quality Gate=Passed・Evidence=Sufficient（5件）・User Approval=Approved（`fields.iadp.approval.status`）が無回帰であることを確認。本番UIは合言葉ログイン必須のためEER表示ブロック自体の目視確認はAPI確認で代替、Console Error 0。
- **EER-4 本番実運用完了**：ユーザー本人が本番UIから対象実案件`case-msr9yckye65y`へ3件のExternal Execution Recordを正式登録（`instagram_account_created`＝executedAt`2026-08-20T22:21:40.695Z`／`asp_registered`＝`2026-08-20T22:21:44.992Z`／`asp_media_registered`＝`2026-08-20T22:21:49.726Z`）。いずれも`status:executed`／`source:user_confirmation`／`actor:user`／`packageId:iadp_1787060839814_izhakb`でContract完全準拠・重複なし。Claude Code側はAPI経由の読み取り専用確認のみを実施し、登録・変更・削除は一切行っていない。登録後もIADP Quality=100/Complete・Quality Gate=Passed・Evidence=Sufficient・Reviewer=Passed・Strategy=Accepted・User Approval=Approved（approvedAt不変）は無回帰。ユーザー自身がF5フルリロード後も3件とも✅ Executedで復元されることを本番PC画面で確認済み。既存回帰テスト`externalExecutionRecord.eer1.test.js`（51/51）・`iadpQualityContractRouting.test.js`（86/86）再実行し全PASS。
- **今回の範囲**：EER-1〜EER-4を通じて、実案件データ変更はユーザー本人の本番UI操作による3件のEER登録のみ。Claude Codeからの登録・変更・削除は0件。Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手（変更なし）。
- **次工程**：EER登録3件を踏まえたAccount Creation Readiness最終確認、またはInstagram実運用側（別チャット）の進行。EER追加実装（`verified`状態・他executionType追加等）はユーザー承認後に別途判断。

---

## Phase IG-QC-B1/B2 candidateOnly Quality Routing Fix / Production Re-evaluation（正式リリース・2026-08-20・Decision106）

- **Phase IG-QC-B1（candidateOnly routing fix）**：`buildOutputDraftFromLeaderFinal({candidateOnly:true})`ブランチが Phase IG-QC routing（Decision105）前に early return していたため、Quality Gate 候補評価で正式 IADP へ Instagram 10 項目 Contract（`evaluateOutputPackageCompleteness()`）が誤適用されていた根本原因を修正。candidateOnly ブランチへ通常経路と完全同一の IADP routing contract を inline 追加（`validation.valid===true`・`packageId`存在・`quality`算出済み・`status`文字列・`score`数値の全 5 条件）。非 IADP・guard 失敗は`evaluateOutputPackageCompleteness()`へ fallback し後方互換を維持。`iadpQualityContractRouting.test.js`に candidateOnly Cases CO-A〜CO-I を追加し全 **86/86 PASS**。Code commit **0c076dd**。
- **Phase IG-QC-B2（Production Re-evaluation）**：本番 Output Draft `out_1787060723866`（`case-msr9yckye65y`・IADP `iadp_1787060839814_izhakb`）の旧 snapshot（package_quality: instagram/20/insufficient・assessmentContext.qualityGate: failed/false）を、既存保存済み IADP Quality（score:100, status:complete, missingRequiredFields:[]）とブラウザグローバル関数`evaluateQualityGate()`を使用して非課金再評価。`package_quality`・`assessmentContext.qualityGate`の 2 フィールドのみ限定保存（manual JSON 書き換えなし）。保存後実測：category=iadp / score=100 / complete / iadpEvaluated=true / QG passed=true / sourceStatus=complete。バックアップ確認・Guard 全 pass・F5 復元確認・Cross-case（他 7 件 Draft 未作成）確認済み。Evidence（5 件）・IADP 本体・User Approval・Leader Final は変更なし。
- **Phase IG-QC-B3（正式リリース）**：docs commit・Annotated Tag **v1.01-iadp-quality-routing-complete**・main push・tag push・Render 反映・PC本番確認済み。OpenAI API 0・Claude API 0・Web Search 0。B2 DB 変更は対象 Output Draft のみ。Leader Case Context Phase2 引き続き本番未 commit。

---

## Phase IG-2J-A〜I Instagram Account Design Self-Completion / AI Action Rerun（正式リリース・2026-08-10・Decision098）

> 記録日: 2026-08-10。**Phase54 Complete維持・Phase55未着手**。**index.html／openaiClient.js／shared/instagramAccountDesign.js／shared/instagramAccountDesignQuality.js／shared/iadpIntelligenceContext.js（新規）／shared/agentResultNormalizer.js（新規）**。**server.js／DB／supabase/schema.sql／API契約は無変更・新規API/新規DBカラム/新Engineなし**。

- **進捗**：IG-2F〜IG-2I IADP品質基盤（正式リリースComplete・維持）→ **IG-2J-A〜I ＝ Code Complete**。
- **本Phaseの起点（実運用で判明した9問題）**：①AI社員が情報不足を理由に逆質問だけで停止する ②Leader Finalの重要な結論がチャット上部にあり見づらい ③確認事項が複数箇所へ分散する ④採用案が複数レイヤーで不一致になる ⑤「構造99点」と実運用品質が混同される ⑥Evidence不足でも一見完成して見える ⑦生JSON等の成果物正規化問題 ⑧AI会社自身で処理できることまでユーザーへ質問する ⑨「勝てるInstagramアカウント」を作るための自律処理が不足。
- **IG-2J-A Self-Completion Mode**（Code commit **d95f196**・`openaiClient.js`のみ）：`buildSystemPrompt()`へ任意第4引数optionsを追加し、`accountIntelligenceMode===true`かつIADP対象4担当かつworkerの場合のみSelf-Completion Modeを適用。ターゲット／ジャンル／商品カテゴリ／投稿頻度／投稿形式／コンテンツピラー／KPI初期値／ブランド方向性／競合仮説／差別化仮説をAI会社自身で仮説生成し、質問だけで停止しない。**事実／AI仮説／外部確認待ち／User Input Requiredは明確に分離し、数値の捏造は禁止**。通常Workflowでは本ブロックを一切生成せず既存文字列と完全同一。
- **IG-2J-B Leader Final Summary**（Code commit **7a33296**・`index.html`のみ・削除ゼロ）：チャット最新位置へSummaryを追加。既存IADPカード・Executive Leader Report・Leader Final本文は削除・改変せず詳細情報として維持。Summaryは新規AI生成ではなく**既存IADP正本から決定論的に再構築**。**「構造充足99%」は実運用品質と別軸**であることを明示。
- **IG-2J-C AI Action / User Input分離**（Code commit **244cad2**・`shared/instagramAccountDesignQuality.js`＋`index.html`）：`actionItems.aiActions`／`userInputs`を追加（既存`missing`／`nextActions`は維持）。分類はreason code＋決定論的判定。AI側reason code＝`ai.structure_fix`／`ai.members_rerun`／`ai.evidence_acquire`／`ai.evidence_reinforce`／`ai.reviewer_rework`／`ai.strategy_redesign`／`ai.quality_gate_rerun`／`ai.signals_acquire`／`ai.required_fields_fill`。**ターゲット・ジャンル・投稿頻度・KPI等は「教えてください」という文面で来てもUser Inputへ昇格させない**。
- **IG-2J-D 採用案 Single Source of Truth**（Code commit **144b0ff**）：正本を`intelligence.adoptionDecision.adoptedCandidateId`へ統一。`resolveAdoptedCandidate()`／`applyAdoptionConsistency()`を新設（純関数・非破壊）。**総合点1位を自動採用しない**（順位差は`selectionVsRanking`で説明）。比較表decisionは**表示時のみ**正本へ整合（総合点/順位/finalProfile/packageIdは不変・保存副作用なし）。正本を特定できない場合は推測で別候補を採用せずNeeds Work。**Final Profile不一致はmainGenre文字列だけを差し替えず安全側でNot Ready**。構造Validatorへの追加はwarningのみ（既存errors契約は無変更）。
- **IG-2J-E Intelligence実数値の担当指示注入**（Code commit **fa91cae**・`shared/iadpIntelligenceContext.js`新規）：既存`fields.intelligenceContext`（product/asp/revenue/content/competition/market＋Evidence＋Confidence）を4担当のTask指示文へ注入。**Fact／Evidence／Prediction／Unknownを決定論的に分離**し、**裏付けEvidenceのない数値は必ずPrediction**。caseIdはtop-levelとモジュール単位の二重guard。30日超は`stale`として明示（自動無効化しない）。担当ごとに必要カテゴリのみ・件数/文字数/ブロック長の上限でToken制御。Intelligence 0件でもSelf-Completionを維持。IADPへは`generationContext.intelligenceSources`（参照元メタのみ）を記録しContext本体は保存しない。
- **IG-2J-F Evidence正本接続**（Code commit **d7d21dd**）：Evidence正本を`fields.intelligenceContext.evidence[]`へ接続。**Verified**＝`public_fact`/`manual_observation`/`user_input`/`learning_result`かつ非派生、**Derived**＝`calculated`/`heuristic`/`ai_interpretation`または親を持つもの。**派生・推定EvidenceおよびAI仮説を検証済み件数へ算入しない**。Sufficient＝Verified 3件以上（既存`INTEL_CONFIDENCE_MIN_EVIDENCE`と同値）かつ**独立source 2件以上**かつ低reliabilityのみでない。独立source条件のみ新設（実データはフィールドごとに`sourceReference`が異なり「1件の手入力＝独立11件」と数えられるため。既存の独立件数・Confidence式・しきい値は無変更）。**`fieldStatus`はlegacy fallbackとして維持**（過去データが突然Insufficientへ落ちない）。
- **IG-2J-G 成果物正規化**（Code commit **7ff4140**・`shared/agentResultNormalizer.js`新規）：`{"reply":...}` wrapperと```json fenceの**構造ノイズのみ**を除去。**内容の要約・再生成・意味変更・スコア変更・Reviewer判定変更は行わない**。原因＝①タスクループのreply抽出が`indexOf('{')`/`lastIndexOf('}')`＋`JSON.parse`のみで実改行入りJSONのparse失敗を握り潰していた ②同ループがClaude担当を丸ごとスキップし、Reviewer側fallbackも`startsWith('{')`条件のためフェンス前置時に発動しなかった。**通常文章・一般コードブロック・reply以外の正式構造JSON・文章中のJSONは一切変更しない**。原文は`task.rawResult`へ保持。空成果物は`hasMeaningfulResult`で検出（**`task.status`契約は無変更**）。
- **IG-2J-H AI Action Required 自律再実行接続**（Code commit **f845db0**・`index.html`のみ）：`atRunWorkflow()`へ任意引数を追加（省略時は従来と完全同一動作）し、reason codeに応じた**必要担当だけ**を既存Auto Task経路で部分再実行。**Reviewer／Strategy／Leader Final／Quality Gateは既存後処理として自動再実行**されるため専用タスクを作らない。指示文は既存`buildAccountIntelligenceTasks()`を再利用（IG-2J-EのIntelligence注入も自動適用）。**新Workflow Engineなし**。安全弁＝自動起動なし（ユーザーが1回開始・実行前に対象担当/件数/API使用を明示）／二重実行防止／課金ロック中は開始しない／案件あたり3回・同一reason code 2回の上限／Cross-case guard／**stale Quality Gate guard**（`_iadpResolveQualityGate()`へpackageId・caseId照合を追加）／**Approval自動承認なし**。**`userInputs[]`は絶対にTask化しない**。
- **IG-2J-I 最終統合検証**（Code変更なし）：回帰**441項目全PASS**（A 26／D 111／E 87／F 93／G 71／H 53）。**実AI End-to-End 1回実施**（専用検証案件`case-msmymywv6hdl`・Researcher→Analystのみ部分再実行→Reviewer→Strategy→Leader Final 9,229字→新IADP生成・validate成功→SSOT解決→Evidence判定→Quality Gate再評価→Approval pending維持→User Input非実行→F5復元一致→Cross-case問題なし）。**API追加費用 約¥30**（OpenAI +¥0.55／Claude +$0.18375・上限¥100内）。課金ロックは実行直前に一時解除し完了と同時に自動ON復帰。実案件2件は読み取り専用・書き込み0件・初回取得時とバイト単位で完全一致。検証用テストデータは案件削除＋`output_drafts`削除で**remaining=0**を実測確認。`node --check`全7ファイルOK・`git diff --check` CLEAN・**Console Error 0**・`npm run dev-check` 200/200/200。
- **実データで確認できた効果**：実AI応答が実際に`{"reply":...}`形式で返り、IG-2J-Gの正規化が実運用で機能（原文は`rawResult`へ保持）。採用案は総合点1位ではない候補が正本として正しく解決され、Quality Gate通過後もReviewer needs_workのため`not_ready`／`pending`を維持（**承認だけ・QG通過だけでReadyにしない**設計を実AI結果で実証）。
- **検証中に判明した2点（製品欠陥ではない）**：Quality Gate未評価とIADP未保存は、いずれも`currentMember`未選択（ヘッドレス検証のため未ログイン）が原因で、`_liCollectIntegration`／`getCurrentApprovalCaseId`の**既存の安全設計（案件未確定なら書き込まない）が正しく働いた結果**。ログイン相当の状態を与えると両方とも正常動作することを追加API費用ゼロで実証済み。
- **Known Issue（IG-2Jの正式リリース判定をBlockしないと評価）**：①チャット経路`generateReply`のreply wrapper残存（IADP経路とは別サブシステム・保存済みメッセージ122件中1件で実確認）②Reviewer NG partial-match（使用箇所はLeader Inboxの矛盾*候補*生成1箇所のみ・`label:'candidate'`／`confidence:'low'`・IADP側は回避済み）③iPhone Landscapeレイアウト崩れ④iPhoneチャット履歴の瞬間消失⑤Background Execution未実装。
- **Render本番反映（2026-08-10実測）**：本番`/`・`/api/task-history`・`/api/workflow-dashboard`とも**200**。配信物へIG-2J全工程の反映を10項目で確認（B Summary／C 分類表示／D SSOT／E Adapter読込／F Evidence正本／G 正規化読込・ラッパ／H 再実行計画・実行導線・上限guard）。新規共有モジュール2件を含む4モジュールとも**200**。build error／runtime errorなし。
- **PC本番確認 完了（2026-08-10）**：保存済み実データ（実AI再実行なし・**書き込み0件**）で、Leader Final Summary／IADPカード／採用候補の正本解決／Evidence／Quality Gate／Reviewer・Strategy／AI Action・User Input分離／Approval／「AI会社に修正させる」導線をすべて表示確認。**横はみ出しなし・Console Error 0**。
- **iPhone Portrait実機確認 完了（2026-08-10・ユーザー実施）**：本番表示・Summary・IADPカード・**1カラム表示・横はみ出しなし**・AI Action / User Input表示・承認ボタン・詳細ボタン・チャット入力欄・スクロールいずれも正常。**Landscapeは既存Known Issue継続**（Responsive未対応・IG-2J実装による新規不具合ではない・正式リリース判定には影響させない）。
- **Git・反映**：Code commit **d95f196＋7a33296＋244cad2＋144b0ff＋fa91cae＋d7d21dd＋7ff4140＋f845db0**＋docs commit **32b0821**（＋本追記commit）。Decision **098**。Annotated Tag **v1.01-instagram-account-design-self-complete**（→`32b0821`）・**main push完了**（`540411e..32b0821`）・**tag push完了**・**Render反映完了**・**PC本番確認完了**・**iPhone Portrait実機確認完了**。**Phase IG-2J-A〜I 正式リリースComplete**。
- **次工程**：**Instagram実運用準備／実運用開始**（アカウント作成→プロフィール設定→ASP登録→商品調査→投稿企画→初回投稿→KPI取得→Learning実測）。**Phase55へは移行しない**。

---

## Phase IG-2F〜IG-2H IADP Quality / Approval / Quality Signals 正式採用（正式リリース・2026-08-09・Decision097）

> 記録日: 2026-08-09。**Phase54 Complete維持・Phase55未着手**。**index.html／shared/instagramAccountDesignQuality.js**。**server.js／shared/instagramAccountDesign.js／shared/leaderRuleEngine.js／supabase/schema.sql／DB／API契約は無変更・新規API/新規DBカラムなし**。

- **進捗**：IG-2E Output Draft Integration（正式Complete・維持）→ **IG-2F／IG-2G／IG-2H ＝ 正式Complete（統合正式リリース）**。
- **発見した誤判定（本Phaseの起点）**：チャット欄ではResearcherが逆質問で停止・Analyst成果物が空・Branding独自成果物が空・SNSが逆質問で停止・Reviewerが「依頼要件を満たす成果物ゼロ」と判定・Strategyも再実行必要と判定・Leader統合回答本文が空という状態で、IADPカードは「Status: Complete／品質スコア100／アカウント作成準備 Ready／市場調査100／競合調査100／3案比較100／採用判定100」と表示。Evidence 0件・AI仮説2件・ユーザー確認済み0件でも市場調査・競合調査が100点だった。
- **根本原因**：`evaluateInstagramAccountDesignQuality()`がJSONのフィールド存在（narrative presence）のみでscore/status/readyを決定していた。①`summarizeFieldStatus()`でEvidence件数を集計するが`determineStatus()`・scoreの入力に含まれない、②担当実行状況（`data.results`）とLeader統合回答（`data.leaderFinalResult`）は評価時点で手元にあるが未接続かつ未保存でF5消失、③`readyForAccountCreation`がstatus由来の派生のみでユーザー承認ゲートなし。Summary UIの潰れは、chat-areaがflex columnのためカードが既定`flex-shrink:1`で約26pxへ縮み、`overflow-x:hidden`が`overflow-y`を`auto`へ強制昇格させ内部スクロール化していたことが原因。
- **Phase IG-2F（階層品質判定・Summary UI改善）**：新関数`assessInstagramAccountDesignPackage(iadp, context)`を`shared/instagramAccountDesignQuality.js`へ追加（純関数・非破壊・fail-open・既存`evaluateInstagramAccountDesignQuality()`は無変更のまま内部再利用＝後方互換）。判定を`structureValidation`／`contentQuality`／`evidenceStatus`／`accountCreationReadiness`／`userApproval`の5軸へ分離。構造検証Passedだけで内容品質をCompleteにせず、Evidence 0件で「実データ検証済み」と表示せず、Category Scoresを「構造充足／Evidence信頼度／内容品質」へ分離（構造充足100は維持しつつ総合はNeeds Work）。担当成果物不足（error/skipped/空/情報不足スタブ）・Leader統合回答不足はComplete化禁止。生成時コンテキストを`fields.iadp.generationContext`へ保存しF5復元可能化、無い旧IADPは`not_evaluated`（legacy）で自動Complete/Ready化しない。`.iadp-card`へ`flex-shrink:0`／`overflow:visible`を適用（26px→547px）。Code commit **b5a3d5e**。
- **Phase IG-2G（User Approval Flow）**：`fields.iadp.approval`（`{status, packageId, caseId, approvedAt}`・任意サブキー）へ保存し既存`pushOutputDraftToServer()`／`POST /api/output-drafts`で永続化。`_iadpEffectiveApprovalStatus()`が**caseId＋packageId一致時のみapproved**を返す（不一致・欠損・rejectedは`pending`）。新IADP生成（新packageId）では旧承認を引き継がず`pending`へ戻す（セッションリセット＋保存側非同梱の二重ガード）。Summary内「この設計を承認」ボタンから承認し、保存→再評価→再描画を同一操作内で完了（F5不要）。Code commit **18fc04b**。
- **Phase IG-2H（Reviewer／Strategy／Quality Gate 正式接続）**：**新しい独立判定基盤は作らず既存判定を再利用**。Quality Gateは既存正本`inbox.qualityGate`（＝`_leaderIntegration.qualityGate`）を読むのみで再実行・契約変更なし。Reviewer／Strategyは構造化正本が存在しないため既存`data.results`から多シグナル導出（構造シグナル優先／否定フレーズ単独は`needs_work`／構造的裏付けがある場合のみ`failed`・`needs_revision`へ昇格／既知バグの`LI_REVIEWER_REJECTION_KEYWORDS`は流用しない）。既存Workflow順は変更せず`_liCollectIntegration()`直後へ`_iadpRefreshAfterIntegration(caseId)`を追加しQuality Gate確定後に後から再評価（F5不要・fail-open）。`fields.iadp.assessmentContext`へpackageId・caseIdを刻んだsnapshotを保存しpackageId一致検証のうえ復元（不一致なら破棄）。Code commit **4dd0400**。
- **調査結果の分類（IG-2H）**：**直接接続可能**＝Reviewer・Strategy（IADP評価時点で`data.results`が手元にある）。**後段でしか取得できない**＝Quality Gate（`_liCollectIntegration()`後に確定）。**今回安全に接続できない**＝Executive Decision・Constitution Validator（変更禁止のため参照のみ・未接続）。
- **Ready正式条件**：①Structure Validation Passed ②Content Quality Complete ③Evidence Status ≠ Insufficient ④Reviewer重大不足なし ⑤Strategy再設計要求なし ⑥Quality Gate Passed ⑦Leader統合回答あり ⑧必須担当成果物あり ⑨User Approval Approved の全充足。品質条件のみ充足で承認待ちは`conditional`。**承認だけで品質不足を上書きしない**。
- **Path Bの扱い（安全側仕様として正式化）**：Path BはOutput Draft概念が存在せず`inbox.qualityGate === null`となるためComplete／Readyへ到達しない。これを安全側仕様として正式容認し、Instagram Account Designの正式経路はPath A Auto Taskを基本とする。**Path BへQuality Gateを新設しない**（Decision087継承）。
- **未実装（区別して記録）**：Executive Decisionロジック変更／Constitution Validator変更／Completion Gate／Background Execution／実AI End-to-End／Instagramアカウント実作成／ASP登録／NG keyword本体修正。
- **Background Execution 方針（今回未実装・方針のみ記録）**：Version1.1後半の大型工程として位置づけ、実装順は「IG-2F/2G/2H正式化 → Instagram実運用 → KPI/Learning実測 → 実運用上のボトルネック確認 → Background Execution」。目的＝ユーザーがPC／iPhone／ブラウザを開き続けなくてもAI会社がサーバー側で処理を継続できる状態。将来対象＝Job Queue／Background Processing／queued・running・completed・failed・cancelled・retrying／Progress保存／Resume／Retry／Cancel／Multiple Jobs／完了通知／Cross-case guard／二重実行防止／古い結果による上書き防止／コスト制御。既存のIntelligence・Evidence・Leader Rule Engine・Reviewer・Strategy・Quality Gate・Executive Decision・Output Draftを可能な限り維持し実行基盤を段階的にサーバー側へ移行する。**品質判断が安定する前にBackground化しない**。
- **Known Issue（正式記録）**：**Reviewer NG keyword partial-match issue**＝既存`LI_REVIEWER_REJECTION_KEYWORDS`に`NG`が含まれ部分一致判定のためBRANDING／MARKETING等を誤検出し得る（Decision095で`reviewerSignal`をnull固定した理由と同一）。IG-2Hではこの関数をIADP判定へ直接流用しておらず、IADP側は厳格な日本語否定フレーズ＋構造シグナルで回避済み（実測で誤検出なし）。本体修正は行わず後続工程候補とする。加えて**iPhoneチャット履歴の瞬間消失**・**iPhone Landscapeレイアウト崩れ**（Decision096記録分）を継続記録。Landscapeについてはユーザー実機確認（2026-08-09）で「左サイドバーとメイン領域の占有が大きく、メニュー表示時も画面の大部分が覆われ実用上ほぼ使用できない」状態が継続していることを再確認した（Responsive未対応・**IG-2F〜IG-2I実装による新規不具合ではない**・正式リリース判定には影響させず後続のResponsive対応工程として管理）。
- **iPhone実機確認結果（2026-08-09・ユーザー実施）**：**縦画面＝Complete**（Render本番表示・ログイン・Leader画面・案件表示・メニュー操作すべて正常・白画面なし・無限ロードなし・既存機能破壊なし）。**横画面＝Known Issue継続・未修正**（上記Landscape Responsive未対応）。
- **データ保全ルール（正式記録）**：IG-2Fで実案件`case-mshmumd8l93j`のIADPを上書きし元データを保全できなかった事故を教訓に、実案件の`fields.iadp`を検証目的で変更する場合は「**backup → test → restore → restore確認**」を必須とし、原則専用テスト案件または合成データを使用する。IG-2G（`case-mslrf20t2nhk`）・IG-2H（`case-mslsddorhcso`）は専用テスト案件で検証し**実案件書き込みゼロ**・検証後に削除済み。
- **検証**：Core合成テスト（IG-2F 9ケース・IG-2H 10ケース）／Reviewer・Strategy導出11ケース／UI 10ケース 全合格。主要実測＝同一JSONの誤判定ケースが「総合Insufficient・内容Insufficient・Evidence Insufficient・Not Ready」（構造充足100維持）へ修正／全条件Pass＋Approvedで Complete・**Ready**／Reviewer failed・Strategy needs_revision・Quality Gate failed はApproved済みでも**Not Ready**／Quality Gate未実行は`Not Executed`表示でNot Ready／packageId変更で旧snapshot・旧approvalを破棄（`snapshotUsed:false`・pending・not_ready）／案件切替でassessmentContext・approval・generationContextすべてクリア／F5後もsnapshotからQuality Gate・Reviewer・Strategy・Approvedを復元しReady再評価／legacyはNot Evaluated表示・例外なし・自動Passedなし／iPhone相当幅375pxで横はみ出しなし・Summary9項目可読・承認ボタン操作可能。`node --check`両ファイルOK・`git diff --check` CLEAN・IADP関連Console Error 0・`npm run dev-check` 200/200/200・**実AI追加実行なし**。Executive Decision／Constitution Validator／Quality Gate契約への非干渉をdiff実測で確認（実装行の変更ゼロ）。
- **Git・反映**：Code commit **b5a3d5e**（IG-2F）＋**18fc04b**（IG-2G）＋**4dd0400**（IG-2H）＋docs commit **42508c8**（IG-2I正式化）＋docs commit（本追記・iPhone実機確認結果）。Annotated Tag **v1.01-instagram-account-design-quality-ready**・main push・Render反映（本番200・配信物へIG-2F/2G/2H反映確認）・**PC本番確認 完了**・**iPhone実機確認 完了（縦画面Complete／横画面はKnown Issue継続）**。Decision 097。**Phase IG-2F〜IG-2I 正式リリースComplete**。
- **次工程候補（比較対象・優先順位）**：Instagram実運用（アカウント作成→プロフィール設定→ASP登録→商品調査→投稿企画→初回投稿→KPI取得→Learning実測）／実AI IADP End-to-End確認（API費用のユーザー承認後）／**iPhone Landscape Responsive対応**（サイドバー制御・レイアウト占有率最適化・実機確認で継続を再確認した独立工程）／Background Execution（実運用・Learning実測後）／Completion Gate設計／NG keyword本体修正／iPhoneチャット履歴瞬間消失対応。**正式な次工程はユーザー承認後に決定する**。**Phase55未着手のまま維持**。

---

## Phase IG-2E Instagram Account Design Package Output Draft Integration 正式採用（2026-08-06・Decision096）

> 記録日: 2026-08-06。**Phase54 Complete維持・Phase55未着手**。**index.htmlのみ**。**server.js／shared/instagramAccountDesign.js／shared/leaderRuleEngine.js／supabase/schema.sql 無変更・新規API/新規DBカラムなし**。

- **進捗**：IG-2D 実AI検証・IADP構造化JSON品質調整（完了）→ **IG-2E Instagram Account Design Package Output Draft Integration ＝ 正式採用**。
- **IG-2D（IADP構造化JSON品質調整）**：`openaiClient.js`の`ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT`へ実例JSON・厳守事項（10軸スコアの意味ある差・decision/adoptedCandidateId整合・括弧の対応関係）を追加し空値/プレースホルダー残留を抑制。`accountIntelligenceMode`時のみ`max_output_tokens`を4096→8192（通常Leader Finalは無変更）。`extractIadpJsonFromLeaderText()`へ末尾カンマ耐性parseを追加。`_iadpStripJsonBlock()`が構造化ブロックのみで自由文が空の場合に案内文を表示。`_iadpBuildCardHtml()`でgenreId→genreName逆引き表示・adoptionReason優先表示。Code commit **ecfed0c**。
- **IG-2E-1（保存）**：IADP検証成功時（`InstagramAccountDesign.validateAccountDesignPackage().valid===true`）に`_lastOutputDraft.fields.iadp`へ`{package,validation,quality,caseId,savedAt}`を格納し、既存`pushOutputDraftToServer()`（＝既存`POST /api/output-drafts`）でそのまま送信。affiliateContext／intelligenceContextが既に使う「`fields`配下への相乗り保存」パターンを踏襲し、新規APIエンドポイント・新規DBカラムは追加しない。
- **IG-2E-2（復元）**：新設`_iadpApplyRestoredFields(fields, caseId)`が、既存`restoreOutputDraftFromServer()`（起動時／案件切替時に既存`scheduleOutputDraftRestore()`から呼ばれる）の復元結果を受けてIADPセッションキャッシュ（`_lastInstagramAccountDesignPackage`等4変数）を同期し、`reRenderChatArea()`を呼んで既存の読み取り専用IADPカード（`_iadpRenderIntoChatArea()`）を自動再表示。復元先の案件に保存済みIADPが無い場合はキャッシュを確実にクリアする。
- **IG-2E-3（1 Case 1 正本・Cross-case漏れ防止）**：`createOutputDraft()`はAuto Task実行のたびに`fields`を空へ再初期化する既存仕様のため、実行直前に現在案件の既存`fields.iadp`を退避し、新Draft生成直後に引き継ぐ処理を追加。同一案件内でIADP以外のAuto Taskを実行しても、直前まで採用されていたIADPが消えない。表示側は既存の`caseId`一致ガードをそのまま利用し他案件のIADPが混入表示されないことを維持。
- **未実装（区別して記録）**：IADP実AI生成からの自動保存End-to-End確認（今回はダミーパッケージによる保存/復元/切替機構の検証のみ）、Path B／Content Planning／Carousel Builder／Publishing Readyの実動作回帰確認（コード変更箇所との非重複はdiffで確認済みだが実動作は未検証）。
- **検証（localhost）**：既存案件（「Instagramアカウト設計」）を利用し、実AIを追加実行せずブラウザJS経由でダミーIADP（`normalizeAccountDesignPackage`／`validateAccountDesignPackage`／`evaluateInstagramAccountDesignQuality`を実際に通した`valid:true`パッケージ）を注入して実測。保存＝`POST /api/output-drafts`200 OK、F5復元＝同一`output_id`のままIADPカード再表示、案件切替＝他案件へ切替でカード消滅・グローバルclear・元案件へ戻すと再表示、1 case 1 正本＝案件間混在なし、後方互換＝IADP未使用の旧Draft（type: document等）はエラーなく従来どおり復元、Console Error 0を確認。検証後は注入したダミーIADPを削除し実案件を原状復帰（`fields`は元の8フィールドのみへ復帰）。`node --check` OK・`git diff --check`問題なし・`npm run dev-check` 200/200/200。
- **検証（Render本番・PC）**：本番URL200 OK・配信物にIG-2E新規コード反映を確認。既存案件「Instagramアカウント設計」（`case-ms7lamica57l`）でlocalhostと同一手順を実施し、保存・F5復元・案件切替・Cross-case確認・Console Error 0を実測。検証後、本番データも原状復帰（サーバー側GETで`hasIadp:false`を確認）。
- **検証（iPhone実機・ユーザー実施）**：Render本番表示・ログイン・Leader画面・案件切替・Auto Task・Output Engineいずれも正常、白画面/無限ロードなし、Console上で問題となる挙動なし、IG-2D／IG-2Eの追加による既存機能破壊なしを確認。
- **Known Issue（今回の実装とは独立・後続工程で対応）**：①iPhoneで案件を開いた直後、一瞬チャット履歴が表示された後に消え、Auto Taskボタン押下で正常再表示される（保存/復元自体は正常・描画タイミングの再描画競合と推定）。②iPhone Landscape（横画面）でレイアウトが崩れチャット領域が極端に狭くなる（サイドバー制御含むResponsive対応が必要）。いずれもIG-2D／IG-2Eの保存・復元機能自体の不具合ではない既存UI課題。
- **Git・反映**：Code commit **ecfed0c**（IG-2D）＋**0fb943e**（IG-2E）＋**d36de10**（docs commit・Decision096含む7ファイル）。Annotated Tag **v1.01-instagram-account-design-output-draft**。main push・Render反映・**PC本番確認・iPhone実機確認 完了（2026-08-06・ユーザー実施）**。Decision 096。**IG-2D／IG-2E 正式リリースComplete**。
- **次工程候補（比較対象・優先順位未確定）**：Known Issue①（iPhoneチャット履歴瞬間消失・再描画競合調査）／Known Issue②（iPhone Landscapeレイアウト崩れ・Responsive対応）／Path B／Content Planning／Carousel Builder／Publishing Readyの実動作回帰確認／IADP実AI生成からの自動保存End-to-End確認。**正式な次工程はユーザー承認後に決定する**。**Phase55未着手のまま維持**。

---

## Phase B-9F Leader Rule Engine 正式リリース（Phase B-9C〜B-9F統合・2026-08-06・Decision095）

> 記録日: 2026-08-06。**Phase54 Complete維持・Phase55未着手**。**index.html／openaiClient.js／server.js／shared/leaderRuleEngine.js（新規）**。**DB/schema.sql/API契約は既存互換（`ruleArtifacts`は任意追加項目のみ）**。

- **進捗**：Leader統合回答・会社正式回答責務 正式採用（Phase B-9B・正式Complete・維持）→ **Phase B-9C〜B-9F ＝ 正式Complete**。
- **Phase B-9C（Leader統合回答プロンプト改善）**：`LEADER_FINAL_PROMPT`（Path A）・`leaderSummary()`（Path B）へDecision094の6原則（会社の唯一の正式回答／AI社員回答は社内検討資料／CEO相当の最終統合責任者／要約ではなく統合／成果物ファースト／情報不足の最終判断はLeader）を明文化。案件種別見出しへ「依頼された場合のみ出力」を付記し、ブランドメッセージ/実行順序/次にやることを条件付き出力へ変更。`runLeaderFinalResponse()`内の動的questionテキストも整合させた。Code commit **92cc49a**。
- **Phase B-9D-1（Rule Engine接続調査・正式設計）**：既存`_liCompareArtifacts()`/`_liDetectConflictCandidates()`/`_liDecideAdoptionCandidates()`を実コード調査し、件数比較・単純キーワード検出に留まり`adopt`を返す経路がないこと、既存NGキーワード判定に偽陽性があることを確認。これら3関数は温存し、新規の共通Rule Engine Coreを別系統として実装する方針（案C）を正式設計。コード変更なし。
- **Phase B-9D-2（共通Leader Rule Engine Core実装）**：`shared/leaderRuleEngine.js`を新規実装（UMD形式・Node/ブラウザ両対応・外部依存/DOM依存/Network呼び出しなし）。公開API＝`normalizeLeaderRuleInput(input)`／`evaluateLeaderRuleFacts(normalizedInput)`／`buildLeaderRulePromptBlock(ruleResult)`の3つ。入力正規化（memberId許可値判定・status正規化・JSONフェンス除去・reply抽出・1200文字制限）・情報不足スタブ判定（`【現状仮説】`かつ`【確認したいこと】`両方一致のみ）・v1結果契約（`{version,executed,artifactCount,completedCount,informationInsufficient{count,memberIds,allInsufficient},statusIssues[],reviewerSignal:null,notes:[]}`・`duplicateTopics`/`conflicts`/`recommendedAdoptions`等は意図的に含めない）・Prompt Block生成（500字以内・原文非含有）を実装。合成テスト90アサーション全PASS。Code commit **d194ba1**。
- **Phase B-9D-3（Path B接続）**：`leaderSummary()`内でCoreを呼び出し、`memberReplies`/`strategyReply`から構造化サマリーを生成し`context`へ独立データブロックとして1回だけ挿入。Fail-open・単一挿入・Injection耐性を実装。合成テスト29アサーション全PASS。Code commit **0bd3a88**。
- **Phase B-9D-4（Path A接続）**：`runLeaderFinalResponse()`内へPath A専用の薄いAdapter`_lfAdaptTaskToRuleArtifact()`を追加し、`workflowTasks`（main）・`reviewerTask`・`strategyTask`（`isPostProcess:true`強制付与）からCore入力を構築。`mainTasks.length>0`の通常分岐（`parts`配列）のみへ接続し、`completedCount===0`の安全側分岐（`parts0`）は無変更。合成テスト29アサーション全PASS。Code commit **756d867**。
- **Phase B-9D-5（手動Leader再生成 接続調査）**：`atTriggerLeaderFinal()`が独自のLeader Final生成を持たず、Path Bと同一の`/api/leader-summary`→`leaderSummary()`（B-9D-3で接続済み）へ委譲していることを発見。ただし既存`memberReplies`構築（DOM `.at-result-card`走査）がReviewer/Strategyを`isPostProcess`で判別せずmain扱いのまま送信し、error/skippedタスクは配列へ追加すらされない、というデータ品質ギャップを特定。この時点では`leaderSummary()`変更が絶対ルールで禁止されていたため実装せず調査結果のみ報告。
- **Phase B-9D-5A（手動Leader再生成 ruleArtifacts分離接続）**：ユーザー承認のもと設計を確定。既存`memberReplies`は変更せず、Rule Engine専用の`ruleArtifacts`を別途生成する方式を採用。`_atBuildRuleArtifactsForManualRegen()`（新設・薄いマッピングのみ）が既存`_liAdaptManualLeaderRegeneration()`の戻り値（is-postprocess判別済み・status導出済み）を`{memberId,role,status,text,isPostProcess}`へ変換し、`/api/leader-summary`のrequest bodyへ**任意項目**として追加。`server.js`は受信して`leaderSummary()`へ渡すのみ。`leaderSummary()`は`ruleArtifacts`が有効な場合のみそれを正本として使用し、未指定（Path B等）時は従来どおり`memberReplies`/`strategyReply`から構築（Path B完全後方互換）。Response契約（`{ok,reply}`）は無変更。合成テスト26アサーション全PASS。Code commit **22ca87c**。
- **Phase B-9E（統合検証）前半・静的**：3経路の因果順照合（Path A：workflowTasks確定→Adapter→Rule Engine→Prompt Block→Leader Final→Leader Integration→Quality Gate→Executive Decision→Output Draft／Path B：dispatch確定→leaderSummary()→Rule Engine→Leader統合回答→既存後処理／手動Leader再生成：Cross-caseガード→`.at-result-card`→Adapter→ruleArtifacts→leaderSummary()→Rule Engine→Leader統合回答）を実コードで確認し、逆転・二重実行・後工程直接介入がないことを確認。共通入力契約（3経路とも`{memberId,role,status,text/reply/result,isPostProcess}`へ正規化・Path固有分岐はCoreになし）を統合合成テスト53アサーションで実測（`evaluateQualityGate()`/`_edRunDecisionEngine()`/`buildOutputDraftFromLeaderFinal()`いずれもRule Engine出力を一切参照しないことをgrepで確認）。テストファイルはリポジトリへcommitせず。
- **Phase B-9E（統合検証）後半・実API**：同一テスト案件（`PhaseB4B検証用テスト案件`）を3経路で再利用し、Path A Auto Task・手動Leader再生成・Path B dispatch（1回失敗→Rule Engineと無関係な既存の非決定性のため1回のみ追加送信→成功）を実施。Path A/手動再生成でQuality Gate=Not Passed（`sourceStatus:'insufficient'`）・Path Bでnull（完全非表示・`.elr-qg-*`0件）を実測。`decisionStatus`は一貫して`hold`・Constitution Validatorは一貫して`passed:true`・Output DraftはPath A/手動再生成で保存（Path Bで非生成）を確認。Console Error 0・想定外Network増加なし。実費用約¥32.38（OpenAI+¥1.34・Claude約¥31.04・承認上限¥100以内）。
- **対象経路**：Path A（Auto Task）・Path B（dispatch）・手動Leader再生成のすべてが共通Leader Rule Engineへ正式接続。
- **現在の影響範囲**：Rule Engineは事実整理のみで、Executive Decision・Constitution Validator・Constitution Gate・Quality Gate・Output Draft保存・Completion Gate・Publishing Readyのいずれも制御・変更しない（表示専用のPrompt Block生成に限定）。
- **未実装（区別して記録）**：意味的な重複除去・矛盾検出・Evidence比較・`recommendedAdoptions`等の採否候補生成・`reviewerSignal`の実質化（既存NGキーワードバグ回避のため意図的に`null`固定）・既存NGキーワードバグ修正・Claude応答のJSON汚染の根本修正・UI上での「社内検討」明示・Completion Gate・Publishing Ready・Decision Ledger。
- **検証**：JavaScript構文OK（`node --check`：openaiClient.js／server.js／shared/leaderRuleEngine.js・index.htmlインラインscript）・`npm run dev-check` 200/200/200（各工程で実施）・`git diff --check`問題なし・Console Error 0（全工程）。
- **Git・反映**：Code commit **92cc49a**（B-9C）＋**d194ba1**（B-9D-2）＋**0bd3a88**（B-9D-3）＋**756d867**（B-9D-4）＋**22ca87c**（B-9D-5A）＋docs commit（本更新・B-9F）。Annotated Tag（正式リリース時に作成）。main push・Render反映。Decision 095。
- **次工程候補（比較対象・優先順位未確定）**：意味的重複/矛盾検出の実装検討／Evidence比較の実装検討／Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Decision Ledger／AI社員カード期限表示廃止。**正式な次工程はユーザー承認後に決定する**。**Phase55未着手のまま維持**。

---

## Phase B-9B Leader統合回答・会社正式回答責務 正式採用（Decision094・2026-08-05・docs正式化のみ）

> 記録日: 2026-08-05。**Phase54 Complete維持・Phase55未着手**。**docsのみ（01/02/04DECISIONS/04ROADMAP/06HANDOVER/CHANGELOG）**。**index.html/openaiClient.js/server.js/lib/DB/schema.sql/API 無変更**。

- **進捗**：Quality Gate Executive Leader Report表示（Phase B-8・正式Complete・維持）→Leader統合回答の現状調査・設計（Phase B-9A・完了）→**Phase B-9B Leader統合回答・会社正式回答責務 正式採用 ＝ docs正式化Complete**。
- **用語分離**：「Leader Summary（ELR表示）」＝Executive Leader Report内でcandidateArtifacts等を3行抜粋・折りたたみ表示する事後表示セクション（`_elrBuildReportHtml()`・Phase B-8までに完成済み）と、「Leader統合回答」＝Path Aの`LEADER_FINAL_PROMPT`／Path Bの`leaderSummary()`が生成しLeaderチャットへ表示する最終回答テキスト（今回Phase B-9の対象）を明確に区別。今後docsでは後者を「Leader統合回答」と表記する。
- **正式採用内容**：
  1. **会社の唯一の正式回答**：Leader統合回答はAI社員個々の回答の連結ではなく「ENBISOU AI COMPANYとしてユーザーへ提示する唯一の正式回答」と定義。
  2. **AI社員回答＝社内検討資料**：Writer／Researcher／Reviewer／Designer／Strategy等の個別回答は正式回答ではなく社内検討資料。既存のAI社員タブ・dispatchカード・Workflow Live等の表示機能は削除せず維持する（将来UI上で「社内検討」であることを明示する余地のみ記録・今回UI変更なし）。責務フロー：`社内検討（Writer/Researcher/Reviewer/Designer/Strategy）→Leader統合（重複除去・矛盾解消・採用・保留・却下）→会社回答（Leaderチャットへ唯一の正式回答を表示）`。
  3. **LeaderはCEO相当の最終統合責任者**：AI社員の意見収集・重複除去・矛盾解消・Evidence比較・採用判断・保留判断・却下判断・情報充足の最終判断・最終成果物生成・会社回答としての表現統一を担う。Writer/Researcher/Reviewer等の文章をそのまま連結して返してはならない。
  4. **要約ではなく統合**：Leader統合回答の目的は文章を短くすることではなく、重複除去・矛盾解消・Evidence比較・採用/保留/却下判断・品質統一・依頼範囲への絞り込みを行った上での必要最小限の文章化。今後は「要約」単独ではなく「統合・判断・正式回答生成」と記録する。
  5. **成果物ファースト**：出力順序を「完成成果物→必要な場合のみ補足→必要な場合のみ採用理由→必要な場合のみ社内判断の概要」として正式化。AI社員の議論・レビュー全文を先に表示することを正式回答の目的にしない。狭い依頼（例：Instagram投稿用の挨拶キャプションを1つ）では不要なカルーセル・TikTok・LP・ブランドメッセージ等を自動追加しない構造を目指す。
  6. **情報不足の最終判断**：各AI社員は安全側で「情報不足」と判断してよいが、最終判断権限はLeaderに帰属する。作成可能な場合＝各担当が情報不足と判断→Leaderが依頼内容だけで実用的成果物を作成可能と判断→追加質問をせず完成成果物を生成。本当に作成できない場合＝依頼内容だけでは成果物の骨格が成立しない→Leaderが情報不足と最終判断→必要最小限の確認事項のみ提示。各担当の情報不足判定をそのまま会社回答として採用しない。
  7. **Gate系との責務分離**：Leader統合回答＝生成前〜生成中の判断（完成できるか／完成させるか／どの案を採用するか／何を却下するか／質問へ切り替えるか／どの成果物だけを返すか）。Quality Gate＝生成済み候補の`packageQuality.status`評価のみ（内容の的確さ・簡潔さ・統合品質は評価しない）。Completion Gate（未実装）＝将来、生成された成果物が完成基準を満たすかの事後判定であり、Leader統合回答の「生成するか・質問するか」という責務を先取りしない。Executive Decision＝Leader Final生成後の事後判断であり、Leader統合回答生成前の統合処理には直接介入しない。Constitution Validator＝Executive Decisionの構造整合性検証のみで成果物内容の統合品質は評価しない。
  8. **既存Leader Integration Layerとの関係**：`_liCompareArtifacts()`／`_liDetectConflictCandidates()`／`_liDecideAdoptionCandidates()`は重複・矛盾・採否候補を事後観測する既存関数だが、現在はLeader統合回答生成「後」に実行される観測層。将来品質改善へ利用する場合は、Leader Final生成「前」へ構造化された比較結果要約JSON（概念例：`{duplicateTopics:[],conflicts:[],recommendedAdoptions:[],holds:[],rejections:[],evidenceNotes:[]}`）として渡す方針とし、比較処理そのものや不要な全文を渡さずトークン増加を抑制する。
  9. **Path A／Path Bの構造的差異**：Path Aは`/api/auto-task`がサーバー側単一リクエスト内でAI社員実行〜Leader Final生成まで完結し、クライアント側Leader Integration LayerがLeader Final生成前へ介入できない（Decision087で確定済みの構造的制約）。今後構造化比較結果を渡す場合は、サーバー側への同等比較ロジック追加／サーバー側共通Rule Engine化／Leader Final二段階生成、を比較検討する必要がある（二段階AI生成はAPI費用・遅延増のため第一候補にしない）。Path Bはクライアント側でdispatch・Strategy統合・Leader統合回答生成を制御しており、比較結果をLeader入力へ接続しやすい構造。ただしPath AとPath Bで会社回答品質が大きく異ならないよう、最終的には共通の統合原則を適用する必要がある。
- **未実装（区別して記録）**：LEADER_FINAL_PROMPT／leaderSummary()／strategyConsolidate()のプロンプト文言変更・Leader統合ロジック変更・Rule Engine比較結果のLeader Final生成前接続・UI上での「社内検討」明示・Completion Gateはいずれも今回対象外であり、「完成済み」として記録しない。
- **Phase B-9工程分割（正式記録・実装候補・順序未確定な着手は各工程でユーザー承認後）**：
  - Phase B-9A：Leader統合回答の現状調査・設計（完了）
  - Phase B-9B：Leader統合回答の責務正式化・Decision・docs反映（今回）
  - Phase B-9C：Leader統合回答プロンプト改善（`LEADER_FINAL_PROMPT`／`leaderSummary()`／必要に応じて`strategyConsolidate()`。会社の唯一の正式回答・CEOとしての最終判断責任・要約ではなく統合・成果物ファースト・依頼範囲外の不要出力抑制・情報不足の最終判断・必要な場合のみ確認事項へ切り替え、を正式化）
  - Phase B-9D：Rule Engine比較結果（重複除去/矛盾検出/Evidence比較/採用候補/保留候補/却下候補）のLeader Final生成前接続（Path B先行検討・Path Aはサーバー側共通ロジック化を再調査。Path A/Bで同じ比較契約を使用することを目標とする）
  - Phase B-9E：統合検証（狭い単一成果物依頼・複合成果物依頼・情報が十分な依頼・情報不足だが一般解を生成可能な依頼・本当に確認が必要な依頼・AI社員間で意見が一致する依頼・AI社員間で矛盾する依頼・Reviewerが不採用を提案する依頼・Path A・Path B・既存13出力タイプへの回帰・API費用・出力の長さ・重複除去・不要ブランチ抑制を確認）
  - Phase B-9F：正式リリース（docs更新・docs commit・Tag・Push・Render・PC確認・iPhone確認）
- **検証**：今回はdocs正式化のみのため、コード検証（node --check・dev-check・Console/Network確認）は対象外。
- **Git・反映**：docs commit（本更新）のみ。Tag作成なし・**push未実施**（ユーザー確認後に別途判断）。次工程＝Phase B-9C（未着手・ユーザー承認なしに開始しない）。**Phase55未着手のまま維持**（Decision094）。

---

## Phase B-8 Quality Gate Executive Leader Report表示 正式Complete（Phase B-8A〜B-8D統合・2026-08-04）

> 記録日: 2026-08-04。**Phase54 Complete維持・Phase55未着手**。**index.html（Code commit 04bf9c1）のみ**。**server.js/lib/DB/schema.sql/API無変更**。

- **進捗**：Quality Gate（Phase B-7・正式Complete・維持）→ **Phase B-8 Quality Gate Executive Leader Report表示 ＝ 正式Complete**。
- **Phase B-8A（調査・設計）**：Executive Leader Report生成構造（`_elrBuildReportHtml`／`_elrRenderIntoChatArea`／`_elrRefreshInChatArea`／`_liCollectIntegration`／`_edRunDecisionEngine`）とConstitution Structure Check表示パターン（`_elrBuildConstitutionCheckHtml`）を実コード調査。`inbox.qualityGate`は既に`_elrBuildReportHtml`の第2引数`inbox`経由でELRへ渡っていることを確認し、新規引数追加は不要と判断。表示位置・表示内容・固定注記・データ契約（既存`inbox.qualityGate`をそのまま使用・新規ラッパー構造は追加しない）を設計。コード変更なし。
- **Phase B-8B（表示実装）**：`_elrBuildQualityGateHtml(qualityGate)`を新設（`_elrBuildConstitutionCheckHtml`と同型の防御的実装・不正データ時は空文字列・入力オブジェクト非破壊・`escapeHtml`使用）。`QUALITY_GATE_SOURCE_STATUS_LABELS`（`complete`＝完成／`almost_ready`＝ほぼ完成／`needs_work`＝要改善／`insufficient`＝情報不足の4値のみ許容）を追加。`_elrBuildReportHtml()`内で`_elrBuildQualityGateHtml(inbox && inbox.qualityGate)`を呼び出し、`constitutionCheckHtml`と`summaryRowsHtml`（Leader Summary）の間へ挿入。CSS新規クラス`.elr-qg-passed`／`.elr-qg-warning`／`.elr-qg-note`を追加（Constitution専用`.elr-cv-*`とは分離）。合成テスト21アサーション全PASS（Passed/Not Passed表示・日本語補助・score非表示・固定注記・不正入力12種で空文字列・入力非破壊）。dev-check 200/200/200・Console Error 0。Code commit **04bf9c1**（`index.htmlのみ+52/-0`）。
- **Phase B-8C（Path A／手動Leader再生成／Path B 3経路実API統合検証）**：案件`case-mschx3ex4z3c`（PhaseB4B検証用テスト案件）で実施。課金ロック（billingLock）がON状態では`atAutoStartWorkflow()`が自動起動をスキップするため、ユーザー承認のもと一時解除して検証後に再度ONへ復元。**Path A**：`_leaderIntegration={pathSource:'pathA', sourceMode:'auto_task', qualityGate:{executed:true,passed:false,status:'failed',sourceStatus:'needs_work'}}`・`_executiveDecision.decisionStatus:'hold'`・`_constitutionValidation.passed:true`（12/12）・`_lastOutputDraft.status:'ready'`（`quality.status:'good'`・candidate Draftの`needs_work`とは独立して確定＝状態軸分離を実測確認）・`.executive-leader-report`1件・`.elr-qg-warning`1件・`/api/output-drafts` POST1回・Console Error 0・Network全200を実測。**手動Leader再生成**：`atTriggerLeaderFinal()`実行で新規`decisionId`発行・`sourceMode:'manual_regeneration'`・Quality Gate再評価正常（`needs_work`→Not Passed）・`.at-leader-final-card`1件維持・ELR重複なし・Output Draft POST1回。**Path B**：Leaderチャットへメッセージ送信し`handleLeaderDispatch()`成立（Writer/Designer/Reviewer等）・`_leaderIntegration.pathSource:'pathB'`・`inbox.qualityGate===null`・Quality Gateセクション完全非表示（`.elr-qg-*`0件・🟢/🟡検出なし）・「対象外」等の代替表示もなし・`.leader-summary-block`1件・Output Draft生成なし。**Cross-case**：案件Aから別案件へ切替時`.executive-leader-report`0件・案件Aへ戻すと同一表示が復元。**F5**：リロード後`_leaderIntegration`／`_executiveDecision`／`_constitutionValidation`ともnull・`.executive-leader-report`0件（既存仕様どおり）。**モバイル幅**：375px幅で合成データ描画時に横スクロールなしを確認。実API使用：Path B dispatch2回・Path A1回・手動再生成1回（概算：OpenAI+0.68円・Claude数リクエスト分、既存Phaseの実API概算¥12〜13と同水準以下）。コード変更なし・追加commitなし。
- **Phase B-8D（正式リリース）**：docs更新（本更新）・commit・Annotated Tag **v1.01-quality-gate-report-display**作成・main push・Render反映・PC/iPhone本番確認。
- **対象経路**：Path A（Auto Task）・手動Leader再生成。Path Bは`inbox.qualityGate===null`により完全非表示（Decision087「Path B＝Output Draft制御対象外」を継承）。
- **現在の影響範囲**：Quality Gate結果の表示はセッション内メモリ（`_leaderIntegration.qualityGate`経由）に保持される間のみ。Executive Decisionの`decisionStatus`・Approved Decision Package生成条件・Constitution Gate・Output Draft保存可否／`status`・`OUTPUT_STATUS`・Completion Gate・Publishing Readyのいずれも変更しない（表示専用）。
- **未実装（区別して記録）**：Quality Gate結果のDB保存・Output Draft保存・Decision Ledger保存・decisionId/caseId付きラッパー・`qualityGateVersion`・`qualityGateThresholdVersion`・F5復元・Executive Decisionへの制御接続・Approved Decision Package生成条件への接続・Output停止・Output Draft保存拒否・Completion Gate・Publishing Ready・AI社員カード期限表示廃止。
- **検証**：JavaScript構文OK（`node --check`）・`npm run dev-check` 200/200/200・`git diff --check`問題なし・Console Error 0・Network異常なし（全200）。
- **Git・反映**：Code commit **04bf9c1**（B-8B）＋docs commit（本更新・B-8D）。Annotated Tag **v1.01-quality-gate-report-display**。main push・Render反映。Decision 093。
- **次工程候補（比較対象・優先順位未確定）**：Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Quality Gate監査Version保存／Decision Ledger／AI社員カード期限表示廃止。**正式な次工程はユーザー承認後に決定する**。**Phase55未着手のまま維持**。
- **補足**：Phase B-8C検証中、UI探索の誤操作により`applyLeaderTemplate('sns_flow')`からテンプレートタスク9件が生成された（AI API呼び出しなし・追加コストなし・Quality Gate表示への影響なし）。Phase B-8の不具合ではなく、削除は本工程の対象外（ユーザー側で後日手動削除可能）。

---

## Phase B-7 Quality Gate 正式Complete（Phase B-7A〜B-7H統合・2026-08-04）

> 記録日: 2026-08-04。**Phase54 Complete維持・Phase55未着手**。**index.html（Code commit f866d4d／0f104d3／1a92884）のみ**。**server.js/lib/DB/schema.sql/API無変更**。

- **進捗**：Constitution Gate（Phase B-6・正式Complete・維持）→ **Phase B-7 Quality Gate ＝ 正式Complete**。
- **Phase B-7A〜B-7C（調査・設計・責務再定義・閾値実データ調査）**：Quality Gateの正本入力を既存`packageQuality`（Output Package Quality）単軸とし、Constitution Gate（判断プロセスの構造整合性）とQuality Gate（成果物の内容完成度）の責務を分離。実データ調査（既存7案件のOutput Draft実測・N=6）でscore平均83.2点・complete2件／almost_ready1件／needs_work3件を確認し、通過基準を候補D（`packageQuality.status`方式）＋候補B水準（`complete`または`almost_ready`）と正式確定。
- **Phase B-7D（安全リファクタ）**：`buildOutputDraftFromLeaderFinal(finalText, opts, targetDraft)`へ第3引数`targetDraft`を追加。`var draft = targetDraft || _lastOutputDraft;`によりfields構築対象（`type`／`fields`の抽出元）のみを引数化し、省略時は従来どおり`_lastOutputDraft`を使用（既存呼び出し2箇所は完全後方互換・13型分岐ロジック自体は無変更）。Code commit **f866d4d**（`index.htmlのみ+12/-5`）。
- **Phase B-7E（評価位置接続）**：`_liCollectIntegration()`内、`_leaderIntegration = inbox;`確定直後・`_edRunDecisionEngine(inbox)`呼び出し直前へQuality Gate評価位置を接続。`_lastOutputDraft`とは独立したcandidate Draft`{ type, fields: {} }`を生成し、`buildOutputDraftFromLeaderFinal(text, {candidateOnly:true}, candidateDraft)`でfields構築（既存ロジック再利用・二重化なし）とpackageQuality算出のみを行い、status確定・`fields.approvedDecisionPackage`複製・POSTには到達せず早期return。評価結果を`inbox.qualityGate`へ格納。pathA（auto_task／manual_regeneration）のみ対象（`inbox.leaderFinalCandidate`が存在する場合のみ・Path Bは`leaderFinalCandidate`が常にnullのため自然にスキップ）。Code commit **0f104d3**（`index.htmlのみ+43/-0`）。
- **Phase B-7F（実判定実装）**：`evaluateQualityGate(packageQuality)`へ実判定ロジックを実装。`packageQuality.status === 'complete'`または`'almost_ready'`のみ通過（`passed:true`）、それ以外は非通過。戻り値`{ executed: true, passed, status: 'passed'|'failed', sourceStatus }`。`score`・数値threshold未使用。不正入力（`null`／`undefined`／非オブジェクト／`status`欠落／非文字列）でも例外を投げず`passed:false`へ安全側処理。Code commit **1a92884**（`index.htmlのみ+15/-7`）。
- **Phase B-7G（統合検証・境界値確認・3経路回帰確認）**：`index.html`から実装コード（`QUALITY_GATE_PASSING_STATUSES`定数・`evaluateQualityGate`関数本体）を正規表現で直接抽出し評価、14/14 PASS（`complete`／`almost_ready`通過・`needs_work`／`insufficient`／未知値／大文字小文字違い／空文字／非文字列／`status`欠落／`null`／`undefined`／文字列／数値／配列すべて非通過・全ケース例外0・入力非破壊・関数定義重複なし）。実APIテスト（既存テスト案件・低コストプロンプト）でPath A（実データ`packageQuality={score:71,status:'needs_work'}`→`passed:false`・`decisionStatus:'hold'`・Output Draft`status:'ready'`・POST1回・ELR1件）・手動Leader再生成（`sourceMode:'manual_regeneration'`・新規decisionId・同一ロジックで`passed:false`）・Path B（dispatch成立時`inbox.qualityGate===null`・`_lastOutputDraft.id`/`updatedAt`不変＝candidate Draft・正式Draftいずれも生成されないことを実測確認）の3経路とも正常動作・Console Error 0・Network全200 OKを確認。コード変更なし。
- **Phase B-7H（正式リリース）**：docs更新（本更新）・commit・Annotated Tag **v1.01-executive-quality-gate**作成・main push・Render反映・PC/iPhone本番確認。
- **対象経路**：Path A（Auto Task）・手動Leader再生成。**Path Bは正式に対象外**：`detectOutputType()`・`createOutputDraft()`・`buildOutputDraftFromLeaderFinal()`のいずれも呼び出されずcandidate Draft生成契約・`packageQuality`算出契約が存在しないため（Phase B-7B・B-7Gの実コード調査で確認・grep全件確認済み）。`inbox.qualityGate===null`がPath Bの正常仕様であり、Decision087の「Path B＝Output Draft制御対象外」を継承する。
- **現在の影響範囲**：Quality Gate結果（`inbox.qualityGate`）はセッション内メモリ（`_leaderIntegration`経由）に保持されるのみ。`passed:false`でも、Executive Decisionの`decisionStatus`・Approved Decision Package生成条件・Constitution Gate・Output Draft保存可否／`status`・`OUTPUT_STATUS`・UI表示・Publishing Ready・Completion Gateのいずれも変更しない。
- **未実装（区別して記録）**：数値score閾値・数値threshold・`qualityGateVersion`・`qualityGateThresholdVersion`・`constitutionVersion`保存・`completionGateVersion`保存・Quality Gate結果のOutput Draft保存/DB保存/Decision Ledger保存・F5復元・Quality Gate UI・Executive Leader ReportへのQuality Gate表示・Output停止・Output Draft保存拒否・Executive Decision/Approved Decision Package生成条件への統合・Completion Gate・Publishing Ready判定。
- **検証**：JavaScript構文OK（`node --check`）・`npm run dev-check` 200/200/200（各工程で実施）・`git diff --check`問題なし・Console Error 0・Network異常なし。
- **Git・反映**：Code commit **f866d4d**（B-7D）＋**0f104d3**（B-7E）＋**1a92884**（B-7F）＋docs commit（本更新）。Annotated Tag **v1.01-executive-quality-gate**。main push・Render反映。Decision 092。
- **次工程候補（比較対象・優先順位未確定）**：Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Quality Gate監査Version保存／Decision Ledger／Quality Gate UI・Executive Leader Report表示／AI社員カード期限表示廃止。**正式な次工程はユーザー承認後に決定する**。**Phase55未着手のまま維持**。

---

## Phase B-6 Constitution Gate 正式Complete（Phase B-6A〜B-6D統合・2026-08-03）

> 記録日: 2026-08-03。**Phase54 Complete維持・Phase55未着手**。**index.html（Code commit 9436fec）のみ**。**server.js/lib/DB/schema.sql/API無変更**。

- **進捗**：Constitution Structure Check（Phase B-5C・正式Complete・維持）→ **Phase B-6 Constitution Gate ＝ 正式Complete**。
- **Phase B-6A（調査・設計）**：Constitution Gateの接続方式として「広域Gate」（Executive Decision Engine本体・Package生成ロジック`_edBuildApprovedDecisionPackage()`への組み込み・Constitution違反時にDecision生成自体を停止）と「狭域Gate」（Package複製可否＝`fields.approvedDecisionPackage`受け渡し条件のみへの限定接続）を比較検討。広域Gate案はQuality Gate・Completion Gate未定義の現段階でDecision生成自体を止めると既存Phase B-5Cの正常動作（Executive Leader Report・Constitution Structure Check表示）にまで影響が及ぶリスクがあり、既存Workflow保護原則（第14条・安全側既定値）に反するため不採用。影響範囲を最小限に限定した狭域Gate案を正式採用。
- **Phase B-6B（実装）**：Path A（`atRunWorkflow()`）・手動Leader再生成（`atTriggerLeaderFinal()`）双方の`_edApprovedPackageForOutput`／`_manualApprovedPackageForOutput`確定条件へ、既存の`sourceDecisionId`一致・`caseId`一致に加え、`_constitutionValidation`存在／`_constitutionValidation.decisionId`と`_executiveDecision.decisionId`の一致／`_constitutionValidation.caseId`と`_executiveDecision.caseId`の一致／`_constitutionValidation.result`存在かつ`result.passed===true`、の4条件をANDで追加。いずれか不成立時は既存どおりfail-closed（nullのまま・例外を投げない）。Validator本体・Executive Decision Engine本体・Package生成ロジック・Output Draft本文はいずれも無変更。Code commit **9436fec**（`feat: gate approved package by constitution`・`index.htmlのみ+20/-2`・Path A/手動Leader再生成の2箇所に限定）。
- **Phase B-6C（実APIテスト・回帰確認）**：既存テスト案件（PhaseB4B検証用テスト案件）を再利用し、低コストプロンプトで実施。①Auto Task：Writer→Reviewer→品質レビュー→Strategy→Leader Finalが正常完了、Executive Leader Report生成（Decision Status=Hold・Decision Confidence Insufficient32点）、Constitution Structure Check Passed（12/12）。②手動Leader再生成：新規decisionId発行（Decision Confidence25点）、Constitution Structure Check Passed（12/12）、`.leader-summary-block`表示スタイル無変更。③Path B（dispatch成立時）：Writer/Designer/Reviewerへdispatch、Executive Leader Report即時更新（`.executive-leader-report`要素1件のみ・重複なし）、Constitution Structure Check Passed（12/12）。3経路とも`decisionStatus`は`hold`のため`approvedDecisionPackage`は常に`null`（`fields.approvedDecisionPackage`キー不在）であり、Gate追加が既存正常系動作へ副作用を与えないことを実測確認。Console Error 0（3経路とも）・Network全リクエスト200 OK。
- **Phase B-6D（正式リリース）**：docs更新（本更新）・commit・Annotated Tag **v1.01-executive-constitution-gate**作成・main push・Render反映。
- **未実装・繰越**：Executive Constitution全14条の完全な意味論的検証・Evidence内容の十分性判定・成果物品質/完成度の実質評価・Validator違反によるOutput停止・Quality Gate・Completion Gate・Decision Ledger・Executive Memory。AI社員カードの「期限」表示は本工程でも変更していない。
- **検証**：JavaScript構文OK（`node --check`）・`npm run dev-check` 200/200/200・`git diff --check`問題なし・Console Error 0・Network異常なし。
- **Git・反映**：Code commit **9436fec**＋docs commit（本更新）。Annotated Tag **v1.01-executive-constitution-gate**。main push・Render反映。Decision 091。
- **次工程候補（比較対象・優先順位未確定）**：Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止。**正式な次工程はユーザー承認後に決定する**。**Phase55未着手のまま維持**。

---

## Phase B-5C Constitution Structure Check 正式Complete（Phase B-5C-1〜B-5C-3統合・2026-08-03）

> 記録日: 2026-08-03。**Phase54 Complete維持・Phase55未着手**。**index.html（Code commit a2834d3／9e6d094／58315ee）のみ**。**server.js/lib/DB/schema.sql/API無変更**。

- **進捗**：Constitution Validator Core（Phase B-5・正式Complete・維持）→ **Phase B-5C Constitution Structure Check（Decision対応契約・表示実装・即時再描画接続）＝ 正式Complete**。
- **Phase B-5C-1（Decision対応契約）**：`_edRunDecisionEngine()`内の代入を`_constitutionValidation = validateExecutiveDecision(decision);`から`_constitutionValidation = { decisionId: decision.decisionId || null, caseId: decision.caseId || null, result: _cvResult };`へ変更。Validator関数自体・戻り値構造・12検証項目は無変更、Validator実行は1回のまま、新規ID生成なし。早期return時は`_constitutionValidation = null`を維持。Node合成テスト22アサーション全PASS（正常Decision／違反あり／再実行時の旧残留なし／早期return／非破壊性）。
- **Phase B-5C-2（Executive Leader Report表示）**：`_elrBuildReportHtml(decision, inbox, validation)`へ第3引数を追加（`_constitutionValidation`グローバル直接参照なし・純粋関数性維持）。Executive Summaryの直後・Leader Summaryの直前へ独立セクション「Constitution Structure Check」を表示。Passed時は`checkedRules.length`から動的算出した「🛡 Constitution Structure Check：Passed（N/N）」の1行のみ、Violations時は「⚠ ...：N件の構造不整合」＋`violations[].message`一覧を常時表示・`violations[].rule`は`<details><summary>技術詳細</summary>`内のみに限定。「現在は構造整合性チェックです。Evidence十分性・Quality Gate・Completion Gateとは別軸です」の固定注記を常設。`_elrRenderIntoChatArea()`側でdecisionId／caseId／現在案件caseIdの三重一致を確認し、不一致・不在時はValidationセクションのみ非表示としReport本体（Executive Summary等）は維持。resultなし／violationsが非配列／checkedRulesが非配列／passedが非boolean／violation要素不正／messageなし等いずれも例外を出さず安全に非表示化。`message`／`rule`は既存`escapeHtml`で必ずエスケープ（新規エスケープ関数は追加せず）。CSS新規追加は`.elr-cv-passed`／`.elr-cv-warning`／`.elr-cv-note`の3行のみ・既存`.elr-*`パターンを最大限再利用。Node合成テスト29アサーション全PASS（Passed表示／Violations表示／Validationなし／decisionId不一致／caseId不一致／不正Validation6種／HTMLエスケープ／非破壊性）。ブラウザ実機で合成データを用いたPassed表示・Violations表示・Cross-case非表示を確認（テスト後リロードで完全にクリア・ソースへテストコード残留なし）。
- **Phase B-5C-3（即時再描画接続）**：`_elrRenderIntoChatArea()`のDOM挿入を`chatEl.appendChild(wrap.firstChild)`から`chatEl.insertBefore(wrap.firstChild, chatEl.firstChild)`へ変更（既存呼び出しは`chatEl.innerHTML=''`直後のため挙動は完全に同一）。新設`_elrRefreshInChatArea()`（既存`.executive-leader-report`を除去し`_elrRenderIntoChatArea()`を再実行する限定更新・チャット全体を再構築しない）を、Path A（`atRunWorkflow()`の`_liCollectIntegration('pathA',...)`完了直後）・手動Leader再生成（`atTriggerLeaderFinal()`の`_liCollectIntegration('pathA',...,{sourceMode:'manual_regeneration'})`完了直後）・Path B（`triggerLeaderSummary()`の`_liCollectIntegration('pathB',...)`がdispatch成立（`_liSession`確定）時のみ実行された直後）の3箇所へ接続。**設計上の重要な発見**：Path Bは既存コードで`.leader-summary-block`というDOM直接追記スタイルを使用しており、既存`reRenderChatArea()`（チャット全体再構築）をそのまま追加接続すると、この直接追記スタイルが失われ通常のAIバブル表示に変わってしまうことが判明したため、チャット全体を再構築しない限定更新方式（`_elrRefreshInChatArea()`）を新設して採用した。dispatchなし（`_liSession`がfalsy）の場合は該当if文自体に到達せずコード構造上100%スキップされる。
- **実APIテスト**：既存テスト案件「PhaseB4B検証用テスト案件」を再利用し、Auto Task1回（Writer+Reviewer最小構成）・手動Leader再生成1回・Path B dispatch1回（`handleLeaderDispatch(text, ['secretary'])`で明示的に発生させ確認）を実施。いずれも追加のページ操作なしでExecutive Leader Report・Constitution Structure Checkが即時反映されることを実測（Path A: `decisionId ed-msctwaf7avag`／手動再生成: `ed-msctwxi5q4vp`・`sourceMode:'manual_regeneration'`／Path B: `ed-msctz11o196d`・`pathSource:'pathB'`）。手動再生成・Path Bとも`.executive-leader-report`要素が1件のみ（重複なし・正しい置き換え）であることを確認。Path B実行後も`.leader-summary-block`の表示スタイルが変更前と同一であることを確認。Cross-case（案件切替）で他案件のReportが表示されないこと・F5後は`_executiveDecision`/`_constitutionValidation`ともnullへリセットされること・Output Draft（`status:'ready'`・`fields.approvedDecisionPackage`キー不在）／Output Engineが無変更であることを確認。Console Error 0（全工程）・Network 200のみ。実API概算¥12（Claude Cost Analysis実測差分）。
- **未実装・繰越（Phase B-5C後段以降候補）**：Executive Constitution全14条の完全な意味論的検証・Evidence内容の十分性判定・成果物品質/完成度の実質評価・Constitution違反によるOutput停止・Quality Gate・Completion Gate・Decision Ledger・Executive Memory。AI社員カードの「期限」表示は本工程でも変更していない。
- **検証**：JavaScript構文OK（インラインJS抽出・`node --check`）・`npm run dev-check` 200/200/200（B-5C-1〜3各工程で実施）・`git diff --check`問題なし・Console Error 0・Network異常なし。
- **Git・反映**：Code commit **a2834d3**（B-5C-1）＋**9e6d094**（B-5C-2）＋**58315ee**（B-5C-3）＋docs commit（本更新）。Decision 090。
- **次工程候補（比較対象・優先順位未確定）**：Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（pending/in_progress/completed/error/skippedへの置換）。**正式な次工程はユーザー承認後に決定する**。**Phase55未着手のまま維持**。

---

## Phase B-5 Constitution Validator Core 正式Complete（2026-08-03）

> 記録日: 2026-08-03。**Phase54 Complete維持・Phase55未着手**。**index.html（Code commit ea1ae68）のみ**。**server.js/lib/DB/schema.sql/API/UI（Executive Leader Report・AI社員カード期限表示含む）無変更**。

- **進捗**：Phase B-4 Approved Decision Package契約構造正式実装（正式Complete・維持）→ **Phase B-5 Constitution Validator Core ＝ 正式Complete**。
- **実装内容**：`validateExecutiveDecision(decision)`を新設。引数`decision`は読み取り専用（プロパティ代入なし）。新しいDecisionを生成せず、Decision・Approved Decision Package・Output Draftのいずれも変更しない。戻り値は`{version, passed, violations, checkedRules}`のみ。
- **呼び出し位置**：`_edRunDecisionEngine()`内、`_executiveDecision = decision;`で判断が確定した直後（Decision生成→`_executiveDecision`確定→Constitution Validator実行→結果を`_constitutionValidation`へ保持→既存後続処理、の因果順序を維持。Validatorが判断確定前に実行される経路はない）。早期return（`!inbox || !inbox.caseId`）時は`_constitutionValidation`も`null`へ揃えてリセット。
- **検証項目（12項目・構造整合性検証のみ）**：`executive_decision_exists`（Executive Decision存在確認）／`decision_id_present`（decisionId存在）／`decision_status_present`（decisionStatus存在・値域確認）／`executive_summary_present`（Executive Summary存在）／`decision_confidence_present`（Decision Confidence存在）／`source_decision_id_consistency`（Package.sourceDecisionIdとDecision.decisionIdの整合）／`package_only_when_approved`（Approved時のみPackage生成）／`package_null_when_not_approved`（非Approved時Package=null）／`output_draft_did_not_generate_package`（既存`affectsOutputDraft===false`を参照し、EDEの判断がOutput Draftを生成・変更していないことを確認）／`package_holds_source_decision_id`（PackageがsourceDecisionIdを保持）／`cross_case_consistency`（Decision/PackageのcaseId整合）／`single_decision_authority`（PackageがdecisionId／packageIdという独自識別子を持たず、Executive Decisionのみが判断主体であることを確認）。
- **非破壊性**：Node合成テスト13シナリオ26アサーション全PASSで、Decision／Package双方へのプロパティ変更が発生しないことを確認。`git show --stat ea1ae68`で変更範囲がExecutive Decision Engine Coreセクション内3箇所（`_constitutionValidation`宣言・Validator関数本体・`_edRunDecisionEngine()`内の呼び出し）に限定され、Executive Leader Report・Output Draft生成・F5復元処理には一切触れていないことを確認済み。
- **Path別接続確認（実APIテスト・低コストプロンプト）**：
  - **Path A（`atRunWorkflow()`）**：`decisionId: ed-mscq548ee05g`・`sourceMode:'auto_task'`・Validator`passed:true・violations:[]・checkedRules12件`を実測。
  - **手動Leader再生成（`atTriggerLeaderFinal()`）**：新規`decisionId: ed-mscq6pcrymzi`・`sourceMode:'manual_regeneration'`・Validator`passed:true・violations:[]`を実測。
  - **Path B**：直接チャット送信ではLeaderがdispatchせず`_liCollectIntegration('pathB', ...)`が起動しなかった（既存仕様どおり・異常ではない）。コード上は`_liCollectIntegration()`内で`pathSource`に関わらず同一の`_edRunDecisionEngine(inbox)`呼び出しへ到達するため、dispatch発生時はPath A／手動再生成と同一のValidator経路を通ることを確認済み。dispatchを強制再現する追加APIテストは実施していない。
- **F5復元**：F5後`_executiveDecision = null`・`_constitutionValidation = null`（既存仕様どおり・追加の永続化なし）。Output Draftは既存保存データからの復元のみで、Validator結果の保存・復元は対象外のまま。
- **未実装・繰越（Phase B-5後段／Phase B-6以降候補）**：Executive Constitution全14条の完全な意味論的検証・Evidence内容の十分性判定・成果物品質/完成度の実質評価・Constitution違反によるOutput停止・Validator結果のExecutive Leader Report等UI表示・Quality Gate・Completion Gate・Decision Ledger・Executive Memory・Self Improvement。AI社員カードの「期限」表示は本工程でも変更していない（別途対応保留）。
- **検証**：JavaScript構文OK（インラインJS抽出・`node --check`）・`npm run dev-check` 200/200/200・`git diff --check`問題なし・Console Error 0（全実機テスト通じて）・Network異常なし（すべて200 OK）。実API費用は本工程・前工程Phase B-5合計で概算¥13（Claude 5リクエスト・実測値）。
- **Git・反映**：Code commit **ea1ae68**（`feat: add executive constitution validator`）＋docs commit（本更新）。Tag作成なし。**push未実施**（ユーザー確認後に別途判断）。Decision 089。
- **次工程候補（比較対象・優先順位未確定）**：Validator結果のExecutive Leader Report表示／Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（pending/in_progress/completed/error/skippedへの置換）。**正式な次工程はユーザー承認後に決定する**。**Phase55未着手のまま維持**。

---

## Phase B-4 Approved Decision Package 正式Complete（Phase B-4A〜B-4D統合・Phase B-4E統合検証・2026-08-03）

> 記録日: 2026-08-03。**Phase54 Complete維持・Phase55未着手**。**index.html（Code commit 718f200／67ab6cb／95beda3／65fe551／b423acd）のみ**。**server.js/lib/DB/schema.sql/API/UI（AI社員カード期限表示含む）無変更**。

- **進捗**：Phase B-3 Executive Leader Report表示（正式Complete・維持）→ **Phase B-4 Approved Decision Package 契約構造正式実装・統合検証 ＝ 正式Complete**。
- **Phase B-4A（契約構造）**：`_edRunDecisionEngine()`冒頭で`decisionId`（`'ed-' + genId()`）をdecisionStatusに関わらず必ず1回発行。`_edBuildApprovedDecisionPackage(decisionId, inbox, decisionResult, confidence, alternatives, summary, approvedArtifacts)`はApproved時のみPackageを返し、Packageは独自IDを持たず`sourceDecisionId: decisionId`で元Decisionを参照する。
- **Phase B-4B（Path A接続）**：`atRunWorkflow()`が`_executiveDecision.approvedDecisionPackage`をcaseId／sourceDecisionId一致確認のうえ`_edApprovedPackageForOutput`として取得し、`buildOutputDraftFromLeaderFinal(text, {approvedDecisionPackage: _edApprovedPackageForOutput})`へ渡す。
- **Phase B-4C（手動再生成接続）**：`atTriggerLeaderFinal()`にPath Bとは別変数（`_manualApprovedPackageForOutput`／`_manualPkgCandidate`）で同型の取得・照合ロジックを実装。caseId不一致・sourceDecisionId不一致・Decision不在のいずれでも安全にnullへ落ちることを確認（誤流用防止ケースA〜D）。
- **Phase B-4D（fields保存・F5復元・後方互換）**：`buildOutputDraftFromLeaderFinal()`終盤で`fields.approvedDecisionPackage`へ複製保存。`if (approvedDecisionPackage) { fields.approvedDecisionPackage = pkg } else { delete fields.approvedDecisionPackage }`により、Packageなし時・旧形式Draft（キー自体が存在しない）のいずれでも残留・エラーなし。既存のPOST(JSON.stringify)→DB(JSONB)→GET(JSON parse)往復が自然に独立コピーを生むため、新規deepClone等の共通基盤は追加していない。
- **Phase B-4E（統合検証・正式完了判定）**：
  - **合成テスト**：13項目のNode合成テスト（実コード抜粋・DB/API非接触）を実施し全PASS。
  - **実APIテスト**：Auto Task 1回（Writer+Reviewer最小構成）＋手動Leader再生成1回を実施。Auto Task側`decisionId`（`ed-mscjykynt6fw`）と手動再生成側`decisionId`（`ed-mscjyxc2nitq`）が別値であること、`sourceMode`/`sourceEngine`の区別、`approvedDecisionPackage: null`（Hold状態のため正常）、`fields.approvedDecisionPackage`キー不在（生成時・F5復元後とも）を実機確認。既存Output Draftフィールド（slides/caption/cta/hashtags/imagePrompts/targetAudience/benefit/saveSharePrompt）は無傷。Executive Leader Reportは更新後のDecision Confidenceで正しく再描画。案件切替時はExecutive Leader Reportが正しく非表示（Cross-case保護）。Console Error 0・Network 200のみ。
  - **発見事項（軽微・コメントのみ）**：`buildOutputDraftFromLeaderFinal()`冒頭の`approvedDecisionPackage`受領部にPhase B-4B時点の古いコメント（「今回はfields保存等いずれにも使用しない」）がPhase B-4D実装後も残っていた。ロジックへの影響はゼロ（diffはコメント2行のみ）と確認したうえで、コメント文言のみ修正しコミット（**b423acd**・機能commitとは別コミット）。
  - **判定**：機能的な不具合は0件（コメント不整合のみ発見・修正済み）。**Phase B-4 Approved Decision Package 正式Complete**と判定。
- **所有関係（正式）**：Executive Decision Engine＝Packageの論理上の発行元・正本。Approved Decision Package＝`sourceDecisionId`を介した派生契約。`fields.approvedDecisionPackage`＝Output Draft側の複製（利用者であり所有者ではない）。将来のDecision Ledger（Phase C-1）が永続正本となる設計を維持。
- **未実装・繰越（Phase B-5以降）**：Constitution Validator・Quality Gate・Completion Gate・Decision Ledger永続化・`fields.executiveDecisionCache`。AI社員カードの「期限」表示は本工程では変更していない（別途対応予定）。
- **Git・反映**：Code commit 718f200（B-4A）／67ab6cb（B-4B）／95beda3（B-4C）／65fe551（B-4D）／b423acd（コメント修正）＋docs commit（本更新）。Tag作成なし。**push未実施**（ユーザー確認後に別途判断）。Decision 088。
- **次工程**：Phase B-5 Constitution Validator（未着手）。ただしユーザー承認なしに開始しない。**Phase55未着手のまま維持**。

---

## Phase B-2 Executive Decision Control 正式工程分割（Phase B-2A／B-2B・2026-08-02・docs正式化のみ・Code変更なし）

> 記録日: 2026-08-02。**Phase54 Complete維持・Phase55未着手**。**docsのみ**。**index.html/openaiClient.js/server.js/lib/DB/schema.sql/API/UI 無変更**。

- **進捗**：Executive Decision Engine Core（Phase B-1・正式Complete・維持）→ **Phase B-2 Executive Decision Control 因果接続調査・正式工程分割 ＝ docs正式化Complete**。
- **調査結果（実測）**：
  - **Path A通常フロー**：`atRunWorkflow()`が呼ぶ`/api/auto-task`は、AI社員実行→Reviewer→Strategy統合→`runLeaderFinalResponse()`（完成成果物生成）までを`runAutoTaskWorkflow()`という単一の非同期関数・単一HTTPリクエスト/レスポンス往復の中で完結させる。クライアント側EDEはLeader Final生成前のデータへ介入できない。
  - **Path A手動再生成（`atTriggerLeaderFinal()`）**：完成成果物エンジン`runLeaderFinalResponse()`ではなく軽量な`leaderSummary()`（「🎯今回の推奨方針／①②③」形式・completed/error/skipped分離なし）を使用。EDEが読む`_wlLastResults`は前回Auto Task時点のスナップショットのままで、今回生成した`data.reply`とは紐づいていない。既存`buildOutputDraftFromLeaderFinal(data.reply)`呼び出しに`noCompletedResults`判定が渡されていない（既知制約）。
  - **Path B通常チャット**：`handleLeaderDispatch()`〜`triggerStrategyConsolidate()`〜`triggerLeaderSummary()`にはOutput Draft生成（`buildOutputDraftFromLeaderFinal()`／`createOutputDraft()`）の呼び出しが存在しない（全文検索で確認）。
- **正式採用した接続方式**：案D（段階導入）。Leader Final候補生成後・Output Draft確定前にEDEを接続。追加AI実行なし・既存Output Draft挙動無変更。
- **正式工程分割**：
  - **Phase B-2A（Executive Decision Control — Path A Causal Position）**：対象はPath A通常フローのみ。Leader Final Candidate入力契約の確立（`sourceEngine:'runLeaderFinalResponse'`）。目的は因果位置と入力契約の確立であり、正式な成果物制御ではない。既存Output Draft挙動・POST回数（1回）は完全無変更。
  - **Phase B-2B（Manual Leader Regeneration Alignment）**：対象は`atTriggerLeaderFinal()`。`leaderSummary()`と`runLeaderFinalResponse()`の責務差の整合化・`_wlLastResults`陳腐化判定・`noCompletedResults`対応。Phase B-2A完了後に開始（同時実装しない）。
- **Path B通常チャットの扱い**：Output Draft制御対象外のまま維持。Leader Inbox生成・EDE実行（decisionStatus／Decision Confidence／Strategic Alternatives／Executive Summary）は引き続き許可。
- **Approved暫定条件**：completed成果なし→insufficient、completed成果あり→hold、Quality Gate・Completion Gate未定義の間はapprovedへ到達させない（第三の移行方式）。
- **Executive Reportと完成成果物の生成順序**：案2（完成成果物候補生成→Executive Decision→Executive Summary確定→既存Output Draft）を正式採用。追加AI実行なし。
- **正式ロードマップ改訂**：Phase B-1（Complete維持）→**Phase B-2A→Phase B-2B**→Phase B-3（Executive Leader Report・旧B-2相当）→Phase B-4（Approved Decision Package・旧B-3相当）→Phase B-5（Constitution Validator・旧B-4相当）→Phase A-2〜A-4→Phase C-1〜C-3→Phase D-safety→Phase D→Phase E→Phase F-1〜F-2。詳細は`04ROADMAP.md`参照。
- **検証（実施範囲）**：既存コード（`atRunWorkflow()`／`server.js`の`/api/auto-task`／`runAutoTaskWorkflow()`／`runLeaderFinalResponse()`／`leaderSummary()`／`atTriggerLeaderFinal()`／`triggerStrategyConsolidate()`／`triggerLeaderSummary()`／`buildOutputDraftFromLeaderFinal()`の全呼び出し箇所）を読み取り専用で調査し、各方針の実装可否・整合性を確認。**コード・DB・API・UIの変更は一切なし**。
- **Git・反映**：docs commit（本更新）のみ・Tag作成なし・**push未実施**（ユーザー確認後に別途判断）。Decision 087。
- **次工程**：未定（候補：Phase B-2A Executive Decision Control — Path A Causal Position）。**Phase55未着手のまま維持**。

---

## Phase A-1g Executive Constitution v1.0.0 正式化 ／ Executive Decision Engine 正式採用（2026-08-02・docs正式化のみ・Code変更なし）

> 記録日: 2026-08-02。**Phase54 Complete維持・Phase55未着手**。**docsのみ（01PROJECT_STATUS.md／02PHASE_PROGRESS.md／04DECISIONS.md／04ROADMAP.md／06HANDOVER_NEXT_CHAT.md／CHANGELOG.md）**。**index.html/openaiClient.js/server.js/lib/DB/schema.sql/API/UI 無変更**。

- **進捗**：Leader Integration Layer Phase A（正式Complete・維持）→ **Phase A-1g Executive Constitution v1.0.0 正式化・Executive Decision Engine 正式設計採用 ＝ docs正式化Complete**。
- **実装要点（今回はdocsのみ・以下はすべて設計・方針決定）**：
  - **Executive Constitution v1.0.0**：AI COMPANY全体の最高位ルールとして全14条を正式採用（第1条Evidence原則〜第14条安全側既定値原則）。変更統制はユーザー承認・Version更新・`04DECISIONS.md`（暫定正本）またはDecision Ledger（正式正本）への記録の3条件を必須とする。
  - **Executive Decision Engine**：既存Leader Integration Layer Phase Aの`_leaderIntegration`（現時点では成果物確定後の事後観測層・Leader Final生成／Output Draft確定／Output Engine入力には未接続）を因果連鎖内へ昇格させる会社判断層として正式採用。新規独立Engineの重複実装ではない。
  - **Executive Report併存**：既存`LEADER_FINAL_PROMPT`（完成成果物生成）は無変更。Executive Summary（結論／採用案／採用理由／却下・保留案／期待成果／主要リスク／次工程）を上位判断層として将来Approved Decision Packageへ追加する方針とし、完成成果物を置き換えない。
  - **状態3軸分離**：`decisionStatus`（新設候補：approved/rejected/hold/insufficient）／`outputStatus`（既存`OUTPUT_STATUS`・無変更）／`qualityStatus`（既存`packageQuality.status`・無変更）を分離。
  - **Decision Confidence**：既存`_intelCalculateConfidence()`の再利用＋Hard Gate上乗せを正式方針とし、新加重式は発明しない。Hard Gate候補＝completed成果0件はInsufficient固定（既存`noCompletedResults`判定と同一条件）等。
  - **Strategic Alternatives**：Primary1件／Secondary最大2件／Hold最大3件・順位（rank）と判断状態（decisionStatus）は別軸。自動切替は現段階で行わない。
  - **Approved Decision Package**：Output Engineへの将来の唯一の正式契約。導入時は後方互換必須・Package不在時は既存Workflow維持。
  - **保存方式（段階導入案D）**：Phase B＝メモリのみ→Phase B後半候補＝Output Draftへの一時キャッシュ（`fields.executiveDecisionCache`等・正本と誤認しない名称に限定）→Phase C-1＝専用`executive_decisions`永続化。**`output_drafts`は`output_id`PRIMARY KEYのupsert上書き方式のため、追記型・過去記録不変の要件と構造的に非互換であり、Decision Ledger正本として使用しない**（実装調査で確認済み）。
  - **Executive Memory**：Decision Ledger永続化済み・Learning Center永続化済み・Outcome Record存在・Instagram実運用データ存在・Self Improvement利用可能、のすべてを着手条件とし、Phase F-2（最後段）に配置。
- **正式ロードマップ改訂**：Phase A（正式Complete）→Phase A-1g（本工程）→**Phase B-1〜B-4**（Executive Decision Engine Core／Executive Leader Report表示／Approved Decision Package契約化／Constitution Validator）→Phase A-2〜A-4（内容無変更・順序のみ後退）→**Phase C-1〜C-3**（Decision Ledger永続化／Output Engine Knowledge Base化／Learning Center・Outcome Record永続化）→Phase D-safety→Phase D→Phase E→**Phase F-1〜F-2**（Self Improvement Intelligence／Executive Memory）。詳細は`04ROADMAP.md`参照。
- **検証（実施範囲）**：既存コード（Leader Integration Layer実装・`runLeaderFinalResponse()`・Output Engine状態定義・Evidence/Confidence共通基盤・`isAIGatewayExecutionAllowed()`）およびDB定義（`output_drafts`のPRIMARY KEY・upsert方式）を読み取り専用で調査し、各方針の実装可否・整合性を確認。**コード・DB・API・UIの変更は一切なし**。
- **Git・反映**：docs commit（本更新）のみ・Tag作成なし・**push未実施**（ユーザー確認後に別途判断）。Decision 086。
- **次工程**：未定（候補：Phase B-1 Executive Decision Engine Core）。**Phase55未着手のまま維持**。

---

## AI COMPANY Leader Integration Layer（Phase A）後半 **正式リリースComplete**（2026-08-01・Code commit 5401b68/6032893/0d125e7・main push・Render反映・PC本番確認・iPhone実機確認はこれから実施）

> 記録日: 2026-08-01。**Phase54 Complete維持・Phase55未着手**。**`index.html`＋`openaiClient.js`のみ**（工程1 messages案件別正本化・工程2 Leader Final状態サマリー分離・工程3-2 Output Draft誤認防止）。**server.js（messages案件別正本化を除き）/DB/schema.sql/API 無変更**。

- **工程1・messages案件別正本化**：`server.js`の`/api/auto-task`（user/assistant保存）・`/api/consult`（user/assistant保存）計4箇所の`saveMessage()`呼び出しへ、既にリクエストボディで受領済みの`caseId`を追加（既存`/api/messages`と同一形式）。保存対象・保存回数・`saveMessage()`本体は無変更。Code commit **5401b68**（`fix: scope auto task messages by case`）。
- **工程2・Leader Final状態サマリー分離**：`openaiClient.js`の`runLeaderFinalResponse()`で`completed`抽出条件は維持しつつ、`error`/`skipped`（`!isPostProcess`）を状態サマリーとして分離。全員成功時は既存プロンプトと完全一致（オフライン単体比較で実証）。error理由は1行80文字以内へ安全短文化。completed成果0件時は専用の安全側プロンプトへ分岐。Code commit **6032893**（`feat: include task status in leader final`）。
- **工程3・統合検証**：正常系・一部成功・completed成果0件をlocalhost実DBで検証。一部成功時、Leader Final固定出力フォーマット（`LEADER_FINAL_PROMPT`）と状態サマリー指示が競合し独立セクション化されない問題、およびcompleted成果0件時にOutput Draftが`status:'ready'`・Package Quality87点「良好」評価のまま保存される誤認問題を実測発見。
- **工程3-2・誤認防止修正**：`index.html`の`buildOutputDraftFromLeaderFinal(finalText, opts)`へ`opts.noCompletedResults`を追加（`integratedCount===0`で判定・返却形式は無変更）。`true`時は`_lastOutputDraft.status`を既存`OUTPUT_STATUS.ERROR`へ、`packageQuality`を`score:0・status:'insufficient'`へ固定。Leader Finalプロンプトへ「完成成果物出力後、必ず末尾に独立見出し『## 担当実行状況』を追加」の指示を強化。Code commit **0d125e7**（`fix: prevent output misrepresentation on zero completed tasks`）。
- **実測（再検証3パターン）**：正常系＝Package Quality 71点needs_work（従来どおり機械評価動作）・状態サマリーなし。一部成功＝Leader Final末尾に独立見出し「## 担当実行状況」でBranding担当のスキップ理由明記。completed成果0件＝Output Draft `status:'error'`・`packageQuality.score:0・insufficient`をDB実測確認。全パターンでCross-case混入なし・新規`case_id=NULL`なし・二重保存なし・Console Error 0・dev-check 200/200/200。
- **検証方法**：error/skipped再現はlocalhost限定で`AGENT_WORKFLOW_CONFIG.enabled`を一時的にfalseへ変更し検証直後に完全復元（本番設定変更・永続コード差分なし）。
- **既知の残課題（今回対応せず）**：Task管理⇔サーバー`skipped`状態同期ギャップ（`LIVE_TO_TASK_STATUS`に`skipped`変換先なし・既存挙動）／F5復元時の`isLeaderFinal`表示用メタフラグ欠落（messagesスキーマ非対応・既存挙動）／`messages`テーブルのRLS DELETEポリシー不在（既存制約・テストデータ累計remaining約53件）／`enabled:false`スキップ時のtask_history.workflowId欠落（既存の実装漏れ）。
- **Git・反映**：Code commit **5401b68**＋**6032893**＋**0d125e7**・docs commit＝本更新・Annotated Tag **v1.01-leader-integration-phase-a-complete**・main push・Render反映。**PC本番確認 完了**（ユーザー実施：ログイン/Auto Task/Leader Integration Layer/AI社員振り分け/Leader Final/Output Engine/Task同期/案件切替すべて正常・Cross-case混入なし・Console Error/Network異常なし。Task表示は全案件13件／案件内は該当案件のみの正常仕様を確認。Output Engineの内容差分はLeader Integration Layer改善に伴う正常な更新として確認。iPhone実機確認は対象外）。**AI COMPANY Leader Integration Layer（Phase A）正式Complete**。
- **次工程**：未定（Phase A-2 AI社員間再依頼／Phase A-3 成果物受け渡し／Phase A-4 Quality Loopは設計のみ完了・実装未着手。またはmessages RLS対応・Task skipped同期ギャップ対応等の残課題）。**Phase55未着手のまま維持**（Decision 085）。

---

## AI COMPANY Leader Integration Layer（Phase A） **正式リリースComplete**（2026-07-31・Code commit ad5eaf7/af43263・main push・Render反映・PC本番確認・iPhone実機確認はこれから実施）

> 記録日: 2026-07-31。**Phase54 Complete維持・Phase55未着手**。**`index.html` の1ファイルのみ（Phase A本体 +336/-6・Hotfix +11/-0）**。**server.js/lib/DB/schema.sql/API/既存Path A・Path B内部処理/switchCase()/`.at-result-card`仕様/chatHistory構造/Output Draft保存仕様 無変更**。

- **進捗**：**Phase A-1a 共通基盤（`_leaderIntegration`/`_liPathBSessions`/`_liCurrentCaseId()`/Leader Inbox構造） → A-1b Path A Adapter → A-1c Path B Adapter → A-1d 比較・矛盾候補・採否候補ロジック → A-1e 共通オーケストレーション（`_liCollectIntegration()`）・Path A/Path B接続 → 案件混入Hotfix → 実機検証 ＝正式リリースComplete**。
- **実装要点**：`_liAdaptPathA()`は`_atTaskHistory`（`agentId`/`result`欠落を実測確認）ではなく`_wlLastResults`をソースに採用／`_liAdaptPathB()`は`interactionId`（`'li-'+genId()`）＋`_liPathBSession`でchatHistory非接触のまま過去回答混入を防止／`_liCompareArtifacts`/`_liDetectConflictCandidates`はルールベースのみ・矛盾は必ず`candidate`／`_liDecideAdoptionCandidates`は情報不足時`hold`が既定値／`_liCollectIntegration()`をPath A（`atRunWorkflow()`Leader Final受領直後）・Path B（`triggerLeaderSummary()`末尾）・手動Leader Final再生成（`atTriggerLeaderFinal()`）の3箇所へ接続。
- **案件混入Hotfix**：既存のOutput Draft復元保護（Phase54-2d）と`atTriggerLeaderFinal()`の相互作用による既存不具合（案件切替後、前案件のOutput Draftが別案件へ混入し得る）を実装検証中に発見。`atTriggerLeaderFinal()`冒頭に`_liCurrentCaseId()`と`_liLastPathAResultsCaseId`の厳格一致ガードを追加し、不一致時は安全停止・再実行を案内（案件切替時のDOM一括クリアは不採用）。
- **実測**：Path A/Path Bとも`pathSource`/`workflowId`/`interactionId`/`caseId`の正しい分離を確認／Hotfix適用前に実際の混入事故（`out_1785449189461`が`case-ms82952wltd5`から「テスト」案件へ移動）を実機で確認し既存POST経路で復旧／Hotfix適用後は別案件切替時の再現テストで`/api/leader-summary`・`/api/output-drafts`呼び出し0・chatHistory追加0・Draft移動なしを確認／JavaScript構文OK・dev-check 200/200/200・git diff --check問題なし。
- **Git・反映**：Code commit **ad5eaf7**＋**af43263**・docs commit＝本更新・Annotated Tag **v1.01-leader-integration-phase-a**（作成予定）・**main push・Render反映はこれから**（ユーザー承認後）。**PC本番確認・iPhone実機確認はpush後にユーザー実施予定**。Decision 084。保護対象4件は未stage・未commitで保護。
- **次工程**：未定（Phase A-2 AI社員間再依頼・Phase A-3 成果物受け渡し・Phase A-4 Quality Loopは設計のみ完了・実装未着手・着手にはユーザー承認が必要）。**Phase55未着手のまま維持**。

---

## Affiliate Intelligence Company 工程8-1/8-2/8-3A/8-3B/8-3B補正/8-3C — Market Opportunity Intelligence（①層） **正式リリースComplete**（2026-07-30・Code commit 2de9317/4ef70ca/e61e7d5/3b1e5b7・main push・Render反映・PC本番確認・iPhone実機確認はこれから実施）

> 記録日: 2026-07-30。**Phase54 Complete維持・Phase55未着手**。**`index.html` の1ファイルのみ（foundation +172/-0・ui +174/-0・persist +32/-0・fix +28/-9）**。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue/ASP/Content/Competition Intelligence/ランキング順位/integratedScore/estimatedProfit 無変更**。

- **進捗**：工程1 → 工程2 → 工程3 → 工程4 → 工程5 → 工程6 → 工程7 → **工程8-1/8-2 Market Opportunity Intelligenceデータ構造・案件内市場集約・Evidence共有・Confidence → 工程8-3A表示UI → 8-3B永続化・Copy → 8-3B補正（Evidence母集団整合） → 8-3C実Supabase検証 ＝正式リリースComplete**。
- **実装要点**：`INTEL_MARKET_MIN_PRODUCT_COUNT=2`（商材2件未満は強制insufficient）／`_intelBuildMarketFromCases`（案C＝案件内集約・`_aicNormalizeKeyPart`再利用）／共通ヘルパー`_intelSyncMarketGroupProductEvidence`（表示・保存共通利用・市場内対象商材群のProduct Evidenceへ`usedBy:'market'`冪等追記）／`_intelCalculateMarketConfidence`（既存`_intelCalculateConfidence`再利用）／`_aicCurrentSavedMarket`/`_aicSavedMarketForRow`（marketKey＋caseId一致で正本表示）／採用時**七書き**（affiliateContext+product+revenue+asp+content+competition+market・POST1回）。
- **工程8-3B補正の経緯**：初回実装ではderived集計（productCount等）は市場内複数商材対象だが、Evidence/Confidence母集団は採用商材1件分のみという不整合を発見。共通ヘルパー新設で市場内対象商材群のEvidenceを保存前に同期するよう修正し、既存5層Confidenceへの回帰なしを確認。
- **意味の固定**：Market Confidenceは登録候補情報の根拠充足度を示すのみであり、実検索数・実トレンド・市場規模・市場成長率・実需要を示すものではない。登録候補商材数（AI会社内の自社候補件数）はCompetitionの競合数（他社競合数）とは別軸。
- **実測**：採用後`fields.intelligenceContext`に`product`/`revenue`/`asp`/`content`/`competition`/`market`が揃うことを確認（専用caseId・商材2件）／productCount=2／Evidence総数28件中22件が両商材のproductIdentifierにまたがる（母集団整合の実証）／derived集計値（想定利益合計23,840円/平均11,920円・IG適性平均65・他社競合数平均10）が実値と完全一致／F5復元一致／案件切替混入なし／テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts・cases）／純関数・UI・保存・補正テスト計115アサーション全PASS・dev-check 200/200/200・Console 0。
- **Git・反映**：Code commit **2de9317**＋**4ef70ca**＋**e61e7d5**＋**3b1e5b7**・docs commit＝本更新・Annotated Tag **v1.01-affiliate-market-opportunity-persistence**（予定）・**main push・Render反映はこれから**（ユーザー承認後）。**PC本番確認・iPhone実機確認はpush後にユーザー実施予定**。Decision 083。保護対象4件は未stage・未commitで保護。
- **次工程**：未定（Market Opportunity Intelligence完成によりVersion2 Core 7層のうち6層完成・残るは⑦Self Improvement Intelligenceのみ。Instagram実運用前のため実績データ供給条件を再確認してから着手判断）。**Phase55未着手のまま維持**。

---

## Affiliate Intelligence Company 工程7-1/7-2/7-3A/7-3B/7-3C — Competition Intelligence（④層） **正式リリースComplete**（2026-07-29・Code commit 675b3d0/3feec7b/d941cfd・main push・Render反映・PC本番確認・iPhone実機確認はこれから実施）

> 記録日: 2026-07-29。**Phase54 Complete維持・Phase55未着手**。**`index.html` の1ファイルのみ（foundation +107/-1・ui +117/-0・wire +28/-0）**。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue/ASP/Content Intelligence/ランキング順位/integratedScore/estimatedProfit 無変更**。

- **進捗**：工程1 → 工程2 → 工程3 → 工程4 → 工程5 → 工程6 → **工程7-1/7-2 Competition Intelligenceデータ構造・Evidence共有・Confidence → 工程7-3A表示UI → 7-3B永続化・Copy → 7-3C実Supabase検証 ＝正式リリースComplete**。
- **実装要点**：`INTEL_MODULE_KEYS`へ`'competition'`追加／`INTEL_COMPETITION_INPUT_FIELDS`（competitors/lifespanMonths/igFit）／`_intelSyncCompetitionFromProduct`（既存Product Evidenceにのみ`usedBy:'competition'`冪等追記・新規Evidence生成なし）／`_intelCalculateCompetitionConfidence`（既存`_intelCalculateConfidence`再利用・`confidenceOwner:'competition'`で分離）／`_aicCurrentSavedCompetition`/`_aicSavedCompetitionForRow`（productIdentifier＋caseId一致で正本表示）／採用時**六書き**（affiliateContext+product+revenue+asp+content+competition・POST1回）。
- **意味の固定**：Competition Confidenceは競合環境を判断する根拠の充足度を示すのみであり、競合の強弱・参入余地・売れやすさ・推奨可否を示すものではない（good/watch/insufficientはConfidence状態）。competitorsは生値のまま・新スコア/新閾値/参入余地判定なし。
- **実測**：採用後`fields.intelligenceContext`に`product`/`revenue`/`asp`/`content`/`competition`が揃うことを確認／Evidence14件不変（product14/revenue9/asp4/content3/competition3・新規0）／Competition Confidence Medium（64点・independent3件）／F5復元完全一致／caseId分離／テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts・cases）／純関数23/23 PASS・dev-check 200/200/200・Console 0。
- **Git・反映**：Code commit **675b3d0**＋**3feec7b**＋**d941cfd**・docs commit＝本更新・Annotated Tag **v1.01-affiliate-competition-intelligence-persistence**（予定）・**main push・Render反映はこれから**（ユーザー承認後）。**PC本番確認・iPhone実機確認はpush後にユーザー実施予定**。Decision 082。保護対象4件は未stage・未commitで保護。
- **次工程**：未定（Competition Intelligence完成により残るIntelligence層＝Market Opportunity/Self Improvement）。**Phase55未着手のまま維持**。

---

## Affiliate Intelligence Company 工程6-1/6-2/6-3A/6-3B/6-3C — Content Intelligence（⑥層） **正式リリースComplete**（2026-07-29・Code commit 2b3fdd0/f2b0b5e・main push・Render反映・PC本番確認・iPhone実機確認はこれから実施）

> 記録日: 2026-07-29。**Phase54 Complete維持・Phase55未着手**。**`index.html` の1ファイルのみ（foundation +113/-0・ui +126/-0）**。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue/ASP Intelligence/ランキング順位/integratedScore/estimatedProfit 無変更**。

- **進捗**：工程1 → 工程2 → 工程3 → 工程4 → 工程5-1/5-2/5-3 → **工程6-1/6-2 Content Intelligenceデータ構造・Evidence共有・Confidence → 工程6-3A表示UI → 6-3B永続化・Copy → 6-3C実Supabase検証 ＝正式リリースComplete**。
- **実装要点**：`INTEL_CONTENT_INPUT_FIELDS`（saveRatePred/clickRatePred/igFit）／`_intelSyncContentFromProduct`（既存Product Evidenceにのみ`usedBy:'content'`冪等追記・新規Evidence生成なし）／`_intelCalculateContentConfidence`（既存`_intelCalculateConfidence`再利用・`confidenceOwner:'content'`で分離）／`_aicCurrentSavedContent`/`_aicSavedContentForRow`（productIdentifier＋caseId一致で正本表示）／採用時**五書き**（affiliateContext+product+revenue+asp+content・POST1回）。
- **実測**：採用後`fields.intelligenceContext`に`product`/`revenue`/`asp`/`content`が揃うことを確認／Evidence14件不変（product14/revenue9/asp4/content3）／Content Confidence Medium（64点・independent3件）／テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts）／回帰テスト118/118 PASS・dev-check 200/200/200・Console 0。
- **Git・反映**：Code commit **2b3fdd0**＋**f2b0b5e**・docs commit＝本更新・Annotated Tag **v1.01-affiliate-content-intelligence-persistence**（予定）・**main push・Render反映はこれから**（ユーザー承認後）。**PC本番確認・iPhone実機確認はpush後にユーザー実施予定**。Decision 081。保護対象4件は未stage・未commitで保護。
- **次工程**：未定（Content Intelligence完成により残るIntelligence層＝Competition/Market/Self Improvement）。**Phase55未着手のまま維持**。

---

## Affiliate Intelligence Company 工程5-1・5-2 — ASP Intelligence（③層）**正式リリースComplete**（2026-07-28・Code commit 17587296c9413f53dcc05e4c72897ac4e8d0643a・main push・Render反映・iPhone実機確認 完了（2026-07-28・ユーザー実施・崩れなし・横スクロールなし・白画面/無限ロード/画面停止なし））

> 記録日: 2026-07-28。**Phase54 Complete維持・Phase55未着手**。**`index.html` の1ファイルのみ（+212/-0）**。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue Intelligence 無変更**。

- **進捗**：工程1 → 工程2 Evidence/Confidence基盤 → 工程3 Product Intelligence → 工程4 Revenue Intelligence → **工程5 ASP Intelligence（5-1データ構造/Evidence配線→5-2 Confidence）＝正式リリースComplete**。
- **工程5-1**：`intelligenceContext.asp`（既存受け皿）／比較単位＝正規化商品名×market（ASP名は含めない）／Active評価のみ候補化／推奨ASPは既存`estimatedProfit`最大＋決定的タイブレーク／採用商品Evidenceに`usedBy:'asp'`冪等追記。純関数18 PASS。
- **工程5-2**：`_intelCalculateAspConfidence`＝`usedBy:'asp'`Evidenceのみ母集団に既存`_intelCalculateConfidence`再利用／独立3件未満Insufficient／比較ASP数・有効利益候補2件未満は強制insufficient／`confidenceOwner:'asp'`でProduct/Revenueと分離。追加テスト26 PASS（合計44/44）。
- **対象外**：表示UI接続・Output Draft永続化・F5復元・端末同期は工程5-3へ分離・今回未実装。

---

## Affiliate Intelligence Company 工程4 — Revenue Intelligence（⑤層）**正式リリースComplete（4-1〜4-4）**（2026-07-27・Code commit 8cde936・main push・Render反映・実Supabase検証/remaining=0・iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・横スクロールなし・空状態正常））

> 記録日: 2026-07-27。**Phase54 Complete維持・Phase55未着手**。**`index.html` の1ファイルのみ（+230/-1）**。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/ランキング順位/`_intelCalculateConfidence`本体/Product 無変更**。

- **進捗**：工程1 → 工程2 Evidence/Confidence基盤 → 工程3 Product Intelligence → **工程4 Revenue Intelligence（4-0設計→4-1スキーマ/Evidence→4-2 Confidence→4-3表示→4-4両書き永続化）＝正式リリースComplete**。
- **4-1**：`INTEL_MODULE_KEYS`へ`'revenue'`追加（後方互換）／Revenue定数（入力7・派生2）／`_intelBlankRevenue`・`_intelSyncRevenueFromProduct`（Product Evidenceを`usedBy:'revenue'`共有・新規生成なし・Product非破壊）。
- **4-2**：`_intelCalculateRevenueConfidence`＝財務入力Evidenceのみで`_intelCalculateConfidence`再利用（派生二重計上なし）・独立3件未満Insufficient・status既存ヘルパ再利用・Product Confidenceと分離。
- **4-3**：AIC最小パネル＋カードRevenueライン（使い捨てプレビュー・非永続・POST0・円/月・null情報なし・0有効・順位不変・375px横はみ出しなし・HTMLエスケープ）。
- **4-4**：採用処理でRevenueも同一`intelligenceContext`へ両書き→既存push1回（採用1回=POST1回）・保存済みRevenue優先表示💾・旧Draトはプレビューfallback。
- **完了条件（実測）**：純関数31＋31・表示12・永続化15 全PASS・dev-check 200/200/200・Console 0・回帰なし・**実Supabase保存（POST1）/F5復元（Confidence保存値維持）/表示復元POST0/Evidence件数不変（10・Revenue専用生成なし）/テストデータ限定削除 remaining=0**。
- **Git・反映**：Code commit **8cde936**・docs commit（本更新）・Annotated Tag **v1.01-affiliate-revenue-intelligence**・**main push・Render反映**・**iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・横スクロールなし・空状態正常）**。保護対象4件は未stage・未commit。**Decision 078**。
- **次工程**：**ASP Intelligence（③層）開始前調査・設計**（未着手）。**Phase55未着手のまま維持**。

---

## Affiliate Intelligence Company 工程3 — Product Intelligence 正式化（3-1/3-2/3-3）**工程3-3 正式Complete**（2026-07-27・Code commit 3ef7495・main push・Render反映・実Supabase検証/remaining=0）

> 記録日: 2026-07-27。**Phase54 Complete維持・Phase55未着手**（本工程でPhase55を開始しない）。**`index.html` の1ファイルのみ**。**server.js・lib・DB・schema.sql・API・`_icpDeriveTopic`・Workflow Wiring・ランキング順位・Confidence計算式・工程3-2表示関数 無変更**。

- **Affiliate Intelligence Company 進捗**：工程1完了 → 工程2 Evidence/Confidence共通基盤 正式Complete → **工程3 Product Intelligence 正式化（3-1 Productスキーマ・Evidence配線 → 3-2 ランキングConfidence表示 → 3-3 採用時の両書き・保存・F5復元）＝工程3-3 正式Complete**。
- **工程3-1**（**28fa51c**・+159/-0）：`intelligenceContext.product`／`products[]`（初期空）／Product Evidence（冪等）／calculated Evidence（独立件数外）／`product.confidence`（工程2ロジック再利用）／`productStatus`/`confidenceOwner`/`learningSummary`／生成helper `_intelSyncProductFromAffiliate`（自動実行なし）／後方互換。
- **工程3-2**（**1d04f31**・+49/-0）：ランキングカードへ表示時Confidenceプレビュー（`_aicBuildProductConfidence`/`_aicBuildConfidenceHtml`・使い捨てctx・非永続・順位不変）。純関数14/14。
- **工程3-3**（**3ef7495**・+58/-10）：`adoptAffiliateForContentPlanning()` を両書き化。一時変数で `nextAffiliateContext`（フィールド名不変）＋`nextIntelligenceContext`（`_intelGetContext`→deep copy→`_intelSyncProductFromAffiliate`→product補完→`ctx.product`明示代入）を構築 → 必須項目・**caseId 6項目一致**（＋`_intelContextCaseMatches`）→ 全成功時のみ実Draftへ一括反映（片方だけ書かない）→ **既存 `pushOutputDraftToServer` を1回**（`_intelSaveContext`不使用）。失敗/欠落/不一致は反映も保存もせずエラー表示。`products[]`は後方互換維持・新規追加なし。`channelScope`二値併存（affiliate='all'/product='instagram'・非統一）。
- **完了条件（実測）**：隔離テスト A〜F 全合格・dev-check 200/200/200・Console 0・回帰なし・**実Supabase保存（採用1回=POST1回）**・**F5復元成功**（product子項目/calculated Evidence/confidence/evidence履歴維持）・**同一商品Evidence 14→14**・**別商品Product置換・Evidence 14→28（旧保持）・新usedは旧非参照**・**テストデータ限定削除 remaining=0（API読戻し draft=null）**。
- **Git・反映**：Code commit 28fa51c/1d04f31/3ef7495・docs commit（本更新）・Annotated Tag **v1.01-affiliate-product-intelligence-persistence**・**main push・Render反映**・**iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・空状態正常）**。保護対象4件は未stage・未commitで保護。**Decision 077**。
- **次工程**：未定（候補：採用済み商品の保存済みConfidence優先表示＝案A／各Intelligence本体）。**Phase55未着手のまま維持**。

---

## Affiliate Intelligence Company 工程2 — Evidence / Confidence 共通基盤 **正式Complete**（2026-07-26・Code commit 29d82c1・iPhone実機確認完了）

> 記録日: 2026-07-26。**Phase54 Complete維持・Phase55未着手**（本工程でPhase55を開始しない）。**`index.html` の1ファイルのみ（+372/-0）**。**server.js・lib・DB・schema.sql・API・新DB列・新API 無変更**。

- **Affiliate Intelligence Company 進捗**：工程1 完了 → **工程2 Evidence/Confidence 共通基盤 実装・実機検証完了** → 工程3 Product Intelligence 正式化（未着手）。
- **実装（横断層A・共通土台のみ）**：`fields.intelligenceContext`（JSONB・12モジュール受け皿＋evidence[]＋confidence{overall,byModule}）／**Evidence共通型**（7種・`ev-<UUID>`・reliability unknown既定・`derivedFromEvidenceIds`・検証〔型/caseId一致/日付/ID重複/自己参照/循環/PII警告〕・上限200警告のみ）／**Confidence共通型**（Level High/Medium/Low/Insufficient・**独立Evidence3件未満は点数不問で Insufficient**・推定依存で減点・Decision 032統合）／`_intel*` helper／**AICパネル最小表示**（Leader判断直下・空データは Insufficient）。
- **既存維持**：`affiliateContext`／`_icpDeriveTopic()`／`adoptAffiliateForContentPlanning()`／Workflow Wiring／server.js／lib／DB／schema.sql／API **無変更**。`intelligenceContext.product` は空の受け皿（自動ミラー・正本切替なし）。**採用商材正本は引き続き `affiliateContext`**。
- **完了条件（実測）**：インラインJS 2ブロック構文OK・**純関数 18/18 PASS**・**dev-check 200/200/200**・console error 0・AICパネル実描画OK（PC/375pxモバイル・横はみ出しなし）・**実Supabase保存成功（POST1回）**・**F5復元成功**（source:db・Evidence1件・ID/type/caseId一致・reliability=unknown維持・confidence構造健在）・**affiliateContext併存維持**・**テストデータ削除 remaining=0**（ユーザーSQL実行）。
- **Git・反映**：Code commit **29d82c1**・docs commit（本更新）・Annotated Tag **v1.01-affiliate-intelligence-evidence-confidence**・**main push・Render自動デプロイ**。保護対象4件は未stage・未commitで保護。
- **iPhone実機確認 完了**（2026-07-26・本番でLeader統合判断直下に表示・文字切れ/重なり/横幅崩れなし・AIC全体正常）＝**工程2 正式Complete**。**未確認（残）**：Confidence重みの業務精度（初期ヒューリスティック・将来Learning調整）／Product Intelligenceとの実接続（工程3）。
- **次工程**：工程3 Product Intelligence 正式化（未着手）。**Phase55未着手のまま維持**（Decision 076）。

---

## Instagram自動運営 Workflow Wiring 本体（Affiliate選定→Instagram投稿企画）**完了・本番反映済み**（2026-07-24・commit 745dd1e）

> 記録日: 2026-07-24。**Phase54 Complete維持・Phase55未着手**（本工程でPhase55を開始しない）。**`index.html` の1ファイルのみ（+89/-0）**。**AI実行・新API・server.js・lib・DB・Migration・schema.sql・API shape 無変更**。

- **Instagram自動運営 進捗**：工程1-A → 1-B（0a〜0d・本体・Active Case Hotfix）→ 1-C（schema記録）→ 1-D（工程1クローズ）→ **Workflow Wiring 本体（Affiliate選定→Instagram投稿企画）完了・本番反映済み**。
- **実装**：`adoptAffiliateForContentPlanning()` 追加＝採用商材を既存Instagram Output Draft の **`fields.affiliateContext` へ非破壊スナップショット** → `createInstagramContentPlanningDraft()` 再生成で topic導出へ反映 → 既存 `pushOutputDraftToServer()` で `fields`(JSONB) 永続化。`_icpDeriveTopic()` は **caseId一致時のみ** `affiliateContext` を最優先使用（不一致/未設定は既存導出へ安全フォールバック・非Affiliate Draft不変）。ランキングUIに「この商材で投稿企画を作る」ボタン（**保存済みActive評価のみ有効**・rank1「（推奨）」）。
- **安全設計（Manual Only・課金なし）**：採用元は `_affiliateCases` 実レコード／**保存済みActive評価のみ採用可**／案件判定は **`_aicCurrentCaseId()`**（Decision 072継承・現在案件取得＋評価所属＋Draft caseId一致の三条件）／**反映先は現在案件の既存 Instagram Draft（carousel/post）のみ再利用・新規Draft生成なし＝AI実行なし**／`affiliateContext` は非破壊付加（別商材は置換・同一は冪等・存在しない任意項目は生成しない）。
- **無変更（保護）**：`getCurrentApprovalCaseId()`／`createInstagramContentPlanningDraft()`／`pushOutputDraftToServer()`／`buildAffiliateIntelligenceRanking()` 本体・server.js・lib・DB・schema.sql・API shape。**新API・新DB列なし**（既存 `output_drafts.fields`(JSONB) を利用）。
- **Git・反映**：commit **745dd1e**（`index.html` のみ +89/-0）・**main push済み（HEAD=origin/main=745dd1e）**・**Render反映済み**・**iPhone実機確認完了**・docs commit（本更新）・Annotated Tag **v1.01-instagram-planning-wiring**・tag push。保護対象4件は未stage・未commitで保護。
- **テストデータ削除 完了**：専用テストcaseId **2件のみ**（`case-mrxmpfx78ua2`＝案件名 `WW_IPHONE_TEST_20260723`／`WW_TEST_20260723`）を Supabase SQL Editor の**限定DELETE**（`WHERE case_id IN ('case-mrxmpfx78ua2','WW_TEST_20260723')`）で削除し、**`affiliate_evaluations` / `output_drafts` とも `remaining = 0`** を確認済み。**条件なしDELETE不使用・既存無影響**。
- **次工程**：Instagramアカウント準備（ASP登録）→ 市場調査/競合分析/商品選定/投稿企画生成 → ユーザー確認 → Instagram手動投稿。**Manual Only維持**。**Phase55未着手のまま維持**（Decision 075）。

---

## Affiliate Evaluation 工程1 完了（クローズ）— 工程1-D 保留課題の正式決定（2026-07-23）

> 記録日: 2026-07-23。**Phase54 Complete維持・Phase55未着手**（工程1クローズはPhase進行ではない）。**実装なし・docs更新のみ**（index.html/server.js/lib/DB/schema.sql/API 無変更）。

- **Instagram自動運営 進捗**：工程1-A → 1-B（0a〜0d・本体・Hotfix）→ 1-C（schema記録）→ **1-D（保留課題の正式決定）＝Affiliate Evaluation 工程1 完了**。
- **工程1-D 結論**：P2〜P6 を個別評価し**現時点で実装不要・保留継続を正式決定**（Decision 074）。実運用特性（手動・小規模・低頻度・本番0件）から、いずれも実害なし/緩和済み・IG開始を妨げない・後回し可能。P3（RPC）は影響最大のため安易に採用しない。
- **工程1 完了内容**：永続化API／Active一意性の商材単位化／Workflow Wiring／Active Case Hotfix／schema.sql記録／保留の正式決定。**商材選定→投稿企画への接続基盤が完成**。
- **保留（工程1-E以降候補）**：P2 inactive化API／P3 RPCトランザクション化／P4 save_failed永続化／P5 channelScope拡張／P6 GET件数上限。実運用で必要性が生じた時に個別工程で再評価。
- **次工程**：**Instagram自動運営（Workflow Wiring）**（Affiliate評価ランキング→Instagram Content Planning接続・Version1最優先目的に直結・Manual Only維持）。
- **Phase55・工程1-E以降は未着手のまま維持**。

---

## Affiliate Evaluation 工程1-C（案A）— 実DB定義を schema.sql へ記録（2026-07-23・commit adf1c0a / cd81488）

> 記録日: 2026-07-23。**Phase54 Complete維持・Phase55未着手**（工程1-CはPhase55開始ではない）。**`supabase/schema.sql` の1ファイルのみ純追記（+76/-0）**。server.js／lib／index.html／API shape／**実DB** 無変更。

- **Instagram自動運営 進捗**：工程1-A → 1-B-0a〜0d → 工程1-B本体 → Active Case Hotfix → **工程1-C（案A）schema.sql記録 完了**。以降は未着手。
- **目的**：`affiliate_evaluations` は工程1-A時にDBへ直接作成され**schema.sql未記録**だった負債（P1）を解消。**新機能ではなく既存実DB定義の正式記録工程**（保守性・再構築性の改善）。
- **実施**：Supabase SQL Editorで**読み取り専用SELECT**により列定義・PK・UNIQUE・Index・CHECK・RLS・Policy・Trigger・FKを実測 → **正本として schema.sql へ純追記**（実測と全項目一致・drift なし）。**DDL実行なし・実DB無変更**。
- **確定実測**：30列／`id` bigint IDENTITY／NOT NULL・DEFAULT群／数値型（numeric(6,2)/(12,4)/(14,2)・integer）／detail JSONB／**Trigger なし・FK なし**／RLS enabled=true・forced=false／Policy `affiliate_evaluations_all`（FOR ALL TO anon）。
- **記録要素**：CREATE TABLE(30列)・pkey・fingerprint_key(UNIQUE)・reco_chk(CHECK)・idx_affiliate_eval_case・uq_affiliate_eval_active_product(partial unique)・RLS・Policy・冪等DO block・「Migrationではなく記録用」コメント。
- **完了条件（本工程は dev-check を必須としない）**：`node --check` 対象外／server.js・lib・index.html・API無変更のため **dev-check 必須外**。中核検証＝**schema.sql記録内容 ⇔ 実DB実測値の一致**（達成・drift なし）。
- **残課題（工程1-D以降候補・保留）**：P2 inactive化API未実装／P3 保存の非トランザクション（`activeMayBeZero` 通知あり・RPC未着手）／P4 `save_failed` のF5消失（Known Limitation）／P5 `channelScope='all'` 固定／P6 GET件数上限未設定。
- **次工程**：docs反映（本更新）→ commit（schema分・docs分を分離）→ tag → push（**ユーザー承認後**）。**Phase55・工程1-Dは未着手のまま維持**。

---

## 工程1-B本体 Active Case Hotfix — 案件未確定時の保存防止（2026-07-22・本番通常経路確認で検出・localhost検証完了）

> 記録日: 2026-07-22。**Phase54 Complete維持・Phase55未着手**（本Hotfixは工程1-B本体の一部。工程1-C・Phase55の開始ではない）。**`index.html` の1ファイルのみ（+17/-4）**。server.js／lib／DB／Migration／API shape 無変更。

- **本番通常経路の読み取り確認（先行実施・書込みなし）**：通常ログイン（ユーザー実施）→通常の案件タブ操作で、**案件選択1操作につきGET 1回**（`caseId`＋`channelScope=all`＋`activeOnly=true` → 200）・**最新一覧ではGET 0回**・**案件混入なし**・**console error 0**・**本番評価書込み 0件**を確認。本番実案件の評価は0件のため0件表示の正常完了まで。
- **検出した不具合**：案件を1件開いた後に最新一覧（`__caselist__`）へ戻ると**「案件を追加」ボタンが有効のまま**となり、**直前案件へ保存され得る**。表示クリア・GET/POST未発行は正常動作しており、データ破損や別案件評価の表示は発生しない。
- **原因**：`getCurrentApprovalCaseId()` は `_ncActiveCaseId()` が `undefined` のとき **`_lastOutputDraft.caseId` へフォールバック**する既存仕様。Affiliate側がこれを案件判定に使用していた。ローカルでは `_lastOutputDraft` が `null` のため未検出だった。
- **修正**：Affiliate専用 **`_aicCurrentCaseId()`** を追加（`currentMember` 未選択・`latest`・`__caselist__` はすべて **`null`**・**フォールバックしない**）。AIC内の**4箇所**（復元応答適用前の再照合／復元リトライ対象取得／`addAffiliateCase()` の保存前判定／「案件を追加」ボタンの有効判定）を統一。**明示的に caseId を受け取る関数の引数は変更しない**。**`getCurrentApprovalCaseId()` は無変更**（総使用箇所17件を維持・Approval/Output Draft/Leader dispatch/Agent consult 温存）。
- **localhost検証（Case 1〜4 全合格）**：①案件確定＝現在案件取得・ボタン有効・GET1回 ②最新一覧＝**`_lastOutputDraft.caseId` が残っていても `_aicCurrentCaseId()` は null**・ボタン`disabled`・表示0件・**GET0/POST0** ③未確定ビューで `addAffiliateCase()` 直接実行＝**即時中止・追加なし・POST0** ④別案件切替＝切替先取得・**前案件へ保存されず・混入なし**。補助：担当未選択／`latest` も `null`＝`disabled`、既存8関数の非回帰確認。
- **完了条件（実測）**：`node --check` OK・**dev-check 200/200/200**・**console error 0**・GET通算2／**POST・PATCH・DELETE 0回**・**実DB書込みなし**。
- **次工程**：docs反映（本更新）→ commit → tag → push → Render反映 → 本番読み取り再確認（**ユーザー承認後**）。**Phase55・工程1-Cは未着手のまま維持**。

---

## Instagram自動運営 工程1-B本体（Workflow Wiring）**Complete**（2026-07-22・localhost実DB検証完了・commit 69465f3 / d871f95）

> 記録日: 2026-07-22。**Phase54 Complete維持・Phase55未着手**（本工程でPhase55を開始しない）。**`index.html` の1ファイルのみ（+390/-4）**。server.js／lib／DB／Migration／**API shape** 無変更。

- **Instagram自動運営 進捗**：工程1-A → 工程1-B-0a〜0d → **工程1-B本体 Complete**。以降の工程は未着手。
- **実装**：案件境界 **D-1**（`_affiliateCases` は現在案件のみ）／未保存・失敗行の **caseId付き退避バッファ**／保存は **`addAffiliateCase()` の明示追加時のみ**（Leader Final・Workflow完了・Export時はPOSTしない）／復元は**案件確定4経路**へ個別配線（相互呼出なし＝**1操作1GET**）／GETは **`caseId`＋`channelScope=all`＋`activeOnly=true` を明示**／**`sourceFingerprint` はclient生成**（`affiliate-evaluation-v1:`＋固定順配列・`caseId`と実効scopeを必ず含む・timestamp/random非混入・fingerprint内のみ小数2桁正規化）／POSTでは **`productIdentifier`・`channelScope`・`recommendation`・`source` を送らない**／`detail`(JSONB) に**評価補足7項目＋`origin`＋メタ2項目**／保存状態 `unsaved|saving|saved|save_failed`／**保存済み行は除外不可（A案）**／失敗行は**無言消失させず再送ボタン**を提供。
- **重複表示修正**：Case 4で検出（DBは正常・UIのみ2行）。**`_aicDedupeSavedRow()`** を追加し、同一caseId内で ①同一`serverId` ②同一`sourceFingerprint` ③同一`channelScope`かつ同一`productIdentifier` の重複行を除去。**別caseIdは決して除去しない**。
- **channelScope安全補強**：条件③に scope 一致を追加（未設定は `'all'` 正規化）。サーバーのActive一意性単位（`case_id + channel_scope + COALESCE(product_identifier,'')`）と整合させ、**将来の別scope追加時に誤除去しない**。
- **完了条件（実測）**：`node --check` OK（インラインJS2ブロック）・**dev-check 200/200/200**・**純関数テスト 46/46 PASS**・**第2段階 Case 1〜9 全合格**・PATCH/DELETE **0件**・**console error 0**・**テストデータ限定DELETE済み `remaining = 0`**（localhost GETでも A=0件/B=0件）。
- **未確認事項**：①**通常ログイン／通常案件選択経路の実操作は未実施**（テストcaseIdが実案件として存在しないため。検証はランタイムstub＋実装関数の直接実行で実施・4経路の配線は実行時ソースで確認済み） ②**F5後の `save_failed` 保持は保証対象外**（Known Limitation） ③**Render本番POST未実施** ④別scopeの実運用検証は未実施。
- **次工程**：docs反映（本更新）→ commit → tag → push → Render反映（いずれも**ユーザー承認後**）。**Phase55は未着手のまま維持**。

---

## Instagram自動運営 工程1-B-0a〜0d — Affiliate評価 Active一意性の商材単位化 **完了**（2026-07-22・Code commit 2ef2ad3・Migration完了・実DB検証完了）

> 記録日: 2026-07-22。**Phase54 Complete維持・Phase55未着手**（本工程でPhase55を開始しない）。**`lib/affiliateEvalDb.js` の1ファイルのみ**変更（`server.js`／`index.html`／`schema.sql` 無変更・**API shape維持**）。

- **Instagram自動運営 進捗**：工程1-A 完了 → **工程1-B-0a（本番DB実測）／1-B-0b（最終設計確認）／1-B-0c（Migration）／1-B-0d（実装＋実DB検証）すべて完了** ／ **工程1-B本体（Workflow Wiring）は未着手**。
- **Migration**：`DROP INDEX uq_affiliate_eval_active_case` → `CREATE UNIQUE INDEX uq_affiliate_eval_active_product ON affiliate_evaluations (case_id, channel_scope, (COALESCE(product_identifier,''))) WHERE is_active`。**Supabase SQL Editorで実行**（Claude Code環境にDDL経路なし＝service_roleキー／`DATABASE_URL`／`pg`／`psql`／Supabase CLI いずれも未存在）。再実行時の **42P07 は `BEGIN〜COMMIT` 内でロールバックされDB不変**、実測により目的状態を確認して**追加DDL・Rollback不要**と判定。
- **設計要点**：`productIdentifier` は **`JSON.stringify([normalizedProductName, normalizedAspName || null])`**／正規化＝全角空白→半角・trim・連続空白統一・小文字化（**NFKC不採用**）／**案A厳格**＝`productName` があればサーバー側で必ず再生成し**client値は不使用**／`productName` なしは **null**／旧active無効化は**同一subject限定**（値あり `.eq()`・null `.is()`）／**`_str()` 無変更**／処理順（冪等判定→旧active false化→insert）維持。
- **完了条件（実測）**：`node --check` OK・**dev-check 200/200/200**・GET非回帰OK・**純関数テスト 15/15 PASS**（実ファイル本文から関数を抽出して実行・**export追加なし**）・**実DB POST検証 全8ケース成功**（Active **5件共存**／Inactive 2件／履歴 7件／**23505なし**／**500なし**）・**`.eq()`／`.is()` を実DBで実証**（他商材・別ASP・null↔非null を巻き込まない）・**専用テストデータ限定DELETE済み `remaining = 0`**（GET履歴込み0件で独立確認）・Code commit **2ef2ad3**・保護対象4件は未stage。
- **既知事項**：①**`schema.sql` へ未記録**（`affiliate_evaluations` は定義自体が未記録・別工程） ②**`index.html` 配線は未着手**（`_affiliateCases` はメモリ保持のみ・当該APIへの `fetch` ゼロ） ③RPC/transaction化は未実施 ④**inactive化／PATCH／DELETE APIは未実装**（後始末はSupabase SQL Editorが正式経路） ⑤`product_identifier=''` 行が将来混入した場合の非対称性（現行実装では構造的に発生しない） ⑥**1 case に active 複数件**があり得る（「active＝1件」前提の利用側を作らない） ⑦**Phase55未着手を維持**。
- **次工程**：**Instagram自動運営 工程1-B本体（Workflow Wiring）**（未着手・ユーザー承認後に決定）。

---

## Instagram自動運営 工程1-A — Affiliate Evaluation Persistence API **完了**（2026-07-21・Code commit 047f4d3・localhost検証完了）

> 記録日: 2026-07-21。**Phase54 Complete維持・Phase55未着手**（本工程でPhase55を開始しない）。社員向上B完了後の最優先である **Instagram自動運営機能** の第一工程。**`server.js` ＋ `lib/affiliateEvalDb.js` の2ファイルのみ**変更。

- **Instagram自動運営 進捗**：**工程1-A（Affiliate評価の永続化API）完了** ／ 以降の工程は未着手。
- **実装**：`affiliate_evaluations` テーブル／`lib/affiliateEvalDb.js`（新規110行・2関数export）／`GET /api/affiliate-evaluations`（caseId必須・channelScope任意・activeOnly既定true／0で履歴込み・created_at降順）／`POST /api/affiliate-evaluations`（caseId・sourceFingerprint必須）。
- **設計要点**：`source_fingerprint` UNIQUE による**冪等性**（再送は既存を返す）／同一 `case_id`＋`channel_scope` の**旧activeをfalse化**して新active1件をinsert＝**履歴保持**／Supabase未設定・障害時の **fallback**（`source:'db'|'fallback'|'error'`）／**JSONB `detail`** 対応／数値の不正値はnull化／`recommendation` は `adopt`/`watch`/`reject` のみ。
- **完了条件（実測）**：`node --check` 2ファイル成功・**dev-check 200/200/200**・localhost GET成功（`source:"db"`）・localhost POST成功・同一POST再送で **`idempotent:true`**・**履歴込み1件**確認・テストデータ削除後 **履歴込み0件**確認・**実案件／他テーブル影響なし**・Code commit **047f4d3**・保護対象4件は未stage。
- **既知事項**：①旧active無効化→insert は**非トランザクション** ②insert失敗時 active 0件の可能性を **`activeMayBeZero:true`** で通知 ③RPC/transaction化は別工程 ④日本語文字化けは**API不具合ではなくWindowsシェル→curlの文字コード問題** ⑤日本語POST再確認は **UTF-8 JSONファイル＋`curl --data-binary @file.json`** ⑥**inactive化／PATCH／DELETE APIは未実装** ⑦**Phase55未着手を維持**。
- **次工程**：Instagram自動運営 工程1-B以降（未着手・ユーザー承認後に決定）。

---

## 社員向上B 正式完了 — 定義駆動基盤完成／セクション移行（2026-07-21・localhost検証完了・push前・Render未反映）

> 記録日: 2026-07-21。**Phase54 Complete維持・Phase55未着手**（本更新でPhase55を開始しない）。改善案件「社員向上B」を**正式完了**として記録。**index.htmlのみ**・未push 7コミット・server.js／lib／DB／API／schema.sql 無変更。

### 社員向上B 工程進捗（すべて完了）
- **B-1（outputType正本化）完了** — commit 066241f・tag v1.01-phase54-output-type-normalization（origin反映済み）
- **B-2-1（Section定義）完了** — `OUTPUT_SECTION_DEFINITIONS` Section定義層追加（commit **c38df55**・index.html +191）
- **B-2-2a（Section抽出）完了** — 定義からdraft fieldを構築する抽出エンジン＋wrapper安全適用（commit **6fc3616**・+222/-4）
- **B-2-2b（document/pdf）完了** — draft field を定義駆動へ移行（commit **a48380c**・+33/-9）
- **B-2-2c（image_prompt/video_prompt）完了** — 同上（commit **43598a6**・+48/-20）
- **B-2-2d（powerpoint/excel）完了** — 同上（commit **83fbad3**・+37/-3）
- **B-2-2e（調査）完了** — instagram/video系型の移行方式を調査（コミット無し・実装は f/g で反映）
- **B-2-2f（instagram_post/instagram_carousel）完了** — 同上（commit **51caede**・+40/-12）
- **B-2-2g（tiktok_video/youtube_shorts/html）完了** — 同上（commit **61dde05**・+45/-18）
- **→ 社員向上B 正式完了**（Phase54 Complete維持・Phase55未着手）

### 目的・完了条件（13型完全統一ではない）
社員向上Bの目的は13型完全統一ではなく、**定義分散の解消／定義駆動基盤の完成／既存出力互換維持／Instagram自動運営・収益化へ安全かつ最短で移行できる状態を作ること**。正式完了条件（①定義駆動基盤が実用上十分完成 ②Instagram収益化に必要な出力型が安全に運用可能 ③既存出力互換維持）を充足したため正式完了とする。13型完全統一は必須条件ではない。

### 最終移行状況（13型中11型）
- **完全定義駆動（6）**：document ／ pdf ／ powerpoint ／ excel ／ instagram_post ／ html
- **ハイブリッド（5）**：image_prompt ／ video_prompt ／ instagram_carousel ／ tiktok_video ／ youtube_shorts
- **正式保留（2）**：flyer ／ lp（**失敗・未完成ではない**。Instagram収益化を遅らせないための優先順位判断。別工程で再評価）

### 品質確認（ローカル）
旧新等価・mismatch 0・updatedFields一致・wrapper非回帰・二重生成なし・二重代入なし・JS構文OK・dev-check 200/200/200・console error 0・**AI API実行なし**・POST/PATCH/DELETEなし。**ローカル実装・ローカル検証完了、push前・Render未反映**（本番実機確認は未実施）。

### Git
HEAD **61dde05**／origin/main **ac2f5da**／**local ahead 7**（未push）／最新Tag **v1.01-phase54-video-html-section-migration**。**push・Render反映は未実施**（ユーザー承認後）。保護対象4件は未commitで保護。

---

## 改善案件 工程B-1 — outputType正本化 **完了**（2026-07-20・localhost確認済み・commit 066241f・tag v1.01-phase54-output-type-normalization）

> 記録日: 2026-07-20。**Phase54 Complete維持・Phase55未着手**。改善案件の工程B-1。**index.htmlのみ（+40/-7）**。

- **改善案件 進捗**：工程A（設定保持）完了 ／ **工程B-1（outputType正本化）完了** ／ 工程B-2 未着手 ／ 工程B-3 未着手。
- **完了条件**：index.htmlのみ・+40/-7・正規化関門（`normalizeOutputType()`）追加・OUTPUT_TYPES 13種維持・正規化テスト **24/24 PASS**・dev-check 200/200/200・console 0・**AI API実行なし**・Code commit 066241f／tag 作成済み・Phase54 Complete維持・Phase55未着手。
- **正本**：定義=`OUTPUT_TYPES`／ランタイム=`_lastOutputDraft.type`／永続化=`output_drafts.type`／表示定義=`OUTPUT_TYPE_DEFINITIONS`／`outputType`=派生値。
- **正規化**：legacy alias 9件／空・null・undefined・unknown・未知値→`document`／曖昧語は非alias（`detectOutputType()` 責務）／境界（生成起点・createOutputDraft入口・DB復元・normalizeOutputDraft・保存Payload・Output Engine表示）で正規化／server.js・DB・API・schema.sql 無変更。
- **次工程**：本番反映・確認後に **工程B-2「セクション動的化＋内部指示分離」の調査**。

### Cost DB 後続完了（最新状態）
- Cost DB は **main push完了・tag push完了・Render反映確認済み・本番API確認済み**（`/api/cost`・`?provider=claude`・`?provider=all` 全HTTP200）。docs内の「push未実施」は過去履歴。

---

## Cost DB（A-2系）完了 — Supabase料金基盤／Opening Balance／一意性／23505／schema記録（2026-07-19・commit 81a5288・tag v1.01-phase54-cost-db-complete）

> 記録日: 2026-07-19。**Phase54 Complete維持・Phase55未着手**（Phase55開始・再開ではない。Cost DB層の正式記録）。

- **① Supabase Cost DB Layer**（`lib/costDb.js`）：DBアクセス層＋標準集計。JST日付キー。
- **② Cost Event 永続化**：`api_cost_events` へ OpenAI／Claude の利用イベントを保存（`usage_event_id` UNIQUE 冪等）。
- **③ Legacy互換層**：`getLegacyCostSummaryForApi`（provider別 last-good・DB障害安全）。`/api/cost` をSupabase表示へ切替（Opening Balance は非参照）。
- **④ Opening Balance**：`api_cost_opening_balance` へ移行前累積を冪等登録。OpenAI 54.05円／Claude 319.57円。
- **⑤ provider別 active 一意性**：index を `(balance_type)` → `(provider, balance_type) WHERE is_active` へ差替（旧 `uq_api_cost_ob_active_legacy` 廃止）。Claude を別 provider 行として共存。
- **⑥ 23505 二段階判定**：fingerprint／業務キーを区別（`OPENING_BALANCE_ACTIVE_CONFLICT`）。stub全PASS・dev-check 200/200/200・実DB非接触。
- **⑦ schema.sql 正式記録**：Cost DB 全定義を +181 純追記（定義記録用・migrationではない）。

---

## 改善案件 工程A — 設定保持 **完了**（2026-07-17・localhost確認済み）

> 記録日: 2026-07-17。**Version1 Final Complete ／ Version1.1 開発中**。Phase54 Complete後に確認された「運用品質・表示・設定保持の改善案件」の**工程A**（全11改善のうち、独立性が高く低リスクな設定保持のみ）。**Phase54 正式Complete維持・Phase55未着手・工程B以降は未着手**。**index.htmlのみ（+45/-7）**／server.js・lib・DB・API・SQL は**無変更**。commit **8c9ed58**・tag **v1.01-phase54-agent-settings-persistence**。

### 現象
ページ更新後に **Auto Task「自動→手動」**・**自律相談「ON→OFF」** へ戻る。

### 原因
`toggleAutoStart()` / `toggleAutonomousConsult()` に永続化処理がなく、起動毎に初期値 `let autoStart = false` / `let autonomousConsult = false` へ戻っていた（両変数のlocalStorage参照は全文検索で**0件**）。

**重要**：これは実装漏れではなく、**「課金防止システム」節の意図的な設計**だった（旧コメント：`初期値は必ず OFF（false）。localStorageには保存しない（起動毎にリセット）。`）。第1工程の調査レポートはこの意図を見落としていたため、実装着手時に発見・報告し、**方針変更としてユーザー承認のうえ実施**した。

### 実装（index.htmlのみ）
- **追加キー**：`enbisou_auto_start_v1` / `enbisou_autonomous_consult_v1`（値 `'1'`/`'0'`）。既存の設定系規則（`AUTH_KEY = 'enbisou_auth_v1'` / `BILLING_LOCK_KEY = 'enbisou_billing_lock_v1'`）に準拠。
- **保存**：`_saveAgentSetting()` を新規追加し、`toggleAutoStart()` / `toggleAutonomousConsult()` の**トグル直後**に呼ぶ。
- **復元**：`restoreAgentSettings()` を新規追加し、**`showApp()` 冒頭**から呼ぶ。`showApp()` は初回ロード（自動ログイン／認証済みロード）と**再ログイン**の両方を通る唯一の入口のため、1箇所で全条件を満たす。
- **フォールバック**：`_loadAgentSetting()` は保存値なし・不正値なら**既存初期値 `false`** を返す。localStorage不可でも `try/catch` で**起動を止めない**。
- **UI同期**：復元時に `updateAutoStartBtn()` / `updateAutonomousConsultBtn()` を必ず呼ぶ。自律相談の表示更新は従来トグル内にインライン実装されていたため、**`updateAutoStartBtn()` と同形の関数へ切り出し**（復元処理との重複実装を回避。表示内容・挙動は従来と同一）。

### 課金防止の維持（最重要・ユーザー指示）
**復元するのは設定値と表示のみで、起動時に Workflow / AI / API を自動実行しない。**
- `autoStart` を参照して実行するのは **`atAutoStartWorkflow()` のみ**。その呼び出し元は `handleLeaderDispatch` 内の3箇所（8238/8246/8256＝**ユーザーがLeaderへ依頼した後**）のみで、**起動経路からの呼び出しは存在しない**。
- `atAutoStartWorkflow()` 内の `if (!autoStart) return;` および `autoStart && !billingLock` ガードは**従来どおり有効**（実測確認）。
- `restoreAgentSettings()` が呼ぶのは表示更新2関数のみ（実測確認）。

### 確認（localhost）
- **Auto Task**：自動→F5→「自動」維持／手動→F5→「手動」維持
- **自律相談**：ON→F5→「ON」維持／OFF→F5→「OFF」維持
- **複合**：自動＋ON → 案件切替 → ホーム移動 → ログアウト → 再ログイン で**維持**。**再ログイン前に内部値を意図的に `false` へ落として**から検証し、復元処理が実際に効くことを実証。ログアウトでは認証キーのみクリアされ設定は残存。
- **フォールバック実測**：未保存→`false`／不正値「ゴミ」→`false`／`'1'`→`true`
- **内部値と表示の一致**を全ケースで確認（テキスト・`on` クラスとも）
- **起動時のAI実行なしを通信レベルで実証**：`autoStart=自動` 復元状態での起動時リクエストは**すべてGET**、AI実行系POSTは**0件**（`chat|dispatch|auto-task|workflow|consult|openai|claude` 一致**0件**）、`_atCurrentWorkflowId` は `null`
- **console 0**／**dev-check 200/200/200**／インラインJS **2ブロックとも構文OK**
- **既存機能の健在を実測**：一括操作Hotfix（`_taskBulkRunPooled`・`_TASK_BULK_CONCURRENCY = 5`）／Decision 064（`_taskIsHomeView`）／Task作成dbId Hotfix（`_persistNewTask`）／billingLockガード

### 非対象・非接触
- **非対象**：**端末間同期**（保存先のDB列がなくSQL変更が必要なため**別途判断**）／Auto Task・自律相談の**処理内容**／Workflow成果物改善／Leader要約／テンプレート混入修正／Publishing／並列化／Learning・Compare／**工程B以降**
- **非接触（diffに非該当を実測確認）**：`LEADER_FINAL_PROMPT` / `extractSlides` / `imagePrompts` / `_taskBulkRunPooled` / `_persistNewTask` / `syncTasksFromServer` / server.js / lib / supabase / openaiClient.js

### 状態
- **Phase54 Complete維持**／**Phase55未着手**／**工程B以降は未着手**
- **残**：本番確認（**設定保持のみ**。Leader依頼・AI生成・Task生成は行わない＝**課金APIテスト禁止**）
- **保留**：**前工程（Task作成dbId Hotfix）の本番実機確認は未実施のまま**

---

## Task新規作成 二重化 Hotfix **完了**（2026-07-17・本番反映済み・localhost確認済み）

> 記録日: 2026-07-17。**Phase54 Complete後に発見された Known Issue の Hotfix**（A案採用）。**Phase54 正式Complete維持・Phase55未着手**。**index.htmlのみ（+15/-9）**／server.js・lib・DB・API・SQL・`syncTasksFromServer()` の merge は**無変更**。commit **39b44d0**・tag **v1.01-phase54-task-create-dbid**。

### 現象
Task作成後、Server保存は成功しているのに local側Taskは `dbId` 未設定のまま残る。リロードすると Server側Taskが同期され、**local-only Task と Server Task が同時表示＝二重化**する。

### 原因（調査で確定・クライアント単独）
- **サーバー・API・DBは正常**：`POST /api/tasks` は `{ ok:true, task:{ id } }` を返却（`createTask` は `.select().single()` で行を返す）。`syncTaskToServer()` も `data.ok && data.task?.id` を検証して正しく id を返す。
- **① `submitTask()` の dbId 誤代入（条件付き）**：非同期コールバック内で**配列先頭を再評価**していた。POST往復（本番RTT実測 約0.9秒）の間に他経路の**先頭挿入（7か所）**が割り込むと先頭が入れ替わり、**dbId が別Taskへ代入**され、本来のTaskは永久に `dbId` なし＝local-only 化。
- **② `atCreateNextTasksFromItems()` の握り潰し（常時）**：POST を投げっぱなしにして**返却された dbId を常に破棄**。この経路のTaskは**必ず** local-only 化。**Decision 063（Case成功確認契約）と同型**。
- **二重化までの経路**：local-only Task（DBには行が存在）→ リロード → merge の照合は **`dbId` のみ**（`tasks.find(t => t.dbId && t.dbId === mapped.dbId)`）→ dbIdなしは構造的に一致し得ず `tasks.push(mapped)` → **二重表示**。
- **自動解消しない理由**：backfill の署名照合（Pass A）は起動順が **`sync` → `backfill`** のため、到達時には**同期済みコピーが既にその dbId を確保済み**（`claimedDbIds`）→ 採用条件 `!claimedDbIds[...]` が偽 → **採用できず二重化が永続化**。
- **全7作成経路の調査結果**：安全5経路（`_persistNewTask` ×4／`.then` 捕捉変数 ×2 のうち既存分）と**欠陥2経路**（①②）。安全経路は**捕捉した変数**へ代入していた。`_persistNewTask(tasks[0])` は**引数が同期評価**されるため安全（問題は `.then` 内部での再評価）。

### 実装（A案・index.htmlのみ・2箇所）
- **`submitTask()`**：Taskを `const newTask` で**捕捉変数**として保持 → `tasks.unshift(newTask)` → **`_persistNewTask(newTask)`** へ統一。
- **`atCreateNextTasksFromItems()`**：投げっぱなしPOSTを廃止し **`_persistNewTask(task)`** へ統一（返却 dbId を必ず対象Taskへ反映）。
- **結果**：**全7作成経路が安全な方式に統一**（`_persistNewTask` ×5／`.then` 捕捉変数 ×2）。
- **補足**：コメントに旧コードを literal 引用すると、本プロジェクトの**grepマーカー検証**で誤検知するため、説明文へ書き換えた。

### 確認
- **fetchスタブ（実DB非接触・テストデータ作成なし）**：連続作成の全Taskが**自分自身の dbId** を取得・local-only残存**0**／**解決順を逆転させた条件**（1件目500ms・2件目100ms）でも**誤代入0**＝調査で指摘した「別TaskのdbIdでDB行を誤更新する潜在リスク」も解消／自動次Task **3件作成・3件POST・全件dbId・重複0**／**同期後も local 3件 = server 3行・重複0＝二重表示なし**。
- **対照実験**：同一ハーネスで旧実装（先頭再評価）を局所再現 → **dbId未取得1件・同期後 local 4件（server 3行）・重複1件**を再現。**修正が原因に効くことの直接証拠**。
- **本番**：トップ**200**・**配信コードがローカルと完全一致**・`tasks[0].dbId` / `syncTaskToServer(task).catch` / `syncTaskToServer(tasks[0])` の残存**0件**・`submitTask` の捕捉変数＋`_persistNewTask` 反映確認・`atCreateNextTasksFromItems` の `_persistNewTask` 反映確認。
- **非回帰**：一括操作Hotfix（`_taskBulkRunPooled` / `_TASK_BULK_CONCURRENCY = 5`）・Decision 065（`filtered.sort`）・Decision 064（`_taskIsHomeView`）・`tasks.sort(` 0件。
- **console 0**／**dev-check 200/200/200**／インラインJS **2ブロックとも構文OK**。
- **DB無変更**：生存tasks **253**／archived **167**／deletedIds **127**／cases 生存**2**・削除済**2**。**検証用Taskの混入0件**。

### 状態
- **Phase54 Complete維持**／**Phase55未着手**
- **残**：**本番実機確認（PC）**
- **未整理（別途判断）**：本番DBの**重複署名16グループ・余剰16行**（すべて2行重複・Leader依頼系が中心）。本Hotfixは**新規発生の停止のみ**で、**既存の二重化データは自動解消されない**。整理には対象特定・削除方針・Server正本契約（`deletedIds`）への影響検討が必要。

---

## Task一括操作 Hotfix **完了**（2026-07-17・本番反映済み・localhost実機確認済み）

> 記録日: 2026-07-17。**Phase54 Complete後に発見された Known Issue の Hotfix**。**Phase54 正式Complete維持・Phase55未着手**。**index.htmlのみ（+200/-65）**／server.js・lib・DB・API・SQL・Timeline・Notification・Task History は**無変更**。commit **deba2ed**・tag **v1.01-phase54-task-bulk-parallel**。

### 現象
ホームで全選択（133件）→アーカイブ→更新すると **109件**（＝24件しか減らない）。繰り返すと 109→94→86 と**徐々にしか減らない**。選択件数・確認ダイアログの件数は正しい。

### 原因（調査で確定・クライアント単独）
- `taskArchiveSelected()` は**1件ずつ直列 `await`**（`PATCH /api/tasks/:id` を133回）。**本番RTT実測 約0.9秒**（ウォーム）× 133件 ≒ **約120秒**。コールドスタート時は13.3秒実測。
- その間 **UI更新は皆無**（`renderTaskList` / `updateTaskBadge` / `saveTasks` はすべてループ完了後に1回だけ）。
- サーバーは PATCH 成功のたび `archived_at` を**1件ずつ確定**する一方、クライアントは**最後にまとめて保存**する非対称があった。
- ユーザーが待ちきれず**更新するとループが中断** → `saveTasks()` に到達せず local変更は全損 → リロード後に **`syncTasksFromServer` が Server正本の `archivedAt` を適用**し、**PATCH完了分だけがアーカイブ済みとして復元**される。
- **減少幅の逆算が症状と一致**：24件≒22秒・15件≒14秒・8件≒7秒（＝待ち時間が回ごとに短くなったことと整合）。
- **サーバー・DBは無罪**：`server.js` / `lib/tasksDb.js` に `.limit()` / `.range()` は**0件**（ページング・件数制限なし）。PATCH は冪等で 404/5xx も適切。例外による中断もなし（失敗時は `continue`）。

### 実装（A案採用・index.htmlのみ）
- **`_taskBulkRunPooled(ids, worker, onProgress)` 新規**：**共有カーソル方式**で同時実行数を **5** に固定。カーソルは取り出し時に即進めるため**同一IDの二重処理なし**。worker内の**予期しない例外も失敗扱い**で全体を停止しない。全対象の完了を待って `{ ok, ng, done }` を返す。**無制限 `Promise.all` は不使用**（`Promise.all` はワーカー5本の待機にのみ使用）。
- **`_taskBulkSetBusy(on)` 新規**：`_taskBulkBusy` フラグ・一括ボタン5種の `disabled`・`beforeunload` の登録/解除を一元管理。**`finally` から必ず解除**（成功・一部失敗・例外いずれも）。
- **`_taskBulkProgress()` 新規**＋**`#task-bulk-progress`**：`textContent` のみ（HTML挿入なし・`white-space: pre-line`）。**`renderTaskList` / `updateTaskBadge` は呼ばない**。
- **対象3関数**（`taskArchiveSelected` / `taskRestoreSelected` / `taskPermanentDeleteSelected`）を同一設計へ統一：**Server成功後のみlocal反映**／**成功確定ごとに `saveTasks()`**／**成功Taskのみ選択解除・失敗は選択維持**／**本描画は完了後1回**。
- **ガード追加**（各1行）：`taskSelectAll` / `taskDeselectAll` / `toggleTaskSelection` / `changeTaskStatus` / `deleteTask`。`updateTaskBulkToolbar()` に処理中分岐（選択0でもツールバー＝進捗の親を隠さない）。
- **保護（不変）**：**`setTaskArchivedOnServer` / `softDeleteTaskOnServer` は無変更**／Server正本契約（`archivedAt` の Server正本化・`deletedIds` による削除伝播。**local側で `deletedIds` を生成・改変しない**）／Task同期・backfill／`_taskInCurrentView()`・`_taskIsHomeView()`・`_taskViewCaseId()`／Decision 064・065／**Case系一括削除（`_clBulkDelete` / `_homeBulkDelete`）は対象外・未変更**。

### 確認
- **スタブ検証**（fetchスタブ・実DB非接触）：133件で**最大同時実行数5・重複0・ユニーク133**／成功119・失敗14で**選択残14**／`saveTasks` **119回＝成功数**／**ループ中の `renderTaskList` 0回・完了後1回**／復元60件・完全削除40件も同結果／**処理途中で既に31件がlocalStorageへ永続化済み**（＝**中断耐性を実証**。旧構造では0件）／二重起動しても**同時実行5のまま・fetch 30回のまま**。
- **localhost実機**：アーカイブ**3件**（86→83・バッジ83）→ 復元**3件**（83→86・**原状回復**）／完全削除**3件**（**サーバー経路2＋local-only経路1**）／進捗表示「アーカイブ処理中 0 / 3件／成功0件・失敗0件／画面を閉じずにお待ちください」・操作名は復元・完全削除でも正しく切替／処理中は全ボタンdisable・`beforeunload` 登録／完了後は進捗非表示・ボタン再有効化・`beforeunload` 解除／**失敗0のため選択全解除・alertなし**／**console 0**／**dev-check 200/200/200**／インラインJS **2ブロックとも構文OK**。
- **本番**：Render自動デプロイ反映・トップ**200**・**配信コードがローカル `index.html` と完全一致**・`_taskBulkRunPooled` / `_TASK_BULK_CONCURRENCY = 5` / `#task-bulk-progress` / `beforeunload` を配信コードで確認・Task3関数に**旧直列ループ0件**・`filtered.sort`（Decision 065）維持・`_taskIsHomeView`（Decision 064）維持・`tasks.sort(` **0件**。
- **DB実測（確認時点）**：生存tasks **253**／archived **167**／**deletedIds 127**／cases 生存**2**・削除済**2**。※`deletedIds` は 125→**127**（確認用テストTask 2件を作成し完全削除したため。ユーザー承認済み）。**既存Taskの喪失なし**。

### 状態
- **Phase54 Complete維持**／**Phase55未着手**
- **残**：**本番でのPC実機確認**（一括アーカイブ・復元・進捗表示・件数/バッジ一致・console 0）
- **別Known Issue（次工程で原因調査のみ・実装禁止）**：**Task新規作成時の2重化**。POST は成功しているのにクライアントが `dbId` を取り込めず local-only のまま残り、リロード後にサーバーコピーと**同一Taskが2件表示**される。**本Hotfixとは無関係の既存問題**（`submitTask()` / `createTask()` は本Hotfixのdiffに非該当）。調査対象＝`submitTask()` / `createTask()` / `POST /api/tasks` の返却値 / `dbId` 取り込み / local-only TaskとServer Taskのmerge / **Decision 063（Case成功確認契約）と同型か**。

---

## Task表示仕様変更 **完了**（2026-07-17・本番反映済み・PC/iPhone実機確認完了）

> 記録日: 2026-07-17。**Phase54 正式Complete維持・Phase55未着手**。Phase54 Hotfix の **Task側 PC⇔iPhone 実機確認**で判明した表示上の2件への対応。**index.htmlのみ**／server.js・lib・DB・API・SQL・Timeline・Notification・Task History は**無変更**。Decision 064・065。

### 時系列
- **5fe2b64 — Task Home Overview**（tag **v1.01-phase54-task-home-overview**・index.html **+15/-5**）
- **bbfbc73 — Task Sort Order**（tag **v1.01-phase54-task-sort-newest**・index.html **+10**）

### ① Task Home Overview（Decision 064）
- **背景**：PCで作成したTaskはiPhoneへ同期され案件画面では表示されるが、**ホームでは「タスクはありません」・バッジも0**だった。調査の結果、**同期・DB保存は正常**で、Decision 054 の表示仕様（ホーム＝`case_id=NULL` 横断Taskのみ）どおりの動作であり**不具合ではない**と確定。ユーザー要望により**仕様変更**として実施。
- **仕様**：**ホーム＝全案件Task＋横断Task（俯瞰）** ／ **案件画面＝選択案件Task＋横断Task（他案件は非表示）** ／ **最新一覧・案件一覧＝横断Taskのみ（現状維持）**。
- **実装**：
  - **`_taskIsHomeView()` 新規**：`currentMember === null` のときだけホームと判定。※`_taskViewCaseId()===null` は「ホーム」と「担当選択中＋案件未選択」の**両方で真**になるため、それだけでは判定しない（最新一覧で他案件Taskを出さない＝案件別分離を壊さないため）。
  - **`_taskInCurrentView()` にホーム分岐**（`if (_taskIsHomeView()) return true;`）。ホーム以外は既存の案件一致／横断判定を維持。
  - **`renderTaskList()` のインライン重複判定を廃止し `_taskInCurrentView(t)` へ統一**。これにより**一覧・Progress・バッジ・診断が同一の可視集合**となり、**「バッジだけ全件」＝件数不一致を構造的に防止**（Phase54 Hotfix の件数統一方針を継承）。
  - ⚠️ 重要な発見：`renderTaskList()` は `_taskInCurrentView()` を**呼ばずに同じ判定を複製**していたため、`_taskInCurrentView()` だけの変更では**一覧だけ0件のまま＝件数不一致**になるところだった。
- **保護（不変）**：**`_taskViewCaseId()`**（Timeline／Task History／Notification が共有）／**`_historyVisibleInView()`**／**`_timelineEventVisibleInView()`**／`updateTaskBadge()` 本体／Task同期・backfill・削除/アーカイブ同期。
- **副作用（仕様として許容）**：ホームでは **Taskは全件／Timeline・Notification・Task History は横断のみ**という粒度差が生じる（Timeline等の仕様変更は対象外のため）。

### ② Task Sort Order（Decision 065）
- **背景**：PCは「上が最新→下が過去」、**iPhoneは「上が過去→下が最新」**と並び順が逆転していた。
- **原因**：**`renderTaskList()` にソートが存在せず**、`tasks` 配列の順序をそのまま描画していた。配列への追加が2系統に分かれており、**自端末作成Task＝`tasks.unshift()`（先頭・7か所）／他端末作成Taskの同期受信＝`syncTasksFromServer` の `tasks.push(mapped)`（末尾）**。そのため PC（unshift主体）は上が最新、iPhone（push主体＝受信のたび末尾へ積む）は下が最新となり、**表示順が端末の操作履歴に依存**していた。
- **仕様**：**`createdAt` 降順（上が最新・下が過去）** ／ **同一 `createdAt` は `id` を第2キーで固定** ／ **archived一覧も同一ソート** ／ `updatedAt` は使用しない（状態変更で順序が動かないため）。
- **実装**：`renderTaskList()` の**表示用 `filtered` のみ**を `.sort()`。**`tasks` 配列本体・`unshift`/`push`・同期・backfill・localStorage・DB は一切変更しない**（`tasks.sort(` の出現0件を本番配信コードで確認）。

### 確認
- **localhost**：症状を再現した配列（PC想定＝新→古／iPhone想定＝古→新）から**同一の描画順（新→古）へ統一**されることを実証／実データ253件でも降順・先頭2026-07-16T22:57・末尾2026-07-13T12:36／同着はid固定（配列を逆順にしても同結果）／ホーム183件＝Progress 0/183＝バッジ183で**件数一致**／案件A・案件B分離維持／最新一覧は横断のみ／archived 70件も降順／**`tasks` 配列本体が不変**であることを実証／Timeline・Notification・History 非回帰／`node --check` 0エラー／**dev-check 200/200/200**／console 0。
- **本番**：Render自動デプロイ反映・トップ200・インラインJS 2ブロックとも parse成功・配信コードが実装と一致（`filtered.sort`／`_taskIsHomeView`／`_taskInCurrentView` ホーム分岐／旧インライン重複0件／`tasks.sort(` 0件）・保護対象4関数の本文一致・console 0。
- **PC/iPhone 実機確認完了**（ユーザー実施）。
- **DB無変更**：cases 生存2/削除済み2/合計4・tasks 生存253/deletedIds125・**archived 70**＝いずれも変更前と同値。**テストTaskの作成・削除・アーカイブなし**・発行HTTPは**GETのみ**。

### 注記（既存仕様・今回の変更とは無関係）
- archivedビューでは「一覧＝archived 70件／Progress・バッジ＝稼働中183件」となるが、これは **Progress・バッジが常に active（archived除外）を集計する既存設計**（「archivedは集計対象外（Leader集計対象外）」）によるもの。**当該2箇所は今回のdiffに含まれず、回帰ではない**。

### 状態
- **Phase54 Complete維持**／**Phase55未着手**
- **次工程候補**：① Phase55へ進むか判断 ／ ② Version1.1 最終確認 ／ ③ Version2（Affiliate Intelligence）準備

---

## Case成功確認契約（Case Success Contract）**完了**（2026-07-17・本番反映済み・commit aed5f7d・tag v1.01-phase54-case-sync-contract）

> 記録日: 2026-07-17。**Phase54 正式Complete維持・Phase55未着手**。案件系Known Issue Close後の残課題（`pushCaseToServer` の失敗握り潰し構造）への恒久対応。**index.htmlのみ（+48/-11）**／server.js・lib・DB・API・SQL・docs以外は**無変更**。Decision 063。

### 時系列
- **aed5f7d — Case Success Contract**（tag **v1.01-phase54-case-sync-contract**）

### 背景（調査で確定した問題点）
- `pushCaseToServer` は `fetch(...).catch(() => {})` で**失敗を完全に握り潰し**、`res.ok`・`data.ok` とも**未検証**。POST失敗が無音のため **local-only案件が再発し得る**構造だった。
- **P4**：サーバは Supabase 失敗時も **HTTP 200 + `{ ok:false }`** を返す（`res.json({ ok: !result.error })`）→ **HTTP status だけでは成否判定不可**。
- **P5（②-Aの潜在ギャップ）**：`deleteCaseFromServer` が **HTTP status のみ**で判定 → Supabase障害時に `200 + ok:false` を成功と誤判定 → **localから削除・DBは未削除 → 次回同期のmergeで案件が復活**。
- 自己修復パス（`touchCase` がメッセージ送信ごとに同一idを再POST＝`onConflict:'id'` で冪等）が存在するため、恒久的にlocal-onlyで残るのは**「作成後に一度もメッセージを送っていない案件」**に限られる（深刻度は中〜低）が、構造的な穴として実在。

### 実装（index.htmlのみ）
- **`_postCaseOnce(body)` 追加**：POST 1回分。**成功 = `res.ok` かつ JSON解析成功 かつ `data.ok === true`**（**POST成功確認**／**data.ok検証**）。4xx=`client`（**再送しない**）／5xx・200+`ok:false`=`server_ok_false`／通信失敗=`network`。JSON解析失敗は成功と見なさない。
- **`pushCaseToServer(caseId, opts)` async契約化**：`{ ok, status, reason }` を返す（`deleteCaseFromServer` と同形）。**再送は最大1回**（合計2回・無限再試行禁止）／**localは成否に関わらず常に保持**／`opts.notifyOnFail` 時のみ通知。
- **`_notifyCasePushFailed(name)` 追加**：**通知は案件作成時のみ**（`createCase` → `{ notifyOnFail:true }`）。**`touchCase` 経由は通知しない**（毎メッセージ発火＝スパム防止）。
- **DELETE成功確認（P5解消）**：**404 を先に判定**（本文が `ok:false` のため）→ local-only として成功／それ以外は **3条件（`res.ok`＋JSON解析成功＋`data.ok===true`）** のみ成功／**200+`ok:false`・5xx・通信失敗＝失敗＝localを保持して既存通知**。
- **保護**：`createCase()` は**同期関数のまま**（await しない＝UIブロックなし）／`touchCase()` は**無変更**（local更新処理・呼び出しとも）／`createCase` 本体ロジック・dedup／`createNewCaseFromForm`／Case merge・prune／Task同期／Task History／Notification／Timeline／Approval／Output Draft／Cost／Phase53 **非接触**。

### 確認
- **localhost確認**（fetchスタブ・**実DBへテストデータ作成なし**）：
  - POST：200+ok:true=**1回**/通知0 ／ 200+ok:false=**2回**/通知1 ／ **400=1回（再送なし）**/通知1 ／ 500=**2回**/通知1 ／ 通信失敗=**2回**/通知1 ／ **touchCase経由=通知0** ／ 再送で成功（500→200）=ok。**全ケースで local保持**。
  - DELETE：200+ok:true=成功 ／ **200+ok:false=失敗・local残存** ／ 404=成功（local-only） ／ 500・通信失敗=失敗・local残存。
  - **最大試行回数2回以内**（POST最大2／DELETE最大1）／`node --check` 0エラー／**dev-check 200/200/200**／**console 0**。
- **Render確認**：自動デプロイ反映・**本番トップ HTTP 200**・本番配信コードが実装と一致（`_postCaseOnce`／async契約／`data.ok===true` 検証／再送分岐／404先行判定 すべて配信済み・**旧 fire-and-forget と旧DELETE判定は残存0件**）・本番でも全ケース再検証合格。
- **console 0**（localhost・本番とも）。
- **データ保護**：本番DB **生存1／削除済み2／合計3行**＝Close時点と一致＝**無変更**（テスト案件の作成・本番案件の削除なし）。localStorage は raw文字列で復元一致。

### 状態
- **Phase54 Complete維持**／**Phase55未着手**／Case同期系＝**成功確認契約 適用済み**。
- **残存項目は別工程**：① Phase54 Hotfix の **Task側** PC⇔iPhone 実機確認（未実施）／② **Case同期契機の改善**（現在は起動時1回のみ・`visibilitychange` 等）／③ Phase55判断。

---

## 案件系Known Issue **全Close**（2026-07-17・Case同期系Complete・Phase54完了後・本番反映済み）

> 記録日: 2026-07-17。**Phase54 正式Complete維持・Phase55未着手**。Phase54完了後にユーザー本番実機で顕在化した**案件（Case）系**Known Issueへの恒久対応。**Task同期系とは別工程**（Task側の残課題は別記のとおり継続）。

### 完了工程（時系列）

- **不具合① 案件自動増殖の停止**（commit **f36762c**・tag **v1.01-phase54-known-issue-case-auto-create**・**index.htmlのみ4行**）
  - 原因確定：`sendMessage()` →（leader・dispatch有）→ `handleLeaderDispatch()` @8081 が**無条件で `createCase(userText, assignedIds)`** を実行。`createCase` の dedup が**送信本文（userText）基準**のため、本文が異なる会話ターンごとに新案件が生成されていた。生成案件は `pushCaseToServer` でDBにも流出。**`createCase` の呼出は全コードで2か所のみ**（8081／`createNewCaseFromForm` 13167）で、増殖源は前者に限定。二重定義なし。
  - 変更4行：@8081 `_ncActiveCaseId('leader') || null`（案件選択中は継続・未選択/最新一覧/案件一覧は `null`＝横断・自動生成なし）／@8149 横断Taskタイトル `[横断]`（`[undefined]` 防止）／@10116 `saveCaseMemory` の caseId を `_ncActiveCaseId(_mid)` へ（未選択時は保存しない＝先頭案件への誤保存防止）／@10050 `touchCase` の先頭案件フォールバック停止（横断時は既存案件の `updatedAt`・並び順・`pushCaseToServer` を発火させない）
  - **Decision 060**。`createCase()` 本体・`createNewCaseFromServerForm` 経路・server.js/DB/API/SQL は**無変更**。
  - ⚠️ 当初の実機再現は**本番が旧コード配信のまま**（push未実施）だったことが原因と `curl` 実測で確定。本番反映後に増殖停止を確認。

- **不具合②-A Case削除同期**（commit **ad83544**・tag **v1.01-phase54-known-issue-case-delete-sync**・**4ファイル**）
  - 原因確定：削除4経路はDBへ同期していたが**物理DELETE**のため tombstone が残らず、`mergeServerCases` は「サーバに無い＝削除」を推論しない設計（local限定案件保護のため）＝**削除が他端末へ永久に伝播しない**。加えて `pushCaseToServer` の失敗握り潰しで local-only 案件が堆積。
  - **SQL（ユーザー実行済み・非破壊）**：`ALTER TABLE cases ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;` ＋ `CREATE INDEX IF NOT EXISTS idx_cases_deleted_at ON cases (deleted_at);`（nullable・既存行NULL＝生存・移行なし）
  - `supabase/schema.sql`：`cases.deleted_at` 定義＋ALTER/indexコメント追記
  - `lib/casesDb.js`：`getCases` を生存フィルタ＋**全件GET時のみ `deletedIds`**＋`total`／**`softDeleteCase(id)` 新規**（notFound／`alreadyDeleted` 冪等）／`deleteCase()`（物理）は**残置・未配線**／`upsertCase` 無変更＝**削除済み行へのupsertで復活しない**
  - `server.js`：`GET /api/cases` に `deletedIds`/`total` 追加（`cases` 配列は形不変＝後方互換）／`DELETE /api/cases/:id` を `softDeleteCase` へ委譲（404／200冪等・**パス・IF不変・新規エンドポイントなし**）
  - `index.html`：`mergeServerCases(serverCases, deletedIds)` へ拡張し **deletedIds に明示されたidだけprune**（「GET結果に無い＝削除」とは推論しない＝**local-only案件保護**）／`deleteCaseFromServer` を成否を返す契約へ／`_deleteCaseWithContract`・`_notifyCaseDeleteFailed` 新規／**削除4経路（`deleteCase`・`_homeDeleteCase`・`_clBulkDelete`・`_homeBulkDelete`）を同一契約へ統一**＝**200/冪等200/404=local削除可・5xx/通信失敗はlocal保持＋通知**・一括は1件ずつ順次（フラッド防止）
  - **Decision 061**。**PC⇔iPhone双方向の削除伝播をユーザー実機確認済み**。

- **②-B-1 案件診断**（commit **7c7d6ff**・tag **v1.01-phase54-known-issue-case-diagnosis**・**index.htmlのみ +226・読み取り専用**）
  - `DEBUG_CASE_DIAG` フラグ／`diagnoseCases`／`_diagnoseOneCase`／`_diagAction`／`_diagSummary`／`_diagDevice`／`renderCaseDiagnosis`／`_diagCopyJson`／`_diagCopyFallback`／ホーム一覧の「🔍 診断」ボタン
  - **絶対条件を構造的に担保**：発行HTTPは **`GET /api/cases` 1本のみ**（POST/PATCH/DELETE **0件**）／`saveCases` を呼ばず `cases` へ代入・deleteしない（**localStorage不変**）／`syncCasesFromServer`・`mergeServerCases` は**不使用**（merge+prune+saveCases＝mutationのため）／**実行系ボタンを置かない**（「📋 JSONをコピー」「閉じる」のみ）／推定は「疑い」「可能性」と表示し signal内訳と score を併記
  - 分類：DB状態（生存／削除済み／local-only）・推定区分（正常案件の可能性／不具合①由来の疑い／判定不能）・推奨アクション（Keep／Review／Remove候補）・`msgCount`。JSON schema `case-diagnosis/v1`
  - **PC・iPhone双方で実施済み**

- **②-B-2 Backfill：対象なしのため未実装Close** ／ **②-C 残骸整理：対象なしのためClose**（**Decision 062**）

### 実機確認の実測値（PC・iPhone双方で完全一致）
- **DB 生存 1 ／ DB 論理削除済み 2 ／ 合計3行が残存＝物理削除なし**
- **PC local 1 ／ iPhone local 1** ＝ **DB生存 = PC = iPhone の三者一致**
- **local-only 0 ／ Review 0 ／ Remove候補 0**
- 残骸が解消した経緯：不具合①修正で新規増殖が停止 → ②-Aでユーザーが実機削除（DB行ありは**論理削除**され `deletedIds` で両端末prune／DB行なしの local-only 残骸は **404→local削除可** の契約で除去）＝**②-Aの設計が②-Cの整理を先に完了させた**

### Close処理（本記録のcommit）
- `index.html`：**`DEBUG_CASE_DIAG = false`**（本番の診断ボタン非表示）。**診断ロジック・変数・関数は削除せず温存**（再調査時 `true` で復活・PhaseD-1 の `DEBUG_TASK_SYNC` と同方式）
- docs：01/02/04DECISIONS/06HANDOVER/CHANGELOG 更新

### 保護（不変）
- **物理削除なし**（`cases` は `deleted_at` による可逆な論理削除）／**`messages`・`conversations`・`task_history`・Learning は非連動・非削除**（履歴保護維持）／**local-only案件保護**／`createCase()` 本体／`createNewCaseFromForm()`／**Task同期・Task History・Notification・Timeline・Approval・Output Draft・Review State・Provider・Routing・Cost・Phase53 非接触**／cost関連3ファイル・退避フォルダ **未操作**

### 確認
- `node --check`（server.js／lib/casesDb.js）0エラー／**dev-check 200/200/200**／console 0
- localhost：GET形不変＋`deletedIds`/`total`・部分GETは`deletedIds`空・DELETE 404・**物理削除なし**・prune規則7件（deletedIds対象のみ／local-only保護／非配列・undefined・空配列でpruneしない／未知idはno-op）・削除契約4件（200/404→local削除・5xx/通信失敗→local保持）・`messages` 50件不変
- 本番：トップ200・`deletedIds`/`total` 返却・生存のみ返却・**合計3行＝物理削除なし**・DELETE 404・旧DELETE配線0件・クライアントprune配信済み・console 0・iPhone幅(390×844)で横スクロールなし

### 状態
- **Case同期系Complete**／**Phase54 Complete維持**／**Phase55未着手**
- **残存項目は別工程**：① `pushCaseToServer` の成功確認化（**作成側は現在も fire-and-forget**＝POST失敗時に local-only 案件が再発し得る）／② Phase54 Hotfix の **Task側** PC⇔iPhone 実機確認（未実施）／③ Case同期契機の追加（現在は起動時1回のみ＝他端末の削除反映に相手端末のF5が必要）

---

## Phase54 Known Issue（PC⇔iPhone Task表示不一致）**Complete**（2026-07-16・Phase54完了後・archived/caseId Server正本化・本番反映済み）

> 記録日: 2026-07-16。Phase54 正式Complete維持・Phase55未着手。Phase54完了後にユーザー実機で顕在化した Task同期 Known Issue（PC badge47/iPhone badge13）への恒久対応。**GET /api/tasks=233 は正常・API/DB/Render/同期実行は正常**で、原因は Task field merge が単一 `updatedAt` の newer-wins だったため端末ローカルの archived/caseId が温存され PC⇔iPhone不一致。

#### 完了工程（時系列）
- **PhaseA-0 診断追加**（commit **5f23cf1**・tag **v1.01-phase54-known-issue-a0**）：Task同期診断（build marker・HTTP status・received・merge・save/render）＋`showApp()`後sync 1回保証（in-flight時1回再試行・backfill非呼出）。iPhone recv233/complete＝**同期は正常**を確定。
- **PhaseA-1 分布診断**（commit **76d0582**・tag **v1.01-phase54-known-issue-a1**）：caseId/status/archived/deleted 分布を診断へ追加（観測のみ）。excl[case163 arch1 done0]＝**caseId支配的**を数値確定。
- **PhaseA-2 原因確定・設計**：merge が単一 `updatedAt` newer-wins で archived/caseId/rich status を一括処理（責務未分離）＝温存原因。Server-Authoritative は削除・存在のみでフィールド値は newer-wins だったと確定。項目別Server正本（B案）を推奨・段階分割を設計。
- **PhaseC-1 archived Server正本化**（commit **0ed68e4**・tag **v1.01-phase54-known-issue-c1**・index.html +16）：dbId一致Taskの `archivedAt` を newer-wins非依存でServer正本化（stale archived解除／rich status温存／status は archived⇄非archivedのみ・新項目追加なし）。
- **PhaseC-2 caseId Server正本化**（commit **6f0816a**・tag **v1.01-phase54-known-issue-c2**・index.html +3）：dbId一致Taskの `caseId` を newer-wins非依存でServer正本化。local-only（dbなし）保護。
- **PhaseD-1 診断表示 非表示化**（commit **a5bbe27**・tagなし・index.html +7/-1）：`DEBUG_TASK_SYNC=false` で本番非表示。**診断ロジック/変数/関数/localStorage記録は削除せず温存**（再調査時 true で復活）。
- **保護（不変）**：local-only Task保護／rich status／newer-wins本体（title/body/priority/member/updatedAt）／deleted同期（deletedIds/deletedSignatures）／Server-Authoritative Reconciliation／backfill安全化（POST上限20・1回制限）／件数統一／Task History／Learning／server.js/lib/DB/API/SQL/Supabase。
- **最終確認（本番・実機）＝Known Issue Complete**：total**233**・archived**1**・todo**232**・NULL caseId**70**・caseIdあり**163**・**PC view/badge 69/69**・**iPhone view/badge 69/69**（一致）・Task件数減少なし・backfill POST増加なし・Render API正常・診断本番非表示・console 0・dev-check 200/200/200。

---

## Phase54 Hotfix（Phase54完了後Known Issue対応・本番反映済み・commit d512bad・tag v1.01-phase54-hotfix-task-sync）

> 記録日: 2026-07-14。**Phase54 正式Complete 維持・Phase55 未着手 維持**。Phase54完了後にユーザー実機で顕在化した Task同期 Known Issue への Hotfix（別機能を1コミットに集約）。

- **Known Issue**：Task削除がPC⇔iPhoneで同期されない／削除がF5・再ログイン・案件切替で復活／Task一覧・Progress・バッジの件数不一致／backfill重複再登録／backfillによるTask急増（75→354）／Task生成10件制限。
- **実装（4ファイル・+404/-61）**：
  - `supabase/schema.sql`：`tasks.deleted_at` / `tasks.archived_at`（nullable・非破壊・**ユーザーSQL実行済み**・物理削除しない）
  - `lib/tasksDb.js`：`getTasks`（生存のみ＝deleted除外・archived含む＋`deletedIds`/`deletedSignatures`/`total`）・`softDeleteTask`・`setTaskArchived`・`_rowSignature`
  - `server.js`：`PATCH {deleted}`/`{archived}` 分岐（status/archived/deleted 同時指定400・404・冪等）／`/api/auto-task` `MAX_AUTO_TASKS=20`（10→20）
  - `index.html`：削除・アーカイブ同期（成功後のみlocal反映・失敗時保護）・dbId限定reconciliation・backfill B案安全ガード（POST上限20）・件数統一（一覧=Progress=バッジ）・起動をsync→backfill直列化
- **backfill安全化（B案）**：server同期後1回・in-flight lock・dbIdなしのみ・deletedSignatures照合・archived除外・**local重複除外**・成功後即dbId反映・失敗再試行なし・**POST上限20超過で自動停止＋通知**（フラッド防止）。**backfill上限とTask生成上限は別管理**。
- **件数統一**：一覧／Progress／バッジ＝現在案件＋NULL・deleted除外・archived除外の同一可視集合。
- **本番DBデータ整理**：重複候補 **123件を JSON/CSV 退避 → id限定 `deleted_at` 論理削除**。**生存233件／deletedIds125件**。元75・正当156は保護（全生存）。検証 arch-1=通常/arch-2=アーカイブ。**正当156の個別整理は未実施**。
- **退避/除外**：`backup-dup-candidates-20260714/` はローカル退避・**Git対象外**。cost関連3ファイルは**対象外・未操作**。
- **確認状況（区別）**：**実装済み**（4ファイル）／**localhost確認済み**（dev-check 200/200/200・console0・削除/アーカイブ/冪等/404/400・件数一致・F5維持・backfillフラッド防止）／**本番確認済み**（Render top200・GET total233/deletedIds125・archived_at・arch-1 NULL/arch-2 NOT NULL・21件→400・console0）／**ユーザー実機確認：未実施**（PC⇔iPhone双方向 削除/アーカイブ/復元）。

---

## Phase54-3: Remaining Realtime Sync（残Realtime Sync完成工程・Version1.1「PC⇔スマホ同一AI会社」直結）

> 記録日: 2026-07-12。目的＝Task/Status/Auto Task/Timeline/Notification/Workflow Live の端末間同期を完成。実開発Phase54系は **Version1.1 Connected AI Company / Realtime Sync系**（ROADMAP旧Phase54定義とは別・Decision 053）。

### Phase分割（工程＋分離）
- **3a Task Basic Sync**：既存 `GET /api/tasks` を pull・merge＝**全社共通Taskの基本同期**（基本status 3値・案件分離なし）。index.htmlのみ・DB/API/SQL無・新規poll無。**実装済み・localhost確認済み・未commit**
- **3a-2 Task Case Scoping**：案件別Task分離（`tasks` へ nullable `case_id`＝A案・messages.case_id踏襲）。DB/server/lib/index。**Completed**（SQL実行済み・localhost確認済み・commit bc98455・tag v1.01-phase54-3a-2・**push済み・Render反映済み・本番PC確認済み・ユーザー実機確認済み**）

#### Phase54-3a-2 実装内容（A案・commit bc98455・+72/-20・4ファイル）
- **DB**：`tasks.case_id TEXT`（nullable・FKなし・既存行NULL維持）＋`idx_tasks_case_id`。SQL実行済み（ユーザー）：`ALTER TABLE tasks ADD COLUMN IF NOT EXISTS case_id TEXT;` / `CREATE INDEX IF NOT EXISTS idx_tasks_case_id ON tasks (case_id);`
- **lib/tasksDb.js**：`createTask` caseId受領（`if (caseId != null) row.case_id = caseId`＝非null時のみ列送信）／`getTasks` 任意caseIdフィルタ（未指定は全件）
- **server.js**：POST caseId受領→createTask／GET 任意caseId query（**既定全件維持＝backfill契約保護**）／PATCH不変
- **index.html**：`syncTaskToServer` caseId送信（現在案件フォールバックしない＝backfill安全）／`_taskFromServerRow` `case_id`→`caseId` map／merge newer-wins時にcaseId反映／`_ensureTaskCaseId`（新規のみ・undefined時だけ`getCurrentApprovalCaseId()`付与・null/既存値尊重）／`_taskViewCaseId`／全Task作成経路配線（leader_dispatch既存caseId尊重・suggestion・delegation・auto next・submitTask・auto_chain・leader_template。workflow定義配列は非配線）／`renderTaskList` 案件別フィルタ（NULL横断は常時表示）／switchCase・_homeOpenCase・goHome にパネル開時再描画フック
- **保護**：`_taskSignature` 不変・GET既定全件・既存local-only TaskへcaseId強制付与なし・status CHECK非対象・Approval/Output Draft/Review State/Conversation/Messages/Workflow/Timeline/Notification/Learning/Cost/Phase53 非接触
- **localhost確認**：SQL反映（case_id実在）・caseId付き/NULL保存・GET全件/フィルタ・案件A/B分離（実DOM）・NULL横断（既存55件全view）・F5維持・**実再ログイン分離（実DOM）**・backfill重複0・dbId重複0・既存55件減少0・DB60件（テスト5件）・console 0・dev-check 200/200/200
- **本番反映・確認（Completed）**：push `a71ca79..4372576`（fast-forward・cost非混入）→ Render自動デプロイ反映（新server.js＝GET`?caseId=`サーバーフィルタ稼働・新index.html＝新関数稼働・GET正常・エラーなし・Render設定/環境変数変更なし）→ **本番PC確認済み**（案件A/B分離・NULL横断・F5・再ログイン維持・重複なし・既存減少なし・console 0）→ **ユーザー実機確認済み**
- **3b Task History Persistence**：`global.__taskHistory`（server memory・非DB・volatile）を新規 `task_history` テーブルへDB化 → Timeline/Notification/Workflow Live/Auto Task の端末間・F5・再起動復元を一括解錠。**詳細Live Status（working/reviewing等）はここで扱う**。server.js/lib/schema＋SQL。**3b-1（永続化基盤）Completed** ／ **3b-2（case_id配線・案件別分離）Completed（push済み・Render反映済み・本番/ユーザー実機確認済み）** ／ 3b-3以降未着手

#### Phase54-3b-2 Task History Case Scoping **Completed**（案件別分離・commit b5ab89d・tag v1.01-phase54-3b-2・+29/-12・2ファイル・push済み・Render反映済み・本番/ユーザー実機確認済み）
- **client**：`/api/auto-task`・`/api/consult` POST に `caseId: getCurrentApprovalCaseId() || null` 送信／`_historyVisibleInView`（NULL横断常時表示・case付きは現在案件のみ）＋`renderNotifications` に案件別フィルタ
- **server**：auto-task・consult で `caseId` 受領→生成履歴各行へ保存（`h.caseId==null`のときのみ＝既存値尊重）／`_hybridTaskHistory` 任意caseIdフィルタ／GET 2本に任意 `?caseId=`
- **仕様**：引数なしGET＝全件（クライアント全保持・Hybrid/dedup維持）／`?caseId=X`＝該当案件のみ厳密（NULL含まず）／NULL横断はクライアント表示側で担保
- **保護**：レスポンス形不変・3b-1 Hybrid/dedup維持・`global.__taskHistory`維持・Learning据え置き・Workflow Live(aiLivePoll workflowId scoped)大幅変更なし・新規SQL/DB変更なし・Approval/Output Draft/tasks.case_id/Provider/Routing/Cost 非接触
- **確認**：consult(caseId)保存／**Auto Task実ワークフロー1回（案件A・実AI）＝生成6行全てcase_id=A・history_id重複0・GET`?caseId=A`6件/`?caseId=B`0件・NULL横断存続・Notification実描画A=6/B=0・workflow-dashboard形不変＋caseIdフィルタ**／再起動後case_id維持・既存consumer回帰なし・console 0・dev-check 200/200/200
- **本番反映・確認（Completed）**：push `6d1f5b6..3a95691`（cost非混入）→ Render自動デプロイ（本番`?caseId=`フィルタ動作＝新コード稼働）→ 本番API確認（task-history/workflow-dashboard 200・レスポンス形不変・caseId付き履歴DB取得・重複0・console 0）→ **ユーザー実機確認済み（案件A専用履歴が他案件へ混入しないことを確認）**・F5/再ログイン/再起動後もDB永続・NULL横断維持・Workflow Live/Timeline回帰なし

#### Phase54-3b-1 Task History Persistence **Completed**（永続化基盤・commit 2e4b0fc・tag v1.01-phase54-3b-1・+195/-8・3ファイル・push済み・Render反映済み・本番API確認済み）
- **目的**：`global.__taskHistory`（サーバーメモリ・非DB・Render再起動で消失）を `task_history` テーブルへ永続化。**今回は永続化基盤のみ（case_id配線・UI変更なし）**
- **DB（ユーザーSQL実行済み）**：`task_history`（`history_id TEXT NOT NULL UNIQUE`・`workflow_id`・`case_id TEXT`(nullable/FKなし)・`from_agent`/`to_agent`/`task_id`(workflow task id・FKなし)・`action`/`instruction`/`type`/`note`・`status TEXT`(**CHECKなし**)・`meta JSONB`・`requested_at`/`completed_at`/`created_at`）＋index(workflow_id/case_id/requested_at)＋冪等RLS
- **lib/taskHistoryDb.js（新規）**：`upsertHistoryEntry`／`upsertHistoryEntries`（`onConflict: history_id` 冪等）／`getHistory({from,to,caseId,workflowId})`。app↔DBマッピング・標準外fieldは`meta`退避/復元
- **server.js**：`_persistTaskHistory`（fire-and-forget・非ブロック・**DB失敗でWorkflow停止しない**）／`_hybridTaskHistory`（メモリ＋DB・`history_id` dedup・**メモリlive優先**）／auto-task(bulk)・consult(push/完了/エラー)でDB保存／`GET /api/task-history`・`/api/workflow-dashboard` をHybrid化（**レスポンス形不変**）
- **実DB確認**：round-trip＋meta復元／`history_id` 冪等upsert(重複行0)／Hybrid(memory+DB) dedup(appearCount=1・live優先)／**サーバー再起動2回後もDB復元**(2件・dupInGet 0)／DB未作成でもgraceful(throwなし)／既存consumer回帰なし／console 0／dev-check 200/200/200
- **保護**：`global.__taskHistory`維持／status改善せず(CHECKなし)／case_idは常にNULL(横断・配線は3b-2)／polling/WebSocket追加なし／Approval・Output Draft・tasks.case_id・Workflow・Provider・Routing 非接触
- **本番反映・確認（Completed）**：push `47d7417..6d1f5b6`（cost非混入）→ Render自動デプロイ（新Hybridコード稼働＝本番GETがDB履歴返却）→ 本番API確認（task-history/workflow-dashboard 200・レスポンス形不変・DB履歴取得・重複0・console 0）→ **Render再デプロイ後の新規インスタンス（メモリ空）もDB履歴復元**（本番再起動復元成立）
- **3c Notification Unread / Workflow Live Restore**：通知未読(`_notifSeenIds`・非永続)の永続化＋完了Workflowの復元。※実装は **Phase54-3b-3** で先行実施（下記）

#### Phase54-3b-3 Notification既読永続化・Timeline案件別・Workflow Live復元 **Completed**（commit 3e3c432・tag v1.01-phase54-3b-3・+200/-8・4ファイル・push済み・Render反映済み・本番/ユーザー実機確認済み）
- **3b-3a Notification既読DB永続化**：新規 `notification_reads`（`history_id` PK・`case_id`・`seen_at`・`created_at`＋index＋冪等RLS）／新規 `lib/notificationReadsDb.js`（`getSeenIds({caseId,limit})`／`markSeen(historyIds,caseId)`・`onConflict:history_id`＋`ignoreDuplicates`＝冪等）／`GET/POST /api/notification-reads`（GET `?limit=` 既定1000/上限5000・`?caseId=`任意・DB失敗でも空返却で表示止めない）。client：`showApp`（起動/再ログイン）で`restoreNotifSeenFromServer`→`_notifSeenIds`反映／click・markAllで`_persistNotifSeen`（即時UI＋fire-and-forget DB保存）。**単一共有アカウント(web-user)＝user_id列なし＝PC/iPhone間既読同期基盤**
- **3b-3b Timeline案件別表示**：`_timelineEventVisibleInView`（wfId空/NULL=横断常時表示・case付きは現在案件のみ）を`renderTimeline`に適用。ホーム/未選択は横断のみ。**空/NULL event維持（過剰フィルタ防止）**
- **3b-3c Workflow Live復元**：`wlProgressPoll` found:true＝既存Live優先／found:false時のみ`_wlRestoreFromHistory`でtask_historyから静的復元（担当/action/status/caseId/開始・完了時刻・**本文対象外**）＋復元後ポーリング停止
- **保護**：既存APIレスポンス形不変・task_history Hybrid/dedup維持・3b-2案件分離非接触・`global.__taskHistory`維持・新規SQL(notification_readsのみ・実行済)以外のDB変更なし・Approval/Output Draft/Provider/Routing/Cost 非接触
- **実DB確認**：既読POST/GET・冪等(重複0)・limit・空POST400・`_notifSeenIds`復元／Timeline A/B分離＋横断維持／Live復元(本文空)／既存consumer回帰なし／console 0／dev-check 200/200/200
- **本番確認（Completed）**：push→Render反映→本番API確認→**ユーザー実機確認済み（PC⇔iPhone通知既読双方向同期・F5/再ログイン維持・表示操作正常）**

#### Phase54 最終統合確認（3d相当・2026-07-14・合格＝**Phase54 正式Complete**）
- **案件分離**：Task A/B分離・Task History `?caseId`厳密・Timeline A/B分離・NULL/空横断データ全view維持（Task55件/履歴/timeline空event）
- **Approval/Draft**：案件別GET混入なし・review_state復元・復元関数群健在／**Task**：DB60件維持・dbId重複0・操作正常
- **Task History/Notification**：再起動直後DB復元12件(dup0)・既読復元6件(dup0)・PC⇔iPhone双方向既読同期（実機）・F5/再ログイン維持
- **Timeline/Workflow Live**：119event描画・分離・横断維持／Live既存経路健在＋historyフォールバック（本文なし＝仕様）
- **回帰**：Messages50件case_id復元・全consumer ok・console 0・dev-check 200/200/200／**本番**：全API正常・重複0・caseId厳密
- **3d Version1.1 Sync Final Verification**：全同期のPC⇔スマホ・F5・再ログイン・案件分離・回帰の通し確認。**未着手**
- **Cost同期＝別工程**（cost系3ファイル温存・server-globalで端末非依存共有済み・Version1.1必須外）
- **Learning残（in-memory buffer）＝Version2候補**（主要DB化済み）

### Phase54-3a Task Basic Sync（実装済み・localhost確認済み・未commit）
- **スコープ**：**全社共通Taskの基本同期のみ**（`tasks.status` は基本3値）。**案件分離は3a-2、詳細Live Statusは3b（task_history）で扱う**
- **現在の構造**：`tasks`テーブル＋`GET/POST/PATCH /api/tasks`＋`tasksDb.js` は完備。だがクライアントは起動時 localStorage(`TASK_KEY`) のみ読込＝**GET pull未配線**。`tasks` テーブルに `case_id` 列なし＝Taskは案件横断
- **実装内容（index.htmlのみ）**：`syncTasksFromServer`／`_taskFromServerRow`／`_mapServerTaskStatus`＋`_taskSyncInFlight` ガード。起動時(`loadTasks`直後)・switchCase・_homeOpenCase で pull・merge
- **merge安全規則**：dbId(UUID)で重複排除／未存在のみ追加／同一Taskはサーバー `updated_at` 厳密新しい時のみ採用／localのみTask保持／失敗・空で削除しない／localStorageキャッシュ維持
- **既知制約**：client status語彙(10種) vs server CHECK(pending/in_progress/done)。rich statusのPATCHは失敗し `updated_at` が進まないため pull時に降格しない（rich status保護）。双方向status統一は3b以降
- **確認**：起動pullで22件merge・dedup・空/失敗維持・in-flightガード(GET1回)・newer-wins＋rich status保護・F5復元・回帰OK・console0・dev-check 200/200/200
- **変更ファイル**：`index.html`のみ（+88・追加のみ）。server.js/lib/DB/API/schema/cost 非接触
- **未実施**：commit・tag・push・Render・本番実機・Complete確定

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
