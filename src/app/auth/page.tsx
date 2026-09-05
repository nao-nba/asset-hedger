// ============================================================
// このファイルの役割（ログイン・新規登録ページ）:
//   URL: /auth
//   ログインと新規登録を1つのページで切り替えて提供する。
//
//   状態（useState）の一覧:
//     mode         : "login"（ログイン）か"register"（新規登録）かの切り替え
//     email        : メールアドレス入力値
//     password     : パスワード入力値
//     showPassword : パスワードの表示/非表示トグル
//     error        : エラーメッセージ（赤字）
//     message      : 成功メッセージ（緑字）
//     loading      : 送信中はtrue（ボタンを無効化するため）
// ============================================================

"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";

export default function AuthPage() {
  const [mode, setMode]               = useState<"login" | "register">("login");
  const [email, setEmail]             = useState("");
  const [password, setPassword]       = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]             = useState("");
  const [message, setMessage]         = useState("");
  const [loading, setLoading]         = useState(false);
  const router   = useRouter();
  const supabase = createClient();
  const { t, lang, setLang } = useI18n();

  // handleSubmit: フォームの送信ボタンが押されたときに実行される関数
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault(); // ブラウザのデフォルト動作（ページリロード）を防ぐ
    setError("");        // 前回のエラーをリセット
    setMessage("");      // 前回のメッセージをリセット

    // クライアントサイドのバリデーション（8文字未満はここで弾く）
    if (password.length < 8) {
      setError(t.passwordError);
      return;
    }

    setLoading(true); // ボタンを無効化して二重送信を防ぐ

    if (mode === "register") {
      // 新規登録: supabase.auth.signUp でユーザーを作成する
      // Supabaseはメールの重複チェックも行うが、セキュリティ上
      // 「既存メールです」とは表示せず、常に同じ文言を返す
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setMessage(t.signUpMessage); // 失敗でも同じ文言（セキュリティ設計）
      } else {
        setMessage(t.signUpMessage); // 成功でも同じ文言
      }
    } else {
      // ログイン: supabase.auth.signInWithPassword でメール+パスワード認証
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError(t.loginError); // 「メールアドレスまたはパスワードが正しくありません」
      } else {
        router.push("/dashboard"); // 成功したらダッシュボードへ
      }
    }

    setLoading(false); // ボタンを再び有効化
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* 言語切り替えボタン（右上）*/}
        <div className="flex justify-end mb-4">
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
        </div>

        {/* タイトル */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-white">Asset Hedger</h1>
          <p className="text-gray-400 mt-2 text-sm">{t.appTagline}</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-8 border border-gray-800">
          {/* ログイン / 新規登録 切り替えタブ */}
          <div className="flex rounded-lg bg-gray-800 p-1 mb-6">
            <button
              onClick={() => { setMode("login"); setError(""); setMessage(""); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "login" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"
              }`}
            >
              {t.login}
            </button>
            <button
              onClick={() => { setMode("register"); setError(""); setMessage(""); }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                mode === "register" ? "bg-white text-gray-900" : "text-gray-400 hover:text-white"
              }`}
            >
              {t.register}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* メールアドレス入力 */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t.email}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)} // 入力のたびにstateを更新
                required
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                placeholder="you@example.com"
              />
            </div>

            {/* パスワード入力（表示/非表示切り替え付き） */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">{t.password}</label>
              <div className="relative">
                {/* showPasswordがtrueなら type="text"（平文表示）、falseなら type="password"（●●●）*/}
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2.5 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500 transition-colors"
                  placeholder={t.passwordHint}
                />
                {/* 表示/非表示を切り替えるボタン（絶対配置でinputの右端に重ねる）*/}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition-colors text-xs"
                >
                  {showPassword ? t.hidePassword : t.showPassword}
                </button>
              </div>
            </div>

            {/* エラー・成功メッセージ（値があるときだけ表示）*/}
            {error   && <p className="text-red-400 text-sm bg-red-400/10 rounded-lg px-4 py-2">{error}</p>}
            {message && <p className="text-green-400 text-sm bg-green-400/10 rounded-lg px-4 py-2">{message}</p>}

            {/* 送信ボタン: loading中はdisabledにしてスタイルも変える */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 disabled:cursor-not-allowed text-white font-medium py-2.5 rounded-lg transition-colors"
            >
              {loading ? t.submitting : mode === "login" ? t.login : t.register}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
