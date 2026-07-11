# DECISIONS.md

# ENBISOU AI COMPANY - 設計判断・意思決定ログ

更新日: 2026-07-11（Decision 050・Phase54-1g Approval POST Ordering / Last Action Wins＝POST直列化＋対象別supersede・着順逆転防止。index.htmlのみ・実装済み未Commit）

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

状態: **実装済み（index.html +89/-7・追加のみ）・未Commit**。commit/tag/push/Render すべて未実施（ユーザー承認後）。cost系3ファイルは未commit温存・stageに含めない。

追記日: 2026-07-11（Phase54-1g Approval POST Ordering / Last Action Wins・実装済み未Commit・合成確認＋localhost実機確認 完了・docs更新のみ・commit前）

