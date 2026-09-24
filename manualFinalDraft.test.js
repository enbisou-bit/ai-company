'use strict';
// manualFinalDraft.test.js
// First Post Finalization: Manual Final Draft Copy / Edit の deterministic テスト。
//
//   ★ 実行は必ずこのファイル名を明示指定する（node manualFinalDraft.test.js）。
//   ★ index.html の MANUAL-FINAL-DRAFT-BEGIN〜END ブロックだけを vm で実行する。fetch / 保存は vm 内 mock のみ。
//   ★ 外部出口は冒頭で fail-closed に封鎖する（network / credential env / .env / 禁止 module / fs write）。
//   ★ Protected 10件の hash を開始時・終了時に read-only で取得し、全件一致を assert する。

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const vm = require('vm');
const Module = require('module');

const ROOT = __dirname;
const violations = [];

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
function blockedNetwork(name) { return function () { violations.push('network:' + name); throw new Error('SANDBOX_BLOCKED_NETWORK:' + name); }; }
['http', 'https'].forEach(function (m) { const mod = require(m); mod.request = blockedNetwork(m + '.request'); mod.get = blockedNetwork(m + '.get'); });
{ const net = require('net'); net.connect = blockedNetwork('net.connect'); net.createConnection = blockedNetwork('net.createConnection'); const tls = require('tls'); tls.connect = blockedNetwork('tls.connect'); }
globalThis.fetch = blockedNetwork('fetch');
const CREDENTIAL_ENV_PATTERN = /^(OPENAI|ANTHROPIC|CLAUDE|SUPABASE|NEXT_PUBLIC_SUPABASE|LINE_|WEB_SESSION|CAROUSEL_)/i;
Object.keys(process.env).forEach(function (k) { if (CREDENTIAL_ENV_PATTERN.test(k)) delete process.env[k]; });
function isEnvFile(p) { try { return /^\.env(\..*)?$/.test(path.basename(String(p))); } catch (e) { return false; } }
['readFileSync', 'readFile', 'existsSync', 'statSync', 'createReadStream'].forEach(function (n) {
  const orig = fs[n]; if (typeof orig !== 'function') return;
  fs[n] = function (p) { if (isEnvFile(p)) { violations.push('env_file_read:' + n); throw new Error('SANDBOX_BLOCKED_ENV_READ'); } return orig.apply(this, arguments); };
});
function blockedWrite(name) { return function () { violations.push('fs_write:' + name); throw new Error('SANDBOX_BLOCKED_FS_WRITE:' + name); }; }
['writeFileSync', 'appendFileSync', 'renameSync', 'unlinkSync', 'mkdirSync', 'rmSync', 'rmdirSync', 'copyFileSync', 'truncateSync',
  'symlinkSync', 'cpSync', 'writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir', 'copyFile', 'truncate', 'createWriteStream']
  .forEach(function (n) { if (typeof fs[n] === 'function') fs[n] = blockedWrite('fs.' + n); });
['writeFile', 'appendFile', 'rename', 'unlink', 'mkdir', 'rm', 'rmdir', 'copyFile', 'truncate'].forEach(function (n) { if (typeof fs.promises[n] === 'function') fs.promises[n] = blockedWrite('fs.promises.' + n); });
const BLOCKED_BARE = new Set(['axios', 'dotenv', '@supabase/supabase-js', 'http2', 'undici', 'child_process', 'node:http2', 'node:child_process']);
const BLOCKED_FILES = new Set(['openaiClient.js', 'claudeClient.js', 'costTracker.js', 'lib/costDb.js', 'conversationHistory.js', 'server.js', 'lib/supabase.js', 'lib/outputDraftsDb.js']
  .map(function (p) { return path.join(ROOT, p); }));
const origLoad = Module._load;
Module._load = function (request, parent, isMain) {
  if (BLOCKED_BARE.has(request)) { violations.push('module:' + request); throw new Error('SANDBOX_BLOCKED_MODULE:' + request); }
  let filename = null;
  try { filename = Module._resolveFilename(request, parent, isMain); } catch (e) { filename = null; }
  if (filename && BLOCKED_FILES.has(filename)) { violations.push('module:' + path.relative(ROOT, filename)); throw new Error('SANDBOX_BLOCKED_MODULE:' + request); }
  return origLoad.apply(this, arguments);
};

let _passed = 0, _failed = 0;
function assert(cond, label) { if (cond) { _passed++; console.log('  ✅ ' + label); } else { _failed++; console.log('  ❌ ' + label); } }
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8').replace(/\r\n/g, '\n');
const bStart = idx.indexOf('// MANUAL-FINAL-DRAFT-BEGIN');
const bEnd = idx.indexOf('// MANUAL-FINAL-DRAFT-END');
if (bStart === -1 || bEnd === -1) throw new Error('MANUAL-FINAL-DRAFT block not found');
const BLOCK = idx.slice(bStart, bEnd);
// Canonical Evidence Reuse サブブロック（元DraftのEvidenceを使用・検索なし）と、それ以外（複製 / 手動編集）
const rStart = BLOCK.indexOf('// MFD-EVIDENCE-REUSE-BEGIN');
const rEnd = BLOCK.indexOf('// MFD-EVIDENCE-REUSE-END');
if (rStart === -1 || rEnd === -1) throw new Error('MFD-EVIDENCE-REUSE block not found');
const REUSE = BLOCK.slice(rStart, rEnd);
const BASE = BLOCK.slice(0, rStart) + BLOCK.slice(rEnd);

// 既存 Content Evidence の client 関数（本物）を index.html から抜き出す（再実装しない）
function extractFn(name) {
  const m = new RegExp('\\n(async )?function ' + name + '\\(').exec(idx);
  if (!m) throw new Error('function not found: ' + name);
  const end = idx.indexOf('\n}\n', m.index + 1);
  return idx.slice(m.index + 1, end + 3);
}
const CE_PATTERN_LINE = (/\nvar CE_CLAIM_ID_PATTERN = [^\n]+\n/.exec(idx) || [''])[0];
if (!CE_PATTERN_LINE) throw new Error('CE_CLAIM_ID_PATTERN not found');
const CE_SRC = CE_PATTERN_LINE + ['_ceParseCanonicalRow', '_ceFetchCanonicalState', '_ceDecideResolutionContract'].map(extractFn).join('\n');

// server 側の既存 Resolution（本物・DB / Network なし）
const resolutionGuard = require('./lib/contentEvidenceResolutionGuard');
const resolutionService = require('./lib/contentEvidenceResolutionService');
const ContentClaimPlanningNode = require('./shared/contentClaimPlanning');

const CASE = 'case-x';
const SRC = 'out_1000000000001';
function srcRow(extra) {
  return Object.assign({
    output_id: SRC, case_id: CASE, type: 'instagram_carousel', status: 'ready', source_text: 'handoff',
    content_type: 'value',
    fields: {
      slides: ['【1枚目】タイトル：A / 本文：a', '【2枚目】タイトル：B / 本文：b', '【3枚目】タイトル：C / 本文：c'],
      caption: 'caption text', cta: 'cta text', hashtags: ['#日焼け止め', '#SPF'],
      imagePrompts: ['p1', 'p2'], benefit: 'benefit text', targetAudience: 'target text', saveSharePrompt: 'save it',
    },
    assigned_roles: { writer: 'writer' }, schema_version: '1', detection: { type: 'instagram_carousel' },
    quality: { status: 'needs_improvement' }, package_quality: { score: 100 },
    content_value: { score: 29 },
    content_evidence: [{ evidenceId: 'ev-CI-01-0' }], content_claims: [{ claimId: 'CI-01' }],
    content_evidence_origin: { revision: 'rev-' + 'a'.repeat(32) },
  }, extra || {});
}

function buildCtx(opts) {
  const o = opts || {};
  const ctx = { console: { log: function () {}, warn: function () {}, error: function () {} } };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const els = {};
  ctx.__calls = [];
  ctx.__pushed = [];
  ctx.__row = o.row === undefined ? srcRow() : o.row;
  ctx.__renders = 0;
  ctx.__resets = 0;
  Object.assign(ctx, {
    document: { getElementById: function (id) { return els[id] || null; } },
    fetch: function (url, init) {
      ctx.__calls.push({ url: String(url), method: (init && init.method) || 'GET' });
      return Promise.resolve({ ok: true, status: 200, json: function () { return Promise.resolve({ ok: true, draft: ctx.__row, source: 'db' }); } });
    },
    getCurrentApprovalCaseId: function () { return CASE; },
    normalizeOutputType: function (t) { return t; },
    renderOutputEnginePanel: function () { ctx.__renders++; },
    resetApprovalStatesToDefault: function () { ctx.__resets++; },
    pushOutputDraftToServer: function (d) { ctx.__pushed.push(JSON.parse(JSON.stringify({ id: d.id, fields: d.fields, contentType: d.contentType }))); },
    escapeHtml: function (x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
    // 現在表示中の Draft（複製元）と Content Evidence のページ state（本機能は触れてはならない）
    _lastOutputDraft: o.current === undefined ? { id: SRC, caseId: CASE, type: 'instagram_carousel', fields: srcRow().fields, contentType: 'value' } : o.current,
    _ceLastEvidenceCandidates: [{ intentId: 'CI-01', sourceUrl: 'https://www.jcia.org/a' }],
    _ceVerifiedExcerpts: { 0: { excerpt: '原文', confirmed: true } },
    _ceMappingDecisions: { 0: { claimType: 'general_practice', supportType: 'supports' } },
    _ceClaimTextByCase: { 'case-x': { 'CI-01': 'claim' } },
  });
  vm.runInContext(BLOCK, ctx);
  ctx.__els = els;
  return ctx;
}
// ── Canonical Evidence Reuse 用 fixture ──
const NOW_MS = Date.parse('2026-09-24T00:00:00.000Z');
const REUSE_CLAIMS = [
  { id: 'CI-01', q: '日焼け止めはどのくらいの間隔で塗り直すべきか？', text: '日焼け止めは2時間ごとに塗り直す', ex: ['日焼け止めは2時間ごとに塗り直しましょう', '2時間おきの塗り直しが推奨されます'] },
  { id: 'CI-02', q: '日焼け止めの適量はどれくらいか？', text: '顔全体でパール2粒分が目安', ex: ['顔全体でパール2粒分を目安に', 'パール粒2個分が適量です'] },
  { id: 'CI-03', q: '曇りの日も日焼け止めは必要か？', text: '曇りの日も紫外線対策が必要', ex: ['曇りの日も紫外線は届きます', '曇天でも紫外線対策は必要です'] },
];
function sourceCandidates(caseId, publishers) {
  const pubs = publishers || [['https://www.mhlw.go.jp/uv', '厚生労働省'], ['https://www.jcia.org/uv', '日本化粧品工業会']];
  const out = [];
  REUSE_CLAIMS.forEach(function (c) {
    pubs.forEach(function (p, i) {
      out.push({
        intentId: c.id, caseId: caseId, topic: 'topic ' + c.id, question: c.q, claimTypeCandidate: 'general_practice',
        candidate: { sourceMethod: 'public_document_user_verified', sourceUrl: p[0] + '/' + c.id, sourceName: p[1], sourceTitle: p[1] + ' UV', sourceExcerpt: c.ex[i], createdBy: 'user' },
        mappingDecision: { claimType: 'general_practice', supportType: 'supports', verificationStatus: 'user_verified' },
        proposedClaimText: c.text,
      });
    });
  });
  return out;
}
// 本物の server Resolution（validate → resolve → plan）。成功時だけ row の canonical 3列を更新する（CAS は revision 一致で模擬）。
function serverResolve(rows, body, opts) {
  const o = opts || {};
  const caseId = body.caseId, outputId = body.outputId;
  const existing = rows[outputId] || null;
  if (existing && existing.case_id !== caseId) return { status: 409, json: { ok: false, error: 'output_case_mismatch' } };
  const contract = resolutionGuard.validateResolutionRequest({ caseId: caseId, body: body });
  if (!contract.ok) return { status: contract.httpStatus, json: { ok: false, error: contract.error } };
  const resolved = resolutionService.resolveContentEvidenceSubmission(body.contentEvidenceCandidates, { caseId: caseId, now: NOW_MS });
  if (resolved.contentEvidence.length === 0 || resolved.contentClaims.length === 0) {
    return { status: 422, json: { ok: false, error: 'content_evidence_resolution_insufficient' } };
  }
  const plan = resolutionGuard.planCanonicalResolution({ caseId: caseId, outputId: outputId, contract: contract.value, existingRow: existing, resolved: resolved, resolvedAt: new Date(NOW_MS).toISOString() });
  if (!plan.ok) return { status: plan.httpStatus, json: { ok: false, error: plan.error, details: plan.details || null } };
  if (o.forceConflict) return { status: 409, json: { ok: false, error: 'canonical_revision_conflict' } };
  existing.content_evidence = plan.nextEvidence;
  existing.content_claims = plan.nextClaims;
  existing.content_evidence_origin = plan.origin;
  if (body.fields) existing.fields = JSON.parse(JSON.stringify(body.fields));
  return { status: 200, json: { ok: true, contentEvidenceSummary: { contentEvidenceCount: plan.nextEvidence.length, contentClaimsCount: plan.nextClaims.length, resolutionMode: plan.mode, revision: plan.origin.revision } } };
}
function reuseSourceRow(publishers) {
  const row = srcRow({ content_evidence: null, content_claims: null, content_evidence_origin: null });
  const r = serverResolve({ [SRC]: row }, { outputId: SRC, caseId: CASE, contentEvidenceCandidates: sourceCandidates(CASE, publishers), resolutionMode: 'full_replace', targetClaimIds: ['CI-01', 'CI-02', 'CI-03'], expectedRevision: null });
  if (r.status !== 200) throw new Error('fixture resolution failed: ' + JSON.stringify(r.json));
  return row;
}

// ── Trial 同型 fixture（Production GET で確認した構成）: 各 CI = jcia.org user_verified（原文あり）+ env.go.jp web_retrieved（原文なし）──
const CI02_NEW = 'SPFは主にUVBによるサンバーンを防ぐ効果を表す指標で、数値が大きくなるほどサンバーンの防止効果が高くなります。PAはUVAを防ぐ効果を表す指標です。';
const CI03_NEW = '日焼け止めは使用場面に合わせて選び、長時間の屋外活動では高い紫外線防止効果を持つもの、水に濡れる場面ではUV耐水性表示のある製品を選ぶ考え方があります。';
const TRIAL_CLAIMS = [
  { id: 'CI-01', q: '日焼け止めの塗り直しはなぜ必要か？', text: '日焼け止めは汗や摩擦で落ちやすいため、こまめな塗り直しが大切です',
    ex: '日焼け止めは汗をかいたり、タオルで拭いたりすると落ちてしまうため、こまめに塗り直すことが大切です。' },
  { id: 'CI-02', q: 'SPFとPAは何を表す指標か？', text: 'SPFとPAは紫外線を防ぐ効果の目安です',
    ex: 'SPFは主にUVBによるサンバーンを防ぐ効果を表す指標で、数値が大きくなるほどサンバーンの防止効果が高くなります。PAはUVAを防ぐ効果を表す指標です。' },
  { id: 'CI-03', q: '日焼け止めはどのように選べばよいか？', text: '日焼け止めは使う場面に合わせて選びます',
    ex: '使用場面に合わせて日焼け止めを選びましょう。長時間の屋外活動では高い紫外線防止効果を持つものを、水に濡れる場面ではUV耐水性表示のある製品を選ぶ考え方があります。' },
];
function trialSourceCandidates(caseId) {
  const out = [];
  TRIAL_CLAIMS.forEach(function (c) {
    const base = { intentId: c.id, caseId: caseId, topic: 'topic ' + c.id, question: c.q, claimTypeCandidate: 'general_practice', proposedClaimText: c.text };
    out.push(Object.assign({}, base, {
      candidate: { sourceMethod: 'public_document_user_verified', sourceUrl: 'https://www.jcia.org/uv/' + c.id, sourceName: '日本化粧品工業会', sourceTitle: '紫外線と日焼け止め', sourceExcerpt: c.ex, createdBy: 'user' },
      mappingDecision: { claimType: 'general_practice', supportType: 'supports', verificationStatus: 'user_verified' },
    }));
    out.push(Object.assign({}, base, {
      candidate: { sourceMethod: 'web_retrieved', sourceUrl: 'https://www.env.go.jp/chemi/uv/' + c.id, sourceName: '環境省', sourceTitle: '紫外線環境保健マニュアル', createdBy: 'system' },
      mappingDecision: { claimType: 'general_practice', supportType: 'supports' },
    }));
  });
  return out;
}
function trialSourceRow() {
  const row = srcRow({ content_evidence: null, content_claims: null, content_evidence_origin: null });
  const r = serverResolve({ [SRC]: row }, { outputId: SRC, caseId: CASE, contentEvidenceCandidates: trialSourceCandidates(CASE), resolutionMode: 'full_replace', targetClaimIds: ['CI-01', 'CI-02', 'CI-03'], expectedRevision: null });
  if (r.status !== 200) throw new Error('trial fixture resolution failed: ' + JSON.stringify(r.json));
  return row;
}

function buildReuseCtx(opts) {
  const o = opts || {};
  const ctx = { console: { log: function () {}, warn: function () {}, error: function () {} }, URL: URL };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  const els = {};
  ctx.__els = els;
  ctx.__calls = [];
  ctx.__posts = [];
  ctx.__stale = [];
  ctx.__renders = 0;
  ctx.__rows = { [SRC]: o.sourceRow || reuseSourceRow() };
  ctx.__serverOpts = {};
  function reply(status, json) { return Promise.resolve({ ok: status >= 200 && status < 300, status: status, json: function () { return Promise.resolve(json); } }); }
  Object.assign(ctx, {
    document: { getElementById: function (id) { return els[id] || null; } },
    fetch: function (url, init) {
      const method = (init && init.method) || 'GET';
      const u = String(url);
      ctx.__calls.push({ url: u, method: method });
      if (method === 'GET') {
        const m = /[?&]outputId=([^&]+)/.exec(u);
        const row = m ? ctx.__rows[decodeURIComponent(m[1])] : null;
        return reply(200, { ok: true, draft: row ? JSON.parse(JSON.stringify(row)) : null, source: 'db' });
      }
      const body = JSON.parse(init.body);
      ctx.__posts.push({ url: u, body: body });
      if (u !== '/api/output-drafts') return reply(404, { ok: false, error: 'not_found' });
      const r = serverResolve(ctx.__rows, body, ctx.__serverOpts);
      return reply(r.status, r.json);
    },
    getCurrentApprovalCaseId: function () { return CASE; },
    normalizeOutputType: function (t) { return t; },
    renderOutputEnginePanel: function () { ctx.__renders++; },
    resetApprovalStatesToDefault: function () {},
    // 既存 pushOutputDraftToServer（通常保存＝canonical 3列を変更しない）の模擬: 新 outputId の row を作る / fields だけ更新
    pushOutputDraftToServer: function (d) {
      if (o.skipTargetSave) return;
      const cur = ctx.__rows[d.id];
      if (cur) { cur.fields = JSON.parse(JSON.stringify(d.fields)); return; }
      ctx.__rows[d.id] = { output_id: d.id, case_id: d.caseId, type: d.type, status: d.status, fields: JSON.parse(JSON.stringify(d.fields)), content_type: d.contentType, content_evidence: null, content_claims: null, content_evidence_origin: null };
    },
    escapeHtml: function (x) { return String(x == null ? '' : x).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); },
    _ceLinkHrefAttr: function (u) { return 'href="' + String(u).replace(/"/g, '&quot;') + '"'; },
    _ceMarkCanonicalStale: function (caseId, reason) { ctx.__stale.push({ caseId: caseId, reason: reason }); },
    ContentClaimPlanning: o.noPlanning ? undefined : ContentClaimPlanningNode,
    _lastOutputDraft: { id: SRC, caseId: CASE, type: 'instagram_carousel', fields: srcRow().fields, contentType: 'value' },
    _ceLastEvidenceCandidates: [{ intentId: 'CI-01', sourceUrl: 'https://www.jcia.org/a' }],
    _ceVerifiedExcerpts: { 0: { excerpt: '原文', confirmed: true } },
    _ceMappingDecisions: { 0: { claimType: 'general_practice', supportType: 'supports' } },
    _ceClaimTextByCase: { 'case-x': { 'CI-01': 'claim' } },
  });
  vm.runInContext(CE_SRC, ctx);
  vm.runInContext(BLOCK, ctx);
  return ctx;
}
// 複製 → 元DraftのEvidence読み込みまで進める
async function reuseLoaded(opts) {
  const ctx = buildReuseCtx(opts);
  await ctx.mfdCopyCurrentDraftAsFinal();
  const target = ctx._lastOutputDraft.id;
  ctx.__calls.length = 0;
  await ctx.mfdReuseLoadSourceEvidence();
  return { ctx: ctx, target: target };
}
// confirmed: true = user_verified Evidence をすべて再確認 / false = 未確認 / 数値 n = 先頭 n 件だけ確認
function setReuseDom(ctx, texts, confirmed, claims) {
  (claims || REUSE_CLAIMS).forEach(function (c) { ctx.__els['mfd-reuse-claim-' + c.id] = { value: texts && texts[c.id] !== undefined ? texts[c.id] : c.text }; });
  let n = 0;
  ((ctx._mfdReuse && ctx._mfdReuse.plan && ctx._mfdReuse.plan.evidence) || []).forEach(function (ev, i) {
    if (ev.kind !== 'user_verified') return;
    const on = confirmed === true || (typeof confirmed === 'number' && n < confirmed);
    ctx.__els['mfd-reuse-confirm-' + i] = { checked: on };
    n++;
  });
}

function ceSnapshot(ctx) { return JSON.stringify([ctx._ceLastEvidenceCandidates, ctx._ceVerifiedExcerpts, ctx._ceMappingDecisions, ctx._ceClaimTextByCase]); }

(async () => {
  console.log('\n=== manualFinalDraft.test.js (First Post Finalization: Manual Final Draft Copy / Edit) ===');

  caseHeader('SB. sandbox 自己検証');
  {
    const sv = violations.length; let blocked = false;
    try { globalThis.fetch('https://example.com'); } catch (e) { blocked = String(e.message).indexOf('SANDBOX_BLOCKED_NETWORK') === 0; }
    assert(blocked, 'SB-1. 実 fetch 封鎖');
    violations.length = sv;
  }

  caseHeader('A〜E. 複製（純関数 buildManualFinalDraftCopy）');
  {
    const ctx = buildCtx();
    const row = srcRow();
    const before = JSON.stringify(row);
    const r = ctx.buildManualFinalDraftCopy(row, { newOutputId: 'out_2000000000002', nowIso: '2026-09-24T00:00:00.000Z' });
    assert(r.ok === true && r.draft.id === 'out_2000000000002' && r.draft.id !== SRC, 'A. 新しい outputId になる');
    assert(JSON.stringify(row) === before, 'B. 複製元 row（outputId・fields・canonical）は変更されない');
    const f = r.draft.fields;
    assert(JSON.stringify(f.slides) === JSON.stringify(row.fields.slides) && f.caption === 'caption text' && f.cta === 'cta text' && JSON.stringify(f.hashtags) === JSON.stringify(row.fields.hashtags), 'C. slides / caption / CTA / hashtags をコピー');
    assert(JSON.stringify(f.imagePrompts) === JSON.stringify(row.fields.imagePrompts) && f.benefit === 'benefit text' && f.targetAudience === 'target text' && f.saveSharePrompt === 'save it', 'C-2. imagePrompts / benefit / targetAudience ほか非破壊 metadata もコピー');
    f.slides[0] = 'changed'; assert(row.fields.slides[0] !== 'changed', 'C-3. deep copy（複製側の編集が複製元へ波及しない）');
    assert(r.draft.contentType === 'value', 'D. content_type = value を維持（server row の content_type）');
    const keys = Object.keys(r.draft);
    assert(!keys.some(function (k) { return /content_?evidence|content_?claims|origin|revision/i.test(k); }), 'E. canonical Evidence / Claims / Origin / revision をコピーしない');
    const withLegacy = ctx.buildManualFinalDraftCopy(srcRow({ fields: Object.assign({}, srcRow().fields, { contentEvidence: [{ x: 1 }], contentClaims: [{ y: 1 }] }) }), { newOutputId: 'out_3' });
    assert(withLegacy.ok && !('contentEvidence' in withLegacy.draft.fields) && !('contentClaims' in withLegacy.draft.fields), 'E-2. fields 内の legacy contentEvidence / contentClaims も除外');
    assert(r.draft.quality === null && r.draft.packageQuality === null && !('contentValue' in r.draft), 'E-3. 派生値（quality / packageQuality / content_value）を持ち込まない');
    assert(r.draft.manualFinalOf.sourceOutputId === SRC && r.draft.caseId === CASE, 'E-4. 複製元 outputId と caseId を保持（メモリのみ）');
    assert(ctx.buildManualFinalDraftCopy(row, { newOutputId: SRC }).ok === false, 'E-5. 複製元と同じ outputId は拒否');
    assert(ctx.buildManualFinalDraftCopy(srcRow({ fields: { slides: [] } }), { newOutputId: 'out_4' }).ok === false, 'E-6. slides が無い Draft は複製しない');
  }

  caseHeader('A / F / H / I. UI 操作（複製 → 編集 → 保存）');
  {
    const ctx = buildCtx();
    const ceBefore = ceSnapshot(ctx);
    const html0 = ctx.buildManualFinalDraftHtml();
    assert(html0.indexOf('id="mfd-copy-btn"') !== -1 && html0.indexOf('<textarea') === -1, 'UI-1. 複製元 Draft には「Final Draftとして複製」だけを表示（編集欄なし）');
    const copy = await ctx.mfdCopyCurrentDraftAsFinal();
    assert(copy && copy.id !== SRC && ctx._lastOutputDraft.id === copy.id, 'A-2. 複製で新 outputId の Draft が表示対象になる');
    assert(ctx.__calls.length === 1 && ctx.__calls[0].method === 'GET' && ctx.__calls[0].url.indexOf('outputId=' + SRC) !== -1, 'H-1. 通信は複製元 row の GET 1件だけ（AI API なし）');
    assert(ctx.__pushed.length === 1 && ctx.__pushed[0].id === copy.id && ctx.__pushed[0].contentType === 'value', 'F-1. 複製直後の保存は新 outputId のみ（content_type=value）');
    assert(ctx.__resets === 1, 'F-2. 新成果物境界として承認状態をリセット');

    const html1 = ctx.buildManualFinalDraftHtml();
    assert(html1.indexOf('id="mfd-slide-0"') !== -1 && html1.indexOf('id="mfd-caption"') !== -1 && html1.indexOf('id="mfd-cta"') !== -1 && html1.indexOf('id="mfd-hashtags"') !== -1 && html1.indexOf('id="mfd-save-btn"') !== -1, 'UI-2. Final Draft には slides / caption / CTA / hashtags の編集欄と保存ボタン');
    assert(html1.indexOf(SRC) !== -1 && html1.indexOf(copy.id) !== -1, 'UI-3. Final Draft と複製元の outputId を表示');

    // 手動編集
    ctx.__els['mfd-slide-0'] = { value: '【1枚目】タイトル：A改 / 本文：a改' };
    ctx.__els['mfd-slide-1'] = { value: '【2枚目】タイトル：B / 本文：b' };
    ctx.__els['mfd-slide-2'] = { value: '【3枚目】タイトル：C / 本文：c' };
    ctx.__els['mfd-caption'] = { value: '新しい caption' };
    ctx.__els['mfd-cta'] = { value: '新しい CTA' };
    ctx.__els['mfd-hashtags'] = { value: '#日焼け止め\nSPF\n#PA #日焼け止め' };
    const saved = ctx.mfdSaveManualEdits();
    const last = ctx.__pushed[ctx.__pushed.length - 1];
    assert(saved && ctx.__pushed.length === 2 && last.id === copy.id, 'F-3. 手動編集後の保存先は新 outputId だけ');
    assert(last.fields.slides[0] === '【1枚目】タイトル：A改 / 本文：a改' && last.fields.caption === '新しい caption' && last.fields.cta === '新しい CTA', 'F-4. slides / caption / CTA の編集を反映');
    assert(JSON.stringify(last.fields.hashtags) === JSON.stringify(['#日焼け止め', '#SPF', '#PA']), 'F-5. hashtags は # 付与・重複除去');
    assert(last.fields.imagePrompts && last.fields.benefit === 'benefit text', 'F-6. 編集対象外の fields は保持');
    assert(ctx.__pushed.every(function (p) { return p.id !== SRC; }), 'G-1. 複製元 outputId は一度も保存対象にならない');
    assert(ctx.__calls.every(function (c) { return c.method === 'GET' && c.url.indexOf('/api/output-drafts?') === 0; }), 'H-2. AI API / 保存以外の通信なし');
    assert(ceSnapshot(ctx) === ceBefore, 'I. Content Evidence の candidate / excerpt / Mapping / claim 文言 state を変更しない');

    // 空スライドは保存しない
    ctx.__els['mfd-slide-1'] = { value: '   ' };
    const n = ctx.__pushed.length;
    assert(ctx.mfdSaveManualEdits() === null && ctx.__pushed.length === n, 'F-7. 空スライドがあれば保存しない（スライド削除不可）');
  }

  caseHeader('G. 複製元（Trial Draft）を編集・保存できない');
  {
    const ctx = buildCtx();
    ctx.__els['mfd-caption'] = { value: '書き換え' };
    assert(ctx.mfdSaveManualEdits() === null && ctx.__pushed.length === 0, 'G-2. 複製していない Draft（複製元）は保存しない');
    assert(ctx._lastOutputDraft.fields.caption === 'caption text', 'G-3. 複製元 Draft の fields は不変');
    // 別案件の Draft は複製しない
    const ctx2 = buildCtx({ current: { id: SRC, caseId: 'case-other', fields: srcRow().fields } });
    assert(await ctx2.mfdCopyCurrentDraftAsFinal() === null && ctx2.__calls.length === 0 && ctx2.__pushed.length === 0, 'G-4. 現在案件と異なる Draft は複製しない（通信 0）');
    // server row が一致しない場合は複製しない
    const ctx3 = buildCtx({ row: srcRow({ output_id: 'out_other' }) });
    assert(await ctx3.mfdCopyCurrentDraftAsFinal() === null && ctx3.__pushed.length === 0, 'G-5. server の複製元 row が一致しなければ複製しない');
    // 複製済み Final Draft をさらに複製しない
    const ctx4 = buildCtx();
    await ctx4.mfdCopyCurrentDraftAsFinal();
    const pushed = ctx4.__pushed.length;
    assert(await ctx4.mfdCopyCurrentDraftAsFinal() === null && ctx4.__pushed.length === pushed, 'G-6. Final Draft 表示中は再複製しない');
  }

  caseHeader('R-P. 再利用 plan（純関数 buildMfdEvidenceReusePlan）');
  {
    const ctx = buildReuseCtx();
    const row = ctx.__rows[SRC];
    const before = JSON.stringify(row);
    const p = ctx.buildMfdEvidenceReusePlan(row, CASE, SRC);
    assert(p.ok === true && p.claims.length === 3 && p.evidence.length === 6, 'R-P1. 複製元 canonical（Evidence 6 / Claim 3）から plan を作る');
    assert(p.claims.every(function (c, i) { return c.question === REUSE_CLAIMS[i].q && c.text === REUSE_CLAIMS[i].text; }), 'R-P2. Formal question（Evidence.claim）と claim 文言を server row から取得');
    assert(typeof p.revision === 'string' && p.revision === row.content_evidence_origin.revision, 'R-P3. 複製元 revision を保持（stale 検出用）');
    assert(JSON.stringify(row) === before, 'R-P4. 複製元 row を変更しない');
    function mut(fn) { const r = JSON.parse(JSON.stringify(row)); fn(r); return ctx.buildMfdEvidenceReusePlan(r, CASE, SRC).error; }
    assert(mut(function (r) { r.content_evidence[0].sourceMethod = 'manual_user_input'; r.content_evidence[0].verificationStatus = 'user_verified'; }) === 'source_evidence_method_not_allowed', 'R-P5. 原文確認済み・Web取得以外の sourceMethod（manual_user_input）は再利用しない');
    assert(mut(function (r) { r.content_evidence_origin = null; }) === 'source_revision_missing' && mut(function (r) { r.content_type = 'promo'; }) === 'source_content_type_mismatch', 'R-P5b. revision が無い／content_type が value でない複製元は拒否');
    assert(mut(function (r) { r.content_evidence[1].verificationStatus = 'unverified'; }) === 'source_evidence_not_user_verified', 'R-P6. verificationStatus が user_verified 以外は拒否');
    assert(mut(function (r) { r.content_evidence[2].sourceExcerpt = '  '; }) === 'source_evidence_excerpt_missing', 'R-P7. 原文が空の Evidence は拒否');
    assert(mut(function (r) { r.content_evidence[0].supportType = 'contradicts'; }) === 'source_evidence_not_supports', 'R-P8. 反証（contradicts）を含めば拒否');
    assert(mut(function (r) { r.content_evidence[0].sourceUrl = 'javascript:alert(1)'; }) === 'source_evidence_url_invalid', 'R-P9. http / https 以外の URL は拒否');
    assert(mut(function (r) { r.content_evidence[0].caseId = 'case-other'; }) === 'source_evidence_case_mismatch', 'R-P10. 別案件の Evidence は拒否（cross-case）');
    assert(mut(function (r) { r.content_claims[1].status = 'proposed'; }) === 'source_claim_not_grounded', 'R-P11. grounded でない Claim は拒否');
    assert(mut(function (r) { r.content_evidence = r.content_evidence.filter(function (e) { return e.claimId !== 'CI-03'; }); }) === 'source_claim_without_evidence', 'R-P12. Evidence の無い Claim は拒否');
    assert(mut(function (r) { r.content_evidence[1].claim = '別の question'; }) === 'source_question_inconsistent', 'R-P13. 同一 Claim の Formal question 不一致は拒否');
    assert(mut(function (r) { r.content_evidence[0].claimId = 'CI-99'; }) === 'source_evidence_without_claim', 'R-P14. Claim に対応しない Evidence は拒否');
    assert(mut(function (r) { r.content_claims = null; r.content_evidence = null; }) === 'source_canonical_missing', 'R-P15. canonical が無い Draft は拒否');
    assert(ctx.buildMfdEvidenceReusePlan(row, CASE, 'out_other') .error === 'source_row_mismatch' && ctx.buildMfdEvidenceReusePlan(row, 'case-other', SRC).error === 'source_row_mismatch', 'R-P16. outputId / caseId 不一致は拒否');
  }

  caseHeader('R-C. 送信 candidate（純関数 buildMfdEvidenceReuseCandidates）');
  {
    const ctx = buildReuseCtx();
    const p = ctx.buildMfdEvidenceReusePlan(ctx.__rows[SRC], CASE, SRC);
    const b = ctx.buildMfdEvidenceReuseCandidates(p, CASE, { 'CI-01': ' 編集した文言 2時間 ', 'CI-02': REUSE_CLAIMS[1].text, 'CI-03': REUSE_CLAIMS[2].text });
    assert(b.ok === true && b.candidates.length === 6 && JSON.stringify(b.targetClaimIds) === JSON.stringify(['CI-01', 'CI-02', 'CI-03']), 'R-C1. Evidence 6件を raw candidate 化・targetClaimIds は canonical の Claim ID そのまま');
    const src = ctx.__rows[SRC].content_evidence;
    assert(b.candidates.every(function (c, i) { return c.question === src[i].claim && c.candidate.sourceExcerpt === src[i].sourceExcerpt && c.candidate.sourceUrl === src[i].sourceUrl; }), 'R-C2. Formal question / 原文 / URL は複製元の保存値そのまま（読み取り専用）');
    assert(b.candidates.every(function (c) { return c.candidate.sourceMethod === 'public_document_user_verified' && c.candidate.createdBy === 'user' && c.mappingDecision.verificationStatus === 'user_verified' && c.caseId === CASE; }), 'R-C3. 既存 user_verified 経路（sourceMethod / createdBy / verificationStatus）で送る');
    assert(b.candidates.filter(function (c) { return c.intentId === 'CI-01'; }).every(function (c) { return c.proposedClaimText === '編集した文言 2時間'; }), 'R-C4. 編集できるのは claim 文言（proposedClaimText）だけ');
    const flat = JSON.stringify(b.candidates);
    assert(!/"(grounded|status|contentEvidence|contentClaims|evidenceId|revision|reliability)"/.test(flat), 'R-C5. grounded / status / canonical / revision / reliability を client で確定しない');
    assert(ctx.buildMfdEvidenceReuseCandidates(p, CASE, { 'CI-01': 'x', 'CI-02': '  ', 'CI-03': 'y' }).error === 'claim_text_missing', 'R-C6. 空の claim 文言があれば送らない');
  }

  caseHeader('R-U. UI 操作（読み込み → 再確認 → 1回だけ送信）');
  {
    const ctx0 = buildReuseCtx();
    assert(ctx0.buildManualFinalDraftHtml().indexOf('mfd-reuse-load-btn') === -1, 'R-U0. 複製元 Draft（Final Draft 以外）には Evidence 再利用を表示しない');
    assert(await ctx0.mfdReuseLoadSourceEvidence() === null && ctx0.__calls.length === 0, 'R-U0b. Final Draft 以外では読み込まない（通信 0）');

    const { ctx, target } = await reuseLoaded();
    const srcBefore = JSON.stringify(ctx.__rows[SRC]);
    const ceBefore = ceSnapshot(ctx);
    assert(ctx.__calls.length === 1 && ctx.__calls[0].method === 'GET' && ctx.__calls[0].url.indexOf('outputId=' + SRC) !== -1, 'R-U1. 読み込みは複製元 row の GET 1件だけ（Evidence Search / AI なし）');
    assert(ctx._mfdReuse.status === 'loaded' && ctx._mfdReuse.targetOutputId === target && ctx._mfdReuse.sourceOutputId === SRC, 'R-U2. 対象は Final Draft・複製元は read-only 参照');
    const html = ctx.buildManualFinalDraftHtml();
    assert(html.indexOf('元DraftのEvidenceを使用（検索なし）') !== -1 && html.indexOf('id="mfd-reuse-submit-btn"') !== -1, 'R-U3. 「元DraftのEvidenceを使用（検索なし）」欄と確定ボタンを表示');
    assert(REUSE_CLAIMS.every(function (c) { return html.indexOf('id="mfd-reuse-claim-' + c.id + '"') !== -1 && html.indexOf(c.q) !== -1; }), 'R-U4. Claim ごとに Formal question（表示）と claim 文言の編集欄');
    assert(!/<(textarea|input)[^>]*(question|excerpt)/i.test(html) && REUSE_CLAIMS.every(function (c) { return html.indexOf('>' + c.ex[0] + '<') !== -1; }), 'R-U5. Formal question / 原文は入力欄ではなく読み取り専用の表示');
    assert((html.match(/id="mfd-reuse-confirm-\d+"/g) || []).length === 6 && !/id="mfd-reuse-confirm-\d+" checked/.test(html) && html.indexOf('id="mfd-reuse-confirm"') === -1, 'R-U6. 再確認チェックは user_verified Evidence 1件ごと（6件）・初期は未チェック・一括チェックなし');
    assert(html.indexOf('Independent Publisher Preflight：PASS') !== -1, 'R-U7. Independent Publisher Preflight（既存純関数）の結果を表示');

    // 再確認チェックなし → 送らない
    setReuseDom(ctx, null, false);
    ctx.__calls.length = 0;
    const r0 = await ctx.mfdReuseSubmit();
    assert(r0.error === 'reuse_confirmation_required' && ctx.__calls.length === 0, 'R-U8. 再確認チェックが無ければ送信しない（通信 0）');

    // claim 文言を編集して確定
    setReuseDom(ctx, { 'CI-01': '日焼け止めは2時間おきに塗り直すのが目安' }, true);
    const r = await ctx.mfdReuseSubmit();
    const posts = ctx.__posts;
    assert(r.ok === true && posts.length === 1, 'R-U9. server の既存 Resolution が成立（POST 1回）');
    const gets = ctx.__calls.filter(function (c) { return c.method === 'GET'; }).map(function (c) { return c.url; });
    assert(gets.length === 3 && gets[0].indexOf('outputId=' + SRC) !== -1 && gets[1].indexOf('outputId=' + target) !== -1 && gets[2].indexOf('outputId=' + target) !== -1 && ctx.__calls[3].method === 'POST', 'R-U10. POST 直前に 複製元 → Final Draft（content_type・canonical）の順で再GET');
    const body = posts[0].body;
    assert(posts[0].url === '/api/output-drafts' && body.outputId === target && body.caseId === CASE, 'R-U11. 送信先は既存 POST /api/output-drafts・outputId は Final Draft');
    assert(body.resolutionMode === 'full_replace' && body.expectedRevision === null && JSON.stringify(body.targetClaimIds) === JSON.stringify(['CI-01', 'CI-02', 'CI-03']), 'R-U12. new scope：full_replace・expectedRevision null・targetClaimIds = 複製元 Claim ID');
    assert(!('contentEvidence' in body) && !('contentClaims' in body) && !('contentEvidence' in body.fields) && !('contentClaims' in body.fields), 'R-U13. canonical をコピーして送らない（raw candidate のみ）');
    const t = ctx.__rows[target];
    assert(t.content_evidence.length === 6 && t.content_claims.length === 3 && t.content_claims.every(function (c) { return c.status === 'grounded'; }), 'R-U14. Final Draft の canonical は server が再生成（Evidence 6 / Claim 3・grounded）');
    assert(t.content_claims[0].text === '日焼け止めは2時間おきに塗り直すのが目安' && t.content_claims[1].text === REUSE_CLAIMS[1].text, 'R-U15. 編集した claim 文言が server 判定を経て反映');
    assert(t.content_evidence.every(function (e, i) { const s = JSON.parse(srcBefore).content_evidence[i]; return e.claim === s.claim && e.sourceExcerpt === s.sourceExcerpt && e.verificationStatus === 'user_verified' && e.caseId === CASE; }), 'R-U16. Formal question / 原文は不変・user_verified は server が付与');
    assert(t.content_evidence_origin.previousRevision === null && /^rev-[0-9a-f]{32}$/.test(t.content_evidence_origin.revision) && t.content_evidence_origin.revision !== JSON.parse(srcBefore).content_evidence_origin.revision, 'R-U17. Final Draft は新しい revision（複製元 revision を持ち込まない）');
    assert(JSON.stringify(ctx.__rows[SRC]) === srcBefore && posts.every(function (p) { return p.body.outputId !== SRC; }), 'R-U18. 複製元 row は不変・複製元への POST 0');
    assert(ctx.__stale.length === 1 && ctx.__stale[0].reason === 'resolution_succeeded' && ctx._mfdReuse.status === 'done', 'R-U19. 成功後は再確認を要求（既存 _ceMarkCanonicalStale）');
    assert(ceSnapshot(ctx) === ceBefore, 'R-U20. Content Evidence の candidate / excerpt / Mapping / claim 文言 state を変更しない');
    const doneHtml = ctx.buildManualFinalDraftHtml();
    assert(doneHtml.indexOf('Evidence 6') !== -1 && doneHtml.indexOf('Claim 3') !== -1 && doneHtml.indexOf('id="mfd-reuse-submit-btn"') === -1, 'R-U21. 結果（server 確定件数）を表示し、確定ボタンは出さない');

    // 送信後の再送は不可
    const n = ctx.__posts.length;
    const again = await ctx.mfdReuseSubmit();
    assert(again.error === 'reuse_scope_invalid' && ctx.__posts.length === n, 'R-U22. 送信後はそのまま再送しない');
    // 再読み込みしても Final Draft に canonical があれば new scope は送らない
    await ctx.mfdReuseLoadSourceEvidence();
    setReuseDom(ctx, null, true);
    const again2 = await ctx.mfdReuseSubmit();
    assert(again2.error === 'existing_canonical_requires_claim_selection' && ctx.__posts.length === n, 'R-U23. Final Draft に canonical があれば既存契約で停止（二重 full_replace なし）');
  }

  caseHeader('R-S. stale / 失敗時の停止（自動 retry なし）');
  {
    // 複製元の canonical が読み込み後に変化
    const a = await reuseLoaded();
    a.ctx.__rows[SRC].content_evidence_origin = Object.assign({}, a.ctx.__rows[SRC].content_evidence_origin, { revision: 'rev-' + 'b'.repeat(32) });
    setReuseDom(a.ctx, null, true);
    const ra = await a.ctx.mfdReuseSubmit();
    assert(ra.error === 'source_canonical_changed' && a.ctx.__posts.length === 0 && a.ctx._mfdReuse.status === 'stale', 'R-S1. 複製元 revision が変われば送信しない（stale）');

    // Final Draft が未保存
    const b = await reuseLoaded({ skipTargetSave: true });
    setReuseDom(b.ctx, null, true);
    const rb = await b.ctx.mfdReuseSubmit();
    assert(rb.error === 'canonical_row_not_found' && b.ctx.__posts.length === 0, 'R-S2. Final Draft が保存されていなければ送信しない');

    // server が拒否（Evidence に無い数字）→ 1回だけ・再送なし・Final Draft canonical 不変
    const c = await reuseLoaded();
    setReuseDom(c.ctx, { 'CI-02': '顔全体でパール5粒分が目安' }, true);
    const rc = await c.ctx.mfdReuseSubmit();
    assert(rc.ok === false && rc.error === 'resolution_incomplete' && c.ctx.__posts.length === 1, 'R-S3. server の既存判定で拒否（Evidence に無い数字）・POST は1回だけ');
    assert(c.ctx.__rows[c.target].content_claims === null && c.ctx.__stale.length === 0 && c.ctx._mfdReuse.status === 'done', 'R-S4. 拒否時は Final Draft canonical 不変・自動再送なし');

    // 409 canonical_revision_conflict → retry しない
    const d = await reuseLoaded();
    d.ctx.__serverOpts.forceConflict = true;
    setReuseDom(d.ctx, null, true);
    const rd = await d.ctx.mfdReuseSubmit();
    assert(rd.error === 'canonical_revision_conflict' && d.ctx.__posts.length === 1 && d.ctx.__stale.length === 1 && d.ctx.__stale[0].reason === 'canonical_revision_conflict', 'R-S5. 409 は自動 retry せず stale 扱い');

    // 連打（同時2回）→ POST 1回
    const e = await reuseLoaded();
    setReuseDom(e.ctx, null, true);
    const both = await Promise.all([e.ctx.mfdReuseSubmit(), e.ctx.mfdReuseSubmit()]);
    assert(e.ctx.__posts.length === 1 && both.some(function (x) { return x.error === 'submit_in_flight'; }), 'R-S6. 連打しても POST は1回');

    // Independent Publisher 不足（同一 publisher のみ）→ 送らない
    const f = await reuseLoaded({ sourceRow: (function () {
      const row = reuseSourceRow();
      row.content_evidence.forEach(function (ev) { ev.sourceUrl = 'https://www.jcia.org/' + ev.evidenceId; ev.sourceName = '日本化粧品工業会'; });
      return row;
    })() });
    setReuseDom(f.ctx, null, true);
    const fHtml = f.ctx.buildManualFinalDraftHtml();
    const rf = await f.ctx.mfdReuseSubmit();
    assert(rf.error === 'independent_publisher_preflight_failed' && f.ctx.__calls.filter(function (x) { return x.method === 'POST'; }).length === 0, 'R-S7. Independent Publisher Preflight FAIL は送信しない');
    assert(fHtml.indexOf('Preflight：FAIL') !== -1 && /id="mfd-reuse-submit-btn"[^>]*disabled/.test(fHtml), 'R-S8. FAIL を表示し確定ボタンを無効化');

    // 判定部品が無い → fail-closed
    const g = await reuseLoaded({ noPlanning: true });
    setReuseDom(g.ctx, null, true);
    const rg = await g.ctx.mfdReuseSubmit();
    assert(rg.error === 'independent_publisher_preflight_failed' && g.ctx.__posts.length === 0, 'R-S9. Preflight 部品が無ければ fail-closed');

    // 未許可 method（manual_user_input）を含む複製元 → 読み込み段階で停止（POST 0）
    const h = await reuseLoaded({ sourceRow: (function () { const row = reuseSourceRow(); row.content_evidence[3].sourceMethod = 'manual_user_input'; return row; })() });
    assert(h.ctx._mfdReuse.status === 'error' && h.ctx._mfdReuse.error === 'source_evidence_method_not_allowed' && h.ctx.buildManualFinalDraftHtml().indexOf('mfd-reuse-submit-btn') === -1 && h.ctx.__posts.length === 0, 'R-S10. 未許可 method の Evidence を含む複製元は使用不可（確定ボタンなし・POST 0）');
    // 一部だけ再確認 → 送らない
    const i2 = await reuseLoaded();
    setReuseDom(i2.ctx, null, 5);
    i2.ctx.__calls.length = 0;
    const ri = await i2.ctx.mfdReuseSubmit();
    assert(ri.error === 'reuse_confirmation_required' && i2.ctx.__calls.length === 0, 'R-S11. user_verified を1件でも未確認なら送信しない（通信 0）');
    // Final Draft の content_type が違う → 送らない
    const j2 = await reuseLoaded();
    j2.ctx.__rows[j2.target].content_type = 'promo';
    setReuseDom(j2.ctx, null, true);
    const rj = await j2.ctx.mfdReuseSubmit();
    assert(rj.error === 'target_content_type_mismatch' && j2.ctx.__posts.length === 0, 'R-S12. Final Draft の content_type が value でなければ送信しない');
  }

  caseHeader('M. Mixed Evidence（Trial 同型：jcia.org user_verified + env.go.jp web_retrieved）');
  {
    const srcRowT = trialSourceRow();
    const srcEv = srcRowT.content_evidence;
    assert(srcEv.length === 6 && srcRowT.content_claims.length === 3 && srcEv.filter(function (e) { return e.sourceMethod === 'web_retrieved' && e.verificationStatus === 'verified' && !e.sourceExcerpt; }).length === 3 && srcEv.filter(function (e) { return e.verificationStatus === 'user_verified'; }).length === 3, 'M-0. fixture は Trial と同型（Evidence 6 = user_verified 3 + web_retrieved/verified・原文なし 3 ／ Claim 3）');

    const ctx0 = buildReuseCtx({ sourceRow: srcRowT });
    const p = ctx0.buildMfdEvidenceReusePlan(srcRowT, CASE, SRC);
    assert(p.ok === true && p.userVerifiedCount === 3 && p.webRetrievedCount === 3, 'M-A/B. user_verified と web_retrieved の混在を許可（全件 user_verified でなくても成立）');
    assert(p.evidence.filter(function (e) { return e.kind === 'web_retrieved'; }).every(function (e) { return e.sourceExcerpt === undefined; }), 'M-C. web_retrieved は原文なしでも許可');
    function mutT(fn) { const r = JSON.parse(JSON.stringify(srcRowT)); fn(r); return ctx0.buildMfdEvidenceReusePlan(r, CASE, SRC).error; }
    const uvIdx = srcEv.findIndex(function (e) { return e.verificationStatus === 'user_verified'; });
    const webIdx = srcEv.findIndex(function (e) { return e.sourceMethod === 'web_retrieved'; });
    assert(mutT(function (r) { r.content_evidence[uvIdx].sourceExcerpt = ''; }) === 'source_evidence_excerpt_missing', 'M-F. user_verified は原文必須');
    assert(mutT(function (r) { r.content_evidence[webIdx].sourceMethod = 'scraped_unknown'; }) === 'source_evidence_method_not_allowed', 'M-H. 未知の sourceMethod は FAIL');
    assert(mutT(function (r) { r.content_evidence[webIdx].sourceMethod = 'manual_user_input'; }) === 'source_evidence_method_not_allowed', 'M-I. manual_user_input 等の未許可 method は FAIL');
    assert(mutT(function (r) { r.content_evidence[webIdx].supportType = 'contradicts'; }) === 'source_evidence_not_supports', 'M-J. web_retrieved でも反証（contradicts）は FAIL');
    assert(mutT(function (r) { r.content_evidence[webIdx].claimId = 'CI-99'; }) === 'source_evidence_without_claim', 'M-K. orphan Evidence は FAIL');
    assert(mutT(function (r) { r.content_evidence[webIdx].caseId = 'case-other'; }) === 'source_evidence_case_mismatch', 'M-L. 別 case の Evidence は FAIL');
    assert(mutT(function (r) { r.content_evidence[webIdx].sourceUrl = 'ftp://www.env.go.jp/x'; }) === 'source_evidence_url_invalid', 'M-L2. web_retrieved も http / https URL 必須');

    const pre = ctx0._mfdReusePreflight(p);
    assert(pre.status === 'pass' && ['CI-01', 'CI-02', 'CI-03'].every(function (id) { return pre.byIntent[id].independentPublisherCount === 2 && pre.byIntent[id].status === 'pass'; }), 'M-M. Independent Publisher = 2（jcia.org + env.go.jp）で B-2 PASS');

    const texts = { 'CI-01': TRIAL_CLAIMS[0].text, 'CI-02': CI02_NEW, 'CI-03': CI03_NEW };
    const b = ctx0.buildMfdEvidenceReuseCandidates(p, CASE, texts);
    const webC = b.candidates.filter(function (c) { return c.candidate.sourceUrl.indexOf('env.go.jp') !== -1; });
    const uvC = b.candidates.filter(function (c) { return c.candidate.sourceUrl.indexOf('jcia.org') !== -1; });
    assert(webC.length === 3 && webC.every(function (c) { return c.candidate.sourceMethod === 'web_retrieved' && c.candidate.createdBy === 'system' && !('verificationStatus' in c.mappingDecision) && c.candidate.sourceExcerpt === undefined; }), 'M-D. web_retrieved は web_retrieved のまま（user_verified へ変換しない・verified を送らない）');
    assert(uvC.length === 3 && uvC.every(function (c) { return c.candidate.sourceMethod === 'public_document_user_verified' && c.candidate.createdBy === 'user' && c.mappingDecision.verificationStatus === 'user_verified' && !!c.candidate.sourceExcerpt; }), 'M-D2. user_verified は既存 Contract どおり（原文を保持）');
    assert(b.candidates.every(function (c, i) { return c.question === srcEv[i].claim && c.candidate.sourceUrl === srcEv[i].sourceUrl && c.candidate.sourceTitle === srcEv[i].sourceTitle && c.mappingDecision.supportType === 'supports' && c.claimTypeCandidate === 'general_practice' && c.topic === srcEv[i].topic; }), 'M-D3. Formal question / topic / claimType / URL / title / supportType を保持');
    const flat = JSON.stringify(b.candidates);
    assert(!/"verificationStatus":"verified"|"grounded"|"status"|"reliability"|"revision"/.test(flat), 'M-O. payload で verified / grounded / status を捏造しない');

    // UI: 複製 → 読み込み → user_verified 3件だけ再確認 → CI-02 / CI-03 変更 → 送信
    const { ctx, target } = await reuseLoaded({ sourceRow: srcRowT });
    const srcBefore = JSON.stringify(ctx.__rows[SRC]);
    const html = ctx.buildManualFinalDraftHtml();
    const plan = ctx._mfdReuse.plan;
    const uvIdxs = plan.evidence.map(function (e, i) { return e.kind === 'user_verified' ? i : -1; }).filter(function (i) { return i >= 0; });
    const webIdxs = plan.evidence.map(function (e, i) { return e.kind === 'web_retrieved' ? i : -1; }).filter(function (i) { return i >= 0; });
    assert((html.match(/原文確認済み<\/strong>/g) || []).length === 3 && (html.match(/Web取得（原文なし・serverが再判定）/g) || []).length === 3, 'M-UI1. jcia は「原文確認済み」、env.go.jp は「Web取得（原文なし・serverが再判定）」と区別して表示');
    assert(uvIdxs.every(function (i) { return html.indexOf('id="mfd-reuse-confirm-' + i + '"') !== -1; }) && webIdxs.every(function (i) { return html.indexOf('id="mfd-reuse-confirm-' + i + '"') === -1; }), 'M-E. 再確認チェックは user_verified 3件だけ（web_retrieved には要求しない）');
    assert(html.indexOf('前回の server 判定：verified') !== -1 && html.indexOf('Independent Publisher Preflight：PASS') !== -1, 'M-UI2. web_retrieved は前回判定を参考表示（送信しない）・B-2 PASS 表示');

    setReuseDom(ctx, { 'CI-02': CI02_NEW, 'CI-03': CI03_NEW }, 2, TRIAL_CLAIMS);
    ctx.__calls.length = 0;
    const g = await ctx.mfdReuseSubmit();
    assert(g.error === 'reuse_confirmation_required' && ctx.__calls.length === 0, 'M-G. user_verified を3件すべて再確認しなければ送信しない（通信 0）');

    setReuseDom(ctx, { 'CI-02': CI02_NEW, 'CI-03': CI03_NEW }, true, TRIAL_CLAIMS);
    const r = await ctx.mfdReuseSubmit();
    const body = ctx.__posts[0] && ctx.__posts[0].body;
    assert(r.ok === true && ctx.__posts.length === 1 && body.outputId === target && body.resolutionMode === 'full_replace' && body.expectedRevision === null, 'M-P. POST は Final Draft へ1回だけ（new scope・full_replace・expectedRevision null）');
    assert(!/"verificationStatus":"verified"|"grounded"|"status"/.test(JSON.stringify(body.contentEvidenceCandidates)), 'M-O2. 実送信 payload にも verified / grounded / status なし');
    const t = ctx.__rows[target];
    assert(t.content_claims.length === 3 && t.content_claims.every(function (c) { return c.status === 'grounded'; }) && t.content_evidence.length === 6, 'M-N. server Resolution 後 Claim 3 grounded ／ Evidence 6');
    assert(t.content_evidence.filter(function (e) { return e.sourceMethod === 'web_retrieved'; }).every(function (e) { return e.verificationStatus === 'verified'; }) && t.content_evidence.filter(function (e) { return e.sourceMethod === 'public_document_user_verified'; }).every(function (e) { return e.verificationStatus === 'user_verified'; }), 'M-N2. web_retrieved は既存 server 判定で verified に再昇格・user_verified は維持');
    assert(t.content_claims[0].text === TRIAL_CLAIMS[0].text && t.content_claims[1].text === CI02_NEW && t.content_claims[2].text === CI03_NEW, 'M-UPD. CI-01 変更なし・CI-02 / CI-03 は更新文で grounded');
    assert(!/3段階|PA\+\+\+|＋＋＋/.test(t.content_claims.map(function (c) { return c.text; }).join('')), 'M-UPD2. PA 旧3段階記述なし');
    assert(JSON.stringify(ctx.__rows[SRC]) === srcBefore, 'M-R. source Draft 不変');
    assert(ctx.__posts.every(function (x) { return x.body.outputId === target; }) && Object.keys(ctx.__rows).length === 2, 'M-S. 更新されたのは target Final Draft だけ');
    assert(ctx.__calls.every(function (c) { return c.url.indexOf('/api/output-drafts') === 0; }), 'M-T/U. Evidence Search 0 ／ AI API 0（通信は /api/output-drafts のみ）');
    const n = ctx.__posts.length;
    await ctx.mfdReuseSubmit();
    assert(ctx.__posts.length === n, 'M-Q. 送信後に自動 retry・再送なし');

    // server が拒否する場合も1回だけ（409）
    const q = await reuseLoaded({ sourceRow: trialSourceRow() });
    q.ctx.__serverOpts.forceConflict = true;
    setReuseDom(q.ctx, null, true, TRIAL_CLAIMS);
    const rq = await q.ctx.mfdReuseSubmit();
    assert(rq.error === 'canonical_revision_conflict' && q.ctx.__posts.length === 1 && q.ctx.__rows[q.target].content_claims === null, 'M-Q2. 409 でも retry せず Final Draft canonical 不変');
  }

  caseHeader('Static. AI / Evidence / Resolution 非接触');
  {
    assert(!/\/api\/(auto-task|chat|consult|evidence\/web-search|leader|strategy)/.test(BLOCK), 'S-1. AI / Evidence Search の API を参照しない（ブロック全体）');
    assert(!/_ce[A-Z][A-Za-z]*\s*=|_ceSubmitEvidenceForResolution|_ceApproveAndExecute/.test(BASE), 'S-2. 複製 / 手動編集は Content Evidence の state / Resolution / 検索を操作しない');
    assert(!/method:\s*'POST'/.test(BASE), 'S-3. 複製 / 手動編集は直接 POST しない（保存は既存 pushOutputDraftToServer のみ）');
    assert((REUSE.match(/method:\s*'POST'/g) || []).length === 1 && (REUSE.match(/fetch\(/g) || []).length === 3 && (REUSE.match(/fetch\('\/api\/output-drafts\?caseId=/g) || []).length === 2 && REUSE.indexOf("fetch('/api/output-drafts',") !== -1, 'R-SS1. Evidence 再利用の POST は既存 /api/output-drafts への1箇所だけ');
    assert(!/_ce[A-Z][A-Za-z]*\s*=(?!=)/.test(REUSE), 'R-SS2. Evidence 再利用も Content Evidence の state へ代入しない');
    assert(!/_ceSubmitEvidenceForResolution|_ceApproveAndExecute|_ceBuildPlan|_ceStartPlan|web-search|webSearch/.test(REUSE), 'R-SS3. Evidence Search / 既存 Plan / 承認実行を呼ばない');
    assert(!/localStorage|sessionStorage|setTimeout|setInterval/.test(REUSE), 'R-SS4. 永続化・自動再送タイマーなし');
    assert(!/mfd-reuse-(question|excerpt)/.test(REUSE), 'R-SS5. Formal question / 原文の入力欄を作らない');
    assert(/_ceFetchCanonicalState\(/.test(REUSE) && /_ceDecideResolutionContract\(/.test(REUSE) && /evaluateIndependentPublisherPreflight/.test(REUSE), 'R-SS6. 既存 _ceFetchCanonicalState / _ceDecideResolutionContract / evaluateIndependentPublisherPreflight で検査');
  }

  caseHeader('P. Protected 10件 hash 不変');
  {
    const after = hashProtected();
    assert(PROTECTED_FILES.every(function (f) { return protectedBefore[f] === PROTECTED_BASELINE[f] && after[f] === PROTECTED_BASELINE[f]; }), 'P-1. Protected 10件の hash が開始時・終了時とも baseline 一致');
    assert(violations.length === 0, 'P-2. sandbox 違反 0');
  }

  console.log('\n────────────────────────────────────────────────────────────');
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exit(1); }
  console.log('🟢 All manual final draft cases passed');
})().catch(function (e) { console.log('❌ unexpected error: ' + (e && e.stack || e)); process.exit(1); });
