'use strict';
// carouselImageProduceRoute.test.js
// Stage 1a: GET /api/carousel-image/quote ＋ POST /api/carousel-image/produce ＋ Output Engine UI の
//   deterministic テスト。
//
//   実HTTP 0 / 実AI API 0 / 実Image API 0 / 実DB 0 / 実Storage 0 / 実課金 0。
//   provider・storage・execution ledger はすべて fake 注入で検証する（本番APIは一切呼ばない）。
//   REAL_ENABLED は本テストプロセス内の env でのみ true にし、fake provider だけが呼ばれる。

process.env.CAROUSEL_IMAGE_REAL_ENABLED = 'true';   // fake provider を通すため（実APIには到達しない）

const fs = require('fs');
const path = require('path');
const vm = require('vm');
const service = require('./lib/carouselImageService');
const routes = require('./lib/carouselImageRoutes');
const core = require('./shared/carouselImageCore');
const client = require('./lib/carouselImageClient');
const webSession = require('./lib/webSession');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

// ══════════════════════════════════════════════════════════════
// fixtures
// ══════════════════════════════════════════════════════════════
const CASE_ID = 'case-value-1788410623';
const OUTPUT_ID = 'out_1789809676034';
const SECRET = 'test-carousel-approval-secret-0123456789';

function mkSlide(n) {
  return '【' + n + '枚目】タイトル：見出し' + n + ' / 本文：本文' + n + ' / ビジュアル：自然光のやわらかい背景';
}
function baseDraft(over) {
  return Object.assign({
    output_id: OUTPUT_ID,
    case_id: CASE_ID,
    type: 'instagram_carousel',
    status: 'ready',
    built_at: '2026-09-19T09:22:09.014+00:00',
    updated_at: '2026-09-20T13:01:10.000+00:00',
    fields: {
      slides: [1, 2, 3, 4, 5, 6, 7].map(mkSlide),
      imagePrompts: [1, 2, 3, 4, 5, 6, 7].map(function (n) { return 'prompt ' + n; }),
      cta: 'あとで見返せるように保存してください',
      caption: 'caption',
      hashtags: ['#a'],
    },
  }, over || {});
}
function baseApproval(over) {
  return Object.assign({
    case_id: CASE_ID, output_id: OUTPUT_ID,
    approval_decision: 'approved', review_status: 'approved',
    published: false, published_at: null, archived: false,
  }, over || {});
}

// fake deps（provider / storage / ledger をすべて注入。実I/Oなし）
function makeHarness(opts) {
  opts = opts || {};
  const st = {
    draft: opts.draft || baseDraft(),
    approval: opts.approval === undefined ? baseApproval() : opts.approval,
    ledger: opts.ledger ? opts.ledger.slice() : [],
    providerCalls: 0,
    uploads: 0,
    draftReads: 0,
    metadataWrites: 0,
  };
  const deps = {
    loadOutputDraft: async function (scope) {
      st.draftReads++;
      // opts.mutateOnRead: N 回目の読み取りから updated_at を変える（stale 再現）
      if (opts.mutateOnRead && st.draftReads >= opts.mutateOnRead) {
        return Object.assign({}, st.draft, { updated_at: '2026-09-21T00:00:00.000+00:00' });
      }
      if (scope.caseId !== st.draft.case_id || scope.outputId !== st.draft.output_id) return null;
      return st.draft;
    },
    loadApproval: async function () { return st.approval; },
    getCumulativeSpentJpyByOutputId: async function () {
      if (opts.budgetReadFails) return { ok: false, reason: 'budget_read_unavailable' };
      let sum = 0;
      st.ledger.forEach(function (r) {
        if (r.status === 'failed_before_charge') return;
        if (r.status === 'in_progress') { sum += Number(r.estimated_total_cost_jpy || 0); return; }
        sum += Number(r.spent_estimated_jpy || 0);
      });
      return { ok: true, cumulativeJpy: sum, rowCount: st.ledger.length };
    },
    approvalSecret: opts.approvalSecret === undefined ? SECRET : opts.approvalSecret,
    budgetJpyPerPost: undefined,
    approvalTtlMs: undefined,
    now: function () { return Date.now(); },
    checkCostLimit: function () { return opts.costLimitStopped ? false : true; },
    provider: async function () {
      st.providerCalls++;
      if (opts.providerFailAt && st.providerCalls === opts.providerFailAt) return { ok: false, reason: 'provider_failed' };
      return {
        ok: true, buffer: Buffer.from('fake-bg'),
        usage: { textInputTokens: 300, imageInputTokens: 0, outputTokens: 181, totalTokens: 481, completeness: 'complete' },
      };
    },
    normalize: async function (x) { return { ok: true, buffer: x.buffer }; },
    composite: async function () { return { ok: true, buffer: Buffer.from('89504e470d0a1a0a', 'hex') }; },
    executionStore: {
      reserve: async function (p) {
        if (st.ledger.some(function (r) { return r.nonce === p.nonce; })) return { ok: false, reason: 'nonce_reused' };
        if (st.ledger.some(function (r) { return r.output_id === p.outputId && (r.status === 'in_progress' || r.status === 'completed'); })) {
          return { ok: false, reason: 'post_execution_in_progress' };
        }
        st.ledger.push({ nonce: p.nonce, output_id: p.outputId, status: 'in_progress', estimated_total_cost_jpy: p.estimatedTotalCostJpy, spent_estimated_jpy: 0 });
        return { ok: true };
      },
      complete: async function (p) {
        const r = st.ledger.find(function (x) { return x.nonce === p.nonce; });
        if (r) Object.assign(r, { status: 'completed', spent_estimated_jpy: p.spentEstimatedJpy, attempted: p.attemptedProviderCalls, successful: p.successfulProviderCalls });
        return { ok: true };
      },
      fail: async function (p) {
        const r = st.ledger.find(function (x) { return x.nonce === p.nonce; });
        if (r) Object.assign(r, { status: p.status, spent_estimated_jpy: p.spentEstimatedJpy, attempted: p.attemptedProviderCalls, successful: p.successfulProviderCalls });
        return { ok: true };
      },
    },
    uploadCarouselAssets: async function (items) {
      st.uploads++;
      return {
        ok: true,
        assets: items.map(function (i) {
          return {
            slideIndex: i.slideIndex, slideId: i.slideId, width: 1080, height: 1350, aspectRatio: '4:5',
            format: 'png', storagePath: 'carousel/' + i.caseId + '/' + i.outputId + '/' + i.nonce + '/slide-' + i.slideIndex + '.png',
            sha256: 'a'.repeat(64), bytes: 1234,
          };
        }),
      };
    },
    createSignedUrl: async function (p) { return { ok: true, url: 'https://signed.example/' + p, expiresIn: 300 }; },
    saveOutputDraftAssets: async function (x) {
      st.metadataWrites++;
      st.draft = Object.assign({}, st.draft, { fields: x.fields });
      return { ok: true };
    },
    storageClient: {}, signedUrlExpiresIn: 300,
  };
  return { st: st, deps: deps };
}

const EXPECTED_LOW_7 = client.estimateAuthorizedTotalJpy('low', 7);

(async () => {
  console.log('\n=== carouselImageProduceRoute.test.js (Stage 1a) ===');

  // ══════════════════════════════════════════════════════════════
  caseHeader('1. quote 正常（課金 0・token 発行 0）');
  {
    const h = makeHarness();
    const res = await service.handleQuoteRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low' }, h.deps);
    assert(res.status === 200 && res.body.ok === true, '1a. HTTP 200 / ok:true');
    assert(res.body.eligible === true && res.body.reason === null, '1b. eligible:true');
    assert(res.body.slideCount === 7 && res.body.quality === 'low', '1c. slideCount / quality が server 由来');
    assert(Math.abs(res.body.estimatedTotalCostJpy - EXPECTED_LOW_7) < 1e-9, '1d. estimatedTotalCostJpy が既存見積り関数と一致（' + EXPECTED_LOW_7.toFixed(4) + '）');
    assert(res.body.cumulativeSpentJpy === 0 && res.body.budgetJpyPerPost === core.BUDGET_JPY_PER_POST_DEFAULT, '1e. cumulative / budget を返す');
    assert(res.body.approved === true && res.body.published === false && res.body.assetsReady === false, '1f. approved / published / assetsReady');
    assert(JSON.stringify(res.body).indexOf('approvalToken') === -1, '1g. ★ quote は approvalToken を返さない');
    assert(h.st.providerCalls === 0 && h.st.ledger.length === 0 && h.st.uploads === 0 && h.st.metadataWrites === 0, '1h. provider 0 / ledger write 0 / storage 0 / DB write 0');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('2〜5. quote の ineligible 判定（既存語彙をそのまま伝える）');
  {
    const notAppr = makeHarness({ approval: baseApproval({ approval_decision: 'rejected' }) });
    const r2 = await service.handleQuoteRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low' }, notAppr.deps);
    assert(r2.status === 200 && r2.body.eligible === false && r2.body.reason === 'not_approved', '2. 未承認 → eligible:false / not_approved');
    assert(notAppr.st.providerCalls === 0, '2b. provider 0');

    const noAppr = makeHarness({ approval: null });
    const r2c = await service.handleQuoteRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low' }, noAppr.deps);
    assert(r2c.body.eligible === false && r2c.body.reason === 'no_approval', '2c. 承認行なし → no_approval');

    const pub = makeHarness({ approval: baseApproval({ published: true, published_at: '2026-09-21T00:00:00Z' }) });
    const r3 = await service.handleQuoteRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low' }, pub.deps);
    assert(r3.status === 200 && r3.body.eligible === false && r3.body.reason === 'already_published', '3. published=true → already_published');
    assert(r3.body.published === true, '3b. published:true を返す');

    const withAssets = baseDraft();
    withAssets.fields = Object.assign({}, withAssets.fields, { carouselAssets: [{ slideIndex: 1 }] });
    const ga = makeHarness({ draft: withAssets });
    const r4 = await service.handleQuoteRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low' }, ga.deps);
    assert(r4.status === 200 && r4.body.eligible === false && r4.body.reason === 'already_generated', '4. assets あり → already_generated');
    assert(r4.body.assetsReady === true, '4b. assetsReady:true');

    // ledger に active 行（in_progress）＝ cumulative が満額計上され、2件目で認可上限を超える
    const led = makeHarness({ ledger: [{ nonce: 'prior', output_id: OUTPUT_ID, status: 'in_progress', estimated_total_cost_jpy: 60 }] });
    const r5 = await service.handleQuoteRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low' }, led.deps);
    assert(r5.status === 200 && r5.body.eligible === false && r5.body.reason === 'budget_exceeded', '5. ledger active → budget_exceeded');
    assert(r5.body.cumulativeSpentJpy === 60, '5b. cumulativeSpentJpy が ledger 由来');

    const completed = makeHarness({ ledger: [{ nonce: 'p2', output_id: OUTPUT_ID, status: 'completed', spent_estimated_jpy: EXPECTED_LOW_7 }] });
    const r5c = await service.handleQuoteRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low' }, completed.deps);
    assert(r5c.body.cumulativeSpentJpy === EXPECTED_LOW_7, '5c. completed 行も cumulative に算入');

    const bad = makeHarness();
    const rq = await service.handleQuoteRequest({ caseId: CASE_ID, outputId: OUTPUT_ID }, bad.deps);
    assert(rq.status === 400 && rq.body.reason === 'missing_quality', '5d. quality 未指定 → 400 missing_quality（既存語彙）');
    const rq2 = await service.handleQuoteRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'ultra' }, bad.deps);
    assert(rq2.status === 400 && rq2.body.reason === 'invalid_quality', '5e. quality 列挙外 → 400 invalid_quality');
    const rq3 = await service.handleQuoteRequest({ caseId: 'case-other', outputId: OUTPUT_ID, quality: 'low' }, bad.deps);
    assert(rq3.status === 404 && rq3.body.reason === 'not_found', '5f. 別 case → 404 not_found');
    const rq4 = await service.handleQuoteRequest({ outputId: OUTPUT_ID, quality: 'low' }, bad.deps);
    assert(rq4.status === 400 && rq4.body.reason === 'invalid_request', '5g. caseId 欠落 → 400 invalid_request');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('6〜7. Security Boundary（session / trusted origin）は既存3routeと同一');
  {
    const registered = [];
    const fakeApp = {
      get: function (p) { registered.push({ method: 'GET', path: p, mw: Array.prototype.slice.call(arguments, 1) }); },
      post: function (p) { registered.push({ method: 'POST', path: p, mw: Array.prototype.slice.call(arguments, 1) }); },
    };
    routes.registerCarouselImageRoutes(fakeApp, { sessionOptions: { secret: 'x'.repeat(20) }, originOptions: { trustedOrigins: ['https://example.test'] } });
    const byPath = {};
    registered.forEach(function (r) { byPath[r.method + ' ' + r.path] = r; });
    assert(!!byPath['GET /api/carousel-image/quote'], '6a. GET /quote が登録される');
    assert(!!byPath['POST /api/carousel-image/produce'], '6b. POST /produce が登録される');
    assert(byPath['GET /api/carousel-image/quote'].mw.length === byPath['GET /api/carousel-image/assets'].mw.length,
      '6c. quote の middleware 数が既存 GET assets と同一（session のみ）');
    assert(byPath['POST /api/carousel-image/produce'].mw.length === byPath['POST /api/carousel-image/generate'].mw.length,
      '7a. produce の middleware 数が既存 POST generate と同一（session → Origin）');
    assert(byPath['POST /api/carousel-image/approval'].mw.length === 3 && byPath['POST /api/carousel-image/produce'].mw.length === 3,
      '7b. POST 2route はいずれも session + Origin + handler の3段');

    // 実 middleware の fail-closed を確認（cookie なし → 401 / Origin なし → 403）
    const session = webSession.requireSession({ secret: 'y'.repeat(20) });
    let status401 = null;
    session({ headers: {} }, { status: function (s) { status401 = s; return { json: function () {} }; } }, function () { status401 = 'next'; });
    assert(status401 === 401, '6d. session middleware: cookie なし → 401（既存実装・無変更）');

    const origin = webSession.requireTrustedOrigin({ trustedOrigins: ['https://example.test'] });
    let status403 = null;
    origin({ headers: {} }, { status: function (s) { status403 = s; return { json: function () {} }; } }, function () { status403 = 'next'; });
    assert(status403 === 403, '7c. Origin middleware: Origin 欠落 → 403（既存実装・無変更）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('8〜10. produce 正常（fake provider・token 非露出・金額一致）');
  {
    const h = makeHarness();
    const res = await service.handleProduceRequest(
      { caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low', confirmedCostJpy: EXPECTED_LOW_7 }, h.deps);
    assert(res.status === 200 && res.body.ok === true, '8a. HTTP 200 / ok:true');
    assert(res.body.generated === 7 && res.body.published === false, '8b. generated:7 / published:false');
    assert(h.st.providerCalls === 7, '8c. provider 呼び出しは 7 回（1枚1回・batch なし）');
    assert(h.st.uploads === 1 && h.st.metadataWrites === 1, '8d. Storage upload 1 / Draft metadata write 1');
    assert(h.st.ledger.length === 1 && h.st.ledger[0].status === 'completed', '8e. ledger 1 行 completed');
    assert(h.st.ledger[0].attempted === 7 && h.st.ledger[0].successful === 7, '8f. ledger attempted/successful = 7/7');

    const json = JSON.stringify(res.body);
    assert(json.indexOf('approvalToken') === -1, '9a. ★ response に approvalToken キーが無い');
    assert(!/v1\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(json), '9b. ★ response に token 形式の文字列が無い');
    assert(json.indexOf('nonce') === -1, '9c. response に nonce が無い');
    assert(json.indexOf('billingLock') === -1, '9d. response に billingLock が無い');
    const svcSrc = fs.readFileSync(path.join(__dirname, 'lib', 'carouselImageService.js'), 'utf8');
    const produceBlock = svcSrc.slice(svcSrc.indexOf('async function handleProduceRequest'));
    assert(/billingLock: false/.test(produceBlock), '9e. produce は billingLock:false を内部固定');
    assert(produceBlock.indexOf('body.billingLock') === -1, '9f. ★ produce は client の billingLock を読まない');
    assert(!/console\.(log|warn|error|info)/.test(produceBlock), '9g. produce は token を含みうる log を出さない');

    assert(Math.abs(res.body.estimatedTotalCostJpy - EXPECTED_LOW_7) < 1e-9, '10. confirmedCostJpy 一致時に実行され、同額が返る');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('11〜15. produce の fail-closed（いずれも provider 0）');
  {
    const h11 = makeHarness();
    const r11 = await service.handleProduceRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low', confirmedCostJpy: 1 }, h11.deps);
    assert(r11.status === 409 && r11.body.reason === 'estimated_cost_mismatch', '11a. 金額不一致 → 409 estimated_cost_mismatch');
    assert(h11.st.providerCalls === 0 && h11.st.ledger.length === 0, '11b. provider 0 / ledger write 0');
    assert(Math.abs(r11.body.estimatedTotalCostJpy - EXPECTED_LOW_7) < 1e-9, '11c. 再確認用に server 再計算額を返す');

    const h11b = makeHarness();
    const r11b = await service.handleProduceRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low' }, h11b.deps);
    assert(r11b.status === 409 && r11b.body.reason === 'estimated_cost_mismatch', '11d. confirmedCostJpy 欠落 → 409（自動で課金へ進まない）');
    assert(h11b.st.providerCalls === 0, '11e. provider 0');

    const h12 = makeHarness({ ledger: [{ nonce: 'prior', output_id: OUTPUT_ID, status: 'in_progress', estimated_total_cost_jpy: 1 }] });
    const r12 = await service.handleProduceRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low', confirmedCostJpy: EXPECTED_LOW_7 }, h12.deps);
    assert(r12.status === 409 && r12.body.reason === 'post_execution_in_progress', '12a. 同一 output に active 行 → post_execution_in_progress');
    assert(h12.st.providerCalls === 0, '12b. ★ provider 0（ledger が最終防御）');

    // approval 発行後・generate 前に Draft が変化（fingerprint 不一致）
    // loadOutputDraft は produce 内で quote(1) → approval(2) → generate(3) の順に呼ばれる。
    //   3回目（generate の canonical 再読込）から updated_at を変え、approval 発行後の変更を再現する。
    const h13 = makeHarness({ mutateOnRead: 3 });
    const r13 = await service.handleProduceRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low', confirmedCostJpy: EXPECTED_LOW_7 }, h13.deps);
    assert(r13.status !== 200 && ['scope_mismatch', 'draft_fingerprint_mismatch'].indexOf(r13.body.reason) !== -1,
      '13a. stale fingerprint → ' + r13.body.reason);
    assert(h13.st.providerCalls === 0 && h13.st.ledger.length === 0, '13b. ★ provider 0 / ledger write 0');

    const h14 = makeHarness({ approval: baseApproval({ published: true }) });
    const r14 = await service.handleProduceRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low', confirmedCostJpy: EXPECTED_LOW_7 }, h14.deps);
    assert(r14.status === 403 && r14.body.reason === 'already_published', '14a. published=true → 403 already_published');
    assert(h14.st.providerCalls === 0, '14b. ★ provider 0');

    const withAssets = baseDraft();
    withAssets.fields = Object.assign({}, withAssets.fields, { carouselAssets: [{ slideIndex: 1 }] });
    const h15 = makeHarness({ draft: withAssets });
    const r15 = await service.handleProduceRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low', confirmedCostJpy: EXPECTED_LOW_7 }, h15.deps);
    assert(r15.status === 409 && r15.body.reason === 'already_generated', '15a. assets あり → 409 already_generated');
    assert(h15.st.providerCalls === 0, '15b. ★ provider 0（同一 outputId の再生成をしない）');

    const h15c = makeHarness({ approval: baseApproval({ approval_decision: 'rejected' }) });
    const r15c = await service.handleProduceRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low', confirmedCostJpy: EXPECTED_LOW_7 }, h15c.deps);
    assert(r15c.status === 403 && r15c.body.reason === 'not_approved' && h15c.st.providerCalls === 0, '15c. 未承認 → 403 / provider 0');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('16〜17. 失敗時に自動 retry / 自動再送をしない');
  {
    const h16 = makeHarness({ providerFailAt: 4 });
    const r16 = await service.handleProduceRequest({ caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low', confirmedCostJpy: EXPECTED_LOW_7 }, h16.deps);
    assert(r16.status === 502 && r16.body.reason === 'provider_failed', '16a. 4枚目で失敗 → 502 provider_failed');
    assert(h16.st.providerCalls === 4, '16b. ★ provider 呼び出しは 4 回で停止（自動 retry 0）');
    assert(h16.st.uploads === 0 && h16.st.metadataWrites === 0, '16c. all-or-nothing（Storage / Draft 書込み 0）');
    assert(h16.st.ledger.length === 1 && h16.st.ledger[0].status === 'failed_after_charge', '16d. ledger は failed_after_charge');
    assert(JSON.stringify(r16.body).indexOf('approvalToken') === -1, '16e. 失敗応答にも token を含めない');

    const svcSrc = fs.readFileSync(path.join(__dirname, 'lib', 'carouselImageService.js'), 'utf8');
    const produceBlock = svcSrc.slice(svcSrc.indexOf('async function handleProduceRequest'));
    // ★ 説明コメント内の語で誤検出しないよう、コメントを除いた「実コード」で判定する。
    const stripComments = function (t) { return t.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, ''); };
    const produceCode = stripComments(produceBlock);
    assert(!/retry|setTimeout|setInterval|while\s*\(|for\s*\(/.test(produceCode), '17a. produce の実コードに retry / loop / timer が存在しない');
    const idxSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const uiBlock = idxSrc.slice(idxSrc.indexOf('var CAROUSEL_IMAGE_PRODUCTION_VERSION'), idxSrc.indexOf('// Phase50-7: Publishing Ready Center HTML生成'));
    const uiCode = stripComments(uiBlock);
    assert(!/setTimeout|setInterval|retry/i.test(uiCode), '17b. UI の実コードにも retry / timer が存在しない');
    assert((uiCode.match(/\/api\/carousel-image\/produce/g) || []).length === 1, '17c. UI の produce 呼び出し箇所は 1 つだけ');
    assert(uiBlock.indexOf("_cipState.phase = 'unknown'") !== -1, '17d. 通信断は unknown 状態にして自動再送しない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('18〜21, 25. Output Engine UI（fake fetch・実HTTP 0）');
  {
    const idxSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    const uiBlock = idxSrc.slice(idxSrc.indexOf('var CAROUSEL_IMAGE_PRODUCTION_VERSION'), idxSrc.indexOf('// Phase50-7: Publishing Ready Center HTML生成'));
    const escBlock = idxSrc.slice(idxSrc.indexOf('function escapeHtml(s) {'), idxSrc.indexOf('function runSearch(query) {'));

    function mkUi(o) {
      o = o || {};
      const calls = [];
      const ctx = {
        console: console, Object: Object, Array: Array, String: String, Number: Number, Math: Math, JSON: JSON, isFinite: isFinite,
        encodeURIComponent: encodeURIComponent,
        OUTPUT_TYPES: { INSTAGRAM_CAROUSEL: 'instagram_carousel' },
        normalizeOutputType: function (t) { return t; },
        getCurrentApprovalCaseId: function () { return CASE_ID; },
        getCurrentApprovalOutputId: function () { return OUTPUT_ID; },
        renderOutputEnginePanel: function () {},
        _mobileApprovalState: { decision: o.approved === false ? null : 'approved' },
        _lastOutputDraft: o.draft || { id: OUTPUT_ID, type: 'instagram_carousel', fields: baseDraft().fields },
        fetch: async function (url, init) {
          calls.push(((init && init.method) || 'GET') + ' ' + String(url).split('?')[0]);
          if (o.networkError) throw new Error('Failed to fetch');
          if (String(url).indexOf('/api/carousel-image/quote') === 0) {
            return { status: 200, ok: true, json: async function () { return o.quote || { ok: true, eligible: true, reason: null, caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low', slideCount: 7, estimatedTotalCostJpy: EXPECTED_LOW_7, cumulativeSpentJpy: 0, budgetJpyPerPost: 100, approved: true, published: false, assetsReady: false }; } };
          }
          return { status: o.produceStatus || 200, ok: (o.produceStatus || 200) === 200, json: async function () { return o.produceBody || { ok: true, generated: 7, published: false, estimatedTotalCostJpy: EXPECTED_LOW_7 }; } };
        },
      };
      vm.createContext(ctx);
      vm.runInContext(escBlock + '\n' + uiBlock, ctx);
      ctx.__calls = calls;
      return ctx;
    }

    // 18. quote 表示
    const u18 = mkUi();
    const initial = u18.buildCarouselImageProductionHtml();
    assert(initial.indexOf('画像生成の準備ができています') !== -1 && initial.indexOf('生成内容を確認') !== -1, '18a. 承認済み・未生成 → 初期表示');
    assert(initial.indexOf('cipGenerate()') === -1, '18b. 初期表示に生成ボタンが無い');
    await u18.cipLoadQuote();
    const quoted = u18.buildCarouselImageProductionHtml();
    assert(quoted.indexOf('7枚') !== -1 && quoted.indexOf('¥' + EXPECTED_LOW_7.toFixed(2)) !== -1, '18c. 枚数と認可額を表示（¥' + EXPECTED_LOW_7.toFixed(2) + '）');
    assert(quoted.indexOf('cipGenerate()') !== -1, '18d. 明示確認後に生成ボタンが出る');
    assert(quoted.indexOf('予算上限') === -1 && quoted.indexOf('認可額') !== -1, '18e. 「予算上限」と断定せず「認可額」表記');
    assert(u18.__calls.filter(function (c) { return c.indexOf('produce') !== -1; }).length === 0, '18f. quote 表示までに produce 0 回');

    // 19. 明示確認前に produce を呼んでも送信されない
    const u19 = mkUi();
    await u19.cipGenerate();
    assert(u19.__calls.length === 0, '19a. ★ quote 未取得で cipGenerate() → fetch 0 回');
    const u19b = mkUi({ quote: { ok: true, eligible: false, reason: 'not_approved', caseId: CASE_ID, outputId: OUTPUT_ID, quality: 'low', slideCount: 7, estimatedTotalCostJpy: EXPECTED_LOW_7, cumulativeSpentJpy: 0, budgetJpyPerPost: 100 } });
    await u19b.cipLoadQuote();
    await u19b.cipGenerate();
    assert(u19b.__calls.filter(function (c) { return c.indexOf('produce') !== -1; }).length === 0, '19b. eligible:false では produce しない');
    const ineligible = u19b.buildCarouselImageProductionHtml();
    assert(ineligible.indexOf('Mobile Approval が未承認です') !== -1, '19c. reason をユーザー向け文言へ変換');

    // 20. 二重押下防止
    const u20 = mkUi();
    await u20.cipLoadQuote();
    await Promise.all([u20.cipGenerate(), u20.cipGenerate(), u20.cipGenerate()]);
    assert(u20.__calls.filter(function (c) { return c.indexOf('produce') !== -1; }).length === 1, '20a. ★ 同時3回押下 → produce POST は 1 回');
    const u20b = mkUi();
    await u20b.cipLoadQuote();
    await u20b.cipGenerate();
    await u20b.cipGenerate();
    assert(u20b.__calls.filter(function (c) { return c.indexOf('produce') !== -1; }).length === 1, '20b. 成功後に再度押下 → produce 追加送信 0');

    // 21. generated 状態
    const done = u20b.buildCarouselImageProductionHtml();
    assert(done.indexOf('7枚の画像生成が完了しました') !== -1, '21a. 成功表示');
    assert(done.indexOf('未投稿（published=false）') !== -1, '21b. published=false を表示');
    assert(done.indexOf('cipGenerate()') === -1, '21c. 成功後に生成ボタンを出さない');
    assert(done.indexOf('次工程') !== -1, '21d. プレビューは次工程である旨を表示');

    // 生成済み Draft → ボタンを出さない
    const withAssets = { id: OUTPUT_ID, type: 'instagram_carousel', fields: Object.assign({}, baseDraft().fields, { carouselAssets: [1, 2, 3, 4, 5, 6, 7] }) };
    const uGen = mkUi({ draft: withAssets });
    const genHtml = uGen.buildCarouselImageProductionHtml();
    assert(genHtml.indexOf('画像生成済みです（7枚）') !== -1 && genHtml.indexOf('cipGenerate()') === -1 && genHtml.indexOf('cipLoadQuote()') === -1,
      '21e. assets あり → 生成ボタンを出さない');

    // 未承認
    const uNo = mkUi({ approved: false });
    const noHtml = uNo.buildCarouselImageProductionHtml();
    assert(noHtml.indexOf('Mobile Approval を完了してください') !== -1 && noHtml.indexOf('cipGenerate()') === -1, '21f. 未承認 → 生成不可の案内');

    // 通信断 → unknown（自動再送なし）
    const uNet = mkUi();
    await uNet.cipLoadQuote();
    uNet.fetch = async function () { throw new Error('Failed to fetch'); };
    await uNet.cipGenerate();
    const unknownHtml = uNet.buildCarouselImageProductionHtml();
    assert(unknownHtml.indexOf('成否が確認できませんでした') !== -1, '21g. 通信断 → 成否不明の表示');
    assert(unknownHtml.indexOf('繰り返さないでください') !== -1 && unknownHtml.indexOf('cipGenerate()') === -1, '21h. ★ 再送ボタンを出さない');
    assert(unknownHtml.indexOf('生成状態を確認する') !== -1, '21i. read-only の状態確認へ誘導');

    // 25. XSS
    const uXss = mkUi({ produceStatus: 500, produceBody: { ok: false, reason: '<img src=x onerror=alert(1)>' } });
    await uXss.cipLoadQuote();
    await uXss.cipGenerate();
    const xssHtml = uXss.buildCarouselImageProductionHtml();
    assert(xssHtml.indexOf('<img') === -1 && xssHtml.indexOf('&lt;img') !== -1, '25a. 未知 reason が escape される');
    assert(!/style="[^"]*(onerror|&lt;img)/.test(xssHtml), '25b. 属性へ外部データを入れていない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('22〜24, 26. 既存機能の非接触');
  {
    const idxSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert(/var canApprove = _mapAllChecked\(\) && _mapReviewApproved\(mai\) && !_mapCompliance\.blocked;/.test(idxSrc),
      '22a. Mobile Approval の canApprove 式が無変更');
    assert(idxSrc.indexOf('if (_mapAllChecked() && _mapReviewApproved(mai)) {') !== -1, '22b. approveInstagramPackage が無変更');
    const uiBlock = idxSrc.slice(idxSrc.indexOf('var CAROUSEL_IMAGE_PRODUCTION_VERSION'), idxSrc.indexOf('// Phase50-7: Publishing Ready Center HTML生成'));
    // 代入（=）のみを検出する。比較（===）は読み取りなので除外する。
    assert(!/_mobileApprovalState\s*\.\s*\w+\s*=(?!=)/.test(uiBlock), '22c. UI が Mobile Approval の状態を書き換えない（読み取りのみ）');

    assert(idxSrc.indexOf('function buildContentValueDiagnosisHtml(') !== -1, '23a. Content Value パネルが存在');
    assert(!/contentValue|buildContentValueDiagnosisHtml/.test(uiBlock), '23b. Stage 1a が Content Value へ触れない');

    assert(!/_publishingReadyState\s*\.\s*\w+\s*=|markInstagramPublished|published\s*=\s*true/.test(uiBlock),
      '24a. UI が Publishing 状態を書き換えない');
    assert(/_oeSafe\(buildMobileApprovalHtml,[\s\S]{0,90}_oeSafe\(buildCarouselImageProductionHtml,[\s\S]{0,90}_oeSafe\(buildPublishingReadyHtml,/.test(idxSrc),
      '24b. 描画順 MobileApproval → CarouselImageProduction → PublishingReady');

    // Security Core の無変更（git 差分で確認）
    const changed = require('child_process')
      .execSync('git diff --name-only HEAD -- shared server.js supabase lib/carouselImageClient.js lib/carouselExecutionDb.js lib/carouselAssetStorage.js lib/webSession.js', { encoding: 'utf8' })
      .trim();
    assert(changed === '', '26a. Security Core（shared / server.js / schema / client / ledger / storage / session）無変更 | ' + (changed || 'なし'));
    const libChanged = require('child_process').execSync('git diff --name-only HEAD -- lib', { encoding: 'utf8' }).trim().split('\n').filter(Boolean).sort();
    assert(JSON.stringify(libChanged) === JSON.stringify(['lib/carouselImageRoutes.js', 'lib/carouselImageService.js']),
      '26b. lib の変更は service / routes の2ファイルのみ | ' + libChanged.join(', '));
  }

  console.log('\n=== ' + _passed + ' passed / ' + _failed + ' failed ===');
  process.exit(_failed ? 1 : 0);
})();
