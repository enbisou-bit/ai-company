'use strict';
// apfrComplianceUiScope.test.js
// APFR Step C-1C-2a-1: Compliance UI Scope Correction 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / 本番案件への操作0
// index.html内の _apfrComplianceHasScannableContent() と、buildComplianceGateHtml()の表示差し替え
// ロジックと等価なものをNode環境で再現して検証する（既存apfr*.test.jsと同一パターン）。
// あわせて実ソース（index.html）へのstatic検証を行い、
//   ・detector/Assessmentの戻り値そのものが変更されていないこと
//   ・Mobile Approval Enforcement / IADP Approval / Quality Gate / READYがいずれも無変更であること
// を確認する。

const fs = require('fs');
const path = require('path');
const indexHtmlPath = path.join(__dirname, 'index.html');

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック
// ──────────────────────────────────────────────────────────────

// index.htmlの _apfrComplianceHasScannableContent() と等価
function _apfrComplianceHasScannableContent(outputDraft) {
  if (!outputDraft || !outputDraft.fields) return false;
  return Object.keys(outputDraft.fields).some(function (k) {
    var v = outputDraft.fields[k];
    return typeof v === 'string' || Array.isArray(v);
  });
}

const NOT_SCANNABLE_NOTE = '投稿成果物などの検査対象テキストがまだ存在しないため、Compliance Checkは未実施です。';

// buildComplianceGateHtml()の表示差し替えロジックと等価（3項目分・簡略版）
function buildDisplayMeta(hasScannableContent, actualStatus, statusMetaMap) {
  return hasScannableContent ? (statusMetaMap[actualStatus] || statusMetaMap.not_checked) : statusMetaMap.not_checked;
}
function buildDisplaySummary(hasScannableContent, actualSummaryFn) {
  return hasScannableContent ? actualSummaryFn() : NOT_SCANNABLE_NOTE;
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

// ──────────────────────────────────────────────────────────────
// 3. helper: hasScannableContent（1〜10）
// ──────────────────────────────────────────────────────────────

caseHeader('1-6. IADP-only（string/array field 0件）→ helper false・NOT CHECKED表示');
{
  const iadpOnly = { fields: { iadp: { package: { packageId: 'p', accountName: '商品名アカウント' } } } };
  const h = _apfrComplianceHasScannableContent(iadpOnly);
  assert(h === false, '1. IADP-only → helper false');

  const listingMeta = buildDisplayMeta(h, 'clear', { clear: { label: 'CLEAR' }, violation: { label: 'VIOLATION' }, not_checked: { label: 'NOT CHECKED' } });
  assert(listingMeta.label === 'NOT CHECKED', '2. 禁止語 NOT CHECKED表示（内部clearでも表示は上書き）');

  const disclosureMeta = buildDisplayMeta(h, 'missing', { satisfied: { label: 'SATISFIED' }, missing: { label: 'MISSING' }, not_checked: { label: 'NOT CHECKED' } });
  assert(disclosureMeta.label === 'NOT CHECKED', '3. 広告開示 NOT CHECKED表示（内部missingでも表示は上書き）');

  const assessmentMeta = buildDisplayMeta(h, 'blocked', { clear: { label: 'CLEAR' }, blocked: { label: 'BLOCKED' }, not_checked: { label: 'NOT CHECKED' } });
  assert(assessmentMeta.label === 'NOT CHECKED', '4. 総合 NOT CHECKED表示（内部blockedでも表示は上書き）');

  assert(assessmentMeta.label !== 'CLEAR', '5. CLEAR表示へ誤変換しない');
  assert(assessmentMeta.label !== 'BLOCKED', '6. BLOCKED表示へ誤変換しない');
}

caseHeader('7-9. 投稿成果物フィールド存在 → helper true');
{
  assert(_apfrComplianceHasScannableContent({ fields: { caption: '今日のおすすめ' } }) === true, '7. captionあり → helper true');
  assert(_apfrComplianceHasScannableContent({ fields: { slides: ['s1', 's2'] } }) === true, '8. slidesあり → helper true');
  assert(_apfrComplianceHasScannableContent({ fields: { hashtags: ['#a', '#b'] } }) === true, '9. hashtagsあり → helper true');
}

caseHeader('10. IADP + caption併存（lifecycle carry-forward）→ helper true');
{
  const merged = { fields: { caption: '今日のおすすめ', iadp: { package: { packageId: 'p' } } } };
  assert(_apfrComplianceHasScannableContent(merged) === true, '10. IADP存在 ≠ IADP-only。scannable contentがあればtrue');
}

caseHeader('追加: null/undefined/malformed入力');
{
  assert(_apfrComplianceHasScannableContent(null) === false, 'a. null → false');
  assert(_apfrComplianceHasScannableContent(undefined) === false, 'b. undefined → false');
  assert(_apfrComplianceHasScannableContent({}) === false, 'c. fields無し → false');
  assert(_apfrComplianceHasScannableContent({ fields: null }) === false, 'd. fields=null → false');
  assert(_apfrComplianceHasScannableContent({ fields: {} }) === false, 'e. fields空オブジェクト → false');
  assert(_apfrComplianceHasScannableContent({ fields: { x: 123 } }) === false, 'f. number型フィールドのみ → false（string/array以外は対象外）');
  assert(_apfrComplianceHasScannableContent({ fields: { x: true } }) === false, 'g. boolean型フィールドのみ → false');
}

// ──────────────────────────────────────────────────────────────
// 4. 投稿成果物あり時の表示維持（11〜15）
// ──────────────────────────────────────────────────────────────

caseHeader('11. 投稿成果物あり + disclosure missing → MISSING/BLOCKED維持');
{
  const draft = { fields: { caption: '今日のおすすめ' } };
  const h = _apfrComplianceHasScannableContent(draft);
  assert(h === true, '11-1. helper true');
  const meta = buildDisplayMeta(h, 'missing', { satisfied: { label: 'SATISFIED' }, missing: { label: 'MISSING' }, not_checked: { label: 'NOT CHECKED' } });
  assert(meta.label === 'MISSING', '11-2. 実際のstatus通りMISSING表示');
}

caseHeader('12. 投稿成果物あり + disclosure satisfied → 既存結果維持');
{
  const draft = { fields: { caption: '【広告】今日のおすすめ' } };
  const h = _apfrComplianceHasScannableContent(draft);
  const meta = buildDisplayMeta(h, 'satisfied', { satisfied: { label: 'SATISFIED' }, missing: { label: 'MISSING' }, not_checked: { label: 'NOT CHECKED' } });
  assert(meta.label === 'SATISFIED', '12. SATISFIED表示維持');
}

caseHeader('13. listing violation → VIOLATION/BLOCKED維持');
{
  const draft = { fields: { caption: '商品名を掲載します' } };
  const h = _apfrComplianceHasScannableContent(draft);
  const meta = buildDisplayMeta(h, 'violation', { clear: { label: 'CLEAR' }, violation: { label: 'VIOLATION' }, not_checked: { label: 'NOT CHECKED' } });
  assert(meta.label === 'VIOLATION', '13. VIOLATION表示維持');
}

caseHeader('14. listing clear → 既存CLEAR維持');
{
  const draft = { fields: { caption: '今日のおすすめコスメ' } };
  const h = _apfrComplianceHasScannableContent(draft);
  const meta = buildDisplayMeta(h, 'clear', { clear: { label: 'CLEAR' }, violation: { label: 'VIOLATION' }, not_checked: { label: 'NOT CHECKED' } });
  assert(meta.label === 'CLEAR', '14. CLEAR表示維持（本来のclearは尊重される）');
}

caseHeader('15. requirement未登録の既存not_checked → 従来表示維持（scannable content自体はある）');
{
  const draft = { fields: { caption: '今日のおすすめ' } };
  const h = _apfrComplianceHasScannableContent(draft);
  assert(h === true, '15-1. helper true（投稿成果物があるためscope補正は発火しない）');
  const meta = buildDisplayMeta(h, 'not_checked', { satisfied: { label: 'SATISFIED' }, missing: { label: 'MISSING' }, not_checked: { label: 'NOT CHECKED' } });
  assert(meta.label === 'NOT CHECKED', '15-2. 従来どおりのnot_checked（requirement未登録）表示');
}

// ──────────────────────────────────────────────────────────────
// 5. static検証（実ソースindex.html）
// ──────────────────────────────────────────────────────────────

caseHeader('16-18. Mobile Approval Enforcement / IADP Approval / Quality Gate / READY 変更0（static検証）');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');

  // 16: _apfrEvaluateMobileApprovalCompliance()本体が新helperを参照していないこと
  const mapStart = src.indexOf('function _apfrEvaluateMobileApprovalCompliance(');
  assert(mapStart !== -1, '16-1. _apfrEvaluateMobileApprovalCompliance()が実在する');
  const mapBody = src.slice(mapStart, src.indexOf('\n}\n', mapStart));
  assert(mapBody.indexOf('_apfrComplianceHasScannableContent') === -1, '16-2. Mobile Approval EnforcementがUI scope helperを参照していない（独立して動作する）');

  // approveInstagramPackage()本体も変更されていないこと
  const apStart = src.indexOf('function approveInstagramPackage() {');
  const apBody = src.slice(apStart, src.indexOf('\n}\n', apStart));
  assert(apBody.indexOf('_apfrComplianceHasScannableContent') === -1, '18-1. approveInstagramPackage()がUI scope helperを参照していない');
  assert(apBody.indexOf('_apfrEvaluateMobileApprovalCompliance()') !== -1, '18-2. approveInstagramPackage()のsubmit直前再評価は既存のまま存在');

  // 19: IADP Approval変更0
  const iaStart = src.indexOf('function _iadpApproveDesign() {');
  const iaBody = src.slice(iaStart, src.indexOf('\n}\n', iaStart));
  assert(iaBody.indexOf('_apfrComplianceHasScannableContent') === -1, '19-1. _iadpApproveDesign()がUI scope helperを参照していない');
  assert(iaBody.indexOf('Compliance') === -1 && iaBody.indexOf('compliance') === -1, '19-2. IADP承認にCompliance系参照が引き続き0件');

  // 20: accountCreationReadiness変更0
  const quality = fs.readFileSync(path.join(__dirname, 'shared', 'instagramAccountDesignQuality.js'), 'utf8');
  assert(quality.indexOf('_apfrComplianceHasScannableContent') === -1, '20-1. shared/instagramAccountDesignQuality.jsにUI scope helper参照0件');
  assert(quality.indexOf("accountCreationReadiness = (userApproval === 'approved') ? 'ready' : 'conditional';") !== -1, '20-2. accountCreationReadiness判定ロジックが既存のまま');
}

caseHeader('21-24. Detector / Assessment本体変更0（static検証）');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');

  const cgStart = src.indexOf('function evaluateComplianceGate(outputDraft, complianceContext) {');
  assert(cgStart !== -1, '21-1. evaluateComplianceGate()が既存シグネチャのまま存在');
  const cgBody = src.slice(cgStart, src.indexOf('\n}\n', cgStart));
  assert(cgBody.indexOf('_apfrComplianceHasScannableContent') === -1, '21-2. evaluateComplianceGate()本体はUI scope helperを参照しない（検出は従来どおり無条件実行）');

  const dmStart = src.indexOf('function _apfrEvaluateDisclosureMarkers(outputDraft, complianceContext) {');
  assert(dmStart !== -1, '22-1. _apfrEvaluateDisclosureMarkers()が既存シグネチャのまま存在');
  const dmBody = src.slice(dmStart, src.indexOf('\n}\n', dmStart));
  assert(dmBody.indexOf('_apfrComplianceHasScannableContent') === -1, '22-2. _apfrEvaluateDisclosureMarkers()本体はUI scope helperを参照しない');

  const caStart = src.indexOf('function _apfrEvaluateComplianceAssessment(outputDraft, complianceContext) {');
  assert(caStart !== -1, '23-1. _apfrEvaluateComplianceAssessment()が既存シグネチャのまま存在');
  const caBody = src.slice(caStart, src.indexOf('\n}\n', caStart));
  assert(caBody.indexOf('_apfrComplianceHasScannableContent') === -1, '23-2. _apfrEvaluateComplianceAssessment()本体はUI scope helperを参照しない（検出・集約は従来どおり無条件実行）');

  // 24: evaluateQualityGate() / OUTPUT_STATUS.READY 変更0
  const qgStart = src.indexOf('function evaluateQualityGate(packageQuality) {');
  const qgBody = src.slice(qgStart, src.indexOf('\n}\n', qgStart));
  assert(qgBody.indexOf('_apfrComplianceHasScannableContent') === -1, '24-1. evaluateQualityGate()にUI scope helper参照0件');
  assert(src.indexOf('_lastOutputDraft.status    = noCompletedResults ? OUTPUT_STATUS.ERROR : OUTPUT_STATUS.READY;') !== -1, '24-2. OUTPUT_STATUS.READY判定ロジックが既存のまま');
}

caseHeader('25-27. helper自体の純粋性・呼び出し確認（static検証）');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function _apfrComplianceHasScannableContent(outputDraft) {');
  assert(start !== -1, '25-1. _apfrComplianceHasScannableContent()が実在する');
  const body = src.slice(start, src.indexOf('\n}\n', start));
  const codeOnly = body.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; }).join('\n');
  assert(codeOnly.indexOf('listingNgWords') === -1, '25-2. NGワード検索を実装していない');
  assert(codeOnly.indexOf('APFR_DISCLOSURE_ACCEPTED_MARKERS') === -1, '25-3. 広告marker検索を実装していない');
  assert(codeOnly.indexOf('_apfrResolveCurrentFact') === -1, '26-1. APFR Resolver参照0件');
  assert(codeOnly.indexOf('OUTPUT_TYPES') === -1 && codeOnly.indexOf('draft.type') === -1, '26-2. output type判定を実装していない');
  assert(codeOnly.indexOf('.iadp') === -1, '26-3. IADP存在判定を実装していない（scannable content判定のみ）');
  assert(codeOnly.indexOf('_apfrCurrentAdoptedProduct') === -1, '26-4. product判定を実装していない');

  const bcgStart = src.indexOf('function buildComplianceGateHtml() {');
  const bcgBody = src.slice(bcgStart, bcgStart + 8000);
  assert(bcgBody.indexOf('_apfrComplianceHasScannableContent(_lastOutputDraft)') !== -1, '27-1. buildComplianceGateHtml()がhelperを呼び出している');
  assert(bcgBody.indexOf('evaluateComplianceGate(_lastOutputDraft, complianceContext)') !== -1, '27-2. evaluateComplianceGate()呼び出しは維持されている（検出は必ず実行）');
  assert(bcgBody.indexOf('_apfrEvaluateDisclosureMarkers(_lastOutputDraft, complianceContext)') !== -1, '27-3. _apfrEvaluateDisclosureMarkers()呼び出しは維持されている');
  assert(bcgBody.indexOf('_apfrEvaluateComplianceAssessment(_lastOutputDraft, complianceContext)') !== -1, '27-4. _apfrEvaluateComplianceAssessment()呼び出しは維持されている');
}

caseHeader('28-30. server / provider 変更0（static検証）');
{
  const s = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert(s.indexOf('_apfrComplianceHasScannableContent') === -1, '28-1. server.jsにhelper参照0件');
  const o = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
  assert(o.indexOf('_apfrComplianceHasScannableContent') === -1, '29-1. openaiClient.jsにhelper参照0件');
  const c = fs.readFileSync(path.join(__dirname, 'claudeClient.js'), 'utf8');
  assert(c.indexOf('_apfrComplianceHasScannableContent') === -1, '30-1. claudeClient.jsにhelper参照0件');
  const l = fs.readFileSync(path.join(__dirname, 'shared', 'leaderRuleEngine.js'), 'utf8');
  assert(l.indexOf('_apfrComplianceHasScannableContent') === -1, '30-2. shared/leaderRuleEngine.jsにhelper参照0件');
}

caseHeader('31-33. fetch / DB write / AI API 参照0件（helper・buildComplianceGateHtml内）');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function _apfrComplianceHasScannableContent(outputDraft) {');
  const body = src.slice(start, src.indexOf('\n}\n', start));
  assert(body.indexOf('fetch(') === -1 && body.indexOf('XMLHttpRequest') === -1, '31-1. fetch/XHR参照0件');
  assert(body.indexOf('supabase') === -1 && body.indexOf('Supabase') === -1, '32-1. Supabase参照0件（DB write 0）');
  assert(body.indexOf('pushOutputDraftToServer') === -1 && body.indexOf('pushApprovalToServer') === -1 && body.indexOf('_apfrAppendRecord') === -1, '32-2. 保存関数への参照0件');
  assert(body.indexOf('callOpenAI') === -1 && body.indexOf('openai') === -1 && body.indexOf('anthropic') === -1, '33-1. AI API参照0件');
}

caseHeader('34. stage状態依存のgit diff型testを新設しない');
{
  const src = fs.readFileSync(path.join(__dirname, 'apfrComplianceUiScope.test.js'), 'utf8');
  const forbiddenPattern = 'execSync' + "('git " + 'diff';
  assert(src.indexOf(forbiddenPattern) === -1, '34-1. 本ファイル自身がgitのdiffベースの検出方式を使用していない');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All APFR Step C-1C-2a-1 compliance UI scope correction cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
