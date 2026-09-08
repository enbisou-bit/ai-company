'use strict';
// carouselAssetStorage.test.js
// Phase 2-E Production Connection Step C-2 — lib/carouselAssetStorage.js の deterministic テスト。
//   実Supabase Storage接続 0件 / bucket作成 0件 / network I/O 0件 / DB write 0件 /
//   Output Draft write 0件。fake Storage client（opts.client）を注入し、
//   validate/path/upload/batch の各分岐を検証する。

const fs = require('fs');
const path = require('path');

const storage = require('./lib/carouselAssetStorage');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

// ── fake Supabase Storage client（in-memory・実 storage-js の upload() 応答shapeを再現） ──
//   成功: { data: { id, path, fullPath }, error: null }
//   409衝突（upsert:false違反）: { data: null, error: { name, status, statusCode:'409', message } }
//   forceError / forceThrow でその他のエラー経路も再現する。
function makeFakeStorageClient(opts) {
  opts = opts || {};
  const objects = new Map(); // "<bucket>::<path>" -> { buffer, options }
  return {
    _objects: objects,
    storage: {
      from: function (bucket) {
        return {
          upload: async function (uploadPath, buffer, options) {
            if (opts.forceThrow) throw new Error('simulated network failure');
            if (opts.forceError) return { data: null, error: opts.forceError };
            const key = bucket + '::' + uploadPath;
            if (objects.has(key)) {
              return {
                data: null,
                error: { name: 'StorageApiError', status: 409, statusCode: '409', message: 'The resource already exists' },
              };
            }
            objects.set(key, { buffer: buffer, options: options, bucket: bucket, path: uploadPath });
            return { data: { id: 'fake-' + objects.size, path: uploadPath, fullPath: bucket + '/' + uploadPath }, error: null };
          },
        };
      },
    },
  };
}

function makePngBuffer(extraBytes) {
  return Buffer.concat([storage.PNG_MAGIC, Buffer.alloc(extraBytes === undefined ? 64 : extraBytes, 0x01)]);
}

function baseAssetInput(overrides) {
  return Object.assign({
    caseId: 'case-value-1788410623',
    outputId: 'out_1788413020275',
    nonce: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4',
    slideIndex: 1,
    buffer: makePngBuffer(),
  }, overrides || {});
}

(async () => {
  caseHeader('1. uploadCarouselAsset: valid PNG upload → ok=true / asset全フィールド');
  {
    const client = makeFakeStorageClient();
    const res = await storage.uploadCarouselAsset(baseAssetInput({ slideId: 'icb-1' }), { client: client });
    assert(res.ok === true, '1a. アップロード成功');
    assert(res.asset.slideIndex === 1, '1b. slideIndexが反映される');
    assert(res.asset.slideId === 'icb-1', '1c. slideIdがechoされる（Storageへは送られない・後述29で確認）');
    assert(res.asset.format === 'png', '1d. format=png固定');
    assert(res.asset.status === 'ready', '1e. status=ready固定');
    assert(typeof res.asset.storagePath === 'string' && res.asset.storagePath.length > 0, '1f. storagePathが返る');
  }

  caseHeader('2. correct bucket（CAROUSEL_ASSET_BUCKET固定）');
  {
    const client = makeFakeStorageClient();
    await storage.uploadCarouselAsset(baseAssetInput(), { client: client });
    const keys = Array.from(client._objects.keys());
    assert(keys.length === 1 && keys[0].indexOf(storage.CAROUSEL_ASSET_BUCKET + '::') === 0,
      '2. 固定bucket（' + storage.CAROUSEL_ASSET_BUCKET + '）へアップロードされる');
  }

  caseHeader('3〜5. deterministic path（nonce/slideIndex含む）');
  {
    const client = makeFakeStorageClient();
    const input = baseAssetInput({ caseId: 'case-A', outputId: 'out-B', nonce: 'nonce-C', slideIndex: 3 });
    const res = await storage.uploadCarouselAsset(input, { client: client });
    assert(res.ok === true, '3. アップロード成功');
    assert(res.asset.storagePath === 'carousel/case-A/out-B/nonce-C/slide-3.png',
      '3. path構造が carousel/<caseId>/<outputId>/<nonce>/slide-<N>.png と一致: ' + res.asset.storagePath);
    assert(res.asset.storagePath.indexOf('/nonce-C/') !== -1, '4. pathにnonceが含まれる');
    assert(res.asset.storagePath.indexOf('slide-3.png') !== -1, '5. pathにslideIndexが含まれる');
  }

  caseHeader('6〜7. contentType固定 / upsert:false固定（client入力を信用しない）');
  {
    const client = makeFakeStorageClient();
    await storage.uploadCarouselAsset(baseAssetInput({ contentType: 'text/plain', upsert: true }), { client: client });
    const obj = Array.from(client._objects.values())[0];
    assert(obj.options.contentType === 'image/png', '6. contentTypeは常にimage/png（inputのcontentTypeは無視される）');
    assert(obj.options.upsert === false, '7. upsertは常にfalse');
  }

  caseHeader('8〜10. sha256 / bytes / format');
  {
    const client = makeFakeStorageClient();
    const buf = makePngBuffer(200);
    const expectedSha256 = require('crypto').createHash('sha256').update(buf).digest('hex');
    const res = await storage.uploadCarouselAsset(baseAssetInput({ buffer: buf }), { client: client });
    assert(res.asset.sha256 === expectedSha256, '8. sha256が保存前Bufferと一致');
    assert(res.asset.bytes === buf.length, '9. bytes = Buffer.length');
    assert(res.asset.format === 'png', '10. format=png');
  }

  caseHeader('11. 1080x1350 / 4:5 metadata（decodeせず固定契約値を返す）');
  {
    const client = makeFakeStorageClient();
    const res = await storage.uploadCarouselAsset(baseAssetInput(), { client: client });
    assert(res.asset.width === 1080 && res.asset.height === 1350 && res.asset.aspectRatio === '4:5',
      '11. width/height/aspectRatioが固定契約値（1080x1350/4:5）');
  }

  caseHeader('12〜14. Buffer / PNG signature 検証');
  {
    const client = makeFakeStorageClient();
    const empty = await storage.uploadCarouselAsset(baseAssetInput({ buffer: Buffer.alloc(0) }), { client: client });
    assert(empty.ok === false && empty.reason === 'invalid_asset_input' && empty.field === 'buffer',
      '12. 空Bufferはinvalid_asset_input');
    const notBuffer = await storage.uploadCarouselAsset(baseAssetInput({ buffer: 'not-a-buffer' }), { client: client });
    assert(notBuffer.ok === false && notBuffer.reason === 'invalid_asset_input' && notBuffer.field === 'buffer',
      '13. 非Bufferはinvalid_asset_input');
    const badMagic = await storage.uploadCarouselAsset(baseAssetInput({ buffer: Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]) }), { client: client });
    assert(badMagic.ok === false && badMagic.reason === 'invalid_png',
      '14. 不正なPNG signatureはinvalid_png');
    assert(client._objects.size === 0, '12〜14d. いずれもStorageへ到達していない（objects作成0）');
  }

  caseHeader('15〜18. caseId/outputId/nonce の path-safety 検証（path traversal含む）');
  {
    const client = makeFakeStorageClient();
    const badCase = await storage.uploadCarouselAsset(baseAssetInput({ caseId: '../etc/passwd' }), { client: client });
    assert(badCase.ok === false && badCase.reason === 'invalid_storage_path' && badCase.field === 'caseId',
      '15. caseIdに ".." "/" を含むと invalid_storage_path');
    const badOutput = await storage.uploadCarouselAsset(baseAssetInput({ outputId: 'out/../../secret' }), { client: client });
    assert(badOutput.ok === false && badOutput.reason === 'invalid_storage_path' && badOutput.field === 'outputId',
      '16. outputIdのpath traversalはinvalid_storage_path');
    const badNonce = await storage.uploadCarouselAsset(baseAssetInput({ nonce: 'a\\b' }), { client: client });
    assert(badNonce.ok === false && badNonce.reason === 'invalid_storage_path' && badNonce.field === 'nonce',
      '17. nonceにバックスラッシュを含むとinvalid_storage_path');
    const emptyCase = await storage.uploadCarouselAsset(baseAssetInput({ caseId: '' }), { client: client });
    assert(emptyCase.ok === false && emptyCase.reason === 'invalid_storage_path' && emptyCase.field === 'caseId',
      '18a. caseId空文字はinvalid_storage_path');
    const ctrlChar = await storage.uploadCarouselAsset(baseAssetInput({ outputId: 'out\x00id' }), { client: client });
    assert(ctrlChar.ok === false && ctrlChar.reason === 'invalid_storage_path' && ctrlChar.field === 'outputId',
      '18b. 制御文字を含むoutputIdはinvalid_storage_path');
    assert(client._objects.size === 0, '15〜18c. いずれもStorageへ到達していない');
  }

  caseHeader('19. slideIndex 検証');
  {
    const client = makeFakeStorageClient();
    const zero = await storage.uploadCarouselAsset(baseAssetInput({ slideIndex: 0 }), { client: client });
    assert(zero.ok === false && zero.reason === 'invalid_storage_path' && zero.field === 'slideIndex',
      '19a. slideIndex=0はinvalid_storage_path');
    const tooLarge = await storage.uploadCarouselAsset(baseAssetInput({ slideIndex: 20 }), { client: client });
    assert(tooLarge.ok === false && tooLarge.reason === 'invalid_storage_path' && tooLarge.field === 'slideIndex',
      '19b. slideIndex=20（上限19超過）はinvalid_storage_path');
    const nonInt = await storage.uploadCarouselAsset(baseAssetInput({ slideIndex: 'abc' }), { client: client });
    assert(nonInt.ok === false && nonInt.reason === 'invalid_storage_path' && nonInt.field === 'slideIndex',
      '19c. 非数値slideIndexはinvalid_storage_path');
    const missing = await storage.uploadCarouselAsset(baseAssetInput({ slideIndex: undefined }), { client: client });
    assert(missing.ok === false && missing.reason === 'invalid_storage_path' && missing.field === 'slideIndex',
      '19d. slideIndex欠落はinvalid_storage_path');
  }

  caseHeader('20〜21. upload provider failure の sanitize（raw errorを漏らさない）');
  {
    const client = makeFakeStorageClient({
      forceError: { name: 'StorageApiError', status: 500, statusCode: '500', message: 'internal secret backend detail xyz' },
    });
    const res = await storage.uploadCarouselAsset(baseAssetInput(), { client: client });
    assert(res.ok === false && res.reason === 'storage_upload_failed',
      '20. 409以外のprovider errorはstorage_upload_failed');
    const serialized = JSON.stringify(res);
    assert(serialized.indexOf('secret backend detail') === -1,
      '21. raw provider errorのmessageが戻り値へ含まれない（sanitize済み）');
    assert(Object.keys(res).sort().join(',') === 'ok,reason', '21b. 戻り値はok/reasonのみ（余分なフィールドなし）');
  }

  caseHeader('20b. storage_unavailable（client未設定 / 例外throw）');
  {
    const noClient = await storage.uploadCarouselAsset(baseAssetInput(), { client: null });
    assert(noClient.ok === false && noClient.reason === 'storage_unavailable',
      '20b-1. client未設定はstorage_unavailable（fail-closed）');
    const throwClient = makeFakeStorageClient({ forceThrow: true });
    const threw = await storage.uploadCarouselAsset(baseAssetInput(), { client: throwClient });
    assert(threw.ok === false && threw.reason === 'storage_unavailable',
      '20b-2. upload()が例外を投げてもstorage_unavailable（クラッシュしない）');
  }

  caseHeader('22. duplicate/collision → storage_collision（upsert:false違反・fail-closed）');
  {
    const client = makeFakeStorageClient();
    const input = baseAssetInput();
    const first = await storage.uploadCarouselAsset(input, { client: client });
    assert(first.ok === true, '22a. 1回目のアップロードは成功');
    const second = await storage.uploadCarouselAsset(input, { client: client });
    assert(second.ok === false && second.reason === 'storage_collision',
      '22b. 同一pathへの2回目アップロードはstorage_collision');
  }

  caseHeader('23. public URL を生成しない');
  {
    const client = makeFakeStorageClient();
    const res = await storage.uploadCarouselAsset(baseAssetInput(), { client: client });
    const keys = Object.keys(res.asset);
    assert(keys.indexOf('publicUrl') === -1 && keys.indexOf('url') === -1 && keys.indexOf('signedUrl') === -1,
      '23. asset結果にpublicUrl/url/signedUrlが含まれない');
  }

  caseHeader('24. no secret exposure（source上でsecret/anon keyを実コード参照していない）');
  {
    // ※ コメント内での「参照しない」という説明的言及（環境変数名への言及）は許容し、
    //   実コード参照（process.env.<name>）のみを禁止対象として検査する
    //   （carouselExecutionDb.test.js の14h/14iと同じ検査方針）。
    const src = fs.readFileSync(path.join(__dirname, 'lib', 'carouselAssetStorage.js'), 'utf8');
    assert(src.indexOf('process.env.SUPABASE_SECRET_KEY') === -1
      && src.indexOf('process.env.SUPABASE_SERVICE_ROLE_KEY') === -1,
      '24a. privileged credential環境変数を実コードで参照しない（client injection専用）');
    assert(src.indexOf('process.env.SUPABASE_ANON_KEY') === -1
      && src.indexOf('process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY') === -1,
      '24b. anon key環境変数も実コードで参照しない');
    assert(src.indexOf("require('@supabase") === -1 && src.indexOf('require("@supabase') === -1,
      '24c. @supabase/* パッケージを直接requireしない（client injectionのみ）');
  }

  caseHeader('25〜26. batch upload（全件成功 / 部分失敗）');
  {
    const client = makeFakeStorageClient();
    const items = [1, 2, 3].map(function (i) { return baseAssetInput({ slideIndex: i }); });
    const res = await storage.uploadCarouselAssets(items, { client: client });
    assert(res.ok === true && Array.isArray(res.assets) && res.assets.length === 3,
      '25. 3枚すべて成功するとok=true・assets配列が3件');
    assert(res.assets.every(function (a) { return a.format === 'png'; }), '25b. 各assetがformat=pngを持つ');
  }
  {
    const client = makeFakeStorageClient();
    const items = [
      baseAssetInput({ slideIndex: 1 }),
      baseAssetInput({ slideIndex: 0 }),      // 不正・invalid_storage_path
      baseAssetInput({ slideIndex: 3 }),
    ];
    const res = await storage.uploadCarouselAssets(items, { client: client });
    assert(res.ok === false, '26a. 1件でも失敗するとbatch全体がok=false');
    assert(Array.isArray(res.results) && res.results.length === 3, '26b. 全件分の結果が収集される（全件収集後に判定）');
    assert(res.results[0].ok === true && res.results[1].ok === false && res.results[2].ok === true,
      '26c. 個別結果が成功/失敗ごとに正しく分離されている');
  }

  caseHeader('27. no automatic delete rollback（部分失敗後も成功済みslideは残存）');
  {
    const client = makeFakeStorageClient();
    const items = [
      baseAssetInput({ slideIndex: 1 }),
      baseAssetInput({ slideIndex: 0 }),      // 不正
    ];
    await storage.uploadCarouselAssets(items, { client: client });
    assert(client._objects.size === 1, '27a. slide 1の成功済みアップロードは削除されず残る（自動rollbackなし）');
    assert(typeof storage.deleteCarouselAsset === 'undefined' && typeof storage.deleteCarouselAssets === 'undefined',
      '27b. delete系APIはそもそも実装されていない');
  }

  caseHeader('28〜29. Output Draft / DB非接触（export surfaceとsource参照の確認）');
  {
    const exported = Object.keys(storage).sort();
    assert(JSON.stringify(exported) === JSON.stringify(
      ['CAROUSEL_ASSET_BUCKET', 'MAX_ASSET_BYTES', 'PNG_MAGIC', 'TARGET',
        'buildAssetPath', 'computeSha256', 'uploadCarouselAsset', 'uploadCarouselAssets', 'validatePngBuffer'].sort()
    ), '28. exportはStorage関連のみ（Output Draft update等の想定外APIなし）: ' + exported.join(','));

    const src = fs.readFileSync(path.join(__dirname, 'lib', 'carouselAssetStorage.js'), 'utf8');
    assert(src.indexOf("require('./carouselExecutionDb')") === -1
      && src.indexOf("require('./carouselExecutionSupabase')") === -1
      && src.indexOf("require('./supabase')") === -1,
      '29. carousel_image_executions（DB ledger）／anon client を一切requireしない（Storage専責）');
  }

  caseHeader('30〜32. deterministic path（同一入力・nonce違い・outputId違い）');
  {
    const input = baseAssetInput({ caseId: 'case-X', outputId: 'out-X', nonce: 'nonce-X', slideIndex: 2 });
    const p1 = storage.buildAssetPath(input);
    const p2 = storage.buildAssetPath(input);
    assert(p1.ok === true && p2.ok === true && p1.path === p2.path,
      '30. 同一scope入力からは常に同一pathが導出される（deterministic）');

    const pDiffNonce = storage.buildAssetPath(Object.assign({}, input, { nonce: 'nonce-Y' }));
    assert(pDiffNonce.ok === true && pDiffNonce.path !== p1.path,
      '31. nonceが異なれば別pathになる');

    const pDiffOutput = storage.buildAssetPath(Object.assign({}, input, { outputId: 'out-Y' }));
    assert(pDiffOutput.ok === true && pDiffOutput.path !== p1.path,
      '32. outputIdが異なれば別pathになる');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All carouselAssetStorage cases passed (Phase 2-E Production Connection Step C-2)'); }
})().catch(e => { console.error('TEST CRASH:', e); process.exitCode = 1; });
