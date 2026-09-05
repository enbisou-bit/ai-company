'use strict';
// shared/carouselApproval.js
// Instagram Carousel Image Production — Phase 2-D: 課金 Approval Token（HMAC-SHA256）。
//
//   目的: 「承認された、その Draft の、その枚数・その quality・その見積り額に限って」
//         provider 課金呼び出しを許可する。scope の1つでも食い違えば fail-closed。
//
//   secret: process.env.CAROUSEL_APPROVAL_SECRET（server-side env 前提）。
//     ★ browser へ出さない。index.html / クライアント JS から参照しない。
//     ★ token の生成は server 側のみ。client 生成は禁止（下の _assertServerSide 参照）。
//
//   fail-closed 一覧:
//     secret 未設定 / token 形式不正 / 署名改竄 / TTL 切れ / issuedAt 未来 /
//     scope 不一致（caseId・outputId・draftFingerprint・quality・slideCount・estimatedCostJpy）/
//     nonce 再利用
//
//   非責務: DB I/O・network I/O・filesystem I/O。ここには一切書かない。

var crypto = require('crypto');

var TOKEN_VERSION = 'v1';
var HMAC_ALGO = 'sha256';
var DEFAULT_TTL_MS = 10 * 60 * 1000;   // 10分
var MAX_TTL_MS = 60 * 60 * 1000;       // 上限1時間（これを超える TTL は発行しない）
var NONCE_BYTES = 16;

// scope の正規化キー順（canonical serialization。順序が変わると署名も変わる）
var SCOPE_KEYS = Object.freeze([
  'caseId', 'outputId', 'draftFingerprint', 'quality',
  'slideCount', 'estimatedCostJpy', 'issuedAt', 'expiresAt', 'nonce',
]);

// scope 比較で「呼び出し側の期待値と一致していなければならない」項目
var SCOPE_MATCH_KEYS = Object.freeze([
  'caseId', 'outputId', 'draftFingerprint', 'quality', 'slideCount', 'estimatedCostJpy',
]);

// ══════════════════════════════════════════════════════════════
// nonce single-use ストア
//
//   ⚠ Phase 2-D 限定の in-memory 実装であり、production-grade な single-use 保証ではない。
//     - process restart で消える（再起動後は同じ nonce が再び通ってしまう）
//     - multi-instance / 複数 Render インスタンス間で共有されない
//     - プロセス外からの検査・失効ができない
//   Phase 2-D は REAL_ENABLED=false（課金呼び出し 0）のため、
//   ここでは「single-use 判定ロジックの設計検証」に用途を限定する。
//   永続 single-use（DB 上の consumed 列 / UNIQUE 制約）は Phase 2-E の課題とする。
// ══════════════════════════════════════════════════════════════
var _consumedNonces = new Set();
var MAX_TRACKED_NONCES = 10000;   // 無制限に増やさない（メモリ保護）

function isNonceConsumed(nonce) {
  return _consumedNonces.has(String(nonce));
}

function consumeNonce(nonce) {
  var n = String(nonce || '');
  if (!n) return { ok: false, reason: 'missing_nonce' };
  if (_consumedNonces.has(n)) return { ok: false, reason: 'nonce_reused' };
  if (_consumedNonces.size >= MAX_TRACKED_NONCES) {
    // 追跡上限に達したら「消費済みか判定できない」ため、通さない（fail-closed）。
    return { ok: false, reason: 'nonce_store_full' };
  }
  _consumedNonces.add(n);
  return { ok: true };
}

// テスト用（本番経路では呼ばない）
function _resetNonceStore() { _consumedNonces.clear(); }
function _nonceStoreSize() { return _consumedNonces.size; }

// ── secret ──────────────
function _assertServerSide() {
  // client（browser）での生成・検証を構造的に禁止する
  if (typeof window !== 'undefined' || typeof document !== 'undefined') {
    var e = new Error('carouselApproval: client-side use is forbidden');
    e.code = 'client_side_forbidden';
    throw e;
  }
}

function getSecret(override) {
  _assertServerSide();
  var s = override !== undefined && override !== null ? String(override) : process.env.CAROUSEL_APPROVAL_SECRET;
  if (!s || String(s).length < 16) return null;   // 空・短すぎる secret は無効（fail-closed）
  return String(s);
}

function hasSecret(override) { return getSecret(override) !== null; }

// ── canonical serialization（キー順固定・未知キー混入を許さない） ──────────────
function canonicalScopeJson(scope) {
  var o = {};
  for (var i = 0; i < SCOPE_KEYS.length; i++) {
    var k = SCOPE_KEYS[i];
    o[k] = scope[k];
  }
  return JSON.stringify(o);
}

function _b64u(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function _unb64u(s) {
  var t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4 !== 0) t += '=';
  return Buffer.from(t, 'base64');
}

function _sign(payloadB64, secret) {
  return crypto.createHmac(HMAC_ALGO, secret).update(TOKEN_VERSION + '.' + payloadB64).digest();
}

// 金額は 4 桁で固定丸め（浮動小数の表現ゆれで署名が揺れないようにする）
function normalizeCostJpy(v) {
  var n = Number(v);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 10000) / 10000;
}

// ── 発行（server 側のみ） ──────────────
function issueApprovalToken(input, opts) {
  opts = opts || {};
  var secret = getSecret(opts.secret);
  if (!secret) return { ok: false, reason: 'no_approval_secret' };

  var now = Number.isFinite(Number(opts.now)) ? Number(opts.now) : Date.now();
  var ttl = Number.isFinite(Number(opts.ttlMs)) ? Number(opts.ttlMs) : DEFAULT_TTL_MS;
  if (!Number.isInteger(ttl) || ttl <= 0 || ttl > MAX_TTL_MS) return { ok: false, reason: 'invalid_ttl' };

  var cost = normalizeCostJpy(input && input.estimatedCostJpy);
  if (cost === null) return { ok: false, reason: 'invalid_estimated_cost' };
  var slideCount = Number(input && input.slideCount);
  if (!Number.isInteger(slideCount) || slideCount < 1) return { ok: false, reason: 'invalid_slide_count' };
  if (!input || !input.caseId || !input.outputId || !input.draftFingerprint || !input.quality) {
    return { ok: false, reason: 'invalid_scope' };
  }

  var scope = {
    caseId: String(input.caseId),
    outputId: String(input.outputId),
    draftFingerprint: String(input.draftFingerprint),
    quality: String(input.quality),
    slideCount: slideCount,
    estimatedCostJpy: cost,
    issuedAt: now,
    expiresAt: now + ttl,
    nonce: opts.nonce ? String(opts.nonce) : crypto.randomBytes(NONCE_BYTES).toString('hex'),
  };

  var payloadB64 = _b64u(Buffer.from(canonicalScopeJson(scope), 'utf8'));
  var sig = _b64u(_sign(payloadB64, secret));
  return { ok: true, token: TOKEN_VERSION + '.' + payloadB64 + '.' + sig, scope: scope };
}

// ── 検証（すべて fail-closed） ──────────────
//   expected: { caseId, outputId, draftFingerprint, quality, slideCount, estimatedCostJpy }
function verifyApprovalToken(token, expected, opts) {
  opts = opts || {};
  var secret = getSecret(opts.secret);
  if (!secret) return { ok: false, reason: 'no_approval_secret' };

  if (typeof token !== 'string' || token.length === 0) return { ok: false, reason: 'missing_token' };
  var parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== TOKEN_VERSION) return { ok: false, reason: 'malformed_token' };

  var payloadB64 = parts[1], sigB64 = parts[2];

  // 署名検証（timing-safe）。改竄はここで停止する。
  var expectSig = _sign(payloadB64, secret);
  var gotSig;
  try { gotSig = _unb64u(sigB64); } catch (e) { return { ok: false, reason: 'malformed_token' }; }
  if (!Buffer.isBuffer(gotSig) || gotSig.length !== expectSig.length) {
    return { ok: false, reason: 'signature_invalid' };
  }
  if (!crypto.timingSafeEqual(gotSig, expectSig)) return { ok: false, reason: 'signature_invalid' };

  var scope;
  try { scope = JSON.parse(_unb64u(payloadB64).toString('utf8')); }
  catch (e) { return { ok: false, reason: 'malformed_token' }; }
  if (!scope || typeof scope !== 'object') return { ok: false, reason: 'malformed_token' };

  // 署名対象と再シリアライズが一致すること（未知キー混入・キー順操作の検出）
  if (canonicalScopeJson(scope) !== _unb64u(payloadB64).toString('utf8')) {
    return { ok: false, reason: 'malformed_token' };
  }

  // TTL
  var now = Number.isFinite(Number(opts.now)) ? Number(opts.now) : Date.now();
  if (!Number.isFinite(Number(scope.issuedAt)) || !Number.isFinite(Number(scope.expiresAt))) {
    return { ok: false, reason: 'malformed_token' };
  }
  if (Number(scope.expiresAt) <= now) return { ok: false, reason: 'token_expired' };
  if (Number(scope.issuedAt) > now) return { ok: false, reason: 'token_not_yet_valid' };
  if (Number(scope.expiresAt) - Number(scope.issuedAt) > MAX_TTL_MS) return { ok: false, reason: 'invalid_ttl' };

  // scope 一致（1項目でも違えば停止）
  if (!expected || typeof expected !== 'object') return { ok: false, reason: 'missing_expected_scope' };
  for (var i = 0; i < SCOPE_MATCH_KEYS.length; i++) {
    var k = SCOPE_MATCH_KEYS[i];
    var want = k === 'estimatedCostJpy' ? normalizeCostJpy(expected[k])
      : k === 'slideCount' ? Number(expected[k])
        : String(expected[k] == null ? '' : expected[k]);
    var got = k === 'estimatedCostJpy' ? normalizeCostJpy(scope[k])
      : k === 'slideCount' ? Number(scope[k])
        : String(scope[k] == null ? '' : scope[k]);
    if (want === null || got === null || want !== got) {
      return { ok: false, reason: 'scope_mismatch', detail: { field: k } };
    }
  }

  // nonce 再利用（消費は consumeNonce() で明示的に行う）
  if (!scope.nonce || typeof scope.nonce !== 'string') return { ok: false, reason: 'malformed_token' };
  if (isNonceConsumed(scope.nonce)) return { ok: false, reason: 'nonce_reused' };

  return { ok: true, scope: scope };
}

module.exports = {
  TOKEN_VERSION: TOKEN_VERSION,
  HMAC_ALGO: HMAC_ALGO,
  DEFAULT_TTL_MS: DEFAULT_TTL_MS,
  MAX_TTL_MS: MAX_TTL_MS,
  SCOPE_KEYS: SCOPE_KEYS,
  SCOPE_MATCH_KEYS: SCOPE_MATCH_KEYS,
  MAX_TRACKED_NONCES: MAX_TRACKED_NONCES,
  hasSecret: hasSecret,
  getSecret: getSecret,
  canonicalScopeJson: canonicalScopeJson,
  normalizeCostJpy: normalizeCostJpy,
  isNonceConsumed: isNonceConsumed,
  consumeNonce: consumeNonce,
  issueApprovalToken: issueApprovalToken,
  verifyApprovalToken: verifyApprovalToken,
  _resetNonceStore: _resetNonceStore,
  _nonceStoreSize: _nonceStoreSize,
};
