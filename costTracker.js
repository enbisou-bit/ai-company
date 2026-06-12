const fs = require('fs');
const path = require('path');

const STORAGE_PATH = path.join(__dirname, 'cost-logs.json');
const DEFAULT_MONTHLY_LIMIT = 1000;
const DEFAULT_STATE = {
  todayAmount: 0,
  monthlyAmount: 0,
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
};

function normalizeState(state) {
  const normalizedState = {
    ...DEFAULT_STATE,
    ...state,
    byAssignee: { ...DEFAULT_STATE.byAssignee, ...(state?.byAssignee || {}) },
    byType: { ...DEFAULT_STATE.byType, ...(state?.byType || {}) },
    agentCosts: { ...DEFAULT_STATE.agentCosts, ...(state?.agentCosts || state?.byAssignee || {}) },
    departmentCosts: { ...DEFAULT_STATE.departmentCosts, ...(state?.departmentCosts || state?.byAssignee || {}) },
    breakdown: {
      byAssignee: { ...DEFAULT_STATE.breakdown.byAssignee, ...((state?.breakdown?.byAssignee) || (state?.byAssignee || {})) },
      byType: { ...DEFAULT_STATE.breakdown.byType, ...((state?.breakdown?.byType) || (state?.byType || {})) },
    },
  };

  normalizedState.byAssignee = { ...DEFAULT_STATE.byAssignee, ...(normalizedState.byAssignee || {}) };
  normalizedState.byType = { ...DEFAULT_STATE.byType, ...(normalizedState.byType || {}) };
  normalizedState.agentCosts = { ...DEFAULT_STATE.agentCosts, ...(normalizedState.agentCosts || {}) };
  normalizedState.departmentCosts = { ...DEFAULT_STATE.departmentCosts, ...(normalizedState.departmentCosts || {}) };
  normalizedState.breakdown.byAssignee = { ...DEFAULT_STATE.breakdown.byAssignee, ...(normalizedState.breakdown?.byAssignee || {}) };
  normalizedState.breakdown.byType = { ...DEFAULT_STATE.breakdown.byType, ...(normalizedState.breakdown?.byType || {}) };

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
  return global.__costTrackerState;
}

function resetCostTracker() {
  global.__costTrackerState = normalizeState(DEFAULT_STATE);
  saveState(global.__costTrackerState);
  return global.__costTrackerState;
}

const costTracker = {
  getSummary() {
    const state = ensureState();
    const normalizedState = normalizeState(state);
    return {
      todayAmount: normalizedState.todayAmount,
      monthlyAmount: normalizedState.monthlyAmount,
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

    state.todayAmount += normalizedAmount;
    state.monthlyAmount += normalizedAmount;
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
      summary.stopped ? this.getStopText() : '状態：安全運転中です。',
    ].join('\n');
  },
};

module.exports = {
  costTracker,
  resetCostTracker,
  DEFAULT_MONTHLY_LIMIT,
};
