// ══════════════════════════════════════════════════════════════
// shared/agentResultNormalizer.js
// Phase IG-2J-G: AI社員成果物の構造正規化（表示・統合用）
//
// 責務（構造ノイズの除去のみ）:
//   ・AI社員の回答に残る `{"reply":"..."}` wrapper を安全に取り除く。
//   ・```json ... ``` のコードフェンスに包まれたJSON回答を安全に取り除く。
//   ・正規化後に実質的な成果物が存在するか（hasMeaningfulResult）を判定できるようにする。
//
// 非責務（絶対に行わない）:
//   ・内容の要約・再生成・意味の変更・不足内容の推測補完・文章改善。
//   ・スコア／Reviewer判定／採用案／Evidence判定の変更。
//   ・task.status（completed/error/skipped）の書き換え。
//
// 設計原則:
//   ・純粋関数のみ（DOM/Node専用API/Network/グローバル状態なし）。入力を変更しない。
//   ・例外を外へ投げない（fail-open：判断できないものは原文をそのまま返す）。
//   ・「変形してよいと確信できる場合のみ変形する」＝迷ったら原文維持。
//     文章の途中にJSONが含まれるだけのケース、json以外のコードブロック、
//     reply以外の正式構造JSON（{"status":...,"score":...}等）は一切変更しない。
//   ・冪等（normalize(normalize(x)) === normalize(x)）。
// ══════════════════════════════════════════════════════════════
(function (root, factory) {
  var api = factory();
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;                       // CommonJS（Node / openaiClient / 合成テスト）
  } else {
    root.AgentResultNormalizer = api;            // ブラウザ（window / globalThis）
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var NORMALIZER_VERSION = '1.0.0';

  // 二重JSON文字列化への対応回数（汎用recursive parserは作らない＝最大2回まで）
  var MAX_UNWRAP_PASSES = 2;

  function isPlainObject(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  // ── コードフェンスの除去 ────────────────────────────────────
  //   テキスト全体が1つのフェンスで包まれている場合のみ対象にする
  //   （文章の途中にあるコードブロックには一切触れない）。
  //   除去してよいのは「json指定のフェンス」または「中身がreply wrapperとして解釈できるフェンス」だけ。
  //   ``` だけの一般コードブロック（JS・SQL等）は絶対に除去しない。
  var FENCE_RE = /^```([A-Za-z0-9_+-]*)[ \t]*\r?\n([\s\S]*?)\r?\n?```$/;

  // 未閉じフェンス（開始 ```json はあるが閉じ ``` が無い）専用の救済。
  //   実運用でReviewerがトークン上限等により閉じフェンスなしで返す事象が確認されたため、
  //   「確実にreply wrapperと判定できる場合のみ」開始フェンスを除去する。
  //   条件を厳格にし、一般Markdownコードブロックへは絶対に波及させない：
  //     ①言語指定が json であること（``` のみ／js/sql等は対象外）
  //     ②残りが { で始まること
  //     ③残りに "reply" が含まれること
  //   1つでも欠ければ null（原文維持）。
  var UNCLOSED_FENCE_RE = /^```([A-Za-z0-9_+-]*)[ \t]*\r?\n([\s\S]*)$/;

  function stripUnclosedJsonFence(text) {
    try {
      var t = String(text == null ? '' : text).trim();
      if (t.indexOf('```') !== 0) return null;
      // 閉じフェンスがある場合は通常の除去に任せる（ここでは扱わない）
      if (t.slice(3).indexOf('```') !== -1) return null;
      var m = t.match(UNCLOSED_FENCE_RE);
      if (!m) return null;
      if (String(m[1] || '').toLowerCase() !== 'json') return null;   // json指定のみ
      var inner = String(m[2] || '');
      var probe = inner.trim();
      if (probe.charAt(0) !== '{') return null;                        // JSONオブジェクトの開始のみ
      if (probe.indexOf('"reply"') === -1) return null;                // reply wrapperと確信できる場合のみ
      return inner;
    } catch (e) { return null; }
  }

  function stripJsonFence(text) {
    try {
      var t = String(text == null ? '' : text).trim();
      var m = t.match(FENCE_RE);
      if (!m) return stripUnclosedJsonFence(t);   // 閉じフェンスなし → 厳格条件での救済を試す
      var lang = String(m[1] || '').toLowerCase();
      var inner = m[2];
      if (lang === 'json') return inner;                 // json指定 → 除去してよい
      if (lang !== '') return null;                       // js/sql等の明示言語 → 触らない
      // 言語指定なし: 中身がreply wrapperとして解釈できる場合のみ除去する
      var probe = String(inner || '').trim();
      if (probe.charAt(0) !== '{' || probe.charAt(probe.length - 1) !== '}') return null;
      try {
        var o = JSON.parse(probe);
        if (isPlainObject(o) && typeof o.reply === 'string') return inner;
      } catch (e) { /* parse不可＝確信が持てない → 触らない */ }
      return null;
    } catch (e) { return null; }
  }

  // ── reply wrapper の除去 ───────────────────────────────────
  //   テキスト全体が1つのJSONオブジェクトである場合のみ対象にする。
  //   文章の途中にJSONがあるだけのケースを誤parseしないため、
  //   既存コードのような indexOf('{') / lastIndexOf('}') 方式は使わない。
  //   戻り値 null = 変更しない（reply以外の正式構造JSONもここでnullになる）。
  function unwrapReplyOnce(text) {
    try {
      var t = String(text == null ? '' : text);
      var tt = t.trim();
      if (tt.charAt(0) !== '{') return null;          // 文章中のJSONは対象外（全体が1つのJSONの場合のみ）

      // ① 厳格parse（正常なJSON）。閉じ括弧で終わる場合のみ試みる。
      if (tt.charAt(tt.length - 1) === '}') {
        try {
          var o = JSON.parse(tt);
          if (isPlainObject(o) && typeof o.reply === 'string') return o.reply;
          return null; // reply文字列を持たない正式構造JSON（{"status":..,"score":..}等）は変更しない
        } catch (e) { /* ②へ */ }
      }
      // 閉じ括弧が無い＝応答が途中で切れたケースも②の文字列抽出で救う
      // （"reply" を含むことを必須にしているため、単に { で始まる文章は対象にならない）

      // ② parse失敗時（reply本文に実改行を含むJSON等）の文字列抽出。
      //    "reply" フィールドの値だけを取り出す。JSONとして壊れていても例外は出さない。
      if (tt.indexOf('"reply"') === -1) return null;
      var ri = tt.indexOf('"reply"');
      var colon = tt.indexOf(':', ri + 7);
      if (colon === -1) return null;
      var qi = tt.indexOf('"', colon + 1);
      if (qi === -1) return null;
      qi += 1;
      var ci = qi;
      while (ci < tt.length) {
        if (tt.charAt(ci) === '"') {
          // 直前のバックスラッシュ数が偶数なら「エスケープされていない引用符」＝終端
          var bs = 0, k = ci - 1;
          while (k >= 0 && tt.charAt(k) === '\\') { bs++; k--; }
          if (bs % 2 === 0) break;
        }
        ci++;
      }
      var extracted = tt.slice(qi, ci);
      // 代表的なエスケープのみ復元（汎用JSONデコーダは作らない）
      extracted = extracted
        .replace(/\\r\\n/g, '\n').replace(/\\n/g, '\n').replace(/\\r/g, '\n')
        .replace(/\\t/g, '\t').replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      return extracted;
    } catch (e) { return null; }
  }

  // ── 公開API: 成果物1件の正規化 ─────────────────────────────
  //   input: string（通常）／object（{reply:"..."}のようにparse済みで渡される場合）／null等
  //   返り値の text は「表示・Leader統合に使ってよい正規化済み本文」。
  //   raw には原文を保持し、呼び出し側が原本を失わないようにする。
  function normalizeAgentResult(input, options) {
    var opts = isPlainObject(options) ? options : {};
    var result = {
      version: NORMALIZER_VERSION,
      text: '', raw: '', changed: false,
      hadReplyWrapper: false, hadJsonFence: false,
      isEmpty: true, hasMeaningfulResult: false,
      transforms: [],
    };
    try {
      // オブジェクトで渡された場合（parse済みのreply wrapper）
      if (isPlainObject(input)) {
        if (typeof input.reply === 'string') {
          result.raw = safeStringify(input);
          result.hadReplyWrapper = true;
          result.transforms.push('object_reply_unwrap');
          finish(result, input.reply, opts);
          return result;
        }
        result.raw = safeStringify(input);
        finish(result, result.raw, opts);   // reply以外の構造オブジェクトは文字列化のみ（内容不変）
        return result;
      }
      if (input === null || input === undefined) { finish(result, '', opts); return result; }

      var raw = String(input);
      result.raw = raw;
      var text = raw;

      // ① コードフェンス除去（json指定 or reply wrapperと確信できる場合のみ）
      var defenced = stripJsonFence(text);
      if (defenced !== null) {
        text = defenced;
        result.hadJsonFence = true;
        result.transforms.push('json_fence_strip');
      }

      // ② reply wrapper 除去（最大2回＝二重JSON文字列化まで。汎用recursiveにはしない）
      for (var pass = 0; pass < MAX_UNWRAP_PASSES; pass++) {
        var unwrapped = unwrapReplyOnce(text);
        if (unwrapped === null) break;
        text = unwrapped;
        result.hadReplyWrapper = true;
        result.transforms.push('reply_unwrap');
        // 内側にもフェンスが残っている場合は1回だけ剥がす（{"reply":"```json..."} 対策）
        var inner = stripJsonFence(text);
        if (inner !== null) { text = inner; result.hadJsonFence = true; result.transforms.push('json_fence_strip_inner'); }
      }

      finish(result, text, opts);
      return result;
    } catch (e) {
      // fail-open: 何が起きても原文を返す（成果物を失わない）
      result.text = result.raw || '';
      result.changed = false;
      result.transforms.push('exception_fallback');
      var t0 = String(result.text || '').trim();
      result.isEmpty = t0.length === 0;
      result.hasMeaningfulResult = !result.isEmpty;
      return result;
    }
  }

  function safeStringify(v) {
    try { return JSON.stringify(v); } catch (e) { return String(v); }
  }

  function finish(result, text, opts) {
    var t = String(text == null ? '' : text);
    result.text = t;
    result.changed = (t !== result.raw);
    var trimmed = t.trim();
    result.isEmpty = trimmed.length === 0;
    // 実質的な成果物があるか（statusは書き換えず、派生判定としてのみ提供する）
    var minLen = (typeof opts.minMeaningfulLength === 'number' && opts.minMeaningfulLength >= 0)
      ? opts.minMeaningfulLength : 1;
    result.hasMeaningfulResult = trimmed.length >= minLen;
  }

  // ── 公開API: 正規化済みテキストだけを取り出す薄いショートカット ────────
  //   既存コードの置き換えを最小差分にするためのヘルパー（挙動は normalizeAgentResult と同一）。
  function normalizeAgentResultText(input, options) {
    return normalizeAgentResult(input, options).text;
  }

  // ── 公開API: 成果物が実質的に存在するか（status契約を変更しない派生判定） ──
  //   status==='completed' でも本文が空／wrapperのみ／フェンス内が空の場合は false を返す。
  function hasMeaningfulAgentResult(input, options) {
    return normalizeAgentResult(input, options).hasMeaningfulResult;
  }

  return {
    version: NORMALIZER_VERSION,
    MAX_UNWRAP_PASSES: MAX_UNWRAP_PASSES,
    normalizeAgentResult: normalizeAgentResult,
    normalizeAgentResultText: normalizeAgentResultText,
    hasMeaningfulAgentResult: hasMeaningfulAgentResult,
    // 単体検証用（内部関数の公開・呼び出し側では通常使用しない）
    stripJsonFence: stripJsonFence,
    stripUnclosedJsonFence: stripUnclosedJsonFence,
    unwrapReplyOnce: unwrapReplyOnce,
  };
});
