const { createClient } = require('@supabase/supabase-js');

const supabaseUrl =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.SUPABASE_URL ||
  '';

const supabaseKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  '';

let supabase = null;

if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
  console.log('[Supabase] 接続設定完了:', supabaseUrl);
} else {
  console.log('[Supabase] 環境変数未設定 — ローカルfallbackモードで動作します');
}

module.exports = { supabase };
