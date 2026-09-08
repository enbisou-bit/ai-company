'use strict';
// lib/carouselImageRoutes.js
// Carousel Image Production — Phase 2-E Production Connection Step C-3: Express adapter。
//
//   責務: lib/carouselImageService.js の3つの純粋 async 関数を Express の (req,res) へ薄く配線
//   するだけ。business logic はここに書かない（Architecture Rule）。
//
//   POST /api/carousel-image/approval
//   POST /api/carousel-image/generate
//   GET  /api/carousel-image/assets
//
//   ★ buildProductionDeps() は「呼び出し可能な状態を作る」だけで、実 network / 実DB write /
//     実 Storage upload をこの時点では一切行わない。credential 未設定・bucket 未作成の現状でも
//     module require・関数オブジェクト構築自体は失敗しない設計にする
//     （server startup 全体を壊さない・Carousel route 呼出時のみ fail-closed する）。
//   ★ REAL_ENABLED=false（lib/carouselImageClient.js）である限り、generate は
//     assertRealCallAllowed の 'real_api_disabled' で必ず停止する（本ファイルはこのgateを
//     迂回しない・複製しない）。
//   ★ Storage privileged client（storageClient）: Production Activation Step PA-2で
//     lib/carouselAssetStorageSupabase.js（Decision 114実装）を配線した。credential
//     （SUPABASE_URL・SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY）が未設定の環境
//     （Claude Code / local / test / 本Step時点のRender）では carouselAssetStorageClient は
//     null のまま——bucket / Storage RLS / Render secret のいずれも未整備の現状でも、
//     module require・client構築自体は失敗しない（createClient()はネットワークリクエストを
//     発生させないlazy client）。lib/carouselAssetStorage.js / lib/carouselAssetAccess.js
//     （いずれも変更禁止）は client 未設定を 'storage_unavailable' として fail-closed する
//     設計のため、credential未設定の間は実 Storage network 到達は常に 0 のまま安全。

var service = require('./carouselImageService');
var webSession = require('./webSession');

function createApprovalHandler(deps) {
  return async function (req, res) {
    var result = await service.handleApprovalRequest(req.body || {}, deps);
    res.status(result.status).json(result.body);
  };
}

function createGenerateHandler(deps) {
  return async function (req, res) {
    var result = await service.handleGenerateRequest(req.body || {}, deps);
    res.status(result.status).json(result.body);
  };
}

function createAssetsHandler(deps) {
  return async function (req, res) {
    var result = await service.handleAssetsRequest(req.query || {}, deps);
    res.status(result.status).json(result.body);
  };
}

// app: Express app（または router）。deps は lib/carouselImageService.js の各 handle*Request が
//   必要とする dependency 一式（buildProductionDeps() か、テスト用 fake 一式）。
//
//   ★ Step C-5-pre: 3routeすべてに server-side session を必須化する（lib/webSession.js）。
//     - session は「このrouteへ到達してよい利用者か」= route access authority
//     - approval token は「この成果物・quality・costで生成してよいか」= generation authorization
//     両者は別concept。session だけでも approval token だけでも有料生成には到達しない。
//   ★ 環境変数の有無で session 要求を skip する経路は作らない。WEB_SESSION_SECRET 未設定なら
//     verifySessionToken が常に失敗し、3routeは 401 で閉じたままになる（fail-closed）。
//   ★ POST 2route には Origin 検証（CSRF defense in depth）を追加する。GET assets は
//     署名URL発行routeのため session は必須だが、書き込みではないため Origin 検証は課さない
//     （Cookie は SameSite=Strict のため、そもそもクロスサイトでは送信されない）。
//   ★ middleware順序: session → Origin → handler（handler内で request検証 → billingLock →
//     approval token/canonical → budget → reserve → provider の順に進む）。
function registerCarouselImageRoutes(app, deps) {
  var sessionOpts = (deps && deps.sessionOptions) || {};
  var originOpts = (deps && deps.originOptions) || {};

  var session = webSession.requireSession(sessionOpts);
  var origin = webSession.requireTrustedOrigin(originOpts);

  app.post('/api/carousel-image/approval', session, origin, createApprovalHandler(deps));
  app.post('/api/carousel-image/generate', session, origin, createGenerateHandler(deps));
  app.get('/api/carousel-image/assets', session, createAssetsHandler(deps));
}

// ══════════════════════════════════════════════════════════════
// buildProductionDeps — 既存 server-only factory から実 dependency を構築する。
//   ★ ここで組み立てる各関数は、credential/bucket/REAL_ENABLED いずれかが未整備なら
//     それぞれの既存 fail-closed reason を返す（lib/carouselExecutionSupabase.js の
//     null client・lib/carouselImageClient.js の REAL_ENABLED gate・
//     lib/carouselAssetStorage.js の client 必須チェックが、それぞれの層で担保する）。
//     本関数はそれらを迂回する新しい fallback を一切追加しない。
// ══════════════════════════════════════════════════════════════
function buildProductionDeps() {
  var outputDraftsDb = require('./outputDraftsDb');
  var approvalsDb = require('./approvalsDb');
  var executionDb = require('./carouselExecutionDb');
  var executionStoreModule = require('./carouselExecutionStore');
  var imageClient = require('./carouselImageClient');
  var normalizeModule = require('./carouselImageNormalize');
  var compositorModule = require('./carouselCompositor');
  var assetStorage = require('./carouselAssetStorage');
  var assetAccess = require('./carouselAssetAccess');
  var assetStorageSupabase = require('./carouselAssetStorageSupabase');
  var core = require('../shared/carouselImageCore');
  var costTrackerModule = require('../costTracker');

  return {
    loadOutputDraft: async function (scope) {
      var r = await outputDraftsDb.getOutputDraft({ caseId: scope.caseId, outputId: scope.outputId });
      return (r && r.draft) ? r.draft : null;
    },
    loadApproval: async function (scope) {
      var r = await approvalsDb.getApproval(scope.caseId, scope.outputId);
      return (r && r.approval) ? r.approval : null;
    },
    getCumulativeSpentJpyByOutputId: function (outputId) {
      return executionDb.getCumulativeSpentJpyByOutputId(outputId);
    },
    saveOutputDraftAssets: async function (input) {
      var r = await outputDraftsDb.upsertOutputDraft({
        outputId: input.outputId, caseId: input.caseId, fields: input.fields,
      });
      return { ok: !r.error, reason: r.error ? 'asset_metadata_write_failed' : null };
    },
    executionStore: executionStoreModule.carouselExecutionStore,
    // REAL_ENABLED=false の間、client.generateBackground({mock:false}) は 'real_api_disabled' を
    //   即座に返す（lib/carouselImageClient.js 内部で OPENAI_API_KEY 読み取りより前に停止する）。
    provider: function (opts) {
      return imageClient.generateBackground(Object.assign({}, opts, { mock: false }));
    },
    normalize: normalizeModule.normalizeBackground,
    composite: compositorModule.compositeSlide,
    uploadCarouselAssets: assetStorage.uploadCarouselAssets,
    createSignedUrl: assetAccess.createSignedUrl,
    runCarouselImageJob: core.runCarouselImageJob,
    checkCostLimit: function () { return costTrackerModule.costTracker.canProcess(); },
    approvalSecret: undefined,     // undefined => shared/carouselApproval.js が process.env を読む
    budgetJpyPerPost: undefined,   // undefined => core.BUDGET_JPY_PER_POST_DEFAULT が適用される
    approvalTtlMs: undefined,      // undefined => shared/carouselApproval.js の DEFAULT_TTL_MS
    now: function () { return Date.now(); },
    // Production Activation Step PA-2: Storage専用 privileged client（Decision 114）を配線する。
    //   ★ credential（SUPABASE_URL・SUPABASE_SECRET_KEY/SUPABASE_SERVICE_ROLE_KEY）が
    //     未設定の環境（Claude Code / local / test）では carouselAssetStorageClient は
    //     null のまま——require するだけ・buildProductionDeps() を呼ぶだけでは実 Storage
    //     network は発生しない（createClient() 自体がネットワークリクエストを発生させない
    //     lazy client であるため）。null の場合、lib/carouselAssetStorage.js /
    //     lib/carouselAssetAccess.js（いずれも変更禁止・無変更）が opts.client 必須チェックで
    //     'storage_unavailable' を返し fail-closed する（Step C-2/C-3で実装済みの契約）。
    //   ★ Decision 110 の carousel_image_executions 専用 privileged client
    //     （lib/carouselExecutionSupabase.js）はここでは一切参照しない
    //     （Storageとledgerでmodule責務を分離する・横展開しない）。
    storageClient: assetStorageSupabase.carouselAssetStorageClient,
    signedUrlExpiresIn: 300,
    // session / Origin は既定（process.env.WEB_SESSION_SECRET・WEB_TRUSTED_ORIGIN /
    //   RENDER_EXTERNAL_URL）から解決させる。テストからは registerCarouselImageRoutes(app, deps)
    //   の deps.sessionOptions / deps.originOptions で注入できる。
    sessionOptions: {},
    originOptions: {},
  };
}

module.exports = {
  createApprovalHandler: createApprovalHandler,
  createGenerateHandler: createGenerateHandler,
  createAssetsHandler: createAssetsHandler,
  registerCarouselImageRoutes: registerCarouselImageRoutes,
  buildProductionDeps: buildProductionDeps,
};
