'use strict';
// lib/carouselExecutionDb.js
// Carousel Image Production — Phase 2-E Gate 1: persistent execution ledger（課金冪等性の正本）。
//
//   nonce single-use unit = 1 承認token = 1 Carousel Image Job = 1 execution record。
//   table: carousel_image_executions（supabase/schema.sql）。nonce UNIQUE制約への INSERT 成功のみを
//   reserve成功として扱う（atomic）。一度 INSERT された行（＝reserveされたnonce）は、いかなる status
//   でも削除・release・再利用しない — 本ファイルは意図的に delete/release 系 API を持たない。
//
//   責務境界: shared/carouselApproval.js・shared/carouselImageCore.js は
//   「非責務: DB I/O・network I/O・filesystem I/O」を宣言している（carouselApproval.js 冒頭コメント）。
//   その境界を守るため、DB I/O は本ファイルへ集約し、shared/ からは deps 注入で呼ばれる
//   （Phase 2-E Gate 1 Final Design。runCarouselImageJob への統合は本ファイルの範囲外＝未実施）。
//
//   fail-closed 一覧: 入力不正 / privileged client 未設定 / 接続エラー / 識別不能な 23505 /
//                     その他 DB エラー → いずれも { ok:false, reason:'reserve_unavailable' }
//                     （23505 が nonce UNIQUE 制約由来と厳密一致で確認できた場合のみ 'nonce_reused'）。
//
//   ★ Decision 110（Server-only Trust Boundary）: 本テーブルへは server-only privileged client
//     （lib/carouselExecutionSupabase.js）でのみアクセスする。anon / authenticated からの直接
//     CRUD は RLS（policy 0本）＋ GRANT REVOKE で全面禁止されている。
//     **本ファイルは lib/supabase.js（anon client）を require しない。**
//     privileged client が無い環境では reserve_unavailable で fail-closed し、
//     **anon client へ fallback しない**（構造的に不可能にするため import 自体を持たない）。
//
//   ※ raw prompt 全文・Output Draft 本文・生成画像 bytes・API key・provider raw exception は
//     このテーブルへ一切書き込まない（呼び出し側の責務。本ファイルはそれらを受け取らない）。
//   ※ opts.client でテスト用 fake Supabase client を注入可能（省略時は privileged client）。
//     本番呼び出し側は opts を渡す必要はない。Claude Code / local には credential が無いため、
//     deterministic unit test は必ず opts.client の fake 注入で行う。

const { carouselExecutionClient } = require('./carouselExecutionSupabase');

const TABLE = 'carousel_image_executions';
const QUALITY_ENUM = ['low', 'medium', 'high'];
const FAILURE_STATUSES = ['failed_before_charge', 'failed_after_charge', 'unknown_billing'];
const USAGE_COMPLETENESS_ENUM = ['complete', 'partial', 'unavailable'];

// PostgreSQL の unique_violation(23505) のうち、本テーブルの nonce UNIQUE 制約
// （supabase/schema.sql の CONSTRAINT carousel_image_executions_nonce_key）由来のものだけを
// nonce_reused と分類する。制約名を厳密一致で検出できない 23505 は、将来別の UNIQUE 制約が
// このテーブルへ追加された場合の誤分類（本来 reserve_unavailable とすべきものを nonce_reused
// と誤判定してしまう）を避けるため、すべて reserve_unavailable 側へ fail-closed する。
const NONCE_CONSTRAINT_NAME = 'carousel_image_executions_nonce_key';
function _isNonceUniqueViolation(error) {
  if (!error) return false;
  const hay = String(error.message || '') + ' ' + String(error.details || '');
  return hay.indexOf(NONCE_CONSTRAINT_NAME) !== -1;
}

// PostgreSQL の unique_violation(23505) のうち、per-output execution serialization 用の
// partial UNIQUE index（supabase/schema.sql の uq_carousel_exec_active_output・
// Phase 2-E Production Connection Step B）由来のものだけを post_execution_in_progress と
// 分類する。同一 output_id で in_progress 行が既に存在する場合の cross-nonce race 拒否。
// 識別不能な 23505 は nonce と同様、推測でこの分類にせず reserve_unavailable へ fail-closed。
//
// ★ Phase 2-E Production Connection Step C-1（TOCTOU fix）: 上記indexのpredicateは
//   WHERE status = 'in_progress' から WHERE status IN ('in_progress', 'completed') へ拡張された
//   （supabase/schema.sql 参照）。そのため本reasonは「対象行が厳密に in_progress である」ことを
//   意味しなくなり、「同一 output_id への active な authorization（in_progress または completed）
//   が既に存在するため、この reserve は per-post cumulative budget race を防ぐために拒否された」
//   ことを意味する。reason文字列自体は既存route/テスト互換のため意図的に変更していない
//   （最小変更を優先。renameは別途正式化する場合のみ検討）。
const ACTIVE_OUTPUT_CONSTRAINT_NAME = 'uq_carousel_exec_active_output';
function _isActiveOutputViolation(error) {
  if (!error) return false;
  const hay = String(error.message || '') + ' ' + String(error.details || '');
  return hay.indexOf(ACTIVE_OUTPUT_CONSTRAINT_NAME) !== -1;
}

function _str(v) { return (v === null || v === undefined) ? null : String(v); }

function _nonNegInt(v) {
  const n = Number(v);
  return (Number.isInteger(n) && n >= 0) ? n : null;
}

function _nonNegNum(v) {
  const n = Number(v);
  return (Number.isFinite(n) && n >= 0) ? n : null;
}

// DBから読み戻した数値列（spent_estimated_jpy / estimated_total_cost_jpy 等）専用の検証。
//   ★ _nonNegNum() と異なり null/undefined を明示的に拒否してから Number() 変換する
//     （Number(null)===0 という罠により、malformed/欠損値が静かに 0 として受理されるのを防ぐ）。
//   carousel_image_executions の該当列は Postgres NUMERIC で、PostgREST は精度保持のため
//   数値を文字列で返すことがあるため、数値文字列（"92.5232" 等）は許容する。
function _dbNonNegNum(v) {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return (Number.isFinite(n) && n >= 0) ? n : null;
}

// ══════════════════════════════════════════════════════════════
// reserveExecution — atomic nonce reserve（唯一の paid execution 許可の起点）
//
//   呼び出し順序: 全ての無償検証（scope/approval/quality/pre-flight budget 等）の「後」・
//                最初の provider call の「前」にのみ呼ぶこと（Phase 2-E Gate 1 Final Design）。
//
//   戻り値:
//     { ok:true, execution }                       … INSERT 成功。status='in_progress' で予約確定
//     { ok:false, reason:'invalid_input', field }   … 入力不正（DB へ到達しない）
//     { ok:false, reason:'nonce_reused' }           … nonce UNIQUE 違反（同一 token の二重実行）
//     { ok:false, reason:'reserve_unavailable' }    … Supabase 未設定／接続エラー／識別不能な
//                                                      23505／その他 DB エラー（すべて fail-closed）
// ══════════════════════════════════════════════════════════════
async function reserveExecution(input, opts) {
  const client = (opts && opts.client) || carouselExecutionClient;
  const inp = input || {};

  const nonce = _str(inp.nonce);
  const caseId = _str(inp.caseId);
  const outputId = _str(inp.outputId);
  const draftFingerprint = _str(inp.draftFingerprint);
  const model = _str(inp.model);
  const quality = _str(inp.quality);
  const slideCount = _nonNegInt(inp.slideCount);
  const estimatedOutputTokens = _nonNegInt(inp.estimatedOutputTokens);
  const reservedInputTokens = _nonNegInt(inp.reservedInputTokens);
  const estimatedOutputCostJpy = _nonNegNum(inp.estimatedOutputCostJpy);
  const reservedInputCostJpy = _nonNegNum(inp.reservedInputCostJpy);
  const estimatedTotalCostJpy = _nonNegNum(inp.estimatedTotalCostJpy);
  const workflowId = (inp.workflowId === null || inp.workflowId === undefined) ? null : _str(inp.workflowId);

  if (!nonce) return { ok: false, reason: 'invalid_input', field: 'nonce' };
  if (!caseId) return { ok: false, reason: 'invalid_input', field: 'caseId' };
  if (!outputId) return { ok: false, reason: 'invalid_input', field: 'outputId' };
  if (!draftFingerprint) return { ok: false, reason: 'invalid_input', field: 'draftFingerprint' };
  if (!model) return { ok: false, reason: 'invalid_input', field: 'model' };
  if (!quality || QUALITY_ENUM.indexOf(quality) === -1) return { ok: false, reason: 'invalid_input', field: 'quality' };
  if (slideCount === null || slideCount < 1) return { ok: false, reason: 'invalid_input', field: 'slideCount' };
  if (estimatedOutputTokens === null) return { ok: false, reason: 'invalid_input', field: 'estimatedOutputTokens' };
  if (reservedInputTokens === null) return { ok: false, reason: 'invalid_input', field: 'reservedInputTokens' };
  if (estimatedOutputCostJpy === null) return { ok: false, reason: 'invalid_input', field: 'estimatedOutputCostJpy' };
  if (reservedInputCostJpy === null) return { ok: false, reason: 'invalid_input', field: 'reservedInputCostJpy' };
  if (estimatedTotalCostJpy === null) return { ok: false, reason: 'invalid_input', field: 'estimatedTotalCostJpy' };

  // fail-closed: Supabase 未設定時に「成功」や「provider call を許可するfallback」を絶対に返さない。
  if (!client) return { ok: false, reason: 'reserve_unavailable' };

  const payload = {
    nonce: nonce,
    case_id: caseId,
    workflow_id: workflowId,
    output_id: outputId,
    draft_fingerprint: draftFingerprint,
    model: model,
    quality: quality,
    slide_count: slideCount,
    estimated_output_tokens: estimatedOutputTokens,
    reserved_input_tokens: reservedInputTokens,
    estimated_output_cost_jpy: estimatedOutputCostJpy,
    reserved_input_cost_jpy: reservedInputCostJpy,
    estimated_total_cost_jpy: estimatedTotalCostJpy,
    status: 'in_progress',
  };

  let res;
  try {
    res = await client.from(TABLE).insert(payload).select().single();
  } catch (e) {
    // raw exception message は戻り値へ載せない（既存 lib/carouselImageClient.js の方針を踏襲）。
    return { ok: false, reason: 'reserve_unavailable' };
  }

  if (res.error) {
    if (res.error.code === '23505') {
      if (_isNonceUniqueViolation(res.error)) return { ok: false, reason: 'nonce_reused' };
      if (_isActiveOutputViolation(res.error)) return { ok: false, reason: 'post_execution_in_progress' };
      // 識別不能な 23505（将来の別 UNIQUE 制約由来の可能性）＝ 推測で分類せず fail-closed。
      return { ok: false, reason: 'reserve_unavailable' };
    }
    return { ok: false, reason: 'reserve_unavailable' };
  }
  if (!res.data) return { ok: false, reason: 'reserve_unavailable' };

  return { ok: true, execution: res.data };
}

// completeExecution / failExecution 共通: 課金・usage 関連フィールドの検証つき正規化。
// 未指定（undefined）のキーは更新対象に含めない。null は「取得不能」を明示的に表す正当値
// （actualUsage / actualCostJpy / knownActualCostJpy / usageCompleteness で許容）。
function _normalizeUsagePatch(inp) {
  const fields = {};

  if (inp.attemptedProviderCalls !== undefined) {
    const v = _nonNegInt(inp.attemptedProviderCalls);
    if (v === null) return { error: 'attemptedProviderCalls' };
    fields.attempted_provider_calls = v;
  }
  if (inp.successfulProviderCalls !== undefined) {
    const v = _nonNegInt(inp.successfulProviderCalls);
    if (v === null) return { error: 'successfulProviderCalls' };
    fields.successful_provider_calls = v;
  }
  if (inp.spentEstimatedJpy !== undefined) {
    const v = _nonNegNum(inp.spentEstimatedJpy);
    if (v === null) return { error: 'spentEstimatedJpy' };
    fields.spent_estimated_jpy = v;
  }
  if (inp.actualUsage !== undefined) {
    // JSONB・nullable。取得不能時は null を正式に許容し、推測値で埋めない。
    fields.actual_usage = inp.actualUsage;
  }
  if (inp.usageCompleteness !== undefined) {
    const uc = inp.usageCompleteness;
    if (uc !== null && USAGE_COMPLETENESS_ENUM.indexOf(uc) === -1) return { error: 'usageCompleteness' };
    fields.usage_completeness = uc;
  }
  if (inp.actualCostJpy !== undefined) {
    if (inp.actualCostJpy === null) {
      fields.actual_cost_jpy = null;
    } else {
      const v = _nonNegNum(inp.actualCostJpy);
      if (v === null) return { error: 'actualCostJpy' };
      fields.actual_cost_jpy = v;
    }
  }
  if (inp.knownActualCostJpy !== undefined) {
    if (inp.knownActualCostJpy === null) {
      fields.known_actual_cost_jpy = null;
    } else {
      const v = _nonNegNum(inp.knownActualCostJpy);
      if (v === null) return { error: 'knownActualCostJpy' };
      fields.known_actual_cost_jpy = v;
    }
  }

  return { fields: fields };
}

// ══════════════════════════════════════════════════════════════
// completeExecution — 既存 execution 行を status='completed' へ更新する。
//
//   upsert しない。新規行を作らない。更新対象は nonce ＋ status='in_progress' の行のみ
//   （既に completed / failed_* の行を再更新しない＝terminal state の上書き防止）。
//   対象行が存在しない場合は成功扱いにしない。
// ══════════════════════════════════════════════════════════════
async function completeExecution(input, opts) {
  const client = (opts && opts.client) || carouselExecutionClient;
  const inp = input || {};
  const nonce = _str(inp.nonce);
  if (!nonce) return { ok: false, reason: 'invalid_input', field: 'nonce' };
  if (!client) return { ok: false, reason: 'update_unavailable' };

  const patch = _normalizeUsagePatch(inp);
  if (patch.error) return { ok: false, reason: 'invalid_input', field: patch.error };

  const row = Object.assign({}, patch.fields, {
    status: 'completed',
    completed_at: new Date().toISOString(),
  });

  let res;
  try {
    res = await client.from(TABLE).update(row)
      .eq('nonce', nonce).eq('status', 'in_progress')
      .select().single();
  } catch (e) {
    return { ok: false, reason: 'update_unavailable' };
  }

  if (res.error) {
    // PostgREST: .single() で対象行 0 件は「見つからない」エラーになる（既に completed/failed
    // 済み、または存在しない nonce）。成功扱いにしない。
    return { ok: false, reason: 'execution_not_found' };
  }
  if (!res.data) return { ok: false, reason: 'execution_not_found' };

  return { ok: true, execution: res.data };
}

// ══════════════════════════════════════════════════════════════
// failExecution — 既存 execution 行を失敗系 status へ更新する。
//
//   status は failed_before_charge / failed_after_charge / unknown_billing のいずれか必須
//   （不正な値は DB へ送らずここで拒否する）。upsert しない・存在しない execution は
//   成功扱いにしない・terminal state（completed/failed_*）を再更新しない、は completeExecution
//   と同一。
// ══════════════════════════════════════════════════════════════
async function failExecution(input, opts) {
  const client = (opts && opts.client) || carouselExecutionClient;
  const inp = input || {};
  const nonce = _str(inp.nonce);
  const status = _str(inp.status);
  if (!nonce) return { ok: false, reason: 'invalid_input', field: 'nonce' };
  if (!status || FAILURE_STATUSES.indexOf(status) === -1) {
    return { ok: false, reason: 'invalid_input', field: 'status' };
  }
  if (!client) return { ok: false, reason: 'update_unavailable' };

  const patch = _normalizeUsagePatch(inp);
  if (patch.error) return { ok: false, reason: 'invalid_input', field: patch.error };

  const row = Object.assign({}, patch.fields, {
    status: status,
    last_error_code: inp.lastErrorCode !== undefined ? _str(inp.lastErrorCode) : undefined,
    completed_at: new Date().toISOString(),
  });
  // undefined キーは Supabase へ送らない（列を変更しない）。
  Object.keys(row).forEach(function (k) { if (row[k] === undefined) delete row[k]; });

  let res;
  try {
    res = await client.from(TABLE).update(row)
      .eq('nonce', nonce).eq('status', 'in_progress')
      .select().single();
  } catch (e) {
    return { ok: false, reason: 'update_unavailable' };
  }

  if (res.error) return { ok: false, reason: 'execution_not_found' };
  if (!res.data) return { ok: false, reason: 'execution_not_found' };

  return { ok: true, execution: res.data };
}

// ══════════════════════════════════════════════════════════════
// getCumulativeSpentJpyByOutputId — per-post（output_id）cumulative authorization exposure。
//
//   Phase 2-E Production Connection Step B（Decision Candidate 承認済み）:
//   BUDGET_JPY_PER_POST は 1 job invocation ではなく 1 Output Draft（output_id）単位の
//   累積 authorization ceiling として扱う。新しい approval token / nonce を発行しても、
//   同一 output_id なら budget をリセットしない。
//
//   集計規則（Decision 111 の conservative authorization principle を優先）:
//     completed / failed_after_charge / unknown_billing → spent_estimated_jpy を加算
//       （★ unknown_billing を0扱いして再生成を許可しない）
//     failed_before_charge                              → 0
//       （providerCalls===0 が証明されている唯一の状態。それ以外を0扱いしない）
//     in_progress                                        → estimated_total_cost_jpy を加算
//       （reserve成功後にcrashすると spent_estimated_jpy は0のまま更新され得るため、
//         in_progress 行は full authorization 額で保守的に見積もり、budgetを復活させない）
//     未知の status 値・malformed な数値                  → 集計全体を fail-closed
//
//   戻り値:
//     { ok:true, cumulativeJpy, rowCount }
//     { ok:false, reason:'invalid_input', field:'outputId' }
//     { ok:false, reason:'budget_read_unavailable' }
//       … DB未接続／接続エラー／不正な集計値。★ 読み取り失敗を0として扱わない（fail-closed）。
//         呼び出し側はこの reason を「予算に空きがある」と解釈して実行を許可してはならない。
// ══════════════════════════════════════════════════════════════
const TERMINAL_SPENT_STATUSES = ['completed', 'failed_after_charge', 'unknown_billing'];

async function getCumulativeSpentJpyByOutputId(outputId, opts) {
  const client = (opts && opts.client) || carouselExecutionClient;
  const oid = _str(outputId);
  if (!oid) return { ok: false, reason: 'invalid_input', field: 'outputId' };
  if (!client) return { ok: false, reason: 'budget_read_unavailable' };

  let res;
  try {
    res = await client.from(TABLE)
      .select('status, spent_estimated_jpy, estimated_total_cost_jpy')
      .eq('output_id', oid);
  } catch (e) {
    return { ok: false, reason: 'budget_read_unavailable' };
  }
  if (res.error) return { ok: false, reason: 'budget_read_unavailable' };
  const rows = Array.isArray(res.data) ? res.data : null;
  if (rows === null) return { ok: false, reason: 'budget_read_unavailable' };

  let cumulative = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || {};
    const status = _str(row.status);

    if (status === 'failed_before_charge') continue;

    if (status === 'in_progress') {
      const v = _dbNonNegNum(row.estimated_total_cost_jpy);
      if (v === null) return { ok: false, reason: 'budget_read_unavailable' };
      cumulative += v;
      continue;
    }

    if (TERMINAL_SPENT_STATUSES.indexOf(status) !== -1) {
      const v = _dbNonNegNum(row.spent_estimated_jpy);
      if (v === null) return { ok: false, reason: 'budget_read_unavailable' };
      cumulative += v;
      continue;
    }

    // 未知の status 値（将来 status enum が拡張された場合等）＝ 0 として無視せず fail-closed。
    return { ok: false, reason: 'budget_read_unavailable' };
  }

  return { ok: true, cumulativeJpy: cumulative, rowCount: rows.length };
}

module.exports = {
  TABLE: TABLE,
  QUALITY_ENUM: QUALITY_ENUM,
  FAILURE_STATUSES: FAILURE_STATUSES,
  USAGE_COMPLETENESS_ENUM: USAGE_COMPLETENESS_ENUM,
  reserveExecution: reserveExecution,
  completeExecution: completeExecution,
  failExecution: failExecution,
  getCumulativeSpentJpyByOutputId: getCumulativeSpentJpyByOutputId,
};
