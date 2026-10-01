'use strict';
// tools/devAutopilot/transcriptCheck.js
// Development Autopilot V1 — Stage 4C S3：transcript の限定判定（純関数）
//
//   ★ fs / network / child_process / process.env を使わない。入力は transcript の文字列だけ。
//   ★ tool_use と tool_result を id で対応づけ、参照 path が worktree の内側かを判定する。本文・tool 入力・tool 結果・path 文字列は返さない
//     （返すのは件数・固定分類・正規化 JSON の SHA-256 だけ）。
//   ★ stage ごとに許可された tool（claudeRunner.STAGE_POLICY の tools）以外の呼び出しは未検証（unknown tool）。
//   ★ StructuredOutput は照合材料（入力の正規化 JSON の SHA-256）を抽出しても、判定は常に未検証（unverified_unknown_tool）のまま。
//     正規化 JSON の比較は「完全一致の確認」だけに使い、安全性・副作用不存在の証明とは扱わない。
//   ★ tool_use / tool_result とも ID の重複は記録不正（未検証）。~ で始まる path は展開の仕様を確認していないため判定不能とする。
//   ★ research での実測（Stage 4C Unit 2a / Unit 2）を design / implement / review の実証とは扱わない。

var path = require('path');
var crypto = require('crypto');

var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
var FILE_PATH_TOOLS = Object.freeze(['Read', 'Edit', 'Write']);       // file_path を取る tool
var SEARCH_TOOLS = Object.freeze(['Glob', 'Grep']);                 // path（省略時は cwd）と pattern を取る tool
var COUNTED = Object.freeze(['Read', 'Glob', 'Grep', 'StructuredOutput']);
var MAX_TEXT = 8 * 1024 * 1024;

function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

// keys を再帰的に整列した JSON（値の意味の比較用）
function canonicalJson(v) {
  if (Array.isArray(v)) return '[' + v.map(canonicalJson).join(',') + ']';
  if (_isObj(v)) return '{' + Object.keys(v).sort().map(function (k) { return JSON.stringify(k) + ':' + canonicalJson(v[k]); }).join(',') + '}';
  return JSON.stringify(v === undefined ? null : v);
}
function canonicalSha256(v) { return crypto.createHash('sha256').update(canonicalJson(v)).digest('hex'); }

// transcript 側の StructuredOutput 入力と envelope 側の structured_output の正規化 hash を比べる（完全一致の確認だけ）
function compareStructuredOutput(transcriptSha, envelopeSha, soCount) {
  if (!soCount) return 'not_present';
  if (soCount !== 1 || typeof transcriptSha !== 'string' || typeof envelopeSha !== 'string') return 'not_comparable';
  return transcriptSha === envelopeSha ? 'match' : 'mismatch';
}

// ── path 判定（Windows / POSIX(/c/...) 形式を同一視。判定不能は null）──
function normPath(p, baseDir) {
  if (typeof p !== 'string' || !p || p.indexOf('\0') !== -1) return null;
  var s = p.split('\\').join('/');
  if (s.indexOf('//') === 0) return null;                                          // UNC / rule 形式
  if (s.charAt(0) === '~') return null;                                            // ~ 展開の扱いは未確認 → 判定不能（worktree 内とみなさない）
  var m = /^\/([A-Za-z])(\/|$)/.exec(s); if (m) s = m[1] + ':/' + s.slice(3);
  if (/[*?[\]{}]/.test(s)) return null;                                            // ワイルドカードは判定不能
  if (!/^[A-Za-z]:\//.test(s)) { if (!baseDir) return null; s = baseDir.split('\\').join('/') + '/' + s; }
  return path.win32.resolve(s.split('/').join('\\')).split('\\').join('/').replace(/\/+$/, '').toLowerCase();
}
function isInside(p, dir) { return p === dir || p.indexOf(dir + '/') === 0; }
// glob パターン：相対（.. なし）は cwd 内。絶対なら最初のワイルドカードより前の静的 prefix が worktree 内
function globInside(pattern, wt) {
  if (typeof pattern !== 'string' || !pattern || pattern.indexOf('..') !== -1 || pattern.charAt(0) === '~') return null;
  if (!/^([A-Za-z]:|[\\/])/.test(pattern)) return true;
  var i = pattern.search(/[*?[\]{}]/);
  var prefix = i === -1 ? pattern : pattern.slice(0, i);
  var dir = prefix.replace(/[^\\/]*$/, '');
  var n = normPath(dir || prefix);
  return n === null ? null : isInside(n, wt);
}

function _target(name, input, wt, wtRoot) {
  if (!_isObj(input)) return 'unparseable';
  if (FILE_PATH_TOOLS.indexOf(name) !== -1) {
    var p = normPath(input.file_path, wtRoot);
    return p === null ? 'unparseable' : (isInside(p, wt) ? 'inside' : 'outside');
  }
  if (SEARCH_TOOLS.indexOf(name) !== -1) {
    if (input.path !== undefined) { var q = normPath(input.path, wtRoot); if (q === null) return 'unparseable'; if (!isInside(q, wt)) return 'outside'; }
    if (name === 'Glob') { var g = globInside(input.pattern, wt); if (g === null) return 'unparseable'; if (!g) return 'outside'; }
    if (name === 'Grep') {
      if (typeof input.pattern !== 'string' || !input.pattern) return 'unparseable';
      if (input.glob !== undefined) { var h = globInside(input.glob, wt); if (h === null) return 'unparseable'; if (!h) return 'outside'; }
    }
    return 'inside';
  }
  return 'not_file';
}

// opts: { sessionId, worktreeRoot, allowedTools[], expected?: { reads?: [worktree 相対 path], grep?: boolean } }
// 戻り値: { ok, summary:{ verdict, toolCounts, unparseable, outside, missingResults, errorResults, structuredOutputComparison:'not_present' },
//           structuredOutputCount, structuredOutputInputSha256, calls:[{ tool, target, result }] }（本文・path は含めない）
function analyzeTranscript(text, opts) {
  var o = _isObj(opts) ? opts : {};
  if (typeof o.sessionId !== 'string' || !UUID_RE.test(o.sessionId)) return { ok: false, error: 'session_id_invalid' };
  var wt = normPath(o.worktreeRoot);
  if (!wt || !/^[a-z]:\//.test(wt)) return { ok: false, error: 'worktree_root_invalid' };
  if (!Array.isArray(o.allowedTools) || !o.allowedTools.every(function (t) { return typeof t === 'string' && t; })) return { ok: false, error: 'allowed_tools_invalid' };
  var counts = { Read: 0, Glob: 0, Grep: 0, StructuredOutput: 0, other: 0 };
  var st = { unparseable: 0, outside: 0, missingResults: 0, errorResults: 0, unknownTools: 0, parseErrors: 0, sidechain: 0, foreign: 0, sessionLines: 0, orphanResults: 0, duplicateIds: 0 };
  var uses = [], byId = {}, results = {};
  var present = typeof text === 'string' && text.length > 0 && text.length <= MAX_TEXT;
  if (present) {
    text.split(/\r?\n/).forEach(function (ln) {
      if (!ln.trim()) return;
      var x; try { x = JSON.parse(ln); } catch (e) { st.parseErrors++; return; }
      if (!_isObj(x)) { st.parseErrors++; return; }
      if (x.isSidechain === true) st.sidechain++;
      if (typeof x.sessionId === 'string') { if (x.sessionId === o.sessionId) st.sessionLines++; else st.foreign++; }
      var content = _isObj(x.message) && Array.isArray(x.message.content) ? x.message.content : [];
      content.forEach(function (c) {
        if (!_isObj(c)) return;
        if (c.type === 'tool_use') {
          if (typeof c.id !== 'string' || !c.id || typeof c.name !== 'string') { st.unparseable++; return; }
          if (byId[c.id]) { st.duplicateIds++; return; }
          byId[c.id] = true; uses.push({ id: c.id, name: c.name, input: c.input });
        } else if (c.type === 'tool_result') {
          if (typeof c.tool_use_id !== 'string') { st.unparseable++; return; }
          if (results[c.tool_use_id]) { st.duplicateIds++; return; }                 // 同じ ID の結果の重複は拒否（先の結果を上書きしない）
          results[c.tool_use_id] = { isError: c.is_error === true };
        }
      });
    });
  }
  var calls = [], soInputs = [];
  uses.forEach(function (u) {
    var key = COUNTED.indexOf(u.name) !== -1 ? u.name : 'other';
    counts[key]++;
    var allowed = o.allowedTools.indexOf(u.name) !== -1 && u.name !== 'StructuredOutput';
    if (u.name === 'StructuredOutput') soInputs.push(u.input);
    if (!allowed) st.unknownTools++;
    var t = allowed ? _target(u.name, u.input, wt, o.worktreeRoot) : 'not_allowed';
    if (t === 'unparseable') st.unparseable++;
    if (t === 'outside') st.outside++;
    var r = results[u.id];
    if (!r) st.missingResults++; else if (r.isError) st.errorResults++;
    calls.push({ tool: key, target: t, result: r ? (r.isError ? 'error' : 'ok') : 'missing' });
  });
  Object.keys(results).forEach(function (id) { if (!byId[id]) st.orphanResults++; });
  var expectedMissing = false;
  var ex = _isObj(o.expected) ? o.expected : null;
  if (ex) {
    if (ex.grep === true && !uses.some(function (u) { return u.name === 'Grep' && results[u.id] && !results[u.id].isError && _target('Grep', u.input, wt, o.worktreeRoot) === 'inside'; })) expectedMissing = true;
    (Array.isArray(ex.reads) ? ex.reads : []).forEach(function (rel) {
      var want = normPath(rel, o.worktreeRoot);
      if (!uses.some(function (u) { return u.name === 'Read' && results[u.id] && !results[u.id].isError && _isObj(u.input) && normPath(u.input.file_path, o.worktreeRoot) === want; })) expectedMissing = true;
    });
  }
  var recordBad = !present || st.parseErrors || st.sidechain || st.foreign || !st.sessionLines || st.unparseable || st.missingResults || st.orphanResults || st.duplicateIds;
  var verdict = st.outside ? 'outside_reference_observed'
    : recordBad ? 'unverified_record_unparseable'
    : st.unknownTools ? 'unverified_unknown_tool'
    : st.errorResults ? 'unverified_tool_error'
    : expectedMissing ? 'unverified_expected_calls_missing'
    : 'ok';
  return {
    ok: true,
    summary: { verdict: verdict, toolCounts: counts, unparseable: st.unparseable + st.parseErrors + st.orphanResults + st.duplicateIds, outside: st.outside,
      missingResults: st.missingResults, errorResults: st.errorResults, structuredOutputComparison: 'not_present' },
    structuredOutputCount: soInputs.length,
    structuredOutputInputSha256: soInputs.length === 1 ? canonicalSha256(soInputs[0]) : null,
    // 条件付き判定（evaluateStructuredOutputConditional）の材料。本文は含めない
    structuredOutputDetail: {
      count: soInputs.length,
      isLastToolUse: uses.length > 0 && uses[uses.length - 1].name === 'StructuredOutput',
      resultOk: soInputs.length === 1 && uses.some(function (u) { return u.name === 'StructuredOutput' && results[u.id] && !results[u.id].isError; }),
      otherUnknownTools: uses.filter(function (u) { return u.name !== 'StructuredOutput' && o.allowedTools.indexOf(u.name) === -1; }).length,
      recordBad: !!recordBad, outside: st.outside, errorResults: st.errorResults, expectedMissing: expectedMissing,
    },
    calls: calls,
  };
}

// StructuredOutput の条件付き判定（既定では使わない。呼び出し側が Human 承認に束縛された方針でだけ呼ぶ）。
//   受け入れ条件：単一・最後の tool 呼び出し・正常な対応結果・schema 適合（envelope 側で検証済み）・envelope との正規化 hash 一致・
//   他の未知 tool なし・記録不正 / 外側参照 / tool エラー / 期待呼び出し欠落なし。CLI 版と SHA への束縛は呼び出し側で検査する。
//   ★ 受け入れは「記録の整合の確認」であり、安全性・副作用不存在の証明ではない。
function evaluateStructuredOutputConditional(analysis, input) {
  var r = [];
  var a = _isObj(analysis) && analysis.ok ? analysis : null;
  var i = _isObj(input) ? input : {};
  if (!a || !_isObj(a.structuredOutputDetail)) return { accepted: false, reasons: ['analysis_unavailable'] };
  var d = a.structuredOutputDetail;
  if (d.count !== 1) r.push('structured_output_not_single');
  if (!d.isLastToolUse) r.push('structured_output_not_last');
  if (!d.resultOk) r.push('structured_output_result_not_ok');
  if (i.schemaOk !== true) r.push('structured_output_schema_not_ok');
  if (compareStructuredOutput(a.structuredOutputInputSha256, i.envelopeSha256, d.count) !== 'match') r.push('structured_output_hash_not_match');
  if (d.otherUnknownTools !== 0) r.push('other_unknown_tools');
  if (d.recordBad || d.outside || d.errorResults || d.expectedMissing) r.push('transcript_not_clean');
  return { accepted: r.length === 0, reasons: r };
}

module.exports = {
  analyzeTranscript: analyzeTranscript,
  canonicalJson: canonicalJson,
  canonicalSha256: canonicalSha256,
  compareStructuredOutput: compareStructuredOutput,
  evaluateStructuredOutputConditional: evaluateStructuredOutputConditional,
  normPath: normPath,
};
