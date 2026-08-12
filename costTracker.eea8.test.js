// EEA-8: Web Search Cost Tracker接続の合成テスト。
//   実Web Search・実OpenAI APIは一切呼ばない（axios/openaiClient.jsをrequireしない）。
//   costTracker.jsの純関数（calculateOpenAICost/calculateWebSearchToolFee/calculateWebSearchCost）と
//   state計上関数（addWebSearchUsage）のみを対象とする。
const { test, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const {
  costTracker,
  resetCostTracker,
  calculateOpenAICost,
  calculateWebSearchToolFee,
  calculateWebSearchCost,
  addWebSearchUsage,
  WEB_SEARCH_TOOL_COST_PER_CALL_USD,
  MODEL_PRICES,
} = require('./costTracker');

afterEach(() => {
  resetCostTracker();
});

// 1. toolCallCount 0 → tool fee 0
test('EEA-8: toolCallCount 0はtool fee 0円', () => {
  const fee = calculateWebSearchToolFee(0);
  assert.equal(fee.usd, 0);
  assert.equal(fee.jpy, 0);
});

// 2. toolCallCount 1 → tool fee $0.01
test('EEA-8: toolCallCount 1はtool fee $0.01', () => {
  const fee = calculateWebSearchToolFee(1);
  assert.equal(fee.usd, WEB_SEARCH_TOOL_COST_PER_CALL_USD);
  assert.equal(fee.usd, 0.01);
});

// 3. toolCallCount 2 → tool fee $0.02
test('EEA-8: toolCallCount 2はtool fee $0.02', () => {
  const fee = calculateWebSearchToolFee(2);
  assert.equal(fee.usd, 0.02);
});

// 4. usage input/outputあり → model cost算出
test('EEA-8: usageありでgpt-5.6-terraのtoken costが算出される', () => {
  const cost = calculateWebSearchCost({
    model: 'gpt-5.6-terra', toolCallCount: 1,
    inputTokens: 1000000, outputTokens: 1000000, cachedTokens: 0,
  });
  // input $2.00/1M + output $12.00/1M = $14.00
  assert.equal(cost.tokenCostUsd, 14);
  assert.equal(cost.tokenCostUnknown, false);
});

// 5. cached tokenあり → 既存契約どおり計算（cached分はcachedInput単価、残りはinput単価）
test('EEA-8: cached tokenは按分計算される', () => {
  const result = calculateOpenAICost('gpt-5.6-terra', 1000000, 0, 400000);
  // uncached 600,000 * $2.00/1M + cached 400,000 * $0.20/1M = 1.2 + 0.08 = 1.28
  assert.equal(result.usd, 1.28);
});

test('EEA-8: cachedTokensがinputTokensを超えてもクランプされ負値にならない', () => {
  const result = calculateOpenAICost('gpt-5.6-terra', 100, 0, 999999);
  assert.ok(result.usd >= 0);
});

// 6. usageなし → crashなし（tokenCostUnknown:trueでtoken cost 0、tool feeのみ計上）
test('EEA-8: usageなしでもcrashせずtool feeのみ計上される', () => {
  const cost = calculateWebSearchCost({ model: 'gpt-5.6-terra', toolCallCount: 1 });
  assert.equal(cost.tokenCostUsd, 0);
  assert.equal(cost.tokenCostUnknown, true);
  assert.equal(cost.toolFeeUsd, 0.01);
  assert.equal(cost.totalUsd, 0.01);
});

// 7. usage malformed → crashなし
test('EEA-8: usageがmalformed（文字列・NaN）でもcrashしない', () => {
  assert.doesNotThrow(() => {
    calculateOpenAICost('gpt-5.6-terra', 'not-a-number', undefined, null);
  });
  assert.doesNotThrow(() => {
    calculateWebSearchCost({ model: 'gpt-5.6-terra', toolCallCount: 1, inputTokens: NaN, outputTokens: 'x' });
  });
});

// 8. toolCallCount malformed → 安全側（0扱い・負のfeeにならない）
test('EEA-8: toolCallCountがmalformed（負数・文字列・undefined）でも安全側に倒れる', () => {
  assert.equal(calculateWebSearchToolFee(-5).usd, 0);
  assert.equal(calculateWebSearchToolFee('abc').usd, 0);
  assert.equal(calculateWebSearchToolFee(undefined).usd, 0);
  assert.equal(calculateWebSearchToolFee(null).usd, 0);
});

// 9. gpt-5.6-terra → 正しいmodel price参照
test('EEA-8: gpt-5.6-terraはMODEL_PRICESに短文脈料金で登録されている', () => {
  assert.equal(MODEL_PRICES['gpt-5.6-terra'].input, 2.00);
  assert.equal(MODEL_PRICES['gpt-5.6-terra'].cachedInput, 0.20);
  assert.equal(MODEL_PRICES['gpt-5.6-terra'].output, 12.00);
});

// 10. 未知model → 勝手に価格推測しない（0円）
test('EEA-8: 未知モデルはtoken cost 0円（価格推測しない）', () => {
  const result = calculateOpenAICost('gpt-unknown-model-xyz', 1000000, 1000000);
  assert.equal(result.usd, 0);
  assert.equal(result.jpy, 0);
});

// 11. 通常calculateOpenAICost(3引数) → 既存cost結果不変（既存回帰）
test('EEA-8回帰: 既存3引数呼び出しのgpt-4.1-mini/nano計算結果は変わらない', () => {
  const mini = calculateOpenAICost('gpt-4.1-mini', 1000000, 1000000);
  assert.equal(mini.usd, 2);
  assert.equal(mini.jpy, 320);
  const nano = calculateOpenAICost('gpt-4.1-nano', 1000000, 1000000);
  assert.equal(nano.usd, 0.5);
  assert.equal(nano.jpy, 80);
});

// 12. Web Search → token + tool fee（合算）
test('EEA-8: Web Search総額はtool fee + token costの合算', () => {
  const cost = calculateWebSearchCost({
    model: 'gpt-5.6-terra', toolCallCount: 2,
    inputTokens: 1000, outputTokens: 500, cachedTokens: 0,
  });
  const expectedTotal = Number((cost.tokenCostUsd + cost.toolFeeUsd).toFixed(6));
  assert.equal(cost.totalUsd, expectedTotal);
  assert.equal(cost.toolFeeUsd, 0.02);
});

// 13. 二重計上なし（1回のWeb Search呼び出し = state加算は1回分の合計額のみ）
test('EEA-8: addWebSearchUsageは1回で合計額のみを1回加算する（二重計上なし）', () => {
  resetCostTracker();
  const before = costTracker.getSummary();
  const { summary, cost } = addWebSearchUsage({
    model: 'gpt-5.6-terra', toolCallCount: 1,
    inputTokens: 1000000, outputTokens: 1000000, cachedTokens: 0,
    agent: 'aiDevelopment', type: 'web_search',
  });
  assert.equal(summary.monthlyAmount, before.monthlyAmount + cost.totalJpy);
  assert.equal(summary.totalAmount, before.totalAmount + cost.totalJpy);
  // 二重計上されていれば2倍になっているはずなので明示的に否定
  assert.notEqual(summary.monthlyAmount, before.monthlyAmount + cost.totalJpy * 2);
});

// 14. monthlyAmountへ反映
test('EEA-8: addWebSearchUsageはmonthlyAmountへ反映される', () => {
  resetCostTracker();
  const { summary, cost } = addWebSearchUsage({ model: 'gpt-5.6-terra', toolCallCount: 1 });
  assert.equal(summary.monthlyAmount, cost.totalJpy);
  assert.ok(summary.monthlyAmount > 0);
});

// 15. totalAmountへ反映
test('EEA-8: addWebSearchUsageはtotalAmountへ反映される', () => {
  resetCostTracker();
  const { summary, cost } = addWebSearchUsage({ model: 'gpt-5.6-terra', toolCallCount: 1 });
  assert.equal(summary.totalAmount, cost.totalJpy);
});

// 16. monthlyLimit判定へ反映
test('EEA-8: 上限到達でstoppedがtrueになる', () => {
  resetCostTracker();
  costTracker.setMonthlyLimit(1); // 1円という極小上限
  addWebSearchUsage({ model: 'gpt-5.6-terra', toolCallCount: 100 }); // $1.00 = 十分に上限超え
  const summary = costTracker.getSummary();
  assert.equal(summary.stopped, true);
});

// 17. stopped状態 → 実行前拒否（addWebSearchUsage呼び出し自体もamount加算しない）
test('EEA-8: stopped状態ではaddWebSearchUsageはamountを加算しない', () => {
  resetCostTracker();
  costTracker.stopProcessing();
  const before = costTracker.getSummary();
  const result = addWebSearchUsage({ model: 'gpt-5.6-terra', toolCallCount: 5 });
  const after = costTracker.getSummary();
  assert.equal(after.monthlyAmount, before.monthlyAmount);
  assert.equal(after.totalAmount, before.totalAmount);
  // stopped時はcostを含まないgetSummary()のみが返る契約
  assert.equal(result.cost, undefined);
});

// modelCostsが指定モデルへ正しく積まれる（表示回帰確認を兼ねる）
test('EEA-8: addWebSearchUsageはmodelCosts[gpt-5.6-terra]へ積まれ、他モデルには影響しない', () => {
  resetCostTracker();
  const { summary, cost } = addWebSearchUsage({ model: 'gpt-5.6-terra', toolCallCount: 1 });
  assert.equal(summary.modelCosts['gpt-5.6-terra'], cost.totalJpy);
  assert.equal(summary.modelCosts['gpt-4.1-mini'], 0);
  assert.equal(summary.modelCosts['gpt-4.1-nano'], 0);
});
