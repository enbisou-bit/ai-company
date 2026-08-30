// costTrackerGpt54Mini.test.js
// Instagram実運用 Blocking Fix: MODEL_PRICES への gpt-5.4-mini 登録の回帰テスト。
//   実OpenAI API・実Web Search・実課金は一切なし（costTracker.js の純関数のみを対象）。
//   Leader Final専用モデルを gpt-4.1-nano → gpt-5.4-mini へ変更したが、gpt-5.4-mini が
//   MODEL_PRICES 未登録のため実費が ¥0 として記録されていた問題を修正する変更を固定する。
//
//   使用単価（USD / 1,000,000 tokens・本表の既存形式と同一・換算不要）:
//     Input $0.75 / Cached input $0.075 / Output $4.50
//
//   ★本テストは純関数（calculateOpenAICost）と定数（MODEL_PRICES / USD_TO_JPY）だけを検証する。
//     state計上関数（addOpenAIUsage / resetCostTracker）は呼ばない＝cost-logs.json へ一切書き込まない
//     （既存 costTracker.eea8.test.js は afterEach で resetCostTracker() を呼び cost-logs.json を
//      DEFAULT_STATE で上書きする副作用があるため、本テストでは同パターンを踏襲しない）。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  calculateOpenAICost,
  MODEL_PRICES,
  USD_TO_JPY,
} = require('./costTracker');

// 1. gpt-5.4-mini が MODEL_PRICES に登録され、未登録扱いにならない
test('1. gpt-5.4-mini は MODEL_PRICES に登録済み（未登録fallbackに落ちない）', () => {
  assert.ok(MODEL_PRICES['gpt-5.4-mini'], 'MODEL_PRICES に gpt-5.4-mini エントリが存在する');
  const c = calculateOpenAICost('gpt-5.4-mini', 1000, 1000);
  assert.ok(c.usd > 0, '既知トークンで usd > 0（fallbackの {usd:0} ではない）');
});

// 2. Input 単価が公式値（$0.75 / 1M）
test('2. input 単価 $0.75 / 1M', () => {
  assert.equal(MODEL_PRICES['gpt-5.4-mini'].input, 0.75);
  // 1,000,000 input tokens → $0.75
  assert.equal(calculateOpenAICost('gpt-5.4-mini', 1000000, 0).usd, 0.75);
  // 端数: 200,000 input tokens → $0.15
  assert.equal(calculateOpenAICost('gpt-5.4-mini', 200000, 0).usd, 0.15);
});

// 3. Output 単価が公式値（$4.50 / 1M）
test('3. output 単価 $4.50 / 1M', () => {
  assert.equal(MODEL_PRICES['gpt-5.4-mini'].output, 4.5);
  // 1,000,000 output tokens → $4.50
  assert.equal(calculateOpenAICost('gpt-5.4-mini', 0, 1000000).usd, 4.5);
  // input + output 合算: 1M + 1M → $0.75 + $4.50 = $5.25
  assert.equal(calculateOpenAICost('gpt-5.4-mini', 1000000, 1000000).usd, 5.25);
});

// 4. Cached input 単価が公式値（$0.075 / 1M）で按分計算される
test('4. cached input 単価 $0.075 / 1M（既存の按分計算で機能）', () => {
  assert.equal(MODEL_PRICES['gpt-5.4-mini'].cachedInput, 0.075);
  // 1,000,000 input のうち 500,000 が cached:
  //   uncached 500,000 * $0.75/1M + cached 500,000 * $0.075/1M = 0.375 + 0.0375 = $0.4125
  assert.equal(calculateOpenAICost('gpt-5.4-mini', 1000000, 0, 500000).usd, 0.4125);
  // cachedTokens=0 のときは input 全量が通常単価
  assert.equal(calculateOpenAICost('gpt-5.4-mini', 1000000, 0, 0).usd, 0.75);
  // cachedTokens が input を超えても input 量にクランプされる（負の uncached にならない）
  assert.equal(calculateOpenAICost('gpt-5.4-mini', 1000000, 0, 5000000).usd, 0.075);
});

// 5. USD 合計が正しい（input + cached + output の複合ケース）
test('5. USD 合計（複合ケース）', () => {
  // input 800,000（うち cached 300,000） + output 200,000
  //   uncached 500,000 * 0.75/1M = 0.375
  //   cached   300,000 * 0.075/1M = 0.0225
  //   output   200,000 * 4.50/1M = 0.9
  //   合計 = 1.2975
  const c = calculateOpenAICost('gpt-5.4-mini', 800000, 200000, 300000);
  assert.equal(c.usd, 1.2975);
});

// 6. JPY 換算が既存ロジック（USD * USD_TO_JPY, 2桁丸め）通り
test('6. JPY 換算は既存ロジック（USD * 160, toFixed(2)）', () => {
  assert.equal(USD_TO_JPY, 160);
  const c = calculateOpenAICost('gpt-5.4-mini', 1000000, 1000000); // $5.25
  assert.equal(c.jpy, Number((5.25 * 160).toFixed(2))); // 840
  assert.equal(c.jpy, 840);
  const c2 = calculateOpenAICost('gpt-5.4-mini', 800000, 200000, 300000); // $1.2975
  assert.equal(c2.jpy, Number((1.2975 * 160).toFixed(2))); // 207.6
});

// 7. 既存モデルの料金が一切変わっていない
test('7. 既存モデル（gpt-4.1-nano / gpt-4.1-mini / gpt-5.6-terra）は無変更', () => {
  assert.deepEqual(MODEL_PRICES['gpt-4.1-nano'], { input: 0.10, output: 0.40 });
  assert.deepEqual(MODEL_PRICES['gpt-4.1-mini'], { input: 0.40, output: 1.60 });
  assert.deepEqual(MODEL_PRICES['gpt-5.6-terra'], { input: 2.00, cachedInput: 0.20, output: 12.00 });
  // 計算結果も従来どおり
  assert.equal(calculateOpenAICost('gpt-4.1-nano', 1000000, 1000000).usd, 0.5);   // 0.10 + 0.40
  assert.equal(calculateOpenAICost('gpt-4.1-mini', 1000000, 1000000).usd, 2.0);   // 0.40 + 1.60
  assert.equal(calculateOpenAICost('gpt-5.6-terra', 1000000, 1000000).usd, 14.0); // 2.00 + 12.00
  // 1M input のうち 400k cached: uncached 600k * 2.00/1M + cached 400k * 0.20/1M = 1.2 + 0.08 = 1.28
  assert.equal(calculateOpenAICost('gpt-5.6-terra', 1000000, 0, 400000).usd, 1.28);
});

// 8. 未登録モデルの既存挙動が変わっていない（{usd:0, jpy:0}・クラッシュしない）
test('8. 未登録モデルの fallback は従来どおり {usd:0, jpy:0}', () => {
  assert.deepEqual(calculateOpenAICost('gpt-9.9-imaginary', 1000000, 1000000), { usd: 0, jpy: 0 });
  assert.deepEqual(calculateOpenAICost('', 1000, 1000), { usd: 0, jpy: 0 });
  assert.deepEqual(calculateOpenAICost(undefined, 1000, 1000), { usd: 0, jpy: 0 });
});
