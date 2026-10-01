'use strict';
// tools/devAutopilot/testRunner.js
// Development Autopilot V1 — Stage 4D / Decision 121：隔離 worktree での mandatory safe test の実行（node <file>・1 件ずつ）
//
//   ★ モデルが変更したコードをホスト上で実行する経路。Decision 121 により、Human が差分を確認して発行した single-use の
//     テスト実行承認（差分 hash・test 一覧・run に束縛。Orchestrator が実行直前に消費済み）がある場合だけ実行する。承認なしの自動実行はしない。
//   ★ env の制限（allowlist）・shell:false・cwd 固定・timeout・Protected / audit / 差分の監視は、OS レベルの隔離ではない。
//     実行されるコードは、この PC のユーザー権限でファイル・ネットワーク・プロセスにアクセスし得る（V1 の既知の限界）。
//   ★ 実行条件：テスト実行承認（消費済みの記録）の test 一覧・worktree と完全一致・test file 名の形式・worktree 内の通常 file。自動 retry なし。
//   ★ 承認が無い・一致しない場合は child_process を読み込まずに拒否する。出力本文は保存・返却しない（byte 数だけ）。

var path = require('path');
var fs = require('fs');
var wc = require('./worktreeController');

var TEST_APPROVAL_KIND = 'enbisou-test-execution-approval';
var TEST_FILE_RE = /^[A-Za-z0-9._-]+\.test\.js$/;
var DEFAULTS = Object.freeze({ timeoutMs: 120000, maxOutputBytes: 1024 * 1024 });

function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _err(code, extra) { return Object.assign({ ok: false, error: code }, extra || {}); }

// input: { worktreePath, files[], testApproval（Orchestrator が消費したテスト実行承認）, parentEnv, timeoutMs?, maxOutputBytes?, spawnSync?, fs? }
// 戻り値: { ok:true, results:[{ file, exitCode, timedOut, outputBytes }] } | { ok:false, error }
function runSafeTests(input) {
  var i = _isObj(input) ? input : {};
  var fsx = i.fs || fs;
  if (!wc.validateWindowsAbsPath(i.worktreePath).ok) return _err('worktree_path_invalid');
  if (!Array.isArray(i.files) || !i.files.length || !i.files.every(function (f) { return typeof f === 'string' && TEST_FILE_RE.test(f); })) return _err('files_invalid');
  var ta = i.testApproval;
  if (!_isObj(ta) || ta.kind !== TEST_APPROVAL_KIND || !Array.isArray(ta.testFiles)) return _err('test_approval_required');
  if (JSON.stringify(i.files.slice().sort()) !== JSON.stringify(ta.testFiles.slice().sort())) return _err('test_approval_files_mismatch');
  if (typeof ta.worktreePath !== 'string' || !wc.samePath(ta.worktreePath, i.worktreePath)) return _err('test_approval_worktree_mismatch');
  var envR = wc.buildChildEnv(i.parentEnv || {});
  if (!envR.ok) return _err('env_invalid');
  var spawnSync = typeof i.spawnSync === 'function' ? i.spawnSync : require('child_process').spawnSync;   // 承認の確認後にだけ読み込む
  var timeoutMs = Number.isInteger(i.timeoutMs) && i.timeoutMs > 0 ? i.timeoutMs : DEFAULTS.timeoutMs;
  var maxOut = Number.isInteger(i.maxOutputBytes) && i.maxOutputBytes > 0 ? i.maxOutputBytes : DEFAULTS.maxOutputBytes;
  var results = [];
  for (var k = 0; k < i.files.length; k++) {
    var f = i.files[k], abs = path.join(i.worktreePath, f);
    try { var st = fsx.lstatSync(abs); if (!st.isFile() || st.isSymbolicLink()) return _err('test_file_not_regular'); }
    catch (e) { return _err('test_file_missing'); }
    var r;
    try {
      r = spawnSync(process.execPath, [f], { cwd: i.worktreePath, env: envR.env, shell: false, windowsHide: true, timeout: timeoutMs, maxBuffer: maxOut, stdio: ['ignore', 'pipe', 'pipe'] });
    } catch (e) { r = { status: null, signal: null, error: e }; }
    var timedOut = !!(r && r.error && r.error.code === 'ETIMEDOUT');
    var outBytes = (r && r.stdout ? r.stdout.length : 0) + (r && r.stderr ? r.stderr.length : 0);
    results.push({ file: f, exitCode: r && Number.isInteger(r.status) ? r.status : null, timedOut: timedOut, outputBytes: outBytes });
  }
  return { ok: true, results: results };
}

module.exports = { TEST_APPROVAL_KIND: TEST_APPROVAL_KIND, runSafeTests: runSafeTests };
