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
  //       userApproval: 'approved'|'pending'|'rejected'|'not_evaluated',
  //       // Phase IG-2H: 既存の会社判定を再利用する任意入力（新しい独立判定基盤は作らない）
  //       reviewerAssessment: { available, status:'passed'|'needs_work'|'failed'|'not_available',
  //                             criticalIssueCount, requiresRework } | null,
  //       strategyAssessment: { available, status:'accepted'|'needs_revision'|'insufficient'|'not_available',
  //                             requiresRework } | null,
  //       qualityGate: { executed, passed, status:'passed'|'failed', sourceStatus } | null }
  //
  //   Phase IG-2H の判定原則:
  //     ・Reviewer failed / Strategy needs_revision・insufficient / Quality Gate failed の場合、
  //       Content Quality を complete にしない（＝Ready へも到達しない）。
  //     ・未取得（not_available・executed:false）は勝手にPassed扱いせず not_available として扱い、
  //       Complete（＝Ready）にも到達させない（安全側）。ただし needs_work 相当に留め failed とは区別する。
  // ══════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════
  // Phase IG-2J-C: 確認事項の正式分類（AI Action Required / User Input Required）
  //
  // 目的:
  //   ユーザーへ「質問」として提示する項目を1か所へ集約するため、確認事項を
  //   ①AI会社自身で処理できるもの（aiActions）②AI会社では決定できないもの（userInputs）
  //   ③判定できないもの（unclassified）へ決定論的に分類する。
  //
  // 設計制約:
  //   ・既存 missing / nextActions は削除・変更しない（本分類は追加情報）。
  //   ・分類は自然言語推論ではなく reason code ＋ キーワード表による決定論的判定のみ。
  //   ・不明なものを勝手に userInputs へ上げない（安全側で unclassified）。
  //   ・AI会社自身で仮説生成・比較できる項目（ターゲット/ジャンル/投稿頻度/KPI等）は
  //     たとえ「教えてください」という文面で来ても userInputs にしない（質問禁止項目）。
  // ══════════════════════════════════════════════════════════════

  // 外部確認待ち（ASP登録・審査後でなければ確定できない実数値）
  var AI_EXTERNAL_CONFIRMATION_KEYWORDS = [
    'ASP審査', '審査結果', '審査状況', '登録後', '提携', '実報酬', '報酬額', 'EPC', '承認率',
    '実案件数', '外部確認', '実測値', '実データ取得'
  ];
  // ユーザー固有制約（AI会社が代わりに決めてはいけない本人事情）
  var AI_USER_CONSTRAINT_KEYWORDS = [
    '顔出し', '実名', '匿名', '予算', '工数', '既存アカウント', '既存のアカウント',
    '扱いたくない', '扱わない', '避けたいジャンル', '商標', '社名', '屋号', 'リスク許容'
  ];
  // 最終承認
  var AI_FINAL_APPROVAL_KEYWORDS = ['最終承認', 'ユーザー承認', '承認へ進'];
  // AI会社側の実行アクション動詞（これが含まれる場合はユーザー質問にしない）
  var AI_ACTION_VERB_KEYWORDS = [
    '再実行', '再評価', '再設計', '再生成', '再取得', '再計算', '再比較', '補完', '補強', '見直し', '追加取得'
  ];
  // AI会社自身で仮説生成・比較できる項目（質問禁止項目）
  var AI_DECIDABLE_TOPIC_KEYWORDS = [
    'ターゲット', 'ジャンル', '商品カテゴリ', '商材カテゴリ', '投稿頻度', '投稿形式',
    'コンテンツピラー', 'KPI', 'ブランド方向', 'ブランド', '競合', '差別化', '投稿テーマ',
    'CTA', 'Evidence', '市場', 'ペルソナ', '収益導線'
  ];

  function containsAny(text, list) {
    var t = String(text || '');
    for (var i = 0; i < list.length; i++) { if (t.indexOf(list[i]) !== -1) return true; }
    return false;
  }

  // 重複除去用の正規化（空白・記号・敬体語尾を落として比較する。過度な推論はしない）
  function normalizeActionText(text) {
    return String(text || '')
      .replace(/[\s　]/g, '')
      .replace(/[。、．，,.\-―・（）()「」【】]/g, '')
      .replace(/(してください|して下さい|をお願いします|ください|下さい|です|ます)$/g, '')
      .toLowerCase();
  }

  // 公開API: 1件の確認事項テキストを分類する（純粋関数）。
  //   判定順序（仕様どおり）:
  //     ①明確な外部確認待ち ②ユーザー固有制約 ③最終承認 ④AI再実行可能 ⑤不明
  //   ただし②の前に「AI実行動詞を含む場合はAI側」を優先する。
  //   例:「顔出しなし前提で投稿形式を再設計」はユーザーへの質問ではなくAI作業であるため。
  function classifyActionItem(text) {
    var t = String(text || '').trim();
    if (!t) return { category: 'unclassified', target: 'ai' };
    if (containsAny(t, AI_EXTERNAL_CONFIRMATION_KEYWORDS)) return { category: 'external_confirmation', target: 'user' };
    if (containsAny(t, AI_ACTION_VERB_KEYWORDS)) return { category: 'ai_rerun', target: 'ai' };
    if (containsAny(t, AI_USER_CONSTRAINT_KEYWORDS)) return { category: 'user_constraint', target: 'user' };
    if (containsAny(t, AI_FINAL_APPROVAL_KEYWORDS)) return { category: 'final_approval', target: 'user' };
    if (containsAny(t, AI_DECIDABLE_TOPIC_KEYWORDS)) return { category: 'ai_decidable', target: 'ai' };
    return { category: 'unclassified', target: 'unclassified' };   // 安全側：ユーザー質問へ昇格させない
  }

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

      // ── Phase IG-2H: Reviewer / Strategy / Quality Gate（既存判定の再利用・欠損は not_available） ──
      var rvIn = isPlainObject(ctx.reviewerAssessment) ? ctx.reviewerAssessment : null;
      var stIn = isPlainObject(ctx.strategyAssessment) ? ctx.strategyAssessment : null;
      var qgIn = isPlainObject(ctx.qualityGate) ? ctx.qualityGate : null;

      var reviewerStatus = (rvIn && rvIn.available === true && typeof rvIn.status === 'string' && rvIn.status !== 'not_available')
        ? rvIn.status : 'not_available';
      var reviewerCriticalCount = (rvIn && typeof rvIn.criticalIssueCount === 'number' && isFinite(rvIn.criticalIssueCount))
        ? rvIn.criticalIssueCount : 0;
      var reviewerRequiresRework = !!(rvIn && rvIn.requiresRework === true);
      var reviewerBad = (reviewerStatus === 'failed');                          // 重大不足＝Complete禁止
      var reviewerWarn = (reviewerStatus === 'needs_work' || reviewerRequiresRework);

      var strategyStatus = (stIn && stIn.available === true && typeof stIn.status === 'string' && stIn.status !== 'not_available')
        ? stIn.status : 'not_available';
      var strategyRequiresRework = !!(stIn && stIn.requiresRework === true);
      var strategyBad = (strategyStatus === 'needs_revision' || strategyStatus === 'insufficient'); // 再設計要求＝Complete禁止
      var strategyWarn = strategyRequiresRework;

      // ── Phase IG-2J-D: 採用案 Single Source of Truth の整合状態 ──
      //   正本解決は shared/instagramAccountDesign.js の resolveAdoptedCandidate() が行い、
      //   本Coreはその結果を context.adoptionResolution として受け取るだけ（依存を持たない・再判定しない）。
      //   欠損時は 'not_evaluated' とし、Passed扱いにもBlock扱いにもしない（既存挙動を変えない）。
      var adIn = isPlainObject(ctx.adoptionResolution) ? ctx.adoptionResolution : null;
      var adoptionConsistency = (adIn && typeof adIn.consistency === 'string') ? adIn.consistency : 'not_evaluated';
      var adoptedCandidateId = (adIn && adIn.adoptedCandidateId) ? adIn.adoptedCandidateId : null;
      var adoptedLabel = (adIn && typeof adIn.adoptedLabel === 'string') ? adIn.adoptedLabel : '';
      var adoptionIssues = (adIn && Array.isArray(adIn.issues)) ? adIn.issues.slice() : [];
      var selectionVsRanking = (adIn && adIn.selectionVsRanking) ? adIn.selectionVsRanking : null;
      var finalProfileConsistency = (adIn && typeof adIn.finalProfileConsistency === 'string') ? adIn.finalProfileConsistency : 'unknown';
      // Complete/Readyを止めるのは「正本を特定できない」「正本フィールドが欠損」
      // 「Final Profileが正式採用案と不一致（Profile全体が別候補向けの可能性）」の3ケース。
      // 比較表decisionのみの不整合（repairable）は決定論的に整合表示できるためBlockしない。
      var adoptionUnresolved = (adoptionConsistency === 'unresolved');
      var adoptionOfficialIdMissing = !!(adIn && adIn.officialIdMissing === true);
      var finalProfileMismatch = (finalProfileConsistency === 'mismatch');
      var adoptionBlocksComplete = adoptionUnresolved || adoptionOfficialIdMissing || finalProfileMismatch;

      // Quality Gate: executed:false / 欠損は 'not_executed'（Passed扱いにしない）
      var qgExecuted = !!(qgIn && qgIn.executed === true);
      var qgPassed = !!(qgExecuted && qgIn.passed === true);
      var qualityGateStatus = qgExecuted ? (qgPassed ? 'passed' : 'failed') : 'not_executed';
      var qgSourceStatus = (qgIn && typeof qgIn.sourceStatus === 'string') ? qgIn.sourceStatus : null;
      var qgBad = (qualityGateStatus === 'failed');                            // Gate未通過＝Complete禁止

      // 未取得（not_available / not_executed）は Passed 扱いにしない＝Complete へ到達させない（安全側・failedとは区別）
      var signalsUnavailable = (reviewerStatus === 'not_available') || (strategyStatus === 'not_available') || (qualityGateStatus === 'not_executed');
      var signalsBlockComplete = reviewerBad || strategyBad || qgBad || signalsUnavailable || reviewerWarn || strategyWarn;

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
        // Phase IG-2H: Reviewer重大不足／Strategy再設計要求／Quality Gate Failed は insufficient まで落とす。
        //   未取得（not_available）のみの場合は needs_work に留める（failed と区別・自動Passedにはしない）。
        if (reviewerBad || strategyBad || qgBad) cq = 'insufficient';
        else if (cq === 'complete' && signalsBlockComplete) cq = 'needs_work';
        // Phase IG-2J-D: 正式採用案が特定できない／Final Profileが正式採用案と不一致の場合は
        //   「どの案の設計なのか」が確定していないためCompleteにしない（安全側・自動修正はしない）。
        if (cq === 'complete' && adoptionBlocksComplete) cq = 'needs_work';
        contentQuality = cq;
      }

      // ── User Approval（承認機構は未実装＝既定pending。承認前に採用済みと表示しない） ──
      var userApproval = (typeof ctx.userApproval === 'string' && ctx.userApproval) ? ctx.userApproval : 'pending';

      // ── Account Creation Readiness ──
      //   Phase IG-2H: Reviewer failed／Strategy needs_revision・insufficient／Quality Gate failed の場合は
      //   ユーザー承認済みでも必ず not_ready（承認だけで品質不足を上書きしない）。
      //   contentQuality==='complete' は上記の各ゲートを通過済みであることを既に含意する。
      //   Phase IG-2J-D: 正式採用案が未確定・Final Profile不一致の場合も必ず not_ready。
      var accountCreationReadiness;
      if (contentQuality === 'complete' && structureValid && evidenceStatus !== 'insufficient'
          && !reviewerBad && !strategyBad && !qgBad && !adoptionBlocksComplete) {
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
      // Phase IG-2H: Reviewer／Strategy／Quality Gate の結果を主な不足へ反映
      if (reviewerBad) missing.push('Reviewerが重大不足を検出' + (reviewerCriticalCount > 0 ? '（' + reviewerCriticalCount + '件）' : ''));
      else if (reviewerStatus === 'needs_work') missing.push('Reviewerが要改善と判定');
      else if (reviewerStatus === 'not_available') missing.push('Reviewer未評価（判定材料なし）');
      if (strategyStatus === 'needs_revision') missing.push('Strategyが再設計・再実行を要求');
      else if (strategyStatus === 'insufficient') missing.push('Strategyが情報不足と判定');
      else if (strategyStatus === 'not_available') missing.push('Strategy未評価（判定材料なし）');
      if (qgBad) missing.push('Quality Gate未通過' + (qgSourceStatus ? '（' + qgSourceStatus + '）' : ''));
      else if (qualityGateStatus === 'not_executed') missing.push('Quality Gate未実行');
      // Phase IG-2J-D: 採用案の整合状態（総合点1位でないこと自体は問題として出さない）
      if (adoptionUnresolved) missing.push('正式採用案を特定できない（採用IDが欠損または候補表に不在）');
      else if (adoptionOfficialIdMissing) missing.push('正式な採用判断（adoptedCandidateId）が未記録');
      else if (finalProfileMismatch) missing.push('Final Profileが正式採用案「' + (adoptedLabel || '—') + '」と不一致');
      if (!adoptionUnresolved && adIn && adIn.comparisonRepairNeeded) missing.push('3案比較の採用表示が正式採用案と不一致');
      var baseMissing = Array.isArray(base.missingRequiredFields) ? base.missingRequiredFields : [];
      if (baseMissing.length > 0) missing.push('必須項目欠損 ' + baseMissing.length + '件');
      if (ext > 0) missing.push('外部確認待ち ' + ext + '件（ASP登録・審査等）');

      var nextActions = [];
      if (membersBad || leaderBad) nextActions.push('不足している担当分析（' + (weakMembers.length ? weakMembers.join('・') : '担当') + '）を再実行してください');
      if (evidenceStatus === 'insufficient') nextActions.push('実データ・一次情報でEvidenceを補強してください');
      else if (evidenceStatus === 'partial') nextActions.push('残りの根拠を追加し検証済みEvidenceを増やしてください');
      // Phase IG-2H: 3判定に応じた次の対応（既存判定の再実行を促す・新しい判定基盤は作らない）
      if (reviewerBad || reviewerStatus === 'needs_work') nextActions.push('不足成果物を再生成し、Reviewer再評価を実施してください');
      if (strategyBad) nextActions.push('Strategyの指摘に沿って設計を見直し、再評価を実施してください');
      if (qgBad) nextActions.push('成果物を補完のうえQuality Gateを再実行してください');
      if (signalsUnavailable && !reviewerBad && !strategyBad && !qgBad) {
        nextActions.push('Auto Taskを再実行し、Reviewer・Strategy・Quality Gateの判定を取得してください');
      }
      if (contentQuality === 'complete' && evidenceStatus !== 'insufficient' && userApproval === 'pending') {
        nextActions.push('内容を確認のうえユーザー承認へ進んでください');
      }
      if (nextActions.length === 0) nextActions.push('不足項目を補完後、再評価してください');

      // ── Phase IG-2J-C: 確認事項の正式分類（既存 missing / nextActions は無変更・追加のみ） ──
      //   reason code で生成するため、同一原因は構造的に1件しか出ない（＝重複除去が保証される）。
      var aiActions = [], userInputs = [], unclassified = [];
      var seenCodes = {}, seenNorm = {};
      function addItem(bucket, code, category, text, agent) {
        if (!text) return;
        if (seenCodes[code]) return;                       // 同一reason codeは1件のみ
        var norm = normalizeActionText(text);
        if (norm && seenNorm[norm]) return;                // 文面が実質同一のものも1件のみ
        seenCodes[code] = true; if (norm) seenNorm[norm] = true;
        bucket.push({ code: code, category: category, agent: agent || null, text: text });
      }

      // AI Action Required（AI会社自身で処理できる＝ユーザーへ質問しない）
      if (!structureValid) addItem(aiActions, 'ai.structure_fix', 'ai_rerun', 'IADP構造を修正して再生成する', 'leader');
      if (membersBad || leaderBad) {
        addItem(aiActions, 'ai.members_rerun', 'ai_rerun',
          '不足している担当分析（' + (weakMembers.length ? weakMembers.join('・') : '担当') + '）を再実行して成果物を補完する',
          weakMembers.length ? weakMembers.join(',') : null);
      }
      if (evidenceStatus === 'insufficient') addItem(aiActions, 'ai.evidence_acquire', 'ai_rerun', '市場・競合のEvidenceを再取得して補強する', 'researcher');
      else if (evidenceStatus === 'partial') addItem(aiActions, 'ai.evidence_reinforce', 'ai_rerun', '検証済みEvidenceを追加取得して補強する', 'researcher');
      if (reviewerBad || reviewerStatus === 'needs_work') addItem(aiActions, 'ai.reviewer_rework', 'ai_rerun', 'Reviewerの指摘箇所を修正し、Reviewer再評価を行う', 'reviewer');
      if (strategyBad) addItem(aiActions, 'ai.strategy_redesign', 'ai_rerun', 'Strategyの指摘に沿って設計を見直し、再評価を行う', 'strategy');
      if (qgBad) addItem(aiActions, 'ai.quality_gate_rerun', 'ai_rerun', '成果物を補完のうえQuality Gateを再評価する', 'leader');
      if (signalsUnavailable && !reviewerBad && !strategyBad && !qgBad) {
        addItem(aiActions, 'ai.signals_acquire', 'ai_rerun', 'Auto Taskを再実行し、Reviewer・Strategy・Quality Gateの判定を取得する', 'leader');
      }
      if (baseMissing.length > 0) addItem(aiActions, 'ai.required_fields_fill', 'ai_rerun', '必須項目の欠損（' + baseMissing.length + '件）を補完して再生成する', 'leader');
      // Phase IG-2J-D: 採用案整合はAI会社側の作業（ユーザーへ質問しない）
      if (adoptionUnresolved || adoptionOfficialIdMissing) {
        addItem(aiActions, 'ai.adoption_decide', 'ai_rerun',
          '3案比較の結果をもとに正式採用案（adoptedCandidateId）をLeader判断として確定し、再生成する', 'leader');
      } else if (adIn && adIn.comparisonRepairNeeded) {
        addItem(aiActions, 'ai.adoption_align', 'ai_rerun',
          '3案比較の採用表示を正式採用案「' + (adoptedLabel || adoptedCandidateId || '—') + '」へ整合させる', 'leader');
      }
      if (finalProfileMismatch) {
        addItem(aiActions, 'ai.final_profile_realign', 'ai_rerun',
          'Final Profile全体（ブランド／ターゲット／アカウント／投稿方針／収益導線）を正式採用案「' + (adoptedLabel || '—') + '」向けに再設計する', 'leader');
      }

      // User Input Required（AI会社では決定できないものだけ）
      //   ①IADP契約内の外部確認項目（requiredExternalChecks / confirmationChecklist）を分類器に通す
      //     ＝AI会社側で決められる内容が混ざっていた場合はユーザー質問へ昇格させない。
      var fp = isPlainObject(iadp.finalProfile) ? iadp.finalProfile : {};
      var execBlock = isPlainObject(fp.execution) ? fp.execution : {};
      var aspBlock = (isPlainObject(iadp.intelligence) && isPlainObject(iadp.intelligence.aspProductResearch))
        ? iadp.intelligence.aspProductResearch : {};
      var extReq = isPlainObject(aspBlock.externalConfirmationRequired) ? aspBlock.externalConfirmationRequired : {};
      var candidateTexts = []
        .concat(Array.isArray(execBlock.requiredExternalChecks) ? execBlock.requiredExternalChecks : [])
        .concat(Array.isArray(extReq.confirmationChecklist) ? extReq.confirmationChecklist : []);
      for (var ci = 0; ci < candidateTexts.length; ci++) {
        var raw = candidateTexts[ci];
        if (typeof raw !== 'string' || !raw.trim()) continue;
        var cls = classifyActionItem(raw);
        var codeKey = 'item.' + normalizeActionText(raw).slice(0, 40);
        if (cls.target === 'user') addItem(userInputs, codeKey, cls.category, raw.trim(), null);
        else if (cls.target === 'ai') addItem(aiActions, codeKey, cls.category, raw.trim(), null);
        else addItem(unclassified, codeKey, cls.category, raw.trim(), null);
      }
      //   ②fieldStatusの外部確認待ち件数（実報酬額・実EPC・実承認率等）
      if (ext > 0) {
        addItem(userInputs, 'user.external_confirmation', 'external_confirmation',
          'ASP登録・審査後に確定する実数値（' + ext + '件）を確認する', null);
      }
      //   ③最終承認（品質条件を満たし承認だけ待っている場合のみ）
      if (contentQuality === 'complete' && structureValid && evidenceStatus !== 'insufficient'
          && !reviewerBad && !strategyBad && !qgBad && userApproval === 'pending') {
        addItem(userInputs, 'user.final_approval', 'final_approval', 'この設計で進めてよいか最終承認する', null);
      }

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
        criticalGapCount: (leaderBad ? 1 : 0) + (membersBad ? membersWeak : 0) + (evidenceStatus === 'insufficient' ? 1 : 0) + (structureValid ? 0 : 1)
          + (reviewerBad ? Math.max(1, reviewerCriticalCount) : 0) + (strategyBad ? 1 : 0) + (qgBad ? 1 : 0),
        categoryBreakdown: categoryBreakdown,
        missing: missing,
        nextActions: nextActions,
        // Phase IG-2J-C: 確認事項の正式分類（既存missing/nextActionsは無変更のまま併存）
        actionItems: { aiActions: aiActions, userInputs: userInputs, unclassified: unclassified },
        leaderFinalEvaluated: !!lf, memberExecutionEvaluated: !!ms,
        // Phase IG-2H: 既存判定の再利用結果（表示・監査用。判定ロジック自体は各既存正本のまま）
        reviewerStatus: reviewerStatus,
        reviewerCriticalIssueCount: reviewerCriticalCount,
        reviewerRequiresRework: reviewerRequiresRework,
        strategyStatus: strategyStatus,
        strategyRequiresRework: strategyRequiresRework,
        qualityGateStatus: qualityGateStatus,
        qualityGateSourceStatus: qgSourceStatus,
        signalsUnavailable: signalsUnavailable,
        // Phase IG-2J-D: 採用案 Single Source of Truth（正本はadoptionDecision.adoptedCandidateId）
        adoptionConsistency: adoptionConsistency,
        adoptedCandidateId: adoptedCandidateId,
        adoptedLabel: adoptedLabel,
        adoptionIssues: adoptionIssues,
        adoptionBlocksComplete: adoptionBlocksComplete,
        finalProfileConsistency: finalProfileConsistency,
        selectionVsRanking: selectionVsRanking,
        adoptedNote: adoptionUnresolved ? '正式採用案を特定できません（推測での自動採用は行いません）'
          : (adoptionOfficialIdMissing ? '正式な採用判断が未記録のため暫定表示です'
          : (finalProfileMismatch ? 'Final Profileが正式採用案と一致していません'
          : ((adIn && adIn.comparisonRepairNeeded) ? '3案比較の採用表示を正式採用案へ整合させて表示しています' : null))),
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
        actionItems: { aiActions: [], userInputs: [], unclassified: [] },
        leaderFinalEvaluated: false, memberExecutionEvaluated: false,
        reviewerStatus: 'not_available', reviewerCriticalIssueCount: 0, reviewerRequiresRework: false,
        strategyStatus: 'not_available', strategyRequiresRework: false,
        qualityGateStatus: 'not_executed', qualityGateSourceStatus: null, signalsUnavailable: true,
        adoptionConsistency: 'not_evaluated', adoptedCandidateId: null, adoptedLabel: '', adoptionIssues: [],
        adoptionBlocksComplete: false, finalProfileConsistency: 'unknown', selectionVsRanking: null,
        adoptedNote: null,
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
    // Phase IG-2J-C: 確認事項の分類（純粋関数・単体検証用にも公開）
    classifyActionItem: classifyActionItem,
    normalizeActionText: normalizeActionText,
  };
});
