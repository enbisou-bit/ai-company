const { supabase } = require('./supabase');

// タスク一覧取得
async function getTasks({ memberId, status } = {}) {
  if (!supabase) return { tasks: [], source: 'fallback', error: 'Supabase未設定' };
  try {
    let query = supabase
      .from('tasks')
      .select('*, members(id, name, icon, role)')
      .order('created_at', { ascending: false });

    if (memberId) query = query.eq('assigned_member_id', memberId);
    if (status)   query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return { tasks: [], source: 'db', error: error.message };
    return { tasks: data || [], source: 'db', error: null };
  } catch (e) {
    return { tasks: [], source: 'error', error: e.message };
  }
}

// タスク作成
async function createTask({ title, description, assignedMemberId, createdBy, sourceMessage, priority } = {}) {
  if (!supabase) return { task: null, error: 'Supabase未設定' };
  try {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('tasks')
      .insert({
        title: title || '(無題)',
        description: description || null,
        assigned_member_id: assignedMemberId || null,
        created_by: createdBy || 'web-user',
        source_message: sourceMessage || null,
        priority: priority || 'mid',
        status: 'pending',
        created_at: now,
        updated_at: now,
      })
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
