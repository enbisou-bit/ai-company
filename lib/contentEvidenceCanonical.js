'use strict';
// lib/contentEvidenceCanonical.js
// Safety Foundation B1: Canonical Content Evidence / Claims Protected Columns — 純関数 helper。
//
//   目的: canonical contentEvidence / contentClaims を output_drafts.fields（client が丸ごと送り
//         JSONB 全置換される列）の外側の専用列（content_evidence / content_claims /
//         content_evidence_origin）へ分離し、通常の Output Draft 保存で消失・downgrade しないようにする。
//
//   責務:
//     - canonical source の選択（専用列を優先。列が未設定の既存rowのみ legacy fields を read-only 参照）
//     - legacy fields（B1 以前に server が fields へ書いた canonical）の保全
//       （★ B1 以降 legacy fields へ書き込む経路は存在しない＝値は不変。DB 上の既存値を引き継ぐだけ）
//     - Content Value 評価入力への canonical 注入（client 値は使わない）
//     - Evidence Resolution 由来の origin/provenance 構築
//
//   非責務（このファイルが絶対にやらないこと）:
//     - DB / Network / AI API（呼び出し側 server.js と lib/outputDraftsDb.js の責務）
//     - Evidence 判定ロジック（shared/contentEvidence.js / shared/contentClaimPlanning.js の責務）
//     - B2 の output 間継承（別工程）
//
//   determinism: 入力を変更しない（非破壊）。時刻は呼び出し側が注入する。

var crypto = require('crypto');

var CANONICAL_ORIGIN_VERSION = '1.0.0';

// origin.mode の列挙。★ B2 の inheritance mode は B2 工程で追加する（今回は含めない）。
var CANONICAL_ORIGIN_MODES = Object.freeze([
  'resolution',              // POST /api/output-drafts の Evidence Resolution 成功で server が確定
  'legacy_fields_backfill',  // supabase/content_evidence_canonical_backfill.sql による既存rowの移行
]);

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

// ══════════════════════════════════════════════════════════════
// selectCanonicalContentEvidence — DB row から canonical Evidence / Claims を選ぶ
//   row: output_drafts の row（content_evidence / content_claims / content_evidence_origin / fields を持ち得る）
//   戻り値: { source: 'columns' | 'legacy_fields' | 'none', contentEvidence: [], contentClaims: [], origin, invalid }
//
//   ★ 専用列が1つでも設定済み（NULL/未定義以外）なら columns を正本とし、legacy fields へは
//     絶対に fallback しない（古い値への巻き戻り防止）。型不正は invalid:true・空配列（fail-closed）。
//   ★ 専用列が未設定の row に限り、DB 上の legacy fields を read-only で参照する。
//     client payload の fields を渡してはならない（呼び出し側の契約）。
// ══════════════════════════════════════════════════════════════
function selectCanonicalContentEvidence(row) {
  var out = { source: 'none', contentEvidence: [], contentClaims: [], origin: null, invalid: false };
  if (!_isPlainObject(row)) return out;

  var hasColumns = (row.content_claims !== null && row.content_claims !== undefined)
    || (row.content_evidence !== null && row.content_evidence !== undefined);
  if (hasColumns) {
    out.source = 'columns';
    var evOk = Array.isArray(row.content_evidence);
    var clOk = Array.isArray(row.content_claims);
    out.invalid = !(evOk && clOk);
    out.contentEvidence = evOk ? row.content_evidence : [];
    out.contentClaims = clOk ? row.content_claims : [];
    out.origin = _isPlainObject(row.content_evidence_origin) ? row.content_evidence_origin : null;
    return out;
  }

  var f = _isPlainObject(row.fields) ? row.fields : null;
  if (f && (Array.isArray(f.contentEvidence) || Array.isArray(f.contentClaims))) {
    out.source = 'legacy_fields';
    out.contentEvidence = Array.isArray(f.contentEvidence) ? f.contentEvidence : [];
    out.contentClaims = Array.isArray(f.contentClaims) ? f.contentClaims : [];
  }
  return out;
}

// ══════════════════════════════════════════════════════════════
// preserveLegacyContentEvidenceFields — 通常保存で DB 上の legacy fields を引き継ぐ
//   resolvedFields: client 供給 contentEvidence / contentClaims を除去済みの fields
//   existingRow   : server が DB から読んだ保存前の row（client payload ではない）
//
//   ★ legacy fields は B1 以前に server だけが書いた値で、B1 以降は書き込む経路が無い（不変）。
//     rollback / backfill source として保持するため、fields の JSONB 全置換で失わないよう引き継ぐ。
//   ★ resolvedFields が plain object でない（fields:null 等）場合は何もしない（既存挙動を変えない）。
// ══════════════════════════════════════════════════════════════
function preserveLegacyContentEvidenceFields(resolvedFields, existingRow) {
  if (!_isPlainObject(resolvedFields)) return resolvedFields;
  var out = Object.assign({}, resolvedFields);
  delete out.contentEvidence;
  delete out.contentClaims;
  var f = (_isPlainObject(existingRow) && _isPlainObject(existingRow.fields)) ? existingRow.fields : null;
  if (f && Array.isArray(f.contentEvidence)) out.contentEvidence = f.contentEvidence;
  if (f && Array.isArray(f.contentClaims)) out.contentClaims = f.contentClaims;
  return out;
}

// ══════════════════════════════════════════════════════════════
// applyCanonicalForEvaluation — Content Value 評価入力へ canonical を注入する（保存はしない）
//   fields   : 評価対象の fields（slides 等）
//   canonical: selectCanonicalContentEvidence() の戻り値
//   ★ fields 内の contentEvidence / contentClaims は常に canonical で置き換える（none なら除去）。
// ══════════════════════════════════════════════════════════════
function applyCanonicalForEvaluation(fields, canonical) {
  if (!_isPlainObject(fields)) return fields;
  var out = Object.assign({}, fields);
  delete out.contentEvidence;
  delete out.contentClaims;
  if (_isPlainObject(canonical) && canonical.source !== 'none') {
    out.contentEvidence = Array.isArray(canonical.contentEvidence) ? canonical.contentEvidence : [];
    out.contentClaims = Array.isArray(canonical.contentClaims) ? canonical.contentClaims : [];
  }
  return out;
}

// canonical な JSON 文字列（object key をソート）。fingerprint の決定性のため。
function _stableStringify(v) {
  if (Array.isArray(v)) return '[' + v.map(_stableStringify).join(',') + ']';
  if (_isPlainObject(v)) {
    return '{' + Object.keys(v).sort().map(function (k) {
      return JSON.stringify(k) + ':' + _stableStringify(v[k]);
    }).join(',') + '}';
  }
  return JSON.stringify(v === undefined ? null : v);
}

function computeCanonicalFingerprint(contentEvidence, contentClaims) {
  var payload = _stableStringify({ contentEvidence: contentEvidence || [], contentClaims: contentClaims || [] });
  return 'sha256:' + crypto.createHash('sha256').update(payload, 'utf8').digest('hex');
}

// ══════════════════════════════════════════════════════════════
// buildResolutionOrigin — Evidence Resolution 由来の origin/provenance
//   input: { caseId, outputId, contentEvidence, contentClaims, resolvedAt(ISO) }
// ══════════════════════════════════════════════════════════════
function buildResolutionOrigin(input) {
  var inp = _isPlainObject(input) ? input : {};
  var ev = Array.isArray(inp.contentEvidence) ? inp.contentEvidence : [];
  var cl = Array.isArray(inp.contentClaims) ? inp.contentClaims : [];

  // Resolution は1回の提出で全 record に同一 recordedAt を付与する。揃っていなければ null（推測しない）。
  var recordedAtSet = {};
  ev.forEach(function (r) { if (r && typeof r.recordedAt === 'string') recordedAtSet[r.recordedAt] = true; });
  var recordedAtKeys = Object.keys(recordedAtSet);

  return {
    mode: 'resolution',
    version: CANONICAL_ORIGIN_VERSION,
    caseId: inp.caseId != null ? String(inp.caseId) : null,
    outputId: inp.outputId != null ? String(inp.outputId) : null,
    resolvedAt: typeof inp.resolvedAt === 'string' ? inp.resolvedAt : null,
    recordedAt: recordedAtKeys.length === 1 ? recordedAtKeys[0] : null,
    evidenceCount: ev.length,
    claimsCount: cl.length,
    claimIds: cl.map(function (c) { return c && c.claimId; }).filter(function (x) { return typeof x === 'string'; }).sort(),
    evidenceIds: ev.map(function (r) { return r && r.evidenceId; }).filter(function (x) { return typeof x === 'string'; }).sort(),
    fingerprint: computeCanonicalFingerprint(ev, cl),
  };
}

module.exports = {
  CANONICAL_ORIGIN_VERSION: CANONICAL_ORIGIN_VERSION,
  CANONICAL_ORIGIN_MODES: CANONICAL_ORIGIN_MODES,
  selectCanonicalContentEvidence: selectCanonicalContentEvidence,
  preserveLegacyContentEvidenceFields: preserveLegacyContentEvidenceFields,
  applyCanonicalForEvaluation: applyCanonicalForEvaluation,
  computeCanonicalFingerprint: computeCanonicalFingerprint,
  buildResolutionOrigin: buildResolutionOrigin,
};
