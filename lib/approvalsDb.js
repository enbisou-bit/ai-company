// lib/approvalsDb.js （Phase54-1b: Approval Sync サーバー永続化・A案case_idスコープ）
const { supabase } = require('./supabase');

// 承認/公開状態のupsert（case_id完全一致1件・onConflict: case_id）
// Phase54-1f: 任意の outputId を受け取り output_id へ保存（未指定時は列を送らず既存値を保持＝undefinedで壊さない）
async function upsertApproval({ caseId, outputId, approvalDecision, approvedAt, published, publishedAt, archived, checklist, reviewStatus }) {
  if (!supabase) return { error: 'Supabase未設定' };
  if (!caseId) return { error: 'caseId は必須です' };
  try {
    const row = {
      case_id:           caseId,
      approval_decision: approvalDecision || null,
      approved_at:       approvedAt || null,
      published:         !!published,
      published_at:      publishedAt || null,
      archived:          !!archived,
      checklist:         checklist || null,
      review_status:     reviewStatus || null,
      updated_at:        new Date().toISOString(),
    };
    if (outputId) row.output_id = outputId;   // Phase54-1f: 指定時のみ書き込む（旧呼び出しは従来どおり）
    const { error } = await supabase.from('output_approvals').upsert(row, { onConflict: 'case_id' });
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

// 全件取得（source:'db'|'fallback'|'error' を返す＝casesDbと同規約）
async function getApprovals() {
  if (!supabase) return { approvals: [], source: 'fallback' };
  try {
    const { data, error } = await supabase.from('output_approvals').select('*');
    if (error) return { approvals: [], source: 'fallback', error: error.message };
    return { approvals: data || [], source: 'db' };
  } catch (e) { return { approvals: [], source: 'error', error: e.message }; }
}

// case_id 指定取得（1件）
// Phase54-1f: 任意の outputId 指定時は case_id + output_id 一致行のみ返す（未指定時は従来動作）
async function getApproval(caseId, outputId) {
  if (!supabase) return { approval: null, source: 'fallback' };
  if (!caseId) return { approval: null, source: 'error', error: 'caseId は必須です' };
  try {
    let q = supabase.from('output_approvals').select('*').eq('case_id', caseId);
    if (outputId) q = q.eq('output_id', outputId);
    const { data, error } = await q.maybeSingle();
    if (error) return { approval: null, source: 'fallback', error: error.message };
    return { approval: data || null, source: 'db' };
  } catch (e) { return { approval: null, source: 'error', error: e.message }; }
}

module.exports = { upsertApproval, getApprovals, getApproval };
