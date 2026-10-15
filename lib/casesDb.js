// 既存表のアクセス境界: cases／output_drafts は server-only privileged client だけで扱う（anon client へは戻らない・lib/caseDraftSupabase.js 参照）。
// サーバー用キーが無い環境では、全操作が 'server_key_missing' のエラーになる（URL も無いローカル環境は従来どおり null＝fallback）。
const { caseDraftClient: supabase } = require('./caseDraftSupabase');

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

// Instagram Daily Production: case を ID で1件確認する（読み取りのみ・既存関数は変更しない）。
//   戻り値: { ok:true, exists:true } ／ { ok:true, exists:false, deleted? } ／ { ok:false, outcome:'not_connected'|'invalid_input'|'db_error', code }
//   SQLSTATE 等のコードが無いエラー・例外（取得できたか不明）は例外にする → 呼び出し側は有料経路へ進まない。
//   ★ 存在と論理削除の確認だけ。個人の所有・アクセス権の確認ではない（cases に所有者列は無い）。
//   ★ client を opts.client で注入できる（テストは偽 client だけを使う）。未指定時は server-only の caseDraftClient。
async function getCaseById(id, opts) {
  const client = (opts && opts.client) || supabase;
  if (!client || typeof client.from !== 'function') return { ok: false, outcome: 'not_connected' };
  if (typeof id !== 'string' || id.length === 0 || id.length > 200) return { ok: false, outcome: 'invalid_input' };
  let res;
  try { res = await client.from('cases').select('*').eq('id', id).limit(2); } catch (e) { throw new Error('case_lookup_unknown'); }
  if (!res || typeof res !== 'object') throw new Error('case_lookup_unknown');
  if (res.error) {
    const code = typeof res.error.code === 'string' ? res.error.code : '';
    if (/^[0-9A-Z]{5}$/.test(code) || /^PGRST\d+$/.test(code)) return { ok: false, outcome: 'db_error', code };
    throw new Error('case_lookup_unknown');
  }
  const rows = Array.isArray(res.data) ? res.data : null;
  if (!rows || rows.length > 1) throw new Error('case_lookup_unknown');
  if (rows.length === 0) return { ok: true, exists: false };
  if (rows[0].id !== id) throw new Error('case_lookup_unknown');
  if (rows[0].deleted_at != null) return { ok: true, exists: false, deleted: true };
  return { ok: true, exists: true };
}

module.exports = { upsertCase, getCases, updateCasePurpose, deleteCase, softDeleteCase, getCaseById };
