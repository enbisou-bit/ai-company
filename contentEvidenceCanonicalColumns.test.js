'use strict';
// contentEvidenceCanonicalColumns.test.js
// Safety Foundation B1: Canonical Content Evidence / Claims Protected Columns の deterministic テスト。
//
//   ★ 実行は必ずこのファイル名を明示指定する（node contentEvidenceCanonicalColumns.test.js）。
//   ★ 外部出口は本ファイル冒頭で fail-closed に封鎖する（他の require より前）:
//       network（fetch / http / https / net / tls）・real credential env・.env 読み込み・
//       禁止 module（openaiClient / claudeClient / costTracker / lib/costDb / conversationHistory /
//       dotenv / @supabase/supabase-js / server.js 本体）・filesystem write。
//   ★ server.js は require しない。POST /api/output-drafts の handler と
//     buildContentEvidenceContextForCase() をソースから抽出し vm で実行する。
//   ★ Supabase は in-memory fake client のみ（lib/supabase.js は require.cache へ fake を事前注入し、実ファイルは評価しない）。
//   ★ Protected 9件の hash を開始時・終了時に read-only で取得し、全件一致を assert する。

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');
const Module = require('module');

const ROOT = __dirname;
const violations = [];   // sandbox 違反（1件でもあれば FAIL）
const counters = { network: 0, blockedModules: 0, envFileReads: 0, fsWrites: 0 };

// ══════════════════════════════════════════════════════════════
// 0. Protected 9件（開始時 hash・read-only）
//   2026-09-16 server.test.js accidental execution 後の baseline（user-cont-1〜4 を含む）。
// ══════════════════════════════════════════════════════════════
const PROTECTED_FILES = [
  'cost-logs.json',
  'data/conversations/_meta.json',
  'claude-cost-logs.json',
  'claude-quality-history.json',
  'backup-dup-candidates-20260714/dup-candidates-123.csv',
  'backup-dup-candidates-20260714/dup-candidates-123.json',
  'data/conversations/user-cont-1_line_web.json',
  'data/conversations/user-cont-2_line_estimate.json',
  'data/conversations/user-cont-3_line_leader.json',
  'data/conversations/user-cont-4_line_video.json',
];
const PROTECTED_BASELINE = {
  'cost-logs.json': 'ce24d4808bc7bbbf1b517b12c6bce65e',
  'data/conversations/_meta.json': 'b1f27d5f863f8fe20edc686157fbc992',
  'data/conversations/user-cont-1_line_web.json': 'dbceb6d32a3dda1fb9b5d721325089d5',
  'data/conversations/user-cont-2_line_estimate.json': '8124d35bad188d047ac162c1f38a0a69',
  'data/conversations/user-cont-3_line_leader.json': 'ab4e713e61a9ecc0496dad41c2f13536',
  'data/conversations/user-cont-4_line_video.json': '12ab03f1cc7d686de163ae4483b01c54',
};
function hashProtected() {
  const out = {};
  PROTECTED_FILES.forEach(function (rel) {
    try { out[rel] = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'); }
    catch (e) { out[rel] = 'unreadable:' + e.code; }
  });
  return out;
}
const protectedBefore = hashProtected();

// ══════════════════════════════════════════════════════════════
// 1. Sandbox: network 封鎖（module を先に取得して関数を置換 → 以後の require も封鎖）
// ══════════════════════════════════════════════════════════════
function blockedNetwork(name) {
  return function () {
    counters.network++;
    violations.push('network:' + name);
    throw new Error('SANDBOX_BLOCKED_NETWORK:' + name);
  };
}
['http', 'https'].forEach(function (m) {
  const mod = require(m);
  mod.request = blockedNetwork(m + '.request');
  mod.get = blockedNetwork(m + '.get');
});
{
  const net = require('net');
  net.connect = blockedNetwork('net.connect');
  net.createConnection = blockedNetwork('net.createConnection');
  net.Socket.prototype.connect = blockedNetwork('net.Socket.connect');
  const tls = require('tls');
  tls.connect = blockedNetwork('tls.connect');
}
globalThis.fetch = blockedNetwork('fetch');

// ══════════════════════════════════════════════════════════════
// 2. Sandbox: real credential env 除去
// ══════════════════════════════════════════════════════════════
const CREDENTIAL_ENV_PATTERN = /^(OPENAI|ANTHROPIC|CLAUDE|SUPABASE|NEXT_PUBLIC_SUPABASE|LINE_|WEB_SESSION|CAROUSEL_)/i;
Object.keys(process.env).forEach(function (k) { if (CREDENTIAL_ENV_PATTERN.test(k)) delete process.env[k]; });

// ══════════════════════════════════════════════════════════════
// 3. Sandbox: filesystem（.env 読み込み禁止・write 系禁止）
// ══════════════════════════════════════════════════════════════
function isEnvFile(p) {
  try { return /^\.env(\..*)?$/.test(path.basename(String(p))); } catch (e) { return false; }
}
function guardEnvRead(obj, name) {
  const orig = obj[name];
  if (typeof orig !== 'function') return;
  obj[name] = function (p) {
    if (isEnvFile(p)) {
      counters.envFileReads++;
      violations.push('env_file_read:' + name);
      throw new Error('SANDBOX_BLOCKED_ENV_READ');
    }
    return orig.apply(this, arguments);
  };
}
['readFileSync', 'readFile', 'existsSync', 'statSync', 'createReadStream'].forEach(function (n) { guardEnvRead(fs, n); });
guardEnvRead(fs.promises, 'readFile');

function blockedWrite(name) {
  return function () {
    counters.fsWrites++;
    violations.push('fs_write:' + name);
    throw new Error('SANDBOX_BLOCKED_FS_WRITE:' + name);
  };
}
['writeFileSync', 'appendFileSync', 'renameSync', 'unlinkSync', 'mkdirSync', 'rmSync', 'rmdirSync', 'copyFileSync',
  'truncateSync', 'symlinkSync', 'cpSync', 'writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir',
  'copyFile', 'truncate', 'createWriteStream'].forEach(function (n) { if (typeof fs[n] === 'function') fs[n] = blockedWrite('fs.' + n); });
['writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir', 'copyFile', 'truncate'].forEach(function (n) {
  if (typeof fs.promises[n] === 'function') fs.promises[n] = blockedWrite('fs.promises.' + n);
});
{
  const origOpenSync = fs.openSync;
  fs.openSync = function (p, flags) {
    if (flags !== undefined && !/^r$/.test(String(flags)) && flags !== 0) return blockedWrite('fs.openSync:' + flags)();
    return origOpenSync.apply(this, arguments);
  };
}

// ══════════════════════════════════════════════════════════════
// 4. Sandbox: module 封鎖（lib/supabase.js は fake を事前注入）
// ══════════════════════════════════════════════════════════════
let currentFake = null;
const fakeClientProxy = { from: function (t) { return currentFake.from(t); } };
const SUPABASE_PATH = path.join(ROOT, 'lib', 'supabase.js');
require.cache[SUPABASE_PATH] = { id: SUPABASE_PATH, filename: SUPABASE_PATH, loaded: true, exports: { supabase: fakeClientProxy } };

const BLOCKED_BARE = new Set(['axios', 'dotenv', '@supabase/supabase-js', 'http', 'https', 'net', 'tls', 'http2', 'undici',
  'node:http', 'node:https', 'node:net', 'node:tls', 'node:http2', 'child_process', 'node:child_process']);
const BLOCKED_FILES = new Set(['openaiClient.js', 'claudeClient.js', 'costTracker.js', 'lib/costDb.js',
  'conversationHistory.js', 'server.js', 'lib/supabase.js'].map(function (p) { return path.join(ROOT, p); }));
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (BLOCKED_BARE.has(request)) {
    counters.blockedModules++;
    violations.push('module:' + request);
    throw new Error('SANDBOX_BLOCKED_MODULE:' + request);
  }
  let filename = null;
  try { filename = Module._resolveFilename(request, parent, isMain); } catch (e) { filename = null; }
  if (filename && BLOCKED_FILES.has(filename) && !(filename === SUPABASE_PATH && require.cache[SUPABASE_PATH]
      && require.cache[SUPABASE_PATH].exports && require.cache[SUPABASE_PATH].exports.supabase === fakeClientProxy)) {
    counters.blockedModules++;
    violations.push('module:' + path.relative(ROOT, filename));
    throw new Error('SANDBOX_BLOCKED_MODULE:' + request);
  }
  return origLoad.apply(this, arguments);
};

// ══════════════════════════════════════════════════════════════
// 5. in-memory fake Supabase（PostgREST の列単位 upsert / update / select を最小再現）
// ══════════════════════════════════════════════════════════════
const BASE_COLUMNS = ['output_id', 'case_id', 'type', 'status', 'title', 'source_text', 'fields', 'quality', 'package_quality',
  'assigned_roles', 'schema_version', 'detection', 'review_state', 'content_type', 'content_value', 'created_at', 'updated_at', 'built_at'];
const CANONICAL_COLUMNS = ['content_evidence', 'content_claims', 'content_evidence_origin'];

function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

function makeFakeSupabase(options) {
  const opts = options || {};
  const columns = new Set(BASE_COLUMNS.concat(opts.migrated === false ? [] : CANONICAL_COLUMNS));
  const state = { rows: {}, calls: [], fail: {}, columns: columns };

  function defaultRow() { const r = {}; columns.forEach(function (c) { r[c] = null; }); return r; }
  function missingColumn(names) { return names.filter(function (n) { return !columns.has(n); })[0] || null; }
  function project(row, cols) {
    if (!cols || cols === '*') return { data: clone(row) };
    const names = cols.split(',').map(function (s) { return s.trim(); });
    const miss = missingColumn(names);
    if (miss) return { error: { message: 'column output_drafts.' + miss + ' does not exist' } };
    const o = {};
    names.forEach(function (n) { o[n] = row[n] === undefined ? null : clone(row[n]); });
    return { data: o };
  }

  function from(table) {
    if (table !== 'output_drafts') { violations.push('fake_unexpected_table:' + table); throw new Error('unexpected table ' + table); }
    const q = { op: null, payload: null, cols: null, filters: [] };
    function match(row) {
      return q.filters.every(function (f) {
        if (f[0] === 'eq') return row[f[1]] === f[2];
        if (f[0] === 'is') return f[2] === null ? (row[f[1]] === null || row[f[1]] === undefined) : row[f[1]] === f[2];
        return false;
      });
    }
    async function exec(single) {
      state.calls.push({ op: q.op, cols: q.cols, filters: clone(q.filters), payloadKeys: q.payload ? Object.keys(q.payload) : null });
      const failFn = state.fail[q.op];
      if (typeof failFn === 'function' && failFn(q)) return { data: null, error: { message: 'injected_failure' } };
      if (q.op === 'upsert') {
        const miss = missingColumn(Object.keys(q.payload));
        if (miss) return { error: { message: 'column ' + miss + ' does not exist' } };
        const id = q.payload.output_id;
        state.rows[id] = Object.assign(state.rows[id] || defaultRow(), clone(q.payload));
        return { data: null, error: null };
      }
      if (q.op === 'update') {
        const miss = missingColumn(Object.keys(q.payload));
        if (miss) return { data: null, error: { message: 'column ' + miss + ' does not exist' } };
        const matched = Object.keys(state.rows).map(function (k) { return state.rows[k]; }).filter(match);
        matched.forEach(function (r) { Object.assign(r, clone(q.payload)); });
        if (q.cols) {
          const data = [];
          for (let i = 0; i < matched.length; i++) {
            const p = project(matched[i], q.cols);
            if (p.error) return { data: null, error: p.error };
            data.push(p.data);
          }
          return { data: data, error: null };
        }
        return { data: null, error: null };
      }
      // select
      const rows = Object.keys(state.rows).map(function (k) { return state.rows[k]; }).filter(match);
      if (single) {
        if (rows.length === 0) {
          if (q.cols && q.cols !== '*') { const miss = missingColumn(q.cols.split(',').map(function (s) { return s.trim(); })); if (miss) return { data: null, error: { message: 'column output_drafts.' + miss + ' does not exist' } }; }
          return { data: null, error: null };
        }
        const p = project(rows[0], q.cols);
        return p.error ? { data: null, error: p.error } : { data: p.data, error: null };
      }
      const data = [];
      for (let j = 0; j < rows.length; j++) { const p2 = project(rows[j], q.cols); if (p2.error) return { data: null, error: p2.error }; data.push(p2.data); }
      return { data: data, error: null };
    }
    const b = {
      upsert: function (row) { q.op = 'upsert'; q.payload = row; return b; },
      update: function (obj) { q.op = 'update'; q.payload = obj; return b; },
      select: function (cols) { if (!q.op) q.op = 'select'; q.cols = cols || '*'; return b; },
      eq: function (k, v) { q.filters.push(['eq', k, v]); return b; },
      is: function (k, v) { q.filters.push(['is', k, v]); return b; },
      order: function () { return b; },
      limit: function () { return b; },
      maybeSingle: function () { return exec(true); },
      then: function (resolve, reject) { return exec(false).then(resolve, reject); },
    };
    return b;
  }
  return { from: from, state: state };
}

// ══════════════════════════════════════════════════════════════
// 6. テスト対象の読み込み（ここから先はすべて sandbox 下）
// ══════════════════════════════════════════════════════════════
let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const draftsDb = require('./lib/outputDraftsDb');
const evidenceCanonical = require('./lib/contentEvidenceCanonical');
const resolutionService = require('./lib/contentEvidenceResolutionService');

// fs.readFileSync は .env 以外の read を許可している（source inspection 用）
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');
const draftsDbSrc = fs.readFileSync(path.join(ROOT, 'lib', 'outputDraftsDb.js'), 'utf8');
const schemaSrc = fs.readFileSync(path.join(ROOT, 'supabase', 'schema.sql'), 'utf8');
const backfillSrc = fs.readFileSync(path.join(ROOT, 'supabase', 'content_evidence_canonical_backfill.sql'), 'utf8');

// sandbox 内 require は allowlist のみ
const SANDBOX_REQUIRE_ALLOW = new Set([
  './lib/contentEvidenceCanonical', './lib/contentEvidenceResolutionService', './lib/contentValueService',
  './shared/contentEvidence', './shared/contentClaimPlanning',
]);
function sandboxRequire(id) {
  if (!SANDBOX_REQUIRE_ALLOW.has(id)) {
    violations.push('sandbox_require:' + id);
    throw new Error('SANDBOX_BLOCKED_REQUIRE:' + id);
  }
  return require(id);
}
const warnLog = [];
const sandboxConsole = { log: function () {}, warn: function () { warnLog.push(Array.prototype.join.call(arguments, ' ')); }, error: function () {} };

// POST /api/output-drafts handler を抽出
const routeStart = serverSrc.indexOf("app.post('/api/output-drafts'");
const handlerStart = serverSrc.indexOf('async (req, res) => {', routeStart);
const routeEnd = serverSrc.indexOf('\n});', routeStart);
if (routeStart === -1 || handlerStart === -1 || routeEnd === -1 || handlerStart > routeEnd) throw new Error('POST /api/output-drafts handler not found (marker mismatch)');
const handlerSrc = serverSrc.slice(handlerStart, routeEnd) + '\n}';

// buildContentEvidenceContextForCase を抽出（既存 WriterContext テストと同一 marker）
const wfStart = serverSrc.indexOf('async function buildContentEvidenceContextForCase');
const wfEnd = serverSrc.indexOf('\n// Option B: client側で構築済みの');
if (wfStart === -1 || wfEnd === -1) throw new Error('buildContentEvidenceContextForCase not found (marker mismatch)');
const writerFnSrc = serverSrc.slice(wfStart, wfEnd);

const sandbox = { require: sandboxRequire, console: sandboxConsole, getOutputDraftsDb: function () { return draftsDb; } };
vm.createContext(sandbox);
vm.runInContext('var __handler = ' + handlerSrc + ';\n' + writerFnSrc, sandbox);

async function post(body) {
  const res = {
    statusCode: 200, body: null,
    status: function (c) { this.statusCode = c; return this; },
    json: function (o) { this.body = o; return this; },
  };
  await sandbox.__handler({ body: body }, res);
  return res;
}

// ── fixture（synthetic。本番 payload ではない） ──
const CASE_A = 'case-value-1788410623';
const CASE_B = 'case-other-0001';
const OUT = 'out_1788413020275';
const NOW = Date.parse('2026-09-17T00:00:00.000Z');
const CLAIMS_TEXT = {
  'CI-01': '洗顔時は強くこすらず、洗顔料をよく泡立てて手でやさしく洗う。',
  'CI-02': '洗顔後に乾燥が気になる場合は、保湿用の化粧品や保湿剤を併用する。',
  'CI-03': '日常の紫外線対策として、日陰の利用、衣類や帽子、日焼け止めなどを組み合わせる。',
};
const TOPICS = { 'CI-01': '洗顔時の摩擦', 'CI-02': '洗顔後の保湿', 'CI-03': '日常の紫外線対策' };
function candidates(caseId, intentIds) {
  const out = [];
  (intentIds || Object.keys(CLAIMS_TEXT)).forEach(function (id) {
    ['https://www.mhlw.go.jp/content/' + id + '.pdf', 'https://www.dermatol.or.jp/qa/' + id + '.html'].forEach(function (u) {
      out.push({
        intentId: id, caseId: caseId, topic: TOPICS[id], question: TOPICS[id] + 'について一般的に推奨されている方法は何か',
        claimTypeCandidate: 'general_practice',
        candidate: { sourceMethod: 'web_retrieved', sourceUrl: u, sourceTitle: 't-' + id, createdBy: 'system' },
        mappingDecision: { claimType: 'general_practice', supportType: 'supports' },
        proposedClaimText: CLAIMS_TEXT[id],
      });
    });
  });
  return out;
}
const CANONICAL = resolutionService.resolveContentEvidenceSubmission(candidates(CASE_A), { caseId: CASE_A, now: NOW });
const CANONICAL_EVIDENCE = clone(CANONICAL.contentEvidence);
const CANONICAL_CLAIMS = clone(CANONICAL.contentClaims);
const SLIDES = ['【1枚目】タイトル：毎日のスキンケア / 本文：基本を見直します。', '【2枚目】タイトル：やさしく洗う / 本文：こすらず洗います。'];

function seed(fake, row) {
  const r = {};
  fake.state.columns.forEach(function (c) { r[c] = null; });
  Object.assign(r, clone(row));
  fake.state.rows[r.output_id] = r;
  return r;
}
function seedCanonical(fake, extra) {
  return seed(fake, Object.assign({
    output_id: OUT, case_id: CASE_A, type: 'instagram_carousel', status: 'ready',
    fields: { slides: SLIDES },
    content_evidence: CANONICAL_EVIDENCE, content_claims: CANONICAL_CLAIMS,
    content_evidence_origin: evidenceCanonical.buildResolutionOrigin({ caseId: CASE_A, outputId: OUT, contentEvidence: CANONICAL_EVIDENCE, contentClaims: CANONICAL_CLAIMS, resolvedAt: '2026-09-16T07:05:00.000Z' }),
    content_value: { sentinel: 'before' },
  }, extra || {}));
}
function canonicalSnapshot(fake) {
  const r = fake.state.rows[OUT];
  return clone({ e: r.content_evidence, c: r.content_claims, o: r.content_evidence_origin });
}
function canonicalWrites(fake) {
  return fake.state.calls.filter(function (c) {
    return (c.op === 'update' || c.op === 'upsert') && (c.payloadKeys || []).some(function (k) { return CANONICAL_COLUMNS.indexOf(k) !== -1; });
  }).length;
}
function writes(fake) { return fake.state.calls.filter(function (c) { return c.op === 'update' || c.op === 'upsert'; }).length; }
function useFake(options) { currentFake = makeFakeSupabase(options); return currentFake; }

(async () => {
  console.log('\n=== contentEvidenceCanonicalColumns.test.js (Safety Foundation B1) ===');

  caseHeader('SB. sandbox 自己検証（封鎖が実際に効いていること。副作用の前に例外になる）');
  {
    const snapViolations = violations.length;
    const snapCounters = Object.assign({}, counters);
    function throwsSandbox(fn, marker) {
      try { fn(); return false; } catch (e) { return String(e && e.message).indexOf(marker) === 0; }
    }
    assert(throwsSandbox(function () { globalThis.fetch('https://api.openai.com/v1/responses'); }, 'SANDBOX_BLOCKED_NETWORK'), 'SB-1. fetch は封鎖');
    assert(throwsSandbox(function () { require('https').request('https://api.openai.com'); }, 'SANDBOX_BLOCKED'), 'SB-2. https.request は封鎖');
    assert(throwsSandbox(function () { require('net').connect(443, 'example.com'); }, 'SANDBOX_BLOCKED'), 'SB-3. net.connect は封鎖');
    assert(throwsSandbox(function () { require('axios'); }, 'SANDBOX_BLOCKED_MODULE'), 'SB-4. axios は読込不可');
    assert(throwsSandbox(function () { require('./openaiClient'); }, 'SANDBOX_BLOCKED_MODULE'), 'SB-5. openaiClient は読込不可');
    assert(throwsSandbox(function () { require('./conversationHistory'); }, 'SANDBOX_BLOCKED_MODULE'), 'SB-6. conversationHistory は読込不可');
    assert(throwsSandbox(function () { require('./lib/costDb'); }, 'SANDBOX_BLOCKED_MODULE'), 'SB-7. lib/costDb は読込不可');
    assert(throwsSandbox(function () { require('dotenv'); }, 'SANDBOX_BLOCKED_MODULE'), 'SB-8. dotenv は読込不可');
    assert(throwsSandbox(function () { fs.readFileSync(path.join(ROOT, '.env.local')); }, 'SANDBOX_BLOCKED_ENV_READ'), 'SB-9. .env.local 読込は封鎖');
    assert(throwsSandbox(function () { fs.writeFileSync(path.join(ROOT, 'data', 'conversations', 'user-cont-1_line_web.json'), 'x'); }, 'SANDBOX_BLOCKED_FS_WRITE'), 'SB-10. Protected への writeFileSync は封鎖');
    assert(throwsSandbox(function () { sandboxRequire('./openaiClient'); }, 'SANDBOX_BLOCKED_REQUIRE'), 'SB-11. vm 内 require は allowlist 外を拒否');
    // 自己検証で意図的に発生させた分は記録から除く（以降の S-* は実テスト中の違反のみを数える）
    violations.length = snapViolations;
    Object.assign(counters, snapCounters);
  }

  caseHeader('0. fixture 前提');
  assert(CANONICAL_EVIDENCE.length === 6 && CANONICAL_CLAIMS.length === 3, '0a. synthetic canonical = Evidence 6 / Claims 3（resolution service 実計算）');
  assert(CANONICAL_EVIDENCE.every(function (e) { return e.verificationStatus === 'verified'; }), '0b. canonical Evidence 6件すべて verified');
  assert(require.cache[SUPABASE_PATH].exports.supabase === fakeClientProxy, '0c. lib/supabase.js は fake client（実ファイル未評価）');
  assert(!Object.keys(process.env).some(function (k) { return CREDENTIAL_ENV_PATTERN.test(k); }), '0d. real credential env は process から除去済み');

  // ══════════════════════════════════════════════════════════════
  caseHeader('B1-1. canonical Evidence 6 + client stale fields.contentEvidence=[] → 6維持');
  {
    const fake = useFake();
    seedCanonical(fake);
    const before = canonicalSnapshot(fake);
    const r = await post({ outputId: OUT, caseId: CASE_A, fields: { slides: SLIDES, contentEvidence: [] } });
    assert(r.statusCode === 200 && r.body && r.body.ok === true, 'B1-1a. 通常保存は成功（200 / ok:true）');
    assert(fake.state.rows[OUT].content_evidence.length === 6, 'B1-1b. ★canonical Evidence 6件維持');
    assert(same(canonicalSnapshot(fake), before), 'B1-1c. canonical 3列は完全不変');
    assert(canonicalWrites(fake) === 0, 'B1-1d. canonical 列への write 0');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('B1-2. canonical Claims 3 + client stale fields.contentClaims=[] → 3維持');
  {
    const fake = useFake();
    seedCanonical(fake);
    const before = canonicalSnapshot(fake);
    const r = await post({ outputId: OUT, caseId: CASE_A, fields: { slides: SLIDES, contentClaims: [] } });
    assert(r.statusCode === 200 && r.body.ok === true, 'B1-2a. 通常保存は成功');
    assert(fake.state.rows[OUT].content_claims.length === 3, 'B1-2b. ★canonical Claims 3件維持');
    assert(same(canonicalSnapshot(fake), before) && canonicalWrites(fake) === 0, 'B1-2c. canonical 3列不変・write 0');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('B1-3. client legacy fields で verificationStatus downgrade → canonical verified 不変');
  {
    const fake = useFake();
    seedCanonical(fake);
    const before = canonicalSnapshot(fake);
    const downgraded = CANONICAL_EVIDENCE.map(function (e) { return Object.assign({}, e, { verificationStatus: 'unverified', reliability: 'low' }); });
    const r = await post({ outputId: OUT, caseId: CASE_A, fields: { slides: SLIDES, contentEvidence: downgraded, contentClaims: CANONICAL_CLAIMS } });
    assert(r.statusCode === 200 && r.body.ok === true, 'B1-3a. 保存自体は成功');
    assert(fake.state.rows[OUT].content_evidence.every(function (e) { return e.verificationStatus === 'verified'; }), 'B1-3b. ★canonical Evidence は verified のまま');
    assert(same(canonicalSnapshot(fake), before) && canonicalWrites(fake) === 0, 'B1-3c. canonical 3列不変・write 0');
    assert(!Array.isArray(fake.state.rows[OUT].fields.contentEvidence), 'B1-3d. client の downgrade 配列は fields へも保存されない（legacy 無し row）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('B1-4. cross-case Evidence Resolution → 409 / write 0');
  {
    const fake = useFake();
    seedCanonical(fake);
    const rowBefore = clone(fake.state.rows[OUT]);
    const r = await post({ outputId: OUT, caseId: CASE_B, fields: { slides: SLIDES }, contentEvidenceCandidates: candidates(CASE_B) });
    assert(r.statusCode === 409 && r.body && r.body.error === 'output_case_mismatch', 'B1-4a. ★request caseId ≠ row case_id → 409 output_case_mismatch');
    assert(writes(fake) === 0 && canonicalWrites(fake) === 0, 'B1-4b. ★upsert / update とも 0（canonical write 0）');
    assert(same(fake.state.rows[OUT], rowBefore), 'B1-4c. row 全体（case_id / fields / canonical / content_value）不変');

    const r2 = await post({ outputId: OUT, caseId: CASE_B, fields: { slides: ['乗っ取り'] } });
    assert(r2.statusCode === 409 && writes(fake) === 0, 'B1-4d. 通常保存でも cross-case は 409・write 0');
    const r3 = await post({ outputId: OUT, caseId: CASE_B, reviewState: { approved: true } });
    assert(r3.statusCode === 409 && writes(fake) === 0, 'B1-4e. reviewState のみ保存でも cross-case は 409・write 0');

    const direct = await draftsDb.writeCanonicalContentEvidence({ caseId: CASE_B, outputId: OUT, contentEvidence: CANONICAL_EVIDENCE, contentClaims: CANONICAL_CLAIMS, origin: { mode: 'resolution' } });
    assert(direct.applied === false && same(fake.state.rows[OUT], rowBefore), 'B1-4f. DB 層でも case_id 不一致は 0 行更新（二重防御）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('B1-5. slides のみ更新 → canonical Evidence 6 / Claims 3 不変');
  {
    const fake = useFake();
    seedCanonical(fake);
    const before = canonicalSnapshot(fake);
    const newSlides = ['【1枚目】タイトル：更新 / 本文：新しい本文です。'];
    const r = await post({ outputId: OUT, caseId: CASE_A, fields: { slides: newSlides } });
    assert(r.statusCode === 200 && same(fake.state.rows[OUT].fields.slides, newSlides), 'B1-5a. slides は更新される');
    assert(same(canonicalSnapshot(fake), before) && canonicalWrites(fake) === 0, 'B1-5b. ★canonical 6 / 3・origin 不変・write 0');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('B1-6. content_type=value 宣言付き保存 → first-write-wins 維持・canonical 不変');
  {
    const fake = useFake();
    seedCanonical(fake);
    const before = canonicalSnapshot(fake);
    const r1 = await post({ outputId: OUT, caseId: CASE_A, fields: { slides: SLIDES }, contentType: 'value' });
    assert(r1.statusCode === 200 && fake.state.rows[OUT].content_type === 'value', 'B1-6a. NULL の content_type へ value が初回宣言される');
    const r2 = await post({ outputId: OUT, caseId: CASE_A, fields: { slides: SLIDES }, contentType: 'product' });
    assert(r2.statusCode === 200 && fake.state.rows[OUT].content_type === 'value', 'B1-6b. ★2回目の product 宣言は無視（first-write-wins）');
    assert(fake.state.rows[OUT].content_evidence.length === 6 && fake.state.rows[OUT].content_claims.length === 3, 'B1-6c. ★canonical 6 / 3 維持');
    assert(same(canonicalSnapshot(fake), before) && canonicalWrites(fake) === 0, 'B1-6d. canonical 3列不変・write 0');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('B1-7. Content Value 再計算は canonical 列が正本 / read failure で content_value を更新しない');
  {
    // (a) canonical 列と legacy fields が競合 → canonical を評価に使う
    const fake = useFake();
    const legacyEvidence = CANONICAL_EVIDENCE.filter(function (e) { return e.claimId === 'CI-01'; });
    const legacyClaims = CANONICAL_CLAIMS.filter(function (c) { return c.claimId === 'CI-01'; });
    seedCanonical(fake, { fields: { slides: SLIDES, contentEvidence: legacyEvidence, contentClaims: legacyClaims } });
    const r = await post({ outputId: OUT, caseId: CASE_A, fields: { slides: SLIDES } });
    const cv = fake.state.rows[OUT].content_value;
    assert(r.statusCode === 200 && cv && cv.sentinel === undefined, 'B1-7a. content_value は再計算される');
    assert(cv.evidence && cv.evidence.verifiedCount === 6, 'B1-7b. ★評価入力は canonical 列（verified 6）。legacy fields（verified ' + legacyEvidence.length + '）ではない');
    assert(r.body.contentValue && typeof r.body.contentValue.status === 'string', 'B1-7c. response に contentValue summary');

    // (b) canonical read failure → content_value を更新しない（content_type 初回宣言は維持）
    const fake2 = useFake();
    seedCanonical(fake2);
    fake2.state.fail.select = function (q) { return typeof q.cols === 'string' && q.cols.indexOf('content_evidence_origin') !== -1; };
    const r2 = await post({ outputId: OUT, caseId: CASE_A, fields: { slides: SLIDES }, contentType: 'value' });
    assert(r2.statusCode === 200 && r2.body.ok === true && r2.body.contentValue === null, 'B1-7d. 保存は成功・contentValue summary は null');
    assert(same(fake2.state.rows[OUT].content_value, { sentinel: 'before' }), 'B1-7e. ★canonical read failure → content_value を劣化値で上書きしない');
    assert(fake2.state.rows[OUT].content_type === 'value', 'B1-7f. content_type の初回宣言契約は維持');
    assert(warnLog.some(function (w) { return w.indexOf('content_value not updated') !== -1; }), 'B1-7g. read failure は warn として記録される');

    // (c) migration 未適用（canonical 列が存在しない DB）→ 通常保存は成功・content_value は更新しない
    const fake3 = useFake({ migrated: false });
    seed(fake3, { output_id: OUT, case_id: CASE_A, fields: { slides: SLIDES, contentEvidence: CANONICAL_EVIDENCE, contentClaims: CANONICAL_CLAIMS }, content_value: { sentinel: 'before' } });
    const r3 = await post({ outputId: OUT, caseId: CASE_A, fields: { slides: SLIDES } });
    assert(r3.statusCode === 200 && r3.body.ok === true, 'B1-7h. migration 未適用 DB でも通常保存は成功（canonical 列を upsert しない）');
    assert(same(fake3.state.rows[OUT].content_value, { sentinel: 'before' }), 'B1-7i. migration 未適用 DB では content_value を更新しない（fail-closed）');
    assert(fake3.state.rows[OUT].fields.contentEvidence.length === 6 && fake3.state.rows[OUT].fields.contentClaims.length === 3, 'B1-7j. ★migration 未適用 DB でも legacy fields 6 / 3 は保全される');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('B1-8. 正常な Evidence Resolution → canonical 列更新 + origin 記録');
  {
    const fake = useFake();
    seed(fake, { output_id: OUT, case_id: CASE_A, type: 'instagram_carousel', fields: { slides: SLIDES }, content_value: { sentinel: 'before' } });
    const r = await post({ outputId: OUT, caseId: CASE_A, fields: { slides: SLIDES }, contentEvidenceCandidates: candidates(CASE_A) });
    const row = fake.state.rows[OUT];
    assert(r.statusCode === 200 && r.body.ok === true, 'B1-8a. Resolution 保存は成功');
    assert(r.body.contentEvidenceSummary && r.body.contentEvidenceSummary.contentEvidenceCount === 6 && r.body.contentEvidenceSummary.contentClaimsCount === 3, 'B1-8b. response summary 6 / 3（既存 shape 維持）');
    assert(Array.isArray(row.content_evidence) && row.content_evidence.length === 6, 'B1-8c. ★canonical Evidence 列 = 6');
    assert(Array.isArray(row.content_claims) && row.content_claims.length === 3, 'B1-8d. ★canonical Claims 列 = 3');
    assert(row.content_evidence.every(function (e) { return e.verificationStatus === 'verified' && e.caseId === CASE_A; }), 'B1-8e. canonical Evidence は verified・caseId 一致');
    const o = row.content_evidence_origin || {};
    assert(o.mode === 'resolution' && o.caseId === CASE_A && o.outputId === OUT, 'B1-8f. ★origin.mode=resolution / caseId / outputId');
    assert(o.evidenceCount === 6 && o.claimsCount === 3 && typeof o.recordedAt === 'string' && typeof o.resolvedAt === 'string', 'B1-8g. origin に件数・recordedAt・resolvedAt');
    assert(o.fingerprint === evidenceCanonical.computeCanonicalFingerprint(row.content_evidence, row.content_claims), 'B1-8h. ★origin.fingerprint が canonical 列から deterministic に再計算一致');
    assert(same(o.claimIds, ['CI-01', 'CI-02', 'CI-03']), 'B1-8i. origin.claimIds');
    assert(!('contentEvidence' in row.fields) && !('contentClaims' in row.fields), 'B1-8j. canonical は fields へ書かない（専用列のみ）');
    assert(row.content_value && row.content_value.evidence && row.content_value.evidence.verifiedCount === 6, 'B1-8k. content_value は新 canonical で再計算');
    assert(canonicalWrites(fake) === 1, 'B1-8l. canonical 列 write はちょうど1回（Resolution 経路のみ）');

    // Resolution 不成立 → 既存 422 契約・write 0
    const fake2 = useFake();
    seedCanonical(fake2);
    const before2 = canonicalSnapshot(fake2);
    const tier7 = candidates(CASE_A, ['CI-01']).map(function (c, i) { return Object.assign({}, c, { candidate: Object.assign({}, c.candidate, { sourceUrl: 'https://general-blog-' + i + '.example.com/a' }) }); });
    const r2 = await post({ outputId: OUT, caseId: CASE_A, fields: { slides: SLIDES }, contentEvidenceCandidates: tier7 });
    assert(r2.statusCode === 422 && r2.body.error === 'content_evidence_resolution_insufficient', 'B1-8m. Resolution 不成立は既存どおり 422');
    assert(writes(fake2) === 0 && same(canonicalSnapshot(fake2), before2), 'B1-8n. 422 時は write 0・既存 canonical 不変');

    // canonical write failure → 成功を偽らない・canonical / content_value 不変
    const fake3 = useFake();
    seedCanonical(fake3);
    const before3 = canonicalSnapshot(fake3);
    fake3.state.fail.update = function (q) { return q.payload && Object.prototype.hasOwnProperty.call(q.payload, 'content_evidence'); };
    const r3 = await post({ outputId: OUT, caseId: CASE_A, fields: { slides: SLIDES }, contentEvidenceCandidates: candidates(CASE_A, ['CI-01']) });
    assert(r3.statusCode === 500 && r3.body.ok === false && r3.body.error === 'canonical_content_evidence_write_failed', 'B1-8o. canonical write 失敗は 500 で明示（成功を偽らない）');
    assert(same(canonicalSnapshot(fake3), before3) && same(fake3.state.rows[OUT].content_value, { sentinel: 'before' }), 'B1-8p. canonical 列・content_value とも不変');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('B1-9. legacy fields と canonical 列が両方存在 → canonical 優先・legacy は保持のみ');
  {
    const fake = useFake();
    const legacyClaims = [{ claimId: 'CI-01', text: 'LEGACY-ONLY-CLAIM-TEXT', claimType: 'general_practice', status: 'grounded' }];
    const legacyEvidence = CANONICAL_EVIDENCE.filter(function (e) { return e.claimId === 'CI-01'; });
    seedCanonical(fake, { fields: { slides: SLIDES, contentEvidence: legacyEvidence, contentClaims: legacyClaims } });

    const sel = evidenceCanonical.selectCanonicalContentEvidence(fake.state.rows[OUT]);
    assert(sel.source === 'columns' && sel.contentClaims.length === 3, 'B1-9a. selectCanonicalContentEvidence は canonical 列を選ぶ');

    const writerText = await sandbox.buildContentEvidenceContextForCase(CASE_A);
    assert(writerText.indexOf('■ Content Evidence') === 0, 'B1-9b. Writer grounding section 生成');
    assert(writerText.indexOf(CLAIMS_TEXT['CI-02']) !== -1 && writerText.indexOf('LEGACY-ONLY-CLAIM-TEXT') === -1, 'B1-9c. ★Writer context は canonical 列を使い legacy を使わない');

    const before = canonicalSnapshot(fake);
    await post({ outputId: OUT, caseId: CASE_A, fields: { slides: SLIDES } });
    assert(same(fake.state.rows[OUT].fields.contentClaims, legacyClaims) && same(fake.state.rows[OUT].fields.contentEvidence, legacyEvidence), 'B1-9d. ★通常保存後も legacy fields は保持（rollback / backfill source）');
    assert(same(canonicalSnapshot(fake), before), 'B1-9e. canonical 列は不変');

    // canonical 列が型不正でも legacy へ fallback しない（巻き戻り防止）
    const broken = evidenceCanonical.selectCanonicalContentEvidence({ content_evidence: 'broken', content_claims: null, fields: { contentEvidence: legacyEvidence, contentClaims: legacyClaims } });
    assert(broken.source === 'columns' && broken.invalid === true && broken.contentClaims.length === 0, 'B1-9f. 列が型不正でも legacy へ fallback しない（fail-closed）');
    // canonical 列が未設定の既存 row のみ legacy を read-only 参照
    const legacyOnly = evidenceCanonical.selectCanonicalContentEvidence({ content_evidence: null, content_claims: null, fields: { contentEvidence: legacyEvidence, contentClaims: legacyClaims } });
    assert(legacyOnly.source === 'legacy_fields' && legacyOnly.contentClaims.length === 1, 'B1-9g. canonical 列未設定の row のみ legacy fields を参照');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('B1-10. client payload から canonical 列を直接変更できない');
  {
    const fake = useFake();
    seedCanonical(fake);
    const before = canonicalSnapshot(fake);
    const forgedEvidence = [{ evidenceId: 'forged', caseId: CASE_A, claimId: 'CI-99', claim: 'x', claimType: 'general_practice', supportType: 'supports', sourceMethod: 'web_retrieved', verificationStatus: 'verified', reliability: 'high', retrievedAt: '2026-09-17T00:00:00.000Z', recordedAt: '2026-09-17T00:00:00.000Z', createdBy: 'system', sourceUrl: 'https://www.mhlw.go.jp/forged' }];
    const forgedClaims = [{ claimId: 'CI-99', text: 'FORGED', status: 'grounded' }];
    const r = await post({
      outputId: OUT, caseId: CASE_A,
      fields: { slides: SLIDES, contentEvidence: forgedEvidence, contentClaims: forgedClaims, content_evidence: forgedEvidence, content_claims: forgedClaims },
      content_evidence: forgedEvidence, content_claims: forgedClaims, content_evidence_origin: { mode: 'resolution', forged: true },
      contentEvidence: forgedEvidence, contentClaims: forgedClaims, contentValue: { status: 'complete' },
    });
    assert(r.statusCode === 200, 'B1-10a. 偽装 payload でも通常保存として処理（200）');
    assert(same(canonicalSnapshot(fake), before), 'B1-10b. ★canonical 3列は完全不変');
    assert(canonicalWrites(fake) === 0, 'B1-10c. ★canonical 列への write 0（全 upsert / update の payload key を検査）');
    assert(!Array.isArray(fake.state.rows[OUT].fields.contentEvidence) && !Array.isArray(fake.state.rows[OUT].fields.contentClaims), 'B1-10d. fields 内 legacy Evidence / Claims 偽装も保存されない');
    assert(fake.state.rows[OUT].content_value && fake.state.rows[OUT].content_value.status !== 'complete', 'B1-10e. client 供給 contentValue は採用されない');

    // source 構造: 通常保存 API が canonical を受け取れない
    const upsertSig = (draftsDbSrc.match(/async function upsertOutputDraft\(\{([^}]*)\}\)/) || [])[1] || '';
    assert(upsertSig && !/content_?[Ee]vidence|content_?[Cc]laims|origin/.test(upsertSig), 'B1-10f. upsertOutputDraft() の引数に canonical 系が存在しない');
    // コメント中の関数名言及は数えず、実呼び出し（draftsDb.writeCanonicalContentEvidence( / .writeCanonicalContentEvidence(）のみを数える
    const writeCalls = (serverSrc.match(/\.writeCanonicalContentEvidence\(/g) || []).length;
    const guardIdx = serverSrc.indexOf('if (evidenceResolved) {');
    const callIdx = serverSrc.indexOf('.writeCanonicalContentEvidence(');
    assert(writeCalls === 1 && guardIdx !== -1 && callIdx !== -1 && guardIdx < callIdx && callIdx - guardIdx < 1000,
      'B1-10g. canonical 書込の実呼び出しは server.js 内1箇所のみ・Resolution 成功分岐（if (evidenceResolved)）直下');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('X-1. Case Isolation（same outputId + different caseId）');
  {
    const fake = useFake();
    seedCanonical(fake);
    const rowBefore = clone(fake.state.rows[OUT]);
    const readB = await draftsDb.getCanonicalContentEvidence({ caseId: CASE_B, outputId: OUT });
    assert(readB.ok === true && readB.row === null, 'X-1a. 別 caseId からの canonical read は row 無し');
    const writeB = await draftsDb.writeCanonicalContentEvidence({ caseId: CASE_B, outputId: OUT, contentEvidence: CANONICAL_EVIDENCE, contentClaims: CANONICAL_CLAIMS, origin: { mode: 'resolution' } });
    assert(writeB.applied === false, 'X-1b. 別 caseId からの canonical write は 0 行');
    const writerB = await sandbox.buildContentEvidenceContextForCase(CASE_B);
    assert(writerB === '', 'X-1c. 別 case の Writer context は空（Evidence 混入 0）');
    const cvB = await post({ outputId: OUT, caseId: CASE_B, fields: { slides: SLIDES }, contentType: 'product' });
    assert(cvB.statusCode === 409, 'X-1d. 別 caseId の保存は 409');
    assert(same(fake.state.rows[OUT], rowBefore), 'X-1e. ★cross-case contamination 0（row 完全不変）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('X-2. 保存前 read failure → 503 / write 0');
  {
    const fake = useFake();
    seedCanonical(fake);
    const rowBefore = clone(fake.state.rows[OUT]);
    fake.state.fail.select = function (q) { return q.cols === '*' && q.filters.length === 1 && q.filters[0][1] === 'output_id'; };
    const r = await post({ outputId: OUT, caseId: CASE_A, fields: { slides: ['x'] } });
    assert(r.statusCode === 503 && r.body.error === 'output_draft_read_failed', 'X-2a. 保存前 read failure は 503');
    assert(writes(fake) === 0 && same(fake.state.rows[OUT], rowBefore), 'X-2b. write 0・row 不変（legacy / canonical を失う書込をしない）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('X-3. migration / backfill SQL（source inspection のみ・DB 送信なし）');
  {
    CANONICAL_COLUMNS.forEach(function (c) {
      assert(new RegExp('ALTER TABLE output_drafts ADD COLUMN IF NOT EXISTS ' + c + '\\s+JSONB;').test(schemaSrc), 'X-3a. schema.sql: ' + c + ' JSONB nullable ADD COLUMN IF NOT EXISTS');
    });
    assert(!/content_evidence[a-z_]*\s+JSONB\s+NOT NULL|DEFAULT\s+'\[\]'/.test(schemaSrc), 'X-3b. schema.sql: canonical 列は NOT NULL / DEFAULT なし');
    const executable = backfillSrc.replace(/\/\*[\s\S]*?\*\//g, '').replace(/--[^\n]*/g, '');
    assert(!/\b(UPDATE|INSERT|DELETE|ALTER|DROP|TRUNCATE|BEGIN|COMMIT)\b/i.test(executable), 'X-3c. ★backfill.sql は一括実行しても SELECT 以外が実行されない（書込は全てコメント内）');
    assert(/\bSELECT\b/i.test(executable), 'X-3d. backfill.sql の非コメント部は事前確認 SELECT を含む');
    // 行頭の /* 〜 行頭の */ を STEP 2 の無効化ブロックとして取り出す（コメント行内の "/* と */" 文言と区別する）
    const block = (backfillSrc.replace(/\r\n/g, '\n').match(/\n\/\*\n([\s\S]*?)\n\*\//) || [])[1] || '';
    assert(/UPDATE output_drafts d/.test(block) && /d\.content_evidence IS NULL AND d\.content_claims IS NULL AND d\.content_evidence_origin IS NULL/.test(block), 'X-3e. backfill UPDATE は canonical 3列 NULL の row に限定');
    assert(/jsonb_array_length\(d\.fields->'contentEvidence'\) > 0/.test(block) && /jsonb_array_length\(d\.fields->'contentClaims'\)\s+> 0/.test(block), 'X-3f. backfill は Evidence / Claims 双方非空配列に限定');
    assert(/IS DISTINCT FROM d\.case_id/.test(block), 'X-3g. backfill は record caseId と row case_id の一致を要求');
    assert(!/fields\s*=\s*fields\s*-|#-|jsonb_set\(/.test(block), 'X-3h. backfill は legacy fields を変更・削除しない');
    assert(/'legacy_fields_backfill'/.test(block), 'X-3i. backfill origin.mode = legacy_fields_backfill');
    assert(!/\bDELETE\b/i.test(backfillSrc), 'X-3j. DELETE 文は存在しない');
    assert(/case-value-1788410623/.test(executable) && /out_1788413020275/.test(executable), 'X-3k. 第一投稿の事後確認 SELECT（6 / 3）を含む');
    assert(/-- R1:/.test(backfillSrc) && /-- R2:/.test(backfillSrc), 'X-3l. rollback 手順（R1 / R2）がコメントとして存在');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('S. Safety Assertions（sandbox）');
  {
    const loaded = Object.keys(require.cache).map(function (p) { return path.relative(ROOT, p).split(path.sep).join('/'); });
    ['openaiClient.js', 'claudeClient.js', 'costTracker.js', 'lib/costDb.js', 'conversationHistory.js', 'server.js'].forEach(function (f) {
      assert(loaded.indexOf(f) === -1, 'S-1. 未読込: ' + f);
    });
    assert(!loaded.some(function (p) { return /node_modules\/(axios|dotenv|@supabase)\//.test(p); }), 'S-2. axios / dotenv / @supabase/supabase-js 未読込');
    assert(counters.network === 0, 'S-3. ★network calls = 0');
    assert(counters.blockedModules === 0, 'S-4. ★禁止 module 読込試行 = 0（AI API / cost event / conversation / production DB client）');
    assert(counters.envFileReads === 0, 'S-5. .env / .env.local 読込 = 0');
    assert(counters.fsWrites === 0, 'S-6. ★filesystem write = 0（conversation write = 0 を含む）');
    assert(violations.length === 0, 'S-7. sandbox violation = 0' + (violations.length ? ' → ' + violations.join(', ') : ''));

    const protectedAfter = hashProtected();
    PROTECTED_FILES.forEach(function (rel) {
      assert(protectedAfter[rel] === protectedBefore[rel], 'S-8. Protected 不変: ' + rel);
    });
    Object.keys(PROTECTED_BASELINE).forEach(function (rel) {
      assert(protectedAfter[rel] === PROTECTED_BASELINE[rel], 'S-9. Protected baseline 一致: ' + rel);
    });
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All contentEvidenceCanonicalColumns cases passed (Safety Foundation B1)'); }
})().catch(function (e) { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
