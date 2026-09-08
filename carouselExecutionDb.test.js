'use strict';
// carouselExecutionDb.test.js
// Phase 2-E Gate 1 Step② — lib/carouselExecutionDb.js の deterministic テスト。
//   実DB接続 0件 / OpenAI API 0件 / Claude API 0件 / filesystem write 0件 / cost-logs.json 非接触。
//   fake Supabase client（opts.client）を注入し、reserve/complete/fail の atomic 分岐を検証する。
//   ※ 同一 nonce 並行 request の「真の」DBレベル競合は本テストでは再現できない（実Postgresが必要）。
//     ここで検証するのは「2回目の INSERT が 23505 を返したときのコードの分岐」の正しさに限る。

const fs = require('fs');
const path = require('path');

const db = require('./lib/carouselExecutionDb');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

// ── fake Supabase client（in-memory・chainable builder） ──────────────
//   opts.forceSelectResult: () => { data, error } を渡すと select() の結果を強制上書きできる
//   （budget_read_unavailable の DB error テスト用）。
function makeFakeSupabase(opts) {
  opts = opts || {};
  const rows = new Map(); // nonce -> row

  function builder(mode, payload) {
    const eqConds = [];
    const b = {
      eq(col, val) { eqConds.push([col, val]); return b; },
      select() { return b; },
      async single() {
        if (mode === 'insert') {
          const nonce = payload.nonce;
          if (nonce === '__force_other_constraint__') {
            return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "carousel_image_executions_pkey"', details: 'Key (id)=(1) already exists.' } };
          }
          if (nonce === '__force_active_output_violation__') {
            return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_carousel_exec_active_output"', details: 'Key (output_id)=(' + (payload.output_id || '') + ') already exists.' } };
          }
          if (nonce === '__force_unknown_error__') {
            return { data: null, error: { code: '42501', message: 'permission denied for table carousel_image_executions' } };
          }
          if (rows.has(nonce)) {
            return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "carousel_image_executions_nonce_key"', details: 'Key (nonce)=(' + nonce + ') already exists.' } };
          }
          // Phase 2-E Production Connection Step C-1（TOCTOU fix）: real DB の partial UNIQUE index
          //   （supabase/schema.sql の uq_carousel_exec_active_output・WHERE status IN
          //   ('in_progress', 'completed')）と同じ predicate を fake でも再現する。同一 output_id で
          //   in_progress または completed の行が既に存在する場合、別 nonce の INSERT は 23505 を返す
          //   （magic nonce による強制テストとは独立の、実際の行状態に基づく判定）。
          var ACTIVE_OUTPUT_STATUSES = ['in_progress', 'completed'];
          var activeConflict = Array.from(rows.values()).some(function (r) {
            return r.output_id === payload.output_id && ACTIVE_OUTPUT_STATUSES.indexOf(r.status) !== -1;
          });
          if (activeConflict) {
            return { data: null, error: { code: '23505', message: 'duplicate key value violates unique constraint "uq_carousel_exec_active_output"', details: 'Key (output_id)=(' + (payload.output_id || '') + ') already exists.' } };
          }
          const row = Object.assign(
            { id: rows.size + 1, created_at: new Date().toISOString(), consumed_at: new Date().toISOString(), completed_at: null },
            payload
          );
          rows.set(nonce, row);
          return { data: Object.assign({}, row), error: null };
        }
        if (mode === 'update') {
          const nonceCond = eqConds.find(function (e) { return e[0] === 'nonce'; });
          const statusCond = eqConds.find(function (e) { return e[0] === 'status'; });
          const nonce = nonceCond && nonceCond[1];
          const row = nonce ? rows.get(nonce) : null;
          if (!row || (statusCond && row.status !== statusCond[1])) {
            return { data: null, error: { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned' } };
          }
          Object.assign(row, payload);
          return { data: Object.assign({}, row), error: null };
        }
        return { data: null, error: { code: 'unknown', message: 'unsupported mode in fake' } };
      },
    };
    return b;
  }

  // getCumulativeSpentJpyByOutputId 用: select(cols).eq(...) は .single() を呼ばず
  //   直接 await されるため、thenable（.then を持つオブジェクト）として実装する。
  function selectBuilder() {
    const eqConds = [];
    const b = {
      eq(col, val) { eqConds.push([col, val]); return b; },
      then(resolve, reject) {
        try {
          if (opts.forceSelectResult) { resolve(opts.forceSelectResult()); return; }
          let list = Array.from(rows.values());
          eqConds.forEach(function (cond) {
            list = list.filter(function (r) { return r[cond[0]] === cond[1]; });
          });
          resolve({ data: list.map(function (r) { return Object.assign({}, r); }), error: null });
        } catch (e) { reject(e); }
      },
    };
    return b;
  }

  return {
    _rows: rows,
    from: function (table) {
      return {
        insert: function (payload) { return builder('insert', payload); },
        update: function (payload) { return builder('update', payload); },
        select: function (cols) { return selectBuilder(); },
      };
    },
  };
}

// getCumulativeSpentJpyByOutputId のテスト用に、reserve/complete/fail を経由せず
// 任意の status/output_id/金額で行を直接投入するヘルパー（aggregate ロジック単体の検証用）。
function seedExecutionRow(client, row) {
  const nonce = row.nonce || ('seed-' + Math.random().toString(36).slice(2));
  client._rows.set(nonce, Object.assign({ nonce: nonce }, row));
  return nonce;
}

function baseReserveInput(overrides) {
  return Object.assign({
    nonce: 'nonce-' + Math.random().toString(36).slice(2),
    caseId: 'case-value-1788410623',
    workflowId: 'wf-1788413013986',
    outputId: 'out_1788413020275',
    draftFingerprint: 'a'.repeat(64),
    model: 'gpt-image-2',
    quality: 'medium',
    slideCount: 7,
    estimatedOutputTokens: 11109,
    reservedInputTokens: 14000,
    estimatedOutputCostJpy: 53.3232,
    reservedInputCostJpy: 11.2,
    estimatedTotalCostJpy: 64.5232,
  }, overrides || {});
}

(async () => {
  caseHeader('1. reserveExecution: INSERT成功 → ok=true / in_progress');
  {
    const client = makeFakeSupabase();
    const res = await db.reserveExecution(baseReserveInput({ nonce: 'n-ok-1' }), { client: client });
    assert(res.ok === true, '1. reserve成功時 ok=true');
    assert(res.execution && res.execution.status === 'in_progress', '1. status=in_progress で作成される');
    assert(res.execution.consumed_at, '1. consumed_at が設定される');
  }

  caseHeader('2. reserveExecution: 同一nonce 2回目 → nonce_reused（逐次再利用）');
  {
    const client = makeFakeSupabase();
    const input = baseReserveInput({ nonce: 'n-dup-1' });
    const first = await db.reserveExecution(input, { client: client });
    const second = await db.reserveExecution(input, { client: client });
    assert(first.ok === true, '2. 1回目は成功');
    assert(second.ok === false && second.reason === 'nonce_reused', '2. 2回目は nonce_reused');
  }

  caseHeader('3. reserveExecution: 同一nonce “並行” request ×2 → 後続は拒否（コード分岐の検証）');
  {
    const client = makeFakeSupabase();
    const input = baseReserveInput({ nonce: 'n-parallel-1' });
    const results = await Promise.all([
      db.reserveExecution(input, { client: client }),
      db.reserveExecution(input, { client: client }),
    ]);
    const okCount = results.filter(function (r) { return r.ok === true; }).length;
    const deniedCount = results.filter(function (r) { return r.ok === false && r.reason === 'nonce_reused'; }).length;
    assert(okCount === 1, '3. 成功は1件のみ（このjobの provider call 許可は1系統のみ）');
    assert(deniedCount === 1, '3. もう一方は nonce_reused で拒否');
  }

  caseHeader('4. reserveExecution: 別UNIQUE制約由来の23505 → nonce_reusedにせず reserve_unavailable');
  {
    const client = makeFakeSupabase();
    const res = await db.reserveExecution(baseReserveInput({ nonce: '__force_other_constraint__' }), { client: client });
    assert(res.ok === false && res.reason === 'reserve_unavailable', '4. 識別不能23505はnonce_reusedへ推測分類しない');
  }

  caseHeader('5. reserveExecution: 識別不能な unknown DB error → reserve_unavailable');
  {
    const client = makeFakeSupabase();
    const res = await db.reserveExecution(baseReserveInput({ nonce: '__force_unknown_error__' }), { client: client });
    assert(res.ok === false && res.reason === 'reserve_unavailable', '5. unknown DB errorはreserve_unavailable');
  }

  caseHeader('6. reserveExecution: client=null（Supabase unavailable）→ reserve_unavailable / fallback成功なし');
  {
    const res = await db.reserveExecution(baseReserveInput({ nonce: 'n-noclient-1' }), { client: null });
    assert(res.ok === false && res.reason === 'reserve_unavailable', '6. client未設定はfail-closed');
  }

  caseHeader('7. reserveExecution: 入力不正はDBへ到達せずinvalid_input');
  {
    const client = makeFakeSupabase();
    const missingCase = await db.reserveExecution(baseReserveInput({ caseId: '' }), { client: client });
    assert(missingCase.ok === false && missingCase.reason === 'invalid_input' && missingCase.field === 'caseId',
      '7a. caseId欠落はinvalid_input');
    const badQuality = await db.reserveExecution(baseReserveInput({ quality: '' }), { client: client });
    assert(badQuality.ok === false && badQuality.reason === 'invalid_input' && badQuality.field === 'quality',
      '7b. quality空文字はinvalid_input（medium等へfallbackしない）');
    const badSlide = await db.reserveExecution(baseReserveInput({ slideCount: 0 }), { client: client });
    assert(badSlide.ok === false && badSlide.reason === 'invalid_input' && badSlide.field === 'slideCount',
      '7c. slideCount=0はinvalid_input');
    assert(client._rows.size === 0, '7d. 入力不正3件のいずれもDBへ到達していない（rows作成0）');
  }

  caseHeader('8. completeExecution: 既存executionを completed へ更新');
  {
    const client = makeFakeSupabase();
    const nonce = 'n-complete-1';
    await db.reserveExecution(baseReserveInput({ nonce: nonce }), { client: client });
    const res = await db.completeExecution({
      nonce: nonce,
      attemptedProviderCalls: 7,
      successfulProviderCalls: 7,
      spentEstimatedJpy: 64.5232,
      actualUsage: { textInputTokens: 3200, imageInputTokens: 0, outputTokens: 11109, totalTokens: 14309 },
      usageCompleteness: 'complete',
      actualCostJpy: 50.1,
      knownActualCostJpy: null,
    }, { client: client });
    assert(res.ok === true && res.execution.status === 'completed', '8. status=completedへ更新');
    assert(res.execution.successful_provider_calls === 7, '8. successful_provider_calls反映');
    assert(res.execution.completed_at, '8. completed_atが設定される');
  }

  caseHeader('9. failExecution: 許可されたstatusのみで既存executionを更新');
  {
    const client = makeFakeSupabase();
    const nonce = 'n-fail-1';
    await db.reserveExecution(baseReserveInput({ nonce: nonce }), { client: client });
    const res = await db.failExecution({
      nonce: nonce,
      status: 'failed_after_charge',
      attemptedProviderCalls: 3,
      successfulProviderCalls: 2,
      spentEstimatedJpy: 27.6528,
      actualUsage: null,
      usageCompleteness: 'unavailable',
      actualCostJpy: null,
      knownActualCostJpy: null,
      lastErrorCode: 'composite_failed',
    }, { client: client });
    assert(res.ok === true && res.execution.status === 'failed_after_charge', '9. status=failed_after_chargeへ更新');
    assert(res.execution.last_error_code === 'composite_failed', '9. last_error_code反映');
  }

  caseHeader('10. failExecution: 不正なstatusはDBへ送らずinvalid_input');
  {
    const client = makeFakeSupabase();
    const nonce = 'n-badstatus-1';
    await db.reserveExecution(baseReserveInput({ nonce: nonce }), { client: client });
    const before = client._rows.get(nonce).status;
    const res = await db.failExecution({ nonce: nonce, status: 'completed' }, { client: client });
    assert(res.ok === false && res.reason === 'invalid_input' && res.field === 'status',
      "10a. 'completed'はfailExecutionの許可statusではない");
    const res2 = await db.failExecution({ nonce: nonce, status: 'not_a_real_status' }, { client: client });
    assert(res2.ok === false && res2.reason === 'invalid_input', '10b. 未知のstatus文字列も拒否');
    assert(client._rows.get(nonce).status === before, '10c. DBへは到達せず行が変化していない');
  }

  caseHeader('11. update対象なし: 存在しないnonce / 既にterminalな行は成功扱いにしない');
  {
    const client = makeFakeSupabase();
    const missing = await db.completeExecution({ nonce: 'no-such-nonce' }, { client: client });
    assert(missing.ok === false && missing.reason === 'execution_not_found', '11a. 存在しないnonceはexecution_not_found');

    const nonce = 'n-terminal-1';
    await db.reserveExecution(baseReserveInput({ nonce: nonce }), { client: client });
    const first = await db.completeExecution({ nonce: nonce }, { client: client });
    assert(first.ok === true, '11b. 1回目のcompleteは成功');
    const second = await db.completeExecution({ nonce: nonce }, { client: client });
    assert(second.ok === false && second.reason === 'execution_not_found',
      '11c. 既にcompleted済みの行への2回目completeは成功扱いにしない（terminal上書き防止）');
    assert(client._rows.get(nonce).status === 'completed', '11d. terminal状態のstatusが上書きされていない');
  }

  caseHeader('12. Upsert禁止: complete/failは新規行を作らない');
  {
    const client = makeFakeSupabase();
    const res = await db.completeExecution({ nonce: 'never-reserved' }, { client: client });
    assert(res.ok === false, '12a. reserveされていないnonceへのcompleteは失敗する');
    assert(client._rows.size === 0, '12b. rows作成0（新規行が作られていない）');
  }

  caseHeader('13. nonce release / delete API が存在しないこと');
  {
    assert(typeof db.deleteExecution === 'undefined', '13a. deleteExecution 未実装');
    assert(typeof db.releaseNonce === 'undefined', '13b. releaseNonce 未実装');
    assert(typeof db.resetNonce === 'undefined', '13c. resetNonce 未実装');
    assert(typeof db.reuseNonce === 'undefined', '13d. reuseNonce 未実装');
    const exported = Object.keys(db).sort();
    assert(JSON.stringify(exported) === JSON.stringify(
      ['FAILURE_STATUSES', 'QUALITY_ENUM', 'TABLE', 'USAGE_COMPLETENESS_ENUM',
        'completeExecution', 'failExecution', 'reserveExecution', 'getCumulativeSpentJpyByOutputId'].sort()
    ), '13e. exportは reserve/complete/fail/getCumulativeSpentJpyByOutputId と定数のみ（想定外の追加APIなし）: ' + exported.join(','));
  }

  caseHeader('14. Decision110: privileged credential 不在時の fail-closed / anon fallback なし');
  {
    // Claude Code / local には SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY を置かない方針のため、
    // このテスト環境では privileged client は必ず null になる（= 本番未設定と同じ状態）。
    const privileged = require('./lib/carouselExecutionSupabase');
    assert(privileged.isPrivilegedClientConfigured() === false,
      '14a. credential未設定の本環境では privileged client が未構成（null）');

    // Test A: opts.client なし・credential なし → reserve_unavailable
    const resA = await db.reserveExecution(baseReserveInput({ nonce: 'n-noprivileged-1' }));
    assert(resA.ok === false && resA.reason === 'reserve_unavailable',
      '14b. opts.client 省略かつ credential 不在なら reserve_unavailable（provider call 0）');

    const resComplete = await db.completeExecution({ nonce: 'n-noprivileged-1' });
    assert(resComplete.ok === false && resComplete.reason === 'update_unavailable',
      '14c. completeExecution も credential 不在で update_unavailable');
    const resFail = await db.failExecution({ nonce: 'n-noprivileged-1', status: 'unknown_billing' });
    assert(resFail.ok === false && resFail.reason === 'update_unavailable',
      '14d. failExecution も credential 不在で update_unavailable');

    // Test B: anon client へ fallback しないこと（構造検証）。
    //   lib/carouselExecutionDb.js が lib/supabase.js を require していない＝
    //   anon client を掴む経路がソース上に存在しないことを実測する。
    const dbSrc = fs.readFileSync(path.join(__dirname, 'lib', 'carouselExecutionDb.js'), 'utf8');
    assert(dbSrc.indexOf("require('./supabase')") === -1,
      "14e. carouselExecutionDb は lib/supabase.js（anon client）を require していない");
    assert(dbSrc.indexOf('SUPABASE_ANON_KEY') === -1,
      '14f. carouselExecutionDb は anon key を参照していない');
    assert(dbSrc.indexOf("require('./carouselExecutionSupabase')") !== -1,
      '14g. carouselExecutionDb は privileged client のみを require している');

    const privSrc = fs.readFileSync(path.join(__dirname, 'lib', 'carouselExecutionSupabase.js'), 'utf8');
    // ※ コメント内での「参照しない」という説明的言及は許容し、実コード参照（process.env.<name> /
    //   require）のみを禁止対象として検査する。
    assert(privSrc.indexOf('process.env.SUPABASE_ANON_KEY') === -1
      && privSrc.indexOf('process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY') === -1
      && privSrc.indexOf("require('./supabase')") === -1,
      '14h. privileged client module は anon key / anon client を実コードで参照しない');
    assert(privSrc.indexOf('NEXT_PUBLIC_SUPABASE_SECRET_KEY') === -1
      && privSrc.indexOf('NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY') === -1,
      '14i. secret を NEXT_PUBLIC_* 名で参照していない');
    assert(privSrc.indexOf('SUPABASE_SECRET_KEY') !== -1
      && privSrc.indexOf('SUPABASE_SERVICE_ROLE_KEY') !== -1,
      '14j. 環境変数「名」は SUPABASE_SECRET_KEY（優先）＋ legacy fallback を参照');

    // Test C: opts.client の fake 注入は従来どおり動作する（credential 不在でも deterministic）
    const fake = makeFakeSupabase();
    const resC = await db.reserveExecution(baseReserveInput({ nonce: 'n-fake-still-works' }), { client: fake });
    assert(resC.ok === true && resC.execution.status === 'in_progress',
      '14k. credential 不在環境でも fake 注入で deterministic test が成立する');
  }

  caseHeader('15. Step B: active-output 23505 分類（post_execution_in_progress）');
  {
    const client = makeFakeSupabase();
    const res = await db.reserveExecution(baseReserveInput({ nonce: '__force_active_output_violation__', outputId: 'out_A' }), { client: client });
    assert(res.ok === false && res.reason === 'post_execution_in_progress',
      '15a. uq_carousel_exec_active_output 由来の23505 → post_execution_in_progress');

    // 既存分類（nonce/他制約/unknown）に回帰がないことを確認
    const dup = baseReserveInput({ nonce: 'n-regress-1' });
    await db.reserveExecution(dup, { client: client });
    const dupRes = await db.reserveExecution(dup, { client: client });
    assert(dupRes.reason === 'nonce_reused', '15b. 既存の nonce_reused 分類に回帰なし');
    const otherRes = await db.reserveExecution(baseReserveInput({ nonce: '__force_other_constraint__' }), { client: client });
    assert(otherRes.reason === 'reserve_unavailable', '15c. 識別不能な23505（他制約）は引き続き reserve_unavailable');
    const unknownRes = await db.reserveExecution(baseReserveInput({ nonce: '__force_unknown_error__' }), { client: client });
    assert(unknownRes.reason === 'reserve_unavailable', '15d. 23505以外の未知DBエラーは reserve_unavailable のまま');
  }

  caseHeader('16. Step B: getCumulativeSpentJpyByOutputId — status別集計規則');
  {
    // 1: completed → spent_estimated_jpy を加算
    {
      const client = makeFakeSupabase();
      seedExecutionRow(client, { output_id: 'out_A', status: 'completed', spent_estimated_jpy: 92.5232, estimated_total_cost_jpy: 92.5232 });
      const r = await db.getCumulativeSpentJpyByOutputId('out_A', { client: client });
      assert(r.ok === true && Math.abs(r.cumulativeJpy - 92.5232) < 1e-9 && r.rowCount === 1,
        '16-1. completed行は spent_estimated_jpy(¥92.5232) で集計');
    }
    // 2: failed_after_charge → spent_estimated_jpy を加算
    {
      const client = makeFakeSupabase();
      seedExecutionRow(client, { output_id: 'out_A', status: 'failed_after_charge', spent_estimated_jpy: 26.4352, estimated_total_cost_jpy: 92.5232 });
      const r = await db.getCumulativeSpentJpyByOutputId('out_A', { client: client });
      assert(r.ok === true && Math.abs(r.cumulativeJpy - 26.4352) < 1e-9,
        '16-2. failed_after_charge行は spent_estimated_jpy で集計（estimated_totalではない）');
    }
    // 3: unknown_billing → 0扱いしない（spent_estimated_jpyで集計）
    {
      const client = makeFakeSupabase();
      seedExecutionRow(client, { output_id: 'out_A', status: 'unknown_billing', spent_estimated_jpy: 13.2176, estimated_total_cost_jpy: 92.5232 });
      const r = await db.getCumulativeSpentJpyByOutputId('out_A', { client: client });
      assert(r.ok === true && Math.abs(r.cumulativeJpy - 13.2176) < 1e-9 && r.cumulativeJpy !== 0,
        '16-3. unknown_billing行は0扱いされず spent_estimated_jpy で集計される');
    }
    // 4: failed_before_charge → 0
    {
      const client = makeFakeSupabase();
      seedExecutionRow(client, { output_id: 'out_A', status: 'failed_before_charge', spent_estimated_jpy: 0, estimated_total_cost_jpy: 92.5232 });
      const r = await db.getCumulativeSpentJpyByOutputId('out_A', { client: client });
      assert(r.ok === true && r.cumulativeJpy === 0,
        '16-4. failed_before_charge行は0として集計（estimated_totalを使わない）');
    }
    // 5: in_progress → estimated_total_cost_jpy を加算（crash後もbudgetが0へ戻らないことの核心）
    {
      const client = makeFakeSupabase();
      seedExecutionRow(client, { output_id: 'out_A', status: 'in_progress', spent_estimated_jpy: 0, estimated_total_cost_jpy: 92.5232 });
      const r = await db.getCumulativeSpentJpyByOutputId('out_A', { client: client });
      assert(r.ok === true && Math.abs(r.cumulativeJpy - 92.5232) < 1e-9,
        '16-5. in_progress行は spent_estimated_jpy(0のまま) ではなく estimated_total_cost_jpy(¥92.5232) で保守的に集計');
    }
    // 6: 複数行の合算 + output_idスコープの独立性
    {
      const client = makeFakeSupabase();
      seedExecutionRow(client, { output_id: 'out_A', status: 'completed', spent_estimated_jpy: 92.5232, estimated_total_cost_jpy: 92.5232 });
      seedExecutionRow(client, { output_id: 'out_A', status: 'failed_before_charge', spent_estimated_jpy: 0, estimated_total_cost_jpy: 92.5232 });
      seedExecutionRow(client, { output_id: 'out_B', status: 'completed', spent_estimated_jpy: 999, estimated_total_cost_jpy: 999 });
      const rA = await db.getCumulativeSpentJpyByOutputId('out_A', { client: client });
      const rB = await db.getCumulativeSpentJpyByOutputId('out_B', { client: client });
      assert(rA.ok === true && Math.abs(rA.cumulativeJpy - 92.5232) < 1e-9 && rA.rowCount === 2,
        '16-6a. out_A は自身の2行のみ合算（out_Bを含まない）');
      assert(rB.ok === true && Math.abs(rB.cumulativeJpy - 999) < 1e-9,
        '16-6b. out_B は独立したbudgetとして集計される（出力ドラフト単位の分離）');
    }
    // 7: DB read失敗 → budget_read_unavailable（0として扱わない）
    {
      const client = makeFakeSupabase({ forceSelectResult: () => ({ data: null, error: { code: '08006', message: 'connection failure' } }) });
      const r = await db.getCumulativeSpentJpyByOutputId('out_A', { client: client });
      assert(r.ok === false && r.reason === 'budget_read_unavailable',
        '16-7. DB read失敗 → budget_read_unavailable（0扱いしない）');
    }
    // 8: client未設定（credential不在）→ budget_read_unavailable
    {
      const r = await db.getCumulativeSpentJpyByOutputId('out_A', { client: null });
      assert(r.ok === false && r.reason === 'budget_read_unavailable',
        '16-8. client未設定 → budget_read_unavailable（fail-closed・anon fallbackなし）');
    }
    // 9: 不正なoutputId → invalid_input（DBへ到達しない）
    {
      const client = makeFakeSupabase();
      const r = await db.getCumulativeSpentJpyByOutputId('', { client: client });
      assert(r.ok === false && r.reason === 'invalid_input' && r.field === 'outputId',
        '16-9. outputId空文字 → invalid_input（DB未到達）');
    }
    // 10: malformed数値（spent_estimated_jpyが不正）→ 集計全体をfail-closed
    {
      const client = makeFakeSupabase();
      seedExecutionRow(client, { output_id: 'out_A', status: 'completed', spent_estimated_jpy: 'not-a-number', estimated_total_cost_jpy: 92.5232 });
      const r = await db.getCumulativeSpentJpyByOutputId('out_A', { client: client });
      assert(r.ok === false && r.reason === 'budget_read_unavailable',
        '16-10a. spent_estimated_jpyが不正な数値 → budget_read_unavailable（安全側フェイル）');
    }
    {
      const client = makeFakeSupabase();
      seedExecutionRow(client, { output_id: 'out_A', status: 'in_progress', spent_estimated_jpy: 0, estimated_total_cost_jpy: null });
      const r = await db.getCumulativeSpentJpyByOutputId('out_A', { client: client });
      assert(r.ok === false && r.reason === 'budget_read_unavailable',
        '16-10b. in_progress行のestimated_total_cost_jpyがnull → budget_read_unavailable');
    }
    // 11: 負の値 → fail-closed
    {
      const client = makeFakeSupabase();
      seedExecutionRow(client, { output_id: 'out_A', status: 'completed', spent_estimated_jpy: -5, estimated_total_cost_jpy: 92.5232 });
      const r = await db.getCumulativeSpentJpyByOutputId('out_A', { client: client });
      assert(r.ok === false && r.reason === 'budget_read_unavailable',
        '16-11. 負のspent_estimated_jpy → budget_read_unavailable（安全側フェイル）');
    }
    // 12: 未知のstatus値 → 0として無視せずfail-closed
    {
      const client = makeFakeSupabase();
      seedExecutionRow(client, { output_id: 'out_A', status: 'some_future_status', spent_estimated_jpy: 10, estimated_total_cost_jpy: 92.5232 });
      const r = await db.getCumulativeSpentJpyByOutputId('out_A', { client: client });
      assert(r.ok === false && r.reason === 'budget_read_unavailable',
        '16-12. 未知のstatus値は0として無視せず budget_read_unavailable');
    }
    // 13: 対象output_idの行が0件 → cumulativeJpy=0（正常系）
    {
      const client = makeFakeSupabase();
      seedExecutionRow(client, { output_id: 'out_OTHER', status: 'completed', spent_estimated_jpy: 50, estimated_total_cost_jpy: 50 });
      const r = await db.getCumulativeSpentJpyByOutputId('out_A', { client: client });
      assert(r.ok === true && r.cumulativeJpy === 0 && r.rowCount === 0,
        '16-13. 該当行0件は正常系として cumulativeJpy=0（DB到達はできている）');
    }
  }

  caseHeader('17. Step B: carouselExecutionStore adapter（raw data非露出・IF最小性）');
  {
    const store = require('./lib/carouselExecutionStore').carouselExecutionStore;
    assert(typeof store.reserve === 'function' && typeof store.complete === 'function'
      && typeof store.fail === 'function' && typeof store.getCumulativeSpentJpyByOutputId === 'function',
      '17a. carouselExecutionStore は reserve/complete/fail/getCumulativeSpentJpyByOutputId を提供する');
    assert(typeof store.delete === 'undefined' && typeof store.release === 'undefined' && typeof store.reclaim === 'undefined',
      '17b. delete/release/reclaim は実装されていない');
    const storeSrc = fs.readFileSync(path.join(__dirname, 'lib', 'carouselExecutionStore.js'), 'utf8');
    assert(storeSrc.indexOf("require('./supabase')") === -1 && storeSrc.indexOf('SUPABASE_ANON_KEY') === -1,
      '17c. carouselExecutionStore は anon client / anon key を参照しない');
    assert(storeSrc.indexOf("require('./carouselExecutionDb')") !== -1,
      '17d. carouselExecutionStore は lib/carouselExecutionDb.js 経由でのみDBへ触れる');
  }

  caseHeader('18. Step C-1: TOCTOU fix — partial UNIQUE indexを (in_progress, completed) へ拡張');
  {
    // 18a: in_progress行は同一output_idの別nonce reserveを拒否する（real flowでの回帰確認）
    {
      const client = makeFakeSupabase();
      const outputId = 'out_toctou_1';
      const resA = await db.reserveExecution(baseReserveInput({ nonce: 'toctou-a1', outputId: outputId }), { client: client });
      assert(resA.ok === true, '18a-1. Aのreserveは成功（in_progress）');
      const resB = await db.reserveExecution(baseReserveInput({ nonce: 'toctou-b1', outputId: outputId }), { client: client });
      assert(resB.ok === false && resB.reason === 'post_execution_in_progress',
        '18a-2. Aがin_progressのままBが同一output_idでreserveすると拒否される');
    }

    // 18b: TOCTOU再現 — Aがcompletedへ遷移した後もindex占有が維持され、
    //   古いcumulative=0を保持したままのBのreserveがDB側で拒否される（本Stepの核心テスト）
    {
      const client = makeFakeSupabase();
      const outputId = 'out_toctou_2';

      // 1. Request Bが古いcumulative=0を保持（reserve前のpre-flight相当の読み取り）
      const beforeB = await db.getCumulativeSpentJpyByOutputId(outputId, { client: client });
      assert(beforeB.ok === true && beforeB.cumulativeJpy === 0, '18b-1. Bはreserve前にcumulative=0を観測（stale値として保持）');

      // 2. Request Aがreserve成功
      const resA = await db.reserveExecution(baseReserveInput({ nonce: 'toctou-a2', outputId: outputId }), { client: client });
      assert(resA.ok === true, '18b-2. Aのreserveは成功');

      // 3. Request Aをcompletedへ更新
      const completeA = await db.completeExecution({
        nonce: 'toctou-a2',
        attemptedProviderCalls: 7,
        successfulProviderCalls: 7,
        spentEstimatedJpy: 92.5232,
        actualUsage: { textInputTokens: 3200, imageInputTokens: 0, outputTokens: 11109, totalTokens: 14309 },
        usageCompleteness: 'complete',
        actualCostJpy: 92.5232,
        knownActualCostJpy: null,
      }, { client: client });
      assert(completeA.ok === true && completeA.execution.status === 'completed', '18b-3. Aはcompletedへ更新される');

      // 4. Request Bが（古いcumulative=0を保持したまま）別nonce・同一output_idでreserve
      const resB = await db.reserveExecution(baseReserveInput({ nonce: 'toctou-b2', outputId: outputId }), { client: client });

      // 5〜7. DB fake（partial UNIQUE相当）により23505 classificationされ、provider相当処理へ進まない
      assert(resB.ok === false && resB.reason === 'post_execution_in_progress',
        '18b-4. Aがcompletedになった後もindex占有が維持され、古いSUM=0を保持するBのreserveはDB側で拒否される（TOCTOU close）');
    }

    // 18c: completed行は別output_idのreserveを妨げない（output_idスコープの独立性）
    {
      const client = makeFakeSupabase();
      const resA = await db.reserveExecution(baseReserveInput({ nonce: 'toctou-c-a', outputId: 'out_toctou_c1' }), { client: client });
      assert(resA.ok === true, '18c-1. Aのreserveは成功');
      const completeA = await db.completeExecution({
        nonce: 'toctou-c-a', attemptedProviderCalls: 7, successfulProviderCalls: 7, spentEstimatedJpy: 92.5232,
        actualUsage: null, usageCompleteness: 'unavailable', actualCostJpy: null, knownActualCostJpy: null,
      }, { client: client });
      assert(completeA.ok === true, '18c-2. Aはcompletedへ更新される');
      const resB = await db.reserveExecution(baseReserveInput({ nonce: 'toctou-c-b', outputId: 'out_toctou_c2' }), { client: client });
      assert(resB.ok === true, '18c-3. 別output_idのcompleted行は新規reserveを妨げない');
    }

    // 18d: failed_before_charge / failed_after_charge / unknown_billing はindex対象外
    //   （同一output_idへの新規reserveを妨げない・既存 getCumulativeSpentJpyByOutputId の
    //   spent_estimated_jpy集計で別途budget管理される既存設計を変えない）
    {
      const client = makeFakeSupabase();
      const outputId = 'out_toctou_d';

      const resA = await db.reserveExecution(baseReserveInput({ nonce: 'toctou-d-a', outputId: outputId }), { client: client });
      assert(resA.ok === true, '18d-1. Aのreserveは成功');
      const failA = await db.failExecution({ nonce: 'toctou-d-a', status: 'failed_before_charge' }, { client: client });
      assert(failA.ok === true && failA.execution.status === 'failed_before_charge', '18d-2. Aはfailed_before_chargeへ更新される');
      const resB = await db.reserveExecution(baseReserveInput({ nonce: 'toctou-d-b', outputId: outputId }), { client: client });
      assert(resB.ok === true, '18d-3. failed_before_charge行はindex対象外のため同一output_idの新規reserveを妨げない');

      const failB = await db.failExecution({ nonce: 'toctou-d-b', status: 'failed_after_charge', spentEstimatedJpy: 30 }, { client: client });
      assert(failB.ok === true && failB.execution.status === 'failed_after_charge', '18d-4. Bはfailed_after_chargeへ更新される');
      const resC = await db.reserveExecution(baseReserveInput({ nonce: 'toctou-d-c', outputId: outputId }), { client: client });
      assert(resC.ok === true, '18d-5. failed_after_charge行もindex対象外のため新規reserveを妨げない');

      const failC = await db.failExecution({ nonce: 'toctou-d-c', status: 'unknown_billing' }, { client: client });
      assert(failC.ok === true && failC.execution.status === 'unknown_billing', '18d-6. Cはunknown_billingへ更新される');
      const resD = await db.reserveExecution(baseReserveInput({ nonce: 'toctou-d-d', outputId: outputId }), { client: client });
      assert(resD.ok === true, '18d-7. unknown_billing行もindex対象外のため新規reserveを妨げない');
    }

    // 18e: nonce_reused分類は今回の変更で回帰していない（active-output判定より先にnonce判定が効く）
    {
      const client = makeFakeSupabase();
      const input = baseReserveInput({ nonce: 'toctou-e-1', outputId: 'out_toctou_e' });
      const first = await db.reserveExecution(input, { client: client });
      const second = await db.reserveExecution(input, { client: client });
      assert(first.ok === true && second.ok === false && second.reason === 'nonce_reused',
        '18e. 同一nonceの再利用は引き続きnonce_reused（active-output判定と混同しない）');
    }

    // 18f: release/reclaim/自動timeout unlockは実装されていない（既存方針の維持）
    {
      assert(typeof db.releaseNonce === 'undefined' && typeof db.reclaimExecution === 'undefined'
        && typeof db.unlockExecution === 'undefined',
        '18f. release/reclaim/timeout unlock系APIは今回も実装されていない');
    }

    // 18g: schema.sql のpartial UNIQUE index predicateが (in_progress, completed) へ拡張されていることを実測
    {
      const schemaSrc = fs.readFileSync(path.join(__dirname, 'supabase', 'schema.sql'), 'utf8');
      const idxMatch = schemaSrc.match(/CREATE UNIQUE INDEX IF NOT EXISTS uq_carousel_exec_active_output[\s\S]*?;/);
      assert(idxMatch !== null, '18g-1. uq_carousel_exec_active_output のindex定義がschema.sqlに存在する');
      const idxSql = idxMatch ? idxMatch[0] : '';
      assert(idxSql.indexOf("WHERE status IN ('in_progress', 'completed')") !== -1,
        "18g-2. predicateが WHERE status IN ('in_progress', 'completed') へ拡張されている");
      assert(idxSql.indexOf("WHERE status = 'in_progress'") === -1,
        '18g-3. 旧predicate（in_progress単独）は残存していない');
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All carouselExecutionDb cases passed (Phase 2-E Gate 1 Step②)'); }
})().catch(e => { console.error('TEST CRASH:', e); process.exitCode = 1; });
