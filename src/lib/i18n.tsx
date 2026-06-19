"use client";

import { createContext, useContext, useState, ReactNode } from "react";

export type Lang = "ja" | "en";

const translations = {
  ja: {
    // auth
    appTagline:       "家族の資産を一目で把握する",
    login:            "ログイン",
    register:         "新規登録",
    email:            "メールアドレス",
    password:         "パスワード",
    passwordHint:     "8文字以上",
    showPassword:     "表示",
    hidePassword:     "隠す",
    submitting:       "処理中...",
    signUpMessage:    "入力したメールアドレスに確認メールを送信しました。メールをご確認ください。",
    loginError:       "メールアドレスまたはパスワードが正しくありません。",
    passwordError:    "パスワードは8文字以上で入力してください。",

    // nav
    navOverview:      "資産の部",
    navAssets:        "アセット明細",
    signOut:          "ログアウト",

    // dashboard
    userIdLabel:      "UserID（スプレッドシートの B1 にコピペ）",
    pageTitle:        "資産の部",
    lastUpdated:      "最終更新",
    noData:           "データがありません",
    noDataHint:       "スプレッドシートで「同期する」を押してください",
    loading:          "読み込み中...",

    netAssets:        "純資産",
    totalAssets:      "総資産",
    livingFunds:      "生活資金",
    investmentFunds:  "投資資金（合計）",
    waitingFunds:     "うち 待機資金",
    totalAssetsNote:  "生活資金＋投資資金",
    investmentNote:   "待機資金(現金)＋明細の評価額",
    waitingNote:      "証券口座の現金・MRFなど",
    debtNote:         "※負債を含む",

    financialHealth:  "財務健全性",
    equityRatio:      "自己資本比率",
    liquidityRatio:   "流動性比率（防衛余力）",
    equityGood:       "✓ 健全: 家計が安定しています",
    equityWarn:       "△ 注意: ローン負担がやや大きめです",
    equityBad:        "⚠ 要注意: ローン負担が大きい状態です",
    liquidityText:    (pct: number) => `負債の ${pct}% を即座に現金でカバーできます`,
    noDebt:           "負債なし",

    debtBreakdown:    "負債内訳",
    assetTrend:       "資産推移",
    trendHint:        "資産推移グラフはデータが2件以上になると表示されます",

    // assets page
    assetPageTitle:   "アセット明細",
    scenarioHint:     "シナリオを選択して目標比率を切り替える",
    condition:        "前提条件",
    trigger:          "トリガー",
    currentAlloc:     "現在の配分",
    targetAlloc:      (name: string) => `目標: ${name}`,
    allocComparison:  "配分比較",
    groupBy:          "グループ:",
    byAsset:          "アセット別",

    ratioVsTarget:    "現在比率 vs 目標比率",
    totalInvested:    "投資総額",
    targetLabel:      (pct: number) => `目標 ${pct}%`,
    sellNote:         (amt: string) => `▼ ${amt} 売却検討`,
    buyNote:          (amt: string) => `▲ ${amt} 追加検討`,

    watchlist:        "検討中アセット",
    watchlistNote:    "現在未保有・将来の購入候補",
    notHeld:          "未保有",
    scenarioTarget:   (pct: number) => `このシナリオの目標: ${pct}%`,
    buyConsider:      (amt: string) => `▲ ${amt} 購入検討`,

    holdingsTable:    "保有明細",
    colAsset:         "資産名",
    colAccount:       "口座",
    colQty:           "数量",
    colPrice:         "現在価格",
    colCurrency:      "通貨",
    colValue:         "評価額",
  },
  en: {
    // auth
    appTagline:       "Visualize your family's assets at a glance",
    login:            "Login",
    register:         "Register",
    email:            "Email address",
    password:         "Password",
    passwordHint:     "8+ characters",
    showPassword:     "Show",
    hidePassword:     "Hide",
    submitting:       "Processing...",
    signUpMessage:    "A confirmation email has been sent. Please check your inbox.",
    loginError:       "Invalid email address or password.",
    passwordError:    "Password must be at least 8 characters.",

    // nav
    navOverview:      "Overview",
    navAssets:        "Asset Details",
    signOut:          "Sign out",

    // dashboard
    userIdLabel:      "UserID (paste into cell B1 of your spreadsheet)",
    pageTitle:        "Financial Overview",
    lastUpdated:      "Last updated",
    noData:           "No data available",
    noDataHint:       "Click \"Sync\" in your spreadsheet to get started",
    loading:          "Loading...",

    netAssets:        "Net Assets",
    totalAssets:      "Total Assets",
    livingFunds:      "Living Funds",
    investmentFunds:  "Investment (total)",
    waitingFunds:     "  Cash Reserve",
    totalAssetsNote:  "Living + Investment",
    investmentNote:   "Cash + portfolio value",
    waitingNote:      "Cash / MRF in brokerage",
    debtNote:         "* incl. liabilities",

    financialHealth:  "Financial Health",
    equityRatio:      "Equity Ratio",
    liquidityRatio:   "Liquidity Ratio (defense)",
    equityGood:       "✓ Healthy: finances are stable",
    equityWarn:       "△ Caution: loan burden is moderate",
    equityBad:        "⚠ Warning: loan burden is high",
    liquidityText:    (pct: number) => `${pct}% of liabilities can be covered immediately`,
    noDebt:           "No liabilities",

    debtBreakdown:    "Liability Breakdown",
    assetTrend:       "Asset Trend",
    trendHint:        "The trend chart appears when there are 2 or more data points",

    // assets page
    assetPageTitle:   "Asset Details",
    scenarioHint:     "Select a scenario to switch target allocations",
    condition:        "Conditions",
    trigger:          "Trigger",
    currentAlloc:     "Current allocation",
    targetAlloc:      (name: string) => `Target: ${name}`,
    allocComparison:  "Allocation Comparison",
    groupBy:          "Group by:",
    byAsset:          "By asset",

    ratioVsTarget:    "Current vs Target Ratio",
    totalInvested:    "Total invested",
    targetLabel:      (pct: number) => `Target ${pct}%`,
    sellNote:         (amt: string) => `▼ ${amt} consider selling`,
    buyNote:          (amt: string) => `▲ ${amt} consider buying`,

    watchlist:        "Watchlist",
    watchlistNote:    "Not yet held — future purchase candidates",
    notHeld:          "Not held",
    scenarioTarget:   (pct: number) => `Scenario target: ${pct}%`,
    buyConsider:      (amt: string) => `▲ ${amt} consider buying`,

    holdingsTable:    "Holdings",
    colAsset:         "Asset",
    colAccount:       "Account",
    colQty:           "Qty",
    colPrice:         "Price",
    colCurrency:      "CCY",
    colValue:         "Value",
  },
} satisfies Record<Lang, Translations>;

export type Translations = {
  appTagline: string;
  login: string; register: string; email: string; password: string;
  passwordHint: string; showPassword: string; hidePassword: string;
  submitting: string; signUpMessage: string; loginError: string; passwordError: string;
  navOverview: string; navAssets: string; signOut: string;
  userIdLabel: string; pageTitle: string; lastUpdated: string;
  noData: string; noDataHint: string; loading: string;
  netAssets: string; totalAssets: string; livingFunds: string;
  investmentFunds: string; waitingFunds: string;
  totalAssetsNote: string; investmentNote: string; waitingNote: string; debtNote: string;
  financialHealth: string; equityRatio: string; liquidityRatio: string;
  equityGood: string; equityWarn: string; equityBad: string;
  liquidityText: (pct: number) => string;
  noDebt: string; debtBreakdown: string; assetTrend: string; trendHint: string;
  assetPageTitle: string; scenarioHint: string; condition: string; trigger: string;
  currentAlloc: string; targetAlloc: (name: string) => string;
  allocComparison: string; groupBy: string; byAsset: string;
  ratioVsTarget: string; totalInvested: string;
  targetLabel: (pct: number) => string;
  sellNote: (amt: string) => string; buyNote: (amt: string) => string;
  watchlist: string; watchlistNote: string; notHeld: string;
  scenarioTarget: (pct: number) => string; buyConsider: (amt: string) => string;
  holdingsTable: string;
  colAsset: string; colAccount: string; colQty: string;
  colPrice: string; colCurrency: string; colValue: string;
};

type I18nContextType = {
  lang: Lang;
  setLang: (l: Lang) => void;
  t: Translations;
};

const I18nContext = createContext<I18nContextType>({
  lang: "ja",
  setLang: () => {},
  t: translations.ja,
});

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>("ja");
  return (
    <I18nContext.Provider value={{ lang, setLang, t: translations[lang] }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n() {
  return useContext(I18nContext);
}
