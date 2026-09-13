// shared/contentEvidenceApproval.js
// CV-4c-3: Content Evidence Approval state machine（純関数・依存ゼロ）。
//
//   目的: 「Auto Task実行／Writer実行／Output Draft保存／Case開始」のいずれも
//         Web Evidence取得の承認として扱わない。Web Search実行には常に独立した
//         明示承認（ユーザーによるボタン操作）が必須であることを、状態機械として
//         コード上で強制する。
//
//   責務:
//     - approval state の列挙・有効な遷移のみを許可する状態機械
//     - 「どのイベントが自動実行の引き金になってはいけないか」の明示的allowlist
//       （NO_AUTO_TRIGGER_EVENTS）と判定関数
//     - 同一 plan の二重実行防止（plan fingerprint）
//     - 「承認ボタンを押してよいか / disabled にすべきか」の判定
//     - retry は failed 状態からのみ許可（自動retryを起こさせない）
//
//   非責務:
//     - 実際の DOM 操作・実際の fetch() 呼び出し（呼び出すかどうかの判定のみを提供する）
//     - Claim Intent / Evidence の内容判定（shared/contentClaimPlanning.js の責務）
//     - localStorage への永続化そのもの（Part O: reload時の安全側動作は呼び出し側が
//       このモジュールの初期状態 'idle' から必ず再開させることで実現する）
//
//   determinism: 純関数。乱数なし・時刻依存なし・外部 I/O なし。
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  } else {
    root.ContentEvidenceApproval = api;
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var VERSION = '1.0.0';

  // ══════════════════════════════════════════════════════════════
  // Part A: Approval state
  //   ★ 'approved' は「Web Evidence取得を1回だけ許可する」という意味のみ。
  //     Publishing Approval / Mobile Approval / User Approval とは別の独立した
  //     approval domain であり、混同・流用しない。
  // ══════════════════════════════════════════════════════════════
  var APPROVAL_STATE_VALUES = Object.freeze([
    'idle', 'planned', 'awaiting_approval', 'approved', 'executing', 'completed', 'failed', 'cancelled',
  ]);

  // event → 許可される (from -> to) 遷移のみを列挙する（allowlist）。
  //   ★ 'approve' イベントは awaiting_approval からのみ受理する。
  //   ★ 'retry' イベントは failed からのみ受理する（自動retryの経路自体を作らない）。
  var TRANSITIONS = Object.freeze({
    build_plan:        Object.freeze({ from: ['idle', 'cancelled', 'completed', 'failed'], to: 'planned' }),
    show_for_approval: Object.freeze({ from: ['planned'], to: 'awaiting_approval' }),
    approve:           Object.freeze({ from: ['awaiting_approval'], to: 'approved' }),
    cancel:            Object.freeze({ from: ['planned', 'awaiting_approval'], to: 'cancelled' }),
    execution_start:   Object.freeze({ from: ['approved'], to: 'executing' }),
    execution_success: Object.freeze({ from: ['executing'], to: 'completed' }),
    execution_failure: Object.freeze({ from: ['executing'], to: 'failed' }),
    retry:             Object.freeze({ from: ['failed'], to: 'awaiting_approval' }),   // ★ 自動実行ではなく再承認要求へ戻すだけ
  });

  function canTransition(fromState, event) {
    var t = TRANSITIONS[event];
    if (!t) return false;
    return t.from.indexOf(fromState) !== -1;
  }

  // 戻り値: { ok, state, error }。ok:false のとき state は変化しない（呼び出し側の現状態を保持）。
  function transition(currentState, event) {
    if (APPROVAL_STATE_VALUES.indexOf(currentState) === -1) {
      return { ok: false, state: currentState, error: 'invalid_current_state' };
    }
    if (!canTransition(currentState, event)) {
      return { ok: false, state: currentState, error: 'invalid_transition:' + currentState + '->' + event };
    }
    return { ok: true, state: TRANSITIONS[event].to, error: null };
  }

  // ══════════════════════════════════════════════════════════════
  // Part C/実行ゲート: 「approved から executing へ移る瞬間」だけが
  //   POST /api/evidence/web-search を呼んでよい唯一の入口であることを表す。
  // ══════════════════════════════════════════════════════════════
  function canExecuteWebSearch(state) {
    return state === 'approved';
  }

  function shouldDisableApprovalButton(state) {
    // executing 中は連打防止のため disabled。completed/cancelled は既に完了/中止済みのため
    //   同じボタンでの再実行は許可しない（別の plan を build_plan からやり直す）。
    return state === 'executing' || state === 'completed' || state === 'cancelled';
  }

  function canRetry(state) {
    return state === 'failed';   // ★ failed 以外からの retry は許可しない・自動retryもしない
  }

  // ══════════════════════════════════════════════════════════════
  // Part P: No silent execution — 以下のイベント名では絶対に Web Search を実行しない。
  //   呼び出し側（index.html）は、これらのイベントハンドラ内で
  //   本モジュールの execution_start / canExecuteWebSearch を一切呼ばないこと。
  //   このリストはテストが「イベント名が网羅されているか」を検証するための契約。
  // ══════════════════════════════════════════════════════════════
  var NO_AUTO_TRIGGER_EVENTS = Object.freeze([
    'page_load',
    'login_success',
    'case_load',
    'output_draft_restore',
    'auto_task_dispatch',
    'writer_dispatch',
    'leader_dispatch',
    'strategy_dispatch',
    'reviewer_dispatch',
    'output_draft_save',
  ]);

  function isAutoTriggerEvent(eventName) {
    return NO_AUTO_TRIGGER_EVENTS.indexOf(eventName) !== -1;
  }

  // ══════════════════════════════════════════════════════════════
  // 二重実行防止: plan fingerprint（queries配列の内容から決定論的に導出）。
  //   同一fingerprintに対し既に completed/executing の実行があれば、再実行を防ぐ。
  // ══════════════════════════════════════════════════════════════
  function computePlanFingerprint(queries) {
    var arr = Array.isArray(queries) ? queries : [];
    var normalized = arr.map(function (q) {
      return (q && q.intentId || '') + '|' + (q && q.category || '') + '|' + (q && q.query || '');
    }).sort();
    return normalized.join('::');
  }

  // executedFingerprints: 既に execution_start した fingerprint の Set 相当（配列で受け取る）。
  function isDuplicateExecution(fingerprint, executedFingerprints) {
    var arr = Array.isArray(executedFingerprints) ? executedFingerprints : [];
    return arr.indexOf(fingerprint) !== -1;
  }

  // ══════════════════════════════════════════════════════════════
  // Part O: reload時の安全側動作。
  //   ★ localStorage 等から復元した状態が 'approved' や 'executing' であっても、
  //     server側の canonical な実行記録が無い限り、reload後は必ず 'idle'（要再承認）
  //     として扱う（approved/executing を承認済みとして信用しない）。
  // ══════════════════════════════════════════════════════════════
  var STATES_UNSAFE_TO_RESTORE = Object.freeze(['approved', 'executing']);

  function sanitizeRestoredState(restoredState) {
    if (APPROVAL_STATE_VALUES.indexOf(restoredState) === -1) return 'idle';
    if (STATES_UNSAFE_TO_RESTORE.indexOf(restoredState) !== -1) return 'idle';
    // planned / awaiting_approval / failed / cancelled / completed は再表示してよいが、
    //   'awaiting_approval' として復元しても、承認は再度明示的に行う必要がある
    //   （このモジュールはボタン操作なしで approved へは絶対に進めない）。
    return restoredState;
  }

  return {
    version: VERSION,
    APPROVAL_STATE_VALUES: APPROVAL_STATE_VALUES,
    TRANSITIONS: TRANSITIONS,
    canTransition: canTransition,
    transition: transition,
    canExecuteWebSearch: canExecuteWebSearch,
    shouldDisableApprovalButton: shouldDisableApprovalButton,
    canRetry: canRetry,
    NO_AUTO_TRIGGER_EVENTS: NO_AUTO_TRIGGER_EVENTS,
    isAutoTriggerEvent: isAutoTriggerEvent,
    computePlanFingerprint: computePlanFingerprint,
    isDuplicateExecution: isDuplicateExecution,
    STATES_UNSAFE_TO_RESTORE: STATES_UNSAFE_TO_RESTORE,
    sanitizeRestoredState: sanitizeRestoredState,
  };
});
