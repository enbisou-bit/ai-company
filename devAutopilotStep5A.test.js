'use strict';
// devAutopilotStep5A.test.js
// Development Autopilot V1 — Stage 4C S1（runStore schema v2・invocation 記録の純関数）の deterministic テスト。
//
//   ★ 実行は必ずこのファイル名を明示指定する（node devAutopilotStep5A.test.js）。
//   ★ 純関数 test のみ。Claude CLI・API・child_process・Git・network・DB・fs write（OS temp を含む）は冒頭で封鎖する。
//   ★ process.env は変更しない。Protected 10件の hash を開始時・終了時に read-only で取得し、全件一致を assert する。
//   ★ ここで確認するのは「新しい状態を返す純関数」だけ。ディスク保存の atomic 性・所有者 lock・heartbeat は S2 以降。

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
function hashProtected() {
  const out = {};
  PROTECTED_FILES.forEach(function (rel) {
    try { out[rel] = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'); }
    catch (e) { out[rel] = 'unreadable:' + e.code; }
  });
  return out;
}
const protectedBefore = hashProtected();

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
function has(list, x) { return Array.isArray(list) && list.some(function (r) { return r === x || String(r).indexOf(x) === 0; }); }
const clone = (o) => JSON.parse(JSON.stringify(o));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

const rs = require('./tools/devAutopilot/runStore');

// ── fixture（すべて人工値）──
const HEAD = 'd30f88b5e1282b58b1cc208a26b949cd381dfe6a';
const T0 = Date.parse('2026-09-30T00:00:00.000Z');
const at = (s) => new Date(T0 + s * 1000).toISOString();
const U = (n) => '00000000-0000-4000-8000-' + String(n).padStart(12, '0');
const H64 = (c) => c.repeat(64);
function newRun(budget) {
  const init = rs.createInitialRun({
    taskId: 'task-5a-001', task: { title: 't', goal: 'g', allowedPaths: ['tools/'], forbiddenPaths: [] },
    mainRepoPath: 'C:\\Users\\hp\\ENBISOU_AI\\ai-company', baseHead: HEAD, branch: 'dev/task-5a-001', worktreePath: 'C:\\Users\\hp\\ENBISOU_AI\\.autopilot\\wt\\task-5a-001',
    budget: Object.assign({ capUsd: 5, maxInvocations: 6 }, budget || {}), mainStatusHashAtStart: '8226124a93f0', protectedMd5AtStart: Object.assign({}, PROTECTED_BASELINE), now: at(0),
  });
  if (!init.ok) throw new Error('fixture invalid: ' + JSON.stringify(init));
  return init.run;
}
function researching(budget) { return rs.transitionStage(newRun(budget), 'researching', { now: at(1) }).run; }
function launch(extra) {
  return Object.assign({ exeSha256: H64('a'), cliVersion: '2.1.280 (Claude Code)', argvSha256: H64('b'), promptSha256: H64('c'), settingsSha256: H64('d'),
    childVarNames: ['APPDATA', 'COMSPEC', 'DISABLE_UPDATES', 'HOME', 'LOCALAPPDATA', 'PATH', 'PATHEXT', 'SYSTEMDRIVE', 'SYSTEMROOT', 'TEMP', 'TMP', 'USERPROFILE', 'WINDIR'],
    timeoutMs: 300000, maxBuffer: 262144 }, extra || {});
}
function beginIn(stage, n, extra) { return Object.assign({ now: at(10 + n), invocationId: U(100 + n), sessionId: U(200 + n), stage: stage, launch: launch() }, extra || {}); }
function okResult(over) {
  const r = {
    process: { exitCode: 0, signal: null, timedOut: false, bufferExceeded: false, errorClass: null, wallMs: 16000, stdoutBytes: 2300, stderrBytes: 0, termination: 'exit_event_observed' },
    cost: { basis: rs.COST_BASIS, state: 'known', cliReportedUsd: 0.02 },
    envelope: { parse: 'ok', isError: false, subtype: 'success', apiErrorStatus: { state: 'null', value: null }, numTurns: 4, permissionDenials: 0, modelIds: ['claude-haiku-4-5-20251001'], unlistedModelCount: 0 },
    schema: { ok: true, errorCodes: [], structuredSource: 'structured_output' },
    session: 'match',
    diff: { result: 'ok', reasonCodes: [], changedCount: 0 },
    safety: { result: 'ok', reasonCodes: [] },
    transcript: { verdict: 'ok', toolCounts: { Read: 1, Glob: 0, Grep: 1, StructuredOutput: 0, other: 0 }, unparseable: 0, outside: 0, missingResults: 0, errorResults: 0 },
    classification: { outcome: 'ok', reasonCodes: [] },
    structuredOutputSha256: H64('e'),
  };
  (over || []).forEach(function (f) { f(r); });
  return r;
}
function completeIn(n, state, result, extra) { return Object.assign({ now: at(20 + n), invocationId: U(100 + n), state: state, result: result }, extra || {}); }
const SNAP = { baseHeadExists: true, currentHead: HEAD, currentOriginMain: HEAD, worktreeExists: false, branchExists: false, worktreeStatus: 'absent', diffAllowed: true, protectedMd5Matches: true };

(function main() {
  caseHeader('B. beginInvocation（予約・回数・session・stageHistory を 1 つの新しい状態で返す）');
  {
    const r1 = researching();
    const before = clone(r1);
    const b = rs.beginInvocation(r1, beginIn('researching', 1));
    const inv = b.ok ? b.run.invocations[0] : {};
    assert(b.ok && b.run.invocations.length === 1 && inv.state === 'started' && inv.result === null && inv.completedAt === null && b.run.budget.invocations === 1
      && b.run.sessionIds.research === U(201) && b.run.stageHistory[b.run.stageHistory.length - 1].invocations === 1, 'B-1. 予約・回数加算・session 割当・stageHistory 更新を一度に反映');
    assert(same(r1, before), 'B-2. 入力の run を変更しない');
    assert(inv.launch && inv.launch.exeSha256.length === 64 && inv.launch.argvSha256 === H64('b'), 'B-3. SHA-256 は 64 桁全体を保持');
    const again = rs.beginInvocation(b.run, beginIn('researching', 2));
    assert(!again.ok && again.error === 'invocation_unfinalized', 'B-4. 未確定 invocation（started）が残る間は次を予約しない');
    const bad = [
      beginIn('researching', 3, { invocationId: 'abc' }), beginIn('researching', 3, { sessionId: 'sess-1' }),
      beginIn('researching', 3, { launch: launch({ exeSha256: 'a'.repeat(12) }) }), beginIn('researching', 3, { launch: launch({ childVarNames: ['path'] }) }),
      beginIn('researching', 3, { launch: Object.assign(launch(), { extra: 1 }) }), Object.assign(beginIn('researching', 3), { token: 'x' }),
      beginIn('designing', 3), beginIn('researching', 3, { launch: launch({ cliVersion: 'latest' }) }),
    ];
    const outs = bad.map(function (x) { return rs.beginInvocation(r1, x); });
    assert(outs.every(function (o) { return !o.ok && o.run === undefined; }) && same(r1, before), 'B-5. 不正入力（ID・session・短い hash・env 名・未知 key・stage 違い・版）は拒否し部分更新しない');
    assert(rs.beginInvocation(newRun(), beginIn('researching', 3)).error === 'stage_not_invocable'
      && rs.beginInvocation(rs.requireHumanApproval(r1, 'x', { now: at(2) }).run, beginIn('researching', 3)).error === 'gate_pending:human_approval_required'
      && rs.beginInvocation(rs.failRun(r1, 'x', { now: at(2) }).run, beginIn('researching', 3)).error === 'terminal_outcome:failed', 'B-6. stage 未開始・gate 待ち・終了状態では予約しない');
  }

  caseHeader('C. completeInvocation（観測値・費用・invocation 状態・outcome / gate を一括更新）');
  {
    const r = rs.beginInvocation(researching(), beginIn('researching', 1)).run;
    const before = clone(r);
    const c = rs.completeInvocation(r, completeIn(1, 'finished', okResult()));
    const inv = c.ok ? c.run.invocations[0] : {};
    assert(c.ok && inv.state === 'finished' && inv.result.disposition === 'none' && inv.result.dispositionReason === null && c.run.budget.spentUsd === 0.02
      && c.run.stageHistory[c.run.stageHistory.length - 1].costUsd === 0.02 && c.run.outcome === null && c.run.gate === 'none' && same(r, before), 'C-1. 正常完了：finished・費用加算・区分 none・入力は不変');
    assert(inv.result && inv.result.cost.basis === 'cli_reported_estimate_not_billing' && rs.COST_BASIS === 'cli_reported_estimate_not_billing', 'C-2. 費用は CLI 推定値として保存（請求額・月額利用枠と区別）');
    const dbl = rs.completeInvocation(c.run, completeIn(1, 'finished', okResult()));
    assert(!dbl.ok && dbl.error === 'invocation_already_finalized' && c.run.budget.spentUsd === 0.02, 'C-3. 二重完了を拒否（費用の二重計上なし）');
    const unk = rs.completeInvocation(r, completeIn(1, 'finished', okResult([function (x) { x.cost = { basis: rs.COST_BASIS, state: 'unknown', cliReportedUsd: null }; }])));
    assert(unk.ok && unk.run.budget.costUnknown === true && unk.run.budget.spentUsd === 0 && unk.run.gate === 'human_approval_required'
      && unk.run.gateReason === 'invocation:cost_unknown' && unk.run.invocations[0].result.cost.cliReportedUsd === null, 'C-4. 費用不明は 0 とみなさず costUnknown ＋ Human 判断を要求');
    const unkZero = rs.completeInvocation(r, completeIn(1, 'finished', okResult([function (x) { x.cost = { basis: rs.COST_BASIS, state: 'unknown', cliReportedUsd: 0 }; }])));
    const billing = rs.completeInvocation(r, completeIn(1, 'finished', okResult([function (x) { x.cost.basis = 'billing'; }])));
    assert(unkZero.error === 'result_invalid' && billing.error === 'result_invalid', 'C-5. 費用不明に 0 を入れる・請求額扱いの basis は拒否');
    const approved = rs.approveHumanGate(unk.run, { now: at(40), actor: 'human' }).run;
    const moved = rs.transitionStage(approved, 'designing', { now: at(41) }).run;
    assert(rs.beginInvocation(moved, beginIn('designing', 2)).error === 'cost_unknown_requires_human', 'C-6. 費用不明のままでは次の invocation を予約しない');
    const unv = rs.completeInvocation(r, completeIn(1, 'finished', okResult([function (x) { x.transcript.verdict = 'unverified_unknown_tool'; x.transcript.toolCounts.StructuredOutput = 1; }])));
    assert(unv.ok && unv.run.outcome === 'blocked' && unv.run.blockedReason === 'invocation:unverified:unverified_unknown_tool' && unv.run.invocations[0].result.disposition === 'block'
      && !rs.transitionStage(unv.run, 'designing', { now: at(41) }).ok && !rs.markAwaitingCommitApproval(unv.run, { now: at(41) }).ok, 'C-7. 未検証（未知 tool）は block の終了状態・次 stage / commit 承認待ちへ進めない');
    const unc = rs.completeInvocation(r, completeIn(1, 'unconfirmed', okResult([function (x) { x.process.timedOut = true; x.process.exitCode = null; x.process.signal = 'SIGKILL'; x.process.termination = 'descendants_unknown'; x.classification = { outcome: 'failed', reasonCodes: ['timeout'] }; }])));
    assert(unc.ok && unc.run.invocations[0].state === 'unconfirmed' && unc.run.outcome === 'blocked' && unc.run.blockedReason === 'invocation:termination_unconfirmed', 'C-8. 終了未確認は unconfirmed・block');
    assert(rs.completeInvocation(r, completeIn(1, 'unconfirmed', okResult([function (x) { x.classification = { outcome: 'failed', reasonCodes: ['x'] }; }]))).error === 'unconfirmed_requires_unconfirmed_termination'
      && rs.completeInvocation(r, completeIn(1, 'finished', okResult([function (x) { x.process.termination = 'exit_event_missing'; x.classification = { outcome: 'failed', reasonCodes: ['x'] }; }]))).error === 'finished_requires_confirmed_termination', 'C-9. 終了確認の状態と invocation 状態の矛盾は拒否');
    const both = rs.completeInvocation(r, completeIn(1, 'finished', okResult([function (x) { x.safety = { result: 'violated', reasonCodes: ['main_protected_changed'] }; x.classification = { outcome: 'failed', reasonCodes: ['cli_error_401'] }; x.envelope.isError = true; }])));
    assert(both.ok && both.run.outcome === 'blocked' && both.run.blockedReason === 'invocation:safety:violated' && same(both.run.invocations[0].result.classification.reasonCodes, ['cli_error_401']), 'C-10. Safety 違反が失敗より優先（401 の詳細も保持）');
    const f401 = rs.completeInvocation(r, completeIn(1, 'finished', okResult([function (x) { x.process.exitCode = 1; x.envelope.isError = true; x.envelope.apiErrorStatus = { state: 'number', value: 401 }; x.classification = { outcome: 'failed', reasonCodes: ['non_zero_exit', 'cli_error', 'cli_error_401'] }; }])));
    assert(f401.ok && f401.run.outcome === 'failed' && f401.run.failureReason === 'invocation:classification:failed', 'C-11. エラー応答（401）は fail');
    const inc = rs.completeInvocation(r, completeIn(1, 'finished', okResult([function (x) { x.schema = { ok: false, errorCodes: ['missing_keys:summary'], structuredSource: null }; }])));
    assert(!inc.ok && inc.error === 'result_inconsistent' && same(r, before), 'C-12. 分類 ok と観測値の矛盾（schema 不正）は拒否し部分更新しない');
    const badRes = [okResult([function (x) { x.extra = 1; }]), okResult([function (x) { x.structuredOutputSha256 = 'e'.repeat(12); }]), okResult([function (x) { x.transcript.toolCounts.Bash = 1; }]),
      okResult([function (x) { x.envelope.apiErrorStatus = { state: 'number', value: '401' }; }]), okResult([function (x) { x.safety = { result: 'violated', reasonCodes: [] }; }]),
      okResult([function (x) { x.diff.reasonCodes = ['has space'] }])];
    assert(badRes.every(function (x) { const o = rs.completeInvocation(r, completeIn(1, 'finished', x)); return !o.ok && o.error === 'result_invalid'; }) && same(r, before), 'C-13. allowlist 外の key・短い hash・未知 tool 名・型不正・理由なき違反・不正な理由コードは拒否');
    assert(rs.completeInvocation(r, completeIn(9, 'finished', okResult())).error === 'invocation_not_found', 'C-14. 存在しない invocation は完了できない');
    // 複合条件：失敗と未検証・終了未確認・Safety 違反が同時にある場合は block を優先し、失敗の詳細理由は保持する
    const fail401 = function (x) { x.process.exitCode = 1; x.envelope.isError = true; x.envelope.apiErrorStatus = { state: 'number', value: 401 }; x.classification = { outcome: 'failed', reasonCodes: ['non_zero_exit', 'cli_error', 'cli_error_401'] }; };
    const k1 = rs.completeInvocation(r, completeIn(1, 'finished', okResult([fail401, function (x) { x.transcript.verdict = 'unverified_unknown_tool'; x.transcript.toolCounts.other = 1; }])));
    const k2 = rs.completeInvocation(r, completeIn(1, 'finished', okResult([fail401, function (x) { x.transcript.verdict = 'unverified_record_unparseable'; x.transcript.unparseable = 1; }])));
    const k3 = rs.completeInvocation(r, completeIn(1, 'finished', okResult([fail401, function (x) { x.transcript.verdict = 'not_analyzed'; }])));
    const k4 = rs.completeInvocation(r, completeIn(1, 'unconfirmed', okResult([fail401, function (x) { x.process.termination = 'exit_event_missing'; x.transcript.verdict = 'unverified_unknown_tool'; x.safety = { result: 'violated', reasonCodes: ['main_status_changed'] }; }])));
    const k5 = rs.completeInvocation(r, completeIn(1, 'finished', okResult([fail401, function (x) { x.transcript.verdict = 'unverified_unknown_tool'; x.safety = { result: 'violated', reasonCodes: ['main_status_changed'] }; }])));
    const keeps401 = (k) => k.ok && same(k.run.invocations[0].result.classification.reasonCodes, ['non_zero_exit', 'cli_error', 'cli_error_401']) && k.run.invocations[0].result.envelope.apiErrorStatus.value === 401;
    assert(k1.ok && k1.run.outcome === 'blocked' && k1.run.blockedReason === 'invocation:unverified:unverified_unknown_tool' && keeps401(k1)
      && k2.ok && k2.run.outcome === 'blocked' && k2.run.blockedReason === 'invocation:unverified:unverified_record_unparseable' && keeps401(k2)
      && k3.ok && k3.run.outcome === 'blocked' && k3.run.blockedReason === 'invocation:unverified:not_analyzed' && keeps401(k3), 'C-16. 失敗（401）＋未検証（未知 tool / 解析不能 / 未解析）は block を優先し、失敗の詳細を保持');
    assert(k4.ok && k4.run.blockedReason === 'invocation:termination_unconfirmed' && keeps401(k4) && k5.ok && k5.run.blockedReason === 'invocation:safety:violated' && keeps401(k5), 'C-17. 終了未確認・Safety 違反は失敗＋未検証より優先（詳細は保持）');
    const cap = rs.beginInvocation(researching({ capUsd: 0.02 }), beginIn('researching', 1)).run;
    const capC = rs.completeInvocation(cap, completeIn(1, 'finished', okResult()));
    assert(capC.ok && capC.run.gate === 'human_approval_required' && capC.run.gateReason === 'invocation:budget_cap_reached', 'C-15. 予算上限到達は Human 判断へ');
  }

  caseHeader('R. 再開条件・stage 進行・v1 互換');
  {
    const started = rs.beginInvocation(researching(), beginIn('researching', 1)).run;
    const vr = rs.validateResume(started, SNAP, { now: at(30) });
    assert(vr.result === 'blocked' && has(vr.reasons, 'invocation_started_unfinalized'), 'R-1. started が残る run は自動再開しない');
    assert(!rs.transitionStage(started, 'designing', { now: at(30) }).ok && rs.transitionStage(started, 'designing', { now: at(30) }).error === 'invocation_unfinalized', 'R-2. 未確定 invocation があれば stage を進めない');
    const unc = rs.completeInvocation(started, completeIn(1, 'unconfirmed', okResult([function (x) { x.process.termination = 'exit_event_missing'; x.classification = { outcome: 'failed', reasonCodes: ['timeout'] }; }]))).run;
    assert(rs.validateResume(unc, SNAP, { now: at(30) }).result === 'blocked', 'R-3. unconfirmed（終了未確認）は自動再開しない');
    const done = rs.completeInvocation(started, completeIn(1, 'finished', okResult())).run;
    const same1 = rs.beginInvocation(done, beginIn('researching', 2));
    assert(!same1.ok && same1.error === 'stage_already_invoked:research', 'R-4. 同一 stage の再起動は拒否');
    const next = rs.transitionStage(done, 'designing', { now: at(31) });
    const bd = next.ok ? rs.beginInvocation(next.run, beginIn('designing', 2)) : { ok: false };
    assert(next.ok && bd.ok && bd.run.sessionIds.research === U(201) && bd.run.sessionIds.design === U(202) && bd.run.invocations.length === 2, 'R-5. 正常完了した前 stage の session を持ったまま次 stage へ進み、次 stage を予約できる');
    assert(rs.validateResume(next.run, SNAP, { now: at(32) }).result === 'resumable', 'R-6. 前 stage の session があるだけでは再開を拒否しない');
    const vrDone = rs.validateResume(done, SNAP, { now: at(32) });
    assert(vrDone.result === 'resumable' && rs.beginInvocation(done, beginIn('researching', 2)).error === 'stage_already_invoked:research'
      && rs.transitionStage(done, 'designing', { now: at(33) }).ok, 'R-7. finished 保存済み・遷移前の中断：再開は次 stage 進行のみ可能（同 stage の再起動は拒否）');
    const hg = rs.completeInvocation(started, completeIn(1, 'finished', okResult([function (x) { x.classification = { outcome: 'human_approval_required', reasonCodes: ['stage_requires_human'] }; }]))).run;
    const hgApproved = rs.approveHumanGate(hg, { now: at(34), actor: 'human' }).run;
    assert(hg.gate === 'human_approval_required' && rs.validateResume(hg, SNAP, { now: at(34) }).result === 'human_approval_required'
      && rs.beginInvocation(hgApproved, beginIn('researching', 2)).error === 'stage_already_invoked:research', 'R-7b. human gate を人が承認しても同じ stage は再起動できない');
    const missing = clone(done); missing.invocations = []; missing.budget.invocations = 0; missing.budget.spentUsd = 0;
    const vm = rs.validateResume(missing, SNAP, { now: at(35) });
    assert(vm.result === 'blocked' && has(vm.reasons, 'run_invalid') && vm.reasons.some(function (x) { return x.indexOf('session_without_invocation') === 0; }), 'R-7c. 完了記録の欠落（session だけ残る）は blocked');
    const dupId = rs.beginInvocation(next.run, beginIn('designing', 2, { invocationId: U(101) }));
    const dupSid = rs.beginInvocation(next.run, beginIn('designing', 2, { sessionId: U(201) }));
    assert(dupId.error === 'duplicate_invocation_id' && dupSid.error === 'duplicate_session_id', 'R-8. invocation ID・session の重複を拒否');
    const lim = rs.completeInvocation(rs.beginInvocation(researching({ maxInvocations: 1 }), beginIn('researching', 1)).run, completeIn(1, 'finished', okResult())).run;
    assert(rs.beginInvocation(rs.transitionStage(lim, 'designing', { now: at(31) }).run, beginIn('designing', 2)).error === 'invocation_limit_reached', 'R-9. invocation 上限超過は拒否');
    const unv = rs.completeInvocation(started, completeIn(1, 'finished', okResult([function (x) { x.transcript.verdict = 'unverified_record_unparseable'; }]))).run;
    const vu = rs.validateResume(unv, SNAP, { now: at(32) });
    assert(vu.result === 'blocked' && has(vu.reasons, 'terminal_outcome:blocked'), 'R-10. 未検証 block は終了状態（自動再開・自動の新 run 作成はしない）');
    // v1 記録（read-only 参照のみ）
    const v1 = clone(newRun()); v1.schemaVersion = 1; delete v1.isolation; delete v1.invocations;
    const v1Before = clone(v1);
    const info = rs.inspectRunRecord(v1);
    assert(info.schemaVersion === 1 && info.readable === true && info.executable === false && rs.validateRunStateV1(v1).ok && !rs.validateRunState(v1).ok, 'R-11. v1 は読み取り可能・実行不可として区別');
    assert(rs.validateResume(v1, SNAP, { now: at(32) }).reasons[0] === 'schema_v1_read_only' && !rs.transitionStage(v1, 'researching', { now: at(1) }).ok
      && !rs.beginInvocation(v1, beginIn('researching', 1)).ok && same(v1, v1Before), 'R-12. v1 は再開・遷移・予約しない（自動移行しない・入力不変）');
    const v2info = rs.inspectRunRecord(newRun());
    assert(v2info.schemaVersion === 2 && v2info.executable === true && rs.SCHEMA_VERSION === 2, 'R-13. v2 は実行可能');
  }

  caseHeader('S. schema v2 の明示 allowlist');
  {
    const r = researching();
    const withKey = (f) => { const x = clone(r); f(x); return rs.validateRunState(x); };
    assert(has(withKey(function (x) { x.extraField = 1; }).errors, 'unknown_keys:extraField') && has(withKey(function (x) { delete x.invocations; }).errors, 'missing_keys:invocations'), 'S-1. top-level の未知 key・欠落 key を拒否');
    assert(!withKey(function (x) { x.isolation = { state: 'verified', worktreeHead: null, verifiedAt: null }; }).ok && !withKey(function (x) { x.isolation.extra = 1; }).ok
      && withKey(function (x) { x.isolation = { state: 'verified', worktreeHead: HEAD, verifiedAt: at(1) }; }).ok, 'S-2. isolation は状態と値の組み合わせを検証（データ形のみ・S1 では遷移条件に使わない）');
    const c = rs.completeInvocation(rs.beginInvocation(r, beginIn('researching', 1)).run, completeIn(1, 'finished', okResult())).run;
    const tamper = (f) => { const x = clone(c); f(x); return rs.validateRunState(x); };
    assert(!tamper(function (x) { x.invocations[0].result.token = 'x'; }).ok && !tamper(function (x) { x.invocations[0].launch.exeSha256 = 'a'.repeat(12); }).ok
      && !tamper(function (x) { x.invocations[0].result.disposition = 'success'; }).ok && !tamper(function (x) { x.invocations[0].state = 'running'; }).ok, 'S-3. 保存済み invocation も key・hash 長・enum を検証');
    assert(has(tamper(function (x) { x.budget.spentUsd = 0; }).errors, 'spent_usd_mismatch') && has(tamper(function (x) { x.budget.invocations = 2; }).errors, 'invocation_count_mismatch')
      && has(tamper(function (x) { x.sessionIds.research = U(999); }).errors, 'session_ids_mismatch:research') && has(tamper(function (x) { x.invocations.push(clone(x.invocations[0])); x.budget.invocations = 2; }).errors, 'duplicate_invocation_id'), 'S-4. 費用合計・回数・session と invocation の整合・重複を検証');
    assert(!tamper(function (x) { x.invocations[0].result.dispositionReason = 'x'; }).ok && !tamper(function (x) { x.invocations[0].state = 'unconfirmed'; }).ok, 'S-5. 区分 none の理由・unconfirmed の block 必須を検証');
    assert(rs.validateRunState(c).ok && rs.findSecrets(c).length === 0, 'S-6. 正常な記録は検証を通り、secret 検出にもかからない');
  }

  caseHeader('Z. Protected 10件 hash 不変・sandbox 違反 0・env 不変');
  {
    const after = hashProtected();
    assert(PROTECTED_FILES.every(function (f) { return protectedBefore[f] === PROTECTED_BASELINE[f] && after[f] === PROTECTED_BASELINE[f]; }), 'Z-1. Protected 10件の hash が開始時・終了時とも baseline 一致');
    assert(violations.length === 0, 'Z-2. sandbox 違反 0（network / fs write / child_process / env file）' + (violations.length ? ' ' + violations.join(',') : ''));
    assert(JSON.stringify(Object.keys(process.env).sort().map(function (k) { return [k, process.env[k]]; })) === envSnapshotBefore, 'Z-3. process.env を変更していない');
  }

  console.log('\n────────────────────────────────────────────────────────────');
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exit(1); }
  console.log('🟢 All Development Autopilot Stage 4C S1 (runStore v2) cases passed');
})();
