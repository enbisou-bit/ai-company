// lib/notificationReadsDb.js （Phase54-3b-3a: Notification既読の永続化＝端末間一致）
// ※ 通知＝task_historyエントリ（historyId）と1対1。単一共有アカウント(web-user)前提で user_id列は持たない。
// ※ tasksDb.js / taskHistoryDb.js のエラー処理・Supabase接続方式・返却形式（source:'db'|'fallback'|'error'）を踏襲。
// ※ history_id を PRIMARY KEY とし ON CONFLICT DO NOTHING で冪等（重複行を作らない・created_atは初回値を保持）。
const { supabase } = require('./supabase');

const DEFAULT_LIMIT = 1000;   // limit未指定時の安全な既定値
const MAX_LIMIT     = 5000;   // 過大取得を防ぐ上限クランプ

function _clampLimit(limit) {
  var n = parseInt(limit, 10);
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

// 既読 history_id 一覧を取得（created_at DESC・limit件）。caseId 任意フィルタ。
async function getSeenIds({ caseId, limit } = {}) {
  if (!supabase) return { seenIds: [], total: 0, source: 'fallback', error: 'Supabase未設定' };
  try {
    const n = _clampLimit(limit);
    let q = supabase
      .from('notification_reads')
      .select('history_id')
      .order('created_at', { ascending: false })
      .limit(n);
    if (caseId) q = q.eq('case_id', caseId);
    const { data, error } = await q;
    if (error) return { seenIds: [], total: 0, source: 'fallback', error: error.message };
    const seenIds = (data || []).map(function (r) { return r.history_id; }).filter(Boolean);
    return { seenIds: seenIds, total: seenIds.length, source: 'db', error: null };
  } catch (e) { return { seenIds: [], total: 0, source: 'error', error: e.message }; }
}

// 既読を一括保存（history_id で冪等・ON CONFLICT DO NOTHING）。caseId 任意（各行へ付与）。
async function markSeen(historyIds, caseId) {
  if (!supabase) return { error: 'Supabase未設定', count: 0 };
  if (!Array.isArray(historyIds) || historyIds.length === 0) return { error: null, count: 0 };
  try {
    const now = new Date().toISOString();
    // 重複IDを排除して行を作成（seen_at は今回時刻・created_atはDEFAULT/既存値を保持＝列を送らない）
    const uniq = Array.from(new Set(historyIds.filter(Boolean).map(String)));
    if (uniq.length === 0) return { error: null, count: 0 };
    const rows = uniq.map(function (hid) {
      const row = { history_id: hid, seen_at: now };
      if (caseId != null) row.case_id = caseId;   // 任意（未指定は列を送らずNULL維持）
      return row;
    });
    // onConflict: history_id ＋ ignoreDuplicates で既存行を上書きしない（created_at/初回seen_atを保持）
    const { error } = await supabase
      .from('notification_reads')
      .upsert(rows, { onConflict: 'history_id', ignoreDuplicates: true });
    return { error: error ? error.message : null, count: rows.length };
  } catch (e) { return { error: e.message, count: 0 }; }
}

module.exports = { getSeenIds, markSeen };
