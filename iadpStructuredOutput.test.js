// STEP: IADP Structured Output 合成テスト。
//   実Web Search・実OpenAI/Claude APIは一切呼ばない。axios.post()はテスト内でのみ monkey-patch し、
//   実際のHTTPリクエストは一度も発行しない（callOpenAI()のrequest body構築ロジックの検証専用）。
//   Validator/Normalizer本体（shared/instagramAccountDesign.js）は無改変・本物をそのまま使用する。
const { test } = require('node:test');
const assert = require('node:assert/strict');
const axios = require('axios');
const InstagramAccountDesign = require('./shared/instagramAccountDesign');

// ── Case 9: Schema自体のstrict-mode構文自己検証 ──────────────────────────
// OpenAI Structured Outputs strict:true の必須制約（全プロパティがrequired・
// additionalProperties:falseが全objectに存在）を静的に確認する。実API呼び出しなし。
function walkStrictSchema(node, path, errors) {
  if (node === null || typeof node !== 'object') return;
  if (node.type === 'object') {
    const props = node.properties || {};
    const propNames = Object.keys(props);
    if (node.additionalProperties !== false) errors.push(path + ': additionalProperties must be false');
    const req = node.required || [];
    const reqSet = new Set(req);
    const propSet = new Set(propNames);
    if (req.length !== propNames.length) errors.push(path + ': required count mismatch');
    for (const p of propNames) if (!reqSet.has(p)) errors.push(path + ': property ' + p + ' missing from required');
    for (const r of req) if (!propSet.has(r)) errors.push(path + ': required ' + r + ' not declared in properties');
    for (const p of propNames) walkStrictSchema(props[p], path + '.' + p, errors);
  } else if (node.type === 'array' && node.items) {
    walkStrictSchema(node.items, path + '[]', errors);
  }
}

test('Case 9: IADP_STRUCTURED_OUTPUT_SCHEMA は strict:true の必須制約を満たす', () => {
  // openaiClient.js は OPENAI_API_KEY 未設定でも require 自体は成功する（callOpenAI内部の
  // early-returnのみ影響を受ける）。requireで実API接続は発生しない。
  const oc = require('./openaiClient');
  const schema = oc.IADP_STRUCTURED_OUTPUT_SCHEMA;
  assert.ok(schema, 'IADP_STRUCTURED_OUTPUT_SCHEMA が export されていること');
  const errors = [];
  walkStrictSchema(schema, 'root', errors);
  assert.deepEqual(errors, [], 'strict-mode違反が0件であること: ' + JSON.stringify(errors));
  // 妥当なJSONとしてシリアライズ可能であること（循環参照等がないこと）
  const serialized = JSON.stringify(schema);
  assert.ok(serialized.length > 0 && serialized.length < 120000, 'OpenAI合計文字数上限(120,000)以内であること');
});

test('Case: callOpenAI() は structuredOutput 未指定時、従来どおり text.format を送らない（既存呼び出し全件への非干渉確認）', async () => {
  const originalPost = axios.post;
  let capturedBody = null;
  axios.post = async (url, body) => {
    capturedBody = body;
    return { data: { output_text: '{}', usage: {} } };
  };
  try {
    process.env.OPENAI_API_KEY = 'test-key-no-network-call';
    delete require.cache[require.resolve('./costTracker')];
    delete require.cache[require.resolve('./openaiClient')];
    const oc = require('./openaiClient');
    await oc.callOpenAI('system prompt', 'user message');
    assert.ok(capturedBody, 'axios.postが呼ばれたこと（intercept経由・実HTTPは発行されない）');
    assert.equal(capturedBody.text, undefined, 'structuredOutput未指定時はtextフィールドを送らないこと（既存動作の完全維持）');
  } finally {
    axios.post = originalPost;
  }
});

test('Case: callOpenAI() は structuredOutput 指定時のみ text.format:{type:json_schema,strict:true} を送る', async () => {
  const originalPost = axios.post;
  let capturedBody = null;
  axios.post = async (url, body) => {
    capturedBody = body;
    return { data: { output_text: '{}', usage: {} } };
  };
  try {
    process.env.OPENAI_API_KEY = 'test-key-no-network-call';
    delete require.cache[require.resolve('./costTracker')];
    delete require.cache[require.resolve('./openaiClient')];
    const oc = require('./openaiClient');
    const dummySchema = { type: 'object', properties: { a: { type: 'string' } }, required: ['a'], additionalProperties: false };
    await oc.callOpenAI('system prompt', 'user message', [], { structuredOutput: { name: 'dummy', schema: dummySchema } });
    assert.ok(capturedBody, 'axios.postが呼ばれたこと');
    assert.equal(capturedBody.text.format.type, 'json_schema');
    assert.equal(capturedBody.text.format.strict, true);
    assert.deepEqual(capturedBody.text.format.schema, dummySchema);
    assert.equal(capturedBody.text.format.name, 'dummy');
  } finally {
    axios.post = originalPost;
  }
});

// ── 有効なIADP fixture（Validator正式契約を満たす最小構成） ─────────────────
function buildValidCandidateComparison() {
  const axesScore = { marketPotential: 80, profitability: 75, instagramFit: 85, competitionDifficulty: 60, differentiationPotential: 70, noFaceNoVoiceFit: 90, continuity: 80, multiProductFit: 70, longTermBrandAsset: 75, aiOperationFit: 85 };
  return {
    candidates: [
      { candidateId: 'cand-1', genreId: 'g1', scores: axesScore, totalScore: 78, decision: 'adopt', adoptionReason: 'test', mainRisks: ['risk1'], evidenceStatus: 'generated_hypothesis' },
      { candidateId: 'cand-2', genreId: 'g2', scores: axesScore, totalScore: 60, decision: 'hold', adoptionReason: 'test', mainRisks: [], evidenceStatus: 'generated_hypothesis' },
      { candidateId: 'cand-3', genreId: 'g3', scores: axesScore, totalScore: 40, decision: 'reject', adoptionReason: 'test', mainRisks: [], evidenceStatus: 'generated_hypothesis' },
    ],
  };
}
function buildValidAdoptionDecision(adoptedId) {
  return {
    adoptedCandidateId: adoptedId,
    decisionMadeBy: 'leader',
    decisionRationale: 'test rationale',
    rejectedCandidates: [{ candidateId: 'cand-3', reason: 'test' }],
    heldCandidates: [{ candidateId: 'cand-2', reason: 'test' }],
  };
}
function buildValidIadpJson() {
  return {
    caseId: 'case-test',
    fieldStatus: { 'finalProfile.account.bio': 'generated_hypothesis' },
    intelligence: {
      marketResearch: { candidates: [{ genreId: 'g1', genreName: 'A' }, { genreId: 'g2', genreName: 'B' }, { genreId: 'g3', genreName: 'C' }], selectionCriteria: 'test' },
      candidateComparison: buildValidCandidateComparison(),
      adoptionDecision: buildValidAdoptionDecision('cand-1'),
    },
    finalProfile: { account: { accountName: 'TestAccount', bio: 'test bio' }, contentStrategy: { mainGenre: 'g1' } },
  };
}

test('Case 1: 正式な有効IADP fixture -> valid:true', () => {
  const pkg = InstagramAccountDesign.normalizeAccountDesignPackage(buildValidIadpJson(), { caseId: 'case-test' });
  const result = InstagramAccountDesign.validateAccountDesignPackage(pkg);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('Case 2: candidate 2件のみ -> insufficient_candidates', () => {
  const raw = buildValidIadpJson();
  raw.intelligence.candidateComparison.candidates = raw.intelligence.candidateComparison.candidates.slice(0, 2);
  const pkg = InstagramAccountDesign.normalizeAccountDesignPackage(raw, { caseId: 'case-test' });
  const result = InstagramAccountDesign.validateAccountDesignPackage(pkg);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === 'insufficient_candidates'));
});

test('Case 3: candidate 3件・adoptedCandidateIdなし -> missing_adopted_candidate_id', () => {
  const raw = buildValidIadpJson();
  raw.intelligence.adoptionDecision.adoptedCandidateId = '';
  const pkg = InstagramAccountDesign.normalizeAccountDesignPackage(raw, { caseId: 'case-test' });
  const result = InstagramAccountDesign.validateAccountDesignPackage(pkg);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === 'missing_adopted_candidate_id'));
});

test('Case 4: candidate 3件・存在しないadoptedCandidateId -> adopted_candidate_id_not_found', () => {
  const raw = buildValidIadpJson();
  raw.intelligence.adoptionDecision.adoptedCandidateId = 'cand-does-not-exist';
  const pkg = InstagramAccountDesign.normalizeAccountDesignPackage(raw, { caseId: 'case-test' });
  const result = InstagramAccountDesign.validateAccountDesignPackage(pkg);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((e) => e.code === 'adopted_candidate_id_not_found'));
});

test('Case 5: candidate 3件・正しいadoptedCandidateId -> valid:true', () => {
  const raw = buildValidIadpJson();
  raw.intelligence.adoptionDecision.adoptedCandidateId = 'cand-2';
  const pkg = InstagramAccountDesign.normalizeAccountDesignPackage(raw, { caseId: 'case-test' });
  const result = InstagramAccountDesign.validateAccountDesignPackage(pkg);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('Case 6: finalProfile誤配置（intelligence.finalProfile） -> 既存Hotfixで正常化・warning維持', () => {
  const raw = buildValidIadpJson();
  raw.intelligence.finalProfile = raw.finalProfile;
  delete raw.finalProfile;
  const pkg = InstagramAccountDesign.normalizeAccountDesignPackage(raw, { caseId: 'case-test' });
  assert.equal(pkg.finalProfile.account.accountName, 'TestAccount', 'Hotfixにより誤配置finalProfileが正しく吸収されること');
  const result = InstagramAccountDesign.validateAccountDesignPackage(pkg);
  assert.equal(result.valid, true);
  assert.ok(result.warnings.some((w) => w.code === 'misplaced_final_profile'));
});

test('Case 7: 今回発生したfieldStatus内オブジェクト誤配置パターン -> Formal Truthへ勝手に補完されないこと', () => {
  // 今回の実FAILを再現: fieldStatusのキー値としてfinalProfileの実データ(オブジェクト)を格納してしまうパターン。
  const raw = { caseId: 'case-test', fieldStatus: { 'finalProfile.account': { accountName: 'ShouldNotLeak' } }, intelligence: { candidateComparison: buildValidCandidateComparison(), adoptionDecision: buildValidAdoptionDecision('cand-1') } };
  const pkg = InstagramAccountDesign.normalizeAccountDesignPackage(raw, { caseId: 'case-test' });
  // normalizeFieldStatusMap()は非文字列値を安全にdefaultへ丸め込み、値を発明・流用しない
  assert.equal(pkg.fieldStatus['finalProfile.account'], 'generated_hypothesis');
  assert.equal(pkg.finalProfile.account.accountName, '', 'fieldStatus内の誤配置データがfinalProfileへ推測補完されないこと');

  // Structured Output Schema側では、fieldStatusは{path,status}[]のみを許容し、
  // status プロパティは固定enumのみを受理するため、この種の誤配置（objectをstatus値に）はそもそも
  // API側の制約付きデコードで構造的に出力不可能であることを確認する。
  const oc = require('./openaiClient');
  const fieldStatusEntrySchema = oc.IADP_STRUCTURED_OUTPUT_SCHEMA.properties.fieldStatus.items;
  assert.deepEqual(Object.keys(fieldStatusEntrySchema.properties).sort(), ['path', 'status']);
  assert.equal(fieldStatusEntrySchema.properties.status.type, 'string', 'statusはenum文字列のみでオブジェクト値を許容しない設計であること');
});

test('Case 8a: フルパイプライン（タグ付きテキスト・従来経路） extract -> normalize -> validate', () => {
  // extractIadpJsonFromLeaderText() は index.html 内のクライアント専用関数のためNode実行できない。
  // タグ抽出・直接JSON抽出それぞれの入口ロジックを本テストで同一アルゴリズムとして再現し、
  // 実際のnormalize/validateは本物（shared/instagramAccountDesign.js）へ通す。
  function extractLikeIndexHtml(text) {
    var OPEN = '<IADP_JSON>', CLOSE = '</IADP_JSON>';
    var t = String(text || '');
    var openIdx = t.indexOf(OPEN);
    if (openIdx === -1) {
      var direct = t.trim();
      if (direct.charAt(0) === '{') {
        try {
          var parsed = JSON.parse(direct);
          if (parsed && typeof parsed === 'object' && Array.isArray(parsed.fieldStatus)) {
            var fsMap = {};
            parsed.fieldStatus.forEach(function (e) { if (e && typeof e.path === 'string' && e.path) fsMap[e.path] = e.status; });
            parsed.fieldStatus = fsMap;
          }
          return { found: true, json: parsed };
        } catch (e) { return { found: false, json: null }; }
      }
      return { found: false, json: null };
    }
    var closeIdx = t.indexOf(CLOSE, openIdx + OPEN.length);
    if (closeIdx === -1) return { found: false, json: null };
    var inner = t.slice(openIdx + OPEN.length, closeIdx).trim();
    try { return { found: true, json: JSON.parse(inner) }; } catch (e) { return { found: false, json: null }; }
  }

  const taggedText = '前置きテキスト\n<IADP_JSON>\n' + JSON.stringify(buildValidIadpJson()) + '\n</IADP_JSON>\n後書きテキスト';
  const extracted = extractLikeIndexHtml(taggedText);
  assert.equal(extracted.found, true);
  const pkg = InstagramAccountDesign.normalizeAccountDesignPackage(extracted.json, { caseId: 'case-test' });
  const result = InstagramAccountDesign.validateAccountDesignPackage(pkg);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('Case 8b: フルパイプライン（タグなし直接JSON・Structured Output経路） extract -> normalize -> validate', () => {
  function extractLikeIndexHtml(text) {
    var OPEN = '<IADP_JSON>';
    var t = String(text || '');
    if (t.indexOf(OPEN) === -1) {
      var direct = t.trim();
      if (direct.charAt(0) === '{') {
        try {
          var parsed = JSON.parse(direct);
          if (parsed && typeof parsed === 'object' && Array.isArray(parsed.fieldStatus)) {
            var fsMap = {};
            parsed.fieldStatus.forEach(function (e) { if (e && typeof e.path === 'string' && e.path) fsMap[e.path] = e.status; });
            parsed.fieldStatus = fsMap;
          }
          return { found: true, json: parsed };
        } catch (e) { return { found: false, json: null }; }
      }
      return { found: false, json: null };
    }
    return { found: false, json: null };
  }

  // Structured Output経路はfieldStatusを配列で返す（今回追加したschema契約どおり）
  const fixture = buildValidIadpJson();
  fixture.fieldStatus = [{ path: 'finalProfile.account.bio', status: 'generated_hypothesis' }];
  const directText = JSON.stringify(fixture); // タグなし・生JSONのみ（structured outputの実応答を模擬）
  const extracted = extractLikeIndexHtml(directText);
  assert.equal(extracted.found, true, 'タグなしテキストが直接JSONとして抽出できること');
  assert.equal(typeof extracted.json.fieldStatus, 'object');
  assert.equal(Array.isArray(extracted.json.fieldStatus), false, 'fieldStatus配列が辞書形へ変換済みであること');
  const pkg = InstagramAccountDesign.normalizeAccountDesignPackage(extracted.json, { caseId: 'case-test' });
  const result = InstagramAccountDesign.validateAccountDesignPackage(pkg);
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test('Case: 既存の空/不正テキストに対する後方互換（tagなし・直接JSONでもない） -> found:false のまま', () => {
  function extractLikeIndexHtml(text) {
    var OPEN = '<IADP_JSON>';
    var t = String(text || '');
    if (t.indexOf(OPEN) === -1) {
      var direct = t.trim();
      if (direct.charAt(0) === '{') { try { return { found: true, json: JSON.parse(direct) }; } catch (e) { return { found: false, json: null }; } }
      return { found: false, json: null };
    }
    return { found: false, json: null };
  }
  const r1 = extractLikeIndexHtml('これはただの通常のLeader Final回答テキストです。JSONではありません。');
  assert.equal(r1.found, false);
  const r2 = extractLikeIndexHtml('');
  assert.equal(r2.found, false);
});
