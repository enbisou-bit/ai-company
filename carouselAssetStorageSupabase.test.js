'use strict';
// carouselAssetStorageSupabase.test.js
// Production Activation Step PA-2 — lib/carouselAssetStorageSupabase.js の deterministic テスト。
//   実Supabase Storage接続 0件 / bucket作成 0件 / Storage policy変更 0件 / 実network 0件。
//
//   本モジュールはmodule-load時に環境変数を読んでsingleton clientを構築するため、
//   permutationごとに require.cache を明示的に破棄してから再requireする
//   （実行中プロセスのenvを変えても、既にrequire済みのモジュールは再評価されないため）。

const fs = require('fs');
const path = require('path');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const MODULE_PATH = require.resolve('./lib/carouselAssetStorageSupabase');
const ENV_KEYS = [
  'SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY',
];

// 指定した環境変数だけを設定した状態でモジュールを再evaluateして返す。
// 呼び出し前後で process.env を完全に元へ復元する（テスト間の汚染を防ぐ）。
function loadWithEnv(envOverrides) {
  const saved = {};
  ENV_KEYS.forEach((k) => { saved[k] = process.env[k]; delete process.env[k]; });
  Object.keys(envOverrides || {}).forEach((k) => { process.env[k] = envOverrides[k]; });
  delete require.cache[MODULE_PATH];
  let mod;
  try { mod = require('./lib/carouselAssetStorageSupabase'); }
  finally {
    ENV_KEYS.forEach((k) => {
      delete process.env[k];
      if (saved[k] !== undefined) process.env[k] = saved[k];
    });
  }
  return mod;
}

(async () => {
  caseHeader('1〜6. Credential resolution matrix（#15-1〜6）');
  {
    // 1. SUPABASE_SECRET_KEYあり → secret優先で構成される
    {
      const mod = loadWithEnv({ SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake_priority' });
      assert(mod.isPrivilegedClientConfigured() === true, '1. SUPABASE_SECRET_KEYありで構成される');
      assert(mod.carouselAssetStorageClient !== null && typeof mod.carouselAssetStorageClient.storage.from === 'function',
        '1b. client は .storage.from を持つ実clientオブジェクト');
    }
    // 2. SECRETなし + SERVICE_ROLEあり → fallbackで構成される
    {
      const mod = loadWithEnv({ SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'legacy-service-role-jwt' });
      assert(mod.isPrivilegedClientConfigured() === true, '2. SUPABASE_SERVICE_ROLE_KEY（legacy fallback）で構成される');
    }
    // 3. 両方なし → null/fail-closed
    {
      const mod = loadWithEnv({ SUPABASE_URL: 'https://fake.supabase.co' });
      assert(mod.carouselAssetStorageClient === null && mod.isPrivilegedClientConfigured() === false,
        '3. secret/service_roleいずれも無し → null（fail-closed）');
    }
    // 4. SUPABASE_URLなし → fail-closed（secretは有効でも）
    {
      const mod = loadWithEnv({ SUPABASE_SECRET_KEY: 'sb_secret_fake' });
      assert(mod.carouselAssetStorageClient === null, '4. SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URLいずれも無し → fail-closed');
    }
    // 5. NEXT_PUBLIC系だけ（anon key相当）→ fail-closed
    {
      const mod = loadWithEnv({ SUPABASE_URL: 'https://fake.supabase.co', NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-should-not-work' });
      assert(mod.carouselAssetStorageClient === null, '5. NEXT_PUBLIC_SUPABASE_ANON_KEYのみ → fail-closed（anonでは構成されない）');
    }
    // 6. anon keyだけ（SUPABASE_ANON_KEY）→ fail-closed
    {
      const mod = loadWithEnv({ SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_ANON_KEY: 'anon-should-not-work-either' });
      assert(mod.carouselAssetStorageClient === null, '6. SUPABASE_ANON_KEYのみ → fail-closed（anonでは構成されない）');
    }
    // 優先順位: 両方設定されていてもSECRET優先（PA-2 #4 candidate相当・実測は内部値を直接読めないため
    //   「secretが有効な限りservice_roleの値でエラーにならず構成される」ことのみ確認可能）
    {
      const mod = loadWithEnv({ SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_priority', SUPABASE_SERVICE_ROLE_KEY: 'legacy-ignored' });
      assert(mod.isPrivilegedClientConfigured() === true, '6b. 両方設定されていても構成される（優先順位はコード実装で保証・sourceで確認済み）');
    }
    // NEXT_PUBLIC_SUPABASE_URL フォールバック（既存 lib/supabase.js / lib/carouselExecutionSupabase.js と同一規約）
    {
      const mod = loadWithEnv({ NEXT_PUBLIC_SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_fake' });
      assert(mod.isPrivilegedClientConfigured() === true, '6c. NEXT_PUBLIC_SUPABASE_URL でも URL fallback が機能する');
    }
  }

  caseHeader('7〜8. Secret非露出（#15-7,8）');
  {
    const src = fs.readFileSync(path.join(__dirname, 'lib', 'carouselAssetStorageSupabase.js'), 'utf8');
    // ※ コメント内での説明的言及（「console.*を使わない」という記述そのもの）は許容し、
    //   実コード呼び出し（console.log(/console.warn(等）のみを禁止対象として検査する
    //   （carouselExecutionDb.test.js 14h/14i と同じ検査方針）。
    assert(/console\.(log|warn|error|info|debug)\s*\(/.test(src) === false,
      '8. console.log/warn/error/info/debug の実呼び出しが無い（secret/URLをログしない）');

    const mod = loadWithEnv({ SUPABASE_URL: 'https://fake.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_should_not_leak_12345' });
    const exported = Object.keys(mod).sort();
    assert(JSON.stringify(exported) === JSON.stringify(['carouselAssetStorageClient', 'isPrivilegedClientConfigured']),
      '7a. exportは client と availability helper のみ: ' + exported.join(','));
    const serializedClient = (() => { try { return JSON.stringify(mod.carouselAssetStorageClient); } catch (e) { return 'unserializable:' + e.message; } })();
    assert(String(serializedClient).indexOf('sb_secret_should_not_leak_12345') === -1,
      '7b. client オブジェクトをJSON化してもsecret文字列が直接含まれない: ' + String(serializedClient).slice(0, 60));

    // ※ 明らかに不正な形式のURL（"not a valid url"のような非URL文字列）を渡した場合、
    //   @supabase/supabase-js の createClient() 自体が例外を投げる。これは
    //   lib/carouselExecutionSupabase.js（Decision 110・変更禁止）にも同一のガード無し
    //   createClient() 呼び出しが存在し、本ファイルはその既存contractをそのまま踏襲した
    //   ものであるため、新たな例外安全性をここで追加しない（既存パターンからの逸脱を避ける）。
    //   実運用でのSUPABASE_URLはRender側で既に稼働中の他clientと同一値を使うため、
    //   このシナリオは運用上想定されない。
  }

  caseHeader('9. createClient configがserver-only（#15-9）');
  {
    const src = fs.readFileSync(path.join(__dirname, 'lib', 'carouselAssetStorageSupabase.js'), 'utf8');
    assert(src.indexOf('persistSession: false') !== -1, '9a. persistSession:false（server-only設定）');
    assert(src.indexOf('autoRefreshToken: false') !== -1, '9b. autoRefreshToken:false');
    assert(src.indexOf('detectSessionInUrl: false') !== -1, '9c. detectSessionInUrl:false');
  }

  caseHeader('10〜11. buildProductionDeps wiring（#15-10,11）');
  {
    delete require.cache[require.resolve('./lib/carouselImageRoutes')];
    delete require.cache[MODULE_PATH];
    const routes = require('./lib/carouselImageRoutes');
    const deps = routes.buildProductionDeps();
    assert('storageClient' in deps, '10. buildProductionDeps() が storageClient フィールドを返す');
    // credential未設定のこのテスト環境ではnullであることを確認（fail-closed実測）
    assert(deps.storageClient === null, '11. credential不足時、buildProductionDeps().storageClient は null（fail-closed）');

    const routesSrc = fs.readFileSync(path.join(__dirname, 'lib', 'carouselImageRoutes.js'), 'utf8');
    assert(routesSrc.indexOf("require('./carouselAssetStorageSupabase')") !== -1,
      '10b. lib/carouselImageRoutes.js が新モジュールを配線している');
    assert(routesSrc.indexOf("require('./carouselExecutionSupabase')") === -1,
      '14a. lib/carouselImageRoutes.js はDecision 110のledger専用clientを直接requireしない（横展開していない）');
  }

  caseHeader('12〜13. fake storage clientでのupload/signed URL成功（#15-12,13・既存C-2/C-3契約の非破壊確認）');
  {
    const assetStorage = require('./lib/carouselAssetStorage');
    const assetAccess = require('./lib/carouselAssetAccess');
    const objects = new Map();
    const fakeClient = {
      storage: {
        from(bucket) {
          return {
            upload: async (p, buffer) => {
              const key = bucket + '::' + p;
              if (objects.has(key)) return { data: null, error: { statusCode: '409' } };
              objects.set(key, buffer);
              return { data: { id: 'x', path: p, fullPath: bucket + '/' + p }, error: null };
            },
            createSignedUrl: async (p, ttl) => {
              const key = bucket + '::' + p;
              if (!objects.has(key)) return { data: null, error: { statusCode: '404' } };
              return { data: { signedUrl: 'https://fake.local/signed/' + encodeURIComponent(p) }, error: null };
            },
          };
        },
      },
    };
    const png = Buffer.concat([assetStorage.PNG_MAGIC, Buffer.alloc(32, 1)]);
    const up = await assetStorage.uploadCarouselAsset({
      caseId: 'case-value-1788410623', outputId: 'out_1788413020275', nonce: 'pa2testnonce0001', slideIndex: 1, buffer: png,
    }, { client: fakeClient });
    assert(up.ok === true, '12. fake client注入で uploadCarouselAsset が成功する（新clientモジュールは既存契約に影響しない）');

    const signed = await assetAccess.createSignedUrl(up.asset.storagePath, 300, { client: fakeClient });
    assert(signed.ok === true && typeof signed.url === 'string', '13. fake client注入で createSignedUrl が成功する（既存契約に影響しない）');
  }

  caseHeader('14〜15. Ledger client非流用 / bucket自動作成なし（#15-14,15,16・Decision 114整合）');
  {
    const src = fs.readFileSync(path.join(__dirname, 'lib', 'carouselAssetStorageSupabase.js'), 'utf8');
    assert(src.indexOf("require('./carouselExecutionSupabase')") === -1,
      '14b. 新モジュール自体もDecision 110のledger clientをrequireしない（完全分離）');
    assert(src.indexOf('createBucket') === -1 && src.indexOf('.storage.createBucket') === -1,
      '15. bucket自動作成コードを持たない');
    assert(src.indexOf('CREATE POLICY') === -1 && src.indexOf('updateBucket') === -1,
      '15b. Storage policy/bucket設定変更コードを持たない');
  }

  caseHeader('16. 実network call 0（本テストスイート内で）');
  {
    // lib/carouselAssetStorageSupabase.js 自体が axios/http/https を一切requireしないこと
    //   （@supabase/supabase-js 経由の内部実装を除き、本ファイルが独自に通信手段を
    //   持ち込んでいないことの確認）。
    const moduleSrc = fs.readFileSync(path.join(__dirname, 'lib', 'carouselAssetStorageSupabase.js'), 'utf8');
    const requireLines = moduleSrc.match(/require\(['"][^'"]+['"]\)/g) || [];
    assert(JSON.stringify(requireLines) === JSON.stringify(["require('@supabase/supabase-js')"]),
      '16. lib/carouselAssetStorageSupabase.js は @supabase/supabase-js 以外を require しない: ' + requireLines.join(','));
  }

  caseHeader('Cleanup確認: require.cache操作後もprocess.envが汚染されていない');
  {
    ENV_KEYS.forEach((k) => {
      assert(process.env[k] === undefined || k === 'SUPABASE_URL' || k === 'NEXT_PUBLIC_SUPABASE_URL',
        'cleanup. ' + k + ' はテスト前の状態へ復元されている（許容: 元々.env.localにURLが存在する場合）');
    });
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All carouselAssetStorageSupabase cases passed (Production Activation Step PA-2)'); }
})().catch(e => { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
