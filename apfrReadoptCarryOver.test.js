'use strict';
// apfrReadoptCarryOver.test.js
// Decision108（APFR）Phase 0: 商品再Adopt時 facts消失防止 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / Web Search 0 / 本番案件への操作0
// index.html内の _apfrFactsOf() / _apfrCarryOverFacts() と等価なロジックをNode環境で再現し、
// 「同一case かつ 同一productIdentifier のときだけ carry-over する」契約を検証する。

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック
// ──────────────────────────────────────────────────────────────
function _apfrFactsOf(product) {
  return (product && Array.isArray(product.facts)) ? product.facts : [];
}

function _apfrCarryOverFacts(prevProduct, nextProduct) {
  try {
    if (!prevProduct || !nextProduct) return [];
    if (typeof prevProduct.caseId !== 'string' || typeof nextProduct.caseId !== 'string') return [];
    if (!prevProduct.caseId || prevProduct.caseId !== nextProduct.caseId) return [];
    if (typeof prevProduct.productIdentifier !== 'string' || typeof nextProduct.productIdentifier !== 'string') return [];
    if (!prevProduct.productIdentifier || prevProduct.productIdentifier !== nextProduct.productIdentifier) return [];
    var facts = _apfrFactsOf(prevProduct);
    if (facts.length === 0) return [];
    return JSON.parse(JSON.stringify(facts));
  } catch (e) {
    return [];
  }
}

// 商品採用処理（index.html adoptAffiliateForContentPlanning 相当）の該当部分だけを再現。
// _intelBlankProduct() は常に facts:[] を返すため、carry-overが無ければ必ずFactが消える。
function simulateReadopt(existingProduct, nextCaseId, nextProductIdentifier, opts) {
  const useCarryOver = !(opts && opts.withoutFix === true);
  // deep copy（実装側の JSON.parse(JSON.stringify(baseCtx)) 相当）
  const ctx = JSON.parse(JSON.stringify({ caseId: nextCaseId, product: existingProduct }));
  // _intelSyncProductFromAffiliate → _intelBlankProduct 相当（facts:[] の新product）
  const product = {
    caseId: nextCaseId, productIdentifier: nextProductIdentifier,
    productName: 'プラファスト', aspName: 'A8.net', facts: [],
  };
  if (useCarryOver) product.facts = _apfrCarryOverFacts(ctx.product, product);
  ctx.product = product;
  return ctx.product;
}

// ──────────────────────────────────────────────────────────────
// 2. テストハーネス（既存 apfrCore.test.js と同形式）
// ──────────────────────────────────────────────────────────────
let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log(`  ✅ ${label}`); }
  else { _failed++; console.log(`  ❌ ${label}`); }
}
function caseHeader(t) { console.log(`\n── ${t} ──`); }

// ──────────────────────────────────────────────────────────────
// 3. fixture（本番プラファスト22 Fact構成を再現・実DBは参照しない）
// ──────────────────────────────────────────────────────────────
const PID_PRAFAST = JSON.stringify(['プラファスト', 'a8.net']);   // 実装は常に文字列（配列ではない）
const CASE_A = 'case-test-A';
const CASE_B = 'case-test-B';
const PID_OTHER = JSON.stringify(['別商品', 'a8.net']);

function mkFact(field, value, factId, recordedAt, sourceMethod) {
  return {
    field: field, value: value, caseId: CASE_A, factId: factId, aspName: 'A8.net',
    recordedAt: recordedAt, verifiedAt: recordedAt, verifiedBy: 'user',
    sourceMethod: sourceMethod || 'a8_screen_user_verified',
    classification: 'fact', sourceReference: null,
    productIdentifier: PID_PRAFAST, verificationStatus: 'user_verified',
  };
}

// 本番と同じ21フィールド＋listingNgWords訂正履歴1件 ＝ 22レコード
const FIELDS_21 = [
  ['aspName', 'A8.net'], ['programId', 's00000015266009'], ['productName', 'プラファスト'],
  ['productCategory', 'スキンケア'], ['partnershipStatus', '提携中'],
  ['landingUrl', 'https://leona-beauty.jp/prafast/a8/'], ['productLinkAvailable', true],
  ['payout', '5000'], ['epc', 34.24], ['approvalRate', 100], ['cookieWindowDays', 90],
  ['approvalEstimateDays', 30], ['reviewRequired', true], ['mobileOptimized', true],
  ['itpSupported', true], ['linkManagerSupported', true], ['listingPolicy', '一部ok'],
  ['listingNgWords', ['商品名', '法人名']], ['regulatoryCategory', '医薬部外品'],
  ['complianceRestrictions', ['A8.netのルール遵守', '広告表示必須', '法律関連の禁止事項遵守', 'リスティング違反禁止']],
  ['advertisingDisclosureRequirements', ['広告とわかる表示が必要', 'ファーストビュー等の一般消費者が閲覧できる位置にわかりやすく表示']],
];

function build22Facts() {
  const out = [];
  let t = Date.parse('2026-08-21T21:00:00.000Z');
  FIELDS_21.forEach(function (pair, i) {
    if (pair[0] === 'listingNgWords') {
      // 訂正履歴: 旧Fact ["法人名"] → 新Fact ["商品名","法人名"]
      out.push(mkFact('listingNgWords', ['法人名'], 'apf_old_ng', new Date(t += 60000).toISOString()));
      out.push(mkFact('listingNgWords', ['商品名', '法人名'], 'apf_new_ng', new Date(t += 60000).toISOString()));
      return;
    }
    const sm = (pair[0] === 'regulatoryCategory') ? 'advertiser_lp_user_verified' : 'a8_screen_user_verified';
    out.push(mkFact(pair[0], pair[1], 'apf_' + i, new Date(t += 60000).toISOString(), sm));
  });
  return out;
}

function mkProduct(caseId, pid, facts) {
  return { caseId: caseId, productIdentifier: pid, productName: 'プラファスト', aspName: 'A8.net', facts: facts };
}

// ──────────────────────────────────────────────────────────────
caseHeader('前提: fixtureが本番構成（21 field / 22 record）と一致');
{
  const f = build22Facts();
  assert(f.length === 22, '0-1. fixtureは22レコード');
  assert(new Set(f.map(x => x.field)).size === 21, '0-2. distinct fieldは21');
  assert(f.filter(x => x.field === 'listingNgWords').length === 2, '0-3. listingNgWordsのみ2レコード（訂正履歴）');
}

// ──────────────────────────────────────────────────────────────
caseHeader('1. same case + same productIdentifier + facts 22件');
{
  const prev = mkProduct(CASE_A, PID_PRAFAST, build22Facts());
  const next = simulateReadopt(prev, CASE_A, PID_PRAFAST);
  assert(next.facts.length === 22, '1-1. 再Adopt後も22件維持');
  assert(JSON.stringify(next.facts) === JSON.stringify(build22Facts()), '1-2. 全Factが内容完全一致');
  assert(new Set(next.facts.map(x => x.field)).size === 21, '1-3. 21フィールドすべて維持');
}

// ──────────────────────────────────────────────────────────────
caseHeader('2. same case + same productIdentifier + facts 0件');
{
  const prev = mkProduct(CASE_A, PID_PRAFAST, []);
  const next = simulateReadopt(prev, CASE_A, PID_PRAFAST);
  assert(Array.isArray(next.facts) && next.facts.length === 0, '2-1. 0件のまま（虚偽Fact生成なし）');
}

// ──────────────────────────────────────────────────────────────
caseHeader('3. same case + different productIdentifier → carry-over 0');
{
  const prev = mkProduct(CASE_A, PID_PRAFAST, build22Facts());
  const next = simulateReadopt(prev, CASE_A, PID_OTHER);
  assert(next.facts.length === 0, '3-1. 別商品へは持ち越さない（Cross-product guard）');
  assert(next.productIdentifier === PID_OTHER, '3-2. 新商品のproductIdentifierが保持される');
}

// ──────────────────────────────────────────────────────────────
caseHeader('4. different case + same productIdentifier → carry-over 0');
{
  const prev = mkProduct(CASE_A, PID_PRAFAST, build22Facts());
  const next = simulateReadopt(prev, CASE_B, PID_PRAFAST);
  assert(next.facts.length === 0, '4-1. 別caseへは持ち越さない（Cross-case guard）');
}

// ──────────────────────────────────────────────────────────────
caseHeader('5. different case + different productIdentifier → carry-over 0');
{
  const prev = mkProduct(CASE_A, PID_PRAFAST, build22Facts());
  const next = simulateReadopt(prev, CASE_B, PID_OTHER);
  assert(next.facts.length === 0, '5-1. 別case・別商品は持ち越さない');
}

// ──────────────────────────────────────────────────────────────
caseHeader('6. legacy product（factsキーなし）→ 安全に[]');
{
  const legacy = { caseId: CASE_A, productIdentifier: PID_PRAFAST, productName: 'プラファスト' }; // factsキーなし
  const next = simulateReadopt(legacy, CASE_A, PID_PRAFAST);
  assert(Array.isArray(next.facts) && next.facts.length === 0, '6-1. factsキー未存在でも例外なく[]');
  assert(_apfrCarryOverFacts(null, mkProduct(CASE_A, PID_PRAFAST, [])).length === 0, '6-2. prevProduct=null → []');
  assert(_apfrCarryOverFacts(mkProduct(CASE_A, PID_PRAFAST, []), null).length === 0, '6-3. nextProduct=null → []');
  assert(_apfrCarryOverFacts({ caseId: CASE_A }, { caseId: CASE_A }).length === 0, '6-4. productIdentifier欠落 → []（安全側）');
  assert(_apfrCarryOverFacts({ caseId: '', productIdentifier: PID_PRAFAST, facts: [mkFact('epc', 1, 'x', '2026-08-21T00:00:00.000Z')] },
                             { caseId: '', productIdentifier: PID_PRAFAST }).length === 0, '6-5. 空caseId同士は一致扱いしない → []');
}

// ──────────────────────────────────────────────────────────────
caseHeader('7. existing facts 入力非破壊');
{
  const original = build22Facts();
  const prev = mkProduct(CASE_A, PID_PRAFAST, original);
  const snapshot = JSON.stringify(original);
  const next = simulateReadopt(prev, CASE_A, PID_PRAFAST);
  next.facts.push(mkFact('epc', 999, 'apf_new', '2026-08-22T00:00:00.000Z'));
  next.facts[0].value = 'MUTATED';
  assert(JSON.stringify(original) === snapshot, '7-1. 元facts配列は書き換わらない');
  assert(prev.facts.length === 22, '7-2. prevProduct.factsの件数は不変');
  assert(prev.facts[0].value !== 'MUTATED', '7-3. prevProductのRecordは書き換わらない');
}

// ──────────────────────────────────────────────────────────────
caseHeader('8. next product 入力非破壊 / 純関数性');
{
  const prev = mkProduct(CASE_A, PID_PRAFAST, build22Facts());
  const nextProduct = { caseId: CASE_A, productIdentifier: PID_PRAFAST, facts: [] };
  const before = JSON.stringify(nextProduct);
  const result = _apfrCarryOverFacts(prev, nextProduct);
  assert(JSON.stringify(nextProduct) === before, '8-1. _apfrCarryOverFacts自体はnextProductを書き換えない');
  assert(Array.isArray(result) && result.length === 22, '8-2. 戻り値として22件を返す');
  const r2 = _apfrCarryOverFacts(prev, nextProduct);
  assert(JSON.stringify(r2) === JSON.stringify(result), '8-3. 複数回呼んでも同一結果（副作用なし）');
}

// ──────────────────────────────────────────────────────────────
caseHeader('9. fact object deep clone確認');
{
  const prev = mkProduct(CASE_A, PID_PRAFAST, build22Facts());
  const next = simulateReadopt(prev, CASE_A, PID_PRAFAST);
  assert(next.facts !== prev.facts, '9-1. 配列参照が異なる');
  assert(next.facts[0] !== prev.facts[0], '9-2. Record objectの参照が異なる');
  const ngNew = next.facts.find(f => f.factId === 'apf_new_ng');
  const ngPrev = prev.facts.find(f => f.factId === 'apf_new_ng');
  assert(ngNew.value !== ngPrev.value, '9-3. 配列valueも別参照（ネストまでclone）');
  ngNew.value.push('侵入');
  assert(ngPrev.value.length === 2, '9-4. clone側の変更が元Recordへ波及しない');
}

// ──────────────────────────────────────────────────────────────
caseHeader('10. duplicate Fact追加なし');
{
  const prev = mkProduct(CASE_A, PID_PRAFAST, build22Facts());
  let cur = prev;
  for (let i = 0; i < 5; i++) cur = mkProduct(CASE_A, PID_PRAFAST, simulateReadopt(cur, CASE_A, PID_PRAFAST).facts);
  assert(cur.facts.length === 22, '10-1. 5回連続再Adoptでも22件のまま（増殖なし）');
  const ids = cur.facts.map(f => f.factId);
  assert(new Set(ids).size === ids.length, '10-2. factIdは全てunique（重複生成なし）');
}

// ──────────────────────────────────────────────────────────────
caseHeader('11. listingNgWords訂正履歴2件もそのまま維持');
{
  const prev = mkProduct(CASE_A, PID_PRAFAST, build22Facts());
  const next = simulateReadopt(prev, CASE_A, PID_PRAFAST);
  const ng = next.facts.filter(f => f.field === 'listingNgWords');
  assert(ng.length === 2, '11-1. 訂正履歴を含め2件維持');
  assert(JSON.stringify(ng[0].value) === JSON.stringify(['法人名']), '11-2. 旧Fact ["法人名"] が残存（削除されない）');
  assert(JSON.stringify(ng[1].value) === JSON.stringify(['商品名', '法人名']), '11-3. 訂正Fact ["商品名","法人名"] が残存');
  assert(Date.parse(ng[0].recordedAt) < Date.parse(ng[1].recordedAt), '11-4. recordedAtの前後関係が維持される');
}

// ──────────────────────────────────────────────────────────────
caseHeader('12. Fact順序維持');
{
  const original = build22Facts();
  const prev = mkProduct(CASE_A, PID_PRAFAST, original);
  const next = simulateReadopt(prev, CASE_A, PID_PRAFAST);
  assert(JSON.stringify(next.facts.map(f => f.factId)) === JSON.stringify(original.map(f => f.factId)), '12-1. factIdの並び順が完全一致');
  assert(JSON.stringify(next.facts.map(f => f.recordedAt)) === JSON.stringify(original.map(f => f.recordedAt)), '12-2. recordedAtの並び順が完全一致（並べ替えなし）');
}

// ──────────────────────────────────────────────────────────────
caseHeader('13. 修正前後の差分（回帰の証明）');
{
  const prev = mkProduct(CASE_A, PID_PRAFAST, build22Facts());
  const broken = simulateReadopt(prev, CASE_A, PID_PRAFAST, { withoutFix: true });
  assert(broken.facts.length === 0, '13-1. 修正なしでは22 Factが消失する（問題の再現）');
  const fixed = simulateReadopt(prev, CASE_A, PID_PRAFAST);
  assert(fixed.facts.length === 22, '13-2. 修正ありでは22 Factが維持される');
}

// ──────────────────────────────────────────────────────────────
caseHeader('14. APFR Contract非変更の確認（schemaを増減しない）');
{
  const prev = mkProduct(CASE_A, PID_PRAFAST, build22Facts());
  const next = simulateReadopt(prev, CASE_A, PID_PRAFAST);
  const expectedKeys = Object.keys(build22Facts()[0]).sort().join(',');
  const actualKeys = Object.keys(next.facts[0]).sort().join(',');
  assert(actualKeys === expectedKeys, '14-1. Record schemaにキーを追加・削除していない');
  assert(next.facts.every(f => f.classification === 'fact'), '14-2. classificationを書き換えていない');
  assert(next.facts.every(f => f.verificationStatus === 'user_verified' && f.verifiedBy === 'user'), '14-3. verification情報を書き換えていない');
  assert(next.facts.filter(f => f.sourceMethod === 'advertiser_lp_user_verified').length === 1, '14-4. sourceMethodを書き換えていない');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All APFR Phase 0 readopt carry-over cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
