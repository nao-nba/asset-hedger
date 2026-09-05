// ============================================================
// このファイルの役割（ダッシュボード共通レイアウト）:
//   URL: /dashboard 以下のすべてのページで共有されるヘッダー・枠組み。
//   /dashboard/page.tsx や /dashboard/assets/page.tsx はここの
//   children として差し込まれる（ページの中身だけを各ファイルに書けばよい）。
//
//   ここでやること:
//   1. 上部ヘッダーの表示（アプリ名・ナビリンク・言語切替・ログアウト）
//   2. ナビリンクの「現在地ハイライト」（usePathname で現在URLを取得）
//   3. ログアウト処理（Supabaseのセッション削除 → /auth へリダイレクト）
// ============================================================

"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase";
import { useI18n } from "@/lib/i18n";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname();  // 現在のURLパス（例: "/dashboard/assets"）
  const router    = useRouter();    // ページ遷移用
  const supabase  = createClient(); // Supabaseクライアント
  const { t, lang, setLang } = useI18n();

  // ログアウト処理: Supabaseのセッション（Cookie）を削除してログインページへ
  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/auth");
  }

  // ナビゲーションリンクの定義（ここを増やせばメニューが増える）
  const navItems = [
    { label: t.navOverview, href: "/dashboard" },
    { label: t.navAssets,   href: "/dashboard/assets" },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      {/* ヘッダー */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <h1 className="text-lg font-bold">Asset Hedger</h1>
          <nav className="flex gap-1">
            {/* navItemsをループしてリンクを生成する */}
            {navItems.map((item) => {
              // 現在のURL(pathname)とリンク先(href)が一致したらアクティブスタイルを当てる
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                    isActive
                      ? "bg-gray-800 text-white"     // 現在地: 背景付き
                      : "text-gray-400 hover:text-white" // それ以外: グレー
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* 右側: 言語切り替え + ログアウトボタン */}
        <div className="flex items-center gap-4">
          {/* 言語切り替えボタン */}
          <div className="flex rounded-lg bg-gray-800 p-0.5">
            {(["ja", "en"] as const).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  lang === l ? "bg-gray-600 text-white" : "text-gray-500 hover:text-gray-300"
                }`}
              >
                {l === "ja" ? "日本語" : "EN"}
              </button>
            ))}
          </div>
          <button
            onClick={handleSignOut}
            className="text-sm text-gray-400 hover:text-white transition-colors"
          >
            {t.signOut}
          </button>
        </div>
      </header>

      {/* ページ本体（各ページのコンポーネントがここに入る）*/}
      {/* max-w-5xl: 最大幅1024px、mx-auto: 中央寄せ */}
      <main className="max-w-5xl mx-auto px-6 py-10">{children}</main>
    </div>
  );
}
