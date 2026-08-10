# ENBISOU AI COMPANY Roadmap

> 作成日: 2026-07-02（Phase48-3.1） / 更新日: 2026-07-04（Version1 Roadmap方針変更・Instagram収益化支援優先化・Decision 039）
> 現在Version: v1.00-phase49-6 Complete（Creative Engineファミリー完結）
> Version2は責務分離型（Creative Engine / Intelligence / Sales / Automation / Business Intelligence / Company Brain v2 の6ファミリー）へ正式再構成（Decision 027〜029参照）
> Version1の最優先目的をInstagram収益化支援へ変更（Decision 039）。詳細は下記「Version1 最優先ゴール」参照
> **Version1 完成（Phase52-2記録・Decision 041）**: Instagram収益化パイプラインが全工程実装完了。現在Version v1.00-phase52-2 / Version1 Documentation Complete。

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
【次工程】     Instagram実運用 ─────────────────────── 未着手（ユーザー承認後）
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
