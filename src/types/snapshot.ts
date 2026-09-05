// ============================================================
// このファイルの役割:
//   アプリ全体で使うデータの「型」を定義する。
//   TypeScriptの型定義とは、「このデータはこういう形のはず」という
//   設計図のようなもの。間違った使い方をするとビルド時にエラーになる。
//   実際のデータはSupabaseのasset_snapshotsテーブルから来る。
// ============================================================

// 口座ごとの金額を表す型
// 例: { account: "自分", amount: 3000000 }
export type AccountAmount = {
  account: string; // 口座名（「自分」「妻」など）
  amount: number;  // 金額（基準通貨ベース）
};

// 負債（ローンなど）を表す型
// 例: { name: "住宅ローン", account: "自分", amount: 25000000, note: "2048年完済予定" }
export type Debt = {
  name: string;    // 負債の名前（「住宅ローン」など）
  account: string; // 紐づく口座
  amount: number;  // 残高
  note: string;    // 備考（全体資産シートのD列）
};

// 全体資産シートから来るサマリーデータの型
// GASがスプレッドシートを読んでSupabaseに保存する形そのまま
export type SummaryData = {
  living_funds:     AccountAmount[]; // 生活防衛資金（種別:生活資金の行）
  investment_funds: AccountAmount[]; // 待機資金（現在はUI非表示）
  debts:            Debt[];          // 負債一覧
};

// 明細シートの各アセット（行）を表す型
export type Asset = {
  asset_name:         string;              // 資産名（例: "VT", "eMAXIS Slim 全世界"）
  ticker:             string;              // ティッカーコード（例: "VT"）
  quantity:           number;              // 保有数量（口数・株数）
  current_price:      number;              // 現在価格（元の通貨建て）
  rate:               number;              // 基準通貨への換算レート（明細シートF列）
  current_value_base: number;              // 評価額（基準通貨換算後）= quantity × current_price × rate
  current_ratio:      number;              // 投資資金全体に占める現在の比率(%)
  currency:           string;              // 通貨（"JPY", "USD" など）
  account:            string;              // 口座名
  investment_memo:    string;              // 投資メモ（買い増しタイミングなど）
  is_watchlist:       boolean;             // true=検討中（quantity=0）、false=保有中
  flexible_items:     Record<string, string>; // 自由項目（例: { "Region": "Global", "種別": "コア" }）
};

// シナリオシートの1シナリオを表す型
export type Scenario = {
  name:        string;              // シナリオ名（例: "Base Case"）
  description: string;              // 前提条件
  trigger:     string;              // 発動トリガー（例: "円安150円突破時"）
  targets:     Record<string, number>; // 目標比率マップ（例: { "Global": 40, "US": 30, "Gold": 15, "Cash": 15 }）
                                       // ★ キーは属性値（自由項目の値）、数値は%
};

// Supabaseのasset_snapshotsテーブルの1レコードを表す型
// GASが「同期する」ボタンを押したときに1行保存される
export type Snapshot = {
  id:            string;       // UUID（Supabaseが自動付与）
  snapshot_date: string;       // 記録日（例: "2026-09-05"）
  base_currency: string;       // 基準通貨（"JPY" or "USD"）
  currency_rate: number;       // 設定シートの基準通貨レート（表示用）
  summary_data:  SummaryData;  // 全体資産シートのデータ（JSONB列）
  assets_data:   Asset[];      // 明細シートのデータ（JSONB列）
  scenario_data: Scenario[];   // シナリオシートのデータ（JSONB列）
};
