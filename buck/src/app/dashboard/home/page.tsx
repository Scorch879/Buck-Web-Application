"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
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
type AllTimeGranularity = "months" | "years";

type BarTimeBucket = {
  key: string;
  subLabel?: string;
  fullLabel: string;
  start: Date;
  end: Date;
};

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const PAGE_MONTHS = 6;
const PAGE_YEARS = 5;

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

function buildBarTimeBuckets(
  allExpenses: Expense[],
  timeframe: TimeframeFilter,
  allTimeGranularity: AllTimeGranularity,
  barPageOffset: number
): {
  buckets: BarTimeBucket[];
  totalPages: number;
  safePage: number;
  windowLabel: string;
} {
  const today = new Date();
  const todayYear = today.getFullYear();
  const todayMonth = today.getMonth();

  if (timeframe === "week") {
    const { start, end } = getCurrentWeekRange();
    const buckets: BarTimeBucket[] = weekDays.map((day, index) => {
      const date = new Date(start);
      date.setDate(start.getDate() + index);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
      const dayEnd = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
      const subLabel = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      return {
        key: day,
        subLabel,
        fullLabel: `${fullDayNames[day] || day} (${subLabel})`,
        start: dayStart,
        end: dayEnd,
      };
    });
    const startFmt = start.toLocaleDateString("en-US", { month: "short", day: "numeric" });
    const endFmt = end.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
    return {
      buckets,
      totalPages: 1,
      safePage: 0,
      windowLabel: `${startFmt} – ${endFmt}`,
    };
  }

  if (timeframe === "month") {
    const daysInMonth = new Date(todayYear, todayMonth + 1, 0).getDate();
    const monthShort = today.toLocaleString("en-US", { month: "short" });
    const monthFull = today.toLocaleString("en-US", { month: "long", year: "numeric" });
    const weekRanges: [number, number][] = [
      [1, 7],
      [8, 14],
      [15, 21],
      [22, daysInMonth],
    ];
    const buckets: BarTimeBucket[] = weekRanges.map(([startDay, endDay], idx) => {
      const key = `Week ${idx + 1}`;
      const subLabel = `${monthShort} ${startDay}–${endDay}`;
      return {
        key,
        subLabel,
        fullLabel: `${key} (${subLabel})`,
        start: new Date(todayYear, todayMonth, startDay, 0, 0, 0, 0),
        end: new Date(todayYear, todayMonth, endDay, 23, 59, 59, 999),
      };
    });
    return {
      buckets,
      totalPages: 1,
      safePage: 0,
      windowLabel: monthFull,
    };
  }

  // timeframe === "all": find earliest expense date
  let minDate = new Date(todayYear, todayMonth, 1);
  for (const exp of allExpenses) {
    const parsed = parseExpenseDate(exp);
    if (parsed && parsed < minDate) {
      minDate = parsed;
    }
  }

  if (allTimeGranularity === "years") {
    const minYear = minDate.getFullYear();
    const yearsSpan = Math.max(0, todayYear - minYear) + 1;
    const totalPages = Math.max(1, Math.ceil(yearsSpan / PAGE_YEARS));
    const safePage = Math.min(Math.max(0, barPageOffset), totalPages - 1);
    const endYear = todayYear - safePage * PAGE_YEARS;
    const startYear = endYear - (PAGE_YEARS - 1);

    const buckets: BarTimeBucket[] = Array.from({ length: PAGE_YEARS }, (_, idx) => {
      const yr = startYear + idx;
      const key = String(yr);
      return {
        key,
        fullLabel: `Year ${yr}`,
        start: new Date(yr, 0, 1, 0, 0, 0, 0),
        end: new Date(yr, 11, 31, 23, 59, 59, 999),
      };
    });

    return {
      buckets,
      totalPages,
      safePage,
      windowLabel: `${startYear} – ${endYear}`,
    };
  }

  // Default "all" granularity: Paginated 6-Month Windows
  const monthsDiff =
    (todayYear - minDate.getFullYear()) * 12 + (todayMonth - minDate.getMonth());
  const totalPages = Math.max(1, Math.ceil((Math.max(0, monthsDiff) + 1) / PAGE_MONTHS));
  const safePage = Math.min(Math.max(0, barPageOffset), totalPages - 1);
  const endMonthOffset = safePage * PAGE_MONTHS;

  const buckets: BarTimeBucket[] = Array.from({ length: PAGE_MONTHS }, (_, idx) => {
    const offsetFromToday = endMonthOffset + (PAGE_MONTHS - 1 - idx);
    const d = new Date(todayYear, todayMonth - offsetFromToday, 1);
    const yr = d.getFullYear();
    const mo = d.getMonth();
    const monthShort = d.toLocaleString("en-US", { month: "short" });
    const monthFull = d.toLocaleString("en-US", { month: "long", year: "numeric" });
    return {
      key: monthShort,
      subLabel: String(yr),
      fullLabel: monthFull,
      start: new Date(yr, mo, 1, 0, 0, 0, 0),
      end: new Date(yr, mo + 1, 0, 23, 59, 59, 999),
    };
  });

  const firstBucket = buckets[0];
  const lastBucket = buckets[buckets.length - 1];
  const firstLabel = firstBucket.start.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });
  const lastLabel = lastBucket.start.toLocaleString("en-US", {
    month: "short",
    year: "numeric",
  });

  return {
    buckets,
    totalPages,
    safePage,
    windowLabel: `${firstLabel} – ${lastLabel}`,
  };
}

function getBucketExpensesData(
  filteredExpenses: Expense[],
  buckets: BarTimeBucket[]
): WeeklyDatum[] {
  return buckets.map((bucket) => {
    const amount = filteredExpenses
      .filter((expense) => {
        const expenseDate = parseExpenseDate(expense);
        return expenseDate
          ? expenseDate >= bucket.start && expenseDate <= bucket.end
          : false;
      })
      .reduce((sum, expense) => sum + toNumber(expense.amount), 0);

    return {
      day: bucket.key,
      subLabel: bucket.subLabel,
      fullLabel: bucket.fullLabel,
      amount,
    };
  });
}

function matchesBucketFilter(
  expense: Expense,
  selectedBucketKey: string | null,
  buckets: BarTimeBucket[]
): boolean {
  if (!selectedBucketKey) return true;
  const expenseDate = parseExpenseDate(expense);
  if (!expenseDate) return false;
  const target = buckets.find((b) => b.key === selectedBucketKey);
  if (!target) return false;
  return expenseDate >= target.start && expenseDate <= target.end;
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
  const [allTimeGranularity, setAllTimeGranularity] =
    useState<AllTimeGranularity>("months");
  const [barPageOffset, setBarPageOffset] = useState(0);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const barBucketConfig = useMemo(
    () =>
      buildBarTimeBuckets(
        expenses,
        timeframe,
        allTimeGranularity,
        barPageOffset
      ),
    [expenses, timeframe, allTimeGranularity, barPageOffset]
  );

  const bucketFullNames = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = { ...fullDayNames };
    for (const bucket of barBucketConfig.buckets) {
      map[bucket.key] = bucket.fullLabel;
    }
    return map;
  }, [barBucketConfig.buckets]);

  const bucketFilterPrefix =
    timeframe === "week" ? "Day:" : timeframe === "month" ? "Week:" : "Period:";
  const bucketClearLabel =
    timeframe === "week"
      ? "✕ All Days"
      : timeframe === "month"
      ? "✕ All Weeks"
      : "✕ All Periods";

  const pieExpenses = useMemo(
    () => getFilteredExpenses(expenses, timeframe),
    [expenses, timeframe]
  );

  const dayFilteredExpenses = useMemo(() => {
    if (!selectedDay) return pieExpenses;
    return pieExpenses.filter((e) =>
      matchesBucketFilter(e, selectedDay, barBucketConfig.buckets)
    );
  }, [pieExpenses, selectedDay, barBucketConfig.buckets]);

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

  // If timeframe or bucket window changes and selected bucket no longer has expenses, reset it
  useEffect(() => {
    if (selectedDay && pieExpenses.length > 0) {
      const hasDayExpenses = pieExpenses.some((e) =>
        matchesBucketFilter(e, selectedDay, barBucketConfig.buckets)
      );
      if (!hasDayExpenses) {
        setSelectedDay(null);
      }
    }
  }, [pieExpenses, selectedDay, barBucketConfig.buckets]);

  const barChartExpenses = useMemo(() => {
    return pieExpenses.filter((expense) =>
      matchesCategoryFilter(expense.category, selectedCategory, top4CategoryNames)
    );
  }, [pieExpenses, selectedCategory, top4CategoryNames]);

  const weeklyData = useMemo(
    () => getBucketExpensesData(barChartExpenses, barBucketConfig.buckets),
    [barChartExpenses, barBucketConfig.buckets]
  );

  const summaryData = useMemo<SummaryTableItem[]>(() => {
    const isOthersSelection =
      selectedCategory === "Others" || selectedCategory === "Others (Combined)";
    const activeDayName = selectedDay ? (bucketFullNames[selectedDay] || selectedDay) : null;

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
              ? `Grouped under Others in ${activeDayName}.`
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
            ? `Combined expenses outside the top 4 categories in ${activeDayName}.`
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
              ? `Spending under ${name} in ${activeDayName}.`
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
    bucketFullNames,
    top4CategoryNames,
  ]);

  if (loadingDashboardData) {
    return <DashboardPageSkeleton variant="home" />;
  }

  const barChartTitle =
    timeframe === "week"
      ? "Expenses by day"
      : timeframe === "month"
      ? "Expenses by week"
      : allTimeGranularity === "years"
      ? "Expenses by year"
      : "Expenses by month";

  const barXAxisTitle =
    timeframe === "week"
      ? "Day of the Week"
      : timeframe === "month"
      ? "Week of the Month (Weeks 1–4)"
      : allTimeGranularity === "years"
      ? "Year (5-Year Window)"
      : "Month (6-Month Window)";

  return (
    <div className="dashboard-container">
      {/* 1. Category Breakdown Pie Graph & Dynamic Expenses Bar Graph */}
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
                        <span className="filter-badge-prefix">{bucketFilterPrefix}</span>
                        <strong className="filter-badge-name">
                          {bucketFullNames[selectedDay] || selectedDay}
                        </strong>
                      </span>
                    </div>
                    <button
                      type="button"
                      className="filter-clear-btn"
                      onClick={() => setSelectedDay(null)}
                      title="Clear period filter"
                      aria-label="Clear period filter"
                    >
                      {bucketClearLabel}
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
                    setBarPageOffset(0);
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
                    setBarPageOffset(0);
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
                    setBarPageOffset(0);
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
                ? `Total in ${bucketFullNames[selectedDay] || selectedDay}`
                : timeframe === "week"
                ? "Total this week"
                : timeframe === "month"
                ? "Total this month"
                : "Total all-time"
            }
            emptyMessage={
              selectedDay
                ? `No expenses recorded in ${bucketFullNames[selectedDay] || selectedDay}`
                : timeframe === "week"
                ? "No expenses recorded this week"
                : timeframe === "month"
                ? "No expenses recorded this month"
                : "No expenses recorded yet"
            }
          />
        </article>

        <article className="graph-card">
          <div className="card-heading-row graph-card-header-row">
            <div className="card-heading">
              <p className="card-eyebrow">
                {timeframe === "week"
                  ? "Weekly Summary"
                  : timeframe === "month"
                  ? "Monthly Summary"
                  : "All-Time Summary"}
              </p>
              <div className="summary-title-row">
                <h2 className="graph-title">{barChartTitle}</h2>
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
                            <span className="filter-badge-prefix">{bucketFilterPrefix}</span>
                            <strong className="filter-badge-name">
                              {bucketFullNames[selectedDay] || selectedDay}
                            </strong>
                          </span>
                        </div>
                        <button
                          type="button"
                          className="filter-clear-btn"
                          onClick={() => setSelectedDay(null)}
                          title="Clear period filter"
                          aria-label="Clear period filter"
                        >
                          ✕ Clear
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="graph-card-controls">
              {timeframe === "all" ? (
                <>
                  <div
                    className="graph-granularity-toggle"
                    role="group"
                    aria-label="All-time bar chart granularity"
                  >
                    <button
                      type="button"
                      className={`graph-granularity-btn ${
                        allTimeGranularity === "months" ? "graph-granularity-btn--active" : ""
                      }`}
                      onClick={() => {
                        setAllTimeGranularity("months");
                        setBarPageOffset(0);
                        setSelectedDay(null);
                      }}
                    >
                      By Month
                    </button>
                    <button
                      type="button"
                      className={`graph-granularity-btn ${
                        allTimeGranularity === "years" ? "graph-granularity-btn--active" : ""
                      }`}
                      onClick={() => {
                        setAllTimeGranularity("years");
                        setBarPageOffset(0);
                        setSelectedDay(null);
                      }}
                    >
                      5 Years
                    </button>
                  </div>
                  <div className="graph-pager" aria-label="Bar chart period pagination">
                    <button
                      type="button"
                      className="graph-pager-btn"
                      onClick={() => {
                        setBarPageOffset((prev) =>
                          Math.min(prev + 1, barBucketConfig.totalPages - 1)
                        );
                        setSelectedDay(null);
                      }}
                      disabled={barBucketConfig.safePage >= barBucketConfig.totalPages - 1}
                      aria-label="Previous period window"
                      title="Earlier periods"
                    >
                      <FaChevronLeft aria-hidden="true" />
                    </button>
                    <span className="graph-pager-label" aria-live="polite">
                      {barBucketConfig.windowLabel}
                    </span>
                    <button
                      type="button"
                      className="graph-pager-btn"
                      onClick={() => {
                        setBarPageOffset((prev) => Math.max(0, prev - 1));
                        setSelectedDay(null);
                      }}
                      disabled={barBucketConfig.safePage <= 0}
                      aria-label="Next period window"
                      title="More recent periods"
                    >
                      <FaChevronRight aria-hidden="true" />
                    </button>
                  </div>
                </>
              ) : (
                <span className="graph-period-badge" aria-live="polite">
                  {barBucketConfig.windowLabel}
                </span>
              )}
            </div>
          </div>
          <WeeklyBarChart
            data={weeklyData}
            categoryColor={selectedCategoryColor}
            selectedDay={selectedDay}
            onSelectDay={handleSelectDay}
            xAxisTitle={barXAxisTitle}
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
          fullDayNames={bucketFullNames}
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
