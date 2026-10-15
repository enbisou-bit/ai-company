'use strict';
// caseDraftAccessBoundary.test.js
// 既存表 cases／output_drafts のアクセス境界（提案段階・未承認）— lib/caseDraftSupabase.js と、
// lib/casesDb.js・lib/outputDraftsDb.js の server-only client への切り替えを、偽 client だけで検証する。
//
//   ★ 実 Supabase・本番の鍵は使わない。@supabase/supabase-js は require.cache の偽物に置き換え、
//     http／https／net／fetch を遮断して到達 0 を確認する。鍵の文字列はすべて TEST FIXTURE。
//
//   使い方: node caseDraftAccessBoundary.test.js

const ENV_KEYS = ['SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SECRET_KEY', 'OPENAI_API_KEY', 'RENDER', 'WEB_SESSION_SECRET', 'WEB_APP_PASSWORD'];
ENV_KEYS.forEach(k => { delete process.env[k]; });
let NET_ATTEMPTS = 0;
const _block = name => function () { NET_ATTEMPTS++; throw new Error('network blocked in test: ' + name); };
const _http = require('http'), _https = require('https'), _net = require('net');
_http.request = _block('http.request'); _http.get = _block('http.get');
_https.request = _block('https.request'); _https.get = _block('https.get');
_net.connect = _block('net.connect'); _net.createConnection = _block('net.createConnection');
globalThis.fetch = async () => { NET_ATTEMPTS++; throw new Error('network blocked in test: fetch'); };

const fs = require('fs');
const path = require('path');
const ROOT = __dirname;

let _passed = 0, _failed = 0;
function assert(cond, label, detail) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label + (detail !== undefined ? ' :: ' + JSON.stringify(detail) : '')); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

// ── 偽 @supabase/supabase-js（createClient の引数だけ記録・通信しない） ──
const CREATED = [];
const SDK_PATH = require.resolve('@supabase/supabase-js');
require.cache[SDK_PATH] = { id: SDK_PATH, filename: SDK_PATH, loaded: true, exports: {
  createClient(url, key, opts) { const c = { __fake: true, url, key, opts, from() { throw new Error('fake sdk client: no network'); } }; CREATED.push(c); return c; },
} };
const P = rel => path.join(ROOT, rel);
const CLIENT_PATH = P('lib/caseDraftSupabase.js');
const fresh = rel => { delete require.cache[P(rel)]; return require(P(rel)); };
function loadClientWithEnv(env) {
  ENV_KEYS.forEach(k => { delete process.env[k]; });
  Object.assign(process.env, env);
  const warn = console.warn, warned = [];
  console.warn = (...a) => { warned.push(a.join(' ')); };
  try { return { mod: fresh('lib/caseDraftSupabase.js'), warned }; } finally { console.warn = warn; ENV_KEYS.forEach(k => { delete process.env[k]; }); }
}
const URL1 = 'https://testfixtureref.supabase.co';
const SECRET = 'sb_secret_TEST_FIXTURE_case_boundary_00';
const LEGACY = 'TEST.FIXTURE.legacy-service-role';
const ANON = 'TEST.FIXTURE.anon-key';

// ── 偽 client（cases／output_drafts の最小限の PostgREST 風 builder・呼び出しを記録） ──
function fakeDb() {
  const calls = [];
  const tables = { cases: [{ id: 'case-a', title: 'A', member_ids: ['m1'], ts: '2026-10-01T00:00:00Z', deleted_at: null }, { id: 'case-d', title: 'D', member_ids: [], ts: '2026-09-01T00:00:00Z', deleted_at: '2026-09-02T00:00:00Z' }],
    output_drafts: [{ output_id: 'out-1', case_id: 'case-a', updated_at: '2026-10-01T00:00:00Z', content_type: null }] };
  function builder(table) {
    const st = { table, op: 'select', filters: [], payload: null };
    const b = {
      select() { if (st.op === 'select' || st.op === 'pending') st.op = st.op === 'pending' ? st.op : 'select'; st.returning = true; return b; },
      insert(row) { st.op = 'insert'; st.payload = row; return b; },
      upsert(row) { st.op = 'upsert'; st.payload = row; return b; },
      update(row) { st.op = 'update'; st.payload = row; return b; },
      delete() { st.op = 'delete'; return b; },
      eq(c, v) { st.filters.push(r => r[c] === v); return b; },
      is(c, v) { st.filters.push(r => (r[c] === undefined ? null : r[c]) === v); return b; },
      contains(c, v) { st.filters.push(r => Array.isArray(r[c]) && v.every(x => r[c].includes(x))); return b; },
      order() { return b; }, limit() { return b; },
      single() { st.single = true; return b; }, maybeSingle() { st.single = true; return b; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    function run() {
      calls.push(table + ':' + st.op);
      const rows = tables[table];
      const hit = rows.filter(r => st.filters.every(f => f(r)));
      if (st.op === 'select') return { data: st.single ? (hit[0] || null) : hit, error: null };
      if (st.op === 'upsert' || st.op === 'insert') {
        const key = table === 'cases' ? 'id' : 'output_id';
        const i = rows.findIndex(r => r[key] === st.payload[key]);
        if (i >= 0 && st.op === 'insert') return { data: null, error: { code: '23505', message: 'duplicate' } };
        if (i >= 0) rows[i] = Object.assign({}, rows[i], st.payload); else rows.push(Object.assign({}, st.payload));
        return { data: null, error: null };
      }
      if (st.op === 'update') { hit.forEach(r => Object.assign(r, st.payload)); return { data: st.single ? (hit[0] || null) : hit, error: null }; }
      return { data: null, error: { code: 'XX000', message: 'unsupported in fake' } };
    }
    return b;
  }
  return { calls, tables, from: t => builder(t) };
}

(async () => {
  console.log('既存表 cases／output_drafts のアクセス境界（server-only client・偽 client のみ）');

  caseHeader('1. lib/caseDraftSupabase.js の接続先と鍵（anon へ落ちない）');
  {
    CREATED.length = 0;
    let r = loadClientWithEnv({ SUPABASE_URL: URL1, SUPABASE_SECRET_KEY: SECRET, SUPABASE_ANON_KEY: ANON });
    assert(r.mod.caseDraftDbStatus() === 'ready' && CREATED.length === 1 && CREATED[0].url === URL1 && CREATED[0].key === SECRET &&
      CREATED[0].opts.auth.persistSession === false && r.mod.caseDraftClient === CREATED[0], '1-1. URL＋SUPABASE_SECRET_KEY → server 用キーで client を1つ生成（anon キーが併存しても使わない）');
    CREATED.length = 0;
    r = loadClientWithEnv({ NEXT_PUBLIC_SUPABASE_URL: URL1, SUPABASE_SERVICE_ROLE_KEY: LEGACY });
    assert(r.mod.caseDraftDbStatus() === 'ready' && CREATED.length === 1 && CREATED[0].key === LEGACY, '1-2. 互換名 SUPABASE_SERVICE_ROLE_KEY も server 用キーとして使う');
    CREATED.length = 0;
    r = loadClientWithEnv({ SUPABASE_URL: URL1, SUPABASE_ANON_KEY: ANON, NEXT_PUBLIC_SUPABASE_ANON_KEY: ANON });
    let thrown = null; try { r.mod.caseDraftClient.from('cases'); } catch (e) { thrown = e.message; }
    assert(r.mod.caseDraftDbStatus() === 'server_key_missing' && CREATED.length === 0 && thrown === 'server_key_missing',
      '1-3. URL＋anon キーだけ → client を生成せず、どの操作も server_key_missing で拒否（anon へ自動 fallback しない）', { status: r.mod.caseDraftDbStatus(), created: CREATED.length, thrown });
    assert(r.warned.length === 1 && r.warned[0].indexOf(ANON) === -1 && r.warned[0].indexOf('SUPABASE_SECRET_KEY') !== -1, '1-4. 拒否の警告は環境変数名だけ（鍵の値を出さない）');
    CREATED.length = 0;
    r = loadClientWithEnv({});
    assert(r.mod.caseDraftDbStatus() === 'not_configured' && r.mod.caseDraftClient === null && CREATED.length === 0, '1-5. URL なし（ローカル）→ client null（従来のローカル fallback と同じ）');
    CREATED.length = 0;
    r = loadClientWithEnv({ RENDER: 'true' });
    let thrownP = null; try { r.mod.caseDraftClient.from('cases'); } catch (e) { thrownP = e.message; }
    assert(r.mod.caseDraftDbStatus() === 'server_url_missing' && thrownP === 'server_url_missing' && CREATED.length === 0 && r.warned.length === 1,
      '1-5b. 本番（RENDER=true）で URL なし → ローカル fallback へ逃げず server_url_missing で拒否', { status: r.mod.caseDraftDbStatus(), thrownP });
    CREATED.length = 0;
    r = loadClientWithEnv({ RENDER: 'true', SUPABASE_ANON_KEY: ANON });
    assert(r.mod.caseDraftDbStatus() === 'server_url_missing' && CREATED.length === 0, '1-5c. 本番で URL なし・anon キーだけ → 拒否（anon 不使用）');
    CREATED.length = 0;
    r = loadClientWithEnv({ RENDER: 'true', SUPABASE_URL: URL1 });
    assert(r.mod.caseDraftDbStatus() === 'server_key_missing' && CREATED.length === 0, '1-5d. 本番で URL ありキーなし → server_key_missing で拒否');
    CREATED.length = 0;
    r = loadClientWithEnv({ RENDER: 'true', SUPABASE_URL: URL1, SUPABASE_SECRET_KEY: SECRET });
    assert(r.mod.caseDraftDbStatus() === 'ready' && CREATED.length === 1 && CREATED[0].key === SECRET, '1-5e. 本番で URL＋サーバー用キー → ready');
    CREATED.length = 0;
    r = loadClientWithEnv({ RENDER: 'false' });
    assert(r.mod.caseDraftDbStatus() === 'not_configured' && r.mod.caseDraftClient === null, '1-5f. RENDER が true 以外（ローカル）→ 意図したローカル fallback を維持');
    const src = fs.readFileSync(CLIENT_PATH, 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert(!/ANON_KEY/.test(src) && !/require\(['"]\.\/supabase['"]\)/.test(src) && !/NEXT_PUBLIC_SUPABASE_(SECRET|SERVICE)/.test(src),
      '1-6. 実コードは anon キーも lib/supabase.js も参照しない・NEXT_PUBLIC_ 名に秘密を載せない');
  }

  caseHeader('2. casesDb／outputDraftsDb は server-only client だけを使う（他モジュールは不変）');
  {
    const strip = rel => fs.readFileSync(P(rel), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    for (const rel of ['lib/casesDb.js', 'lib/outputDraftsDb.js']) {
      const s = strip(rel);
      assert(/require\('\.\/caseDraftSupabase'\)/.test(s) && !/require\('\.\/supabase'\)/.test(s), '2-1. ' + rel + ' は lib/caseDraftSupabase.js を使い、lib/supabase.js（anon）を読まない');
    }
    const others = fs.readdirSync(P('lib')).filter(f => f.endsWith('.js') && f !== 'casesDb.js' && f !== 'outputDraftsDb.js' && f !== 'caseDraftSupabase.js');
    const users = others.filter(f => /require\(['"]\.\/caseDraftSupabase['"]\)/.test(fs.readFileSync(P('lib/' + f), 'utf8')));
    assert(users.length === 0, '2-2. 他の lib モジュールは caseDraftSupabase を使わない（横展開なし）', users);
    const sharedUsers = others.filter(f => /require\(['"]\.\/supabase['"]\)/.test(fs.readFileSync(P('lib/' + f), 'utf8')));
    assert(sharedUsers.length >= 10 && sharedUsers.indexOf('approvalsDb.js') !== -1, '2-3. 共有 client（lib/supabase.js）の利用モジュールはそのまま（' + sharedUsers.length + ' 件）');
  }

  caseHeader('3. 偽 client で既存処理が従来どおり動く');
  const fake = fakeDb();
  require.cache[CLIENT_PATH] = { id: CLIENT_PATH, filename: CLIENT_PATH, loaded: true, exports: { caseDraftClient: fake, caseDraftDbStatus: () => 'ready', SERVER_KEY_MISSING: 'server_key_missing' } };
  {
    const cases = fresh('lib/casesDb.js'), drafts = fresh('lib/outputDraftsDb.js');
    const g = await cases.getCases({});
    assert(g.source === 'db' && g.total === 1 && g.cases[0].id === 'case-a' && g.deletedIds.join() === 'case-d', '3-1. getCases（生存のみ・deletedIds）');
    const u = await cases.upsertCase({ id: 'case-b', title: 'B', memberIds: ['m2'] });
    assert(u.error === null && fake.tables.cases.some(r => r.id === 'case-b'), '3-2. upsertCase');
    const sd = await cases.softDeleteCase('case-b');
    assert(sd.error === null && fake.tables.cases.find(r => r.id === 'case-b').deleted_at, '3-3. softDeleteCase（論理削除）');
    const gc = await cases.getCaseById('case-a');
    assert(gc.ok === true && gc.exists === true, '3-4. getCaseById（既定の client も server-only）');
    const d = await drafts.getOutputDraft({ caseId: 'case-a', outputId: 'out-1' });
    assert(d.source === 'db' && d.draft && d.draft.output_id === 'out-1', '3-5. getOutputDraft');
    const ud = await drafts.upsertOutputDraft({ outputId: 'out-2', caseId: 'case-a', title: 'T' });
    assert(ud.error === null && fake.tables.output_drafts.some(r => r.output_id === 'out-2'), '3-6. upsertOutputDraft');
    const ins = await drafts.insertOutputDraftIfAbsent({ outputId: 'out-2', caseId: 'case-a', fields: {} });
    assert(ins.ok === false && ins.outcome === 'already_exists', '3-7. insertOutputDraftIfAbsent（重複は already_exists）');
    const ct = await drafts.setContentTypeIfUnset({ outputId: 'out-1', contentType: 'value' });
    assert(ct.ok === true && ct.applied === true, '3-8. setContentTypeIfUnset');
    assert(fake.calls.every(c => /^(cases|output_drafts):/.test(c)), '3-9. 触れる表は cases／output_drafts だけ', fake.calls);
  }

  caseHeader('4. サーバー用キーが無いときは明確に拒否（通信 0・anon 不使用）');
  {
    CREATED.length = 0;
    delete require.cache[CLIENT_PATH];
    process.env.SUPABASE_URL = URL1; process.env.SUPABASE_ANON_KEY = ANON;
    const warn = console.warn; console.warn = () => {};
    let cases, drafts;
    try { cases = fresh('lib/casesDb.js'); drafts = fresh('lib/outputDraftsDb.js'); } finally { console.warn = warn; delete process.env.SUPABASE_URL; delete process.env.SUPABASE_ANON_KEY; }
    const g = await cases.getCases({});
    assert(g.source === 'error' && g.error === 'server_key_missing' && g.cases.length === 0, '4-1. getCases → source error・server_key_missing', g);
    const u = await cases.upsertCase({ id: 'x', title: 'x' });
    assert(u.error === 'server_key_missing', '4-2. upsertCase → server_key_missing');
    const sd = await cases.softDeleteCase('x');
    assert(sd.error === 'server_key_missing', '4-3. softDeleteCase → server_key_missing');
    const d = await drafts.getOutputDraft({ caseId: 'x' });
    assert(d.source === 'error' && d.error === 'server_key_missing', '4-4. getOutputDraft → source error');
    const ud = await drafts.upsertOutputDraft({ outputId: 'o', caseId: 'x' });
    assert(ud.error === 'server_key_missing', '4-5. upsertOutputDraft → server_key_missing');
    let e1 = null; try { await cases.getCaseById('x'); } catch (e) { e1 = e.message; }
    assert(e1 === 'case_lookup_unknown', '4-6. getCaseById → 例外（日次制作は有料経路へ進まない）');
    let e2 = null; try { await drafts.insertOutputDraftIfAbsent({ outputId: 'o', caseId: 'x', fields: {} }); } catch (e) { e2 = e.message; }
    assert(e2 === 'server_key_missing', '4-7. insertOutputDraftIfAbsent → 例外（自動で再保存しない）');
    assert(CREATED.length === 0, '4-8. anon キーで client を作らない（createClient 0 回）');
  }

  caseHeader('5. API の認証境界（既存を維持・DB の制限とは別）とブラウザ非公開');
  {
    const SERVER = fs.readFileSync(P('server.js'), 'utf8');
    const has = re => re.test(SERVER);
    assert(has(/app\.get\('\/api\/output-drafts', require\('\.\/lib\/webSession'\)\.requireSession\(\)/) &&
      has(/app\.post\('\/api\/output-drafts', require\('\.\/lib\/webSession'\)\.requireSession\(\)/) &&
      has(/app\.delete\('\/api\/cases\/:id', require\('\.\/lib\/webSession'\)\.requireSession\(\)/), '5-1. 既存の session 必須（output-drafts GET／POST・cases DELETE）を維持');
    const noSession = ["app.get('/api/cases',", "app.post('/api/cases',", "app.get('/api/case-memory/:caseId',", "app.post('/api/case-memory/:caseId',"]
      .filter(s => SERVER.indexOf(s) !== -1 && SERVER.slice(SERVER.indexOf(s), SERVER.indexOf(s) + 120).indexOf('requireSession') === -1);
    assert(noSession.length === 0, '5-2. cases GET／POST・case-memory GET／POST も session 必須（既存 requireSession の再利用）', noSession);
    const firstMw = ["app.get('/api/cases', ", "app.post('/api/cases', ", "app.get('/api/case-memory/:caseId', ", "app.post('/api/case-memory/:caseId', "]
      .filter(s => SERVER.indexOf(s + "require('./lib/webSession').requireSession(),") === -1);
    assert(firstMw.length === 0, '5-2b. requireSession は各 route の最初の middleware（body 解析・handler より前）', firstMw);
    const publicStatic = require('./lib/publicStatic');
    assert(publicStatic.resolvePublicAsset('/lib/caseDraftSupabase.js') === null && publicStatic.resolvePublicAsset('/lib/casesDb.js') === null &&
      publicStatic.resolvePublicAsset('/lib/outputDraftsDb.js') === null, '5-3. 新しい client と2ファイルは静的配信されない');
    const html = fs.readFileSync(P('index.html'), 'utf8');
    assert(!/caseDraftSupabase|SUPABASE_SECRET_KEY|SUPABASE_SERVICE_ROLE_KEY/.test(html), '5-4. ブラウザの index.html に client 名・鍵の環境変数名なし');
  }

  caseHeader('7. server.js の実 route：未ログインは DB・ファイル操作 0 で 401／ログイン済みは従来どおり');
  {
    const TEST_SECRET = 'test-web-session-secret-32bytes-long-FIXTURE';
    process.env.LINE_CHANNEL_SECRET = 'TEST_FIXTURE'; process.env.LINE_CHANNEL_ACCESS_TOKEN = 'TEST_FIXTURE';
    process.env.WEB_SESSION_SECRET = TEST_SECRET;
    // ファイルへの書き込みを数える（禁止）
    let FILE_WRITES = 0; const writeLog = [];
    ['writeFileSync', 'appendFileSync', 'mkdirSync', 'renameSync', 'unlinkSync', 'rmSync', 'copyFileSync'].forEach(n => { fs[n] = function (p) { FILE_WRITES++; writeLog.push(n + ':' + p); throw new Error('blocked write in test'); }; });
    ['writeFile', 'appendFile', 'mkdir', 'rename', 'unlink'].forEach(n => { fs[n] = function (p) { FILE_WRITES++; writeLog.push(n + ':' + p); const cb = arguments[arguments.length - 1]; if (typeof cb === 'function') cb(new Error('blocked')); }; });
    fs.promises.writeFile = async p => { FILE_WRITES++; writeLog.push('promises.writeFile:' + p); throw new Error('blocked'); };
    // .env.local を読まない
    const DOTENV = require.resolve('dotenv');
    require.cache[DOTENV] = { id: DOTENV, filename: DOTENV, loaded: true, exports: { config: () => ({ parsed: {} }) } };
    // 偽 DB を server-only client として注入（casesDb／outputDraftsDb は読み直し）
    const db = fakeDb();
    db.tables.cases.push({ id: 'case-c', title: 'C', member_ids: [], ts: '2026-08-01T00:00:00Z', deleted_at: null });
    require.cache[CLIENT_PATH] = { id: CLIENT_PATH, filename: CLIENT_PATH, loaded: true, exports: { caseDraftClient: db, caseDraftDbStatus: () => 'ready', SERVER_KEY_MISSING: 'server_key_missing' } };
    delete require.cache[P('lib/casesDb.js')]; delete require.cache[P('lib/outputDraftsDb.js')];
    const quiet = console.log; console.log = () => {};
    let server; try { server = require('./server'); } finally { console.log = quiet; }
    const writesAtLoad = FILE_WRITES;
    const stack = (server.app._router || server.app.router).stack;
    function call(method, routePath, opts) {
      opts = opts || {};
      const layer = stack.find(l => l.route && l.route.path === routePath && l.route.methods[method]);
      if (!layer) return Promise.resolve({ status: -1, reached: [] });
      return new Promise(resolve => {
        const out = { status: 200, body: undefined, reached: [] };
        const res = { statusCode: 200, headersSent: false, locals: {}, status(c) { out.status = c; this.statusCode = c; return this; }, json(b) { out.body = b; resolve(out); return this; },
          setHeader() {}, set() { return this; }, getHeader() {}, end() { resolve(out); }, send(b) { out.body = b; resolve(out); } };
        const req = { method: method.toUpperCase(), url: opts.url || routePath, path: opts.url || routePath, params: opts.params || {}, query: opts.query || {},
          headers: Object.assign({}, opts.cookie ? { cookie: opts.cookie } : {}, opts.body ? { 'content-type': 'application/json' } : {}), body: opts.body || {}, _body: true, get(h) { return this.headers[String(h).toLowerCase()]; } };
        const handles = layer.route.stack.map(x => x.handle);
        const run = i => { if (i >= handles.length) return resolve(out); out.reached.push(i); try { const p = handles[i](req, res, () => run(i + 1)); if (p && p.catch) p.catch(e => { out.error = e.message; resolve(out); }); } catch (e) { out.error = e.message; resolve(out); } };
        run(0);
        setTimeout(() => resolve(Object.assign(out, { timeout: true })), 3000);
      });
    }
    const ROUTES = [
      ['get', '/api/cases', {}],
      ['post', '/api/cases', { body: { id: 'case-new', title: 'N' } }],
      ['get', '/api/case-memory/:caseId', { url: '/api/case-memory/case-a', params: { caseId: 'case-a' } }],
      ['post', '/api/case-memory/:caseId', { url: '/api/case-memory/case-a', params: { caseId: 'case-a' }, body: { purpose: 'p' } }],
      ['delete', '/api/cases/:id', { url: '/api/cases/case-c', params: { id: 'case-c' } }],
    ];
    const ws = require('./lib/webSession');
    const good = ws.SESSION_COOKIE_NAME + '=' + ws.issueSessionToken({ secret: TEST_SECRET }).token;
    const forged = ws.SESSION_COOKIE_NAME + '=' + ws.issueSessionToken({ secret: 'another-secret-not-the-server-one-000000' }).token;
    const expired = ws.SESSION_COOKIE_NAME + '=' + ws.issueSessionToken({ secret: TEST_SECRET, now: Date.now() - 3600 * 1000, ttlMs: 1000 }).token;
    const unauthVariants = [['cookie なし', undefined], ['署名が違う', forged], ['期限切れ', expired], ['形式不正', ws.SESSION_COOKIE_NAME + '=garbage']];
    const dbBefore = db.calls.length;
    for (const [m, rp, o] of ROUTES) {
      for (const [label, cookie] of unauthVariants) {
        const r = await call(m, rp, Object.assign({}, o, { cookie }));
        assert(r.status === 401 && r.body && r.body.reason === 'unauthorized' && r.reached.length === 1,
          '7-1. 未ログイン（' + label + '）' + m.toUpperCase() + ' ' + rp + ' → 401（最初の middleware で停止）', { status: r.status, reached: r.reached });
      }
    }
    // WEB_SESSION_SECRET が無い環境は、正しい形の cookie でも 401（fail-closed）
    delete process.env.WEB_SESSION_SECRET;
    for (const [m, rp, o] of ROUTES) {
      const r = await call(m, rp, Object.assign({}, o, { cookie: good }));
      assert(r.status === 401 && r.reached.length === 1, '7-2. session secret なしの環境 ' + m.toUpperCase() + ' ' + rp + ' → 401（認証の省略経路なし）');
    }
    process.env.WEB_SESSION_SECRET = TEST_SECRET;
    assert(db.calls.length === dbBefore && !require.cache[P('lib/casesDb.js')] && FILE_WRITES === writesAtLoad,
      '7-3. 未ログインの要求で DB 呼び出し 0・casesDb 未読込（fallback 処理にも到達しない）・ファイル書き込み 0', { db: db.calls.length - dbBefore, writes: writeLog });
    // ログイン済み: 従来どおり
    let r = await call('get', '/api/cases', { cookie: good });
    assert(r.status === 200 && r.body && r.body.ok === true && r.body.source === 'db' && r.body.cases.length === 2 && r.body.deletedIds.join() === 'case-d', '7-4. ログイン済み GET /api/cases → 従来の形（ok・cases・deletedIds・source）', r.body);
    r = await call('post', '/api/cases', Object.assign({}, ROUTES[1][2], { cookie: good }));
    assert(r.status === 200 && r.body.ok === true && db.tables.cases.some(x => x.id === 'case-new'), '7-5. ログイン済み POST /api/cases → 保存', r.body);
    r = await call('post', '/api/cases', { cookie: good, body: { id: 'x' } });
    assert(r.status === 400, '7-6. ログイン済みでも入力不足は従来どおり 400');
    r = await call('get', '/api/case-memory/:caseId', Object.assign({}, ROUTES[2][2], { cookie: good }));
    assert(r.status === 200 && r.body.ok === true && r.body.data && r.body.data.id === 'case-a', '7-7. ログイン済み GET /api/case-memory/:caseId', r.body);
    r = await call('post', '/api/case-memory/:caseId', Object.assign({}, ROUTES[3][2], { cookie: good }));
    assert(r.status === 200 && r.body.ok === true && db.tables.cases.find(x => x.id === 'case-a').purpose === 'p', '7-8. ログイン済み POST /api/case-memory/:caseId', r.body);
    r = await call('delete', '/api/cases/:id', Object.assign({}, ROUTES[4][2], { cookie: good }));
    assert(r.status === 200 && r.body.ok === true && db.tables.cases.find(x => x.id === 'case-c').deleted_at, '7-9. ログイン済み DELETE /api/cases/:id（論理削除・既存）', r.body);
    assert(db.calls.every(c => /^cases:/.test(c)) && FILE_WRITES === writesAtLoad, '7-10. ログイン済みの操作も cases 表だけ・ファイル書き込み 0', { calls: db.calls, writes: writeLog });
    assert(writesAtLoad === 0, '7-11. server.js の読み込み自体もファイル書き込み 0（listen なし）', writeLog);
  }

  caseHeader('8. 既存画面の呼び出し方との整合（index.html）');
  {
    const html = fs.readFileSync(P('index.html'), 'utf8');
    const loginIdx = html.indexOf("scheduleOutputDraftRestore('login');");
    const syncIdx = html.indexOf('syncCasesFromServer();', loginIdx);
    assert(loginIdx !== -1 && syncIdx !== -1 && syncIdx - loginIdx < 400, '8-1. ログイン成功後に案件一覧の同期を1回やり直す（起動時の同期は未ログインなら 401 で終わるため）');
    const s = html.slice(html.indexOf('async function syncCasesFromServer()'), html.indexOf('async function syncCasesFromServer()') + 400);
    assert(/if \(!res\.ok\) return;/.test(s), '8-2. 起動時の同期は 401 でも local を消さない（既存の !res.ok → return）');
    const p = html.slice(html.indexOf('async function _postCaseOnce('), html.indexOf('async function _postCaseOnce(') + 1200);
    assert(/res\.status >= 400 && res\.status < 500\) return \{ ok: false, status: res\.status, reason: 'client' \}/.test(p), '8-3. 案件保存の 401 は client 扱いで再送しない（local は保持）');
    assert(!/api\/cases[^\n]*credentials:\s*'omit'/.test(html), '8-4. cases の fetch は cookie を送る既定（same-origin）のまま');
  }

  caseHeader('6. 外部通信');
  assert(NET_ATTEMPTS === 0, '6-1. http／https／net／fetch への到達 0 件', NET_ATTEMPTS);

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  console.log(_failed === 0 ? '🟢 All case/draft access boundary cases passed（偽 client・TEST FIXTURE の鍵・本番未接続）' : '🔴 失敗あり');
  process.exit(_failed === 0 ? 0 : 1);
})().catch(e => { console.error('テスト実行エラー:', e && e.stack); process.exit(2); });
