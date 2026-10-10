'use strict';
// dailyProductionService.test.js
// Instagram Daily Production — Draft 変換（shared/dailyDraftAdapter.js）と
// 1本制作パイプライン（lib/dailyProductionService.js：予算ゲート接続・認可の束縛・評価してから保存）のローカルテスト。
//
//   実HTTP 0 / 実AI API 0 / Web 検索 0 / DB 0 / Storage 0 / 本番API 0 / 環境変数 0 / 課金 0。
//   依存は tools/dailyProduction/runOnce.js のメモリ内の偽物（予算ストアはプロセス内でだけ原子的）。
//   根拠・確認記録・文案・使用量は LOCAL FIXTURE（検証用）。偽認可は Human 認可ではない。

const fs = require('fs');
const path = require('path');
const service = require('./lib/dailyProductionService');
const adapter = require('./shared/dailyDraftAdapter');
const contract = require('./shared/dailyProductionContract');
const { parseFieldSlide } = require('./shared/carouselImageCore');   // 既存の実関数
const local = require('./tools/dailyProduction/runOnce');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function deepFreeze(o) { Object.freeze(o); Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object' && !Object.isFrozen(o[k])) deepFreeze(o[k]); }); return o; }

const PACK = clone(local.LOCAL_FIXTURE_PACK);
const COPY = JSON.parse(local.FAKE_WRITER_OUTPUT);

// 呼び出し回数を数える依存（ローカルの偽物を包む）
function makeDeps(over) {
  const base = local.createLocalDeps();
  const calls = { writer: 0, reserve: 0, markInvoked: 0, release: 0, markUnknown: 0, settle: 0, cv: 0, insert: 0, authorize: 0 };
  const g = base.spendGate;
  const deps = Object.assign({}, base, {
    authorize: async (a) => { calls.authorize++; return base.authorize(a); },
    spendGate: {
      reserve: async (r) => { calls.reserve++; return g.reserve(r); },
      markInvoked: async (r) => { calls.markInvoked++; return g.markInvoked(r); },
      releaseBeforeCall: async (r) => { calls.release++; return g.releaseBeforeCall(r); },
      markOutcomeUnknown: async (r) => { calls.markUnknown++; return g.markOutcomeUnknown(r); },
      settle: async (r) => { calls.settle++; return g.settle(r); },
    },
    callWriter: async (a) => { calls.writer++; return base.callWriter(a); },
    evaluateContentValue: async (d, o) => { calls.cv++; return base.evaluateContentValue(d, o); },
    insertDraftIfAbsent: async (p) => { calls.insert++; return base.insertDraftIfAbsent(p); },
  });
  if (over) Object.assign(deps, over(calls, deps, base));
  return { deps, calls, base };
}
async function run(over, inputOver) {
  const m = makeDeps(over);
  const r = await service.runDailyProduction(local.localInput(inputOver), m.deps);
  return { r, calls: m.calls, base: m.base, state: (m.base.spendStore.rows.get(r.runId) || {}).state };
}

(async function main() {
  // ────────────────────────────────────────────────────────────
  caseHeader('1. 正常系：5枚・改行・根拠メモを維持し、確認待ちで止まる');
  {
    const { r, calls, base, state } = await run();
    assert(r.status === 'awaiting_human_review' && r.approval === 'not_approved', '1-1. awaiting_human_review・未承認');
    assert(r.stages.map(s => s.stage).join(',') === service.STAGES.join(',') && r.stages.every(s => s.status === 'ok'), '1-2. 全段階が順番どおり ok');
    assert(calls.reserve === 1 && calls.markInvoked === 1 && calls.writer === 1 && calls.settle === 1 && calls.release === 0 && r.retries === 0, '1-3. 予約→invoked→Writer 1回→精算、解放0・再試行0');
    assert(state === 'settled' && r.billing.state === 'settled' && r.billing.settledAmount === 300000 && r.billing.unit === 'micro_jpy', '1-4. 予約は推定費用で精算済み（整数・単位明示）');
    const saved = base.drafts.get('out_local_daily_fixture');
    assert(saved && saved.type === 'instagram_carousel' && saved.contentType === 'value' && saved.fields.slides.length === 5, '1-5. 明示型・5枚で保存');
    assert(saved.contentValue && typeof saved.contentValue.status === 'string' && saved.status === 'ready', '1-6. 本文と評価をまとめて保存（status ready＝生成完了の語彙）');
    assert(saved.fields.slides[2].split('\n').length === 3 && saved.fields.dailyProduction.evidenceMemo.length === 4, '1-7. 改行と根拠メモを維持');
    assert(r.authorization.kind === 'local_fake' && saved.authorizationId === 'auth-local-fake-0001' && saved.runId === 'run-local-0001', '1-8. 偽認可は kind=local_fake として記録（Human 認可とは扱わない）');
    const order = r.stages.map(s => s.stage);
    assert(order.indexOf('content_value') < order.indexOf('save'), '1-9. 評価してから保存');
  }

  caseHeader('2. 実 parseFieldSlide で見出し・本文・改行が一致（変換）');
  {
    const spec = contract.buildProductionSpec(PACK).spec;
    const a = adapter.buildDraftFields(COPY, spec, PACK);
    let allMatch = true;
    COPY.slides.forEach(function (s, i) {
      const p = parseFieldSlide(a.draft.fields.slides[i]);
      if (p.headline !== s.headline || p.body !== s.lines.map(l => l.text).join('\n') || p.visualDirection !== '') allMatch = false;
    });
    assert(a.ok && allMatch, '2-1. 5枚すべてで headline・body（改行込み）が一致');
    const bad = clone(COPY); bad.slides[2].lines[0].text = '本文：ぬるま湯でぬらす';
    assert(adapter.buildDraftFields(bad, spec, PACK).issues.some(i => i.code === 'reserved_marker_in_text'), '2-2. 区切り記号を含む本文は変換しない');
    const f = a.draft.fields;
    assert(!/https?:\/\//.test([f.caption, f.cta].concat(f.hashtags).concat(f.slides).join('\n')) && f.dailyProduction.evidenceMemo.every(m => m.sources[0].url.indexOf('https://') === 0), '2-3. 投稿本文に URL なし・出典URLは根拠メモ側');
  }

  caseHeader('3. 依存・入力の不足では予約0件・Writer 0回');
  {
    for (const key of ['callWriter', 'evaluateContentValue', 'insertDraftIfAbsent', 'estimateCostFromUsage', 'authorize', 'computePackHash']) {
      const { r, calls } = await run((c, d) => { const o = {}; o[key] = undefined; return o; });
      assert(r.failedStage === 'input' && r.reason === 'dependency_missing' && r.stages[0].missing.includes(key) && calls.reserve === 0 && calls.writer === 0, '3. ' + key + ' がない → 予約0・Writer 0');
    }
    const g = await run((c, d) => ({ spendGate: { reserve: d.spendGate.reserve } }));
    assert(g.r.reason === 'dependency_missing' && g.r.stages[0].missing.includes('spendGate.markInvoked') && g.calls.reserve === 0, '3-b. 予算ゲートの操作が欠けていれば予約0');
    for (const [label, over] of [['runId', { runId: 'x' }], ['contentHash', { contentHash: 'abc' }], ['packVersion', { packVersion: 0 }], ['見積り', { estimate: { amount: 1.5, unit: 'micro_jpy' } }], ['期間', { period: null }], ['outputId', { outputId: '' }]]) {
      const { r, calls } = await run(null, over);
      assert(r.failedStage === 'input' && calls.reserve === 0 && calls.writer === 0, '3-c. ' + label + ' が不正 → 予約0・Writer 0（' + r.reason + '）');
    }
  }

  caseHeader('4. 認可の ID／版／hash 不一致では予約・Writer とも0');
  {
    const h = await run(null, { contentHash: 'f'.repeat(64) });
    assert(h.r.failedStage === 'pack' && h.r.reason === 'content_hash_mismatch' && h.calls.authorize === 0 && h.calls.reserve === 0, '4-1. 渡したパックの hash が contentHash と違う → 停止');
    const fields = ['runId', 'caseId', 'outputId', 'topicId', 'packVersion', 'contentHash'];
    for (const k of fields) {
      const { r, calls } = await run((c, d, base) => ({ authorize: async (a) => { c.authorize++; const res = await base.authorize(a); res.target[k] = k === 'packVersion' ? 99 : (k === 'contentHash' ? '0'.repeat(64) : 'other-value'); return res; } }));
      assert(r.reason === 'authorization_target_mismatch' && calls.reserve === 0 && calls.writer === 0, '4-2. 認可の ' + k + ' 不一致 → 予約0・Writer 0');
    }
    const rv = await run((c, d, base) => ({ authorize: async (a) => { const res = await base.authorize(a); res.review.packVersion = 2; return res; } }));
    assert(rv.r.reason === 'review_target_mismatch' && rv.calls.reserve === 0, '4-3. 確認記録の版が認可と不一致 → 停止');
    const nr = await run((c, d, base) => ({ authorize: async (a) => { const res = await base.authorize(a); delete res.review; return res; } }));
    assert(nr.r.reason === 'review_target_mismatch' && nr.calls.writer === 0, '4-4. 確認記録がない認可は使わない');
    const na = await run(() => ({ authorize: async () => ({ authorized: true }) }));
    assert(na.r.reason === 'not_authorized' && na.calls.reserve === 0, '4-5. 認可IDや種類のない応答は認可とみなさない');
    const unv = clone(PACK); unv.status = 'unverified';
    const u = await run(null, { pack: unv, contentHash: local.computePackHash(unv) });
    assert(u.r.failedStage === 'pack' && u.calls.authorize === 0 && u.calls.reserve === 0, '4-6. パックの申告が未確認なら認可・予約に進まない');
  }

  caseHeader('5. 予約の拒否・不明では Writer 0回');
  {
    const a = await run(null, { estimate: { amount: 2000000, unit: 'micro_jpy' } });
    assert(a.r.failedStage === 'reserve' && a.r.reason === 'per_run_limit_exceeded' && a.calls.writer === 0 && a.calls.markInvoked === 0, '5-1. 1実行の上限超え → Writer 0');
    const b = await run((c) => ({ spendGate: Object.assign({}, makeDeps().deps.spendGate, { reserve: async () => { c.reserve++; throw new Error('timeout'); } }) }));
    assert(b.r.reason === 'reservation_outcome_unknown' && b.r.billing.state === 'reservation_unknown' && b.calls.writer === 0, '5-2. 予約の例外（結果不明）→ Writer 0');
    const c2 = await run((c) => ({ spendGate: Object.assign({}, makeDeps().deps.spendGate, { reserve: async () => { c.reserve++; return { ok: true }; } }) }));
    assert(c2.r.failedStage === 'reserve' && c2.calls.writer === 0, '5-3. 承認かどうか分からない応答 → Writer 0');
    const u = await run(null, { estimate: { amount: 500000, unit: 'jpy' } });
    assert(u.r.reason === 'estimate_unit_mismatch' && u.calls.writer === 0 && u.calls.release === 1 && u.state === 'released', '5-4. 見積りの単位違い → 呼び出し前の中止として解放・Writer 0');
  }

  caseHeader('6. markInvoked の失敗・不明では Writer 0回');
  {
    const a = await run((c, d) => ({ spendGate: Object.assign({}, d.spendGate, { markInvoked: async () => { c.markInvoked++; return { ok: false, reason: 'invalid_state:released' }; } }) }));
    assert(a.r.failedStage === 'invoke_mark' && a.calls.writer === 0 && a.calls.release === 1 && a.state === 'released', '6-1. 明確な失敗 → Writer 0・呼び出し前として解放');
    const b = await run((c, d) => ({ spendGate: Object.assign({}, d.spendGate, { markInvoked: async () => { c.markInvoked++; throw new Error('db timeout'); } }) }));
    assert(b.r.failedStage === 'invoke_mark' && b.calls.writer === 0 && b.calls.release === 0 && b.state === 'reserved' && b.r.billing.state === 'reserved_or_invoked_unknown', '6-2. 結果不明 → Writer 0・解放しない（照合が必要）');
  }

  caseHeader('7. 同一 runId の二重起動で Writer は最大1回');
  {
    const m = makeDeps();
    const r1 = await service.runDailyProduction(local.localInput(), m.deps);
    const r2 = await service.runDailyProduction(local.localInput({ outputId: 'out_other' }), m.deps);
    assert(r1.status === 'awaiting_human_review' && r2.failedStage === 'reserve' && r2.reason === 'duplicate_run' && m.calls.writer === 1, '7-1. 2回目は duplicate_run で停止（Writer 合計1回）');
    const m2 = makeDeps();
    const [p1, p2] = await Promise.all([service.runDailyProduction(local.localInput(), m2.deps), service.runDailyProduction(local.localInput(), m2.deps)]);
    assert(m2.calls.writer === 1 && [p1, p2].filter(x => x.reason === 'duplicate_run').length === 1, '7-2. 同時の二重起動でも Writer は1回だけ');
  }

  caseHeader('8. Writer の timeout 後は予約を保持し、解放・再試行0回');
  {
    const a = await run((c) => ({ callWriter: async () => { c.writer++; throw new Error('ETIMEDOUT'); } }));
    assert(a.r.failedStage === 'writer' && a.r.reason === 'writer_outcome_unknown' && a.calls.writer === 1 && a.r.retries === 0, '8-1. timeout → 1回だけ・再試行0');
    assert(a.calls.release === 0 && a.calls.settle === 0 && a.state === 'outcome_unknown' && a.r.billing.state === 'outcome_unknown', '8-2. 予約は outcome_unknown として保持（解放0・精算0）');
    const b = await run((c, d) => ({
      callWriter: async () => { c.writer++; throw new Error('ECONNRESET'); },
      spendGate: Object.assign({}, d.spendGate, { markOutcomeUnknown: async () => { c.markUnknown++; throw new Error('db down'); } }),
    }));
    assert(b.calls.release === 0 && b.calls.writer === 1 && b.state === 'invoked' && b.r.billing.state === 'invoked_mark_unknown_failed', '8-3. 状態更新が失敗しても解放・再実行しない（invoked のまま保持）');
  }

  caseHeader('9. 文案不合格でも、呼んだ Writer の費用は保持または精算');
  {
    const bad = clone(COPY); bad.slides = bad.slides.slice(0, 4);
    const a = await run((c) => ({ callWriter: async () => { c.writer++; return { text: JSON.stringify(bad), usage: { inputTokens: 1, outputTokens: 1 } }; } }));
    assert(a.r.failedStage === 'copy_check' && a.state === 'settled' && a.calls.release === 0 && a.calls.insert === 0, '9-1. 枚数違い → 保存0、費用は精算（解放しない）');
    const b = await run((c) => ({ callWriter: async () => { c.writer++; return { text: '{ broken', usage: { inputTokens: 1, outputTokens: 1 } }; } }));
    assert(b.r.reason === 'invalid_json' && b.state === 'settled' && b.calls.release === 0, '9-2. 不正 JSON → 費用は精算・保存0');
  }

  caseHeader('10. 使用量が不明なら精算済みと扱わない');
  {
    const a = await run((c) => ({ callWriter: async () => { c.writer++; return { text: local.FAKE_WRITER_OUTPUT }; } }));
    assert(a.calls.settle === 0 && a.state === 'invoked' && a.r.billing.state === 'invoked_usage_unknown' && a.r.billing.settledAmount === null, '10-1. 使用量なし → 精算しない・予約を保持');
    assert(a.r.status === 'awaiting_human_review', '10-2. 制作自体は確認待ちまで進む（費用は未精算として残る）');
    const b = await run(() => ({ estimateCostFromUsage: async () => ({ amount: 300000, unit: 'micro_jpy' }) }));
    assert(b.calls.settle === 0 && b.r.billing.state === 'invoked_usage_unknown', '10-3. 精算根拠（basis）がない推定は使わない');
    const c3 = await run(() => ({ estimateCostFromUsage: async () => ({ amount: -1, unit: 'micro_jpy', basis: 'x' }) }));
    assert(c3.calls.settle === 0 && c3.state === 'invoked', '10-4. 負の推定費用は使わない');
    const d = await run((c, deps) => ({ spendGate: Object.assign({}, deps.spendGate, { settle: async () => { c.settle++; throw new Error('timeout'); } }) }));
    assert(d.r.billing.state === 'invoked_settle_failed' && d.calls.settle === 1 && d.state === 'invoked', '10-5. 精算の失敗 → 予約を保持・再試行しない');
  }

  caseHeader('11. 評価失敗なら保存0件・低評価でも自動承認しない');
  {
    const a = await run((c) => ({ evaluateContentValue: async () => { c.cv++; throw new Error('boom'); } }));
    assert(a.r.failedStage === 'content_value' && a.calls.insert === 0 && a.state === 'settled', '11-1. 評価の例外 → 保存0（費用は精算のまま）');
    const b = await run((c) => ({ evaluateContentValue: async () => { c.cv++; return { status: 'insufficient', score: 0, blockingReasons: ['exception:x is undefined'] }; } }));
    assert(b.r.reason === 'content_value_evaluation_exception' && b.calls.insert === 0, '11-2. 既存評価の内部例外（insufficient に包まれたもの）は計算失敗として保存0');
    const c4 = await run((c) => ({ evaluateContentValue: async () => { c.cv++; return { status: 'great', score: 90 }; } }));
    assert(c4.r.reason === 'content_value_status_invalid' && c4.calls.insert === 0, '11-3. 未知の status は保存0');
    const d = await run((c) => ({ evaluateContentValue: async () => { c.cv++; return { status: 'insufficient', score: 12, blockingReasons: ['evidence_insufficient'] }; } }));
    assert(d.r.status === 'awaiting_human_review' && d.r.approval === 'not_approved' && d.calls.insert === 1 && d.r.contentValue.status === 'insufficient', '11-4. 低評価（insufficient）は計算失敗と区別し、未承認の確認待ちとして保存');
    const e = await run((c) => ({ evaluateContentValue: async () => { c.cv++; return { status: 'complete', score: 95, blockingReasons: [] }; } }));
    assert(e.r.approval === 'not_approved', '11-5. 高評価でも自動承認しない');
  }

  caseHeader('12. 保存失敗・結果不明で再保存しない・既存 outputId を上書きしない');
  {
    const a = await run((c) => ({ insertDraftIfAbsent: async () => { c.insert++; return { ok: false }; } }));
    assert(a.r.reason === 'save_failed' && a.calls.insert === 1 && a.r.saved === false, '12-1. 保存失敗 → 1回だけ・failed');
    const b = await run((c) => ({ insertDraftIfAbsent: async () => { c.insert++; throw new Error('timeout'); } }));
    assert(b.r.reason === 'save_outcome_unknown' && b.calls.insert === 1 && b.r.retries === 0, '12-2. 保存の結果不明 → 再保存しない（新しい ID も作らない）');
    const m = makeDeps();
    m.base.drafts.set('out_local_daily_fixture', { existing: true, fields: { slides: ['既存'] } });
    const r = await service.runDailyProduction(local.localInput(), m.deps);
    assert(r.reason === 'output_already_exists' && JSON.stringify(m.base.drafts.get('out_local_daily_fixture')) === JSON.stringify({ existing: true, fields: { slides: ['既存'] } }), '12-3. 既存の outputId は上書きしない');
  }

  caseHeader('13. 入力を変更しない・同じ入力の変換結果が同じ・静的境界');
  {
    const frozen = deepFreeze(clone(local.localInput()));
    const before = JSON.stringify(frozen);
    const m = makeDeps();
    const r = await service.runDailyProduction(frozen, m.deps);
    assert(r.status === 'awaiting_human_review' && JSON.stringify(frozen) === before, '13-1. 凍結した入力でも動き、入力は変わらない');
    const spec = contract.buildProductionSpec(PACK).spec;
    assert(JSON.stringify(adapter.buildDraftFields(COPY, spec, PACK)) === JSON.stringify(adapter.buildDraftFields(COPY, spec, PACK)), '13-2. 変換は決定論');
    const strip = s => s.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    const svc = strip(fs.readFileSync(path.join(__dirname, 'lib', 'dailyProductionService.js'), 'utf8'));
    const tool = strip(fs.readFileSync(path.join(__dirname, 'tools', 'dailyProduction', 'runOnce.js'), 'utf8'));
    const forbidden = /openaiClient|claudeClient|supabase|dotenv|\.env\.local|process\.env|axios|fetch\(|require\(['"](http|https|net|child_process)['"]\)|costTracker|outputDraftsDb|contentValueService/;
    assert(!forbidden.test(svc) && !forbidden.test(tool), '13-3. 実 provider・DB・環境変数・ネットワークを参照しない');
    assert(!/Date\.now|new Date|Math\.random/.test(svc + tool), '13-4. 日付・乱数を参照しない');
    assert((svc.match(/deps\.callWriter\(/g) || []).length === 1 && !/while\s*\(|retry/i.test(svc), '13-5. Writer 呼び出しはコード上1か所・再試行なし');
    assert(/process\.argv\.length > 2/.test(tool) && !/--real|--provider|--live/.test(tool), '13-6. runOnce は引数を受け付けず、実 provider 起動オプションがない');
    const { result } = await local.runLocal();
    assert(result.status === 'awaiting_human_review' && result.authorization.kind === 'local_fake', '13-7. runOnce も同じ接続経路（偽認可は local_fake）');
  }

  caseHeader('14. 予約の明確な拒否と結果不明を区別し、予算モードを記録');
  {
    const a = await run(null, { estimate: { amount: 2000000, unit: 'micro_jpy' } });
    assert(a.r.billing.state === 'refused' && a.r.stages.slice(-1)[0].definitive === true && a.calls.writer === 0, '14-1. 明確な拒否（1実行の上限）→ refused・Writer 0');
    const b = await run((c, d) => ({ spendGate: Object.assign({}, d.spendGate, { reserve: async () => { c.reserve++; return { ok: false, approved: false, reason: 'reservation_outcome_unknown', definitive: false }; } }) }));
    assert(b.r.billing.state === 'reservation_unknown' && b.calls.writer === 0, '14-2. 結果不明 → reservation_unknown・Writer 0');
    const c2 = await run((c, d) => ({ spendGate: Object.assign({}, d.spendGate, { reserve: async () => { c.reserve++; return { ok: false, approved: false, reason: 'period_mismatch', definitive: true }; } }) }));
    assert(c2.r.reason === 'period_mismatch' && c2.r.billing.state === 'refused' && c2.calls.writer === 0, '14-3. DB の明確な拒否（期間の不一致）→ refused・Writer 0');
    const ok = await run();
    assert(ok.r.billing.mode === 'local_verification' && ok.r.billing.productionBilling === false, '14-4. ローカルの予約は local_verification として記録（本番の有料実行ではない）');
    assert(ok.base.spendStore.capabilities.kind === 'local_fake', '14-5. runOnce の予算ストアは偽ストアとして区別される');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed === 0) {
    console.log('🟢 All Instagram Daily Production service cases passed（ローカル・偽物での検証）');
  } else {
    console.log('🔴 Some cases failed');
    process.exit(1);
  }
})().catch(function (e) { console.error('テスト実行エラー:', e && e.stack); process.exit(1); });
