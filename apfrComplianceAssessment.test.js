'use strict';
// apfrComplianceAssessment.test.js
// APFR Step C-1C-2a: Compliance Assessment Aggregation 合成テスト
// API呼び出し0件 / DB変更なし / 実AI 0 / 本番案件への操作0
// index.html内の _apfrEvaluateComplianceAssessment() と等価なロジックをNode環境で再現して検証する
// （既存apfrComplianceGate.test.js / apfrDisclosureDetection.test.js と同一パターン）。
// あわせて実ソース（index.html）へのstatic検証を行い、
//   ・本関数が既存2 detectorを「呼ぶだけ」で独自判定を持たないこと
//   ・Quality Gate / packageQuality / READY / User Approval / accountCreationReadiness が無変更であること
//   ・Numeric Consistency / APFR Resolver / facts へ一切触れていないこと
// を確認する。

const fs = require('fs');
const path = require('path');
const indexHtmlPath = path.join(__dirname, 'index.html');

// ──────────────────────────────────────────────────────────────
// 1. index.html等価ロジック
// ──────────────────────────────────────────────────────────────

// index.htmlの _apfrComplianceGateNormalize() と等価（既存C-1C-1）
function _apfrComplianceGateNormalize(s) {
  var t = String(s);
  try { if (typeof t.normalize === 'function') t = t.normalize('NFKC'); } catch (e) { /* noop */ }
  return t.toLowerCase().trim();
}

// index.htmlの evaluateComplianceGate() と等価（既存C-1C-1・本テストでは入力として使うのみ）
function evaluateComplianceGate(outputDraft, complianceContext) {
  var EMPTY_NOT_CHECKED = { executed: false, checked: false, status: 'not_checked', violations: [] };
  try {
    if (!outputDraft || typeof outputDraft !== 'object') return EMPTY_NOT_CHECKED;
    var fields = outputDraft.fields;
    if (!fields || typeof fields !== 'object') return EMPTY_NOT_CHECKED;
    if (!complianceContext || typeof complianceContext !== 'object') return EMPTY_NOT_CHECKED;
    var rawNgWords = complianceContext.listingNgWords;
    if (!Array.isArray(rawNgWords) || rawNgWords.length === 0) return EMPTY_NOT_CHECKED;
    var ngWords = [];
    rawNgWords.forEach(function (w) {
      var normalized = _apfrComplianceGateNormalize(w);
      if (normalized !== '') ngWords.push({ raw: String(w), normalized: normalized });
    });
    if (ngWords.length === 0) return EMPTY_NOT_CHECKED;
    var violations = [];
    var seen = {};
    Object.keys(fields).forEach(function (fieldKey) {
      var value = fields[fieldKey];
      var texts = [];
      if (typeof value === 'string') texts.push(value);
      else if (Array.isArray(value)) value.forEach(function (v) { if (v !== null && v !== undefined) texts.push(String(v)); });
      else return;
      texts.forEach(function (text) {
        var normalizedText = _apfrComplianceGateNormalize(text);
        if (normalizedText === '') return;
        ngWords.forEach(function (ng) {
          if (normalizedText.indexOf(ng.normalized) === -1) return;
          var dedupeKey = fieldKey + '::' + ng.raw;
          if (seen[dedupeKey]) return;
          seen[dedupeKey] = true;
          violations.push({ field: fieldKey, ngWord: ng.raw });
        });
      });
    });
    return { executed: true, checked: true, status: violations.length > 0 ? 'violation' : 'clear', violations: violations };
  } catch (e) { return EMPTY_NOT_CHECKED; }
}

// index.htmlの APFR_DISCLOSURE_ACCEPTED_MARKERS と等価（既存C-1C-1b）
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

// index.htmlの _apfrEvaluateDisclosureMarkers() と等価（既存C-1C-1b・本テストでは入力として使うのみ）
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
      if (typeof value === 'string') texts.push(value);
      else if (Array.isArray(value)) value.forEach(function (v) { if (v !== null && v !== undefined) texts.push(String(v)); });
      else return;
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
      executed: true, checked: true, requirementPresent: true,
      foundMarkers: foundMarkers,
      status: foundMarkers.length > 0 ? 'satisfied' : 'missing',
    };
  } catch (e) { return EMPTY_NOT_CHECKED; }
}

// index.htmlの APFR_COMPLIANCE_ASSESSMENT_ITEMS と等価（C-1C-2a）
const APFR_COMPLIANCE_ASSESSMENT_ITEMS = {
  LISTING_NG_WORDS: 'listing_ng_words',
  ADVERTISING_DISCLOSURE: 'advertising_disclosure',
};

// index.htmlの _apfrEvaluateComplianceAssessment() と等価（C-1C-2a・本テストの検証対象）
function _apfrEvaluateComplianceAssessment(outputDraft, complianceContext) {
  var EMPTY_NOT_CHECKED = {
    executed: false, status: 'not_checked', blockers: [], unchecked: [],
    details: { compliance: null, disclosure: null },
  };
  try {
    if (!outputDraft || typeof outputDraft !== 'object') return EMPTY_NOT_CHECKED;
    if (!complianceContext || typeof complianceContext !== 'object') return EMPTY_NOT_CHECKED;
    if (typeof evaluateComplianceGate !== 'function' || typeof _apfrEvaluateDisclosureMarkers !== 'function') return EMPTY_NOT_CHECKED;

    var compliance = evaluateComplianceGate(outputDraft, complianceContext);
    var disclosure = _apfrEvaluateDisclosureMarkers(outputDraft, complianceContext);

    var complianceStatus = (compliance && typeof compliance.status === 'string') ? compliance.status : 'not_checked';
    var disclosureStatus = (disclosure && typeof disclosure.status === 'string') ? disclosure.status : 'not_checked';

    var blockers = [];
    var unchecked = [];

    if (complianceStatus === 'violation') {
      blockers.push({
        type: APFR_COMPLIANCE_ASSESSMENT_ITEMS.LISTING_NG_WORDS,
        label: 'リスティングNGワード違反',
        detail: '禁止語違反：' + ((compliance.violations && compliance.violations.length) || 0) + '件',
      });
    } else if (complianceStatus === 'not_checked') {
      unchecked.push(APFR_COMPLIANCE_ASSESSMENT_ITEMS.LISTING_NG_WORDS);
    }

    if (disclosureStatus === 'missing') {
      blockers.push({
        type: APFR_COMPLIANCE_ASSESSMENT_ITEMS.ADVERTISING_DISCLOSURE,
        label: '広告開示マーカー不足',
        detail: '広告開示マーカーが確認できません',
      });
    } else if (disclosureStatus === 'not_checked') {
      unchecked.push(APFR_COMPLIANCE_ASSESSMENT_ITEMS.ADVERTISING_DISCLOSURE);
    }

    var status;
    if (blockers.length > 0) status = 'blocked';
    else if (complianceStatus === 'not_checked' && disclosureStatus === 'not_checked') status = 'not_checked';
    else status = 'clear';

    return {
      executed: true, status: status, blockers: blockers, unchecked: unchecked,
      details: { compliance: compliance, disclosure: disclosure },
    };
  } catch (e) { return EMPTY_NOT_CHECKED; }
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

const REQ = ['広告主が指定する開示ルール'];
const NG  = ['商品名'];

// 各状態を作るfixture
//   compliance clear      : NGワード登録あり・成果物に含まれない
//   compliance violation  : NGワード登録あり・成果物に含まれる
//   compliance not_checked: NGワード未登録
//   disclosure satisfied  : requirement登録あり・マーカーあり
//   disclosure missing    : requirement登録あり・マーカーなし
//   disclosure not_checked: requirement未登録
function ctx(opts) {
  var o = {};
  if (opts.ng) o.listingNgWords = NG;
  if (opts.req) o.advertisingDisclosureRequirements = REQ;
  return o;
}
function draft(opts) {
  var caption = '';
  if (opts.ngHit) caption += '商品名を掲載します。';
  if (opts.marker) caption += ' 【広告】';
  if (caption === '') caption = '今日のおすすめコスメ';
  return { fields: { caption: caption } };
}

// ──────────────────────────────────────────────────────────────
// 3. status Contract（1〜9）
// ──────────────────────────────────────────────────────────────

caseHeader('1. compliance clear + disclosure satisfied → clear');
{
  const r = _apfrEvaluateComplianceAssessment(draft({ marker: true }), ctx({ ng: true, req: true }));
  assert(r.status === 'clear', '1-1. status=clear');
  assert(r.executed === true, '1-2. executed=true');
  assert(r.blockers.length === 0, '1-3. blockers=0件');
  assert(r.unchecked.length === 0, '1-4. unchecked=0件（両方判定済み）');
}

caseHeader('2. compliance violation + disclosure satisfied → blocked');
{
  const r = _apfrEvaluateComplianceAssessment(draft({ ngHit: true, marker: true }), ctx({ ng: true, req: true }));
  assert(r.status === 'blocked', '2-1. status=blocked');
  assert(r.blockers.length === 1, '2-2. blockers=1件');
  assert(r.blockers[0].type === 'listing_ng_words', '2-3. blocker type=listing_ng_words');
}

caseHeader('3. compliance clear + disclosure missing → blocked');
{
  const r = _apfrEvaluateComplianceAssessment(draft({}), ctx({ ng: true, req: true }));
  assert(r.status === 'blocked', '3-1. status=blocked');
  assert(r.blockers.length === 1, '3-2. blockers=1件');
  assert(r.blockers[0].type === 'advertising_disclosure', '3-3. blocker type=advertising_disclosure');
}

caseHeader('4. compliance violation + disclosure missing → blocked（blockers 2件）');
{
  const r = _apfrEvaluateComplianceAssessment(draft({ ngHit: true }), ctx({ ng: true, req: true }));
  assert(r.status === 'blocked', '4-1. status=blocked');
  assert(r.blockers.length === 2, '4-2. blockers=2件');
  const types = r.blockers.map(function (b) { return b.type; });
  assert(types.indexOf('listing_ng_words') !== -1 && types.indexOf('advertising_disclosure') !== -1, '4-3. 両方のblockerが含まれる');
}

caseHeader('5. compliance not_checked + disclosure not_checked → not_checked');
{
  const r = _apfrEvaluateComplianceAssessment(draft({}), ctx({}));
  assert(r.status === 'not_checked', '5-1. status=not_checked');
  assert(r.blockers.length === 0, '5-2. blockers=0件');
  assert(r.unchecked.length === 2, '5-3. unchecked=2件（両方未検査）');
}

caseHeader('6. compliance clear + disclosure not_checked → clear（uncheckedへ広告開示）');
{
  const r = _apfrEvaluateComplianceAssessment(draft({}), ctx({ ng: true }));
  assert(r.status === 'clear', '6-1. status=clear');
  assert(r.blockers.length === 0, '6-2. blockers=0件');
  assert(r.unchecked.length === 1 && r.unchecked[0] === 'advertising_disclosure', '6-3. uncheckedにadvertising_disclosureが明示される');
}

caseHeader('7. compliance not_checked + disclosure satisfied → clear（uncheckedへlistingNgWords）');
{
  const r = _apfrEvaluateComplianceAssessment(draft({ marker: true }), ctx({ req: true }));
  assert(r.status === 'clear', '7-1. status=clear');
  assert(r.blockers.length === 0, '7-2. blockers=0件');
  assert(r.unchecked.length === 1 && r.unchecked[0] === 'listing_ng_words', '7-3. uncheckedにlisting_ng_wordsが明示される');
}

caseHeader('8. compliance violation + disclosure not_checked → blocked');
{
  const r = _apfrEvaluateComplianceAssessment(draft({ ngHit: true }), ctx({ ng: true }));
  assert(r.status === 'blocked', '8-1. status=blocked');
  assert(r.blockers.length === 1 && r.blockers[0].type === 'listing_ng_words', '8-2. blockerはlisting_ng_words');
  assert(r.unchecked.indexOf('advertising_disclosure') !== -1, '8-3. 広告開示は未検査として保持される');
}

caseHeader('9. compliance not_checked + disclosure missing → blocked');
{
  const r = _apfrEvaluateComplianceAssessment(draft({}), ctx({ req: true }));
  assert(r.status === 'blocked', '9-1. status=blocked');
  assert(r.blockers.length === 1 && r.blockers[0].type === 'advertising_disclosure', '9-2. blockerはadvertising_disclosure');
  assert(r.unchecked.indexOf('listing_ng_words') !== -1, '9-3. 禁止語は未検査として保持される');
}

// ──────────────────────────────────────────────────────────────
// 4. fail-open（10〜13）
// ──────────────────────────────────────────────────────────────

caseHeader('10. null outputDraft → not_checked');
{
  let threw = false; let r;
  try { r = _apfrEvaluateComplianceAssessment(null, ctx({ ng: true, req: true })); } catch (e) { threw = true; }
  assert(threw === false, '10-1. 例外を投げない');
  assert(r && r.status === 'not_checked' && r.executed === false, '10-2. status=not_checked・executed=false');
}

caseHeader('11. undefined → not_checked');
{
  let threw = false; let r;
  try { r = _apfrEvaluateComplianceAssessment(undefined, undefined); } catch (e) { threw = true; }
  assert(threw === false, '11-1. 例外を投げない');
  assert(r && r.status === 'not_checked', '11-2. status=not_checked');
}

caseHeader('12. malformed complianceContext → not_checked');
{
  const r1 = _apfrEvaluateComplianceAssessment(draft({ marker: true }), null);
  const r2 = _apfrEvaluateComplianceAssessment(draft({ marker: true }), 'not-an-object');
  assert(r1.status === 'not_checked' && r2.status === 'not_checked', '12-1. contextが不正ならnot_checked');
}

caseHeader('13. detector例外時 → not_checked（clearを詐称しない）');
{
  // detectorが例外を投げる状況を模擬（fieldsアクセスで例外を起こすgetter）
  const evilDraft = { get fields() { throw new Error('boom'); } };
  let threw = false; let r;
  try { r = _apfrEvaluateComplianceAssessment(evilDraft, ctx({ ng: true, req: true })); } catch (e) { threw = true; }
  assert(threw === false, '13-1. 例外を外へ伝播させない');
  assert(r && r.status !== 'clear', '13-2. 例外時にclearを返さない');
  assert(r && r.status === 'not_checked', '13-3. status=not_checked');
}

// ──────────────────────────────────────────────────────────────
// 5. blockers由来・detector再利用（14〜18・static検証含む）
// ──────────────────────────────────────────────────────────────

caseHeader('14. blockers内容が既存detector結果に由来する');
{
  const r = _apfrEvaluateComplianceAssessment(draft({ ngHit: true }), ctx({ ng: true, req: true }));
  const ngBlocker = r.blockers.filter(function (b) { return b.type === 'listing_ng_words'; })[0];
  const detectorViolations = r.details.compliance.violations.length;
  assert(ngBlocker.detail.indexOf(String(detectorViolations)) !== -1, '14-1. blocker detailの件数がdetector結果のviolations件数と一致');
  assert(r.details.compliance.status === 'violation', '14-2. detailsへcompliance detector結果がそのまま保持される');
  assert(r.details.disclosure.status === 'missing', '14-3. detailsへdisclosure detector結果がそのまま保持される');
}

caseHeader('15-18. 独自再実装0・既存detector再利用（実ソースstatic検証）');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function _apfrEvaluateComplianceAssessment(');
  assert(start !== -1, '15-1. _apfrEvaluateComplianceAssessment() が実在する');
  const end = src.indexOf('\n}\n', start);
  const body = src.slice(start, end !== -1 ? end : start + 6000);

  // 単純grepだとコメント内の説明語（「listingNgWords: violation のみblocker」等）に誤ヒットするため、
  //   行頭の // コメントを除去したコードのみを対象に判定する（説明的言及と機能参照を区別する）。
  const codeOnly = body.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; }).join('\n');
  assert(codeOnly.indexOf('complianceContext.listingNgWords') === -1, '15-2. 独自のlistingNgWords検索を実装していない（context配列を直接参照しない）');
  assert(codeOnly.indexOf('_apfrComplianceGateNormalize') === -1, '15-3. 正規化関数を独自に呼ばない（detector内部の責務）');
  assert(body.indexOf('APFR_DISCLOSURE_ACCEPTED_MARKERS') === -1, '16-1. 独自の広告markerリストを参照していない');
  assert(body.indexOf('foundMarkers.length') === -1, '16-2. marker検出ロジックを再実装していない');
  assert(body.indexOf('evaluateComplianceGate(outputDraft, complianceContext)') !== -1, '17-1. evaluateComplianceGate()を再利用している');
  assert(body.indexOf('_apfrEvaluateDisclosureMarkers(outputDraft, complianceContext)') !== -1, '18-1. _apfrEvaluateDisclosureMarkers()を再利用している');
}

caseHeader('19-21. Numeric Consistency / APFR Resolver / facts 参照0（実ソースstatic検証）');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function _apfrEvaluateComplianceAssessment(');
  const end = src.indexOf('\n}\n', start);
  const body = src.slice(start, end !== -1 ? end : start + 6000);

  assert(body.indexOf('_apfrEvaluateNumericConsistency') === -1, '19-1. Numeric Consistency（C-2-1）への参照0件');
  assert(body.indexOf('mismatch') === -1 && body.indexOf('uncomparable') === -1, '19-2. numeric判定値をblockerに使っていない');
  assert(body.indexOf('_apfrResolveCurrentFact') === -1, '20-1. APFR Resolver呼び出し0件');
  assert(body.indexOf('_apfrBuildComplianceContext') === -1, '20-2. Compliance Context構築を再実装していない（呼び出し側から受け取るだけ）');
  assert(body.indexOf('.facts') === -1, '21-1. product.facts直接走査0件');
}

caseHeader('22-25. mutation 0 / fetch 0 / DB write 0 / AI API 0');
{
  const d = draft({ ngHit: true, marker: true });
  const c = ctx({ ng: true, req: true });
  const dBefore = JSON.stringify(d);
  const cBefore = JSON.stringify(c);
  _apfrEvaluateComplianceAssessment(d, c);
  assert(JSON.stringify(d) === dBefore, '22-1. outputDraftは実行前後で完全不変');
  assert(JSON.stringify(c) === cBefore, '22-2. complianceContextは実行前後で完全不変');

  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function _apfrEvaluateComplianceAssessment(');
  const end = src.indexOf('\n}\n', start);
  const body = src.slice(start, end !== -1 ? end : start + 6000);
  assert(body.indexOf('fetch(') === -1 && body.indexOf('XMLHttpRequest') === -1, '23-1. fetch/XHR参照0件');
  assert(body.indexOf('supabase') === -1 && body.indexOf('Supabase') === -1, '24-1. Supabase参照0件（DB write 0）');
  assert(body.indexOf('pushOutputDraftToServer') === -1 && body.indexOf('_apfrAppendRecord') === -1, '24-2. 保存関数への参照0件（runtime only）');
  assert(body.indexOf('callOpenAI') === -1 && body.indexOf('openai') === -1 && body.indexOf('anthropic') === -1, '25-1. AI API参照0件');
}

// ──────────────────────────────────────────────────────────────
// 6. 既存Contract非変更（26〜34）
// ──────────────────────────────────────────────────────────────

caseHeader('26. evaluateQualityGate()変更0');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const qgStart = src.indexOf('function evaluateQualityGate(packageQuality) {');
  assert(qgStart !== -1, '26-1. evaluateQualityGate()が既存シグネチャのまま存在');
  const qgBody = src.slice(qgStart, src.indexOf('\n}\n', qgStart));
  assert(qgBody.indexOf('ComplianceAssessment') === -1 && qgBody.indexOf('Assessment') === -1, '26-2. evaluateQualityGate()本体にAssessmentへの参照0件');
  assert(qgBody.indexOf('QUALITY_GATE_PASSING_STATUSES.indexOf(sourceStatus)') !== -1, '26-3. 既存passed判定ロジックが無変更');
}

caseHeader('27. evaluateOutputPackageCompleteness()変更0');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const pqStart = src.indexOf('function evaluateOutputPackageCompleteness(draft) {');
  assert(pqStart !== -1, '27-1. 既存シグネチャのまま存在');
  const pqBody = src.slice(pqStart, src.indexOf('\n}\n', pqStart));
  assert(pqBody.indexOf('Assessment') === -1 && pqBody.indexOf('complianceGate') === -1, '27-2. 本体にAssessment/ComplianceGateへの参照0件');
}

caseHeader('28. OUTPUT_STATUS.READY変更0');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  assert(src.indexOf('_lastOutputDraft.status    = noCompletedResults ? OUTPUT_STATUS.ERROR : OUTPUT_STATUS.READY;') !== -1, '28-1. READY判定ロジックが既存のまま');
}

caseHeader('29-30. User Approval変更0');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  // APFR Step C-1C-2b-1（Mobile Approval Enforcement）により canApprove へ Compliance Assessment 由来の
  //   `!_mapCompliance.blocked` が追加された。既存2条件（_mapAllChecked / _mapReviewApproved）は
  //   そのまま維持されており、判定が緩められたのではなく **blocked時に承認不可となる条件が追加** されている。
  //   本assertionは「既存2条件の維持」＋「Enforcement条件の存在」の両方を検証する形へ追随修正（弱化していない）。
  assert(src.indexOf('var canApprove = _mapAllChecked() && _mapReviewApproved(mai) && !_mapCompliance.blocked;') !== -1,
    '29-1. canApprove算出が既存2条件を維持したままCompliance Enforcement条件を追加している（C-1C-2b-1）');
  const apStart = src.indexOf('function approveInstagramPackage() {');
  const apBody = src.slice(apStart, src.indexOf('\n}\n', apStart));
  // C-1C-2b-1でapproveInstagramPackage()へsubmit直前のCompliance再評価が接続された（stale防止）。
  //   旧assertion「Assessmentへの参照0件（＝承認ブロック未接続）」はC-1C-2a時点の正しい状態を固定していたが、
  //   C-1C-2b-1はその接続自体が目的のため、**接続されていること**を検証する形へ追随修正する。
  //   detectorの再実装が持ち込まれていないことは引き続き検証する（弱化していない）。
  assert(apBody.indexOf('_apfrEvaluateMobileApprovalCompliance()') !== -1,
    '29-2. approveInstagramPackage()がsubmit直前にCompliance再評価を行う（C-1C-2b-1・stale防止）');
  assert(apBody.indexOf('listingNgWords') === -1 && apBody.indexOf('APFR_DISCLOSURE_ACCEPTED_MARKERS') === -1
    && apBody.indexOf('_apfrResolveCurrentFact') === -1,
    '29-2b. approveInstagramPackage()本体でdetector/Resolverを再実装していない（helper経由のみ）');
  const iaStart = src.indexOf('function _iadpApproveDesign() {');
  const iaBody = src.slice(iaStart, src.indexOf('\n}\n', iaStart));
  assert(iaBody.indexOf('Assessment') === -1, '30-1. _iadpApproveDesign()本体にAssessmentへの参照0件');
}

caseHeader('31. shared/instagramAccountDesignQuality.js（accountCreationReadiness）変更0');
{
  const src = fs.readFileSync(path.join(__dirname, 'shared', 'instagramAccountDesignQuality.js'), 'utf8');
  assert(src.indexOf('_apfrEvaluateComplianceAssessment') === -1, '31-1. Assessment参照0件');
  assert(src.indexOf('complianceAssessment') === -1, '31-2. complianceAssessment入力を追加していない');
  assert(src.indexOf("accountCreationReadiness = (userApproval === 'approved') ? 'ready' : 'conditional';") !== -1, '31-3. accountCreationReadiness判定ロジックが既存のまま');
}

caseHeader('32-34. server.js / openaiClient.js / claudeClient.js 変更0');
{
  const s = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');
  assert(s.indexOf('_apfrEvaluateComplianceAssessment') === -1, '32-1. server.jsにAssessment参照0件');
  const o = fs.readFileSync(path.join(__dirname, 'openaiClient.js'), 'utf8');
  assert(o.indexOf('_apfrEvaluateComplianceAssessment') === -1, '33-1. openaiClient.jsにAssessment参照0件');
  const c = fs.readFileSync(path.join(__dirname, 'claudeClient.js'), 'utf8');
  assert(c.indexOf('_apfrEvaluateComplianceAssessment') === -1, '34-1. claudeClient.jsにAssessment参照0件');
}

// ──────────────────────────────────────────────────────────────
// 7. UI（35〜41）
// ──────────────────────────────────────────────────────────────

caseHeader('35-40. UI表示（実ソースstatic検証）');
{
  const src = fs.readFileSync(indexHtmlPath, 'utf8');
  const start = src.indexOf('function buildComplianceGateHtml() {');
  assert(start !== -1, '35-1. buildComplianceGateHtml() が実在する');
  const body = src.slice(start, start + 9000);

  assert(body.indexOf('_apfrEvaluateComplianceAssessment') !== -1, '35-2. Assessmentが呼び出されている');
  assert(body.indexOf("clear:       { label: 'CLEAR'") !== -1, '36-1. UI clear表示が存在する');
  assert(body.indexOf("blocked:     { label: 'BLOCKED'") !== -1, '37-1. UI blocked表示が存在する');
  assert(body.indexOf("not_checked: { label: 'NOT CHECKED'") !== -1, '38-1. UI not_checked表示が存在する');
  assert(body.indexOf('未検査項目あり') !== -1, '39-1. unchecked明示表示が存在する（clear＝完全確認済みと誤解させない）');
  assert(body.indexOf('確認表示のみ') !== -1, '40-1. 非ブロッキングである旨の明示文言が存在する（C-1C-1/C-1C-1bのContract文言を維持）');
  assert(body.indexOf('検出・集約のみ') !== -1, '40-2. C-1C-2aが集約であることの補足が存在する');
  assert(body.indexOf('OUTPUT_STATUS.READY') === -1, '40-3. READY遷移への参照0件（非ブロッキング維持）');
  assert(body.indexOf('canApprove') === -1, '40-4. canApproveへの参照0件（非ブロッキング維持）');
}

caseHeader('41. stage状態依存のgit diff型testを新設しない');
{
  const src = fs.readFileSync(path.join(__dirname, 'apfrComplianceAssessment.test.js'), 'utf8');
  // Option Fの教訓（leaderFinalGrounding.test.js 20-2a）: execSyncでgitのdiffコマンドを呼びstage/commit
  //   状態を検出する方式は、commit後にFAILする既知の限界があるため使わない。
  //   検索対象の文字列は自己参照マッチを避けるため分割して組み立てる。
  const forbiddenPattern = 'execSync' + "('git " + 'diff';
  assert(src.indexOf(forbiddenPattern) === -1, '41-1. 本ファイル自身がgitのdiffベースの検出方式を使用していない');
}

// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All APFR Step C-1C-2a compliance assessment aggregation cases passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
