// ══════════════════════════════════════════════════════════════
// shared/instagramAccountDesign.js
// Phase IG-2A: Instagram Account Design Package Core
// （Phase IG-1A設計調査／IG-1B契約設計／IG-1C 100%完成契約確定 に基づく実装）
//
// 責務（構造の正本化・正規化・検証のみ）:
//   ・Instagram Account Design Package（IADP）の正式JSON契約を構築・正規化する
//   ・intelligence（市場調査／競合調査／ASP・商品調査／3案比較／採用判断）と
//     finalProfile（brand/target/account/contentStrategy/monetization/kpi/risk/
//     execution の8セクション59項目）を非破壊で正規化し、欠損は安全な既定値で補完する
//   ・fieldStatus（generated_hypothesis／evidence_supported／
//     external_confirmation_required／user_confirmed）の4状態を管理する
//   ・構造のみを検証するValidatorを提供する（内容の品質判定は行わない）
//   ・user_confirmed済みフィールドをAI再生成で上書きしないための保護マージを提供する
//   ・1 case＝1正本を選ぶための純粋な選択ロジックを提供する（実DB操作は行わない）
//   ・案件内に既存Affiliate Intelligence（intelligenceContext.product等）が存在する
//     場合、その値・Evidence・Confidenceを読み取り専用で優先入力できる構造を提供する
//
// 非責務（この工程では実装しない。Phase IG-2B以降）:
//   AI社員への実API実行・専用Workflow接続・実際のDB保存/取得API・編集UI・承認UI・
//   既存Instagram投稿生成パイプラインへの接続。
//   既存Affiliate Intelligence Core関数（_intelCalculateConfidence等）の呼び出し
//   （Evidence3件未満で常にInsufficientになる設計のため、実データがまだ存在しない
//   Account Design Package生成時点で呼び出しても機能しない。よって呼び出さない）。
//
// 設計原則:
//   ・純粋関数のみ（DOM/Node専用API/Network/グローバル状態書き換えなし）
//   ・入力オブジェクトを一切変更しない（非破壊・常に新規オブジェクトを構築して返す）
//   ・例外を外へ投げない（fail-open・安全な既定構造を返す）
//   ・既存13 Output Type・Content Planning・Carousel Builder・Affiliate Intelligence
//     Core・Leader Rule Engineのいずれの関数も呼び出さない（本Coreは完全独立・新規）
//   ・OUTPUT_TYPE_ID（instagram_account_design）はこのファイル内でのみ定義する。
//     既存 OUTPUT_TYPE_DEFINITIONS / detectOutputType() へは登録しない
//     （既存Output Type判定への回帰影響を避けるため。Workflow接続はPhase IG-2B以降）
// ══════════════════════════════════════════════════════════════
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;                    // CommonJS（Node / 合成テスト）
  } else {
    root.InstagramAccountDesign = api;        // ブラウザ（window / globalThis）
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var CORE_VERSION = '1.0.0';

  // Account Design Package専用のOutput Type識別子。
  // 既存の OUTPUT_TYPE_DEFINITIONS（index.html内・既存13型）へは今回登録しない。
  var OUTPUT_TYPE_ID = 'instagram_account_design';

  var PACKAGE_STATUS_VALUES  = ['draft', 'reviewing', 'approved'];
  var APPROVAL_STATUS_VALUES = ['draft', 'reviewing', 'approved'];

  var FIELD_STATUS_VALUES = [
    'generated_hypothesis',
    'evidence_supported',
    'external_confirmation_required',
    'user_confirmed',
  ];
  var DEFAULT_FIELD_STATUS       = 'generated_hypothesis';
  var USER_CONFIRMED_STATUS      = 'user_confirmed';
  var EXTERNAL_CONFIRMATION_STATUS = 'external_confirmation_required';

  var MIN_CANDIDATES    = 3;
  var DECISION_VALUES   = ['adopt', 'hold', 'reject'];
  var DEFAULT_DECISION  = 'hold'; // 情報不足時はholdを既定値とする（Leader Integration Layerの既存方針を踏襲）

  // 3案比較の評価軸（10軸・契約固定・入力で上書きしない）
  var EVALUATION_AXES = [
    'marketPotential', 'profitability', 'instagramFit', 'competitionDifficulty',
    'differentiationPotential', 'noFaceNoVoiceFit', 'continuity', 'multiProductFit',
    'longTermBrandAsset', 'aiOperationFit',
  ];

  // Instagram競合調査の9項目（配列項目／文字列項目に分離）
  var COMPETITOR_RESEARCH_ARRAY_FIELDS = [
    'strongCompetitorCharacteristics', 'postFormats', 'appealPatterns',
    'monetizationFunnels', 'reproducibleSuccessFactors',
  ];
  var COMPETITOR_RESEARCH_STRING_FIELDS = [
    'competitionVolume', 'differentiationOpportunity', 'noFaceNoVoiceFit', 'continuity',
  ];

  // 既存Affiliate Intelligence Core（Decision076-083）の6モジュールキー。
  // 実データの優先入力にのみ使用し、既存 _intel* 関数は呼び出さない。
  var AFFILIATE_INTELLIGENCE_MODULE_KEYS = ['product', 'asp', 'competition', 'revenue', 'content', 'market'];

  var FINAL_PROFILE_SECTIONS = [
    'brand', 'target', 'account', 'contentStrategy', 'monetization', 'kpi', 'risk', 'execution',
  ];

  // Final Account Profile 8セクション・59項目の既定値スキーマ（Phase IG-1C確定分）
  var FINAL_PROFILE_SCHEMA = {
    brand: {
      brandName: '', brandConcept: '', brandStory: '', worldview: '',
      differentiation: '', brandTone: '', colorPolicy: '', prohibitedExpressions: [],
    },
    target: {
      persona: '', ageRange: '', mainPainPoints: [], desires: [],
      purchaseMotivations: [], searchIntent: [], trustBarriers: [],
    },
    account: {
      accountName: '', usernameCandidates: [], bio: '', iconPolicy: '',
      iconPrompt: '', highlightPolicy: [], pinnedPostPolicy: '', profileLinkPolicy: '',
    },
    contentStrategy: {
      mainGenre: '', contentPillars: [], postCategories: [], postRatio: {},
      postFrequency: '', postTimePolicy: '', carouselPolicy: '', reelPolicy: '',
      storyPolicy: '', trustBuildingPolicy: '',
    },
    monetization: {
      aspCandidates: [], productGenres: [], productSelectionPolicy: '',
      ctaPolicy: '', funnelPolicy: '', salesBalancePolicy: '', prohibitedSalesApproach: [],
    },
    kpi: {
      initialKpis: [], saveRateTarget: null, profileVisitTarget: null,
      followRateTarget: null, ctrTarget: null, cvrTarget: null,
      monthlyRevenueTarget: null, reviewCycle: '', improvementConditions: [],
    },
    risk: {
      competitionRisk: '', regulationRisk: '', credibilityRisk: '',
      continuityRisk: '', monetizationRisk: '', avoidanceActions: [],
    },
    execution: {
      accountCreationChecklist: [], aspRegistrationChecklist: [],
      requiredExternalChecks: [], first30DaysOperatingPolicy: '',
    },
  };

  // ── 小ヘルパー ───────────────────────────────────────────────
  function isPlainObject(v) {
    return !!v && typeof v === 'object' && !Array.isArray(v);
  }

  function shallowCopyPlainObject(v) {
    var out = {};
    var keys = Object.keys(v);
    for (var i = 0; i < keys.length; i++) out[keys[i]] = v[keys[i]];
    return out;
  }

  function deepCloneJson(v) {
    try { return JSON.parse(JSON.stringify(v)); } catch (e) { return v; }
  }

  function nowIsoDefault() {
    return new Date().toISOString();
  }

  function generatePackageId() {
    return 'iadp_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
  }

  function normalizeEnumValue(v, allowed, fallback) {
    return (typeof v === 'string' && allowed.indexOf(v) !== -1) ? v : fallback;
  }

  function normalizeFieldStatusValue(v) {
    return (typeof v === 'string' && FIELD_STATUS_VALUES.indexOf(v) !== -1) ? v : DEFAULT_FIELD_STATUS;
  }

  function normalizeFieldStatusMap(raw) {
    var src = isPlainObject(raw) ? raw : {};
    var out = {};
    var keys = Object.keys(src);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (typeof k !== 'string' || !k) continue;
      out[k] = normalizeFieldStatusValue(src[k]);
    }
    return out;
  }

  function clampScore(n) {
    var num = (typeof n === 'number' && isFinite(n)) ? n : 0;
    return Math.max(0, Math.min(100, Math.round(num)));
  }

  // defaults の形（配列 / null許容数値 / プレーンオブジェクト / 文字列）に応じて
  // input の該当キーを安全にマージする。欠損キーは既定値で補完する（非破壊）。
  function mergeWithDefaults(input, defaults) {
    var src = isPlainObject(input) ? input : {};
    var out = {};
    var keys = Object.keys(defaults);
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      var def = defaults[k];
      var val = src[k];
      if (Array.isArray(def)) {
        out[k] = Array.isArray(val) ? val.slice() : def.slice();
      } else if (def === null) {
        out[k] = (typeof val === 'number' && isFinite(val)) ? val : null;
      } else if (typeof def === 'object') {
        out[k] = isPlainObject(val) ? shallowCopyPlainObject(val) : {};
      } else {
        out[k] = (typeof val === 'string') ? val : def;
      }
    }
    return out;
  }

  function getByPath(obj, path) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length; i++) {
      if (cur === null || typeof cur !== 'object') return undefined;
      cur = cur[parts[i]];
    }
    return cur;
  }

  function setByPath(obj, path, value) {
    var parts = String(path).split('.');
    var cur = obj;
    for (var i = 0; i < parts.length - 1; i++) {
      var key = parts[i];
      if (!isPlainObject(cur[key])) cur[key] = {};
      cur = cur[key];
    }
    cur[parts[parts.length - 1]] = value;
  }

  // ── intelligence.marketResearch ─────────────────────────────
  // ジャンル候補は固定リストに限定しない（既存データ・入力条件から任意件数を保持できる）
  function normalizeMarketResearch(raw) {
    var src = isPlainObject(raw) ? raw : {};
    var rawCandidates = Array.isArray(src.candidates) ? src.candidates : [];
    var candidates = rawCandidates.map(function (c) {
      var s = isPlainObject(c) ? c : {};
      return {
        genreId: (typeof s.genreId === 'string' && s.genreId) ? s.genreId : '',
        genreName: (typeof s.genreName === 'string') ? s.genreName : '',
        marketSizeEstimate: (typeof s.marketSizeEstimate === 'string') ? s.marketSizeEstimate : '',
        trendDirection: (typeof s.trendDirection === 'string') ? s.trendDirection : '',
        seasonality: (typeof s.seasonality === 'string') ? s.seasonality : '',
        evidenceStatus: normalizeFieldStatusValue(s.evidenceStatus),
        notes: (typeof s.notes === 'string') ? s.notes : '',
      };
    });
    return {
      candidates: candidates,
      selectionCriteria: (typeof src.selectionCriteria === 'string') ? src.selectionCriteria : '',
    };
  }

  // ── intelligence.competitorResearch ─────────────────────────
  function normalizeCompetitorEntry(raw) {
    var src = isPlainObject(raw) ? raw : {};
    var out = {
      genreId: (typeof src.genreId === 'string') ? src.genreId : '',
      evidenceStatus: normalizeFieldStatusValue(src.evidenceStatus),
    };
    for (var i = 0; i < COMPETITOR_RESEARCH_ARRAY_FIELDS.length; i++) {
      var af = COMPETITOR_RESEARCH_ARRAY_FIELDS[i];
      out[af] = Array.isArray(src[af]) ? src[af].slice() : [];
    }
    for (var j = 0; j < COMPETITOR_RESEARCH_STRING_FIELDS.length; j++) {
      var sf = COMPETITOR_RESEARCH_STRING_FIELDS[j];
      out[sf] = (typeof src[sf] === 'string') ? src[sf] : '';
    }
    return out;
  }

  function normalizeCompetitorResearch(raw) {
    var src = isPlainObject(raw) ? raw : {};
    var rawList = Array.isArray(src.byGenre) ? src.byGenre : [];
    return { byGenre: rawList.map(normalizeCompetitorEntry) };
  }

  // ── intelligence.aspProductResearch ─────────────────────────
  // autoGenerated（AI仮説）と externalConfirmationRequired（外部確認必須）を分離。
  // 実案件情報がなくてもPackage生成自体は停止させない（externalは常にnull許容）。
  function normalizeAspProductResearch(raw) {
    var src = isPlainObject(raw) ? raw : {};

    var autoSrc = isPlainObject(src.autoGenerated) ? src.autoGenerated : {};
    var autoGenerated = {
      recommendedAspCandidates: Array.isArray(autoSrc.recommendedAspCandidates) ? autoSrc.recommendedAspCandidates.slice() : [],
      recommendedProductGenres: Array.isArray(autoSrc.recommendedProductGenres) ? autoSrc.recommendedProductGenres.slice() : [],
      selectionCriteria: (typeof autoSrc.selectionCriteria === 'string') ? autoSrc.selectionCriteria : '',
      compensationStructureDirection: (typeof autoSrc.compensationStructureDirection === 'string') ? autoSrc.compensationStructureDirection : '',
      continuityPolicy: (typeof autoSrc.continuityPolicy === 'string') ? autoSrc.continuityPolicy : '',
      accountFitNotes: (typeof autoSrc.accountFitNotes === 'string') ? autoSrc.accountFitNotes : '',
      evidenceStatus: normalizeFieldStatusValue(autoSrc.evidenceStatus),
    };

    var extSrc = isPlainObject(src.externalConfirmationRequired) ? src.externalConfirmationRequired : {};
    var externalConfirmationRequired = {
      activeListings: extSrc.activeListings !== undefined ? extSrc.activeListings : null,
      latestCompensation: extSrc.latestCompensation !== undefined ? extSrc.latestCompensation : null,
      epc: extSrc.epc !== undefined ? extSrc.epc : null,
      approvalRate: extSrc.approvalRate !== undefined ? extSrc.approvalRate : null,
      screeningConditions: extSrc.screeningConditions !== undefined ? extSrc.screeningConditions : null,
      partnershipAvailability: extSrc.partnershipAvailability !== undefined ? extSrc.partnershipAvailability : null,
      status: EXTERNAL_CONFIRMATION_STATUS, // 契約固定（外部確認待ちであることを常に明示）
      confirmationChecklist: Array.isArray(extSrc.confirmationChecklist) ? extSrc.confirmationChecklist.slice() : [],
    };

    return { autoGenerated: autoGenerated, externalConfirmationRequired: externalConfirmationRequired };
  }

  // ── intelligence.candidateComparison ────────────────────────
  function normalizeScores(rawScores) {
    var src = isPlainObject(rawScores) ? rawScores : {};
    var out = {};
    for (var i = 0; i < EVALUATION_AXES.length; i++) {
      var axis = EVALUATION_AXES[i];
      out[axis] = clampScore(src[axis]);
    }
    return out;
  }

  function computeTotalScore(scores) {
    var sum = 0;
    for (var i = 0; i < EVALUATION_AXES.length; i++) sum += scores[EVALUATION_AXES[i]];
    return Math.round(sum / EVALUATION_AXES.length);
  }

  function normalizeComparisonCandidate(raw, index) {
    var src = isPlainObject(raw) ? raw : {};
    var scores = normalizeScores(src.scores);
    var totalScore = (typeof src.totalScore === 'number' && isFinite(src.totalScore))
      ? clampScore(src.totalScore)
      : computeTotalScore(scores);
    var decision = (DECISION_VALUES.indexOf(src.decision) !== -1) ? src.decision : DEFAULT_DECISION;
    var candidateId = (typeof src.candidateId === 'string' && src.candidateId) ? src.candidateId : ('cand_' + (index + 1));
    return {
      candidateId: candidateId,
      genreId: (typeof src.genreId === 'string') ? src.genreId : '',
      scores: scores,
      totalScore: totalScore,
      decision: decision,
      adoptionReason: (typeof src.adoptionReason === 'string') ? src.adoptionReason : '',
      mainRisks: Array.isArray(src.mainRisks) ? src.mainRisks.slice() : [],
      evidenceStatus: normalizeFieldStatusValue(src.evidenceStatus),
    };
  }

  function normalizeCandidateComparison(raw) {
    var src = isPlainObject(raw) ? raw : {};
    var rawCandidates = Array.isArray(src.candidates) ? src.candidates : [];
    var candidates = rawCandidates.map(function (c, idx) { return normalizeComparisonCandidate(c, idx); });
    return {
      evaluationAxes: EVALUATION_AXES.slice(), // 契約固定・入力での上書きは無視する
      minCandidates: MIN_CANDIDATES,
      candidates: candidates,
    };
  }

  // ── intelligence.adoptionDecision ───────────────────────────
  function normalizeAdoptionDecision(raw) {
    var src = isPlainObject(raw) ? raw : {};
    return {
      adoptedCandidateId: (typeof src.adoptedCandidateId === 'string' && src.adoptedCandidateId) ? src.adoptedCandidateId : null,
      decisionMadeBy: 'leader', // 契約固定・正式値
      decisionRationale: (typeof src.decisionRationale === 'string') ? src.decisionRationale : '',
      rejectedCandidates: Array.isArray(src.rejectedCandidates) ? src.rejectedCandidates.slice() : [],
      heldCandidates: Array.isArray(src.heldCandidates) ? src.heldCandidates.slice() : [],
    };
  }

  // ── approval ─────────────────────────────────────────────────
  // approvedはユーザー承認前に自動設定しない：このモジュールのどの関数も
  // approvalStatus/packageStatusを'approved'へ自ら昇格させることはなく、
  // 入力に既に'approved'がある場合のみ列挙値として保持する（正規化のみ）。
  function normalizeApproval(raw) {
    var src = isPlainObject(raw) ? raw : {};
    return {
      approvalStatus: normalizeEnumValue(src.approvalStatus, APPROVAL_STATUS_VALUES, 'draft'),
      approvedAt: (typeof src.approvedAt === 'string' && src.approvedAt) ? src.approvedAt : null,
      approvedFields: Array.isArray(src.approvedFields) ? src.approvedFields.slice() : [],
    };
  }

  // ── 既存Affiliate Intelligence（案件内の実データ）の読み取り専用適応 ──────
  // 実データが存在する場合は無視しない／AI仮説へ置換しない／Evidence・Confidenceを
  // 保持する／既存 _intel* 関数は呼び出さない（再計算しない・そのまま参照する）。
  function adaptExistingIntelligenceContext(intelligenceContext) {
    try {
      if (!isPlainObject(intelligenceContext)) {
        return { available: false, availableKeys: [], summary: {} };
      }
      var summary = {};
      var availableKeys = [];
      for (var i = 0; i < AFFILIATE_INTELLIGENCE_MODULE_KEYS.length; i++) {
        var key = AFFILIATE_INTELLIGENCE_MODULE_KEYS[i];
        var mod = intelligenceContext[key];
        if (!isPlainObject(mod)) continue;
        var hasConfidence = (mod.confidence !== null && mod.confidence !== undefined);
        var hasDerivedStatus = isPlainObject(mod.derived) && typeof mod.derived.status === 'string' && mod.derived.status !== 'insufficient';
        if (!hasConfidence && !hasDerivedStatus) continue; // 実データなし → 呼び出し側でgenerated_hypothesisへフォールバック
        summary[key] = {
          confidence: mod.confidence !== undefined ? mod.confidence : null,
          derivedStatus: (isPlainObject(mod.derived) && typeof mod.derived.status === 'string') ? mod.derived.status : null,
          updatedAt: (typeof mod.updatedAt === 'string') ? mod.updatedAt : '',
        };
        availableKeys.push(key);
      }
      return { available: availableKeys.length > 0, availableKeys: availableKeys, summary: summary };
    } catch (e) {
      return { available: false, availableKeys: [], summary: {} }; // fail-open
    }
  }

  // ── Final Account Profile（8セクション・59項目） ─────────────
  function normalizeFinalProfile(raw) {
    var src = isPlainObject(raw) ? raw : {};
    var out = {};
    for (var i = 0; i < FINAL_PROFILE_SECTIONS.length; i++) {
      var sec = FINAL_PROFILE_SECTIONS[i];
      out[sec] = mergeWithDefaults(src[sec], FINAL_PROFILE_SCHEMA[sec]);
    }
    return out;
  }

  // ── 空パッケージ生成（トップレベル契約） ─────────────────────
  function createBlankAccountDesignPackage(caseId, nowIso) {
    var now = (typeof nowIso === 'string' && nowIso) ? nowIso : nowIsoDefault();
    return {
      version: CORE_VERSION,
      packageId: generatePackageId(),
      caseId: (typeof caseId === 'string' && caseId) ? caseId : null,
      createdAt: now,
      updatedAt: now,
      packageStatus: 'draft',
      intelligence: {
        marketResearch: normalizeMarketResearch(null),
        competitorResearch: normalizeCompetitorResearch(null),
        aspProductResearch: normalizeAspProductResearch(null),
        candidateComparison: normalizeCandidateComparison(null),
        adoptionDecision: normalizeAdoptionDecision(null),
      },
      finalProfile: normalizeFinalProfile(null),
      fieldStatus: {},
      approval: normalizeApproval(null),
    };
  }

  // ── 公開API① 正式契約への正規化（メインエントリ） ────────────
  // input: 任意の部分的・不正な形の入力（非破壊・変更しない）
  // options: { caseId, now, existingIntelligenceContext }
  //   caseId … 現在案件のcaseId（省略時はinput.caseIdを使用）
  //   existingIntelligenceContext … outputDraft.fields.intelligenceContext（あれば）
  function normalizeAccountDesignPackage(input, options) {
    try {
      var src = isPlainObject(input) ? input : {};
      var opts = isPlainObject(options) ? options : {};
      var now = (typeof opts.now === 'string' && opts.now) ? opts.now : nowIsoDefault();

      var caseId = (typeof opts.caseId === 'string' && opts.caseId)
        ? opts.caseId
        : ((typeof src.caseId === 'string' && src.caseId) ? src.caseId : null);

      // packageId: 既存値があれば維持（更新時）、なければ新規発行（新規保存時）
      var packageId = (typeof src.packageId === 'string' && src.packageId) ? src.packageId : generatePackageId();
      var createdAt = (typeof src.createdAt === 'string' && src.createdAt) ? src.createdAt : now;

      var intelligenceSrc = isPlainObject(src.intelligence) ? src.intelligence : {};

      var pkg = {
        version: CORE_VERSION,
        packageId: packageId,
        caseId: caseId,
        createdAt: createdAt,
        updatedAt: now,
        packageStatus: normalizeEnumValue(src.packageStatus, PACKAGE_STATUS_VALUES, 'draft'),
        intelligence: {
          marketResearch: normalizeMarketResearch(intelligenceSrc.marketResearch),
          competitorResearch: normalizeCompetitorResearch(intelligenceSrc.competitorResearch),
          aspProductResearch: normalizeAspProductResearch(intelligenceSrc.aspProductResearch),
          candidateComparison: normalizeCandidateComparison(intelligenceSrc.candidateComparison),
          adoptionDecision: normalizeAdoptionDecision(intelligenceSrc.adoptionDecision),
        },
        finalProfile: normalizeFinalProfile(src.finalProfile),
        fieldStatus: normalizeFieldStatusMap(src.fieldStatus),
        approval: normalizeApproval(src.approval),
      };

      // 既存Affiliate Intelligence（実データ）を読み取り専用で優先入力する。
      // 置換ではなく参照コピーであり、intelligenceContext自体は一切変更しない。
      if (opts.existingIntelligenceContext) {
        var adapted = adaptExistingIntelligenceContext(opts.existingIntelligenceContext);
        if (adapted.available) {
          pkg.intelligence.aspProductResearch.autoGenerated.sourceIntelligence = adapted.summary;
          for (var k = 0; k < adapted.availableKeys.length; k++) {
            var path = 'intelligence.aspProductResearch.autoGenerated.sourceIntelligence.' + adapted.availableKeys[k];
            pkg.fieldStatus[path] = 'evidence_supported'; // 実Evidence/Confidence起点のみ格上げ（仮説のまま扱わない）
          }
        }
      }

      return pkg;
    } catch (e) {
      // fail-open: 何が起きても安全な空パッケージへフォールバックする（呼び出し元を止めない）
      return createBlankAccountDesignPackage(options && options.caseId, options && options.now);
    }
  }

  // ── 公開API② 構造Validator（内容品質は判定しない） ────────────
  function validateAccountDesignPackage(pkg) {
    var errors = [];
    var warnings = [];
    try {
      if (!isPlainObject(pkg)) {
        errors.push({ code: 'invalid_package', message: 'Account Design Package is not an object' });
        return { valid: false, errors: errors, warnings: warnings };
      }

      if (typeof pkg.version !== 'string' || !pkg.version) {
        errors.push({ code: 'missing_version', message: 'version is required' });
      }
      if (typeof pkg.packageId !== 'string' || !pkg.packageId) {
        errors.push({ code: 'missing_package_id', message: 'packageId is required' });
      }
      if (typeof pkg.caseId !== 'string' || !pkg.caseId) {
        errors.push({ code: 'missing_case_id', message: 'caseId is required' });
      }

      if (!isPlainObject(pkg.intelligence)) {
        errors.push({ code: 'missing_intelligence', message: 'intelligence is required' });
      } else {
        var cc = pkg.intelligence.candidateComparison;
        var candidateIds = [];
        if (!isPlainObject(cc)) {
          errors.push({ code: 'missing_candidate_comparison', message: 'intelligence.candidateComparison is required' });
        } else {
          var candidates = Array.isArray(cc.candidates) ? cc.candidates : [];
          candidateIds = candidates.map(function (c) { return c && c.candidateId; });
          if (candidates.length < MIN_CANDIDATES) {
            errors.push({
              code: 'insufficient_candidates',
              message: 'at least ' + MIN_CANDIDATES + ' candidates are required (found ' + candidates.length + ')',
            });
          }
        }

        var ad = pkg.intelligence.adoptionDecision;
        if (!isPlainObject(ad)) {
          errors.push({ code: 'missing_adoption_decision', message: 'intelligence.adoptionDecision is required' });
        } else if (typeof ad.adoptedCandidateId !== 'string' || !ad.adoptedCandidateId) {
          errors.push({ code: 'missing_adopted_candidate_id', message: 'adoptionDecision.adoptedCandidateId is required' });
        } else if (isPlainObject(cc) && candidateIds.indexOf(ad.adoptedCandidateId) === -1) {
          errors.push({
            code: 'adopted_candidate_id_not_found',
            message: 'adoptedCandidateId does not match any candidate in candidateComparison.candidates',
          });
        }

        // 外部確認待ちは構造エラーではなくwarning（Package生成を止めない）
        var apr = pkg.intelligence.aspProductResearch;
        if (isPlainObject(apr) && isPlainObject(apr.externalConfirmationRequired)
          && apr.externalConfirmationRequired.status === EXTERNAL_CONFIRMATION_STATUS) {
          warnings.push({
            code: 'external_confirmation_pending',
            message: 'ASP/product data requires external confirmation (e.g. ASP registration) before real operation.',
          });
        }
      }

      if (!isPlainObject(pkg.finalProfile)) {
        errors.push({ code: 'missing_final_profile', message: 'finalProfile is required' });
      } else {
        for (var i = 0; i < FINAL_PROFILE_SECTIONS.length; i++) {
          var sec = FINAL_PROFILE_SECTIONS[i];
          if (!isPlainObject(pkg.finalProfile[sec])) {
            errors.push({ code: 'missing_final_profile_section', message: 'finalProfile.' + sec + ' is required' });
          }
        }
      }

      if (!isPlainObject(pkg.fieldStatus)) {
        errors.push({ code: 'missing_field_status', message: 'fieldStatus is required' });
      }

      if (!isPlainObject(pkg.approval)) {
        errors.push({ code: 'missing_approval', message: 'approval is required' });
      } else if (APPROVAL_STATUS_VALUES.indexOf(pkg.approval.approvalStatus) === -1) {
        errors.push({
          code: 'invalid_approval_status',
          message: 'approval.approvalStatus must be one of ' + APPROVAL_STATUS_VALUES.join('/'),
        });
      }

      if (PACKAGE_STATUS_VALUES.indexOf(pkg.packageStatus) === -1) {
        errors.push({
          code: 'invalid_package_status',
          message: 'packageStatus must be one of ' + PACKAGE_STATUS_VALUES.join('/'),
        });
      }

      return { valid: errors.length === 0, errors: errors, warnings: warnings };
    } catch (e) {
      return { valid: false, errors: [{ code: 'validator_exception', message: String(e && e.message || e) }], warnings: warnings };
    }
  }

  // ── 公開API③ user_confirmed保護マージ ─────────────────────────
  // existingPkg側でfieldStatusが'user_confirmed'のパスは、incomingPkg（AI再生成候補）
  // で上書きせず、既存の値・状態を維持したパッケージを新規オブジェクトとして返す。
  function protectUserConfirmedFields(existingPkg, incomingPkg) {
    try {
      if (!isPlainObject(existingPkg) || !isPlainObject(incomingPkg)) return incomingPkg;
      var existingStatus = isPlainObject(existingPkg.fieldStatus) ? existingPkg.fieldStatus : {};
      var result = deepCloneJson(incomingPkg);
      if (!isPlainObject(result)) return incomingPkg;
      var paths = Object.keys(existingStatus);
      for (var i = 0; i < paths.length; i++) {
        var path = paths[i];
        if (existingStatus[path] !== USER_CONFIRMED_STATUS) continue;
        var existingValue = getByPath(existingPkg, path);
        if (existingValue === undefined) continue;
        setByPath(result, path, deepCloneJson(existingValue));
        if (!isPlainObject(result.fieldStatus)) result.fieldStatus = {};
        result.fieldStatus[path] = USER_CONFIRMED_STATUS;
      }
      return result;
    } catch (e) {
      return incomingPkg; // fail-open
    }
  }

  // ── 公開API④ 1 case＝1正本の選択（純粋関数・実DB操作なし） ─────
  // rows: output_drafts相当の行配列（{output_id/case_id/type/updated_at, ...}）を想定。
  // 正本選択のみを行い、重複行の削除は一切行わない。
  function parseUpdatedAtMillis(row) {
    var v = row && (row.updated_at || row.updatedAt);
    var t = v ? Date.parse(v) : NaN;
    return isFinite(t) ? t : 0; // 不正・欠損は最古扱い（安全側・最新扱いにしない）
  }

  function selectCanonicalAccountDesignPackage(rows, caseId) {
    try {
      var list = Array.isArray(rows) ? rows : [];
      var matches = list.filter(function (r) {
        return r && typeof r === 'object'
          && ((r.case_id !== undefined ? r.case_id : r.caseId) === caseId)
          && r.type === OUTPUT_TYPE_ID;
      });
      if (matches.length === 0) return { canonical: null, duplicates: [], warnings: [] };

      var sorted = matches.slice().sort(function (a, b) { return parseUpdatedAtMillis(b) - parseUpdatedAtMillis(a); });
      var canonical = sorted[0];
      var duplicates = sorted.slice(1);
      var warnings = [];
      if (duplicates.length > 0) {
        warnings.push({
          code: 'duplicate_account_design_package',
          message: 'Found ' + matches.length + ' Account Design Package rows for case ' + String(caseId) + '; using the most recently updated one as canonical.',
          count: matches.length,
        });
      }
      return { canonical: canonical, duplicates: duplicates, warnings: warnings };
    } catch (e) {
      return { canonical: null, duplicates: [], warnings: [{ code: 'selection_exception', message: String(e && e.message || e) }] };
    }
  }

  return {
    version: CORE_VERSION,
    OUTPUT_TYPE_ID: OUTPUT_TYPE_ID,
    PACKAGE_STATUS_VALUES: PACKAGE_STATUS_VALUES.slice(),
    APPROVAL_STATUS_VALUES: APPROVAL_STATUS_VALUES.slice(),
    FIELD_STATUS_VALUES: FIELD_STATUS_VALUES.slice(),
    EVALUATION_AXES: EVALUATION_AXES.slice(),
    FINAL_PROFILE_SECTIONS: FINAL_PROFILE_SECTIONS.slice(),
    MIN_CANDIDATES: MIN_CANDIDATES,

    createBlankAccountDesignPackage: createBlankAccountDesignPackage,
    normalizeAccountDesignPackage: normalizeAccountDesignPackage,
    validateAccountDesignPackage: validateAccountDesignPackage,
    protectUserConfirmedFields: protectUserConfirmedFields,
    adaptExistingIntelligenceContext: adaptExistingIntelligenceContext,
    selectCanonicalAccountDesignPackage: selectCanonicalAccountDesignPackage,

    normalizeFieldStatusValue: normalizeFieldStatusValue,
    generatePackageId: generatePackageId,
    getByPath: getByPath,
    setByPath: setByPath,
  };
});
