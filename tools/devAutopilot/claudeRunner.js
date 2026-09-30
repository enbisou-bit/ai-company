'use strict';
// tools/devAutopilot/claudeRunner.js
// Development Autopilot V1 — Stage 4B: Claude Runner Pure Contract（純関数のみ）
//
//   ★ Claude CLI を起動しない。child_process / fs / network / process.env を一切使わない。
//     ここで作るのは「引数・env・settings・prompt のデータ」と「出力・差分・失敗の判定」だけ。
//     実行（native claude.exe の絶対 path を execFile・shell:false で起動）は後続 Stage の責務。
//   ★ CLI の実際の挙動のうち Stage 4A で help 記述しか確認していないもの（UNVERIFIED_CLI_BEHAVIORS）は、
//     ここでは「候補契約」として組み立てるだけで、実効性を前提にしない。Stage 4C の live probe で確認する。
//   ★ 安全性は 3 層：CLI の tool 制限（--tools / dontAsk）＋ Orchestrator の検証（本モジュールの validate*）＋ prompt contract。
//     prompt と自然文は state transition の正本にしない。
//   ★ 未知の stage / key・不正な型・矛盾する設定・観測不足は fail-closed。自動 retry は 0 回。

var path = require('path');
var wc = require('./worktreeController');
var rc = require('./riskClassifier');

function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _str(v) { return typeof v === 'string' && v.length > 0; }
function _err(code, extra) { return Object.assign({ ok: false, error: code }, extra || {}); }
function _exactKeys(o, allowed, required) {
  var bad = Object.keys(o).filter(function (k) { return allowed.indexOf(k) === -1; });
  var miss = (required || []).filter(function (k) { return !Object.prototype.hasOwnProperty.call(o, k); });
  return { unknown: bad, missing: miss };
}
function _freezeDeep(o) { Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object') _freezeDeep(o[k]); }); return Object.freeze(o); }
var CTRL_RE = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/;

// ── Stage 4A で help 記述だけを確認し、実挙動は Stage 4C で実測する 8 点（確認済み仕様として扱わない）──
var UNVERIFIED_CLI_BEHAVIORS = Object.freeze([
  'stdin_prompt_input',                    // -p で stdin から prompt を渡せるか
  'json_envelope_fields_and_exit_code',    // --output-format json の envelope のフィールドと exit code
  'tools_dontask_denial_recording',        // --tools と dontAsk で未許可操作がどう拒否・記録されるか
  'safe_mode_with_oauth',                  // --safe-mode と OAuth 認証の併用
  'setting_sources_project_isolation',     // --setting-sources project で user / 親ディレクトリの設定が読まれないか
  'no_session_persistence_with_session_id',// --no-session-persistence と --session-id の併用
  'max_budget_usd_under_oauth',            // OAuth 時の --max-budget-usd と費用値の扱い
  'minimum_required_env',                  // 起動に最低限必要な env
]);

// ── Stage policy ─────────────────────────────────────────
//   runner stage（invocation の種類）→ tools / 書込可否 / runStore の stage 名。V1 は no-auto-fix のため fix / rereview は含めない
var READ_TOOLS = Object.freeze(['Read', 'Glob', 'Grep']);
var WRITE_TOOLS = Object.freeze(['Read', 'Glob', 'Grep', 'Edit', 'Write']);
var STAGE_POLICY = _freezeDeep({
  research: { invokesClaude: true, tools: READ_TOOLS.slice(), writes: false, runStoreStage: 'researching' },
  design:   { invokesClaude: true, tools: READ_TOOLS.slice(), writes: false, runStoreStage: 'designing' },
  implement:{ invokesClaude: true, tools: WRITE_TOOLS.slice(), writes: true, runStoreStage: 'implementing' },
  test:     { invokesClaude: false, tools: [], writes: false, runStoreStage: 'testing' },   // Test は Orchestrator が manifest に従って実行する
  review:   { invokesClaude: true, tools: READ_TOOLS.slice(), writes: false, runStoreStage: 'reviewing' },
});
var CLAUDE_STAGES = Object.freeze(Object.keys(STAGE_POLICY).filter(function (s) { return STAGE_POLICY[s].invokesClaude; }));
var DENIED_TOOLS = Object.freeze(['Bash', 'WebFetch', 'WebSearch', 'Agent', 'mcp__*']);
var PERMISSION_MODE = 'dontAsk';
var EMPTY_MCP_CONFIG = '{"mcpServers":{}}';

// 使わない / 許可しないフラグ（buildRunnerArgs の出力にも validateRunnerArgs で検査）
var FORBIDDEN_FLAGS = Object.freeze([
  '--dangerously-skip-permissions', '--allow-dangerously-skip-permissions',
  '-c', '--continue', '-r', '--resume', '--fork-session', '--from-pr',
  '-w', '--worktree', '--tmux', '--add-dir',
  '--chrome', '--ide', '--remote-control', '--plugin-dir', '--plugin-url', '--agents', '--agent', '--file', '--bare',
  // 範囲指定のない allow（--allowedTools は allow rule として働く）と、--restricted と条件が異なる設定読込元の指定は使わない
  '--allowedTools', '--allowed-tools', '--setting-sources',
]);
var FORBIDDEN_VALUES = Object.freeze(['bypassPermissions']);
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
var MODEL_RE = /^(sonnet|opus|haiku|claude-[a-z0-9-]{3,60})$/;
var MAX_BUDGET_USD_PER_INVOCATION = 5;
var MAX_APPEND_PROMPT = 8000;

// ── Output schema（Claude 本文の構造化出力）──────────────────
var OUTPUT_KEYS = Object.freeze(['stage', 'status', 'summary', 'files_read', 'files_changed', 'proposed_tests', 'risks', 'requires_human', 'stop_reason']);
var OUTPUT_STATUS = Object.freeze(['ok', 'stop', 'needs_human']);
var LIMITS = Object.freeze({ summary: 4000, listItems: 500, itemLen: 400, risks: 50, tests: 50 });
function buildOutputSchema(stage) {
  if (CLAUDE_STAGES.indexOf(stage) === -1) return null;
  var strList = function (max) { return { type: 'array', maxItems: max, items: { type: 'string', maxLength: LIMITS.itemLen } }; };
  return {
    type: 'object', additionalProperties: false, required: OUTPUT_KEYS.slice(),
    properties: {
      stage: { type: 'string', enum: [stage] },
      status: { type: 'string', enum: OUTPUT_STATUS.slice() },
      summary: { type: 'string', maxLength: LIMITS.summary },
      files_read: strList(LIMITS.listItems),
      files_changed: strList(LIMITS.listItems),
      proposed_tests: strList(LIMITS.tests),
      risks: strList(LIMITS.risks),
      requires_human: { type: 'boolean' },
      stop_reason: { type: ['string', 'null'], maxLength: LIMITS.itemLen },
    },
  };
}

// ── path helpers（worktree 相対・POSIX 区切り）──────────────────
function normRel(p) {
  if (typeof p !== 'string' || !p || CTRL_RE.test(p) || p.length > LIMITS.itemLen) return null;
  if (/^[A-Za-z]:|^[\\\/]|\\/.test(p)) return null;   // 絶対 path・drive・backslash は不可
  var segs = p.replace(/\/+$/, '').split('/');
  if (segs.some(function (s) { return s === '' || s === '.' || s === '..'; })) return null;
  return segs.join('/');
}
function _within(p, prefix) {   // prefix は 'dir/'（ディレクトリ）または完全一致の file
  var a = p.toLowerCase(), b = prefix.toLowerCase();
  return b.slice(-1) === '/' ? a.indexOf(b) === 0 : a === b;
}
function _normScopeList(list, allowEmpty) {
  if (!Array.isArray(list) || (!allowEmpty && list.length === 0)) return null;
  var out = [];
  for (var i = 0; i < list.length; i++) {
    var raw = list[i];
    if (typeof raw !== 'string') return null;
    var dir = /\/$/.test(raw);
    var n = normRel(raw);
    if (!n) return null;
    out.push(dir ? n + '/' : n);
  }
  return out;
}
function _isEnvPath(p) { return /(^|\/)\.env(\.[^\/]*)?$/i.test(p); }
function _isGitInternal(p) { return /(^|\/)\.git(\/|$)/i.test(p); }
function _isPackageManifest(p) { return /(^|\/)package(-lock)?\.json$/i.test(p); }

// ── buildRunnerArgs ──────────────────────────────────────
// input: { stage, sessionId, outputSchema, settings, appendSystemPrompt, maxBudgetUsd, approvedRemainingBudgetUsd, model?, noSessionPersistence? }
// 戻り値: { ok:true, args:string[], promptVia:'stdin', unverified:string[] } | { ok:false, error }
//   ★ executable path は含めない（後続 Stage で native claude.exe の絶対 path を付与する）。
//   ★ MAX_BUDGET_USD_PER_INVOCATION（5）は公式な根拠のある値ではなく、1 invocation の絶対上限としての保守的な固定値。
//     実行費用の承認ではない。実際の --max-budget-usd は Human が承認した run budget の残額（approvedRemainingBudgetUsd）以内に制限する。
var ARG_KEYS = ['stage', 'sessionId', 'outputSchema', 'settings', 'appendSystemPrompt', 'maxBudgetUsd', 'approvedRemainingBudgetUsd', 'model', 'noSessionPersistence'];
var ARG_REQUIRED = ['stage', 'sessionId', 'outputSchema', 'settings', 'appendSystemPrompt', 'maxBudgetUsd', 'approvedRemainingBudgetUsd'];
function buildRunnerArgs(input) {
  if (!_isObj(input)) return _err('input_invalid');
  var k = _exactKeys(input, ARG_KEYS, ARG_REQUIRED);
  if (k.unknown.length) return _err('unexpected_input_keys', { keys: k.unknown });
  if (k.missing.length) return _err('missing_input_keys', { keys: k.missing });
  var pol = STAGE_POLICY[input.stage];
  if (!pol || !pol.invokesClaude) return _err('stage_not_runnable');
  if (typeof input.sessionId !== 'string' || !UUID_RE.test(input.sessionId)) return _err('session_id_invalid');
  if (JSON.stringify(input.outputSchema) !== JSON.stringify(buildOutputSchema(input.stage))) return _err('output_schema_mismatch');
  var sv = validateRunnerSettings(input.settings, input.stage);
  if (!sv.ok) return _err('settings_invalid', { errors: sv.errors });
  if (typeof input.appendSystemPrompt !== 'string' || !input.appendSystemPrompt.trim() || input.appendSystemPrompt.length > MAX_APPEND_PROMPT || CTRL_RE.test(input.appendSystemPrompt)) return _err('append_system_prompt_invalid');
  if (typeof input.maxBudgetUsd !== 'number' || !isFinite(input.maxBudgetUsd) || input.maxBudgetUsd <= 0 || input.maxBudgetUsd > MAX_BUDGET_USD_PER_INVOCATION) return _err('max_budget_invalid');
  if (typeof input.approvedRemainingBudgetUsd !== 'number' || !isFinite(input.approvedRemainingBudgetUsd) || input.approvedRemainingBudgetUsd <= 0) return _err('approved_remaining_budget_invalid');
  if (input.maxBudgetUsd > input.approvedRemainingBudgetUsd) return _err('max_budget_exceeds_approved_remaining');
  if (input.model !== undefined && (typeof input.model !== 'string' || !MODEL_RE.test(input.model))) return _err('model_invalid');
  if (input.noSessionPersistence !== undefined && typeof input.noSessionPersistence !== 'boolean') return _err('no_session_persistence_invalid');
  var tools = pol.tools.join(',');
  var args = [
    '-p',
    '--output-format', 'json',
    '--input-format', 'text',
    '--permission-mode', PERMISSION_MODE,
    '--tools', tools,                                  // 使える tool は stage policy だけ（allow ではない）
    '--disallowedTools', DENIED_TOOLS.join(','),
    '--strict-mcp-config', '--mcp-config', EMPTY_MCP_CONFIG,
    '--safe-mode',
    // --restricted：file tools を作業ディレクトリに限定し、設定は managed と --settings だけを読む（公式 docs）。
    //   Stage 4C Unit 2a（2.1.280・research 相当の Read/Glob/Grep）で、worktree 外 4 経路の拒否と内側 Read の成功を観測した範囲の条件。
    //   design / implement / review や Edit / Write での境界は未実証。
    '--restricted',
    '--settings', JSON.stringify(input.settings),
    '--disable-slash-commands',
    '--session-id', input.sessionId,
    '--json-schema', JSON.stringify(input.outputSchema),
    '--append-system-prompt', input.appendSystemPrompt,
    '--max-budget-usd', String(input.maxBudgetUsd),
  ];
  if (input.model !== undefined) args.push('--model', input.model);
  if (input.noSessionPersistence === true) args.push('--no-session-persistence');   // 併用可否は 4C 未確認（必須にしない）
  var v = validateRunnerArgs(args);
  if (!v.ok) return _err('args_invalid', { errors: v.errors });
  return _freezeDeep({ ok: true, args: args, promptVia: 'stdin', unverified: UNVERIFIED_CLI_BEHAVIORS.slice() });
}

// 任意の argv に危険フラグ・bypass 値が無く、tool 制限を構成する flag が欠落・改変・重複していないか（多重防御）
//   欠落や改変で tool 制限が緩まないよう、制限を担う flag はすべて「ちょうど 1 回・期待値」を要求する。
var REQUIRED_SINGLE_FLAGS = Object.freeze(['-p', '--output-format', '--input-format', '--permission-mode', '--tools', '--disallowedTools',
  '--strict-mcp-config', '--mcp-config', '--safe-mode', '--restricted', '--settings', '--disable-slash-commands', '--session-id', '--json-schema', '--max-budget-usd']);
function _flagValue(args, f) { var i = args.indexOf(f); return i === -1 ? undefined : args[i + 1]; }
function validateRunnerArgs(args) {
  var e = [];
  if (!Array.isArray(args) || !args.every(function (a) { return typeof a === 'string'; })) return { ok: false, errors: ['args_not_string_array'] };
  args.forEach(function (a) {
    var flag = a.split('=')[0];
    if (FORBIDDEN_FLAGS.indexOf(flag) !== -1) e.push('forbidden_flag:' + flag);
    if (FORBIDDEN_VALUES.indexOf(a) !== -1) e.push('forbidden_value:' + a);
    if (/^--[a-zA-Z-]+=/.test(a)) e.push('inline_flag_value:' + flag);   // --x=y 形式は検査をすり抜け得るため不可
  });
  REQUIRED_SINGLE_FLAGS.forEach(function (f) {
    var n = args.filter(function (a) { return a === f; }).length;
    if (n === 0) e.push('missing:' + f); else if (n > 1) e.push('duplicated:' + f);
  });
  if (args[0] !== '-p') e.push('print_mode_must_be_first');
  if (_flagValue(args, '--output-format') !== 'json') e.push('output_format_must_be_json');
  if (_flagValue(args, '--input-format') !== 'text') e.push('input_format_must_be_text');
  if (_flagValue(args, '--permission-mode') !== PERMISSION_MODE) e.push('permission_mode_must_be_dontAsk');
  var tools = _flagValue(args, '--tools');
  var toolSet = typeof tools === 'string' ? tools.split(',') : [];
  var matchesPolicy = CLAUDE_STAGES.some(function (s) { return STAGE_POLICY[s].tools.join(',') === tools; });
  if (!matchesPolicy) e.push('tools_not_a_stage_policy');
  if (toolSet.some(function (t) { return WRITE_TOOLS.indexOf(t) === -1; })) e.push('tool_not_permitted');
  var dis = String(_flagValue(args, '--disallowedTools') || '').split(',');
  if (!DENIED_TOOLS.every(function (t) { return dis.indexOf(t) !== -1; })) e.push('disallowed_tools_incomplete');
  if (_flagValue(args, '--mcp-config') !== EMPTY_MCP_CONFIG) e.push('mcp_config_must_be_empty');
  var st = null;
  try { st = JSON.parse(_flagValue(args, '--settings')); } catch (x) { st = null; }
  var stageForTools = CLAUDE_STAGES.filter(function (s) { return STAGE_POLICY[s].tools.join(',') === tools; })[0];
  if (!st || !stageForTools || !validateRunnerSettings(st, stageForTools).ok) e.push('settings_invalid_or_inconsistent_with_tools');
  if (!UUID_RE.test(String(_flagValue(args, '--session-id')))) e.push('session_id_invalid');
  var bud = Number(_flagValue(args, '--max-budget-usd'));
  if (!(bud > 0 && bud <= MAX_BUDGET_USD_PER_INVOCATION)) e.push('max_budget_invalid');
  return { ok: e.length === 0, errors: e };
}

// ── buildRunnerEnv（allowlist・deny 優先・case-insensitive）──────────
//   HOME / USERPROFILE は OAuth（~/.claude）に必要と考えられる候補。APPDATA / LOCALAPPDATA も候補。必要最小集合は 4C で確定。
var RUNNER_ENV_ALLOWLIST = Object.freeze(['PATH', 'PATHEXT', 'SYSTEMROOT', 'SYSTEMDRIVE', 'WINDIR', 'COMSPEC', 'TEMP', 'TMP', 'HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']);
var RUNNER_ENV_UNVERIFIED_NECESSITY = Object.freeze(['HOME', 'USERPROFILE', 'APPDATA', 'LOCALAPPDATA']);
// 固定で付与する env（親 env の同名値は allowlist 外として落とし、常にこの値を使う）。認証 env は含めない。
//   DISABLE_UPDATES：版固定の CLI が更新経路を使わないため（公式 docs：すべての更新経路を止める）。直接配置した binary での実効性は未確認
var RUNNER_ENV_FIXED = Object.freeze({ DISABLE_UPDATES: '1' });
var RUNNER_ENV_DENY = Object.freeze([
  /^CLAUDECODE$/i, /^CLAUDE_/i, /^ANTHROPIC_/i,
  /^(SUPABASE|NEXT_PUBLIC_SUPABASE|OPENAI|LINE_|WEB_SESSION|CAROUSEL_|RENDER_|GITHUB_|GH_|NPM_)/i,
  /(KEY|TOKEN|SECRET|PASSWORD|PASSWD|CREDENTIAL|CREDENTIALS|AUTH|COOKIE|SESSION)$/i,
  /^(AUTHORIZATION|COOKIE)$/i, /^GIT_/i, /^NODE_OPTIONS$/i,
]);
// opts: { allowAnthropicApiKey?: boolean }（API key 認証は Human 判断事項。既定 false）
// 戻り値の契約：
//   env          … 子プロセスへ渡す値そのもの。allowAnthropicApiKey=true のときだけ ANTHROPIC_API_KEY（credential）を含み得る。
//                  ★ log・診断・run.json・報告へ出力・保存してはならない（呼び出し側の責務）。
//   envNames     … 子へ渡す env の名前だけ（診断・log 用。値は含まない）
//   dropped      … 除外した env の名前だけ（値は含まない）
function buildRunnerEnv(parentEnv, opts) {
  if (!_isObj(parentEnv)) return _err('parent_env_invalid');
  var o = opts === undefined ? {} : opts;
  if (!_isObj(o) || Object.keys(o).some(function (k) { return k !== 'allowAnthropicApiKey'; })) return _err('opts_invalid');
  if (o.allowAnthropicApiKey !== undefined && typeof o.allowAnthropicApiKey !== 'boolean') return _err('opts_invalid');
  var env = {}, dropped = [], seen = {};
  var keys = Object.keys(parentEnv);
  for (var i = 0; i < keys.length; i++) {
    var key = keys[i], up = key.toUpperCase();
    if (seen[up]) return _err('ambiguous_env_key', { key: up });
    seen[up] = true;
    var val = parentEnv[key];
    if (o.allowAnthropicApiKey === true && up === 'ANTHROPIC_API_KEY' && typeof val === 'string' && val) { env[key] = val; continue; }
    var denied = RUNNER_ENV_DENY.some(function (re) { return re.test(key); });
    if (denied || RUNNER_ENV_ALLOWLIST.indexOf(up) === -1 || typeof val !== 'string') { dropped.push(key); continue; }
    env[key] = val;
  }
  Object.keys(RUNNER_ENV_FIXED).forEach(function (k) { env[k] = RUNNER_ENV_FIXED[k]; });
  return { ok: true, env: env, envNames: Object.keys(env).sort(), dropped: dropped, containsCredential: Object.keys(env).some(function (k) { return k.toUpperCase() === 'ANTHROPIC_API_KEY'; }), unverifiedNecessity: RUNNER_ENV_UNVERIFIED_NECESSITY.slice() };
}

// ── buildRunnerSettings（Autopilot 専用 --settings の JSON）──────────
// input: { stage, worktreeRoot, mainRepoRoot, allowedPaths, forbiddenPaths }
//   permission rule の path 構文（絶対 path・Windows の扱い）は 4C 未確認。Orchestrator の事後検証を正本とする。
var SETTINGS_KEYS = ['stage', 'worktreeRoot', 'mainRepoRoot', 'allowedPaths', 'forbiddenPaths'];
// Windows 絶対 path rule：公式 docs の正規化（C:\Users\alice → /c/Users/alice、絶対は //c/...）に合わせる。
//   Unit 2a ではこの個別 deny rule の効力までは実証していない（境界の拒否は --restricted / dontAsk 下で観測したもの）。
function _absRule(winPath) {
  var n = path.win32.normalize(winPath).replace(/[\\\/]+$/, '');
  return '//' + n.charAt(0).toLowerCase() + n.slice(2).replace(/\\/g, '/') + '/**';
}
function buildRunnerSettings(input) {
  if (!_isObj(input)) return _err('input_invalid');
  var k = _exactKeys(input, SETTINGS_KEYS, SETTINGS_KEYS);
  if (k.unknown.length || k.missing.length) return _err('input_keys_invalid', { unknown: k.unknown, missing: k.missing });
  var pol = STAGE_POLICY[input.stage];
  if (!pol || !pol.invokesClaude) return _err('stage_not_runnable');
  if (!wc.validateWindowsAbsPath(input.worktreeRoot).ok || !wc.validateWindowsAbsPath(input.mainRepoRoot).ok) return _err('root_invalid');
  if (wc.samePath(input.worktreeRoot, input.mainRepoRoot) || _insideWin(input.worktreeRoot, input.mainRepoRoot) || _insideWin(input.mainRepoRoot, input.worktreeRoot)) return _err('worktree_main_overlap');
  var allowed = _normScopeList(input.allowedPaths, true);
  var forbidden = _normScopeList(input.forbiddenPaths, true);
  if (!allowed || !forbidden) return _err('scope_invalid');
  if (pol.writes && allowed.length === 0) return _err('allowed_paths_required_for_write_stage');
  var deny = ['Bash', 'WebFetch', 'WebSearch', 'Agent',
    'Read(' + _absRule(input.mainRepoRoot) + ')', 'Edit(' + _absRule(input.mainRepoRoot) + ')', 'Write(' + _absRule(input.mainRepoRoot) + ')',
    'Read(~/.claude/**)', 'Edit(~/.claude/**)', 'Write(~/.claude/**)',
    'Read(**/.env*)', 'Edit(**/.env*)', 'Write(**/.env*)',
    'Edit(**/.git/**)', 'Write(**/.git/**)', 'Edit(.git)', 'Write(.git)'];
  rc.PROTECTED_PATHS.forEach(function (p) { deny.push('Edit(' + p + ')', 'Write(' + p + ')'); });
  forbidden.forEach(function (p) { var g = p.slice(-1) === '/' ? p + '**' : p; deny.push('Edit(' + g + ')', 'Write(' + g + ')'); });
  // 範囲指定のない Read / Glob / Grep の allow は置かない（作業ディレクトリ内の読取は dontAsk でも実行され、外側は allow が無いため拒否される）
  var allow = [];
  if (pol.writes) allowed.forEach(function (p) { var g = p.slice(-1) === '/' ? p + '**' : p; allow.push('Edit(' + g + ')', 'Write(' + g + ')'); });
  else deny.push('Edit', 'Write');
  return _freezeDeep({ ok: true, settings: { permissions: { defaultMode: PERMISSION_MODE, allow: allow, deny: deny } }, pathRuleSyntaxUnverified: true });
}
function _insideWin(child, parent) {
  var rel = path.win32.relative(path.win32.resolve(parent).toLowerCase(), path.win32.resolve(child).toLowerCase());
  return rel === '' || (!!rel && rel.split('\\')[0] !== '..' && !path.win32.isAbsolute(rel));
}
// buildRunnerArgs が受け取る settings の形を検査（未知 key・bypass・dontAsk 以外は拒否）
function validateRunnerSettings(settings, stage) {
  var e = [];
  var pol = STAGE_POLICY[stage];
  if (!pol) return { ok: false, errors: ['stage_unknown'] };
  if (!_isObj(settings) || Object.keys(settings).join(',') !== 'permissions') return { ok: false, errors: ['settings_shape'] };
  var p = settings.permissions;
  if (!_isObj(p) || Object.keys(p).sort().join(',') !== 'allow,defaultMode,deny') return { ok: false, errors: ['permissions_shape'] };
  if (p.defaultMode !== PERMISSION_MODE) e.push('default_mode_must_be_dontAsk');
  if (!Array.isArray(p.allow) || !Array.isArray(p.deny) || !p.allow.concat(p.deny).every(_str)) e.push('rules_not_strings');
  else {
    if (p.allow.some(function (r) { return /^(Bash|WebFetch|WebSearch|Agent|mcp__)/.test(r); })) e.push('dangerous_allow_rule');
    if (!pol.writes && p.allow.some(function (r) { return /^(Edit|Write)/.test(r); })) e.push('write_rule_in_read_stage');
    if (p.allow.some(function (r) { return /^(Read|Glob|Grep)(\(|$)/.test(r); })) e.push('read_allow_rule_forbidden');       // 外側の読取を許可し得る allow は置かない
    if (p.allow.some(function (r) { return /^(Edit|Write)$/.test(r); })) e.push('unscoped_write_allow');                  // Edit / Write は path 指定のみ
    ['Bash', 'WebFetch', 'WebSearch', 'Agent'].forEach(function (t) { if (p.deny.indexOf(t) === -1) e.push('deny_missing:' + t); });
  }
  return { ok: e.length === 0, errors: e };
}

// ── buildStagePrompt ───────────────────────────────────────
// ctx: { taskId, stage, worktreeRoot, allowedPaths, forbiddenPaths, objective, acceptanceCriteria[], previousOutputs{}, stopConditions[] }
//   main repo root は作業先として渡さない（Orchestrator が forbidden として settings で扱う）。
var PROMPT_KEYS = ['taskId', 'stage', 'worktreeRoot', 'allowedPaths', 'forbiddenPaths', 'objective', 'acceptanceCriteria', 'previousOutputs', 'stopConditions'];
var PREVIOUS_REQUIRED = { research: [], design: ['research'], implement: ['research', 'design'], review: ['design', 'implement'] };
var MAX_PROMPT = 40000;
function _textList(list, min) { return Array.isArray(list) && list.length >= min && list.length <= 50 && list.every(function (s) { return typeof s === 'string' && s.trim() && s.length <= 1000 && !CTRL_RE.test(s); }); }
function buildStagePrompt(ctx) {
  if (!_isObj(ctx)) return _err('ctx_invalid');
  var k = _exactKeys(ctx, PROMPT_KEYS, PROMPT_KEYS);
  if (k.unknown.length || k.missing.length) return _err('ctx_keys_invalid', { unknown: k.unknown, missing: k.missing });
  var pol = STAGE_POLICY[ctx.stage];
  if (!pol || !pol.invokesClaude) return _err('stage_not_runnable');
  if (!wc.isValidBranchTaskId(ctx.taskId)) return _err('task_id_invalid');
  if (!wc.validateWindowsAbsPath(ctx.worktreeRoot).ok) return _err('worktree_root_invalid');
  var allowed = _normScopeList(ctx.allowedPaths, !pol.writes), forbidden = _normScopeList(ctx.forbiddenPaths, true);
  if (!allowed || !forbidden || (pol.writes && !allowed.length)) return _err('scope_invalid');
  if (typeof ctx.objective !== 'string' || !ctx.objective.trim() || ctx.objective.length > 4000 || CTRL_RE.test(ctx.objective)) return _err('objective_invalid');
  if (!_textList(ctx.acceptanceCriteria, 1)) return _err('acceptance_criteria_invalid');
  if (!_textList(ctx.stopConditions, 1)) return _err('stop_conditions_invalid');
  if (!_isObj(ctx.previousOutputs)) return _err('previous_outputs_invalid');
  var need = PREVIOUS_REQUIRED[ctx.stage];
  var prevKeys = Object.keys(ctx.previousOutputs);
  if (prevKeys.some(function (s) { return need.indexOf(s) === -1; }) || need.some(function (s) { return prevKeys.indexOf(s) === -1; })) return _err('previous_outputs_mismatch', { expected: need });
  for (var i = 0; i < need.length; i++) {
    var v = validateStageOutput(need[i], ctx.previousOutputs[need[i]]);
    if (!v.ok) return _err('previous_output_invalid:' + need[i], { errors: v.errors });
  }
  var schema = buildOutputSchema(ctx.stage);
  var payload = {
    contract: 'ENBISOU Development Autopilot V1 — Decision 120',
    taskId: ctx.taskId, stage: ctx.stage, worktreeRoot: path.win32.normalize(ctx.worktreeRoot),
    tools: pol.tools.slice(), writes: pol.writes,
    allowedPaths: allowed, forbiddenPaths: forbidden,
    protectedContract: { paths: rc.PROTECTED_PATHS.slice(), rule: 'Protected files must never be read for modification, edited, overwritten, deleted, staged or committed.' },
    objective: ctx.objective, acceptanceCriteria: ctx.acceptanceCriteria.slice(),
    previousOutputs: ctx.previousOutputs,
    outputSchema: schema,
    stopConditions: ctx.stopConditions.slice(),
    rules: [
      'Work only inside worktreeRoot. Never use the main repository as a working directory.',
      pol.writes ? 'Edit or write only files inside allowedPaths and never inside forbiddenPaths.' : 'This stage is read-only: do not edit or write any file.',
      'Do not run shell commands, tests, git, npm, network access or MCP tools. Propose tests in proposed_tests only.',
      'Never read or write .env files, credentials, or Protected files.',
      'If any stop condition applies or the task cannot be done safely, return status "stop" with stop_reason. If a human decision is needed, return status "needs_human" with requires_human true.',
      'Return only the structured output that matches outputSchema.',
    ],
  };
  var prompt = JSON.stringify(payload, null, 2);
  if (prompt.length > MAX_PROMPT) return _err('prompt_too_large');
  return { ok: true, prompt: prompt, outputSchema: schema };
}

// ── validateStageOutput（Orchestrator 側の厳格な再 validation が正本）────────
function validateStageOutput(stage, out) {
  var e = [];
  var pol = STAGE_POLICY[stage];
  if (!pol || !pol.invokesClaude) return { ok: false, errors: ['stage_not_runnable'] };
  if (!_isObj(out)) return { ok: false, errors: ['output_not_object'] };
  var k = _exactKeys(out, OUTPUT_KEYS, OUTPUT_KEYS);
  if (k.unknown.length) e.push('unknown_keys:' + k.unknown.join(','));
  if (k.missing.length) e.push('missing_keys:' + k.missing.join(','));
  if (e.length) return { ok: false, errors: e };
  if (out.stage !== stage) e.push('stage_mismatch');
  if (OUTPUT_STATUS.indexOf(out.status) === -1) e.push('status_invalid');
  if (typeof out.summary !== 'string' || !out.summary.trim() || out.summary.length > LIMITS.summary || CTRL_RE.test(out.summary)) e.push('summary_invalid');
  ['files_read', 'files_changed'].forEach(function (f) {
    if (!Array.isArray(out[f]) || out[f].length > LIMITS.listItems || !out[f].every(function (p) { return normRel(p) === p; })) e.push(f + '_invalid');
  });
  if (!Array.isArray(out.proposed_tests) || out.proposed_tests.length > LIMITS.tests || !out.proposed_tests.every(function (t) { return typeof t === 'string' && /^[A-Za-z0-9._-]+\.test\.js$/.test(t); })) e.push('proposed_tests_invalid');
  if (!Array.isArray(out.risks) || out.risks.length > LIMITS.risks || !out.risks.every(function (r) { return typeof r === 'string' && r.length <= LIMITS.itemLen && !CTRL_RE.test(r); })) e.push('risks_invalid');
  if (typeof out.requires_human !== 'boolean') e.push('requires_human_invalid');
  if (!(out.stop_reason === null || (typeof out.stop_reason === 'string' && out.stop_reason.trim() && out.stop_reason.length <= LIMITS.itemLen))) e.push('stop_reason_invalid');
  if (!e.length) {
    if (out.status === 'ok' && (out.requires_human !== false || out.stop_reason !== null)) e.push('ok_inconsistent');
    if (out.status === 'stop' && !_str(out.stop_reason)) e.push('stop_requires_reason');
    if (out.status === 'needs_human' && out.requires_human !== true) e.push('needs_human_requires_flag');
    if (!pol.writes && out.files_changed.length) e.push('read_only_stage_reported_changes');
  }
  return { ok: e.length === 0, errors: e };
}

// ── parseRunnerEnvelope（CLI の JSON envelope）────────────────────
//   ★ envelope のフィールド名は Stage 4A 時点で未実測（ASSUMED_ENVELOPE_FIELDS）。必須と決め打ちせず、
//     取得できない値は null として返し、判定側（classifyRunnerFailure）で fail-closed に扱う。
var ASSUMED_ENVELOPE_FIELDS = Object.freeze(['is_error', 'subtype', 'result', 'structured_output', 'session_id', 'total_cost_usd', 'permission_denials', 'num_turns', 'api_error_status', 'modelUsage']);
var MAX_STDOUT = 2 * 1024 * 1024;
// 実使用モデルの記録用 allowlist（観測専用。判定条件にはしない）。これ以外の識別子は値を持たず件数だけ数える
var KNOWN_MODEL_IDS = Object.freeze(['claude-haiku-4-5-20251001', 'claude-sonnet-5-5', 'claude-opus-5-5', 'claude-fable-5-1']);
// api_error_status：欠落 / null / 有効な HTTP status（100〜599 の整数）/ 数値だが不正 / 型不正 を区別する
function _apiErrorStatus(env) {
  if (!Object.prototype.hasOwnProperty.call(env, 'api_error_status')) return { state: 'absent' };
  var v = env.api_error_status;
  if (v === null) return { state: 'null' };
  if (typeof v !== 'number') return { state: 'wrong_type' };
  if (!Number.isInteger(v) || v < 100 || v > 599) return { state: 'invalid_number' };   // NaN / Infinity / 小数 / 範囲外
  return { state: 'number', value: v };
}
// modelUsage：key 名（モデル識別子）だけを見る。本文・token 内訳は保持しない
function _modelUsage(env) {
  if (!Object.prototype.hasOwnProperty.call(env, 'modelUsage')) return { state: 'absent', models: [], unlistedCount: 0 };
  if (!_isObj(env.modelUsage)) return { state: 'wrong_type', models: [], unlistedCount: 0 };
  var models = [], unlisted = 0;
  Object.keys(env.modelUsage).forEach(function (k) { if (KNOWN_MODEL_IDS.indexOf(k) !== -1) { if (models.indexOf(k) === -1) models.push(k); } else unlisted++; });
  return { state: 'ok', models: models.sort(), unlistedCount: unlisted };
}
function parseRunnerEnvelope(stdout) {
  if (typeof stdout !== 'string') return _err('stdout_not_string');
  if (!stdout.trim()) return _err('stdout_empty');
  if (stdout.length > MAX_STDOUT) return _err('stdout_too_large');
  var env;
  try { env = JSON.parse(stdout); } catch (e) { return _err('envelope_not_json'); }
  if (!_isObj(env)) return _err('envelope_not_object');
  var structured = null, structuredSource = null;
  if (_isObj(env.structured_output)) { structured = env.structured_output; structuredSource = 'structured_output'; }
  else if (typeof env.result === 'string') {
    try { var r = JSON.parse(env.result); if (_isObj(r)) { structured = r; structuredSource = 'result_json'; } } catch (e) { structured = null; }
  }
  return {
    ok: true,
    isError: typeof env.is_error === 'boolean' ? env.is_error : null,
    subtype: typeof env.subtype === 'string' ? env.subtype : null,
    sessionId: typeof env.session_id === 'string' ? env.session_id : null,
    sessionIdState: !Object.prototype.hasOwnProperty.call(env, 'session_id') ? 'absent' : typeof env.session_id === 'string' ? 'string' : 'wrong_type',
    apiErrorStatus: _apiErrorStatus(env),
    modelUsage: _modelUsage(env),
    costUsd: typeof env.total_cost_usd === 'number' && isFinite(env.total_cost_usd) && env.total_cost_usd >= 0 ? env.total_cost_usd : null,
    permissionDenials: Array.isArray(env.permission_denials) ? env.permission_denials.length : null,
    numTurns: Number.isInteger(env.num_turns) ? env.num_turns : null,
    structuredOutput: structured, structuredSource: structuredSource,
    unknownFields: Object.keys(env).filter(function (f) { return ASSUMED_ENVELOPE_FIELDS.indexOf(f) === -1; }).sort(),
    assumptions: ASSUMED_ENVELOPE_FIELDS.slice(),
  };
}

// ── validatePostRunDiff（実行前後の snapshot を比較する純関数）────────────
// contract: { stage, allowedPaths, forbiddenPaths, baseHead, branchRef, expectedMainAutopilotStatusHash, expectedProtectedFingerprint }
// snapshot: { worktreeHead, branchTip, worktreeBranchRef, changedEntries:[{path,status,hash,isSymlink}],
//             mainAutopilotStatusHash, mainProtectedFingerprint, gitFileHash }
//   ★ 4B 自身は filesystem / Git を読まない。観測値の欠落・型違いは blocked（安全判定不能）。
var HEAD_RE = /^[0-9a-f]{40}$/, HASH12_RE = /^[0-9a-f]{12}$/, HASH_RE = /^[0-9a-f]{12,64}$/;
var ENTRY_STATUS = ['added', 'modified', 'deleted', 'renamed', 'untracked'];
function _snapshotErrors(s, label) {
  var e = [];
  if (!_isObj(s)) return [label + '_missing'];
  if (typeof s.worktreeHead !== 'string' || !HEAD_RE.test(s.worktreeHead)) e.push(label + ':worktreeHead');
  if (typeof s.branchTip !== 'string' || !HEAD_RE.test(s.branchTip)) e.push(label + ':branchTip');
  if (!_str(s.worktreeBranchRef)) e.push(label + ':worktreeBranchRef');
  if (typeof s.mainAutopilotStatusHash !== 'string' || !HASH12_RE.test(s.mainAutopilotStatusHash)) e.push(label + ':mainAutopilotStatusHash');
  if (typeof s.mainProtectedFingerprint !== 'string' || !HASH12_RE.test(s.mainProtectedFingerprint)) e.push(label + ':mainProtectedFingerprint');
  if (typeof s.gitFileHash !== 'string' || !HASH_RE.test(s.gitFileHash)) e.push(label + ':gitFileHash');
  if (!Array.isArray(s.changedEntries)) e.push(label + ':changedEntries');
  else s.changedEntries.forEach(function (c, i) {
    if (!_isObj(c) || normRel(c.path) !== c.path || ENTRY_STATUS.indexOf(c.status) === -1 || typeof c.isSymlink !== 'boolean'
      || !(c.hash === null || (typeof c.hash === 'string' && HASH_RE.test(c.hash)))) e.push(label + ':changedEntries[' + i + ']');
  });
  return e;
}
function validatePostRunDiff(input) {
  if (!_isObj(input)) return { result: 'blocked', reasons: ['input_invalid'] };
  var c = input.contract, before = input.before, after = input.after;
  if (!_isObj(c)) return { result: 'blocked', reasons: ['contract_missing'] };
  var pol = STAGE_POLICY[c.stage];
  if (!pol || !pol.invokesClaude) return { result: 'blocked', reasons: ['stage_not_runnable'] };
  var allowed = _normScopeList(c.allowedPaths, !pol.writes), forbidden = _normScopeList(c.forbiddenPaths, true);
  var cErr = [];
  if (!allowed || !forbidden) cErr.push('contract:scope');
  if (typeof c.baseHead !== 'string' || !HEAD_RE.test(c.baseHead)) cErr.push('contract:baseHead');
  if (!_str(c.branchRef) || !/^refs\/heads\/dev\//.test(c.branchRef)) cErr.push('contract:branchRef');
  if (typeof c.expectedMainAutopilotStatusHash !== 'string' || !HASH12_RE.test(c.expectedMainAutopilotStatusHash)) cErr.push('contract:expectedMainAutopilotStatusHash');
  if (typeof c.expectedProtectedFingerprint !== 'string' || !HASH12_RE.test(c.expectedProtectedFingerprint)) cErr.push('contract:expectedProtectedFingerprint');
  var sErr = _snapshotErrors(before, 'before').concat(_snapshotErrors(after, 'after'));
  if (cErr.length || sErr.length) return { result: 'blocked', reasons: ['observation_incomplete'].concat(cErr, sErr) };

  var r = [], human = [];
  if (after.worktreeHead !== c.baseHead || before.worktreeHead !== c.baseHead) r.push('worktree_head_moved');
  if (after.branchTip !== c.baseHead || before.branchTip !== c.baseHead) r.push('branch_tip_moved');
  if (after.worktreeBranchRef !== c.branchRef || before.worktreeBranchRef !== c.branchRef) r.push('worktree_branch_mismatch');
  if (after.gitFileHash !== before.gitFileHash) r.push('worktree_git_file_changed');
  if (after.mainAutopilotStatusHash !== c.expectedMainAutopilotStatusHash || before.mainAutopilotStatusHash !== c.expectedMainAutopilotStatusHash) r.push('main_status_changed');
  if (after.mainProtectedFingerprint !== c.expectedProtectedFingerprint || before.mainProtectedFingerprint !== c.expectedProtectedFingerprint) r.push('main_protected_changed');

  var prev = {};
  before.changedEntries.forEach(function (x) { prev[x.path.toLowerCase()] = x; });
  var newly = after.changedEntries.filter(function (x) {
    var p = prev[x.path.toLowerCase()];
    return !p || p.status !== x.status || p.hash !== x.hash || p.isSymlink !== x.isSymlink;
  });
  var afterSet = {};
  after.changedEntries.forEach(function (x) { afterSet[x.path.toLowerCase()] = true; });
  before.changedEntries.forEach(function (x) { if (!afterSet[x.path.toLowerCase()]) r.push('change_disappeared:' + x.path); });   // Runner が既存変更を戻した / 消した
  newly.forEach(function (x) {
    var p = x.path;
    if (!pol.writes) { r.push('read_only_stage_changed:' + p); return; }
    if (x.isSymlink) r.push('symlink_or_junction:' + p);
    if (rc.isProtectedPath(p)) r.push('protected_path:' + p);
    if (_isEnvPath(p)) r.push('env_file:' + p);
    if (_isGitInternal(p)) r.push('git_internal:' + p);
    if (forbidden.some(function (f) { return _within(p, f); })) r.push('forbidden_path:' + p);
    if (!allowed.some(function (a) { return _within(p, a); })) r.push('outside_allowed_paths:' + p);
    if (_isPackageManifest(p)) human.push('package_manifest:' + p);
    if (x.status === 'deleted') human.push('file_deletion:' + p);
  });
  if (r.length) return { result: 'blocked', reasons: r.concat(human), changedPaths: newly.map(function (x) { return x.path; }) };
  if (human.length) return { result: 'human_approval_required', reasons: human, changedPaths: newly.map(function (x) { return x.path; }) };
  return { result: 'ok', reasons: [], changedPaths: newly.map(function (x) { return x.path; }) };
}

// ── classifyRunnerFailure（runStore の状態へ対応づけ・自動 retry 0）──────────
// obs: { stage, exitCode, timedOut, envelope(parseRunnerEnvelope の結果), outputValidation(validateStageOutput の結果),
//        postRunDiff(validatePostRunDiff の結果), budget:{ capUsd, spentUsd, invocations, maxInvocations, costUnknown }, expectedSessionId }
//   重大度：blocked ＞ failed ＞ human_approval_required ＞ ok
//   ★ is_error=true はエラー応答（subtype に関係なく）。成功出力 schema は検査しないが、Safety・費用・session は検査する。
//   ★ エラー詳細は api_error_status / subtype の明示値だけで分類し、result 本文から推測しない。429 だけで月額枠の枯渇・課金区分を断定しない。
//   runStore への対応：blocked → blockRun ／ failed → failRun ／ human_approval_required → requireHumanApproval ／ ok → none
var ACTION = { blocked: 'blockRun', failed: 'failRun', human_approval_required: 'requireHumanApproval', ok: 'none' };
// エラー応答の詳細理由（固定分類のみ）。CLI 予算上限停止と 429 は別の理由にする
function _cliErrorDetails(env) {
  var d = [];
  if (env.subtype === 'error_max_budget_usd') d.push('cli_error_budget_stop');
  var s = _isObj(env.apiErrorStatus) ? env.apiErrorStatus : { state: 'absent' };
  if (s.state === 'number') d.push(s.value === 401 ? 'cli_error_401' : s.value === 403 ? 'cli_error_403' : s.value === 429 ? 'cli_error_429' : 'cli_error_status_other');
  else if (!d.length) d.push('cli_error_unclassified:' + (['absent', 'null', 'wrong_type', 'invalid_number'].indexOf(s.state) !== -1 ? s.state : 'unknown'));
  return d;
}
function classifyRunnerFailure(obs) {
  var blocked = [], failed = [], human = [];
  if (!_isObj(obs)) return { outcome: 'blocked', runStoreAction: 'blockRun', reasons: ['observation_missing'], retry: 0 };
  var pol = STAGE_POLICY[obs.stage];
  if (!pol || !pol.invokesClaude) blocked.push('stage_not_runnable');
  var exitKnown = Number.isInteger(obs.exitCode);
  if (typeof obs.timedOut !== 'boolean') blocked.push('timed_out_unknown');
  if (!exitKnown && obs.timedOut !== true) blocked.push('exit_code_unknown');
  var diff = obs.postRunDiff;
  var diffOk = _isObj(diff) && ['ok', 'blocked', 'human_approval_required'].indexOf(diff.result) !== -1;
  if (!diffOk) blocked.push('post_run_diff_missing');
  else if (diff.result === 'blocked') blocked.push('post_run_diff_blocked');
  else if (diff.result === 'human_approval_required') human.push('post_run_diff_requires_human');
  if (obs.timedOut === true) {
    if (!diffOk || diff.result !== 'ok' || (Array.isArray(diff.changedPaths) && diff.changedPaths.length)) blocked.push('timeout_with_changes_or_unknown');
    else failed.push('timeout');
  }
  var env = obs.envelope;
  var envOk = _isObj(env) && env.ok === true;
  var isErrResp = envOk && env.isError === true;
  var expSid = obs.expectedSessionId;
  var expSidOk = typeof expSid === 'string' && UUID_RE.test(expSid);
  if (!expSidOk) blocked.push('expected_session_id_invalid');
  if (envOk) {
    // 解析できた envelope の session は、エラー応答でも照合する
    if (env.sessionIdState !== 'string' || typeof env.sessionId !== 'string') blocked.push(env.sessionIdState === 'wrong_type' ? 'session_id_invalid' : 'session_id_missing');
    else if (!UUID_RE.test(env.sessionId)) blocked.push('session_id_invalid');
    else if (expSidOk && env.sessionId !== expSid) blocked.push('session_id_mismatch');
    if (typeof env.permissionDenials === 'number' && env.permissionDenials > 0) blocked.push('forbidden_tool_attempted');
  } else {
    failed.push('session_unverified_no_envelope');   // envelope 自体が無い：プロセス障害として扱い、session 不一致とは記録しない
  }
  if (exitKnown && obs.exitCode !== 0) failed.push('non_zero_exit');
  if (isErrResp) { failed.push('cli_error'); _cliErrorDetails(env).forEach(function (d) { failed.push(d); }); }
  if (obs.timedOut !== true && exitKnown && obs.exitCode === 0) {
    if (!envOk) blocked.push('envelope_malformed');
    else if (env.permissionDenials === null) blocked.push('permission_denials_unknown');   // エラー応答でも拒否記録の観測不足は blocked
    if (envOk && !isErrResp) {
      if (env.isError === null) blocked.push('is_error_unknown');
      var ov = obs.outputValidation;
      if (!_isObj(ov) || ov.ok !== true) blocked.push('output_invalid');
      else if (!_isObj(env.structuredOutput)) blocked.push('structured_output_missing');
      else {
        // Claude 自身が停止・Human 判断を求めた場合は自動で先へ進めない（V1 は no-auto-fix：review の stop も Human へ引き渡す）
        if (env.structuredOutput.requires_human === true || env.structuredOutput.status === 'needs_human') human.push('stage_requires_human');
        else if (env.structuredOutput.status === 'stop') human.push('stage_stopped');
      }
    }
  }
  var b = obs.budget;
  if (!_isObj(b) || typeof b.capUsd !== 'number' || typeof b.spentUsd !== 'number' || !Number.isInteger(b.invocations) || !Number.isInteger(b.maxInvocations) || typeof b.costUnknown !== 'boolean') {
    blocked.push('budget_observation_missing');
  } else {
    if (b.costUnknown || !envOk || env.costUsd === null) human.push('cost_unknown');
    else if (b.spentUsd + env.costUsd >= b.capUsd) human.push('budget_cap_reached');
    // b.invocations は今回の invocation を数える前の値。上限を超える invocation は Human 判断へ
    if (b.invocations + 1 > b.maxInvocations || b.maxInvocations > RUNNER_MAX_INVOCATIONS) human.push('invocation_limit_exceeded');
  }
  var outcome = blocked.length ? 'blocked' : failed.length ? 'failed' : human.length ? 'human_approval_required' : 'ok';
  return { outcome: outcome, runStoreAction: ACTION[outcome], reasons: blocked.concat(failed, human), retry: 0 };
}

// ── Invocation plan（V1：no-auto-fix）────────────────────────
//   V1 の自動経路は research → design → implement → review の 4 invocation だけ。各 1 回まで。
//   ★ V1 は no-auto-fix：fix / rereview は Runner の実行可能経路に含めない。入力されたら明確な理由で拒否する。
//     Human 承認フラグ等で同じ run の Fix を許可する経路も設けない。
//   ★ review が stop / needs_human（または runnerOutcome が ok 以外・requiresHuman）なら Human へ引き渡す。
//     手動修正後の再開・再検証・新 run の扱いは後続設計（本関数の範囲外）。
//   ★ test 実行と Safety Review は Orchestrator の責務。awaiting_commit_approval へ進むには、review ok に加えて
//     Orchestrator が観測した「最後の変更後の mandatory safe tests PASS」（testsPassedAfterLastChange）と
//     「Safety Review ok」（safetyReviewOk）が必須。4B の純関数は観測値を判定するだけで、実行・完了は保証しない。
//   ★ RUNNER_MAX_INVOCATIONS（6）は budget.maxInvocations の上限値としてのみ維持する。V1 で 6 段階の修正ループを実行できる意味ではない。
//     runStore への invocation 計上・実行制御はまだ無い（接続課題）。
//   history の各 entry：{ kind, status, requiresHuman, runnerOutcome }
var RUNNER_MAX_INVOCATIONS = 6;
var V1_SEQUENCE = Object.freeze(['research', 'design', 'implement', 'review']);
var V1_UNSUPPORTED_KINDS = Object.freeze({ fix: 'fix_not_supported_in_v1', rereview: 'rereview_not_supported_in_v1' });
var RUNNER_OUTCOMES = Object.freeze(['ok', 'failed', 'blocked', 'human_approval_required']);
var PLAN_OPT_KEYS = ['maxInvocations', 'testsPassedAfterLastChange', 'safetyReviewOk'];
function validateInvocationPlan(history, opts) {
  var fail = function (errs) { return { ok: false, errors: errs, canAwaitCommit: false, nextAllowed: [] }; };
  if (!Array.isArray(history)) return fail(['history_invalid']);
  var o = opts === undefined ? {} : opts;
  if (!_isObj(o) || Object.keys(o).some(function (k) { return PLAN_OPT_KEYS.indexOf(k) === -1; })) return fail(['opts_invalid']);
  if (['testsPassedAfterLastChange', 'safetyReviewOk'].some(function (k) { return o[k] !== undefined && typeof o[k] !== 'boolean'; })) return fail(['opts_invalid']);
  var e = [];
  var maxInv = o.maxInvocations === undefined ? RUNNER_MAX_INVOCATIONS : o.maxInvocations;
  if (!Number.isInteger(maxInv) || maxInv < 1) e.push('max_invocations_invalid');
  else if (maxInv > RUNNER_MAX_INVOCATIONS) e.push('max_invocations_exceeds_v1_limit');
  history.forEach(function (h, i) {
    if (!_isObj(h) || Object.keys(h).sort().join(',') !== 'kind,requiresHuman,runnerOutcome,status') { e.push('entry_invalid:' + i); return; }
    if (Object.prototype.hasOwnProperty.call(V1_UNSUPPORTED_KINDS, h.kind)) { e.push(V1_UNSUPPORTED_KINDS[h.kind] + ':' + i); return; }
    if (V1_SEQUENCE.indexOf(h.kind) === -1) e.push('kind_unknown:' + i);
    if (OUTPUT_STATUS.indexOf(h.status) === -1) e.push('status_invalid:' + i);
    if (typeof h.requiresHuman !== 'boolean') e.push('requires_human_invalid:' + i);
    if (RUNNER_OUTCOMES.indexOf(h.runnerOutcome) === -1) e.push('runner_outcome_invalid:' + i);
    if (h.kind !== V1_SEQUENCE[i]) e.push('out_of_order:' + i);
  });
  if (history.length > V1_SEQUENCE.length) e.push('v1_sequence_exceeded');
  if (Number.isInteger(maxInv) && history.length > maxInv) e.push('budget_invocation_limit_exceeded');
  // 途中の entry は「続けてよい状態」（status ok・runner ok・requiresHuman false）でなければならない
  for (var i = 0; i < history.length - 1; i++) {
    var h = history[i];
    if (!_isObj(h)) continue;
    if (h.runnerOutcome !== 'ok') e.push('continued_after_runner_' + h.runnerOutcome + ':' + i);
    if (h.requiresHuman === true) e.push('continued_after_requires_human:' + i);
    if (h.status !== 'ok') e.push('continued_after_non_ok:' + i);
  }
  if (e.length) return fail(e);
  var n = history.length, last = history[n - 1];
  var next = [], why = null, reviewOk = false;
  if (n === 0) next = ['research'];
  else if (last.status !== 'ok' || last.requiresHuman || last.runnerOutcome !== 'ok') {
    // Human へ引き渡す（review の stop も含め、同じ run では自動で修正へ進まない）
    why = last.runnerOutcome !== 'ok' ? 'handoff_to_human:runner_' + last.runnerOutcome : 'handoff_to_human:' + last.kind + '_' + (last.requiresHuman && last.status === 'ok' ? 'requires_human' : last.status);
  } else if (last.kind === 'review') reviewOk = true;
  else if (n < maxInv) next = [V1_SEQUENCE[n]];
  else why = 'invocation_limit_reached';
  var can = false;
  if (reviewOk) {
    if (o.testsPassedAfterLastChange !== true) why = 'tests_not_confirmed_after_last_change';
    else if (o.safetyReviewOk !== true) why = 'safety_review_not_confirmed';
    else can = true;
  }
  return { ok: true, errors: [], count: n, canAwaitCommit: can, nextAllowed: next, reason: can ? null : why, runStoreStage: last ? STAGE_POLICY[last.kind].runStoreStage : null };
}

// ── Test Boundary：実行対象 = mandatory safe tests + Claude 提案のうち manifest で safe かつ scope 内 ────
// input: { selectorResult:{selected[], skippedUnsafe[], uncoveredFiles[], requiresHumanApproval, errors[]}, proposedTests[], manifest }
//   ★ 積集合ではなく和集合。Claude の提案が空でも mandatory safe tests は削らない。conditional / forbidden / dev-check は自動実行しない。
var TEST_FILE_RE = /^[A-Za-z0-9._-]+\.test\.js$/;
function selectRunnerTests(input) {
  if (!_isObj(input)) return _err('input_invalid');
  var sr = input.selectorResult, m = input.manifest;
  if (!_isObj(sr) || !Array.isArray(sr.selected) || !Array.isArray(sr.errors) || typeof sr.requiresHumanApproval !== 'boolean') return _err('selector_result_invalid');
  if (!_isObj(m) || !Array.isArray(m.tests)) return _err('manifest_invalid');
  if (!Array.isArray(input.proposedTests) || !input.proposedTests.every(function (t) { return typeof t === 'string'; })) return _err('proposed_tests_invalid');
  if (sr.errors.length) return _err('selector_errors', { errors: sr.errors.slice() });
  var byFile = {};
  m.tests.forEach(function (t) { if (_isObj(t) && typeof t.file === 'string') byFile[t.file] = t; });
  var mandatory = sr.selected.map(function (s) { return _isObj(s) ? s.file : s; });
  var bad = mandatory.filter(function (f) { return typeof f !== 'string' || !TEST_FILE_RE.test(f) || !byFile[f] || byFile[f].class !== 'safe'; });
  if (bad.length) return _err('mandatory_not_safe', { files: bad });
  var run = mandatory.slice(), rejected = [], human = [];
  if (sr.requiresHumanApproval) human.push('selector_requires_human');
  input.proposedTests.forEach(function (t) {
    if (!TEST_FILE_RE.test(t) || /dev-check/i.test(t)) { rejected.push({ file: t, reason: 'out_of_scope' }); return; }
    var entry = byFile[t];
    if (!entry) { rejected.push({ file: t, reason: 'unregistered' }); human.push('proposed_unregistered_test'); return; }
    if (entry.class !== 'safe') { rejected.push({ file: t, reason: entry.class }); human.push('proposed_' + entry.class + '_test'); return; }
    if (run.indexOf(t) === -1) run.push(t);
  });
  run.sort();
  return {
    ok: true, run: run, mandatory: mandatory.slice().sort(), rejected: rejected,
    commands: run.map(function (f) { return { file: 'node', args: [f] }; }),   // 実行は Orchestrator（shell:false）。ここではデータのみ
    requiresHuman: human.length > 0, humanReasons: human.filter(function (x, i) { return human.indexOf(x) === i; }),
  };
}

module.exports = {
  UNVERIFIED_CLI_BEHAVIORS: UNVERIFIED_CLI_BEHAVIORS,
  STAGE_POLICY: STAGE_POLICY,
  CLAUDE_STAGES: CLAUDE_STAGES,
  DENIED_TOOLS: DENIED_TOOLS,
  FORBIDDEN_FLAGS: FORBIDDEN_FLAGS,
  PERMISSION_MODE: PERMISSION_MODE,
  RUNNER_ENV_ALLOWLIST: RUNNER_ENV_ALLOWLIST,
  RUNNER_ENV_FIXED: RUNNER_ENV_FIXED,
  ASSUMED_ENVELOPE_FIELDS: ASSUMED_ENVELOPE_FIELDS,
  RUNNER_MAX_INVOCATIONS: RUNNER_MAX_INVOCATIONS,
  buildOutputSchema: buildOutputSchema,
  buildRunnerArgs: buildRunnerArgs,
  validateRunnerArgs: validateRunnerArgs,
  buildRunnerEnv: buildRunnerEnv,
  buildRunnerSettings: buildRunnerSettings,
  validateRunnerSettings: validateRunnerSettings,
  buildStagePrompt: buildStagePrompt,
  parseRunnerEnvelope: parseRunnerEnvelope,
  validateStageOutput: validateStageOutput,
  validatePostRunDiff: validatePostRunDiff,
  classifyRunnerFailure: classifyRunnerFailure,
  validateInvocationPlan: validateInvocationPlan,
  selectRunnerTests: selectRunnerTests,
};
