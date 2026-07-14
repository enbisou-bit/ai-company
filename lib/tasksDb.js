const { supabase } = require('./supabase');

// Phase54 Hotfix: 削除署名（local-only Task再POST防止用）。client _taskSignature と同型
//   （title¦assigned_member_id¦source_message¦description）。memberId は trim しない（client踏襲）。
function _rowSignature(r) {
  return [
    (r && r.title ? String(r.title).trim() : ''),
    (r && r.assigned_member_id ? String(r.assigned_member_id) : ''),
    (r && r.source_message ? String(r.source_message).trim() : ''),
    (r && r.description ? String(r.description).trim() : ''),
  ].join('¦');
}

// タスク一覧取得
// Phase54-3a-2: caseId は任意フィルタ（未指定時は従来どおり全件取得＝backfill契約維持）。
// Phase54 Hotfix: tasks は生存Taskのみ（deleted_at IS NULL）を返す。deleted_at 列は select('*') で取得し JS で判定
//   （列未追加のDBでも undefined=生存扱いで graceful＝ALTER前でも既存GETが壊れない）。
//   引数なし全件GET（memberId/status/caseId すべて未指定）のときだけ deletedIds/deletedSignatures を返す
//   ＝案件限定GETには全体の削除集合を渡さない（client の「案件GETで全体照合しない」契約を server 側でも担保）。
async function getTasks({ memberId, status, caseId } = {}) {
  if (!supabase) return { tasks: [], deletedIds: [], deletedSignatures: [], total: 0, source: 'fallback', error: 'Supabase未設定' };
  try {
    let query = supabase
      .from('tasks')
      .select('*, members(id, name, icon, role)')
      .order('created_at', { ascending: false });

    if (memberId) query = query.eq('assigned_member_id', memberId);
    if (status)   query = query.eq('status', status);
    if (caseId)   query = query.eq('case_id', caseId);   // Phase54-3a-2: 指定時のみ案件フィルタ（未指定は全件）

    const { data, error } = await query;
    if (error) return { tasks: [], deletedIds: [], deletedSignatures: [], total: 0, source: 'db', error: error.message };

    const rows = data || [];
    const survivors = rows.filter(r => r.deleted_at == null);   // deleted_at 未定義/NULL=生存
    const isFullGet = !memberId && !status && !caseId;          // authoritative snapshot は全件GETのみ
    let deletedIds = [], deletedSignatures = [];
    if (isFullGet) {
      const deleted = rows.filter(r => r.deleted_at != null);
      deletedIds = deleted.map(r => r.id);
      deletedSignatures = deleted.map(r => _rowSignature(r));
    }
    return { tasks: survivors, deletedIds, deletedSignatures, total: survivors.length, source: 'db', error: null };
  } catch (e) {
    return { tasks: [], deletedIds: [], deletedSignatures: [], total: 0, source: 'error', error: e.message };
  }
}

// タスク作成
// Phase54-3a-2: caseId は任意（null/未指定時は列を送らずNULL維持＝後方互換）。messages.saveMessage と同型のガード。
async function createTask({ title, description, assignedMemberId, createdBy, sourceMessage, priority, caseId } = {}) {
  if (!supabase) return { task: null, error: 'Supabase未設定' };
  try {
    const now = new Date().toISOString();
    const row = {
      title: title || '(無題)',
      description: description || null,
      assigned_member_id: assignedMemberId || null,
      created_by: createdBy || 'web-user',
      source_message: sourceMessage || null,
      priority: priority || 'mid',
      status: 'pending',
      created_at: now,
      updated_at: now,
    };
    if (caseId != null) row.case_id = caseId;   // Phase54-3a-2: 指定時のみ case_id を保存（未指定はNULLのまま＝横断Task）
    const { data, error } = await supabase
      .from('tasks')
      .insert(row)
      .select()
      .single();

    if (error) return { task: null, error: error.message };
    return { task: data, error: null };
  } catch (e) {
    return { task: null, error: e.message };
  }
}

// ステータス更新
async function updateTaskStatus(dbId, status) {
  if (!supabase) return { task: null, error: 'Supabase未設定' };
  try {
    const { data, error } = await supabase
      .from('tasks')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', dbId)
      .select()
      .single();

    if (error) return { task: null, error: error.message };
    return { task: data, error: null };
  } catch (e) {
    return { task: null, error: e.message };
  }
}

// Phase54 Hotfix: 論理削除（物理削除しない＝行は残し deleted_at を設定＝Supabase保存維持）。
//   時刻は server 側で確定（client から任意 deleted_at を受け取らない）。冪等：既削除は再更新せず success。
//   存在しない id は notFound。DB失敗は error（client は local を削除しない＝保護）。
async function softDeleteTask(dbId) {
  if (!supabase) return { task: null, error: 'Supabase未設定' };
  try {
    // 冪等判定のため現行行を取得（select('*') で deleted_at 列未追加でも列名エラーにしない）
    const { data: rows, error: selErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', dbId)
      .limit(1);
    if (selErr) return { task: null, error: selErr.message };
    const existing = rows && rows[0];
    if (!existing) return { task: null, error: 'not_found', notFound: true };
    if (existing.deleted_at != null) return { task: existing, error: null, alreadyDeleted: true };  // 二重削除=冪等成功

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('tasks')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', dbId)
      .select()
      .single();
    if (error) return { task: null, error: error.message };
    return { task: data, error: null };
  } catch (e) {
    return { task: null, error: e.message };
  }
}

// Phase54 Hotfix: アーカイブ/復元（通常一覧から外す・後で戻せる・PC/iPhone同期）。
//   archived=true → archived_at=NOW()／archived=false → archived_at=NULL（復元）。時刻は server 側で確定。
//   物理削除しない・status/deleted_at は変更しない（base status と削除状態は保持）。
//   冪等：既にアーカイブ済みへの再アーカイブ・既に通常への再復元は再更新せず success。
//   存在しない id は notFound。DB失敗は error（client は local を変更しない＝保護）。
async function setTaskArchived(dbId, archived) {
  if (!supabase) return { task: null, error: 'Supabase未設定' };
  try {
    const { data: rows, error: selErr } = await supabase
      .from('tasks')
      .select('*')
      .eq('id', dbId)
      .limit(1);
    if (selErr) return { task: null, error: selErr.message };
    const existing = rows && rows[0];
    if (!existing) return { task: null, error: 'not_found', notFound: true };

    const isArchived = existing.archived_at != null;
    if (archived && isArchived)   return { task: existing, error: null, alreadyArchived: true };  // 冪等
    if (!archived && !isArchived) return { task: existing, error: null, alreadyActive: true };    // 冪等（復元）

    const now = new Date().toISOString();
    const patch = archived ? { archived_at: now, updated_at: now } : { archived_at: null, updated_at: now };
    const { data, error } = await supabase
      .from('tasks')
      .update(patch)
      .eq('id', dbId)
      .select()
      .single();
    if (error) return { task: null, error: error.message };
    return { task: data, error: null };
  } catch (e) {
    return { task: null, error: e.message };
  }
}

// タスクログ記録
async function addTaskLog({ taskId, memberId, action, message } = {}) {
  if (!supabase) return;
  try {
    await supabase.from('task_logs').insert({
      task_id: taskId,
      member_id: memberId || null,
      action: action || 'update',
      message: message || null,
      created_at: new Date().toISOString(),
    });
  } catch (e) {
    console.warn('[tasksDb] ログ記録エラー:', e.message);
  }
}

module.exports = { getTasks, createTask, updateTaskStatus, softDeleteTask, setTaskArchived, addTaskLog };
