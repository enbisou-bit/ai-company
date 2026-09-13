// shared/contentClaimPlanning.js
// Evidence-Based Content Value Quality — CV-4c-2/CV-4c-3: Claim Intent Planning +
// Evidence Acquisition adapter + Writer Grounding text builder（すべて純関数）。
//
//   ★ CV-4c-3: ブラウザ側（index.html）からも安全に読み込めるよう UMD ラップした
//     （既存 shared/evidenceAcquisition.js と同一パターン）。
//     Part A（Claim Intent）/ Part B（Safety Filter）/ Part C（Query Plan）は
//     shared/contentEvidence.js に一切依存せず、常にブラウザで完全動作する。
//     Part D 以降（Evidence candidate → contentEvidence record の生成・rule-based 昇格・
//     Sufficiency 評価）は shared/contentEvidence.js（server-only・非公開のまま）を必要とし、
//     ブラウザ環境ではその require が失敗するため 'content_evidence_module_unavailable' で
//     fail-closed に失敗する（実行時 crash ではなく明示的なエラー戻り値）。
//     これらは実際には server 側（Node）からのみ呼び出す設計であり、ブラウザ側の
//     Claim Intent Plan UI は Part A/B/C のみを使用する。
//
//   目的: 「Writerが先に主張を作り、あとからEvidenceを探して正当化する」構造を禁止し、
//         問い（Claim Intent） → Evidence取得 → Evidenceが支持する範囲でのみ claim を確定する、
//         という順序を強制するための Core。
//
//   責務:
//     - Claim Intent（まだ正式claimではない「確認したい問い」）の schema / validator
//     - medical / treatment / cure / diagnosis 等の安全境界による事前フィルタ（fail-closed）
//     - 既存 POST /api/evidence/web-search の入力契約（queries:[{category,query,reason}]）
//       互換の query plan を Claim Intent から決定論的に構築する（IADP buildSearchPlan() は
//       流用しない・IADP固有の intelligence 構造に一切依存しない独立実装）
//     - 既存 EEA Evidence Candidate（evidenceType/sourceUrl/sourceTitle/...）→
//       shared/contentEvidence.js の正式 contentEvidence record への薄い adapter
//       （claimType / supportType は必ず呼び出し側の明示的 mappingDecision から受け取る。
//       自動推測しない）
//     - 1 claim に対する複数 Evidence 候補の rule-based verified 昇格
//       （既存 evidenceAcquisition.evaluateVerifiedPromotion() を再利用するのみ。
//       新しい昇格ルールは発明しない）
//     - claim wording の Evidence 範囲逸脱検出（未裏付け数値・未裏付け因果）
//     - Writer へ渡す grounding text の構築（IADP Evidence / APFR Formal Truth と混在させない
//       独立見出し・source URL全文/巨大 excerpt を含めない・文字数上限）
//
//   非責務（このファイルが絶対にやらないこと）:
//     - 実 Web Search 実行（POST /api/evidence/web-search を呼ばない・axios/openaiClient.js を
//       require しない）
//     - shared/contentEvidence.js / shared/contentValueQuality.js / shared/evidenceAcquisition.js
//       の変更（read-only 再利用のみ）
//     - claimType / supportType / verificationStatus（web_retrieved）の自動確定
//       （claimType・supportType は呼び出し側の明示的決定を必須とする。verificationStatus は
//       既存 evaluateVerifiedPromotion() のルールに基づく決定論的昇格のみで、client の
//       任意値をそのまま信用しない）
//     - medical_effect 等の新しい claimType の追加（既存 unknown 境界を維持）
//     - AI API 呼び出し・claim 文言そのものの自動生成（proposedText は呼び出し側が用意する）
//     - Product / APFR ロジックへの接続（value content が第一対象）
//
//   determinism: 純関数。乱数なし・時刻依存なし（now は呼び出し側が注入）・外部 I/O なし・
//                LLM 呼び出しなし。入力オブジェクトを一切変更しない（非破壊）。
(function (root, factory) {
  var api = factory(root);
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;                          // CommonJS（Node / server-side / 合成テスト）
  } else {
    root.ContentClaimPlanning = api;                // ブラウザ（window / globalThis）
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (root) {
  'use strict';

  var CONTENT_CLAIM_PLANNING_VERSION = '1.1.0';

  // ══════════════════════════════════════════════════════════════
  // 依存モジュールの解決（Node では require・ブラウザでは既存 UMD global を使う）
  //   ★ shared/contentEvidence.js は server-only のまま（非公開）。ブラウザでは
  //     取得できないため null のまま扱い、必要な関数は fail-closed で errors を返す。
  //   ★ shared/evidenceAcquisition.js は既存 allowlist で既にブラウザ公開済み
  //     （<script src="shared/evidenceAcquisition.js"> が本ファイルより前に読み込まれる前提）。
  // ══════════════════════════════════════════════════════════════
  var contentEvidence = null;
  try { if (typeof require === 'function') contentEvidence = require('./contentEvidence'); } catch (e) { contentEvidence = null; }
  if (!contentEvidence && root && root.ContentEvidence) contentEvidence = root.ContentEvidence;

  var evidenceAcquisition = null;
  try { if (typeof require === 'function') evidenceAcquisition = require('./evidenceAcquisition'); } catch (e) { evidenceAcquisition = null; }
  if (!evidenceAcquisition && root && root.EvidenceAcquisition) evidenceAcquisition = root.EvidenceAcquisition;

  // Part A/B/C 専用の browser-safe fallback（shared/contentEvidence.js が無い環境用）。
  //   ★ contentEvidence.js の CONTENT_CLAIM_TYPES と値を同期させる regression test を
  //     contentClaimPlanning.test.js（Node context・contentEvidence.js は常に利用可能）側に持つ。
  var CONTENT_CLAIM_TYPES_FALLBACK = Object.freeze(['general_practice', 'law_regulation', 'public_statistic', 'unknown']);
  function _claimTypes() {
    return (contentEvidence && Array.isArray(contentEvidence.CONTENT_CLAIM_TYPES))
      ? contentEvidence.CONTENT_CLAIM_TYPES : CONTENT_CLAIM_TYPES_FALLBACK;
  }

  // ══════════════════════════════════════════════════════════════
  // helpers（純関数）
  // ══════════════════════════════════════════════════════════════
  function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function _str(v) { return (v === null || v === undefined) ? '' : String(v); }
  function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }

  // ══════════════════════════════════════════════════════════════
  // Part A: Claim Intent contract（shared/contentEvidence.js に非依存・常にブラウザ動作）
  //   ★ Claim Intent はまだ正式claimではない。「何を確認するか」（問い）を表すのみ。
  //     claim本文（断定的wording）として保存しない。
  // ══════════════════════════════════════════════════════════════
  var CLAIM_INTENT_STATUS_VALUES = Object.freeze(['proposed', 'blocked', 'query_planned', 'resolved', 'insufficient']);

  var QUESTION_MARKER_PATTERN = /(か[？?]?$|かどうか|でしょうか|なぜ|どの程度|どのくらい|どれ(くらい|ほど)|何|いつ|どこ|だれ|誰)/;

  function validateClaimIntent(intent) {
    var errors = [];
    if (!_isPlainObject(intent)) return { valid: false, errors: ['intent_missing_or_invalid'] };
    if (!_isNonEmptyString(intent.intentId)) errors.push('intentId_missing');
    if (!_isNonEmptyString(intent.caseId)) errors.push('caseId_missing');
    if (!_isNonEmptyString(intent.topic)) errors.push('topic_missing');
    if (!_isNonEmptyString(intent.question)) errors.push('question_missing');
    if (_claimTypes().indexOf(intent.claimTypeCandidate) === -1) errors.push('invalid_claimTypeCandidate');
    if (CLAIM_INTENT_STATUS_VALUES.indexOf(intent.status) === -1) errors.push('invalid_status');
    return { valid: errors.length === 0, errors: errors };
  }

  function evaluateClaimIntentPhrasing(intent) {
    var q = _str(intent && intent.question);
    var looksLikeQuestion = QUESTION_MARKER_PATTERN.test(q);
    return {
      looksLikeQuestion: looksLikeQuestion,
      warning: looksLikeQuestion ? null : 'question_does_not_look_like_a_question',
    };
  }

  // ══════════════════════════════════════════════════════════════
  // Part B: Safety pre-filter（shared/contentEvidence.js に非依存・常にブラウザ動作）
  // ══════════════════════════════════════════════════════════════
  var MEDICAL_THERAPEUTIC_PATTERNS = Object.freeze([
    /治療/, /治[すし]/, /治る/, /完治/, /治癒/, /疾患/, /病気(の)?(予防|治療)/, /診断/, /処方/,
    /薬効/, /医薬品的/, /効能\s*[・、,]?\s*効果/, /臨床試験/, /治験/, /抗炎症/, /殺菌効果/,
    /ステロイド/, /ホルモン(注射|療法)/, /がん|癌/, /アトピー(性皮膚炎)?/, /皮膚科医が推奨/,
    /症状(が|を)?(改善|軽減|緩和)/, /副作用/,
    /\bcure\b/i, /\btreat(ment|s|ed|ing)?\b/i, /\bdiagnos(is|e|ed|ing)\b/i, /\bdisease\b/i,
    /\bmedication\b/i, /\bdrug\b/i, /\btherap(y|eutic)\b/i, /\bprescri(be|ption)\b/i,
  ]);

  function evaluateClaimIntentSafety(intent) {
    var text = _str(intent && intent.question) + ' ' + _str(intent && intent.topic);
    var matched = [];
    for (var i = 0; i < MEDICAL_THERAPEUTIC_PATTERNS.length; i++) {
      if (MEDICAL_THERAPEUTIC_PATTERNS[i].test(text)) matched.push(MEDICAL_THERAPEUTIC_PATTERNS[i].source);
    }
    var allowed = matched.length === 0;
    return {
      allowed: allowed,
      status: allowed ? 'proposed' : 'blocked',
      reason: allowed ? null : 'medical_therapeutic_topic_detected',
      matchedPatterns: matched,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // Part C: Evidence Acquisition query plan（shared/contentEvidence.js に非依存・常にブラウザ動作）
  // ══════════════════════════════════════════════════════════════
  var CONTENT_EVIDENCE_QUERY_CATEGORY = 'content_claim';

  function buildContentEvidenceQueries(intents) {
    var arr = Array.isArray(intents) ? intents : [];
    var out = { queries: [], blocked: [] };
    for (var i = 0; i < arr.length; i++) {
      var intent = arr[i];
      var safety = evaluateClaimIntentSafety(intent);
      if (!safety.allowed) {
        out.blocked.push({ intentId: intent && intent.intentId, reason: safety.reason });
        continue;
      }
      var v = validateClaimIntent(intent);
      if (!v.valid) {
        out.blocked.push({ intentId: intent && intent.intentId, reason: 'invalid_intent:' + v.errors.join(',') });
        continue;
      }
      out.queries.push({
        category: CONTENT_EVIDENCE_QUERY_CATEGORY,
        query: intent.question,
        reason: _isNonEmptyString(intent.reason) ? intent.reason : ('Claim Intent: ' + intent.topic),
        intentId: intent.intentId,
      });
    }
    return out;
  }

  // ══════════════════════════════════════════════════════════════
  // Part D + E: Evidence candidate adapter（shared/contentEvidence.js 必須・server専用）
  // ══════════════════════════════════════════════════════════════
  function buildContentEvidenceFromCandidate(candidate, intent, mappingDecision, context) {
    if (!contentEvidence) return { ok: false, record: null, errors: ['content_evidence_module_unavailable'] };
    var errors = [];
    var ctx = _isPlainObject(context) ? context : {};
    var cand = _isPlainObject(candidate) ? candidate : {};
    var it = _isPlainObject(intent) ? intent : {};
    var md = _isPlainObject(mappingDecision) ? mappingDecision : {};

    if (!_isNonEmptyString(it.intentId)) errors.push('intent_intentId_missing');
    var caseId = _isNonEmptyString(it.caseId) ? it.caseId : ctx.caseId;
    if (!_isNonEmptyString(caseId)) errors.push('caseId_missing');
    if (contentEvidence.CONTENT_CLAIM_TYPES.indexOf(md.claimType) === -1) errors.push('mappingDecision_claimType_invalid');
    if (contentEvidence.CONTENT_SUPPORT_TYPES.indexOf(md.supportType) === -1) errors.push('mappingDecision_supportType_invalid');
    if (contentEvidence.CONTENT_EVIDENCE_SOURCE_METHODS.indexOf(cand.sourceMethod) === -1) errors.push('candidate_sourceMethod_invalid');
    if (!_isNonEmptyString(md.evidenceId)) errors.push('mappingDecision_evidenceId_missing');
    if (!_isNonEmptyString(md.retrievedAt)) errors.push('mappingDecision_retrievedAt_missing');
    if (!_isNonEmptyString(md.recordedAt)) errors.push('mappingDecision_recordedAt_missing');

    if (errors.length > 0) return { ok: false, record: null, errors: errors };

    var verificationStatus = 'unverified';
    if (cand.sourceMethod !== 'web_retrieved' && md.verificationStatus === 'user_verified') {
      verificationStatus = 'user_verified';
    }

    var reliability = 'unknown';
    if (_isNonEmptyString(cand.sourceUrl) && evidenceAcquisition) {
      var trust = evidenceAcquisition.classifySourceTrust(cand.sourceUrl, {
        officialDomains: ctx.officialDomains, industryDomains: ctx.industryDomains,
      });
      reliability = (trust && trust.reliability) || 'unknown';
    }

    var record = {
      evidenceId: md.evidenceId,
      caseId: caseId,
      claimId: it.intentId,
      claim: _isNonEmptyString(it.question) ? it.question : _str(it.topic),
      claimType: md.claimType,
      supportType: md.supportType,
      sourceMethod: cand.sourceMethod,
      verificationStatus: verificationStatus,
      reliability: reliability,
      retrievedAt: md.retrievedAt,
      recordedAt: md.recordedAt,
      createdBy: cand.createdBy === 'user' ? 'user' : 'system',
    };
    if (_isNonEmptyString(ctx.outputId)) record.outputId = ctx.outputId;
    if (_isNonEmptyString(cand.sourceUrl)) record.sourceUrl = cand.sourceUrl;
    if (_isNonEmptyString(cand.sourceTitle)) record.sourceTitle = cand.sourceTitle;
    if (_isNonEmptyString(cand.sourceName)) record.sourceName = cand.sourceName;
    if (_isNonEmptyString(cand.sourceExcerpt)) record.sourceExcerpt = cand.sourceExcerpt;
    if (_isNonEmptyString(it.topic)) record.topic = it.topic;

    var v = contentEvidence.validateContentEvidenceRecord(record, { expectedCaseId: caseId });
    if (!v.valid) return { ok: false, record: null, errors: v.errors };

    return { ok: true, record: record, errors: [] };
  }

  // ══════════════════════════════════════════════════════════════
  // Part F: 1 claim 分の Evidence バッチを構築 → rule-based 昇格 → Sufficiency 評価
  //   （shared/contentEvidence.js 必須・server専用）
  // ══════════════════════════════════════════════════════════════
  function resolveClaimEvidenceBatch(intent, candidateMappings, context) {
    if (!contentEvidence) {
      return { records: [], resolution: null, buildErrors: [{ index: -1, errors: ['content_evidence_module_unavailable'] }] };
    }
    var ctx = _isPlainObject(context) ? context : {};
    var arr = Array.isArray(candidateMappings) ? candidateMappings : [];
    var built = [];
    var buildErrors = [];

    for (var i = 0; i < arr.length; i++) {
      var cm = arr[i] || {};
      var r = buildContentEvidenceFromCandidate(cm.candidate, intent, cm.mappingDecision, ctx);
      if (r.ok) built.push(r.record); else buildErrors.push({ index: i, errors: r.errors });
    }

    var promoType = contentEvidence._mapClaimTypeToPromotionType(intent && intent.claimTypeCandidate);
    var finalRecords = built.map(function (rec) {
      if (rec.sourceMethod !== 'web_retrieved' || rec.supportType !== 'supports' || promoType === null || !evidenceAcquisition) return rec;
      var related = built.filter(function (o) { return o !== rec && o.supportType === 'supports'; });
      var promo = evidenceAcquisition.evaluateVerifiedPromotion(promoType, rec, related);
      if (promo && promo.eligible === true) {
        var promoted = {};
        for (var k in rec) { if (Object.prototype.hasOwnProperty.call(rec, k)) promoted[k] = rec[k]; }
        promoted.verificationStatus = 'verified';
        return promoted;
      }
      return rec;
    });

    var resolution = contentEvidence.resolveContentEvidence(finalRecords, {
      caseId: ctx.caseId, outputId: ctx.outputId, now: ctx.now,
      officialDomains: ctx.officialDomains, industryDomains: ctx.industryDomains,
    });

    return { records: finalRecords, resolution: resolution, buildErrors: buildErrors };
  }

  // ══════════════════════════════════════════════════════════════
  // Part G: claim wording の Evidence 範囲逸脱検出（非依存・常にブラウザ動作）
  // ══════════════════════════════════════════════════════════════
  var CAUSAL_PATTERN = /(ため|から(です)?。|理由は|なぜなら|ので、|によって)/;

  function detectUnsupportedClaimElements(claimText, evidenceRecords) {
    var text = _str(claimText);
    var records = Array.isArray(evidenceRecords) ? evidenceRecords : [];
    var supporting = records.filter(function (r) { return r && r.supportType === 'supports'; });
    var combinedSupportText = supporting.map(function (r) {
      return [_str(r.claim), _str(r.sourceExcerpt), _str(r.topic)].join(' ');
    }).join(' ');
    var grounded = supporting.length > 0;

    var numbers = text.match(/[0-9]+(?:\.[0-9]+)?/g) || [];
    var unsupportedNumbers = numbers.filter(function (n) { return combinedSupportText.indexOf(n) === -1; });

    var hasCausalWording = CAUSAL_PATTERN.test(text);
    var hasUnsupportedCausal = hasCausalWording && !grounded;

    var issues = [];
    if (!grounded) issues.push('no_supporting_evidence');
    if (unsupportedNumbers.length > 0) issues.push('unsupported_numbers:' + unsupportedNumbers.join(','));
    if (hasUnsupportedCausal) issues.push('unsupported_causal_claim');

    return {
      grounded: grounded,
      unsupportedNumbers: unsupportedNumbers,
      hasUnsupportedCausal: hasUnsupportedCausal,
      issues: issues,
    };
  }

  // ══════════════════════════════════════════════════════════════
  // Part G/H: claim finalization（非依存・常にブラウザ動作可能だが、実運用は server 側で行う）
  // ══════════════════════════════════════════════════════════════
  function finalizeContentClaim(intent, proposedText, evidenceRecordsForClaim, resolution, options) {
    var opts = _isPlainObject(options) ? options : {};
    var errors = [];
    var it = _isPlainObject(intent) ? intent : {};

    if (!_isNonEmptyString(it.intentId)) errors.push('intent_missing_or_invalid');
    if (!_isNonEmptyString(proposedText)) errors.push('proposed_text_missing');

    var claimId = it.intentId;
    var byClaim = (resolution && _isPlainObject(resolution.byClaim)) ? resolution.byClaim : {};
    var claimStatus = byClaim[claimId] || null;
    var grounded = !!(claimStatus && claimStatus.grounded === true);
    if (!grounded) errors.push('claim_not_grounded');

    var unsupported = detectUnsupportedClaimElements(proposedText, evidenceRecordsForClaim);
    if (unsupported.unsupportedNumbers.length > 0) errors.push('unsupported_numbers_in_wording');
    if (unsupported.hasUnsupportedCausal) errors.push('unsupported_causal_in_wording');

    if (errors.length > 0) {
      return { ok: false, claim: null, errors: errors, detection: unsupported };
    }

    var claim = {
      claimId: claimId,
      text: proposedText,
      claimType: it.claimTypeCandidate || null,
      topic: it.topic || null,
      status: 'grounded',
    };
    if (_isNonEmptyString(opts.claimScope)) claim.claimScope = opts.claimScope;

    return { ok: true, claim: claim, errors: [], detection: unsupported };
  }

  // ══════════════════════════════════════════════════════════════
  // Part J: Writer Grounding text（非依存・常にブラウザ動作）
  // ══════════════════════════════════════════════════════════════
  var DEFAULT_GROUNDING_MAX_CHARS = 3000;

  var CONTENT_EVIDENCE_WRITER_INSTRUCTION = [
    '■ Content Evidence（投稿本文のclaim裏付け専用。IADPアカウント設計・APFR商品事実とは別物であり混同しないこと）',
    '- 以下に無いclaim・数字・頻度・期限・比較優位・効果を新たに追加しない',
    '- Evidenceが示す範囲より強い表現にしない',
    '- 不足している場合は一般化するか、その主張自体を省略する',
    '- POINT → WHY → HOW/CHECK の構造を優先する',
  ].join('\n');

  function buildContentEvidenceGroundingText(finalizedClaims, evidenceByClaimId, options) {
    var opts = _isPlainObject(options) ? options : {};
    var maxChars = (typeof opts.maxChars === 'number' && opts.maxChars > 0) ? opts.maxChars : DEFAULT_GROUNDING_MAX_CHARS;
    var claims = Array.isArray(finalizedClaims) ? finalizedClaims : [];
    var byClaim = _isPlainObject(evidenceByClaimId) ? evidenceByClaimId : {};

    if (claims.length === 0) return '';

    var lines = [CONTENT_EVIDENCE_WRITER_INSTRUCTION, ''];
    for (var i = 0; i < claims.length; i++) {
      var c = claims[i];
      if (!_isPlainObject(c) || !_isNonEmptyString(c.text)) continue;
      var evs = Array.isArray(byClaim[c.claimId]) ? byClaim[c.claimId] : [];
      var srcSummaries = evs.filter(function (e) { return e && e.supportType === 'supports'; })
        .map(function (e) {
          var name = e.sourceName || e.sourceTitle || '(出典名なし)';
          return name + '/' + (e.reliability || 'unknown') + '/' + (e.verificationStatus || 'unverified');
        });
      var block = [
        '- claim: ' + c.text,
        '  claimType: ' + (c.claimType || 'unknown'),
        '  supports: ' + (srcSummaries.length ? srcSummaries.join('; ') : '(なし)'),
      ].join('\n');

      var candidateJoined = lines.concat([block]).join('\n');
      if (candidateJoined.length > maxChars) break;
      lines.push(block);
    }
    return lines.join('\n');
  }

  return {
    version: CONTENT_CLAIM_PLANNING_VERSION,
    // 依存可用性（テスト・診断用）
    _hasContentEvidence: function () { return !!contentEvidence; },
    _hasEvidenceAcquisition: function () { return !!evidenceAcquisition; },
    CONTENT_CLAIM_TYPES_FALLBACK: CONTENT_CLAIM_TYPES_FALLBACK,
    // Part A
    CLAIM_INTENT_STATUS_VALUES: CLAIM_INTENT_STATUS_VALUES,
    validateClaimIntent: validateClaimIntent,
    evaluateClaimIntentPhrasing: evaluateClaimIntentPhrasing,
    // Part B
    MEDICAL_THERAPEUTIC_PATTERNS: MEDICAL_THERAPEUTIC_PATTERNS,
    evaluateClaimIntentSafety: evaluateClaimIntentSafety,
    // Part C
    CONTENT_EVIDENCE_QUERY_CATEGORY: CONTENT_EVIDENCE_QUERY_CATEGORY,
    buildContentEvidenceQueries: buildContentEvidenceQueries,
    // Part D/E
    buildContentEvidenceFromCandidate: buildContentEvidenceFromCandidate,
    // Part F
    resolveClaimEvidenceBatch: resolveClaimEvidenceBatch,
    // Part G/H
    detectUnsupportedClaimElements: detectUnsupportedClaimElements,
    finalizeContentClaim: finalizeContentClaim,
    // Part J
    DEFAULT_GROUNDING_MAX_CHARS: DEFAULT_GROUNDING_MAX_CHARS,
    CONTENT_EVIDENCE_WRITER_INSTRUCTION: CONTENT_EVIDENCE_WRITER_INSTRUCTION,
    buildContentEvidenceGroundingText: buildContentEvidenceGroundingText,
  };
});
