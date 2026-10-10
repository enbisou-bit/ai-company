'use strict';
// lib/spendGate.js
// Instagram Daily Production — Step 2B Preparation: 予算予約ゲート（依存注入・永続ストアは外から渡す）。
//
//   目的: 有料の provider 呼び出しの前に、日次・月次・1実行の上限に対して見積額を「予約」し、
//         呼び出しの前後で予約の状態を正しく遷移させる。
//
//   契約:
//     - 金額はすべて整数の最小単位（limits.amountUnit で単位名を明示。例: 'micro_jpy' = 0.000001円）。
//       浮動小数・負の値・安全な整数範囲外は拒否する。
//     - 期間（dayKey='YYYY-MM-DD'・monthKey='YYYY-MM'）とタイムゾーンは呼び出し側が明示する。
//       本モジュールは日付・時計・環境変数を参照しない。
//     - 日月の上限確認と予約は、ストアの原子的操作（store.reserveAtomic）1回で行う。
//       「合計を読む → 別の処理で予約する」方式は使わない。原子的操作を持たないストアは使わない（fail-closed）。
//     - 予約の状態: reserved（呼び出し前）→ invoked（呼び出し開始）→ settled（推定費用で精算）
//                                         ↘ released（呼び出し前の中止だけ）
//                                         invoked → outcome_unknown（timeout・通信エラー。予約は保持）
//       ・released は「呼び出し前（reserved）」のときだけ。invoked / outcome_unknown を解放しない。
//       ・timeout や通信エラーだけで予約を解放しない。期限切れを理由に自動で解放する経路も持たない
//         （処理済みの可能性があるため。解消は Human の照合で行う）。
//     - 金額の区別: estimateAmount（呼び出し前の見積り）・settledAmount（呼び出し後の推定費用）・
//       未解決の予約（reserved / invoked / outcome_unknown の見積額）。合計への計上はストアの責務。
//     - 同じ runId の重複予約は拒否する（同じ実行の二重起動を防ぐ）。同じ runId の精算は、
//       同じ金額なら冪等（idempotent: true）、異なる金額なら拒否する。
//     - ストア不明・残額不明・上限未設定・結果不明はすべて「呼び出し不可」（fail-closed）。再試行0回。
//
//   ★ 見積りの予約は、実際の請求額の厳密な上限保証ではない（provider 側の課金は見積りを超え得る）。
//     接続時に必要な条件: 出力トークン上限（max_output_tokens）を固定する／tool 呼び出し・web 検索を無効にする／
//     モデルと単価表の版を固定する／SDK の自動再試行を 0 にする／timeout を明示する。
//   ★ 偽ストアでのテスト合格は、実 DB（Supabase / PostgreSQL）での原子性の実証ではない。

const REQUIRED_STORE_METHODS = ['reserveAtomic', 'markInvoked', 'settle', 'release', 'markOutcomeUnknown'];

const RUN_ID_RE = /^[A-Za-z0-9][A-Za-z0-9_.:-]{2,127}$/;
const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_KEY_RE = /^\d{4}-\d{2}$/;

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function _isPositiveInt(v) { return Number.isSafeInteger(v) && v > 0; }
function _isNonNegativeInt(v) { return Number.isSafeInteger(v) && v >= 0; }

// 拒否。既定は「明確な拒否」（予約は作られていない）。予約されたか分からない場合だけ definitive: false を明示する。
function _deny(reason, extra) { return Object.assign({ ok: false, approved: false, reason: reason, definitive: true }, extra || {}); }

// 10進文字列を整数の最小単位へ変換する（浮動小数を経由しない）。例: ('51.7504', 6) → 51750400
function decimalToMinorUnits(text, scale) {
  if (typeof text !== 'string' || !Number.isSafeInteger(scale) || scale < 0 || scale > 9) return null;
  const m = /^(\d+)(?:\.(\d+))?$/.exec(text.trim());
  if (!m) return null;
  const frac = (m[2] || '');
  if (frac.length > scale) return null;                 // 精度を落として丸めない
  const digits = m[1] + frac.padEnd(scale, '0');
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

// 上限の設定を検証する。未設定・不正は使わない。
function validateLimits(limits) {
  if (!_isPlainObject(limits)) return { ok: false, reason: 'limits_not_configured' };
  if (!_isNonEmptyString(limits.amountUnit)) return { ok: false, reason: 'amount_unit_not_configured' };
  if (!_isNonEmptyString(limits.timeZone)) return { ok: false, reason: 'timezone_not_configured' };
  for (const k of ['dailyLimit', 'monthlyLimit', 'perRunLimit']) {
    if (!_isPositiveInt(limits[k])) return { ok: false, reason: 'limit_not_configured:' + k };
  }
  if (limits.dailyLimit > limits.monthlyLimit) return { ok: false, reason: 'daily_limit_exceeds_monthly' };
  if (limits.perRunLimit > limits.dailyLimit) return { ok: false, reason: 'per_run_limit_exceeds_daily' };
  return { ok: true };
}

function _validateStore(store) {
  if (!_isPlainObject(store)) return 'store_missing';
  for (const m of REQUIRED_STORE_METHODS) if (typeof store[m] !== 'function') return 'store_method_missing:' + m;
  // 原子的に「上限確認＋予約」ができると宣言したストアだけを使う。宣言は実装の保証ではない（接続時に実証が必要）。
  if (!_isPlainObject(store.capabilities) || store.capabilities.atomicReserve !== true) return 'atomic_store_unavailable';
  return null;
}

function _validatePeriod(period, limits) {
  if (!_isPlainObject(period)) return 'period_missing';
  if (!_isNonEmptyString(period.timeZone)) return 'timezone_missing';
  if (period.timeZone !== limits.timeZone) return 'timezone_mismatch';
  if (!DAY_KEY_RE.test(period.dayKey || '')) return 'invalid_day_key';
  if (!MONTH_KEY_RE.test(period.monthKey || '')) return 'invalid_month_key';
  if (period.dayKey.slice(0, 7) !== period.monthKey) return 'day_not_in_month';
  return null;
}

// ストアが返す「明確な拒否」（予約は作られていない）。結果不明（reservation_outcome_unknown）とは区別する。
//   どちらも provider を呼ばない。明確な拒否は照合不要、結果不明は同じ runId で照合が必要。
const DEFINITIVE_REFUSALS = Object.freeze([
  'duplicate_run', 'daily_limit_exceeded', 'monthly_limit_exceeded', 'per_run_limit_exceeded',
  'period_mismatch', 'spend_stopped', 'limits_not_configured', 'limits_mismatch',
  'unit_mismatch', 'timezone_mismatch', 'invalid_purpose', 'invalid_amount',
]);

// 実行モード（必須）:
//   'local_verification' … ローカル検証専用。偽ストア・未実証のストアでも使えるが、本番の有料実行には使わない。
//   'production'         … 本番の有料実行。ストアの原子性が実証済み（capabilities.atomicityVerified === true）で、
//                          かつ偽ストア（capabilities.kind === 'local_fake'）でない場合だけ予約する。
//   ★ 実証済みかどうかはストア側の宣言で決め、検証の成功を理由にここで自動的に verified 扱いへ変えない。
const MODES = Object.freeze(['local_verification', 'production']);

function createSpendGate(config) {
  config = config || {};
  const store = config.store;
  const limits = config.limits;
  const mode = config.mode;

  function _modeError() {
    if (MODES.indexOf(mode) === -1) return 'gate_mode_not_configured';
    if (mode === 'production') {
      if (!_isPlainObject(store) || !_isPlainObject(store.capabilities)) return 'store_missing';
      if (store.capabilities.kind === 'local_fake') return 'local_fake_store_not_allowed_in_production';
      if (store.capabilities.atomicityVerified !== true) return 'store_atomicity_not_verified';
    }
    return null;
  }

  // 予約（呼び出し前）。approved: true のときだけ provider を呼んでよい。
  async function reserve(req) {
    const modeErr = _modeError();
    if (modeErr) return _deny(modeErr, { definitive: true });
    const storeErr = _validateStore(store);
    if (storeErr) return _deny(storeErr);
    const lim = validateLimits(limits);
    if (!lim.ok) return _deny(lim.reason);
    if (!_isPlainObject(req)) return _deny('invalid_request');
    if (typeof req.runId !== 'string' || !RUN_ID_RE.test(req.runId)) return _deny('invalid_run_id');
    if (!_isNonEmptyString(req.purpose)) return _deny('invalid_purpose');
    if (!_isNonEmptyString(req.provider)) return _deny('invalid_provider');
    if (!_isPositiveInt(req.estimateAmount)) return _deny('invalid_estimate_amount');
    const perr = _validatePeriod(req.period, limits);
    if (perr) return _deny(perr);
    if (req.estimateAmount > limits.perRunLimit) return _deny('per_run_limit_exceeded');

    let r;
    try {
      r = await store.reserveAtomic({
        runId: req.runId,
        purpose: req.purpose,
        provider: req.provider,
        amount: req.estimateAmount,
        amountUnit: limits.amountUnit,
        dayKey: req.period.dayKey,
        monthKey: req.period.monthKey,
        timeZone: req.period.timeZone,
        // 用途別 scope の上限としてストアへ渡す。ストア（DB）の上限と一致しなければ limits_mismatch で拒否される
        // （設定の不一致を黙って無視しない。global の上限は DB だけが持つ＝さらに厳しくする方向にしか働かない）。
        dailyLimit: limits.dailyLimit,
        monthlyLimit: limits.monthlyLimit,
        perRunLimit: limits.perRunLimit,
      });
    } catch (e) {
      // 例外は「予約されたかどうか不明」。provider を呼ばない。同じ runId で照合する（新しい runId を作らない）。
      return _deny('reservation_outcome_unknown', { runId: req.runId, definitive: false, mustReconcile: true });
    }
    if (!_isPlainObject(r) || !_isNonEmptyString(r.outcome)) return _deny('reservation_outcome_unknown', { runId: req.runId, definitive: false, mustReconcile: true });
    if (r.outcome === 'duplicate_run') return _deny('duplicate_run', { runId: req.runId, definitive: true, existingState: r.existingState || null });
    if (DEFINITIVE_REFUSALS.indexOf(r.outcome) !== -1) return _deny(r.outcome, { runId: req.runId, definitive: true, scope: r.scope || null });
    if (r.outcome !== 'reserved') return _deny('reservation_outcome_unknown', { runId: req.runId, definitive: false, mustReconcile: true });
    // 残額が数値で返らない予約は使わない（ストアが合計を把握できていない可能性）
    if (!_isNonNegativeInt(r.dailyRemaining) || !_isNonNegativeInt(r.monthlyRemaining)) {
      return _deny('remaining_unknown', { runId: req.runId, definitive: false, mustReconcile: true });
    }
    return {
      ok: true,
      approved: true,
      reason: null,
      runId: req.runId,
      reservedAmount: req.estimateAmount,
      amountUnit: limits.amountUnit,
      dailyRemaining: r.dailyRemaining,
      monthlyRemaining: r.monthlyRemaining,
      mode: mode,                  // 'local_verification' の予約は本番の有料実行に使わない
      isBillingCeiling: false,     // 見積りの予約は請求額の上限保証ではない
    };
  }

  async function _transition(method, args, okOutcomes) {
    const storeErr = _validateStore(store);
    if (storeErr) return { ok: false, reason: storeErr };
    if (!_isPlainObject(args) || typeof args.runId !== 'string' || !RUN_ID_RE.test(args.runId)) return { ok: false, reason: 'invalid_run_id' };
    let r;
    try { r = await store[method](args); }
    catch (e) { return { ok: false, reason: 'store_outcome_unknown', runId: args.runId }; }
    if (!_isPlainObject(r) || !_isNonEmptyString(r.outcome)) return { ok: false, reason: 'store_outcome_unknown', runId: args.runId };
    if (okOutcomes.indexOf(r.outcome) !== -1) return { ok: true, outcome: r.outcome, idempotent: r.outcome === 'already_settled_same', runId: args.runId };
    return { ok: false, reason: r.outcome, runId: args.runId };
  }

  // provider 呼び出しの直前に記録する。これ以降は「呼び出し前の中止」として解放できない。
  function markInvoked(args) { return _transition('markInvoked', args, ['invoked']); }

  // 呼び出し前の中止だけ解放できる（reserved → released）。invoked / outcome_unknown はストアが拒否する。
  function releaseBeforeCall(args) {
    if (!_isPlainObject(args) || !_isNonEmptyString(args.reason)) return Promise.resolve({ ok: false, reason: 'release_reason_missing' });
    return _transition('release', { runId: args.runId, reason: args.reason, onlyIfState: 'reserved' }, ['released']);
  }

  // 呼び出し後の結果不明（timeout・通信エラー）。予約は保持し、解放しない。
  function markOutcomeUnknown(args) {
    return _transition('markOutcomeUnknown', { runId: args && args.runId, detail: args && args.detail }, ['outcome_unknown']);
  }

  // 呼び出し後の精算（推定費用）。同じ runId・同じ金額の再精算は冪等、異なる金額は拒否。
  function settle(args) {
    if (!_isPlainObject(args)) return Promise.resolve({ ok: false, reason: 'invalid_request' });
    if (!_isNonNegativeInt(args.settledAmount)) return Promise.resolve({ ok: false, reason: 'invalid_settled_amount' });
    if (!_isNonEmptyString(args.basis)) return Promise.resolve({ ok: false, reason: 'settle_basis_missing' });
    return _transition('settle', { runId: args.runId, settledAmount: args.settledAmount, basis: args.basis }, ['settled', 'already_settled_same']);
  }

  return { mode, reserve, markInvoked, releaseBeforeCall, markOutcomeUnknown, settle };
}

module.exports = {
  REQUIRED_STORE_METHODS,
  DEFINITIVE_REFUSALS,
  MODES,
  decimalToMinorUnits,
  validateLimits,
  createSpendGate,
};
