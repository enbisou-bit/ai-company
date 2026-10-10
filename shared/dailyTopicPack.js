// shared/dailyTopicPack.js
// Instagram Daily Production — Step 1: テーマ＋根拠パック（Topic Pack）の形式検証（純関数）。
//
//   目的: 日次制作で使う「テーマ＋根拠パック」を、制作に使ってよい状態か判定する。
//         Writer が根拠を後から探して正当化する構造を避け、Human が確認済みの主張だけを
//         制作の入力にするための入口。
//
//   責務:
//     - Topic Pack の schema 検証（テーマID・悩み・中心行動・主張・出典・状態）
//     - 主張ごとの確認状態と、出典の確認記録（URL・該当箇所・確認日・確認範囲・限界・確認者）の検証
//     - 制作可能（productionReady）かどうかの判定と、不可の理由の列挙
//     - 確認済み主張の本文に含まれる数値の抽出（後工程の数値検査で使う）
//
//   非責務（このファイルが絶対にやらないこと）:
//     - URL へのアクセス・Web 検索・AI 呼び出し・DB／Storage への読み書き
//     - 主張の医学的な正しさの判定（Human／Reviewer の責務）
//     - 状態の自動昇格（URL があるだけで verified にしない・入力の status をそのまま読むだけ）
//     - canonical Evidence（output_drafts.content_evidence）への登録・登録済み扱い
//       （今回は未対応。将来の登録経路を否定する契約ではない）
//     - 日付・乱数・環境変数の参照（確認日は形式だけを検査し、現在日時と比較しない）
//
//   ★ パック内の status / verification / verifiedBy は「パックに書かれた申告」にすぎない。
//     本モジュールの productionReady は「申告が形式上そろっている」ことだけを表し、
//     実際に Human が確認したこと・制作を認可したことは表さない（verificationBasis = 'declared_in_pack'）。
//     実際の確認・認可は呼び出し側が別の依存（lib/dailyProductionService の authorizePack）で確かめる。
//     Git に commit されていることも、確認・認可の根拠にしない。
//
//   ★ 入力は変更しない（読み取りのみ）。同じ入力からは常に同じ結果を返す。

(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;                       // CommonJS（Node / server-side / テスト）
  } else if (root) {
    root.DailyTopicPack = api;                  // ブラウザ（window / globalThis）
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var TOPIC_PACK_VERSION = 1;

  // 状態語彙。'human_verified' だけが制作に使える。自動で昇格させる経路は持たない。
  var STATUS = Object.freeze({
    UNVERIFIED: 'unverified',
    HUMAN_VERIFIED: 'human_verified',
    REJECTED: 'rejected',
  });
  var STATUS_VALUES = [STATUS.UNVERIFIED, STATUS.HUMAN_VERIFIED, STATUS.REJECTED];

  // 主張の種類。5枚構成のどのスライドで使えるかは dailyProductionContract が決める。
  var CLAIM_KINDS = ['reason', 'action', 'caution'];

  var TOPIC_ID_RE = /^[a-z0-9][a-z0-9-]{2,63}$/;
  var LOCAL_ID_RE = /^[a-z0-9][a-z0-9_-]{0,31}$/;
  var CHECKED_ON_RE = /^\d{4}-\d{2}-\d{2}$/;
  var URL_RE = /^https:\/\/[^\s/]+\.[^\s/]+(\/\S*)?$/;

  function _isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }
  function _isNonEmptyString(v) { return typeof v === 'string' && v.trim().length > 0; }

  function _issue(code, path, message) { return { code: code, path: path, message: message }; }

  // 全角数字を半角へ寄せ、数値トークン（小数・カンマ区切りを含む）を出現順・重複なしで返す。
  function _normalizeDigits(s) {
    return String(s).replace(/[０-９]/g, function (ch) { return String.fromCharCode(ch.charCodeAt(0) - 0xFEE0); })
      .replace(/[．]/g, '.').replace(/[，]/g, ',');
  }
  function extractNumbers(text) {
    if (typeof text !== 'string') return [];
    var m = _normalizeDigits(text).match(/\d+(?:[.,]\d+)*/g) || [];
    var out = [];
    for (var i = 0; i < m.length; i++) {
      var n = m[i].replace(/,/g, '');
      if (out.indexOf(n) === -1) out.push(n);
    }
    return out;
  }

  // 出典の確認記録を検証する。確認済みと扱うのは verification.status === 'human_verified' かつ
  // 必須項目（URL・該当箇所・確認日・確認範囲・限界・確認者）がすべて揃っている場合だけ。
  function _validateSource(src, path, issues) {
    if (!_isPlainObject(src)) { issues.push(_issue('source_not_object', path, '出典がオブジェクトではありません')); return null; }
    if (!_isNonEmptyString(src.sourceId) || !LOCAL_ID_RE.test(src.sourceId)) issues.push(_issue('invalid_source_id', path + '.sourceId', '出典IDが不正です'));
    if (!_isNonEmptyString(src.url) || !URL_RE.test(src.url)) issues.push(_issue('invalid_source_url', path + '.url', '出典URLが https の形式ではありません'));
    if (!_isNonEmptyString(src.publisher)) issues.push(_issue('missing_source_publisher', path + '.publisher', '発行元がありません'));
    if (!_isNonEmptyString(src.locator)) issues.push(_issue('missing_source_locator', path + '.locator', '該当箇所がありません'));
    if (!_isNonEmptyString(src.checkedOn) || !CHECKED_ON_RE.test(src.checkedOn)) issues.push(_issue('invalid_source_checked_on', path + '.checkedOn', '確認日が YYYY-MM-DD ではありません'));
    if (!_isNonEmptyString(src.scope)) issues.push(_issue('missing_source_scope', path + '.scope', '確認範囲がありません'));
    if (!_isNonEmptyString(src.limitations)) issues.push(_issue('missing_source_limitations', path + '.limitations', '限界がありません'));
    var v = src.verification;
    var vStatus = _isPlainObject(v) ? v.status : undefined;
    if (STATUS_VALUES.indexOf(vStatus) === -1) issues.push(_issue('invalid_source_verification_status', path + '.verification.status', '出典の確認状態が不正です'));
    if (vStatus === STATUS.HUMAN_VERIFIED && !(_isPlainObject(v) && _isNonEmptyString(v.verifiedBy))) {
      issues.push(_issue('missing_source_verified_by', path + '.verification.verifiedBy', '確認者がありません'));
    }
    return vStatus;
  }

  // Topic Pack を検証する。戻り値の productionReady が true のときだけ制作に使える。
  function validateTopicPack(pack) {
    var issues = [];
    var result = {
      ok: false,
      productionReady: false,                 // 申告が形式上そろっているか（実際の確認・認可ではない）
      verificationBasis: 'declared_in_pack',  // 確認状態の根拠は常にパック内の申告
      authorizationVerified: false,           // 本モジュールは認可を確かめない（常に false）
      canonicalEvidenceRegistered: false,     // canonical Evidence 登録は今回未対応（常に false）
      topicId: null,
      issues: issues,
      verifiedClaimIds: [],
      blockedClaimIds: [],
    };
    if (!_isPlainObject(pack)) { issues.push(_issue('pack_not_object', '', 'テーマパックがオブジェクトではありません')); return result; }

    if (pack.version !== TOPIC_PACK_VERSION) issues.push(_issue('unsupported_version', 'version', 'テーマパックの版が未対応です'));
    if (!_isNonEmptyString(pack.topicId) || !TOPIC_ID_RE.test(pack.topicId)) issues.push(_issue('invalid_topic_id', 'topicId', 'テーマIDが不正です'));
    else result.topicId = pack.topicId;
    if (STATUS_VALUES.indexOf(pack.status) === -1) issues.push(_issue('invalid_pack_status', 'status', 'テーマパックの状態が不正です'));
    else if (pack.status !== STATUS.HUMAN_VERIFIED) issues.push(_issue('pack_not_human_verified', 'status', 'テーマパックが Human 確認済みではありません'));
    if (pack.canonicalEvidenceRegistered === true) {
      issues.push(_issue('canonical_registration_not_supported_yet', 'canonicalEvidenceRegistered', 'canonical Evidence 登録済みの申告には今回は未対応です'));
    }

    var concern = pack.concern;
    if (!_isPlainObject(concern) || !_isNonEmptyString(concern.scene)) issues.push(_issue('missing_concern_scene', 'concern.scene', '生活の場面がありません'));
    if (!_isPlainObject(concern) || !_isNonEmptyString(concern.problem)) issues.push(_issue('missing_concern_problem', 'concern.problem', '読者の悩みがありません'));
    if (!_isNonEmptyString(pack.coreAction)) issues.push(_issue('missing_core_action', 'coreAction', '今日の中心行動がありません'));

    // 出典
    var sourceStatus = {};
    var sources = Array.isArray(pack.sources) ? pack.sources : null;
    if (!sources || sources.length === 0) issues.push(_issue('missing_sources', 'sources', '出典がありません'));
    else {
      for (var i = 0; i < sources.length; i++) {
        var sPath = 'sources[' + i + ']';
        var sStatus = _validateSource(sources[i], sPath, issues);
        var sid = _isPlainObject(sources[i]) ? sources[i].sourceId : undefined;
        if (_isNonEmptyString(sid)) {
          if (Object.prototype.hasOwnProperty.call(sourceStatus, sid)) issues.push(_issue('duplicate_source_id', sPath + '.sourceId', '出典IDが重複しています: ' + sid));
          else sourceStatus[sid] = sStatus;
        }
      }
    }

    // 主張
    var claims = Array.isArray(pack.claims) ? pack.claims : null;
    var seenClaim = {};
    if (!claims || claims.length === 0) issues.push(_issue('missing_claims', 'claims', '主張がありません'));
    else {
      for (var j = 0; j < claims.length; j++) {
        var c = claims[j];
        var cPath = 'claims[' + j + ']';
        if (!_isPlainObject(c)) { issues.push(_issue('claim_not_object', cPath, '主張がオブジェクトではありません')); continue; }
        var cid = c.claimId;
        var idOk = _isNonEmptyString(cid) && LOCAL_ID_RE.test(cid);
        if (!idOk) issues.push(_issue('invalid_claim_id', cPath + '.claimId', '主張IDが不正です'));
        else if (Object.prototype.hasOwnProperty.call(seenClaim, cid)) { issues.push(_issue('duplicate_claim_id', cPath + '.claimId', '主張IDが重複しています: ' + cid)); continue; }
        if (idOk) seenClaim[cid] = true;
        if (!_isNonEmptyString(c.text)) issues.push(_issue('missing_claim_text', cPath + '.text', '主張の本文がありません'));
        if (CLAIM_KINDS.indexOf(c.kind) === -1) issues.push(_issue('invalid_claim_kind', cPath + '.kind', '主張の種類が不正です'));
        if (STATUS_VALUES.indexOf(c.status) === -1) issues.push(_issue('invalid_claim_status', cPath + '.status', '主張の状態が不正です'));

        var sids = Array.isArray(c.sourceIds) ? c.sourceIds : [];
        if (sids.length === 0) issues.push(_issue('claim_without_source', cPath + '.sourceIds', '主張に出典がありません'));
        var hasVerifiedSource = false;
        for (var k = 0; k < sids.length; k++) {
          if (!Object.prototype.hasOwnProperty.call(sourceStatus, sids[k])) issues.push(_issue('unknown_source_id', cPath + '.sourceIds[' + k + ']', '存在しない出典IDです: ' + sids[k]));
          else if (sourceStatus[sids[k]] === STATUS.HUMAN_VERIFIED) hasVerifiedSource = true;
        }
        // 主張が確認済みでも、確認済みの出典を1件も持たなければ制作に使わない。
        var usable = idOk && c.status === STATUS.HUMAN_VERIFIED && hasVerifiedSource && _isNonEmptyString(c.text) && CLAIM_KINDS.indexOf(c.kind) !== -1;
        if (idOk) {
          if (usable) result.verifiedClaimIds.push(cid);
          else result.blockedClaimIds.push(cid);
        }
        if (idOk && c.status === STATUS.HUMAN_VERIFIED && !hasVerifiedSource) {
          issues.push(_issue('claim_has_no_verified_source', cPath, '確認済みの出典がない主張です: ' + cid));
        }
      }
    }
    if (claims && result.verifiedClaimIds.length === 0) issues.push(_issue('no_verified_claims', 'claims', '制作に使える確認済みの主張がありません'));

    result.ok = issues.length === 0;
    // 制作可能は「問題0件」かつ「パック・主張・出典がすべて確認済み」のときだけ（部分的な確認では制作しない）。
    result.productionReady = result.ok && result.blockedClaimIds.length === 0;
    if (result.ok && !result.productionReady) {
      issues.push(_issue('unverified_claims_present', 'claims', '未確認の主張が含まれています: ' + result.blockedClaimIds.join(',')));
      result.ok = false;
    }
    return result;
  }

  // 確認済み主張の一覧（制作可能なパックのみ・入力順）。制作可能でなければ空配列。
  function getVerifiedClaims(pack) {
    var v = validateTopicPack(pack);
    if (!v.productionReady) return [];
    return pack.claims.filter(function (c) { return v.verifiedClaimIds.indexOf(c.claimId) !== -1; })
      .map(function (c) { return { claimId: c.claimId, kind: c.kind, text: c.text, sourceIds: c.sourceIds.slice() }; });
  }

  // 確認済み主張の本文に現れる数値（後工程で「根拠パックにない数値」を検出するための許可リスト）。
  function getAllowedNumbers(pack) {
    var out = [];
    getVerifiedClaims(pack).forEach(function (c) {
      extractNumbers(c.text).forEach(function (n) { if (out.indexOf(n) === -1) out.push(n); });
    });
    return out;
  }

  return {
    TOPIC_PACK_VERSION: TOPIC_PACK_VERSION,
    STATUS: STATUS,
    CLAIM_KINDS: CLAIM_KINDS.slice(),
    extractNumbers: extractNumbers,
    validateTopicPack: validateTopicPack,
    getVerifiedClaims: getVerifiedClaims,
    getAllowedNumbers: getAllowedNumbers,
  };
});
