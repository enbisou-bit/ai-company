// lib/approvalsDb.js （Phase54-1b: Approval Sync サーバー永続化・A案case_idスコープ）
const { supabase } = require('./supabase');

// 承認/公開状態のupsert（case_id完全一致1件・onConflict: case_id）
async function upsertApproval({ caseId, approvalDecision, approvedAt, published, publishedAt, archived, checklist, reviewStatus }) {
  if (!supabase) return { error: 'Supabase未設定' };
  if (!caseId) return { error: 'caseId は必須です' };
  try {
    const { error } = await supabase.from('output_approvals').upsert({
      case_id:           caseId,
      approval_decision: approvalDecision || null,
      approved_at:       approvedAt || null,
      published:         !!published,
      published_at:      publishedAt || null,
      archived:          !!archived,
      checklist:         checklist || null,
      review_status:     reviewStatus || null,
      updated_at:        new Date().toISOString(),
    }, { onConflict: 'case_id' });
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
async function getApproval(caseId) {
  if (!supabase) return { approval: null, source: 'fallback' };
  if (!caseId) return { approval: null, source: 'error', error: 'caseId は必須です' };
  try {
    const { data, error } = await supabase.from('output_approvals').select('*').eq('case_id', caseId).maybeSingle();
    if (error) return { approval: null, source: 'fallback', error: error.message };
    return { approval: data || null, source: 'db' };
  } catch (e) { return { approval: null, source: 'error', error: e.message }; }
}

module.exports = { upsertApproval, getApprovals, getApproval };
