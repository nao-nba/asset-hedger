"use client";

import { useState, useMemo } from "react";
import { useSnapshot, formatAmount } from "@/hooks/useSnapshot";
import { useI18n } from "@/lib/i18n";
import type { Asset, Scenario } from "@/types/snapshot";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa",
  "#fb923c", "#38bdf8", "#4ade80", "#e879f9", "#94a3b8",
];

type PieEntry = { name: string; value: number };

type GroupRatio = {
  name: string;
  currentRatio: number;
  targetRatio: number;
  currentValue: number;
};

// 同一アセット名 + 同一口座を合算（テーブル用）
function mergeAssets(assets: Asset[]): Asset[] {
  const map = new Map<string, Asset>();
  for (const asset of assets) {
    const key = `${asset.asset_name}::${asset.account}`;
    if (map.has(key)) {
      const ex = map.get(key)!;
      map.set(key, {
        ...ex,
        quantity:           ex.quantity + asset.quantity,
        current_value_base: ex.current_value_base + asset.current_value_base,
        current_ratio:      0,
        investment_memo:    [ex.investment_memo, asset.investment_memo].filter(Boolean).join(" / "),
      });
    } else {
      map.set(key, { ...asset });
    }
  }
  const merged = Array.from(map.values());
  const total  = merged.reduce((s, a) => s + a.current_value_base, 0);
  return merged.map((a) => ({
    ...a,
    current_ratio: total > 0 ? Math.round((a.current_value_base / total) * 1000) / 10 : 0,
  }));
}

// 同一アセット名で口座をまたいで合算（比率バー用）
function mergeAssetsByName(assets: Asset[]): Asset[] {
  const map = new Map<string, Asset>();
  for (const asset of assets) {
    const key = asset.asset_name;
    if (map.has(key)) {
      const ex = map.get(key)!;
      const accounts = [...new Set([ex.account, asset.account].filter(Boolean))];
      map.set(key, {
        ...ex,
        account:            accounts.join(" / "),
        quantity:           ex.quantity + asset.quantity,
        current_value_base: ex.current_value_base + asset.current_value_base,
        current_ratio:      0,
        investment_memo:    [ex.investment_memo, asset.investment_memo].filter(Boolean).join(" / "),
      });
    } else {
      map.set(key, { ...asset });
    }
  }
  const merged = Array.from(map.values());
  const total  = merged.reduce((s, a) => s + a.current_value_base, 0);
  return merged.map((a) => ({
    ...a,
    current_ratio: total > 0 ? Math.round((a.current_value_base / total) * 1000) / 10 : 0,
  }));
}

// 保有アセットを基準に属性グループ別の現在比率・目標比率を集計
// heldByName は口座をまたいで同一アセット名を合算済みのリスト
function calcGroupRatios(
  heldByName: Asset[],
  scenario: Scenario | undefined,
  key: string
): GroupRatio[] {
  const groups = new Map<string, GroupRatio>();

  for (const a of heldByName) {
    const label  = a.flexible_items[key]?.trim() || "—";
    const target = scenario?.targets[a.asset_name] ?? 0;
    const g      = groups.get(label) ?? { name: label, currentRatio: 0, targetRatio: 0, currentValue: 0 };
    groups.set(label, {
      name:         label,
      currentRatio: g.currentRatio + a.current_ratio,
      targetRatio:  g.targetRatio  + target,
      currentValue: g.currentValue + a.current_value_base,
    });
  }

  return Array.from(groups.values()).sort((a, b) => b.currentRatio - a.currentRatio);
}

function AssetPieChart({ data, title }: { data: PieEntry[]; title: string }) {
  return (
    <div className="flex-1">
      <p className="text-xs text-gray-500 text-center mb-2">{title}</p>
      <ResponsiveContainer width="100%" height={220}>
        <PieChart>
          <Pie
            data={data}
            cx="50%" cy="50%"
            innerRadius={55} outerRadius={85}
            paddingAngle={2}
            dataKey="value"
          >
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip
            formatter={(v) => typeof v === "number" ? `${v.toFixed(1)}%` : v}
            contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px" }}
            labelStyle={{ color: "#9ca3af" }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function RatioBar({ current, target }: { current: number; target: number }) {
  const diff     = current - target;
  const barColor = Math.abs(diff) <= 5 ? "bg-blue-500" : diff > 0 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(Math.max(current, 0), 100)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums w-12 text-right text-gray-300">{current.toFixed(1)}%</span>
      <span className={`text-xs tabular-nums w-16 text-right font-medium ${
        Math.abs(diff) <= 5 ? "text-gray-500" : diff > 0 ? "text-yellow-400" : "text-red-400"
      }`}>
        {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
      </span>
    </div>
  );
}

export default function AssetsPage() {
  const { latest, loading } = useSnapshot();
  const { t } = useI18n();
  const [activeScenario, setActiveScenario] = useState<number>(0);
  const [groupKey, setGroupKey]             = useState<string | null>(null);

  const allAssets: Asset[]    = latest?.assets_data ?? [];
  const scenarios: Scenario[] = latest?.scenario_data ?? [];
  const currentScenario       = scenarios[activeScenario];
  const ccy = latest?.base_currency ?? "JPY";
  const fmt = (n: number) => formatAmount(n, ccy);

  const heldAssets = useMemo(
    () => mergeAssets(allAssets.filter((a) => !a.is_watchlist)),
    [allAssets]
  );
  const heldAssetsByName = useMemo(
    () => mergeAssetsByName(allAssets.filter((a) => !a.is_watchlist)),
    [allAssets]
  );
  const watchlistAssets = useMemo(
    () => allAssets.filter((a) => a.is_watchlist && (currentScenario?.targets[a.asset_name] ?? 0) > 0),
    [allAssets, currentScenario]
  );
  const totalValue = heldAssets.reduce((sum, a) => sum + a.current_value_base, 0);

  const attrKeys: string[] = useMemo(() => {
    const keys = new Set<string>();
    for (const a of allAssets) {
      for (const k of Object.keys(a.flexible_items)) {
        if (k) keys.add(k);
      }
    }
    return Array.from(keys);
  }, [allAssets]);

  // デフォルトは最初の自由項目、なければアセット別
  const effectiveKey = groupKey ?? (attrKeys[0] ?? "asset");

  const currentPieData: PieEntry[] = useMemo(() => {
    if (effectiveKey === "asset") {
      return heldAssetsByName.filter((a) => a.current_ratio > 0).map((a) => ({ name: a.asset_name, value: a.current_ratio }));
    }
    const groups = calcGroupRatios(heldAssetsByName, undefined, effectiveKey);
    return groups.filter((g) => g.currentRatio > 0).map((g) => ({ name: g.name, value: Math.round(g.currentRatio * 10) / 10 }));
  }, [heldAssetsByName, effectiveKey]);

  const scenarioPieData: PieEntry[] = useMemo(() => {
    if (!currentScenario) return [];
    if (effectiveKey === "asset") {
      return heldAssetsByName
        .filter((a) => (currentScenario.targets[a.asset_name] ?? 0) > 0)
        .map((a) => ({ name: a.asset_name, value: currentScenario.targets[a.asset_name] }));
    }
    const groups = calcGroupRatios(heldAssetsByName, currentScenario, effectiveKey);
    return groups.filter((g) => g.targetRatio > 0).map((g) => ({ name: g.name, value: Math.round(g.targetRatio * 10) / 10 }));
  }, [currentScenario, heldAssetsByName, effectiveKey]);

  const groupRatios: GroupRatio[] = useMemo(() => {
    if (effectiveKey === "asset") return [];
    return calcGroupRatios(heldAssetsByName, currentScenario, effectiveKey);
  }, [heldAssetsByName, currentScenario, effectiveKey]);

  const getTarget = (assetName: string) => currentScenario?.targets[assetName] ?? 0;

  if (loading) return <p className="text-gray-500 text-sm">{t.loading}</p>;
  if (!latest) return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
      <p className="text-gray-400">{t.noData}</p>
      <p className="text-gray-500 text-sm mt-2">{t.noDataHint}</p>
    </div>
  );

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">{t.assetPageTitle}</h2>
        <p className="text-sm text-gray-500">{t.lastUpdated}: {latest.snapshot_date}</p>
      </div>

      {/* シナリオ切り替え */}
      {scenarios.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <p className="text-xs text-gray-500 mb-3">{t.scenarioHint}</p>
          <div className="flex flex-wrap gap-2">
            {scenarios.map((s, i) => (
              <button
                key={s.name}
                onClick={() => setActiveScenario(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeScenario === i ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          {currentScenario && (currentScenario.description || currentScenario.trigger) && (
            <div className="mt-4 pt-4 border-t border-gray-800 flex flex-wrap gap-6 text-sm">
              {currentScenario.description && (
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">{t.condition}</span>
                  <p className="text-gray-300">{currentScenario.description}</p>
                </div>
              )}
              {currentScenario.trigger && (
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">{t.trigger}</span>
                  <p className="text-yellow-400 font-mono">{currentScenario.trigger}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 配分比較グラフ */}
      {currentScenario && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400">{t.allocComparison}</h3>
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="text-xs text-gray-600">{t.groupBy}</span>
              {[...(attrKeys.length > 0 ? attrKeys : []), "asset"].map((key) => (
                <button
                  key={key}
                  onClick={() => setGroupKey(key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    effectiveKey === key
                      ? "bg-gray-700 text-white"
                      : "bg-gray-800/50 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {key === "asset" ? t.byAsset : key}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <AssetPieChart data={currentPieData} title={t.currentAlloc} />
            <AssetPieChart data={scenarioPieData} title={t.targetAlloc(currentScenario.name)} />
          </div>
        </div>
      )}

      {/* リバランス指示 */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-medium text-gray-400">{t.ratioVsTarget}</h3>
          <p className="text-xs text-gray-600">{t.totalInvested}: {fmt(totalValue)}</p>
        </div>

        {/* 属性グループ別リバランス */}
        {effectiveKey !== "asset" && groupRatios.length > 0 ? (
          <div className="space-y-5">
            {groupRatios.map((g) => {
              const diff        = g.currentRatio - g.targetRatio;
              const moveAmount  = ((g.targetRatio - g.currentRatio) / 100) * totalValue;
              const needsAction = g.targetRatio > 0 && Math.abs(diff) > 5;
              return (
                <div key={g.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">{g.name}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{fmt(g.currentValue)}</span>
                      {g.targetRatio > 0 && (
                        <span className="text-xs text-gray-500">{t.targetLabel(g.targetRatio)}</span>
                      )}
                      {needsAction && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          diff > 0 ? "bg-yellow-400/10 text-yellow-400" : "bg-red-400/10 text-red-400"
                        }`}>
                          {diff > 0
                            ? t.sellNote(fmt(Math.abs(moveAmount)))
                            : t.buyNote(fmt(Math.abs(moveAmount)))}
                        </span>
                      )}
                    </div>
                  </div>
                  <RatioBar current={g.currentRatio} target={g.targetRatio} />
                </div>
              );
            })}
          </div>
        ) : (
          /* アセット別リバランス（フォールバック） */
          <div className="space-y-5">
            {heldAssetsByName.map((asset) => {
              const target      = getTarget(asset.asset_name);
              const diff        = asset.current_ratio - target;
              const moveAmount  = ((target - asset.current_ratio) / 100) * totalValue;
              const needsAction = target > 0 && Math.abs(diff) > 5;
              return (
                <div key={asset.asset_name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{asset.asset_name}</span>
                      {asset.ticker && <span className="text-xs text-gray-500 font-mono">{asset.ticker}</span>}
                      <span className="text-xs text-gray-600">{asset.account}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-gray-500">{fmt(asset.current_value_base)}</span>
                      <span className="text-xs text-gray-500">{t.targetLabel(target)}</span>
                      {needsAction && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          diff > 0 ? "bg-yellow-400/10 text-yellow-400" : "bg-red-400/10 text-red-400"
                        }`}>
                          {diff > 0 ? t.sellNote(fmt(Math.abs(moveAmount))) : t.buyNote(fmt(Math.abs(moveAmount)))}
                        </span>
                      )}
                    </div>
                  </div>
                  <RatioBar current={asset.current_ratio} target={target} />
                  {asset.investment_memo && (
                    <p className="text-xs text-gray-600 mt-1 ml-0.5">{asset.investment_memo}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 検討中アセット */}
      {watchlistAssets.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            {t.watchlist}
            <span className="text-xs text-gray-600 ml-2">{t.watchlistNote}</span>
          </h3>
          <div className="space-y-4">
            {watchlistAssets.map((asset) => {
              const target    = getTarget(asset.asset_name);
              const buyAmount = target > 0 ? (target / 100) * totalValue : null;
              return (
                <div key={asset.asset_name} className="border-b border-gray-800/50 last:border-0 pb-4 last:pb-0">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{asset.asset_name}</span>
                      {asset.ticker && <span className="text-xs text-gray-500 font-mono">{asset.ticker}</span>}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">{t.notHeld}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {target > 0 && <span className="text-xs text-gray-500">{t.scenarioTarget(target)}</span>}
                      {buyAmount !== null && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-400/10 text-green-400">
                          {t.buyConsider(fmt(buyAmount))}
                        </span>
                      )}
                    </div>
                  </div>
                  {asset.investment_memo && <p className="text-xs text-gray-400 mt-1">{asset.investment_memo}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 保有明細テーブル */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">{t.holdingsTable}</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-3 pr-4">{t.colAsset}</th>
                <th className="text-left pb-3 pr-4">{t.colAccount}</th>
                <th className="text-right pb-3 pr-4">{t.colQty}</th>
                <th className="text-right pb-3 pr-4">{t.colPrice}</th>
                <th className="text-right pb-3 pr-4">{t.colCurrency}</th>
                <th className="text-right pb-3">{t.colValue}</th>
              </tr>
            </thead>
            <tbody>
              {heldAssets.map((asset, i) => (
                <tr key={i} className="border-b border-gray-800/50 last:border-0">
                  <td className="py-3 pr-4 font-medium">{asset.asset_name}</td>
                  <td className="py-3 pr-4 text-gray-400">{asset.account}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{asset.quantity.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right tabular-nums">{asset.current_price.toLocaleString()}</td>
                  <td className="py-3 pr-4 text-right text-gray-400">{asset.currency}</td>
                  <td className="py-3 text-right tabular-nums text-blue-400">{fmt(asset.current_value_base)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
