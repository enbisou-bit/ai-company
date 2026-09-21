'use strict';
// imageReviewPanel.test.js
// Stage 1b: 7枚プレビュー ＋ Image Review（OK/NG）の deterministic テスト。
//
//   実HTTP 0 / 実AI API 0 / 実Image API 0 / 実DB 0 / 実Storage 0 / 実課金 0。
//   index.html の Image Review ブロックを vm サンドボックスへ取り出し、fake fetch / fake DOM で検証する。
//
//   重点: ① whole-fields data loss を起こさないこと（最新 Draft を基準に imageReviewOk だけ変更）
//         ② stale asset へ古いレビューを適用しないこと（1つでも不一致なら write 0）
//         ③ 署名URLを保存・log・innerHTML へ出さないこと

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const CASE_ID = 'case-value-1788410623';
const OUTPUT_ID = 'out_1789809676034';
const NONCE = 'n'.repeat(32);
const SRC = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const IR_BLOCK = SRC.slice(SRC.indexOf('var IMAGE_REVIEW_VERSION'), SRC.indexOf('// Phase50-7: Publishing Ready Center HTML生成'));
const ESC_BLOCK = SRC.slice(SRC.indexOf('function escapeHtml(s) {'), SRC.indexOf('function runSearch(query) {'));

function mkAsset(i, over) {
  return Object.assign({
    slideIndex: i, slideId: 'icb-' + i, width: 1080, height: 1350, aspectRatio: '4:5',
    format: 'png', storagePath: 'carousel/' + CASE_ID + '/' + OUTPUT_ID + '/' + NONCE + '/slide-' + i + '.png',
    sha256: String(i).repeat(64).slice(0, 64), bytes: 900000 + i,
    status: 'ready', imageReviewOk: false, generatedAt: '2026-09-21T08:00:00.000Z', regenCount: 0,
  }, over || {});
}
// 生成済み Draft の fields（Image Review が絶対に壊してはいけない項目を全部入れる）
function mkFields(over) {
  return Object.assign({
    slides: [1, 2, 3, 4, 5, 6, 7].map(function (n) { return '【' + n + '枚目】タイトル：t' + n + ' / 本文：b' + n + ' / ビジュアル：v'; }),
    caption: 'キャプション本文', cta: 'あとで見返せるように保存してください',
    hashtags: ['#スキンケア', '#保湿'], targetAudience: 'スキンケアの基本を見直したい人',
    benefit: '保存して、あとで見返せる投稿です',
    imagePrompts: [1, 2, 3, 4, 5, 6, 7].map(function (n) { return 'prompt ' + n; }),
    saveSharePrompt: '保存してあとで見返してください',
    carouselAssets: [1, 2, 3, 4, 5, 6, 7].map(function (i) { return mkAsset(i); }),
    carouselAspectRatio: '4:5',
    carouselGeneration: { nonce: NONCE, model: 'gpt-image-2', quality: 'low', generatedAt: '2026-09-21T08:00:00.000Z' },
  }, over || {});
}
function mkRow(fields, over) {
  return Object.assign({
    output_id: OUTPUT_ID, case_id: CASE_ID, type: 'instagram_carousel', status: 'ready',
    built_at: '2026-09-19T09:22:09.014+00:00', updated_at: '2026-09-21T08:00:01.000+00:00',
    review_state: { approved: true, statusBySlide: { 'slide-1': 'ok' } },
    content_evidence: null, content_claims: null, content_evidence_origin: null,
    fields: fields,
  }, over || {});
}

// fake DOM（img[data-ir-slide] のみ扱う）
function mkDom(slideIndexes) {
  const nodes = slideIndexes.map(function (n) {
    return { _attrs: { 'data-ir-slide': String(n) }, src: null, getAttribute: function (k) { return this._attrs[k]; } };
  });
  return { querySelectorAll: function () { return nodes; }, _nodes: nodes };
}

// サンドボックス生成
function mkUi(o) {
  o = o || {};
  const state = {
    serverFields: o.serverFields || mkFields(),       // server 上の最新 fields
    posts: [],                                        // POST /api/output-drafts の body
    calls: [],
    logs: [],
    localStorageWrites: [],
    mutateOnNthDraftRead: o.mutateOnNthDraftRead || 0,
    draftReads: 0,
  };
  const clientDraft = { id: OUTPUT_ID, type: 'instagram_carousel', fields: o.clientFields || JSON.parse(JSON.stringify(state.serverFields)) };
  const ctx = {
    Object: Object, Array: Array, String: String, Number: Number, Math: Math, JSON: JSON, isFinite: isFinite,
    encodeURIComponent: encodeURIComponent,
    console: { log: function () { state.logs.push(Array.prototype.join.call(arguments, ' ')); },
               warn: function () { state.logs.push(Array.prototype.join.call(arguments, ' ')); } },
    localStorage: { setItem: function (k, v) { state.localStorageWrites.push(k + '=' + v); }, getItem: function () { return null; } },
    document: o.dom || mkDom([1, 2, 3, 4, 5, 6, 7]),
    OUTPUT_TYPES: { INSTAGRAM_CAROUSEL: 'instagram_carousel' },
    normalizeOutputType: function (t) { return t; },
    getCurrentApprovalCaseId: function () { return o.caseId === undefined ? CASE_ID : o.caseId; },
    getCurrentApprovalOutputId: function () { return o.outputId === undefined ? OUTPUT_ID : o.outputId; },
    renderOutputEnginePanel: function () {},
    _lastOutputDraft: clientDraft,
    fetch: async function (url, init) {
      const method = (init && init.method) || 'GET';
      state.calls.push(method + ' ' + String(url).split('?')[0]);
      if (o.networkError) throw new Error('Failed to fetch');
      const u = String(url);
      if (method === 'POST' && u.indexOf('/api/output-drafts') === 0) {
        state.posts.push(JSON.parse(init.body));
        if (o.postFails) return { status: 500, ok: false, json: async function () { return { ok: false, error: 'boom' }; } };
        state.serverFields = JSON.parse(init.body).fields;   // 保存を反映
        return { status: 200, ok: true, json: async function () { return { ok: true, error: null }; } };
      }
      if (u.indexOf('/api/output-drafts') === 0) {
        state.draftReads++;
        if (o.draftUnauthorized) return { status: 401, ok: false, json: async function () { return { ok: false }; } };
        if (o.draftReadFails) return { status: 500, ok: false, json: async function () { return { ok: false }; } };
        let f = state.serverFields;
        if (state.mutateOnNthDraftRead && state.draftReads >= state.mutateOnNthDraftRead && o.mutatedFields) f = o.mutatedFields;
        return { status: 200, ok: true, json: async function () { return { ok: true, draft: mkRow(f, o.rowOver) }; } };
      }
      if (u.indexOf('/api/carousel-image/assets') === 0) {
        if (o.assetsUnauthorized) return { status: 401, ok: false, json: async function () { return { ok: false }; } };
        if (o.assetsFail) return { status: 404, ok: false, json: async function () { return { ok: false, reason: o.assetsFail }; } };
        return {
          status: 200, ok: true,
          json: async function () {
            return { ok: true, assets: (o.assetUrls || [1, 2, 3, 4, 5, 6, 7]).map(function (i) {
              return { slideIndex: i, slideId: 'icb-' + i, width: 1080, height: 1350, aspectRatio: '4:5',
                sha256: 'x', bytes: 1, url: 'https://signed.example/carousel/' + i + '?token=SECRET' + i, expiresIn: 300 };
            }) };
          },
        };
      }
      return { status: 404, ok: false, json: async function () { return {}; } };
    },
  };
  vm.createContext(ctx);
  vm.runInContext(ESC_BLOCK + '\n' + IR_BLOCK, ctx);
  ctx.__state = state;
  return ctx;
}

(async () => {
  console.log('\n=== imageReviewPanel.test.js (Stage 1b) ===');

  // ══════════════════════════════════════════════════════════════
  caseHeader('1〜2, 5〜6. プレビュー表示 / 拡大 / 前後移動');
  {
    const ui = mkUi();
    const before = ui.buildImageReviewHtml();
    assert(before.indexOf('7枚の画像があります') !== -1 && before.indexOf('プレビューを表示') !== -1, '1a. 初期表示（未取得）');
    await ui.irLoadPreview();
    const html = ui.buildImageReviewHtml();
    assert((html.match(/data-ir-slide=/g) || []).length === 7, '1b. サムネイル 7 枚');
    assert([1, 2, 3, 4, 5, 6, 7].every(function (n) { return html.indexOf('Slide ' + n) !== -1; }), '1c. slide 番号 1〜7 を表示');
    assert(html.indexOf('1080×1350') !== -1 && html.indexOf('png') !== -1, '1d. 基本情報（1080×1350 / png）を表示');
    assert(html.indexOf('画像レビュー未完了') !== -1 && html.indexOf('0 / 7') !== -1, '1e. レビュー進捗を表示');
    assert(html.indexOf('画像URLを更新') !== -1, '1f. URL 更新ボタン（GETのみ）');
    assert(ui.__state.calls.filter(function (c) { return c.indexOf('POST') === 0; }).length === 0, '1g. 表示までに POST 0');

    const noAssets = mkUi({ serverFields: mkFields({ carouselAssets: [] }), clientFields: mkFields({ carouselAssets: [] }) });
    const naHtml = noAssets.buildImageReviewHtml();
    assert(naHtml.indexOf('画像生成後に利用できます') !== -1 && naHtml.indexOf('data-ir-slide') === -1, '2. assets なし → プレビュー非表示');

    ui.irZoom(3);
    const z = ui.buildImageReviewHtml();
    assert(z.indexOf('Slide 3') !== -1 && (z.match(/data-ir-slide=/g) || []).length === 1, '5a. 拡大表示は 1 枚のみ');
    assert(z.indexOf('irZoomStep(-1)') !== -1 && z.indexOf('irZoomStep(1)') !== -1 && z.indexOf('irZoomClose()') !== -1, '5b. 前へ / 次へ / 閉じる');
    ui.irZoomStep(1);
    assert(ui._irState.zoom === 4, '6a. 次へ → slide 4');
    ui.irZoomStep(-1);
    assert(ui._irState.zoom === 3, '6b. 前へ → slide 3');
    ui._irState.zoom = 7; ui.irZoomStep(1);
    assert(ui._irState.zoom === 7, '6c. 末尾で次へ → 範囲外へ動かない');
    ui._irState.zoom = 1; ui.irZoomStep(-1);
    assert(ui._irState.zoom === 1, '6d. 先頭で前へ → 範囲外へ動かない');
    ui.irZoomClose();
    assert(ui._irState.zoom === null, '6e. 閉じる');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('3〜4, 25〜26. 署名URLの取り扱い');
  {
    const ui = mkUi();
    await ui.irLoadPreview();
    const html = ui.buildImageReviewHtml();
    assert(html.indexOf('signed.example') === -1 && html.indexOf('SECRET') === -1, '3a. ★ 署名URLを innerHTML へ入れない');
    assert(html.indexOf('src=') === -1 || !/src="https/.test(html), '3b. img の src 属性へ URL を書かない');
    assert(ui.__state.posts.length === 0, '3c. ★ 署名URLを DB（Draft fields）へ保存しない（POST 0）');
    assert(JSON.stringify(ui._lastOutputDraft.fields).indexOf('signed.example') === -1, '3d. client の fields にも URL が入らない');
    assert(ui.__state.localStorageWrites.length === 0, '26. ★ localStorage へ書かない');
    assert(ui.__state.logs.join(' ').indexOf('signed.example') === -1, '25. ★ 署名URLを log へ出さない');

    // DOM property への代入（innerHTML ではない）
    ui._irApplyImageSrc();
    const nodes = ui.document._nodes;
    assert(nodes.length === 7 && nodes.every(function (n) { return typeof n.src === 'string' && n.src.indexOf('https://signed.example/') === 0; }),
      '3e. ★ img.src（DOM property）へ代入される');

    // https 以外は代入しない
    const evil = mkUi();
    await evil.irLoadPreview();
    evil._irState.urls = { '1': 'javascript:alert(1)', '2': 'http://x/y' };
    evil.document._nodes.forEach(function (n) { n.src = null; });
    evil._irApplyImageSrc();
    assert(evil.document._nodes.every(function (n) { return n.src === null; }), '3f. ★ https 以外の URL は img.src へ代入しない');

    // URL 更新は GET のみ
    const before = ui.__state.calls.length;
    await ui.irLoadPreview();
    const added = ui.__state.calls.slice(before);
    assert(added.length > 0 && added.every(function (c) { return c.indexOf('GET ') === 0; }), '4a. ★「画像URLを更新」は GET のみ');
    assert(added.every(function (c) { return c.indexOf('carousel-image/produce') === -1 && c.indexOf('carousel-image/generate') === -1 && c.indexOf('carousel-image/approval') === -1; }),
      '4b. ★ 画像再生成（produce / generate / approval）を呼ばない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('7〜11. OK / NG / すべてOK と進捗表示');
  {
    const ui = mkUi();
    await ui.irLoadPreview();
    await ui.irSetOk(3);
    assert(ui.__state.posts.length === 1, '7a. OK 1枚 → POST 1 回');
    const p1 = ui.__state.posts[0];
    assert(Object.keys(p1).sort().join(',') === 'caseId,fields,outputId', '7b. ★ 送信キーは outputId / caseId / fields のみ');
    assert(p1.fields.carouselAssets.filter(function (a) { return a.imageReviewOk === true; }).length === 1
      && p1.fields.carouselAssets.filter(function (a) { return a.slideIndex === 3; })[0].imageReviewOk === true, '7c. slide 3 のみ OK');
    assert(p1.fields.carouselAssets.filter(function (a) { return a.slideIndex !== 3; }).every(function (a) { return a.imageReviewOk === false; }),
      '7d. 他の slide の imageReviewOk は不変');

    await ui.irSetNg(5);
    assert(ui.__state.posts.length === 2, '8a. NG 1枚 → POST 1 回追加');
    const p2 = ui.__state.posts[1];
    assert(p2.fields.carouselAssets.filter(function (a) { return a.slideIndex === 5; })[0].imageReviewOk === false, '8b. slide 5 が NG');
    assert(p2.fields.carouselAssets.filter(function (a) { return a.slideIndex === 3; })[0].imageReviewOk === true, '8c. 直前の OK が保持される（最新Draft基準）');

    const ngHtml = ui.buildImageReviewHtml();
    // ★ imageReviewOk は生成時 false 初期化の2値のため、「NG」と「未評価」を保存データから区別できない。
    //   事実に忠実な「未OK」表記であること（誤って NG と断定しないこと）を検証する。
    assert(ngHtml.indexOf('未OK 6件') !== -1 && ngHtml.indexOf('要確認') === -1, '11a. 未OK 件数を表示（NG と断定しない）');
    assert(ngHtml.indexOf('⬜ 未OK') !== -1 && ngHtml.indexOf('✏️ NG') === -1, '11a2. 行の表示も 未OK（未評価を NG と表示しない）');
    assert(ngHtml.indexOf('不採用にできます') !== -1 && ngHtml.indexOf('新しい Output Draft') !== -1, '11b. NG 時の案内（再生成ボタンなし）');
    assert(ngHtml.indexOf('再生成') === -1 || ngHtml.indexOf('行いません') !== -1, '11c. 再生成を促さない');

    await ui.irSetAllOk();
    const p3 = ui.__state.posts[2];
    assert(p3.fields.carouselAssets.length === 7 && p3.fields.carouselAssets.every(function (a) { return a.imageReviewOk === true; }), '9a. すべてOK → 7件 true');
    assert(p3.fields.carouselAssets.every(function (a) { return a.status === 'ready' && a.sha256 && a.storagePath; }), '9b. すべてOK でも他 metadata は不変');
    const doneHtml = ui.buildImageReviewHtml();
    assert(doneHtml.indexOf('画像レビュー完了') !== -1 && doneHtml.indexOf('7 / 7') !== -1, '10. 7/7 完了表示');
    assert(doneHtml.indexOf('published') === -1 && doneHtml.indexOf('投稿しました') === -1, '9c. すべてOK は Publishing へ進めない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('12〜17. 保存の安全性（最新Draft基準 merge・無関係 fields 完全保持）');
  {
    // client snapshot が古い（caption 等が欠けている）状態で保存しても、server の最新 fields が基準になること
    const stale = mkFields();
    delete stale.caption; delete stale.hashtags; delete stale.imagePrompts;
    const ui = mkUi({ clientFields: stale });
    await ui.irLoadPreview();
    ui.__state.calls.length = 0;
    await ui.irSetOk(1);
    assert(ui.__state.calls[0] === 'GET /api/output-drafts', '12a. ★ 保存前に最新 Draft を GET する');
    assert(ui.__state.calls.filter(function (c) { return c.indexOf('POST') === 0; }).length === 1, '12b. POST は 1 回');
    const saved = ui.__state.posts[0].fields;
    const base = mkFields();
    assert(saved.caption === base.caption && Array.isArray(saved.hashtags) && saved.hashtags.length === 2, '12c. ★ client に無い caption / hashtags が失われない');

    ['slides', 'caption', 'cta', 'hashtags', 'targetAudience', 'benefit', 'imagePrompts', 'saveSharePrompt', 'carouselAspectRatio'].forEach(function (k) {
      assert(JSON.stringify(saved[k]) === JSON.stringify(base[k]), '13. unrelated fields 完全保持: ' + k);
    });
    assert(JSON.stringify(saved.carouselGeneration) === JSON.stringify(base.carouselGeneration), '14a. carouselGeneration 保持（nonce / model / quality）');
    assert(Object.keys(saved).sort().join(',') === Object.keys(base).sort().join(','), '14b. fields のキー集合が変わらない');
    saved.carouselAssets.forEach(function (a, i) {
      const b = base.carouselAssets[i];
      const same = a.slideIndex === b.slideIndex && a.slideId === b.slideId && a.width === b.width && a.height === b.height
        && a.format === b.format && a.bytes === b.bytes && a.status === b.status && a.sha256 === b.sha256
        && a.storagePath === b.storagePath && a.aspectRatio === b.aspectRatio && a.generatedAt === b.generatedAt && a.regenCount === b.regenCount;
      if (i === 0) assert(same, '14c. asset metadata（storagePath / sha256 / bytes / 寸法 / status / slideIndex）保持');
    });
    const onlyReviewChanged = saved.carouselAssets.every(function (a, i) {
      const b = Object.assign({}, base.carouselAssets[i]);
      const x = Object.assign({}, a);
      delete b.imageReviewOk; delete x.imageReviewOk;
      return JSON.stringify(x) === JSON.stringify(b);
    });
    assert(onlyReviewChanged, '14d. ★ 変更されたのは imageReviewOk だけ');

    const postBody = ui.__state.posts[0];
    assert(!('contentEvidence' in postBody.fields) && !('contentClaims' in postBody.fields), '15a. canonical を fields へ入れない');
    assert(JSON.stringify(postBody).indexOf('content_claims') === -1 && JSON.stringify(postBody).indexOf('content_evidence') === -1,
      '15b. ★ canonical 3列へ触れない');
    assert(JSON.stringify(postBody).indexOf('approval') === -1 && JSON.stringify(postBody).indexOf('reviewState') === -1,
      '16. ★ approval row / review_state へ触れない');
    assert(JSON.stringify(postBody).indexOf('published') === -1, '17. ★ published / published_at へ触れない');
    assert(!('status' in postBody) && !('type' in postBody) && !('builtAt' in postBody) && !('quality' in postBody),
      '17b. fields 以外の列（status / type / built_at / quality）を送らない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('18〜23. stale / 不整合は write 0');
  {
    // 18. nonce が変わった
    const n18 = mkFields({ carouselGeneration: { nonce: 'z'.repeat(32), model: 'gpt-image-2', quality: 'low', generatedAt: 'x' } });
    const u18 = mkUi({ mutateOnNthDraftRead: 2, mutatedFields: n18 });
    await u18.irLoadPreview();
    await u18.irSetOk(1);
    assert(u18.__state.posts.length === 0, '18a. ★ nonce 変化 → write 0');
    assert(u18._irState.phase === 'stale' && u18.buildImageReviewHtml().indexOf('画像情報が更新されています') !== -1, '18b. stale 表示');

    // 19. sha256 が変わった
    const a19 = mkFields();
    a19.carouselAssets[2] = mkAsset(3, { sha256: 'f'.repeat(64) });
    const u19 = mkUi({ mutateOnNthDraftRead: 2, mutatedFields: a19 });
    await u19.irLoadPreview();
    await u19.irSetOk(1);
    assert(u19.__state.posts.length === 0 && u19._irState.phase === 'stale', '19. ★ sha256 変化 → write 0');

    // 20. storagePath が変わった
    const a20 = mkFields();
    a20.carouselAssets[0] = mkAsset(1, { storagePath: 'carousel/other/path/slide-1.png' });
    const u20 = mkUi({ mutateOnNthDraftRead: 2, mutatedFields: a20 });
    await u20.irLoadPreview();
    await u20.irSetOk(1);
    assert(u20.__state.posts.length === 0 && u20._irState.phase === 'stale', '20. ★ storagePath 変化 → write 0');

    // 21. assets 件数が変わった
    const a21 = mkFields();
    a21.carouselAssets = a21.carouselAssets.slice(0, 5);
    const u21 = mkUi({ mutateOnNthDraftRead: 2, mutatedFields: a21 });
    await u21.irLoadPreview();
    await u21.irSetOk(1);
    assert(u21.__state.posts.length === 0 && u21._irState.phase === 'stale', '21. ★ 件数不一致 → write 0');

    // 22. outputId mismatch
    const u22 = mkUi();
    await u22.irLoadPreview();
    u22._irState.outputId = 'out_OTHER';
    await u22.irSetOk(1);
    assert(u22.__state.posts.length === 0, '22a. ★ outputId 不一致 → write 0');
    const u22b = mkUi({ rowOver: { output_id: 'out_OTHER' } });
    await u22b.irLoadPreview();
    await u22b.irSetOk(1);
    assert(u22b.__state.posts.length === 0 && u22b._irState.reason === 'output_case_mismatch', '22b. ★ 取得した行の output_id 不一致 → write 0');

    // 23. slideIndex 重複
    const a23 = mkFields();
    a23.carouselAssets[6] = mkAsset(1);
    const u23 = mkUi({ mutateOnNthDraftRead: 2, mutatedFields: a23 });
    await u23.irLoadPreview();
    await u23.irSetOk(1);
    assert(u23.__state.posts.length === 0 && u23._irState.phase === 'stale', '23. ★ slideIndex 重複 → write 0');

    // 取得失敗・401・保存失敗
    const uRead = mkUi({ draftReadFails: true });
    await uRead.irLoadPreview();
    assert(uRead.__state.posts.length === 0 && uRead._irState.phase === 'error', '23b. Draft 取得失敗 → write 0');
    const u401 = mkUi({ draftUnauthorized: true });
    await u401.irLoadPreview();
    assert(u401._irState.reason === 'unauthorized' && u401.__state.posts.length === 0, '23c. 401 → write 0');
    const uAF = mkUi({ assetsFail: 'assets_not_ready' });
    await uAF.irLoadPreview();
    assert(uAF._irState.phase === 'error' && uAF.buildImageReviewHtml().indexOf('まだ画像がありません') !== -1, '23d. assets 404 → 安全表示');
    const uPF = mkUi({ postFails: true });
    await uPF.irLoadPreview();
    await uPF.irSetOk(1);
    assert(uPF.__state.posts.length === 1 && uPF._irState.phase === 'error', '23e. 保存失敗 → error 表示（自動 retry なし）');
    const uNet = mkUi({ networkError: true });
    await uNet.irLoadPreview();
    assert(uNet._irState.phase === 'error' && uNet.__state.posts.length === 0, '23f. 通信エラー → write 0');

    // 多重実行防止
    const uDup = mkUi();
    await uDup.irLoadPreview();
    await Promise.all([uDup.irSetOk(1), uDup.irSetOk(1), uDup.irSetOk(1)]);
    assert(uDup.__state.posts.length === 1, '23g. ★ 同時3回押下 → POST 1 回');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('24, 27〜33. XSS / 非接触 / 既存機能');
  {
    const evilFields = mkFields();
    evilFields.carouselAssets[0] = mkAsset(1, { format: '<img src=x onerror=alert(1)>', status: '"><script>alert(2)</script>' });
    const ui = mkUi({ serverFields: evilFields, clientFields: evilFields });
    await ui.irLoadPreview();
    const html = ui.buildImageReviewHtml();
    assert(html.indexOf('<img src=x') === -1 && html.indexOf('&lt;img src=x') !== -1, '24a. ★ metadata が escape される');
    assert(html.indexOf('<script>') === -1 && html.indexOf('&lt;script&gt;') !== -1, '24b. ★ script タグが escape される');
    assert(!/style="[^"]*(onerror|&lt;img)/.test(html), '24c. 属性へ外部データを入れていない');

    assert(IR_BLOCK.indexOf('/api/carousel-image/produce') === -1 && IR_BLOCK.indexOf('/api/carousel-image/generate') === -1
      && IR_BLOCK.indexOf('/api/carousel-image/approval') === -1, '27. ★ 再生成・有料 route を呼ばない');
    assert(!/provider|billingLock|approvalToken|nonce.*=.*generate/i.test(IR_BLOCK.replace(/nonce/g, 'N')), '28. ★ paid provider / token / billingLock に触れない');
    // ★ 説明コメント内の語で誤検出しないよう、コメントを除いた「実コード」で判定する。
    const IR_CODE = IR_BLOCK.replace(/^[ \t]*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    assert(!/localStorage|sessionStorage/.test(IR_CODE), '26b. ★ 実コードで localStorage / sessionStorage を使わない');

    assert(SRC.indexOf('function buildContentValueDiagnosisHtml(') !== -1 && !/contentValue/.test(IR_BLOCK), '29. Content Value パネル不変・非参照');
    assert(SRC.indexOf('function buildCarouselImageProductionHtml(') !== -1 && !/_cipState|cipGenerate/.test(IR_BLOCK), '30. Carousel Production パネル不変・非参照');
    assert(/var canApprove = _mapAllChecked\(\) && _mapReviewApproved\(mai\) && !_mapCompliance\.blocked;/.test(SRC)
      && !/_mobileApprovalState\s*\.\s*\w+\s*=(?!=)/.test(IR_BLOCK), '31. Mobile Approval 不変・状態を書き換えない');
    assert(SRC.indexOf('function buildPublishingReadyHtml(') !== -1
      && !/_publishingReadyState\s*\.\s*\w+\s*=(?!=)|markInstagramPublished/.test(IR_BLOCK), '32. Publishing Ready 不変・状態を書き換えない');
    assert(/_oeSafe\(buildCarouselImageProductionHtml,[\s\S]{0,90}_oeSafe\(buildImageReviewHtml,[\s\S]{0,90}_oeSafe\(buildPublishingReadyHtml,/.test(SRC),
      '32b. 描画順 CarouselProduction → ImageReview → PublishingReady');
    assert(SRC.indexOf('try { _irApplyImageSrc(); } catch (_irE)') !== -1, '32c. 描画後に img.src を適用する hook がある');

    const changed = require('child_process')
      .execSync('git diff --name-only HEAD -- shared server.js supabase lib', { encoding: 'utf8' }).trim();
    assert(changed === '', '33a. ★ server.js / shared / lib / schema 無変更 | ' + (changed || 'なし'));
    // ★ commit 済みかどうかに依存しない「内容の不変条件」で scope 封じ込めを判定する。
    //   Image Review の実装は index.html の中だけに存在し、server / shared / lib には一切入らないこと。
    const IR_SYMBOLS = /buildImageReviewHtml|_irSaveReview|_irApplyImageSrc|_irSnapshotEquals|imageReviewOk\s*:/;
    const serverSide = ['server.js'].concat(
      fs.readdirSync(path.join(__dirname, 'lib')).filter(function (f) { return f.endsWith('.js'); }).map(function (f) { return 'lib/' + f; }),
      fs.readdirSync(path.join(__dirname, 'shared')).filter(function (f) { return f.endsWith('.js'); }).map(function (f) { return 'shared/' + f; })
    );
    const leaked = serverSide.filter(function (rel) {
      // imageReviewOk は生成時に server が初期値 false を書く既存箇所があるため、UI 実装記号のみで判定する
      const t = fs.readFileSync(path.join(__dirname, rel), 'utf8');
      return /buildImageReviewHtml|_irSaveReview|_irApplyImageSrc|_irSnapshotEquals/.test(t);
    });
    assert(leaked.length === 0, '33b. Image Review の実装が server / shared / lib へ漏れていない | ' + (leaked.join(', ') || 'なし'));
    assert(IR_SYMBOLS.test(SRC) && SRC.indexOf('function buildImageReviewHtml(') !== -1, '33c. Image Review の実装は index.html に存在する');
  }

  console.log('\n=== ' + _passed + ' passed / ' + _failed + ' failed ===');
  process.exit(_failed ? 1 : 0);
})();
