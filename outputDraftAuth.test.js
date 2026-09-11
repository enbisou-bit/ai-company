'use strict';
// outputDraftAuth.test.js
// Output Draft Authentication S2 — GET requireSession 化 / session 生存同期 /
// 401 と 200-empty の区別 / login 後再取得 の deterministic テスト。
//
//   実HTTP server listen 0件 / server.js 全体起動 0件 / 実Supabase DB read/write 0件 /
//   実AI API 0件 / Network 0 / DB migration 0。
//   HTTP 層は middleware を直接呼ぶ最小 harness、client 層は index.html の
//   source assertion ＋ 抽出した関数の単体実行で検証する。

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
const NOW = Date.now();   // ★ session TTL は実時刻判定のため固定日付にしない（翌日 expired を避ける）

const SERVER_SRC = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const INDEX_SRC = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

function fakeReqRes(cookieHeader) {
  const res = {
    _status: null, _json: null, _headers: {},
    status(s) { this._status = s; return this; },
    json(b) { this._json = b; return this; },
    setHeader(k, v) { this._headers[k] = v; },
  };
  const req = { headers: cookieHeader ? { cookie: cookieHeader } : {}, body: {}, query: {} };
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

// index.html から関数ソースを抜き出して単体実行できるようにする
function extractFn(name) {
  const re = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\([\\s\\S]*?\\n\\}', 'm');
  const m = INDEX_SRC.match(re);
  if (!m) throw new Error('function not found in index.html: ' + name);
  return m[0];
}

(async () => {
  console.log('\n=== outputDraftAuth.test.js (S2) ===');

  // ══════════════════════════════════════════════════════════════
  caseHeader('1. GET /api/output-drafts に requireSession が適用されている');
  {
    assert(/app\.get\('\/api\/output-drafts', require\('\.\/lib\/webSession'\)\.requireSession\(\)/.test(SERVER_SRC),
      '1a. GET /api/output-drafts に requireSession()');
    assert(/app\.post\('\/api\/output-drafts', require\('\.\/lib\/webSession'\)\.requireSession\(\)/.test(SERVER_SRC),
      '1b. POST の既存 requireSession は維持');
    const gi = SERVER_SRC.indexOf("app.get('/api/output-drafts'");
    const getRoute = SERVER_SRC.slice(gi, gi + 600);
    assert(getRoute.indexOf('requireTrustedOrigin') === -1,
      '1c. ★GET に requireTrustedOrigin を付けない（same-origin GET は Origin を送らないため）');
    assert(getRoute.indexOf('res.json({ ok: true, draft: result.draft, source: result.source })') !== -1,
      '1d. response shape は変更していない（{ok, draft, source}）');
  }

  caseHeader('2. GET /api/session-status（新規・read-only）');
  {
    assert(/app\.get\('\/api\/session-status', require\('\.\/lib\/webSession'\)\.requireSession\(\)/.test(SERVER_SRC),
      '2a. session-status に requireSession()');
    const si = SERVER_SRC.indexOf("app.get('/api/session-status'");
    const r = SERVER_SRC.slice(si, si + 260);
    assert(r.indexOf('res.json({ ok: true })') !== -1, '2b. 認証済みは { ok:true } のみ返す');
    ['getOutputDraftsDb', 'supabase', 'WEB_SESSION_SECRET'].forEach(function (k) {
      assert(r.indexOf(k) === -1, '2c. session-status は ' + k + ' に触れない（DB/secret 非依存）');
    });
  }

  caseHeader('3. 認証 middleware の実挙動（未認証 401 / 認証済み到達 / bypass なし）');
  {
    await withSessionSecret(TEST_SECRET, async () => {
      const mw = webSession.requireSession();
      const a = fakeReqRes(null);
      let nextA = false; mw(a.req, a.res, () => { nextA = true; });
      assert(a.res._status === 401 && !nextA, '3a. 未認証 → 401（route 到達なし）');
      assert(a.res._json && a.res._json.reason === 'unauthorized', '3b. 応答は unauthorized へ丸める');

      const issued = webSession.issueSessionToken({ secret: TEST_SECRET, now: NOW });
      const b = fakeReqRes(webSession.SESSION_COOKIE_NAME + '=' + issued.token);
      let nextB = false; mw(b.req, b.res, () => { nextB = true; });
      assert(nextB === true && b.res._status === null, '3c. 認証済み → route 到達（200 経路）');
    });
    await withSessionSecret(undefined, async () => {
      const mw = webSession.requireSession();
      const c = fakeReqRes(webSession.SESSION_COOKIE_NAME + '=s1.x.y');
      let nextC = false; mw(c.req, c.res, () => { nextC = true; });
      assert(c.res._status === 401 && !nextC, '3d. WEB_SESSION_SECRET 未設定 → 常に 401（bypass なし）');
    });
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('4. fetchLatestOutputDraftForCase: 401 と 200-empty を区別');
  {
    const src = extractFn('fetchLatestOutputDraftForCase');
    assert(src.indexOf('res.status === 401') !== -1 && src.indexOf("'unauthorized'") !== -1,
      '4a. 401 を unauthorized として返す');
    assert(src.indexOf("'empty'") !== -1 && src.indexOf("'ok'") !== -1,
      '4b. empty / ok を区別して返す');

    async function call(fetchImpl, caseId) {
      const fn = new Function('fetch', src + '; return fetchLatestOutputDraftForCase;')(fetchImpl);
      return fn(caseId);
    }
    const r401 = await call(async () => ({ status: 401, ok: false }), 'c1');
    assert(r401.status === 'unauthorized' && r401.draft === null, '4c. 401 → {status:unauthorized, draft:null}');

    const rEmpty = await call(async () => ({ status: 200, ok: true, json: async () => ({ ok: true, draft: null }) }), 'c1');
    assert(rEmpty.status === 'empty' && rEmpty.draft === null, '4d. 200+draft なし → {status:empty}');

    const rOk = await call(async () => ({ status: 200, ok: true, json: async () => ({ ok: true, draft: { output_id: 'o1' } }) }), 'c1');
    assert(rOk.status === 'ok' && rOk.draft && rOk.draft.output_id === 'o1', '4e. 200+draft → {status:ok, draft}');

    const rErr = await call(async () => { throw new Error('network'); }, 'c1');
    assert(rErr.status === 'error' && rErr.draft === null, '4f. network error → {status:error}（例外を投げない）');

    const rNoCase = await call(async () => ({ status: 200, ok: true, json: async () => ({}) }), null);
    assert(rNoCase.status === 'error', '4g. caseId なし → error（GET を発行しない）');
  }

  caseHeader('5. caseSwitch で 401 のとき表示中 Draft を消さない');
  {
    const src = extractFn('restoreOutputDraftFromServer');
    const unauthIdx = src.indexOf("fetched.status === 'unauthorized'");
    const clearIdx = src.indexOf('_lastOutputDraft = null');
    assert(unauthIdx !== -1, '5a. unauthorized を専用分岐で処理');
    assert(unauthIdx !== -1 && clearIdx !== -1 && unauthIdx < clearIdx,
      '5b. ★unauthorized 分岐が _lastOutputDraft = null より前（401 では消さずに return）');
    const unauthBlock = src.slice(unauthIdx, unauthIdx + 400);
    assert(unauthBlock.indexOf('_lastOutputDraft = null') === -1,
      '5c. unauthorized 分岐内で Draft を消していない');
    assert(unauthBlock.indexOf('handleSessionUnauthorized') !== -1,
      '5d. unauthorized 時は再認証処理へ委譲（silent failure にしない）');
    assert(/reason === 'caseSwitch' && fetched && fetched\.status === 'empty'/.test(src),
      '5e. ★caseSwitch の空戻しは status==="empty" のときだけ（従来動作を維持）');
    assert(src.indexOf("method: 'POST'") === -1,
      '5f. 復元経路から POST は発生しない');
  }

  caseHeader('6. initAuth: localStorage[AUTH_KEY] だけを認証根拠にしない');
  {
    const src = extractFn('initAuth');
    assert(src.indexOf('checkServerSession') !== -1, '6a. server session を検証している');
    const storedIdx = src.indexOf('localStorage.getItem(AUTH_KEY)');
    const checkIdx = src.indexOf('checkServerSession');
    const showIdx = src.lastIndexOf('showApp(true)');
    assert(storedIdx !== -1 && checkIdx > storedIdx && showIdx > checkIdx,
      '6b. ★AUTH_KEY 確認 → server session 確認 → showApp(true) の順');
    assert(/sess === 'unauthorized'[\s\S]{0,200}handleSessionUnauthorized/.test(src),
      '6c. unauthorized なら handleSessionUnauthorized（login へ）');
    assert(!/sess === 'unknown'[\s\S]{0,160}showLoginScreen/.test(src),
      '6d. ★unknown（5xx/network）を「合言葉間違い」扱いにしない＝表示は維持');
  }

  caseHeader('7. checkServerSession / handleSessionUnauthorized');
  {
    const cs = extractFn('checkServerSession');
    assert(cs.indexOf('/api/session-status') !== -1, '7a. session-status を参照');
    assert(/res\.status === 401[\s\S]{0,80}'unauthorized'/.test(cs), '7b. 401 → unauthorized');
    assert(/res\.ok[\s\S]{0,60}'valid'/.test(cs), '7c. 200 → valid');
    assert(cs.indexOf("return 'unknown'") !== -1, '7d. 5xx / network → unknown（判定保留）');

    const hu = extractFn('handleSessionUnauthorized');
    assert(hu.indexOf('localStorage.removeItem(AUTH_KEY)') !== -1,
      '7e. ★AUTH_KEY を認証根拠として使い続けない（削除）');
    assert(hu.indexOf('showLoginScreen') !== -1, '7f. login 画面へ誘導（silent failure 回避）');
    assert(hu.indexOf('_sessionUnauthorizedHandled') !== -1, '7g. 多重発火を抑止');
    assert(hu.indexOf('_lastOutputDraft') === -1, '7h. ★表示中 Draft を消さない');
  }

  caseHeader('8. login 成功後の再取得（1回だけ）');
  {
    const sub = extractFn('submitLogin');
    assert(sub.indexOf("scheduleOutputDraftRestore('login')") !== -1,
      '8a. ★login 成功後に Output Draft を再取得（従来は存在しなかった配線）');
    assert(sub.indexOf('_sessionUnauthorizedHandled = false') !== -1,
      '8b. 再ログインで期限切れ検知フラグをリセット');
    assert((sub.split("scheduleOutputDraftRestore('login')").length - 1) === 1,
      '8c. 呼出は1回だけ');
    assert(INDEX_SRC.indexOf('function scheduleOutputDraftRestore') !== -1
      && INDEX_SRC.indexOf('_outputDraftRestoreInFlight') !== -1,
      '8d. 既存 debounce / stale guard を再利用（新機構を作っていない）');
  }

  caseHeader('9. localStorage への Output Draft 新設なし / 既存契約不変');
  {
    const keys = (INDEX_SRC.match(/localStorage\.setItem\(([A-Za-z_]+|'[^']*')/g) || [])
      .map(function (x) { return x.replace('localStorage.setItem(', ''); });
    const uniq = Array.from(new Set(keys)).sort();
    assert(!uniq.some(function (k) { return /draft/i.test(k); }),
      '9a. ★Output Draft 用 localStorage キーを新設していない: ' + uniq.join(','));
    assert(INDEX_SRC.indexOf('function showLoginScreen') !== -1 && INDEX_SRC.indexOf('function showApp') !== -1,
      '9b. 既存 login 構造を保持');
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    assert(JSON.stringify(Object.keys(pkg.dependencies || {}).sort())
      === JSON.stringify(['@anthropic-ai/sdk', '@supabase/supabase-js', 'axios', 'dotenv', 'express', 'opentype.js', 'sharp']),
      '9c. package.json dependencies 変更なし');
    assert(fs.readFileSync(path.join(__dirname, 'lib', 'webSession.js'), 'utf8').indexOf('session-status') === -1,
      '9d. webSession.js は無変更（新 session module を作っていない）');
  }

  caseHeader('10. S3 スコープへ拡大していない（他 read API は今回閉じない）');
  {
    ['/api/cases', '/api/approvals', '/api/company-memory', '/api/knowledge-library',
      '/api/task-history', '/api/cost', '/api/affiliate-evaluations'].forEach(function (r) {
      const i = SERVER_SRC.indexOf("app.get('" + r + "'");
      if (i === -1) { assert(true, '10. ' + r + '（GET 定義なし）'); return; }
      const head = SERVER_SRC.slice(i, i + 160);
      assert(head.indexOf('requireSession') === -1, '10. ' + r + ' は今回変更していない（未認証のまま）');
    });
    const n = (SERVER_SRC.match(/requireSession\(\)/g) || []).length;
    assert(n === 3, '10z. requireSession 適用は 3 route のみ（session-status / GET / POST output-drafts）: ' + n);
  }

  caseHeader('11. Carousel / 既存境界 無変更');
  {
    const cr = fs.readFileSync(path.join(__dirname, 'lib', 'carouselImageRoutes.js'), 'utf8');
    assert(/app\.post\('\/api\/carousel-image\/approval', session, origin,/.test(cr)
      && /app\.get\('\/api\/carousel-image\/assets', session,/.test(cr),
      '11a. Carousel の session/origin 構成は不変');
    ['evaluateQualityGate', 'evaluateOutputPackageCompleteness', 'evaluateOutputQuality'].forEach(function (k) {
      assert(INDEX_SRC.indexOf('function ' + k) !== -1, '11b. ' + k + ' は存在（無変更）');
    });
    const pi = SERVER_SRC.indexOf("app.post('/api/output-drafts'");
    const post = SERVER_SRC.slice(pi, pi + 2500);
    assert(post.indexOf('resolveContentValueForSave') !== -1 && post.indexOf('updateContentValue') !== -1,
      '11c. CV-4b の server-side Content Value 配線は不変');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All outputDraftAuth cases passed (S2)'); }
})().catch(function (e) { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
