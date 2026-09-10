'use strict';
// contentEvidence.test.js
// Evidence-Based Content Value Quality — CV-3a: shared/contentEvidence.js の
// 契約確認用 deterministic テスト。
//   実 AI API 呼び出し 0件 / 本番 DB write 0件 / filesystem write 0件 / Web Evidence 取得 0件 /
//   実案件操作 0件 / Network 0 / DOM 0。
//   検証対象:
//     shared/contentEvidence.js（schema / enum / validator / source trust 接続 /
//                                verification / Evidence 集計 / cross-case guard / fail-closed）
//   非対象（CV-3b 以降）:
//     shared/contentValueQuality.js（未実装）・今回の薄い 7 slides の Content Value 判定。

const fs = require('fs');
const path = require('path');

const ce = require('./shared/contentEvidence');
const evidenceAcquisition = require('./shared/evidenceAcquisition');
const iadp = require('./shared/iadpIntelligenceContext');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

// ── 固定 now（stale 判定の決定性のため。時刻依存を排除） ──
const NOW = Date.parse('2026-09-10T00:00:00.000Z');
const RECENT = '2026-09-01T00:00:00.000Z';           // NOW から 9 日
const STALE = '2026-06-01T00:00:00.000Z';            // NOW から ~101 日（STALE_DAYS=30 超）
const CASE = 'case-carousel-trial-1789024485151';

// valid な baseline record を作る helper（deep copy して返す・テスト間で共有しない）
function rec(over) {
  const base = {
    evidenceId: 'cev_base',
    caseId: CASE,
    claimId: 'clm_1',
    claim: '洗顔後は時間を置かずに保湿する',
    claimType: 'general_practice',
    supportType: 'supports',
    sourceMethod: 'web_retrieved',
    verificationStatus: 'verified',
    reliability: 'high',
    retrievedAt: RECENT,
    recordedAt: RECENT,
    createdBy: 'system',
    sourceUrl: 'https://www.mhlw.go.jp/example',
    sourceTitle: '厚生労働省 生活情報',
    sourceName: '厚生労働省',
  };
  return Object.assign({}, base, over || {});
}

(async () => {
  console.log('\n=== contentEvidence.test.js (CV-3a) ===');

  caseHeader('0. モジュール構造 / 既存資産の再利用');
  {
    assert(typeof ce.validateContentEvidenceRecord === 'function', '0a. validateContentEvidenceRecord export');
    assert(typeof ce.isVerifiedContentEvidence === 'function', '0b. isVerifiedContentEvidence export');
    assert(typeof ce.resolveContentEvidence === 'function', '0c. resolveContentEvidence export');
    assert(ce.MIN_VERIFIED_EVIDENCE === iadp.MIN_VERIFIED_EVIDENCE && ce.MIN_VERIFIED_EVIDENCE === 3,
      '0d. MIN_VERIFIED_EVIDENCE は既存値(3)を再利用: ' + ce.MIN_VERIFIED_EVIDENCE);
    assert(ce.MIN_INDEPENDENT_SOURCES === iadp.MIN_INDEPENDENT_SOURCES && ce.MIN_INDEPENDENT_SOURCES === 2,
      '0e. MIN_INDEPENDENT_SOURCES は既存値(2)を再利用: ' + ce.MIN_INDEPENDENT_SOURCES);
    assert(ce.STALE_DAYS === iadp.STALE_DAYS && ce.STALE_DAYS === 30,
      '0f. STALE_DAYS は既存値(30)を再利用: ' + ce.STALE_DAYS);
  }

  caseHeader('1. valid record');
  {
    const r = ce.validateContentEvidenceRecord(rec(), { expectedCaseId: CASE });
    assert(r.valid === true && r.errors.length === 0, '1a. baseline record は valid');
  }

  caseHeader('2. invalid required field');
  {
    assert(ce.validateContentEvidenceRecord(rec({ evidenceId: '' })).errors.indexOf('evidenceId_missing') !== -1, '2a. evidenceId 欠落を検出');
    assert(ce.validateContentEvidenceRecord(rec({ caseId: '' })).errors.indexOf('caseId_missing') !== -1, '2b. caseId 欠落を検出');
    assert(ce.validateContentEvidenceRecord(rec({ claimId: undefined })).errors.indexOf('claimId_missing') !== -1, '2c. claimId 欠落を検出');
    assert(ce.validateContentEvidenceRecord(rec({ claim: '   ' })).errors.indexOf('claim_missing') !== -1, '2d. claim 空白のみを検出');
    assert(ce.validateContentEvidenceRecord(rec({ retrievedAt: 'not-a-date' })).errors.indexOf('invalid_retrievedAt') !== -1, '2e. retrievedAt 不正日時を検出');
    assert(ce.validateContentEvidenceRecord(rec({ caseId: 'other-case' }), { expectedCaseId: CASE }).errors.indexOf('caseId_mismatch') !== -1, '2f. expectedCaseId 不一致を検出');
    assert(ce.validateContentEvidenceRecord(rec({ sourceMethod: 'web_retrieved', sourceUrl: '' })).errors.indexOf('web_retrieved_requires_sourceUrl') !== -1, '2g. web_retrieved は sourceUrl 必須');
    assert(ce.validateContentEvidenceRecord(rec({ sourceUrl: 'http://['  })).errors.indexOf('unparseable_sourceUrl') !== -1, '2h. パース不能な sourceUrl を検出');
  }

  caseHeader('3. invalid enum');
  {
    assert(ce.validateContentEvidenceRecord(rec({ claimType: 'medical_effect' })).errors.indexOf('invalid_claimType') !== -1, '3a. 未定義 claimType (medical_effect) を拒否');
    assert(ce.validateContentEvidenceRecord(rec({ supportType: 'agree' })).errors.indexOf('invalid_supportType') !== -1, '3b. 未定義 supportType を拒否');
    assert(ce.validateContentEvidenceRecord(rec({ verificationStatus: 'auto' })).errors.indexOf('invalid_verificationStatus') !== -1, '3c. 未定義 verificationStatus を拒否');
    assert(ce.validateContentEvidenceRecord(rec({ reliability: 'great' })).errors.indexOf('invalid_reliability') !== -1, '3d. 未定義 reliability を拒否');
    assert(ce.validateContentEvidenceRecord(rec({ createdBy: 'writer' })).errors.indexOf('invalid_createdBy') !== -1, '3e. 未定義 createdBy を拒否');
  }

  caseHeader('4. generated_hypothesis rejected');
  {
    assert(ce.CONTENT_EVIDENCE_SOURCE_METHODS.indexOf('generated_hypothesis') === -1, '4a. enum に generated_hypothesis が存在しない');
    assert(ce.validateContentEvidenceRecord(rec({ sourceMethod: 'generated_hypothesis' })).errors.indexOf('invalid_sourceMethod') !== -1, '4b. generated_hypothesis を sourceMethod として拒否');
    assert(ce.isVerifiedContentEvidence(rec({ sourceMethod: 'generated_hypothesis' }), { caseId: CASE, now: NOW }).verified === false, '4c. generated_hypothesis は verified に昇格不可');
  }

  caseHeader('5. ai_interpretation rejected');
  {
    assert(ce.CONTENT_EVIDENCE_SOURCE_METHODS.indexOf('ai_interpretation') === -1, '5a. enum に ai_interpretation が存在しない');
    assert(ce.validateContentEvidenceRecord(rec({ sourceMethod: 'ai_interpretation' })).errors.indexOf('invalid_sourceMethod') !== -1, '5b. ai_interpretation を sourceMethod として拒否');
  }

  caseHeader('6. Tier8 only → insufficient');
  {
    const recs = [
      rec({ evidenceId: 'cev_s1', sourceUrl: 'https://note.com/a/n/x1', sourceName: 'noteユーザーA' }),
      rec({ evidenceId: 'cev_s2', claimId: 'clm_2', sourceUrl: 'https://ameblo.jp/b/entry-1', sourceName: 'ブログB' }),
      rec({ evidenceId: 'cev_s3', claimId: 'clm_3', sourceUrl: 'https://twitter.com/c/status/1', sourceName: 'Xユーザー C' }),
    ];
    const r = ce.resolveContentEvidence(recs, { caseId: CASE, now: NOW });
    assert(r.verifiedCount === 0, '6a. Tier8 のみは verifiedCount=0: ' + r.verifiedCount);
    assert(r.status === 'insufficient', '6b. Tier8 のみは status=insufficient: ' + r.status);
  }

  caseHeader('7. Tier7 single source → insufficient (grounded にしない)');
  {
    // Tier7 一般 Web メディア（未知ドメイン = 既定 Tier7）
    const recs = [rec({ evidenceId: 'cev_t7', sourceUrl: 'https://example-beauty-media.com/tips', sourceName: '一般美容メディア' })];
    const r = ce.resolveContentEvidence(recs, { caseId: CASE, now: NOW });
    // Tier7 は isVerifiedContentEvidence の market ルール(Tier1-6)で verified にしない
    assert(r.verifiedCount === 0, '7a. Tier7 単独は verifiedCount=0: ' + r.verifiedCount);
    assert(r.status === 'insufficient', '7b. Tier7 単独は status=insufficient');
    assert(!r.byClaim['clm_1'] || r.byClaim['clm_1'].grounded === false, '7c. Tier7 単独では claim を grounded にしない');
  }

  caseHeader('8. verifiedCount 不足 → partial');
  {
    // Tier1(.go.jp) を独立 2 publisher で 2件のみ（MIN_VERIFIED_EVIDENCE=3 未満）
    const recs = [
      rec({ evidenceId: 'cev_v1', sourceUrl: 'https://www.mhlw.go.jp/a', sourceName: '厚生労働省' }),
      rec({ evidenceId: 'cev_v2', claimId: 'clm_2', sourceUrl: 'https://www.caa.go.jp/b', sourceName: '消費者庁' }),
    ];
    const r = ce.resolveContentEvidence(recs, { caseId: CASE, now: NOW });
    assert(r.verifiedCount === 2, '8a. verifiedCount=2: ' + r.verifiedCount);
    assert(r.independentSourceCount === 2, '8b. independentSourceCount=2: ' + r.independentSourceCount);
    assert(r.status === 'partial', '8c. verifiedCount<3 は status=partial: ' + r.status);
  }

  caseHeader('9. independentSource 不足 → partial');
  {
    // 同一 publisher（厚生労働省）から 3件 = verifiedCount 3 だが独立 source は 1
    const recs = [
      rec({ evidenceId: 'cev_i1', sourceUrl: 'https://www.mhlw.go.jp/a', sourceName: '厚生労働省' }),
      rec({ evidenceId: 'cev_i2', claimId: 'clm_2', sourceUrl: 'https://www.mhlw.go.jp/b', sourceName: '厚生労働省' }),
      rec({ evidenceId: 'cev_i3', claimId: 'clm_3', sourceUrl: 'https://www.mhlw.go.jp/c', sourceName: '厚生労働省' }),
    ];
    const r = ce.resolveContentEvidence(recs, { caseId: CASE, now: NOW });
    assert(r.verifiedCount === 3, '9a. verifiedCount=3: ' + r.verifiedCount);
    assert(r.independentSourceCount === 1, '9b. independentSourceCount=1（同一 publisher）: ' + r.independentSourceCount);
    assert(r.status === 'partial', '9c. 独立 source<2 は status=partial: ' + r.status);
  }

  caseHeader('10. sufficient 条件成立');
  {
    // verified 3件・独立 3 publisher・全て high/medium・recent
    const recs = [
      rec({ evidenceId: 'cev_ok1', claimId: 'clm_1', sourceUrl: 'https://www.mhlw.go.jp/a', sourceName: '厚生労働省' }),
      rec({ evidenceId: 'cev_ok2', claimId: 'clm_2', sourceUrl: 'https://www.caa.go.jp/b', sourceName: '消費者庁' }),
      rec({ evidenceId: 'cev_ok3', claimId: 'clm_3', sourceUrl: 'https://www.jpx.co.jp/c', sourceName: '日本取引所', reliability: 'medium' }),
    ];
    const r = ce.resolveContentEvidence(recs, { caseId: CASE, now: NOW });
    assert(r.verifiedCount === 3, '10a. verifiedCount=3: ' + r.verifiedCount);
    assert(r.independentSourceCount === 3, '10b. independentSourceCount=3: ' + r.independentSourceCount);
    assert(r.status === 'sufficient', '10c. status=sufficient: ' + r.status);
  }

  caseHeader('11. stale Evidence（明示のみ・自動無効化しない）');
  {
    const recs = [
      rec({ evidenceId: 'cev_st1', claimId: 'clm_1', retrievedAt: STALE, recordedAt: STALE, sourceUrl: 'https://www.mhlw.go.jp/a', sourceName: '厚生労働省' }),
      rec({ evidenceId: 'cev_st2', claimId: 'clm_2', retrievedAt: STALE, recordedAt: STALE, sourceUrl: 'https://www.caa.go.jp/b', sourceName: '消費者庁' }),
      rec({ evidenceId: 'cev_st3', claimId: 'clm_3', retrievedAt: STALE, recordedAt: STALE, sourceUrl: 'https://www.jpx.co.jp/c', sourceName: '日本取引所' }),
    ];
    const one = ce.isVerifiedContentEvidence(recs[0], { caseId: CASE, now: NOW });
    assert(one.verified === true && one.stale === true, '11a. stale でも verified は維持され stale フラグが立つ');
    const r = ce.resolveContentEvidence(recs, { caseId: CASE, now: NOW });
    assert(r.staleCount === 3 && r.staleAll === true, '11b. staleCount=3 / staleAll=true: ' + r.staleCount);
    assert(r.status === 'sufficient', '11c. stale は status を落とさない（既存 IADP 契約と同じ・明示のみ）: ' + r.status);
    assert(r.reasons.join('|').indexOf('30日超') !== -1, '11d. stale が reasons に明示される');
  }

  caseHeader('12. contradicts を supports に数えない');
  {
    const recs = [
      rec({ evidenceId: 'cev_c1', claimId: 'clm_x', sourceUrl: 'https://www.mhlw.go.jp/a', sourceName: '厚生労働省' }),
      rec({ evidenceId: 'cev_c2', claimId: 'clm_x', supportType: 'contradicts', sourceUrl: 'https://www.caa.go.jp/b', sourceName: '消費者庁' }),
      rec({ evidenceId: 'cev_c3', claimId: 'clm_x', supportType: 'context', sourceUrl: 'https://www.jpx.co.jp/c', sourceName: '日本取引所' }),
    ];
    const r = ce.resolveContentEvidence(recs, { caseId: CASE, now: NOW });
    assert(r.verifiedCount === 1, '12a. supports のみ verifiedCount に算入 (=1): ' + r.verifiedCount);
    assert(r.contradictsCount === 1 && r.contextCount === 1, '12b. contradicts/context は別カウント');
    assert(r.byClaim['clm_x'] && r.byClaim['clm_x'].contradicts === true && r.byClaim['clm_x'].grounded === false, '12c. 反証がある claim は grounded=false');
  }

  caseHeader('13. cross-case 除外');
  {
    const recs = [
      rec({ evidenceId: 'cev_cc1', claimId: 'clm_1', sourceUrl: 'https://www.mhlw.go.jp/a', sourceName: '厚生労働省' }),
      rec({ evidenceId: 'cev_cc2', claimId: 'clm_2', caseId: 'case-OTHER', sourceUrl: 'https://www.caa.go.jp/b', sourceName: '消費者庁' }),
      rec({ evidenceId: 'cev_cc3', claimId: 'clm_3', caseId: 'case-OTHER', sourceUrl: 'https://www.jpx.co.jp/c', sourceName: '日本取引所' }),
    ];
    const r = ce.resolveContentEvidence(recs, { caseId: CASE, now: NOW });
    assert(r.excludedCrossCase === 2, '13a. 別 caseId 2件を除外: ' + r.excludedCrossCase);
    assert(r.verifiedCount === 1, '13b. 自 case のみ verifiedCount=1: ' + r.verifiedCount);
    assert(r.status !== 'sufficient', '13c. cross-case Evidence で sufficient にならない: ' + r.status);
  }

  caseHeader('14. unknown claimType 昇格不可');
  {
    assert(ce._mapClaimTypeToPromotionType('unknown') === null, '14a. unknown → promotion type null');
    const iv = ce.isVerifiedContentEvidence(rec({ claimType: 'unknown' }), { caseId: CASE, now: NOW });
    assert(iv.verified === false && iv.reasons.join('|').indexOf('claimType_not_promotable') !== -1, '14b. unknown claimType は verified 不可');
    const recs = [
      rec({ evidenceId: 'cev_u1', claimId: 'clm_1', claimType: 'unknown', sourceUrl: 'https://www.mhlw.go.jp/a', sourceName: '厚生労働省' }),
      rec({ evidenceId: 'cev_u2', claimId: 'clm_2', claimType: 'unknown', sourceUrl: 'https://www.caa.go.jp/b', sourceName: '消費者庁' }),
      rec({ evidenceId: 'cev_u3', claimId: 'clm_3', claimType: 'unknown', sourceUrl: 'https://www.jpx.co.jp/c', sourceName: '日本取引所' }),
    ];
    const r = ce.resolveContentEvidence(recs, { caseId: CASE, now: NOW });
    assert(r.status === 'insufficient', '14c. unknown claim のみは insufficient（医学・治療 claim を含む）: ' + r.status);
  }

  caseHeader('15. sourceTier 保存値を信用しない');
  {
    // 記録に sourceTier を持ち込むと schema でエラー
    assert(ce.validateContentEvidenceRecord(rec({ sourceTier: 1 })).errors.indexOf('sourceTier_must_not_be_stored') !== -1, '15a. record に sourceTier を含めると拒否');
    // sourceTier: 1 と偽装しても、実 URL は未知ドメイン(Tier7) のため verified にならない
    const iv = ce.isVerifiedContentEvidence(
      { evidenceId: 'cev_fake', caseId: CASE, claimId: 'clm_1', claim: 'x', claimType: 'general_practice', supportType: 'supports',
        sourceMethod: 'web_retrieved', verificationStatus: 'verified', reliability: 'high',
        retrievedAt: RECENT, recordedAt: RECENT, createdBy: 'system',
        sourceUrl: 'https://totally-unknown-blog.example/x', sourceName: '自称一次情報' },
      { caseId: CASE, now: NOW });
    assert(iv.verified === false, '15b. sourceTier 偽装は無視され、実ドメイン(Tier7)で verified にならない');
    assert(iv.tier === 7, '15c. tier は sourceUrl から毎回導出される: ' + iv.tier);
  }

  caseHeader('16. same input → same deterministic result');
  {
    const recs = [
      rec({ evidenceId: 'cev_d1', claimId: 'clm_1', sourceUrl: 'https://www.mhlw.go.jp/a', sourceName: '厚生労働省' }),
      rec({ evidenceId: 'cev_d2', claimId: 'clm_2', sourceUrl: 'https://www.caa.go.jp/b', sourceName: '消費者庁' }),
    ];
    const a = JSON.stringify(ce.resolveContentEvidence(recs, { caseId: CASE, now: NOW }));
    const b = JSON.stringify(ce.resolveContentEvidence(recs, { caseId: CASE, now: NOW }));
    assert(a === b, '16a. 同一入力 → byte 一致の結果');
  }

  caseHeader('17. input mutation 0');
  {
    const r0 = rec({ evidenceId: 'cev_m1', claimId: 'clm_1', sourceUrl: 'https://www.mhlw.go.jp/a', sourceName: '厚生労働省' });
    const recs = [r0];
    const ctx = { caseId: CASE, now: NOW, officialDomains: ['x.example'] };
    const snapRec = JSON.stringify(r0);
    const snapArr = JSON.stringify(recs);
    const snapCtx = JSON.stringify(ctx);
    ce.validateContentEvidenceRecord(r0, { expectedCaseId: CASE });
    ce.isVerifiedContentEvidence(r0, ctx);
    ce.resolveContentEvidence(recs, ctx);
    assert(JSON.stringify(r0) === snapRec, '17a. record 非破壊');
    assert(JSON.stringify(recs) === snapArr, '17b. records 配列 非破壊');
    assert(JSON.stringify(ctx) === snapCtx, '17c. context 非破壊');
  }

  caseHeader('18. null / undefined 安全側');
  {
    assert(ce.validateContentEvidenceRecord(null).valid === false, '18a. validate(null) → valid:false（例外なし）');
    assert(ce.validateContentEvidenceRecord(undefined).valid === false, '18b. validate(undefined) → valid:false');
    assert(ce.isVerifiedContentEvidence(null, null).verified === false, '18c. isVerified(null,null) → verified:false（例外なし）');
    assert(ce.isVerifiedContentEvidence(undefined).verified === false, '18d. isVerified(undefined) → verified:false');
    const rn = ce.resolveContentEvidence(null, null);
    assert(rn.status === 'insufficient' && rn.available === false, '18e. resolve(null,null) → insufficient / available:false');
    const ru = ce.resolveContentEvidence(undefined, { caseId: CASE });
    assert(ru.status === 'insufficient', '18f. resolve(undefined) → insufficient');
    const rNoCaseId = ce.resolveContentEvidence([rec()], {});
    assert(rNoCaseId.status === 'insufficient' && rNoCaseId.caseIdMatched === false, '18g. caseId 未指定 → insufficient（cross-case guard の前提）');
    const rGarbage = ce.resolveContentEvidence([null, 42, 'x', {}], { caseId: CASE, now: NOW });
    assert(rGarbage.status === 'insufficient' && rGarbage.excludedInvalid >= 1, '18h. 不正要素混在でも例外なし・insufficient');
  }

  caseHeader('19. law_regulation は Tier1/4 単独可（既存 promotion rule の再利用）');
  {
    const recs = [rec({ evidenceId: 'cev_law', claimId: 'clm_law', claimType: 'law_regulation',
      claim: '景品表示法上の広告表記', sourceUrl: 'https://www.caa.go.jp/law', sourceName: '消費者庁' })];
    const r = ce.resolveContentEvidence(recs, { caseId: CASE, now: NOW });
    assert(r.byClaim['clm_law'] && r.byClaim['clm_law'].grounded === true, '19a. law_regulation は Tier1 単独で grounded');
    // ただし集計 status は verifiedCount>=3 が別途必要
    assert(r.status === 'partial', '19b. 集計 status は verifiedCount 不足で partial（claim grounded とは別軸）: ' + r.status);
  }

  caseHeader('20. 既存ファイル無変更 / 依存追加なし');
  {
    const ea = fs.readFileSync(path.join(__dirname, 'shared', 'evidenceAcquisition.js'), 'utf8');
    assert(ea.indexOf("require('./contentEvidence')") === -1, '20a. evidenceAcquisition.js は contentEvidence を require していない（一方向依存）');
    const ic = fs.readFileSync(path.join(__dirname, 'shared', 'iadpIntelligenceContext.js'), 'utf8');
    assert(ic.indexOf("require('./contentEvidence')") === -1, '20b. iadpIntelligenceContext.js は contentEvidence を require していない');
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
    const deps = Object.keys(pkg.dependencies || {}).sort();
    assert(JSON.stringify(deps) === JSON.stringify(['@anthropic-ai/sdk', '@supabase/supabase-js', 'axios', 'dotenv', 'express', 'opentype.js', 'sharp']),
      '20c. package.json dependencies 変更なし: ' + deps.join(','));
    const ceSrc = fs.readFileSync(path.join(__dirname, 'shared', 'contentEvidence.js'), 'utf8');
    assert(ceSrc.indexOf('generated_hypothesis') !== -1 && ceSrc.indexOf("'generated_hypothesis',") === -1,
      '20d. contentEvidence.js に generated_hypothesis は「除外理由コメント」としてのみ存在し enum 値ではない');
    assert(/[\x00\x7f]/.test(ceSrc) === false, '20e. contentEvidence.js に制御バイト混入なし');
  }

  caseHeader('21. AI 生成物を Evidence 登録する経路 = 0（型レベル）');
  {
    const forbidden = ['generated_hypothesis', 'ai_interpretation', 'heuristic', 'calculated'];
    const leaked = forbidden.filter(function (m) { return ce.CONTENT_EVIDENCE_SOURCE_METHODS.indexOf(m) !== -1; });
    assert(leaked.length === 0, '21a. AI 由来 sourceMethod は enum に 0 件: [' + leaked.join(',') + ']');
    forbidden.forEach(function (m) {
      const iv = ce.isVerifiedContentEvidence(rec({ sourceMethod: m }), { caseId: CASE, now: NOW });
      assert(iv.verified === false, '21b. sourceMethod=' + m + ' は verified 不可');
    });
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All contentEvidence cases passed (CV-3a)'); }
})().catch(function (e) { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
