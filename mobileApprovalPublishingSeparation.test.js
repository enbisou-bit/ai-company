'use strict';
// mobileApprovalPublishingSeparation.test.js
// Mobile Approval（画像生成前の文案・構成の承認）と Publishing Ready（画像生成＋Image Review後の公開準備完了）の分離テスト
// API呼び出し0件 / network 0 / DB変更なし / 実AI 0 / 本番案件への操作0
// 判定ロジックをテスト側で再実装しない: index.html から実装関数・定数をそのまま切り出し、vm 上で実行して検証する。
// 外部副作用を持つ関数（pushApprovalToServer / renderOutputEnginePanel / getCurrentApprovalCaseId）だけ記録用 stub に置き換える。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const SRC = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8').replace(/\r\n/g, '\n');

// ──────────────────────────────────────────────────────────────
// 1. 実装の切り出し
// ──────────────────────────────────────────────────────────────
function extractFunction(name) {
  const start = SRC.indexOf('\nfunction ' + name + '(');
  if (start === -1) throw new Error('function not found: ' + name);
  const end = SRC.indexOf('\n}\n', start + 1);
  return SRC.slice(start + 1, end + 2);
}
// トップレベルの var/let/const 宣言を切り出す（vm の context から読み書きできるよう var に揃える）
function extractDecl(name) {
  const m = new RegExp('\\n(?:var|let|const) ' + name + ' = ').exec(SRC);
  if (!m) throw new Error('decl not found: ' + name);
  const start = m.index + 1;
  const lineEnd = SRC.indexOf('\n', start);
  const firstLine = SRC.slice(start, lineEnd);
  let text;
  if (/;\s*(\/\/.*)?$/.test(firstLine)) text = firstLine;
  else {
    const close = /\[\s*$/.test(firstLine) ? '\n];' : '\n};';
    text = SRC.slice(start, SRC.indexOf(close, start) + close.length);
  }
  return text.replace(/^(?:let|const) /, 'var ');
}

const FUNCS = [
  'escapeHtml',
  '_mapReviewApproved', '_mapAllChecked', '_mapDerivedStatus', 'createMobileApprovalDraft', '_mapRerender', 'buildMobileApprovalHtml',
  '_prcResolveStatus', '_prcEvaluateImageReadiness', '_prcCurrentDraft', 'scorePublishingReady',
  '_prcBuildSummary', '_prcBuildSaveMarkdown', 'createPublishingReadyDraft', '_prcRerender', 'markInstagramPublished',
  'buildPublishingReadyHtml', '_prcBuildFullText', 'copyPublishingReadyField',
  'appendPublishingReadyToExportMarkdown', 'appendPublishingReadyToExportJson',
];
const DECLS = [
  'MRC_OVERALL_LABELS', 'MOBILE_APPROVAL_VERSION', 'MAP_SAFETY_LABELS', 'MAP_STATUS_LABELS', 'MAP_CHECKLIST', '_mobileApprovalState',
  'PUBLISHING_READY_VERSION', 'PRC_SAFETY_LABELS', 'PRC_STATUS_LABELS', 'PRC_AXIS_LABELS', '_publishingReadyState',
];

function makeContext() {
  const ctx = {
    _lastOutputDraft: null,
    _approvalSyncLastLocalChangeAt: 0,
    __pushes: [],
    __renders: 0,
    __copied: [],
  };
  vm.createContext(ctx);
  vm.runInContext(DECLS.map(extractDecl).join('\n') + '\n' + FUNCS.map(extractFunction).join('\n'), ctx);
  // 外部副作用のみ stub（network / DOM へ出ない）
  vm.runInContext([
    'function renderOutputEnginePanel() { __renders++; }',
    'function getCurrentApprovalCaseId() { return "case-test"; }',
    'function pushApprovalToServer(caseId, reason) { __pushes.push({ caseId: caseId, reason: reason }); }',
    'function _prcCopyToClipboard(text) { __copied.push(text); }',
  ].join('\n'), ctx);
  return ctx;
}

// ──────────────────────────────────────────────────────────────
// 2. fixture（server 書込み形式の carouselAssets）
//   storagePath / sha256 / TARGET は実装（lib/carouselAssetStorage.js の buildAssetPath・computeSha256・TARGET）で生成し、
//   Output Draft への登録形は lib/carouselImageService.js の carouselAssets mapping と同じ field 構成にする（12-4 で実ソースと照合）。
// ──────────────────────────────────────────────────────────────
const storage = require('./lib/carouselAssetStorage.js');
const N = 8;
function asset(i, ok, over) {
  const pathIdx = (Number.isInteger(i) && i >= 1 && i <= 19) ? i : 1;
  const p = storage.buildAssetPath({ caseId: 'case-test', outputId: 'out-test', nonce: 'nonce1', slideIndex: pathIdx });
  if (!p.ok) throw new Error('buildAssetPath failed');
  // uploadCarouselAsset() が返す asset と同じ構成（slideIndex は Number 化済み）
  const a = {
    slideIndex: i, slideId: 'icb-' + i, storagePath: p.path, sha256: storage.computeSha256(Buffer.from('png-' + i)), bytes: 1000,
    format: 'png', width: storage.TARGET.width, height: storage.TARGET.height, aspectRatio: storage.TARGET.aspectRatio, status: 'ready',
  };
  // lib/carouselImageService.js の carouselAssets mapping と同じ field 構成（imageReviewOk は生成時 false・Image Review で true）
  return Object.assign({
    slideIndex: a.slideIndex, slideId: a.slideId,
    width: a.width, height: a.height, aspectRatio: a.aspectRatio,
    format: a.format, storagePath: a.storagePath, sha256: a.sha256, bytes: a.bytes,
    status: 'ready', imageReviewOk: ok === true, generatedAt: '2026-10-07T00:00:00.000Z', regenCount: 0,
  }, over || {});
}
function allAssets(ok) { const a = []; for (let i = 1; i <= N; i++) a.push(asset(i, ok)); return a; }

function makeOutputDraft(assets) {
  const reviewSlides = [];
  for (let i = 1; i <= N; i++) reviewSlides.push({ slideNumber: i, role: 'r', roleLabel: 'R', headline: 'H' + i, backgroundColor: '#fff', accentColor: '#000', reviewStatus: 'ok' });
  const slides = [];
  for (let i = 1; i <= N; i++) slides.push('【' + i + '枚目】タイトル：T' + i);
  const fields = { slides: slides, caption: 'cap' };
  if (assets !== undefined) fields.carouselAssets = assets;
  return {
    id: 'out-test', caseId: 'case-test', type: 'instagram_carousel', fields: fields,
    mobileReviewCenter: {
      slides: reviewSlides,
      mobileApprovalInput: {
        reviewStatus: 'approved', approvedSlides: reviewSlides.map(function (s) { return s.slideNumber; }), revisionRequests: [],
        hashtags: ['#a', '#b'], designScore: 88, carouselScore: 80, template: { name: 'tpl' },
      },
    },
    publishing: { title: 'title', description: 'caption text', cta: 'cta text', hashtags: ['#a', '#b'] },
    instagramCarouselBuilder: { planningInput: { theme: 'theme', targetAudience: 'aud', benefit: 'b', suggestedCTA: 'c' } },
    instagramDesignSystem: { slides: [] },
  };
}
const NEW_ALL_CHECKED = { caption: true, cta: true, hashtags: true, design: true, slides: true, noRevision: true, copyStructure: true };
function setApproval(ctx, decision, checklist) {
  ctx._mobileApprovalState.decision = decision;
  ctx._mobileApprovalState.approvedAt = decision === 'approved' ? '2026-10-07T00:00:00.000Z' : null;
  ctx._mobileApprovalState.checklist = checklist || {};
}
function prc(ctx, od) { return ctx.createPublishingReadyDraft(od); }
function summaryRow(d, label) { return d.summary.filter(function (r) { return r.label === label; })[0]; }

// ──────────────────────────────────────────────────────────────
// 3. ハーネス
// ──────────────────────────────────────────────────────────────
let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log(`  ✅ ${label}`); }
  else { _failed++; console.log(`  ❌ ${label}`); }
}
function caseHeader(t) { console.log(`\n── ${t} ──`); }

// ──────────────────────────────────────────────────────────────
// 4. ケース
// ──────────────────────────────────────────────────────────────
caseHeader('1. 未承認 → draft・公開準備未完了');
{
  const ctx = makeContext();
  setApproval(ctx, null, {});
  const d = prc(ctx, makeOutputDraft(allAssets(true)));
  assert(d.publishingStatus === 'draft', '1-1. publishingStatus=draft（全画像OKでも未承認なら ready にならない）');
  assert(d.publishReady === false, '1-2. publishReady=false');
  assert(d.canPublish === false, '1-3. canPublish=false（既存条件）');
  assert(summaryRow(d, 'Instagram Ready').ok === false, '1-4. Instagram Ready ✓ にならない');
}

caseHeader('2. 承認済み・画像なし → preparing（Mobile Approvalだけで公開準備完了にならない）');
{
  const ctx = makeContext();
  setApproval(ctx, 'approved', NEW_ALL_CHECKED);
  [undefined, []].forEach(function (assets, k) {
    const d = prc(ctx, makeOutputDraft(assets));
    const tag = assets === undefined ? '(field無し)' : '(空配列)';
    assert(d.publishingStatus === 'preparing', '2-' + k + 'a. ' + tag + ' publishingStatus=preparing');
    assert(d.publishReady === false && d.imageReadiness.reason === 'not_generated', '2-' + k + 'b. ' + tag + ' publishReady=false / reason=not_generated');
    assert(d.canPublish === true, '2-' + k + 'c. ' + tag + ' canPublish=true のまま（手動投稿記録の条件は無変更）');
    assert(summaryRow(d, 'Instagram Ready').ok === false && summaryRow(d, 'Instagram Ready').value.indexOf('画像確認待ち') !== -1, '2-' + k + 'd. ' + tag + ' Instagram Ready は未完了表示');
    assert(d.postingChecklist[0].done === false && d.postingChecklist[1].done === false, '2-' + k + 'e. ' + tag + ' 画像生成・Image Review チェックは未完了');
    assert(d.warnings.some(function (w) { return w.indexOf('公開準備は未完了') !== -1; }), '2-' + k + 'f. ' + tag + ' 公開準備未完了の警告を表示');
  });
  const od = makeOutputDraft([]);
  const html = ctx.buildPublishingReadyHtml(od);
  assert(html.indexOf('>Preparing<') !== -1 && html.indexOf('>Ready<') === -1, '2-2. HTMLのstatus chipが Preparing（Readyではない）');
  assert(html.indexOf('公開準備は未完了です（画像の生成またはImage Reviewが未完了）') !== -1, '2-3. 投稿記録ボタン横に公開準備未完了を明示');
  assert(html.indexOf('文案・構成段階の指標') !== -1, '2-4. 準備度スコアは文案・構成段階の指標と表示');
}

caseHeader('3. 画像不足／重複／無効asset → 完了扱いにしない');
{
  const ctx = makeContext();
  setApproval(ctx, 'approved', NEW_ALL_CHECKED);
  function check(label, assets, reason) {
    const r = ctx._prcEvaluateImageReadiness(makeOutputDraft(assets).fields);
    const d = prc(ctx, makeOutputDraft(assets));
    assert(r.generated === false && r.reviewed === false && r.reason === reason && d.publishingStatus === 'preparing' && d.publishReady === false,
      label + ' → reason=' + reason + ' / preparing');
  }
  check('3-1. 不足（7/8・全OK）', allAssets(true).slice(0, N - 1), 'count_mismatch');
  check('3-2. 欠落（slide 8 の代わりに slide 7 が重複）', allAssets(true).slice(0, N - 1).concat([asset(7, true)]), 'duplicate_slide');
  check('3-3. 余剰（9件・slide 1 重複）', allAssets(true).concat([asset(1, true)]), 'duplicate_slide');
  check('3-4. 範囲外 slideIndex=9', allAssets(true).slice(0, N - 1).concat([asset(9, true)]), 'invalid_asset');
  check('3-5. slideIndex=0', [asset(0, true)].concat(allAssets(true).slice(1)), 'invalid_asset');
  check('3-6. slideIndex が文字列 "1"', [asset('1', true)].concat(allAssets(true).slice(1)), 'invalid_asset');
  check('3-7. slideIndex 小数 1.5', [asset(1.5, true)].concat(allAssets(true).slice(1)), 'invalid_asset');
  check('3-8. 空 asset（null）', [null].concat(allAssets(true).slice(1)), 'invalid_asset');
  check('3-9. 空 asset（{}）', [{}].concat(allAssets(true).slice(1)), 'invalid_asset');
  check('3-10. storagePath 欠落', [asset(1, true, { storagePath: '' })].concat(allAssets(true).slice(1)), 'invalid_asset');
  check('3-11. sha256 欠落', [asset(1, true, { sha256: undefined })].concat(allAssets(true).slice(1)), 'invalid_asset');
  ['error', 'pending', 'generating', 'stale', undefined].forEach(function (st, k) {
    check('3-12' + String.fromCharCode(97 + k) + '. status=' + String(st), [asset(1, true, { status: st })].concat(allAssets(true).slice(1)), 'asset_not_ready');
  });
  const r0 = ctx._prcEvaluateImageReadiness({ slides: [], carouselAssets: allAssets(true) });
  assert(r0.reason === 'no_slides' && r0.reviewed === false, '3-14. slides 0件 → no_slides・完了扱いにしない');
}

caseHeader('4. 一部未OK → preparing');
{
  const ctx = makeContext();
  setApproval(ctx, 'approved', NEW_ALL_CHECKED);
  const a = allAssets(true); a[4] = asset(5, false);
  const d = prc(ctx, makeOutputDraft(a));
  assert(d.imageReadiness.generated === true && d.imageReadiness.reviewed === false && d.imageReadiness.okCount === N - 1, '4-1. generated=true / reviewed=false / okCount=7');
  assert(d.publishingStatus === 'preparing' && d.publishReady === false, '4-2. preparing・publishReady=false');
  assert(d.postingChecklist[0].done === true && d.postingChecklist[1].done === false, '4-3. 生成=完了・Image Review=未完了');
  assert(summaryRow(d, 'Images').value === 'Image Review 7 / 8', '4-4. Images 要約が 7 / 8');
  const b = allAssets(true); b[0] = asset(1, 'true');
  assert(ctx._prcEvaluateImageReadiness(makeOutputDraft(b).fields).reviewed === false, '4-5. imageReviewOk="true"（文字列）は OK として数えない（厳密 true のみ）');
  const c = allAssets(true); c[0] = asset(1, 1);
  assert(ctx._prcEvaluateImageReadiness(makeOutputDraft(c).fields).reviewed === false, '4-6. imageReviewOk=1 は OK として数えない');
}

caseHeader('5. 全画像OK → ready（承認済み＋全画像Image Review完了）');
{
  const ctx = makeContext();
  setApproval(ctx, 'approved', NEW_ALL_CHECKED);
  const shuffled = allAssets(true).reverse();   // 並び順に依存しない
  const d = prc(ctx, makeOutputDraft(shuffled));
  assert(d.publishingStatus === 'ready' && d.publishReady === true, '5-1. publishingStatus=ready・publishReady=true');
  assert(summaryRow(d, 'Instagram Ready').ok === true && summaryRow(d, 'Instagram Ready').value === '✓ 公開準備完了', '5-2. Instagram Ready ✓ 公開準備完了');
  assert(summaryRow(d, 'Images').ok === true, '5-3. Images ✓ 全画像OK');
  assert(d.postingChecklist[0].done === true && d.postingChecklist[1].done === true, '5-4. 画像生成・Image Review チェック完了');
  assert(!d.warnings.some(function (w) { return w.indexOf('公開準備は未完了') !== -1; }), '5-5. 公開準備未完了の警告なし');
  const html = ctx.buildPublishingReadyHtml(makeOutputDraft(allAssets(true)));
  assert(html.indexOf('>Ready<') !== -1 && html.indexOf('公開準備は未完了です') === -1, '5-6. HTMLは Ready・未完了注記なし');
  // 署名URL（期限付き・メモリのみ）や compositeUrl/bgUrl を持たない server 形式でも判定できる＝URL期限切れを画像消失と判定しない
  assert(allAssets(true).every(function (x) { return !('compositeUrl' in x) && !('url' in x); }) && d.imageReadiness.reviewed === true,
    '5-7. 判定は保存済みメタデータのみ（URLを持たない asset でも ready）');
}

caseHeader('6. published／archived は既存の優先順位を維持');
{
  const ctx = makeContext();
  setApproval(ctx, 'approved', NEW_ALL_CHECKED);
  ctx._publishingReadyState.published = true; ctx._publishingReadyState.publishedAt = '2026-10-07T01:00:00.000Z';
  assert(prc(ctx, makeOutputDraft([])).publishingStatus === 'published', '6-1. 画像なしでも published 記録は published のまま');
  assert(prc(ctx, makeOutputDraft(allAssets(true))).publishingStatus === 'published', '6-2. 全画像OKでも published が ready より優先');
  ctx._publishingReadyState.archived = true;
  assert(prc(ctx, makeOutputDraft([])).publishingStatus === 'archived', '6-3. archived が最優先');
  setApproval(ctx, null, {});
  assert(ctx._prcResolveStatus('draft', true) === 'archived', '6-4. 未承認でも archived 記録は archived（既存順）');
}

caseHeader('7. 旧 checklist.ready が残る承認済みデータ');
{
  const ctx = makeContext();
  const OLD = { caption: true, cta: true, hashtags: true, design: true, slides: true, noRevision: true, ready: true };
  setApproval(ctx, 'approved', Object.assign({}, OLD));
  const od = makeOutputDraft([]);
  const ma = ctx.createMobileApprovalDraft(od);
  assert(ma.approvalStatus === 'approved', '7-1. 既存の承認済み状態は維持（decision 優先）');
  assert(ma.checklist.every(function (c) { return c.key !== 'ready'; }), '7-2. チェック項目に旧 ready（投稿準備完了）を表示しない');
  const cs = ma.checklist.filter(function (c) { return c.key === 'copyStructure'; })[0];
  assert(cs && cs.checked === false, '7-3. 新項目 copyStructure は自動チェックされない');
  assert(ctx._mobileApprovalState.checklist.ready === true && !('copyStructure' in ctx._mobileApprovalState.checklist), '7-4. 旧 checklist.ready は書き換えず・自動移行しない');
  od.mobileApproval = ma;
  const d = prc(ctx, od);
  assert(d.publishingStatus === 'preparing' && d.publishReady === false, '7-5. 旧承認でも画像未確認なら preparing');
  assert(d.canPublish === true, '7-6. 旧承認の canPublish は維持');
  // 未承認状態で旧キーだけが残っていても、新項目の代わりにはならない
  setApproval(ctx, null, Object.assign({}, OLD));
  assert(ctx._mapAllChecked() === false, '7-7. 旧 ready=true は copyStructure を満たさない（_mapAllChecked=false）');
  assert(ctx.createMobileApprovalDraft(makeOutputDraft([])).canApprove === false, '7-8. 旧キーのみでは canApprove=false');
  setApproval(ctx, null, Object.assign({}, NEW_ALL_CHECKED));
  assert(ctx.createMobileApprovalDraft(makeOutputDraft([])).canApprove === true, '7-9. 新7項目すべてで canApprove=true（必須数は7のまま）');
}

caseHeader('8. Mobile Approval だけで公開準備完了にならない（表示）');
{
  const ctx = makeContext();
  setApproval(ctx, 'approved', NEW_ALL_CHECKED);
  const od = makeOutputDraft([]);
  const html = ctx.buildMobileApprovalHtml(od);
  assert(html.indexOf('投稿準備完了') === -1, '8-1. Mobile Approval HTML に「投稿準備完了」が無い');
  assert(html.indexOf('文案・構成 承認済み') !== -1 && html.indexOf('実画像は未生成・未確認') !== -1, '8-2. 文案・構成の承認であり実画像は未確認と明示');
  assert(html.indexOf('Publishing Ready）') === -1, '8-3. 承認ボタンに「承認済み（Publishing Ready）」を表示しない');
  assert(ctx.MAP_CHECKLIST.length === 7 && ctx.MAP_CHECKLIST.some(function (c) { return c.key === 'copyStructure'; })
    && !ctx.MAP_CHECKLIST.some(function (c) { return c.key === 'ready' || c.label.indexOf('投稿準備完了') !== -1; }), '8-4. MAP_CHECKLIST は7項目・ready/投稿準備完了なし');
  assert(od.mobileApproval.publishingReadyInput.approvalStatus === 'approved', '8-5. publishingReadyInput の構造・引き渡しは維持');
  assert(prc(ctx, od).publishingStatus !== 'ready', '8-6. Publishing Ready は ready に到達しない');
}

caseHeader('9. markInstagramPublished（実装関数・条件無変更）');
{
  const ctx = makeContext();
  setApproval(ctx, null, {});
  ctx._lastOutputDraft = makeOutputDraft([]);
  ctx.markInstagramPublished();
  assert(ctx._publishingReadyState.published === false && ctx.__pushes.length === 0, '9-1. 未承認では記録しない（既存 hard guard）');
  setApproval(ctx, 'approved', NEW_ALL_CHECKED);
  ctx._lastOutputDraft = makeOutputDraft([]);
  ctx.markInstagramPublished();
  assert(ctx._publishingReadyState.published === true && ctx.__pushes.length === 1 && ctx.__pushes[0].reason === 'publish',
    '9-2. 承認済みなら画像未確認でも Human の投稿事実を記録できる（条件無変更）');
  const body = extractFunction('markInstagramPublished');
  assert(body.indexOf('if (!approved) return;') !== -1 && body.indexOf('imageReadiness') === -1 && body.indexOf('imageReviewOk') === -1,
    '9-3. markInstagramPublished に画像条件を追加していない');
  assert(SRC.indexOf("    canPublish: approvalStatus === 'approved',") !== -1, '9-4. canPublish の条件式は無変更');
}

caseHeader('10. 全画像OK→一部NG 後、描画を経ずに出力しても古い ready を出さない');
{
  const ctx = makeContext();
  setApproval(ctx, 'approved', NEW_ALL_CHECKED);
  const od = makeOutputDraft(allAssets(true));
  ctx._lastOutputDraft = od;
  ctx.buildPublishingReadyHtml(od);
  assert(od.publishingReady.publishingStatus === 'ready', '10-1. 全OKで描画 → 描画キャッシュ=ready');
  // Image Review で slide 3 を NG 保存（既存 _irSaveReview は _lastOutputDraft.fields だけ置き換え、Publishing Ready は描画しない）
  od.fields = Object.assign({}, od.fields, { carouselAssets: od.fields.carouselAssets.map(function (a) { return a.slideIndex === 3 ? Object.assign({}, a, { imageReviewOk: false }) : a; }) });
  assert(od.publishingReady.publishingStatus === 'ready', '10-2. （前提）描画していないので描画キャッシュは古い ready のまま');

  ctx.__copied.length = 0;
  ctx.copyPublishingReadyField('full');
  ctx.copyPublishingReadyField('markdown');
  ctx.copyPublishingReadyField('json');
  assert(ctx.__copied.length === 3, '10-3. コピー3種が実行された');
  assert(ctx.__copied[0].indexOf('Status: Preparing') !== -1 && ctx.__copied[0].indexOf('Status: Ready') === -1, '10-4. コピー（Full Package）は Preparing・Ready を出さない');
  assert(ctx.__copied[1].indexOf('Status: Preparing') !== -1 && ctx.__copied[1].indexOf('Status: Ready') === -1, '10-5. コピー（Markdown）は Preparing');
  const cj = JSON.parse(ctx.__copied[2]);
  assert(cj.publishingStatus === 'preparing', '10-6. コピー（JSON）の publishingStatus=preparing');

  const lines = [];
  ctx.appendPublishingReadyToExportMarkdown(lines);
  const md = lines.join('\n');
  assert(md.indexOf('Publishing Status: Preparing') !== -1 && md.indexOf('Publishing Status: Ready') === -1, '10-7. Export Markdown は Preparing');
  const payload = {};
  ctx.appendPublishingReadyToExportJson(payload);
  const ir = payload.publishingReady.summary.filter(function (r) { return r.label === 'Instagram Ready'; })[0];
  assert(payload.publishingReady.publishingStatus === 'preparing' && ir.ok === false, '10-8. Export JSON は preparing・Instagram Ready 未完了');
  assert(payload.publishingReady.postingChecklist[1].done === false, '10-9. Export JSON の Image Review チェックは未完了');
  assert(od.publishingReady.publishingStatus === 'ready', '10-10. 出力経路は描画キャッシュを書き換えない（読み取りのみ）が、キャッシュ値も使わない');

  const html = ctx.buildPublishingReadyHtml(od);
  assert(html.indexOf('>Preparing<') !== -1 && od.publishingReady.publishingStatus === 'preparing', '10-11. 次の描画は preparing');
}

caseHeader('10b. 承認取消後に古い承認キャッシュで ready を出さない');
{
  const ctx = makeContext();
  setApproval(ctx, 'approved', NEW_ALL_CHECKED);
  const od = makeOutputDraft(allAssets(true));
  ctx._lastOutputDraft = od;
  od.mobileApproval = ctx.createMobileApprovalDraft(od);       // 承認済みの Mobile Approval キャッシュ
  ctx.buildPublishingReadyHtml(od);
  assert(od.publishingReady.publishingStatus === 'ready', '10b-1. 承認済み＋全画像OK → ready');
  setApproval(ctx, null, NEW_ALL_CHECKED);                      // 取消（キャッシュは再計算されていない状態を想定）
  const payload = {};
  ctx.appendPublishingReadyToExportJson(payload);
  assert(payload.publishingReady.publishingStatus !== 'ready', '10b-2. 承認の正本（decision）が未承認なら、古い承認キャッシュがあっても ready を出さない');
  assert(od.mobileApproval.approvalStatus === 'approved', '10b-3. Mobile Approval キャッシュ自体は書き換えない');
}

caseHeader('10c. 全利用箇所が現在状態からの判定を使う（静的）');
{
  ['copyPublishingReadyField', 'appendPublishingReadyToExportMarkdown', 'appendPublishingReadyToExportJson', 'buildPublishingReadyHtml',
    'createInstagramLearningDraft', 'createAssetLibrarySaveDraft'].forEach(function (name) {
    const body = extractFunction(name);
    assert(body.indexOf('_prcCurrentDraft(') !== -1 && body.indexOf('publishingReady ||') === -1,
      '10c. ' + name + ' は _prcCurrentDraft を使い、描画キャッシュ（publishingReady ||）を判定に使わない');
  });
  assert(!/\.publishingReady\s*\|\|/.test(SRC), '10c-2. index.html 全体に「publishingReady ||」のキャッシュ優先経路が残っていない');
}

caseHeader('10d. 承認後の画像状態の文言は現在の画像状態に追従（固定の「未生成」を残さない）');
{
  const ctx = makeContext();
  setApproval(ctx, 'approved', NEW_ALL_CHECKED);
  const none = ctx.buildMobileApprovalHtml(makeOutputDraft([]));
  assert(none.indexOf('実画像は未生成・未確認') !== -1 && none.indexOf('次は Carousel Image Production') !== -1, '10d-1. 画像なし → 未生成・未確認／次は Carousel Image Production');
  const a = allAssets(false); a[0] = asset(1, true);
  const gen = ctx.buildMobileApprovalHtml(makeOutputDraft(a));
  assert(gen.indexOf('未生成') === -1 && gen.indexOf('Image Review未完了です（OK 1 / 8）') !== -1 && gen.indexOf('次は Image Review') !== -1, '10d-2. 生成済み・一部OK → 「未生成」なし・Image Review未完了');
  const all = ctx.buildMobileApprovalHtml(makeOutputDraft(allAssets(true)));
  assert(all.indexOf('未生成') === -1 && all.indexOf('全8枚OK') !== -1 && all.indexOf('未完了') === -1, '10d-3. 全画像OK → 「未生成」「未完了」なし');
  const bad = ctx.buildMobileApprovalHtml(makeOutputDraft(allAssets(true).slice(0, 5)));
  assert(bad.indexOf('未生成') === -1 && bad.indexOf('不完全') !== -1, '10d-4. 画像不足 → 不完全と表示（未生成とは言わない）');
  // 同じ outputDraft で状態だけ変わっても追従する（Mobile Approval キャッシュの有無に依存しない）
  const od = makeOutputDraft([]);
  ctx.buildMobileApprovalHtml(od);
  od.fields = Object.assign({}, od.fields, { carouselAssets: allAssets(true) });
  const after = ctx.buildMobileApprovalHtml(od);
  assert(after.indexOf('未生成') === -1 && after.indexOf('全8枚OK') !== -1, '10d-5. キャッシュ済み Mobile Approval でも画像状態の文言は追従');
}

caseHeader('11. quote／produce の承認境界は checklist に依存しない（shared 実装）');
{
  const core = require('./shared/carouselImageCore.js');
  const oldRow = { approval_decision: 'approved', checklist: { ready: true }, published: false };
  const newRow = { approval_decision: 'approved', checklist: { copyStructure: true }, published: false };
  const noKey = { approval_decision: 'approved', checklist: {}, published: false };
  assert(core.validateApproval(oldRow).ok && core.validateApproval(newRow).ok && core.validateApproval(noKey).ok, '11-1. approval_decision=approved なら checklist の中身に関係なく承認扱い');
  assert(core.validateApproval({ approval_decision: null, checklist: { copyStructure: true } }).reason === 'not_approved', '11-2. 未承認は checklist があっても not_approved');
  assert(core.validateNotPublished({ approval_decision: 'approved', published: true }).reason === 'already_published', '11-3. published は既存どおり拒否');
}

caseHeader('12. 静的境界');
{
  assert(/var canApprove = _mapAllChecked\(\) && _mapReviewApproved\(mai\) && !_mapCompliance\.blocked;/.test(SRC), '12-1. canApprove 算出は無変更');
  const ev = extractFunction('_prcEvaluateImageReadiness');
  assert(!/_irState|urls|fetch\(|localStorage/.test(ev.replace(/^\s*\/\/.*$/gm, '')), '12-2. 画像判定は署名URL・network・localStorage を参照しない');
  assert(!/\.\s*(imageReviewOk|status|storagePath|sha256|slideIndex)\s*=(?!=)/.test(ev), '12-3. 画像判定は asset を書き換えない');
  // fixture の field 構成が server 実装の carouselAssets mapping と一致すること（fixture だけで成立していないことの根拠）
  const svc = fs.readFileSync(path.join(__dirname, 'lib', 'carouselImageService.js'), 'utf8').replace(/\r\n/g, '\n');
  const ms = svc.indexOf('var carouselAssets = storageResult.assets.map(function (a) {');
  const mapping = svc.slice(ms, svc.indexOf('});', ms));
  const libKeys = (mapping.match(/(\w+):/g) || []).map(function (k) { return k.slice(0, -1); }).sort();
  const fixtureKeys = Object.keys(asset(1, false)).sort();
  assert(ms !== -1 && JSON.stringify(libKeys) === JSON.stringify(fixtureKeys), '12-4. fixture の field 構成 = lib/carouselImageService.js の carouselAssets mapping（' + libKeys.join(',') + '）');
  assert(/status: 'ready', imageReviewOk: false/.test(mapping), '12-5. server は status=ready・imageReviewOk=false で登録する（判定の前提と一致）');
  const st = fs.readFileSync(path.join(__dirname, 'lib', 'carouselAssetStorage.js'), 'utf8');
  assert(st.indexOf('slideIndex: Number(inp.slideIndex),') !== -1, '12-6. storage asset の slideIndex は Number 化済み（整数判定の前提と一致）');
  // 実装の storagePath 形式（carousel/<caseId>/<outputId>/<nonce>/slide-<N>.png）を使っても判定が成立する
  assert(/^carousel\/case-test\/out-test\/nonce1\/slide-1\.png$/.test(asset(1, true).storagePath)
    && /^[0-9a-f]{64}$/.test(asset(1, true).sha256), '12-7. fixture の storagePath / sha256 は実装関数で生成した実形式');
  // 既存の Image Review 保存は imageReviewOk だけを変更する（他 field を変えない）＝判定に必要な field は保存後も残る
  assert(SRC.indexOf("return Object.assign({}, a, { imageReviewOk: ok === true });") !== -1, '12-8. Image Review 保存は imageReviewOk のみ変更（status/storagePath/sha256/slideIndex を保持）');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All Mobile Approval / Publishing Ready separation cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
