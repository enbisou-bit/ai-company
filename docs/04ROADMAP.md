# ENBISOU AI COMPANY Roadmap

> 作成日: 2026-07-02（Phase48-3.1） / 更新日: 2026-07-04（Version1 Roadmap方針変更・Instagram収益化支援優先化・Decision 039）
> 現在Version: v1.00-phase49-6 Complete（Creative Engineファミリー完結）
> Version2は責務分離型（Creative Engine / Intelligence / Sales / Automation / Business Intelligence / Company Brain v2 の6ファミリー）へ正式再構成（Decision 027〜029参照）
> Version1の最優先目的をInstagram収益化支援へ変更（Decision 039）。詳細は下記「Version1 最優先ゴール」参照
> **Version1 完成（Phase52-2記録・Decision 041）**: Instagram収益化パイプラインが全工程実装完了。現在Version v1.00-phase52-2 / Version1 Documentation Complete。

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
Phase B-4    Approved Decision Package契約化 ───── 未着手（旧Phase B-3相当）
             Output Engine接続・後方互換必須
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
