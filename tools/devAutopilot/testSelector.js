'use strict';
// tools/devAutopilot/testSelector.js
// Development Autopilot V1 — Step 1: Test Safety Manifest の検証 ＋ 変更ファイルからの test 選択
//
//   Contract:
//     changed files → candidate discovery → manifest lookup
//       → safe だけ selected / conditional・forbidden・未登録は skippedUnsafe（理由つき・silent skip なし）
//   ★ test を実行しない（選ぶだけ）。fs は read-only（readFile / listRootTests は注入可能）。
//   ★ network / env / DB / provider / server に依存しない。
//   ★ 判定不能・入力異常は fail-closed（selected を空にし requiresHumanApproval=true）。

var fs = require('fs');
var path = require('path');

var CLASSIFICATIONS = ['safe', 'conditional', 'forbidden'];

// Safety Freeze で確定した常時候補（manifest 上 safe であることが必須）
var BASELINE_TESTS = Object.freeze([
  'indexInlineScriptSafety.test.js',
  'staticExposureBoundary.test.js',
  'apiAuthBoundary.test.js',
  'outputDraftAuth.test.js',
]);

// Autopilot の自動実行を禁止するコマンド（test manifest 外の Safety Contract）
var RESERVED_FORBIDDEN_COMMANDS = Object.freeze([
  { pattern: /(^|\s)npm(\.cmd)?\s+(run\s+)?dev-check\b/i, reason: 'dev-check は server を再起動し Production DB へ接続し得る' },
  { pattern: /dev-check\.ps1/i, reason: 'dev-check は server を再起動し Production DB へ接続し得る' },
  { pattern: /(^|\s)npm(\.cmd)?\s+(test|t)\b/i, reason: 'wildcard / auto discovery の test 実行は禁止（ファイル名明示のみ）' },
  { pattern: /(^|\s)node\s+--test\b/i, reason: 'auto discovery の test 実行は禁止（ファイル名明示のみ）' },
  { pattern: /(^|\s)node\s+(\.\/)?server(\.js)?(\s|$)/i, reason: 'server 起動は Production DB へ接続し得る' },
]);

function isForbiddenCommand(cmd) {
  if (typeof cmd !== 'string' || !cmd.trim()) return { forbidden: true, reason: 'invalid_command' };
  for (var i = 0; i < RESERVED_FORBIDDEN_COMMANDS.length; i++) {
    if (RESERVED_FORBIDDEN_COMMANDS[i].pattern.test(cmd)) return { forbidden: true, reason: RESERVED_FORBIDDEN_COMMANDS[i].reason };
  }
  return { forbidden: false, reason: null };
}

function _norm(p) {
  if (typeof p !== 'string') return null;
  var s = p.trim().replace(/\\/g, '/');
  while (s.indexOf('./') === 0) s = s.slice(2);
  if (!s || /^[a-zA-Z]:/.test(s) || s.charAt(0) === '/' || s.split('/').some(function (x) { return x === '..' || x === ''; })) return null;
  return s;
}

function isTestFile(p) { return typeof p === 'string' && /^[^\/]+\.test\.js$/.test(p); }

// repo root 直下の *.test.js（repo 規約）を列挙
function listRootTests(repoRoot) {
  return fs.readdirSync(repoRoot).filter(function (f) { return /\.test\.js$/.test(f); }).sort();
}

function loadTestManifest(manifestPath) {
  var p = manifestPath || path.join(__dirname, 'testManifest.json');
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

// ── manifest validation（deterministic）──────────────────────
//   repoTests: repo に実在する test file 名の配列
function validateTestManifest(manifest, repoTests) {
  var errors = [];
  if (!manifest || typeof manifest !== 'object' || !Array.isArray(manifest.tests)) {
    return { ok: false, errors: ['manifest_invalid'], counts: null };
  }
  if (!Array.isArray(repoTests)) return { ok: false, errors: ['repo_tests_invalid'], counts: null };
  var seen = {};
  var counts = { total: 0, safe: 0, conditional: 0, forbidden: 0 };
  manifest.tests.forEach(function (t, i) {
    if (!t || typeof t !== 'object') { errors.push('entry_invalid:' + i); return; }
    if (typeof t.file !== 'string' || !isTestFile(t.file)) { errors.push('file_invalid:' + i); return; }
    if (seen[t.file]) errors.push('duplicate:' + t.file);
    seen[t.file] = true;
    if (CLASSIFICATIONS.indexOf(t.class) === -1) errors.push('classification_invalid:' + t.file);
    if (typeof t.reason !== 'string' || !t.reason.trim()) errors.push('reason_missing:' + t.file);
    if (t.class === 'conditional' && (!Array.isArray(t.conditions) || t.conditions.length === 0
        || t.conditions.some(function (c) { return typeof c !== 'string' || !c.trim(); }))) {
      errors.push('conditions_missing:' + t.file);
    }
    counts.total++;
    if (counts[t.class] !== undefined) counts[t.class]++;
  });
  repoTests.forEach(function (f) { if (!seen[f]) errors.push('missing_entry:' + f); });
  Object.keys(seen).forEach(function (f) { if (repoTests.indexOf(f) === -1) errors.push('nonexistent_entry:' + f); });
  var exp = manifest.expected;
  if (!exp || typeof exp !== 'object') errors.push('expected_missing');
  else ['total', 'safe', 'conditional', 'forbidden'].forEach(function (k) {
    if (exp[k] !== counts[k]) errors.push('expected_mismatch:' + k + ':' + exp[k] + '!=' + counts[k]);
  });
  BASELINE_TESTS.forEach(function (b) {
    var e = manifest.tests.filter(function (t) { return t && t.file === b; })[0];
    if (!e || e.class !== 'safe') errors.push('baseline_not_safe:' + b);
  });
  return { ok: errors.length === 0, errors: errors, counts: counts };
}

// ── candidate discovery ─────────────────────────────────────
var REQ_RE = /require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

function _resolveLocal(fromRel, spec, exists) {
  var base = path.posix.normalize(path.posix.join(path.posix.dirname(fromRel), spec));
  var cands = [base, base + '.js', base + '/index.js'];
  for (var i = 0; i < cands.length; i++) { if (exists(cands[i])) return cands[i]; }
  return null;
}

// test から local require を 1 段ずつ静的に辿る（node_modules は辿らない・上限つき）
function _closure(testFile, io, maxFiles) {
  var seen = {}, queue = [testFile], out = [];
  while (queue.length && out.length < maxFiles) {
    var f = queue.shift();
    if (seen[f]) continue;
    seen[f] = true;
    var src = io.readFile(f);
    if (typeof src !== 'string') continue;
    if (f !== testFile) out.push(f);
    var m; REQ_RE.lastIndex = 0;
    while ((m = REQ_RE.exec(src))) {
      var s = m[1];
      if (s.indexOf('./') !== 0 && s.indexOf('../') !== 0) continue;
      var r = _resolveLocal(f, s, io.exists);
      if (r && r.indexOf('node_modules/') === -1 && !seen[r]) queue.push(r);
    }
  }
  return out;
}

function _defaultIo(repoRoot) {
  return {
    readFile: function (rel) { try { return fs.readFileSync(path.join(repoRoot, rel), 'utf8'); } catch (e) { return null; } },
    exists: function (rel) { try { return fs.statSync(path.join(repoRoot, rel)).isFile(); } catch (e) { return false; } },
  };
}

// 公開 API:
//   input: { changedFiles: string[], manifest, repoTests?: string[], repoRoot?, io?: {readFile, exists}, maxClosureFiles? }
//   戻り値: { selected[], skippedUnsafe[], uncoveredFiles[], requiresHumanApproval, humanApprovalReasons[], errors[] }
function selectTests(input) {
  var res = { selected: [], skippedUnsafe: [], uncoveredFiles: [], requiresHumanApproval: false, humanApprovalReasons: [], errors: [] };
  function failClosed(err) {
    res.selected = []; res.errors.push(err); res.requiresHumanApproval = true;
    if (res.humanApprovalReasons.indexOf('selector_error') === -1) res.humanApprovalReasons.push('selector_error');
    return res;
  }
  try {
    if (!input || typeof input !== 'object') return failClosed('invalid_input');
    if (!Array.isArray(input.changedFiles) || input.changedFiles.length === 0) return failClosed('changed_files_missing');
    var changed = input.changedFiles.map(_norm);
    if (changed.some(function (c) { return c === null; })) return failClosed('changed_file_invalid');
    var repoRoot = input.repoRoot || path.resolve(__dirname, '..', '..');
    var io = input.io || _defaultIo(repoRoot);
    var repoTests = Array.isArray(input.repoTests) ? input.repoTests.slice() : listRootTests(repoRoot);

    var v = validateTestManifest(input.manifest, repoTests);
    if (!v.ok) {
      // 変更で新しく追加された test が manifest 未登録なのは「未登録 candidate」として後段で扱う。それ以外は fail-closed。
      var fatal = v.errors.filter(function (e) {
        var m = /^missing_entry:(.+)$/.exec(e);
        if (m && changed.indexOf(m[1]) !== -1) return false;
        return !/^expected_mismatch:/.test(e) || !changed.some(isTestFile);
      });
      if (fatal.length) { fatal.forEach(function (e) { res.errors.push(e); }); return failClosed('manifest_invalid'); }
    }
    var byFile = {};
    input.manifest.tests.forEach(function (t) { byFile[t.file] = t; });

    var maxFiles = typeof input.maxClosureFiles === 'number' ? input.maxClosureFiles : 400;
    var candidates = {};   // file -> { reasons: [], coveredChanged: [] }
    function addCand(file, reason, changedFile) {
      if (!candidates[file]) candidates[file] = { reasons: [], coveredChanged: [] };
      if (candidates[file].reasons.indexOf(reason) === -1) candidates[file].reasons.push(reason);
      if (changedFile && candidates[file].coveredChanged.indexOf(changedFile) === -1) candidates[file].coveredChanged.push(changedFile);
    }

    var allTests = repoTests.slice();
    changed.forEach(function (c) { if (isTestFile(c) && allTests.indexOf(c) === -1) allTests.push(c); });

    // Method 0: 変更された test 自身 / Autopilot の test（tools/devAutopilot/** 変更時は devAutopilot*.test.js）
    changed.forEach(function (c) {
      if (isTestFile(c)) addCand(c, 'changed_test', c);
      if (c.indexOf('tools/devAutopilot/') === 0) {
        allTests.filter(function (t) { return /^devAutopilot.*\.test\.js$/.test(t); })
          .forEach(function (t) { addCand(t, 'autopilot_test_mapping', c); });
      }
    });

    allTests.forEach(function (t) {
      var src = io.readFile(t);
      if (typeof src !== 'string') { res.errors.push('test_unreadable:' + t); return; }
      // Method 1: 変更 path / basename の文字列参照
      changed.forEach(function (c) {
        if (c === t) return;
        var base = c.split('/').pop();
        if (src.indexOf(c) !== -1) addCand(t, 'references_path', c);
        else if (base && src.indexOf(base) !== -1) addCand(t, 'references_basename', c);
      });
      // Method 2: 直接 require を 1 段ずつ辿って到達
      var clo = _closure(t, io, maxFiles);
      changed.forEach(function (c) { if (c !== t && clo.indexOf(c) !== -1) addCand(t, 'require_closure', c); });
    });
    if (res.errors.length) return failClosed('test_unreadable');

    // Baseline（manifest 上 safe が必須）
    BASELINE_TESTS.forEach(function (b) {
      var e = byFile[b];
      if (!e || e.class !== 'safe') { res.errors.push('baseline_not_safe:' + b); return; }
      addCand(b, 'baseline', null);
    });
    if (res.errors.length) return failClosed('baseline_not_safe');

    Object.keys(candidates).sort().forEach(function (file) {
      var c = candidates[file];
      var e = byFile[file];
      if (!e) {
        res.skippedUnsafe.push({ file: file, classification: 'unlisted', reason: 'manifest 未登録の test（分類前は実行しない）', matchedBy: c.reasons, coveredChanged: c.coveredChanged });
      } else if (e.class === 'safe') {
        res.selected.push({ file: file, reasons: c.reasons, coveredChanged: c.coveredChanged });
      } else {
        res.skippedUnsafe.push({ file: file, classification: e.class, reason: e.reason, conditions: e.conditions || null, matchedBy: c.reasons, coveredChanged: c.coveredChanged });
      }
    });

    // coverage: コード変更ごとに baseline 以外の safe test が 1 本以上あるか
    changed.forEach(function (c) {
      if (/\.(md|txt)$/.test(c)) return;   // 説明文のみは coverage 対象外
      var covered = res.selected.some(function (s) { return s.coveredChanged.indexOf(c) !== -1; });
      if (!covered) res.uncoveredFiles.push(c);
    });
    if (res.uncoveredFiles.length) res.humanApprovalReasons.push('no_safe_test_for_changed_file');
    if (res.skippedUnsafe.length) res.humanApprovalReasons.push('unsafe_candidates_skipped');
    res.requiresHumanApproval = res.humanApprovalReasons.length > 0;
    return res;
  } catch (e) {
    return failClosed('selector_exception');
  }
}

module.exports = {
  CLASSIFICATIONS: CLASSIFICATIONS,
  BASELINE_TESTS: BASELINE_TESTS,
  RESERVED_FORBIDDEN_COMMANDS: RESERVED_FORBIDDEN_COMMANDS,
  isForbiddenCommand: isForbiddenCommand,
  isTestFile: isTestFile,
  listRootTests: listRootTests,
  loadTestManifest: loadTestManifest,
  validateTestManifest: validateTestManifest,
  selectTests: selectTests,
};
