"use client";
import { computeGoalForecast } from "@/utils/goalForecast";
import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { FaChevronLeft, FaChevronRight, FaPlus } from "react-icons/fa";
import "./style.css";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useDashboardUser } from "@/context/DashboardUserContext";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import { useIncomes } from "@/hooks/useIncomes";
import MonthlyCashFlowCard from "@/component/income/MonthlyCashFlowCard";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";
import {
  mergeDashboardDataCache,
  useFinancial,
} from "@/context/FinancialContext";
import { formatCurrency } from "@/utils/formatters";
import {
  ensureDefaultCategories,
  getActiveWallet,
  listExpenses,
  listGoals,
  subscribeUserTable,
  type BuckCategory,
  type BuckExpense,
  type BuckGoal,
} from "@/utils/supabaseData";
import BudgetDonut, { getBudgetLevel } from "./BudgetDonut";
import CategoryBreakdown, { type CategoryTotal } from "./CategoryBreakdown";
import SpendingTrendChart from "./SpendingTrendChart";
import AddExpenseModal from "./AddExpenseModal";
import {
  buildMonthRanges,
  buildWeekRanges,
  daysBetween,
  findCurrentRangeIndex,
  formatDayKey,
  formatRangeLabel,
  isInRange,
  parseDayKey,
  storedDayKey,
  toDayKey,
  type DateRange,
} from "@/utils/periods";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

type Mode = "week" | "month" | "overall";

type ForecastResponse = {
  forecast_per_day?: Record<string, number>;
  actual_per_day?: Record<string, number>;
};

const MODES: { value: Mode; label: string }[] = [
  { value: "week", label: "Weekly" },
  { value: "month", label: "Monthly" },
  { value: "overall", label: "Overall" },
];

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const RECENT_LIMIT = 5;
const OVERALL_TREND_MONTHS = 12;

const sumAmounts = (items: BuckExpense[]) =>
  items.reduce((sum, exp) => sum + (Number(exp.amount) || 0), 0);

const Statistics = () => {
  const { user } = useDashboardUser();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const userCache = dashboardCache.userId === user.uid ? dashboardCache : {};
  const hasInitialStatisticsData = Boolean(
    userCache.categories &&
      userCache.expenses &&
      userCache.activeWalletBudget !== undefined
  );
  const hasInitialGoalsData = Boolean(userCache.goals);
  const isDarkTheme = useAuthPageTheme();
  const chartTextColor = isDarkTheme ? "#d9c7b6" : "#756d68";
  const chartGridColor = isDarkTheme
    ? "rgba(255,211,154,0.12)"
    : "rgba(120,92,70,0.12)";

  const [goals, setGoals] = useState<BuckGoal[]>(() => userCache.goals ?? []);
  const [loadingGoals, setLoadingGoals] = useState(() => !hasInitialGoalsData);
  const [loadingStatisticsData, setLoadingStatisticsData] = useState(
    () => !hasInitialStatisticsData
  );
  const [categories, setCategories] = useState<BuckCategory[]>(
    () => userCache.categories ?? []
  );
  const [expenses, setExpenses] = useState<BuckExpense[]>(
    () => userCache.expenses ?? []
  );
  const [wallet, setWallet] = useState<number>(
    () => userCache.activeWalletBudget ?? 0
  );
  const hadInitialStatisticsData = useRef(hasInitialStatisticsData);
  const hadInitialGoalsData = useRef(hasInitialGoalsData);
  const { cashFlow } = useIncomes(user.uid, expenses);

  const [mode, setMode] = useState<Mode>("week");
  // -1 = follow the current week/month until the user steps away from it.
  const [weekIdx, setWeekIdx] = useState(-1);
  const [monthIdx, setMonthIdx] = useState(-1);
  const [showExpenseModal, setShowExpenseModal] = useState(false);

  const [forecastData, setForecastData] = useState<ForecastResponse | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");
  // Bumped by the Retry button to re-run the forecast request.
  const [forecastAttempt, setForecastAttempt] = useState(0);

  const refreshWallet = async () => {
    const activeWallet = await getActiveWallet(user.uid);
    const nextWalletBudget = activeWallet?.budget ?? 0;
    setWallet(nextWalletBudget);
    setDashboardCache((currentCache) =>
      mergeDashboardDataCache(currentCache, user.uid, {
        activeWalletBudget: nextWalletBudget,
      })
    );
  };

  // --- Fetch categories, expenses, and wallet on load ---
  useEffect(() => {
    if (!user) return;
    let active = true;

    const fetchCategories = async () => {
      const cats = await ensureDefaultCategories(user.uid);

      if (active) {
        const nextCategories = [...cats].sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setCategories(nextCategories);
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, user.uid, {
            categories: nextCategories,
          })
        );
      }
    };
    const fetchExpenses = async () => {
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
    const fetchWallet = async () => {
      const activeWallet = await getActiveWallet(user.uid);

      if (active) {
        const nextWalletBudget = activeWallet?.budget ?? 0;
        setWallet(nextWalletBudget);
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, user.uid, {
            activeWalletBudget: nextWalletBudget,
          })
        );
      }
    };

    const fetchInitialStatisticsData = async () => {
      if (!hadInitialStatisticsData.current) {
        setLoadingStatisticsData(true);
      }

      try {
        await Promise.all([fetchCategories(), fetchExpenses(), fetchWallet()]);
      } catch (error) {
        console.error("Failed to load statistics:", error);
      } finally {
        if (active) {
          setLoadingStatisticsData(false);
        }
      }
    };

    void fetchInitialStatisticsData();

    const unsubCategories = subscribeUserTable(
      "categories",
      user.uid,
      () => void fetchCategories()
    );
    const unsubExpenses = subscribeUserTable(
      "expenses",
      user.uid,
      () => void fetchExpenses()
    );
    const unsubWallets = subscribeUserTable("wallets", user.uid, () => {
      void fetchWallet();
    });

    return () => {
      active = false;
      unsubCategories();
      unsubExpenses();
      unsubWallets();
    };
    // Keyed on user.uid: the user object itself is not referentially stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setDashboardCache, user.uid]);

  useEffect(() => {
    const fetchGoals = async () => {
      try {
        const nextGoals = await listGoals(user.uid);
        setGoals(nextGoals);
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, user.uid, {
            goals: nextGoals,
          })
        );
      } catch (error) {
        console.error("Failed to load goals:", error);
      } finally {
        setLoadingGoals(false);
      }
    };

    if (!hadInitialGoalsData.current) {
      setLoadingGoals(true);
    }

    void fetchGoals();

    const unsubscribeGoals = subscribeUserTable("goals", user.uid, () => {
      void fetchGoals();
    });

    return () => {
      unsubscribeGoals();
    };
  }, [setDashboardCache, user.uid]);

  // --- Calendar ranges: earliest expense/goal up to today ---
  const todayKey = toDayKey(new Date());
  const { weekRanges, monthRanges, overallRange } = useMemo(() => {
    const keys = [
      ...expenses.map((e) => storedDayKey(e.date)),
      ...goals.map((g) => storedDayKey(g.createdAt)),
    ].filter(Boolean);
    const firstKey = keys.length ? keys.reduce((a, b) => (a < b ? a : b)) : todayKey;
    const lastKey = keys.reduce((a, b) => (a > b ? a : b), todayKey);
    const from = parseDayKey(firstKey);
    const to = parseDayKey(lastKey);
    return {
      weekRanges: buildWeekRanges(from, to),
      monthRanges: buildMonthRanges(from, to),
      overallRange: { start: firstKey, end: lastKey } as DateRange,
    };
  }, [expenses, goals, todayKey]);

  const currentWeekIdx = findCurrentRangeIndex(weekRanges);
  const currentMonthIdx = findCurrentRangeIndex(monthRanges);
  const activeWeekIdx =
    weekIdx >= 0 && weekIdx < weekRanges.length ? weekIdx : currentWeekIdx;
  const activeMonthIdx =
    monthIdx >= 0 && monthIdx < monthRanges.length ? monthIdx : currentMonthIdx;

  const range: DateRange | undefined =
    mode === "week"
      ? weekRanges[activeWeekIdx]
      : mode === "month"
        ? monthRanges[activeMonthIdx]
        : overallRange;

  const stepIndex = mode === "week" ? activeWeekIdx : activeMonthIdx;
  const stepCount = mode === "week" ? weekRanges.length : monthRanges.length;
  const isCurrentPeriod =
    mode === "overall" ||
    (mode === "week"
      ? activeWeekIdx === currentWeekIdx
      : activeMonthIdx === currentMonthIdx);

  const stepPeriod = (delta: number) => {
    const next = Math.min(Math.max(stepIndex + delta, 0), stepCount - 1);
    if (mode === "week") setWeekIdx(next);
    else setMonthIdx(next);
  };

  const resetToCurrent = () => {
    if (mode === "week") setWeekIdx(-1);
    else setMonthIdx(-1);
  };

  const periodTitle =
    mode === "overall"
      ? "All time"
      : mode === "month"
        ? monthRanges[activeMonthIdx]?.label ?? ""
        : isCurrentPeriod
          ? "This week"
          : `Week of ${formatDayKey(weekRanges[activeWeekIdx]?.start ?? "")}`;
  const periodNoun = mode === "week" ? "week" : mode === "month" ? "month" : "period";

  // --- Period figures ---
  const periodExpenses = useMemo(
    () =>
      mode === "overall"
        ? expenses
        : expenses.filter((exp) => isInRange(storedDayKey(exp.date), range)),
    [expenses, mode, range]
  );
  const spent = sumAmounts(periodExpenses);
  // Budget split kept from the previous page: a quarter of the active wallet
  // per week, the whole wallet per month or overall.
  const budget = mode === "week" ? wallet / 4 : wallet;
  const level = getBudgetLevel(spent, budget);
  const countedDays = range
    ? Math.max(1, daysBetween(range.start, range.end < todayKey ? range.end : todayKey))
    : 1;
  const dailyAverage = spent / countedDays;

  const categoryTotals: CategoryTotal[] = useMemo(() => {
    const totals = new Map<string, number>();
    periodExpenses.forEach((exp) => {
      const name = exp.category || "Uncategorized";
      totals.set(name, (totals.get(name) ?? 0) + (Number(exp.amount) || 0));
    });
    return [...totals].map(([name, amount]) => ({ name, amount }));
  }, [periodExpenses]);
  const usedCategoryCount = categoryTotals.filter((c) => c.amount > 0).length;

  // --- Trend buckets: days of the week, 7-day blocks of the month, or months ---
  const trend = useMemo(() => {
    if (!range) return { labels: [], values: [], budgets: [], unit: "day" };
    if (mode === "week") {
      const start = parseDayKey(range.start);
      const keys = WEEKDAYS.map((_, i) => {
        const d = new Date(start);
        d.setDate(d.getDate() + i);
        return toDayKey(d);
      });
      return {
        labels: keys.map((k, i) => `${WEEKDAYS[i]} ${parseDayKey(k).getDate()}`),
        values: keys.map((k) =>
          sumAmounts(periodExpenses.filter((e) => storedDayKey(e.date) === k))
        ),
        budgets: keys.map(() => budget / 7),
        unit: "day",
      };
    }
    if (mode === "month") {
      const monthDays = daysBetween(range.start, range.end);
      const start = parseDayKey(range.start);
      const blocks: DateRange[] = [];
      for (let day = 1; day <= monthDays; day += 7) {
        const s = new Date(start.getFullYear(), start.getMonth(), day);
        const e = new Date(start.getFullYear(), start.getMonth(), Math.min(day + 6, monthDays));
        blocks.push({ start: toDayKey(s), end: toDayKey(e) });
      }
      const monthShort = start.toLocaleString("en-US", { month: "short" });
      return {
        labels: blocks.map(
          (b) =>
            `${monthShort} ${parseDayKey(b.start).getDate()}–${parseDayKey(b.end).getDate()}`
        ),
        values: blocks.map((b) =>
          sumAmounts(periodExpenses.filter((e) => isInRange(storedDayKey(e.date), b)))
        ),
        // Pro-rate by block length: the last block of a month is often 2-3 days.
        budgets: blocks.map((b) => (budget / monthDays) * daysBetween(b.start, b.end)),
        unit: "week",
      };
    }
    const months = monthRanges.slice(-OVERALL_TREND_MONTHS);
    const spansYears =
      months.length > 0 &&
      months[0].start.slice(0, 4) !== months[months.length - 1].start.slice(0, 4);
    return {
      labels: months.map((m) =>
        parseDayKey(m.start).toLocaleString("en-US", {
          month: "short",
          ...(spansYears ? { year: "2-digit" as const } : {}),
        })
      ),
      values: months.map((m) =>
        sumAmounts(expenses.filter((e) => isInRange(storedDayKey(e.date), m)))
      ),
      budgets: months.map(() => budget),
      unit: "month",
    };
  }, [budget, expenses, mode, monthRanges, periodExpenses, range]);

  const recentExpenses = useMemo(
    () =>
      [...periodExpenses]
        .sort((a, b) => storedDayKey(b.date).localeCompare(storedDayKey(a.date)))
        .slice(0, RECENT_LIMIT),
    [periodExpenses]
  );

  // --- AI forecast for the active goal (falls back to the first goal) ---
  const forecastGoal = goals.find((g) => g.isActive) ?? goals[0];
  const forecastGoalKey = forecastGoal
    ? `${forecastGoal.id}|${forecastGoal.targetAmount}|${forecastGoal.targetDate ?? ""}|${forecastGoal.attitude ?? ""}`
    : "";

  useEffect(() => {
    if (!forecastGoal) {
      setForecastData(null);
      return;
    }
    let cancelled = false;
    setForecastLoading(true);
    setForecastError("");
    setForecastData(null);

    const fetchForecast = async () => {
      try {
        const data: ForecastResponse = computeGoalForecast(forecastGoal);
        if (!cancelled) setForecastData(data);
      } catch (err) {
        if (!cancelled) {
          setForecastError(err instanceof Error ? err.message : "Unknown error");
        }
      } finally {
        if (!cancelled) setForecastLoading(false);
      }
    };

    void fetchForecast();
    return () => {
      cancelled = true;
    };
    // forecastGoalKey covers every goal field the request sends.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forecastGoalKey, forecastAttempt, user.uid]);

  const forecastChart = useMemo(() => {
    const perDay = forecastData?.forecast_per_day;
    if (!perDay) return null;
    const keys = Object.keys(perDay)
      .filter((k) => mode === "overall" || isInRange(k, range))
      .sort();
    if (keys.length === 0) return null;
    const forecastVals = keys.map((k) => Number(perDay[k]) || 0);
    const actualVals = keys.map((k) => Number(forecastData?.actual_per_day?.[k]) || 0);
    const avg = forecastVals.reduce((a, b) => a + b, 0) / forecastVals.length;
    return {
      avg,
      data: {
        labels: keys.map((k) => formatDayKey(k)),
        datasets: [
          {
            label: "Forecast",
            data: forecastVals,
            borderColor: "#f47536",
            backgroundColor: "rgba(244,117,54,0.14)",
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2.5,
          },
          {
            label: "Actual",
            data: actualVals,
            borderColor: "#ffc547",
            backgroundColor: "rgba(255,197,71,0.12)",
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            pointHoverRadius: 5,
            borderWidth: 2.5,
          },
        ],
      },
    };
  }, [forecastData, mode, range]);

  if (loadingGoals || loadingStatisticsData) {
    return <DashboardPageSkeleton variant="statistics" />;
  }

  const hasBudget = budget > 0;
  const remaining = budget - spent;
  const budgetSource =
    mode === "week"
      ? `¼ of your active wallet (${formatCurrency(wallet)})`
      : `your active wallet (${formatCurrency(wallet)})`;
  const trendHasBudget = trend.budgets.some((b) => b > 0);
  const trendHasSpending = trend.values.some((v) => v > 0);

  return (
    <div className="stats-page">
      {/* Monthly cash flow (income vs expenses), same formulas as the mobile app */}
      <MonthlyCashFlowCard cashFlow={cashFlow} />

      {/* Period toolbar: every card below follows this selection */}
      <header className="stats-card stats-toolbar">
        <div className="stats-heading">
          <p className="stats-eyebrow">Statistics</p>
          <h2>Spending breakdown</h2>
        </div>
        <div className="stats-period">
          <div className="stats-segmented" role="group" aria-label="View mode">
            {MODES.map((m) => (
              <button
                key={m.value}
                type="button"
                className="stats-segmented-btn"
                aria-pressed={mode === m.value}
                onClick={() => setMode(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
          <div className="stats-stepper">
            <button
              type="button"
              className="stats-icon-btn"
              aria-label={`Previous ${periodNoun}`}
              onClick={() => stepPeriod(-1)}
              disabled={mode === "overall" || stepIndex <= 0}
            >
              <FaChevronLeft aria-hidden="true" />
            </button>
            <div className="stats-stepper-label" aria-live="polite">
              <strong>
                {periodTitle}
                {isCurrentPeriod && mode !== "overall" && (
                  <span className="stats-current-dot" title="Current period" />
                )}
              </strong>
              <span>{range ? formatRangeLabel(range) : "No data"}</span>
            </div>
            <button
              type="button"
              className="stats-icon-btn"
              aria-label={`Next ${periodNoun}`}
              onClick={() => stepPeriod(1)}
              disabled={mode === "overall" || stepIndex >= stepCount - 1}
            >
              <FaChevronRight aria-hidden="true" />
            </button>
          </div>
          {!isCurrentPeriod && (
            <button type="button" className="stats-text-btn" onClick={resetToCurrent}>
              Back to current
            </button>
          )}
        </div>
      </header>

      <div className="stats-grid">
        {/* Budget split */}
        <section className="stats-card stats-budget">
          <div className="stats-card-header">
            <div>
              <p className="stats-eyebrow">Budget</p>
              <h3>Spent vs budget</h3>
            </div>
          </div>
          <BudgetDonut spent={spent} budget={budget} />
          <dl className="stats-figures">
            <div>
              <dt>Spent</dt>
              <dd>{formatCurrency(spent)}</dd>
            </div>
            <div>
              <dt>{hasBudget && remaining < 0 ? "Over budget" : "Remaining"}</dt>
              <dd className={hasBudget ? `stats-level--${level}` : undefined}>
                {hasBudget ? formatCurrency(Math.abs(remaining)) : "—"}
              </dd>
            </div>
            <div>
              <dt>Daily average</dt>
              <dd>{formatCurrency(dailyAverage)}</dd>
            </div>
            <div>
              <dt>Transactions</dt>
              <dd>{periodExpenses.length}</dd>
            </div>
          </dl>
          {hasBudget ? (
            <p className="stats-note">
              {mode === "week" ? "Weekly" : mode === "month" ? "Monthly" : "Overall"} budget{" "}
              <strong>{formatCurrency(budget)}</strong> = {budgetSource}.
            </p>
          ) : (
            <p className="stats-note">
              No wallet budget yet. <Link href="/dashboard/wallet">Set one in Wallet</Link>.
            </p>
          )}
        </section>

        {/* Category ranking */}
        <section className="stats-card stats-categories">
          <div className="stats-card-header">
            <div>
              <p className="stats-eyebrow">Categories</p>
              <h3>Where your money went</h3>
            </div>
            <span className="stats-badge">
              {usedCategoryCount} {usedCategoryCount === 1 ? "category" : "categories"}
            </span>
          </div>
          <CategoryBreakdown totals={categoryTotals} />
          {spent > 0 && (
            <p className="stats-category-total">
              <span>Total spent</span>
              <strong>{formatCurrency(spent)}</strong>
            </p>
          )}
        </section>

        {/* Spending trend */}
        <section className="stats-card stats-trend">
          <div className="stats-card-header">
            <div>
              <p className="stats-eyebrow">Trend</p>
              <h3>
                {trend.unit === "day"
                  ? "Daily spending"
                  : trend.unit === "week"
                    ? "Weekly spending"
                    : "Monthly spending"}
              </h3>
            </div>
            {trendHasSpending && (
            <ul className="stats-legend" aria-label="Chart legend">
              <li>
                <span className="stats-swatch stats-swatch--spent" />
                {trendHasBudget ? "Within budget" : "Spent"}
              </li>
              {trendHasBudget && (
                <>
                  <li>
                    <span className="stats-swatch stats-swatch--caution" /> 80%+ of budget
                  </li>
                  <li>
                    <span className="stats-swatch stats-swatch--over" /> Over budget
                  </li>
                  <li>
                    <span className="stats-swatch stats-swatch--limit" /> Budget
                  </li>
                </>
              )}
            </ul>
            )}
          </div>
          {trendHasSpending ? (
            <>
              <SpendingTrendChart
                labels={trend.labels}
                values={trend.values}
                budgets={trend.budgets}
                unit={trend.unit}
              />
              {trendHasBudget && (
                <p className="stats-chart-caption">
                  Dashed line: your budget per {trend.unit}, spread evenly from{" "}
                  {budgetSource}
                  {mode === "month" ? "; shorter blocks get a smaller share" : ""}.
                </p>
              )}
            </>
          ) : (
            <p className="stats-empty stats-empty--chart">
              No spending recorded this {periodNoun}.
            </p>
          )}
        </section>

        {/* Latest expenses in the period */}
        <section className="stats-card stats-recent">
          <div className="stats-card-header">
            <div>
              <p className="stats-eyebrow">Activity</p>
              <h3>Latest expenses</h3>
            </div>
            <button
              type="button"
              className="stats-add-btn"
              onClick={() => setShowExpenseModal(true)}
            >
              <FaPlus aria-hidden="true" /> Add
            </button>
          </div>
          {recentExpenses.length === 0 ? (
            <p className="stats-empty">No expenses this {periodNoun}.</p>
          ) : (
            <ul className="stats-recent-list">
              {recentExpenses.map((exp) => (
                <li key={exp.id} className="stats-recent-item">
                  <div className="stats-recent-main">
                    <strong title={exp.description}>{exp.description || "Expense"}</strong>
                    <span>
                      {exp.category || "Uncategorized"} ·{" "}
                      {formatDayKey(storedDayKey(exp.date))}
                    </span>
                  </div>
                  <span className="stats-recent-amount">{formatCurrency(exp.amount)}</span>
                </li>
              ))}
            </ul>
          )}
          <Link href="/dashboard/expenses" className="stats-link">
            View all expenses
          </Link>
        </section>

        {/* AI forecast */}
        <section className="stats-card stats-forecast">
          <div className="stats-card-header">
            <div>
              <p className="stats-eyebrow">AI forecast</p>
              <h3>Forecast vs actual</h3>
            </div>
            {forecastGoal && (
              <span className="stats-badge" title="The forecast is based on this goal">
                {forecastGoal.goalName}
              </span>
            )}
          </div>
          {!forecastGoal ? (
            <div className="stats-empty stats-empty--chart stats-empty--compact">
              <p>Create a savings goal to get an AI spending forecast.</p>
              <Link href="/dashboard/goals" className="stats-link">
                Go to Goals
              </Link>
            </div>
          ) : forecastLoading ? (
            <div className="stats-empty stats-empty--chart" role="status">
              <div className="spinner" />
              <p>Loading forecast…</p>
            </div>
          ) : forecastError ? (
            <div className="stats-empty stats-empty--chart stats-empty--compact" role="alert">
              <p className="stats-error">The forecast service is unavailable right now.</p>
              <button
                type="button"
                className="stats-add-btn"
                onClick={() => setForecastAttempt((n) => n + 1)}
              >
                Try again
              </button>
            </div>
          ) : !forecastChart ? (
            <p className="stats-empty stats-empty--chart stats-empty--compact">
              {mode === "overall"
                ? "No forecast data is available yet."
                : `No forecast points fall in this ${periodNoun}.`}
            </p>
          ) : (
            <div className="stats-forecast-body">
              <div className="stats-forecast-chart">
                <Line
                  data={forecastChart.data}
                  options={{
                    maintainAspectRatio: false,
                    interaction: { mode: "index", intersect: false },
                    plugins: {
                      legend: {
                        display: true,
                        position: "top",
                        align: "end",
                        labels: {
                          color: chartTextColor,
                          boxWidth: 12,
                          boxHeight: 12,
                          font: { weight: 600 },
                        },
                      },
                      tooltip: {
                        callbacks: {
                          label: (ctx) =>
                            `${ctx.dataset.label}: ${formatCurrency(Number(ctx.raw))}`,
                        },
                      },
                    },
                    scales: {
                      x: {
                        grid: { display: false },
                        ticks: { color: chartTextColor, maxTicksLimit: 8 },
                      },
                      y: {
                        beginAtZero: true,
                        border: { display: false },
                        grid: { color: chartGridColor },
                        ticks: {
                          color: chartTextColor,
                          maxTicksLimit: 5,
                          callback: (v) => `₱${Number(v).toLocaleString("en-US")}`,
                        },
                      },
                    },
                  }}
                />
              </div>
              <p className="stats-forecast-summary">
                To stay on track, keep daily spending under{" "}
                <strong>{formatCurrency(forecastChart.avg)}</strong>.
              </p>
            </div>
          )}
        </section>
      </div>

      <AddExpenseModal
        open={showExpenseModal}
        onClose={() => setShowExpenseModal(false)}
        userId={user.uid}
        categories={categories}
        goalId={forecastGoal?.id ?? null}
        onSaved={() => void refreshWallet()}
      />
    </div>
  );
};

export default Statistics;
