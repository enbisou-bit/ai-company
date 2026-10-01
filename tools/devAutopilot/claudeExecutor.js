'use strict';
// tools/devAutopilot/claudeExecutor.js
// Development Autopilot V1 — Stage 4C S4：Runner invocation 1 回の実行（予約 → 起動 → 観測 → 一括保存）
//
//   ★ 実 spawn は既定で無効。deps.spawn（テスト用の差し替え）が無く allowRealSpawn !== true なら起動しない。
//     allowRealSpawn だけでは実行を許可しない：Human 実行承認（明示・対象 run / repo / stage・CLI 識別・上限・有効期間）・所有権・隔離・予算を毎回検証する。
//     実行承認はこの module が発行しない（呼び出し側が Human から受け取ったものを検証するだけ）。曖昧・不足した承認は拒否する。
//   ★ 承認は run 記録に束縛する。main の期待値（autopilotStatusHash / Protected fingerprint）は run 記録から導き、承認の値と一致する場合だけ使う
//     （呼び出し側が渡す期待値を独立した信頼値として扱わない）。予約記録（launch）には承認 ID と承認内容の正規化 SHA-256 全文を保存する。
//   ★ 起動回数は run 全体の上限（budget.maxInvocations）と承認ごとの上限（予約済み invocation から計上・完了前の記録も数える）を別々に検査し、
//     両方を満たす場合だけ起動する。同 stage の再起動は runStore が拒否する。
//   ★ 実行範囲（allowedPaths / forbiddenPaths）の正本は保存済み run.task。ctx.build の値は正規化して一致を検査するだけで、上書きに使わない。
//   ★ 起動前に隔離 worktree を観測し、run の隔離情報（HEAD・branch tip・branchRef・所在）と照合する。research / design は既存変更 0 件、
//     implement / review は記録済み・許可範囲内の差分だけを許す。欠落・不正・不明・不一致は予約・spawn の前に拒否する。
//   ★ 予約（beginInvocation）を所有者として保存できた場合だけ起動する。保存できなければ起動しない。
//   ★ heartbeat と完了の保存は 1 本の直列キューで行い、常に最新の保存済み revision から次の状態を作る（古い revision で上書きしない）。
//     heartbeat の保存に失敗したら（所有権喪失を含む）子プロセスを止め、完了を保存せず停止する（予約記録と lock は残す・自動再起動しない）。
//   ★ 'exit'（プロセス終了）と 'close'（出力の回収完了）を区別する。kill 後の exit 待ち・exit 後の close 待ちとも上限付き。
//     stdout・stderr とも上限を超えて蓄積しない（stderr は byte 数だけ数え、本文は保持しない）。
//   ★ 終了未確認・強制終了後の子孫プロセス不明・未検証（StructuredOutput を含む未知 tool）は block。自動 retry はしない。
//   ★ StructuredOutput は既定で未検証 block。承認の structuredOutputPolicy が同じ CLI（exe SHA・版）に束縛された 'conditional' の場合だけ、
//     単一・最後・schema 適合・正常な対応結果・envelope との正規化 hash 一致・他の未知 tool なしを満たすときに条件付きで受け入れる。
//   ★ 次 stage の previousOutputs 用に、検証済みの stage 出力を戻り値（メモリ上）でだけ返す。run 記録には保存しない。
//   ★ 結果は必ず 1 回だけ返す。監視・観測・完了処理の例外と保存失敗は別の error code で返し、いずれも started の記録と lock を残す（自動再開しない）。
//   ★ 月額プラン内限定・追加課金禁止。--max-budget-usd と承認の上限は CLI 推定値に対する停止条件であり、追加課金の許可ではない。
//     費用は CLI 推定値として記録する（請求額・月額利用枠ではない）。
//   ★ 結果には本文（stdout・stderr・summary・prompt・transcript・env 値）を保存しない。

var crypto = require('crypto');
var cr = require('./claudeRunner');
var rs = require('./runStore');
var tc = require('./transcriptCheck');
var rc = require('./riskClassifier');
var wc = require('./worktreeController');

var DEFAULT_LIMITS = Object.freeze({ timeoutMs: 300000, stdoutMax: 256 * 1024, stderrMax: 64 * 1024, heartbeatMs: 30000, killWaitMs: 10000, drainWaitMs: 5000, staleMs: 10 * 60 * 1000 });
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
var SHA256_RE = /^[0-9a-f]{64}$/;
var HEAD_RE = /^[0-9a-f]{40}$/;
var HASH12_RE = /^[0-9a-f]{12}$/;
var MD5_RE = /^[0-9a-f]{32}$/;
var GIT_FILE_HASH_RE = /^[0-9a-f]{12,64}$/;
var CODE_RE = /^[A-Za-z0-9_:.\/,@+=-]{1,200}$/;
var ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
var MODEL_ID_RE = /^claude-[a-z0-9.-]{3,60}$/;
var SUBTYPES = ['success', 'error_max_turns', 'error_during_execution', 'error_max_budget_usd', 'error_max_structured_output_retries'];
var SIGNALS = ['SIGKILL', 'SIGTERM', 'SIGINT'];
var ENTRY_STATUS = ['added', 'modified', 'deleted', 'renamed', 'untracked'];
var APPROVAL_KIND = 'enbisou-runner-invocation-approval';
var BILLING_SCOPE = 'monthly_plan_only_no_extra_charge';   // 月額プラン内限定・追加課金禁止（ドル上限はこれを上書きしない）
var APPROVAL_KEYS = ['kind', 'approvalId', 'approvedBy', 'taskId', 'runStartedAt', 'mainRepoPath', 'baseHead', 'branch', 'worktreePath', 'stages',
  'exeSha256', 'cliVersion', 'maxInvocations', 'maxBudgetUsdPerInvocation', 'billingScope', 'mainAutopilotStatusHash', 'protectedFingerprint', 'issuedAt', 'expiresAt',
  'structuredOutputPolicy'];
// StructuredOutput の扱い（承認に束縛）：既定 'block'（未検証 block）。
//   { mode: 'conditional', exeSha256, cliVersion } の場合だけ、同じ CLI（exe SHA・版）で条件付き判定を行う（transcriptCheck.evaluateStructuredOutputConditional）。
//   ★ 実運転で 'conditional' を有効にする Human 判断は未採用（approveCli は 'block' しか発行しない）。
var SO_POLICY_BLOCK = 'block';
function _soPolicyErrors(p, c) {
  if (p === SO_POLICY_BLOCK) return [];
  if (!_exactKeys(p, ['mode', 'exeSha256', 'cliVersion']) || p.mode !== 'conditional') return ['approval_structured_output_policy_invalid'];
  if (p.exeSha256 !== c.exeSha256 || p.cliVersion !== c.cliVersion) return ['approval_structured_output_policy_cli_mismatch'];
  return [];
}
var MAX_APPROVAL_MS = 24 * 60 * 60 * 1000;
// runStore の stage 名 → claudeRunner の stage 名（= runStore の sessionIds の key）
var RUNNER_STAGE = Object.freeze({ researching: 'research', designing: 'design', implementing: 'implement', reviewing: 'review' });
var READ_ONLY_STAGES = ['researching', 'designing'];

function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _err(code, extra) { return Object.assign({ ok: false, error: code }, extra || {}); }
function _iso(v) { return typeof v === 'string' && ISO_RE.test(v) && !isNaN(Date.parse(v)); }
function _sha(s) { return crypto.createHash('sha256').update(String(s)).digest('hex'); }
function _md5(s) { return crypto.createHash('md5').update(String(s)).digest('hex'); }
function _codes(list) { return (Array.isArray(list) ? list : []).slice(0, 50).map(function (c) { var s = String(c); return CODE_RE.test(s) ? s : 'code_redacted'; }); }
function _exactKeys(o, keys) { return _isObj(o) && Object.keys(o).length === keys.length && keys.every(function (k) { return Object.prototype.hasOwnProperty.call(o, k); }); }

// run 記録の Protected md5（開始時）から Protected fingerprint を導く（main 観測と同じ式・PROTECTED_PATHS の順）。導けなければ null
function protectedFingerprintFromRun(run) {
  var m = _isObj(run) ? run.protectedMd5AtStart : null;
  var P = rc.PROTECTED_PATHS;
  if (!_isObj(m) || Object.keys(m).length !== P.length || !P.every(function (f) { return Object.prototype.hasOwnProperty.call(m, f) && typeof m[f] === 'string' && MD5_RE.test(m[f]); })) return null;
  return _md5(P.map(function (f) { return m[f] + ' *' + f + '\n'; }).join('')).slice(0, 12);
}
// run 記録から main の期待値を導く（ctx から受け取らない）
function expectedMainFromRun(run) {
  var fp = protectedFingerprintFromRun(run);
  if (!_isObj(run) || typeof run.mainStatusHashAtStart !== 'string' || !HASH12_RE.test(run.mainStatusHashAtStart) || fp === null) return null;
  return { autopilotStatusHash: run.mainStatusHashAtStart, protectedFingerprint: fp };
}
// 承認ごとの消費回数：予約済み invocation（started / unconfirmed / finished のすべて）から数える
function approvalUseCount(run, approvalId) {
  return (Array.isArray(run.invocations) ? run.invocations : []).filter(function (inv) { return _isObj(inv) && _isObj(inv.launch) && inv.launch.approvalId === approvalId; }).length;
}

// Human 実行承認の検証（発行はしない）。曖昧・不足・期限外・対象外・run 記録との不一致は拒否
//   c: { run, now, exeSha256, cliVersion, maxBudgetUsd }
function validateApproval(a, c) {
  var e = [];
  if (!_exactKeys(a, APPROVAL_KEYS)) return ['approval_shape'];
  var run = c.run;
  if (a.kind !== APPROVAL_KIND || a.approvedBy !== 'human') e.push('approval_not_human');
  if (typeof a.approvalId !== 'string' || !UUID_RE.test(a.approvalId)) e.push('approval_id');
  if (a.taskId !== run.taskId || a.runStartedAt !== run.startedAt) e.push('approval_run_mismatch');
  if (a.mainRepoPath !== run.mainRepoPath) e.push('approval_repo_mismatch');
  if (a.baseHead !== run.baseHead || a.branch !== run.branch || a.worktreePath !== run.worktreePath) e.push('approval_isolation_mismatch');
  if (!Array.isArray(a.stages) || a.stages.length === 0 || !a.stages.every(function (s) { return Object.prototype.hasOwnProperty.call(RUNNER_STAGE, s); }) || a.stages.indexOf(run.stage) === -1) e.push('approval_stage_not_covered');
  if (typeof a.exeSha256 !== 'string' || !SHA256_RE.test(a.exeSha256) || a.exeSha256 !== c.exeSha256) e.push('approval_exe_mismatch');
  if (typeof a.cliVersion !== 'string' || a.cliVersion !== c.cliVersion) e.push('approval_cli_version_mismatch');
  if (!Number.isInteger(a.maxInvocations) || a.maxInvocations < 1 || approvalUseCount(run, a.approvalId) + 1 > a.maxInvocations) e.push('approval_invocation_limit');
  if (typeof a.maxBudgetUsdPerInvocation !== 'number' || !isFinite(a.maxBudgetUsdPerInvocation) || a.maxBudgetUsdPerInvocation <= 0
    || typeof c.maxBudgetUsd !== 'number' || c.maxBudgetUsd > a.maxBudgetUsdPerInvocation || c.maxBudgetUsd > run.budget.capUsd - run.budget.spentUsd) e.push('approval_budget');
  if (a.billingScope !== BILLING_SCOPE) e.push('approval_billing_scope');
  e = e.concat(_soPolicyErrors(a.structuredOutputPolicy, c));
  var em = expectedMainFromRun(run);
  if (!em) e.push('run_main_record_unusable');
  else if (a.mainAutopilotStatusHash !== em.autopilotStatusHash || a.protectedFingerprint !== em.protectedFingerprint) e.push('approval_main_mismatch');
  if (!_iso(a.issuedAt) || !_iso(a.expiresAt)) e.push('approval_time');
  else {
    var now = Date.parse(c.now), iss = Date.parse(a.issuedAt), exp = Date.parse(a.expiresAt);
    if (exp <= iss || exp - iss > MAX_APPROVAL_MS) e.push('approval_window_invalid');
    if (now < iss || now >= exp) e.push('approval_expired_or_not_yet_valid');
  }
  return e;
}

// 起動前の隔離 worktree 検証（純関数）。w: observeWorktree() の結果 { worktreePath, worktreeHead, branchTip, worktreeBranchRef, changedEntries[], gitFileHash }
function validateWorktreeBeforeLaunch(run, w) {
  if (!_isObj(w)) return ['worktree_unobservable'];
  var r = [];
  if (typeof w.worktreePath !== 'string' || !w.worktreePath) r.push('worktree_path_unobserved');
  else if (!wc.samePath(w.worktreePath, run.worktreePath)) r.push('worktree_path_mismatch');
  if (typeof w.worktreeHead !== 'string' || !HEAD_RE.test(w.worktreeHead) || w.worktreeHead !== run.isolation.worktreeHead || w.worktreeHead !== run.baseHead) r.push('worktree_head_mismatch');
  if (typeof w.branchTip !== 'string' || !HEAD_RE.test(w.branchTip) || w.branchTip !== run.baseHead) r.push('branch_tip_mismatch');
  if (w.worktreeBranchRef !== 'refs/heads/' + run.branch) r.push('worktree_branch_mismatch');
  if (typeof w.gitFileHash !== 'string' || !GIT_FILE_HASH_RE.test(w.gitFileHash)) r.push('worktree_git_file_unobserved');
  var entries = w.changedEntries;
  if (!Array.isArray(entries) || !entries.every(function (x) { return _isObj(x) && typeof x.path === 'string' && ENTRY_STATUS.indexOf(x.status) !== -1 && typeof x.isSymlink === 'boolean'; })) {
    r.push('worktree_changes_unobserved');
  } else if (READ_ONLY_STAGES.indexOf(run.stage) !== -1) {
    if (entries.length) r.push('worktree_dirty_before_read_only_stage');
  } else {
    var dc = rs.classifyResumeDiff(run, entries.map(function (x) { return { path: x.path, status: x.status }; }));
    if (dc === 'unexpected') r.push('worktree_diff_unexpected');
    else if (dc !== 'none' && dc !== 'recorded_within_scope') r.push('worktree_diff_unknown');
    if (entries.some(function (x) { return x.isSymlink; })) r.push('worktree_symlink_present');
  }
  return r;
}

// ── 実行範囲（保存済み run.task が正本）──────────────────────
//   ★ 起動前の差分判定・settings・prompt / args・実行後の差分検証は、すべてこの関数が返す同じ範囲を使う。
//   ★ ctx.build の allowedPaths / forbiddenPaths は省略可。渡す場合は正規化して run.task と一致すること（拡大・縮小・不一致は拒否）。
//     呼び出し側の値で安全上重要な条件を上書きしない。worktreeRoot / mainRepoRoot も渡す場合は run と同じ場所であること。
//   意味が同じとみなす違い：配列の順序・重複・大文字小文字（Windows の path 比較と runStore の範囲判定に合わせる）・末尾 '/' の重複。
//   意味が違うとみなすもの：'docs'（file）と 'docs/'（directory）。
//   判定不能として拒否：絶対 path・drive・backslash・'.' / '..' / 空 segment・制御文字・ワイルドカード（* ? [ ] { }）・~ 始まり・空の allowedPaths。
var BUILD_KEYS = ['objective', 'acceptanceCriteria', 'stopConditions', 'previousOutputs', 'allowedPaths', 'forbiddenPaths', 'appendSystemPrompt', 'maxBudgetUsd', 'model', 'worktreeRoot', 'mainRepoRoot'];
function _scopeEntry(raw) {
  if (typeof raw !== 'string' || !raw || raw.length > 400 || /[\u0000-\u001f\\*?[\]{}]/.test(raw) || /^([A-Za-z]:|\/|~)/.test(raw)) return null;
  var dir = /\/$/.test(raw);
  var segs = raw.replace(/\/+$/, '').split('/');
  if (segs.some(function (s) { return s === '' || s === '.' || s === '..'; })) return null;
  return segs.join('/') + (dir ? '/' : '');
}
// 正規化した一覧（小文字 key で重複除去・key 順に整列）。不正な要素があれば null
function _normScope(list, allowEmpty) {
  if (!Array.isArray(list) || (!allowEmpty && list.length === 0)) return null;
  var byKey = {};
  for (var i = 0; i < list.length; i++) { var n = _scopeEntry(list[i]); if (n === null) return null; if (!byKey[n.toLowerCase()]) byKey[n.toLowerCase()] = n; }
  return Object.keys(byKey).sort().map(function (k) { return byKey[k]; });
}
function _covers(prefix, p) { var a = p.toLowerCase(), b = prefix.toLowerCase(); return b.slice(-1) === '/' ? a.indexOf(b) === 0 : a === b; }
function _sameSet(a, b) { return a.length === b.length && a.every(function (x, i) { return x.toLowerCase() === b[i].toLowerCase(); }); }
function resolveExecutionScope(run, build) {
  var r = [];
  var t = _isObj(run) && _isObj(run.task) ? run.task : null;
  var allowed = t ? _normScope(t.allowedPaths, false) : null;
  var forbidden = t ? _normScope(t.forbiddenPaths, true) : null;
  if (!allowed) r.push('run_allowed_paths_invalid');
  if (!forbidden) r.push('run_forbidden_paths_invalid');
  if (allowed && forbidden) {
    allowed.forEach(function (a) {
      if (forbidden.some(function (f) { return _covers(f, a); })) r.push('allowed_within_forbidden:' + a);
      if (rc.PROTECTED_PATHS.some(function (p) { return _covers(a, p) || _covers(p, a); })) r.push('allowed_covers_protected:' + a);
      if (/(^|\/)\.git(\/|$)/i.test(a) || /(^|\/)\.env(\.[^\/]*)?\/?$/i.test(a)) r.push('allowed_sensitive_path:' + a);
    });
  }
  var b = _isObj(build) ? build : null;
  if (!b) r.push('build_missing');
  else {
    var unknown = Object.keys(b).filter(function (k) { return BUILD_KEYS.indexOf(k) === -1; });
    if (unknown.length) r.push('build_unknown_keys');
    if (b.allowedPaths !== undefined) {
      var ba = _normScope(b.allowedPaths, false);
      if (!ba) r.push('build_allowed_paths_invalid');
      else if (allowed) {
        if (ba.some(function (x) { return !allowed.some(function (y) { return x.toLowerCase() === y.toLowerCase(); }); })) r.push('build_allowed_paths_expanded');
        if (!_sameSet(ba, allowed)) r.push('build_allowed_paths_mismatch');
      }
    }
    if (b.forbiddenPaths !== undefined) {
      var bf = _normScope(b.forbiddenPaths, true);
      if (!bf) r.push('build_forbidden_paths_invalid');
      else if (forbidden && !_sameSet(bf, forbidden)) r.push('build_forbidden_paths_mismatch');
    }
    if (b.worktreeRoot !== undefined && !wc.samePath(b.worktreeRoot, run.worktreePath)) r.push('build_worktree_root_mismatch');
    if (b.mainRepoRoot !== undefined && !wc.samePath(b.mainRepoRoot, run.mainRepoPath)) r.push('build_main_repo_root_mismatch');
  }
  return r.length ? { ok: false, reasons: r } : { ok: true, allowedPaths: allowed, forbiddenPaths: forbidden };
}

// ctx: { store, taskId, ownerId, clock():iso, cli:{ exePath, exeSha256, cliVersion }, approval,
//        build:{ objective, acceptanceCriteria[], stopConditions[], previousOutputs{}, appendSystemPrompt, maxBudgetUsd, model,
//                allowedPaths?[], forbiddenPaths?[], worktreeRoot?, mainRepoRoot? }（範囲・場所は run と一致検査だけ。resolveExecutionScope 参照）,
//        deps:{ spawn?, hashFile(path)->sha256, parentEnv, observeMain()->{autopilotStatusHash,protectedFingerprint},
//               observeWorktree()->{worktreePath,worktreeHead,branchTip,worktreeBranchRef,changedEntries[],gitFileHash}, readTranscript(sessionId)->string|null,
//               randomUUID()->uuid, timers? }, limits?, allowRealSpawn? }
//   ★ main の期待値は ctx から受け取らない（run 記録から導き、承認と照合する）。
// 戻り値: { ok:true, disposition, invocationId, sessionId, revision } | { ok:false, error, phase, ... }（どの経路でも 1 回だけ解決する）
function runInvocation(ctx) {
  return new Promise(function (resolve) {
    var settled = false;
    var once = function (r) { if (settled) return; settled = true; resolve(r); };
    try { _run(ctx, once); } catch (e) { once(_err('executor_internal_error', { phase: 'unknown' })); }
  });
}

function _run(ctx, done) {
  var c = _isObj(ctx) ? ctx : {};
  var d = _isObj(c.deps) ? c.deps : {};
  var L = Object.assign({}, DEFAULT_LIMITS, _isObj(c.limits) ? c.limits : {});
  var T = _isObj(d.timers) ? d.timers : { setTimeout: setTimeout, clearTimeout: clearTimeout, setInterval: setInterval, clearInterval: clearInterval };
  var clock = typeof c.clock === 'function' ? c.clock : function () { return new Date().toISOString(); };
  var fail = function (phase, code, extra) { done(_err(code, Object.assign({ phase: phase }, extra || {}))); };

  // ── 1. 起動前検証（どれか 1 つでも不成立なら予約・起動しない）──
  if (typeof c.ownerId !== 'string' || !UUID_RE.test(c.ownerId)) return fail('preflight', 'owner_id_invalid');
  var spawnFn = typeof d.spawn === 'function' ? d.spawn : (c.allowRealSpawn === true ? require('child_process').spawn : null);
  if (!spawnFn) return fail('preflight', 'real_spawn_disabled');
  if (typeof d.hashFile !== 'function' || typeof d.observeMain !== 'function' || typeof d.observeWorktree !== 'function' || typeof d.readTranscript !== 'function' || typeof d.randomUUID !== 'function') return fail('preflight', 'deps_incomplete');
  var now0 = clock();
  var rr = rs.readRun(c.store, c.taskId);
  if (!rr.ok) return fail('preflight', 'run_unreadable', { cause: rr.error });
  if (!rr.executable) return fail('preflight', 'run_read_only_v1');
  var run = rr.run;
  if (run.outcome !== null || run.gate !== 'none') return fail('preflight', 'run_not_active');
  var rStage = RUNNER_STAGE[run.stage];
  if (!rStage) return fail('preflight', 'stage_not_invocable');
  if (run.isolation.state !== 'verified' || run.isolation.worktreeHead !== run.baseHead) return fail('preflight', 'isolation_not_verified');   // main では起動しない
  var ol = rs.readOwnerLock(c.store, c.taskId);
  if (!ol.ok || !ol.exists || ol.ownerId !== c.ownerId || !run.lock || run.lock.ownerId !== c.ownerId || run.lock.pid !== ol.pid) return fail('preflight', 'not_owner');
  if (rs.lockStatus(run.lock, { now: now0, staleMs: L.staleMs }) !== 'active') return fail('preflight', 'lock_not_active');
  if (run.budget.invocations + 1 > run.budget.maxInvocations) return fail('preflight', 'run_invocation_limit_reached');   // run 全体の上限（承認ごとの上限とは別に検査）
  var cli = _isObj(c.cli) ? c.cli : {};
  var b = _isObj(c.build) ? c.build : {};
  var actualSha = null; try { actualSha = d.hashFile(cli.exePath); } catch (e) { actualSha = null; }
  if (typeof cli.exeSha256 !== 'string' || actualSha !== cli.exeSha256) return fail('preflight', 'cli_exe_mismatch');
  var ae = validateApproval(c.approval, { run: run, now: now0, exeSha256: actualSha, cliVersion: cli.cliVersion, maxBudgetUsd: b.maxBudgetUsd });
  if (ae.length) return fail('preflight', 'approval_invalid', { reasons: ae });
  var approvalSha256 = tc.canonicalSha256(c.approval);
  var scope = resolveExecutionScope(run, c.build);   // 実行範囲の正本は run.task（ctx.build は一致検査だけ）
  if (!scope.ok) return fail('preflight', 'execution_scope_invalid', { reasons: scope.reasons });
  var em = expectedMainFromRun(run);   // validateApproval で承認の値と一致済み
  var ev = cr.buildRunnerEnv(d.parentEnv || {});
  var expectEnv = cr.RUNNER_ENV_ALLOWLIST.concat(Object.keys(cr.RUNNER_ENV_FIXED)).slice().sort().join('|');
  if (!ev.ok || ev.containsCredential || ev.envNames.map(function (k) { return k.toUpperCase(); }).sort().join('|') !== expectEnv) return fail('preflight', 'env_not_allowlisted');
  var mainBefore; try { mainBefore = d.observeMain(); } catch (e) { mainBefore = null; }
  if (!_isObj(mainBefore) || mainBefore.autopilotStatusHash !== em.autopilotStatusHash || mainBefore.protectedFingerprint !== em.protectedFingerprint) return fail('preflight', 'main_state_mismatch');
  var wtBefore; try { wtBefore = d.observeWorktree(); } catch (e) { wtBefore = null; }
  var we = validateWorktreeBeforeLaunch(run, wtBefore);
  if (we.length) return fail('preflight', we[0] === 'worktree_unobservable' ? 'worktree_unobservable' : 'worktree_state_mismatch', { reasons: we });

  // ── 2. Runner 契約で args / settings / prompt を生成 ──
  var sessionId = d.randomUUID(), invocationId = d.randomUUID();
  var st = cr.buildRunnerSettings({ stage: rStage, worktreeRoot: run.worktreePath, mainRepoRoot: run.mainRepoPath, allowedPaths: scope.allowedPaths, forbiddenPaths: scope.forbiddenPaths });
  if (!st.ok) return fail('preflight', 'settings_build_failed', { cause: st.error });
  var pr = cr.buildStagePrompt({ taskId: run.taskId, stage: rStage, worktreeRoot: run.worktreePath, allowedPaths: scope.allowedPaths, forbiddenPaths: scope.forbiddenPaths,
    objective: b.objective, acceptanceCriteria: b.acceptanceCriteria, previousOutputs: b.previousOutputs || {}, stopConditions: b.stopConditions });
  if (!pr.ok) return fail('preflight', 'prompt_build_failed', { cause: pr.error });
  var argsInput = { stage: rStage, sessionId: sessionId, outputSchema: pr.outputSchema, settings: st.settings, appendSystemPrompt: b.appendSystemPrompt,
    maxBudgetUsd: b.maxBudgetUsd, approvedRemainingBudgetUsd: Math.min(c.approval.maxBudgetUsdPerInvocation, run.budget.capUsd - run.budget.spentUsd) };
  if (b.model !== undefined) argsInput.model = b.model;
  var ar = cr.buildRunnerArgs(argsInput);
  if (!ar.ok) return fail('preflight', 'args_build_failed', { cause: ar.error });
  var args = ar.args.slice();

  // ── 3. 予約を所有者として保存（成功した場合だけ起動）──
  var bg = rs.beginInvocation(run, { now: now0, invocationId: invocationId, sessionId: sessionId, stage: run.stage,
    launch: { exeSha256: actualSha, cliVersion: cli.cliVersion, argvSha256: _sha(JSON.stringify(args)), promptSha256: _sha(pr.prompt), settingsSha256: _sha(JSON.stringify(st.settings)),
      childVarNames: ev.envNames.map(function (k) { return k.toUpperCase(); }).sort(), timeoutMs: L.timeoutMs, maxBuffer: L.stdoutMax,
      approvalId: c.approval.approvalId, approvalSha256: approvalSha256 } });
  if (!bg.ok) return fail('reserve', 'reserve_rejected', { cause: bg.error });
  var sv = rs.saveRunAsOwner(c.store, bg.run, { ownerId: c.ownerId, expectedRevision: run.revision, now: now0, staleMs: L.staleMs });
  if (!sv.ok) return fail('reserve', 'reserve_save_failed', { cause: sv.error });
  var latest = sv.run;
  var invocationsBefore = run.budget.invocations;
  var LEFT = { recordLeft: 'started', lockLeft: true, spawnCount: 1 };

  // ── 4. 起動（非同期 spawn）と監視 ──
  var t0 = Date.now();
  var p = { pid: null, spawnError: null, exitObserved: false, closeObserved: false, exitCode: null, signal: null, killed: false, killReason: null,
    timedOut: false, bufferExceeded: false, stdoutExceeded: false, stdoutBytes: 0, stderrBytes: 0, ownershipLost: false, heartbeatError: false, monitorError: false };
  var chunks = [];
  var queue = Promise.resolve(), stopping = false, finished = false, processed = false, timers = [];
  function enqueue(fn) { queue = queue.then(fn, fn); return queue; }
  function clearAll() { timers.forEach(function (x) { try { if (x.kind === 'i') T.clearInterval(x.h); else T.clearTimeout(x.h); } catch (e) { /* noop */ } }); timers = []; }
  // 監視側の例外：子プロセスを止め、完了を保存せずに停止する（観測値を信用しない）
  function guard(fn) {
    return function () {
      try { return fn.apply(this, arguments); }
      catch (e) { p.monitorError = true; try { kill('monitor_internal_error'); } catch (x) { settleNow(); } }
    };
  }
  var child;
  try { child = spawnFn(cli.exePath, args, { cwd: run.worktreePath, env: ev.env, shell: false, windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] }); }
  catch (e) { p.spawnError = e && e.code ? e.code : 'spawn_error'; return afterProcess(); }
  if (!child) { p.spawnError = 'spawn_error'; return afterProcess(); }
  p.pid = Number.isInteger(child.pid) ? child.pid : null;
  function kill(reason) {
    if (p.killed) return;
    p.killed = true; p.killReason = reason;
    try { child.kill('SIGKILL'); } catch (e) { /* 終了確認は exit イベントだけで行う */ }
    timers.push({ kind: 't', h: T.setTimeout(guard(function () { settle(); }), L.killWaitMs) });   // kill 後の exit 待ちも上限付き
  }
  try {
    child.on('error', guard(function (e) { if (!p.exitObserved && p.pid === null) p.spawnError = e && e.code ? e.code : 'spawn_error'; settle(); }));
    if (child.stdout) child.stdout.on('data', guard(function (buf) {
      var n = buf.length; p.stdoutBytes += n;
      if (p.stdoutBytes > L.stdoutMax) { p.bufferExceeded = true; p.stdoutExceeded = true; chunks = []; kill('stdout_limit'); return; }
      chunks.push(buf);
    }));
    if (child.stderr) child.stderr.on('data', guard(function (buf) {
      p.stderrBytes += buf.length;                                        // 本文は保持しない
      if (p.stderrBytes > L.stderrMax) { p.bufferExceeded = true; kill('stderr_limit'); }
    }));
    child.on('exit', guard(function (code, signal) {
      p.exitObserved = true; p.exitCode = Number.isInteger(code) ? code : null; p.signal = SIGNALS.indexOf(signal) !== -1 ? signal : null;
      timers.push({ kind: 't', h: T.setTimeout(guard(function () { settle(); }), L.drainWaitMs) });   // exit 後の出力回収（close）待ちは上限付き
      if (p.closeObserved) settle();
    }));
    child.on('close', guard(function () { p.closeObserved = true; if (p.exitObserved) settle(); }));
    timers.push({ kind: 't', h: T.setTimeout(guard(function () { p.timedOut = true; kill('timeout'); }), L.timeoutMs) });
    timers.push({ kind: 'i', h: T.setInterval(guard(function () {
      if (stopping) return;
      enqueue(function () {
        if (stopping || p.ownershipLost || p.heartbeatError) return;
        try {
          var hb = rs.heartbeatLock(latest, { now: clock(), pid: latest.lock.pid, ownerId: c.ownerId });
          var s = hb.ok ? rs.saveRunAsOwner(c.store, hb.run, { ownerId: c.ownerId, expectedRevision: latest.revision, now: clock(), staleMs: L.staleMs }) : hb;
          if (s.ok) latest = s.run;
          else { p.ownershipLost = true; kill('heartbeat_save_failed'); }   // 所有権喪失・保存失敗 → 停止処理へ（自動再起動しない）
        } catch (e) { p.heartbeatError = true; kill('heartbeat_internal_error'); }   // heartbeat 処理自体の例外 → 停止処理へ
      });
    }), L.heartbeatMs) });
    try { if (child.stdin) { child.stdin.on('error', function () { /* 起動失敗時は error / exit で扱う */ }); child.stdin.end(pr.prompt); } } catch (e) { /* noop */ }
  } catch (e) {
    p.monitorError = true; kill('monitor_setup_failed');
  }

  function settle() {
    if (finished) return;
    // 呼び出し元：exit+close／exit 後の drain 上限／kill 後の exit 待ち上限／spawn error
    if (!p.exitObserved && !p.killed && p.spawnError === null) return;
    settleNow();
  }
  function settleNow() {
    if (finished) return;
    finished = true; stopping = true; clearAll();
    enqueue(function () { return null; }).then(afterProcess, afterProcess);
  }

  // ── 5. 観測と一括保存 ──
  function afterProcess() {
    if (processed) return;
    processed = true;
    stopping = true; clearAll();
    if (p.ownershipLost) return fail('heartbeat', 'ownership_lost_or_heartbeat_save_failed', LEFT);
    if (p.heartbeatError) return fail('heartbeat', 'heartbeat_internal_error', LEFT);
    if (p.monitorError) return fail('monitor', 'monitor_internal_error', LEFT);
    var now, state, result, changed, stageOutput = null;
    try {
      now = clock();
      var termination = p.spawnError !== null && p.pid === null ? 'not_started'
        : p.killed ? (p.exitObserved ? 'descendants_unknown' : 'exit_event_missing')
        : (p.exitObserved && p.closeObserved) ? 'exit_event_observed'
        : p.exitObserved ? 'descendants_unknown' : 'exit_event_missing';
      state = termination === 'exit_event_observed' || termination === 'not_started' ? 'finished' : 'unconfirmed';
      var stdout = p.closeObserved && !p.bufferExceeded && !p.killed ? Buffer.concat(chunks).toString('utf8') : null;
      chunks = [];
      var env = stdout ? cr.parseRunnerEnvelope(stdout) : { ok: false, error: p.stdoutExceeded ? 'stdout_over_limit' : 'stdout_unavailable' };
      var envParse = env.ok ? 'ok' : (env.error === 'stdout_over_limit' ? 'over_limit' : env.error === 'stdout_unavailable' ? 'absent' : 'invalid');
      stdout = null;
      var ov = cr.validateStageOutput(rStage, env.ok ? env.structuredOutput : null);
      stageOutput = env.ok && ov.ok ? env.structuredOutput : null;   // 次 stage の previousOutputs 用（メモリ上で返すだけ・保存しない）
      var mainAfter; try { mainAfter = d.observeMain(); } catch (e) { mainAfter = null; }
      var wtAfter; try { wtAfter = d.observeWorktree(); } catch (e) { wtAfter = null; }
      var snap = function (w, m) { return _isObj(w) && _isObj(m) ? Object.assign({}, w, { mainAutopilotStatusHash: m.autopilotStatusHash, mainProtectedFingerprint: m.protectedFingerprint }) : null; };
      var diff = cr.validatePostRunDiff({ contract: { stage: rStage, allowedPaths: scope.allowedPaths, forbiddenPaths: scope.forbiddenPaths, baseHead: run.baseHead, branchRef: 'refs/heads/' + run.branch,
        expectedMainAutopilotStatusHash: em.autopilotStatusHash, expectedProtectedFingerprint: em.protectedFingerprint }, before: snap(wtBefore, mainBefore), after: snap(wtAfter, mainAfter) });
      var safetyReasons = [];
      if (!_isObj(mainAfter)) safetyReasons.push('main_unobservable_after');
      else {
        if (mainAfter.autopilotStatusHash !== em.autopilotStatusHash) safetyReasons.push('main_status_changed');
        if (mainAfter.protectedFingerprint !== em.protectedFingerprint) safetyReasons.push('main_protected_changed');
      }
      var safety = { result: !_isObj(mainAfter) ? 'unverified' : (safetyReasons.length ? 'violated' : 'ok'), reasonCodes: _codes(safetyReasons) };
      var text = null; try { text = d.readTranscript(sessionId); } catch (e) { text = null; }
      var an = tc.analyzeTranscript(text, { sessionId: sessionId, worktreeRoot: run.worktreePath, allowedTools: cr.STAGE_POLICY[rStage].tools });
      text = null;
      var envSoSha = env.ok && _isObj(env.structuredOutput) ? tc.canonicalSha256(env.structuredOutput) : null;
      var tsum = an.ok ? an.summary : { verdict: 'unverified_record_unparseable', toolCounts: { Read: 0, Glob: 0, Grep: 0, StructuredOutput: 0, other: 0 }, unparseable: 0, outside: 0, missingResults: 0, errorResults: 0, structuredOutputComparison: 'not_present' };
      tsum.structuredOutputComparison = an.ok ? tc.compareStructuredOutput(an.structuredOutputInputSha256, envSoSha, an.structuredOutputCount) : 'not_present';
      // 承認に束縛された条件付き方針の場合だけ、未知 tool が StructuredOutput 1 件だけの未検証を条件付きで受け入れる（既定 'block' では変えない）
      if (c.approval.structuredOutputPolicy !== SO_POLICY_BLOCK && tsum.verdict === 'unverified_unknown_tool'
        && tc.evaluateStructuredOutputConditional(an, { envelopeSha256: envSoSha, schemaOk: ov.ok === true }).accepted) tsum.verdict = 'ok_structured_output_conditional';
      var cls = cr.classifyRunnerFailure({ stage: rStage, exitCode: p.exitCode, timedOut: p.timedOut, envelope: env, outputValidation: ov, postRunDiff: diff,
        budget: { capUsd: run.budget.capUsd, spentUsd: run.budget.spentUsd, invocations: invocationsBefore, maxInvocations: run.budget.maxInvocations, costUnknown: run.budget.costUnknown },
        expectedSessionId: sessionId });
      var outcome = cls.outcome, reasons = cls.reasons.slice();
      if (state !== 'finished' && outcome === 'ok') { outcome = 'blocked'; reasons.unshift('termination_unconfirmed'); }   // 終了未確認を ok にしない
      changed = rStage === 'implement' && Array.isArray(diff.changedPaths) ? diff.changedPaths.filter(function (x) { return typeof x === 'string'; }) : [];
      var models = env.ok && _isObj(env.modelUsage) ? env.modelUsage : { models: [], unlistedCount: 0 };
      var goodModels = (models.models || []).filter(function (m) { return MODEL_ID_RE.test(m); });
      var sessionState = !env.ok ? 'unverified_no_envelope' : env.sessionIdState === 'absent' ? 'missing' : env.sessionIdState !== 'string' || !UUID_RE.test(env.sessionId) ? 'invalid'
        : env.sessionId === sessionId ? 'match' : 'mismatch';
      var errClass = p.spawnError ? (['ENOENT', 'EACCES', 'EPERM'].indexOf(p.spawnError) !== -1 ? p.spawnError : 'spawn_error') : p.timedOut ? 'ETIMEDOUT' : p.bufferExceeded ? 'ENOBUFS' : null;
      result = {
        process: { exitCode: p.exitCode, signal: p.signal, timedOut: p.timedOut, bufferExceeded: p.bufferExceeded, errorClass: errClass, wallMs: Math.max(0, Date.now() - t0),
          stdoutBytes: p.stdoutBytes, stderrBytes: p.stderrBytes, termination: termination },
        cost: env.ok && typeof env.costUsd === 'number' ? { basis: rs.COST_BASIS, state: 'known', cliReportedUsd: env.costUsd } : { basis: rs.COST_BASIS, state: 'unknown', cliReportedUsd: null },
        envelope: env.ok ? { parse: 'ok', isError: env.isError, subtype: env.subtype === null ? null : (SUBTYPES.indexOf(env.subtype) !== -1 ? env.subtype : 'other'),
          apiErrorStatus: { state: env.apiErrorStatus.state, value: env.apiErrorStatus.state === 'number' ? env.apiErrorStatus.value : null },
          numTurns: env.numTurns, permissionDenials: env.permissionDenials, modelIds: goodModels.slice(0, 10), unlistedModelCount: (models.unlistedCount || 0) + (models.models || []).length - goodModels.length }
          : { parse: envParse, isError: null, subtype: null, apiErrorStatus: { state: 'not_applicable', value: null }, numTurns: null, permissionDenials: null, modelIds: [], unlistedModelCount: 0 },
        schema: { ok: ov.ok, errorCodes: ov.ok ? [] : _codes(ov.errors), structuredSource: env.ok && env.structuredSource ? env.structuredSource : null },
        session: sessionState,
        diff: { result: _isObj(diff) && ['ok', 'blocked', 'human_approval_required'].indexOf(diff.result) !== -1 ? diff.result : 'unavailable', reasonCodes: _codes(diff && diff.reasons), changedCount: changed.length },
        safety: safety,
        transcript: tsum,
        classification: { outcome: outcome, reasonCodes: _codes(reasons) },
        structuredOutputSha256: envSoSha,
      };
    } catch (e) {
      return fail('observe', 'observation_failed', LEFT);   // 解析・観測の例外（保存失敗とは区別）
    }
    // 完了は heartbeat と同じ直列キューで、最新の保存済み状態から 1 回だけ作って保存する
    enqueue(function () {
      var base = rs.heartbeatLock(latest, { now: now, pid: latest.lock.pid, ownerId: c.ownerId });
      if (!base.ok) return { ok: false, code: 'complete_heartbeat_failed', cause: base.error };
      var cp = rs.completeInvocation(base.run, { now: now, invocationId: invocationId, state: state, result: result, changedPaths: changed });
      if (!cp.ok) return { ok: false, code: 'complete_rejected', cause: cp.error };
      var s = rs.saveRunAsOwner(c.store, cp.run, { ownerId: c.ownerId, expectedRevision: latest.revision, now: now, staleMs: L.staleMs });
      return s.ok ? s : { ok: false, code: 'complete_save_failed', cause: s.error };
    }).then(function (s) {
      if (!s || !s.ok) return fail('complete', (s && s.code) || 'complete_internal_error', Object.assign({ cause: s && s.cause }, LEFT));
      var inv = null;
      try { inv = s.run.invocations.filter(function (x) { return x.invocationId === invocationId; })[0]; } catch (e) { inv = null; }
      if (!inv || !inv.result) return fail('complete', 'complete_result_unreadable', { recordSaved: true, lockLeft: true });
      done({ ok: true, invocationId: invocationId, sessionId: sessionId, state: inv.state, disposition: inv.result.disposition, dispositionReason: inv.result.dispositionReason,
        revision: s.run.revision, runOutcome: s.run.outcome, runGate: s.run.gate,
        stageOutput: inv.result.disposition === 'none' ? stageOutput : null });
    }, function () {
      fail('complete', 'complete_internal_error', LEFT);   // 完了処理（保存前後の組み立て）の例外
    }).then(null, function () { fail('complete', 'complete_internal_error', LEFT); });
  }
}

module.exports = {
  DEFAULT_LIMITS: DEFAULT_LIMITS,
  RUNNER_STAGE: RUNNER_STAGE,
  APPROVAL_KEYS: APPROVAL_KEYS,
  BILLING_SCOPE: BILLING_SCOPE,
  validateApproval: validateApproval,
  validateWorktreeBeforeLaunch: validateWorktreeBeforeLaunch,
  resolveExecutionScope: resolveExecutionScope,
  protectedFingerprintFromRun: protectedFingerprintFromRun,
  expectedMainFromRun: expectedMainFromRun,
  approvalUseCount: approvalUseCount,
  runInvocation: runInvocation,
};
