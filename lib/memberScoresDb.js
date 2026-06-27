const { supabase } = require('./supabase');

function calcTotal(s) {
  return Math.round((s.contribution_avg + s.accuracy_avg + s.speed_avg) / 3 * 10) / 10;
}

async function getAllSummaries() {
  if (!supabase) return { scores: {}, source: 'fallback' };
  try {
    const { data, error } = await supabase.from('member_score_summary').select('*');
    if (error) return { scores: {}, source: 'fallback', error: error.message };
    const scores = {};
    (data || []).forEach(row => {
      scores[row.member_id] = {
        contribution: row.contribution_avg,
        accuracy:     row.accuracy_avg,
        speed:        row.speed_avg,
        caseCount:    row.case_count,
        totalScore:   calcTotal(row),
      };
    });
    return { scores, source: 'db' };
  } catch (e) { return { scores: {}, source: 'error', error: e.message }; }
}

async function recordScore({ memberId, caseId, contribution, accuracy, speed }) {
  if (!supabase) return { error: 'Supabase未設定' };
  const c = Number(contribution), a = Number(accuracy), s = Number(speed);
  const avg = Math.round((c + a + s) / 3 * 10) / 10;
  try {
    // 個別評価を記録
    await supabase.from('member_scores').insert({
      member_id:    memberId,
      case_id:      caseId || null,
      contribution: c, accuracy: a, speed: s,
      avg_score:    avg,
    });

    // サマリーをupsert（移動平均）
    const { data: existing } = await supabase
      .from('member_score_summary').select('*').eq('member_id', memberId).single();

    if (existing) {
      const n = existing.case_count;
      const upd = {
        contribution_avg: Math.round(((existing.contribution_avg * n) + c) / (n + 1) * 10) / 10,
        accuracy_avg:     Math.round(((existing.accuracy_avg     * n) + a) / (n + 1) * 10) / 10,
        speed_avg:        Math.round(((existing.speed_avg        * n) + s) / (n + 1) * 10) / 10,
        case_count:       n + 1,
        updated_at:       new Date().toISOString(),
      };
      upd.total_score = calcTotal({ contribution_avg: upd.contribution_avg, accuracy_avg: upd.accuracy_avg, speed_avg: upd.speed_avg });
      await supabase.from('member_score_summary').update(upd).eq('member_id', memberId);
    } else {
      await supabase.from('member_score_summary').insert({
        member_id:        memberId,
        contribution_avg: c, accuracy_avg: a, speed_avg: s,
        total_score:      avg, case_count: 1,
      });
    }
    return { error: null };
  } catch (e) { return { error: e.message }; }
}

async function getDispatchWeights() {
  if (!supabase) return { weights: {}, source: 'fallback' };
  try {
    const { data, error } = await supabase.from('member_score_summary').select('member_id, total_score');
    if (error) return { weights: {}, source: 'fallback' };
    const weights = {};
    (data || []).forEach(r => { weights[r.member_id] = r.total_score; });
    return { weights, source: 'db' };
  } catch (e) { return { weights: {}, source: 'error' }; }
}

module.exports = { getAllSummaries, recordScore, getDispatchWeights };
