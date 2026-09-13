'use strict';
// costTrackerTestIsolation.test.js
// Cost Tracker Test Isolation Safety Fix — regression guard.
//
//   目的: server.test.js（resetCostTracker() を多数呼ぶ）が本番 cost-logs.json（Protected）へ
//         絶対に書き込まないことを実測で保証する。
//
//   実HTTP 0 / 実AI API 0 / 実DB 0 / Web Evidence 0。
//   本番 cost-logs.json は read（md5計算）以外で一切触れない（write 0）。
//
//   ★ このファイルは ./costTracker を require する前に COST_TRACKER_STORAGE_PATH を
//     test専用の一時pathへ設定する（module cache のため require より前が必須）。

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PRODUCTION_STORAGE_PATH = path.join(__dirname, 'cost-logs.json');

function md5File(p) { return crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex'); }

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

// ── production ファイルの実行前 md5（read のみ・write 0） ──
const beforeMd5 = md5File(PRODUCTION_STORAGE_PATH);

// ── isolation を有効化（require より前に設定することが必須契約） ──
const TEST_STORAGE_PATH = path.join(os.tmpdir(), 'enbisou-cost-tracker-isolation-test-' + process.pid + '.json');
process.env.COST_TRACKER_STORAGE_PATH = TEST_STORAGE_PATH;

const costTrackerModule = require('./costTracker');
const { costTracker, resetCostTracker, addOpenAIUsage } = costTrackerModule;

(function () {
  console.log('\n=== costTrackerTestIsolation.test.js ===');

  caseHeader('1. COST_TRACKER_STORAGE_PATH による切替の実測確認');
  assert(costTrackerModule.STORAGE_PATH === TEST_STORAGE_PATH,
    '1a. costTracker.js が env var 指定の test storage path を実際に採用している');
  assert(costTrackerModule.STORAGE_PATH !== PRODUCTION_STORAGE_PATH,
    '1b. ★test storage path !== production storage path（isolation が有効）');
  assert(path.isAbsolute(costTrackerModule.STORAGE_PATH), '1c. STORAGE_PATH は絶対path');

  caseHeader('2. server.test.js が isolation を requireより前に有効化していることを source で確認');
  const serverTestSrc = fs.readFileSync(path.join(__dirname, 'server.test.js'), 'utf8');
  const envSetIdx = serverTestSrc.indexOf('process.env.COST_TRACKER_STORAGE_PATH');
  const requireServerIdx = serverTestSrc.indexOf("require('./server')");
  const requireCostTrackerIdx = serverTestSrc.indexOf("require('./costTracker')");
  assert(envSetIdx !== -1, '2a. server.test.js が COST_TRACKER_STORAGE_PATH を設定している');
  assert(requireServerIdx !== -1 && envSetIdx < requireServerIdx,
    '2b. ★env var 設定が require(\'./server\') より前（module cache 確定前）');
  assert(requireCostTrackerIdx !== -1 && envSetIdx < requireCostTrackerIdx,
    '2c. ★env var 設定が require(\'./costTracker\') より前');
  assert(serverTestSrc.indexOf('process.env.NODE_ENV') === -1,
    '2d. process.env.NODE_ENV 等の暗黙判定を使わず明示的な env var のみで切替えている（コメント内の言及は対象外）');

  caseHeader('3. server.test.js に fail-closed regression guard（before/after md5 assert）が存在する');
  assert(serverTestSrc.indexOf('_prodCostLogsMd5Before') !== -1 && serverTestSrc.indexOf('assert.equal(md5After') !== -1,
    '3a. server.test.js 自身が実行前後で production md5 不変を assert する仕組みを持つ');

  caseHeader('4. costTracker.js が STORAGE_PATH を静かに export していることを確認（test 可視性）');
  const ctSrc = fs.readFileSync(path.join(__dirname, 'costTracker.js'), 'utf8');
  assert(ctSrc.indexOf('process.env.COST_TRACKER_STORAGE_PATH') !== -1,
    '4a. costTracker.js が COST_TRACKER_STORAGE_PATH を参照している');
  assert(ctSrc.indexOf('process.env.NODE_ENV') === -1,
    '4b. ★暗黙の process.env.NODE_ENV 分岐を使っていない（明示 env var のみ。コメント内の言及は対象外）');

  caseHeader('5. resetCostTracker / addOpenAIUsage / 月額上限超過を実行しても production file は不変');
  resetCostTracker();
  addOpenAIUsage('gpt-4.1-nano', 500000, 500000, 'web', 'text');
  costTracker.setMonthlyLimit(0.0001);   // 即座に stopped=true になる状況を作る（上限超過パス）
  addOpenAIUsage('gpt-4.1-nano', 500000, 500000, 'web', 'text');
  resetCostTracker();

  assert(fs.existsSync(TEST_STORAGE_PATH), '5a. isolation storage file が作成されている（書込み先は test 専用ファイルのみ）');
  const afterMd5 = md5File(PRODUCTION_STORAGE_PATH);
  assert(afterMd5 === beforeMd5,
    '5b. ★production cost-logs.json の md5 が実行前後で完全不変: ' + beforeMd5 + ' === ' + afterMd5);

  caseHeader('6. 後片付け（test storage file のみ削除。production には一切触れない）');
  try { fs.unlinkSync(TEST_STORAGE_PATH); assert(true, '6a. isolation storage file を削除'); }
  catch (e) { assert(false, '6a. isolation storage file 削除失敗: ' + e.message); }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All costTrackerTestIsolation cases passed'); }
})();
