const { supabase } = require('./supabase');

// 現在のスコアを取得
async function getScore() {
  if (!supabase) return { score: defaultScore(), source: 'fallback' };
  try {
    const { data, error } = await supabase.from('company_score').select('*').eq('id', 1).single();
    if (error || !data) return { score: defaultScore(), source: 'fallback' };
    return { score: normalize(data), source: 'db' };
  } catch (e) { return { score: defaultScore(), source: 'error' }; }
}

// 評価1件分を記録してスコアを更新
async function recordRating(rating) {
  if (!supabase) return { error: 'Supabase未設定' };
  const r = Number(rating);
  const isSuccess = r >= 4;
  const isFailure = r <= 2;
  try {
    const { data: cur } = await supabase.from('company_score').select('*').eq('id', 1).single();
    if (!cur) return { error: 'スコア行が存在しません' };
    const ratingSum   = (cur.rating_sum   || 0) + r;
    const ratingCount = (cur.rating_count || 0) + 1;
    const { error } = await supabase.from('company_score').update({
      total_cases:   (cur.total_cases   || 0) + 1,
      success_count: (cur.success_count || 0) + (isSuccess ? 1 : 0),
      failure_count: (cur.failure_count || 0) + (isFailure ? 1 : 0),
      rating_sum:    ratingSum,
      rating_count:  ratingCount,
      avg_rating:    Math.round(ratingSum / ratingCount * 10) / 10,
      updated_at:    new Date().toISOString(),
    }).eq('id', 1);
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

// 売上貢献度を手動更新
async function updateRevenue(amount) {
  if (!supabase) return { error: 'Supabase未設定' };
  try {
    const { error } = await supabase.from('company_score')
      .update({ revenue_contribution: Number(amount) || 0, updated_at: new Date().toISOString() })
      .eq('id', 1);
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

function defaultScore() {
  return { totalCases: 0, successCount: 0, failureCount: 0, ratingSum: 0, ratingCount: 0, avgRating: 0, revenueContribution: 0, successRate: 0 };
}

function normalize(row) {
  const total = row.total_cases || 0;
  return {
    totalCases:          total,
    successCount:        row.success_count || 0,
    failureCount:        row.failure_count || 0,
    ratingSum:           row.rating_sum    || 0,
    ratingCount:         row.rating_count  || 0,
    avgRating:           row.avg_rating    || 0,
    revenueContribution: row.revenue_contribution || 0,
    successRate:         total > 0 ? Math.round((row.success_count || 0) / total * 100) : 0,
  };
}

// ── 戦略顧問学習（単一行テーブル） ─────────────────────────
async function getStrategyLearning() {
  if (!supabase) return { data: defaultStrategy(), source: 'fallback' };
  try {
    const { data, error } = await supabase.from('strategy_learning').select('*').eq('id', 1).single();
    if (error || !data) return { data: defaultStrategy(), source: 'fallback' };
    return { data: normalizeStrategy(data), source: 'db' };
  } catch (e) { return { data: defaultStrategy(), source: 'error' }; }
}

async function recordStrategyIntervention(isSuccess, rating) {
  if (!supabase) return { error: 'Supabase未設定' };
  try {
    const { data: cur } = await supabase.from('strategy_learning').select('*').eq('id', 1).single();
    if (!cur) return { error: 'strategy_learning行が存在しません' };
    const totalInterventions = (cur.total_interventions || 0) + 1;
    const positiveOutcomes   = (cur.positive_outcomes   || 0) + (isSuccess ? 1 : 0);
    const ratingSum          = (cur.rating_sum          || 0) + Number(rating);
    const { error } = await supabase.from('strategy_learning').update({
      total_interventions: totalInterventions,
      positive_outcomes:   positiveOutcomes,
      rating_sum:          ratingSum,
      avg_post_rating:     Math.round(ratingSum / totalInterventions * 10) / 10,
      updated_at:          new Date().toISOString(),
    }).eq('id', 1);
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

function defaultStrategy() {
  return { totalInterventions: 0, positiveOutcomes: 0, ratingSum: 0, avgPostRating: 0, interventionSuccessRate: 0 };
}

function normalizeStrategy(row) {
  const total = row.total_interventions || 0;
  return {
    totalInterventions:      total,
    positiveOutcomes:        row.positive_outcomes || 0,
    ratingSum:               row.rating_sum        || 0,
    avgPostRating:           row.avg_post_rating   || 0,
    interventionSuccessRate: total > 0 ? Math.round((row.positive_outcomes || 0) / total * 100) : 0,
  };
}

module.exports = { getScore, recordRating, updateRevenue, getStrategyLearning, recordStrategyIntervention };
