'use strict';
// devAutopilotStep6A.test.js
// Development Autopilot V1 — Stage 4D（observers・humanApproval・approveCli・auditGuard・orchestrator・testRunner・
//   StructuredOutput 条件付き判定・commit 承認待ちの条件）の deterministic テスト。
//
//   ★ 実行は必ずこのファイル名を明示指定する（node devAutopilotStep6A.test.js）。
//   ★ Claude CLI・API・child_process・Git・network・fs write（OS temp を含む）は冒頭で封鎖する。
//     git・spawn・観測・Permit・test 実行はすべて差し替え、run / 承認 / audit はメモリ上の偽 fs だけに書く。
//   ★ process.env は変更しない。Protected 10件の hash を開始時・終了時に read-only で取得し、全件一致を assert する。

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
  'symlinkSync', 'cpSync', 'writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'mkdtemp', 'rm', 'rmdir', 'copyFile', 'truncate', 'createWriteStream', 'writeSync', 'fsyncSync']
  .forEach(function (n) { if (typeof fs[n] === 'function') fs[n] = blockedWrite('fs.' + n); });
{ const origOpen = fs.openSync;
  fs.openSync = function (p, flags) {
    const f = flags === undefined ? 'r' : String(flags);
    if (f === 'r' || f === 'rs' || f === 'sr') return origOpen.apply(this, arguments);
    violations.push('fs_write:fs.openSync:' + String(p)); throw new Error('SANDBOX_BLOCKED_FS_WRITE:fs.openSync');
  }; }
const BLOCKED_BARE = new Set(['axios', 'dotenv', '@supabase/supabase-js', '@anthropic-ai/sdk', 'http2', 'undici', 'child_process', 'node:http2', 'node:child_process']);
const origLoad = Module._load;
Module._load = function (request) {
  if (BLOCKED_BARE.has(request)) { violations.push('module:' + request); throw new Error('SANDBOX_BLOCKED_MODULE:' + request); }
  return origLoad.apply(this, arguments);
};
const envSnapshotBefore = JSON.stringify(Object.keys(process.env).sort().map(function (k) { return [k, process.env[k]]; }));

let _passed = 0, _failed = 0;
function assert(cond, label) { if (cond) { _passed++; console.log('  ✅ ' + label); } else { _failed++; console.log('  ❌ ' + label); } }
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }
const clone = (o) => JSON.parse(JSON.stringify(o));

const rs = require('./tools/devAutopilot/runStore');
const ex = require('./tools/devAutopilot/claudeExecutor');
const tc = require('./tools/devAutopilot/transcriptCheck');
const ha = require('./tools/devAutopilot/humanApproval');
const ag = require('./tools/devAutopilot/auditGuard');
const orch = require('./tools/devAutopilot/orchestrator');
const tr = require('./tools/devAutopilot/testRunner');
const ob = require('./tools/devAutopilot/observers');
const cli = require('./tools/devAutopilot/approveCli');
const rc = require('./tools/devAutopilot/riskClassifier');
const wc = require('./tools/devAutopilot/worktreeController');
const { EventEmitter } = require('events');

// ── fixture（すべて人工値）──
const HEAD = 'd30f88b5e1282b58b1cc208a26b949cd381dfe6a';
const OTHER = '1d657815ca52dec1ba6ef319c7642a955fbf99b6';
const U = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const H64 = (ch) => ch.repeat(64);
const REPO = 'C:\\Users\\hp\\ENBISOU_AI\\ai-company';
const AUDIT = 'C:\\enbisou-s4d-fake\\.autopilot';
const WT_ROOT = AUDIT + '\\wt';
const MAIN_OK = { autopilotStatusHash: '8226124a93f0', protectedFingerprint: 'd1fd4bd36f69' };
const OWNER = U(501);
const CLI = { exePath: 'C:\\fake\\claude.exe', exeSha256: H64('a'), cliVersion: '2.1.280 (Claude Code)' };
const iso = (ms) => new Date(Date.now() + ms).toISOString();

// メモリ上の偽 fs（runStore・humanApproval・auditGuard が使う操作だけ）
function memFs() {
  const files = new Map(), dirs = new Set(), links = new Set(), fds = new Map(); let fdSeq = 100;
  const norm = (p) => path.win32.resolve(String(p)).toLowerCase();
  const err = (code) => { const e = new Error(code); e.code = code; return e; };
  const api = { hooks: {} };
  const stat = (n) => ({ isFile: () => files.has(n), isDirectory: () => dirs.has(n), isSymbolicLink: () => links.has(n), size: files.has(n) ? Buffer.byteLength(files.get(n)) : 0 });
  api.mkdirSync = function (p) { let n = norm(p); while (!dirs.has(n) && path.win32.dirname(n) !== n) { dirs.add(n); n = path.win32.dirname(n); } };
  api.statSync = function (p) { const n = norm(p); if (files.has(n) || dirs.has(n) || links.has(n)) return stat(n); throw err('ENOENT'); };
  api.lstatSync = api.statSync;
  api.readdirSync = function (p) {
    const n = norm(p); if (!dirs.has(n)) throw err('ENOENT');
    const out = new Set();
    [files, dirs, links].forEach(function (s) { (s instanceof Map ? Array.from(s.keys()) : Array.from(s)).forEach(function (k) { if (k !== n && path.win32.dirname(k) === n) out.add(path.win32.basename(k)); }); });
    return Array.from(out).sort();
  };
  api.openSync = function (p, flags) {
    const n = norm(p); if (!dirs.has(path.win32.dirname(n))) throw err('ENOENT');
    if (flags === 'wx') { if (files.has(n)) throw err('EEXIST'); files.set(n, ''); } else if (!files.has(n)) throw err('ENOENT');
    const fd = fdSeq++; fds.set(fd, n); return fd;
  };
  api.writeSync = function (fd, data) { const n = fds.get(fd); files.set(n, files.get(n) + String(data)); };
  api.fsyncSync = function () {}; api.closeSync = function (fd) { fds.delete(fd); };
  api.renameSync = function (a, b) { const na = norm(a), nb = norm(b); if (!files.has(na)) throw err('ENOENT'); files.set(nb, files.get(na)); files.delete(na); };
  api.unlinkSync = function (p) { const n = norm(p); if (!files.delete(n)) throw err('ENOENT'); };
  api.readFileSync = function (p, enc) { const n = norm(p); if (!files.has(n)) throw err('ENOENT'); return enc ? files.get(n) : Buffer.from(files.get(n)); };
  api.put = function (p, c) { api.mkdirSync(path.win32.dirname(p)); files.set(norm(p), c); };
  api.get = function (p) { return files.get(norm(p)); };
  api.has = function (p) { return files.has(norm(p)); };
  api.link = function (p) { api.mkdirSync(path.win32.dirname(p)); links.add(norm(p)); };
  return api;
}

const STAGE_OUT = (st, extra) => Object.assign({ stage: st, status: 'ok', summary: 'done', files_read: ['docs/guide.md'], files_changed: [], proposed_tests: [], risks: [], requires_human: false, stop_reason: null }, extra || {});
const BUILD = { objective: 'improve the guide', acceptanceCriteria: ['guide updated'], stopConditions: ['outside needed'], appendSystemPrompt: 'Follow the ENBISOU Autopilot contract.', maxBudgetUsd: 0.5, model: 'haiku' };
const BUILDS = { researching: BUILD, designing: BUILD, implementing: BUILD, reviewing: BUILD };

// transcript（tool_use / tool_result の対応）
function tline(sid, content) { return JSON.stringify({ type: 'assistant', sessionId: sid, message: { content: content } }); }
function tx(sid, calls) { return calls.map(function (c) { return tline(sid, [{ type: 'tool_use', id: c.id, name: c.name, input: c.input }]) + '\n' + tline(sid, [{ type: 'tool_result', tool_use_id: c.id, is_error: !!c.err, content: 'r' }]); }).join('\n'); }

// ── orchestrator 用の差し替え環境 ──
function setupWorld(taskId, opts) {
  const o = opts || {};
  const mf = memFs();
  mf.mkdirSync(AUDIT); mf.mkdirSync(AUDIT + '\\permits'); mf.mkdirSync(WT_ROOT);
  const store = { runtimeRoot: AUDIT, repoPath: REPO, fs: mf };
  const b = wc.deriveBranchName(taskId), wp = wc.deriveWorktreePath(WT_ROOT, taskId, REPO);
  const init = rs.createInitialRun({ taskId: taskId, task: { title: 't', goal: 'g', allowedPaths: o.allowed || ['docs/'], forbiddenPaths: [] }, mainRepoPath: REPO, baseHead: HEAD,
    branch: b.branch, worktreePath: wp.worktreePath, budget: { capUsd: 5, maxInvocations: 4 }, mainStatusHashAtStart: MAIN_OK.autopilotStatusHash,
    protectedMd5AtStart: Object.assign({}, PROTECTED_BASELINE), now: iso(-120000) });
  if (!init.ok) throw new Error('run fixture invalid ' + JSON.stringify(init));
  rs.createRun(store, init.run);
  const ap = ha.buildRunApproval({ approvalId: U(900), run: init.run, stages: orch.CLAUDE_STAGES.slice(), exeSha256: CLI.exeSha256, cliVersion: CLI.cliVersion,
    maxInvocations: 4, maxBudgetUsdPerInvocation: 0.5, issuedAt: iso(-60000), expiresAt: iso(3600000) });
  if (!ap.ok) throw new Error('approval fixture invalid ' + JSON.stringify(ap));
  if (o.soPolicy) ap.approval.structuredOutputPolicy = o.soPolicy;   // 合成テストだけ（approveCli は 'block' しか発行しない）
  ha.writeApprovalRecord({ root: AUDIT, fs: mf }, ha.wrapRecord(ha.KIND_RUN, ap.approval));
  const permitId = 'permit-' + 'c'.repeat(32);
  mf.put(AUDIT + '\\permits\\' + permitId + '.json', '{"fake":true}\n');
  const state = { created: false, entries: [], transcripts: {}, origin: HEAD, calls: [], consumed: [], stageQueue: orch.CLAUDE_STAGES.slice(), events: [], testsRun: 0 };
  const porcelain = () => 'worktree C:/Users/hp/ENBISOU_AI/ai-company\nHEAD ' + HEAD + '\nbranch refs/heads/main\n\n'
    + (state.created ? 'worktree ' + wp.worktreePath.split('\\').join('/') + '\nHEAD ' + HEAD + '\nbranch ' + b.ref + '\n\n' : '');
  const git = {
    SELF_REPO_ROOT: 'C:\\not-this-repo',
    readRepoState: () => ({ ok: true, head: HEAD, currentBranch: 'main', stagedCount: 0, statusLines: [], autopilotStatusHash: MAIN_OK.autopilotStatusHash, displayStatusHash: 'x',
      branchRefs: ['refs/heads/main'].concat(state.created ? [b.ref] : []), worktreeListPorcelain: porcelain(), worktreeCount: state.created ? 2 : 1, gitCommonDir: 'C:/Users/hp/ENBISOU_AI/ai-company/.git' }),
    readRepoIdentity: () => ({ ok: true, repoIdentity: { repoPath: REPO, gitCommonDir: REPO + '\\.git', rootCommit: HEAD, remoteIdentity: 'github.com/enbisou/ai-company' } }),
    runGitReadOnly: (kind) => {
      if (kind === 'verifyDevRef') return state.created ? { ok: true, exitCode: 0, stdout: HEAD + '\n' } : { ok: false, exitCode: 1, stdout: '' };
      if (kind === 'isAncestor') return { ok: true, exitCode: 0, stdout: '' };
      if (kind === 'lsFilesZ') return { ok: true, stdout: 'README.md\u0000docs/guide.md\u0000' };
      return { ok: false, error: 'unexpected_kind' };
    },
    inspectTargetPath: () => ({ ok: true, exists: state.created, hasLinkOrJunction: false }),
    detectActiveHooks: () => ({ active: false }),
    executeWorktreeCreate: (pf, eo) => { state.calls.push({ kind: 'worktreeAdd', opts: eo }); state.created = true; mf.mkdirSync(wp.worktreePath); return { ok: true, exitCode: 0 }; },
    readWorktreeState: () => ({ ok: true, head: HEAD, branchRef: b.ref, statusLines: [], gitCommonDir: 'C:/Users/hp/ENBISOU_AI/ai-company/.git', envFiles: [] }),
  };
  const permit = {
    consumePermit: (ps, id, live) => {
      const f = AUDIT + '\\permits\\' + id + '.json';
      if (!mf.has(f)) return { ok: false, error: 'permit_not_found_or_consumed' };
      if (live.currentHead !== live.currentOriginMain) return { ok: false, error: 'permit_binding_mismatch' };
      mf.renameSync(f, AUDIT + '\\permits\\' + id + '.consumed.json'); state.consumed.push(id);
      return { ok: true, capability: Object.freeze({ fake: true }) };
    },
  };
  const WT_PROT = { entries: { 'cost-logs.json': 'x'.repeat(32) } };
  const observers = {
    observeMain: () => Object.assign({ head: HEAD, originMain: state.origin, currentBranch: 'main', stagedCount: 0 }, o.mainOverride ? o.mainOverride() : MAIN_OK),
    observeWorktree: (run) => (o.observeWorktreeHook ? o.observeWorktreeHook(state) : null) || ({ worktreePath: run.worktreePath, worktreeHead: HEAD, branchTip: HEAD, worktreeBranchRef: 'refs/heads/' + run.branch,
      changedEntries: clone(state.entries), gitFileHash: H64('f') }),
    worktreeProtectedSnapshot: () => ({ ok: true, entries: clone(WT_PROT.entries) }),
    readTranscript: (sid) => state.transcripts[sid] || null,
    hashFile: () => H64('a'),
  };
  const fakeSpawn = function (exe, args, sopts) {
    const ch = new EventEmitter(); ch.pid = 4242; ch.stdout = new EventEmitter(); ch.stderr = new EventEmitter();
    ch.stdin = { on: function () {}, end: function () {} }; ch.kill = function () { setTimeout(function () { ch.emit('exit', null, 'SIGKILL'); ch.emit('close'); }, 1); return true; };
    const sid = args[args.indexOf('--session-id') + 1];
    const stage = state.stageQueue.shift();
    const rstage = ex.RUNNER_STAGE[stage];
    setTimeout(function () {
      const wt = sopts.cwd;
      const calls = o.globOnlyAt === stage ? [{ id: 'g1', name: 'Glob', input: { pattern: 'docs/**' } }]   // Read をしない探索だけの stage（回帰テスト用）
        : [{ id: 'g1', name: 'Grep', input: { pattern: 'guide' } }, { id: 'r1', name: 'Read', input: { file_path: wt + '\\docs\\guide.md' } }];
      if (stage === 'implementing') { calls.push({ id: 'e1', name: 'Edit', input: { file_path: wt + '\\docs\\guide.md' } }); state.entries = [{ path: 'docs/guide.md', status: 'modified', hash: H64('1'), isSymlink: false }]; }
      if (o.duringSpawn) o.duringSpawn(stage, state, mf);
      let out = STAGE_OUT(rstage, stage === 'implementing' ? { files_changed: ['docs/guide.md'] } : {});
      if (o.outOverride) out = o.outOverride(stage, out);
      if (o.withStructuredOutput) calls.push({ id: 's1', name: 'StructuredOutput', input: o.soInputOverride ? o.soInputOverride(out) : out });
      if (o.soNotLast && o.withStructuredOutput) calls.push({ id: 'g2', name: 'Grep', input: { pattern: 'x' } });
      state.transcripts[sid] = tx(sid, calls);
      const env = { type: 'result', subtype: 'success', is_error: false, api_error_status: null, session_id: sid, num_turns: 3, permission_denials: [],
        modelUsage: { 'claude-haiku-4-5-20251001': { inputTokens: 1 } }, structured_output: out, result: '' };
      if (!(o.costUnknownAt === stage)) env.total_cost_usd = 0.02;
      ch.stdout.emit('data', Buffer.from(JSON.stringify(env))); ch.emit('exit', 0, null); ch.emit('close', 0, null);
    }, 2);
    state.spawned = (state.spawned || 0) + 1;
    return ch;
  };
  const ctx = {
    store: store, auditRoot: AUDIT, auditFs: mf, approvalStore: { root: AUDIT, fs: mf }, permitStore: { root: AUDIT + '\\permits', repoPath: REPO },
    taskId: taskId, ownerId: OWNER, pid: 11, clock: () => new Date().toISOString(), permitId: permitId, runApprovalId: U(900), worktreeRoot: WT_ROOT,
    mutationRepoAllowlist: [REPO], cli: CLI, builds: BUILDS, parentEnv: { PATH: 'p', PATHEXT: 'p', SYSTEMROOT: 'p', SYSTEMDRIVE: 'p', WINDIR: 'p', COMSPEC: 'p', TEMP: 'p', TMP: 'p', HOME: 'p', USERPROFILE: 'p', APPDATA: 'p', LOCALAPPDATA: 'p', ANTHROPIC_API_KEY: 'sk-ant-SECRET' },
    limits: { timeoutMs: 2000, heartbeatMs: 10000, killWaitMs: 60, drainWaitMs: 60, stdoutMax: 256 * 1024, stderrMax: 1024 },
    testApprovalWaitMs: o.noAutoTestApproval ? 0 : 2000, pollMs: 1,
    onEvent: (e) => state.events.push(e),
    deps: {
      git: git, permit: permit, observers: observers, spawn: fakeSpawn,
      runTests: o.noRunTests ? undefined : (x) => { state.testsRun++; state.lastTestApproval = x.testApproval; return { ok: true, results: x.files.map((f) => ({ file: f, exitCode: o.failTests ? 1 : 0, timedOut: false, outputBytes: 10 })) }; },
      selectTests: () => ({ selected: [{ file: 'devAutopilotStep5A.test.js' }, { file: 'apiAuthBoundary.test.js' }], skippedUnsafe: [], uncoveredFiles: [], requiresHumanApproval: false, errors: [] }),
      readWorktreeLines: (run, p) => (o.linesFor ? o.linesFor(p) : ['# guide', 'updated text']),
      randomUUID: (() => { let n = 7000; return () => U(n++); })(),
      sleep: async () => {
        if (o.noAutoTestApproval) return;
        const req = state.events.filter((e) => e.type === 'test_approval_required').pop();
        if (!req || state.issued) return;
        state.issued = true;
        const run = rs.readRun(store, taskId).run;
        const bt = ha.buildTestApproval({ approvalId: req.approvalId, run: run, diffSha256: o.wrongDiffApproval ? H64('0') : req.diffSha256, testFiles: req.testFiles, issuedAt: iso(-1000), expiresAt: iso(600000) });
        ha.writeApprovalRecord({ root: AUDIT, fs: mf }, ha.wrapRecord(ha.KIND_TEST, bt.approval));
      },
    },
  };
  return { mf: mf, store: store, ctx: ctx, state: state, taskId: taskId, permitId: permitId, wp: wp };
}
const runOf = (w) => rs.readRun(w.store, w.taskId).run;
const w_consumed = (mf, id) => mf.has(AUDIT + '\\approvals\\' + id + '.consumed.json') && !mf.has(AUDIT + '\\approvals\\' + id + '.json');

(async function main() {
  console.log('\n=== devAutopilotStep6A.test.js (Development Autopilot V1 Stage 4D: connection with substituted git / spawn / observers) ===');

  caseHeader('O. orchestrator：正常系（隔離 → 4 stage → test → commit 承認待ち）');
  {
    const w = setupWorld('task-6a-001');
    const apFileBefore = w.mf.get(AUDIT + '\\approvals\\' + U(900) + '.json');
    const r = await w.ctx && await orch.runOrchestration(w.ctx);
    const run = runOf(w);
    assert(r.ok && r.gate === 'awaiting_commit_approval' && run.gate === 'awaiting_commit_approval' && run.outcome === null && run.lock === null
      && !w.mf.has(AUDIT + '\\runs\\task-6a-001\\owner.lock'), 'O-1. 正常系：commit 承認待ちへ遷移し所有権を解放（commit はしない・completed にしない）');
    assert(run.invocations.length === 4 && run.invocations.every((x) => x.state === 'finished' && x.result.disposition === 'none') && w.state.spawned === 4
      && run.testResults.length === 2 && run.testResults.every((t) => t.passed && t.diffSha256 === r.diffSha256) && w.state.testsRun === 1, 'O-2. 4 invocation（各 1 回・retry なし）と test batch（差分 hash に束縛）を記録');
    assert(w.state.consumed.length === 1 && w.mf.has(AUDIT + '\\permits\\' + w.permitId + '.consumed.json') && !w.mf.has(AUDIT + '\\permits\\' + w.permitId + '.json')
      && w.state.calls.length === 1 && w.state.calls[0].opts.realRepoCapability === undefined, 'O-3. Permit は隔離で 1 回だけ消費（worktree add 1 回・自 repo 以外に capability を渡さない）');
    assert(w.mf.get(AUDIT + '\\approvals\\' + U(900) + '.json') === apFileBefore && ha.runApprovalRemaining(run, ha.loadRunApproval({ root: AUDIT, fs: w.mf }, U(900)).approval) === 0
      && run.invocations.every((x) => x.launch.approvalId === U(900)), 'O-4. run の実行承認 file は変更・消費済みにせず、消費は予約済み invocation から計上（4 stage で 4 回）');
    const req = w.state.events.find((e) => e.type === 'test_approval_required');
    assert(req && w.mf.has(AUDIT + '\\approvals\\' + req.approvalId + '.consumed.json') && !w.mf.has(AUDIT + '\\approvals\\' + req.approvalId + '.json'), 'O-5. テスト実行承認は single-use（使用前に消費済みへ rename）');
    assert(run.filesChanged.join() === 'docs/guide.md' && rs.commitEvidenceErrors(run, { safety: 'ok', currentDiffSha256: r.diffSha256 }).length === 0, 'O-6. 保存済みの記録だけで commit 承認待ちの条件を満たす');
  }

  caseHeader('S. orchestrator：停止条件（自動 retry・自動修正・新 run 作成なし）');
  {
    const a = setupWorld('task-6a-010'); a.state.origin = OTHER;
    const ra = await orch.runOrchestration(a.ctx);
    assert(!ra.ok && ra.error === 'head_not_equal_origin_main' && a.state.consumed.length === 0 && a.state.calls.length === 0 && a.state.spawned === undefined && runOf(a).outcome === 'blocked',
      'S-1. HEAD ≠ origin/main（決定 15）→ Permit 消費・worktree 作成・起動なしで停止');
    const b2 = setupWorld('task-6a-011', { noAutoTestApproval: true });
    const rb = await orch.runOrchestration(b2.ctx);
    assert(!rb.ok && rb.error === 'test_execution_approval_required' && runOf(b2).gate === 'human_approval_required' && b2.state.testsRun === 0 && b2.state.spawned === 3
      && runOf(b2).lock === null && !b2.mf.has(AUDIT + '\\runs\\task-6a-011\\owner.lock') && typeof rb.testApprovalId === 'string',
      'S-2. テスト実行承認がなければ test を実行せず Human gate で停止（review へ進まない・所有権を解放して再開可能な状態にする）');
    const c2 = setupWorld('task-6a-012', { noRunTests: true });
    const rcx = await orch.runOrchestration(c2.ctx);
    assert(!rcx.ok && rcx.error === 'host_test_execution_not_enabled' && runOf(c2).gate === 'human_approval_required' && c2.state.spawned === 3,
      'S-3. ホストでの test 実行経路が無効なら停止（承認があっても実行しない）');
    const d2 = setupWorld('task-6a-013', { failTests: true });
    const rd = await orch.runOrchestration(d2.ctx);
    assert(!rd.ok && rd.error === 'tests_failed' && runOf(d2).outcome === 'failed' && d2.state.spawned === 3 && d2.state.testsRun === 1, 'S-4. test 失敗 → failed で停止（自動修正・再実行・review なし）');
    const e2 = setupWorld('task-6a-014', { costUnknownAt: 'designing' });
    const re = await orch.runOrchestration(e2.ctx);
    assert(!re.ok && re.error === 'stage_not_successful' && re.runGate === 'human_approval_required' && e2.state.spawned === 2 && runOf(e2).lock === null && re.lockLeft === false
      && !e2.mf.has(AUDIT + '\\runs\\task-6a-014\\owner.lock'), 'S-5. 費用不明 → Human 判断で停止（次 stage へ進まない・Human 判断待ちのため自分の所有権は解放）');
    const f2 = setupWorld('task-6a-015', { wrongDiffApproval: true });
    const rf = await orch.runOrchestration(f2.ctx);
    assert(!rf.ok && rf.error === 'test_approval_rejected' && f2.state.testsRun === 0, 'S-6. 差分 hash が一致しないテスト実行承認は拒否（test を実行しない）');
    // implement の出力（files_changed）は実際の差分と一致させる（不一致は別途 K 節で拒否を確認）
    const g2 = setupWorld('task-6a-016', { allowed: ['docs/', 'tools/'], linesFor: () => ['var a = 1;'],
      outOverride: (stage, out) => (stage === 'implementing' ? Object.assign({}, out, { files_changed: ['tools/devAutopilot/orchestrator.js'] }) : out) });
    const g2opts = g2.ctx.deps.observers.observeWorktree;
    g2.ctx.deps.observers.observeWorktree = (run) => { const x = g2opts(run); if (x && g2.state.entries.length) x.changedEntries = [{ path: 'tools/devAutopilot/orchestrator.js', status: 'modified', hash: H64('2'), isSymlink: false }]; return x; };
    const rg = await orch.runOrchestration(g2.ctx);
    assert(!rg.ok && rg.error === 'implementation_requires_human:human_required' && runOf(g2).gate === 'human_approval_required' && g2.state.testsRun === 0 && g2.state.spawned === 3, 'S-7. Safety Foundation（Runner 本体）の変更は test・review へ進まず停止');
    const h2 = setupWorld('task-6a-017');
    let hCount = 0;
    const hOrig = h2.ctx.deps.observers.observeWorktree;
    h2.ctx.deps.observers.observeWorktree = (run) => { const x = hOrig(run); if (h2.state.stageQueue.length === 0 && h2.state.testsRun === 1) { hCount++; if (hCount >= 2 && x) x.changedEntries = [{ path: 'docs/guide.md', status: 'modified', hash: H64('9'), isSymlink: false }]; } return x; };
    const rh = await orch.runOrchestration(h2.ctx);
    assert(!rh.ok && rh.error === 'diff_changed_after_tests' && runOf(h2).gate !== 'awaiting_commit_approval', 'S-8. review 後に差分が変われば commit 承認待ちへ進まない');
    const i2 = setupWorld('task-6a-018');
    delete i2.ctx.deps.spawn;
    const ri = await orch.runOrchestration(i2.ctx);
    assert(!ri.ok && ri.error === 'real_connection_not_enabled' && runOf(i2).lock === null && i2.state.consumed.length === 0, 'S-9. spawn を差し替えない限り起動経路なし（実接続は有効にしない）');
    const j2 = setupWorld('task-6a-019');
    const rj1 = await orch.runOrchestration(j2.ctx);
    const rj2 = await orch.runOrchestration(j2.ctx);
    assert(rj1.ok && !rj2.ok && rj2.error === 'run_not_fresh', 'S-10. 同じ run の再実行・新 run の自動作成はしない（未開始の run だけを扱う）');
    const k2 = setupWorld('task-6a-021b');
    const kRun = k2.ctx.deps.runTests;
    k2.ctx.deps.runTests = (x) => { const out = kRun(x); k2.state.entries = [{ path: 'docs/guide.md', status: 'modified', hash: H64('4'), isSymlink: false }]; return out; };
    const rk = await orch.runOrchestration(k2.ctx);
    assert(!rk.ok && rk.error === 'tests_changed_worktree' && runOf(k2).testResults.length === 0 && runOf(k2).gate !== 'awaiting_commit_approval' && k2.state.spawned === 3,
      'S-11. test 実行中に差分が変われば結果を記録せず停止（review・commit 承認待ちへ進まない）');
  }

  caseHeader('G. テスト承認 gate からの再開（implement を再実行しない・lock の自動奪取なし）');
  {
    const cliIo = () => { const out = []; return { out: out, io: { isTTY: { stdin: true, stdout: true }, write: (s) => out.push(s), readLine: async () => '01234-56789', now: () => new Date().toISOString(),
      randomBytes: () => Buffer.from('0123456789', 'hex'), randomUUID: () => U(8500) } }; };
    const cliDeps = (w) => ({ store: w.store, approvalStore: { root: AUDIT, fs: w.mf }, observers: w.ctx.deps.observers, selectTests: w.ctx.deps.selectTests });
    async function gateAndApprove(taskId) {
      const w = setupWorld(taskId, { noAutoTestApproval: true });
      const r1 = await orch.runOrchestration(w.ctx);
      const c = cliIo();
      const code = await cli.main(['approve-tests', '--task-id', taskId, '--approval-id', r1.testApprovalId], c.io, cliDeps(w));
      const resumeCtx = Object.assign({}, w.ctx, { mode: 'resume_testing', testApprovalId: r1.testApprovalId, ownerId: U(502), pid: 12 });
      return { w: w, r1: r1, code: code, out: c.out, resumeCtx: resumeCtx };
    }
    const g = await gateAndApprove('task-6a-080');
    const outs = ['research', 'design', 'implement'].map((s) => AUDIT + '\\runs\\task-6a-080\\outputs\\' + s + '.json');
    const afterGate = runOf(g.w);
    assert(g.r1.error === 'test_execution_approval_required' && outs.every((f) => g.w.mf.has(f)) && afterGate.gate === 'none' && afterGate.stageHistory[afterGate.stageHistory.length - 1].result === 'human_approved'
      && g.code === 0, 'G-1. gate 停止（所有権解放）→ approveCli が承認 file を作り Human の操作として gate を解除（stage 出力は記録の hash 付きで保存済み）');
    const rr = await orch.runOrchestration(g.resumeCtx);
    const done = runOf(g.w);
    assert(rr.ok && done.gate === 'awaiting_commit_approval' && g.w.state.spawned === 4 && done.invocations.length === 4 && done.invocations.filter((x) => x.stage === 'implementing').length === 1
      && g.w.state.testsRun === 1 && done.lock === null, 'G-2. resume_testing：implement を再実行せず test → review → commit 承認待ち（起動は合計 4 回）');
    // 承認後に差分が変わった → テスト実行承認を拒否（test を実行しない）
    const g2 = await gateAndApprove('task-6a-081');
    g2.w.state.entries = [{ path: 'docs/guide.md', status: 'modified', hash: H64('8'), isSymlink: false }];
    const r2 = await orch.runOrchestration(g2.resumeCtx);
    assert(!r2.ok && r2.error === 'test_approval_rejected' && (r2.reasons || []).indexOf('test_approval_diff_mismatch') !== -1 && g2.w.state.testsRun === 0 && g2.w.state.spawned === 3,
      'G-3. 承認時から差分 hash が変われば再開時にテスト実行承認を拒否');
    // 記録されていない差分 → 承認を消費せず停止
    const g3 = await gateAndApprove('task-6a-082');
    g3.w.state.entries = g3.w.state.entries.concat([{ path: 'docs/extra.md', status: 'untracked', hash: H64('9'), isSymlink: false }]);
    const r3 = await orch.runOrchestration(g3.resumeCtx);
    assert(!r3.ok && r3.error === 'worktree_diff_not_recorded' && g3.w.mf.has(AUDIT + '\\approvals\\' + g3.r1.testApprovalId + '.json') && g3.w.state.testsRun === 0, 'G-4. 記録されていない差分があれば承認を消費せず停止');
    // 保存した stage 出力の改ざん → 停止
    const g4 = await gateAndApprove('task-6a-083');
    const dpath = AUDIT + '\\runs\\task-6a-083\\outputs\\design.json';
    g4.w.mf.put(dpath, JSON.stringify(Object.assign(JSON.parse(g4.w.mf.get(dpath)), { summary: 'tampered' })));
    const r4 = await orch.runOrchestration(g4.resumeCtx);
    assert(!r4.ok && r4.error === 'stage_output_integrity_failed' && g4.w.state.spawned === 3, 'G-5. 保存した stage 出力が記録の hash と一致しなければ再開しない');
    // 別の所有者が lock を持っている → 奪取しない
    const g5 = await gateAndApprove('task-6a-084');
    const other = rs.acquireOwnership(g5.w.store, 'task-6a-084', { ownerId: U(503), pid: 13, now: new Date().toISOString() });
    const r5 = await orch.runOrchestration(g5.resumeCtx);
    assert(other.ok && !r5.ok && (r5.error === 'run_not_resumable_for_testing' || r5.error === 'ownership_failed') && rs.readOwnerLock(g5.w.store, 'task-6a-084').ownerId === U(503),
      'G-6. 他の所有者の lock がある間は再開しない（自動奪取なし）');
    // Human が gate を解除していない → 再開しない
    const w6 = setupWorld('task-6a-085', { noAutoTestApproval: true });
    const r6a = await orch.runOrchestration(w6.ctx);
    const r6 = await orch.runOrchestration(Object.assign({}, w6.ctx, { mode: 'resume_testing', testApprovalId: r6a.testApprovalId, ownerId: U(502) }));
    assert(!r6.ok && r6.error === 'run_not_resumable_for_testing' && w6.state.spawned === 3, 'G-7. Human が gate を解除していなければ再開しない');
    // stage 出力の保存：秘密情報らしき値を含む出力は保存せず停止（検査は完全な漏えい防止の保証ではない）
    const w8 = setupWorld('task-6a-086', { outOverride: (stage, out) => (stage === 'researching' ? Object.assign({}, out, { summary: 'found sk-ant-' + 'A'.repeat(24) }) : out) });
    const r8 = await orch.runOrchestration(w8.ctx);
    assert(!r8.ok && r8.error === 'stage_output_save_failed' && r8.cause === 'output_contains_secret' && !w8.mf.has(AUDIT + '\\runs\\task-6a-086\\outputs\\research.json') && w8.state.spawned === 1
      && runOf(w8).outcome === 'blocked', 'G-8. 秘密情報らしき値を含む stage 出力は保存せず停止（次 stage へ進まない）');
    // stage 出力の読込：hash が一致しても、サイズ超過・秘密情報・schema 外の key は拒否（hash 一致だけで安全と判断しない）
    async function resumeWithTamper(taskId, mutate) {
      const g9 = await gateAndApprove(taskId);
      const dp = AUDIT + '\\runs\\' + taskId + '\\outputs\\design.json';
      const rp = AUDIT + '\\runs\\' + taskId + '\\run.json';
      const out = JSON.parse(g9.w.mf.get(dp));
      const m = mutate(out);
      g9.w.mf.put(dp, m.text);
      if (m.rehash) {   // 記録側の hash も書き換えて、hash 一致の状態で内容検査だけを確かめる
        const run = JSON.parse(g9.w.mf.get(rp));
        run.invocations.filter((x) => x.stage === 'designing')[0].result.structuredOutputSha256 = tc.canonicalSha256(m.obj);
        g9.w.mf.put(rp, JSON.stringify(run, null, 2) + '\n');
      }
      return { r: await orch.runOrchestration(g9.resumeCtx), w: g9.w };
    }
    const big = await resumeWithTamper('task-6a-087', (out) => ({ text: JSON.stringify(out) + ' '.repeat(70 * 1024), rehash: false }));
    const sec = await resumeWithTamper('task-6a-088', (out) => { const o2 = Object.assign({}, out, { summary: 'token ghp_' + 'B'.repeat(30) }); return { obj: o2, text: JSON.stringify(o2), rehash: true }; });
    const raw = await resumeWithTamper('task-6a-089', (out) => { const o2 = Object.assign({}, out, { stdout: 'RAW-STDOUT' }); return { obj: o2, text: JSON.stringify(o2), rehash: true }; });
    assert(tc.canonicalSha256(JSON.parse(JSON.stringify(STAGE_OUT('design')))) && !big.r.ok && big.r.error === 'stage_output_integrity_failed' && big.r.cause === 'output_size_invalid'
      && !sec.r.ok && sec.r.cause === 'output_contains_secret' && !raw.r.ok && raw.r.cause === 'output_invalid'
      && [big, sec, raw].every((x) => x.w.state.spawned === 3 && x.w.state.testsRun === 0), 'G-9. 読込時もサイズ上限・秘密情報・stage schema（raw stdout 等の混入）を検査し、hash が一致していても停止');
  }

  caseHeader('A. audit：期待する更新だけを許す（runs を対象外にしない）');
  {
    const w = setupWorld('task-6a-020', { duringSpawn: (stage, st, mf) => { if (stage === 'researching') mf.put(AUDIT + '\\approvals\\' + U(950) + '.json', '{"forged":true}'); } });
    const r = await orch.runOrchestration(w.ctx);
    assert(!r.ok && r.error === 'audit_violation' && r.violations.some((v) => v.indexOf('unexpected_added:approvals/' + U(950)) === 0) && runOf(w).outcome === 'blocked' && w.state.spawned === 1,
      'A-1. 起動中に audit 配下へ承認 file が作られたら違反として停止（偽造の検出・次 stage へ進まない）');
    const w2 = setupWorld('task-6a-021', { duringSpawn: (stage, st, mf) => { if (stage === 'researching') mf.put(AUDIT + '\\runs\\task-6a-021\\notes.txt', 'x'); } });
    const r2 = await orch.runOrchestration(w2.ctx);
    assert(!r2.ok && r2.error === 'audit_violation' && r2.violations.some((v) => v.indexOf('unexpected_added:runs/task-6a-021/notes.txt') === 0), 'A-2. runs 配下の未知 file も検出（runs を対象外にしない）');
    // 純関数：run.json の書換え・一時 file・link・Permit の想定外消費
    const mf = memFs(); mf.mkdirSync(AUDIT);
    const base = rs.createInitialRun({ taskId: 'task-6a-022', task: { title: 't', goal: 'g', allowedPaths: ['docs/'], forbiddenPaths: [] }, mainRepoPath: REPO, baseHead: HEAD, branch: 'dev/task-6a-022',
      worktreePath: WT_ROOT + '\\task-6a-022', budget: { capUsd: 5, maxInvocations: 4 }, mainStatusHashAtStart: MAIN_OK.autopilotStatusHash, protectedMd5AtStart: Object.assign({}, PROTECTED_BASELINE), now: iso(-1000) }).run;
    mf.put(AUDIT + '\\runs\\task-6a-022\\run.json', JSON.stringify(base));
    mf.put(AUDIT + '\\permits\\permit-' + 'd'.repeat(32) + '.json', '{}');
    const s0 = ag.snapshotAudit(AUDIT, { fs: mf });
    const tampered = clone(base); tampered.task.allowedPaths = ['docs/', 'server.js']; tampered.revision = 1;
    mf.put(AUDIT + '\\runs\\task-6a-022\\run.json', JSON.stringify(tampered));
    mf.put(AUDIT + '\\runs\\task-6a-022\\write.lock', 'x');
    mf.link(AUDIT + '\\permits\\evil');
    const s1 = ag.snapshotAudit(AUDIT, { fs: mf });
    const v = ag.verifyAuditTransition(s0, s1, { runs: { 'task-6a-022': { ownerId: OWNER, revision: 1, lock: 'same' } } });
    assert(!v.ok && v.violations.some((x) => x.indexOf('run_identity_changed:task') === 0) && v.violations.some((x) => x.indexOf('transient_present:') === 0) && v.violations.some((x) => x.indexOf('link_or_special:') === 0),
      'A-3. run.json の identity 書換え・一時 lock の残存・link を違反として検出');
    const v2 = ag.verifyAuditTransition(s0, s1, {});
    assert(!v2.ok && v2.violations.some((x) => x.indexOf('unexpected_changed:runs/task-6a-022/run.json') === 0), 'A-4. 宣言のない run.json の変更は違反（全体 fingerprint ではなく宣言した更新だけ許可）');
    // 許可 path にあるだけで正常扱いしない（内容を検証）
    const mf2 = memFs(); mf2.mkdirSync(AUDIT);
    mf2.put(AUDIT + '\\runs\\task-6a-022\\run.json', JSON.stringify(base));
    mf2.put(AUDIT + '\\runs\\task-6a-023\\run.json', JSON.stringify(Object.assign(clone(base), { taskId: 'task-6a-023' })));
    const t0 = ag.snapshotAudit(AUDIT, { fs: mf2 });
    mf2.put(AUDIT + '\\runs\\task-6a-022\\owner.lock', JSON.stringify({ kind: 'owner', taskId: 'task-6a-022', ownerId: U(777), pid: 9, acquiredAt: iso(0) }));
    mf2.put(AUDIT + '\\approvals\\' + U(940) + '.consumed.json', '{"other":"content"}');
    mf2.put(AUDIT + '\\runs\\task-6a-023\\run.json', JSON.stringify(Object.assign(clone(base), { taskId: 'task-6a-023', revision: 5 })));
    mf2.put(AUDIT + '\\runs\\task-6a-022\\outputs\\design.json', '{"x":1}');
    const t1 = ag.snapshotAudit(AUDIT, { fs: mf2 });
    const v3 = ag.verifyAuditTransition(t0, t1, { ownerLock: { 'task-6a-022': { mode: 'created', ownerId: OWNER } }, approvalsConsumed: [{ id: U(940), sha256: H64('5') }],
      outputsWritten: [{ path: 'runs/task-6a-022/outputs/design.json', sha256: H64('6') }] });
    const has = (code) => v3.violations.some((x) => x.indexOf(code) === 0);
    assert(!v3.ok && has('owner_lock_not_created_by_owner:') && has('approval_not_consumed_as_expected:') && has('unexpected_changed:runs/task-6a-023/run.json') && has('output_not_written_as_expected:'),
      'A-5. owner.lock の所有者・消費した承認の内容・stage 出力の内容を検証し、別 run の変更も検出（許可 path にあるだけでは正常扱いしない）');
    const r0 = rs.transitionStage(rs.markIsolationVerified(rs.acquireLock(base, { now: iso(1), pid: 9, ownerId: OWNER }).run, { now: iso(2), worktreeHead: HEAD }).run, 'researching', { now: iso(3) }).run;
    const lnch = { exeSha256: H64('a'), cliVersion: CLI.cliVersion, argvSha256: H64('b'), promptSha256: H64('c'), settingsSha256: H64('d'), childVarNames: ['PATH'], timeoutMs: 1, maxBuffer: 1, approvalSha256: H64('f') };
    const otherAp = rs.beginInvocation(r0, { now: iso(4), invocationId: U(1201), sessionId: U(1202), stage: 'researching', launch: Object.assign({ approvalId: U(999) }, lnch) }).run;
    const e1 = ag.validateRunTransition(r0, otherAp, { ownerId: OWNER, revision: otherAp.revision, newInvocationIds: [U(1201)], approvalId: U(900) });
    const done2 = Object.assign(clone(r0), { outcome: 'completed', finalStatus: 'completed' });
    const e2 = ag.validateRunTransition(r0, done2, { ownerId: OWNER, revision: done2.revision, terminalAllowed: true, approvalId: U(900) });
    assert(e1.indexOf('run_invocation_not_from_expected_approval') !== -1 && (e2.indexOf('run_outcome_or_gate_unexpected') !== -1 || e2.indexOf('run_after_invalid') !== -1),
      'A-6. 別の承認による予約・Runner の窓での completed は違反');
  }

  caseHeader('H. 承認記録（実行承認は複数 stage・テスト承認は single-use）');
  {
    const mf = memFs(); mf.mkdirSync(AUDIT);
    const st = { root: AUDIT, fs: mf };
    const run = rs.createInitialRun({ taskId: 'task-6a-030', task: { title: 't', goal: 'g', allowedPaths: ['docs/'], forbiddenPaths: [] }, mainRepoPath: REPO, baseHead: HEAD, branch: 'dev/task-6a-030',
      worktreePath: WT_ROOT + '\\task-6a-030', budget: { capUsd: 5, maxInvocations: 4 }, mainStatusHashAtStart: MAIN_OK.autopilotStatusHash, protectedMd5AtStart: Object.assign({}, PROTECTED_BASELINE), now: iso(-1000) }).run;
    const ap = ha.buildRunApproval({ approvalId: U(910), run: run, stages: orch.CLAUDE_STAGES.slice(), exeSha256: CLI.exeSha256, cliVersion: CLI.cliVersion, maxInvocations: 4, maxBudgetUsdPerInvocation: 0.5, issuedAt: iso(-1000), expiresAt: iso(3600000) });
    const wr = ha.writeApprovalRecord(st, ha.wrapRecord(ha.KIND_RUN, ap.approval));
    const l1 = ha.loadRunApproval(st, U(910)), l2 = ha.loadRunApproval(st, U(910));
    const runR = rs.transitionStage(rs.markIsolationVerified(run, { now: iso(-900), worktreeHead: HEAD }).run, 'researching', { now: iso(-800) }).run;
    assert(ap.ok && ap.approval.structuredOutputPolicy === 'block' && wr.ok && l1.ok && l2.ok && l1.fileSha256 === l2.fileSha256 && ha.runApprovalRemaining(run, l1.approval) === 4
      && ex.validateApproval(l1.approval, { run: runR, now: new Date().toISOString(), exeSha256: CLI.exeSha256, cliVersion: CLI.cliVersion, maxBudgetUsd: 0.5 }).length === 0,
      'H-1. 実行承認は StructuredOutput=block 固定で作成・読込しても消費しない（executor の束縛検証を通る）');
    assert(ha.writeApprovalRecord(st, ha.wrapRecord(ha.KIND_RUN, ap.approval)).error === 'approval_exists'
      && ha.writeApprovalRecord(st, Object.assign(ha.wrapRecord(ha.KIND_RUN, ap.approval), { confirmation: { method: 'self_declared' } })).error === 'record_invalid'
      && ha.buildRunApproval({ approvalId: U(911), run: run, stages: ['researching'], exeSha256: CLI.exeSha256, cliVersion: CLI.cliVersion, maxInvocations: 9, maxBudgetUsdPerInvocation: 0.5, issuedAt: iso(0), expiresAt: iso(1000) }).error === 'run_approval_invalid',
      'H-2. 上書き不可・確認方式の改変や run 上限を超える承認は拒否');
    const files = ['devAutopilotStep5A.test.js', 'apiAuthBoundary.test.js'];
    const bt = ha.buildTestApproval({ approvalId: U(920), run: run, diffSha256: H64('3'), testFiles: files, issuedAt: iso(-1000), expiresAt: iso(600000) });
    ha.writeApprovalRecord(st, ha.wrapRecord(ha.KIND_TEST, bt.approval));
    const bind = { run: run, diffSha256: H64('3'), testFiles: files.slice().reverse(), now: new Date().toISOString() };
    const bad = [ha.consumeTestApproval(st, U(920), Object.assign({}, bind, { diffSha256: H64('4') })), ha.consumeTestApproval(st, U(920), Object.assign({}, bind, { testFiles: ['a.test.js'] })),
      ha.consumeTestApproval(st, U(920), Object.assign({}, bind, { now: iso(7200000) })), ha.consumeTestApproval(st, U(920), Object.assign({}, bind, { run: Object.assign(clone(run), { startedAt: iso(5) }) }))];
    const c1 = ha.consumeTestApproval(st, U(920), bind), c2 = ha.consumeTestApproval(st, U(920), bind);
    const bt2 = ha.buildTestApproval({ approvalId: U(921), run: run, diffSha256: H64('3'), testFiles: files, issuedAt: iso(-1000), expiresAt: iso(600000) });
    ha.writeApprovalRecord(st, ha.wrapRecord(ha.KIND_TEST, bt2.approval));
    assert(bad.every((x) => !x.ok && x.error === 'test_approval_rejected') && c1.ok && !c2.ok && c2.error === 'approval_not_found'
      && w_consumed(mf, U(920)) && ha.loadRunApproval(st, U(921)).error === 'approval_record_invalid' && ha.consumeTestApproval(st, U(910), bind).error === 'approval_record_invalid',
      'H-3. テスト実行承認は差分 hash・test 一覧・期限・run に束縛し single-use（2 回目は不可・種別の取り違えも拒否）');
  }

  caseHeader('C. approveCli（TTY と確認コードは操作確認であり、人間であることの証明ではない）');
  {
    const mk = (tty, answer) => { const out = []; return { out: out, io: { isTTY: { stdin: tty, stdout: tty }, write: (s) => out.push(s), readLine: async () => answer, now: () => new Date().toISOString(),
      randomBytes: () => Buffer.from('0123456789', 'hex'), randomUUID: (() => { let n = 8000; return () => U(n++); })() } }; };
    const mf = memFs(); mf.mkdirSync(AUDIT); mf.mkdirSync(AUDIT + '\\permits');
    let permitWritten = null;
    const deps = (origin) => ({
      repoPath: REPO, worktreeRoot: WT_ROOT, store: { runtimeRoot: AUDIT, repoPath: REPO, fs: mf }, permitStore: { root: AUDIT + '\\permits', repoPath: REPO }, approvalStore: { root: AUDIT, fs: mf },
      observers: { observeMain: () => Object.assign({ head: HEAD, originMain: origin, currentBranch: 'main', stagedCount: 0 }, MAIN_OK), protectedMd5Map: () => Object.assign({}, PROTECTED_BASELINE), hashFile: () => H64('a') },
      git: { readRepoIdentity: () => ({ ok: true, repoIdentity: { repoPath: REPO, gitCommonDir: REPO + '\\.git', rootCommit: HEAD, remoteIdentity: 'x' } }) },
      permit: { buildPermit: (i) => ({ ok: true, permit: { permitId: 'permit-' + 'e'.repeat(32), expiresAt: iso(1800000), i: i } }), writePermit: (s, p) => { permitWritten = p; return { ok: true }; } },
    });
    const argv = ['prepare-run', '--task-id', 'task-6a-040', '--title', 't', '--goal', 'g', '--allowed', 'docs/', '--cap-usd', '5', '--max-invocations', '4', '--max-budget-usd', '0.5', '--exe', 'C:\\fake\\claude.exe', '--cli-version', CLI.cliVersion];
    const noTty = mk(false, '01234-56789');
    const c0 = await cli.main(argv, noTty.io, deps(HEAD));
    const wrong = mk(true, 'AAAAA-BBBBB');
    const c1 = await cli.main(argv, wrong.io, deps(HEAD));
    const ahead = mk(true, '01234-56789');
    const c2 = await cli.main(argv, ahead.io, deps(OTHER));
    const nothing = !rs.readRun({ runtimeRoot: AUDIT, repoPath: REPO, fs: mf }, 'task-6a-040').ok && permitWritten === null;
    assert(c0 === 2 && c1 === 4 && c2 === 3 && ahead.out.join('\n').indexOf('head_not_equal_origin_main') !== -1 && nothing, 'C-1. TTY なし・確認コード不一致・HEAD ≠ origin/main では何も作らない');
    const good = mk(true, '01234-56789');
    const c3 = await cli.main(argv, good.io, deps(HEAD));
    const made = rs.readRun({ runtimeRoot: AUDIT, repoPath: REPO, fs: mf }, 'task-6a-040');
    const apId = U(8000);
    const la = ha.loadRunApproval({ root: AUDIT, fs: mf }, apId);
    assert(c3 === 0 && made.ok && made.run.stage === null && permitWritten && la.ok && la.approval.structuredOutputPolicy === 'block' && la.approval.stages.length === 4
      && good.out.join('\n').indexOf('人間であることの証明ではありません') !== -1 && good.out.join('\n').indexOf('追加課金の許可ではありません') !== -1,
      'C-2. 確認コード一致で run・Permit・実行承認（StructuredOutput=block）を作成し、操作確認の限界と課金範囲を表示');
    // Decision 121：StructuredOutput の条件付き受け入れは --structured-output conditional を明示した場合だけ・承認する CLI（exe SHA・版）に束縛
    const mfc = memFs(); mfc.mkdirSync(AUDIT); mfc.mkdirSync(AUDIT + '\\permits');
    const depsC = Object.assign(deps(HEAD), { store: { runtimeRoot: AUDIT, repoPath: REPO, fs: mfc }, approvalStore: { root: AUDIT, fs: mfc } });
    const argvC = argv.map((x) => (x === 'task-6a-040' ? 'task-6a-041' : x));
    const cond = mk(true, '01234-56789');
    const c4 = await cli.main(argvC.concat(['--structured-output', 'conditional']), cond.io, depsC);
    const lc = ha.loadRunApproval({ root: AUDIT, fs: mfc }, U(8000));
    const badOpt = mk(true, '01234-56789');
    const c5 = await cli.main(argvC.map((x) => (x === 'task-6a-041' ? 'task-6a-042' : x)).concat(['--structured-output', 'always']), badOpt.io, depsC);
    assert(c4 === 0 && lc.ok && JSON.stringify(lc.approval.structuredOutputPolicy) === JSON.stringify({ mode: 'conditional', exeSha256: H64('a'), cliVersion: CLI.cliVersion })
      && cond.out.join('\n').indexOf('副作用がないことの証明ではありません') !== -1 && c5 === 3 && !rs.readRun({ runtimeRoot: AUDIT, repoPath: REPO, fs: mfc }, 'task-6a-042').ok,
      'C-3. 条件付き受け入れは明示した場合だけ発行し、承認する CLI の exe SHA・版に束縛・限界を表示（不明な指定は何も作らない・既定は block：C-2）');
  }

  caseHeader('Q. StructuredOutput 条件付き判定（既定 block・承認に束縛した場合だけ・合成テスト）');
  {
    const cond = { mode: 'conditional', exeSha256: CLI.exeSha256, cliVersion: CLI.cliVersion };
    const w = setupWorld('task-6a-050', { withStructuredOutput: true, soPolicy: cond });
    const r = await orch.runOrchestration(w.ctx);
    const run = runOf(w);
    assert(r.ok && run.invocations.every((x) => x.result.transcript.verdict === 'ok_structured_output_conditional' && x.result.transcript.structuredOutputComparison === 'match')
      && rs.commitEvidenceErrors(run, { safety: 'ok', currentDiffSha256: r.diffSha256 }).length === 0, 'Q-1. 単一・最後・schema 適合・正常結果・hash 一致・他の未知 tool なしなら条件付き受け入れ（commit 承認待ちまで）');
    const wb = setupWorld('task-6a-051', { withStructuredOutput: true });
    const rb = await orch.runOrchestration(wb.ctx);
    assert(!rb.ok && rb.error === 'stage_not_successful' && rb.dispositionReason === 'unverified:unverified_unknown_tool' && wb.state.spawned === 1, 'Q-2. 既定（block）では StructuredOutput は未検証 block のまま（黙って解除しない）');
    const wn = setupWorld('task-6a-052', { withStructuredOutput: true, soPolicy: cond, soNotLast: true });
    const rn = await orch.runOrchestration(wn.ctx);
    const wm = setupWorld('task-6a-053', { withStructuredOutput: true, soPolicy: cond, soInputOverride: (out) => Object.assign({}, out, { summary: 'different' }) });
    const rm = await orch.runOrchestration(wm.ctx);
    const wv = setupWorld('task-6a-054', { withStructuredOutput: true, soPolicy: { mode: 'conditional', exeSha256: H64('b'), cliVersion: CLI.cliVersion } });
    const rv = await orch.runOrchestration(wv.ctx);
    assert(!rn.ok && rn.error === 'stage_not_successful' && !rm.ok && rm.error === 'stage_not_successful' && !rv.ok && rv.error === 'invocation_failed' && rv.cause === 'approval_invalid' && wv.state.spawned === undefined,
      'Q-3. 最後でない・envelope と不一致は block、CLI SHA に束縛されない方針の承認は起動前に拒否');
    // 純関数
    const SID = U(3001), WTR = 'C:\\x\\wt\\t';
    const A_ = (calls) => tc.analyzeTranscript(tx(SID, calls), { sessionId: SID, worktreeRoot: WTR, allowedTools: ['Read', 'Glob', 'Grep'] });
    const so = STAGE_OUT('research'); const envSha = tc.canonicalSha256(so);
    const E_ = (an, extra) => tc.evaluateStructuredOutputConditional(an, Object.assign({ envelopeSha256: envSha, schemaOk: true }, extra || {}));
    const good = A_([{ id: 'a', name: 'Read', input: { file_path: 'x.md' } }, { id: 's', name: 'StructuredOutput', input: so }]);
    assert(E_(good).accepted && !E_(good, { schemaOk: false }).accepted && !E_(good, { envelopeSha256: H64('0') }).accepted
      && !E_(A_([{ id: 's', name: 'StructuredOutput', input: so }, { id: 's2', name: 'StructuredOutput', input: so }])).accepted
      && !E_(A_([{ id: 's', name: 'StructuredOutput', input: so, err: true }])).accepted
      && !E_(A_([{ id: 'b', name: 'Bash', input: { command: 'ls' } }, { id: 's', name: 'StructuredOutput', input: so }])).accepted
      && !E_(A_([{ id: 'o', name: 'Read', input: { file_path: 'C:\\secret.txt' } }, { id: 's', name: 'StructuredOutput', input: so }])).accepted,
      'Q-4. 条件：schema 不適合・hash 不一致・複数・エラー結果・他の未知 tool・外側参照のいずれかで受け入れない');
  }

  caseHeader('R. commit 承認待ちの条件（保存済みの記録から判定）');
  {
    const w = setupWorld('task-6a-060');
    const r = await orch.runOrchestration(w.ctx);
    const done = runOf(w);
    // commit 承認待ちの直前状態を作り直す（gate を外した複製）
    const pre = clone(done); pre.gate = 'none'; pre.gateReason = null; pre.completedStages = pre.completedStages.slice(0, 4); pre.stageHistory[pre.stageHistory.length - 1].endedAt = null; pre.stageHistory[pre.stageHistory.length - 1].result = null;
    const M = (run, o) => rs.markAwaitingCommitApproval(run, Object.assign({ now: new Date(Date.now() + 5000).toISOString(), currentDiffSha256: r.diffSha256, safety: 'ok' }, o || {}));
    const ok = M(pre);
    const noSafety = M(pre, { safety: 'violated' });
    const changed = M(pre, { currentDiffSha256: H64('7') });
    const failT = clone(pre); failT.testResults[0].passed = false; failT.testResults[0].exitCode = 1;
    const noReview = clone(pre); noReview.invocations = noReview.invocations.slice(0, 3); noReview.budget.invocations = 3; noReview.sessionIds.review = null;
    noReview.budget.spentUsd = Math.round(noReview.invocations.reduce((s, x) => s + x.result.cost.cliReportedUsd, 0) * 1e6) / 1e6; noReview.stageHistory[noReview.stageHistory.length - 1].invocations = 0; noReview.stageHistory[noReview.stageHistory.length - 1].costUsd = 0;
    const unv = clone(pre); unv.invocations[1].result.transcript.verdict = 'unverified_unknown_tool';
    const legacy = M(pre, { currentDiffSha256: undefined });
    const eOf = (x) => (x.errors || []).join(',');
    assert(ok.ok && ok.run.gate === 'awaiting_commit_approval', 'R-1. 保存済み review 成功・最後の変更以降の test 全成功・Safety ok・未検証なしなら commit 承認待ち');
    assert(!noSafety.ok && eOf(noSafety).indexOf('safety_not_ok') !== -1 && !changed.ok && eOf(changed).indexOf('diff_changed_after_tests') !== -1
      && !M(failT).ok && eOf(M(failT)).indexOf('tests_not_all_passed') !== -1 && !legacy.ok && eOf(legacy).indexOf('current_diff_hash_invalid') !== -1,
      'R-2. Safety 不成立・review 後の差分変更・test 失敗・差分 hash なしは拒否');
    assert(!M(unv).ok && (eOf(M(unv)).indexOf('invocation_not_verified_success') !== -1 || M(unv).error === 'run_invalid' || M(unv).error === 'commit_evidence_insufficient'),
      'R-3. 未検証の invocation が残っていれば拒否');
    const bare = rs.markAwaitingCommitApproval(rs.transitionStage(rs.transitionStage(rs.transitionStage(rs.transitionStage(rs.transitionStage(rs.markIsolationVerified(rs.createInitialRun({ taskId: 'task-6a-061',
      task: { title: 't', goal: 'g', allowedPaths: ['docs/'], forbiddenPaths: [] }, mainRepoPath: REPO, baseHead: HEAD, branch: 'dev/task-6a-061', worktreePath: WT_ROOT + '\\task-6a-061', budget: { capUsd: 5, maxInvocations: 4 },
      mainStatusHashAtStart: MAIN_OK.autopilotStatusHash, protectedMd5AtStart: Object.assign({}, PROTECTED_BASELINE), now: iso(-9000) }).run, { now: iso(-8000), worktreeHead: HEAD }).run,
      'researching', { now: iso(-7000) }).run, 'designing', { now: iso(-6000) }).run, 'implementing', { now: iso(-5000) }).run, 'testing', { now: iso(-4000) }).run, 'reviewing', { now: iso(-3000) }).run,
      { now: iso(-2000), currentDiffSha256: H64('1'), safety: 'ok' });
    assert(!bare.ok && bare.error === 'commit_evidence_insufficient' && eOf(bare).indexOf('invocation_missing:reviewing') !== -1 && eOf(bare).indexOf('test_results_missing') !== -1,
      'R-4. invocation・test 記録のない run は review まで進めても commit 承認待ちにできない');
    assert(noReview && !rs.recordTestResults(pre, { now: iso(0), batchId: U(1), diffSha256: H64('1'), results: [{ file: 'a.test.js', exitCode: 0, timedOut: false }] }).ok
      && rs.recordTestResults(pre, { now: iso(0), batchId: U(1), diffSha256: H64('1'), results: [{ file: 'a.test.js', exitCode: 0, timedOut: false }] }).error === 'not_testing_stage', 'R-5. test 結果は testing stage でだけ記録');
  }

  caseHeader('T. testRunner（Decision 121：single-use のテスト実行承認がある場合だけ・allowlist env・shell:false）');
  {
    const mf = memFs(); mf.put('C:\\wt\\t\\a.test.js', 'x'); mf.put('C:\\wt\\t\\b.test.js', 'x');
    const TA = { kind: tr.TEST_APPROVAL_KIND, testFiles: ['a.test.js'], worktreePath: 'C:\\wt\\t', diffSha256: H64('3') };
    const seen = [];
    const fake = (exe, args, o) => { seen.push({ exe: exe, args: args, o: o }); return { status: args[0] === 'a.test.js' ? 0 : 1, stdout: Buffer.from('ok'), stderr: Buffer.alloc(0) }; };
    const r0 = tr.runSafeTests({ worktreePath: 'C:\\wt\\t', files: ['a.test.js'], parentEnv: { PATH: 'p' }, fs: mf });
    const r0b = tr.runSafeTests({ worktreePath: 'C:\\wt\\t', files: ['a.test.js', 'b.test.js'], testApproval: TA, parentEnv: {}, fs: mf });
    const r0c = tr.runSafeTests({ worktreePath: 'C:\\wt\\t', files: ['a.test.js'], testApproval: Object.assign({}, TA, { worktreePath: 'C:\\wt\\other' }), parentEnv: {}, fs: mf });
    const r0d = tr.runSafeTests({ worktreePath: 'C:\\wt\\t', files: ['a.test.js'], testApproval: Object.assign({}, TA, { kind: 'self-declared' }), parentEnv: {}, fs: mf });
    assert(r0.error === 'test_approval_required' && r0b.error === 'test_approval_files_mismatch' && r0c.error === 'test_approval_worktree_mismatch' && r0d.error === 'test_approval_required'
      && seen.length === 0 && violations.length === 0, 'T-1. テスト実行承認が無い・test 一覧 / 場所が一致しない・種別が違う場合は実行しない（child_process を読み込まない）');
    const r1 = tr.runSafeTests({ worktreePath: 'C:\\wt\\t', files: ['a.test.js'], testApproval: TA, parentEnv: { PATH: 'p', ANTHROPIC_API_KEY: 'sk-ant-SECRET', CLAUDE_CODE_OAUTH_TOKEN: 'x' }, spawnSync: fake, fs: mf });
    const TA2 = Object.assign({}, TA, { testFiles: ['missing.test.js'] }), TA3 = Object.assign({}, TA, { testFiles: ['../x.test.js'] });
    const r2 = tr.runSafeTests({ worktreePath: 'C:\\wt\\t', files: ['missing.test.js'], testApproval: TA2, parentEnv: {}, spawnSync: fake, fs: mf });
    const r3 = tr.runSafeTests({ worktreePath: 'C:\\wt\\t', files: ['../x.test.js'], testApproval: TA3, parentEnv: {}, spawnSync: fake, fs: mf });
    assert(r1.ok && r1.results[0].exitCode === 0 && seen[0].o.shell === false && seen[0].o.cwd === 'C:\\wt\\t' && Object.keys(seen[0].o.env).every((k) => !/ANTHROPIC|CLAUDE/i.test(k))
      && Object.keys(r1.results[0]).sort().join() === 'exitCode,file,outputBytes,timedOut' && r2.error === 'test_file_missing' && r3.error === 'files_invalid',
      'T-2. 承認と一致する場合だけ実行：cwd は worktree・shell:false・認証 env なし・出力本文を返さない・不正 / 欠落 file は拒否');
    const tsrc = String(require('fs').readFileSync(path.join(ROOT, 'tools', 'devAutopilot', 'testRunner.js'), 'utf8'));
    assert(tsrc.indexOf('OS レベルの隔離ではない') !== -1 && tsrc.indexOf('承認なしの自動実行はしない') !== -1, 'T-3. ホスト実行の限界（env 制限・Safety 監視は OS 隔離ではない）を明記');
  }

  caseHeader('B. observers（差し替え git / fs）');
  {
    assert(JSON.stringify(ob.parsePorcelainZ(' M docs/a.md\u0000?? docs/b.md\u0000R  docs/c.md\u0000docs/old.md\u0000D  x.md\u0000')) === JSON.stringify([{ path: 'docs/a.md', status: 'modified' }, { path: 'docs/b.md', status: 'untracked' }, { path: 'docs/c.md', status: 'renamed' }, { path: 'x.md', status: 'deleted' }])
      && ob.parsePorcelainZ(' M ../x\u0000') === null && ob.parsePorcelainZ('!! ign\u0000') === null, 'B-1. porcelain -z の解析（rename の旧 path を読み飛ばす・判定不能は null）');
    const mf = memFs();
    const WT = 'C:\\wt\\task-6a-070';
    mf.put(WT + '\\.git', 'gitdir: C:/x/.git/worktrees/task-6a-070\n'); mf.put(WT + '\\docs\\a.md', 'hello'); mf.put(WT + '\\cost-logs.json', '{}');
    mf.mkdirSync(WT + '\\docs\\dir');
    mf.put('C:\\home\\.claude\\projects\\p1\\' + U(3100) + '.jsonl', 'line');
    mf.put('C:\\home\\.claude\\projects\\p1\\' + U(3101) + '.jsonl', 'a'); mf.put('C:\\home\\.claude\\projects\\p2\\' + U(3101) + '.jsonl', 'b');
    mf.readSync = function (fd, buf) { if (this._done) { this._done = false; return 0; } const s = Buffer.from('hello'); s.copy(buf); this._done = true; return s.length; };
    let status = ' M docs/a.md\u0000';
    const exe = { runGitReadOnly: (k) => ({ showToplevel: { ok: true, stdout: 'C:/wt/task-6a-070\n' }, revParseHead: { ok: true, stdout: HEAD + '\n' }, symbolicHead: { ok: true, stdout: 'refs/heads/dev/task-6a-070\n' },
      statusPorcelainZ: { ok: true, stdout: status }, verifyDevRef: { ok: true, stdout: HEAD + '\n' }, lsFilesZ: { ok: true, stdout: 'cost-logs.json\u0000docs/a.md\u0000' } })[k] || { ok: false } };
    const o = ob.createObservers({ repoPath: REPO, homeDir: 'C:\\home', exe: exe, fs: mf });
    const run = { worktreePath: WT, mainRepoPath: REPO, branch: 'dev/task-6a-070' };
    const w = o.observeWorktree(run);
    status = ' M docs/dir\u0000';
    const wDir = o.observeWorktree(run);
    const snap = o.worktreeProtectedSnapshot(run);
    assert(w && w.worktreePath === WT && w.changedEntries[0].hash === crypto.createHash('sha256').update('hello').digest('hex') && w.changedEntries[0].isSymlink === false
      && /^[0-9a-f]{64}$/.test(w.gitFileHash) && wDir === null, 'B-2. observeWorktree：所在・HEAD・branch・変更の内容 hash・.git file hash（directory は判定不能で null）');
    assert(snap.ok && snap.entries['cost-logs.json'] !== 'absent' && snap.entries['claude-cost-logs.json'] === 'absent', 'B-3. worktree 内 Protected：tracked は存在・untracked は不在を要求して snapshot');
    const exe2 = Object.assign({}, exe, { runGitReadOnly: (k) => (k === 'lsFilesZ' ? { ok: true, stdout: 'docs/a.md\u0000' } : exe.runGitReadOnly(k)) });
    const snap2 = ob.createObservers({ repoPath: REPO, homeDir: 'C:\\home', exe: exe2, fs: mf }).worktreeProtectedSnapshot(run);
    const mf3 = memFs(); mf3.put(WT + '\\docs\\a.md', 'x');
    const snap3 = ob.createObservers({ repoPath: REPO, homeDir: 'C:\\home', exe: exe, fs: mf3 }).worktreeProtectedSnapshot(run);
    assert(!snap2.ok && snap2.reasons.some((x) => x.indexOf('untracked_protected_present:cost-logs.json') === 0) && !snap3.ok && snap3.reasons.some((x) => x.indexOf('tracked_protected_missing:cost-logs.json') === 0),
      'B-4. 欠落を無条件に正常扱いしない（tracked の欠落・untracked の存在は不正）');
    assert(o.readTranscript(U(3100)) === 'line' && o.readTranscript(U(3101)) === null && o.readTranscript(U(3102)) === null && o.readTranscript('../x') === null, 'B-5. readTranscript：当該 session の 1 件だけ（複数・無し・不正 ID は null）');
  }

  caseHeader('F. Safety Foundation');
  {
    const cls = (p) => rc.classifyDevelopmentChange({ allowedPaths: ['tools/'], files: [{ path: p, status: 'modified', addedLines: ['var a = 1;'] }] }).classification;
    assert(['orchestrator.js', 'humanApproval.js', 'approveCli.js', 'auditGuard.js', 'observers.js', 'testRunner.js', 'claudeExecutor.js', 'runStore.js', 'realRepoPermit.js', 'worktreeExecutor.js', 'transcriptCheck.js', 'protectedCheck.js', 'runAutopilot.js']
      .every((f) => cls('tools/devAutopilot/' + f) === rc.CLASS.HUMAN) && cls('tools/devAutopilot/reportFormat.js') === rc.CLASS.AUTO, 'F-1. Runner 本体・承認管理・監査・Orchestrator の変更は Human 判断');
  }

  caseHeader('K. files_read / files_changed の契約（Read した file・実際に変更した file だけ・正規化した相対 file path）');
  {
    const CR = require('./tools/devAutopilot/claudeRunner');
    const re = new RegExp(CR.FILE_PATH_PATTERN);
    const sch = CR.buildOutputSchema('research');
    const V = (st, fr, fc) => CR.validateStageOutput(st, { stage: st, status: 'ok', summary: 's', files_read: fr, files_changed: fc || [], proposed_tests: [], risks: [], requires_human: false, stop_reason: null });
    const bad = ['docs/', '/abs/x.md', 'C:/x.md', 'a' + String.fromCharCode(92) + 'b.md', '../x.md', 'a/./b.md', 'a//b.md', '.', '..', 'a/..', ''];
    const good = ['docs/autopilot-e2e/e2e-trial-001.md', 'README.md', '.gitignore', 'a/.hidden/b.js', 'x..y.md', 'data/conversations/_meta.json', 'tools/devAutopilot/runStore.js'];
    assert(sch.properties.files_read.items.pattern === CR.FILE_PATH_PATTERN && sch.properties.files_changed.items.pattern === CR.FILE_PATH_PATTERN && sch.properties.risks.items.pattern === undefined
      && bad.every((p) => !re.test(p) && !V('research', [p]).ok) && good.every((p) => re.test(p) && V('research', [p]).ok) && V('research', []).ok
      && !V('implement', [], ['docs/']).ok && V('implement', [], ['docs/autopilot-e2e/e2e-trial-001.md']).ok,
      'K-1. schema の pattern と既存 validator が一致：docs/・絶対・drive・backslash・traversal・空 segment を拒否し、正当な相対 file path と空配列は通す（validator は緩めない）');
    const pr = CR.buildStagePrompt({ taskId: 'task-6a-k', stage: 'research', worktreeRoot: WT_ROOT + '\\task-6a-k', allowedPaths: ['docs/'], forbiddenPaths: [], objective: 'o', acceptanceCriteria: ['a'], previousOutputs: {}, stopConditions: ['s'] });
    assert(pr.ok && pr.prompt.indexOf('list only files you actually opened with the Read tool') !== -1 && pr.prompt.indexOf('Do not list directories or paths that you only found with Glob or Grep') !== -1
      && pr.prompt.indexOf('never use a trailing slash') !== -1 && JSON.stringify(JSON.parse(pr.prompt).outputSchema) === JSON.stringify(sch), 'K-2. prompt に files_read / files_changed の契約を明記し、prompt 内の schema と CLI に渡す schema が一致');
    // 統合：Glob だけの research は files_read=[] で通る・docs/ は schema で拒否・Read していない docs（ディレクトリ）や file の申告は拒否・files_changed の不一致も拒否
    const k1 = setupWorld('task-6a-110', { globOnlyAt: 'researching', outOverride: (st, out) => (st === 'researching' ? Object.assign({}, out, { files_read: [] }) : out) });
    const r1 = await orch.runOrchestration(k1.ctx);
    const k2 = setupWorld('task-6a-111', { globOnlyAt: 'researching', outOverride: (st, out) => (st === 'researching' ? Object.assign({}, out, { files_read: ['docs/'] }) : out) });
    const r2 = await orch.runOrchestration(k2.ctx);
    const k3 = setupWorld('task-6a-112', { globOnlyAt: 'researching', outOverride: (st, out) => (st === 'researching' ? Object.assign({}, out, { files_read: ['docs'] }) : out) });
    const r3 = await orch.runOrchestration(k3.ctx);
    const k4 = setupWorld('task-6a-113', { globOnlyAt: 'researching', outOverride: (st, out) => (st === 'researching' ? Object.assign({}, out, { files_read: ['docs/guide.md'] }) : out) });
    const r4 = await orch.runOrchestration(k4.ctx);
    const k5 = setupWorld('task-6a-114', { outOverride: (st, out) => (st === 'implementing' ? Object.assign({}, out, { files_changed: ['docs/other.md'] }) : out) });
    const r5 = await orch.runOrchestration(k5.ctx);
    const sc = (w, st) => { const i = runOf(w).invocations.filter((x) => x.stage === st)[0]; return i && i.result ? i.result.schema : null; };
    assert(r1.ok && runOf(k1).gate === 'awaiting_commit_approval', 'K-3. Read をしない（Glob だけの）research は files_read=[] で通り、commit 承認待ちまで進む');
    assert(!r2.ok && r2.error === 'stage_not_successful' && sc(k2, 'researching').errorCodes.indexOf('files_read_invalid') !== -1 && k2.state.spawned === 1
      && !r3.ok && sc(k3, 'researching').errorCodes.indexOf('files_read_not_read') !== -1 && k3.state.spawned === 1
      && !r4.ok && sc(k4, 'researching').errorCodes.indexOf('files_read_not_read') !== -1 && k4.state.spawned === 1
      && !r5.ok && sc(k5, 'implementing').errorCodes.indexOf('files_changed_not_changed') !== -1 && k5.state.spawned === 3 && k5.state.testsRun === 0,
      'K-4. docs/ は形式で拒否・Read していないディレクトリ / file の files_read と実際の差分にない files_changed は照合で拒否（いずれも block・次へ進まない・自動補正しない）');
    const an = tc.analyzeTranscript(tx(U(3201), [{ id: 'r', name: 'Read', input: { file_path: WT_ROOT + '\\t\\docs\\a.md' } }]), { sessionId: U(3201), worktreeRoot: WT_ROOT + '\\t', allowedTools: ['Read', 'Glob', 'Grep'], claimedFilesRead: ['docs/a.md', 'docs'] });
    assert(an.filesReadUnmatched === 1 && JSON.stringify(an).indexOf('a.md') === -1, 'K-5. 照合結果は件数だけを返し、path を返さない');
  }

  caseHeader('W. Protected 検証 helper（main は固定基準・worktree は main 側の固定基準＋存在区別と不変）');
  {
    const PCH = require('./tools/devAutopilot/protectedCheck');
    const real = PCH.snapshot(ROOT);
    assert(real.layout.mode === 'main' && PCH.verify(real, PCH.snapshot(ROOT), PROTECTED_BASELINE).ok && PCH.fingerprint(real.root) === 'd1fd4bd36f69'
      && !PCH.verify(real, real, Object.assign({}, PROTECTED_BASELINE, { 'cost-logs.json': '0'.repeat(32) })).ok, 'W-1. 本物の repo（main）：固定基準と一致すれば ok・基準と違えば失敗（従来と同じ検証）');
    // 偽 fs 上の main repo と linked worktree（Protected の内容は人工値）
    const M = 'C:\\pc\\main', WT = 'C:\\pc\\.autopilot\\wt\\task-pc';
    const build = (o) => {
      const mf = memFs(), x = o || {};
      mf.put(M + '\\.git\\HEAD', 'ref: refs/heads/main\n'); mf.mkdirSync(M + '\\.git\\worktrees\\task-pc');
      mf.put(M + '\\.git\\worktrees\\task-pc\\gitdir', (x.backlink || WT.split('\\').join('/') + '/.git') + '\n');
      mf.put(M + '\\.git\\worktrees\\task-pc\\commondir', '../..\n');
      mf.put(WT + '\\.git', 'gitdir: ' + M.split('\\').join('/') + '/.git/worktrees/task-pc\n');
      PCH.PROTECTED_PATHS.forEach((f) => mf.put(M + '\\' + f.split('/').join('\\'), 'main:' + f));
      PCH.TRACKED_PROTECTED.forEach((f) => { if (!(x.dropTracked === f)) mf.put(WT + '\\' + f.split('/').join('\\'), 'head:' + f); });
      if (x.addUntracked) mf.put(WT + '\\' + x.addUntracked.split('/').join('\\'), 'leak');
      return mf;
    };
    const md5 = (s) => crypto.createHash('md5').update(s).digest('hex');
    const BASE = {}; PCH.PROTECTED_PATHS.forEach((f) => { BASE[f] = md5('main:' + f); });
    const run = (mf, mutate) => { const b = PCH.snapshot(WT, { fs: mf }); if (mutate) mutate(mf); return PCH.verify(b, PCH.snapshot(WT, { fs: mf }), BASE); };
    const okv = run(build());
    assert(PCH.detectLayout(WT, { fs: build() }).mode === 'worktree' && PCH.detectLayout(WT, { fs: build() }).mainRoot.toLowerCase() === M.toLowerCase() && okv.ok && okv.mode === 'worktree',
      'W-2. worktree：.git の構造から main を特定し、main 側の固定基準・tracked の存在と不変・untracked の不在を満たせば ok');
    const bad = [
      ['main_mismatch', run(build(), (mf) => mf.put(M + '\\cost-logs.json', 'changed'))],
      ['worktree_tracked_missing_or_changed', run(build({ dropTracked: 'cost-logs.json' }))],
      ['worktree_tracked_missing_or_changed', run(build(), (mf) => mf.put(WT + '\\cost-logs.json', 'changed'))],
      ['worktree_untracked_present_or_unreadable', run(build({ addUntracked: 'claude-cost-logs.json' }))],
      ['layout_unknown', run(build({ backlink: 'C:/other/.git' }))],
      ['main_mismatch', run(build(), (mf) => mf.unlinkSync(M + '\\claude-quality-history.json'))],
    ];
    assert(bad.every((b) => !b[1].ok && b[1].reasons.some((r) => r.indexOf(b[0]) === 0)), 'W-3. main の変更・tracked の欠落 / 変更・untracked の混入・逆参照の不一致・main 側の欠落はすべて失敗（欠落を正常扱いしない）');
    const unk = memFs(); unk.mkdirSync('C:\\pc\\none');
    const src = String(require('fs').readFileSync(path.join(ROOT, 'tools', 'devAutopilot', 'protectedCheck.js'), 'utf8'));
    assert(PCH.verify(PCH.snapshot('C:\\pc\\none', { fs: unk }), PCH.snapshot('C:\\pc\\none', { fs: unk }), BASE).reasons[0].indexOf('layout_unknown') === 0
      && src.indexOf('process.env') === -1 && src.indexOf('copyFile') === -1 && src.indexOf('writeFile') === -1, 'W-4. .git が無い等の不明な実行場所は失敗・環境変数で切り替える入口なし・Protected を copy / 作成しない');
  }

  caseHeader('N. 実接続用の入口（起動前の停止・既定は事前確認のみ・差し替えで確認）');
  {
    const ra = require('./tools/devAutopilot/runAutopilot');
    const entryDeps = (w, extra) => Object.assign({
      repoPath: REPO, auditRoot: AUDIT, worktreeRoot: WT_ROOT, store: w.store, auditFs: w.mf, approvalStore: { root: AUDIT, fs: w.mf }, permitStore: { root: AUDIT + '\\permits', repoPath: REPO },
      fs: w.mf, git: Object.assign({ validateGitAvailable: () => ({ ok: true, version: 'git version 2.54.0' }) }, w.ctx.deps.git), permit: w.ctx.deps.permit, observers: w.ctx.deps.observers,
      detectLayout: () => ({ mode: 'main', mainRoot: REPO }), orchestrator: orch, makeSpawn: () => { w.state.madeSpawn = (w.state.madeSpawn || 0) + 1; return w.ctx.deps.spawn; },
      selectTests: w.ctx.deps.selectTests, readWorktreeLines: w.ctx.deps.readWorktreeLines, clock: () => new Date().toISOString(), randomUUID: w.ctx.deps.randomUUID, sleep: async () => {},
      parentEnv: w.ctx.parentEnv, pid: 21, runTests: w.ctx.deps.runTests,
    }, extra || {});
    const BF = 'C:\\enbisou-s4d-fake\\build.json';
    const argv = (w, extra) => ['--task-id', w.taskId, '--permit-id', w.permitId, '--run-approval-id', U(900), '--exe', CLI.exePath, '--cli-version', CLI.cliVersion, '--build-file', BF].concat(extra || []);
    const prep = (taskId, opts) => { const w = setupWorld(taskId, opts); w.mf.put(BF, JSON.stringify(BUILDS)); return w; };
    const io = () => { const out = []; return { out: out, io: { write: (s) => out.push(s) } }; };
    const untouched = (w, before) => runOf(w).revision === before.revision && runOf(w).lock === null && w.mf.has(AUDIT + '\\permits\\' + w.permitId + '.json') && !w.state.spawned && !w.state.madeSpawn;
    const cases = [];
    const add = async (label, w, args, extraDeps, code) => { const b = runOf(w); const o = io(); const c = await ra.main(args, o.io, entryDeps(w, extraDeps)); cases.push({ label: label, ok: c === 3 && untouched(w, b) && o.out.join('').indexOf(code) !== -1 }); };
    const w0 = prep('task-6a-090'); await add('args', w0, ['--task-id', w0.taskId, '--start'], null, 'args_missing');
    const w1 = prep('task-6a-091'); w1.state.origin = OTHER; await add('origin', w1, argv(w1, ['--start']), null, 'head_not_equal_origin_main');
    const w2 = prep('task-6a-092', { soPolicy: { mode: 'conditional', exeSha256: H64('b'), cliVersion: CLI.cliVersion } }); await add('so', w2, argv(w2, ['--start']), null, 'structured_output_policy_invalid');
    const w3 = prep('task-6a-093'); await add('exe', w3, argv(w3, ['--start']), { observers: Object.assign({}, w3.ctx.deps.observers, { hashFile: () => H64('b') }) }, 'cli_exe_mismatch');
    const w4 = prep('task-6a-094'); await add('cliv', w4, ['--task-id', w4.taskId, '--permit-id', w4.permitId, '--run-approval-id', U(900), '--exe', CLI.exePath, '--cli-version', '2.1.169 (Claude Code)', '--build-file', BF, '--start'], null, 'cli_version_mismatch');
    const w5 = prep('task-6a-095'); await add('approval', w5, ['--task-id', w5.taskId, '--permit-id', w5.permitId, '--run-approval-id', U(901), '--exe', CLI.exePath, '--cli-version', CLI.cliVersion, '--build-file', BF, '--start'], null, 'run_approval_unavailable');
    const w6 = prep('task-6a-096'); w6.mf.renameSync(AUDIT + '\\permits\\' + w6.permitId + '.json', AUDIT + '\\permits\\' + w6.permitId + '.consumed.json');
    { const b = runOf(w6); const o = io(); const c = await ra.main(argv(w6, ['--start']), o.io, entryDeps(w6)); cases.push({ label: 'permit', ok: c === 3 && o.out.join('').indexOf('permit_missing') !== -1 && runOf(w6).revision === b.revision && !w6.state.spawned }); }
    const w7 = prep('task-6a-097'); await add('layout', w7, argv(w7, ['--start']), { detectLayout: () => ({ mode: 'worktree', mainRoot: REPO }) }, 'not_main_repo');
    const w8 = prep('task-6a-098'); w8.mf.put(BF, JSON.stringify(Object.assign({}, BUILDS, { implementing: Object.assign({}, BUILD, { allowedPaths: ['server.js'] }) })));
    await add('build', w8, argv(w8, ['--start']), null, 'build_file_shape');
    const w9 = prep('task-6a-099'); await add('mainstate', w9, argv(w9, ['--start']), { observers: Object.assign({}, w9.ctx.deps.observers, { observeMain: () => Object.assign({ head: HEAD, originMain: HEAD, currentBranch: 'main', stagedCount: 0 }, MAIN_OK, { autopilotStatusHash: 'ec4ea8f0a985' }) }) }, 'main_state_mismatch');
    assert(cases.length === 10 && cases.every((x) => x.ok), 'N-1. 引数不足・HEAD≠origin/main・承認する CLI に束縛されていない StructuredOutput 方針・exe / 版の不一致・承認なし・Permit 消費済み・main repo 以外・build 不正・main 状態不一致は起動前に停止（run・Permit 不変・spawn 0）'
      + (cases.every((x) => x.ok) ? '' : ' ' + cases.filter((x) => !x.ok).map((x) => x.label).join(',')));
    const wp = prep('task-6a-100'); const bp = runOf(wp); const op = io();
    const cp0 = await ra.main(argv(wp), op.io, entryDeps(wp));
    const wq = prep('task-6a-100b', { soPolicy: { mode: 'conditional', exeSha256: CLI.exeSha256, cliVersion: CLI.cliVersion } }); const bq = runOf(wq); const oq = io();
    const cq0 = await ra.main(argv(wq), oq.io, entryDeps(wq));
    assert(cp0 === 0 && untouched(wp, bp) && op.out.join('').indexOf('事前確認のみ') !== -1 && op.out.join('').indexOf('StructuredOutput: block') !== -1
      && cq0 === 0 && untouched(wq, bq) && oq.out.join('').indexOf('conditional（この CLI に限る）') !== -1,
      'N-2. --start なしは事前確認だけ（read-only・spawn を用意しない・run / Permit 不変）・承認する CLI に束縛した conditional は受け付ける（既定は block）');
    const ws = prep('task-6a-101', { noAutoTestApproval: true }); const os2 = io();
    const cs = await ra.main(argv(ws, ['--start']), os2.io, entryDeps(ws));
    assert(cs === 1 && ws.state.madeSpawn === 1 && ws.state.spawned === 3 && ws.state.testsRun === 0 && runOf(ws).gate === 'human_approval_required'
      && os2.out.join('').indexOf('test_execution_approval_required') !== -1, 'N-3. --start：差し替え環境で orchestrator を 1 回起動し、テスト実行承認が無ければ test を実行せず Human gate に止まる（自動 retry なし）');
    const rsrc = String(require('fs').readFileSync(path.join(ROOT, 'tools', 'devAutopilot', 'runAutopilot.js'), 'utf8'));
    assert(violations.length === 0 && rsrc.indexOf('writeApprovalRecord') === -1 && rsrc.indexOf("'commit'") === -1 && rsrc.indexOf('testApproval: x.testApproval') !== -1 && rsrc.indexOf('allowRealSpawn') === -1,
      'N-4. 入口は承認を発行せず、commit・allowRealSpawn の経路を持たない・test 実行は消費済みのテスト実行承認と一緒にだけ渡す（読込時に child_process を読まない）');
    // テスト承認 gate からの再開（Human が approveCli approve-tests で承認・gate 解除）。implement・完了済み stage は再実行しない
    const cliIo2 = () => { const out = []; return { out: out, io: { isTTY: { stdin: true, stdout: true }, write: (x) => out.push(x), readLine: async () => '01234-56789', now: () => new Date().toISOString(),
      randomBytes: () => Buffer.from('0123456789', 'hex'), randomUUID: () => U(8600) } }; };
    const gateWorld = async (taskId) => {
      const w = prep(taskId, { noAutoTestApproval: true }); const o = io();
      await ra.main(argv(w, ['--start']), o.io, entryDeps(w));
      const out = o.out.join('');
      const m = /"testApprovalId":"([0-9a-f-]{36})"/.exec(out);   // 入口の結果出力に表示される要求 ID（Human が approve-tests に渡す）
      return { w: w, reqId: m ? m[1] : null, out: out };
    };
    const approveTests = (g) => cli.main(['approve-tests', '--task-id', g.w.taskId, '--approval-id', g.reqId], cliIo2().io,
      { store: g.w.store, approvalStore: { root: AUDIT, fs: g.w.mf }, observers: g.w.ctx.deps.observers, selectTests: g.w.ctx.deps.selectTests });
    const argvR = (w, reqId, extra) => ['--resume-testing', '--task-id', w.taskId, '--run-approval-id', U(900), '--test-approval-id', reqId, '--exe', CLI.exePath, '--cli-version', CLI.cliVersion, '--build-file', BF].concat(extra || []);
    const g1 = await gateWorld('task-6a-102');
    const ccode = await approveTests(g1);
    const freshAgain = io(); const cFresh = await ra.main(argv(g1.w, ['--start']), freshAgain.io, entryDeps(g1.w));
    const pre1 = io(); const cPre = await ra.main(argvR(g1.w, g1.reqId), pre1.io, entryDeps(g1.w));
    const o5 = io(); const c5 = await ra.main(argvR(g1.w, g1.reqId, ['--start']), o5.io, entryDeps(g1.w));
    const d5 = runOf(g1.w);
    assert(g1.reqId && g1.out.indexOf(g1.reqId) !== -1 && ccode === 0 && cFresh === 3 && freshAgain.out.join('').indexOf('run_not_fresh') !== -1 && cPre === 0 && c5 === 0
      && d5.gate === 'awaiting_commit_approval' && g1.w.state.spawned === 4 && d5.invocations.filter((x) => x.stage === 'implementing').length === 1 && d5.invocations.length === 4
      && g1.w.state.testsRun === 1 && g1.w.state.lastTestApproval && g1.w.state.lastTestApproval.approvalId === g1.reqId && g1.w.state.lastTestApproval.diffSha256 === d5.testResults[0].diffSha256,
      'N-5. テスト承認 gate → Human の承認 → --resume-testing で test → review → commit 承認待ち（implement 再実行なし・起動は合計 4 回・test は消費した承認と一緒にだけ実行・新規 run としての再起動は拒否）');
    const o6 = io(); const c6 = await ra.main(argvR(g1.w, g1.reqId, ['--start']), o6.io, entryDeps(g1.w));
    const g2 = await gateWorld('task-6a-103');
    const o7 = io(); const c7 = await ra.main(argvR(g2.w, g2.reqId, ['--start']), o7.io, entryDeps(g2.w));
    const g3 = await gateWorld('task-6a-104');
    await approveTests(g3);
    const o8 = io(); const c8 = await ra.main(argvR(g3.w, U(8999), ['--start']), o8.io, entryDeps(g3.w));
    const o9 = io(); const c9 = await ra.main(argvR(g3.w, g3.reqId, ['--permit-id', g3.w.permitId, '--start']), o9.io, entryDeps(g3.w));
    g3.w.state.origin = OTHER;
    const o10 = io(); const c10 = await ra.main(argvR(g3.w, g3.reqId, ['--start']), o10.io, entryDeps(g3.w));
    const T = (o, code) => o.out.join('').indexOf(code) !== -1;
    assert(c6 === 3 && T(o6, 'run_not_waiting_after_test_gate') && T(o6, 'tests_already_recorded') && c7 === 3 && T(o7, 'test_gate_not_released_by_human') && c8 === 3 && T(o8, 'test_approval_missing')
      && c9 === 3 && T(o9, 'args_unexpected') && c10 === 3 && T(o10, 'head_not_equal_origin_main') && g2.w.state.spawned === 3 && g3.w.state.spawned === 3 && g3.w.state.testsRun === 0,
      'N-6. 再開の拒否：完了後の再実行・Human の gate 解除なし・テスト実行承認なし・余分な引数・HEAD≠origin/main（いずれも起動前に停止・再実行 0）');
    // e2e-trial-002 の回帰：子へ渡す env の不足（HOME 欠落）は事前確認で止め、Permit・所有権・worktree・spawn に触れない。env の値は表示しない
    const envNoHome = (w) => { const e = Object.assign({}, w.ctx.parentEnv, { PATH: 'ENV-VALUE-MARKER-7' }); delete e.HOME; return e; };
    const we1 = prep('task-6a-105'); const be1 = runOf(we1); const oe1 = io();
    const ce1 = await ra.main(argv(we1), oe1.io, entryDeps(we1, { parentEnv: envNoHome(we1) }));
    const te1 = oe1.out.join('');
    const pfFull = ra.preflight(ra.parseArgs(argv(we1)), entryDeps(we1));
    const pfNo = ra.preflight(ra.parseArgs(argv(we1)), entryDeps(we1, { parentEnv: envNoHome(we1) }));
    assert(ce1 === 3 && te1.indexOf('env_not_allowlisted') !== -1 && te1.indexOf('env_missing:HOME') !== -1 && te1.indexOf('ENV-VALUE-MARKER') === -1 && te1.indexOf('sk-ant') === -1 && untouched(we1, be1)
      && pfFull.ok === true && !pfNo.ok && pfNo.reasons.filter((x) => x.indexOf('env_missing:') === 0).join() === 'env_missing:HOME',
      'N-7. 事前確認（--start なし）：HOME 欠落は env_not_allowlisted・不足キー名だけを表示して停止（値・認証 env を出さない）、必要なキーがそろえば env 検査を通る');
    const we2 = prep('task-6a-106'); const be2 = runOf(we2); const oe2 = io();
    const ce2 = await ra.main(argv(we2, ['--start']), oe2.io, entryDeps(we2, { parentEnv: envNoHome(we2) }));
    assert(ce2 === 3 && oe2.out.join('').indexOf('env_missing:HOME') !== -1 && untouched(we2, be2) && !we2.state.created && we2.state.calls.filter((x) => x.kind === 'worktreeAdd').length === 0
      && we2.state.consumed.length === 0 && !we2.mf.has(AUDIT + '\\runs\\' + we2.taskId + '\\owner.lock') && we2.mf.has(AUDIT + '\\runs\\' + we2.taskId + '\\run.json'),
      'N-8. --start でも env 不足なら所有権取得（owner.lock を作らない）・Permit 消費・worktree 作成・spawn の前に停止');
    const stubOrch = (r) => ({ runOrchestration: async () => r });
    const wd = prep('task-6a-107'); const od1 = io(); const od2 = io();
    await ra.main(argv(wd, ['--start']), od1.io, entryDeps(wd, { orchestrator: stubOrch({ ok: false, phase: 'stage:researching', error: 'invocation_failed', cause: 'env_not_allowlisted', invocationPhase: 'preflight' }) }));
    await ra.main(argv(wd, ['--start']), od2.io, entryDeps(wd, { orchestrator: stubOrch({ ok: false, phase: 'stage:researching', error: 'invocation_failed', cause: 'C:\\Users\\x\\secret sk-ant-LEAK', invocationPhase: { detail: 'sk-ant-LEAK2' } }) }));
    const od3 = io();   // 正規表現なら通る形だが許可集合に無い値（hex 風の値・未知のコード・コロン付きの合成コード）
    await ra.main(argv(wd, ['--start']), od3.io, entryDeps(wd, { orchestrator: stubOrch({ ok: false, phase: 'stage:researching', error: 'invocation_failed', cause: 'abcdef0123456789abcdef0123456789', invocationPhase: 'spawn_internal' }) }));
    const od4 = io();
    await ra.main(argv(wd, ['--start']), od4.io, entryDeps(wd, { orchestrator: stubOrch({ ok: false, phase: 'stage:researching', error: 'invocation_failed', cause: 'mutex_failed:lock_create_failed', invocationPhase: 'reserve' }) }));
    const td1 = od1.out.join(''), td2 = od2.out.join(''), td3 = od3.out.join(''), td4 = od4.out.join('');
    assert(td1.indexOf('"cause":"env_not_allowlisted"') !== -1 && td1.indexOf('"invocationPhase":"preflight"') !== -1
      && td2.indexOf('"cause":"unrecognized"') !== -1 && td2.indexOf('"invocationPhase":"unrecognized"') !== -1 && td2.indexOf('sk-ant') === -1 && td2.indexOf('secret') === -1
      && td3.indexOf('"cause":"unrecognized"') !== -1 && td3.indexOf('"invocationPhase":"unrecognized"') !== -1 && td3.indexOf('abcdef0123456789') === -1 && td3.indexOf('spawn_internal') === -1
      && td4.indexOf('"cause":"unrecognized"') !== -1 && td4.indexOf('"invocationPhase":"reserve"') !== -1 && td4.indexOf('mutex_failed') === -1 && td4.indexOf('lock_create_failed') === -1,
      'N-9. 結果表示：許可集合の cause / invocationPhase だけを表示し、集合外（正規表現なら通る値・コロン付きの合成コード・path・例外本文・object・秘密情報）は unrecognized');
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
  console.log('🟢 All Development Autopilot Stage 4D cases passed');
})().catch(function (e) { console.log('  ❌ 例外: ' + (e && e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : String(e))); process.exit(1); });
