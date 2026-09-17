'use strict';
// contentEvidenceResolutionGuard.test.js
// Partial Resolution Replacement Guard（resolutionMode / targetClaimIds / revision CAS R-a）の deterministic テスト。
//
//   ★ 実行は必ずこのファイル名を明示指定する（node contentEvidenceResolutionGuard.test.js）。
//   ★ sandbox は contentEvidenceCanonicalColumns.test.js と同一方式（他の require より前に封鎖）:
//       network（fetch / http / https / net / tls）・real credential env・.env 読み込み・
//       禁止 module（openaiClient / claudeClient / costTracker / lib/costDb / conversationHistory /
//       dotenv / @supabase/supabase-js / server.js 本体）・filesystem write。
//   ★ server.js は require しない。POST /api/output-drafts の handler をソースから抽出し vm で実行する。
//   ★ Supabase は in-memory fake client のみ（JSON path `col->>key` を PostgREST と同じく text / NULL で評価）。
//   ★ Protected 10件の hash を開始時・終了時に read-only で取得し、全件一致を assert する。

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');
const Module = require('module');

const ROOT = __dirname;
const violations = [];
const counters = { network: 0, blockedModules: 0, envFileReads: 0, fsWrites: 0 };

// ══════════════════════════════════════════════════════════════
// 0. Protected 10件（開始時 hash・read-only）
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
  'claude-cost-logs.json': '2f7fdd7d6105b92dbc022ea090f3399f',
  'claude-quality-history.json': '429a054a7898fcc78906b17a72b4d860',
  'backup-dup-candidates-20260714/dup-candidates-123.csv': 'c6800a3ff3b2e1acda3ccc5b8440b751',
  'backup-dup-candidates-20260714/dup-candidates-123.json': 'cdd3e71b3b295f4b094cf05a30cc79f7',
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
// 1〜4. Sandbox（network / credential env / filesystem / module）
// ══════════════════════════════════════════════════════════════
function blockedNetwork(name) {
  return function () { counters.network++; violations.push('network:' + name); throw new Error('SANDBOX_BLOCKED_NETWORK:' + name); };
}
['http', 'https'].forEach(function (m) { const mod = require(m); mod.request = blockedNetwork(m + '.request'); mod.get = blockedNetwork(m + '.get'); });
{
  const net = require('net');
  net.connect = blockedNetwork('net.connect');
  net.createConnection = blockedNetwork('net.createConnection');
  net.Socket.prototype.connect = blockedNetwork('net.Socket.connect');
  const tls = require('tls');
  tls.connect = blockedNetwork('tls.connect');
}
globalThis.fetch = blockedNetwork('fetch');

const CREDENTIAL_ENV_PATTERN = /^(OPENAI|ANTHROPIC|CLAUDE|SUPABASE|NEXT_PUBLIC_SUPABASE|LINE_|WEB_SESSION|CAROUSEL_)/i;
Object.keys(process.env).forEach(function (k) { if (CREDENTIAL_ENV_PATTERN.test(k)) delete process.env[k]; });

function isEnvFile(p) { try { return /^\.env(\..*)?$/.test(path.basename(String(p))); } catch (e) { return false; } }
function guardEnvRead(obj, name) {
  const orig = obj[name];
  if (typeof orig !== 'function') return;
  obj[name] = function (p) {
    if (isEnvFile(p)) { counters.envFileReads++; violations.push('env_file_read:' + name); throw new Error('SANDBOX_BLOCKED_ENV_READ'); }
    return orig.apply(this, arguments);
  };
}
['readFileSync', 'readFile', 'existsSync', 'statSync', 'createReadStream'].forEach(function (n) { guardEnvRead(fs, n); });
guardEnvRead(fs.promises, 'readFile');
function blockedWrite(name) {
  return function () { counters.fsWrites++; violations.push('fs_write:' + name); throw new Error('SANDBOX_BLOCKED_FS_WRITE:' + name); };
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
  if (BLOCKED_BARE.has(request)) { counters.blockedModules++; violations.push('module:' + request); throw new Error('SANDBOX_BLOCKED_MODULE:' + request); }
  let filename = null;
  try { filename = Module._resolveFilename(request, parent, isMain); } catch (e) { filename = null; }
  if (filename && BLOCKED_FILES.has(filename) && !(filename === SUPABASE_PATH && require.cache[SUPABASE_PATH]
      && require.cache[SUPABASE_PATH].exports && require.cache[SUPABASE_PATH].exports.supabase === fakeClientProxy)) {
    counters.blockedModules++; violations.push('module:' + path.relative(ROOT, filename)); throw new Error('SANDBOX_BLOCKED_MODULE:' + request);
  }
  return origLoad.apply(this, arguments);
};

// ══════════════════════════════════════════════════════════════
// 5. in-memory fake Supabase（列単位 upsert / update / select + JSON path + テスト用 hook）
// ══════════════════════════════════════════════════════════════
const COLUMNS = ['output_id', 'case_id', 'type', 'status', 'title', 'source_text', 'fields', 'quality', 'package_quality',
  'assigned_roles', 'schema_version', 'detection', 'review_state', 'content_type', 'content_value', 'created_at', 'updated_at', 'built_at',
  'content_evidence', 'content_claims', 'content_evidence_origin'];
const CANONICAL_COLUMNS = ['content_evidence', 'content_claims', 'content_evidence_origin'];
function clone(v) { return v === undefined ? undefined : JSON.parse(JSON.stringify(v)); }

function makeFakeSupabase() {
  const state = { rows: {}, calls: [], fail: {}, beforeUpdate: null, transformUpdateResult: null };
  function defaultRow() { const r = {}; COLUMNS.forEach(function (c) { r[c] = null; }); return r; }
  function valueOf(row, key) {
    const idx = String(key).indexOf('->>');
    if (idx === -1) return row[key];
    const col = row[key.slice(0, idx)];
    const prop = key.slice(idx + 3);
    if (!col || typeof col !== 'object' || Array.isArray(col) || !Object.prototype.hasOwnProperty.call(col, prop)) return null;
    const v = col[prop];
    return (v === null || v === undefined) ? null : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  }
  function project(row, cols) {
    if (!cols || cols === '*') return clone(row);
    const o = {};
    cols.split(',').map(function (s) { return s.trim(); }).forEach(function (n) { o[n] = row[n] === undefined ? null : clone(row[n]); });
    return o;
  }
  function from(table) {
    if (table !== 'output_drafts') { violations.push('fake_unexpected_table:' + table); throw new Error('unexpected table ' + table); }
    const q = { op: null, payload: null, cols: null, filters: [] };
    function match(row) {
      return q.filters.every(function (f) {
        const v = valueOf(row, f[1]);
        if (f[0] === 'eq') return v === f[2];
        if (f[0] === 'is') return f[2] === null ? (v === null || v === undefined) : v === f[2];
        return false;
      });
    }
    async function exec(single) {
      state.calls.push({ op: q.op, cols: q.cols, filters: clone(q.filters), payloadKeys: q.payload ? Object.keys(q.payload) : null });
      const failFn = state.fail[q.op];
      if (typeof failFn === 'function' && failFn(q)) return { data: null, error: { message: 'injected_failure' } };
      if (q.op === 'upsert') {
        const id = q.payload.output_id;
        state.rows[id] = Object.assign(state.rows[id] || defaultRow(), clone(q.payload));
        return { data: null, error: null };
      }
      if (q.op === 'update') {
        if (typeof state.beforeUpdate === 'function') state.beforeUpdate(q, state);
        const matched = Object.keys(state.rows).map(function (k) { return state.rows[k]; }).filter(match);
        matched.forEach(function (r) { Object.assign(r, clone(q.payload)); });
        let data = q.cols ? matched.map(function (r) { return project(r, q.cols); }) : null;
        if (typeof state.transformUpdateResult === 'function') data = state.transformUpdateResult(q, data);
        return { data: data, error: null };
      }
      const rows = Object.keys(state.rows).map(function (k) { return state.rows[k]; }).filter(match);
      if (single) return { data: rows.length ? project(rows[0], q.cols) : null, error: null };
      return { data: rows.map(function (r) { return project(r, q.cols); }), error: null };
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
// 6. テスト対象（ここから先はすべて sandbox 下）
// ══════════════════════════════════════════════════════════════
let _passed = 0, _failed = 0;
function assert(cond, label) { if (cond) { _passed++; console.log('  ✅ ' + label); } else { _failed++; console.log('  ❌ ' + label); } }
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }
function same(a, b) { return JSON.stringify(a) === JSON.stringify(b); }

const draftsDb = require('./lib/outputDraftsDb');
const evidenceCanonical = require('./lib/contentEvidenceCanonical');
const resolutionService = require('./lib/contentEvidenceResolutionService');
const guard = require('./lib/contentEvidenceResolutionGuard');
const serverSrc = fs.readFileSync(path.join(ROOT, 'server.js'), 'utf8');

const SANDBOX_REQUIRE_ALLOW = new Set([
  './lib/contentEvidenceCanonical', './lib/contentEvidenceResolutionService', './lib/contentValueService',
  './lib/contentEvidenceResolutionGuard', './shared/contentEvidence', './shared/contentClaimPlanning',
]);
function sandboxRequire(id) {
  if (!SANDBOX_REQUIRE_ALLOW.has(id)) { violations.push('sandbox_require:' + id); throw new Error('SANDBOX_BLOCKED_REQUIRE:' + id); }
  return require(id);
}
const sandboxConsole = { log: function () {}, warn: function () {}, error: function () {} };
const routeStart = serverSrc.indexOf("app.post('/api/output-drafts'");
const handlerStart = serverSrc.indexOf('async (req, res) => {', routeStart);
const routeEnd = serverSrc.indexOf('\n});', routeStart);
if (routeStart === -1 || handlerStart === -1 || routeEnd === -1 || handlerStart > routeEnd) throw new Error('POST /api/output-drafts handler not found');
const routeSrc = serverSrc.slice(routeStart, routeEnd);
const sandbox = { require: sandboxRequire, console: sandboxConsole, getOutputDraftsDb: function () { return draftsDb; } };
vm.createContext(sandbox);
vm.runInContext('var __handler = ' + serverSrc.slice(handlerStart, routeEnd) + '\n};', sandbox);

async function post(body) {
  const res = { statusCode: 200, body: null, status: function (c) { this.statusCode = c; return this; }, json: function (o) { this.body = o; return this; } };
  await sandbox.__handler({ body: body }, res);
  return res;
}
function useFake() { currentFake = makeFakeSupabase(); return currentFake; }

// ── fixture（synthetic） ──
const CASE_A = 'case-value-1788410623';
const CASE_B = 'case-other-0001';
const OUT = 'out_1788413020275';
const NOW = Date.parse('2026-09-17T00:00:00.000Z');
const IDS = ['CI-01', 'CI-02', 'CI-03'];
const TEXT = {
  'CI-01': '洗顔時は強くこすらず、洗顔料をよく泡立てて手でやさしく洗う。',
  'CI-02': '洗顔後に乾燥が気になる場合は、保湿用の化粧品や保湿剤を併用する。',
  'CI-03': '日常の紫外線対策として、日陰の利用、衣類や帽子、日焼け止めなどを組み合わせる。',
};
const TOPIC = { 'CI-01': '洗顔時の摩擦', 'CI-02': '洗顔後の保湿', 'CI-03': '日常の紫外線対策' };
const HOSTS_A = ['https://www.mhlw.go.jp/content/', 'https://www.dermatol.or.jp/qa/'];
const HOSTS_B = ['https://www.caa.go.jp/policies/', 'https://www.jcia.or.jp/cosmetics/'];
const HOSTS_TIER7 = ['https://general-blog-1.example.com/', 'https://general-blog-2.example.com/'];
const REV_A = 'rev-' + 'a'.repeat(32);
const REV_STALE = 'rev-' + 'e'.repeat(32);
const SLIDES = ['【1枚目】タイトル：毎日のスキンケア / 本文：基本を見直します。'];

// spec: { id, hosts, text (null = 文言なし), supportType, noMapping, caseId }
function cands(specs, defaults) {
  const d = defaults || {};
  const out = [];
  specs.forEach(function (sp) {
    const s = typeof sp === 'string' ? { id: sp } : sp;
    const hosts = s.hosts || d.hosts || HOSTS_A;
    hosts.forEach(function (h, i) {
      const item = {
        intentId: s.id, caseId: s.caseId !== undefined ? s.caseId : CASE_A, topic: TOPIC[s.id] || s.id,
        question: (TOPIC[s.id] || s.id) + 'について一般的に推奨されている方法は何か', claimTypeCandidate: 'general_practice',
        candidate: { sourceMethod: 'web_retrieved', sourceUrl: h + s.id + '-' + i + '.html', sourceTitle: 't', createdBy: 'system' },
        mappingDecision: { claimType: 'general_practice', supportType: s.supportType || 'supports' },
      };
      if (s.text !== null) item.proposedClaimText = s.text !== undefined ? s.text : TEXT[s.id];
      if (s.noMapping && i === 0) delete item.mappingDecision;
      out.push(item);
    });
  });
  return out;
}
const SEED = resolutionService.resolveContentEvidenceSubmission(cands(IDS), { caseId: CASE_A, now: NOW });

function seedRow(fake, opts) {
  const o = opts || {};
  const r = {};
  COLUMNS.forEach(function (c) { r[c] = null; });
  Object.assign(r, {
    output_id: OUT, case_id: CASE_A, type: 'instagram_carousel', status: 'ready',
    fields: { slides: SLIDES }, content_value: { sentinel: 'before' },
  });
  if (!o.noCanonical) {
    r.content_evidence = clone(o.evidence || SEED.contentEvidence);
    r.content_claims = clone(o.claims || SEED.contentClaims);
    const origin = { mode: 'legacy_fields_backfill', version: '1.0.0', caseId: CASE_A, outputId: OUT, evidenceCount: 6, claimsCount: 3 };
    if (o.revision) origin.revision = o.revision;
    r.content_evidence_origin = origin;
  }
  fake.state.rows[OUT] = r;
  return r;
}
function snap(fake) { const r = fake.state.rows[OUT]; return clone({ e: r.content_evidence, c: r.content_claims, o: r.content_evidence_origin }); }
function canonicalUpdateAttempts(fake) {
  return fake.state.calls.filter(function (c) { return c.op === 'update' && (c.payloadKeys || []).indexOf('content_evidence') !== -1; }).length;
}
function writes(fake) { return fake.state.calls.filter(function (c) { return c.op === 'update' || c.op === 'upsert'; }).length; }
function body(extra) { return Object.assign({ outputId: OUT, caseId: CASE_A, fields: { slides: SLIDES } }, extra); }
function byClaim(arr, id) { return (arr || []).filter(function (x) { return x.claimId === id; }); }

(async () => {
  console.log('\n=== contentEvidenceResolutionGuard.test.js (Partial Resolution Replacement Guard) ===');

  caseHeader('SB. sandbox 自己検証');
  {
    const sv = violations.length, sc = Object.assign({}, counters);
    function throwsSandbox(fn, marker) { try { fn(); return false; } catch (e) { return String(e && e.message).indexOf(marker) === 0; } }
    assert(throwsSandbox(function () { globalThis.fetch('https://api.openai.com'); }, 'SANDBOX_BLOCKED_NETWORK'), 'SB-1. fetch 封鎖');
    assert(throwsSandbox(function () { require('https').request('https://api.openai.com'); }, 'SANDBOX_BLOCKED'), 'SB-2. https 封鎖');
    assert(throwsSandbox(function () { require('./openaiClient'); }, 'SANDBOX_BLOCKED_MODULE'), 'SB-3. openaiClient 読込不可');
    assert(throwsSandbox(function () { require('./lib/costDb'); }, 'SANDBOX_BLOCKED_MODULE'), 'SB-4. lib/costDb 読込不可');
    assert(throwsSandbox(function () { require('dotenv'); }, 'SANDBOX_BLOCKED_MODULE'), 'SB-5. dotenv 読込不可');
    assert(throwsSandbox(function () { fs.readFileSync(path.join(ROOT, '.env.local')); }, 'SANDBOX_BLOCKED_ENV_READ'), 'SB-6. .env.local 読込封鎖');
    assert(throwsSandbox(function () { fs.writeFileSync(path.join(ROOT, 'data', 'conversations', 'user-cont-1_line_web.json'), 'x'); }, 'SANDBOX_BLOCKED_FS_WRITE'), 'SB-7. Protected write 封鎖');
    violations.length = sv; Object.assign(counters, sc);
  }

  caseHeader('0. fixture 前提');
  assert(SEED.contentEvidence.length === 6 && SEED.contentClaims.length === 3 && SEED.errors.length === 0, '0a. seed canonical = Evidence 6 / Claims 3（resolution service 実計算・errors 0）');

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-1. full_replace 3/3 成功 → canonical 全置換 + revision 更新');
  {
    const fake = useFake(); seedRow(fake);
    const r = await post(body({ contentEvidenceCandidates: cands(IDS, { hosts: HOSTS_B }), resolutionMode: 'full_replace', targetClaimIds: IDS, expectedRevision: null }));
    const row = fake.state.rows[OUT];
    assert(r.statusCode === 200 && r.body.ok === true, 'PRG-1a. 200 / ok:true');
    assert(row.content_evidence.length === 6 && row.content_claims.length === 3, 'PRG-1b. canonical 6 / 3');
    assert(row.content_evidence.every(function (e) { return /caa\.go\.jp|jcia\.or\.jp/.test(e.sourceUrl); }), 'PRG-1c. ★Evidence は新しい集合へ全置換');
    assert(guard.REVISION_PATTERN.test(row.content_evidence_origin.revision) && row.content_evidence_origin.previousRevision === null, 'PRG-1d. revision 発行・previousRevision=null');
    assert(row.content_evidence_origin.mode === 'resolution' && row.content_evidence_origin.scope === 'full', 'PRG-1e. origin mode=resolution / scope=full');
    assert(row.content_evidence_origin.revision === guard.computeNextRevision(null, evidenceCanonical.computeCanonicalFingerprint(row.content_evidence, row.content_claims)), 'PRG-1f. revision = chain(initial, fingerprint) を再計算一致');
    assert(r.body.contentEvidenceSummary.revision === row.content_evidence_origin.revision && r.body.contentEvidenceSummary.resolutionMode === 'full_replace', 'PRG-1g. response summary に revision / mode');
    assert(canonicalUpdateAttempts(fake) === 1, 'PRG-1h. canonical write はちょうど1回');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-2. full_replace 2/3 成功（CI-02 finalize 失敗）→ reject / write 0');
  {
    const fake = useFake(); seedRow(fake); const before = snap(fake);
    const specs = [{ id: 'CI-01' }, { id: 'CI-02', text: '洗顔後は3分以内に保湿剤を併用する。' }, { id: 'CI-03' }];
    const r = await post(body({ contentEvidenceCandidates: cands(specs, { hosts: HOSTS_B }), resolutionMode: 'full_replace', targetClaimIds: IDS, expectedRevision: null }));
    assert(r.statusCode === 422 && r.body.error === 'resolution_incomplete', 'PRG-2a. 422 resolution_incomplete');
    assert(writes(fake) === 0 && same(snap(fake), before), 'PRG-2b. ★write 0（fields も書かない）・既存 canonical 不変');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-3. partial_update target CI-02 成功 → CI-02 だけ置換・CI-01/CI-03 保持');
  {
    const fake = useFake(); seedRow(fake); const before = snap(fake);
    const r = await post(body({ contentEvidenceCandidates: cands(['CI-02'], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: null }));
    const row = fake.state.rows[OUT];
    assert(r.statusCode === 200 && r.body.ok === true, 'PRG-3a. 200 / ok:true');
    assert(row.content_evidence.length === 6 && row.content_claims.length === 3, 'PRG-3b. canonical 6 / 3 維持');
    assert(same(byClaim(row.content_evidence, 'CI-01'), byClaim(before.e, 'CI-01')) && same(byClaim(row.content_evidence, 'CI-03'), byClaim(before.e, 'CI-03')), 'PRG-3c. ★CI-01 / CI-03 の Evidence は完全一致で保持');
    assert(same(byClaim(row.content_claims, 'CI-01'), byClaim(before.c, 'CI-01')) && same(byClaim(row.content_claims, 'CI-03'), byClaim(before.c, 'CI-03')), 'PRG-3d. ★CI-01 / CI-03 の Claim は完全一致で保持');
    assert(byClaim(row.content_evidence, 'CI-02').length === 2 && byClaim(row.content_evidence, 'CI-02').every(function (e) { return /caa\.go\.jp|jcia\.or\.jp/.test(e.sourceUrl); }), 'PRG-3e. CI-02 の Evidence だけ新しい集合へ置換');
    assert(same(row.content_claims.map(function (c) { return c.claimId; }), IDS), 'PRG-3f. Claim 順序は既存どおり');
    assert(row.content_evidence_origin.scope === 'partial' && same(row.content_evidence_origin.targetClaimIds, ['CI-02']), 'PRG-3g. origin scope=partial / targetClaimIds');
    const ids = row.content_evidence.map(function (e) { return e.evidenceId; });
    assert(new Set(ids).size === ids.length, 'PRG-3h. evidenceId 一意');
    assert(row.content_value && row.content_value.evidence && row.content_value.evidence.verifiedCount === 6, 'PRG-3i. content_value は merge 後 canonical（verified 6）で再計算');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-4. partial_update target CI-01,CI-02 で CI-02 失敗 → atomic reject / write 0');
  {
    const fake = useFake(); seedRow(fake); const before = snap(fake);
    const specs = [{ id: 'CI-01' }, { id: 'CI-02', text: '洗顔後は3分以内に保湿剤を併用する。' }];
    const r = await post(body({ contentEvidenceCandidates: cands(specs, { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-01', 'CI-02'], expectedRevision: null }));
    assert(r.statusCode === 422 && r.body.error === 'resolution_incomplete', 'PRG-4a. 422 resolution_incomplete');
    assert(writes(fake) === 0 && same(snap(fake), before), 'PRG-4b. ★CI-01 だけの採用もしない（write 0・canonical 不変）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-5. Evidence は取得されたが Claim 不成立（文言なし）→ reject');
  {
    const fake = useFake(); seedRow(fake); const before = snap(fake);
    const specs = [{ id: 'CI-01' }, { id: 'CI-02', text: null }];
    const r = await post(body({ contentEvidenceCandidates: cands(specs, { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-01', 'CI-02'], expectedRevision: null }));
    assert(r.statusCode === 422 && r.body.error === 'resolution_incomplete', 'PRG-5a. 422 resolution_incomplete（claim_not_resolved）');
    assert(writes(fake) === 0 && same(snap(fake), before), 'PRG-5b. ★Claim を伴わない Evidence を canonical へ入れない（write 0）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-6. cross-case candidate / 既存 canonical → reject / write 0');
  {
    const fake = useFake(); seedRow(fake); const before = snap(fake);
    const specs = [{ id: 'CI-02', caseId: CASE_B }];
    const r = await post(body({ contentEvidenceCandidates: cands(specs, { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: null }));
    assert(r.statusCode === 409 && r.body.error === 'candidate_case_mismatch', 'PRG-6a. candidate.caseId ≠ request caseId → 409 candidate_case_mismatch');
    assert(writes(fake) === 0 && same(snap(fake), before), 'PRG-6b. write 0・canonical 不変');

    const fake2 = useFake();
    const foreign = clone(SEED.contentEvidence); foreign[5].caseId = CASE_B;
    seedRow(fake2, { evidence: foreign }); const before2 = snap(fake2);
    const r2 = await post(body({ contentEvidenceCandidates: cands(['CI-02'], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: null }));
    assert(r2.statusCode === 409 && r2.body.error === 'existing_canonical_case_mismatch', 'PRG-6c. 既存 canonical に別 case record → 409（merge で持ち越さない）');
    assert(writes(fake2) === 0 && same(snap(fake2), before2), 'PRG-6d. write 0');

    const fake3 = useFake(); seedRow(fake3); const before3 = snap(fake3);
    const r3 = await post({ outputId: OUT, caseId: CASE_B, fields: { slides: SLIDES }, contentEvidenceCandidates: cands(['CI-02'], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: null });
    assert(r3.statusCode === 409 && r3.body.error === 'output_case_mismatch' && writes(fake3) === 0 && same(snap(fake3), before3), 'PRG-6e. row case ≠ request caseId → 409（B1 guard 維持）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-7. mapping なし Evidence → reject / write 0');
  {
    const fake = useFake(); seedRow(fake); const before = snap(fake);
    const r = await post(body({ contentEvidenceCandidates: cands([{ id: 'CI-02', noMapping: true }], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: null }));
    assert(r.statusCode === 422 && r.body.error === 'candidate_mapping_missing', 'PRG-7a. 422 candidate_mapping_missing（黙って除外しない）');
    assert(writes(fake) === 0 && same(snap(fake), before), 'PRG-7b. write 0・canonical 不変');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-8. contradicted / unresolved Claim → reject / write 0');
  {
    const fake = useFake(); seedRow(fake); const before = snap(fake);
    const r = await post(body({ contentEvidenceCandidates: cands([{ id: 'CI-01' }, { id: 'CI-02', supportType: 'contradicts' }], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-01', 'CI-02'], expectedRevision: null }));
    assert(r.statusCode === 422, 'PRG-8a. contradicts を含む → 422（' + (r.body && r.body.error) + '）');
    assert(writes(fake) === 0 && same(snap(fake), before), 'PRG-8b. write 0・反証 Evidence を canonical へ入れない');

    const fake2 = useFake(); seedRow(fake2); const before2 = snap(fake2);
    const r2 = await post(body({ contentEvidenceCandidates: cands([{ id: 'CI-01' }, { id: 'CI-02', hosts: HOSTS_TIER7 }], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-01', 'CI-02'], expectedRevision: null }));
    assert(r2.statusCode === 422 && r2.body.error === 'resolution_incomplete', 'PRG-8c. unresolved（Tier7 のみ・grounded 不成立）→ 422 resolution_incomplete');
    assert(writes(fake2) === 0 && same(snap(fake2), before2), 'PRG-8d. write 0');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-9. 初回 revision なし + expected null + DB revision IS NULL → 1 row 更新で成功');
  {
    const fake = useFake(); seedRow(fake);
    const r = await post(body({ contentEvidenceCandidates: cands(['CI-02'], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: null }));
    const upd = fake.state.calls.filter(function (c) { return c.op === 'update' && (c.payloadKeys || []).indexOf('content_evidence') !== -1; })[0];
    assert(r.statusCode === 200 && r.body.ok === true, 'PRG-9a. 成功');
    assert(upd && upd.filters.some(function (f) { return f[0] === 'is' && f[1] === 'content_evidence_origin->>revision' && f[2] === null; }), 'PRG-9b. ★CAS 条件に content_evidence_origin->>revision IS NULL を含む');
    assert(upd && upd.filters.some(function (f) { return f[0] === 'eq' && f[1] === 'output_id' && f[2] === OUT; }) && upd.filters.some(function (f) { return f[0] === 'eq' && f[1] === 'case_id' && f[2] === CASE_A; }), 'PRG-9c. CAS 条件に output_id / case_id 一致');
    assert(upd && same(upd.cols, 'output_id'), 'PRG-9d. 更新行を select(output_id) で返させる');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-10. stale expectedRevision → 409 / canonical 保持（pre-check と DB CAS の両方）');
  {
    const fake = useFake(); seedRow(fake); const before = snap(fake);
    const r = await post(body({ contentEvidenceCandidates: cands(['CI-02'], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: REV_STALE }));
    assert(r.statusCode === 409 && r.body.error === 'canonical_revision_conflict', 'PRG-10a. stale expected → 409 canonical_revision_conflict');
    assert(writes(fake) === 0 && same(snap(fake), before), 'PRG-10b. write 0・canonical 不変');

    // race: pre-read 後・CAS 前に別 writer が revision を更新 → CAS 0 row → 409
    const fake2 = useFake(); seedRow(fake2);
    const OTHER = 'rev-' + 'b'.repeat(32);
    fake2.state.beforeUpdate = function (q, st) {
      if (q.payload && Object.prototype.hasOwnProperty.call(q.payload, 'content_evidence')) st.rows[OUT].content_evidence_origin = Object.assign({}, st.rows[OUT].content_evidence_origin, { revision: OTHER });
    };
    const before2 = snap(fake2);
    const r2 = await post(body({ contentEvidenceCandidates: cands(['CI-02'], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: null }));
    const after2 = snap(fake2);
    assert(r2.statusCode === 409 && r2.body.error === 'canonical_revision_conflict', 'PRG-10c. ★DB CAS 0 row → 409 canonical_revision_conflict（0 row を成功扱いしない）');
    assert(same(after2.e, before2.e) && same(after2.c, before2.c) && after2.o.revision === OTHER, 'PRG-10d. canonical Evidence / Claims は不変（別 writer の revision のみ）');
    assert(fake2.state.calls.filter(function (c) { return c.op === 'upsert'; }).length === 0 && same(fake2.state.rows[OUT].content_value, { sentinel: 'before' }), 'PRG-10e. CAS 失敗時は fields / content_value も書かない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-11. 正しい既存 revision → 成功・revision 変更');
  {
    const fake = useFake(); seedRow(fake, { revision: REV_A });
    const r = await post(body({ contentEvidenceCandidates: cands(['CI-02'], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: REV_A }));
    const o = fake.state.rows[OUT].content_evidence_origin;
    const upd = fake.state.calls.filter(function (c) { return c.op === 'update' && (c.payloadKeys || []).indexOf('content_evidence') !== -1; })[0];
    assert(r.statusCode === 200 && r.body.ok === true, 'PRG-11a. 成功');
    assert(upd && upd.filters.some(function (f) { return f[0] === 'eq' && f[1] === 'content_evidence_origin->>revision' && f[2] === REV_A; }), 'PRG-11b. ★CAS 条件に content_evidence_origin->>revision = rev-A');
    assert(o.revision !== REV_A && o.previousRevision === REV_A, 'PRG-11c. revision 変更・previousRevision = rev-A');
    assert(o.revision === guard.computeNextRevision(REV_A, evidenceCanonical.computeCanonicalFingerprint(fake.state.rows[OUT].content_evidence, fake.state.rows[OUT].content_claims)), 'PRG-11d. revision = chain(rev-A, fingerprint)');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-12. 同じ旧 revision で再実行 → 2回目は 409・二重更新なし');
  {
    const fake = useFake(); seedRow(fake, { revision: REV_A });
    const req = body({ contentEvidenceCandidates: cands(['CI-02'], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: REV_A });
    const r1 = await post(clone(req));
    const afterFirst = snap(fake); const attempts1 = canonicalUpdateAttempts(fake); const writes1 = writes(fake);
    const r2 = await post(clone(req));
    assert(r1.statusCode === 200 && r2.statusCode === 409 && r2.body.error === 'canonical_revision_conflict', 'PRG-12a. 1回目 200 / 2回目 409');
    assert(same(snap(fake), afterFirst) && canonicalUpdateAttempts(fake) === attempts1 && writes(fake) === writes1, 'PRG-12b. ★2回目は write 0（canonical・revision とも1回目の状態のまま）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-13. 通常 Output Draft 保存 → canonical / revision 不変（B1 invariant）');
  {
    const fake = useFake(); seedRow(fake, { revision: REV_A }); const before = snap(fake);
    const r = await post(body({ fields: { slides: ['【1枚目】タイトル：更新 / 本文：新しい本文。'] }, contentType: 'value' }));
    assert(r.statusCode === 200 && r.body.ok === true && r.body.contentEvidenceSummary === null, 'PRG-13a. 通常保存は成功・Resolution なし');
    assert(same(snap(fake), before) && canonicalUpdateAttempts(fake) === 0, 'PRG-13b. ★canonical Evidence / Claims / origin（revision 含む）不変・canonical write 0');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-14. client から canonical 列 / revision を偽装 → 正式経路以外では変更不可');
  {
    const fake = useFake(); seedRow(fake, { revision: REV_A }); const before = snap(fake);
    const FORGED = 'rev-' + 'f'.repeat(32);
    const forgedOrigin = { mode: 'resolution', revision: FORGED };
    const r = await post(body({
      fields: { slides: SLIDES, contentEvidence: [], contentClaims: [], content_evidence_origin: forgedOrigin },
      content_evidence: [], content_claims: [], content_evidence_origin: forgedOrigin, revision: FORGED, origin: forgedOrigin,
    }));
    assert(r.statusCode === 200 && same(snap(fake), before) && canonicalUpdateAttempts(fake) === 0, 'PRG-14a. 通常保存での偽装 → canonical / revision 不変');

    const r2 = await post(body({
      contentEvidenceCandidates: cands(['CI-02'], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: REV_A,
      content_evidence_origin: forgedOrigin, revision: FORGED, origin: forgedOrigin,
    }));
    const o = fake.state.rows[OUT].content_evidence_origin;
    assert(r2.statusCode === 200 && o.revision !== FORGED && o.forged === undefined && o.revision === guard.computeNextRevision(REV_A, evidenceCanonical.computeCanonicalFingerprint(fake.state.rows[OUT].content_evidence, fake.state.rows[OUT].content_claims)), 'PRG-14b. ★Resolution 経路でも revision / origin は server 計算値のみ（偽装値は採用されない）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-15. unknown / missing resolutionMode → fail-closed');
  {
    const fake = useFake(); seedRow(fake); const before = snap(fake);
    const r1 = await post(body({ contentEvidenceCandidates: cands(['CI-02']), targetClaimIds: ['CI-02'], expectedRevision: null }));
    const r2 = await post(body({ contentEvidenceCandidates: cands(['CI-02']), resolutionMode: 'merge', targetClaimIds: ['CI-02'], expectedRevision: null }));
    assert(r1.statusCode === 422 && r1.body.error === 'resolution_mode_required', 'PRG-15a. mode 欠落 → 422 resolution_mode_required');
    assert(r2.statusCode === 422 && r2.body.error === 'resolution_mode_invalid', 'PRG-15b. unknown mode → 422 resolution_mode_invalid');
    assert(writes(fake) === 0 && same(snap(fake), before), 'PRG-15c. write 0');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-16. partial_update で targetClaimIds 空 → fail-closed');
  {
    const fake = useFake(); seedRow(fake); const before = snap(fake);
    const r = await post(body({ contentEvidenceCandidates: cands(['CI-02']), resolutionMode: 'partial_update', targetClaimIds: [], expectedRevision: null }));
    const r2 = await post(body({ contentEvidenceCandidates: cands(['CI-02']), resolutionMode: 'partial_update', expectedRevision: null }));
    assert(r.statusCode === 422 && r.body.error === 'target_claim_ids_empty', 'PRG-16a. 空配列 → 422 target_claim_ids_empty');
    assert(r2.statusCode === 422 && r2.body.error === 'target_claim_ids_required', 'PRG-16b. 欠落 → 422 target_claim_ids_required');
    assert(writes(fake) === 0 && same(snap(fake), before), 'PRG-16c. write 0');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-17. partial_update で存在しない Claim ID → fail-closed');
  {
    const fake = useFake(); seedRow(fake); const before = snap(fake);
    const r = await post(body({ contentEvidenceCandidates: cands([{ id: 'CI-09', text: '洗顔後は保湿用の化粧品を使う。' }], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-09'], expectedRevision: null }));
    assert(r.statusCode === 422 && r.body.error === 'target_claim_not_in_canonical', 'PRG-17a. 422 target_claim_not_in_canonical');
    assert(writes(fake) === 0 && same(snap(fake), before), 'PRG-17b. write 0');

    const fake2 = useFake(); seedRow(fake2, { noCanonical: true });
    const r2 = await post(body({ contentEvidenceCandidates: cands(['CI-02'], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: null }));
    assert(r2.statusCode === 422 && r2.body.error === 'partial_update_requires_canonical' && writes(fake2) === 0, 'PRG-17c. canonical 無し row への partial_update → 422');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('PRG-18. CAS update が 2 行以上 → invariant failure（成功扱い禁止）');
  {
    const fake = useFake(); seedRow(fake);
    fake.state.transformUpdateResult = function (q, data) {
      return (q.payload && Object.prototype.hasOwnProperty.call(q.payload, 'content_evidence') && Array.isArray(data)) ? data.concat(data) : data;
    };
    const r = await post(body({ contentEvidenceCandidates: cands(['CI-02'], { hosts: HOSTS_B }), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: null }));
    assert(r.statusCode === 500 && r.body.ok === false && r.body.error === 'canonical_write_invariant_violation', 'PRG-18a. 500 canonical_write_invariant_violation（ok:false）');
    assert(fake.state.calls.filter(function (c) { return c.op === 'upsert'; }).length === 0 && same(fake.state.rows[OUT].content_value, { sentinel: 'before' }), 'PRG-18b. 後続の fields / content_value 書込に進まない');
    const direct = await draftsDb.writeCanonicalContentEvidence({ caseId: CASE_A, outputId: OUT, contentEvidence: SEED.contentEvidence, contentClaims: SEED.contentClaims, origin: { mode: 'resolution', revision: 'rev-' + 'd'.repeat(32) }, expectedRevision: fake.state.rows[OUT].content_evidence_origin.revision });
    assert(direct.ok === false && direct.reason === 'invariant_multiple_rows' && direct.rowCount === 2, 'PRG-18c. DB 層 rowCount 2 → ok:false / invariant_multiple_rows');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('X. 追加の fail-closed 境界');
  {
    let fake = useFake(); seedRow(fake); let before = snap(fake);
    let r = await post(body({ contentEvidenceCandidates: cands(['CI-01'], { hosts: HOSTS_B }), resolutionMode: 'full_replace', targetClaimIds: ['CI-01'], expectedRevision: null }));
    assert(r.statusCode === 422 && r.body.error === 'full_replace_would_drop_claims' && writes(fake) === 0 && same(snap(fake), before), 'X-1. full_replace で既存 Claim を暗黙削除（CI-01 のみ提出・既存3件）→ 422 / write 0');

    fake = useFake(); seedRow(fake); before = snap(fake);
    r = await post(body({ contentEvidenceCandidates: cands(['CI-02']), resolutionMode: 'partial_update', targetClaimIds: ['CI-02', 'CI-02'], expectedRevision: null }));
    assert(r.statusCode === 422 && r.body.error === 'target_claim_ids_duplicate' && writes(fake) === 0, 'X-2. duplicate targetClaimIds → 422');

    r = await post(body({ contentEvidenceCandidates: cands(['CI-01']), resolutionMode: 'partial_update', targetClaimIds: ['CI-01', 'CI-02'], expectedRevision: null }));
    assert(r.statusCode === 422 && r.body.error === 'target_without_candidates' && writes(fake) === 0, 'X-3a. candidate の無い target（期待集合の偽装）→ 422');
    r = await post(body({ contentEvidenceCandidates: cands(['CI-01', 'CI-02']), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: null }));
    assert(r.statusCode === 422 && r.body.error === 'candidate_outside_target' && writes(fake) === 0, 'X-3b. target 外の candidate（対象外 Claim 混入）→ 422');
    r = await post(body({ contentEvidenceCandidates: cands(['CI-02']), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'] }));
    assert(r.statusCode === 422 && r.body.error === 'expected_revision_required' && writes(fake) === 0, 'X-4a. expectedRevision 欠落 → 422');
    r = await post(body({ contentEvidenceCandidates: cands(['CI-02']), resolutionMode: 'partial_update', targetClaimIds: ['CI-02'], expectedRevision: 'initial' }));
    assert(r.statusCode === 422 && r.body.error === 'expected_revision_invalid' && writes(fake) === 0, 'X-4b. expectedRevision 形式不正 → 422');
    r = await post(body({ contentEvidenceCandidates: cands(['CI-02']), resolutionMode: 'partial_update', targetClaimIds: ['bad id!'], expectedRevision: null }));
    assert(r.statusCode === 422 && r.body.error === 'target_claim_ids_invalid' && writes(fake) === 0, 'X-5. 形式不正 Claim ID → 422');
    assert(same(snap(fake), before), 'X-6. X-2〜X-5 を通して canonical 不変');

    const fake2 = useFake();
    r = await post(body({ contentEvidenceCandidates: cands(IDS, { hosts: HOSTS_B }), resolutionMode: 'full_replace', targetClaimIds: IDS, expectedRevision: null }));
    assert(r.statusCode === 409 && r.body.error === 'resolution_requires_saved_output_draft' && writes(fake2) === 0, 'X-7. 未保存 Output Draft への Resolution → 409 / write 0');

    const fake3 = useFake(); seedRow(fake3, { noCanonical: true });
    r = await post(body({ contentEvidenceCandidates: cands(IDS, { hosts: HOSTS_B }), resolutionMode: 'full_replace', targetClaimIds: IDS, expectedRevision: null }));
    assert(r.statusCode === 200 && fake3.state.rows[OUT].content_claims.length === 3 && fake3.state.rows[OUT].content_evidence_origin.previousRevision === null, 'X-8. canonical 無し row への初回 full_replace → 成功');

    const w1 = await draftsDb.writeCanonicalContentEvidence({ caseId: CASE_A, outputId: OUT, contentEvidence: SEED.contentEvidence, contentClaims: SEED.contentClaims, origin: { mode: 'resolution', revision: REV_A } });
    const w2 = await draftsDb.writeCanonicalContentEvidence({ caseId: CASE_A, outputId: OUT, contentEvidence: SEED.contentEvidence, contentClaims: SEED.contentClaims, origin: { mode: 'resolution', revision: REV_A }, expectedRevision: REV_A });
    assert(w1.ok === false && w1.reason === 'expected_revision_required' && w2.ok === false && w2.reason === 'next_revision_invalid', 'X-9. DB 層: expectedRevision 欠落 / 次 revision が期待値と同じ → 書込拒否');

    const fp = evidenceCanonical.computeCanonicalFingerprint(SEED.contentEvidence, SEED.contentClaims);
    assert(guard.computeNextRevision(null, fp) === guard.computeNextRevision(null, fp) && guard.computeNextRevision(null, fp) !== guard.computeNextRevision(REV_A, fp), 'X-10. revision は時刻非依存で deterministic・直前 revision が異なれば別値');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('SRC. server.js 構造（唯一の canonical 書込経路・順序）');
  {
    assert((serverSrc.match(/\.writeCanonicalContentEvidence\(/g) || []).length === 1, 'SRC-1. canonical 書込呼び出しは server.js 内1箇所のみ');
    const iValidate = routeSrc.indexOf('validateResolutionRequest(');
    const iResolve = routeSrc.indexOf('resolveContentEvidenceSubmission(');
    const iPlan = routeSrc.indexOf('planCanonicalResolution(');
    const iWrite = routeSrc.indexOf('.writeCanonicalContentEvidence(');
    const iUpsert = routeSrc.indexOf('draftsDb.upsertOutputDraft(');
    assert(iValidate !== -1 && iValidate < iResolve && iResolve < iPlan && iPlan < iWrite && iWrite < iUpsert, 'SRC-2. 契約検証 → resolve → 完全性検証 → CAS write → fields upsert の順');
    assert(routeSrc.indexOf("'canonical_revision_conflict'") !== -1 && routeSrc.indexOf("'canonical_write_invariant_violation'") !== -1, 'SRC-3. 409 / invariant の安定 error code');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('S. Safety Assertions（sandbox）');
  {
    const loaded = Object.keys(require.cache).map(function (p) { return path.relative(ROOT, p).split(path.sep).join('/'); });
    ['openaiClient.js', 'claudeClient.js', 'costTracker.js', 'lib/costDb.js', 'conversationHistory.js', 'server.js'].forEach(function (f) {
      assert(loaded.indexOf(f) === -1, 'S-1. 未読込: ' + f);
    });
    assert(!loaded.some(function (p) { return /node_modules\/(axios|dotenv|@supabase)\//.test(p); }), 'S-2. axios / dotenv / @supabase/supabase-js 未読込');
    assert(counters.network === 0, 'S-3. network calls = 0');
    assert(counters.blockedModules === 0, 'S-4. 禁止 module 読込試行 = 0（AI API / cost event / conversation / production DB client）');
    assert(counters.envFileReads === 0, 'S-5. .env / .env.local 読込 = 0');
    assert(counters.fsWrites === 0, 'S-6. filesystem write = 0');
    assert(violations.length === 0, 'S-7. sandbox violation = 0' + (violations.length ? ' → ' + violations.join(', ') : ''));
    const protectedAfter = hashProtected();
    PROTECTED_FILES.forEach(function (rel) {
      assert(protectedAfter[rel] === protectedBefore[rel] && protectedAfter[rel] === PROTECTED_BASELINE[rel], 'S-8. Protected 不変・baseline 一致: ' + rel);
    });
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All contentEvidenceResolutionGuard cases passed (Partial Resolution Replacement Guard)'); }
})().catch(function (e) { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
