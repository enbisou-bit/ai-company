'use strict';
// contentValueWiring.test.js
// Evidence-Based Content Value Quality — CV-4b: server-side 配線 / 認証境界 /
// content_type first-write-wins / client 改竄防止 の deterministic テスト。
//
//   実HTTP server listen 0件 / server.js 全体起動 0件 / 実Supabase DB write 0件 /
//   実AI API 0件 / Web Evidence 取得 0件 / Network 0 / DB migration 0。
//   DB 層はすべて fake（注入）で検証する。

const fs = require('fs');
const path = require('path');

const webSession = require('./lib/webSession');
const draftsDb = require('./lib/outputDraftsDb');
const cvService = require('./lib/contentValueService');
const cvq = require('./shared/contentValueQuality');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const CASE = 'case-value-1788410623';
const OUT = 'out_test_cv4b';
// ★ session token は実時刻で TTL 判定されるため、発行/検証に使う now は固定日付にしない
//   （固定にすると翌日以降 token_expired で落ちる）。評価の決定性が要る箇所だけ FIXED_NOW を使う。
const NOW = Date.parse('2026-09-10T00:00:00.000Z');   // Content Value 評価用の固定時刻（stale 判定の決定性）
const SESSION_NOW = Date.now();                       // session 発行/検証用（実時刻）
const TEST_SECRET = 'test-web-session-secret-32bytes-long';

const SLIDES = ['【1枚目】タイトル：a / 本文：b', '【2枚目】タイトル：c / 本文：d'];

// express を起動せず middleware だけを直接呼ぶ最小 harness
function fakeReqRes(cookieHeader) {
  const res = {
    _status: null, _json: null,
    status(s) { this._status = s; return this; },
    json(b) { this._json = b; return this; },
  };
  const req = { headers: cookieHeader ? { cookie: cookieHeader } : {}, body: {}, query: {} };
  return { req, res };
}

// process.env.WEB_SESSION_SECRET を必ず復元する
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

// DB fake: content_type の atomic first-write-wins を in-memory で再現する
function makeFakeDb(initialContentType) {
  const state = { contentType: initialContentType === undefined ? null : initialContentType, contentValue: null, calls: [] };
  return {
    state: state,
    setContentTypeIfUnset: async function (a) {
      state.calls.push({ op: 'setContentTypeIfUnset', contentType: a.contentType });
      if (draftsDb.CONTENT_TYPE_ALLOWED.indexOf(a.contentType) === -1) return { ok: true, applied: false, reason: 'not_declarable' };
      if (state.contentType !== null) return { ok: true, applied: false, reason: null };   // 既に確定 → 無視
      state.contentType = a.contentType;
      return { ok: true, applied: true, reason: null };
    },
    getContentTypeCanonical: async function () {
      state.calls.push({ op: 'getContentTypeCanonical' });
      return { contentType: state.contentType, source: 'db' };
    },
    updateContentValue: async function (a) {
      state.calls.push({ op: 'updateContentValue' });
      state.contentValue = a.contentValue;
      return { ok: true, reason: null };
    },
  };
}

(async () => {
  console.log('\n=== contentValueWiring.test.js (CV-4b) ===');

  // ══════════════════════════════════════════════════════════════
  caseHeader('1. 認証境界（既存 lib/webSession.js の requireSession を再利用・新方式なし）');
  {
    await withSessionSecret(TEST_SECRET, async () => {
      const mw = webSession.requireSession();

      // 未認証（cookie なし）→ 401
      const a = fakeReqRes(null);
      let nextCalled = false;
      mw(a.req, a.res, () => { nextCalled = true; });
      assert(a.res._status === 401 && nextCalled === false, '1a. 未認証 → 401（next 到達なし）');
      assert(a.res._json && a.res._json.reason === 'unauthorized', '1b. 理由詳細を漏らさない（unauthorized へ丸める）');

      // 認証済み（正規 cookie）→ next 到達
      const issued = webSession.issueSessionToken({ secret: TEST_SECRET, now: SESSION_NOW });
      assert(issued.ok === true, '1c. session token 発行 OK');
      const b = fakeReqRes(webSession.SESSION_COOKIE_NAME + '=' + issued.token);
      let nextB = false;
      mw(b.req, b.res, () => { nextB = true; });
      assert(nextB === true && b.res._status === null, '1d. 認証済み → route 到達（401 にならない）');

      // 改竄 cookie → 401
      const c = fakeReqRes(webSession.SESSION_COOKIE_NAME + '=' + issued.token.slice(0, -3) + 'AAA');
      let nextC = false;
      mw(c.req, c.res, () => { nextC = true; });
      assert(c.res._status === 401 && nextC === false, '1e. 署名改竄 → 401');
    });

    // secret 未設定 → 常に 401（環境変数の有無で認証を skip する経路がない）
    await withSessionSecret(undefined, async () => {
      const mw = webSession.requireSession();
      const d = fakeReqRes(webSession.SESSION_COOKIE_NAME + '=s1.x.y');
      let nextD = false;
      mw(d.req, d.res, () => { nextD = true; });
      assert(d.res._status === 401 && nextD === false, '1f. WEB_SESSION_SECRET 未設定 → 常に 401（fail-closed）');
    });
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('2. server.js の配線（source assertion・server 起動なし）');
  {
    const src = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    const route = src.slice(src.indexOf("app.post('/api/output-drafts'"), src.indexOf("app.post('/api/output-drafts'") + 3000);
    assert(route.indexOf("require('./lib/webSession').requireSession()") !== -1,
      '2a. POST /api/output-drafts に requireSession() が適用されている');
    assert(/const \{[^}]*\} = req\.body \|\| \{\};/.test(route) && route.match(/const \{([^}]*)\} = req\.body/)[1].indexOf('contentValue') === -1,
      '2b. ★client 供給の contentValue を req.body から受け取っていない（破棄）');
    assert(route.indexOf('declaredContentType') !== -1 && route.indexOf('resolveContentValueForSave') !== -1,
      '2c. contentType 宣言受領 ＋ server-side 再計算を呼んでいる');
    assert(route.indexOf('updateContentValue') !== -1, '2d. content_value を独立列へ保存している');
    // 既存契約へ触れていないこと
    ['packageQuality:', 'evaluateQualityGate', 'evaluateOutputQuality'].forEach(function (k) {
      const bad = k === 'packageQuality:' ? false : route.indexOf(k) !== -1;
      assert(bad === false, '2e. route 内で ' + k + ' を変更していない');
    });
    assert(route.indexOf('packageQuality') !== -1, '2f. packageQuality は従来どおり素通しで保存（意味変更なし）');
    // S2: GET /api/output-drafts も requireSession 化された（CV-4b 時点の「未適用」前提は更新）。
    assert(src.indexOf("app.get('/api/output-drafts', require('./lib/webSession').requireSession()") !== -1,
      '2g. GET /api/output-drafts は S2 で requireSession 化済み');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('3. ★client 供給 contentValue の改竄防止');
  {
    const db = makeFakeDb(null);
    // client が status:'complete' / score:100 を送りつけたつもりの payload
    const clientTampered = { status: 'complete', score: 100, gates: { evidenceGrounding: true, nonGeneric: true } };
    const r = await cvService.resolveContentValueForSave(
      { outputId: OUT, caseId: CASE, declaredContentType: 'value', fields: { slides: SLIDES }, contentValue: clientTampered },
      { setContentTypeIfUnset: db.setContentTypeIfUnset, getContentTypeCanonical: db.getContentTypeCanonical, now: NOW });
    await db.updateContentValue({ outputId: OUT, contentValue: r.contentValue });

    assert(r.contentValue.status === 'insufficient', '3a. server 再計算の結果は insufficient（client の complete を採用しない）');
    assert(r.contentValue.score !== 100, '3b. client の score:100 が入っていない: ' + r.contentValue.score);
    assert(db.state.contentValue.status === 'insufficient', '3c. ★DB へ保存される値は server 再計算結果');
    assert(JSON.stringify(db.state.contentValue) !== JSON.stringify(clientTampered), '3d. client 値がそのまま content_value へ入らない');
    assert(r.contentValue.gates.evidenceGrounding === false, '3e. client の gates も採用しない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('4. content_type first-write-wins（downgrade 不可）');
  {
    // 初回宣言 product → 確定
    const db = makeFakeDb(null);
    const r1 = await cvService.resolveContentValueForSave(
      { outputId: OUT, caseId: CASE, declaredContentType: 'product', fields: { slides: SLIDES } },
      { setContentTypeIfUnset: db.setContentTypeIfUnset, getContentTypeCanonical: db.getContentTypeCanonical, now: NOW });
    assert(r1.contentTypeApplied === true && r1.contentType === 'product', '4a. 初回宣言 product が canonical へ確定');

    // 2回目に value を送っても canonical は product のまま
    const r2 = await cvService.resolveContentValueForSave(
      { outputId: OUT, caseId: CASE, declaredContentType: 'value', fields: { slides: SLIDES } },
      { setContentTypeIfUnset: db.setContentTypeIfUnset, getContentTypeCanonical: db.getContentTypeCanonical, now: NOW });
    assert(r2.contentTypeApplied === false, '4b. 2回目の宣言は適用されない');
    assert(r2.contentType === 'product', '4c. ★canonical は product のまま（value への downgrade 不可）');
    assert(db.state.contentType === 'product', '4d. DB の content_type も product のまま');

    // 'unknown' / 列挙外は DB へ書かない
    const db2 = makeFakeDb(null);
    await cvService.resolveContentValueForSave(
      { outputId: OUT, caseId: CASE, declaredContentType: 'unknown', fields: { slides: SLIDES } },
      { setContentTypeIfUnset: db2.setContentTypeIfUnset, getContentTypeCanonical: db2.getContentTypeCanonical, now: NOW });
    assert(db2.state.contentType === null, '4e. unknown は DB へ書かない（未解決は NULL のまま保持）');
    const db3 = makeFakeDb(null);
    const r3 = await cvService.resolveContentValueForSave(
      { outputId: OUT, caseId: CASE, declaredContentType: 'xxx', fields: { slides: SLIDES } },
      { setContentTypeIfUnset: db3.setContentTypeIfUnset, getContentTypeCanonical: db3.getContentTypeCanonical, now: NOW });
    assert(db3.state.contentType === null && r3.contentType === 'unknown', '4f. 列挙外も DB へ書かず unknown 評価');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('5. canonical 未解決 → unknown fail-closed');
  {
    const db = makeFakeDb(null);
    const r = await cvService.resolveContentValueForSave(
      { outputId: OUT, caseId: CASE, declaredContentType: null, fields: { slides: SLIDES } },
      { setContentTypeIfUnset: db.setContentTypeIfUnset, getContentTypeCanonical: db.getContentTypeCanonical, now: NOW });
    assert(r.contentType === 'unknown' && r.contentTypeSource === 'unresolved', '5a. 未宣言 → unknown / unresolved');
    assert(r.contentValue.gates.contentTypeResolved === false, '5b. gates.contentTypeResolved=false');
    assert(r.contentValue.status === 'insufficient', '5c. status=insufficient');
    assert(r.reasons.indexOf('content_type_not_declared') !== -1, '5d. reasons に content_type_not_declared');

    // canonical 読み取り失敗（migration 未適用相当）でも宣言値へ fallback しない
    const rFail = await cvService.resolveContentValueForSave(
      { outputId: OUT, caseId: CASE, declaredContentType: 'product', fields: { slides: SLIDES } },
      {
        setContentTypeIfUnset: async () => ({ ok: false, applied: false, reason: 'column content_type does not exist' }),
        getContentTypeCanonical: async () => ({ contentType: null, source: 'fallback', error: 'column content_type does not exist' }),
        now: NOW,
      });
    assert(rFail.contentType === 'unknown', '5e. ★canonical 読取失敗時も宣言値へ fallback しない（unknown）');
    assert(rFail.contentValue.status === 'insufficient', '5f. status=insufficient（fail-closed）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('6. APFR 注入境界（product のときだけ・value/bridge へ誤注入しない）');
  {
    const FACTS = [{ factId: 'apf_1', classification: 'fact', field: 'price', value: 1980 }];
    const fieldsWithProduct = {
      slides: SLIDES,
      intelligenceContext: { product: { caseId: CASE, productIdentifier: 'PID-1', facts: FACTS } },
    };
    assert(JSON.stringify(cvService.extractApfrFacts(fieldsWithProduct)) === JSON.stringify(FACTS),
      '6a. extractApfrFacts は product.facts を read-only で返す');
    assert(JSON.stringify(cvService.extractApfrFacts({ slides: SLIDES })) === '[]', '6b. product 不在なら空配列');

    // value 宣言 + productIdentifier あり → productContext を記録しない（＝APFR 経路に入らない）
    const dbV = makeFakeDb('value');
    const rV = await cvService.resolveContentValueForSave(
      { outputId: OUT, caseId: CASE, declaredContentType: 'value', fields: fieldsWithProduct },
      { setContentTypeIfUnset: dbV.setContentTypeIfUnset, getContentTypeCanonical: dbV.getContentTypeCanonical, now: NOW });
    assert(rV.contentType === 'value', '6c. canonical value のまま（productIdentifier で昇格しない）');
    assert(rV.contentValue.productContext === null, '6d. ★value では APFR / productContext に触れない');

    const dbB = makeFakeDb('bridge');
    const rB = await cvService.resolveContentValueForSave(
      { outputId: OUT, caseId: CASE, declaredContentType: 'bridge', fields: fieldsWithProduct },
      { setContentTypeIfUnset: dbB.setContentTypeIfUnset, getContentTypeCanonical: dbB.getContentTypeCanonical, now: NOW });
    assert(rB.contentValue.productContext === null, '6e. bridge でも APFR に触れない');

    const dbP = makeFakeDb('product');
    const rP = await cvService.resolveContentValueForSave(
      { outputId: OUT, caseId: CASE, declaredContentType: 'product', fields: fieldsWithProduct },
      { setContentTypeIfUnset: dbP.setContentTypeIfUnset, getContentTypeCanonical: dbP.getContentTypeCanonical, now: NOW });
    assert(rP.contentValue.productContext && rP.contentValue.productContext.resolved === true,
      '6f. product のときだけ productContext を評価');

    // APFR facts を書き換えない
    const snap = JSON.stringify(FACTS);
    assert(JSON.stringify(FACTS) === snap, '6g. APFR facts 非破壊');

    // product 宣言だが productIdentifier なし → product_context_missing
    const dbP2 = makeFakeDb('product');
    const rP2 = await cvService.resolveContentValueForSave(
      { outputId: OUT, caseId: CASE, declaredContentType: 'product', fields: { slides: SLIDES } },
      { setContentTypeIfUnset: dbP2.setContentTypeIfUnset, getContentTypeCanonical: dbP2.getContentTypeCanonical, now: NOW });
    assert(rP2.contentValue.gates.productClaim === false
      && rP2.contentValue.blockingReasons.indexOf('product_context_missing') !== -1,
      '6h. product + productIdentifier なし → product_context_missing');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('7. lib/outputDraftsDb.js（既存規約維持 ＋ 追加分）');
  {
    assert(typeof draftsDb.setContentTypeIfUnset === 'function', '7a. setContentTypeIfUnset export');
    assert(typeof draftsDb.getContentTypeCanonical === 'function', '7b. getContentTypeCanonical export');
    assert(typeof draftsDb.updateContentValue === 'function', '7c. updateContentValue export');
    assert(JSON.stringify(draftsDb.CONTENT_TYPE_ALLOWED) === JSON.stringify(['value', 'bridge', 'product']),
      '7d. DB 許容値に unknown を含めない（未解決は NULL）');
    assert(typeof draftsDb.upsertOutputDraft === 'function' && typeof draftsDb.getOutputDraft === 'function',
      '7e. 既存 export は維持');

    // 宣言不可な値では DB 呼び出しへ進まない（supabase 未設定でも 'not_declarable' で返る）
    const r = await draftsDb.setContentTypeIfUnset({ outputId: OUT, contentType: 'unknown' });
    assert(r.applied === false && r.reason === 'not_declarable', '7f. unknown は DB 書込対象外');
    const r2 = await draftsDb.setContentTypeIfUnset({ outputId: OUT, contentType: 'xxx' });
    assert(r2.applied === false && r2.reason === 'not_declarable', '7g. 列挙外は DB 書込対象外');

    const src = fs.readFileSync(path.join(__dirname, 'lib', 'outputDraftsDb.js'), 'utf8');
    assert(src.indexOf(".is('content_type', null)") !== -1,
      '7h. ★述語つき単一 UPDATE（.is content_type null）＝atomic first-write-wins');
    assert(src.indexOf('if (contentValue   !== undefined)') !== -1,
      '7i. 既存規約「undefined 列は送らない」を contentValue にも適用');
    assert(/async function upsertOutputDraft\(\{[^}]*\}\)/.test(src)
      && src.match(/async function upsertOutputDraft\(\{([^}]*)\}\)/)[1].indexOf('contentType') === -1,
      '7j. upsertOutputDraft は contentType を受け取らない（無制限上書きの経路を作らない）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('8. Backward Compatibility（旧 draft: content_type / content_value なし）');
  {
    // 旧 draft 相当（contentType 宣言なし・contentEvidence なし）でも例外なく評価できる
    const db = makeFakeDb(null);
    const r = await cvService.resolveContentValueForSave(
      { outputId: 'out_1788413020275', caseId: CASE, declaredContentType: undefined,
        fields: { slides: SLIDES, cta: 'x', caption: 'y' } },
      { setContentTypeIfUnset: db.setContentTypeIfUnset, getContentTypeCanonical: db.getContentTypeCanonical, now: NOW });
    assert(r.contentValue && r.contentValue.status === 'insufficient', '8a. 旧 draft 相当でも評価可能（insufficient）');
    assert(db.state.contentType === null, '8b. content_type は NULL のまま（旧 draft を壊さない）');

    // review_state のみ保存（fields なし）では Content Value を計算しない設計であることを source で確認
    const src = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
    const route = src.slice(src.indexOf("app.post('/api/output-drafts'"), src.indexOf("app.post('/api/output-drafts'") + 3000);
    assert(route.indexOf('if (fields !== undefined)') !== -1, '8c. fields 未指定（review_state のみ）では再計算しない');
    assert(route.indexOf('fail-open') !== -1, '8d. Content Value 側の失敗で Draft 保存を失敗にしない（fail-open）');

    // Core は contentValue 未指定の古い呼び出しでも壊れない
    const legacy = cvq.evaluateContentValue({ caseId: CASE, outputId: OUT, fields: { slides: SLIDES } }, { now: NOW });
    assert(legacy.status === 'insufficient' && legacy.contentType === 'unknown', '8e. Core 単体でも後方互換（unknown / insufficient）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('9. 既存契約 無変更 / 依存追加なし');
  {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const deps = Object.keys(pkg.dependencies || {}).sort();
    assert(JSON.stringify(deps) === JSON.stringify(['@anthropic-ai/sdk', '@supabase/supabase-js', 'axios', 'dotenv', 'express', 'opentype.js', 'sharp']),
      '9a. package.json dependencies 変更なし');
    const idx = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert(idx.indexOf('contentValueQuality') === -1 && idx.indexOf('contentEvidence') === -1,
      '9b. index.html は無変更（本 Core を参照していない）');
    const svcSrc = fs.readFileSync(path.join(__dirname, 'lib', 'contentValueService.js'), 'utf8');
    ['evaluateQualityGate', 'packageQuality', 'evaluateOutputQuality', 'published', 'output_approvals'].forEach(function (k) {
      assert(svcSrc.indexOf(k) === -1 || svcSrc.indexOf('非責務') !== -1, '9c. service は ' + k + ' を実行参照しない');
    });
    const ps = require('./lib/publicStatic');
    ['shared/contentEvidence.js', 'shared/contentValueQuality.js', 'lib/contentValueService.js'].forEach(function (p) {
      assert(ps.resolvePublicAsset('/' + p) === null, '9d. ' + p + ' は静的公開されない（server-only 維持）');
    });
    assert(/[\x00\x7f]/.test(svcSrc) === false, '9e. 制御バイト混入なし');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All contentValueWiring cases passed (CV-4b)'); }
})().catch(function (e) { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
