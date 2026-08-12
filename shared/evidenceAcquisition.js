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
  };
});
