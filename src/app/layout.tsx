// ============================================================
// このファイルの役割（ルートレイアウト）:
//   Next.jsアプリ全体の「外枠」。
//   すべてのページ（/auth、/dashboard など）はここの children に入る。
//
//   ここでやること:
//   1. フォントの設定（Geist / Geist Mono = Vercel製のフォント）
//   2. <html> と <body> タグを定義する
//   3. I18nProvider で全体を囲む → どのページでも useI18n() が使える
// ============================================================

import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { I18nProvider } from "@/lib/i18n";

// Google Fontsからフォントを読み込む（Next.jsのフォント最適化機能）
// variable はCSSカスタムプロパティとして使うための名前
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// ブラウザのタブに表示されるタイトルとmeta description
export const metadata: Metadata = {
  title: "Asset Hedger",
  description: "Visualize your family's assets",
};

// RootLayout: アプリ全体の外枠コンポーネント
// children = 各ページのコンテンツ（自動で差し込まれる）
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="ja"
      // フォントをCSSカスタムプロパティとしてhtmlタグに適用
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {/* I18nProvider で全子コンポーネントが useI18n() にアクセスできる */}
        <I18nProvider>{children}</I18nProvider>
      </body>
    </html>
  );
}
