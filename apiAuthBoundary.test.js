'use strict';
// apiAuthBoundary.test.js
// S3-B1b — Internal API Authorization Boundary（有料AI実行 ＋ 破壊的操作の認証境界）の
// deterministic テスト。
//
//   実HTTP server listen 0件 / server.js 全体起動 0件 / 実AI API 0件 /
//   実Anthropic API 0件 / 実OpenAI API 0件 / 実Supabase DB read/write 0件 /
//   本番DELETE 0件 / Network 0 / cost consumption 0。
//
//   検証方式:
//     - route 配線は server.js の source assertion（起動しない）
//     - 認証挙動は lib/webSession.js の requireSession() middleware を直接呼ぶ最小 harness
//     - provider / DB 到達の非発生は「handler が next() を経由しないと実行されない」ことを
//       middleware 単体で確認し、あわせて実 provider / 実 DB を一切 require しないことで担保する

const fs = require('fs');
const path = require('path');
const webSession = require('./lib/webSession');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const TEST_SECRET = 'test-web-session-secret-32bytes-long';
const SERVER_SRC = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const INDEX_SRC = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

const MW = "require('./lib/webSession').requireSession()";

// S3-B1b 対象（有料AI実行）
const PAID_ROUTES = [
  ['post', '/api/chat'],
  ['post', '/api/auto-task'],
  ['post', '/api/consult'],
  ['post', '/api/strategy-consolidate'],
  ['post', '/api/leader-summary'],
  ['post', '/api/strategy-monitor'],
  ['get', '/api/claude-test'],
];
// S3-B1b 対象（破壊的操作）
const DESTRUCTIVE_ROUTES = [
  ['delete', '/api/cases/:id'],
  ['delete', '/api/customers/:id'],
  ['delete', '/api/knowledge-library/:genre/:id'],
  ['delete', '/api/admin/members/:id'],
];
// 今回 requireSession を新規追加してはいけない route
const MUST_STAY_OPEN = [
  ['post', '/api/evidence/web-search'],
  ['post', '/webhook'],
  ['get', '/api/auth-required'],
  ['get', '/'],
  // ['get', '/api/cases'] は 2026-10-15 の案件データ認証境界で CASE_ROUTES へ移した（S3-B1b 時点の scope 固定から外す）
  ['get', '/api/task-history'],
  // ['get', '/api/approvals'] は 2026-11-19 の承認 API 認証境界で APPROVAL_ROUTES へ移した
  ['get', '/api/cost'],
  ['get', '/api/claude-cost'],
  ['get', '/api/company-memory'],
  ['get', '/api/knowledge-library'],
  ['get', '/api/affiliate-evaluations'],
  ['get', '/api/messages'],
  ['get', '/api/tasks'],
  ['get', '/api/customers'],
  ['get', '/api/customers/:id'],
];
// 2026-10-15 案件データ（cases）の認証境界で保護を追加した route（共有 session による利用者の制限・案件ごとの所有者確認ではない）
const CASE_ROUTES = [
  ['get', '/api/cases'],
  ['post', '/api/cases'],
  ['get', '/api/case-memory/:caseId'],
  ['post', '/api/case-memory/:caseId'],
];
// 2026-11-19 承認 API の認証境界で保護を追加した route（共有 session による利用者の制限・案件ごとの所有者確認ではない）
const APPROVAL_ROUTES = [
  ['get', '/api/approvals'],
  ['post', '/api/approvals'],
];
// S2 で既に保護済み（回帰確認）
const S2_ROUTES = [
  ['get', '/api/session-status'],
  ['get', '/api/output-drafts'],
  ['post', '/api/output-drafts'],
];

// server.js から「その route 宣言行」を取り出す
function routeDecl(method, p) {
  const needle = 'app.' + method + "('" + p + "'";
  const i = SERVER_SRC.indexOf(needle);
  if (i === -1) return null;
  const end = SERVER_SRC.indexOf('\n', i);
  return SERVER_SRC.slice(i, end === -1 ? i + 300 : end);
}
function hasSession(method, p) {
  const d = routeDecl(method, p);
  return d !== null && d.indexOf(MW) !== -1;
}

function fakeReqRes(cookieHeader) {
  const res = {
    _status: null, _json: null,
    status(s) { this._status = s; return this; },
    json(b) { this._json = b; return this; },
  };
  const req = { headers: cookieHeader ? { cookie: cookieHeader } : {}, body: {}, query: {}, params: {} };
  return { req, res };
}
async function withSessionSecret(val, fn) {
  const saved = process.env.WEB_SESSION_SECRET;
  if (val === undefined) delete process.env.WEB_SESSION_SECRET;
  else process.env.WEB_SESSION_SECRET = val;
  try { return await fn(); }
  finally {
    if (saved === undefined) delete process.env.WEB_SESSION_SECRET;
    else process.env.WEB_SESSION_SECRET = saved;
  }
}

// middleware → (到達したら実行される) handler、という express の合成を再現し、
// 未認証時に handler が一切呼ばれないことを検証する harness。
// ★ handler は provider / DB の代わりに「呼ばれたら記録するだけの spy」にする（実 API/DB を使わない）。
function runChain(middleware, handlerSpy, cookieHeader) {
  const { req, res } = fakeReqRes(cookieHeader);
  let nextCalled = false;
  middleware(req, res, () => { nextCalled = true; handlerSpy(req, res); });
  return { req, res, nextCalled };
}

(async () => {
  console.log('\n=== apiAuthBoundary.test.js (S3-B1b) ===');

  // ══════════════════════════════════════════════════════════════
  caseHeader('1. 有料AI実行 7 route に requireSession が適用されている');
  {
    PAID_ROUTES.forEach(function (r) {
      const d = routeDecl(r[0], r[1]);
      assert(d !== null, '1a. route が存在: ' + r[0].toUpperCase() + ' ' + r[1]);
      assert(hasSession(r[0], r[1]), '1b. requireSession 適用: ' + r[0].toUpperCase() + ' ' + r[1]);
    });
  }

  caseHeader('2. middleware 位置（express.json / validation / provider より前）');
  {
    // POST 6本は express.json() より前に requireSession がある＝body parse すら到達しない
    PAID_ROUTES.filter(function (r) { return r[0] === 'post'; }).forEach(function (r) {
      const d = routeDecl(r[0], r[1]);
      const iSess = d.indexOf(MW);
      const iJson = d.indexOf('express.json()');
      assert(iSess !== -1 && iJson !== -1 && iSess < iJson,
        '2a. ' + r[1] + ': requireSession が express.json() より前');
    });
    // GET /api/claude-test は宣言行に validation より前の位置で middleware が入る
    const ct = routeDecl('get', '/api/claude-test');
    assert(ct.indexOf(MW) !== -1 && ct.indexOf('async (req, res)') > ct.indexOf(MW),
      '2b. /api/claude-test: requireSession が handler 本体より前');
    // handler 本体（agent validation / testClaudeAgent）は宣言行の後ろにある＝middleware 通過後にのみ到達
    const ctIdx = SERVER_SRC.indexOf("app.get('/api/claude-test'");
    const ctBody = SERVER_SRC.slice(ctIdx, ctIdx + 600);
    assert(ctBody.indexOf('testClaudeAgent') > ctBody.indexOf(MW),
      '2c. ★/api/claude-test: testClaudeAgent() は requireSession の後（未認証では到達不能）');
    assert(ctBody.indexOf("req.query.agent") > ctBody.indexOf(MW),
      '2d. /api/claude-test: agent validation も requireSession の後');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('3. 未認証 → 401 / handler 未到達（provider・DB 実行 0）');
  {
    await withSessionSecret(TEST_SECRET, async () => {
      const mw = webSession.requireSession();

      // 有料AI 7 route 相当: handler が呼ばれたら provider を呼んだものとみなす spy
      let providerCalls = 0;
      const providerSpy = function () { providerCalls++; };
      PAID_ROUTES.forEach(function (r) {
        const out = runChain(mw, providerSpy, null);   // cookie なし＝未認証
        assert(out.res._status === 401 && out.nextCalled === false,
          '3a. 未認証 401 / handler 未到達: ' + r[0].toUpperCase() + ' ' + r[1]);
      });
      assert(providerCalls === 0, '3b. ★provider spy 呼出 = 0（AI 実行 0・cost consumption 0）');

      // 破壊的 4 route 相当: handler が呼ばれたら DB mutation したものとみなす spy
      let dbMutations = 0;
      const dbSpy = function () { dbMutations++; };
      DESTRUCTIVE_ROUTES.forEach(function (r) {
        const out = runChain(mw, dbSpy, null);
        assert(out.res._status === 401 && out.nextCalled === false,
          '3c. 未認証 401 / handler 未到達: ' + r[0].toUpperCase() + ' ' + r[1]);
      });
      assert(dbMutations === 0, '3d. ★DB mutation spy 呼出 = 0（softDeleteCase / deleteCustomer / deleteEntry / remove 未実行）');

      // 応答は理由詳細を漏らさない
      const one = runChain(mw, function () {}, null);
      assert(one.res._json && one.res._json.ok === false && one.res._json.reason === 'unauthorized',
        '3e. 401 応答は { ok:false, reason:"unauthorized" }');
    });
  }

  caseHeader('4. 認証済み → middleware 通過（実 AI / 実 DB は呼ばない）');
  {
    await withSessionSecret(TEST_SECRET, async () => {
      const mw = webSession.requireSession();
      const issued = webSession.issueSessionToken({ secret: TEST_SECRET, now: Date.now() });
      assert(issued.ok === true, '4a. session token 発行 OK');
      const cookie = webSession.SESSION_COOKIE_NAME + '=' + issued.token;

      let reached = 0;
      const safeHandler = function (req, res) { reached++; res.status(200).json({ ok: true }); };  // 実 AI/DB を呼ばない安全 handler
      PAID_ROUTES.concat(DESTRUCTIVE_ROUTES).forEach(function () {
        runChain(mw, safeHandler, cookie);
      });
      assert(reached === PAID_ROUTES.length + DESTRUCTIVE_ROUTES.length,
        '4b. 認証済みで 11 route すべて handler へ到達: ' + reached + '/11');

      // 改竄 cookie は通さない
      const bad = runChain(mw, safeHandler, webSession.SESSION_COOKIE_NAME + '=' + issued.token.slice(0, -3) + 'AAA');
      assert(bad.res._status === 401 && bad.nextCalled === false, '4c. 署名改竄 → 401');
    });

    // secret 未設定 → 常に 401（bypass なし）
    await withSessionSecret(undefined, async () => {
      const mw = webSession.requireSession();
      const out = runChain(mw, function () {}, webSession.SESSION_COOKIE_NAME + '=s1.x.y');
      assert(out.res._status === 401 && out.nextCalled === false,
        '4d. WEB_SESSION_SECRET 未設定 → 常に 401（環境判定 bypass なし）');
    });
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('5. scope 固定（今回 requireSession を新規追加していない route）');
  {
    MUST_STAY_OPEN.forEach(function (r) {
      const d = routeDecl(r[0], r[1]);
      if (d === null) { assert(true, '5. route 定義なし（対象外）: ' + r[1]); return; }
      assert(d.indexOf(MW) === -1,
        '5. requireSession を追加していない: ' + r[0].toUpperCase() + ' ' + r[1]);
    });
    // 特に webhook / auth-required は絶対に閉じない
    assert(!hasSession('post', '/webhook'), '5z-1. ★POST /webhook に requireSession を付けない（外部service呼出）');
    assert(!hasSession('get', '/api/auth-required'), '5z-2. ★GET /api/auth-required は public のまま');
    assert(!hasSession('post', '/api/evidence/web-search'),
      '5z-3. ★POST /api/evidence/web-search は今回変更しない（billingLock + canProcess 二重ガード済み）');
  }

  caseHeader('6. requireSession 適用 route 数が設計と一致（意図しない拡大の検出）');
  {
    const applied = (SERVER_SRC.match(/^app\.(get|post|put|patch|delete)\('[^']*',\s*require\('\.\/lib\/webSession'\)\.requireSession\(\)/gm) || []);
    assert(applied.length === 20,
      '6a. ★requireSession 適用は 20 route（S2 の 3 ＋ S3-B1b の 11 ＋ 案件データの 4 ＋ 承認 API の 2）: ' + applied.length);
    const expected = S2_ROUTES.concat(PAID_ROUTES, DESTRUCTIVE_ROUTES, CASE_ROUTES, APPROVAL_ROUTES);
    expected.forEach(function (r) {
      assert(hasSession(r[0], r[1]), '6b. 期待どおり適用: ' + r[0].toUpperCase() + ' ' + r[1]);
    });
  }

  caseHeader('7. S2 regression（既存 3 route 不変）');
  {
    S2_ROUTES.forEach(function (r) {
      assert(hasSession(r[0], r[1]), '7a. S2 保護維持: ' + r[0].toUpperCase() + ' ' + r[1]);
    });
    const gi = SERVER_SRC.indexOf("app.get('/api/output-drafts'");
    assert(SERVER_SRC.slice(gi, gi + 400).indexOf('requireTrustedOrigin') === -1,
      '7b. GET /api/output-drafts に requireTrustedOrigin なし（S2 設計維持）');
    assert(SERVER_SRC.indexOf('res.json({ ok: true })') !== -1, '7c. session-status の応答契約は不変');
  }

  caseHeader('8. requireTrustedOrigin を今回追加していない');
  {
    PAID_ROUTES.concat(DESTRUCTIVE_ROUTES).forEach(function (r) {
      const d = routeDecl(r[0], r[1]);
      assert(d.indexOf('requireTrustedOrigin') === -1,
        '8. requireTrustedOrigin 未追加: ' + r[0].toUpperCase() + ' ' + r[1]);
    });
  }

  caseHeader('9. 変更禁止ファイルが無変更（source assertion）');
  {
    const ws = fs.readFileSync(path.join(__dirname, 'lib', 'webSession.js'), 'utf8');
    assert(ws.indexOf('claude-test') === -1 && ws.indexOf('S3-B1') === -1,
      '9a. lib/webSession.js は無変更（新 auth architecture なし）');
    assert(INDEX_SRC.indexOf('S3-B1') === -1, '9b. index.html に S3-B1 由来の変更なし');
    const cc = fs.readFileSync(path.join(__dirname, 'claudeClient.js'), 'utf8');
    assert(cc.indexOf('requireSession') === -1, '9c. claudeClient.js は無変更（testClaudeAgent 不変）');
    const oc = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
    assert(oc.indexOf('requireSession') === -1, '9d. openaiClient.js は無変更');
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    assert(JSON.stringify(Object.keys(pkg.dependencies || {}).sort())
      === JSON.stringify(['@anthropic-ai/sdk', '@supabase/supabase-js', 'axios', 'dotenv', 'express', 'opentype.js', 'sharp']),
      '9e. package.json dependencies 変更なし');
  }

  caseHeader('10. Carousel regression（既存 auth 境界 不変）');
  {
    const cr = fs.readFileSync(path.join(__dirname, 'lib', 'carouselImageRoutes.js'), 'utf8');
    assert(/app\.post\('\/api\/carousel-image\/approval', session, origin,/.test(cr), '10a. Carousel approval = session+origin');
    assert(/app\.post\('\/api\/carousel-image\/generate', session, origin,/.test(cr), '10b. Carousel generate = session+origin');
    assert(/app\.get\('\/api\/carousel-image\/assets', session,/.test(cr), '10c. Carousel assets = session のみ');
  }

  caseHeader('11. /api/claude-test は endpoint 形状を変えていない');
  {
    assert(/app\.get\('\/api\/claude-test'/.test(SERVER_SRC), '11a. GET のまま（POST へ変更していない）');
    const i = SERVER_SRC.indexOf("app.get('/api/claude-test'");
    const body = SERVER_SRC.slice(i, i + 700);
    assert(body.indexOf("['writer', 'reviewer', 'strategy']") !== -1, '11b. agent 検証ロジック不変');
    assert(body.indexOf('testClaudeAgent(agentId)') !== -1, '11c. testClaudeAgent 呼出形不変（削除していない）');
  }

  caseHeader('13. 承認 API（2026-11-19）: server.js の実 route 定義を偽 app に登録して実行（実 DB なし）');
  {
    // server.js から route 宣言の塊（app.xxx('/api/approvals' 〜 最初の行頭 "});"）を取り出し、
    //   偽 app・偽 getApprovalsDb（呼出を記録する spy）で評価する。middleware は本物の requireSession。
    function routeBlock(method) {
      const start = SERVER_SRC.indexOf('app.' + method + "('/api/approvals'");
      const end = SERVER_SRC.indexOf('\n});', start);
      return start === -1 || end === -1 ? null : SERVER_SRC.slice(start, end + 4);
    }
    function loadRoute(method, dbSpy) {
      const registered = [];
      const fakeApp = { get(p, ...h) { registered.push({ m: 'get', p, h }); }, post(p, ...h) { registered.push({ m: 'post', p, h }); } };
      new Function('app', 'require', 'getApprovalsDb', routeBlock(method))(fakeApp, require, function () { return dbSpy; });
      return registered[0];
    }
    async function call(route, cookieHeader, query, body) {
      const { req, res } = fakeReqRes(cookieHeader);
      req.query = query || {}; req.body = body || {};
      let i = 0;
      async function next() { const h = route.h[i++]; if (h) await h(req, res, next); }
      await next();
      return res;
    }
    function spyDb() {
      const s = { calls: [],
        async getApproval(c, o) { s.calls.push(['getApproval', c, o]); return { approval: { case_id: c, output_id: o, approval_decision: null }, source: 'db' }; },
        async getApprovals() { s.calls.push(['getApprovals']); return { approvals: [], source: 'db' }; },
        async upsertApproval(row) { s.calls.push(['upsertApproval', row]); return { error: null }; } };
      return s;
    }
    await withSessionSecret(TEST_SECRET, async () => {
      const issued = webSession.issueSessionToken({ secret: TEST_SECRET, now: Date.now() });
      const cookie = webSession.SESSION_COOKIE_NAME + '=' + issued.token;
      const body = { caseId: 'case-x', outputId: 'out-x', approvalDecision: 'approved', approvedAt: '2026-11-19T00:00:00Z', published: false, checklist: { caption: true }, reviewStatus: 'approved' };

      let db = spyDb(); let r = loadRoute('get', db);
      assert(r && r.p === '/api/approvals' && r.h.length === 2, '13a. GET /api/approvals = requireSession ＋ handler');
      let res = await call(r, null, { caseId: 'case-x', outputId: 'out-x' });
      assert(res._status === 401 && res._json && res._json.reason === 'unauthorized' && db.calls.length === 0, '13b. ★未認証 GET（caseId 指定）→ 401・DB 読み取り 0', db.calls);
      res = await call(r, null, {});
      assert(res._status === 401 && db.calls.length === 0, '13c. ★未認証 GET（全件）→ 401・DB 読み取り 0');
      res = await call(r, cookie, { caseId: 'case-x', outputId: 'out-x' });
      assert(res._status === null && res._json && res._json.ok === true && res._json.approval && res._json.approval.output_id === 'out-x'
        && db.calls.length === 1 && db.calls[0][0] === 'getApproval' && db.calls[0][1] === 'case-x' && db.calls[0][2] === 'out-x',
        '13d. 認証済み GET は従来どおり getApproval(caseId, outputId) の結果を返す', db.calls);

      db = spyDb(); r = loadRoute('post', db);
      assert(r && r.p === '/api/approvals' && r.h.length === 2, '13e. POST /api/approvals = requireSession ＋ handler');
      res = await call(r, null, null, body);
      assert(res._status === 401 && db.calls.length === 0, '13f. ★未認証 POST → 401・upsertApproval 呼出 0（保存処理に到達しない）', db.calls);
      res = await call(r, webSession.SESSION_COOKIE_NAME + '=' + issued.token.slice(0, -3) + 'AAA', null, body);
      assert(res._status === 401 && db.calls.length === 0, '13g. ★署名改竄 cookie の POST → 401・upsertApproval 呼出 0');
      res = await call(r, cookie, null, body);
      const up = db.calls[0];
      assert(res._json && res._json.ok === true && db.calls.length === 1 && up[0] === 'upsertApproval'
        && JSON.stringify(Object.keys(up[1]).sort()) === JSON.stringify(['approvalDecision', 'approvedAt', 'archived', 'caseId', 'checklist', 'outputId', 'published', 'publishedAt', 'reviewStatus'])
        && up[1].caseId === 'case-x' && up[1].outputId === 'out-x' && up[1].approvalDecision === 'approved',
        '13h. 認証済み POST は従来どおり同じ 9 項目で upsertApproval を 1 回呼ぶ', db.calls);
      res = await call(r, cookie, null, { outputId: 'out-x' });
      assert(res._status === 400 && db.calls.length === 1, '13i. 認証済みでも caseId なしは従来どおり 400（保存しない）');
    });
    await withSessionSecret(undefined, async () => {
      const db = spyDb(); const r = loadRoute('post', db);
      const res = await call(r, webSession.SESSION_COOKIE_NAME + '=s1.x.y', null, { caseId: 'case-x' });
      assert(res._status === 401 && db.calls.length === 0, '13j. WEB_SESSION_SECRET 未設定 → POST も常に 401（bypass なし）');
    });
  }

  caseHeader('12. 実 provider / 実 DB を一切 require していない（本テストの安全性）');
  {
    const self = fs.readFileSync(__filename, 'utf8');
    ['openaiClient', 'claudeClient', './lib/supabase', 'anthropic-ai/sdk'].forEach(function (m) {
      assert(self.indexOf("require('" + m) === -1 && self.indexOf('require("' + m) === -1,
        '12. ' + m + ' を require していない');
    });
    // ★ 自己参照による誤検出を避けるため、検出語はリテラルを分割して組み立てる
    const fetchCall = new RegExp('await' + '\\s+' + 'fetch' + '\\(');
    assert(self.indexOf('node-' + 'fetch') === -1 && !fetchCall.test(self), '12z. 実 HTTP 送信なし');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All apiAuthBoundary cases passed (S3-B1b)'); }
})().catch(function (e) { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
