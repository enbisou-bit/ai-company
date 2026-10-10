'use strict';
// tools/dailyProduction/runOnce.js
// Instagram Daily Production — ローカル検証専用の1本制作。
//
//   ★ ローカル検証専用。偽 Writer・偽認可・メモリ内の予算ストア・メモリ内保存だけを使う。
//     実 provider・API キー・.env.local・環境変数・本番 DB・Storage を読まない／呼ばない。
//     実 provider を起動するオプションは持たない（引数は受け付けない）。
//   ★ 偽認可（kind: 'local_fake'）は実際の Human 認可ではない。
//   ★ テーマパック・確認記録・期間・Writer 出力・使用量はすべて LOCAL FIXTURE（検証用）。
//   ★ メモリ内の予算ストアはプロセス内でだけ原子的。実 DB の原子性の実証ではない。
//   ★ Content Value は既存の shared/contentValueQuality.evaluateContentValue（純関数）をそのまま使う。
//
//   使い方: node tools/dailyProduction/runOnce.js

const crypto = require('crypto');
const { runDailyProduction } = require('../../lib/dailyProductionService');
const { createSpendGate } = require('../../lib/spendGate');
const contentValueQuality = require('../../shared/contentValueQuality');

// ── LOCAL FIXTURE（検証用・実際の確認記録ではない） ──
const LOCAL_FIXTURE_PACK = Object.freeze({
  version: 1,
  topicId: 'face-wash-tightness',
  status: 'human_verified',
  concern: { scene: '夜、洗顔したあと', problem: '顔がつっぱる' },
  coreAction: '洗い方を見直す',
  claims: [
    { claimId: 'r1', kind: 'reason', status: 'human_verified', sourceIds: ['s1'], text: 'こすると肌への刺激になる' },
    { claimId: 'a1', kind: 'action', status: 'human_verified', sourceIds: ['s1'], text: 'ぬるま湯でぬらし、指先で洗う' },
    { claimId: 'a2', kind: 'action', status: 'human_verified', sourceIds: ['s1'], text: 'やわらかいタオルで押さえて拭く' },
    { claimId: 'a3', kind: 'action', status: 'human_verified', sourceIds: ['s1'], text: '洗顔は1日2回と汗をかいた後にする' },
    { claimId: 'c1', kind: 'caution', status: 'human_verified', sourceIds: ['s1'], text: '赤みやかゆみが続くときは皮膚科に相談する' },
  ],
  sources: [{
    sourceId: 's1',
    url: 'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101',
    publisher: 'American Academy of Dermatology',
    title: 'Face washing 101',
    locator: 'LOCAL FIXTURE: 洗顔の手順の箇条',
    checkedOn: '2026-10-08',
    scope: 'LOCAL FIXTURE: 洗い方・回数・拭き方のみ',
    limitations: 'LOCAL FIXTURE: つっぱりの原因は特定しない',
    verification: { status: 'human_verified', verifiedBy: 'local-fixture' },
  }],
});

// パックの内容 hash（キー順を固定した JSON の SHA-256）。本番では同じ関数を確認記録と制作の両方で使う想定。
function canonicalJson(v) {
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  if (v && typeof v === 'object') return '{' + Object.keys(v).sort().map(k => JSON.stringify(k) + ':' + canonicalJson(v[k])).join(',') + '}';
  return JSON.stringify(v);
}
function computePackHash(pack) { return crypto.createHash('sha256').update(canonicalJson(pack), 'utf8').digest('hex'); }

const LOCAL_PACK_VERSION = 1;
const LOCAL_LIMITS = Object.freeze({ amountUnit: 'micro_jpy', timeZone: 'Asia/Tokyo', dailyLimit: 3000000, monthlyLimit: 30000000, perRunLimit: 1000000 });
const LOCAL_PERIOD = Object.freeze({ dayKey: '2026-10-09', monthKey: '2026-10', timeZone: 'Asia/Tokyo' });   // LOCAL FIXTURE（時計は読まない）

function localInput(over) {
  return Object.assign({
    runId: 'run-local-0001',
    caseId: 'case-local-daily-fixture',
    outputId: 'out_local_daily_fixture',
    topicId: LOCAL_FIXTURE_PACK.topicId,
    packVersion: LOCAL_PACK_VERSION,
    contentHash: computePackHash(LOCAL_FIXTURE_PACK),
    pack: LOCAL_FIXTURE_PACK,
    period: LOCAL_PERIOD,
    estimate: { amount: 500000, unit: 'micro_jpy' },   // LOCAL FIXTURE の見積り（0.5円）
    writerProvider: 'fake_writer',
  }, over || {});
}

// 偽 Writer の固定出力（LOCAL FIXTURE）
const FAKE_WRITER_OUTPUT = JSON.stringify({
  topicId: 'face-wash-tightness',
  outputType: 'instagram_carousel',
  contentType: 'value',
  slides: [
    { index: 1, role: 'scene_problem', headline: '洗顔後、つっぱる？', lines: [
      { text: '夜の洗顔のあと、顔がつっぱる', claimIds: [] },
      { text: 'すぐに何か塗りたくなる', claimIds: [] },
    ] },
    { index: 2, role: 'verified_reason', headline: 'こすると刺激に', lines: [{ text: 'ゴシゴシこすると肌への刺激になります', claimIds: ['r1'] }] },
    { index: 3, role: 'steps', headline: '今夜の洗い方', lines: [
      { text: 'ぬるま湯で顔をぬらす', claimIds: ['a1'] },
      { text: '洗顔料は指先でやさしく洗う', claimIds: ['a1'] },
      { text: 'やわらかいタオルで押さえて拭く', claimIds: ['a2'] },
    ] },
    { index: 4, role: 'additional_action_or_caution', headline: '続くときは', lines: [{ text: '赤みやかゆみが続くなら皮膚科へ', claimIds: ['c1'] }] },
    { index: 5, role: 'checklist', headline: '保存用チェックリスト', lines: [
      { text: '□ ぬるま湯と指先で洗う', claimIds: ['a1'] },
      { text: '□ タオルは押さえて拭く', claimIds: ['a2'] },
      { text: '□ 赤み・かゆみが続けば皮膚科', claimIds: ['c1'] },
    ] },
  ],
  caption: { text: '洗顔後のつっぱり。洗い方を見直せることがあります。', claimIds: ['a1'] },
  cta: '今夜の洗顔で、チェックリストを一つ使ってみてください。',
  hashtags: ['#洗顔', '#スキンケア', '#乾燥肌'],
});

// メモリ内の予算ストア（プロセス内でだけ原子的。状態遷移は lib/spendGate.js の契約どおり）
function createMemorySpendStore() {
  const rows = new Map();
  const counted = r => (r.state === 'released' ? 0 : r.state === 'settled' ? r.settledAmount : r.amount);
  const total = f => { let t = 0; rows.forEach(r => { if (f(r)) t += counted(r); }); return t; };
  return {
    capabilities: { kind: 'local_fake', atomicReserve: true, atomicityVerified: false },   // ローカル検証専用の偽ストア
    rows,
    async reserveAtomic(a) {
      if (rows.has(a.runId)) return { outcome: 'duplicate_run', existingState: rows.get(a.runId).state };
      const d = total(r => r.dayKey === a.dayKey) + a.amount, m = total(r => r.monthKey === a.monthKey) + a.amount;
      if (d > a.dailyLimit) return { outcome: 'daily_limit_exceeded' };
      if (m > a.monthlyLimit) return { outcome: 'monthly_limit_exceeded' };
      rows.set(a.runId, { runId: a.runId, amount: a.amount, dayKey: a.dayKey, monthKey: a.monthKey, state: 'reserved', settledAmount: null });
      return { outcome: 'reserved', dailyRemaining: a.dailyLimit - d, monthlyRemaining: a.monthlyLimit - m };
    },
    async markInvoked(a) { const r = rows.get(a.runId); if (!r) return { outcome: 'not_found' }; if (r.state !== 'reserved') return { outcome: 'invalid_state:' + r.state }; r.state = 'invoked'; return { outcome: 'invoked' }; },
    async release(a) { const r = rows.get(a.runId); if (!r) return { outcome: 'not_found' }; if (r.state !== a.onlyIfState) return { outcome: 'release_refused:' + r.state }; r.state = 'released'; return { outcome: 'released' }; },
    async markOutcomeUnknown(a) { const r = rows.get(a.runId); if (!r) return { outcome: 'not_found' }; if (r.state !== 'invoked' && r.state !== 'outcome_unknown') return { outcome: 'invalid_state:' + r.state }; r.state = 'outcome_unknown'; return { outcome: 'outcome_unknown' }; },
    async settle(a) {
      const r = rows.get(a.runId); if (!r) return { outcome: 'not_found' };
      if (r.state === 'settled') return { outcome: r.settledAmount === a.settledAmount ? 'already_settled_same' : 'settle_conflict' };
      if (r.state !== 'invoked' && r.state !== 'outcome_unknown') return { outcome: 'invalid_state:' + r.state };
      r.state = 'settled'; r.settledAmount = a.settledAmount; return { outcome: 'settled' };
    },
  };
}

// 偽の依存一式（メモリ内のみ）。overrides で一部を差し替えられる。
function createLocalDeps(overrides) {
  const spendStore = (overrides && overrides.spendStore) || createMemorySpendStore();
  const drafts = (overrides && overrides.drafts) || new Map();
  const deps = {
    spendStore, drafts,
    computePackHash,
    // 偽認可: 実際の Human 認可ではない（kind: 'local_fake'）。渡された対象をそのまま返すだけ。
    authorize: async ({ target }) => ({
      authorized: true,
      authorizationId: 'auth-local-fake-0001',
      kind: 'local_fake',
      target: Object.assign({}, target),
      review: { reviewId: 'review-local-fake-0001', topicId: target.topicId, packVersion: target.packVersion, contentHash: target.contentHash },
    }),
    spendGate: createSpendGate({ mode: 'local_verification', store: spendStore, limits: LOCAL_LIMITS }),   // 本番の有料実行には使えないモード
    callWriter: async () => ({ text: FAKE_WRITER_OUTPUT, usage: { inputTokens: 1200, outputTokens: 600 } }),   // LOCAL FIXTURE の使用量
    estimateCostFromUsage: async (u) => ({ amount: 300000, unit: 'micro_jpy', basis: 'local_fake_usage(' + u.inputTokens + '/' + u.outputTokens + ')' }),
    evaluateContentValue: async (draft, options) => contentValueQuality.evaluateContentValue(draft, options),
    insertDraftIfAbsent: async (payload) => {
      if (drafts.has(payload.outputId)) return { ok: false, outcome: 'already_exists' };   // 上書きしない
      drafts.set(payload.outputId, JSON.parse(JSON.stringify(payload)));
      return { ok: true, outcome: 'inserted' };
    },
  };
  return Object.assign(deps, overrides || {});
}

async function runLocal(inputOver, depsOver) {
  const deps = createLocalDeps(depsOver);
  const result = await runDailyProduction(localInput(inputOver), deps);
  return { result, deps };
}

if (require.main === module) {
  if (process.argv.length > 2) {
    console.error('このツールは引数を受け付けません（ローカル検証専用・実 provider の起動オプションはありません）。');
    process.exit(2);
  }
  runLocal().then(({ result, deps }) => {
    console.log('【ローカル1本制作（偽 Writer・偽認可・メモリ内の予算ストアと保存・本番制作ではない）】');
    result.stages.forEach(s => console.log('  ' + (s.status === 'ok' ? '✅' : '❌') + ' ' + s.stage + (s.reason ? '：' + s.reason : '')));
    console.log('結果: ' + result.status + ' ／ approval: ' + result.approval + ' ／ 認可: ' + (result.authorization ? result.authorization.kind + '（Human 認可ではない）' : '-'));
    console.log('予算モード: ' + result.billing.mode + '（本番の有料実行には使えない）');
    console.log('予算: ' + result.billing.state + ' ／ 予約 ' + result.billing.reservedAmount + ' ' + result.billing.unit + ' ／ 精算（推定）' + result.billing.settledAmount + ' ／ ストア上の状態: ' + (deps.spendStore.rows.get(result.runId) || {}).state);
    console.log('Writer 呼び出し: ' + result.counters.writerCalls + '回 ／ 再試行: ' + result.retries + '回 ／ Content Value: ' + (result.contentValue ? result.contentValue.status + '（score ' + result.contentValue.score + '）' : '-'));
    if (result.draft) {
      console.log('\n■ Draft（メモリ内のみ・type=' + result.draft.type + ' / contentType=' + result.draft.contentType + ' / status=' + result.draft.status + '＝生成完了の語彙）');
      result.draft.fields.slides.forEach(s => console.log('---\n' + s));
      console.log('---\ncaption: ' + result.draft.fields.caption);
      console.log('cta: ' + result.draft.fields.cta);
      console.log('hashtags: ' + result.draft.fields.hashtags.join(' '));
      console.log('\n■ 根拠メモ（投稿本文ではない・canonical Evidence ではない）');
      result.draft.fields.dailyProduction.evidenceMemo.forEach(m => console.log('  [' + m.claimId + '] ' + m.text + ' ← ' + m.sources.map(x => x.publisher + '（' + x.checkedOn + '・申告: ' + x.declaredVerificationStatus + '）').join(', ')));
    }
    console.log('\nメモリ内保存件数: ' + deps.drafts.size + '（本番 DB には保存していない）');
  }).catch(e => { console.error('ローカル実行エラー:', e && e.message); process.exit(1); });
}

module.exports = {
  LOCAL_FIXTURE_PACK, LOCAL_LIMITS, LOCAL_PERIOD, LOCAL_PACK_VERSION, FAKE_WRITER_OUTPUT,
  canonicalJson, computePackHash, localInput, createMemorySpendStore, createLocalDeps, runLocal,
};
