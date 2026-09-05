// ============================================================
// このファイルの役割（アセット明細ページ）:
//   URL: /dashboard/assets
//   投資ポートフォリオの詳細を表示する。
//
//   表示している情報:
//   1. シナリオ切り替えボタン（Base Case / Risk-off など）
//   2. 配分比較グラフ（現在の配分 vs 選択したシナリオの目標）
//   3. 現在比率 vs 目標比率バー（リバランス指示）
//   4. 検討中アセット（ウォッチリスト）
//   5. 保有明細テーブル
//
//   データの流れ:
//   スプレッドシート → GAS → Supabase → useSnapshot() → このページ
// ============================================================

"use client";

import { useState, useMemo } from "react";
import { useSnapshot, formatAmount } from "@/hooks/useSnapshot";
import { useI18n } from "@/lib/i18n";
import type { Asset, Scenario } from "@/types/snapshot";
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
} from "recharts";

// ── カラーパレット ─────────────────────────────────────────
// 12色。属性名や資産名に順番に割り当てる。
// 左右のパイグラフで同じ名前が同じ色になるよう、後で buildColorMap で管理する。
const PALETTE = [
  "#3b82f6", // blue
  "#22c55e", // green
  "#f59e0b", // amber
  "#ef4444", // red
  "#8b5cf6", // violet
  "#f97316", // orange
  "#06b6d4", // cyan
  "#ec4899", // pink
  "#84cc16", // lime
  "#14b8a6", // teal
  "#a855f7", // purple
  "#eab308", // yellow
];

// buildColorMap: 名前の配列を受け取り「名前 → 色」のMapを返す。
// Map は「キーと値のペア」を管理するJavaScriptのデータ構造。
// 同じ名前が来ても2回目以降は無視する（一意に割り当てるため）。
function buildColorMap(names: string[]): Map<string, string> {
  const map = new Map<string, string>();
  let i = 0;
  for (const name of names) {
    if (!map.has(name)) map.set(name, PALETTE[i++ % PALETTE.length]);
  }
  return map;
}

// ── 型定義 ────────────────────────────────────────────────
// PieEntry: 円グラフの1スライス分のデータ形式（rechartsが要求する形）
type PieEntry = { name: string; value: number };

// GroupRatio: 属性グループ別のリバランス情報
type GroupRatio = {
  name: string;         // 属性値（例: "Global"）
  currentRatio: number; // 現在の比率(%)
  targetRatio: number;  // 目標の比率(%)
  currentValue: number; // 現在の評価額
};

// ── ユーティリティ関数 ────────────────────────────────────

// mergeAssets: 「同じ資産名 + 同じ口座」のアセットを1行にまとめる関数（テーブル表示用）
// 例: 自分口座のVTが2行に分かれていたら合算して1行にする。
// Map のキーを "資産名::口座名" にして重複を検出する。
function mergeAssets(assets: Asset[]): Asset[] {
  const map = new Map<string, Asset>();
  for (const asset of assets) {
    const key = `${asset.asset_name}::${asset.account}`;
    if (map.has(key)) {
      // 既存のエントリに数量・評価額を加算する
      const ex = map.get(key)!;
      map.set(key, {
        ...ex,
        quantity:           ex.quantity + asset.quantity,
        current_value_base: ex.current_value_base + asset.current_value_base,
        current_ratio:      0, // 後で再計算するので一旦0
        // 両方にメモがあれば " / " でつなげる。filter(Boolean)で空文字を除去
        investment_memo:    [ex.investment_memo, asset.investment_memo].filter(Boolean).join(" / "),
      });
    } else {
      map.set(key, { ...asset }); // 初回は そのまま登録
    }
  }
  // 合算後に全体の合計から比率を再計算する
  const merged = Array.from(map.values());
  const total  = merged.reduce((s, a) => s + a.current_value_base, 0);
  return merged.map((a) => ({
    ...a,
    current_ratio: total > 0 ? Math.round((a.current_value_base / total) * 1000) / 10 : 0,
  }));
}

// mergeAssetsByName: 「同じ資産名」のアセットを口座をまたいで合算する関数（比率バー・パイグラフ用）
// 例: 自分口座のVT + 妻口座のVT → VT（自分 / 妻）として1行にする。
// 複数口座があれば口座名を " / " でつなげる。
function mergeAssetsByName(assets: Asset[]): Asset[] {
  const map = new Map<string, Asset>();
  for (const asset of assets) {
    const key = asset.asset_name; // 口座を無視して資産名だけでキーにする
    if (map.has(key)) {
      const ex = map.get(key)!;
      // Set を使って口座名の重複を除去してからまとめる
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

// calcGroupRatios: 属性グループ別の現在比率・目標比率を集計する関数。
// 引数:
//   heldByName  : 口座をまたいで合算済みの保有アセット一覧
//   scenario    : 選択中のシナリオ（目標比率が入っている）
//   key         : グルーピングに使う自由項目のキー名（例: "Region"）
//
// ★ 重要な設計:
//   シナリオシートの列ヘッダー = 属性値（例: "Global", "US", "Gold"）
//   つまり scenario.targets のキーは属性値そのものなので、
//   アセット名との変換なしにそのまま属性グループに対応させられる。
function calcGroupRatios(
  heldByName: Asset[],
  scenario: Scenario | undefined,
  key: string
): GroupRatio[] {
  const groups = new Map<string, GroupRatio>();

  // 現在比率: 各アセットの flexible_items[key] の値でグループを作り、比率を合計する
  // 例: key="Region" のとき、"Global" グループに VT(20%) + VEA(15%) = 35% が入る
  for (const a of heldByName) {
    const label = a.flexible_items[key]?.trim() || "—"; // 未設定なら "—"
    const g     = groups.get(label) ?? { name: label, currentRatio: 0, targetRatio: 0, currentValue: 0 };
    groups.set(label, {
      name:         label,
      currentRatio: g.currentRatio + a.current_ratio,
      targetRatio:  g.targetRatio,
      currentValue: g.currentValue + a.current_value_base,
    });
  }

  // 目標比率: scenario.targets のキーが属性値そのものなのでそのまま対応する
  // 例: { "Global": 40, "US": 30, "Gold": 15, "Cash": 15 }
  if (scenario) {
    for (const [label, ratio] of Object.entries(scenario.targets)) {
      if (!ratio) continue; // 0 や undefined はスキップ
      const g = groups.get(label) ?? { name: label, currentRatio: 0, targetRatio: 0, currentValue: 0 };
      groups.set(label, { ...g, targetRatio: g.targetRatio + (ratio as number) });
    }
  }

  // 現在比率の高い順に並べて返す
  return Array.from(groups.values()).sort((a, b) => b.currentRatio - a.currentRatio);
}

// ── コンポーネント ────────────────────────────────────────

// AssetPieChart: ドーナツ型の円グラフコンポーネント。
// 左（現在配分）と右（目標配分）で同じコンポーネントを使い回す。
// colorMap を共有することで、同じ名前が左右で同じ色になる。
function AssetPieChart({
  data,
  title,
  colorMap,
}: {
  data: PieEntry[];
  title: string;
  colorMap: Map<string, string>;
}) {
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
            startAngle={90}   // 12時方向からスタート
            endAngle={-270}   // 時計回りに一周
          >
            {/* 各スライスに colorMap から色を取得して塗る */}
            {data.map((entry) => (
              <Cell key={entry.name} fill={colorMap.get(entry.name) ?? "#94a3b8"} />
            ))}
          </Pie>
          {/* マウスオーバー時のポップアップ: 値を小数第1位の%表示にする */}
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

// RatioBar: 現在比率と目標比率を横棒グラフで比較するコンポーネント。
// current = 現在の%、target = 目標の%
// 差が±5%以内なら青（良好）、オーバーなら黄（売却検討）、不足なら赤（買い増し検討）
function RatioBar({ current, target }: { current: number; target: number }) {
  const diff      = current - target;            // 正 = 超過、負 = 不足
  const absDiff   = Math.abs(diff);
  const isGood    = absDiff <= 5;               // ±5%以内なら良好とみなす
  const barColor  = isGood ? "bg-blue-500" : diff > 0 ? "bg-yellow-500" : "bg-red-500";
  const diffColor = isGood ? "text-gray-500" : diff > 0 ? "text-yellow-400" : "text-red-400";

  return (
    <div className="space-y-1">
      {/* バー部分 */}
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-gray-800 rounded-full h-1.5 overflow-hidden relative">
          {/* 目標位置のマーカー（縦の細い線）*/}
          {target > 0 && (
            <div
              className="absolute top-0 h-full w-0.5 bg-gray-400 opacity-60"
              style={{ left: `${Math.min(target, 100)}%` }}
            />
          )}
          {/* 現在比率のバー（幅を current% に設定）*/}
          <div
            className={`h-full rounded-full transition-all ${barColor}`}
            style={{ width: `${Math.min(Math.max(current, 0), 100)}%` }}
          />
        </div>
      </div>
      {/* 数値テキスト行: 「現在 X% → 目標 Y%」と偏差 */}
      <div className="flex items-center justify-between text-xs tabular-nums">
        <span className="text-gray-400">
          現在 <span className="text-white font-medium">{current.toFixed(1)}%</span>
          {target > 0 && (
            <> → 目標 <span className="text-gray-300">{target.toFixed(1)}%</span></>
          )}
        </span>
        {target > 0 && (
          <span className={`font-medium ${diffColor}`}>
            {diff > 0 ? "+" : ""}{diff.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

// ── メインコンポーネント ───────────────────────────────────
export default function AssetsPage() {
  const { latest, loading } = useSnapshot();
  const { t } = useI18n();

  // useState: ユーザーの操作によって変わる状態
  const [activeScenario, setActiveScenario] = useState<number>(0);    // 選択中のシナリオのインデックス
  const [groupKey, setGroupKey]             = useState<string | null>(null); // グルーピングキー（null=デフォルト）

  // データの取り出し（latest が null のときは空配列をデフォルト値にする）
  const allAssets: Asset[]    = latest?.assets_data ?? [];
  const scenarios: Scenario[] = latest?.scenario_data ?? [];
  const currentScenario       = scenarios[activeScenario]; // 選択中のシナリオオブジェクト
  const ccy = latest?.base_currency ?? "JPY";
  const fmt = (n: number) => formatAmount(n, ccy);

  // useMemo: 計算コストの高い処理をメモ化する（依存する値が変わったときだけ再計算）。
  // 毎レンダリングで再計算しないための最適化。

  // 保有アセット（テーブル用）: ウォッチリスト除外 → 同名同口座で合算
  const heldAssets = useMemo(
    () => mergeAssets(allAssets.filter((a) => !a.is_watchlist)),
    [allAssets]
  );

  // 保有アセット（グラフ・比率バー用）: ウォッチリスト除外 → 口座をまたいで同名で合算
  const heldAssetsByName = useMemo(
    () => mergeAssetsByName(allAssets.filter((a) => !a.is_watchlist)),
    [allAssets]
  );

  // 検討中アセット: is_watchlist=true かつ 選択シナリオに目標比率がある資産だけ表示
  const watchlistAssets = useMemo(
    () => allAssets.filter((a) => a.is_watchlist && (currentScenario?.targets[a.asset_name] ?? 0) > 0),
    [allAssets, currentScenario]
  );

  // 投資総額: 保有アセットの評価額合計（リバランス金額計算の基準）
  const totalValue = heldAssets.reduce((sum, a) => sum + a.current_value_base, 0);

  // 自由項目のキー一覧: アセットの flexible_items に存在するキー名をすべて収集する
  // 例: [{ flexible_items: { "Region": "US", "種別": "コア" } }] → ["Region", "種別"]
  const attrKeys: string[] = useMemo(() => {
    const keys = new Set<string>();
    for (const a of allAssets) {
      for (const k of Object.keys(a.flexible_items)) {
        if (k) keys.add(k);
      }
    }
    return Array.from(keys);
  }, [allAssets]);

  // effectiveKey: グルーピングに使うキー。
  // ユーザーが選択していれば groupKey、未選択なら最初の自由項目キー、
  // 自由項目がなければ "asset"（アセット別）にフォールバック。
  const effectiveKey = groupKey ?? (attrKeys[0] ?? "asset");

  // 現在パイのデータ: effectiveKey に応じてアセット別 or 属性グループ別に集計
  const currentPieData: PieEntry[] = useMemo(() => {
    if (effectiveKey === "asset") {
      // アセット別: そのまま資産名ごとに表示
      return heldAssetsByName.filter((a) => a.current_ratio > 0).map((a) => ({ name: a.asset_name, value: a.current_ratio }));
    }
    // 属性グループ別: calcGroupRatios で集計（目標不要なので scenario は undefined）
    const groups = calcGroupRatios(heldAssetsByName, undefined, effectiveKey);
    return groups.filter((g) => g.currentRatio > 0).map((g) => ({ name: g.name, value: Math.round(g.currentRatio * 10) / 10 }));
  }, [heldAssetsByName, effectiveKey]);

  // 目標パイのデータ: scenario.targets をそのまま使う（キー=属性値）。
  // 左（現在）パイの名前順に合わせてソートすることで、
  // 同じ属性が左右で同じ角度の位置に来る→比較しやすい。
  const scenarioPieData: PieEntry[] = useMemo(() => {
    if (!currentScenario) return [];
    const raw = Object.entries(currentScenario.targets)
      .filter(([, v]) => v > 0)
      .map(([name, value]) => ({ name, value: value as number }));
    // 現在パイの名前順を基準にソート（現在にない項目は末尾に回す）
    const nameOrder = currentPieData.map((d) => d.name);
    return raw.sort((a, b) => {
      const ia = nameOrder.indexOf(a.name);
      const ib = nameOrder.indexOf(b.name);
      if (ia === -1 && ib === -1) return 0;
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
  }, [currentScenario, currentPieData]);

  // 属性グループ別の比率バー用データ（effectiveKey が "asset" のときは空）
  const groupRatios: GroupRatio[] = useMemo(() => {
    if (effectiveKey === "asset") return [];
    return calcGroupRatios(heldAssetsByName, currentScenario, effectiveKey);
  }, [heldAssetsByName, currentScenario, effectiveKey]);

  // pieColorMap: 左右のパイで「同じ名前 = 同じ色」にするための共有カラーマップ。
  // 左右両方の名前を先に集めて、同じ順番で色を割り当てる。
  const pieColorMap = useMemo(() => {
    const allNames = [
      ...currentPieData.map((d) => d.name),
      ...scenarioPieData.map((d) => d.name),
    ];
    return buildColorMap(allNames);
  }, [currentPieData, scenarioPieData]);

  // getTarget: アセット名からシナリオの目標比率を取得するヘルパー関数（なければ0）
  const getTarget = (assetName: string) => currentScenario?.targets[assetName] ?? 0;

  // ローディング中・データなし のアーリーリターン（早期終了）
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

      {/* ── シナリオ切り替えボタン ──
          scenarios 配列をmap()でボタンに変換する。
          activeScenario（インデックス番号）と一致するボタンを青くする。 */}
      {scenarios.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 mb-6">
          <p className="text-xs text-gray-500 mb-3">{t.scenarioHint}</p>
          <div className="flex flex-wrap gap-2">
            {scenarios.map((s, i) => (
              <button
                key={s.name}
                onClick={() => setActiveScenario(i)} // クリックでactiveScenarioを更新
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  activeScenario === i ? "bg-blue-600 text-white" : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
          {/* 選択中シナリオの前提条件とトリガーを表示（あれば）*/}
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

      {/* ── 配分比較グラフ（シナリオ選択中のみ表示）──
          グルーピングボタン: attrKeys の各キーと "asset" を並べる。
          クリックすると setGroupKey で effectiveKey が切り替わり、
          useMemo の依存配列が変化するため currentPieData が再計算される。 */}
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
          {/* 左右のパイグラフを横並びに表示 */}
          <div className="flex gap-4">
            <AssetPieChart data={currentPieData} title={t.currentAlloc} colorMap={pieColorMap} />
            <AssetPieChart data={scenarioPieData} title={t.targetAlloc(currentScenario.name)} colorMap={pieColorMap} />
          </div>
        </div>
      )}

      {/* ── リバランス指示 ──
          属性グループ別（effectiveKey !== "asset"）と アセット別 の2パターン。
          前者は groupRatios を使い、後者は heldAssetsByName を使う。 */}
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
              const moveAmount  = ((g.targetRatio - g.currentRatio) / 100) * totalValue; // 必要な移動金額
              const targetValue = (g.targetRatio / 100) * totalValue; // 目標金額
              const needsAction = g.targetRatio > 0 && Math.abs(diff) > 5; // 差が5%超なら行動サジェスト
              return (
                <div key={g.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-sm font-medium">{g.name}</span>
                    <div className="flex items-center gap-2">
                      {/* 目標が設定されていれば「現在金額 → 目標金額」を表示 */}
                      {g.targetRatio > 0 ? (
                        <span className="text-xs text-gray-500">{fmt(g.currentValue)} → {fmt(targetValue)}</span>
                      ) : (
                        <span className="text-xs text-gray-500">{fmt(g.currentValue)}</span>
                      )}
                      {/* 5%超の乖離がある場合だけアクションバッジを表示 */}
                      {needsAction && (
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          diff > 0 ? "bg-yellow-400/10 text-yellow-400" : "bg-red-400/10 text-red-400"
                        }`}>
                          {diff > 0
                            ? t.sellNote(fmt(Math.abs(moveAmount))) // 超過 → 売却検討
                            : t.buyNote(fmt(Math.abs(moveAmount)))}  // 不足 → 買い増し検討
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
          /* アセット別リバランス（effectiveKey === "asset" のとき / フォールバック）*/
          <div className="space-y-5">
            {heldAssetsByName.map((asset) => {
              const target      = getTarget(asset.asset_name); // シナリオの目標比率（なければ0）
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
                      {target > 0 ? (
                        <span className="text-xs text-gray-500">{fmt(asset.current_value_base)} → {fmt((target / 100) * totalValue)}</span>
                      ) : (
                        <span className="text-xs text-gray-500">{fmt(asset.current_value_base)}</span>
                      )}
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
                  {/* 投資メモがあれば表示 */}
                  {asset.investment_memo && (
                    <p className="text-xs text-gray-600 mt-1 ml-0.5">{asset.investment_memo}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 検討中アセット（ウォッチリスト）──
          is_watchlist=true かつ 選択シナリオに目標%が設定されているアセットのみ表示。
          「このシナリオになったらこれを買う」という候補リスト。 */}
      {watchlistAssets.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 mb-6">
          <h3 className="text-sm font-medium text-gray-400 mb-4">
            {t.watchlist}
            <span className="text-xs text-gray-600 ml-2">{t.watchlistNote}</span>
          </h3>
          <div className="space-y-4">
            {watchlistAssets.map((asset) => {
              const target    = getTarget(asset.asset_name);
              // 目標比率から購入目安金額を算出: 目標% × 投資総額
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

      {/* ── 保有明細テーブル ──
          heldAssets（口座+名前で合算済み）を表で表示する。
          tabular-nums: 数字が縦に揃うフォント設定（Tailwindクラス）。 */}
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
