'use strict';
// iadpScopeBoundary.test.js
// Issue B: IADP Scope Boundary（Option E + Option B）回帰テスト。
// 実AI API呼び出し0件 / DB変更なし / 実案件への操作0。
//
//   Root Cause（実AI Path A E2Eで実測）:
//     server.js _leaderCaseContextToText() が IADP の brandConcept / account.bio を
//     【CASE CONTEXT｜…（Formal Truth）】ヘッダ下へフラットに列挙していたため、
//     AI社員が「自然由来」（＝アカウントのブランドコンセプト）を対象商品の成分・特性の事実として
//     転用する Class C（意味誤用）が発生した。値は CASE CONTEXT に実在するため、
//     既存 formalTruthRule の「記載のない情報を断定しない」では防げなかった。
//
//   修正:
//     Option E … server.js: IADP 値へ用途境界の見出しを付与（値・schema・順序は不変）
//     Option B … openaiClient.js: _buildFormalTruthRuleText() の【絶対禁止】へ IADP Scope Boundary を追加
//                （単一ソースのため SNS/Writer/Reviewer/Strategy と Leader Final の全Agentへ同時に効く）
//
//   非対象（今回変更しない）: Issue A（Reviewer→Leader Final Enforcement）／C-3-1 Grounding Detector／
//     listingNgWords Channel Scope（c35b534）／Class B 専用の新規仕組み。

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log(`  ✅ ${label}`); }
  else { _failed++; console.log(`  ❌ ${label}`); }
}
function caseHeader(t) { console.log(`\n── ${t} ──`); }

const svSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
const ocSrc = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
const indexSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');

// ── server.js の _leaderCaseContextToText() を実ソースから取り出して実行する ──
//   （純関数・DB/ネットワーク非依存。合成再現ではなく実装そのものを検証する）
function loadLccFn() {
  const i = svSrc.indexOf('function _leaderCaseContextToText');
  const j = svSrc.indexOf('\n}\n', i);
  return eval('(' + svSrc.slice(i, j + 2) + ')');
}
const _leaderCaseContextToText = loadLccFn();

// ── openaiClient.js の _buildFormalTruthRuleText() を実ソースから取り出して実行する ──
function loadRuleFn() {
  const i = ocSrc.indexOf('function _buildFormalTruthRuleText');
  const j = ocSrc.indexOf('\n}\n', i);
  return eval('(' + ocSrc.slice(i, j + 2) + ')');
}
const _buildFormalTruthRuleText = loadRuleFn();

// ── 実案件（プラファスト / ナチュラルエッセンス）相当 fixture ──────────
const REAL_CC = {
  iadp: {
    packageId: 'iadp_1787060839814_izhakb',
    adoptedCandidateId: 'c1',
    adoptedGenre: '健康・美容',
    accountName: 'ナチュラルエッセンス',
    username: 'natural_essence',
    bio: '自然由来の美容と健康情報を専門的に発信。顔出し・声出しなしで信頼を築く資料・比較重視のアカウントです。',
    brandConcept: '自然由来の美容と健康を専門的に伝える情報プラットフォーム',
    target: '30代〜40代女性',
  },
  evidence: { status: 'sufficient', verifiedCount: 8, independentSourceCount: 3, totalCount: 9 },
  qualityGate: { executed: true, passed: true, status: 'passed', sourceStatus: 'complete' },
  assessment: { accountCreationReadiness: 'conditional', userApproval: 'approved' },
};

const IADP_HEADING = '■ アカウント設計（IADP｜運用する媒体アカウント側の設計・方針です。対象商品の成分・効能・効果・適性・品質・実施中のキャンペーンや特典といった商品事実ではありません）';

console.log('Issue B: IADP Scope Boundary（Option E + B）回帰テスト（実AI API 0件・DB変更0）');

// ══════════════════════════════════════════════════════════════
caseHeader('1. IADPがアカウント設計として明示される（Option E）');
{
  const txt = _leaderCaseContextToText(REAL_CC);
  assert(txt.indexOf(IADP_HEADING) !== -1, '1-1. IADP用途境界の見出しが出力される');
  assert(txt.indexOf('アカウント設計') !== -1, '1-2. 「アカウント設計」と明示される');
  assert(txt.indexOf('運用する媒体アカウント側の設計・方針') !== -1, '1-3. 媒体運用方針であることが明示される');
  // 見出しは IADP 値の直前に来る（Evidence 等の非IADP行より前）
  const hi = txt.indexOf(IADP_HEADING);
  assert(hi < txt.indexOf('ブランドコンセプト:'), '1-4. 見出しはIADP値より前に置かれる');
  assert(hi < txt.indexOf('Profile Bio:'), '1-5. 見出しはProfile Bioより前に置かれる');
  assert(txt.indexOf('Evidence Status:') > txt.indexOf('ターゲット:'), '1-6. 非IADPの機械判定値はIADPブロックの後に並ぶ（既存順序を維持）');
}

caseHeader('2. IADPは商品事実ではない旨が含まれる');
{
  const txt = _leaderCaseContextToText(REAL_CC);
  assert(txt.indexOf('商品事実ではありません') !== -1, '2-1. 「商品事実ではありません」と明示される');
  assert(txt.indexOf('成分') !== -1 && txt.indexOf('効能') !== -1 && txt.indexOf('効果') !== -1, '2-2. 成分・効能・効果が非該当として列挙される');
  assert(txt.indexOf('適性') !== -1, '2-3. 適性が非該当として列挙される');
  assert(txt.indexOf('キャンペーン') !== -1 && txt.indexOf('特典') !== -1, '2-4. キャンペーン・特典が非該当として列挙される');
}

caseHeader('3. brandConcept / bio の既存値は保持される（値・schema無変更）');
{
  const txt = _leaderCaseContextToText(REAL_CC);
  assert(txt.indexOf('ブランドコンセプト: ' + REAL_CC.iadp.brandConcept) !== -1, '3-1. brandConceptの値がそのまま出力される');
  assert(txt.indexOf('Profile Bio: ' + REAL_CC.iadp.bio) !== -1, '3-2. bioの値がそのまま出力される');
  assert(txt.indexOf('表示名: ナチュラルエッセンス／ユーザー名候補: natural_essence') !== -1, '3-3. accountName/usernameの行が既存形式のまま');
  assert(txt.indexOf('採用候補ID: c1／採用ジャンル: 健康・美容') !== -1, '3-4. 採用候補ID/ジャンル行が既存形式のまま');
  assert(txt.indexOf('ターゲット: 30代〜40代女性') !== -1, '3-5. targetの値がそのまま出力される');
  assert(txt.indexOf('IADP Package ID: iadp_1787060839814_izhakb') !== -1, '3-6. packageIdがそのまま出力される');

  // 出力行数 = 既存行数 + 見出し1行のみ（AIへ渡す値の件数は不変）
  const lines = txt.split('\n');
  assert(lines[0].indexOf('【CASE CONTEXT｜') === 0, '3-7. 既存の最上位ヘッダは不変');
  assert(lines.filter(function (l) { return l.indexOf('■ ') === 0; }).length === 1, '3-8. 追加された見出しは1本のみ');

  // server.js 側の実装が値を書き換えていないこと（schema変更0）
  assert(svSrc.indexOf('bio: account.bio || null,') !== -1, '3-9. buildLeaderCaseContext()のbio取得は無変更');
  assert(svSrc.indexOf('brandConcept: brand.brandConcept || null,') !== -1, '3-10. brandConcept取得は無変更');
}

caseHeader('4〜7. IADPの商品事実への転用を禁止（Option B・全Agent共通ルール）');
{
  const rule = _buildFormalTruthRuleText(true);
  assert(rule.indexOf('■ アカウント設計（IADP）') !== -1, '4-1. ルールがIADPブロックを名指ししている');
  assert(rule.indexOf('対象商品の事実へ意味変換すること') !== -1, '4-2. 意味変換の禁止が【絶対禁止】として明記される');
  // 4: 成分
  assert(rule.indexOf('成分') !== -1 && rule.indexOf('配合') !== -1, '4-3. 商品成分・配合への転用を禁止');
  assert(rule.indexOf('「自然由来の成分を配合している」と書いてはいけません') !== -1, '4-4. brandConcept/bioの「自然由来」を成分事実へ転用する具体例を禁止');
  // 5: 効能・効果
  assert(rule.indexOf('効能') !== -1 && rule.indexOf('効果') !== -1, '5-1. 商品効能・効果への転用を禁止');
  // 6: 適性
  assert(rule.indexOf('適性（肌質・体質等）') !== -1, '6-1. 商品適性への転用を禁止');
  assert(rule.indexOf('特定の肌質・体質に適していると書いてはいけません') !== -1, '6-2. ターゲット記述を適性事実へ転用する具体例を禁止');
  // 7: キャンペーン・特典
  assert(rule.indexOf('実施中のキャンペーン・特典の存在を示す事実ではありません') !== -1, '7-1. 実施中キャンペーン・特典への転用を禁止');
  // 対象fieldの列挙
  ['表示名', 'ユーザー名候補', 'Profile Bio', 'ブランドコンセプト', 'ターゲット', '採用ジャンル'].forEach(function (f, i) {
    assert(rule.indexOf(f) !== -1, '7-' + (2 + i) + '. 対象fieldとして「' + f + '」が列挙される');
  });
}

caseHeader('8. アカウント説明としての利用は禁止していない（過剰禁止の回避）');
{
  const rule = _buildFormalTruthRuleText(true);
  assert(rule.indexOf('アカウント自体の説明・世界観・投稿トーンとしてこれらの値を使うことは禁止していません') !== -1,
    '8-1. アカウント説明としての利用が明示的に許可されている');
  assert(rule.indexOf('「自然由来の美容と健康情報を発信するアカウントです」はアカウントの説明であり適切です') !== -1,
    '8-2. 許可される具体例が示されている');
  assert(rule.indexOf('禁止するのは商品の事実への意味変換だけです') !== -1, '8-3. 禁止範囲が意味変換に限定されている');
}

caseHeader('9. 全Agent共通 Formal Truth Rule から利用される（単一ソース）');
{
  // buildSystemPrompt が formalTruthRule を単一ソースから取得している（Option F既存Contractの維持）
  assert(ocSrc.indexOf('const formalTruthRule = _buildFormalTruthRuleText(hasCaseContext);') !== -1,
    '9-1. buildSystemPrompt()が_buildFormalTruthRuleText()を呼ぶ（SNS/Writer/Reviewer/Strategy）');
  const defCount = (ocSrc.match(/function _buildFormalTruthRuleText\(hasCaseContext\)/g) || []).length;
  assert(defCount === 1, '9-2. _buildFormalTruthRuleText()の定義は1箇所のみ（Agentごとの重複ルールを作っていない）');
  // Scope Boundary 文言が定義1箇所にしか存在しない＝重複追加していない
  const occ = ocSrc.split('対象商品の事実へ意味変換すること').length - 1;
  assert(occ === 1, '9-3. Scope Boundary本文はソース内に1箇所のみ（重複記述なし・実際: ' + occ + '）');
  // caseContextは全main agentのinstructionへ連結される（既存経路）
  assert(ocSrc.indexOf('const fullInstruction = caseContext ? `${baseInstruction}\\n\\n${caseContext}` : baseInstruction;') !== -1,
    '9-4. 全main担当のinstructionへcaseContextが連結される既存経路が維持されている');
}

caseHeader('10. Leader Finalにも同一ルールが到達する');
{
  assert(ocSrc.indexOf("_buildFormalTruthRuleText(true), // Writer/Researcher/Reviewer/Strategyと同一ソース") !== -1,
    '10-1. _buildLeaderFinalGroundingBlock()が同一ソースを再利用している');
  // 実際に Leader Final 用ブロックへ Scope Boundary が含まれることを実行して確認
  const i = ocSrc.indexOf('function _buildLeaderFinalGroundingBlock');
  const j = ocSrc.indexOf('\n}\n', i);
  const fn = eval('(' + ocSrc.slice(i, j + 2) + ')');
  const block = fn('【CASE CONTEXT】\n' + IADP_HEADING + '\nブランドコンセプト: 自然由来の…', { informationInsufficient: { count: 0, memberIds: [], allInsufficient: false } });
  assert(block.indexOf('対象商品の事実へ意味変換すること') !== -1, '10-2. Leader Final Grounding BlockにScope Boundaryが含まれる');
  assert(block.indexOf('■ アカウント設計（IADP）') !== -1, '10-3. Leader FinalへIADPブロックの名指しが届く');
  assert(block.indexOf('禁止するのは商品の事実への意味変換だけです') !== -1, '10-4. 許可範囲もLeader Finalへ届く');
  // 既存のLeader Final固有ルールは維持
  assert(block.indexOf('Formal Truthのfield名・意味・用途を維持し') !== -1, '10-5. 既存のLeader Final固有用途境界ルールは維持されている');
}

// ══════════════════════════════════════════════════════════════
caseHeader('11. fail-open / 既存挙動の維持');
{
  assert(_leaderCaseContextToText(null) === '', '11-1. cc=null は空文字（既存fail-open）');
  const noIadp = { evidence: { status: 'sufficient', verifiedCount: 1, independentSourceCount: 1, totalCount: 1 } };
  const t2 = _leaderCaseContextToText(noIadp);
  assert(t2.indexOf(IADP_HEADING) === -1, '11-2. IADP値が1件も無い場合は見出しを出さない（空セクションを作らない）');
  assert(t2.indexOf('Evidence Status:') !== -1, '11-3. IADPなしでも非IADP行は従来どおり出力される');
  const onlyBio = { iadp: { bio: 'テストbio' } };
  const t3 = _leaderCaseContextToText(onlyBio);
  assert(t3.indexOf(IADP_HEADING) !== -1 && t3.indexOf('Profile Bio: テストbio') !== -1, '11-4. IADP値が1件でもあれば見出し＋その行を出す');
  assert(_buildFormalTruthRuleText(false) === '', '11-5. hasCaseContext=false ではルール文が空（既存fail-open・Scope Boundaryも出さない）');
}

caseHeader('12. 既存 formalTruthRule Contract の維持');
{
  const rule = _buildFormalTruthRuleText(true);
  assert(rule.indexOf('【★最上位ルール：正本参照義務（Formal Truth Priority）— 以下の全ルールより上位・例外なし】') !== -1, '12-1. 最上位ルール見出しが不変');
  assert(rule.indexOf('① 会社憲法（Executive Constitution）') !== -1, '12-2. 判断優先順位①が不変');
  assert(rule.indexOf('② Formal Truth（会社が正式に保存・確定・機械判定した情報＝入力内の【CASE CONTEXT】）') !== -1, '12-3. 判断優先順位②が不変');
  assert(rule.indexOf('【情報不足の判定手順（この案件ではこれだけが正しい手順。以下の全ルールに書かれた情報不足判定より優先する）】') !== -1, '12-4. 情報不足判定手順が不変');
  assert(rule.indexOf('・【CASE CONTEXT】に記載のない情報を、あるものとして断定すること') !== -1, '12-5. Class B担当の既存禁止事項が維持されている');
  assert(rule.indexOf('・【CASE CONTEXT】に存在する情報を「不足」「未確認」「存在しない」「アクセスできない」と述べること') !== -1, '12-6. 既存禁止事項①が維持');
  assert(rule.indexOf('・【CASE CONTEXT】の機械判定済みの値（Gate・Status・Count等）を、あなた自身の自然言語判断で再判定・否定すること') !== -1, '12-7. 既存禁止事項③が維持');
}

caseHeader('13. Issue A 非変更（Reviewer / Strategy → Leader Final Enforcement）');
{
  assert(ocSrc.indexOf("const reviewerTask = (workflowTasks || []).find(function(t) { return t.agentId === 'reviewer' && t.isPostProcess; });") !== -1,
    '13-1. reviewerTask取得ロジック 無変更');
  assert(ocSrc.indexOf("const strategyTask = (workflowTasks || []).find(function(t) { return t.agentId === 'strategy' && t.isPostProcess; });") !== -1,
    '13-2. strategyTask取得ロジック 無変更');
  assert(ocSrc.indexOf('var LEADER_FINAL_REVIEWER_REJECT_RULE = [') !== -1, '13-3. LEADER_FINAL_REVIEWER_REJECT_RULE 存在（変更せず維持）');
  assert(ocSrc.indexOf('var LEADER_FINAL_POSTPROCESS_TEXT_MAX = 1200;') !== -1, '13-4. 1200文字化 維持');
  const reNow = fs.readFileSync(path.join(__dirname, 'shared', 'leaderRuleEngine.js'), 'utf8');
  const reHead = cp.execSync('git show HEAD:shared/leaderRuleEngine.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 10 }).toString('utf8');
  assert(reNow === reHead, '13-5. shared/leaderRuleEngine.js がHEADと完全一致（Rule Engine変更0）');
  function extractConst(s, name) {
    const st = s.indexOf('const ' + name + ' = [');
    if (st === -1) return null;
    const en = s.indexOf('\n].join', st);
    return s.slice(st, en !== -1 ? en : st + 3000);
  }
  const ocHead = cp.execSync('git show HEAD:openaiClient.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 30 }).toString('utf8');
  assert(extractConst(ocSrc, 'LEADER_FINAL_PROMPT') === extractConst(ocHead, 'LEADER_FINAL_PROMPT'), '13-6. LEADER_FINAL_PROMPT 無変更');
  assert(extractConst(ocSrc, 'ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT') === extractConst(ocHead, 'ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT'), '13-7. ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT 無変更');
}

caseHeader('14. listingNgWords Channel Scope（c35b534）非変更');
{
  assert(indexSrc.indexOf("const APFR_LISTING_AD_ONLY_FIELDS = ['listingNgWords'];") !== -1, '14-1. リスティング広告専用field定義 維持');
  assert(indexSrc.indexOf('function _apfrScopeComplianceContextForOutput(complianceContext, outputDraft) {') !== -1, '14-2. scope helper 維持');
  const cnt = indexSrc.split('_apfrScopeComplianceContextForOutput(complianceContext, _lastOutputDraft)').length - 1;
  assert(cnt === 2, '14-3. 表示側・Enforcement側の2箇所適用 維持');
  assert(indexSrc.indexOf('function evaluateComplianceGate(outputDraft, complianceContext) {') !== -1, '14-4. detector 無変更');
  assert(indexSrc.indexOf("listingNgWords:                   { label: 'リスティングNGワード',  type: 'array',   group: 'Compliance' },") !== -1,
    '14-5. APFR_FIELD_META listingNgWords 無変更（Formal Truth/schema変更0）');
  assert(indexSrc.indexOf('var canApprove = _mapAllChecked() && _mapReviewApproved(mai) && !_mapCompliance.blocked;') !== -1,
    '14-6. Mobile Approval Enforcement 無変更');
  // index.html 自体が今回無変更であること
  const idxHead = cp.execSync('git show HEAD:index.html', { cwd: __dirname, maxBuffer: 1024 * 1024 * 30 }).toString('utf8');
  assert(indexSrc === idxHead, '14-7. index.html がHEADと完全一致（今回の変更対象外）');
}

caseHeader('15. C-3-1 非変更 / その他既存Contract');
{
  assert(indexSrc.indexOf('function _apfrEvaluateGroundingSignals') === -1, '15-1. Grounding Detectorを新設していない（C-3-1 Not Required維持）');
  assert(ocSrc.indexOf('reviewerSignal') === -1, '15-2. reviewerSignal実装なし（Issue A未着手）');
  const qgStart = indexSrc.indexOf('function evaluateQualityGate(packageQuality) {');
  const qgBody = indexSrc.slice(qgStart, indexSrc.indexOf('\n}\n', qgStart));
  assert(qgBody.indexOf('QUALITY_GATE_PASSING_STATUSES.indexOf(sourceStatus)') !== -1, '15-3. Quality Gate 無変更');
  assert(indexSrc.indexOf('_lastOutputDraft.status    = noCompletedResults ? OUTPUT_STATUS.ERROR : OUTPUT_STATUS.READY;') !== -1, '15-4. READY判定 無変更');
  assert(indexSrc.indexOf('if (!_lastOutputDraft.caseId && _atRunCaseId) _lastOutputDraft.caseId = _atRunCaseId;') !== -1, '15-5. P1-1 caseId Binding 維持');
  const clNow = fs.readFileSync(path.join(__dirname, 'claudeClient.js'), 'utf8');
  const clHead = cp.execSync('git show HEAD:claudeClient.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 20 }).toString('utf8');
  assert(clNow === clHead, '15-6. claudeClient.js がHEADと完全一致（変更0）');
}

caseHeader('16. Class B 専用の新規仕組みを追加していない（実装範囲の限定）');
{
  const rule = _buildFormalTruthRuleText(true);
  ['肌に優しい', '美肌', '内側から輝く', 'しっとり', '忙しい朝'].forEach(function (w, i) {
    assert(rule.indexOf(w) === -1, '16-' + (1 + i) + '. Class B固有語「' + w + '」をルールへ列挙していない（denylist化していない）');
  });
  assert(rule.indexOf('・【CASE CONTEXT】に記載のない情報を、あるものとして断定すること') !== -1,
    '16-6. Class Bは既存の「記載のない情報を断定しない」が引き続き担当する');
}

console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All IADP Scope Boundary cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
