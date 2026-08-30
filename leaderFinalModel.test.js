'use strict';
// leaderFinalModel.test.js
// Instagram実運用 Blocking Fix: Leader Final専用モデル（LEADER_FINAL_MODEL）の回帰テスト。
// 実AI API呼び出し0件 / DB変更なし / 実案件への操作0（静的検証と純関数のみ）。
//
//   確定済みRoot Cause（実AI Path A / workflow wf-1788103235478 / case-msr9yckye65y の実測）:
//     Reviewerの否認・LEADER_FINAL_REVIEWER_REJECT_RULE・formalTruthRule・IADP Scope Boundary は
//     いずれも Leader Final prompt へ正しく供給されていた（供給経路は健全）。
//     にもかかわらず gpt-4.1-nano がそれらを遵守せず、CASE CONTEXT に存在しない商品事実
//     （植物由来・肌に優しい・安全性・口コミ・継続効果・キャンペーン）を復活させた。
//     出力が LEADER_FINAL_PROMPT のテンプレート見出しを逐語コピーし、末尾が「※※※」の反復で
//     崩壊していたことから、Leader Final実行モデルの能力不足が直接原因と判定した。
//
//   今回の変更（モデル差のみ）:
//     ・LEADER_FINAL_MODEL = 'gpt-5.4-mini' を新設（OPENAI_MODEL自体は変更しない）
//     ・callOpenAI() に options.model（任意）を追加。未指定時は従来どおり OPENAI_MODEL
//     ・通常Leader Final（_iadpMode=false）のみ options.model へ LEADER_FINAL_MODEL を渡す
//   本テストは「モデルだけが差分であり、Reviewer供給・Contract・Grounding は無変更」を固定する。

const fs = require('fs');
const path = require('path');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log(`  ✅ ${label}`); }
  else { _failed++; console.log(`  ❌ ${label}`); }
}
function caseHeader(t) { console.log(`\n── ${t} ──`); }

const ocSrc = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
const oc = require('./openaiClient.js');

// ── 1. Leader Final専用モデルの定義 ──────────────────────────────
caseHeader('1. LEADER_FINAL_MODEL の定義');
{
  assert(ocSrc.indexOf("const LEADER_FINAL_MODEL = 'gpt-5.4-mini';") !== -1,
    '1-1. LEADER_FINAL_MODEL = gpt-5.4-mini が定義されている');
  const defCount = (ocSrc.match(/const LEADER_FINAL_MODEL\s*=/g) || []).length;
  assert(defCount === 1, '1-2. LEADER_FINAL_MODEL の定義は1箇所のみ（単一ソース）');
}

// ── 2. グローバル OPENAI_MODEL は変更されていない ────────────────
caseHeader('2. OPENAI_MODEL 無変更（他OpenAI呼び出しへの波及なし）');
{
  assert(ocSrc.indexOf("const OPENAI_MODEL = 'gpt-4.1-nano';") !== -1,
    '2-1. OPENAI_MODEL は gpt-4.1-nano のまま（グローバル一括変更をしていない）');
  assert(oc.OPENAI_MODEL === 'gpt-4.1-nano',
    '2-2. export された OPENAI_MODEL も gpt-4.1-nano のまま');
  assert(ocSrc.indexOf("const EEA_WEB_SEARCH_MODEL = 'gpt-5.6-terra';") !== -1,
    '2-3. EEA_WEB_SEARCH_MODEL は無変更（別経路は別定数の既存方式を維持）');
  // gpt-5.4-mini がソース中に現れるのは LEADER_FINAL_MODEL 定義の1箇所だけ
  const nModel = (ocSrc.match(/gpt-5\.4-mini/g) || []).length;
  assert(nModel === 1, '2-4. gpt-5.4-mini はソース中1箇所のみ（他経路へハードコードしていない）');
}

// ── 3. callOpenAI() の model override が後方互換 ──────────────────
caseHeader('3. callOpenAI() の options.model（任意・後方互換）');
{
  assert(ocSrc.indexOf("const effectiveModel = (options && typeof options.model === 'string' && options.model) ? options.model : OPENAI_MODEL;") !== -1,
    '3-1. options.model 未指定時は OPENAI_MODEL へフォールバックする');
  assert(ocSrc.indexOf('model: effectiveModel,') !== -1,
    '3-2. request body.model が effectiveModel を使う');
  assert(ocSrc.indexOf("addOpenAIUsage(effectiveModel, inputTokens, outputTokens, 'aiDevelopment', 'text');") !== -1,
    '3-3. 料金計上（addOpenAIUsage）も実効モデル名で行う');
  assert(ocSrc.indexOf('model:       effectiveModel,') !== -1,
    '3-4. Supabase料金イベントも実効モデル名で保存する');
  // 署名は追加しない（既存呼び出しは引数を変えずに動く）
  assert(ocSrc.indexOf('async function callOpenAI(systemPrompt, userMessage, history = [], options = {})') !== -1,
    '3-5. callOpenAI() の署名は無変更（既存呼び出しは全て従来どおり）');
}

// ── 4. 通常Leader FinalのみLEADER_FINAL_MODEL（IADPは従来モデル） ──
caseHeader('4. 適用範囲：通常Leader Finalのみ');
{
  assert(ocSrc.indexOf('_iadpCallOptions.model = LEADER_FINAL_MODEL;') !== -1,
    '4-1. 通常Leader Final（else分岐）で LEADER_FINAL_MODEL を指定する');
  const i = ocSrc.indexOf('var _iadpCallOptions = { max_output_tokens: _iadpMaxOutputTokens };');
  const j = ocSrc.indexOf('text = await callOpenAI(_iadpPromptToUse, question, [], _iadpCallOptions)');
  assert(i !== -1 && j > i, '4-2. 呼び出し直前のoptions構築ブロックが存在する');
  const seg = ocSrc.slice(i, j);
  // IADP側（if分岐）にはmodel指定を入れていない＝structuredOutputのみ
  const ifPart = seg.slice(0, seg.indexOf('} else {'));
  assert(ifPart.indexOf('LEADER_FINAL_MODEL') === -1,
    '4-3. IADP分岐には LEADER_FINAL_MODEL を指定していない（IADPは従来モデルのまま）');
  assert(ifPart.indexOf('structuredOutput') !== -1,
    '4-4. IADP分岐の structuredOutput は無変更');
  assert(ocSrc.indexOf('model    = _iadpCallOptions.model || OPENAI_MODEL;') !== -1,
    '4-5. 戻り値modelが実使用モデルを返す（task_history.modelUsedで実測検証できる）');
  assert(ocSrc.indexOf('var _iadpMaxOutputTokens = _iadpMode ? 8192 : 4096;') !== -1,
    '4-6. max_output_tokens（通常4096 / IADP8192）は無変更');
}

// ── 5. Reviewer / Strategy 供給が維持されている ──────────────────
caseHeader('5. Reviewer / Strategy 供給の維持');
{
  assert(ocSrc.indexOf("const reviewerTask = (workflowTasks || []).find(function(t) { return t.agentId === 'reviewer' && t.isPostProcess; });") !== -1,
    '5-1. post-process Reviewer の取得が無変更');
  assert(ocSrc.indexOf("const strategyTask = (workflowTasks || []).find(function(t) { return t.agentId === 'strategy' && t.isPostProcess; });") !== -1,
    '5-2. post-process Strategy の取得が無変更');
  assert(ocSrc.indexOf("return t && t.agentId === 'reviewer' && !t.isPostProcess && t.status === 'completed' && t.result;") !== -1,
    '5-3. Issue A Option D の mainReviewerTask 取得が無変更');
  assert(ocSrc.indexOf("reviewerText ? '【Reviewerの品質フィードバック】\\n' + reviewerText : ''") !== -1,
    '5-4. Reviewer本文がLeader Final questionへ供給される');
  assert(ocSrc.indexOf("mainReviewerText ? '【Reviewer（品質レビュー担当）の作業中レビュー】\\n' + mainReviewerText : ''") !== -1,
    '5-5. main-task Reviewer 専用ラベル供給（Option D）が維持されている');
  assert(ocSrc.indexOf("strategyText ? '【Strategyの統合提言】\\n' + strategyText : ''") !== -1,
    '5-6. Strategy本文がLeader Final questionへ供給される');
  assert(ocSrc.indexOf('var LEADER_FINAL_POSTPROCESS_TEXT_MAX = 1200;') !== -1,
    '5-7. 供給上限1200文字が無変更（緩和も削除もしていない）');
}

// ── 6. reject遵守Contract の維持 ────────────────────────────────
caseHeader('6. LEADER_FINAL_REVIEWER_REJECT_RULE の維持');
{
  assert(ocSrc.indexOf('var LEADER_FINAL_REVIEWER_REJECT_RULE = [') !== -1,
    '6-1. reject遵守Contractが存在する');
  assert(ocSrc.indexOf("(reviewerText || mainReviewerText) ? LEADER_FINAL_REVIEWER_REJECT_RULE : ''") !== -1,
    '6-2. 発火条件（reviewerText || mainReviewerText）が無変更');
  [
    'Reviewerが公開不可・差し戻し・修正必須と判断している場合、その指摘を解消していない内容を完成成果物として採用してはいけません。',
    'Reviewerの指摘を解消できる場合は、解消した内容で完成成果物を出力してください。',
    'Reviewerの指摘を解消できない場合は、公開可能な完成成果物として扱わず、未解消の指摘と必要な対応を明示してください。',
    'Reviewerの指摘を、あなたの判断で「問題なし」と上書きしないでください。',
  ].forEach(function (line, n) {
    assert(ocSrc.indexOf(line) !== -1, '6-' + (n + 3) + '. Contract本文が無変更: ' + line.slice(0, 24) + '…');
  });
}

// ── 7. Formal Truth / Grounding Block の維持 ───────────────────
caseHeader('7. Formal Truth Rule / Grounding Block の維持');
{
  assert(ocSrc.indexOf("if (caseContext) {\n    question += '\\n\\n' + _buildLeaderFinalGroundingBlock(caseContext, _lfFacts);") !== -1
      || ocSrc.indexOf("question += '\\n\\n' + _buildLeaderFinalGroundingBlock(caseContext, _lfFacts);") !== -1,
    '7-1. caseContext ありのときGrounding Blockをquestionへ付加する配線が無変更');
  const defCount = (ocSrc.match(/function _buildFormalTruthRuleText\(hasCaseContext\)/g) || []).length;
  assert(defCount === 1, '7-2. formalTruthRule は単一ソースのまま');
  const rule = oc._buildFormalTruthRuleText(true);
  assert(rule.indexOf('正本参照義務') !== -1, '7-3. formalTruthRule に正本参照義務が含まれる');
  assert(rule.indexOf('【CASE CONTEXT】に記載のない情報を、あるものとして断定すること') !== -1,
    '7-4. Context外情報の断定禁止が含まれる');
  assert(oc._buildFormalTruthRuleText(false) === '', '7-5. hasCaseContext=false は空文字（fail-open）が無変更');
  const gb = oc._buildLeaderFinalGroundingBlock('<<CC>>', { informationInsufficient: { count: 0 } });
  assert(gb.indexOf(rule) !== -1, '7-6. Grounding Block が formalTruthRule を再利用している');
  assert(gb.indexOf('<<CC>>') !== -1, '7-7. Grounding Block 末尾に caseContext が含まれる');
  assert(gb.indexOf('CASE CONTEXTに存在しない具体的事実') !== -1,
    '7-8. Leader Final固有のGroundingルールが無変更');
}

// ── 8. IADP Scope Boundary の維持 ──────────────────────────────
caseHeader('8. IADP Scope Boundary の維持');
{
  const rule = oc._buildFormalTruthRuleText(true);
  assert(rule.indexOf('■ アカウント設計（IADP）') !== -1,
    '8-1. IADPの用途境界が formalTruthRule に含まれる');
  assert(rule.indexOf('対象商品の成分・配合・効能・効果・適性') !== -1,
    '8-2. 商品事実への意味変換禁止が含まれる');
  assert(rule.indexOf('アカウント自体の説明・世界観・投稿トーンとしてこれらの値を使うことは禁止していません') !== -1,
    '8-3. 過剰禁止を避ける許可文が維持されている');
  const gb = oc._buildLeaderFinalGroundingBlock('<<CC>>', { informationInsufficient: { count: 0 } });
  assert(gb.indexOf('■ アカウント設計（IADP）') !== -1,
    '8-4. Leader Final の Grounding Block にも IADP Scope Boundary が届く');
}

// ── 9. 変更していないことの確認（無関係領域） ───────────────────
caseHeader('9. 無変更の確認');
{
  assert(ocSrc.indexOf('const LEADER_FINAL_PROMPT = [') !== -1
    && ocSrc.indexOf('あなたはENBISOUのLeader（会社代表・最終責任者）です。') !== -1,
    '9-1. LEADER_FINAL_PROMPT 本体は無変更');
  assert(ocSrc.indexOf("leader: {\n    provider: 'openai', enabled: true,") !== -1,
    '9-2. Leader の provider は openai のまま（Provider設定変更なし）');
  assert(/reviewer:\s*\{\s*\n\s*provider:\s*'claude'/.test(ocSrc),
    '9-3. Reviewer の provider は claude のまま');
  assert(/strategy:\s*\{\s*\n\s*provider:\s*'claude'/.test(ocSrc),
    '9-4. Strategy の provider は claude のまま');
  assert(ocSrc.indexOf("if (agent !== 'writer' && agent !== 'reviewer') return '';") !== -1,
    '9-5. buildCompliancePromptBlock の適用範囲は無変更');
  // server.js / index.html / claudeClient.js は本変更の対象外
  const svSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert(svSrc.indexOf('LEADER_FINAL_MODEL') === -1, '9-6. server.js に本変更は混入していない');
  const idxSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  assert(idxSrc.indexOf('LEADER_FINAL_MODEL') === -1, '9-7. index.html に本変更は混入していない');
  const clSrc = fs.readFileSync(path.join(__dirname, 'claudeClient.js'), 'utf8');
  assert(clSrc.indexOf('LEADER_FINAL_MODEL') === -1, '9-8. claudeClient.js に本変更は混入していない');
}

console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
console.log(_failed === 0 ? '🟢 All Leader Final model cases passed' : '🔴 FAILED');
process.exitCode = _failed === 0 ? 0 : 1;
