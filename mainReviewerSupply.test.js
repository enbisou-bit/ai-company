'use strict';
// mainReviewerSupply.test.js
// Issue A / Option D: main-task Reviewer → Leader Final 供給 の回帰テスト。
// 実AI API呼び出し0件 / DB変更なし / 実案件への操作0。
//
//   確定済みRoot Cause（Path A実AI E2Eで3回連続観測）:
//     Auto Taskの担当行として実行されるReviewer（at-task-3）は workflowTasks.map() 生成物で
//     isPostProcess を持たない（undefined）。そのため既存の
//       find(t => t.agentId==='reviewer' && t.isPostProcess)
//     にマッチせず、reviewerText は常に at-postprocess-reviewer だけを指していた。
//     結果、停止判断を出した main-task Reviewer の本文は memberReplies に埋もれ、
//     LEADER_FINAL_REVIEWER_REJECT_RULE の対象外だった。
//
//   Option D（今回）:
//     main-task Reviewer を新変数 mainReviewerTask として取得し、
//     Leader Final の question へ専用ラベルで追加供給するだけ。
//     deterministic block / 停止語判定 / Enforcement は一切追加しない
//     （Reviewer停止の無条件block化は、商品成分等がFormal Truthに存在しない案件を永久blockするため）。

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log(`  ✅ ${label}`); }
  else { _failed++; console.log(`  ❌ ${label}`); }
}
function caseHeader(t) { console.log(`\n── ${t} ──`); }

const ocSrc = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const svSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

// ── 実装と同一の取得条件を合成再現（判定基準を新規に作らない） ──────────
function findMainReviewerTask(workflowTasks) {
  return (workflowTasks || []).find(function (t) {
    return t && t.agentId === 'reviewer' && !t.isPostProcess && t.status === 'completed' && t.result;
  });
}
function findPostProcessReviewerTask(workflowTasks) {
  return (workflowTasks || []).find(function (t) { return t.agentId === 'reviewer' && t.isPostProcess; });
}
const LEADER_FINAL_POSTPROCESS_TEXT_MAX = 1200;

// ── 実E2E相当の workflowTasks fixture ────────────────────────────
const MAIN_REVIEWER_TEXT = 'Reviewer担当です。現時点での判断に重要な情報が不足しているため、確認が必要です。【現状仮説】①【CASE CONTEXT】に保存されている商品Formal Truthが成分・配合・効能・効果・適用肌質の具体的な情報を保有していない可能性があります。';
const POST_REVIEWER_TEXT = 'Reviewer（後処理）です。①抜け漏れ：特になし ②品質：概ね良好 ③改善提案：広告開示位置の明確化。';
function mkTasks(opts) {
  opts = opts || {};
  return [
    { id: 'at-task-1', agentId: 'sns', status: 'completed', result: 'SNS案です。' },                       // isPostProcess なし
    { id: 'at-task-2', agentId: 'writer', status: 'completed', result: 'Writer案です。' },
    { id: 'at-task-3', agentId: 'reviewer', status: opts.mainStatus || 'completed', result: opts.mainResult !== undefined ? opts.mainResult : MAIN_REVIEWER_TEXT },
    { id: 'at-task-4', agentId: 'strategy', status: 'completed', result: 'Strategy案です。' },
    { id: 'at-postprocess-reviewer', agentId: 'reviewer', status: 'completed', result: POST_REVIEWER_TEXT, isPostProcess: true },
    { id: 'at-postprocess-strategy', agentId: 'strategy', status: 'completed', result: 'Strategy統合提言です。', isPostProcess: true },
  ];
}

console.log('Issue A / Option D: main-task Reviewer → Leader Final 供給 回帰テスト（実AI API 0件・DB変更0）');

// ══════════════════════════════════════════════════════════════
caseHeader('1. main-task Reviewerを取得できる');
{
  const t = findMainReviewerTask(mkTasks());
  assert(!!t, '1-1. main-task Reviewerが取得できる');
  assert(t.id === 'at-task-3', '1-2. 取得されるのは at-task-3（main task）');
  assert(t.result === MAIN_REVIEWER_TEXT, '1-3. main-task Reviewerのresultを保持している');
  // 実装が存在すること
  assert(ocSrc.indexOf('const mainReviewerTask = (workflowTasks || []).find(function(t) {') !== -1, '1-4. mainReviewerTask取得の実装が存在する');
  assert(ocSrc.indexOf("return t && t.agentId === 'reviewer' && !t.isPostProcess && t.status === 'completed' && t.result;") !== -1,
    '1-5. 取得条件（reviewer / !isPostProcess / completed / result有）が実装されている');
}

caseHeader('2. post-process Reviewerと区別される');
{
  const tasks = mkTasks();
  const main = findMainReviewerTask(tasks);
  const post = findPostProcessReviewerTask(tasks);
  assert(main.id === 'at-task-3' && post.id === 'at-postprocess-reviewer', '2-1. 別インスタンスとして取得される');
  assert(main.result !== post.result, '2-2. 本文も別（統合していない）');
  assert(main !== post, '2-3. 同一オブジェクトへ置換していない');
  // 既存の reviewerTask / strategyTask 取得行は1文字も変更していない
  assert(ocSrc.indexOf("const reviewerTask = (workflowTasks || []).find(function(t) { return t.agentId === 'reviewer' && t.isPostProcess; });") !== -1,
    '2-4. 既存 reviewerTask 取得行は無変更');
  assert(ocSrc.indexOf("const strategyTask = (workflowTasks || []).find(function(t) { return t.agentId === 'strategy' && t.isPostProcess; });") !== -1,
    '2-5. 既存 strategyTask 取得行は無変更');
}

caseHeader('3. isPostProcess === undefined のmain taskも取得可能');
{
  const tasks = mkTasks();
  const mainRow = tasks.find(function (t) { return t.id === 'at-task-3'; });
  assert(mainRow.isPostProcess === undefined, '3-1. 前提: main taskは isPostProcess を持たない（undefined）');
  assert(!!findMainReviewerTask(tasks), '3-2. undefined でも取得できる（!undefined === true）');
  // 明示 false でも取得できる
  const explicitFalse = mkTasks().map(function (t) { return t.id === 'at-task-3' ? Object.assign({}, t, { isPostProcess: false }) : t; });
  assert(!!findMainReviewerTask(explicitFalse), '3-3. isPostProcess:false でも取得できる');
  // これが従来の取得条件では取れなかったことを固定（バグの再現）
  const legacy = mkTasks().filter(function (t) { return t.id !== 'at-postprocess-reviewer'; });
  assert(findPostProcessReviewerTask(legacy) === undefined, '3-4. 従来条件ではmain-task Reviewerを取得できない（Root Cause再現）');
}

caseHeader('4. completedのみ対象');
{
  assert(findMainReviewerTask(mkTasks({ mainStatus: 'running' })) === undefined, '4-1. running は対象外');
  assert(findMainReviewerTask(mkTasks({ mainStatus: 'error' })) === undefined, '4-2. error は対象外');
  assert(findMainReviewerTask(mkTasks({ mainStatus: 'skipped' })) === undefined, '4-3. skipped は対象外');
  assert(findMainReviewerTask(mkTasks({ mainResult: null })) === undefined, '4-4. result が null は対象外');
  assert(findMainReviewerTask(mkTasks({ mainResult: '' })) === undefined, '4-5. result が空文字は対象外');
  assert(findMainReviewerTask([]) === undefined, '4-6. 空配列でも例外を出さない');
  assert(findMainReviewerTask(null) === undefined, '4-7. null でも例外を出さない（fail-open）');
}

caseHeader('5. mainReviewerTextが生成される');
{
  assert(ocSrc.indexOf('var mainReviewerText = (mainReviewerTask && mainReviewerTask.result)') !== -1, '5-1. mainReviewerText の生成実装が存在する');
  assert(ocSrc.indexOf('? _extractReply(_atDeliverableText(mainReviewerTask)).slice(0, LEADER_FINAL_POSTPROCESS_TEXT_MAX) : \'\';') !== -1,
    '5-2. 既存の本文抽出helper（_atDeliverableText / _extractReply）を再利用している');
  // mainReviewerTask が無い場合は空文字（fail-open）
  const idx = ocSrc.indexOf('var mainReviewerText =');
  const seg = ocSrc.slice(idx, idx + 260);
  assert(seg.indexOf(": ''") !== -1, '5-3. 取得できない場合は空文字（既存reviewerTextと同一のfail-open）');
}

caseHeader('6. 文字数上限が機能する');
{
  assert(ocSrc.indexOf('LEADER_FINAL_POSTPROCESS_TEXT_MAX') !== -1, '6-1. 既存の上限定数を使用している（新規定数を作っていない）');
  assert(ocSrc.indexOf('var LEADER_FINAL_POSTPROCESS_TEXT_MAX = 1200;') !== -1, '6-2. 上限は既存の1200（reviewerText / strategyText と同値）');
  const long = 'あ'.repeat(5000);
  assert(long.slice(0, LEADER_FINAL_POSTPROCESS_TEXT_MAX).length === 1200, '6-3. 1200文字で切り詰められる');
  const short = 'テスト';
  assert(short.slice(0, LEADER_FINAL_POSTPROCESS_TEXT_MAX) === short, '6-4. 上限未満はそのまま');
  // memberReplies の1200文字も無変更
  assert(ocSrc.indexOf('reply.slice(0, 1200)') !== -1, '6-5. memberReplies の1200文字は無変更');
}

caseHeader('7. Leader Final questionに専用ラベルが入る');
{
  const LABEL = '【Reviewer（品質レビュー担当）の作業中レビュー】';
  assert(ocSrc.indexOf(LABEL) !== -1, '7-1. 専用ラベルが実装されている');
  const cnt = ocSrc.split("mainReviewerText ? '" + LABEL + "\\n' + mainReviewerText : ''").length - 1;
  assert(cnt === 2, '7-2. 通常分岐とIADP分岐の両方へ追加されている（実際: ' + cnt + '）');
  assert(LABEL !== '【Reviewerの品質フィードバック】', '7-3. post-process Reviewerのラベルとは別文字列');
  // memberReplies の横並びラベルとも別
  assert(ocSrc.indexOf("'【' + r.name + '】\\n' + r.reply") !== -1, '7-4. memberReplies のラベル形式は無変更');
}

caseHeader('8. main Reviewer本文が入る');
{
  const LABEL = '【Reviewer（品質レビュー担当）の作業中レビュー】';
  // 通常分岐（parts配列）で mainReviewerText が reviewerText より前に置かれている
  const partsIdx = ocSrc.indexOf("mainReviewerText ? '" + LABEL);
  const revIdx = ocSrc.indexOf("reviewerText ? '【Reviewerの品質フィードバック】", partsIdx);
  assert(partsIdx !== -1 && revIdx > partsIdx, '8-1. mainReviewerText は reviewerText より前に配置される');
  // 条件付き（空なら行を出さない＝fail-open）
  assert(ocSrc.indexOf("mainReviewerText ? '" + LABEL + "\\n' + mainReviewerText : ''") !== -1,
    '8-2. mainReviewerText が空のときは行自体を出さない（既存と同一パターン）');
}

caseHeader('9. existing reviewerText も維持される');
{
  assert(ocSrc.indexOf("var reviewerText = (reviewerTask && reviewerTask.result) ? reviewerTask.result.slice(0, LEADER_FINAL_POSTPROCESS_TEXT_MAX) : '';") !== -1,
    '9-1. reviewerText の生成は無変更');
  assert(ocSrc.indexOf("reviewerText ? '【Reviewerの品質フィードバック】\\n' + reviewerText : ''") !== -1, '9-2. reviewerText の question 追加は無変更');
  assert(ocSrc.indexOf('var LEADER_FINAL_REVIEWER_REJECT_RULE = [') !== -1, '9-3. LEADER_FINAL_REVIEWER_REJECT_RULE は維持');
  // reject遵守Contractの発火条件へ mainReviewerText も含める（Ruleの対象と実際のReviewerを一致させる）
  assert(ocSrc.indexOf("(reviewerText || mainReviewerText) ? LEADER_FINAL_REVIEWER_REJECT_RULE : ''") !== -1,
    '9-4. reject遵守Contractは reviewerText または mainReviewerText がある場合に付加される');
  assert(ocSrc.indexOf("reviewerText ? LEADER_FINAL_REVIEWER_REJECT_RULE : ''") === -1, '9-5. 旧発火条件（reviewerTextのみ）が残っていない');
}

caseHeader('10. Strategy text も維持される');
{
  assert(ocSrc.indexOf("var strategyText = (strategyTask && strategyTask.result) ? strategyTask.result.slice(0, LEADER_FINAL_POSTPROCESS_TEXT_MAX) : '';") !== -1,
    '10-1. strategyText の生成は無変更');
  assert(ocSrc.indexOf("strategyText ? '【Strategyの統合提言】\\n' + strategyText : ''") !== -1, '10-2. strategyText の question 追加は無変更');
  // Strategy override 権限（buildStrategyConsolidatePrompt の caseContextRule）は無変更
  assert(ocSrc.indexOf('正式値を優先し、その担当の指摘を採用しないでください。') !== -1, '10-3. Strategy override を許可する caseContextRule は維持');
  assert(ocSrc.indexOf('function buildStrategyConsolidatePrompt(hasCaseContext = false) {') !== -1, '10-4. buildStrategyConsolidatePrompt シグネチャ無変更');
}

caseHeader('11. memberReplies構造は変更しない');
{
  assert(ocSrc.indexOf('const memberReplies = mainTasks.map(function(t) {') !== -1, '11-1. memberReplies の生成方法は無変更');
  assert(ocSrc.indexOf("return { id: t.agentId, name: profile ? profile.name : t.agentId, reply: reply.slice(0, 1200) };") !== -1,
    '11-2. memberReplies の要素shapeは無変更');
  assert(ocSrc.indexOf("return t.status === 'completed' && t.result && !t.isPostProcess;") !== -1, '11-3. mainTasks の抽出条件は無変更');
  // main-task Reviewer は memberReplies にも引き続き含まれる（除外していない）
  const tasks = mkTasks();
  const mainTasks = tasks.filter(function (t) { return t.status === 'completed' && t.result && !t.isPostProcess; });
  assert(mainTasks.some(function (t) { return t.agentId === 'reviewer'; }), '11-4. main-task Reviewer は memberReplies 対象から除外されていない');
  assert(mainTasks.length === 4, '11-5. mainTasks 件数は従来どおり（sns/writer/reviewer/strategy）');
}

caseHeader('12. reviewerSignal は null 維持 / Rule Engine byte一致');
{
  const reNow = fs.readFileSync(path.join(__dirname, 'shared', 'leaderRuleEngine.js'), 'utf8');
  const reHead = cp.execSync('git show HEAD:shared/leaderRuleEngine.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 10 }).toString('utf8');
  assert(reNow === reHead, '12-1. shared/leaderRuleEngine.js がHEADと完全一致（Rule Engine変更0）');
  assert(reNow.indexOf('reviewerSignal: null, // v1: 常にnull（既存NGキーワードは使用しない）') !== -1, '12-2. reviewerSignal は null 固定のまま');
  assert(ocSrc.indexOf('reviewerSignal') === -1, '12-3. openaiClient.js に reviewerSignal 実装なし');
  assert(indexSrc.indexOf('reviewerSignal') === -1, '12-4. index.html に reviewerSignal 実装なし');
}

caseHeader('13. deterministic enforcement を追加していない');
{
  const idx = ocSrc.indexOf('const mainReviewerTask');
  const seg = ocSrc.slice(idx, idx + 3000);
  ['停止', '公開不可', '修正必須', '前進不可', '進行禁止', '差し戻し'].forEach(function (w, i) {
    // 停止語を「判定に使う」コードが無いこと（indexOf/test/match/includes と組み合わせていない）
    const bad = new RegExp('(indexOf|includes|test|match)\\s*\\(\\s*[\'"`]' + w);
    assert(!bad.test(seg), '13-' + (1 + i) + '. 停止語「' + w + '」のsubstring/regex判定を追加していない');
  });
  assert(seg.indexOf('blocked') === -1, '13-7. blocked フラグを新設していない');
  // 既存Enforcement群は無変更
  assert(indexSrc.indexOf('var canApprove = _mapAllChecked() && _mapReviewApproved(mai) && !_mapCompliance.blocked;') !== -1, '13-8. Mobile Approval canApprove 無変更');
  const qgStart = indexSrc.indexOf('function evaluateQualityGate(packageQuality) {');
  const qgBody = indexSrc.slice(qgStart, indexSrc.indexOf('\n}\n', qgStart));
  assert(qgBody.indexOf('QUALITY_GATE_PASSING_STATUSES.indexOf(sourceStatus)') !== -1, '13-9. Quality Gate 無変更');
  assert(indexSrc.indexOf('_lastOutputDraft.status    = noCompletedResults ? OUTPUT_STATUS.ERROR : OUTPUT_STATUS.READY;') !== -1, '13-10. READY判定 無変更');
}

caseHeader('14. Issue B / listingNgWords / その他既存Contract 非変更');
{
  const idxHead = cp.execSync('git show HEAD:index.html', { cwd: __dirname, maxBuffer: 1024 * 1024 * 30 }).toString('utf8');
  assert(indexSrc === idxHead, '14-1. index.html がHEADと完全一致（今回の変更対象外）');
  const svHead = cp.execSync('git show HEAD:server.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 30 }).toString('utf8');
  assert(svSrc === svHead, '14-2. server.js がHEADと完全一致（Issue B Option E 非変更）');
  const clNow = fs.readFileSync(path.join(__dirname, 'claudeClient.js'), 'utf8');
  const clHead = cp.execSync('git show HEAD:claudeClient.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 20 }).toString('utf8');
  assert(clNow === clHead, '14-3. claudeClient.js がHEADと完全一致（変更0）');
  // Issue B Option B（formalTruthRule の IADP Scope Boundary）は維持
  assert(ocSrc.indexOf('対象商品の事実へ意味変換すること') !== -1, '14-4. IADP Scope Boundary（Option B）は維持');
  assert(ocSrc.indexOf('禁止するのは商品の事実への意味変換だけです') !== -1, '14-5. Scope Boundary の許可範囲も維持');
  // listingNgWords Channel Scope（c35b534）は index.html 側・上記14-1で担保済み
  assert(indexSrc.indexOf("const APFR_LISTING_AD_ONLY_FIELDS = ['listingNgWords'];") !== -1, '14-6. listingNgWords Channel Scope 維持');
  assert(indexSrc.indexOf('if (!_lastOutputDraft.caseId && _atRunCaseId) _lastOutputDraft.caseId = _atRunCaseId;') !== -1, '14-7. P1-1 caseId Binding 維持');
  // LEADER_FINAL_PROMPT 定数は無変更
  function extractConst(s, name) {
    const st = s.indexOf('const ' + name + ' = [');
    if (st === -1) return null;
    const en = s.indexOf('\n].join', st);
    return s.slice(st, en !== -1 ? en : st + 3000);
  }
  const ocHead = cp.execSync('git show HEAD:openaiClient.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 30 }).toString('utf8');
  assert(extractConst(ocSrc, 'LEADER_FINAL_PROMPT') === extractConst(ocHead, 'LEADER_FINAL_PROMPT'), '14-8. LEADER_FINAL_PROMPT 無変更');
  assert(extractConst(ocSrc, 'ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT') === extractConst(ocHead, 'ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT'), '14-9. ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT 無変更');
}

console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All Issue A Option D cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
