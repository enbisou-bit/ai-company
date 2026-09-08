'use strict';
// carouselAccessControl.test.js
// Phase 2-E Production Connection Step C-5-pre — Billing Lock Contract Repair +
// Server-side Access Control の deterministic テスト。
//   実HTTP listen 0 / 実Supabase 0 / 実Storage 0 / 実OpenAI 0 / paid generation 0 /
//   REAL_ENABLED は withRealEnabled() 内でのみ一時変更（save/restore・ソース非変更）。

const fs = require('fs');
const path = require('path');

const core = require('./shared/carouselImageCore');
const client = require('./lib/carouselImageClient');
const assetStorage = require('./lib/carouselAssetStorage');
const assetAccess = require('./lib/carouselAssetAccess');
const service = require('./lib/carouselImageService');
const routes = require('./lib/carouselImageRoutes');
const webSession = require('./lib/webSession');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const TEST_SESSION_SECRET = 'test-web-session-secret-32bytes-ok';
const TEST_APPROVAL_SECRET = 'test-carousel-approval-secret-32bytes';
const FIXED_NOW = Date.parse('2026-09-08T00:00:00.000Z');
const PROD_ORIGIN = 'https://ai-company.onrender.com';

const FIXTURE_DRAFT = {
  case_id: 'case-value-1788410623',
  output_id: 'out_1788413020275',
  built_at: '2026-09-03T05:24:48.532Z',
  updated_at: '2026-09-03T05:52:03.598Z',
  fields: {
    slides: [
      '【1枚目】タイトル：毎日のスキンケア、まず見直したい5つの基本 / 本文：見直してみませんか？ / ビジュアル：清潔感のある洗面台',
      '【2枚目】タイトル：1. やさしく洗う / 本文：こすりすぎない。 / ビジュアル：泡のイメージ',
      '【3枚目】タイトル：2. 早めに保湿 / 本文：乾く前に保湿。 / ビジュアル：化粧水のボトル',
      '【4枚目】タイトル：3. 量を減らしすぎない / 本文：少なすぎると物足りない。 / ビジュアル：適量のメモ',
      '【5枚目】タイトル：4. 触りすぎない / 本文：何度も触らない。 / ビジュアル：注意アイコン',
      '【6枚目】タイトル：5. 続けやすく / 本文：続けやすい流れに。 / ビジュアル：チェックリスト',
      '【7枚目】タイトル：今日から見直す5つ / 本文：この5つをチェック。 / ビジュアル：一覧レイアウト',
    ],
    imagePrompts: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
    cta: 'あとで見返せるように保存してください。',
  },
};
const FIXTURE_APPROVAL = { approval_decision: 'approved', published: false };

function clone(o) { return JSON.parse(JSON.stringify(o)); }
function makePngBuffer() { return Buffer.concat([assetStorage.PNG_MAGIC, Buffer.alloc(64, 0x02)]); }

function makeFakeStorageClient() {
  const objects = new Map();
  return {
    _objects: objects,
    storage: {
      from(bucket) {
        return {
          upload: async (p, buffer, options) => {
            const key = bucket + '::' + p;
            if (objects.has(key)) return { data: null, error: { statusCode: '409', message: 'exists' } };
            objects.set(key, { buffer, options });
            return { data: { id: 'f' + objects.size, path: p, fullPath: bucket + '/' + p }, error: null };
          },
          createSignedUrl: async (p, ttl) => ({ data: { signedUrl: 'https://fake.local/s/' + encodeURIComponent(p) + '?ttl=' + ttl }, error: null }),
        };
      },
    },
  };
}

// ── deps harness（reserve/provider/storage の呼び出し回数を計測できる） ──
function makeHarness(depsOverrides) {
  const drafts = new Map();
  const approvals = new Map();
  const executions = [];
  const storageClient = makeFakeStorageClient();
  const counters = { reserveCalls: 0, providerCalls: 0, storageCalls: 0, metadataWrites: 0 };

  function seedDraft(row) { drafts.set(row.case_id + '::' + row.output_id, clone(row)); }
  function seedApproval(caseId, outputId, row) { approvals.set(caseId + '::' + outputId, row ? clone(row) : row); }

  const executionStore = {
    reserve: async (payload) => {
      counters.reserveCalls++;
      const active = executions.find(e => e.output_id === payload.outputId && (e.status === 'in_progress' || e.status === 'completed'));
      if (active) return { ok: false, reason: 'post_execution_in_progress' };
      executions.push({ nonce: payload.nonce, output_id: payload.outputId, status: 'in_progress', spent_estimated_jpy: 0, estimated_total_cost_jpy: payload.estimatedTotalCostJpy });
      return { ok: true, execution: { nonce: payload.nonce } };
    },
    complete: async (payload) => {
      const row = executions.find(e => e.nonce === payload.nonce && e.status === 'in_progress');
      if (!row) return { ok: false, reason: 'execution_not_found' };
      row.status = 'completed'; row.spent_estimated_jpy = payload.spentEstimatedJpy;
      return { ok: true };
    },
    fail: async (payload) => {
      const row = executions.find(e => e.nonce === payload.nonce && e.status === 'in_progress');
      if (!row) return { ok: false, reason: 'execution_not_found' };
      row.status = payload.status;
      return { ok: true };
    },
  };

  const defaults = {
    loadOutputDraft: async ({ caseId, outputId }) => drafts.get(caseId + '::' + outputId) || null,
    loadApproval: async ({ caseId, outputId }) => (approvals.has(caseId + '::' + outputId) ? approvals.get(caseId + '::' + outputId) : null),
    getCumulativeSpentJpyByOutputId: async () => ({ ok: true, cumulativeJpy: 0 }),
    saveOutputDraftAssets: async ({ caseId, outputId, fields }) => {
      counters.metadataWrites++;
      const key = caseId + '::' + outputId;
      const row = drafts.get(key);
      if (!row) return { ok: false, reason: 'not_found' };
      row.fields = fields; drafts.set(key, row);
      return { ok: true };
    },
    executionStore: executionStore,
    provider: async (opts) => {
      counters.providerCalls++;
      return { ok: true, buffer: makePngBuffer(), usage: { textInputTokens: 3200, imageInputTokens: 0, outputTokens: 11109, totalTokens: 14309, completeness: 'complete' } };
    },
    normalize: async ({ buffer }) => ({ ok: true, buffer: buffer }),
    composite: async ({ backgroundBuffer }) => ({ ok: true, buffer: backgroundBuffer }),
    uploadCarouselAssets: async (items, opts) => { counters.storageCalls++; return assetStorage.uploadCarouselAssets(items, opts); },
    createSignedUrl: assetAccess.createSignedUrl,
    runCarouselImageJob: core.runCarouselImageJob,
    checkCostLimit: () => true,
    approvalSecret: TEST_APPROVAL_SECRET,
    budgetJpyPerPost: 100,
    now: () => FIXED_NOW,
    storageClient: storageClient,
    signedUrlExpiresIn: 300,
    sessionOptions: { secret: TEST_SESSION_SECRET, now: () => FIXED_NOW },
    originOptions: { trustedOrigins: [PROD_ORIGIN] },
  };

  const deps = Object.assign({}, defaults, depsOverrides || {});
  return { deps, drafts, approvals, executions, storageClient, counters, seedDraft, seedApproval };
}

function makeFakeApp() {
  const registered = {};
  return {
    registered,
    post(p, ...handlers) { registered['POST ' + p] = handlers; },
    get(p, ...handlers) { registered['GET ' + p] = handlers; },
  };
}

function makeReqRes(opts) {
  opts = opts || {};
  const headers = Object.assign({}, opts.headers || {});
  if (opts.cookieToken !== undefined && opts.cookieToken !== null) {
    headers.cookie = webSession.SESSION_COOKIE_NAME + '=' + opts.cookieToken;
  }
  if (opts.origin !== undefined && opts.origin !== null) headers.origin = opts.origin;
  const req = { headers: headers, body: opts.body || {}, query: opts.query || {} };
  const res = {
    _status: null, _json: null, _headers: {},
    status(s) { this._status = s; return this; },
    json(b) { this._json = b; return this; },
    setHeader(k, v) { this._headers[k] = v; return this; },
  };
  return { req, res };
}

// Express の middleware chain を再現（next() が呼ばれなければそこで終了）
async function runChain(handlers, req, res) {
  for (let i = 0; i < handlers.length; i++) {
    let nextCalled = false;
    await handlers[i](req, res, () => { nextCalled = true; });
    if (!nextCalled) return res;
  }
  return res;
}

function validSessionToken(now) {
  return webSession.issueSessionToken({ secret: TEST_SESSION_SECRET, now: now === undefined ? FIXED_NOW : now }).token;
}

// Production Activation Step PA-1: REAL_ENABLED は source gate（このsetter）と
//   env gate（process.env.CAROUSEL_IMAGE_REAL_ENABLED==='true'）の dual-key AND になった。
//   fake success path のテストは両方を一時的に立てる。env var は必ず元の値へ復元する
//   （process.env を汚染したままにしない）。
async function withRealEnabled(fn) {
  const savedEnv = process.env.CAROUSEL_IMAGE_REAL_ENABLED;
  client.REAL_ENABLED = true;
  process.env.CAROUSEL_IMAGE_REAL_ENABLED = 'true';
  try { await fn(); }
  finally {
    client.REAL_ENABLED = false;
    if (savedEnv === undefined) delete process.env.CAROUSEL_IMAGE_REAL_ENABLED;
    else process.env.CAROUSEL_IMAGE_REAL_ENABLED = savedEnv;
  }
}

async function issueApprovalToken(h) {
  const r = await service.handleApprovalRequest(
    { caseId: FIXTURE_DRAFT.case_id, outputId: FIXTURE_DRAFT.output_id, quality: 'medium' }, h.deps);
  return r.body.approvalToken;
}

(async () => {
  // ══════════════════════════════════════════════════
  caseHeader('Billing Lock（#27-1〜9）');
  // ══════════════════════════════════════════════════
  {
    // 1. false → pass（fake generation 成功まで到達）
    await withRealEnabled(async () => {
      const h = makeHarness();
      h.seedDraft(FIXTURE_DRAFT); h.seedApproval(FIXTURE_DRAFT.case_id, FIXTURE_DRAFT.output_id, FIXTURE_APPROVAL);
      const token = await issueApprovalToken(h);
      const res = await service.handleGenerateRequest({ approvalToken: token, billingLock: false }, h.deps);
      assert(res.status === 200 && res.body.ok === true, '1. billingLock=false → 生成到達（fake path）');
      assert(h.counters.providerCalls === 7 && h.counters.storageCalls === 1, '1b. provider/Storageまで正常到達');
    });

    // 2〜6. 拒否されるべき値すべて
    const rejectCases = [
      ['true(boolean)', true], ['missing(undefined)', undefined], ['null', null],
      ["'false'(string)", 'false'], ["'true'(string)", 'true'], ['0(number)', 0], ["''(empty string)", ''],
    ];
    for (const [label, value] of rejectCases) {
      await withRealEnabled(async () => {
        const h = makeHarness();
        h.seedDraft(FIXTURE_DRAFT); h.seedApproval(FIXTURE_DRAFT.case_id, FIXTURE_DRAFT.output_id, FIXTURE_APPROVAL);
        const token = await issueApprovalToken(h);
        const body = { approvalToken: token };
        if (value !== undefined) body.billingLock = value;
        const res = await service.handleGenerateRequest(body, h.deps);
        assert(res.status === 403 && res.body.reason === 'billing_locked', '2〜6. billingLock=' + label + ' → 403 billing_locked');
        // 7/8/9. reserve / provider / Storage いずれにも到達していない
        assert(h.counters.reserveCalls === 0 && h.counters.providerCalls === 0 && h.counters.storageCalls === 0,
          '7〜9. billingLock=' + label + ' 拒否は reserve/provider/Storage より前（全カウンタ0）');
      });
    }

    // billingLock は「拒否のみ可能」で authority を与えない（false 以外を送っても何も許可されない）
    {
      const h = makeHarness();
      h.seedDraft(FIXTURE_DRAFT); h.seedApproval(FIXTURE_DRAFT.case_id, FIXTURE_DRAFT.output_id, FIXTURE_APPROVAL);
      const res = await service.handleGenerateRequest({ approvalToken: 'v1.x.y', billingLock: false }, h.deps);
      assert(res.status !== 200, 'billingLock=false でも approval token が無効なら生成不可（単独では権限にならない）');
    }
  }

  // ══════════════════════════════════════════════════
  caseHeader('Session primitives（#27-16〜19, 21〜22, 27）');
  // ══════════════════════════════════════════════════
  {
    const t = validSessionToken();
    // 16. forged session
    const forged = 's1.' + Buffer.from(JSON.stringify({ v: 1, iat: FIXED_NOW, exp: FIXED_NOW + 3600000 })).toString('base64url') + '.AAAA';
    assert(webSession.verifySessionToken(forged, { secret: TEST_SESSION_SECRET, now: FIXED_NOW }).ok === false,
      '16. 偽造session（署名なし自作payload）は検証失敗');
    // 19. wrong signature（別secretで署名）
    const otherSecretToken = webSession.issueSessionToken({ secret: 'y'.repeat(32), now: FIXED_NOW }).token;
    const wrongSig = webSession.verifySessionToken(otherSecretToken, { secret: TEST_SESSION_SECRET, now: FIXED_NOW });
    assert(wrongSig.ok === false && wrongSig.reason === 'signature_invalid', '19. 別secretで署名されたtoken → signature_invalid');
    // 17/27. expired
    const exp = webSession.verifySessionToken(t, { secret: TEST_SESSION_SECRET, now: FIXED_NOW + webSession.DEFAULT_TTL_MS + 1 });
    assert(exp.ok === false && exp.reason === 'session_expired', '17/27. 期限切れ → session_expired（expiry強制）');
    // 18. malformed
    ['', 'abc', 's1.only-two', 'v1.aaa.bbb', 's1.!!!.###'].forEach((bad, i) => {
      assert(webSession.verifySessionToken(bad, { secret: TEST_SESSION_SECRET, now: FIXED_NOW }).ok === false,
        '18-' + i + '. 不正形式token は検証失敗: ' + JSON.stringify(bad));
    });
    // secret未設定 → 常に失敗（環境不備で開かない）
    assert(webSession.verifySessionToken(t, { secret: '', now: FIXED_NOW }).reason === 'session_secret_unavailable',
      'secret未設定なら有効なtokenでも検証不可（fail-closed）');
    assert(webSession.verifySessionToken(t, { secret: 'short', now: FIXED_NOW }).reason === 'session_secret_unavailable',
      'secretが最小長(16)未満なら無効');
    // 21/22. cookieにpassword/secretが載らない
    const cookieHeader = webSession.buildSetCookieHeader(t, { secure: true });
    assert(cookieHeader.indexOf(TEST_SESSION_SECRET) === -1, '22. cookieにsecret値が含まれない');
    const payloadJson = JSON.stringify(webSession.verifySessionToken(t, { secret: TEST_SESSION_SECRET, now: FIXED_NOW }).payload);
    assert(payloadJson.indexOf('password') === -1 && Object.keys(JSON.parse(payloadJson)).sort().join(',') === 'exp,iat,v',
      '21. session payloadは {v,iat,exp} のみ（password/PII/roleなし）');
  }

  // ══════════════════════════════════════════════════
  caseHeader('Cookie contract（#27-23〜26, 28）');
  // ══════════════════════════════════════════════════
  {
    const t = validSessionToken();
    const secureCookie = webSession.buildSetCookieHeader(t, { secure: true, maxAgeMs: 3600000 });
    assert(secureCookie.indexOf('HttpOnly') !== -1, '23. HttpOnly が付与される');
    assert(secureCookie.indexOf('SameSite=Strict') !== -1, '24. SameSite=Strict が付与される');
    assert(secureCookie.indexOf('Secure') !== -1, '25. HTTPS要求では Secure が付与される');
    const plainCookie = webSession.buildSetCookieHeader(t, { secure: false });
    assert(plainCookie.indexOf('Secure') === -1, '26. localhost(HTTP)では Secure を付けない（cookie破棄回避）');
    assert(plainCookie.indexOf('HttpOnly') !== -1 && plainCookie.indexOf('SameSite=Strict') !== -1,
      '26b. localhostでも HttpOnly / SameSite=Strict は維持');
    const cleared = webSession.buildClearCookieHeader({ secure: true });
    assert(cleared.indexOf('Max-Age=0') !== -1 && cleared.indexOf(webSession.SESSION_COOKIE_NAME + '=;') !== -1,
      '28. logout用ヘッダは Max-Age=0 で cookie を失効させる');
    // isRequestSecure（proxy配下判定）
    assert(webSession.isRequestSecure({ headers: { 'x-forwarded-proto': 'https' } }) === true, 'x-forwarded-proto=https → secure判定');
    assert(webSession.isRequestSecure({ headers: {} }) === false, 'header無し → secure ではない（localhost想定）');
    assert(webSession.isRequestSecure({ headers: { 'x-forwarded-proto': 'https,http' } }) === true, 'proxy chain先頭がhttps → secure判定');
  }

  // ══════════════════════════════════════════════════
  caseHeader('Route protection（#27-12〜15, 20, 35）');
  // ══════════════════════════════════════════════════
  {
    const h = makeHarness();
    h.seedDraft(FIXTURE_DRAFT); h.seedApproval(FIXTURE_DRAFT.case_id, FIXTURE_DRAFT.output_id, FIXTURE_APPROVAL);
    const app = makeFakeApp();
    routes.registerCarouselImageRoutes(app, h.deps);

    const approvalChain = app.registered['POST /api/carousel-image/approval'];
    const generateChain = app.registered['POST /api/carousel-image/generate'];
    const assetsChain = app.registered['GET /api/carousel-image/assets'];

    assert(approvalChain.length === 3 && generateChain.length === 3, 'wiring. POST 2route = session + origin + handler の3段');
    assert(assetsChain.length === 2, 'wiring. GET assets = session + handler の2段');

    // 12/13/14. session無し → 401
    {
      const a = makeReqRes({ origin: PROD_ORIGIN, body: { caseId: FIXTURE_DRAFT.case_id, outputId: FIXTURE_DRAFT.output_id, quality: 'medium' } });
      await runChain(approvalChain, a.req, a.res);
      assert(a.res._status === 401 && a.res._json.reason === 'unauthorized', '12. session無し → approval 401');

      const g = makeReqRes({ origin: PROD_ORIGIN, body: { approvalToken: 'v1.a.b', billingLock: false } });
      await runChain(generateChain, g.req, g.res);
      assert(g.res._status === 401 && g.res._json.reason === 'unauthorized', '13. session無し → generate 401');

      const s = makeReqRes({ query: { caseId: FIXTURE_DRAFT.case_id, outputId: FIXTURE_DRAFT.output_id } });
      await runChain(assetsChain, s.req, s.res);
      assert(s.res._status === 401 && s.res._json.reason === 'unauthorized', '14/35. session無し → GET assets も 401');
    }

    // 15. 有効session → routeへ到達（approval 200）
    {
      const a = makeReqRes({ cookieToken: validSessionToken(), origin: PROD_ORIGIN, body: { caseId: FIXTURE_DRAFT.case_id, outputId: FIXTURE_DRAFT.output_id, quality: 'medium' } });
      await runChain(approvalChain, a.req, a.res);
      assert(a.res._status === 200 && a.res._json.ok === true, '15. 有効な署名済みsession → routeへ到達できる');
    }

    // 16/17/18/19. 偽造・期限切れ・不正形式・別署名 → いずれも401（理由は返さない）
    const badTokens = [
      ['forged', 's1.' + Buffer.from(JSON.stringify({ v: 1, iat: FIXED_NOW, exp: FIXED_NOW + 999999 })).toString('base64url') + '.AAAA'],
      ['expired', webSession.issueSessionToken({ secret: TEST_SESSION_SECRET, now: FIXED_NOW - webSession.DEFAULT_TTL_MS - 10000 }).token],
      ['malformed', 'not-a-token'],
      ['wrong-secret', webSession.issueSessionToken({ secret: 'z'.repeat(32), now: FIXED_NOW }).token],
      ['approval-token-reuse', 'v1.abc.def'],
    ];
    for (const [label, tok] of badTokens) {
      const g = makeReqRes({ cookieToken: tok, origin: PROD_ORIGIN, body: { approvalToken: 'v1.a.b', billingLock: false } });
      await runChain(generateChain, g.req, g.res);
      assert(g.res._status === 401 && g.res._json.reason === 'unauthorized' && Object.keys(g.res._json).sort().join(',') === 'ok,reason',
        '16〜19. ' + label + ' session → 401 unauthorized（内部reasonを漏らさない）');
    }

    // 20. localStorage は server authority ではない（cookieが無ければ何を持っていても401）
    {
      const g = makeReqRes({ origin: PROD_ORIGIN, headers: { 'x-localstorage-enbisou-auth': 'true' }, body: { approvalToken: 'v1.a.b', billingLock: false } });
      await runChain(generateChain, g.req, g.res);
      assert(g.res._status === 401, '20. localStorage相当の主張（headerでの偽装含む）にserver権限はない');
      const src = fs.readFileSync(path.join(__dirname, 'lib', 'webSession.js'), 'utf8');
      assert(src.indexOf('enbisou_auth_v1') === -1, '20b. server側sessionはlocalStorageキーを一切参照しない');
    }
  }

  // ══════════════════════════════════════════════════
  caseHeader('CSRF / Origin（#27-29〜34）');
  // ══════════════════════════════════════════════════
  {
    const h = makeHarness();
    h.seedDraft(FIXTURE_DRAFT); h.seedApproval(FIXTURE_DRAFT.case_id, FIXTURE_DRAFT.output_id, FIXTURE_APPROVAL);
    const app = makeFakeApp();
    routes.registerCarouselImageRoutes(app, h.deps);
    const generateChain = app.registered['POST /api/carousel-image/generate'];
    const approvalChain = app.registered['POST /api/carousel-image/approval'];

    // 29. 正しいproduction Origin → 通過（handlerまで到達）
    {
      const a = makeReqRes({ cookieToken: validSessionToken(), origin: PROD_ORIGIN, body: { caseId: FIXTURE_DRAFT.case_id, outputId: FIXTURE_DRAFT.output_id, quality: 'medium' } });
      await runChain(approvalChain, a.req, a.res);
      assert(a.res._status === 200, '29. 許可Origin → 通過');
    }
    // 30. 他Origin → 403
    for (const bad of ['https://evil.example.com', 'http://ai-company.onrender.com', 'https://ai-company.onrender.com.evil.com']) {
      const g = makeReqRes({ cookieToken: validSessionToken(), origin: bad, body: { approvalToken: 'v1.a.b', billingLock: false } });
      await runChain(generateChain, g.req, g.res);
      assert(g.res._status === 403 && g.res._json.reason === 'forbidden_origin', '30. 不許可Origin → 403: ' + bad);
    }
    // 31. Origin欠落 → 403（fail-closed・無条件acceptしない）
    {
      const g = makeReqRes({ cookieToken: validSessionToken(), body: { approvalToken: 'v1.a.b', billingLock: false } });
      await runChain(generateChain, g.req, g.res);
      assert(g.res._status === 403 && g.res._json.reason === 'forbidden_origin', '31. Origin欠落 → 403（fail-closed）');
    }
    // 32. Referer fallback は採用しない（Refererだけでは通さない）
    {
      const g = makeReqRes({ cookieToken: validSessionToken(), headers: { referer: PROD_ORIGIN + '/index.html' }, body: { approvalToken: 'v1.a.b', billingLock: false } });
      await runChain(generateChain, g.req, g.res);
      assert(g.res._status === 403, '32. Referer のみでは通さない（Referer fallback不採用）');
    }
    // 33/34. localhost は「未設定環境」でのみ許可、設定済み環境では拒否
    {
      const devResolved = webSession.resolveTrustedOrigins({ PORT: '3000' });
      assert(devResolved.mode === 'development_fallback' && devResolved.origins.indexOf('http://localhost:3000') !== -1,
        '33. trusted origin未設定 → localhost のみ許可（development）');
      const prodResolved = webSession.resolveTrustedOrigins({ PORT: '3000', RENDER_EXTERNAL_URL: PROD_ORIGIN });
      assert(prodResolved.mode === 'configured' && prodResolved.origins.indexOf('http://localhost:3000') === -1,
        '34. trusted origin設定済み → localhost は許可されない（production）');
      const explicitResolved = webSession.resolveTrustedOrigins({ WEB_TRUSTED_ORIGIN: 'https://a.example, https://b.example' });
      assert(explicitResolved.origins.length === 2 && explicitResolved.mode === 'configured',
        '34b. WEB_TRUSTED_ORIGIN のカンマ区切り複数指定に対応');
      assert(webSession.resolveTrustedOrigins({ WEB_TRUSTED_ORIGIN: 'javascript:alert(1)' }).mode === 'development_fallback',
        '34c. http/https以外のスキームは trusted origin として採用しない');
    }
  }

  // ══════════════════════════════════════════════════
  caseHeader('Combined Safety（#27-36〜40）');
  // ══════════════════════════════════════════════════
  {
    // 36. session有効 + approval無効 → 生成なし
    await withRealEnabled(async () => {
      const h = makeHarness();
      h.seedDraft(FIXTURE_DRAFT); h.seedApproval(FIXTURE_DRAFT.case_id, FIXTURE_DRAFT.output_id, FIXTURE_APPROVAL);
      const app = makeFakeApp(); routes.registerCarouselImageRoutes(app, h.deps);
      const g = makeReqRes({ cookieToken: validSessionToken(), origin: PROD_ORIGIN, body: { approvalToken: 'v1.forged.sig', billingLock: false } });
      await runChain(app.registered['POST /api/carousel-image/generate'], g.req, g.res);
      assert(g.res._status !== 200 && h.counters.providerCalls === 0,
        '36. session有効でも approval token 無効なら生成されない（providerCalls=0）');
    });

    // 37. approval有効 + session無効 → 生成なし
    await withRealEnabled(async () => {
      const h = makeHarness();
      h.seedDraft(FIXTURE_DRAFT); h.seedApproval(FIXTURE_DRAFT.case_id, FIXTURE_DRAFT.output_id, FIXTURE_APPROVAL);
      const token = await issueApprovalToken(h);
      const app = makeFakeApp(); routes.registerCarouselImageRoutes(app, h.deps);
      const g = makeReqRes({ origin: PROD_ORIGIN, body: { approvalToken: token, billingLock: false } });
      await runChain(app.registered['POST /api/carousel-image/generate'], g.req, g.res);
      assert(g.res._status === 401 && h.counters.reserveCalls === 0 && h.counters.providerCalls === 0,
        '37. 有効なapproval tokenでも session が無ければ生成されない（reserve/provider=0）');
    });

    // 38. session有効 + billingLock=true → 生成なし
    await withRealEnabled(async () => {
      const h = makeHarness();
      h.seedDraft(FIXTURE_DRAFT); h.seedApproval(FIXTURE_DRAFT.case_id, FIXTURE_DRAFT.output_id, FIXTURE_APPROVAL);
      const token = await issueApprovalToken(h);
      const app = makeFakeApp(); routes.registerCarouselImageRoutes(app, h.deps);
      const g = makeReqRes({ cookieToken: validSessionToken(), origin: PROD_ORIGIN, body: { approvalToken: token, billingLock: true } });
      await runChain(app.registered['POST /api/carousel-image/generate'], g.req, g.res);
      assert(g.res._status === 403 && g.res._json.reason === 'billing_locked' && h.counters.providerCalls === 0,
        '38. session有効・approval有効でも billingLock=true なら生成されない');
    });

    // 39. session有効 + billingLock=false + approval有効 → fake generation 成功
    await withRealEnabled(async () => {
      const h = makeHarness();
      h.seedDraft(FIXTURE_DRAFT); h.seedApproval(FIXTURE_DRAFT.case_id, FIXTURE_DRAFT.output_id, FIXTURE_APPROVAL);
      const token = await issueApprovalToken(h);
      const app = makeFakeApp(); routes.registerCarouselImageRoutes(app, h.deps);
      const g = makeReqRes({ cookieToken: validSessionToken(), origin: PROD_ORIGIN, body: { approvalToken: token, billingLock: false } });
      await runChain(app.registered['POST /api/carousel-image/generate'], g.req, g.res);
      assert(g.res._status === 200 && g.res._json.ok === true && g.res._json.published === false,
        '39. session + billingLock=false + 有効approval → 生成成功・published=false維持');
      assert(h.counters.providerCalls === 7 && h.counters.metadataWrites === 1, '39b. provider 7回・metadata write 1回');
    });

    // 40. REAL_ENABLED=false のままなら、全条件が揃っていても実API側は開かない
    {
      const h = makeHarness();
      h.seedDraft(FIXTURE_DRAFT); h.seedApproval(FIXTURE_DRAFT.case_id, FIXTURE_DRAFT.output_id, FIXTURE_APPROVAL);
      const token = await issueApprovalToken(h);
      const app = makeFakeApp(); routes.registerCarouselImageRoutes(app, h.deps);
      const g = makeReqRes({ cookieToken: validSessionToken(), origin: PROD_ORIGIN, body: { approvalToken: token, billingLock: false } });
      await runChain(app.registered['POST /api/carousel-image/generate'], g.req, g.res);
      assert(g.res._status === 503 && g.res._json.reason === 'real_api_disabled' && h.counters.reserveCalls === 0,
        '40. REAL_ENABLED=false → 全条件充足でも real_api_disabled（reserve=0）');
    }
  }

  // ══════════════════════════════════════════════════
  caseHeader('server.js wiring（#27-10, 11, 28）');
  // ══════════════════════════════════════════════════
  {
    const src = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    assert(src.indexOf('_issueWebSessionCookie') !== -1 && src.indexOf("buildSetCookieHeader") !== -1,
      '10. /api/login 成功時に Set-Cookie を発行する配線が存在する');
    // 11. 失敗時にcookieを発行しない（401 return が cookie発行より前）
    const loginBlock = src.slice(src.indexOf("app.post('/api/login'"), src.indexOf("app.post('/api/logout'"));
    const failIdx = loginBlock.indexOf("'合言葉が違います'");
    const issueIdx = loginBlock.lastIndexOf('_issueWebSessionCookie');
    assert(failIdx !== -1 && issueIdx > failIdx, '11. password不一致は cookie発行前に return する（失敗時にsessionを出さない）');
    assert(src.indexOf("app.post('/api/logout'") !== -1 && src.indexOf('buildClearCookieHeader') !== -1,
      '28. POST /api/logout が cookie を失効させる');
    // index.html の logout が server logout を呼ぶ
    const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert(html.indexOf("fetch('/api/logout'") !== -1, '28b. index.html の logout() が /api/logout を呼ぶ');
    // secret がクライアントへ出ない
    assert(html.indexOf('WEB_SESSION_SECRET') === -1, '22b. index.html に WEB_SESSION_SECRET が出現しない');
    assert(src.indexOf('NEXT_PUBLIC_WEB_SESSION_SECRET') === -1, '22c. NEXT_PUBLIC_* 名でsecretを参照しない');
    const wsSrc = fs.readFileSync(path.join(__dirname, 'lib', 'webSession.js'), 'utf8');
    assert(wsSrc.indexOf('console.') === -1, 'ログ出力なし（secret/token をログに書かない）');
    assert(wsSrc.indexOf('timingSafeEqual') !== -1, '署名比較は timing-safe');
    // ※ コメント内での説明的言及は許容し、実コード参照（process.env.<name>）のみを検査する
    //   （carouselExecutionDb.test.js 14h/14i と同じ検査方針）。
    assert(wsSrc.indexOf('process.env.CAROUSEL_APPROVAL_SECRET') === -1
      && wsSrc.indexOf('process.env.WEB_SESSION_SECRET') !== -1,
      '21別. session は approval secret を実コードで参照せず、独立した WEB_SESSION_SECRET を使う');
    assert(webSession.SESSION_PREFIX !== 'v1',
      '21別b. session token の prefix は approval token（v1）と衝突しない: ' + webSession.SESSION_PREFIX);
  }

  // ══════════════════════════════════════════════════
  caseHeader('REAL_ENABLED / 非回帰');
  // ══════════════════════════════════════════════════
  {
    assert(client.REAL_ENABLED === false, 'REAL_ENABLED は false のまま（テスト後に復元されている）');
    const clientSrc = fs.readFileSync(path.join(__dirname, 'lib', 'carouselImageClient.js'), 'utf8');
    assert(clientSrc.indexOf('var _sourceRealEnabled = false;') !== -1, 'lib/carouselImageClient.js の source constant は false のまま（未変更）');
    // Production Activation Step PA-1: dual-key kill switch実装済み（source gate ∧ env gate）。
    //   本テストファイル自体は環境変数を汚染したまま終了していないことも確認する。
    assert(clientSrc.indexOf('CAROUSEL_IMAGE_REAL_ENABLED') !== -1, 'PA-1. kill switch（env gate）が実装されている');
    assert(client.isRealGenerationEnabled() === false, 'PA-1. dual-key不成立（source=false）のためisRealGenerationEnabled()もfalse');
    assert(process.env.CAROUSEL_IMAGE_REAL_ENABLED === undefined, 'PA-1. テスト終了後にCAROUSEL_IMAGE_REAL_ENABLEDがprocess.envへ残っていない');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All carouselAccessControl cases passed (Phase 2-E Step C-5-pre)'); }
})().catch(e => { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
