// ============================================================
// このファイルの役割（資産の部ページ）:
//   URL: /dashboard
//   家計全体の財務状況を一覧表示するメインページ。
//
//   表示している情報:
//   1. UserID（スプレッドシートのB1にコピペするやつ）
//   2. サマリーカード: 純資産・総資産・生活防衛資金・投資資金
//   3. 財務健全性: 自己資本比率・流動性比率（防衛余力）
//   4. 負債内訳（ローンなど）
//   5. 資産推移グラフ（時系列の折れ線グラフ）
//
//   計算式まとめ:
//     投資資金   = 明細シートの保有アセット評価額合計
//     総資産     = 生活防衛資金 + 投資資金
//     純資産     = 総資産 - 負債合計
//     自己資本比率 = 純資産 / 総資産 × 100 (%)
//     流動性比率  = 生活防衛資金 / 負債合計
// ============================================================

"use client";

import { useSnapshot, sum, formatAmount } from "@/hooks/useSnapshot";
import { useI18n } from "@/lib/i18n";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export default function DashboardPage() {
  const { user, latest, history, loading } = useSnapshot(); // Supabaseからデータ取得
  const { t } = useI18n();
  const ccy = latest?.base_currency ?? "JPY"; // 基準通貨（JPYかUSD）
  // fmt: 金額を通貨に応じた文字列にフォーマットする関数（例: 320万円 or $3.2K）
  const fmt = (n: number) => formatAmount(n, ccy);

  // user が null = 未ログイン。useSnapshot内でリダイレクト処理が走るので、
  // ここでは何も描画しない（チラつき防止）
  if (!user) return null;

  // ── 計算 ──────────────────────────────────────────────────

  // 投資資金: 明細シートの保有アセット（ウォッチリスト除く）の評価額を合計
  // is_watchlist = true はまだ買っていない「検討中」なので除外する
  const investFunds = latest
    ? latest.assets_data
        .filter((a) => !a.is_watchlist)
        .reduce((acc, a) => acc + a.current_value_base, 0)
    : null;

  // 生活防衛資金: 全体資産シートの「生活資金」種別の金額合計
  // sum() は { amount }[] の配列を合計するユーティリティ（useSnapshot.tsで定義）
  const livingFunds = latest ? sum(latest.summary_data.living_funds) : null;

  // 負債合計: 全体資産シートの負債一覧を合計
  const totalDebt   = latest ? sum(latest.summary_data.debts) : null;

  // 総資産 = 生活防衛資金 + 投資資金
  // null チェック: どちらかがnull（データ未取得）なら総資産もnull
  const totalAssets = (livingFunds !== null && investFunds !== null)
    ? livingFunds + investFunds
    : null;

  // 純資産 = 総資産 - 負債合計
  const netAssets = (totalAssets !== null && totalDebt !== null)
    ? totalAssets - totalDebt
    : null;

  // 自己資本比率(%) = 純資産 / 総資産 × 100
  // totalAssets が0の場合は分母0になるのでnullにする
  const equityRatio    = netAssets !== null && totalAssets ? (netAssets / totalAssets) * 100 : null;

  // 流動性比率 = 生活防衛資金 / 負債合計（負債が0なら計算不要なのでnull）
  const liquidityRatio = livingFunds !== null && totalDebt ? livingFunds / totalDebt : null;

  // ── 時系列グラフ用データ ──────────────────────────────────
  // history（過去24件のスナップショット）を折れ線グラフ用の配列に変換する。
  // map() は配列の各要素を別の形に変換するメソッド。
  // recharts が求める形: [{ date: "2026-01-01", 総資産: 5000000, ... }, ...]
  const chartData = history.map((s) => {
    const invest = s.assets_data
      .filter((a) => !a.is_watchlist)
      .reduce((acc, a) => acc + a.current_value_base, 0);
    const living = sum(s.summary_data.living_funds);
    return {
      date: s.snapshot_date,
      [t.totalAssets]:    living + invest,  // キー名を翻訳テキストにする（凡例に使うため）
      [t.livingFunds]:    living,
      [t.investmentFunds]: invest,
    };
  });

  // 自己資本比率に応じたメッセージを選ぶ
  const equityLabel =
    equityRatio === null ? "" :
    equityRatio >= 50 ? t.equityGood :   // 50%以上: 健全
    equityRatio >= 20 ? t.equityWarn :   // 20〜50%: 注意
    t.equityBad;                          // 20%未満: 要注意

  return (
    <>
      {/* UserIDカード: スプレッドシートのB1にコピペするための表示 */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-8">
        <p className="text-xs text-gray-500 mb-1">{t.userIdLabel}</p>
        <p className="font-mono text-xs text-blue-400 break-all">{user.id}</p>
      </div>

      {/* loading中は「読み込み中」を表示。データがなければ案内を表示。 */}
      {loading ? (
        <p className="text-gray-500 text-sm">{t.loading}</p>
      ) : !latest ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
          <p className="text-gray-400">{t.noData}</p>
          <p className="text-gray-500 text-sm mt-2">{t.noDataHint}</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">{t.pageTitle}</h2>
            <p className="text-sm text-gray-500">{t.lastUpdated}: {latest.snapshot_date}</p>
          </div>

          {/* ── サマリーカード上段（3列）──
              配列に定義してmap()で展開している。
              増やしたいときはオブジェクトを追加するだけでいい。 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {[
              {
                label: t.netAssets,
                value: netAssets,
                color: netAssets !== null && netAssets < 0 ? "text-red-400" : "text-white",
                // 純資産がマイナスの場合だけ注記を表示
                note:  netAssets !== null && netAssets < 0 ? t.debtNote : "",
              },
              { label: t.totalAssets,   value: totalAssets, color: "text-blue-400",  note: t.totalAssetsNote },
              { label: t.livingFunds,   value: livingFunds, color: "text-green-400", note: "" },
            ].map(({ label, value, color, note }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-xs text-gray-400">{label}</p>
                {/* value が null のときは "--" を表示（データ未取得状態）*/}
                <p className={`text-xl font-bold mt-1 ${color}`}>
                  {value !== null ? fmt(value) : "--"}
                </p>
                {note && <p className="text-xs text-gray-600 mt-1">{note}</p>}
              </div>
            ))}
          </div>

          {/* ── サマリーカード下段（投資資金: フル幅）── */}
          <div className="mb-8">
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
              <p className="text-xs text-gray-400">{t.investmentFunds}</p>
              <p className="text-xl font-bold mt-1 text-yellow-400">
                {investFunds !== null ? fmt(investFunds) : "--"}
              </p>
              <p className="text-xs text-gray-600 mt-1">{t.investmentNote}</p>
            </div>
          </div>

          {/* ── 財務健全性 ── */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
            <h3 className="text-sm font-medium text-gray-400 mb-4">{t.financialHealth}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* 自己資本比率 */}
              <div>
                <p className="text-xs text-gray-500 mb-1">{t.equityRatio}</p>
                <p className="text-3xl font-bold">
                  {equityRatio !== null ? `${equityRatio.toFixed(1)}%` : "--"}
                </p>
                <p className="text-xs text-gray-400 mt-1">{equityLabel}</p>
              </div>
              {/* 流動性比率 */}
              <div>
                <p className="text-xs text-gray-500 mb-1">{t.liquidityRatio}</p>
                <p className="text-3xl font-bold">
                  {liquidityRatio !== null ? liquidityRatio.toFixed(2) : "--"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {liquidityRatio !== null && totalDebt
                    ? t.liquidityText((liquidityRatio * 100).toFixed(0) as unknown as number)
                    : totalDebt === 0 ? t.noDebt : ""}
                </p>
              </div>
            </div>
          </div>

          {/* ── 負債内訳（負債がある場合だけ表示）── */}
          {latest.summary_data.debts.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
              <h3 className="text-sm font-medium text-gray-400 mb-4">{t.debtBreakdown}</h3>
              <div className="space-y-3">
                {latest.summary_data.debts.map((debt, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-gray-800/50 last:border-0 pb-3 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">{debt.name}</p>
                      {/* 備考（GASで読んだD列）があれば表示 */}
                      {debt.note && <p className="text-xs text-gray-500 mt-0.5">{debt.note}</p>}
                      <p className="text-xs text-gray-600">{debt.account}</p>
                    </div>
                    <p className="text-sm text-red-400 tabular-nums">{fmt(debt.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── 時系列グラフ ──
              データが2件以上ないと折れ線グラフとして意味がないので、
              1件以下のときは案内メッセージを表示する。 */}
          {chartData.length > 1 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-6">{t.assetTrend}</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  {/* XAxis: 横軸 = スナップショット日付 */}
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  {/* YAxis: 縦軸 = 金額（万円単位に変換して表示）*/}
                  <YAxis
                    tickFormatter={(v) => `${Math.round(v / 10000)}万`}
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    width={60}
                  />
                  {/* Tooltip: マウスオーバー時のポップアップ表示 */}
                  <Tooltip
                    formatter={(value) => typeof value === "number" ? fmt(value) : value}
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px" }}
                    labelStyle={{ color: "#9ca3af" }}
                  />
                  <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
                  {/* 各折れ線: dataKey はchartDataのキー名（翻訳テキスト）と一致させる */}
                  <Line type="monotone" dataKey={t.totalAssets}    stroke="#60a5fa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={t.livingFunds}    stroke="#34d399" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey={t.investmentFunds} stroke="#fbbf24" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center justify-center h-40">
              <p className="text-gray-500 text-sm">{t.trendHint}</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
