"use client";

import { useSnapshot, sum, formatAmount } from "@/hooks/useSnapshot";
import { useI18n } from "@/lib/i18n";
import {
  LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

export default function DashboardPage() {
  const { user, latest, history, loading } = useSnapshot();
  const { t } = useI18n();
  const ccy = latest?.base_currency ?? "JPY";
  const fmt = (n: number) => formatAmount(n, ccy);

  if (!user) return null;

  const waitingFunds = latest ? sum(latest.summary_data.investment_funds ?? []) : null;
  const assetsFunds  = latest
    ? latest.assets_data
        .filter((a) => !a.is_watchlist)
        .reduce((acc, a) => acc + a.current_value_base, 0)
    : null;
  const investFunds = (waitingFunds !== null && assetsFunds !== null)
    ? waitingFunds + assetsFunds
    : null;

  const livingFunds = latest ? sum(latest.summary_data.living_funds) : null;
  const totalDebt   = latest ? sum(latest.summary_data.debts) : null;
  const totalAssets = (livingFunds !== null && investFunds !== null)
    ? livingFunds + investFunds
    : null;
  const netAssets = (totalAssets !== null && totalDebt !== null)
    ? totalAssets - totalDebt
    : null;
  const equityRatio    = netAssets !== null && totalAssets ? (netAssets / totalAssets) * 100 : null;
  const liquidityRatio = livingFunds !== null && totalDebt ? livingFunds / totalDebt : null;

  const chartData = history.map((s) => {
    const invest =
      sum(s.summary_data.investment_funds ?? []) +
      s.assets_data
        .filter((a) => !a.is_watchlist)
        .reduce((acc, a) => acc + a.current_value_base, 0);
    const living = sum(s.summary_data.living_funds);
    return {
      date: s.snapshot_date,
      [t.totalAssets]:    living + invest,
      [t.livingFunds]:    living,
      [t.investmentFunds]: invest,
    };
  });

  const equityLabel =
    equityRatio === null ? "" :
    equityRatio >= 50 ? t.equityGood :
    equityRatio >= 20 ? t.equityWarn :
    t.equityBad;

  return (
    <>
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-4 mb-8">
        <p className="text-xs text-gray-500 mb-1">{t.userIdLabel}</p>
        <p className="font-mono text-xs text-blue-400 break-all">{user.id}</p>
      </div>

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

          {/* サマリーカード上段 */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-4">
            {[
              {
                label: t.netAssets,
                value: netAssets,
                color: netAssets !== null && netAssets < 0 ? "text-red-400" : "text-white",
                note:  netAssets !== null && netAssets < 0 ? t.debtNote : "",
              },
              { label: t.totalAssets,   value: totalAssets, color: "text-blue-400",  note: t.totalAssetsNote },
              { label: t.livingFunds,   value: livingFunds, color: "text-green-400", note: "" },
            ].map(({ label, value, color, note }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`text-xl font-bold mt-1 ${color}`}>
                  {value !== null ? fmt(value) : "--"}
                </p>
                {note && <p className="text-xs text-gray-600 mt-1">{note}</p>}
              </div>
            ))}
          </div>

          {/* サマリーカード下段 */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            {[
              { label: t.investmentFunds, value: investFunds,   color: "text-yellow-400", note: t.investmentNote },
              { label: t.waitingFunds,    value: waitingFunds,  color: "text-orange-400", note: t.waitingNote },
            ].map(({ label, value, color, note }) => (
              <div key={label} className="bg-gray-900 border border-gray-800 rounded-2xl p-5">
                <p className="text-xs text-gray-400">{label}</p>
                <p className={`text-xl font-bold mt-1 ${color}`}>
                  {value !== null ? fmt(value) : "--"}
                </p>
                <p className="text-xs text-gray-600 mt-1">{note}</p>
              </div>
            ))}
          </div>

          {/* 財務健全性 */}
          <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
            <h3 className="text-sm font-medium text-gray-400 mb-4">{t.financialHealth}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <p className="text-xs text-gray-500 mb-1">{t.equityRatio}</p>
                <p className="text-3xl font-bold">
                  {equityRatio !== null ? `${equityRatio.toFixed(1)}%` : "--"}
                </p>
                <p className="text-xs text-gray-400 mt-1">{equityLabel}</p>
              </div>
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

          {/* 負債内訳 */}
          {latest.summary_data.debts.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-8">
              <h3 className="text-sm font-medium text-gray-400 mb-4">{t.debtBreakdown}</h3>
              <div className="space-y-3">
                {latest.summary_data.debts.map((debt, i) => (
                  <div key={i} className="flex items-center justify-between border-b border-gray-800/50 last:border-0 pb-3 last:pb-0">
                    <div>
                      <p className="text-sm font-medium">{debt.name}</p>
                      {debt.note && <p className="text-xs text-gray-500 mt-0.5">{debt.note}</p>}
                      <p className="text-xs text-gray-600">{debt.account}</p>
                    </div>
                    <p className="text-sm text-red-400 tabular-nums">{fmt(debt.amount)}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 時系列グラフ */}
          {chartData.length > 1 ? (
            <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
              <h3 className="text-sm font-medium text-gray-400 mb-6">{t.assetTrend}</h3>
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
                    formatter={(value) => typeof value === "number" ? fmt(value) : value}
                    contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px" }}
                    labelStyle={{ color: "#9ca3af" }}
                  />
                  <Legend wrapperStyle={{ color: "#9ca3af", fontSize: 12 }} />
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
