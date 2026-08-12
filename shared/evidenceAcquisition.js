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
  };
});
