// lib/affiliateEvalDb.js （Instagram自動運営 工程1-A: Affiliate評価 永続化・会社共通Affiliate Intelligence）
// ※ casesDb.js / outputDraftsDb.js / approvalsDb.js のエラー処理・Supabase接続方式・返却形式（source:'db'|'fallback'|'error'）を踏襲。
// ※ 案件そのものの正本は cases。本テーブルは用途別のAffiliate評価（会社共通・channel_scopeで将来チャネル別へ拡張可）。
// ※ active評価は subject（case_id × channel_scope × product_identifier）単位に1件。再評価は同一subjectの旧activeをfalse化して履歴保持（削除しない）。
// ※ 冪等: source_fingerprint UNIQUE（再送で二重登録しない）。業務一意: partial UNIQUE (case_id, channel_scope, COALESCE(product_identifier,'')) WHERE is_active（工程1-B-0c Migration済 / uq_affiliate_eval_active_product）。
const { supabase } = require('./supabase');

// 数値正規化: 有効な数値のみ返す（不正な文字列・NaN・空は null＝ゴミを保存しない）
function _num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function _str(v) { return (v === null || v === undefined) ? null : String(v); }

// product_identifier 用キー正規化（工程1-B・案A厳格）:
// 全角空白→半角 / 前後空白削除 / 連続空白を1つへ統一 / 英字小文字化
// Unicode NFKC・ASP別名辞書・記号除去は今回追加しない（誤統合より別subject保持を優先）
function normalizeAffiliateKeyPart(v) {
  return String(v == null ? '' : v)
    .replace(/　/g, ' ')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

// 正式subject key。productNameがなければnull。ASP名がなければ配列第2要素をnullとする。
// JSON配列にすることで区切り文字衝突（"商品|ASP"形式）を避ける。空文字は返さない＝''をDBへ保存しない。
function buildProductIdentifier(productName, aspName) {
  const p = normalizeAffiliateKeyPart(productName);
  if (!p) return null;
  const a = normalizeAffiliateKeyPart(aspName);
  return JSON.stringify([
    p,
    a || null
  ]);
}

const VALID_RECOMMENDATION = ['adopt', 'watch', 'reject'];

// 評価取得。caseId必須。channelScope指定可。activeOnly既定true（is_active=trueのみ）。履歴はactiveOnly=falseでinactiveも返す。最新順。
async function getAffiliateEvaluations({ caseId, channelScope, activeOnly } = {}) {
  if (!supabase) return { evaluations: [], source: 'fallback' };
  if (!caseId) return { evaluations: [], source: 'error', error: 'caseId は必須です' };
  const onlyActive = (activeOnly === undefined) ? true : !!activeOnly;
  try {
    let q = supabase.from('affiliate_evaluations').select('*').eq('case_id', caseId);
    if (channelScope) q = q.eq('channel_scope', channelScope);
    if (onlyActive) q = q.eq('is_active', true);
    q = q.order('created_at', { ascending: false });
    const { data, error } = await q;
    if (error) return { evaluations: [], source: 'fallback', error: error.message };
    return { evaluations: data || [], source: 'db' };
  } catch (e) { return { evaluations: [], source: 'error', error: e.message }; }
}

// 評価保存。caseId / sourceFingerprint 必須。
// 手順: ①source_fingerprint一致で冪等判定 → ②同一(case_id,channel_scope,product_identifier)の旧activeをfalse化 → ③新評価をactive=trueでinsert。
// ※ 旧false化後にinsert失敗すると active が一時的に0件になり得る（旧行は残るため復元可）。RPC等の厳密トランザクションは今回追加しない（工程1-Aの範囲外・別途報告）。
async function saveAffiliateEvaluation(evaluation) {
  if (!supabase) return { error: 'Supabase未設定', source: 'fallback' };
  const ev = evaluation || {};
  const caseId = _str(ev.caseId);
  const fingerprint = _str(ev.sourceFingerprint);
  if (!caseId) return { error: 'caseId は必須です', source: 'error' };
  if (!fingerprint) return { error: 'sourceFingerprint は必須です', source: 'error' };
  const channelScope = _str(ev.channelScope) || 'all';         // 未指定時のみ 'all'
  // 案A（厳格）: productName があればサーバー側で必ず再生成する。client の ev.productIdentifier は保存値に使わない。
  const productIdentifier = buildProductIdentifier(ev.productName, ev.aspName);
  const reco = (ev.recommendation === undefined || ev.recommendation === null || ev.recommendation === '')
    ? null : String(ev.recommendation);
  if (reco !== null && VALID_RECOMMENDATION.indexOf(reco) === -1) {
    return { error: 'recommendation は adopt/watch/reject のいずれかです', source: 'error' };
  }
  try {
    // ① 冪等判定: 同一 source_fingerprint が既にあれば、それを返す（新規登録しない）
    const { data: existRows, error: existErr } = await supabase
      .from('affiliate_evaluations').select('*').eq('source_fingerprint', fingerprint).limit(1);
    if (existErr) return { error: existErr.message, source: 'fallback' };
    if (existRows && existRows[0]) {
      return { evaluation: existRows[0], idempotent: true, source: 'db' };
    }

    const now = new Date().toISOString();
    const row = {
      case_id:            caseId,
      evaluation_version: _str(ev.evaluationVersion) || 'v1',
      channel_scope:      channelScope,
      product_name:       _str(ev.productName),
      product_identifier: productIdentifier,
      product_url:        _str(ev.productUrl),
      asp_name:           _str(ev.aspName),
      category:           _str(ev.category),
      target_audience:    _str(ev.targetAudience),
      market:             _str(ev.market),
      profit_rate:        _num(ev.profitRate),
      approval_rate:      _num(ev.approvalRate),
      epc:                _num(ev.epc),
      cvr:                _num(ev.cvr),
      ig_fit:             _num(ev.igFit),
      competitors:        _num(ev.competitors),
      lifespan_months:    _num(ev.lifespanMonths),
      integrated_score:   _num(ev.integratedScore),
      estimated_sales:    _num(ev.estimatedSales),
      estimated_profit:   _num(ev.estimatedProfit),
      recommendation:     reco,
      adoption_reason:    _str(ev.adoptionReason),
      risks:              _str(ev.risks),
      detail:             (ev.detail !== undefined ? ev.detail : null),
      source:             _str(ev.source) || 'manual',
      source_fingerprint: fingerprint,
      is_active:          true,
      created_at:         now,
      updated_at:         now,   // 保存処理時に最新時刻を明示（DEFAULT依存にしない）
    };

    // ② 同一 subject（case_id + channel_scope + product_identifier）の旧active を false化（partial UNIQUE 違反回避・履歴は残す）
    let deactQ = supabase
      .from('affiliate_evaluations')
      .update({ is_active: false, updated_at: now })
      .eq('case_id', caseId).eq('channel_scope', channelScope).eq('is_active', true);
    // subject単位に限定（他商材のactiveを巻き込まない）。null は .eq() では一致しないため .is() を使う。
    deactQ = (productIdentifier === null)
      ? deactQ.is('product_identifier', null)
      : deactQ.eq('product_identifier', productIdentifier);
    const { error: deactErr } = await deactQ;
    if (deactErr) return { error: deactErr.message, source: 'fallback' };

    // ③ 新評価を active=true で insert
    const { data: inserted, error: insErr } = await supabase
      .from('affiliate_evaluations').insert(row).select().single();
    if (insErr) {
      // 旧activeは既にfalse化済み。active一時0件の可能性を明示（旧行は残存＝復元可）。
      return { error: insErr.message, source: 'fallback', activeMayBeZero: true };
    }
    return { evaluation: inserted, idempotent: false, source: 'db' };
  } catch (e) { return { error: e.message, source: 'error' }; }
}

module.exports = { getAffiliateEvaluations, saveAffiliateEvaluation };
