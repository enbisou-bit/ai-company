'use strict';
// lib/carouselImageService.js
// Carousel Image Production — Phase 2-E Production Connection Step C-3: HTTP-agnostic service layer。
//
//   責務: POST /api/carousel-image/approval・POST /api/carousel-image/generate・
//   GET /api/carousel-image/assets の3routeが必要とする業務ロジックを、Express（req/res）から
//   切り離した純粋な async 関数として提供する。戻り値は常に { status, body } で統一し、
//   lib/carouselImageRoutes.js が res.status(status).json(body) するだけで済むようにする。
//
//   ★ 新しい検証/課金/token/DBロジックをここで発明しない。既存の以下を dependency injection 経由で
//     呼び出すだけに徹する（Architecture Rule・二重ロジック禁止）:
//       shared/carouselImageCore.js  … planCarouselImageJob / draftFingerprint / validateScope /
//                                       runCarouselImageJob（reserve→provider→normalize→composite→ledger）
//       shared/carouselApproval.js   … issueApprovalToken / verifyApprovalToken / hasSecret
//       lib/carouselImageClient.js   … estimateAuthorizedTotalJpy / CAROUSEL_IMAGE_MODEL
//       lib/carouselAssetStorage.js  … uploadCarouselAssets（Step C-2・DI経由）
//       lib/carouselAssetAccess.js   … createSignedUrl（DI経由）
//
//   ★ Client input の trust boundary:
//     - approval: { caseId, outputId, quality, workflowId? } のみ受理。quality はユーザーの明示選択と
//       して受理するが、slideCount/fingerprint/model/estimatedCostJpy/alreadySpentEstimatedJpy 等は
//       常に server 側で canonical Output Draft / execution ledger から再構築する（信用しない）。
//     - generate: { approvalToken } のみを正式 authority とする。token 内の caseId/outputId/quality は
//       peekApprovalTokenScope() で「署名未検証のまま」読み取り、canonical state の lookup key として
//       のみ使う（どこを見るかを知るためだけ）。実際の認可は、その canonical state から再計算した
//       値を expected として渡す approval.verifyApprovalToken()（HMAC 署名検証込み）が担う。
//       peek 結果を検証なしに認可判断へ使わない。
//     - assets: { caseId, outputId } はクエリの lookup key に過ぎず、返す storagePath は必ず
//       canonical Output Draft の fields.carouselAssets に登録済みのものだけを使う
//       （client 指定値から Storage path を組み立てない）。
//
//   ★ Billing / Ledger boundary: 本ファイルは carousel_image_executions を直接触らない
//     （lib/carouselExecutionStore.js を deps.executionStore として runCarouselImageJob へ渡すのみ）。
//     provider成功 → ledger completed（runCarouselImageJob 内部） → Storage persistence → Output Draft
//     metadata write、の順序を維持する。Storage/metadata write が失敗しても ledger のtruthは
//     一切書き戻さない（本ファイルはそもそも ledger の completed/failed を書き換えるAPIを呼ばない）。
//
//   ★ published は本ファイルのどの経路でも true へ変更しない（generate 成功時も published:false を
//     応答へ明示する）。Publishing 判断・Mobile Approval の実行は本ファイルの範囲外。
//
//   ★ REAL_ENABLED=false の間は、generate が runCarouselImageJob → assertRealCallAllowed の
//     'real_api_disabled' で必ず停止する（本ファイルはこのgateを迂回・複製しない）。

var core = require('../shared/carouselImageCore');
var approval = require('../shared/carouselApproval');
var client = require('../lib/carouselImageClient');

// ── HTTP status mapping（fail-closed reason → status。テストで固定する） ──────────────
//   既存 reason 語彙（shared/carouselImageCore.js・shared/carouselApproval.js・
//   lib/carouselExecutionDb.js・lib/carouselAssetStorage.js）を勝手に rename せずそのまま使う。
var STATUS_BY_REASON = {
  // 400: request shape（呼び出し側の入力が最初から不正）
  invalid_request: 400,
  missing_quality: 400,
  invalid_quality: 400,
  invalid_slide_count: 400,
  slide_count_mismatch: 400,
  invalid_caseId: 400,
  invalid_outputId: 400,
  not_enough_slides: 400,

  // 401: token自体が無効（形式・署名・期限）
  missing_token: 401,
  malformed_token: 401,
  signature_invalid: 401,
  token_expired: 401,
  token_not_yet_valid: 401,
  invalid_ttl: 401,
  missing_expected_scope: 401,

  // 403: 認可状態（scopeは解決できたが許可されない）
  billing_locked: 403,
  unauthorized: 401,
  forbidden_origin: 403,
  not_approved: 403,
  no_approval: 403,
  already_published: 403,
  cross_case: 403,
  output_mismatch: 403,
  scope_mismatch: 403,
  asset_scope_mismatch: 403,

  // 404: canonical resourceが存在しない
  not_found: 404,
  draft_not_found: 404,
  assets_not_ready: 404,

  // 409: 状態が競合/staleー新しいapproval token取得等で解消しうる
  budget_exceeded: 409,
  post_execution_in_progress: 409,
  nonce_reused: 409,
  stale_built_at: 409,
  stale_updated_at: 409,
  missing_stale_marker: 409,
  draft_fingerprint_mismatch: 409,
  estimated_cost_mismatch: 409,
  storage_collision: 409,

  // 503: 依存/環境が未整備（呼び出し側の入力の問題ではない・fail-closed）
  no_approval_secret: 503,
  approval_secret_unavailable: 503,
  draft_read_unavailable: 503,
  approval_read_unavailable: 503,
  budget_read_unavailable: 503,
  reserve_unavailable: 503,
  real_api_disabled: 503,
  cost_limit_stopped: 503,
  billing_locked: 503,
  estimate_unavailable: 503,
  execution_store_not_injected: 503,
  provider_not_injected: 503,
  normalize_not_injected: 503,
  composite_not_injected: 503,
  ledger_update_unavailable: 503,
  storage_unavailable: 503,
  generation_unavailable: 503,

  // 502: 依存への到達はできたが生成/永続化が失敗した
  provider_failed: 502,
  provider_threw: 502,
  normalize_failed: 502,
  normalize_threw: 502,
  composite_failed: 502,
  composite_threw: 502,
  generation_failed: 502,
  asset_persistence_failed: 502,
  asset_metadata_write_failed: 502,
  storage_upload_failed: 502,
  invalid_png: 502,
  invalid_asset_input: 502,
  invalid_storage_path: 502,
  asset_access_failed: 502,
};

function reasonToHttpStatus(reason) {
  return STATUS_BY_REASON[reason] || 500;
}

function _err(status, reason, field) {
  var body = { ok: false, reason: reason };
  if (field) body.field = field;
  return { status: status, body: body };
}

// ── token peek（未検証・lookup専用） ──────────────
//   shared/carouselApproval.js は変更禁止のため、同ファイルの公開 wire format
//   （TOKEN_VERSION + '.' + base64url(payload) + '.' + base64url(sig)）を「読むだけ」の
//   最小限の decode をここに複製する。新しい token format を作るものではない。
//   ★ ここで得た scope は署名未検証。認可判断には使わず、canonical state の lookup key
//     （どの caseId/outputId/quality を見に行くか）としてのみ使う。
function _unb64u(s) {
  var t = String(s).replace(/-/g, '+').replace(/_/g, '/');
  while (t.length % 4 !== 0) t += '=';
  return Buffer.from(t, 'base64');
}
function peekApprovalTokenScope(token) {
  if (typeof token !== 'string' || !token) return { ok: false, reason: 'missing_token' };
  var parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== approval.TOKEN_VERSION) return { ok: false, reason: 'malformed_token' };
  var scope;
  try { scope = JSON.parse(_unb64u(parts[1]).toString('utf8')); }
  catch (e) { return { ok: false, reason: 'malformed_token' }; }
  if (!scope || typeof scope !== 'object') return { ok: false, reason: 'malformed_token' };
  if (!scope.caseId || !scope.outputId || !scope.quality) return { ok: false, reason: 'malformed_token' };
  return { ok: true, scope: scope };
}

// ══════════════════════════════════════════════════════════════
// POST /api/carousel-image/approval
//   input: { caseId, outputId, quality, workflowId? }（workflowId は informational のみ・
//     output_drafts に永続列が無いため trust boundary にも token scope にも含めない）
// ══════════════════════════════════════════════════════════════
async function handleApprovalRequest(input, deps) {
  var body = input || {};
  var caseId = body.caseId;
  var outputId = body.outputId;
  var quality = body.quality;

  if (typeof caseId !== 'string' || !caseId) return _err(400, 'invalid_request', 'caseId');
  if (typeof outputId !== 'string' || !outputId) return _err(400, 'invalid_request', 'outputId');

  var draftRow;
  try { draftRow = await deps.loadOutputDraft({ caseId: caseId, outputId: outputId }); }
  catch (e) { return _err(503, 'draft_read_unavailable'); }
  if (!draftRow) return _err(404, 'not_found');

  var approvalRow;
  try { approvalRow = await deps.loadApproval({ caseId: caseId, outputId: outputId }); }
  catch (e) { return _err(503, 'approval_read_unavailable'); }

  // 既存 core.planCarouselImageJob() が scope/approval/published/slides.length/quality を
  //   まとめて検証する（二重ロジック禁止・reuse）。
  var plan = core.planCarouselImageJob({
    caseId: caseId, outputId: outputId, draftRow: draftRow, approvalRow: approvalRow,
    quality: quality, budgetJpyPerPost: deps.budgetJpyPerPost,
  });
  if (!plan.ok) return _err(reasonToHttpStatus(plan.reason), plan.reason);

  var fp = core.draftFingerprint(draftRow);
  var estimatedCostJpy = client.estimateAuthorizedTotalJpy(plan.quality, plan.totalSlides);
  if (estimatedCostJpy === null) return _err(503, 'estimate_unavailable');

  var cumulative;
  try { cumulative = await deps.getCumulativeSpentJpyByOutputId(outputId); }
  catch (e) { cumulative = { ok: false, reason: 'budget_read_unavailable' }; }
  if (!cumulative || cumulative.ok !== true) return _err(503, 'budget_read_unavailable');

  // per-post cumulative authorization ceiling（Step B・Decision 111）を pre-flight で適用。
  //   ★ Step C-1 の Conservative Safety Lock（completed行もpartial UNIQUE対象）はDB側
  //     （reserve時）で最終的に強制される。ここでの pre-flight は「無駄なtoken発行をしない」
  //     ための早期チェックであり、認可の最終権威ではない。
  if (cumulative.cumulativeJpy + estimatedCostJpy > plan.budgetJpyPerPost) {
    return _err(409, 'budget_exceeded');
  }

  if (!approval.hasSecret(deps.approvalSecret)) return _err(503, 'approval_secret_unavailable');

  var now = typeof deps.now === 'function' ? deps.now() : Date.now();
  var iss = approval.issueApprovalToken({
    caseId: caseId, outputId: outputId, draftFingerprint: fp,
    quality: plan.quality, slideCount: plan.totalSlides, estimatedCostJpy: estimatedCostJpy,
  }, { secret: deps.approvalSecret, now: now, ttlMs: deps.approvalTtlMs });
  if (!iss.ok) return _err(reasonToHttpStatus(iss.reason), iss.reason);

  return {
    status: 200,
    body: {
      ok: true,
      approvalToken: iss.token,
      expiresAt: iss.scope.expiresAt,
      authorization: {
        quality: plan.quality,
        slideCount: plan.totalSlides,
        estimatedTotalCostJpy: estimatedCostJpy,
      },
    },
  };
}

// ══════════════════════════════════════════════════════════════
// POST /api/carousel-image/generate
//   input: { approvalToken }（正式 authority はこれのみ）
// ══════════════════════════════════════════════════════════════
async function handleGenerateRequest(input, deps) {
  var body = input || {};
  var token = body.approvalToken;
  if (typeof token !== 'string' || !token) return _err(400, 'invalid_request', 'approvalToken');

  // ★ 課金ロック（billingLock）: 既存 /api/evidence/web-search と同一の contract を採用する。
  //   billingLock はブラウザ側の状態（既定ON＝ロック中）であり server 側に実体を持たないため、
  //   **明示的な boolean false のみ**を課金許可とする。true / undefined / null / '' / 0 /
  //   'false' / 'true' などは全て拒否（fail-closed）。
  //   ★ 位置: reserve / provider / Storage のいずれよりも前。ここで拒否された場合、
  //     execution ledger へも provider へも Storage へも到達しない。
  if (body.billingLock !== false) return _err(403, 'billing_locked');

  var peek = peekApprovalTokenScope(token);
  if (!peek.ok) return _err(reasonToHttpStatus(peek.reason), peek.reason);

  var caseId = String(peek.scope.caseId);
  var outputId = String(peek.scope.outputId);

  var draftRow;
  try { draftRow = await deps.loadOutputDraft({ caseId: caseId, outputId: outputId }); }
  catch (e) { return _err(503, 'draft_read_unavailable'); }
  if (!draftRow) return _err(404, 'not_found');

  var approvalRow;
  try { approvalRow = await deps.loadApproval({ caseId: caseId, outputId: outputId }); }
  catch (e) { return _err(503, 'approval_read_unavailable'); }

  // peek済み quality を canonical state と一緒に再検証する（plan.ok が通れば
  //   scope/approval/published/slides/quality すべて現在の canonical state 基準で正当）。
  var plan = core.planCarouselImageJob({
    caseId: caseId, outputId: outputId, draftRow: draftRow, approvalRow: approvalRow,
    quality: peek.scope.quality, budgetJpyPerPost: deps.budgetJpyPerPost,
  });
  if (!plan.ok) return _err(reasonToHttpStatus(plan.reason), plan.reason);

  var fp = core.draftFingerprint(draftRow);
  var estimatedCostJpy = client.estimateAuthorizedTotalJpy(plan.quality, plan.totalSlides);
  if (estimatedCostJpy === null) return _err(503, 'estimate_unavailable');

  var now = typeof deps.now === 'function' ? deps.now() : Date.now();

  // ★ Mandatory Revalidation の核心: 署名（HMAC）・TTL・nonce再利用・scope一致
  //   （caseId/outputId/draftFingerprint/quality/slideCount/estimatedCostJpy）を、
  //   現在の canonical state から再計算した expected と照合する。1つでも approval発行時から
  //   変化していれば、ここで必ず拒否される（peek値を信用しない・認可の最終権威はこの呼び出し）。
  var verify = approval.verifyApprovalToken(token, {
    caseId: caseId, outputId: outputId, draftFingerprint: fp,
    quality: plan.quality, slideCount: plan.totalSlides, estimatedCostJpy: estimatedCostJpy,
  }, { secret: deps.approvalSecret, now: now });
  if (!verify.ok) return _err(reasonToHttpStatus(verify.reason), verify.reason);

  var cumulative;
  try { cumulative = await deps.getCumulativeSpentJpyByOutputId(outputId); }
  catch (e) { cumulative = { ok: false, reason: 'budget_read_unavailable' }; }
  if (!cumulative || cumulative.ok !== true) return _err(503, 'budget_read_unavailable');

  // costTracker.canProcess() 相当。未注入は true 扱いにしない（fail-closed）。
  var costOk = typeof deps.checkCostLimit === 'function' && deps.checkCostLimit() === true;

  var staleMark = { built_at: draftRow.built_at, updated_at: draftRow.updated_at };
  var jobInput = {
    real: true,
    caseId: caseId, outputId: outputId, workflowId: null,
    draftRow: draftRow, approvalRow: approvalRow,
    quality: plan.quality, budgetJpyPerPost: plan.budgetJpyPerPost,
    alreadySpentEstimatedJpy: cumulative.cumulativeJpy,
    // ここに到達している時点で body.billingLock === false が確定している（上のガード参照）。
    //   assertRealCallAllowed() の check3 は ctx.billingLock !== false を拒否するため、
    //   client 由来の検証済み値をそのまま渡す（hardcode ではない）。
    billingLock: body.billingLock, costTrackerCanProcess: costOk,
    staleBefore: staleMark, staleAfter: staleMark,
    slideCount: plan.totalSlides, estimatedCostJpy: estimatedCostJpy,
    draftFingerprint: fp, approvalToken: token, approvalSecret: deps.approvalSecret,
    now: now,
  };
  var jobDeps = {
    provider: deps.provider, normalize: deps.normalize, composite: deps.composite,
    executionStore: deps.executionStore,
  };

  var runJob = typeof deps.runCarouselImageJob === 'function' ? deps.runCarouselImageJob : core.runCarouselImageJob;
  var jobResult;
  try { jobResult = await runJob(jobInput, jobDeps); }
  catch (e) { return _err(503, 'generation_unavailable'); }

  if (!jobResult || jobResult.ok !== true) {
    var reason = (jobResult && jobResult.reason) || 'generation_failed';
    return _err(reasonToHttpStatus(reason), reason);
  }

  // ── ここに到達した時点で billing ledger truth は runCarouselImageJob 内部で completed 確定済み。
  //   以降（Storage / Output Draft metadata write）が失敗しても、上の ledger truth は書き戻さない
  //   （本関数はそもそも ledger を書き換える呼び出しを一切持たない）。
  var nonce = verify.scope.nonce;
  var assetItems = jobResult.formalAssets.map(function (a) {
    return {
      caseId: caseId, outputId: outputId, nonce: nonce,
      slideIndex: a.slideIndex, slideId: a.slideId, buffer: a.buffer,
    };
  });

  var storageResult;
  try { storageResult = await deps.uploadCarouselAssets(assetItems, { client: deps.storageClient }); }
  catch (e) { storageResult = { ok: false, reason: 'storage_unavailable' }; }
  if (!storageResult || storageResult.ok !== true) {
    // 全件成功時のみ metadata write へ進む（1枚でも失敗で fail-closed・自動delete rollbackなし）。
    return _err(502, 'asset_persistence_failed');
  }

  var generatedAtIso = new Date(now).toISOString();
  var carouselAssets = storageResult.assets.map(function (a) {
    return {
      slideIndex: a.slideIndex, slideId: a.slideId,
      width: a.width, height: a.height, aspectRatio: a.aspectRatio,
      format: a.format, storagePath: a.storagePath, sha256: a.sha256, bytes: a.bytes,
      status: 'ready', imageReviewOk: false, generatedAt: generatedAtIso, regenCount: 0,
    };
  });

  // 既存 fields を保持したまま carouselAssets（既存 bare-array 契約・runCarouselImageJobMock/
  //   carouselImageProduction.test.js #20 と同型）＋ carouselAspectRatio を追加する。
  //   nonce/model/generatedAt 等のjob-level provenanceは既存契約を壊さない別キー
  //   （carouselGeneration）へ additive に格納する（slides/caption/cta/hashtags 等は一切変更しない）。
  var mergedFields = Object.assign({}, draftRow.fields || {}, {
    carouselAssets: carouselAssets,
    carouselAspectRatio: plan.aspectRatio,
    carouselGeneration: {
      nonce: nonce, model: client.CAROUSEL_IMAGE_MODEL, quality: plan.quality, generatedAt: generatedAtIso,
    },
  });

  var writeResult;
  try { writeResult = await deps.saveOutputDraftAssets({ caseId: caseId, outputId: outputId, fields: mergedFields }); }
  catch (e) { writeResult = { ok: false, reason: 'asset_metadata_write_failed' }; }
  if (!writeResult || writeResult.ok !== true) {
    // Storage objectは残る（自動削除しない）。ledgerも変更しない。manual recoveryはC-4以降。
    return _err(502, 'asset_metadata_write_failed');
  }

  // published は絶対にここで true へしない。Image生成 ≠ Publishing（Decision 107 EER維持）。
  return { status: 200, body: { ok: true, generated: carouselAssets.length, published: false } };
}

// ══════════════════════════════════════════════════════════════
// GET /api/carousel-image/assets?caseId=&outputId=
// ══════════════════════════════════════════════════════════════
async function handleAssetsRequest(input, deps) {
  var q = input || {};
  var caseId = q.caseId;
  var outputId = q.outputId;
  if (typeof caseId !== 'string' || !caseId) return _err(400, 'invalid_request', 'caseId');
  if (typeof outputId !== 'string' || !outputId) return _err(400, 'invalid_request', 'outputId');

  var draftRow;
  try { draftRow = await deps.loadOutputDraft({ caseId: caseId, outputId: outputId }); }
  catch (e) { return _err(503, 'draft_read_unavailable'); }
  if (!draftRow) return _err(404, 'not_found');

  var scope = core.validateScope({ caseId: caseId, outputId: outputId, draftRow: draftRow });
  if (!scope.ok) return _err(reasonToHttpStatus(scope.reason), scope.reason);

  var fields = draftRow.fields || {};
  var assets = Array.isArray(fields.carouselAssets) ? fields.carouselAssets : [];
  if (assets.length === 0) return _err(404, 'assets_not_ready');

  // client 指定値からStorage pathを組み立てない。canonical Output Draftに登録済みの
  //   storagePathだけをauthorityにし、そのpathが要求scope（caseId/outputId）に属することを
  //   exact prefix一致で server-side validate する（path traversal / foreign output asset拒否）。
  var expectedPrefix = 'carousel/' + caseId + '/' + outputId + '/';
  var expiresIn = Number.isFinite(Number(deps.signedUrlExpiresIn)) ? Number(deps.signedUrlExpiresIn) : 300;
  var results = [];

  for (var i = 0; i < assets.length; i++) {
    var a = assets[i] || {};
    var sp = String(a.storagePath || '');
    if (sp.indexOf(expectedPrefix) !== 0 || sp.indexOf('..') !== -1) {
      return _err(403, 'asset_scope_mismatch');
    }
    var signed;
    try { signed = await deps.createSignedUrl(sp, expiresIn, { client: deps.storageClient }); }
    catch (e) { signed = { ok: false, reason: 'asset_access_failed' }; }
    if (!signed || signed.ok !== true) {
      var reason = (signed && signed.reason) || 'asset_access_failed';
      return _err(reasonToHttpStatus(reason), reason);
    }
    results.push({
      slideIndex: a.slideIndex, slideId: a.slideId,
      width: a.width, height: a.height, aspectRatio: a.aspectRatio,
      sha256: a.sha256, bytes: a.bytes,
      url: signed.url, expiresIn: signed.expiresIn || expiresIn,
    });
  }

  results.sort(function (x, y) { return (Number(x.slideIndex) || 0) - (Number(y.slideIndex) || 0); });
  return { status: 200, body: { ok: true, assets: results } };
}

module.exports = {
  STATUS_BY_REASON: STATUS_BY_REASON,
  reasonToHttpStatus: reasonToHttpStatus,
  peekApprovalTokenScope: peekApprovalTokenScope,
  handleApprovalRequest: handleApprovalRequest,
  handleGenerateRequest: handleGenerateRequest,
  handleAssetsRequest: handleAssetsRequest,
};
