'use strict';
// apfrApprovalEnforcement.test.js
// APFR Step C-1C-2b-1: Mobile Approval Enforcement 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / 本番案件への操作0
// index.html内の _apfrEvaluateMobileApprovalCompliance() / canApprove算出 / approveInstagramPackage()の
// submit直前再評価と等価なロジックをNode環境で再現して検証する（既存apfr*.test.jsと同一パターン）。
// あわせて実ソース（index.html）へのstatic検証を行い、
//   ・Enforcementが _apfrEvaluateComplianceAssessment() を唯一の判定源としていること（detector再実装0）
//   ・Publishing Ready / markInstagramPublished / OUTPUT_STATUS.READY / Quality Gate /
//     accountCreationReadiness / Executive Decision / server.js が無変更であること
// を確認する。

const fs = require('fs');
const path = require('path');
const indexHtmlPath = path.join(__dirname, 'index.html');

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック
// ──────────────────────────────────────────────────────────────

// C-1C-2a Assessment のstubは作らず、statusを直接与えて Enforcement の変換だけを検証する
//   （Assessment自体のロジックは apfrComplianceAssessment.test.js 84/84 で検証済み・二重検証しない）。
function makeAssessment(status, blockers, unchecked) {
  return {
    executed: status !== 'not_checked' || (blockers || []).length > 0,
    status: status,
    blockers: blockers || [],
    unchecked: unchecked || [],
  };
}

// index.htmlの _apfrEvaluateMobileApprovalCompliance() と等価
//   （_apfrCurrentAdoptedProduct / _apfrBuildComplianceContext / _apfrEvaluateComplianceAssessment を注入して再現）
function _apfrEvaluateMobileApprovalCompliance(env) {
  var NOT_BLOCKED = { evaluated: false, blocked: false, status: 'not_checked', blockers: [], unchecked: [] };
  try {
    if (typeof env.currentAdoptedProduct !== 'function'
      || typeof env.buildComplianceContext !== 'function'
      || typeof env.evaluateComplianceAssessment !== 'function') return NOT_BLOCKED;

    var product = env.currentAdoptedProduct();
    var complianceContext = product ? env.buildComplianceContext(product) : {};

    var assessment = env.evaluateComplianceAssessment(env.lastOutputDraft, complianceContext);
    var status = (assessment && typeof assessment.status === 'string') ? assessment.status : 'not_checked';

    return {
      evaluated: !!(assessment && assessment.executed),
      blocked: status === 'blocked',
      status: status,
      blockers: (assessment && Array.isArray(assessment.blockers)) ? assessment.blockers : [],
      unchecked: (assessment && Array.isArray(assessment.unchecked)) ? assessment.unchecked : [],
    };
  } catch (e) {
    return NOT_BLOCKED;
  }
}

// index.htmlの canApprove 算出と等価
function computeCanApprove(allChecked, reviewApproved, compliance) {
  return allChecked && reviewApproved && !compliance.blocked;
}

// index.htmlの approveInstagramPackage() と等価（submit直前再評価つき）
function approveInstagramPackage(state, env, allChecked, reviewApproved) {
  var pushed = [];
  var compliance = _apfrEvaluateMobileApprovalCompliance(env);
  if (compliance.blocked) {
    state.approveBlocked = true;      // decision・approvedAtは変更しない
    return { pushed: pushed, rerendered: true, complianceBlocked: true };
  }
  if (allChecked && reviewApproved) {
    state.decision = 'approved';
    state.approvedAt = '2026-08-27T00:00:00.000Z';
    state.approveBlocked = false;
  } else {
    state.approveBlocked = true;
  }
  pushed.push('approve');
  return { pushed: pushed, rerendered: true, complianceBlocked: false };
}

// 下流（既存ロジック・本工程で変更していないことの再現確認用）
function mapDerivedStatus(state, allChecked, reviewApproved) {
  if (state.decision === 'approved') return 'approved';
  if (state.decision === 'rejected') return 'rejected';
  if (allChecked && reviewApproved) return 'ready';
  return 'draft';
}
function prcResolveStatus(approvalStatus, published, archived) {
  if (archived) return 'archived';
  if (published) return 'published';
  if (approvalStatus === 'approved') return 'ready';
  if (approvalStatus === 'ready') return 'preparing';
  return 'draft';
}
function markInstagramPublished(state, approvalStatus) {
  var approved = approvalStatus === 'approved';
  if (!approved) return { executed: false };
  return { executed: true };
}

// テスト用env生成
function makeEnv(assessmentStatus, opts) {
  opts = opts || {};
  return {
    lastOutputDraft: opts.draft !== undefined ? opts.draft : { fields: { caption: 'x' } },
    currentAdoptedProduct: opts.noProduct ? function () { return null; } : function () { return { productIdentifier: 'p', caseId: 'case-1' }; },
    buildComplianceContext: function () { return opts.ctx || { listingNgWords: ['商品名'], advertisingDisclosureRequirements: ['開示'] }; },
    evaluateComplianceAssessment: opts.throwOnAssess
      ? function () { throw new Error('boom'); }
      : function () { return makeAssessment(assessmentStatus, opts.blockers, opts.unchecked); },
  };
}

// ──────────────────────────────────────────────────────────────
// 2. テストハーネス
// ──────────────────────────────────────────────────────────────
let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log(`  ✅ ${label}`); }
  else { _failed++; console.log(`  ❌ ${label}`); }
}
function caseHeader(t) { console.log(`\n── ${t} ──`); }

const NG_BLOCKER = [{ type: 'listing_ng_words', label: 'リスティングNGワード違反', detail: '禁止語違反：1件' }];
const AD_BLOCKER = [{ type: 'advertising_disclosure', label: '広告開示マーカー不足', detail: '広告開示マーカーが確認できません' }];

// ──────────────────────────────────────────────────────────────
// 3. canApprove Contract（1〜8）
// ──────────────────────────────────────────────────────────────

caseHeader('1. Assessment clear + checklist/review OK → canApprove=true');
{
  const c = _apfrEvaluateMobileApprovalCompliance(makeEnv('clear'));
  assert(c.blocked === false, '1-1. compliance.blocked=false');
  assert(computeCanApprove(true, true, c) === true, '1-2. canApprove=true');
}

caseHeader('2. blocked / listing violation → canApprove=false');
{
  const c = _apfrEvaluateMobileApprovalCompliance(makeEnv('blocked', { blockers: NG_BLOCKER }));
  assert(c.blocked === true, '2-1. compliance.blocked=true');
  assert(computeCanApprove(true, true, c) === false, '2-2. canApprove=false（他条件が揃っていても承認不可）');
  assert(c.blockers[0].type === 'listing_ng_words', '2-3. blocker typeがlisting_ng_words');
}

caseHeader('3. blocked / disclosure missing → canApprove=false');
{
  const c = _apfrEvaluateMobileApprovalCompliance(makeEnv('blocked', { blockers: AD_BLOCKER }));
  assert(c.blocked === true, '3-1. compliance.blocked=true');
  assert(computeCanApprove(true, true, c) === false, '3-2. canApprove=false');
  assert(c.blockers[0].type === 'advertising_disclosure', '3-3. blocker typeがadvertising_disclosure');
}

caseHeader('4. not_checked → canApproveは既存条件のみで決定（fail-open）');
{
  const c = _apfrEvaluateMobileApprovalCompliance(makeEnv('not_checked', { unchecked: ['listing_ng_words', 'advertising_disclosure'] }));
  assert(c.blocked === false, '4-1. not_checkedではblocked=false（fail-open）');
  assert(computeCanApprove(true, true, c) === true, '4-2. 既存条件が揃えばcanApprove=true');
  assert(computeCanApprove(false, true, c) === false, '4-3. 既存条件が欠ければcanApprove=false（Complianceは関与しない）');
  assert(c.unchecked.length === 2, '4-4. unchecked項目は保持される');
}

caseHeader('5. blocked→clear修正後 → Approval復旧');
{
  const before = _apfrEvaluateMobileApprovalCompliance(makeEnv('blocked', { blockers: AD_BLOCKER }));
  assert(computeCanApprove(true, true, before) === false, '5-1. 修正前はcanApprove=false');
  const after = _apfrEvaluateMobileApprovalCompliance(makeEnv('clear'));
  assert(computeCanApprove(true, true, after) === true, '5-2. 修正後（clear）は自動的にcanApprove=trueへ復旧（override不要）');
}

caseHeader('6. 描画時clear → submit直前blocked → approveInstagramPackage()拒否（stale防止）');
{
  const state = { decision: null, approvedAt: null, approveBlocked: false };
  // 描画時: clear
  const drawTime = _apfrEvaluateMobileApprovalCompliance(makeEnv('clear'));
  assert(computeCanApprove(true, true, drawTime) === true, '6-1. 描画時点ではcanApprove=true');
  // submit直前: blocked へ転じた
  const r = approveInstagramPackage(state, makeEnv('blocked', { blockers: AD_BLOCKER }), true, true);
  assert(r.complianceBlocked === true, '6-2. submit直前再評価でblockedを検出し拒否');
  assert(state.decision !== 'approved', '6-3. decisionは"approved"へ変更されない');
  assert(state.approvedAt === null, '6-4. approvedAtは変更されない（既存state破壊なし）');
  assert(r.pushed.length === 0, '6-5. pushApprovalToServer()へ進まない');
  assert(state.approveBlocked === true, '6-6. approveBlocked=trueで理由表示される');
}

caseHeader('7. checklist未完了 + clear → 既存理由でblock');
{
  const state = { decision: null, approvedAt: null, approveBlocked: false };
  const r = approveInstagramPackage(state, makeEnv('clear'), false, true);
  assert(r.complianceBlocked === false, '7-1. Compliance理由ではない');
  assert(state.decision !== 'approved', '7-2. 承認されない（既存checklist条件）');
  assert(state.approveBlocked === true, '7-3. 既存のapproveBlocked経路で処理される');
  assert(r.pushed.length === 1, '7-4. 既存挙動どおりpushは実行される（Compliance blockedとは挙動が異なる）');
}

caseHeader('8. review未承認 + clear → 既存理由でblock');
{
  const state = { decision: null, approvedAt: null, approveBlocked: false };
  const r = approveInstagramPackage(state, makeEnv('clear'), true, false);
  assert(r.complianceBlocked === false, '8-1. Compliance理由ではない');
  assert(state.decision !== 'approved', '8-2. 承認されない（既存reviewStatus条件）');
}

// ──────────────────────────────────────────────────────────────
// 4. fail-open / scope（9〜11）
// ──────────────────────────────────────────────────────────────

caseHeader('9-10. Cross-case / Cross-product混入0（product=nullならnot_checked・誤ブロックしない）');
{
  const c = _apfrEvaluateMobileApprovalCompliance(makeEnv('not_checked', { noProduct: true }));
  assert(c.blocked === false, '9-1. 採用商品なし／別案件切替時はblocked=false（Compliance理由で誤ブロックしない）');
  assert(computeCanApprove(true, true, c) === true, '10-1. 既存条件のみで承認可能（scope guardは既存関数へ委譲）');
}

caseHeader('11. Assessment例外時 → fail-open（blockedを詐称しない）');
{
  let threw = false; let c;
  try { c = _apfrEvaluateMobileApprovalCompliance(makeEnv('clear', { throwOnAssess: true })); } catch (e) { threw = true; }
  assert(threw === false, '11-1. 例外を外へ伝播させない');
  assert(c && c.blocked === false, '11-2. 例外時はblocked=false（既存承認動作を壊さない）');
  assert(c && c.status === 'not_checked', '11-3. status=not_checked');
}

// ──────────────────────────────────────────────────────────────
// 5. 下流自動追従（12〜14）
// ──────────────────────────────────────────────────────────────

caseHeader('12-13. Publishing Ready / markInstagramPublished が自動追従（独立guard不要）');
{
  const state = { decision: null, approvedAt: null, approveBlocked: false };
  approveInstagramPackage(state, makeEnv('blocked', { blockers: AD_BLOCKER }), true, true);
  const approvalStatus = mapDerivedStatus(state, true, true);
  assert(approvalStatus !== 'approved', '12-1. approvalStatusがapprovedにならない');
  assert(prcResolveStatus(approvalStatus, false, false) !== 'ready', '12-2. Publishing Readyが"ready"へ到達しない（既存ロジックで自動追従）');
  assert(markInstagramPublished(state, approvalStatus).executed === false, '13-1. markInstagramPublished()が実行されない（既存hard guardで自動）');
}

caseHeader('14. clear時は下流が正常に到達する（過剰ブロックしていない）');
{
  const state = { decision: null, approvedAt: null, approveBlocked: false };
  approveInstagramPackage(state, makeEnv('clear'), true, true);
  const approvalStatus = mapDerivedStatus(state, true, true);
  assert(approvalStatus === 'approved', '14-1. clear時はapprovalStatus=approved');
  assert(prcResolveStatus(approvalStatus, false, false) === 'ready', '14-2. Publishing Ready=ready');
  assert(markInstagramPublished(state, approvalStatus).executed === true, '14-3. markInstagramPublished()実行可能');
}

// ──────────────────────────────────────────────────────────────
// 6. static検証（実ソースindex.html）
// ──────────────────────────────────────────────────────────────

caseHeader('15-18. Assessment唯一判定源・detector再実装0（実ソースstatic検証）');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function _apfrEvaluateMobileApprovalCompliance(');
  assert(start !== -1, '15-1. _apfrEvaluateMobileApprovalCompliance() が実在する');
  const end = src.indexOf('\n}\n', start);
  const body = src.slice(start, end !== -1 ? end : start + 5000);
  const codeOnly = body.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; }).join('\n');

  assert(codeOnly.indexOf('_apfrEvaluateComplianceAssessment(') !== -1, '15-2. Assessment（C-1C-2a）を唯一の判定源として呼んでいる');
  assert(codeOnly.indexOf('evaluateComplianceGate(') === -1, '16-1. detector（C-1C-1）を直接呼んでいない');
  assert(codeOnly.indexOf('_apfrEvaluateDisclosureMarkers(') === -1, '16-2. detector（C-1C-1b）を直接呼んでいない');
  assert(codeOnly.indexOf('listingNgWords') === -1, '17-1. listingNgWords再実装0');
  assert(codeOnly.indexOf('APFR_DISCLOSURE_ACCEPTED_MARKERS') === -1, '17-2. 広告marker再実装0');
  assert(codeOnly.indexOf('_apfrResolveCurrentFact') === -1, '18-1. APFR Resolver再実装0（呼び出し0件）');
  assert(codeOnly.indexOf('.facts') === -1, '18-2. product.facts直接走査0件');
  assert(codeOnly.indexOf('_apfrCurrentAdoptedProduct()') !== -1, '18-3. Cross-case guardは既存_apfrCurrentAdoptedProduct()へ委譲している');
}

caseHeader('19. canApprove接続（実ソースstatic検証）');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(src.indexOf('var canApprove = _mapAllChecked() && _mapReviewApproved(mai) && !_mapCompliance.blocked;') !== -1,
    '19-1. canApproveへEnforcement条件が接続され、既存2条件も維持されている');
}

caseHeader('20. submit直前再評価（実ソースstatic検証）');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function approveInstagramPackage() {');
  assert(start !== -1, '20-1. approveInstagramPackage() が実在する');
  const body = src.slice(start, src.indexOf('\n}\n', start));
  assert(body.indexOf('_apfrEvaluateMobileApprovalCompliance()') !== -1, '20-2. submit直前にCompliance再評価を行う');
  assert(body.indexOf('return;') !== -1, '20-3. blocked時にreturnして処理を打ち切る');
  // 位置比較はコメント文中の言及（「pushApprovalToServer() へも進まない」等）に誤ヒットするため、
  //   行頭コメントを除去したコードのみを対象に測定する（説明的言及と実コードを区別する）。
  const bodyCode = body.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; }).join('\n');
  const blockedIdx = bodyCode.indexOf('if (_apCompliance.blocked)');
  const pushIdx = bodyCode.indexOf('pushApprovalToServer(');
  assert(blockedIdx !== -1 && pushIdx !== -1 && blockedIdx < pushIdx, '20-4. blocked判定はpushApprovalToServer()呼び出しより前に位置する（blocked時はpushへ到達しない）');
}

caseHeader('21-22. Publishing Ready / markInstagramPublished 独立変更0');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const prStart = src.indexOf('function createPublishingReadyDraft(outputDraft) {');
  const prBody = src.slice(prStart, src.indexOf('\n}\n', prStart));
  assert(prBody.indexOf('Compliance') === -1 && prBody.indexOf('compliance') === -1, '21-1. createPublishingReadyDraft()にCompliance参照0件（下流自動追従のみ）');
  const mpStart = src.indexOf('function markInstagramPublished() {');
  const mpBody = src.slice(mpStart, src.indexOf('\n}\n', mpStart));
  assert(mpBody.indexOf('Compliance') === -1 && mpBody.indexOf('compliance') === -1, '22-1. markInstagramPublished()にCompliance参照0件（既存hard guardのみ）');
  assert(mpBody.indexOf('if (!approved) return;') !== -1, '22-2. 既存hard guardが無変更');
}

caseHeader('23. OUTPUT_STATUS.READY変更0');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(src.indexOf('_lastOutputDraft.status    = noCompletedResults ? OUTPUT_STATUS.ERROR : OUTPUT_STATUS.READY;') !== -1,
    '23-1. READY判定ロジックが既存のまま（AI生成完了状態として維持）');
}

caseHeader('24. Quality Gate変更0');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const qgStart = src.indexOf('function evaluateQualityGate(packageQuality) {');
  assert(qgStart !== -1, '24-1. evaluateQualityGate()が既存シグネチャのまま存在');
  const qgBody = src.slice(qgStart, src.indexOf('\n}\n', qgStart));
  assert(qgBody.indexOf('Compliance') === -1 && qgBody.indexOf('compliance') === -1, '24-2. 本体にCompliance参照0件');
  assert(qgBody.indexOf('QUALITY_GATE_PASSING_STATUSES.indexOf(sourceStatus)') !== -1, '24-3. 既存passed判定が無変更');
}

caseHeader('25. accountCreationReadiness変更0（C-1C-2b-2で別途）');
{
  const src = fs.readFileSync(path.join(__dirname, 'shared', 'instagramAccountDesignQuality.js'), 'utf8');
  assert(src.indexOf('_apfrEvaluateMobileApprovalCompliance') === -1, '25-1. Enforcement helper参照0件');
  assert(src.indexOf('complianceAssessment') === -1, '25-2. compliance入力を追加していない');
  assert(src.indexOf("accountCreationReadiness = (userApproval === 'approved') ? 'ready' : 'conditional';") !== -1,
    '25-3. accountCreationReadiness判定ロジックが既存のまま');
}

caseHeader('26. _iadpApproveDesign（IADP Approval）変更0（C-1C-2b-2で別途）');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const iaStart = src.indexOf('function _iadpApproveDesign() {');
  const iaBody = src.slice(iaStart, src.indexOf('\n}\n', iaStart));
  assert(iaBody.indexOf('Compliance') === -1 && iaBody.indexOf('compliance') === -1, '26-1. IADP承認にCompliance Enforcement未接続（C-1C-2b-1の対象外）');
}

caseHeader('27. Executive Decision変更0');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(src.indexOf("try { if (typeof _edRunDecisionEngine === 'function') _edRunDecisionEngine(inbox); }") !== -1,
    '27-1. Executive Decision Engine呼び出しが既存のまま（Compliance blockedでも止めない）');
}

caseHeader('28-30. server.js / DB / AI API 境界');
{
  const s = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert(s.indexOf('_apfrEvaluateMobileApprovalCompliance') === -1, '28-1. server.jsにEnforcement参照0件（client-only Enforcement）');
  assert(s.indexOf('_apfrEvaluateComplianceAssessment') === -1, '28-2. server.jsにAssessment参照0件（C-1A Contract維持）');

  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function _apfrEvaluateMobileApprovalCompliance(');
  const body = src.slice(start, src.indexOf('\n}\n', start));
  assert(body.indexOf('fetch(') === -1 && body.indexOf('XMLHttpRequest') === -1, '29-1. fetch/XHR参照0件');
  assert(body.indexOf('pushOutputDraftToServer') === -1 && body.indexOf('pushApprovalToServer') === -1, '29-2. 保存関数への参照0件（runtime only）');
  assert(body.indexOf('callOpenAI') === -1 && body.indexOf('openai') === -1 && body.indexOf('anthropic') === -1, '30-1. AI API参照0件');
}

caseHeader('31. openaiClient.js / claudeClient.js / shared/leaderRuleEngine.js 変更0');
{
  const o = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
  assert(o.indexOf('_apfrEvaluateMobileApprovalCompliance') === -1, '31-1. openaiClient.js参照0件');
  const c = fs.readFileSync(path.join(__dirname, 'claudeClient.js'), 'utf8');
  assert(c.indexOf('_apfrEvaluateMobileApprovalCompliance') === -1, '31-2. claudeClient.js参照0件');
  const l = fs.readFileSync(path.join(__dirname, 'shared', 'leaderRuleEngine.js'), 'utf8');
  assert(l.indexOf('_apfrEvaluateMobileApprovalCompliance') === -1, '31-3. shared/leaderRuleEngine.js参照0件');
}

caseHeader('32. Enforcement UI（warnings・override UI非新設）');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function createMobileApprovalDraft(outputDraft) {');
  const body = src.slice(start, src.indexOf('\n}\n', start));
  assert(body.indexOf('承認できません。理由：') !== -1, '32-1. blocked時に理由を表示する');
  assert(body.indexOf('成果物を修正すると自動的に再判定されます') !== -1, '32-2. 復旧導線を表示する');
  assert(body.indexOf('Compliance Assessmentの一部が未検査です') !== -1, '32-3. not_checked時は警告のみ（承認は可能）');
  assert(src.indexOf('complianceOverride') === -1 && src.indexOf('forceApprove') === -1, '32-4. override UIを新設していない');
}

caseHeader('33. stage状態依存のgit diff型testを新設しない');
{
  const src = fs.readFileSync(path.join(__dirname, 'apfrApprovalEnforcement.test.js'), 'utf8');
  // Option Fの教訓（leaderFinalGrounding.test.js 20-2a）を踏襲。自己参照マッチを避けるため分割して組み立てる。
  const forbiddenPattern = 'execSync' + "('git " + 'diff';
  assert(src.indexOf(forbiddenPattern) === -1, '33-1. 本ファイル自身がgitのdiffベースの検出方式を使用していない');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All APFR Step C-1C-2b-1 mobile approval enforcement cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
