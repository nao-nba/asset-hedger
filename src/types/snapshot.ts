export type AccountAmount = {
  account: string;
  amount: number;
};

export type Debt = {
  name: string;
  account: string;
  amount: number;
  note: string;
};

export type SummaryData = {
  living_funds: AccountAmount[];
  investment_funds: AccountAmount[];
  debts: Debt[];
};

export type Asset = {
  asset_name: string;
  ticker: string;
  quantity: number;
  current_price: number;
  rate: number;
  current_value_base: number;
  current_ratio: number;
  currency: string;
  account: string;
  investment_memo: string;
  is_watchlist: boolean;
  flexible_items: Record<string, string>;
};

export type Scenario = {
  name: string;
  description: string;
  trigger: string;
  targets: Record<string, number>;
};

export type Snapshot = {
  id: string;
  snapshot_date: string;
  base_currency: string;
  currency_rate: number;
  summary_data: SummaryData;
  assets_data: Asset[];
  scenario_data: Scenario[];
};
