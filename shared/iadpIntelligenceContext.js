// ══════════════════════════════════════════════════════════════
// shared/iadpIntelligenceContext.js
// Phase IG-2J-E: Intelligence実数値の担当指示注入（薄いAdapterのみ）
//
// 責務（既存データの再利用・整形のみ）:
//   ・既存 outputDraft.fields.intelligenceContext（Decision076〜083で確立済みの
//     Affiliate Intelligence 6層＝product / asp / revenue / content / competition / market と
//     共通Evidence／Confidence）を読み取り、IADP 4担当（Researcher / Analyst / Branding / SNS）
//     へ渡すための1つの安全なContextへ集約する。
//   ・集約時に Fact / Evidence / Prediction / Unknown を決定論的に分離する。
//   ・担当ごとに必要なカテゴリだけを抜き出したテキストブロックを生成する。
//
// 非責務（作らない・やらない）:
//   ・新しいIntelligence Engine／新しいDBテーブル／新しい外部API／新しいスコア式・Confidence式。
//   ・既存 _intel* 関数の呼び出し・再計算（保存済みの値をそのまま参照するだけ）。
//   ・Evidence判定Coreの変更（＝Evidence正本のIADP品質判定への接続は次工程 IG-2J-F）。
//   ・実数値の推測・補完（値が無いものは Unknown として明示するだけ）。
//
// 設計原則:
//   ・純粋関数のみ（DOM/Node専用API/Network/グローバル状態書き換えなし）。
//   ・入力オブジェクトを一切変更しない（非破壊）。
//   ・例外を外へ投げない（fail-open・空Contextを返す＝Self-Completionを止めない）。
//   ・Evidenceの裏付けが無い数値は絶対にFactにしない（根拠不明の数字を会社実績として渡さない）。
//   ・現在案件（caseId）に紐づく情報のみ。Global最新値は無条件採用しない。
// ══════════════════════════════════════════════════════════════
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;                              // CommonJS（Node / 合成テスト）
  } else {
    root.IadpIntelligenceContext = api;                 // ブラウザ（window / globalThis）
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var BUILDER_VERSION = '1.0.0';

  // 既存 Affiliate Intelligence の6モジュール（INTEL_MODULE_KEYS のうち実装済みの6層）
  var INTEL_CATEGORIES = ['product', 'asp', 'revenue', 'content', 'competition', 'market'];

  // 既存 INTEL_EVIDENCE_TYPES（index.html）と同一の値。派生型はFactにしない。
  var FACT_EVIDENCE_TYPES    = ['public_fact', 'manual_observation', 'user_input', 'learning_result'];
  var DERIVED_EVIDENCE_TYPES = ['calculated', 'heuristic', 'ai_interpretation'];

  // 値の名称・単位（既存 INTEL_PRODUCT_INPUT_FIELDS / DERIVED_FIELDS と対応）
  var FIELD_LABELS = {
    payout: '報酬額', profitRate: '利益率', approvalRate: '承認率', epc: 'EPC', cvr: 'CVR',
    igFit: 'Instagram適性スコア', competitors: '競合数', lifespanMonths: '案件寿命',
    saveRatePred: '保存率予測', clickRatePred: 'クリック率予測', monthlyClicks: '月間クリック数',
    integratedScore: '統合スコア', estimatedSales: '想定売上', estimatedProfit: '想定利益',
  };
  var FIELD_UNITS = {
    payout: '円', profitRate: '%', approvalRate: '%', epc: '円', cvr: '%',
    competitors: '件', lifespanMonths: 'ヶ月', saveRatePred: '%', clickRatePred: '%',
    monthlyClicks: '回', estimatedSales: '円', estimatedProfit: '円',
  };
  // 名称からして予測値である項目・計算派生項目は、Evidenceの有無に関わらず常にPrediction。
  var ALWAYS_PREDICTION_FIELDS = ['saveRatePred', 'clickRatePred', 'igFit', 'integratedScore', 'estimatedSales', 'estimatedProfit'];

  // 各カテゴリで参照する入力フィールド（既存定数と同一の並び）
  var CATEGORY_INPUT_FIELDS = {
    product:     ['payout', 'profitRate', 'approvalRate', 'epc', 'cvr', 'igFit', 'competitors', 'lifespanMonths', 'saveRatePred', 'clickRatePred', 'monthlyClicks'],
    revenue:     ['profitRate', 'approvalRate', 'epc', 'cvr', 'payout', 'monthlyClicks', 'lifespanMonths'],
    content:     ['saveRatePred', 'clickRatePred', 'igFit'],
    competition: ['competitors', 'lifespanMonths', 'igFit'],
  };
  var CATEGORY_DERIVED_FIELDS = {
    product: ['integratedScore', 'estimatedSales', 'estimatedProfit'],
    revenue: ['estimatedSales', 'estimatedProfit'],
  };

  var CATEGORY_LABELS = {
    product: 'Product Intelligence（商品）', asp: 'ASP Intelligence（ASP比較）',
    revenue: 'Revenue Intelligence（収益）', content: 'Content Intelligence（Instagram適性）',
    competition: 'Competition Intelligence（競合環境）', market: 'Market Opportunity Intelligence（市場）',
  };

  // 担当ごとに渡すカテゴリ（不要な情報を全担当へ大量投入しない＝Token/Cost制御の第一段）
  var AGENT_CATEGORIES = {
    researcher: ['market', 'competition', 'product', 'asp'],
    analyst:    ['product', 'revenue', 'asp', 'competition', 'content'],
    branding:   ['market', 'competition', 'product', 'content'],
    sns:        ['content', 'competition', 'product', 'asp', 'revenue'],
  };
  var IADP_AGENT_IDS = ['researcher', 'analyst', 'branding', 'sns'];

  // Token/Cost制御の上限（全Intelligenceをそのまま全文投入しない）
  var LIMITS = {
    maxItemsPerSection: 6,     // Fact / Prediction / Unknown / Evidence 各セクションの最大件数
    maxItemChars: 120,         // 1項目あたりの最大文字数
    maxBlockChars: 1400,       // 担当1人あたりの注入ブロック最大文字数
    maxEvidenceItems: 5,       // Evidence一覧の最大件数
  };

  // 保存日時がこの日数より古い場合 stale（勝手に最新Fact扱いしない）
  var STALE_DAYS = 30;

  // 既存Intelligenceには存在しない＝必ず外部確認が必要な実数値（Factが無い場合のみUnknownへ追加）
  var EXTERNAL_UNKNOWNS = [
    { key: 'approvalRate', label: '実承認率', reason: 'ASP登録・審査後でなければ確定できません' },
    { key: 'epc',          label: '実EPC',    reason: 'ASP管理画面の実績値が必要です' },
    { key: 'cvr',          label: '実CVR',    reason: '実運用の計測値が必要です' },
    { key: '__screening',  label: '実ASP審査結果', reason: 'ASP登録後にのみ判明します' },
    { key: '__regulation', label: '実広告規制確認', reason: '掲載可否は各ASP・広告主の規約確認が必要です' },
  ];

  // ── 小ヘルパー ───────────────────────────────────────────────
  function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isNum(v) { return typeof v === 'number' && isFinite(v); }
  function str(v) { return (v === null || v === undefined) ? '' : String(v); }
  function clip(s, n) {
    var t = str(s).replace(/[\r\n]+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  }
  function ageDaysOf(iso) {
    try {
      if (!iso) return null;
      var t = Date.parse(iso);
      if (!isFinite(t)) return null;
      return Math.floor((Date.now() - t) / 86400000);
    } catch (e) { return null; }
  }
  function fmtValue(field, v) {
    if (v === null || v === undefined || v === '') return '';
    var unit = FIELD_UNITS[field] || '';
    return isNum(v) ? (String(v) + unit) : (str(v) + unit);
  }

  // ── Evidence索引 ─────────────────────────────────────────────
  function indexEvidence(ctx) {
    var map = {};
    var list = (ctx && Array.isArray(ctx.evidence)) ? ctx.evidence : [];
    for (var i = 0; i < list.length; i++) {
      var e = list[i];
      if (e && e.evidenceId) map[e.evidenceId] = e;
    }
    return map;
  }

  // フィールドを裏付けるEvidenceを返す（無ければnull）
  function findFieldEvidence(mod, field, evIndex) {
    try {
      var fe = (mod && isPlainObject(mod.fieldEvidence)) ? mod.fieldEvidence[field] : null;
      if (!Array.isArray(fe)) return null;
      for (var i = 0; i < fe.length; i++) {
        var ev = evIndex[fe[i]];
        if (ev) return ev;
      }
      return null;
    } catch (e) { return null; }
  }

  function isFactEvidence(ev) {
    return !!(ev && FACT_EVIDENCE_TYPES.indexOf(ev.evidenceType) !== -1);
  }

  // ── caseId guard ─────────────────────────────────────────────
  //   モジュール側caseIdが現在案件と異なる場合は採用しない（別案件の値を混ぜない）。
  function moduleCaseMatches(mod, caseId) {
    if (!isPlainObject(mod)) return false;
    if (mod.caseId === undefined || mod.caseId === null || mod.caseId === '') return true;  // 旧データはtop-level判定に委ねる
    return String(mod.caseId) === String(caseId);
  }

  function moduleHasData(mod) {
    if (!isPlainObject(mod)) return false;
    if (mod.confidence !== null && mod.confidence !== undefined) return true;
    if (isPlainObject(mod.derived) && typeof mod.derived.status === 'string' && mod.derived.status !== 'insufficient') return true;
    if (isPlainObject(mod.inputs)) {
      var ks = Object.keys(mod.inputs);
      for (var i = 0; i < ks.length; i++) { if (mod.inputs[ks[i]] !== null && mod.inputs[ks[i]] !== undefined) return true; }
    }
    if (Array.isArray(mod.candidates) && mod.candidates.length > 0) return true;
    if (Array.isArray(mod.productIdentifiers) && mod.productIdentifiers.length > 0) return true;
    return false;
  }

  // ── カテゴリ1件を Fact / Prediction / Unknown / Evidence へ分解 ─────
  function collectFromModule(category, mod, evIndex, acc) {
    var updatedAt = str(mod.updatedAt);
    var age = ageDaysOf(updatedAt);
    var stale = (age !== null && age > STALE_DAYS);

    // ① 識別情報（保存済みの実レコード＝Fact扱いしてよい範囲）
    if (category === 'product') {
      if (str(mod.productName)) acc.facts.push({ category: category, label: '商品名', value: str(mod.productName), source: '保存済みAffiliate評価', reliability: 'recorded', observedAt: updatedAt, stale: stale });
      if (str(mod.aspName)) acc.facts.push({ category: category, label: 'ASP名', value: str(mod.aspName), source: '保存済みAffiliate評価', reliability: 'recorded', observedAt: updatedAt, stale: stale });
      if (str(mod.market)) acc.facts.push({ category: category, label: '市場', value: str(mod.market), source: '保存済みAffiliate評価', reliability: 'recorded', observedAt: updatedAt, stale: stale });
      if (str(mod.productStatus)) acc.facts.push({ category: category, label: '案件状態', value: str(mod.productStatus), source: '保存済みAffiliate評価', reliability: 'recorded', observedAt: updatedAt, stale: stale });
    }
    if (category === 'asp') {
      if (str(mod.recommendedAspName)) {
        acc.predictions.push({ category: category, label: '推奨ASP', value: str(mod.recommendedAspName), basis: '既存の想定利益比較（' + (isNum(mod.comparedAspCount) ? mod.comparedAspCount : 0) + '件比較・新規算出なし）' });
      }
      var cands = Array.isArray(mod.candidates) ? mod.candidates : [];
      for (var ci = 0; ci < cands.length && ci < LIMITS.maxItemsPerSection; ci++) {
        var cd = cands[ci];
        if (cd && str(cd.aspName)) {
          acc.facts.push({ category: category, label: 'ASP候補', value: str(cd.aspName), source: '保存済みActive評価', reliability: 'recorded', observedAt: updatedAt, stale: stale });
        }
      }
    }
    if (category === 'market') {
      if (isNum(mod.derived && mod.derived.productCount)) {
        acc.facts.push({ category: category, label: '同一市場の登録候補商材数', value: mod.derived.productCount + '件', source: '案件内集約（自社候補件数。市場規模ではありません）', reliability: 'recorded', observedAt: updatedAt, stale: stale });
      }
      var seas = (mod.derived && Array.isArray(mod.derived.seasonalityValues)) ? mod.derived.seasonalityValues : [];
      if (seas.length > 0) acc.facts.push({ category: category, label: '季節性', value: seas.slice(0, 3).join('・'), source: '保存済みAffiliate評価', reliability: 'recorded', observedAt: updatedAt, stale: stale });
    }

    // ② 入力フィールド（Evidenceの型で Fact / Prediction を決定する）
    var inputFields = CATEGORY_INPUT_FIELDS[category] || [];
    for (var i = 0; i < inputFields.length; i++) {
      var f = inputFields[i];
      var v = (isPlainObject(mod.inputs)) ? mod.inputs[f] : undefined;
      var label = FIELD_LABELS[f] || f;
      if (v === null || v === undefined || v === '') {
        acc.unknowns.push({ category: category, label: label, reason: '既存Intelligenceに値がありません' });
        continue;
      }
      var ev = findFieldEvidence(mod, f, evIndex);
      var forcedPrediction = ALWAYS_PREDICTION_FIELDS.indexOf(f) !== -1;
      if (!forcedPrediction && isFactEvidence(ev)) {
        acc.facts.push({
          category: category, label: label, value: fmtValue(f, v),
          source: str(ev.sourceName) || ev.evidenceType, reliability: str(ev.reliability) || 'unknown',
          observedAt: str(ev.observedAt) || str(ev.recordedAt) || updatedAt,
          evidenceId: str(ev.evidenceId), stale: stale,
        });
      } else {
        // Evidenceが無い数値・派生Evidenceの数値・予測名の項目は、必ずPrediction（Fact扱いしない）
        acc.predictions.push({
          category: category, label: label, value: fmtValue(f, v),
          basis: forcedPrediction ? '予測値（既存Intelligenceの保存値）'
            : (ev ? ('派生値（' + str(ev.evidenceType) + '）') : '裏付けEvidenceなし（値のみ保存）'),
        });
      }
    }

    // ③ 派生フィールド（計算値＝常にPrediction）
    var derivedFields = CATEGORY_DERIVED_FIELDS[category] || [];
    for (var d = 0; d < derivedFields.length; d++) {
      var df = derivedFields[d];
      var dv = (isPlainObject(mod.derived)) ? mod.derived[df] : undefined;
      if (dv === null || dv === undefined) continue;
      acc.predictions.push({ category: category, label: FIELD_LABELS[df] || df, value: fmtValue(df, dv), basis: '既存Intelligenceの計算値（実測値ではありません）' });
    }

    // ④ Evidence一覧・Confidence
    var used = Array.isArray(mod.usedEvidenceIds) ? mod.usedEvidenceIds : [];
    for (var u = 0; u < used.length; u++) {
      var uev = evIndex[used[u]];
      if (!uev) continue;
      acc.evidence.push({
        category: category, evidenceId: str(uev.evidenceId), type: str(uev.evidenceType),
        sourceName: str(uev.sourceName), reliability: str(uev.reliability) || 'unknown',
        observedAt: str(uev.observedAt) || str(uev.recordedAt),
        derived: DERIVED_EVIDENCE_TYPES.indexOf(uev.evidenceType) !== -1,
      });
    }

    var conf = isPlainObject(mod.confidence) ? mod.confidence : null;
    acc.sourceSummary[category] = {
      present: true,
      label: CATEGORY_LABELS[category] || category,
      status: (isPlainObject(mod.derived) && str(mod.derived.status)) || 'insufficient',
      confidenceLevel: conf ? str(conf.confidenceLevel) : 'Insufficient',
      confidenceScore: (conf && isNum(conf.confidenceScore)) ? conf.confidenceScore : null,
      independentEvidenceCount: (conf && isNum(conf.independentEvidenceCount)) ? conf.independentEvidenceCount : 0,
      knownFactors: (conf && isNum(conf.knownFactors)) ? conf.knownFactors : null,
      unknownFactors: (conf && isNum(conf.unknownFactors)) ? conf.unknownFactors : null,
      updatedAt: updatedAt, ageDays: age, stale: stale,
    };
    if (stale) acc.staleCategories.push(category);
  }

  // ── 公開API① Intelligence Contextの集約 ─────────────────────────
  //   intelligenceContext: outputDraft.fields.intelligenceContext（読み取り専用）
  //   options: { caseId }（必須相当。未一致・欠損時は available:false を返す）
  function buildIadpIntelligenceContext(intelligenceContext, options) {
    var acc = {
      version: BUILDER_VERSION, available: false, caseId: null, caseIdMatched: false,
      facts: [], evidence: [], predictions: [], unknowns: [],
      sourceSummary: {}, staleCategories: [], stale: false,
      counts: { facts: 0, evidence: 0, predictions: 0, unknowns: 0 },
      categories: [], reason: null,
    };
    try {
      var opts = isPlainObject(options) ? options : {};
      var caseId = (opts.caseId !== undefined && opts.caseId !== null) ? String(opts.caseId) : null;
      var ctx = intelligenceContext;

      if (!isPlainObject(ctx)) { acc.reason = 'no_intelligence_context'; return acc; }
      acc.caseId = str(ctx.caseId) || null;

      // Cross-case guard: 現在案件と一致しないIntelligenceは一切採用しない
      if (!caseId) { acc.reason = 'no_case_id'; return acc; }
      if (acc.caseId && acc.caseId !== caseId) { acc.reason = 'case_id_mismatch'; return acc; }
      acc.caseIdMatched = true;

      var evIndex = indexEvidence(ctx);
      for (var i = 0; i < INTEL_CATEGORIES.length; i++) {
        var cat = INTEL_CATEGORIES[i];
        var mod = ctx[cat];
        if (!moduleHasData(mod)) continue;
        if (!moduleCaseMatches(mod, caseId)) continue;   // モジュール単位のCross-case guard
        acc.categories.push(cat);
        collectFromModule(cat, mod, evIndex, acc);
      }

      // 外部確認が必要な実数値（Factとして取得できていないものだけUnknownへ）
      var factLabels = {};
      for (var fi = 0; fi < acc.facts.length; fi++) factLabels[acc.facts[fi].label] = true;
      for (var ei = 0; ei < EXTERNAL_UNKNOWNS.length; ei++) {
        var ex = EXTERNAL_UNKNOWNS[ei];
        var baseLabel = FIELD_LABELS[ex.key];
        if (baseLabel && factLabels[baseLabel]) continue;   // 実測Factがあるなら重複させない
        acc.unknowns.push({ category: 'external', label: ex.label, reason: ex.reason });
      }

      // Unknown重複除去（複数カテゴリで同じ項目が空のことがあるため）
      var seenUnknown = {}, uniqUnknowns = [];
      for (var ui = 0; ui < acc.unknowns.length; ui++) {
        var key = acc.unknowns[ui].label;
        if (seenUnknown[key]) continue;
        seenUnknown[key] = true;
        uniqUnknowns.push(acc.unknowns[ui]);
      }
      acc.unknowns = uniqUnknowns;

      acc.available = acc.categories.length > 0;
      acc.stale = acc.staleCategories.length > 0;
      acc.counts = {
        facts: acc.facts.length, evidence: acc.evidence.length,
        predictions: acc.predictions.length, unknowns: acc.unknowns.length,
      };
      if (!acc.available) acc.reason = 'no_saved_intelligence';
      return acc;
    } catch (e) {
      // fail-open: 空Contextを返す（Self-Completionを止めない・逆質問へ戻さない）
      acc.available = false;
      acc.reason = 'builder_exception';
      return acc;
    }
  }

  // ── 公開API② 担当別テキストブロックの生成 ─────────────────────
  //   context: buildIadpIntelligenceContext() の戻り値
  //   agentId: researcher / analyst / branding / sns（それ以外は必ず空文字列）
  //   戻り値が空文字列のとき、呼び出し側は既存の指示文をそのまま使う（＝完全に非干渉）。
  function buildAgentIntelligenceBlock(context, agentId, options) {
    try {
      if (!isPlainObject(context) || context.available !== true) return '';
      if (IADP_AGENT_IDS.indexOf(agentId) === -1) return '';     // IADP非対象agentへは注入しない
      var lim = isPlainObject(options) && isPlainObject(options.limits) ? options.limits : LIMITS;
      var cats = AGENT_CATEGORIES[agentId] || [];
      function inScope(item) { return cats.indexOf(item.category) !== -1 || item.category === 'external'; }

      function section(title, items, render) {
        var picked = items.filter(inScope);
        if (picked.length === 0) return null;
        var over = Math.max(0, picked.length - lim.maxItemsPerSection);
        var lines = picked.slice(0, lim.maxItemsPerSection).map(function (it) { return '・' + clip(render(it), lim.maxItemChars); });
        if (over > 0) lines.push('・（ほか' + over + '件は省略）');
        return [title].concat(lines).join('\n');
      }

      // stale は項目ごとに繰り返さず Confidence セクションでカテゴリ単位に1回だけ示す（Token節約・可読性）
      var factSec = section('■ Fact（保存済み実データ。事実として扱ってよい）', context.facts, function (f) {
        return f.label + '：' + f.value
          + '（出典：' + (f.source || '不明') + (f.reliability ? ' / 信頼度：' + f.reliability : '') + '）';
      });
      var predSec = section('■ Prediction（予測値。事実として断定しない）', context.predictions, function (p) {
        return p.label + '：' + p.value + '（根拠：' + (p.basis || '予測') + '）';
      });
      var unkSec = section('■ Unknown（未取得。推測で埋めず「外部確認待ち」と明示する）', context.unknowns, function (u) {
        return u.label + '（' + (u.reason || '未取得') + '）';
      });

      // Evidence一覧は件数と代表のみ（全文投入しない）
      var evPicked = context.evidence.filter(inScope);
      var evSec = null;
      if (evPicked.length > 0) {
        var evLines = evPicked.slice(0, lim.maxEvidenceItems).map(function (e) {
          return '・' + clip((e.sourceName || e.type) + '（種別：' + e.type + ' / 信頼度：' + e.reliability + (e.derived ? ' / 派生' : '') + '）', lim.maxItemChars);
        });
        if (evPicked.length > lim.maxEvidenceItems) evLines.push('・（ほか' + (evPicked.length - lim.maxEvidenceItems) + '件）');
        evSec = ['■ Evidence（' + evPicked.length + '件）'].concat(evLines).join('\n');
      }

      // Confidence（信頼度は削除せず明示する）
      var confLines = [];
      for (var i = 0; i < cats.length; i++) {
        var s = context.sourceSummary[cats[i]];
        if (!s || !s.present) continue;
        confLines.push('・' + s.label + '：Confidence ' + s.confidenceLevel
          + (s.confidenceScore !== null ? '（' + s.confidenceScore + '点' : '（')
          + ' / 独立Evidence ' + s.independentEvidenceCount + '件'
          + (s.stale ? ' / stale：' + s.ageDays + '日前' : '') + '）');
      }
      var confSec = confLines.length > 0 ? ['■ Confidence（根拠の充足度。不足していても値は削除していません）'].concat(confLines).join('\n') : null;

      // 重要度順に並べる（末尾が切り詰められた場合に失われるのは詳細度の低いEvidence一覧になるようにする）
      var sections = [factSec, predSec, unkSec, confSec, evSec].filter(Boolean);
      if (sections.length === 0) return '';

      var header = [
        '【AI会社が既に保有するIntelligence（実データ。今回新たに調査した結果ではありません）】',
        '以下は現在の案件に保存されている既存Intelligenceです。Fact / Prediction / Unknown を混同しないでください。',
        '判断材料の優先順位：①Fact・Evidence ②保存済みIntelligence ③過去の観測データ ④Prediction ⑤あなたのAI仮説。',
        'Factを無視して一般論で上書きしないでください。逆に、Predictionや裏付けのない値を事実として断定しないでください。',
        'この情報が不足していても質問だけで停止せず、AI仮説として補って成果物を完成させてください。',
      ].join('\n');

      var block = header + '\n' + sections.join('\n');
      if (block.length > lim.maxBlockChars) {
        // 行の途中で切らない（文が途切れて誤読されるのを防ぐ）
        var kept = [];
        var used = 0;
        var allLines = block.split('\n');
        for (var li = 0; li < allLines.length; li++) {
          if (used + allLines[li].length + 1 > lim.maxBlockChars) break;
          kept.push(allLines[li]);
          used += allLines[li].length + 1;
        }
        block = kept.join('\n') + '\n…（Token制御のため以降は省略）';
      }
      return block;
    } catch (e) {
      return ''; // fail-open: 注入せず既存指示文のまま
    }
  }

  // ── 公開API③ 保存用の参照元メタデータ（Context本体は保存しない） ─────
  //   IADPのgenerationContextへ「どのIntelligenceを参照したか」だけを最小限残す。
  function buildIntelligenceSourceMeta(context) {
    try {
      if (!isPlainObject(context) || context.available !== true) {
        return { available: false, categories: [], counts: { facts: 0, evidence: 0, predictions: 0, unknowns: 0 }, stale: false, reason: (context && context.reason) || null };
      }
      var conf = {};
      for (var i = 0; i < context.categories.length; i++) {
        var c = context.categories[i];
        var s = context.sourceSummary[c];
        if (s) conf[c] = { confidenceLevel: s.confidenceLevel, independentEvidenceCount: s.independentEvidenceCount, stale: !!s.stale };
      }
      return {
        available: true, version: BUILDER_VERSION, caseId: context.caseId,
        categories: context.categories.slice(), counts: context.counts,
        stale: !!context.stale, staleCategories: context.staleCategories.slice(),
        confidenceByCategory: conf,
      };
    } catch (e) {
      return { available: false, categories: [], counts: { facts: 0, evidence: 0, predictions: 0, unknowns: 0 }, stale: false, reason: 'meta_exception' };
    }
  }

  return {
    version: BUILDER_VERSION,
    INTEL_CATEGORIES: INTEL_CATEGORIES.slice(),
    IADP_AGENT_IDS: IADP_AGENT_IDS.slice(),
    AGENT_CATEGORIES: AGENT_CATEGORIES,
    FACT_EVIDENCE_TYPES: FACT_EVIDENCE_TYPES.slice(),
    DERIVED_EVIDENCE_TYPES: DERIVED_EVIDENCE_TYPES.slice(),
    ALWAYS_PREDICTION_FIELDS: ALWAYS_PREDICTION_FIELDS.slice(),
    LIMITS: LIMITS,
    STALE_DAYS: STALE_DAYS,

    buildIadpIntelligenceContext: buildIadpIntelligenceContext,
    buildAgentIntelligenceBlock: buildAgentIntelligenceBlock,
    buildIntelligenceSourceMeta: buildIntelligenceSourceMeta,
  };
});
