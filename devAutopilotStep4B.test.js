'use strict';
// devAutopilotStep4B.test.js
// Development Autopilot V1 — Stage 4B（Claude Runner Pure Contract / claudeRunner）の deterministic テスト。
//
//   ★ 実行は必ずこのファイル名を明示指定する（node devAutopilotStep4B.test.js）。
//   ★ 純関数 test のみ。Claude CLI・API・child_process・Git・network・DB・fs write（OS temp を含む）は冒頭で封鎖する。
//   ★ process.env は変更しない（env の契約は fixture の object だけで検証する）。
//   ★ 実 repo の testManifest / testSelector は read-only で読むだけ（Test Boundary の結合確認）。
//   ★ Protected 10件の hash を開始時・終了時に read-only で取得し、全件一致を assert する。

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Module = require('module');

const ROOT = __dirname;
const violations = [];

const PROTECTED_BASELINE = {
  'cost-logs.json': 'ce24d4808bc7bbbf1b517b12c6bce65e',
  'data/conversations/_meta.json': 'b1f27d5f863f8fe20edc686157fbc992',
  'claude-cost-logs.json': '2f7fdd7d6105b92dbc022ea090f3399f',
  'claude-quality-history.json': '429a054a7898fcc78906b17a72b4d860',
  'backup-dup-candidates-20260714/dup-candidates-123.csv': 'c6800a3ff3b2e1acda3ccc5b8440b751',
  'backup-dup-candidates-20260714/dup-candidates-123.json': 'cdd3e71b3b295f4b094cf05a30cc79f7',
  'data/conversations/user-cont-1_line_web.json': 'dbceb6d32a3dda1fb9b5d721325089d5',
  'data/conversations/user-cont-2_line_estimate.json': '8124d35bad188d047ac162c1f38a0a69',
  'data/conversations/user-cont-3_line_leader.json': 'ab4e713e61a9ecc0496dad41c2f13536',
  'data/conversations/user-cont-4_line_video.json': '12ab03f1cc7d686de163ae4483b01c54',
};
const PROTECTED_FILES = Object.keys(PROTECTED_BASELINE);
// Protected の検証は共通 helper（main：固定基準と開始時・終了時とも一致／隔離 worktree：main 側の固定基準＋worktree 側の tracked 存在・不変と untracked 不在）。
// 実行場所は .git の構造だけで判定し、環境変数では切り替えない（tools/devAutopilot/protectedCheck.js）
const pc = require('./tools/devAutopilot/protectedCheck');
const protectedBefore = pc.snapshot(ROOT);

// ── sandbox（network / env file / fs write / module）──
function blockedNetwork(name) { return function () { violations.push('network:' + name); throw new Error('SANDBOX_BLOCKED_NETWORK:' + name); }; }
['http', 'https'].forEach(function (m) { const mod = require(m); mod.request = blockedNetwork(m + '.request'); mod.get = blockedNetwork(m + '.get'); });
{ const net = require('net'); net.connect = blockedNetwork('net.connect'); net.createConnection = blockedNetwork('net.createConnection'); const tls = require('tls'); tls.connect = blockedNetwork('tls.connect'); }
globalThis.fetch = blockedNetwork('fetch');
function isEnvFile(p) { try { return /^\.env(\..*)?$/i.test(path.basename(String(p))); } catch (e) { return false; } }
['readFileSync', 'readFile', 'existsSync', 'statSync', 'createReadStream'].forEach(function (n) {
  const orig = fs[n]; if (typeof orig !== 'function') return;
  fs[n] = function (p) { if (isEnvFile(p)) { violations.push('env_file_read:' + n); throw new Error('SANDBOX_BLOCKED_ENV_READ'); } return orig.apply(this, arguments); };
});
function blockedWrite(name) { return function () { violations.push('fs_write:' + name); throw new Error('SANDBOX_BLOCKED_FS_WRITE:' + name); }; }
['writeFileSync', 'appendFileSync', 'renameSync', 'unlinkSync', 'mkdirSync', 'mkdtempSync', 'rmSync', 'rmdirSync', 'copyFileSync', 'truncateSync',
  'symlinkSync', 'cpSync', 'writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'mkdtemp', 'rm', 'rmdir', 'copyFile', 'truncate', 'createWriteStream']
  .forEach(function (n) { if (typeof fs[n] === 'function') fs[n] = blockedWrite('fs.' + n); });
{ const origOpen = fs.openSync;
  fs.openSync = function (p, flags) {
    const f = flags === undefined ? 'r' : String(flags);
    if (f === 'r' || f === 'rs' || f === 'sr') return origOpen.apply(this, arguments);
    violations.push('fs_write:fs.openSync:' + String(p)); throw new Error('SANDBOX_BLOCKED_FS_WRITE:fs.openSync');
  }; }
const BLOCKED_BARE = new Set(['axios', 'dotenv', '@supabase/supabase-js', '@anthropic-ai/sdk', 'http2', 'undici', 'child_process', 'node:http2', 'node:child_process']);
const BLOCKED_FILES = new Set(['openaiClient.js', 'claudeClient.js', 'costTracker.js', 'lib/costDb.js', 'conversationHistory.js', 'server.js', 'lib/supabase.js', 'lib/outputDraftsDb.js',
  'tools/devAutopilot/worktreeExecutor.js'].map(function (p) { return path.join(ROOT, p); }));
const RUNNER_FILE = path.join(ROOT, 'tools', 'devAutopilot', 'claudeRunner.js');
const runnerRequests = [];
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (parent && parent.filename === RUNNER_FILE) runnerRequests.push(request);
  if (BLOCKED_BARE.has(request)) { violations.push('module:' + request); throw new Error('SANDBOX_BLOCKED_MODULE:' + request); }
  let filename = null;
  try { filename = Module._resolveFilename(request, parent, isMain); } catch (e) { filename = null; }
  if (filename && BLOCKED_FILES.has(filename)) { violations.push('module:' + path.relative(ROOT, filename)); throw new Error('SANDBOX_BLOCKED_MODULE:' + request); }
  return origLoad.apply(this, arguments);
};
const envSnapshotBefore = JSON.stringify(Object.keys(process.env).sort().map(function (k) { return [k, process.env[k]]; }));

let _passed = 0, _failed = 0;
function assert(cond, label) { if (cond) { _passed++; console.log('  ✅ ' + label); } else { _failed++; console.log('  ❌ ' + label); } }
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }
function has(list, x) { return Array.isArray(list) && list.some(function (r) { return r === x || String(r).indexOf(x) === 0; }); }

const cr = require('./tools/devAutopilot/claudeRunner');
const ts = require('./tools/devAutopilot/testSelector');

// ── fixture ──
const WT = 'C:\\Users\\hp\\ENBISOU_AI\\.autopilot\\wt\\task-4b-001';
const MAIN = 'C:\\Users\\hp\\ENBISOU_AI\\ai-company';
const BASE = 'd30f88b5e1282b58b1cc208a26b949cd381dfe6a';
const OTHER = '1111111111111111111111111111111111111111';
const UUID = '1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b';
function out(stage, extra) {
  return Object.assign({ stage: stage, status: 'ok', summary: 'done', files_read: ['tools/devAutopilot/runStore.js'], files_changed: [],
    proposed_tests: [], risks: [], requires_human: false, stop_reason: null }, extra || {});
}
function settingsFor(stage, extra) {
  return cr.buildRunnerSettings(Object.assign({ stage: stage, worktreeRoot: WT, mainRepoRoot: MAIN, allowedPaths: ['tools/devAutopilot/'], forbiddenPaths: ['server.js'] }, extra || {}));
}
function argsInput(stage, extra) {
  return Object.assign({ stage: stage, sessionId: UUID, outputSchema: cr.buildOutputSchema(stage), settings: settingsFor(stage).settings,
    appendSystemPrompt: 'Follow the ENBISOU Autopilot contract.', maxBudgetUsd: 1, approvedRemainingBudgetUsd: 5 }, extra || {});
}
function valOf(args, flag) { const i = args.indexOf(flag); return i === -1 ? undefined : args[i + 1]; }

(function main() {
  caseHeader('S. 静的境界（CLI 起動なし・child_process なし・fs なし・process.env なし）');
  {
    const code = fs.readFileSync(RUNNER_FILE, 'utf8').replace(/\/\/.*$/gm, '');
    const reqs = (code.match(/require\(\s*['"][^'"]+['"]\s*\)/g) || []).map(function (s) { return s.replace(/require\(\s*['"]|['"]\s*\)/g, ''); }).sort();
    assert(JSON.stringify(reqs) === JSON.stringify(['./riskClassifier', './worktreeController', 'path']), 'S-1. require は path / worktreeController / riskClassifier のみ（' + reqs.join(',') + '）');
    assert(runnerRequests.slice().sort().join(',') === './riskClassifier,./worktreeController,path', 'S-2. load 時に実際に読み込んだ module も同じ');
    assert(!/child_process|execFile|execSync|spawn|\bfork\s*\(/.test(code), 'S-3. child_process / execFile / spawn の参照 0');
    assert(!/process\.env|\bfetch\s*\(|writeFile|appendFile|mkdir|rmSync|unlink|renameSync|\bfs\b/.test(code), 'S-4. process.env / fs / network の参照 0');
  }

  caseHeader('P. Stage policy');
  {
    const P = cr.STAGE_POLICY;
    ['research', 'design', 'review'].forEach(function (s) {
      assert(P[s].tools.join(',') === 'Read,Glob,Grep' && P[s].writes === false && P[s].invokesClaude === true, 'P-1. ' + s + ' は Read,Glob,Grep・書込なし');
    });
    ['implement'].forEach(function (s) {
      assert(P[s].tools.join(',') === 'Read,Glob,Grep,Edit,Write' && P[s].writes === true, 'P-2. ' + s + ' は Read,Glob,Grep,Edit,Write');
    });
    assert(P.test.invokesClaude === false && P.test.tools.length === 0, 'P-3. Test stage は Claude を呼ばない');
    assert(Object.keys(P).every(function (s) { return !P[s].tools.some(function (t) { return /Bash|Web|Agent|mcp/.test(t); }); }), 'P-4. どの stage にも Bash / Web / Agent / MCP は無い');
    assert(['Bash', 'WebFetch', 'WebSearch', 'Agent', 'mcp__*'].every(function (t) { return cr.DENIED_TOOLS.indexOf(t) !== -1; }), 'P-5. DENIED_TOOLS に Bash / WebFetch / WebSearch / Agent / mcp__*');
    assert(cr.PERMISSION_MODE === 'dontAsk' && Object.isFrozen(P) && Object.isFrozen(P.research.tools), 'P-6. permission mode は dontAsk・policy は frozen');
    assert(cr.UNVERIFIED_CLI_BEHAVIORS.length === 8 && Object.isFrozen(cr.UNVERIFIED_CLI_BEHAVIORS), 'P-7. 4C 未確認の 8 点を UNVERIFIED_CLI_BEHAVIORS として区別');
    assert(!('fix' in P) && !('rereview' in P) && cr.CLAUDE_STAGES.join(',') === 'research,design,implement,review', 'P-8. V1 は no-auto-fix：Runner の実行可能 stage は research / design / implement / review だけ');
    assert(cr.buildRunnerArgs(argsInput('research', { stage: 'fix' })).error === 'stage_not_runnable' && cr.buildRunnerSettings({ stage: 'rereview', worktreeRoot: WT, mainRepoRoot: MAIN, allowedPaths: [], forbiddenPaths: [] }).error === 'stage_not_runnable', 'P-9. fix / rereview の args・settings は構築できない');
  }

  caseHeader('A. buildRunnerArgs / validateRunnerArgs');
  {
    const r = cr.buildRunnerArgs(argsInput('research'));
    const a = r.args || [];
    assert(r.ok && a[0] === '-p' && valOf(a, '--output-format') === 'json' && valOf(a, '--input-format') === 'text' && r.promptVia === 'stdin', 'A-1. -p・json 出力・prompt は stdin');
    assert(valOf(a, '--permission-mode') === 'dontAsk' && valOf(a, '--tools') === 'Read,Glob,Grep' && a.indexOf('--allowedTools') === -1 && a.indexOf('--allowed-tools') === -1, 'A-2. dontAsk・--tools は stage policy・範囲指定のない --allowedTools は付けない');
    assert(valOf(a, '--disallowedTools') === 'Bash,WebFetch,WebSearch,Agent,mcp__*', 'A-3. --disallowedTools に禁止 tool');
    assert(a.indexOf('--strict-mcp-config') !== -1 && valOf(a, '--mcp-config') === '{"mcpServers":{}}', 'A-4. strict MCP ＋ 空の mcpServers');
    assert(a.indexOf('--safe-mode') !== -1 && a.indexOf('--restricted') !== -1 && a.indexOf('--setting-sources') === -1 && a.indexOf('--disable-slash-commands') !== -1 && JSON.parse(valOf(a, '--settings')).permissions.defaultMode === 'dontAsk', 'A-5. safe-mode・restricted・setting-sources なし・専用 settings・slash commands 無効');
    assert(valOf(a, '--session-id') === UUID && JSON.stringify(JSON.parse(valOf(a, '--json-schema'))) === JSON.stringify(cr.buildOutputSchema('research')) && valOf(a, '--max-budget-usd') === '1', 'A-6. stage ごとの session-id・json-schema・max-budget');
    assert(['-c', '--continue', '-r', '--resume', '-w', '--worktree', '--add-dir', '--dangerously-skip-permissions', '--allow-dangerously-skip-permissions', 'bypassPermissions', '--allowedTools', '--setting-sources'].every(function (f) { return a.indexOf(f) === -1; }), 'A-7. -c / -r / -w / --add-dir / bypass 系 / --allowedTools / --setting-sources を含まない');
    assert(a.indexOf('--no-session-persistence') === -1 && r.unverified.length === 8, 'A-8. --no-session-persistence は既定で付けない（4C 未確認のため必須にしない）・未確認点を返す');
    const np = cr.buildRunnerArgs(argsInput('research', { noSessionPersistence: true }));
    assert(np.ok && np.args.indexOf('--no-session-persistence') !== -1, 'A-8b. 明示指定時だけ --no-session-persistence を付与');
    const im = cr.buildRunnerArgs(argsInput('implement'));
    assert(im.ok && valOf(im.args, '--tools') === 'Read,Glob,Grep,Edit,Write', 'A-9. implement は Edit,Write を含む');
    assert(Object.isFrozen(r) && Object.isFrozen(r.args), 'A-10. 返り値は frozen');
    assert(cr.buildRunnerArgs(argsInput('research', { extra: 1 })).error === 'unexpected_input_keys' && cr.buildRunnerArgs({ stage: 'research' }).error === 'missing_input_keys', 'A-11. 未知 key / 欠落 key は拒否');
    assert(cr.buildRunnerArgs(argsInput('test')).error === 'stage_not_runnable' && cr.buildRunnerArgs(argsInput('deploy')).error === 'stage_not_runnable', 'A-12. test / 未知 stage は拒否');
    assert(cr.buildRunnerArgs(argsInput('research', { sessionId: 'abc' })).error === 'session_id_invalid', 'A-13. session id は UUID のみ');
    assert(cr.buildRunnerArgs(argsInput('research', { outputSchema: cr.buildOutputSchema('design') })).error === 'output_schema_mismatch', 'A-14. stage と schema の不一致は拒否');
    const bypass = JSON.parse(JSON.stringify(settingsFor('research').settings)); bypass.permissions.defaultMode = 'bypassPermissions';
    const bashAllow = JSON.parse(JSON.stringify(settingsFor('research').settings)); bashAllow.permissions.allow.push('Bash(git *)');
    const editInRead = JSON.parse(JSON.stringify(settingsFor('research').settings)); editInRead.permissions.allow.push('Edit(tools/**)');
    const extraKey = Object.assign({ hooks: {} }, settingsFor('research').settings);
    assert([bypass, bashAllow, editInRead, extraKey].every(function (s) { return cr.buildRunnerArgs(argsInput('research', { settings: s })).error === 'settings_invalid'; }), 'A-15. settings：bypass / Bash allow / 読取 stage の Edit allow / 未知 key は拒否');
    assert([0, -1, 6, NaN, '1'].every(function (b) { return cr.buildRunnerArgs(argsInput('research', { maxBudgetUsd: b })).error === 'max_budget_invalid'; }), 'A-16. max budget は 0 < x ≤ 5 の数値のみ');
    assert(cr.buildRunnerArgs(argsInput('research', { model: 'gpt-4; rm -rf' })).error === 'model_invalid' && cr.buildRunnerArgs(argsInput('research', { model: 'sonnet' })).ok, 'A-17. model は allowlist 形式のみ');
    assert(cr.buildRunnerArgs(argsInput('research', { appendSystemPrompt: '' })).error === 'append_system_prompt_invalid', 'A-18. append system prompt 空は拒否');
    const V = cr.validateRunnerArgs;
    const base = r.args.slice();
    assert(!V(base.concat(['--dangerously-skip-permissions'])).ok && !V(base.concat(['--allow-dangerously-skip-permissions'])).ok
      && !V(base.map(function (x) { return x === 'dontAsk' ? 'bypassPermissions' : x; })).ok, 'A-19. bypass 系フラグ・値を検出');
    assert(['-c', '--resume', '-w', '--add-dir', '--bare'].every(function (f) { return !V(base.concat([f])).ok; }), 'A-20. -c / --resume / -w / --add-dir / --bare を検出');
    const allowedAdded = V(base.concat(['--allowedTools', 'Read'])), allowedAlias = V(base.concat(['--allowed-tools', 'Read'])), srcAdded = V(base.concat(['--setting-sources', 'project']));
    assert(!allowedAdded.ok && allowedAdded.errors.indexOf('forbidden_flag:--allowedTools') !== -1 && !allowedAlias.ok && allowedAlias.errors.indexOf('forbidden_flag:--allowed-tools') !== -1
      && !srcAdded.ok && srcAdded.errors.indexOf('forbidden_flag:--setting-sources') !== -1, 'A-20b. --allowedTools / --allowed-tools / --setting-sources の追加を明示の理由で拒否');
    assert(!V(base.filter(function (x) { return x !== '--strict-mcp-config'; })).ok && !V(base.concat(['--permission-mode', 'dontAsk'])).ok
      && !V(base.map(function (x) { return x === 'Read,Glob,Grep' ? 'Read,Bash' : x; })).ok, 'A-21. strict MCP 欠落 / permission mode 重複 / Bash tool を検出');
    function without(flag, hasValue) { const c = base.slice(); const i = c.indexOf(flag); c.splice(i, hasValue ? 2 : 1); return c; }
    function setVal(flag, v) { const c = base.slice(); c[c.indexOf(flag) + 1] = v; return c; }
    const lax = JSON.parse(valOf(base, '--settings')); lax.permissions.allow.push('Bash');
    const laxRead = JSON.parse(valOf(base, '--settings')); laxRead.permissions.allow.push('Read');
    const tampered = [
      without('--safe-mode', false), without('--restricted', false), without('--disable-slash-commands', false), without('--settings', true), without('--disallowedTools', true),
      base.concat(['--restricted']), setVal('--settings', JSON.stringify(lax)), setVal('--settings', JSON.stringify(laxRead)),
      setVal('--disallowedTools', 'WebFetch'), setVal('--output-format', 'text'), setVal('--tools', 'Read'), setVal('--settings', 'not json'),
      base.concat(['--tools', 'Read,Glob,Grep']), base.concat(['--tools=Read,Glob,Grep,Bash']), setVal('--max-budget-usd', '50'),
    ];
    assert(tampered.every(function (t) { return !V(t).ok; }), 'A-22. 制限 flag（--restricted を含む）の欠落・改変・重複・--x=y 形式・settings の緩和（Bash / Read allow）をすべて検出（tool 制限が緩まない）');
    const noRestricted = V(without('--restricted', false));
    assert(noRestricted.errors.indexOf('missing:--restricted') !== -1 && V(base.concat(['--restricted'])).errors.indexOf('duplicated:--restricted') !== -1, 'A-22b. --restricted の欠落・重複を明示の理由で検出');
    assert(V(base).ok && V(cr.buildRunnerArgs(argsInput('implement')).args).ok, 'A-23. builder の出力そのものは検査を通る');
    assert(cr.buildRunnerArgs(argsInput('research', { maxBudgetUsd: 2, approvedRemainingBudgetUsd: 1.5 })).error === 'max_budget_exceeds_approved_remaining'
      && cr.buildRunnerArgs(argsInput('research', { approvedRemainingBudgetUsd: 0 })).error === 'approved_remaining_budget_invalid'
      && cr.buildRunnerArgs((function () { const x = argsInput('research'); delete x.approvedRemainingBudgetUsd; return x; })()).error === 'missing_input_keys', 'A-24. --max-budget-usd は承認済み run budget の残額以内（5 は絶対上限であり承認ではない）');
    function withAllow(stage, rule) { const s = JSON.parse(JSON.stringify(settingsFor(stage).settings)); s.permissions.allow.push(rule); return s; }
    const readAllows = ['Read', 'Glob', 'Grep', 'Read(**)', 'Read(//c/**)', 'Glob(*)'];
    assert(readAllows.every(function (rule) { const v = cr.validateRunnerSettings(withAllow('research', rule), 'research'); return !v.ok && v.errors.indexOf('read_allow_rule_forbidden') !== -1; })
      && readAllows.every(function (rule) { return cr.buildRunnerArgs(argsInput('research', { settings: withAllow('research', rule) })).error === 'settings_invalid'; }), 'A-25. 範囲指定の有無にかかわらず Read / Glob / Grep の allow を拒否');
    const unscopedEdit = cr.validateRunnerSettings(withAllow('implement', 'Edit'), 'implement'), unscopedWrite = cr.validateRunnerSettings(withAllow('implement', 'Write'), 'implement');
    assert(!unscopedEdit.ok && unscopedEdit.errors.indexOf('unscoped_write_allow') !== -1 && !unscopedWrite.ok && cr.validateRunnerSettings(settingsFor('implement').settings, 'implement').ok, 'A-26. implement でも範囲指定のない Edit / Write allow は拒否・path 指定の allow は通る');
    const addDirs = JSON.parse(JSON.stringify(settingsFor('research').settings)); addDirs.permissions.additionalDirectories = ['C:\\other'];
    const addDirsTop = Object.assign({ additionalDirectories: ['C:\\other'] }, JSON.parse(JSON.stringify(settingsFor('research').settings)));
    assert(!cr.validateRunnerSettings(addDirs, 'research').ok && !cr.validateRunnerSettings(addDirsTop, 'research').ok
      && cr.buildRunnerArgs(argsInput('research', { settings: addDirs })).error === 'settings_invalid', 'A-27. settings による追加作業ディレクトリ（additionalDirectories）は拒否');
  }

  caseHeader('E. buildRunnerEnv（allowlist・deny 優先・値を出さない）');
  {
    const SECRET = 'sk-SECRETVALUE-123456';
    const parent = {
      Path: 'C:\\Windows', SystemRoot: 'C:\\Windows', USERPROFILE: 'C:\\Users\\hp', HOME: 'C:\\Users\\hp', APPDATA: 'C:\\a', LOCALAPPDATA: 'C:\\l', TEMP: 'C:\\t', TMP: 'C:\\t',
      CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'sess', CLAUDE_CODE_MESSAGING_TOKEN: SECRET, CLAUDE_PID: '9', CLAUDE_EFFORT: 'high',
      ANTHROPIC_BASE_URL: 'http://proxy', ANTHROPIC_API_KEY: SECRET, SUPABASE_URL: 'x', OPENAI_API_KEY: SECRET, GITHUB_TOKEN: SECRET,
      MY_SECRET: SECRET, GIT_DIR: 'x', NODE_OPTIONS: '--require x', RANDOM_VAR: 'x',
    };
    const before = JSON.stringify(parent);
    const r = cr.buildRunnerEnv(parent);
    const keys = Object.keys(r.env).sort();
    assert(r.ok && JSON.stringify(keys) === JSON.stringify(['APPDATA', 'DISABLE_UPDATES', 'HOME', 'LOCALAPPDATA', 'Path', 'SystemRoot', 'TEMP', 'TMP', 'USERPROFILE']), 'E-1. allowlist の候補＋固定の DISABLE_UPDATES だけ残る（' + keys.join(',') + '）');
    assert(['CLAUDECODE', 'CLAUDE_CODE_SESSION_ID', 'CLAUDE_CODE_MESSAGING_TOKEN', 'CLAUDE_PID', 'CLAUDE_EFFORT'].every(function (k) { return !(k in r.env); }), 'E-2. CLAUDECODE / CLAUDE_* を引き継がない');
    assert(!('ANTHROPIC_BASE_URL' in r.env) && !('ANTHROPIC_API_KEY' in r.env), 'E-3. ANTHROPIC_BASE_URL / 不要な ANTHROPIC_API_KEY を引き継がない');
    assert(['SUPABASE_URL', 'OPENAI_API_KEY', 'GITHUB_TOKEN', 'MY_SECRET', 'GIT_DIR', 'NODE_OPTIONS', 'RANDOM_VAR'].every(function (k) { return !(k in r.env) && r.dropped.indexOf(k) !== -1; }), 'E-4. SUPABASE / OPENAI / *_TOKEN / *_SECRET / GIT_* / NODE_OPTIONS / 無関係 env を除外');
    assert(JSON.stringify({ dropped: r.dropped, unverified: r.unverifiedNecessity }).indexOf(SECRET) === -1 && JSON.stringify(r).indexOf(SECRET) === -1, 'E-5. 結果に secret の値を含めない（dropped は名前だけ）');
    assert(r.unverifiedNecessity.join(',') === 'HOME,USERPROFILE,APPDATA,LOCALAPPDATA', 'E-6. HOME / USERPROFILE / APPDATA / LOCALAPPDATA は必要性未確認の候補として明示');
    const k = cr.buildRunnerEnv(parent, { allowAnthropicApiKey: true });
    assert(k.ok && k.env.ANTHROPIC_API_KEY === SECRET && !('ANTHROPIC_BASE_URL' in k.env), 'E-7. API key は明示 opt-in 時だけ（Human 判断事項）・BASE_URL は常に除外');
    assert(r.containsCredential === false && k.containsCredential === true && k.envNames.indexOf('ANTHROPIC_API_KEY') !== -1
      && JSON.stringify({ envNames: k.envNames, dropped: k.dropped }).indexOf(SECRET) === -1, 'E-7b. 子へ渡す env は opt-in 時だけ credential を含む（containsCredential で明示）・診断用の envNames / dropped は名前だけで値を含まない');
    assert(!cr.buildRunnerEnv({ PATH: 'a', Path: 'b' }).ok && !cr.buildRunnerEnv(parent, { other: 1 }).ok && !cr.buildRunnerEnv(null).ok, 'E-8. 大小違い重複 / 未知 opts / 不正入力は fail-closed');
    assert(JSON.stringify(parent) === before, 'E-9. parentEnv を mutation しない');
    const ov = cr.buildRunnerEnv(Object.assign({}, parent, { DISABLE_UPDATES: '0' })), ovLower = cr.buildRunnerEnv(Object.assign({}, parent, { disable_updates: '0' }));
    assert(cr.RUNNER_ENV_FIXED.DISABLE_UPDATES === '1' && Object.isFrozen(cr.RUNNER_ENV_FIXED) && r.env.DISABLE_UPDATES === '1' && k.env.DISABLE_UPDATES === '1'
      && ov.ok && ov.env.DISABLE_UPDATES === '1' && ov.dropped.indexOf('DISABLE_UPDATES') !== -1 && ovLower.ok && ovLower.env.DISABLE_UPDATES === '1' && !('disable_updates' in ovLower.env), 'E-10. DISABLE_UPDATES=1 を固定付与・親 env の値（大小違いを含む）で上書きできない');
    const fixedOnly = Object.keys(r.env).filter(function (x) { return cr.RUNNER_ENV_ALLOWLIST.indexOf(x.toUpperCase()) === -1; });
    assert(fixedOnly.join(',') === 'DISABLE_UPDATES' && Object.keys(cr.RUNNER_ENV_FIXED).every(function (x) { return !/(KEY|TOKEN|SECRET|AUTH|CREDENTIAL|^ANTHROPIC_|^CLAUDE_)/i.test(x); }) && r.containsCredential === false, 'E-11. allowlist 外で付与するのは DISABLE_UPDATES だけ（認証 env を追加しない）');
  }

  caseHeader('G. buildRunnerSettings');
  {
    const rs = settingsFor('research');
    const d = rs.settings.permissions.deny, al = rs.settings.permissions.allow;
    assert(rs.ok && rs.settings.permissions.defaultMode === 'dontAsk' && al.length === 0 && d.indexOf('Edit') !== -1 && d.indexOf('Write') !== -1, 'G-1. 読取 stage は allow 空（範囲指定のない Read/Glob/Grep allow なし）・Edit/Write を deny');
    assert(['Bash', 'WebFetch', 'WebSearch', 'Agent', 'Read(**/.env*)', 'Edit(**/.git/**)', 'Read(~/.claude/**)'].every(function (x) { return d.indexOf(x) !== -1; })
      && ['Read', 'Edit', 'Write'].every(function (t) { return d.indexOf(t + '(//c/Users/hp/ENBISOU_AI/ai-company/**)') !== -1; })
      && !d.some(function (x) { return /\/\/[A-Za-z]:/.test(x); }), 'G-2. Bash/Web/Agent・.env・.git・~/.claude・main repo の絶対 path（公式 docs の //c/... 形式）を deny・//C:/ 形式は出さない');
    assert(['cost-logs.json', 'data/conversations/_meta.json'].every(function (p) { return d.indexOf('Edit(' + p + ')') !== -1 && d.indexOf('Write(' + p + ')') !== -1; }), 'G-3. Protected を Edit / Write deny');
    const im = settingsFor('implement');
    assert(im.ok && im.settings.permissions.allow.indexOf('Edit(tools/devAutopilot/**)') !== -1 && im.settings.permissions.deny.indexOf('Edit(server.js)') !== -1
      && im.settings.permissions.deny.indexOf('Edit') === -1 && !im.settings.permissions.allow.some(function (x) { return /^(Read|Glob|Grep|Edit|Write)$/.test(x) || /^(Read|Glob|Grep)\(/.test(x); }), 'G-4. implement は allowedPaths だけ Edit/Write allow（Read 系 allow・範囲指定なしの allow なし）・forbiddenPaths を deny');
    assert(settingsFor('implement', { allowedPaths: [] }).error === 'allowed_paths_required_for_write_stage', 'G-5. 書込 stage で allowedPaths 空は拒否');
    assert(settingsFor('research', { worktreeRoot: MAIN + '\\wt' }).error === 'worktree_main_overlap' && settingsFor('research', { worktreeRoot: MAIN }).error === 'worktree_main_overlap', 'G-6. worktree と main の重なりは拒否');
    assert(settingsFor('implement', { allowedPaths: ['../x'] }).error === 'scope_invalid' && settingsFor('implement', { allowedPaths: ['C:\\x'] }).error === 'scope_invalid', 'G-7. traversal / 絶対 path の scope は拒否');
    assert(cr.buildRunnerSettings({ stage: 'research', worktreeRoot: WT, mainRepoRoot: MAIN, allowedPaths: [], forbiddenPaths: [], extra: 1 }).error === 'input_keys_invalid' && settingsFor('test').error === 'stage_not_runnable', 'G-8. 未知 key / test stage は拒否');
    assert(rs.pathRuleSyntaxUnverified === true, 'G-9. permission rule の path 構文は 4C 未確認と明示');
    function mainDeny(mainRoot) { const s = cr.buildRunnerSettings({ stage: 'research', worktreeRoot: WT, mainRepoRoot: mainRoot, allowedPaths: [], forbiddenPaths: [] }); return s.ok ? s.settings.permissions.deny.filter(function (x) { return /^Read\(\/\//.test(x); }) : ['ERR:' + s.error]; }
    assert(mainDeny('D:\\Work\\Repo\\').join() === 'Read(//d/Work/Repo/**)' && mainDeny('C:/Users/hp/ENBISOU_AI/ai-company').join() === 'Read(//c/Users/hp/ENBISOU_AI/ai-company/**)'
      && mainDeny('C:\\Users\\hp\\ENBISOU_AI\\ai-company\\.\\').join() === 'ERR:root_invalid', 'G-10. 絶対 path rule は drive 小文字・/ 区切り・末尾区切りなしに正規化（区切り・末尾の違いで揺れない）・. / .. を含む root は rule を作らず拒否');
  }

  caseHeader('R. buildStagePrompt');
  {
    function ctx(stage, extra) {
      return Object.assign({ taskId: 'task-4b-001', stage: stage, worktreeRoot: WT, allowedPaths: ['tools/devAutopilot/'], forbiddenPaths: ['server.js'],
        objective: 'add helper', acceptanceCriteria: ['tests pass'], previousOutputs: {}, stopConditions: ['Protected would change'] }, extra || {});
    }
    const r = cr.buildStagePrompt(ctx('research'));
    const p = r.ok ? JSON.parse(r.prompt) : {};
    assert(r.ok && ['taskId', 'stage', 'worktreeRoot', 'allowedPaths', 'forbiddenPaths', 'protectedContract', 'objective', 'acceptanceCriteria', 'previousOutputs', 'outputSchema', 'stopConditions'].every(function (k) { return k in p; }), 'R-1. prompt に必須項目がすべて含まれる');
    assert(p.protectedContract && p.protectedContract.paths.length === 10 && JSON.stringify(p.outputSchema) === JSON.stringify(cr.buildOutputSchema('research')), 'R-2. Protected 契約 10件・output schema');
    assert(r.ok && r.prompt.indexOf('ai-company') === -1 && !('repoRoot' in p) && !('mainRepoRoot' in p), 'R-3. main repo root を作業先として含めない');
    const im = cr.buildStagePrompt(ctx('implement', { previousOutputs: { research: out('research'), design: out('design') } }));
    assert(im.ok && JSON.parse(im.prompt).writes === true, 'R-4. implement は前 stage（research・design）の構造化出力を受け取る');
    assert(cr.buildStagePrompt(ctx('implement', { previousOutputs: { research: out('research') } })).error === 'previous_outputs_mismatch'
      && cr.buildStagePrompt(ctx('design', { previousOutputs: { research: out('research'), design: out('design') } })).error === 'previous_outputs_mismatch', 'R-5. 前 stage 出力の欠落・余分は拒否');
    assert(/^previous_output_invalid:research/.test(cr.buildStagePrompt(ctx('design', { previousOutputs: { research: out('research', { status: 'maybe' }) } })).error), 'R-6. 不正な前 stage 出力は拒否');
    assert(cr.buildStagePrompt(ctx('research', { acceptanceCriteria: [] })).error === 'acceptance_criteria_invalid' && cr.buildStagePrompt(ctx('research', { stopConditions: [] })).error === 'stop_conditions_invalid', 'R-7. acceptance criteria / STOP 条件の欠落は拒否');
    assert(cr.buildStagePrompt(ctx('research', { repoRoot: MAIN })).error === 'ctx_keys_invalid' && cr.buildStagePrompt(ctx('test')).error === 'stage_not_runnable' && cr.buildStagePrompt(ctx('research', { taskId: 'Bad_ID' })).error === 'task_id_invalid', 'R-8. 未知 key / test stage / 不正 taskId は拒否');
    assert(cr.buildStagePrompt(ctx('implement', { allowedPaths: [], previousOutputs: { research: out('research'), design: out('design') } })).error === 'scope_invalid', 'R-9. 書込 stage の allowedPaths 空は拒否');
  }

  caseHeader('O. validateStageOutput（厳格な再 validation）');
  {
    const V = cr.validateStageOutput;
    assert(V('research', out('research')).ok && V('implement', out('implement', { files_changed: ['tools/devAutopilot/x.js'] })).ok, 'O-1. 正しい出力は ok');
    assert(has(V('research', Object.assign(out('research'), { note: 'x' })).errors, 'unknown_keys') && has(V('research', (function () { const o = out('research'); delete o.risks; return o; })()).errors, 'missing_keys'), 'O-2. 未知 key / 欠落 key は拒否');
    assert(has(V('research', out('design')).errors, 'stage_mismatch') && has(V('research', out('research', { status: 'done' })).errors, 'status_invalid'), 'O-3. stage 不一致 / status 不正');
    assert(has(V('research', out('research', { requires_human: true })).errors, 'ok_inconsistent') && has(V('research', out('research', { status: 'stop' })).errors, 'stop_requires_reason')
      && has(V('research', out('research', { status: 'needs_human' })).errors, 'needs_human_requires_flag'), 'O-4. status と requires_human / stop_reason の矛盾は拒否');
    assert(has(V('review', out('review', { files_changed: ['a.js'] })).errors, 'read_only_stage_reported_changes'), 'O-5. 読取 stage の files_changed は拒否');
    assert(has(V('implement', out('implement', { files_changed: ['../x.js'] })).errors, 'files_changed_invalid') && has(V('implement', out('implement', { files_read: ['C:\\x'] })).errors, 'files_read_invalid'), 'O-6. traversal / 絶対 path は拒否');
    assert(has(V('review', out('review', { proposed_tests: ['npm run dev-check'] })).errors, 'proposed_tests_invalid') && has(V('review', out('review', { requires_human: 'no' })).errors, 'requires_human_invalid'), 'O-7. proposed_tests はファイル名のみ・型違いは拒否');
    assert(!V('test', out('test')).ok && !V('research', null).ok && !V('research', []).ok, 'O-8. test stage / 非 object は拒否');
  }

  caseHeader('V. parseRunnerEnvelope（未実測フィールドは仮定・欠落は null）');
  {
    const P = cr.parseRunnerEnvelope;
    const good = P(JSON.stringify({ type: 'result', is_error: false, structured_output: out('research'), session_id: UUID, total_cost_usd: 0.12, permission_denials: [], num_turns: 3 }));
    assert(good.ok && good.isError === false && good.structuredSource === 'structured_output' && good.costUsd === 0.12 && good.permissionDenials === 0 && good.sessionId === UUID, 'V-1. 仮定フィールドを解析');
    const viaResult = P(JSON.stringify({ is_error: false, result: JSON.stringify(out('research')) }));
    assert(viaResult.ok && viaResult.structuredSource === 'result_json' && viaResult.costUsd === null && viaResult.permissionDenials === null, 'V-2. structured_output が無ければ result の JSON を読む・欠落値は null');
    assert(P('not json').error === 'envelope_not_json' && P('[1]').error === 'envelope_not_object' && P('').error === 'stdout_empty' && P(null).error === 'stdout_not_string', 'V-3. 不正な envelope は fail-closed');
    assert(P('{"a":1}').ok && P('{"a":1}').structuredOutput === null && P('{"a":1}').unknownFields.join(',') === 'a', 'V-4. 未知フィールドは記録し、必須と決め打ちしない');
    assert(good.assumptions.length === cr.ASSUMED_ENVELOPE_FIELDS.length && P(JSON.stringify({ total_cost_usd: -1 })).costUsd === null, 'V-5. 仮定を明示・不正な費用値は null（費用不明）');
    const st = function (raw) { return P(raw).apiErrorStatus; };
    assert(st('{}').state === 'absent' && st('{"api_error_status":null}').state === 'null' && st('{"api_error_status":401}').state === 'number' && st('{"api_error_status":401}').value === 401
      && st('{"api_error_status":"401"}').state === 'wrong_type' && st('{"api_error_status":true}').state === 'wrong_type', 'V-6. api_error_status の欠落 / null / 有効な数値 / 型不正を区別');
    assert(['401.5', '1e999', '-1e999', '99', '600', '0'].every(function (n) { const s = st('{"api_error_status":' + n + '}'); return s.state === 'invalid_number' && s.value === undefined; }), 'V-7. 小数・Infinity・範囲外の数値は有効な HTTP status として扱わない');
    const mu = P(JSON.stringify({ modelUsage: { 'claude-haiku-4-5-20251001': { inputTokens: 12, outputTokens: 34, costUSD: 0.01 }, 'secret-looking-model/../x': { inputTokens: 1 } } }));
    assert(mu.modelUsage.state === 'ok' && mu.modelUsage.models.join(',') === 'claude-haiku-4-5-20251001' && mu.modelUsage.unlistedCount === 1
      && JSON.stringify(mu).indexOf('secret-looking-model') === -1 && JSON.stringify(mu).indexOf('inputTokens') === -1, 'V-8. modelUsage は既知の識別子だけ記録・未知は件数だけ・本文や token 内訳を保持しない');
    assert(P('{}').modelUsage.state === 'absent' && P('{"modelUsage":[]}').modelUsage.state === 'wrong_type' && P('{"modelUsage":{}}').modelUsage.models.length === 0, 'V-9. modelUsage の欠落 / 型不正 / 空を区別（観測用・失敗条件にしない）');
    const extra = P(JSON.stringify({ is_error: false, session_id: UUID, usage: {}, uuid: 'u', fast_mode_state: 'off', terminal_reason: 'completed', duration_ms: 1, duration_api_ms: 1, stop_reason: 'end_turn' }));
    assert(extra.ok && ['usage', 'uuid', 'fast_mode_state', 'terminal_reason', 'duration_ms'].every(function (k) { return extra.unknownFields.indexOf(k) !== -1; }) && P('{"is_error":false}').ok, 'V-10. 追加 key は記録するだけで必須にしない');
    assert(P('{}').sessionIdState === 'absent' && P('{"session_id":7}').sessionIdState === 'wrong_type' && P('{"session_id":7}').sessionId === null && P(JSON.stringify({ session_id: UUID })).sessionIdState === 'string', 'V-11. session_id の欠落 / 型不正を区別');
  }

  caseHeader('D. validatePostRunDiff（snapshot 比較）');
  {
    const HASH = 'aaaaaaaaaaaa', FP = 'd1fd4bd36f69', GIT = 'bbbbbbbbbbbb';
    function snap(entries, extra) { return Object.assign({ worktreeHead: BASE, branchTip: BASE, worktreeBranchRef: 'refs/heads/dev/task-4b-001', changedEntries: entries || [], mainAutopilotStatusHash: HASH, mainProtectedFingerprint: FP, gitFileHash: GIT }, extra || {}); }
    function contract(stage, extra) { return Object.assign({ stage: stage, allowedPaths: ['tools/devAutopilot/'], forbiddenPaths: ['tools/devAutopilot/runStore.js'], baseHead: BASE, branchRef: 'refs/heads/dev/task-4b-001', expectedMainAutopilotStatusHash: HASH, expectedProtectedFingerprint: FP }, extra || {}); }
    function e(p, extra) { return Object.assign({ path: p, status: 'modified', hash: 'cccccccccccc', isSymlink: false }, extra || {}); }
    function D(stage, afterEntries, afterExtra, beforeEntries, cExtra) { return cr.validatePostRunDiff({ contract: contract(stage, cExtra), before: snap(beforeEntries || []), after: snap(afterEntries, afterExtra) }); }
    assert(D('implement', [e('tools/devAutopilot/x.js')]).result === 'ok', 'D-1. allowedPaths 内の変更は ok');
    assert(D('review', [e('tools/devAutopilot/x.js')]).result === 'blocked', 'D-2. 読取 stage の変更は blocked');
    assert(has(D('implement', [e('cost-logs.json')]).reasons, 'protected_path') && has(D('implement', [e('tools/devAutopilot/.env.local')]).reasons, 'env_file'), 'D-3. Protected / .env は blocked');
    assert(has(D('implement', [e('.git/config')]).reasons, 'git_internal') && has(D('implement', [e('server.js')]).reasons, 'outside_allowed_paths') && has(D('implement', [e('tools/devAutopilot/runStore.js')]).reasons, 'forbidden_path'), 'D-4. .git 内部 / scope 外 / forbidden は blocked');
    assert(has(D('implement', [e('tools/devAutopilot/link.js', { isSymlink: true })]).reasons, 'symlink_or_junction'), 'D-5. symlink / junction は blocked');
    assert(has(D('implement', [], { mainAutopilotStatusHash: 'ffffffffffff' }).reasons, 'main_status_changed') && has(D('implement', [], { mainProtectedFingerprint: 'ffffffffffff' }).reasons, 'main_protected_changed'), 'D-6. main の autopilotStatusHash / Protected 変化は blocked');
    assert(has(D('implement', [], { worktreeHead: OTHER }).reasons, 'worktree_head_moved') && has(D('implement', [], { branchTip: OTHER }).reasons, 'branch_tip_moved') && has(D('implement', [], { gitFileHash: 'dddddddddddd' }).reasons, 'worktree_git_file_changed'), 'D-7. HEAD / branch tip / .git file の変化は blocked');
    assert(D('implement', [], { changedEntries: undefined }).reasons[0] === 'observation_incomplete' && cr.validatePostRunDiff({ contract: contract('implement'), before: null, after: snap([]) }).result === 'blocked'
      && D('implement', [], { mainProtectedFingerprint: undefined }).result === 'blocked', 'D-8. snapshot の欠落・型違いは blocked（観測不足）');
    assert(D('implement', [e('tools/devAutopilot/package.json')]).result === 'human_approval_required' && D('implement', [e('tools/devAutopilot/x.js', { status: 'deleted', hash: null })]).result === 'human_approval_required', 'D-9. package.json / 削除は human_approval_required');
    assert(has(D('implement', [], {}, [e('tools/devAutopilot/y.js')]).reasons, 'change_disappeared') && D('implement', [e('tools/devAutopilot/y.js')], {}, [e('tools/devAutopilot/y.js')]).changedPaths.length === 0, 'D-10. 既存変更の消失は blocked・不変の既存変更は新規扱いしない');
    assert(D('implement', [e('tools/devAutopilot/x.js')], {}, [], { baseHead: 'HEAD' }).result === 'blocked' && D('test', []).result === 'blocked', 'D-11. contract 不正 / test stage は blocked');
    assert(has(D('implement', [e('tools/devAutopilotEvil/x.js')]).reasons, 'outside_allowed_paths') && has(D('implement', [e('tools/devAutopilot.js')]).reasons, 'outside_allowed_paths'), 'D-12. 親子 path の誤判定なし（prefix 一致の兄弟 dir / 同名 file は scope 外）');
    assert(has(D('implement', [e('COST-LOGS.JSON')]).reasons, 'protected_path') && D('implement', [e('TOOLS/DEVAUTOPILOT/X.JS')]).result === 'ok', 'D-13. 大文字小文字は同一視（Protected も scope も case-insensitive）');
    assert(D('implement', [e('tools\\devAutopilot\\x.js')]).reasons[0] === 'observation_incomplete' && D('implement', [e('tools/devAutopilot/../../server.js')]).reasons[0] === 'observation_incomplete'
      && D('implement', [e('C:/Users/x.js')]).reasons[0] === 'observation_incomplete', 'D-14. backslash / traversal / 絶対 path の entry は観測不正として blocked');
    const exact = cr.validatePostRunDiff({ contract: contract('implement', { allowedPaths: ['tools/devAutopilot/a.js'] }), before: snap([]), after: snap([e('tools/devAutopilot/a.js.bak')]) });
    assert(has(exact.reasons, 'outside_allowed_paths'), 'D-15. file 指定の allowedPaths は完全一致のみ（a.js で a.js.bak を許可しない）');
  }

  caseHeader('F. classifyRunnerFailure（runStore への対応・retry 0）');
  {
    const okEnv = cr.parseRunnerEnvelope(JSON.stringify({ is_error: false, structured_output: out('research'), session_id: UUID, total_cost_usd: 0.1, permission_denials: [] }));
    const budget = { capUsd: 5, spentUsd: 0, invocations: 0, maxInvocations: 6, costUnknown: false };
    const diffOk = { result: 'ok', reasons: [], changedPaths: [] };
    function F(extra) { return cr.classifyRunnerFailure(Object.assign({ stage: 'research', exitCode: 0, timedOut: false, envelope: okEnv, outputValidation: { ok: true, errors: [] }, postRunDiff: diffOk, budget: budget, expectedSessionId: UUID }, extra || {})); }
    const ok = F();
    assert(ok.outcome === 'ok' && ok.runStoreAction === 'none' && ok.retry === 0, 'F-1. 正常は ok（retry 0）');
    assert(F({ exitCode: 1 }).outcome === 'failed' && F({ exitCode: 1 }).runStoreAction === 'failRun', 'F-2. non-zero exit → failed（failRun）');
    assert(F({ envelope: Object.assign({}, okEnv, { isError: true }) }).outcome === 'failed', 'F-3. CLI error（is_error）→ failed');
    assert(F({ timedOut: true, exitCode: null }).outcome === 'failed', 'F-4. timeout・変更なし → failed');
    assert(F({ timedOut: true, exitCode: null, postRunDiff: { result: 'ok', reasons: [], changedPaths: ['tools/devAutopilot/x.js'] } }).outcome === 'blocked'
      && F({ timedOut: true, exitCode: null, postRunDiff: undefined }).outcome === 'blocked', 'F-5. timeout 後に変更が残る / 差分不明 → blocked');
    assert(F({ envelope: { ok: false, error: 'envelope_not_json' } }).outcome === 'blocked' && F({ outputValidation: { ok: false, errors: ['x'] } }).outcome === 'blocked', 'F-6. 不正な envelope / 出力 → blocked（blockRun）');
    assert(F({ envelope: Object.assign({}, okEnv, { permissionDenials: 2 }) }).outcome === 'blocked' && has(F({ envelope: Object.assign({}, okEnv, { permissionDenials: 2 }) }).reasons, 'forbidden_tool_attempted'), 'F-7. 禁止 tool の試行記録 → blocked');
    assert(F({ envelope: Object.assign({}, okEnv, { permissionDenials: null }) }).outcome === 'blocked' && F({ envelope: Object.assign({}, okEnv, { isError: null }) }).outcome === 'blocked', 'F-8. 拒否記録 / is_error が観測できない → blocked（4C で確定）');
    assert(F({ postRunDiff: { result: 'blocked', reasons: ['protected_path:x'] } }).outcome === 'blocked' && F({ exitCode: 1, postRunDiff: { result: 'blocked', reasons: ['x'] } }).outcome === 'blocked', 'F-9. 境界違反 → blocked（non-zero より優先）');
    assert(F({ envelope: Object.assign({}, okEnv, { costUsd: null }) }).outcome === 'human_approval_required' && F({ budget: Object.assign({}, budget, { costUnknown: true }) }).runStoreAction === 'requireHumanApproval', 'F-10. 費用不明 → human_approval_required');
    assert(F({ budget: Object.assign({}, budget, { spentUsd: 4.95 }) }).outcome === 'human_approval_required' && F({ budget: Object.assign({}, budget, { invocations: 6 }) }).outcome === 'human_approval_required', 'F-11. 上限到達 / invocation 超過 → human_approval_required');
    assert(F({ budget: Object.assign({}, budget, { invocations: 5 }) }).outcome === 'ok', 'F-11b. 上限ちょうど（6 回目）の正常 invocation は ok');
    assert(F({ budget: undefined }).outcome === 'blocked' && F({ exitCode: undefined }).outcome === 'blocked' && cr.classifyRunnerFailure(null).outcome === 'blocked', 'F-12. 観測不足 → blocked');
    assert([F({ exitCode: 1 }), F({ outputValidation: null }), F({ budget: Object.assign({}, budget, { costUnknown: true }) })].every(function (x) { return x.retry === 0; }), 'F-13. どの分類でも自動 retry は 0');
    function envWith(o) { return cr.parseRunnerEnvelope(JSON.stringify({ is_error: false, structured_output: o, session_id: UUID, total_cost_usd: 0.1, permission_denials: [] })); }
    assert(F({ envelope: envWith(out('review', { status: 'stop', stop_reason: 'needs change' })) }).outcome === 'human_approval_required'
      && F({ envelope: envWith(out('review', { status: 'needs_human', requires_human: true })) }).outcome === 'human_approval_required', 'F-14. Claude の stop / needs_human は human_approval_required（review の stop も自動 Fix 扱いにしない）');
    const noSo = F({ envelope: cr.parseRunnerEnvelope(JSON.stringify({ is_error: false, session_id: UUID, total_cost_usd: 0.1, permission_denials: [] })) });
    assert(noSo.outcome === 'blocked' && has(noSo.reasons, 'structured_output_missing'), 'F-15. 構造化出力が無ければ blocked');

    // ── C. Stage 4C 実測応答に基づくエラー応答 / エラー分類 / session 照合（値は汎用 fixture。実測値に固定しない）──
    const OTHER_UUID = '2c5f39cb-3ab2-4e4c-b4a6-f02ac6b8744c';
    function errEnv(extra, omit) {
      const o = Object.assign({ type: 'result', subtype: 'success', is_error: true, api_error_status: 401, session_id: UUID, total_cost_usd: 0, permission_denials: [], num_turns: 1, modelUsage: {}, result: 'error text' }, extra || {});
      (omit || []).forEach(function (k) { delete o[k]; });
      return cr.parseRunnerEnvelope(JSON.stringify(o));
    }
    const badOv = { ok: false, errors: ['output_not_object'] };   // 呼び出し側が構造化出力なしで validate した場合
    const e1 = F({ exitCode: 1, envelope: errEnv(), outputValidation: badOv });
    assert(e1.outcome === 'failed' && has(e1.reasons, 'cli_error_401') && has(e1.reasons, 'non_zero_exit') && !has(e1.reasons, 'output_invalid') && !has(e1.reasons, 'structured_output_missing'),
      'C-1. exit 1・is_error=true・subtype=success・structured_output 欠落 → failed（401）・成功 schema 違反にしない');
    const e2 = F({ exitCode: 0, envelope: errEnv({ api_error_status: 403 }), outputValidation: badOv });
    assert(e2.outcome === 'failed' && has(e2.reasons, 'cli_error_403') && !has(e2.reasons, 'cli_error_401') && !has(e2.reasons, 'output_invalid') && !has(e2.reasons, 'structured_output_missing'),
      'C-2. exit 0・is_error=true（403）・structured_output 欠落 → failed（blocked の出力不正にしない・401 と区別）');
    const e3 = F({ exitCode: 1, envelope: errEnv(), outputValidation: badOv, postRunDiff: { result: 'blocked', reasons: ['protected_path:x'] } });
    assert(e3.outcome === 'blocked' && e3.runStoreAction === 'blockRun' && has(e3.reasons, 'post_run_diff_blocked') && has(e3.reasons, 'cli_error_401')
      && e3.reasons.indexOf('post_run_diff_blocked') < e3.reasons.indexOf('cli_error_401'), 'C-3. Safety 違反と 401 の同時発生 → Safety 優先で blocked・401 の詳細も保持');
    function detail(extra, omit) { return F({ exitCode: 1, envelope: errEnv(extra, omit), outputValidation: badOv }); }
    const d429 = detail({ api_error_status: 429 }), dBud = detail({ subtype: 'error_max_budget_usd' }, ['api_error_status']), d500 = detail({ api_error_status: 500 });
    assert(has(d429.reasons, 'cli_error_429') && !has(d429.reasons, 'cli_error_budget_stop') && has(dBud.reasons, 'cli_error_budget_stop') && !has(dBud.reasons, 'cli_error_429') && !has(dBud.reasons, 'cli_error_unclassified')
      && has(d500.reasons, 'cli_error_status_other') && [d429, dBud, d500].every(function (x) { return x.outcome === 'failed' && x.retry === 0; }), 'C-4. 429 / CLI 予算上限停止 / その他を別の理由で区別（429 と予算停止をまとめない・retry 0）');
    const dAbs = detail({}, ['api_error_status']), dNull = detail({ api_error_status: null }), dStr = detail({ api_error_status: '401' }), dFrac = detail({ api_error_status: 401.5 }), dRange = detail({ api_error_status: 99 });
    assert(has(dAbs.reasons, 'cli_error_unclassified:absent') && has(dNull.reasons, 'cli_error_unclassified:null') && has(dStr.reasons, 'cli_error_unclassified:wrong_type')
      && has(dFrac.reasons, 'cli_error_unclassified:invalid_number') && has(dRange.reasons, 'cli_error_unclassified:invalid_number') && !has(dStr.reasons, 'cli_error_401'), 'C-5. api_error_status の欠落 / null / 型不正 / 不正数値は分類不能（文字列 "401" を 401 扱いしない）');
    const dText = detail({ result: 'HTTP 401 rate limit exceeded; buy credits' }, ['api_error_status']);
    assert(has(dText.reasons, 'cli_error_unclassified:absent') && !has(dText.reasons, 'cli_error_401') && !has(dText.reasons, 'cli_error_429'), 'C-6. result 本文から推測分類しない');
    const s1 = F({ expectedSessionId: undefined }), s2 = F({ expectedSessionId: 'not-a-uuid' });
    assert(s1.outcome === 'blocked' && has(s1.reasons, 'expected_session_id_invalid') && s2.outcome === 'blocked' && has(s2.reasons, 'expected_session_id_invalid'), 'C-7. expectedSessionId の欠落・不正 → blocked');
    const sEnv = function (sid, omit) { const o = { is_error: false, structured_output: out('research'), total_cost_usd: 0.1, permission_denials: [] }; if (!omit) o.session_id = sid; return cr.parseRunnerEnvelope(JSON.stringify(o)); };
    const sMiss = F({ envelope: sEnv(null, true) }), sType = F({ envelope: sEnv(123) }), sBad = F({ envelope: sEnv('abc') }), sMis = F({ envelope: sEnv(OTHER_UUID) }), sOk = F({ envelope: sEnv(UUID) });
    assert(sMiss.outcome === 'blocked' && has(sMiss.reasons, 'session_id_missing') && has(sType.reasons, 'session_id_invalid') && has(sBad.reasons, 'session_id_invalid')
      && sMis.outcome === 'blocked' && has(sMis.reasons, 'session_id_mismatch') && sOk.outcome === 'ok' && !sOk.reasons.some(function (r) { return /session/.test(r); }), 'C-8. 応答 session の欠落 / 型不正 / 不正 / 不一致 → blocked・一致なら ok');
    const sErr = F({ exitCode: 1, envelope: errEnv({ session_id: OTHER_UUID }), outputValidation: badOv });
    assert(sErr.outcome === 'blocked' && has(sErr.reasons, 'session_id_mismatch') && has(sErr.reasons, 'cli_error_401'), 'C-9. エラー応答でも session 照合を省略しない');
    const pTo = F({ timedOut: true, exitCode: null, envelope: undefined, outputValidation: undefined });
    const pExit = F({ exitCode: 1, envelope: { ok: false, error: 'stdout_empty' }, outputValidation: undefined });
    const pZero = F({ exitCode: 0, envelope: { ok: false, error: 'envelope_not_json' }, outputValidation: undefined });
    assert(pTo.outcome === 'failed' && has(pTo.reasons, 'timeout') && has(pTo.reasons, 'session_unverified_no_envelope') && !has(pTo.reasons, 'session_id_mismatch')
      && pExit.outcome === 'failed' && has(pExit.reasons, 'non_zero_exit') && has(pExit.reasons, 'session_unverified_no_envelope') && !has(pExit.reasons, 'session_id_mismatch')
      && pZero.outcome === 'blocked' && has(pZero.reasons, 'envelope_malformed'), 'C-10. envelope 未取得はプロセス障害＋session 未確認（不一致と捏造しない）・exit 0 の envelope 不正は blocked のまま');
    const cErr = F({ exitCode: 1, envelope: errEnv({}, ['total_cost_usd']), outputValidation: badOv });
    const dErr = F({ exitCode: 1, envelope: errEnv({ permission_denials: [{ tool: 'Bash' }] }), outputValidation: badOv });
    const nErr = F({ exitCode: 0, envelope: errEnv({}, ['permission_denials']), outputValidation: badOv });
    assert(has(cErr.reasons, 'cost_unknown') && dErr.outcome === 'blocked' && has(dErr.reasons, 'forbidden_tool_attempted')
      && nErr.outcome === 'blocked' && has(nErr.reasons, 'permission_denials_unknown'), 'C-11. エラー応答でも費用不明・禁止 tool 試行・拒否記録の欠落の検査を省略しない');
    function sucEnv(extra, omit) {
      const o = Object.assign({ type: 'result', subtype: 'success', is_error: false, api_error_status: null, session_id: UUID, total_cost_usd: 0.02, permission_denials: [], num_turns: 2,
        modelUsage: { 'claude-haiku-4-5-20251001': { inputTokens: 10 } }, structured_output: out('research'), usage: { x: 1 }, uuid: 'u', fast_mode_state: 'off', terminal_reason: 'completed', duration_ms: 1 }, extra || {});
      (omit || []).forEach(function (k) { delete o[k]; });
      return cr.parseRunnerEnvelope(JSON.stringify(o));
    }
    assert(F({ envelope: sucEnv() }).outcome === 'ok' && F({ envelope: sucEnv({ modelUsage: { 'claude-unknown-9': {} } }) }).outcome === 'ok' && F({ envelope: sucEnv({}, ['modelUsage']) }).outcome === 'ok'
      && F({ envelope: sucEnv({}, ['api_error_status']) }).outcome === 'ok', 'C-12. 正常応答：追加 key・未知 / 欠落 modelUsage・api_error_status 欠落だけでは失敗にしない');
    assert(F({ envelope: sucEnv({ num_turns: 9 }) }).outcome === 'ok' && !has(F({ envelope: sucEnv({ num_turns: 9 }) }).reasons, 'invocation_limit_exceeded')
      && has(F({ envelope: sucEnv({ num_turns: 1 }), budget: Object.assign({}, budget, { invocations: 6 }) }).reasons, 'invocation_limit_exceeded'), 'C-13. num_turns は invocation 回数に数えない（回数は budget.invocations だけ）');
    const probe2 = { probe: '4c-1', ok: true };
    const p2 = F({ envelope: sucEnv({ structured_output: probe2 }), outputValidation: cr.validateStageOutput('research', probe2) });
    assert(p2.outcome === 'blocked' && has(p2.reasons, 'output_invalid') && cr.validateStageOutput('research', out('research')).ok, 'C-14. probe の 2 項目 schema は Runner 出力として受け付けない・9 項目の正常出力は従来どおり ok');
  }

  caseHeader('I. Invocation plan（V1 no-auto-fix：research → design → implement → review のみ）');
  {
    const I = cr.validateInvocationPlan;
    // 'kind[:status[:runnerOutcome[:rh]]]'
    function h(list) { return list.map(function (x) { const p = x.split(':'); return { kind: p[0], status: p[1] || 'ok', runnerOutcome: p[2] || 'ok', requiresHuman: p[3] === 'rh' }; }); }
    const DONE = { testsPassedAfterLastChange: true, safetyReviewOk: true };
    const BASE4 = ['research', 'design', 'implement', 'review'];
    assert(cr.RUNNER_MAX_INVOCATIONS === 6 && has(I([], { maxInvocations: 7 }).errors, 'max_invocations_exceeds_v1_limit'), 'I-1. 6 は budget.maxInvocations の上限値としてのみ維持（修正ループの意味ではない）');
    assert(I([]).nextAllowed.join(',') === 'research' && I(h(['research'])).nextAllowed.join(',') === 'design' && I(h(['research', 'design', 'implement'])).nextAllowed.join(',') === 'review', 'I-2. 自動経路は research → design → implement → review');
    const four = I(h(BASE4), DONE);
    assert(four.ok && four.canAwaitCommit && four.count === 4 && four.nextAllowed.length === 0, 'I-3. review ok ＋ テスト PASS ＋ Safety ok なら awaiting_commit_approval へ進める（4 invocation）');
    assert(I(h(BASE4)).reason === 'tests_not_confirmed_after_last_change' && I(h(BASE4), { testsPassedAfterLastChange: true }).reason === 'safety_review_not_confirmed'
      && !I(h(BASE4), { testsPassedAfterLastChange: true, safetyReviewOk: false }).canAwaitCommit, 'I-4. 最後の変更後のテスト PASS と Safety 確認が観測されるまで進めない（観測は Orchestrator の責務）');
    const stop = I(h(['research', 'design', 'implement', 'review:stop']), DONE);
    assert(stop.ok && !stop.canAwaitCommit && stop.nextAllowed.length === 0 && stop.reason === 'handoff_to_human:review_stop', 'I-5. review の stop は Human へ引き渡す（fix へ進まない）');
    const nh = I(h(['research', 'design', 'implement', 'review:needs_human:ok:rh']), DONE);
    assert(nh.ok && !nh.canAwaitCommit && nh.nextAllowed.length === 0 && nh.reason === 'handoff_to_human:review_needs_human', 'I-6. review の needs_human は Human へ引き渡す');
    assert(I(h(['research', 'design', 'implement', 'review:ok:blocked']), DONE).reason === 'handoff_to_human:runner_blocked'
      && I(h(['research', 'design', 'implement', 'review:ok:ok:rh']), DONE).reason === 'handoff_to_human:review_requires_human'
      && !I(h(['research', 'design', 'implement', 'review:ok:human_approval_required']), DONE).canAwaitCommit, 'I-7. runner の blocked / human / requires_human は review ok でも進めない');
    assert(I(h(['research', 'design', 'implement', 'review:stop']), { fixAuthorizedByHuman: true }).errors[0] === 'opts_invalid', 'I-8. fixAuthorizedByHuman は受け付けない（Human 承認フラグによる Fix 許可経路なし）');
    const withFix = I(h(['research', 'design', 'implement', 'review:stop', 'fix']), DONE);
    const withRe = I(h(['research', 'design', 'implement', 'review:stop', 'rereview']), DONE);
    assert(!withFix.ok && has(withFix.errors, 'fix_not_supported_in_v1') && !withRe.ok && has(withRe.errors, 'rereview_not_supported_in_v1') && !withFix.canAwaitCommit, 'I-9. fix / rereview の入力は明確な理由で拒否');
    assert(has(I(h(['design'])).errors, 'out_of_order') && has(I(h(['research', 'research'])).errors, 'out_of_order') && has(I(h(BASE4.concat(['review']))).errors, 'v1_sequence_exceeded'), 'I-10. 順序違い・重複・4 段階超過は拒否');
    assert(has(I(h(['research:stop', 'design'])).errors, 'continued_after_non_ok') && has(I(h(['research:ok:blocked', 'design'])).errors, 'continued_after_runner_blocked')
      && has(I(h(['research:ok:ok:rh', 'design'])).errors, 'continued_after_requires_human'), 'I-11. ok 以外・runner 異常・requires_human の後に続けない');
    assert(I(h(['research', 'design', 'implement']), { maxInvocations: 3 }).reason === 'invocation_limit_reached' && has(I(h(BASE4), { maxInvocations: 3 }).errors, 'budget_invocation_limit_exceeded'), 'I-12. budget の maxInvocations を超えない');
    assert(has(I([{ kind: 'research', status: 'ok' }]).errors, 'entry_invalid') && I([], { other: 1 }).errors[0] === 'opts_invalid' && I([], { safetyReviewOk: 'yes' }).errors[0] === 'opts_invalid', 'I-13. entry 4 項目必須・未知 opts・型違いは拒否');
    assert(four.runStoreStage === 'reviewing' && I(h(['research', 'design', 'implement'])).runStoreStage === 'implementing', 'I-14. runStore の stage 名への対応');
    // 関数連結：review の構造化出力 → classifyRunnerFailure → validateInvocationPlan（Fix へ進む経路が無いこと）
    function chain(reviewOut) {
      const env = cr.parseRunnerEnvelope(JSON.stringify({ is_error: false, structured_output: reviewOut, session_id: UUID, total_cost_usd: 0.1, permission_denials: [] }));
      const ov = cr.validateStageOutput('review', reviewOut);
      const c = cr.classifyRunnerFailure({ stage: 'review', exitCode: 0, timedOut: false, envelope: env, outputValidation: ov, postRunDiff: { result: 'ok', reasons: [], changedPaths: [] },
        budget: { capUsd: 5, spentUsd: 0, invocations: 3, maxInvocations: 6, costUnknown: false }, expectedSessionId: UUID });
      const hist = h(['research', 'design', 'implement']).concat([{ kind: 'review', status: reviewOut.status, requiresHuman: reviewOut.requires_human, runnerOutcome: c.outcome }]);
      return { c: c, p: I(hist, DONE) };
    }
    const cs = chain(out('review', { status: 'stop', stop_reason: 'change needed' }));
    const cn = chain(out('review', { status: 'needs_human', requires_human: true }));
    const co = chain(out('review'));
    assert(cs.c.outcome === 'human_approval_required' && cs.p.nextAllowed.length === 0 && !cs.p.canAwaitCommit && /^handoff_to_human/.test(cs.p.reason)
      && cn.c.outcome === 'human_approval_required' && cn.p.nextAllowed.length === 0 && !cn.p.canAwaitCommit, 'I-15. 連結：review stop / needs_human → human_approval_required → Human へ引き渡し（fix 無し）');
    assert(co.c.outcome === 'ok' && co.p.canAwaitCommit, 'I-16. 連結：review ok → ok → テスト・Safety 観測済みなら awaiting_commit_approval');
    const direct = I(h(['research', 'design', 'implement', 'review:stop:ok']), DONE);
    assert(direct.nextAllowed.length === 0 && direct.reason === 'handoff_to_human:review_stop', 'I-17. 不整合な直接入力（stop なのに runner ok）でも fix へ進まない');
  }

  caseHeader('T. Test Boundary（mandatory safe ＋ 安全な提案・積集合ではない）');
  {
    const man = { tests: [{ file: 'a.test.js', class: 'safe' }, { file: 'b.test.js', class: 'safe' }, { file: 'c.test.js', class: 'conditional' }, { file: 'd.test.js', class: 'forbidden' }, { file: 'e.test.js', class: 'safe' }] };
    const sel = { selected: [{ file: 'a.test.js' }, { file: 'b.test.js' }], skippedUnsafe: [], uncoveredFiles: [], requiresHumanApproval: false, errors: [] };
    const S = cr.selectRunnerTests;
    const none = S({ selectorResult: sel, proposedTests: [], manifest: man });
    assert(none.ok && none.run.join(',') === 'a.test.js,b.test.js' && !none.requiresHuman, 'T-1. 提案が空でも mandatory safe tests を実行対象に保持');
    const disjoint = S({ selectorResult: sel, proposedTests: ['e.test.js'], manifest: man });
    assert(disjoint.run.join(',') === 'a.test.js,b.test.js,e.test.js', 'T-2. 積集合ではなく和集合（mandatory を削らず、safe な提案を追加）');
    const unsafe = S({ selectorResult: sel, proposedTests: ['c.test.js', 'd.test.js', 'z.test.js', 'npm run dev-check', '../x.test.js'], manifest: man });
    assert(unsafe.run.join(',') === 'a.test.js,b.test.js' && unsafe.rejected.length === 5 && unsafe.requiresHuman
      && has(unsafe.humanReasons, 'proposed_conditional_test') && has(unsafe.humanReasons, 'proposed_forbidden_test'), 'T-3. conditional / forbidden / 未登録 / dev-check / scope 外の提案は自動実行しない');
    assert(S({ selectorResult: Object.assign({}, sel, { selected: [{ file: 'c.test.js' }] }), proposedTests: [], manifest: man }).error === 'mandatory_not_safe'
      && S({ selectorResult: Object.assign({}, sel, { errors: ['x'] }), proposedTests: [], manifest: man }).error === 'selector_errors', 'T-4. mandatory に unsafe / selector error があれば fail-closed');
    assert(none.commands.every(function (c) { return c.file === 'node' && c.args.length === 1 && /\.test\.js$/.test(c.args[0]); }), 'T-5. command は node <file>.test.js のデータのみ（実行しない）');
    assert(S({ selectorResult: Object.assign({}, sel, { requiresHumanApproval: true }), proposedTests: ['a.test.js'], manifest: man }).requiresHuman && S({ selectorResult: sel, proposedTests: ['a.test.js'], manifest: man }).run.length === 2, 'T-6. selector の Human 要求を引き継ぐ・重複は 1 回');
    // 実 repo の manifest / testSelector（read-only）との結合
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'devAutopilot', 'testManifest.json'), 'utf8'));
    const real = ts.selectTests({ changedFiles: ['tools/devAutopilot/claudeRunner.js'], manifest: manifest, repoRoot: ROOT });
    const rt = S({ selectorResult: real, proposedTests: ['devAutopilotStep3B.test.js'], manifest: manifest });
    assert(rt.ok && rt.run.indexOf('devAutopilotStep4B.test.js') !== -1 && ts.BASELINE_TESTS.every(function (b) { return rt.run.indexOf(b) !== -1; })
      && rt.run.indexOf('devAutopilotStep3B.test.js') === -1 && rt.requiresHuman, 'T-7. 実 manifest：mandatory に Step4B と baseline・conditional の Step 3B 提案は実行対象外（Human 要求）');
  }

  caseHeader('M. Manifest 登録');
  {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'devAutopilot', 'testManifest.json'), 'utf8'));
    const e = manifest.tests.filter(function (t) { return t.file === 'devAutopilotStep4B.test.js'; });
    const b = manifest.tests.filter(function (t) { return t.file === 'devAutopilotStep3B.test.js'; });
    assert(e.length === 1 && e[0].class === 'safe' && e[0].deps.files.indexOf('tools/devAutopilot/claudeRunner.js') !== -1 && b[0].class === 'conditional', 'M-1. Step 4B test は safe 登録・Step 3B は conditional のまま');
  }

  caseHeader('Z. Protected 10件 hash 不変・sandbox 違反 0・env 不変');
  {
    const pv = pc.verify(protectedBefore, pc.snapshot(ROOT), PROTECTED_BASELINE);
    assert(pv.ok && PROTECTED_FILES.length === 10, 'Z-1. Protected 10件の hash が開始時・終了時とも baseline 一致（' + pv.mode + (pv.ok ? '' : ' ' + pv.reasons.join(',')) + '）');
    assert(violations.length === 0, 'Z-2. sandbox 違反 0（network / fs write / child_process / env file）' + (violations.length ? ' ' + violations.join(',') : ''));
    assert(JSON.stringify(Object.keys(process.env).sort().map(function (k) { return [k, process.env[k]]; })) === envSnapshotBefore, 'Z-3. process.env を変更していない');
  }

  console.log('\n────────────────────────────────────────────────────────────');
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exit(1); }
  console.log('🟢 All Development Autopilot Stage 4B cases passed');
})();
