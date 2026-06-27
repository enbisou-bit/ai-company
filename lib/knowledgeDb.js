const { supabase } = require('./supabase');

const GENRES = ['塗装', '物販', 'sns', '動画', '営業', 'lp', '求人', 'ai', 'branding', '一般'];

async function getLibrary(genre) {
  if (!supabase) return { entries: [], source: 'fallback' };
  try {
    let q = supabase.from('knowledge_library').select('*').order('added_at', { ascending: false });
    if (genre) q = q.eq('genre', genre).limit(10);
    else q = q.limit(200);
    const { data, error } = await q;
    if (error) return { entries: [], source: 'fallback', error: error.message };
    return { entries: data || [], source: 'db' };
  } catch (e) { return { entries: [], source: 'error', error: e.message }; }
}

async function getAllByGenre() {
  if (!supabase) return { library: {}, source: 'fallback' };
  try {
    const { data, error } = await supabase
      .from('knowledge_library').select('*').order('added_at', { ascending: false });
    if (error) return { library: {}, source: 'fallback' };
    const library = {};
    (data || []).forEach(e => {
      if (!library[e.genre]) library[e.genre] = [];
      library[e.genre].push(e);
    });
    return { library, genres: GENRES, source: 'db' };
  } catch (e) { return { library: {}, source: 'error' }; }
}

async function addEntry({ id, genre, title, content, source }) {
  if (!supabase) return { error: 'Supabase未設定' };
  try {
    const { error } = await supabase.from('knowledge_library').insert({
      id:      id || `kn-${Date.now()}`,
      genre:   genre || '一般',
      title:   (title   || '').slice(0, 100),
      content: (content || '').slice(0, 400),
      source:  source || 'manual',
    });
    // 同ジャンルが30件超えたら古いものを削除
    const { data: all } = await supabase.from('knowledge_library')
      .select('id').eq('genre', genre).order('added_at', { ascending: true });
    if (all && all.length > 30) {
      const toDelete = all.slice(0, all.length - 30).map(r => r.id);
      await supabase.from('knowledge_library').delete().in('id', toDelete);
    }
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

async function deleteEntry(id) {
  if (!supabase) return { error: 'Supabase未設定' };
  try {
    const { error } = await supabase.from('knowledge_library').delete().eq('id', id);
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

async function getByGenreForPrompt(genre, limit = 3) {
  if (!supabase) return [];
  try {
    const { data } = await supabase.from('knowledge_library').select('title,content')
      .eq('genre', genre).order('added_at', { ascending: false }).limit(limit);
    return data || [];
  } catch { return []; }
}

module.exports = { getLibrary, getAllByGenre, addEntry, deleteEntry, getByGenreForPrompt, GENRES };
