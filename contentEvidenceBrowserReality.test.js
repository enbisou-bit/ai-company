'use strict';
// contentEvidenceBrowserReality.test.js
// CV-4c-3B: Browser Reality Regression Guard（Part L）。
//
//   ★ 目的: CV-4c-3B初回実装で発生した「Node require()環境でテストして browser失敗を
//     見逃す」という誤りを二度と再発させないための専用テスト。
//   ★ 本ファイルは Node の require/module を一切 sandbox へ持ち込まない、
//     真のブラウザ相当環境（vm.Context・グローバルにrequire/moduleが存在しない）を
//     明示的に構築し、その中で ContentClaimPlanning / ContentEvidenceApproval のみを
//     UMD経由でロードして検証する。
//
//   実HTTP 0 / 実AI API 0 / 実DB 0 / 実Web Evidence 0。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const indexSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// ── 真のブラウザ相当環境を構築（require/moduleは一切存在しない） ──
//   ロードするのは公開許可リストに実際に載っている2ファイルのみ
//   （shared/contentEvidence.js / shared/contentValueQuality.js は絶対に含めない）。
function buildTrueBrowserSandbox() {
  const eaSrc = fs.readFileSync(path.join(__dirname, 'shared', 'evidenceAcquisition.js'), 'utf8');
  const cpSrc = fs.readFileSync(path.join(__dirname, 'shared', 'contentClaimPlanning.js'), 'utf8');
  const ceaSrc = fs.readFileSync(path.join(__dirname, 'shared', 'contentEvidenceApproval.js'), 'utf8');

  const calls = [];
  const sandbox = {
    console: console,
    Date: Date,
    Object: Object,
    Array: Array,
    JSON: JSON,
    String: String,
    document: { getElementById: function () { return null; } },
    fetch: function () { calls.push(arguments); throw new Error('fetch must not be called in this test'); },
  };
  vm.createContext(sandbox);
  // ★ require / module を意図的に定義しない（真のブラウザには存在しないため）。
  assert(typeof sandbox.require === 'undefined', 'setup: sandbox に require が存在しない（真のbrowser環境）');
  assert(typeof sandbox.module === 'undefined', 'setup: sandbox に module が存在しない（真のbrowser環境）');

  vm.runInContext(eaSrc, sandbox);
  vm.runInContext(cpSrc, sandbox);
  vm.runInContext(ceaSrc, sandbox);
  sandbox.__fetchCalls = calls;
  return sandbox;
}

(async () => {
  console.log('\n=== contentEvidenceBrowserReality.test.js (CV-4c-3B Part L) ===');

  caseHeader('1. ContentClaimPlanning load成功（真のbrowser環境）');
  const s = buildTrueBrowserSandbox();
  assert(typeof s.ContentClaimPlanning === 'object', '1. ContentClaimPlanning がグローバルとしてロードされる');
  assert(typeof s.ContentEvidenceApproval === 'object', '1b. ContentEvidenceApproval もグローバルとしてロードされる');
  assert(typeof s.EvidenceAcquisition === 'object', '1c. EvidenceAcquisition もグローバルとしてロードされる（既存公開ファイル）');

  caseHeader('2. _hasContentEvidence() === false（重要：本回帰の核心）');
  assert(s.ContentClaimPlanning._hasContentEvidence() === false,
    '2. ★真のbrowser環境では shared/contentEvidence.js は取得できない（_hasContentEvidence()===false）');
  assert(s.ContentClaimPlanning._hasEvidenceAcquisition() === true,
    '2b. shared/evidenceAcquisition.js は公開済みのため利用可能（_hasEvidenceAcquisition()===true）');

  caseHeader('3. Approval UI利用可能（state machine）');
  let state = 'idle';
  state = s.ContentEvidenceApproval.transition(state, 'build_plan').state;
  state = s.ContentEvidenceApproval.transition(state, 'show_for_approval').state;
  assert(state === 'awaiting_approval', '3. Approval state machineは真のbrowser環境でも正常動作する');

  caseHeader('4. Search Plan利用可能（Part A/B/C：contentEvidence.js非依存）');
  const intent = { intentId: 'i1', caseId: 'case-x', topic: '保湿', question: '洗顔後の保湿はどの程度早く行うべきか', claimTypeCandidate: 'general_practice', status: 'proposed' };
  const plan = s.ContentClaimPlanning.buildContentEvidenceQueries([intent]);
  assert(plan.queries.length === 1, '4. buildContentEvidenceQueries() は真のbrowser環境でも正常動作する（Part A/B/Cはcontentevidence.js非依存）');
  const medicalIntent = { intentId: 'i2', caseId: 'case-x', topic: 'ニキビ治療', question: 'ニキビを治療するには', claimTypeCandidate: 'general_practice', status: 'proposed' };
  const planWithBlock = s.ContentClaimPlanning.buildContentEvidenceQueries([intent, medicalIntent]);
  assert(planWithBlock.blocked.length === 1, '4b. Safety Filterも真のbrowser環境で正常動作する（medical topicをblocked）');

  caseHeader('5〜6. Candidate表示 / Mapping入力（index.html構造確認）');
  assert(indexSrc.indexOf('_ceSetMappingDecision') !== -1, '5. _ceSetMappingDecision（mapping入力）が定義されている');
  assert(indexSrc.indexOf('_ceSyncMappingFromSelects') !== -1, '6. _ceSyncMappingFromSelects（select UI連携）が定義されている');
  assert(indexSrc.indexOf('id="ce-ct-') !== -1 && indexSrc.indexOf('id="ce-st-') !== -1,
    '6b. claimType/supportTypeのselect UIがcandidate表示に組み込まれている');

  caseHeader('7. browserがFormal Resolutionを実行しない（重要）');
  // コメント行（説明文）を除いた「実コード」だけを対象にする（既存 lib/publicStatic.js の
  //   テストと同じ規約。本コメント自体が「呼ばない」ことを説明するため関数名を含み偽陽性になる）。
  const indexCodeOnly = indexSrc.split('\n').filter(function (l) {
    const t = l.trim();
    return t.indexOf('//') !== 0 && t.indexOf('*') !== 0;
  }).join('\n');
  assert(indexCodeOnly.indexOf('resolveClaimEvidenceBatch') === -1,
    '7a. ★index.htmlの実コードは resolveClaimEvidenceBatch を一切呼ばない（browser側Formal Resolutionを行わない）');
  assert(indexCodeOnly.indexOf('finalizeContentClaim') === -1,
    '7b. ★index.htmlの実コードは finalizeContentClaim を一切呼ばない');
  assert(indexCodeOnly.indexOf('buildContentEvidenceFromCandidate') === -1,
    '7c. ★index.htmlの実コードは buildContentEvidenceFromCandidate を一切呼ばない');

  caseHeader('8. browserからFormal Evidenceをcanonical生成しない（実行時確認）');
  // 実際にcontentClaimPlanning.jsのbuildContentEvidenceFromCandidate/resolveClaimEvidenceBatchを
  //   真のbrowser環境で呼び出し、canonical生成が実際に失敗する（=browserはcanonical化しない）ことを実証する。
  const cand = { sourceMethod: 'web_retrieved', sourceUrl: 'https://www.mhlw.go.jp/a', sourceTitle: 't1', createdBy: 'system', sourceExcerpt: '5分以内の保湿が推奨されています。' };
  const mapping = { evidenceId: 'ev-1', claimType: 'general_practice', supportType: 'supports', retrievedAt: '2026-09-14T00:00:00.000Z', recordedAt: '2026-09-14T00:00:00.000Z' };
  const r = s.ContentClaimPlanning.buildContentEvidenceFromCandidate(cand, intent, mapping, { caseId: 'case-x' });
  assert(r.ok === false && r.errors.indexOf('content_evidence_module_unavailable') !== -1,
    '8. ★真のbrowser環境ではbuildContentEvidenceFromCandidate()が確実に失敗する（=canonical Evidenceを生成しない設計であることの実証）');
  const batch = s.ContentClaimPlanning.resolveClaimEvidenceBatch(intent, [{ candidate: cand, mappingDecision: mapping }], { caseId: 'case-x' });
  assert(batch.records.length === 0 && batch.resolution === null,
    '8b. ★resolveClaimEvidenceBatch()も真のbrowser環境では0件・resolution nullを返す（canonical化しない）');

  caseHeader('9. index.htmlが正しいアーキテクチャに従っていることの最終確認');
  assert(s.__fetchCalls.length === 0, '9a. ★本テスト全体でfetch()は一度も呼ばれていない（実Web Evidence 0）');
  assert(indexSrc.indexOf('contentEvidenceCandidates') !== -1,
    '9b. index.htmlは新contract（contentEvidenceCandidates）でserverへ提出する設計になっている');
  assert(indexSrc.indexOf('/api/evidence/web-search') === indexSrc.lastIndexOf('/api/evidence/web-search') || (indexSrc.match(/\/api\/evidence\/web-search/g) || []).length === 2,
    '9c. /api/evidence/web-search の参照数は既存2箇所のまま（新規Web Search呼び出しを追加していない）');
  assert(indexSrc.indexOf('/api/output-drafts') !== -1, '9d. Evidence確定はEXISTING /api/output-draftsへの提出として実装されている');

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All contentEvidenceBrowserReality cases passed (CV-4c-3B Part L)'); }
})().catch(function (e) { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
