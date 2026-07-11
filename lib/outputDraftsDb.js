// lib/outputDraftsDb.js （Phase54-2b: Output Draft Persistence サーバー永続化・B案 output_id スコープ）
// ※ approvalsDb.js / casesDb.js のエラー処理・Supabase接続方式・返却形式（source:'db'|'fallback'|'error'）を踏襲。
// ※ Draft本文(fields)＋メタのみ保存。Approval状態・派生キャッシュ・exports・reviewNotes・providerRefs・
//    Learning/Memory/Knowledge候補・cost情報は保存しない（Phase54-2a設計どおり）。output_approvals は不変。
const { supabase } = require('./supabase');

// Output Draft の upsert（output_id 完全一致1件・onConflict: output_id）
// created_at / built_at は指定時のみ列を送る（未指定で既存値・DEFAULTを壊さない＝approvalsDbのoutput_id方式に統一）。
// updated_at は「案件別・最新1件」取得（updated_at DESC）のため常に設定（指定値優先・無ければ現在時刻）。
async function upsertOutputDraft({ outputId, caseId, type, status, title, sourceText, fields, quality, packageQuality, assignedRoles, schemaVersion, detection, createdAt, updatedAt, builtAt }) {
  if (!supabase) return { error: 'Supabase未設定' };
  if (!outputId) return { error: 'outputId は必須です' };
  if (!caseId) return { error: 'caseId は必須です' };
  try {
    const row = {
      output_id:       outputId,
      case_id:         caseId,
      type:            type || null,
      status:          status || null,
      title:           title || null,
      source_text:     sourceText || null,
      fields:          fields || null,
      quality:         quality || null,
      package_quality: packageQuality || null,
      assigned_roles:  assignedRoles || null,
      schema_version:  schemaVersion || null,
      detection:       detection || null,
      updated_at:      updatedAt || new Date().toISOString(),
    };
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

module.exports = { upsertOutputDraft, getOutputDraft };
