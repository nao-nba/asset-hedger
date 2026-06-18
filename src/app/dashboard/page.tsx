"use client";

import { useSnapshot, sum, formatJPY } from "@/hooks/useSnapshot";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export default function DashboardPage() {
  const { user, latest, history, loading } = useSnapshot();

  if (!user) return null;

  // 投資資金 = 全体資産の待機資金 + 明細の保有アセット評価額合計
  const investFunds = latest
    ? sum(latest.summary_data.investment_funds) +
      latest.assets_data
        .filter((a) => !a.is_watchlist)
        .reduce((acc, a) => acc + a.current_value_base, 0)
    : null;

  const livingFunds = latest ? sum(latest.summary_data.living_funds) : null;
  const totalDebt   = latest ? sum(latest.summary_data.debts) : null;
  const totalAssets = (livingFunds !== null && investFunds !== null)
    ? livingFunds + investFunds
    : null;
  const netAssets   = (totalAssets !== null && totalDebt !== null)
    ? totalAssets - totalDebt
    : null;
  const equityRatio    = netAssets !== null && totalAssets ? (netAssets / totalAssets) * 100 : null;
  const liquidityRatio = livingFunds !== null && totalDebt ? livingFunds / totalDebt : null;

  const chartData = history.map((s) => {
    const invest =
      sum(s.summary_data.investment_funds) +
      s.assets_data
        .filter((a) => !a.is_watchlist)
        .reduce((acc, a) => acc + a.current_value_base, 0);
    const living = sum(s.summary_data.living_funds);
    return {
      date: s.snapshot_date,
      総資産: living + invest,
      生活資金: living,
      投資資金: invest,
    };
  });

  const equityLabel =
    equityRatio === null ? "" :
    equityRatio >= 50 ? "✓ 健全: 家計が安定しています" :
    equityRatio >= 20 ? "△ 注意: ローン負担がやや大きめです" :
    "⚠ 要注意: ローン負担が大きい状態です";

  return (
    <>
      {/* UserID */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-8">
        <p className="text-xs text-gray-500 mb-1">UserID（スプレッドシートの B1 にコピペ）</p>
        <p className="font-mono text-xs text-blue-400 break-all">{user.id}</p>
      </div>

      {loading ? (
        <p className="text-gray-500 text-sm">読み込み中...</p>
      ) : !latest ? (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
          <p className="text-gray-400">データがありません</p>
          <p className="text-gray-500 text-sm mt-2">スプレッドシートで「同期する」を押してください</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold">資産の部</h2>
            <p className="text-sm text-gray-500">最終更新: {latest.snapshot_date}</p>
          </div>

          {/* サマリーカード */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            {[
              {
                label: "純資産",
                value: netAssets,
                color: netAssets !== null && netAssets < 0 ? "text-red-400" : "text-white",
                note: netAssets !== null && netAssets < 0 ? "※負債を含む" : ""
              },
              { label: "総資産", value: totalAssets, color: "text-blue-400", note: "生活資金＋投資資金" },
              { label: "生活資金", value: livingFunds, color: "text-green-400", note: "" },
              { label: "投資資金", value: investFunds, color: "text-yellow-400", note: "待機資金(現金)＋明細の評価額" },
            ].map(({ label, value, color, note }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`text-xl font-bold mt-1 ${color}`}>
                  {value !== null ? formatJPY(value) : "--"}
                </p>
                {note && <p className="text-xs text-gray-600 mt-1">{note}</p>}
              </div>
            ))}
          </div>

          {/* 財務健全性 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
            <h3 className="text-sm font-medium text-gray-400 mb-4">財務健全性</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">自己資本比率</p>
                <p className="text-3xl font-bold">
                  {equityRatio !== null ? `${equityRatio.toFixed(1)}%` : "--"}
                </p>
                <p className="text-xs text-gray-400 mt-1">{equityLabel}</p>
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-1">流動性比率（防衛余力）</p>
                <p className="text-3xl font-bold">
                  {liquidityRatio !== null ? liquidityRatio.toFixed(2) : "--"}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {liquidityRatio !== null && totalDebt
                    ? `負債の ${(liquidityRatio * 100).toFixed(0)}% を即座に現金でカバーできます`
                    : totalDebt === 0 ? "負債なし" : ""}
                </p>
              </div>
            </div>
          </div>

          {/* 負債内訳 */}
          {latest.summary_data.debts.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
              <h3 className="text-sm font-medium text-gray-400 mb-4">負債内訳</h3>
              <div className="space-y-3">
                {latest.summary_data.debts.map((debt, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-gray-800/50 last:border-0 pb-3 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">{debt.name}</p>
                      {debt.note && (
                        <p className="text-xs text-gray-500 mt-0.5">{debt.note}</p>
                      )}
                      <p className="text-xs text-gray-600">{debt.account}</p>
                    </div>
                    <p className="text-sm text-red-400 tabular-nums">{formatJPY(debt.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 時系列グラフ */}
          {chartData.length > 1 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-6">資産推移</h3>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" />
                  <XAxis dataKey="date" tick={{ fill: "#6b7280", fontSize: 11 }} />
                  <YAxis
                    tickFormatter={(v) => `${Math.round(v / 10000)}万`}
                    tick={{ fill: "#6b7280", fontSize: 11 }}
                    width={60}
                  />
                  <Tooltip
                    formatter={(value) => typeof value === "number" ? formatJPY(value) : value}
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px" }}
                    labelStyle={{ color: "#9ca3af" }}
                  />
                  <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
                  <Line type="monotone" dataKey="総資産" stroke="#60a5fa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="生活資金" stroke="#34d399" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="投資資金" stroke="#fbbf24" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 flex items-center justify-center h-40">
              <p className="text-gray-500 text-sm">資産推移グラフはデータが2件以上になると表示されます</p>
            </div>
          )}
        </>
      )}
    </>
  );
}
