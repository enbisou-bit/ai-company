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
};

function loadState() {
  try {
    if (!fs.existsSync(STORAGE_PATH)) {
      saveState(DEFAULT_STATE);
      return { ...DEFAULT_STATE };
    }

    const raw = fs.readFileSync(STORAGE_PATH, 'utf8');
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_STATE,
      ...parsed,
      byAssignee: { ...DEFAULT_STATE.byAssignee, ...(parsed.byAssignee || {}) },
      byType: { ...DEFAULT_STATE.byType, ...(parsed.byType || {}) },
    };
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
  global.__costTrackerState = { ...DEFAULT_STATE };
  saveState(global.__costTrackerState);
  return global.__costTrackerState;
}

const costTracker = {
  getSummary() {
    const state = ensureState();
    return {
      todayAmount: state.todayAmount,
      monthlyAmount: state.monthlyAmount,
      monthlyLimit: state.monthlyLimit,
      remaining: Math.max(state.monthlyLimit - state.monthlyAmount, 0),
      byAssignee: { ...state.byAssignee },
      byType: { ...state.byType },
      stopped: Boolean(state.stopped),
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
    }
    saveState(state);
    return this.getSummary();
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
    return '⚠️ 月額上限に達しました。\nAI処理を停止しています。\n上限を変更する場合は管理者確認が必要です。';
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
      summary.stopped ? this.getStopText() : '状態：安全運転中です。',
    ].join('\n');
  },
};

module.exports = {
  costTracker,
  resetCostTracker,
  DEFAULT_MONTHLY_LIMIT,
};
