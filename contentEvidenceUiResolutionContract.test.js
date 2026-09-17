'use strict';
// contentEvidenceUiResolutionContract.test.js
// PRG UI Contract Wiring（U2: 既存 canonical Claim の明示選択）の deterministic テスト。
//
//   ★ 実行は必ずこのファイル名を明示指定する（node contentEvidenceUiResolutionContract.test.js）。
//   ★ index.html の Content Evidence ブロック（ce-approval-panel 直後の <script>）を vm で実行する
//     （既存 contentEvidenceApproval.test.js と同一の抽出方式）。fetch は vm 内 mock のみ。
//   ★ 外部出口は冒頭で fail-closed に封鎖する（network / credential env / .env / 禁止 module / fs write）。
//   ★ Protected 10件の hash を開始時・終了時に read-only で取得し、全件一致を assert する。

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');
const Module = require('module');

const ROOT = __dirname;
const violations = [];
const counters = { network: 0, blockedModules: 0, envFileReads: 0, fsWrites: 0 };

const PROTECTED_BASELINE = {
  'cost-logs.json': 'ce24d4808bc7bbbf1b517b12c6bce65e',
  'data/conversations/_meta.json': 'b1f27d5f863f8fe20edc686157fbc992',
  'claude-cost-logs.json': '2f7fdd7d6105b92dbc022ea090f3399f',
  'claude-quality-history.json': '429a054a7898fcc78906b17a72b4d860',
  'backup-dup-candidates-20260714/dup-candidates-123.csv': 'c6800a3ff3b2e1acda3ccc5b8440b751',
  'backup-dup-candidates-20260714/dup-candidates-123.json': 'cdd3e71b3b295f4b094cf05a30cc79f7',
  'data/conversations/user-cont-1_line_web.json': 'dbceb6d32a3dda1fb9b5d721325089d5',
  'data/conversations/user-cont-2_line_estimate.json': '8124d35bad188d047ac162c1f38a0a69',
  'data/conversations/user-cont-3_line_leader.json': 'ab4e713e61a9ecc0496dad41c2f13536',
  'data/conversations/user-cont-4_line_video.json': '12ab03f1cc7d686de163ae4483b01c54',
};
const PROTECTED_FILES = Object.keys(PROTECTED_BASELINE);
function hashProtected() {
  const out = {};
  PROTECTED_FILES.forEach(function (rel) {
    try { out[rel] = crypto.createHash('md5').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex'); }
    catch (e) { out[rel] = 'unreadable:' + e.code; }
  });
  return out;
}
const protectedBefore = hashProtected();

// ── sandbox（network / env / fs / module） ──
function blockedNetwork(name) { return function () { counters.network++; violations.push('network:' + name); throw new Error('SANDBOX_BLOCKED_NETWORK:' + name); }; }
['http', 'https'].forEach(function (m) { const mod = require(m); mod.request = blockedNetwork(m + '.request'); mod.get = blockedNetwork(m + '.get'); });
{ const net = require('net'); net.connect = blockedNetwork('net.connect'); net.createConnection = blockedNetwork('net.createConnection'); net.Socket.prototype.connect = blockedNetwork('net.Socket.connect'); const tls = require('tls'); tls.connect = blockedNetwork('tls.connect'); }
globalThis.fetch = blockedNetwork('fetch');
const CREDENTIAL_ENV_PATTERN = /^(OPENAI|ANTHROPIC|CLAUDE|SUPABASE|NEXT_PUBLIC_SUPABASE|LINE_|WEB_SESSION|CAROUSEL_)/i;
Object.keys(process.env).forEach(function (k) { if (CREDENTIAL_ENV_PATTERN.test(k)) delete process.env[k]; });
function isEnvFile(p) { try { return /^\.env(\..*)?$/.test(path.basename(String(p))); } catch (e) { return false; } }
['readFileSync', 'readFile', 'existsSync', 'statSync', 'createReadStream'].forEach(function (n) {
  const orig = fs[n]; if (typeof orig !== 'function') return;
  fs[n] = function (p) { if (isEnvFile(p)) { counters.envFileReads++; violations.push('env_file_read:' + n); throw new Error('SANDBOX_BLOCKED_ENV_READ'); } return orig.apply(this, arguments); };
});
function blockedWrite(name) { return function () { counters.fsWrites++; violations.push('fs_write:' + name); throw new Error('SANDBOX_BLOCKED_FS_WRITE:' + name); }; }
['writeFileSync', 'appendFileSync', 'renameSync', 'unlinkSync', 'mkdirSync', 'rmSync', 'rmdirSync', 'copyFileSync', 'truncateSync',
  'symlinkSync', 'cpSync', 'writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir', 'copyFile', 'truncate', 'createWriteStream']
  .forEach(function (n) { if (typeof fs[n] === 'function') fs[n] = blockedWrite('fs.' + n); });
['writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir', 'copyFile', 'truncate'].forEach(function (n) { if (typeof fs.promises[n] === 'function') fs.promises[n] = blockedWrite('fs.promises.' + n); });
const BLOCKED_BARE = new Set(['axios', 'dotenv', '@supabase/supabase-js', 'http', 'https', 'net', 'tls', 'http2', 'undici', 'child_process',
  'node:http', 'node:https', 'node:net', 'node:tls', 'node:http2', 'node:child_process']);
const BLOCKED_FILES = new Set(['openaiClient.js', 'claudeClient.js', 'costTracker.js', 'lib/costDb.js', 'conversationHistory.js', 'server.js', 'lib/supabase.js']
  .map(function (p) { return path.join(ROOT, p); }));
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (BLOCKED_BARE.has(request)) { counters.blockedModules++; violations.push('module:' + request); throw new Error('SANDBOX_BLOCKED_MODULE:' + request); }
  let filename = null;
  try { filename = Module._resolveFilename(request, parent, isMain); } catch (e) { filename = null; }
  if (filename && BLOCKED_FILES.has(filename)) { counters.blockedModules++; violations.push('module:' + path.relative(ROOT, filename)); throw new Error('SANDBOX_BLOCKED_MODULE:' + request); }
  return origLoad.apply(this, arguments);
};

let _passed = 0, _failed = 0;
function assert(cond, label) { if (cond) { _passed++; console.log('  ✅ ' + label); } else { _failed++; console.log('  ❌ ' + label); } }
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const guard = require('./lib/contentEvidenceResolutionGuard');   // server 側契約との互換確認用（純関数）
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const blockStart = idx.indexOf('<div id="ce-approval-panel"');
const scriptStart = idx.indexOf('<script>', blockStart) + '<script>'.length;
const scriptEnd = idx.indexOf('</script>', scriptStart);
const CE_BLOCK = idx.slice(scriptStart, scriptEnd);
if (blockStart === -1 || scriptEnd === -1) throw new Error('Content Evidence block not found');

const CASE = 'case-x';
const OUT = 'out-1';
const REV = 'rev-' + 'a'.repeat(32);

// ── vm sandbox（既存 buildCeSandbox と同型 + fetch mock の応答制御） ──
function buildCtx(opts) {
  const o = opts || {};
  const ctx = { console: { log: function () {}, warn: function () {}, error: function () {} } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  ['evidenceAcquisition', 'contentClaimPlanning', 'contentEvidenceApproval'].forEach(function (m) {
    vm.runInContext(fs.readFileSync(path.join(ROOT, 'shared', m + '.js'), 'utf8'), ctx);
  });
  const els = {};
  const mk = function (id) {
    return { id: id, value: '', style: {}, innerHTML: '', getAttribute: function () { return null; },
      insertAdjacentHTML: function (p, h) { this.innerHTML += h; }, querySelectorAll: function () { return []; } };
  };
  ctx.__calls = [];
  ctx.__getRows = o.getRows ? o.getRows.slice() : [];   // GET 応答の row を順に返す（最後を繰り返す）
  ctx.__postResponse = o.postResponse || { status: 200, body: { ok: true, contentEvidenceSummary: { contentEvidenceCount: 6, contentClaimsCount: 3 } } };
  Object.assign(ctx, {
    document: { getElementById: function (id) { return els[id] || null; } },
    fetch: function (url, init) {
      const method = (init && init.method) || 'GET';
      ctx.__calls.push({ url: String(url), method: method, body: init && init.body ? JSON.parse(init.body) : null });
      if (method === 'GET') {
        const row = ctx.__getRows.length > 1 ? ctx.__getRows.shift() : ctx.__getRows[0];
        return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true, draft: row === undefined ? null : row, source: 'db' }); } });
      }
      const pr = ctx.__postResponse;
      return Promise.resolve({ ok: pr.status >= 200 && pr.status < 300, status: pr.status, json: function () { return Promise.resolve(pr.body); } });
    },
    currentMember: { id: 'leader' },
    memberCaseView: { leader: CASE },
    cases: { 'case-x': { id: CASE, title: 'テスト案件' } },
    _ncActiveCaseId: function (m) { const v = ctx.memberCaseView[m]; return (v && v !== 'latest' && v !== '__caselist__') ? v : undefined; },
    escapeHtml: function (x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
  });
  els['ce-approval-panel'] = mk('ce-approval-panel');
  if (o.rows && o.rows.length) {
    const rowsEl = mk('ce-intent-rows');
    rowsEl.querySelectorAll = function () { return o.rows.map(function (_, i) { return { getAttribute: function () { return String(i + 1); } }; }); };
    els['ce-intent-rows'] = rowsEl;
    o.rows.forEach(function (r, i) {
      els['ce-intent-topic-' + (i + 1)] = Object.assign(mk(), { value: r.topic });
      els['ce-intent-question-' + (i + 1)] = Object.assign(mk(), { value: r.question });
      els['ce-intent-type-' + (i + 1)] = Object.assign(mk(), { value: 'general_practice' });
    });
  }
  vm.runInContext(CE_BLOCK, ctx);
  ctx.__els = els;
  ctx._lastOutputDraft = { id: OUT, caseId: CASE, fields: { slides: ['【1枚目】タイトル：x / 本文：y'] } };
  return ctx;
}
function posts(ctx) { return ctx.__calls.filter(function (c) { return c.method === 'POST'; }); }
function gets(ctx) { return ctx.__calls.filter(function (c) { return c.method === 'GET'; }); }

const IDS = ['CI-01', 'CI-02', 'CI-03'];
function canonRow(o) {
  const opt = o || {};
  const ids = opt.claimIds || IDS;
  const origin = { mode: 'legacy_fields_backfill', version: '1.0.0', caseId: CASE, outputId: OUT };
  if (opt.revision) origin.revision = opt.revision;
  return {
    output_id: OUT, case_id: CASE,
    content_claims: ids.map(function (id) { return { claimId: id, topic: 'topic-' + id, text: opt.claimText || ('claim text ' + id), claimType: 'general_practice', status: 'grounded' }; }),
    content_evidence: ids.map(function (id) { return { evidenceId: 'ev-' + id + '-0', claimId: id, caseId: CASE, claim: 'question for ' + id, supportType: 'supports', verificationStatus: 'verified' }; }),
    content_evidence_origin: origin,
  };
}
function emptyRow() { return { output_id: OUT, case_id: CASE, content_claims: null, content_evidence: null, content_evidence_origin: null }; }

// candidate / mapping / claim 文言を plan の intent ごとに用意（Web Search 応答相当・intentId 付き）
function prepareCandidates(ctx, intentIds, opt) {
  const o = opt || {};
  const cands = [];
  const decisions = {};
  const texts = {};
  intentIds.forEach(function (id) {
    ['https://www.mhlw.go.jp/' + id + '-0.pdf', 'https://www.dermatol.or.jp/' + id + '-1.html'].forEach(function (u) {
      const c = { sourceUrl: u, sourceMethod: 'web_retrieved', createdBy: 'system', verificationStatus: 'unverified' };
      if (!o.dropIntentId) c.intentId = id;
      cands.push(c);
      decisions[cands.length - 1] = { claimType: 'general_practice', supportType: 'supports' };
    });
    texts[id] = 'claim wording for ' + id;
  });
  ctx._ceState = 'completed';
  ctx._ceLastEvidenceCandidates = cands;
  ctx._ceMappingDecisions = decisions;
  ctx._ceClaimTextByCase = { 'case-x': texts };
}
async function existingFlow(ctx, selectIds) {
  await ctx._ceLoadCanonicalForEntry();
  selectIds.forEach(function (id) { ctx._ceToggleCanonicalClaim(id, true); });
  return ctx._ceStartPlanFromSelection();
}
const Q3 = [
  { topic: '洗顔時の摩擦', question: '公的機関や専門学会は、洗顔で肌をこすることについて一般的に何をすすめているか' },
  { topic: '洗顔後の保湿', question: '公的機関や専門学会は、洗顔後の保湿について一般的に何をすすめているか' },
  { topic: '日常の紫外線対策', question: '公的機関は、日常生活の紫外線対策として一般的にどのような方法をすすめているか' },
];
const CANONICAL_KEYS = ['content_evidence', 'content_claims', 'content_evidence_origin', 'contentEvidence', 'contentClaims', 'revision', 'origin', 'canonical'];

(async () => {
  console.log('\n=== contentEvidenceUiResolutionContract.test.js (PRG UI Contract Wiring / U2) ===');

  caseHeader('SB. sandbox 自己検証');
  {
    const sv = violations.length, sc = Object.assign({}, counters);
    function throwsSandbox(fn, marker) { try { fn(); return false; } catch (e) { return String(e && e.message).indexOf(marker) === 0; } }
    assert(throwsSandbox(function () { globalThis.fetch('https://example.com'); }, 'SANDBOX_BLOCKED_NETWORK'), 'SB-1. 実 fetch 封鎖');
    assert(throwsSandbox(function () { require('./openaiClient'); }, 'SANDBOX_BLOCKED_MODULE'), 'SB-2. openaiClient 読込不可');
    assert(throwsSandbox(function () { fs.readFileSync(path.join(ROOT, '.env.local')); }, 'SANDBOX_BLOCKED_ENV_READ'), 'SB-3. .env.local 読込封鎖');
    assert(throwsSandbox(function () { fs.writeFileSync(path.join(ROOT, 'data', 'conversations', 'user-cont-1_line_web.json'), 'x'); }, 'SANDBOX_BLOCKED_FS_WRITE'), 'SB-4. Protected write 封鎖');
    violations.length = sv; Object.assign(counters, sc);
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('UI-PRG-1. canonical なし → full_replace / Plan 全 Intent / expectedRevision null');
  {
    const ctx = buildCtx({ rows: Q3, getRows: [emptyRow()] });
    const plan = ctx._ceStartPlanFromForm();
    prepareCandidates(ctx, plan.intents.map(function (i) { return i.intentId; }));
    const r = await ctx._ceSubmitEvidenceForResolution();
    const p = posts(ctx);
    assert(plan.resolutionScope.kind === 'new' && p.length === 1 && r.ok === true, 'UI-PRG-1a. POST 1回・成功');
    assert(p[0].body.resolutionMode === 'full_replace', 'UI-PRG-1b. resolutionMode = full_replace');
    assert(JSON.stringify(p[0].body.targetClaimIds) === JSON.stringify(IDS), 'UI-PRG-1c. targetClaimIds = Plan 全 Intent（CI-01〜03）');
    assert(Object.prototype.hasOwnProperty.call(p[0].body, 'expectedRevision') && p[0].body.expectedRevision === null, 'UI-PRG-1d. expectedRevision = null（明示）');
    assert(gets(ctx).length === 1 && ctx.__calls[0].method === 'GET' && ctx.__calls[1].method === 'POST', 'UI-PRG-1e. POST 直前に canonical を GET');
    assert(guard.validateResolutionRequest({ caseId: CASE, body: p[0].body }).ok === true, 'UI-PRG-1f. ★UI payload は server guard 契約を満たす');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('UI-PRG-2. canonical あり・1/3 選択 → partial_update');
  {
    const ctx = buildCtx({ getRows: [canonRow()] });
    const plan = await existingFlow(ctx, ['CI-02']);
    prepareCandidates(ctx, ['CI-02']);
    await ctx._ceSubmitEvidenceForResolution();
    const p = posts(ctx);
    assert(plan && plan.resolutionScope.kind === 'existing' && p.length === 1, 'UI-PRG-2a. existing scope・POST 1回');
    assert(p[0].body.resolutionMode === 'partial_update' && JSON.stringify(p[0].body.targetClaimIds) === '["CI-02"]', 'UI-PRG-2b. partial_update / targetClaimIds = [CI-02]');
    assert(guard.validateResolutionRequest({ caseId: CASE, body: p[0].body }).ok === true, 'UI-PRG-2c. ★UI payload は server guard 契約を満たす');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('UI-PRG-3 / 16. canonical あり・全選択の場合だけ full_replace');
  {
    const ctx = buildCtx({ getRows: [canonRow()] });
    await existingFlow(ctx, IDS);
    prepareCandidates(ctx, IDS);
    await ctx._ceSubmitEvidenceForResolution();
    const p = posts(ctx);
    assert(p.length === 1 && p[0].body.resolutionMode === 'full_replace' && JSON.stringify(p[0].body.targetClaimIds) === JSON.stringify(IDS), 'UI-PRG-3. 3/3 選択 → full_replace');

    const ctx2 = buildCtx({ getRows: [canonRow()] });
    await existingFlow(ctx2, ['CI-01', 'CI-03']);
    prepareCandidates(ctx2, ['CI-01', 'CI-03']);
    await ctx2._ceSubmitEvidenceForResolution();
    const p2 = posts(ctx2);
    assert(p2.length === 1 && p2[0].body.resolutionMode === 'partial_update', 'UI-PRG-16. 2/3 選択 → partial_update（全選択以外は full_replace にしない）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('UI-PRG-4. 0件選択 → Plan を作らない / POST 0');
  {
    const ctx = buildCtx({ getRows: [canonRow()] });
    const plan = await existingFlow(ctx, []);
    assert(plan === null && ctx._cePlan === null, 'UI-PRG-4a. Plan 未作成');
    assert(posts(ctx).length === 0, 'UI-PRG-4b. POST 0');
    // scope を空 target へ改変しても POST しない
    const ctx2 = buildCtx({ getRows: [canonRow()] });
    await existingFlow(ctx2, ['CI-02']);
    prepareCandidates(ctx2, ['CI-02']);
    ctx2._cePlan.resolutionScope.targetClaimIds = [];
    const r = await ctx2._ceSubmitEvidenceForResolution();
    assert(posts(ctx2).length === 0 && r.ok === false, 'UI-PRG-4c. target 空の scope → POST 0（' + r.error + '）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('UI-PRG-5. 選択した既存 claimId をそのまま維持（行番号再採番なし）');
  {
    const ctx = buildCtx({ getRows: [canonRow()] });
    const plan = await existingFlow(ctx, ['CI-03']);
    assert(plan.intents.length === 1 && plan.intents[0].intentId === 'CI-03', 'UI-PRG-5a. Intent ID = CI-03（CI-01 に再採番しない）');
    assert(plan.queries.length === 1 && plan.queries[0].intentId === 'CI-03', 'UI-PRG-5b. Web Search query も CI-03 を保持');
    assert(plan.intents[0].topic === 'topic-CI-03' && plan.intents[0].question === 'question for CI-03' && plan.intents[0].claimTypeCandidate === 'general_practice', 'UI-PRG-5c. topic / question / claimType は canonical 値の読み取りのみ');
    prepareCandidates(ctx, ['CI-03']);
    await ctx._ceSubmitEvidenceForResolution();
    const p = posts(ctx);
    assert(p.length === 1 && p[0].body.contentEvidenceCandidates.every(function (c) { return c.intentId === 'CI-03'; }), 'UI-PRG-5d. candidate の intentId も CI-03');
    // candidate の intentId が欠落していれば推測しない
    const ctx2 = buildCtx({ getRows: [canonRow()] });
    await existingFlow(ctx2, ['CI-02']);
    prepareCandidates(ctx2, ['CI-02'], { dropIntentId: true });
    const r2 = await ctx2._ceSubmitEvidenceForResolution();
    assert(posts(ctx2).length === 0 && r2.error === 'candidate_intent_unresolved', 'UI-PRG-5e. intentId 欠落 candidate → 推測せず POST 0');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('UI-PRG-6 / 17. canonical にない新規 Claim は request に入らない / 既存 canonical ありで新規追加禁止');
  {
    const ctx = buildCtx({ getRows: [canonRow()] });
    await ctx._ceLoadCanonicalForEntry();
    assert(ctx._ceToggleCanonicalClaim('CI-09', true) === false, 'UI-PRG-6a. canonical にない CI-09 は選択できない');
    // scope を改変して CI-09 を入れても POST しない
    await existingFlow(ctx, ['CI-02']);
    prepareCandidates(ctx, ['CI-09']);
    ctx._cePlan.resolutionScope.targetClaimIds = ['CI-09'];
    const r = await ctx._ceSubmitEvidenceForResolution();
    assert(posts(ctx).length === 0 && r.error === 'target_claim_not_in_canonical', 'UI-PRG-6b. 改変 scope（CI-09）→ POST 0 / target_claim_not_in_canonical');

    // 17: canonical 確認済みなら新規フォーム Plan を作らない
    const ctx2 = buildCtx({ rows: Q3, getRows: [canonRow()] });
    await ctx2._ceLoadCanonicalForEntry();
    assert(ctx2._ceStartPlanFromForm() === null && ctx2._cePlan === null, 'UI-PRG-17a. 既存 canonical 確認後は新規フォーム Plan を作らない');
    const html = ctx2.buildContentEvidenceEntryHtml();
    assert(html.indexOf('id="ce-entry-start-btn" onclick="_ceStartPlanFromForm()" disabled') !== -1 && html.indexOf('id="ce-entry-addrow-btn" onclick="_ceAddIntentRow()" disabled') !== -1, 'UI-PRG-17b. 新規 Plan / 行追加ボタンは disabled');
    // 17: canonical 未確認のまま新規フォーム Plan → 送信直前 GET で既存 canonical 検出 → POST 0
    const ctx3 = buildCtx({ rows: Q3, getRows: [canonRow()] });
    const plan3 = ctx3._ceStartPlanFromForm();
    prepareCandidates(ctx3, plan3.intents.map(function (i) { return i.intentId; }));
    const r3 = await ctx3._ceSubmitEvidenceForResolution();
    assert(posts(ctx3).length === 0 && r3.error === 'existing_canonical_requires_claim_selection', 'UI-PRG-17c. ★未確認の新規 Plan でも既存 canonical を検出して POST 0（行番号 ID で既存 Claim を置換しない）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('UI-PRG-7 / 8 / 13. expectedRevision は server の値のみ（client で生成しない）');
  {
    const ctx = buildCtx({ getRows: [canonRow()] });
    await existingFlow(ctx, ['CI-02']);
    prepareCandidates(ctx, ['CI-02']);
    await ctx._ceSubmitEvidenceForResolution();
    assert(posts(ctx)[0].body.expectedRevision === null, 'UI-PRG-7. revision キーなし → expectedRevision null');

    const ctx2 = buildCtx({ getRows: [canonRow({ revision: REV })] });
    await existingFlow(ctx2, ['CI-02']);
    prepareCandidates(ctx2, ['CI-02']);
    await ctx2._ceSubmitEvidenceForResolution();
    assert(posts(ctx2)[0].body.expectedRevision === REV, 'UI-PRG-8. revision あり → その値をそのまま送る');

    const codeLines = CE_BLOCK.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; }).join('\n');
    assert(codeLines.indexOf("'rev-'") === -1 && codeLines.indexOf('crypto.subtle') === -1 && codeLines.indexOf('computeNextRevision') === -1, 'UI-PRG-13a. CE ブロックに revision 生成コードが無い');
    assert(guard.REVISION_PATTERN.test(posts(ctx2)[0].body.expectedRevision) && Object.keys(posts(ctx2)[0].body).indexOf('revision') === -1, 'UI-PRG-13b. 新 revision を payload に含めない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('UI-PRG-9. 選択後、POST 直前 GET で Claim 集合 / revision が変化 → POST 0 / stale');
  {
    const ctx = buildCtx({ getRows: [canonRow(), canonRow({ claimIds: ['CI-01', 'CI-02', 'CI-03', 'CI-04'] })] });
    await existingFlow(ctx, ['CI-02']);
    prepareCandidates(ctx, ['CI-02']);
    const r = await ctx._ceSubmitEvidenceForResolution();
    assert(posts(ctx).length === 0 && r.error === 'canonical_changed_since_selection', 'UI-PRG-9a. Claim 集合変化 → POST 0 / canonical_changed_since_selection');
    assert(ctx._ceCanonicalByCase[CASE].status === 'stale' && JSON.stringify(ctx._ceClaimSelectionByCase[CASE]) === '{}', 'UI-PRG-9b. stale 表示・選択は破棄（自動再選択なし）');
    assert(ctx.__els['ce-approval-panel'].innerHTML.indexOf('再読み込みして、更新対象Claimをもう一度確認してください') !== -1, 'UI-PRG-9c. 再読み込み／再選択を要求する表示');

    const ctx2 = buildCtx({ getRows: [canonRow(), canonRow({ revision: REV })] });
    await existingFlow(ctx2, ['CI-02']);
    prepareCandidates(ctx2, ['CI-02']);
    const r2 = await ctx2._ceSubmitEvidenceForResolution();
    assert(posts(ctx2).length === 0 && r2.error === 'canonical_changed_since_selection', 'UI-PRG-9d. revision 変化 → POST 0');

    // 選択後に canonical を再確認した（別の確認結果）→ 古い選択の Plan では送信しない
    const ctx3 = buildCtx({ getRows: [canonRow()] });
    await existingFlow(ctx3, ['CI-02']);
    prepareCandidates(ctx3, ['CI-02']);
    await ctx3._ceLoadCanonicalForEntry();
    const r3 = await ctx3._ceSubmitEvidenceForResolution();
    assert(posts(ctx3).length === 0 && gets(ctx3).length === 2 && r3.error === 'canonical_changed_since_selection', 'UI-PRG-9e. 選択後に canonical を再確認 → 古い選択の Plan は POST 0（再選択を要求）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('UI-PRG-10. 409 canonical_revision_conflict → retry 0 / stale 表示');
  {
    const ctx = buildCtx({ getRows: [canonRow()], postResponse: { status: 409, body: { ok: false, error: 'canonical_revision_conflict' } } });
    await existingFlow(ctx, ['CI-02']);
    prepareCandidates(ctx, ['CI-02']);
    const r = await ctx._ceSubmitEvidenceForResolution();
    assert(posts(ctx).length === 1 && r.httpStatus === 409, 'UI-PRG-10a. POST はちょうど1回（自動 retry なし）');
    assert(ctx._ceCanonicalByCase[CASE].status === 'stale', 'UI-PRG-10b. canonical 状態を stale にする（revision を差し替えて再送しない）');
    const html = ctx.__els['ce-approval-panel'].innerHTML;
    assert(html.indexOf('Evidenceの状態が更新されています') !== -1 && html.indexOf('canonical_revision_conflict') !== -1, 'UI-PRG-10c. stale メッセージと code を表示');
    const r2 = await ctx._ceSubmitEvidenceForResolution();
    assert(posts(ctx).length === 1 && r2.ok === false, 'UI-PRG-10d. もう一度押しても stale 状態からは POST しない（' + r2.error + '）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('UI-PRG-11. 422 error code を識別表示（すべてを Evidence 不足と表示しない）');
  {
    const codes = {
      resolution_mode_required: 'Resolution方式',
      target_claim_ids_required: '更新対象Claimが指定されていません',
      resolution_incomplete: '部分的な更新は行いません',
      incomplete_resolution: '部分的な更新は行いません',
      candidate_mapping_missing: 'Mapping未選択',
      candidate_case_mismatch: '別案件',
    };
    for (const code of Object.keys(codes)) {
      const ctx = buildCtx({ getRows: [canonRow()] });
      ctx._cePlan = { caseId: CASE, queries: [], blocked: [], fingerprint: 'fp', intents: [{ intentId: 'CI-02' }] };
      ctx._ceState = 'completed';
      ctx._ceLastEvidenceCandidates = [{ intentId: 'CI-02', sourceUrl: 'https://www.mhlw.go.jp/x' }];
      ctx._ceLastResolutionResponse = { ok: false, error: code, httpStatus: 422, details: [{ intentId: 'CI-02', error: 'claim_not_resolved' }] };
      ctx._ceRenderPanel();
      const html = ctx.__els['ce-approval-panel'].innerHTML;
      assert(html.indexOf(codes[code]) !== -1 && html.indexOf('code: ' + code) !== -1 && html.indexOf('Evidence不足') === -1, 'UI-PRG-11. ' + code + ' → 専用文言 + code（Evidence不足と表示しない）');
    }
    const ctx = buildCtx({ getRows: [canonRow()] });
    ctx._cePlan = { caseId: CASE, queries: [], blocked: [], fingerprint: 'fp', intents: [{ intentId: 'CI-02' }] };
    ctx._ceState = 'completed';
    ctx._ceLastEvidenceCandidates = [{ intentId: 'CI-02', sourceUrl: 'https://www.mhlw.go.jp/secret-path' }];
    ctx._ceLastResolutionResponse = { ok: false, error: 'resolution_incomplete', details: [{ intentId: 'CI-02', error: 'claim_not_resolved' }] };
    ctx._ceRenderPanel();
    const html = ctx.__els['ce-approval-panel'].innerHTML;
    assert(html.indexOf('CI-02=claim_not_resolved') !== -1, 'UI-PRG-11b. details は claimId と error 名のみを表示');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('UI-PRG-12 / 15. canonical 列を payload に含めない / 対象外 Claim を含めない');
  {
    const ctx = buildCtx({ getRows: [canonRow({ revision: REV })] });
    await existingFlow(ctx, ['CI-02']);
    prepareCandidates(ctx, ['CI-02']);
    await ctx._ceSubmitEvidenceForResolution();
    const b = posts(ctx)[0].body;
    assert(CANONICAL_KEYS.every(function (k) { return !Object.prototype.hasOwnProperty.call(b, k); }), 'UI-PRG-12a. top-level に canonical 列 / origin / revision を含めない');
    assert(JSON.stringify(Object.keys(b).sort()) === JSON.stringify(['caseId', 'contentEvidenceCandidates', 'expectedRevision', 'fields', 'outputId', 'resolutionMode', 'targetClaimIds']), 'UI-PRG-12b. payload key は既存 + PRG 契約3項目のみ');
    assert(!Object.prototype.hasOwnProperty.call(b.fields, 'content_claims') && !Object.prototype.hasOwnProperty.call(b.fields, 'content_evidence_origin'), 'UI-PRG-12c. fields にも canonical 列を追加しない');
    assert(JSON.stringify(b.targetClaimIds) === '["CI-02"]' && b.contentEvidenceCandidates.every(function (c) { return c.intentId === 'CI-02'; }), 'UI-PRG-15a. 一部更新では対象外 Claim ID が request に入らない');

    // 対象外 Claim の candidate が混ざっていれば POST しない
    const ctx2 = buildCtx({ getRows: [canonRow()] });
    await existingFlow(ctx2, ['CI-02']);
    prepareCandidates(ctx2, ['CI-02', 'CI-03']);
    const r2 = await ctx2._ceSubmitEvidenceForResolution();
    assert(posts(ctx2).length === 0 && r2.error === 'candidate_intent_unresolved', 'UI-PRG-15b. 対象外 Claim（CI-03）の mapped candidate 混入 → POST 0');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('UI-PRG-14. 1操作につき Resolution POST 最大1回');
  {
    const ctx = buildCtx({ getRows: [canonRow()] });
    await existingFlow(ctx, ['CI-02']);
    prepareCandidates(ctx, ['CI-02']);
    const a = ctx._ceSubmitEvidenceForResolution();
    const b = ctx._ceSubmitEvidenceForResolution();   // 連打（in-flight）
    const rb = await b; await a;
    assert(posts(ctx).length === 1 && rb.error === 'submit_in_flight', 'UI-PRG-14a. 同時2回押下 → POST 1回（2回目は submit_in_flight）');
    const r3 = await ctx._ceSubmitEvidenceForResolution();
    assert(posts(ctx).length === 1 && r3.ok === false, 'UI-PRG-14b. 成功後の再押下 → canonical 再確認要求（stale）で POST しない（' + r3.error + '）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('UI-PRG-18. 既存 B1 / PRG / UI 契約を壊さない');
  {
    const codeLines = CE_BLOCK.split('\n').filter(function (l) { return l.trim().indexOf('//') !== 0; });
    assert(codeLines.filter(function (l) { return l.indexOf('/api/evidence/web-search') !== -1; }).length === 1, 'UI-PRG-18a. Web Search 呼び出しは1箇所のみ（既存）');
    const entryStart = CE_BLOCK.indexOf('function _ceStartPlanFromForm()');
    const entryBody = CE_BLOCK.slice(entryStart, CE_BLOCK.indexOf('\nfunction _ceRefreshEntrySection', entryStart));
    const selStart = CE_BLOCK.indexOf('function _ceStartPlanFromSelection()');
    const selBody = CE_BLOCK.slice(selStart, CE_BLOCK.indexOf('\n}\n', selStart));
    assert(entryBody.indexOf('fetch(') === -1 && selBody.indexOf('fetch(') === -1 && selBody.indexOf('/api/') === -1, 'UI-PRG-18b. Plan 作成関数（form / selection）は fetch しない');
    const secStart = CE_BLOCK.indexOf('function _ceBuildCanonicalSectionHtml(');
    const secBody = CE_BLOCK.slice(secStart, CE_BLOCK.indexOf('\n}\n', secStart));
    assert(secBody.indexOf('fetch(') === -1 && secBody.indexOf('_ceBuildPlan(') === -1, 'UI-PRG-18c. canonical 表示関数は副作用なし');
    // POST /api/output-drafts（Resolution 送信）は1箇所のみ（Web Search の POST は 18a で別途確認）
    assert(codeLines.filter(function (l) { return l.indexOf("fetch('/api/output-drafts', {") !== -1; }).length === 1, 'UI-PRG-18d. POST /api/output-drafts は Resolution 送信の1箇所のみ');
    assert(codeLines.every(function (l) { return l.indexOf('getCurrentApprovalCaseId(') === -1; }), 'UI-PRG-18e. cross-case fallback（getCurrentApprovalCaseId）を使わない');

    // 自動実行しない: canonical 確認・Plan 作成・GET は明示操作前に 0
    const ctx = buildCtx({ getRows: [canonRow()] });
    ctx.buildContentEvidenceEntryHtml();
    assert(ctx.__calls.length === 0 && ctx._cePlan === null, 'UI-PRG-18f. 描画だけでは GET / Plan 作成 0');

    // 既存 canonical 表示（読み取り専用・escape）
    const ctx2 = buildCtx({ getRows: [canonRow({ claimText: '<script>alert(1)</script>"x"' })] });
    await ctx2._ceLoadCanonicalForEntry();
    const html = ctx2.buildContentEvidenceEntryHtml();
    assert((html.match(/class="ce-canon-claim"/g) || []).length === 3 && html.indexOf('id="ce-canon-select-CI-02"') !== -1, 'UI-PRG-18g. canonical Claim 3件を選択 control 付きで表示');
    assert(html.indexOf('<script>alert(1)</script>') === -1 && html.indexOf('&lt;script&gt;') !== -1, 'UI-PRG-18h. canonical claim 文言は escape 表示（UI で再生成しない）');

    // 別 case の Draft では canonical を確認しない
    const ctx3 = buildCtx({ getRows: [canonRow()] });
    ctx3._lastOutputDraft = { id: OUT, caseId: 'case-other', fields: {} };
    const st = await ctx3._ceLoadCanonicalForEntry();
    assert(st.status === 'error' && ctx3.__calls.length === 0, 'UI-PRG-18i. active case と異なる Output Draft → GET 0 / error');
    // GET row の case / output 不一致は使わない
    const ctx4 = buildCtx({ getRows: [Object.assign(canonRow(), { case_id: 'case-other' })] });
    const st4 = await ctx4._ceLoadCanonicalForEntry();
    assert(st4.status === 'error', 'UI-PRG-18j. GET row の case 不一致 → canonical として採用しない');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('S. Safety Assertions（sandbox）');
  {
    const loaded = Object.keys(require.cache).map(function (p) { return path.relative(ROOT, p).split(path.sep).join('/'); });
    ['openaiClient.js', 'claudeClient.js', 'costTracker.js', 'lib/costDb.js', 'conversationHistory.js', 'server.js', 'lib/supabase.js'].forEach(function (f) {
      assert(loaded.indexOf(f) === -1, 'S-1. 未読込: ' + f);
    });
    assert(counters.network === 0 && counters.blockedModules === 0 && counters.envFileReads === 0 && counters.fsWrites === 0, 'S-2. network / 禁止 module / .env / fs write = 0');
    assert(violations.length === 0, 'S-3. sandbox violation = 0' + (violations.length ? ' → ' + violations.join(', ') : ''));
    const after = hashProtected();
    PROTECTED_FILES.forEach(function (rel) {
      assert(after[rel] === protectedBefore[rel] && after[rel] === PROTECTED_BASELINE[rel], 'S-4. Protected 不変・baseline 一致: ' + rel);
    });
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All contentEvidenceUiResolutionContract cases passed (PRG UI Contract Wiring / U2)'); }
})().catch(function (e) { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
