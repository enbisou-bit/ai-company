'use strict';
// shared/carouselVisualDirection.js
// Instagram Carousel Image Production — PA-24 Option B: Post-level Visual Direction Contract。
//
//   目的: 7 slides の背景生成が「7 independent generations」になり、投稿全体の視覚統一が
//         保証されない問題（PA-22H で確認）への対応。1 投稿につき共通の art direction を
//         **固定 constant** として全 slide の provider prompt へ注入する。
//
//   責務:
//     - Value Content 向けの決定的な視覚方向（medium / palette / lighting / composition /
//       background density / subject policy）を1本の英語文字列として提供する
//     - "decorative background only, not an informational graphic" という肯定形の役割宣言
//       （PA-22H F4 で negative constraint 単独では不足したため、positive framing を最優先層へ置く）
//
//   非責務:
//     - AI 生成・LLM 呼び出し（固定 constant のみ）
//     - Output Draft 本文の読み書き（draft には一切触れない）
//     - Content Type 別の分岐（現行 Output Draft contract に contentType/postType 識別子が
//       存在しないため。将来 Product Content 対応が必要になった時点で別途 Decision 化する）
//
//   determinism: 入力なし・乱数なし・時刻依存なし。常に同一文字列を返す。

// ── 肯定形の役割宣言（最優先 authority・prompt 冒頭に置く） ──────────────
//   PA-22H: SAFE_SUFFIX（negative）単独では slide5/6/7 で UI/icon/infographic を抑制できなかった。
//   「情報グラフィックを作るな」を否定形だけでなく肯定形（「装飾的な背景写真だけを作れ」）で
//   最上位に宣言する。
var BACKGROUND_ONLY_CONTRACT =
  'Create only a decorative photographic background scene for a separate text overlay. ' +
  'Do not create an informational graphic';

// ── Value Content 向け Visual Direction（6 field を1本化した固定文言） ──────────────
//   PA-23 §12 で確定。medium=photo-only（PA-22H で illustration/infographic 系が FAIL・
//   写真系が PASS だった実測に基づく）。
var VALUE_CONTENT_DIRECTION = [
  // medium
  'soft editorial lifestyle photography',
  // palette
  'warm ivory, soft beige and muted sage green palette',
  // lighting
  'soft natural daylight with gentle shadows',
  // composition
  'minimal asymmetrical composition with the subject placed off-center',
  // background density
  'low uncluttered background density, generous negative space',
  // subject policy
  'unbranded generic skincare objects only',
  'if a person appears show hands only, no full face, no character illustration',
].join(', ');

// ── medium 相反語（photo-only 契約時に final prompt から除去されるべき表現） ──────────────
//   Sanitizer 側の判定材料。日本語・英語の両方を列挙。
//   ★ ASCII 語は Sanitizer 側で word boundary 付きマッチになるため（_termRegex）、
//     "character" は "characteristic" に誤爆しない。日本語の単漢字「絵」だけは
//     「絵になる」等へ誤爆するため除外し、複合語のみ扱う。
var MEDIUM_CONFLICT_TERMS = Object.freeze([
  // 英語
  'illustration', 'illustrated', 'illustrative', 'watercolor', 'water color', 'cartoon', 'anime',
  'character illustration', 'character', 'clip art', 'clipart', 'flat design', 'vector art', 'line art',
  'hand-drawn', 'hand drawn', 'sketch', 'drawing', 'painting', 'painted',
  // 日本語（単漢字「絵」は入れない）
  'イラスト', 'イラストレーション', '水彩', '水彩画', '手描き', '手書き', 'スケッチ',
  '線画', 'ベクターアート', 'フラットデザイン', 'アニメ', '漫画', 'マンガ', 'キャラクター',
  '挿絵',
]);

// ── 現時点は単一 template（Value Content）。Content Type 別分岐は未実装（§13）。 ──────────────
function getVisualDirection() {
  return VALUE_CONTENT_DIRECTION;
}

module.exports = {
  BACKGROUND_ONLY_CONTRACT: BACKGROUND_ONLY_CONTRACT,
  VALUE_CONTENT_DIRECTION: VALUE_CONTENT_DIRECTION,
  MEDIUM_CONFLICT_TERMS: MEDIUM_CONFLICT_TERMS,
  getVisualDirection: getVisualDirection,
};
