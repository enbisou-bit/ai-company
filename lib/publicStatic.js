'use strict';
// lib/publicStatic.js
// Phase 2-E Production Activation Step PA-3A — Public Static Asset Boundary
//
// 背景（PA-3 §17 static-root exposure）:
//   従来 server.js は `app.use(express.static(path.join(__dirname)))` により
//   **repo root全体**をHTTP静的配信していた。その結果 deploy 後は無認証・予測可能URLで
//   docs/（Decision全文＝認可境界の設計と既知の弱点）・lib/・shared/・supabase/schema.sql・
//   data/・server.js・package.json・node_modules・*.test.js 等がすべて取得可能だった。
//   （secret値そのものはコード上に存在せず `.env*` は serve-static の dotfiles 既定で
//     非配信のため直接的な資格情報漏洩は無かったが、内部設計の全面公開は残っていた。）
//
// 方針（allowlist / dedicated public boundary）:
//   denylist（「これは隠す」）は、将来 server-only ファイルが追加されたときに
//   **自動的に公開されてしまう**ため採用しない。
//   ブラウザが実際に要求する asset のみを明示的に許可し、それ以外は素通り（→404）させる。
//
//   実測した「ブラウザが要求する local asset」は以下のみ（index.html 全走査・
//   script/link/img/source/iframe タグ、src=/href=、fetch()、XHR、CSS url()、
//   dynamic import、manifest/service worker をすべて確認）:
//     - /                         → index.html
//     - /index.html
//     - /shared/<5 files>.js      → <script src="shared/...js">
//     - /members/<id>.md          → fetch(`members/${id}.md`)
//   CSS・画像・icon・font・favicon・manifest への参照は存在しない
//   （index.html は単一ファイルで CSS/JS を内包。assets/fonts/*.otf は sharp が
//     server側で読むだけで、ブラウザからは要求されない）。
//
// 本moduleは **静的配信の許可判定のみ**を責務とする。
//   認証（WEB_APP_PASSWORD / WEB_SESSION_SECRET / localStorage UI gate）・
//   Carousel の billingLock / Approval Token / Budget / Ledger / Dual-Key /
//   Storage trust boundary には一切関与しない（PA-3A では変更していない）。

const path = require('path');

// ── 個別ファイル allowlist（完全一致・case sensitive） ─────────────────
//   ここに列挙されていない root 直下ファイル（server.js / package.json /
//   *.test.js / server.log / cost-logs.json 等）は配信されない。
const PUBLIC_FILES = Object.freeze([
  'index.html',
  // index.html が <script src="..."> で読み込む browser-side shared module のみ。
  //   shared/ ディレクトリ全体は公開しない（carouselImageCore.js /
  //   carouselApproval.js 等の server-only ロジックを含むため）。
  'shared/agentResultNormalizer.js',
  'shared/evidenceAcquisition.js',
  'shared/iadpIntelligenceContext.js',
  'shared/instagramAccountDesign.js',
  'shared/instagramAccountDesignQuality.js',
]);

const PUBLIC_FILE_SET = new Set(PUBLIC_FILES);

// ── ディレクトリ allowlist ────────────────────────────────────────────
//   members/<id>.md は UI が動的な id で fetch するため個別列挙できない。
//   「members/ 直下・単一segment・.md のみ」に限定する（サブディレクトリ不可）。
const PUBLIC_DIR_RULES = Object.freeze([
  Object.freeze({ prefix: 'members/', entryPattern: /^[A-Za-z0-9_-]+\.md$/ }),
]);

// ルート要求（'/'）が解決される既定ファイル。
const ROOT_FILE = 'index.html';

// backslash（Windows path separator）・NUL・C0制御文字・DEL を拒否する。
const REJECT_CHARS_RE = /[\\\u0000-\u001f\u007f]/;

/**
 * HTTP request path（クエリ除去済み・express の req.path 相当）を受け取り、
 * 配信を許可する repo-root 相対パスを返す。許可しない場合は null。
 *
 * 判定は「拒否理由を探す」のではなく「allowlist に一致するか」だけで行う。
 * したがって未知の内部ファイルが repo に追加されても自動公開されない。
 *
 * @param {string} urlPath 例: '/index.html', '/members/leader.md', '/docs/04DECISIONS.md'
 * @returns {string|null} 例: 'index.html' / null
 */
function resolvePublicAsset(urlPath) {
  if (typeof urlPath !== 'string' || urlPath.length === 0) return null;

  // percent-encoding は許可対象パスに一切現れない。
  //   デコード順序に依存する曖昧さ（%2e%2e / %2f / 二重エンコード / overlong）を
  //   生まないため、'%' を含む要求はこの時点で拒否する。
  if (urlPath.indexOf('%') !== -1) return null;

  if (REJECT_CHARS_RE.test(urlPath)) return null;

  if (urlPath.charAt(0) !== '/') return null;

  const rel = urlPath.slice(1);
  if (rel === '') return ROOT_FILE;

  // 空segment（'//' や末尾 '/'）・dot segment を拒否。
  const segments = rel.split('/');
  for (let i = 0; i < segments.length; i++) {
    const s = segments[i];
    if (s === '' || s === '.' || s === '..') return null;
  }

  // 個別ファイル allowlist（完全一致・大文字小文字を区別する）。
  //   Windows/macOS の case-insensitive filesystem 経由で
  //   '/SERVER.js' 等が別名として通ることを防ぐ。
  if (PUBLIC_FILE_SET.has(rel)) return rel;

  // ディレクトリ allowlist（1階層のみ）。
  for (let i = 0; i < PUBLIC_DIR_RULES.length; i++) {
    const rule = PUBLIC_DIR_RULES[i];
    if (rel.indexOf(rule.prefix) !== 0) continue;
    const entry = rel.slice(rule.prefix.length);
    if (entry.indexOf('/') !== -1) continue;      // サブディレクトリは不可
    if (!rule.entryPattern.test(entry)) continue;
    return rel;
  }

  return null;
}

/**
 * express middleware を生成する。
 *
 * 許可された path のみを既存の express.static へ委譲するため、
 * Content-Type / ETag / Last-Modified / Range / conditional GET といった
 * **既存の配信契約はそのまま維持**される（挙動が変わるのは「配信対象の集合」だけ）。
 * 許可されない path は next() で素通りさせる。
 *   → /api/* や /webhook 等の既存 route は従来どおり後段で処理される。
 *   → どの route にも一致しない内部ファイル要求は express 既定の 404 になる
 *     （index.html を 200 で返す SPA fallback は存在しない＝内部pathと公開pathが
 *       HTTPステータス上も明確に区別される）。
 *
 * @param {object} options
 * @param {string} options.rootDir  repo root の絶対パス
 * @param {function} [options.staticFactory]  express.static 相当（DI可能・テスト用）
 */
function createPublicStaticMiddleware(options) {
  options = options || {};
  const rootDir = options.rootDir;
  if (typeof rootDir !== 'string' || rootDir === '') {
    throw new Error('publicStatic: rootDir is required');
  }
  const staticFactory = typeof options.staticFactory === 'function'
    ? options.staticFactory
    : require('express').static;

  const serve = staticFactory(path.join(rootDir), {
    // '/' → index.html（従来 express.static の既定と同じ）。
    index: ROOT_FILE,
    // dotfile は allowlist に無いため到達しないが、二重に閉じておく。
    dotfiles: 'ignore',
    // 拡張子補完（'/server' → server.js 等）を無効化する。
    extensions: false,
    // ディレクトリへの自動 redirect を無効化する。
    redirect: false,
  });

  return function publicStaticMiddleware(req, res, next) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    // req.path は query を含まず、express 側で percent-decode もされない。
    const p = (typeof req.path === 'string' && req.path !== '') ? req.path : null;
    if (p === null) return next();
    if (resolvePublicAsset(p) === null) return next();
    return serve(req, res, next);
  };
}

module.exports = {
  PUBLIC_FILES: PUBLIC_FILES,
  PUBLIC_DIR_RULES: PUBLIC_DIR_RULES,
  ROOT_FILE: ROOT_FILE,
  resolvePublicAsset: resolvePublicAsset,
  createPublicStaticMiddleware: createPublicStaticMiddleware,
};
