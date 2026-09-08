'use strict';
// lib/carouselAssetStorageSupabase.js
// Carousel Image Production — Production Activation Step PA-2:
// Storage専用 server-only privileged Supabase client（Decision 114 実装完成）。
//
//   責務: Supabase Storage（bucket: carousel-images）専用の privileged client を1つだけ
//   生成して export する。**これ以外の用途に使わない。**
//
//   ★ Decision 110（carousel_image_executions Server-only Trust Boundary）の
//     lib/carouselExecutionSupabase.js は paid execution ledger（1テーブル）専用であり、
//     同ファイル自身が「他のDB helperへ横展開しない」と明記している。本ファイルはそれを
//     横展開したものではなく、Storageという別リソース向けの**新しい**privileged client
//     （Decision 114）である。credential envの命名規約（優先順位）だけを共通化し、
//     module責務・変数・exportは完全に分離する。
//
//   ★ credential は production server（Render）の secret 環境変数としてのみ保持する。
//     Claude Code環境 / .env.local / local / browser / Git / docs / test には
//     **secret 値を一切置かない**（本ファイルにも環境変数「名」しか書かない）。
//
//   ★ fail-closed: credential が無い環境では carouselAssetStorageClient = null となる。
//     lib/carouselAssetStorage.js / lib/carouselAssetAccess.js は opts.client が
//     null / storage未サポートのとき 'storage_unavailable' を返して実 network 呼び出し
//     0 のまま停止する設計（Step C-2/C-3 実装済み）。**anon client への fallback は
//     実装しない。** 本ファイルは lib/supabase.js（anon client）を require せず、
//     anon key（NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY）を一切参照しない
//     ——構造的に anon へ落ちられないようにするため。
//
//   ★ createClient() 自体はネットワークリクエストを発生させない（lazy client。実際の
//     HTTPリクエストは .storage.from(...).upload()/.createSignedUrl() 等を呼んだ時点で
//     初めて発生する）。本ファイルは client オブジェクトを構築するだけであり、
//     require するだけ・buildProductionDeps() を呼ぶだけでは実 Storage network は 0 のまま。
//
//   ★ secret を log しない。値の出力・戻り値への混入を行わない（本ファイルは console.* を
//     一切使わない）。
//
//   ★ 本ファイルの責務は client 生成のみ。bucket作成・Storage policy/RLS変更・
//     upload/signed URL のビジネスロジックはここに書かない
//     （それぞれ lib/carouselAssetStorage.js・lib/carouselAssetAccess.js の責務）。

const { createClient } = require('@supabase/supabase-js');

// URL は既存 server-side 規約（lib/supabase.js・lib/carouselExecutionSupabase.js）と
//   同じ二段 fallback。URL は secret ではない。
const _url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

// privileged key。
//   優先 : SUPABASE_SECRET_KEY        （Supabase公式の現行名・sb_secret_... 形式）
//   互換 : SUPABASE_SERVICE_ROLE_KEY  （legacy service_role JWT。公式には非推奨だが動作する）
//   ★ NEXT_PUBLIC_* 系の名前は使用しない（ブラウザ公開前提の命名に secret を載せない）。
//   ★ anon key（NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY）は参照しない。
const _privilegedKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

let carouselAssetStorageClient = null;

if (_url && _privilegedKey) {
  // server-side privileged client。ブラウザ的なセッション挙動は不要かつ有害なため無効化する
  //   （lib/carouselExecutionSupabase.js と同一方針。@supabase/supabase-js v2 系のauthオプション）。
  carouselAssetStorageClient = createClient(_url, _privilegedKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// 設定有無の boolean のみ（secret 値は絶対に載せない）。
function isPrivilegedClientConfigured() {
  return carouselAssetStorageClient !== null;
}

module.exports = {
  carouselAssetStorageClient: carouselAssetStorageClient,
  isPrivilegedClientConfigured: isPrivilegedClientConfigured,
};
