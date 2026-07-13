// lib/taskHistoryDb.js （Phase54-3b-1: Task History Persistence サーバー永続化）
// ※ global.__taskHistory（サーバーメモリ・非DB・Render再起動で消失）を task_history テーブルへ永続化する。
// ※ approvalsDb.js / outputDraftsDb.js のエラー処理・Supabase接続方式・返却形式（source:'db'|'fallback'|'error'）を踏襲。
// ※ history_id で冪等upsert（status running→completed の同一エントリ更新に対応）。
// ※ APIレスポンス形は変更しない：getHistory はアプリのエントリ形（historyId/from/to/... のcamelCase）へ復元して返す。
// ※ case_id は Phase54-3b-1では常にNULL（配線は3b-2）。status はCHECKなし（tasks.status CHECKトラップを避ける）。
const { supabase } = require('./supabase');

// アプリのエントリで「標準列」に対応するキー（残りは meta JSONB へ退避）。
const _STD_KEYS = new Set([
  'historyId', 'workflowId', 'caseId', 'from', 'to', 'taskId',
  'action', 'instruction', 'status', 'type', 'note', 'requestedAt', 'completedAt',
]);

// アプリのエントリ → task_history 行（snake_case）。標準外フィールドは meta へ集約。
function _rowFromEntry(e) {
  const meta = {};
  for (const k of Object.keys(e || {})) {
    if (!_STD_KEYS.has(k)) meta[k] = e[k];   // responseMs / ruleCount / knowledgeSummary 等の可変fieldを保存
  }
  return {
    history_id:   e.historyId,
    workflow_id:  e.workflowId != null ? e.workflowId : null,
    case_id:      e.caseId != null ? e.caseId : null,   // 3b-1は常にNULL（横断）
    from_agent:   e.from != null ? e.from : null,
    to_agent:     e.to != null ? e.to : null,
    task_id:      e.taskId != null ? e.taskId : null,
    action:       e.action != null ? e.action : null,
    instruction:  e.instruction != null ? e.instruction : null,
    status:       e.status != null ? e.status : null,
    type:         e.type != null ? e.type : null,
    note:         e.note != null ? e.note : null,
    meta:         Object.keys(meta).length > 0 ? meta : null,
    requested_at: e.requestedAt || null,
    completed_at: e.completedAt || null,
  };
}

// task_history 行 → アプリのエントリ形（camelCase）。meta は top-level へ展開して復元（既存consumer互換）。
function _entryFromRow(r) {
  if (!r) return null;
  const base = {
    historyId:   r.history_id,
    workflowId:  r.workflow_id != null ? r.workflow_id : null,
    caseId:      r.case_id != null ? r.case_id : null,
    from:        r.from_agent != null ? r.from_agent : null,
    to:          r.to_agent != null ? r.to_agent : null,
    taskId:      r.task_id != null ? r.task_id : null,
    action:      r.action != null ? r.action : null,
    instruction: r.instruction != null ? r.instruction : null,
    status:      r.status != null ? r.status : null,
    type:        r.type != null ? r.type : null,
    note:        r.note != null ? r.note : null,
    requestedAt: r.requested_at || null,
    completedAt: r.completed_at || null,
  };
  if (r.meta && typeof r.meta === 'object') {
    for (const k of Object.keys(r.meta)) {
      if (base[k] === undefined) base[k] = r.meta[k];   // 可変fieldを復元（標準キーは壊さない）
    }
  }
  return base;
}

// 1エントリを history_id で冪等upsert（fire-and-forget呼び出し前提・失敗はerror返却のみでthrowしない）。
async function upsertHistoryEntry(entry) {
  if (!supabase) return { error: 'Supabase未設定' };
  if (!entry || !entry.historyId) return { error: 'historyId は必須です' };
  try {
    const row = _rowFromEntry(entry);
    const { error } = await supabase.from('task_history').upsert(row, { onConflict: 'history_id' });
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

// 複数エントリをまとめて冪等upsert（配列・history_idで一括onConflict）。
async function upsertHistoryEntries(entries) {
  if (!supabase) return { error: 'Supabase未設定' };
  if (!Array.isArray(entries) || entries.length === 0) return { error: null, count: 0 };
  try {
    const rows = entries.filter(e => e && e.historyId).map(_rowFromEntry);
    if (rows.length === 0) return { error: null, count: 0 };
    const { error } = await supabase.from('task_history').upsert(rows, { onConflict: 'history_id' });
    return { error: error?.message || null, count: rows.length };
  } catch (e) { return { error: e.message }; }
}

// 履歴取得（from/to/caseId/workflowId 任意フィルタ・requested_at 昇順）。アプリのエントリ形の配列を返す。
async function getHistory({ from, to, caseId, workflowId } = {}) {
  if (!supabase) return { history: [], source: 'fallback', error: 'Supabase未設定' };
  try {
    let q = supabase.from('task_history').select('*').order('requested_at', { ascending: true });
    if (from)       q = q.eq('from_agent', from);
    if (to)         q = q.eq('to_agent', to);
    if (caseId)     q = q.eq('case_id', caseId);
    if (workflowId) q = q.eq('workflow_id', workflowId);
    const { data, error } = await q;
    if (error) return { history: [], source: 'fallback', error: error.message };
    return { history: (data || []).map(_entryFromRow).filter(Boolean), source: 'db', error: null };
  } catch (e) { return { history: [], source: 'error', error: e.message }; }
}

module.exports = { upsertHistoryEntry, upsertHistoryEntries, getHistory };
