'use strict';
// apfrDisclosureDetection.test.js
// APFR Step C-1C-1b: Advertising Disclosure Detection 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / 本番案件への操作0
// index.html内の _apfrEvaluateDisclosureMarkers() / APFR_DISCLOSURE_ACCEPTED_MARKERS と等価なロジックを
// Node環境で再現して検証する（既存apfrComplianceGate.test.js等と同一パターン）。
// あわせて実ソース（index.html）へのstatic検証を行い、
//   ・evaluateComplianceGate() / listingNgWords Contractが無変更であること
//   ・packageQuality / evaluateQualityGate() / READY / User Approval / IADP canApprove が無変更であること
//   ・_apfrEvaluateDisclosureMarkers()がfetch/DB/AI APIを一切参照していないこと
// を確認する。

const fs = require('fs');
const path = require('path');
const indexHtmlPath = path.join(__dirname, 'index.html');

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック（_apfrComplianceGateNormalize + Advertising Disclosure Detection）
// ──────────────────────────────────────────────────────────────

// index.htmlの _apfrComplianceGateNormalize() と等価
function _apfrComplianceGateNormalize(s) {
  var t = String(s);
  try { if (typeof t.normalize === 'function') t = t.normalize('NFKC'); } catch (e) { /* noop */ }
  return t.toLowerCase().trim();
}

// index.htmlの APFR_DISCLOSURE_ACCEPTED_MARKERS と等価
const APFR_DISCLOSURE_ACCEPTED_MARKERS = [
  { type: 'label',    display: '【広告】', normalized: _apfrComplianceGateNormalize('【広告】') },
  { type: 'label',    display: '【PR】',   normalized: _apfrComplianceGateNormalize('【PR】') },
  { type: 'hashtag',  display: '#広告',        normalized: _apfrComplianceGateNormalize('広告') },
  { type: 'hashtag',  display: '#PR',          normalized: _apfrComplianceGateNormalize('PR') },
  { type: 'hashtag',  display: '#プロモーション', normalized: _apfrComplianceGateNormalize('プロモーション') },
  { type: 'sentence', display: 'この投稿はアフィリエイト広告を利用しています', normalized: _apfrComplianceGateNormalize('この投稿はアフィリエイト広告を利用しています') },
  { type: 'sentence', display: 'この投稿はプロモーションを含みます',           normalized: _apfrComplianceGateNormalize('この投稿はプロモーションを含みます') },
  { type: 'sentence', display: 'この投稿には広告が含まれます',                 normalized: _apfrComplianceGateNormalize('この投稿には広告が含まれます') },
];

// index.htmlの _apfrEvaluateDisclosureMarkers() と等価
function _apfrEvaluateDisclosureMarkers(outputDraft, complianceContext) {
  var EMPTY_NOT_CHECKED = { executed: false, checked: false, requirementPresent: false, foundMarkers: [], status: 'not_checked' };
  try {
    if (!outputDraft || typeof outputDraft !== 'object') return EMPTY_NOT_CHECKED;
    var fields = outputDraft.fields;
    if (!fields || typeof fields !== 'object') return EMPTY_NOT_CHECKED;
    if (!complianceContext || typeof complianceContext !== 'object') return EMPTY_NOT_CHECKED;

    var requirements = complianceContext.advertisingDisclosureRequirements;
    if (!Array.isArray(requirements) || requirements.length === 0) return EMPTY_NOT_CHECKED;

    var foundSeen = {};
    var foundMarkers = [];
    function addMarker(display) {
      if (foundSeen[display]) return;
      foundSeen[display] = true;
      foundMarkers.push(display);
    }

    Object.keys(fields).forEach(function (fieldKey) {
      var value = fields[fieldKey];
      var texts = [];
      if (typeof value === 'string') {
        texts.push(value);
      } else if (Array.isArray(value)) {
        value.forEach(function (v) { if (v !== null && v !== undefined) texts.push(String(v)); });
      } else {
        return;
      }
      texts.forEach(function (text) {
        var normalizedText = _apfrComplianceGateNormalize(text);
        if (normalizedText === '') return;

        APFR_DISCLOSURE_ACCEPTED_MARKERS.forEach(function (m) {
          if (m.type === 'hashtag') return;
          if (normalizedText.indexOf(m.normalized) !== -1) addMarker(m.display);
        });

        var tokenRe = /#([^\s#]+)/g;
        var tm;
        while ((tm = tokenRe.exec(normalizedText)) !== null) {
          var token = tm[1];
          APFR_DISCLOSURE_ACCEPTED_MARKERS.forEach(function (m) {
            if (m.type !== 'hashtag') return;
            if (token === m.normalized) addMarker(m.display);
          });
        }
      });
    });

    return {
      executed: true,
      checked: true,
      requirementPresent: true,
      foundMarkers: foundMarkers,
      status: foundMarkers.length > 0 ? 'satisfied' : 'missing',
    };
  } catch (e) {
    return EMPTY_NOT_CHECKED;
  }
}

// ──────────────────────────────────────────────────────────────
// 2. テストハーネス
// ──────────────────────────────────────────────────────────────
let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log(`  ✅ ${label}`); }
  else { _failed++; console.log(`  ❌ ${label}`); }
}
function caseHeader(t) { console.log(`\n── ${t} ──`); }

const REQ_PRESENT = ['広告主が指定する開示ルール']; // requirementPresent=trueを成立させるfixture（内容は判定に使わない）

function draftWith(fields) { return { fields: fields }; }
function ctxWith(requirements) { return { advertisingDisclosureRequirements: requirements }; }

// ──────────────────────────────────────────────────────────────
// 3. 振る舞いテスト（1〜26）
// ──────────────────────────────────────────────────────────────

caseHeader('1. requirementあり + 【広告】 → satisfied');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ caption: '今回の投稿は【広告】案件です' }), ctxWith(REQ_PRESENT));
  assert(r.status === 'satisfied', '1-1. status=satisfied');
  assert(r.foundMarkers.indexOf('【広告】') !== -1, '1-2. foundMarkersに【広告】が含まれる');
}

caseHeader('2. requirementあり + 【PR】 → satisfied');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ caption: '【PR】このアイテムを紹介します' }), ctxWith(REQ_PRESENT));
  assert(r.status === 'satisfied', '2-1. status=satisfied');
  assert(r.foundMarkers.indexOf('【PR】') !== -1, '2-2. foundMarkersに【PR】が含まれる');
}

caseHeader('3. requirementあり + #PR → satisfied');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ hashtags: ['#スキンケア', '#PR'] }), ctxWith(REQ_PRESENT));
  assert(r.status === 'satisfied', '3-1. status=satisfied');
  assert(r.foundMarkers.indexOf('#PR') !== -1, '3-2. foundMarkersに#PRが含まれる');
}

caseHeader('4. requirementあり + #広告 → satisfied');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ hashtags: ['#広告'] }), ctxWith(REQ_PRESENT));
  assert(r.status === 'satisfied', '4-1. status=satisfied');
}

caseHeader('5. requirementあり + #プロモーション → satisfied');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ hashtags: ['#プロモーション'] }), ctxWith(REQ_PRESENT));
  assert(r.status === 'satisfied', '5-1. status=satisfied');
}

caseHeader('6. requirementあり + 「この投稿はアフィリエイト広告を利用しています」 → satisfied');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ caption: 'この投稿はアフィリエイト広告を利用しています。詳細はプロフィールから。' }), ctxWith(REQ_PRESENT));
  assert(r.status === 'satisfied', '6-1. status=satisfied');
}

caseHeader('7. requirementあり + 「この投稿はプロモーションを含みます」 → satisfied');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ caption: 'この投稿はプロモーションを含みます。' }), ctxWith(REQ_PRESENT));
  assert(r.status === 'satisfied', '7-1. status=satisfied');
}

caseHeader('8. requirementあり + 「この投稿には広告が含まれます」 → satisfied');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ caption: 'この投稿には広告が含まれます。' }), ctxWith(REQ_PRESENT));
  assert(r.status === 'satisfied', '8-1. status=satisfied');
}

caseHeader('9. requirementあり + markerなし → missing');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ caption: '今日のおすすめコスメを紹介します！' }), ctxWith(REQ_PRESENT));
  assert(r.status === 'missing', '9-1. status=missing');
  assert(r.requirementPresent === true, '9-2. requirementPresent=true');
  assert(r.foundMarkers.length === 0, '9-3. foundMarkers=0件');
}

caseHeader('10. requirementなし（field自体が存在しない） → not_checked');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ caption: '#PR 今日のおすすめ' }), {});
  assert(r.status === 'not_checked', '10-1. status=not_checked');
  assert(r.requirementPresent === false, '10-2. requirementPresent=false');
}

caseHeader('11. none相当（C-1Aのnone fixture：フィールド非出力） → not_checked');
{
  // C-1Aの既存Contract上、none/ambiguousはcomplianceContextへ出力されない＝fieldキー自体が存在しない
  const ctx = { listingNgWords: ['禁止語A'] }; // advertisingDisclosureRequirementsキーが存在しない
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ caption: '#PR' }), ctx);
  assert(r.status === 'not_checked', '11-1. status=not_checked');
}

caseHeader('12. ambiguous相当（同上・非出力） → not_checked');
{
  const ctx = { regulatoryCategory: '医薬部外品' }; // advertisingDisclosureRequirementsキーが存在しない
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ caption: '#PR' }), ctx);
  assert(r.status === 'not_checked', '12-1. status=not_checked');
}

caseHeader('13. empty array → not_checked');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ caption: '#PR' }), ctxWith([]));
  assert(r.status === 'not_checked', '13-1. status=not_checked');
}

caseHeader('14. array output field内marker → satisfied');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ hashtags: ['#コスメ', '#美容', '#PR', '#おすすめ'] }), ctxWith(REQ_PRESENT));
  assert(r.status === 'satisfied', '14-1. status=satisfied');
}

caseHeader('15. caption内marker → satisfied');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ caption: 'テスト文章 【広告】 続き' }), ctxWith(REQ_PRESENT));
  assert(r.status === 'satisfied', '15-1. status=satisfied');
}

caseHeader('16. slides内marker → satisfied');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ slides: ['スライド1本文', '#広告 スライド2本文'] }), ctxWith(REQ_PRESENT));
  assert(r.status === 'satisfied', '16-1. status=satisfied');
}

caseHeader('17. NFKC正規化: 全角＃ＰＲでも正常検出');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ caption: '本文　＃ＰＲ　です' }), ctxWith(REQ_PRESENT));
  assert(r.status === 'satisfied', '17-1. status=satisfied（全角#PRがNFKCで#PRとして検出される）');
}

caseHeader('18. #pr 大文字小文字差異でも正常検出');
{
  const r1 = _apfrEvaluateDisclosureMarkers(draftWith({ hashtags: ['#pr'] }), ctxWith(REQ_PRESENT));
  const r2 = _apfrEvaluateDisclosureMarkers(draftWith({ hashtags: ['#Pr'] }), ctxWith(REQ_PRESENT));
  const r3 = _apfrEvaluateDisclosureMarkers(draftWith({ hashtags: ['#PR'] }), ctxWith(REQ_PRESENT));
  assert(r1.status === 'satisfied' && r2.status === 'satisfied' && r3.status === 'satisfied', '18-1. #pr/#Pr/#PRいずれもsatisfied');
}

caseHeader('19. #profile は #PR として誤検出しない');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ hashtags: ['#profile'] }), ctxWith(REQ_PRESENT));
  assert(r.status === 'missing', '19-1. status=missing（#profileはtoken完全一致しないため誤検出なし）');
}

caseHeader('20. 「広告表示義務について」等の無境界部分一致ではsatisfiedにしない');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ caption: '広告表示義務について説明します' }), ctxWith(REQ_PRESENT));
  assert(r.status === 'missing', '20-1. status=missing（単なる「広告」の部分一致では昇格しない）');
}

caseHeader('21. #アフィリエイトのみ → satisfiedにしない');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ hashtags: ['#アフィリエイト'] }), ctxWith(REQ_PRESENT));
  assert(r.status === 'missing', '21-1. status=missing');
}

caseHeader('22. #案件のみ → satisfiedにしない');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ hashtags: ['#案件'] }), ctxWith(REQ_PRESENT));
  assert(r.status === 'missing', '22-1. status=missing');
}

caseHeader('23. #提供のみ → satisfiedにしない');
{
  const r = _apfrEvaluateDisclosureMarkers(draftWith({ hashtags: ['#提供'] }), ctxWith(REQ_PRESENT));
  assert(r.status === 'missing', '23-1. status=missing');
}

caseHeader('24. null input → 例外なし / not_checked');
{
  let threw = false;
  let r;
  try { r = _apfrEvaluateDisclosureMarkers(null, null); } catch (e) { threw = true; }
  assert(threw === false, '24-1. 例外を投げない');
  assert(r && r.status === 'not_checked', '24-2. status=not_checked');
}

caseHeader('25. undefined → not_checked');
{
  let threw = false;
  let r;
  try { r = _apfrEvaluateDisclosureMarkers(undefined, undefined); } catch (e) { threw = true; }
  assert(threw === false, '25-1. 例外を投げない');
  assert(r && r.status === 'not_checked', '25-2. status=not_checked');
}

caseHeader('26. malformed fields（非オブジェクト） → not_checked');
{
  const r1 = _apfrEvaluateDisclosureMarkers({ fields: 'not-an-object' }, ctxWith(REQ_PRESENT));
  const r2 = _apfrEvaluateDisclosureMarkers({ fields: null }, ctxWith(REQ_PRESENT));
  const r3 = _apfrEvaluateDisclosureMarkers({}, ctxWith(REQ_PRESENT));
  assert(r1.status === 'not_checked' && r2.status === 'not_checked' && r3.status === 'not_checked', '26-1. fields不正時はいずれもnot_checked・例外なし');
}

caseHeader('27. mutation: 実行前後でoutputDraft/complianceContextがdeep equal');
{
  const draft = draftWith({ caption: '#PR 今日のおすすめ', hashtags: ['#PR', '#コスメ'] });
  const ctx = ctxWith(REQ_PRESENT);
  const draftBefore = JSON.stringify(draft);
  const ctxBefore = JSON.stringify(ctx);
  _apfrEvaluateDisclosureMarkers(draft, ctx);
  assert(JSON.stringify(draft) === draftBefore, '27-1. outputDraftは実行前後で完全不変');
  assert(JSON.stringify(ctx) === ctxBefore, '27-2. complianceContextは実行前後で完全不変');
}

// ──────────────────────────────────────────────────────────────
// 4. static検証（実ソースindex.html）
// ──────────────────────────────────────────────────────────────

caseHeader('28-30. fetch / DB write / AI API 参照0件（実ソースstatic検証）');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function _apfrEvaluateDisclosureMarkers(');
  assert(start !== -1, '28-1. _apfrEvaluateDisclosureMarkers() が実在する');
  if (start !== -1) {
    const end = src.indexOf('\n}\n', start);
    const body = src.slice(start, end !== -1 ? end : start + 4000);
    assert(body.indexOf('fetch(') === -1, '28-2. fetch()呼び出しが0件');
    assert(body.indexOf('XMLHttpRequest') === -1, '28-3. XMLHttpRequest参照が0件');
    assert(body.indexOf('supabase') === -1 && body.indexOf('Supabase') === -1, '29-1. Supabase参照が0件（DB write 0）');
    assert(body.indexOf('INSERT') === -1 && body.indexOf('UPDATE') === -1, '29-2. SQL操作文字列が0件');
    assert(body.indexOf('callOpenAI') === -1 && body.indexOf('openai') === -1 && body.indexOf('anthropic') === -1, '30-1. AI API呼び出し参照が0件');
    assert(body.indexOf('.facts') === -1, '30-2. APFR facts直接走査が0件（Resolver責務を侵さない）');
    assert(body.indexOf('_apfrResolveCurrentFact(') === -1 && body.indexOf('_apfrResolveCurrentFacts(') === -1, '30-3. Resolver呼び出しが0件（C-1Aが構築済みのcomplianceContextのみをconsumerとして使用）');
  }
}

caseHeader('31. evaluateComplianceGate()本体変更0（listingNgWords Contract保護）');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function evaluateComplianceGate(');
  assert(start !== -1, '31-1. evaluateComplianceGate() が実在する');
  const end = src.indexOf('\n}\n', start);
  const body = src.slice(start, end);
  assert(body.indexOf('advertisingDisclosureRequirements') === -1, '31-2. evaluateComplianceGate()本体はadvertisingDisclosureRequirementsを参照しない（listingNgWords Contract非混在）');
  assert(body.indexOf('var rawNgWords = complianceContext.listingNgWords;') !== -1, '31-3. listingNgWords判定ロジックが既存のまま');
}

caseHeader('32. evaluateQualityGate()変更0');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const qgStart = src.indexOf('function evaluateQualityGate(packageQuality) {');
  assert(qgStart !== -1, '32-1. evaluateQualityGate()が既存シグネチャのまま存在');
  const qgEnd = src.indexOf('\n}\n', qgStart);
  const qgBody = src.slice(qgStart, qgEnd);
  assert(qgBody.indexOf('Disclosure') === -1 && qgBody.indexOf('disclosure') === -1, '32-2. evaluateQualityGate()本体にDisclosure Detectionへの参照が0件');
  assert(qgBody.indexOf('QUALITY_GATE_PASSING_STATUSES.indexOf(sourceStatus)') !== -1, '32-3. 既存のpassed判定ロジックが無変更');
}

caseHeader('33. READY変更0');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(src.indexOf("_lastOutputDraft.status    = noCompletedResults ? OUTPUT_STATUS.ERROR : OUTPUT_STATUS.READY;") !== -1, '33-1. OUTPUT_STATUS.READY判定ロジックが既存のまま');
}

caseHeader('34. User Approval変更0');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  // C-1C-2b-1（Mobile Approval Enforcement）でcanApproveへ `!_mapCompliance.blocked` が追加された。
  //   本test（C-1C-1b）の関心は「_apfrEvaluateDisclosureMarkers()がUser Approvalを直接操作していないこと」であり、
  //   既存2条件が維持されていることを引き続き検証する（Enforcementはhelper経由でありC-1C-1bの責務外）。
  assert(src.indexOf('var canApprove = _mapAllChecked() && _mapReviewApproved(mai) && !_mapCompliance.blocked;') !== -1,
    '34-1. canApprove算出が既存2条件を維持している（C-1C-2b-1のEnforcement条件追加後も_mapAllChecked/_mapReviewApprovedは不変）');
  const start = src.indexOf('function approveInstagramPackage() {');
  assert(start !== -1, '34-2. approveInstagramPackage()が実在する');
  const end = src.indexOf('\n}\n', start);
  const body = src.slice(start, end);
  // C-1C-2b-1でapproveInstagramPackage()へCompliance Enforcementが接続された（承認ブロック接続済み）。
  //   ただし接続は集約helper（_apfrEvaluateMobileApprovalCompliance → Assessment）経由であり、
  //   Disclosure Detectorを直接呼ぶ・再実装することは引き続き禁止であるため、その点を検証する形へ追随修正する。
  assert(body.indexOf('_apfrEvaluateDisclosureMarkers') === -1 && body.indexOf('APFR_DISCLOSURE_ACCEPTED_MARKERS') === -1,
    '34-3. approveInstagramPackage()本体がDisclosure Detectorを直接参照・再実装していない（C-1C-2b-1のEnforcementはhelper経由のみ）');
}

caseHeader('35. server.js変更0（Disclosure Detection関連識別子が存在しない）');
{
  const src = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert(src.indexOf('_apfrEvaluateDisclosureMarkers') === -1, '35-1. server.jsに_apfrEvaluateDisclosureMarkers参照が0件');
  assert(src.indexOf('APFR_DISCLOSURE_ACCEPTED_MARKERS') === -1, '35-2. server.jsにAPFR_DISCLOSURE_ACCEPTED_MARKERS参照が0件');
}

caseHeader('36. openaiClient.js変更0');
{
  const src = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
  assert(src.indexOf('_apfrEvaluateDisclosureMarkers') === -1, '36-1. openaiClient.jsに_apfrEvaluateDisclosureMarkers参照が0件');
}

caseHeader('37. claudeClient.js変更0');
{
  const src = fs.readFileSync(path.join(__dirname, 'claudeClient.js'), 'utf8');
  assert(src.indexOf('_apfrEvaluateDisclosureMarkers') === -1, '37-1. claudeClient.jsに_apfrEvaluateDisclosureMarkers参照が0件');
}

caseHeader('38. shared/leaderRuleEngine.js変更0');
{
  const src = fs.readFileSync(path.join(__dirname, 'shared', 'leaderRuleEngine.js'), 'utf8');
  assert(src.indexOf('_apfrEvaluateDisclosureMarkers') === -1, '38-1. shared/leaderRuleEngine.jsに_apfrEvaluateDisclosureMarkers参照が0件');
}

caseHeader('39. stage状態に依存するgit diff型testを使用しない');
{
  const src = fs.readFileSync(path.join(__dirname, 'apfrDisclosureDetection.test.js'), 'utf8');
  // Option Fの教訓（leaderFinalGrounding.test.js 20-2a）: execSyncでgitのdiffコマンドを呼びstage/commit
  //   状態を検出する方式は、commit後にFAILする既知の限界があるため使わない。
  //   検索対象の文字列は自己参照マッチを避けるため分割して組み立てる。
  const forbiddenPattern = 'execSync' + "('git " + 'diff';
  assert(src.indexOf(forbiddenPattern) === -1, '39-1. 本ファイル自身がgit diffベースの検出方式を使用していない（Option Fの教訓を踏襲）');
}

caseHeader('40. 既存C-1C-1 Contract維持: Output Engine配線・独立パネルとしての接続確認');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(src.indexOf("_oeSafe(buildComplianceGateHtml,           'ComplianceGate')") !== -1, '40-1. buildComplianceGateHtmlのOutput Engine配線が既存のまま維持');
  const start = src.indexOf('function buildComplianceGateHtml() {');
  assert(start !== -1, '40-2. buildComplianceGateHtml()が実在する');
  const end = src.indexOf('\napfrDisclosureDetectionMarkerNeverMatches', start); // dummy: force fallback below
  const body = src.slice(start, start + 6000);
  assert(body.indexOf('_apfrEvaluateDisclosureMarkers') !== -1, '40-3. buildComplianceGateHtml()内でDisclosure Detectionが呼び出されている');
  assert(body.indexOf('OUTPUT_STATUS.READY') === -1, '40-4. READY遷移への参照0件（非ブロッキング維持）');
  assert(body.indexOf('canApprove') === -1, '40-5. canApprove（IADP承認）への参照0件（非ブロッキング維持）');
  assert(body.indexOf('確認表示のみ') !== -1, '40-6. 非ブロッキングである旨の明示文言が存在する');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All APFR Step C-1C-1b advertising disclosure detection cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
