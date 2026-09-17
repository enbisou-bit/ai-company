'use strict';
// lib/contentEvidenceResolutionGuard.js
// Partial Resolution Replacement Guard — Evidence Resolution の canonical 更新可否を決める純関数。
//
//   目的: Evidence Resolution が部分成功した場合に、既存 canonical contentEvidence / contentClaims 全体を
//         部分集合で置き換えてしまう問題を防ぐ。更新方式を明示させ（full_replace / partial_update）、
//         server 側で再構築した集合と照合し、完全に成立した場合だけ次の canonical を計算する。
//
//   責務:
//     - Resolution request 契約（resolutionMode / targetClaimIds / expectedRevision / candidates）の検証
//     - candidate / Evidence / 既存 canonical の caseId 検証（cross-case は request 全体を拒否）
//     - Resolution 結果の完全性検証（部分成功・Safety block・mapping 欠落・未確定 claim・反証・
//       Claim を伴わない Evidence をすべて拒否）
//     - full_replace（既存 Claim の削除禁止）/ partial_update（対象 Claim だけ置換・対象外は保持）の計算
//     - revision（content_evidence_origin.revision）による stale 検出と次 revision の計算
//
//   非責務（このファイルが絶対にやらないこと）:
//     - DB / Network / AI API（CAS 書込は lib/outputDraftsDb.js、呼び出しは server.js）
//     - Evidence 判定そのもの（shared/contentClaimPlanning.js / lib/contentEvidenceResolutionService.js）
//     - client 値を Formal Truth として採用すること（client の宣言は server 再構築値との照合にのみ使う）
//
//   determinism: 入力を変更しない（非破壊）。時刻は呼び出し側が注入する。
//     revision は時刻に依存しない（直前 revision と次 canonical の fingerprint から導出）。

var crypto = require('crypto');
var evidenceCanonical = require('./contentEvidenceCanonical');

var RESOLUTION_MODES = Object.freeze(['full_replace', 'partial_update']);
var CLAIM_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/;
var REVISION_PATTERN = /^rev-[0-9a-f]{32}$/;

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
function _hasOwn(o, k) { return _isPlainObject(o) && Object.prototype.hasOwnProperty.call(o, k); }
function _reject(httpStatus, error, extra) { return Object.assign({ ok: false, httpStatus: httpStatus, error: error }, extra || {}); }

// 次 revision: 直前 revision（無ければ 'initial'）と次 canonical の fingerprint の連鎖ハッシュ。
//   ★ 同一 canonical 内容でも直前 revision が変われば別値になるため、成功後に旧 request を再利用できない。
function computeNextRevision(previousRevision, fingerprint) {
  var prev = (typeof previousRevision === 'string' && previousRevision) ? previousRevision : 'initial';
  return 'rev-' + crypto.createHash('sha256').update(prev + '|' + String(fingerprint), 'utf8').digest('hex').slice(0, 32);
}

// ══════════════════════════════════════════════════════════════
// validateResolutionRequest — Resolution request 契約の検証（service 実行前・書込前）
//   input: { caseId, body }   body は req.body（client 値。宣言としてのみ扱う）
//   戻り値: { ok:true, value:{ mode, targetClaimIds, expectedRevision } } | { ok:false, httpStatus, error }
// ══════════════════════════════════════════════════════════════
function validateResolutionRequest(input) {
  var inp = _isPlainObject(input) ? input : {};
  var caseId = inp.caseId;
  var body = _isPlainObject(inp.body) ? inp.body : {};

  var mode = body.resolutionMode;
  if (mode === undefined || mode === null || mode === '') return _reject(422, 'resolution_mode_required');
  if (RESOLUTION_MODES.indexOf(mode) === -1) return _reject(422, 'resolution_mode_invalid');

  if (!_hasOwn(body, 'targetClaimIds') || !Array.isArray(body.targetClaimIds)) return _reject(422, 'target_claim_ids_required');
  var targets = body.targetClaimIds;
  if (targets.length === 0) return _reject(422, 'target_claim_ids_empty');
  var targetSet = {};
  for (var i = 0; i < targets.length; i++) {
    if (typeof targets[i] !== 'string' || !CLAIM_ID_PATTERN.test(targets[i])) return _reject(422, 'target_claim_ids_invalid');
    if (targetSet[targets[i]]) return _reject(422, 'target_claim_ids_duplicate');
    targetSet[targets[i]] = true;
  }

  if (!_hasOwn(body, 'expectedRevision')) return _reject(422, 'expected_revision_required');
  var expected = body.expectedRevision;
  if (expected !== null && !(typeof expected === 'string' && REVISION_PATTERN.test(expected))) return _reject(422, 'expected_revision_invalid');

  var candidates = body.contentEvidenceCandidates;
  if (!Array.isArray(candidates) || candidates.length === 0) return _reject(422, 'candidates_required');
  var submitted = {};
  for (var j = 0; j < candidates.length; j++) {
    var item = candidates[j];
    if (!_isPlainObject(item)) return _reject(422, 'candidate_invalid');
    if (!_isNonEmptyString(item.intentId)) return _reject(422, 'candidate_intent_missing');
    // cross-case: candidate の caseId は未指定か request caseId と一致しなければならない
    if (item.caseId !== undefined && item.caseId !== null && item.caseId !== caseId) return _reject(409, 'candidate_case_mismatch');
    var md = item.mappingDecision;
    if (!_isPlainObject(md) || !_isNonEmptyString(md.claimType) || !_isNonEmptyString(md.supportType)) return _reject(422, 'candidate_mapping_missing');
    if (!targetSet[item.intentId]) return _reject(422, 'candidate_outside_target');
    submitted[item.intentId] = true;
  }
  // 提出 Intent 集合 == targetClaimIds（candidate の無い target を許さない）
  for (var k = 0; k < targets.length; k++) {
    if (!submitted[targets[k]]) return _reject(422, 'target_without_candidates');
  }

  return { ok: true, value: { mode: mode, targetClaimIds: targets.slice(), expectedRevision: expected } };
}

// ══════════════════════════════════════════════════════════════
// planCanonicalResolution — 完全性検証 + 次 canonical / origin の計算（書込前・純関数）
//   input: { caseId, outputId, contract, existingRow, resolved, resolvedAt }
//     contract   : validateResolutionRequest().value
//     existingRow: server が保存前に DB から読んだ row（canonical 列・origin を含む）
//     resolved   : resolveContentEvidenceSubmission() の戻り値
//   戻り値: { ok:true, mode, nextEvidence, nextClaims, origin, expectedRevision } | { ok:false, httpStatus, error, details? }
// ══════════════════════════════════════════════════════════════
function planCanonicalResolution(input) {
  var inp = _isPlainObject(input) ? input : {};
  var caseId = inp.caseId;
  var outputId = inp.outputId;
  var contract = _isPlainObject(inp.contract) ? inp.contract : null;
  var row = inp.existingRow;
  var resolved = _isPlainObject(inp.resolved) ? inp.resolved : null;
  if (!contract || !resolved || !_isNonEmptyString(caseId) || !_isNonEmptyString(outputId)) return _reject(422, 'resolution_contract_invalid');

  // ── 保存済み Output Draft が前提（canonical の CAS 対象 row が必要） ──
  if (!_isPlainObject(row)) return _reject(409, 'resolution_requires_saved_output_draft');
  if (row.case_id !== caseId) return _reject(409, 'output_case_mismatch');

  // ── 既存 canonical 状態（server が DB から読んだ値のみ） ──
  var exEvidence = row.content_evidence;
  var exClaims = row.content_claims;
  var exOrigin = row.content_evidence_origin;
  var hasCanonical = (exEvidence !== null && exEvidence !== undefined) || (exClaims !== null && exClaims !== undefined);
  if (hasCanonical && (!Array.isArray(exEvidence) || !Array.isArray(exClaims))) return _reject(409, 'canonical_state_invalid');
  if (exOrigin !== null && exOrigin !== undefined && !_isPlainObject(exOrigin)) return _reject(409, 'canonical_state_invalid');
  var currentRevision = _hasOwn(exOrigin, 'revision') ? exOrigin.revision : null;
  if (currentRevision !== null && typeof currentRevision !== 'string') return _reject(409, 'canonical_state_invalid');

  // ── stale 検出（DB 側 CAS の前段。race は CAS UPDATE が最終防御） ──
  if (contract.expectedRevision !== currentRevision) return _reject(409, 'canonical_revision_conflict');

  var existingClaimIds = [];
  var existingClaimSet = {};
  if (hasCanonical) {
    for (var a = 0; a < exClaims.length; a++) {
      var ec = exClaims[a];
      if (!_isPlainObject(ec) || !_isNonEmptyString(ec.claimId) || existingClaimSet[ec.claimId]) return _reject(409, 'canonical_state_invalid');
      existingClaimSet[ec.claimId] = true;
      existingClaimIds.push(ec.claimId);
    }
    for (var b = 0; b < exEvidence.length; b++) {
      var ee = exEvidence[b];
      if (!_isPlainObject(ee)) return _reject(409, 'canonical_state_invalid');
      if (ee.caseId !== caseId) return _reject(409, 'existing_canonical_case_mismatch');
    }
  }

  // ── Resolution 結果の完全性（1件でも欠ければ request 全体を拒否） ──
  var targets = contract.targetClaimIds;
  var targetSet = {};
  targets.forEach(function (t) { targetSet[t] = true; });

  var resolvedErrors = Array.isArray(resolved.errors) ? resolved.errors : [];
  if (resolvedErrors.length > 0) {
    return _reject(422, 'resolution_incomplete', {
      details: resolvedErrors.map(function (e) { return { intentId: e && e.intentId, error: e && e.error }; }),
    });
  }

  var rClaims = Array.isArray(resolved.contentClaims) ? resolved.contentClaims : [];
  var rEvidence = Array.isArray(resolved.contentEvidence) ? resolved.contentEvidence : [];
  var claimById = {};
  for (var c = 0; c < rClaims.length; c++) {
    var rc = rClaims[c];
    if (!_isPlainObject(rc) || !_isNonEmptyString(rc.claimId) || claimById[rc.claimId]) return _reject(422, 'resolution_incomplete');
    if (!targetSet[rc.claimId]) return _reject(422, 'resolution_outside_target');
    if (rc.status !== 'grounded') return _reject(422, 'resolution_incomplete');
    claimById[rc.claimId] = rc;
  }
  for (var t = 0; t < targets.length; t++) {
    if (!claimById[targets[t]]) return _reject(422, 'resolution_incomplete', { details: [{ intentId: targets[t], error: 'claim_not_resolved' }] });
  }

  var evidenceCountByClaim = {};
  for (var e = 0; e < rEvidence.length; e++) {
    var re = rEvidence[e];
    if (!_isPlainObject(re) || !_isNonEmptyString(re.claimId)) return _reject(422, 'resolution_incomplete');
    if (re.caseId !== caseId) return _reject(409, 'candidate_case_mismatch');
    if (!targetSet[re.claimId] || !claimById[re.claimId]) return _reject(422, 'evidence_without_claim');
    if (re.supportType === 'contradicts') return _reject(422, 'resolution_contradicted');
    evidenceCountByClaim[re.claimId] = (evidenceCountByClaim[re.claimId] || 0) + 1;
  }
  for (var u = 0; u < targets.length; u++) {
    if (!evidenceCountByClaim[targets[u]]) return _reject(422, 'claim_without_evidence');
  }

  // ── mode 別の次 canonical ──
  var nextEvidence, nextClaims;
  if (contract.mode === 'full_replace') {
    // 既存 Claim の暗黙削除は禁止（新しい集合が既存 Claim ID をすべて含む場合のみ）
    var dropped = existingClaimIds.filter(function (id) { return !targetSet[id]; });
    if (dropped.length > 0) return _reject(422, 'full_replace_would_drop_claims', { details: dropped.map(function (id) { return { intentId: id, error: 'would_be_dropped' }; }) });
    nextClaims = targets.map(function (id) { return claimById[id]; });
    nextEvidence = rEvidence.slice();
  } else if (contract.mode === 'partial_update') {
    if (!hasCanonical || existingClaimIds.length === 0) return _reject(422, 'partial_update_requires_canonical');
    for (var p = 0; p < targets.length; p++) {
      if (!existingClaimSet[targets[p]]) return _reject(422, 'target_claim_not_in_canonical');
    }
    // 対象 Claim だけを置換（既存の順序を保持）。対象外 Claim / Evidence はそのまま保持する。
    nextClaims = exClaims.map(function (cl) { return targetSet[cl.claimId] ? claimById[cl.claimId] : cl; });
    nextEvidence = exEvidence.filter(function (ev) { return !targetSet[ev.claimId]; }).concat(rEvidence);
  } else {
    return _reject(422, 'resolution_mode_invalid');
  }

  // ── 次 canonical の不変条件（Claim を伴わない Evidence なし・evidenceId 一意） ──
  var nextClaimSet = {};
  nextClaims.forEach(function (cl) { nextClaimSet[cl.claimId] = true; });
  var evidenceIds = {};
  for (var n = 0; n < nextEvidence.length; n++) {
    var ne = nextEvidence[n];
    if (!nextClaimSet[ne.claimId]) return _reject(409, 'canonical_state_invalid');
    if (!_isNonEmptyString(ne.evidenceId) || evidenceIds[ne.evidenceId]) return _reject(422, 'evidence_id_collision');
    evidenceIds[ne.evidenceId] = true;
  }

  var fingerprint = evidenceCanonical.computeCanonicalFingerprint(nextEvidence, nextClaims);
  var revision = computeNextRevision(currentRevision, fingerprint);
  var origin = Object.assign(
    evidenceCanonical.buildResolutionOrigin({
      caseId: caseId, outputId: outputId,
      contentEvidence: nextEvidence, contentClaims: nextClaims,
      resolvedAt: typeof inp.resolvedAt === 'string' ? inp.resolvedAt : null,
    }),
    {
      scope: contract.mode === 'full_replace' ? 'full' : 'partial',
      targetClaimIds: targets.slice().sort(),
      previousRevision: currentRevision,
      revision: revision,
    }
  );

  return {
    ok: true,
    mode: contract.mode,
    nextEvidence: nextEvidence,
    nextClaims: nextClaims,
    origin: origin,
    expectedRevision: currentRevision,
  };
}

module.exports = {
  RESOLUTION_MODES: RESOLUTION_MODES,
  CLAIM_ID_PATTERN: CLAIM_ID_PATTERN,
  REVISION_PATTERN: REVISION_PATTERN,
  computeNextRevision: computeNextRevision,
  validateResolutionRequest: validateResolutionRequest,
  planCanonicalResolution: planCanonicalResolution,
};
