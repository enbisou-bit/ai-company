'use strict';
// devAutopilotStep6B.test.js
// Development Autopilot V1 — Stage 4D（observers・realRepoPermit・orchestrator の隔離）を使い捨て temp repo の実 Git で確認する integration テスト。
//
//   ★ manifest 分類は conditional。Autopilot の自動実行対象にせず、Human が明示承認した場合だけ実行する（node devAutopilotStep6B.test.js）。
//     Stage 4D の時点では準備のみ・未実行（期待どおりに動くことは未確認）。
//   ★ Git の mutation（init / config / add / commit / update-ref / worktree add）は、このテストが OS temp に作った自己所有 sandbox の temp repo だけ。
//     本物の repo へは read-only Git だけ。本物の repo の worktree・Permit・audit（.autopilot）は使わない。
//   ★ Claude CLI は起動しない（spawn は差し替え）。test 実行も差し替え（ホストでモデル変更コードを実行する経路は使わない）。推論なし。
//   ★ 実行前後で本物の repo の HEAD / autopilotStatusHash / branch 数 / worktree 数 / Protected fingerprint を比較する。
//   ★ network / 危険 module / .env 読込は封鎖。fs write は sandbox の内側だけ。process.env は変更しない。後始末は owner marker 付き sandbox だけ。

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');
const cp = require('child_process');
const { EventEmitter } = require('events');

const ROOT = __dirname;
const violations = [];
const PROTECTED_FINGERPRINT = 'd1fd4bd36f69';

const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'devAutopilotStep6B-'));
const OWNER_MARKER = '.devautopilot-sandbox-owner';
const OWNER_TOKEN = crypto.randomBytes(16).toString('hex');
fs.writeFileSync(path.join(SANDBOX, OWNER_MARKER), OWNER_TOKEN);
const ORIG_RM = fs.rmSync;
function insideDir(p, dir) { const rel = path.relative(String(dir).toLowerCase(), path.resolve(String(p)).toLowerCase()); return rel === '' || (!!rel && rel.split(/[\\\/]/)[0] !== '..' && !path.isAbsolute(rel)); }
function insideSandbox(p) { return (typeof p === 'string' || p instanceof URL) && insideDir(String(p), SANDBOX); }

function blockedNetwork(name) { return function () { violations.push('network:' + name); throw new Error('SANDBOX_BLOCKED_NETWORK:' + name); }; }
['http', 'https'].forEach(function (m) { const mod = require(m); mod.request = blockedNetwork(m + '.request'); mod.get = blockedNetwork(m + '.get'); });
{ const net = require('net'); net.connect = blockedNetwork('net.connect'); net.createConnection = blockedNetwork('net.createConnection'); const tls = require('tls'); tls.connect = blockedNetwork('tls.connect'); }
globalThis.fetch = blockedNetwork('fetch');
function isEnvFile(p) { try { return /^\.env(\..*)?$/i.test(path.basename(String(p))); } catch (e) { return false; } }
['readFileSync', 'readFile', 'createReadStream'].forEach(function (n) {
  const orig = fs[n]; if (typeof orig !== 'function') return;
  fs[n] = function (p) { if (isEnvFile(p)) { violations.push('env_file_read:' + n); throw new Error('SANDBOX_BLOCKED_ENV_READ'); } return orig.apply(this, arguments); };
});
function guardedWrite(name, orig) {
  return function (a, b) {
    const two = /rename|copy|symlink|cp/i.test(name);
    if (insideSandbox(a) && (!two || insideSandbox(b))) return orig.apply(this, arguments);
    violations.push('fs_write:' + name + ':' + String(a)); throw new Error('SANDBOX_BLOCKED_FS_WRITE:' + name);
  };
}
['writeFileSync', 'appendFileSync', 'renameSync', 'unlinkSync', 'mkdirSync', 'rmSync', 'rmdirSync', 'copyFileSync', 'truncateSync', 'symlinkSync', 'cpSync',
  'writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir', 'copyFile', 'truncate', 'createWriteStream']
  .forEach(function (n) { if (typeof fs[n] === 'function') fs[n] = guardedWrite('fs.' + n, fs[n]); });
{ const origOpen = fs.openSync;
  fs.openSync = function (p, flags) {
    const f = flags === undefined ? 'r' : String(flags);
    if (f === 'r' || f === 'rs' || f === 'sr' || insideSandbox(p)) return origOpen.apply(this, arguments);
    violations.push('fs_write:fs.openSync:' + String(p)); throw new Error('SANDBOX_BLOCKED_FS_WRITE:fs.openSync');
  }; }
const BLOCKED_BARE = new Set(['axios', 'dotenv', '@supabase/supabase-js', '@anthropic-ai/sdk', 'http2', 'undici', 'node:http2']);
const origLoad = Module._load;
Module._load = function (request) { if (BLOCKED_BARE.has(request)) { violations.push('module:' + request); throw new Error('SANDBOX_BLOCKED_MODULE:' + request); } return origLoad.apply(this, arguments); };
const envKeysBefore = JSON.stringify(Object.keys(process.env).sort());

let _passed = 0, _failed = 0;
function assert(cond, label) { if (cond) { _passed++; console.log('  ✅ ' + label); } else { _failed++; console.log('  ❌ ' + label); } }
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const rs = require('./tools/devAutopilot/runStore');
const exe = require('./tools/devAutopilot/worktreeExecutor');
const wc = require('./tools/devAutopilot/worktreeController');
const pm = require('./tools/devAutopilot/realRepoPermit');
const ob = require('./tools/devAutopilot/observers');
const ha = require('./tools/devAutopilot/humanApproval');
const orch = require('./tools/devAutopilot/orchestrator');
const ex = require('./tools/devAutopilot/claudeExecutor');
const rc = require('./tools/devAutopilot/riskClassifier');

const CHILD_ENV = exe.buildGitChildEnv(process.env).env;
const FIXTURE_SUBCOMMANDS = ['init', 'config', 'add', 'commit', 'update-ref'];
function fixtureGit(repoDir, args) {
  if (!insideSandbox(repoDir) || insideDir(repoDir, ROOT) || FIXTURE_SUBCOMMANDS.indexOf(args[0]) === -1) { violations.push('fixture_git_refused:' + args[0]); throw new Error('FIXTURE_GIT_REFUSED'); }
  return cp.execFileSync('git', ['-C', repoDir].concat(args), { cwd: repoDir, env: CHILD_ENV, shell: false, windowsHide: true, timeout: 15000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}
function protectedFingerprint() {
  try { return crypto.createHash('md5').update(rc.PROTECTED_PATHS.map(function (f) { return crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, f))).digest('hex') + ' *' + f + '\n'; }).join('')).digest('hex').slice(0, 12); }
  catch (e) { return 'unreadable'; }
}
function cleanupSandbox() {
  let token = null;
  try { token = fs.readFileSync(path.join(SANDBOX, OWNER_MARKER), 'utf8'); } catch (e) { return { ok: false, error: 'owner_marker_missing' }; }
  if (token !== OWNER_TOKEN || !insideDir(SANDBOX, os.tmpdir()) || insideDir(SANDBOX, ROOT)) return { ok: false, error: 'not_own_sandbox' };
  try { ORIG_RM(SANDBOX, { recursive: true, force: true, maxRetries: 3 }); } catch (e) { return { ok: false, error: 'rm_failed:' + e.code }; }
  let gone = false; try { fs.statSync(SANDBOX); } catch (e) { gone = e.code === 'ENOENT'; }
  return gone ? { ok: true } : { ok: false, error: 'residue' };
}

const REPO = path.join(SANDBOX, 'repo');
const AUDIT = path.join(SANDBOX, '.autopilot');
const WT_ROOT = path.join(AUDIT, 'wt');
const TASK = 'task-6b-001';
const U = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const H64 = (c) => c.repeat(64);

(async function main() {
  let realBefore = null;
  try {
    caseHeader('0. 前提（sandbox は本物の repo の外）');
    assert(!insideDir(SANDBOX, ROOT) && insideDir(SANDBOX, os.tmpdir()) && protectedFingerprint() === PROTECTED_FINGERPRINT, '0-1. sandbox は OS temp 配下・本物の repo の Protected は開始時 baseline');
    realBefore = exe.readRepoState(ROOT);
    assert(realBefore.ok, '0-2. 本物の repo を read-only で実測');

    caseHeader('X. fixture（temp repo：Protected 相当 10件・origin/main = HEAD）');
    fs.mkdirSync(REPO); fs.mkdirSync(AUDIT); fs.mkdirSync(path.join(AUDIT, 'permits')); fs.mkdirSync(WT_ROOT);
    fixtureGit(REPO, ['init', '-q', '-b', 'main']);
    fixtureGit(REPO, ['config', 'user.name', 'devautopilot-fixture']); fixtureGit(REPO, ['config', 'user.email', 'devautopilot-fixture@example.invalid']); fixtureGit(REPO, ['config', 'commit.gpgsign', 'false']);
    rc.PROTECTED_PATHS.forEach(function (f) { fs.mkdirSync(path.dirname(path.join(REPO, f)), { recursive: true }); fs.writeFileSync(path.join(REPO, f), '{"fixture":"' + f + '"}\n'); });
    fs.mkdirSync(path.join(REPO, 'docs')); fs.writeFileSync(path.join(REPO, 'docs', 'guide.md'), '# guide\n');
    fixtureGit(REPO, ['add', '--', 'docs/guide.md', 'cost-logs.json', 'data/conversations/_meta.json']);   // 一部だけ tracked（本物と同じく残りは untracked）
    fixtureGit(REPO, ['commit', '-q', '-m', 'fixture']);
    const head = exe.readRepoState(REPO).head;
    fixtureGit(REPO, ['update-ref', 'refs/remotes/origin/main', head]);
    const obs = ob.createObservers({ repoPath: REPO, homeDir: path.join(SANDBOX, 'home') });
    const m = obs.observeMain();
    assert(m && m.head === head && m.originMain === head && /^[0-9a-f]{12}$/.test(m.protectedFingerprint), 'X-1. observeMain（実 Git）：HEAD = origin/main・Protected fingerprint');

    caseHeader('I. 隔離（Permit 消費 → worktree add → 作成直後の検証 → isolation 確定）と 4 stage（spawn 差し替え）');
    const pmd5 = obs.protectedMd5Map(REPO);
    const wp = wc.deriveWorktreePath(WT_ROOT, TASK, REPO), br = wc.deriveBranchName(TASK);
    const store = { runtimeRoot: AUDIT, repoPath: REPO };
    const run0 = rs.createInitialRun({ taskId: TASK, task: { title: 't', goal: 'g', allowedPaths: ['docs/'], forbiddenPaths: [] }, mainRepoPath: REPO, baseHead: head, branch: br.branch,
      worktreePath: wp.worktreePath, budget: { capUsd: 5, maxInvocations: 4 }, mainStatusHashAtStart: m.autopilotStatusHash, protectedMd5AtStart: pmd5, now: new Date(Date.now() - 60000).toISOString() }).run;
    rs.createRun(store, run0);
    const id = exe.readRepoIdentity(REPO);
    const now = new Date().toISOString();
    const bp = pm.buildPermit({ repoIdentity: id.repoIdentity, expectedHead: head, expectedOriginMain: head, taskId: TASK, worktreeRoot: WT_ROOT, protectedFingerprint: m.protectedFingerprint,
      autopilotStatusHash: m.autopilotStatusHash, approvedBy: 'human', approvedAt: now, ttlMs: 10 * 60000, now: now });
    const permitStore = { root: path.join(AUDIT, 'permits'), repoPath: REPO };
    pm.writePermit(permitStore, bp.permit, { now: now });
    const ap = ha.buildRunApproval({ approvalId: U(900), run: run0, stages: orch.CLAUDE_STAGES.slice(), exeSha256: H64('a'), cliVersion: '2.1.280 (Claude Code)', maxInvocations: 4,
      maxBudgetUsdPerInvocation: 0.5, issuedAt: new Date(Date.now() - 30000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() });
    ha.writeApprovalRecord({ root: AUDIT }, ha.wrapRecord(ha.KIND_RUN, ap.approval));
    const queue = orch.CLAUDE_STAGES.slice(), transcripts = {};
    const spawn = function (exePath, args, so) {
      const ch = new EventEmitter(); ch.pid = 4242; ch.stdout = new EventEmitter(); ch.stderr = new EventEmitter();
      ch.stdin = { on: function () {}, end: function () {} }; ch.kill = function () { setTimeout(function () { ch.emit('exit', null, 'SIGKILL'); ch.emit('close'); }, 1); return true; };
      const sid = args[args.indexOf('--session-id') + 1], stage = queue.shift(), rstage = ex.RUNNER_STAGE[stage];
      setTimeout(function () {
        if (stage === 'implementing') fs.writeFileSync(path.join(so.cwd, 'docs', 'guide.md'), '# guide\nupdated\n');   // worktree 内の許可範囲だけ（sandbox 内）
        const calls = [{ id: 'r1', name: 'Read', input: { file_path: path.join(so.cwd, 'docs', 'guide.md') } }].concat(stage === 'implementing' ? [{ id: 'e1', name: 'Edit', input: { file_path: path.join(so.cwd, 'docs', 'guide.md') } }] : []);
        transcripts[sid] = calls.map(function (c) { return JSON.stringify({ type: 'assistant', sessionId: sid, message: { content: [{ type: 'tool_use', id: c.id, name: c.name, input: c.input }] } }) + '\n'
          + JSON.stringify({ type: 'user', sessionId: sid, message: { content: [{ type: 'tool_result', tool_use_id: c.id, is_error: false, content: 'r' }] } }); }).join('\n');
        const out = { stage: rstage, status: 'ok', summary: 'done', files_read: ['docs/guide.md'], files_changed: stage === 'implementing' ? ['docs/guide.md'] : [], proposed_tests: [], risks: [], requires_human: false, stop_reason: null };
        ch.stdout.emit('data', Buffer.from(JSON.stringify({ type: 'result', subtype: 'success', is_error: false, api_error_status: null, session_id: sid, total_cost_usd: 0.01, num_turns: 1, permission_denials: [],
          modelUsage: {}, structured_output: out, result: '' })));
        ch.emit('exit', 0, null); ch.emit('close', 0, null);
      }, 5);
      return ch;
    };
    const events = [];
    let testsRun = 0;
    const r = await orch.runOrchestration({
      store: store, auditRoot: AUDIT, approvalStore: { root: AUDIT }, permitStore: permitStore, taskId: TASK, ownerId: U(501), pid: process.pid, clock: function () { return new Date().toISOString(); },
      permitId: bp.permit.permitId, runApprovalId: U(900), worktreeRoot: WT_ROOT, mutationRepoAllowlist: [REPO],
      cli: { exePath: path.join(SANDBOX, 'fake-claude.exe'), exeSha256: H64('a'), cliVersion: '2.1.280 (Claude Code)' },
      builds: { researching: { objective: 'o', acceptanceCriteria: ['a'], stopConditions: ['s'], appendSystemPrompt: 'Follow the ENBISOU Autopilot contract.', maxBudgetUsd: 0.5 },
        designing: { objective: 'o', acceptanceCriteria: ['a'], stopConditions: ['s'], appendSystemPrompt: 'Follow the ENBISOU Autopilot contract.', maxBudgetUsd: 0.5 },
        implementing: { objective: 'o', acceptanceCriteria: ['a'], stopConditions: ['s'], appendSystemPrompt: 'Follow the ENBISOU Autopilot contract.', maxBudgetUsd: 0.5 },
        reviewing: { objective: 'o', acceptanceCriteria: ['a'], stopConditions: ['s'], appendSystemPrompt: 'Follow the ENBISOU Autopilot contract.', maxBudgetUsd: 0.5 } },
      parentEnv: process.env, limits: { timeoutMs: 5000, heartbeatMs: 60000, killWaitMs: 200, drainWaitMs: 200, stdoutMax: 256 * 1024, stderrMax: 1024 },
      testApprovalWaitMs: 5000, pollMs: 10, onEvent: function (e) { events.push(e); },
      deps: {
        git: exe, permit: pm, spawn: spawn,
        observers: Object.assign({}, obs, { hashFile: function () { return H64('a'); }, readTranscript: function (sid) { return transcripts[sid] || null; } }),
        selectTests: function () { return { selected: ['devAutopilotStep6A.test.js'], errors: [], requiresHumanApproval: false }; },
        readWorktreeLines: function (run, p) { try { return fs.readFileSync(path.join(run.worktreePath, p), 'utf8').split(/\r?\n/); } catch (e) { return null; } },
        runTests: function (x) { testsRun++; return { ok: true, results: x.files.map(function (f) { return { file: f, exitCode: 0, timedOut: false, outputBytes: 0 }; }) }; },   // ホストでは実行しない
        randomUUID: crypto.randomUUID,
        sleep: async function () {
          const req = events.filter(function (e) { return e.type === 'test_approval_required'; }).pop();
          if (!req || events.issued) return; events.issued = true;
          const run = rs.readRun(store, TASK).run;
          const bt = ha.buildTestApproval({ approvalId: req.approvalId, run: run, diffSha256: req.diffSha256, testFiles: req.testFiles, issuedAt: new Date(Date.now() - 1000).toISOString(), expiresAt: new Date(Date.now() + 600000).toISOString() });
          ha.writeApprovalRecord({ root: AUDIT }, ha.wrapRecord(ha.KIND_TEST, bt.approval));
        },
      },
    });
    const done = rs.readRun(store, TASK).run;
    assert(r.ok && done.gate === 'awaiting_commit_approval' && done.isolation.state === 'verified' && testsRun === 1, 'I-1. 実 Git の temp repo で隔離 → 4 stage → test（差し替え）→ commit 承認待ち（' + (r.error || 'ok') + '）');
    assert(fs.existsSync(path.join(AUDIT, 'permits', bp.permit.permitId + '.consumed.json')) && !fs.existsSync(path.join(AUDIT, 'permits', bp.permit.permitId + '.json')), 'I-2. Permit は consumed に原子的 rename（single-use）');
    const w = obs.observeWorktree(done);
    assert(w && w.changedEntries.length === 1 && w.changedEntries[0].path === 'docs/guide.md' && w.worktreeBranchRef === 'refs/heads/' + br.branch && w.worktreeHead === head, 'I-3. observeWorktree（実 Git）：変更 1 件・branch・HEAD');
    const snap = obs.worktreeProtectedSnapshot(done);
    assert(snap.ok && snap.entries['cost-logs.json'] !== 'absent' && snap.entries['claude-cost-logs.json'] === 'absent', 'I-4. worktree 内 Protected：tracked は存在・untracked は不在');
  } catch (e) {
    _failed++; console.log('  ❌ 例外: ' + (e && e.message ? e.message : String(e)));
  } finally {
    caseHeader('C. 後始末（自己所有 sandbox のみ）・本物の repo 不変');
    const realAfter = exe.readRepoState(ROOT);
    assert(realBefore && realAfter.ok && realAfter.head === realBefore.head && realAfter.autopilotStatusHash === realBefore.autopilotStatusHash
      && realAfter.branchRefs.length === realBefore.branchRefs.length && realAfter.worktreeCount === realBefore.worktreeCount, 'C-1. 本物の repo の HEAD・status hash・branch 数・worktree 数が不変');
    assert(protectedFingerprint() === PROTECTED_FINGERPRINT, 'C-2. 本物の repo の Protected fingerprint 不変');
    assert(violations.length === 0, 'C-3. sandbox 違反 0' + (violations.length ? ' ' + violations.join(',') : ''));
    assert(JSON.stringify(Object.keys(process.env).sort()) === envKeysBefore, 'C-4. process.env を変更していない');
    const cl = cleanupSandbox();
    assert(cl.ok, 'C-5. 自己所有 sandbox（temp repo・worktree を含む）を後始末' + (cl.ok ? '' : '（' + cl.error + ' / ' + SANDBOX + '）'));
    console.log('\n────────────────────────────────────────────────────────────');
    console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
    if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
    else console.log('🟢 All Development Autopilot Stage 4D (temp repo) cases passed');
  }
})();
