'use strict';
// spendGate.test.js
// Instagram Daily Production — Step 2B Preparation: 予算予約ゲート（lib/spendGate.js）のテスト。
//
//   実HTTP 0 / 実AI API 0 / 実DB 0 / 永続書き込み 0 / 環境変数 0。
//   ★ 偽ストアは JS の1回の同期処理の中で「上限確認＋予約」を行う（＝プロセス内でだけ原子的）。
//     この合格は Supabase / PostgreSQL での原子性の実証ではない。

const fs = require('fs');
const path = require('path');
const sg = require('./lib/spendGate');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }
function deepFreeze(o) { Object.freeze(o); Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object' && !Object.isFrozen(o[k])) deepFreeze(o[k]); }); return o; }

const LIMITS = { amountUnit: 'micro_jpy', timeZone: 'Asia/Tokyo', dailyLimit: 100, monthlyLimit: 250, perRunLimit: 80 };
const DAY1 = { dayKey: '2026-10-09', monthKey: '2026-10', timeZone: 'Asia/Tokyo' };
const DAY2 = { dayKey: '2026-10-10', monthKey: '2026-10', timeZone: 'Asia/Tokyo' };
const DAY3 = { dayKey: '2026-10-11', monthKey: '2026-10', timeZone: 'Asia/Tokyo' };

// プロセス内でだけ原子的な偽ストア（状態遷移のルールは実 DB 案と同じ）
function makeFakeStore(opts) {
  opts = opts || {};
  const rows = new Map();
  const calls = { reserveAtomic: 0, markInvoked: 0, settle: 0, release: 0, markOutcomeUnknown: 0 };
  function counted(r) {
    if (r.state === 'released') return 0;
    if (r.state === 'settled') return r.settledAmount;
    return r.amount;   // reserved / invoked / outcome_unknown（未解決の予約）は見積額を計上
  }
  function total(filter) { let t = 0; rows.forEach(r => { if (filter(r)) t += counted(r); }); return t; }
  const store = {
    capabilities: { kind: 'local_fake', atomicReserve: opts.atomic === false ? false : true },
    rows, calls,
    async reserveAtomic(a) {
      calls.reserveAtomic++;
      if (opts.throwOnReserve) throw new Error('connection reset');
      if (opts.reserveReturns) return opts.reserveReturns;
      // ↓ ここから同期（await なし）＝プロセス内で原子的
      if (rows.has(a.runId)) return { outcome: 'duplicate_run', existingState: rows.get(a.runId).state };
      const day = total(r => r.dayKey === a.dayKey) + a.amount;
      const month = total(r => r.monthKey === a.monthKey) + a.amount;
      if (day > a.dailyLimit) return { outcome: 'daily_limit_exceeded' };
      if (month > a.monthlyLimit) return { outcome: 'monthly_limit_exceeded' };
      rows.set(a.runId, { runId: a.runId, amount: a.amount, dayKey: a.dayKey, monthKey: a.monthKey, state: 'reserved', settledAmount: null });
      if (opts.omitRemaining) return { outcome: 'reserved' };
      return { outcome: 'reserved', dailyRemaining: a.dailyLimit - day, monthlyRemaining: a.monthlyLimit - month };
    },
    async markInvoked(a) {
      calls.markInvoked++;
      const r = rows.get(a.runId); if (!r) return { outcome: 'not_found' };
      if (r.state !== 'reserved') return { outcome: 'invalid_state:' + r.state };
      r.state = 'invoked'; return { outcome: 'invoked' };
    },
    async release(a) {
      calls.release++;
      const r = rows.get(a.runId); if (!r) return { outcome: 'not_found' };
      if (r.state !== a.onlyIfState) return { outcome: 'release_refused:' + r.state };
      r.state = 'released'; return { outcome: 'released' };
    },
    async markOutcomeUnknown(a) {
      calls.markOutcomeUnknown++;
      if (opts.throwOnUnknown) throw new Error('db down');
      const r = rows.get(a.runId); if (!r) return { outcome: 'not_found' };
      if (r.state !== 'invoked' && r.state !== 'outcome_unknown') return { outcome: 'invalid_state:' + r.state };
      r.state = 'outcome_unknown'; return { outcome: 'outcome_unknown' };
    },
    async settle(a) {
      calls.settle++;
      if (opts.throwOnSettle) throw new Error('timeout');
      const r = rows.get(a.runId); if (!r) return { outcome: 'not_found' };
      if (r.state === 'settled') return { outcome: r.settledAmount === a.settledAmount ? 'already_settled_same' : 'settle_conflict' };
      if (r.state !== 'invoked' && r.state !== 'outcome_unknown') return { outcome: 'invalid_state:' + r.state };
      r.state = 'settled'; r.settledAmount = a.settledAmount; return { outcome: 'settled' };
    },
  };
  return store;
}
function req(runId, amount, period) { return { runId, purpose: 'daily_copy_writer', provider: 'openai', estimateAmount: amount, period: period || DAY1 }; }

(async function main() {
  caseHeader('1. 日次／月次／1実行の上限の境界');
  {
    const store = makeFakeStore(); const g = sg.createSpendGate({ mode: 'local_verification', store, limits: LIMITS });
    assert((await g.reserve(req('run-a1', 80))).approved === true, '1-1. 1実行の上限ちょうど（80）は許可');
    assert((await g.reserve(req('run-a2', 81))).reason === 'per_run_limit_exceeded', '1-2. 1実行の上限超え（81）は拒否（ストアに問い合わせない）');
    const r3 = await g.reserve(req('run-a3', 20));
    assert(r3.approved === true && r3.dailyRemaining === 0, '1-3. 日次の上限ちょうど（80+20=100）は許可・残額0');
    assert((await g.reserve(req('run-a4', 1))).reason === 'daily_limit_exceeded', '1-4. 日次の上限超え（+1）は拒否');
    assert((await g.reserve(req('run-b1', 80, DAY2))).approved === true && (await g.reserve(req('run-b2', 20, DAY2))).approved === true, '1-5. 翌日は日次枠が別（月の合計は200）');
    const m = await g.reserve(req('run-c1', 50, DAY3));
    assert(m.approved === true && m.monthlyRemaining === 0, '1-6. 月次の上限ちょうど（250）は許可');
    assert((await g.reserve(req('run-c2', 1, DAY3))).reason === 'monthly_limit_exceeded', '1-7. 月次の上限超えは拒否（日次に余りがあっても）');
    assert(store.calls.reserveAtomic === 7, '1-8. 1実行の上限超えはストアを呼ばない（7回のみ）');
  }

  caseHeader('2. 既存予約（未解決・精算済み・解放）を含めた残額判定');
  {
    const store = makeFakeStore(); const g = sg.createSpendGate({ mode: 'local_verification', store, limits: LIMITS });
    await g.reserve(req('run-1', 60));                                  // reserved 60
    await g.reserve(req('run-2', 30)); await g.markInvoked({ runId: 'run-2' }); await g.markOutcomeUnknown({ runId: 'run-2' });  // 結果不明 30（保持）
    assert((await g.reserve(req('run-3', 11))).reason === 'daily_limit_exceeded', '2-1. 未解決（reserved・結果不明）の予約を残額から差し引く');
    await g.releaseBeforeCall({ runId: 'run-1', reason: 'aborted_before_call' });   // 呼び出し前の中止 → 60 解放
    const r4 = await g.reserve(req('run-4', 70));
    assert(r4.approved === true && r4.dailyRemaining === 0, '2-2. 呼び出し前に解放した予約は残額に戻る');
    await g.markInvoked({ runId: 'run-4' }); await g.settle({ runId: 'run-4', settledAmount: 40, basis: 'usage_tokens' });
    const r5 = await g.reserve(req('run-5', 30));
    assert(r5.approved === true && r5.dailyRemaining === 0, '2-3. 精算後は見積額ではなく推定費用（40）で計上');
  }

  caseHeader('3. 残額内に収まらない並行要求を両方許可しない');
  {
    const store = makeFakeStore(); const g = sg.createSpendGate({ mode: 'local_verification', store, limits: LIMITS });
    const [a, b] = await Promise.all([g.reserve(req('run-p1', 60)), g.reserve(req('run-p2', 60))]);
    assert([a, b].filter(x => x.approved).length === 1 && [a, b].some(x => x.reason === 'daily_limit_exceeded'), '3-1. 60＋60（上限100）の同時要求は片方だけ許可');
    const many = await Promise.all([1, 2, 3, 4, 5, 6].map(i => g.reserve(req('run-q' + i, 20, DAY2))));
    assert(many.filter(x => x.approved).length === 5, '3-2. 20×6（上限100）の同時要求は5件だけ許可');
    const nonAtomic = makeFakeStore({ atomic: false });
    const gn = sg.createSpendGate({ mode: 'local_verification', store: nonAtomic, limits: LIMITS });
    const rn = await gn.reserve(req('run-n1', 10));
    assert(rn.approved === false && rn.reason === 'atomic_store_unavailable' && nonAtomic.calls.reserveAtomic === 0, '3-3. 原子的予約を持たないストアは使わない（fail-closed）');
  }

  caseHeader('4. 重複予約／重複精算');
  {
    const store = makeFakeStore(); const g = sg.createSpendGate({ mode: 'local_verification', store, limits: LIMITS });
    await g.reserve(req('run-d1', 10));
    const dup = await g.reserve(req('run-d1', 10));
    assert(dup.approved === false && dup.reason === 'duplicate_run' && dup.existingState === 'reserved', '4-1. 同じ runId の再予約は拒否（二重起動を防ぐ）');
    await g.markInvoked({ runId: 'run-d1' });
    const s1 = await g.settle({ runId: 'run-d1', settledAmount: 8, basis: 'usage_tokens' });
    const s2 = await g.settle({ runId: 'run-d1', settledAmount: 8, basis: 'usage_tokens' });
    const s3 = await g.settle({ runId: 'run-d1', settledAmount: 9, basis: 'usage_tokens' });
    assert(s1.ok === true && s2.ok === true && s2.idempotent === true && s3.ok === false && s3.reason === 'settle_conflict', '4-2. 同額の再精算は冪等、別金額の再精算は拒否');
    const inv2 = await g.markInvoked({ runId: 'run-d1' });
    assert(inv2.ok === false, '4-3. 精算済みの実行を再び呼び出し中にしない');
  }

  caseHeader('5. ストア失敗／結果不明');
  {
    const g1 = sg.createSpendGate({ mode: 'local_verification', store: makeFakeStore({ throwOnReserve: true }), limits: LIMITS });
    const r1 = await g1.reserve(req('run-e1', 10));
    assert(r1.approved === false && r1.reason === 'reservation_outcome_unknown' && r1.runId === 'run-e1', '5-1. 予約処理の例外は「結果不明」→ 呼び出し不可（同じ runId で照合）');
    const g2 = sg.createSpendGate({ mode: 'local_verification', store: makeFakeStore({ reserveReturns: { ok: true } }), limits: LIMITS });
    assert((await g2.reserve(req('run-e2', 10))).reason === 'reservation_outcome_unknown', '5-2. 形の分からない応答も結果不明');
    const g3 = sg.createSpendGate({ mode: 'local_verification', store: makeFakeStore({ omitRemaining: true }), limits: LIMITS });
    const r3 = await g3.reserve(req('run-e3', 10));
    assert(r3.approved === false && r3.reason === 'remaining_unknown' && r3.mustReconcile === true, '5-3. 残額が返らない予約は使わない（照合が必要）');
    const g4 = sg.createSpendGate({ mode: 'local_verification', store: null, limits: LIMITS });
    assert((await g4.reserve(req('run-e4', 10))).reason === 'store_missing', '5-4. ストア未設定は不可');
    const st5 = makeFakeStore(); delete st5.settle;
    assert((await sg.createSpendGate({ mode: 'local_verification', store: st5, limits: LIMITS }).reserve(req('run-e5', 10))).reason === 'store_method_missing:settle', '5-5. 必要な操作が欠けたストアは不可');
    for (const [label, lim] of [['未設定', null], ['日次なし', Object.assign({}, LIMITS, { dailyLimit: undefined })], ['単位なし', Object.assign({}, LIMITS, { amountUnit: '' })], ['TZなし', Object.assign({}, LIMITS, { timeZone: '' })], ['1実行>日次', Object.assign({}, LIMITS, { perRunLimit: 200 })]]) {
      const st = makeFakeStore(); const r = await sg.createSpendGate({ mode: 'local_verification', store: st, limits: lim }).reserve(req('run-l1', 10));
      assert(r.approved === false && st.calls.reserveAtomic === 0, '5-6. 上限' + label + ' → 不可・ストアを呼ばない（' + r.reason + '）');
    }
    const st7 = makeFakeStore({ throwOnSettle: true }); const g7 = sg.createSpendGate({ mode: 'local_verification', store: st7, limits: LIMITS });
    await g7.reserve(req('run-e7', 10)); await g7.markInvoked({ runId: 'run-e7' });
    const s7 = await g7.settle({ runId: 'run-e7', settledAmount: 5, basis: 'usage_tokens' });
    assert(s7.ok === false && s7.reason === 'store_outcome_unknown' && st7.calls.settle === 1, '5-7. 精算の例外は結果不明・再試行しない');
  }

  caseHeader('6. 呼び出し前の中止と、呼び出し後の失敗を区別する');
  {
    const store = makeFakeStore(); const g = sg.createSpendGate({ mode: 'local_verification', store, limits: LIMITS });
    await g.reserve(req('run-f1', 30));
    const rel = await g.releaseBeforeCall({ runId: 'run-f1', reason: 'writer_dependency_missing' });
    assert(rel.ok === true && store.rows.get('run-f1').state === 'released', '6-1. 呼び出し前（reserved）は解放できる');
    await g.reserve(req('run-f2', 30)); await g.markInvoked({ runId: 'run-f2' });
    const rel2 = await g.releaseBeforeCall({ runId: 'run-f2', reason: 'writer_failed' });
    assert(rel2.ok === false && store.rows.get('run-f2').state === 'invoked', '6-2. 呼び出し後（invoked）は解放しない');
    const rel3 = await g.releaseBeforeCall({ runId: 'run-f2' });
    assert(rel3.ok === false && rel3.reason === 'release_reason_missing', '6-3. 解放には理由が必要');
  }

  caseHeader('7. 呼び出し後の timeout で予約を保持');
  {
    const store = makeFakeStore(); const g = sg.createSpendGate({ mode: 'local_verification', store, limits: LIMITS });
    await g.reserve(req('run-t1', 50)); await g.markInvoked({ runId: 'run-t1' });
    const u = await g.markOutcomeUnknown({ runId: 'run-t1', detail: 'timeout' });
    assert(u.ok === true && store.rows.get('run-t1').state === 'outcome_unknown', '7-1. timeout → outcome_unknown（予約を保持）');
    const rel = await g.releaseBeforeCall({ runId: 'run-t1', reason: 'timeout' });
    assert(rel.ok === false && store.rows.get('run-t1').state === 'outcome_unknown', '7-2. 結果不明の予約は解放できない');
    assert((await g.reserve(req('run-t2', 51))).reason === 'daily_limit_exceeded', '7-3. 結果不明の予約は残額に計上され続ける');
    const s = await g.settle({ runId: 'run-t1', settledAmount: 45, basis: 'provider_usage_reconciled' });
    assert(s.ok === true && store.rows.get('run-t1').state === 'settled', '7-4. 照合後に推定費用で精算できる');
    const src = fs.readFileSync(path.join(__dirname, 'lib', 'spendGate.js'), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert(!/expire|\bttl\b|setTimeout|setInterval/i.test(src), '7-5. 期限切れによる自動解放の経路がない');
  }

  caseHeader('8. 不明な費用・負の値など不正入力');
  {
    const store = makeFakeStore(); const g = sg.createSpendGate({ mode: 'local_verification', store, limits: LIMITS });
    const bad = [
      ['見積り未指定', req('run-g1', undefined)], ['負の値', req('run-g2', -5)], ['0', req('run-g3', 0)],
      ['小数', req('run-g4', 1.5)], ['文字列', req('run-g5', '10')], ['NaN', req('run-g6', NaN)],
      ['巨大値', req('run-g7', Number.MAX_SAFE_INTEGER + 2)], ['runId 不正', req('x', 10)],
      ['期間なし', Object.assign(req('run-g8', 10), { period: null })],
      ['TZ 不一致', req('run-g9', 10, { dayKey: '2026-10-09', monthKey: '2026-10', timeZone: 'UTC' })],
      ['日が月外', req('run-g10', 10, { dayKey: '2026-11-01', monthKey: '2026-10', timeZone: 'Asia/Tokyo' })],
      ['provider なし', Object.assign(req('run-g11', 10), { provider: '' })],
    ];
    for (const [label, r] of bad) {
      const out = await g.reserve(r);
      assert(out.approved === false, '8. ' + label + ' → 不可（' + out.reason + '）');
    }
    assert(store.calls.reserveAtomic === 0, '8-x. 不正入力ではストアを呼ばない');
    await g.reserve(req('run-g20', 10)); await g.markInvoked({ runId: 'run-g20' });
    const s1 = await g.settle({ runId: 'run-g20', settledAmount: -1, basis: 'x' });
    const s2 = await g.settle({ runId: 'run-g20', settledAmount: 2.5, basis: 'x' });
    const s3 = await g.settle({ runId: 'run-g20', settledAmount: 3 });
    assert(s1.reason === 'invalid_settled_amount' && s2.reason === 'invalid_settled_amount' && s3.reason === 'settle_basis_missing', '8-y. 精算の負・小数・根拠なしは拒否');
    assert(sg.decimalToMinorUnits('51.7504', 6) === 51750400 && sg.decimalToMinorUnits('51.75049', 4) === null && sg.decimalToMinorUnits('-1', 6) === null && sg.decimalToMinorUnits('1e3', 0) === null, '8-z. 10進文字列→整数の最小単位（浮動小数・丸め・負・指数表記なし）');
  }

  caseHeader('9. 入力を変更しない・静的境界');
  {
    const store = makeFakeStore();
    const lim = deepFreeze(Object.assign({}, LIMITS));
    const r = deepFreeze(req('run-h1', 10));
    const before = JSON.stringify([lim, r]);
    const g = sg.createSpendGate({ mode: 'local_verification', store, limits: lim });
    const out = await g.reserve(r);
    assert(out.approved === true && JSON.stringify([lim, r]) === before, '9-1. 凍結した上限・要求でも動き、入力は変わらない');
    assert(out.isBillingCeiling === false, '9-2. 予約は請求額の上限保証ではないと明示');
    const src = fs.readFileSync(path.join(__dirname, 'lib', 'spendGate.js'), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert(!/Date\.now|new Date|Math\.random|process\.env/.test(src), '9-3. 日付・乱数・環境変数を参照しない');
    assert(!/require\(/.test(src.replace(/^'use strict';/, '')), '9-4. 外部モジュール（DB・provider・ネットワーク）を require しない');
    assert(!/while\s*\(|retry/i.test(src), '9-5. 再試行の経路がない');
  }

  caseHeader('10. 実行モード（本番では未実証・偽のストアを使わない）');
  {
    const st = makeFakeStore();
    const none = await sg.createSpendGate({ store: st, limits: LIMITS }).reserve(req('run-m1', 10));
    assert(none.approved === false && none.reason === 'gate_mode_not_configured' && st.calls.reserveAtomic === 0, '10-1. モード未指定は予約しない');
    const bad = await sg.createSpendGate({ mode: 'prod', store: st, limits: LIMITS }).reserve(req('run-m2', 10));
    assert(bad.reason === 'gate_mode_not_configured', '10-2. 未知のモードも予約しない');
    const fakeProd = await sg.createSpendGate({ mode: 'production', store: st, limits: LIMITS }).reserve(req('run-m3', 10));
    assert(fakeProd.approved === false && fakeProd.reason === 'local_fake_store_not_allowed_in_production' && st.calls.reserveAtomic === 0, '10-3. 本番モードで偽ストアは使わない');
    const unverified = Object.assign(makeFakeStore(), {}); unverified.capabilities = { kind: 'postgres_rpc', atomicReserve: true, atomicityVerified: false };
    const uv = await sg.createSpendGate({ mode: 'production', store: unverified, limits: LIMITS }).reserve(req('run-m4', 10));
    assert(uv.reason === 'store_atomicity_not_verified' && unverified.calls.reserveAtomic === 0, '10-4. 本番モードで原子性が未実証のストアは使わない');
    const verified = makeFakeStore(); verified.capabilities = { kind: 'postgres_rpc', atomicReserve: true, atomicityVerified: true };
    const vv = await sg.createSpendGate({ mode: 'production', store: verified, limits: LIMITS }).reserve(req('run-m5', 10));
    assert(vv.approved === true && vv.mode === 'production', '10-5. 実証済みと宣言されたストアだけ本番モードで予約できる（宣言は呼び出し側の責任）');
    const lv = await sg.createSpendGate({ mode: 'local_verification', store: makeFakeStore(), limits: LIMITS }).reserve(req('run-m6', 10));
    assert(lv.approved === true && lv.mode === 'local_verification', '10-6. ローカル検証モードの予約は mode で区別される');
    const src = fs.readFileSync(path.join(__dirname, 'lib', 'spendGate.js'), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert(!/atomicityVerified\s*=\s*true/.test(src), '10-7. gate が原子性を自動で verified にする経路がない');
  }

  caseHeader('11. 明確な拒否と結果不明の区別（どちらも呼び出し不可）');
  {
    for (const outcome of ['period_mismatch', 'spend_stopped', 'limits_not_configured', 'limits_mismatch', 'unit_mismatch', 'per_run_limit_exceeded']) {
      const st = makeFakeStore({ reserveReturns: { outcome } });
      const r = await sg.createSpendGate({ mode: 'local_verification', store: st, limits: LIMITS }).reserve(req('run-d-' + outcome.replace(/_/g, '-'), 10));
      assert(r.approved === false && r.reason === outcome && r.definitive === true && !r.mustReconcile, '11. ' + outcome + ' → 明確な拒否（照合不要）');
    }
    const unk = await sg.createSpendGate({ mode: 'local_verification', store: makeFakeStore({ reserveReturns: { outcome: 'something_new' } }), limits: LIMITS }).reserve(req('run-d-unk', 10));
    assert(unk.approved === false && unk.reason === 'reservation_outcome_unknown' && unk.definitive === false && unk.mustReconcile === true, '11-x. 未知の応答は結果不明（照合が必要）');
    const thr = await sg.createSpendGate({ mode: 'local_verification', store: makeFakeStore({ throwOnReserve: true }), limits: LIMITS }).reserve(req('run-d-thr', 10));
    assert(thr.definitive === false && thr.mustReconcile === true, '11-y. 例外は結果不明（照合が必要）');
    const st2 = makeFakeStore(); const g2 = sg.createSpendGate({ mode: 'local_verification', store: st2, limits: LIMITS });
    let seen = null; const orig = st2.reserveAtomic; st2.reserveAtomic = async (a) => { seen = a; return orig(a); };
    await g2.reserve(req('run-d-lim', 10));
    assert(seen && seen.dailyLimit === 100 && seen.monthlyLimit === 250 && seen.perRunLimit === 80, '11-z. 用途別の上限を照合用としてストアへ渡す');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed === 0) {
    console.log('🟢 All spendGate cases passed（偽ストアでの検証・実 DB の原子性の実証ではない）');
  } else {
    console.log('🔴 Some cases failed');
    process.exit(1);
  }
})().catch(function (e) { console.error('テスト実行エラー:', e && e.stack); process.exit(1); });
