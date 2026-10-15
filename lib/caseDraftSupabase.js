'use strict';
// lib/caseDraftSupabase.js
// cases／output_drafts 専用の server-only privileged Supabase client（既存表のアクセス境界・提案段階・未承認）。
//
//   責務: lib/casesDb.js と lib/outputDraftsDb.js だけが使う privileged client を1つ生成して export する。
//         **これ以外の用途に使わない。** 他の DB helper（approvalsDb / costDb 等）へ横展開しない。
//
//   ★ 既存の lib/carouselExecutionSupabase.js（Decision 110）・lib/carouselAssetStorageSupabase.js（Decision 114）は
//     それぞれ「これ以外の用途に使わない」と明記しているため流用しない。credential env の命名規約（優先順位）と
//     auth オプションだけを同じにし、module 責務・変数・export は分離する（Decision 114 と同じ方式）。
//   ★ 既存の lib/supabase.js（anon client）は変更しない。本ファイルは lib/supabase.js を require せず、
//     anon key（NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY）を一切参照しない——構造的に anon へ落ちない。
//
//   状態（caseDraftDbStatus()）:
//     'ready'              … URL と server 用キーあり → privileged client
//     'not_configured'     … 本番以外で URL なし（ローカル fallback モード・従来どおり client は null）
//     'server_key_missing' … URL はあるが server 用キーなし → **明確に拒否**する client（from() が必ず例外）。
//                             呼び出し側の既存の try/catch がエラー（'server_key_missing'）として返す。anon へは切り替えない。
//     'server_url_missing' … 本番（Render）で URL なし → 同じく拒否する client（ローカル fallback へ逃げない）。
//   本番の判定: Render が全サービスに自動で設定する環境変数 RENDER=true（値は secret ではない）。
//     既存コードに本番判定は無いため、この1点だけを使う。本番以外の意図したローカル fallback は従来どおり。
//
//   ★ credential は production server（Render）の secret 環境変数としてのみ保持する。値を log・戻り値に載せない。
//   ★ createClient() はネットワークリクエストを発生させない（lazy client）。require しただけでは通信 0。
//   ★ DB で権限を絞っても、サーバー経由の操作の認可（session 等）は各 API route の責務として別に必要。

const { createClient } = require('@supabase/supabase-js');

// URL は既存 server-side 規約と同じ二段 fallback。URL は secret ではない。
const _url =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

// privileged key（優先 : SUPABASE_SECRET_KEY・互換 : SUPABASE_SERVICE_ROLE_KEY）。NEXT_PUBLIC_* 系は使わない。
const _privilegedKey =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  '';

const SERVER_KEY_MISSING = 'server_key_missing';
const SERVER_URL_MISSING = 'server_url_missing';
const _isProduction = process.env.RENDER === 'true';

// 拒否専用の client（通信しない・どの操作も例外）。
function _refusingClient(reason) {
  return Object.freeze({
    from() { throw new Error(reason); },
    rpc() { throw new Error(reason); },
  });
}

let _status;
let caseDraftClient = null;

if (_url && _privilegedKey) {
  _status = 'ready';
  caseDraftClient = createClient(_url, _privilegedKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
} else if (_url) {
  _status = SERVER_KEY_MISSING;
  caseDraftClient = _refusingClient(SERVER_KEY_MISSING);
  console.warn('[caseDraftSupabase] SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY 未設定 — cases／output_drafts の DB 操作を拒否します（anon へは切り替えません）');
} else if (_isProduction) {
  _status = SERVER_URL_MISSING;
  caseDraftClient = _refusingClient(SERVER_URL_MISSING);
  console.warn('[caseDraftSupabase] 本番で SUPABASE_URL / NEXT_PUBLIC_SUPABASE_URL 未設定 — cases／output_drafts の DB 操作を拒否します（ローカル fallback へは切り替えません）');
} else {
  _status = 'not_configured';
}

// 状態の文字列のみ（secret 値は絶対に載せない）。
function caseDraftDbStatus() {
  return _status;
}

module.exports = {
  caseDraftClient: caseDraftClient,
  caseDraftDbStatus: caseDraftDbStatus,
  SERVER_KEY_MISSING: SERVER_KEY_MISSING,
  SERVER_URL_MISSING: SERVER_URL_MISSING,
};
