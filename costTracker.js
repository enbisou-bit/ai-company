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
};
// Phase47-1.6: 日付キー追加（日次・月次リセット用）
function _todayKey() { return new Date().toISOString().slice(0, 10); }
function _monthKey() { return new Date().toISOString().slice(0, 7);  }

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

function calculateOpenAICost(model = '', inputTokens = 0, outputTokens = 0) {
  const pricing = MODEL_PRICES[model] || null;
  if (!pricing) {
    return { usd: 0, jpy: 0 };
  }

  const normalizedInputTokens = Number(inputTokens) || 0;
  const normalizedOutputTokens = Number(outputTokens) || 0;
  const inputUsd = (normalizedInputTokens / 1000000) * pricing.input;
  const outputUsd = (normalizedOutputTokens / 1000000) * pricing.output;
  const totalUsd = inputUsd + outputUsd;

  return {
    usd: Number(totalUsd.toFixed(6)),
    jpy: Number((totalUsd * USD_TO_JPY).toFixed(2)),
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
};
