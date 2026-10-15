"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useDashboardUser } from "@/context/DashboardUserContext";
import {
  mergeDashboardDataCache,
  useFinancial,
} from "@/context/FinancialContext";
import { toNumber } from "@/utils/formatters";
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
import WeeklyBarChart, { fullDayNames, type WeeklyDatum } from "./WeeklyBarChart";
import FinancialSummaryTable, { type SummaryTableItem } from "./FinancialSummaryTable";
import AIAdvisorPlaceholderCard from "./AIAdvisorPlaceholderCard";
import { BUCK_PIE_PALETTE, CHART_THEME } from "./chartTheme";
import "./style.css";

type Category = BuckCategory;
type Expense = BuckExpense;


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

const jsDayToWeekDaysIndex: Record<number, number> = {
  1: 0, // Mon
  2: 1, // Tue
  3: 2, // Wed
  4: 3, // Thu
  5: 4, // Fri
  6: 5, // Sat
  0: 6, // Sun
};

function getDailyExpensesData(
  filteredExpenses: Expense[],
  timeframe: TimeframeFilter
): WeeklyDatum[] {
  if (timeframe === "week") {
    const { start } = getCurrentWeekRange();
    return weekDays.map((day, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);

      const amount = filteredExpenses
        .filter((expense) => {
          const expenseDate = parseExpenseDate(expense);
          return expenseDate ? isSameCalendarDate(expenseDate, date) : false;
        })
        .reduce((sum, expense) => sum + toNumber(expense.amount), 0);

      return { day, amount };
    });
  }

  // For "month" and "all": aggregate expenses by day of the week (Mon to Sun)
  const dayTotals: number[] = [0, 0, 0, 0, 0, 0, 0];

  for (const expense of filteredExpenses) {
    const expenseDate = parseExpenseDate(expense);
    if (expenseDate) {
      const jsDay = expenseDate.getDay();
      const idx = jsDayToWeekDaysIndex[jsDay];
      if (idx !== undefined) {
        dayTotals[idx] += toNumber(expense.amount);
      }
    }
  }

  return weekDays.map((day, idx) => ({
    day,
    amount: dayTotals[idx],
  }));
}

function matchesDayFilter(
  expense: Expense,
  selectedDay: string | null,
  timeframe: TimeframeFilter
): boolean {
  if (!selectedDay) return true;
  const expenseDate = parseExpenseDate(expense);
  if (!expenseDate) return false;

  if (timeframe === "week") {
    const { start } = getCurrentWeekRange();
    const dayIndex = weekDays.indexOf(selectedDay);
    if (dayIndex === -1) return false;
    const targetDate = new Date(start);
    targetDate.setDate(start.getDate() + dayIndex);
    return isSameCalendarDate(expenseDate, targetDate);
  }

  const jsDay = expenseDate.getDay();
  const dayIndex = jsDayToWeekDaysIndex[jsDay];
  return weekDays[dayIndex] === selectedDay;
}

function matchesCategoryFilter(
  expenseCategory: string | undefined | null,
  selectedCategory: string | null,
  topCategoryNames: Set<string>
): boolean {
  if (!selectedCategory) return true;
  const cat = expenseCategory?.trim() || "Uncategorized";
  if (selectedCategory === "Others" || selectedCategory === "Others (Combined)") {
    return !topCategoryNames.has(cat);
  }
  return cat.toLowerCase() === selectedCategory.toLowerCase();
}

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
      color: BUCK_PIE_PALETTE[idx % BUCK_PIE_PALETTE.length],
    }));
  } else {
    // Top 4 categories
    const top4 = sorted.slice(0, 4).map(([category, amount], idx) => ({
      category,
      amount,
      color: BUCK_PIE_PALETTE[idx],
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
        color: CHART_THEME.othersColor,
      },
    ];
  }

  const slices: WeeklyPieSlice[] = rawSlices.map((slice) => ({
    ...slice,
    percentage: total > 0 ? (slice.amount / total) * 100 : 0,
  }));

  return { slices, total };
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
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const pieExpenses = useMemo(
    () => getFilteredExpenses(expenses, timeframe),
    [expenses, timeframe]
  );

  const dayFilteredExpenses = useMemo(() => {
    if (!selectedDay) return pieExpenses;
    return pieExpenses.filter((e) => matchesDayFilter(e, selectedDay, timeframe));
  }, [pieExpenses, selectedDay, timeframe]);

  const categoryPieData = useMemo(
    () => getCategoryPieData(dayFilteredExpenses),
    [dayFilteredExpenses]
  );

  const top4CategoryNames = useMemo(
    () =>
      new Set(
        categoryPieData.slices
          .filter((s) => s.category !== "Others")
          .map((s) => s.category)
      ),
    [categoryPieData.slices]
  );

  const isSubCategoryOfOthers = useMemo(() => {
    if (!selectedCategory) return false;
    if (selectedCategory === "Others" || selectedCategory === "Others (Combined)") return false;
    return !top4CategoryNames.has(selectedCategory);
  }, [selectedCategory, top4CategoryNames]);

  const selectedCategoryColor = useMemo(() => {
    if (!selectedCategory) return undefined;
    const slice = categoryPieData.slices.find(
      (s) => s.category.toLowerCase() === selectedCategory.toLowerCase()
    );
    if (slice) return slice.color;

    // Fallback to Others slice color if grouped under Others
    const othersSlice = categoryPieData.slices.find((s) => s.category === "Others");
    return othersSlice?.color || CHART_THEME.othersColor;
  }, [categoryPieData.slices, selectedCategory]);

  const selectedCategoryAmount = useMemo(() => {
    if (!selectedCategory) return undefined;
    if (selectedCategory === "Others" || selectedCategory === "Others (Combined)") {
      const othersSlice = categoryPieData.slices.find((s) => s.category === "Others");
      return othersSlice?.amount;
    }
    const catExpenses = dayFilteredExpenses.filter(
      (e) =>
        (e.category?.trim() || "Uncategorized").toLowerCase() ===
        selectedCategory.toLowerCase()
    );
    return catExpenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
  }, [categoryPieData.slices, dayFilteredExpenses, selectedCategory]);

  const handleSelectDay = (day: string) => {
    if (selectedDay === day) {
      setSelectedDay(null);
    } else {
      setSelectedDay(day);
      setSelectedCategory(null);
    }
  };

  // If timeframe changes and selected category no longer exists in current timeframe, reset it
  useEffect(() => {
    if (selectedCategory && pieExpenses.length > 0) {
      if (selectedCategory === "Others" || selectedCategory === "Others (Combined)") {
        const hasOthers = categoryPieData.slices.some((s) => s.category === "Others");
        if (!hasOthers) setSelectedCategory(null);
      } else {
        const exists = pieExpenses.some(
          (e) =>
            (e.category?.trim() || "Uncategorized").toLowerCase() ===
            selectedCategory.toLowerCase()
        );
        if (!exists) {
          setSelectedCategory(null);
        }
      }
    }
  }, [categoryPieData.slices, pieExpenses, selectedCategory]);

  // If timeframe changes and selected day no longer has expenses, reset it
  useEffect(() => {
    if (selectedDay && pieExpenses.length > 0) {
      const hasDayExpenses = pieExpenses.some((e) =>
        matchesDayFilter(e, selectedDay, timeframe)
      );
      if (!hasDayExpenses) {
        setSelectedDay(null);
      }
    }
  }, [pieExpenses, selectedDay, timeframe]);

  const barChartExpenses = useMemo(() => {
    return pieExpenses.filter((expense) =>
      matchesCategoryFilter(expense.category, selectedCategory, top4CategoryNames)
    );
  }, [pieExpenses, selectedCategory, top4CategoryNames]);

  const weeklyData = useMemo(
    () => getDailyExpensesData(barChartExpenses, timeframe),
    [barChartExpenses, timeframe]
  );

  const summaryData = useMemo<SummaryTableItem[]>(() => {
    const isOthersSelection =
      selectedCategory === "Others" || selectedCategory === "Others (Combined)";
    const activeDayName = selectedDay ? (fullDayNames[selectedDay] || selectedDay) : null;

    if (isOthersSelection) {
      const othersExpenses = dayFilteredExpenses.filter((e) => {
        const cat = e.category?.trim() || "Uncategorized";
        return !top4CategoryNames.has(cat);
      });

      const othersTotal = othersExpenses.reduce((sum, e) => sum + toNumber(e.amount), 0);
      const othersMap = new Map<string, { amount: number; count: number }>();
      for (const exp of othersExpenses) {
        const cat = exp.category?.trim() || "Uncategorized";
        const existing = othersMap.get(cat) || { amount: 0, count: 0 };
        othersMap.set(cat, {
          amount: existing.amount + toNumber(exp.amount),
          count: existing.count + 1,
        });
      }

      const items: SummaryTableItem[] = [];
      let colorIdx = 0;
      for (const [catName, val] of othersMap.entries()) {
        const pct = othersTotal > 0 ? (val.amount / othersTotal) * 100 : 0;
        items.push({
          label: catName,
          amount: val.amount,
          count: val.count,
          percentage: pct,
          color:
            BUCK_PIE_PALETTE[colorIdx % BUCK_PIE_PALETTE.length] ||
            CHART_THEME.othersColor,
          description:
            categoryDescriptions[catName] ||
            (activeDayName
              ? `Grouped under Others on ${activeDayName}.`
              : "Category grouped under Others."),
        });
        colorIdx++;
      }

      if (items.length === 0 && othersExpenses.length > 0) {
        items.push({
          label: "Others (Combined)",
          amount: othersTotal,
          count: othersExpenses.length,
          percentage: 100,
          color: CHART_THEME.othersColor,
          description: activeDayName
            ? `Combined expenses outside the top 4 categories on ${activeDayName}.`
            : "Combined expenses outside the top 4 categories.",
        });
      }

      return items.sort((a, b) => b.amount - a.amount);
    }

    // Default: All categories in current dayFilteredExpenses
    const totalSpent = dayFilteredExpenses.reduce(
      (sum, e) => sum + toNumber(e.amount),
      0
    );

    const categoryTotals = new Map<string, { amount: number; count: number }>();
    for (const exp of dayFilteredExpenses) {
      const cat = exp.category?.trim() || "Uncategorized";
      const existing = categoryTotals.get(cat) || { amount: 0, count: 0 };
      categoryTotals.set(cat, {
        amount: existing.amount + toNumber(exp.amount),
        count: existing.count + 1,
      });
    }

    const allCatNames = new Set([
      ...(selectedDay ? [] : categories.map((c) => c.name)),
      ...Array.from(categoryTotals.keys()),
    ]);

    return Array.from(allCatNames)
      .map<SummaryTableItem>((name) => {
        const val = categoryTotals.get(name) || { amount: 0, count: 0 };
        const pct = totalSpent > 0 ? (val.amount / totalSpent) * 100 : 0;
        const slice = categoryPieData.slices.find(
          (s) => s.category.toLowerCase() === name.toLowerCase()
        );
        return {
          label: name,
          amount: val.amount,
          count: val.count,
          percentage: pct,
          color: slice?.color || CHART_THEME.othersColor,
          description:
            categoryDescriptions[name] ||
            (activeDayName
              ? `Spending under ${name} on ${activeDayName}.`
              : "Custom budget category."),
        };
      })
      .filter((item) => item.amount > 0)
      .sort((a, b) => b.amount - a.amount);
  }, [
    categories,
    categoryPieData.slices,
    dayFilteredExpenses,
    selectedCategory,
    selectedDay,
    top4CategoryNames,
  ]);

  if (loadingDashboardData) {
    return <DashboardPageSkeleton variant="home" />;
  }

  return (
    <div className="dashboard-container">
      {/* 1. Category Breakdown Pie Graph & Weekly Expenses by Day Bar Graph */}
      <section className="dashboard-content" aria-label="Spending overview">
        <article className="spending-card" aria-label="Category spending breakdown">
          <div className="spending-card-header">
            <div className="card-heading">
              <p className="card-eyebrow">Category Spending</p>
              <h2 className="spending-card-title">Category Breakdown</h2>
              <div className="pie-day-filter-slot">
                {selectedDay && (
                  <div className="chart-active-filter-group">
                    <div className="chart-active-filter-badge">
                      <span
                        className="filter-badge-dot"
                        style={{ backgroundColor: "var(--buck-orange)" }}
                        aria-hidden="true"
                      />
                      <span className="filter-badge-label">
                        <span className="filter-badge-prefix">Day:</span>
                        <strong className="filter-badge-name">
                          {fullDayNames[selectedDay] || selectedDay}
                        </strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="filter-clear-btn"
                      onClick={() => setSelectedDay(null)}
                      title="Clear day filter"
                      aria-label="Clear day filter"
                    >
                      ✕ All Days
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="spending-timeframe-container">
              <div
                className="timeframe-toggle-group"
                role="group"
                aria-label="Category breakdown timeframe filter"
              >
                <button
                  type="button"
                  className={`timeframe-btn ${timeframe === "all" ? "timeframe-btn--active" : ""}`}
                  onClick={() => {
                    setTimeframe("all");
                    setSelectedDay(null);
                  }}
                >
                  All Time
                </button>
                <button
                  type="button"
                  className={`timeframe-btn ${timeframe === "month" ? "timeframe-btn--active" : ""}`}
                  onClick={() => {
                    setTimeframe("month");
                    setSelectedDay(null);
                  }}
                >
                  This Month
                </button>
                <button
                  type="button"
                  className={`timeframe-btn ${timeframe === "week" ? "timeframe-btn--active" : ""}`}
                  onClick={() => {
                    setTimeframe("week");
                    setSelectedDay(null);
                  }}
                >
                  This Week
                </button>
              </div>
            </div>
          </div>
          <WeeklyPieChart
            slices={categoryPieData.slices}
            total={categoryPieData.total}
            selectedCategory={selectedCategory}
            selectedCategoryAmount={selectedCategoryAmount}
            onSelectCategory={setSelectedCategory}
            centerLabel={
              selectedDay
                ? `Total on ${fullDayNames[selectedDay] || selectedDay}`
                : timeframe === "week"
                ? "Total this week"
                : timeframe === "month"
                ? "Total this month"
                : "Total all-time"
            }
            emptyMessage={
              selectedDay
                ? `No expenses recorded on ${fullDayNames[selectedDay] || selectedDay}`
                : timeframe === "week"
                ? "No expenses recorded this week"
                : timeframe === "month"
                ? "No expenses recorded this month"
                : "No expenses recorded yet"
            }
          />
        </article>

        <article className="graph-card">
          <div className="card-heading-row">
            <div className="card-heading">
              <p className="card-eyebrow">
                {timeframe === "week"
                  ? "Weekly Summary"
                  : timeframe === "month"
                  ? "Monthly Summary"
                  : "All-Time Summary"}
              </p>
              <div className="summary-title-row">
                <h2 className="graph-title">Expenses by day</h2>
                {(selectedCategory || selectedDay) && (
                  <div className="chart-active-filter-group">
                    {selectedCategory && (
                      <>
                        <div className="chart-active-filter-badge">
                          <span
                            className="filter-badge-dot"
                            style={{
                              backgroundColor: selectedCategoryColor || "var(--buck-orange)",
                            }}
                            aria-hidden="true"
                          />
                          <span className="filter-badge-label">
                            <span className="filter-badge-prefix">Category:</span>
                            <strong className="filter-badge-name">{selectedCategory}</strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          className="filter-clear-btn"
                          onClick={() => setSelectedCategory(null)}
                          title="Clear category filter"
                          aria-label="Clear category filter"
                        >
                          ✕ Clear
                        </button>
                      </>
                    )}
                    {selectedDay && (
                      <>
                        <div className="chart-active-filter-badge">
                          <span
                            className="filter-badge-dot"
                            style={{ backgroundColor: "var(--buck-orange)" }}
                            aria-hidden="true"
                          />
                          <span className="filter-badge-label">
                            <span className="filter-badge-prefix">Day:</span>
                            <strong className="filter-badge-name">
                              {fullDayNames[selectedDay] || selectedDay}
                            </strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          className="filter-clear-btn"
                          onClick={() => setSelectedDay(null)}
                          title="Clear day filter"
                          aria-label="Clear day filter"
                        >
                          ✕ Clear
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
          <WeeklyBarChart
            data={weeklyData}
            categoryColor={selectedCategoryColor}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
          />
        </article>
      </section>

      {/* 2. Financial Summary (Categories) - placed directly below Pie and Bar graph cards */}
      <section className="summary-card" aria-label="Categories financial summary">
        <div className="card-heading-row">
          <div className="card-heading">
            <p className="card-eyebrow">Categories</p>
            <div className="summary-title-row">
              <h2 className="summary-title">Financial Summary</h2>
            </div>
          </div>
        </div>
        <FinancialSummaryTable
          items={summaryData}
          selectedCategory={selectedCategory}
          selectedCategoryColor={selectedCategoryColor}
          onSelectCategory={(cat) => setSelectedCategory(cat)}
          selectedDay={selectedDay}
          fullDayNames={fullDayNames}
          onClearDay={() => setSelectedDay(null)}
          isSubCategoryOfOthers={isSubCategoryOfOthers}
        />
      </section>

      {/* 3. AI Financial Advisor Card */}
      <AIAdvisorPlaceholderCard
        userId={user.uid}
        activeWalletBudget={userCache.activeWalletBudget}
        totalExpensesCount={expenses.length}
      />
    </div>
  );
}
