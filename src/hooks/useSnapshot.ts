// ============================================================
// このファイルの役割（カスタムフック）:
//   「Supabaseからデータを取得する」処理を1か所にまとめた関数。
//   カスタムフックとは、useXxx という名前のReact関数のこと。
//
//   useSnapshot() を呼ぶと以下を返す:
//     - user    : 現在ログイン中のユーザー情報
//     - latest  : 最新のスナップショット（最後に同期したデータ）
//     - history : 過去24件のスナップショット（時系列グラフ用）
//     - loading : データ取得中かどうか（true=ローディング中）
//
//   また、未ログインだった場合は自動で /auth ページに飛ばす。
//
//   dashboard/page.tsx と dashboard/assets/page.tsx の両方から使っている。
// ============================================================

"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import type { Snapshot } from "@/types/snapshot";

export function useSnapshot() {
  // useState: Reactの状態管理。値が変わると画面が再描画される。
  const [user, setUser]       = useState<User | null>(null);    // ログインユーザー（未ログインならnull）
  const [latest, setLatest]   = useState<Snapshot | null>(null); // 最新スナップショット
  const [history, setHistory] = useState<Snapshot[]>([]);        // 過去データ一覧（古→新の順）
  const [loading, setLoading] = useState(true);                  // 取得完了するまでtrue

  const router   = useRouter();   // ページ遷移に使う（Next.js）
  const supabase = createClient(); // Supabaseクライアントを取得

  // useEffect: コンポーネントが画面に表示された直後に1回だけ実行される。
  // [] が依存配列（空=マウント時のみ）。
  useEffect(() => {
    // Supabaseに「今ログインしているユーザーを教えて」と問い合わせる
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        // 未ログインなら /auth に強制転送（proxy.tsと二重チェック）
        router.push("/auth");
        return;
      }
      // ログイン済みならユーザー情報をstateに保存
      setUser(user);

      // Supabaseのasset_snapshotsテーブルから自分のデータだけを取得する。
      // .eq("user_id", user.id) = 自分のuser_idと一致するレコードだけ（RLSの二重対策）
      // .order(..., { ascending: false }) = 新しい順に並べる
      // .limit(24) = 最大24件（約2年分）に絞る
      const { data } = await supabase
        .from("asset_snapshots")
        .select("*")
        .eq("user_id", user.id)
        .order("snapshot_date", { ascending: false })
        .limit(24);

      if (data && data.length > 0) {
        setLatest(data[0]);              // 先頭が最新（降順なので）
        setHistory([...data].reverse()); // グラフ用に古→新の順に並び替え
      }
      setLoading(false); // 取得完了
    });
  }, []); // 空配列 = 画面表示時に1回だけ実行

  return { user, latest, history, loading };
}

// sum: AccountAmountの配列を受け取り、amountの合計を返すユーティリティ関数。
// 例: sum([{account:"自分", amount:1000}, {account:"妻", amount:500}]) → 1500
// reduce は配列を1つの値に集約するJavaScriptの標準メソッド。
//   acc = 累計（accumulator）、v = 現在の要素
//   初期値0 から始めて、各要素のamountを足していく
export function sum(arr: { amount: number }[]) {
  return arr.reduce((acc, v) => acc + v.amount, 0);
}

// formatJPY: JPY専用の金額フォーマット関数（後方互換のためにformatAmountを呼ぶ）
export function formatJPY(n: number) {
  return formatAmount(n, "JPY");
}

// formatAmount: 金額を通貨に応じて読みやすい文字列に変換する関数。
// 基準通貨がJPYかUSDかで表示形式を切り替える。
//
// JPY例:
//   150000000 → "1.5億円"
//   3200000   → "320万円"
//   50000     → "50,000円"
//
// USD例:
//   2500000 → "$2.50M"
//   15000   → "$15.0K"
//   350     → "$350.00"
//
// Math.abs(n) で絶対値を取り、負数の場合は sign="-" を先頭につける
export function formatAmount(n: number, currency: string) {
  const abs  = Math.abs(n);
  const sign = n < 0 ? "-" : "";

  if (currency === "USD") {
    if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)}M`;
    if (abs >= 1_000)     return `${sign}$${(abs / 1_000).toFixed(1)}K`;
    return `${sign}$${abs.toFixed(2)}`;
  }

  // JPY（デフォルト）
  if (abs >= 100_000_000) return `${sign}${(abs / 100_000_000).toFixed(1)}億円`;
  if (abs >= 10_000)      return `${sign}${Math.round(abs / 10_000)}万円`;
  return `${sign}${abs.toLocaleString()}円`;
}
