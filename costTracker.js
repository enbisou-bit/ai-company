const fs = require('fs');
const path = require('path');

const STORAGE_PATH = path.join(__dirname, 'cost-logs.json');
const DEFAULT_MONTHLY_LIMIT = 1000;
const USD_TO_JPY = 160;
const MODEL_PRICES = {
  'gpt-4.1-mini': {
    input: 0.40,
    output: 1.60,
  },
  'gpt-4.1-nano': {
    input: 0.10,
    output: 0.40,
  },
  // EEA-8: developers.openai.com/api/docs/pricing で2026-08-12時点に実測確認。
  //   Short Context tier（EEA Web Searchはsearch_context_size='low'の短い単発質問のみのため該当）。
  //   Long Context tierは本レートの2倍（未使用・EEAでは発生しない想定）。
  'gpt-5.6-terra': {
    input: 2.00,
    cachedInput: 0.20,
    output: 12.00,
  },
};
// EEA-8: developers.openai.com/api/docs/pricing で2026-08-12時点に実測確認。
//   web_searchツール（Responses API）＝ $10.00 / 1,000 calls。1 call = $0.01。
//   正本はこの1定数のみ（複数箇所へハードコードしない）。
const WEB_SEARCH_TOOL_COST_PER_CALL_USD = 0.01;
// Phase47-1.6: 日付キー追加（日次・月次リセット用）
// A-2-2: JST（Asia/Tokyo, UTC+9）基準へ変更。UTC基準だと日本時間09:00に当日料金が0リセットされる不具合を解消。
//   Date.now()+9h した Date に toISOString()（UTC表記）を適用すると、JSTの壁時計の日付が得られる（外部ライブラリ不使用）。
function _jstNow()   { return new Date(Date.now() + 9 * 60 * 60 * 1000); }
function _todayKey() { return _jstNow().toISOString().slice(0, 10); } // JST の YYYY-MM-DD
function _monthKey() { return _jstNow().toISOString().slice(0, 7);  } // JST の YYYY-MM

const DEFAULT_STATE = {
  todayKey: '',
  monthKey: '',
  todayAmount: 0,
  monthlyAmount: 0,
  totalAmount: 0,
  monthlyLimit: DEFAULT_MONTHLY_LIMIT,
  stopped: false,
  byAssignee: {
    web: 0,
    snsVideo: 0,
    aiDevelopment: 0,
    estimate: 0,
  },
  byType: {
    text: 0,
    image: 0,
    video: 0,
    analysis: 0,
  },
  agentCosts: {
    web: 0,
    snsVideo: 0,
    aiDevelopment: 0,
    estimate: 0,
  },
  departmentCosts: {
    web: 0,
    snsVideo: 0,
    aiDevelopment: 0,
    estimate: 0,
  },
  breakdown: {
    byAssignee: {
      web: 0,
      snsVideo: 0,
      aiDevelopment: 0,
      estimate: 0,
    },
    byType: {
      text: 0,
      image: 0,
      video: 0,
      analysis: 0,
    },
  },
  modelCosts: {
    'gpt-4.1-mini': 0,
    'gpt-4.1-nano': 0,
  },
};

function normalizeState(state) {
  const normalizedState = {
    ...DEFAULT_STATE,
    ...state,
    todayKey:     state?.todayKey     || '',
    monthKey:     state?.monthKey     || '',
    totalAmount:  Number(state?.totalAmount)  || 0,
    byAssignee: { ...DEFAULT_STATE.byAssignee, ...(state?.byAssignee || {}) },
    byType: { ...DEFAULT_STATE.byType, ...(state?.byType || {}) },
    agentCosts: { ...DEFAULT_STATE.agentCosts, ...(state?.agentCosts || state?.byAssignee || {}) },
    departmentCosts: { ...DEFAULT_STATE.departmentCosts, ...(state?.departmentCosts || state?.byAssignee || {}) },
    breakdown: {
      byAssignee: { ...DEFAULT_STATE.breakdown.byAssignee, ...((state?.breakdown?.byAssignee) || (state?.byAssignee || {})) },
      byType: { ...DEFAULT_STATE.breakdown.byType, ...((state?.breakdown?.byType) || (state?.byType || {})) },
    },
    modelCosts: { ...DEFAULT_STATE.modelCosts, ...(state?.modelCosts || {}) },
  };

  normalizedState.byAssignee = { ...DEFAULT_STATE.byAssignee, ...(normalizedState.byAssignee || {}) };
  normalizedState.byType = { ...DEFAULT_STATE.byType, ...(normalizedState.byType || {}) };
  normalizedState.agentCosts = { ...DEFAULT_STATE.agentCosts, ...(normalizedState.agentCosts || {}) };
  normalizedState.departmentCosts = { ...DEFAULT_STATE.departmentCosts, ...(normalizedState.departmentCosts || {}) };
  normalizedState.breakdown.byAssignee = { ...DEFAULT_STATE.breakdown.byAssignee, ...(normalizedState.breakdown?.byAssignee || {}) };
  normalizedState.breakdown.byType = { ...DEFAULT_STATE.breakdown.byType, ...(normalizedState.breakdown?.byType || {}) };
  normalizedState.modelCosts = { ...DEFAULT_STATE.modelCosts, ...(normalizedState.modelCosts || {}) };

  return normalizedState;
}

function loadState() {
  try {
    if (!fs.existsSync(STORAGE_PATH)) {
      saveState(DEFAULT_STATE);
      return { ...DEFAULT_STATE };
    }

    const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return normalizeState(parsed);
  } catch (error) {
    saveState(DEFAULT_STATE);
    return { ...DEFAULT_STATE };
  }
}

function saveState(state) {
  fs.writeFileSync(STORAGE_PATH, JSON.stringify(state, null, 2), 'utf8');
}

function ensureState() {
  if (!global.__costTrackerState) {
    global.__costTrackerState = loadState();
  }
  const state = global.__costTrackerState;
  const today = _todayKey();
  const month = _monthKey();

  // Phase47-1.6: 旧フォーマット移行（todayKey未設定 = 日付追跡なし時代のデータ）
  if (!state.todayKey) {
    // 累計として保存し、当日・月次は0からリスタート
    state.totalAmount  = Number(state.monthlyAmount) || 0;
    state.todayAmount  = 0;
    state.monthlyAmount = 0;
    state.todayKey = today;
    state.monthKey = month;
    saveState(state);
  } else {
    let changed = false;
    // 日付変更 → 当日リセット（totalは触らない）
    if (state.todayKey !== today) {
      state.todayAmount = 0;
      state.todayKey    = today;
      changed = true;
    }
    // 月変更 → 月次リセット（totalは触らない）
    if (state.monthKey !== month) {
      state.monthlyAmount = 0;
      state.monthKey      = month;
      changed = true;
    }
    // リセットが発生した場合のみJSON書き込み
    if (changed) saveState(state);
  }
  return state;
}

function resetCostTracker() {
  global.__costTrackerState = normalizeState(DEFAULT_STATE);
  saveState(global.__costTrackerState);
  return global.__costTrackerState;
}

// EEA-8: cachedTokens は既存呼び出し（3引数）に対して完全後方互換の追加引数（既定0）。
//   pricing.cachedInput が定義されているモデル（gpt-5.6-terra等）でcachedTokens>0の時のみ
//   input_tokens の一部をcached単価で按分計算する。cachedInput未定義モデル（既存gpt-4.1-mini/nano）は
//   常に旧来通りinputTokens全量をpricing.inputで計算し、挙動は一切変わらない。
function calculateOpenAICost(model = '', inputTokens = 0, outputTokens = 0, cachedTokens = 0) {
  const pricing = MODEL_PRICES[model] || null;
  if (!pricing) {
    return { usd: 0, jpy: 0 };
  }

  const normalizedInputTokens = Number(inputTokens) || 0;
  const normalizedOutputTokens = Number(outputTokens) || 0;
  const normalizedCachedTokens = Math.min(Number(cachedTokens) || 0, normalizedInputTokens);

  let inputUsd;
  if (pricing.cachedInput != null && normalizedCachedTokens > 0) {
    const uncachedInputTokens = normalizedInputTokens - normalizedCachedTokens;
    inputUsd = (uncachedInputTokens / 1000000) * pricing.input
      + (normalizedCachedTokens / 1000000) * pricing.cachedInput;
  } else {
    inputUsd = (normalizedInputTokens / 1000000) * pricing.input;
  }
  const outputUsd = (normalizedOutputTokens / 1000000) * pricing.output;
  const totalUsd = inputUsd + outputUsd;

  return {
    usd: Number(totalUsd.toFixed(6)),
    jpy: Number((totalUsd * USD_TO_JPY).toFixed(2)),
  };
}

// EEA-8: Web Search tool call fee（正本定数はWEB_SEARCH_TOOL_COST_PER_CALL_USDの1箇所のみ）。
function calculateWebSearchToolFee(toolCallCount = 0) {
  const normalizedCount = Number(toolCallCount) || 0;
  if (normalizedCount <= 0) {
    return { usd: 0, jpy: 0 };
  }
  const usd = normalizedCount * WEB_SEARCH_TOOL_COST_PER_CALL_USD;
  return {
    usd: Number(usd.toFixed(6)),
    jpy: Number((usd * USD_TO_JPY).toFixed(2)),
  };
}

// EEA-8: Web Search 1回分の合計コスト = tool call fee + model token cost（二重計上しない単一集計）。
//   usageが取得できない場合はinputTokens/outputTokens/cachedTokensを渡さない（既定0）ことで
//   token cost = 0・tokenCostUnknown:true として明示する（token量を推測しない）。
function calculateWebSearchCost({ model = '', toolCallCount = 0, inputTokens = null, outputTokens = null, cachedTokens = 0 } = {}) {
  const hasUsage = inputTokens != null || outputTokens != null;
  const tokenCost = hasUsage
    ? calculateOpenAICost(model, inputTokens || 0, outputTokens || 0, cachedTokens || 0)
    : { usd: 0, jpy: 0 };
  const toolFee = calculateWebSearchToolFee(toolCallCount);
  const totalUsd = Number((tokenCost.usd + toolFee.usd).toFixed(6));
  const totalJpy = Number((tokenCost.jpy + toolFee.jpy).toFixed(2));

  return {
    tokenCostUsd: tokenCost.usd,
    tokenCostJpy: tokenCost.jpy,
    tokenCostUnknown: !hasUsage,
    toolFeeUsd: toolFee.usd,
    toolFeeJpy: toolFee.jpy,
    totalUsd,
    totalJpy,
  };
}

function addOpenAIUsage(model = '', inputTokens = 0, outputTokens = 0, agent = 'web', type = 'text') {
  const state = ensureState();
  const { jpy } = calculateOpenAICost(model, inputTokens, outputTokens);
  const normalizedAmount = Number(jpy) || 0;
  const normalizedAssignee = agent || 'web';
  const normalizedType = type || 'text';

  if (state.stopped) {
    return costTracker.getSummary();
  }

  state.todayAmount   += normalizedAmount;
  state.monthlyAmount += normalizedAmount;
  state.totalAmount   = (state.totalAmount || 0) + normalizedAmount; // Phase47-1.6
  state.byAssignee[normalizedAssignee] = (state.byAssignee[normalizedAssignee] || 0) + normalizedAmount;
  state.byType[normalizedType] = (state.byType[normalizedType] || 0) + normalizedAmount;
  state.agentCosts[normalizedAssignee] = (state.agentCosts[normalizedAssignee] || 0) + normalizedAmount;
  state.departmentCosts[normalizedAssignee] = (state.departmentCosts[normalizedAssignee] || 0) + normalizedAmount;
  state.breakdown.byAssignee[normalizedAssignee] = (state.breakdown.byAssignee[normalizedAssignee] || 0) + normalizedAmount;
  state.breakdown.byType[normalizedType] = (state.breakdown.byType[normalizedType] || 0) + normalizedAmount;
  state.modelCosts[model] = (state.modelCosts[model] || 0) + normalizedAmount;

  if (state.monthlyAmount >= state.monthlyLimit) {
    state.stopped = true;
  }

  saveState(state);
  return costTracker.getSummary();
}

// EEA-8: Web Search（tool call fee + model token cost）を既存Cost Trackerへ計上。
//   addOpenAIUsage()と同じstate（cost-logs.json正本）・同じmonthlyLimit/stopped判定へ合流する
//   （新しいCost Tracker Engine・新しい月次上限管理・新しいcost-logsファイルは作らない）。
//   既存addOpenAIUsage()は無変更（回帰防止のため本関数側のみ追加）。
function addWebSearchUsage({ model = '', toolCallCount = 0, inputTokens = null, outputTokens = null, cachedTokens = 0, agent = 'aiDevelopment', type = 'web_search' } = {}) {
  const state = ensureState();

  if (state.stopped) {
    return costTracker.getSummary();
  }

  const cost = calculateWebSearchCost({ model, toolCallCount, inputTokens, outputTokens, cachedTokens });
  const normalizedAmount = Number(cost.totalJpy) || 0;
  const normalizedAssignee = agent || 'aiDevelopment';
  const normalizedType = type || 'web_search';

  state.todayAmount   += normalizedAmount;
  state.monthlyAmount += normalizedAmount;
  state.totalAmount   = (state.totalAmount || 0) + normalizedAmount;
  state.byAssignee[normalizedAssignee] = (state.byAssignee[normalizedAssignee] || 0) + normalizedAmount;
  state.byType[normalizedType] = (state.byType[normalizedType] || 0) + normalizedAmount;
  state.agentCosts[normalizedAssignee] = (state.agentCosts[normalizedAssignee] || 0) + normalizedAmount;
  state.departmentCosts[normalizedAssignee] = (state.departmentCosts[normalizedAssignee] || 0) + normalizedAmount;
  state.breakdown.byAssignee[normalizedAssignee] = (state.breakdown.byAssignee[normalizedAssignee] || 0) + normalizedAmount;
  state.breakdown.byType[normalizedType] = (state.breakdown.byType[normalizedType] || 0) + normalizedAmount;
  if (model) state.modelCosts[model] = (state.modelCosts[model] || 0) + normalizedAmount;

  if (state.monthlyAmount >= state.monthlyLimit) {
    state.stopped = true;
  }

  saveState(state);
  return { summary: costTracker.getSummary(), cost };
}

const costTracker = {
  getSummary() {
    const state = ensureState();
    const normalizedState = normalizeState(state);
    return {
      todayAmount: normalizedState.todayAmount,
      monthlyAmount: normalizedState.monthlyAmount,
      totalAmount: normalizedState.totalAmount || 0, // Phase47-1.6
      todayKey: normalizedState.todayKey || '',      // Phase47-1.6
      monthKey: normalizedState.monthKey || '',      // Phase47-1.6
      monthlyLimit: normalizedState.monthlyLimit,
      remaining: Math.max(normalizedState.monthlyLimit - normalizedState.monthlyAmount, 0),
      byAssignee: { ...normalizedState.byAssignee },
      byType: { ...normalizedState.byType },
      agentCosts: { ...normalizedState.agentCosts },
      departmentCosts: { ...normalizedState.departmentCosts },
      breakdown: {
        byAssignee: { ...normalizedState.breakdown.byAssignee },
        byType: { ...normalizedState.breakdown.byType },
      },
      modelCosts: { ...normalizedState.modelCosts },
      stopped: Boolean(normalizedState.stopped),
    };
  },

  recordUsage({ amount = 0, assignee = 'web', type = 'text' } = {}) {
    const state = ensureState();
    const normalizedAmount = Number(amount) || 0;
    const normalizedAssignee = assignee || 'web';
    const normalizedType = type || 'text';

    if (state.stopped) {
      return this.getSummary();
    }

    state.todayAmount   += normalizedAmount;
    state.monthlyAmount += normalizedAmount;
    state.totalAmount   = (state.totalAmount || 0) + normalizedAmount; // Phase47-1.6
    state.byAssignee[normalizedAssignee] = (state.byAssignee[normalizedAssignee] || 0) + normalizedAmount;
    state.byType[normalizedType] = (state.byType[normalizedType] || 0) + normalizedAmount;
    state.agentCosts[normalizedAssignee] = (state.agentCosts[normalizedAssignee] || 0) + normalizedAmount;
    state.departmentCosts[normalizedAssignee] = (state.departmentCosts[normalizedAssignee] || 0) + normalizedAmount;
    state.breakdown.byAssignee[normalizedAssignee] = (state.breakdown.byAssignee[normalizedAssignee] || 0) + normalizedAmount;
    state.breakdown.byType[normalizedType] = (state.breakdown.byType[normalizedType] || 0) + normalizedAmount;

    if (state.monthlyAmount >= state.monthlyLimit) {
      state.stopped = true;
    }

    saveState(state);
    return this.getSummary();
  },

  setMonthlyLimit(limit) {
    const state = ensureState();
    state.monthlyLimit = Number(limit) || DEFAULT_MONTHLY_LIMIT;
    if (state.monthlyAmount >= state.monthlyLimit) {
      state.stopped = true;
    } else {
      state.stopped = false;
    }
    saveState(state);
    return this.getSummary();
  },

  stopProcessing() {
    const state = ensureState();
    state.stopped = true;
    saveState(state);
    return this.getSummary();
  },

  resumeProcessing() {
    const state = ensureState();
    state.stopped = false;
    saveState(state);
    return this.getSummary();
  },

  getStatusText() {
    const summary = this.getSummary();
    return summary.stopped
      ? '⚠️ 現在の状態：API停止中です。'
      : '✅ 現在の状態：APIは正常に動作中です。';
  },

  isLimitExceeded() {
    const state = ensureState();
    return state.monthlyAmount > state.monthlyLimit;
  },

  canProcess() {
    const state = ensureState();
    return !state.stopped && state.monthlyAmount < state.monthlyLimit;
  },

  getStopText() {
    return '⚠️ 月額上限に達したためAI処理を停止しました。\nLINEで「上限変更 3000」または「再開」を送ってください。';
  },

  getMeterText() {
    const summary = this.getSummary();
    return [
      '💰 AI料金メーター',
      '',
      `本日：${summary.todayAmount}円`,
      `今月：${summary.monthlyAmount}円`,
      `月額上限：${summary.monthlyLimit}円`,
      `残り：${summary.remaining}円`,
      '',
      '担当別：',
      `・Web担当：${summary.byAssignee.web}円`,
      `・SNS動画担当：${summary.byAssignee.snsVideo}円`,
      `・AI開発担当：${summary.byAssignee.aiDevelopment}円`,
      `・見積担当：${summary.byAssignee.estimate}円`,
      '',
      '処理別：',
      `・文章AI：${summary.byType.text}円`,
      `・画像生成：${summary.byType.image}円`,
      `・動画生成：${summary.byType.video}円`,
      `・分析：${summary.byType.analysis}円`,
      '',
      'モデル別：',
      `・gpt-4.1-mini：${summary.modelCosts['gpt-4.1-mini'] || 0}円`,
      `・gpt-4.1-nano：${summary.modelCosts['gpt-4.1-nano'] || 0}円`,
      '',
      summary.stopped ? this.getStopText() : '状態：安全運転中です。',
    ].join('\n');
  },
};

module.exports = {
  costTracker,
  resetCostTracker,
  DEFAULT_MONTHLY_LIMIT,
  MODEL_PRICES,
  USD_TO_JPY,
  calculateOpenAICost,
  addOpenAIUsage,
  // EEA-8
  WEB_SEARCH_TOOL_COST_PER_CALL_USD,
  calculateWebSearchToolFee,
  calculateWebSearchCost,
  addWebSearchUsage,
};
