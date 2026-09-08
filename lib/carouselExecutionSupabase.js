'use strict';
// lib/carouselExecutionSupabase.js
// Carousel Image Production — Phase 2-E Gate 1: server-only privileged Supabase client
// （Decision 110: carousel_image_executions Server-only Trust Boundary）
//
//   責務: carousel_image_executions（paid execution ledger / nonce single-use の正本）専用の
//         privileged client を1つだけ生成して export する。**これ以外の用途に使わない。**
//
//   ★ 既存の lib/supabase.js（anon client）は一切変更しない・置換しない。
//     他のDB helper（costDb / approvalsDb / affiliateEvalDb / conversationsDb 等）へ
//     本 client を横展開しない。利用箇所は lib/carouselExecutionDb.js のみ。
//
//   ★ credential は production server（Render）の secret 環境変数としてのみ保持する。
//     Claude Code環境 / .env.local / local / browser / Git / docs / test には
//     **secret 値を一切置かない**（本ファイルにも環境変数「名」しか書かない）。
//     Decision 070 項目10（Claude Code環境へDDL実行経路を追加しない）は変更しない・両立する。
//
//   ★ fail-closed: credential が無い環境では carouselExecutionClient = null となり、
//     lib/carouselExecutionDb.js が reserve_unavailable を返して provider call 0 で停止する。
//     **anon client への fallback は実装しない。** 本ファイルは lib/supabase.js を require せず、
//     anon key（NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY）を一切参照しない
//     ——構造的に anon へ落ちられないようにするため。
//
//   ★ secret を log しない。値の出力・戻り値への混入を行わない。

const { createClient } = require('@supabase/supabase-js');

// URL は既存 server-side 規約（lib/supabase.js）と同じ二段 fallback。URL は secret ではない。
const _url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

// privileged key。
//   優先 : SUPABASE_SECRET_KEY        （Supabase公式の現行名・sb_secret_... 形式）
//   互換 : SUPABASE_SERVICE_ROLE_KEY  （legacy service_role JWT。公式には非推奨だが動作する）
//   ★ NEXT_PUBLIC_* 系の名前は使用しない（ブラウザ公開前提の命名に secret を載せない）。
const _privilegedKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

let carouselExecutionClient = null;

if (_url && _privilegedKey) {
  // server-side privileged client。ブラウザ的なセッション挙動は不要かつ有害なため無効化する。
  //   @supabase/supabase-js v2 系の auth オプション（本 repo は 2.108.2）。
  carouselExecutionClient = createClient(_url, _privilegedKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}

// 設定有無の boolean のみ（secret 値は絶対に載せない）。
// 呼び出し側が health 表示等に使う場合も、この boolean までとする。
function isPrivilegedClientConfigured() {
  return carouselExecutionClient !== null;
}

module.exports = {
  carouselExecutionClient: carouselExecutionClient,
  isPrivilegedClientConfigured: isPrivilegedClientConfigured,
};
