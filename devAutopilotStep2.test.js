'use strict';
// devAutopilotStep2.test.js
// Development Autopilot V1 — Step 2（runStore / State Machine）の deterministic テスト。
//
//   ★ 実行は必ずこのファイル名を明示指定する（node devAutopilotStep2.test.js）。
//   ★ 外部出口は冒頭で fail-closed に封鎖する（network / credential env / .env / 禁止 module）。
//   ★ fs の書き込みは「このテストが OS temp に作った sandbox directory の内側」だけ許可し、それ以外は遮断する。
//   ★ Protected 10件の hash を開始時・終了時に read-only で取得し、全件一致を assert する。
//   ★ 終了時に削除するのは自分で作った temp directory だけ。

const path = require('path');
const fs = require('fs');
const os = require('os');
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

// ── OS temp の sandbox directory（blocker 導入前に作成）──
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'devAutopilotStep2-'));
const ORIG_RM = fs.rmSync;
const ORIG_STAT = fs.statSync;
// 例外で途中終了した場合も、このテスト自身が作った sandbox だけを後始末し、失敗として報告する（正常終了時は P-4 で検証済み）
process.on('exit', function (code) {
  let left = true; try { ORIG_STAT(SANDBOX); } catch (e) { left = false; }
  if (!left) return;
  try { ORIG_RM(SANDBOX, { recursive: true, force: true }); } catch (e) { /* 下で残存を報告 */ }
  let still = true; try { ORIG_STAT(SANDBOX); } catch (e) { still = false; }
  console.log('  ❌ 途中終了のため自分の sandbox を後始末（' + (still ? '残存: ' : '削除: ') + path.basename(SANDBOX) + '）');
  if (code === 0) process.exitCode = 1;
});
function insideSandbox(p) {
  if (typeof p !== 'string' && !(p instanceof URL)) return false;
  const rel = path.relative(SANDBOX.toLowerCase(), path.resolve(String(p)).toLowerCase());
  return rel === '' || (!!rel && rel.split(/[\\\/]/)[0] !== '..' && !path.isAbsolute(rel));
}

// ── sandbox（network / env / fs / module） ──
function blockedNetwork(name) { return function () { violations.push('network:' + name); throw new Error('SANDBOX_BLOCKED_NETWORK:' + name); }; }
['http', 'https'].forEach(function (m) { const mod = require(m); mod.request = blockedNetwork(m + '.request'); mod.get = blockedNetwork(m + '.get'); });
{ const net = require('net'); net.connect = blockedNetwork('net.connect'); net.createConnection = blockedNetwork('net.createConnection'); const tls = require('tls'); tls.connect = blockedNetwork('tls.connect'); }
globalThis.fetch = blockedNetwork('fetch');
const CREDENTIAL_ENV_PATTERN = /^(OPENAI|ANTHROPIC|CLAUDE|SUPABASE|NEXT_PUBLIC_SUPABASE|LINE_|WEB_SESSION|CAROUSEL_)/i;
Object.keys(process.env).forEach(function (k) { if (CREDENTIAL_ENV_PATTERN.test(k)) delete process.env[k]; });
function isEnvFile(p) { try { return /^\.env(\..*)?$/.test(path.basename(String(p))); } catch (e) { return false; } }
['readFileSync', 'readFile', 'existsSync', 'statSync', 'createReadStream'].forEach(function (n) {
  const orig = fs[n]; if (typeof orig !== 'function') return;
  fs[n] = function (p) { if (isEnvFile(p)) { violations.push('env_file_read:' + n); throw new Error('SANDBOX_BLOCKED_ENV_READ'); } return orig.apply(this, arguments); };
});
// fs write は SANDBOX の内側だけ許可（第1引数・rename/copy の第2引数も確認）
function guardedWrite(name, orig) {
  return function (a, b) {
    const two = /rename|copy|symlink|cp/i.test(name);
    if (insideSandbox(a) && (!two || insideSandbox(b))) return orig.apply(this, arguments);
    violations.push('fs_write:' + name + ':' + String(a));
    throw new Error('SANDBOX_BLOCKED_FS_WRITE:' + name);
  };
}
['writeFileSync', 'appendFileSync', 'renameSync', 'unlinkSync', 'mkdirSync', 'rmSync', 'rmdirSync', 'copyFileSync', 'truncateSync',
  'symlinkSync', 'cpSync', 'writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir', 'copyFile', 'truncate', 'createWriteStream']
  .forEach(function (n) { if (typeof fs[n] === 'function') fs[n] = guardedWrite('fs.' + n, fs[n]); });
{ const origOpen = fs.openSync;
  fs.openSync = function (p, flags) {
    const f = flags === undefined ? 'r' : String(flags);
    if (f === 'r' || f === 'rs' || f === 'sr') return origOpen.apply(this, arguments);
    if (insideSandbox(p)) return origOpen.apply(this, arguments);
    violations.push('fs_write:fs.openSync:' + String(p)); throw new Error('SANDBOX_BLOCKED_FS_WRITE:fs.openSync');
  }; }
['writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir', 'copyFile', 'truncate'].forEach(function (n) { if (typeof fs.promises[n] === 'function') fs.promises[n] = guardedWrite('fs.promises.' + n, fs.promises[n]); });
const BLOCKED_BARE = new Set(['axios', 'dotenv', '@supabase/supabase-js', '@anthropic-ai/sdk', 'http2', 'undici', 'child_process', 'node:http2', 'node:child_process']);
const BLOCKED_FILES = new Set(['openaiClient.js', 'claudeClient.js', 'costTracker.js', 'lib/costDb.js', 'conversationHistory.js', 'server.js', 'lib/supabase.js', 'lib/outputDraftsDb.js']
  .map(function (p) { return path.join(ROOT, p); }));
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (BLOCKED_BARE.has(request)) { violations.push('module:' + request); throw new Error('SANDBOX_BLOCKED_MODULE:' + request); }
  let filename = null;
  try { filename = Module._resolveFilename(request, parent, isMain); } catch (e) { filename = null; }
  if (filename && BLOCKED_FILES.has(filename)) { violations.push('module:' + path.relative(ROOT, filename)); throw new Error('SANDBOX_BLOCKED_MODULE:' + request); }
  return origLoad.apply(this, arguments);
};

let _passed = 0, _failed = 0;
function assert(cond, label) { if (cond) { _passed++; console.log('  ✅ ' + label); } else { _failed++; console.log('  ❌ ' + label); } }
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const rs = require('./tools/devAutopilot/runStore');

const T0 = Date.parse('2026-09-28T00:00:00.000Z');
function at(min) { return new Date(T0 + min * 60000).toISOString(); }
const HEAD = '735e39d3f6b5ed01005fd7a0e52ae27c33aa2f37';
const OTHER_HEAD = '961aaf81b5eb6eb5a7af1f7997cd3772d4351d70';
function baseInput(extra) {
  return Object.assign({
    taskId: 'task-001',
    task: { title: 'sample task', goal: 'add a helper', allowedPaths: ['tools/devAutopilot/'], forbiddenPaths: [] },
    mainRepoPath: ROOT, baseHead: HEAD, branch: 'dev/task-001', worktreePath: path.join(SANDBOX, 'wt', 'task-001'),
    budget: { capUsd: 5, maxInvocations: 6 }, mainStatusHashAtStart: 'de31f7fdb243',
    protectedMd5AtStart: Object.assign({}, PROTECTED_BASELINE), now: at(0),
  }, extra || {});
}
// S5：research の前に隔離 worktree を確定する（stage 未開始の run だけ）
function isolate(run, when) { const x = rs.markIsolationVerified(run, { now: when || at(0), worktreeHead: HEAD }); if (!x.ok) throw new Error('isolate failed: ' + x.error); return x.run; }
function advance(run, stages, startMin) {
  let r = run.stage === null && run.isolation.state === 'absent' ? isolate(run) : run, m = startMin || 1;
  for (const s of stages) { const x = rs.transitionStage(r, s, { now: at(m++) }); if (!x.ok) throw new Error('advance failed: ' + x.error); r = x.run; }
  return r;
}
const ALL = ['researching', 'designing', 'implementing', 'testing', 'reviewing'];
// Stage 4D：commit 承認待ちの条件（4 stage の検証済み invocation・最後の変更以降の test 全 pass・差分 hash）を満たす run を作る
const DIFF = 'e'.repeat(64);
const UID = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
function okResult() {
  return {
    process: { exitCode: 0, signal: null, timedOut: false, bufferExceeded: false, errorClass: null, wallMs: 1000, stdoutBytes: 10, stderrBytes: 0, termination: 'exit_event_observed' },
    cost: { basis: rs.COST_BASIS, state: 'known', cliReportedUsd: 0.01 },
    envelope: { parse: 'ok', isError: false, subtype: 'success', apiErrorStatus: { state: 'null', value: null }, numTurns: 1, permissionDenials: 0, modelIds: [], unlistedModelCount: 0 },
    schema: { ok: true, errorCodes: [], structuredSource: 'structured_output' }, session: 'match', diff: { result: 'ok', reasonCodes: [], changedCount: 0 },
    safety: { result: 'ok', reasonCodes: [] },
    transcript: { verdict: 'ok', toolCounts: { Read: 1, Glob: 0, Grep: 0, StructuredOutput: 0, other: 0 }, unparseable: 0, outside: 0, missingResults: 0, errorResults: 0, structuredOutputComparison: 'not_present' },
    classification: { outcome: 'ok', reasonCodes: [] }, structuredOutputSha256: null,
  };
}
function invoke(run, stage, n, m) {
  const launch = { exeSha256: 'a'.repeat(64), cliVersion: '2.1.280 (Claude Code)', argvSha256: 'b'.repeat(64), promptSha256: 'c'.repeat(64), settingsSha256: 'd'.repeat(64),
    childVarNames: ['PATH'], timeoutMs: 1000, maxBuffer: 1000, approvalId: UID(900), approvalSha256: 'f'.repeat(64) };
  const b = rs.beginInvocation(run, { now: at(m), invocationId: UID(100 + n), sessionId: UID(200 + n), stage: stage, launch: launch });
  if (!b.ok) throw new Error('begin failed: ' + b.error);
  const c = rs.completeInvocation(b.run, { now: at(m), invocationId: UID(100 + n), state: 'finished', result: okResult(), changedPaths: [] });
  if (!c.ok) throw new Error('complete failed: ' + c.error);
  return c.run;
}
function withCommitEvidence(run0) {
  let r = rs.markIsolationVerified(run0, { now: at(0), worktreeHead: HEAD }).run, m = 1, n = 1;
  for (const s of ALL) {
    r = rs.transitionStage(r, s, { now: at(m++) }).run;
    if (s === 'testing') r = rs.recordTestResults(r, { now: at(m++), batchId: UID(300), diffSha256: DIFF, results: [{ file: 'devAutopilotStep2.test.js', exitCode: 0, timedOut: false }] }).run;
    else r = invoke(r, s, n++, m++);
  }
  return r;
}

(function main() {
  console.log('\n=== devAutopilotStep2.test.js (Development Autopilot V1 Step 2: runStore / State Machine) ===');

  caseHeader('SB. sandbox 自己検証');
  {
    const sv = violations.length;
    let net = false, cp = false, repoWrite = false;
    try { globalThis.fetch('https://example.com'); } catch (e) { net = /SANDBOX_BLOCKED_NETWORK/.test(e.message); }
    try { require('child_process'); } catch (e) { cp = /SANDBOX_BLOCKED_MODULE/.test(e.message); }
    try { fs.writeFileSync(path.join(ROOT, 'cost-logs.json'), 'x'); } catch (e) { repoWrite = /SANDBOX_BLOCKED_FS_WRITE/.test(e.message); }
    violations.length = sv;
    let tmpOk = false;
    try { fs.writeFileSync(path.join(SANDBOX, 'probe.txt'), 'ok'); tmpOk = fs.readFileSync(path.join(SANDBOX, 'probe.txt'), 'utf8') === 'ok'; fs.unlinkSync(path.join(SANDBOX, 'probe.txt')); } catch (e) { tmpOk = false; }
    assert(net && cp && repoWrite && tmpOk, 'SB-1. network・child_process・repo への書き込みを封鎖し、OS temp の sandbox だけ書き込み可');
    assert(!insideSandbox(ROOT) && path.relative(ROOT.toLowerCase(), SANDBOX.toLowerCase()).split(/[\\\/]/)[0] === '..', 'SB-2. sandbox は repo の外（OS temp）');
  }

  caseHeader('ST. State Machine');
  const init = rs.createInitialRun(baseInput());
  let r0 = init.run;
  {
    assert(init.ok && r0.stage === null && r0.gate === 'none' && r0.outcome === null && rs.deriveRunStatus(r0, { now: at(0) }) === 'queued', 'ST-1. 初期状態は queued（stage null / gate none / outcome null / lock なし）');
    assert(!('status' in r0) && !('derivedStatus' in r0), 'ST-1b. derived status は正本に保存しない');
    const noIso = rs.transitionStage(r0, 'researching', { now: at(1) });
    const iso = rs.markIsolationVerified(r0, { now: at(0), worktreeHead: HEAD });
    assert(noIso.error === 'isolation_not_verified' && iso.ok && iso.run.isolation.state === 'verified' && iso.run.stage === null
      && rs.markIsolationVerified(r0, { now: at(0), worktreeHead: OTHER_HEAD }).error === 'worktree_head_mismatch'
      && rs.markIsolationVerified(iso.run, { now: at(0), worktreeHead: HEAD }).error === 'isolation_already_recorded', 'ST-1c. 隔離 worktree（baseHead と一致）の確定前は research を始めない（S5）');
    const s1 = rs.transitionStage(iso.run, 'researching', { now: at(1) });
    assert(s1.ok && s1.run.stage === 'researching' && s1.run.completedStages.length === 0, 'ST-2. researching へ遷移');
    const s2 = rs.transitionStage(s1.run, 'designing', { now: at(2) });
    assert(s2.ok && s2.run.stage === 'designing' && s2.run.completedStages.join() === 'researching', 'ST-3. designing へ遷移（researching が完了扱い）');
    const s3 = rs.transitionStage(s2.run, 'implementing', { now: at(3) });
    assert(s3.ok && s3.run.stage === 'implementing', 'ST-4. implementing へ遷移');
    const s4 = rs.transitionStage(s3.run, 'testing', { now: at(4) });
    assert(s4.ok && s4.run.stage === 'testing', 'ST-5. testing へ遷移');
    const s5 = rs.transitionStage(s4.run, 'reviewing', { now: at(5) });
    assert(s5.ok && s5.run.stage === 'reviewing' && s5.run.completedStages.length === 4, 'ST-6. reviewing へ遷移');
    const s6bare = rs.markAwaitingCommitApproval(s5.run, { now: at(6), currentDiffSha256: DIFF, safety: 'ok' });
    assert(!s6bare.ok && s6bare.error === 'commit_evidence_insufficient', 'ST-6b. invocation・test 記録のない run は review に到達しても commit 承認待ちにできない（Stage 4D）');
    const ev = withCommitEvidence(r0);
    const s6 = rs.markAwaitingCommitApproval(ev, { now: at(30), currentDiffSha256: DIFF, safety: 'ok' });
    assert(s6.ok && s6.run.gate === 'awaiting_commit_approval' && s6.run.completedStages.length === 5 && rs.deriveRunStatus(s6.run, { now: at(30) }) === 'awaiting_human', 'ST-7. awaiting_commit_approval（derived: awaiting_human）');
    assert(s6.run.stageHistory.filter(function (h) { return h.result === 'completed'; }).length === 5 && s6.run.updatedAt === at(30), 'ST-7b. stageHistory と updatedAt を記録');

    const h1 = rs.requireHumanApproval(s3.run, 'risk:human_required', { now: at(7) });
    assert(h1.ok && h1.run.gate === 'human_approval_required' && h1.run.gateReason === 'risk:human_required' && rs.deriveRunStatus(h1.run, { now: at(7) }) === 'awaiting_human', 'ST-8. human_approval_required');
    assert(!rs.transitionStage(h1.run, 'testing', { now: at(8) }).ok, 'ST-8b. human gate 中は stage を進めない');
    const h2 = rs.approveHumanGate(h1.run, { now: at(8), actor: 'human' });
    assert(h2.ok && h2.run.gate === 'none' && h2.run.stage === 'implementing' && h2.run.stageHistory.some(function (x) { return x.result === 'human_approved'; }), 'ST-9. 承認後は止まった stage（implementing）から再開');
    assert(!rs.approveHumanGate(h1.run, { now: at(8) }).ok && !rs.approveHumanGate(h1.run, { now: at(8), actor: 'autopilot' }).ok, 'ST-9b. 承認は actor=human の明示操作だけ');
    const h3 = rs.rejectHumanGate(h1.run, { now: at(8), actor: 'human', detail: 'scope too wide' });
    assert(h3.ok && h3.run.outcome === 'failed' && /^human_rejected/.test(h3.run.failureReason) && rs.deriveRunStatus(h3.run, { now: at(8) }) === 'failed', 'ST-10. 人の却下 → failed（human_rejected）');
    const rj2 = rs.rejectHumanGate(s6.run, { now: at(9), actor: 'human' });
    assert(rj2.ok && rj2.run.outcome === 'failed', 'ST-10b. commit 承認待ちからの却下も failed');

    const b1 = rs.blockRun(s3.run, 'protected_mismatch', { now: at(9) });
    assert(b1.ok && b1.run.outcome === 'blocked' && b1.run.blockedReason === 'protected_mismatch' && rs.deriveRunStatus(b1.run, { now: at(9) }) === 'blocked', 'ST-11. blockRun → blocked（理由必須）');
    assert(!rs.blockRun(s3.run, '', { now: at(9) }).ok, 'ST-11b. 理由なしの block は拒否');
    const f1 = rs.failRun(s4.run, 'tests_failed_twice', { now: at(9) });
    assert(f1.ok && f1.run.outcome === 'failed' && f1.run.failureReason === 'tests_failed_twice', 'ST-12. failRun → failed');

    const c1 = rs.markCompletedByHuman(s6.run, { now: at(10), actor: 'human', commitHash: 'abc1234' });
    assert(c1.ok && c1.run.outcome === 'completed' && c1.run.gate === 'none' && rs.deriveRunStatus(c1.run, { now: at(10) }) === 'completed', 'ST-13. 人の commit 確認後のみ completed');
    assert(!rs.markCompletedByHuman(s6.run, { now: at(10), commitHash: 'abc1234' }).ok && !rs.markCompletedByHuman(s6.run, { now: at(10), actor: 'human' }).ok
      && !rs.markCompletedByHuman(s5.run, { now: at(10), actor: 'human', commitHash: 'abc1234' }).ok, 'ST-13b. actor=human・commitHash・commit 承認待ちのすべてが必要');

    assert(!rs.transitionStage(c1.run, 'implementing', { now: at(11) }).ok && !rs.requireHumanApproval(c1.run, 'x', { now: at(11) }).ok, 'ST-14. completed からの再開は拒否');
    assert(!rs.transitionStage(b1.run, 'testing', { now: at(11) }).ok && !rs.approveHumanGate(b1.run, { now: at(11), actor: 'human' }).ok && !rs.acquireLock(b1.run, { now: at(11), pid: 10 }).ok, 'ST-15. blocked からの自動再開は拒否');
    assert(!rs.transitionStage(f1.run, 'testing', { now: at(11) }).ok && !rs.transitionStage(f1.run, 'reviewing', { now: at(11) }).ok, 'ST-16. failed からの自動再開は拒否');

    assert(!rs.transitionStage(r0, 'designing', { now: at(1) }).ok && !rs.transitionStage(s1.run, 'implementing', { now: at(2) }).ok
      && !rs.transitionStage(s5.run, 'researching', { now: at(6) }).ok && !rs.transitionStage(s6.run, 'implementing', { now: at(7) }).ok, 'ST-17. stage skip・逆行・commit 承認待ちからの実装再開を拒否');
    const badEnum = [Object.assign({}, r0, { stage: 'deploying' }), Object.assign({}, r0, { gate: 'maybe' }), Object.assign({}, r0, { outcome: 'done' })];
    assert(badEnum.every(function (x) { return !rs.validateRunState(x).ok && rs.deriveRunStatus(x, { now: at(0) }) === 'invalid'; }) && !rs.transitionStage(r0, 'deploying', { now: at(1) }).ok, 'ST-18. 不正な stage / gate / outcome を拒否');
    assert(!rs.transitionStage(r0, 'researching', { now: 'yesterday' }).ok && !rs.transitionStage(r0, 'researching', {}).ok, 'ST-18b. now（注入時刻）が不正なら拒否');
    const amb = [Object.assign({}, s3.run, { completedStages: ['researching'] }), Object.assign({}, s6.run, { gateReason: null }), Object.assign({}, b1.run, { gate: 'human_approval_required', gateReason: 'x' })];
    assert(amb.every(function (x) { return !rs.validateRunState(x).ok; }), 'ST-18c. 曖昧な組み合わせ（completedStages 不整合・gate 理由なし・outcome と gate の併存）を拒否');

    const snap = JSON.stringify(s3.run);
    rs.transitionStage(s3.run, 'testing', { now: at(20) }); rs.requireHumanApproval(s3.run, 'x', { now: at(20) }); rs.blockRun(s3.run, 'x', { now: at(20) });
    assert(JSON.stringify(s3.run) === snap, 'ST-19. transition は入力を変更しない');
  }

  caseHeader('LK. Lock');
  {
    const q = rs.createInitialRun(baseInput()).run;
    const l1 = rs.acquireLock(q, { now: at(0), pid: 1234 });
    assert(l1.ok && rs.lockStatus(l1.run.lock, { now: at(5) }) === 'active', 'LK-37. heartbeat が新しい lock は active');
    assert(rs.lockStatus(l1.run.lock, { now: at(11) }) === 'stale' && rs.lockStatus(l1.run.lock, { now: at(5), staleMs: 60000 }) === 'stale', 'LK-38. 既定 10 分・注入した staleMs を超えると stale');
    assert(rs.lockStatus(l1.run.lock, { now: at(5) }) === rs.lockStatus(l1.run.lock, { now: at(5) }) && rs.lockStatus(l1.run.lock, { now: at(-1) }) === 'invalid' && rs.lockStatus(l1.run.lock, {}) === 'invalid', 'LK-39. 注入時刻で決定的・未来の heartbeat や時刻なしは invalid');
    assert(!rs.acquireLock(l1.run, { now: at(1), pid: 99 }).ok && rs.acquireLock(l1.run, { now: at(30), pid: 99 }).error === 'lock_stale_requires_human', 'LK-40. active lock は奪えず、stale lock も自動では奪わない');
    const hb = rs.heartbeatLock(l1.run, { now: at(9), pid: 1234 });
    assert(hb.ok && rs.lockStatus(hb.run.lock, { now: at(15) }) === 'active' && !rs.heartbeatLock(l1.run, { now: at(9), pid: 1 }).ok, 'LK-41. heartbeat は lock の所有者だけ');
    const rel = rs.releaseLock(hb.run, { now: at(10), pid: 1234 });
    assert(rel.ok && rel.run.lock === null, 'LK-42. release で lock を外す');
    const running = rs.transitionStage(isolate(l1.run), 'researching', { now: at(1) }).run;
    assert(rs.deriveRunStatus(running, { now: at(2) }) === 'running' && rs.deriveRunStatus(running, { now: at(30) }) === 'interrupted', 'LK-43. active lock なら running、stale なら interrupted（derived）');
    assert(rs.deriveRunStatus(l1.run, { now: at(1) }) === 'invalid', 'LK-44. stage なしで active lock は曖昧 → invalid');
  }

  caseHeader('SC. Secret protection');
  {
    const base = rs.createInitialRun(baseInput()).run;
    function withKey(fn) { const x = JSON.parse(JSON.stringify(base)); fn(x); return rs.validateRunState(x); }
    const a = withKey(function (x) { x.task.apiKey = 'abc'; });
    const b = withKey(function (x) { x.stageHistory.push({ stage: 'researching', token: 'abc' }); });
    const c = withKey(function (x) { x.riskFindings.push({ password: 'x' }); });
    const d = withKey(function (x) { x.diffSummary = { authorization: 'x' }; });
    const e = withKey(function (x) { x.testResults.push({ env: { A: 1 } }); });
    const f = withKey(function (x) { x.diffSummary = 'leaked sk-ant-abcdefghijklmnopqrstuv'; });
    const g = withKey(function (x) { x.riskFindings.push({ accessToken: 'y', cookie: 'z' }); });
    assert(!a.ok && a.errors.some(function (m) { return /secret_detected:.*apiKey/.test(m); }), 'SC-33. apiKey を拒否');
    assert(!b.ok && !g.ok, 'SC-34. token / accessToken / cookie を拒否');
    assert(!c.ok && !d.ok && !e.ok, 'SC-35. password / authorization / env を拒否');
    assert(!f.ok, 'SC-35b. 値として明白な API key（sk-ant-…）を拒否');
    const withSid = JSON.parse(JSON.stringify(r0)); withSid.sessionIds.research = '1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b';
    const handSet = withKey(function (x) { x.sessionIds.research = '1b4e28ba-2fa1-4d3b-a3f5-ef19b5a7633b'; x.budget.invocations = 1; });
    assert(rs.findSecrets(withSid).length === 0 && !handSet.ok && handSet.errors.some(function (m) { return m.indexOf('session_without_invocation') === 0; })
      && !handSet.errors.some(function (m) { return m.indexOf('secret_detected') === 0; }), 'SC-36. sessionIds（Claude session identifier）は secret と誤検出しない・v2 では invocation の無い手書き session は整合違反');
  }

  caseHeader('PT. Path safety');
  const store = { runtimeRoot: path.join(SANDBOX, 'runtime'), repoPath: ROOT };
  {
    assert(rs.resolveRunPaths(store, 'task-001').ok, 'PT-0. OS temp の runtime root は許可');
    const bad = ['../x', '..\\x', 'a/b', 'a\\b', 'C:x', '/etc', '', 'x', '.hidden', 'task 01'];
    assert(bad.every(function (id) { return rs.resolveRunPaths(store, id).error === 'task_id_invalid'; }), 'PT-28. taskId の path traversal / 区切り文字 / drive を拒否');
    assert(rs.resolveRunPaths({ runtimeRoot: 'relative/rt', repoPath: ROOT }, 'task-001').error === 'runtime_root_invalid'
      && rs.resolveRunPaths({ runtimeRoot: path.join(SANDBOX, 'a') + path.sep + '..' + path.sep + 'b', repoPath: ROOT }, 'task-001').error === 'runtime_root_traversal'
      && rs.resolveRunPaths({ runtimeRoot: SANDBOX + '\u0000x', repoPath: ROOT }, 'task-001').error === 'runtime_root_invalid', 'PT-29. 相対 path・.. を含む root・制御文字を拒否');
    const inRepo = rs.resolveRunPaths({ runtimeRoot: path.join(ROOT, 'tmp-runtime'), repoPath: ROOT }, 'task-001');
    const repoItself = rs.resolveRunPaths({ runtimeRoot: ROOT, repoPath: ROOT }, 'task-001');
    assert(inRepo.error === 'runtime_root_inside_repo' && repoItself.error === 'runtime_root_inside_repo', 'PT-30. repo 内の runtime root を拒否');
    const fwd = rs.resolveRunPaths({ runtimeRoot: ROOT.replace(/\\/g, '/') + '/x', repoPath: ROOT }, 'task-001');
    const mixed = rs.resolveRunPaths({ runtimeRoot: ROOT.replace(/\\/g, '/') + '\\sub/deep', repoPath: ROOT }, 'task-001');
    assert(fwd.error === 'runtime_root_inside_repo' && mixed.error === 'runtime_root_inside_repo', 'PT-31. Windows の区切り文字（/ と \\ の混在）でも repo 内を検出');
    const upper = rs.resolveRunPaths({ runtimeRoot: path.join(ROOT.toUpperCase(), 'x'), repoPath: ROOT.toLowerCase() }, 'task-001');
    assert(upper.error === 'runtime_root_inside_repo', 'PT-32. 大文字小文字が違っても repo 内を検出');
    const repoInRun = rs.resolveRunPaths({ runtimeRoot: path.join(SANDBOX, 'rt2'), repoPath: path.join(SANDBOX, 'rt2', 'runs', 'task-001', 'repo') }, 'task-001');
    assert(repoInRun.error === 'repo_inside_run_dir' && rs.resolveRunPaths({ runtimeRoot: SANDBOX }, 'task-001').error === 'repo_path_required', 'PT-33. repo が run dir の内側・repoPath 未指定を拒否');
    const blockedCreate = rs.createRun({ runtimeRoot: path.join(ROOT, 'tmp-runtime'), repoPath: ROOT }, r0);
    let existsInRepo = true;
    try { fs.statSync(path.join(ROOT, 'tmp-runtime')); } catch (e) { existsInRepo = false; }
    assert(blockedCreate.ok === false && existsInRepo === false, 'PT-34. repo 内への createRun は directory も作らずに拒否');
  }

  caseHeader('SR. runStore（OS temp のみ）');
  {
    const created = rs.createRun(store, r0);
    assert(created.ok && created.runFile.toLowerCase().indexOf(SANDBOX.toLowerCase()) === 0, 'SR-20. run.json を作成（OS temp の sandbox 内）');
    const read = rs.readRun(store, 'task-001');
    assert(read.ok && JSON.stringify(read.run) === JSON.stringify(r0), 'SR-21. 読み込みは保存内容と一致');
    const nx = rs.transitionStage(isolate(read.run), 'researching', { now: at(1) }).run;
    const saved = rs.saveRun(store, nx, { expectedUpdatedAt: r0.updatedAt });
    assert(saved.ok && rs.readRun(store, 'task-001').run.stage === 'researching', 'SR-22. update（楽観的排他つき）');
    assert(rs.saveRun(store, nx, { expectedUpdatedAt: r0.updatedAt }).error === 'stale_write' && rs.saveRun(store, nx, {}).error === 'stale_write', 'SR-22b. 古い updatedAt での上書きは拒否');

    const before = fs.readFileSync(created.runFile, 'utf8');
    const failingFs = Object.assign({}, fs, { renameSync: function () { throw new Error('simulated crash before rename'); } });
    const nx2 = rs.transitionStage(nx, 'designing', { now: at(2) }).run;
    const crashed = rs.saveRun(Object.assign({}, store, { fs: failingFs }), nx2, { expectedUpdatedAt: nx.updatedAt });
    const leftovers = fs.readdirSync(path.dirname(created.runFile)).filter(function (f) { return f !== 'run.json'; });
    assert(crashed.error === 'atomic_write_failed' && fs.readFileSync(created.runFile, 'utf8') === before && leftovers.length === 0, 'SR-23. rename 前に失敗しても既存 run.json は無傷・tmp も残さない（atomic）');
    assert(rs.saveRun(store, nx2, { expectedUpdatedAt: nx.updatedAt }).ok && rs.readRun(store, 'task-001').run.stage === 'designing', 'SR-23b. 正常時は tmp → rename で置き換わる');

    const s2 = { runtimeRoot: path.join(SANDBOX, 'runtime-bad'), repoPath: ROOT };
    const badRun = rs.createInitialRun(baseInput({ taskId: 'task-002', branch: 'dev/task-002' })).run;
    rs.createRun(s2, badRun);
    const f2 = rs.resolveRunPaths(s2, 'task-002').runFile;
    fs.writeFileSync(f2, '{ broken json');
    assert(rs.readRun(s2, 'task-002').error === 'run_json_invalid', 'SR-24. 壊れた JSON を検出');
    fs.writeFileSync(f2, JSON.stringify(Object.assign({}, badRun, { schemaVersion: 99 })));
    const sv = rs.readRun(s2, 'task-002');
    assert(sv.error === 'run_invalid' && sv.errors.indexOf('schema_version') !== -1, 'SR-25. schemaVersion 不一致（未知の版）を検出');
    // v1 記録：read-only 参照はできるが、実行・上書き・再開はしない（自動移行しない・ファイルを変更しない）
    const v1Run = JSON.parse(JSON.stringify(badRun)); v1Run.schemaVersion = 1; delete v1Run.isolation; delete v1Run.invocations;
    const v1Text = JSON.stringify(v1Run, null, 2) + '\n';
    fs.writeFileSync(f2, v1Text);
    const v1Read = rs.readRun(s2, 'task-002');
    const v1Next = rs.transitionStage(v1Run, 'researching', { now: '2026-09-30T00:00:01.000Z' });
    const v2Try = rs.transitionStage(isolate(badRun), 'researching', { now: '2026-09-30T00:00:01.000Z' }).run;
    const v1Save = rs.saveRun(s2, v2Try, { expectedUpdatedAt: v1Run.updatedAt });
    assert(v1Read.ok && v1Read.schemaVersion === 1 && v1Read.executable === false && v1Read.run.stage === null && !v1Next.ok
      && v1Save.error === 'run_read_only_v1' && fs.readFileSync(f2, 'utf8') === v1Text, 'SR-25c. v1 記録は read-only 参照のみ（遷移・上書きは拒否・ファイルは不変）');
    const v2Read = rs.readRun(store, 'task-001');
    assert(v2Read.ok && v2Read.schemaVersion === 2 && v2Read.executable === true, 'SR-25d. v2 記録は実行可能として読める（ok / run の意味は従来どおり）');
    fs.writeFileSync(f2, JSON.stringify(Object.assign({}, badRun, { taskId: 'task-999' })));
    assert(rs.readRun(s2, 'task-002').error === 'task_id_mismatch', 'SR-25b. run.json の taskId と directory の不一致を検出');
    assert(rs.createRun(store, r0).error === 'run_exists', 'SR-26. 同じ taskId の重複 create を拒否（既存を上書きしない）');
    assert(rs.readRun(store, 'task-404').error === 'run_not_found', 'SR-27. 存在しない run は run_not_found');
    const secretRun = JSON.parse(JSON.stringify(r0)); secretRun.taskId = 'task-003'; secretRun.branch = 'dev/task-003'; secretRun.task.apiKey = 'x';
    let sec3 = true; try { fs.statSync(path.join(store.runtimeRoot, 'runs', 'task-003')); } catch (e) { sec3 = false; }
    assert(rs.createRun(store, secretRun).error === 'run_invalid' && sec3 === false, 'SR-28. secret を含む run は保存しない（directory も作らない）');
    // S2：本物の fs（OS temp の sandbox 内）での owner.lock の排他作成・所有者保存・解放
    const s3 = { runtimeRoot: path.join(SANDBOX, 'runtime-owner'), repoPath: ROOT };
    const oRun = rs.createInitialRun(baseInput({ taskId: 'task-010', branch: 'dev/task-010' })).run;
    const OWN_A = '00000000-0000-4000-8000-000000000a01', OWN_B = '00000000-0000-4000-8000-000000000b02';
    const oc = rs.createRun(s3, oRun);
    const oa = rs.acquireOwnership(s3, 'task-010', { ownerId: OWN_A, pid: 4321, now: at(1) });
    const ob = rs.acquireOwnership(s3, 'task-010', { ownerId: OWN_B, pid: 8765, now: at(1) });
    const olFile = path.join(path.dirname(oc.runFile), 'owner.lock');
    const oLockOnDisk = fs.readFileSync(olFile, 'utf8');
    const oHb = rs.saveRunAsOwner(s3, rs.heartbeatLock(oa.run, { now: at(2), pid: 4321, ownerId: OWN_A }).run, { ownerId: OWN_A, expectedRevision: 1, now: at(2) });
    const oRel = rs.releaseOwnership(s3, 'task-010', { ownerId: OWN_A, expectedRevision: 2, now: at(3) });
    const oLeft = fs.readdirSync(path.dirname(oc.runFile));
    assert(oc.ok && oa.ok && !ob.ok && JSON.parse(oLockOnDisk).ownerId === OWN_A && oHb.ok && oRel.ok && oLeft.join(',') === 'run.json'
      && rs.readRun(s3, 'task-010').run.lock === null && rs.readRun(s3, 'task-010').run.revision === 3, 'SR-29. 本物の fs で owner.lock の排他作成・二重取得の拒否・所有者保存・解放（残骸なし）');
  }

  caseHeader('RS. Resume validation');
  {
    const good = { baseHeadExists: true, currentHead: HEAD, currentOriginMain: HEAD, worktreeExists: true, branchExists: true, worktreeStatus: 'dirty', diffAllowed: true, protectedMd5Matches: true, diffClassification: 'recorded_within_scope' };
    const clean = Object.assign({}, good, { worktreeStatus: 'clean', diffClassification: 'none' });
    const noWt = Object.assign({}, good, { worktreeExists: false, branchExists: false, worktreeStatus: 'absent' });
    const testing = advance(r0, ALL.slice(0, 4));
    const researching = advance(r0, ALL.slice(0, 1));
    const implementing = advance(r0, ALL.slice(0, 3));
    const opt = { now: at(60) };
    assert(rs.validateResume(testing, good, opt).result === 'resumable' && rs.validateResume(researching, clean, opt).result === 'resumable'
      && rs.validateResume(r0, Object.assign({}, noWt, { diffClassification: undefined }), opt).result === 'resumable', 'RS-40. 整合した run は resumable（testing の記録済み差分 / research 中の clean な隔離 worktree / 隔離前の queued）');;
    const pm = rs.validateResume(testing, Object.assign({}, good, { protectedMd5Matches: false }), opt);
    assert(pm.result === 'blocked' && pm.reasons.indexOf('protected_mismatch') !== -1, 'RS-41. Protected 不一致 → blocked');
    const ds = rs.validateResume(testing, Object.assign({}, good, { diffAllowed: false }), opt);
    assert(ds.result === 'blocked' && ds.reasons.indexOf('diff_outside_scope') !== -1, 'RS-42. scope 外の diff → blocked');
    const mal = rs.validateResume(Object.assign({}, testing, { stage: 'deploying' }), good, opt);
    const malSnap = rs.validateResume(testing, { worktreeExists: 'yes' }, opt);
    assert(mal.result === 'blocked' && mal.reasons[0] === 'run_invalid' && malSnap.result === 'blocked' && malSnap.reasons[0] === 'snapshot_invalid', 'RS-43. 壊れた run / snapshot → blocked');
    const intr = rs.validateResume(implementing, good, opt);
    assert(intr.result === 'human_approval_required' && intr.reasons.indexOf('interrupted_implementation') !== -1, 'RS-44. 実装途中で停止 → human_approval_required');
    const amb1 = rs.validateResume(r0, good, opt);
    const amb2 = rs.validateResume(testing, noWt, opt);
    const amb3 = rs.validateResume(testing, Object.assign({}, good, { branchExists: false }), opt);
    const amb4 = rs.validateResume(researching, noWt, opt);
    assert(amb1.result === 'blocked' && amb1.reasons.indexOf('unexpected_worktree_before_isolation') !== -1 && amb2.result === 'blocked' && amb3.result === 'blocked'
      && amb4.result === 'blocked' && amb4.reasons.indexOf('worktree_or_branch_missing') !== -1, 'RS-45. 曖昧（隔離確定前なのに worktree あり・research 以降の worktree/branch 欠落）→ blocked');
    // S5：再開時の差分分類（記録済み・許可範囲内の実装差分と想定外の差分を区別。材料不足は停止）
    const dcMissing = rs.validateResume(testing, Object.assign({}, good, { diffClassification: undefined }), opt);
    const dcUnexp = rs.validateResume(testing, Object.assign({}, good, { diffClassification: 'unexpected' }), opt);
    const dcUnknown = rs.validateResume(testing, Object.assign({}, good, { diffClassification: 'unknown' }), opt);
    const dcEarly = rs.validateResume(researching, Object.assign({}, good, { diffClassification: 'recorded_within_scope' }), opt);
    const dcIncons = rs.validateResume(researching, Object.assign({}, clean, { worktreeStatus: 'dirty' }), opt);
    assert(dcMissing.reasons.indexOf('diff_classification_missing') !== -1 && dcUnexp.reasons.indexOf('diff_unexpected') !== -1 && dcUnknown.reasons.indexOf('diff_unknown') !== -1
      && dcEarly.reasons.indexOf('diff_before_implementation') !== -1 && dcIncons.reasons.indexOf('diff_classification_inconsistent') !== -1
      && [dcMissing, dcUnexp, dcUnknown, dcEarly, dcIncons].every(function (x) { return x.result === 'blocked'; }), 'RS-45b. 差分分類の欠落・想定外・不明・実装前の差分・分類と状態の矛盾は blocked');
    const impl = JSON.parse(JSON.stringify(implementing)); impl.filesChanged = ['tools/devAutopilot/x.js'];
    const C = rs.classifyResumeDiff;
    assert(C(impl, []) === 'none' && C(impl, [{ path: 'tools/devAutopilot/x.js', status: 'modified' }]) === 'recorded_within_scope'
      && C(impl, [{ path: 'tools/devAutopilot/y.js', status: 'modified' }]) === 'unexpected' && C(impl, [{ path: 'server.js', status: 'modified' }]) === 'unexpected'
      && C(researching, [{ path: 'tools/devAutopilot/x.js', status: 'modified' }]) === 'unexpected' && C(impl, [{ path: '../x.js', status: 'modified' }]) === 'unknown'
      && C(impl, 'x') === 'unknown' && C({ bad: 1 }, []) === 'unknown', 'RS-45c. classifyResumeDiff：記録済み・許可範囲内だけ recorded_within_scope・未記録 / 範囲外 / 実装前は unexpected・不正は unknown');
    assert(rs.validateResume(testing, Object.assign({}, good, { baseHeadExists: false }), opt).result === 'blocked', 'RS-46. baseHead が存在しない → blocked');
    const adv = rs.validateResume(testing, Object.assign({}, good, { currentOriginMain: OTHER_HEAD }), opt);
    assert(adv.result === 'human_approval_required' && adv.reasons.indexOf('origin_advanced') !== -1, 'RS-47. origin/main が進んだ → human_approval_required');
    const locked = rs.acquireLock(testing, { now: at(50), pid: 77 }).run;
    assert(rs.validateResume(locked, good, { now: at(55) }).result === 'blocked' && rs.validateResume(locked, good, { now: at(90) }).result === 'human_approval_required', 'RS-48. active lock → blocked（二重起動防止）・stale lock → human_approval_required');
    const done = rs.markCompletedByHuman(rs.markAwaitingCommitApproval(withCommitEvidence(r0), { now: at(40), currentDiffSha256: DIFF, safety: 'ok' }).run, { now: at(41), actor: 'human', commitHash: 'abc1234' }).run;
    const blockedRun = rs.blockRun(testing, 'x', { now: at(41) }).run;
    assert(rs.validateResume(done, good, opt).result === 'blocked' && rs.validateResume(blockedRun, good, opt).result === 'blocked', 'RS-49. completed / blocked の run は resume しない');
    const gateRun = rs.requireHumanApproval(testing, 'risk', { now: at(41) }).run;
    assert(rs.validateResume(gateRun, good, opt).result === 'human_approval_required', 'RS-50. human gate 待ちは human_approval_required のまま（自動再開しない）');
    const snapIn = JSON.stringify(good), runIn = JSON.stringify(testing);
    rs.validateResume(testing, good, opt);
    assert(JSON.stringify(good) === snapIn && JSON.stringify(testing) === runIn, 'RS-51. resume 判定は入力を変更しない');
  }

  caseHeader('P. Protected 10件 hash 不変・sandbox 違反 0・repo に runtime file なし');
  {
    const pv = pc.verify(protectedBefore, pc.snapshot(ROOT), PROTECTED_BASELINE);
    assert(pv.ok && PROTECTED_FILES.length === 10, 'P-1. Protected 10件の hash が開始時・終了時とも baseline 一致（' + pv.mode + (pv.ok ? '' : ' ' + pv.reasons.join(',')) + '）');
    assert(violations.length === 0, 'P-2. sandbox 違反 0（network / DB / provider / repo への fs write / env file）');
    let runsInRepo = true; try { fs.statSync(path.join(ROOT, 'runs')); } catch (e) { runsInRepo = false; }
    let tmpInRepo = true; try { fs.statSync(path.join(ROOT, 'tmp-runtime')); } catch (e) { tmpInRepo = false; }
    assert(!runsInRepo && !tmpInRepo, 'P-3. repo 内に run directory を作っていない');
  }

  // 自分で作った OS temp の sandbox directory だけを削除
  //   失敗は黙って無視しない：削除の例外・削除後の残存（ENOENT 以外の stat 結果・親 directory の一覧に残る）はテスト失敗として報告する
  let rmError = null;
  try { ORIG_RM(SANDBOX, { recursive: true, force: true }); } catch (e) { rmError = (e && e.code) || 'rm_failed'; }
  let statState = 'present'; try { fs.statSync(SANDBOX); } catch (e) { statState = e && e.code === 'ENOENT' ? 'absent' : 'unknown:' + ((e && e.code) || 'error'); }
  let listed = true; try { listed = fs.readdirSync(os.tmpdir()).indexOf(path.basename(SANDBOX)) !== -1; } catch (e) { listed = true; }
  assert(rmError === null && statState === 'absent' && !listed, 'P-4. 自分で作った temp directory だけを後始末（失敗・残存は FAIL として報告）'
    + (rmError || statState !== 'absent' || listed ? '（rm: ' + (rmError || 'ok') + ' / stat: ' + statState + ' / listed: ' + listed + ' / ' + path.basename(SANDBOX) + '）' : ''));

  console.log('\n────────────────────────────────────────────────────────────');
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exit(1); }
  console.log('🟢 All Development Autopilot Step 2 cases passed');
})();
