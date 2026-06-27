const { supabase } = require('./supabase');

async function saveMemory({ id, memoryType, genre, summary, members, rating, reason, complaint, resolution, beforeText, afterText }) {
  if (!supabase) return { error: 'Supabase未設定' };
  try {
    const { error } = await supabase.from('company_memory').insert({
      id:          id || `cm-${Date.now()}`,
      memory_type: memoryType,
      genre:       genre || null,
      summary:     (summary || '').slice(0, 200),
      members:     members || [],
      rating:      rating  || null,
      reason:      reason  || null,
      complaint:   complaint  || null,
      resolution:  resolution || null,
      before_text: beforeText || null,
      after_text:  afterText  || null,
    });
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

async function getMemories({ memoryType, genre, limit = 20 } = {}) {
  if (!supabase) return { data: [], source: 'fallback' };
  try {
    let q = supabase.from('company_memory').select('*')
      .order('saved_at', { ascending: false }).limit(limit);
    if (memoryType) q = q.eq('memory_type', memoryType);
    if (genre)      q = q.eq('genre', genre);
    const { data, error } = await q;
    if (error) return { data: [], source: 'fallback', error: error.message };
    return { data: data || [], source: 'db' };
  } catch (e) { return { data: [], source: 'error', error: e.message }; }
}

async function getStats() {
  if (!supabase) return { stats: {}, source: 'fallback' };
  try {
    const { data, error } = await supabase
      .from('company_memory')
      .select('memory_type');
    if (error) return { stats: {}, source: 'fallback' };
    const stats = {};
    (data || []).forEach(r => { stats[r.memory_type] = (stats[r.memory_type] || 0) + 1; });
    return { stats, source: 'db' };
  } catch (e) { return { stats: {}, source: 'error' }; }
}

// 評価に基づいて会社記憶を自動分類・保存
async function autoSave({ memberId, genre, userMessage, aiReply, rating, improvement }) {
  const r = Number(rating);
  const id = `cm-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
  const summary = (userMessage || '').slice(0, 80);
  const promises = [];

  if (r >= 4) promises.push(saveMemory({ id: id + 's', memoryType: 'success', genre, summary, members: [memberId], rating: r }));
  if (r === 5) promises.push(saveMemory({ id: id + 'h', memoryType: 'high_rating', genre, summary, rating: r }));
  if (r <= 2)  promises.push(saveMemory({ id: id + 'f', memoryType: 'failure', genre, summary, members: [memberId], rating: r, reason: improvement || '評価低' }));
  if (r === 1 && improvement) promises.push(saveMemory({ id: id + 'c', memoryType: 'complaint', genre, summary, complaint: improvement }));
  if (improvement && r >= 3)  promises.push(saveMemory({ id: id + 'i', memoryType: 'improvement', genre, beforeText: summary, afterText: improvement }));

  await Promise.allSettled(promises);
}

module.exports = { saveMemory, getMemories, getStats, autoSave };
