const { createClient } = require('@supabase/supabase-js');

const _url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const _key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const supabase = (_url && _key) ? createClient(_url, _key) : null;

// 会話セッションを upsert（userId + memberId + channel で1セッション）
// .single()/.maybeSingle() は複数行でエラーになるため limit(1)+order で代替
async function upsertConversation({ userId, memberId, channel = 'web' }) {
  if (!supabase) return null;
  try {
    // 最新の既存セッションを1件取得（複数行あっても安全）
    const { data: rows } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('member_id', memberId)
      .eq('channel', channel)
      .order('updated_at', { ascending: false })
      .limit(1);
    const existing = rows && rows.length > 0 ? rows[0] : null;
    if (existing) {
      await supabase.from('conversations')
        .update({ updated_at: new Date().toISOString() })
        .eq('id', existing.id);
      return existing.id;
    }
    // 新規作成
    const { data, error } = await supabase
      .from('conversations')
      .insert({ user_id: userId, member_id: memberId, channel, updated_at: new Date().toISOString() })
      .select('id')
      .single();
    if (error) { console.warn('[conversationsDb] insert error:', error.message); return null; }
    return data?.id || null;
  } catch (e) {
    console.warn('[conversationsDb] upsert exception:', e.message);
    return null;
  }
}

// メッセージを保存
async function saveMessage({ conversationId, sender, content }) {
  if (!supabase || !conversationId) return;
  try {
    const { error } = await supabase.from('messages').insert({
      conversation_id: conversationId,
      sender,
      content,
      created_at: new Date().toISOString(),
    });
    if (error) {
      console.error('[conversationsDb] insert message error:', error.message);
      console.error('[conversationsDb] error cause:', error.cause ?? 'none');
      console.error('[conversationsDb] error stack:', error.stack ?? 'none');
    }
  } catch (e) {
    console.error('[conversationsDb] insert message exception:', e.message);
    console.error('[conversationsDb] exception cause:', e.cause ?? 'none');
    console.error('[conversationsDb] exception stack:', e.stack ?? 'none');
  }
}

// 会話履歴を取得（最新 MAX 件）
// .single() は複数conversationでエラーになるため limit(1)+order で代替
// 複数conversationが存在する場合は全件のメッセージを統合して返す
async function getMessages({ userId, memberId, channel = 'web', limit = 50 }) {
  if (!supabase) { console.warn('[getMessages] supabase未接続'); return []; }
  try {
    const { data: convRows, error: convErr } = await supabase
      .from('conversations')
      .select('id')
      .eq('user_id', userId)
      .eq('member_id', memberId)
      .eq('channel', channel)
      .order('updated_at', { ascending: false });
    console.log(`[getMessages] userId=${userId} memberId=${memberId} channel=${channel} conversations=${convRows?.length ?? 0} convErr=${convErr?.message ?? 'none'}`);
    if (convErr || !convRows || convRows.length === 0) return [];
    const convIds = convRows.map(r => r.id);
    console.log('[getMessages] convIds:', convIds);
    // 最新 limit 件を取得するため created_at 降順で取得（古い50件で頭打ちになる問題を修正・Phase52-11.2）
    const { data, error } = await supabase
      .from('messages')
      .select('sender, content, created_at')
      .in('conversation_id', convIds)
      .order('created_at', { ascending: false })
      .limit(limit);
    console.log(`[getMessages] messages取得=${data?.length ?? 0} msgErr=${error?.message ?? 'none'}`);
    if (error) return [];
    // 表示は古い→新しい順を維持するため、返却前に昇順へ並べ直す（返却形式は不変）
    return (data || []).slice().sort((a, b) => {
      const ta = Date.parse(a && a.created_at) || 0;
      const tb = Date.parse(b && b.created_at) || 0;
      return ta - tb;
    });
  } catch (e) {
    console.error('[getMessages] exception:', e.message);
    return [];
  }
}

module.exports = { upsertConversation, saveMessage, getMessages };
