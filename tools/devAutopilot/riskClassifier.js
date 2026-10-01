'use strict';
// tools/devAutopilot/riskClassifier.js
// Development Autopilot V1 — Step 1: deterministic Risk Classifier（AI 不使用・純関数）
//
//   目的: 将来 Autopilot が「変更予定のファイル」または「実差分」を評価し、
//         危険な変更を Runner / worktree を動かす前に止めるための判定器。
//
//   classification:
//     forbidden      … V1 では扱えない（outcome=blocked）
//     unknown        … 判定不能・入力異常（fail-closed → blocked）。auto へ fallback しない
//     human_required … 人の承認が必要（gate=human_approval_required）
//     auto           … 許可 scope 内で、上記いずれの rule にも該当しない
//   優先順位: forbidden > unknown > human_required > auto
//     （unknown は blocked 扱いのため human_required より強い）
//
//   ★ 純関数: fs / network / env / DB / provider / 時刻に依存しない。入力を変更しない。
//   ★ path rule と content rule を分離する（keyword だけで過剰判定しない）。
//   ★ content rule はコメント行を除外し、テスト fixture・説明文（*.test.js / *.md）では
//     文字列だけの destructive keyword を即 forbidden にしない（実行コンテキストのある rule は適用）。

var CLASS = Object.freeze({
  AUTO: 'auto',
  HUMAN: 'human_required',
  FORBIDDEN: 'forbidden',
  UNKNOWN: 'unknown',
});
var RANK = { auto: 0, human_required: 1, unknown: 2, forbidden: 3 };

// Protected Working Tree（正本）。変更・削除・rename はすべて forbidden。
var PROTECTED_PATHS = Object.freeze([
  'cost-logs.json',
  'data/conversations/_meta.json',
  'claude-cost-logs.json',
  'claude-quality-history.json',
  'backup-dup-candidates-20260714/dup-candidates-123.csv',
  'backup-dup-candidates-20260714/dup-candidates-123.json',
  'data/conversations/user-cont-1_line_web.json',
  'data/conversations/user-cont-2_line_estimate.json',
  'data/conversations/user-cont-3_line_leader.json',
  'data/conversations/user-cont-4_line_video.json',
]);

// Safety Foundation 自身の変更は人の承認を要する（Autopilot が自分の安全装置を緩めない）。
//   Stage 4D：Runner 本体・承認管理・監査・Orchestrator も対象（Autopilot が自分の実行境界を変更する場合は Human 判断）。
var SAFETY_FOUNDATION_PATHS = Object.freeze([
  'tools/devAutopilot/riskClassifier.js',
  'tools/devAutopilot/testSelector.js',
  'tools/devAutopilot/testManifest.json',
  'tools/devAutopilot/runStore.js',
  'tools/devAutopilot/claudeRunner.js',
  'tools/devAutopilot/claudeExecutor.js',
  'tools/devAutopilot/transcriptCheck.js',
  'tools/devAutopilot/realRepoPermit.js',
  'tools/devAutopilot/worktreeController.js',
  'tools/devAutopilot/worktreeExecutor.js',
  'tools/devAutopilot/observers.js',
  'tools/devAutopilot/humanApproval.js',
  'tools/devAutopilot/approveCli.js',
  'tools/devAutopilot/auditGuard.js',
  'tools/devAutopilot/orchestrator.js',
  'tools/devAutopilot/testRunner.js',
  'tools/devAutopilot/protectedCheck.js',
  'tools/devAutopilot/runAutopilot.js',
]);

// 提供者・課金・認可境界に関わる既存ファイル（architecture boundary）。
var BOUNDARY_PATHS = Object.freeze([
  'lib/supabase.js',
  'openaiClient.js',
  'claudeClient.js',
  'costTracker.js',
  'lib/costDb.js',
  'lib/carouselImageClient.js',
  'shared/carouselApproval.js',
  'lib/carouselExecutionStore.js',
  'lib/outputDraftsDb.js',
  'lib/contentEvidenceResolutionGuard.js',
]);

var VALID_STATUS = ['added', 'modified', 'deleted', 'renamed'];

// ── path rules（human_required）──────────────────────────────
var PATH_RULES = [
  { rule: 'supabase_dir', test: function (p) { return /^supabase\//.test(p); } },
  { rule: 'sql_or_migration', test: function (p) { return /\.sql$/.test(p) || /(^|\/)migrations?\//.test(p); } },
  { rule: 'web_session', test: function (p) { return p === 'lib/websession.js'; } },
  { rule: 'auth_session_permission', test: function (p) { return /(^|[\/._-])(auth|session|sessions|permission|permissions|login|logout|oauth|acl|rbac)([\/._-]|$)/.test(p); } },
  { rule: 'env_file', test: function (p) { return /(^|\/)\.env(\.[^\/]*)?$/.test(p); } },
  { rule: 'package_manifest', test: function (p) { return /(^|\/)package(-lock)?\.json$/.test(p); } },
  { rule: 'node_modules', test: function (p) { return /(^|\/)node_modules\//.test(p); } },
  { rule: 'github_config', test: function (p) { return /^\.github\//.test(p); } },
  { rule: 'claude_config', test: function (p) { return /^\.claude\//.test(p); } },
  { rule: 'deploy_config', test: function (p) { return /(^|\/)(render\.ya?ml|render\.json|procfile|dockerfile)$/.test(p); } },
  { rule: 'server_js_change', test: function (p) { return p === 'server.js'; } },
  { rule: 'public_static_allowlist', test: function (p) { return p === 'lib/publicstatic.js'; } },
  { rule: 'architecture_boundary', test: function (p) { return BOUNDARY_PATHS.some(function (b) { return b.toLowerCase() === p; }); } },
  { rule: 'autopilot_safety_foundation', test: function (p) { return SAFETY_FOUNDATION_PATHS.some(function (b) { return b.toLowerCase() === p; }); } },
];

// ── content rules ──────────────────────────────────────────
//   ctx: { isTest, isDoc, isScript }
//   fixtureSafe=true の rule は test / doc では発火しない（文字列 fixture・説明文の誤判定防止）。
var EXEC_CONTEXT = /\b(exec|execSync|execFile|execFileSync|spawn|spawnSync|fork)\s*\(/;
var CONTENT_RULES = [
  // forbidden
  { cls: CLASS.FORBIDDEN, rule: 'destructive_git_exec', fixtureSafe: false,
    test: function (l, ctx) {
      var gitDestructive = /\bgit\s+(push|commit|reset|clean|rebase|merge|tag|stash|filter-branch|update-ref)\b|\bgit\s+branch\s+-D\b|\bgit\s+checkout\s+--\s|--force\b|\bgit\b[^'"`]*\s-f\b/i;
      return gitDestructive.test(l) && (EXEC_CONTEXT.test(l) || ctx.isScript);
    } },
  { cls: CLASS.FORBIDDEN, rule: 'deploy_exec', fixtureSafe: false,
    test: function (l, ctx) {
      var deploy = /\b(render\s+deploy|vercel\s+(--prod|deploy)|flyctl\s+deploy|npm\s+publish|gh\s+release\s+create)\b/i;
      return deploy.test(l) && (EXEC_CONTEXT.test(l) || ctx.isScript);
    } },
  { cls: CLASS.FORBIDDEN, rule: 'destructive_data', fixtureSafe: true,
    test: function (l) {
      return /\b(delete\s+from|drop\s+(table|schema|database|index|column|view|function|policy)|truncate(\s+table)?\s+[a-z_"])/i.test(l)
        || /\.delete\s*\(\s*\)/.test(l);
    } },
  { cls: CLASS.FORBIDDEN, rule: 'secret_export', fixtureSafe: false,
    test: function (l) {
      return /(writeFileSync|appendFileSync|writeFile|appendFile|console\.(log|info|warn|error)|res\.(json|send))\s*\([^)]*process\.env\b/.test(l)
        || /JSON\.stringify\s*\(\s*process\.env\s*\)/.test(l);
    } },
  { cls: CLASS.FORBIDDEN, rule: 'paid_image_generation_path', fixtureSafe: true,
    test: function (l) {
      return /\/api\/carousel-image\/(produce|generate)\b/.test(l)
        || /\b(handleProduceRequest|handleGenerateRequest|generateBackgroundRaw)\s*\(/.test(l)
        || /\bimages\.(generate|edit)\s*\(/.test(l);
    } },
  { cls: CLASS.FORBIDDEN, rule: 'publishing_path', fixtureSafe: true,
    test: function (l) {
      return /\bmarkInstagramPublished\s*\(/.test(l)
        || /\b(media_publish|instagram_content_publish)\b/.test(l)
        || /graph\.facebook\.com/.test(l);
    } },
  // human_required
  { cls: CLASS.HUMAN, rule: 'env_dependency', fixtureSafe: true,
    test: function (l) { return /\bprocess\.env\b/.test(l); } },
  { cls: CLASS.HUMAN, rule: 'secret_literal', fixtureSafe: false,
    test: function (l) {
      return /\b(sk-(ant-)?[A-Za-z0-9_-]{16,}|AKIA[0-9A-Z]{16}|gh[pousr]_[A-Za-z0-9]{20,}|xox[abpr]-[A-Za-z0-9-]{10,})\b/.test(l)
        || /-----BEGIN [A-Z ]*PRIVATE KEY-----/.test(l)
        || /\b(api[_-]?key|secret|password|passwd|access[_-]?token|auth[_-]?token)\s*[:=]\s*['"`][^'"`\s]{8,}['"`]/i.test(l);
    } },
  { cls: CLASS.HUMAN, rule: 'provider_model_change', fixtureSafe: true,
    test: function (l) {
      return /['"`](gpt-[0-9][\w.-]*|gpt-image-[0-9][\w.-]*|o[1-9](-mini|-preview)?|claude-(opus|sonnet|haiku|fable)[\w.-]*|gemini-[\w.-]+)['"`]/i.test(l)
        || /\b[A-Z][A-Z0-9_]*_MODEL\s*=/.test(l);
    } },
  { cls: CLASS.HUMAN, rule: 'external_network', fixtureSafe: true,
    test: function (l) {
      return /\bfetch\s*\(\s*['"`]https?:\/\//.test(l)
        || /\baxios(\.(get|post|put|patch|delete|request|create))?\s*\(\s*['"`]https?:\/\//.test(l)
        || /\bhttps?\.(request|get)\s*\(/.test(l)
        || /require\s*\(\s*['"](axios|http|https|net|tls|dgram|undici|node:http|node:https|node:net|node:tls)['"]\s*\)/.test(l);
    } },
  { cls: CLASS.HUMAN, rule: 'process_execution', fixtureSafe: true,
    test: function (l) { return /require\s*\(\s*['"](node:)?child_process['"]\s*\)/.test(l); } },
];

function _isCommentLine(line) {
  var t = String(line).trim();
  return t === '' || t.indexOf('//') === 0 || t.indexOf('/*') === 0 || t.indexOf('*') === 0
    || t.indexOf('#') === 0 || t.indexOf('--') === 0 || t.indexOf('<!--') === 0;
}

// path 正規化: 相対・forward slash・小文字。不正は null（→ unknown）。
function normalizePath(p) {
  if (typeof p !== 'string') return null;
  var s = p.trim().replace(/\\/g, '/');
  if (!s) return null;
  if (/^[a-zA-Z]:/.test(s) || s.charAt(0) === '/') return null;          // 絶対 path は拒否
  while (s.indexOf('./') === 0) s = s.slice(2);
  if (!s || s.split('/').some(function (seg) { return seg === '..' || seg === ''; })) return null;
  if (/[\u0000-\u001f]/.test(s)) return null;
  return s.toLowerCase();
}

function isProtectedPath(p) {
  var n = normalizePath(p);
  if (n === null) return false;
  return PROTECTED_PATHS.some(function (x) { return x.toLowerCase() === n; });
}

function _inScope(n, allowed) {
  return allowed.some(function (a) {
    return a.charAt(a.length - 1) === '/' ? n.indexOf(a) === 0 : n === a;
  });
}

function _worst(a, b) { return RANK[b] > RANK[a] ? b : a; }

function _classifyFile(file, allowed) {
  var findings = [];
  function add(cls, rule, detail, lineNo) {
    findings.push({ classification: cls, rule: rule, path: file && file.path, line: lineNo == null ? null : lineNo, detail: detail || null });
  }
  if (!file || typeof file !== 'object' || Array.isArray(file)) { add(CLASS.UNKNOWN, 'invalid_file_entry'); return findings; }
  var n = normalizePath(file.path);
  if (n === null) { add(CLASS.UNKNOWN, 'invalid_path'); return findings; }
  var status = file.status === undefined ? 'modified' : file.status;
  if (VALID_STATUS.indexOf(status) === -1) { add(CLASS.UNKNOWN, 'invalid_status', String(status)); return findings; }

  // rename は旧 path も評価する（Protected からの rename を見逃さない）
  var paths = [n];
  if (status === 'renamed') {
    var o = normalizePath(file.oldPath);
    if (o === null) { add(CLASS.UNKNOWN, 'rename_without_old_path'); return findings; }
    paths.push(o);
  }

  paths.forEach(function (p) {
    if (PROTECTED_PATHS.some(function (x) { return x.toLowerCase() === p; })) add(CLASS.FORBIDDEN, 'protected_path', p);
    PATH_RULES.forEach(function (r) { if (r.test(p)) add(CLASS.HUMAN, r.rule, p); });
  });
  if (!_inScope(n, allowed)) add(CLASS.HUMAN, 'out_of_scope', n);
  if (status === 'deleted') { add(CLASS.HUMAN, 'file_deletion', n); return findings; }

  // content rules（削除以外は addedLines が必須＝diff 情報不足は unknown）
  if (!Array.isArray(file.addedLines)) { add(CLASS.UNKNOWN, 'diff_missing'); return findings; }
  var ctx = {
    isTest: /\.test\.js$/.test(n),
    isDoc: /\.(md|txt)$/.test(n),
    isScript: /\.(sh|bash|ps1|bat|cmd)$/.test(n),
  };
  for (var i = 0; i < file.addedLines.length; i++) {
    var line = file.addedLines[i];
    if (typeof line !== 'string') { add(CLASS.UNKNOWN, 'invalid_added_line', null, i + 1); continue; }
    if (_isCommentLine(line)) continue;
    CONTENT_RULES.forEach(function (r) {
      if (r.fixtureSafe && (ctx.isTest || ctx.isDoc)) return;
      if (ctx.isDoc && r.rule !== 'secret_literal') return;   // 説明文は secret 以外を判定しない
      if (r.test(line, ctx)) add(r.cls, r.rule, line.trim().slice(0, 160), i + 1);
    });
  }
  return findings;
}

// 公開 API:
//   input: { allowedPaths: string[]（'dir/' prefix または完全一致）, files: [{ path, status?, oldPath?, addedLines?: string[] }] }
//   戻り値: { classification, findings[], files: [{ path, classification }] }
function classifyDevelopmentChange(input) {
  try {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return { classification: CLASS.UNKNOWN, findings: [{ classification: CLASS.UNKNOWN, rule: 'invalid_input', path: null, line: null, detail: null }], files: [] };
    }
    var allowedRaw = input.allowedPaths;
    var allowed = Array.isArray(allowedRaw) ? allowedRaw.map(function (a) {
      if (typeof a !== 'string') return null;
      var t = a.trim().replace(/\\/g, '/');
      if (t.charAt(t.length - 1) === '/') { var d = normalizePath(t.slice(0, -1)); return d === null ? null : d + '/'; }
      return normalizePath(t);
    }) : null;
    if (!allowed || allowed.length === 0 || allowed.some(function (a) { return a === null; })) {
      return { classification: CLASS.UNKNOWN, findings: [{ classification: CLASS.UNKNOWN, rule: 'invalid_allowed_paths', path: null, line: null, detail: null }], files: [] };
    }
    if (!Array.isArray(input.files) || input.files.length === 0) {
      return { classification: CLASS.UNKNOWN, findings: [{ classification: CLASS.UNKNOWN, rule: 'no_changes', path: null, line: null, detail: null }], files: [] };
    }
    var overall = CLASS.AUTO;
    var findings = [];
    var perFile = input.files.map(function (f) {
      var fs = _classifyFile(f, allowed);
      var cls = fs.reduce(function (acc, x) { return _worst(acc, x.classification); }, CLASS.AUTO);
      overall = _worst(overall, cls);
      findings = findings.concat(fs);
      return { path: f && typeof f.path === 'string' ? f.path : null, classification: cls };
    });
    return { classification: overall, findings: findings, files: perFile };
  } catch (e) {
    return { classification: CLASS.UNKNOWN, findings: [{ classification: CLASS.UNKNOWN, rule: 'classifier_error', path: null, line: null, detail: null }], files: [] };
  }
}

// Autopilot 上の扱い（呼び出し側の分岐を 1 か所に固定する）
function gateForClassification(cls) {
  if (cls === CLASS.AUTO) return { proceed: true, gate: 'none', outcome: null };
  if (cls === CLASS.HUMAN) return { proceed: false, gate: 'human_approval_required', outcome: null };
  return { proceed: false, gate: 'none', outcome: 'blocked' };   // forbidden / unknown / 想定外値
}

module.exports = {
  CLASS: CLASS,
  PROTECTED_PATHS: PROTECTED_PATHS,
  SAFETY_FOUNDATION_PATHS: SAFETY_FOUNDATION_PATHS,
  BOUNDARY_PATHS: BOUNDARY_PATHS,
  normalizePath: normalizePath,
  isProtectedPath: isProtectedPath,
  classifyDevelopmentChange: classifyDevelopmentChange,
  gateForClassification: gateForClassification,
};
