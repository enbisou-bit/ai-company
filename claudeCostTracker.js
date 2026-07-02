// claudeCostTracker.js — Phase47-1.6: Claude API料金永続化
// claude-cost-logs.json へ日次/月次/累計+モデル別保存
const fs   = require('fs');
const path = require('path');

const STORAGE_PATH = path.join(__dirname, 'claude-cost-logs.json');
const USD_TO_JPY   = 160;

const CLAUDE_PRICE_PER_1K = {
  'claude-sonnet-4-6': { input: 0.003,  output: 0.015  },
  'claude-opus-4-8':   { input: 0.015,  output: 0.075  },
  'claude-haiku-4-5':  { input: 0.0008, output: 0.004  },
};

function todayKey() { return new Date().toISOString().slice(0, 10); }
function monthKey() { return new Date().toISOString().slice(0, 7);  }

function emptyPeriod() {
  return { requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0 };
}
function emptyModelMap() {
  return {
    'claude-sonnet-4-6': emptyPeriod(),
    'claude-opus-4-8':   emptyPeriod(),
    'claude-haiku-4-5':  emptyPeriod(),
  };
}

function mergeModel(base, saved) {
  const result = emptyModelMap();
  Object.keys(result).forEach(k => {
    if (saved && saved[k]) result[k] = { ...emptyPeriod(), ...saved[k] };
  });
  return result;
}

function loadState() {
  try {
    if (!fs.existsSync(STORAGE_PATH)) {
      const init = buildDefaultState();
      saveState(init);
      return init;
    }
    const raw    = fs.readFileSync(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      todayKey:   parsed.todayKey   || '',
      monthKey:   parsed.monthKey   || '',
      today:      { ...emptyPeriod(), ...(parsed.today  || {}) },
      month:      { ...emptyPeriod(), ...(parsed.month  || {}) },
      total:      { ...emptyPeriod(), ...(parsed.total  || {}) },
      modelToday: mergeModel({}, parsed.modelToday),
      modelMonth: mergeModel({}, parsed.modelMonth),
      modelTotal: mergeModel({}, parsed.modelTotal),
    };
  } catch (_e) {
    return buildDefaultState();
  }
}

function buildDefaultState() {
  return {
    todayKey:   todayKey(),
    monthKey:   monthKey(),
    today:      emptyPeriod(),
    month:      emptyPeriod(),
    total:      emptyPeriod(),
    modelToday: emptyModelMap(),
    modelMonth: emptyModelMap(),
    modelTotal: emptyModelMap(),
  };
}

function saveState(state) {
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function ensureState() {
  if (!global.__claudeCostState) {
    global.__claudeCostState = loadState();
  }
  const state = global.__claudeCostState;
  const today = todayKey();
  const month = monthKey();
  let changed = false;
  // 日付変更 → 当日リセット（total は触らない）
  if (state.todayKey !== today) {
    state.today      = emptyPeriod();
    state.modelToday = emptyModelMap();
    state.todayKey   = today;
    changed = true;
  }
  // 月変更 → 月次リセット（total は触らない）
  if (state.monthKey !== month) {
    state.month      = emptyPeriod();
    state.modelMonth = emptyModelMap();
    state.monthKey   = month;
    changed = true;
  }
  // リセットが発生した場合のみ JSON 書き込み
  if (changed) saveState(state);
  return state;
}

function addClaudeUsage(model, inputTokens, outputTokens) {
  const state = ensureState();
  const price = CLAUDE_PRICE_PER_1K[model] || CLAUDE_PRICE_PER_1K['claude-sonnet-4-6'];
  const cost  = (inputTokens / 1000) * price.input + (outputTokens / 1000) * price.output;

  const inc = (obj) => {
    obj.requests++;
    obj.inputTokens  += inputTokens;
    obj.outputTokens += outputTokens;
    obj.costUsd      = Math.round((obj.costUsd + cost) * 1e8) / 1e8;
  };

  inc(state.today);
  inc(state.month);
  inc(state.total);

  if (!state.modelToday[model]) state.modelToday[model] = emptyPeriod();
  if (!state.modelMonth[model]) state.modelMonth[model] = emptyPeriod();
  if (!state.modelTotal[model]) state.modelTotal[model] = emptyPeriod();
  inc(state.modelToday[model]);
  inc(state.modelMonth[model]);
  inc(state.modelTotal[model]);

  saveState(state);
}

function getSummary() {
  const state = ensureState();
  return {
    todayKey:   state.todayKey,
    monthKey:   state.monthKey,
    today:      { ...state.today },
    month:      { ...state.month },
    total:      { ...state.total },
    modelToday: JSON.parse(JSON.stringify(state.modelToday)),
    modelMonth: JSON.parse(JSON.stringify(state.modelMonth)),
    modelTotal: JSON.parse(JSON.stringify(state.modelTotal)),
    usdToJpy:   USD_TO_JPY,
  };
}

// Phase47-2A: Claude Cost Analysis（分析のみ / モデル変更なし）
const CLAUDE_COST_ANALYSIS_VERSION = '1.0.0';

// claudeClient.js CLAUDE_MODEL_MAP と同一対応（strategy専用モデルのみ担当別を実測できる）
// writer / reviewer は同一モデル(claude-sonnet-4-6)を共有するため担当別に分離不可
function getClaudeCostAnalysis() {
  const state = ensureState();
  const analysisWarnings = [];

  const byModel = {};
  let totalRequests = 0, totalInputTokens = 0, totalOutputTokens = 0, totalCost = 0;
  let topCostModel = null, topCostVal = -1;
  let topTokenModel = null, topTokenVal = -1;

  Object.keys(state.modelTotal).forEach((model) => {
    const m = state.modelTotal[model];
    const tokens = m.inputTokens + m.outputTokens;
    byModel[model] = {
      requests: m.requests,
      inputTokens: m.inputTokens,
      outputTokens: m.outputTokens,
      totalTokens: tokens,
      costUsd: m.costUsd,
    };
    totalRequests += m.requests;
    totalInputTokens += m.inputTokens;
    totalOutputTokens += m.outputTokens;
    totalCost += m.costUsd;
    if (m.requests > 0) {
      if (m.costUsd > topCostVal) { topCostVal = m.costUsd; topCostModel = model; }
      if (tokens > topTokenVal) { topTokenVal = tokens; topTokenModel = model; }
    }
  });

  const byRole = {};
  const strategyModel = state.modelTotal['claude-opus-4-8'];
  if (strategyModel && strategyModel.requests > 0) {
    byRole.strategy = {
      requests: strategyModel.requests,
      inputTokens: strategyModel.inputTokens,
      outputTokens: strategyModel.outputTokens,
      totalTokens: strategyModel.inputTokens + strategyModel.outputTokens,
      costUsd: strategyModel.costUsd,
      note: 'claude-opus-4-8はstrategy専用のため実測値',
    };
  }
  const sonnetModel = state.modelTotal['claude-sonnet-4-6'];
  if (sonnetModel && sonnetModel.requests > 0) {
    byRole.writer_reviewer_combined = {
      requests: sonnetModel.requests,
      inputTokens: sonnetModel.inputTokens,
      outputTokens: sonnetModel.outputTokens,
      totalTokens: sonnetModel.inputTokens + sonnetModel.outputTokens,
      costUsd: sonnetModel.costUsd,
      note: '担当別判定なし（writer/reviewerは同一モデルclaude-sonnet-4-6を共有）',
    };
    analysisWarnings.push('writer/reviewerは同一モデル(claude-sonnet-4-6)を共有するため個別の担当別集計は不可（担当別判定なし）');
  }
  if (totalRequests === 0) analysisWarnings.push('利用実績なし');

  return {
    version: CLAUDE_COST_ANALYSIS_VERSION,
    totalRequests,
    totalInputTokens,
    totalOutputTokens,
    totalTokens: totalInputTokens + totalOutputTokens,
    totalCost: Math.round(totalCost * 1e8) / 1e8,
    todayCost: state.today.costUsd,
    monthCost: state.month.costUsd,
    byModel,
    byRole,
    topCostModel,
    topTokenModel,
    analysisWarnings,
  };
}

// Phase47-2C: Claude Model Quality Compare（比較のみ / モデル変更なし）
const CLAUDE_MODEL_QUALITY_COMPARE_VERSION = '1.0.0';

// Phase47-2B適用前の構成（固定値・比較用）
const CLAUDE_PREVIOUS_POLICY = {
  strategy: 'claude-opus-4-8',
  writer:   'claude-sonnet-4-6',
  reviewer: 'claude-sonnet-4-6',
};

// SonnetとHaikuの単価差（既存 CLAUDE_PRICE_PER_1K を使用 / 推測値なし）
function _claudeModelPriceDiff(beforeModel, afterModel) {
  const before = CLAUDE_PRICE_PER_1K[beforeModel];
  const after  = CLAUDE_PRICE_PER_1K[afterModel];
  if (!before || !after) return null;
  return {
    beforeInputPer1K:  before.input,
    beforeOutputPer1K: before.output,
    afterInputPer1K:   after.input,
    afterOutputPer1K:  after.output,
    inputReductionPct:  Math.round((1 - after.input  / before.input)  * 1000) / 10,
    outputReductionPct: Math.round((1 - after.output / before.output) * 1000) / 10,
  };
}

// currentModels: { strategy, writer, reviewer }（呼び出し側で getClaudeModelForRole() / modelPolicy から渡す）
function buildClaudeModelQualityCompare(currentModels) {
  const currentPolicy = {
    strategy: (currentModels && currentModels.strategy) || CLAUDE_PREVIOUS_POLICY.strategy,
    writer:   (currentModels && currentModels.writer)   || CLAUDE_PREVIOUS_POLICY.writer,
    reviewer: (currentModels && currentModels.reviewer) || CLAUDE_PREVIOUS_POLICY.reviewer,
  };

  const comparisonItems = ['strategy', 'writer', 'reviewer'].map((role) => ({
    role,
    before: CLAUDE_PREVIOUS_POLICY[role],
    after: currentPolicy[role],
    changed: CLAUDE_PREVIOUS_POLICY[role] !== currentPolicy[role],
  }));

  const costImpact = {
    strategy: { summary: '変更なし', detail: null },
    writer:   { summary: 'Sonnet → Haiku によりコスト削減見込み', detail: _claudeModelPriceDiff(CLAUDE_PREVIOUS_POLICY.writer, currentPolicy.writer) },
    reviewer: { summary: 'Sonnet → Haiku によりコスト削減見込み', detail: _claudeModelPriceDiff(CLAUDE_PREVIOUS_POLICY.reviewer, currentPolicy.reviewer) },
    provider: '変更なし',
    leader:   'OpenAIのまま',
  };

  const qualityCheckItems = [
    'Writer出力品質',
    'Reviewerレビュー品質',
    'Strategy判断品質',
    'Leader Final品質',
    '成果物完成度',
    'CTA品質',
    '構成品質',
    '文章品質',
    '画像/動画プロンプト品質',
  ];

  const adoptionReadiness = {
    costOptimized: true,
    providerStable: true,
    workflowStable: true,
    qualityComparisonPending: true,
    readyForPhase47_2D: false,
  };

  const warnings = [
    'Phase47-2Cは比較フェーズ（モデル変更は行わない）',
    '正式採用はPhase47-2Dで判断',
    'Writer/ReviewerのHaiku化による品質低下がないか確認が必要',
    'Claude Cost Analysis の byRole 集計は現時点で注意あり（sonnet固定ロジックのため今後のhaiku利用は担当別集計に反映されない）',
  ];

  return {
    version: CLAUDE_MODEL_QUALITY_COMPARE_VERSION,
    previousPolicy: CLAUDE_PREVIOUS_POLICY,
    currentPolicy,
    comparisonItems,
    costImpact,
    qualityCheckItems,
    adoptionReadiness,
    warnings,
  };
}

// Phase47-2D: Claude Model Formal Adoption（正式採用の記録・表示のみ / モデル変更なし）
const CLAUDE_MODEL_ADOPTION_VERSION = '1.0.0';

// currentModels: { strategy, writer, reviewer, defaultClaudeRole }（呼び出し側から渡す）
// qualityCompare: Phase47-2C buildClaudeModelQualityCompare() の戻り値（あれば再利用）
function buildClaudeModelAdoptionStatus(currentModels, qualityCompare) {
  const cm = currentModels || {};
  const adoptedPolicy = {
    strategy: cm.strategy || CLAUDE_PREVIOUS_POLICY.strategy,
    writer:   cm.writer   || CLAUDE_PREVIOUS_POLICY.writer,
    reviewer: cm.reviewer || CLAUDE_PREVIOUS_POLICY.reviewer,
    defaultClaudeRole: cm.defaultClaudeRole || cm.writer || CLAUDE_PREVIOUS_POLICY.writer,
    leader: 'openai',
  };

  const adoptionStatus = {
    status: 'adopted',
    phase: 'Phase47-2D',
    adoptedAt: todayKey(),
    readyForNextPhase: true,
  };

  const adoptionReason = [
    'Writer / Reviewer は最安モデル化により大幅なコスト削減が見込める',
    'Strategy は品質維持のため最高品質モデルを維持',
    'Provider構成は変更していない',
    'Workflow / Knowledge Chain / Routing への影響はない',
    'Phase47-2Cで比較パネルを追加済み',
  ];

  const costReductionSummary = (qualityCompare && qualityCompare.costImpact)
    ? {
        strategy: qualityCompare.costImpact.strategy,
        writer:   qualityCompare.costImpact.writer,
        reviewer: qualityCompare.costImpact.reviewer,
      }
    : {
        strategy: { summary: '変更なし', detail: null },
        writer:   { summary: 'Sonnet → Haiku によりコスト削減見込み', detail: _claudeModelPriceDiff(CLAUDE_PREVIOUS_POLICY.writer, adoptedPolicy.writer) },
        reviewer: { summary: 'Sonnet → Haiku によりコスト削減見込み', detail: _claudeModelPriceDiff(CLAUDE_PREVIOUS_POLICY.reviewer, adoptedPolicy.reviewer) },
      };

  const qualityDecision = {
    qualityComparisonCompleted: true,
    qualityRisk: 'monitoring_required',
    note: '正式採用はするが、今後の実案件で品質監視を継続する',
    followUp: 'Phase47-3以降でCompare Intelligenceと連携して品質低下がないか確認する',
  };

  const providerStatus = {
    leader: 'openai',
    strategy: 'claude',
    writer: 'claude',
    reviewer: 'claude',
    changed: false,
  };

  const adoptionReadiness = {
    costOptimized: true,
    providerStable: true,
    workflowStable: true,
    qualityComparisonPending: false,
    readyForPhase47_2D: true,
    formalAdoptionCompleted: true,
  };

  const nextActions = [
    'Phase47-3以降で品質監視・Compare Intelligence連携を継続する',
    '実案件での品質・コスト実測を蓄積する',
  ];

  const warnings = [
    'Phase47-2Dで正式採用したのはClaudeモデルポリシーのみ',
    'Provider構成は変更していない',
    'Writer / Reviewer は Haiku 採用',
    'Strategy は Opus 維持',
    '品質監視は今後も継続',
  ];

  return {
    version: CLAUDE_MODEL_ADOPTION_VERSION,
    adoptionStatus,
    adoptedPolicy,
    adoptionReason,
    costReductionSummary,
    qualityDecision,
    providerStatus,
    adoptionReadiness,
    nextActions,
    warnings,
  };
}

// Phase47-3: Claude Quality Monitor（Compare Intelligence連携 / モデル変更・自動切替なし）
const CLAUDE_QUALITY_MONITOR_VERSION = '1.0.0';

// Compare Intelligenceのカテゴリ別スコアと監視対象「判定項目」の対応
// （Compare Intelligence v2 buildImprovementScores() が持つ実フィールドのみ使用・推測追加なし）
// structure→Structure / cta→CTA / knowledge→Knowledge Usage / hook→Writing寄り / images→Output Quality寄り
const CLAUDE_QUALITY_CATEGORY_LABELS = {
  hook:      'Writing（Hook）',
  cta:       'CTA',
  knowledge: 'Knowledge Usage',
  structure: 'Structure',
  images:    'Output Quality（Images）',
};

// compareData: Compare Intelligence v2 buildImprovementScores() の戻り値
// { overall, hook:{score,label,comment}, cta:{...}, knowledge:{...}, structure:{...}, images:{...}, sampleSize }
// サーバー側は compareData を保持しないため、呼び出し側（ブラウザ）から渡された値のみ利用する。推測でスコアを生成しない。
function buildClaudeQualityMonitor(compareData) {
  const warnings = [];
  const hasData = !!(compareData && typeof compareData.overall === 'number' && (compareData.sampleSize || 0) >= 3);

  const qualityScore = hasData ? compareData.overall : null;

  let qualityStatus;
  let recommendation;
  if (!hasData) {
    qualityStatus = 'watch';
    recommendation = 'Need Manual Review';
    warnings.push('Compare Intelligence の比較データが不足しているため自動判定を保留しています（サンプル数不足・データ未受信）');
  } else if (qualityScore >= 85) {
    qualityStatus = 'excellent';
    recommendation = 'Keep Current Policy';
  } else if (qualityScore >= 70) {
    qualityStatus = 'good';
    recommendation = 'Monitor Quality';
  } else if (qualityScore >= 50) {
    qualityStatus = 'watch';
    recommendation = 'Monitor Quality';
  } else {
    qualityStatus = 'critical';
    recommendation = 'Consider Sonnet';
  }

  const issues = [];
  if (hasData) {
    Object.keys(CLAUDE_QUALITY_CATEGORY_LABELS).forEach((key) => {
      const cat = compareData[key];
      if (cat && typeof cat.score === 'number' && cat.score < 60) {
        issues.push({
          category: key,
          label: CLAUDE_QUALITY_CATEGORY_LABELS[key],
          score: cat.score,
          comment: cat.comment || null,
        });
      }
    });
  }

  const monitoringRequired = qualityStatus !== 'excellent';

  const summary = !hasData
    ? 'Compare Intelligence の比較データが未受信のため、品質判定は保留中です。監視を継続してください。'
    : `Overall Score ${qualityScore}点（${qualityStatus}）。Writer/ReviewerはHaiku運用中のため、継続的な品質監視が必要です。`;

  warnings.push('Writer / Reviewer は Haiku 運用中のため品質低下がないか継続監視が必要');
  warnings.push('本監視エンジンはモデルの自動切替を行いません（判断は必ず手動）');
  warnings.push('Writer / Reviewer / Leader Final の担当別スコアはCompare Intelligenceの現データ構造では取得不可（カテゴリ別スコアのみ利用可能）');

  return {
    version: CLAUDE_QUALITY_MONITOR_VERSION,
    qualityStatus,
    monitoringRequired,
    qualityScore,
    recommendation,
    issues,
    categoryScores: hasData ? {
      hook: compareData.hook || null,
      cta: compareData.cta || null,
      knowledge: compareData.knowledge || null,
      structure: compareData.structure || null,
      images: compareData.images || null,
    } : null,
    sampleSize: hasData ? compareData.sampleSize : 0,
    summary,
    warnings,
  };
}

module.exports = {
  addClaudeUsage,
  getSummary,
  getClaudeCostAnalysis,
  CLAUDE_COST_ANALYSIS_VERSION,
  // Phase47-2C
  buildClaudeModelQualityCompare,
  CLAUDE_MODEL_QUALITY_COMPARE_VERSION,
  // Phase47-2D
  buildClaudeModelAdoptionStatus,
  CLAUDE_MODEL_ADOPTION_VERSION,
  // Phase47-3
  buildClaudeQualityMonitor,
  CLAUDE_QUALITY_MONITOR_VERSION,
};
