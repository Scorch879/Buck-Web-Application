"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useDashboardUser } from "@/context/DashboardUserContext";
import {
  mergeDashboardDataCache,
  useFinancial,
} from "@/context/FinancialContext";
import { formatCurrency, toNumber } from "@/utils/formatters";
import {
  ensureDefaultCategories,
  getUserProfile,
  listExpenses,
  listWallets,
  getActiveWalletId,
  subscribeUserTable,
  type BuckCategory,
  type BuckExpense,
} from "@/utils/supabaseData";
import WeeklyPieChart, { type WeeklyPieSlice } from "./WeeklyPieChart";
import AIAdvisorPlaceholderCard from "./AIAdvisorPlaceholderCard";
import "./style.css";

type Category = BuckCategory;
type Expense = BuckExpense;

type WeeklyDatum = {
  day: string;
  amount: number;
};

type SummaryItem = {
  label: string;
  amount: number;
  description: string;
};

type TimeframeFilter = "all" | "month" | "week";

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const categoryDescriptions: Record<string, string> = {
  Food: "Meals, snacks, and groceries.",
  Fare: "Public transport and commuting costs.",
  "Gas Money": "Fuel and vehicle costs.",
  "Video Games": "Game purchases and in-game spending.",
  Shopping: "Clothes, gadgets, and personal shopping.",
  Bills: "Utilities, rent, and recurring payments.",
  Other: "Miscellaneous expenses.",
};

function getCurrentWeekRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function getCurrentMonthRange() {
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
  const end = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);
  return { start, end };
}

function parseExpenseDate(expense: Expense): Date | null {
  if (!expense.date) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(expense.date);
  if (match) {
    const year = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    const day = parseInt(match[3], 10);
    return new Date(year, month, day, 12, 0, 0);
  }

  const date = new Date(expense.date);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameCalendarDate(first: Date, second: Date) {
  return (
    first.getDate() === second.getDate() &&
    first.getMonth() === second.getMonth() &&
    first.getFullYear() === second.getFullYear()
  );
}

function getFilteredExpenses(
  expenses: Expense[],
  timeframe: TimeframeFilter
): Expense[] {
  if (timeframe === "all") {
    return expenses;
  }

  if (timeframe === "month") {
    const { start, end } = getCurrentMonthRange();
    return expenses.filter((expense) => {
      const expenseDate = parseExpenseDate(expense);
      return expenseDate ? expenseDate >= start && expenseDate <= end : false;
    });
  }

  const { start, end } = getCurrentWeekRange();
  return expenses.filter((expense) => {
    const expenseDate = parseExpenseDate(expense);
    return expenseDate ? expenseDate >= start && expenseDate <= end : false;
  });
}

function getWeeklyData(weeklyExpenses: Expense[]) {
  const { start } = getCurrentWeekRange();

  return weekDays.map((day, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    const amount = weeklyExpenses
      .filter((expense) => {
        const expenseDate = parseExpenseDate(expense);
        return expenseDate ? isSameCalendarDate(expenseDate, date) : false;
      })
      .reduce((sum, expense) => sum + toNumber(expense.amount), 0);

    return { day, amount };
  });
}

const PIE_COLOR_PALETTE = [
  "#f47536", // Primary Buck Orange
  "#ffc547", // Warm Amber / Gold
  "#ff3838", // Coral Red
  "#ffa15b", // Warm Peach / Apricot
  "#8c7a6b", // Muted Slate Brown for Others
];

function getCategoryPieData(filteredExpenses: Expense[]): {
  slices: WeeklyPieSlice[];
  total: number;
} {
  const categoryTotals: Record<string, number> = {};

  for (const expense of filteredExpenses) {
    const categoryName = expense.category?.trim() || "Uncategorized";
    const amount = toNumber(expense.amount);
    if (amount > 0) {
      categoryTotals[categoryName] =
        (categoryTotals[categoryName] || 0) + amount;
    }
  }

  const sorted = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  const total = sorted.reduce((sum, [, amt]) => sum + amt, 0);

  if (total === 0 || sorted.length === 0) {
    return { slices: [], total: 0 };
  }

  let rawSlices: { category: string; amount: number; color: string }[] = [];

  if (sorted.length <= 5) {
    rawSlices = sorted.map(([category, amount], idx) => ({
      category,
      amount,
      color: PIE_COLOR_PALETTE[idx % PIE_COLOR_PALETTE.length],
    }));
  } else {
    // Top 4 categories
    const top4 = sorted.slice(0, 4).map(([category, amount], idx) => ({
      category,
      amount,
      color: PIE_COLOR_PALETTE[idx],
    }));
    // 5th element is "Others" combining all remaining categories
    const othersAmount = sorted
      .slice(4)
      .reduce((sum, [, amt]) => sum + amt, 0);
    rawSlices = [
      ...top4,
      {
        category: "Others",
        amount: othersAmount,
        color: PIE_COLOR_PALETTE[4],
      },
    ];
  }

  const slices: WeeklyPieSlice[] = rawSlices.map((slice) => ({
    ...slice,
    percentage: total > 0 ? (slice.amount / total) * 100 : 0,
  }));

  return { slices, total };
}

function getSummaryData(categories: Category[], expenses: Expense[]) {
  return categories
    .map<SummaryItem>((category) => {
      const amount = expenses
        .filter((expense) => expense.category === category.name)
        .reduce((sum, expense) => sum + toNumber(expense.amount), 0);

      return {
        label: category.name,
        amount,
        description:
          categoryDescriptions[category.name] || "Custom budget category.",
      };
    })
    .filter((item) => item.amount > 0);
}

function WeeklyBarChart({ data }: { data: WeeklyDatum[] }) {
  const maxAmount = Math.max(30, ...data.map((item) => item.amount));
  const yLabels = Array.from({ length: 7 }, (_, index) =>
    Math.round(maxAmount - (maxAmount / 6) * index)
  );
  const hasData = data.some((item) => item.amount > 0);

  return (
    <div className="graph-container">
      <div className="graph-axis" aria-hidden="true">
        {yLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="graph-bars">
        {hasData ? (
          data.map((item) => {
            const height = maxAmount === 0 ? 0 : (item.amount / maxAmount) * 100;
            const barStyle = { "--bar-height": `${height}%` } as CSSProperties;

            return (
              <div
                key={item.day}
                className="graph-bar"
                style={barStyle}
                title={`${item.day}: ${formatCurrency(item.amount)}`}
              >
                <span className="graph-bar-label">{item.day}</span>
              </div>
            );
          })
        ) : (
          <div className="empty-chart-state">No data available</div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useDashboardUser();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const userCache = dashboardCache.userId === user.uid ? dashboardCache : {};
  const hasInitialDashboardData = 
    userCache.profile !== undefined && 
    userCache.categories !== undefined && 
    userCache.expenses !== undefined && 
    userCache.wallets !== undefined;
  const [categories, setCategories] = useState<Category[]>(
    () => userCache.categories ?? []
  );
  const [expenses, setExpenses] = useState<Expense[]>(
    () => userCache.expenses ?? []
  );
  const [loadingDashboardData, setLoadingDashboardData] = useState(
    () => !hasInitialDashboardData
  );
  const hadInitialDashboardData = useRef(hasInitialDashboardData);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const loadedProfile = await getUserProfile(user.uid);

      if (active) {
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, user.uid, {
            profile: loadedProfile,
          })
        );
      }
    };

    const loadCategories = async () => {
      const nextCategories = await ensureDefaultCategories(user.uid);

      if (active) {
        setCategories(nextCategories);
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, user.uid, {
            categories: nextCategories,
          })
        );
      }
    };

    const loadExpenses = async () => {
      const nextExpenses = await listExpenses(user.uid);

      if (active) {
        setExpenses(nextExpenses);
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, user.uid, {
            expenses: nextExpenses,
          })
        );
      }
    };

    const loadInitialData = async () => {
      if (!hadInitialDashboardData.current) {
        setLoadingDashboardData(true);
      }

      try {
        const [loadedProfile, nextCategories, nextExpenses, loadedWallets, activeWalletId] = await Promise.all([
          getUserProfile(user.uid),
          ensureDefaultCategories(user.uid),
          listExpenses(user.uid),
          listWallets(user.uid),
          getActiveWalletId(user.uid),
        ]);
        
        let activeWalletBudget = null;
        if (activeWalletId && loadedWallets) {
          const activeWallet = loadedWallets.find((w) => w.id === activeWalletId && !w.deletedAt);
          if (activeWallet) {
            activeWalletBudget = Number(activeWallet.budget);
          }
        }

        if (!active) {
          return;
        }

        setCategories(nextCategories);
        setExpenses(nextExpenses);
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, user.uid, {
            profile: loadedProfile,
            categories: nextCategories,
            expenses: nextExpenses,
            wallets: loadedWallets,
            activeWalletId,
            activeWalletBudget,
          })
        );
      } catch (error) {
        console.error("Failed to load dashboard:", error);
      } finally {
        if (active) {
          setLoadingDashboardData(false);
        }
      }
    };

    void loadInitialData();

    const unsubscribeCategories = subscribeUserTable(
      "categories",
      user.uid,
      () => void loadCategories()
    );
    const unsubscribeExpenses = subscribeUserTable(
      "expenses",
      user.uid,
      () => void loadExpenses()
    );
    const unsubscribeProfile = subscribeUserTable(
      "profiles",
      user.uid,
      () => void loadProfile()
    );

    return () => {
      active = false;
      unsubscribeCategories();
      unsubscribeExpenses();
      unsubscribeProfile();
    };
  }, [setDashboardCache, user.uid]);

  const [timeframe, setTimeframe] = useState<TimeframeFilter>("all");

  const weeklyExpenses = useMemo(
    () => getFilteredExpenses(expenses, "week"),
    [expenses]
  );
  const weeklyData = useMemo(
    () => getWeeklyData(weeklyExpenses),
    [weeklyExpenses]
  );
  const pieExpenses = useMemo(
    () => getFilteredExpenses(expenses, timeframe),
    [expenses, timeframe]
  );
  const categoryPieData = useMemo(
    () => getCategoryPieData(pieExpenses),
    [pieExpenses]
  );
  const summaryData = useMemo(
    () => getSummaryData(categories, expenses),
    [categories, expenses]
  );

  if (loadingDashboardData) {
    return <DashboardPageSkeleton variant="home" />;
  }

  return (
    <div className="dashboard-container">
      {/* 1. Category Breakdown Pie Graph & Weekly Expenses by Day Bar Graph */}
      <section className="dashboard-content" aria-label="Spending overview">
        <article className="spending-card" aria-label="Category spending breakdown">
          <div className="card-heading-row">
            <div className="card-heading">
              <p className="card-eyebrow">Category Spending</p>
              <h2 className="spending-card-title">Category Breakdown</h2>
            </div>
            <div
              className="timeframe-toggle-group"
              role="group"
              aria-label="Category breakdown timeframe filter"
            >
              <button
                type="button"
                className={`timeframe-btn ${timeframe === "all" ? "timeframe-btn--active" : ""}`}
                onClick={() => setTimeframe("all")}
              >
                All Time
              </button>
              <button
                type="button"
                className={`timeframe-btn ${timeframe === "month" ? "timeframe-btn--active" : ""}`}
                onClick={() => setTimeframe("month")}
              >
                This Month
              </button>
              <button
                type="button"
                className={`timeframe-btn ${timeframe === "week" ? "timeframe-btn--active" : ""}`}
                onClick={() => setTimeframe("week")}
              >
                This Week
              </button>
            </div>
          </div>
          <WeeklyPieChart
            slices={categoryPieData.slices}
            total={categoryPieData.total}
            centerLabel={
              timeframe === "week"
                ? "Total this week"
                : timeframe === "month"
                ? "Total this month"
                : "Total all-time"
            }
            emptyMessage={
              timeframe === "week"
                ? "No expenses recorded this week"
                : timeframe === "month"
                ? "No expenses recorded this month"
                : "No expenses recorded yet"
            }
          />
        </article>

        <article className="graph-card">
          <div className="card-heading">
            <p className="card-eyebrow">Weekly Summary</p>
            <h2 className="graph-title">Expenses by day</h2>
          </div>
          <WeeklyBarChart data={weeklyData} />
        </article>
      </section>

      {/* 2. Financial Summary (Categories) - placed directly below Pie and Bar graph cards */}
      <section className="summary-card" aria-label="Categories financial summary">
        <div className="card-heading">
          <p className="card-eyebrow">Categories</p>
          <h2 className="summary-title">Financial Summary</h2>
        </div>
        <div className="summary-content">
          {summaryData.length > 0 ? (
            summaryData.map((item) => (
              <article key={item.label} className="summary-item">
                <div className="summary-item-value">
                  {formatCurrency(item.amount)}
                </div>
                <div className="summary-item-label">{item.label}</div>
                <p className="summary-item-description">
                  {item.description}
                </p>
              </article>
            ))
          ) : (
            <div className="empty-summary-state">
              No summary data available
            </div>
          )}
        </div>
      </section>

      {/* 3. AI Financial Advisor Placeholder Card */}
      <AIAdvisorPlaceholderCard
        activeWalletBudget={userCache.activeWalletBudget}
        totalExpensesCount={expenses.length}
      />
    </div>
  );
}
