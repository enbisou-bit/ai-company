// indexInlineScriptSafety.test.js
// EVIDENCE-Q4 Hotfix 回帰テスト — index.html の inline script が「ブラウザと同じ条件で」実行可能であることを固定する。
//
//   背景（実際に本番で発生した事故）:
//     Q4（commit 917cf4d）で追加した _ceSanitizeExcerpt() の文字クラスへ、エスケープ表記ではなく
//     生の制御文字（0x00 / 0x08 / 0x0B / 0x0C / 0x0E-0x1F / 0x7F）がそのまま書き込まれた。
//     Node は生の制御文字をそのまま解釈するため、既存の「inline script を new vm.Script() で compile する」
//     形式のチェックはすべて PASS していた。
//     しかし HTML 仕様では、script 要素内の U+0000（NUL）は tokenizer が U+FFFD へ置換する。
//     その結果ブラウザ側では文字クラスが [U+FFFD-\u0008 ...] となり
//     「Invalid regular expression: Range out of order in character class」で
//     **その script ブロック全体が実行されず**、Content Evidence の全関数（_ceRenderPanel /
//     _ceStartPlanFromForm / _ceApproveAndExecute / buildContentEvidenceEntryHtml 等）が undefined になった。
//
//   このテストが固定する契約:
//     1. index.html に生の制御文字（tab / LF / CR 以外）を混入させない。
//     2. HTML tokenizer と同じ NUL→U+FFFD 置換を適用しても、全 inline script が syntax error なく compile できる。
//     3. Content Evidence の主要関数が、その条件下でも実際に定義される（undefined にならない）。
//     4. _ceSanitizeExcerpt() が制御文字を除去する振る舞い自体は維持されている。
//
//   read-only: このテストは index.html を読むだけで、ファイル・DB・ネットワークへ一切書き込まない。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = __dirname;
let passed = 0;
let failed = 0;
function assert(cond, label) {
  if (cond) { passed++; console.log('  ✅ ' + label); }
  else { failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const raw = fs.readFileSync(path.join(ROOT, 'index.html'));
const src = raw.toString('utf8');

// ══════════════════════════════════════════════════════════════
caseHeader('1. index.html に生の制御文字が存在しない（tab / LF / CR のみ許可）');
// ══════════════════════════════════════════════════════════════
const controlBytes = [];
for (let i = 0; i < raw.length; i++) {
  const c = raw[i];
  if ((c < 0x20 && c !== 0x09 && c !== 0x0a && c !== 0x0d) || c === 0x7f) {
    if (controlBytes.length < 20) controlBytes.push(i + ':0x' + c.toString(16));
  }
}
assert(controlBytes.length === 0, '1a. 生の制御文字 0 件（検出: ' + JSON.stringify(controlBytes) + '）');
assert(src.indexOf('\u0000') === -1, '1b. NUL（U+0000）を含まない');

// ══════════════════════════════════════════════════════════════
caseHeader('2. HTML tokenizer と同じ NUL→U+FFFD 置換後も inline script が compile できる');
// ══════════════════════════════════════════════════════════════
const scriptRe = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/gi;
const blocks = [];
let m;
while ((m = scriptRe.exec(src)) !== null) blocks.push(m[1]);
assert(blocks.length > 0, '2a. inline script を抽出できた（' + blocks.length + ' ブロック）');

let compileErrors = [];
blocks.forEach(function (code, idx) {
  // HTML 仕様: script data 中の U+0000 は U+FFFD へ置換される（ブラウザと同じ条件を再現する）
  const asBrowserSees = code.replace(/\u0000/g, '�');
  try { new vm.Script(asBrowserSees); }
  catch (e) { compileErrors.push('block#' + idx + ': ' + e.message); }
});
assert(compileErrors.length === 0, '2b. NUL 置換後も syntax error 0（' + JSON.stringify(compileErrors) + '）');

// 逆方向の検知力確認: 生の制御文字を含む文字クラスは、この検査で必ず落ちること
let detected = false;
try { new vm.Script('var re = /[\u0000-\u0008]/g;'.replace(/\u0000/g, '�')); }
catch (e) { detected = e instanceof SyntaxError; }
assert(detected === true, '2c. 検知力: NUL を含む文字クラスは置換後に SyntaxError となる（このテストが事故を検出できる）');

// ══════════════════════════════════════════════════════════════
caseHeader('3. Content Evidence パネルの関数が実際に定義される（undefined 化しない）');
// ══════════════════════════════════════════════════════════════
const ceStart = src.indexOf('var _ceState = ');
const ceEnd = src.indexOf('function buildContentEvidenceEntryHtml()');
assert(ceStart > 0 && ceEnd > ceStart, '3a. Content Evidence ブロックを特定できた');

const ceBlock = src.slice(ceStart, ceEnd).replace(/\u0000/g, '�');   // ブラウザと同じ条件
const sandbox = {
  escapeHtml: function (x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
  document: { getElementById: function () { return null; }, createElement: function () { return { style: {} }; }, querySelectorAll: function () { return []; } },
  URL: URL, console: console, Date: Date, Math: Math, JSON: JSON, Promise: Promise, setTimeout: setTimeout,
};
let ceLoadError = null;
try { vm.createContext(sandbox); vm.runInContext(ceBlock, sandbox); }
catch (e) { ceLoadError = e.message; }
assert(ceLoadError === null, '3b. ブロックが実行時エラーなく評価される（' + ceLoadError + '）');

[
  '_ceState', '_cePlan', '_ceLastEvidenceCandidates', '_ceMappingDecisions', '_ceVerifiedExcerpts',
].forEach(function (name) {
  assert(typeof sandbox[name] !== 'undefined', '3c. state が初期化される: ' + name);
});
[
  '_ceRenderPanel', '_ceApproveAndExecute', '_ceSubmitEvidenceForResolution',
  '_ceSanitizeExcerpt', '_ceSafeHttpUrl', '_ceVerifiedExcerptFor', '_ceSyncVerifiedExcerpt', '_ceLinkHrefAttr',
].forEach(function (name) {
  assert(typeof sandbox[name] === 'function', '3d. 関数が定義される: ' + name);
});

// ══════════════════════════════════════════════════════════════
caseHeader('4. _ceSanitizeExcerpt() の制御文字除去は維持されている');
// ══════════════════════════════════════════════════════════════
if (typeof sandbox._ceSanitizeExcerpt === 'function') {
  const dirty = 'A\u0000B\u0008C\u000BD\u000CE\u000EF\u001FG\u007FH';
  assert(sandbox._ceSanitizeExcerpt(dirty) === 'ABCDEFGH', '4a. 制御文字（NUL / BS / VT / FF / SO / US / DEL）を除去する');
  assert(sandbox._ceSanitizeExcerpt('  x  ') === 'x', '4b. trim する');
  assert(sandbox._ceSanitizeExcerpt('a\tb\nc') === 'a\tb\nc', '4c. tab / 改行は除去しない（原文の体裁を壊さない）');
  assert(sandbox._ceSanitizeExcerpt('y'.repeat(1500)).length === 1000, '4d. 上限 1000 文字で切り詰める');
  assert(sandbox._ceSanitizeExcerpt(null) === '' && sandbox._ceSanitizeExcerpt(undefined) === '', '4e. null / undefined は空文字');
} else {
  assert(false, '4. _ceSanitizeExcerpt が定義されていないため検証不能');
}

// ══════════════════════════════════════════════════════════════
caseHeader('5. 文字クラスはエスケープ表記で書かれている（生の制御文字へ戻さない）');
// ══════════════════════════════════════════════════════════════
const sanitizeIdx = src.indexOf('function _ceSanitizeExcerpt');
const sanitizeSrc = sanitizeIdx > 0 ? src.slice(sanitizeIdx, sanitizeIdx + 300) : '';
assert(/\\u0000-\\u0008/.test(sanitizeSrc), '5a. \\u0000-\\u0008 がエスケープ表記で書かれている');
assert(/\\u000E-\\u001F/.test(sanitizeSrc) && /\\u007F/.test(sanitizeSrc), '5b. \\u000E-\\u001F / \\u007F もエスケープ表記');

console.log('\n════════════════════════════════════');
console.log('結果: ' + passed + ' passed / ' + failed + ' failed');
console.log('════════════════════════════════════');
if (failed > 0) process.exit(1);
console.log('🟢 All index inline script safety cases passed (EVIDENCE-Q4 Hotfix)');
