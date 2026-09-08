'use strict';
// carouselRealEnabledKillSwitch.test.js
// Production Activation Step PA-1 — Real Image Generation Dual-Key Kill Switch の
// deterministic テスト。
//   実OpenAI API呼び出し 0件 / 実Supabase 0件 / 実Storage 0件 / paid generation 0件。
//   process.env.CAROUSEL_IMAGE_REAL_ENABLED / OPENAI_API_KEY は各テストで save/restore する
//   （テスト終了後に process.env を汚染しない）。

const fs = require('fs');
const path = require('path');

const client = require('./lib/carouselImageClient');
const core = require('./shared/carouselImageCore');
const approval = require('./shared/carouselApproval');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const ENV_KEY = 'CAROUSEL_IMAGE_REAL_ENABLED';
const SAFE_PROMPT = 'clean minimal background, no text, 4:5 ratio, vertical, 1080x1350';

// 実行前後で client.REAL_ENABLED（source gate）と process.env[ENV_KEY] を必ず元へ戻す。
async function withGates(sourceVal, envVal, fn) {
  const savedSource = client.REAL_ENABLED;
  const savedEnv = process.env[ENV_KEY];
  client.REAL_ENABLED = sourceVal;
  if (envVal === undefined) delete process.env[ENV_KEY];
  else process.env[ENV_KEY] = envVal;
  try { return await fn(); }
  finally {
    client.REAL_ENABLED = savedSource;
    if (savedEnv === undefined) delete process.env[ENV_KEY];
    else process.env[ENV_KEY] = savedEnv;
  }
}

const TEST_SECRET = 'pa1-test-carousel-approval-secret-32b';
const FIXTURE_DRAFT = {
  case_id: 'case-value-1788410623',
  output_id: 'out_1788413020275',
  built_at: '2026-09-03T05:24:48.532Z',
  updated_at: '2026-09-03T05:52:03.598Z',
  fields: {
    slides: Array.from({ length: 7 }, (_, i) => '【' + (i + 1) + '枚目】タイトル：t' + i + ' / 本文：b' + i + ' / ビジュアル：v' + i),
    imagePrompts: Array.from({ length: 7 }, (_, i) => 'p' + i),
    cta: 'cta',
  },
};
const FIXTURE_APPROVAL = { approval_decision: 'approved', published: false };

function buildCtx() {
  const fp = core.draftFingerprint(FIXTURE_DRAFT);
  const estJpy = client.estimateAuthorizedTotalJpy('medium', 7);
  const iss = approval.issueApprovalToken({
    caseId: FIXTURE_DRAFT.case_id, outputId: FIXTURE_DRAFT.output_id,
    draftFingerprint: fp, quality: 'medium', slideCount: 7, estimatedCostJpy: estJpy,
  }, { secret: TEST_SECRET });
  return {
    billingLock: false, costTrackerCanProcess: true,
    caseId: FIXTURE_DRAFT.case_id, outputId: FIXTURE_DRAFT.output_id,
    draftRow: FIXTURE_DRAFT, approvalRow: FIXTURE_APPROVAL,
    staleBefore: { built_at: FIXTURE_DRAFT.built_at, updated_at: FIXTURE_DRAFT.updated_at },
    staleAfter: { built_at: FIXTURE_DRAFT.built_at, updated_at: FIXTURE_DRAFT.updated_at },
    quality: 'medium', slideCount: 7, estimatedCostJpy: estJpy,
    draftFingerprint: fp, approvalToken: iss.token, approvalSecret: TEST_SECRET,
    budgetJpyPerPost: 100,
  };
}

(async () => {
  caseHeader('1〜6. Production Safety Matrix（#9-1〜6）— いずれもdisabled');
  {
    const matrix = [
      ['1. REAL_ENABLED=false / env missing', false, undefined],
      ['2. REAL_ENABLED=false / env=true', false, 'true'],
      ['3. REAL_ENABLED=true / env missing', true, undefined],
      ['4. REAL_ENABLED=true / env=false', true, 'false'],
      ['5. REAL_ENABLED=true / env=TRUE', true, 'TRUE'],
      ['6. REAL_ENABLED=true / env=1', true, '1'],
      ['6b. REAL_ENABLED=true / env=""', true, ''],
      ['6c. REAL_ENABLED=true / env="True"', true, 'True'],
      ['6d. REAL_ENABLED=true / env="yes"', true, 'yes'],
      ['6e. REAL_ENABLED=true / env=" true"（前後空白)', true, ' true'],
      ['6f. REAL_ENABLED=true / env="true "（末尾空白)', true, 'true '],
    ];
    for (const [label, sourceVal, envVal] of matrix) {
      await withGates(sourceVal, envVal, async () => {
        assert(client.REAL_ENABLED === false, label + ' → client.REAL_ENABLED は false');
        assert(client.isRealGenerationEnabled() === false, label + ' → isRealGenerationEnabled() も false');
        const r = await client.generateBackground({ prompt: SAFE_PROMPT, quality: 'medium', aspectRatio: '4:5', mock: false });
        assert(r.ok === false && r.reason === 'real_api_disabled', label + ' → generateBackground(mock:false)はreal_api_disabled');
      });
    }
  }

  caseHeader('7. dual-key成立時のみ fake/allowed path（#9-7）');
  {
    // ★ 実際の provider network callはOPENAI_API_KEY次第でここから先へ進むため、
    //   このテストでは「dual-keyのgateを通過した」ことだけを検証し、実networkは呼ばない
    //   （OPENAI_API_KEYは元々.env.localにのみ存在しうるが、ここでは意図的に読み取らせず
    //   no_api_keyで停止させることで実到達を防ぐ）。
    const savedKey = process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_API_KEY;
    try {
      await withGates(true, 'true', async () => {
        assert(client.isRealGenerationEnabled() === true, '7a. dual-key成立（source=true ∧ env=true）でisRealGenerationEnabledがtrue');
        const r = await client.generateBackground({ prompt: SAFE_PROMPT, quality: 'medium', aspectRatio: '4:5', mock: false });
        assert(r.ok === false && r.reason === 'no_api_key',
          '7b. dual-key成立後は real_api_disabled を通過し、次のgate（no_api_key）まで進む（実network到達はしない）');
      });
    } finally {
      if (savedKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = savedKey;
    }
  }

  caseHeader('7c. assertRealCallAllowed() も同一gateで一貫する（#11整合性）');
  {
    await withGates(true, undefined, () => {
      const res = core.assertRealCallAllowed(buildCtx());
      assert(res.ok === false && res.reason === 'real_api_disabled',
        '7c-1. source=true・env未設定 → assertRealCallAllowedもreal_api_disabled（reserveより前で停止）');
    });
    await withGates(true, 'true', () => {
      const res = core.assertRealCallAllowed(buildCtx());
      assert(res.ok === true, '7c-2. dual-key成立 → assertRealCallAllowedはokになる（他条件は別テストで検証済み）');
    });
  }

  caseHeader('8. OPENAI_API_KEY存在してもdual-key不成立ならAPI call 0（#9-8）');
  {
    const savedKey = process.env.OPENAI_API_KEY;
    process.env.OPENAI_API_KEY = 'sk-fake-key-for-test-only-not-real';
    try {
      await withGates(true, undefined, async () => {
        const r = await client.generateBackground({ prompt: SAFE_PROMPT, quality: 'medium', aspectRatio: '4:5', mock: false });
        assert(r.ok === false && r.reason === 'real_api_disabled',
          '8. OPENAI_API_KEYが存在してもenv gate不成立ならreal_api_disabled（API呼び出しへ到達しない）');
      });
      await withGates(false, 'true', async () => {
        const r = await client.generateBackground({ prompt: SAFE_PROMPT, quality: 'medium', aspectRatio: '4:5', mock: false });
        assert(r.ok === false && r.reason === 'real_api_disabled',
          '8b. OPENAI_API_KEYが存在してもsource gate不成立ならreal_api_disabled');
      });
    } finally {
      if (savedKey === undefined) delete process.env.OPENAI_API_KEY; else process.env.OPENAI_API_KEY = savedKey;
    }
  }

  caseHeader('5. Source Gateを削除していないことの確認（#5）');
  {
    const src = fs.readFileSync(path.join(__dirname, 'lib', 'carouselImageClient.js'), 'utf8');
    assert(src.indexOf('var _sourceRealEnabled = false;') !== -1, '5a. source gate（_sourceRealEnabled）は削除されていない');
    assert(src.indexOf("process.env['CAROUSEL_IMAGE_REAL_ENABLED']") !== -1 || src.indexOf('process.env[CAROUSEL_IMAGE_REAL_ENABLED_ENV]') !== -1,
      '5b. env gateはprocess.env経由で参照される');
    // env単独で有効化できないこと（sourceがfalseならenv=trueでも常にfalse）を実測でも再確認
    await withGates(false, 'true', () => {
      assert(client.isRealGenerationEnabled() === false, '5c. source=false・env=trueでもenvだけでは有効化されない');
    });
  }

  caseHeader('9〜10. env値の非露出（レスポンス・ログ）（#9-9, #9-10）');
  {
    const src = fs.readFileSync(path.join(__dirname, 'lib', 'carouselImageClient.js'), 'utf8');
    assert(src.indexOf('console.') === -1, '10. lib/carouselImageClient.js はconsoleへ何も出力しない（env値を含め一切ログしない）');
    await withGates(true, 'true', async () => {
      delete process.env.OPENAI_API_KEY;
      const r = await client.generateBackground({ prompt: SAFE_PROMPT, quality: 'medium', aspectRatio: '4:5', mock: false });
      const serialized = JSON.stringify(r);
      assert(serialized.indexOf('CAROUSEL_IMAGE_REAL_ENABLED') === -1 && serialized.indexOf('true') === -1,
        '9. generateBackground()の戻り値にenv変数名・env値が含まれない: ' + serialized);
    });
  }

  caseHeader('10b. Approval / Session / Billing Lockの既存Gateは変更していない（#11）');
  {
    // billingLock単独では通らない（session/originはroute層の責務のため、ここではcore単体で確認）
    await withGates(true, 'true', () => {
      const ctx = buildCtx();
      ctx.billingLock = true;
      const res = core.assertRealCallAllowed(ctx);
      assert(res.reason === 'billing_locked', '10b-1. dual-key成立でもbillingLock!==falseならbilling_locked（既存gate維持）');
    });
    await withGates(true, 'true', () => {
      const ctx = buildCtx();
      ctx.costTrackerCanProcess = false;
      const res = core.assertRealCallAllowed(ctx);
      assert(res.reason === 'cost_limit_stopped', '10b-2. dual-key成立でもcostTracker停止ならcost_limit_stopped（既存gate維持）');
    });
  }

  caseHeader('12. Storage production wiring状態はPA-1時点から変更なし（PA-2で正式配線・本ファイルはPA-1のみ検証）');
  {
    // ※ このassertionはPA-1時点の記録用。PA-2（Production Activation Step PA-2・Decision 114実装）で
    //   lib/carouselAssetStorageSupabase.js が正式配線され、credential未設定環境では
    //   同モジュールが null を返すことで従来通りfail-closedのままとなる（詳細は
    //   carouselAssetStorageSupabase.test.js を参照）。PA-1自体はStorage配線に一切触れていない。
    delete require.cache[require.resolve('./lib/carouselImageRoutes')];
    const routes = require('./lib/carouselImageRoutes');
    const deps = routes.buildProductionDeps();
    assert(deps.storageClient === null,
      '12. credential未設定のこのテスト環境ではstorageClientはnull（PA-2配線後もfail-closedは維持）');
  }

  caseHeader('20〜21. Regression（既存禁止/許可 dependency scope の再確認）');
  {
    const src = fs.readFileSync(path.join(__dirname, 'lib', 'carouselImageClient.js'), 'utf8');
    assert(src.indexOf("require('axios')") !== -1, '既存 axios 依存は維持（新規npm依存を追加していない）');
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const deps = Object.keys(pkg.dependencies || {}).sort();
    assert(JSON.stringify(deps) === JSON.stringify(['@anthropic-ai/sdk', '@supabase/supabase-js', 'axios', 'dotenv', 'express', 'opentype.js', 'sharp']),
      '21. package.json dependencies は今回変更されていない: ' + deps.join(','));
  }

  caseHeader('22. Environment Restore（本ファイル終了後のprocess.env非汚染）');
  {
    assert(process.env.CAROUSEL_IMAGE_REAL_ENABLED === undefined, '22a. CAROUSEL_IMAGE_REAL_ENABLED が process.env に残っていない');
    assert(client.REAL_ENABLED === false, '22b. REAL_ENABLED は false のまま（テスト終了後）');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All carouselRealEnabledKillSwitch cases passed (Production Activation Step PA-1)'); }
})().catch(e => { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
