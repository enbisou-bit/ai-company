'use strict';
// lib/dailyProductionConnect.js
// Instagram Daily Production — 計数モードの依存一式を組み立てる接続部（Writer・認可・case 境界・新規保存）。
//
//   createDailyProductionDeps({ mode, writer, spendGate, authorizationStore, caseBoundary, draftClient, computePackHash, evaluateContentValue })
//     → { ok:true, deps }  … runDailyProduction(input, deps) にそのまま渡せる（計数モード）
//     → { ok:false, reason, missing }  … 組み立てない（fail-closed）
//
//   mode:
//     'local_verification' … 偽 HTTP・偽認可（local_fake）・偽 DB での検証用。予算ゲートも local_verification であること。
//     'production'         … 本番の依存がすべて接続済みの場合だけ。現在は永続の認可ストア・case 確認・本番 Draft client が
//                            未接続のため、必ず production_dependency_not_connected で拒否される。
//
//   case 境界（個人の所有権確認ではない）:
//     (a) 指定 case との一致: target.caseId が設定の dailyCaseId と一致する
//     (b) 存在確認        : caseBoundary.caseExists(caseId) が true
//     (c) 認可 case との一致: 認可の target.caseId と一致（dailyProductionService が確認）
//     ★ 現在の認証（lib/webSession.js）は社内共有の合言葉によるアクセス境界であり、個人の識別ではない。
//       そのため「誰の case か」（所有・個人のアクセス権）は保証できない。保証できるのは (a)〜(c) まで。
//
//   ★ require しただけでは通信・秘密の読み込みをしない。outputDraftsDb（lib/supabase.js を読み込む）は保存の時に遅延 require する。

const { createDailyWriterOpenAI } = require('./dailyWriterOpenAI');

const MODES = Object.freeze(['local_verification', 'production']);

function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }

function createDailyProductionDeps(opts) {
  opts = _isPlainObject(opts) ? opts : {};
  const mode = opts.mode;
  if (MODES.indexOf(mode) === -1) return { ok: false, reason: 'mode_not_configured', missing: ['mode'] };

  const missing = [];
  const gate = opts.spendGate;
  const store = opts.authorizationStore;
  const cb = opts.caseBoundary;
  if (!_isPlainObject(gate) || typeof gate.reserve !== 'function') missing.push('spendGate');
  else if (gate.mode !== mode) missing.push('spendGate.mode=' + mode);
  if (!_isPlainObject(store) || typeof store.getAuthorization !== 'function' || typeof store.consume !== 'function') missing.push('authorizationStore');
  if (!_isPlainObject(cb) || !_isNonEmptyString(cb.dailyCaseId) || typeof cb.caseExists !== 'function') missing.push('caseBoundary');
  if (typeof opts.computePackHash !== 'function') missing.push('computePackHash');
  if (typeof opts.evaluateContentValue !== 'function') missing.push('evaluateContentValue');
  if (!opts.draftClient || typeof opts.draftClient.from !== 'function') missing.push('draftClient');

  if (mode === 'production') {
    // 本番では偽物・未接続・非永続の依存を使わない
    if (_isPlainObject(store) && (store.kind === 'local_fake' || store.connected !== true || store.persistent !== true)) missing.push('authorizationStore(persistent)');
    // 永続ストアでも、本番での実証（productionVerified）が無ければ使わない（ローカル検証の成功で本番を有効にしない）
    if (_isPlainObject(store) && store.productionVerified !== true) missing.push('authorizationStore(productionVerified)');
    if (_isPlainObject(cb) && cb.productionVerified !== true) missing.push('caseBoundary(productionVerified)');
    if (_isPlainObject(cb) && cb.kind === 'local_fake') missing.push('caseBoundary(production)');
    if (opts.draftClient && opts.draftClient.kind === 'local_fake') missing.push('draftClient(production)');
  }
  if (missing.length) return { ok: false, reason: mode === 'production' ? 'production_dependency_not_connected' : 'dependency_missing', missing };

  const writer = createDailyWriterOpenAI(_isPlainObject(opts.writer) ? opts.writer : {});
  const we = writer.depsError();
  if (we) return { ok: false, reason: 'writer_not_configured', missing: ['writer:' + we] };

  const deps = {
    computePackHash: opts.computePackHash,
    evaluateContentValue: opts.evaluateContentValue,
    spendGate: gate,
    async authorize({ target }) {
      if (!_isPlainObject(target)) return { authorized: false, reason: 'target_missing' };
      if (target.caseId !== cb.dailyCaseId) return { authorized: false, reason: 'case_not_designated' };
      let exists = false;
      try { exists = (await cb.caseExists(target.caseId)) === true; } catch (e) { return { authorized: false, reason: 'case_check_error' }; }
      if (!exists) return { authorized: false, reason: 'case_not_found' };
      return store.getAuthorization({ target });
    },
    consumeAuthorization: (a) => store.consume(a),
    prepareWriterRequest: (a) => writer.prepare(a),
    verifyPreparedRequest: (a) => writer.verify(a),
    callWriter: (a) => writer.callWriter(a),
    estimateCostFromUsage: (u) => writer.estimateCostFromUsage(u),
    async insertDraftIfAbsent(payload) {
      if (!_isPlainObject(payload) || payload.caseId !== cb.dailyCaseId) return { ok: false, outcome: 'case_not_designated' };
      const { insertOutputDraftIfAbsent } = require('./outputDraftsDb');
      return insertOutputDraftIfAbsent(payload, { client: opts.draftClient });
    },
  };
  return { ok: true, mode, deps };
}

// cases 表で存在を確かめる case 境界（lib/casesDb.getCaseById・client は注入）。
//   取得失敗・結果不明は例外 → authorize は case_check_error（有料経路へ進まない）。productionVerified は false。
function createCaseBoundaryFromDb({ dailyCaseId, client }) {
  if (!_isNonEmptyString(dailyCaseId) || !client || typeof client.from !== 'function') return null;
  return {
    kind: 'cases_table',
    productionVerified: false,
    dailyCaseId,
    async caseExists(caseId) {
      const { getCaseById } = require('./casesDb');
      const r = await getCaseById(caseId, { client });
      if (!_isPlainObject(r) || r.ok !== true) throw new Error('case_lookup_failed');
      return r.exists === true;
    },
  };
}

module.exports = { MODES, createDailyProductionDeps, createCaseBoundaryFromDb };
