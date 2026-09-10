'use strict';
// contentValueQuality.test.js
// Evidence-Based Content Value Quality — CV-3b: shared/contentValueQuality.js の
// deterministic テスト。
//   実 AI API 呼び出し 0件 / 本番 DB write 0件 / filesystem write 0件 / Web Evidence 取得 0件 /
//   Network 0 / DOM 0 / 画像生成 0。
//   semantic signal（reviewerNovelty）は AI を呼ばず、明示 fixture として注入する。
//
//   最重要検証:
//     ・今回の実 7 slides（実保存 draft `out_1788413020275` の値そのまま）→ insufficient
//     ・Evidence だけ増やした一般論 → FAIL（Evidence 水増し防止）
//     ・Evidence なしで具体化しただけ → FAIL（根拠なし具体化防止）
//     ・Evidence ＋ Content Value の両方成立 → PASS 候補

const fs = require('fs');
const path = require('path');

const cvq = require('./shared/contentValueQuality');
const ce = require('./shared/contentEvidence');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const NOW = Date.parse('2026-09-10T00:00:00.000Z');
const RECENT = '2026-09-01T00:00:00.000Z';
const CASE = 'case-value-1788410623';
const OUT = 'out_1788413020275';

// ══════════════════════════════════════════════════════════════
// 実保存 draft `out_1788413020275` の slides（read-only で確認した実値・DB write 0）
// ══════════════════════════════════════════════════════════════
const REAL_SLIDES = [
  '【1枚目】タイトル：毎日のスキンケア、まず見直したい5つの基本 / 本文：なんとなく続けているケア、いちど見直してみませんか？ / ビジュアル：清潔感のある洗面台と、シンプルなチェックリスト風デザイン',
  '【2枚目】タイトル：1. やさしく洗う / 本文：こすりすぎず、肌をやさしく洗うことを意識します。 / ビジュアル：泡で包むイメージ、手のイラスト、シンプルな洗顔アイコン',
  '【3枚目】タイトル：2. 洗ったあとは早めに保湿 / 本文：洗顔後は、肌が乾く前に保湿を意識します。 / ビジュアル：化粧水・乳液のボトルを並べた、落ち着いたトーンのイメージ',
  '【4枚目】タイトル：3. つける量を極端に減らしすぎない / 本文：少なすぎると、いつものケアが物足りなく感じることがあります。 / ビジュアル：適量を示すシンプルなメモ、手のひらにのせたイメージ',
  '【5枚目】タイトル：4. 触りすぎない / 本文：気になるときほど、顔を何度も触らないよう意識します。 / ビジュアル：顔に触れないようにする注意アイコン、やさしい表情の人物イラスト',
  '【6枚目】タイトル：5. 毎日続けやすい形にする / 本文：特別なことより、続けやすい流れに整えることが大切です。 / ビジュアル：朝夜のルーティンを並べた、見返しやすいチェックリスト風デザイン',
  '【7枚目】タイトル：今日から見直すならこの5つ / 本文：洗い方・保湿のタイミング・量・触り方・続けやすさ。この5つをまずチェック。 / ビジュアル：5項目をまとめた一覧、保存したくなる整理されたレイアウト',
];
const REAL_CTA = 'あとで見返せるように保存してください。毎日のケアを見直すときに、もう一度チェックしてみてください。';

// ══════════════════════════════════════════════════════════════
// 具体的・有益な fixture（Evidence ＋ Content Value 両立の検証用）
// ══════════════════════════════════════════════════════════════
const GOOD_SLIDES = [
  '【1枚目】タイトル：化粧水は「洗顔後60秒以内」が目安 / 本文：洗面所を出る前に塗り終えると決めておいてください。 / ビジュアル：洗面台',
  '【2枚目】タイトル：量の目安は500円玉大 / 本文：頬に手を当てて指が滑らないなら、量は足りています。 / ビジュアル：手のひら',
  '【3枚目】タイトル：手のひらで2秒温めてから広げる / 本文：冷たいままだと広がりにくいため、2秒温めてから顔全体に広げてください。 / ビジュアル：手',
  '【4枚目】タイトル：朝と夜で使い分ける基準 / 本文：日中に外へ出る場合はUVカットを優先し、夜は油分を多めに使ってください。 / ビジュアル：朝夜',
  '【5枚目】タイトル：まず1つだけ試すなら / 本文：60秒以内の保湿だけを1週間続けて、肌の変化を記録してください。 / ビジュアル：カレンダー',
];

// GOOD_SLIDES の claim candidate を漏れなく覆う宣言 claim（正規化後の相互包含で突合）
const GOOD_CLAIMS = [
  { claimId: 'clm_60', text: '60秒以内' },
  { claimId: 'clm_amount', text: '500円玉大' },
  { claimId: 'clm_slip', text: '指が滑らないなら' },
  { claimId: 'clm_warm', text: '2秒温めて' },
  { claimId: 'clm_ampm', text: '使い分ける基準' },
  { claimId: 'clm_uv', text: 'UVカットを優先' },
  { claimId: 'clm_try', text: 'まず1つだけ試すなら' },
];

// 独立 2 publisher（Tier1 官公庁）で各 claim を支える Evidence を生成する helper。
function buildEvidence(claimIds, over) {
  const pubs = [
    { name: '厚生労働省', url: 'https://www.mhlw.go.jp/' },
    { name: '消費者庁', url: 'https://www.caa.go.jp/' },
  ];
  const out = [];
  claimIds.forEach(function (cid, i) {
    pubs.forEach(function (p, j) {
      out.push(Object.assign({
        evidenceId: 'cev_' + cid + '_' + j,
        caseId: CASE,
        claimId: cid,
        claim: cid,
        claimType: 'general_practice',
        supportType: 'supports',
        sourceMethod: 'web_retrieved',
        verificationStatus: 'verified',
        reliability: 'high',
        retrievedAt: RECENT,
        recordedAt: RECENT,
        createdBy: 'system',
        sourceUrl: p.url + cid + '-' + i,
        sourceName: p.name,
      }, over || {}));
    });
  });
  return out;
}

function draftOf(slides, extra) {
  return {
    caseId: CASE, outputId: OUT, type: 'instagram_carousel',
    fields: Object.assign({ slides: slides, cta: REAL_CTA, caption: 'x' }, extra || {}),
  };
}

(async () => {
  console.log('\n=== contentValueQuality.test.js (CV-3b) ===');

  caseHeader('0. モジュール構造 / Gate・Score 分離契約');
  {
    assert(typeof cvq.evaluateContentValue === 'function', '0a. evaluateContentValue export');
    assert(JSON.stringify(cvq.CONTENT_VALUE_STATUS_VALUES) === JSON.stringify(['complete', 'almost_ready', 'needs_work', 'insufficient']),
      '0b. status は既存語彙4値のみ（新語彙なし）');
    assert(JSON.stringify(cvq.REVIEWER_NOVELTY_VALUES) === JSON.stringify(['novel', 'restatement', 'unclear']),
      '0c. reviewerNovelty は novel/restatement/unclear');
    const src = fs.readFileSync(path.join(__dirname, 'shared', 'contentValueQuality.js'), 'utf8');
    assert(src.indexOf("require('./contentEvidence')") !== -1, '0d. Evidence 判定は contentEvidence.js を再利用（重複実装しない）');
    assert(src.indexOf('resolveContentEvidence') !== -1 && src.indexOf('isVerifiedEvidence') === -1,
      '0e. 独自 Evidence 検証ロジックを持たない');
    assert(/[\x00\x7f]/.test(src) === false, '0f. 制御バイト混入なし');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('1. ★最重要: 今回の実 7 slides → insufficient');
  {
    const r = cvq.evaluateContentValue(draftOf(REAL_SLIDES), { contentType: 'value', now: NOW });
    assert(r.status === 'insufficient', '1a. status=insufficient: ' + r.status);
    assert(r.gates.evidenceGrounding === false, '1b. gates.evidenceGrounding=false');
    assert(r.gates.nonGeneric === false, '1c. gates.nonGeneric=false');
    assert(r.axes.specificity.pass === false && r.axes.specificity.detail.howCheckCount === 0,
      '1d. specificity FAIL（HOW/CHECK 0件 / 7 slides）: how=' + r.axes.specificity.detail.howCheckCount);
    assert(r.axes.informationGain.pass === false, '1e. informationGain FAIL');
    assert(r.axes.informationGain.detail.commonKnowledgeRatio > cvq.MAX_COMMON_KNOWLEDGE_RATIO,
      '1f. 一般論辞書一致率が上限超過: ' + r.axes.informationGain.detail.commonKnowledgeRatio.toFixed(3));
    assert(r.axes.informationGain.detail.groundedSpecificClaims === 0, '1g. grounded 具体 claim = 0');
    assert(r.axes.informationGain.detail.reviewerNovelty === 'unclear', '1h. reviewerNovelty 欠落 → unclear');
    assert(r.axes.actionability.pass === false && r.axes.actionability.detail.executableActions === 0,
      '1i. actionability FAIL（実行可能行動 0件・心構え表現のみ）');
    assert(r.axes.saveValue.pass === false, '1j. saveValue FAIL（種類数 ' + r.axes.saveValue.detail.typeCount + ' < ' + cvq.MIN_SAVE_VALUE_TYPES + '）');
    assert(r.evidenceStatus === 'insufficient', '1k. evidenceStatus=insufficient（contentEvidence 0件）');
    assert(r.blockingReasons.indexOf('evidence_insufficient') !== -1 && r.blockingReasons.indexOf('generic_gate_failed') !== -1,
      '1l. blockingReasons に機械的説明: ' + r.blockingReasons.join(','));
    assert(r.aiActions.some(function (a) { return a.id === 'ai.content_evidence_acquire'; }),
      '1m. aiActions に Evidence 取得要求（推測補完しない）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('2. 同じ一般論を3倍に長文化 → FAIL（文字数で品質は上がらない）');
  {
    const long = REAL_SLIDES.map(function (s) {
      const m = s.match(/^(.*本文\s*[:：]\s*)([^\/]*)(\/.*)$/);
      if (!m) return s;
      const body = m[2].trim();
      return m[1] + body + body + body + ' ' + m[3];
    });
    const base = cvq.evaluateContentValue(draftOf(REAL_SLIDES), { contentType: 'value', now: NOW });
    const r = cvq.evaluateContentValue(draftOf(long), { contentType: 'value', now: NOW });
    assert(r.status === 'insufficient', '2a. 長文化しても status=insufficient: ' + r.status);
    assert(r.axes.specificity.detail.howCheckCount === 0, '2b. HOW/CHECK は 0 のまま（文章量は加点しない）');
    assert(r.axes.specificity.score <= base.axes.specificity.score, '2c. specificity score は増えない: ' + base.axes.specificity.score + ' → ' + r.axes.specificity.score);
    assert(r.gates.nonGeneric === false, '2d. nonGeneric=false のまま');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('3. ★根拠なし具体化防止: Evidence なしで「2〜3分」「1日2回」等を追加 → FAIL');
  {
    const specificNoEvidence = [
      '【1枚目】タイトル：洗顔は2〜3分かけて / 本文：ぬるま湯で2分すすいでください。 / ビジュアル：洗面台',
      '【2枚目】タイトル：1日2回の保湿 / 本文：朝と夜の1日2回、500円玉大を使ってください。 / ビジュアル：ボトル',
      '【3枚目】タイトル：60秒以内が目安 / 本文：洗顔後60秒以内に塗り終えてください。 / ビジュアル：時計',
    ];
    const r = cvq.evaluateContentValue(draftOf(specificNoEvidence), { contentType: 'value', now: NOW, reviewerNovelty: 'novel' });
    assert(r.claims.length > 0, '3a. 具体 claim を検出: ' + r.claims.length + '件');
    assert(r.claims.every(function (c) { return c.grounded === false; }), '3b. すべて ungrounded');
    assert(r.gates.evidenceGrounding === false, '3c. gates.evidenceGrounding=false');
    assert(r.status === 'insufficient', '3d. status=insufficient（文章を詳しくしただけでは PASS しない）: ' + r.status);
    assert(r.blockingReasons.some(function (b) { return b.indexOf('ungrounded_claim') === 0; }), '3e. blockingReasons に ungrounded_claim');
    assert(r.axes.specificity.pass === true, '3f. specificity 自体は PASS しうる（それでも gate で止まる）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('4. ★Evidence水増し防止: Evidence sufficient ＋ 本文一般論のみ → FAIL');
  {
    // 実 7 slides の唯一の claim candidate を宣言して grounding し、Evidence を sufficient にする
    const claims = [{ claimId: 'clm_five', text: '見直すならこの5つ' }];
    const evi = buildEvidence(['clm_five']).concat(buildEvidence(['clm_five']).map(function (e, i) {
      return Object.assign({}, e, { evidenceId: 'cev_extra_' + i, sourceUrl: e.sourceUrl + '-x' });
    }));
    const r = cvq.evaluateContentValue(
      draftOf(REAL_SLIDES, { contentClaims: claims, contentEvidence: evi }),
      { contentType: 'value', now: NOW, reviewerNovelty: 'novel' });
    assert(r.evidenceStatus === 'sufficient', '4a. evidenceStatus=sufficient（Evidence は十分）: ' + r.evidenceStatus);
    assert(r.gates.evidenceGrounding === true,
      '4b. gates.evidenceGrounding=true（ungrounded claim 0件 ＋ Evidence sufficient。一般論には Evidence 必須 claim 自体が無い）');
    assert(r.gates.nonGeneric === false, '4c. gates.nonGeneric=false（本文は一般論のまま）');
    assert(r.status === 'insufficient', '4d. ★status=insufficient — Evidence を増やしても一般論は PASS しない: ' + r.status);
    assert(r.axes.informationGain.pass === false, '4e. informationGain FAIL（辞書一致率超過）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('5. 具体的・有益 ＋ Evidence partial → 最大 needs_work');
  {
    // 全 claim を grounding しつつ、検証済み Evidence の reliability をすべて low にして partial へ倒す
    const evi = buildEvidence(GOOD_CLAIMS.map(function (c) { return c.claimId; }), { reliability: 'low' });
    const r = cvq.evaluateContentValue(
      draftOf(GOOD_SLIDES, { contentClaims: GOOD_CLAIMS, contentEvidence: evi }),
      { contentType: 'value', now: NOW, reviewerNovelty: 'novel' });
    assert(r.evidenceStatus === 'partial', '5a. evidenceStatus=partial（信頼度が全て low）: ' + r.evidenceStatus);
    assert(r.gates.evidenceGrounding === true && r.gates.nonGeneric === true, '5b. 両 gate は true');
    assert(r.status === 'needs_work', '5c. partial は最大 needs_work（score ' + r.score + ' でも昇格しない）: ' + r.status);
    assert(r.aiActions.some(function (a) { return a.id === 'ai.content_evidence_reinforce'; }), '5d. Evidence 補強 aiAction');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('6. ★Evidence sufficient ＋ WHY ＋ HOW/CHECK ＋ grounded action ＋ novel → PASS 候補');
  {
    const evi = buildEvidence(GOOD_CLAIMS.map(function (c) { return c.claimId; }));
    const r = cvq.evaluateContentValue(
      draftOf(GOOD_SLIDES, { contentClaims: GOOD_CLAIMS, contentEvidence: evi }),
      { contentType: 'value', now: NOW, reviewerNovelty: 'novel' });
    assert(r.evidenceStatus === 'sufficient', '6a. evidenceStatus=sufficient');
    assert(r.gates.evidenceGrounding === true, '6b. gates.evidenceGrounding=true');
    assert(r.gates.nonGeneric === true, '6c. gates.nonGeneric=true');
    assert(r.axes.specificity.pass === true, '6d. specificity PASS（HOW/CHECK ' + r.axes.specificity.detail.howCheckCount + '/' + r.axes.specificity.detail.bodySlides + '）');
    assert(r.axes.informationGain.pass === true, '6e. informationGain PASS（AND 3条件成立）');
    assert(r.axes.actionability.pass === true, '6f. actionability PASS（grounded 実行可能行動 ' + r.axes.actionability.detail.groundedExecutableActions + '件）');
    assert(r.axes.saveValue.pass === true, '6g. saveValue PASS（種類 ' + r.axes.saveValue.detail.types.join('/') + '）');
    assert(r.status === 'almost_ready' || r.status === 'complete', '6h. ★status=PASS候補: ' + r.status + '（score ' + r.score + '）');
    assert(r.axes.specificity.detail.whyCount >= 1, '6i. grounded な WHY を検出: ' + r.axes.specificity.detail.whyCount);
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('7. CTA「保存してください」だけ → saveValue PASS 不可');
  {
    const plain = [
      '【1枚目】タイトル：ケアを見直す / 本文：気持ちを整えて過ごしましょう。 / ビジュアル：a',
      '【2枚目】タイトル：無理をしない / 本文：自分のペースで進めましょう。 / ビジュアル：b',
    ];
    const r = cvq.evaluateContentValue(
      draftOf(plain, { cta: '保存してください。あとで見返せるように保存しておいてください。', saveSharePrompt: '保存してあとで見返してください' }),
      { contentType: 'value', now: NOW, reviewerNovelty: 'novel' });
    assert(r.axes.saveValue.pass === false, '7a. saveValue FAIL（CTA は加点しない）');
    assert(r.axes.saveValue.detail.typeCount === 0, '7b. saveValue 種類数 0: ' + r.axes.saveValue.detail.typeCount);
    assert(r.axes.saveValue.detail.ctaExcluded === true, '7c. ctaExcluded=true を明示');
    assert(r.status === 'insufficient', '7d. status=insufficient');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('8. commonKnowledge 辞書非一致 ＋ specific claim 0 → informationGain PASS 不可');
  {
    // 辞書に一切一致しないが、具体要素も grounded claim も 0 の抽象文
    const abstract = [
      '【1枚目】タイトル：装いの余白について / 本文：日々の所作に静けさを添えていきましょう。 / ビジュアル：a',
      '【2枚目】タイトル：呼吸のリズム / 本文：緩やかな時間の流れを味わいましょう。 / ビジュアル：b',
    ];
    const r = cvq.evaluateContentValue(draftOf(abstract), { contentType: 'value', now: NOW, reviewerNovelty: 'novel' });
    assert(r.axes.informationGain.detail.commonKnowledgeRatio <= cvq.MAX_COMMON_KNOWLEDGE_RATIO,
      '8a. 辞書には一致しない: ratio=' + r.axes.informationGain.detail.commonKnowledgeRatio);
    assert(r.axes.informationGain.detail.conditions.dictionary === true, '8b. 辞書条件は true');
    assert(r.axes.informationGain.detail.conditions.groundedClaims === false, '8c. grounded claim 条件は false');
    assert(r.axes.informationGain.pass === false, '8d. ★辞書非一致だけでは informationGain PASS にしない');
    assert(r.status === 'insufficient', '8e. status=insufficient');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('9. reviewerNovelty 欠落 → unclear → FAIL（semantic fail-closed）');
  {
    const evi = buildEvidence(GOOD_CLAIMS.map(function (c) { return c.claimId; }));
    const r = cvq.evaluateContentValue(
      draftOf(GOOD_SLIDES, { contentClaims: GOOD_CLAIMS, contentEvidence: evi }),
      { contentType: 'value', now: NOW });   // reviewerNovelty 未指定
    assert(r.axes.informationGain.detail.reviewerNovelty === 'unclear', '9a. 欠落 → unclear');
    assert(r.axes.informationGain.pass === false, '9b. informationGain FAIL');
    assert(r.gates.nonGeneric === false, '9c. nonGeneric=false');
    assert(r.status === 'insufficient', '9d. status=insufficient（semantic 欠落で自動 PASS しない）: ' + r.status);
  }

  caseHeader('10. reviewerNovelty=restatement → FAIL');
  {
    const evi = buildEvidence(GOOD_CLAIMS.map(function (c) { return c.claimId; }));
    const r = cvq.evaluateContentValue(
      draftOf(GOOD_SLIDES, { contentClaims: GOOD_CLAIMS, contentEvidence: evi }),
      { contentType: 'value', now: NOW, reviewerNovelty: 'restatement' });
    assert(r.axes.informationGain.pass === false, '10a. restatement → informationGain FAIL');
    assert(r.status === 'insufficient', '10b. status=insufficient: ' + r.status);
  }

  caseHeader('10-2. semantic signal 単独では PASS を作れない');
  {
    // novel だが Evidence 0・具体 0
    const r = cvq.evaluateContentValue(draftOf(REAL_SLIDES), { contentType: 'value', now: NOW, reviewerNovelty: 'novel' });
    assert(r.status === 'insufficient', '10-2a. novel 単独では PASS しない: ' + r.status);
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('11. contradict Evidence → insufficient');
  {
    const evi = buildEvidence(GOOD_CLAIMS.map(function (c) { return c.claimId; }));
    evi.push({
      evidenceId: 'cev_contra', caseId: CASE, claimId: 'clm_60', claim: '60秒以内', claimType: 'general_practice',
      supportType: 'contradicts', sourceMethod: 'web_retrieved', verificationStatus: 'verified', reliability: 'high',
      retrievedAt: RECENT, recordedAt: RECENT, createdBy: 'system',
      sourceUrl: 'https://www.mhlw.go.jp/contra', sourceName: '厚生労働省',
    });
    const r = cvq.evaluateContentValue(
      draftOf(GOOD_SLIDES, { contentClaims: GOOD_CLAIMS, contentEvidence: evi }),
      { contentType: 'value', now: NOW, reviewerNovelty: 'novel' });
    assert(r.gates.evidenceGrounding === false, '11a. 反証があれば evidenceGrounding=false');
    assert(r.blockingReasons.indexOf('contradicting_evidence') !== -1, '11b. blockingReasons に contradicting_evidence');
    assert(r.status === 'insufficient', '11c. status=insufficient: ' + r.status);
  }

  caseHeader('12. Tier8 only Evidence → insufficient');
  {
    const evi = buildEvidence(GOOD_CLAIMS.map(function (c) { return c.claimId; })).map(function (e, i) {
      return Object.assign({}, e, { sourceUrl: 'https://note.com/u/n/' + i, sourceName: 'note投稿者' + (i % 2) });
    });
    const r = cvq.evaluateContentValue(
      draftOf(GOOD_SLIDES, { contentClaims: GOOD_CLAIMS, contentEvidence: evi }),
      { contentType: 'value', now: NOW, reviewerNovelty: 'novel' });
    assert(r.evidenceStatus === 'insufficient', '12a. Tier8 のみは evidenceStatus=insufficient');
    assert(r.gates.evidenceGrounding === false, '12b. evidenceGrounding=false');
    assert(r.status === 'insufficient', '12c. status=insufficient');
  }

  caseHeader('13. generated_hypothesis は Evidence schema で拒否 → grounding に使えない');
  {
    const evi = buildEvidence(GOOD_CLAIMS.map(function (c) { return c.claimId; })).map(function (e) {
      return Object.assign({}, e, { sourceMethod: 'generated_hypothesis' });
    });
    assert(ce.validateContentEvidenceRecord(evi[0]).valid === false, '13a. schema で invalid');
    const r = cvq.evaluateContentValue(
      draftOf(GOOD_SLIDES, { contentClaims: GOOD_CLAIMS, contentEvidence: evi }),
      { contentType: 'value', now: NOW, reviewerNovelty: 'novel' });
    assert(r.evidenceStatus === 'insufficient', '13b. AI 生成物は Evidence として集計されない');
    assert(r.status === 'insufficient', '13c. status=insufficient');
  }

  caseHeader('14. cross-case Evidence は grounding に使用不可');
  {
    const evi = buildEvidence(GOOD_CLAIMS.map(function (c) { return c.claimId; })).map(function (e) {
      return Object.assign({}, e, { caseId: 'case-OTHER' });
    });
    const r = cvq.evaluateContentValue(
      draftOf(GOOD_SLIDES, { contentClaims: GOOD_CLAIMS, contentEvidence: evi }),
      { contentType: 'value', now: NOW, reviewerNovelty: 'novel' });
    assert(r.evidence.excludedCrossCase === evi.length, '14a. 全件 cross-case 除外: ' + r.evidence.excludedCrossCase);
    assert(r.gates.evidenceGrounding === false, '14b. evidenceGrounding=false');
    assert(r.status === 'insufficient', '14c. status=insufficient');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('15. Product Content / APFR 境界（fact のみ・APFR 書き換え 0）');
  {
    const productSlides = [
      '【1枚目】タイトル：申込は初回1本まで / 本文：初回価格は1980円で、1世帯1本までです。 / ビジュアル：a',
      '【2枚目】タイトル：解約の目安 / 本文：次回発送の10日前までなら解約できます。 / ビジュアル：b',
    ];
    const claims = [
      { claimId: 'clm_price', text: '初回価格は1980円', claimScope: 'product', apfrFactId: 'apf_price' },
      { claimId: 'clm_cancel', text: '10日前までなら解約できます', claimScope: 'product', apfrFactId: 'apf_cancel' },
    ];
    const evi = buildEvidence(['clm_price', 'clm_cancel']);
    // CV-4b: Product Content には productIdentifier（商品の宛先）が必要。分類には使わない・整合性確認のみ。
    const PRODUCT_CTX = { intelligenceContext: { product: { caseId: CASE, productIdentifier: 'PID-TEST-1', facts: [] } } };
    const factsOk = [
      { factId: 'apf_price', classification: 'fact', field: 'price', value: 1980 },
      { factId: 'apf_cancel', classification: 'fact', field: 'cancel', value: '10日前' },
    ];
    const factsBad = [
      { factId: 'apf_price', classification: 'prediction', field: 'price', value: 1980 },
      { factId: 'apf_cancel', classification: 'inference', field: 'cancel', value: '10日前' },
    ];
    const rOk = cvq.evaluateContentValue(
      draftOf(productSlides, Object.assign({ contentClaims: claims, contentEvidence: evi }, PRODUCT_CTX)),
      { contentType: 'product', now: NOW, reviewerNovelty: 'novel', apfrFacts: factsOk });
    assert(rOk.gates.productClaim === true, '15a. APFR classification=fact なら productClaim gate PASS');

    const rBad = cvq.evaluateContentValue(
      draftOf(productSlides, Object.assign({ contentClaims: claims, contentEvidence: evi }, PRODUCT_CTX)),
      { contentType: 'product', now: NOW, reviewerNovelty: 'novel', apfrFacts: factsBad });
    assert(rBad.gates.productClaim === false, '15b. prediction / inference では商品 claim を PASS させない');
    assert(rBad.status === 'insufficient', '15c. status=insufficient');
    assert(rBad.blockingReasons.some(function (b) { return b.indexOf('product_claim_not_backed_by_apfr_fact') === 0; }), '15d. blockingReasons に明示');

    const rNoFacts = cvq.evaluateContentValue(
      draftOf(productSlides, Object.assign({ contentClaims: claims, contentEvidence: evi }, PRODUCT_CTX)),
      { contentType: 'product', now: NOW, reviewerNovelty: 'novel', apfrFacts: [] });
    assert(rNoFacts.gates.productClaim === false, '15e. APFR fact 無しでは商品 claim を PASS させない');

    const snapshot = JSON.stringify(factsOk);
    cvq.evaluateContentValue(draftOf(productSlides, Object.assign({ contentClaims: claims, contentEvidence: evi }, PRODUCT_CTX)),
      { contentType: 'product', now: NOW, reviewerNovelty: 'novel', apfrFacts: factsOk });
    assert(JSON.stringify(factsOk) === snapshot, '15f. APFR facts を書き換えない（非破壊）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('16. deterministic / mutation 0');
  {
    const evi = buildEvidence(GOOD_CLAIMS.map(function (c) { return c.claimId; }));
    const d = draftOf(GOOD_SLIDES, { contentClaims: GOOD_CLAIMS, contentEvidence: evi });
    const o = { contentType: 'value', now: NOW, reviewerNovelty: 'novel' };
    const snapD = JSON.stringify(d), snapO = JSON.stringify(o);
    const a = cvq.evaluateContentValue(d, o);
    const b = cvq.evaluateContentValue(d, o);
    const strip = function (x) { const y = JSON.parse(JSON.stringify(x)); delete y.evaluatedAt; return JSON.stringify(y); };
    assert(strip(a) === strip(b), '16a. 同一入力 → deterministic 部分が完全一致');
    assert(JSON.stringify(d) === snapD, '16b. draft 非破壊');
    assert(JSON.stringify(o) === snapO, '16c. options 非破壊');
  }

  caseHeader('17. null / undefined / 型不正 → 例外ではなく insufficient');
  {
    assert(cvq.evaluateContentValue(null).status === 'insufficient', '17a. null → insufficient');
    assert(cvq.evaluateContentValue(undefined, undefined).status === 'insufficient', '17b. undefined → insufficient');
    assert(cvq.evaluateContentValue(42, 'x').status === 'insufficient', '17c. 型不正 → insufficient');
    assert(cvq.evaluateContentValue({}, {}).status === 'insufficient', '17d. 空 draft → insufficient');
    const rNoSlides = cvq.evaluateContentValue({ caseId: CASE, fields: { slides: [] } }, { now: NOW });
    assert(rNoSlides.status === 'insufficient' && rNoSlides.blockingReasons.indexOf('no_slides') !== -1, '17e. slides 0件 → no_slides');
    const rGarbage = cvq.evaluateContentValue(
      draftOf(REAL_SLIDES, { contentEvidence: [null, 1, 'x'], contentClaims: [null, {}] }), { now: NOW });
    assert(rGarbage.status === 'insufficient', '17f. 不正要素混在でも例外なし・insufficient');
    // CV-4b: 'value' への暗黙 fallback は廃止。未知 contentType は 'unknown' へ倒れ fail-closed。
    const rBadType = cvq.evaluateContentValue(draftOf(GOOD_SLIDES), { contentType: 'unknown_type', now: NOW });
    assert(rBadType.contentType === 'unknown', '17g. 未知 contentType は unknown へ（value へ倒さない）: ' + rBadType.contentType);
    assert(rBadType.gates.contentTypeResolved === false, '17g-2. gates.contentTypeResolved=false');
    assert(rBadType.status === 'insufficient', '17g-3. status=insufficient（fail-closed）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('18. 既存契約への影響 0');
  {
    const idx = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
    assert(idx.indexOf('contentValueQuality') === -1 && idx.indexOf('contentEvidence') === -1,
      '18a. index.html は本 Core を参照していない（未配線＝既存フロー無影響）');
    assert(idx.indexOf('function evaluateQualityGate') !== -1 && idx.indexOf('function evaluateOutputPackageCompleteness') !== -1 && idx.indexOf('function evaluateOutputQuality') !== -1,
      '18b. 既存 Quality 関数は index.html に存在（無変更）');
    const src = fs.readFileSync(path.join(__dirname, 'shared', 'contentValueQuality.js'), 'utf8');
    ['evaluateQualityGate', 'packageQuality', 'evaluateOutputQuality', 'carouselImageCore', 'carouselBackgroundSanitizer'].forEach(function (k) {
      assert(src.indexOf(k) === -1 || src.indexOf('非責務') !== -1, '18c. 本 Core は ' + k + ' を実行参照しない');
    });
    assert(src.indexOf("require('") !== -1 && (src.match(/require\('[^']+'\)/g) || []).join(',') === "require('./contentEvidence')",
      '18d. 依存は contentEvidence.js のみ: ' + (src.match(/require\('[^']+'\)/g) || []).join(','));
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const deps = Object.keys(pkg.dependencies || {}).sort();
    assert(JSON.stringify(deps) === JSON.stringify(['@anthropic-ai/sdk', '@supabase/supabase-js', 'axios', 'dotenv', 'express', 'opentype.js', 'sharp']),
      '18e. package.json dependencies 変更なし');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('19. Gate / Score 分離（score 100 でも gate false なら昇格しない）');
  {
    const evi = buildEvidence(GOOD_CLAIMS.map(function (c) { return c.claimId; }));
    // reviewerNovelty=restatement で nonGeneric を false にしたまま、他軸は高得点
    const r = cvq.evaluateContentValue(
      draftOf(GOOD_SLIDES, { contentClaims: GOOD_CLAIMS, contentEvidence: evi }),
      { contentType: 'value', now: NOW, reviewerNovelty: 'restatement' });
    assert(r.axes.actionability.pass === true && r.axes.saveValue.pass === true, '19a. actionability / saveValue は PASS');
    assert(r.gates.nonGeneric === false, '19b. gate は false');
    assert(r.status === 'insufficient', '19c. ★score ' + r.score + ' でも gate false なら insufficient');
    assert(typeof r.gates.evidenceGrounding === 'boolean' && typeof r.gates.nonGeneric === 'boolean', '19d. gate は boolean（score に混ざらない）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('20. CV-4b: contentType SoT / unknown fail-closed / Product 分類境界');
  {
    const PID = { intelligenceContext: { product: { caseId: CASE, productIdentifier: 'PID-1', facts: [] } } };
    const evi = buildEvidence(GOOD_CLAIMS.map(function (c) { return c.claimId; }));
    const full = function (extra, ct) {
      return cvq.evaluateContentValue(
        draftOf(GOOD_SLIDES, Object.assign({ contentClaims: GOOD_CLAIMS, contentEvidence: evi }, extra || {})),
        { contentType: ct, now: NOW, reviewerNovelty: 'novel' });
    };

    assert(JSON.stringify(cvq.CONTENT_TYPES) === JSON.stringify(['value', 'bridge', 'product', 'unknown']),
      '20-0. CONTENT_TYPES に unknown を追加（新語彙は unknown のみ・既存語彙）');

    // 1〜3: undefined / null / invalid → unknown
    [['undefined', undefined], ['null', null], ['invalid', 'xxx'], ["'unknown'", 'unknown']].forEach(function (p) {
      const r = full({}, p[1]);
      assert(r.contentType === 'unknown', '20-1. ' + p[0] + ' → contentType=unknown（value へ倒さない）');
      assert(r.gates.contentTypeResolved === false, '20-2. ' + p[0] + ' → gates.contentTypeResolved=false');
      assert(r.status === 'insufficient', '20-3. ' + p[0] + ' → status=insufficient（他軸が PASS でも昇格しない）');
      assert(r.blockingReasons.indexOf('content_type_unresolved') !== -1, '20-4. ' + p[0] + ' → blockingReasons に content_type_unresolved');
    });

    // ★ unknown でも他4軸は PASS しうる＝gate だけで止めていることの確認
    {
      const r = full({}, undefined);
      assert(r.axes.specificity.pass === true && r.axes.informationGain.pass === true
        && r.axes.actionability.pass === true && r.axes.saveValue.pass === true,
        '20-5. unknown でも 4軸は PASS（score ' + r.score + '）＝gate 単独で止めている');
    }

    // 4: value + productIdentifier → value のまま
    {
      const r = full(PID, 'value');
      assert(r.contentType === 'value', '20-6. value + productIdentifier → value のまま（Product へ自動昇格しない）');
      assert(r.gates.productClaim === true, '20-7. value では productClaimGate を評価しない');
      assert(r.productContext === null, '20-8. value では productContext を記録しない（APFR 非注入）');
      assert(r.status === 'almost_ready' || r.status === 'complete', '20-9. value は PASS 候補のまま: ' + r.status);
    }

    // 5: bridge + productIdentifier → bridge のまま
    {
      const r = full(PID, 'bridge');
      assert(r.contentType === 'bridge', '20-10. bridge + productIdentifier → bridge のまま');
      assert(r.productContext === null, '20-11. bridge でも APFR を参照しない');
    }

    // 6: product + productIdentifier なし → product_context_missing → insufficient
    {
      const r = full({}, 'product');
      assert(r.gates.productClaim === false, '20-12. product + productIdentifier なし → productClaim=false');
      assert(r.blockingReasons.indexOf('product_context_missing') !== -1, '20-13. blockingReasons に product_context_missing');
      assert(r.status === 'insufficient', '20-14. status=insufficient');
      assert(r.productContext && r.productContext.resolved === false, '20-15. productContext.resolved=false');
    }

    // 7: productIdentifier だけでは product へ自動昇格しない（分類に使わない）
    {
      const r = full(PID, undefined);   // 宣言なし・productIdentifier あり
      assert(r.contentType === 'unknown', '20-16. ★productIdentifier があっても product へ自動昇格しない（unknown のまま）');
      assert(r.productContext === null, '20-17. unknown では APFR を参照しない');
    }

    // product + productIdentifier あり → 評価可能
    {
      const r = full(PID, 'product');
      assert(r.productContext && r.productContext.resolved === true && r.productContext.productIdentifier === 'PID-1',
        '20-18. product + productIdentifier あり → productContext.resolved=true');
      assert(r.gates.productClaim === true, '20-19. product claim が無ければ productClaimGate は PASS');
    }

    // 8: 既存 Evidence / Content Value 契約は不変
    {
      const r = full({}, 'value');
      assert(r.evidenceStatus === 'sufficient' && r.gates.evidenceGrounding === true && r.gates.nonGeneric === true,
        '20-20. 既存 Evidence / Content Value 契約は不変');
      assert(typeof r.gates.contentTypeResolved === 'boolean' && typeof r.gates.evidenceGrounding === 'boolean'
        && typeof r.gates.nonGeneric === 'boolean' && typeof r.gates.productClaim === 'boolean',
        '20-21. gate は 4 つとも boolean（score に混ざらない）');
      assert(cvq.CONTENT_VALUE_STATUS_VALUES.indexOf(r.status) !== -1, '20-22. status は既存4語彙のまま');
    }
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All contentValueQuality cases passed (CV-3b)'); }
})().catch(function (e) { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
