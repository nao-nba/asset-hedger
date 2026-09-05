// ============================================================
// このファイルの役割:
//   Supabaseクライアントを作る関数を1か所にまとめる。
//   アプリ内でSupabaseを使いたいページやフックは、
//   毎回この関数を呼んでクライアントを取得する。
//
//   createBrowserClient = ブラウザ（クライアントサイド）用のクライアント。
//   Cookieを使ってログイン状態を管理する。
// ============================================================

import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  // 環境変数からSupabaseのURLとanon keyを読む。
  // これらは .env.local に書いてあり、NEXT_PUBLIC_ 付きなので
  // ブラウザ側のJavaScriptからも読める（公開しても安全なキー）。
  // ! は「この値はnullにならない（undefinedにならない）」という
  // TypeScriptへの断言（assertionと呼ぶ）。
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
