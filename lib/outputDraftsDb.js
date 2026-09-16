// lib/outputDraftsDb.js （Phase54-2b: Output Draft Persistence サーバー永続化・B案 output_id スコープ）
// ※ approvalsDb.js / casesDb.js のエラー処理・Supabase接続方式・返却形式（source:'db'|'fallback'|'error'）を踏襲。
// ※ Draft本文(fields)＋メタのみ保存。Approval状態・派生キャッシュ・exports・reviewNotes・providerRefs・
//    Learning/Memory/Knowledge候補・cost情報は保存しない（Phase54-2a設計どおり）。output_approvals は不変。
const { supabase } = require('./supabase');

// Output Draft の upsert（output_id 完全一致1件・onConflict: output_id）
// Phase54-2f: 指定された列のみ書き込む（undefined の列は送らず既存値を壊さない＝approvalsDbのoutput_id方式に統一）。
//   → 「Draft本文の保存(2c: 全メタ)」と「reviewStateのみの保存(2f)」を同一upsertで安全に両立（互いを上書きしない）。
// updated_at は「案件別・最新1件」取得（updated_at DESC）のため常に設定（指定値優先・無ければ現在時刻）。
// CV-4b: contentValue（server-side再計算結果）はadditiveな独立列へ保存する。
//   ★ contentType は本関数では受け取らない。無制限上書きを防ぐため
//     setContentTypeIfUnset()（atomic first-write-wins）のみを正式な書込経路とする。
async function upsertOutputDraft({ outputId, caseId, type, status, title, sourceText, fields, quality, packageQuality, assignedRoles, schemaVersion, detection, createdAt, updatedAt, builtAt, reviewState, contentValue }) {
  if (!supabase) return { error: 'Supabase未設定' };
  if (!outputId) return { error: 'outputId は必須です' };
  if (!caseId) return { error: 'caseId は必須です' };
  try {
    const row = {
      output_id:  outputId,
      case_id:    caseId,
      updated_at: updatedAt || new Date().toISOString(),
    };
    // 指定(≠undefined)された列のみ設定。未指定の列は既存値/DEFAULTを保持（reviewStateのみ保存でDraft本文を壊さない・逆も同様）。
    if (type           !== undefined) row.type            = type || null;
    if (status         !== undefined) row.status          = status || null;
    if (title          !== undefined) row.title           = title || null;
    if (sourceText     !== undefined) row.source_text     = sourceText || null;
    if (fields         !== undefined) row.fields          = fields || null;
    if (quality        !== undefined) row.quality         = quality || null;
    if (packageQuality !== undefined) row.package_quality = packageQuality || null;
    if (assignedRoles  !== undefined) row.assigned_roles  = assignedRoles || null;
    if (schemaVersion  !== undefined) row.schema_version  = schemaVersion || null;
    if (detection      !== undefined) row.detection       = detection || null;
    if (reviewState    !== undefined) row.review_state    = reviewState || null;   // Phase54-2f: Mobile Review状態(JSONB)
    if (contentValue   !== undefined) row.content_value   = contentValue || null;  // CV-4b: server-side再計算結果(JSONB)
    if (createdAt) row.created_at = createdAt;   // 未指定時は列を送らず DEFAULT/既存値を保持（上書きしない）
    if (builtAt)   row.built_at   = builtAt;
    const { error } = await supabase.from('output_drafts').upsert(row, { onConflict: 'output_id' });
    return { error: error?.message || null };
  } catch (e) { return { error: e.message }; }
}

// case_id 指定取得。outputId 指定時は output_id 一致の1件、未指定時は case_id の最新1件（updated_at DESC）。
// 一覧・履歴取得は今回未実装（Phase54-2e候補）。
async function getOutputDraft({ caseId, outputId } = {}) {
  if (!supabase) return { draft: null, source: 'fallback' };
  if (!caseId) return { draft: null, source: 'error', error: 'caseId は必須です' };
  try {
    let q = supabase.from('output_drafts').select('*').eq('case_id', caseId);
    if (outputId) {
      q = q.eq('output_id', outputId);
    } else {
      q = q.order('updated_at', { ascending: false }).limit(1);
    }
    const { data, error } = await q.maybeSingle();
    if (error) return { draft: null, source: 'fallback', error: error.message };
    return { draft: data || null, source: 'db' };
  } catch (e) { return { draft: null, source: 'error', error: e.message }; }
}

// ══════════════════════════════════════════════════════════════
// CV-4b: content_type の atomic first-write-wins 書込
//
//   契約:
//     canonical content_type が NULL のときのみ書き込む。既に値があれば **何もしない**
//     （エラーにもしない＝既存 fire-and-forget 保存フローを壊さない）。
//     これにより「後から content_type='value' を送って Product の APFR Gate を回避する」
//     downgrade 経路を塞ぐ（CV-4a Correction）。
//
//   atomicity:
//     `UPDATE ... WHERE output_id = ? AND content_type IS NULL` という
//     **述語つき単一 UPDATE** で実現する（read→write の2段階ではないため lost update が起きない）。
//     同時初回書込が競合しても、成功するのは1件のみ・他は 0 行更新で終わる。
//
//   fail-open:
//     migration 未適用（列が存在しない）等でも例外を投げず { ok:false, reason } を返すだけにする。
//     Output Draft 本体の保存を巻き込んで失敗させない。
//
//   戻り値: { ok, applied, reason }
//     applied:true  … 本呼び出しが content_type を確定させた
//     applied:false … 既に確定済み / 書込対象外 / 列未追加 等
// ══════════════════════════════════════════════════════════════
const CONTENT_TYPE_ALLOWED = ['value', 'bridge', 'product'];

async function setContentTypeIfUnset({ outputId, contentType }) {
  // ★ enum 検証を先に行う（DB 可用性に依存しない純粋な入力検証）。
  //   'unknown' / 未宣言 / 列挙外は **DBへ書かない**（未解決は NULL のまま保持する契約）。
  if (CONTENT_TYPE_ALLOWED.indexOf(contentType) === -1) {
    return { ok: true, applied: false, reason: 'not_declarable' };
  }
  if (!outputId) return { ok: false, applied: false, reason: 'outputId_required' };
  if (!supabase) return { ok: false, applied: false, reason: 'supabase_unavailable' };
  try {
    const { data, error } = await supabase
      .from('output_drafts')
      .update({ content_type: contentType })
      .eq('output_id', outputId)
      .is('content_type', null)      // ★ 述語つき単一UPDATE = atomic first-write-wins
      .select('output_id');
    if (error) return { ok: false, applied: false, reason: error.message };
    return { ok: true, applied: Array.isArray(data) && data.length > 0, reason: null };
  } catch (e) { return { ok: false, applied: false, reason: e.message }; }
}

// canonical な content_type / content_value のみを読む軽量 read（評価入力の正本取得用）。
//   ★ client payload ではなく **この canonical 値**を Content Value 評価と Publishing 判定に使う。
async function getContentTypeCanonical({ outputId }) {
  if (!supabase) return { contentType: null, source: 'fallback' };
  if (!outputId) return { contentType: null, source: 'error', error: 'outputId_required' };
  try {
    const { data, error } = await supabase
      .from('output_drafts').select('content_type').eq('output_id', outputId).maybeSingle();
    if (error) return { contentType: null, source: 'fallback', error: error.message };
    const v = data && data.content_type;
    return { contentType: CONTENT_TYPE_ALLOWED.indexOf(v) !== -1 ? v : null, source: 'db' };
  } catch (e) { return { contentType: null, source: 'error', error: e.message }; }
}

// content_value のみを更新する（updated_at を触らない＝draftFingerprint/stale判定へ影響させない）。
//   fail-open: 列未追加・接続失敗でも例外を投げず { ok:false, reason } を返すだけ。
async function updateContentValue({ outputId, contentValue }) {
  if (!supabase) return { ok: false, reason: 'supabase_unavailable' };
  if (!outputId) return { ok: false, reason: 'outputId_required' };
  try {
    const { error } = await supabase
      .from('output_drafts')
      .update({ content_value: contentValue || null })
      .eq('output_id', outputId);
    if (error) return { ok: false, reason: error.message };
    return { ok: true, reason: null };
  } catch (e) { return { ok: false, reason: e.message }; }
}

// ══════════════════════════════════════════════════════════════
// Safety Foundation B1: Canonical Content Evidence / Claims Protected Columns
//
//   canonical contentEvidence / contentClaims は fields の外側の専用列
//   （content_evidence / content_claims / content_evidence_origin）を正本とする。
//   ★ upsertOutputDraft() はこの3列を受け取らない＝通常保存では絶対に変更されない。
//   ★ 3列を書き換えられるのは writeCanonicalContentEvidence()（Evidence Resolution 専用）のみ。
// ══════════════════════════════════════════════════════════════

// output_id のみで保存前の row を読む（case_id 一致確認・legacy fields 保全の判定材料）。
//   戻り値: { row, source: 'db' | 'unavailable' | 'error', error }
//     row:null かつ source:'db' … 該当rowなし（新規 output）
//     source:'unavailable'      … Supabase 未設定（ローカル fallback。upsert 側も書き込めない）
//     source:'error'            … 読み取り失敗（呼び出し側は書き込まず fail-closed にする）
async function getOutputDraftRowByOutputId({ outputId } = {}) {
  if (!supabase) return { row: null, source: 'unavailable', error: null };
  if (!outputId) return { row: null, source: 'error', error: 'outputId_required' };
  try {
    const { data, error } = await supabase
      .from('output_drafts').select('*').eq('output_id', outputId).maybeSingle();
    if (error) return { row: null, source: 'error', error: error.message };
    return { row: data || null, source: 'db', error: null };
  } catch (e) { return { row: null, source: 'error', error: e.message }; }
}

// canonical 3列のみを読む（Content Value 評価直前の正本取得用）。
//   ★ 列が存在しない（migration 未適用）場合は error → ok:false（呼び出し側は content_value を更新しない）。
//   戻り値: { ok, row, reason }
async function getCanonicalContentEvidence({ caseId, outputId } = {}) {
  if (!supabase) return { ok: false, row: null, reason: 'supabase_unavailable' };
  if (!caseId || !outputId) return { ok: false, row: null, reason: 'caseId_and_outputId_required' };
  try {
    const { data, error } = await supabase
      .from('output_drafts')
      .select('output_id, case_id, content_evidence, content_claims, content_evidence_origin')
      .eq('case_id', caseId)
      .eq('output_id', outputId)
      .maybeSingle();
    if (error) return { ok: false, row: null, reason: error.message };
    return { ok: true, row: data || null, reason: null };
  } catch (e) { return { ok: false, row: null, reason: e.message }; }
}

// canonical 3列の書き込み（★ Evidence Resolution 成功時のみ server.js から呼ぶ唯一の経路）。
//   ★ output_id と case_id の両方が一致する row だけを更新する（cross-case では 0 行＝applied:false）。
//   ★ 空配列・型不正は書き込まない（Resolution は contentEvidence / contentClaims 双方 >0 件でのみ成立する契約）。
//   戻り値: { ok, applied, reason }
async function writeCanonicalContentEvidence({ caseId, outputId, contentEvidence, contentClaims, origin } = {}) {
  if (!caseId || !outputId) return { ok: false, applied: false, reason: 'caseId_and_outputId_required' };
  if (!Array.isArray(contentEvidence) || contentEvidence.length === 0
      || !Array.isArray(contentClaims) || contentClaims.length === 0) {
    return { ok: false, applied: false, reason: 'canonical_arrays_required' };
  }
  if (!origin || typeof origin !== 'object' || Array.isArray(origin)) {
    return { ok: false, applied: false, reason: 'origin_required' };
  }
  if (!supabase) return { ok: false, applied: false, reason: 'supabase_unavailable' };
  try {
    const { data, error } = await supabase
      .from('output_drafts')
      .update({ content_evidence: contentEvidence, content_claims: contentClaims, content_evidence_origin: origin })
      .eq('output_id', outputId)
      .eq('case_id', caseId)
      .select('output_id');
    if (error) return { ok: false, applied: false, reason: error.message };
    const applied = Array.isArray(data) && data.length > 0;
    return { ok: applied, applied, reason: applied ? null : 'no_matching_row' };
  } catch (e) { return { ok: false, applied: false, reason: e.message }; }
}

module.exports = {
  upsertOutputDraft,
  getOutputDraft,
  setContentTypeIfUnset,
  getContentTypeCanonical,
  updateContentValue,
  CONTENT_TYPE_ALLOWED,
  // Safety Foundation B1
  getOutputDraftRowByOutputId,
  getCanonicalContentEvidence,
  writeCanonicalContentEvidence,
};
