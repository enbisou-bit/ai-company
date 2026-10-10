'use strict';
// dailyProductionContract.test.js
// Instagram Daily Production — Step 1: テーマ＋根拠パック／制作契約／文案ルール検査 の deterministic テスト。
//
//   実HTTP 0 / 実AI API 0 / Web 検索 0 / DB 0 / Storage 0 / 本番API 0。
//   ★ 下の根拠・確認記録はすべて「検証用 fixture」であり、実際の Human 確認記録ではない。
//     会話内で調べた7テーマを verified として登録するものでも、canonical Evidence 登録でもない。

const fs = require('fs');
const path = require('path');
const tp = require('./shared/dailyTopicPack');
const pc = require('./shared/dailyProductionContract');
const cv = require('./shared/dailyCopyValidator');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }
function clone(v) { return JSON.parse(JSON.stringify(v)); }
function deepFreeze(o) { Object.freeze(o); Object.keys(o).forEach(function (k) { if (o[k] && typeof o[k] === 'object' && !Object.isFrozen(o[k])) deepFreeze(o[k]); }); return o; }
function codes(issues) { return issues.map(function (i) { return i.code; }); }

// ── 検証用 fixture（TEST FIXTURE ONLY: 実際の確認記録ではない） ──
const FIXTURE_SOURCE = {
  sourceId: 's1',
  url: 'https://www.aad.org/public/everyday-care/skin-care-basics/care/face-washing-101',
  publisher: 'American Academy of Dermatology',
  title: 'Face washing 101',
  locator: 'TEST FIXTURE: 洗顔の手順の箇条',
  checkedOn: '2026-10-08',
  scope: 'TEST FIXTURE: 洗い方・回数・拭き方のみ',
  limitations: 'TEST FIXTURE: つっぱりの原因は特定しない',
  verification: { status: 'human_verified', verifiedBy: 'test-fixture' },
};
const VALID_PACK = {
  version: 1,
  topicId: 'face-wash-tightness',
  status: 'human_verified',
  concern: { scene: '夜、洗顔したあと', problem: '顔がつっぱる' },
  coreAction: '洗い方を見直す',
  claims: [
    { claimId: 'r1', kind: 'reason', status: 'human_verified', sourceIds: ['s1'], text: 'こすると肌への刺激になる' },
    { claimId: 'a1', kind: 'action', status: 'human_verified', sourceIds: ['s1'], text: 'ぬるま湯でぬらし、指先で洗う' },
    { claimId: 'a2', kind: 'action', status: 'human_verified', sourceIds: ['s1'], text: 'やわらかいタオルで押さえて拭く' },
    { claimId: 'a3', kind: 'action', status: 'human_verified', sourceIds: ['s1'], text: '洗顔は1日2回と汗をかいた後にする' },
    { claimId: 'c1', kind: 'caution', status: 'human_verified', sourceIds: ['s1'], text: '赤みやかゆみが続くときは皮膚科に相談する' },
  ],
  sources: [FIXTURE_SOURCE],
};

function validCopy(spec) {
  return {
    topicId: spec.topicId,
    outputType: 'instagram_carousel',
    contentType: 'value',
    slides: [
      { index: 1, role: 'scene_problem', headline: '洗顔後、つっぱる？', lines: [{ text: '夜の洗顔のあと、顔がつっぱる', claimIds: [] }] },
      { index: 2, role: 'verified_reason', headline: 'こすると刺激に', lines: [{ text: 'ゴシゴシこすると肌への刺激になります', claimIds: ['r1'] }] },
      { index: 3, role: 'steps', headline: '今夜の洗い方', lines: [
        { text: 'ぬるま湯で顔をぬらす', claimIds: ['a1'] },
        { text: '洗顔料は指先でやさしく洗う', claimIds: ['a1'] },
        { text: 'やわらかいタオルで押さえて拭く', claimIds: ['a2'] },
        { text: '洗顔は朝と夜の1日2回まで', claimIds: ['a3'] },
      ] },
      { index: 4, role: 'additional_action_or_caution', headline: '続くときは', lines: [{ text: '赤みやかゆみが続くなら皮膚科へ', claimIds: ['c1'] }] },
      { index: 5, role: 'checklist', headline: '保存用チェックリスト', lines: [
        { text: '□ ぬるま湯と指先で洗う', claimIds: ['a1'] },
        { text: '□ タオルは押さえて拭く', claimIds: ['a2'] },
        { text: '□ 洗顔は1日2回まで', claimIds: ['a3'] },
        { text: '□ 赤み・かゆみが続けば皮膚科', claimIds: ['c1'] },
      ] },
    ],
    caption: { text: '洗顔後のつっぱり。洗い方を見直せることがあります。', claimIds: ['a1'] },
    cta: '今夜の洗顔で、チェックリストを一つ使ってみてください。',
    hashtags: ['#洗顔', '#スキンケア', '#乾燥肌'],
  };
}

// ──────────────────────────────────────────────────────────────
caseHeader('1. 有効な入力から明示型・5枚の制作仕様が作れる');
{
  const v = tp.validateTopicPack(VALID_PACK);
  assert(v.ok === true && v.productionReady === true, '1-1. fixture パックは制作可能');
  assert(v.canonicalEvidenceRegistered === false, '1-2. canonical Evidence 登録済みとは扱わない（今回は未対応）');
  assert(v.verificationBasis === 'declared_in_pack' && v.authorizationVerified === false, '1-2b. 確認状態はパック内の申告であり、認可は確かめていない');
  const r = pc.buildProductionSpec(VALID_PACK);
  assert(r.ok === true, '1-3. 制作仕様が作れる');
  const s = r.spec;
  assert(s.outputType === 'instagram_carousel' && s.contentType === 'value' && s.slideCount === 5, '1-4. 明示値（instagram_carousel／value／5枚）');
  assert(s.productPolicy.productAllowed === false && s.productPolicy.brandAllowed === false && s.productPolicy.affiliateLinkAllowed === false, '1-5. 商品・ブランド・アフィリエイトなし');
  assert(s.slides.length === 5 && s.slides.map(x => x.role).join(',') === 'scene_problem,verified_reason,steps,additional_action_or_caution,checklist', '1-6. 5枚の役割が固定順');
  assert(new Set(s.slides.map(x => x.role)).size === 5, '1-7. 各枚の役割が異なる');
  assert(s.slides[0].allowedClaimIds.length === 0 && s.slides[0].minCitedClaims === 0, '1-8. 1枚目は主張を引用しない');
  assert(s.slides[1].allowedClaimIds.join() === 'r1' && s.slides[1].minCitedClaims === 1, '1-9. 2枚目は理由の主張から1つ以上');
  assert(s.slides[2].allowedClaimIds.join() === 'a1,a2,a3' && s.slides[3].allowedClaimIds.join() === 'c1', '1-10. 注意点があるとき、行動は3枚目・注意点は4枚目（使える主張が重ならない）');
  assert(s.slides[4].allowedClaimIds.join() === 'a1,a2,a3,c1' && s.slides[4].linesMin === 2 && s.slides[4].minCitedClaims === 2, '1-11. 5枚目は行動・注意点から2つ以上のチェックリスト');
  assert(s.slides.every(x => !('requiredClaimIds' in x)), '1-11b. パックの全主張を必須にしない');
  assert(s.limits.provisional === true, '1-11c. 文字量の上限は仮値として明示');
  assert(s.allowedNumbers.join() === '1,2', '1-12. 確認済み主張の数値だけが許可リスト');
  const ins = pc.buildWriterInstruction(s, VALID_PACK);
  assert(typeof ins === 'string' && ins.indexOf('instagram_carousel') !== -1 && ins.indexOf('5枚（固定）') !== -1 && ins.indexOf('[r1]') !== -1, '1-13. Writer 指示文に明示型・枚数・主張IDを含む');
  assert(ins.indexOf('試しましょう') !== -1 && ins.indexOf('商品名・ブランド名・アフィリエイトリンク') !== -1, '1-14. 指示文に締め方・商品なしの規則を含む');
  const pcSrc = fs.readFileSync(path.join(__dirname, 'shared', 'dailyProductionContract.js'), 'utf8');
  assert(!/detectOutputType\s*\(/.test(pcSrc), '1-15. キーワード判定（detectOutputType）を呼ばない');
}

caseHeader('1b. 注意点がないテーマは、行動を1つ4枚目へ残す');
{
  const p = clone(VALID_PACK); p.claims = p.claims.filter(c => c.kind !== 'caution');
  const s = pc.buildProductionSpec(p).spec;
  assert(s.slides[2].allowedClaimIds.join() === 'a1,a2' && s.slides[3].allowedClaimIds.join() === 'a3', '1b-1. 3枚目と4枚目が別の行動になる');
}

caseHeader('2. 未確認の根拠では止まる');
{
  const p1 = clone(VALID_PACK); p1.status = 'unverified';
  const r1 = pc.buildProductionSpec(p1);
  assert(r1.ok === false && r1.reason === 'topic_pack_not_ready' && codes(r1.issues).includes('pack_not_human_verified'), '2-1. パックが未確認なら止まる');
  const p2 = clone(VALID_PACK); p2.claims[1].status = 'unverified';
  const v2 = tp.validateTopicPack(p2);
  assert(v2.productionReady === false && v2.blockedClaimIds.includes('a1') && codes(v2.issues).includes('unverified_claims_present'), '2-2. 未確認の主張が1つでもあれば制作不可');
  assert(pc.buildProductionSpec(p2).ok === false, '2-3. 制作仕様も作らない');
  const p3 = clone(VALID_PACK); p3.sources[0].verification = { status: 'unverified' };
  const v3 = tp.validateTopicPack(p3);
  assert(v3.productionReady === false && codes(v3.issues).includes('claim_has_no_verified_source'), '2-4. 出典が未確認なら、確認済みの主張でも使わない');
  const p4 = clone(VALID_PACK); p4.status = 'rejected';
  assert(tp.validateTopicPack(p4).productionReady === false, '2-5. rejected は制作不可');
  const p5 = clone(VALID_PACK); p5.canonicalEvidenceRegistered = true;
  const v5 = tp.validateTopicPack(p5);
  assert(v5.productionReady === false && v5.canonicalEvidenceRegistered === false && codes(v5.issues).includes('canonical_registration_not_supported_yet'), '2-6. canonical 登録済みの申告は今回は未対応として扱う');
}

caseHeader('3. 根拠URLだけでは verified にならない');
{
  const p = clone(VALID_PACK);
  p.sources = [{ sourceId: 's1', url: FIXTURE_SOURCE.url, verification: { status: 'human_verified', verifiedBy: 'test-fixture' } }];
  const v = tp.validateTopicPack(p);
  const c = codes(v.issues);
  assert(v.productionReady === false, '3-1. URL と状態だけの出典は制作不可');
  assert(['missing_source_publisher', 'missing_source_locator', 'invalid_source_checked_on', 'missing_source_scope', 'missing_source_limitations'].every(x => c.includes(x)), '3-2. 発行元・該当箇所・確認日・確認範囲・限界の欠落を検出');
  const p2 = clone(VALID_PACK); p2.sources[0].verification = { status: 'human_verified' };
  assert(codes(tp.validateTopicPack(p2).issues).includes('missing_source_verified_by'), '3-3. 確認者のない確認済みは不可');
  const p3 = clone(VALID_PACK); delete p3.sources[0].verification;
  assert(tp.validateTopicPack(p3).productionReady === false, '3-4. 確認状態のない出典は確認済みにならない');
  const p4 = clone(VALID_PACK); p4.sources[0].url = 'http://example.com/x';
  assert(codes(tp.validateTopicPack(p4).issues).includes('invalid_source_url'), '3-5. https 以外の URL は不可');
  // 確認日は形式だけを検査し、現在日時と比較しない（未来日付でも形式が正しければ形式エラーにならない）
  const p5 = clone(VALID_PACK); p5.sources[0].checkedOn = '2099-01-01';
  assert(!codes(tp.validateTopicPack(p5).issues).includes('invalid_source_checked_on'), '3-6. 確認日は現在日時と比較しない（形式のみ）');
}

caseHeader('4. 不足／重複した主張IDを検出する');
{
  const p = clone(VALID_PACK); p.claims.push(clone(p.claims[1]));
  const v = tp.validateTopicPack(p);
  assert(v.productionReady === false && codes(v.issues).includes('duplicate_claim_id'), '4-1. パック内の重複した主張ID');
  const p2 = clone(VALID_PACK); p2.claims[0].sourceIds = ['s9'];
  assert(codes(tp.validateTopicPack(p2).issues).includes('unknown_source_id'), '4-2. 存在しない出典ID');
  const p3 = clone(VALID_PACK); p3.claims[0].sourceIds = [];
  assert(codes(tp.validateTopicPack(p3).issues).includes('claim_without_source'), '4-3. 出典のない主張');
  const p4 = clone(VALID_PACK); p4.claims = p4.claims.filter(c => c.kind !== 'reason');
  const r4 = pc.buildProductionSpec(p4);
  assert(r4.ok === false && r4.reason === 'not_feasible_in_5_slides' && r4.reasons.includes('reason_claim_missing'), '4-4. 理由がなければ5枚で成立しないとして止める');
  const p5 = clone(VALID_PACK); p5.claims = p5.claims.filter(c => c.claimId === 'r1' || c.claimId === 'a1');
  const r5 = pc.buildProductionSpec(p5);
  assert(r5.ok === false && r5.reasons.includes('slide4_has_no_distinct_content'), '4-5. 4枚目が3枚目の繰り返しになるテーマは止める（水増ししない）');
  const p6 = clone(VALID_PACK);
  for (let i = 4; i <= 7; i++) p6.claims.push({ claimId: 'a' + i, kind: 'action', status: 'human_verified', sourceIds: ['s1'], text: '行動' + i });
  assert(pc.buildProductionSpec(p6).reasons.includes('checklist_exceeds_line_limit'), '4-6. 行動が多すぎて1投稿に収まらないテーマは止める');

  const spec = pc.buildProductionSpec(VALID_PACK).spec;
  const c1 = validCopy(spec); c1.slides[2].lines[0].claimIds = ['a1', 'a1'];
  assert(codes(cv.validateCopy(c1, spec, VALID_PACK).issues).includes('duplicate_claim_id'), '4-7. 文案の同一行内の重複主張ID');
  const c2 = validCopy(spec); c2.slides[2].lines[2].claimIds = ['zz'];
  assert(codes(cv.validateCopy(c2, spec, VALID_PACK).issues).includes('unknown_claim_id'), '4-8. 存在しない主張ID');
  const c3 = validCopy(spec); c3.slides[3].lines[0].claimIds = [];
  const i3 = codes(cv.validateCopy(c3, spec, VALID_PACK).issues);
  assert(i3.includes('too_few_cited_claims') && i3.includes('uncited_line'), '4-9. 引用する主張の不足と、主張に結びつかない行');
  const c3b = validCopy(spec); c3b.slides[2].lines = c3b.slides[2].lines.slice(0, 2); c3b.slides[4].lines = c3b.slides[4].lines.filter(l => l.claimIds[0] !== 'a3');
  const r3b = cv.validateCopy(c3b, spec, VALID_PACK);
  assert(r3b.ruleCheck === 'pass', '4-9b. 主張 a3 を使わない文案も合格（全主張を詰め込まない）');
  const c4 = validCopy(spec); c4.slides[0].lines[0].claimIds = ['r1'];
  assert(codes(cv.validateCopy(c4, spec, VALID_PACK).issues).includes('claim_not_allowed_on_slide'), '4-10. 1枚目での主張引用は不可');
  const c5 = validCopy(spec); c5.slides[1].lines[0].claimIds = ['a1'];
  assert(codes(cv.validateCopy(c5, spec, VALID_PACK).issues).includes('claim_not_allowed_on_slide'), '4-11. 役割に合わない主張（理由の枚に行動）');
}

caseHeader('5. 4枚／6枚、必須項目不足を検出する');
{
  const spec = pc.buildProductionSpec(VALID_PACK).spec;
  const ok = cv.validateCopy(validCopy(spec), spec, VALID_PACK);
  assert(ok.ruleCheck === 'pass' && ok.issues.length === 0, '5-1. 有効な文案はルール検査に合格');
  const c4 = validCopy(spec); c4.slides = c4.slides.slice(0, 4);
  assert(codes(cv.validateCopy(c4, spec, VALID_PACK).issues).includes('slide_count_mismatch'), '5-2. 4枚を検出');
  const c6 = validCopy(spec); c6.slides.push(clone(c6.slides[4])); c6.slides[5].index = 6;
  assert(codes(cv.validateCopy(c6, spec, VALID_PACK).issues).includes('slide_count_mismatch'), '5-3. 6枚を検出');
  const cm = validCopy(spec); delete cm.slides[1].headline; cm.caption = null; delete cm.cta; cm.hashtags = [];
  const im = codes(cv.validateCopy(cm, spec, VALID_PACK).issues);
  assert(['missing_headline', 'missing_caption', 'missing_cta', 'missing_hashtags'].every(x => im.includes(x)), '5-4. 見出し・caption・CTA・ハッシュタグの不足');
  const cr = validCopy(spec); cr.slides[2].role = 'checklist';
  assert(codes(cv.validateCopy(cr, spec, VALID_PACK).issues).includes('slide_role_mismatch'), '5-5. 役割の取り違え');
  const ct = validCopy(spec); ct.outputType = 'instagram_post';
  assert(codes(cv.validateCopy(ct, spec, VALID_PACK).issues).includes('output_type_mismatch'), '5-6. 出力型の不一致');
  const cl = validCopy(spec); cl.slides[4].lines = [{ text: '試しましょう', claimIds: ['a1'] }];
  const il = codes(cv.validateCopy(cl, spec, VALID_PACK).issues);
  assert(il.includes('too_few_lines') && il.includes('weak_closing'), '5-7. チェックリストが1行・「試しましょう」だけの締めを検出');
  const ch = validCopy(spec); ch.slides[0].headline = 'あ'.repeat(25);
  assert(codes(cv.validateCopy(ch, spec, VALID_PACK).issues).includes('headline_too_long'), '5-8. 長すぎる見出し');
}

caseHeader('6. 根拠にない数値・商品・要注意語を検出する');
{
  const spec = pc.buildProductionSpec(VALID_PACK).spec;
  const c1 = validCopy(spec); c1.slides[2].lines[3].text = '洗顔は1日3回まで';
  assert(codes(cv.validateCopy(c1, spec, VALID_PACK).issues).includes('number_not_in_evidence'), '6-1. 根拠にない数値（3）');
  const c2 = validCopy(spec); c2.caption.text = '洗顔は１日２回。９０％の人が実感';
  const i2 = cv.validateCopy(c2, spec, VALID_PACK).issues.filter(i => i.code === 'number_not_in_evidence');
  assert(i2.length === 1 && i2[0].message.indexOf('90') !== -1, '6-2. 全角数字も正規化し、許可外（90）だけを検出');
  const c3 = validCopy(spec); c3.cta = 'プロフィールのリンク https://example.com から';
  assert(codes(cv.validateCopy(c3, spec, VALID_PACK).issues).includes('link_or_handle_detected'), '6-3. URL を検出');
  const c4 = validCopy(spec); c4.hashtags.push('#PR');
  assert(codes(cv.validateCopy(c4, spec, VALID_PACK).issues).includes('ad_marker_detected'), '6-4. PR 表記を検出');
  const c5 = validCopy(spec); c5.slides[1].lines[0].text = 'これで必ず治ります';
  const i5 = codes(cv.validateCopy(c5, spec, VALID_PACK).issues);
  assert(i5.includes('guarantee_wording') && i5.includes('cure_wording'), '6-5. 保証・治る表現を検出');
  const c6 = validCopy(spec); c6.caption.text = '人気ランキング第1位の方法。私も毎日やっています';
  const i6 = codes(cv.validateCopy(c6, spec, VALID_PACK).issues);
  assert(i6.includes('ranking_wording') && i6.includes('testimonial_wording'), '6-6. ランキング・体験談を検出');
}

caseHeader('7. ルール検査の合格を、医学的な正しさや承認として扱わない');
{
  const spec = pc.buildProductionSpec(VALID_PACK).spec;
  const r = cv.validateCopy(validCopy(spec), spec, VALID_PACK);
  assert(r.ruleCheck === 'pass' && r.approval === 'not_approved' && r.medicalCorrectnessVerified === false, '7-1. 合格でも not_approved・医学的確認なし');
  assert(r.semanticReviewRequired.length === 8 && ['medical_accuracy', 'claim_text_match', 'guarantee_nuance'].every(k => r.semanticReviewRequired.some(x => x.item === k)), '7-2. 意味確認が必要な項目（主張内容との一致を含む）を常に返す');
  assert(r.claimTextMatchVerified === false && r.limitsProvisional === true, '7-2b. 主張IDの対応は内容の一致を保証しない・上限は仮値');
  const cm = validCopy(spec); cm.slides[1].lines[0].text = 'タオルは押さえて拭きましょう';
  const rm = cv.validateCopy(cm, spec, VALID_PACK);
  assert(rm.ruleCheck === 'pass' && rm.claimTextMatchVerified === false, '7-2c. 内容が主張 r1 と合わない行でも ID が正しければルールは通る（意味確認が必要）');
  // 要注意語に当たらない言い換えの保証表現は、ルールでは検出できない（＝合格しても保証表現がないとは言えない）
  const c = validCopy(spec); c.caption.text = 'この洗い方なら、つっぱりとはもうさよならです。';
  const r2 = cv.validateCopy(c, spec, VALID_PACK);
  assert(r2.ruleCheck === 'pass' && r2.approval === 'not_approved' && r2.semanticReviewRequired.some(x => x.item === 'guarantee_nuance'), '7-3. 言い換えの保証表現はルールを通るが、承認せず意味確認へ回す');
  const bad = cv.validateCopy(validCopy(spec), spec, Object.assign(clone(VALID_PACK), { status: 'unverified' }));
  assert(bad.ruleCheck === 'fail' && codes(bad.issues).includes('topic_pack_not_ready'), '7-4. 未確認パックに対する文案は検査不合格');
}

caseHeader('8. 同じ入力から同じ結果・入力を変更しない');
{
  const pack = deepFreeze(clone(VALID_PACK));
  const before = JSON.stringify(pack);
  const a = pc.buildProductionSpec(pack), b = pc.buildProductionSpec(pack);
  assert(JSON.stringify(a) === JSON.stringify(b), '8-1. 制作仕様が決定論');
  const ia = pc.buildWriterInstruction(a.spec, pack), ib = pc.buildWriterInstruction(b.spec, pack);
  assert(ia === ib, '8-2. 指示文が決定論');
  const copy = deepFreeze(validCopy(a.spec));
  const copyBefore = JSON.stringify(copy);
  const va = cv.validateCopy(copy, a.spec, pack), vb = cv.validateCopy(copy, a.spec, pack);
  assert(JSON.stringify(va) === JSON.stringify(vb), '8-3. 文案検査が決定論');
  assert(JSON.stringify(tp.validateTopicPack(pack)) === JSON.stringify(tp.validateTopicPack(pack)), '8-4. パック検証が決定論');
  assert(JSON.stringify(pack) === before && JSON.stringify(copy) === copyBefore, '8-5. 凍結した入力でも例外なく動き、入力は変わらない');
  const bad = deepFreeze(clone(VALID_PACK));
  let threw = false; try { tp.validateTopicPack(Object.assign({}, bad, { status: 'unverified' })); cv.validateCopy({}, a.spec, bad); } catch (e) { threw = true; }
  assert(threw === false, '8-6. 不正入力でも例外を投げない');
  const spec2 = clone(a.spec); a.spec.slides[0].allowedClaimIds.push('x');
  assert(pc.buildProductionSpec(pack).spec.slides[0].allowedClaimIds.length === 0, '8-7. 返した仕様を書き換えても次の結果に影響しない（共有参照なし）');
  void spec2;
}

caseHeader('9. 日付・乱数・環境変数・外部接続を参照しない（静的）');
{
  ['dailyTopicPack.js', 'dailyProductionContract.js', 'dailyCopyValidator.js'].forEach(function (f) {
    const src = fs.readFileSync(path.join(__dirname, 'shared', f), 'utf8');
    const code = src.split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
    assert(!/Date\.now|new Date|Math\.random|process\.env|crypto\./.test(code), '9. ' + f + ': 日付・乱数・環境変数・crypto を参照しない');
    assert(!/fetch\(|axios|require\(['"](http|https|fs|child_process|net)['"]\)|supabase|openaiClient|claudeClient/.test(code), '9. ' + f + ': 外部接続・ファイル・DB・AI を参照しない');
  });
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
if (_failed === 0) {
  console.log('🟢 All Instagram Daily Production Step 1 contract cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
