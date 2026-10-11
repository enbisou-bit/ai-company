'use strict';
// lib/dailyAuthorizationStore.js
// Instagram Daily Production — 制作認可（Writer を呼んでよいという Human の判断）の取得と、1回限りの消費。
//
//   区別する3つの記録（混同しない）:
//     1. テーマ根拠の Human 確認記録（review）: パックの主張・出典を Human が確認したこと。{ reviewId, topicId, packVersion, contentHash }
//     2. 制作認可（authorization）          : その確認済みパックで、この run／case／output の制作を1回だけ許すこと（本ファイル）
//     3. 生成後の Mobile Approval            : 生成された文案・構成の承認（既存 review_state。本ファイルとは無関係・変更しない）
//
//   ストアの契約:
//     getAuthorization({ target })  → { authorized, authorizationId, kind, target, review } または { authorized:false, reason }
//     consume({ authorizationId, runId, target })
//       → { ok:true, outcome:'consumed' }                … この呼び出しが唯一の勝者（以後は再び消費できない）
//       → { ok:false, outcome:'already_consumed' | 'not_found' | 'target_mismatch' | 'not_connected' }
//       → 例外                                          … 消費されたか不明（呼び出し側は Writer を呼ばない）
//     ★ consume は原子的な check-and-set でなければならない（並列でも勝者は1つ）。
//
//   実装:
//     - createMemoryAuthorizationStore … ローカル検証専用（kind 'local_fake'）。プロセス内でだけ原子的。Human 認可ではない。
//     - createUnconnectedAuthorizationStore … 本番用の永続ストアが未接続であることを表す。常に拒否する（fail-closed）。
//   ★ 既存の永続化（output_approvals・画像生成の carousel_image_executions／承認トークン）は用途が違うため流用しない。
//     本番で原子的な1回限りの消費を行うには、専用の表と関数（例: 未消費の行だけを UPDATE … RETURNING）が必要（未作成）。

const TARGET_KEYS = Object.freeze(['runId', 'caseId', 'outputId', 'topicId', 'packVersion', 'contentHash']);
const REVIEW_KEYS = Object.freeze(['topicId', 'packVersion', 'contentHash']);

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function _same(a, b, keys) { return _isPlainObject(a) && _isPlainObject(b) && keys.every(k => a[k] === b[k]); }
function _clone(v) { return JSON.parse(JSON.stringify(v)); }

// records: [{ authorizationId, target:{runId,caseId,outputId,topicId,packVersion,contentHash}, review:{reviewId,topicId,packVersion,contentHash} }]
function createMemoryAuthorizationStore(records) {
  const byId = new Map();
  (Array.isArray(records) ? records : []).forEach(r => {
    if (!_isPlainObject(r) || !_isNonEmptyString(r.authorizationId) || !_isPlainObject(r.target) || !_isPlainObject(r.review)) throw new Error('invalid_fixture_record');
    byId.set(r.authorizationId, { record: _clone(r), consumedBy: null });
  });
  const log = [];
  return {
    kind: 'local_fake',
    connected: true,
    persistent: false,
    log,
    async getAuthorization({ target }) {
      if (!_isPlainObject(target)) return { authorized: false, reason: 'target_missing' };
      for (const { record } of byId.values()) {
        if (_same(record.target, target, TARGET_KEYS)) {
          return { authorized: true, authorizationId: record.authorizationId, kind: 'local_fake', target: _clone(record.target), review: _clone(record.review) };
        }
      }
      return { authorized: false, reason: 'authorization_not_found' };
    },
    // 同期の check-and-set（await の前に判定と記録を終える）＝プロセス内で原子的
    async consume({ authorizationId, runId, target }) {
      const e = byId.get(authorizationId);
      if (!e) { log.push({ authorizationId, outcome: 'not_found' }); return { ok: false, outcome: 'not_found' }; }
      if (e.record.target.runId !== runId || (target && !_same(e.record.target, target, TARGET_KEYS))) {
        log.push({ authorizationId, outcome: 'target_mismatch' }); return { ok: false, outcome: 'target_mismatch' };
      }
      if (e.consumedBy !== null) { log.push({ authorizationId, outcome: 'already_consumed' }); return { ok: false, outcome: 'already_consumed' }; }
      e.consumedBy = runId;
      log.push({ authorizationId, outcome: 'consumed' });
      return { ok: true, outcome: 'consumed' };
    },
    isConsumed(authorizationId) { const e = byId.get(authorizationId); return !!(e && e.consumedBy !== null); },
  };
}

function createUnconnectedAuthorizationStore() {
  return {
    kind: 'unconnected',
    connected: false,
    persistent: false,
    async getAuthorization() { return { authorized: false, reason: 'authorization_store_not_connected' }; },
    async consume() { return { ok: false, outcome: 'not_connected' }; },
  };
}

module.exports = { TARGET_KEYS, REVIEW_KEYS, createMemoryAuthorizationStore, createUnconnectedAuthorizationStore };
