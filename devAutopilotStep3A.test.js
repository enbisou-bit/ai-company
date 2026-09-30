'use strict';
// devAutopilotStep3A.test.js
// Development Autopilot V1 — Step 3A（Pure Git Isolation Contract / worktreeController）の deterministic テスト。
//
//   ★ 実行は必ずこのファイル名を明示指定する（node devAutopilotStep3A.test.js）。
//   ★ 純関数 test のみ。Git 実行・child_process・fs write（OS temp を含む）・network・DB・provider は冒頭で fail-closed に封鎖する。
//   ★ process.env は変更しない（buildChildEnv は fixture の env object だけで検証する）。
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
function isEnvFile(p) { try { return /^\.env(\..*)?$/.test(path.basename(String(p))); } catch (e) { return false; } }
['readFileSync', 'readFile', 'existsSync', 'statSync', 'createReadStream'].forEach(function (n) {
  const orig = fs[n]; if (typeof orig !== 'function') return;
  fs[n] = function (p) { if (isEnvFile(p)) { violations.push('env_file_read:' + n); throw new Error('SANDBOX_BLOCKED_ENV_READ'); } return orig.apply(this, arguments); };
});
// fs write は全面禁止（OS temp も作らない）
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
['writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'mkdtemp', 'rm', 'rmdir', 'copyFile', 'truncate'].forEach(function (n) { if (typeof fs.promises[n] === 'function') fs.promises[n] = blockedWrite('fs.promises.' + n); });
const BLOCKED_BARE = new Set(['axios', 'dotenv', '@supabase/supabase-js', '@anthropic-ai/sdk', 'http2', 'undici', 'child_process', 'node:http2', 'node:child_process']);
const BLOCKED_FILES = new Set(['openaiClient.js', 'claudeClient.js', 'costTracker.js', 'lib/costDb.js', 'conversationHistory.js', 'server.js', 'lib/supabase.js', 'lib/outputDraftsDb.js']
  .map(function (p) { return path.join(ROOT, p); }));
const CONTROLLER_FILE = path.join(ROOT, 'tools', 'devAutopilot', 'worktreeController.js');
const controllerRequests = [];
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (parent && parent.filename === CONTROLLER_FILE) controllerRequests.push(request);
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
function has(res, reason) { return !!res && Array.isArray(res.reasons) && res.reasons.some(function (r) { return r === reason || r.indexOf(reason) === 0; }); }

const wc = require('./tools/devAutopilot/worktreeController');
const rs = require('./tools/devAutopilot/runStore');

// ── fixture（Windows path は文字列 fixture。実 filesystem は参照しない）──
const REPO = 'C:\\Users\\hp\\ENBISOU_AI\\ai-company';
const WT_ROOT = 'C:\\Users\\hp\\ENBISOU_AI\\.autopilot\\wt';
const TASK = 'task-001';
const WT = WT_ROOT + '\\' + TASK;
const HEAD = 'fe391a1c0c7d4cd39c425f8289c5270fa10a5da5';
const ORIGIN = '961aaf81b5eb6eb5a7af1f7997cd3772d4351d70';
const OTHER = '1111111111111111111111111111111111111111';
const FP = 'd1fd4bd36f69';
const STATUS = 'de31f7fdb243';
const T0 = Date.parse('2026-09-28T00:00:00.000Z');
function at(min) { return new Date(T0 + min * 60000).toISOString(); }

const PORCELAIN_MAIN = 'worktree C:/Users/hp/ENBISOU_AI/ai-company\nHEAD ' + HEAD + '\nbranch refs/heads/main\n\n';
const PORCELAIN_CREATED = PORCELAIN_MAIN + 'worktree C:/Users/hp/ENBISOU_AI/.autopilot/wt/task-001\nHEAD ' + HEAD + '\nbranch refs/heads/dev/task-001\n\n';

function makeRun(stageTarget, extra) {
  const init = rs.createInitialRun(Object.assign({
    taskId: TASK,
    task: { title: 'sample', goal: 'add helper', allowedPaths: ['tools/devAutopilot/'], forbiddenPaths: [] },
    mainRepoPath: REPO, baseHead: HEAD, branch: 'dev/' + TASK, worktreePath: WT,
    budget: { capUsd: 5, maxInvocations: 6 }, mainStatusHashAtStart: STATUS,
    protectedMd5AtStart: Object.assign({}, PROTECTED_BASELINE), now: at(0),
  }, extra || {}));
  if (!init.ok) throw new Error('fixture run invalid: ' + JSON.stringify(init));
  let r = init.run, m = 1;
  if (stageTarget === null) return r;
  // S5：research の前に隔離 worktree を確定する
  const iso = rs.markIsolationVerified(r, { now: at(0), worktreeHead: r.baseHead });
  if (!iso.ok) throw new Error('isolate failed: ' + iso.error);
  r = iso.run;
  const order = ['researching', 'designing', 'implementing', 'testing', 'reviewing'];
  for (const s of order) {
    const x = rs.transitionStage(r, s, { now: at(m++) });
    if (!x.ok) throw new Error('advance failed: ' + x.error);
    r = x.run;
    if (s === stageTarget) break;
  }
  return r;
}
function goodPreflightSnapshot(extra) {
  return Object.assign({
    currentBranch: 'main', stagedCount: 0, currentHead: HEAD, originMain: ORIGIN, originIsAncestor: true,
    protectedFingerprint: FP, mainStatusHash: STATUS,
    existingBranchRefs: ['refs/heads/main'], targetBranchExists: false, targetWorktreeExists: false,
    pathCollision: false, pathHasLinkOrJunction: false, activeHooks: false,
    worktreeListPorcelain: PORCELAIN_MAIN, maxTrackedPathLength: 67,
  }, extra || {});
}
function goodExpected(extra) {
  return Object.assign({ taskId: TASK, repoPath: REPO, worktreeRoot: WT_ROOT, baseHead: HEAD, protectedFingerprint: FP, mainStatusHash: STATUS, run: makeRun(null) }, extra || {});
}
function goodCreatedSnapshot(extra) {
  return Object.assign({
    worktreeHead: HEAD, worktreeBranchRef: 'refs/heads/dev/task-001', worktreeStatusCount: 0,
    worktreeGitCommonDir: 'C:/Users/hp/ENBISOU_AI/ai-company/.git', mainGitCommonDir: 'C:\\Users\\hp\\ENBISOU_AI\\ai-company\\.git',
    worktreeListPorcelain: PORCELAIN_CREATED, worktreeEnvFiles: [], worktreeProtectedChanged: false,
    mainHeadBefore: HEAD, mainHeadAfter: HEAD, mainStatusHashBefore: STATUS, mainStatusHashAfter: STATUS,
    mainProtectedFingerprintBefore: FP, mainProtectedFingerprintAfter: FP,
  }, extra || {});
}
function goodResumeSnapshot(extra) {
  return Object.assign({
    worktreeExists: true, branchExists: true, worktreeHead: HEAD, branchTip: HEAD,
    worktreeGitCommonDir: 'C:/Users/hp/ENBISOU_AI/ai-company/.git', mainGitCommonDir: 'C:\\Users\\hp\\ENBISOU_AI\\ai-company\\.git',
    worktreeListPorcelain: PORCELAIN_CREATED, mainStatusHash: STATUS, mainProtectedMd5: Object.assign({}, PROTECTED_BASELINE),
    worktreeEnvFiles: [], diffAllowed: true, worktreeProtectedChanged: false,
  }, extra || {});
}

(function main() {
  caseHeader('S. Controller の静的境界（Git 実行なし・child_process なし・fs なし・process.env なし）');
  {
    const src = fs.readFileSync(CONTROLLER_FILE, 'utf8');
    const code = src.replace(/\/\/.*$/gm, '');
    const reqs = (code.match(/require\(\s*['"][^'"]+['"]\s*\)/g) || []).map(function (s) { return s.replace(/require\(\s*['"]|['"]\s*\)/g, ''); });
    assert(reqs.length === 1 && reqs[0] === 'path', 'S-1. require は path のみ（' + reqs.join(',') + '）');
    assert(controllerRequests.length === 1 && controllerRequests[0] === 'path', 'S-2. load 時に実際に読み込んだ module も path のみ');
    assert(!/child_process|execFile|execSync|spawn|\bexec\s*\(|\bfork\s*\(/.test(code), 'S-3. child_process / exec / spawn の参照 0');
    assert(!/process\.env|\bfetch\s*\(|https?\.|net\.|writeFile|appendFile|mkdir|rmSync|unlink|rename/.test(code), 'S-4. process.env / network / fs write の参照 0');
    assert(!/\bfs\b/.test(code), 'S-5. fs を参照しない');
  }

  caseHeader('B. Branch Contract');
  {
    const b = wc.deriveBranchName('task-001');
    assert(b.ok && b.branch === 'dev/task-001' && b.ref === 'refs/heads/dev/task-001', 'B-1. valid taskId → dev/task-001');
    assert(!wc.deriveBranchName('Task-001').ok, 'B-2. uppercase 拒否');
    assert(!wc.deriveBranchName('task_001').ok, 'B-3. underscore 拒否');
    assert(!wc.deriveBranchName('task.001').ok && !wc.deriveBranchName('task.lock').ok, 'B-4. dot（.lock を含む）拒否');
    assert(!wc.deriveBranchName('../main').ok && !wc.deriveBranchName('a/b').ok && !wc.deriveBranchName('..').ok, 'B-5. traversal / slash 拒否');
    assert(!wc.deriveBranchName('task 001').ok && !wc.deriveBranchName('task\n001').ok && !wc.deriveBranchName('task\u0000x').ok, 'B-5b. whitespace / control char 拒否');
    assert(!wc.deriveBranchName('-task').ok && !wc.deriveBranchName('ab').ok && !wc.deriveBranchName('a'.repeat(42)).ok && wc.deriveBranchName('a'.repeat(41)).ok, 'B-5c. 先頭 - / 短すぎ / 長すぎ拒否（最大 41 文字）');
    assert(!wc.deriveBranchName(null).ok && !wc.deriveBranchName(123).ok, 'B-5d. 非文字列拒否');
    const cc = wc.checkBranchCollision('dev/task-001', ['refs/heads/main', 'refs/heads/dev/Task-001']);
    assert(!cc.ok && has(cc, 'branch_case_collision'), 'B-6. dev/Task-001 と case-insensitive collision');
    const df = wc.checkBranchCollision('dev/task-001', ['refs/heads/main', 'refs/heads/dev']);
    assert(!df.ok && has(df, 'branch_df_conflict:dev'), 'B-7. branch `dev` との D/F conflict');
    const df2 = wc.checkBranchCollision('dev/task-001', ['dev/task-001/x']);
    assert(!df2.ok && has(df2, 'branch_df_conflict'), 'B-7b. dev/task-001/x との D/F conflict');
    const dup = wc.checkBranchCollision('dev/task-001', ['main', 'dev/task-001']);
    assert(!dup.ok && has(dup, 'branch_exists'), 'B-8. 同名 branch → collision');
    assert(wc.checkBranchCollision('dev/task-001', ['refs/heads/main', 'refs/heads/dev/task-002']).ok, 'B-8b. 無関係な branch のみなら OK');
    assert(!wc.checkBranchCollision('dev/task-001', 'main').ok && !wc.checkBranchCollision('dev/task-001', [null]).ok, 'B-8c. existingRefs 不正 → fail-closed');
    assert(!wc.checkBranchCollision('feature/x', []).ok && !wc.checkBranchCollision('dev/Task', []).ok, 'B-8d. dev/<safe taskId> 以外の branch は不正');
  }

  caseHeader('P. Worktree Path Contract');
  {
    const p = wc.deriveWorktreePath(WT_ROOT, TASK, REPO);
    assert(p.ok && p.worktreePath === WT, 'P-9. valid Windows absolute path → ' + (p.worktreePath || p.error));
    const inRepo = wc.deriveWorktreePath(REPO + '\\.autopilot\\wt', TASK, REPO);
    assert(!inRepo.ok && inRepo.errors.indexOf('inside_repo') !== -1, 'P-10. repo 内部の root 拒否');
    const repoInRoot = wc.deriveWorktreePath('C:\\Users\\hp', TASK, REPO);
    assert(!repoInRoot.ok && repoInRoot.errors.indexOf('repo_inside_root') !== -1, 'P-10b. root が repo を内包 → 拒否');
    const drv = wc.deriveWorktreePath('D:\\autopilot\\wt', TASK, REPO);
    assert(!drv.ok && drv.errors.indexOf('different_drive') !== -1, 'P-11. 別 drive 拒否');
    const trav = wc.deriveWorktreePath('C:\\Users\\hp\\ENBISOU_AI\\.autopilot\\..\\ai-company\\wt', TASK, REPO);
    assert(!trav.ok && trav.errors.some(function (e) { return /traversal/.test(e); }), 'P-12. `..` traversal 拒否');
    assert(!wc.deriveWorktreePath('C:\\Users\\.\\hp\\wt', TASK, REPO).ok, 'P-12b. `.` segment 拒否');
    assert(!wc.deriveWorktreePath(WT_ROOT, '../x', REPO).ok, 'P-12c. taskId 経由の escape 拒否');
    const rsv = wc.deriveWorktreePath('C:\\Users\\hp\\NUL\\wt', TASK, REPO);
    assert(!rsv.ok && rsv.errors.some(function (e) { return /reserved_name/.test(e); }), 'P-13. reserved name（NUL）拒否');
    assert(!wc.deriveWorktreePath('C:\\Users\\hp\\com1.txt\\wt', TASK, REPO).ok && !wc.deriveWorktreePath('C:\\Users\\hp\\Con\\wt', TASK, REPO).ok, 'P-13b. reserved name（拡張子付き・大小文字違い）拒否');
    const ctl = wc.deriveWorktreePath('C:\\Users\\hp\\a\u0001b\\wt', TASK, REPO);
    assert(!ctl.ok && ctl.errors.some(function (e) { return /control_char/.test(e); }), 'P-14. control char 拒否');
    const ci = wc.deriveWorktreePath('c:\\USERS\\HP\\enbisou_ai\\AI-COMPANY\\wt', TASK, REPO);
    assert(!ci.ok && ci.errors.indexOf('inside_repo') !== -1, 'P-15. 大文字小文字違いでも repo 内部を検出');
    assert(!wc.deriveWorktreePath('\\\\server\\share\\wt', TASK, REPO).ok && !wc.deriveWorktreePath('\\\\?\\C:\\wt', TASK, REPO).ok, 'P-15b. UNC / device path 拒否');
    assert(!wc.deriveWorktreePath('wt\\rel', TASK, REPO).ok && !wc.deriveWorktreePath('C:wt', TASK, REPO).ok, 'P-15c. 相対 / drive 相対 path 拒否');
    assert(!wc.deriveWorktreePath('C:\\Users\\hp\\a<b\\wt', TASK, REPO).ok && !wc.deriveWorktreePath('C:\\Users\\hp\\a:b\\wt', TASK, REPO).ok && !wc.deriveWorktreePath('C:\\Users\\hp\\ab.\\wt', TASK, REPO).ok, 'P-15d. Windows 禁止文字・末尾 dot 拒否');
    const sn = wc.deriveWorktreePath('C:\\Users\\hp\\ENBISO~1\\ai-company\\wt', TASK, REPO);
    assert(!sn.ok && sn.errors.some(function (e) { return /short_name_alias/.test(e); }), 'P-15e. 8.3 短縮名（別名で repo を指し得る）拒否');
    const longRoot = 'C:\\' + 'a'.repeat(140);
    const lg = wc.deriveWorktreePath(longRoot, TASK, REPO);
    assert(!lg.ok && lg.errors.indexOf('worktree_path_too_long') !== -1, 'P-15f. path 長上限超過を拒否');
    const mx = wc.deriveWorktreePath(WT_ROOT, TASK, REPO, { maxTrackedPathLength: 220 });
    assert(!mx.ok && mx.errors.indexOf('tracked_path_would_exceed_max_path') !== -1, 'P-15g. worktree path + 最長 tracked path が MAX_PATH を超える → 拒否');
    assert(wc.samePath('C:/Users/HP/x/', 'c:\\users\\hp\\x') && !wc.samePath('C:\\a', 'D:\\a') && !wc.samePath('C:\\a\\..\\b', 'C:\\b'), 'P-15h. samePath は case / 区切り文字を正規化し、traversal を含む path は不一致');
  }

  caseHeader('F. Preflight（snapshot 判定のみ）');
  {
    const ok = wc.validateIsolationPreflight(goodPreflightSnapshot(), goodExpected());
    assert(ok.result === 'pass' && ok.reasons.length === 0, 'F-16. 正常 → pass（' + ok.reasons.join(',') + '）');
    assert(ok.plan && ok.plan.branch === 'dev/task-001' && ok.plan.worktreePath === WT && ok.plan.baseHead === HEAD && ok.plan.originMainAtStart === ORIGIN, 'F-16b. plan に branch / path / baseHead / originMainAtStart を含む');
    assert(ok.plan.command && ok.plan.command.ok && ok.plan.command.args[ok.plan.command.args.length - 1] === HEAD, 'F-16c. pass 時のみ create command を含む');
    assert(ORIGIN !== HEAD && ok.result === 'pass', 'F-16d. origin/main ≠ HEAD（local stack）でも ancestor なら pass');
    function blockedBy(snap, exp, reason) { const r = wc.validateIsolationPreflight(snap, exp || goodExpected()); return r.result === 'blocked' && has(r, reason) && !r.plan; }
    assert(blockedBy(goodPreflightSnapshot({ currentBranch: 'feature' }), null, 'not_on_main'), 'F-17. main 以外 → blocked');
    assert(blockedBy(goodPreflightSnapshot({ stagedCount: 1 }), null, 'staged_not_empty'), 'F-18. staged ≠ 0 → blocked');
    assert(blockedBy(goodPreflightSnapshot({ currentHead: OTHER }), null, 'head_mismatch'), 'F-19. HEAD ≠ baseHead → blocked');
    assert(blockedBy(goodPreflightSnapshot({ originIsAncestor: false }), null, 'origin_not_ancestor'), 'F-20. origin/main が ancestor でない → blocked');
    assert(blockedBy(goodPreflightSnapshot({ protectedFingerprint: 'ffffffffffff' }), null, 'protected_mismatch'), 'F-21. Protected fingerprint 不一致 → blocked');
    assert(blockedBy(goodPreflightSnapshot({ mainStatusHash: 'ffffffffffff' }), null, 'main_status_hash_mismatch'), 'F-22. status hash 不一致 → blocked');
    assert(blockedBy(goodPreflightSnapshot({ targetBranchExists: true }), null, 'target_branch_exists'), 'F-23. target branch 既存 → blocked');
    assert(blockedBy(goodPreflightSnapshot({ existingBranchRefs: ['refs/heads/main', 'refs/heads/DEV/task-001'] }), null, 'branch_case_collision'), 'F-23b. refs 一覧に case 違い branch → blocked');
    assert(blockedBy(goodPreflightSnapshot({ targetWorktreeExists: true }), null, 'target_worktree_exists'), 'F-24. target worktree directory 既存 → blocked');
    assert(blockedBy(goodPreflightSnapshot({ worktreeListPorcelain: PORCELAIN_CREATED }), null, 'worktree_already_registered'), 'F-24b. 同 path が worktree 登録済み → blocked');
    assert(blockedBy(goodPreflightSnapshot({ pathCollision: true }), null, 'path_collision'), 'F-24c. pathCollision → blocked');
    assert(blockedBy(goodPreflightSnapshot({ pathHasLinkOrJunction: true }), null, 'path_link_or_junction'), 'F-24d. symlink / junction → blocked');
    assert(blockedBy(goodPreflightSnapshot({ activeHooks: true }), null, 'active_hooks'), 'F-25. active hook → blocked');
    assert(blockedBy(goodPreflightSnapshot({ originIsAncestor: undefined }), null, 'snapshot_invalid:originIsAncestor'), 'F-26. 不明値（undefined）→ blocked');
    assert(blockedBy(goodPreflightSnapshot({ stagedCount: '0' }), null, 'snapshot_invalid:stagedCount') && blockedBy(goodPreflightSnapshot({ activeHooks: 'false' }), null, 'snapshot_invalid:activeHooks'), 'F-26b. 型違い（文字列）→ blocked');
    assert(wc.validateIsolationPreflight(null, goodExpected()).result === 'blocked' && wc.validateIsolationPreflight(goodPreflightSnapshot(), null).result === 'blocked', 'F-26c. snapshot / expected 欠落 → blocked');
    assert(blockedBy(goodPreflightSnapshot({ worktreeListPorcelain: 'garbage' }), null, 'worktree_list_malformed'), 'F-26d. worktree list 不正 → blocked');
    assert(blockedBy(goodPreflightSnapshot(), goodExpected({ baseHead: 'HEAD' }), 'expected_base_head_invalid'), 'F-26e. baseHead が SHA でない（暗黙 HEAD）→ blocked');
    assert(blockedBy(goodPreflightSnapshot(), goodExpected({ run: undefined }), 'run_missing'), 'F-26f. run 欠落 → blocked');
    const isoOnly = rs.markIsolationVerified(makeRun(null), { now: at(0), worktreeHead: HEAD }).run;
    assert(['researching', 'designing', 'implementing'].every(function (s) { return blockedBy(goodPreflightSnapshot(), goodExpected({ run: makeRun(s) }), 'run_state_not_ready_for_worktree'); })
      && blockedBy(goodPreflightSnapshot(), goodExpected({ run: isoOnly }), 'run_state_not_ready_for_worktree'), 'F-26g. stage 未開始・隔離未確定の run 以外（research 以降・隔離確定済み）→ blocked（S5）');
    assert(blockedBy(goodPreflightSnapshot(), goodExpected({ run: makeRun(null, { baseHead: ORIGIN }) }), 'run_base_head_mismatch'), 'F-26h. run.baseHead 不一致 → blocked');
    assert(blockedBy(goodPreflightSnapshot(), goodExpected({ worktreeRoot: REPO + '\\wt' }), 'worktree_path:'), 'F-26i. root が repo 内 → blocked');
    const mainMis = 'worktree C:/elsewhere/repo\nHEAD ' + HEAD + '\nbranch refs/heads/main\n';
    assert(blockedBy(goodPreflightSnapshot({ worktreeListPorcelain: mainMis }), null, 'main_worktree_mismatch'), 'F-26j. main worktree の path 不一致 → blocked');
    assert(blockedBy(goodPreflightSnapshot({ maxTrackedPathLength: undefined }), null, 'snapshot_invalid:maxTrackedPathLength'), 'F-26k. 最長 tracked path 長不明 → blocked');
  }

  caseHeader('C. Create Command Builder（argv のみ・実行しない）');
  {
    const c = wc.buildWorktreeCreateCommand({ repoPath: REPO, worktreeRoot: WT_ROOT, taskId: TASK, baseHead: HEAD });
    const expected = ['-C', REPO, 'worktree', 'add', '-b', 'dev/task-001', WT, HEAD];
    assert(c.ok && c.file === 'git' && JSON.stringify(c.args) === JSON.stringify(expected) && JSON.stringify(c.argv) === JSON.stringify(['git'].concat(expected)), 'C-27. argv が正確に一致');
    assert(c.args[c.args.length - 1] === HEAD && !wc.buildWorktreeCreateCommand({ repoPath: REPO, worktreeRoot: WT_ROOT, taskId: TASK }).ok
      && !wc.buildWorktreeCreateCommand({ repoPath: REPO, worktreeRoot: WT_ROOT, taskId: TASK, baseHead: 'HEAD' }).ok
      && !wc.buildWorktreeCreateCommand({ repoPath: REPO, worktreeRoot: WT_ROOT, taskId: TASK, baseHead: 'main' }).ok, 'C-28. 明示 40桁 SHA 必須（省略・HEAD・branch 名は拒否）');
    assert(!c.args.some(function (a) { return /^--?(f|force)$/.test(a) || /force/i.test(a); }), 'C-29. force 系 flag なし');
    assert(!c.args.some(function (a) { return /fetch|pull|remote|--track|--guess-remote/.test(a); }), 'C-30. fetch / remote 系なし');
    assert(c.shell === false && Array.isArray(c.argv) && c.argv.every(function (a) { return typeof a === 'string'; }) && typeof c.command === 'undefined', 'C-31. shell string を返さない（argv 配列が正本）');
    const inj = wc.buildWorktreeCreateCommand({ repoPath: REPO, worktreeRoot: WT_ROOT, taskId: TASK, baseHead: HEAD, extraArgs: ['--force'] });
    const inj2 = wc.buildWorktreeCreateCommand({ repoPath: REPO, worktreeRoot: WT_ROOT, taskId: TASK, baseHead: HEAD, branch: 'main' });
    assert(!inj.ok && inj.error === 'unexpected_input_keys' && !inj2.ok, 'C-31b. 未知 key（extraArgs / branch 直接指定）で flag 混入不可');
    assert(!wc.buildWorktreeCreateCommand({ repoPath: REPO, worktreeRoot: WT_ROOT, taskId: '--force', baseHead: HEAD }).ok, 'C-31c. taskId 経由の flag 混入不可');
    assert(Object.isFrozen(c) && Object.isFrozen(c.args), 'C-31d. 返り値は frozen（後から改変不可）');
    assert(c.args.indexOf('-b') === 4 && c.args[5].indexOf('dev/') === 0, 'C-31e. 暗黙 branch なし（-b dev/<taskId> を明示）');
  }

  caseHeader('W. worktree list --porcelain parser');
  {
    const one = wc.parseWorktreeListPorcelain(PORCELAIN_MAIN);
    assert(one.ok && one.worktrees.length === 1 && one.worktrees[0].head === HEAD && one.worktrees[0].branch === 'refs/heads/main' && !one.worktrees[0].detached, 'W-32. 通常 porcelain');
    const multi = wc.parseWorktreeListPorcelain(PORCELAIN_CREATED.replace(/\n/g, '\r\n'));
    assert(multi.ok && multi.worktrees.length === 2 && multi.worktrees[1].branch === 'refs/heads/dev/task-001', 'W-33. 複数 worktree（CRLF 含む）');
    const det = wc.parseWorktreeListPorcelain(PORCELAIN_MAIN + 'worktree C:/x/y\nHEAD ' + OTHER + '\ndetached\nlocked reason here\nprunable gitdir file points to non-existent location\n');
    assert(det.ok && det.worktrees[1].detached && !det.worktrees[1].branch && det.worktrees[1].locked && det.worktrees[1].prunable && det.worktrees[1].lockedReason === 'reason here', 'W-34. detached / locked / prunable');
    const bad = [
      '', 'garbage', 'HEAD ' + HEAD + '\n', 'worktree C:/a\nHEAD zzz\nbranch refs/heads/main\n',
      'worktree C:/a\nHEAD ' + HEAD + '\n', 'worktree C:/a\nHEAD ' + HEAD + '\nbranch refs/heads/main\ndetached\n',
      'worktree C:/a\nHEAD ' + HEAD + '\nbranch refs/heads/main\nbranch refs/heads/x\n', 'worktree C:/a\nHEAD ' + HEAD + '\nbranch refs/heads/main\nfoo bar\n',
      'worktree C:/a\nHEAD ' + HEAD + '\nbranch refs/heads/main\nworktree C:/b\nHEAD ' + HEAD + '\ndetached\n', null,
    ];
    assert(bad.every(function (t) { return wc.parseWorktreeListPorcelain(t).ok === false; }), 'W-35. malformed（空・属性のみ・HEAD 不正/欠落・branch と detached 併存・重複・未知属性・区切り欠落・非文字列）→ fail-closed');
  }

  caseHeader('V. Created Worktree Validation');
  {
    const run = makeRun(null);   // S5：作成直後の run は stage 未開始（隔離の確定前）
    const v = wc.validateCreatedWorktree(goodCreatedSnapshot(), run);
    assert(v.result === 'valid' && v.reasons.length === 0, 'V-36. 正常な作成直後の状態 → valid（' + v.reasons.join(',') + '）');
    function blockedBy(extra, reason) { const r = wc.validateCreatedWorktree(goodCreatedSnapshot(extra), run); return r.result === 'blocked' && has(r, reason); }
    assert(blockedBy({ worktreeHead: OTHER }, 'worktree_head_mismatch'), 'V-37. worktree HEAD ≠ baseHead → blocked');
    assert(blockedBy({ worktreeBranchRef: 'refs/heads/main' }, 'worktree_branch_mismatch'), 'V-38. branch 違い → blocked');
    assert(blockedBy({ worktreeStatusCount: 2 }, 'worktree_dirty'), 'V-39. dirty → blocked');
    assert(blockedBy({ worktreeGitCommonDir: 'C:\\other\\.git' }, 'common_git_dir_mismatch'), 'V-40. common git dir 不一致 → blocked');
    assert(blockedBy({ worktreeListPorcelain: PORCELAIN_MAIN }, 'worktree_not_registered'), 'V-41. 未登録 → blocked');
    assert(blockedBy({ worktreeEnvFiles: ['.env.local'] }, 'env_file_present'), 'V-42. .env が存在 → blocked');
    assert(blockedBy({ mainStatusHashAfter: 'ffffffffffff' }, 'main_status_changed') && blockedBy({ mainHeadAfter: OTHER }, 'main_head_changed'), 'V-43. main の status / HEAD 変化 → blocked');
    assert(blockedBy({ mainProtectedFingerprintAfter: 'ffffffffffff' }, 'main_protected_changed') && blockedBy({ worktreeProtectedChanged: true }, 'worktree_protected_changed'), 'V-44. main Protected 変化 / worktree Protected 変更 → blocked');
    assert(blockedBy({ worktreeProtectedChanged: undefined }, 'snapshot_invalid') && wc.validateCreatedWorktree(null, run).result === 'blocked', 'V-44b. 不明値 → blocked');
    const locked = PORCELAIN_MAIN + 'worktree C:/Users/hp/ENBISOU_AI/.autopilot/wt/task-001\nHEAD ' + HEAD + '\nbranch refs/heads/dev/task-001\nlocked\n';
    assert(blockedBy({ worktreeListPorcelain: locked }, 'registered_worktree_mismatch'), 'V-44c. 登録 worktree が locked → blocked');
    assert(wc.validateCreatedWorktree(goodCreatedSnapshot(), Object.assign({}, run, { branch: 'dev/other' })).result === 'blocked', 'V-44d. run.branch が taskId から導出した branch と不一致 → blocked');
  }

  caseHeader('E. Child Env（allowlist・deny 優先・case-insensitive）');
  {
    const parent = {
      Path: 'C:\\Windows\\system32', PATHEXT: '.COM;.EXE', SystemRoot: 'C:\\Windows', windir: 'C:\\Windows', ComSpec: 'C:\\Windows\\system32\\cmd.exe',
      TEMP: 'C:\\t', TMP: 'C:\\t', SystemDrive: 'C:', USERPROFILE: 'C:\\Users\\hp', HOME: '/c/Users/hp',
      SUPABASE_URL: 'x', supabase_anon_key: 'x', NEXT_PUBLIC_SUPABASE_URL: 'x', OPENAI_API_KEY: 'x', openai_org: 'x',
      ANTHROPIC_API_KEY: 'x', ANTHROPIC_BASE_URL: 'x', CLAUDE_CODE_MESSAGING_TOKEN: 'x', GITHUB_TOKEN: 'x', MY_SECRET: 'x',
      DB_PASSWORD: 'x', AUTHORIZATION: 'x', Cookie: 'x', STRIPE_KEY: 'x', LINE_CHANNEL_SECRET: 'x', RENDER_API_KEY: 'x',
    };
    const parentBefore = JSON.stringify(parent);
    const r = wc.buildChildEnv(parent);
    const keys = Object.keys(r.env || {}).sort();
    assert(r.ok && JSON.stringify(keys) === JSON.stringify(['ComSpec', 'PATHEXT', 'Path', 'SystemDrive', 'SystemRoot', 'TEMP', 'TMP', 'windir'].sort()), 'E-45. allowlist の最小項目だけ残る（' + keys.join(',') + '）');
    assert(!('SUPABASE_URL' in r.env) && !('supabase_anon_key' in r.env) && !('NEXT_PUBLIC_SUPABASE_URL' in r.env), 'E-46. SUPABASE 系を除去');
    assert(!('OPENAI_API_KEY' in r.env) && !('openai_org' in r.env), 'E-47. OPENAI 系を除去');
    assert(!('ANTHROPIC_API_KEY' in r.env) && !('ANTHROPIC_BASE_URL' in r.env) && !('CLAUDE_CODE_MESSAGING_TOKEN' in r.env), 'E-48. ANTHROPIC / CLAUDE 系を除去');
    assert(['GITHUB_TOKEN', 'MY_SECRET', 'DB_PASSWORD', 'AUTHORIZATION', 'Cookie', 'STRIPE_KEY', 'RENDER_API_KEY'].every(function (k) { return !(k in r.env) && r.dropped.indexOf(k) !== -1; }), 'E-49. TOKEN / KEY / SECRET / PASSWORD / AUTHORIZATION / COOKIE を除去');
    const ci = wc.buildChildEnv({ path: 'p', Temp: 't', Openai_Api_Key: 'x', anthropic_base_url: 'x' });
    assert(ci.ok && ci.env.path === 'p' && ci.env.Temp === 't' && !('Openai_Api_Key' in ci.env) && !('anthropic_base_url' in ci.env), 'E-50. 大文字小文字に関係なく判定');
    const deny = wc.buildChildEnv({ PATH: 'p', TEMP_TOKEN: 'x' });
    assert(deny.ok && !('TEMP_TOKEN' in deny.env), 'E-50b. allowlist は完全一致（TEMP_TOKEN のような前方一致は通さない）');
    assert(!wc.buildChildEnv({ PATH: 'a', Path: 'b' }).ok, 'E-50c. 大小違いの重複 key → fail-closed');
    assert(!wc.buildChildEnv(null).ok && !('X' in (wc.buildChildEnv({ PATH: 'a', TEMP: 1 }).env)) && !('TEMP' in wc.buildChildEnv({ PATH: 'a', TEMP: 1 }).env), 'E-50d. 不正入力 / 非文字列値は落とす');
    assert(JSON.stringify(parent) === parentBefore, 'E-50e. parentEnv を mutation しない');
  }

  caseHeader('R. Resume Isolation');
  {
    const run = makeRun('implementing');
    const ok = wc.validateIsolationResume(run, goodResumeSnapshot());
    assert(ok.result === 'resumable' && ok.reasons.length === 0, 'R-51. 正常 → resumable（' + ok.reasons.join(',') + '）');
    function blockedBy(extra, reason) { const r = wc.validateIsolationResume(run, goodResumeSnapshot(extra)); return r.result === 'blocked' && has(r, reason); }
    assert(blockedBy({ worktreeExists: false }, 'worktree_missing'), 'R-52. worktree 欠落 → blocked');
    assert(blockedBy({ branchExists: false }, 'branch_missing'), 'R-53. branch 欠落 → blocked');
    assert(blockedBy({ branchTip: OTHER }, 'branch_tip_mismatch') && blockedBy({ worktreeHead: OTHER }, 'worktree_head_mismatch'), 'R-54. branch tip / worktree HEAD ≠ baseHead → blocked');
    assert(blockedBy({ diffAllowed: false }, 'diff_outside_scope'), 'R-55. allowedPaths 外の diff → blocked');
    assert(blockedBy({ worktreeEnvFiles: ['.env'] }, 'env_file_present'), 'R-56. env file 存在 → blocked');
    assert(blockedBy({ worktreeGitCommonDir: 'C:\\x\\.git' }, 'common_git_dir_mismatch') && blockedBy({ worktreeListPorcelain: PORCELAIN_MAIN }, 'worktree_not_registered'), 'R-56b. common dir 不一致 / 未登録 → blocked');
    assert(blockedBy({ mainStatusHash: 'ffffffffffff' }, 'main_status_changed'), 'R-56c. main status hash 変化 → blocked');
    const md5 = Object.assign({}, PROTECTED_BASELINE); md5['cost-logs.json'] = '0'.repeat(32);
    assert(blockedBy({ mainProtectedMd5: md5 }, 'main_protected_mismatch'), 'R-56d. main Protected md5 変化 → blocked');
    const fewer = Object.assign({}, PROTECTED_BASELINE); delete fewer['cost-logs.json'];
    assert(blockedBy({ mainProtectedMd5: fewer }, 'main_protected_mismatch'), 'R-56e. Protected 件数不一致 → blocked');
    assert(blockedBy({ worktreeProtectedChanged: true }, 'worktree_protected_changed') && blockedBy({ diffAllowed: 'true' }, 'snapshot_invalid'), 'R-56f. worktree Protected 変更 / 不明値 → blocked');
    assert(!Object.keys(ok).some(function (k) { return /repair|fix|reset|clean/i.test(k); }), 'R-56g. 自動 repair 情報を返さない');
    const before = JSON.stringify(run);
    wc.validateIsolationResume(run, goodResumeSnapshot({ worktreeExists: false }));
    assert(JSON.stringify(run) === before, 'R-56h. run を mutation しない');
    const storeOk = rs.validateResume(run, { baseHeadExists: true, currentHead: HEAD, currentOriginMain: HEAD, worktreeExists: true, branchExists: true, worktreeStatus: 'dirty', diffAllowed: true, protectedMd5Matches: true, diffClassification: 'recorded_within_scope' }, { now: at(10) });
    const c1 = wc.combineResumeResults(storeOk, ok);
    const c2 = wc.combineResumeResults(storeOk, wc.validateIsolationResume(run, goodResumeSnapshot({ branchTip: OTHER })));
    const c3 = wc.combineResumeResults({ result: 'human_approval_required', reasons: ['origin_advanced'] }, ok);
    assert(c2.result === 'blocked' && c3.result === 'human_approval_required' && wc.combineResumeResults(null, ok).result === 'blocked', 'R-56i. Step 2 validateResume と合成（blocked > human > resumable、不正入力は blocked）');
    assert(storeOk.result === 'human_approval_required' && c1.result === 'human_approval_required', 'R-56j. 実装途中の停止は Step 2 側で Human 確認（合成結果もそれを維持）');
  }

  caseHeader('K. Cleanup Plan（表示のみ・実行しない）');
  {
    const blocked = rs.blockRun(makeRun('implementing'), 'test', { now: at(20) }).run;
    const p = wc.buildSafeCleanupPlan(blocked);
    assert(p.ok && p.mode === 'human_only' && p.autoExecute === false && p.steps.length > 0 && p.preconditions.length > 0, 'K-57. Human 用の plan を生成');
    const all = [].concat.apply([], p.steps.map(function (s) { return s.argv; }));
    assert(!all.some(function (a) { return a === '--force' || a === '-f' || a === '-D' || a === 'reset' || a === 'clean' || a === 'prune' || a === 'stash'; }), 'K-58. --force / -D / reset / clean / prune / stash を含まない');
    assert(typeof p.execute === 'undefined' && typeof p.run === 'undefined' && Object.isFrozen(p) && p.steps.every(function (s) { return Array.isArray(s.argv) && typeof s.description === 'string'; }), 'K-59. 実行関数を持たず argv と説明だけ（自動削除実行なし）');
    assert(!wc.buildSafeCleanupPlan(makeRun('implementing')).ok, 'K-59b. 実行中（非 terminal）の run には plan を出さない');
    assert(!wc.buildSafeCleanupPlan(null).ok, 'K-59c. 不正 run → fail-closed');
  }

  caseHeader('M. Manifest 登録');
  {
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'devAutopilot', 'testManifest.json'), 'utf8'));
    const e = manifest.tests.filter(function (t) { return t.file === 'devAutopilotStep3A.test.js'; });
    assert(e.length === 1 && e[0].class === 'safe' && e[0].deps.files.indexOf('tools/devAutopilot/worktreeController.js') !== -1, 'M-1. Step 3A test が safe として manifest 登録済み');
  }

  caseHeader('P. Protected 10件 hash 不変・sandbox 違反 0・env 不変');
  {
    const after = hashProtected();
    assert(PROTECTED_FILES.every(function (f) { return protectedBefore[f] === PROTECTED_BASELINE[f] && after[f] === PROTECTED_BASELINE[f]; }), 'P-1. Protected 10件の hash が開始時・終了時とも baseline 一致');
    assert(violations.length === 0, 'P-2. sandbox 違反 0（network / fs write / 危険 module / env file）' + (violations.length ? ' ' + violations.join(',') : ''));
    const envAfter = JSON.stringify(Object.keys(process.env).sort().map(function (k) { return [k, process.env[k]]; }));
    assert(envAfter === envSnapshotBefore, 'P-3. process.env を変更していない');
  }

  console.log('\n────────────────────────────────────────────────────────────');
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exit(1); }
  console.log('🟢 All Development Autopilot Step 3A cases passed');
})();
