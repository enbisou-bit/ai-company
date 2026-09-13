'use strict';
// contentClaimPlanning.test.js
// CV-4c-2: Claim Intent Planning + Evidence Acquisition adapter + Writer Grounding の
// deterministic テスト。
//
//   実HTTP 0 / 実AI API 0 / 実DB 0 / Web Evidence 0（固定fixtureのみ）。

const cp = require('./shared/contentClaimPlanning');
const contentEvidence = require('./shared/contentEvidence');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const CASE = 'case-value-claimplanning-1';
const NOW = Date.parse('2026-09-14T00:00:00.000Z');

// ── fixture: Claim Intent（問いであってclaimではない） ──
const INTENT_SKINCARE = {
  intentId: 'intent-1',
  caseId: CASE,
  topic: '洗顔後の保湿タイミング',
  question: '洗顔後の保湿はどの程度早く行うことが一般的に推奨されているか',
  claimTypeCandidate: 'general_practice',
  reason: 'thin post の一般論を具体的な判断基準へ置き換えるため',
  status: 'proposed',
};

const INTENT_MEDICAL = {
  intentId: 'intent-2',
  caseId: CASE,
  topic: 'ニキビの治療法',
  question: 'ニキビを治療するにはどの薬が効果的か',
  claimTypeCandidate: 'general_practice',
  reason: 'test: medical topic should be blocked regardless of candidate label',
  status: 'proposed',
};

// ── fixture: EEA Evidence Candidate相当（web_retrieved・常にunverified） ──
function candidate(sourceUrl, sourceTitle, sourceExcerpt) {
  return {
    sourceMethod: 'web_retrieved',
    sourceUrl: sourceUrl,
    sourceTitle: sourceTitle,
    sourceName: null,
    createdBy: 'system',
    sourceExcerpt: sourceExcerpt,
  };
}

function mapping(evidenceId, claimType, supportType, extra) {
  return Object.assign({
    evidenceId: evidenceId,
    claimType: claimType,
    supportType: supportType,
    retrievedAt: '2026-09-01T00:00:00.000Z',
    recordedAt: '2026-09-01T00:00:00.000Z',
  }, extra || {});
}

(async () => {
  console.log('\n=== contentClaimPlanning.test.js (CV-4c-2) ===');

  // ══════════════════════════════════════════════════════════════
  caseHeader('1. Claim Intent生成（Part A）');
  {
    const v = cp.validateClaimIntent(INTENT_SKINCARE);
    assert(v.valid === true, '1a. 正常なClaim Intentはvalid');
    const vBad = cp.validateClaimIntent({ intentId: 'x' });
    assert(vBad.valid === false && vBad.errors.indexOf('caseId_missing') !== -1, '1b. 必須field欠落でinvalid');
    const phr = cp.evaluateClaimIntentPhrasing(INTENT_SKINCARE);
    assert(phr.looksLikeQuestion === true, '1c. questionは問いの形として認識される');
    const phrBad = cp.evaluateClaimIntentPhrasing({ question: '洗顔後30秒以内に保湿すると肌の水分量が改善する。' });
    assert(phrBad.looksLikeQuestion === false && phrBad.warning === 'question_does_not_look_like_a_question',
      '1d. 断定文はquestionらしくないとwarning（禁止例が検出可能）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('2. medical topic blocked（Part B）');
  {
    const safety = cp.evaluateClaimIntentSafety(INTENT_MEDICAL);
    assert(safety.allowed === false && safety.status === 'blocked', '2a. 医療的topicはblocked');
    assert(safety.matchedPatterns.length > 0, '2b. マッチしたpatternが記録される');
    // 英語表現も検出できること
    const safetyEn = cp.evaluateClaimIntentSafety({ question: 'What is the best treatment for acne?', topic: 'acne treatment' });
    assert(safetyEn.allowed === false, '2c. 英語のtreatment表現もblocked');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('3. general practice intent allowed（Part B対比）');
  {
    const safety = cp.evaluateClaimIntentSafety(INTENT_SKINCARE);
    assert(safety.allowed === true && safety.status === 'proposed', '3a. 一般的なskincare topicはallowed');
    assert(safety.matchedPatterns.length === 0, '3b. マッチpattern0件');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('4. query plan生成（Part C）');
  {
    const plan = cp.buildContentEvidenceQueries([INTENT_SKINCARE, INTENT_MEDICAL]);
    assert(plan.queries.length === 1 && plan.queries[0].intentId === 'intent-1', '4a. allowed intentのみqueryになる');
    assert(plan.blocked.length === 1 && plan.blocked[0].intentId === 'intent-2', '4b. blocked intentはqueriesに含まれない');
    assert(plan.queries[0].category === cp.CONTENT_EVIDENCE_QUERY_CATEGORY, '4c. category は content_claim');
    assert(plan.queries[0].query === INTENT_SKINCARE.question, '4d. query は intent.question をそのまま使用（推測補完なし）');

    // 既存route契約（EvidenceAcquisition.validateAndLimitSearches）との互換性を構造的に確認
    const EvidenceAcquisition = require('./shared/evidenceAcquisition');
    const limited = EvidenceAcquisition.validateAndLimitSearches(plan.queries);
    assert(limited.ok === true && limited.limited.length === 1,
      '4e. ★既存 /api/evidence/web-search の入力検証（validateAndLimitSearches）をそのまま通過する');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('5. candidate adapter正常（Part D/E）');
  {
    const cand = candidate('https://www.mhlw.go.jp/skincare-guide', '保湿の目安について', '洗顔後は水分が急速に失われるため、5分以内に保湿することが推奨されています。');
    const r = cp.buildContentEvidenceFromCandidate(cand, INTENT_SKINCARE, mapping('ev-1', 'general_practice', 'supports'), { caseId: CASE });
    assert(r.ok === true, '5a. 正常なcandidateはok:true');
    assert(r.record.claimId === 'intent-1', '5b. claimId は intentId をそのまま使用');
    assert(r.record.claim === INTENT_SKINCARE.question, '5c. claim フィールドは問い（確定wordingではない）');
    assert(r.record.verificationStatus === 'unverified', '5d. web_retrieved は常に unverified で初期化される');
    assert(r.record.reliability === 'high', '5e. go.jp ドメインは reliability=high（classifySourceTrust再利用）');
    assert(!Object.prototype.hasOwnProperty.call(r.record, 'sourceTier'), '5f. sourceTier は保存しない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('6. 1 claim × 2 sources → 2 evidence records（Part F）');
  {
    const c1 = candidate('https://www.mhlw.go.jp/skincare-guide', '公的情報1', '洗顔後は5分以内の保湿が推奨されています。');
    const c2 = candidate('https://dermatology.or.jp/guide', '皮膚科学会情報', '洗顔後5分以内の保湿がすすめられています。');
    const batch = cp.resolveClaimEvidenceBatch(INTENT_SKINCARE, [
      { candidate: c1, mappingDecision: mapping('ev-1', 'general_practice', 'supports') },
      { candidate: c2, mappingDecision: mapping('ev-2', 'general_practice', 'supports') },
    ], { caseId: CASE, now: NOW });
    assert(batch.records.length === 2, '6a. 2候補 → 2 contentEvidence records');
    assert(batch.buildErrors.length === 0, '6b. build失敗なし');
    global.__batchTwoSources = batch; // 後続testで再利用
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('7. cross-case拒否（既存 resolveContentEvidence の境界を再利用）');
  {
    const c1 = candidate('https://www.mhlw.go.jp/skincare-guide', 'x', '5分以内の保湿。');
    const otherCaseIntent = Object.assign({}, INTENT_SKINCARE, { caseId: 'case-OTHER' });
    const batch = cp.resolveClaimEvidenceBatch(otherCaseIntent, [
      { candidate: c1, mappingDecision: mapping('ev-x', 'general_practice', 'supports') },
    ], { caseId: CASE, now: NOW }); // ★ context.caseId は別案件
    assert(batch.resolution.excludedCrossCase === 1, '7a. context.caseId と record.caseId 不一致は excludedCrossCase として除外される');
    assert(batch.resolution.verifiedCount === 0, '7b. cross-case Evidence は verifiedCount に寄与しない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('8. unverified自動昇格禁止（law_regulation以外で単独source）');
  {
    const c1 = candidate('https://www.mhlw.go.jp/skincare-guide', 'x', '5分以内の保湿。');
    const batch = cp.resolveClaimEvidenceBatch(INTENT_SKINCARE, [
      { candidate: c1, mappingDecision: mapping('ev-1', 'general_practice', 'supports') },
    ], { caseId: CASE, now: NOW });
    assert(batch.records[0].verificationStatus === 'unverified',
      '8a. ★general_practice で独立source 1件のみ → unverifiedのまま昇格しない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('9. Tier8禁止（SNS/掲示板は独立source数に関係なく常に昇格不可）');
  {
    const c1 = candidate('https://note.com/some-article', 'SNS的media1', '5分以内の保湿。');
    const c2 = candidate('https://www.tiktok.com/@someone/video', 'SNS的media2', '5分以内の保湿。');
    const batch = cp.resolveClaimEvidenceBatch(INTENT_SKINCARE, [
      { candidate: c1, mappingDecision: mapping('ev-1', 'general_practice', 'supports') },
      { candidate: c2, mappingDecision: mapping('ev-2', 'general_practice', 'supports') },
    ], { caseId: CASE, now: NOW });
    assert(batch.records.every(function (r) { return r.verificationStatus === 'unverified'; }),
      '9a. ★Tier8（SNS）は2件あっても常にunverifiedのまま（tier8_forbidden）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('10. Tier7 single禁止（一般Webメディア単独）');
  {
    const c1 = candidate('https://general-blog-media.example.com/article', '一般メディア', '5分以内の保湿。');
    const batch = cp.resolveClaimEvidenceBatch(INTENT_SKINCARE, [
      { candidate: c1, mappingDecision: mapping('ev-1', 'general_practice', 'supports') },
    ], { caseId: CASE, now: NOW });
    assert(batch.records[0].verificationStatus === 'unverified', '10a. ★Tier7単独はunverifiedのまま');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('11. 2 independent publishers判定（Tier1-6 ×2 → 両方verified）');
  {
    const batch = global.__batchTwoSources; // Case 6で構築済み（go.jp + or.jp = Tier1 + Tier5）
    assert(batch.records[0].verificationStatus === 'verified' && batch.records[1].verificationStatus === 'verified',
      '11a. ★独立2 publisher（Tier1-6）→ 両方 verified へ昇格');
    assert(batch.resolution.independentSourceCount === 2, '11b. independentSourceCount=2');
    assert(batch.resolution.byClaim['intent-1'] && batch.resolution.byClaim['intent-1'].grounded === true,
      '11c. byClaim[claimId].grounded === true');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('12. insufficient claim → Writer grounding除外（Part G/H）');
  {
    const c1 = candidate('https://general-blog-media.example.com/article', 'x', '5分以内の保湿。');
    const batch = cp.resolveClaimEvidenceBatch(INTENT_SKINCARE, [
      { candidate: c1, mappingDecision: mapping('ev-1', 'general_practice', 'supports') },
    ], { caseId: CASE, now: NOW }); // Tier7単独 → grounded=false のはず
    const fin = cp.finalizeContentClaim(INTENT_SKINCARE, '洗顔後は5分以内に保湿すると乾燥を防ぎやすくなります。', batch.records, batch.resolution, {});
    assert(fin.ok === false && fin.errors.indexOf('claim_not_grounded') !== -1,
      '12a. ★Evidence不足（grounded=false）のclaimはfinalize失敗');
    const grounding = cp.buildContentEvidenceGroundingText(fin.claim ? [fin.claim] : [], {});
    assert(grounding === '', '12b. finalize失敗claimはWriter groundingへ含まれない（空文字）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('13. sufficient claim → Writer grounding含む');
  {
    const batch = global.__batchTwoSources;
    const fin = cp.finalizeContentClaim(INTENT_SKINCARE, '洗顔後は5分以内に保湿すると乾燥を防ぎやすくなります。', batch.records, batch.resolution, {});
    assert(fin.ok === true && fin.claim && fin.claim.claimId === 'intent-1', '13a. Evidence充足claimはfinalize成功');
    const groundingText = cp.buildContentEvidenceGroundingText([fin.claim], { 'intent-1': batch.records });
    assert(groundingText.indexOf('claim: 洗顔後は5分以内に保湿すると乾燥を防ぎやすくなります。') !== -1,
      '13b. Writer grounding textにclaimが含まれる');
    global.__finalizedSufficientClaim = fin.claim;
    global.__batchTwoSourcesRef = batch;
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('14. Evidenceより強いclaim拒否（Part G）');
  {
    const batch = global.__batchTwoSources;
    // Evidenceは「5分以内」としか言っていないのに「3分以内」という未裏付け数値を主張
    const fin = cp.finalizeContentClaim(INTENT_SKINCARE, '洗顔後は3分以内に保湿すると乾燥を防ぎやすくなります。', batch.records, batch.resolution, {});
    assert(fin.ok === false && fin.errors.indexOf('unsupported_numbers_in_wording') !== -1,
      '14a. ★Evidenceに無い数値（3分）を含むclaimはfinalize失敗');
    assert(fin.detection.unsupportedNumbers.indexOf('3') !== -1, '14b. unsupportedNumbersに実際の数値が記録される');

    const detect = cp.detectUnsupportedClaimElements('効果があるので、毎日使うべきです。', []);
    assert(detect.hasUnsupportedCausal === true, '14c. 支持Evidence無しでの因果表現（ので）はhasUnsupportedCausal=true');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('15. Content Evidence見出し分離（Part J）');
  {
    const text = cp.buildContentEvidenceGroundingText([global.__finalizedSufficientClaim], { 'intent-1': global.__batchTwoSources.records });
    assert(text.indexOf('■ Content Evidence') === 0, '15a. 独立見出しで始まる');
    assert(text.indexOf('IADPアカウント設計・APFR商品事実とは別物') !== -1, '15b. IADP/APFRとの混同禁止が明記される');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('16. IADP/APFR混在防止（構造確認）');
  {
    const src = require('fs').readFileSync(require('path').join(__dirname, 'shared', 'contentClaimPlanning.js'), 'utf8');
    assert(src.indexOf('intelligenceContext') === -1, '16a. intelligenceContext（IADP/APFR格納field）を一切参照しない');
    assert(src.indexOf('apfrFacts') === -1 && src.indexOf('APFR') === undefined || src.indexOf('extractApfrFacts') === -1,
      '16b. APFR facts抽出ロジックを持たない');
    assert(src.indexOf('productIdentifier') === -1, '16c. productIdentifierを一切参照しない（Value専用の独立実装）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('17. 8000文字上限対策（maxChars設計）');
  {
    // 大量claimを作り、小さいmaxCharsで打ち切られることを確認
    const manyClaims = [];
    const evidenceByClaim = {};
    for (let i = 0; i < 50; i++) {
      const cid = 'intent-many-' + i;
      manyClaims.push({ claimId: cid, text: '長めのclaim文をここに配置してテストします。'.repeat(3) + i, claimType: 'general_practice' });
      evidenceByClaim[cid] = [{ supportType: 'supports', sourceName: 's' + i, reliability: 'high', verificationStatus: 'verified' }];
    }
    const smallText = cp.buildContentEvidenceGroundingText(manyClaims, evidenceByClaim, { maxChars: 500 });
    assert(smallText.length <= 500 + 200, '17a. maxChars指定でtextが際限なく伸びない（打ち切りが機能）');
    const defaultText = cp.buildContentEvidenceGroundingText(manyClaims, evidenceByClaim, {});
    assert(defaultText.length <= cp.DEFAULT_GROUNDING_MAX_CHARS + 500, '17b. 既定maxCharsも有限（caseDataContext 8000文字予算内に収まる設計）');
    assert(cp.DEFAULT_GROUNDING_MAX_CHARS < 8000, '17c. ★既定値は8000文字予算より十分小さい（他コンテキストとの共存を考慮）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('18. contentClaims保存payload（既存 contentValueQuality.js 契約との整合）');
  {
    const claim = global.__finalizedSufficientClaim;
    assert(typeof claim.claimId === 'string' && claim.claimId.length > 0, '18a. claimId あり');
    assert(typeof claim.text === 'string' && claim.text.length > 0, '18b. ★field名は text（contentValueQuality.js の _matchDeclaredClaim 契約と一致）');
    assert(!Object.prototype.hasOwnProperty.call(claim, 'claim'), '18c. 「claim」という誤ったfield名は使わない');
    // 実際に contentValueQuality.js の期待形状で読めることを確認
    const cvq = require('./shared/contentValueQuality');
    const slides = ['【1枚目】タイトル：保湿の目安 / 本文：' + claim.text];
    const evalResult = cvq.evaluateContentValue(
      { caseId: CASE, outputId: 'out-test', fields: { slides: slides, contentClaims: [claim], contentEvidence: global.__batchTwoSources.records } },
      { contentType: 'value', now: NOW }
    );
    assert(evalResult.claims.length > 0 && evalResult.claims.some(function (c) { return c.claimId === claim.claimId && c.grounded === true; }),
      '18d. ★contentValueQuality.evaluateContentValue() が実際にこのclaimをgroundedと認識する（統合確認）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('19. contentEvidence保存payload（既存schema validatorとの整合）');
  {
    const batch = global.__batchTwoSources;
    batch.records.forEach(function (r, i) {
      const v = contentEvidence.validateContentEvidenceRecord(r, { expectedCaseId: CASE });
      assert(v.valid === true, '19.' + i + ' record[' + i + '] は既存 validateContentEvidenceRecord() を通過する: ' + v.errors.join(','));
    });
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('20. client contentValue不信維持（web_retrieved の verified 直接指定は無視される）');
  {
    const cand = candidate('https://general-blog-media.example.com/article', 'x', '5分以内の保湿。');
    // ★ mappingDecisionでverificationStatus:'verified'を直接指定しても、web_retrievedには反映されない
    const r = cp.buildContentEvidenceFromCandidate(cand, INTENT_SKINCARE,
      mapping('ev-spoof', 'general_practice', 'supports', { verificationStatus: 'verified' }),
      { caseId: CASE });
    assert(r.ok === true && r.record.verificationStatus === 'unverified',
      '20a. ★mappingDecisionのverificationStatus直接指定はweb_retrievedでは無視され unverified のまま（ルールベース昇格のみが有効な経路）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('21. valueでAPFR injectionなし（モジュールレベルの独立性）');
  {
    const src = require('fs').readFileSync(require('path').join(__dirname, 'shared', 'contentClaimPlanning.js'), 'utf8');
    assert(src.indexOf("require('./contentValueQuality')") === -1 && src.indexOf('require("./contentValueQuality")') === -1,
      '21a. shared/contentValueQuality.js を require していない（責務分離維持）');
    assert(src.indexOf('lib/contentValueService') === -1, '21b. lib/contentValueService.js を参照していない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('22. medical/therapeutic fail-closed（境界網羅）');
  {
    const medicalTopics = [
      'このクリームで皮膚炎を治療できますか',
      'アトピーに効く方法は',
      'ニキビの薬効成分について',
      'この成分でがん予防になりますか',
      'What medication treats eczema?',
      'Does this cure acne?',
    ];
    medicalTopics.forEach(function (q, i) {
      const s = cp.evaluateClaimIntentSafety({ question: q, topic: q });
      assert(s.allowed === false, '22.' + i + ' "' + q + '" は blocked');
    });
    // 対比: 一般的な生活習慣topicはブロックされない
    const generalTopics = [
      '洗顔の頻度はどのくらいが一般的か',
      '保湿剤を選ぶときの基準は',
      '日焼け止めの塗り直しタイミングは',
    ];
    generalTopics.forEach(function (q, i) {
      const s = cp.evaluateClaimIntentSafety({ question: q, topic: q });
      assert(s.allowed === true, '22-general.' + i + ' "' + q + '" は allowed（対比確認）');
    });
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('23. medical_effect claimTypeを追加していないことの確認（既存境界維持）');
  {
    assert(contentEvidence.CONTENT_CLAIM_TYPES.indexOf('medical_effect') === -1,
      '23a. ★shared/contentEvidence.js に medical_effect claimType は存在しない（今回も追加していない）');
    assert(contentEvidence.CONTENT_CLAIM_TYPES.indexOf('unknown') !== -1,
      '23b. unknown 境界は維持されている');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All contentClaimPlanning cases passed (CV-4c-2)'); }
})().catch(function (e) { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
