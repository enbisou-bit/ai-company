'use strict';
// shared/contentEvidence.js
// Evidence-Based Content Value Quality — CV-3a: Value Content 用 contentEvidence[] Core。
//
//   目的: 前工程 read-only 調査（CV-1 + CV-2 Contract Design）で確認された
//         「Value Content 用の一般ドメイン Evidence の器が存在しない」状態への対応。
//         投稿本文の具体的 claim を grounding するための Evidence レコードを、
//         schema / enum / verification / 集計 の各層で決定的に扱う。
//
//   責務:
//     - contentEvidence レコード（1 record = 1 claim × 1 source）の schema / enum / validator
//     - 既存 shared/evidenceAcquisition.js（classifySourceTrust / evaluateVerifiedPromotion）を
//       read-only で再利用した Source Trust 接続
//     - isVerifiedContentEvidence()（レコード単位の検証済み判定・推測で verified にしない）
//     - resolveContentEvidence()（既存三値 sufficient / partial / insufficient で集計）
//     - cross-case guard（別 caseId の Evidence を sufficient に寄与させない）
//     - contradicts を supports として数えない
//     - fail-closed（異常入力は例外で全体を落とさず、verified へ昇格させない安全側へ倒す）
//
//   非責務（このファイルが絶対にやらないこと）:
//     - Content Value Quality 6軸本体（specificity / informationGain / actionability 等）
//       — CV-3b の shared/contentValueQuality.js の責務
//     - 既存 shared/evidenceAcquisition.js / shared/iadpIntelligenceContext.js の書き換え
//     - 既存 IADP intelligenceContext.evidence[] / APFR facts[] への読み書き
//     - 新しい Source Trust Tier ルール・新しい医学的 Evidence ルールの発明
//     - sourceTier の保存（sourceUrl 等から classifySourceTrust() で毎回導出する）
//     - AI 生成物を Evidence として登録する経路（enum に generated_hypothesis /
//       ai_interpretation を含めない＝型レベルで不可能にする）
//     - DB / Network / DOM / filesystem write / AI API 呼び出し
//
//   determinism: 純関数。固定 enum・固定閾値（既存値の再利用）・固定判定のみ。
//                乱数なし・時刻依存なし（now は呼び出し側が注入）・外部 I/O なし・LLM 呼び出しなし。
//                入力オブジェクトを一切変更しない（非破壊）。

var evidenceAcquisition = require('./evidenceAcquisition');   // read-only 再利用（変更しない）
var iadp = require('./iadpIntelligenceContext');              // 既存閾値の再利用（変更しない）

var CONTENT_EVIDENCE_VERSION = '1.0.0';

// ══════════════════════════════════════════════════════════════
// enum
// ══════════════════════════════════════════════════════════════

// source 取得方法。★ generated_hypothesis / ai_interpretation は意図的に含めない。
//   AI 生成物を Evidence として登録できる経路を型レベルで存在させないため。
var CONTENT_EVIDENCE_SOURCE_METHODS = Object.freeze([
  'web_retrieved',                  // 外部 Web 検索で取得（sourceUrl 必須）
  'manual_user_input',              // ユーザーが本人の判断で手入力した一次情報
  'public_document_user_verified',  // 公的文書等をユーザーが確認のうえ登録
]);

// claim 種別。★ medical_effect 等の医学系 claimType は追加しない（既存契約どおり
//   医学的・治療的 claim は unknown 扱い → Publishing 可能な verified へ昇格不可）。
var CONTENT_CLAIM_TYPES = Object.freeze([
  'general_practice',   // 日常的な習慣・手順・条件（美容/生活の一般実践）
  'law_regulation',     // 法律・規約・公的ルール
  'public_statistic',   // 公的統計・調査数値
  'unknown',            // 分類不能 / 医学的・治療的主張 → 常に昇格不可（安全側）
]);

var CONTENT_SUPPORT_TYPES = Object.freeze([
  'supports',      // claim を支持する
  'contradicts',   // claim に反する（★ supports として数えない）
  'context',       // 背景情報（支持でも反証でもない）
]);

// verificationStatus / reliability は既存 index.html の列挙をそのまま再利用する
//   （新しい語彙を増やさない）。
var CONTENT_EVIDENCE_VERIFICATION_STATUS = Object.freeze(['unverified', 'verified', 'user_verified']);
var CONTENT_EVIDENCE_RELIABILITY = Object.freeze(['high', 'medium', 'low', 'unknown']);

var CONTENT_EVIDENCE_CREATED_BY = Object.freeze(['system', 'user']);

// ══════════════════════════════════════════════════════════════
// 既存閾値の再利用（新しい閾値を作らない）
//   shared/iadpIntelligenceContext.js が export する値をそのまま使う。
//   require 失敗時のみ、同ファイルに記載の既定値へ fail-safe（値は変えない）。
// ══════════════════════════════════════════════════════════════
var MIN_VERIFIED_EVIDENCE = (iadp && typeof iadp.MIN_VERIFIED_EVIDENCE === 'number') ? iadp.MIN_VERIFIED_EVIDENCE : 3;
var MIN_INDEPENDENT_SOURCES = (iadp && typeof iadp.MIN_INDEPENDENT_SOURCES === 'number') ? iadp.MIN_INDEPENDENT_SOURCES : 2;
var STALE_DAYS = (iadp && typeof iadp.STALE_DAYS === 'number') ? iadp.STALE_DAYS : 30;

// ══════════════════════════════════════════════════════════════
// 小さなヘルパー（純関数）
// ══════════════════════════════════════════════════════════════
function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _str(v) { return (v === null || v === undefined) ? '' : String(v); }
function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }

function _isValidIso(v) {
  if (typeof v !== 'string' || !v.trim()) return false;
  var t = Date.parse(v);
  return !isNaN(t);
}

// retrievedAt / recordedAt を基準に経過日数を返す（負値・パース不能は null）。
function _ageDays(iso, nowMs) {
  if (!_isValidIso(iso)) return null;
  var then = Date.parse(iso);
  var now = (typeof nowMs === 'number' && isFinite(nowMs)) ? nowMs : Date.now();
  var d = (now - then) / 86400000;
  return d;
}

// claim 種別 → 既存 evaluateVerifiedPromotion() の claimType へ写像する薄い adapter。
//   ★ 既存関数は変更しない。既存 'market' の promotion rule（Tier1-6 かつ独立source>=2、
//     Tier7 単独禁止、Tier8 常に禁止）へ general_practice / public_statistic を写像する。
//   ★ unknown は null（＝昇格不可・安全側）。
function _mapClaimTypeToPromotionType(claimType) {
  if (claimType === 'law_regulation') return 'law_regulation';
  if (claimType === 'general_practice' || claimType === 'public_statistic') return 'market';
  return null;   // unknown / 未知 → 昇格不可
}

// publisher 単位の独立ソースキー（evidenceAcquisition の _publisherKeyOf と同一優先順位:
//   sourceName → sourceUrl の hostname → sourceReference。ここでは sourceReference の代わりに
//   sourceTitle を最終 fallback にせず、独立性を過大評価しないため null を返す）。
function _publisherKey(rec) {
  var n = _str(rec && rec.sourceName).trim();
  if (n) return 'name:' + n;
  var url = _str(rec && rec.sourceUrl).trim();
  if (url) {
    try {
      var host = new URL(url).hostname.toLowerCase();
      if (host.indexOf('www.') === 0) host = host.slice(4);
      if (host) return 'domain:' + host;
    } catch (e) { /* fall through */ }
  }
  return null;   // 独立ソースとして数えられない
}

// ══════════════════════════════════════════════════════════════
// validateContentEvidenceRecord — schema / enum の最小 validation（非破壊・推測補完なし）
//   opts: { expectedCaseId?: string }  省略時は caseId 一致チェックをスキップ
//   戻り値: { valid: boolean, errors: string[] }
// ══════════════════════════════════════════════════════════════
function validateContentEvidenceRecord(record, opts) {
  var o = _isPlainObject(opts) ? opts : {};
  var errors = [];

  if (!_isPlainObject(record)) {
    return { valid: false, errors: ['record_missing_or_invalid'] };
  }

  // ── 必須 field ──
  if (!_isNonEmptyString(record.evidenceId)) errors.push('evidenceId_missing');
  if (!_isNonEmptyString(record.caseId)) errors.push('caseId_missing');
  else if (_isNonEmptyString(o.expectedCaseId) && String(record.caseId) !== String(o.expectedCaseId)) errors.push('caseId_mismatch');
  if (!_isNonEmptyString(record.claimId)) errors.push('claimId_missing');
  if (!_isNonEmptyString(record.claim)) errors.push('claim_missing');

  if (CONTENT_CLAIM_TYPES.indexOf(record.claimType) === -1) errors.push('invalid_claimType');
  if (CONTENT_SUPPORT_TYPES.indexOf(record.supportType) === -1) errors.push('invalid_supportType');
  if (CONTENT_EVIDENCE_SOURCE_METHODS.indexOf(record.sourceMethod) === -1) errors.push('invalid_sourceMethod');
  if (CONTENT_EVIDENCE_VERIFICATION_STATUS.indexOf(record.verificationStatus) === -1) errors.push('invalid_verificationStatus');
  if (CONTENT_EVIDENCE_RELIABILITY.indexOf(record.reliability) === -1) errors.push('invalid_reliability');
  if (CONTENT_EVIDENCE_CREATED_BY.indexOf(record.createdBy) === -1) errors.push('invalid_createdBy');

  if (!_isValidIso(record.retrievedAt)) errors.push('invalid_retrievedAt');
  if (!_isValidIso(record.recordedAt)) errors.push('invalid_recordedAt');

  // ── web_retrieved は sourceUrl 必須（推測補完しない） ──
  if (record.sourceMethod === 'web_retrieved' && !_isNonEmptyString(record.sourceUrl)) {
    errors.push('web_retrieved_requires_sourceUrl');
  }

  // ── optional field は「存在する場合のみ型検証」（欠落は許容・推測補完しない） ──
  if (record.outputId != null && typeof record.outputId !== 'string') errors.push('invalid_outputId');
  if (record.sourceUrl != null && typeof record.sourceUrl !== 'string') errors.push('invalid_sourceUrl');
  if (record.sourceTitle != null && typeof record.sourceTitle !== 'string') errors.push('invalid_sourceTitle');
  if (record.sourceName != null && typeof record.sourceName !== 'string') errors.push('invalid_sourceName');
  if (record.sourceExcerpt != null && typeof record.sourceExcerpt !== 'string') errors.push('invalid_sourceExcerpt');
  if (record.topic != null && typeof record.topic !== 'string') errors.push('invalid_topic');

  // ── sourceUrl は指定があれば URL としてパース可能であること ──
  if (_isNonEmptyString(record.sourceUrl)) {
    try { /* eslint-disable no-new */ new URL(record.sourceUrl); /* eslint-enable no-new */ }
    catch (e) { errors.push('unparseable_sourceUrl'); }
  }

  // ── sourceTier を記録上に持ち込ませない（保存された tier を信用する設計を禁止） ──
  if (Object.prototype.hasOwnProperty.call(record, 'sourceTier')) errors.push('sourceTier_must_not_be_stored');

  return { valid: errors.length === 0, errors: errors };
}

// ══════════════════════════════════════════════════════════════
// isVerifiedContentEvidence — レコード単位の「検証済み source」判定（推測で verified にしない）
//   context: { caseId?: string, now?: number, officialDomains?: string[], industryDomains?: string[] }
//   戻り値: { verified: boolean, stale: boolean, tier: number|null, reliability: string, reasons: string[] }
//
//   ★ この関数は「1 レコードが個別に正当な検証済み source か」を判定する。
//     claim を grounding するのに十分な「独立ソース数」（general_practice の 2件以上等）は
//     claim 横断の性質のため resolveContentEvidence() 側で evaluateVerifiedPromotion() を用いて判定する。
//   ★ stale は既存 IADP 契約どおり「明示のみ・自動無効化しない」。verified を false にしない。
// ══════════════════════════════════════════════════════════════
function isVerifiedContentEvidence(record, context) {
  var ctx = _isPlainObject(context) ? context : {};
  var reasons = [];
  var out = { verified: false, stale: false, tier: null, reliability: 'unknown', reasons: reasons };

  try {
    // 1. schema valid
    var v = validateContentEvidenceRecord(record, { expectedCaseId: ctx.caseId });
    if (!v.valid) { reasons.push('schema_invalid:' + v.errors.join(',')); return out; }

    out.reliability = _str(record.reliability) || 'unknown';

    // 2. case scope valid（context.caseId 指定時は一致必須。record.caseId 空は上位で除外済み前提）
    if (_isNonEmptyString(ctx.caseId) && String(record.caseId) !== String(ctx.caseId)) {
      reasons.push('cross_case'); return out;
    }

    // 3. supportType: contradicts / context は「検証済み支持」ではない
    if (record.supportType !== 'supports') { reasons.push('not_a_supporting_record'); return out; }

    // 4. sourceMethod valid（enum は schema で検証済み。AI 由来は enum に存在しないため到達不能）
    //    web_retrieved は sourceUrl 必須（schema で検証済み）。

    // 5. verificationStatus valid: unverified は検証済みではない
    if (record.verificationStatus === 'unverified') { reasons.push('unverified_status'); return out; }

    // 6. claimType promotion rule valid: unknown は常に昇格不可（医学・治療 claim を含む）
    var promoType = _mapClaimTypeToPromotionType(record.claimType);
    if (promoType === null) { reasons.push('claimType_not_promotable'); return out; }

    // 7. source trust rule valid（sourceTier は保存値ではなく毎回 classifySourceTrust() で導出）
    var trust = null;
    if (_isNonEmptyString(record.sourceUrl)) {
      trust = evidenceAcquisition.classifySourceTrust(record.sourceUrl, {
        officialDomains: Array.isArray(ctx.officialDomains) ? ctx.officialDomains : [],
        industryDomains: Array.isArray(ctx.industryDomains) ? ctx.industryDomains : [],
      });
      out.tier = trust ? trust.tier : null;
    }

    if (record.sourceMethod === 'web_retrieved') {
      if (!trust || trust.tier === null) { reasons.push('trust_unclassifiable'); return out; }
      if (trust.tier === 8) { reasons.push('tier8_forbidden'); return out; }   // SNS/掲示板/個人ブログは常に禁止
      if (promoType === 'law_regulation') {
        if (trust.tier !== 1 && trust.tier !== 4) { reasons.push('law_regulation_requires_tier1_or_4'); return out; }
      } else { // market 系（general_practice / public_statistic）
        if (trust.tier < 1 || trust.tier > 6) { reasons.push('tier_out_of_range_for_general_practice'); return out; }
        // Tier7 単独は resolve 側で 2 sources 判定に回す。ここでは Tier1-6 のみ verified 候補とする。
      }
    } else {
      // manual_user_input / public_document_user_verified: sourceUrl が無い場合は
      //   user_verified を要求する（system が根拠なしに verified 化する経路を作らない）。
      if (!_isNonEmptyString(record.sourceUrl) && record.verificationStatus !== 'user_verified') {
        reasons.push('offline_source_requires_user_verified'); return out;
      }
    }

    // 8. stale rule（明示のみ・verified を false にしない＝既存 IADP 契約を維持）
    var age = _ageDays(record.retrievedAt, ctx.now);
    if (age === null) age = _ageDays(record.recordedAt, ctx.now);
    if (age !== null && age > STALE_DAYS) { out.stale = true; reasons.push('stale_over_' + STALE_DAYS + '_days'); }

    out.verified = true;
    reasons.push('verified');
    return out;
  } catch (e) {
    // fail-closed: 例外時も verified:false のまま（誤って検証済み側へ倒さない）
    reasons.push('exception:' + (e && e.message ? e.message : 'unknown'));
    return out;
  }
}

// ══════════════════════════════════════════════════════════════
// resolveContentEvidence — claim → Evidence の集計（既存三値で status を返す）
//   records: contentEvidence レコード配列
//   context: { caseId: string, outputId?: string, now?: number,
//              officialDomains?: string[], industryDomains?: string[] }
//   戻り値（要約）:
//     {
//       version, available, caseId, caseIdMatched,
//       totalCount, consideredCount, excludedCrossCase, excludedOtherOutput,
//       verifiedCount, contradictsCount, contextCount,
//       independentSourceCount, staleCount, staleAll,
//       byClaim: { <claimId>: { verifiedCount, independentSourceCount, contradicts, promotion, grounded } },
//       status: 'sufficient' | 'partial' | 'insufficient',
//       reasons: string[]
//     }
//   ★ cross-case Evidence が sufficient に寄与してはいけない。
//   ★ contradicts を supports として数えない。
//   ★ 閾値は既存値（MIN_VERIFIED_EVIDENCE / MIN_INDEPENDENT_SOURCES / STALE_DAYS）のみ。
// ══════════════════════════════════════════════════════════════
function resolveContentEvidence(records, context) {
  var ctx = _isPlainObject(context) ? context : {};
  var res = {
    version: CONTENT_EVIDENCE_VERSION,
    available: false,
    caseId: _isNonEmptyString(ctx.caseId) ? String(ctx.caseId) : null,
    caseIdMatched: false,
    totalCount: 0,
    consideredCount: 0,
    excludedCrossCase: 0,
    excludedOtherOutput: 0,
    excludedInvalid: 0,
    verifiedCount: 0,
    contradictsCount: 0,
    contextCount: 0,
    independentSourceCount: 0,
    staleCount: 0,
    staleAll: false,
    byClaim: {},
    status: 'insufficient',
    reasons: [],
  };

  try {
    if (!_isNonEmptyString(ctx.caseId)) {
      res.reasons.push('案件が特定できないためEvidenceを採用しません');
      return res;
    }
    var all = Array.isArray(records) ? records : [];
    res.totalCount = all.length;
    if (all.length === 0) {
      res.reasons.push('contentEvidenceが0件です');
      return res;
    }

    var wantOutputId = _isNonEmptyString(ctx.outputId) ? String(ctx.outputId) : null;

    // ── 1. cross-case / other-output / schema でフィルタ ──
    var considered = [];
    for (var i = 0; i < all.length; i++) {
      var r = all[i];
      if (!_isPlainObject(r)) { res.excludedInvalid++; continue; }

      // cross-case guard: record.caseId が空は上位 caseId に委ねる。指定があり不一致なら除外。
      if (_isNonEmptyString(r.caseId) && String(r.caseId) !== String(ctx.caseId)) { res.excludedCrossCase++; continue; }

      // outputId scope: record.outputId が指定されていて context.outputId と不一致なら除外
      //   （record.outputId 未指定 = 同一 case 内で横断利用可）。
      if (wantOutputId && _isNonEmptyString(r.outputId) && String(r.outputId) !== wantOutputId) { res.excludedOtherOutput++; continue; }

      var v = validateContentEvidenceRecord(r, { expectedCaseId: ctx.caseId });
      if (!v.valid) { res.excludedInvalid++; continue; }

      considered.push(r);
    }

    res.consideredCount = considered.length;
    res.caseIdMatched = true;
    if (considered.length === 0) {
      res.reasons.push('採用可能なcontentEvidenceが0件です（cross-case/別output/schema不正で除外）');
      return res;
    }
    res.available = true;

    // ── 2. supportType 別に仕分け + verified 判定 ──
    var verifiedSupporting = [];   // { rec, tier, stale, reliability }
    var byClaimSupport = {};       // claimId -> [rec...]（supports のみ）
    var srcKeySet = {};

    for (var j = 0; j < considered.length; j++) {
      var rec = considered[j];
      if (rec.supportType === 'contradicts') { res.contradictsCount++; }
      else if (rec.supportType === 'context') { res.contextCount++; }

      if (rec.supportType !== 'supports') continue;

      if (!byClaimSupport[rec.claimId]) byClaimSupport[rec.claimId] = [];
      byClaimSupport[rec.claimId].push(rec);

      var iv = isVerifiedContentEvidence(rec, {
        caseId: ctx.caseId, now: ctx.now,
        officialDomains: ctx.officialDomains, industryDomains: ctx.industryDomains,
      });
      if (iv.stale) res.staleCount++;
      if (iv.verified) {
        res.verifiedCount++;
        verifiedSupporting.push({ rec: rec, tier: iv.tier, stale: iv.stale, reliability: iv.reliability });
        var pk = _publisherKey(rec);
        if (pk) srcKeySet[pk] = true;
      }
    }

    res.independentSourceCount = Object.keys(srcKeySet).length;
    res.staleAll = (res.staleCount > 0 && res.staleCount === res.verifiedCount && res.verifiedCount > 0);

    // reliability が low のみで構成される場合は sufficient へ上げない（既存 IADP と同一）
    var relLow = 0, relOther = 0;
    for (var k = 0; k < verifiedSupporting.length; k++) {
      if (verifiedSupporting[k].reliability === 'low') relLow++; else relOther++;
    }
    var lowOnly = (relLow > 0 && relOther === 0);

    // ── 3. claim 単位の grounding 判定（evaluateVerifiedPromotion を read-only で使用） ──
    var claimIds = Object.keys(byClaimSupport);
    for (var c = 0; c < claimIds.length; c++) {
      var cid = claimIds[c];
      var recs = byClaimSupport[cid];
      var primary = recs[0];
      var promoType = _mapClaimTypeToPromotionType(primary.claimType);

      var claimVerified = 0;
      var claimSrcSet = {};
      for (var m = 0; m < recs.length; m++) {
        var rr = recs[m];
        var rv = isVerifiedContentEvidence(rr, {
          caseId: ctx.caseId, now: ctx.now,
          officialDomains: ctx.officialDomains, industryDomains: ctx.industryDomains,
        });
        if (rv.verified) {
          claimVerified++;
          var cpk = _publisherKey(rr);
          if (cpk) claimSrcSet[cpk] = true;
        }
      }

      var promotion = null;
      var grounded = false;
      if (promoType === null) {
        promotion = { eligible: false, reason: 'claimType_not_promotable', tier: null, independentSourceCount: Object.keys(claimSrcSet).length };
      } else {
        // 既存 evaluateVerifiedPromotion を primary + related で呼ぶ（既存関数は無変更）。
        var related = recs.slice(1);
        promotion = evidenceAcquisition.evaluateVerifiedPromotion(promoType, primary, related);
        grounded = !!(promotion && promotion.eligible) && claimVerified >= 1;
      }

      res.byClaim[cid] = {
        claimType: primary.claimType,
        supportRecordCount: recs.length,
        verifiedCount: claimVerified,
        independentSourceCount: Object.keys(claimSrcSet).length,
        contradicts: false,   // 下で反証を反映
        promotion: promotion ? { eligible: !!promotion.eligible, reason: promotion.reason || null, tier: promotion.tier != null ? promotion.tier : null } : null,
        grounded: grounded,
      };
    }

    // 反証を claim へ反映（反証がある claim は grounded を取り消す）
    for (var d = 0; d < considered.length; d++) {
      var cr = considered[d];
      if (cr.supportType !== 'contradicts') continue;
      if (res.byClaim[cr.claimId]) {
        res.byClaim[cr.claimId].contradicts = true;
        res.byClaim[cr.claimId].grounded = false;
      }
    }

    // ── 4. 集計 status（既存三値・既存閾値のみ） ──
    if (res.verifiedCount === 0) {
      res.status = 'insufficient';
      res.reasons.push('検証済みcontentEvidenceが0件です');
    } else if (res.verifiedCount >= MIN_VERIFIED_EVIDENCE
               && res.independentSourceCount >= MIN_INDEPENDENT_SOURCES
               && !lowOnly) {
      res.status = 'sufficient';
      res.reasons.push('検証済みEvidence ' + res.verifiedCount + '件・独立source ' + res.independentSourceCount + '件');
    } else {
      res.status = 'partial';
      if (res.verifiedCount < MIN_VERIFIED_EVIDENCE) res.reasons.push('検証済みEvidenceが' + res.verifiedCount + '件（' + MIN_VERIFIED_EVIDENCE + '件未満）');
      if (res.independentSourceCount < MIN_INDEPENDENT_SOURCES) res.reasons.push('独立sourceが' + res.independentSourceCount + '件のみ（単一ソースに依存）');
      if (lowOnly) res.reasons.push('検証済みEvidenceの信頼度がすべてlowです');
    }

    if (res.contradictsCount > 0) res.reasons.push('反証Evidenceが' + res.contradictsCount + '件あります（支持件数には数えていません）');
    if (res.staleCount > 0) res.reasons.push('うち' + res.staleCount + '件は' + STALE_DAYS + '日超の古いEvidenceです（無効化はしていません）');
    if (res.excludedCrossCase > 0) res.reasons.push('別案件のEvidence ' + res.excludedCrossCase + '件を除外しました');

    return res;
  } catch (e) {
    // fail-closed: 例外時は insufficient のまま（突然 sufficient にしない）
    res.status = 'insufficient';
    res.available = false;
    res.reasons.push('exception:' + (e && e.message ? e.message : 'unknown'));
    return res;
  }
}

module.exports = {
  version: CONTENT_EVIDENCE_VERSION,
  CONTENT_EVIDENCE_SOURCE_METHODS: CONTENT_EVIDENCE_SOURCE_METHODS,
  CONTENT_CLAIM_TYPES: CONTENT_CLAIM_TYPES,
  CONTENT_SUPPORT_TYPES: CONTENT_SUPPORT_TYPES,
  CONTENT_EVIDENCE_VERIFICATION_STATUS: CONTENT_EVIDENCE_VERIFICATION_STATUS,
  CONTENT_EVIDENCE_RELIABILITY: CONTENT_EVIDENCE_RELIABILITY,
  CONTENT_EVIDENCE_CREATED_BY: CONTENT_EVIDENCE_CREATED_BY,
  MIN_VERIFIED_EVIDENCE: MIN_VERIFIED_EVIDENCE,
  MIN_INDEPENDENT_SOURCES: MIN_INDEPENDENT_SOURCES,
  STALE_DAYS: STALE_DAYS,
  validateContentEvidenceRecord: validateContentEvidenceRecord,
  isVerifiedContentEvidence: isVerifiedContentEvidence,
  resolveContentEvidence: resolveContentEvidence,
  _mapClaimTypeToPromotionType: _mapClaimTypeToPromotionType,
};
