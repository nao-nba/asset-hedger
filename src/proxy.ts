// ============================================================
// このファイルの役割（ミドルウェア）:
//   ユーザーがどのURLにアクセスしても、ページを表示する「前」に
//   このファイルの処理が必ず実行される。
//   いわば「受付」のようなもの。
//
//   やること:
//   1. ログインしていない人が /dashboard に来たら → /auth に追い返す
//   2. ログイン済みの人が /auth に来たら → /dashboard に転送する
//
//   Next.jsでは src/proxy.ts という名前にすることで自動認識される。
//   （以前は middleware.ts という名前だったが v16 で proxy.ts に変更）
// ============================================================

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// proxy関数: すべてのリクエストに対してログイン状態をチェックする
export async function proxy(request: NextRequest) {
  // デフォルトの応答: そのままリクエストを通す（何もしない）
  let supabaseResponse = NextResponse.next({ request });

  // サーバーサイド用のSupabaseクライアントを作成する。
  // ブラウザのCookieにはログイン情報（セッション）が入っていて、
  // それをここで読み書きすることでログイン状態を確認できる。
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        // リクエストのCookieを全部読む
        getAll() {
          return request.cookies.getAll();
        },
        // Supabaseがセッションを更新したときにCookieも更新する
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Supabaseに「今のCookieでログインしているユーザーは誰か？」を問い合わせる
  const { data: { user } } = await supabase.auth.getUser();

  // 未ログインでダッシュボードへアクセスしようとしたらログインページへ強制転送
  if (!user && request.nextUrl.pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL("/auth", request.url));
  }

  // ログイン済みでログインページにアクセスしたらダッシュボードへ強制転送
  // （ログイン済みなのにまたログインしようとしている状態を防ぐ）
  if (user && request.nextUrl.pathname === "/auth") {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  // 上のどちらにも該当しない場合は、そのままページを表示する
  return supabaseResponse;
}

// このミドルウェアを「どのURLパスに対して実行するか」を指定する。
// /dashboard 以下と /auth ページにだけ適用する（静的ファイルなどは除外）。
export const config = {
  matcher: ["/dashboard/:path*", "/auth"],
};
