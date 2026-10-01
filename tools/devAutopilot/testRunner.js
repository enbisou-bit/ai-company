'use strict';
// tools/devAutopilot/testRunner.js
// Development Autopilot V1 — Stage 4D：隔離 worktree での mandatory safe test の実行（node <file>・1 件ずつ）
//
//   ★ モデルが変更したコードをホストで実行する経路になるため、既定では無効（HOST_TEST_EXECUTION_ADOPTED = false）。
//     spawnSync を差し替えない限り child_process を読み込まず、実行しない。有効化（新しい Human gate の正式採用）は別途判断。
//   ★ 実行条件：test file 名の形式・worktree 内の通常 file・selector が選んだ mandatory safe test だけ（呼び出し側で束縛）。
//     shell:false・cwd は worktree・env は allowlist（認証 env を渡さない）・timeout・出力上限あり。自動 retry なし。
//   ★ 出力本文は保存・返却しない（byte 数だけ）。

var path = require('path');
var fs = require('fs');
var wc = require('./worktreeController');

var HOST_TEST_EXECUTION_ADOPTED = false;
var TEST_FILE_RE = /^[A-Za-z0-9._-]+\.test\.js$/;
var DEFAULTS = Object.freeze({ timeoutMs: 120000, maxOutputBytes: 1024 * 1024 });

function _isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _err(code, extra) { return Object.assign({ ok: false, error: code }, extra || {}); }

// input: { worktreePath, files[], parentEnv, timeoutMs?, maxOutputBytes?, spawnSync?, fs? }
// 戻り値: { ok:true, results:[{ file, exitCode, timedOut, outputBytes }] } | { ok:false, error }
function runSafeTests(input) {
  var i = _isObj(input) ? input : {};
  var fsx = i.fs || fs;
  var spawnSync = typeof i.spawnSync === 'function' ? i.spawnSync : (HOST_TEST_EXECUTION_ADOPTED ? require('child_process').spawnSync : null);
  if (!spawnSync) return _err('host_test_execution_not_adopted');
  if (!wc.validateWindowsAbsPath(i.worktreePath).ok) return _err('worktree_path_invalid');
  if (!Array.isArray(i.files) || !i.files.length || !i.files.every(function (f) { return typeof f === 'string' && TEST_FILE_RE.test(f); })) return _err('files_invalid');
  var envR = wc.buildChildEnv(i.parentEnv || {});
  if (!envR.ok) return _err('env_invalid');
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

module.exports = { HOST_TEST_EXECUTION_ADOPTED: HOST_TEST_EXECUTION_ADOPTED, runSafeTests: runSafeTests };
