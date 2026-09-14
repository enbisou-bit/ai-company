'use strict';
// contentEvidenceWriterContext.test.js
// CV-4c-3B: Server Writer Grounding Helper + 3 Writer route統合の deterministic テスト（Part O）。
//
//   実HTTP 0 / 実AI API 0 / 実DB 0 / 実Web Evidence 0。
//   buildContentEvidenceContextForCase() は server.js のソースから抽出し、
//   getOutputDraftsDb() のみ fake 注入して実行する（require は本ファイル自身のものを使うため
//   shared/contentEvidence.js 等への相対解決は server.js と同一に機能する）。

const fs = require('fs');
const path = require('path');
const vm = require('vm');

let _passed = 0, _failed = 0;
function assert(cond, label) {
  if (cond) { _passed++; console.log('  ✅ ' + label); }
  else { _failed++; console.log('  ❌ ' + label); }
}
function caseHeader(t) { console.log('\n── ' + t + ' ──'); }

const serverSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

// ── buildContentEvidenceContextForCase() をserver.jsソースから抽出しevalする ──
const fnStart = serverSrc.indexOf('async function buildContentEvidenceContextForCase');
const fnEnd = serverSrc.indexOf('\n// Option B: client側で構築済みの');
if (fnStart === -1 || fnEnd === -1) throw new Error('buildContentEvidenceContextForCase not found (marker mismatch)');
const fnSrc = serverSrc.slice(fnStart, fnEnd);

function buildSandbox(fakeDraft) {
  const sandbox = { require: require, console: console };
  vm.createContext(sandbox);
  vm.runInContext(fnSrc, sandbox);
  sandbox.getOutputDraftsDb = function () {
    return { getOutputDraft: async function () { return { draft: fakeDraft, source: 'db' }; } };
  };
  return sandbox;
}

const CASE_ID = 'case-x';

(async () => {
  console.log('\n=== contentEvidenceWriterContext.test.js (CV-4c-3B Part O) ===');

  // ══════════════════════════════════════════════════════════════
  caseHeader('35. saved canonical Evidenceあり → ■ Content Evidence生成');
  {
    const draft = {
      caseId: CASE_ID,
      fields: {
        contentClaims: [{ claimId: 'i1', text: '洗顔後は5分以内に保湿すると乾燥を防ぎやすくなります。', claimType: 'general_practice', topic: '保湿', status: 'grounded' }],
        contentEvidence: [
          { evidenceId: 'ev-1', caseId: CASE_ID, claimId: 'i1', claim: '保湿', claimType: 'general_practice', supportType: 'supports', sourceMethod: 'web_retrieved', verificationStatus: 'verified', reliability: 'high', retrievedAt: '2026-09-14T00:00:00.000Z', recordedAt: '2026-09-14T00:00:00.000Z', createdBy: 'system', sourceUrl: 'https://www.mhlw.go.jp/a', sourceTitle: 't1' },
        ],
      },
    };
    const sandbox = buildSandbox(draft);
    const text = await sandbox.buildContentEvidenceContextForCase(CASE_ID);
    assert(text.indexOf('■ Content Evidence') === 0, '35. 保存済みcanonical Evidenceがあれば■ Content Evidence sectionが生成される');
    assert(text.indexOf('洗顔後は5分以内に保湿すると乾燥を防ぎやすくなります。') !== -1, '35b. claim文言が含まれる');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('36. Evidence無し → section無し');
  {
    const draft = { caseId: CASE_ID, fields: { slides: ['x'] } };
    const sandbox = buildSandbox(draft);
    const text = await sandbox.buildContentEvidenceContextForCase(CASE_ID);
    assert(text === '', '36. contentClaimsが無いcaseはgrounding section無し（空文字）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('37. invalid saved Evidence → fail-closed section無し');
  {
    const draft = {
      caseId: CASE_ID,
      fields: {
        contentClaims: [{ claimId: 'i1', text: 'テストclaim', claimType: 'general_practice', topic: '保湿', status: 'grounded' }],
        contentEvidence: [{ evidenceId: 'ev-broken', caseId: CASE_ID, claimId: 'i1' }], // 必須field欠落＝破損データ
      },
    };
    const sandbox = buildSandbox(draft);
    const text = await sandbox.buildContentEvidenceContextForCase(CASE_ID);
    // claim自体は残るが、紐づくevidenceは無効なので grounding textの中に出典情報は含まれない（"(なし)"扱い）。
    assert(text.indexOf('supports: (なし)') !== -1, '37. ★破損したcontentEvidence recordはvalidateContentEvidenceRecord()で除外される（fail-closed）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('37b. caseId不一致 / draft無し → 空文字');
  {
    const sandboxNoDraft = buildSandbox(null);
    assert(await sandboxNoDraft.buildContentEvidenceContextForCase(CASE_ID) === '', '37b-1. draft自体が無ければ空文字');
    assert(await sandboxNoDraft.buildContentEvidenceContextForCase('') === '', '37b-2. caseId未指定は空文字');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('38〜40. /api/chat・/api/auto-task・/api/consultへのgrounding統合（source確認）');
  {
    const chatStart = serverSrc.indexOf("app.post('/api/chat'");
    const chatEnd = serverSrc.indexOf("app.post('/api/strategy-consolidate'");
    const chatSrc = serverSrc.slice(chatStart, chatEnd);
    assert(chatSrc.indexOf('buildContentEvidenceContextForCase') !== -1, '38. /api/chat が buildContentEvidenceContextForCase() を呼んでいる');

    const autoTaskStart = serverSrc.indexOf("app.post('/api/auto-task'");
    const autoTaskEnd = serverSrc.indexOf("app.post('/api/notification-reads'");
    const autoTaskSrc = serverSrc.slice(autoTaskStart, autoTaskEnd);
    assert(autoTaskSrc.indexOf('buildContentEvidenceContextForCase') !== -1, '39. /api/auto-task が buildContentEvidenceContextForCase() を呼んでいる');

    const consultStart = serverSrc.indexOf("app.post('/api/consult'");
    const consultEnd = serverSrc.indexOf('\n});', serverSrc.indexOf('const consultFn'));
    const consultSrc = serverSrc.slice(consultStart, consultEnd);
    assert(consultSrc.indexOf('buildContentEvidenceContextForCase') !== -1, '40. /api/consult が buildContentEvidenceContextForCase() を呼んでいる');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('41〜43. IADP/APFR保持 / Content Evidence独立');
  {
    const chatStart = serverSrc.indexOf("app.post('/api/chat'");
    const chatEnd = serverSrc.indexOf("app.post('/api/strategy-consolidate'");
    const chatSrc = serverSrc.slice(chatStart, chatEnd);
    assert(chatSrc.indexOf('buildLeaderCaseContext') !== -1, '41. buildLeaderCaseContext()（IADP）は無変更で維持されている');
    assert(chatSrc.indexOf('_mergeCaseContextText') !== -1, '42. _mergeCaseContextText()（APFR/client caseDataContext passthrough）も維持されている');
    // Content Evidence追加は既存のbuildLeaderCaseContext呼び出しの"後"に連結される（独立性）
    const ceCallIdx = chatSrc.indexOf('buildContentEvidenceContextForCase');
    const leaderCallIdx = chatSrc.indexOf('buildLeaderCaseContext');
    assert(leaderCallIdx !== -1 && ceCallIdx !== -1 && leaderCallIdx < ceCallIdx,
      '43. Content Evidence取得はbuildLeaderCaseContext（IADP）の後に独立して追加される（責務分離）');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('44. 通常Writer regression（既存route構造の非破壊確認）');
  {
    assert(serverSrc.indexOf("app.post('/api/chat', require('./lib/webSession').requireSession()") !== -1,
      '44a. /api/chat の既存認証境界（requireSession）は無変更');
    assert(serverSrc.indexOf('!message || typeof message !== ') !== -1, '44b. 既存の入力バリデーションは無変更');
    assert(serverSrc.indexOf('generateReply') !== -1 || serverSrc.indexOf('replyFn') !== -1, '44c. Writer呼び出し本体（generateReply/replyFn）は無変更');
  }

  // ══════════════════════════════════════════════════════════════
  caseHeader('45. WriterからWeb Search 0');
  {
    const chatStart = serverSrc.indexOf("app.post('/api/chat'");
    const chatEnd = serverSrc.indexOf("app.post('/api/strategy-consolidate'");
    const autoTaskStart = serverSrc.indexOf("app.post('/api/auto-task'");
    const autoTaskEnd = serverSrc.indexOf("app.post('/api/notification-reads'");
    const consultStart = serverSrc.indexOf("app.post('/api/consult'");
    const consultEnd = serverSrc.indexOf('\n});', serverSrc.indexOf('const consultFn'));
    [[chatStart, chatEnd], [autoTaskStart, autoTaskEnd], [consultStart, consultEnd]].forEach(function (range, i) {
      const routeSrc = serverSrc.slice(range[0], range[1]);
      assert(routeSrc.indexOf('/api/evidence/web-search') === -1 && routeSrc.indexOf('callOpenAIWebSearch') === -1,
        '45.' + i + ' route内でWeb Search（/api/evidence/web-search・callOpenAIWebSearch）を一切呼ばない');
    });
    // buildContentEvidenceContextForCase自体もWeb Searchを呼ばない
    assert(fnSrc.indexOf('/api/evidence/web-search') === -1 && fnSrc.indexOf('callOpenAIWebSearch') === -1 && fnSrc.indexOf('fetch(') === -1,
      '45b. buildContentEvidenceContextForCase() 自体もWeb Search/外部fetchを一切呼ばない（既存保存データの読み込みのみ）');
  }

  console.log('\n' + '─'.repeat(60));
  console.log('結果: ' + _passed + ' passed / ' + _failed + ' failed');
  if (_failed > 0) { console.log('🔴 FAILED'); process.exitCode = 1; }
  else { console.log('🟢 All contentEvidenceWriterContext cases passed (CV-4c-3B Part O)'); }
})().catch(function (e) { console.error('TEST CRASH:', e && e.stack); process.exitCode = 1; });
