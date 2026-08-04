# DECISIONS.md

# ENBISOU AI COMPANY - 設計判断・意思決定ログ

更新日: 2026-08-05（**Phase54 正式Complete維持**。**Decision 094・Leader統合回答・会社正式回答責務 正式採用（Phase B-9B・docs正式化のみ）**＝Leader統合回答（Path A `LEADER_FINAL_PROMPT`／Path B `leaderSummary()`が生成する最終回答テキスト）の責務を正式化した。用語分離（「Leader Summary（ELR表示）」＝Phase B-8までに完成済みの事後表示セクション／「Leader統合回答」＝今回の対象）を明確化。①Leader統合回答は「ENBISOU AI COMPANYとしてユーザーへ提示する唯一の正式回答」。②Writer/Researcher/Reviewer/Designer/Strategy等の個別回答は「社内検討資料」（既存表示機能は削除しない）。③LeaderはCEO相当の最終統合責任者（意見収集・重複除去・矛盾解消・Evidence比較・採用/保留/却下判断・情報充足の最終判断・最終成果物生成・表現統一）。④目的は「要約」ではなく「統合」。⑤出力順序は成果物ファースト。⑥情報不足の最終判断権限はLeaderに帰属。⑦Quality Gate/Completion Gate/Executive Decision/Constitution Validatorとの責務分離。⑧既存Leader Integration Layer（`_liCompareArtifacts()`等）を将来Leader Final生成前へ構造化JSON要約として接続する方針。⑨Path A（サーバー側単一リクエスト内完結・介入不可）／Path B（クライアント側制御・接続しやすい）の構造差。Phase B-9C〜B-9Fの工程候補を正式記録。**今回はdocs正式化のみでコード・プロンプト・DB・API変更は一切なし**。tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-9C（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-04（**Phase54 正式Complete維持**。**Decision 093・Quality Gate Executive Leader Report表示 正式採用（Phase B-8A〜B-8D統合・正式リリース）**＝Phase B-7で正式採用したQuality Gate結果（`inbox.qualityGate`）を、既存のExecutive Leader Report生成関数`_elrBuildReportHtml(decision, inbox, validation)`の第2引数`inbox`からそのまま読み取り、新設の表示専用純粋関数`_elrBuildQualityGateHtml(qualityGate)`（グローバル変数非参照・不正データ時は空文字列・入力オブジェクト非破壊・`escapeHtml`使用）で構築したセクションとして正式表示する。新規decisionId／caseId／qualityGateVersion等のデータ契約は追加しない。表示位置はExecutive Summary→Constitution Structure Check→Quality Gate→Leader Summaryの順。通過時「🟢 Passed（complete＝完成／almost_ready＝ほぼ完成）」・非通過時「🟡 Not Passed（needs_work＝要改善／insufficient＝情報不足）」を表示し`packageQuality.score`は表示しない。固定注記「現在のQuality Gateは成果物品質の初期判定（表示のみ）です。Executive Decision・Output Draft保存は制御しません。」を常設し、Quality Gate通過がExecutive Decision Approved／Approved Decision Package生成済み／Output Draft保存可否／Completion Gate通過／Publishing Ready／正式完成のいずれも意味しないことを明示する。表示対象はPath A Auto Task・手動Leader再生成のみで、Path B dispatch（`inbox.qualityGate===null`）は代替表示も含め完全非表示。既存`_elrRefreshInChatArea()`・`_elrRenderIntoChatArea()`のCross-case判定（caseId一致確認）をそのまま再利用し変更していない。Quality Gate結果はセッション内保持のみでF5後は`_leaderIntegration`／`_executiveDecision`／`_constitutionValidation`とともに消失する（永続化・F5復元は未実装）。Phase B-8A（調査・設計）→B-8B（表示実装・Code commit **04bf9c1**）→B-8C（Path A・手動Leader再生成・Path B dispatchの3経路実API統合検証。Path A=`sourceMode:'auto_task'`・Quality Gate=Not Passed（`needs_work`）・Executive Decision=`hold`・Constitution Validator=`passed:true`（12/12）・Output Draft=`ready`・POST1回・ELR/Quality Gateとも1件を実測。手動再生成=新規decisionId発行・再評価正常。Path B=`inbox.qualityGate===null`・Quality Gateセクション完全非表示・Output Draft生成なしを実測。Cross-case誤表示なし・F5後消失・Console Error 0・Network全200）→B-8D（正式リリース）の4段階で完成。**index.htmlのみ**。**server.js/lib/DB/schema.sql/API無変更**。tag **v1.01-quality-gate-report-display**・push済み・Render反映済み。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Quality Gate監査Version保存／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-04（**Phase54 正式Complete維持**。**Decision 092・Quality Gate 正式採用（Phase B-7D〜B-7H統合・正式リリース）**＝Output Package Quality（`evaluateOutputPackageCompleteness()`が返す`packageQuality`）を正本入力・単軸とするQuality Gateを正式採用した。`packageQuality.status`が`complete`または`almost_ready`の場合のみ通過（`passed:true`）、それ以外（`needs_work`／`insufficient`／未知値／不正入力）はすべて非通過（`passed:false`）とし、`score`・数値thresholdは判定に使用しない。Phase B-7D（`buildOutputDraftFromLeaderFinal(finalText, opts, targetDraft)`へ第3引数`targetDraft`を追加しfields構築対象のみを引数化・省略時は`_lastOutputDraft`使用で後方互換維持・Code commit **f866d4d**）、Phase B-7E（`_lastOutputDraft`とは独立したcandidate Draft`{type, fields:{}}`を`_liCollectIntegration()`内`_edRunDecisionEngine()`直前で生成し、`candidateOnly:true`早期return経由でfields構築とpackageQuality算出のみを行い保存を伴わない・評価結果を`inbox.qualityGate`へ格納・Code commit **0f104d3**）、Phase B-7F（`evaluateQualityGate(packageQuality)`へ実判定ロジックを実装し`{executed:true, passed, status:'passed'|'failed', sourceStatus}`を返す・Code commit **1a92884**）の3段階で実装し、Phase B-7G（統合検証・境界値確認・3経路回帰確認・コード変更なし）で正式性を確認した。**index.htmlのみ**。**server.js/lib/DB/schema.sql/API無変更**。tag **v1.01-executive-quality-gate**・push済み・Render反映済み。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Completion Gate調査・設計／Publishing Readyとの接続設計／Quality Gate結果のExecutive Decision接続検討／Quality Gate監査Version保存／Decision Ledger／Quality Gate UI・Executive Leader Report表示／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-03（**Phase54 正式Complete維持**。**Decision 091・Constitution Gate 正式採用（Phase B-6A〜B-6D統合・正式リリース）**＝Constitution Structure Check正式採用（Phase B-5C・Decision090）でExecutive Leader Report内へ表示のみだったConstitution Validator Coreの検証結果を、Approved Decision Packageの複製可否判定（Path A `atRunWorkflow()`／手動Leader再生成`atTriggerLeaderFinal()`それぞれの`fields.approvedDecisionPackage`受け渡し条件）へ「狭域Constitution Gate」として接続した（Phase B-6A調査で広域Gate案・狭域Gate案を比較検討し狭域案を正式採用）。既存の`sourceDecisionId`一致・`caseId`一致に加え、`_constitutionValidation`存在／`_constitutionValidation.decisionId`と`_executiveDecision.decisionId`の一致／`_constitutionValidation.caseId`と`_executiveDecision.caseId`の一致／`_constitutionValidation.result`存在かつ`result.passed===true`、の4条件をANDで追加し（Phase B-6B実装・Code commit **9436fec**・`index.htmlのみ+20/-2`・Path A/手動Leader再生成の2箇所に限定）、いずれか1つでも不成立の場合は既存どおりfail-closed（`_edApprovedPackageForOutput`／`_manualApprovedPackageForOutput`はnullのまま・例外を投げない）とした。Constitution Gateが制御するのは「Approved Decision Packageを`fields.approvedDecisionPackage`へ複製するか否か」の1点のみであり、Validator本体（`validateExecutiveDecision()`）・Executive Decision Engine本体（`_edRunDecisionEngine()`）・Package生成ロジック（`_edBuildApprovedDecisionPackage()`）・Output Draft本文（slides/caption/cta等）はいずれも無変更。Phase B-6C実APIテスト（既存テスト案件を再利用・低コストプロンプトでAuto Task1回・手動Leader再生成1回・Path B dispatch1回を実施）で、Auto Task（Executive Leader Report生成・Decision Confidence Insufficient32点・Constitution Structure Check Passed12/12）・手動Leader再生成（新規decisionId発行・Constitution Structure Check Passed12/12・`.leader-summary-block`表示スタイル無変更）・Path B dispatch成立時（Writer/Designer/Reviewerへdispatch・`.executive-leader-report`要素1件のみ・重複なし・Constitution Structure Check Passed12/12）の3経路すべてが正常完了することを確認。3経路とも`decisionStatus`は`hold`のため`approvedDecisionPackage`は常に`null`（`fields.approvedDecisionPackage`キー不在）であり、通常運用下でGate追加が既存正常系動作へ一切の副作用を与えないことを実測確認した（Console Error 0・Network全リクエスト200 OKを3経路とも確認）。**server.js/lib/DB/schema.sql/APIは無変更**。tag **v1.01-executive-constitution-gate**・push済み・Render反映済み。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-03（**Phase54 正式Complete維持**。**Decision 090・Constitution Structure Check正式採用（Phase B-5C-1〜B-5C-3統合・正式リリース）**＝Constitution Validator Core（Phase B-5・Decision089）の検証結果を、Executive Leader Report内の独立セクション「Constitution Structure Check」として表示し、Auto Task・手動Leader再生成・Path B（dispatch成立時）の完了直後に即時反映される状態まで正式採用した。`_constitutionValidation`を`{decisionId, caseId, result}`のセッション内対応契約へ変更（Phase B-5C-1・Code commit **a2834d3**）、`_elrBuildReportHtml()`へvalidation引数を追加しPassed/Violations表示・rule技術詳細折りたたみ・安全側正規化・状態4軸分離を実装（Phase B-5C-2・Code commit **9e6d094**）、`_elrRenderIntoChatArea()`の挿入方式を`insertBefore`化し新設`_elrRefreshInChatArea()`（チャット全体を再構築しない限定更新）を3経路（Path A／手動再生成／Path B dispatch成立時）へ接続（Phase B-5C-3・Code commit **58315ee**）。実APIテスト（Auto Task1回・手動再生成1回・Path B dispatch1回・実測概算¥12）で即時反映・dispatchなし時の無反応・Cross-case・F5リセット・Output Draft/Output Engine無変更・Console Error 0を確認。**server.js/lib/DB/schema.sql/API無変更**。tagは正式リリース時に作成。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-03（**Phase54 正式Complete維持**。**Decision 089・Executive Constitution Validator Core正式採用（Phase B-5）**＝Executive Decision Engineが確定させたDecision（Approved Decision Package内包）をExecutive Constitutionに照らして検証する読み取り専用の`validateExecutiveDecision(decision)`を正式採用。Validatorは`_edRunDecisionEngine()`内`_executiveDecision`確定直後に実行し、Decision・Approved Decision Package・Output Draftのいずれも変更せず、`{version, passed, violations, checkedRules}`のみを`_constitutionValidation`へセッション内保持する（F5で消失・永続化なし）。検証対象はdecisionId・decisionStatus・Executive Summary・Decision Confidence・Approved Package生成条件・sourceDecisionId整合・Cross-case整合・単一判断主体等12項目の構造整合性検証のみとし、Executive Constitution全14条の完全な意味論的検証・Evidence内容の十分性判定・成果物品質/完成度の実質評価・Constitution違反によるOutput停止・UI表示・Quality Gate・Completion Gateとは明確に分離する（いずれも未実装）。Path A（`atRunWorkflow()`）・手動Leader再生成（`atTriggerLeaderFinal()`）の両経路で実APIテスト済み（`passed:true・violations:[]`）。Path Bはdispatch発生時のみ同一経路（`_liCollectIntegration()→_edRunDecisionEngine()→validateExecutiveDecision()`）を通る既存仕様（無変更）。**Code commit ea1ae68**（`feat: add executive constitution validator`・index.htmlのみ）。**server.js/lib/DB/schema.sql/API/UI無変更**。tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Validator結果のExecutive Leader Report表示／Validator違反時の制御設計／Quality Gate調査・設計／Completion Gate調査・設計／Decision Ledger／AI社員カード期限表示廃止（いずれも未着手・正式な次工程はユーザー承認後に決定）。以前: 2026-08-03（**Phase54 正式Complete維持**。**Decision 088・Approved Decision Package 契約構造正式実装（Phase B-4A〜B-4D）・統合検証正式Complete（Phase B-4E）**＝Executive Decision Engineが会社判断イベント自体を表す`decisionId`をdecisionStatus（approved/rejected/hold/insufficient）に関わらず必ず1回発行するよう正式化（`_edRunDecisionEngine()`冒頭で生成）。Approved Decision Packageは独自ID発行を廃し`sourceDecisionId`で元Decisionを参照する派生契約として確定（Approved時のみ生成・Hold/Rejected/Insufficientは常にnull）。Path A通常フロー（`atRunWorkflow()`）・手動Leader再生成（`atTriggerLeaderFinal()`・専用変数で誤流用防止）の両経路から`buildOutputDraftFromLeaderFinal()`へPackageを受け渡し、caseId・sourceDecisionId不一致時は古いPackageを流用せず安全にnullへ破棄。`fields.approvedDecisionPackage`へ複製保存（Packageなし時は明示的にキー削除・残留防止）。所有関係はExecutive Decision Engineが正本・Output Draft側は複製（将来Decision Ledgerが永続正本）。統合検証で13項目の合成テスト全PASS・実APIテスト（Auto Task1回＋手動再生成1回でdecisionId相違・fields保存・F5復元・Cross-case・Console Error0・Network200のみを実測）を実施し、`buildOutputDraftFromLeaderFinal()`冒頭の古いコメント不整合のみを発見・コメントのみ修正（commit b423acd・ロジック変更なし）。**Code commit 718f200＋67ab6cb＋95beda3＋65fe551＋b423acd**。**server.js/lib/DB/schema.sql/API/UI 無変更**。tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-5 Constitution Validator（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-02（**Phase54 正式Complete維持**。**Decision 087・Executive Decision Control 正式工程分割（Phase B-2A／B-2B）・因果接続方針の正式採用**＝Phase B-2の因果接続調査結果に基づき、Path A通常フロー（`atRunWorkflow`）はAI社員実行〜Leader Final生成（`runLeaderFinalResponse()`）がサーバー側単一HTTPリクエスト内で完結し、クライアント側EDEはLeader Final生成前のデータへ介入できない事実を実測確認。この制約により、EDEをOutput Draft確定前・Leader Final候補生成後へ接続する案D（段階導入）を正式採用し、既存Phase B-2を**Phase B-2A（Executive Decision Control — Path A Causal Position）**と**Phase B-2B（Manual Leader Regeneration Alignment）**へ正式分割。手動Leader再生成（`atTriggerLeaderFinal()`）が完成成果物エンジン`runLeaderFinalResponse()`ではなく軽量な`leaderSummary()`を使用し、`_wlLastResults`（前回Auto Task時点のスナップショット）とEDE入力が紐づいていないことを実測発見したため、この経路の整合化をB-2Bとして分離。Path B通常チャットはOutput Draft生成自体が存在しないためOutput Draft制御対象外のまま維持（観測層としては継続）。Leader Final Candidateを`candidateArtifacts`とは別の内部契約（`sourceEngine:'runLeaderFinalResponse'|'leaderSummary'`で区別）として新設する方針・Quality/Completion Gate未定義期間はdecisionStatusをapprovedへ到達させない第三の移行方式・Executive Reportは完成成果物候補生成後に追加AI実行なしで確定する方針を正式決定。ロードマップをPhase B-1（Complete維持）→**B-2A→B-2B**→B-3（Executive Leader Report）→B-4（Approved Decision Package）→B-5（Constitution Validator）→A-2〜A-4→C-1〜C-3→D-safety→D→E→F-1〜F-2へ改訂。今回は**docs正式化のみでコード・DB・API・UI変更は一切なし**。tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-2A（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-02（**Phase54 正式Complete維持**。**Decision 086・Executive Constitution v1.0.0 正式採用／Executive Decision Engine 正式設計採用（Phase A-1g・docs正式化のみ）**＝AI COMPANY全体の最高位ルールとしてExecutive Constitution（全14条）を正式採用し、Leader Integration Layer Phase A（`_leaderIntegration`）を将来のExecutive Decision Engineの入力構造として因果連鎖内へ昇格させるアーキテクチャ方針を正式決定。Constitution変更統制（ユーザー承認・Version更新・Decision Ledgerまたは暫定正本`04DECISIONS.md`への記録の3条件必須）・Executive Decision Engineの正式責務／非責務・Executive ReportとOutput Engine完成成果物の併存・状態3軸分離（decisionStatus新設／既存`OUTPUT_STATUS`・`packageQuality.status`は無変更）・Decision Confidence方針（既存`_intelCalculateConfidence()`再利用＋Hard Gate上乗せ・新加重式は発明しない）・Strategic Alternatives方針・Approved Decision Package方針（後方互換必須）・保存方式（段階導入案D・`output_drafts`をDecision Ledger正本として使用しない）・正式ロードマップ改訂（Phase A-1g→B-1〜B-4→A-2〜A-4→C-1〜C-3→D-safety→D→E→F-1→F-2）を正式決定。今回はdocs正式化のみで**コード・DB・API・UI変更は一切なし**。tagなし・push未実施。**Phase54 Complete維持・Phase55未着手**。次工程候補＝Phase B-1 Executive Decision Engine Core（未着手・ユーザー承認なしに開始しない）。以前: 2026-08-01（**Phase54 正式Complete維持**。**Decision 085・AI COMPANY Leader Integration Layer（Phase A）後半 正式仕様＝messages案件別正本化・Leader Final状態サマリー分離・Output Draft誤認防止を正式採用**（①`/api/auto-task`・`/api/consult`のsaveMessage()計4箇所へcaseId付与しmessages案件別正本化を完成／②`runLeaderFinalResponse()`でcompleted成果は既存どおり統合しつつerror/skippedを状態サマリーとして分離・全員成功時は既存プロンプトと完全一致／③`buildOutputDraftFromLeaderFinal()`へ`noCompletedResults`判定を追加しcompleted成果0件時はOutput Draftを`status:'ready'`ではなく既存`OUTPUT_STATUS.ERROR`・Package Qualityを`score:0・insufficient`へ固定して完成成果物としての誤認を防止／④一部成功時はLeader Final末尾に独立見出し「## 担当実行状況」を必ず出力するようプロンプト強化）。**Code commit 5401b68（工程1）＋6032893（工程2）＋0d125e7（工程3-2）**。工程3統合検証で、一部成功時の状態サマリー未分離・completed成果0件時のOutput Draft誤評価（`status:'ready'`・Package Quality87点「良好」）を実測発見し工程3-2で解消。正常系・一部成功・completed成果0件の3パターンをlocalhost実DBで再検証しCross-case混入なし・新規`case_id=NULL`なし・二重保存なし・Console Error 0・dev-check 200/200/200を確認。API・DB・server.js無変更。tag **v1.01-leader-integration-phase-a-complete**・**main push・Render反映・PC本番確認 完了**（ユーザー実施：ログイン/Auto Task/Leader Integration Layer/AI社員振り分け/Leader Final/Output Engine/Task同期/案件切替すべて正常・Cross-case混入なし・Console Error/Network異常なし・iPhone実機確認は対象外）。**AI COMPANY Leader Integration Layer（Phase A）正式Complete**。**Phase54 Complete維持・Phase55未着手**。以前: 2026-07-31（**Phase54 正式Complete維持**。**Decision 084・AI COMPANY Leader Integration Layer（Phase A）正式仕様＝Leader成果物統合管理層として採用**（Path A(Auto Task)／Path B(Leader手動チャット)双方の末尾から共通`_liCollectIntegration()`を1回だけ呼び出し、既存処理は無変更のまま成果物回収・比較・矛盾候補検出・採否候補判定を追加／保存はクライアント一時メモリ`_leaderIntegration`のみ・新DB/新API/追加AI実行なし／Leader Integration専用caseId取得関数`_liCurrentCaseId()`を新設（`_aicCurrentCaseId()`方式踏襲・フォールバックなし）／Path Bは`interactionId`（`_liPathBSession`）でworkflowIdと分離しchatHistory非接触で過去回答混入を防止／矛盾候補・採否候補は必ずcandidate/hold（安全側既定値）／finalSummary生成はPhase B以降）。**実装過程で発見した既存不具合（案件切替後、手動Leader Final再生成`atTriggerLeaderFinal()`が古い案件のOutput Draftを別案件へ混入させ得る）を同一リリースでHotfix**（`_liCurrentCaseId()`と`_liLastPathAResultsCaseId`の厳格一致ガードを`atTriggerLeaderFinal()`冒頭へ追加・不一致時はAPI呼び出し・保存を一切行わず安全停止）。**Code commit ad5eaf7（Phase A本体 +336/-6）＋af43263（Hotfix +11/-0）**。実機検証でHotfix適用前の実際の混入事故（診断用Output Draft`out_1785449189461`が検証専用案件`case-ms82952wltd5`から「テスト」案件へ移動）を確認し、既存POST経路で復旧・Supabase側で該当1行を限定削除・検証専用案件を削除。JavaScript構文OK・dev-check 200/200/200・git diff --check問題なし。tag **v1.01-leader-integration-phase-a**・**main push・Render反映・PC本番確認・iPhone実機確認はこれから**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。以前: 2026-07-30（**Phase54 正式Complete維持**。**Decision 083・Market Opportunity Intelligence（①層）正式仕様＝工程8-1/8-2/8-3A/8-3B/8-3B補正/8-3C 正式リリース**（`intelligenceContext.market`へ現在案件内の同一市場候補商材群を集約保存・案件内集約（案C）・`_aicNormalizeKeyPart`再利用・新規入力なし・外部データなし／Evidenceは新規生成せず`_intelSyncMarketGroupProductEvidence`（表示・保存共通ヘルパー）が市場内対象商材群の既存Product Evidenceへ`usedBy:'market'`冪等追記／Market Confidenceは既存`_intelCalculateConfidence`再利用・`INTEL_MARKET_MIN_PRODUCT_COUNT=2`未満は強制insufficient・1商材でも情報保持／保存済み判定はmarketKey＋caseId（productIdentifierではない）／採用時七書き・POST1回・Competition直後にUI/Copy Full Report追加・Safety表記必須／順位・integratedScore・estimatedProfit・他5層 無変更）。**Code commit 2de9317＋4ef70ca＋e61e7d5＋3b1e5b7**。純関数・UI・保存・補正テスト計115アサーション全PASS・dev-check 200/200/200・Console 0・実Supabase検証（専用caseId・商材2件）で七書き保存・productCount=2・Evidence22件（両商材productIdentifierにまたがる・母集団整合確認）・derived集計値実測一致・F5復元一致・案件切替混入なし・Copy Full Report確認・**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts・cases の3テーブルとも）**確認。tag **v1.01-affiliate-market-opportunity-persistence**（予定）・**main push・Render反映・PC/iPhone実機確認はこれから**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。以前: 2026-07-29（**Phase54 正式Complete維持**。**Decision 082・Competition Intelligence（④層）正式仕様＝工程7-1/7-2/7-3A/7-3B/7-3C 正式リリース**（`intelligenceContext.competition`（新規モジュールキー）へ競合環境3項目（`competitors`/`lifespanMonths`/`igFit`）をProduct Evidence共有参照で保存・新規Evidence生成なし／Competition Confidenceは既存`_intelCalculateConfidence`再利用・独立3件未満Insufficient・`confidenceOwner:'competition'`で分離／★Confidenceは競合環境の根拠充足度を示すのみで競合の強弱・参入余地・推奨可否は示さない・competitorsは生値のまま・新スコア/新閾値/参入余地判定なし／`_aicBuildCompetitionForRow`・`_aicCurrentSavedCompetition`/`_aicSavedCompetitionForRow`（productIdentifier＋caseId一致で正本表示・再計算しない）・`_aicCompetitionParts`・`_aicBuildCompetitionCardLine`・`_aicBuildCompetitionHtml`・`_aicBuildCompetitionReportText`を追加／採用時`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`＋`competition`を同一Output Draftへ**六書き**・既存push1回（採用1回=POST1回・Competition専用POSTなし）／順位・integratedScore・estimatedProfit・Product/Revenue/ASP/Content Intelligence・server.js・lib・DB・schema.sql・API 無変更）。**Code commit 675b3d0（foundation +107/-1）＋3feec7b（ui +117/-0）＋d941cfd（wire +28/-0）**。純関数23/23 PASS・dev-check 200/200/200・Console 0・実Supabase検証（専用caseId `case-ms5zz5g65x1p`）でEvidence14件不変（product14/revenue9/asp4/content3/competition3・新規生成0）・六書き保存・F5復元一致・caseId分離・Copy Full Report順序（Product→Revenue→ASP→Content→Competition→Ranking）・**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts・cases の3テーブルとも）**確認。tag **v1.01-affiliate-competition-intelligence-persistence**（予定）・**main push・Render反映・PC/iPhone実機確認はこれから**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。以前: 2026-07-29（**Phase54 正式Complete維持**。**Decision 081・Content Intelligence（⑥層）正式仕様＝工程6-1/6-2/6-3A/6-3B/6-3C 正式リリース**（`intelligenceContext.content`へInstagram投稿適性3項目（`saveRatePred`/`clickRatePred`/`igFit`）をProduct Evidence共有参照で保存・新規Evidence生成なし／Content Confidenceは既存`_intelCalculateConfidence`再利用・独立3件未満Insufficient・`confidenceOwner:'content'`でProduct/Revenue/ASPと分離／`_aicBuildContentForRow`・`_aicCurrentSavedContent`/`_aicSavedContentForRow`（productIdentifier＋caseId一致で正本表示・再計算しない）・`_aicContentParts`・`_aicBuildContentCardLine`・`_aicBuildContentHtml`・`_aicBuildContentReportText`を追加／採用時`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`を同一Output Draftへ**五書き**・既存push1回（採用1回=POST1回・Content専用POSTなし）／順位・integratedScore・estimatedProfit・Product/Revenue/ASP Intelligence・server.js・lib・DB・schema.sql・API 無変更）。**Code commit 2b3fdd0（foundation +113/-0）＋f2b0b5e（ui +126/-0）**。回帰テスト118/118 PASS・node --check OK・dev-check 200/200/200・Console 0・白画面/無限ロード/横スクロールなし・実Supabase検証（専用caseId）でEvidence14件不変（product14/revenue9/asp4/content3）・**テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts とも）**確認。tag **v1.01-affiliate-content-intelligence-persistence**（予定）・**main push・Render反映・PC/iPhone実機確認はこれから**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。以前: 2026-07-28（**Phase54 正式Complete維持**。**Decision 080・ASP Intelligence 表示UI・永続化正式仕様＝工程5-3（5-3A/5-3B/5-3C）正式リリースComplete**（`_aicBuildAspForRow`/`_aicCurrentSavedAsp`/`_aicSavedAspForRow`/`_aicAspParts`/`_aicBuildAspCardLine`/`_aicBuildAspHtml`/`_aicBuildAspReportText`を追加し、ランキングカード・AIC最小パネル・Copy Full ReportへASP Intelligenceを表示（Revenue直下）／未採用商材は使い捨てctxプレビュー（`_affiliateCases`空・非配列でも例外なし＝同期前に誤った推奨を確定しない）・採用済み商材は保存済み`intelligenceContext.asp`を正本表示（💾・再計算しない）／採用時に`affiliateContext`＋`product`＋`revenue`＋`asp`を同一Output Draftへ**四書き**し既存`pushOutputDraftToServer`を**1回**（採用1回=POST1回・ASP専用POSTなし）／Evidenceは新規生成せず`usedBy:'asp'`共有参照のまま・実Supabase検証で総数不変（12件・product12/revenue9/asp4・重複なし）を実測／F5復元は`intelligenceContext.asp`をfields JSONB経由で自動復元し`updatedAt`一致で再計算なしを実測／caseId分離（別案件切替で混入なし・往復とも正常復元）を実測／順位・integratedScore・estimatedProfit・Product/Revenue Intelligence・Workflow Wiring・server.js・lib・DB・API 無変更）。**Code commit b473053（index.htmlのみ +146/-0）・tag v1.01-affiliate-asp-intelligence-persistence・main push・Render反映**。**純関数 工程5-3A/5-3B 27＋工程5-1/5-2再実行44＝71/71 PASS**・dev-check 200/200/200・Console 0・実Supabase保存/F5復元/caseId分離/Copy Full Report/テストデータ限定削除 remaining=0（affiliate_evaluations・output_drafts とも）確認・**PC本番確認・iPhone実機確認 完了（2026-07-28・ユーザー実施・崩れなし・横スクロールなし・白画面/無限ロードなし・保存済み案件なしのためProduct Intelligence保存済み表示/💾表示は確認対象外）**・**Phase54 Complete維持・Phase55未着手**。以前: 2026-07-28（**Phase54 正式Complete維持**。**Decision 079・ASP Intelligence（③層）正式仕様＝工程5-1・5-2正式リリースComplete**（`intelligenceContext.asp` へ保存・新規トップレベル領域なし／比較単位は正規化商品名×market（ASP名はグループキーに含めない）／Active評価（`_aicIsPersisted`）のみ候補化・同一productIdentifier重複は1件に限定／推奨ASPは既存`estimatedProfit`最大＋決定的タイブレーク（承認率→EPC→報酬→ASP名）・新スコア式なし・有効候補2件未満は推奨不可／Evidenceは新規生成せず採用商品のEvidenceにのみ`usedBy:'asp'`を冪等追記・他候補は読み取りのみ／ASP Confidenceは既存`_intelCalculateConfidence`を再利用・母集団は`usedBy:'asp'`Evidenceのみ・独立3件未満Insufficient・比較ASP数/有効利益候補2件未満は強制insufficient・Product/Revenue Confidenceと分離／説明レイヤーとして順位・integratedScore・estimatedProfit式・Product/Revenue Intelligenceを変更しない／表示UI・Output Draft永続化・F5復元は工程5-3へ分離・今回未実装）。**Code commit 17587296c9413f53dcc05e4c72897ac4e8d0643a（index.htmlのみ +212/-0）・tag v1.01-affiliate-asp-intelligence・main push・Render反映・純関数44/44 PASS・dev-check 200/200/200・Console 0・Supabase書込み0・AI API実行0・iPhone実機確認 完了（2026-07-28・ユーザー実施・崩れなし）・Phase54 Complete維持・Phase55未着手**。以前: 2026-07-27（**Phase54 正式Complete維持**。**Decision 078・Revenue Intelligence（⑤層）正式仕様＝工程4正式リリースComplete**（`intelligenceContext.revenue` へ保存・`business`流用しない／Product Evidenceを `usedBy:'revenue'` で共有・Revenue専用Evidence生成なし／Revenue ConfidenceはProduct Confidenceと分離・母集団は財務入力Evidenceのみ・totalFactors=7・派生estimatedSales/estimatedProfitは独立件数へ二重計上しない・独立3件未満Insufficient／Revenueはランキングへ影響しない説明レイヤー／採用時に既存Output Draトへ相乗り両書き・採用1回=POST1回／保存済みRevenueを正本として復元・表示・再計算しない・旧Draトは非永続プレビューへfallback）。**Code commit 8cde936（index.htmlのみ +230/-1）・tag v1.01-affiliate-revenue-intelligence・main push・Render反映・実Supabase保存/F5復元/remaining=0 確認・iPhone実機確認 完了（2026-07-27・ユーザー実施）・Phase54 Complete維持・Phase55未着手**。以前: 2026-07-27（**Phase54 正式Complete維持**。**Decision 077・工程3-3 採用時の両書き（`affiliateContext` ＋ `intelligenceContext.product`）を正式採用**（同一Output Draftへ両書き・既存 `pushOutputDraftToServer` で**1回保存**＝採用1回=POST1回／一時変数で構築→必須項目・caseId6項目一致ガード→全成功時のみ一括反映（片方だけ書かない）／intelligenceContextはdeep copy後にproduct生成／`_intelSaveContext`不使用／`products[]`は後方互換維持・新規追加なし／`channelScope`二値併存(affiliate='all'/product='instagram')は非統一）。**Code commit 3ef7495（工程3-3・+58/-10）／工程3-1 28fa51c／工程3-2 1d04f31・tag v1.01-affiliate-product-intelligence-persistence・main push・Render反映・実Supabase保存/F5復元/同一商品Evidence14→14/別商品置換14→28保持/remaining=0 確認・iPhone実機確認はユーザー実施・Phase54 Complete維持・Phase55未着手**）。以前: 2026-07-26（**Phase54 正式Complete維持**。**Decision 076・Affiliate Intelligence Company の Evidence/Confidence 共通基盤を採用**（全Intelligence横断層／保存先は `outputDraft.fields.intelligenceContext`(JSONB)・新DB列/新APIなし／Evidence ID は `ev-<UUID>`／派生Evidenceは独立件数に含めない／Confidenceは初期ヒューリスティックで将来Learning調整／独立Evidence3件未満は点数不問で Insufficient／採用商材正本は当面 `affiliateContext` のまま・自動ミラー/正本切替は工程3まで行わない／AICパネル最小表示はLeader統合判断の直下／既存Output Draト保存経路を利用）。**Code commit 29d82c1・tag v1.01-affiliate-intelligence-evidence-confidence・main push・Render反映済み・iPhone実機確認完了＝工程2 正式Complete**・**Phase54 Complete維持・Phase55未着手**。以前: 2026-07-24（**Phase54 正式Complete維持**。**Decision 075・Instagram自動運営 Workflow Wiring 本体の正式化**（採用Affiliate商材を既存Instagram Output Draftの `fields.affiliateContext` へ非破壊スナップショットし `_icpDeriveTopic()` が caseId一致時のみ最優先使用／採用は保存済みActive評価のみ・案件判定は `_aicCurrentCaseId()`／反映先は現在案件の既存Instagram Draft(carousel/post)のみ再利用・**新規Draft自動生成は不採用＝AI実行なし**／server.js・lib・DB・schema.sql・API shape 無変更・既存 `output_drafts.fields`(JSONB) を利用）。**commit 745dd1e・main push済み・Render反映済み・iPhone実機確認完了**・tag **v1.01-instagram-planning-wiring**・**Phase54 Complete維持・Phase55未着手**。以前: 2026-07-23（**Phase54 正式Complete維持**。**Decision 074・Affiliate Evaluation 工程1 クローズ**（工程1-D調査の結論としてP2〜P6は現時点で実装不要・保留継続を正式決定／工程1-A〜1-Dをもって Affiliate Evaluation 工程1 完了／次工程は Instagram自動運営 Workflow Wiring）。以前: **Decision 073・工程1-C は案A（schema.sql記録のみ）を採用**（`affiliate_evaluations` の実DB定義を実測し正本として `supabase/schema.sql` へ純追記／Migrationではなく再構築・保守用の記録／実DB・API・アプリコード無変更／inactive化API・RPCは現時点で実装しない／P2〜P6を工程1-D以降候補として保留）。以前: **Decision 072・Affiliate評価の保存先判定は「現在表示中の確定案件」のみを正とする**（`getCurrentApprovalCaseId()` は `_lastOutputDraft.caseId` へフォールバックするためAICでは使用しない／専用 `_aicCurrentCaseId()` を正本とする／未確定は必ず `null`）。以前: **Decision 071・Affiliate評価 Workflow Wiring の正式化**（案件境界D-1／保存は明示追加時のみ／`sourceFingerprint` はclient生成・`caseId`と実効scopeを必ず含む／`source_fingerprint` は**グローバルUNIQUE**／保存済み行は除外不可＝A案／POST成功時の一行統合条件／`recommendation`・`source`・`channelScope`・`productIdentifier` は送らない）。**localhost実DB検証 Case1〜9 全合格・テストデータ削除済み・未commit**。以前: **Decision 070・Affiliate評価のActive一意性を商材単位へ改訂**（`case_id + channel_scope + COALESCE(product_identifier,'')`／Decision 069-3 を改訂・**旧Index廃止・新Index適用済み**／`productIdentifier` はサーバー正本・**案A厳格**／`.eq()`・`.is()` によるsubject限定無効化／Code commit **2ef2ad3**／実DB POST検証 全8ケース成功／テストデータ削除済み）。**Phase55未着手**。以前: **Decision 068・社員向上B 正式完了**（目的は13型完全統一ではなく実用上十分な定義駆動基盤完成／13型中11型移行済み／**Flyer・LP 正式保留**／Instagram収益化を最優先の判断基準／次工程＝Instagram自動運営機能）。**localhost検証完了・push前・Render未反映**・HEAD 61dde05・**Phase55未着手**。以前: **Decision 064/065・Task表示仕様変更 完了**・本番反映済み・PC/iPhone実機確認完了・HEAD **bbfbc73**・tag v1.01-phase54-task-home-overview／v1.01-phase54-task-sort-newest。先行して **Decision 063・Case成功確認契約 完了**（aed5f7d）・**Decision 060/061/062・案件系Known Issue 全Close＝Case同期系Complete**。**Phase55未着手**。以前：Decision 059・Phase54 Known Issue（Task表示不一致）Closed／Decision 058・Phase54 Hotfix／Decision 057・3b-3 Completed）

---

# Decision 094
## Leader統合回答・会社正式回答責務 正式採用（Phase B-9B・docs正式化のみ）（2026-08-05）

**背景**：Phase B-9Aの調査で、Leaderが生成する最終回答（Path Aの`LEADER_FINAL_PROMPT`／Path Bの`leaderSummary()`）が、狭い単一成果物依頼（例：「Instagram投稿用の挨拶キャプションを1つ作成してください」）に対しても不要な複数ブランチ（LP・広告・ブランドメッセージ等）を含む一般論的な出力になりやすいこと、また各AI社員の「情報不足時は仮説・質問のみを返す」という既存の安全設計（`workerFinalOverride`）と、Leaderの「常に完成品を出力せよ」という制約が構造的に矛盾していることを実測・コード調査で確認した。本Decisionは、この改善に先立ち、Leader統合回答の責務を正式に定義するものであり、**コード・プロンプトの変更は含まない**。

**用語の正式整理**：このリポジトリでは「Leader Summary」という言葉が2つの異なる意味で使用されてきた。今後は以下のとおり呼び分ける。
- **Leader Summary（ELR表示）**：Executive Leader Report内でcandidateArtifacts等を3行抜粋・折りたたみ表示する事後表示セクション（`_elrBuildReportHtml()`）。Phase B-8までに完成済みの表示機能であり、本Decisionの対象外。
- **Leader統合回答**：Path Aの`LEADER_FINAL_PROMPT`およびPath Bの`leaderSummary()`が生成し、Leaderチャットへ表示する最終回答テキスト。本Decisionおよび今後のPhase B-9の対象。

**決定（正式）**：

1. **Leader統合回答は会社として唯一の正式回答である**：Leader統合回答は、AI社員個々の回答を並べたまとめではなく、「ENBISOU AI COMPANYとしてユーザーへ提示する唯一の正式回答」として正式に位置づける。
2. **AI社員の個別回答は社内検討資料である**：Writer・Researcher・Reviewer・Designer・Strategy・その他AI社員の回答は正式回答ではなく社内検討資料として位置づける。正式な責務フローを`社内検討（Writer/Researcher/Reviewer/Designer/Strategy）→Leader統合（重複除去・矛盾解消・採用・保留・却下）→会社回答（Leaderチャットへ唯一の正式回答を表示）`と定める。**個別回答の表示機能自体（AI社員タブ・dispatchカード・Workflow Live等）は削除しない**。将来UI上で「社内検討」であることを明示する余地を記録するのみとし、今回UI変更は行わない。
3. **Leaderは最終統合責任者（CEO相当）である**：Leaderは単なる要約担当ではなく、AI社員の意見収集・重複除去・矛盾解消・Evidence比較・採用判断・保留判断・却下判断・情報充足の最終判断・最終成果物生成・会社回答としての表現統一を担う最終統合責任者として正式に位置づける。LeaderはWriter・Researcher・Reviewer・Designer等の文章をそのまま連結して返してはならない。
4. **Leader統合回答の目的は「要約」ではなく「統合」である**：目的は文章を短くすることではなく、重複除去・矛盾解消・Evidence比較・採用判断・保留判断・却下判断・品質統一・依頼範囲への絞り込みを行った上での必要最小限の文章化である。今後、Leader統合回答を説明する際は「要約」単独で表現せず「統合・判断・正式回答生成」と記録する。
5. **成果物ファーストを正式化する**：Leader統合回答の基本出力順序を「完成成果物→必要な場合のみ補足→必要な場合のみ採用理由→必要な場合のみ社内判断の概要」と正式化する。AI社員の議論やレビュー全文を先に表示することを正式回答の目的にしない。狭い依頼では、依頼された成果物だけを返せる構造を目指す（例：「Instagram投稿用の挨拶キャプションを1つ」という依頼に対し、不要なカルーセル・TikTok・LP・ブランドメッセージ等を自動的に追加しない）。
6. **情報不足の最終判断権限はLeaderに帰属する**：各AI社員は安全側で「情報不足」と判断してよい。ただし、最終判断権限はLeaderに持たせる方針を正式採用する。作成可能な場合＝各担当が情報不足と判断→Leaderが依頼内容だけで実用的成果物を作成可能と判断→追加質問をせず完成成果物を生成。本当に作成できない場合＝依頼内容だけでは成果物の骨格が成立しない→Leaderが情報不足と最終判断→必要最小限の確認事項のみ提示。各担当の情報不足判定をそのまま会社回答として採用してはならない。
7. **Gate系との責務分離を正式化する**：Leader統合回答は生成前から生成中の判断（完成できるか／完成させるか／どの案を採用するか／何を却下するか／質問へ切り替えるか／どの成果物だけを返すか）を担当する。Quality Gateは生成済み候補の`packageQuality.status`を評価するのみで、内容の的確さ・簡潔さ・統合品質は評価しない。Completion Gate（未実装）は将来、生成された成果物が完成基準を満たすかを判定するものであり、Leader統合回答の「生成するか・質問するか」という責務を先取りしない。Executive DecisionはLeader Final生成後の事後判断であり、Leader統合回答生成前の統合処理には直接介入しない。Constitution ValidatorはExecutive Decisionの構造整合性を検証するのみで、成果物内容の統合品質は評価しない。
8. **既存Leader Integration Layerとの関係を正式記録する**：`_liCompareArtifacts()`／`_liDetectConflictCandidates()`／`_liDecideAdoptionCandidates()`は重複・矛盾・採否候補を事後観測する既存関数だが、現在はLeader統合回答生成後に実行される事後観測層である。今後Leader統合回答の品質改善へ利用する場合は、Leader Final生成前へ構造化された比較結果を渡す必要がある。Leaderへ渡すのは、全処理内容や不要な全文ではなく、原則として比較結果の要約JSON（概念例：`{duplicateTopics:[],conflicts:[],recommendedAdoptions:[],holds:[],rejections:[],evidenceNotes:[]}`）とし、トークン増加を抑える方針とする。
9. **Path A／Path Bの構造的差異を正式記録する**：Path Aは`/api/auto-task`内でAI社員実行からLeader Final生成までが単一リクエスト内で完結し、現在のクライアント側Leader Integration LayerはLeader Final生成前へ介入できない（Decision087で確定済みの構造的制約を継承）。今後、構造化比較結果をLeaderへ渡す場合は、サーバー側に同等の比較ロジックを追加する案・サーバー側で共通化可能なRule Engineを作る案・Leader Finalを二段階生成する案を比較検討する必要がある。**二段階AI生成はAPI費用・遅延が増えるため第一候補にしない方針**とする。Path Bはクライアント側でdispatch・Strategy統合・Leader統合回答生成を制御しており、Path Aより比較結果をLeader入力へ接続しやすい構造である。ただし、Path AとPath BでLeaderの会社回答品質が大きく異ならないよう、最終的には共通の統合原則を適用する必要がある。
10. **Phase B-9工程分割を正式な実装候補として記録する**：Phase B-9A（現状調査・設計・完了）→Phase B-9B（本Decision・責務正式化・docs反映のみ）→Phase B-9C（Leader統合回答プロンプト改善：`LEADER_FINAL_PROMPT`／`leaderSummary()`／必要に応じて`strategyConsolidate()`）→Phase B-9D（Rule Engine比較結果のLeader Final生成前接続・Path B先行検討・Path Aはサーバー側共通ロジック化を再調査）→Phase B-9E（統合検証：狭い単一成果物依頼／複合成果物依頼／情報充足依頼／情報不足だが一般解生成可能な依頼／本当に確認が必要な依頼／AI社員間で一致する依頼／矛盾する依頼／Reviewerが不採用を提案する依頼／Path A／Path B／既存13出力タイプへの回帰／API費用／出力の長さ／重複除去／不要ブランチ抑制）→Phase B-9F（正式リリース：docs更新・docs commit・Tag・Push・Render・PC確認・iPhone確認）。
11. **今回はコード変更を一切行わない**：`index.html`／`openaiClient.js`／`server.js`／`lib`／DB／`schema.sql`／APIはいずれも無変更。LEADER_FINAL_PROMPT／leaderSummary()／strategyConsolidate()のプロンプト文言・Leader統合ロジックの変更はPhase B-9C以降で改めて検討する。

**未実装事項（区別して記録）**：LEADER_FINAL_PROMPT／leaderSummary()／strategyConsolidate()のプロンプト文言変更・Leader統合ロジック変更・Rule Engine比較結果のLeader Final生成前接続・UI上での「社内検討」明示・Completion Gateはいずれも今回対象外であり、「完成済み」として記録しない。

**Git・反映**：docs commit（本更新）のみ。**index.html/openaiClient.js/server.js/lib/DB/schema.sql/API無変更**。Tag作成なし・**push未実施**（ユーザー確認後に別途判断）。**Phase54 Complete維持・Phase55未着手**。

**次工程**：Phase B-9C（Leader統合回答プロンプト改善）を次工程候補として記録する。**ユーザー承認なしに開始しない**。

---

# Decision 093
## Quality Gate Executive Leader Report表示 正式採用（Phase B-8A〜B-8D統合・正式リリース）（2026-08-04）

**背景**：Decision092でQuality Gateを正式採用したが、その時点では判定結果（`inbox.qualityGate`）はセッション内メモリに保持されるのみで、UI表示は一切なかった（「Quality Gate UI・Executive Leader Report表示」はDecision092の次工程候補の1つとして並列記録されていた）。Phase B-8A〜B-8Dでは、Constitution Structure Check正式採用（Decision090）の設計パターンを踏襲し、Quality Gate結果をExecutive Leader Report内へ安全に表示する工程を段階的に実施した。

**決定（正式）**：

1. **`inbox.qualityGate`を既存のExecutive Leader Report入力としてそのまま利用する**：新規のdecisionId／caseId付きラッパー構造、`qualityGateVersion`、`evaluatedAt`等のデータ契約は追加しない。`_elrBuildReportHtml(decision, inbox, validation)`の既存第2引数`inbox`から`inbox.qualityGate`を読み取るのみとし、関数シグネチャは変更しない。
2. **表示専用の独立関数`_elrBuildQualityGateHtml(qualityGate)`を正式採用する**：`_elrBuildConstitutionCheckHtml(validation)`と同型の防御的実装とし、純粋関数（グローバル変数非参照）・入力オブジェクト非破壊・不正データ（null／undefined／非オブジェクト／`executed!==true`／`passed`が非boolean／`status`が`'passed'`／`'failed'`以外／`sourceStatus`が許容4値`complete`／`almost_ready`／`needs_work`／`insufficient`以外）はいずれも例外を出さず空文字列を返す（安全側非表示）。`escapeHtml`を使用する。
3. **表示位置をExecutive Summary→Constitution Structure Check→Quality Gate→Leader Summaryの順として正式採用する**：Constitution Structure Checkの直後・Leader Summaryの直前に独立セクションとして表示する。
4. **表示内容を正式採用する**：通過時「🟢 Passed（complete＝完成）」「🟢 Passed（almost_ready＝ほぼ完成）」、非通過時「🟡 Not Passed（needs_work＝要改善）」「🟡 Not Passed（insufficient＝情報不足）」を主表示とする。`Failed`はシステムエラーと誤認される可能性があるためユーザー向け主表示に使用しない。`packageQuality.score`はQuality Gate判定に未使用のため表示しない。
5. **固定注記を正式採用する**：「現在のQuality Gateは成果物品質の初期判定（表示のみ）です。Executive Decision・Output Draft保存は制御しません。」を常設し、Quality Gate通過がExecutive Decision Approved／Approved Decision Package生成済み／Output Draft保存可否／Completion Gate通過／Publishing Ready／正式完成のいずれも意味しないことを明示する（第13条・状態軸分離原則の踏襲）。
6. **表示対象をPath A Auto Task・手動Leader再生成のみとし、Path Bを完全非表示として正式採用する**：`inbox.qualityGate===null`（Path Bの正常仕様・Decision092で確定済み）の場合、`_elrBuildQualityGateHtml`は空文字列を返しQuality Gateセクション自体が描画されない。「対象外」「未評価」等の代替表示も行わない。
7. **既存のCross-case保護・再描画方式をそのまま再利用する**：`_elrRenderIntoChatArea()`のcaseId一致確認（Executive DecisionのcaseId／Integration InboxのcaseId／現在案件のcaseId）、`_elrRefreshInChatArea()`の限定更新（`.executive-leader-report`を除去して再描画・チャット全体は再構築しない）はいずれも無変更で流用する。Quality Gate表示関数内でグローバル案件IDを直接参照しない。
8. **F5後の消失仕様を維持する**：Quality Gate結果はセッション内保持のみであり、F5後は`_leaderIntegration`／`_executiveDecision`／`_constitutionValidation`とともに消失し、Executive Leader Report内のQuality Gate表示も消える。永続化・F5復元は今回実装しない。
9. **未実装事項を明確に区別して記録する**：Quality Gate結果のDB保存／Output Draft保存／Decision Ledger保存／decisionId・caseId付きラッパー／`qualityGateVersion`／`qualityGateThresholdVersion`／F5復元／Executive Decisionへの制御接続／Approved Decision Package生成条件への接続／Output停止／Output Draft保存拒否／Completion Gate／Publishing Ready／AI社員カード期限表示廃止はいずれも今回の正式リリース対象外であり、「完成済み」として記録しない。

**検証（Phase B-8B〜B-8C実施内容）**：
- **合成テスト（Phase B-8B）**：`_elrBuildQualityGateHtml`を実装コードから直接抽出し評価。21アサーション全PASS（`complete`／`almost_ready`でPassed表示、`needs_work`／`insufficient`でNot Passed表示、`null`／`undefined`／`{}`／`executed:false`／`passed`が文字列／`status:'unknown'`／`sourceStatus:'unknown'`／文字列入力等の不正データ12種で空文字列、HTML統合順序、score非参照、固定注記表示、入力オブジェクト非破壊）。
- **実APIテスト（Phase B-8C・既存テスト案件`case-mschx3ex4z3c`・低コストプロンプト）**：Path Aで実データ`packageQuality.status='needs_work'`に対し`inbox.qualityGate={executed:true,passed:false,status:'failed',sourceStatus:'needs_work'}`・画面表示「🟡 Not Passed（needs_work＝要改善）」・固定注記表示・表示順（Executive Summary→Constitution Structure Check→Quality Gate→Leader Summary）を`.elr-section-title`のDOM順で実測確認。`decisionStatus:'hold'`・Constitution Validator`passed:true`（12/12）・Output Draft`status:'ready'`（`quality.status:'good'`・candidate Draftのneeds_workとは独立して確定＝状態軸分離を実測）・`/api/output-drafts` POST1回・`.executive-leader-report`1件・`.elr-qg-warning`1件（重複なし）。
- **手動Leader再生成**：`atTriggerLeaderFinal()`実行で新規decisionId発行・`sourceMode:'manual_regeneration'`・Quality Gate再評価正常・`.at-leader-final-card`1件維持・ELR重複なし・Output Draft POST1回。
- **Path B回帰確認**：`handleLeaderDispatch()`成立時（Writer/Designer/Reviewer等へdispatch）でも`inbox.qualityGate===null`・Quality Gateセクション完全非表示（`.elr-qg-*`0件・🟢/🟡検出なし）・`.leader-summary-block`1件・Output Draft生成なし・`_lastOutputDraft`不変を実測確認。
- **Cross-case**：案件切替で他案件のQuality Gate誤表示なし。案件へ戻すと同一表示が正しく復元。
- **F5**：リロード後`_leaderIntegration`／`_executiveDecision`／`_constitutionValidation`ともnull・`.executive-leader-report`0件を実測確認。
- **モバイル幅**：375px幅で合成データ描画時に横スクロールなしを確認。
- 全経路でConsole Error 0・Network全200 OK。課金ロック（billingLock）はPath A自動起動を一時的にブロックする既存安全機構であり、ユーザー承認のもと検証時のみ一時解除し検証後に復元した。

**Git・反映**：Code commit **04bf9c1**（Phase B-8B・`feat: show quality gate in executive report`・`index.htmlのみ+52/-0`）＋docs commit（本更新・Phase B-8D）。Annotated Tag **v1.01-quality-gate-report-display**。main push・Render反映。**server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**。

**次工程**：Completion Gate調査・設計、Publishing Readyとの接続設計、Quality Gate結果のExecutive Decision接続検討、Quality Gate監査Version保存、Decision Ledger、AI社員カード期限表示廃止を次工程候補として並列に記録する。**特定の1つを自動的に次工程として確定しない**。正式な次工程はユーザー承認後に決定する。

---

# Decision 092
## Quality Gate 正式採用（Phase B-7D〜B-7H統合・正式リリース）（2026-08-04）

**背景**：Phase B-7A〜B-7C（調査・設計・責務再定義・閾値実データ調査）で、Quality Gateの正本入力を既存の`packageQuality`（Output Package Quality）単軸とし、新しい採点式は発明しないこと、Constitution Gate（判断プロセスの構造整合性）とQuality Gate（成果物の内容完成度）の責務を分離すること、初期通過基準を`packageQuality.status IN ('complete', 'almost_ready')`とすることを確定した。Phase B-7D〜B-7Hでこれを段階的に実装・接続・実判定化・検証・正式リリースした。

**決定（正式）**：

1. **Quality Gateの正本入力を`packageQuality`単軸として正式採用する**：評価対象は`evaluateOutputPackageCompleteness()`が返す`packageQuality`オブジェクトのみ。Approved Decision Package・Executive Decision・Leader Final文章・Executive Leader Report・Constitution Validation・Completion Gate・`OUTPUT_STATUS`・Publishing Ready・正式Output Draft全体はQuality Gateの評価対象に含めない（Phase B-7A〜B-7Cで確立した第13条・状態軸分離原則の踏襲）。
2. **初期通過基準を`complete`／`almost_ready`として正式採用する**：`packageQuality.status === 'complete'`または`packageQuality.status === 'almost_ready'`の場合のみ通過（`passed:true`）とし、`needs_work`・`insufficient`・未知の値・`status`欠落・非文字列・大文字小文字違い・空文字・非オブジェクト入力はすべて非通過（`passed:false`）とする。`packageQuality.score`および数値thresholdは判定に使用しない（第2条・Quality原則が明示する`needs_work`／`insufficient`／`almost_ready`という既存語彙をそのまま踏襲し、新しい採点式を発明しない）。
3. **Quality Gate関数`evaluateQualityGate(packageQuality)`を正式採用する**：戻り値`{ executed: true, passed: <boolean>, status: 'passed'|'failed', sourceStatus: <packageQuality.statusの原値またはnull> }`。`sourceStatus`により`packageQuality.status`自体とQuality Gate自身の判定結果（`passed`／`status`）を明確に分離し、混同しない構造とする。不正入力（`null`／`undefined`／非オブジェクト／`status`欠落／非文字列）でも例外を投げず安全側（`passed:false`）へ倒す（第14条・安全側既定値原則）。
4. **candidate Draftを正式Output Draftから分離する**：Quality Gate評価用に、`_lastOutputDraft`とは独立した新規オブジェクト`{ type, fields: {} }`を`_liCollectIntegration()`内で生成する。Phase B-7Dで`buildOutputDraftFromLeaderFinal(finalText, opts, targetDraft)`へ追加した第3引数`targetDraft`（省略時は`_lastOutputDraft`を使用し既存呼び出し2箇所は完全後方互換）を利用し、既存の13型fields構築ロジックを再利用（二重実装なし）。`opts.candidateOnly === true`時はfields構築とpackageQuality算出のみを行いreturnし、status確定・`fields.approvedDecisionPackage`複製・POSTには一切到達しない（candidate Draftは保存されず、`/api/output-drafts`のPOST回数は増加しない）。
5. **Quality Gate評価位置を`packageQuality`算出後・Executive Decision実行前として正式採用する**：`_liCollectIntegration()`内、`_leaderIntegration = inbox;`確定直後・`_edRunDecisionEngine(inbox)`呼び出し直前に配置。因果順序は「candidate Draft生成→fields構築→packageQuality算出→Quality Gate評価→`inbox.qualityGate`確定→Executive Decision→正式Output Draft確定→Output Draft保存」で固定する。Approved Decision Package生成後にQuality Gateを評価する構造ではない。
6. **対象経路をPath A（Auto Task）・手動Leader再生成とし、Path Bを正式に対象外とする**：Path Bは`_liCollectIntegration('pathB', ...)`経由でExecutive Decision経路には到達するが、`detectOutputType()`・`createOutputDraft()`・`buildOutputDraftFromLeaderFinal()`のいずれも呼び出されずcandidate Draft生成契約・`packageQuality`算出契約を持たない（Phase B-7B・B-7Gの実コード調査で確認済み）。したがって`inbox.qualityGate === null`がPath Bの正常仕様である。他案件の`_lastOutputDraft.type`や残留Draftを代用しない。この扱いはDecision087で確定済みの「Path BはOutput Draft制御対象外」という既存設計を継承する。
7. **現段階での影響範囲をセッション内保持のみとする**：Quality Gateの判定結果（`inbox.qualityGate`）は`_leaderIntegration`経由のセッション内メモリに保持されるのみ。Quality Gateが`passed:false`でも、現段階ではExecutive Decisionの`decisionStatus`・Approved Decision Package生成条件・Constitution Gate・Output Draft保存可否・Output Draftの`status`・`OUTPUT_STATUS`・UI表示・Publishing Ready・Completion Gateのいずれも変更しない（第13条・状態軸分離原則）。
8. **未実装事項を明確に区別して記録する**：数値score閾値／数値threshold／`qualityGateVersion`／`qualityGateThresholdVersion`／`constitutionVersion`保存／`completionGateVersion`保存／Quality Gate結果のOutput Draft保存／DB保存／Decision Ledger保存／F5復元／Quality Gate UI／Executive Leader ReportへのQuality Gate表示／Quality GateによるOutput停止／Output Draft保存拒否／Executive Decisionのapproved到達条件への統合／Approved Decision Package生成条件への統合／Completion Gate／Publishing Ready判定はいずれも今回の正式リリース対象外であり、「完成済み」として記録しない。

**却下した案**：Quality Gate入力に`score`・`fields`・`artifacts`・`caseId`・`decisionId`等を含める案（Phase B-7Bの調査で、既存採点式の再利用と入力契約の最小化を優先し不採用）。候補A（案A＝Output Draft生成後の観測のみをQuality Gateと呼ぶ設計）は、判定時点で`decisionStatus`・Package・status・POSTがすべて確定済みで制御性を持たず、第2条（Quality原則）が禁じる「Quality Gate未通過をOutput Readyとして扱う」状態を構造的に作り出すため、Phase B-7Bの調査で不採用と判定した。

**検証（Phase B-7D〜B-7G実施内容）**：
- **合成テスト**：`index.html`から実装コード（`QUALITY_GATE_PASSING_STATUSES`定数・`evaluateQualityGate`関数本体）を正規表現で直接抽出し評価。14/14 PASS（`complete`／`almost_ready`通過、`needs_work`／`insufficient`／未知値／大文字小文字違い／空文字／非文字列／`status`欠落／`null`／`undefined`／文字列入力／数値／配列すべて非通過、全ケース例外0、入力オブジェクト非破壊、関数定義重複なし）。
- **実APIテスト（Path A・既存テスト案件・低コストプロンプト）**：実データ`packageQuality={score:71, status:'needs_work'}`に対し`inbox.qualityGate={executed:true, passed:false, status:'failed', sourceStatus:'needs_work'}`と正しく判定。`decisionStatus:'hold'`・`decisionId`発行・Constitution Validator`passed:true`・Output Draft`status:'ready'`・POST1回・Executive Leader Report1件（重複なし）を確認。
- **手動Leader再生成**：`sourceMode:'manual_regeneration'`・新規`decisionId`発行・Path Aと同一ロジックで`passed:false`・Output Draft保存1回を確認。
- **Path B回帰確認**：dispatch成立時（`/api/leader-summary`発火・`chatHistory['leader']`へ`fromLeaderSummary:true`エントリ保存を確認）でも`inbox.qualityGate === null`・`_lastOutputDraft.id`／`updatedAt`不変（candidate Draft・正式Draftいずれも生成されない）ことを実測確認。
- 3経路ともConsole Error 0・Network全リクエスト200 OK。

**Git・反映**：Code commit **f866d4d**（Phase B-7D）＋**0f104d3**（Phase B-7E）＋**1a92884**（Phase B-7F）＋docs commit（本更新・Phase B-7H）。Annotated Tag **v1.01-executive-quality-gate**。main push・Render反映。**server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**。

**次工程**：Completion Gate調査・設計、Publishing Readyとの接続設計、Quality Gate結果のExecutive Decision接続検討、Quality Gate監査Version保存、Decision Ledger、Quality Gate UI／Executive Leader Report表示、AI社員カード期限表示廃止を次工程候補として並列に記録する。**特定の1つを自動的に次工程として確定しない**。正式な次工程はユーザー承認後に決定する。

---

# Decision 091
## Constitution Gate 正式採用（Phase B-6A〜B-6D統合・正式リリース）（2026-08-03）

**背景**：Constitution Structure Check正式採用（Phase B-5C・Decision090）により、Constitution Validator Coreの検証結果（`_constitutionValidation`）がExecutive Leader Report内の独立セクションとして表示されるようになったが、この検証結果は表示のみに留まり、Approved Decision Packageの実際の受け渡し可否には一切接続されていなかった。Phase B-6では、`fields.approvedDecisionPackage`へPackageを複製保存する直前の確定条件へConstitution検証結果を接続する「Constitution Gate」を正式採用した。

**決定（正式）**：

1. **Constitution Gate（狭域Gate）を正式採用する**：Path A（`atRunWorkflow()`）・手動Leader再生成（`atTriggerLeaderFinal()`）双方において、`_edApprovedPackageForOutput`／`_manualApprovedPackageForOutput`（`fields.approvedDecisionPackage`へ渡すPackage参照）の確定条件へ、既存の`sourceDecisionId`一致・`caseId`一致に加えて以下4条件をANDで追加する：
   - `_constitutionValidation`が存在すること
   - `_constitutionValidation.decisionId`が`_executiveDecision.decisionId`と一致すること
   - `_constitutionValidation.caseId`が`_executiveDecision.caseId`と一致すること
   - `_constitutionValidation.result`が存在し、`_constitutionValidation.result.passed === true`であること

   いずれか1つでも満たさない場合は、既存どおりfail-closed（`_edApprovedPackageForOutput`／`_manualApprovedPackageForOutput`はnullのまま）とし、例外は投げない。Phase B-6A（調査・設計）で「広域Gate」（Decision生成自体・Package生成ロジック本体への組み込み）と「狭域Gate」（Package複製可否のみへの限定接続）の2案を比較検討し、狭域Gate案を正式採用した。
2. **Gateの適用範囲を「Package複製の可否」のみに限定する**：Validator本体（`validateExecutiveDecision()`）・Executive Decision Engine本体（`_edRunDecisionEngine()`）・Approved Decision Package生成ロジック（`_edBuildApprovedDecisionPackage()`）・Output Draft本文（slides/caption/cta等）は一切変更しない。Constitution Gateが制御するのは「Approved Decision Packageを`fields.approvedDecisionPackage`へ複製するかどうか」の1点のみであり、Decision自体の採否判定（`decisionStatus`）やOutput Draftの生成そのものには影響しない（第9条・正本一意性を維持し、Gateを新たな正本にしない）。
3. **既存動作への副作用がないことを確認する**：通常運用ではdecisionStatusがapprovedへ到達せず（Quality Gate・Completion Gate未定義のため。Decision086〜090で継続確認済みの既知の仕様）、Approved Decision Packageは常に`null`である。したがって今回追加した4条件は、通常運用下では判定対象（Package自体）が存在しないため実質的に発火せず、既存の正常系動作（Hold／Insufficient時の挙動）へ一切の副作用を与えない。この点をPhase B-6Cの実APIテストで実測確認した。
4. **正式工程分割**：**Phase B-6A**（調査・設計・Constitution Gate案の比較検討・狭域Gate案の正式採用決定）／**Phase B-6B**（Path A・手動Leader再生成への実装・Code commit **9436fec**）／**Phase B-6C**（Auto Task・手動Leader再生成・Path B 3経路の実APIテスト・回帰確認）／**Phase B-6D**（本Decision091を含む正式リリース：docs更新・commit・tag・push・Render反映）の4工程として正式に完了する。

**却下した案**：Validator結果をExecutive Decision Engine本体（`_edRunDecisionEngine()`・`_edBuildApprovedDecisionPackage()`）へ組み込み、Constitution違反時にDecision生成自体を停止させる「広域Gate」案は、Quality Gate・Completion Gateが未定義の現段階でDecision生成自体を止めると、Executive Leader Report・Constitution Structure Checkの表示という既存Phase B-5Cの正常動作にまで影響が及ぶリスクがあり、既存Workflow保護原則（第14条・安全側既定値）に反するため不採用。影響範囲を「Package複製の可否」に限定した狭域Gateを正式採用した。

**検証（Phase B-6C実施内容）**：既存テスト案件（PhaseB4B検証用テスト案件）を再利用し、低コストプロンプトで実APIテストを実施。①**Auto Task**：Writer→Reviewer→品質レビュー→Strategy→Leader Finalが正常完了、Executive Leader Report生成（Decision Status=Hold・Decision Confidence Insufficient32点）、**Constitution Structure Check：Passed（12/12）**。②**手動Leader再生成**：新規decisionId発行（Decision Confidence25点）、**Constitution Structure Check：Passed（12/12）**、`.leader-summary-block`表示スタイルへの影響なし。③**Path B（dispatch成立時）**：「Writer担当に一言だけ挨拶文を…」でWriter/Designer/Reviewerへdispatch、Executive Leader Report即時更新（`.executive-leader-report`要素は常に1件のみ・重複なし）、**Constitution Structure Check：Passed（12/12）**。3経路とも`decisionStatus`は`hold`のため`approvedDecisionPackage`は常に`null`（`fields.approvedDecisionPackage`キー不在・`_lastOutputDraft.status:'ready'`・`packageQuality:{status:'needs_work',score:71}`）であり、Constitution Gateの4条件追加が既存の正常系フローに影響を与えないことを実測確認した。Console Error 0（3経路とも）・Network全リクエスト200 OK（`/api/chat`・`/api/leader-summary`・`/api/output-drafts`・`/api/tasks`・`/api/strategy-consolidate`等）。

**Git・反映**：Code commit **9436fec**（`feat: gate approved package by constitution`・Phase B-6B・`index.htmlのみ+20/-2`・Path A/手動Leader再生成の2箇所）＋docs commit（本更新・Phase B-6D）。Annotated Tag **v1.01-executive-constitution-gate**。main push・Render反映。**server.js/lib/DB/schema.sql/API無変更**。**Phase54 Complete維持・Phase55未着手**。

**次工程**：Validator違反時の制御設計、Quality Gate調査・設計、Completion Gate調査・設計、Decision Ledger、AI社員カード期限表示廃止を次工程候補として並列に記録する。**特定の1つを自動的に次工程として確定しない**。正式な次工程はユーザー承認後に決定する。

---

# Decision 090
## Constitution Structure Check 正式採用（Phase B-5C-1〜B-5C-3統合・正式リリース）（2026-08-03）

**背景**：Executive Constitution Validator Core（Phase B-5・Decision089）が正式Completeし、`validateExecutiveDecision(decision)`による12項目の構造整合性検証結果を内部メモリ（`_constitutionValidation`）へ保持できるようになった。しかし当初はUI表示が未実装であり、ユーザーが検証結果を確認する手段がなかった。Phase B-5C-1（Decision対応契約）・Phase B-5C-2（Executive Leader Report表示）・Phase B-5C-3（即時再描画接続）の3工程を通じ、検証結果を安全に画面表示し、Decision生成直後に即時反映される状態まで完成させた。

**決定（正式）**：

1. **Constitution Structure Checkを正式採用する**：Constitution Validator Coreの検証結果を「Constitution Structure Check（構造整合性チェック）」という表示名でExecutive Leader Report内の独立セクションへ表示する。「Constitution Validation」単独表記は用いない（Executive Constitution全14条を完全検証したという誤認を避けるため）。表示は判定のみであり、Decision・Approved Decision Package・Output Draftへの書き込み・Output制御は一切行わない。
2. **Decision対応契約（Phase B-5C-1）**：`_constitutionValidation`を`validateExecutiveDecision()`の戻り値そのものではなく、`{ decisionId: decision.decisionId || null, caseId: decision.caseId || null, result: <Validator戻り値> }`というセッション内ラッパーとして保持する。`_constitutionValidation`はExecutive Decisionの正本でもValidator結果の永続正本でもなく、表示層が対象Decisionとの対応を安全に確認するためのセッション内契約である。Validator関数自体・戻り値構造（`{version, passed, violations, checkedRules}`）・12検証項目は無変更。代入は`_edRunDecisionEngine()`内の2箇所（判断確定後のラッパー設定・Executive Decision生成不能時の`null`リセット）に限定し、他の関数・表示層・Path別処理からは代入しない。
3. **Executive Leader Report表示（Phase B-5C-2）**：`_elrBuildReportHtml(decision, inbox, validation)`へ第3引数`validation`を追加する。関数内で`_constitutionValidation`グローバルを直接参照せず、呼び出し元（`_elrRenderIntoChatArea()`）が対応確認済みの値のみを渡すことで純粋関数性を維持する。表示位置はExecutive Summaryの直後・Leader Summaryの直前（独立セクション）。Passed時は`result.checkedRules.length`から動的算出した「Passed（N/N）」の1行のみを表示し、12項目の詳細一覧は常時表示しない。Violations時は違反件数と`violations[].message`を常時表示し、`violations[].rule`（技術的なルールID）は`<details><summary>技術詳細</summary>`内にのみ表示する。両ケースとも「現在は構造整合性チェックです。Evidence十分性・Quality Gate・Completion Gateとは別軸です」という固定注記を表示し、全14条完全検証との誤認を防ぐ。`passed:true`をApproved・完成・品質合格の意味で表示しない（第13条・状態軸分離。`decisionStatus`／`constitutionValidation.passed`／`OUTPUT_STATUS`／`packageQuality.status`の4軸は独立して同時に成立し得る）。
4. **対応確認とCross-case（Phase B-5C-2）**：`_elrRenderIntoChatArea()`は既存のCross-caseガード（`_executiveDecision.caseId !== curCaseId`時はReport全体非表示）通過後、追加で`_constitutionValidation`の存在・`result`の存在・`decisionId`一致・`caseId`一致・現在案件caseId一致を確認し、すべて満たす場合のみValidationを`_elrBuildReportHtml()`へ渡す。不一致・不在時はValidationセクションのみ非表示とし、Report本体（Executive Summary等）は従来どおり表示を継続する（Validation不一致を理由にReport全体を停止しない）。
5. **安全な正規化（Phase B-5C-2）**：表示用Validationは不正データでも例外を出さない設計とする。`result`なし／`passed`が非boolean／`violations`が非配列／`checkedRules`が非配列／violation要素が不正／`message`なしのいずれの場合も、Validationセクションを非表示にする安全側設計を優先し、「Passed」等を推測表示しない。`message`／`rule`は既存`escapeHtml`を再利用してエスケープし、新規の重複エスケープ関数は追加しない。
6. **即時再描画接続（Phase B-5C-3）**：`_elrRenderIntoChatArea()`のDOM挿入方式を`chatEl.appendChild(wrap.firstChild)`から`chatEl.insertBefore(wrap.firstChild, chatEl.firstChild)`へ変更する。既存の`reRenderChatArea()`からの呼び出しは`chatEl.innerHTML=''`直後（`chatEl.firstChild===null`）のため、この変更による既存呼び出しへの影響はない。新設`_elrRefreshInChatArea()`（既存`.executive-leader-report`要素を除去し`_elrRenderIntoChatArea()`を再実行するだけの限定更新）を、Path A（`atRunWorkflow()`）・手動Leader再生成（`atTriggerLeaderFinal()`）・Path B（`triggerLeaderSummary()`・dispatch成立時のみ）の`_liCollectIntegration()`完了直後へ接続する。
7. **チャット全体再構築を採用しない理由（Phase B-5C-3・設計判断）**：当初は既存`reRenderChatArea()`（`chatEl.innerHTML=''`からの全体再構築）を再利用する案を検討したが、調査の結果、Path Bは`triggerLeaderSummary()`内で`.leader-summary-block`という専用クラスのdiv要素をDOMへ直接追記する既存実装であり、`reRenderChatArea()`の再構築ループはこの専用スタイルを再現せず通常のAIチャットバブル（`addBubble()`）として描画し直してしまうことが判明した。これは表示内容・表示スタイルの意図しない変更に当たるため不採用とし、チャット全体を再構築しない`_elrRefreshInChatArea()`（Executive Leader Report要素のみの差し替え）を採用した。この設計により、Path A・手動再生成・Path Bいずれの経路でも既存メッセージのDOM・表示スタイルへの影響がゼロであることを実機で確認した。
8. **dispatchなし時の扱い（Phase B-5C-3）**：Path Bの新規再描画呼び出しは`if (_liSession) { ... }`ブロックの内側にのみ配置する。dispatchが発生せず`_liSession`が見つからない場合はブロック自体に到達しないため、コード構造上100%スキップされる（追加の条件分岐を新設しない）。

**却下した案**：`_constitutionValidation`に`decisionId`/`caseId`を追加しない案（Phase B-5C-1調査時点の代替案・Validator戻り値そのものを保持し続ける案）は、表示層が対象Decisionとの対応を検証できず誤表示リスクが残るため不採用。Path A/手動再生成/Path Bの即時反映に既存`reRenderChatArea()`をそのまま再利用する案は、上記7の理由により不採用。Validator結果をDB・Output Draft fieldsへ保存する案は、Constitution Validator Coreの責務（読み取り専用・判定のみ）を逸脱するため今回は不採用（将来Decision Ledger実装時に再検討）。

**検証（今回の実施範囲）**：Node合成テスト計51アサーション（Phase B-5C-1：22件、Phase B-5C-2：29件）全PASS。実APIテスト（Auto Task1回・手動Leader再生成1回・Path B dispatch1回・低コストプロンプト・既存テスト案件再利用）で、3経路すべてにおいて追加のページ操作なしにExecutive Leader Report・Constitution Structure Checkが即時反映されることを実測。Cross-case（案件切替）・F5復元（`_executiveDecision`/`_constitutionValidation`ともnullへリセット）・Output Draft（`status`／`fields.approvedDecisionPackage`キー不在）・Output Engine（Package Quality等）がいずれも無変更であることを確認。JavaScript構文チェック（`node --check`）・`npm run dev-check`（200/200/200）・`git diff --check`を各工程で実施。実API概算費用は¥12（Claude Cost Analysis実測差分）。**server.js・openaiClient.js・DB・schema.sql・APIの変更は一切なし**。

**Git・反映**：Code commit **a2834d3**（Phase B-5C-1）＋**9e6d094**（Phase B-5C-2）＋**58315ee**（Phase B-5C-3）＋docs commit（本更新）。**Phase54 Complete維持・Phase55未着手**。

**次工程**：Validator違反時の制御設計、Quality Gate調査・設計、Completion Gate調査・設計、Decision Ledger、AI社員カード期限表示廃止を次工程候補として並列に記録する。**特定の1つを自動的に次工程として確定しない**。正式な次工程はユーザー承認後に決定する。

---

# Decision 089
## Executive Constitution Validator Core 正式採用（Phase B-5）（2026-08-03）

**背景**：Approved Decision Package契約構造正式実装（Phase B-4・Decision088）完了後、次工程Constitution Validator（Phase B-5）に着手した。Executive Decision Engineが生成するDecisionおよびApproved Decision Packageに対し、Executive Constitution（Decision086）に照らした構造整合性を検証する読み取り専用の層を新設した。

**決定（正式）**：

1. **Constitution Validator Coreを正式採用する**：`validateExecutiveDecision(decision)`を独立関数として新設する。引数`decision`は読み取り専用として扱い、プロパティの代入・削除を一切行わない。本関数は新しいDecisionを生成せず、Decision・Approved Decision Package・Output Draftのいずれも変更しない（第9条・正本一意性を維持し、Validatorを新たな正本にしない）。戻り値は`{version, passed, violations, checkedRules}`のみとし、`violations`は`{rule, message}`の配列とする。
2. **呼び出し位置を`_edRunDecisionEngine()`内の判断確定直後に限定する**：`_executiveDecision = decision;`でExecutive Decisionが確定した直後にのみValidatorを実行し、結果を`_constitutionValidation`（新設のセッション内一時変数）へ保持する。因果順序は「Executive Decision生成→`_executiveDecision`確定→Constitution Validator実行→結果を`_constitutionValidation`へ保持→既存後続処理」で固定し、Validatorが判断確定前に実行される経路は存在しない。Validator自体が例外を投げても`try/catch`で隔離し、Executive Decision Engine本体・後続のLeader Final・Output Draft・Output Engineは絶対に止めない（第14条・安全側既定値）。早期return（`inbox`または`inbox.caseId`不在）時は`_executiveDecision`と同様に`_constitutionValidation`も`null`へリセットする。
3. **検証対象を12項目の構造整合性検証に限定する**：`executive_decision_exists`（Executive Decision存在確認）／`decision_id_present`（decisionId存在）／`decision_status_present`（decisionStatus存在・`approved/rejected/hold/insufficient`の値域確認）／`executive_summary_present`（Executive Summary存在）／`decision_confidence_present`（Decision Confidence存在）／`source_decision_id_consistency`（Package存在時、`sourceDecisionId`とDecisionの`decisionId`の一致）／`package_only_when_approved`（Approved時のみPackage生成）／`package_null_when_not_approved`（非Approved時はPackageが`null`であること）／`output_draft_did_not_generate_package`（既存`decision.affectsOutputDraft === false`を参照し、EDEの判断がOutput Draftを生成・変更していないことの確認。Decision086／Phase B-2Aで導入済みの既存フィールドをそのまま参照し、新規状態は作らない）／`package_holds_source_decision_id`（Package存在時、`sourceDecisionId`が非空文字列であること）／`cross_case_consistency`（DecisionのcaseId存在、およびPackage存在時のcaseId一致）／`single_decision_authority`（Package存在時、Package自身が`decisionId`／`packageId`という独自識別子を持たないこと＝`sourceDecisionId`を介してのみExecutive Decisionを参照する第9条・単一正本原則の直接的検証）。
4. **Constitution Validator Coreの責務範囲を明確に限定する**：本工程で正式Completeとする対象は「Constitution Validator Core」（12項目の構造整合性検証）のみである。以下は明確に区別し、**「Executive Constitution全14条を完全実装済み」とは記録しない**：
   - **完成済み**：Executive Decision構造検証／decisionId確認／decisionStatus確認／Executive Summary確認／Decision Confidence確認／Approved Package生成条件確認／sourceDecisionId整合確認／Cross-case確認／単一判断主体確認／非破壊・読み取り専用検証／Path A接続／手動Leader再生成接続／`_constitutionValidation`へのセッション内保持。
   - **未実装**：Executive Constitution全14条の完全な意味論的検証／Evidence内容の十分性判定／成果物品質の実質評価／成果物完成度の実質評価／Constitution違反によるOutput停止／Validator結果のExecutive Leader Report表示／Validator違反のユーザー通知UI／Quality Gate／Completion Gate／Decision Ledger／Executive Memory／Self Improvement。
5. **Path別の接続方針を確認する**：
   - **Path A（`atRunWorkflow()`）**：`_liCollectIntegration('pathA', ...)`経由で`_edRunDecisionEngine()`が呼ばれ、Validatorが実行される。実APIテスト（低コストプロンプト・既存テスト案件を再利用）で`decisionId: ed-mscq548ee05g`・`sourceMode:'auto_task'`・Validator`passed:true・violations:[]・checkedRules12件`を実測確認。
   - **手動Leader再生成（`atTriggerLeaderFinal()`）**：Path Aとは独立した`_manualApprovedPackageForOutput`／`_manualPkgCandidate`のPackage取得変数を用いるが、Validator自体はPath Aと同一の`_edRunDecisionEngine()`内呼び出しを共有する。実APIテストで新規`decisionId: ed-mscq6pcrymzi`・`sourceMode:'manual_regeneration'`・Validator`passed:true・violations:[]`を実測確認。
   - **Path B**：`handleLeaderDispatch()`起点でdispatchが実際に発生した場合のみ`_liCollectIntegration('pathB', ...)`が呼ばれ、Path A／手動再生成と同一の`_edRunDecisionEngine()→validateExecutiveDecision()`経路を通る（既存仕様・無変更）。dispatchが発生しない直接応答（今回の実機確認で発生した経路）ではLeader Integration Layer・Executive Decision Engine・Validatorのいずれも起動しない。これは既存仕様どおりであり不具合ではない。dispatchを強制的に再現する追加APIテストは、費用対効果と第9条上の必要性（Path A／手動再生成で同一コード経路を既に実測済み）の観点から今回実施しない。
6. **F5復元仕様を変更しない**：F5後は`_executiveDecision = null`・`_constitutionValidation = null`となる（既存の`_executiveDecision`のF5非永続方針をそのまま踏襲）。Output Draftは既存の保存データから復元されるのみで、Validator結果の永続化・復元は今回追加しない。
7. **非破壊性を確認する**：`git show --stat ea1ae68`で変更範囲がExecutive Decision Engine Coreセクション内の3箇所（`_constitutionValidation`宣言・Validator関数本体・`_edRunDecisionEngine()`内の呼び出し追加）に限定されることを確認。Executive Leader Report・Output Draft生成（`buildOutputDraftFromLeaderFinal()`）・F5復元処理・Approved判定ロジック（`_edDecideStatus()`）・`server.js`・`openaiClient.js`・DB・APIはいずれも無変更。Node合成テスト13シナリオ26アサーション全PASSで、Decision／Packageへのプロパティ変更が発生しないことも確認済み。

**却下した案**：Validator結果を`decision`オブジェクトへ直接埋め込む案（第9条・正本一意性に反し、Decision自体をValidatorが書き換えることになるため不採用）。Validator違反時にOutput Draft生成やLeader Finalを停止する案（Quality Gate・Completion Gate未定義の現段階で導入すると、既存Workflow保護原則に反し正常系を壊すリスクがあるため今回は不採用・Gate設計が固まった後の別工程候補とする）。Path Bのdispatchを強制的に再現する追加APIテストを実施する案（Path A／手動再生成で同一コード経路を既に実測済みであり、追加コストに見合う新規知見が乏しいため見送り）。

**検証（今回の実施範囲）**：Node合成テスト13シナリオ26アサーション全PASS（前工程で実施・今回は再実行のみで再確認）。JavaScript構文チェック（インラインJS抽出・`node --check`）・`npm run dev-check`（200/200/200）・`git diff --check`・`git show --stat`によるコード変更範囲確認。実APIテストはPhase B-5前工程で実施済み（Auto Task1回＋手動Leader再生成1回・Claude実測概算¥13）を流用し、本工程（docs正式化）では追加のAI API実行は行っていない。**index.html／server.js／openaiClient.js／DB／schema.sql／APIの変更は一切なし**。

**Git・反映**：Code commit **ea1ae68**（`feat: add executive constitution validator`・前工程で実施済み）＋docs commit（本更新）。Tag作成なし。**push未実施**（ユーザー確認後に別途判断）。**Phase54 Complete維持・Phase55未着手**。

**次工程**：Validator結果のExecutive Leader Report表示、Validator違反時の制御設計、Quality Gate調査・設計、Completion Gate調査・設計、Decision Ledger、AI社員カード期限表示廃止（pending/in_progress/completed/error/skippedへの置換）を次工程候補として並列に記録する。**特定の1つを自動的に次工程として確定しない**。正式な次工程はユーザー承認後に決定する。

---

# Decision 088
## Approved Decision Package 契約構造正式実装（Phase B-4A〜B-4D）・統合検証正式Complete（Phase B-4E）（2026-08-03）

**背景**：Executive Leader Report表示（Phase B-3・正式Complete）後、Approved Decision Packageの正式契約構造・保存先・Path A/手動再生成/Path Bへの接続方法を調査（Phase B-4投資調査）した結果に基づき、Phase B-4A〜B-4Dとして段階実装し、Phase B-4Eで統合検証・正式完了判定を行った。

**決定（正式）**：

1. **Decision IDの発行方針（Phase B-4A）**：`_edRunDecisionEngine(inbox)`は`decisionResult`の算出前に`var decisionId = 'ed-' + genId();`を生成し、decisionStatus（approved/rejected/hold/insufficient）に関わらず最終`decision`オブジェクトへ`decisionId: decisionId`として必ず含める。これにより、Approved以外の状態でも会社判断イベント自体を一意に識別できるようになり、Decision087で記録した「Decision IDは現状Approved時のみ生成される」という設計課題を解消した。
2. **Approved Decision Packageの契約構造（Phase B-4A）**：`_edBuildApprovedDecisionPackage(decisionId, inbox, decisionResult, confidence, alternatives, summary, approvedArtifacts)`は`decisionResult.status === 'approved'`の場合のみオブジェクトを返し、それ以外は`null`を返す。Packageは独自の`decisionId`／`packageId`を持たず、`sourceDecisionId: decisionId`のみで元のExecutive Decisionを参照する（第9条・単一正本原則）。Package本体：`version`／`sourceDecisionId`／`caseId`／`workflowId`／`interactionId`／`decisionStatus`／`executiveSummary`／`approvedArtifacts`／`evidenceGate`／`qualityGate`／`completionGate`／`constitutionCheck`／`decisionConfidence`／`strategicAlternatives`／`risks`／`outputInstructions`／`createdAt`。
3. **Path A接続（Phase B-4B）**：`atRunWorkflow()`にて、`_liCollectIntegration()`実行後の`_executiveDecision`から`caseId === _atRunCaseId`かつ`approvedDecisionPackage.sourceDecisionId === _executiveDecision.decisionId`かつ`approvedDecisionPackage.caseId === _atRunCaseId`の三重一致を確認したうえで`_edApprovedPackageForOutput`として取得し、`buildOutputDraftFromLeaderFinal(data.leaderFinalResult.text, { noCompletedResults, approvedDecisionPackage: _edApprovedPackageForOutput })`へ渡す。不一致時は`null`（安全側）。既存Output Draft挙動・POST回数（1回）は完全無変更。
4. **手動Leader再生成接続（Phase B-4C）**：`atTriggerLeaderFinal()`にPath Aとは独立した変数命名（`_manualApprovedPackageForOutput`／`_manualPkgCandidate`）で同型の三重一致確認ロジックを実装し、`buildOutputDraftFromLeaderFinal(data.reply, { noCompletedResults: _manualNoCompletedResults, approvedDecisionPackage: _manualApprovedPackageForOutput })`へ渡す。旧Packageの誤適用防止として、①caseId不一致→null、②sourceDecisionId不一致（同一案件だが古いDecisionのPackage）→null、③今回Decisionが非Approved（Package自体がnull）→null、④`_executiveDecision`不在→null、の4ケースをNode合成テストで確認済み。
5. **fields保存・F5復元・後方互換（Phase B-4D）**：`buildOutputDraftFromLeaderFinal()`終盤（`_lastOutputDraft.status`確定前）に以下を追加：
   ```js
   if (approvedDecisionPackage) {
     fields.approvedDecisionPackage = approvedDecisionPackage;
   } else {
     delete fields.approvedDecisionPackage;
   }
   ```
   Package参照はそのまま格納する（案A採用）。理由：Packageは生成後どこからも変更されない設計（Phase B-4A〜C）であり、既存のPOST(JSON.stringify)→DB(JSONB)→GET(JSON parse)という永続化往復自体が復元時に独立コピーを生むため、新規deepClone等の共通基盤は追加しない。`fields`は手動再生成等で同一オブジェクトが再利用され得るため、Packageなし時は前回分の残留を防ぐため明示的にキーを削除する（削除は既存キー有無に関わらず安全）。旧形式Draft（`approvedDecisionPackage`キーが元々存在しないfields）でも例外なく動作する。
6. **所有関係の正式確定**：Executive Decision Engine＝Approved Decision Packageの論理上の発行元・正本。Approved Decision Package＝`sourceDecisionId`を介した派生契約であり自身のIDを持たない。Output Draftの`fields.approvedDecisionPackage`＝「複製（materialized copy）」であり正本ではない。将来のDecision Ledger（Phase C-1）が永続正本となる設計を維持し、Output Draft（`output_id`をPRIMARY KEYとするupsert上書き方式）をDecision Ledgerの代替として扱わない（Decision086・087を踏襲）。
7. **統合検証（Phase B-4E）の実施内容と判定**：Node合成テスト13項目（Phase B-4A〜Dの契約構造・取得ロジック・fields保存ロジックを実コード抜粋で検証）全PASS。実APIテスト（テスト案件「PhaseB4B検証用テスト案件」でAuto Task 1回〔Writer+Reviewer最小構成〕＋手動Leader再生成1回を実行）で、Auto Task側`decisionId`（`ed-mscjykynt6fw`）と手動再生成側`decisionId`（`ed-mscjyxc2nitq`）が別値であること・`sourceMode`/`sourceEngine`の正しい区別・`approvedDecisionPackage: null`（Hold状態のため正常）・`fields.approvedDecisionPackage`キー不在（生成直後・F5復元後の両方）・既存Output Draftフィールド（slides/caption/cta/hashtags/imagePrompts/targetAudience/benefit/saveSharePrompt）の無傷・Executive Leader Reportの正しい再描画・案件切替時のCross-case保護（Executive Leader Reportの非表示）・Console Error 0・Network 200のみを実機確認した。検証中、`buildOutputDraftFromLeaderFinal()`冒頭の`approvedDecisionPackage`受領部にPhase B-4B時点の古いコメント（「今回はfields保存等いずれにも使用しない」という趣旨の記述）がPhase B-4D実装後も残っていることを発見したが、diff確認によりロジックへの影響はゼロ（コメント2行のみの変更）であったため、コメント文言のみを修正しコード機能commit群とは別のcommit（**b423acd**）として記録した。機能的な不具合は0件（コメント不整合のみ）であったため、**Phase B-4 Approved Decision Package正式Completeと判定した**。
8. **本工程で変更していないもの**：AI社員カードの「期限」表示（別途対応予定・本Decisionの対象外）。Constitution Validator・Quality Gate・Completion Gate・Decision Ledger永続化・`fields.executiveDecisionCache`（いずれもPhase B-5以降）。`server.js`・`lib`・DB・`schema.sql`・API・UI。

**却下した案**：Approved Decision Package自体に独自IDを発行する案（第9条・単一正本原則に反し、DecisionとPackageのどちらが正本かが曖昧になるため不採用）。`fields.approvedDecisionPackage`保存時にdeepClone等の共通基盤を新設する案（既存のJSON往復が自然にコピーを生むため、Constitution第9条「最小構成」の観点から過剰実装として不採用）。

**検証（今回の実施範囲）**：Node合成テスト13項目（全PASS）。実APIテスト（Auto Task1回＋手動Leader再生成1回・低コストプロンプト）。JavaScript構文チェック・`npm run dev-check`（200/200/200）・`git diff --check`。**DB・API・server.js・openaiClient.jsの変更は一切なし**。

**Git・反映**：Code commit 718f200（Phase B-4A）／67ab6cb（Phase B-4B）／95beda3（Phase B-4C）／65fe551（Phase B-4D）／b423acd（コメント修正・独立commit）＋docs commit（本更新）。Tag作成なし。**push未実施**（ユーザー確認後に別途判断）。**Phase54 Complete維持・Phase55未着手**。

**次工程**：Phase B-5 Constitution Validator（未着手）。ただしユーザー承認なしに開始しない。

---

# Decision 087
## Executive Decision Control 正式工程分割（Phase B-2A／B-2B）・因果接続方針の正式採用（2026-08-02）

**背景**：Executive Decision Engine Core（Phase B-1・正式Complete・commit 6c14e73/ade31ef）実装後、次工程Executive Decision Control（当初Phase B-2）の因果接続方式を正式設計する調査を実施した。既存Path A（`atRunWorkflow()`）／Path A手動再生成（`atTriggerLeaderFinal()`）／Path B（`handleLeaderDispatch()`〜`triggerLeaderSummary()`）の実行順序・入力構造・保存経路を実コードで調査した結果、3経路がLeader Final生成エンジン・Output Draft生成の有無・入力データの鮮度において構造的に異なることを実測確認したため、単一工程での一括実装を避け、経路ごとに責務を分離した正式工程へ分割した。

**決定（正式）**：

1. **Path A通常フローの構造的制約を正式に記録する**：`atRunWorkflow()`が呼ぶ`/api/auto-task`は、AI社員実行→Reviewer→Strategy統合→`runLeaderFinalResponse()`（完成成果物生成）までを`runAutoTaskWorkflow()`という単一の非同期関数内・単一のHTTPリクエスト/レスポンス往復の中で完結させる。**クライアント側に存在するExecutive Decision Engineは、Leader Final生成前のデータへ介入する経路を持たない**（HTTPレスポンス到達後にしかクライアントはデータを取得できない）。この制約により、Leader Final生成前にEDEを接続する案（AI社員実行後・Leader Final生成前に介入する案、`runLeaderFinalResponse()`内部/直前にDecision結果を入力する案）はいずれも`server.js`／`openaiClient.js`の変更（API契約変更・単一リクエストの分割）を必須とするため**不採用**とする。

2. **案D（段階導入）を正式採用する**：Leader Final候補生成（`runLeaderFinalResponse()`完了・HTTPレスポンス到達）後、Output Draft確定（`buildOutputDraftFromLeaderFinal()`）前に、Executive Decision Engineを接続する。追加のAI実行・API契約変更を伴わない（既存テキストをルールベースで判断するのみ）。段階：**第1段階＝EDE実行位置をOutput Draft確定前へ移動し、Leader Final候補をEDEの入力へ追加するが判断結果はまだOutput Draftへ反映しない**（Phase B-2A）→第2段階＝EDEの判断結果をOutput Draftへ一時キャッシュとして同梱する（正本にはしない）→第3段階＝Approved Decision PackageをOutput Engineへ接続する（Phase B-4）。

3. **Phase B-2A「Executive Decision Control — Path A Causal Position」を正式採用する**。対象はPath A通常フロー（`atRunWorkflow()`）のみ。目的は正式な成果物制御ではなく、**因果位置と入力契約の確立**とする。実装候補：`data.leaderFinalResult`をLeader Final Candidateとして内部契約へ渡す／EDE実行を`buildOutputDraftFromLeaderFinal()`より前へ移動／`pathSource:'pathA'`・`sourceEngine:'runLeaderFinalResponse'`を明示／caseId・workflowId一致を維持／**既存Output Draft挙動・POST回数（1回）は完全無変更**／decisionStatusはまだOutput Draftへ保存しない／Approved Decision PackageはまだOutput Engineへ渡さない。

4. **Phase B-2B「Manual Leader Regeneration Alignment」を正式採用する**。手動Leader再生成（`atTriggerLeaderFinal()`）を調査した結果、以下の制約を実測発見した：①`runLeaderFinalResponse()`（完成成果物エンジン）ではなく軽量な`leaderSummary()`（「🎯今回の推奨方針／①②③」形式・completed/error/skipped分離なし）を使用している、②EDEが読む`_wlLastResults`は前回Auto Task実行時点のスナップショットのままであり、今回`atTriggerLeaderFinal()`が生成した`data.reply`とは紐づいていない（Leader Inboxの`artifacts`とOutput Draft本文が乖離し得る）、③既存`buildOutputDraftFromLeaderFinal(data.reply)`呼び出しには`noCompletedResults`判定が渡されていない（06HANDOVER記載済みの既知制約）。これらの整合化（`leaderSummary()`と`runLeaderFinalResponse()`の責務差の吸収、`data.reply`と社員成果物の対応付け、`_wlLastResults`陳腐化判定、不一致時の安全停止）をPhase B-2Bとして分離し、**Phase B-2A完了後に開始する（同時実装しない）**。

5. **Path B通常チャットはOutput Draft制御対象外として正式維持する**。理由：`handleLeaderDispatch()`〜`triggerStrategyConsolidate()`〜`triggerLeaderSummary()`の経路には`buildOutputDraftFromLeaderFinal()`・`createOutputDraft()`の呼び出しが存在せず（全文検索で確認）、Output Draftという概念自体が存在しない。軽量な方針サマリー表示が主責務であり、`interactionId`管理で`workflowId`を持たず、`chatHistory['leader']`の一部エントリ（Strategy統合・Leader Summary）はcaseIdを持たずtimestampのみで対応付ける既存制約もある（Decision084で既出）。Path Bでは引き続きLeader Inbox生成・Executive Decision Engine実行・`decisionStatus`／Decision Confidence／Strategic Alternatives／Executive Summary内部生成を許可するが、**Output Draft制御・Approved Decision Package接続は行わない**。将来Path Bへ完成成果物生成を追加する場合は独立設計工程とする。

6. **Leader Final Candidateを正式な内部契約として新設する（Phase B-2Aで設計・実装はB-2A本体）**。既存`candidateArtifacts`（AI社員個別成果物）とは別フィールドとし、混在させない。候補構造：`leaderFinalCandidate: { text, provider, integratedCount, sourceEngine: 'runLeaderFinalResponse'|'leaderSummary', generatedAt }`。`sourceEngine`により、Path A通常フローの完成成果物（`runLeaderFinalResponse`）と手動再生成・Path Bの軽量方針サマリー（`leaderSummary`）を**同一の完成成果物として扱わない**。

7. **Executive Decisionの判断対象を正式に候補D（AI社員成果物＋Leader Final候補の両方）とする**。責務分離：`candidateArtifacts`＝AI社員個別成果物、`leaderFinalCandidate`＝完成成果物候補または方針サマリー候補。両者を同一配列へ混在させない。Reviewer評価は既存`hasReviewerEvaluation`として利用し、Strategy統合結果を独立Artifactとして判断対象へ含めるかはPhase B-2Aでは過剰実装せず後工程で判断する。

8. **Approved判定の暫定条件（Gate未定義期間の第三の移行方式）を正式採用する**：completed成果なし→insufficient、completed成果あり→hold、**Quality Gate・Completion Gateが未定義の間はdecisionStatusをapprovedへ到達させない**。これは「未定義Gateを無条件で通過させる」設計（第1条Evidence原則に反する）でも「無条件でWorkflowを停止する」設計（既存Workflow保護原則に反する）でもない第三の道であり、Auto Task自体・既存Leader Final・既存Output Draftは従来どおり継続させたまま、EDEの判断軸（decisionStatus）だけを安全側に留める。

9. **Executive Reportと完成成果物の生成順序を正式に案2（完成成果物候補生成→Executive Decision→Executive Summary確定→既存Output Draft）とする**。追加AI実行は行わない。既存Leader Finalは完成成果物候補として維持し、Executive Reportは既存成果物を置き換えない。

10. **Decision ID方針**：現時点の`_executiveDecision`はApproved以外でDecision IDを持たない（`decisionId`は`approvedDecisionPackage`内にのみ生成される）。将来Decision Ledger（Phase C-1）接続のため、状態に関わらずDecisionを識別できる設計が将来必要になることを設計課題として記録する。**Phase B-2AではDecision Ledgerを実装せず、暫定ID付与の要否はPhase B-2A実装前調査で判断する**。

11. **`noCompletedResults`との状態軸分離を維持する**：既存`noCompletedResults`（Output Draft側の`status:'error'`・`packageQuality.score:0/insufficient`）は変更しない。EDE側の`decisionStatus:'insufficient'`とは別軸として維持し、混同しない（`decisionStatus`／`OUTPUT_STATUS`／`packageQuality.status`の3軸分離はDecision086の第13条を踏襲）。将来Output DraftへEDEキャッシュを同梱する段階（第2段階）で、矛盾検出ルールを別途定義する。

12. **正式ロードマップを改訂する**：Phase B-1（Executive Decision Engine Core・正式Complete・維持）→**Phase B-2A（Executive Decision Control — Path A Causal Position）**→**Phase B-2B（Manual Leader Regeneration Alignment）**→Phase B-3（Executive Leader Report表示・旧B-2相当）→Phase B-4（Approved Decision Package契約化・旧B-3相当）→Phase B-5（Constitution Validator・旧B-4相当）→Phase A-2（AI社員間再依頼）→Phase A-3（Artifact Handoff）→Phase A-4（Quality Loop）→Phase C-1（Decision Ledger永続化）→Phase C-2（Output Engine Knowledge Base化）→Phase C-3（Learning Center/Outcome Record永続化）→Phase D-safety→Phase D→Phase E→Phase F-1（Self Improvement Intelligence）→Phase F-2（Executive Memory）。詳細は`docs/04ROADMAP.md`を参照。**Phase B-1の正式Complete状態は変更・格下げしない**。`_executiveDecision`は引き続き`executionMode:'post_observation'`・`affectsLeaderFinal:false`・`affectsOutputDraft:false`・`affectsOutputEngine:false`を維持しており、**Executive Decision EngineがOutputを既に制御しているとは記述しない**。

**後方互換（Phase B-2A実装時に必須とする条件・今回は設計記録のみ）**：Leader Final生成は従来どおり／Output Draft内容・status・Package Qualityは従来どおり／`noCompletedResults`は従来どおり／Output Engine表示は従来どおり／Output Draft POST回数は1回のまま／AI実行回数を増やさない／API契約・server.js・openaiClient.jsは変更しない／EDE失敗時も既存Output Draft生成を継続する／caseId・workflowId不一致時は安全停止する／Path A通常フロー以外へ影響を与えない／Path B通常チャット・手動Leader再生成（Phase B-2Bまで）は現状維持する。

**却下した案**：AI社員実行後・Leader Final生成前にEDEを接続する案（Path Aでは技術的に不可能・サーバー側単一リクエスト構造のため）。`runLeaderFinalResponse()`内部/直前にDecision結果を入力する案（第9条・正本一意性に反し、Leader Finalが判断と成果物生成の二重責務を負う）。Phase B-2を単一工程のまま一括実装する案（Path A通常フロー・手動再生成・Path B通常チャットの構造差を無視し回帰リスクを高めるため不採用）。未定義Gateを無条件で通過させる設計・無条件でWorkflowを停止する設計（いずれもExecutive Constitution第1条・第14条または既存Workflow保護原則に反するため不採用）。

**検証（今回の実施範囲）**：既存コード（`atRunWorkflow()`・`server.js`の`/api/auto-task`・`openaiClient.js`の`runAutoTaskWorkflow()`／`runLeaderFinalResponse()`／`leaderSummary()`・`atTriggerLeaderFinal()`・`triggerStrategyConsolidate()`／`triggerLeaderSummary()`・`buildOutputDraftFromLeaderFinal()`の全呼び出し箇所）を読み取り専用で調査し、本Decisionの各方針の実装可否・整合性を確認した。**コード・DB・API・UIの変更は一切行っていない**。

**Git・反映**：docs commit（本更新）のみ。**index.html・openaiClient.js・server.js・lib・DB・schema.sql・API 無変更**。Tag作成なし。**push未実施**（ユーザー確認後に別途判断）。**Phase54 Complete維持・Phase55未着手**。

**次工程**：Phase B-2A Executive Decision Control — Path A Causal Position（未着手）。ただしユーザー承認なしに開始しない。

---

# Decision 086
## Executive Constitution v1.0.0 正式採用／Executive Decision Engine 正式設計採用（Phase A-1g・docs正式化のみ）（2026-08-02）

**背景**：Leader Integration Layer Phase A（Decision084・085）正式Complete後、次工程着手前にAI COMPANY全体の上位アーキテクチャを正式設計する調査を実施した。調査の結果、現在の`_leaderIntegration`（Phase A）は成果物の回収・比較・矛盾候補検出・採否候補判定までを担う構造化層であり、Leader Final生成・Output Draft確定・Output Engine入力のいずれにも接続されていない「事後観測層」であることを実測で確認した。これはPhase Aの未完成を意味せず、Phase Aの正式責務（回収・構造化・候補判定まで）は正式Completeのまま維持する。判断結果を因果連鎖へ接続する責務は、次工程Executive Decision Engine（Phase B-1以降）に分離して負わせる。

**決定（正式）**：

1. **Executive Constitutionを、AI COMPANY全体の最高位ルールとして正式採用する**（Version 1.0.0）。対象はExecutive Decision Engine・Leader・Leader Integration Layer・Output Engine・Instagram Workflow・Learning Center・Self Improvement・Executive Memory・Affiliate Intelligence Companyの各Intelligence・Future Intelligence・Automation Engine・将来追加されるすべてのEngine/Workflow/保存処理/外部実行処理/LLM判断処理。将来的にはプロンプト上の注意事項に留めず、コード・状態遷移・Validator・保存条件・外部実行条件で機械的に強制可能な会社規約として設計する。**今回はdocs正式化のみであり、Validator等の実装は行わない。**

2. **Executive Constitution v1.0.0 全14条を正式条文として採用する**（第1条Evidence原則／第2条Quality原則／第3条Completion原則／第4条Approved Decision Package原則／第5条ユーザー承認原則／第6条事実性原則／第7条Constitution優先原則／第8条案件分離原則／第9条正本一意性原則／第10条監査可能性原則／第11条過去記録不変原則／第12条学習の安全境界原則／第13条状態軸分離原則／第14条安全側既定値原則）。条文本文は本Decision末尾の別記を正本とする。第2条・第3条はQuality Gate／Completion Gateの具体的判定条件が未定義の間は宣言原則として扱い、既存Workflowを停止させない。第6条は既存`evidenceType`（根拠の出所）を変更・置換せず維持し、将来`valueNature`（値の性質：actual/manual_actual/predicted/estimated/derived/unknown）を別軸候補として追加する余地のみ残す。第13条は`decisionStatus`（新設）／`outputStatus`（既存`OUTPUT_STATUS`）／`qualityStatus`（既存`packageQuality.status`）を分離し、新設は既存2軸を変更・置換しない。

3. **Executive Constitution変更統制を正式採用する**。変更・追加・削除・緩和には①ユーザーによる明示的承認、②Executive ConstitutionのVersion更新、③Decision Ledgerまたは暫定正本への変更記録、の3条件をすべて必須とする。**Decision Ledger未実装の間は`04DECISIONS.md`を暫定正本とし、Decision番号を必ず採番する**。Decision Ledger実装後も、暫定期の`04DECISIONS.md`記録は削除・移行・上書きせず保持する。Self Improvement・Executive Memory・Executive Decision Engine・Leader・Output Engine・Learning Center・各Intelligence・Future Intelligence・Automation Engine・その他すべてのEngine/LLM/Workflowは、Constitutionを変更・削除・上書き・緩和してはならない（変更提案のみ可・自動実行不可）。Version変更はMAJOR（条文削除・権限制約緩和・承認条件緩和）／MINOR（条文追加・安全条件厳格化）／PATCH（意味を変えない文言明確化）に区分し、すべてユーザー明示承認を必須とする。緩和方向の変更は必ずMAJORとし、Rollback条件を必須記録項目とする。

4. **Executive Decision Engineを、AI COMPANYの上位アーキテクチャとして正式採用する**。ただし新たに同じ責務の独立Engineを重複実装するのではなく、**既存Leader Integration Layer Phase Aの`_leaderIntegration`およびLeader Inboxを正式入力構造として昇格させ、その上に会社判断層を追加する方式**とする。現在は「AI社員・Intelligence→Leader Final・Output Draft確定→Leader Integration Layerが事後観測」の順で、Leader Integration Layerの判定は因果連鎖に影響しない。将来は「AI社員・Intelligence→Leader Integration Layerによる回収・構造化→Executive Decision Engine→Executive Summary→Decision Status→Decision Confidence→Strategic Alternatives→Approved Decision Package→既存完成成果物と併存→Output Engine」の順へ拡張する。

5. **Executive Decision Engineの正式責務**：統合／要約／矛盾確認／Evidence充足確認／採用判断／却下判断／保留判断／Insufficient判断／優先順位決定／Strategic Alternatives管理／Decision Confidence算出／リスク整理／最終成果物承認／次工程決定／Approved Decision Package生成。**非責務**：社員回答の単純コピー／社員紹介／各専門分析の代行／Evidenceのない事実追加／社員分析の改ざん／推測の事実化／**Leader Final本文の生成**／Instagram成果物本文の生成／Output Engineの成果物生成／Learning Centerの実績保存／Self Improvementの学習／**`OUTPUT_STATUS`の所有・変更**／**`packageQuality.status`の所有・変更**。

6. **Executive ReportとOutput Engine完成成果物は置き換えず併存させる**。既存`LEADER_FINAL_PROMPT`（完成成果物生成プロンプト）は今回変更しない。将来のApproved Decision Packageは`executiveSummary`（結論／採用案／採用理由／却下・保留案／却下・保留理由／期待成果／主要リスク／次工程）と`approvedArtifacts`（既存Leader Final出力を含む完成成果物）を分離して保持し、Executive Reportで既存完成成果物を置き換えない。

7. **Decision Confidenceは既存`_intelCalculateConfidence()`の再利用とHard Gateの上乗せを正式方針とする**。新しい独自加重式は最初から発明しない。Hard Gate候補：completed成果0件はInsufficient固定（既存`noCompletedResults`判定と同一条件）／Constitution block・critical判定はApproved禁止／必須Evidence不足はHigh禁止／Completion Gate失敗はApproved禁止／重大矛盾未解決はHigh禁止／実績データなしはhistoricalSupport未評価（0点扱いにしない）。Intelligence Confidence（既存`confidenceOwner`による分離）とDecision Confidenceは役割分離を維持する。**今回は実装しない**。

8. **Strategic Alternativesの保持方針を正式採用する**：Primary1件／Secondary最大2件／Hold最大3件／Rejected履歴保持（通常表示は要約）。順位（rank/classification）と判断状態（decisionStatus）は別軸とし、第二候補でもdecisionStatus=approvedになり得る。将来の切替条件は自由文だけでなく機械判定可能な構造（type/observedField/operator/threshold）を候補とする。現段階では自動切替を行わず、ユーザー操作・ユーザー承認を維持する。

9. **Decision Ledgerを将来の正式Decision正本として採用する**。追記型・UPDATE禁止・DELETE禁止・判断時点の事実を保存・学習結果による本体上書き禁止・判断変更は新Decisionとして追加しsupersedes関係で接続・Constitution Version記録・Evidence参照記録・Case/Workflow/Interaction/Output記録を正式原則とする。**永続化前は`04DECISIONS.md`を暫定正本とし、永続化後の候補テーブル名は`executive_decisions`とする。`output_drafts`をDecision Ledger正本として使用しない**（`output_id`がPRIMARY KEYでupsert上書き方式のため、追記型・履歴保持の要件と構造的に非互換であることを実装調査で確認済み）。

10. **Executive Memoryを将来構想として正式採用するが、着手条件を明確化する**：Decision Ledger永続化済み・Learning Center永続化済み・Outcome Record存在・Instagram実運用データ存在・Self Improvement利用可能、のすべてを着手条件とし、**Phase F相当の後段に配置する**。過去MemoryだけでApprovedにしてはならず、現在Evidenceの代替として使用しない。

11. **Approved Decision Packageを、Executive Decision EngineからOutput Engineへ渡す将来の唯一の正式契約として採用する**。ただし導入時は後方互換を必須とし、**Package未実装・Package不在の期間は既存Workflowを維持する**（既存正常系を停止させない）。候補構造：caseId/workflowId/interactionId/decisionId/decisionStatus/executiveSummary/approvedArtifacts/excludedArtifacts/evidenceGate/qualityGate/completionGate/constitutionCheck/decisionConfidence/strategicAlternatives/risks/outputInstructions/createdAt。Output Engineは採否を再判断しない。

12. **保存方式は段階導入案Dを正式採用する**。Phase B（メモリのみ・Executive Decision構造/表示/因果接続の検証）→Phase B後半候補（Output Draftへの一時キャッシュ。使用する場合は`fields.executiveDecisionCache`等、正本と誤認しない名称に限定し、F5復元・現在判断表示・一時キャッシュ用途に限定。履歴正本にはしない）→Phase C-1（専用`executive_decisions`領域を正式正本化）。

13. **正式ロードマップを改訂する**：Phase A（Leader Integration Layer・正式Complete・維持）→**Phase A-1g（Executive Constitution v1.0.0正式化・docsのみ・本Decision）**→**Phase B-1（Executive Decision Engine Core：Leader Integration Layerを因果連鎖内へ昇格・decisionStatus・Decision Confidence・Strategic Alternatives・保存はメモリのみ・表示なし）**→**Phase B-2（Executive Leader Report表示：Executive Summary・Leader Summary・社員分析折りたたみ・既存完成成果物と併存）**→**Phase B-3（Approved Decision Package契約化：Output Engine接続・後方互換必須）**→**Phase B-4（Constitution Validator：warning/block/critical・状態降格・安全停止）**→Phase A-2（AI社員間再依頼・EDEのconflict/holdを起点に順序を後方へ変更）→Phase A-3（Artifact Handoff）→Phase A-4（Quality Loop）→**Phase C-1（Decision Ledger永続化：executive_decisions）**→Phase C-2（Output Engine Knowledge Base化）→**Phase C-3（Learning Center/Outcome Record永続化）**→Phase D-safety（自律実行安全ゲート）→Phase D（自律Workflow）→Phase E（毎日自律実行）→Phase F-1（Self Improvement Intelligence）→**Phase F-2（Executive Memory）**。詳細は`docs/04ROADMAP.md`を参照。**Phase A-2〜A-4は既存内容を維持したまま順序のみPhase B-1以降へ後退させる（削除・内容変更ではない）**。

**却下した案**：Executive Decision Engineを`_leaderIntegration`と別の独立Engineとして新規実装する案（第9条・正本一意性に反し、同一責務の実装が二重化するため不採用）。Executive ReportでLeader Final完成成果物を置き換える案（Version1最重要目的＝Instagram毎日運用の完成成果物生産を破壊するため不採用）。`output_drafts.fields`をDecision Ledgerの正本とする案（追記型・過去記録不変の要件と構造的に非互換のため不採用。一時キャッシュとしての限定利用のみ許容）。Decision Confidenceに新しい独自加重式を最初から設計する案（既存6層Intelligenceが確立した「既存関数再利用+Hard Gate上乗せ」パターンとの整合性を優先し不採用）。

**検証（今回の実施範囲）**：既存コード（`index.html`のLeader Integration Layer実装・`openaiClient.js`の`runLeaderFinalResponse()`・Output Engine状態定義・Evidence/Confidence共通基盤・`isAIGatewayExecutionAllowed()`）およびDB定義（`output_drafts`のPRIMARY KEY・upsert方式）を読み取り専用で調査し、本Decisionの各方針の実装可否・整合性を確認した。**コード・DB・API・UIの変更は一切行っていない**。

**Git・反映**：docs commit（本更新）のみ。**index.html・openaiClient.js・server.js・lib・DB・schema.sql・API 無変更**。Tag作成なし。**push未実施**（ユーザー確認後に別途判断）。**Phase54 Complete維持・Phase55未着手**。

**次工程**：Phase B-1 Executive Decision Engine Core（未着手）。ただしユーザー承認なしに開始しない。

---

## Executive Constitution v1.0.0（正式条文・全14条）

### 第1条 Evidence原則
必須Evidenceが不足している場合、Approvedにしてはならない。Evidence不足時はHoldまたはInsufficientとする。Confidenceが高い場合でも、必須Evidence不足を理由なくApprovedへ昇格させてはならない。

### 第2条 Quality原則
Quality Gate未通過の成果物を、正式完成・Output Ready・Publishing Readyとして扱ってはならない。未完成成果物は既存状態（draft/building/reviewing/error）・既存品質状態（needs_work/insufficient/almost_ready）として保存・表示できる。Quality Gateの具体的判定条件は後工程で定義し、未定義期間は本条を宣言原則として扱い既存Workflowを停止させない。

### 第3条 Completion原則
Completion Gate未通過の成果物は、途中成果または検証用Draftとして保存できる。ただし正式成果物・Approved Artifact・Publishing Ready・Completed Packageとして扱ってはならない。Completion Gateの具体的判定条件は後工程で定義し、未定義期間は本条を宣言原則として扱い既存Workflowを停止させない。

### 第4条 Approved Decision Package原則
Approved Decision Package以外を、将来の正式Output Engine入力として扱ってはならない（社員途中成果／社員回答原文／未承認Draft／Hold候補／Insufficient候補／Rejected候補／Strategic Alternativesの未採用候補／途中Outputを正式Outputへ直接渡さない）。ただしApproved Decision Package未実装期間は既存Workflowを維持し、導入時は後方互換を必須とし、Package不在時に既存正常系を停止させない。

### 第5条 ユーザー承認原則
ユーザー承認なく、外部へ影響する実行を行ってはならない（Instagram投稿／SNS公開／メール送信／決済／契約／課金／新規有料サービス／新規API契約／外部サービス操作／自動公開／データ削除／外部アカウント操作等）。内部分析・要約・比較・候補生成は外部実行と分離する。既存契約内の通常開発テストと、新たな契約・課金・公開操作も区別する。

### 第6条 事実性原則
すべてのEngineは、Evidenceのない事実追加／社員分析の意味を変える改ざん／推測値を実測値として扱うこと／推定値を事実として保存すること／不明値を勝手に補完すること／Missingを0として扱うこと／過去Memoryを現在の事実として扱うことを禁止する。既存`evidenceType`（public_fact/manual_observation/user_input/calculated/heuristic/learning_result/ai_interpretation）は根拠の出所を表す正式軸として維持し、変更・置換しない。将来、別軸として`valueNature`（actual/manual_actual/predicted/estimated/derived/unknown）を追加候補とするが、`evidenceType`と`valueNature`は異なる責務であり混同しない。

### 第7条 Constitution優先原則
Executive Constitutionは、LLMの自由判断／Executive Decision Engineの判断／Self Improvementの学習結果／Executive Memory／Decision Confidence／利益最大化／成功率向上／効率化／自動化要求より優先される。Constitutionと下位Engineの判断が競合した場合は、安全側へ停止または状態降格する。

### 第8条 案件分離原則
異なるCase／Workflow／Interaction／Output／Decision／Artifactのデータを混在させてはならない。必要な処理境界でID一致を確認し、Cross-case混入を検出した場合は安全停止対象とする。

### 第9条 正本一意性原則
同一責務について、複数の正式正本を持ってはならない（正式Decision正本＝Decision Ledger／承認済み出力契約＝Approved Decision Package／社員分析原文＝Source Artifact／実績正本＝Learning CenterまたはOutcome Record／表示用文章＝正本ではない、を将来候補とする）。Output DraftへDecisionを保存する場合も、Decision Ledger実装前の一時キャッシュに限定し、正式正本として扱わない。

### 第10条 監査可能性原則
すべての正式Decision・承認・状態変更・外部実行は、後から判断理由／Evidence参照／Source Artifact参照／Gate結果／Constitution Version／Case ID／Workflow ID／Interaction ID／Output ID／Timestamp／ユーザー承認／状態変更履歴を追跡可能にする。正式な機械監査はDecision Ledger永続化後に実現する。

### 第11条 過去記録不変原則
Decision Ledger・Outcome・実績記録を、将来の学習結果によって遡及的に改変してはならない。判断変更時は旧Decisionを上書きせず、新Decisionとして追記する（supersedesDecisionId／supersededByDecisionIdを将来候補とする）。Decision Ledger実装前は、既存`04DECISIONS.md`を設計Decisionの正本として維持する。

### 第12条 学習の安全境界原則
Self Improvementは予測値・重み・補正係数・ランキング・Confidence計算・成功/失敗パターン・改善提案・候補優先順位を改善できる。ただしExecutive Constitution／Evidence必須条件／Quality Gate必須条件／Completion Gate必須条件／Approved Decision Package必須条件／ユーザー承認条件／案件分離原則／監査義務／外部実行安全条件を変更・緩和してはならない。

### 第13条 状態軸分離原則
判断状態（decisionStatus：approved/rejected/hold/insufficient・新設候補）・工程状態（outputStatus：既存`OUTPUT_STATUS`を正本として維持）・品質状態（qualityStatus：既存`packageQuality.status`を正本として維持）を混在させない。新しい状態値を無制限に追加せず、`decisionStatus`を追加しても既存`OUTPUT_STATUS`および`packageQuality.status`を変更・置換しない。

### 第14条 安全側既定値原則
必須情報が欠落し判断不能な場合はApprovedを既定値にしない（Hold／Insufficient／Error／安全停止を既定値候補とする）。未知のaction・未知の状態・未定義入力についても、許可ではなく安全側を既定値とする。

---

# Decision 085
## AI COMPANY Leader Integration Layer（Phase A）後半 — messages案件別正本化・Leader Final状態サマリー分離・誤認防止を正式採用（2026-08-01）

**背景**：Phase A本体（Decision084）に続き、後半工程として3件の課題に対応した。①`/api/auto-task`・`/api/consult`のmessages保存にcaseIdが渡されておらず案件別正本化が未完成だった点、②Leader Finalが`completed`成果のみを統合しerror/skippedを無視していた点、③completed成果0件時にOutput Draftが`status:'ready'`・Package Quality高評価のまま保存され完成成果物と誤認されうる点。工程3の統合検証で③を実測により発見し、工程3-2で対応した。

**決定（正式）**：

1. **工程1・messages案件別正本化**：`server.js`の`/api/auto-task`（user/assistant保存）・`/api/consult`（user/assistant保存）計4箇所の`saveMessage()`呼び出しへ、既にリクエストボディで受領済みの`caseId`を追加（`caseId: caseId || null`・既存`/api/messages`と同一形式）。API・DBスキーマ変更なし。保存対象・保存回数・`saveMessage()`本体は無変更。
2. **工程2・Leader Final状態サマリー分離**：`openaiClient.js`の`runLeaderFinalResponse()`に、`completed`メインタスクの抽出条件（`status==='completed' && result && !isPostProcess`）は維持したまま、`error`/`skipped`（`!isPostProcess`）を状態サマリーとして別途抽出。全員成功時は既存プロンプトと完全一致（`question`構築ロジックの単体比較で実証）、一部失敗時は本文と分離した状態サマリーをLeaderへ渡す。error理由は1行・80文字以内へ安全に短文化（スタックトレース等の後続行は除外）。completed成果0件時は専用の安全側プロンプトへ分岐し、完成成果物を装わせない。
3. **工程3-2・Output Draft誤認防止**：`index.html`の`buildOutputDraftFromLeaderFinal(finalText, opts)`へ`opts.noCompletedResults`を追加（`runLeaderFinalResponse()`の既存返却フィールド`integratedCount===0`で判定・呼び出し元のみ変更、返却形式は無変更）。`true`の場合、`_lastOutputDraft.status`を既存の`OUTPUT_STATUS.ERROR`へ設定（新規enum追加なし）、`packageQuality`を機械的フィールドチェックではなく`score:0・status:'insufficient'・noCompletedResults:true`の明示オブジェクトへ固定。
4. **工程3-2・Leader Finalプロンプト強化**：一部成功時の指示文を「完成成果物出力後、必ず末尾に独立見出し『## 担当実行状況』を追加し、他セクションと混在させない」旨へ強化（`LEADER_FINAL_PROMPT`本体は無変更・questionの指示文のみ）。

**検証（実測）**：工程1・2・3（統合検証）・3-2（誤認防止修正後の再検証）を通じlocalhost実DBで確認。工程3統合検証で、一部成功時の状態サマリーがLeader Finalシステムプロンプトの固定フォーマットと競合し独立セクション化されない問題、およびcompleted成果0件時にOutput Draftが`status:'ready'`・Package Quality87点「良好」評価のまま保存される誤認問題を発見。工程3-2で対応し、正常系・一部成功・completed成果0件の3パターンで再実施：正常系はPackage Quality機械評価が従来どおり動作（71点needs_work）、一部成功はLeader Final末尾に独立見出し「## 担当実行状況」でBranding担当のスキップ理由が明記、completed成果0件はOutput Draftが`status:'error'`・`score:0・insufficient`としてDB保存されることを実測確認。全パターンでCross-case混入なし・新規`case_id=NULL`なし・二重保存なし・Console Error 0・dev-check 200/200/200。error/skipped再現はlocalhost限定で`AGENT_WORKFLOW_CONFIG`の`enabled`を一時的にfalseへ変更し検証直後に完全復元する方式（本番設定変更・永続コード差分なし）。

**既知の残課題（今回対応せず）**：Task管理⇔サーバー`skipped`状態同期ギャップ（`LIVE_TO_TASK_STATUS`に`skipped`変換先なし・既存挙動）、F5復元時の`isLeaderFinal`表示用メタフラグ欠落（messagesスキーマ非対応・既存挙動）、`messages`テーブルのRLS DELETEポリシー不在（既存制約・テストデータ累計remaining約53件・別工程で対応判断）、`enabled:false`スキップ時のtask_history.workflowId欠落（既存の実装漏れ）。

**Git・反映**：Code commit **5401b68**（`fix: scope auto task messages by case`・工程1）＋**6032893**（`feat: include task status in leader final`・工程2）＋**0d125e7**（`fix: prevent output misrepresentation on zero completed tasks`・工程3-2）・docs commit＝本更新・Annotated Tag **v1.01-leader-integration-phase-a-complete**・main push・Render反映。**Phase54 Complete維持・Phase55未着手**。

**PC本番確認（ユーザー実施・正式確認済み）**：ログイン正常・Auto Task正常・Leader Integration Layer正常・AI社員振り分け正常・Leader Final正常生成・Output Engine正常表示・Task同期正常・案件切替正常・Cross-case混入なし・Console Errorなし・Network異常なし。Task表示は全案件ビューで13件・案件を開くと該当案件のみ表示（既存の正常仕様として確認）。Output Engineの内容差分は今回のLeader Integration Layer改善に伴う正常な更新として確認・異常なし。iPhone実機確認は本確認の対象外。

**判定**：**AI COMPANY Leader Integration Layer（Phase A）正式Complete**。

**次工程**：未定（Phase A-2 AI社員間再依頼／Phase A-3 成果物受け渡し／Phase A-4 Quality Loopは設計のみ完了・実装未着手。またはmessages RLS対応・Task skipped同期ギャップ対応等の残課題）。

---

# Decision 084
## AI COMPANY Leader Integration Layer（Phase A）正式仕様 — Leader成果物統合管理層として採用（2026-07-31）

**背景**：現在のLeaderは、Path A（Auto Task Workflow）・Path B（Leader手動チャット）いずれの経路でも各AI社員の回答を要約するだけで、成果物を横断的に回収・比較・矛盾候補検出・採否候補判定する統合機能を持たなかった。Phase Aとして、両経路の実行結果を共通形式へ変換し、Leader Inboxとして構造化するLeader Integration Layerを追加した。実装過程で、既存のOutput Draft復元保護ロジック（Phase54-2d）と手動Leader Final再生成機能（`atTriggerLeaderFinal()`）の組み合わせにより、案件切替後も古い案件のOutput Draftが別案件へ混入し得る既存不具合を発見したため、同一リリースサイクル内でHotfixも実施した。

**決定（正式）**：

1. **Path A／Path Bの既存処理は無変更**とし、各Pathの末尾（Leader Final受領直後・手動Leader Final再生成直後）から共通の`_liCollectIntegration()`を1回だけ呼び出す方式を採用（Path A Adapter・Path B Adapterによる差異吸収）。
2. **保存はクライアント一時メモリ（`_leaderIntegration`）のみ**とする。Output Draft・chatHistory・新DB・新APIへの保存は行わない（F5で消失。永続化はPhase B以降で再判断）。
3. **Leader Integration専用のcaseId取得関数`_liCurrentCaseId()`を新設**（Decision 072の`_aicCurrentCaseId()`方式を踏襲・`_lastOutputDraft.caseId`へのフォールバックなし）。取得不能時はLeader Integrationを生成せず安全停止する。
4. **Path Bの識別子はworkflowIdとinteractionIdを分離**する。`interactionId`（`'li-'+genId()`）はLeader手動依頼1回につき1回生成し、`_liPathBSession`（クライアントのみ・chatHistory非接触）でdispatchTs以降・対象memberId限定の対応を管理し、過去回答・別依頼の混入を防止する。
5. **比較・矛盾候補検出はルールベースのみ**（`_liCompareArtifacts`/`_liDetectConflictCandidates`）とし、Phase Aでは追加AI実行を行わない。矛盾は必ず`label:'candidate'`として扱い確定判定しない。
6. **採否候補判定（`_liDecideAdoptionCandidates`）は情報不足時に必ずhold（保留）を既定値**とする。Reviewer未実行を合格扱いにしない・Confidenceなしを高評価扱いにしない。
7. **finalSummary（文章による最終結論生成）はPhase Aでは行わない**（`null`固定）。対象は回収・比較・矛盾候補・採否候補の構造化までとし、文章生成・成果物添付・Knowledge Summary・Progress UIはPhase B以降とする。
8. **案件混入Hotfix**：`atTriggerLeaderFinal()`（手動Leader Final再生成）の冒頭に、現在案件（`_liCurrentCaseId()`）とAuto Task結果生成時案件（`_liLastPathAResultsCaseId`）の厳格一致確認を追加。不一致時はAI実行・chatHistory追加・Output Draft保存・次Task生成のいずれも行わず、ユーザーへ「現在案件でAuto Taskを再実行してください」と通知して安全停止する。案件切替時のDOM一括クリア（案A）は採用せず、局所ガード（案B）のみを採用した。

**採用理由**：既存6層Intelligence（Product〜Market）で実証済みの「追加のみ・既存経路への薄い接続・安全側デフォルト」パターンを踏襲することで、新しい判断基盤を増やさずに回帰リスクを最小化した。Hotfixは`switchCase()`本体（Approval Sync・Task Sync・Affiliate復元等、複数の既存スケジュール処理を抱える）への変更を避け、`atTriggerLeaderFinal()`単一箇所への局所ガードとすることで非破壊性を最優先した。

**却下した案**：案件切替時のDOM・状態一括クリア（案A・`switchCase()`内の複数既存機構との相互作用リスクが高いため）。Leader Integration専用DB・専用API（新規保存経路を増やさない既存方針を優先）。Phase Aでの自動差し戻し・Quality Loop・Knowledge Base永続化（責務を構造化のみに限定し、後続Phaseへ分離）。

**検証（実測）**：Path A（Auto Task）／Path B（Leader手動チャット）とも実機検証で`pathSource`／`workflowId`／`interactionId`／`caseId`が正しく分離されることを確認。同一案件での手動Leader Final再生成は正常動作（Leader Integration更新・追加API呼び出しなし）。別案件切替後の混入テストでは、Hotfix適用前は実際にOutput Draft行のcase_idが別案件へ移動する事故を実機で確認し、診断データを既存POST経路で復旧（検証専用案件は削除）。Hotfix適用後は同一条件で`/api/leader-summary`・`/api/output-drafts`とも呼び出しなし・chatHistory追加なし・Draft移動なしを実測で確認。JavaScript構文OK・`npm run dev-check` 200/200/200・`git diff --check`問題なし。

**Git・反映**：Code commit **ad5eaf7**（`feat: add leader integration layer`・+336/-6）＋**af43263**（`fix: prevent cross-case leader final draft overwrite`・+11/-0）・docs commit＝本更新・Annotated Tag **v1.01-leader-integration-phase-a**・**main push・Render反映・PC本番確認・iPhone実機確認はこれから実施**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。

**次工程**：未定（Phase A-2 AI社員間再依頼・Phase A-3 成果物受け渡し・Phase A-4 Quality Loopは設計のみ完了・実装は未着手。着手にはユーザー承認が必要）。

---

# Decision 083
## Market Opportunity Intelligence（①層）正式仕様 — 案件内市場集約による説明層として採用（工程8-1/8-2/8-3A/8-3B/8-3B補正/8-3C）（2026-07-30）

**背景**：Competition Intelligence（工程7・Decision 082）に続き、Version2 Core 7層構想の①Market Opportunity Intelligenceを実装した。Marketは現在案件内に登録された同一市場の候補商材を集約し「その市場にどんな候補が揃っているか」を説明する層であり、外部の実検索数・実トレンド・市場規模・成長率は一切扱わない（AI会社内の登録候補情報の集計のみ）。

**決定（正式）**：

1. **責務**：現在案件に登録された同一市場（`market`正規化キー一致）の候補商材を集約し、登録候補商材数・想定利益集計・Integrated Score傾向・IG適性傾向・他社競合数傾向・lifespanMonths傾向・seasonality原文・Evidence・Confidence・status・Insufficient理由を説明する。実検索数・実トレンド・市場規模・市場成長率・市場シェア・外部需要・リアルタイムSNS需要は**判断対象外**とし、これらを示唆する表現・フィールド名（searchVolume/realDemand/marketGrowth等）は採用しない。
2. **集約単位は案C（案件内集約）**を正式採用する。`GET/POST /api/affiliate-evaluations`が`caseId`必須（server.js・lib/affiliateEvalDb.js）である制約上、案件横断集約（案B）はAPI変更が必須となり、Decision 071/072の案件境界原則にも抵触するため不採用。案A（1評価=1market）はProduct Intelligenceとの責務重複が大きく不採用。
3. **集約キーは既存`_aicNormalizeKeyPart`を再利用**（ASP Intelligence工程5-1と同一正規化・新規正規化関数は作らない）。意味的表記揺れ（美容/ビューティー）は自動統合しない仕様とする。
4. **新規入力項目は追加しない**（案1採用）。demandLevel/trendDirection等の主観入力はConfidenceを恣意的に嵩上げし「外部データ未使用なのに需要が高いと誤認される」リスクがあるため不採用。既存14項目（Product Intelligence入力）のみを使用する。
5. **Evidenceは新規生成しない**。`_intelSyncMarketGroupProductEvidence`（共通ヘルパー）が市場内対象商材（現在案件・Active・同一marketKey・productIdentifier重複排除）の既存Product Evidenceへ`usedBy:'market'`を冪等追記して共有参照する。本ヘルパーは`_aicBuildMarketForRow`（表示プレビュー）と`adoptAffiliateForContentPlanning`（実保存）の両方から共通利用し、重複実装を排除している。
6. **Market Confidenceは既存`_intelCalculateConfidence`を再利用**（新式・新しきい値なし）。母集団は市場内対象商材群の共有Evidence全体（工程8-3B補正で確定・後述）。独立Evidence3件未満はInsufficient。
7. **★強制Insufficientゲート**：`INTEL_MARKET_MIN_PRODUCT_COUNT = 2`。市場内Active商材数が2件未満の場合、Confidence値に関わらずstatusを`insufficient`とする（ASP Intelligence工程5-1の`INTEL_ASP_MIN_COMPARE_COUNT`と同型）。**1商材市場でも構造・derived集計値は保持**し、`insufficientReasons`に`market_min_product`を明示する（情報を空にせず「情報不足であること」自体をスナップショットとして保存する）。
8. **意味の固定**：Market ConfidenceはEvidenceの充足度を示すのみであり、市場需要・成長性・売れやすさを示すものではない。
9. **保存**：`intelligenceContext.market`（既存受け皿・`INTEL_MODULE_KEYS`に既存のためモジュールキー追加不要）へ、採用時に`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`＋`competition`＋`market`の**七書き**を行い、既存`pushOutputDraftToServer`を**1回**のみ呼ぶ（採用1回=POST1回・Market専用POSTなし）。保存済み判定は`productIdentifier`ではなく**marketKey＋caseId一致**で行う（Marketは単一商材ではなく市場単位のため）。
10. **表示**：ランキングカード・AIC最小パネルともCompetition直下に追加。Safety表記（「AI会社に登録された候補情報の集計であり、外部の実検索数・実トレンド・市場規模を取得したものではない」）を画面上に必ず表示する（ツールチップに隠さない）。登録候補商材数（AI会社内の自社候補件数）とCompetitionの競合数（他社競合数）は文言上明確に区別する。
11. **Copy Full Report**：`_aicBuildMarketReportText`をCompetitionの直後・Rankingの手前へ追記（順序：Leader→ASP→Content→Competition→**Market**→Ranking）。
12. **順位・integratedScore・estimatedProfit・Product/Revenue/ASP/Content/Competition Intelligence・Workflow Wiring・server.js・lib・DB・schema.sql・APIは無変更**（説明レイヤーの原則を維持）。

**工程8-3B補正（Evidence母集団整合性）**：初回実装ではderived集計（productCount等）は市場内複数商材を対象とする一方、Evidence/Confidence母集団は採用商材1件分のみに留まる不整合が生じていた（保存フローが採用商品のみEvidence同期していたため）。共通ヘルパー`_intelSyncMarketGroupProductEvidence`を新設し、市場内対象商材（採用商品以外を含む）のProduct Evidenceを同一ctxへ事前同期するよう修正。既存5層（Product/Revenue/ASP/Content/Competition）のConfidenceは影響を受けないことをコード読解・テストで確認済み。

**検証（実測・純関数）**：工程8-1/8-2 26/26 PASS・工程8-3A UI 24/24 PASS・工程8-3B保存 35/35 PASS・工程8-3B補正 30/30 PASS（合計115アサーション全PASS）。JavaScript構文OK・dev-check 200/200/200・Console error 0。

**検証（実測・実Supabase／専用caseId `case-ms79vojuf7g1`・商材A `TEST_MARKET_PRODUCT_A_20260730`・商材B `TEST_MARKET_PRODUCT_B_20260730`・同一market）**：
- 採用後`fields.intelligenceContext`に`product`/`revenue`/`asp`/`content`/`competition`/`market`＋`affiliateContext`の**七書き**が揃うことを確認。全レイヤーの`confidence.calculatedAt`が同一ミリ秒台（採用1回の単一トランザクション内であることを実証）。
- `market`：`productCount=2`・`productIdentifiers`に商材A/B双方（2件）・`evidenceIds`22件・`status:"watch"`・`insufficientReasons:[]`・`confidence`Medium(64点・independentEvidenceCount 22)。`derived`集計値（estimatedProfitTotal 23,840円／Average 11,920円／integratedScoreAverage 52／igFitAverage 65／competitorsAverage 10／lifespanMonthsAverage 9）はいずれも商材A・Bの実値から手計算した期待値と完全一致。
- Evidence総数28件（商材A・B各14件）のうち`usedBy:'market'`タグ付きは22件・両商材のproductIdentifierにまたがることを確認（**採用商材1件分のみという工程8-3B時点の不整合が解消**）。Evidence ID重複なし・usedBy市場タグ重複なし。
- **副次確認**：市場欄へ意図せず大量文字列（フォーム他項目のコピー&ペースト起因）が混入した場合、正規化キーが一致せず「別市場」として扱われる（意味的表記揺れを自動統合しない設計どおり）ことを実運用で確認。同一productIdentifierで再登録すると旧評価が自動的に非アクティブ化され新評価のみActiveとなることも確認（既存の再評価冪等機構）。
- F5復元でproductCount・想定利益平均・Confidence・Independent件数が完全一致（再計算なし）。案件切替で他案件への混入なしを確認。Copy Full ReportにMarket Opportunity Intelligenceセクション（Competition直後・Ranking手前）が正しい内容で出力され、`undefined`/`NaN`/HTMLタグの混入なし。
- Product/Revenue/ASP/Content/Competition Intelligence・ranking・integratedScore・estimatedProfitいずれも回帰なし。
- **テストデータ限定削除**：ユーザーがSupabase SQL Editorで`case_id='case-ms79vojuf7g1'`限定のDELETEを実施（`affiliate_evaluations`・`output_drafts`）、`cases`は論理削除API（`DELETE /api/cases/case-ms79vojuf7g1`）で削除。削除後、**3テーブルとも`remaining=0`を実測**。既存の実案件（`case-mry3oyqamqlp`・evaluationId 19含む）は無影響。

**採用理由**：Revenue（工程4）・ASP（工程5）・Content（工程6）・Competition（工程7）で実証済みの「Evidence共有参照＋既存push1回への相乗り＋保存済み正本優先」パターンを踏襲しつつ、Marketが唯一「複数商材の集約」という新しい集計軸を持つため、案件境界を厳格に維持する案Cと、Evidence母集団を集計対象と一致させる共通ヘルパーの新設によって、回帰リスクを最小化しつつ責務を正しく表現した。

**却下した案**：案件横断の市場集約（案B・API変更必須のため不採用）。新規入力項目の追加（案2・誤認リスクのため不採用）。市場需要・トレンド等の外部データ接続（本工程では対象外・将来Self Improvement/外部API接続時に別途検討）。

**Git/反映**：Code commit **2de9317**（`feat: add market opportunity foundation and confidence`）・**4ef70ca**（`feat: add market opportunity intelligence UI`）・**e61e7d5**（`feat: persist market opportunity intelligence`）・**3b1e5b7**（`fix: align market confidence with grouped product evidence`）・docs commit＝本更新・Annotated Tag **v1.01-affiliate-market-opportunity-persistence**・**main push・Render反映・PC本番確認・iPhone実機確認はこれから実施**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。

**次工程**：未定（Market Opportunity Intelligence完成によりVersion2 Core 7層のうち6層完成＝残るは⑦Self Improvement Intelligenceのみ。ただしInstagram実運用前のため実績データ供給条件を再確認してから着手判断。またはVersion1.1 Realtime Sync残課題等）。

---

# Decision 082
## Competition Intelligence（④層）正式仕様 — Product Intelligence 上の競合環境説明層として採用（工程7-1/7-2/7-3A/7-3B/7-3C）（2026-07-29）

**背景**：Content Intelligence（工程6・Decision 081）に続き、Version2 Core 7層構想（Product→Revenue→ASP→Content→**Competition**→Market→Self Improvement）の次層としてCompetition Intelligenceを実装した。Competition は競合環境（競合数・案件寿命・IG適性）をProduct Intelligenceから共有参照する読み取り専用の説明層であり、Revenue（工程4）・ASP（工程5）・Content（工程6）と同じ「使い捨てプレビュー＋保存済み正本表示＋既存push相乗り」パターンを踏襲する。

**決定（正式）**：

1. **`intelligenceContext.competition`（新規モジュールキー）へ保存**する。`INTEL_MODULE_KEYS`へ`'competition'`を後方互換で追加（工程4-1で`'revenue'`を追加したのと同一・既存Draftは空`{}`で初期化され非破壊）。母集団は`INTEL_COMPETITION_INPUT_FIELDS = ['competitors','lifespanMonths','igFit']`の3項目のみ。
2. **Confidence母集団は3項目（competitors/lifespanMonths/igFit）**とする。`competitors`単独では`INTEL_CONFIDENCE_MIN_EVIDENCE=3`により常時Insufficientとなるため、既にEvidence配線済みで競合環境を構成する3項目を母集団とした（Contentの「ちょうど3項目」設計と同じ挙動）。新しい入力項目は追加しない。
3. **Evidenceは新規生成しない**。`_intelSyncCompetitionFromProduct`が既存Product Evidence（3項目分）にのみ`usedBy:'competition'`を冪等追記して共有参照する（Revenue工程4・Content工程6と同一方針）。Product本体（inputs/derived/fieldEvidence/confidence）は非破壊。
4. **Competition Confidenceは既存`_intelCalculateConfidence`を再利用**（`_intelCalculateContentConfidence`と同型の`_intelCalculateCompetitionConfidence`）。新式・新しきい値は追加しない。独立Evidence3件未満はInsufficient。`confidenceOwner:'competition'`でProduct/Revenue/ASP/Content Confidenceと分離。
5. **★意味の固定**：Competition Confidenceは「競合環境を判断するための根拠がどれだけ揃っているか」を示すものであり、**競合が弱い／参入余地が大きい／売れやすい／推奨商材である、を示すものではない**。`good/watch/insufficient`はConfidence状態であり競争環境の有利・不利の評価ではない。この旨を表示・Copy Full Reportに明示する。
6. **競合数（competitors）は入力された生値のまま保持・表示**する。激戦/普通/参入余地あり等のヒューリスティック判定・Competition Score・Entry Opportunity Score・独自ランクは**作らない**（新スコア・新閾値なし）。
7. **表示**：`_aicBuildCompetitionForRow`（使い捨てプレビュー）・`_aicCurrentSavedCompetition`/`_aicSavedCompetitionForRow`（保存済み`intelligenceContext.competition`を`productIdentifier`＋caseId一致で正本表示・再計算しない＝単一商材紐づきのためRevenue/Content方式を採用）・`_aicCompetitionParts`・`_aicBuildCompetitionCardLine`・`_aicBuildCompetitionHtml`。表示位置はランキングカード・AICパネルともContent直下。
8. **採用時に`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`＋`competition`を同一Output Draftへ六書き**し、既存`pushOutputDraftToServer`を**1回**のみ呼ぶ（**採用1回=POST1回を維持・Competition専用POSTは追加しない**）。挿入位置は`nextIntelligenceContext.content`構築の直後。
9. **Copy Full Reportへ`_aicBuildCompetitionReportText`を追記**（競合数・案件寿命・IG適性・Confidence・Evidence件数・Independent件数・status）。順序はProduct→Revenue→ASP→Content→**Competition**→Ranking。
10. **順位・integratedScore・estimatedProfit・Product/Revenue/ASP/Content Intelligence・Workflow Wiring・server.js・lib・DB・schema.sql・APIは無変更**（説明レイヤーの原則を維持）。

**検証（実測・純関数）**：Competition基盤の純関数テスト23/23 PASS（3項目有効=independent3・Medium／1項目・2項目=Insufficient／0項目=安全にInsufficient・例外なし／再実行でEvidence非増殖・usedBy非重複）。JavaScript構文OK（インラインJS 2ブロック）・dev-check 200/200/200・Console error 0・白画面/無限ロード/横スクロールなし。

**検証（実測・実Supabase／専用caseId `case-ms5zz5g65x1p`・productName `TEST_COMPETITION_PROD_20260729`・evaluationId 20）**：
- 採用後`fields.intelligenceContext`に`product`/`revenue`/`asp`/`content`/`competition`＋`affiliateContext`の**六書き**が揃うことを確認。
- Output Draft POST回数＝2回（① scaffold Draft作成1回・② 商材採用の六書き1回）。**Competition専用POSTは0回**。
- `competition`＝`inputs`{igFit:75, competitors:8, lifespanMonths:10}／`confidence`{Medium・64点・independentEvidenceCount:3・knownFactors:3/3}／`derived.status`:"watch"／`confidenceOwner`:"competition"。
- Evidence総数14件（保存前後で不変）。`usedBy`内訳：product=14・revenue=9・asp=4・content=3・**competition=3**（igFit/competitors/lifespanMonths）。competition用3件はいずれも評価登録時刻（11:29:46）のままで採用時刻（11:48:31）の新規生成なし＝**共有参照を実証**。
- F5再読み込み後、競合数8件・案件寿命10ヶ月・IG適性75・Confidence Medium(64点)・Independent3件・status watchがF5前と完全一致（保存済み💾表示・再計算なし）。
- caseId分離：別案件へ切替時Competition混入なし・テスト案件へ戻ると正しく復元。
- Copy Full ReportにProduct→Revenue→ASP→Content→**Competition**→Rankingの順序でCompetition（競合数/案件寿命/IG適性/Confidence/Evidence3件/Independent3件/status）が含まれ、`undefined`/`[object Object]`/`null`なしを確認。
- Product/Revenue/ASP/Content Intelligence／ranking／integratedScore(57)／estimatedProfit(16000)いずれも回帰なし。
- **テストデータ限定削除**：ユーザーがSupabase SQL Editorで`case_id='case-ms5zz5g65x1p'`限定のDELETEを実施（`affiliate_evaluations`・`output_drafts`）、`cases`は論理削除API（`DELETE /api/cases/case-ms5zz5g65x1p`）で削除。削除後、**3テーブルとも`remaining=0`を実測**（affiliate_evaluations空・output_drafts null・cases deletedIds追加/total 2→1）。既存の実案件（`case-mry3oyqamqlp`）は無影響。

**採用理由**：Revenue（工程4）・ASP（工程5）・Content（工程6）で実証済みの「Evidence共有参照＋既存push1回への相乗り＋保存済み正本優先」パターンをそのまま踏襲することで、新しい永続化経路・新しいDB列・新しいAPIを追加せずに回帰リスクを最小化できる。`competitors`が既にProduct Evidenceとして配線済みかつ他層未使用だったため、新規Evidence生成なしで4回目のパターン適用が成立した。

**却下した案**：Competition専用の新規保存API／DB列を追加する案（既存`fields`JSONB丸ごと保存で十分）。参入余地スコア・激戦/普通判定等の新ヒューリスティックを本工程で追加する案（新スコア・新閾値の導入は説明レイヤーの原則に反するため別工程へ切り出し）。ASPのgroupKey方式（市場横断比較）を採用する案（`competitors`は1商材あたり単一値のためRevenue/Content型の単一商材紐づきが低リスク）。

**Git/反映**：Code commit **675b3d0**（`feat: add competition intelligence foundation`・index.htmlのみ +107/-1）・**3feec7b**（`feat: add competition intelligence ui`・+117/-0）・**d941cfd**（`feat: wire competition intelligence display and persistence`・+28/-0）・docs commit＝本更新・Annotated Tag **v1.01-affiliate-competition-intelligence-persistence**。**main push・Render反映・PC本番確認・iPhone実機確認はこれから実施**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。

**次工程**：未定（Competition Intelligence完成により、残るIntelligence層＝Market Opportunity/Self Improvement、またはVersion1.1 Realtime Sync残課題等）。

---

# Decision 081
## Content Intelligence（⑥層）正式仕様 — Product Intelligence 上の投稿適性説明層として採用（工程6-1/6-2/6-3A/6-3B/6-3C）（2026-07-29）

**背景**：ASP Intelligence（工程5・Decision 079/080）に続き、Roadmapの7層構想（Product→Revenue→ASP→**Content**→Competition→Market→Self Improvement）の次層としてContent Intelligenceを実装した。Content はInstagram投稿適性（保存率予測・クリック率予測・IG適性）をProduct Intelligenceから複製・共有参照する読み取り専用の説明層であり、Revenue（工程4）・ASP（工程5）と同じ「使い捨てプレビュー＋保存済み正本表示」パターンを踏襲する。

**決定（正式）**：

1. **`intelligenceContext.content`（既存受け皿）へ保存**する。母集団はInstagram投稿適性3項目（`saveRatePred`/`clickRatePred`/`igFit`）のみとし、Content Planningのスコア（priorityScore等）は含めない（責務分離）。`INTEL_CONTENT_INPUT_FIELDS`定数で定義。
2. **Evidenceは新規生成しない**。`_intelSyncContentFromProduct`が既存Product Evidence（3項目分）にのみ`usedBy:'content'`を冪等追記して共有参照する（Revenue工程4・ASP工程5-1と同一方針）。Product本体（inputs/derived/fieldEvidence/confidence）は非破壊。
3. **Content Confidenceは既存`_intelCalculateConfidence`を再利用**（`_intelCalculateContentConfidence`）。新式・新しきい値は追加しない。独立Evidence3件未満はInsufficient。`confidenceOwner:'content'`でProduct/Revenue/ASP Confidenceと分離。
4. **表示**：`_aicBuildContentForRow`（使い捨てプレビュー）・`_aicCurrentSavedContent`/`_aicSavedContentForRow`（保存済み`intelligenceContext.content`を`productIdentifier`＋caseId一致で正本表示・再計算しない＝単一商材紐づきのためASPのgroupKey方式は使わずRevenue方式を採用）・`_aicContentParts`・`_aicBuildContentCardLine`（ランキングカード1行）・`_aicBuildContentHtml`（AIC最小パネル）を追加。表示位置はランキングカード・AIC最小パネルともASP直下。**保存率予測・クリック率予測は予測値であり実測ではないことを表示上も明示**する。
5. **採用時に`affiliateContext`＋`product`＋`revenue`＋`asp`＋`content`を同一Output Draftへ五書き**し、既存`pushOutputDraftToServer`を**1回**のみ呼ぶ（**採用1回=POST1回を維持・Content専用POST/PATCH/DELETEは追加しない**）。挿入位置は`nextIntelligenceContext.asp`構築の直後。
6. **Copy Full Reportへ`_aicBuildContentReportText`を追記**（保存率予測・クリック率予測・IG適性・Confidence・Independent件数）。新規Copyボタンは追加しない。
7. **順位・integratedScore・estimatedProfit・Product/Revenue/ASP Intelligence・Workflow Wiring・server.js・lib・DB・schema.sql・APIは無変更**（説明レイヤーの原則を維持）。

**検証（実測）**：回帰テスト118/118 PASS・JavaScript構文OK（`node --check`）・dev-check 200/200/200・localhost確認・Console error 0・白画面なし・無限ロードなし・横スクロールなし。実Supabase検証（専用caseId `case-ms3t75suuo2i`）：採用後の`fields.intelligenceContext`に`product`/`revenue`/`asp`/`content`が揃い、Evidence総数14件（保存前後で不変・内訳 product14/revenue9/asp4/content3）・Content Confidence Medium（64点・independent3件・knownFactors3/3）を確認。**テストデータ限定削除 remaining=0**（`affiliate_evaluations`・`output_drafts` とも・ユーザーがSupabase SQL Editorで`case_id='case-ms3t75suuo2i'`限定DELETEを実施し、API読み戻しで両テーブルとも0件を確認）。

**採用理由**：Revenue（工程4）・ASP（工程5）で実証済みの「Evidence共有参照＋既存push1回への相乗り＋保存済み正本優先」パターンをそのまま踏襲することで、新しい永続化経路・新しいDB列・新しいAPIを追加せずに回帰リスクを最小化できる。

**却下した案**：Content専用の新規保存API／DB列を追加する案（既存`fields`JSONB丸ごと保存で十分）。実測値（actualSaveRate等）を本工程で追加する案（工程6では予測値のみを扱い、実測接続は将来のLearning接続で別途対応）。

**Git/反映**：Code commit **2b3fdd0**（`feat: add content intelligence foundation`・index.htmlのみ +113/-0）・Code commit **f2b0b5e**（`feat: add content intelligence ui`・index.htmlのみ +126/-0）・docs commit＝本更新・Annotated Tag **v1.01-affiliate-content-intelligence-persistence**（予定）。**main push・Render反映・PC本番確認・iPhone実機確認はこれから実施**（ユーザー承認後）。**Phase54 Complete維持・Phase55未着手**。

**次工程**：未定（Content Intelligence完成により、残るIntelligence層＝Competition/Market/Self Improvement、またはVersion1.1 Realtime Sync残課題等）。

---

# Decision 080
## ASP Intelligence 表示UI・永続化を正式採用（工程5-3A/5-3B/5-3C）（2026-07-28）

**背景**：工程5-1・5-2（Decision 079）で`intelligenceContext.asp`のデータ構造・Evidence配線・Confidence計算を完成させたが、表示UI・Output Draft永続化・F5復元・実Supabase検証は工程5-3へ分離し未実装だった。工程5-3ではProduct Intelligence（工程3）・Revenue Intelligence（工程4）が確立した「使い捨てプレビュー＋保存済み正本表示」の既存パターンをASPへそのまま踏襲し、表示配線（5-3A）・永続化配線（5-3B）・実Supabase保存/F5復元/端末caseId分離の実測検証（5-3C）を行った。

**決定（正式）**：

1. **表示は既存Revenueパターンを完全踏襲**する。`_aicBuildAspForRow`（使い捨てctxプレビュー・`_affiliateCases`が配列でない/空の場合は例外なくnull＝同期前に誤った推奨を確定しない）・`_aicCurrentSavedAsp`／`_aicSavedAspForRow`（保存済み`intelligenceContext.asp`をcaseId一致・同一グループキー一致で正本取得・再計算しない）・`_aicAspParts`（推奨/Confidence/比較数/Independent/Insufficient理由の整形）・`_aicBuildAspCardLine`（ランキングカード1行）・`_aicBuildAspHtml`（AIC最小パネル）を追加。表示位置は**ランキングカード・AIC最小パネルともRevenue直下**。
2. **採用時に`affiliateContext`＋`product`＋`revenue`＋`asp`を同一Output Draftへ四書き**し、既存`pushOutputDraftToServer`を**1回**のみ呼ぶ（**採用1回=POST1回を維持・ASP専用POST/PATCH/DELETEは追加しない**）。挿入位置は`nextIntelligenceContext.revenue`構築の直後。
3. **Evidenceは新規生成しない**。工程5-1の設計どおり、採用商品(product)が参照する既存Evidenceにのみ`usedBy:'asp'`を冪等追記する（`_intelBuildAspFromProduct`は工程5-1・5-2から無変更のまま再利用）。
4. **Copy Full Reportへ`_aicBuildAspReportText`を追記**（推奨ASP・Confidenceレベル/スコア・Independent件数・保存済み/プレビューの区別）。**新規Copyボタンは追加しない**。
5. **保存済みASPが正本**：F5再読み込み・ログアウト後の再ログイン・PC/iPhone間復元・Affiliate Evaluation更新後・Evidence増減後・ranking再計算後のいずれでも**自動再計算しない**（Product/Revenue Intelligenceと統一）。最新化したい場合は商材を再採用してOutput Draftを再保存する運用とする。
6. **`_affiliateCases`未同期への防御**：配列でない・空配列の場合は例外を出さずプレビューはnullを返す（データなし表示へフォールバック）。ただし**保存済みASPが存在する場合はこのガードの影響を受けず正本表示を継続**する（実測テスト22で確認）。

**検証（実測・純関数）**：工程5-3A/5-3B新規27ケース（表示9・保存復元7・空ガード3・Copy3・非破壊2＋補助）全PASS・工程5-1/5-2の44ケースを再実行し回帰なし（**合計71/71 PASS**）。JavaScript構文OK・dev-check 200/200/200。

**検証（実測・実Supabase／専用caseId `case-ms3t75suuo2i`・productName `TEST_ASP_INTELLIGENCE_53_20260728073836`）**：
- Output Draft POST回数＝2回（① scaffold Draft作成1回・② 商材採用の四書き1回）。**ASP専用POSTは0回**。
- 採用後`fields`に`affiliateContext`／`intelligenceContext.product`／`intelligenceContext.revenue`／`intelligenceContext.asp`（`groupKey`/`candidates`2件/`recommendedAspName`="もしも"/`confidence`Medium64点/`derived.status`="watch"）が確認できた。
- Evidence総数12件（保存前後で不変）。`usedBy`内訳：`product`=12・`revenue`=9・`asp`=4。**`asp`の重複タグなし**。candidates内`fieldEvidence`はEvidence IDのみ参照（本体複製なし）。
- F5再読み込み後、推奨ASP・Confidenceレベル/スコア・比較ASP数・Independent件数がF5前と完全一致。`asp.updatedAt`タイムスタンプも完全一致＝**再計算されていないことを実証**。
- caseId分離：別案件（既存案件）へ切替時、テストのASP Intelligenceは一切混入せず「比較対象の商材が未登録のため情報なし」を表示。テスト案件へ戻ると正しく再復元。
- Copy Full Reportに推奨ASP・Confidence・Independent件数・💾保存済み表示が含まれることを確認。
- Product Intelligence／Revenue Intelligence／ranking／`integratedScore`／`estimatedProfit`いずれも回帰なし。Console error 0。実ブラウザ確認でSupabase書込みは上記の意図した2回のみ（他はGETのみ）・AI API実行0。
- **テストデータ限定削除**：ユーザーがSupabase SQL Editorで`case_id='case-ms3t75suuo2i'`限定のDELETEを実施（`affiliate_evaluations`・`output_drafts`）。削除後`activeOnly=false`含む全件確認で**両テーブルとも`remaining=0`を実測**。既存の他案件データ（`case-mry3oyqamqlp`等）は無影響。

**採用理由**：Product Intelligence（工程3-3）・Revenue Intelligence（工程4-4）で実証済みの「使い捨てプレビュー＋既存push1回への相乗り＋保存済み正本優先」パターンをそのまま踏襲することで、新しい永続化経路・新しいUI設計判断を増やさずに回帰リスクを最小化できる。Evidence共有は工程5-1・5-2の設計をそのまま再利用し、二重生成・二重計上を避ける。

**却下した案**：ASP専用の新規保存API／DB列を追加する案（既存`fields`JSONB丸ごと保存で十分・server/DB/API変更が不要になる既存パターンを優先）。新規Copyボタンを追加する案（導線過多・既存Copy Full Reportへの追記で十分）。

**Git/反映**：Code commit **b473053**（`feat: wire ASP intelligence display and persistence`・index.htmlのみ +146/-0）・docs commit＝本更新・Annotated Tag **v1.01-affiliate-asp-intelligence-persistence**・**main push・Render反映**。**PC本番確認・iPhone実機確認 完了（2026-07-28・ユーザー実施）**：PC＝ログイン/ホーム/Output Engine/Affiliate Intelligence Core/Revenue Intelligence（空状態）/ASP Intelligence/おすすめ順位ランキング/Copy Full Report すべて正常・白画面/無限ロード/崩れなし。iPhone＝同項目に加え案件入力フォーム正常・Copy Full Report「コピーしました」表示確認・横スクロール/画面停止なし。**保存済み案件が存在しないためProduct Intelligence保存済み表示/💾表示は確認対象外**。**Phase54 Complete維持・Phase55未着手**。

**次工程**：未定（ASP Intelligence 7層構想の残り＝Competition/Content/Market/Self Improvement Intelligence、またはVersion1.1 Realtime Sync残課題等）。

---

# Decision 079
## ASP Intelligence（③層）正式仕様 — Product Intelligence 上の比較説明層として採用（工程5-1・5-2）（2026-07-28）

**背景**：Revenue Intelligence（⑤層・Decision 078）完了後、Version2 Core ③ ASP Intelligence（同一商品の複数ASP評価を比較し、どのASPを使うべきかを説明する層）の実装にあたり、比較単位・Evidence共有・推奨判定・Confidence方式を確定する必要があった。ASP Intelligence開始前調査・設計レビュー（現状把握・MD整合性確認・設計照合）を経て、工程5-1でデータ構造とEvidence配線、工程5-2でConfidence計算を実装した。

**決定（正式）**：

1. **受け皿は既存 `intelligenceContext.asp`**（`INTEL_MODULE_KEYS` に元々定義済みの空スロットを使用。新規トップレベル領域は追加しない）。
2. **比較単位は正規化商品名×market**（`_intelAspGroupKey`。ASP名は比較グループキーへ含めない）。既存 `_aicNormalizeKeyPart` を再利用し新しい正規化関数は作らない。同一グループ内で**Active評価（`_aicIsPersisted`＝GET activeOnly=true復元済み、または保存成功済み）のみを候補化**し、同一`productIdentifier`重複は1件に限定して不定な候補を作らない。
3. **推奨ASPは新しいASP専用スコア式を作らず、既存 `estimatedProfit`（`_aicEstimate`の再利用・再算出しない）最大**を推奨とする。有効`estimatedProfit`を持つ候補が2件未満は推奨判定不可（`null`）。同値は `approvalRate → epc → payout → 正規化aspName` で決定的にタイブレークする。
4. **Evidenceは新規生成しない**。**採用商品(product)が参照する既存Product Evidenceにのみ `usedBy:'asp'` を冪等追記**して共有参照する（`_intelMarkEvidenceUsedBy`再利用）。他ASP候補のEvidenceは読み取りのみで、永続Evidenceへ書き戻さない（比較用の使い捨てcandidate構造内でのみ参照）。
5. **ASP Confidence は Product／Revenue とは独立した `confidenceOwner:'asp'`** を採用し、既存 `_intelCalculateConfidence`（工程2共通基盤）を再利用する（新式・新しきい値は作らない）。母集団は**`usedBy:'asp'`で共有参照されたEvidenceのみ**（他ASP候補のEvidenceはusedByを持たないため自然に母集団外・二重計上なし）。独立Evidence3件未満は点数不問でInsufficient（工程2ルール継承）。`knownFactors`/`totalFactors`は工程5-1で構築済みの比較全体（比較ASP数×直接入力4項目）の値をそのまま再利用する。
6. **`derived.status`はConfidence連動に加え、比較ASP数2件未満・有効estimatedProfit候補2件未満のいずれかでも強制的にinsufficientとする**（Evidenceが充実していても単一ASP・比較不成立時に高評価を作らない）。
7. **ASP Intelligenceは説明レイヤー**であり、順位（integratedScore→estimatedProfit）・`integratedScore`・`estimatedProfit`式・Product Confidence・Revenue Confidenceを変更しない。**推奨ASP判定自体はConfidenceの水準から独立して成立する**（Evidence根拠が薄くても比較成立数を満たせば推奨は出せる。信頼度の説明とは役割を分離する）。
8. **表示UI接続・Output Draft永続化・F5復元・Supabase保存は工程5-3以降へ分離**し、今回（5-1・5-2）では実装しない。

**採用理由**：既存の`intelligenceContext`受け皿・Evidence/Confidence共通基盤（工程2）・Product/Revenue Intelligenceの実装パターン（工程3・4）をそのまま踏襲することで、新しい判断基盤を増やさずに回帰リスクを最小化できる。Evidence共有により二重生成・二重計上を避け、比較不成立時の強制insufficientにより過信を防ぐ。表示・永続化を後続工程へ分離することで、5-1・5-2は純粋なデータ構造・計算ロジックのみの安全な追加に限定できる。

**却下した案**：ASP専用の新しい加重スコア式・乗算式（②のestimatedProfitで十分・二重基準を避ける）／他ASP候補のEvidenceにも`usedBy:'asp'`を書き込む案（永続データの過剰な書き込み・二重計上リスク）／Confidence母集団を比較ASP数ベースの新モデルにする案（工程2の独立Evidence件数モデルをそのまま再利用し一貫性を優先）。

**検証（実測）**：純関数 工程5-1 18ケース＋工程5-2追加26ケース＝**44/44 PASS**（グルーピング・推奨判定・単一ASP/欠損時のInsufficient・Evidence非破壊/冪等・Product/Revenue/ランキング非影響・Confidence基本9ケース・分離非破壊9ケース・冪等性/後方互換8ケース）。JavaScript構文OK・dev-check 200/200/200・Console error 0・実ブラウザ確認でSupabase書込み0・AI API実行0（GETのみ）・既存機能（Task管理／Auto Task／Output Engine／Leader会話／案件切替）回帰なし。

**Git/反映**：Code commit **17587296c9413f53dcc05e4c72897ac4e8d0643a**（`feat: add ASP intelligence confidence`・index.htmlのみ +212/-0）・docs commit **a1f97533849b4f28b5be7e1ad4e6f64e4bc9638f**・Annotated Tag **v1.01-affiliate-asp-intelligence**・**main push・Render反映**・**iPhone実機確認 完了（2026-07-28・ユーザー実施：ログイン/ホーム/案件一覧・切替/Task/Auto Task/Leader/Output Engine/Affiliate Intelligence Core/Revenue Intelligence すべて正常・レイアウト崩れ/横スクロール/白画面/無限ロード/画面停止 いずれもなし）**。**Phase54 Complete維持・Phase55未着手**。

**次工程**：ASP Intelligence 工程5-3（表示UI接続・Output Draft永続化・F5復元・端末同期）。仕様は未確定・今回は着手しない。

---

# Decision 078
## Revenue Intelligence（⑤層）正式仕様 — Product Intelligence 上の読み取り専用説明層として採用（工程4）（2026-07-27）

**背景**：工程3で Product Intelligence（②）を確立した後、Version2 Core の⑤ Revenue Intelligence（利益・収益効率・将来価値）を実装するにあたり、受け皿・Evidence・Confidence・表示・永続化の方式を確定する必要があった。工程4-0設計で方針を固め、4-1〜4-4で実装・実Supabase検証まで完了した。

**決定（正式）**：

1. **受け皿は `intelligenceContext.revenue`**（`INTEL_MODULE_KEYS` に `'revenue'` を追加・`'product'` 直後・後方互換）。**既存 `'business'` は流用しない**（Version2 の "Business Intelligence" との意味衝突回避・独立モジュール管理）。
2. **Revenueは Product の財務サブ集合を複製し、既存 Product Evidence を `usedBy:'revenue'` で共有参照**する。**Revenue専用 Evidence を新規生成しない**（`_intelCreateEvidence`/`_intelAddEvidence` を呼ばない）・Evidence件数不変・`usedBy` 冪等・**Product Context 非破壊**。
3. **Revenue入力7項目**（`profitRate/approvalRate/epc/cvr/payout/monthlyClicks/lifespanMonths`）・**派生2項目**（`estimatedSales/estimatedProfit`・Productの値を複製・再算出しない・`integratedScore` は②正本のため除外）。
4. **Revenue Confidence は既存 `_intelCalculateConfidence` を再利用**（新式・新しきい値・新独立性判定を作らない）。**母集団は財務入力Evidenceのみ**（派生 estimatedSales/estimatedProfit は根拠参照可だが**独立件数へ二重計上しない**）。**独立Evidence3件未満は点数不問で Insufficient**（工程2ルール継承）。**`totalFactors=7`**・`knownFactors` は財務入力の有効件数。**Product Confidence とは分離**（`revenue.confidenceOwner='revenue'`）。
5. **Revenue status** は `confidenceLevel==='Insufficient' → 'insufficient'`、それ以外は既存 `_aicStatusFromScore(confidenceScore)`（good/watch/insufficient）を再利用。**独自status体系・新色体系を作らない**・空データで good/high を誤表示しない。
6. **Revenueは説明レイヤー**であり、**ランキング順位（integratedScore→estimatedProfit）・integratedScore・estimatedProfit式・Product Confidence を変更しない**。
7. **表示**：AIC最小パネル（現在案件の採用商材＝保存済みRevenue優先、無ければ rank1 プレビュー）＋各ランキングカードのRevenueライン。金額は既存表記（`.toLocaleString()`＋`円/月`）・null は情報なし・**0は有効値**。未採用/旧Draトの表示は**使い捨てContextの非永続プレビュー**（実context・実Evidence・usedBy を変更しない・POST0）。
8. **永続化は既存Output Draト保存へ相乗り**：採用時に `affiliateContext`＋`intelligenceContext.product`＋`intelligenceContext.revenue` を同一Draトへ両書きし、**既存 `pushOutputDraftToServer` を1回**（**採用1回=POST1回**・Revenue専用POST/PATCH/新APIなし）。新DBテーブル/新列なし。
9. **保存済みRevenueを正本として復元・表示**し、**復元時に再計算しない**。保存済みが無い旧Draト・未採用商材は非永続プレビューへ**fallback**。
10. **変更は `index.html` のみ**。**server.js/lib/DB/schema.sql/API/output_drafts定義/`_icpDeriveTopic`/Workflow Wiring/`_intelCalculateConfidence`本体/Product Intelligence は無変更**。

**採用理由**：②の永続データ（財務入力・derived）に自然に載り、既存 Evidence/Confidence 基盤（工程2）を再利用でき、選品の「利益ランキング」の説明力を高める。Evidence共有により二重生成・二重計上を避け、財務入力のみの母集団で Confidence の過大評価を防ぐ。両書きを既存の1 POST に相乗りさせることで回帰リスクと通信を最小化し、保存済み優先表示で採用後の一貫性を担保する。

**却下した案**：`'business'` モジュール流用（意味衝突）／Revenue専用Evidence生成（重複・二重計上）／派生を含めたConfidence母集団（二重評価）／Revenueによる再ランキング（説明レイヤーの原則違反）／Revenue専用POST・二段階保存（POST増）。

**検証（実測）**：純関数（4-1）31＋（4-2）31・表示12ケース・永続化15ケース 全PASS・dev-check 200/200/200・Console 0・回帰なし。**実Supabase（専用caseId `intel-4-4-verify-20260727`）**：両書き保存（採用1回=POST1）・Product/Revenue識別子一致・Revenue（inputs7/derived2/Known7/status watch/Confidence Medium64/owner revenue/used9）・**Evidence総数10＝Product分のみ（Revenue専用生成なし・件数不変・usedBy重複なし）**・**F5復元でConfidence保存値維持（再計算なし）**・**保存済み優先表示💾**・**表示/復元POST0**・**テストデータ限定削除 remaining=0（draft=null・既存データ無影響）**。

**Git/反映**：Code commit **8cde936**（index.htmlのみ +230/-1）・Annotated Tag **v1.01-affiliate-revenue-intelligence**・**main push・Render反映**・**iPhone実機確認 完了（2026-07-27・ユーザー実施）**。**Phase54 Complete維持・Phase55未着手**。

**次工程**：ASP Intelligence（③層）開始前調査・設計（未着手）。

---

# Decision 077
## 工程3-3: 採用時に affiliateContext と intelligenceContext.product を同一Output Draftへ両書き・1回保存する（2026-07-27）

**背景**：工程3-1で `intelligenceContext.product`（リッチ正本＝Product入力/派生/Evidence/Confidence）を定義し、工程3-2でランキングに表示時Confidenceプレビューを追加した。次に、ユーザーが保存済みAffiliate評価を採用（`adoptAffiliateForContentPlanning`）した際、既存の軽量 `affiliateContext`（収益導線用）に加えて、リッチな `intelligenceContext.product` を**永続化**し、F5後も復元できる状態にする必要があった。既存の `affiliateContext` 単独保存経路（Decision 075）と、Output Draft の `fields`(JSONB) 保存経路（`pushOutputDraftToServer`）を活かしつつ、片方だけ保存される中途半端な状態を避けることが要件だった。

**決定（正式）**：

1. **採用時に `fields.affiliateContext` と `fields.intelligenceContext.product` を両書き**する。前者は既存の軽量サブセット（フィールド名・用途不変）、後者は工程3-1のリッチ構造。
2. **保存は既存 `pushOutputDraftToServer` を1回のみ**（`fields` 丸ごと送信＝両fieldを同一POSTで原子的に永続化）。**採用1回＝POST 1回**。**`_intelSaveContext` は使わない**（attach＋pushを内包しPOSTが二重化するため）。
3. **原子性**：両contextを**一時変数**（`nextAffiliateContext`／`nextIntelligenceContext`）で完成させ、**必須項目（productIdentifier/evaluationId）と caseId 6項目一致**（currentCase/draft.caseId/src.caseId/affiliate.caseId/intel.caseId/product.caseId ＋ `_intelContextCaseMatches`）を確認し、**全成功時のみ**実Draftへ**一括反映**する。途中で実Draftへ片方だけ書かない。
4. **実Draftを検証前に破壊しない**：intelligenceContextは `_intelGetContext(draft)` の正規化コピーを **`JSON.parse(JSON.stringify())` で deep copy**（既存プロジェクトidiom）してから `_intelSyncProductFromAffiliate` で product生成する（実Draftの evidence オブジェクトを検証前に変更しない）。`_intelSyncProductFromAffiliate` は product を return するのみで `ctx.product` へ自動代入しないため、**明示代入**する。
5. **正式レコードから生成**：product は採用対象の正式Affiliate評価レコード `src` から生成し、`evaluationId=src.serverId`／`productIdentifier`はサーバー返却値を優先（client別形式で上書きしない）。ランキング表示用の加工オブジェクトを正本にしない。
6. **失敗時は保存しない**：product生成失敗・必須欠落・caseId不一致・例外時は、**affiliateContext・intelligenceContextとも反映せず `pushOutputDraftToServer` も呼ばない**。`_aicAdoptMsg` にエラー表示＋`console.warn`。元Draftは維持。
7. **Evidence冪等・履歴保持**：同一商品の再採用は安定キーでEvidenceを更新（増殖しない）。別商品採用は `product` を置換し、`intelligenceContext.evidence` は**旧Evidenceを履歴として保持（自動削除しない）**。`product.usedEvidenceIds` は現採用商品のEvidenceのみ参照。`INTEL_EVIDENCE_SOFT_LIMIT` 仕様は不変。
8. **`products[]` は後方互換で維持**し、今回は**新規履歴追加を行わない**（`product`＝現採用のみ）。
9. **`channelScope` は非統一を維持**：`affiliateContext.channelScope='all'`／`product.channelScope='instagram'`（役割が異なるscope・今回統一しない）。
10. **非変更**：`pushOutputDraftToServer`／`_icpDeriveTopic`／Content Planning本体／`buildAffiliateIntelligenceRanking`（順位）／Confidence計算式／工程3-2表示関数／server.js／lib／DB／schema.sql／API。収益導線（`affiliateContext`→topic→Content Planning→Carousel/Publishing）は不変。

**採用理由**：`fields` 丸ごと保存の既存仕様により、両fieldを1POSTで原子的に永続化でき「片方だけ保存」を構造的に排除できる／一時変数＋deep copy＋全検証後反映により、失敗時の実Draft汚染とロールバックを不要にできる／既存ヘルパ（`_intelGetContext`/`_intelSyncProductFromAffiliate`/`_intelAttachContext`/`_intelContextCaseMatches`）の再利用で新規関数を追加せず、回帰リスクを最小化（`index.html` のみ +58/-10）。

**却下した案**：`_intelSaveContext` を別途呼ぶ案（POSTが2回になる）／実Draftのcontextを直接 sync する案（検証前に実evidenceを破壊し、失敗時ロールバックが必要）／intelligenceContext失敗時に affiliateContext だけ保存する案（片方だけ保存を許容＝不整合）。

**検証（実測）**：隔離テスト A〜F 全合格（正常両書き/既存field保持/同一商品Evidence非増殖(14→14)/別商品置換・旧保持(14→28)・新usedは旧非参照/caseId不一致でpush0/Product失敗でpush0/採用1回=push1）・dev-check 200/200/200・Console 0・回帰なし。**実Supabase検証（localhost・source:db・専用caseId `intel-3-3-verify-20260727`）**：両書き保存（POST1回）／F5復元成功（product子項目・calculated Evidence・confidence・evidence履歴 維持）／同一商品14→14／別商品置換14→28。**テストデータ限定削除 remaining=0**（ユーザーが Supabase SQL Editor で `DELETE ... WHERE case_id='intel-3-3-verify-20260727'`・API読戻し draft=null）。

**Git/反映**：Code commit **3ef7495**（工程3-3・index.htmlのみ +58/-10）。工程3-1 **28fa51c**／工程3-2 **1d04f31**。Annotated Tag **v1.01-affiliate-product-intelligence-persistence**。**main push・Render反映**。**iPhone実機確認はユーザー実施**。**Phase54 Complete維持・Phase55未着手**。

**次工程**：未定（候補：ランキングで採用済み商品の保存済みConfidenceを優先表示＝案A／Product Intelligence本体・他Intelligence層）。

---

# Decision 076
## Affiliate Intelligence Company の Evidence / Confidence を全モジュール共通基盤として採用する（工程2）（2026-07-26）

**背景**：設計工程1で、14モジュール（12 Intelligence＋Evidence/Confidence）を4層構造で確定した。各モジュールが「根拠を説明でき」「スコアの高さと信頼度を分離できる」ためには、Evidence（根拠）と Confidence（信頼度）を**独立機能ではなく全モジュールが利用する横断共通層**として先に固める必要がある（後付けは全モジュールの出力構造を再修正させ、やり直しコストが大きい）。工程2はこの共通土台のみを実装し、各Intelligence本体（B〜D層）は対象外とした。

**決定（正式）**：

1. **Evidence / Confidence を全Intelligence共通基盤として採用**する（横断層A）。すべての判断モジュールがこの共通型・helperを使う。
2. **共通Contextの保存先は `outputDraft.fields.intelligenceContext`（JSONB）**とする。**新DBテーブル・新DB列・新APIは追加しない**（既存 `pushOutputDraftToServer`／`GET /api/output-drafts` 経路に相乗り）。案件横断のEvidence検索/集計が必要になった時のみ、将来 専用テーブルを別案として再評価する。
3. **Evidence ID は `ev-<UUID>` 方式**（`crypto.randomUUID()` 優先・不可時のみ timestamp+random fallback）。`ev-<caseId>-<seq>` は採用しない（PC/iPhone/複数タブ同時生成の衝突回避）。
4. **派生Evidence（calculated/heuristic/ai_interpretation・`derivedFromEvidenceIds` あり）は独立(一次)Evidence件数に含めない**。同一 sourceReference＋対象＋観測日の重複も1件に畳む（同一事実からの元/計算/AI要約/ヒューリスティックを二重計上しない）。
5. **Confidence は初期ヒューリスティック**であり、業務精度は未確定。将来 Learning 実績に応じて重み・しきい値を調整する前提とする（重み・しきい値・最低件数は**定数化**し各所へ直書きしない）。
6. **独立Evidenceが最低件数（初期3件）未満の場合は、点数にかかわらず `Insufficient`** とする。**Decision 032**（未入力は中立値・knownFactors併記・予測明示・過信させない）を Confidence へ統合する。
7. **採用商材の現在正本は引き続き `affiliateContext`** のまま維持する。`intelligenceContext.product` は空の受け皿として初期化のみ。
8. **Product Intelligence 正式化（工程3）までは、`affiliateContext`↔`intelligenceContext.product` の自動ミラー・正本切替を行わない**。`_icpDeriveTopic()`・Workflow Wiring は変更しない。
9. **AICパネルの最小表示位置は Leader 統合判断の直下**（読み取り専用・空データは Insufficient・高評価を誤表示しない）。
10. **工程2では DB列・API を追加せず、既存 Output Draft 保存経路を利用**する。**index.html のみの追加（+372/-0）**で完結させる。

**採用理由**：Evidence/Confidenceは全モジュールが依存する土台であり、先に共通仕様を固めることで後続工程の出力構造の作り直しを防げる。既存 `output_drafts.fields`(JSONB) は Workflow Wiring で保存/復元/PC・iPhone同期が実証済みで、新DB/新APIなしに最小差分で載せられる。誠実性（Decision 032）を Confidence に統合することで、スコアの高さと信頼度を分離し過信を防ぐ。

**却下した案**：Evidence/Confidenceを各モジュール実装時に個別実装する案（出力構造の重複と後付け再修正・やり直しコスト大）／専用DBテーブルを工程2で新設する案（現状は手動・小規模・case単位アクセスのみでJSONBで充足・回帰リスクを不要に増やす）。

**検証・反映**：純関数18/18 PASS・dev-check 200/200/200・console error 0・AICパネル実描画OK（PC/375pxモバイル）・実Supabase保存(POST1回)/F5復元/affiliateContext併存/テストデータ削除(remaining=0) 確認。**Code commit 29d82c1・tag v1.01-affiliate-intelligence-evidence-confidence・main push・Render反映済み**。**iPhone実機確認完了（2026-07-26・本番URLでLeader統合判断直下に表示・崩れなし）＝工程2 正式Complete**。**Phase54 Complete維持・Phase55未着手**。

**次工程**：Affiliate Intelligence Company 工程3 — Product Intelligence 正式化（未着手）。

---

# Decision 075
## Affiliate選定→Instagram投稿企画 の Workflow Wiring を正式化する（既存Draft再利用・新規Draft自動生成なし）（2026-07-24）

**背景**：Affiliate Evaluation 工程1 完了（Decision 074）で商材選定→投稿企画への接続基盤が整った。次工程として、ユーザーが採用したAffiliate商材を実際のInstagram投稿企画（Content Planning）へ流す配線を実装する必要があった。方式として、**案A/E（採用時に既存Instagram Draftへ `affiliateContext` を非破壊付加し `_icpDeriveTopic()` の topic導出へ反映）** と **案B（採用時に新規Instagram Draftを Workflow で自動生成）** を比較した。

**決定（正式）**：

1. **採用商材は既存Output Draft の `fields.affiliateContext` へ非破壊スナップショット**し、`_icpDeriveTopic()` が **現在Draftと `caseId` が一致する場合のみ**最優先で topic に使用する（案A/E採用）。caseId不一致・未設定は使わず既存導出へ安全フォールバックする（別案件混入防止）。非Affiliate Draftの挙動は変えない。
2. **新規Draftの自動生成は行わない**（案B却下）。通常のDraft生成は Workflow＝AI実行と結合し課金が発生するため、**Manual Only・課金防止設計に反する**。反映先は**現在案件に属する既存 Instagram Draft（`INSTAGRAM_CAROUSEL`/`INSTAGRAM_POST`）が存在する場合のみ再利用**し、無ければ「先にInstagram成果物を生成してください」と案内するに留める。
3. **採用可能は保存済みActive評価のみ**（`persistenceState==='saved'` かつ `serverId`）。未保存・`save_failed` は採用不可（誤って未確定評価を投稿企画へ流さない）。
4. **AICの案件判定は `_aicCurrentCaseId()`**（Decision 072を継承）。**現在案件が取得でき／採用評価が現在案件に属し／反映先Draftの `caseId` も一致する**三条件を満たす時のみ反映する。`getCurrentApprovalCaseId()` は使わない（`_lastOutputDraft.caseId` へのフォールバックで別案件を掴むため）。
5. **server.js・lib・DB・`supabase/schema.sql`・API shape は変更しない**。`affiliateContext` は既存 `output_drafts.fields`(JSONB) として**既存の正式保存経路 `pushOutputDraftToServer()`** で永続化する（**新API・新DB列なし**）。
6. **Phase54 Complete維持・Phase55未着手**（本工程でPhase55を開始しない）。

**採用理由**：既存の topic導出（`_icpDeriveTopic`）と Output Draft 保存（`pushOutputDraftToServer`）を再利用でき、**AI実行・新API・DB変更なしで最小差分（index.htmlのみ +89/-0）**で収益化ラインを1歩前進できる。案B（新規Draft自動生成）は AI実行＝課金を伴い、Manual Only設計に反し、回帰リスクも不要に増やす。

**却下した案**：案B（採用時に新規Instagram Draftを Workflow で自動生成する）＝AI実行・課金・Manual Only違反。

**Git/反映**：commit **745dd1e**（`feat: wire affiliate selection to instagram planning`・index.htmlのみ +89/-0）・**main push済み（HEAD=origin/main=745dd1e）**・**Render反映済み**・**iPhone実機確認完了**・tag **v1.01-instagram-planning-wiring**。テストデータは専用caseId 2件（`case-mrxmpfx78ua2`／`WW_TEST_20260723`）を限定DELETEで削除。**Phase54 Complete維持・Phase55未着手**。

---

# Decision 074
## Affiliate Evaluation 工程1 をクローズし、P2〜P6の保留継続を正式決定する（2026-07-23）

**背景**：工程1-D（開始前調査）で、Decision 073 が保留とした P2〜P6 を個別評価した。Affiliate Evaluation の実運用特性は **手動入力のみ・小規模（1案件あたり商材数件〜十数件・表示上限50）・低頻度・本番現状0件** であり、この土台のもとで各項目の実害・必要性・後回し可否・影響範囲・推奨順位を精査した。

**評価結果（工程1-D調査）**：

| 項目 | 実害 | IG開始前に必要 | 影響範囲 | 推奨順位 | 判定 |
|---|---|---|---|---|---|
| **P2** inactive化API（PATCH/DELETE） | なし | 不要 | 中（新API・API shape拡張） | 中 | 保留継続 |
| **P3** 保存のトランザクション化（RPC） | 限定的（`activeMayBeZero` で緩和済） | 不要 | 大（DBへRPCデプロイ＝Migration相当・前例なし） | 低 | 保留継続 |
| **P4** save_failed 永続化（F5消失） | 軽微（再送で復旧・Known Limitation） | 不要 | 小（localStorage肥大の新リスク） | 低 | 保留継続 |
| **P5** channelScope 拡張 | なし | 不要（IGは単一運用・DB側は対応済） | 小 | 低 | 保留継続 |
| **P6** GET件数上限 | なし | 不要（手動・小規模） | 最小（1行） | 低 | 保留継続 |

**決定（正式）**：

1. **P2〜P6 は現時点で実装不要とし、保留を継続する**。いずれも実害が無いか緩和済みで、Instagram自動運営の開始を妨げない。
2. **工程1-D の成果は「実装」ではなく「保留の正式決定」**とする。工程1-D を保留課題の消化に充てない。特に **P3（RPC）は対策コストとリスクが実害を上回るため、安易に採用しない**。
3. **P2〜P6 は実運用で必要性が生じた場合に、個別工程（工程1-E以降）として再評価**する（社員向上BのFlyer/LP保留と同じ「優先順位判断による保留」）。
4. **工程1-A〜1-D をもって Affiliate Evaluation 工程1 を完了（クローズ）**とする。永続化API（1-A）・Active一意性の商材単位化（1-B-0a〜0d）・Workflow Wiring（1-B本体）・Active Case Hotfix・schema.sql記録（1-C）・保留課題の正式決定（1-D）が揃い、**商材選定→投稿企画への接続に必要な基盤は完成**している。
5. **次工程は Instagram自動運営（Workflow Wiring）**とする。Version1の最優先目的「Instagram収益化支援」に直結する、Affiliate評価ランキング → Instagram Content Planning への接続を優先する。
6. **Phase54 Complete維持・Phase55未着手**（工程1のクローズはPhaseの進行ではない）。

**採用理由**：Version1の最優先目的はInstagram収益化支援であり、次の実質価値は「評価結果を実際のInstagram運用へ流す」ことにある。P2〜P6は保守・堅牢化の課題で収益化を前進させず、実運用で実害が出た時に個別対応する方が投資対効果が高い。保守課題を先回りで実装すると、特にRPC等で回帰リスクを不要に増やす。

**却下した案**：P2〜P6 を工程1-Dでまとめて実装する案（RPCを巻き込みリスクが跳ねる・収益化を1歩も前進させない）。

**Git/反映**：docs更新のみ（実装なし）。**Phase54 Complete維持・Phase55未着手**。

---

# Decision 073
## 工程1-C は案A（schema.sql記録のみ）を採用し、実DB定義を正本として記録する（2026-07-23）

**背景**：`affiliate_evaluations` は工程1-A時にSupabaseダッシュボードでDBへ直接作成されたため、**テーブル定義自体が `supabase/schema.sql` に未記録**（P1）だった。他テーブルはすべてschema.sqlに定義があり、affiliate系のみ drift（記録と実体の乖離）状態で、**新環境の再構築・災害復旧が不能**という保守性の負債があった。工程1-Cのスコープとして、案A（schema.sql記録のみ）／案B（＋inactive化API）／案C（＋RPCトランザクション化）の3案を比較した。

**決定（正式）**：

1. **工程1-Cは案A（schema.sql記録のみ）を採用**する。`affiliate_evaluations` の**実DB定義を読み取り専用SELECTで実測**し、その結果を**正本として `supabase/schema.sql` へ純追記**する。
2. **schema.sql は Migration ではなく、再構築・保守用の定義記録**である。既存の実DBを自動変更しない。`IF NOT EXISTS` / 冪等 `DO $$` block で再実行安全とし、冒頭コメントに「記録用でありMigrationではない」旨を明記する。
3. **実DB・API shape・アプリコード（server.js / lib / index.html）は変更しない**。DDL（CREATE/ALTER/DROP）も実行しない。
4. **記録内容は実DB実測と1文字単位で一致させる**（drift防止）。列型・DEFAULT・NULL制約・Identity方式・Index式・CHECK本文・Policy定義は、推測ではなく Supabase SQL Editor の実測値で確定する。
5. **本工程は dev-check を必須完了条件としない**。server.js・lib・index.html・APIを変更しないため。中核の検証は「schema.sql の記録内容と実DB実測値の一致」とする。
6. **P2〜P6 は工程1-D以降の候補として保留**する（未完了・失敗ではなく、優先順位判断による保留。社員向上BのFlyer/LP保留と同じ扱い）。
   - **P2 inactive化API（PATCH/DELETE）**：現在はUI除外抑止＋必要時のSQL Editor手動対応で実害が小さい。実運用で取り消しニーズが出た時点で再評価。
   - **P3 保存の非トランザクション化（RPC）**：`activeMayBeZero:true` 通知で実害が緩和済み。DBへの関数デプロイは前例がなくリスクが最大のため、現時点で優先度を上げない。
   - **P4 `save_failed` のF5消失**：メモリ保持のみ・Known Limitation・保証対象外。
   - **P5 `channelScope='all'` 固定**：Instagram以外への拡張時に値体系を再設計。現時点では変更しない。
   - **P6 GET件数上限未設定**：PostgREST既定上限内。件数増加時に再評価。

**採用理由**：P1は「未記録」という明確な負債で、Cost DB（Phase54）の前例（Decision＋schema.sql純追記）がそのまま適用でき、判断の余地が少なく安全に閉じられる／案B・案CはAPI shape拡張やDBへのRPCデプロイを伴い、**Instagram収益化を何も妨げていない現状**に対して回帰リスクを増やす正当性が薄い／案Aは既存の実DB・API・コードを一切変えずに保守性の負債を1つ確実に解消できる。

**却下した案**：**案B（inactive化API込み）**＝現時点で実害が小さく、API契約を増やすのは実運用の具体的ニーズが出てから判断すべき／**案C（RPCトランザクション化）**＝DBへの関数デプロイは前例がなくリスク最大、P3は既に `activeMayBeZero` 通知で緩和済み。

**検証（実測）**：実DB定義（30列・PK・fingerprint UNIQUE・reco CHECK・idx_affiliate_eval_case・uq_affiliate_eval_active_product・RLS enabled=true/forced=false・Policy `affiliate_evaluations_all`・Trigger なし・FK なし）をSELECTで実測し、`supabase/schema.sql` への純追記が**全項目で実測と一致（drift なし）**であることを確認。

**Git/反映**：`supabase/schema.sql` のみ **+76/-0**。**Phase54 Complete維持・Phase55未着手**（工程1-CはPhase55の開始ではない）。

---

# Decision 072
## Affiliate評価の保存先判定は「現在表示中の確定案件」のみを正とする（2026-07-22）

**背景**：工程1-B本体の**本番通常経路の読み取り確認**において、実案件を1件開いた後に最新一覧（`__caselist__`）へ戻ると、**「案件を追加」ボタンが有効のまま**になり、押下すると**直前に開いていた案件へ保存され得る**ことが判明した。原因は、Affiliate側が案件判定に使っていた `getCurrentApprovalCaseId()` が、`_ncActiveCaseId()` の `undefined` 時に **`_lastOutputDraft.caseId` へフォールバック**する既存仕様を持つためである（ローカル検証では `_lastOutputDraft` が `null` で発火せず未検出だった）。

**決定（正式）**：

1. **Affiliate Evaluation の保存先判定は、成果物の直前案件ではなく「現在表示中の確定案件」だけを正とする**。
2. **AICでは `getCurrentApprovalCaseId()` を使用しない**。同関数は `_lastOutputDraft.caseId` へフォールバックするため、表示中の案件ではなく直前成果物の案件を返す場合がある。
3. **Affiliate専用の `_aicCurrentCaseId()` を正本とする**。`currentMember` 未選択（ホーム等）・`latest`・`__caselist__` はいずれも **`null`** を返し、**直前案件へフォールバックしない**。
4. **統一対象は4箇所**：①復元応答適用前の案件再照合 ②復元リトライ対象の取得 ③`addAffiliateCase()` の保存前案件判定 ④「案件を追加」ボタンの有効/無効判定。
5. **明示的に `caseId` を引数で受け取る関数（`restoreAffiliateEvaluationsForCase(caseId)` 等）は変更しない**（過剰変更を避ける）。
6. **`getCurrentApprovalCaseId()` 自体は変更しない**。Approval／Output Draft／Leader dispatch／Agent consult など他機能が依存しており、フォールバック仕様はそれら本来の用途では妥当なため。今回はAffiliate側の参照のみを切り替える。
7. 案件未確定時は **ボタン `disabled`（`onclick` なし）／`addAffiliateCase()` を直接呼んでも即時中止／POSTを発行しない／`_lastOutputDraft.caseId` の残存に影響されない**ことを必須挙動とする。

**採用理由**：意図しない案件への保存はユーザーが気づきにくく、後から誤りを特定するのも困難な種類の事故であり、**UIの無効化と保存前判定の両方で二重に防ぐ**必要がある／`getCurrentApprovalCaseId()` を変更すると既存4機能へ回帰リスクが波及するため、影響範囲をAffiliate側に閉じた専用ヘッパの追加が最小かつ安全／表示ビューの確定案件を正とする方針は、Decision 071 の案件境界D-1（`_affiliateCases` は現在案件のみ）と一貫する。

**却下した案**：`getCurrentApprovalCaseId()` からフォールバックを除去する案（既存4機能へ回帰リスクが及ぶため）／`_aicSyncState.status` のみで判定する案（表示状態と保存判定が別経路のままとなり、片方の更新漏れで再発し得るため）。

**検証（実測）**：`node --check` OK・**dev-check 200/200/200**・**localhost Case 1〜4 全合格**（案件確定＝取得・ボタン有効・GET1回／最新一覧＝**`_lastOutputDraft.caseId` 残存下でも `null`**・`disabled`・GET0/POST0／未確定ビューで `addAffiliateCase()` 直接実行＝**即時中止・追加なし・POST0**／別案件切替＝混入なし）・補助（担当未選択・`latest` も `null`）・既存8関数の非回帰・**console error 0**・**POST/PATCH/DELETE 0回**・**実DB書込みなし**。

**Git/反映**：`index.html` のみ **+17/-4**。**Phase54 Complete維持・Phase55未着手**（本Hotfixは工程1-B本体の一部であり、工程1-C・Phase55の開始ではない）。

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
