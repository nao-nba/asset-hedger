"use client";

import { useState, useMemo } from "react";
import { useSnapshot, formatJPY } from "@/hooks/useSnapshot";
import type { Asset, Scenario } from "@/types/snapshot";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

const COLORS = [
  "#60a5fa", "#34d399", "#fbbf24", "#f87171", "#a78bfa",
  "#fb923c", "#38bdf8", "#4ade80", "#e879f9", "#94a3b8",
];

type PieEntry = { name: string; value: number };

// 同一アセット名 + 同一口座を合算
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
        current_ratio:      0, // 後で再計算
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

// 属性キーで現在配分を集計
function groupByAttr(assets: Asset[], key: string): PieEntry[] {
  const map = new Map<string, number>();
  for (const a of assets) {
    const label = a.flexible_items[key]?.trim() || "未設定";
    map.set(label, (map.get(label) ?? 0) + a.current_ratio);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }))
    .filter((e) => e.value > 0);
}

// 属性キーでシナリオ目標を集計（アセット名→属性値のマッピングを使う）
function groupScenarioByAttr(
  scenario: Scenario,
  allAssets: Asset[],
  key: string
): PieEntry[] {
  const attrOf = new Map<string, string>();
  for (const a of allAssets) {
    if (!attrOf.has(a.asset_name)) {
      attrOf.set(a.asset_name, a.flexible_items[key]?.trim() || "未設定");
    }
  }
  const map = new Map<string, number>();
  for (const [name, ratio] of Object.entries(scenario.targets)) {
    if (!ratio) continue;
    const label = attrOf.get(name) ?? "未設定";
    map.set(label, (map.get(label) ?? 0) + ratio);
  }
  return Array.from(map.entries())
    .map(([name, value]) => ({ name, value: Math.round(value * 10) / 10 }))
    .filter((e) => e.value > 0);
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
            formatter={(value) => typeof value === "number" ? `${value.toFixed(1)}%` : value}
            contentStyle={{ backgroundColor: "#111827", border: "1px solid #374151", borderRadius: "8px" }}
            labelStyle={{ color: "#9ca3af" }}
          />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: "#9ca3af" }} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

type RatioBarProps = { current: number; target: number };
function RatioBar({ current, target }: RatioBarProps) {
  const diff = current - target;
  const barColor =
    Math.abs(diff) <= 5 ? "bg-blue-500" :
    diff > 0 ? "bg-yellow-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-3">
      <div className="flex-1 bg-gray-800 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${barColor}`}
          style={{ width: `${Math.min(Math.max(current, 0), 100)}%` }}
        />
      </div>
      <span className="text-xs tabular-nums w-12 text-right text-gray-300">
        {current.toFixed(1)}%
      </span>
      <span className={`text-xs tabular-nums w-16 text-right font-medium ${
        Math.abs(diff) <= 5 ? "text-gray-500" :
        diff > 0 ? "text-yellow-400" : "text-red-400"
      }`}>
        {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
      </span>
    </div>
  );
}

export default function AssetsPage() {
  const { latest, loading } = useSnapshot();
  const [activeScenario, setActiveScenario] = useState<number>(0);
  const [groupKey, setGroupKey]             = useState<string>("asset");

  if (loading) return <p className="text-gray-500 text-sm">読み込み中...</p>;
  if (!latest) return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-10 text-center">
      <p className="text-gray-400">データがありません</p>
      <p className="text-gray-500 text-sm mt-2">スプレッドシートで「同期する」を押してください</p>
    </div>
  );

  const allAssets: Asset[]   = latest.assets_data;
  const scenarios: Scenario[] = latest.scenario_data;
  const currentScenario       = scenarios[activeScenario];

  // 合算済みの保有アセット・ウォッチリスト
  const heldAssets      = useMemo(() => mergeAssets(allAssets.filter((a) => !a.is_watchlist)), [allAssets]);
  const watchlistAssets = allAssets.filter(
    (a) => a.is_watchlist && (currentScenario?.targets[a.asset_name] ?? 0) > 0
  );

  const totalValue = heldAssets.reduce((sum, a) => sum + a.current_value_base, 0);

  // 自由項目キーの一覧（明細シートのI列以降の列名）
  const attrKeys: string[] = useMemo(() => {
    const keys = new Set<string>();
    for (const a of allAssets) {
      for (const k of Object.keys(a.flexible_items)) {
        if (k) keys.add(k);
      }
    }
    return Array.from(keys);
  }, [allAssets]);

  // 円グラフ用データ（グルーピング対応）
  const currentPieData: PieEntry[] = useMemo(() => {
    if (groupKey === "asset") {
      return heldAssets.filter((a) => a.current_ratio > 0).map((a) => ({ name: a.asset_name, value: a.current_ratio }));
    }
    return groupByAttr(heldAssets, groupKey);
  }, [heldAssets, groupKey]);

  const scenarioPieData: PieEntry[] = useMemo(() => {
    if (!currentScenario) return [];
    if (groupKey === "asset") {
      return Object.entries(currentScenario.targets)
        .filter(([, v]) => v > 0)
        .map(([name, value]) => ({ name, value }));
    }
    return groupScenarioByAttr(currentScenario, allAssets, groupKey);
  }, [currentScenario, allAssets, groupKey]);

  const getTarget = (assetName: string): number =>
    currentScenario?.targets[assetName] ?? 0;

  const calcMoveAmount = (asset: Asset): number => {
    const diff = getTarget(asset.asset_name) - asset.current_ratio;
    return (diff / 100) * totalValue;
  };

  return (
    <>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold">アセット明細</h2>
        <p className="text-sm text-gray-500">最終更新: {latest.snapshot_date}</p>
      </div>

      {/* シナリオ切り替え */}
      {scenarios.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <p className="text-xs text-gray-500 mb-3">シナリオを選択して目標比率を切り替える</p>
          <div className="flex flex-wrap gap-2">
            {scenarios.map((s, i) => (
              <button
                key={s.name}
                onClick={() => setActiveScenario(i)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeScenario === i
                    ? "bg-blue-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
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
                  <span className="text-gray-500 text-xs block mb-0.5">前提条件</span>
                  <p className="text-gray-300">{currentScenario.description}</p>
                </div>
              )}
              {currentScenario.trigger && (
                <div>
                  <span className="text-gray-500 text-xs block mb-0.5">トリガー</span>
                  <p className="text-yellow-400 font-mono">{currentScenario.trigger}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 円グラフ */}
      {currentScenario && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400">配分比較</h3>
            {/* グルーピング切り替え */}
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="text-xs text-gray-600">グループ:</span>
              {["asset", ...attrKeys].map((key) => (
                <button
                  key={key}
                  onClick={() => setGroupKey(key)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                    groupKey === key
                      ? "bg-gray-700 text-white"
                      : "bg-gray-800/50 text-gray-500 hover:text-gray-300"
                  }`}
                >
                  {key === "asset" ? "アセット別" : key}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-4">
            <AssetPieChart data={currentPieData} title="現在の配分" />
            <AssetPieChart data={scenarioPieData} title={`目標: ${currentScenario.name}`} />
          </div>
        </div>
      )}

      {/* 比率バー + 移動金額 */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-medium text-gray-400">現在比率 vs 目標比率</h3>
          <p className="text-xs text-gray-600">投資総額: {formatJPY(totalValue)}</p>
        </div>
        <div className="space-y-5">
          {heldAssets.map((asset) => {
            const target      = getTarget(asset.asset_name);
            const diff        = asset.current_ratio - target;
            const moveAmount  = calcMoveAmount(asset);
            const needsAction = target > 0 && Math.abs(diff) > 5;

            return (
              <div key={`${asset.asset_name}::${asset.account}`}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{asset.asset_name}</span>
                    {asset.ticker && (
                      <span className="text-xs text-gray-500 font-mono">{asset.ticker}</span>
                    )}
                    <span className="text-xs text-gray-600">{asset.account}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500">{formatJPY(asset.current_value_base)}</span>
                    <span className="text-xs text-gray-500">目標 {target}%</span>
                    {needsAction && (
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        diff > 0
                          ? "bg-yellow-400/10 text-yellow-400"
                          : "bg-red-400/10 text-red-400"
                      }`}>
                        {diff > 0
                          ? `▼ ${formatJPY(Math.abs(moveAmount))} 売却検討`
                          : `▲ ${formatJPY(Math.abs(moveAmount))} 追加検討`}
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
      </div>

      {/* 検討中アセット */}
      {watchlistAssets.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            検討中アセット
            <span className="text-xs text-gray-600 ml-2">現在未保有・将来の購入候補</span>
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
                      {asset.ticker && (
                        <span className="text-xs text-gray-500 font-mono">{asset.ticker}</span>
                      )}
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400">未保有</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {target > 0 && (
                        <span className="text-xs text-gray-500">このシナリオの目標: {target}%</span>
                      )}
                      {buyAmount !== null && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-green-400/10 text-green-400">
                          ▲ {formatJPY(buyAmount)} 購入検討
                        </span>
                      )}
                    </div>
                  </div>
                  {asset.investment_memo && (
                    <p className="text-xs text-gray-400 mt-1">{asset.investment_memo}</p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 保有明細テーブル */}
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
        <h3 className="text-sm font-medium text-gray-400 mb-4">保有明細</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-gray-500 border-b border-gray-800">
                <th className="text-left pb-3 pr-4">資産名</th>
                <th className="text-left pb-3 pr-4">口座</th>
                <th className="text-right pb-3 pr-4">数量</th>
                <th className="text-right pb-3 pr-4">現在価格</th>
                <th className="text-right pb-3 pr-4">通貨</th>
                <th className="text-right pb-3">評価額</th>
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
                  <td className="py-3 text-right tabular-nums text-blue-400">{formatJPY(asset.current_value_base)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
