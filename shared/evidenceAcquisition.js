// ══════════════════════════════════════════════════════════════
// shared/evidenceAcquisition.js
// EEA-2: External Evidence Acquisition — Web Search Adapter（純関数のみ）
//
// 責務（このファイルが行うこと）:
//   ・OpenAI Responses API（web_search tool）向けrequest bodyの構築（純粋なオブジェクト生成のみ）
//   ・web_search実行結果（response.data）からsource（URL/title）・search queryの抽出
//   ・抽出結果をEEA-1 Evidence Schema（sourceUrl/sourceTitle/verificationStatus/createdBy/sourceMethod）
//     互換のEvidence Candidateへ変換
//
// 非責務（このファイルが絶対に行わないこと）:
//   ・実際のHTTP通信・axios呼び出し（APIキーを一切扱わない・保持しない）
//   ・OPENAI_API_KEYの参照（このファイルはブラウザ側 <script src> からも読み込まれ得るため、
//     秘密情報を一切含まない設計とする。実際の通信は openaiClient.js（server-only）が担う）
//   ・Verified昇格判定（verificationStatusは常に 'unverified' 固定。判定ロジックは後工程の責務）
//   ・Source Trust Tier判定（reliability付与は行わない）
//   ・IADP Evidence正本（intelligenceContext.evidence[]）への書き込み・_intelCreateEvidence()の呼び出し
//     （Candidateを返すのみ。正本への変換・保存は呼び出し側＝将来のResearcher接続工程の責務）
//   ・既存Researcher / Auto Task / IADP実行経路への接続（EEA-2時点ではどこからも呼ばれない）
//
// 設計原則:
//   ・純粋関数のみ（DOM/Node専用API/Network/グローバル状態書き換えなし）
//   ・例外を外へ投げない（fail-open。異常なresponseでも空配列を返すだけで停止しない）
//   ・存在しないfieldを推測生成しない（例: publishedDateはAPI responseに存在しないため常にnull）
//   ・EEA-1で追加したEvidence契約（index.html _intelCreateEvidence()）の既存フィールドは
//     一切変更しない。本ファイルはCandidateを生成するのみで、正本スキーマ自体には触れない。
// ══════════════════════════════════════════════════════════════
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;                                  // CommonJS（Node / server-side / 合成テスト）
  } else {
    root.EvidenceAcquisition = api;                         // ブラウザ（window / globalThis）※EEA-2時点では未接続
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var ADAPTER_VERSION = '1.0.0';

  // Web Search Candidateのsource種別（識別のみ・EEA-1のINTEL_EVIDENCE_TYPES 'web_retrieved' と対応）
  var CANDIDATE_EVIDENCE_TYPE       = 'web_retrieved';
  var CANDIDATE_VERIFICATION_STATUS = 'unverified';   // Web検索取得のみではVerifiedにしない（固定・変更不可）
  var CANDIDATE_CREATED_BY          = 'system';
  var CANDIDATE_SOURCE_METHOD       = 'web_retrieved';

  function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function str(v) { return (v === null || v === undefined) ? '' : String(v); }

  // ══════════════════════════════════════════════════════════════
  // EEA-3: Search Plan生成 / query検証 / 承認前上限制御（すべて純関数・fail-open）
  // ══════════════════════════════════════════════════════════════
  var MAX_QUERIES_PER_APPROVAL = 3;    // 1承認あたりのWeb Search tool call上限（超過分は切り捨て・拒否ではない）
  var MAX_QUERY_LENGTH = 200;          // 異常に長いqueryを拒否

  // 危険/不審なqueryパターン（URL scheme注入・private IP探索・prompt injection目的の指示文）。
  //   検索結果本文の検証ではなく、こちらから送信するquery文字列自体の入力検証。
  var SUSPICIOUS_QUERY_PATTERNS = [
    /\b(file|javascript|data|vbscript):/i,
    /\b(localhost|127\.0\.0\.1|0\.0\.0\.0|::1)\b/i,
    /\b10\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/,
    /\b172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}\b/,
    /\b192\.168\.\d{1,3}\.\d{1,3}\b/,
    /\b169\.254\.\d{1,3}\.\d{1,3}\b/,
    /ignore\s+(all\s+|the\s+)?(previous|above|prior)\s+instructions/i,
    /system\s*prompt/i,
    /you\s+are\s+now\b/i,
  ];

  // ── 公開API: 単一queryの検証（純粋関数） ──
  function validateSearchQuery(query) {
    var q = str(query);
    if (!q.trim()) return { ok: false, reason: 'empty_query' };
    if (q.length > MAX_QUERY_LENGTH) return { ok: false, reason: 'query_too_long' };
    for (var i = 0; i < SUSPICIOUS_QUERY_PATTERNS.length; i++) {
      if (SUSPICIOUS_QUERY_PATTERNS[i].test(q)) return { ok: false, reason: 'suspicious_pattern' };
    }
    return { ok: true, reason: null };
  }

  // ── 公開API: Search Plan配列を検証し、承認実行可能な件数まで絞り込む（純粋関数・fail-open） ──
  //   searches: [{category, query, reason}] 想定（呼び出し側の形式に寛容）。
  //   戻り値: { ok, limited:[{category,query,reason}], rejected:[{query,reason}], truncated } — 例外を投げない。
  function validateAndLimitSearches(searches) {
    var out = { ok: false, limited: [], rejected: [], truncated: false };
    try {
      var arr = Array.isArray(searches) ? searches : [];
      var valid = [];
      for (var i = 0; i < arr.length; i++) {
        var s = arr[i];
        var q = s && s.query;
        var v = validateSearchQuery(q);
        if (v.ok) {
          valid.push({
            category: (s && s.category != null) ? str(s.category) : null,
            query: str(q),
            reason: (s && s.reason != null) ? str(s.reason) : null,
          });
        } else {
          out.rejected.push({ query: (q != null ? str(q) : null), reason: v.reason });
        }
      }
      if (valid.length > MAX_QUERIES_PER_APPROVAL) {
        out.truncated = true;
        valid = valid.slice(0, MAX_QUERIES_PER_APPROVAL);
      }
      out.limited = valid;
      out.ok = valid.length > 0;
      return out;
    } catch (e) {
      return out; // fail-open: 検証中の例外でも空の拒否結果を返すのみ
    }
  }

  // ── 公開API: IADP Packageから External Evidence Search Planを生成（純粋関数・0円・LLM不使用） ──
  //   Market / Competition / Monetization の3カテゴリについて、既存IADP内容（採用ジャンル・
  //   既存evidenceStatus）から不足を判定し、queryを実データから組み立てる（固定文言のハードコードなし）。
  //   採用ジャンルが未確定の場合は空のPlanを返す（推測で候補を作らない）。
  function buildSearchPlan(iadpPackage) {
    var plan = { caseId: null, generatedAt: new Date().toISOString(), searches: [] };
    try {
      if (!isPlainObject(iadpPackage)) return plan;
      plan.caseId = iadpPackage.caseId != null ? str(iadpPackage.caseId) : null;

      var intel = isPlainObject(iadpPackage.intelligence) ? iadpPackage.intelligence : {};
      var adoption = isPlainObject(intel.adoptionDecision) ? intel.adoptionDecision : {};
      var adoptedId = adoption.adoptedCandidateId;
      if (!adoptedId) return plan;   // 採用案未確定 → Planを作らない（推測しない）

      var ccCands = (isPlainObject(intel.candidateComparison) && Array.isArray(intel.candidateComparison.candidates))
        ? intel.candidateComparison.candidates : [];
      var adoptedCC = null;
      for (var i = 0; i < ccCands.length; i++) { if (ccCands[i] && ccCands[i].candidateId === adoptedId) { adoptedCC = ccCands[i]; break; } }
      var genreId = adoptedCC ? str(adoptedCC.genreId) : '';

      var mrCands = (isPlainObject(intel.marketResearch) && Array.isArray(intel.marketResearch.candidates))
        ? intel.marketResearch.candidates : [];
      var mrEntry = null;
      for (var j = 0; j < mrCands.length; j++) { if (mrCands[j] && genreId && mrCands[j].genreId === genreId) { mrEntry = mrCands[j]; break; } }
      var genreName = (mrEntry && mrEntry.genreName) ? str(mrEntry.genreName) : (genreId || null);
      if (!genreName) return plan;   // ジャンル名を解決できない → 推測で検索語を作らない

      // Market Evidence
      if (!mrEntry || mrEntry.evidenceStatus === 'generated_hypothesis') {
        plan.searches.push({
          category: 'market',
          query: '日本 Instagram ' + genreName + ' 市場 2026',
          reason: '市場需要Evidence不足（AI仮説のみ）',
        });
      }

      // Competition Evidence
      var compByGenre = (isPlainObject(intel.competitorResearch) && Array.isArray(intel.competitorResearch.byGenre))
        ? intel.competitorResearch.byGenre : [];
      var compEntry = null;
      for (var k = 0; k < compByGenre.length; k++) { if (compByGenre[k] && genreId && compByGenre[k].genreId === genreId) { compEntry = compByGenre[k]; break; } }
      if (!compEntry || compEntry.evidenceStatus === 'generated_hypothesis') {
        plan.searches.push({
          category: 'competition',
          query: 'Instagram ' + genreName + ' アフィリエイト 競合 日本',
          reason: '競合Evidence不足（AI仮説のみ）',
        });
      }

      // Monetization Evidence
      var autoGen = (isPlainObject(intel.aspProductResearch) && isPlainObject(intel.aspProductResearch.autoGenerated))
        ? intel.aspProductResearch.autoGenerated : null;
      if (!autoGen || autoGen.evidenceStatus === 'generated_hypothesis') {
        plan.searches.push({
          category: 'monetization',
          query: 'A8.net ' + genreName + ' Instagram アフィリエイト',
          reason: '収益化Evidence不足（AI仮説のみ）',
        });
      }

      return plan;
    } catch (e) {
      return plan; // fail-open: 生成失敗でも空Plan（呼び出し側を止めない）
    }
  }

  // ══════════════════════════════════════════════════════════════
  // EEA-4: Evidence Normalization & Persistence 補助（すべて純関数・fail-open）
  //   実際の正本書き込み（_intelCreateEvidence / _intelAddEvidence / _intelSaveContext）は
  //   index.html側（Evidence正本・Output Draftの実体を持つ場所）が行う。ここでは
  //   「どのsourceNameを使うか」「重複か否か」の判定材料のみを提供する。
  // ══════════════════════════════════════════════════════════════
  var MAX_EVIDENCE_PER_BATCH = 5;   // 1回の承認・保存で正本へ追加するEvidence上限（既存Evidenceを押し出さない）

  // sourceUrlからPublisher候補（正規化hostname／eTLD+1相当）を安全に導出する。
  //   会社名等の推測は行わない。'www.'のみ除去し、それ以外は加工しない。解析失敗時はnull（推測しない）。
  function deriveSourceNameFromUrl(url) {
    try {
      var u = str(url).trim();
      if (!u) return null;
      var parsed = new URL(u);
      var host = parsed.hostname.toLowerCase();
      if (host.indexOf('www.') === 0) host = host.slice(4);
      return host || null;
    } catch (e) {
      return null; // 不正URL・URL未対応環境では推測せずnull
    }
  }

  // 既存Evidence一覧に対し、候補が重複か判定する（caseId＋sourceUrl＋query/categoryの組み合わせ）。
  //   sourceMethod:'web_retrieved' のEvidenceのみを比較対象とし、既存Affiliate Evaluation等
  //  （user_input/calculated等）とは絶対に同一視しない。
  function isDuplicateEvidence(existingList, candidate) {
    try {
      if (!Array.isArray(existingList) || !isPlainObject(candidate) || !candidate.sourceUrl) return false;
      var url = str(candidate.sourceUrl).trim();
      if (!url) return false;
      var query = str(candidate.query || '').trim();
      var category = str(candidate.category || '').trim();
      for (var i = 0; i < existingList.length; i++) {
        var e = existingList[i];
        if (!e || e.sourceMethod !== 'web_retrieved') continue;   // 既存Affiliate Evaluation Evidence等は対象外
        if (str(e.sourceUrl).trim() !== url) continue;
        var eQuery = str(e.query || '').trim();
        var eCategory = str(e.category || '').trim();
        if (query) { if (eQuery === query) return true; else continue; }
        if (category) { if (eCategory === category) return true; else continue; }
        return true;   // query/categoryどちらも無くURLのみ一致 → 安全側で重複扱い
      }
      return false;
    } catch (e) {
      return false; // fail-open: 判定失敗時は「重複ではない」扱い（保存を止めない。実害は上位のEvidence上限が抑止）
    }
  }

  // ══════════════════════════════════════════════════════════════
  // EEA-6: Source Trust / Independent Source / Verified昇格（すべて純関数・fail-open）
  //
  //   目的: 「Webから取得できた」だけでVerifiedにしない。Trust Tier×claim種別×Independent Source数
  //   の組み合わせでのみVerified昇格を許可する評価関数を提供する。この関数群は判定結果を返すのみで、
  //   実EvidenceのverificationStatusを書き換える副作用は一切持たない（昇格の実適用は呼び出し側の責務）。
  //
  //   不明ドメインは絶対に「公式」と推測しない: Tier3（メーカー・サービス公式）／Tier6（業界専門媒体）は
  //   ドメインパターンだけでは判定できないため、既定では検出しない（常にTier7へフォールバック）。
  //   呼び出し側が案件固有の公式ドメインを把握している場合のみ options.officialDomains /
  //   options.industryDomains で明示指定でき、その場合に限りTier3/6と判定する。
  // ══════════════════════════════════════════════════════════════
  var SOURCE_TRUST_TIERS = {
    1: { label: '官公庁・公的機関',               reliability: 'high' },
    2: { label: 'ASP公式',                         reliability: 'high' },
    3: { label: 'メーカー・サービス公式',           reliability: 'high' },
    4: { label: 'プラットフォーム公式',             reliability: 'high' },
    5: { label: '調査会社・証券取引所・企業IR等',   reliability: 'medium' },
    6: { label: '業界専門媒体',                     reliability: 'medium' },
    7: { label: '一般Webメディア',                  reliability: 'low' },
    8: { label: 'SNS投稿・掲示板・個人ブログ等',     reliability: 'low' },
  };

  // Tier1: 政府・公的機関ドメイン（.go.jp / .gov）
  var TIER1_GOV_SUFFIXES = ['go.jp', 'gov'];
  // Tier2: 主要ASP公式ドメイン（保守的な最小限のallowlist。未知のASPは含めない＝推測しない）
  var TIER2_ASP_DOMAINS = ['a8.net', 'afi-b.com', 'accesstrade.net', 'valuecommerce.ne.jp', 'felmat.net', 'rentracks.jp', 'moshimo.com'];
  // Tier4: 主要プラットフォームの公式コーポレート/ビジネス系サブドメインのみ（消費者向け本体ドメインは
  //   誰でも投稿可能なためTier8扱い。about.instagram.com等の公式発表・ビジネス文書のみTier4）
  var TIER4_PLATFORM_OFFICIAL_DOMAINS = ['about.fb.com', 'about.instagram.com', 'business.instagram.com', 'developers.facebook.com', 'openai.com', 'platform.openai.com', 'ai.google', 'blog.google', 'about.google'];
  // Tier5: 証券取引所開示ドメイン（明示allowlist）。加えて.or.jp（公益法人・業界団体）は末尾一致で自動判定。
  var TIER5_EXCHANGE_DOMAINS = ['jpx.co.jp'];
  var TIER5_ORG_SUFFIX = 'or.jp';
  // Tier8: 既知のSNS/掲示板/ブログプラットフォーム（UGC中心のため一般ドメイン本体はここに分類）
  var TIER8_SNS_DOMAINS = ['reddit.com', 'twitter.com', 'x.com', 'facebook.com', 'instagram.com', 'threads.net', 'tiktok.com', 'ameblo.jp', 'hatenablog.com', 'hatenadiary.jp', 'fc2.com', 'livedoor.jp', 'note.com'];

  function _hostOf(url) {
    try {
      var u = str(url).trim();
      if (!u) return null;
      var host = new URL(u).hostname.toLowerCase();
      if (host.indexOf('www.') === 0) host = host.slice(4);
      return host || null;
    } catch (e) { return null; }
  }
  function _hostEquals(host, domain) {
    if (!host || !domain) return false;
    domain = String(domain).toLowerCase();
    return host === domain || host.slice(-(domain.length + 1)) === ('.' + domain);
  }
  function _hostEqualsAny(host, list) {
    for (var i = 0; i < list.length; i++) { if (_hostEquals(host, list[i])) return true; }
    return false;
  }

  // ── 公開API: sourceUrlからSource Trust Tierを判定する（純粋関数・ドメイン優先・fail-open） ──
  //   options: { officialDomains: string[]（案件固有の公式ドメイン・呼び出し側が明示指定した場合のみTier3）,
  //              industryDomains: string[]（業界専門媒体ドメイン・呼び出し側が明示指定した場合のみTier6） }
  //   戻り値: { tier, label, reliability, host, matchedBy } — tier: null は判定不能（sourceUrl欠落・解析失敗）
  function classifySourceTrust(sourceUrl, options) {
    var opts = isPlainObject(options) ? options : {};
    var host = _hostOf(sourceUrl);
    if (!host) return { tier: null, label: null, reliability: 'unknown', host: null, matchedBy: 'no_url_or_parse_error' };

    var tier = 7, matchedBy = 'default_fallback';   // 未知ドメインは既定でTier7（一般Web・low）＝推測で公式扱いしない
    if (TIER1_GOV_SUFFIXES.some(function (s) { return _hostEquals(host, s); })) { tier = 1; matchedBy = 'gov_suffix'; }
    else if (_hostEqualsAny(host, TIER2_ASP_DOMAINS)) { tier = 2; matchedBy = 'asp_allowlist'; }
    else if (_hostEqualsAny(host, TIER4_PLATFORM_OFFICIAL_DOMAINS)) { tier = 4; matchedBy = 'platform_official_allowlist'; }
    else if (_hostEqualsAny(host, TIER8_SNS_DOMAINS)) { tier = 8; matchedBy = 'sns_allowlist'; }
    else if (_hostEqualsAny(host, TIER5_EXCHANGE_DOMAINS)) { tier = 5; matchedBy = 'exchange_allowlist'; }
    else if (_hostEquals(host, TIER5_ORG_SUFFIX)) { tier = 5; matchedBy = 'or_jp_suffix'; }
    else if (_hostEqualsAny(host, opts.officialDomains || [])) { tier = 3; matchedBy = 'caller_official_domain'; }
    else if (_hostEqualsAny(host, opts.industryDomains || [])) { tier = 6; matchedBy = 'caller_industry_domain'; }

    var meta = SOURCE_TRUST_TIERS[tier];
    return { tier: tier, label: meta.label, reliability: meta.reliability, host: host, matchedBy: matchedBy };
  }

  // Publisher単位の独立ソースキー（sourceKeyOf()と同一優先順位: sourceName→sourceUrlのhostname→sourceReference）。
  //   iadpIntelligenceContext.js の sourceKeyOf() と判定基準を揃えるための evidenceAcquisition 側の実装
  //  （ファイル間の相互require依存を避けるため、あえてロジックを複製している。既存の自己完結モジュール方針と同じ）。
  function _publisherKeyOf(e) {
    var n = str(e && e.sourceName).trim();
    if (n) return 'name:' + n;
    var host = _hostOf(e && e.sourceUrl);
    if (host) return 'domain:' + host;
    var r = str(e && e.sourceReference).trim();
    if (r) return 'ref:' + r;
    return null;
  }

  // ── 公開API: claim種別に基づくVerified昇格可否の評価（純粋関数・副作用なし・判定結果を返すのみ） ──
  //   claimType: 'law_regulation'（法律・規約） | 'asp_official'（ASP公式案件・制度情報） |
  //              'market'（市場規模・トレンド） | 'competition'（競合状況）
  //   candidateEvidence: 判定対象1件（{sourceUrl, sourceName, sourceReference, ...}）
  //   relatedEvidenceList: 同一claim（呼び出し側が同一category/query等で事前に絞り込んだもの）の他Evidence群。
  //     Independent Source集計にのみ使用する（market/competitionのみ参照。法律・ASP公式は単独判定のため無視）。
  //   戻り値: { eligible, reason, tier, independentSourceCount } — eligible:trueでも、実際の
  //     verificationStatus書き換えは呼び出し側の責務（本関数は判定するのみ・何も保存しない）。
  function evaluateVerifiedPromotion(claimType, candidateEvidence, relatedEvidenceList) {
    var result = { eligible: false, reason: null, tier: null, independentSourceCount: 0 };
    try {
      if (!isPlainObject(candidateEvidence) || !candidateEvidence.sourceUrl) { result.reason = 'no_source_url'; return result; }
      var trust = classifySourceTrust(candidateEvidence.sourceUrl);
      result.tier = trust.tier;
      if (trust.tier === null) { result.reason = 'trust_unclassifiable'; return result; }
      if (trust.tier === 8) { result.reason = 'tier8_forbidden'; return result; }          // SNS/掲示板/個人ブログは常に禁止

      if (claimType === 'law_regulation') {
        if (trust.tier === 1 || trust.tier === 4) { result.eligible = true; result.reason = 'tier1_or_4_official_single_source_ok'; }
        else { result.reason = 'law_regulation_requires_tier1_or_4'; }
        return result;
      }
      if (claimType === 'asp_official') {
        if (trust.tier === 2) { result.eligible = true; result.reason = 'tier2_asp_official_single_source_ok'; }
        else { result.reason = 'asp_official_requires_tier2'; }
        return result;
      }
      if (claimType === 'market' || claimType === 'competition') {
        if (trust.tier === 7) { result.reason = 'tier7_general_media_single_source_forbidden'; return result; }
        if (trust.tier < 1 || trust.tier > 6) { result.reason = 'tier_out_of_range_for_market_or_competition'; return result; }
        var keys = {};
        var candKey = _publisherKeyOf(candidateEvidence);
        if (candKey) keys[candKey] = true;
        var related = Array.isArray(relatedEvidenceList) ? relatedEvidenceList : [];
        for (var i = 0; i < related.length; i++) {
          var re = related[i];
          if (!re || !re.sourceUrl) continue;
          var rt = classifySourceTrust(re.sourceUrl);
          if (rt.tier === null || rt.tier < 1 || rt.tier > 6) continue;   // Tier7/8・判定不能のsourceは独立source数に含めない
          var k = _publisherKeyOf(re);
          if (k) keys[k] = true;
        }
        result.independentSourceCount = Object.keys(keys).length;
        if (result.independentSourceCount >= 2) { result.eligible = true; result.reason = 'two_or_more_independent_sources_tier1to6'; }
        else { result.reason = 'insufficient_independent_sources'; }
        return result;
      }
      result.reason = 'unknown_or_unsupported_claim_type';   // 未定義のclaim種別はVerified禁止（安全側）
      return result;
    } catch (e) {
      result.reason = 'exception:' + (e && e.message);
      return result; // fail-open: 例外時もeligible:falseのまま（誤ってVerified側へ倒さない）
    }
  }

  // ══════════════════════════════════════════════════════════════
  // EEA-7①: Trust Tier優先Evidence Selection（純粋関数・fail-open）
  //
  //   目的: MAX_EVIDENCE_PER_BATCHを「先頭N件」ではなく「重複除外→Trust Tier優先の安定ソート→
  //   上限適用」の順で選定する。新しいTrust判定Engineは作らず既存classifySourceTrust()を再利用する。
  //   verificationStatusには一切関与しない（選定されたCandidateも従来どおり呼び出し側がunverifiedで
  //   保存する。Tierが高い＝自動Verifiedではない）。
  // ══════════════════════════════════════════════════════════════
  var UNCLASSIFIABLE_TIER_SORT_RANK = 999;   // tier:null（判定不能）は最下位（Tier8よりも後ろ）へ

  // 既存 isDuplicateEvidence() をそのまま再利用し、candidates配列内の重複（同一sourceUrl×query/category）も
  //   既存Evidenceとの重複と同じ基準で検出する（新しい重複判定基準は作らない）。
  //   順序: ①重複除外（既存Evidence＋バッチ内） → ②Trust Tier評価 → ③同Tier内は元順序を保持する安定ソート
  //        → ④MAX_EVIDENCE_PER_BATCH（またはmaxCount）で上限適用。
  //   この順序が既存Duplicate Check契約上安全な理由: isDuplicateEvidence()自体は変更しておらず、
  //   呼び出すタイミングを「先頭N件に切り詰めた後」から「全候補に対して」へ早めただけであるため、
  //   重複の定義（EEA-4契約）は一切変わらない。むしろ旧実装（先頭N件を切ってから重複除外）では
  //   重複を除外した結果N件未満しか保存されないことがあったが、本関数はN件に達するまで次点候補を
  //   繰り上げられるため、Duplicate Check契約を壊さずに選定精度のみ改善する。
  function selectEvidenceCandidates(candidates, existingEvidenceList, maxCount) {
    var result = { selected: [], skippedDuplicate: [], rejectedNoUrl: [], totalCandidates: 0 };
    try {
      var arr = Array.isArray(candidates) ? candidates : [];
      result.totalCandidates = arr.length;
      var existing = Array.isArray(existingEvidenceList) ? existingEvidenceList : [];
      var max = (typeof maxCount === 'number' && maxCount > 0) ? maxCount : MAX_EVIDENCE_PER_BATCH;

      // ① 重複除外（既存Evidence＋バッチ内の先行候補の両方を対象に、既存isDuplicateEvidence()で判定）
      var dedupPool = existing.slice();
      var deduped = [];
      for (var i = 0; i < arr.length; i++) {
        var c = arr[i];
        if (!c || !c.sourceUrl) { result.rejectedNoUrl.push(c); continue; }
        if (isDuplicateEvidence(dedupPool, c)) { result.skippedDuplicate.push(c); continue; }
        deduped.push({ c: c, idx: deduped.length });
        // 後続候補との重複判定にも使えるよう、擬似的にweb_retrieved形式でpoolへ積む（正本へは書き込まない）
        dedupPool = dedupPool.concat([{ sourceMethod: 'web_retrieved', sourceUrl: c.sourceUrl, query: c.query, category: c.category }]);
      }

      // ② Trust Tier評価 → ③ 安定ソート（Tier昇順。同Tier内は元のバッチ内順序=idxを維持）
      deduped.forEach(function (item) { item.tier = classifySourceTrust(item.c.sourceUrl).tier; });
      deduped.sort(function (a, b) {
        var ta = (a.tier === null || a.tier === undefined) ? UNCLASSIFIABLE_TIER_SORT_RANK : a.tier;
        var tb = (b.tier === null || b.tier === undefined) ? UNCLASSIFIABLE_TIER_SORT_RANK : b.tier;
        if (ta !== tb) return ta - tb;
        return a.idx - b.idx;   // 同Tier内は安定（元の検索結果順）
      });

      // ④ 上限適用
      result.selected = deduped.slice(0, max).map(function (item) { return item.c; });
      return result;
    } catch (e) {
      return result; // fail-open: 選定失敗時は空配列（呼び出し側を止めない。保存0件になるだけで安全側）
    }
  }

  // ══════════════════════════════════════════════════════════════
  // EEA-7②: Category Coverage（純粋関数・fail-open）
  //
  //   Search Plan正式カテゴリ（market/competition/monetization）についてEvidenceの充足状況を可視化する。
  //   Coverageは「存在するかどうか」の可視化のみであり、Account Creation Ready / Evidence sufficient /
  //   Quality Gateへの昇格判断には一切使用しない（既存Gate閾値 MIN_VERIFIED_EVIDENCE /
  //   MIN_INDEPENDENT_SOURCES は本関数からは一切参照・変更しない）。
  //   評価対象は evidenceType:'web_retrieved' のEvidenceのみ（category/queryはEEA-4以降でのみ付与される
  //   フィールドのため。既存Affiliate Evaluation Evidence等は対象外＝混同しない）。
  // ══════════════════════════════════════════════════════════════
  var CATEGORY_COVERAGE_CATEGORIES = ['market', 'competition', 'monetization'];

  function evaluateCategoryCoverage(evidenceList) {
    var result = { categories: {}, coveredCategories: [], missingCategories: [] };
    try {
      CATEGORY_COVERAGE_CATEGORIES.forEach(function (cat) {
        result.categories[cat] = { totalCount: 0, verifiedCount: 0, unverifiedCount: 0, independentSourceCount: 0 };
      });
      var list = Array.isArray(evidenceList) ? evidenceList : [];
      var srcKeysByCategory = { market: {}, competition: {}, monetization: {} };

      for (var i = 0; i < list.length; i++) {
        var e = list[i];
        if (!isPlainObject(e)) continue;
        if (e.evidenceType !== 'web_retrieved') continue;   // Category CoverageはWeb Evidenceのみ対象
        var cat = str(e.category);
        if (CATEGORY_COVERAGE_CATEGORIES.indexOf(cat) === -1) continue;   // 未定義カテゴリは対象外
        var bucket = result.categories[cat];
        bucket.totalCount++;
        // EEA-6契約を維持: verified/user_verifiedのみ検証済み。unverifiedは明示的にunverifiedCountへ
        //  （勝手にverified扱いしない）。
        if (e.verificationStatus === 'verified' || e.verificationStatus === 'user_verified') {
          bucket.verifiedCount++;
          var key = _publisherKeyOf(e);
          if (key) srcKeysByCategory[cat][key] = true;
        } else {
          bucket.unverifiedCount++;
        }
      }
      CATEGORY_COVERAGE_CATEGORIES.forEach(function (cat) {
        result.categories[cat].independentSourceCount = Object.keys(srcKeysByCategory[cat]).length;
        if (result.categories[cat].totalCount > 0) result.coveredCategories.push(cat);
        else result.missingCategories.push(cat);
      });
      return result;
    } catch (e) {
      return result; // fail-open
    }
  }

  // ── 公開API① Web Search request bodyの構築（純粋関数・APIキーを含まない） ──
  //   query: 検索クエリ文字列
  //   options: { model（必須相当・呼び出し側が明示指定）, searchContextSize（既定'low'）, max_output_tokens }
  //   戻り値: POST https://api.openai.com/v1/responses へそのまま渡せるbody
  function buildWebSearchRequestBody(query, options) {
    var opts = isPlainObject(options) ? options : {};
    var searchContextSize = opts.searchContextSize || 'low';   // 初期値は必ずlow（highは使用しない）
    var body = {
      model: opts.model,
      input: str(query),
      tools: [{ type: 'web_search', search_context_size: searchContextSize }],
      tool_choice: 'auto',
      // action.sources を確実に受け取るための公式includeパラメータ（省略すると欠落し得る）
      include: ['web_search_call.action.sources'],
    };
    if (opts.max_output_tokens) body.max_output_tokens = opts.max_output_tokens;
    return body;
  }

  // ── 公開API② Web Search response（response.data）の解析（純粋関数・fail-open） ──
  //   web_search_call.action.query / action.sources[] と、
  //   message.content[].annotations[]（type:'url_citation'）の両方から source を収集する
  //   （action.sourcesはinclude指定時のみ返る仕様のため、annotationsを補完として扱う）。
  //   存在しないfield（publishedDate等）は推測生成せず含めない。
  function parseWebSearchResponse(responseData) {
    var result = {
      version: ADAPTER_VERSION, query: null, sources: [],
      hasWebSearchCall: false, toolCallCount: 0, usage: null, parseError: null,
    };
    try {
      if (!isPlainObject(responseData)) { result.parseError = 'response_not_object'; return result; }
      result.usage = isPlainObject(responseData.usage) ? responseData.usage : null;

      var output = Array.isArray(responseData.output) ? responseData.output : [];
      var seenUrls = {};
      function addSource(url, title) {
        var u = str(url).trim();
        if (!u || seenUrls[u]) return;          // URL重複排除（同一URLは1件のみ）
        seenUrls[u] = true;
        result.sources.push({ url: u, title: (title != null && str(title).trim()) ? str(title).trim() : null });
      }

      for (var i = 0; i < output.length; i++) {
        var item = output[i];
        if (!isPlainObject(item)) continue;

        if (item.type === 'web_search_call') {
          result.hasWebSearchCall = true;
          result.toolCallCount++;
          var action = isPlainObject(item.action) ? item.action : {};
          if (!result.query && typeof action.query === 'string' && action.query.trim()) result.query = action.query;
          var actionSources = Array.isArray(action.sources) ? action.sources : [];
          for (var s = 0; s < actionSources.length; s++) {
            var src = actionSources[s];
            if (isPlainObject(src)) addSource(src.url, src.title);
          }
        } else if (item.type === 'message') {
          var content = Array.isArray(item.content) ? item.content : [];
          for (var c = 0; c < content.length; c++) {
            var block = content[c];
            if (!isPlainObject(block) || !Array.isArray(block.annotations)) continue;
            for (var a = 0; a < block.annotations.length; a++) {
              var ann = block.annotations[a];
              if (isPlainObject(ann) && ann.type === 'url_citation') addSource(ann.url, ann.title);
            }
          }
        }
      }
      return result;
    } catch (e) {
      // fail-open: 解析失敗でも例外を投げず、収集済みの部分結果（空配列を含む）を返す
      result.parseError = String((e && e.message) || e);
      return result;
    }
  }

  // ── 公開API③ 解析結果 → Evidence Candidate配列（EEA-1 Evidence Schema互換・純粋関数） ──
  //   まだ正本（intelligenceContext.evidence[]）への書き込みは行わない。
  //   verificationStatus は常に 'unverified' 固定（Verified昇格は別工程の責務）。
  function buildEvidenceCandidatesFromWebSearch(parsed, context) {
    var candidates = [];
    try {
      if (!isPlainObject(parsed) || !Array.isArray(parsed.sources) || parsed.sources.length === 0) return candidates;
      var ctx = isPlainObject(context) ? context : {};
      var observedAt = new Date().toISOString();
      for (var i = 0; i < parsed.sources.length; i++) {
        var s = parsed.sources[i];
        if (!s || !s.url) continue;   // URLの無いsourceは候補化しない（推測補完しない）
        candidates.push({
          evidenceType:       CANDIDATE_EVIDENCE_TYPE,
          sourceUrl:          s.url,
          sourceTitle:        s.title || null,
          sourceName:         null,     // Publisher識別（sourceKeyOf拡張）は別工程の責務。ここでは推測しない
          sourceReference:    null,
          observedAt:         observedAt,
          verificationStatus: CANDIDATE_VERIFICATION_STATUS,
          createdBy:          CANDIDATE_CREATED_BY,
          sourceMethod:       CANDIDATE_SOURCE_METHOD,
          caseId:             ctx.caseId != null ? String(ctx.caseId) : null,
          notes:              null,
        });
      }
      return candidates;
    } catch (e) {
      // fail-open: 途中で例外が起きても、それまでに積んだ候補だけを返す（全損させない）
      return candidates;
    }
  }

  // ── 公開API④ ①〜③の一括ヘルパー（parse→normalizeをまとめて実行する薄いラッパー） ──
  function evidenceCandidatesFromWebSearchResponse(responseData, context) {
    var parsed = parseWebSearchResponse(responseData);
    var candidates = buildEvidenceCandidatesFromWebSearch(parsed, context);
    return { parsed: parsed, evidenceCandidates: candidates };
  }

  return {
    version: ADAPTER_VERSION,
    CANDIDATE_EVIDENCE_TYPE: CANDIDATE_EVIDENCE_TYPE,
    CANDIDATE_VERIFICATION_STATUS: CANDIDATE_VERIFICATION_STATUS,
    buildWebSearchRequestBody: buildWebSearchRequestBody,
    parseWebSearchResponse: parseWebSearchResponse,
    buildEvidenceCandidatesFromWebSearch: buildEvidenceCandidatesFromWebSearch,
    evidenceCandidatesFromWebSearchResponse: evidenceCandidatesFromWebSearchResponse,
    // EEA-3
    MAX_QUERIES_PER_APPROVAL: MAX_QUERIES_PER_APPROVAL,
    MAX_QUERY_LENGTH: MAX_QUERY_LENGTH,
    validateSearchQuery: validateSearchQuery,
    validateAndLimitSearches: validateAndLimitSearches,
    buildSearchPlan: buildSearchPlan,
    // EEA-4
    MAX_EVIDENCE_PER_BATCH: MAX_EVIDENCE_PER_BATCH,
    deriveSourceNameFromUrl: deriveSourceNameFromUrl,
    isDuplicateEvidence: isDuplicateEvidence,
    // EEA-6
    SOURCE_TRUST_TIERS: SOURCE_TRUST_TIERS,
    classifySourceTrust: classifySourceTrust,
    evaluateVerifiedPromotion: evaluateVerifiedPromotion,
    // EEA-7
    CATEGORY_COVERAGE_CATEGORIES: CATEGORY_COVERAGE_CATEGORIES,
    selectEvidenceCandidates: selectEvidenceCandidates,
    evaluateCategoryCoverage: evaluateCategoryCoverage,
  };
});
