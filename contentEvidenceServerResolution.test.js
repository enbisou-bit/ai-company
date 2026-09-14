'use strict';
// contentEvidenceServerResolution.test.js
// CV-4c-3B: Server Canonical Evidence Resolution の deterministic テスト（Part M + Part N）。
//
//   実HTTP 0 / 実AI API 0 / 実DB 0 / 実Web Evidence 0（DB層はfake注入。lib/contentEvidenceResolutionService.js
//   はNode requireでshared/contentEvidence.jsを直接利用する＝server-onlyであることの実証も兼ねる）。

const fs = require('fs');
const path = require('path');
const svc = require('./lib/contentEvidenceResolutionService');
const contentClaimPlanning = require('./shared/contentClaimPlanning');
const contentEvidence = require('./shared/contentEvidence');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const serverSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

const CASE_ID = 'case-x';
const NOW = Date.parse('2026-09-14T00:00:00.000Z');

function goodItem(intentId, sourceUrl, sourceTitle, excerpt, extra) {
  return Object.assign({
    intentId: intentId, caseId: CASE_ID,
    topic: '保湿', question: '洗顔後の保湿はどの程度早く行うべきか', claimTypeCandidate: 'general_practice',
    candidate: { sourceMethod: 'web_retrieved', sourceUrl: sourceUrl, sourceTitle: sourceTitle, createdBy: 'system', sourceExcerpt: excerpt },
    mappingDecision: { claimType: 'general_practice', supportType: 'supports' },
  }, extra || {});
}

(async () => {
  console.log('\n=== contentEvidenceServerResolution.test.js (CV-4c-3B Part M/N) ===');

  // ══════════════════════════════════════════════════════════════
  caseHeader('9. server _hasContentEvidence() true（server-only require可能の実証）');
  {
    assert(contentClaimPlanning._hasContentEvidence() === true, '9. server(Node) context では contentEvidence.js が正常にrequireできる');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('10〜11. candidate + mapping受理 / mapping無し除外・拒否');
  {
    const items = [
      goodItem('i1', 'https://www.mhlw.go.jp/a', 't1', '5分以内の保湿が推奨されています。'),
      { intentId: 'i1', caseId: CASE_ID, candidate: { sourceMethod: 'web_retrieved', sourceUrl: 'https://x.example.com/b', createdBy: 'system' } }, // mapping無し
    ];
    const r = svc.resolveContentEvidenceSubmission(items, { caseId: CASE_ID, now: NOW });
    assert(r.contentEvidence.length === 1, '10. mapping有りの1件のみFormal Evidence化される');
    assert(r.errors.some(function (e) { return e.error === 'mapping_decision_missing'; }), '11. mapping無しcandidateはmapping_decision_missingとして拒否される');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('12. unverified即verified禁止');
  {
    const items = [goodItem('i2', 'https://general-blog.example.com/a', 't', '5分以内の保湿。')]; // Tier7単独
    const r = svc.resolveContentEvidenceSubmission(items, { caseId: CASE_ID, now: NOW });
    assert(r.contentEvidence[0].verificationStatus === 'unverified', '12. ★Tier7単独は即verifiedにならない（unverifiedのまま）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('13〜14. source trust / reliability server再計算');
  {
    const items = [goodItem('i3', 'https://www.mhlw.go.jp/a', 't', '5分以内の保湿。')];
    const r = svc.resolveContentEvidenceSubmission(items, { caseId: CASE_ID, now: NOW });
    assert(r.contentEvidence[0].reliability === 'high', '13. go.jpドメインはclassifySourceTrust()経由でreliability=highと再計算される');
    assert(!Object.prototype.hasOwnProperty.call(r.contentEvidence[0], 'sourceTier'), '14. sourceTier自体は保存しない（既存契約維持）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('15〜19. client spoof値の無視');
  {
    const spoofedItem = goodItem('i4', 'https://general-blog.example.com/a', 't', '5分以内の保湿。', {
      candidate: { sourceMethod: 'web_retrieved', sourceUrl: 'https://general-blog.example.com/a', createdBy: 'system', sourceExcerpt: '5分以内の保湿。', sourceTier: 1 }, // spoof
      mappingDecision: { claimType: 'general_practice', supportType: 'supports', verificationStatus: 'verified' }, // spoof
    });
    const r = svc.resolveContentEvidenceSubmission([spoofedItem], { caseId: CASE_ID, now: NOW });
    assert(!Object.prototype.hasOwnProperty.call(r.contentEvidence[0], 'sourceTier'), '15. ★sourceTierをclientが送っても保存されない（無視）');
    assert(r.contentEvidence[0].verificationStatus === 'unverified', '16. ★verificationStatus:"verified"をclientが送ってもweb_retrievedでは無視されunverified');
    assert(r.contentEvidence[0].reliability === 'low', '13b. Tier7（general-blog）はreliability=lowとしてserver再計算される（spoof無視の確認込み）');

    // grounded/contentEvidence/contentClaimsをまるごとclientが偽装しても、
    //   本関数の出力は常にserver計算値のみ（そもそも入力として受理する経路自体が存在しない）
    const fakeInput = [Object.assign({}, spoofedItem, { grounded: true, contentEvidence: [{ fake: true }], contentClaims: [{ fake: true }] })];
    const r2 = svc.resolveContentEvidenceSubmission(fakeInput, { caseId: CASE_ID, now: NOW });
    assert(r2.contentEvidence.every(function (e) { return e.fake === undefined; }), '17-19. ★grounded/contentEvidence/contentClaimsの偽装fieldは一切採用されない（読み取られる経路が無い）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('20〜22. resolveClaimEvidenceBatch成功 / unsupported number・causality拒否');
  {
    const items = [
      goodItem('i5', 'https://www.mhlw.go.jp/a', 't1', '5分以内の保湿が推奨されています。'),
      goodItem('i5', 'https://dermatology.or.jp/a', 't2', '5分以内の保湿がすすめられています。'),
    ];
    const r = svc.resolveContentEvidenceSubmission(items, { caseId: CASE_ID, now: NOW });
    assert(r.perIntent['i5'].resolution && r.perIntent['i5'].resolution.byClaim['i5'].grounded === true, '20. resolveClaimEvidenceBatch()が正常実行されgrounded=true');

    const itemsWithBadClaim = items.map(function (it) { return it; }).concat([]);
    itemsWithBadClaim[0] = Object.assign({}, itemsWithBadClaim[0], { proposedClaimText: '洗顔後は3分以内に保湿すると乾燥を防ぎやすくなります。' });
    const rNum = svc.resolveContentEvidenceSubmission(itemsWithBadClaim, { caseId: CASE_ID, now: NOW });
    assert(rNum.contentClaims.length === 0 && rNum.errors.some(function (e) { return e.error === 'finalize_failed'; }),
      '21. ★Evidenceに無い数値（3分）を含むproposedClaimTextは拒否される');

    const causalCheck = contentClaimPlanning.detectUnsupportedClaimElements('効果があるので、毎日使うべきです。', []);
    assert(causalCheck.hasUnsupportedCausal === true, '22. 支持Evidence無しの因果表現はunsupportedと判定される（Core再利用の確認）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('23〜26. sufficient claim finalize成功 / insufficient除外 / canonical生成');
  {
    const items = [
      goodItem('i6', 'https://www.mhlw.go.jp/a', 't1', '5分以内の保湿が推奨されています。', { proposedClaimText: '洗顔後は5分以内に保湿すると乾燥を防ぎやすくなります。' }),
      goodItem('i6', 'https://dermatology.or.jp/a', 't2', '5分以内の保湿がすすめられています。'),
    ];
    const r = svc.resolveContentEvidenceSubmission(items, { caseId: CASE_ID, now: NOW });
    assert(r.contentClaims.length === 1 && r.contentClaims[0].status === 'grounded', '23. sufficient claimはfinalize成功しcontentClaimsへ入る');
    assert(r.contentEvidence.length === 2, '25. canonical contentEvidence（2件）が生成される');
    assert(r.contentClaims.length === 1, '26. canonical contentClaims（1件）が生成される');

    const insuffItems = [goodItem('i7', 'https://general-blog.example.com/a', 't', '5分以内の保湿。', { proposedClaimText: '洗顔後は5分以内に保湿すると乾燥を防ぎやすくなります。' })];
    const rInsuff = svc.resolveContentEvidenceSubmission(insuffItems, { caseId: CASE_ID, now: NOW });
    assert(rInsuff.contentClaims.length === 0, '24. insufficient claim（Tier7単独）はcontentClaimsから除外される');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('27〜28. Evidence submission fail-closed / candidate未提出時の従来挙動維持（server.js source確認）');
  {
    const insuffItems = [goodItem('i8', 'https://general-blog.example.com/a', 't', '5分以内の保湿。')];
    const rInsuff = svc.resolveContentEvidenceSubmission(insuffItems, { caseId: CASE_ID, now: NOW });
    // service自体は0件を返すだけ（fail-closedの実際の422判定はserver.js route側の責務）
    assert(rInsuff.contentEvidence.length === 1 && rInsuff.contentClaims.length === 0,
      '27a. Tier7単独candidateはcontentEvidence生成されるがcontentClaimsは0件のまま（route側でfail-closed判定される入力）');

    const routeStart = serverSrc.indexOf("app.post('/api/output-drafts'");
    const routeEnd = serverSrc.indexOf('\n});', routeStart) + 4;
    const routeSrc = serverSrc.slice(routeStart, routeEnd);
    assert(routeSrc.indexOf('content_evidence_resolution_insufficient') !== -1,
      '27b. server.jsのroute内にfail-closed用のerror（content_evidence_resolution_insufficient）が存在する');
    assert(routeSrc.indexOf('res.status(422)') !== -1, '27c. fail-closed時は422で応答する');
    assert(routeSrc.indexOf('if (Array.isArray(contentEvidenceCandidates)') !== -1,
      '28. contentEvidenceCandidates未提出時はこの分岐に入らない＝従来挙動を維持する構造になっている');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('29〜30. canonical resolutionがupsertより先 / server canonical値がupsertへ渡る');
  {
    const routeStart = serverSrc.indexOf("app.post('/api/output-drafts'");
    const routeEnd = serverSrc.indexOf('\n});', routeStart) + 4;
    const routeSrc = serverSrc.slice(routeStart, routeEnd);
    const resolveIdx = routeSrc.indexOf('resolveContentEvidenceSubmission');
    const upsertIdx = routeSrc.indexOf('upsertOutputDraft(');
    assert(resolveIdx !== -1 && upsertIdx !== -1 && resolveIdx < upsertIdx,
      '29. ★resolveContentEvidenceSubmission() の呼び出しが upsertOutputDraft() より前にある（順序確認）');
    assert(routeSrc.indexOf('fields: resolvedFields') !== -1,
      '30. upsertOutputDraft() へ渡される fields は resolvedFields（server確定後の値）である');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('31〜32. client forged formal arraysが保存されないことの構造確認');
  {
    const routeStart = serverSrc.indexOf("app.post('/api/output-drafts'");
    const routeEnd = serverSrc.indexOf('\n});', routeStart) + 4;
    const routeSrc = serverSrc.slice(routeStart, routeEnd);
    assert(routeSrc.indexOf('delete resolvedFields.contentEvidence') !== -1, '31. client供給fields.contentEvidenceは常に破棄される');
    assert(routeSrc.indexOf('delete resolvedFields.contentClaims') !== -1, '32. client供給fields.contentClaimsは常に破棄される');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('33. Content Value evaluationはcanonical fieldsを参照');
  {
    const routeStart = serverSrc.indexOf("app.post('/api/output-drafts'");
    const routeEnd = serverSrc.indexOf('\n});', routeStart) + 4;
    const routeSrc = serverSrc.slice(routeStart, routeEnd);
    assert(routeSrc.indexOf('resolveContentValueForSave') !== -1 && routeSrc.indexOf('fields: resolvedFields }') !== -1,
      '33. resolveContentValueForSave() は resolvedFields（canonical確定後）を参照する');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('34. 新DB column 0');
  {
    const schemaSrc = fs.readFileSync(path.join(__dirname, 'supabase', 'schema.sql'), 'utf8');
    assert(schemaSrc.indexOf('content_evidence_candidates') === -1 && schemaSrc.indexOf('CV-4c-3B') === -1,
      '34. ★supabase/schema.sql は今回一切変更していない（新column 0）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('46〜49. Security / public exposure');
  {
    const publicStatic = require('./lib/publicStatic');
    assert(publicStatic.resolvePublicAsset('/shared/contentEvidence.js') === null, '46. shared/contentEvidence.js は非公開のまま');
    assert(publicStatic.resolvePublicAsset('/shared/contentValueQuality.js') === null, '47. shared/contentValueQuality.js は非公開のまま');
    const svcSrc = fs.readFileSync(path.join(__dirname, 'lib', 'contentEvidenceResolutionService.js'), 'utf8');
    assert(!/api[_-]?key|secret|password|WEB_SESSION_SECRET|SUPABASE_SERVICE_ROLE|SUPABASE_SECRET/i.test(svcSrc),
      '48. lib/contentEvidenceResolutionService.js にsecret/credential文字列が含まれない');
    assert(publicStatic.resolvePublicAsset('/lib/contentEvidenceResolutionService.js') === null,
      '49. lib/contentEvidenceResolutionService.js 自体もブラウザへ公開されていない（server-only helper）');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All contentEvidenceServerResolution cases passed (CV-4c-3B Part M/N)'); }
})().catch(function (e) { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
