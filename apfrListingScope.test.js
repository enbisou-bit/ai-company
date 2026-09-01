'use strict';
// apfrListingScope.test.js
// APFR Step C-1C-1c: listingNgWords Channel Scope Fix 回帰テスト。
// 実AI API呼び出し0件 / DB変更なし / 実案件への操作0。
//
//   Formal Contract（A8.net公式定義）:
//     listingNgWords ＝「リスティング広告で入札・出稿を禁止する検索キーワード」。
//     検索連動型広告の出稿制約であり、Instagram organic投稿本文の使用禁止語ではない。
//
//   実AI Path A E2E（out_1787958064057）で実測された問題:
//     ① 本文中の「商品名」という語自体が violation となり Mobile Approval が誤 block された
//     ② Leader Final が「商品名はNGワード」と誤解し productName（プラファスト）を
//        IADPアカウント名（ナチュラルエッセンス）へ置換した
//
//   修正: detector本体は無変更のまま、Instagram organic出力のときだけ
//     complianceContext からリスティング広告専用fieldを除外して渡す。
//
// index.html側はブラウザ専用グローバル前提のため静的検証＋同一ロジックの合成再現で検証する
// （既存 apfrComplianceGate.test.js / p1BlockingFix.test.js と同一パターン）。

const fs = require('fs');
const path = require('path');
const cp = require('child_process');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log(`  ✅ ${label}`); }
  else { _failed++; console.log(`  ❌ ${label}`); }
}
function caseHeader(t) { console.log(`\n── ${t} ──`); }

const indexSrc = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const ocSrc = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');

// ──────────────────────────────────────────────────────────────
// 合成再現（index.html実装と同一ロジック・判定基準を新規に作らない）
// ──────────────────────────────────────────────────────────────
function _apfrComplianceGateNormalize(s) {
  var t = String(s);
  try { if (typeof t.normalize === 'function') t = t.normalize('NFKC'); } catch (e) {}
  return t.toLowerCase().trim();
}
function evaluateComplianceGate(outputDraft, complianceContext) {
  var EMPTY = { executed: false, checked: false, status: 'not_checked', violations: [] };
  try {
    if (!outputDraft || typeof outputDraft !== 'object') return EMPTY;
    var fields = outputDraft.fields;
    if (!fields || typeof fields !== 'object') return EMPTY;
    if (!complianceContext || typeof complianceContext !== 'object') return EMPTY;
    var raw = complianceContext.listingNgWords;
    if (!Array.isArray(raw) || raw.length === 0) return EMPTY;
    var ng = [];
    raw.forEach(function (w) { var n = _apfrComplianceGateNormalize(w); if (n !== '') ng.push({ raw: String(w), normalized: n }); });
    if (ng.length === 0) return EMPTY;
    var violations = [], seen = {};
    Object.keys(fields).forEach(function (fk) {
      var v = fields[fk], texts = [];
      if (typeof v === 'string') texts.push(v);
      else if (Array.isArray(v)) v.forEach(function (x) { if (x !== null && x !== undefined) texts.push(String(x)); });
      else return;
      texts.forEach(function (text) {
        var nt = _apfrComplianceGateNormalize(text);
        if (nt === '') return;
        ng.forEach(function (w) {
          if (nt.indexOf(w.normalized) === -1) return;
          var k = fk + '::' + w.raw;
          if (seen[k]) return;
          seen[k] = true;
          violations.push({ field: fk, ngWord: w.raw });
        });
      });
    });
    return { executed: true, checked: true, status: violations.length > 0 ? 'violation' : 'clear', violations: violations };
  } catch (e) { return EMPTY; }
}
const APFR_DISCLOSURE_ACCEPTED_MARKERS = [
  { type: 'label', display: '【広告】', normalized: _apfrComplianceGateNormalize('【広告】') },
  { type: 'label', display: '【PR】', normalized: _apfrComplianceGateNormalize('【PR】') },
  { type: 'hashtag', display: '#広告', normalized: _apfrComplianceGateNormalize('広告') },
  { type: 'hashtag', display: '#PR', normalized: _apfrComplianceGateNormalize('PR') },
  { type: 'hashtag', display: '#プロモーション', normalized: _apfrComplianceGateNormalize('プロモーション') },
];
function _apfrEvaluateDisclosureMarkers(outputDraft, complianceContext) {
  var EMPTY = { executed: false, checked: false, requirementPresent: false, foundMarkers: [], status: 'not_checked' };
  try {
    if (!outputDraft || typeof outputDraft !== 'object') return EMPTY;
    var fields = outputDraft.fields;
    if (!fields || typeof fields !== 'object') return EMPTY;
    if (!complianceContext || typeof complianceContext !== 'object') return EMPTY;
    var req = complianceContext.advertisingDisclosureRequirements;
    if (!Array.isArray(req) || req.length === 0) return EMPTY;
    var seen = {}, found = [];
    function add(d) { if (!seen[d]) { seen[d] = true; found.push(d); } }
    Object.keys(fields).forEach(function (fk) {
      var v = fields[fk], texts = [];
      if (typeof v === 'string') texts.push(v);
      else if (Array.isArray(v)) v.forEach(function (x) { if (x !== null && x !== undefined) texts.push(String(x)); });
      else return;
      texts.forEach(function (text) {
        var nt = _apfrComplianceGateNormalize(text);
        if (nt === '') return;
        APFR_DISCLOSURE_ACCEPTED_MARKERS.forEach(function (m) {
          if (m.type === 'hashtag') return;
          if (nt.indexOf(m.normalized) !== -1) add(m.display);
        });
        var re = /#([^\s#]+)/g, tm;
        while ((tm = re.exec(nt)) !== null) {
          APFR_DISCLOSURE_ACCEPTED_MARKERS.forEach(function (m) {
            if (m.type !== 'hashtag') return;
            if (tm[1] === m.normalized) add(m.display);
          });
        }
      });
    });
    return { executed: true, checked: true, requirementPresent: true, foundMarkers: found, status: found.length > 0 ? 'satisfied' : 'missing' };
  } catch (e) { return EMPTY; }
}
function _apfrEvaluateComplianceAssessment(outputDraft, complianceContext) {
  var EMPTY = { executed: false, status: 'not_checked', blockers: [], unchecked: [], details: { compliance: null, disclosure: null } };
  try {
    if (!outputDraft || typeof outputDraft !== 'object') return EMPTY;
    if (!complianceContext || typeof complianceContext !== 'object') return EMPTY;
    var c = evaluateComplianceGate(outputDraft, complianceContext);
    var d = _apfrEvaluateDisclosureMarkers(outputDraft, complianceContext);
    var blockers = [], unchecked = [];
    if (c.status === 'violation') blockers.push('listing_ng_words');
    else if (c.status === 'not_checked') unchecked.push('listing_ng_words');
    if (d.status === 'missing') blockers.push('advertising_disclosure');
    else if (d.status === 'not_checked') unchecked.push('advertising_disclosure');
    var status = blockers.length > 0 ? 'blocked' : ((c.status === 'not_checked' && d.status === 'not_checked') ? 'not_checked' : 'clear');
    return { executed: true, status: status, blockers: blockers, unchecked: unchecked, details: { compliance: c, disclosure: d } };
  } catch (e) { return EMPTY; }
}

// ── 今回の新規helper（index.html実装と同一） ──────────────────────
const APFR_LISTING_AD_ONLY_FIELDS = ['listingNgWords'];
const APFR_INSTAGRAM_ORGANIC_TYPES = ['instagram_carousel', 'instagram_post'];
function _apfrIsInstagramOrganicOutput(outputDraft) {
  return !!(outputDraft && typeof outputDraft.type === 'string'
    && APFR_INSTAGRAM_ORGANIC_TYPES.indexOf(outputDraft.type) !== -1);
}
function _apfrScopeComplianceContextForOutput(complianceContext, outputDraft) {
  try {
    if (!complianceContext || typeof complianceContext !== 'object' || Array.isArray(complianceContext)) return complianceContext;
    if (!_apfrIsInstagramOrganicOutput(outputDraft)) return complianceContext;
    var scoped = {};
    Object.keys(complianceContext).forEach(function (k) {
      if (APFR_LISTING_AD_ONLY_FIELDS.indexOf(k) !== -1) return;
      scoped[k] = complianceContext[k];
    });
    return scoped;
  } catch (e) { return complianceContext; }
}
// Enforcement（index.html _apfrEvaluateMobileApprovalCompliance と同一のscope適用順）
function mobileEnf(draft, ctx) {
  var scoped = _apfrScopeComplianceContextForOutput(ctx, draft);
  var a = _apfrEvaluateComplianceAssessment(draft, scoped);
  var status = (a && typeof a.status === 'string') ? a.status : 'not_checked';
  return { evaluated: !!(a && a.executed), blocked: status === 'blocked', status: status, blockers: a.blockers || [], unchecked: a.unchecked || [] };
}

// ── 実案件（プラファスト）相当 fixture ────────────────────────────
const REAL_CTX = {
  listingNgWords: ['商品名', '法人名'],
  advertisingDisclosureRequirements: ['広告とわかる表示が必要', 'ファーストビュー等の一般消費者が閲覧できる位置にわかりやすく表示'],
  complianceRestrictions: ['A8.netのルール遵守', '広告表示必須', '法律関連の禁止事項遵守', 'リスティング違反禁止'],
  regulatoryCategory: '医薬部外品',
};
// E2Eで実際にviolationとなった本文（備考に「商品名」という語を含む）
function mkIgDraft(extra) {
  return Object.assign({
    id: 'out_test', type: 'instagram_post', status: 'ready',
    fields: {
      caption: '【PR】プラファストをご紹介します。※商品名「プラファスト」はリスティングNGワードのため注記します。',
      cta: 'プロフィールのリンクから',
      hashtags: ['#スキンケア', '#プラファスト'],
    },
  }, extra || {});
}

console.log('APFR C-1C-1c listingNgWords Channel Scope Fix 回帰テスト（実AI API 0件・DB変更0）');

// ══════════════════════════════════════════════════════════════
caseHeader('1. 静的検証: helperと用途境界が実装されている');
{
  assert(indexSrc.indexOf("const APFR_LISTING_AD_ONLY_FIELDS = ['listingNgWords'];") !== -1, '1-1. リスティング広告専用field定義が存在');
  assert(indexSrc.indexOf("const APFR_INSTAGRAM_ORGANIC_TYPES = ['instagram_carousel', 'instagram_post'];") !== -1, '1-2. Instagram organic type定義が存在');
  assert(indexSrc.indexOf('function _apfrIsInstagramOrganicOutput(outputDraft) {') !== -1, '1-3. _apfrIsInstagramOrganicOutput() が存在');
  assert(indexSrc.indexOf('function _apfrScopeComplianceContextForOutput(complianceContext, outputDraft) {') !== -1, '1-4. _apfrScopeComplianceContextForOutput() が存在');
  assert(indexSrc.indexOf('リスティング広告で入札・出稿を禁止する検索キーワード') !== -1, '1-5. Formal Contract（A8.net公式定義）がコメントに明記されている');
}

caseHeader('2. 静的検証: 既存detector/Assessment/Resolverは無変更');
{
  assert(indexSrc.indexOf('function evaluateComplianceGate(outputDraft, complianceContext) {') !== -1, '2-1. evaluateComplianceGate() シグネチャ不変');
  const cgStart = indexSrc.indexOf('function evaluateComplianceGate(outputDraft, complianceContext) {');
  const cgBody = indexSrc.slice(cgStart, indexSrc.indexOf('\n}\n', cgStart));
  assert(cgBody.indexOf('var rawNgWords = complianceContext.listingNgWords;') !== -1, '2-2. listingNgWords判定ロジックが既存のまま');
  assert(cgBody.indexOf('APFR_LISTING_AD_ONLY_FIELDS') === -1 && cgBody.indexOf('_apfrScopeComplianceContextForOutput') === -1,
    '2-3. evaluateComplianceGate()本体にscope helperへの参照0件（detector無変更）');

  const dmStart = indexSrc.indexOf('function _apfrEvaluateDisclosureMarkers(outputDraft, complianceContext) {');
  const dmBody = indexSrc.slice(dmStart, indexSrc.indexOf('\n}\n', dmStart));
  assert(dmStart !== -1 && dmBody.indexOf('_apfrScopeComplianceContextForOutput') === -1, '2-4. _apfrEvaluateDisclosureMarkers() 無変更');

  const asStart = indexSrc.indexOf('function _apfrEvaluateComplianceAssessment(outputDraft, complianceContext) {');
  const asBody = indexSrc.slice(asStart, indexSrc.indexOf('\n}\n', asStart));
  assert(asStart !== -1 && asBody.indexOf('_apfrScopeComplianceContextForOutput') === -1, '2-5. _apfrEvaluateComplianceAssessment() 無変更');

  const bcStart = indexSrc.indexOf('function _apfrBuildComplianceContext(product) {');
  const bcBody = indexSrc.slice(bcStart, indexSrc.indexOf('\n}\n', bcStart));
  assert(bcStart !== -1 && bcBody.indexOf('APFR_LISTING_AD_ONLY_FIELDS') === -1, '2-6. _apfrBuildComplianceContext() 無変更（4field構築のまま）');
  assert(indexSrc.indexOf("const APFR_COMPLIANCE_CONTEXT_FIELDS = ['listingNgWords', 'advertisingDisclosureRequirements', 'complianceRestrictions', 'regulatoryCategory'];") !== -1,
    '2-7. C-1A Compliance Context 4field Contract 不変（listingNgWordsを削除していない）');
}

caseHeader('3. 静的検証: Formal Truth / schema / Resolver / caseId Binding 無変更');
{
  assert(indexSrc.indexOf("listingNgWords:                   { label: 'リスティングNGワード',  type: 'array',   group: 'Compliance' },") !== -1,
    '3-1. APFR_FIELD_META の listingNgWords 定義が不変（schema変更0）');
  assert(indexSrc.indexOf("'listingNgWords','regulatoryCategory','complianceRestrictions','advertisingDisclosureRequirements',") !== -1,
    '3-2. APFR_FIELD_ORDER の listing/compliance field 群が順序内に保持されている（末尾かどうかは Contract 外）');
  assert(indexSrc.indexOf('function _apfrResolveCurrentFact(product, field) {') !== -1, '3-3. APFR Resolver 無変更');
  assert(indexSrc.indexOf('if (!_lastOutputDraft.caseId && _atRunCaseId) _lastOutputDraft.caseId = _atRunCaseId;') !== -1,
    '3-4. P1-1 caseId Binding 不変');
  assert(indexSrc.indexOf('function _apfrCurrentAdoptedProduct() {') !== -1, '3-5. _apfrCurrentAdoptedProduct()（Cross-case guard）無変更');
}

caseHeader('4. 静的検証: 表示側・Enforcement側の両方へ同一scopeが適用されている');
{
  const cnt = indexSrc.split('_apfrScopeComplianceContextForOutput(complianceContext, _lastOutputDraft)').length - 1;
  assert(cnt === 2, '4-1. scope適用が表示側とEnforcement側の2箇所（実際: ' + cnt + '）');
  const mcStart = indexSrc.indexOf('function _apfrEvaluateMobileApprovalCompliance() {');
  const mcBody = indexSrc.slice(mcStart, indexSrc.indexOf('\n}\n', mcStart));
  assert(mcBody.indexOf('_apfrScopeComplianceContextForOutput') !== -1, '4-2. Mobile Approval Enforcement入力にscopeが適用されている');
  const bgStart = indexSrc.indexOf('function buildComplianceGateHtml() {');
  const bgBody = indexSrc.slice(bgStart, bgStart + 4000);
  assert(bgBody.indexOf('_apfrScopeComplianceContextForOutput') !== -1, '4-3. 表示側にもscopeが適用されている');
  assert(indexSrc.indexOf('リスティングNGワードはリスティング広告の出稿キーワード制約のため、Instagram投稿本文では検査しません') !== -1,
    '4-4. NOT CHECKED時に「未登録」ではなく用途境界を説明する文言がある');
}

caseHeader('5. 静的検証: AI Context の用途境界（openaiClient.js）');
{
  assert(ocSrc.indexOf("listingNgWords: 'リスティング広告の出稿禁止キーワード（検索連動型広告で入札・出稿しないこと。Instagram等の通常投稿本文でこの語や商品名を使ってはいけないという意味ではない）',") !== -1,
    '5-1. listingNgWordsのpromptラベルが用途境界を明示している');
  assert(ocSrc.indexOf("listingNgWords: '禁止表現（使用しないこと）',") === -1, '5-2. 誤解を招く旧ラベル「禁止表現（使用しないこと）」が残っていない');
  assert(ocSrc.indexOf("advertisingDisclosureRequirements: '広告表示義務（必ず遵守すること）',") !== -1, '5-3. 広告表示義務のラベルは無変更');
  assert(ocSrc.indexOf("complianceRestrictions: 'その他の制約（この範囲のみ遵守すること）',") !== -1, '5-4. complianceRestrictionsのラベルは無変更');
  assert(ocSrc.indexOf("const APFR_COMPLIANCE_PROMPT_FIELD_ORDER = ['listingNgWords', 'advertisingDisclosureRequirements', 'complianceRestrictions', 'regulatoryCategory'];") !== -1,
    '5-5. AI Contextへは引き続き4field全てを渡す（listingNgWordsをAIから隠さない）');
}

// ══════════════════════════════════════════════════════════════
caseHeader('6. 回帰1: listingNgWords保持のままInstagram本文に「商品名」が含まれてもviolationにならない');
{
  const draft = mkIgDraft();
  assert(REAL_CTX.listingNgWords.join(',') === '商品名,法人名', '6-1. 前提: Formal Truth は ["商品名","法人名"] のまま保持');

  // 修正前（scope適用なし）
  const before = evaluateComplianceGate(draft, REAL_CTX);
  assert(before.status === 'violation' && before.violations[0].ngWord === '商品名',
    '6-2. 修正前は caption 内の「商品名」で violation（E2E実測の再現）');

  // 修正後（scope適用）
  const scoped = _apfrScopeComplianceContextForOutput(REAL_CTX, draft);
  const after = evaluateComplianceGate(draft, scoped);
  assert(after.status === 'not_checked', '6-3. 修正後は listing判定が not_checked（violationにならない）');
  assert(!('listingNgWords' in scoped), '6-4. Instagram organicではlistingNgWordsが評価入力から除外される');
  assert(REAL_CTX.listingNgWords.length === 2, '6-5. 元のcomplianceContextは非破壊（入力を書き換えない）');
}

caseHeader('7. 回帰2: productName「プラファスト」を正常に使用できる');
{
  const draft = mkIgDraft({ fields: { caption: '【PR】プラファストの紹介です。', cta: 'リンクから', hashtags: ['#プラファスト'] } });
  const scoped = _apfrScopeComplianceContextForOutput(REAL_CTX, draft);
  const a = _apfrEvaluateComplianceAssessment(draft, scoped);
  assert(a.status !== 'blocked', '7-1. 商品名「プラファスト」を本文に使ってもblockedにならない');
  assert(a.details.compliance.violations.length === 0, '7-2. listing violation 0件');
  assert(mobileEnf(draft, REAL_CTX).blocked === false, '7-3. Mobile Approval もblockされない');
}

caseHeader('8. 回帰3: advertising disclosure detector は従来どおり動く');
{
  const ok = mkIgDraft({ fields: { caption: '【PR】プラファストの紹介です。' } });
  const scopedOk = _apfrScopeComplianceContextForOutput(REAL_CTX, ok);
  assert(_apfrEvaluateDisclosureMarkers(ok, scopedOk).status === 'satisfied', '8-1. 【PR】あり → satisfied');
  const ng = mkIgDraft({ fields: { caption: 'プラファストの紹介です。' } });
  const scopedNg = _apfrScopeComplianceContextForOutput(REAL_CTX, ng);
  assert(_apfrEvaluateDisclosureMarkers(ng, scopedNg).status === 'missing', '8-2. マーカーなし → missing');
  const hash = mkIgDraft({ fields: { caption: 'プラファストの紹介です。', hashtags: ['#PR'] } });
  assert(_apfrEvaluateDisclosureMarkers(hash, _apfrScopeComplianceContextForOutput(REAL_CTX, hash)).status === 'satisfied', '8-3. #PR も従来どおり検出');
}

caseHeader('9. 回帰4: disclosure missing なら Mobile Approval は block される');
{
  const ng = mkIgDraft({ fields: { caption: 'プラファストの紹介です。', cta: 'リンクから', hashtags: ['#スキンケア'] } });
  const r = mobileEnf(ng, REAL_CTX);
  assert(r.status === 'blocked' && r.blocked === true, '9-1. 開示マーカーなし → blocked:true（Enforcement維持）');
  assert(r.blockers.indexOf('advertising_disclosure') !== -1, '9-2. blocker は advertising_disclosure');
  assert(r.blockers.indexOf('listing_ng_words') === -1, '9-3. listing_ng_words は blocker に含まれない');
  assert(r.unchecked.indexOf('listing_ng_words') !== -1, '9-4. listing_ng_words は unchecked として明示される（握りつぶさない）');
}

caseHeader('10. 回帰5: disclosure satisfied なら listingNgWords だけを理由にblockされない');
{
  const draft = mkIgDraft(); // caption に「商品名」を含み、かつ【PR】あり
  const r = mobileEnf(draft, REAL_CTX);
  assert(r.status === 'clear', '10-1. 開示ありなら status=clear（listingを理由にblockedにしない）');
  assert(r.blocked === false, '10-2. Mobile Approval blocked:false');
  assert(r.evaluated === true, '10-3. evaluated:true（未評価へ退行していない）');

  // 修正前は blocked だったことを固定
  const beforeA = _apfrEvaluateComplianceAssessment(draft, REAL_CTX);
  assert(beforeA.status === 'blocked' && beforeA.blockers.indexOf('listing_ng_words') !== -1,
    '10-4. 修正前は listing_ng_words を理由に blocked だった（E2E誤blockの再現）');
}

caseHeader('11. 他チャネル・他Output Typeでは従来どおり listingNgWords を評価する');
{
  const lp = { id: 'o', type: 'lp', fields: { body: '商品名を掲載します' } };
  const scopedLp = _apfrScopeComplianceContextForOutput(REAL_CTX, lp);
  assert('listingNgWords' in scopedLp, '11-1. lp では listingNgWords を除外しない');
  assert(evaluateComplianceGate(lp, scopedLp).status === 'violation', '11-2. lp では従来どおり violation');

  const flyer = { id: 'o', type: 'flyer', fields: { body: '法人名を掲載します' } };
  assert('listingNgWords' in _apfrScopeComplianceContextForOutput(REAL_CTX, flyer), '11-3. flyer でも除外しない');

  const carousel = { id: 'o', type: 'instagram_carousel', fields: { caption: '商品名' } };
  assert(!('listingNgWords' in _apfrScopeComplianceContextForOutput(REAL_CTX, carousel)), '11-4. instagram_carousel は除外対象');
  const post = { id: 'o', type: 'instagram_post', fields: { caption: '商品名' } };
  assert(!('listingNgWords' in _apfrScopeComplianceContextForOutput(REAL_CTX, post)), '11-5. instagram_post は除外対象');
}

caseHeader('12. fail-open / 入力異常');
{
  assert(_apfrScopeComplianceContextForOutput(null, mkIgDraft()) === null, '12-1. complianceContext=null はそのまま返す');
  assert(_apfrScopeComplianceContextForOutput(undefined, mkIgDraft()) === undefined, '12-2. undefined はそのまま返す');
  const arr = ['x'];
  assert(_apfrScopeComplianceContextForOutput(arr, mkIgDraft()) === arr, '12-3. 配列はそのまま返す（誤って除外しない）');
  assert('listingNgWords' in _apfrScopeComplianceContextForOutput(REAL_CTX, null), '12-4. outputDraft=null は除外しない（fail-open）');
  assert('listingNgWords' in _apfrScopeComplianceContextForOutput(REAL_CTX, { type: null }), '12-5. type欠落は除外しない（fail-open）');
  assert('listingNgWords' in _apfrScopeComplianceContextForOutput(REAL_CTX, { type: 'unknown_type' }), '12-6. 未知typeは除外しない（fail-open）');
  const empty = _apfrScopeComplianceContextForOutput({}, mkIgDraft());
  assert(Object.keys(empty).length === 0, '12-7. 空contextでも例外なく空を返す');
}

caseHeader('13. Cross-case safety / 他fieldの保全');
{
  const scoped = _apfrScopeComplianceContextForOutput(REAL_CTX, mkIgDraft());
  assert(Array.isArray(scoped.advertisingDisclosureRequirements) && scoped.advertisingDisclosureRequirements.length === 2, '13-1. 広告表示義務は保持される');
  assert(Array.isArray(scoped.complianceRestrictions) && scoped.complianceRestrictions.length === 4, '13-2. complianceRestrictions は保持される');
  assert(scoped.regulatoryCategory === '医薬部外品', '13-3. regulatoryCategory は保持される');
  assert(Object.keys(scoped).length === 3, '13-4. 除外されるのは listingNgWords の1fieldのみ');
  // Cross-case guardは _apfrCurrentAdoptedProduct() 側（無変更）に委譲されている
  assert(indexSrc.indexOf("if (!cur || String(draft.caseId || '') !== String(cur) || String(product.caseId || '') !== String(cur)) return null;") !== -1,
    '13-5. Cross-case guard（caseId三重一致）が無変更で存在する');
}

caseHeader('14. 既存Contract 変更0（Quality Gate / READY / Approval / server / Rule Engine）');
{
  const qgStart = indexSrc.indexOf('function evaluateQualityGate(packageQuality) {');
  const qgBody = indexSrc.slice(qgStart, indexSrc.indexOf('\n}\n', qgStart));
  assert(qgBody.indexOf('QUALITY_GATE_PASSING_STATUSES.indexOf(sourceStatus)') !== -1, '14-1. Quality Gate 無変更');
  assert(qgBody.indexOf('listingNgWords') === -1 && qgBody.indexOf('_apfrScopeComplianceContextForOutput') === -1, '14-2. Quality Gateにscope参照0件');
  assert(indexSrc.indexOf('_lastOutputDraft.status    = noCompletedResults ? OUTPUT_STATUS.ERROR : OUTPUT_STATUS.READY;') !== -1, '14-3. READY判定 無変更');
  assert(indexSrc.indexOf('var canApprove = _mapAllChecked() && _mapReviewApproved(mai) && !_mapCompliance.blocked;') !== -1, '14-4. canApprove 無変更');
  const apStart = indexSrc.indexOf('function approveInstagramPackage() {');
  const apBody = indexSrc.slice(apStart, indexSrc.indexOf('\n}\n', apStart));
  assert(apBody.indexOf('if (_apCompliance.blocked) {') !== -1, '14-5. approveInstagramPackage() のEnforcement 無変更');

  const svNow = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  const svHead = cp.execSync('git show HEAD:server.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 30 }).toString('utf8');
  assert(svNow === svHead, '14-6. server.js がHEADと完全一致（変更0）');
  const clNow = fs.readFileSync(path.join(__dirname, 'claudeClient.js'), 'utf8');
  const clHead = cp.execSync('git show HEAD:claudeClient.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 20 }).toString('utf8');
  assert(clNow === clHead, '14-7. claudeClient.js がHEADと完全一致（変更0）');
  const reNow = fs.readFileSync(path.join(__dirname, 'shared', 'leaderRuleEngine.js'), 'utf8');
  const reHead = cp.execSync('git show HEAD:shared/leaderRuleEngine.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 10 }).toString('utf8');
  assert(reNow === reHead, '14-8. shared/leaderRuleEngine.js がHEADと完全一致（変更0）');

  // Issue A / B は今回実装しない
  assert(indexSrc.indexOf('reviewerSignal') === -1, '14-9. Reviewer structured enforcement は未実装（Issue A・今回対象外）');
  const ocHead = cp.execSync('git show HEAD:openaiClient.js', { cwd: __dirname, maxBuffer: 1024 * 1024 * 30 }).toString('utf8');
  function extractConst(s, name) {
    const st = s.indexOf('const ' + name + ' = [');
    if (st === -1) return null;
    const en = s.indexOf('\n].join', st);
    return s.slice(st, en !== -1 ? en : st + 3000);
  }
  assert(extractConst(ocSrc, 'LEADER_FINAL_PROMPT') === extractConst(ocHead, 'LEADER_FINAL_PROMPT'), '14-10. LEADER_FINAL_PROMPT 無変更');
  assert(ocSrc.indexOf('var LEADER_FINAL_REVIEWER_REJECT_RULE = [') !== -1, '14-11. P1-2 reject遵守Contract は維持されている');
  assert(ocSrc.indexOf('var LEADER_FINAL_POSTPROCESS_TEXT_MAX = 1200;') !== -1, '14-12. P1-2 1200文字化 は維持されている');
}

console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All C-1C-1c listingNgWords Channel Scope cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
