// EEA-10B: Verified Promotion Application の合成テスト。
//   実Web Search・実OpenAI/Claude APIは一切呼ばない。
//   index.html内の _eeaPersistEvidenceCandidates() は client-side専用（DOM依存）でNode実行できないため、
//   本テストはそのPhase1/Phase2アルゴリズムを純関数として同一ロジックで再現し、
//   実際に本番で使う shared/evidenceAcquisition.js の evaluateVerifiedPromotion() / deriveSourceNameFromUrl()
//   と shared/iadpIntelligenceContext.js の resolveIadpEvidence() （いずれも無改変・本物）に対して検証する。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const EvidenceAcquisition = require('./shared/evidenceAcquisition');
const IadpIntel = require('./shared/iadpIntelligenceContext');

// index.html _eeaPersistEvidenceCandidates() のPhase1/Phase2と同一アルゴリズム（テスト専用の再現・本体は変更しない）。
function runPhase1And2(limited, existingEvidence) {
  var nextEvidence = Array.isArray(existingEvidence) ? existingEvidence : [];
  var enriched = limited.map(function (c) {
    return {
      c: c,
      sourceName: (c && c.sourceUrl) ? EvidenceAcquisition.deriveSourceNameFromUrl(c.sourceUrl) : null,
    };
  });
  var promotions = enriched.map(function (item, idx) {
    var fallback = { verificationStatus: 'unverified', eligible: false, reason: null };
    try {
      var c = item.c;
      if (!c || !c.sourceUrl) return fallback;
      var category = c.category || null;
      var existingRelated = nextEvidence.filter(function (e) {
        return e && e.evidenceType === 'web_retrieved' && e.category === category;
      });
      var batchRelated = enriched.filter(function (other, j) {
        return j !== idx && other.c && other.c.category === category;
      }).map(function (other) {
        return {
          sourceUrl: other.c.sourceUrl, sourceName: other.sourceName,
          sourceReference: other.c.sourceUrl, category: other.c.category, evidenceType: 'web_retrieved',
        };
      });
      var related = existingRelated.concat(batchRelated);
      var candidateForEval = {
        sourceUrl: c.sourceUrl, sourceName: item.sourceName,
        sourceReference: c.sourceUrl, category: category, evidenceType: 'web_retrieved',
      };
      var promo = EvidenceAcquisition.evaluateVerifiedPromotion(category, candidateForEval, related);
      return {
        verificationStatus: (promo && promo.eligible) ? 'verified' : 'unverified',
        eligible: !!(promo && promo.eligible), reason: (promo && promo.reason) || null,
      };
    } catch (e) {
      return fallback;
    }
  });
  return { enriched: enriched, promotions: promotions };
}

// ── テスト用sourceUrl（実在ドメインのTier分類を使用。EEA-6の実allowlistに準拠） ──
var GOV_A = 'https://www.mhlw.go.jp/pageA';       // Tier1
var GOV_B = 'https://www.mext.go.jp/pageB';       // Tier1（別publisher）
var GOV_C = 'https://www.meti.go.jp/pageC';       // Tier1（別publisher）
var PLATFORM = 'https://about.instagram.com/x';   // Tier4
var GENERAL_WEB = 'https://example-blog.example/x'; // Tier7（未知ドメイン→既定fallback）
var SNS = 'https://twitter.com/someone/status/1'; // Tier8

function cand(url, category, query) { return { sourceUrl: url, sourceTitle: 't', category: category, query: query || 'q' }; }

// 1. market Tier1 A/B/C 独立3Publisher → 3件すべてverified
test('EEA-10B: 独立3publisher(Tier1)の同時batchは3件ともverified', () => {
  var limited = [cand(GOV_A, 'market'), cand(GOV_B, 'market'), cand(GOV_C, 'market')];
  var r = runPhase1And2(limited, []);
  assert.deepEqual(r.promotions.map(p => p.verificationStatus), ['verified', 'verified', 'verified']);
});

// 2. 逆順 → 結果同一
test('EEA-10B: 逆順でも結果は同一', () => {
  var limited = [cand(GOV_C, 'market'), cand(GOV_B, 'market'), cand(GOV_A, 'market')];
  var r = runPhase1And2(limited, []);
  assert.deepEqual(r.promotions.map(p => p.verificationStatus), ['verified', 'verified', 'verified']);
});

// 3. ランダム順 → 結果同一
test('EEA-10B: ランダム順でも結果は同一', () => {
  var limited = [cand(GOV_B, 'market'), cand(GOV_A, 'market'), cand(GOV_C, 'market')];
  var r = runPhase1And2(limited, []);
  assert.deepEqual(r.promotions.map(p => p.verificationStatus), ['verified', 'verified', 'verified']);
});

// 4a. 同一Publisher A/A のみ（2件とも同一publisher）→ 実際の独立publisherは1件のみ → 水増しされず両方unverified
test('EEA-10B: 同一Publisherのみ2件では独立source不足でunverified', () => {
  var limited = [cand(GOV_A, 'market', 'q1'), cand(GOV_A, 'market', 'q2')];
  var r = runPhase1And2(limited, []);
  // A(1)から見た母集団はA(2)のみ=同一publisher。自分(A)+related(A)=重複排除で独立1publisherのみ→不足
  assert.deepEqual(r.promotions.map(p => p.verificationStatus), ['unverified', 'unverified']);
});

// 4b. 同一Publisher A/A + 別Publisher B → 実際の独立publisherはA・Bの2件 → 3件全てがこの2publisherを参照しverified
test('EEA-10B: 同一Publisher重複を含んでいても実独立publisher数（A,Bの2件）で正しく評価される', () => {
  var limited = [cand(GOV_A, 'market', 'q1'), cand(GOV_A, 'market', 'q2'), cand(GOV_B, 'market')];
  var r = runPhase1And2(limited, []);
  // A(1): 自分(A)+related{A(2)=A重複排除,B}=独立{A,B}=2件 → verified
  // A(2): 自分(A)+related{A(1)=A重複排除,B}=独立{A,B}=2件 → verified
  // B  : 自分(B)+related{A(1),A(2)=A重複排除}=独立{B,A}=2件 → verified
  // いずれも「水増し」ではなく実在する2つの独立publisher(A,B)を正しく2件と数えた結果である
  assert.deepEqual(r.promotions.map(p => p.verificationStatus), ['verified', 'verified', 'verified']);
});

// 5. market Tier1単独 → unverified（independent不足）
test('EEA-10B: 単独candidateはindependent不足でunverified', () => {
  var limited = [cand(GOV_A, 'market')];
  var r = runPhase1And2(limited, []);
  assert.equal(r.promotions[0].verificationStatus, 'unverified');
});

// 6. competition Tier7単独禁止
test('EEA-10B: competition + Tier7は単独禁止でunverified', () => {
  var limited = [cand(GENERAL_WEB, 'competition'), cand(GOV_A, 'competition')];
  var r = runPhase1And2(limited, []);
  assert.equal(r.promotions[0].verificationStatus, 'unverified'); // Tier7自身は常に禁止
});

// 7. Tier8（SNS）は常にunverified
test('EEA-10B: Tier8(SNS)はclaimType不問でunverified', () => {
  var limited = [cand(SNS, 'market'), cand(GOV_A, 'market'), cand(GOV_B, 'market')];
  var r = runPhase1And2(limited, []);
  assert.equal(r.promotions[0].verificationStatus, 'unverified');
});

// 8. monetization → 常にunverified（mapping未実装・安全側維持）
test('EEA-10B: monetizationは常にunverified（claimType未対応のfail-open）', () => {
  var limited = [cand(GOV_A, 'monetization'), cand(GOV_B, 'monetization'), cand(GOV_C, 'monetization')];
  var r = runPhase1And2(limited, []);
  assert.deepEqual(r.promotions.map(p => p.verificationStatus), ['unverified', 'unverified', 'unverified']);
});

// 9. 既存正本Publisher A + batch B/C → B/Cの判定に既存Aを利用可能
test('EEA-10B: 既存正本のEvidenceがrelatedEvidenceListとして利用される', () => {
  var existing = [{ evidenceType: 'web_retrieved', category: 'market', sourceUrl: GOV_A, sourceName: EvidenceAcquisition.deriveSourceNameFromUrl(GOV_A) }];
  var limited = [cand(GOV_B, 'market')]; // batch内はB単独だが、既存Aと合わせて独立2件になるはず
  var r = runPhase1And2(limited, existing);
  assert.equal(r.promotions[0].verificationStatus, 'verified');
});

// 10. 既存Evidenceは書き換えられない（参照渡しでも内容変更なし）
test('EEA-10B: 既存Evidence配列はPhase1/2実行後も変更されない', () => {
  var existing = [{ evidenceType: 'web_retrieved', category: 'market', sourceUrl: GOV_A, sourceName: 'mhlw.go.jp', verificationStatus: 'unverified' }];
  var snapshot = JSON.parse(JSON.stringify(existing));
  var limited = [cand(GOV_B, 'market')];
  runPhase1And2(limited, existing);
  assert.deepEqual(existing, snapshot);
});

// 11. sourceUrl欠落 → crashなし・unverified
test('EEA-10B: sourceUrl欠落はcrashせずunverified', () => {
  var limited = [{ sourceTitle: 't', category: 'market' }, cand(GOV_A, 'market')];
  assert.doesNotThrow(() => {
    var r = runPhase1And2(limited, []);
    assert.equal(r.promotions[0].verificationStatus, 'unverified');
  });
});

// 12. 不正URL → crashなし・unverified
test('EEA-10B: 不正URLはcrashせずunverified', () => {
  var limited = [cand('not-a-valid-url', 'market'), cand(GOV_A, 'market')];
  assert.doesNotThrow(() => {
    var r = runPhase1And2(limited, []);
    assert.equal(r.promotions[0].verificationStatus, 'unverified');
  });
});

// 13. Web verified 3件 + Independent>=2 → resolveIadpEvidence()が既存Gate無改修でsufficientへ遷移
test('EEA-10B結合: verified Web Evidence 3件でresolveIadpEvidence()がsufficientになる', () => {
  var limited = [cand(GOV_A, 'market'), cand(GOV_B, 'market'), cand(GOV_C, 'market')];
  var r = runPhase1And2(limited, []);
  var savedEvidence = limited.map(function (c, idx) {
    return {
      evidenceId: 'ev-' + idx, evidenceType: 'web_retrieved', category: c.category,
      sourceUrl: c.sourceUrl, sourceName: r.enriched[idx].sourceName,
      verificationStatus: r.promotions[idx].verificationStatus,
      caseId: 'case-test-eea10b',
    };
  });
  var ctx = { caseId: 'case-test-eea10b', evidence: savedEvidence };
  var resolved = IadpIntel.resolveIadpEvidence(ctx, { caseId: 'case-test-eea10b' });
  assert.equal(resolved.verifiedCount, 3);
  assert.ok(resolved.independentSourceCount >= 2);
  assert.equal(resolved.status, 'sufficient');
});

// 14. 入力順変更 → Gate結果不変
test('EEA-10B結合: 入力順を変えてもGate結果(status)は不変', () => {
  var order1 = [cand(GOV_A, 'market'), cand(GOV_B, 'market'), cand(GOV_C, 'market')];
  var order2 = [cand(GOV_C, 'market'), cand(GOV_A, 'market'), cand(GOV_B, 'market')];
  function buildStatus(limited) {
    var r = runPhase1And2(limited, []);
    var savedEvidence = limited.map(function (c, idx) {
      return {
        evidenceType: 'web_retrieved', category: c.category, sourceUrl: c.sourceUrl,
        sourceName: r.enriched[idx].sourceName, verificationStatus: r.promotions[idx].verificationStatus,
        caseId: 'case-test-order',
      };
    });
    var ctx = { caseId: 'case-test-order', evidence: savedEvidence };
    return IadpIntel.resolveIadpEvidence(ctx, { caseId: 'case-test-order' }).status;
  }
  assert.equal(buildStatus(order1), buildStatus(order2));
  assert.equal(buildStatus(order1), 'sufficient');
});

// 15. 既存user_input/public_fact等の判定は本変更の影響を受けない（回帰）
test('EEA-10B回帰: 既存の手入力Evidence(user_input)判定は無影響', () => {
  var ctx = {
    caseId: 'case-test-regress',
    evidence: [
      { evidenceType: 'user_input', category: null, caseId: 'case-test-regress', sourceName: 'manual-1' },
      { evidenceType: 'user_input', category: null, caseId: 'case-test-regress', sourceName: 'manual-2' },
      { evidenceType: 'user_input', category: null, caseId: 'case-test-regress', sourceName: 'manual-3' },
    ],
  };
  var resolved = IadpIntel.resolveIadpEvidence(ctx, { caseId: 'case-test-regress' });
  // 従来通りevidenceType membershipのみでverified判定される（verificationStatus/web_retrieved経路を通らない）
  assert.equal(resolved.verifiedCount, 3);
});

// 16. Gate閾値・独立判定契約が変更されていないことの確認（定数値の回帰）
test('EEA-10B回帰: Gate閾値定数は無変更', () => {
  assert.equal(IadpIntel.MIN_VERIFIED_EVIDENCE, 3);
  assert.equal(IadpIntel.MIN_INDEPENDENT_SOURCES, 2);
});
