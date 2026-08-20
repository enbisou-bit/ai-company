# 06HANDOVER_NEXT_CHAT.md

# ENBISOU AI COMPANY - 次チャット引き継ぎ書

更新日: 2026-08-20（**Phase IG-QC-B1/B2 candidateOnly Quality Routing Fix / Production Re-evaluation 正式リリース・Decision106**。`buildOutputDraftFromLeaderFinal({candidateOnly:true})`ブランチが Phase IG-QC routing 前に early return していた根本原因（B1）修正・全 86/86 PASS・Code commit **0c076dd**。本番 `out_1787060723866` の旧 snapshot（instagram/20/insufficient・QG failed）を既存`evaluateQualityGate()`で非課金再評価・限定保存（B2）。保存後実測：iadp/100/complete・QG passed=true。Evidence・IADP 本体・User Approval 変更なし。Cross-case 汚染なし。B3 Annotated Tag **v1.01-iadp-quality-routing-complete**・main push・Render 反映・PC本番確認済み。OpenAI API 0・Claude API 0・Web Search 0。Leader Case Context Phase2 引き続き本番未 commit。以前: **Phase IG-QC / B-7F Quality Gate Package Routing Fix 正式リリース・Decision105**。IADPを含むOutput DraftがInstagram投稿用`instagram` Quality Contract（hook/slideTitles/hashtags等10項目）へ誤接続されていた根本原因（Phase IG-QC）と、全Path A Output Typeで`buildOutputDraftFromLeaderFinal()`のreturn値から`packageQuality`が欠落し`evaluateQualityGate(undefined)`が実行されていた配線バグ（Phase B-7F補完）を修正。正式IADP（`validation.valid===true`・`packageId`存在・`quality`算出済み）には`evaluateInstagramAccountDesignQuality()`の事前算出済み結果をrouting。非IADP・guard失敗は既存`evaluateOutputPackageCompleteness()`へfall-through（後方互換維持）。全Path A Output TypeでQuality Gateへ実評価値が接続。既存Quality Contract・Executive Decision責務は変更なし。正式回帰テスト`iadpQualityContractRouting.test.js` 48/48 PASS。Leader Case Context Phase2は引き続き本番未commit・未リリース。OpenAI API call 0・Claude API call 0・Web Search 0・DB変更なし。**`index.html`（2 hunk）／`iadpQualityContractRouting.test.js`（新規）のみ**（Code commit **547ddac**）。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程は対象案件`case-msr9yckye65y`のIADP専用Quality/packageQuality/Quality Gate/Account Creation Readinessを本番で再確認（まだUser Approvalへは進まない）。詳細はDecision105参照。以前: **Claude Pricing Correction 正式リリースComplete・Decision104**。Claude Cost Log調査でclaude-opus-4-8が公式単価の3.000倍・claude-haiku-4-5が0.800倍という単価定数誤りを特定し、`claudeCostTracker.js`／`claudeClient.js`の`CLAUDE_PRICE_PER_1K`（Opus/Haiku値のみ・Sonnet無変更）を訂正した。計算式・重複計上防止・JPY換算・cache token（未使用）にはいずれも問題なし。Claude側にはCost Gateがそもそも存在せず機能面への影響はなし（表示・報告上の金額のみ）。非課金fixtureテスト全PASS、2026年8月Supabase実績を公式単価で再計算した合計$4.051303がAnthropic公式実績$3.93と残差約3%まで一致。**working treeに存在する別系統差分「Leader Case Context Phase2」（`claudeClient.js`に混在していた`caseContext`関連の未commit差分）は今回も明確に分離しcommitから除外・引き続き本番未リリース**。過去Cost Event（Supabase `api_cost_events`・`claude-cost-logs.json`）はAudit Trailとして保持し遡及修正なし。DB Migrationなし。node --test既知6 FAILは無関係のpre-existing failureで新規FAILは0件。**`claudeCostTracker.js`／`claudeClient.js`（料金定数のみ）**（Code commit **b6e3cbc**）。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程はContent Quality/Quality Gate不足の解消、またはUser Approvalに進む前の残工程判断（ユーザー承認後）。詳細はDecision104参照。以前: 2026-08-18（**IADP Structured Output 正式リリースComplete・Decision103**。実運用予定案件`case-msr9yckye65y`でIADP生成Validation FAILの根本原因（IADP Leader Finalが自由記述のみに依存し、`finalProfile`トップレベル配置と`candidateComparison`/`adoptionDecision`出力を逸脱）を特定し、OpenAI Responses API `text.format:{type:'json_schema',strict:true}`をIADP Leader Final呼び出し1箇所のみへ追加。`shared/instagramAccountDesign.js`は無変更で既存安全契約を完全維持。実AI E2Eで`valid:true`到達を確認。**別系統差分「Leader Case Context Phase2」（`buildLeaderCaseContext()`含む）は今回除外し、本番環境には現時点でこの関数が存在しない**。詳細は下記【現在地・最優先】参照。以前: 2026-08-18（**Deliverable Completion Architecture（STEP 6）正式リリースComplete・Decision102**。「AIが処理を終えた」ことと「依頼が本当に完了した」ことを分離するCompletion判定軸を新規採用。以前: 2026-08-13（**External Evidence Acquisition（EEA）正式リリースComplete・Decision101**。EEA-1〜EEA-12（Evidence schema拡張／Web Search Adapter／Search Plan+User Approval Gate／Evidence保存／実Web Search限定検証／Trust Tier・Independent Source・Verified Promotion評価／Trust Tier優先Selection+Category Coverage／Cost Tracker接続／Completion Gap Review／Verified Promotion Application設計+実装／Final Regression／Formal Release）を正式採用。2段階Promotion方式（batch全体＋既存正本を固定母集団として全candidate分先に判定確定・処理順非依存）でTrust Tier×Independent Source×claimType条件を満たしたWeb EvidenceのみverifiedへPromotion。Cost Trackerがローカルgate用state（`cost-logs.json`）とSupabase実績正本（`api_cost_events`）の二層構造であることを正式記録し「Historical Cost Lost」表現を「Local Cost Gate State Historical Values Lost」へ訂正（Supabase側実費は無傷）。EEA-11実機検証（QA専用case`case-msoplrg6gdkr`・承認済み3クエリのみ）でverified Evidence5件・独立3件・`resolveIadpEvidence()`が既存Gate無改修で`sufficient`到達・F5復元Complete。Account Creation Readinessは`conditional`（Evidence起因ではなくuserApproval pending）。Search Planのquery数と実tool call数が`tool_choice:'auto'`により一致しない場合がある仕様を実測記録（3クエリ→実測6 tool calls）。Code commit **2cff922/7b84ed8/e22533c/8266f85/745cfaa/316b706**（EEA-2〜7）・**40ff550**（EEA-8）・**4bcf42e**（EEA-10B）。Tier3/Tier6 allowlist・monetization mapping・Category Coverage Gate化は改善候補、Auto Task接続・Researcher直接統合は将来機能として保留。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。次工程はInstagram実運用またはPhase55判断（ユーザー承認後）。詳細はDecision101参照。以前: 2026-08-12（**IADP / LFS Navigation & Scroll Usability Improvement 正式リリースComplete・Decision100**。Code commit **0309086**（`feat: improve IADP and LFS navigation usability`・`index.html`のみ・+99/-11）。①IADP→LFS直接ジャンプ（「↓ Leader Final Summaryへ」追加）②LFS→IADP直接ジャンプ（「↑ Instagram Account Design Packageへ」追加・既存`_lfsScrollToDetails()`再利用）③チャット上端/下端固定ジャンプ（`#chat-scroll-nav`）④`#chat-area`スクロールバー操作性改善（幅6px→14px・track/thumbコントラスト強化・Windows既定矢印ボタン非表示化）⑤スクロールバー不具合の根本原因修正——実機確認で「太く表示しても一部分しかドラッグできない」症状が判明し、`document.elementFromPoint()`のピクセル単位スイープ調査で特定：既存の`id="knowledge-panel"`重複バグ（📚ナレッジエンジン用・🧠顧客記憶パネル用の2つのDOM要素が同一ID、CSSも同一セレクタで2ブロック重複）により、ナレッジエンジン側の「閉」状態（`transform:translateX(100%)`）が顧客記憶パネル側の`right:12px;width:380px`に汚染され画面外へ完全退避できず、右端に約12px幅の帯が常時残留して`#chat-area`のスクロールバー帯（約15px）の大半を`position:fixed;z-index:300;pointer-events:auto`で覆っていた。**Edge/Chromiumのネイティブスクロールバー仕様が原因でないことを実測で確認済み**（カスタムドラッグハンドルは不要と判断・未実装）。最小修正として衝突IDの片方（顧客記憶パネル側）のみ`company-memory-panel`へ改名（CSS2箇所・HTML1箇所・JS1箇所）。ナレッジエンジン側は無変更。副次効果として、従来`getElementById('knowledge-panel')`がDOM順で常にナレッジエンジン側を返すため一度も正しく開閉できていなかった顧客記憶パネル（🧠会社知識数）が、今回初めて正しく開閉できるようになった。Cross-case安全性（IADPなし案件で残留0件・他案件への誤ジャンプなし・再描画後も固定DOM参照なしで正常動作）実測確認済み。ユーザーのWindows/Edge実機でIADP⇄LFSジャンプ・↑/↓端ジャンプ・スクロールバー中央ドラッグを含め全項目正常動作を確認済み（Complete）。Console Error 0・dev-check 200/200/200・`git diff --check` CLEAN・実AI実行0回・追加API費用0円。IADP契約・LFS契約・Evidence判定・Quality Gate・Reviewer・Strategy・adoptionDecision・User Approval・Output Draft保存契約・Researcher・Analyst・DB・schema・APIはすべて無変更。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。**Git：docs commit・Annotated Tag・main push・tag push・Render反映・本番確認は本Decision100記録後に実施**。次工程はExternal Evidence Acquisition（設計調査完了・未実装。Researcherは現状Web検索能力を持たずLLM内部知識のみで市場・競合調査を行っており、Evidence正本`outputDraft.fields.intelligenceContext.evidence[]`はAffiliate Evaluation手入力経路からのみ生成される。推奨構成は薄いEvidence Acquisition Adapter。今回はExternal Evidence機能の実装は行っていない）。詳細はdocs/04DECISIONS.md Decision100参照。以前: 2026-08-11（**IADP Post-Release Hotfix / Hotfix-Quality / Stability Hotfix 正式リリースComplete・Decision099**。Decision098（IG-2J-A〜I）後の実運用確認でIADP生成物の構造・品質不備（①JSON末尾`}`不足②finalProfile誤配置③adoptionDecision誤配置④KPI5がnull⑤first30DaysOperatingPolicyが配列）が判明し、Post-Release Hotfix（Code commit **585360c**＝Leader Final構造安定化・SSOT維持・IADP保存/表示・生JSON汚染防止・F5復元・Cross-case独立性・User Approval pending維持・AI Action/User Input境界維持）→Hotfix-Quality（Code commit **4b92f0d**＝顔出しなし・本人音声なし方針／KPI5項目／KPI改善条件／6リスク／リスク回避策／first30DaysOperatingPolicy／Reviewer指摘のLeader自律補完を強化）→Stability Hotfix（Code commit **936cd77**＝Leader Final Prompt出力安定化＋決定論的JSON Recovery`IADP_MAX_SYNTHETIC_CLOSERS=2`＋finalProfile/adoptionDecision誤配置救済）の3工程で解消した。専用新規テスト案件`case-msoplrg6gdkr`での実AI再検証（費用¥52.62・上限¥100以内）で前回FAILの5件すべて解消を確認：JSON parse成功・synthetic closer recovery不発動（Leader自身が正常JSON生成）／finalProfile・adoptionDecisionとも正位置／KPI5全項目number型（保存率15・プロフィール遷移8・フォロー率3・CTR4・CVR5）／first30DaysOperatingPolicyがstring型。Reviewer Passed／Strategy Accepted／Quality Gate Passed／User Approval Pending／Output Draft汚染なし／F5復元一致／Cross-case独立性維持（実案件3件・既存テスト案件2件をバイト単位で無傷確認）／Console Error 0／dev-check 200/200/200。**今回の結果はAccount Creation = Not Ready（Evidence Insufficient：確認済み0件・AI仮説9件）であり、これはFAILではなく構造充足100点でもEvidence不足ならReadyへ進めないDecision097 Ready正式条件が正常に機能した結果**（Decision097の判定契約は変更なし）。実AI dispatchは2回発生（1回目はAuto Task自動開始OFFのためLeaderチャット応答のみで終了・AI社員Workflow未実行。2回目でAuto Task一時ONにより全工程完走）。**成果物を生成した完全なAI社員Workflow実行は1回のみ**。1回目dispatchの残置pending Task 12件（`case-msoplrg6gdkr`配下）はDB直接削除禁止のためKnown Test Dataとして残置。過去引継ぎの実案件「4件」表記は今回実測3件（`case-msnarlxcjd13`／`case-mslvxioehypa`／`case-mshmumd8l93j`、3件ともバイト単位無傷）と異なることを記録する。KPI改善条件の判定期間記述が弱い点は軽微な残課題として将来へ記録し、今回の追加Hotfix・追加実AI実行は行わない。billingLockはON復帰済み・Auto Task自動開始はOFF復帰済み（F5後も維持を確認）。**server.js／DB／supabase/schema.sql／API契約は全工程で無変更・新規API/新規DBカラム/新Engineなし**。**Version1 Final Complete／Version1.1開発中は変更なし・Phase54 Complete維持・Phase55未着手**。**Git：docs commit・Annotated Tag・main push・tag push・Render反映・本番確認は本Decision099記録後にユーザー確認を経て別途実施**（未実施）。詳細はdocs/04DECISIONS.md Decision099参照。以前: 2026-08-10（**Phase IG-2J-A〜I Instagram Account Design Self-Completion / AI Action Rerun 正式リリースComplete**＝Decision097（IG-2F〜IG-2I）後の実運用確認で判明した9つのUX・品質問題（逆質問だけで停止／結論が見づらい／確認事項の分散／採用案不一致／構造99点と実運用品質の混同／Evidence不足でも完成に見える／生JSON残存／AI会社で決められる事までユーザーへ質問／自律処理不足）を、IG-2J-A〜Hの8工程で解消し、IG-2J-Iの最終統合検証を経てDecision098として統合正式採用した。**IG-2J-A**＝Self-Completion Mode（4担当が情報不足でも逆質問だけで停止せず事実／AI仮説／外部確認待ち／User Input Requiredを分離して成果物を返す。数値の捏造は禁止。通常WorkflowのSystem Promptは完全同一文字列を維持。Code commit **d95f196**）。**IG-2J-B**＝Leader Final Summary（チャット最新位置へ実運用可否/採用候補/採用理由/構造充足/Evidence/内容品質/Reviewer/Strategy/Quality Gate/Approvalを要約表示。既存カード・ELR・Leader Final本文は削除せず維持。構造充足99%と実運用品質を明確に分離。Code commit **7a33296**）。**IG-2J-C**＝AI Action / User Input分離（reason code＋決定論的分類でaiActions/userInputsへ正式分離。ターゲット・ジャンル・投稿頻度・KPI等はAI会社が決めユーザーへ質問しない。Code commit **244cad2**）。**IG-2J-D**＝採用案Single Source of Truth（正本を`intelligence.adoptionDecision.adoptedCandidateId`へ統一。**総合点1位を自動採用しない**。比較表は表示時のみ正本へ整合し保存副作用なし。Final Profile不一致は文字列補正せず安全側Not Ready。Code commit **144b0ff**）。**IG-2J-E**＝Intelligence実数値の担当指示注入（既存`fields.intelligenceContext`を4担当の指示文へ注入。Fact/Prediction/Unknownを分離し裏付けEvidenceのない数値は必ずPrediction。新Engine/新DB/新APIなし。Code commit **fa91cae**）。**IG-2J-F**＝Evidence正本接続（正本を`fields.intelligenceContext.evidence[]`へ接続。Verified/Derived/Unknownを分離し派生・推定を検証済み件数へ算入しない。fieldStatusはlegacy fallbackとして維持。Code commit **d7d21dd**）。**IG-2J-G**＝成果物正規化（reply wrapperとjson fenceの構造ノイズのみ除去。通常文章・一般コードブロック・正式構造JSONは不変。原文は`task.rawResult`へ保持。Code commit **7ff4140**）。**IG-2J-H**＝AI Action自律再実行接続（Summaryからユーザーが1回開始すると必要担当だけを既存Auto Task経路で再実行→Reviewer→Strategy→Leader Final→IADP再評価まで完走。新Workflow Engineなし。自動起動なし／二重実行防止／案件3回・code2回の上限／Cross-case guard／stale QG guard／Approval自動承認なし。Code commit **f845db0**）。**IG-2J-I**＝最終統合検証（回帰**441項目全PASS**・**実AI End-to-End 1回PASS**・API追加費用**約¥30**・実案件書き込み0件・テストデータ**remaining=0**・Console Error 0・dev-check 200/200/200）。**server.js／DB／supabase/schema.sql／API契約は全工程で無変更**。**Annotated Tag v1.01-instagram-account-design-self-complete・main push（540411e..32b0821）・tag push・Render反映・PC本番確認・iPhone Portrait実機確認すべて完了**（docs commit 32b0821／iPhone LandscapeはKnown Issue継続）。**Phase54 Complete維持・Phase55未着手**。次工程＝Instagram実運用準備／実運用開始。以前: 2026-08-09（**Phase IG-2F〜IG-2H IADP Quality / Approval / Quality Signals 正式採用（正式リリース・Decision097）**＝IADPがComplete/100点/Readyと誤表示される問題（Evidence 0件・担当成果物不足・Leader統合回答なしでも100点）をIG-2F〜IG-2Hの3工程で解消し統合正式リリースした。**IG-2F**＝判定を構造検証／内容品質／Evidence／Readiness／User Approvalの5軸へ分離する`assessInstagramAccountDesignPackage()`を追加（既存評価関数は無変更で内部再利用＝後方互換）。Evidence 0件・担当成果物不足（error/skipped/空/逆質問スタブ）・Leader統合回答不足をComplete化禁止、旧IADPは`not_evaluated`（legacy）で自動Complete化せず、Summary UIの潰れ（約26px）を`flex-shrink:0`／`overflow:visible`で解消（Code commit **b5a3d5e**）。**IG-2G**＝User Approvalを`fields.iadp.approval`へ永続化し**caseId＋packageId一致時のみapproved**、新IADP生成で旧承認無効化、承認後は同一操作内でReady再評価・再描画（F5不要）（Code commit **18fc04b**）。**IG-2H**＝Reviewer／Strategy／Quality Gateを正式接続。**新しい独立判定基盤は作らず既存判定を再利用**し、Quality Gateは既存正本`inbox.qualityGate`を読むのみで再実行なし、Reviewer／Strategyは既存`data.results`から多シグナル導出（**単純キーワードだけでfailed判定しない**・既知バグの`LI_REVIEWER_REJECTION_KEYWORDS`は流用しない）。既存Workflow順は変更せず`_liCollectIntegration()`直後の`_iadpRefreshAfterIntegration()`でQuality Gate確定後に後から再評価し、`fields.iadp.assessmentContext`へsnapshot保存・packageId一致検証（Code commit **4dd0400**）。**Ready正式条件**＝構造Passed＋内容Complete＋Evidence非Insufficient＋Reviewer重大不足なし＋Strategy再設計要求なし＋Quality Gate Passed＋Leader統合回答あり＋必須担当成果物あり＋User Approval Approvedの全充足（承認だけで品質不足を上書きしない）。**Path B**は`qualityGate===null`のためComplete/Readyへ到達しない安全側仕様として正式容認（正式経路はPath A Auto Task）。**Background Execution**はVersion1.1後半の大型工程として方針のみ記録（未実装・品質判断が安定する前にBackground化しない）。**Known Issue**＝Reviewer NG keyword partial-match issueを追加記録（IADP側は回避済み・本体修正は後続）。**データ保全ルール**＝実案件の`fields.iadp`変更時は backup→test→restore→restore確認 を必須とし原則専用テスト案件を使用（IG-2G/2Hは専用テスト案件・実案件書き込みゼロ）。**index.html／shared/instagramAccountDesignQuality.jsのみ変更・server.js/DB/schema.sql/API契約は無変更**。dev-check 200/200/200・Console Error 0・実AI追加実行なし。tag **v1.01-instagram-account-design-quality-ready**・push・Render反映・**PC本番確認 完了**・**iPhone実機確認 完了（2026-08-09・ユーザー実施：縦画面Complete＝本番表示/ログイン/Leader/案件表示/メニュー操作正常・白画面なし・無限ロードなし。横画面はDecision096記録のLandscape Responsive未対応Known Issueが継続・未修正＝左サイドバーとメイン領域の占有が大きくメニュー表示時も画面の大部分が覆われ実用上ほぼ使用できない状態。IG-2I実装による新規不具合ではないため正式リリース判定には影響させず後続のResponsive対応工程として管理）**。**Phase IG-2F〜IG-2I 正式リリースComplete**。**Phase54 Complete維持・Phase55未着手**。次工程＝Instagram実運用（未着手・実AI費用はユーザー承認後）／iPhone Landscape Responsive対応（独立工程）。以前: 2026-08-06（**Phase IG-2E Instagram Account Design Package Output Draft Integration 正式採用（Decision096）**＝IADPを既存Output Draft永続化へ正式接続した。①保存＝IADP検証成功時に`fields.iadp`へ格納し既存`pushOutputDraftToServer()`／`POST /api/output-drafts`を利用。②復元＝新設`_iadpApplyRestoredFields()`が`restoreOutputDraftFromServer()`（起動時／案件切替時）の復元結果からIADPセッションキャッシュを同期しIADPカードを自動再表示・案件に保存Draftが無ければ確実にクリア。③1 Case 1 正本＝`createOutputDraft()`実行直前に既存`fields.iadp`を退避し新Draftへ引き継ぎ、同一案件内で他Auto Taskを実行しても消えないようにした。IG-2D（実AI検証・IADP構造化JSON品質調整。openaiClient.jsの実例JSON追加・max_output_tokens 8192化・末尾カンマ耐性parse・genreId→genreName逆引き表示。Code commit **ecfed0c**）に続くIG-2E（Code commit **0fb943e**）。**index.htmlのみ変更**（`server.js`/`shared/instagramAccountDesign.js`/`shared/leaderRuleEngine.js`/`supabase/schema.sql`無変更・新規API/DBカラムなし）。既存案件を利用し実AI追加実行なしでブラウザJS経由の保存・F5復元・案件切替・cross-case guard・後方互換をlocalhost・Render本番PCの両方で実測確認（Console Error 0・検証後は原状復帰）。docs commit（**d36de10**）・Annotated Tag **v1.01-instagram-account-design-output-draft**・main push・Render反映・**PC本番確認・iPhone実機確認 完了（ユーザー実施）**。**IG-2D／IG-2E 正式リリースComplete**。iPhone確認で今回の実装とは独立の**Known Issue 2件**（①案件を開いた直後チャット履歴が一瞬消えAuto Task実行で復帰＝再描画競合の疑い、②iPhone Landscapeでレイアウト崩れ＝Responsive対応要）を発見・後続工程へ記録。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Known Issue①②の対応／Path B／Content Planning／Carousel Builder／Publishing Readyの実動作回帰確認（未着手・ユーザー承認後）。以前: 2026-08-06（**Phase B-9F 共通Leader Rule Engine 正式リリース（Phase B-9C〜B-9F統合・Decision095）**＝Leader統合回答プロンプト改善（B-9C）と、事実整理専用の共通Leader Rule Engine（`shared/leaderRuleEngine.js`）の新規実装・Path A/Path B/手動Leader再生成3経路接続（B-9D-1〜5A）・統合検証（B-9E前半静的53アサーション全PASS・後半実API3経路検証）を正式リリースした。Code commit：92cc49a/d194ba1/0bd3a88/756d867/22ca87c。Reviewer/Strategyはmain件数除外・Prompt Block単一挿入・fail-open・Injection耐性を維持。実API検証費用約¥32.38（承認上限¥100以内）。**server.js/DB/schema.sql/API契約は既存互換**。**Phase54 Complete維持・Phase55未着手**。次工程候補＝意味的重複/矛盾検出の実装検討・Completion Gate調査（未着手・ユーザー承認後）。以前: 2026-08-05（**Phase B-9B Leader統合回答・会社正式回答責務 正式採用（Decision094・docs正式化のみ）**＝Leader統合回答（Path A `LEADER_FINAL_PROMPT`／Path B `leaderSummary()`が生成する最終回答テキスト）の責務を正式化した。用語分離（「Leader Summary（ELR表示）」＝Phase B-8までに完成済みの事後表示セクション／「Leader統合回答」＝今回の対象）・会社として唯一の正式回答・AI社員回答は社内検討資料（既存表示は削除しない）・LeaderはCEO相当の最終統合責任者・要約ではなく統合・成果物ファースト・情報不足の最終判断はLeaderに帰属・Gate系との責務分離・既存Leader Integration Layerを将来構造化JSONで接続する方針・Path A/Bの構造差を正式記録。**今回はdocs正式化のみでコード・プロンプト・DB・API変更は一切なし**。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-9C（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-04（**Phase B-8 Quality Gate Executive Leader Report表示 正式Complete（Phase B-8A〜B-8D統合・正式リリース）**＝Phase B-7で正式採用したQuality Gate結果（`inbox.qualityGate`）をExecutive Leader Report内へ表示専用セクションとして追加した（Decision093）。新設`_elrBuildQualityGateHtml(qualityGate)`（純粋関数・グローバル非参照・不正データ時は空文字列）を`_elrBuildReportHtml()`内で呼び出し、既存シグネチャは変更しない。表示位置はExecutive Summary→Constitution Structure Check→Quality Gate→Leader Summaryの順。通過時「🟢 Passed（complete＝完成／almost_ready＝ほぼ完成）」・非通過時「🟡 Not Passed（needs_work＝要改善／insufficient＝情報不足）」を表示し`score`は非表示。固定注記「現在のQuality Gateは成果物品質の初期判定（表示のみ）です。Executive Decision・Output Draft保存は制御しません。」を常設。表示対象はPath A・手動Leader再生成のみでPath B（`inbox.qualityGate===null`）は完全非表示。既存`_elrRefreshInChatArea()`・Cross-case判定はそのまま再利用。Quality Gate結果はセッション内保持のみでF5後は`_leaderIntegration`／`_executiveDecision`／`_constitutionValidation`とともに消失（永続化・F5復元は未実装）。Phase B-8A（調査・設計）→B-8B（表示実装・Code commit **04bf9c1**）→B-8C（Path A=`sourceMode:'auto_task'`・Quality Gate=Not Passed（`needs_work`）・Output Draft保存1回・ELR/Quality Gateとも1件を実測。手動再生成=新規decisionId発行・再評価正常。Path B=`inbox.qualityGate===null`・Quality Gateセクション完全非表示を実測。Cross-case誤表示なし・F5後消失・Console Error 0・Network全200）→B-8D（正式リリース）の4段階で完成。**server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Quality Gate監査Version保存／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-04（**Phase B-7 Quality Gate 正式Complete（Phase B-7D〜B-7H統合・正式リリース）**＝Output Package Quality（`packageQuality`）を正本入力・単軸とするQuality Gateを正式採用した（Decision092）。`packageQuality.status === 'complete'`または`'almost_ready'`の場合のみ通過（`passed:true`）、それ以外（`needs_work`／`insufficient`／未知値／不正入力）はすべて非通過とし、`score`・数値thresholdは判定に使用しない。Phase B-7D（`buildOutputDraftFromLeaderFinal(finalText, opts, targetDraft)`へ第3引数`targetDraft`を追加しfields構築対象のみを引数化・省略時は`_lastOutputDraft`使用で既存呼び出し2箇所は完全後方互換・Code commit **f866d4d**）、Phase B-7E（`_lastOutputDraft`とは独立したcandidate Draft`{type,fields:{}}`を`_liCollectIntegration()`内`_edRunDecisionEngine()`直前で生成し`candidateOnly:true`早期returnでfields構築とpackageQuality算出のみを行い保存を伴わない・評価結果を`inbox.qualityGate`へ格納・Code commit **0f104d3**）、Phase B-7F（`evaluateQualityGate(packageQuality)`へ実判定ロジックを実装し`{executed:true,passed,status:'passed'|'failed',sourceStatus}`を返す・Code commit **1a92884**）の3段階で実装。Phase B-7G統合検証（index.htmlから実装コードを直接抽出した合成テスト14/14 PASS・Path A/手動再生成/Path Bの3経路実APIテストで因果順序を実測確認・コード変更なし）でPhase B-7H正式リリースへの進行可能性を確認。**Path Bは正式に対象外**（Output Draft候補生成契約が存在しないため`inbox.qualityGate===null`が正常仕様・Decision087の「Path B＝Output Draft制御対象外」を継承）。Quality Gate結果は現段階ではセッション内保持のみで、Executive Decision・Approved Decision Package・Constitution Gate・Output Draft保存・`OUTPUT_STATUS`のいずれも変更しない。Phase B-7H（正式リリース）でdocs更新・commit・Annotated Tag **v1.01-executive-quality-gate**・main push・Render反映・PC/iPhone本番確認まで完了。**server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Quality Gate監査Version保存／Decision Ledger／Quality Gate UI・Executive Leader Report表示／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-03（**Phase B-6 Constitution Gate 正式Complete（Phase B-6A〜B-6D統合・正式リリース）**＝Constitution Structure Check正式採用（Phase B-5C・Decision090）で表示のみだったConstitution Validator Coreの検証結果を、Approved Decision Packageの複製可否判定（Path A `atRunWorkflow()`／手動Leader再生成`atTriggerLeaderFinal()`それぞれの`fields.approvedDecisionPackage`受け渡し条件）へ「狭域Constitution Gate」として接続した（Decision091）。既存の`sourceDecisionId`一致・`caseId`一致に加え、`_constitutionValidation`存在／decisionId一致／caseId一致／`result.passed===true`の4条件をANDで追加し、いずれか不成立時は既存どおりfail-closed（nullのまま・例外なし）とした（Phase B-6B実装・Code commit **9436fec**・`index.htmlのみ+20/-2`・Path A/手動Leader再生成の2箇所に限定）。Validator本体・Executive Decision Engine本体・Package生成ロジック・Output Draft本文は無変更。Phase B-6A（調査・設計）で広域Gate案（Decision生成自体への組み込み）・狭域Gate案を比較検討し、既存Workflow保護原則（第14条）の観点から狭域案を正式採用。Phase B-6C実APIテスト（既存テスト案件を再利用・低コストプロンプトでAuto Task1回・手動Leader再生成1回・Path B dispatch1回を実施）で3経路とも正常完了・Executive Leader Report生成・Constitution Structure Check Passed（12/12）・Console Error 0・Network全リクエスト200 OKを確認。3経路とも`decisionStatus`は`hold`のため`approvedDecisionPackage`は常に`null`であり、Gate追加が既存正常系動作へ副作用を与えないことを実測確認済み。Phase B-6D（正式リリース）でdocs更新・commit・Annotated Tag **v1.01-executive-constitution-gate**・main push・Render反映まで完了。**server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-03（**Phase B-5C Constitution Structure Check 正式Complete（Phase B-5C-1〜B-5C-3統合・正式リリース）**＝Constitution Validator Core（Phase B-5・Decision089）の検証結果を、Executive Leader Report内の独立セクション「Constitution Structure Check」として表示し、Auto Task・手動Leader再生成・Path B（dispatch成立時）の完了直後に即時反映される状態まで完成した（Decision090）。Phase B-5C-1で`_constitutionValidation`を`{decisionId, caseId, result}`のセッション内対応契約へ変更（Validator戻り値・12検証項目は無変更・Code commit **a2834d3**）。Phase B-5C-2で`_elrBuildReportHtml(decision, inbox, validation)`へ第3引数を追加し、Executive Summary直後・Leader Summary直前へ独立表示：Passed時は動的算出した「Passed（N/N）」1行のみ、Violations時は`message`常時表示・`rule`は技術詳細折りたたみ内のみ、固定注記常設、状態4軸（decisionStatus／constitutionValidation.passed／OUTPUT_STATUS／packageQuality.status）を混同しない設計・不正データでも例外なしの安全側正規化・既存`escapeHtml`再利用（Code commit **9e6d094**）。Phase B-5C-3で`_elrRenderIntoChatArea()`の挿入方式を`insertBefore`化し、新設`_elrRefreshInChatArea()`（チャット全体を再構築しない限定更新）をPath A・手動再生成・Path B（dispatch成立時のみ）へ接続。**設計上の重要な発見**：Path Bは`.leader-summary-block`という専用DOM直接追記スタイルを使用しており、既存`reRenderChatArea()`（チャット全体再構築）をそのまま使うとこのスタイルが失われることが判明したため、限定更新方式を新設して採用した（Code commit **58315ee**）。実APIテスト（Auto Task1回・手動再生成1回・Path B dispatch1回・低コストプロンプト・既存テスト案件再利用・実測概算¥12）で3経路とも追加のページ操作なしに即時反映を確認、dispatchなし時は無反応・Cross-case・F5リセット・Output Draft/Output Engine無変更・Console Error 0を確認。**Executive Constitution全14条の完全な意味論的検証・Quality Gate・Completion Gate・Decision Ledger・Executive Memoryはいずれも未実装**。**Code commit ea1ae68（B-5 Core）＋a2834d3（B-5C-1）＋9e6d094（B-5C-2）＋58315ee（B-5C-3）**。**server.js/lib/DB/schema.sql/API無変更**。Decision 090・**Phase54 Complete維持・Phase55未着手**。次工程候補＝Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-03（**Phase B-5 Constitution Validator Core 正式Complete**＝Approved Decision Package契約構造正式実装（Phase B-4・正式Complete・維持）の次工程として、Executive Decision Engineが確定させたDecision（Approved Decision Package内包）をExecutive Constitutionに照らして検証する読み取り専用の`validateExecutiveDecision(decision)`を追加（Decision089）。Decision・Package・Output Draftはいずれも書き換えず、判定結果`{version, passed, violations, checkedRules}`のみを`_constitutionValidation`へセッション内保持（F5で消失・永続化なし）。検証対象は`executive_decision_exists`／`decision_id_present`／`decision_status_present`／`executive_summary_present`／`decision_confidence_present`／`source_decision_id_consistency`／`package_only_when_approved`／`package_null_when_not_approved`／`output_draft_did_not_generate_package`（既存`affectsOutputDraft===false`参照）／`package_holds_source_decision_id`／`cross_case_consistency`／`single_decision_authority`の12項目（構造整合性検証のみ）。呼び出しは`_edRunDecisionEngine()`内`_executiveDecision`確定直後（Decision生成→確定→Validator実行→`_constitutionValidation`保持→既存後続処理の順で固定）。Node合成テスト13シナリオ26アサーション全PASS。実APIテスト（Auto Task1回＋手動Leader再生成1回・低コストプロンプト・既存テスト案件再利用）でPath A（`decisionId: ed-mscq548ee05g`・`sourceMode:'auto_task'`）・手動再生成（`decisionId: ed-mscq6pcrymzi`・`sourceMode:'manual_regeneration'`）とも`passed:true・violations:[]・checkedRules12件`を実測。Path B直接チャットではdispatchが発生せず`_liCollectIntegration('pathB',...)`は起動しなかった（既存仕様どおり・異常ではない）が、コード確認でdispatch発生時は同一Validator経路（`_liCollectIntegration()→_edRunDecisionEngine()→validateExecutiveDecision()`）を通ることを確認済み。Executive Leader Report・Output Draft（`status:'ready'`・`packageQuality.score:71`・`fields.approvedDecisionPackage`キー不在を維持）・Output Engine・F5復元（`_executiveDecision`/`_constitutionValidation`ともnullへリセット）・案件切替いずれも既存挙動を維持。Console Error 0・Network 200のみ・実API概算¥13。**Executive Constitution全14条の完全な意味論的検証・Evidence内容の十分性判定・成果物品質/完成度の実質評価・Constitution違反によるOutput停止・Validator結果のUI表示・Quality Gate・Completion Gate・Decision Ledger・Executive Memoryはいずれも未実装（「全14条完全実装」ではない）**。**Code commit ea1ae68**（`feat: add executive constitution validator`・index.htmlのみ+122/-1）。**server.js/lib/DB/schema.sql/API/UI（Executive Leader Report・AI社員カード期限表示含む）無変更**。Decision 089・tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Validator結果のExecutive Leader Report表示／Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・特定の1つを自動確定せず、正式な次工程はユーザー承認後に決定）。以前: 2026-08-03（**Phase B-4 Approved Decision Package 契約構造正式実装・統合検証正式Complete（Phase B-4A〜B-4E）**＝Executive Decision Engineが会社判断イベントを表す`decisionId`をdecisionStatusに関わらず必ず1回発行（Phase B-4A）。Approved Decision Packageは独自ID発行を廃し`sourceDecisionId`で元Decisionを参照する派生契約として確定（Approved時のみ生成）。Path A通常フロー（Phase B-4B）・手動Leader再生成（Phase B-4C・専用変数で誤流用防止）の両経路から`buildOutputDraftFromLeaderFinal()`へPackageを受け渡し、caseId・sourceDecisionId不一致時は安全にnullへ破棄。Phase B-4Dで`fields.approvedDecisionPackage`へ複製保存（Packageなし時はキー削除・残留防止）。所有関係はExecutive Decision Engineが正本・Output Draft側は複製（将来Decision Ledgerが永続正本）。Phase B-4Eで13項目の合成テスト全PASS・実APIテスト（Auto Task1回＋手動再生成1回でdecisionId相違・fields保存・F5復元・Cross-case・Console Error0・Network200のみを実測）を実施し、`buildOutputDraftFromLeaderFinal()`冒頭の古いコメント不整合のみを発見・コメントのみ修正（commit b423acd・ロジック変更なし）。**Phase B-4 Approved Decision Package 正式Complete**と判定。**Code commit 718f200＋67ab6cb＋95beda3＋65fe551＋b423acd**。**server.js/lib/DB/schema.sql/API/UI（AI社員カード期限表示含む・本工程では変更なし）無変更**。Decision 088・tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-5 Constitution Validator（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-02（**Phase B-2 Executive Decision Control 正式工程分割（Phase B-2A／B-2B）・docs正式化のみ**＝Executive Decision Engine Core（Phase B-1・正式Complete維持）の次工程着手前に因果接続方式を調査。Path A通常フロー（`atRunWorkflow`）はAI社員実行〜Leader Final生成（`runLeaderFinalResponse()`）がサーバー側単一HTTPリクエスト内で完結し、クライアント側EDEはLeader Final生成前のデータへ介入できない構造的制約を実測確認。Leader Final候補生成後・Output Draft確定前にEDEを接続する段階導入方式（案D）を正式採用し、既存Phase B-2を**Phase B-2A（Path A通常フローの因果位置確立・対象はatRunWorkflow()のみ）**と**Phase B-2B（手動Leader再生成の整合化・対象はatTriggerLeaderFinal()）**へ正式分割（Decision087）。手動Leader再生成（`atTriggerLeaderFinal()`）が完成成果物エンジンではなく軽量な`leaderSummary()`を使用し、EDE入力（`_wlLastResults`）が前回Auto Task時点のスナップショットのまま今回生成結果と紐づいていないことを実測発見したためB-2Bとして分離。Path B通常チャットはOutput Draft生成自体が存在しないためOutput Draft制御対象外のまま維持。Leader Final Candidate内部契約（`sourceEngine:'runLeaderFinalResponse'|'leaderSummary'`で区別・`candidateArtifacts`とは別フィールド）・Quality/Completion Gate未定義期間はdecisionStatusをapprovedへ到達させない方針（Auto Task・既存Leader Final・既存Output Draftは従来どおり継続）・追加AI実行なしを正式決定。ロードマップをPhase B-1（Complete維持）→**B-2A→B-2B**→B-3（Executive Leader Report・旧B-2相当）→B-4（Approved Decision Package・旧B-3相当）→B-5（Constitution Validator・旧B-4相当）→A-2〜A-4→C-1〜C-3→D-safety→D→E→F-1〜F-2へ改訂。今回は**docs正式化のみでコード・DB・API・UI変更は一切なし**。tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-2A（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-02（**Phase A-1g Executive Constitution v1.0.0 正式化・docs正式化のみ**＝Leader Integration Layer Phase A（Decision084/085）正式Complete後、次工程着手前にAI COMPANY全体の上位アーキテクチャを正式設計。**Executive Constitution v1.0.0**（全14条・AI COMPANY最高位ルール）と**Executive Decision Engine**（既存`_leaderIntegration`／Leader Inboxを因果連鎖内へ昇格させる会社判断層。新規独立Engineではない）を正式採用（Decision086）。`_leaderIntegration`は現時点では成果物確定後の事後観測層であり、Leader Final生成・Output Draft確定・Output Engine入力にはまだ接続されていない（Phase Aの未完成ではなく、回収・構造化・候補判定までがPhase Aの正式責務）。Executive ReportとOutput Engine完成成果物（既存`LEADER_FINAL_PROMPT`）は置き換えず併存。状態3軸分離（decisionStatus新設・既存`OUTPUT_STATUS`/`packageQuality.status`は無変更）・Decision Confidence（既存`_intelCalculateConfidence()`再利用＋Hard Gate・新加重式は発明しない）・Strategic Alternatives（Primary1/Secondary2/Hold3）・Approved Decision Package（後方互換必須）・保存方式（段階導入案D・`output_drafts`はPRIMARY KEY`output_id`のupsert上書き方式のためDecision Ledger正本として使用しない）を正式決定。正式ロードマップをPhase A-1g→**Phase B-1〜B-4**（Executive Decision Engine Core／Executive Leader Report表示／Approved Decision Package契約化／Constitution Validator）→Phase A-2〜A-4（順序変更・内容無変更）→**Phase C-1〜C-3**→D-safety→D→E→**Phase F-1〜F-2**（Executive Memoryは最後段）へ改訂。今回は**docs正式化のみでコード・DB・API・UI変更は一切なし**。tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-1 Executive Decision Engine Core（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-01（**AI COMPANY Leader Integration Layer（Phase A）後半 正式リリースComplete**＝Phase A本体（Decision084）に続き3工程を正式リリース。**工程1・messages案件別正本化**：`server.js`の`/api/auto-task`（user/assistant保存）・`/api/consult`（user/assistant保存）計4箇所の`saveMessage()`呼び出しへ既存受領済みの`caseId`を追加（既存`/api/messages`と同一形式・API/DB無変更・Code commit **5401b68**）。**工程2・Leader Final状態サマリー分離**：`openaiClient.js`の`runLeaderFinalResponse()`で`completed`抽出条件は維持しつつ`error`/`skipped`（`!isPostProcess`）を状態サマリーとして分離しLeaderへ渡す（全員成功時は既存プロンプトと完全一致・error理由は1行80文字以内へ安全短文化・completed成果0件時は専用の安全側プロンプトへ分岐・Code commit **6032893**）。**工程3・統合検証**：正常系・一部成功・completed成果0件をlocalhost実DBで検証し、一部成功時にLeader Final固定出力フォーマットと状態サマリー指示が競合し独立セクション化されない問題、completed成果0件時にOutput Draftが`status:'ready'`・Package Quality87点「良好」評価のまま保存される誤認問題を実測発見。**工程3-2・誤認防止修正**：`index.html`の`buildOutputDraftFromLeaderFinal(finalText, opts)`へ`opts.noCompletedResults`を追加（`runLeaderFinalResponse()`の既存返却フィールド`integratedCount===0`で判定・返却形式は無変更）。`true`時は`_lastOutputDraft.status`を既存`OUTPUT_STATUS.ERROR`へ、`packageQuality`を`score:0・status:'insufficient'`へ固定。Leader Finalプロンプトへ「完成成果物出力後、必ず末尾に独立見出し『## 担当実行状況』を追加し他セクションと混在させない」指示を強化（`LEADER_FINAL_PROMPT`本体は無変更・Code commit **0d125e7**）。**再検証（3パターン）実測**：正常系＝Package Quality 71点needs_work（従来どおり）・状態サマリーなし。一部成功＝Leader Final末尾に独立見出し「## 担当実行状況」でBranding担当のスキップ理由（担当が無効に設定されているため）明記。completed成果0件＝Output Draft `status:'error'`・`packageQuality.score:0・status:'insufficient'`をDB実測確認。全パターンでCross-case混入なし・新規`case_id=NULL`なし・二重保存なし・Console Error 0・dev-check 200/200/200。error/skipped再現はlocalhost限定で`AGENT_WORKFLOW_CONFIG.enabled`を一時的にfalseへ変更し検証直後に完全復元（本番設定変更・永続コード差分なし）。**`index.html`＋`openaiClient.js`のみ**。**server.js（messages案件別正本化を除き）/DB/schema.sql/API 無変更**。Decision 085・tag **v1.01-leader-integration-phase-a-complete**・**main push・Render反映・PC本番確認 完了**（ユーザー実施：ログイン/Auto Task/Leader Integration Layer/AI社員振り分け/Leader Final/Output Engine/Task同期/案件切替すべて正常・Cross-case混入なし・Console Error/Network異常なし・iPhone実機確認は対象外）。**AI COMPANY Leader Integration Layer（Phase A）正式Complete**。**Phase54 Complete維持・Phase55未着手**。次工程＝未定（Phase A-2 AI社員間再依頼／Phase A-3 成果物受け渡し／Phase A-4 Quality Loopは設計のみ完了・実装未着手・着手にはユーザー承認が必要。またはmessages RLS対応・Task skipped同期ギャップ対応・F5復元時isLeaderFinalメタフラグ欠落等の残課題）。以前: 2026-07-31（**AI COMPANY Leader Integration Layer（Phase A）正式リリースComplete**＝LeaderをPath A（Auto Task）／Path B（Leader手動チャット）双方の成果物を回収・比較・矛盾候補検出・採否候補判定する統合管理層へ拡張。`_liCollectIntegration()`が各Pathの末尾（Leader Final受領直後／手動Leader Final再生成直後）から1回だけ呼ばれ、`_liAdaptPathA`（`_wlLastResults`ソース。`_atTaskHistory`は`agentId`/`result`欠落のため不採用と実測確認）／`_liAdaptPathB`（`interactionId`＋`_liPathBSession`でchatHistory非接触・過去回答混入防止）が既存データを共通Leader Inbox形式へ変換。保存はクライアント一時メモリ（`_leaderIntegration`）のみ・新DB/新API/追加AI実行なし。矛盾候補・採否候補は必ずcandidate/hold（安全側既定値）・finalSummary生成はPhase B以降。**実装過程で発見した既存不具合（案件切替後、手動Leader Final再生成`atTriggerLeaderFinal()`が古い案件のOutput Draftを別案件へ混入させ得る＝既存のOutput Draft復元保護ロジックPhase54-2dとの相互作用が原因）を同一リリースでHotfix**＝冒頭に`_liCurrentCaseId()`と`_liLastPathAResultsCaseId`の厳格一致ガードを追加し、不一致時は`/api/leader-summary`・chatHistory追加・Output Draft保存・次Task生成のいずれも行わず安全停止・再実行を案内（案件切替時のDOM一括クリアは不採用）。**実Supabase実機検証**：Hotfix適用前に実際の混入事故（診断用Output Draft`out_1785449189461`が検証専用案件`case-ms82952wltd5`から既存案件「テスト」（`case-ms7n2jqdt6t6`）へ移動）を確認し、既存POST経路（`/api/output-drafts`）で`case-ms82952wltd5`へ復旧。Supabase SQL Editorで該当1行を複合条件（`output_id`＋`case_id`）限定削除・検証専用案件（`case-ms83tudez570`／`case-ms8409r7thuw`）を削除。Hotfix適用後は別案件切替時の再現テストでAPI呼び出し0件・chatHistory追加0件・Draft移動なしを確認。「テスト」「Instagramアカウント設計」等の既存案件・`case_id: null`のLeader横断ログは無変更。JavaScript構文OK・`npm run dev-check` 200/200/200・`git diff --check`問題なし。**index.htmlのみ**（Phase A本体 Code commit **ad5eaf7** +336/-6／Hotfix Code commit **af43263** +11/-0）。**server.js/lib/DB/schema.sql/API/既存Path A・Path B内部処理/switchCase()/`.at-result-card`仕様/chatHistory構造/Output Draft保存仕様 無変更**。Decision 084・tag **v1.01-leader-integration-phase-a**（作成予定）・**main push・Render反映・PC本番確認・iPhone実機確認はこれから実施**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。次工程＝未定（Phase A-2 AI社員間再依頼／Phase A-3 成果物受け渡し／Phase A-4 Quality Loopは設計のみ完了・実装未着手・着手にはユーザー承認が必要）。以前: 2026-07-30（**Affiliate Intelligence Company 工程8-1/8-2/8-3A/8-3B/8-3B補正/8-3C Market Opportunity Intelligence 正式リリースComplete**＝ランキングカード・AIC最小パネル・Copy Full ReportへMarket Opportunity Intelligence表示追加（Competition直下）。`intelligenceContext.market`（既存受け皿）へ現在案件内の同一市場候補商材群を案件内集約（案C・`_aicNormalizeKeyPart`再利用・新規入力なし・外部データなし）で保存。共通ヘルパー`_intelSyncMarketGroupProductEvidence`（表示・保存の両方から共通利用）が市場内対象商材群の既存Product Evidenceへ`usedBy:'market'`を冪等追記（新規Evidence生成なし）。保存済み判定はmarketKey＋caseId一致（productIdentifierではない点が他5層と異なる）。★Market Confidenceは登録候補情報の根拠充足度を示すのみで、実検索数・実トレンド・市場規模・市場成長率・実需要は示さない。登録候補商材数（AI会社内の自社候補件数）とCompetitionの競合数（他社競合数）は文言上明確に区別。`INTEL_MARKET_MIN_PRODUCT_COUNT=2`未満は強制insufficient（1商材でも情報保持）。採用時に`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`＋`competition`＋`market`を同一Output Draftへ**七書き**し既存`pushOutputDraftToServer`を**1回**（**採用1回=POST1回維持・Market専用POSTなし**）。**工程8-3B補正**：derived集計（複数商材対象）とEvidence/Confidence母集団（当初は採用商材1件分のみ）の不整合を検証中に発見・共通ヘルパー新設で修正。**実Supabase検証（専用caseId `case-ms79vojuf7g1`・商材A `TEST_MARKET_PRODUCT_A_20260730`・商材B `TEST_MARKET_PRODUCT_B_20260730`・同一market）**：七書き保存確認・productCount=2・productIdentifiers2件・Evidence総数28件中22件が両商材にまたがる（母集団整合の実証）・derived集計値（想定利益合計23,840円/最大16,000円/平均11,920円・IG適性平均65・他社競合数平均10・案件寿命平均9ヶ月）が実値と完全一致・全7層の`confidence.calculatedAt`が同一ミリ秒台（単一トランザクション実証）・F5復元完全一致・案件切替混入なし・Copy Full Report順序確認（Leader→ASP→Content→Competition→Market→Ranking）。**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts・cases の3テーブルとも）**確認。純関数・UI・保存・補正テスト計115アサーション全PASS・node --check相当OK・dev-check 200/200/200・Console 0。**index.htmlのみ**（foundation Code commit **2de9317** +172/-0／ui Code commit **4ef70ca** +174/-0／persist Code commit **e61e7d5** +32/-0／fix Code commit **3b1e5b7** +28/-9）。**server.js/lib/DB/schema.sql/API/output_drafts定義/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue/ASP/Content/Competition Intelligence/ランキング順位/integratedScore/estimatedProfit式 無変更**。Decision 083・tag **v1.01-affiliate-market-opportunity-persistence**（作成予定）・**main push・Render反映・PC本番確認・iPhone実機確認はこれから実施**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。次工程＝未定（Market Opportunity完成によりVersion2 Core 7層のうち6層完成・残るは⑦Self Improvement Intelligenceのみ・Instagram実運用前のため着手判断は実績データ供給条件を再確認してから）。以前: 2026-07-29（**Affiliate Intelligence Company 工程7-1/7-2/7-3A/7-3B/7-3C Competition Intelligence 正式リリースComplete**＝ランキングカード・AIC最小パネル・Copy Full ReportへCompetition Intelligence表示追加（Content直下）。`intelligenceContext.competition`（新規モジュールキー・`INTEL_MODULE_KEYS`へ後方互換追加）へ競合環境3項目（競合数・案件寿命・IG適性＝competitors/lifespanMonths/igFit）をProduct Evidence共有参照で保存（新規Evidence生成なし・既存Product Evidenceに`usedBy:'competition'`冪等追記のみ）。未採用商材は使い捨てctxプレビュー（`_aicBuildCompetitionForRow`）・採用済み商材は保存済み`intelligenceContext.competition`を正本表示（💾・productIdentifier＋caseId一致・再計算しない）。★Competition Confidenceは競合環境を判断する根拠の充足度を示すのみで、競合の強弱・参入余地・売れやすさ・推奨可否は示さない（good/watch/insufficientはConfidence状態）。competitorsは生値のまま・激戦/普通/参入余地判定やCompetition Score等の新スコア/新閾値なし。採用時に`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`＋`competition`を同一Output Draftへ**六書き**し既存`pushOutputDraftToServer`を**1回**（**採用1回=POST1回維持・Competition専用POSTなし**）。**実Supabase検証（専用caseId `case-ms5zz5g65x1p`・productName `TEST_COMPETITION_PROD_20260729`・evaluationId 20）**：六書き保存確認・Evidence総数14件不変（product14/revenue9/asp4/content3/competition3・competition3件は評価登録時刻のまま＝新規生成0の共有参照を実証）・Competition Confidence Medium（64点・independent3件・knownFactors3/3・status watch）・F5復元完全一致・caseId分離確認・Copy Full Report順序（Product→Revenue→ASP→Content→Competition→Ranking）・**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts・cases の3テーブルとも）**確認。純関数23/23 PASS・node --check相当OK・dev-check 200/200/200・Console 0・白画面/無限ロード/横スクロールなし。**index.htmlのみ**（foundation Code commit **675b3d0** +107/-1／ui Code commit **3feec7b** +117/-0／wire Code commit **d941cfd** +28/-0）。**server.js/lib/DB/schema.sql/API/output_drafts定義/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue/ASP/Content Intelligence/ランキング順位/integratedScore/estimatedProfit式 無変更**。Decision 082・tag **v1.01-affiliate-competition-intelligence-persistence**（作成予定）・**main push・Render反映・PC本番確認・iPhone実機確認はこれから実施**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。次工程＝未定（Competition完成により残るIntelligence層＝Market Opportunity/Self Improvement等）。以前: 2026-07-29（**Affiliate Intelligence Company 工程6-1/6-2/6-3A/6-3B/6-3C Content Intelligence 正式リリースComplete**＝ランキングカード・AIC最小パネル・Copy Full ReportへContent Intelligence表示追加（ASP直下）。`intelligenceContext.content`へInstagram投稿適性3項目（保存率予測・クリック率予測・IG適性）をProduct Evidence共有参照で保存（新規Evidence生成なし・既存Product Evidenceに`usedBy:'content'`冪等追記のみ）。未採用商材は使い捨てctxプレビュー（`_aicBuildContentForRow`）・採用済み商材は保存済み`intelligenceContext.content`を正本表示（💾・productIdentifier＋caseId一致・再計算しない＝単一商材紐づきのためRevenue方式を採用）。採用時に`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`を同一Output Draftへ**五書き**し既存`pushOutputDraftToServer`を**1回**（**採用1回=POST1回維持・Content専用POSTなし**）。**実Supabase検証（専用caseId `case-ms3t75suuo2i`）**：採用後`fields.intelligenceContext`に`product`/`revenue`/`asp`/`content`が揃うことを確認・Evidence総数14件不変（product14/revenue9/asp4/content3・重複なし）・Content Confidence Medium（64点・independent3件・knownFactors3/3）・**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts とも）**確認。回帰テスト118/118 PASS・node --check OK・dev-check 200/200/200・Console 0・白画面/無限ロード/横スクロールなし。**index.htmlのみ**（foundation Code commit **2b3fdd0** +113/-0／ui Code commit **f2b0b5e** +126/-0）。**server.js/lib/DB/schema.sql/API/output_drafts定義/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue/ASP Intelligence/ランキング順位/integratedScore/estimatedProfit式 無変更**。Decision 081・tag **v1.01-affiliate-content-intelligence-persistence**（作成予定）・**main push・Render反映・PC本番確認・iPhone実機確認はこれから実施**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。次工程＝未定（Content Intelligence完成により残るIntelligence層＝Competition/Market/Self Improvement等）。以前: 2026-07-28（**Affiliate Intelligence Company 工程5-3（5-3A/5-3B/5-3C）ASP Intelligence 表示UI・永続化 正式リリースComplete**＝ランキングカード・AIC最小パネル・Copy Full ReportへASP Intelligence表示追加（Revenue直下）。`_aicBuildAspForRow`（使い捨てプレビュー・`_affiliateCases`空/非配列でも例外なし）／`_aicCurrentSavedAsp`・`_aicSavedAspForRow`（保存済み`intelligenceContext.asp`を正本表示・再計算しない）／`_aicBuildAspCardLine`・`_aicBuildAspHtml`・`_aicBuildAspReportText`を追加。採用時`affiliateContext`＋`product`＋`revenue`＋`asp`を同一Output Draftへ**四書き**・既存`pushOutputDraftToServer`を**1回**（**採用1回=POST1回維持・ASP専用POSTなし**）。**実Supabase検証（専用caseId `case-ms3t75suuo2i`）**：Output Draft POST2回（scaffold1＋採用四書き1）・Evidence総数12件不変（product12/revenue9/asp4・重複なし）・F5復元で推奨ASP/Confidence/比較数/Independent/`updatedAt`完全一致（**再計算なし実証**）・caseId分離（別案件混入なし）・Copy Full Report確認・Product/Revenue/ranking/integratedScore/estimatedProfit回帰なし・**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts とも）**確認。純関数 工程5-3A/5-3B新規27＋工程5-1/5-2再実行44＝**71/71 PASS**・JavaScript構文OK・dev-check 200/200/200・Console 0。**index.htmlのみ +146/-0**（Code commit **b473053**）。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue Intelligence/ランキング順位/integratedScore/estimatedProfit式 無変更**。Decision 080・tag **v1.01-affiliate-asp-intelligence-persistence**・**main push・Render反映**・**PC本番確認・iPhone実機確認 完了（2026-07-28・ユーザー実施：PC＝ログイン/ホーム/Output Engine/Affiliate Intelligence Core/Revenue Intelligence（空状態）/ASP Intelligence/おすすめ順位ランキング/Copy Full Report すべて正常・白画面/無限ロード/崩れなし。iPhone＝同項目に加え案件入力フォーム正常・Copy Full Report「コピーしました」表示確認・横スクロール/画面停止なし。保存済み案件なしのためProduct Intelligence保存済み表示/💾表示は確認対象外）**・**Phase54 Complete維持・Phase55未着手**。次工程＝未定（ASP Intelligence 7層構想の残り等）。以前: 2026-07-28（**Affiliate Intelligence Company 工程5-1・5-2 ASP Intelligence（③層）正式リリースComplete**＝③ASP層をProduct Intelligence上の比較説明レイヤーとして追加。`intelligenceContext.asp`（正規化商品名×market単位グルーピング・ASP名はグループキーへ含めない）へActive評価（`_aicIsPersisted`）のみを候補化（同一productIdentifier重複は1件に限定）／推奨ASPは既存`estimatedProfit`（`_aicEstimate`再利用・再算出なし）最大＋決定的タイブレーク（承認率→EPC→報酬→ASP名）・有効候補2件未満は推奨不可／Evidenceは新規生成せず採用商品のEvidenceにのみ`usedBy:'asp'`を冪等追記（他候補は読み取りのみ）／ASP Confidence（`_intelCalculateAspConfidence`）は既存`_intelCalculateConfidence`（工程2共通基盤）を再利用・母集団は`usedBy:'asp'`Evidenceのみ・独立3件未満Insufficient・**比較ASP数/有効利益候補2件未満は強制insufficient**・Product/Revenue Confidenceと分離／順位・integratedScore・estimatedProfit式・Product/Revenue Intelligence 無変更（説明レイヤーの原則）。純関数 工程5-1 18＋工程5-2 26＝**44/44 PASS**・JavaScript構文OK・dev-check 200/200/200・Console 0・Supabase書込み0・AI API実行0。**index.htmlのみ +212/-0**（Code commit **17587296c9413f53dcc05e4c72897ac4e8d0643a**）。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/Affiliate Evaluation/Product/Revenue Intelligence 無変更**。**表示UI接続・Output Draft永続化・F5復元は工程5-3へ分離（今回未実装）**。Decision 079・tag **v1.01-affiliate-asp-intelligence**・**main push・Render反映**・**iPhone実機確認 完了（2026-07-28・ユーザー実施・崩れなし・横スクロールなし・白画面/無限ロード/画面停止なし）**・**Phase54 Complete維持・Phase55未着手**。次工程＝**ASP Intelligence 工程5-3（表示UI・永続化・F5復元、仕様未確定）**）。以前: 2026-07-27（**Affiliate Intelligence Company 工程4 Revenue Intelligence 正式リリースComplete（4-1〜4-4）**＝⑤Revenue層を読み取り専用説明層として追加。`intelligenceContext.revenue`（財務入力7＋派生2）へProduct Evidenceを `usedBy:'revenue'` 共有参照（新規生成なし・件数不変）／Revenue Confidence＝`_intelCalculateConfidence`再利用・財務入力Evidenceのみ母集団・独立3件未満Insufficient・Product Confidenceと分離／AIC最小パネル＋カードRevenueライン（順位不変）／採用時 `affiliateContext`＋`product`＋`revenue` 同一Draト両書き・**採用1回=POST1回**・保存済み優先表示💾・旧Draトはプレビューfallback。**実Supabase保存/F5復元/POST1/表示復元POST0/限定削除 remaining=0** 確認。純関数31＋31・表示12・永続化15 全PASS・dev-check 200/200/200・Console 0・回帰なし。**index.htmlのみ +230/-1**（Code commit **8cde936**）。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/順位/`_intelCalculateConfidence`本体/Product 無変更**。Decision 078・tag **v1.01-affiliate-revenue-intelligence**・**main push・Render反映**・**iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・横スクロールなし・空状態正常）**・**Phase54 Complete維持・Phase55未着手**。次工程＝**ASP Intelligence 開始前調査・設計（未着手）**）。以前: 2026-07-27（**Affiliate Intelligence Company 工程3 Product Intelligence 正式化・工程3-3 正式Complete**＝採用時に `fields.affiliateContext` ＋ `fields.intelligenceContext.product` を同一Output Draftへ**両書き**し既存 `pushOutputDraftToServer` で**1回保存**（採用1回=POST1回）。一時変数で構築→必須項目/caseId6項目一致ガード→全成功時のみ一括反映・deep copy後product生成・`_intelSaveContext`不使用。**実Supabase保存/F5復元/同一商品Evidence非増殖(14→14)/別商品Product置換・旧Evidence保持(14→28)/テストデータ限定削除 remaining=0(draft=null)** 確認。隔離テストA〜F全合格・dev-check 200/200/200・Console 0・回帰なし。**index.htmlのみ**（工程3-1 **28fa51c**+159/-0／工程3-2 **1d04f31**+49/-0／工程3-3 **3ef7495**+58/-10）。**server.js/lib/DB/schema.sql/API/`_icpDeriveTopic`/Workflow Wiring/ランキング順位/Confidence計算式/工程3-2表示関数 無変更**。Decision 077・tag **v1.01-affiliate-product-intelligence-persistence**・**main push・Render反映**・**iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・空状態正常）**。**Phase54 Complete維持・Phase55未着手**。次工程＝未定（候補：採用済み商品の保存済みConfidence優先表示＝案A／各Intelligence本体））。以前: 2026-07-26（**Affiliate Intelligence Company 工程2 Evidence/Confidence 共通基盤 実装・実機検証完了**＝`outputDraft.fields.intelligenceContext`（JSONB）へ Evidence共通型（7種・`ev-<UUID>`・検証・派生/独立区別）／Confidence共通型（独立Evidence3件未満は Insufficient・推定依存で減点・Decision 032統合）／`_intel*` helper／AICパネル最小表示を追加。**index.htmlのみ +372/-0**・**server.js/lib/DB/schema.sql/API 無変更・新DB列/新APIなし**・**affiliateContext/_icpDeriveTopic/Workflow Wiring 未変更**。純関数18/18・dev-check 200/200/200・実Supabase保存/F5復元/POST1回/affiliateContext併存/テストデータ削除 remaining=0 確認・Code commit **29d82c1**・tag **v1.01-affiliate-intelligence-evidence-confidence**・**main push・Render反映済み・iPhone実機確認完了＝工程2 正式Complete**（Decision 076）。**Phase54 Complete維持・Phase55未着手**。次工程＝**工程3 Product Intelligence 正式化（未着手）**）。以前: 2026-07-24（**Instagram自動運営 Workflow Wiring 本体 完了・本番反映済み**＝commit 745dd1e・tag v1.01-instagram-planning-wiring・Decision 075）。以前: 2026-07-23（**Affiliate Evaluation 工程1 完了（クローズ）**＝工程1-D調査の結論として **P2〜P6は実装不要・保留継続を正式決定**（Decision 074）。工程1-A〜1-Dが揃い商材選定→投稿企画への接続基盤が完成。**実装なし・docs更新のみ**。次工程＝**Instagram自動運営（Workflow Wiring）**へ移行可能。**Phase54 Complete維持・Phase55未着手**）。以前: **Affiliate Evaluation 工程1-C（案A）schema.sql記録 完了**＝実DB定義を読み取り専用SELECTで実測（30列・PK・UNIQUE・CHECK・Index・RLS・Trigger/FKなし）し正本として **`supabase/schema.sql` へ純追記**（+76/-0・driftなし）。**記録用でありMigrationではない**・**DDL実行なし・実DB無変更・server.js/lib/index.html/API 無変更**。P2〜P6を工程1-D以降候補として保留（Decision 073）。次工程＝**commit・tag・push**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**・**commit未実施**）。以前: **工程1-B本体 Active Case Hotfix**＝本番通常経路の読み取り確認で「案件未確定ビューでも『案件を追加』が有効＝直前案件へ保存され得る」不具合を検出・修正。原因＝`getCurrentApprovalCaseId()` の **`_lastOutputDraft.caseId` フォールバック**。Affiliate専用 **`_aicCurrentCaseId()`** を追加しAIC内4箇所を統一・**`getCurrentApprovalCaseId()` は無変更**。**index.htmlのみ +17/-4**・localhost Case1〜4合格・**POST/PATCH/DELETE 0回**（Decision 072）。以前: **Instagram自動運営 工程1-B本体（Workflow Wiring）Complete**＝Affiliate Intelligence Core と永続化APIを接続。**index.htmlのみ +390/-4**・server.js／lib／DB／Migration／API shape **無変更**。案件境界D-1・退避バッファ・冪等統合・channelScope安全補強。**第2段階 localhost実DB検証 Case1〜9 全合格**・**テストデータ削除完了（remaining = 0）**・**未commit／未push／Render未反映**。次工程＝**commit・tag・push・Render反映**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**）。以前: **工程1-B-0a〜0d 完了**＝Affiliate評価のActive一意性を**商材単位**へ移行。**Migration完了**（`uq_affiliate_eval_active_product` 適用・旧 `uq_affiliate_eval_active_case` 廃止）・**`lib/affiliateEvalDb.js` 実装完了**（Code commit **2ef2ad3**・+36/-6）・**実DB POST検証 全8ケース成功**・**専用テストデータ削除済み**（`remaining = 0`）・**Decision 070**（069-3を改訂）。`server.js`／`index.html`／`schema.sql` **無変更**・**API shape維持**。**Phase54 Complete維持・Phase55未着手**。次工程＝**Instagram自動運営 工程1-B本体（Workflow Wiring）**・未着手）。以前: 2026-07-21（**社員向上B 正式完了**（定義駆動基盤完成・**13型中11型移行済み**・**Flyer/LP 正式保留**）・**localhost検証完了・push前・Render未反映**。HEAD **61dde05**／origin/main **ac2f5da**／local ahead **7**／最新Tag **v1.01-phase54-video-html-section-migration**。**Phase54 Complete維持・Phase55未着手**。**docs更新中／commit前**。次工程＝**Instagram自動運営機能**（push・Render承認後）。以前: **Phase54 正式Complete維持**・**改善案件 工程A（設定保持）完了**（Auto Task／自律相談を端末内localStorage保持・**autoStart復元は設定と表示のみ＝起動時のWorkflow・AI自動実行なし**・端末間同期は非対象）・**localhost確認済み**。HEAD=origin/main=**8c9ed58**（本docs更新commitが以降の最新HEAD）・最新code tag=**v1.01-phase54-agent-settings-persistence**。**Phase55未着手・工程B以降は未着手**・**前工程Hotfixの本番実機確認は保留**。以前：**Task新規作成 二重化 Hotfix 完了**（`submitTask()` の dbId 誤代入／`atCreateNextTasksFromItems()` の dbId 握り潰しを修正・全7作成経路を統一）・**localhost確認済み**・**本番反映済み**。HEAD=origin/main=**39b44d0**（本docs更新commitが以降の最新HEAD）・最新code tag=**v1.01-phase54-task-create-dbid**。先行して Task一括操作 Hotfix（同時5並列化）／Taskホーム表示改善／Task並び順統一／Case同期 Complete／Case Known Issue Complete／Case成功確認契約 完了。**Phase55未着手**・次工程はユーザー承認後に決定）

---

## 【現在地・最優先】Phase IG-QC / B-7F Quality Gate Package Routing Fix 正式リリースComplete（2026-08-20・Decision105）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**（Version変更なし）
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（Phase55へは移行しない）
- **状態**：**Phase IG-QC / B-7F Quality Gate Package Routing Fix ＝ 正式リリースComplete**。Instagram案件`case-msr9yckye65y`のOutput Draft（IADP `iadp_1787060839814_izhakb`）がInstagram投稿用Quality Contract（10項目評価）に誤接続されていた問題と、全Path A Output Typeで`packageQuality`がQuality Gateへ未接続だった配線バグを解消した。
- **Phase IG-QC（IADP Quality Contract誤接続修正）**：`detectOutputType()`で`instagram_post`と判定されるIADP Output Draftが`OUTPUT_PACKAGE_QUALITY_TYPE_MAP`経由でinstagram投稿用10項目Quality Contractへ誤接続されていた。正式IADP（`fields.iadp.quality`存在・`validation.valid===true`・`packageId`存在・`status`/`score`型確認）が全条件充足する場合は`evaluateInstagramAccountDesignQuality()`の事前算出済み結果を`packageQuality`へrouting。非IADP・guard失敗は既存`evaluateOutputPackageCompleteness()`へfall-through（後方互換維持）。
- **Phase B-7F補完（全Path A Quality Gate配線修正）**：`buildOutputDraftFromLeaderFinal()`のreturn値に`packageQuality`が含まれていなかったため`evaluateQualityGate(undefined)`が実行され全Path A Output Typeで`sourceStatus=null`（Quality Gate表示不能）だった。return値に`packageQuality`を追加し全Path A Output TypeでQuality Gateへ実評価値を正式接続。IADPだけでなく全Output Typeの共通配線バグ修正。
- **影響範囲**：IADP（専用Quality評価へ正しくrouting）・通常instagram_post/carousel（Quality Gateへの接続正常化・packageQuality算出内容変更なし）・その他Output Type（Quality Gateへの接続正常化）。Executive Decision（`qualityGate:null`）・User Approval・Evidence・既存Quality Contract責務は変更なし。UIのQuality Gate表示（`🟢 Passed`/`🟡 Not Passed`）が実評価値に基づいて機能するようになる。
- **安全性**：Cross-case guard（格納時caseId一致保証）・F5復元stale guard①②・`preWorkflowGuard`は変更なし。推測補完・Quality水増し・validation緩和は追加していない。
- **回帰検証（非課金）**：`iadpQualityContractRouting.test.js` 48/48 PASS・`iadpStructuredOutput.test.js` 13/13 PASS・`costTracker.eea8.test.js` 19/19 PASS・`evidencePromotion.eea10b.test.js` 17/17 PASS。inline JS構文OK・`git diff --check` CLEAN。instagram_post/carousel/document代表回帰なし。Leader Case Context Phase2混入なし（staged diffにhandleLeaderDispatch等は含まれず）。
- **⚠ 重要継続事項：本番環境には`buildLeaderCaseContext()`が存在しない**：working treeの別系統差分「Leader Case Context Phase2」（`buildLeaderCaseContext()`含む）は今回も意図的に除外。本番環境にはこの関数が存在しない。次セッションでも勝手にcommitへ含めない・勝手に破棄しない。リリース判断はユーザー承認後。
- **正式リリース実績（2026-08-20）**：Code commit **547ddac**（`fix quality gate package routing`）・docs commit・Annotated Tag **v1.01-quality-gate-routing-fix**・main push・tag push・Render反映・PC本番基本確認済み。OpenAI API call 0・Claude API call 0・Web Search 0・DB変更なし。
- **次工程**：本番で Account Creation Readiness の正しい評価（`conditional`相当）を確認する。Quality Gate=Passed・Evidence=Sufficient・Reviewer=Passed・Strategy=Accepted の状態で User Approval=Pending が唯一の残条件であることを実測確認する。User Approval はまだ変更しない。Instagram アカウント作成へはまだ進まない。Leader Case Context Phase2 は別系統・引き続き本番未 commit・未リリース。


---

## 【参考・完了済み】IADP Structured Output 正式リリースComplete（2026-08-18・Decision103）

- **状態**：OpenAI Responses APIの`text.format:{type:'json_schema',strict:true}`をIADP Leader Final呼び出し1箇所のみへ追加し、案件`case-msr9yckye65y`でIADP生成Validation FAILを解消した。
- **実AI E2E**：1 workflow・8 call。`validateAccountDesignPackage()`が`valid:true`。candidateComparison3件・adoptedCandidateId整合・finalProfileトップレベル正配置を実測確認。
- **安全契約維持**：`shared/instagramAccountDesign.js`（Validator/Normalizer）は1行も変更せず、既存の「生成→extract→normalize→validate→validのみ保存」契約を完全維持。推測補完・自動水増し・validation緩和なし。
- **⚠ 本番環境には`buildLeaderCaseContext()`が存在しない**（working treeの「Leader Case Context Phase2」差分は今回も除外・本番未リリース）。Code commit **8a9d417**（`feat: enforce structured output for IADP generation`）・Tag **v1.01-iadp-structured-output**。

---
## 【参考・完了済み】Deliverable Completion Architecture（STEP 6）正式リリースComplete（2026-08-18・Decision102）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**（Version変更なし）
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（Phase55へは移行しない）
- **状態**：**STEP 6 Deliverable Completion Architecture ＝ 正式リリースComplete**。「AIが処理を終えた」ことと「依頼が本当に完了した」ことを分離するCompletion判定軸が完成。
- **Completion Core（工程1）**：純関数`evaluateDeliverableCompletion(draft, context)`（Contract v1.0.0・追加AI call 0）が`OUTPUT_PACKAGE_QUALITY_CHECKS`のrequired属性からoutputType別必須成果物の充足を判定し`complete`／`incomplete`／`blocked`を返す。`blocked`は必須成果物充足済み＋外部実行語＋User Approval pendingの組み合わせでのみ発火する安全側限定判定。
- **Completion保存・復元（工程2）**：新DB列・新テーブルなし。既存`package_quality`（JSONB）へ`completionAssessment`を同梱保存し、F5復元時にdraftトップレベルへ再展開。`FORMAL_CASE_FIELDS`には含めない（次Draftへcarry-forwardしない）。
- **Formal Truth Race Condition安全化**：`switchCase()`がOutput Draft復元完了を待たないfire-and-forget設計のため、案件切替直後のAuto Task開始で`FORMAL_CASE_FIELDS`（iadp／intelligenceContext／affiliateContext／approvedDecisionPackage）のcarry-forwardが不成立になる実測済み競合を`scheduleOutputDraftRestore()`のPromise化＋`atRunWorkflow()`側awaitガードで解消（sleep/setTimeout不使用）。単一field（iadp）限定だったcarry-forwardも契約全体へ一般化。
- **Formal Truth復旧**：上記競合の再現検証中に`case-msoplrg6gdkr`で発生した`iadp`/`intelligenceContext`欠落を、ユーザー承認を得て直前の正常Draftから2項目限定マージで復旧（他fields・他列は不変・Cross-case書き込みなし）。復旧後の正式値：Evidence sufficient／Verified5／Independent Source3／Quality Gate passed／Readiness conditional／User Approval pending。
- **実AI E2E実測**：`estimateAutoTaskCalls()`事前見積りmax=5と実call数5（Claude3＝Company Brain`claude-opus-4-8`・Reviewer・Strategy／OpenAI2＝sns・Leader Final`gpt-4.1-nano`系）が一致。新規Draft`out_1786976475516`（type=`instagram_post`）でFormal Truth carry-forward・completionAssessment（`status:'complete'`・requiredDeliverables=[cta,caption]・missingDeliverables=[]）のDB保存/F5復元一致・他7 case完全不変（Cross-case非混入）・想定外カスケードなし・Web Search0回を確認。OpenAI cost増分+$0.17・Claude cost増分+$0.1632238。
- **Completion UI（工程3-A）**：Output Engineパネルへ`buildCompletionStatusHtml()`による最小表示（Complete/Incomplete/Blockedの短縮バッジのみ・内部contract全体は非表示）を追加。`completionAssessment`が存在しない既存Draftは非表示（Complete扱い・推測表示のいずれもしない）。
- **Output Type判定精度改善（工程3-C）**：`detectOutputType()`の`instagram_post`キーワードへ`instagram`/`インスタ`裸トークンを追加し、carousel固有語を含まない一般的なInstagram投稿依頼が`instagram_carousel`へ誤判定される実バグを修正（13型代表テストで既存分類に回帰なし・既存fallback`document`維持）。
- **責務境界（次セッションが必ず守る契約）**：Completionは「依頼に必要な成果物が揃ったか」のみを判定する。Quality Gate（成果物品質）・Constitution（会社原則）・User Approval（本人承認・読み取り専用参照のみ）・Formal Truth Priority（Case Context正本利用）とは責務分離し、Completionを理由にこれらの値を書き換える経路は存在しない。`status=ready`をCompletion=completeへ読み替えない。
- **node --testの既知状態**：81 PASS／6 FAIL。FAIL6件は`server.test.js`のLeader固定返信テキスト正規表現不一致（応答文言ドリフト）であり、本リリース（`index.html`のみ）とは無関係のpre-existing failureと確認済み（今回未修正）。EEA既存合成テスト36件は全PASS。
- **⚠ 重要：未commit差分の扱い**：working treeには本リリースと別系統の未commit差分「Leader Case Context Phase2」（Leader dispatch各関数`handleLeaderDispatch`/`triggerStrategyConsolidate`/`triggerLeaderSummary`/`sendMessage`への`caseId`伝播。`claudeClient.js`／`openaiClient.js`／`server.js`および`index.html`一部hunk）が現在も残っている。STEP 6とは機能的依存がないため`index.html`をhunk単位で分離し今回のcommit対象から意図的に除外した（`git diff`で確認可能）。次セッションはこれを「既存差分」として認識し、勝手にcommitへ含めない・勝手に破棄しない。リリース判断はユーザー承認後。
- **正式リリース実績（2026-08-18）**：Code commit **364b65a**／docs commit＝本更新／Annotated Tag **v1.01-deliverable-completion-architecture**／push・Render反映・本番確認は本記録後に実施し、結果を本セクションへ追記する。
- **次工程候補（未着手・ユーザー承認後に決定）**：Instagram実運用（アカウント作成→プロフィール設定→ASP登録→商品調査→投稿企画→初回投稿→KPI取得→Learning実測）を優先。「Leader Case Context Phase2」の別途リリース判断・`server.test.js`既知6件FAILの扱いは今回自動着手しない。**iPhone実機確認待ち**：①Output Engineが開く ②Completion表示（Complete/Incomplete/Blocked）が見える ③既存画面が崩れていない ④案件切替後も正常。

---

## 【参考・完了済み】External Evidence Acquisition（EEA）正式リリースComplete（2026-08-13・Decision101）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**（Version変更なし）
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（Phase55へは移行しない）
- **状態**：**EEA-1〜EEA-12 ＝ 正式リリースComplete**。IADPのEvidence不足を、AI会社自身がWeb Search経由で解消できる基盤（Search Plan機械生成→ユーザー承認→Web Search→Trust Tier評価→Verified Promotion→Gate評価）が完成。
- **Verified Promotion（2段階方式・EEA-10A/10B）**：取得Evidence CandidateをTrust Tier（8段階）×Independent Source（独立2 Publisher以上）×claimTypeで評価し条件充足時のみ`verificationStatus:'verified'`へ昇格。Phase1（sourceName事前計算）→Phase2（batch全体＋既存正本を固定母集団として全candidate分先に判定確定）→Phase3（確定済み値で保存）の順で処理順非依存を保証。market/competitionは対応、monetizationはclaimType未対応のためunverified固定（安全側・mapping未実装）。Code commit **4bcf42e**。
- **Cost Tracker二層構造（正式記録）**：A. ローカルGate用state（`cost-logs.json`・`monthlyLimit`/`stopped`/`canProcess()`）と B. Supabase実績正本（`api_cost_events`→`/api/cost`）は完全に独立。**過去の「Historical Cost Lost」表現は「Local Cost Gate State Historical Values Lost」が正しい**（Supabase側実費履歴は無傷）。EEA-8で`gpt-5.6-terra`料金・Web Search tool fee（$10/1,000 calls）をCost Trackerへ接続。Code commit **40ff550**。
- **実測toolCallCount精算（EEA-11で判明した重要仕様）**：`tool_choice:'auto'`によりSearch Planのquery数と実際のOpenAI `web_search_call`数は一致しない場合がある（実測：3クエリ→合計6 tool calls）。事前表示は上限目安、実行後精算（`api_cost_events`の実測`requests`／`amount_jpy`）を正本とする。
- **EEA-11 Final Regression実測**：QA専用case`case-msoplrg6gdkr`で承認済み3クエリのみ実Web Search実施（追加検索なし）。Trust Tier Selectionで政府ドメイン5件（caa.go.jp×3／kokusen.go.jp／meti.go.jp）が保存され**全件verified**（独立Publisher3件）。`resolveIadpEvidence()`実測：`verifiedCount=5`・`independentSourceCount=3`・`status='sufficient'`（既存Gate`MIN_VERIFIED_EVIDENCE=3`／`MIN_INDEPENDENT_SOURCES=2`は無改修）。F5完全リロード後も全項目・billingLock状態とも完全復元。
- **Account Creation Readiness**：`conditional`（`ready`ではない）。Evidence関連は全てComplete（structureValidation: passed／contentQuality: complete／reviewerStatus: passed／strategyStatus: accepted／qualityGateStatus: passed／score 100/100）だが、唯一の理由は`userApproval: pending`（「この設計を承認」ボタン未押下）——Evidence/EEAとは無関係の別ゲート。ユーザー承認操作は実行していない。
- **Cost実測（Local／Supabase 両系統一致）**：Local before 0/0/0 → after 34.42/34.42/34.42（差額+34.42円）。Supabase `/api/cost` before today0・monthly41.05・total48.47 → after today34.42・monthly75.47・total82.89（差額+34.42円）。両系統差額完全一致・二重計上なし。`api_cost_events`新規3行実測：`requests`3/2/1（計6）・`amount_jpy`17.48/11.34/5.60（計34.42円）。
- **B分類（EEA Complete後の改善候補・未実装）**：Tier3/Tier6案件固有allowlist（`options.officialDomains`/`options.industryDomains`は関数シグネチャ上未接続）／monetization claimType mapping／Category Coverage Gate化。**C分類（EEA外の将来機能）**：Auto Task完全自動化接続／Researcher直接Web Search統合。
- **正式リリース実績（2026-08-13）**：docs commit（本コミット・下記参照）／Annotated Tag **v1.01-external-evidence-acquisition**／**main push完了**／Render反映確認済み／本番確認（IADP表示・LFS表示・Search Plan UI・billingLock初期状態・Verified/Unverified表示・Console Error 0）。実Web Search本番再実行なし（localhost実測のみ・追加課金なし）。
- **次工程候補（未着手・ユーザー承認後に決定）**：Instagram実運用（アカウント作成→プロフィール設定→ASP登録→商品調査→投稿企画→初回投稿→KPI取得→Learning実測）またはPhase55判断。`AI_MODEL_SETTINGS`のUI表示モデル名（gpt-5.5等）と実API使用モデル（gpt-4.1-nano）の不一致は別工程として残る。

---

## 【参考・完了済み】Phase IG-2J-A〜I Instagram Account Design Self-Completion / AI Action Rerun（正式リリースComplete・2026-08-10・Decision098）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**（Version変更なし）
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（Phase55へは移行しない）
- **状態**：**Phase IG-2J-A〜I ＝ 正式リリースComplete**。IADPは「**AI会社自身が不足を判定し、必要なAI社員を再実行し、Leader Finalを再生成して再評価できる**」状態へ到達（Decision098）。
- **正式リリース実績（2026-08-10）**：docs commit **32b0821** ／ Annotated Tag **v1.01-instagram-account-design-self-complete**（→`32b0821`）／ **main push完了**（`540411e..32b0821`）／ **tag push完了** ／ **Render反映完了**（本番200・配信物へ全10項目反映確認・新規共有モジュール4件とも200）／ **PC本番確認完了**（横はみ出しなし・Console Error 0）／ **iPhone Portrait実機確認完了**（ユーザー実施・1カラム・横はみ出しなし）。**iPhone LandscapeはKnown Issue継続**。

### 完了内訳（すべてCode commit済み）

| 工程 | 内容 | commit |
|---|---|---|
| IG-2J-A | Self-Completion Mode（4担当が逆質問だけで停止しない・数値捏造禁止・通常Workflowは同一文字列維持） | `d95f196` |
| IG-2J-B | Leader Final Summary（最新位置へ結論要約・構造充足と実運用品質を分離） | `7a33296` |
| IG-2J-C | AI Action / User Input分離（reason code＋決定論的分類） | `244cad2` |
| IG-2J-D | 採用案 Single Source of Truth（総合点1位を自動採用しない） | `144b0ff` |
| IG-2J-E | Intelligence実数値の担当指示注入（Fact/Prediction/Unknown分離） | `fa91cae` |
| IG-2J-F | Evidence正本接続（Verified/Derived分離・fieldStatusはfallback維持） | `d7d21dd` |
| IG-2J-G | 成果物正規化（reply wrapper／json fenceのみ除去・原文保持） | `7ff4140` |
| IG-2J-H | AI Action自律再実行（既存Auto Task経路再利用・新Engineなし） | `f845db0` |
| IG-2J-I | 最終統合検証（Code変更なし） | — |

### 次セッションが必ず守る正式契約

- **採用案の正本**＝`intelligence.adoptionDecision.adoptedCandidateId`。**総合点1位を自動採用しない**。比較表の整合は表示時のみ（保存副作用なし）。Final Profile不一致は文字列補正せず安全側Not Ready。
- **Evidenceの正本**＝`outputDraft.fields.intelligenceContext.evidence[]`。派生・推定Evidenceを検証済み件数へ算入しない。`fieldStatus`はlegacy fallbackとして維持（過去データを突然Insufficientにしない）。
- **確認事項**は`actionItems.aiActions`／`userInputs`へ分離。**`userInputs`は絶対にAuto Task化しない**。ターゲット・ジャンル・投稿頻度・KPI等はAI会社が決めユーザーへ質問しない。
- **User Approval**はAI会社が代行しない。新packageId・採用案変更で承認は無効化。**承認だけ・Quality Gate通過だけではReadyにしない**。
- **自律再実行**は自動起動しない（ユーザーが1回開始）。案件あたり3回・同一reason code 2回の上限、二重実行防止、Cross-case guard、stale Quality Gate guardあり。
- **新Engine／新DBテーブル／新schema／新API／Workflow再設計は行っていない**。`server.js`／DB／`supabase/schema.sql`／API契約は全工程で無変更。

### 検証実績（実測値）

- 回帰**441項目全PASS**（A 26／D 111／E 87／F 93／G 71／H 53）
- **実AI End-to-End 1回PASS**（専用検証案件・Researcher→Analyst部分再実行→Reviewer→Strategy→Leader Final 9,229字→新IADP生成→SSOT解決→Evidence判定→Quality Gate再評価→Approval pending維持→User Input非実行→F5復元一致→Cross-case問題なし）
- **API追加費用 約¥30**（上限¥100内）。課金ロックは一時解除後に自動ON復帰
- 実案件2件は読み取り専用・**書き込み0件**・初回取得時とバイト単位で完全一致
- 検証用テストデータは**remaining=0**を実測確認
- `node --check`全7ファイルOK・`git diff --check` CLEAN・**Console Error 0**・`npm run dev-check` 200/200/200

### Known Issue（IG-2Jの正式リリース判定をBlockしないと評価）

①チャット経路`generateReply`のreply wrapper残存 ②Reviewer NG partial-match ③iPhone Landscapeレイアウト崩れ ④iPhoneチャット履歴の瞬間消失 ⑤Background Execution未実装。

### 次工程

**Instagram実運用準備／実運用開始**（アカウント作成→プロフィール設定→ASP登録→商品調査→投稿企画→初回投稿→KPI取得→Learning実測）。**新しいPhase番号は作らない・Phase55へは移行しない**。

---

## 【参考・前工程】Phase IG-2F〜IG-2H IADP Quality / Approval / Quality Signals 正式採用（正式リリース・2026-08-09・Decision097）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **状態**：IADPがComplete／100点／Readyと誤表示される問題をIG-2F〜IG-2Hの3工程で解消し、IADP品質基盤を統合正式リリースした（Decision097）。
- **IG-2F（階層品質判定・Summary UI改善）**：`assessInstagramAccountDesignPackage(iadp, context)`を新設し、判定を`structureValidation`／`contentQuality`／`evidenceStatus`／`accountCreationReadiness`／`userApproval`の5軸へ分離（既存`evaluateInstagramAccountDesignQuality()`は無変更のまま内部再利用＝後方互換）。構造検証Passedだけで内容品質をCompleteにせず、Evidence 0件を「実データ検証済み」と表示せず、Category Scoresを「構造充足／Evidence信頼度／内容品質」へ分離。担当成果物不足・Leader統合回答不足はComplete化禁止。生成時コンテキストを`fields.iadp.generationContext`へ保存し、無い旧IADPは`not_evaluated`（legacy）で自動Complete/Ready化しない。`.iadp-card`へ`flex-shrink:0`／`overflow:visible`を適用しカード潰れ（26px→547px）を解消。Code commit **b5a3d5e**。
- **IG-2G（User Approval Flow）**：`fields.iadp.approval`（任意サブキー）へ保存し既存`pushOutputDraftToServer()`で永続化（新規API・新規DBカラムなし）。**caseId＋packageId一致時のみapproved**、新IADP生成では旧承認を引き継がず`pending`へ戻す。Summary内の承認ボタンから承認し、保存→再評価→再描画を同一操作内で完了（F5不要）。Code commit **18fc04b**。
- **IG-2H（Reviewer／Strategy／Quality Gate 正式接続）**：**新しい独立判定基盤は作らず既存判定を再利用**。Quality Gateは既存正本`inbox.qualityGate`を読むのみで再実行・契約変更なし。Reviewer／Strategyは構造化正本が無いため既存`data.results`から多シグナル導出（構造シグナル優先・否定フレーズ単独は`needs_work`・裏付けがある場合のみ`failed`／`needs_revision`。既知バグの`LI_REVIEWER_REJECTION_KEYWORDS`は流用しない）。既存Workflow順は変更せず`_liCollectIntegration()`直後の`_iadpRefreshAfterIntegration()`でQuality Gate確定後に後から再評価。`fields.iadp.assessmentContext`へsnapshot保存・packageId一致検証（不一致なら破棄）。Code commit **4dd0400**。
- **Ready正式条件**：①構造Passed ②内容Complete ③Evidence非Insufficient ④Reviewer重大不足なし ⑤Strategy再設計要求なし ⑥Quality Gate Passed ⑦Leader統合回答あり ⑧必須担当成果物あり ⑨User Approval Approved の全充足。品質条件のみ充足で承認待ちは`conditional`。**承認だけで品質不足を上書きしない**。未取得シグナルは`not_available`／`not_executed`として明示しComplete到達させない。
- **Path B（安全側仕様として正式化）**：Path Bは`inbox.qualityGate === null`のためComplete／Readyへ到達しない。正式経路はPath A Auto Taskを基本とし、**Path BへQuality Gateを新設しない**。
- **Background Execution（Version1.1後半の大型工程・今回未実装）**：実装順＝IG-2F/2G/2H正式化 → Instagram実運用 → KPI/Learning実測 → 実運用上のボトルネック確認 → Background Execution。目的＝ユーザーがPC／iPhone／ブラウザを開き続けなくてもAI会社がサーバー側で処理を継続できる状態。将来対象＝Job Queue／Background Processing／queued・running・completed・failed・cancelled・retrying／Progress保存／Resume／Retry／Cancel／Multiple Jobs／完了通知／Cross-case guard／二重実行防止／古い結果による上書き防止／コスト制御。既存の各層を可能な限り維持し実行基盤を段階的にサーバー側へ移行する。**品質判断が安定する前にBackground化しない**。
- **iPhone実機確認結果（2026-08-09・ユーザー実施）**：**縦画面＝Complete**（Render本番表示・ログイン・Leader画面・案件表示・メニュー操作すべて正常・白画面なし・無限ロードなし・既存機能破壊なし）。**横画面＝Known Issue継続・未修正**（下記③）。IG-2I正式リリース判定には影響させず、後続のResponsive対応工程として管理する。
- **Known Issue（次工程への引き継ぎ）**：①**Reviewer NG keyword partial-match issue**＝既存`LI_REVIEWER_REJECTION_KEYWORDS`の`NG`部分一致でBRANDING／MARKETING等を誤検出し得る（IADP側は厳格フレーズ＋構造シグナルで回避済み・本体修正は未実施）。②iPhoneで案件を開いた直後にチャット履歴が一瞬消える（再描画競合の疑い）。③**iPhone Landscapeレイアウト崩れ（2026-08-09実機確認で継続を再確認）**＝横画面で左サイドバーとメイン領域の占有が大きく、メニュー表示時も画面の大部分が覆われ**実用上ほぼ使用できない状態**。Responsive未対応（サイドバー制御・レイアウト占有率最適化が未実装）が原因で、**IG-2F〜IG-2I実装による新規不具合ではない**。独立した**Responsive対応工程**として後続管理する。
- **データ保全ルール（必須運用）**：実案件の`fields.iadp`を検証目的で変更する場合は「**backup → test → restore → restore確認**」を必須とし、原則専用テスト案件または合成データを使用する（IG-2Fで実案件IADPを保全せず上書きした事故の再発防止）。IG-2G＝`case-mslrf20t2nhk`／IG-2H＝`case-mslsddorhcso`で検証し**実案件書き込みゼロ**・検証後に削除済み。
- **未実装（次工程への引き継ぎ）**：Executive Decisionロジック変更／Constitution Validator変更／Completion Gate／Background Execution／実AI IADP End-to-End／Instagramアカウント実作成／ASP登録／NG keyword本体修正。
- **変更範囲**：**index.html／shared/instagramAccountDesignQuality.js のみ** ＋ docs（00/01/02/04DECISIONS/04ROADMAP/06HANDOVER/CHANGELOG）。**server.js／shared/instagramAccountDesign.js／shared/leaderRuleEngine.js／supabase/schema.sql／DB／API契約は無変更**。Executive Decision・Constitution Validator・Quality Gate契約への非干渉をdiff実測で確認済み。
- **Git現在地**：branch **main**／Code commit 3件（**b5a3d5e** IG-2F／**18fc04b** IG-2G／**4dd0400** IG-2H）＋docs commit **42508c8**（IG-2I正式化）＋docs commit（本追記・iPhone実機確認結果）／Annotated Tag **v1.01-instagram-account-design-quality-ready**（`42508c8`に付与）／main push済み・Render反映済み・**PC本番確認 完了**・**iPhone実機確認 完了（縦画面Complete／横画面はKnown Issue③継続）**。**Phase IG-2F〜IG-2I 正式リリースComplete**。
- **次工程候補**：**Instagram実運用**（アカウント作成→プロフィール設定→ASP登録→商品調査→投稿企画→初回投稿→KPI取得→Learning実測）を最優先。実AI IADP End-to-End確認はAPI費用のユーザー承認後。**iPhone Landscape Responsive対応**（Known Issue③・サイドバー制御とレイアウト占有率最適化）は実機確認で継続を再確認した独立工程として後続管理。Background Executionは実運用・Learning実測後。Completion Gate設計・NG keyword本体修正（Known Issue①）・iPhoneチャット履歴瞬間消失対応（Known Issue②）は後続候補。**ユーザー承認なしに開始しない**。**Phase55未着手のまま維持**（Decision097）。

---

## 【参考・完了済み】Phase IG-2E Instagram Account Design Package Output Draft Integration 正式採用（2026-08-06・Decision096）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **状態**：IADP（Instagram Account Design Package）の実AI検証・品質調整（IG-2D）に続き、IADPを既存Output Draft永続化へ正式接続した（IG-2E・Decision096）。
- **IG-2D（IADP構造化JSON品質調整）**：`openaiClient.js`のIADP専用プロンプトへ実例JSON・厳守事項（10軸スコアの意味ある差・decision/adoptedCandidateId整合）を追加し空値/プレースホルダー残留を抑制。`accountIntelligenceMode`時のみ`max_output_tokens`を4096→8192。`extractIadpJsonFromLeaderText()`へ末尾カンマ耐性parseを追加。`_iadpStripJsonBlock()`が構造化ブロックのみで自由文が空の場合に案内文を表示。genreId→genreName逆引き表示・adoptionReason優先表示。Code commit **ecfed0c**。
- **IG-2E-1（保存）**：IADP検証成功時に`_lastOutputDraft.fields.iadp`へ`{package,validation,quality,caseId,savedAt}`を格納し、既存`pushOutputDraftToServer()`（＝既存`POST /api/output-drafts`）でそのまま送信。affiliateContext／intelligenceContextと同じ「`fields`配下への相乗り保存」パターンを踏襲。新規APIエンドポイント・新規DBカラムは追加しない。
- **IG-2E-2（復元）**：新設`_iadpApplyRestoredFields(fields, caseId)`が、既存`restoreOutputDraftFromServer()`（起動時／案件切替時に既存`scheduleOutputDraftRestore()`から呼ばれる）の復元結果を受けてIADPセッションキャッシュ（`_lastInstagramAccountDesignPackage`等4変数）を同期し、`reRenderChatArea()`を呼んで既存の読み取り専用IADPカードを自動再表示。復元先の案件に保存済みIADPが無い場合はキャッシュを確実にクリア。
- **IG-2E-3（1 Case 1 正本）**：`createOutputDraft()`はAuto Task実行のたびに`fields`を空へ再初期化する既存仕様のため、実行直前に現在案件の既存`fields.iadp`を退避し、新Draft生成直後に引き継ぐ処理を追加。同一案件内でIADP以外のAuto Taskを実行しても、直前まで採用されていたIADPが消えない。
- **正式実装した内容**：
  1. **IG-2D（IADP構造化JSON品質調整）**：Code commit **ecfed0c**。
  2. **IG-2E-1〜3（Output Draft保存・復元・1 case 1 正本）**：Code commit **0fb943e**。
- **未実装（次工程への引き継ぎ）**：IADP実AI生成からの自動保存End-to-End確認（今回はダミーパッケージによる保存/復元/切替機構の検証のみ）、Path B／Content Planning／Carousel Builder／Publishing Readyの実動作回帰確認（コード変更箇所との非重複はdiffで確認済みだが実動作は未検証）。
- **検証（localhost）**：既存案件（「Instagramアカウト設計」）を利用し、実AIを追加実行せずブラウザJS経由でダミーIADP（`normalizeAccountDesignPackage`／`validateAccountDesignPackage`／`evaluateInstagramAccountDesignQuality`を実際に通した`valid:true`パッケージ）を注入して実測。保存＝`POST /api/output-drafts`200 OK、F5復元＝同一`output_id`のままIADPカード再表示、案件切替＝他案件へ切替でカード消滅・グローバルclear・元案件へ戻すと再表示、1 case 1 正本＝案件間混在なし、後方互換＝IADP未使用の旧Draft（type: document等）はエラーなく従来どおり復元、Console Error 0を確認。検証後は注入したダミーIADPを削除し実案件を原状復帰。`node --check` OK・`git diff --check`問題なし・`npm run dev-check` 200/200/200。
- **検証（Render本番・PC）**：本番URL（`ai-company-l45x.onrender.com`）200 OK・配信物にIG-2E新規コード反映を確認。既存案件「Instagramアカウント設計」でlocalhostと同一手順を実施し保存・F5復元・案件切替・Cross-case確認・Console Error 0を実測、検証後は本番データも原状復帰。
- **検証（iPhone実機・ユーザー実施）**：Render本番表示・ログイン・Leader画面・案件切替・Auto Task・Output Engineいずれも正常、白画面/無限ロードなし、Console上で問題となる挙動なし、IG-2D／IG-2Eの追加による既存機能破壊なしを確認。
- **Known Issue（今回の実装とは独立・後続工程で対応）**：①iPhoneで案件を開いた直後、一瞬チャット履歴が表示された後に消え、Auto Taskボタン押下で正常再表示される（保存/復元自体は正常・描画タイミングの再描画競合と推定）。②iPhone Landscape（横画面）でレイアウトが崩れチャット領域が極端に狭くなる（サイドバー制御含むResponsive対応が必要）。いずれもIG-2D／IG-2Eの保存・復元機能自体の不具合ではない既存UI課題。
- **変更範囲**：**index.htmlのみ**（IG-2D・IG-2Eとも）＋ docs（00/01/02/04DECISIONS/04ROADMAP/06HANDOVER/CHANGELOG）。**server.js／shared/instagramAccountDesign.js／shared/leaderRuleEngine.js／supabase/schema.sql 無変更・新規API/新規DBカラムなし**。
- **Git現在地**：branch **main**／Code commit 2件（**ecfed0c**＝IG-2D／**0fb943e**＝IG-2E）＋docs commit **d36de10**（Decision096含む7ファイル）／Annotated Tag **v1.01-instagram-account-design-output-draft**／main push・Render反映・**PC本番確認・iPhone実機確認 完了**。**IG-2D／IG-2E 正式リリースComplete**。
- **次工程候補**：Known Issue①（iPhoneチャット履歴瞬間消失・再描画競合調査）／Known Issue②（iPhone Landscapeレイアウト崩れ・Responsive対応）／Path B／Content Planning／Carousel Builder／Publishing Readyの実動作回帰確認／IADP実AI生成からの自動保存End-to-End確認。**ユーザー承認なしに開始しない**。**Phase55未着手のまま維持**（Decision096）。

---

## 【参考・完了済み】Phase B-9F 共通Leader Rule Engine 正式リリース（Phase B-9C〜B-9F統合・2026-08-06・Decision095）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **状態**：Decision094の責務正式化に基づき、Leader統合回答プロンプト改善（Phase B-9C）と、事実整理専用の共通Leader Rule Engine（`shared/leaderRuleEngine.js`）の新規実装・Path A/Path B/手動Leader再生成3経路接続（Phase B-9D-1〜B-9D-5A）・統合検証（Phase B-9E）を正式リリースした（Decision095）。
- **共通Leader Rule Engine**：UMD形式（Node/ブラウザ両対応・外部依存なし）。公開API＝`normalizeLeaderRuleInput()`／`evaluateLeaderRuleFacts()`／`buildLeaderRulePromptBlock()`。責務は事実整理専用（入力正規化・実行状況カウント・情報不足スタブ検出・短い判断材料生成）のみで、採用/保留/却下・重複/矛盾/Evidence判定は一切行わない。v1契約に`duplicateTopics`/`conflicts`/`recommendedAdoptions`等は含めない。
- **3経路接続**：
  - Path A（`runLeaderFinalResponse()`）：`_lfAdaptTaskToRuleArtifact()`で`workflowTasks`/`reviewerTask`/`strategyTask`を変換。`mainTasks.length>0`分岐のみへPrompt Block挿入。
  - Path B（`leaderSummary()`）：`memberReplies`/`strategyReply`から構築。
  - 手動Leader再生成（`atTriggerLeaderFinal()`）：既存`memberReplies`は無変更。`_atBuildRuleArtifactsForManualRegen()`が既存`_liAdaptManualLeaderRegeneration()`を再利用し`ruleArtifacts`を`/api/leader-summary`へ**任意項目**送信。`leaderSummary()`は`ruleArtifacts`有無で分岐（未指定時はPath Bと同一ロジックへ完全フォールバック）。
- **Reviewer・Strategy**：3経路とも`isPostProcess:true`でRule Engine入力に含めるがmain担当件数からは除外。手動Leader再生成では従来`memberReplies`経由のmain混入・error/skipped不可視化という既存ギャップを`ruleArtifacts`分離で解消。
- **安全設計**：Prompt Block単一挿入（空時は見出しごと非表示）・Fail-open（Rule Engine失敗時は従来Promptのみで継続）・Prompt Injection耐性（本文原文・requestText・role自由文をBlockへ含めない・memberId/statusはCore側で正規化）。
- **既存資産との関係**：`_liCompareArtifacts()`／`_liDetectConflictCandidates()`／`_liDecideAdoptionCandidates()`は変更せず、Executive Leader Report向けの事後観測層として別系統のまま温存。
- **Gate系非干渉**：`evaluateQualityGate()`／`_edRunDecisionEngine()`／`buildOutputDraftFromLeaderFinal()`はいずれもRule Engine出力を一切参照しないことをコード確認済み。
- **正式実装した内容**：
  1. **Phase B-9C（プロンプト改善）**：Code commit **92cc49a**。
  2. **Phase B-9D-1（調査・設計）**：既存3関数の能力限界を確認・新規Core別系統方針を設計。コード変更なし。
  3. **Phase B-9D-2（共通Core実装）**：Code commit **d194ba1**。合成テスト90アサーション全PASS。
  4. **Phase B-9D-3（Path B接続）**：Code commit **0bd3a88**。合成テスト29アサーション全PASS。
  5. **Phase B-9D-4（Path A接続）**：Code commit **756d867**。合成テスト29アサーション全PASS。
  6. **Phase B-9D-5（手動再生成調査）**：`atTriggerLeaderFinal()`が`leaderSummary()`へ委譲する構造・データ品質ギャップを発見。実装は保留し報告のみ。
  7. **Phase B-9D-5A（手動再生成ruleArtifacts分離接続）**：Code commit **22ca87c**。合成テスト26アサーション全PASS。
  8. **Phase B-9E前半（静的統合検証）**：3経路因果順・共通契約・Reviewer/Strategy扱い・Cross-case保護・Gate非干渉を統合合成テスト53アサーションで確認。
  9. **Phase B-9E後半（実API統合検証）**：同一テスト案件でPath A・手動再生成・Path B（1回失敗→1回再送信で成功）を実施。Quality Gate（Path A/手動再生成でNot Passed・Path Bでnull）・decisionStatus（一貫してhold）・Constitution Validator（一貫してpassed:true）・Output Draft（Path A/手動再生成で保存・Path Bで非生成）を実測確認。Console Error 0・実費用約¥32.38（承認上限¥100以内）。
  10. **Phase B-9F（正式リリース）**：docs更新・commit・Annotated Tag作成・main push・Render反映・PC/iPhone確認。
- **未実装（次工程への引き継ぎ）**：意味的重複/矛盾検出・Evidence比較・`recommendedAdoptions`等の採否候補生成・`reviewerSignal`実質化・既存NGキーワードバグ修正・Claude応答JSON汚染の根本修正・UI上の「社内検討」明示・Completion Gate・Publishing Ready・Decision Ledger。
- **変更範囲**：**index.html／openaiClient.js／server.js／shared/leaderRuleEngine.js（新規）** ＋ docs（01/02/04DECISIONS/04ROADMAP/06HANDOVER/CHANGELOG）。**DB・schema.sql・APIはすべて既存互換**（`ruleArtifacts`は既存エンドポイントへの任意追加項目のみ）。
- **Git現在地**：branch **main**／Code commit 5件（92cc49a／d194ba1／0bd3a88／756d867／22ca87c）＋docs commit（本更新）／Annotated Tag／main push・Render反映。
- **次工程候補**：意味的重複/矛盾検出の実装検討／Evidence比較の実装検討／Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Decision Ledger／AI社員カード期限表示廃止。**ユーザー承認なしに開始しない**。**Phase55未着手のまま維持**（Decision095）。

---

## 【参考・完了済み】Phase B-9B Leader統合回答・会社正式回答責務 正式採用（Decision094・2026-08-05・docs正式化のみ）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **状態**：Phase B-9Aの調査結果をもとに、Leader統合回答（Path Aの`LEADER_FINAL_PROMPT`／Path Bの`leaderSummary()`が生成する最終回答テキスト）の責務を正式化した（Decision094）。**今回はdocs正式化のみであり、コード・プロンプト・Leader統合ロジックはいずれも変更していない**。
- **用語分離（重要）**：「Leader Summary（ELR表示）」＝Executive Leader Report内でcandidateArtifacts等を3行抜粋・折りたたみ表示する事後表示セクション（`_elrBuildReportHtml()`・Phase B-8までに完成済み・本Decisionの対象外）と、「Leader統合回答」＝Path Aの`LEADER_FINAL_PROMPT`／Path Bの`leaderSummary()`が生成しLeaderチャットへ表示する最終回答テキスト（今回およびPhase B-9全体の対象）を明確に区別する。今後docsでは後者を「Leader統合回答」と表記する。
- **正式採用内容**：
  1. **会社の唯一の正式回答**：Leader統合回答はAI社員個々の回答の連結ではなく「ENBISOU AI COMPANYとしてユーザーへ提示する唯一の正式回答」。
  2. **AI社員回答＝社内検討資料**：Writer/Researcher/Reviewer/Designer/Strategy等の個別回答は正式回答ではない。責務フロー＝`社内検討→Leader統合（重複除去・矛盾解消・採用・保留・却下）→会社回答`。**既存のAI社員タブ・dispatchカード・Workflow Live等の表示機能は削除しない**（今回UI変更なし）。
  3. **LeaderはCEO相当の最終統合責任者**：意見収集・重複除去・矛盾解消・Evidence比較・採用/保留/却下判断・情報充足の最終判断・最終成果物生成・表現統一を担う。AI社員の文章をそのまま連結して返してはならない。
  4. **要約ではなく統合**：目的は文章短縮ではなく、重複除去・矛盾解消・Evidence比較・採用/保留/却下判断・品質統一・依頼範囲への絞り込みを行った上での必要最小限の文章化。
  5. **成果物ファースト**：出力順序＝「完成成果物→必要な場合のみ補足→必要な場合のみ採用理由→必要な場合のみ社内判断の概要」。狭い依頼では不要なブランチを自動追加しない構造を目指す。
  6. **情報不足の最終判断はLeaderに帰属**：各担当は安全側で情報不足と判断してよいが、追加質問か完成品生成かの最終判断権限はLeaderが持つ。作成可能なら質問を経由せず完成品を生成し、成果物の骨格自体が成立しない場合のみ確認事項を提示する。
  7. **Gate系との責務分離**：Leader統合回答＝生成前〜生成中の判断／Quality Gate＝生成済み候補の`packageQuality.status`評価のみ（内容の的確さ・統合品質は評価しない）／Completion Gate（未実装）＝将来の事後判定でありLeader統合回答の責務を先取りしない／Executive Decision＝生成後の事後判断／Constitution Validator＝Executive Decisionの構造整合性検証のみ。
  8. **既存Leader Integration Layerとの関係**：`_liCompareArtifacts()`／`_liDetectConflictCandidates()`／`_liDecideAdoptionCandidates()`は現在Leader統合回答生成「後」の事後観測層。将来品質改善へ利用する場合は、Leader Final生成「前」へ構造化JSON要約（`{duplicateTopics,conflicts,recommendedAdoptions,holds,rejections,evidenceNotes}`）として接続する方針。
  9. **Path A／Path Bの構造差**：Path Aは`/api/auto-task`がサーバー側単一リクエスト内完結のためクライアント側Leader Integration Layerが介入できない（Decision087の制約を継承）。Path Bはクライアント側制御のため接続しやすい。二段階AI生成（追加コスト・遅延増）は第一候補にしない。
- **Phase B-9工程分割**：B-9A（調査・設計・完了）→**B-9B（今回・責務正式化・docs反映のみ・正式Complete）**→B-9C（LEADER_FINAL_PROMPT／leaderSummary()／必要に応じてstrategyConsolidate()のプロンプト改善）→B-9D（Rule Engine比較結果のLeader Final生成前接続・Path B先行）→B-9E（統合検証）→B-9F（正式リリース）。
- **未実装（次工程への引き継ぎ）**：LEADER_FINAL_PROMPT／leaderSummary()／strategyConsolidate()のプロンプト文言変更・Leader統合ロジック変更・Rule Engine比較結果のLeader Final生成前接続・UI上での「社内検討」明示・Completion Gateはいずれも未実装。「完成済み」として記録しない。
- **変更範囲**：**docsのみ**（01/02/04DECISIONS/04ROADMAP/06HANDOVER/CHANGELOG）。**index.html・openaiClient.js・server.js・lib・DB・schema.sql・API・Supabaseはすべて無変更**。
- **Git現在地**：branch **main**／docs commit（本更新）のみ／Tag作成なし／push未実施。
- **次工程候補**：Phase B-9C（Leader統合回答プロンプト改善）。**ユーザー承認なしに開始しない**。**Phase55未着手のまま維持**（Decision094）。

---

## 【参考・完了済み】Phase B-8 Quality Gate Executive Leader Report表示 正式Complete（Phase B-8A〜B-8D統合・2026-08-04）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **状態**：Phase B-7で正式採用したQuality Gate結果（`inbox.qualityGate`）を、Executive Leader Report内へ表示専用のセクションとして追加した（Decision093）。**表示のみであり、判定ロジック・評価位置・Executive Decision・Output Draft保存・Constitution Gateはいずれも変更していない**。
- **表示対象データ**：既存の`inbox.qualityGate`（`{executed, passed, status, sourceStatus}`）をそのまま使用。新規decisionId／caseId／Version等のデータ契約は追加していない。
- **表示位置**：`Executive Summary → Constitution Structure Check → Quality Gate → Leader Summary`の順（Constitution Structure Check直後・Leader Summary直前）。
- **表示文言**：通過時「🟢 Passed（complete＝完成）」「🟢 Passed（almost_ready＝ほぼ完成）」、非通過時「🟡 Not Passed（needs_work＝要改善）」「🟡 Not Passed（insufficient＝情報不足）」。`Failed`はユーザー向け主表示に使用しない。`packageQuality.score`は表示しない。
- **固定注記**：「現在のQuality Gateは成果物品質の初期判定（表示のみ）です。Executive Decision・Output Draft保存は制御しません。」を常設し、Quality Gate通過がExecutive Decision Approved／Approved Decision Package生成済み／Output Draft保存可否／Completion Gate通過／Publishing Ready／正式完成のいずれも意味しないことを明示。
- **対象経路**：Path A（Auto Task）・手動Leader再生成。**Path Bは完全非表示**：`inbox.qualityGate===null`が正常仕様（Decision092・Decision087継承）。「対象外」「未評価」等の代替表示も行わない。
- **正式実装した内容**：
  1. **調査・設計（Phase B-8A）**：ELR生成構造・Constitution Structure Check表示パターンを実コード調査。`inbox.qualityGate`は既存の第2引数`inbox`から利用可能と判断し、新規引数追加は不要と設計。コード変更なし。
  2. **表示実装（Phase B-8B）**：`_elrBuildQualityGateHtml(qualityGate)`新設（純粋関数・グローバル非参照・不正データ時は空文字列・入力非破壊・`escapeHtml`使用）。`_elrBuildReportHtml()`内で`_elrBuildQualityGateHtml(inbox && inbox.qualityGate)`を呼び出し統合。CSS新規クラス`.elr-qg-passed`／`.elr-qg-warning`／`.elr-qg-note`追加（Constitution専用`.elr-cv-*`とは分離）。合成テスト21アサーション全PASS。Code commit **04bf9c1**（`index.htmlのみ+52/-0`）。
  3. **3経路実API統合検証（Phase B-8C）**：案件`case-mschx3ex4z3c`でPath A（`sourceMode:'auto_task'`・Quality Gate=Not Passed`needs_work`・`decisionStatus:'hold'`・Constitution Validator`passed:true`12/12・Output Draft`status:'ready'`・POST1回・ELR/Quality Gateとも1件）・手動Leader再生成（新規decisionId・再評価正常・`.at-leader-final-card`正常）・Path B（`inbox.qualityGate===null`・Quality Gateセクション完全非表示・`.leader-summary-block`正常・Output Draft生成なし）を実測。Cross-case誤表示なし・F5後は`_leaderIntegration`/`_executiveDecision`/`_constitutionValidation`ともnullへリセットされ表示も消失・モバイル幅375pxで横スクロールなし・Console Error 0・Network全200。課金ロック（billingLock）はPath A自動起動を一時的にブロックする既存安全機構であり、ユーザー承認のもと検証時のみ一時解除し検証後に復元。
  4. **正式リリース（Phase B-8D）**：docs更新・commit・Annotated Tag **v1.01-quality-gate-report-display**作成・main push・Render反映・PC/iPhone本番確認。
- **F5後の扱い**：Quality Gate結果はセッション内保持のみ。F5後は`_leaderIntegration`／`_executiveDecision`／`_constitutionValidation`とともに消失し、Executive Leader Report内のQuality Gate表示も消える（既存仕様・変更なし）。永続化・F5復元は今回実装していない。
- **現在の影響範囲**：Quality Gateの表示はセッション内保持中のみ。Executive Decisionの`decisionStatus`・Approved Decision Package生成条件・Constitution Gate・Output Draft保存可否／`status`・`OUTPUT_STATUS`・Completion Gate・Publishing Readyのいずれも変更しない（表示専用）。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - **「Quality Gate Passed」の表示は、Executive Decision Approved／Approved Decision Package生成済み／Output Draft保存可否／Completion Gate通過／Publishing Ready／正式完成のいずれも意味しない**。UI上でも状態軸を混同しないこと。
  - Quality Gate結果のDB保存・decisionId/caseId付きラッパー・`qualityGateVersion`・F5復元・Executive Decisionへの制御接続・Approved Decision Package生成条件への接続・Completion Gate・Publishing Ready・Decision Ledger・AI社員カード期限表示廃止はいずれも未実装（Phase B-8後段以降候補）。
- **変更範囲**：**index.html（Code commit 04bf9c1）のみ** ＋ docs（01/02/04DECISIONS/04ROADMAP/06HANDOVER/CHANGELOG）。**server.js・lib・DB・schema.sql・API・Supabaseはすべて無変更**。
- **Git現在地**：branch **main**／Code commit **04bf9c1**＋docs commit（本更新）／Annotated Tag **v1.01-quality-gate-report-display**／main push・Render反映。
- **次工程候補（優先順位未確定・比較対象として並列記録）**：Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Quality Gate監査Version保存／Decision Ledger／AI社員カード期限表示廃止。**特定の1つを自動確定せず、正式な次工程はユーザー承認後に決定する**。**Phase55未着手のまま維持**（Decision093）。
- **既知事項**：PCとiPhoneのAPI料金表示同期ずれ・Leaderチャット履歴が一部表示されないことがある件は、いずれも既知事項として保留（Instagramシステム完成後に原因調査・修正予定という既存方針を維持・Phase B-8の不具合ではない）。
- **補足**：Phase B-8C検証中、UI探索の誤操作により`applyLeaderTemplate('sns_flow')`からテンプレートタスク9件が生成された（AI API呼び出しなし・追加コストなし・Quality Gate表示への影響なし・Phase B-8の不具合ではない）。削除は本工程の対象外・ユーザー側で後日手動削除可能。

---

## 【参考・完了済み】Phase B-7 Quality Gate 正式Complete（Phase B-7A〜B-7H統合・2026-08-04）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **状態**：Output Package Quality（`packageQuality`）を正本入力・単軸とするQuality Gateを正式採用した（Decision092）。
- **Quality Gate入力**：`packageQuality`のみ。Approved Decision Package・Executive Decision・Leader Final文章・Executive Leader Report・Constitution Validation・Completion Gate・`OUTPUT_STATUS`・Publishing Ready・正式Output Draft全体は評価対象外。
- **通過基準**：`packageQuality.status === 'complete'`または`'almost_ready'`のみ通過（`passed:true`）。`needs_work`／`insufficient`／未知値／`status`欠落／不正入力はすべて非通過。**`score`・数値thresholdは判定に使用しない**。
- **因果順序**：`candidate Draft → fields構築 → packageQuality算出 → Quality Gate評価 → Executive Decision → 正式Output Draft確定 → Output Draft保存`。Quality Gateは`packageQuality`算出後・Executive Decision実行前・正式Output Draft確定前・Output Draft保存前に実行される。
- **正式実装した内容**：
  1. **調査・設計（Phase B-7A〜B-7C）**：Quality Gateの正本入力を`packageQuality`単軸とし、Constitution Gate（判断プロセスの構造整合性）と責務分離。実データ調査（N=6）で通過基準を`complete`／`almost_ready`（status方式）と確定。
  2. **安全リファクタ（Phase B-7D）**：`buildOutputDraftFromLeaderFinal(finalText, opts, targetDraft)`へ第3引数`targetDraft`を追加。省略時は`_lastOutputDraft`使用で既存2呼び出し箇所は完全後方互換。Code commit **f866d4d**。
  3. **評価位置接続（Phase B-7E）**：`_lastOutputDraft`とは独立したcandidate Draft`{type,fields:{}}`を`_liCollectIntegration()`内`_edRunDecisionEngine()`直前で生成。`candidateOnly:true`早期returnによりfields構築とpackageQuality算出のみを行い保存を伴わない。評価結果を`inbox.qualityGate`へ格納。Code commit **0f104d3**。
  4. **実判定実装（Phase B-7F）**：`evaluateQualityGate(packageQuality)`へ実判定ロジックを実装。戻り値`{executed:true, passed, status:'passed'|'failed', sourceStatus}`。Code commit **1a92884**。
  5. **統合検証（Phase B-7G）**：index.htmlから実装コードを直接抽出した合成テスト14/14 PASS。Path A・手動Leader再生成・Path B 3経路の実APIテストで因果順序を実測確認（コード変更なし）。
  6. **正式リリース（Phase B-7H）**：docs更新・commit・Annotated Tag **v1.01-executive-quality-gate**作成・main push・Render反映・PC/iPhone本番確認。
- **対象経路**：Path A（Auto Task）・手動Leader再生成。**Path Bは正式に対象外**：`detectOutputType()`・`createOutputDraft()`・`buildOutputDraftFromLeaderFinal()`のいずれも呼び出されずcandidate Draft生成契約が存在しないため。`inbox.qualityGate===null`がPath Bの正常仕様（Decision087の「Path B＝Output Draft制御対象外」を継承）。他案件の`_lastOutputDraft.type`や残留Draftを代用しない。
- **現在の影響範囲**：Quality Gate結果はセッション内保持のみ（`_leaderIntegration.qualityGate`）。`passed:false`でも、Executive Decisionの`decisionStatus`・Approved Decision Package生成条件・Constitution Gate・Output Draft保存可否／`status`・`OUTPUT_STATUS`・UI表示・Publishing Ready・Completion Gateのいずれも変更しない。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - **Quality Gateは「判定結果の保持」のみを行う**：現段階では何も制御しない。将来Executive Decisionのapproved到達条件やPublishing Ready判定へ接続する場合は、既存Workflow保護原則（第14条）に基づき段階導入を検討すること。
  - **`packageQuality.status`とQuality Gate自身の`status`（'passed'/'failed'）を混同しない**：`sourceStatus`フィールドで元の値を保持している。
  - **Path Bには適用しない**：Output Draft候補生成契約が存在しないため、無理に評価しようとしない。`_lastOutputDraft.type`や他案件Draftの代用は第6条（事実性原則）・第8条（案件分離原則）違反となる。
  - Completion Gate・Publishing Ready・Decision Ledger・Executive Memory・Quality Gate UIはいずれも未実装（Phase B-7後段以降候補）。
- **変更範囲**：**index.html（Code commit f866d4d／0f104d3／1a92884）のみ** ＋ docs（01/02/04DECISIONS/04ROADMAP/06HANDOVER/CHANGELOG）。**server.js・lib・DB・schema.sql・API・Supabaseはすべて無変更**。
- **Git現在地**：branch **main**／Code commit 3件（f866d4d／0f104d3／1a92884）＋docs commit（本更新）／Annotated Tag **v1.01-executive-quality-gate**／main push・Render反映。
- **次工程候補（優先順位未確定・比較対象として並列記録）**：Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Quality Gate監査Version保存／Decision Ledger／Quality Gate UI・Executive Leader Report表示／AI社員カード期限表示廃止。**特定の1つを自動確定せず、正式な次工程はユーザー承認後に決定する**。**Phase55未着手のまま維持**（Decision092）。

---

## 【参考・完了済み】Phase B-6 Constitution Gate 正式Complete（Phase B-6A〜B-6D統合・2026-08-03）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **状態**：Constitution Structure Check正式採用（Phase B-5C・正式Complete・維持）で表示のみだったConstitution Validator Coreの検証結果を、Approved Decision Packageの複製可否判定（`fields.approvedDecisionPackage`受け渡し条件）へ「狭域Constitution Gate」として接続した（Decision091）。
- **正式実装した内容**：
  1. **調査・設計（Phase B-6A）**：Constitution Gateの接続方式として「広域Gate」（Executive Decision Engine本体・Package生成ロジックへの組み込み・Constitution違反時にDecision生成自体を停止）と「狭域Gate」（Package複製可否のみへの限定接続）を比較検討。広域Gate案はQuality Gate・Completion Gate未定義の現段階で既存Phase B-5Cの正常動作（Executive Leader Report・Constitution Structure Check表示）にまで影響が及ぶリスクがあるため不採用とし、狭域Gate案を正式採用。
  2. **実装（Phase B-6B）**：Path A（`atRunWorkflow()`）・手動Leader再生成（`atTriggerLeaderFinal()`）双方の`fields.approvedDecisionPackage`受け渡し条件へ、既存の`sourceDecisionId`一致・`caseId`一致に加え、`_constitutionValidation`存在／decisionId一致／caseId一致／`result.passed===true`の4条件をANDで追加。いずれか不成立時は既存どおりfail-closed（nullのまま・例外なし）。Validator本体・Executive Decision Engine本体・Package生成ロジック・Output Draft本文は無変更。Code commit **9436fec**（`index.htmlのみ+20/-2`・Path A/手動Leader再生成の2箇所に限定）。
  3. **実APIテスト・回帰確認（Phase B-6C）**：既存テスト案件を再利用し、Auto Task1回・手動Leader再生成1回・Path B dispatch1回を実施。3経路とも正常完了・Executive Leader Report生成・Constitution Structure Check Passed（12/12）・Console Error 0・Network全200 OKを確認。3経路とも`decisionStatus`は`hold`のため`approvedDecisionPackage`は常に`null`であり、Gate追加が既存正常系動作へ副作用を与えないことを実測確認。
  4. **正式リリース（Phase B-6D）**：docs更新・commit・Annotated Tag **v1.01-executive-constitution-gate**作成・main push・Render反映。
- **変更範囲**：**index.html（Code commit 9436fec）のみ** ＋ docs（01/02/04DECISIONS/06HANDOVER/CHANGELOG）。**server.js・lib・DB・schema.sql・API・Supabaseはすべて無変更**。
- **Git現在地**：branch **main**／Code commit **9436fec**＋docs commit／Annotated Tag **v1.01-executive-constitution-gate**／main push・Render反映。
- **次工程候補**：Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止。**Phase55未着手のまま維持**（Decision091）。

---

## 【参考・完了済み】Phase B-5C Constitution Structure Check 正式Complete（Phase B-5C-1〜B-5C-3統合・2026-08-03）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **状態**：Constitution Validator Core（Phase B-5・正式Complete・維持）の検証結果を、Executive Leader Report内の独立セクション「Constitution Structure Check」として表示し、Auto Task・手動Leader再生成・Path B（dispatch成立時）の完了直後に即時反映される状態まで完成した（Decision090）。
- **正式実装した内容**：
  1. **Decision対応契約（Phase B-5C-1）**：`_constitutionValidation`を`{decisionId, caseId, result}`のセッション内ラッパーへ変更。Validator関数自体・戻り値構造・12検証項目は無変更。代入箇所は`_edRunDecisionEngine()`内2箇所のみに限定。
  2. **Executive Leader Report表示（Phase B-5C-2）**：`_elrBuildReportHtml(decision, inbox, validation)`へ第3引数追加（グローバル直接参照なし・純粋関数性維持）。Executive Summary直後・Leader Summary直前へ独立表示。Passed時「Passed（N/N）」1行のみ・Violations時`message`常時表示＋`rule`は技術詳細折りたたみ内のみ・固定注記常設・不正データでも例外なしの安全側正規化。
  3. **即時再描画接続（Phase B-5C-3）**：`_elrRenderIntoChatArea()`の挿入を`insertBefore`化し、新設`_elrRefreshInChatArea()`（チャット全体を再構築しない限定更新）をPath A・手動再生成・Path B（dispatch成立時のみ）へ接続。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - **Path Bはチャット全体再構築を使わない**：`.leader-summary-block`という専用DOM直接追記スタイルを既存`reRenderChatArea()`で再構築すると失われるため、`_elrRefreshInChatArea()`（Executive Leader Report要素のみの差し替え）を新設した。将来Executive Leader Report関連の表示更新を追加する際は、この限定更新方式を踏襲すること（チャット全体再構築を安易に追加しない）。
  - **`_constitutionValidation`はEDE内以外で代入しない**：Decision対応契約の安全性（decisionId/caseIdの同時ペア保証）は、`_edRunDecisionEngine()`内でのみ代入されることに依存している。この前提が崩れると誤対応表示のリスクが生じる。
  - **「Constitution Structure Check」は12項目の構造整合性検証のみ**：Executive Constitution全14条の完全な意味論的検証ではない。`passed:true`をApproved・完成・品質合格の意味で表示・記録しないこと。
  - **AI社員カードの「期限」表示は本工程でも変更していない**（別途対応保留・本工程の対象外）。
  - Quality Gate・Completion Gate・Decision Ledger・Executive Memory・Validator違反時の制御はいずれも未実装（Phase B-5C後段以降候補）。
- **変更範囲**：**index.html（Code commit a2834d3／9e6d094／58315ee）のみ** ＋ docs（00/01/02/04DECISIONS/04ROADMAP/06HANDOVER/CHANGELOG）。**server.js・lib・DB・schema.sql・API・Render・Supabaseはすべて無変更**。
- **Git現在地**：branch **main**／Code commit 3件（a2834d3／9e6d094／58315ee）＋docs commit／Tag作成なし（B-6Dで正式リリース済み）。
- **次工程候補（優先順位未確定・比較対象として並列記録）**：Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止。**特定の1つを自動確定せず、正式な次工程はユーザー承認後に決定する**。**Phase55未着手のまま維持**（Decision090）。

---

## 【参考・完了済み】Phase B-5 Constitution Validator Core 正式Complete（2026-08-03）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **状態**：Approved Decision Package契約構造正式実装（Phase B-4・正式Complete・維持）の次工程Constitution Validatorについて、`validateExecutiveDecision(decision)`をExecutive Decision Engine Core内へ正式実装した（Decision089）。**今回正式Completeとする範囲は「Constitution Validator Core」（12項目の構造整合性検証・読み取り専用）のみ**。
- **正式実装した内容**：
  1. **Validator本体**：`validateExecutiveDecision(decision)`を独立関数として新設。引数`decision`は読み取り専用（プロパティ代入・削除なし）。新しいDecisionを生成せず、Decision・Approved Decision Package・Output Draftのいずれも変更しない。戻り値は`{version, passed, violations, checkedRules}`のみ。
  2. **呼び出し位置**：`_edRunDecisionEngine()`内`_executiveDecision = decision;`確定直後にのみ実行し、結果を新設のセッション内変数`_constitutionValidation`へ保持（Decision生成→確定→Validator実行→保持→既存後続処理の順で固定・確定前に実行される経路なし）。例外は`try/catch`で隔離しEDE本体・後続処理は止めない。早期return時は`_constitutionValidation`も`null`へリセット。
  3. **検証項目（12項目・構造整合性検証のみ）**：`executive_decision_exists`／`decision_id_present`／`decision_status_present`／`executive_summary_present`／`decision_confidence_present`／`source_decision_id_consistency`／`package_only_when_approved`／`package_null_when_not_approved`／`output_draft_did_not_generate_package`（既存`affectsOutputDraft===false`参照）／`package_holds_source_decision_id`／`cross_case_consistency`／`single_decision_authority`。
  4. **Path別接続確認（実APIテスト）**：Path A（`atRunWorkflow()`）・手動Leader再生成（`atTriggerLeaderFinal()`）とも`passed:true・violations:[]`を実測。Path Bはdispatch発生時のみ同一経路を通る既存仕様（無変更・強制再現テストは未実施）。
  5. **非破壊性**：`git show --stat ea1ae68`で変更範囲がExecutive Decision Engine Coreセクション内3箇所に限定されることを確認。Executive Leader Report・Output Draft生成・F5復元・Approved判定ロジック（`_edDecideStatus()`）は無変更。Node合成テスト13シナリオ26アサーション全PASS。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - **「Executive Constitution全14条を完全実装済み」ではない**。今回実装したのは12項目の構造整合性検証のみ。Executive Constitution全14条の完全な意味論的検証・Evidence内容の十分性判定・成果物品質/完成度の実質評価・Constitution違反によるOutput停止・Validator結果のUI表示・Quality Gate・Completion Gate・Decision Ledger・Executive Memoryはいずれも未実装のまま。この区別を次工程でも維持すること。
  - **Validator結果は現時点で何も制御しない**：`_constitutionValidation`はセッション内メモリに保持されるのみで、Executive Leader Reportへの表示・Output Draft生成の制御・Leader Finalの停止のいずれにも使用していない。次工程でこれらへ接続する場合は、既存Workflow保護原則（第14条）に基づき段階導入を検討すること。
  - **F5でValidator結果は消失する**：`_executiveDecision`と同様、`_constitutionValidation`もF5で`null`にリセットされる。永続化・復元は今回追加していない。
  - **AI社員カードの「期限」表示は本工程でも変更していない**（別途対応保留・本工程の対象外）。
- **変更範囲**：**index.html（Code commit ea1ae68）のみ** ＋ docs（00/01/02/04DECISIONS/04ROADMAP/06HANDOVER/CHANGELOG）。**server.js・lib・DB・schema.sql・API・UI・Render・Supabaseはすべて無変更**。
- **Git現在地**：branch **main**／Code commit ea1ae68（前工程で実施済み）＋docs commit（本更新）／Tag作成なし／**push未実施**（ユーザー確認後に別途判断）。
- **次工程候補（優先順位未確定・比較対象として並列記録）**：Validator結果のExecutive Leader Report表示／Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止。**特定の1つを自動確定せず、正式な次工程はユーザー承認後に決定する**。**Phase55未着手のまま維持**（Decision089）。

---

## 【参考・完了済み】Phase B-4 Approved Decision Package 契約構造正式実装・統合検証正式Complete（Phase B-4A〜B-4E・2026-08-03）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **状態**：Executive Leader Report表示（Phase B-3・正式Complete・維持）の次工程Approved Decision Packageを、契約構造（Phase B-4A）・Path A接続（Phase B-4B）・手動Leader再生成接続（Phase B-4C）・fields複製保存/F5復元/後方互換（Phase B-4D）として段階実装し、Phase B-4Eで統合検証・正式完了判定を行った（Decision088）。
- **正式実装した内容**：
  1. **Decision ID常時発行（Phase B-4A）**：`_edRunDecisionEngine()`冒頭で`decisionId`（`'ed-' + genId()`）をdecisionStatus（approved/rejected/hold/insufficient）に関わらず必ず1回発行し、最終`decision`オブジェクトへ含める。
  2. **Approved Decision Package契約構造（Phase B-4A）**：`_edBuildApprovedDecisionPackage()`はApproved時のみPackageを返し、独自IDを持たず`sourceDecisionId: decisionId`のみで元Decisionを参照する（第9条・単一正本原則）。
  3. **Path A接続（Phase B-4B）**：`atRunWorkflow()`が`caseId`／`sourceDecisionId`の三重一致確認のうえPackageを取得し`buildOutputDraftFromLeaderFinal()`のoptsへ渡す。既存Output Draft挙動・POST回数（1回）は完全無変更。
  4. **手動Leader再生成接続（Phase B-4C）**：`atTriggerLeaderFinal()`にPath Aとは独立した変数命名で同型ロジックを実装。旧Package誤適用防止4ケース（caseId不一致／sourceDecisionId不一致／今回非Approved／Decision不在）をすべて確認。
  5. **fields保存・F5復元・後方互換（Phase B-4D）**：`buildOutputDraftFromLeaderFinal()`終盤で`fields.approvedDecisionPackage`へ参照をそのまま格納（Packageなし時は明示的にキー削除・残留防止）。旧形式Draft（キー自体が存在しないfields）でも例外なく動作。新規deepClone等の共通基盤は追加していない（既存POST→DB JSONB→GET往復が自然に独立コピーを生むため）。
  6. **統合検証・正式完了判定（Phase B-4E）**：Node合成テスト13項目全PASS。実APIテスト（Auto Task1回＋手動再生成1回）でdecisionId相違・sourceMode/sourceEngine区別・`approvedDecisionPackage:null`（Hold状態のため正常）・`fields.approvedDecisionPackage`キー不在（生成時・F5復元後とも）・既存Output Draftフィールド無傷・Executive Leader Report正常描画・Cross-case保護・Console Error 0・Network 200のみを実機確認。`buildOutputDraftFromLeaderFinal()`冒頭の古いコメント（Phase B-4D実装前の記述のまま）という軽微な不整合のみを発見し、コメントのみ修正（commit **b423acd**・ロジック変更なし・機能commit群とは別コミット）。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - **所有関係**：Executive Decision Engine＝Approved Decision Packageの論理上の発行元・正本。Packageは`sourceDecisionId`のみを持ち自身のIDを持たない。`fields.approvedDecisionPackage`＝Output Draft側の複製（利用者であり所有者ではない）。将来のDecision Ledger（Phase C-1）が永続正本となる設計を維持する。
  - **通常運用ではApproved Decision Packageは常にnull**（Quality Gate・Completion Gate未定義の間はdecisionStatusがapprovedへ到達しない設計のため）。これは不具合ではなく正常な安全側動作である。
  - **AI社員カードの「期限」表示は本工程では変更していない**（別途対応予定・本工程の対象外）。
  - Constitution Validator・Quality Gate・Completion Gate・Decision Ledger永続化・`fields.executiveDecisionCache`はいずれも未実装（Phase B-5以降）。
- **変更範囲**：**index.html（Code commit 718f200／67ab6cb／95beda3／65fe551／b423acd）のみ** ＋ docs（01/02/04DECISIONS/04ROADMAP/06HANDOVER/CHANGELOG）。**server.js・lib・DB・schema.sql・API・UI・Render・Supabaseはすべて無変更**。
- **Git現在地**：branch **main**／Code commit 5件（718f200／67ab6cb／95beda3／65fe551／b423acd）＋docs commit（本更新）／Tag作成なし／**push未実施**（ユーザー確認後に別途判断）。
- **次工程候補**：Phase B-5 Constitution Validator（未着手）。ただしユーザー承認なしに開始しない。**Phase55未着手のまま維持**（Decision 088）。

---

## 【参考・完了済み】Phase B-2 Executive Decision Control 正式工程分割（Phase B-2A／B-2B・2026-08-02・docs正式化のみ）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **状態**：Executive Decision Engine Core（Phase B-1・正式Complete・維持）の次工程Executive Decision Controlについて因果接続方式を正式調査し、既存Phase B-2をPhase B-2A／B-2Bへ正式分割した（Decision087）。**今回はdocs正式化のみ・コード/DB/API/UI変更は一切なし**。
- **正式採用した内容**：
  1. **構造的制約（実測）**：`atRunWorkflow()`が呼ぶ`/api/auto-task`は、AI社員実行→Reviewer→Strategy統合→`runLeaderFinalResponse()`（完成成果物生成）までを単一の非同期関数・単一HTTPリクエスト/レスポンス往復の中で完結させる。クライアント側EDEはLeader Final生成前のデータへ介入できない。
  2. **接続方式**：案D（段階導入）。Leader Final候補生成後・Output Draft確定前にEDEを接続。追加AI実行なし。第1段階＝EDE実行位置移動・判断結果はまだOutput Draftへ反映しない（Phase B-2A）。
  3. **Phase B-2A（Executive Decision Control — Path A Causal Position）**：対象はPath A通常フロー（`atRunWorkflow()`）のみ。目的は因果位置と入力契約の確立であり、正式な成果物制御ではない。既存Output Draft挙動・POST回数（1回）は完全無変更。
  4. **Phase B-2B（Manual Leader Regeneration Alignment）**：対象は`atTriggerLeaderFinal()`。実測発見＝完成成果物エンジン`runLeaderFinalResponse()`ではなく軽量な`leaderSummary()`を使用し、EDEが読む`_wlLastResults`は前回Auto Task時点のスナップショットのまま今回生成結果と紐づいていない。Phase B-2A完了後に開始（同時実装しない）。
  5. **Path B通常チャット**：Output Draft生成が存在しないため制御対象外のまま維持（EDE実行自体は許可）。
  6. **Leader Final Candidate**：`candidateArtifacts`（AI社員個別成果物）とは別の内部契約。`sourceEngine:'runLeaderFinalResponse'|'leaderSummary'`で完成成果物と軽量方針サマリーを区別する方針。
  7. **Approved暫定条件**：Quality Gate・Completion Gate未定義の間はdecisionStatusをapprovedへ到達させない（Auto Task・既存Leader Final・既存Output Draftは従来どおり継続）。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - Phase B-2Aの目的は正式な成果物制御ではなく**因果位置と入力契約の確立**。既存Output Draft挙動・POST回数（1回）を完全無変更のまま検証すること。
  - Phase B-2Bは**Phase B-2A完了後に開始**（同時実装しない）。
  - `atTriggerLeaderFinal()`は`leaderSummary()`（軽量方針サマリー）を使用しており、`runLeaderFinalResponse()`（完成成果物）とは異なるエンジンであることを、今後Leader Final Candidateを扱う実装で必ず区別すること。
  - `_executiveDecision`は引き続き`executionMode:'post_observation'`／`affectsLeaderFinal:false`／`affectsOutputDraft:false`／`affectsOutputEngine:false`を維持しており、**Executive Decision EngineがOutputを既に制御しているとは記述しない**。
  - Decision ID（`decisionId`）は現状Approved時のみ生成される。状態に関わらず発行する設計が将来Decision Ledger（Phase C-1）接続のため必要になる可能性があるが、Phase B-2Aでは実装しない。
- **正式ロードマップ改訂**：Phase B-1（正式Complete・維持）→Phase B-2A（本工程候補）→Phase B-2B→**Phase B-3**（Executive Leader Report・旧B-2相当）→**Phase B-4**（Approved Decision Package・旧B-3相当）→**Phase B-5**（Constitution Validator・旧B-4相当）→Phase A-2〜A-4→Phase C-1〜C-3→Phase D-safety→Phase D→Phase E→Phase F-1〜F-2。詳細は`04ROADMAP.md`参照。
- **変更範囲**：**docsのみ**（01/02/04DECISIONS/04ROADMAP/06HANDOVER/CHANGELOG）。**index.html・openaiClient.js・server.js・lib・DB・schema.sql・API・UI・Render・Supabaseはすべて無変更**。
- **Git現在地**：branch **main**／docs commit＝本更新（以降の最新HEAD）／Tag作成なし／**push未実施**（ユーザー確認後に別途判断）。
- **次工程候補**：Phase B-2A Executive Decision Control — Path A Causal Position（未着手）。ただしユーザー承認なしに開始しない。**Phase55未着手のまま維持**（Decision 087）。

---

## 【参考・完了済み】Phase A-1g Executive Constitution v1.0.0 正式化 ／ Executive Decision Engine 正式採用（2026-08-02・docs正式化のみ）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**
- **状態**：Leader Integration Layer Phase A（正式Complete・維持）の次工程着手前に、AI COMPANY全体の上位アーキテクチャを正式設計・docs採用した（Decision086）。**今回はdocs正式化のみ・コード/DB/API/UI変更は一切なし**。
- **正式採用した内容**：
  1. **Executive Constitution v1.0.0**（全14条・AI COMPANY全体の最高位ルール）。第1条Evidence原則〜第14条安全側既定値原則。変更統制＝ユーザー承認・Version更新・`04DECISIONS.md`（暫定正本）またはDecision Ledger（正式正本）への記録の3条件必須。Self Improvement等いかなるEngineもConstitutionを変更・緩和できない（提案のみ可）。
  2. **Executive Decision Engine**：新規独立Engineではなく、**既存Leader Integration Layer Phase Aの`_leaderIntegration`／Leader Inboxを因果連鎖内へ昇格させる会社判断層**として正式採用。正式責務＝統合・要約・矛盾確認・Evidence充足確認・採否判断・優先順位決定・Strategic Alternatives管理・Decision Confidence算出・Approved Decision Package生成。非責務＝Leader Final本文生成・Output Engine成果物生成・Learning Center実績保存・`OUTPUT_STATUS`/`packageQuality.status`の所有。
  3. **Executive ReportとOutput Engine完成成果物の併存**：既存`LEADER_FINAL_PROMPT`は無変更。Executive Summary（結論／採用案／採用理由／却下・保留案／期待成果／主要リスク／次工程）を上位判断層として将来Approved Decision Packageへ追加する方針。
  4. **状態3軸分離**：`decisionStatus`（新設）／`outputStatus`（既存`OUTPUT_STATUS`）／`qualityStatus`（既存`packageQuality.status`）。既存2軸は無変更。
  5. **Decision Confidence方針**：既存`_intelCalculateConfidence()`再利用＋Hard Gate上乗せ（completed成果0件はInsufficient固定等）。新加重式は発明しない。
  6. **Strategic Alternatives方針**：Primary1件／Secondary最大2件／Hold最大3件。順位と判断状態は別軸。自動切替は現段階で行わない。
  7. **Approved Decision Package方針**：Output Engineへの将来の唯一の正式契約。導入時は後方互換必須・Package不在時は既存Workflow維持。
  8. **保存方式（段階導入案D）**：Phase B＝メモリのみ→Phase B後半候補＝Output Draftへの一時キャッシュ（正本と誤認しない名称に限定）→Phase C-1＝専用`executive_decisions`永続化。
  9. **Executive Memory**：Decision Ledger永続化済み・Learning Center永続化済み・Outcome Record存在・Instagram実運用データ存在・Self Improvement利用可能、を着手条件としPhase F-2（最後段）に配置。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - **`_leaderIntegration`（Phase A）は現時点で成果物確定後の事後観測層**であり、Leader Final生成・Output Draft確定・Output Engine入力のいずれにも接続されていない。Phase B-1でこれを因果連鎖内へ昇格させることが次工程の中核作業。
  - **`output_drafts`は`output_id`がPRIMARY KEYのupsert上書き方式**であり、追記型・過去記録不変（第11条）の要件と構造的に非互換。Decision Ledgerの正本として使用しない（一時キャッシュとしての限定利用のみ許容）。
  - Executive ReportでLeader Final完成成果物を置き換えてはならない（Version1最重要目的＝Instagram毎日運用の完成成果物生産を破壊するため）。
  - Constitution変更はSelf Improvement・Executive Memory・Executive Decision Engineを含むいかなるEngineも自動実行できない。ユーザー承認・Version更新・記録の3条件が必須。
- **正式ロードマップ改訂**：Phase A（正式Complete）→Phase A-1g（本工程）→**Phase B-1〜B-4**（Executive Decision Engine Core／Executive Leader Report表示／Approved Decision Package契約化／Constitution Validator）→Phase A-2〜A-4（内容無変更・順序のみ後退）→**Phase C-1〜C-3**→Phase D-safety→Phase D→Phase E→**Phase F-1〜F-2**。詳細は`04ROADMAP.md`参照。
- **変更範囲**：**docsのみ**（01/02/04DECISIONS/04ROADMAP/06HANDOVER/CHANGELOG）。**index.html・openaiClient.js・server.js・lib・DB・schema.sql・API・UI・Render・Supabaseはすべて無変更**。
- **Git現在地**：branch **main**／docs commit＝本更新（以降の最新HEAD）／Tag作成なし／**push未実施**（ユーザー確認後に別途判断）。
- **次工程候補**：Phase B-1 Executive Decision Engine Core（未着手）。ただしユーザー承認なしに開始しない。**Phase55未着手のまま維持**（Decision 086）。

---

## 【参考・完了済み】AI COMPANY Leader Integration Layer（Phase A） **正式Complete**（2026-08-01・Code commit 5401b68/6032893/0d125e7・main push・Render反映・PC本番確認 完了）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（Leader Integration Layer Phase A完成を理由にPhase55を開始しない）
- **状態**：Phase A本体（Decision084）に続き、次の3工程を正式リリースComplete。PC本番確認も完了し、**Leader Integration Layer Phase A 正式Complete**として確定。
  1. **messages案件別正本化**（工程1）：`/api/auto-task`・`/api/consult`の`saveMessage()`計4箇所へcaseIdを追加。
  2. **Leader Final状態サマリー分離**（工程2）：`completed`成果は既存どおり統合しつつ`error`/`skipped`を分離しLeaderへ渡す。
  3. **Output Draft誤認防止**（工程3-2）：工程3統合検証で「completed成果0件時にOutput Draftが`status:'ready'`・Package Quality87点『良好』評価のまま保存される」誤認問題を実測発見し、`noCompletedResults`判定で`status:'error'`・`score:0・insufficient`へ修正。
- **PC本番確認結果（ユーザー実施）**：ログイン正常・Auto Task正常・Leader Integration Layer正常・AI社員振り分け正常・Leader Final正常生成・Output Engine正常表示・Task同期正常・案件切替正常・Cross-case混入なし・Console Errorなし・Network異常なし。Task表示は全案件13件・案件を開くと該当案件のみ表示（既存の正常仕様として確認）。Output Engineの内容差分はLeader Integration Layer改善に伴う正常な更新として確認・異常なし。**iPhone実機確認は対象外**。
- **変更範囲**：**`index.html`＋`openaiClient.js`のみ**（工程1 Code commit **5401b68**・工程2 Code commit **6032893**・工程3-2 Code commit **0d125e7**）。**server.js（messages案件別正本化を除き）・DB・schema.sql・API はすべて無変更**。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - Output Draftの`status`は`buildOutputDraftFromLeaderFinal()`呼び出し元が渡す`opts.noCompletedResults`（`runLeaderFinalResponse().integratedCount===0`）で分岐する。呼び出し元を増やす場合、この判定を渡し忘れると誤認防止が効かない（現状はPath A（`atRunWorkflow`）のみ対応・手動Leader Final再生成（`atTriggerLeaderFinal`）は対象外＝従来どおりREADY固定）。
  - Leader Finalの「## 担当実行状況」独立見出しは**プロンプト指示によるものであり、出力形式を保証するものではない**（LLMの解釈に依存）。`LEADER_FINAL_PROMPT`自体は変更していないため、将来的に出力が揺れる可能性がある。
  - `LIVE_TO_TASK_STATUS`に`skipped`の変換先がなく、サーバー側でskippedになったTaskはクライアントTask管理画面上`requested`/`in_progress`のまま停滞する（既存の制約・今回未対応）。
  - `messages`テーブルはRLSにDELETEポリシーがなく、テストデータの物理削除が不可（累計remaining約53件）。RLSポリシー追加・Service Role Key導入とも今回は見送り。対応する場合はセキュリティ影響評価とユーザー承認が必要。
- **Git現在地**：branch **main**／Code commit **5401b68＋6032893＋0d125e7**／docs commit＝本更新（以降の最新HEAD）／Annotated Tag **v1.01-leader-integration-phase-a-complete**／main push・Render反映・**PC本番確認完了**。
- **次工程候補（未着手・採用判断は次回以降）**：Phase A-2 AI社員間再依頼／Phase A-3 成果物受け渡し汎用化／Phase A-4 Quality Loop／messages RLS対応・Task skipped同期ギャップ対応等の残課題整理。**Phase55未着手のまま維持**（Decision 085）。

---

## 【参考・完了済み】AI COMPANY Leader Integration Layer（Phase A） **正式リリースComplete**（2026-07-31・Code commit ad5eaf7/af43263・main push・Render反映・PC本番確認・iPhone実機確認はこれから実施）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（Leader Integration Layer完成を理由にPhase55を開始しない）
- **状態**：Leaderを「各AI社員の回答を要約する司会者」から「成果物を回収・比較・矛盾候補検出・採否候補判定する統合管理層」へ拡張する**Phase A（A-1a〜A-1f）を正式リリースComplete**。実装検証中に既存不具合（案件切替後の手動Leader Final再生成によるOutput Draft案件混入）を発見し、同一リリースでHotfixも実施。
- **変更範囲**：**`index.html` の1ファイルのみ（Phase A本体 +336/-6・Hotfix +11/-0）**。**server.js・lib・DB・schema.sql・API・既存Path A/Path B内部処理・`switchCase()`・`.at-result-card`仕様・chatHistory構造・Output Draft保存仕様 はすべて無変更**。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - Leader Integrationは**Path A（Auto Task）／Path B（Leader手動チャット）共通の回収・比較・矛盾候補・採否候補構造化層**。両Pathの既存処理は無変更のまま、末尾から`_liCollectIntegration()`を1回だけ呼ぶ方式（Path A Adapter／Path B Adapterで差異吸収）。
  - **保存はクライアント一時メモリ（`_leaderIntegration`）のみ**。F5で消失する。Output Draftへの永続化はPhase B以降で再判断（今回は意図的に見送り）。
  - Path A Adapterは`_atTaskHistory`ではなく**`_wlLastResults`をソースに採用**（`_atTaskHistory`は`agentId`/`result`フィールドを持たないことを実測で確認したための判断・既存`_getRoleReplyText()`の潜在課題として別途認識のみ）。
  - Path Bは**`interactionId`（`'li-'+genId()`）とworkflowIdを分離**し、`_liPathBSession`（chatHistory非接触）でdispatchTs以降・対象memberId限定の対応管理により過去回答・別依頼の混入を防止。
  - 比較・矛盾候補検出は**ルールベースのみ**（追加AI実行なし）。矛盾は必ず`label:'candidate'`、採否候補は情報不足時**必ず`hold`が既定値**（Reviewer未実行を合格扱いにしない・自由文だけで確定採否を出さない）。
  - **★案件混入Hotfixの教訓**：既存のOutput Draft復元保護ロジック（Phase54-2d・`_canReplaceDraftWithRestore`）は「進行中/完成直後のWorkflow Draftを古いDB Draftで壊さない」ための安全設計だが、**「案件を切り替えてから手動でLeader Finalを再生成する」操作パターンを想定していなかった**ため、副作用として`_lastOutputDraft`が他案件のまま保護され続け、`output_id`一意キー（`onConflict:'output_id'`）のPOSTで別案件へDraft行が移動する事故を起こし得た。**新しい保存経路や状態管理を追加する際は、既存の「保護ロジック」が想定していない操作順序がないか必ず確認すること**。
  - Hotfixは`atTriggerLeaderFinal()`冒頭の局所ガード（案B）のみを採用し、`switchCase()`本体の変更（案A）は見送った（Approval Sync・Task Sync・Affiliate復元等、複数の既存スケジュール処理との相互作用リスクを避けるため）。
  - finalSummary（文章による最終結論生成）・成果物添付表示・Progress UI・Knowledge Summary・Output Draft永続化接続はPhase B以降。AI社員間の自動差し戻し（Phase A-2）・成果物受け渡しの汎用化（Phase A-3）・Quality Loop（Phase A-4）は設計のみ完了・実装は未着手。
- **Git現在地**：branch **main**／Code commit **ad5eaf7（Phase A本体）＋af43263（Hotfix）**／docs commit＝本更新（以降の最新HEAD）／Annotated Tag **v1.01-leader-integration-phase-a**（作成予定）／**main push・Render反映はこれから**（ユーザー承認後）。保護対象4件は未stage・未commitで保護。
- **検証済み**：Path A／Path Bとも`pathSource`/`workflowId`/`interactionId`/`caseId`の正しい分離を実機確認。同一案件での手動Leader Final再生成は正常動作。**Hotfix適用前に実際の混入事故を実機で確認**（診断用Output Draft`out_1785449189461`が検証専用案件`case-ms82952wltd5`から既存案件「テスト」（`case-ms7n2jqdt6t6`）へ移動）し、既存POST経路（`/api/output-drafts`）で復旧。Hotfix適用後は同一条件の再現テストで`/api/leader-summary`・`/api/output-drafts`とも呼び出しなし・chatHistory追加なし・Draft移動なしを確認。孤立Draft（`out_1785449189461`）はSupabase SQL Editorで複合条件（`output_id`＋`case_id`）限定削除・検証専用案件2件も削除。「テスト」「Instagramアカウント設計」等の既存案件・`case_id: null`のLeader横断ログは無変更。JavaScript構文OK・dev-check 200/200/200・git diff --check問題なし。**PC本番確認・iPhone実機確認はこれから実施**（push・Render反映後にユーザー実施予定）。
- **次工程**：未定（Phase A-2 AI社員間再依頼・Phase A-3 成果物受け渡し・Phase A-4 Quality Loopは設計のみ完了・実装未着手。着手にはユーザー承認が必要）。**Phase55未着手のまま維持**（Decision 084）。

---

## 【参考・完了済み】Affiliate Intelligence Company 工程8-1/8-2/8-3A/8-3B/8-3B補正/8-3C Market Opportunity Intelligence **正式リリースComplete**（2026-07-30・Code commit 2de9317/4ef70ca/e61e7d5/3b1e5b7・main push・Render反映・PC本番確認・iPhone実機確認はこれから実施）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（Market Opportunity Intelligence完成を理由にPhase55を開始しない）
- **状態**：Competition Intelligence（工程7）に続き、工程8（8-1/8-2データ構造・案件内市場集約・Confidence→8-3A表示UI→8-3B永続化・Copy→8-3B補正（Evidence母集団整合）→8-3C実Supabase検証）で**Market Opportunity Intelligenceを正式リリースComplete**（純関数・UI・保存・補正テスト計115アサーション全PASS・dev-check 200/200/200・Console 0・実Supabase七書き検証・remaining=0 まで確認）。これによりVersion2 Core 7層構想のうち**6層が正式Complete**（残るは⑦Self Improvement Intelligenceのみ）。
- **変更範囲**：**`index.html` の1ファイルのみ（foundation +172/-0・ui +174/-0・persist +32/-0・fix +28/-9）**。**server.js・lib・DB・schema.sql・API・output_drafts定義・`_icpDeriveTopic`・Workflow Wiring・Affiliate Evaluation・ランキング順位・integratedScore・estimatedProfit式・Product/Revenue/ASP/Content/Competition Intelligence はすべて無変更**。
- **Git現在地**：branch **main**／Code commit **2de9317（foundation）＋4ef70ca（ui）＋e61e7d5（persist）＋3b1e5b7（Evidence整合修正）**／Annotated Tag **v1.01-affiliate-market-opportunity-persistence**。保護対象4件は未stage・未commitで保護。
- **⚠ 既知の残テストデータ（スコープ外・未処理）**：実案件「インスタグラムアカウント設計」(`case-mry3oyqamqlp`)に別セッション由来と思われるテスト評価（evaluationId 19・`TEST_CONTENT_PROD_20260729`）が引き続き残存。整理する場合は`case_id='case-mry3oyqamqlp'`かつ該当product_identifier限定での削除可否をユーザーに確認すること（実案件本体は削除しない）。

---

## 【参考・完了済み】Affiliate Intelligence Company 工程7-1/7-2/7-3A/7-3B/7-3C Competition Intelligence **正式リリースComplete**（2026-07-29・Code commit 675b3d0/3feec7b/d941cfd・main push・Render反映・PC本番確認・iPhone実機確認はこれから実施）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（Competition Intelligence完成を理由にPhase55を開始しない）
- **状態**：Content Intelligence（工程6）に続き、工程7（7-1/7-2データ構造・Confidence→7-3A表示UI→7-3B永続化・Copy→7-3C実Supabase検証）で**Competition Intelligenceを正式リリースComplete**（純関数23/23 PASS・dev-check 200/200/200・Console 0・実Supabase六書き検証・remaining=0 まで確認）。
- **変更範囲**：**`index.html` の1ファイルのみ（foundation +107/-1・ui +117/-0・wire +28/-0）**。**server.js・lib・DB・schema.sql・API・output_drafts定義・`_icpDeriveTopic`・Workflow Wiring・Affiliate Evaluation・ランキング順位・integratedScore・estimatedProfit式・Product/Revenue/ASP/Content Intelligence はすべて無変更**。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - Competitionは**競合環境の説明層**。母集団は`competitors`/`lifespanMonths`/`igFit`の3項目のみ（`INTEL_COMPETITION_INPUT_FIELDS`）。`competitors`単独では独立3件未満で常時Insufficientになるため、既にEvidence配線済みの3項目を母集団とした（Contentのちょうど3項目設計と同挙動）。
  - `INTEL_MODULE_KEYS`へ`'competition'`を後方互換追加済み（工程4-1の`'revenue'`追加と同型・既存Draftは空`{}`で初期化）。
  - Evidenceは新規生成しない。既存Product Evidence（3項目分）にのみ`usedBy:'competition'`を冪等追記して共有参照する（`_intelSyncCompetitionFromProduct`）。Product本体は非破壊。
  - Competition Confidenceは既存`_intelCalculateConfidence`を再利用（`_intelCalculateCompetitionConfidence`）。`confidenceOwner:'competition'`でProduct/Revenue/ASP/Content Confidenceと分離。
  - **★意味の固定**：Competition Confidenceは競合環境の根拠充足度を示すのみで、競合の強弱・参入余地・売れやすさ・推奨可否は示さない。competitorsは生値のまま。**新スコア・新閾値・参入余地判定は作らない**（もし将来「参入余地」解釈が必要なら新ヒューリスティックを伴う別工程として切り出す）。
  - 表示は**単一商材紐づき（Content/Revenue方式）**：保存済み正本判定は`productIdentifier`＋caseId一致で行う（ASPのgroupKey方式は使わない）。表示位置はランキングカード・AICパネルともContent直下。
  - 採用時は6項目を同一Output Draftへ**六書き**し既存push1回のみ（採用1回=POST1回・Competition専用POSTなし）。挿入位置は`nextIntelligenceContext.content`構築の直後。
  - Copy Full Reportは`_aicBuildCompetitionReportText`をContentの直後・Rankingの手前へ追記（順序：Product→Revenue→ASP→Content→Competition→Ranking）。
- **Git現在地**：branch **main**／Code commit **675b3d0（foundation）＋3feec7b（ui）＋d941cfd（wire）**／docs commit＝本更新（以降の最新HEAD）／Annotated Tag **v1.01-affiliate-competition-intelligence-persistence**（作成予定）／**main push・Render反映はこれから**（ユーザー承認後）。保護対象4件は未stage・未commitで保護。
- **検証済み**：純関数23/23 PASS・dev-check 200/200/200・Console 0・白画面/無限ロード/横スクロールなし・回帰なし。**実Supabase検証（専用caseId `case-ms5zz5g65x1p`）**：六書き保存確認／Evidence総数14件不変（product14/revenue9/asp4/content3/competition3・新規生成0）／Competition Confidence Medium(64点・independent3件)／F5復元完全一致／caseId分離／Copy Full Report順序／Product・Revenue・ASP・Content・ranking回帰なし／**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts・cases の3テーブルとも）**確認済み。**PC本番確認・iPhone実機確認はこれから実施**（push・Render反映後にユーザー実施予定）。
- **次工程**：未定（Competition Intelligence完成により、残るIntelligence層＝Market Opportunity/Self Improvement Intelligence、またはVersion1.1 Realtime Sync残課題等）。実装順＝Product→Revenue→ASP→Content→Competition（**表示・永続化まで完了**）→Market Opportunity→Self Improvement。**Phase55未着手のまま維持**（Decision 082）。
- **⚠ 既知の残テストデータ（スコープ外・未処理）**：検証中、実案件「インスタグラムアカウント設計」(`case-mry3oyqamqlp`)に別セッション由来と思われるテスト評価（evaluationId 19・`TEST_CONTENT_PROD_20260729`・2026-07-29 08:40作成）が残存していることを確認。今回工程のスコープ外かつ実案件紐づきのため**削除していない**。整理する場合は`case_id='case-mry3oyqamqlp'`かつ該当product_identifier限定での削除可否をユーザーに確認すること（実案件本体は削除しない）。

---

## 【参考・完了済み】Affiliate Intelligence Company 工程6-1/6-2/6-3A/6-3B/6-3C Content Intelligence **正式リリースComplete**（2026-07-29・Code commit 2b3fdd0/f2b0b5e・main push・Render反映・PC本番確認・iPhone実機確認はこれから実施）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（Content Intelligence完成を理由にPhase55を開始しない）
- **状態**：ASP Intelligence（工程5）に続き、工程6（6-1/6-2データ構造・Confidence→6-3A表示UI→6-3B永続化・Copy→6-3C実Supabase検証）で**Content Intelligenceを正式リリースComplete**（回帰テスト118/118 PASS・node --check OK・dev-check 200/200/200・Console 0 まで確認）。
- **変更範囲**：**`index.html` の1ファイルのみ（foundation +113/-0・ui +126/-0）**。**server.js・lib・DB・schema.sql・API・output_drafts定義・`_icpDeriveTopic`・Workflow Wiring・Affiliate Evaluation・ランキング順位・integratedScore・estimatedProfit式・Product/Revenue/ASP Intelligence はすべて無変更**。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - Contentは**Instagram投稿適性の説明層**。母集団は`saveRatePred`/`clickRatePred`/`igFit`の3項目のみ（Content Planningのスコアは含めない・責務分離）。
  - Evidenceは新規生成しない。既存Product Evidence（3項目分）にのみ`usedBy:'content'`を冪等追記して共有参照する（`_intelSyncContentFromProduct`）。Product本体は非破壊。
  - Content Confidenceは既存`_intelCalculateConfidence`を再利用（`_intelCalculateContentConfidence`）。独立3件未満はInsufficient。`confidenceOwner:'content'`でProduct/Revenue/ASP Confidenceと分離。
  - 表示は**単一商材紐づき（Revenue方式）**：保存済み正本判定は`productIdentifier`＋caseId一致で行う（ASPのgroupKey方式は使わない）。`_aicCurrentSavedContent`/`_aicSavedContentForRow`は保存済みを正本表示・再計算しない。表示位置はランキングカード・AICパネルともASP直下。
  - 採用時は`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`を同一Output Draftへ**五書き**し既存`pushOutputDraftToServer`を**1回**のみ呼ぶ（**採用1回=POST1回維持・Content専用POSTなし**）。挿入位置は`nextIntelligenceContext.asp`構築の直後。
  - Copy Full Reportへ`_aicBuildContentReportText`を追記（新規Copyボタンなし）。保存率予測・クリック率予測は**予測値であり実測ではない**ことを表示上も明示する。
- **Git現在地**：branch **main**／Code commit **2b3fdd0（foundation）＋f2b0b5e（ui）**／docs commit＝本更新（以降の最新HEAD）／Annotated Tag **v1.01-affiliate-content-intelligence-persistence**（作成予定）／**main push・Render反映はこれから**（ユーザー承認後）。保護対象4件は未stage・未commitで保護。
- **検証済み**：回帰テスト118/118 PASS・node --check OK・dev-check 200/200/200・Console 0・白画面/無限ロード/横スクロールなし・回帰なし。**実Supabase検証（専用caseId `case-ms3t75suuo2i`）**：採用後`fields.intelligenceContext`に`product`/`revenue`/`asp`/`content`が揃うことを確認／Evidence総数14件不変（product14/revenue9/asp4/content3・重複なし）／Content Confidence Medium（64点・independent3件・knownFactors3/3）／Product・Revenue・ASP・ranking回帰なし／**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts とも）**確認済み。**PC本番確認・iPhone実機確認はこれから実施**（push・Render反映後にユーザー実施予定）。
- **次工程**：未定（Content Intelligence完成により、残るIntelligence層＝Competition/Market/Self Improvement Intelligence、またはVersion1.1 Realtime Sync残課題等）。実装順＝Product→Revenue→ASP→Content（**表示・永続化まで完了**）→Competition→Market→Self Improvement。**Phase55未着手のまま維持**（Decision 081）。

---

## 【参考・完了済み】Affiliate Intelligence Company 工程5-3（5-3A/5-3B/5-3C） ASP Intelligence 表示UI・永続化 **正式リリースComplete**（2026-07-28・Code commit b473053・main push・Render反映・PC本番確認・iPhone実機確認 完了（2026-07-28・ユーザー実施・崩れなし・横スクロールなし・白画面/無限ロードなし））

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（ASP Intelligence完成を理由にPhase55を開始しない）
- **状態**：工程5-1・5-2（データ構造・Confidence）に続き、工程5-3（5-3A表示UI→5-3B永続化・Copy→5-3C実Supabase検証）で**ASP Intelligenceを正式リリースComplete**（純関数71/71・JavaScript構文OK・dev-check 200/200/200・Console 0 まで確認）。
- **変更範囲**：**`index.html` の1ファイルのみ（+146/-0）**。**server.js・lib・DB・schema.sql・API・output_drafts定義・`_icpDeriveTopic`・Workflow Wiring・Affiliate Evaluation・ランキング順位・integratedScore・estimatedProfit式・Product Intelligence・Revenue Intelligence はすべて無変更**。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - 表示は既存Revenueパターンを完全踏襲。`_aicBuildAspForRow`（使い捨てプレビュー・`_affiliateCases`空/非配列でも例外なし）／`_aicCurrentSavedAsp`・`_aicSavedAspForRow`（保存済み`intelligenceContext.asp`を正本表示・**再計算しない**）。表示位置はランキングカード・AICパネルともRevenue直下。
  - 採用時は`affiliateContext`＋`product`＋`revenue`＋`asp`を同一Output Draftへ**四書き**し既存`pushOutputDraftToServer`を**1回**のみ呼ぶ（**採用1回=POST1回維持・ASP専用POSTなし**）。挿入位置は`nextIntelligenceContext.revenue`構築の直後。
  - Evidenceは新規生成しない（工程5-1のまま無変更）。`_intelBuildAspFromProduct`/`_intelCalculateAspConfidence`は本工程で無変更。
  - Copy Full Reportへ`_aicBuildAspReportText`を追記（新規Copyボタンなし）。
  - **保存済みASPは常に正本表示・自動再計算しない**（F5・再ログイン・端末間復元・Affiliate Evaluation更新後・Evidence増減後・ranking再計算後のいずれも）。最新化は商材の再採用で行う（Product/Revenueと統一）。
  - `_affiliateCases`が配列でない・空の場合はプレビューが例外なくnullを返す（データなし表示）。**ただし保存済みASPが存在すればこのガードの影響を受けず正本表示を継続する**。
- **Git現在地**：branch **main**／Code commit **b473053**／docs commit＝本更新（以降の最新HEAD）／Annotated Tag **v1.01-affiliate-asp-intelligence-persistence**／**main push・Render反映**。保護対象4件は未stage・未commitで保護。
- **検証済み**：純関数 工程5-3A/5-3B新規27＋工程5-1/5-2再実行44＝**71/71 PASS**・dev-check 200/200/200・Console 0・回帰なし。**実Supabase検証（専用caseId `case-ms3t75suuo2i`）**：Output Draft POST2回（scaffold1＋採用四書き1・ASP専用POST0）／Evidence総数12件不変（product12/revenue9/asp4・重複なし）／F5復元で推奨ASP・Confidence・比較数・Independent・`updatedAt`完全一致（再計算なし実証）／caseId分離（別案件混入なし）／Copy Full Report確認／Product・Revenue・ranking回帰なし／**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts とも）**。**PC本番確認・iPhone実機確認 完了（2026-07-28・ユーザー実施）**：PC＝ログイン/ホーム/Output Engine/Affiliate Intelligence Core/Revenue Intelligence（空状態）/ASP Intelligence/おすすめ順位ランキング/Copy Full Report すべて正常・白画面/無限ロード/崩れなし。iPhone＝同項目に加え案件入力フォーム正常・Copy Full Report「コピーしました」表示確認・横スクロール/画面停止なし。**保存済み案件が存在しないためProduct Intelligence保存済み表示/💾表示は確認対象外**。**＝工程5-3 正式リリースComplete**。
- **次工程**：未定（ASP Intelligence 7層構想の残り＝Competition/Content/Market/Self Improvement Intelligence、またはVersion1.1 Realtime Sync残課題等）。実装順＝Product→Revenue→ASP（**表示・永続化まで完了**）→Competition→Content→Market→Self Improvement。**Phase55未着手のまま維持**（Decision 080）。

---

## 【参考・完了済み】Affiliate Intelligence Company 工程5-1・5-2 ASP Intelligence（③層）**正式リリースComplete**（2026-07-28・Code commit 17587296c9413f53dcc05e4c72897ac4e8d0643a・main push・Render反映・iPhone実機確認 完了（2026-07-28・ユーザー実施・崩れなし・横スクロールなし・白画面/無限ロード/画面停止なし））

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（ASP Intelligence完成を理由にPhase55を開始しない）
- **状態**：Version2 Core ③ **ASP Intelligence** を 工程5-1（データ構造・Evidence配線）→工程5-2（Confidence）で完了し**正式リリースComplete**（純関数44/44・JavaScript構文OK・dev-check 200/200/200・Console 0・Supabase書込み0・AI API実行0 まで確認）。
- **変更範囲**：**`index.html` の1ファイルのみ（+212/-0）**。**server.js・lib・DB・schema.sql・API・output_drafts定義・`_icpDeriveTopic`・Workflow Wiring・Affiliate Evaluation・ランキング順位・integratedScore・estimatedProfit式・`_intelCalculateConfidence`本体・Product Intelligence・Revenue Intelligence はすべて無変更**。
- **⚠ 重要な原則（工程5-3への引き継ぎ・実施済み）**：
  - ASPは**比較説明レイヤー**。**ランキング順位（integratedScore→estimatedProfit）・Product/Revenue Confidenceは変えない**。
  - 比較単位は**正規化商品名×market**（`_intelAspGroupKey`・ASP名はグループキーへ含めない）。候補は**Active評価（`_aicIsPersisted`）のみ**・同一productIdentifier重複は1件に限定。
  - 推奨ASPは既存`estimatedProfit`（`_aicEstimate`再利用・再算出しない）**最大**＋決定的タイブレーク（承認率→EPC→報酬→正規化ASP名）。**新しい加重式・ASP専用スコアは作らない**。有効候補2件未満は推奨判定不可。
  - Evidenceは新規生成しない。**採用商品のEvidenceにのみ`usedBy:'asp'`を冪等追記**（他ASP候補は読み取りのみ・永続Evidence書き戻しなし）。
  - ASP Confidence（`confidenceOwner:'asp'`）は既存`_intelCalculateConfidence`を**`usedBy:'asp'`Evidenceのみ**で再利用（独立3件未満Insufficient）。**derived.statusはConfidence連動に加え、比較ASP数2件未満・有効利益候補2件未満でも強制insufficient**（推奨ASP判定自体はConfidence水準から独立して成立する＝役割分離）。
  - 主要関数：`_intelAspGroupKey`/`_intelBlankAsp`/`_intelBuildAspCandidate`/`_intelDetermineAspRecommendation`/`_intelBuildAspFromProduct`/`_intelCalculateAspConfidence`。
  - **表示UI接続・Output Draft永続化・F5復元・Supabase保存は工程5-3で実施済み**。
- **Git現在地**：Code commit **17587296c9413f53dcc05e4c72897ac4e8d0643a**／Annotated Tag **v1.01-affiliate-asp-intelligence**／**main push・Render反映**。
- **検証済み**：純関数 工程5-1 18＋工程5-2 26＝**44/44 PASS**・dev-check 200/200/200・Console 0・回帰なし・実ブラウザ確認で**Supabase書込み0（GETのみ）・AI API実行0**。**iPhone実機確認 完了（2026-07-28・ユーザー実施：ログイン/ホーム/案件一覧・切替/Task/Auto Task/Leader/Output Engine/Affiliate Intelligence Core/Revenue Intelligence すべて正常・レイアウト崩れ/横スクロール/白画面/無限ロード/画面停止 いずれもなし）＝工程5-1・5-2 正式リリースComplete**。

---

## 【参考・完了済み】Affiliate Intelligence Company 工程4 Revenue Intelligence（⑤層）**正式リリースComplete（4-1〜4-4）**（2026-07-27・Code commit 8cde936・main push・Render反映・remaining=0・iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・横スクロールなし・空状態正常））

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（Revenue完成を理由にPhase55を開始しない）
- **状態**：Version2 Core ⑤ **Revenue Intelligence** を 4-0設計→4-1スキーマ/Evidence→4-2 Confidence→4-3表示→4-4両書き永続化 で完了し**正式リリースComplete**（実Supabase保存/F5復元/remaining=0 まで確認）。
- **変更範囲**：**`index.html` の1ファイルのみ（+230/-1）**。**server.js・lib・DB・schema.sql・API・output_drafts定義・`_icpDeriveTopic`・Workflow Wiring・ランキング順位・integratedScore・estimatedProfit式・`_intelCalculateConfidence`本体・Product Intelligence はすべて無変更**。
- **⚠ 重要な原則（次工程への引き継ぎ）**：
  - Revenueは**読み取り専用の説明層**。**ランキング順位（integratedScore→estimatedProfit）は変えない**。
  - `intelligenceContext.revenue` は Product の財務サブ集合を**複製＋既存Product Evidenceを `usedBy:'revenue'` で共有参照**（**新規Evidence生成なし**・件数不変・Product非破壊）。
  - Revenue Confidence は既存 `_intelCalculateConfidence` を**財務入力Evidenceのみ**で再利用（**派生 estimatedSales/estimatedProfit は独立件数へ二重計上しない**）・独立3件未満Insufficient・Product Confidenceと**分離**。
  - 採用時は `affiliateContext`＋`product`＋`revenue` を同一Draftへ**両書き**し**既存 push 1回（採用1回=POST1回）**。**表示・復元はPOST0**。**保存済みRevenueを正本表示（💾・再計算しない）**、旧Draftは非永続プレビューへfallback。
  - 主要関数：`_intelBlankRevenue`/`_intelSyncRevenueFromProduct`/`_intelCalculateRevenueConfidence`/`_aicBuildRevenueForRow`/`_aicBuildRevenueCardLine`/`_aicBuildRevenueHtml`/`_aicCurrentSavedRevenue`/`_aicSavedRevenueForRow`。
- **Git現在地**：branch **main**／Code commit **8cde936**／docs commit＝本更新（以降の最新HEAD）／Annotated Tag **v1.01-affiliate-revenue-intelligence**／**main push・Render反映**。保護対象4件は未stage・未commitで保護。
- **検証済み**：純関数31＋31・表示12・永続化15 全PASS・dev-check 200/200/200・Console 0・回帰なし・**実Supabase保存（POST1）/F5復元（Confidence保存値維持）/表示復元POST0/Evidence件数不変（Revenue専用生成なし）/テストデータ限定削除 remaining=0**。**iPhone実機確認はユーザー実施（待ち）**。
- **次工程**：**ASP Intelligence（③層）開始前調査・設計**（未着手）。実装順＝Product→**Revenue（完了）**→ASP→Competition→Content→Market→Self Improvement。**Phase55未着手のまま維持**（Decision 078）。

---

## 【参考・完了済み】Affiliate Intelligence Company 工程3 Product Intelligence 正式化（3-1/3-2/3-3）**工程3-3 正式リリース完全確定**（2026-07-27・Code commit 3ef7495・main push・Render反映・remaining=0・iPhone実機確認完了）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（本工程でPhase55を開始しない）
- **状態**：工程3（Product Intelligence 正式化）を **3-1 → 3-2 → 3-3** で完了。**工程3-3 正式Complete**（実Supabase保存/F5復元/整合性/remaining=0 まで確認済み）。
- **変更範囲**：**`index.html` の1ファイルのみ**。**server.js・lib・DB・schema.sql・API・`_icpDeriveTopic`・Workflow Wiring・ランキング順位・Confidence計算式・工程3-2表示関数 はすべて無変更**。
- **工程3ライン**：
  - **工程3-1**（**28fa51c**・+159/-0）：`intelligenceContext.product` スキーマ・Product Evidence配線・`product.confidence`・生成helper `_intelSyncProductFromAffiliate`（自動実行なし）・後方互換。
  - **工程3-2**（**1d04f31**・+49/-0）：ランキングカードへ表示時Confidenceプレビュー（`_aicBuildProductConfidence`/`_aicBuildConfidenceHtml`・使い捨てctx・非永続・順位不変）。
  - **工程3-3**（**3ef7495**・+58/-10）：`adoptAffiliateForContentPlanning()` を両書き化（下記）。
- **⚠ 重要な原則（工程3-3の設計・次工程への引き継ぎ）**：
  - 採用時は **`fields.affiliateContext`（軽量サブセット・既存フィールド名不変）** と **`fields.intelligenceContext.product`（リッチ・Evidence/Confidence含む）** を**両書き**し、**既存 `pushOutputDraftToServer` を1回**で保存（**採用1回=POST1回**・`_intelSaveContext` は使わない）。
  - **一時変数で両contextを完成**→必須項目（productIdentifier/evaluationId）＋**caseId 6項目一致**（currentCase/draft/src/affiliate/intel/product ＋ `_intelContextCaseMatches`）→**全成功時のみ実Draftへ一括反映**（途中で片方だけ書かない）。intelligenceContextは `_intelGetContext`→`JSON.parse(JSON.stringify())` deep copy 後に `_intelSyncProductFromAffiliate` で product生成し `ctx.product` へ**明示代入**。
  - **失敗/欠落/caseId不一致は反映も保存もしない**（`_aicAdoptMsg` エラー＋`console.warn`）。`products[]` は後方互換維持・新規履歴追加なし。`channelScope` は affiliate='all'/product='instagram' の二値併存（設計どおり非統一）。
  - **収益導線（`affiliateContext`→`_icpDeriveTopic`→Content Planning→Carousel/Publishing）は不変**。採用済み商品のランキング表示を保存済みConfidence優先（案A）にするかは次工程で判断（工程3-2の表示時プレビューは当面維持）。
- **Git現在地**：branch **main**／Code commit **28fa51c/1d04f31/3ef7495**／docs commit＝本更新（以降の最新HEAD）／Annotated Tag **v1.01-affiliate-product-intelligence-persistence**／**main push・Render反映**。保護対象4件は未stage・未commitで保護。
- **検証済み**：隔離テストA〜F全合格・dev-check 200/200/200・Console 0・回帰なし・実Supabase保存(POST1回)/F5復元/同一商品Evidence14→14/別商品置換・14→28保持・**テストデータ限定削除 remaining=0（API読戻し draft=null）**。**iPhone実機確認 完了（2026-07-27・ユーザー実施・崩れなし・空状態正常）**（本番URLで採用/保存/復元/既存Workflow回帰なし）。
- **次工程**：未定（候補：採用済み商品の保存済みConfidence優先表示＝案A／Product Intelligence本体・他Intelligence層）。**Phase55未着手のまま維持**（Decision 077）。

---

## 【参考・完了済み】Affiliate Intelligence Company 工程2 Evidence/Confidence 共通基盤 **正式Complete**（2026-07-26・Code commit 29d82c1・iPhone実機確認完了）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（本工程でPhase55を開始しない）
- **状態**：設計工程1で確定した Affiliate Intelligence Company の**共通基盤（横断層A＝Evidence/Confidence）のみ**を実装・実機検証・**iPhone実機確認まで完了し正式Complete**。各Intelligence本体（B〜D層）は未着手。
- **変更範囲**：**`index.html` の1ファイルのみ（+372/-0・純追加）**。**server.js・lib・DB・schema.sql・API・新DB列・新API はすべて無変更**。
- **実装要点**：`fields.intelligenceContext`（JSONB・12モジュール受け皿＋evidence[]＋confidence{overall,byModule}）／Evidence共通型（7種・`ev-<UUID>`・reliability unknown既定・`derivedFromEvidenceIds`・検証・上限200警告のみ）／Confidence共通型（**独立Evidence3件未満は点数不問で Insufficient**・推定依存で減点・Decision 032統合）／`_intel*` helper／AICパネル最小表示（Leader判断直下・空データは Insufficient）。
- **⚠ 重要な原則（工程3への引き継ぎ）**：**採用商材の現在正本は引き続き `affiliateContext`**。`intelligenceContext.product` は**空の受け皿**で、**自動ミラー・正本切替は未実施**（工程3 Product Intelligence 正式化で個別設計・実装する）。`_icpDeriveTopic()`・Workflow Wiring は**変更しない**。案件判定は `_aicCurrentCaseId()`（Decision 072）。保存は `_intelSaveContext`（caseId一致時のみ・自動保存しない）。
- **Git現在地**：branch **main**／**Code commit 29d82c1**（index.htmlのみ +372/-0）／docs commit＝本更新（以降の最新HEAD）／Annotated Tag **v1.01-affiliate-intelligence-evidence-confidence**／**main push・Render自動デプロイ**。保護対象4件は未stage・未commitで保護。
- **検証済み**：純関数18/18・dev-check 200/200/200・console error 0・AICパネル実描画OK（PC/375pxモバイル・横はみ出しなし）・実Supabase保存(POST1回)/F5復元(source:db)/affiliateContext併存/テストデータ削除 remaining=0。
- **iPhone実機確認 完了**（2026-07-26・本番でLeader統合判断直下に表示・文字切れ/重なり/横幅崩れなし・AIC全体正常）＝**工程2 正式Complete**。**未確認（残）**：Confidence重みの業務精度（初期ヒューリスティック・将来Learning調整）／Product Intelligenceとの実接続（工程3）。
- **次工程**：**Affiliate Intelligence Company 工程3 — Product Intelligence 正式化**（未着手）。**Phase55未着手のまま維持**（Decision 076）。

## 【参考・完了済み】Instagram自動運営 Workflow Wiring 本体 完了・本番反映済み（2026-07-24・commit 745dd1e）
- **状態**：Affiliate Evaluation 工程1 完了後の次工程「Instagram自動運営（Workflow Wiring）」の**本体を完了・本番反映済み**。採用したAffiliate商材を既存Instagram Output Draft の `fields.affiliateContext` へ非破壊スナップショットし、Content Planning の topic導出へ接続。**commit 745dd1e・main push済み・Render反映済み・iPhone実機確認完了**。
- **変更範囲**：**`index.html` の1ファイルのみ（+89/-0・純追加）**。**AI実行・新API・`server.js`・`lib`・DB・Migration・`supabase/schema.sql`・API shape はすべて無変更**。
- **実装要点**：`adoptAffiliateForContentPlanning()`（**保存済みActive評価のみ採用可**・rank1「（推奨）」）／`_icpDeriveTopic()` は **caseId一致時のみ** `affiliateContext` を最優先使用（不一致・未設定は既存導出へ安全フォールバック・非Affiliate Draft不変）／ランキングUIに「この商材で投稿企画を作る」ボタン。
- **⚠ 重要な原則**：**反映先は現在案件の既存 Instagram Draft（`INSTAGRAM_CAROUSEL`/`INSTAGRAM_POST`）のみ再利用し、新規Draftは自動生成しない**（Draft生成は Workflow＝AI実行＝課金と結合するため。Manual Only・課金防止設計）。案件判定は必ず **`_aicCurrentCaseId()`**（`getCurrentApprovalCaseId()` は使わない・Decision 072/075）。
- **Git現在地**：branch **main**／**HEAD = origin/main = 745dd1e**／docs更新後は本docs commitが最新HEAD。tag **v1.01-instagram-planning-wiring**。保護対象4件は未stage・未commitで保護。
- **テストデータ削除 完了**：専用テストcaseId **2件のみ**（`case-mrxmpfx78ua2`＝案件名 `WW_IPHONE_TEST_20260723`／`WW_TEST_20260723`）を Supabase SQL Editor の限定DELETEで削除し、**`affiliate_evaluations` / `output_drafts` とも `remaining = 0`** を確認済み。**条件なしDELETE不使用・既存案件/既存データ無影響**。
- **正式完了（クローズ）**：Instagram自動運営 Workflow Wiring 本体は **commit → main push → Render反映 → iPhone実機確認 → docs記録 → tag → tag push → テストデータ削除（remaining=0）** まで完了し、**正式クローズ済み**。

### 次工程ロードマップ（Instagram収益化・Manual Only維持）
```
Instagram自動運営 Workflow Wiring 本体 完了（本番反映済み）  ← 現在地
  ↓
Instagramアカウント準備（A8.net等ASP登録）  ← 次工程
  ↓
AI会社による 市場調査/競合分析/商品選定/投稿企画/カルーセル/キャプション/ハッシュタグ生成
  ↓
ユーザー確認
  ↓
Instagramへ手動投稿（運用開始）
```
- **Phase55には進まない**（Version1.1 Instagram自動運営ラインの追加実装）。

---

## 【参考・完了済み】Affiliate Evaluation 工程1 完了（クローズ）— Instagram自動運営（Workflow Wiring）へ移行可能（2026-07-23）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（工程1のクローズはPhaseの進行ではない）
- **状態**：**Affiliate Evaluation 工程1 を完了（クローズ）**。工程1-D調査の結論として **P2〜P6 は現時点で実装不要・保留継続を正式決定**（Decision 074）。**実装なし・docs更新のみ**。
- **工程1 完了内容（1-A〜1-D）**：永続化API（1-A）／Active一意性の商材単位化・Workflow Wiring・Active Case Hotfix（1-B）／schema.sql記録（1-C）／保留課題の正式決定（1-D）。**商材選定→投稿企画への接続に必要な基盤は完成**。
- **保留（工程1-E以降候補・Decision 074）**：P2 inactive化API／P3 RPCトランザクション化／P4 save_failed永続化／P5 channelScope拡張／P6 GET件数上限。実害なし/緩和済みでIG開始を妨げない。**実運用で必要性が生じた時に個別工程で再評価**（安易に、特にP3(RPC)を先回り実装しない）。
- **変更範囲**：本更新は **docs のみ**（index.html・server.js・lib・DB・schema.sql・API すべて無変更）。

### 次工程ロードマップ（Instagram収益化・Manual Only維持）
```
Affiliate Evaluation 工程1 完了
  ↓
Instagram自動運営（Workflow Wiring）  ← 次工程（Affiliate評価ランキング→Instagram Content Planning接続）
  ↓
Instagramアカウント準備（A8.net等ASP登録）
  ↓
AI会社による 市場調査/競合分析/商品選定/投稿企画/カルーセル/キャプション/ハッシュタグ生成
  ↓
ユーザー確認
  ↓
Instagramへ手動投稿（運用開始）
```
- **Instagram自動運営（Workflow Wiring）着手時の設計確認事項**：Affiliate評価と Instagram Content Planning の**データ受け渡し形式**（どのフィールドを渡すか）を先に設計。実装は `index.html` 中心（既存API流用で server.js/lib/DB 無変更の見込み）。**Phase55には進まない**（Version1.1 Instagram自動運営ラインの追加実装）。

---

## 【参考・完了済み】Affiliate Evaluation 工程1-C（案A）— 実DB定義を schema.sql へ記録（2026-07-23・commit adf1c0a / cd81488）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（**工程1-CはPhase55の開始ではない**。既存実DB定義の正式記録工程）
- **状態**：`affiliate_evaluations` が **schema.sql未記録**だった負債（P1）を解消。実DB定義を**読み取り専用SELECTで実測**し、正本として **`supabase/schema.sql` へ純追記**（実測と全項目一致・drift なし）。**commit前**。
- **変更範囲**：**`supabase/schema.sql` の1ファイルのみ（+76/-0）**。`server.js`・`lib/affiliateEvalDb.js`・`index.html`・API shape・**実DB** は無変更。**DDL実行なし**。
- **記録内容**：CREATE TABLE(30列)・`affiliate_evaluations_pkey`・`affiliate_evaluations_fingerprint_key`・`affiliate_evaluations_reco_chk`・`idx_affiliate_eval_case`・`uq_affiliate_eval_active_product`・RLS有効化・`affiliate_evaluations_all` Policy・冪等DO block。冒頭コメントに**「記録用でありMigrationではない」**旨。
- **⚠ 重要**：schema.sql は**再構築・保守用の定義記録**であり、**本番の実DBを自動変更しない**。実DBは工程1-B時点のまま。
- **Git現在地**：branch **main**／HEAD = origin/main = **4a14ad5**／**`supabase/schema.sql` のみ未commit**。保護対象4件は未stage・未commitで保護。
- **完了条件（本工程は dev-check 必須外）**：server.js・lib・index.html・API無変更のため dev-check は必須完了条件としない。中核検証＝schema.sql記録内容 ⇔ 実DB実測値の一致（達成済み）。

### 残課題（工程1-D以降の候補・保留・Decision 073）
1. **P2**：inactive化API（PATCH/DELETE）未実装。現状はUI除外抑止＋SQL Editor手動。実運用ニーズが出た時点で再評価。
2. **P3**：保存が非トランザクション（旧active無効化→insert）。`activeMayBeZero:true` 通知あり。RPC化は未着手。
3. **P4**：`save_failed` 行がF5で消失（メモリ保持・**Known Limitation**・保証対象外）。
4. **P5**：`channelScope='all'` 固定。Instagram以外拡張時に値体系を再設計。
5. **P6**：GET件数上限未設定（PostgREST既定内・件数増加時に再評価）。

### 次工程（未着手・ユーザー承認後）
1. **commit（schema.sql）→ Docs commit → tag → push**（ファイル個別指定・保護対象4件除外）。Tag候補：`v1.01-affiliate-evaluation-step1c-schema-record`。
2. 工程1-D以降（P2〜P6の個別再評価）は実運用ニーズに応じて判断。**Phase55は未着手のまま維持**。

---

## 【参考・完了済み】工程1-B本体 Active Case Hotfix — 案件未確定時の保存防止（2026-07-22）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（本Hotfixは工程1-B本体の一部。**工程1-C・Phase55の開始ではない**）
- **不具合**：案件を1件開いた後に最新一覧（`__caselist__`）へ戻ると**「案件を追加」が有効のまま**で、押下すると**直前案件へ保存され得る**。表示クリア・GET/POST未発行は正常動作でデータ破損なし。
- **原因**：`getCurrentApprovalCaseId()`（[index.html:8788](ai-company/index.html:8788)）は `_ncActiveCaseId()` が `undefined` のとき **`_lastOutputDraft.caseId` へフォールバック**する既存仕様。**ローカルでは `_lastOutputDraft` が `null` のため再現せず、本番の実案件で初めて顕在化**した。
- **修正**：Affiliate専用 **`_aicCurrentCaseId()`** を追加。担当未選択（ホーム）・`latest`・`__caselist__` はすべて **`null`** を返し**フォールバックしない**。AIC内**4箇所**（復元応答適用前の再照合／復元リトライ対象取得／`addAffiliateCase()` の保存前判定／ボタン有効判定）を統一。**明示的に `caseId` を受け取る関数の引数は変更しない**。
- **⚠ 重要な原則**：**AICでは `getCurrentApprovalCaseId()` を使わない**。今後Affiliate側で案件判定を追加する際も必ず **`_aicCurrentCaseId()`** を使うこと（Decision 072）。`getCurrentApprovalCaseId()` 自体は**変更禁止**（Approval／Output Draft／Leader dispatch／Agent consult が依存・総使用箇所17件）。
- **変更範囲**：**`index.html` のみ（+17/-4）**。`server.js`・`lib/affiliateEvalDb.js`・DB・Migration・API shape は**無変更**。
- **確認済み**：`node --check` OK・**dev-check 200/200/200**・**localhost Case 1〜4 全合格**（未確定ビューで `disabled`・`addAffiliateCase()` 直接実行も即時中止・`_lastOutputDraft.caseId` 残存下でも `null`・別案件混入なし）・既存8関数の非回帰・**console error 0**・**POST/PATCH/DELETE 0回**・**実DB書込みなし**。
- **本番通常経路の読み取り確認（先行実施）**：通常ログイン（ユーザー実施）→案件タブ操作で **1操作＝GET 1回**・**最新一覧ではGET 0回**・**案件混入なし**・**console error 0**・**本番評価書込み 0件**。本番実案件の評価は**0件**のため0件表示までを確認。

---

## 【参考・完了済み】Instagram自動運営 工程1-B本体（Workflow Wiring）**Complete**（2026-07-22）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（本工程でPhase55を開始しない）
- **状態**：Affiliate Intelligence Core（Phase53・従来メモリのみ）と永続化APIの**接続を完了**。**localhost実DB検証 Case 1〜9 全合格**・**テストデータ削除済み（`remaining = 0`）**。**commit前**。
- **Git現在地**：branch **main**／HEAD = origin/main = **d270ceb**／**`index.html` のみ未commit（+390/-4）**。
- **変更範囲**：**`index.html` の1ファイルのみ**。`server.js`・`lib/affiliateEvalDb.js`・DB・Migration・**API shape** はすべて**無変更**。
- **実装要点**：案件境界 **D-1**（現在案件のみ保持）／未保存・失敗行の **caseId付き退避バッファ**／保存は **`addAffiliateCase()` 明示追加時のみ**（Leader Final・Workflow完了・Export時はPOSTしない）／案件未確定時は**登録自体を中止**／復元は**案件確定4経路**へ個別配線（**1操作1GET**）／GETは **`caseId`＋`channelScope=all`＋`activeOnly=true` 明示**／**同一案件の再同期は表示維持・別案件切替は即時クリア**／request token＋caseId再照合で**古い応答を破棄**／**`sourceFingerprint` はclient生成**（`affiliate-evaluation-v1:`＋固定順配列・**`caseId` と実効scopeを必ず含む**）／POSTでは **`productIdentifier`・`channelScope`・`recommendation`・`source` を送らない**／**保存済み行は除外不可**／失敗行は**無言消失させず再送**可能。
- **重複表示修正＋channelScope補強**：`_aicDedupeSavedRow()` により同一caseId内で ①同一`serverId` ②同一`sourceFingerprint` ③**同一`channelScope`かつ同一`productIdentifier`** を統合。**別caseId・別scopeは除去しない**。
- **確認済み**：`node --check` OK・**dev-check 200/200/200**・**純関数 46/46 PASS**・**Case 1〜9 全合格**・**PATCH/DELETE 0件**・**console error 0**・localhost GET で専用テストcaseId **A=0件／B=0件**。
- **保護対象（未commit）**：`cost-logs.json`・`claude-cost-logs.json`・`claude-quality-history.json`・`backup-dup-candidates-20260714/`。**`git add .` / `git add -A` は禁止**（ファイル明示指定のこと）。

### 未確認事項（次チャットへ必ず引き継ぐ）
1. **通常ログイン／通常案件選択経路での実操作は未実施** — 専用テストcaseIdはアプリの案件（`cases`）として存在しないため。検証は**ブラウザランタイムで案件選択をstubし実装関数を直接実行**（ソース・server.js・APIは無変更）。4経路への配線は実行時の関数ソースで確認済み。**実運用案件は使用しない**。
2. **F5後の `save_failed` 行の保持は保証対象外**（退避バッファはメモリ保持・**Known Limitation**）。
3. **Render本番POSTは未実施**（本番書込み禁止）。
4. **別 `channelScope` の実運用検証は未実施**（現時点 `'all'` 固定）。
5. `source_fingerprint` は**テーブル全体でグローバルUNIQUE**。fingerprintに **`caseId` を必ず含める**こと（含めないと他案件の行が返る）。返却行の `case_id` が要求と異なる場合は**統合せず `save_failed`** とする実装済み。
6. **inactive化／PATCH／DELETE API は未実装**。テストデータ後始末は **Supabase SQL Editor の限定DELETE** が正式経路。
7. **Phase55は未着手のまま維持**。

### 次工程（未着手・ユーザー承認後）
1. **commit → tag → push → Render反映**（本工程の `index.html` 変更）
2. `supabase/schema.sql` への `affiliate_evaluations` 定義記録（**別工程**）
3. Decision追記（`source_fingerprint` グローバルUNIQUE／fingerprint必須要素／`productIdentifier` との責務分離）
4. inactive化API（PATCH/DELETE）の実装可否判断

---

## 【参考・完了済み】Instagram自動運営 工程1-B-0a〜0d — Affiliate評価 Active一意性の商材単位化 **完了**（2026-07-22・Code commit 2ef2ad3）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（本工程でPhase55を開始しない）
- **状態**：**工程1-B-0a（本番DB実測）／1-B-0b（最終設計確認）／1-B-0c（Migration）／1-B-0d（実装＋実DB検証）すべて完了**。**工程1-B本体（Workflow Wiring）は未着手**。
- **変更範囲**：**`lib/affiliateEvalDb.js` の1ファイルのみ（+36/-6）**。`server.js`・`index.html`・`supabase/schema.sql`・他lib・他APIは**無変更**。**API shape維持**。
- **Migration（適用済み）**：`uq_affiliate_eval_active_case` **廃止** → **`uq_affiliate_eval_active_product`**（`case_id, channel_scope, COALESCE(product_identifier,'')` WHERE `is_active`）。**Supabase SQL Editorで実行**（**Claude Code環境にDDL実行経路は無い**：service_roleキー／`DATABASE_URL`／`pg`／`psql`／Supabase CLI いずれも未存在。**今後も追加しない方針**）。
- **実装**：`normalizeAffiliateKeyPart()`／`buildProductIdentifier()` 追加／`productIdentifier`＝**サーバー正本**・`JSON.stringify([normalizedProductName, normalizedAspName || null])`／**案A厳格**＝client送信 `productIdentifier` は**保存しない**・`productName` なしは **null**／旧active無効化は**同一subject限定**（値あり `.eq()`・null **`.is()`**）／**`_str()` 無変更**。
- **確認済み**：`node --check` OK・**dev-check 200/200/200**・GET非回帰OK・**純関数テスト 15/15 PASS**・**実DB POST検証 全8ケース成功**（Active **5件共存**／Inactive 2件／履歴 7件／**23505なし**／**500なし**）・**`.eq()`／`.is()` を実DBで実証**・**専用テストデータ限定DELETE済み `remaining = 0`**。
- **保護対象（未commit）**：`cost-logs.json`・`claude-cost-logs.json`・`claude-quality-history.json`・`backup-dup-candidates-20260714/`。**`git add .` / `git add -A` は禁止**（ファイル明示指定のこと）。

### 既知事項（次チャットへ必ず引き継ぐ）
1. **`supabase/schema.sql` へ未記録** — `affiliate_evaluations` は**テーブル定義自体が schema.sql に存在しない**（工程1-A時にDBへ直接作成）。新Index含め記録は**別工程**。
2. **`index.html` 配線は未着手** — `_affiliateCases` はメモリ保持のみで、当該APIへの `fetch` は**ゼロ**。**工程1-B本体**で実施。
3. **DDL・テストデータ後始末の正式経路は Supabase SQL Editor**。限定DELETEは必ず `WHERE case_id = '<専用テストcaseId>'`。**条件なしDELETE禁止**。
4. **inactive化／PATCH／DELETE API は未実装**。
5. 旧active無効化→insert の**トランザクション化（RPC等）は未実施**（工程1-A由来の既知事項を継続）。
6. **1 case に active 評価が複数件**存在し得る。GETは配列返却のため shape 不変だが、**「active＝1件」前提の利用側を作らない**こと。
7. `product_identifier=''`（空文字）行が将来混入すると `.is(null)` で掴めない非対称性がある。**現行実装は `''` を書き込まない**ため構造的に発生しないが、前提として維持する。
8. 日本語POSTは **UTF-8 JSONファイル＋`curl --data-binary @file.json`**（Windowsシェル経由の文字コード問題回避）。
9. **Phase55は未着手のまま維持**。

### 次工程（未着手）
- **Instagram自動運営 工程1-B本体（Workflow Wiring）** — `index.html` の Affiliate Intelligence Core（`_affiliateCases`）と永続化APIの接続。**ユーザー承認後に開始**。
- `supabase/schema.sql` への `affiliate_evaluations` 定義記録（別工程）。

---

## 【参考・完了済み】Instagram自動運営 工程1-A — Affiliate Evaluation Persistence API **完了**（2026-07-21・Code commit 047f4d3）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（本工程でPhase55を開始しない）
- **状態**：社員向上B完了後の最優先＝**Instagram自動運営機能**に着手し、**工程1-A（Affiliate評価の永続化API）を完了**。**localhost検証完了**。
- **Git現在地**：branch **main**／Code commit **047f4d3**（`Add affiliate evaluation persistence API`）／docs commit＝本更新／記録時点で origin/main **908ed03**・**未push**（本docs commit後に main＋tag を push 予定）。
- **変更範囲**：**`server.js`（+34/-1）＋ `lib/affiliateEvalDb.js`（新規110行）の2ファイルのみ**。index.html・schema.sql・他lib・他APIは**無変更**。
- **実装**：`affiliate_evaluations` テーブル／`GET /api/affiliate-evaluations`（caseId必須・channelScope任意・activeOnly既定true／`0`で履歴込み）／`POST /api/affiliate-evaluations`（caseId・sourceFingerprint必須）／**`source_fingerprint` 冪等**／**旧active false化＋新active insert＝履歴保持**／**fallback契約**（`source:'db'|'fallback'|'error'`）／**JSONB `detail`**。
- **確認済み**：`node --check` 2ファイル成功・**dev-check 200/200/200**・localhost GET成功（`source:"db"`）・localhost POST成功・同一fingerprint再送で **`idempotent:true`**・**履歴込み1件**確認・テストデータ削除後 **履歴込み0件**確認・**実案件／他テーブル影響なし**。
- **保護対象（未commit）**：`cost-logs.json`・`claude-cost-logs.json`・`claude-quality-history.json`・`backup-dup-candidates-20260714/`。**`git add .` / `git add -A` は禁止**（ファイル明示指定のこと）。

### 既知事項（次チャットへ必ず引き継ぐ）
1. 旧active無効化 → insert は**非トランザクション**（②update → ③insert）。
2. insert失敗時は **active 0件**の可能性があり **`activeMayBeZero:true`** で通知（旧行は残存＝復元可）。
3. **RPC／DB transaction化は別工程**。
4. 日本語文字化けは**API不具合ではなく**、Windowsシェル→curl の**文字コード問題**。
5. 日本語POST再確認は **UTF-8 JSONファイル＋`curl --data-binary @file.json`**。
6. **inactive化／PATCH／DELETE API は未実装**。
7. **Phase55は未着手のまま維持**。

### 次工程（未着手）
- **Instagram自動運営 工程1-B以降**（ユーザー承認後に決定）。
- 社員向上Bの**Flyer／LP 移行は正式保留**（Instagram開発開始後に必要性を再評価）。

---

## 【参考・完了済み】社員向上B 正式完了 — 定義駆動基盤完成／13型中11型移行（2026-07-21・localhost検証完了・**docs更新中／commit前**・push前・Render未反映）

- **現在Version**：**Version1 Final Complete ／ Version1.1 Connected AI Company 開発中**
- **現在Phase**：**Phase54 Complete維持 ／ Phase55 未着手**（本更新でPhase55を開始しない）
- **状態**：**社員向上B 正式完了**。**docs更新中・commit前**。**localhost検証完了・push前・Render未反映**（本番実機確認は未実施）。
- **Git現在地**：branch **main**／HEAD **61dde05**（`Migrate TikTok, YouTube Shorts, and HTML draft fields`）／origin/main **ac2f5da**／**local ahead 7**（未push）／最新Tag **v1.01-phase54-video-html-section-migration**。**push・Render反映は未実施**。
- **未push 7コミット（工程順）**：c38df55 Section定義 → 6fc3616 Section抽出 → a48380c document/pdf → 43598a6 image_prompt/video_prompt → 83fbad3 powerpoint/excel → 51caede instagram_post/instagram_carousel → 61dde05 tiktok_video/youtube_shorts/html。対応ローカルTagあり。すべて**index.htmlのみ**・server.js/lib/DB/API/schema.sql 無変更。

### 社員向上B 正式仕様
- **目的（13型完全統一ではない）**：定義分散の解消／定義駆動基盤の完成／既存出力互換維持／Instagram自動運営・収益化へ安全かつ最短で移行できる状態を作ること。
- **正式完了条件（充足）**：①定義駆動基盤が実用上十分完成 ②Instagram収益化に必要な出力型が安全に運用可能 ③既存出力互換維持。13型完全統一は必須ではない。
- **基盤**：`OUTPUT_SECTION_DEFINITIONS` Section定義層／定義からdraft fieldを構築する抽出エンジン／wrapperによる安全適用／`implemented:false`対応／型別fallback維持／既存inline処理との互換性維持。

### 最終移行状況（13型中11型）
- **完全定義駆動（6）**：document / pdf / powerpoint / excel / instagram_post / html
- **ハイブリッド（5）**：image_prompt / video_prompt / instagram_carousel / tiktok_video / youtube_shorts
- **正式保留（2）**：flyer / lp（**失敗・未完成ではない**。Instagram収益化を遅らせないための優先順位判断。別工程で再評価）

### 品質確認（ローカル）
旧新等価・mismatch 0・updatedFields一致・wrapper非回帰・二重生成なし・二重代入なし・JS構文OK・dev-check 200/200/200・console error 0・**AI API実行なし**・POST/PATCH/DELETEなし。

### 保護対象（未commit・stage/commit禁止）
cost-logs.json・claude-cost-logs.json・claude-quality-history.json・backup-dup-candidates-20260714/。既存の変更・未追跡状態のまま維持。

### 次工程（未着手・ユーザー承認後）
1. docs反映（本更新）→ 2. 未push 7コミット＋Tagのpush → 3. Render反映・本番確認 → 4. **Instagram自動運営機能**開発開始（市場調査／競合分析／ASP比較／商品選定／投稿企画／カルーセル／キャプション／ハッシュタグ／Learning／投稿承認）→ 5. Instagram収益化開始 → 6. Flyer・LPは必要時に再評価。

---

## 【現在地・履歴】社員向上B 工程B-1 — outputType正本化 **完了**（2026-07-20・localhost確認済み）

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
