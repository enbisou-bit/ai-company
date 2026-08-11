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

      // ── Hotfix（IG-2J Post-Release）: finalProfile の誤階層を安全に吸収する ──
      //   実運用でLeaderが finalProfile を intelligence の中へネストして出力し、
      //   トップレベルの finalProfile が空のまま正規化される事象が発生した。
      //   これは「判断の発明」ではなく、同一JSON内の誤った階層を契約上の正しい位置へ
      //   移し替えるだけの構造吸収であり、内容は一切変更しない。
      //   ・トップレベルが存在する場合は必ずトップレベルを優先する（勝手な上書きをしない）
      //   ・候補IDからfinalProfileを生成しない／mainGenre・brandName等を書き換えない
      //   ・吸収した事実は structureAdaptation として監査用に残す（発生時のみ付与）
      var finalProfileSrc = src.finalProfile;
      var adaptation = null;
      var hasTopLevelFP = isPlainObject(finalProfileSrc);
      var hasMisplacedFP = isPlainObject(intelligenceSrc.finalProfile);
      if (!hasTopLevelFP && hasMisplacedFP) {
        finalProfileSrc = intelligenceSrc.finalProfile;
        adaptation = { misplacedFinalProfile: true, resolution: 'adopted_from_intelligence' };
      } else if (hasTopLevelFP && hasMisplacedFP) {
        // 両方存在 → トップレベルを正とし、誤位置側は採用しない（監査対象として記録のみ）
        adaptation = { misplacedFinalProfile: true, resolution: 'top_level_preferred' };
      }

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
        finalProfile: normalizeFinalProfile(finalProfileSrc),
        fieldStatus: normalizeFieldStatusMap(src.fieldStatus),
        approval: normalizeApproval(src.approval),
      };
      // 構造吸収が発生した場合のみ付与（既存パッケージの形は一切変えない）
      if (adaptation) pkg.structureAdaptation = adaptation;

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

        // Phase IG-2J-D: 採用案整合の検証。
        //   既存の errors 契約は一切変更せず warnings のみを追加する（＝これまで valid だった
        //   パッケージが invalid へ転落しない＝保存・既存フローを止めない）。
        //   Complete/Ready を止める実効的な安全側判定は品質層
        //   （assessInstagramAccountDesignPackage の adoptionConsistency）が担当する。
        try {
          var adoptionRes = resolveAdoptedCandidate(pkg);
          for (var ai = 0; ai < adoptionRes.issues.length; ai++) {
            var iss = adoptionRes.issues[ai];
            if (!iss || iss.severity === 'info') continue;
            // 既存errorsと重複するコード（adopted_candidate_id_not_found 等）はwarningへ二重計上しない
            if (iss.code === 'adopted_candidate_id_not_found' || iss.code === 'adopted_candidate_id_missing') continue;
            warnings.push({ code: 'adoption_' + iss.code, message: iss.message });
          }
        } catch (adoptErr) { /* fail-open: 採用整合の検証失敗で構造Validatorを止めない */ }

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

      // Hotfix（IG-2J Post-Release）: 構造吸収が発生したことを監査用warningとして残す。
      //   errors契約は一切変更しない（adoptedCandidateId必須はinvalidのまま維持する）。
      if (isPlainObject(pkg.structureAdaptation) && pkg.structureAdaptation.misplacedFinalProfile) {
        warnings.push({
          code: 'misplaced_final_profile',
          message: pkg.structureAdaptation.resolution === 'top_level_preferred'
            ? 'finalProfile が intelligence 配下にも存在します。契約どおりトップレベルを採用し、誤位置側は使用していません。'
            : 'finalProfile が intelligence 配下へ誤配置されていたため、契約上のトップレベルへ移して正規化しました（内容は変更していません）。',
        });
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

  // ══════════════════════════════════════════════════════════════
  // Phase IG-2J-D: 正式採用案の Single Source of Truth（正本＝adoptionDecision.adoptedCandidateId）
  //
  //   正本の根拠（IG-2J-D調査結果）:
  //     ・adoptedCandidateId は normalizeAdoptionDecision() が入力値をそのまま保持するか null にする
  //       だけであり、正規化・client補正・スコアからの自動生成は一切行われない
  //       ＝ Leaderの意思決定結果がそのまま残る唯一のフィールドである。
  //     ・decisionMadeBy は 'leader' 契約固定であり、この判断主体はLeaderと定義されている。
  //     ・validateAccountDesignPackage() は既に「存在すること」「候補表に実在すること」を必須検証している。
  //     ・candidateComparison.candidates[].decision は不正値が 'hold' へ既定化されるため、
  //       欠損と「意図的な保留」を区別できない＝正本には使えない。
  //     ・finalProfile.contentStrategy.mainGenre は自由文字列であり候補IDから導出されていない。
  //
  //   絶対原則:
  //     ・総合点1位を自動的に正式採用案へ昇格させない（順位は判断材料の1つに過ぎない）。
  //     ・正式採用案IDを推測で補わない・書き換えない。
  //     ・本関数群は純粋関数であり、入力パッケージを一切変更しない（保存副作用ゼロ）。
  // ══════════════════════════════════════════════════════════════

  var ADOPTION_CONSISTENCY_VALUES = ['consistent', 'repairable', 'unresolved'];
  var ADOPTION_SOURCE_VALUES      = ['adoption_decision', 'legacy_single_adopt', 'none'];

  // marketResearch.candidates の genreId → genreName（表示名の逆引き。candidateComparison側は
  // genreIdしか保持しないため。表示専用であり判定には使用しない）
  function buildGenreNameMap(pkg) {
    var map = {};
    try {
      var list = (pkg && pkg.intelligence && pkg.intelligence.marketResearch
        && Array.isArray(pkg.intelligence.marketResearch.candidates))
        ? pkg.intelligence.marketResearch.candidates : [];
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (c && typeof c.genreId === 'string' && c.genreId) map[c.genreId] = (typeof c.genreName === 'string') ? c.genreName : '';
      }
    } catch (e) { /* fail-open */ }
    return map;
  }

  function candidateLabel(candidate, genreNameMap) {
    if (!candidate) return '';
    if (typeof candidate.genreName === 'string' && candidate.genreName) return candidate.genreName;
    if (candidate.genreId && genreNameMap && genreNameMap[candidate.genreId]) return genreNameMap[candidate.genreId];
    return (typeof candidate.candidateId === 'string') ? candidate.candidateId : '';
  }

  // 総合点の降順順位（同点は入力順を維持＝決定的）。順位そのものは一切変更しない（読み取りのみ）。
  function buildRanking(candidates) {
    var indexed = [];
    for (var i = 0; i < candidates.length; i++) {
      var c = candidates[i];
      if (!c) continue;
      indexed.push({ id: c.candidateId, score: (typeof c.totalScore === 'number' && isFinite(c.totalScore)) ? c.totalScore : -1, order: i });
    }
    indexed.sort(function (a, b) {
      if (b.score !== a.score) return b.score - a.score;
      return a.order - b.order; // 同点は入力順（決定的タイブレーク・順位を作り変えない）
    });
    var orderedIds = indexed.map(function (x) { return x.id; });
    var topScore = indexed.length > 0 ? indexed[0].score : null;
    var tiedTop = indexed.filter(function (x) { return x.score === topScore; }).length > 1;
    return {
      orderedIds: orderedIds,
      topCandidateId: indexed.length > 0 ? indexed[0].id : null,
      topScore: topScore,
      tiedTop: tiedTop,
    };
  }

  // 文字列同士の緩い一致（表記ゆれ吸収。片方がもう片方を含む場合も一致とみなす）
  function looseTextMatch(a, b) {
    var x = String(a || '').trim();
    var y = String(b || '').trim();
    if (!x || !y) return false;
    if (x === y) return true;
    return x.indexOf(y) !== -1 || y.indexOf(x) !== -1;
  }

  // ── 公開API⑤ 正式採用案の解決（純粋関数・非破壊・自動修正なし） ─────
  //   戻り値は「判定結果」のみであり、パッケージは変更しない。
  //   consistency:
  //     'consistent'  … 正本IDが解決でき、比較表のadopt・Final Profileとも整合している
  //     'repairable'  … 正本IDは解決できるが、比較表decision等に表示上の不整合がある（決定論的に整合可能）
  //     'unresolved'  … 正本IDを確定できない（存在しない／候補表にない／候補ID重複）。推測で補わない。
  function resolveAdoptedCandidate(pkg) {
    var issues = [];
    var genreNameMap = buildGenreNameMap(pkg);
    try {
      var cc = (pkg && pkg.intelligence && pkg.intelligence.candidateComparison) || {};
      var ad = (pkg && pkg.intelligence && pkg.intelligence.adoptionDecision) || {};
      var candidates = Array.isArray(cc.candidates) ? cc.candidates : [];
      var ranking = buildRanking(candidates);

      // 候補ID重複の検出（重複があると「どの候補が正式採用か」を一意に解決できない）
      var seen = {}, duplicateCandidateIds = [];
      for (var i = 0; i < candidates.length; i++) {
        var cid = candidates[i] && candidates[i].candidateId;
        if (typeof cid !== 'string' || !cid) continue;
        if (seen[cid]) { if (duplicateCandidateIds.indexOf(cid) === -1) duplicateCandidateIds.push(cid); }
        seen[cid] = true;
      }
      if (duplicateCandidateIds.length > 0) {
        issues.push({ code: 'duplicate_candidate_id', severity: 'error',
          message: '候補IDが重複しています（' + duplicateCandidateIds.join('・') + '）。正式採用案を一意に特定できません。' });
      }

      // 比較表側で adopt と宣言されている候補
      var comparisonAdoptIds = [];
      for (var j = 0; j < candidates.length; j++) {
        if (candidates[j] && candidates[j].decision === 'adopt') comparisonAdoptIds.push(candidates[j].candidateId);
      }

      // ── 正本IDの決定 ──
      var officialId = (typeof ad.adoptedCandidateId === 'string' && ad.adoptedCandidateId) ? ad.adoptedCandidateId : null;
      var source = 'none';
      var officialIdMissing = false;

      if (officialId) {
        source = 'adoption_decision';
      } else if (comparisonAdoptIds.length === 1) {
        // legacy fallback: 正本フィールドが欠損していても、比較表のadoptが「ちょうど1件」の場合に限り
        // それをLeaderの採用宣言として解決する（新たな候補を推測で選ぶわけではない）。
        // ただし正本フィールド自体は欠損しているため officialIdMissing=true として区別し、
        // 品質層でComplete到達を許さない（安全側）。
        officialId = comparisonAdoptIds[0];
        source = 'legacy_single_adopt';
        officialIdMissing = true;
        issues.push({ code: 'adopted_candidate_id_missing_legacy_fallback', severity: 'warning',
          message: 'adoptionDecision.adoptedCandidateId が欠損しています。比較表で唯一 adopt と宣言された候補を暫定的に採用案として表示していますが、正式な採用判断としては未確定です。' });
      } else {
        // 総合点1位を自動採用しない（絶対原則）。ここでは解決不能として返す。
        issues.push({ code: 'adopted_candidate_id_missing', severity: 'error',
          message: 'adoptionDecision.adoptedCandidateId が欠損しており、比較表にも一意の adopt がありません。正式採用案を特定できません（総合点1位を自動採用することはしません）。' });
      }

      // 正本IDが候補表に実在するか
      var adoptedCandidate = null;
      if (officialId) {
        for (var k = 0; k < candidates.length; k++) {
          if (candidates[k] && candidates[k].candidateId === officialId) { adoptedCandidate = candidates[k]; break; }
        }
        if (!adoptedCandidate) {
          issues.push({ code: 'adopted_candidate_id_not_found', severity: 'error',
            message: '正式採用ID（' + officialId + '）が3案比較の候補表に存在しません。別候補を自動採用することはしません。' });
        }
      }

      var resolved = !!adoptedCandidate && duplicateCandidateIds.length === 0;

      // ── 比較表 decision との整合 ──
      var comparisonRepairNeeded = false;
      if (resolved) {
        if (comparisonAdoptIds.length === 0) {
          comparisonRepairNeeded = true;
          issues.push({ code: 'comparison_adopt_missing', severity: 'warning',
            message: '3案比較のどの候補にも adopt が付いていません（正式採用案：' + officialId + '）。' });
        } else if (comparisonAdoptIds.length > 1) {
          comparisonRepairNeeded = true;
          issues.push({ code: 'comparison_multiple_adopt', severity: 'warning',
            message: '3案比較で複数（' + comparisonAdoptIds.length + '件）が adopt になっています。正式採用案は1件のみです（' + officialId + '）。' });
        } else if (comparisonAdoptIds[0] !== officialId) {
          comparisonRepairNeeded = true;
          issues.push({ code: 'comparison_adopt_mismatch', severity: 'warning',
            message: '3案比較の adopt（' + comparisonAdoptIds[0] + '）が正式採用案（' + officialId + '）と一致していません。正式採用案を正としてadopt表示を整合させます。' });
        }
      }

      // ── adoptionDecision内部の整合（正本IDがrejected/heldへ同時に含まれていないか） ──
      function listHasId(list, id) {
        if (!Array.isArray(list)) return false;
        for (var n = 0; n < list.length; n++) {
          var e = list[n];
          if (!e) continue;
          if (typeof e === 'string' && e === id) return true;
          if (isPlainObject(e) && e.candidateId === id) return true;
        }
        return false;
      }
      if (resolved && (listHasId(ad.rejectedCandidates, officialId) || listHasId(ad.heldCandidates, officialId))) {
        issues.push({ code: 'adoption_decision_lists_conflict', severity: 'warning',
          message: '正式採用案（' + officialId + '）が却下/保留リストにも含まれています。' });
      }

      // ── 総合点順位との関係（不一致はエラーではない＝説明対象） ──
      var adoptedRank = null;
      if (resolved) {
        var idx = ranking.orderedIds.indexOf(officialId);
        adoptedRank = (idx === -1) ? null : (idx + 1);
      }
      var adoptedIsTop = !!(resolved && ranking.topCandidateId === officialId);
      var selectionVsRanking = null;
      if (resolved && adoptedRank !== null && !adoptedIsTop) {
        var topCand = null;
        for (var t = 0; t < candidates.length; t++) {
          if (candidates[t] && candidates[t].candidateId === ranking.topCandidateId) { topCand = candidates[t]; break; }
        }
        // 「総合点1位ではない」ことは不具合ではなくLeaderの判断結果として説明する（自動で1位へ変更しない）
        selectionVsRanking = {
          adoptedCandidateId: officialId,
          adoptedLabel: candidateLabel(adoptedCandidate, genreNameMap),
          adoptedRank: adoptedRank,
          adoptedTotalScore: (typeof adoptedCandidate.totalScore === 'number') ? adoptedCandidate.totalScore : null,
          topCandidateId: ranking.topCandidateId,
          topLabel: candidateLabel(topCand, genreNameMap),
          topTotalScore: (topCand && typeof topCand.totalScore === 'number') ? topCand.totalScore : null,
          reason: (typeof adoptedCandidate.adoptionReason === 'string' && adoptedCandidate.adoptionReason)
            ? adoptedCandidate.adoptionReason
            : ((typeof ad.decisionRationale === 'string') ? ad.decisionRationale : ''),
        };
        issues.push({ code: 'adopted_candidate_not_top_ranked', severity: 'info',
          message: '正式採用案は総合点1位ではありません（採用：' + adoptedRank + '位）。これはLeaderの判断結果であり、自動的に1位へ変更することはしません。' });
      }

      // ── Final Profile との整合 ──
      //   mainGenre の文字列だけを差し替えると、brand/target/account/monetization/contentStrategy が
      //   別候補向けのまま残る「見た目だけ整合」状態になるため、文字列補正は一切行わず不一致として報告する。
      var mainGenre = (pkg && pkg.finalProfile && pkg.finalProfile.contentStrategy
        && typeof pkg.finalProfile.contentStrategy.mainGenre === 'string')
        ? pkg.finalProfile.contentStrategy.mainGenre : '';
      var adoptedLabelText = resolved ? candidateLabel(adoptedCandidate, genreNameMap) : '';
      var finalProfileConsistency = 'unknown';
      var finalProfileMatchedCandidateId = null;
      if (resolved && mainGenre && adoptedLabelText) {
        if (looseTextMatch(mainGenre, adoptedLabelText)) {
          finalProfileConsistency = 'consistent';
          finalProfileMatchedCandidateId = officialId;
        } else {
          finalProfileConsistency = 'mismatch';
          // どの候補向けに生成されたProfileなのかを特定できる場合は併記する（説明用・書き換えはしない）
          for (var f = 0; f < candidates.length; f++) {
            if (!candidates[f]) continue;
            if (looseTextMatch(mainGenre, candidateLabel(candidates[f], genreNameMap))) {
              finalProfileMatchedCandidateId = candidates[f].candidateId; break;
            }
          }
          issues.push({ code: 'final_profile_main_genre_mismatch', severity: 'warning',
            message: 'Final Profileの主ジャンル「' + mainGenre + '」が正式採用案「' + adoptedLabelText + '」と一致しません'
              + (finalProfileMatchedCandidateId ? '（' + finalProfileMatchedCandidateId + '向けに生成された可能性）' : '')
              + '。Profile全体の整合が保証できないため自動修正は行いません。' });
        }
      }

      var consistency;
      if (!resolved) consistency = 'unresolved';
      else if (comparisonRepairNeeded || officialIdMissing || finalProfileConsistency === 'mismatch') consistency = 'repairable';
      else consistency = 'consistent';

      return {
        evaluated: true,
        resolved: resolved,
        source: source,
        officialIdMissing: officialIdMissing,
        adoptedCandidateId: resolved ? officialId : null,
        adoptedCandidate: adoptedCandidate,
        adoptedLabel: adoptedLabelText,
        adoptedTotalScore: (resolved && typeof adoptedCandidate.totalScore === 'number') ? adoptedCandidate.totalScore : null,
        consistency: consistency,
        issues: issues,
        comparisonAdoptIds: comparisonAdoptIds,
        comparisonRepairNeeded: comparisonRepairNeeded,
        duplicateCandidateIds: duplicateCandidateIds,
        ranking: ranking,
        adoptedRank: adoptedRank,
        adoptedIsTop: adoptedIsTop,
        selectionVsRanking: selectionVsRanking,
        finalProfileConsistency: finalProfileConsistency,
        finalProfileMainGenre: mainGenre,
        finalProfileMatchedCandidateId: finalProfileMatchedCandidateId,
      };
    } catch (e) {
      // fail-open: 解決不能として返す（呼び出し元を止めない・自動採用もしない）
      return {
        evaluated: false, resolved: false, source: 'none', officialIdMissing: false,
        adoptedCandidateId: null, adoptedCandidate: null, adoptedLabel: '', adoptedTotalScore: null,
        consistency: 'unresolved',
        issues: [{ code: 'adoption_resolution_exception', severity: 'error', message: String(e && e.message || e) }],
        comparisonAdoptIds: [], comparisonRepairNeeded: false, duplicateCandidateIds: [],
        ranking: { orderedIds: [], topCandidateId: null, topScore: null, tiedTop: false },
        adoptedRank: null, adoptedIsTop: false, selectionVsRanking: null,
        finalProfileConsistency: 'unknown', finalProfileMainGenre: '', finalProfileMatchedCandidateId: null,
      };
    }
  }

  // ── 公開API⑥ 表示用の採用整合（純粋関数・新規オブジェクトを返す・保存副作用なし） ─────
  //   正式採用案（正本）と一致する候補のみを decision:'adopt' とし、他候補に残った adopt は
  //   'hold' へ寄せる。hold / reject の理由（adoptionReason・mainRisks）は維持する。
  //   変更するのは candidates[].decision のみであり、
  //   adoptedCandidateId・totalScore・順位・scores・finalProfile・packageId は一切変更しない。
  //   正本が解決できない場合（unresolved）・legacy fallback時は何も変更しない（推測で確定させない）。
  function applyAdoptionConsistency(pkg, resolution) {
    try {
      if (!isPlainObject(pkg)) return { package: pkg, changed: false, changes: [] };
      var res = isPlainObject(resolution) ? resolution : resolveAdoptedCandidate(pkg);
      if (!res.resolved || res.source !== 'adoption_decision' || !res.comparisonRepairNeeded) {
        return { package: pkg, changed: false, changes: [] };
      }
      var out = deepCloneJson(pkg);
      if (!isPlainObject(out) || !out.intelligence || !out.intelligence.candidateComparison
        || !Array.isArray(out.intelligence.candidateComparison.candidates)) {
        return { package: pkg, changed: false, changes: [] };
      }
      var list = out.intelligence.candidateComparison.candidates;
      var changes = [];
      for (var i = 0; i < list.length; i++) {
        var c = list[i];
        if (!c) continue;
        if (c.candidateId === res.adoptedCandidateId) {
          if (c.decision !== 'adopt') { changes.push({ candidateId: c.candidateId, from: c.decision, to: 'adopt' }); c.decision = 'adopt'; }
        } else if (c.decision === 'adopt') {
          // 正式採用案ではないのに adopt が残っている → hold へ寄せる（rejectへは落とさない＝安全側）
          changes.push({ candidateId: c.candidateId, from: 'adopt', to: DEFAULT_DECISION });
          c.decision = DEFAULT_DECISION;
        }
      }
      return { package: changes.length > 0 ? out : pkg, changed: changes.length > 0, changes: changes };
    } catch (e) {
      return { package: pkg, changed: false, changes: [] }; // fail-open
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

    ADOPTION_CONSISTENCY_VALUES: ADOPTION_CONSISTENCY_VALUES.slice(),
    ADOPTION_SOURCE_VALUES: ADOPTION_SOURCE_VALUES.slice(),

    createBlankAccountDesignPackage: createBlankAccountDesignPackage,
    normalizeAccountDesignPackage: normalizeAccountDesignPackage,
    validateAccountDesignPackage: validateAccountDesignPackage,
    protectUserConfirmedFields: protectUserConfirmedFields,
    // Phase IG-2J-D: 正式採用案の正本解決・表示用整合（いずれも純粋関数・保存副作用なし）
    resolveAdoptedCandidate: resolveAdoptedCandidate,
    applyAdoptionConsistency: applyAdoptionConsistency,
    adaptExistingIntelligenceContext: adaptExistingIntelligenceContext,
    selectCanonicalAccountDesignPackage: selectCanonicalAccountDesignPackage,

    normalizeFieldStatusValue: normalizeFieldStatusValue,
    generatePackageId: generatePackageId,
    getByPath: getByPath,
    setByPath: setByPath,
  };
});
