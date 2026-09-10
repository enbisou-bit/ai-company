'use strict';
// shared/carouselBackgroundSanitizer.js
// Instagram Carousel Image Production — PA-24 Option C: Background Prompt Sanitizer。
//
//   目的: Output Draft の imagePrompts[i] / slide 本文の「ビジュアル：」由来 visualDirection が
//         「アイコン」「チェックリスト風デザイン」「一覧表風レイアウト」等の **情報構造 / UI 要素**
//         を明示的に要求し、SAFE_SUFFIX（no icons / no checkboxes / no frames）と同一 prompt 内で
//         矛盾していた問題（PA-22H で slide5/6/7 の実画像 FAIL として確認）への対応。
//
//   責務:
//     - unsafe visual intent（UI / icon / checklist / table / frame / diagram / infographic /
//       timeline / medium 相反語 等）を safe background intent へ **決定的に置換**する
//     - imagePromptText と visualDirection を sanitize 後に merge + dedup（同一原稿由来で
//       重複しがちなため）
//     - 変換後も unsafe 語が残る / 内容が空 / 異常入力 の場合は canonical safe fallback へ落とす
//
//   非責務: レイアウト判断 / bgTone 判断 / Visual Direction の決定 / provider 呼び出し /
//           Output Draft の読み書き（draftRow を mutate しない）。
//
//   determinism: 純関数（文字列 → 文字列）。固定対応表・固定正規表現のみ。
//                乱数なし・時刻依存なし・外部 I/O なし・LLM/AI 呼び出しなし。
//
//   security: raw 本文・secret・full provider prompt を返り値の metadata へ載せない
//             （matchedCategories / replacementType のみ）。

var vd = require('./carouselVisualDirection');

// ── canonical safe fallback（PA-23 §12） ──────────────
//   変換不能・全内容消失・異常入力・禁止語残留 のときに scene 全体を差し替える。
var CANONICAL_FALLBACK =
  'minimal skincare lifestyle background, soft natural light, clean negative space, ' +
  'decorative scene only, no informational structure';

// ── 意味衝突カテゴリ（PA-24 §8）。key = category, terms = 日本語+英語の検出語 ──────────────
//   ★ PA-22G 実データで FAIL に直接関与した5語（★）を最優先で含める:
//     「注意アイコン」「チェックリスト風デザイン」「整ったレイアウト」「シンプルなアイコン」「一覧表風レイアウト」
var CONFLICT_CATEGORIES = [
  {
    category: 'icon',
    // 長い語を先に（「注意アイコン」を「アイコン」より先にマッチさせ、専用置換を当てる）
    terms: ['注意アイコン', 'アイコン風', 'アイコン', 'ピクトグラム', 'シンボルマーク',
            'attention icon', 'warning icon', 'caution icon', 'icons', 'icon', 'pictogram', 'symbol mark'],
  },
  {
    category: 'checklist',
    terms: ['チェックリスト風デザイン', 'チェックリスト風', 'チェックリスト', 'チェックボックス',
            'チェック欄', 'チェックマーク',
            'checklist design', 'checklist', 'checkbox', 'checkboxes', 'tick box', 'tickbox', 'check mark'],
  },
  {
    category: 'table',
    terms: ['一覧表風レイアウト', '一覧表風', '一覧表', 'リスト表', '対応表', '表形式', '一覧',
            'list layout', 'table layout', 'tabular layout', 'spreadsheet', 'table', 'grid layout'],
  },
  {
    category: 'layout',
    terms: ['整ったレイアウト', '整理されたレイアウト', 'レイアウト', '配置図', 'グリッドレイアウト',
            'app-like layout', 'ui layout', 'organized layout', 'grid', 'layout', 'wireframe'],
  },
  {
    category: 'frame',
    terms: ['見出し枠', '枠線', '枠', 'フレーム', 'パネル', 'カード型', 'カード',
            'border box', 'framed panel', 'panel', 'frame', 'card design'],
  },
  {
    category: 'diagram',
    terms: ['相関図', '工程図', 'ステップ図', 'フロー図', 'フローチャート', '図解', 'インフォグラフィック',
            '情報デザイン', 'インフォデザイン', '情報グラフィック', '情報図',
            'infographic', 'flowchart', 'flow chart', 'diagram', 'step boxes', 'process chart', 'chart'],
  },
  {
    category: 'timeline',
    terms: ['時系列図', 'タイムライン', 'ルーティン表',
            'timeline', 'time line', 'schedule graphic'],
  },
  {
    category: 'ui-part',
    terms: ['ボタン', 'ラベル', 'バッジ', 'ダッシュボード', '画面デザイン', 'UI要素', 'UI',
            'button', 'label', 'badge', 'dashboard', 'screen design', 'ui element', 'user interface'],
  },
  {
    category: 'callout',
    terms: ['吹き出し', '注釈枠', '説明図',
            'speech bubble', 'callout', 'annotation box'],
  },
  {
    category: 'before-after',
    terms: ['ビフォーアフター', 'ビフォー・アフター', '比較図', '比較レイアウト',
            'before and after frame', 'before/after', 'comparison panel', 'split comparison'],
  },
];

// ── safe replacement 対応表（PA-24 §9・長い語 → 短い語の順で適用） ──────────────
//   意味を保持しつつ information structure を要求しない scene へ変換する。
//   ここに無い衝突語は「カテゴリ単位の canonical replacement」（下記 CATEGORY_REPLACEMENT）へ。
var PHRASE_REPLACEMENT = [
  ['チェックリスト風デザイン', 'clean lifestyle scene with generous negative space'],
  ['チェックリスト風', 'clean lifestyle scene with generous negative space'],
  ['一覧表風レイアウト', 'minimal grouped skincare objects arranged naturally'],
  ['一覧表風', 'minimal grouped skincare objects arranged naturally'],
  ['整ったレイアウト', 'calm tidy arrangement with generous negative space'],
  ['整理されたレイアウト', 'calm tidy arrangement with generous negative space'],
  ['注意アイコン', 'gentle hand gesture near the face, no graphic symbol'],
  ['シンプルなアイコン', 'small unbranded skincare objects arranged naturally'],
  ['アイコン風', 'small unbranded skincare objects arranged naturally'],
  ['朝夜のルーティンを並べた', 'a calm morning and evening skincare mood'],
  ['5項目をまとめた', 'a small calm group of skincare objects'],
];

// ── カテゴリ単位 canonical replacement（PHRASE_REPLACEMENT に無い衝突語用） ──────────────
var CATEGORY_REPLACEMENT = {
  icon: 'small unbranded skincare objects arranged naturally',
  checklist: 'clean lifestyle scene with generous negative space',
  table: 'minimal grouped skincare objects arranged naturally',
  layout: 'calm tidy arrangement with generous negative space',
  frame: 'soft natural background with generous negative space',
  diagram: 'calm decorative skincare mood, no informational structure',
  timeline: 'a calm skincare mood without any schedule graphic',
  'ui-part': 'plain natural background surface',
  callout: 'soft plain background near the subject',
  'before-after': 'a single calm skincare scene',
};

function _escapeRe(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ── 検出語 → 正規表現。ASCII/Latin 語は substring 誤爆（table→comfortable、
//   UI→build/guide、drawing→withdrawing 等）を避けるため word boundary で囲む。
//   日本語（U+3040 以上を含む）は分かち書きが無いためそのまま部分一致にする。
function _termRegex(term, flags) {
  var esc = _escapeRe(term);
  var isAscii = !/[^\x00-\x7F]/.test(term);
  if (isAscii) {
    // 語頭/語末が英数字境界のときだけマッチ（"table" は "comfortable" 内でマッチしない）
    return new RegExp('(?<![A-Za-z0-9])' + esc + '(?![A-Za-z0-9])', flags);
  }
  return new RegExp(esc, flags);
}

// medium 相反語（イラスト / watercolor 等）を photo 寄りへ置換する。
function _stripMediumConflicts(text) {
  var t = String(text || '');
  var hits = [];
  vd.MEDIUM_CONFLICT_TERMS.forEach(function (term) {
    if (_termRegex(term, 'i').test(t)) {
      hits.push(term);
      t = t.replace(_termRegex(term, 'gi'), ' ');
    }
  });
  return { text: t.replace(/\s{2,}/g, ' ').trim(), hits: hits };
}

// 1本の scene 文字列から衝突カテゴリ語を置換する。
function _replaceConflicts(text) {
  var t = String(text || '');
  var matched = [];

  // 1) 具体 phrase 置換（長い語順に既に並べてある）。前後へ空白を確実に入れる。
  //   PHRASE_REPLACEMENT の from は日本語の具体句のみ（誤爆リスクの低い長い phrase）。
  PHRASE_REPLACEMENT.forEach(function (pair) {
    var from = pair[0], to = pair[1];
    if (_termRegex(from, '').test(t)) {
      matched.push(from);
      t = t.replace(_termRegex(from, 'g'), ' ' + to + ' ');
    }
  });

  // 2) 残った衝突カテゴリ語をカテゴリ単位で canonical replacement
  CONFLICT_CATEGORIES.forEach(function (cat) {
    cat.terms.forEach(function (term) {
      if (_termRegex(term, 'i').test(t)) {
        matched.push(cat.category);
        t = t.replace(_termRegex(term, 'gi'), ' ' + (CATEGORY_REPLACEMENT[cat.category] || ' ') + ' ');
      }
    });
  });

  // 区切りの整形（連続空白・空要素・前後の句読点を潰す）
  t = t.replace(/\s{2,}/g, ' ')
       .replace(/\s*,\s*/g, ', ')
       .replace(/(,\s*){2,}/g, ', ')
       .replace(/^[,\s]+|[,\s]+$/g, '')
       .trim();
  return { text: t, matched: matched };
}

// 変換後に禁止カテゴリ語がまだ残っていないか決定的に再検査する。
function _hasResidualUnsafe(text) {
  var t = String(text || '');
  for (var i = 0; i < CONFLICT_CATEGORIES.length; i++) {
    var cat = CONFLICT_CATEGORIES[i];
    for (var j = 0; j < cat.terms.length; j++) {
      if (_termRegex(cat.terms[j], 'i').test(t)) return true;
    }
  }
  var m = _stripMediumConflicts(t);
  return m.hits.length > 0;
}

// 句読点区切りで正規化 dedup（同一原稿由来の imagePromptText / visualDirection の重複除去）。
//   ★ LLM/AI dedup は使わない。完全一致 phrase と normalized duplicate のみ除去。
function _mergeAndDedup(a, b) {
  var parts = (String(a || '') + '、' + String(b || ''))
    .split(/[、,]/)
    .map(function (s) { return s.trim(); })
    .filter(Boolean);
  var seen = Object.create(null);
  var out = [];
  parts.forEach(function (p) {
    var key = p.toLowerCase().replace(/\s+/g, '');
    if (seen[key]) return;
    seen[key] = true;
    out.push(p);
  });
  return out.join(', ');
}

// ══════════════════════════════════════════════════════════════
// sanitizeBackgroundScene — imagePromptText + visualDirection を
//   safe background scene 1本へ変換する。
//
//   入力: { imagePromptText, visualDirection }（いずれも既に構文 sanitize 済みの文字列）
//   戻り値: { scene, sanitized, matchedCategories, replacementType }
//     scene            : provider prompt へ埋め込む安全な scene 文字列
//     sanitized        : 変換または fallback が発生したか（boolean）
//     matchedCategories: 検出したカテゴリ名（重複なし・raw 本文は含まない）
//     replacementType  : 'none' | 'mapped' | 'category' | 'fallback'
// ══════════════════════════════════════════════════════════════
function sanitizeBackgroundScene(input) {
  input = input || {};
  var rawA = String(input.imagePromptText == null ? '' : input.imagePromptText);
  var rawB = String(input.visualDirection == null ? '' : input.visualDirection);

  var merged = _mergeAndDedup(rawA, rawB);

  // 異常入力 / 空 → fallback
  if (!merged || merged.length === 0 || merged.length > 1200) {
    return {
      scene: CANONICAL_FALLBACK,
      sanitized: true,
      matchedCategories: [],
      replacementType: 'fallback',
    };
  }

  // 1) medium 相反語（イラスト等）を除去
  var mediumRes = _stripMediumConflicts(merged);
  // 2) 衝突カテゴリ語を置換
  var conflictRes = _replaceConflicts(mediumRes.text);

  var scene = conflictRes.text;
  var matched = [];
  mediumRes.hits.forEach(function () { if (matched.indexOf('medium') === -1) matched.push('medium'); });
  conflictRes.matched.forEach(function (c) { if (matched.indexOf(c) === -1) matched.push(c); });

  var anyChange = (matched.length > 0);

  // 3) 変換後も残留 or 空 → canonical fallback
  if (!scene || scene.length === 0 || _hasResidualUnsafe(scene)) {
    return {
      scene: CANONICAL_FALLBACK,
      sanitized: true,
      matchedCategories: matched,
      replacementType: 'fallback',
    };
  }

  // replacementType の決定（PHRASE_REPLACEMENT が当たったかどうか）
  var usedPhrase = PHRASE_REPLACEMENT.some(function (pair) { return conflictRes.matched.indexOf(pair[0]) !== -1; });
  var rtype = !anyChange ? 'none' : (usedPhrase ? 'mapped' : 'category');

  return {
    scene: scene,
    sanitized: anyChange,
    matchedCategories: matched,
    replacementType: rtype,
  };
}

module.exports = {
  CANONICAL_FALLBACK: CANONICAL_FALLBACK,
  CONFLICT_CATEGORIES: CONFLICT_CATEGORIES,
  sanitizeBackgroundScene: sanitizeBackgroundScene,
};
