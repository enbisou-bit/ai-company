'use strict';
// devAutopilotStep3B.test.js
// Development Autopilot V1 — Step 3B（worktreeExecutor / Temp Repo Git Integration）の integration テスト。
//
//   ★ manifest 分類は conditional。Autopilot の自動実行対象にせず、Human-controlled development test として明示実行する
//     （node devAutopilotStep3B.test.js）。
//   ★ Git の mutation（init / config / add / commit / worktree add）は、このテストが OS temp に作った自己所有 sandbox の
//     temp repo に対してだけ行う。本物の repo（このファイルの置かれた repo）へは read-only Git だけ。
//   ★ 実行前後で本物の repo の HEAD / status hash / branch 数 / worktree 数 / Protected fingerprint を比較する。
//   ★ network / 危険 module / .env 読込は冒頭で封鎖。fs write は sandbox の内側だけ許可。process.env は変更しない。
//   ★ env の値は log に出さない（key 名の有無だけを見る）。
//   ★ 後始末は owner marker を確認した自己所有 sandbox だけを削除する。Git の force 系 cleanup は使わない。

const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const Module = require('module');
const cp = require('child_process');

const ROOT = __dirname;
const violations = [];

// ── Protected（本物の repo・read-only）──
const PROTECTED_FILES = ['cost-logs.json', 'data/conversations/_meta.json', 'claude-cost-logs.json', 'claude-quality-history.json',
  'backup-dup-candidates-20260714/dup-candidates-123.csv', 'backup-dup-candidates-20260714/dup-candidates-123.json',
  'data/conversations/user-cont-1_line_web.json', 'data/conversations/user-cont-2_line_estimate.json',
  'data/conversations/user-cont-3_line_leader.json', 'data/conversations/user-cont-4_line_video.json'];
const PROTECTED_FINGERPRINT = 'd1fd4bd36f69';
function md5(buf) { return crypto.createHash('md5').update(buf).digest('hex'); }
// `md5sum <10 files> | md5sum | cut -c1-12`（Git Bash の binary mode 出力形式）と同じ値
function protectedFingerprint() {
  try { return md5(PROTECTED_FILES.map(function (f) { return md5(fs.readFileSync(path.join(ROOT, f))) + ' *' + f + '\n'; }).join('')).slice(0, 12); }
  catch (e) { return 'unreadable:' + e.code; }
}
const fpBefore = protectedFingerprint();

// ── OS temp の自己所有 sandbox（blocker 導入前に作成）──
const SANDBOX = fs.mkdtempSync(path.join(os.tmpdir(), 'devAutopilotStep3B-'));
const OWNER_MARKER = '.devautopilot-sandbox-owner';
const OWNER_TOKEN = crypto.randomBytes(16).toString('hex');
fs.writeFileSync(path.join(SANDBOX, OWNER_MARKER), OWNER_TOKEN);
const ORIG_RM = fs.rmSync;
function insideDir(p, dir) {
  const rel = path.relative(String(dir).toLowerCase(), path.resolve(String(p)).toLowerCase());
  return rel === '' || (!!rel && rel.split(/[\\\/]/)[0] !== '..' && !path.isAbsolute(rel));
}
function insideSandbox(p) { return (typeof p === 'string' || p instanceof URL) && insideDir(String(p), SANDBOX); }

// ── sandbox（network / env file / fs write / module）──
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
    violations.push('fs_write:' + name + ':' + String(a));
    throw new Error('SANDBOX_BLOCKED_FS_WRITE:' + name);
  };
}
['writeFileSync', 'appendFileSync', 'renameSync', 'unlinkSync', 'mkdirSync', 'rmSync', 'rmdirSync', 'copyFileSync', 'truncateSync',
  'symlinkSync', 'cpSync', 'writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir', 'copyFile', 'truncate', 'createWriteStream']
  .forEach(function (n) { if (typeof fs[n] === 'function') fs[n] = guardedWrite('fs.' + n, fs[n]); });
const BLOCKED_BARE = new Set(['axios', 'dotenv', '@supabase/supabase-js', '@anthropic-ai/sdk', 'http2', 'undici', 'node:http2']);
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
const envKeysBefore = JSON.stringify(Object.keys(process.env).sort());

let _passed = 0, _failed = 0;
function assert(cond, label) { if (cond) { _passed++; console.log('  ✅ ' + label); } else { _failed++; console.log('  ❌ ' + label); } }
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }
function has(res, reason) { return !!res && Array.isArray(res.reasons) && res.reasons.some(function (r) { return r === reason || r.indexOf(reason) === 0; }); }

const wc = require('./tools/devAutopilot/worktreeController');
const exe = require('./tools/devAutopilot/worktreeExecutor');
const rs = require('./tools/devAutopilot/runStore');

// ── temp repo fixture 専用の Git 実行（sandbox 内の temp repo だけ・許可 subcommand だけ）──
const CHILD_ENV = exe.buildGitChildEnv(process.env).env;   // fixture の Git も executor と同じ env（GIT_CONFIG_GLOBAL=NUL）
function allowedChildKey(k) { return wc.CHILD_ENV_ALLOWLIST.indexOf(k.toUpperCase()) !== -1 || k === 'GIT_CONFIG_GLOBAL'; }
const SENSITIVE_KEY_RE = /^(SUPABASE|NEXT_PUBLIC_SUPABASE|OPENAI|ANTHROPIC|CLAUDE)|(KEY|TOKEN|SECRET|PASSWORD|AUTH|COOKIE)$/i;
const FIXTURE_SUBCOMMANDS = ['init', 'config', 'add', 'commit'];
function fixtureGit(repoDir, args) {
  if (!insideSandbox(repoDir) || insideDir(repoDir, ROOT) || FIXTURE_SUBCOMMANDS.indexOf(args[0]) === -1) {
    violations.push('fixture_git_refused:' + args[0]);
    throw new Error('FIXTURE_GIT_REFUSED');
  }
  return cp.execFileSync('git', ['-C', repoDir].concat(args), { cwd: repoDir, env: CHILD_ENV, shell: false, windowsHide: true, timeout: 15000, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
}

// 自己所有 sandbox の後始末（exact path + owner marker + OS temp 配下 + 本物の repo と無関係、を満たす場合だけ）
function cleanupSandbox(p) {
  if (typeof p !== 'string' || path.resolve(p).toLowerCase() !== path.resolve(SANDBOX).toLowerCase()) return { ok: false, error: 'not_exact_sandbox' };
  if (!insideDir(p, os.tmpdir()) || path.resolve(p).toLowerCase() === path.resolve(os.tmpdir()).toLowerCase()) return { ok: false, error: 'not_under_os_temp' };
  if (insideDir(p, ROOT) || insideDir(ROOT, p)) return { ok: false, error: 'related_to_real_repo' };
  let token = null;
  try { token = fs.readFileSync(path.join(p, OWNER_MARKER), 'utf8'); } catch (e) { return { ok: false, error: 'owner_marker_missing' }; }
  if (token !== OWNER_TOKEN) return { ok: false, error: 'owner_marker_mismatch' };
  try { ORIG_RM(p, { recursive: true, force: true, maxRetries: 3 }); } catch (e) { return { ok: false, error: 'rm_failed:' + e.code }; }
  let gone = false; try { fs.statSync(p); } catch (e) { gone = e.code === 'ENOENT'; }
  return gone ? { ok: true } : { ok: false, error: 'residue' };
}

const REPO = path.join(SANDBOX, 'repo');
const WT_ROOT = path.join(SANDBOX, 'wt');
const TASK = 'task-3b-001';
const TASK2 = 'task-3b-002';
const PROTECTED_LIKE = ['cost-logs.json'];
function realState() { return exe.readRepoState(ROOT); }
function tempProtectedMd5(dir) { const o = {}; PROTECTED_LIKE.forEach(function (f) { o[f] = md5(fs.readFileSync(path.join(dir, f))); }); return o; }
function tempProtectedFingerprint(dir) { return md5(PROTECTED_LIKE.map(function (f) { return md5(fs.readFileSync(path.join(dir, f))) + ' *' + f + '\n'; }).join('')).slice(0, 12); }
function changedPaths(statusLines) { return statusLines.map(function (l) { return l.slice(3).replace(/^"|"$/g, ''); }); }

let realBefore = null;
let exitCode = 0;

(function main() {
  try {
    caseHeader('0. 前提（sandbox は本物の repo の外・本物の repo の開始時状態）');
    {
      assert(!insideDir(SANDBOX, ROOT) && !insideDir(ROOT, SANDBOX) && insideDir(SANDBOX, os.tmpdir()), '0-1. sandbox root は OS temp 配下で本物の repo の外');
      assert(!insideDir(REPO, ROOT) && !insideDir(WT_ROOT, ROOT), '0-2. temp repo / worktree root も本物の repo の外');
      assert(fpBefore === PROTECTED_FINGERPRINT, '0-3. 開始時 Protected fingerprint = ' + PROTECTED_FINGERPRINT);
      realBefore = realState();
      assert(realBefore.ok && realBefore.branchRefs.length === 1 && realBefore.worktreeCount === 1, '0-4. 本物の repo は read-only 実測可能（branch 1 / worktree 1）');
      assert(exe.SELF_REPO_ROOT.toLowerCase() === path.resolve(ROOT).toLowerCase(), '0-5. executor は自 repo（ENBISOU 本体）を mutation 拒否対象として認識');
    }

    caseHeader('G. Git availability / 最小 env');
    {
      const g = exe.validateGitAvailable();
      assert(g.ok && /^git version \d+\.\d+/.test(g.version), 'G-1. git version 取得（' + (g.version || g.error) + '）');
      const keys = Object.keys(CHILD_ENV).map(function (k) { return k.toUpperCase(); }).sort();
      assert(Object.keys(CHILD_ENV).every(allowedChildKey) && keys.indexOf('HOME') === -1 && keys.indexOf('USERPROFILE') === -1 && keys.indexOf('GIT_CONFIG_NOSYSTEM') === -1,
        'G-2. child env は allowlist ＋ GIT_CONFIG_GLOBAL のみ（' + keys.join(',') + '）・HOME / USERPROFILE / GIT_CONFIG_NOSYSTEM なし');
      assert(CHILD_ENV.GIT_CONFIG_GLOBAL === 'NUL', 'G-2c. GIT_CONFIG_GLOBAL=NUL が固定で入る');
      const v = exe.runGitReadOnly('version', {});
      assert(v.ok && v.exitCode === 0 && !v.timedOut, 'G-2b. allowlist env で git 実行可能');
    }

    caseHeader('X. Fixture（sandbox 内 temp repo だけ）');
    let commit1 = null, baseHead = null;
    {
      fs.mkdirSync(REPO);
      fixtureGit(REPO, ['init', '-q', '-b', 'main']);
      fixtureGit(REPO, ['config', 'user.name', 'devautopilot-fixture']);
      fixtureGit(REPO, ['config', 'user.email', 'devautopilot-fixture@example.invalid']);
      fixtureGit(REPO, ['config', 'commit.gpgsign', 'false']);
      fs.writeFileSync(path.join(REPO, 'README.md'), 'fixture\n');
      fs.writeFileSync(path.join(REPO, '.gitignore'), '.env.local\n.env\n');
      fs.writeFileSync(path.join(REPO, 'cost-logs.json'), '{"fixture":true}\n');
      fixtureGit(REPO, ['add', '--', 'README.md', '.gitignore', 'cost-logs.json']);
      fixtureGit(REPO, ['commit', '-q', '-m', 'fixture 1']);
      const s1 = exe.readRepoState(REPO); commit1 = s1.head;
      fs.mkdirSync(path.join(REPO, 'lib'));
      fs.writeFileSync(path.join(REPO, 'lib', 'a.js'), 'module.exports = 1;\n');
      fixtureGit(REPO, ['add', '--', 'lib/a.js']);
      fixtureGit(REPO, ['commit', '-q', '-m', 'fixture 2']);
      // main 側だけに存在する ignored .env.local（placeholder・secret ではない）と untracked Protected-like
      fs.writeFileSync(path.join(REPO, '.env.local'), 'PLACEHOLDER=1\n');
      fs.writeFileSync(path.join(REPO, 'claude-cost-logs.json'), '{}\n');
      const s2 = exe.readRepoState(REPO); baseHead = s2.head;
      assert(s1.ok && /^[0-9a-f]{40}$/.test(commit1), 'X-3. temp repo 作成（git init -b main）');
      assert(s2.ok && /^[0-9a-f]{40}$/.test(baseHead) && baseHead !== commit1 && s2.currentBranch === 'main', 'X-4. fixture commit 2 件（main）');
      const anc = exe.runGitReadOnly('isAncestor', { dir: REPO, ancestor: commit1, descendant: baseHead });
      assert(anc.ok && anc.exitCode === 0, 'X-5. baseHead 取得。commit1 を origin 相当とし ancestor 判定 = true（local stack の再現）');
      assert(exe.listEnvFiles(REPO).indexOf('.env.local') !== -1 && s2.statusLines.every(function (l) { return l.indexOf('.env') === -1; }), 'X-5b. main temp repo に ignored .env.local（status に出ない）');
    }

    // ── preflight snapshot を executor の read-only 実測から組み立てる ──
    function run(stage, taskId) {
      const t = taskId || TASK;
      const r0 = rs.createInitialRun({
        taskId: t, task: { title: 'fixture', goal: 'fixture', allowedPaths: ['lib/'], forbiddenPaths: [] },
        mainRepoPath: REPO, baseHead: baseHead, branch: 'dev/' + t, worktreePath: path.join(WT_ROOT, t),
        budget: { capUsd: 1, maxInvocations: 1 }, mainStatusHashAtStart: exe.readRepoState(REPO).statusHash,
        protectedMd5AtStart: tempProtectedMd5(REPO), now: '2026-09-28T00:00:00.000Z',
      });
      if (!r0.ok) throw new Error('run fixture invalid: ' + JSON.stringify(r0));
      let r = r0.run, m = 1;
      for (const s of ['researching', 'designing', 'implementing', 'testing', 'reviewing']) {
        r = rs.transitionStage(r, s, { now: '2026-09-28T00:0' + (m++) + ':00.000Z' }).run;
        if (s === stage) break;
      }
      return r;
    }
    function preflightSnapshot(taskId) {
      const st = exe.readRepoState(REPO);
      const wtPath = path.join(WT_ROOT, taskId);
      const anc = exe.runGitReadOnly('isAncestor', { dir: REPO, ancestor: commit1, descendant: st.head });
      const tip = exe.runGitReadOnly('verifyDevRef', { dir: REPO, ref: 'refs/heads/dev/' + taskId });
      const target = exe.inspectTargetPath(wtPath);
      const hooks = exe.detectActiveHooks(REPO);
      return {
        currentBranch: st.currentBranch, stagedCount: st.stagedCount, currentHead: st.head, originMain: commit1,
        originIsAncestor: anc.ok ? true : (anc.exitCode === 1 ? false : undefined),
        protectedFingerprint: tempProtectedFingerprint(REPO), mainStatusHash: st.statusHash,
        existingBranchRefs: st.branchRefs, targetBranchExists: tip.ok ? true : (tip.exitCode === 1 ? false : undefined),
        targetWorktreeExists: target.ok ? target.exists : undefined, pathCollision: false,
        pathHasLinkOrJunction: target.ok ? target.hasLinkOrJunction : undefined, activeHooks: hooks.active,
        worktreeListPorcelain: st.worktreeListPorcelain, maxTrackedPathLength: 67,
      };
    }
    function expected(taskId, extra) {
      return Object.assign({ taskId: taskId, repoPath: REPO, worktreeRoot: WT_ROOT, baseHead: baseHead,
        protectedFingerprint: tempProtectedFingerprint(REPO), mainStatusHash: exe.readRepoState(REPO).statusHash, run: run('designing', taskId) }, extra || {});
    }
    const EXEC_OPTS = { mutationRepoAllowlist: [REPO], protectedRepoRoots: [ROOT], timeoutMs: 15000 };

    caseHeader('W. Actual worktree add（temp repo のみ）');
    const WT = path.join(WT_ROOT, TASK);
    const runDesign = run('designing');
    let pf = null;
    {
      const mainBefore = exe.readRepoState(REPO);
      pf = wc.validateIsolationPreflight(preflightSnapshot(TASK), expected(TASK, { run: runDesign }));
      assert(pf.result === 'pass', 'W-5c. 実測 snapshot で Step 3A preflight = pass（' + pf.reasons.join(',') + '）');
      const res = exe.executeWorktreeCreate(pf, EXEC_OPTS);
      assert(res.ok && res.exitCode === 0 && !res.timedOut, 'W-6. executor 経由の actual `git worktree add -b` 成功' + (res.ok ? '' : '（' + res.error + ' / ' + String(res.stderr).slice(0, 160) + '）'));
      const ws = exe.readWorktreeState(WT);
      const tip = exe.runGitReadOnly('verifyDevRef', { dir: REPO, ref: 'refs/heads/dev/' + TASK });
      const mainAfter = exe.readRepoState(REPO);
      assert(ws.ok && ws.branchRef === 'refs/heads/dev/' + TASK && tip.ok, 'W-7. branch dev/' + TASK + ' が作成され worktree で checkout');
      assert(ws.head === baseHead && tip.stdout.trim() === baseHead, 'W-8. worktree HEAD = branch tip = baseHead');
      assert(ws.statusLines.length === 0, 'W-9. worktree は clean');
      const reg = wc.parseWorktreeListPorcelain(mainAfter.worktreeListPorcelain);
      assert(reg.ok && reg.worktrees.length === 2 && reg.worktrees.some(function (w) { return wc.samePath(w.path, WT) && w.branch === 'refs/heads/dev/' + TASK; }), 'W-10. worktree list に登録');
      assert(wc.samePath(ws.gitCommonDir, mainAfter.gitCommonDir), 'W-11. common git dir 一致');
      assert(ws.envFiles.length === 0 && exe.listEnvFiles(REPO).indexOf('.env.local') !== -1, 'W-12. worktree に .env* なし（main 側の ignored .env.local はコピーされない）');
      let untrackedProtectedLike = true; try { fs.lstatSync(path.join(WT, 'claude-cost-logs.json')); } catch (e) { untrackedProtectedLike = false; }
      assert(!untrackedProtectedLike && fs.readFileSync(path.join(WT, 'cost-logs.json'), 'utf8').replace(/\r\n/g, '\n') === '{"fixture":true}\n', 'W-12b. untracked Protected-like は現れず、tracked Protected-like は baseHead 版');
      assert(mainAfter.head === mainBefore.head && mainAfter.statusHash === mainBefore.statusHash && mainAfter.currentBranch === 'main', 'W-12c. temp main 側は HEAD / status 不変');
      const created = wc.validateCreatedWorktree({
        worktreeHead: ws.head, worktreeBranchRef: ws.branchRef, worktreeStatusCount: ws.statusLines.length,
        worktreeGitCommonDir: ws.gitCommonDir, mainGitCommonDir: mainAfter.gitCommonDir, worktreeListPorcelain: mainAfter.worktreeListPorcelain,
        worktreeEnvFiles: ws.envFiles, worktreeProtectedChanged: false,
        mainHeadBefore: mainBefore.head, mainHeadAfter: mainAfter.head, mainStatusHashBefore: mainBefore.statusHash, mainStatusHashAfter: mainAfter.statusHash,
        mainProtectedFingerprintBefore: tempProtectedFingerprint(REPO), mainProtectedFingerprintAfter: tempProtectedFingerprint(REPO),
      }, runDesign);
      assert(created.result === 'valid', 'W-12d. 実測 snapshot で Step 3A validateCreatedWorktree = valid（' + created.reasons.join(',') + '）');
    }

    caseHeader('F. Failure / collision');
    {
      const wlBefore = exe.readRepoState(REPO).worktreeListPorcelain;
      const again = wc.validateIsolationPreflight(preflightSnapshot(TASK), expected(TASK));
      assert(again.result === 'blocked' && has(again, 'target_branch_exists') && has(again, 'worktree_already_registered'), 'F-18. 同じ taskId の再作成は preflight で blocked');
      const replay = exe.executeWorktreeCreate(pf, EXEC_OPTS);
      assert(!replay.ok && replay.exitCode !== 0 && exe.readRepoState(REPO).worktreeListPorcelain === wlBefore, 'F-18b. 古い pass plan を再実行しても Git が拒否（重複 branch）し状態不変');
      fs.mkdirSync(path.join(WT_ROOT, TASK2));
      fs.writeFileSync(path.join(WT_ROOT, TASK2, 'occupied.txt'), 'x');
      const occ = wc.validateIsolationPreflight(preflightSnapshot(TASK2), expected(TASK2));
      assert(occ.result === 'blocked' && has(occ, 'target_worktree_exists'), 'F-19. 既存 directory の path は preflight で blocked');
      const wrong = wc.validateIsolationPreflight(preflightSnapshot(TASK2), expected(TASK2, { baseHead: commit1, run: Object.assign(run('designing', TASK2), { baseHead: commit1 }) }));
      const wrongExec = exe.executeWorktreeCreate(wrong, EXEC_OPTS);
      assert(wrong.result === 'blocked' && has(wrong, 'head_mismatch') && !wrongExec.ok && wrongExec.error === 'preflight_not_pass' && exe.readRepoState(REPO).worktreeListPorcelain === wlBefore,
        'F-20. 誤った base は実行前に blocked（executor も preflight_not_pass で Git を呼ばない）');
      ORIG_RM(path.join(WT_ROOT, TASK2), { recursive: true, force: true });   // sandbox 内の fixture を戻す
      const exp2 = expected(TASK2);
      fs.appendFileSync(path.join(REPO, 'README.md'), 'dirty\n');
      const dirty = wc.validateIsolationPreflight(preflightSnapshot(TASK2), exp2);
      fs.writeFileSync(path.join(REPO, 'README.md'), 'fixture\n');
      assert(dirty.result === 'blocked' && has(dirty, 'main_status_hash_mismatch'), 'F-21. main が dirty（status hash 変化）→ blocked');
      const hookFile = path.join(REPO, '.git', 'hooks', 'post-checkout');
      fs.writeFileSync(hookFile, '#!/bin/sh\nexit 0\n');
      const hooked = exe.detectActiveHooks(REPO);
      const hookPf = wc.validateIsolationPreflight(preflightSnapshot(TASK2), expected(TASK2));
      fs.unlinkSync(hookFile);
      assert(hooked.active && hookPf.result === 'blocked' && has(hookPf, 'active_hooks') && !exe.detectActiveHooks(REPO).active, 'F-22. active hook（fixture）→ blocked');
      const exp3 = expected(TASK2);
      fs.writeFileSync(path.join(REPO, 'cost-logs.json'), '{"fixture":"changed"}\n');
      const prot = wc.validateIsolationPreflight(preflightSnapshot(TASK2), exp3);
      fs.writeFileSync(path.join(REPO, 'cost-logs.json'), '{"fixture":true}\n');
      assert(prot.result === 'blocked' && has(prot, 'protected_mismatch'), 'F-23. Protected-like 変更 → blocked');
      const clean2 = wc.validateIsolationPreflight(preflightSnapshot(TASK2), expected(TASK2));
      assert(clean2.result === 'pass', 'F-23b. fixture を戻すと再び pass（' + clean2.reasons.join(',') + '）');
    }

    caseHeader('M. Executor の mutation 境界');
    {
      const calls = [];
      const spy = function (file, args) { calls.push(args); return ''; };
      // 本物の repo を対象にした pass 形の plan（純関数で生成）→ executor は Git を呼ばずに拒否
      const realPf = wc.validateIsolationPreflight({
        currentBranch: 'main', stagedCount: 0, currentHead: realBefore.head, originMain: realBefore.head, originIsAncestor: true,
        protectedFingerprint: PROTECTED_FINGERPRINT, mainStatusHash: realBefore.statusHash, existingBranchRefs: realBefore.branchRefs,
        targetBranchExists: false, targetWorktreeExists: false, pathCollision: false, pathHasLinkOrJunction: false, activeHooks: false,
        worktreeListPorcelain: realBefore.worktreeListPorcelain, maxTrackedPathLength: 67,
      }, { taskId: 'task-3b-real', repoPath: ROOT, worktreeRoot: path.join(SANDBOX, 'wt-real'), baseHead: realBefore.head,
        protectedFingerprint: PROTECTED_FINGERPRINT, mainStatusHash: realBefore.statusHash,
        run: Object.assign(run('designing', 'task-3b-real'), { mainRepoPath: ROOT, baseHead: realBefore.head, worktreePath: path.join(SANDBOX, 'wt-real', 'task-3b-real') }) });
      const r1 = exe.executeWorktreeCreate(realPf, { mutationRepoAllowlist: [ROOT], _execFileSync: spy });
      assert(realPf.result === 'pass' && !r1.ok && r1.error === 'repo_protected' && calls.length === 0, 'M-1. 本物の repo は allowlist に入れても mutation 拒否（Git 呼び出し 0）');
      const pf2 = wc.validateIsolationPreflight(preflightSnapshot(TASK2), expected(TASK2));
      const r2 = exe.executeWorktreeCreate(pf2, { _execFileSync: spy });
      assert(pf2.result === 'pass' && !r2.ok && r2.error === 'repo_not_allowlisted_for_mutation' && calls.length === 0, 'M-2. allowlist にない repo は mutation 拒否');
      const tampered = JSON.parse(JSON.stringify(pf2)); tampered.plan.command.args.splice(4, 0, '--force');
      const tampered2 = JSON.parse(JSON.stringify(pf2)); tampered2.plan.command.args[7] = 'HEAD';
      assert(exe.executeWorktreeCreate(tampered, Object.assign({ _execFileSync: spy }, EXEC_OPTS)).error === 'command_invalid'
        && exe.executeWorktreeCreate(tampered2, Object.assign({ _execFileSync: spy }, EXEC_OPTS)).error === 'command_shape_invalid' && calls.length === 0, 'M-3. 改ざんした argv（--force 追加・暗黙 HEAD）は拒否');
      assert(exe.runGitReadOnly('push', { dir: REPO }).error === 'kind_not_allowed' && exe.runGitReadOnly('fetch', { dir: REPO }).error === 'kind_not_allowed'
        && exe.runGitReadOnly('isAncestor', { dir: REPO, ancestor: '--all', descendant: baseHead }).error === 'params_invalid'
        && exe.runGitReadOnly('verifyDevRef', { dir: REPO, ref: 'refs/heads/main' }).error === 'params_invalid'
        && exe.runGitReadOnly('statusShort', { dir: '--git-dir=x' }).error === 'dir_invalid', 'M-4. 任意 kind / 任意引数は受け付けない');
      assert(['push', 'fetch', 'commit', 'reset', 'clean', 'stash', 'merge', 'rebase', 'tag', 'checkout', 'switch'].every(function (k) { return exe.KIND_NAMES.indexOf(k) === -1; }), 'M-5. 破壊的 / network kind は存在しない');
      const src = fs.readFileSync(path.join(ROOT, 'tools', 'devAutopilot', 'worktreeExecutor.js'), 'utf8').replace(/\/\/.*$/gm, '');
      const cpMembers = (src.match(/childProcess\.(\w+)/g) || []).map(function (s) { return s.split('.')[1]; });
      assert(cpMembers.length > 0 && cpMembers.every(function (m) { return m === 'execFileSync'; }) && (src.match(/require\(['"]child_process['"]\)/g) || []).length === 1
        && !/execSync|spawn|fork\s*\(|shell:\s*true|powershell|cmd\.exe/i.test(src) && /shell:\s*false/.test(src), 'M-6. child_process は execFileSync + shell:false のみ（exec / spawn / fork / shell 文字列なし）');
      const to = exe.runGitReadOnly('version', {}, { _execFileSync: function () { const e = new Error('spawnSync git ETIMEDOUT'); e.code = 'ETIMEDOUT'; e.signal = 'SIGKILL'; e.status = null; throw e; } });
      assert(!to.ok && to.timedOut === true && to.error === 'timeout', 'M-7. timeout は timedOut=true / error=timeout に正規化');
      assert(exe.runGitReadOnly('version', {}, { timeoutMs: 10 }).error === 'timeout_invalid' && exe.runGitReadOnly('version', {}, { timeoutMs: 600000 }).error === 'timeout_invalid', 'M-8. timeout の範囲外指定は拒否');
      let envSeen = null;
      exe.runGitReadOnly('version', {}, { _execFileSync: function (f, a, o) { envSeen = Object.keys(o.env); return 'git version 2.54.0'; } });
      assert(envSeen && envSeen.every(allowedChildKey) && envSeen.indexOf('GIT_CONFIG_GLOBAL') !== -1, 'M-9. Git child に渡る env は allowlist ＋ GIT_CONFIG_GLOBAL のみ');
    }

    caseHeader('R. Resume（実測 snapshot）');
    {
      const runImpl = rs.transitionStage(runDesign, 'implementing', { now: '2026-09-28T01:00:00.000Z' }).run;
      const wtGitDir = path.join(REPO, '.git', 'worktrees', TASK);
      function resumeSnap() {
        const st = exe.readRepoState(REPO), ws = exe.readWorktreeState(WT);
        const tip = exe.runGitReadOnly('verifyDevRef', { dir: REPO, ref: 'refs/heads/dev/' + TASK });
        const changed = ws.ok ? changedPaths(ws.statusLines) : [];
        return {
          worktreeExists: fs.existsSync(WT), branchExists: tip.ok, worktreeHead: ws.head, branchTip: tip.ok ? tip.stdout.trim() : undefined,
          worktreeGitCommonDir: ws.gitCommonDir, mainGitCommonDir: st.gitCommonDir, worktreeListPorcelain: st.worktreeListPorcelain,
          mainStatusHash: st.statusHash, mainProtectedMd5: tempProtectedMd5(REPO), worktreeEnvFiles: ws.envFiles || [],
          diffAllowed: changed.every(function (p) { return p.indexOf('lib/') === 0; }),
          worktreeProtectedChanged: changed.some(function (p) { return PROTECTED_LIKE.indexOf(p) !== -1; }),
        };
      }
      function resume() { return wc.validateIsolationResume(runImpl, resumeSnap()); }
      // checkout 時の bytes（autocrlf により CRLF の場合あり）を保存し、fixture 変更後は同じ bytes で戻す
      const ORIG = {};
      ['README.md', 'cost-logs.json', 'lib/a.js'].forEach(function (f) { ORIG[f] = fs.readFileSync(path.join(WT, f)); });
      function restore(f) { fs.writeFileSync(path.join(WT, f), ORIG[f]); }
      const ok = resume();
      assert(ok.result === 'resumable', 'R-24. 正常 → resumable（' + ok.reasons.join(',') + '）');
      fs.writeFileSync(path.join(WT, 'lib', 'a.js'), 'module.exports = 2;\n');
      const inScope = resume();
      assert(inScope.result === 'resumable', 'R-24b. allowedPaths 内の変更（実装途中の dirty）は resumable');
      fs.writeFileSync(path.join(WT, 'README.md'), 'changed\n');
      const outScope = resume();
      restore('README.md');
      assert(outScope.result === 'blocked' && has(outScope, 'diff_outside_scope'), 'R-25/29. allowedPaths 外の dirty（README.md）→ blocked');
      fs.writeFileSync(path.join(WT, 'unexpected.txt'), 'x');
      const unexpected = resume();
      fs.unlinkSync(path.join(WT, 'unexpected.txt'));
      assert(unexpected.result === 'blocked' && has(unexpected, 'diff_outside_scope'), 'R-25b. 想定外 file の追加 → blocked');
      restore('lib/a.js');
      const createdDirty = wc.validateCreatedWorktree({
        worktreeHead: baseHead, worktreeBranchRef: 'refs/heads/dev/' + TASK, worktreeStatusCount: 1,
        worktreeGitCommonDir: exe.readWorktreeState(WT).gitCommonDir, mainGitCommonDir: exe.readRepoState(REPO).gitCommonDir,
        worktreeListPorcelain: exe.readRepoState(REPO).worktreeListPorcelain, worktreeEnvFiles: [], worktreeProtectedChanged: false,
        mainHeadBefore: baseHead, mainHeadAfter: baseHead, mainStatusHashBefore: 'aaaaaaaaaaaa', mainStatusHashAfter: 'aaaaaaaaaaaa',
        mainProtectedFingerprintBefore: 'bbbbbbbbbbbb', mainProtectedFingerprintAfter: 'bbbbbbbbbbbb' }, runDesign);
      assert(createdDirty.result === 'blocked' && has(createdDirty, 'worktree_dirty'), 'R-25c. 作成直後検証では dirty は blocked');
      // wrong branch / wrong HEAD / branch tip は temp repo の Git metadata file を fixture として書き換えて作り、直後に戻す
      const headFile = path.join(wtGitDir, 'HEAD');
      const headOrig = fs.readFileSync(headFile, 'utf8');
      fs.writeFileSync(headFile, 'ref: refs/heads/main\n');
      const wrongBranch = resume();
      fs.writeFileSync(headFile, commit1 + '\n');
      const wrongHead = resume();
      fs.writeFileSync(headFile, headOrig);
      assert(wrongBranch.result === 'blocked' && has(wrongBranch, 'registered_worktree_mismatch'), 'R-26. worktree が別 branch → blocked');
      assert(wrongHead.result === 'blocked' && has(wrongHead, 'worktree_head_mismatch'), 'R-27. worktree HEAD ≠ baseHead → blocked');
      const refFile = path.join(REPO, '.git', 'refs', 'heads', 'dev', TASK);
      let refOrig = null; try { refOrig = fs.readFileSync(refFile, 'utf8'); } catch (e) { refOrig = null; }
      if (refOrig !== null) {
        fs.writeFileSync(refFile, commit1 + '\n');
        const tipMis = resume();
        fs.writeFileSync(refFile, refOrig);
        assert(tipMis.result === 'blocked' && has(tipMis, 'branch_tip_mismatch'), 'R-27b. branch tip ≠ baseHead → blocked');
      } else {
        assert(false, 'R-27b. branch の loose ref file が見つからない（packed の可能性）');
      }
      fs.writeFileSync(path.join(WT, '.env.local'), 'PLACEHOLDER=1\n');
      const envAdded = resume();
      fs.unlinkSync(path.join(WT, '.env.local'));
      assert(envAdded.result === 'blocked' && has(envAdded, 'env_file_present'), 'R-28. worktree に .env.local（placeholder）→ blocked（直後に削除）');
      fs.writeFileSync(path.join(WT, 'cost-logs.json'), '{"fixture":"changed"}\n');
      const protChanged = resume();
      restore('cost-logs.json');
      assert(protChanged.result === 'blocked' && has(protChanged, 'worktree_protected_changed'), 'R-28b. worktree の Protected-like 変更 → blocked');
      const back = resume();
      assert(back.result === 'resumable', 'R-29b. fixture を戻すと resumable に復帰（' + back.reasons.join(',') + '）');
    }

    caseHeader('I. Global git config isolation（値は log しない・存在だけ判定）');
    {
      // 対照: 隔離なし（allowlist env のみ）の child から global config が見えるか（exit code だけを見る）
      let controlVisible = null;
      try {
        cp.execFileSync('git', ['--no-optional-locks', '-C', REPO, 'config', '--global', '--get', 'user.name'],
          { cwd: REPO, env: wc.buildChildEnv(process.env).env, shell: false, windowsHide: true, timeout: 15000, stdio: ['ignore', 'ignore', 'ignore'] });
        controlVisible = true;
      } catch (e) { controlVisible = e.status === 1 ? false : null; }
      const gName = exe.runGitReadOnly('configProbe', { dir: REPO, scope: 'global', key: 'user.name' });
      const gMail = exe.runGitReadOnly('configProbe', { dir: REPO, scope: 'global', key: 'user.email' });
      const gHooks = exe.runGitReadOnly('configProbe', { dir: REPO, scope: 'global', key: 'core.hooksPath' });
      const gCred = exe.runGitReadOnly('configProbe', { dir: REPO, scope: 'global', key: 'credential.helper' });
      assert([gName, gMail, gHooks, gCred].every(function (r) { return !r.ok && r.exitCode === 1 && r.stdout === ''; }),
        'I-1. executor 経由 child から global の user.name / user.email / core.hooksPath / credential.helper は見えない（隔離なしの対照では user.name visible=' + controlVisible + '）');
      const sys = exe.runGitReadOnly('configProbe', { dir: REPO, scope: 'system', key: 'core.autocrlf' });
      assert(sys.ok && sys.exitCode === 0, 'I-2. system config は無効化していない（core.autocrlf を読める）');
      assert(exe.buildGitChildEnv({ PATH: 'p', GIT_CONFIG_GLOBAL: 'C:\\evil\\gitconfig' }).env.GIT_CONFIG_GLOBAL === 'NUL'
        && exe.buildGitChildEnv({ PATH: 'p', git_config_global: 'C:\\evil' }).env.GIT_CONFIG_GLOBAL === 'NUL'
        && !('git_config_global' in exe.buildGitChildEnv({ PATH: 'p', git_config_global: 'C:\\evil' }).env)
        && !('GIT_CONFIG_NOSYSTEM' in exe.buildGitChildEnv({ PATH: 'p', GIT_CONFIG_NOSYSTEM: '1' }).env), 'I-3. parentEnv 由来の GIT_CONFIG_GLOBAL（大小文字違い含む）は信用せず固定値 NUL で上書き・GIT_CONFIG_NOSYSTEM は渡さない');
      assert(exe.runGitReadOnly('configProbe', { dir: REPO, scope: 'local', key: 'user.name' }).error === 'params_invalid'
        && exe.runGitReadOnly('configProbe', { dir: REPO, scope: 'global', key: 'alias.x' }).error === 'params_invalid', 'I-4. configProbe の scope / key は固定 allowlist のみ');
      assert(!exe.buildGitChildEnv(null).ok, 'I-5. 不正 parentEnv は fail-closed');
    }

    caseHeader('E. Env（値は log しない）');
    {
      const sensitive = Object.keys(process.env).filter(function (k) { return SENSITIVE_KEY_RE.test(k); });
      assert(sensitive.every(function (k) { return !(k in CHILD_ENV); }), 'E-30. 親 env の sensitive key（' + sensitive.length + ' 件）は child env に 0 件');
      let nodeOut = null;
      try {
        nodeOut = cp.execFileSync(process.execPath, ['-e', 'var k=Object.keys(process.env);console.log(JSON.stringify({n:k.length,s:k.filter(function(x){return /^(SUPABASE|NEXT_PUBLIC_SUPABASE|OPENAI|ANTHROPIC|CLAUDE)|(KEY|TOKEN|SECRET|PASSWORD|AUTH|COOKIE)$/i.test(x)}).length,g:process.env.GIT_CONFIG_GLOBAL===\'NUL\'}))'],
          { cwd: SANDBOX, env: CHILD_ENV, shell: false, windowsHide: true, timeout: 15000, encoding: 'utf8' });
      } catch (e) { nodeOut = null; }
      const nj = nodeOut ? JSON.parse(nodeOut) : null;
      assert(nj && nj.s === 0 && nj.g === true, 'E-31. 最小 env で node も起動し、child から sensitive key は見えず GIT_CONFIG_GLOBAL=NUL は見える（child の key 数 ' + (nj ? nj.n : '?') + '）');
      const g = exe.runGitReadOnly('revParseHead', { dir: REPO });
      assert(g.ok, 'E-31b. 最小 env（HOME / USERPROFILE なし）で Git の read / init / commit / worktree add が成立');
      const dump = JSON.stringify([g, exe.readRepoState(REPO), exe.readWorktreeState(WT)]);
      const leaked = sensitive.filter(function (k) { const v = process.env[k]; return typeof v === 'string' && v.length >= 6 && dump.indexOf(v) !== -1; });
      assert(leaked.length === 0 && dump.indexOf('"env"') === -1, 'E-32. executor の result に env の値・env object を含めない');
    }
  } catch (e) {
    _failed++;
    console.log('  ❌ 例外: ' + (e && e.message ? e.message : String(e)));
  } finally {
    caseHeader('C. Cleanup（自己所有 sandbox のみ）・本物の repo 不変');
    {
      const refuseRepo = cleanupSandbox(ROOT);
      const refuseTmp = cleanupSandbox(os.tmpdir());
      const refuseOther = cleanupSandbox(path.join(SANDBOX, 'repo'));
      assert(!refuseRepo.ok && !refuseTmp.ok && !refuseOther.ok, 'C-35. 自己所有でない path（本物の repo / OS temp root / sandbox の一部）は cleanup 拒否');
      const done = cleanupSandbox(SANDBOX);
      assert(done.ok, 'C-33. 自己所有 sandbox（temp repo / worktree を含む）を後始末' + (done.ok ? '' : '（' + done.error + ' / residue: ' + SANDBOX + '）'));
      let residue = true; try { fs.statSync(SANDBOX); } catch (e) { residue = false; }
      assert(!residue, 'C-34. temp 残骸なし');
      const realAfter = realState();
      assert(realBefore && realAfter.ok && realAfter.head === realBefore.head, 'B-13. 本物の repo の HEAD 不変');
      assert(realBefore && realAfter.statusHash === realBefore.statusHash, 'B-14. 本物の repo の status hash 不変（' + realAfter.statusHash + '）');
      assert(protectedFingerprint() === PROTECTED_FINGERPRINT, 'B-15. Protected fingerprint 不変（' + PROTECTED_FINGERPRINT + '）');
      assert(realBefore && realAfter.branchRefs.length === realBefore.branchRefs.length && realAfter.branchRefs.length === 1, 'B-16. 本物の repo の branch 数不変（1）');
      assert(realBefore && realAfter.worktreeCount === realBefore.worktreeCount && realAfter.worktreeCount === 1, 'B-17. 本物の repo の worktree 数不変（1）');
      assert(violations.length === 0, 'B-18. sandbox 違反 0（network / sandbox 外 fs write / 危険 module / .env 読込 / fixture Git 拒否）' + (violations.length ? ' ' + violations.join(',') : ''));
      assert(JSON.stringify(Object.keys(process.env).sort()) === envKeysBefore, 'B-19. process.env を変更していない');
    }
    console.log('\n────────────────────────────────────────────────────────────');
    console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
    if (_failed > 0) { console.log('🔴 FAILED'); exitCode = 1; }
    else console.log('🟢 All Development Autopilot Step 3B cases passed');
    process.exitCode = exitCode;
  }
})();
