const { supabase } = require('./supabase');

// ── 担当成長データ ─────────────────────────────────────────────
async function getLearning(memberId) {
  if (!supabase) return { data: { byGenre: {} }, source: 'fallback' };
  try {
    const { data, error } = await supabase
      .from('member_learning').select('*').eq('member_id', memberId);
    if (error) return { data: { byGenre: {} }, source: 'fallback' };
    const byGenre = {};
    (data || []).forEach(r => {
      byGenre[r.genre] = {
        success:      r.success_count,
        failure:      r.failure_count,
        avgRating:    r.avg_rating,
        count:        r.case_count,
        improvements: r.improvements || [],
      };
    });
    return { data: { byGenre }, source: 'db' };
  } catch (e) { return { data: { byGenre: {} }, source: 'error' }; }
}

async function upsertLearning({ memberId, genre, isSuccess, isFailure, rating, improvement }) {
  if (!supabase) return { error: 'Supabase未設定' };
  try {
    const { data: existing } = await supabase
      .from('member_learning').select('*')
      .eq('member_id', memberId).eq('genre', genre).single();

    if (existing) {
      const n = existing.case_count;
      const improvements = existing.improvements || [];
      if (improvement) improvements.push(improvement);
      const upd = {
        success_count: existing.success_count + (isSuccess ? 1 : 0),
        failure_count: existing.failure_count + (isFailure ? 1 : 0),
        avg_rating:    Math.round(((existing.avg_rating * n) + Number(rating)) / (n + 1) * 10) / 10,
        case_count:    n + 1,
        improvements:  improvements.slice(-10),
        updated_at:    new Date().toISOString(),
      };
      await supabase.from('member_learning').update(upd)
        .eq('member_id', memberId).eq('genre', genre);
    } else {
      await supabase.from('member_learning').insert({
        member_id:     memberId,
        genre,
        success_count: isSuccess ? 1 : 0,
        failure_count: isFailure ? 1 : 0,
        avg_rating:    Number(rating),
        case_count:    1,
        improvements:  improvement ? [improvement] : [],
      });
    }
    return { error: null };
  } catch (e) { return { error: e.message }; }
}

// ── ベスト回答 ────────────────────────────────────────────────
async function saveBestPractice({ memberId, genre, userMessage, reply, rating }) {
  if (!supabase) return { error: 'Supabase未設定' };
  try {
    const { error } = await supabase.from('best_practices').insert({
      member_id:    memberId,
      genre,
      user_message: (userMessage || '').slice(0, 100),
      reply:        (reply || '').slice(0, 400),
      rating:       Number(rating),
    });
    // 古いものを自動削除（担当ごとに最新20件まで）
    const { data: all } = await supabase.from('best_practices')
      .select('id').eq('member_id', memberId).order('saved_at', { ascending: true });
    if (all && all.length > 20) {
      const toDelete = all.slice(0, all.length - 20).map(r => r.id);
      await supabase.from('best_practices').delete().in('id', toDelete);
    }
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

async function getBestPractices(memberId, genre) {
  if (!supabase) return { practices: [], source: 'fallback' };
  try {
    let q = supabase.from('best_practices').select('*').eq('member_id', memberId)
      .order('saved_at', { ascending: false }).limit(5);
    if (genre) q = q.eq('genre', genre);
    const { data, error } = await q;
    if (error) return { practices: [], source: 'fallback' };
    return { practices: data || [], source: 'db' };
  } catch (e) { return { practices: [], source: 'error' }; }
}

// ── 失敗回答 ──────────────────────────────────────────────────
async function saveAvoidPractice({ memberId, genre, userMessage, reason, rating }) {
  if (!supabase) return { error: 'Supabase未設定' };
  try {
    const { error } = await supabase.from('avoid_practices').insert({
      member_id:    memberId,
      genre,
      user_message: (userMessage || '').slice(0, 100),
      reason:       reason || '評価低',
      rating:       Number(rating),
    });
    const { data: all } = await supabase.from('avoid_practices')
      .select('id').eq('member_id', memberId).order('saved_at', { ascending: true });
    if (all && all.length > 20) {
      const toDelete = all.slice(0, all.length - 20).map(r => r.id);
      await supabase.from('avoid_practices').delete().in('id', toDelete);
    }
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

async function getAvoidPractices(memberId, genre) {
  if (!supabase) return { practices: [], source: 'fallback' };
  try {
    let q = supabase.from('avoid_practices').select('*').eq('member_id', memberId)
      .order('saved_at', { ascending: false }).limit(5);
    if (genre) q = q.eq('genre', genre);
    const { data, error } = await q;
    if (error) return { practices: [], source: 'fallback' };
    return { practices: data || [], source: 'db' };
  } catch (e) { return { practices: [], source: 'error' }; }
}

module.exports = { getLearning, upsertLearning, saveBestPractice, getBestPractices, saveAvoidPractice, getAvoidPractices };
