'use strict';
// lib/spendStoreSupabase.js
// Instagram Daily Production — 予算予約ストア（PostgreSQL の rpc を使う。lib/spendGate.js の store 契約）。
//
//   対応する DB 関数: supabase/migrations/20261010000000_daily_spend_gate.sql
//     reserve_spend / mark_spend_invoked / release_spend / mark_spend_unknown / settle_spend / get_spend_reservation
//
//   ★ 接続先（rpc を持つ client）は依存として受け取る。本番 client・環境変数・.env.local を自動で読み込まない。
//     本ファイルは @supabase/supabase-js も lib/supabase.js も require しない。
//   ★ rpc の失敗（error・例外）は「結果不明」として例外にする（spendGate は例外を結果不明として扱い、許可しない）。
//     形の分からない応答も許可扱いにしない。自動再試行は0回。
//   ★ 予約の結果が不明なときは、新しい runId を作らず getReservation(runId) で照合する。
//   ★ 上限の正本は DB（spend_limit_scopes）。spendGate が渡す用途別の上限（dailyLimit / monthlyLimit / perRunLimit）は
//     照合用として送り、DB の値と一致しなければ limits_mismatch で拒否される（不一致を黙って無視しない）。
//     global の上限は DB だけが持つ。期間も DB の時刻で決まり、渡した dayKey / monthKey は照合だけに使われる。
//   ★ capabilities.atomicReserve は「DB 関数がロック順序と1 transaction で上限確認＋予約を行う設計である」ことの宣言。
//     atomicityVerified は常に false（ローカル PostgreSQL での検証に成功しても、ここで自動的に true にしない）。
//     そのため spendGate の production モードでは本ストアを使えない（本番の有料実行には別途の判断が必要）。

const RPC = Object.freeze({
  reserve: 'reserve_spend',
  invoked: 'mark_spend_invoked',
  release: 'release_spend',
  unknown: 'mark_spend_unknown',
  settle: 'settle_spend',
  get: 'get_spend_reservation',
});

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

class SpendStoreRpcError extends Error {
  constructor(fn, kind) { super('spend_store_rpc_' + kind + ':' + fn); this.name = 'SpendStoreRpcError'; this.fn = fn; this.kind = kind; }
}

function createSpendStoreSupabase(deps) {
  deps = deps || {};
  const client = deps.client;
  if (!client || typeof client.rpc !== 'function') return null;   // 接続先がなければストアを作らない（fail-closed）

  // rpc を1回だけ呼ぶ。error・例外は結果不明として投げる。data は { outcome: string, ... } であること。
  async function call(fn, params) {
    let res;
    try { res = await client.rpc(fn, params); }
    catch (e) { throw new SpendStoreRpcError(fn, 'exception'); }
    if (!_isPlainObject(res)) throw new SpendStoreRpcError(fn, 'no_response');
    if (res.error) throw new SpendStoreRpcError(fn, 'error');
    const data = res.data;
    if (!_isPlainObject(data) || typeof data.outcome !== 'string' || data.outcome.length === 0) {
      return { outcome: 'invalid_response' };   // spendGate は未知の outcome を許可しない
    }
    return data;
  }

  return {
    capabilities: { kind: 'postgres_rpc', atomicReserve: true, atomicityVerified: false },

    async reserveAtomic(a) {
      const d = await call(RPC.reserve, {
        p_run_id: a.runId,
        p_purpose: a.purpose,
        p_provider: a.provider,
        p_amount: a.amount,
        p_amount_unit: a.amountUnit,
        p_day_key: a.dayKey,
        p_month_key: a.monthKey,
        p_time_zone: a.timeZone,
        p_expected_daily_limit: a.dailyLimit,
        p_expected_monthly_limit: a.monthlyLimit,
        p_expected_per_run_limit: a.perRunLimit,
      });
      if (d.outcome === 'reserved') {
        return { outcome: 'reserved', dailyRemaining: d.dailyRemaining, monthlyRemaining: d.monthlyRemaining, dayKey: d.dayKey, monthKey: d.monthKey };
      }
      return Object.assign({}, d);
    },

    async markInvoked(a) { return call(RPC.invoked, { p_run_id: a.runId }); },

    async release(a) {
      // DB は reserved 以外の解放を拒否する。呼び出し側が reserved 以外を指定した場合はここでも拒否する。
      if (a.onlyIfState !== 'reserved') return { outcome: 'release_refused:only_reserved_supported' };
      return call(RPC.release, { p_run_id: a.runId, p_reason: a.reason });
    },

    async markOutcomeUnknown(a) { return call(RPC.unknown, { p_run_id: a.runId, p_detail: a.detail == null ? null : String(a.detail) }); },

    async settle(a) { return call(RPC.settle, { p_run_id: a.runId, p_settled_amount: a.settledAmount, p_basis: a.basis }); },

    // 照合用（読み取りのみ）。結果不明の予約は、新しい runId を作らずこれで状態を確かめる。
    async getReservation(runId) { return call(RPC.get, { p_run_id: runId }); },
  };
}

module.exports = { RPC, SpendStoreRpcError, createSpendStoreSupabase };
