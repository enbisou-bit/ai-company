# DECISIONS.md

# ENBISOU AI COMPANY - 設計判断・意思決定ログ

更新日: 2026-07-04（Phase49-4 Creative Execution完了）

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

