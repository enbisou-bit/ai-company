'use strict';
// lib/dailyProductionEvidence.js
// Instagram Daily Production — 本番での実証の証拠を照合し、実証済みの接続先に限って3項目を個別に有効化する。
//
//   対象（個別に管理する）:
//     spendStore         … 予算予約ストア（capabilities.atomicityVerified）
//     authorizationStore … 1回限りの制作認可ストア（productionVerified）
//     caseBoundary       … case の存在確認（productionVerified）
//   既定はすべて無効。アダプター側の既定値（false）は変更しない。有効化はこのファイルの関数を通した場合だけ。
//
//   有効化の条件（すべて必要）:
//     1. 信頼元: 証拠ファイルの SHA-256 が、Human が承認した実行許可（permit.evidence.<項目>）の hash と一致する。
//        証拠 JSON 自身の「verified」「approvedBy」等の自己申告では有効化しない。
//     2. 接続先: 証拠の target.supabaseUrl／projectRef が、実際に接続する URL と一致する。
//     3. migration: 証拠の migration hash が、このコードが想定する完全 hash と一致する（項目ごと）。
//     4. コード: 証拠に記録した関連コードの hash が、現在のファイルの hash と一致する（コードが変われば無効）。
//        実証に使った検証コードの hash と記録の参照先も必須（記録として残す。現在の存在は問わない）。
//     5. 結果と期限: 項目が一致し、全ケースが passed、検証日時は現在以前、有効期限内（検証から最大 90 日）。
//   ★ verifyEvidence() の結果だけが elevate*() に渡せる（モジュール内の WeakSet で照合・偽造した物体は拒否）。
//   ★ 有効化した依存は、実行許可（計数1・生成1）を通る real 実行の中だけで使う。実証用の手順から生成は有効にならない。
//   非責務: 通信・環境変数・鍵の読み込み（ファイルの読み込みは呼び出し側が注入する readFile だけ）。

const crypto = require('crypto');
const path = require('path');

const COMPONENTS = Object.freeze(['spendStore', 'authorizationStore', 'caseBoundary']);
// 項目ごとの migration の完全 hash（本番適用・129 項目照合済みのもの）
const MIGRATIONS = Object.freeze({
  spendStore: Object.freeze([{ path: 'supabase/migrations/20261010000000_daily_spend_gate.sql', sha256: 'a91f868a644f8b171b92f1178bff2a0a420415c80dbee43912b32d2c5a8e366c' }]),
  authorizationStore: Object.freeze([{ path: 'supabase/migrations/20261011000000_daily_production_authorization.sql', sha256: 'ed603a433726fe3a1e2ee3d4100406a869fe8df0ac59391ccda6040370cb396b' }]),
  caseBoundary: Object.freeze([]),
});
// 項目ごとに、証拠の時点と同じでなければならない関連コード（repo からの相対パス）
const CODE_FILES = Object.freeze({
  spendStore: Object.freeze(['lib/spendGate.js', 'lib/spendStoreSupabase.js', 'lib/dailyProductionEvidence.js']),
  authorizationStore: Object.freeze(['lib/dailyAuthorizationStoreSupabase.js', 'lib/dailyProductionConnect.js', 'lib/dailyProductionEvidence.js']),
  caseBoundary: Object.freeze(['lib/casesDb.js', 'lib/dailyProductionConnect.js', 'lib/dailyProductionEvidence.js']),
});
const MAX_VALIDITY_MS = 90 * 24 * 3600 * 1000;
const HASH_RE = /^[a-f0-9]{64}$/;
const URL_RE = /^https:\/\/([a-z0-9-]+)\.supabase\.co\/?$/;

const _issued = new WeakSet();

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function sha256(text) { return crypto.createHash('sha256').update(text).digest('hex'); }
function projectRefOf(url) { const m = typeof url === 'string' ? URL_RE.exec(url) : null; return m ? m[1] : null; }

// 1項目の証拠を照合する。ok のときだけ elevate に渡せる結果を返す
function verifyEvidence({ component, evidenceText, approvedSha256, supabaseUrl, repoRoot, readFile, now }) {
  const fail = reason => ({ ok: false, component, reason });
  if (COMPONENTS.indexOf(component) === -1) return fail('component_unknown');
  if (typeof evidenceText !== 'string' || evidenceText.length === 0) return fail('evidence_missing');
  if (typeof approvedSha256 !== 'string' || !HASH_RE.test(approvedSha256)) return fail('approved_hash_missing');
  if (sha256(evidenceText) !== approvedSha256) return fail('evidence_hash_mismatch');
  let e;
  try { e = JSON.parse(evidenceText); } catch (x) { return fail('evidence_not_json'); }
  if (!_isPlainObject(e) || e.evidenceVersion !== 1) return fail('evidence_version');
  if (e.component !== component) return fail('component_mismatch');
  const ref = projectRefOf(supabaseUrl);
  if (!ref) return fail('connection_url_invalid');
  if (!_isPlainObject(e.target) || e.target.supabaseUrl !== supabaseUrl.replace(/\/$/, '') || e.target.projectRef !== ref) return fail('target_mismatch');
  // migration（項目ごとの想定 hash と完全一致）
  const expectMig = MIGRATIONS[component];
  if (!Array.isArray(e.migrations) || e.migrations.length !== expectMig.length ||
      !expectMig.every(m => e.migrations.some(x => _isPlainObject(x) && x.path === m.path && x.sha256 === m.sha256))) return fail('migration_hash_mismatch');
  // 関連コード（現在のファイルと一致）
  if (!_isPlainObject(e.codeHashes)) return fail('code_hashes_missing');
  if (typeof readFile !== 'function' || !_isNonEmptyString(repoRoot)) return fail('code_reader_missing');
  for (const rel of CODE_FILES[component]) {
    const recorded = e.codeHashes[rel];
    if (typeof recorded !== 'string' || !HASH_RE.test(recorded)) return fail('code_hash_missing:' + rel);
    let current;
    try { current = sha256(readFile(path.join(repoRoot, rel))); } catch (x) { return fail('code_unreadable:' + rel); }
    if (current !== recorded) return fail('code_hash_mismatch:' + rel);
  }
  // 実証に使った検証コード・記録の参照先（記録として必須）
  if (!Array.isArray(e.verificationCode) || e.verificationCode.length === 0 ||
      !e.verificationCode.every(v => _isPlainObject(v) && _isNonEmptyString(v.path) && HASH_RE.test(String(v.sha256)))) return fail('verification_code_missing');
  if (!Array.isArray(e.records) || e.records.length === 0 || !e.records.every(_isNonEmptyString)) return fail('records_missing');
  // 結果
  if (!_isPlainObject(e.result) || e.result.status !== 'passed' || !Array.isArray(e.result.cases) || e.result.cases.length === 0 ||
      !e.result.cases.every(c => _isPlainObject(c) && _isNonEmptyString(c.id) && c.passed === true)) return fail('result_not_passed');
  // 日時・期限
  const t = (now || new Date()).getTime(), va = Date.parse(e.verifiedAt), vu = Date.parse(e.validUntil);
  if (!isFinite(va) || !isFinite(vu)) return fail('dates_invalid');
  if (va > t) return fail('verified_in_future');
  if (vu <= va || vu - va > MAX_VALIDITY_MS) return fail('validity_out_of_range');
  if (t >= vu) return fail('evidence_expired');
  const v = Object.freeze({ ok: true, component, projectRef: ref, evidenceSha256: approvedSha256 });
  _issued.add(v);
  return v;
}

function _check(v, component) {
  if (!v || !_issued.has(v) || v.ok !== true || v.component !== component) throw new Error('evidence_not_verified:' + component);
}
// 有効化（照合済みの結果だけを受け付け、元の依存は変更せず新しい依存を返す）
function elevateSpendStore(store, v) {
  _check(v, 'spendStore');
  return Object.assign({}, store, { capabilities: Object.assign({}, store.capabilities, { atomicityVerified: true, verifiedProjectRef: v.projectRef }) });
}
function elevateAuthorizationStore(store, v) {
  _check(v, 'authorizationStore');
  return Object.assign({}, store, { productionVerified: true, verifiedProjectRef: v.projectRef });
}
function elevateCaseBoundary(cb, v) {
  _check(v, 'caseBoundary');
  return Object.assign({}, cb, { productionVerified: true, verifiedProjectRef: v.projectRef });
}

module.exports = {
  COMPONENTS, MIGRATIONS, CODE_FILES, MAX_VALIDITY_MS,
  sha256, projectRefOf, verifyEvidence, elevateSpendStore, elevateAuthorizationStore, elevateCaseBoundary,
};
