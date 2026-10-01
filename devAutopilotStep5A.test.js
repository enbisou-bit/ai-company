'use strict';
// devAutopilotStep5A.test.js
// Development Autopilot V1 — Stage 4C S1〜S5（runStore schema v2・所有者 lock・transcriptCheck・claudeExecutor・research 前の隔離）の deterministic テスト。
//
//   ★ 実行は必ずこのファイル名を明示指定する（node devAutopilotStep5A.test.js）。
//   ★ 純関数 test のみ。Claude CLI・API・child_process・Git・network・DB・fs write（OS temp を含む）は冒頭で封鎖する。
//   ★ process.env は変更しない。Protected 10件の hash を開始時・終了時に read-only で取得し、全件一致を assert する。
//   ★ 所有者 lock・保存・executor はメモリ上の偽 fs と差し替え spawn だけで確認する（本物の fs・CLI・推論は使わない）。

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
// S5：research の前に隔離 worktree を確定する
function isolate(run) { return rs.markIsolationVerified(run, { now: at(0), worktreeHead: run.baseHead }).run; }
function researching(budget) { return rs.transitionStage(isolate(newRun(budget)), 'researching', { now: at(1) }).run; }
function launch(extra) {
  return Object.assign({ exeSha256: H64('a'), cliVersion: '2.1.280 (Claude Code)', argvSha256: H64('b'), promptSha256: H64('c'), settingsSha256: H64('d'),
    childVarNames: ['APPDATA', 'COMSPEC', 'DISABLE_UPDATES', 'HOME', 'LOCALAPPDATA', 'PATH', 'PATHEXT', 'SYSTEMDRIVE', 'SYSTEMROOT', 'TEMP', 'TMP', 'USERPROFILE', 'WINDIR'],
    timeoutMs: 300000, maxBuffer: 262144, approvalId: U(990), approvalSha256: H64('9') }, extra || {});
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
    transcript: { verdict: 'ok', toolCounts: { Read: 1, Glob: 0, Grep: 1, StructuredOutput: 0, other: 0 }, unparseable: 0, outside: 0, missingResults: 0, errorResults: 0, structuredOutputComparison: 'not_present' },
    classification: { outcome: 'ok', reasonCodes: [] },
    structuredOutputSha256: H64('e'),
  };
  (over || []).forEach(function (f) { f(r); });
  return r;
}
function completeIn(n, state, result, extra) { return Object.assign({ now: at(20 + n), invocationId: U(100 + n), state: state, result: result, changedPaths: [] }, extra || {}); }
// S5：research 以降は隔離 worktree が存在し、差分分類（classifyResumeDiff の結果）が必要
const SNAP = { baseHeadExists: true, currentHead: HEAD, currentOriginMain: HEAD, worktreeExists: true, branchExists: true, worktreeStatus: 'clean', diffAllowed: true, protectedMd5Matches: true, diffClassification: 'none' };

(async function main() {
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
    const noAp = launch(); delete noAp.approvalId; delete noAp.approvalSha256;
    const onlyId = launch(); delete onlyId.approvalSha256;
    assert([noAp, onlyId, launch({ approvalSha256: 'a'.repeat(12) }), launch({ approvalId: 'appr-1' })].every(function (l) { return rs.beginInvocation(r1, beginIn('researching', 3, { launch: l })).error === 'launch_invalid'; }),
      'B-7. 新しい予約は承認識別（承認 ID・承認内容 SHA-256 全文）が必須（欠落・片方だけ・短い hash・不正 ID は拒否）');
    const legacy = clone(b.run); delete legacy.invocations[0].launch.approvalId; delete legacy.invocations[0].launch.approvalSha256;
    const half = clone(b.run); delete half.invocations[0].launch.approvalSha256;
    assert(rs.validateRunState(legacy).ok && !rs.validateRunState(half).ok && inv.launch.approvalId === U(990) && inv.launch.approvalSha256 === H64('9'),
      'B-8. 拡張前の形の保存済み記録は読み取り時に受け付ける（書き換え・移行しない）・片方だけの記録は拒否');
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
      && withKey(function (x) { x.isolation = { state: 'verified', worktreeHead: HEAD, verifiedAt: at(1) }; }).ok, 'S-2. isolation は状態と値の組み合わせを検証（S5 では research 開始の条件に使う：ST-1c）');
    const c = rs.completeInvocation(rs.beginInvocation(r, beginIn('researching', 1)).run, completeIn(1, 'finished', okResult())).run;
    const tamper = (f) => { const x = clone(c); f(x); return rs.validateRunState(x); };
    assert(!tamper(function (x) { x.invocations[0].result.token = 'x'; }).ok && !tamper(function (x) { x.invocations[0].launch.exeSha256 = 'a'.repeat(12); }).ok
      && !tamper(function (x) { x.invocations[0].result.disposition = 'success'; }).ok && !tamper(function (x) { x.invocations[0].state = 'running'; }).ok, 'S-3. 保存済み invocation も key・hash 長・enum を検証');
    assert(has(tamper(function (x) { x.budget.spentUsd = 0; }).errors, 'spent_usd_mismatch') && has(tamper(function (x) { x.budget.invocations = 2; }).errors, 'invocation_count_mismatch')
      && has(tamper(function (x) { x.sessionIds.research = U(999); }).errors, 'session_ids_mismatch:research') && has(tamper(function (x) { x.invocations.push(clone(x.invocations[0])); x.budget.invocations = 2; }).errors, 'duplicate_invocation_id'), 'S-4. 費用合計・回数・session と invocation の整合・重複を検証');
    assert(!tamper(function (x) { x.invocations[0].result.dispositionReason = 'x'; }).ok && !tamper(function (x) { x.invocations[0].state = 'unconfirmed'; }).ok, 'S-5. 区分 none の理由・unconfirmed の block 必須を検証');
    assert(rs.validateRunState(c).ok && rs.findSecrets(c).length === 0, 'S-6. 正常な記録は検証を通り、secret 検出にもかからない');
  }

  // ── S2：所有者 lock・所有者としての保存・競合を防ぐ run 作成（メモリ上の偽 fs。本物の fs には書かない）──
  function memFs() {
    const files = new Map(), dirs = new Set(), fds = new Map(); let fdSeq = 100;
    const norm = (p) => path.win32.resolve(String(p)).toLowerCase();
    const err = (code) => { const e = new Error(code); e.code = code; return e; };
    const api = { fail: {}, before: {} };
    const hit = (op, n) => typeof api.fail[op] === 'function' && api.fail[op](n);
    // 別プロセスの割り込みを再現するため、指定操作の直前に 1 回だけ任意処理を差し込む
    const pre = (op, n, flags) => { const f = api.before[op]; if (f && f.match.test(n)) { api.before[op] = null; f.run(n, flags); } };
    api.mkdirSync = function (p) { let n = norm(p); while (!dirs.has(n) && path.win32.dirname(n) !== n) { dirs.add(n); n = path.win32.dirname(n); } };
    api.statSync = function (p) { const n = norm(p); if (files.has(n) || dirs.has(n)) return {}; throw err('ENOENT'); };
    api.readdirSync = function (p) {
      const n = norm(p); if (hit('readdirSync', n)) throw err('EIO'); if (!dirs.has(n)) throw err('ENOENT');
      const out = new Set(); files.forEach(function (v, k) { if (path.win32.dirname(k) === n) out.add(path.win32.basename(k)); });
      dirs.forEach(function (d) { if (d !== n && path.win32.dirname(d) === n) out.add(path.win32.basename(d)); }); return Array.from(out).sort();
    };
    api.openSync = function (p, flags) {
      const n = norm(p); pre('openSync', n, flags); if (hit('openSync', n)) throw err('EIO'); if (!dirs.has(path.win32.dirname(n))) throw err('ENOENT');
      if (flags === 'wx') { if (files.has(n)) throw err('EEXIST'); files.set(n, ''); } else if (!files.has(n)) throw err('ENOENT');
      const fd = fdSeq++; fds.set(fd, n); return fd;
    };
    api.writeSync = function (fd, data) { const n = fds.get(fd); if (hit('writeSync', n)) throw err('EIO'); files.set(n, files.get(n) + String(data)); };
    api.fsyncSync = function () {}; api.closeSync = function (fd) { fds.delete(fd); };
    api.renameSync = function (a, b) { const na = norm(a), nb = norm(b); pre('renameSync', nb); if (hit('renameSync', nb)) throw err('EIO'); if (!files.has(na)) throw err('ENOENT'); files.set(nb, files.get(na)); files.delete(na); };
    api.unlinkSync = function (p) { const n = norm(p); pre('unlinkSync', n); if (hit('unlinkSync', n)) throw err('EIO'); if (!files.delete(n)) throw err('ENOENT'); };
    api.readFileSync = function (p) { const n = norm(p); if (hit('readFileSync', n)) throw err('EIO'); if (!files.has(n)) throw err('ENOENT'); return files.get(n); };
    api.put = function (p, c) { api.mkdirSync(path.win32.dirname(p)); files.set(norm(p), c); };
    api.get = function (p) { return files.get(norm(p)); };
    api.has = function (p) { return files.has(norm(p)); };
    api.list = function (p) { try { return api.readdirSync(p); } catch (e) { return ['<' + e.code + '>']; } };
    return api;
  }
  const RT = 'C:\\enbisou-s2-fake\\runtime', REPO = 'C:\\Users\\hp\\ENBISOU_AI\\ai-company';
  const A = U(501), B = U(502);
  function storeWith(mf) { return { runtimeRoot: RT, repoPath: REPO, fs: mf }; }
  function runFor(taskId, extra) {
    const init = rs.createInitialRun(Object.assign({ taskId: taskId, task: { title: 't', goal: 'g', allowedPaths: ['tools/'], forbiddenPaths: [] }, mainRepoPath: REPO, baseHead: HEAD,
      branch: 'dev/' + taskId, worktreePath: 'C:\\Users\\hp\\ENBISOU_AI\\.autopilot\\wt\\' + taskId, budget: { capUsd: 5, maxInvocations: 6 },
      mainStatusHashAtStart: '8226124a93f0', protectedMd5AtStart: Object.assign({}, PROTECTED_BASELINE), now: at(0) }, extra || {}));
    return rs.transitionStage(isolate(init.run), 'researching', { now: at(1) }).run;
  }
  const dirOf = (taskId) => RT + '\\runs\\' + taskId;

  caseHeader('O. 所有者 lock（owner.lock の排他作成・奪取しない）');
  {
    const mf = memFs(), st = storeWith(mf);
    assert(rs.createRun(st, runFor('task-s2-001')).ok, 'O-0. 偽 fs 上に run を作成');
    const a1 = rs.acquireOwnership(st, 'task-s2-001', { ownerId: A, pid: 11, now: at(2) });
    const ol = rs.readOwnerLock(st, 'task-s2-001');
    assert(a1.ok && a1.revision === 1 && a1.run.lock.ownerId === A && ol.ok && ol.exists && ol.ownerId === A && ol.pid === 11, 'O-1. owner.lock を排他作成し、run.json の lock に ownerId を記録（revision +1）');
    const before = mf.get(dirOf('task-s2-001') + '\\run.json');
    const b1 = rs.acquireOwnership(st, 'task-s2-001', { ownerId: B, pid: 22, now: at(3) });
    assert(!b1.ok && (b1.error === 'owner_lock_exists' || b1.error === 'run_lock_present') && mf.get(dirOf('task-s2-001') + '\\run.json') === before && rs.readOwnerLock(st, 'task-s2-001').ownerId === A, 'O-2. 二重取得は拒否（既存 lock を奪取・削除しない）');
    const mf2 = memFs(), st2 = storeWith(mf2);
    rs.createRun(st2, runFor('task-s2-002'));
    mf2.put(dirOf('task-s2-002') + '\\owner.lock', JSON.stringify({ kind: 'owner', taskId: 'task-s2-002', ownerId: B, pid: 22, acquiredAt: at(1) }));
    assert(rs.acquireOwnership(st2, 'task-s2-002', { ownerId: A, pid: 11, now: at(2) }).error === 'owner_lock_exists' && rs.readOwnerLock(st2, 'task-s2-002').ownerId === B, 'O-3. 他者の owner.lock（run.json 側に記録が無くても）は奪取しない');
    const mf3 = memFs(), st3 = storeWith(mf3);
    rs.createRun(st3, runFor('task-s2-003'));
    const failed = rs.failRun(rs.readRun(st3, 'task-s2-003').run, 'x', { now: at(2) }).run;
    rs.saveRun(st3, failed, { expectedUpdatedAt: rs.readRun(st3, 'task-s2-003').run.updatedAt });
    assert(rs.acquireOwnership(st3, 'task-s2-003', { ownerId: A, pid: 11, now: at(3) }).error === 'terminal_outcome:failed' && !mf3.has(dirOf('task-s2-003') + '\\owner.lock'), 'O-4. 事前確認で拒否できる場合は lock を作らない');
    const mf4 = memFs(), st4 = storeWith(mf4);
    rs.createRun(st4, runFor('task-s2-004'));
    mf4.fail.renameSync = (n) => /run\.json$/.test(n);
    const inc = rs.acquireOwnership(st4, 'task-s2-004', { ownerId: A, pid: 11, now: at(2) });
    mf4.fail = {};
    assert(inc.error === 'acquire_incomplete' && mf4.has(dirOf('task-s2-004') + '\\owner.lock') && rs.readRun(st4, 'task-s2-004').run.lock === null
      && rs.acquireOwnership(st4, 'task-s2-004', { ownerId: A, pid: 11, now: at(3) }).error === 'owner_lock_exists', 'O-5. owner.lock 作成後の途中失敗は lock を残して安全側に停止（自動解除しない）');
    const mf5 = memFs(), st5 = storeWith(mf5);
    rs.createRun(st5, runFor('task-s2-005'));
    mf5.fail.writeSync = (n) => /owner\.lock$/.test(n);
    const wf = rs.acquireOwnership(st5, 'task-s2-005', { ownerId: A, pid: 11, now: at(2) });
    mf5.fail = {};
    assert(wf.error === 'owner_lock_lock_write_failed' && mf5.has(dirOf('task-s2-005') + '\\owner.lock') && rs.readOwnerLock(st5, 'task-s2-005').error === 'lock_invalid'
      && rs.acquireOwnership(st5, 'task-s2-005', { ownerId: A, pid: 11, now: at(3) }).error === 'owner_lock_exists', 'O-6. 書込み途中の不正な lock は残り、以後の取得を止める');
    assert(rs.acquireOwnership(st, 'task-s2-001', { ownerId: 'x', pid: 11, now: at(2) }).error === 'opts_invalid' && rs.acquireOwnership(st, 'task-s2-001', { ownerId: A, pid: 0, now: at(2) }).error === 'opts_invalid', 'O-7. 不正な ownerId / pid は拒否');
  }

  caseHeader('W. 所有者としての保存（直列化・古い状態で上書きしない・失敗時に壊さない）');
  {
    const mf = memFs(), st = storeWith(mf), T = 'task-s2-010', RF = dirOf(T) + '\\run.json';
    rs.createRun(st, runFor(T));
    const a = rs.acquireOwnership(st, T, { ownerId: A, pid: 11, now: at(2) }).run;
    const hb = rs.heartbeatLock(a, { now: at(3), pid: 11, ownerId: A }).run;
    const s1 = rs.saveRunAsOwner(st, hb, { ownerId: A, expectedRevision: 1, now: at(3) });
    assert(s1.ok && s1.revision === 2 && rs.readRun(st, T).run.lock.heartbeatAt === at(3), 'W-1. heartbeat を所有者として保存（revision +1）');
    const bg = rs.beginInvocation(s1.run, { now: at(4), invocationId: U(601), sessionId: U(602), stage: 'researching', launch: launch() }).run;
    const s2 = rs.saveRunAsOwner(st, bg, { ownerId: A, expectedRevision: 2, now: at(4) });
    // 同じ保存済み状態（revision 3）から heartbeat と完了を別々に導出し、同一時刻で保存を競合させる
    const hb2 = rs.heartbeatLock(s2.run, { now: at(5), pid: 11, ownerId: A }).run;
    const cp1 = rs.completeInvocation(rs.heartbeatLock(s2.run, { now: at(5), pid: 11, ownerId: A }).run, { now: at(5), invocationId: U(601), state: 'finished', result: okResult(), changedPaths: [] }).run;
    const sc = rs.saveRunAsOwner(st, cp1, { ownerId: A, expectedRevision: 3, now: at(5) });
    const sh = rs.saveRunAsOwner(st, hb2, { ownerId: A, expectedRevision: 3, now: at(5) });
    const stored = rs.readRun(st, T).run;
    assert(s2.ok && sc.ok && sh.error === 'stale_write' && stored.revision === 4 && stored.invocations[0].state === 'finished' && stored.budget.spentUsd === 0.02
      && hb2.updatedAt === cp1.updatedAt, 'W-2. 同一時刻の heartbeat と完了の競合：revision で識別し、古い状態からの heartbeat は拒否（完了を上書きしない）');
    const cur = rs.readRun(st, T).run, raw = mf.get(RF);
    mf.fail.renameSync = (n) => /run\.json$/.test(n);
    const f1 = rs.saveRunAsOwner(st, rs.heartbeatLock(cur, { now: at(6), pid: 11, ownerId: A }).run, { ownerId: A, expectedRevision: 4, now: at(6) });
    mf.fail = {};
    const leftovers = mf.list(dirOf(T)).filter((x) => x !== 'run.json' && x !== 'owner.lock');
    assert(f1.error === 'atomic_write_failed' && mf.get(RF) === raw && leftovers.length === 0
      && rs.saveRunAsOwner(st, rs.heartbeatLock(cur, { now: at(6), pid: 11, ownerId: A }).run, { ownerId: A, expectedRevision: 4, now: at(6) }).ok, 'W-3. 保存失敗時は既存 run.json を壊さず、mutex・tmp を残さない（再保存は可能）');
    const c5 = rs.readRun(st, T).run, raw5 = mf.get(RF);
    const exp = rs.saveRunAsOwner(st, rs.heartbeatLock(c5, { now: at(6 + 700), pid: 11, ownerId: A }).run, { ownerId: A, expectedRevision: 5, now: at(6 + 700) });
    assert(exp.error === 'lock_expired' && mf.get(RF) === raw5, 'W-4. lock 期限切れ（heartbeat 途絶）では保存しない');
    mf.put(dirOf(T) + '\\owner.lock', JSON.stringify({ kind: 'owner', taskId: T, ownerId: B, pid: 22, acquiredAt: at(7) }));
    const old = rs.saveRunAsOwner(st, rs.heartbeatLock(c5, { now: at(8), pid: 11, ownerId: A }).run, { ownerId: A, expectedRevision: 5, now: at(8) });
    assert(old.error === 'not_owner' && mf.get(RF) === raw5, 'W-5. owner.lock が別所有者に替わった後の古い所有者の保存は拒否');
    mf.put(dirOf(T) + '\\owner.lock', JSON.stringify({ kind: 'owner', taskId: T, ownerId: A, pid: 11, acquiredAt: at(2) }));
    mf.put(dirOf(T) + '\\write.lock', '{"kind":"mutex","token":"other"}');
    const busy = rs.saveRunAsOwner(st, rs.heartbeatLock(c5, { now: at(8), pid: 11, ownerId: A }).run, { ownerId: A, expectedRevision: 5, now: at(8) });
    assert(busy.error === 'mutex_busy' && mf.has(dirOf(T) + '\\write.lock') && mf.get(RF) === raw5, 'W-6. 他の書込み中（write.lock あり）は待たずに拒否し、他者の mutex を消さない');
    mf.unlinkSync(dirOf(T) + '\\write.lock');
    const noLock = clone(rs.heartbeatLock(c5, { now: at(8), pid: 11, ownerId: A }).run); noLock.lock = null;
    const idc = clone(rs.heartbeatLock(c5, { now: at(8), pid: 11, ownerId: A }).run); idc.baseHead = '1'.repeat(40);
    assert(rs.saveRunAsOwner(st, noLock, { ownerId: A, expectedRevision: 5, now: at(8) }).error === 'next_lock_not_owned'
      && rs.saveRunAsOwner(st, idc, { ownerId: A, expectedRevision: 5, now: at(8) }).error === 'identity_changed'
      && rs.saveRunAsOwner(st, rs.heartbeatLock(c5, { now: at(8), pid: 11, ownerId: A }).run, { ownerId: B, expectedRevision: 5, now: at(8) }).error === 'not_owner', 'W-7. 次状態の lock 欠落・識別項目の変更・他者名義の保存は拒否');
    const legacyLocked = rs.saveRun(st, c5, { expectedUpdatedAt: c5.updatedAt });
    const unlockedCopy = clone(c5); unlockedCopy.lock = null;
    const legacyOwnerFile = rs.saveRun(st, unlockedCopy, { expectedUpdatedAt: c5.updatedAt });
    assert(legacyLocked.error === 'owner_managed_use_saveRunAsOwner' && legacyOwnerFile.error === 'owner_managed_use_saveRunAsOwner' && mf.get(RF) === raw5, 'W-8. 従来の saveRun では所有者管理下の run を書けない（迂回経路なし）');
  }

  caseHeader('L. 解放（自分の lock を正常条件でのみ）');
  {
    const mf = memFs(), st = storeWith(mf), T = 'task-s2-020', OL = dirOf(T) + '\\owner.lock';
    rs.createRun(st, runFor(T));
    const a = rs.acquireOwnership(st, T, { ownerId: A, pid: 11, now: at(2) }).run;
    const bg = rs.saveRunAsOwner(st, rs.beginInvocation(a, { now: at(3), invocationId: U(701), sessionId: U(702), stage: 'researching', launch: launch() }).run, { ownerId: A, expectedRevision: 1, now: at(3) }).run;
    assert(rs.releaseOwnership(st, T, { ownerId: B, expectedRevision: 2, now: at(4) }).error === 'not_owner' && mf.has(OL), 'L-1. 他所有者の解放は拒否');
    assert(rs.releaseOwnership(st, T, { ownerId: A, expectedRevision: 2, now: at(4) }).error === 'release_refused_unfinalized' && mf.has(OL), 'L-2. started（結果未保存）の間は自動解放しない');
    const unc = rs.completeInvocation(bg, { now: at(5), invocationId: U(701), state: 'unconfirmed', result: okResult([function (x) { x.process.termination = 'exit_event_missing'; x.classification = { outcome: 'failed', reasonCodes: ['timeout'] }; }]), changedPaths: [] }).run;
    const su = rs.saveRunAsOwner(st, unc, { ownerId: A, expectedRevision: 2, now: at(5) });
    assert(su.ok && rs.releaseOwnership(st, T, { ownerId: A, expectedRevision: 3, now: at(6) }).error === 'release_refused_unfinalized' && mf.has(OL), 'L-3. 終了未確認（unconfirmed）は自動解放しない');
    const mf2 = memFs(), st2 = storeWith(mf2), T2 = 'task-s2-021', OL2 = dirOf(T2) + '\\owner.lock';
    rs.createRun(st2, runFor(T2));
    rs.acquireOwnership(st2, T2, { ownerId: A, pid: 11, now: at(2) });
    assert(rs.releaseOwnership(st2, T2, { ownerId: A, expectedRevision: 1, now: at(2 + 700) }).error === 'lock_expired_requires_human' && mf2.has(OL2), 'L-4. 期限切れ（所有権を失った可能性）では自動解放しない');
    const bg2 = rs.saveRunAsOwner(st2, rs.beginInvocation(rs.readRun(st2, T2).run, { now: at(3), invocationId: U(711), sessionId: U(712), stage: 'researching', launch: launch() }).run, { ownerId: A, expectedRevision: 1, now: at(3) }).run;
    const fin = rs.saveRunAsOwner(st2, rs.completeInvocation(bg2, { now: at(4), invocationId: U(711), state: 'finished', result: okResult(), changedPaths: [] }).run, { ownerId: A, expectedRevision: 2, now: at(4) });
    assert(rs.releaseOwnership(st2, T2, { ownerId: A, expectedRevision: 2, now: at(5) }).error === 'stale_write', 'L-5. 古い revision での解放は拒否');
    const rel = rs.releaseOwnership(st2, T2, { ownerId: A, expectedRevision: 3, now: at(5) });
    assert(fin.ok && rel.ok && !mf2.has(OL2) && rs.readRun(st2, T2).run.lock === null && rs.readRun(st2, T2).run.revision === 4
      && mf2.list(dirOf(T2)).join(',') === 'run.json', 'L-6. 正常完了後は自分の lock だけを解放（owner.lock 削除・run.json の lock なし・残骸なし）');
    const mf3 = memFs(), st3 = storeWith(mf3), T3 = 'task-s2-022';
    rs.createRun(st3, runFor(T3));
    rs.acquireOwnership(st3, T3, { ownerId: A, pid: 11, now: at(2) });
    mf3.fail.unlinkSync = (n) => /owner\.lock$/.test(n);
    const ru = rs.releaseOwnership(st3, T3, { ownerId: A, expectedRevision: 1, now: at(3) });
    mf3.fail = {};
    assert(ru.error === 'owner_lock_unlink_failed' && ru.runReleased === true && mf3.has(dirOf(T3) + '\\owner.lock')
      && rs.acquireOwnership(st3, T3, { ownerId: B, pid: 22, now: at(4) }).error === 'owner_lock_exists', 'L-7. owner.lock の削除に失敗したら報告し、以後の取得は止まる（安全側）');
  }

  caseHeader('X. プロセス間の割り込み（事前確認 → 他者の saveRun → owner.lock 取得 など）');
  {
    // A の事前確認の後・owner.lock 作成の直前に、B（別プロセス）が従来の saveRun で run.json を更新する
    function interleave(T, bUpdate) {
      const mf = memFs(), st = storeWith(mf); let bRes = null;
      rs.createRun(st, runFor(T));
      mf.before.openSync = { match: /owner\.lock$/, run: function () { const cur = rs.readRun(st, T).run; bRes = rs.saveRun(st, bUpdate(cur), { expectedUpdatedAt: cur.updatedAt }); } };
      const a = rs.acquireOwnership(st, T, { ownerId: A, pid: 11, now: at(4) });
      return { a: a, b: bRes, stored: rs.readRun(st, T).run, mf: mf, st: st };
    }
    const x1 = interleave('task-s2-080', (cur) => rs.requireHumanApproval(cur, 'b-update', { now: at(3) }).run);
    assert(x1.b.ok && x1.a.error === 'acquire_incomplete' && x1.a.cause === 'state_changed_during_acquire' && x1.stored.revision === 1
      && x1.stored.gate === 'human_approval_required' && x1.stored.lock === null, 'X-1. 事前確認後の他者更新（revision 変化）は上書きせず、古い前提で取得しない');
    const x2 = interleave('task-s2-081', (cur) => rs.failRun(cur, 'b-failed', { now: at(3) }).run);
    assert(x2.b.ok && x2.a.cause === 'terminal_outcome:failed' && x2.stored.outcome === 'failed' && x2.stored.lock === null && x2.stored.revision === 1, 'X-2. 取得前に終了状態へ変わっていれば、最新状態に基づいて拒否');
    const x3 = interleave('task-s2-082', (cur) => rs.beginInvocation(cur, { now: at(3), invocationId: U(901), sessionId: U(902), stage: 'researching', launch: launch() }).run);
    assert(x3.b.ok && x3.a.cause === 'invocation_unfinalized' && x3.stored.invocations[0].state === 'started' && x3.stored.lock === null && x3.stored.revision === 1, 'X-3. 取得前に started へ変わっていれば、最新状態に基づいて拒否（B の記録を保持）');
    assert(x1.mf.has(dirOf('task-s2-080') + '\\owner.lock') && rs.saveRun(x1.st, x1.stored, { expectedUpdatedAt: x1.stored.updatedAt }).error === 'owner_managed_use_saveRunAsOwner', 'X-4. 取得に失敗しても作成済みの owner.lock は残し（安全側）、以後の saveRun も止まる');
    // A が write.lock の内側で run.json を書く直前に、B が saveRun を試みる → B は mutex_busy（A の write.lock を消さない）
    const mf5 = memFs(), st5 = storeWith(mf5), T5 = 'task-s2-083'; let b5 = null;
    rs.createRun(st5, runFor(T5));
    mf5.before.renameSync = { match: /run\.json$/, run: function () { const cur = rs.readRun(st5, T5).run; b5 = rs.saveRun(st5, rs.failRun(cur, 'b', { now: at(3) }).run, { expectedUpdatedAt: cur.updatedAt }); } };
    const a5 = rs.acquireOwnership(st5, T5, { ownerId: A, pid: 11, now: at(4) });
    const s5 = rs.readRun(st5, T5).run;
    assert(b5.error === 'mutex_busy' && a5.ok && s5.lock.ownerId === A && s5.outcome === null && s5.revision === 1 && mf5.list(dirOf(T5)).indexOf('write.lock') === -1, 'X-5. A の書込み中の B の saveRun は write.lock で拒否され、A の mutex を消さない');
    // releaseOwnership：run.json 保存後・owner.lock 削除前に他者の lock へ替わった場合は消さない
    const mf6 = memFs(), st6 = storeWith(mf6), T6 = 'task-s2-084';
    rs.createRun(st6, runFor(T6));
    rs.acquireOwnership(st6, T6, { ownerId: A, pid: 11, now: at(2) });
    const bLock = JSON.stringify({ kind: 'owner', taskId: T6, ownerId: B, pid: 22, acquiredAt: at(3) });
    mf6.before.unlinkSync = { match: /write\.lock$/, run: function () { mf6.put(dirOf(T6) + '\\owner.lock', bLock); } };
    const r6 = rs.releaseOwnership(st6, T6, { ownerId: A, expectedRevision: 1, now: at(3) });
    assert(r6.error === 'owner_lock_changed_before_unlink' && r6.runReleased === true && mf6.get(dirOf(T6) + '\\owner.lock') === bLock, 'X-6. 解放時に owner.lock が他者のものへ替わっていれば削除しない');
  }

  caseHeader('K. 競合を防ぐ run 作成（確認と作成を共通の排他範囲で）');
  {
    const mf = memFs(), st = storeWith(mf);
    assert(rs.createRun(st, runFor('task-s2-030')).ok, 'K-0. 1 件目の run を作成');
    const k1 = rs.createRun(st, runFor('task-s2-031'));
    assert(!k1.ok && k1.error === 'create_conflict' && has(k1.conflicts, 'active_run_same_repo:task-s2-030') && !mf.has(dirOf('task-s2-031') + '\\run.json'), 'K-1. 同 repo の非終了 run があれば新 run を作らない');
    rs.acquireOwnership(st, 'task-s2-030', { ownerId: A, pid: 11, now: at(2) });
    const k2 = rs.createRun(st, runFor('task-s2-032', { mainRepoPath: 'C:\\other\\repo' }));
    assert(!k2.ok && has(k2.conflicts, 'owner_lock_present:task-s2-030') && has(k2.conflicts, 'lock_present:task-s2-030'), 'K-2. 他 run の owner.lock / lock が残っていれば作らない（別 repo でも）');
    const mf2 = memFs(), st2 = storeWith(mf2);
    rs.createRun(st2, runFor('task-s2-040', { mainRepoPath: 'C:\\other\\repo' }));
    const bgOther = rs.beginInvocation(rs.readRun(st2, 'task-s2-040').run, { now: at(3), invocationId: U(801), sessionId: U(802), stage: 'researching', launch: launch() }).run;
    rs.saveRun(st2, rs.failRun(rs.readRun(st2, 'task-s2-040').run, 'x', { now: at(2) }).run, { expectedUpdatedAt: rs.readRun(st2, 'task-s2-040').run.updatedAt });
    mf2.put(dirOf('task-s2-041') + '\\run.json', JSON.stringify(bgOther).replace('task-s2-040', 'task-s2-041').replace('dev/task-s2-040', 'dev/task-s2-041'));
    mf2.put(dirOf('task-s2-042') + '\\run.json', '{ broken');
    mf2.mkdirSync(dirOf('task-s2-043'));
    mf2.mkdirSync(RT + '\\runs\\..weird');
    const k3 = rs.createRun(st2, runFor('task-s2-044'));
    assert(!k3.ok && has(k3.conflicts, 'unfinalized_invocation:task-s2-041') && has(k3.conflicts, 'run_record_unreadable:task-s2-042')
      && has(k3.conflicts, 'run_record_missing:task-s2-043') && !has(k3.conflicts, 'active_run_same_repo:task-s2-040'), 'K-3. 未確定 invocation・読取不能・記録欠落は「競合なし」と扱わない（終了済み run は競合にしない）');
    const mf3 = memFs(), st3 = storeWith(mf3);
    mf3.mkdirSync(RT);
    mf3.put(RT + '\\.create.lock', '{"kind":"mutex","token":"other"}');
    const k4 = rs.createRun(st3, runFor('task-s2-050'));
    assert(k4.error === 'mutex_busy' && mf3.has(RT + '\\.create.lock') && !mf3.has(dirOf('task-s2-050') + '\\run.json'), 'K-4. 他の作成処理の排他中（.create.lock あり）は作らず、他者の mutex を消さない');
    const mf4 = memFs(), st4 = storeWith(mf4);
    rs.createRun(st4, runFor('task-s2-060', { mainRepoPath: 'C:\\other\\repo' }));
    mf4.fail.readdirSync = (n) => /\\runs$/.test(n);
    const k5 = rs.createRun(st4, runFor('task-s2-061'));
    mf4.fail = {};
    assert(!k5.ok && has(k5.conflicts, 'runs_dir_unreadable') && mf4.list(RT).indexOf('.create.lock') === -1, 'K-5. 走査できない場合は作らない（mutex は残さない）');
    const mf5 = memFs(), st5 = storeWith(mf5);
    const v1 = clone(runFor('task-s2-070')); v1.schemaVersion = 1; delete v1.isolation; delete v1.invocations; delete v1.revision;
    mf5.put(dirOf('task-s2-070') + '\\run.json', JSON.stringify(v1));
    const k6 = rs.createRun(st5, runFor('task-s2-071'));
    mf5.put(dirOf('task-s2-070') + '\\owner.lock', JSON.stringify({ kind: 'owner', taskId: 'task-s2-070', ownerId: A, pid: 11, acquiredAt: at(1) }));
    assert(!k6.ok && has(k6.conflicts, 'active_run_same_repo:task-s2-070') && rs.acquireOwnership(st5, 'task-s2-070', { ownerId: A, pid: 11, now: at(2) }).error === 'run_read_only_v1'
      && rs.saveRunAsOwner(st5, runFor('task-s2-070'), { ownerId: A, expectedRevision: 0, now: at(2) }).error === 'run_read_only_v1', 'K-6. v1 の非終了 run も競合として扱い、v1 は所有者経路でも書かない');
    assert(rs.createRun(st, runFor('task-s2-030')).error === 'run_exists', 'K-7. 同じ taskId は run_exists（既存を上書きしない）');
  }

  // ── S3：transcriptCheck（純関数）──
  const tcm = require('./tools/devAutopilot/transcriptCheck');
  const WTR = 'C:\\Users\\hp\\ENBISOU_AI\\.autopilot\\wt\\task-s4-001';
  const SID = U(3001);
  function tline(sid, content, extra) { return JSON.stringify(Object.assign({ type: 'assistant', sessionId: sid, message: { content: content } }, extra || {})); }
  function use(id, name, input) { return { type: 'tool_use', id: id, name: name, input: input }; }
  function res(id, isError) { return { type: 'tool_result', tool_use_id: id, is_error: !!isError, content: 'r' }; }
  function tx(sid, pairs, extraLines) { return pairs.map(function (p) { return tline(sid, [p[0]]) + '\n' + (p[1] ? tline(sid, [p[1]]) : ''); }).concat(extraLines || []).join('\n'); }
  const R3 = ['Read', 'Glob', 'Grep'];
  caseHeader('T. transcriptCheck（対応づけ・境界・欠落・未知 tool）');
  {
    const A_ = (text, extra) => tcm.analyzeTranscript(text, Object.assign({ sessionId: SID, worktreeRoot: WTR, allowedTools: R3 }, extra || {}));
    const okText = tx(SID, [[use('t1', 'Grep', { pattern: 'verification-token' }), res('t1')], [use('t2', 'Read', { file_path: 'docs/notes.md' }), res('t2')],
      [use('t3', 'Glob', { pattern: '**/*.md', path: WTR }), res('t3')], [use('t4', 'Read', { file_path: '/c/Users/hp/ENBISOU_AI/.autopilot/wt/task-s4-001/README.md' }), res('t4')]]);
    const ok = A_(okText, { expected: { grep: true, reads: ['docs/notes.md'] } });
    assert(ok.ok && ok.summary.verdict === 'ok' && ok.summary.toolCounts.Read === 2 && ok.summary.toolCounts.Grep === 1 && ok.structuredOutputCount === 0
      && JSON.stringify(ok).indexOf('verification-token') === -1 && JSON.stringify(ok).indexOf('notes.md') === -1, 'T-1. 内側の Read/Glob/Grep は ok（本文・path を返さない）');
    const outs = [use('o1', 'Read', { file_path: 'C:\\Users\\hp\\secret.txt' }), use('o2', 'Glob', { pattern: 'C:/Users/**/*.txt' }), use('o3', 'Grep', { pattern: 'x', path: 'C:\\Windows' }), use('o4', 'Read', { file_path: '../../x.txt' })];
    assert(outs.every(function (u) { return A_(tx(SID, [[u, res(u.id)]])).summary.verdict === 'outside_reference_observed'; }), 'T-2. 外側の Read / 絶対 Glob / Grep path / .. 脱出は outside_reference_observed');
    const unp = [use('u1', 'Read', { file_path: 'docs/*.md' }), use('u2', 'Read', {}), use('u3', 'Glob', { pattern: '../**' }), use('u4', 'Read', { file_path: '\\\\srv\\share\\x' })];
    assert(unp.every(function (u) { return A_(tx(SID, [[u, res(u.id)]])).summary.verdict === 'unverified_record_unparseable'; }), 'T-3. 判定不能な path（ワイルドカード・欠落・.. パターン・UNC）は未検証');
    const so = { stage: 'research', status: 'ok' };
    const soA = A_(tx(SID, [[use('s1', 'StructuredOutput', so), res('s1')]]));
    assert(soA.summary.verdict === 'unverified_unknown_tool' && soA.summary.toolCounts.StructuredOutput === 1 && soA.structuredOutputInputSha256 === tcm.canonicalSha256({ status: 'ok', stage: 'research' })
      && tcm.compareStructuredOutput(soA.structuredOutputInputSha256, tcm.canonicalSha256(so), 1) === 'match' && tcm.compareStructuredOutput(soA.structuredOutputInputSha256, H64('0'), 1) === 'mismatch'
      && tcm.compareStructuredOutput(null, null, 0) === 'not_present' && tcm.compareStructuredOutput('a', 'a', 2) === 'not_comparable', 'T-4. StructuredOutput は照合材料（正規化 hash）を抽出しても未検証のまま・比較は完全一致の確認だけ');
    assert(A_(tx(SID, [[use('b1', 'Bash', { command: 'ls' }), res('b1')]])).summary.verdict === 'unverified_unknown_tool'
      && A_(tx(SID, [[use('e1', 'Edit', { file_path: 'docs/notes.md' }), res('e1')]])).summary.verdict === 'unverified_unknown_tool'
      && A_(tx(SID, [[use('e1', 'Edit', { file_path: 'docs/notes.md' }), res('e1')]]), { allowedTools: ['Read', 'Glob', 'Grep', 'Edit', 'Write'] }).summary.verdict === 'ok', 'T-5. stage の tool 制限：research で Edit / Bash は未検証・implement の内側 Edit は ok');
    assert(A_(tx(SID, [[use('m1', 'Read', { file_path: 'a.md' }), null]])).summary.verdict === 'unverified_record_unparseable'
      && A_(tx(SID, [[use('m1', 'Read', { file_path: 'a.md' }), res('m1')]], [tline(SID, [res('zz')])])).summary.verdict === 'unverified_record_unparseable'
      && A_(okText + '\n{ broken').summary.verdict === 'unverified_record_unparseable'
      && A_(tx(SID, [[use('m1', 'Read', { file_path: 'a.md' }), res('m1')]], [tline(SID, [], { isSidechain: true })])).summary.verdict === 'unverified_record_unparseable'
      && A_(tx(SID, [[use('m1', 'Read', { file_path: 'a.md' }), res('m1')]], [tline(U(3999), [])])).summary.verdict === 'unverified_record_unparseable'
      && A_(tx(U(3999), [[use('m1', 'Read', { file_path: 'a.md' }), res('m1')]])).summary.verdict === 'unverified_record_unparseable'
      && A_(null).summary.verdict === 'unverified_record_unparseable', 'T-6. 結果欠落・対応の無い結果・解析不能行・sidechain・他 session・transcript 欠落は未検証');
    assert(A_(tx(SID, [[use('r1', 'Read', { file_path: 'a.md' }), res('r1', true)]])).summary.verdict === 'unverified_tool_error'
      && A_(tx(SID, [[use('r1', 'Read', { file_path: 'a.md' }), res('r1')]]), { expected: { reads: ['docs/notes.md'] } }).summary.verdict === 'unverified_expected_calls_missing', 'T-7. tool エラー・期待した呼び出しの欠落は未検証');
    assert(tcm.canonicalJson({ b: 1, a: [2, { d: 1, c: 2 }] }) === tcm.canonicalJson({ a: [2, { c: 2, d: 1 }], b: 1 }) && !A_('x', { sessionId: 'bad' }).ok, 'T-8. 正規化 JSON は key 順に依存しない・不正な入力は拒否');
    const dupRes = tx(SID, [[use('d1', 'Read', { file_path: 'a.md' }), res('d1')]], [tline(SID, [res('d1', true)])]);
    assert(A_(dupRes).summary.verdict === 'unverified_record_unparseable' && A_(dupRes).summary.errorResults === 0 && A_(dupRes).summary.unparseable >= 1, 'T-9. 同じ ID の tool_result の重複は拒否（未検証・後の結果で上書きしない）');
    const tilde = [use('h1', 'Read', { file_path: '~/secret.txt' }), use('h2', 'Read', { file_path: '~' }), use('h3', 'Glob', { pattern: '~/**/*.md' }), use('h4', 'Grep', { pattern: 'x', path: '~/docs' }),
      use('h5', 'Grep', { pattern: 'x', glob: '~/*.md' }), use('h6', 'Read', { file_path: '~user\\x.txt' })];
    assert(tilde.every(function (u) { return A_(tx(SID, [[u, res(u.id)]])).summary.verdict === 'unverified_record_unparseable'; }) && tcm.normPath('~/x', WTR) === null, 'T-10. ~ で始まる path は worktree 内とみなさず判定不能（停止）');
  }

  // ── S4：claudeExecutor（spawn は必ず差し替え。実 CLI・network・推論は使わない）──
  const ex = require('./tools/devAutopilot/claudeExecutor');
  const { EventEmitter } = require('events');
  const WT4 = (T) => 'C:\\Users\\hp\\ENBISOU_AI\\.autopilot\\wt\\' + T;
  const MAIN_OK = { autopilotStatusHash: '8226124a93f0', protectedFingerprint: 'd1fd4bd36f69' };
  const RSO = { stage: 'research', status: 'ok', summary: 'SUMMARY-MARKER-NOT-TO-STORE', files_read: ['docs/notes.md'], files_changed: [], proposed_tests: [], risks: [], requires_human: false, stop_reason: null };
  // stage ごとに必要な前 stage の出力（claudeRunner.buildStagePrompt の PREVIOUS_REQUIRED に合わせた人工値）
  const STAGE_OUT = (st) => ({ stage: st, status: 'ok', summary: 'done', files_read: ['docs/notes.md'], files_changed: [], proposed_tests: [], risks: [], requires_human: false, stop_reason: null });
  const PREV = { researching: {}, designing: { research: STAGE_OUT('research') }, implementing: { research: STAGE_OUT('research'), design: STAGE_OUT('design') },
    reviewing: { design: STAGE_OUT('design'), implement: STAGE_OUT('implement') } };
  function fakeSpawn(script) {
    const calls = [];
    const fn = function (exe, args, opts) {
      const ch = new EventEmitter(); ch.pid = script.noPid ? undefined : 4242; ch.stdout = new EventEmitter(); ch.stderr = new EventEmitter();
      ch.stdin = { on: function () {}, end: function (dat) { ch.stdinBytes = String(dat).length; ch.stdinText = String(dat); } };
      ch.kill = function (sig) { ch.killedWith = sig; if (script.onKill) setTimeout(function () { script.onKill(ch); }, 1); return true; };
      calls.push({ exe: exe, args: args, opts: opts, child: ch });
      setTimeout(function () { script.run(ch, args[args.indexOf('--session-id') + 1]); }, script.startDelay || 1);
      return ch;
    };
    fn.calls = calls; return fn;
  }
  const envelope = (sid, over) => Buffer.from(JSON.stringify(Object.assign({ type: 'result', subtype: 'success', is_error: false, api_error_status: null, session_id: sid, total_cost_usd: 0.02,
    num_turns: 3, permission_denials: [], modelUsage: { 'claude-haiku-4-5-20251001': { inputTokens: 1 } }, structured_output: RSO, result: '' }, over || {})));
  const finish = (ch, sid, over) => { ch.stdout.emit('data', envelope(sid, over)); ch.emit('exit', 0, null); ch.emit('close', 0, null); };
  const goodTranscript = (sid, T, withSO) => tx(sid, [[use('g1', 'Grep', { pattern: 'verification-token' }), res('g1')], [use('g2', 'Read', { file_path: WT4(T) + '\\docs\\notes.md' }), res('g2')]]
    .concat(withSO ? [[use('g3', 'StructuredOutput', RSO), res('g3')]] : []));
  let uuidSeq = 5000;
  function setupRun(T, opts) {
    const o = opts || {};
    const mf = memFs(), st = storeWith(mf);
    const init = rs.createInitialRun({ taskId: T, task: o.task || { title: 't', goal: 'g', allowedPaths: ['docs/'], forbiddenPaths: [] }, mainRepoPath: REPO, baseHead: HEAD, branch: 'dev/' + T,
      worktreePath: WT4(T), budget: { capUsd: 5, maxInvocations: o.maxInvocations || 6 }, mainStatusHashAtStart: '8226124a93f0', protectedMd5AtStart: Object.assign({}, PROTECTED_BASELINE), now: at(0) }).run;
    rs.createRun(st, init);
    const own = rs.acquireOwnership(st, T, { ownerId: A, pid: 11, now: new Date().toISOString() });
    let next = rs.markIsolationVerified(own.run, { now: new Date().toISOString(), worktreeHead: HEAD }).run;
    const stage = o.stageNull ? null : (o.stage || 'researching');
    for (const sg of ['researching', 'designing', 'implementing', 'testing', 'reviewing']) { if (stage === null) break; next = rs.transitionStage(next, sg, { now: new Date().toISOString() }).run; if (sg === stage) break; }
    if (o.filesChanged) next.filesChanged = o.filesChanged.slice();
    const sv = rs.saveRunAsOwner(st, next, { ownerId: A, expectedRevision: own.revision, now: new Date().toISOString() });
    return { mf: mf, st: st, T: T, rev: sv.revision, startedAt: init.startedAt, stage: stage };
  }
  function ctxFor(s, spawn, over) {
    const main = { cur: Object.assign({}, MAIN_OK) };
    const c = {
      store: s.st, taskId: s.T, ownerId: A, clock: () => new Date().toISOString(), main: main,
      cli: { exePath: 'C:\\fake\\claude.exe', exeSha256: H64('a'), cliVersion: '2.1.280 (Claude Code)' },
      approval: { kind: 'enbisou-runner-invocation-approval', approvalId: U(990), approvedBy: 'human', taskId: s.T, runStartedAt: s.startedAt, mainRepoPath: REPO, baseHead: HEAD,
        branch: 'dev/' + s.T, worktreePath: WT4(s.T), stages: [s.stage || 'researching'], exeSha256: H64('a'), cliVersion: '2.1.280 (Claude Code)', maxInvocations: 6, maxBudgetUsdPerInvocation: 0.5,
        billingScope: ex.BILLING_SCOPE, mainAutopilotStatusHash: MAIN_OK.autopilotStatusHash, protectedFingerprint: MAIN_OK.protectedFingerprint, structuredOutputPolicy: 'block',
        issuedAt: new Date(Date.now() - 60000).toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString() },
      build: { objective: 'find the verification token', acceptanceCriteria: ['token reported'], stopConditions: ['outside needed'], previousOutputs: PREV[s.stage || 'researching'] || {},
        allowedPaths: ['docs/'], forbiddenPaths: [], appendSystemPrompt: 'Follow the ENBISOU Autopilot contract.', maxBudgetUsd: 0.5, model: 'haiku' },
      deps: { spawn: spawn, hashFile: () => H64('a'), parentEnv: { PATH: 'p', PATHEXT: 'p', SYSTEMROOT: 'p', SYSTEMDRIVE: 'p', WINDIR: 'p', COMSPEC: 'p', TEMP: 'p', TMP: 'p', HOME: 'p', USERPROFILE: 'p', APPDATA: 'p', LOCALAPPDATA: 'p', ANTHROPIC_API_KEY: 'sk-ant-SECRETSECRETSECRETSECRET', CLAUDE_CODE_OAUTH_TOKEN: 'x' },
        observeMain: () => Object.assign({}, main.cur), observeWorktree: () => ({ worktreePath: WT4(s.T), worktreeHead: HEAD, branchTip: HEAD, worktreeBranchRef: 'refs/heads/dev/' + s.T, changedEntries: c.wtEntries || [], gitFileHash: H64('f') }),
        readTranscript: () => c.transcript || null, randomUUID: () => U(uuidSeq++) },
      limits: { timeoutMs: 400, heartbeatMs: 20, killWaitMs: 60, drainWaitMs: 60, stdoutMax: 256 * 1024, stderrMax: 1024 },
    };
    return Object.assign(c, over || {});
  }
  const runFile = (s) => s.mf.get(dirOf(s.T) + '\\run.json');
  const inv0 = (s) => rs.readRun(s.st, s.T).run.invocations[0];

  caseHeader('E. claudeExecutor 統合（差し替え spawn・偽 fs）');
  {
    // E-1 正常系（StructuredOutput を含まない合成 transcript。実 CLI では StructuredOutput が出るため、実運用の成功を示すものではない）
    const s1 = setupRun('task-s4-001');
    let c1;
    const sp1 = fakeSpawn({ startDelay: 70, run: function (ch, sid) { c1.transcript = goodTranscript(sid, 'task-s4-001', false); finish(ch, sid); } });
    c1 = ctxFor(s1, sp1);
    const r1 = await ex.runInvocation(c1);
    const call = sp1.calls[0] || {};
    const saved1 = rs.readRun(s1.st, s1.T).run;
    assert(r1.ok && r1.disposition === 'none' && r1.state === 'finished' && sp1.calls.length === 1 && saved1.invocations[0].state === 'finished' && saved1.budget.spentUsd === 0.02
      && saved1.outcome === null && saved1.lock && saved1.lock.ownerId === A && r1.revision > s1.rev + 2, 'E-1. 正常系：予約 → 起動 1 回 → heartbeat → 一括保存（区分 none・費用 0.02・lock は保持）');
    const envNames = Object.keys(call.opts.env).sort().join(',');
    assert(call.args.indexOf('--restricted') !== -1 && call.args.indexOf('--safe-mode') !== -1 && call.args.indexOf('--allowedTools') === -1 && call.opts.shell === false
      && call.opts.cwd === WT4('task-s4-001') && envNames.indexOf('ANTHROPIC') === -1 && envNames.indexOf('CLAUDE_') === -1 && call.opts.env.DISABLE_UPDATES === '1' && Object.keys(call.opts.env).length === 13
      && call.child.stdinBytes > 0, 'E-2. 起動条件：restricted・safe-mode・allowedTools なし・shell:false・cwd は隔離 worktree・env は 13 項目（認証 env なし）・prompt は stdin');
    const raw1 = runFile(s1);
    assert(raw1.indexOf('SUMMARY-MARKER-NOT-TO-STORE') === -1 && raw1.indexOf('find the verification token') === -1 && raw1.indexOf('SECRETSECRET') === -1 && raw1.indexOf('verification-token') === -1
      && saved1.invocations[0].result.cost.basis === 'cli_reported_estimate_not_billing' && saved1.invocations[0].launch.exeSha256.length === 64, 'E-3. 本文（summary・prompt・transcript・env 値）を保存しない・費用は CLI 推定値・SHA-256 は 64 桁');
    assert(saved1.invocations[0].launch.approvalId === U(990) && saved1.invocations[0].launch.approvalSha256 === tcm.canonicalSha256(c1.approval)
      && saved1.invocations[0].launch.approvalSha256.length === 64, 'E-3b. 予約記録に承認 ID と承認内容の正規化 SHA-256 全文を保存');
    const again = await ex.runInvocation(ctxFor(s1, sp1));
    assert(!again.ok && again.phase === 'reserve' && again.cause === 'stage_already_invoked:research' && sp1.calls.length === 1, 'E-4. 同じ stage の 2 回目は予約で拒否（起動しない・二重完了なし）');

    // E-5 StructuredOutput を含む transcript（実 CLI と同じ形）→ 照合は match でも未検証 block
    const s5 = setupRun('task-s4-005'); let c5;
    const sp5 = fakeSpawn({ run: function (ch, sid) { c5.transcript = goodTranscript(sid, 'task-s4-005', true); finish(ch, sid); } });
    c5 = ctxFor(s5, sp5);
    const r5 = await ex.runInvocation(c5);
    const i5 = inv0(s5);
    assert(r5.ok && r5.disposition === 'block' && r5.dispositionReason === 'unverified:unverified_unknown_tool' && r5.runOutcome === 'blocked'
      && i5.result.transcript.structuredOutputComparison === 'match' && i5.result.transcript.toolCounts.StructuredOutput === 1, 'E-5. StructuredOutput は照合 match でも未検証 block（成功扱いにしない）');

    // E-6 予約の保存失敗 → 起動しない
    const s6 = setupRun('task-s4-006');
    const sp6 = fakeSpawn({ run: function (ch, sid) { finish(ch, sid); } });
    s6.mf.fail.renameSync = (n) => /run\.json$/.test(n);
    const r6 = await ex.runInvocation(ctxFor(s6, sp6));
    s6.mf.fail = {};
    assert(!r6.ok && r6.phase === 'reserve' && r6.error === 'reserve_save_failed' && sp6.calls.length === 0 && rs.readRun(s6.st, s6.T).run.invocations.length === 0, 'E-6. 予約を保存できなければ起動しない');

    // E-7 完了の保存失敗 → 予約記録（started）と lock を残して停止・自動解放しない
    const s7 = setupRun('task-s4-007'); let c7;
    const sp7 = fakeSpawn({ run: function (ch, sid) { c7.transcript = goodTranscript(sid, 'task-s4-007', false); s7.mf.fail.renameSync = (n) => /run\.json$/.test(n); finish(ch, sid); } });
    c7 = ctxFor(s7, sp7);
    const r7 = await ex.runInvocation(c7);
    s7.mf.fail = {};
    const run7 = rs.readRun(s7.st, s7.T).run;
    assert(!r7.ok && r7.phase === 'complete' && r7.error === 'complete_save_failed' && run7.invocations[0].state === 'started' && run7.lock.ownerId === A
      && rs.releaseOwnership(s7.st, s7.T, { ownerId: A, expectedRevision: run7.revision, now: new Date().toISOString() }).error === 'release_refused_unfinalized', 'E-7. 完了を保存できなければ started と lock を残して停止（解放も拒否）');

    // E-8 timeout → kill → exit は観測しても子孫不明 → unconfirmed・block
    const s8 = setupRun('task-s4-008');
    const sp8 = fakeSpawn({ run: function () {}, onKill: function (ch) { ch.emit('exit', null, 'SIGKILL'); ch.emit('close', null, 'SIGKILL'); } });
    const r8 = await ex.runInvocation(ctxFor(s8, sp8, { limits: { timeoutMs: 80, heartbeatMs: 20, killWaitMs: 60, drainWaitMs: 60, stdoutMax: 256 * 1024, stderrMax: 1024 } }));
    const i8 = inv0(s8);
    assert(r8.ok && r8.state === 'unconfirmed' && r8.disposition === 'block' && r8.dispositionReason === 'termination_unconfirmed' && sp8.calls[0].child.killedWith === 'SIGKILL'
      && i8.result.process.timedOut === true && i8.result.process.termination === 'descendants_unknown' && i8.result.process.errorClass === 'ETIMEDOUT', 'E-8. timeout：強制終了後の子孫不明は unconfirmed・block');
    // E-9 kill しても exit が来ない → exit_event_missing
    const s9 = setupRun('task-s4-009');
    const sp9 = fakeSpawn({ run: function () {} });
    const r9 = await ex.runInvocation(ctxFor(s9, sp9, { limits: { timeoutMs: 60, heartbeatMs: 20, killWaitMs: 50, drainWaitMs: 50, stdoutMax: 256 * 1024, stderrMax: 1024 } }));
    assert(r9.ok && r9.state === 'unconfirmed' && inv0(s9).result.process.termination === 'exit_event_missing' && r9.runOutcome === 'blocked', 'E-9. kill 後も exit 未観測 → exit_event_missing・block（上限付きで待つ）');
    // E-10 exit は来たが close（出力回収）が来ない → 子孫が pipe を保持している可能性 → unconfirmed
    const s10 = setupRun('task-s4-010');
    const sp10 = fakeSpawn({ run: function (ch, sid) { ch.stdout.emit('data', envelope(sid)); ch.emit('exit', 0, null); } });
    const r10 = await ex.runInvocation(ctxFor(s10, sp10));
    assert(r10.ok && r10.state === 'unconfirmed' && inv0(s10).result.process.termination === 'descendants_unknown' && inv0(s10).result.envelope.parse === 'absent', 'E-10. exit 後に close 未観測（出力回収未完了）→ unconfirmed・出力を信用しない');
    // E-11 stdout / stderr の上限超過 → kill・蓄積しない
    const s11 = setupRun('task-s4-011');
    const sp11 = fakeSpawn({ run: function (ch) { ch.stderr.emit('data', Buffer.from('STDERR-MARKER-'.repeat(200))); }, onKill: function (ch) { ch.emit('exit', null, 'SIGKILL'); ch.emit('close', null, 'SIGKILL'); } });
    const r11 = await ex.runInvocation(ctxFor(s11, sp11));
    const s11b = setupRun('task-s4-012');
    const sp11b = fakeSpawn({ run: function (ch) { ch.stdout.emit('data', Buffer.alloc(3000, 65)); }, onKill: function (ch) { ch.emit('exit', null, 'SIGKILL'); ch.emit('close', null, 'SIGKILL'); } });
    const r11b = await ex.runInvocation(ctxFor(s11b, sp11b, { limits: { timeoutMs: 400, heartbeatMs: 20, killWaitMs: 60, drainWaitMs: 60, stdoutMax: 1000, stderrMax: 1024 } }));
    assert(r11.ok && r11.state === 'unconfirmed' && inv0(s11).result.process.bufferExceeded === true && inv0(s11).result.process.stderrBytes > 1024 && runFile(s11).indexOf('STDERR-MARKER') === -1
      && r11b.ok && r11b.state === 'unconfirmed' && inv0(s11b).result.process.bufferExceeded === true && inv0(s11b).result.envelope.parse === 'over_limit'
      && inv0(s11).result.envelope.parse === 'absent', 'E-11. stderr・stdout とも上限超過で停止し、本文を蓄積・保存しない（stdout 上限超過は over_limit として欠落 absent と区別）');
    // E-12 Safety 違反（実行中に main の Protected が変化）→ Safety 優先で block
    const s12 = setupRun('task-s4-013'); let c12;
    const sp12 = fakeSpawn({ run: function (ch, sid) { c12.transcript = goodTranscript(sid, 'task-s4-013', false); c12.main.cur.protectedFingerprint = 'ffffffffffff'; finish(ch, sid); } });
    c12 = ctxFor(s12, sp12);
    const r12 = await ex.runInvocation(c12);
    assert(r12.ok && r12.disposition === 'block' && r12.dispositionReason === 'safety:violated' && inv0(s12).result.safety.reasonCodes.indexOf('main_protected_changed') !== -1, 'E-12. Safety 違反は block（Safety 優先）');
    // E-13 heartbeat 中に所有権を失う（owner.lock が他者に替わる）→ 子プロセスを止め、完了を保存せず停止
    const s13 = setupRun('task-s4-014');
    const sp13 = fakeSpawn({ run: function (ch) { setTimeout(function () { s13.mf.put(dirOf('task-s4-014') + '\\owner.lock', JSON.stringify({ kind: 'owner', taskId: 'task-s4-014', ownerId: B, pid: 22, acquiredAt: at(1) })); }, 30); },
      onKill: function (ch) { ch.emit('exit', null, 'SIGKILL'); ch.emit('close', null, 'SIGKILL'); } });
    const r13 = await ex.runInvocation(ctxFor(s13, sp13));
    const run13 = rs.readRun(s13.st, s13.T).run;
    assert(!r13.ok && r13.error === 'ownership_lost_or_heartbeat_save_failed' && sp13.calls[0].child.killedWith === 'SIGKILL' && run13.invocations[0].state === 'started' && sp13.calls.length === 1, 'E-13. 所有権喪失（heartbeat 保存失敗）→ 停止・完了を保存しない・自動再起動しない');
    // E-14 spawn の起動失敗（pid なし）→ not_started として記録し block
    const s14 = setupRun('task-s4-015');
    const sp14 = fakeSpawn({ noPid: true, run: function (ch) { const e = new Error('x'); e.code = 'ENOENT'; ch.emit('error', e); } });
    const r14 = await ex.runInvocation(ctxFor(s14, sp14));
    assert(r14.ok && r14.state === 'finished' && inv0(s14).result.process.termination === 'not_started' && inv0(s14).result.process.errorClass === 'ENOENT' && r14.runOutcome === 'blocked', 'E-14. 起動失敗（pid なし）は not_started として block');
  }

  caseHeader('U. 未承認・条件不足の起動拒否（起動 0 回）');
  {
    const s = setupRun('task-s4-020');
    const sp = fakeSpawn({ run: function (ch, sid) { finish(ch, sid); } });
    const base = ctxFor(s, sp);
    const withA = (patch) => ctxFor(s, sp, { approval: Object.assign({}, base.approval, patch) });
    const cases = [
      ['approval_invalid', ctxFor(s, sp, { approval: undefined })],
      ['approval_invalid', withA({ approvedBy: 'auto' })],
      ['approval_invalid', withA({ stages: ['designing'] })],
      ['approval_invalid', withA({ expiresAt: new Date(Date.now() - 1000).toISOString() })],
      ['approval_invalid', withA({ taskId: 'task-other-01' })],
      ['approval_invalid', withA({ maxBudgetUsdPerInvocation: 0.1 })],
      ['approval_invalid', withA({ cliVersion: '2.1.169 (Claude Code)' })],
      ['approval_invalid', withA({ extra: 1 })],
      ['cli_exe_mismatch', ctxFor(s, sp, { deps: Object.assign({}, base.deps, { hashFile: () => H64('b') }) })],
      ['real_spawn_disabled', ctxFor(s, sp, { deps: Object.assign({}, base.deps, { spawn: undefined }) })],
      ['not_owner', ctxFor(s, sp, { ownerId: B })],
      ['main_state_mismatch', (function () { const x = ctxFor(s, sp); x.main.cur.protectedFingerprint = 'eeeeeeeeeeee'; return x; })()],
    ];
    const before = runFile(s);
    const outs = [];
    for (const k of cases) { outs.push(await ex.runInvocation(k[1])); }
    assert(outs.every(function (o, i) { return !o.ok && o.error === cases[i][0] && o.phase === 'preflight'; }) && sp.calls.length === 0 && runFile(s) === before, 'U-1. 承認なし・Human 以外・対象外 stage・期限切れ・別 task・予算超過・版違い・未知 key・exe 不一致・実 spawn 無効・非所有者・main 不一致は起動しない');
    assert(outs[9].error === 'real_spawn_disabled' && violations.length === 0, 'U-2. allowRealSpawn なし・spawn 差し替えなしでは child_process を読み込まない');
    const sNull = setupRun('task-s4-021', { stageNull: true });
    const rn = await ex.runInvocation(ctxFor(sNull, sp));
    const tamper = setupRun('task-s4-022');
    const tr = JSON.parse(runFile(tamper)); tr.isolation.worktreeHead = '1'.repeat(40);
    tamper.mf.put(dirOf('task-s4-022') + '\\run.json', JSON.stringify(tr));
    const rt = await ex.runInvocation(ctxFor(tamper, sp));
    assert(rn.error === 'stage_not_invocable' && rt.error === 'isolation_not_verified' && sp.calls.length === 0, 'U-3. stage 未開始・隔離未検証（worktree HEAD 不一致）の run では起動しない（main では起動しない）');
    assert(ex.validateApproval(base.approval, { run: rs.readRun(s.st, s.T).run, now: new Date().toISOString(), exeSha256: H64('a'), cliVersion: '2.1.280 (Claude Code)', maxBudgetUsd: 0.5 }).length === 0
      && ex.validateApproval(Object.assign({}, base.approval, { issuedAt: at(0), expiresAt: at(90000) }), { run: rs.readRun(s.st, s.T).run, now: at(10), exeSha256: H64('a'), cliVersion: '2.1.280 (Claude Code)', maxBudgetUsd: 0.5 }).indexOf('approval_window_invalid') !== -1, 'U-4. 承認の有効期間は 24 時間以内（長すぎる承認は拒否）');
  }

  caseHeader('V. 起動前の隔離 worktree 検証（予約・起動 0 回）');
  {
    const s = setupRun('task-s4-030');
    const sp = fakeSpawn({ run: function (ch, sid) { finish(ch, sid); } });
    const base = ctxFor(s, sp);
    const wt = (patch) => ctxFor(s, sp, { deps: Object.assign({}, base.deps, { observeWorktree: () => Object.assign(base.deps.observeWorktree(), patch) }) });
    const entry = { path: 'docs/a.md', status: 'modified', hash: H64('1'), isSymlink: false };
    const cases = [
      ['worktree_head_mismatch', wt({ worktreeHead: '1'.repeat(40) })],
      ['branch_tip_mismatch', wt({ branchTip: '2'.repeat(40) })],
      ['worktree_branch_mismatch', wt({ worktreeBranchRef: 'refs/heads/dev/task-other' })],
      ['worktree_path_mismatch', wt({ worktreePath: WT4('task-other-9') })],
      ['worktree_path_unobserved', wt({ worktreePath: undefined })],
      ['worktree_dirty_before_read_only_stage', wt({ changedEntries: [entry] })],
      ['worktree_changes_unobserved', wt({ changedEntries: [{ path: 'docs/a.md' }] })],
      ['worktree_changes_unobserved', wt({ changedEntries: null })],
      ['worktree_git_file_unobserved', wt({ gitFileHash: null })],
    ];
    const before = runFile(s);
    const outs = [];
    for (const k of cases) { outs.push(await ex.runInvocation(k[1])); }
    const thrown = await ex.runInvocation(ctxFor(s, sp, { deps: Object.assign({}, base.deps, { observeWorktree: () => { throw new Error('x'); } }) }));
    const nul = await ex.runInvocation(ctxFor(s, sp, { deps: Object.assign({}, base.deps, { observeWorktree: () => null }) }));
    assert(outs.every(function (o, i) { return !o.ok && o.phase === 'preflight' && o.error === 'worktree_state_mismatch' && o.reasons.indexOf(cases[i][0]) !== -1; })
      && thrown.error === 'worktree_unobservable' && nul.error === 'worktree_unobservable' && sp.calls.length === 0 && runFile(s) === before,
      'V-1. HEAD・branch tip・branchRef・所在の不一致・欠落、research の既存変更、観測不能・不正は予約・起動の前に拒否（起動 0 回・記録不変）');
    // implement：記録済み・許可範囲内の差分は起動できる／未記録の差分は拒否
    const si = setupRun('task-s4-031', { stage: 'implementing', filesChanged: ['docs/a.md'] });
    const spi = fakeSpawn({ run: function (ch, sid) { finish(ch, sid); } });
    const ci = ctxFor(si, spi); ci.wtEntries = [entry];
    const ri = await ex.runInvocation(ci);
    const su = setupRun('task-s4-032', { stage: 'implementing', filesChanged: ['docs/a.md'] });
    const spu = fakeSpawn({ run: function (ch, sid) { finish(ch, sid); } });
    const cu = ctxFor(su, spu); cu.wtEntries = [Object.assign({}, entry, { path: 'docs/b.md' })];
    const ru = await ex.runInvocation(cu);
    const cs = ctxFor(su, spu); cs.wtEntries = [Object.assign({}, entry, { isSymlink: true })];
    const rsy = await ex.runInvocation(cs);
    const cbad = ctxFor(su, spu); cbad.wtEntries = [Object.assign({}, entry, { path: '../x.md' })];
    const rbad = await ex.runInvocation(cbad);
    assert(ri.ok && spi.calls.length === 1 && inv0(si).stage === 'implementing'
      && ru.error === 'worktree_state_mismatch' && ru.reasons.indexOf('worktree_diff_unexpected') !== -1
      && rsy.error === 'worktree_state_mismatch' && rsy.reasons.indexOf('worktree_symlink_present') !== -1
      && rbad.error === 'worktree_state_mismatch' && rbad.reasons.indexOf('worktree_diff_unknown') !== -1 && spu.calls.length === 0,
      'V-2. implement：記録済み・許可範囲内の差分だけ起動可・未記録（想定外）・symlink・判定不能な path は起動前に拒否');
    // markIsolationVerified を所有者管理外の保存経路（saveRun）で記録しても、起動前の所有権確認・worktree 再検証は迂回できない
    const mf = memFs(), st = storeWith(mf), TB = 'task-s4-033';
    const init = rs.createInitialRun({ taskId: TB, task: { title: 't', goal: 'g', allowedPaths: ['docs/'], forbiddenPaths: [] }, mainRepoPath: REPO, baseHead: HEAD, branch: 'dev/' + TB,
      worktreePath: WT4(TB), budget: { capUsd: 5, maxInvocations: 6 }, mainStatusHashAtStart: '8226124a93f0', protectedMd5AtStart: Object.assign({}, PROTECTED_BASELINE), now: at(0) }).run;
    rs.createRun(st, init);
    const legacyNext = rs.transitionStage(rs.markIsolationVerified(init, { now: at(1), worktreeHead: HEAD }).run, 'researching', { now: at(2) }).run;
    const legacySave = rs.saveRun(st, legacyNext, { expectedUpdatedAt: init.updatedAt });
    const spb = fakeSpawn({ run: function (ch, sid) { finish(ch, sid); } });
    const rb = await ex.runInvocation(ctxFor({ mf: mf, st: st, T: TB, startedAt: init.startedAt, stage: 'researching' }, spb));
    assert(legacySave.ok && rs.readRun(st, TB).run.isolation.state === 'verified' && rb.error === 'not_owner' && spb.calls.length === 0,
      'V-3. 所有者管理外の保存で隔離を記録しても、executor は所有権確認で拒否する（worktree 再検証も毎回実施：V-1）');
  }

  caseHeader('P. 実行承認の束縛（run・repo・stage・CLI・上限・期間・main 期待値）');
  {
    const s = setupRun('task-s4-040');
    const sp = fakeSpawn({ run: function (ch, sid) { finish(ch, sid); } });
    const base = ctxFor(s, sp);
    const withA = (patch) => ctxFor(s, sp, { approval: Object.assign({}, base.approval, patch) });
    const cases = [
      ['approval_run_mismatch', withA({ runStartedAt: at(5) })],
      ['approval_repo_mismatch', withA({ mainRepoPath: 'C:\\Users\\hp\\ENBISOU_AI\\other-repo' })],
      ['approval_isolation_mismatch', withA({ baseHead: '3'.repeat(40) })],
      ['approval_isolation_mismatch', withA({ branch: 'dev/task-other' })],
      ['approval_isolation_mismatch', withA({ worktreePath: WT4('task-other-8') })],
      ['approval_billing_scope', withA({ billingScope: 'extra_usage_allowed' })],
      ['approval_main_mismatch', withA({ mainAutopilotStatusHash: 'ec4ea8f0a985' })],
      ['approval_main_mismatch', withA({ protectedFingerprint: 'eeeeeeeeeeee' })],
      ['approval_shape', ctxFor(s, sp, { approval: (function () { const a = Object.assign({}, base.approval); delete a.billingScope; return a; })() })],
    ];
    const before = runFile(s);
    const outs = [];
    for (const k of cases) { outs.push(await ex.runInvocation(k[1])); }
    assert(outs.every(function (o, i) { return !o.ok && o.phase === 'preflight' && o.error === 'approval_invalid' && o.reasons.indexOf(cases[i][0]) !== -1; }) && sp.calls.length === 0 && runFile(s) === before,
      'P-1. 承認は run（taskId・開始時刻）・repo・隔離（baseHead・branch・worktree）・課金範囲（月額プラン内）・main 期待値に束縛（不一致は起動 0 回）');
    // main の期待値は ctx から受け取らない：ctx.expectedMain・承認を変化後の main に合わせても run 記録と一致しなければ起動しない
    const cm = ctxFor(s, sp, { expectedMain: { autopilotStatusHash: 'ec4ea8f0a985', protectedFingerprint: 'd1fd4bd36f69' } }); cm.main.cur.autopilotStatusHash = 'ec4ea8f0a985';
    const rm = await ex.runInvocation(cm);
    const cm2 = withA({ mainAutopilotStatusHash: 'ec4ea8f0a985' }); cm2.main.cur.autopilotStatusHash = 'ec4ea8f0a985';
    const rm2 = await ex.runInvocation(cm2);
    const runNow = rs.readRun(s.st, s.T).run;
    assert(rm.error === 'main_state_mismatch' && rm2.error === 'approval_invalid' && rm2.reasons.indexOf('approval_main_mismatch') !== -1 && sp.calls.length === 0
      && ex.protectedFingerprintFromRun(runNow) === MAIN_OK.protectedFingerprint && ex.expectedMainFromRun(Object.assign(clone(runNow), { protectedMd5AtStart: { a: 'b' } })) === null
      && ex.validateApproval(base.approval, { run: Object.assign(clone(runNow), { protectedMd5AtStart: { a: 'b' } }), now: new Date().toISOString(), exeSha256: H64('a'), cliVersion: '2.1.280 (Claude Code)', maxBudgetUsd: 0.5 }).indexOf('run_main_record_unusable') !== -1,
      'P-2. main 期待値は run 記録から導く（ctx.expectedMain を信頼しない・承認だけ変えても不可・記録が使えなければ拒否）');

    // 承認ごとの上限：同じ承認で 2 回目（別 stage）は拒否・別の承認なら run 全体の上限内で起動可
    const s2 = setupRun('task-s4-041'); let c1;
    const sp2 = fakeSpawn({ run: function (ch, sid) { if (c1) c1.transcript = goodTranscript(sid, 'task-s4-041', false); finish(ch, sid); } });
    const ap1 = Object.assign({}, ctxFor(s2, sp2).approval, { stages: ['researching', 'designing'], maxInvocations: 1 });
    c1 = ctxFor(s2, sp2, { approval: ap1 });
    const r1 = await ex.runInvocation(c1);
    const cur = rs.readRun(s2.st, s2.T).run;
    const mv = rs.saveRunAsOwner(s2.st, rs.transitionStage(cur, 'designing', { now: new Date().toISOString() }).run, { ownerId: A, expectedRevision: cur.revision, now: new Date().toISOString() });
    c1 = null;
    const r2 = await ex.runInvocation(ctxFor(s2, sp2, { approval: ap1 }));
    const ap2 = Object.assign({}, ap1, { approvalId: U(991), stages: ['designing'] });
    const c3x = ctxFor(s2, sp2, { approval: ap2 }); c3x.build.previousOutputs = PREV.designing;
    const r3 = await ex.runInvocation(c3x);
    const invs = rs.readRun(s2.st, s2.T).run.invocations;
    assert(r1.ok && mv.ok && !r2.ok && r2.error === 'approval_invalid' && r2.reasons.indexOf('approval_invocation_limit') !== -1 && r3.ok && sp2.calls.length === 2
      && invs.length === 2 && invs[0].launch.approvalId === U(990) && invs[1].launch.approvalId === U(991) && invs[1].launch.approvalSha256 === tcm.canonicalSha256(ap2)
      && ex.approvalUseCount(rs.readRun(s2.st, s2.T).run, U(990)) === 1, 'P-3. 承認ごとの起動回数は予約済み invocation から計上し、上限到達後は同じ承認で起動しない（別の承認は可）');
    // run 全体の上限：承認に余りがあっても run の maxInvocations に達したら起動しない
    const s3 = setupRun('task-s4-042', { maxInvocations: 1 }); let c3;
    const sp3 = fakeSpawn({ run: function (ch, sid) { if (c3) c3.transcript = goodTranscript(sid, 'task-s4-042', false); finish(ch, sid); } });
    c3 = ctxFor(s3, sp3, { approval: Object.assign({}, ctxFor(s3, sp3).approval, { stages: ['researching', 'designing'] }) });
    const q1 = await ex.runInvocation(c3);
    const cur3 = rs.readRun(s3.st, s3.T).run;
    rs.saveRunAsOwner(s3.st, rs.transitionStage(cur3, 'designing', { now: new Date().toISOString() }).run, { ownerId: A, expectedRevision: cur3.revision, now: new Date().toISOString() });
    c3 = null;
    const q2 = await ex.runInvocation(ctxFor(s3, sp3, { approval: Object.assign({}, ctxFor(s3, sp3).approval, { approvalId: U(993), stages: ['designing'], maxInvocations: 5 }) }));
    assert(q1.ok && !q2.ok && q2.phase === 'preflight' && q2.error === 'run_invocation_limit_reached' && sp3.calls.length === 1, 'P-4. run 全体の上限は承認ごとの上限とは別に検査（両方を満たす場合だけ起動）');
    // 完了前（started）の記録も承認の消費として数える
    const s4 = setupRun('task-s4-043');
    const cur4 = rs.readRun(s4.st, s4.T).run;
    const pending = rs.beginInvocation(cur4, { now: new Date().toISOString(), invocationId: U(1101), sessionId: U(1102), stage: 'researching', launch: launch({ approvalId: U(992) }) }).run;
    rs.saveRunAsOwner(s4.st, pending, { ownerId: A, expectedRevision: cur4.revision, now: new Date().toISOString() });
    const sp4 = fakeSpawn({ run: function (ch, sid) { finish(ch, sid); } });
    const apP = Object.assign({}, ctxFor(s4, sp4).approval, { approvalId: U(992), maxInvocations: 1 });
    const w1 = await ex.runInvocation(ctxFor(s4, sp4, { approval: apP }));
    const w2 = await ex.runInvocation(ctxFor(s4, sp4, { approval: Object.assign({}, apP, { maxInvocations: 2 }) }));
    assert(w1.error === 'approval_invalid' && w1.reasons.indexOf('approval_invocation_limit') !== -1 && w2.phase === 'reserve' && w2.cause === 'invocation_unfinalized' && sp4.calls.length === 0,
      'P-5. 完了前（started）の予約も承認の消費に数える・未確定の予約があれば同 stage でも起動しない');
  }

  caseHeader('Q. 実行範囲（保存済み run.task が正本・ctx.build は正規化して一致検査）');
  {
    const R = ex.resolveExecutionScope;
    const TASKQ = { title: 't', goal: 'g', allowedPaths: ['docs/', 'src/lib/'], forbiddenPaths: ['docs/secret/'] };
    const runQ = (task) => ({ task: task, worktreePath: WT4('task-q'), mainRepoPath: REPO });
    const same1 = R(runQ(TASKQ), { allowedPaths: ['SRC/lib/', 'docs/', 'docs//'], forbiddenPaths: ['docs/secret/', 'Docs/Secret/'] });
    const omitted = R(runQ(TASKQ), { objective: 'x' });
    assert(same1.ok && omitted.ok && same(same1.allowedPaths, ['docs/', 'src/lib/']) && same(omitted.allowedPaths, same1.allowedPaths) && same(same1.forbiddenPaths, ['docs/secret/'])
      && same(omitted.forbiddenPaths, same1.forbiddenPaths), 'Q-1. 順序・重複・大文字小文字・末尾 / の重複は同じ範囲として扱い、省略時も run.task と同じ範囲になる');
    const rej = (b, code, task) => { const x = R(runQ(task || TASKQ), b); return !x.ok && x.reasons.some(function (r) { return r === code || r.indexOf(code + ':') === 0; }); };
    assert(rej({ allowedPaths: ['docs/', 'src/lib/', 'data/'] }, 'build_allowed_paths_expanded') && rej({ allowedPaths: ['docs/', 'src/'] }, 'build_allowed_paths_expanded')
      && rej({ allowedPaths: ['docs/'] }, 'build_allowed_paths_mismatch') && rej({ allowedPaths: ['docs', 'src/lib/'] }, 'build_allowed_paths_mismatch')
      && rej({ forbiddenPaths: [] }, 'build_forbidden_paths_mismatch') && rej({ forbiddenPaths: ['docs/secret/', 'src/'] }, 'build_forbidden_paths_mismatch'),
      'Q-2. 範囲の拡大（追加・上位 directory）・縮小・file と directory の違い・forbidden の欠落 / 追加は不一致として拒否');
    assert(['../x', 'C:/x', '/abs', 'docs\\a', '*.md', 'docs/**', '~/x', '', 'docs/./a'].every(function (p) { return rej({ allowedPaths: [p] }, 'build_allowed_paths_invalid'); })
      && rej({ allowedPaths: [] }, 'build_allowed_paths_invalid') && rej({ allowedPaths: 'docs/' }, 'build_allowed_paths_invalid') && rej({ forbiddenPaths: ['..'] }, 'build_forbidden_paths_invalid')
      && rej({ worktreeRoot: WT4('task-other') }, 'build_worktree_root_mismatch') && rej({ mainRepoRoot: 'C:\\Users\\hp\\ENBISOU_AI\\other' }, 'build_main_repo_root_mismatch')
      && R(runQ(TASKQ), { worktreeRoot: WT4('TASK-Q'), mainRepoRoot: REPO }).ok && rej({ settingsOverride: {} }, 'build_unknown_keys') && rej(null, 'build_missing'),
      'Q-3. 判定不能な path（.. ・絶対・backslash・ワイルドカード・~・空）・型不正・worktree / main repo の不一致・未知 key は拒否（同じ場所は可）');
    assert(rej({}, 'allowed_covers_protected', { title: 't', goal: 'g', allowedPaths: ['data/'], forbiddenPaths: [] }) && rej({}, 'allowed_covers_protected', { title: 't', goal: 'g', allowedPaths: ['cost-logs.json'], forbiddenPaths: [] })
      && rej({}, 'allowed_within_forbidden', { title: 't', goal: 'g', allowedPaths: ['docs/a/'], forbiddenPaths: ['docs/'] }) && rej({}, 'allowed_sensitive_path', { title: 't', goal: 'g', allowedPaths: ['.git/'], forbiddenPaths: [] })
      && rej({}, 'run_allowed_paths_invalid', { title: 't', goal: 'g', allowedPaths: ['../x'], forbiddenPaths: [] })
      && R(runQ({ title: 't', goal: 'g', allowedPaths: ['tools/'], forbiddenPaths: ['tools/x.js'] }), {}).ok, 'Q-4. 保存済み run.task 自体の競合（Protected を含む・forbidden の内側・.git・不正）は拒否（forbidden による部分除外は可）');
    // 統合：一致なら起動し、settings / prompt は run.task の範囲を使う。拡大・不一致は起動 0 回・予約なし・記録不変
    const sq = setupRun('task-s4-060', { task: TASKQ }); let cq;
    const spq = fakeSpawn({ run: function (ch, sid) { cq.transcript = goodTranscript(sid, 'task-s4-060', false); finish(ch, sid); } });
    const bad = [
      ['build_allowed_paths_expanded', { allowedPaths: ['docs/', 'src/lib/', 'data/'], forbiddenPaths: ['docs/secret/'] }],
      ['build_allowed_paths_mismatch', { allowedPaths: ['docs/'], forbiddenPaths: ['docs/secret/'] }],
      ['build_forbidden_paths_mismatch', { allowedPaths: ['docs/', 'src/lib/'], forbiddenPaths: [] }],
      ['build_worktree_root_mismatch', { worktreeRoot: WT4('task-other') }],
    ];
    const beforeQ = runFile(sq);
    const outsQ = [];
    for (const k of bad) { const cx = ctxFor(sq, spq); delete cx.build.allowedPaths; delete cx.build.forbiddenPaths; Object.assign(cx.build, k[1]); outsQ.push(await ex.runInvocation(cx)); }
    assert(outsQ.every(function (o, i) { return !o.ok && o.phase === 'preflight' && o.error === 'execution_scope_invalid' && o.reasons.indexOf(bad[i][0]) !== -1; })
      && spq.calls.length === 0 && runFile(sq) === beforeQ && rs.readRun(sq.st, sq.T).run.invocations.length === 0, 'Q-5. 範囲の拡大・不一致・場所の不一致は予約・spawn の前に拒否（起動 0 回・予約なし・記録不変）');
    cq = ctxFor(sq, spq); cq.build.allowedPaths = ['SRC/lib/', 'docs/']; cq.build.forbiddenPaths = ['docs/secret/'];
    const okQ = await ex.runInvocation(cq);
    const sent = spq.calls[0] ? spq.calls[0].child.stdinText.replace(/\s+/g, '') : '';   // prompt 内の JSON は整形出力のため空白を除いて比較
    const argv = spq.calls[0] ? spq.calls[0].args.join(' ') : '';
    assert(okQ.ok && spq.calls.length === 1 && sent.indexOf('"allowedPaths":["docs/","src/lib/"]') !== -1 && sent.indexOf('"forbiddenPaths":["docs/secret/"]') !== -1 && sent.indexOf('SRC/lib/') === -1
      && argv.indexOf('docs/secret') !== -1, 'Q-6. 意味が同じ範囲なら起動し、prompt / settings（args）には正規化した run.task の範囲だけを使う');
  }

  caseHeader('Y. 例外経路（結果は必ず 1 回返す・保存失敗と区別・started と lock を残す）');
  {
    const within = (pr, ms) => Promise.race([pr, new Promise(function (r) { setTimeout(function () { r({ ok: false, error: 'TEST_TIMEOUT' }); }, ms); })]);
    const slowHb = { timeoutMs: 400, heartbeatMs: 10000, killWaitMs: 60, drainWaitMs: 60, stdoutMax: 256 * 1024, stderrMax: 1024 };
    // (a) 観測・解析中の例外（完了時刻の取得で例外）
    const sa = setupRun('task-s4-050'); const fa = { on: false }; let ca;
    const spa = fakeSpawn({ run: function (ch, sid) { ca.transcript = goodTranscript(sid, 'task-s4-050', false); fa.on = true; finish(ch, sid); } });
    ca = ctxFor(sa, spa, { limits: slowHb, clock: function () { if (fa.on) throw new Error('clock'); return new Date().toISOString(); } });
    const ra = await within(ex.runInvocation(ca), 3000);
    fa.on = false;
    // (b) 完了処理中の例外（保存処理の呼び出しで例外）
    const sb = setupRun('task-s4-051'); const fb = { on: false }; let cb;
    const storeB = { runtimeRoot: RT, repoPath: REPO, get fs() { if (fb.on) throw new Error('store'); return sb.mf; } };
    const spb = fakeSpawn({ run: function (ch, sid) { cb.transcript = goodTranscript(sid, 'task-s4-051', false); fb.on = true; finish(ch, sid); } });
    cb = ctxFor(Object.assign({}, sb, { st: storeB }), spb, { limits: slowHb });
    const rb = await within(ex.runInvocation(cb), 3000);
    fb.on = false;
    // (c) heartbeat 処理中の例外
    const sc = setupRun('task-s4-052'); const fc = { on: false };
    const storeC = { runtimeRoot: RT, repoPath: REPO, get fs() { if (fc.on) throw new Error('store'); return sc.mf; } };
    const spc = fakeSpawn({ run: function () { fc.on = true; }, onKill: function (ch) { ch.emit('exit', null, 'SIGKILL'); ch.emit('close', null, 'SIGKILL'); } });
    const rc_ = await within(ex.runInvocation(ctxFor(Object.assign({}, sc, { st: storeC }), spc)), 3000);
    fc.on = false;
    // (d) 監視（イベント処理）中の例外
    const sd = setupRun('task-s4-053');
    const spd = fakeSpawn({ run: function (ch) { ch.stdout.emit('data', null); }, onKill: function (ch) { ch.emit('exit', null, 'SIGKILL'); ch.emit('close', null, 'SIGKILL'); } });
    const rd = await within(ex.runInvocation(ctxFor(sd, spd)), 3000);
    const left = (s) => { const r = rs.readRun(s.st, s.T).run; return r.invocations.length === 1 && r.invocations[0].state === 'started' && r.lock && r.lock.ownerId === A; };
    assert([ra, rb, rc_, rd].every(function (r) { return r && r.error !== 'TEST_TIMEOUT'; }), 'Y-1. 例外経路でも Promise は必ず解決する（未解決なし）');
    assert(!ra.ok && ra.phase === 'observe' && ra.error === 'observation_failed' && left(sa)
      && !rb.ok && rb.phase === 'complete' && rb.error === 'complete_internal_error' && left(sb)
      && !rc_.ok && rc_.phase === 'heartbeat' && rc_.error === 'heartbeat_internal_error' && spc.calls[0].child.killedWith === 'SIGKILL' && left(sc)
      && !rd.ok && rd.phase === 'monitor' && rd.error === 'monitor_internal_error' && spd.calls[0].child.killedWith === 'SIGKILL' && left(sd),
      'Y-2. 観測・完了処理・heartbeat・監視の例外を保存失敗（complete_save_failed）と区別し、started と lock を残して停止（自動再開しない）');
    assert([ra, rb, rc_, rd].every(function (r) { return r.recordLeft === 'started' && r.lockLeft === true; }) && [spa, spb, spc, spd].every(function (x) { return x.calls.length === 1; }),
      'Y-3. 例外後も自動 retry しない（起動は各 1 回）');
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
  console.log('🟢 All Development Autopilot Stage 4C S1-S5 cases passed');
})();
