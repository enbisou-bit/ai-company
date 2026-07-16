const { supabase } = require('./supabase');

async function upsertCase({ id, title, userText, genre, memberIds, purpose, proposals, result }) {
  if (!supabase) return { error: 'Supabase未設定' };
  try {
    const { error } = await supabase.from('cases').upsert({
      id,
      title:      title || '',
      user_text:  userText || '',
      genre:      genre || null,
      member_ids: memberIds || [],
      purpose:    purpose || null,
      proposals:  proposals || [],
      result:     result || null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'id' });
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

// 不具合②-A: 生存案件のみ返す（deleted_at NULL=生存）。全件GET（memberId未指定）時のみ deletedIds を返す＝
// クライアントは「deletedIdsに載ったidだけ」localから除去する（GET結果に無い=削除、とは推論しない＝local-only案件保護）。
// select('*') 維持のため deleted_at 列が未追加のDBでも列名エラーにならない（graceful）。
async function getCases({ memberId } = {}) {
  if (!supabase) return { cases: [], deletedIds: [], total: 0, source: 'fallback' };
  try {
    let q = supabase.from('cases').select('*').order('ts', { ascending: false });
    if (memberId) q = q.contains('member_ids', [memberId]);
    const { data, error } = await q;
    if (error) return { cases: [], deletedIds: [], total: 0, source: 'fallback', error: error.message };

    const rows = data || [];
    const survivors = rows.filter(r => r.deleted_at == null);   // deleted_at 未定義/NULL=生存
    const isFullGet = !memberId;                                // authoritative snapshot は全件GETのみ
    const deletedIds = isFullGet ? rows.filter(r => r.deleted_at != null).map(r => r.id) : [];
    return { cases: survivors, deletedIds, total: survivors.length, source: 'db' };
  } catch (e) { return { cases: [], deletedIds: [], total: 0, source: 'error', error: e.message }; }
}

async function updateCasePurpose(id, { purpose, proposal, result }) {
  if (!supabase) return { error: 'Supabase未設定' };
  try {
    const { data: existing } = await supabase.from('cases').select('proposals').eq('id', id).single();
    const proposals = existing?.proposals || [];
    if (proposal) proposals.push(proposal);
    const { error } = await supabase.from('cases').update({
      purpose:    purpose     !== undefined ? purpose    : undefined,
      proposals:  proposal    !== undefined ? proposals  : undefined,
      result:     result      !== undefined ? result     : undefined,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

// 不具合②-A: 案件の論理削除（物理削除しない＝行は残す・deleted_at で削除済みを表現・復元可）。
// 冪等: 既に deleted_at 非NULL の行は再UPDATEせず alreadyDeleted で成功扱い。存在しないidは notFound。
// messages / conversations / task_history / Learning には一切触れない（履歴保護）。
async function softDeleteCase(id) {
  if (!supabase) return { case: null, error: 'Supabase未設定' };
  if (!id) return { case: null, error: 'id は必須です' };
  try {
    // 冪等判定のため現行行を取得（select('*') で deleted_at 列未追加でも列名エラーにしない）
    const { data: rows, error: selErr } = await supabase
      .from('cases')
      .select('*')
      .eq('id', id)
      .limit(1);
    if (selErr) return { case: null, error: selErr.message };
    const existing = rows && rows[0];
    if (!existing) return { case: null, error: 'not_found', notFound: true };
    if (existing.deleted_at != null) return { case: existing, error: null, alreadyDeleted: true };   // 二重削除=冪等成功

    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from('cases')
      .update({ deleted_at: now, updated_at: now })
      .eq('id', id)
      .select()
      .single();
    if (error) return { case: null, error: error.message };
    return { case: data, error: null };
  } catch (e) { return { case: null, error: e.message }; }
}

// Phase52-12.1: 案件削除（id完全一致1件のみ・cases行のみ削除。messages/conversationsには一切触れない）
// 不具合②-A: 物理削除のため未配線として残置（呼び出し元は softDeleteCase へ移行済み・削除禁止ルールにより関数は削除しない）
async function deleteCase(id) {
  if (!supabase) return { error: 'Supabase未設定' };
  if (!id) return { error: 'id は必須です' };
  try {
    const { error } = await supabase.from('cases').delete().eq('id', id);
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

module.exports = { upsertCase, getCases, updateCasePurpose, deleteCase, softDeleteCase };
