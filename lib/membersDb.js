const { supabase } = require('./supabase');
const customMembersDb = require('./customMembersDb');
const { buildFallbackMembers } = require('../openaiClient');

// FALLBACK_MEMBERS を LINE_AGENT_PROFILES から動的生成
// 新担当追加時は openaiClient.js の LINE_AGENT_PROFILES に追加するだけで自動反映される
// （旧ハードコード配列は下記コメントとして保存 — 削除禁止）
const FALLBACK_MEMBERS = buildFallbackMembers();

/* 旧ハードコード配列（参照用・削除禁止）
const FALLBACK_MEMBERS_LEGACY = [
  { id: 'leader',     name: 'Leader',     role: 'マーケリーダー',   icon: '🎯', is_active: true },
  { id: 'strategy',   name: 'Strategy',   role: '戦略顧問',         icon: '♟️', is_active: true },
  { id: 'secretary',  name: 'Secretary',  role: '秘書',             icon: '📋', is_active: true },
  { id: 'reviewer',   name: 'Reviewer',   role: 'レビュワー',       icon: '🔎', is_active: true },
  { id: 'sns',        name: 'SNS',        role: 'SNS担当',          icon: '📱', is_active: true },
  { id: 'video',      name: 'Video',      role: '動画担当',          icon: '🎬', is_active: true },
  { id: 'nurture',    name: 'Nurture',    role: 'ナーチャリング',    icon: '💌', is_active: true },
  { id: 'branding',   name: 'Branding',   role: 'ブランディング',    icon: '✨', is_active: true },
  { id: 'writer',     name: 'Writer',     role: 'ライター',          icon: '✍️', is_active: true },
  { id: 'designer',   name: 'Designer',   role: 'デザイナー',        icon: '🎨', is_active: true },
  { id: 'lp',         name: 'LP',         role: 'LP/Web担当',       icon: '📄', is_active: true },
  { id: 'analyst',    name: 'Analyst',    role: 'アナリスト',        icon: '📊', is_active: true },
  { id: 'researcher', name: 'Researcher', role: 'リサーチャー',      icon: '🔍', is_active: true },
  { id: 'sales',      name: 'Sales',      role: '営業担当',          icon: '🤝', is_active: true },
  { id: 'cs',         name: 'CS',         role: '顧客対応担当',      icon: '💬', is_active: true },
];
*/

// カスタム担当 + LINE_AGENT_PROFILES 担当をマージ
// Supabase接続時は base = Supabase data。FALLBACK_MEMBERS に含まれる新担当が
// Supabase未登録の場合でも自動補完することで、personaRegistry 追加が即時反映される
function mergeCustomMembers(base) {
  const baseIds = new Set(base.map(m => m.id));
  // カスタム担当（管理画面から追加）をマージ
  const custom  = customMembersDb.getAll();
  const customOnes = custom
    .filter(c => !baseIds.has(c.id))
    .map(c => ({
      id:        c.id,
      name:      c.name,
      role:      c.description || c.name,
      icon:      c.emoji || '🤖',
      is_active: true,
    }));
  // LINE_AGENT_PROFILES 担当で base に含まれていないものを自動補完
  // → 新担当を LINE_AGENT_PROFILES に追加しただけで /api/members に反映される
  const profileOnes = FALLBACK_MEMBERS.filter(m => !baseIds.has(m.id) && !custom.some(c => c.id === m.id));
  return [...base, ...customOnes, ...profileOnes];
}

async function getMembers() {
  if (!supabase) {
    return { members: mergeCustomMembers(FALLBACK_MEMBERS), source: 'fallback' };
  }
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.warn('[membersDb] DB取得エラー → fallback:', error.message);
      return { members: mergeCustomMembers(FALLBACK_MEMBERS), source: 'fallback' };
    }
    if (!data || data.length === 0) {
      console.warn('[membersDb] DBにメンバーなし → fallback');
      return { members: mergeCustomMembers(FALLBACK_MEMBERS), source: 'fallback' };
    }
    return { members: mergeCustomMembers(data), source: 'db' };
  } catch (e) {
    console.warn('[membersDb] 例外 → fallback:', e.message);
    return { members: mergeCustomMembers(FALLBACK_MEMBERS), source: 'fallback' };
  }
}

async function getMemberById(id) {
  if (!supabase) return FALLBACK_MEMBERS.find(m => m.id === id) || null;
  try {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .eq('id', id)
      .single();
    if (error || !data) return FALLBACK_MEMBERS.find(m => m.id === id) || null;
    return data;
  } catch {
    return FALLBACK_MEMBERS.find(m => m.id === id) || null;
  }
}

module.exports = { getMembers, getMemberById, FALLBACK_MEMBERS };
