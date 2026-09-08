'use strict';
// lib/webSession.js
// Phase 2-E Production Connection Step C-5-pre: server-side signed session（HttpOnly Cookie）。
//
//   目的: 「このrouteへ到達してよい利用者か」という **server-side authorization boundary** を、
//   新規npm依存ゼロ（Node組み込み crypto のみ）で提供する。
//
//   ★ これは individual identity（個人認証）ではない。WEB_APP_PASSWORD は社内共有の合言葉であり、
//     本sessionが表すのは **shared internal access boundary**（社内関係者のみ到達可能）である。
//     誰が操作したかの監査には使えない。この限界を前提に使うこと。
//
//   ★ Carousel approval token（shared/carouselApproval.js）とは別ドメイン・別secret・別format。
//     - session      : 「このrouteへ到達してよいか」        secret=WEB_SESSION_SECRET   prefix='s1'
//     - approval token: 「この成果物・quality・costで生成してよいか」 secret=CAROUSEL_APPROVAL_SECRET prefix='v1'
//     両者を混同・流用しない（片方だけでは絶対に有料生成へ到達しない）。
//
//   ★ fail-closed: secret未設定・署名不一致・期限切れ・形式不正・version不一致は、
//     すべて「session無し」として扱う。環境変数の有無で認証をskipする経路は **一切作らない**
//     （WEB_APP_PASSWORD 未設定でも、本sessionを要求するrouteは開かない）。
//
//   ★ secret値・password・raw tokenは戻り値にもログにも出さない（本ファイルは一切logを書かない）。

var crypto = require('crypto');

var SESSION_COOKIE_NAME = 'enbisou_session';
var SESSION_VERSION = 1;
var SESSION_PREFIX = 's1';                       // carouselApproval の 'v1' と衝突させない
var HMAC_ALGO = 'sha256';
var DEFAULT_TTL_MS = 24 * 60 * 60 * 1000;        // 24時間
var MAX_TTL_MS = 7 * 24 * 60 * 60 * 1000;        // 上限7日（これを超えるTTLは発行しない）
var MIN_SECRET_LENGTH = 16;

// ── secret（server-only。browserへ返さない・NEXT_PUBLIC_* 名は使わない） ──────────────
function getSessionSecret(override) {
  var s = (override !== undefined && override !== null) ? String(override) : process.env.WEB_SESSION_SECRET;
  if (!s || String(s).length < MIN_SECRET_LENGTH) return null;   // 空・短すぎる secret は無効（fail-closed）
  return String(s);
}
function hasSessionSecret(override) { return getSessionSecret(override) !== null; }

function _b64u(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function _unb64u(s) {
  var t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4 !== 0) t += '=';
  return Buffer.from(t, 'base64');
}
function _sign(payloadB64, secret) {
  return crypto.createHmac(HMAC_ALGO, secret).update(SESSION_PREFIX + '.' + payloadB64).digest();
}

// ══════════════════════════════════════════════════════════════
// issueSessionToken — login成功時にのみ呼ぶ。
//   payload は最小限（v / iat / exp）。PII・password・secret・roleは載せない。
// ══════════════════════════════════════════════════════════════
function issueSessionToken(opts) {
  opts = opts || {};
  var secret = getSessionSecret(opts.secret);
  if (!secret) return { ok: false, reason: 'session_secret_unavailable' };

  var now = Number.isFinite(Number(opts.now)) ? Number(opts.now) : Date.now();
  var ttl = Number.isFinite(Number(opts.ttlMs)) ? Number(opts.ttlMs) : DEFAULT_TTL_MS;
  if (!Number.isInteger(ttl) || ttl <= 0 || ttl > MAX_TTL_MS) return { ok: false, reason: 'invalid_ttl' };

  var payload = { v: SESSION_VERSION, iat: now, exp: now + ttl };
  var payloadB64 = _b64u(Buffer.from(JSON.stringify(payload), 'utf8'));
  var sig = _b64u(_sign(payloadB64, secret));
  return { ok: true, token: SESSION_PREFIX + '.' + payloadB64 + '.' + sig, payload: payload, ttlMs: ttl };
}

// ══════════════════════════════════════════════════════════════
// verifySessionToken — すべて fail-closed。
//   戻り値: { ok:true, payload } / { ok:false, reason }
//   reason: session_secret_unavailable | missing_session | malformed_session |
//           signature_invalid | session_version_unsupported | session_expired | session_not_yet_valid
//   ★ 呼び出し側（HTTP層）はこの reason をそのままclientへ返さない（401 unauthorized へ丸める）。
// ══════════════════════════════════════════════════════════════
function verifySessionToken(token, opts) {
  opts = opts || {};
  var secret = getSessionSecret(opts.secret);
  if (!secret) return { ok: false, reason: 'session_secret_unavailable' };

  if (typeof token !== 'string' || token.length === 0) return { ok: false, reason: 'missing_session' };
  var parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== SESSION_PREFIX) return { ok: false, reason: 'malformed_session' };

  var payloadB64 = parts[1], sigB64 = parts[2];

  // 署名検証（timing-safe）。改竄はここで停止する。
  var expectSig = _sign(payloadB64, secret);
  var gotSig;
  try { gotSig = _unb64u(sigB64); } catch (e) { return { ok: false, reason: 'malformed_session' }; }
  if (!Buffer.isBuffer(gotSig) || gotSig.length !== expectSig.length) return { ok: false, reason: 'signature_invalid' };
  if (!crypto.timingSafeEqual(gotSig, expectSig)) return { ok: false, reason: 'signature_invalid' };

  var payload;
  try { payload = JSON.parse(_unb64u(payloadB64).toString('utf8')); }
  catch (e) { return { ok: false, reason: 'malformed_session' }; }
  if (!payload || typeof payload !== 'object') return { ok: false, reason: 'malformed_session' };

  if (payload.v !== SESSION_VERSION) return { ok: false, reason: 'session_version_unsupported' };

  var now = Number.isFinite(Number(opts.now)) ? Number(opts.now) : Date.now();
  if (!Number.isFinite(Number(payload.iat)) || !Number.isFinite(Number(payload.exp))) {
    return { ok: false, reason: 'malformed_session' };
  }
  if (Number(payload.exp) <= now) return { ok: false, reason: 'session_expired' };
  if (Number(payload.iat) > now) return { ok: false, reason: 'session_not_yet_valid' };
  if (Number(payload.exp) - Number(payload.iat) > MAX_TTL_MS) return { ok: false, reason: 'invalid_ttl' };

  return { ok: true, payload: payload };
}

// ── Cookie helpers（cookie-parser 等の依存を追加しない） ──────────────
function parseCookies(cookieHeader) {
  var out = {};
  if (typeof cookieHeader !== 'string' || !cookieHeader) return out;
  var parts = cookieHeader.split(';');
  for (var i = 0; i < parts.length; i++) {
    var p = parts[i];
    var eq = p.indexOf('=');
    if (eq === -1) continue;
    var k = p.slice(0, eq).trim();
    var v = p.slice(eq + 1).trim();
    if (!k) continue;
    try { out[k] = decodeURIComponent(v); } catch (e) { out[k] = v; }
  }
  return out;
}

function getSessionTokenFromRequest(req) {
  var header = req && req.headers ? req.headers.cookie : null;
  var jar = parseCookies(header);
  return Object.prototype.hasOwnProperty.call(jar, SESSION_COOKIE_NAME) ? jar[SESSION_COOKIE_NAME] : null;
}

// HTTPS判定は env（NODE_ENV等）ではなく **リクエスト自身**から行う。
//   Render等のreverse proxy配下では x-forwarded-proto が 'https' になる。
//   app.set('trust proxy') を変更すると既存の req.ip 等の挙動へ影響するため、header を直接読む。
function isRequestSecure(req) {
  if (!req) return false;
  var xfp = req.headers && req.headers['x-forwarded-proto'];
  if (typeof xfp === 'string' && xfp.split(',')[0].trim().toLowerCase() === 'https') return true;
  if (req.secure === true) return true;
  if (req.protocol === 'https') return true;
  return false;
}

function buildSetCookieHeader(token, opts) {
  opts = opts || {};
  var maxAgeSec = Math.floor((Number.isFinite(Number(opts.maxAgeMs)) ? Number(opts.maxAgeMs) : DEFAULT_TTL_MS) / 1000);
  var attrs = [
    SESSION_COOKIE_NAME + '=' + token,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=' + maxAgeSec,
  ];
  // localhost(HTTP)では Secure を付けない（付けるとブラウザがcookieを破棄し開発できなくなる）。
  if (opts.secure === true) attrs.push('Secure');
  return attrs.join('; ');
}

function buildClearCookieHeader(opts) {
  opts = opts || {};
  var attrs = [
    SESSION_COOKIE_NAME + '=',
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
    'Max-Age=0',
  ];
  if (opts.secure === true) attrs.push('Secure');
  return attrs.join('; ');
}

// ══════════════════════════════════════════════════════════════
// Trusted Origin（CSRF defense in depth）
//
//   ★ Host header だけを無条件に信用して期待originを組み立てない（偽装可能なため）。
//   allowlistの決定:
//     WEB_TRUSTED_ORIGIN（カンマ区切り・明示設定）∪ RENDER_EXTERNAL_URL（Renderが与える公開URL）
//     → 1つでも設定されていれば **それだけ** を許可（localhostは許可しない＝production）
//     → 何も設定されていなければ localhost のみ許可（＝未設定のローカル開発環境）
//   productionでWEB_TRUSTED_ORIGIN/RENDER_EXTERNAL_URLが両方未設定なら、実originは
//   allowlistに載らず 403 となる（fail-closed。開けっ放しにはならない）。
// ══════════════════════════════════════════════════════════════
function _normalizeOrigin(s) {
  if (typeof s !== 'string') return null;
  var t = s.trim();
  if (!t) return null;
  try {
    var u = new URL(t);
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.origin;   // scheme://host[:port]（pathやtrailing slashを落とす）
  } catch (e) { return null; }
}

function resolveTrustedOrigins(env, opts) {
  env = env || process.env;
  opts = opts || {};
  var configured = [];

  var explicit = env.WEB_TRUSTED_ORIGIN;
  if (typeof explicit === 'string' && explicit.trim()) {
    explicit.split(',').forEach(function (s) {
      var o = _normalizeOrigin(s);
      if (o && configured.indexOf(o) === -1) configured.push(o);
    });
  }
  var renderUrl = _normalizeOrigin(env.RENDER_EXTERNAL_URL);
  if (renderUrl && configured.indexOf(renderUrl) === -1) configured.push(renderUrl);

  if (configured.length > 0) return { origins: configured, mode: 'configured' };

  // 未設定＝ローカル開発とみなし localhost のみ許可（productionでは上のconfiguredが効く）。
  var port = Number(env.PORT) || 3000;
  return {
    origins: ['http://localhost:' + port, 'http://127.0.0.1:' + port],
    mode: 'development_fallback',
  };
}

// ── Express middleware factories ──────────────────────────────
//   ★ 401/403 の理由詳細（どのcheckで落ちたか）をclientへ返さない（情報漏洩防止）。

function requireSession(opts) {
  opts = opts || {};
  return function (req, res, next) {
    var token = getSessionTokenFromRequest(req);
    var v = verifySessionToken(token, { secret: opts.secret, now: (typeof opts.now === 'function' ? opts.now() : undefined) });
    if (!v.ok) {
      return res.status(401).json({ ok: false, reason: 'unauthorized' });
    }
    // 後続handlerが参照したい場合に備えて最小情報のみ載せる（PIIなし）。
    req.webSession = { v: v.payload.v, exp: v.payload.exp };
    return next();
  };
}

function requireTrustedOrigin(opts) {
  opts = opts || {};
  return function (req, res, next) {
    var resolved = opts.trustedOrigins
      ? { origins: opts.trustedOrigins, mode: 'injected' }
      : resolveTrustedOrigins(opts.env || process.env, opts);

    var origin = req.headers && req.headers.origin;
    if (typeof origin === 'string' && origin) {
      var normalized = _normalizeOrigin(origin);
      if (normalized && resolved.origins.indexOf(normalized) !== -1) return next();
      return res.status(403).json({ ok: false, reason: 'forbidden_origin' });
    }

    // Origin欠落: ブラウザは同一オリジンのfetch POSTでもOriginを送るため、欠落は
    //   非ブラウザ経路（curl等）を意味する。CSRF防御としてfail-closedで拒否する
    //   （Refererフォールバックは採用しない——Referrer-Policyで容易に欠落するため
    //   「無ければ通す」経路を作ると防御が実質無効化される）。
    return res.status(403).json({ ok: false, reason: 'forbidden_origin' });
  };
}

module.exports = {
  SESSION_COOKIE_NAME: SESSION_COOKIE_NAME,
  SESSION_VERSION: SESSION_VERSION,
  SESSION_PREFIX: SESSION_PREFIX,
  DEFAULT_TTL_MS: DEFAULT_TTL_MS,
  MAX_TTL_MS: MAX_TTL_MS,
  MIN_SECRET_LENGTH: MIN_SECRET_LENGTH,
  getSessionSecret: getSessionSecret,
  hasSessionSecret: hasSessionSecret,
  issueSessionToken: issueSessionToken,
  verifySessionToken: verifySessionToken,
  parseCookies: parseCookies,
  getSessionTokenFromRequest: getSessionTokenFromRequest,
  isRequestSecure: isRequestSecure,
  buildSetCookieHeader: buildSetCookieHeader,
  buildClearCookieHeader: buildClearCookieHeader,
  resolveTrustedOrigins: resolveTrustedOrigins,
  requireSession: requireSession,
  requireTrustedOrigin: requireTrustedOrigin,
};
