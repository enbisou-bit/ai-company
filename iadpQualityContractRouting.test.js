'use strict';
// iadpQualityContractRouting.test.js
// Phase IG-QC: IADP Quality Contract配線修正 合成テスト
// API呼び出し0件 / DB変更なし / index.html変更不要
// 修正したrouting logicをNode環境で再現して Cases A-H を検証する

// ──────────────────────────────────────────────────────────────
// 1. ブラウザグローバル最小スタブ
// ──────────────────────────────────────────────────────────────
const OUTPUT_PACKAGE_QUALITY_VERSION = '1.0';

function evaluateOutputPackageCompleteness(draft) {
  // スタブ: instagram_post用10項目チェック（本番ロジックの代替・挙動の証人として使用）
  return {
    version: OUTPUT_PACKAGE_QUALITY_VERSION,
    outputType: draft.type,
    category: 'instagram',
    score: 20,
    status: 'insufficient',
    missingItems: [
      { key: 'hook',         label: 'フック',           hasSchemaField: true },
      { key: 'slideTitles',  label: 'スライドタイトル', hasSchemaField: true },
      { key: 'slideBody',    label: 'スライド本文',     hasSchemaField: true },
      { key: 'hashtags',     label: 'ハッシュタグ',     hasSchemaField: true },
      { key: 'imagePrompts', label: '画像プロンプト',   hasSchemaField: true },
      { key: 'targetAudience', label: 'ターゲット',     hasSchemaField: true },
      { key: 'benefit',      label: 'ベネフィット',     hasSchemaField: true },
      { key: 'saveSharePrompt', label: '保存促進',      hasSchemaField: true },
    ],
    completedItems: [
      { key: 'caption', label: 'キャプション', hasSchemaField: true },
      { key: 'cta',     label: 'CTA',          hasSchemaField: true },
    ],
    recommendations: [],
    nextActions: [],
  };
}

const QUALITY_GATE_PASSING_STATUSES = ['complete', 'almost_ready'];
function evaluateQualityGate(packageQuality) {
  var sourceStatus = (packageQuality && typeof packageQuality === 'object' && typeof packageQuality.status === 'string')
    ? packageQuality.status : null;
  var passed = sourceStatus !== null && QUALITY_GATE_PASSING_STATUSES.indexOf(sourceStatus) !== -1;
  return { executed: true, passed: passed, status: passed ? 'passed' : 'failed', sourceStatus: sourceStatus };
}

// ──────────────────────────────────────────────────────────────
// 2. Phase IG-QC: 修正したroutingロジック（index.html lines 30566-30595と等価）
// ──────────────────────────────────────────────────────────────
function computePackageQuality(lastOutputDraft, noCompletedResults) {
  if (noCompletedResults) {
    return {
      version: OUTPUT_PACKAGE_QUALITY_VERSION,
      outputType: lastOutputDraft.type,
      category: null,
      score: 0,
      status: 'insufficient',
      missingItems: [],
      completedItems: [],
      recommendations: ['正常完了した担当成果がないため、成果物として評価できません'],
      nextActions: ['Auto Taskを再実行するか、担当設定・依頼内容を確認してください'],
      noCompletedResults: true,
    };
  }
  try {
    var _iadpF = lastOutputDraft.fields && lastOutputDraft.fields.iadp;
    var _iadpQ = _iadpF && _iadpF.quality;
    var _iadpPkgId = _iadpF && _iadpF.package && _iadpF.package.packageId;
    var _iadpIsValid = _iadpF && _iadpF.validation && _iadpF.validation.valid === true;
    if (_iadpQ && _iadpPkgId && _iadpIsValid && typeof _iadpQ.status === 'string' && typeof _iadpQ.score === 'number') {
      return {
        version: OUTPUT_PACKAGE_QUALITY_VERSION,
        outputType: lastOutputDraft.type,
        category: 'iadp',
        score: _iadpQ.score,
        status: _iadpQ.status,
        missingItems: Array.isArray(_iadpQ.missingRequiredFields)
          ? _iadpQ.missingRequiredFields.map(function(f) { return { key: f, label: f, hasSchemaField: true }; })
          : [],
        completedItems: [],
        recommendations: Array.isArray(_iadpQ.warnings) ? _iadpQ.warnings : [],
        nextActions: ['IADP品質評価結果をIADPカードで確認してください'],
        iadpEvaluated: true,
      };
    } else {
      return evaluateOutputPackageCompleteness(lastOutputDraft);
    }
  } catch (_pqe) {
    return null;
  }
}

// ──────────────────────────────────────────────────────────────
// 3. Test runner
// ──────────────────────────────────────────────────────────────
let _passed = 0, _failed = 0;
function assert(condition, label) {
  if (condition) {
    console.log('  ✓', label);
    _passed++;
  } else {
    console.error('  ✗', label);
    _failed++;
  }
}
function caseHeader(name) { console.log('\n' + name); }

// ──────────────────────────────────────────────────────────────
// Case A: IADP present / status=almost_ready → QG passed
// ──────────────────────────────────────────────────────────────
caseHeader('Case A: IADP present, status=almost_ready → Quality Gate passed');
{
  const draft = {
    type: 'instagram_post',
    fields: {
      iadp: {
        package:    { packageId: 'iadp_test_A', caseId: 'case-test-A' },
        validation: { valid: true },
        quality: {
          status: 'almost_ready', score: 92,
          missingRequiredFields: ['noFaceNoVoicePolicy'],
          warnings: [],
        },
      },
    },
  };
  const pq = computePackageQuality(draft, false);
  const qg = evaluateQualityGate(pq);
  assert(pq.category === 'iadp',       'category=iadp');
  assert(pq.status  === 'almost_ready','status=almost_ready');
  assert(pq.score   === 92,            'score=92');
  assert(pq.iadpEvaluated === true,    'iadpEvaluated=true');
  assert(pq.missingItems.length === 1, 'missingItems.length=1');
  assert(pq.missingItems[0].key === 'noFaceNoVoicePolicy', 'missingItems[0]=noFaceNoVoicePolicy');
  assert(qg.passed  === true,          'Quality Gate → passed');
  assert(qg.status  === 'passed',      'qualityGate.status=passed');
}

// ──────────────────────────────────────────────────────────────
// Case B: IADP present / status=needs_work → QG failed
// ──────────────────────────────────────────────────────────────
caseHeader('Case B: IADP present, status=needs_work → Quality Gate failed');
{
  const draft = {
    type: 'instagram_post',
    fields: {
      iadp: {
        package:    { packageId: 'iadp_test_B' },
        validation: { valid: true },
        quality: {
          status: 'needs_work', score: 68,
          missingRequiredFields: ['kpiTarget1', 'kpiTarget2', 'riskItem1'],
          warnings: ['目標値が未設定です'],
        },
      },
    },
  };
  const pq = computePackageQuality(draft, false);
  const qg = evaluateQualityGate(pq);
  assert(pq.category === 'iadp',         'category=iadp');
  assert(pq.status   === 'needs_work',   'status=needs_work');
  assert(pq.score    === 68,             'score=68');
  assert(pq.missingItems.length === 3,   'missingItems.length=3');
  assert(pq.recommendations.length === 1,'recommendations from warnings');
  assert(qg.passed   === false,          'Quality Gate → failed');
  assert(qg.sourceStatus === 'needs_work','sourceStatus=needs_work');
}

// ──────────────────────────────────────────────────────────────
// Case C: No fields.iadp (regular instagram post) → non-IADP path
// ──────────────────────────────────────────────────────────────
caseHeader('Case C: fields.iadp なし (通常instagram投稿) → 既存パス使用');
{
  const draft = {
    type: 'instagram_post',
    fields: { caption: 'test caption', cta: 'プロフィールへ' },
  };
  const pq = computePackageQuality(draft, false);
  assert(pq.category === 'instagram',  'category=instagram (non-IADP path)');
  assert(pq.score    === 20,           'score=20 (instagram check result)');
  assert(!pq.iadpEvaluated,            'iadpEvaluated not set');
}

// ──────────────────────────────────────────────────────────────
// Case D: fields.iadp present / validation.valid=false → guard
// ──────────────────────────────────────────────────────────────
caseHeader('Case D: fields.iadp present / validation.valid=false → 安全ガード発動');
{
  const draft = {
    type: 'instagram_post',
    fields: {
      iadp: {
        package:    { packageId: 'iadp_test_D' },
        validation: { valid: false, errors: ['brand.profileName required'] },
        quality:    { status: 'almost_ready', score: 90, missingRequiredFields: [], warnings: [] },
      },
    },
  };
  const pq = computePackageQuality(draft, false);
  assert(pq.category === 'instagram',  'category=instagram (validation guard)');
  assert(pq.score    === 20,           'score=20 (falls through)');
  assert(!pq.iadpEvaluated,            'iadpEvaluated not set');
}

// ──────────────────────────────────────────────────────────────
// Case E: fields.iadp present / packageId empty → guard
// ──────────────────────────────────────────────────────────────
caseHeader('Case E: fields.iadp present / packageId="" → 安全ガード発動');
{
  const draft = {
    type: 'instagram_post',
    fields: {
      iadp: {
        package:    { packageId: '' },
        validation: { valid: true },
        quality:    { status: 'almost_ready', score: 90, missingRequiredFields: [], warnings: [] },
      },
    },
  };
  const pq = computePackageQuality(draft, false);
  assert(pq.category === 'instagram',  'category=instagram (packageId guard)');
  assert(!pq.iadpEvaluated,            'iadpEvaluated not set');
}

// ──────────────────────────────────────────────────────────────
// Case F: fields.iadp present / quality=null → guard
// ──────────────────────────────────────────────────────────────
caseHeader('Case F: fields.iadp present / quality=null → 安全ガード発動');
{
  const draft = {
    type: 'instagram_post',
    fields: {
      iadp: {
        package:    { packageId: 'iadp_test_F' },
        validation: { valid: true },
        quality:    null,
      },
    },
  };
  const pq = computePackageQuality(draft, false);
  assert(pq.category === 'instagram',  'category=instagram (quality=null guard)');
  assert(!pq.iadpEvaluated,            'iadpEvaluated not set');
}

// ──────────────────────────────────────────────────────────────
// Case G: IADP present / status=complete → QG passed
// ──────────────────────────────────────────────────────────────
caseHeader('Case G: IADP present, status=complete → Quality Gate passed');
{
  const draft = {
    type: 'instagram_post',
    fields: {
      iadp: {
        package:    { packageId: 'iadp_test_G' },
        validation: { valid: true },
        quality: {
          status: 'complete', score: 97,
          missingRequiredFields: [],
          warnings: [],
        },
      },
    },
  };
  const pq = computePackageQuality(draft, false);
  const qg = evaluateQualityGate(pq);
  assert(pq.category === 'iadp',         'category=iadp');
  assert(pq.status   === 'complete',     'status=complete');
  assert(pq.score    === 97,             'score=97');
  assert(pq.missingItems.length === 0,   'missingItems empty');
  assert(qg.passed   === true,           'Quality Gate → passed');
  assert(qg.sourceStatus === 'complete', 'sourceStatus=complete');
}

// ──────────────────────────────────────────────────────────────
// Case H: 実際のIADP (iadp_1787060839814_izhakb) の修正確認
//   - 旧挙動: score=20 (instagram check), status=insufficient, sourceStatus=null
//   - 新挙動: IADPの実際評価結果が使われる（category=iadp, score≠20, sourceStatus≠null）
// ──────────────────────────────────────────────────────────────
caseHeader('Case H: iadp_1787060839814_izhakb 修正前後の挙動差分確認');
{
  // 旧挙動: evaluateOutputPackageCompleteness が呼ばれた場合（修正前）
  const fakeDraft = { type: 'instagram_post', fields: { caption: 'stub', cta: 'stub' } };
  const oldPq = evaluateOutputPackageCompleteness(fakeDraft);
  const oldQg = evaluateQualityGate(oldPq);
  assert(oldPq.score  === 20,            '[旧] score=20 (instagram check)');
  assert(oldPq.status === 'insufficient','[旧] status=insufficient');
  assert(oldQg.passed === false,         '[旧] Quality Gate → failed');
  assert(oldQg.sourceStatus === 'insufficient','[旧] sourceStatus=insufficient');

  // 新挙動: IADP routing を通った場合（修正後）
  const draft = {
    type: 'instagram_post',
    fields: {
      iadp: {
        package:    { packageId: 'iadp_1787060839814_izhakb', caseId: 'case-msr9yckye65y' },
        validation: { valid: true },
        quality: {
          // 実際のIADPの評価結果（KPI/risk未設定でneeds_workを想定）
          status: 'needs_work', score: 72,
          missingRequiredFields: ['kpiTarget1','kpiTarget2','riskItem1','riskItem2','noFaceNoVoicePolicy'],
          warnings: ['収益化KPIが未設定です', 'リスク対策が不完全です'],
        },
      },
    },
  };
  const newPq = computePackageQuality(draft, false);
  const newQg = evaluateQualityGate(newPq);
  assert(newPq.category === 'iadp',        '[新] category=iadp (正しいQuality Contract)');
  assert(newPq.score    !== 20,            '[新] score≠20 (instagram checkではない)');
  assert(newPq.score    === 72,            '[新] score=72 (IADPの実評価値)');
  assert(newPq.status   === 'needs_work',  '[新] status=needs_work (IADPの実評価)');
  assert(newPq.iadpEvaluated === true,     '[新] iadpEvaluated=true');
  assert(newPq.missingItems.length === 5,  '[新] missingItems=5件 (IADP不足フィールド)');
  assert(newPq.missingItems[0].key === 'kpiTarget1','[新] missingItems[0]=kpiTarget1');
  assert(newQg.passed   === false,         '[新] Quality Gate → failed (IADPが実際に不足)');
  assert(newQg.sourceStatus === 'needs_work','[新] sourceStatus=needs_work (nullではない)');

  // 修正の本質：旧バージョンはsourceStatus=nullだったが新バージョンは正しいIADP評価値を持つ
  assert(oldQg.sourceStatus === 'insufficient', '[比較] 旧: sourceStatus=insufficient(instagram)');
  assert(newQg.sourceStatus === 'needs_work',   '[比較] 新: sourceStatus=needs_work(IADP)');
  assert(oldPq.missingItems.some(m => m.key === 'hook'),  '[比較] 旧: hook等のinstagramフィールドが欠損扱い');
  assert(!newPq.missingItems.some(m => m.key === 'hook'), '[比較] 新: hookは欠損リストに含まれない');
}

// ──────────────────────────────────────────────────────────────
// 結果サマリー
// ──────────────────────────────────────────────────────────────
console.log('\n' + '─'.repeat(60));
console.log(`結果: ${_passed} passed / ${_failed} failed`);
if (_failed === 0) {
  console.log('🟢 All Cases A-H passed');
} else {
  console.log('🔴 Some cases failed');
  process.exit(1);
}
