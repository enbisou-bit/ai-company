'use strict';
// leaderFinalGrounding.test.js
// Leader Final Grounding（Option F）合成テスト
// 実AI API呼び出し0件 / DB変更なし / 実案件への操作0
// openaiClient.js から実関数（_buildFormalTruthRuleText / _buildLeaderFinalGroundingBlock /
// buildSystemPrompt）を直接requireして検証する（apfrComplianceInjection.test.jsと同一パターン）。
// あわせて実ソース（openaiClient.js / index.html / server.js / claudeClient.js）へのstatic検証を行い、
//   ・LEADER_FINAL_PROMPT / ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT 本体が無変更であること
//   ・formalTruthRuleが単一ソース（_buildFormalTruthRuleText）から再利用されていること
//   ・evaluateQualityGate / READY判定 / APFR Resolver / Compliance Gateに触れていないこと
//   ・index.html / server.js / claudeClient.js / shared/leaderRuleEngine.js が無変更であること
// を確認する。

const fs = require('fs');
const path = require('path');
const oc = require('./openaiClient');

// ──────────────────────────────────────────────────────────────
// テストハーネス
// ──────────────────────────────────────────────────────────────
let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log(`  ✅ ${label}`); }
  else { _failed++; console.log(`  ❌ ${label}`); }
}
function caseHeader(t) { console.log(`\n── ${t} ──`); }

const CASE_CONTEXT_FIXTURE = [
  '【CASE CONTEXT｜同一caseの保存済み正本（APFR Formal Truth／Intelligence要約）】',
  '■ 商品Formal Truth（ユーザー本人が確認済みの正式値。推測ではない）',
  '商品名（productName）: プラファスト',
  'ASP名（aspName）: A8.net',
  '報酬額（payout）: 5000',
  'EPC（epc）: 34.24',
  '確定率(%)（approvalRate）: 100',
].join('\n');

function ruleFacts(count, memberIds) {
  return { informationInsufficient: { count: count, memberIds: memberIds || [], allInsufficient: false } };
}

// ──────────────────────────────────────────────────────────────
caseHeader('1-4. Context外具体的事実の断定禁止ルール存在');
{
  const block = oc._buildLeaderFinalGroundingBlock(CASE_CONTEXT_FIXTURE, ruleFacts(0));
  assert(block.indexOf('キャンペーン') !== -1, '1. キャンペーン断定禁止ルール存在');
  assert(block.indexOf('特典') !== -1, '2. 特典断定禁止ルール存在');
  assert(block.indexOf('成分') !== -1, '3. 成分断定禁止ルール存在');
  assert(block.indexOf('効能') !== -1, '4. 効能断定禁止ルール存在');
  assert(block.indexOf('CASE CONTEXTに存在しない具体的事実') !== -1, '4-1. 断定禁止の主文が存在する');
}

caseHeader('5-7. Formal Truth意味変換禁止（今回のE2Eで実測した3パターン）');
{
  const block = oc._buildLeaderFinalGroundingBlock(CASE_CONTEXT_FIXTURE, ruleFacts(0));
  assert(block.indexOf('成果承認率') !== -1 && block.indexOf('審査通過率') !== -1,
    '5. approvalRate意味変換禁止（成果承認率→審査通過率への変換を名指しで禁止）');
  assert(block.indexOf('計測期間') !== -1 && block.indexOf('購入者特典期間') !== -1,
    '6. cookieWindowDays意味変換禁止（計測期間→購入者特典期間への変換を名指しで禁止）');
  assert(block.indexOf('技術仕様') !== -1 && block.indexOf('購入利便性') !== -1,
    '7. mobileOptimized意味変換禁止（技術仕様→購入利便性への変換を名指しで禁止）');
  assert(block.indexOf('別の概念へ読み替えてはいけません') !== -1, '7-1. 意味維持の主文が存在する');
}

caseHeader('8. Formal Truth直接矛盾禁止（formalTruthRule経由で再利用）');
{
  const block = oc._buildLeaderFinalGroundingBlock(CASE_CONTEXT_FIXTURE, ruleFacts(0));
  assert(block.indexOf('あなた自身の自然言語判断で再判定・否定すること') !== -1, '8-1. 機械判定値の再判定・否定禁止（formalTruthRule由来）');
  assert(block.indexOf('あるものとして断定すること') !== -1, '8-2. Context外情報の断定禁止（formalTruthRule由来）');
}

caseHeader('9-10. informationInsufficient伝播とfail-closed');
{
  const withInsufficient = oc._buildLeaderFinalGroundingBlock(CASE_CONTEXT_FIXTURE, ruleFacts(1, ['writer']));
  assert(withInsufficient.indexOf('代わりに創作してその担当の判断を上書き') !== -1,
    '9. informationInsufficient.count>0でfail-closed文が追加される（Writer停止判断の尊重）');

  const withoutInsufficient = oc._buildLeaderFinalGroundingBlock(CASE_CONTEXT_FIXTURE, ruleFacts(0));
  assert(withoutInsufficient.indexOf('代わりに創作してその担当の判断を上書き') === -1,
    '10-1. informationInsufficient.count=0ではfail-closed文を追加しない（過剰ブロック回避）');

  const noFacts = oc._buildLeaderFinalGroundingBlock(CASE_CONTEXT_FIXTURE, null);
  assert(noFacts.indexOf('代わりに創作してその担当の判断を上書き') === -1,
    '10-2. ruleFacts=null（Rule Engine失敗時）でも安全側（fail-closed文なし・例外なし）');
  assert(noFacts.indexOf(CASE_CONTEXT_FIXTURE) !== -1, '10-3. ruleFacts=nullでもcaseContext本体は正しく含まれる（fail-open）');
}

caseHeader('11. CASE CONTEXTなし時はbuildSystemPrompt既存挙動と非干渉');
{
  const withoutCtx = oc.buildSystemPrompt('writer', null, null, { hasCaseContext: false });
  const withCtx = oc.buildSystemPrompt('writer', null, null, { hasCaseContext: true });
  assert(withoutCtx.indexOf('正本参照義務') === -1, '11-1. hasCaseContext=falseではformalTruthRuleが挿入されない');
  assert(withCtx.indexOf('正本参照義務') !== -1, '11-2. hasCaseContext=trueではformalTruthRuleが挿入される');
  assert(oc._buildFormalTruthRuleText(false) === '', '11-3. _buildFormalTruthRuleText(false)は空文字列（fail-open）');
}

caseHeader('12-13. LEADER_FINAL_PROMPT / ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT 本体無変更');
{
  const src = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
  const headSrc = require('child_process').execSync('git show HEAD:openaiClient.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 20 }).toString('utf8');

  function extractConst(s, name) {
    const start = s.indexOf('const ' + name + ' = [');
    if (start === -1) return null;
    const end = s.indexOf('\n].join', start);
    return s.slice(start, end !== -1 ? end : start + 3000);
  }
  const lfp_now = extractConst(src, 'LEADER_FINAL_PROMPT');
  const lfp_head = extractConst(headSrc, 'LEADER_FINAL_PROMPT');
  assert(lfp_now !== null && lfp_head !== null, '12-1. LEADER_FINAL_PROMPT定数が両バージョンで発見できる');
  assert(lfp_now === lfp_head, '12-2. LEADER_FINAL_PROMPT本体がHEADと完全一致（意図せぬ変更0）');

  const aip_now = extractConst(src, 'ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT');
  const aip_head = extractConst(headSrc, 'ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT');
  assert(aip_now !== null && aip_head !== null, '13-1. ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT定数が両バージョンで発見できる');
  assert(aip_now === aip_head, '13-2. ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT本体がHEADと完全一致（意図せぬ変更0）');
}

caseHeader('14. buildSystemPrompt()のformalTruthRuleが共通化前と意味的に同一');
{
  const withCtx = oc.buildSystemPrompt('writer', null, null, { hasCaseContext: true });
  ['正本参照義務', '① 会社憲法（Executive Constitution）', '② Formal Truth', '③ 会社判断', '④ あなたの専門判断',
   '⑤ ヒアリングルール・情報不足判定・最終上書きルール', '情報不足の判定手順',
   '存在する情報を「不足」「未確認」「存在しない」「アクセスできない」と述べること',
   '再提出・再説明・再共有を要求すること',
   'あなた自身の自然言語判断で再判定・否定すること',
   'あるものとして断定すること'].forEach(function (s, i) {
    assert(withCtx.indexOf(s) !== -1, `14-${i + 1}. buildSystemPrompt出力に「${s.slice(0, 20)}...」が存在する（共通化前と同一内容）`);
  });
}

caseHeader('15. Writer/Researcher/Reviewer/Strategy回帰（buildSystemPrompt正常動作）');
{
  ['writer', 'researcher', 'reviewer', 'strategy'].forEach(function (agent) {
    const p = oc.buildSystemPrompt(agent, null, null, { hasCaseContext: true });
    assert(typeof p === 'string' && p.length > 0, `15-${agent}. buildSystemPrompt('${agent}', ...)が正常に文字列を返す`);
  });
}

caseHeader('16. Path B（leaderSummary）非影響');
{
  const src = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
  const lsStart = src.indexOf('async function leaderSummary(');
  const lsEnd = src.indexOf('\nasync function ', lsStart + 10);
  const lsBody = src.slice(lsStart, lsEnd !== -1 ? lsEnd : lsStart + 3000);
  assert(lsBody.indexOf('_buildLeaderFinalGroundingBlock') === -1, '16-1. leaderSummary()は_buildLeaderFinalGroundingBlockを呼ばない（Path B非改変）');
  assert(lsBody.indexOf('caseContextRule') !== -1, '16-2. leaderSummary()の既存caseContextRule機構は無変更のまま存在する');
}

caseHeader('17. claudeClient.js 変更0');
{
  const claudeSrc = fs.readFileSync(path.join(__dirname, 'claudeClient.js'), 'utf8');
  const claudeHead = require('child_process').execSync('git show HEAD:claudeClient.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 20 }).toString('utf8');
  assert(claudeSrc === claudeHead, '17. claudeClient.jsがHEADと完全一致（byte-identical・変更0）');
}

caseHeader('18. index.html / server.js 変更0');
{
  const indexSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  const indexHead = require('child_process').execSync('git show HEAD:index.html', { cwd: __dirname, maxBuffer: 1024 * 1024 * 20 }).toString('utf8');
  assert(indexSrc === indexHead, '18-1. index.htmlがHEADと完全一致（byte-identical・変更0）');

  const serverSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  const serverHead = require('child_process').execSync('git show HEAD:server.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 20 }).toString('utf8');
  assert(serverSrc === serverHead, '18-2. server.jsがHEADと完全一致（byte-identical・変更0）');
}

caseHeader('19. Quality Gate / READYロジック変更0（openaiClient.js内に該当識別子への機能的関与0）');
{
  const src = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
  // コメント中の言及（責務境界の説明）は許容し、関数呼び出しとしての参照が0件であることを確認する。
  assert(src.indexOf('evaluateQualityGate(') === -1, '19-1. openaiClient.jsにevaluateQualityGate()の呼び出しが存在しない（もともと index.html 側の責務）');
  assert(src.indexOf('OUTPUT_STATUS.READY') === -1, '19-2. openaiClient.jsにOUTPUT_STATUS.READY参照が存在しない（もともと index.html 側の責務）');

  // _buildLeaderFinalGroundingBlock() 本体がQuality Gate/READY/Resolver/Compliance Gateへ触れていないこと
  const fnStart = src.indexOf('function _buildLeaderFinalGroundingBlock(');
  const fnEnd = src.indexOf('\n}\n', fnStart);
  const fnBody = src.slice(fnStart, fnEnd);
  assert(fnBody.indexOf('_apfrResolveCurrentFact') === -1, '19-3. _buildLeaderFinalGroundingBlock()はAPFR Resolverを参照しない');
  assert(fnBody.indexOf('evaluateComplianceGate') === -1, '19-4. _buildLeaderFinalGroundingBlock()はCompliance Gateを参照しない');
  assert(fnBody.indexOf('fetch(') === -1, '19-5. _buildLeaderFinalGroundingBlock()はfetch()を呼ばない（DB write 0・純粋関数）');
}

caseHeader('20. fail-closedでも現行Quality Gateが素通しし得る既知挙動（本実装は変更していないことの明示）');
{
  // 前工程の実AI E2Eで実測済みの事実を固定する回帰マーカー。
  //   evaluateOutputPackageCompleteness()/evaluateQualityGate()は index.html 側にあり本実装の対象外。
  //   ここでは「本実装（openaiClient.js）がそれらに一切触れていないこと」のみを再確認する
  //   （Quality Gate Grounding Enforcementは別工程・今回「修正済み」と誤認しないための固定テスト）。
  const src = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
  // stage-aware: `git diff --name-only`はunstaged差分のみを返すため、対象ファイルをstageすると
  //   一覧から消えてしまう。HEADとの差分（staged+unstaged）を見る`git diff --name-only HEAD`へ変更し、
  //   「HEADから見て変更対象に含まれるか」というテストの意図（Contract）自体は変えずに検出方法だけを直す。
  const diffFiles = require('child_process').execSync('git diff --name-only HEAD', { cwd: __dirname }).toString('utf8').trim().split('\n').filter(Boolean);
  const KNOWN_RUNTIME_FILES = ['cost-logs.json', 'data/conversations/_meta.json']; // 既存protected runtime差分（本実装と無関係）
  // apfrCaseDataContext.test.js: formalTruthRuleの単一ソース抽出（実装1）に伴い、
  //   released test内の静的文字列アサーション（旧: inline定義の直接文字列一致）を、
  //   同じ性質（hasCaseContextがformalTruthRuleを有効化すること）を検証する新しいアサーションへ
  //   更新した正当な追随修正（テストの意図・検証対象は不変・弱化していない）。
  // leaderFinalGrounding.test.js: 本ファイル自身。Option Fの一部として新規追加された既知ファイルであり、
  //   untracked時は`git diff`に現れず無関係だったが、stage（git add）された時点でHEAD差分に現れるようになった
  //   だけで、これはOption Fの意図した変更対象そのもの（想定外の混入ではない）。
  const ALLOWED_COMPANION_FILES = ['apfrCaseDataContext.test.js', 'leaderFinalGrounding.test.js'];
  assert(diffFiles.indexOf('index.html') === -1, '20-1. index.html（evaluateQualityGate/READY判定の実体）は今回のdiffに含まれない');
  assert(diffFiles.indexOf('openaiClient.js') !== -1, '20-2a. openaiClient.jsが変更対象に含まれる');
  const unexpected = diffFiles.filter(function (f) {
    return f !== 'openaiClient.js' && KNOWN_RUNTIME_FILES.indexOf(f) === -1 && ALLOWED_COMPANION_FILES.indexOf(f) === -1;
  });
  assert(unexpected.length === 0, '20-2b. openaiClient.js・既知runtimeファイル・許可済み追随修正以外の変更が0件（実際: ' + JSON.stringify(unexpected) + '）');
}

caseHeader('single-source: formalTruthRule定義が1箇所のみ');
{
  const src = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
  const defCount = (src.match(/function _buildFormalTruthRuleText\(hasCaseContext\)/g) || []).length;
  assert(defCount === 1, 'S-1. _buildFormalTruthRuleText()の定義は1箇所のみ（二重管理なし）');
  assert(src.indexOf('const formalTruthRule = _buildFormalTruthRuleText(hasCaseContext);') !== -1,
    'S-2. buildSystemPrompt()は共通関数を呼ぶだけ（ルール文の再定義なし）');
  assert(src.indexOf('_buildFormalTruthRuleText(true), // Writer/Researcher/Reviewer/Strategyと同一ソース') !== -1,
    'S-3. _buildLeaderFinalGroundingBlock()も同じ共通関数を呼んでいる（単一ソース再利用）');
}

// ──────────────────────────────────────────────────────────────
// Reviewer / Compliance Enforcement 追記（原因分類B対策・一般則・商品固有ハードコードなし）
// ──────────────────────────────────────────────────────────────
const _ocSrc = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');

caseHeader('E1. Reviewer/Strategyの削除要求 > Formal Truth記載（一般則）');
{
  assert(_ocSrc.indexOf('ReviewerまたはStrategyが、特定の表現の「削除」「使用禁止」「具体的な言い換え」「Compliance上の変更」を明示している場合') !== -1,
    'E1-1. Reviewer/Strategyの明示指示（削除・使用禁止・言い換え・Compliance変更）を対象とするContractが存在する');
  assert(_ocSrc.indexOf('その表現がFormal Truth／CASE CONTEXTに記載されていても、記載があるという事実だけを理由に元の表現をそのまま採用してはいけません') !== -1,
    'E1-2. Formal Truth記載を理由に元表現を採用してはいけないことが明記されている（LEADER_FINAL_REVIEWER_REJECT_RULE内）');
  assert(_ocSrc.indexOf('Formal Truthに記載があることと、その媒体でその表現を使用してよいことは別です。') !== -1,
    'E1-3. 「Formal Truth記載」と「媒体での使用可否」が別であることが明記されている');
  // 商品固有ハードコード禁止の確認
  ['シミが生まれる5つのステップ', 'プラファスト', '肝斑', '医薬部外品案件', 'バリア成分'].forEach(function (w) {
    assert(_ocSrc.indexOf("'" + w) === -1 && _ocSrc.indexOf('"' + w) === -1,
      'E1-4. 商品固有語「' + w + '」がEnforcement文言にハードコードされていない');
  });
}

caseHeader('E2. Reviewer/Strategyの具体的言い換え要求への従属Contract');
{
  assert(_ocSrc.indexOf('（1）Reviewer／Strategyが指示した安全な削除・言い換えを適用する') !== -1,
    'E2-1. 指示された削除・言い換えを適用する選択肢が明記されている');
  assert(_ocSrc.indexOf('（2）それを適切に適用できないときは当該の問題表現を成果物から除外する') !== -1,
    'E2-2. 適用できない場合は問題表現を除外する選択肢が明記されている');
  assert(_ocSrc.indexOf('あなた自身の解釈だけで「実質的に解消した」とみなして元の表現を残してはいけません') !== -1,
    'E2-3. Leader Finalの独自解釈でreject解除・元表現保持することを禁止している');
}

caseHeader('E3. Formal Truth記載 ≠ Compliance上の使用許可（Grounding Block明示）');
{
  const block = oc._buildLeaderFinalGroundingBlock(CASE_CONTEXT_FIXTURE, ruleFacts(0));
  assert(block.indexOf('「捏造・未確認断定を防ぐための事実境界」であり、「そのまま使ってよい表現の許可リスト」ではありません') !== -1,
    'E3-1. Formal Truthが「許可リスト」ではなく「事実境界」であることがGrounding Blockに明示されている');
  assert(block.indexOf('Reviewer／Strategy／Complianceが、ある表現をその媒体（Instagram等）で使用不可・要変更と判断している場合、その判断を優先してください') !== -1,
    'E3-2. Reviewer/Strategy/Complianceの媒体上の使用不可判断を優先するルールがGrounding Blockに存在する');
  assert(block.indexOf('Formal Truthに記載があることを理由に、そのCompliance判断を上書きしてはいけません') !== -1,
    'E3-3. Formal Truth記載を理由にCompliance判断を上書き禁止');
  assert(block.indexOf('優先順位④「Compliance等の正式制約」には、Reviewer／Strategyが媒体上のリスクとして指摘した表現の除外・言い換えも含みます') !== -1,
    'E3-4. 優先順位④Complianceの範囲にReviewer/Strategyの媒体リスク指摘が含まれると明記');
}

caseHeader('E4. Formal Truth記載Factの省略・安全な言い換えが許容される');
{
  const block = oc._buildLeaderFinalGroundingBlock(CASE_CONTEXT_FIXTURE, ruleFacts(0));
  assert(block.indexOf('必ず成果物で使用する必要はなく、省略・より安全な言い換え・「詳細は公式ページ」等への誘導は常に許容されます') !== -1,
    'E4-1. Formal Truth記載Factの省略・安全な言い換え・公式ページ誘導が常に許容されると明記');
  assert(block.indexOf('禁止するのはFormal Truthを超えた商品事実の断定・捏造だけです') !== -1,
    'E4-2. 禁止範囲がFormal Truthを超えた断定・捏造に限定されると明記');
}

caseHeader('E5. Formal TruthにないFactの捏造禁止（既存Grounding Contract維持）');
{
  const block = oc._buildLeaderFinalGroundingBlock(CASE_CONTEXT_FIXTURE, ruleFacts(0));
  assert(block.indexOf('CASE CONTEXTに存在しない具体的事実') !== -1,
    'E5-1. Context外具体的事実の断定禁止（主文）が維持されている');
  ['キャンペーン', '特典', '成分', '効能'].forEach(function (w, i) {
    assert(block.indexOf(w) !== -1, 'E5-' + (i + 2) + '. 断定禁止例「' + w + '」が維持されている');
  });
  assert(block.indexOf('別の概念へ読み替えてはいけません') !== -1, 'E5-6. Formal Truth意味変換禁止が維持されている');
}

caseHeader('E6. Reviewer不在の既存経路に破壊なし');
{
  assert(_ocSrc.indexOf("(reviewerText || mainReviewerText) ? LEADER_FINAL_REVIEWER_REJECT_RULE : ''") !== -1,
    'E6-1. LEADER_FINAL_REVIEWER_REJECT_RULE の発火条件（reviewerText||mainReviewerText）は無変更（Reviewer未実行時は付加されない）');
  assert(_ocSrc.indexOf("reviewerText ? LEADER_FINAL_REVIEWER_REJECT_RULE : ''") === -1,
    'E6-2. 旧発火条件（reviewerTextのみ）は復活していない');
  // caseContext なしのとき Grounding Block は付加されない（既存挙動）
  assert(_ocSrc.indexOf("if (caseContext) {\n    question += '\\n\\n' + _buildLeaderFinalGroundingBlock(caseContext, _lfFacts);") !== -1,
    'E6-3. Grounding Block の付加条件（caseContext あり時のみ）は無変更');
}

caseHeader('E7. LEADER_FINAL_PROMPT / truncate上限 / 単一ソースの無変更');
{
  const headSrc = require('child_process').execSync('git show HEAD:openaiClient.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 20 }).toString('utf8');
  function extractConst(s, name) {
    const start = s.indexOf('const ' + name + ' = [');
    if (start === -1) return null;
    const end = s.indexOf('\n].join', start);
    return s.slice(start, end !== -1 ? end : start + 3000);
  }
  assert(extractConst(_ocSrc, 'LEADER_FINAL_PROMPT') === extractConst(headSrc, 'LEADER_FINAL_PROMPT'),
    'E7-1. LEADER_FINAL_PROMPT 本体は HEAD と完全一致（今回変更0）');
  assert(extractConst(_ocSrc, 'ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT') === extractConst(headSrc, 'ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT'),
    'E7-2. ACCOUNT_INTELLIGENCE_LEADER_FINAL_PROMPT 本体は HEAD と完全一致（今回変更0）');
  assert(_ocSrc.indexOf('var LEADER_FINAL_POSTPROCESS_TEXT_MAX = 1200;') !== -1,
    'E7-3. truncate上限 1200 は今回変更していない（potential riskとして記録のみ）');
  assert((_ocSrc.match(/function _buildFormalTruthRuleText\(hasCaseContext\)/g) || []).length === 1,
    'E7-4. _buildFormalTruthRuleText は単一ソースのまま');
  const rule = oc._buildFormalTruthRuleText(true);
  const gb = oc._buildLeaderFinalGroundingBlock('<<CC>>', { informationInsufficient: { count: 0 } });
  assert(gb.indexOf(rule) !== -1, 'E7-5. Grounding Block は formalTruthRule を引き続き再利用している');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All Leader Final Grounding (Option F) cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
