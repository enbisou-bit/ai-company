'use strict';
// lib/dailyProductionService.js
// Instagram Daily Production — 1本制作パイプライン（依存注入・ローカル接続用）。
//
//   目的: Human が確認・認可したテーマパックから、予算予約の状態遷移を守って Writer を1回だけ呼び、
//         ルール検査 → Draft 変換 → Content Value 計算 → 本文と評価をまとめて新規保存までを行い、
//         Human の確認待ち（awaiting_human_review）として返す。
//
//   順序（各段階の失敗は区別して返す。後段へは進まない。自動再試行は0回）:
//     0. input          ID・版・hash・期間・見積りの形式と、必要な依存がすべて揃っていること
//                       （ここで止まれば予約も Writer も0件）
//     1. pack           テーマパックの形式検証（パック内の申告）＋ 渡された pack の hash が contentHash と一致
//     2. authorization  制作認可が対象（runId・caseId・outputId・topicId・packVersion・contentHash）に束縛され、
//                       確認記録の対象（topicId・packVersion・contentHash）とも一致すること
//     3. spec           制作仕様（5枚で成立しないテーマは停止）
//     4. reserve        見積額・単位・期間を明示して予約（拒否・重複・不明なら停止。Writer 0）
//     5. invoke_mark    予約を invoked に遷移（失敗・不明なら Writer を呼ばない）
//     6. writer         Writer を1回だけ呼ぶ
//                         例外・timeout → outcome_unknown として予約を保持（解放しない）
//                         応答あり → 使用量と精算根拠が揃えば settle。揃わなければ invoked のまま保持
//     7. copy_check     JSON 解析と文案のルール検査（不合格でも Writer の費用は解放しない）
//     8. adapt          既存 Draft 形式へ変換
//     9. content_value  Content Value を計算し、結果の形を検証（例外・不正なら保存0件）
//    10. save           本文と評価をまとめて新規保存（同じ outputId は上書きしない。不明なら再保存しない）
//    → awaiting_human_review（approval は常に not_approved）
//
//   予算予約の状態（lib/spendGate.js）:
//     reserved → invoked → settled           （使用量と精算根拠が揃った場合だけ）
//     reserved → released                    （呼び出し前の確実な中止だけ）
//     invoked  → outcome_unknown             （timeout・通信エラー。予約を保持）
//     invoked のまま                          （応答はあったが使用量が不明。予約を保持）
//     ★ 状態更新が失敗しても、予約を解放したり、処理を再実行したりしない。
//
//   Content Value の接続境界:
//     - 既存 lib/contentValueService.resolveContentValueForSave() は、保存済みの行の canonical content_type を
//       読み書きする（setContentTypeIfUnset / getContentTypeCanonical）ため、保存前には使えない。
//       返り値は { contentType, contentTypeApplied, contentTypeSource, reviewerNovelty, contentValue, reasons }。
//     - 本パイプラインは保存前に deps.evaluateContentValue（既存 shared/contentValueQuality.evaluateContentValue
//       と同じ返り値の形）を contentType: 'value' 明示で呼び、その contentValue をそのまま保存する。
//     - 既存の evaluateContentValue は内部の例外を捕まえて status:'insufficient' を返し、
//       blockingReasons に 'exception:…' を残す。これは低評価ではなく計算失敗として扱う。
//     - status の語彙: insufficient / needs_work / almost_ready / complete（いずれも承認ではない）。
//
//   ★ Draft の status:'ready' は既存の「AI の生成完了」の語彙。公開準備完了・承認済みを意味しない。
//   ★ 実 provider・本番 DB・Storage・環境変数・.env.local・日付・乱数を直接参照しない（すべて deps 経由）。
//   ★ 実 DB の insert-only（新規専用）保証は未実装。ここでは注入された insertDraftIfAbsent の応答を信じるだけ。

const topicPack = require('../shared/dailyTopicPack');
const contract = require('../shared/dailyProductionContract');
const validator = require('../shared/dailyCopyValidator');
const adapter = require('../shared/dailyDraftAdapter');

const WRITER_OUTPUT_MAX_CHARS = 20000;
const CONTENT_VALUE_STATUSES = Object.freeze(['insufficient', 'needs_work', 'almost_ready', 'complete']);
const STAGES = Object.freeze(['input', 'pack', 'authorization', 'spec', 'reserve', 'invoke_mark', 'writer', 'copy_check', 'adapt', 'content_value', 'save']);
const SPEND_GATE_METHODS = ['reserve', 'markInvoked', 'releaseBeforeCall', 'markOutcomeUnknown', 'settle'];

const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{2,127}$/;
const HASH_RE = /^[a-f0-9]{64}$/;

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function _isPositiveInt(v) { return Number.isSafeInteger(v) && v > 0; }

// Writer の生出力から JSON オブジェクトを取り出す。前後の ```json フェンスだけを許容する。
function parseWriterOutput(raw) {
  if (typeof raw !== 'string') return { ok: false, reason: 'writer_output_not_string' };
  if (raw.length > WRITER_OUTPUT_MAX_CHARS) return { ok: false, reason: 'writer_output_too_large' };
  let s = raw.trim();
  const fence = /^```(?:json)?\s*([\s\S]*?)\s*```$/.exec(s);
  if (fence) s = fence[1].trim();
  try {
    const v = JSON.parse(s);
    if (!_isPlainObject(v)) return { ok: false, reason: 'writer_output_not_object' };
    return { ok: true, value: v };
  } catch (e) {
    return { ok: false, reason: 'invalid_json' };
  }
}

// Content Value の返り値を検証する。計算失敗（例外の痕跡・形の不正）と低評価を区別する。
function checkContentValueResult(cv) {
  if (!_isPlainObject(cv)) return { ok: false, reason: 'content_value_not_object' };
  if (CONTENT_VALUE_STATUSES.indexOf(cv.status) === -1) return { ok: false, reason: 'content_value_status_invalid' };
  if (typeof cv.score !== 'number' || !isFinite(cv.score)) return { ok: false, reason: 'content_value_score_invalid' };
  const br = Array.isArray(cv.blockingReasons) ? cv.blockingReasons : [];
  if (br.some(r => typeof r === 'string' && r.indexOf('exception:') === 0)) return { ok: false, reason: 'content_value_evaluation_exception' };
  return { ok: true };
}

function _depsMissing(deps) {
  const missing = [];
  if (typeof deps.computePackHash !== 'function') missing.push('computePackHash');
  if (typeof deps.authorize !== 'function') missing.push('authorize');
  if (!_isPlainObject(deps.spendGate)) missing.push('spendGate');
  else SPEND_GATE_METHODS.forEach(m => { if (typeof deps.spendGate[m] !== 'function') missing.push('spendGate.' + m); });
  if (typeof deps.callWriter !== 'function') missing.push('callWriter');
  if (typeof deps.estimateCostFromUsage !== 'function') missing.push('estimateCostFromUsage');
  if (typeof deps.evaluateContentValue !== 'function') missing.push('evaluateContentValue');
  if (typeof deps.insertDraftIfAbsent !== 'function') missing.push('insertDraftIfAbsent');
  return missing;
}

function _inputInvalid(input) {
  if (typeof input.runId !== 'string' || !RUN_ID_RE.test(input.runId)) return 'invalid_run_id';
  if (!_isNonEmptyString(input.caseId)) return 'invalid_case_id';
  if (!_isNonEmptyString(input.outputId)) return 'invalid_output_id';
  if (!_isNonEmptyString(input.topicId)) return 'invalid_topic_id';
  if (!_isPositiveInt(input.packVersion)) return 'invalid_pack_version';
  if (typeof input.contentHash !== 'string' || !HASH_RE.test(input.contentHash)) return 'invalid_content_hash';
  if (!_isPlainObject(input.period)) return 'invalid_period';
  if (!_isPlainObject(input.estimate) || !_isPositiveInt(input.estimate.amount) || !_isNonEmptyString(input.estimate.unit)) return 'invalid_estimate';
  if (!_isNonEmptyString(input.writerProvider)) return 'invalid_writer_provider';
  return null;
}

function _sameTarget(a, b, keys) { return _isPlainObject(a) && _isPlainObject(b) && keys.every(k => a[k] === b[k]); }

async function runDailyProduction(input, deps) {
  input = _isPlainObject(input) ? input : {};
  deps = _isPlainObject(deps) ? deps : {};
  const stages = [];
  const counters = { reserveCalls: 0, markInvokedCalls: 0, writerCalls: 0, settleCalls: 0, releaseCalls: 0, markUnknownCalls: 0, contentValueCalls: 0, saveCalls: 0 };
  const result = {
    status: 'failed',               // 'awaiting_human_review' のときだけ最後まで進んだ
    failedStage: null,
    reason: null,
    approval: 'not_approved',       // 自動承認しない
    retries: 0,                     // 自動再試行は行わない
    stages, counters,
    runId: input.runId || null,
    outputId: input.outputId || null,
    authorization: null,            // { authorizationId, kind } kind は 'human' か 'local_fake' など
    billing: { state: 'not_reserved', reservedAmount: null, settledAmount: null, unit: null, note: null },
    saved: false,
    spec: null, copyCheck: null, draft: null, contentValue: null,
  };
  function ok(stage, extra) { stages.push(Object.assign({ stage, status: 'ok' }, extra || {})); }
  function fail(stage, reason, extra) {
    stages.push(Object.assign({ stage, status: 'failed', reason }, extra || {}));
    result.failedStage = stage; result.reason = reason;
    return result;
  }
  const gate = deps.spendGate;

  // 0. 入力と依存（ここで止まれば予約も Writer も0件）
  const inErr = _inputInvalid(input);
  if (inErr) return fail('input', inErr);
  const missing = _depsMissing(deps);
  if (missing.length) return fail('input', 'dependency_missing', { missing });
  ok('input');

  // 1. パック（申告の形式）と内容 hash の一致
  const packCheck = topicPack.validateTopicPack(input.pack);
  if (!packCheck.productionReady) return fail('pack', 'topic_pack_not_ready', { issues: packCheck.issues.map(i => i.code) });
  if (packCheck.topicId !== input.topicId) return fail('pack', 'topic_id_mismatch');
  let computedHash;
  try { computedHash = await deps.computePackHash(input.pack); } catch (e) { return fail('pack', 'pack_hash_error'); }
  if (computedHash !== input.contentHash) return fail('pack', 'content_hash_mismatch');
  ok('pack', { verificationBasis: packCheck.verificationBasis });

  // 2. 制作認可（対象に束縛・確認記録とも一致。パックの申告だけでは認可しない）
  const target = { runId: input.runId, caseId: input.caseId, outputId: input.outputId, topicId: input.topicId, packVersion: input.packVersion, contentHash: input.contentHash };
  let auth;
  try { auth = await deps.authorize({ target }); } catch (e) { return fail('authorization', 'authorization_error'); }
  if (!_isPlainObject(auth) || auth.authorized !== true || !_isNonEmptyString(auth.authorizationId) || !_isNonEmptyString(auth.kind)) {
    return fail('authorization', 'not_authorized');
  }
  if (!_sameTarget(auth.target, target, ['runId', 'caseId', 'outputId', 'topicId', 'packVersion', 'contentHash'])) return fail('authorization', 'authorization_target_mismatch');
  if (!_sameTarget(auth.review, target, ['topicId', 'packVersion', 'contentHash']) || !_isNonEmptyString(auth.review.reviewId)) {
    return fail('authorization', 'review_target_mismatch');
  }
  result.authorization = { authorizationId: auth.authorizationId, reviewId: auth.review.reviewId, kind: auth.kind };
  ok('authorization', { kind: auth.kind });

  // 3. 制作仕様
  const built = contract.buildProductionSpec(input.pack);
  if (!built.ok) return fail('spec', built.reason, { reasons: built.reasons.slice() });
  result.spec = built.spec;
  const instruction = contract.buildWriterInstruction(built.spec, input.pack);
  ok('spec');

  // 4. 予約（見積額・単位・期間を明示）
  let rsv;
  counters.reserveCalls++;
  try {
    rsv = await gate.reserve({ runId: input.runId, purpose: 'daily_copy_writer', provider: input.writerProvider, estimateAmount: input.estimate.amount, period: input.period });
  } catch (e) { result.billing.state = 'reservation_unknown'; return fail('reserve', 'reservation_outcome_unknown'); }
  if (!_isPlainObject(rsv) || rsv.approved !== true) {
    const r = _isPlainObject(rsv) && _isNonEmptyString(rsv.reason) ? rsv.reason : 'reservation_outcome_unknown';
    // 明確な拒否（予約は作られていない）と、結果不明（同じ runId で照合が必要）を区別する。どちらも Writer は呼ばない。
    const definitive = _isPlainObject(rsv) && rsv.definitive === true;
    result.billing.state = definitive ? 'refused' : 'reservation_unknown';
    result.billing.note = definitive ? '予約は作られていない（明確な拒否）' : '予約の結果が不明（同じ runId で照合が必要）';
    return fail('reserve', r, { definitive: definitive });
  }
  // 予算ゲートのモード。'production' 以外の予約は本番の有料実行に使えない（ローカル検証専用）。
  result.billing = { state: 'reserved', reservedAmount: rsv.reservedAmount, settledAmount: null, unit: rsv.amountUnit, note: null, mode: rsv.mode || null, productionBilling: rsv.mode === 'production' };
  if (rsv.amountUnit !== input.estimate.unit) {
    // 単位が違う見積りでは呼ばない（呼び出し前の確実な中止なので解放する）
    counters.releaseCalls++;
    let rel = null;
    try { rel = await gate.releaseBeforeCall({ runId: input.runId, reason: 'estimate_unit_mismatch' }); } catch (e) { rel = null; }
    result.billing.state = rel && rel.ok ? 'released' : 'reserved_release_unconfirmed';
    return fail('reserve', 'estimate_unit_mismatch');
  }
  ok('reserve');

  // 5. invoked への遷移（成功を確認してから Writer を呼ぶ）
  let inv;
  counters.markInvokedCalls++;
  try { inv = await gate.markInvoked({ runId: input.runId }); } catch (e) { inv = { ok: false, reason: 'store_outcome_unknown' }; }
  if (!_isPlainObject(inv) || inv.ok !== true) {
    const reason = _isPlainObject(inv) && _isNonEmptyString(inv.reason) ? inv.reason : 'store_outcome_unknown';
    if (reason === 'store_outcome_unknown') {
      // invoked になったかどうか不明。解放も再実行もしない（照合が必要）
      result.billing.state = 'reserved_or_invoked_unknown';
    } else {
      // 確実に呼び出し前。解放を試みる（ストアは reserved 以外の解放を拒否する）
      counters.releaseCalls++;
      let rel = null;
      try { rel = await gate.releaseBeforeCall({ runId: input.runId, reason: 'mark_invoked_failed:' + reason }); } catch (e) { rel = null; }
      result.billing.state = rel && rel.ok ? 'released' : 'reserved_release_unconfirmed';
    }
    return fail('invoke_mark', 'mark_invoked_failed', { gateReason: reason });
  }
  result.billing.state = 'invoked';
  ok('invoke_mark');

  // 6. Writer を1回だけ呼ぶ
  let w;
  counters.writerCalls++;
  try { w = await deps.callWriter({ instruction, topicId: built.spec.topicId, runId: input.runId }); }
  catch (e) {
    // 呼び出し開始後の timeout・通信エラー: 予約を保持（解放しない・再試行しない）
    counters.markUnknownCalls++;
    let mu = null;
    try { mu = await gate.markOutcomeUnknown({ runId: input.runId, detail: 'writer_exception' }); } catch (e2) { mu = null; }
    result.billing.state = mu && mu.ok ? 'outcome_unknown' : 'invoked_mark_unknown_failed';
    result.billing.note = '予約は保持（照合が必要）';
    return fail('writer', 'writer_outcome_unknown');
  }
  // 応答あり。使用量と精算根拠が揃えば精算、揃わなければ invoked のまま保持
  const usage = _isPlainObject(w) ? w.usage : undefined;
  let est = null;
  if (usage !== undefined && usage !== null) {
    try { est = await deps.estimateCostFromUsage(usage); } catch (e) { est = null; }
  }
  if (_isPlainObject(est) && Number.isSafeInteger(est.amount) && est.amount >= 0 && _isNonEmptyString(est.basis) && est.unit === result.billing.unit) {
    counters.settleCalls++;
    let st = null;
    try { st = await gate.settle({ runId: input.runId, settledAmount: est.amount, basis: est.basis }); } catch (e) { st = null; }
    if (st && st.ok) { result.billing.state = 'settled'; result.billing.settledAmount = est.amount; }
    else { result.billing.state = 'invoked_settle_failed'; result.billing.note = '精算できず予約を保持（照合が必要）'; }
  } else {
    result.billing.state = 'invoked_usage_unknown';
    result.billing.note = '使用量または精算根拠が不明のため予約を保持（精算済みではない）';
  }
  const raw = _isPlainObject(w) ? w.text : undefined;
  ok('writer', { billingState: result.billing.state });

  // 7. JSON と文案のルール検査（不合格でも Writer の費用は解放しない）
  const parsed = parseWriterOutput(raw);
  if (!parsed.ok) return fail('copy_check', parsed.reason);
  const check = validator.validateCopy(parsed.value, built.spec, input.pack);
  result.copyCheck = check;
  if (check.ruleCheck !== 'pass') return fail('copy_check', 'copy_rule_check_failed', { issues: check.issues.map(i => i.code) });
  ok('copy_check', { semanticReviewRequired: check.semanticReviewRequired.length });

  // 8. Draft 変換
  const adapted = adapter.buildDraftFields(parsed.value, built.spec, input.pack);
  if (!adapted.ok) return fail('adapt', 'adapt_failed', { issues: adapted.issues.map(i => i.code) });
  ok('adapt');

  // 9. Content Value（保存の前に計算。例外・不正なら保存0件）
  let cv;
  counters.contentValueCalls++;
  try {
    cv = await deps.evaluateContentValue({ outputId: input.outputId, caseId: input.caseId, type: adapted.draft.type, fields: adapted.draft.fields }, { contentType: adapted.draft.contentType });
  } catch (e) { return fail('content_value', 'content_value_error'); }
  const cvCheck = checkContentValueResult(cv);
  if (!cvCheck.ok) return fail('content_value', cvCheck.reason);
  result.contentValue = { status: cv.status, score: cv.score };
  ok('content_value', { contentValueStatus: cv.status });

  // 10. 本文と評価をまとめて新規保存（上書きしない・不明なら再保存しない）
  const payload = {
    outputId: input.outputId,
    caseId: input.caseId,
    runId: input.runId,
    authorizationId: auth.authorizationId,
    type: adapted.draft.type,
    contentType: adapted.draft.contentType,
    status: 'ready',                 // 既存語彙: AI の生成完了（公開準備完了・承認ではない）
    title: adapted.draft.title,
    fields: adapted.draft.fields,
    contentValue: cv,
  };
  result.draft = payload;
  let sv;
  counters.saveCalls++;
  try { sv = await deps.insertDraftIfAbsent(payload); }
  catch (e) { return fail('save', 'save_outcome_unknown', { note: '同じ outputId で照合する（新しい ID で再保存しない）' }); }
  if (_isPlainObject(sv) && sv.outcome === 'already_exists') return fail('save', 'output_already_exists');
  if (!_isPlainObject(sv) || sv.ok !== true || sv.outcome !== 'inserted') return fail('save', 'save_failed');
  result.saved = true;
  ok('save');

  result.status = 'awaiting_human_review';
  return result;
}

module.exports = {
  STAGES,
  CONTENT_VALUE_STATUSES,
  WRITER_OUTPUT_MAX_CHARS,
  parseWriterOutput,
  checkContentValueResult,
  runDailyProduction,
};
