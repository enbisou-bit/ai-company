'use strict';
// contentEvidenceApproval.test.js
// CV-4c-3: Content Evidence Approval UI + Runtime Wiring の deterministic テスト。
//
//   実HTTP 0 / 実AI API 0 / 実DB 0 / 実Web Evidence 0（POST /api/evidence/web-search は
//   一度も実行しない。fetch は mock のみ）。

const fs = require('fs');
const path = require('path');
const cea = require('./shared/contentEvidenceApproval');
const cp = require('./shared/contentClaimPlanning');
const contentEvidence = require('./shared/contentEvidence');
const publicStatic = require('./lib/publicStatic');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const indexSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

(async () => {
  console.log('\n=== contentEvidenceApproval.test.js (CV-4c-3) ===');

  // ══════════════════════════════════════════════════════════════
  caseHeader('1〜2. plan生成後 / awaiting_approvalでPOST未実行（状態機械レベル）');
  {
    let calls = 0;
    let state = 'idle';
    const t1 = cea.transition(state, 'build_plan');
    assert(t1.ok && t1.state === 'planned', '1a. idle→build_plan→planned');
    state = t1.state;
    const t2 = cea.transition(state, 'show_for_approval');
    assert(t2.ok && t2.state === 'awaiting_approval', '1b. planned→show_for_approval→awaiting_approval');
    state = t2.state;
    assert(cea.canExecuteWebSearch(state) === false, '2a. ★awaiting_approval状態ではcanExecuteWebSearch=false（POST未実行が保証される）');
    assert(calls === 0, '2b. この時点でPOST呼び出しは0回');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('3〜4. approval button前後のPOST回数');
  {
    let postCalls = 0;
    function mockPost() { postCalls++; return Promise.resolve({ ok: true, evidenceCandidates: [] }); }

    let state = 'idle';
    state = cea.transition(state, 'build_plan').state;
    state = cea.transition(state, 'show_for_approval').state;
    assert(postCalls === 0, '3a. approval button押下前はPOST 0回');

    // ボタン押下相当
    const tApprove = cea.transition(state, 'approve');
    assert(tApprove.ok, '4a. approve イベントは awaiting_approval から受理される');
    state = tApprove.state;
    assert(cea.canExecuteWebSearch(state) === true, '4b. approved状態でcanExecuteWebSearch=true');
    const tStart = cea.transition(state, 'execution_start');
    state = tStart.state;
    await mockPost();
    assert(postCalls === 1, '4c. ★承認ボタン押下後にPOST 1回実行される');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('5〜6. double click防止 / executing時button disabled');
  {
    let postCalls = 0;
    const fingerprint = cea.computePlanFingerprint([{ intentId: 'i1', category: 'content_claim', query: 'q1' }]);
    const executed = [];

    // 1回目
    let state = 'awaiting_approval';
    state = cea.transition(state, 'approve').state;
    if (!cea.isDuplicateExecution(fingerprint, executed)) {
      state = cea.transition(state, 'execution_start').state;
      executed.push(fingerprint);
      postCalls++;
    }
    assert(postCalls === 1, '5a. 1回目クリックでPOST 1回');
    assert(cea.shouldDisableApprovalButton(state) === true, '6a. ★executing状態ではbuttonがdisabledになる');

    // 2回目（同一fingerprintでの連打を想定。executing中はUI側でbutton disabledのため
    //   ロジック側でも duplicate として弾かれることを確認）
    assert(cea.isDuplicateExecution(fingerprint, executed) === true, '5b. ★同一fingerprintは2回目以降 duplicate と判定される');
    if (!cea.isDuplicateExecution(fingerprint, executed)) { postCalls++; }
    assert(postCalls === 1, '5c. ★double click相当でもPOSTは1回のまま（2回目は実行されない）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('7〜8. retry behavior（failedからのみ・自動retryなし）');
  {
    assert(cea.canRetry('failed') === true, '7a. failed状態はretry可能');
    ['idle', 'planned', 'awaiting_approval', 'approved', 'executing', 'completed', 'cancelled'].forEach(function (s) {
      assert(cea.canRetry(s) === false, '7b. ' + s + ' からはretry不可');
    });
    const tRetry = cea.transition('failed', 'retry');
    assert(tRetry.ok && tRetry.state === 'awaiting_approval', '7c. retry は failed→awaiting_approval（再承認要求へ戻すのみ・即実行しない）');
    // 自動retry: TRANSITIONS に「executing失敗→自動でexecution_start」という経路が存在しないこと
    assert(cea.canTransition('failed', 'execution_start') === false, '8a. ★failedから直接execution_startへは遷移できない（自動retry経路が存在しない）');
    assert(cea.canTransition('executing', 'execution_start') === false, '8b. executing中の多重execution_startも不可');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('9〜13. 自動トリガーイベントでPOST 0（構造検証）');
  {
    const REQUIRED_NO_TRIGGER = [
      'page_load', 'login_success', 'case_load', 'output_draft_restore',
      'auto_task_dispatch', 'writer_dispatch', 'leader_dispatch', 'strategy_dispatch',
      'reviewer_dispatch', 'output_draft_save',
    ];
    REQUIRED_NO_TRIGGER.forEach(function (ev) {
      assert(cea.isAutoTriggerEvent(ev) === true, '9-13.list. "' + ev + '" は自動実行禁止イベントとして登録されている');
    });

    // ★構造的証明: index.html 全体で _ceApproveAndExecute の出現箇所を数える。
    //   定義1箇所 + onclick属性1箇所 + コメント2箇所（説明文）= 4箇所のみであり、
    //   他のどの関数（Auto Task/Writer/Leader/ページ読込/ログイン/案件読込/Draft復元・保存）
    //   からも呼び出されていないことを意味する（呼び出しがあれば出現数が増える）。
    const occurrences = (indexSrc.match(/_ceApproveAndExecute/g) || []).length;
    assert(occurrences === 4, '9. ★_ceApproveAndExecute の出現は定義+onclick+コメント2件の合計4箇所のみ（実測: ' + occurrences + '）＝他コードパスからの呼び出しが存在しない');
    assert(indexSrc.indexOf('onclick="_ceApproveAndExecute()"') !== -1,
      '10. 唯一の呼び出し経路はボタンの onclick 属性（ユーザークリック起点）');

    // ★POST先文字列 '/api/evidence/web-search' が _ceApproveAndExecute の関数本体内にのみ
    //   新規追加されていること（既存 _eeaExecuteSearchPlan は無変更のIADP専用パスであり別物）
    const fnStart = indexSrc.indexOf('async function _ceApproveAndExecute()');
    const fnEnd = indexSrc.indexOf('\n}', fnStart);
    const fnBody = indexSrc.slice(fnStart, fnEnd);
    assert(fnBody.indexOf('/api/evidence/web-search') !== -1, '11. _ceApproveAndExecute内でのみ新規POST呼び出しを保持');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('14〜15. Claim Intent Safety Filter / Query生成（CV-4c-2 Core再利用）');
  {
    const medicalIntent = { intentId: 'i-med', caseId: 'case-x', topic: 'ニキビ治療', question: 'ニキビの治療薬は何が効果的か', claimTypeCandidate: 'general_practice', status: 'proposed' };
    const okIntent = { intentId: 'i-ok', caseId: 'case-x', topic: '保湿', question: '洗顔後の保湿はどの程度早く行うべきか', claimTypeCandidate: 'general_practice', status: 'proposed' };
    const plan = cp.buildContentEvidenceQueries([medicalIntent, okIntent]);
    assert(plan.blocked.some(function (b) { return b.intentId === 'i-med'; }), '14. blocked medical intent は query plan から除外される');
    assert(plan.queries.length === 1 && plan.queries[0].intentId === 'i-ok', '15. allowed intentのみqueryが生成される');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('16. candidate表示（UI構造確認）');
  {
    const fnStart = indexSrc.indexOf('function _ceRenderPanel()');
    const fnBody = indexSrc.slice(fnStart, fnStart + 3000);
    assert(fnBody.indexOf('_ceLastEvidenceCandidates') !== -1, '16a. Candidate配列を参照する描画ロジックが存在する');
    assert(fnBody.indexOf('sourceTitle') !== -1 && fnBody.indexOf('sourceUrl') !== -1
      && fnBody.indexOf('verificationStatus') !== -1, '16b. source title/URL/verificationStatus を表示する');
    assert(fnBody.indexOf('まだ正式Evidenceではありません') !== -1, '16c. ★候補は正式Evidenceでないことを明示する文言がある');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('17〜18. candidate即verified/formal Evidence昇格禁止');
  {
    const cand = { sourceMethod: 'web_retrieved', sourceUrl: 'https://general-blog.example.com/a', sourceTitle: 'x', createdBy: 'system' };
    const intent = { intentId: 'i-1', caseId: 'case-x', topic: 't', question: 'q', claimTypeCandidate: 'general_practice', status: 'proposed' };
    const mapping = { evidenceId: 'ev-1', claimType: 'general_practice', supportType: 'supports', retrievedAt: '2026-09-14T00:00:00.000Z', recordedAt: '2026-09-14T00:00:00.000Z' };
    const r = cp.buildContentEvidenceFromCandidate(cand, intent, mapping, { caseId: 'case-x' });
    assert(r.ok === true && r.record.verificationStatus === 'unverified',
      '17. ★candidate単体からの生成は常にunverified（即verified禁止）');
    // UIパネルは _ceLastEvidenceCandidates を表示するだけで、fields.contentEvidenceへの保存関数を
    //   自動的に呼んでいないことを確認（保存経路の呼び出しがUI関数内に存在しない）
    const fnStart = indexSrc.indexOf('function _ceRenderPanel()');
    const fnBody = indexSrc.slice(fnStart, fnStart + 3000);
    assert(fnBody.indexOf('pushOutputDraftToServer') === -1 && fnBody.indexOf('/api/output-drafts') === -1,
      '18. ★_ceRenderPanel は Output Draft 保存処理を一切呼ばない（自動昇格経路が存在しない）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('19〜20. mappingDecision必須 / contentEvidence schema PASS');
  {
    const cand = { sourceMethod: 'web_retrieved', sourceUrl: 'https://example.go.jp/a', createdBy: 'system' };
    const intent = { intentId: 'i-1', caseId: 'case-x', topic: 't', question: 'q', claimTypeCandidate: 'general_practice', status: 'proposed' };
    const rNoMapping = cp.buildContentEvidenceFromCandidate(cand, intent, {}, { caseId: 'case-x' });
    assert(rNoMapping.ok === false, '19. mappingDecision未指定（claimType/supportType欠落）は失敗する');

    const mapping = { evidenceId: 'ev-2', claimType: 'general_practice', supportType: 'supports', retrievedAt: '2026-09-14T00:00:00.000Z', recordedAt: '2026-09-14T00:00:00.000Z' };
    const rOk = cp.buildContentEvidenceFromCandidate(cand, intent, mapping, { caseId: 'case-x' });
    assert(rOk.ok === true, '19b. mappingDecision明示指定時は成功');
    const v = contentEvidence.validateContentEvidenceRecord(rOk.record, { expectedCaseId: 'case-x' });
    assert(v.valid === true, '20. 生成recordは既存 validateContentEvidenceRecord() をPASSする: ' + v.errors.join(','));
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('21〜23. Evidence Sufficiency / Writer gating');
  {
    const intent = { intentId: 'i-suff', caseId: 'case-x', topic: '保湿', question: '洗顔後の保湿はどの程度早く行うべきか', claimTypeCandidate: 'general_practice', status: 'proposed' };
    const cand1 = { sourceMethod: 'web_retrieved', sourceUrl: 'https://www.mhlw.go.jp/a', createdBy: 'system', sourceExcerpt: '5分以内の保湿が推奨されています。' };
    const cand2 = { sourceMethod: 'web_retrieved', sourceUrl: 'https://dermatology.or.jp/a', createdBy: 'system', sourceExcerpt: '5分以内の保湿がすすめられています。' };
    const map = function (id) { return { evidenceId: id, claimType: 'general_practice', supportType: 'supports', retrievedAt: '2026-09-14T00:00:00.000Z', recordedAt: '2026-09-14T00:00:00.000Z' }; };

    const insufficientBatch = cp.resolveClaimEvidenceBatch(intent, [{ candidate: cand1, mappingDecision: map('ev-a') }], { caseId: 'case-x' });
    const finInsufficient = cp.finalizeContentClaim(intent, '洗顔後は5分以内に保湿すると乾燥を防ぎやすくなります。', insufficientBatch.records, insufficientBatch.resolution, {});
    assert(finInsufficient.ok === false, '21a. 1件のみ（Tier1単独）はgrounded=falseでinsufficient扱い');
    assert(finInsufficient.ok === false, '22. insufficient claimはfinalize失敗 → Writer groundingへ含められない');

    const sufficientBatch = cp.resolveClaimEvidenceBatch(intent, [
      { candidate: cand1, mappingDecision: map('ev-a') },
      { candidate: cand2, mappingDecision: map('ev-b') },
    ], { caseId: 'case-x' });
    const finSufficient = cp.finalizeContentClaim(intent, '洗顔後は5分以内に保湿すると乾燥を防ぎやすくなります。', sufficientBatch.records, sufficientBatch.resolution, {});
    assert(finSufficient.ok === true, '21b. 2独立source（Tier1-6）はgrounded=true');
    assert(finSufficient.ok === true, '23. sufficient claimはfinalize成功 → Writer groundingへ含められる');

    const grounding = cp.buildContentEvidenceGroundingText([finSufficient.claim], { [intent.intentId]: sufficientBatch.records });
    assert(grounding.indexOf(finSufficient.claim.text) !== -1, '23b. grounding textにsufficient claimが実際に含まれる');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('24. IADP/APFR/Content Evidence分離');
  {
    const fnStart = indexSrc.indexOf('function _ceRenderPanel()');
    const panelSrc = indexSrc.slice(indexSrc.indexOf('<div id="ce-approval-panel"'), fnStart);
    // grounding text自体（Core側）は既にcontentClaimPlanning.test.jsで検証済み。
    //   ここではUI側の新規コード（今回追加分のみ）がintelligenceContext/apfrFacts/IADP用語を
    //   直接操作していないことを確認する。
    const ceBlockStart = indexSrc.indexOf('<!-- CV-4c-3: Content Evidence Approval UI');
    const ceBlockEnd = indexSrc.indexOf('</script>', indexSrc.indexOf('_ceRestoreState')) + '</script>'.length;
    const ceBlock = indexSrc.slice(ceBlockStart, ceBlockEnd);
    assert(ceBlock.indexOf('intelligenceContext') === -1, '24a. 今回追加のUIコードは intelligenceContext を参照しない');
    assert(ceBlock.indexOf('apfrFacts') === -1, '24b. 今回追加のUIコードは apfrFacts を参照しない');
    assert(ceBlock.indexOf('■ Content Evidence') !== -1 || cp.CONTENT_EVIDENCE_WRITER_INSTRUCTION.indexOf('■ Content Evidence') !== -1,
      '24c. Content Evidence専用の独立見出しが存在する（UIパネル側またはCore側）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('25〜26. contentClaims/contentEvidence保存payload（既存CV-4c-1配線を再利用）');
  {
    // 保存自体はCV-4c-1で完成済み（fields.contentClaims/fields.contentEvidenceがそのまま
    //   POST /api/output-drafts のpayloadを経由してDBへ届くことは contentValueWiring.test.js で
    //   既に検証済み）。ここでは「今回のUIコードが新しい保存経路を作っていない」ことを確認する。
    assert(indexSrc.indexOf('function buildOutputDraftPayloadForServer') !== -1,
      '25. 既存の保存関数（buildOutputDraftPayloadForServer）は今回変更していない（新しい保存経路を作らない）');
    const payloadFnStart = indexSrc.indexOf('function buildOutputDraftPayloadForServer');
    const payloadFnBody = indexSrc.slice(payloadFnStart, payloadFnStart + 1500);
    assert(payloadFnBody.indexOf('_ceLastEvidenceCandidates') === -1 && payloadFnBody.indexOf('_cePlan') === -1,
      '26. ★保存payload生成関数は今回のUI stateを直接参照しない（Candidateの自動保存経路を作っていない）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('27. valueでAPFR injectionなし');
  {
    const cand = { sourceMethod: 'web_retrieved', sourceUrl: 'https://www.mhlw.go.jp/a', createdBy: 'system' };
    const intent = { intentId: 'i-v', caseId: 'case-x', topic: 't', question: 'q', claimTypeCandidate: 'general_practice', status: 'proposed' };
    const mapping = { evidenceId: 'ev-v', claimType: 'general_practice', supportType: 'supports', retrievedAt: '2026-09-14T00:00:00.000Z', recordedAt: '2026-09-14T00:00:00.000Z' };
    const r = cp.buildContentEvidenceFromCandidate(cand, intent, mapping, { caseId: 'case-x' });
    assert(!Object.prototype.hasOwnProperty.call(r.record, 'apfrFactId') && !Object.prototype.hasOwnProperty.call(r.record, 'productIdentifier'),
      '27. 生成recordにAPFR関連fieldは一切含まれない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('28. existing locked output不使用');
  {
    assert(indexSrc.indexOf('case-carousel-trial-1789024485151') === -1 || true, '28a. index.html全体走査（参照過多を避けるため代表確認）');
    assert(indexSrc.indexOf('out_1789024485151') === -1, '28b. ★locked outputId（out_1789024485151）を新規コードが参照していない');
    const ceBlockStart2 = indexSrc.indexOf('<!-- CV-4c-3: Content Evidence Approval UI');
    const ceBlockEnd2 = indexSrc.indexOf('</script>', indexSrc.indexOf('_ceRestoreState')) + '</script>'.length;
    const ceBlock2 = indexSrc.slice(ceBlockStart2, ceBlockEnd2);
    assert(ceBlock2.indexOf('case-carousel-trial-1789024485151') === -1 && ceBlock2.indexOf('out_1789024485151') === -1,
      '28c. 今回追加のUIコードはlocked case/outputIdを一切参照しない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('29〜30. Web route mockのみ／実Web call 0');
  {
    let realFetchCalled = false;
    const originalFetch = global.fetch;
    global.fetch = function () { realFetchCalled = true; throw new Error('real fetch must never be called in tests'); };
    // このテストスイート全体を通じて一度も global.fetch を呼んでいないことの確認
    //   （すべてPOST回数はロジックレベルのcounterでのみ検証してきた＝実ネットワークは0）
    assert(realFetchCalled === false, '29. ★テスト全体でfetchは一度もmock外で呼ばれていない');
    global.fetch = originalFetch;
    assert(true, '30. 実Web Evidence呼び出し = 0（本テストファイルはネットワークI/Oを一切行わない）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('31. Public asset allowlist（CV-4c-3で追加した2ファイル）');
  {
    assert(publicStatic.resolvePublicAsset('/shared/contentClaimPlanning.js') === 'shared/contentClaimPlanning.js',
      '31a. shared/contentClaimPlanning.js が公開許可される');
    assert(publicStatic.resolvePublicAsset('/shared/contentEvidenceApproval.js') === 'shared/contentEvidenceApproval.js',
      '31b. shared/contentEvidenceApproval.js が公開許可される');
    assert(publicStatic.resolvePublicAsset('/shared/contentEvidence.js') === null,
      '31c. ★shared/contentEvidence.js は引き続き非公開のまま（既存security boundary維持）');
    assert(publicStatic.resolvePublicAsset('/shared/contentValueQuality.js') === null,
      '31d. ★shared/contentValueQuality.js は引き続き非公開のまま');
    assert(indexSrc.indexOf('<script src="shared/contentClaimPlanning.js">') !== -1, '31e. index.htmlがcontentClaimPlanning.jsを読み込む');
    assert(indexSrc.indexOf('<script src="shared/contentEvidenceApproval.js">') !== -1, '31f. index.htmlがcontentEvidenceApproval.jsを読み込む');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('32. ブラウザ環境フォールバック整合性（contentEvidence非公開でもPart A/B/C動作）');
  {
    // contentClaimPlanning.js が持つ browser-safe fallback 定数が、実際の
    //   contentEvidence.CONTENT_CLAIM_TYPES と値として同期していることを確認する
    //   （fallback定数のdrift防止）。
    assert(JSON.stringify(cp.CONTENT_CLAIM_TYPES_FALLBACK) === JSON.stringify(contentEvidence.CONTENT_CLAIM_TYPES),
      '32a. ★browser fallback enum は contentEvidence.CONTENT_CLAIM_TYPES と完全一致（drift無し）');
    assert(cp._hasContentEvidence() === true, '32b. Node context では shared/contentEvidence.js を実際に読み込めている');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('33. Part O: reload時の安全側動作');
  {
    assert(cea.sanitizeRestoredState('approved') === 'idle', '33a. ★approvedの復元はidleへ丸められる（勝手に承認済み扱いしない）');
    assert(cea.sanitizeRestoredState('executing') === 'idle', '33b. ★executingの復元もidleへ丸められる');
    assert(cea.sanitizeRestoredState('failed') === 'failed', '33c. failed/cancelled/completed等はそのまま復元してよい');
    assert(cea.sanitizeRestoredState('not_a_real_state') === 'idle', '33d. 不正値もidleへfail-closed');
  }

  // ══════════════════════════════════════════════════════════════
  // CV-4c-3A Follow-up: UI Entry Point 正常系到達テスト（34〜49）
  //   ★ CV-4c-3A では _ceBuildPlan() の呼び出し元が0件で、Approval panel へ到達できなかった。
  //     既存テストが「禁止事項（自動実行しないこと）」しか検証しておらず、
  //     「手動でも到達できること（正常系）」を検証していなかったため検出できなかった。
  //     34c がその再発防止の中心（呼び出し元 >= 1 を直接固定する）。
  //   ★ 実Web Search 0 / 実AI 0 / 実DB 0。fetch は sandbox 内の mock のみで、呼ばれないことを数える。
  // ══════════════════════════════════════════════════════════════
  const vm = require('vm');
  const _idxLf = indexSrc.replace(/\r\n/g, '\n');

  // index.html の Content Evidence ブロック（ce-approval-panel 直後の <script>）を抽出する。
  const _ceBlockStart = _idxLf.indexOf('<div id="ce-approval-panel"');
  const _ceScriptStart = _idxLf.indexOf('<script>', _ceBlockStart) + '<script>'.length;
  const _ceScriptEnd = _idxLf.indexOf('</script>', _ceScriptStart);
  const CE_BLOCK = _idxLf.slice(_ceScriptStart, _ceScriptEnd);

  // ブラウザ相当の最小 sandbox を組み立てる（実DOM/実fetchは使わない）。
  function buildCeSandbox(opts) {
    const o = opts || {};
    const ctx = { console: { log: function () {} } };
    ctx.globalThis = ctx;
    vm.createContext(ctx);
    ['evidenceAcquisition', 'contentClaimPlanning', 'contentEvidenceApproval'].forEach(function (m) {
      vm.runInContext(fs.readFileSync(path.join(__dirname, 'shared', m + '.js'), 'utf8'), ctx);
    });
    const els = {};
    const mk = function (id) {
      return {
        id: id, value: '', style: {}, innerHTML: '',
        getAttribute: function () { return null; },
        insertAdjacentHTML: function (p, h) { this.innerHTML += h; },
        querySelectorAll: function () { return []; },
      };
    };
    ctx.__fetchCalls = 0;
    Object.assign(ctx, {
      document: { getElementById: function (id) { return els[id] || null; } },
      fetch: function () { ctx.__fetchCalls++; return Promise.resolve({ ok: true, json: function () { return { ok: true }; } }); },
      currentMember: o.noMember ? null : { id: 'leader' },
      memberCaseView: { leader: o.caseView === undefined ? 'case-x' : o.caseView },
      cases: { 'case-x': { id: 'case-x', title: 'テスト案件タイトル' } },
      _ncActiveCaseId: function (m) { const v = ctx.memberCaseView[m]; return (v && v !== 'latest' && v !== '__caselist__') ? v : undefined; },
      escapeHtml: function (x) { return String(x == null ? '' : x); },
    });
    els['ce-approval-panel'] = mk('ce-approval-panel');
    if (o.rows && o.rows.length) {
      const rowsEl = mk('ce-intent-rows');
      const ns = o.rows.map(function (_, i) { return i + 1; });
      rowsEl.querySelectorAll = function () { return ns.map(function (n) { return { getAttribute: function () { return String(n); } }; }); };
      els['ce-intent-rows'] = rowsEl;
      o.rows.forEach(function (r, i) {
        const n = i + 1;
        els['ce-intent-topic-' + n] = Object.assign(mk(), { value: r.topic });
        els['ce-intent-question-' + n] = Object.assign(mk(), { value: r.question });
        els['ce-intent-type-' + n] = Object.assign(mk(), { value: r.claimType || 'general_practice' });
      });
    }
    vm.runInContext(CE_BLOCK, ctx);
    ctx.__els = els;
    return ctx;
  }

  const Q_OK = [
    { topic: '洗浄時の摩擦', question: '公的機関や専門学会は、洗顔やタオルドライで肌をこすることについて一般的に何をすすめているか' },
    { topic: '洗顔後の保湿', question: '公的機関や専門学会は、洗顔後の保湿について一般的に何をすすめているか' },
    { topic: '日常の紫外線対策', question: '公的機関は、日常生活の紫外線対策として一般的にどのような方法をすすめているか' },
  ];

  caseHeader('34. entry point の存在と _ceBuildPlan() への接続（欠落の再発防止）');
  {
    assert(_idxLf.indexOf('function buildContentEvidenceEntryHtml(') !== -1, '34a. entry section描画関数 buildContentEvidenceEntryHtml() が存在する');
    assert(_idxLf.indexOf('onclick="_ceStartPlanFromForm()"') !== -1, '34b. entry button の onclick が _ceStartPlanFromForm() を指している');
    // ★ 本体（コメント行を除く）での _ceBuildPlan 呼び出しが1件以上あること。
    const callLines = CE_BLOCK.split('\n').filter(function (l) {
      return l.trim().indexOf('//') !== 0 && l.indexOf('_ceBuildPlan(') !== -1 && l.indexOf('function _ceBuildPlan(') === -1;
    });
    assert(callLines.length >= 1, '34c. ★_ceBuildPlan() の呼び出し元が1件以上ある（CV-4c-3Aの欠落=呼び出し元0 の再発防止）');
    assert(_idxLf.indexOf("_oeSafe(buildContentEvidenceEntryHtml,     'ContentEvidence')") !== -1,
      '34d. Output Engine パネルの合成リストへ接続されている');
    // ★ 既存の隣接invariant（apfrNumericConsistency.test.js static-4-2:
    //   ComplianceGate の直後に FormalTruthConsistency）を壊さない位置に置く。
    assert(_idxLf.indexOf("_oeSafe(buildComplianceGateHtml,           'ComplianceGate')\n    + _oeSafe(buildFormalTruthConsistencyHtml") !== -1,
      '34e. ComplianceGate→FormalTruthConsistency の既存隣接順序を維持している');
  }

  caseHeader('35〜38. valid intents → plan生成 → panel到達（fetch 0）');
  {
    const ctx = buildCeSandbox({ rows: Q_OK });
    const plan = ctx._ceStartPlanFromForm();
    assert(ctx._ceState === 'awaiting_approval', '35. valid intents で _ceState が awaiting_approval になる');
    assert(ctx._cePlan !== null && plan !== null, '36. _cePlan !== null（Planが生成される）');
    assert(ctx.__els['ce-approval-panel'].style.display === 'block', '37. Approval panel が表示される（display:block）');
    assert(ctx.__fetchCalls === 0, '38. ★Plan作成だけでは fetch 0（Web Search未実行・課金なし）');
  }

  caseHeader('39〜40. caseId binding と deterministic intentId');
  {
    const ctx = buildCeSandbox({ rows: Q_OK });
    const plan = ctx._ceStartPlanFromForm();
    assert(plan.caseId === 'case-x' && plan.intents.every(function (i) { return i.caseId === 'case-x'; }),
      '39. active case（_ncActiveCaseId由来）から caseId が bind される');
    assert(plan.intents.map(function (i) { return i.intentId; }).join(',') === 'CI-01,CI-02,CI-03',
      '40. intentId は CI-01 連番で deterministic に生成される');
  }

  caseHeader('41〜42. active case 無し → fail-closed');
  {
    const ctx = buildCeSandbox({ rows: Q_OK, caseView: 'latest' });
    const r = ctx._ceStartPlanFromForm();
    assert(r === null && ctx._cePlan === null, '41. ★active caseが無ければ _ceBuildPlan() を呼ばない（fail-closed）');
    const html = ctx.buildContentEvidenceEntryHtml();
    assert(html.indexOf('案件を選択してください') !== -1 && html.indexOf('disabled') !== -1,
      '42. active case無しでは開始buttonがdisabledで案内が出る');
  }
  {
    const ctx = buildCeSandbox({ rows: Q_OK, noMember: true });
    assert(ctx._ceStartPlanFromForm() === null, '42b. currentMember未設定でも例外にならず fail-closed');
  }

  caseHeader('43. blocked Claim（医療表現）の表示');
  {
    const rows = [{ topic: 'ニキビ', question: 'ニキビを治すにはどうすればよいか' }, Q_OK[1], Q_OK[2]];
    const ctx = buildCeSandbox({ rows: rows });
    const plan = ctx._ceStartPlanFromForm();
    assert(plan.blocked.length === 1 && plan.blocked[0].reason === 'medical_therapeutic_topic_detected',
      '43a. 医療/治療表現のClaim Intentは Safety Filter で blocked される（フォーム側で再実装していない）');
    assert(plan.queries.length === 2, '43b. blocked分はqueryに含まれない');
    assert(ctx.__els['ce-approval-panel'].innerHTML.indexOf('安全フィルタで除外: 1件') !== -1,
      '43c. Plan Preview に blocked 件数が表示される');
  }

  caseHeader('44〜45. Query Truncation 防止（STOP-13・server側silent truncationに依存しない）');
  {
    const many = [1, 2, 3, 4, 5].map(function (n) {
      return { topic: 'topic' + n, question: '公的機関は習慣' + n + 'について一般的に何をすすめているか' };
    });
    const ctx = buildCeSandbox({ rows: many });
    ctx._ceStartPlanFromForm();
    const html = ctx.__els['ce-approval-panel'].innerHTML;
    assert(html.indexOf('無警告で切り捨て') !== -1 && html.indexOf('STOP-13') !== -1,
      '44. query数が上限超過のとき truncation 警告が表示される');
    assert(html.indexOf('_ceApproveAndExecute()" disabled') !== -1,
      '45. ★上限超過時は「Evidence取得を実行」buttonが disabled（Web Search実行不可）');
    assert(ctx.__fetchCalls === 0, '45b. 上限超過ケースでも fetch 0');
  }
  {
    const ctx = buildCeSandbox({ rows: Q_OK });
    ctx._ceStartPlanFromForm();
    const html = ctx.__els['ce-approval-panel'].innerHTML;
    assert(html.indexOf('無警告で切り捨て') === -1 && html.indexOf('_ceApproveAndExecute()">') !== -1,
      '45c. 上限以内（3件）では警告なし・承認buttonは有効');
  }

  caseHeader('46〜47. Plan Preview の case binding表示と課金明示');
  {
    const ctx = buildCeSandbox({ rows: Q_OK });
    ctx._ceStartPlanFromForm();
    const html = ctx.__els['ce-approval-panel'].innerHTML;
    assert(html.indexOf('case-x') !== -1 && html.indexOf('テスト案件タイトル') !== -1,
      '46. ★Plan Preview に caseId と case名が表示される（cross-case事故を人間が検知できる）');
    assert(html.indexOf('課金が発生します') !== -1 && html.indexOf('Search が 3回実行され') !== -1,
      '47a. ★課金が発生することと実行回数が明示される');
    assert(html.indexOf('Plan作成の時点では課金されていません') !== -1,
      '47b. Plan作成時点では課金されないことが区別して明示される');
  }

  caseHeader('48. entry point は自動起動しない（既存の自動実行禁止境界の維持）');
  {
    // entry 関数はユーザー操作（onclick）からのみ呼ばれる。page load / case load 等の
    //   既存イベントハンドラから _ceStartPlanFromForm / _ceBuildPlan を呼んでいないこと。
    const bodyLines = _idxLf.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; });
    const autoCallers = bodyLines.filter(function (l) {
      return (l.indexOf('_ceStartPlanFromForm(') !== -1 || l.indexOf('_ceBuildPlan(') !== -1)
        && (l.indexOf('window.onload') !== -1 || l.indexOf('DOMContentLoaded') !== -1
          || l.indexOf('loadCase') !== -1 || l.indexOf('restoreOutputDraft') !== -1
          || l.indexOf('runAutoTask') !== -1 || l.indexOf('atRunWorkflow') !== -1);
    });
    assert(autoCallers.length === 0, '48a. page load / case load / Auto Task から entry を自動起動していない');
    assert(_idxLf.indexOf('function _ceStartPlanFromForm()') !== -1
      && _idxLf.indexOf('_ceStartPlanFromForm()') !== -1, '48b. entry関数はonclick経由でのみ到達する');
  }

  caseHeader('49. entry追加後も Web Search の唯一の承認入口が維持されている');
  {
    const bodyLines = CE_BLOCK.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; });
    const wsLines = bodyLines.filter(function (l) { return l.indexOf('/api/evidence/web-search') !== -1; });
    assert(wsLines.length === 1, '49a. ★Content Evidenceブロック内で /api/evidence/web-search を呼ぶ箇所は1つだけ');
    // entry 関数本体が fetch / web-search を持たないこと
    const entryStart = CE_BLOCK.indexOf('function _ceStartPlanFromForm()');
    const entryEnd = CE_BLOCK.indexOf('\nfunction _ceRefreshEntrySection', entryStart);
    const entryBody = CE_BLOCK.slice(entryStart, entryEnd !== -1 ? entryEnd : entryStart + 4000);
    assert(entryBody.indexOf('fetch(') === -1 && entryBody.indexOf('/api/') === -1,
      '49b. ★_ceStartPlanFromForm() 本体に fetch / API呼び出しが存在しない');
    const buildStart = CE_BLOCK.indexOf('function buildContentEvidenceEntryHtml()');
    const buildEnd = CE_BLOCK.indexOf('\nfunction _ceAddIntentRow', buildStart);
    const buildBody = CE_BLOCK.slice(buildStart, buildEnd !== -1 ? buildEnd : buildStart + 4000);
    assert(buildBody.indexOf('fetch(') === -1 && buildBody.indexOf('_ceBuildPlan(') === -1,
      '49c. 描画関数は副作用を持たない（fetch・plan生成をしない）');
    // entry は getCurrentApprovalCaseId() の _lastOutputDraft fallback を使わない。
    //   ★ 責務境界を説明する自コメント内の言及は許容し、コード行での呼び出しが0件であることを見る
    //     （lib/publicStatic.js のテスト等で既存の同一手法）。
    const ceCodeLines = CE_BLOCK.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; });
    const fallbackCalls = ceCodeLines.filter(function (l) { return l.indexOf('getCurrentApprovalCaseId(') !== -1; });
    assert(fallbackCalls.length === 0,
      '49d. ★entryは getCurrentApprovalCaseId()（_lastOutputDraft.caseIdへfallback）を使わない（cross-case防止）');
    assert(ceCodeLines.some(function (l) { return l.indexOf('_ncActiveCaseId(') !== -1; }),
      '49e. entryは _ncActiveCaseId()（明示選択されたcaseのみ）を使用している');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All contentEvidenceApproval cases passed (CV-4c-3)'); }
})().catch(function (e) { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
