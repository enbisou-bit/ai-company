// ══════════════════════════════════════════════════════════════
// shared/instagramAccountDesignQuality.js
// Phase IG-2C: Instagram Account Design Package 専用品質評価 Core
//
// 責務（IADPが「実際にInstagramアカウントを作れる情報量を持つか」の評価のみ）:
//   ・shared/instagramAccountDesign.js の validateAccountDesignPackage() は構造Validator
//     （契約どおりのキー・型が揃っているか＝structural）であり、本ファイルとは責務が異なる。
//   ・本Coreは「構造が存在するだけでなく、実用的な内容が埋まっているか」を評価する
//     （practical usability）。両者は明確に別レイヤーであり、混同しない。
//   ・既存Quality Gate（Output Package Quality・evaluateOutputPackageCompleteness）へは
//     一切統合しない。IADP専用の独立した評価軸として新設する。
//
// 非責務:
//   実AI呼び出し・DB保存・F5復元・編集・承認・既存Quality Gateとの統合・IADP Core本体の変更。
//
// スコア設計方針:
//   ・8カテゴリそれぞれについて「必須フィールドの内容充足」をscore/categoryScores/
//     missingRequiredFieldsへ算入する（narrative content presence）。
//   ・「10軸すべて構造的に揃っているか」「採用/保留/却下が区別可能か」「adoptedCandidateIdが
//     実在候補と一致するか」等の内部整合性チェックは、score算入対象から意図的に除外し、
//     complete判定専用の追加ゲート（axesComplete/decisionDistinguishable/adoptionValid）
//     として独立させる。理由：これらをscoreへ含めると「必須欠損0」＝常にscore100＝
//     complete/almost_readyの階層が実質的に区別できなくなるため（設計上の教訓）。
//
// 設計原則:
//   ・純粋関数のみ（DOM/Node専用API/Network/グローバル状態書き換えなし）
//   ・入力オブジェクトを一切変更しない（非破壊）
//   ・例外を外へ投げない（fail-open・安全な既定構造を返す）
//   ・shared/instagramAccountDesign.js 本体は一切変更しない（完全に別ファイルとして新設）
// ══════════════════════════════════════════════════════════════
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;                          // CommonJS（Node / 合成テスト）
  } else {
    root.InstagramAccountDesignQuality = api;       // ブラウザ（window / globalThis）
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var QUALITY_VERSION = '1.0.0';
  var ASSESSMENT_VERSION = '2.0.0'; // Phase IG-2F: 階層分離アセスメント（構造/内容/Evidence/Readiness/Approval）
  var REQUIRED_SCORE = 90;
  var QUALITY_STATUS_VALUES = ['complete', 'almost_ready', 'needs_work', 'insufficient'];
  var CATEGORY_IDS = [
    'marketResearch', 'competitorResearch', 'candidateComparison', 'adoptionDecision',
    'brand', 'target', 'account', 'monetizationAndExecution',
  ];
  var EVALUATION_AXES = [
    'marketPotential', 'profitability', 'instagramFit', 'competitionDifficulty',
    'differentiationPotential', 'noFaceNoVoiceFit', 'continuity', 'multiProductFit',
    'longTermBrandAsset', 'aiOperationFit',
  ];
  var MIN_CANDIDATES = 3;
  var FIELD_STATUS_VALUES = ['generated_hypothesis', 'evidence_supported', 'external_confirmation_required', 'user_confirmed'];

  // ── 小ヘルパー ───────────────────────────────────────────────
  function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }
  function isNonEmptyArray(v) { return Array.isArray(v) && v.length > 0; }

  function scoreCategory(results) {
    if (results.length === 0) return 100;
    var filled = 0;
    for (var i = 0; i < results.length; i++) { if (results[i].filled) filled++; }
    return Math.round((filled / results.length) * 100);
  }

  // ── カテゴリ別評価（narrative content presence のみをscoreへ算入） ──────
  function evalMarketResearch(iadp) {
    var results = [];
    var mr = (iadp.intelligence && iadp.intelligence.marketResearch) || {};
    var candidates = Array.isArray(mr.candidates) ? mr.candidates : [];
    results.push({ path: 'intelligence.marketResearch.candidates', filled: candidates.length >= MIN_CANDIDATES });
    var withMarketSize = candidates.filter(function (c) { return c && isNonEmptyString(c.marketSizeEstimate); }).length;
    results.push({ path: 'intelligence.marketResearch.candidates[].marketSizeEstimate', filled: candidates.length > 0 && withMarketSize === candidates.length });
    results.push({ path: 'intelligence.marketResearch.selectionCriteria', filled: isNonEmptyString(mr.selectionCriteria) });
    var withNotes = candidates.filter(function (c) { return c && isNonEmptyString(c.notes); }).length;
    results.push({ path: 'intelligence.marketResearch.candidates[].notes', filled: candidates.length > 0 && withNotes > 0 });
    return { score: scoreCategory(results), results: results };
  }

  function evalCompetitorResearch(iadp) {
    var results = [];
    var cr = (iadp.intelligence && iadp.intelligence.competitorResearch) || {};
    var byGenre = Array.isArray(cr.byGenre) ? cr.byGenre : [];
    results.push({ path: 'intelligence.competitorResearch.byGenre', filled: byGenre.length > 0 });
    var stringFields = ['competitionVolume', 'differentiationOpportunity'];
    var arrayFields = ['strongCompetitorCharacteristics', 'postFormats', 'appealPatterns', 'monetizationFunnels', 'reproducibleSuccessFactors'];
    stringFields.forEach(function (f) {
      var anyFilled = byGenre.some(function (g) { return g && isNonEmptyString(g[f]); });
      results.push({ path: 'intelligence.competitorResearch.byGenre[].' + f, filled: byGenre.length > 0 && anyFilled });
    });
    arrayFields.forEach(function (f) {
      var anyFilled = byGenre.some(function (g) { return g && isNonEmptyArray(g[f]); });
      results.push({ path: 'intelligence.competitorResearch.byGenre[].' + f, filled: byGenre.length > 0 && anyFilled });
    });
    return { score: scoreCategory(results), results: results };
  }

  function evalCandidateComparison(iadp) {
    var results = [];
    var cc = (iadp.intelligence && iadp.intelligence.candidateComparison) || {};
    var candidates = Array.isArray(cc.candidates) ? cc.candidates : [];
    results.push({ path: 'intelligence.candidateComparison.candidates', filled: candidates.length >= MIN_CANDIDATES });
    var allTotalScorePresent = candidates.length > 0 && candidates.every(function (c) { return c && typeof c.totalScore === 'number'; });
    results.push({ path: 'intelligence.candidateComparison.candidates[].totalScore', filled: allTotalScorePresent });

    // 構造完全性ゲート（scoreへは算入しない。complete判定専用の厳格フラグ）
    var structurallyComplete = candidates.length > 0 && candidates.every(function (c) {
      if (!c || !isPlainObject(c.scores)) return false;
      return EVALUATION_AXES.every(function (axis) { return typeof c.scores[axis] === 'number' && c.scores[axis] >= 0 && c.scores[axis] <= 100; });
    });
    var meaningfullyScored = candidates.length > 0 && candidates.every(function (c) {
      return c && isPlainObject(c.scores) && EVALUATION_AXES.some(function (axis) { return c.scores[axis] > 0; });
    });
    var hasAdopt = candidates.some(function (c) { return c && c.decision === 'adopt'; });
    var hasNonAdopt = candidates.some(function (c) { return c && c.decision !== 'adopt'; });

    return {
      score: scoreCategory(results), results: results,
      axesComplete: structurallyComplete && meaningfullyScored,
      decisionDistinguishable: hasAdopt && hasNonAdopt,
      candidateCount: candidates.length,
    };
  }

  function evalAdoptionDecision(iadp) {
    var results = [];
    var ad = (iadp.intelligence && iadp.intelligence.adoptionDecision) || {};
    var cc = (iadp.intelligence && iadp.intelligence.candidateComparison) || {};
    var candidates = Array.isArray(cc.candidates) ? cc.candidates : [];
    var adoptedId = ad.adoptedCandidateId;
    var matchedCandidate = null;
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] && candidates[i].candidateId === adoptedId) { matchedCandidate = candidates[i]; break; }
    }

    results.push({ path: 'intelligence.adoptionDecision.adoptedCandidateId', filled: isNonEmptyString(adoptedId) });
    results.push({ path: 'intelligence.adoptionDecision.decisionRationale', filled: isNonEmptyString(ad.decisionRationale) });
    results.push({ path: 'intelligence.candidateComparison.candidates[].mainRisks(adopted)', filled: !!(matchedCandidate && isNonEmptyArray(matchedCandidate.mainRisks)) });
    var hasHoldOrReject = isNonEmptyArray(ad.rejectedCandidates) || isNonEmptyArray(ad.heldCandidates);
    results.push({ path: 'intelligence.adoptionDecision.rejectedCandidates/heldCandidates', filled: hasHoldOrReject });

    // 構造完全性ゲート（scoreへは算入しない）
    var adoptionValid = isNonEmptyString(adoptedId) && !!matchedCandidate && ad.decisionMadeBy === 'leader';

    return { score: scoreCategory(results), results: results, adoptionValid: adoptionValid };
  }

  function evalBrand(iadp) {
    var results = [];
    var b = (iadp.finalProfile && iadp.finalProfile.brand) || {};
    ['brandName', 'brandConcept', 'worldview', 'differentiation', 'brandTone', 'colorPolicy'].forEach(function (f) {
      results.push({ path: 'finalProfile.brand.' + f, filled: isNonEmptyString(b[f]) });
    });
    return { score: scoreCategory(results), results: results };
  }

  function evalTarget(iadp) {
    var results = [];
    var t = (iadp.finalProfile && iadp.finalProfile.target) || {};
    results.push({ path: 'finalProfile.target.persona', filled: isNonEmptyString(t.persona) });
    results.push({ path: 'finalProfile.target.ageRange', filled: isNonEmptyString(t.ageRange) });
    ['mainPainPoints', 'desires', 'purchaseMotivations', 'trustBarriers'].forEach(function (f) {
      results.push({ path: 'finalProfile.target.' + f, filled: isNonEmptyArray(t[f]) });
    });
    return { score: scoreCategory(results), results: results };
  }

  function evalAccount(iadp) {
    var results = [];
    var a = (iadp.finalProfile && iadp.finalProfile.account) || {};
    ['accountName', 'bio', 'iconPolicy', 'iconPrompt', 'profileLinkPolicy'].forEach(function (f) {
      results.push({ path: 'finalProfile.account.' + f, filled: isNonEmptyString(a[f]) });
    });
    results.push({ path: 'finalProfile.account.usernameCandidates', filled: isNonEmptyArray(a.usernameCandidates) });
    results.push({ path: 'finalProfile.account.highlightPolicy', filled: isNonEmptyArray(a.highlightPolicy) });
    return { score: scoreCategory(results), results: results };
  }

  function evalMonetizationAndExecution(iadp) {
    var results = [];
    var m = (iadp.finalProfile && iadp.finalProfile.monetization) || {};
    var ex = (iadp.finalProfile && iadp.finalProfile.execution) || {};
    ['aspCandidates', 'productGenres'].forEach(function (f) {
      results.push({ path: 'finalProfile.monetization.' + f, filled: isNonEmptyArray(m[f]) });
    });
    ['productSelectionPolicy', 'ctaPolicy', 'funnelPolicy'].forEach(function (f) {
      results.push({ path: 'finalProfile.monetization.' + f, filled: isNonEmptyString(m[f]) });
    });
    results.push({ path: 'finalProfile.monetization.prohibitedSalesApproach', filled: isNonEmptyArray(m.prohibitedSalesApproach) });
    ['accountCreationChecklist', 'aspRegistrationChecklist', 'requiredExternalChecks'].forEach(function (f) {
      results.push({ path: 'finalProfile.execution.' + f, filled: isNonEmptyArray(ex[f]) });
    });
    results.push({ path: 'finalProfile.execution.first30DaysOperatingPolicy', filled: isNonEmptyString(ex.first30DaysOperatingPolicy) });
    return { score: scoreCategory(results), results: results };
  }

  // ── Evidence状態集計（fieldStatusから。generated_hypothesis/external_confirmation_required
  //    が存在するだけで失敗にしない・user_confirmedとevidence_supportedは統合しない） ──────
  function summarizeFieldStatus(fieldStatus) {
    var fs = isPlainObject(fieldStatus) ? fieldStatus : {};
    var hypothesisItems = [];
    var evidenceSupportedItems = [];
    var externalConfirmationItems = [];
    var userConfirmedItems = [];
    var keys = Object.keys(fs);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var v = fs[k];
      if (v === 'generated_hypothesis') hypothesisItems.push(k);
      else if (v === 'evidence_supported') evidenceSupportedItems.push(k);
      else if (v === 'external_confirmation_required') externalConfirmationItems.push(k);
      else if (v === 'user_confirmed') userConfirmedItems.push(k);
    }
    return {
      hypothesisItems: hypothesisItems, evidenceSupportedItems: evidenceSupportedItems,
      externalConfirmationItems: externalConfirmationItems, userConfirmedItems: userConfirmedItems,
      counts: {
        generated_hypothesis: hypothesisItems.length, evidence_supported: evidenceSupportedItems.length,
        external_confirmation_required: externalConfirmationItems.length, user_confirmed: userConfirmedItems.length,
      },
    };
  }

  function determineStatus(score, missingCount, candidateCount, axesComplete, adoptionValid, decisionDistinguishable, accountCreationFieldsFilled) {
    if (score < 60 || candidateCount < MIN_CANDIDATES || !adoptionValid) return 'insufficient';
    if (score >= 95 && missingCount === 0 && candidateCount >= MIN_CANDIDATES && axesComplete && adoptionValid && decisionDistinguishable && accountCreationFieldsFilled) return 'complete';
    if (score >= REQUIRED_SCORE && missingCount === 0) return 'almost_ready';
    if (score >= 60) return 'needs_work';
    return 'insufficient'; // 防御的フォールバック（到達しない想定）
  }

  function blankResult(executed) {
    return {
      version: QUALITY_VERSION, executed: !!executed, passed: false, status: 'insufficient',
      score: 0, requiredScore: REQUIRED_SCORE, categoryScores: {}, missingRequiredFields: [],
      warnings: [], externalConfirmationItems: [], hypothesisItems: [], evidenceSupportedItems: [],
      userConfirmedItems: [],
      evidenceCounts: { generated_hypothesis: 0, evidence_supported: 0, external_confirmation_required: 0, user_confirmed: 0 },
      readyForAccountCreation: false,
    };
  }

  // ── 公開API：IADP品質評価（validateAccountDesignPackage()とは別レイヤー） ─────
  function evaluateInstagramAccountDesignQuality(iadp) {
    try {
      if (!isPlainObject(iadp)) return blankResult(false);

      var market       = evalMarketResearch(iadp);
      var competitor    = evalCompetitorResearch(iadp);
      var comparison    = evalCandidateComparison(iadp);
      var adoption      = evalAdoptionDecision(iadp);
      var brand         = evalBrand(iadp);
      var target        = evalTarget(iadp);
      var account       = evalAccount(iadp);
      var monetization  = evalMonetizationAndExecution(iadp);

      var categoryScores = {
        marketResearch: market.score, competitorResearch: competitor.score,
        candidateComparison: comparison.score, adoptionDecision: adoption.score,
        brand: brand.score, target: target.score, account: account.score,
        monetizationAndExecution: monetization.score,
      };

      var allResults = [].concat(market.results, competitor.results, comparison.results, adoption.results, brand.results, target.results, account.results, monetization.results);
      var missingRequiredFields = allResults.filter(function (r) { return !r.filled; }).map(function (r) { return r.path; });

      var scoreSum = 0;
      for (var i = 0; i < CATEGORY_IDS.length; i++) scoreSum += categoryScores[CATEGORY_IDS[i]];
      var score = Math.round(scoreSum / CATEGORY_IDS.length);

      var accountCreationFieldsFilled = (brand.score === 100 && target.score === 100 && account.score === 100 && monetization.score === 100);

      var status = determineStatus(
        score, missingRequiredFields.length, comparison.candidateCount,
        comparison.axesComplete, adoption.adoptionValid, comparison.decisionDistinguishable, accountCreationFieldsFilled
      );
      var readyForAccountCreation = (status === 'complete' || status === 'almost_ready');

      var evidence = summarizeFieldStatus(iadp.fieldStatus);

      var warnings = [];
      if (evidence.externalConfirmationItems.length > 0) {
        warnings.push({ code: 'external_confirmation_pending', message: evidence.externalConfirmationItems.length + '件の項目が外部確認待ちです（ASP登録・審査等）。次の外部作業に限定されるため設計自体の完成は妨げません。' });
      }
      if (missingRequiredFields.length > 0 && missingRequiredFields.length <= 3) {
        warnings.push({ code: 'minor_gaps', message: '軽微な必須項目の欠損が' + missingRequiredFields.length + '件あります。' });
      }
      if (status !== 'complete' && missingRequiredFields.length === 0) {
        warnings.push({ code: 'structural_polish_needed', message: '必須項目はすべて埋まっていますが、3案比較の一貫性（10軸完全性・採否の明確な区別）が完全ではありません。' });
      }

      return {
        version: QUALITY_VERSION, executed: true, passed: readyForAccountCreation, status: status,
        score: score, requiredScore: REQUIRED_SCORE, categoryScores: categoryScores,
        missingRequiredFields: missingRequiredFields, warnings: warnings,
        externalConfirmationItems: evidence.externalConfirmationItems, hypothesisItems: evidence.hypothesisItems,
        evidenceSupportedItems: evidence.evidenceSupportedItems, userConfirmedItems: evidence.userConfirmedItems,
        evidenceCounts: evidence.counts, readyForAccountCreation: readyForAccountCreation,
      };
    } catch (e) {
      return blankResult(false); // fail-open
    }
  }

  // ══════════════════════════════════════════════════════════════
  // Phase IG-2F: 階層分離アセスメント（既存 evaluateInstagramAccountDesignQuality は無変更・後方互換）
  //
  //   目的: 「JSONのフィールドが埋まっている（構造充足）」ことと、「依頼を満たす実質的な
  //   成果物として完成している（内容品質）」「根拠が揃っている（Evidence）」「実際にアカウント
  //   作成へ進める（Readiness）」「ユーザーが承認した（Approval）」を、それぞれ別軸として分離判定する。
  //
  //   既存 evaluateInstagramAccountDesignQuality() を内部で再利用（フィールド充足度・Evidence件数）し、
  //   そこへ生成時コンテキスト（担当実行状況・Leader統合回答本文の有無）を「あれば」加味する。
  //   コンテキストが無い（旧保存IADPのF5復元など）場合は not_evaluated として安全側に扱い、
  //   自動的にComplete/Readyへ補正しない。純粋関数・非破壊・例外を投げない（fail-open）。
  //
  //   context（すべて任意・欠けていても安全に動作）:
  //     { structureValid: bool,                       // validateAccountDesignPackage().valid
  //       leaderFinal: { present: bool, integratedCount: number|null } | null,
  //       memberSummary: { requiredTotal, requiredCompleted, requiredWeak, weakMembers:[label] } | null,
  //       userApproval: 'approved'|'pending'|'rejected'|'not_evaluated' }
  // ══════════════════════════════════════════════════════════════
  var RESEARCH_CATEGORY_IDS = ['marketResearch', 'competitorResearch', 'candidateComparison', 'adoptionDecision'];
  var CATEGORY_LABELS_JA = {
    marketResearch: '市場調査', competitorResearch: '競合調査', candidateComparison: '3案比較',
    adoptionDecision: '採用判定', brand: 'ブランド', target: 'ターゲット', account: 'アカウント',
    monetizationAndExecution: '収益・実行',
  };

  function assessInstagramAccountDesignPackage(iadp, context) {
    var base = evaluateInstagramAccountDesignQuality(iadp);   // 既存Core再利用（fail-open済み）
    try {
      var ctx = isPlainObject(context) ? context : {};
      var ec = base.evidenceCounts || {};
      var sup = ec.evidence_supported || 0;
      var usr = ec.user_confirmed || 0;
      var hyp = ec.generated_hypothesis || 0;
      var ext = ec.external_confirmation_required || 0;

      // ── Structure Validation ──
      var structureValid = ctx.structureValid === true;
      var structureValidation = structureValid ? 'passed' : 'failed';

      // ── Evidence Status（検証済み＝evidence_supported＋user_confirmed。仮説のみ／0件はinsufficient） ──
      var verified = sup + usr;
      var evidenceStatus;
      if (verified === 0) evidenceStatus = 'insufficient';
      else if (verified >= 3) evidenceStatus = 'sufficient';   // 既存Confidence設計の「独立3件」に整合
      else evidenceStatus = 'partial';

      // ── 生成時コンテキスト（担当実行状況・Leader統合回答）──
      var ms = isPlainObject(ctx.memberSummary) ? ctx.memberSummary : null;
      var lf = isPlainObject(ctx.leaderFinal) ? ctx.leaderFinal : null;
      var genAvailable = !!(ms || lf);
      var membersWeak = ms ? (ms.requiredWeak || 0) : 0;
      var weakMembers = (ms && Array.isArray(ms.weakMembers)) ? ms.weakMembers.slice() : [];
      // leaderOk: true=本文あり且つ統合件数>0 / false=空 or 統合0 / null=不明（旧データ）
      var leaderOk = lf ? (lf.present === true && (lf.integratedCount == null || lf.integratedCount > 0)) : null;
      var leaderBad = (lf && leaderOk === false);
      var membersBad = (ms && membersWeak > 0);

      // ── Content Quality（構造充足だけではCompleteにしない） ──
      var contentQuality;
      if (!structureValid) {
        contentQuality = 'failed';
      } else if (!genAvailable) {
        contentQuality = (base.status === 'insufficient') ? 'insufficient' : 'not_evaluated'; // 旧データは安全側
      } else {
        var cq = (base.status === 'complete') ? 'complete'
               : (base.status === 'almost_ready') ? 'needs_work'
               : base.status; // needs_work / insufficient
        if (evidenceStatus === 'insufficient' && (leaderBad || membersBad)) cq = 'insufficient';
        else if (cq === 'complete' && (evidenceStatus === 'insufficient' || leaderBad || membersBad)) cq = 'needs_work';
        contentQuality = cq;
      }

      // ── User Approval（承認機構は未実装＝既定pending。承認前に採用済みと表示しない） ──
      var userApproval = (typeof ctx.userApproval === 'string' && ctx.userApproval) ? ctx.userApproval : 'pending';

      // ── Account Creation Readiness（内容Complete＋構造Passed＋Evidence非insufficientでも承認前はconditional） ──
      var accountCreationReadiness;
      if (contentQuality === 'complete' && structureValid && evidenceStatus !== 'insufficient') {
        accountCreationReadiness = (userApproval === 'approved') ? 'ready' : 'conditional';
      } else {
        accountCreationReadiness = 'not_ready';
      }

      // ── Overall（総合判定） ──
      var overall;
      if (!structureValid) overall = 'insufficient';
      else if (contentQuality === 'complete' && evidenceStatus === 'sufficient') overall = 'complete';
      else if (contentQuality === 'insufficient' || contentQuality === 'failed') overall = 'insufficient';
      else overall = 'needs_work'; // not_evaluated（旧データ）も安全側でneeds_work＝自動Completeにしない

      // ── Category Breakdown（構造充足 / Evidence信頼度 / 内容品質を分離） ──
      var cs = base.categoryScores || {};
      var categoryBreakdown = CATEGORY_IDS.map(function (cid) {
        var fc = typeof cs[cid] === 'number' ? cs[cid] : 0;
        var isResearch = RESEARCH_CATEGORY_IDS.indexOf(cid) !== -1;
        var evidenceConfidence = isResearch ? evidenceStatus : 'not_required';
        var catContent;
        if (fc < 60) catContent = 'insufficient';
        else if (isResearch && evidenceStatus === 'insufficient') catContent = 'insufficient';
        else if (fc >= 95) catContent = 'complete';
        else catContent = 'needs_work';
        return {
          id: cid, label: CATEGORY_LABELS_JA[cid] || cid,
          fieldCompleteness: fc, evidenceConfidence: evidenceConfidence, contentQuality: catContent,
        };
      });

      // ── 主な不足・次に必要な対応（日本語・文字で状態を伝える） ──
      var missing = [];
      if (!structureValid) missing.push('構造検証に失敗（必須キー・型の欠損）');
      if (leaderBad) missing.push('Leader統合回答本文が空（担当成果の統合なし）');
      if (membersBad) missing.push('担当成果物が不足' + (weakMembers.length ? '（' + weakMembers.join('・') + '）' : ''));
      if (evidenceStatus === 'insufficient') missing.push('市場・競合Evidenceなし（全' + hyp + '項目がAI仮説）');
      else if (evidenceStatus === 'partial') missing.push('Evidence不足（検証済み' + verified + '件のみ）');
      if (!genAvailable) missing.push('生成時の担当実行状況が保存されていないため内容品質は再評価不可（legacy）');
      var baseMissing = Array.isArray(base.missingRequiredFields) ? base.missingRequiredFields : [];
      if (baseMissing.length > 0) missing.push('必須項目欠損 ' + baseMissing.length + '件');
      if (ext > 0) missing.push('外部確認待ち ' + ext + '件（ASP登録・審査等）');

      var nextActions = [];
      if (membersBad || leaderBad) nextActions.push('不足している担当分析（' + (weakMembers.length ? weakMembers.join('・') : '担当') + '）を再実行してください');
      if (evidenceStatus === 'insufficient') nextActions.push('実データ・一次情報でEvidenceを補強してください');
      else if (evidenceStatus === 'partial') nextActions.push('残りの根拠を追加し検証済みEvidenceを増やしてください');
      if (contentQuality === 'complete' && evidenceStatus !== 'insufficient' && userApproval === 'pending') {
        nextActions.push('内容を確認のうえユーザー承認へ進んでください');
      }
      if (nextActions.length === 0) nextActions.push('不足項目を補完後、再評価してください');

      return {
        version: ASSESSMENT_VERSION, executed: true, legacy: !genAvailable,
        overall: overall,
        structureValidation: structureValidation,
        contentQuality: contentQuality,
        evidenceStatus: evidenceStatus,
        accountCreationReadiness: accountCreationReadiness,
        userApproval: userApproval,
        score: base.score, requiredScore: REQUIRED_SCORE,
        evidenceCounts: base.evidenceCounts,
        verifiedEvidenceCount: verified,
        hypothesisCount: hyp,
        externalConfirmationCount: ext,
        criticalGapCount: (leaderBad ? 1 : 0) + (membersBad ? membersWeak : 0) + (evidenceStatus === 'insufficient' ? 1 : 0) + (structureValid ? 0 : 1),
        categoryBreakdown: categoryBreakdown,
        missing: missing,
        nextActions: nextActions,
        leaderFinalEvaluated: !!lf, memberExecutionEvaluated: !!ms,
        adoptedNote: null,
      };
    } catch (e) {
      return {
        version: ASSESSMENT_VERSION, executed: false, legacy: true,
        overall: 'insufficient', structureValidation: (context && context.structureValid) ? 'passed' : 'failed',
        contentQuality: 'not_evaluated', evidenceStatus: 'insufficient',
        accountCreationReadiness: 'not_ready', userApproval: 'pending',
        score: base.score || 0, requiredScore: REQUIRED_SCORE,
        evidenceCounts: base.evidenceCounts || {}, verifiedEvidenceCount: 0, hypothesisCount: 0, externalConfirmationCount: 0,
        criticalGapCount: 0, categoryBreakdown: [], missing: ['評価中に例外が発生しました'], nextActions: ['再評価してください'],
        leaderFinalEvaluated: false, memberExecutionEvaluated: false, adoptedNote: null,
      };
    }
  }

  return {
    version: QUALITY_VERSION,
    assessmentVersion: ASSESSMENT_VERSION,
    QUALITY_STATUS_VALUES: QUALITY_STATUS_VALUES.slice(),
    CATEGORY_IDS: CATEGORY_IDS.slice(),
    RESEARCH_CATEGORY_IDS: RESEARCH_CATEGORY_IDS.slice(),
    FIELD_STATUS_VALUES: FIELD_STATUS_VALUES.slice(),
    REQUIRED_SCORE: REQUIRED_SCORE,
    evaluateInstagramAccountDesignQuality: evaluateInstagramAccountDesignQuality,
    assessInstagramAccountDesignPackage: assessInstagramAccountDesignPackage,
  };
});
