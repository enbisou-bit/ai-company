'use strict';
// lib/contentEvidenceResolutionService.js
// CV-4c-3B: Content Evidence Server Canonical Resolution — HTTP 非依存 service 層
// （既存 lib/contentValueService.js / lib/carouselImageService.js と同じ設計方針）。
//
//   責務:
//     - client から届いた raw candidate + 明示 mappingDecision（+ 任意 proposedClaimText）を
//       shared/contentClaimPlanning.js（server-only require・非公開のまま）へ渡し、
//       canonical な contentEvidence[] / contentClaims[] を計算する
//     - claimType / supportType / verificationStatus / reliability / sourceTier / grounded の
//       いずれも client 値をそのまま信用しない（すべて既存ルールベース関数の出力のみを採用）
//     - proposedClaimText に対して安全境界（medical/therapeutic）を再チェックする
//       （Claim Intent 段階の Safety Filter は browser 側で既に通過済みだが、
//       finalize 時に新しく入力される wording はここでも再検証する多層防御）
//
//   非責務（このファイルが絶対にやらないこと）:
//     - Evidence 判定ロジックの重複実装（shared/contentClaimPlanning.js / shared/contentEvidence.js
//       / shared/evidenceAcquisition.js を read-only 再利用するのみ）
//     - Output Draft の DB 永続化そのもの（呼び出し側 server.js の責務）
//     - Content Value 判定（lib/contentValueService.js の責務）
//     - AI API / Web Evidence 取得（この service は既取得 candidate の事後処理のみ）
//
//   ★ shared/contentEvidence.js は本ファイル経由でも一切ブラウザへ公開しない
//     （require は Node のファイルシステム解決であり、lib/publicStatic.js の
//     HTTP 配信許可リストとは無関係）。

var contentClaimPlanning = require('../shared/contentClaimPlanning');
var evidenceAcquisition = require('../shared/evidenceAcquisition');

// EVIDENCE-Q2: Content Evidence Resolution 全体で使う Source Trust 設定の正本（server 側で固定。client 値は受け取らない）。
//   candidate の reliability 評価（buildContentEvidenceFromCandidate）と resolveContentEvidence（レコード判定・昇格判定）へ
//   同じ値を渡す。業界団体の明示allowlist（jcia.org 等）は evidenceAcquisition 側の既定判定とも一致させる。
function _contentEvidenceTrustOptions() {
  var industry = Array.isArray(evidenceAcquisition.TIER6_INDUSTRY_ORG_DOMAINS) ? evidenceAcquisition.TIER6_INDUSTRY_ORG_DOMAINS.slice() : [];
  return { officialDomains: [], industryDomains: industry };
}

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }

// ══════════════════════════════════════════════════════════════
// resolveContentEvidenceSubmission — POST /api/output-drafts から呼ばれる唯一の入口。
//
//   input: contentEvidenceCandidates (client から届いた raw配列。下記 shape):
//     [{ intentId, caseId, topic?, question?, claimTypeCandidate?,
//        candidate: { sourceMethod, sourceUrl, sourceTitle, sourceName, sourceExcerpt, createdBy },
//        mappingDecision: { claimType, supportType, verificationStatus? },
//        proposedClaimText? }]
//   context: { caseId, now }
//
//   戻り値: { contentEvidence: [...], contentClaims: [...], perIntent: {intentId: {...}}, errors: [...] }
//     ★ contentEvidence / contentClaims は「server が実際に計算した」canonical 配列のみ。
//       client が別途送った同名フィールドはこの関数の外側（呼び出し側）で必ず破棄すること。
// ══════════════════════════════════════════════════════════════
function resolveContentEvidenceSubmission(contentEvidenceCandidates, context) {
  var ctx = _isPlainObject(context) ? context : {};
  var errors = [];
  var out = { contentEvidence: [], contentClaims: [], perIntent: {}, errors: errors };

  var arr = Array.isArray(contentEvidenceCandidates) ? contentEvidenceCandidates : [];
  if (arr.length === 0) return out;

  var nowIso = (typeof ctx.now === 'number' && isFinite(ctx.now)) ? new Date(ctx.now).toISOString() : new Date().toISOString();

  // ── 1. intentId 単位でグルーピング（mapping未指定のitemは除外・自動推測しない） ──
  var byIntent = {};
  arr.forEach(function (item, idx) {
    if (!_isPlainObject(item)) { errors.push({ index: idx, error: 'invalid_item' }); return; }
    var intentId = item.intentId;
    if (!_isNonEmptyString(intentId)) { errors.push({ index: idx, error: 'intentId_missing' }); return; }
    var md = item.mappingDecision;
    if (!_isPlainObject(md) || !_isNonEmptyString(md.claimType) || !_isNonEmptyString(md.supportType)) {
      errors.push({ index: idx, intentId: intentId, error: 'mapping_decision_missing' });
      return;   // ★ mapping未指定candidateはFormal化対象から除外（自動推測しない）
    }
    if (!byIntent[intentId]) {
      byIntent[intentId] = {
        items: [],
        proposedClaimText: null,
        caseId: item.caseId || ctx.caseId,
        topic: item.topic,
        question: item.question,
        claimTypeCandidate: item.claimTypeCandidate || md.claimType,
      };
    }
    byIntent[intentId].items.push(item);
    if (_isNonEmptyString(item.proposedClaimText)) byIntent[intentId].proposedClaimText = item.proposedClaimText;
  });

  // ── 2. intentごとに resolveClaimEvidenceBatch() → （proposedClaimTextがあれば）finalizeContentClaim() ──
  Object.keys(byIntent).forEach(function (intentId) {
    var group = byIntent[intentId];
    var caseId = group.caseId;
    var intent = {
      intentId: intentId,
      caseId: caseId,
      topic: _isNonEmptyString(group.topic) ? group.topic : intentId,
      question: _isNonEmptyString(group.question) ? group.question : (_isNonEmptyString(group.topic) ? group.topic : intentId),
      claimTypeCandidate: group.claimTypeCandidate,
      status: 'proposed',
    };

    var candidateMappings = group.items.map(function (item, i) {
      var cand = _isPlainObject(item.candidate) ? item.candidate : {};
      var md = item.mappingDecision;
      return {
        candidate: {
          sourceMethod: cand.sourceMethod,
          sourceUrl: cand.sourceUrl,
          sourceTitle: cand.sourceTitle,
          sourceName: cand.sourceName,
          sourceExcerpt: cand.sourceExcerpt,
          createdBy: cand.createdBy === 'user' ? 'user' : 'system',
        },
        mappingDecision: {
          evidenceId: 'ev-' + intentId + '-' + i,
          claimType: md.claimType,
          supportType: md.supportType,
          // ★ verificationStatus は user_verified の明示指定のみ通す（web_retrievedでは
          //   buildContentEvidenceFromCandidate() 自体がこの値を無視し常にunverified初期化する）。
          verificationStatus: md.verificationStatus === 'user_verified' ? 'user_verified' : undefined,
          retrievedAt: nowIso,
          recordedAt: nowIso,
        },
      };
    });

    var trust = _contentEvidenceTrustOptions();
    var batch = contentClaimPlanning.resolveClaimEvidenceBatch(intent, candidateMappings, {
      caseId: caseId, now: ctx.now, officialDomains: trust.officialDomains, industryDomains: trust.industryDomains,
    });
    out.contentEvidence = out.contentEvidence.concat(batch.records);
    out.perIntent[intentId] = { resolution: batch.resolution, buildErrors: batch.buildErrors, finalizeResult: null };

    if (batch.buildErrors.length > 0) {
      errors.push({ intentId: intentId, error: 'candidate_build_errors', details: batch.buildErrors });
    }

    if (group.proposedClaimText) {
      // ★ 多層防御: Claim Intent 段階の Safety Filter を、finalize 時の実際の wording へも再適用する。
      var safety = contentClaimPlanning.evaluateClaimIntentSafety({ question: group.proposedClaimText, topic: intent.topic });
      if (!safety.allowed) {
        out.perIntent[intentId].finalizeResult = { ok: false, errors: ['medical_therapeutic_wording_blocked'] };
        errors.push({ intentId: intentId, error: 'medical_therapeutic_wording_blocked' });
      } else {
        var fin = contentClaimPlanning.finalizeContentClaim(intent, group.proposedClaimText, batch.records, batch.resolution, {});
        out.perIntent[intentId].finalizeResult = fin;
        if (fin.ok) {
          out.contentClaims.push(fin.claim);
        } else {
          errors.push({ intentId: intentId, error: 'finalize_failed', details: fin.errors });
        }
      }
    }
  });

  return out;
}

module.exports = {
  resolveContentEvidenceSubmission: resolveContentEvidenceSubmission,
};
