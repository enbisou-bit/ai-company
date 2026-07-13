const { supabase } = require('./supabase');

// タスク一覧取得
// Phase54-3a-2: caseId は任意フィルタ（未指定時は従来どおり全件取得＝backfill契約維持）。
async function getTasks({ memberId, status, caseId } = {}) {
  if (!supabase) return { tasks: [], source: 'fallback', error: 'Supabase未設定' };
  try {
    let query = supabase
      .from('tasks')
      .select('*, members(id, name, icon, role)')
      .order('created_at', { ascending: false });

    if (memberId) query = query.eq('assigned_member_id', memberId);
    if (status)   query = query.eq('status', status);
    if (caseId)   query = query.eq('case_id', caseId);   // Phase54-3a-2: 指定時のみ案件フィルタ（未指定は全件）

    const { data, error } = await query;
    if (error) return { tasks: [], source: 'db', error: error.message };
    return { tasks: data || [], source: 'db', error: null };
  } catch (e) {
    return { tasks: [], source: 'error', error: e.message };
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

module.exports = { getTasks, createTask, updateTaskStatus, addTaskLog };
