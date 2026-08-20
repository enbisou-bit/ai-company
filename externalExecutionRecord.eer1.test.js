'use strict';
// externalExecutionRecord.eer1.test.js
// Phase EER-1（Decision107）: External Execution Record（EER）Core 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / Web Search 0 / index.html変更不要
// index.html内の validateExternalExecutionRecord() / _eerAppendRecord() と等価なロジックを
// Node環境で再現してCore（validation / 重複防止 / carry-forward / Cross-case保護 / 入力非破壊）を検証する。

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック（EXTERNAL_EXECUTION_TYPES / validateExternalExecutionRecord）
// ──────────────────────────────────────────────────────────────
const EXTERNAL_EXECUTION_TYPES = [
  'instagram_account_created',
  'asp_registered',
  'asp_media_registered',
];

function validateExternalExecutionRecord(record, expectedCaseId) {
  var result = { valid: false, reason: null };
  if (!record || typeof record !== 'object') { result.reason = 'record_missing'; return result; }
  if (EXTERNAL_EXECUTION_TYPES.indexOf(record.executionType) === -1) { result.reason = 'unknown_execution_type'; return result; }
  if (record.status !== 'executed') { result.reason = 'invalid_status'; return result; }
  if (record.source !== 'user_confirmation') { result.reason = 'invalid_source'; return result; }
  if (record.actor !== 'user') { result.reason = 'invalid_actor'; return result; }
  if (typeof record.caseId !== 'string' || !record.caseId) { result.reason = 'caseId_missing'; return result; }
  if (expectedCaseId && record.caseId !== expectedCaseId) { result.reason = 'caseId_mismatch'; return result; }
  if (typeof record.executedAt !== 'string' || !record.executedAt || isNaN(Date.parse(record.executedAt))) { result.reason = 'invalid_executedAt'; return result; }
  if (record.packageId !== undefined && record.packageId !== null && typeof record.packageId !== 'string') { result.reason = 'invalid_packageId'; return result; }
  result.valid = true;
  return result;
}

// ──────────────────────────────────────────────────────────────
// 2. index.html等価ロジック（_eerAppendRecord・テスト用にDraft/現在caseIdを引数化したスタブ）
//    本番はgetCurrentApprovalCaseId()/_lastOutputDraft/pushOutputDraftToServer()を直接参照するが、
//    合成テストでは同じ分岐ロジックを外部状態注入で再現する（ロジック自体は同一）。
// ──────────────────────────────────────────────────────────────
function eerAppendRecord(state, record) {
  // state = { curCaseId, draft, pushed: [] }（pushedはpushOutputDraftToServer呼び出し回数の記録用）
  try {
    var curCaseId = state.curCaseId;
    var v = validateExternalExecutionRecord(record, curCaseId);
    if (!v.valid) return { ok: false, reason: v.reason };
    if (!state.draft || state.draft.caseId !== curCaseId) return { ok: false, reason: 'draft_case_mismatch' };
    if (!state.draft.fields) state.draft.fields = {};
    var list = Array.isArray(state.draft.fields.externalExecution) ? state.draft.fields.externalExecution : [];
    var dup = list.some(function (r) { return r && r.caseId === record.caseId && r.executionType === record.executionType; });
    if (dup) return { ok: false, reason: 'duplicate' };
    var toSave = {
      executionType: record.executionType,
      status: record.status,
      caseId: record.caseId,
      source: record.source,
      actor: record.actor,
      executedAt: record.executedAt,
    };
    if (record.packageId !== undefined && record.packageId !== null) toSave.packageId = record.packageId;
    state.draft.fields.externalExecution = list.concat([toSave]);
    state.pushed.push(state.draft.id); // pushOutputDraftToServer(state.draft) 相当
    return { ok: true, record: toSave };
  } catch (_eerErr) {
    return { ok: false, reason: 'exception', message: _eerErr.message };
  }
}

// ──────────────────────────────────────────────────────────────
// 3. index.html等価ロジック（FORMAL_CASE_FIELDS carry-forward・index.html:15709-15818と等価）
// ──────────────────────────────────────────────────────────────
const FORMAL_CASE_FIELDS = ['iadp', 'intelligenceContext', 'affiliateContext', 'approvedDecisionPackage', 'externalExecution'];

function carryForwardFormalFields(lastOutputDraft, runCaseId, newDraft) {
  var carry = {};
  if (lastOutputDraft && lastOutputDraft.caseId === runCaseId && lastOutputDraft.fields) {
    FORMAL_CASE_FIELDS.forEach(function (k) {
      if (lastOutputDraft.fields[k]) carry[k] = lastOutputDraft.fields[k];
    });
  }
  if (!newDraft.fields) newDraft.fields = {};
  Object.keys(carry).forEach(function (k) { newDraft.fields[k] = carry[k]; });
  return newDraft;
}

// ──────────────────────────────────────────────────────────────
// 4. Test runner
// ──────────────────────────────────────────────────────────────
let _passed = 0, _failed = 0;
function assert(condition, label) {
  if (condition) { console.log('  ✓', label); _passed++; }
  else { console.error('  ✗', label); _failed++; }
}
function caseHeader(name) { console.log('\n' + name); }

const VALID_RECORD = {
  executionType: 'instagram_account_created',
  status: 'executed',
  caseId: 'case-test-A',
  source: 'user_confirmation',
  actor: 'user',
  executedAt: '2026-08-21T00:00:00.000Z',
};

// ──────────────────────────────────────────────────────────────
caseHeader('Case 1: Valid Record（instagram_account_created）→ accepted');
{
  const r = Object.assign({}, VALID_RECORD);
  const v = validateExternalExecutionRecord(r, 'case-test-A');
  assert(v.valid === true, 'valid=true');
  assert(v.reason === null, 'reason=null');
}

caseHeader('Case 2: 未知executionType → rejected');
{
  const r = Object.assign({}, VALID_RECORD, { executionType: 'instagram_post_published' });
  const v = validateExternalExecutionRecord(r, 'case-test-A');
  assert(v.valid === false, 'valid=false');
  assert(v.reason === 'unknown_execution_type', 'reason=unknown_execution_type');
}

caseHeader('Case 3: status=executed → accepted / status=verified → rejected / status=ready → rejected');
{
  const rExecuted = Object.assign({}, VALID_RECORD, { status: 'executed' });
  const rVerified = Object.assign({}, VALID_RECORD, { status: 'verified' });
  const rReady    = Object.assign({}, VALID_RECORD, { status: 'ready' });
  assert(validateExternalExecutionRecord(rExecuted, 'case-test-A').valid === true, 'status=executed → accepted');
  const vV = validateExternalExecutionRecord(rVerified, 'case-test-A');
  assert(vV.valid === false && vV.reason === 'invalid_status', 'status=verified → rejected（初期実装は未採用）');
  const vR = validateExternalExecutionRecord(rReady, 'case-test-A');
  assert(vR.valid === false && vR.reason === 'invalid_status', 'status=ready → rejected');
}

caseHeader('Case 4: source=user_confirmation → accepted / AI由来値 → rejected');
{
  const rOk = Object.assign({}, VALID_RECORD, { source: 'user_confirmation' });
  const rAi = Object.assign({}, VALID_RECORD, { source: 'ai_inference' });
  const rSys = Object.assign({}, VALID_RECORD, { source: 'system_execution' });
  assert(validateExternalExecutionRecord(rOk, 'case-test-A').valid === true, 'source=user_confirmation → accepted');
  const vAi = validateExternalExecutionRecord(rAi, 'case-test-A');
  assert(vAi.valid === false && vAi.reason === 'invalid_source', 'source=ai_inference → rejected');
  const vSys = validateExternalExecutionRecord(rSys, 'case-test-A');
  assert(vSys.valid === false && vSys.reason === 'invalid_source', 'source=system_execution（将来source）→ 今回は rejected');
}

caseHeader('Case 5: caseId 一致 → accepted / 不一致 → rejected / 空 → rejected');
{
  const rMatch    = Object.assign({}, VALID_RECORD, { caseId: 'case-test-A' });
  const rMismatch = Object.assign({}, VALID_RECORD, { caseId: 'case-test-B' });
  const rEmpty    = Object.assign({}, VALID_RECORD, { caseId: '' });
  assert(validateExternalExecutionRecord(rMatch, 'case-test-A').valid === true, 'caseId一致 → accepted');
  const vMis = validateExternalExecutionRecord(rMismatch, 'case-test-A');
  assert(vMis.valid === false && vMis.reason === 'caseId_mismatch', 'caseId不一致 → rejected（Cross-case guard）');
  const vEmp = validateExternalExecutionRecord(rEmpty, 'case-test-A');
  assert(vEmp.valid === false && vEmp.reason === 'caseId_missing', 'caseId空 → rejected');
}

caseHeader('Case 6: executedAt 正しいISO timestamp → accepted / 不正 → rejected / 空 → rejected');
{
  const rOk  = Object.assign({}, VALID_RECORD, { executedAt: '2026-08-21T09:15:00.000Z' });
  const rBad = Object.assign({}, VALID_RECORD, { executedAt: 'not-a-date' });
  const rEmp = Object.assign({}, VALID_RECORD, { executedAt: '' });
  assert(validateExternalExecutionRecord(rOk, 'case-test-A').valid === true, '正しいISO timestamp → accepted');
  const vBad = validateExternalExecutionRecord(rBad, 'case-test-A');
  assert(vBad.valid === false && vBad.reason === 'invalid_executedAt', '不正timestamp → rejected');
  const vEmp = validateExternalExecutionRecord(rEmp, 'case-test-A');
  assert(vEmp.valid === false && vEmp.reason === 'invalid_executedAt', '空timestamp → rejected');
}

caseHeader('Case 7: packageId あり → accepted / なし → accepted（optional）');
{
  const rWith    = Object.assign({}, VALID_RECORD, { packageId: 'iadp_1787060839814_izhakb' });
  const rWithout = Object.assign({}, VALID_RECORD); // packageId未設定
  const rNull    = Object.assign({}, VALID_RECORD, { packageId: null });
  const rBadType = Object.assign({}, VALID_RECORD, { packageId: 12345 });
  assert(validateExternalExecutionRecord(rWith, 'case-test-A').valid === true,    'packageIdあり → accepted');
  assert(validateExternalExecutionRecord(rWithout, 'case-test-A').valid === true, 'packageIdなし → accepted（optional）');
  assert(validateExternalExecutionRecord(rNull, 'case-test-A').valid === true,    'packageId=null → accepted（optional）');
  const vBad = validateExternalExecutionRecord(rBadType, 'case-test-A');
  assert(vBad.valid === false && vBad.reason === 'invalid_packageId', 'packageIdが不正型 → rejected');
}

caseHeader('Case 8: actor不正 → rejected');
{
  const r = Object.assign({}, VALID_RECORD, { actor: 'ai' });
  const v = validateExternalExecutionRecord(r, 'case-test-A');
  assert(v.valid === false && v.reason === 'invalid_actor', 'actor=ai → rejected');
}

caseHeader('Case 9: 複数Record（3 executionType共存）→ 正常');
{
  const state = { curCaseId: 'case-test-A', draft: { id: 'out_1', caseId: 'case-test-A', fields: {} }, pushed: [] };
  const r1 = eerAppendRecord(state, Object.assign({}, VALID_RECORD, { executionType: 'instagram_account_created' }));
  const r2 = eerAppendRecord(state, Object.assign({}, VALID_RECORD, { executionType: 'asp_registered' }));
  const r3 = eerAppendRecord(state, Object.assign({}, VALID_RECORD, { executionType: 'asp_media_registered' }));
  assert(r1.ok === true && r2.ok === true && r3.ok === true, '3件とも保存成功');
  assert(state.draft.fields.externalExecution.length === 3, 'externalExecution.length===3（3種共存）');
  assert(state.pushed.length === 3, 'pushOutputDraftToServer相当が3回呼ばれた');
}

caseHeader('Case 10: 重複Record（同一caseId+executionType）→ 2件目は拒否・上書きしない');
{
  const state = { curCaseId: 'case-test-A', draft: { id: 'out_1', caseId: 'case-test-A', fields: {} }, pushed: [] };
  const r1 = eerAppendRecord(state, Object.assign({}, VALID_RECORD, { executedAt: '2026-08-21T00:00:00.000Z' }));
  const r2 = eerAppendRecord(state, Object.assign({}, VALID_RECORD, { executedAt: '2026-08-22T00:00:00.000Z' })); // 2回目押下想定
  assert(r1.ok === true, '1件目は保存成功');
  assert(r2.ok === false && r2.reason === 'duplicate', '2件目は重複として拒否');
  assert(state.draft.fields.externalExecution.length === 1, 'externalExecution.length===1（増殖しない）');
  assert(state.draft.fields.externalExecution[0].executedAt === '2026-08-21T00:00:00.000Z', '既存Recordのexecutedatは書き換わらない（Audit Trail維持）');
}

caseHeader('Case 11: carry-forward — 同一case・新Output Draft生成でも既存EER保持');
{
  const lastDraft = { id: 'out_old', caseId: 'case-test-A', fields: { externalExecution: [Object.assign({}, VALID_RECORD)] } };
  const newDraft  = { id: 'out_new', caseId: 'case-test-A', fields: {} };
  const merged = carryForwardFormalFields(lastDraft, 'case-test-A', newDraft);
  assert(Array.isArray(merged.fields.externalExecution), '新Draftへ externalExecution が引き継がれる');
  assert(merged.fields.externalExecution.length === 1, '引き継がれたRecordは1件');
  assert(merged.fields.externalExecution[0].executionType === 'instagram_account_created', 'executionTypeも保持される');
}

caseHeader('Case 12: Cross-case — 別caseへの新Draft生成ではEERを引き継がない');
{
  const lastDraft = { id: 'out_old', caseId: 'case-A', fields: { externalExecution: [Object.assign({}, VALID_RECORD, { caseId: 'case-A' })] } };
  const newDraft  = { id: 'out_new', caseId: 'case-B', fields: {} };
  // atRunCaseId=case-B（別案件でAuto Task実行）・lastOutputDraft.caseId=case-A → 条件不一致でcarry-forwardされない
  const merged = carryForwardFormalFields(lastDraft, 'case-B', newDraft);
  assert(merged.fields.externalExecution === undefined, 'case-BのDraftへcase-AのEERは混入しない');
}

caseHeader('Case 13: Cross-case — Recordのcurrent caseId不一致は保存自体を拒否');
{
  const state = { curCaseId: 'case-B', draft: { id: 'out_1', caseId: 'case-B', fields: {} }, pushed: [] };
  const r = eerAppendRecord(state, Object.assign({}, VALID_RECORD, { caseId: 'case-A' })); // 別案件のRecordを混入させようとした場合
  assert(r.ok === false && r.reason === 'caseId_mismatch', '別caseのRecordは保存拒否');
  assert(!state.draft.fields.externalExecution, 'case-BのDraftへ保存されていない');
}

caseHeader('Case 14: draft_case_mismatch — 現在表示中のDraftが別案件の場合は保存しない');
{
  const state = { curCaseId: 'case-A', draft: { id: 'out_1', caseId: 'case-B', fields: {} }, pushed: [] }; // Draftが別案件のまま
  const r = eerAppendRecord(state, Object.assign({}, VALID_RECORD, { caseId: 'case-A' }));
  assert(r.ok === false && r.reason === 'draft_case_mismatch', '現在Draftのcase不一致時は保存しない');
}

caseHeader('Case 15: 入力非破壊 — validation前後で入力Recordが変更されない');
{
  const original = Object.assign({}, VALID_RECORD);
  const snapshot = JSON.stringify(original);
  validateExternalExecutionRecord(original, 'case-test-A');
  assert(JSON.stringify(original) === snapshot, 'validateExternalExecutionRecord()はrecordを書き換えない');

  const state = { curCaseId: 'case-test-A', draft: { id: 'out_1', caseId: 'case-test-A', fields: {} }, pushed: [] };
  const original2 = Object.assign({}, VALID_RECORD);
  const snapshot2 = JSON.stringify(original2);
  eerAppendRecord(state, original2);
  assert(JSON.stringify(original2) === snapshot2, '_eerAppendRecord()は渡されたrecord自体を書き換えない');
}

caseHeader('Case 16: 欠落値の自動補完禁止 — caseId/executedAt/sourceが欠落したRecordはFormal Truth化しない');
{
  const rNoCaseId    = { executionType: 'instagram_account_created', status: 'executed', source: 'user_confirmation', actor: 'user', executedAt: '2026-08-21T00:00:00.000Z' };
  const rNoExecuted  = { executionType: 'instagram_account_created', status: 'executed', caseId: 'case-test-A', source: 'user_confirmation', actor: 'user' };
  const rNoSource    = { executionType: 'instagram_account_created', status: 'executed', caseId: 'case-test-A', actor: 'user', executedAt: '2026-08-21T00:00:00.000Z' };
  assert(validateExternalExecutionRecord(rNoCaseId, 'case-test-A').valid === false, 'caseId欠落 → rejected（推測補完しない）');
  assert(validateExternalExecutionRecord(rNoExecuted, 'case-test-A').valid === false, 'executedAt欠落 → rejected（推測補完しない）');
  assert(validateExternalExecutionRecord(rNoSource, 'case-test-A').valid === false, 'source欠落 → rejected（推測補完しない）');
}

caseHeader('Case 17: 保存・復元 — JSON serialize → restore でEER一致（output_drafts.fields JSONB相当）');
{
  const state = { curCaseId: 'case-test-A', draft: { id: 'out_1', caseId: 'case-test-A', fields: {} }, pushed: [] };
  eerAppendRecord(state, Object.assign({}, VALID_RECORD, { executionType: 'instagram_account_created', packageId: 'iadp_x' }));
  eerAppendRecord(state, Object.assign({}, VALID_RECORD, { executionType: 'asp_registered' }));
  // POST payload相当（buildOutputDraftPayloadForServer: fields: draft.fields || null）→ JSON化
  const payload = JSON.stringify({ outputId: state.draft.id, caseId: state.draft.caseId, fields: state.draft.fields });
  // GET restore相当（_outputDraftFromServerRow: fields: row.fields || {}）→ JSON復元
  const row = JSON.parse(payload);
  const restored = { id: row.outputId, caseId: row.caseId, fields: row.fields || {} };
  assert(Array.isArray(restored.fields.externalExecution), '復元後もexternalExecutionが配列として存在');
  assert(restored.fields.externalExecution.length === 2, '復元後も2件のRecordが保持されている');
  assert(restored.fields.externalExecution[0].packageId === 'iadp_x', 'packageId等の内容も一致');
  assert(JSON.stringify(restored.fields.externalExecution) === JSON.stringify(state.draft.fields.externalExecution), 'serialize→restoreで完全一致');
}

caseHeader('Case 18: AI推測からのFormal Truth生成禁止 — Ready/Approved等の内部状態はvalidationの入力にならない');
{
  // Readyの内部シグナル（accountCreationReadiness='ready' 等）をrecordへ混入させても、
  // validateExternalExecutionRecord()はsource==='user_confirmation'以外を一切受理しない
  const rFromReadiness = Object.assign({}, VALID_RECORD, { source: 'derived_from_readiness' });
  const rFromApproval  = Object.assign({}, VALID_RECORD, { source: 'derived_from_approval' });
  assert(validateExternalExecutionRecord(rFromReadiness, 'case-test-A').valid === false, 'Readiness由来source → rejected');
  assert(validateExternalExecutionRecord(rFromApproval, 'case-test-A').valid === false, 'Approval由来source → rejected');
}

caseHeader('Case 19: 既存FORMAL_CASE_FIELDS 4キーは無影響（回帰確認）');
{
  const lastDraft = {
    id: 'out_old', caseId: 'case-test-A',
    fields: {
      iadp: { package: { packageId: 'iadp_x' } },
      intelligenceContext: { evidence: [1, 2, 3] },
      affiliateContext: { product: 'x' },
      approvedDecisionPackage: { decisionId: 'd1' },
      externalExecution: [Object.assign({}, VALID_RECORD)],
    },
  };
  const newDraft = { id: 'out_new', caseId: 'case-test-A', fields: {} };
  const merged = carryForwardFormalFields(lastDraft, 'case-test-A', newDraft);
  assert(merged.fields.iadp && merged.fields.iadp.package.packageId === 'iadp_x', 'iadp carry-forward 無回帰');
  assert(merged.fields.intelligenceContext.evidence.length === 3, 'intelligenceContext carry-forward 無回帰');
  assert(merged.fields.affiliateContext.product === 'x', 'affiliateContext carry-forward 無回帰');
  assert(merged.fields.approvedDecisionPackage.decisionId === 'd1', 'approvedDecisionPackage carry-forward 無回帰');
  assert(merged.fields.externalExecution.length === 1, 'externalExecution carry-forward も同時に動作');
}

// ──────────────────────────────────────────────────────────────
// 結果サマリー
// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All EER-1 Core cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
