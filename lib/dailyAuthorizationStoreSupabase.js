'use strict';
// lib/dailyAuthorizationStoreSupabase.js
// Instagram Daily Production — 制作認可の永続ストア（rpc 経由。lib/dailyAuthorizationStore.js の契約）。
//
//   対応する DB 関数: supabase/migrations/20261011000000_daily_production_authorization.sql
//     get_daily_production_authorization（照合・読み取りのみ）／ consume_daily_production_authorization（1回限りの消費）
//
//   ★ 接続先（rpc を持つ client）は依存として受け取る。本番 client・環境変数・.env.local を読み込まない（require しない）。
//   ★ 照合の失敗・不明は「認可なし」（Writer へ進まない）。消費の rpc エラー・例外・形の分からない応答は「結果不明」として
//     例外にする → 呼び出し側は Writer を呼ばない（消費されたかもしれないので、未消費へ戻す処理もしない）。
//   ★ productionVerified は常に false。ローカル検証の成功で本番利用を有効にしない（本番モードの接続部はこれを拒否する）。
//   ★ 確認記録の作成・認可の発行はこのアダプターでは行わない（管理者だけが実行できる DB 関数・Human の明示操作）。

const RPC = Object.freeze({ get: 'get_daily_production_authorization', consume: 'consume_daily_production_authorization' });
const CONSUME_REFUSALS = Object.freeze(['already_consumed', 'not_found', 'target_mismatch', 'expired', 'not_consumable']);

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }

function _targetParams(t) {
  return { p_run_id: t.runId, p_case_id: t.caseId, p_output_id: t.outputId, p_topic_id: t.topicId, p_pack_version: t.packVersion, p_content_hash: t.contentHash };
}

function createSupabaseAuthorizationStore(deps) {
  deps = _isPlainObject(deps) ? deps : {};
  const client = deps.client;
  if (!client || typeof client.rpc !== 'function') return null;   // 接続先がなければ作らない（fail-closed）

  return {
    kind: 'postgres_rpc',
    connected: true,
    persistent: true,
    productionVerified: false,

    async getAuthorization({ target }) {
      if (!_isPlainObject(target)) return { authorized: false, reason: 'target_missing' };
      let res;
      try { res = await client.rpc(RPC.get, _targetParams(target)); } catch (e) { return { authorized: false, reason: 'authorization_lookup_unknown' }; }
      if (!_isPlainObject(res) || res.error) return { authorized: false, reason: 'authorization_lookup_error' };
      const d = res.data;
      if (!_isPlainObject(d) || !_isNonEmptyString(d.outcome)) return { authorized: false, reason: 'authorization_lookup_invalid' };
      if (d.outcome !== 'found') return { authorized: false, reason: 'authorization_' + d.outcome };
      if (d.state !== 'available') return { authorized: false, reason: 'authorization_' + (_isNonEmptyString(d.state) ? d.state : 'unavailable') };
      if (!_isNonEmptyString(d.authorizationId) || !_isPlainObject(d.target) || !_isPlainObject(d.review)) return { authorized: false, reason: 'authorization_lookup_invalid' };
      return { authorized: true, authorizationId: d.authorizationId, kind: 'persistent_db', target: d.target, review: d.review, expiresAt: d.expiresAt || null };
    },

    async consume({ authorizationId, runId, target }) {
      const t = _isPlainObject(target) ? target : {};
      let res;
      try {
        res = await client.rpc(RPC.consume, Object.assign({ p_authorization_id: authorizationId }, _targetParams(Object.assign({}, t, { runId }))));
      } catch (e) { throw new Error('authorization_consume_unknown'); }
      if (!_isPlainObject(res) || res.error) throw new Error('authorization_consume_unknown');
      const d = res.data;
      if (_isPlainObject(d) && d.outcome === 'consumed') return { ok: true, outcome: 'consumed' };
      if (_isPlainObject(d) && CONSUME_REFUSALS.indexOf(d.outcome) !== -1) return { ok: false, outcome: d.outcome };
      throw new Error('authorization_consume_unknown');
    },
  };
}

module.exports = { RPC, CONSUME_REFUSALS, createSupabaseAuthorizationStore };
