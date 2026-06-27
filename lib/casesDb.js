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

async function getCases({ memberId } = {}) {
  if (!supabase) return { cases: [], source: 'fallback' };
  try {
    let q = supabase.from('cases').select('*').order('ts', { ascending: false });
    if (memberId) q = q.contains('member_ids', [memberId]);
    const { data, error } = await q;
    if (error) return { cases: [], source: 'fallback', error: error.message };
    return { cases: data || [], source: 'db' };
  } catch (e) { return { cases: [], source: 'error', error: e.message }; }
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

module.exports = { upsertCase, getCases, updateCasePurpose };
