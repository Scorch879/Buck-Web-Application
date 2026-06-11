"use client";
import React, { useState, useEffect, useRef } from "react";
import "./style.css";
import { useRouter } from "next/navigation";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useDashboardUser } from "@/context/DashboardUserContext";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import WeeklySpendingChart from "./weekly-spending";
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
import ExcessPie from "./excess-pie";
import SpendingBar from "./spending-bar";
import { statisticsTestData } from "./testData";
import {
  mergeDashboardDataCache,
  useFinancial,
} from "@/context/FinancialContext";
import { Line } from "react-chartjs-2";
import { formatCurrency } from "@/utils/formatters";
import {
  addCategory,
  addExpenseWithWalletDeduction,
  deleteCategory,
  deleteExpenseAndRestoreWallet,
  ensureDefaultCategories,
  getActiveWallet,
  listExpenses,
  listGoals,
  subscribeUserTable,
  updateCategoryName,
  type BuckCategory,
  type BuckExpense,
  type BuckGoal,
} from "@/utils/supabaseData";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

type Goal = BuckGoal;

const Statistics = () => {
  const router = useRouter();
  const { user } = useDashboardUser();
  const { setTotalSaved, dashboardCache, setDashboardCache } = useFinancial();
  const userCache = dashboardCache.userId === user.uid ? dashboardCache : {};
  const hasInitialStatisticsData = Boolean(
    userCache.categories &&
      userCache.expenses &&
      userCache.activeWalletBudget !== undefined
  );
  const hasInitialGoalsData = Boolean(userCache.goals);
  const isDarkTheme = useAuthPageTheme();
  const chartTextColor = isDarkTheme ? "#fff8ed" : "#2b2523";
  const chartGridColor = isDarkTheme
    ? "rgba(255,211,154,0.16)"
    : "rgba(120,92,70,0.18)";
  const primaryButtonBackground = isDarkTheme
    ? "linear-gradient(135deg, #ffc547, #f47536)"
    : "linear-gradient(135deg, #f47536, #ff3838)";
  const primaryButtonColor = isDarkTheme ? "#241409" : "#fffaf4";
  const modalBackground = "var(--buck-surface)";
  const softBackground = isDarkTheme
    ? "rgba(255,197,71,0.10)"
    : "rgba(255,240,200,0.52)";
  const fieldBackground = isDarkTheme
    ? "rgba(255,197,71,0.08)"
    : "rgba(255,250,244,0.74)";
  const [yMax, setYMax] = useState(1000);
  const [goals, setGoals] = useState<Goal[]>(() => userCache.goals ?? []);
  const [loadingGoals, setLoadingGoals] = useState(
    () => !hasInitialGoalsData
  );
  const [loadingStatisticsData, setLoadingStatisticsData] = useState(
    () => !hasInitialStatisticsData
  );
  const [selectedMode, setSelectedMode] = useState<
    "week" | "month" | "overall"
  >("week");
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState("");
  const [forecastData, setForecastData] = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState("");
  const [showWeeklyGraph, setShowWeeklyGraph] = useState(
    selectedMode === "week"
  );
  const [fadeWeeklyGraph, setFadeWeeklyGraph] = useState(false);
  const prevMode = useRef(selectedMode);

  // --- New state for categories, expenses, wallet ---
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

  // --- Add Expense Modal logic ---
  const [categorySearch, setCategorySearch] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [addingCategory, setAddingCategory] = useState(false);

  // --- AI category suggestion ---
  async function getSuggestedCategory(
    description: string
  ): Promise<string | null> {
    try {
      const response = await fetch(
        "https://buck-web-application-1.onrender.com/ai/categorize_goal/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ goal_name: description }),
        }
      );
      const data = await response.json();
      return data.category || null;
    } catch {
      return null;
    }
  }

  // --- Add/Edit/Remove Category Logic ---
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(
    null
  );
  const [editCategoryName, setEditCategoryName] = useState("");
  const handleEditCategory = async (catId: string, newName: string) => {
    if (!user || !newName.trim()) return;
    await updateCategoryName(user.uid, catId, newName);
    setEditingCategoryId(null);
    setEditCategoryName("");
  };
  const handleRemoveCategory = async (catId: string) => {
    if (!user) return;
    if (!window.confirm("Are you sure you want to delete this category?"))
      return;
    await deleteCategory(user.uid, catId);
  };

  const handleAddCategory = async () => {
    if (!user || !newCategory.trim()) return;
    await addCategory(user.uid, newCategory);
    setNewCategory("");
    setAddingCategory(false);
  };

  const handleAddExpenseV2 = async () => {
    if (
      !user ||
      !selectedGoal ||
      !expenseDate ||
      !expenseAmount ||
      !expenseDesc
    )
      return;
    setExpenseLoading(true);
    setExpenseError("");
    try {
      const aiCategory = await getSuggestedCategory(expenseDesc);
      await addExpenseWithWalletDeduction(user.uid, {
        date: expenseDate,
        amount: parseFloat(expenseAmount),
        description: expenseDesc,
        categoryName: selectedCategory || aiCategory || "Uncategorized",
        goalId: selectedGoal.id,
      });
      const activeWallet = await getActiveWallet(user.uid);
      const nextWalletBudget = activeWallet?.budget ?? 0;
      setWallet(nextWalletBudget);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          activeWalletBudget: nextWalletBudget,
        })
      );
      setShowExpenseModal(false);
      setExpenseDate("");
      setExpenseAmount("");
      setExpenseDesc("");
    } catch (err: any) {
      setExpenseError(err.message || "Unknown error");
    } finally {
      setExpenseLoading(false);
    }
  };

  const handleRemoveExpense = async (expenseId: string, amount: number) => {
    if (!user) return;
    try {
      await deleteExpenseAndRestoreWallet(user.uid, expenseId, amount);
      const activeWallet = await getActiveWallet(user.uid);
      const nextWalletBudget = activeWallet?.budget ?? 0;
      setWallet(nextWalletBudget);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          activeWalletBudget: nextWalletBudget,
        })
      );
    } catch (err) {
      // Optionally handle error
    }
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
  }, [setDashboardCache, user.uid]);

  // Dynamically generate week date ranges from goals (real calendar mapping)
  let weekDateRanges: { start: string; end: string }[] = [];
  let monthDateRanges: { start: string; end: string; label: string }[] = [];
  if (goals.length > 0) {
    // Find the earliest Monday on or before the earliest goal start
    const minStartRaw = new Date(
      Math.min(...goals.map((g) => new Date(g.createdAt).getTime()))
    );
    const minStart = new Date(minStartRaw);
    minStart.setDate(minStart.getDate() - ((minStart.getDay() + 6) % 7)); // Monday
    const maxEnd = new Date(
      Math.max(
        ...goals.map((g) => new Date(g.targetDate || g.createdAt).getTime())
      )
    );
    // Weeks (Monday to Sunday)
    let current = new Date(minStart);
    while (current <= maxEnd) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekDateRanges.push({
        start: weekStart.toISOString().slice(0, 10),
        end: weekEnd.toISOString().slice(0, 10),
      });
      current.setDate(current.getDate() + 7);
    }
    // Months (calendar months)
    let monthCursor = new Date(minStart.getFullYear(), minStart.getMonth(), 1);
    while (monthCursor <= maxEnd) {
      const monthStart = new Date(monthCursor);
      const monthEnd = new Date(
        monthCursor.getFullYear(),
        monthCursor.getMonth() + 1,
        0
      );
      monthDateRanges.push({
        start: monthStart.toISOString().slice(0, 10),
        end: monthEnd.toISOString().slice(0, 10),
        label: monthStart.toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
      });
      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }
  }
  // Find current week index
  let currentWeekIdx = -1;
  if (weekDateRanges.length > 0) {
    const today = new Date();
    currentWeekIdx = weekDateRanges.findIndex((range) => {
      const start = new Date(range.start);
      const end = new Date(range.end);
      return today >= start && today <= end;
    });
  }

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

  // Calculate totalSaved for the user (use your real calculation here)
  let totalSaved = 0;
  // For demo: sum all savings for the selected mode
  if (selectedMode === "week" && weekDateRanges.length > 0) {
    const idx = selectedWeek;
    const weekData =
      statisticsTestData.weeklyCategorySpending[idx] ||
      Array(statisticsTestData.categories.length).fill(0);
    totalSaved = weekData.reduce(
      (sum, amt) => sum + (statisticsTestData.maxBudgetPerDay - amt),
      0
    );
  } else if (selectedMode === "month" && monthDateRanges.length > 0) {
    const idx = selectedMonth;
    let days = Array(7).fill(0);
    for (
      let w = idx * 4;
      w < (idx + 1) * 4 && w < statisticsTestData.weeklyCategorySpending.length;
      w++
    ) {
      for (let d = 0; d < 7; d++) {
        days[d] += statisticsTestData.weeklyCategorySpending[w][d];
      }
    }
    totalSaved = days.reduce(
      (sum, amt) => sum + (statisticsTestData.maxBudgetPerDay - amt),
      0
    );
  } else if (selectedMode === "overall") {
    let days = Array(7).fill(0);
    for (let w = 0; w < statisticsTestData.weeklyCategorySpending.length; w++) {
      for (let d = 0; d < 7; d++) {
        days[d] += statisticsTestData.weeklyCategorySpending[w][d];
      }
    }
    totalSaved = days.reduce(
      (sum, amt) => sum + (statisticsTestData.maxBudgetPerDay - amt),
      0
    );
  }

  useEffect(() => {
    setTotalSaved(totalSaved);
  }, [totalSaved, setTotalSaved]);

  // Assume the first goal is selected for demo (replace with real selection logic)
  const selectedGoal = goals[0];

  // Fetch forecast/actual data (fix: depend on selectedGoal)
  useEffect(() => {
    if (!user || !selectedGoal) return;

    setForecastLoading(true);
    setForecastError("");
    setForecastData(null); // Clear previous data to force spinner

    const fetchForecast = async () => {
      try {
        const goalPayload = {
          id: selectedGoal.id,
          userId: user.uid,
          targetAmount: selectedGoal.targetAmount,
          targetDate: selectedGoal.targetDate,
          attitude: selectedGoal.attitude || "Normal",
        };
        const res = await fetch(
          "https://buck-web-application-1.onrender.com/ai/forecast/",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              goal: goalPayload,
              budget: 0,
            }),
          }
        );
        if (!res.ok) throw new Error("Failed to fetch forecast");
        const data = await res.json();
        setForecastData(data);
      } catch (err) {
        setForecastError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setForecastLoading(false);
      }
    };

    fetchForecast();
  }, [user, selectedGoal]);

  // --- Forecast Description ---
  const forecastSummary = (() => {
    if (!forecastData || !forecastData.forecast_per_day) return null;
    const vals = Object.values(forecastData.forecast_per_day).map(Number);
    if (!vals.length) return null;
    const total = vals.reduce((a, b) => Number(a) + Number(b), 0);
    const avg = total / vals.length;
    return `To reach your goal, you should save at least ${formatCurrency(
      avg
    )} per day and keep your daily spending below this amount.`;
  })();

  // --- Dynamic SpendingBar data ---
  const dynamicCategoryList = categories.length
    ? categories.map((cat) => cat.name)
    : statisticsTestData.categories;
  const dynamicBarData = (() => {
    // Build amounts array for each category from expenses
    const catMap: Record<string, number> = {};
    dynamicCategoryList.forEach((cat) => {
      catMap[cat] = 0;
    });
    expenses.forEach((exp) => {
      if (catMap[exp.category] !== undefined)
        catMap[exp.category] += exp.amount;
    });
    return dynamicCategoryList.map((cat) => catMap[cat] || 0);
  })();

  // --- Forecast Chart Data ---
  let chartData = null;
  if (forecastData && forecastData.forecast_per_day) {
    let labels = Object.keys(forecastData.forecast_per_day);
    // Filter labels based on selectedMode
    if (selectedMode === "week" && weekDateRanges[selectedWeek]) {
      const { start, end } = weekDateRanges[selectedWeek];
      labels = labels.filter((date) => date >= start && date <= end);
    } else if (selectedMode === "month" && monthDateRanges[selectedMonth]) {
      const { start, end } = monthDateRanges[selectedMonth];
      labels = labels.filter((date) => date >= start && date <= end);
    }
    const forecastVals = labels.map((d) => forecastData.forecast_per_day[d]);
    const actualVals = labels.map(
      (d) =>
        (forecastData.actual_per_day && forecastData.actual_per_day[d]) || 0
    );
    chartData = {
      labels,
      datasets: [
        {
          label: "Forecasted Daily Expense",
          data: forecastVals,
          borderColor: "rgba(244,117,54,1)",
          backgroundColor: "rgba(244,117,54,0.18)",
          fill: true,
          tension: 0.3,
        },
        {
          label: "Actual Daily Expense",
          data: actualVals,
          borderColor: "rgba(255,197,71,1)",
          backgroundColor: "rgba(255,197,71,0.18)",
          fill: true,
          tension: 0.3,
        },
      ],
    };
  }

  useEffect(() => {
    if (selectedMode === "week") {
      setShowWeeklyGraph(true);
      setFadeWeeklyGraph(false);
    } else if (prevMode.current === "week") {
      setFadeWeeklyGraph(true);
      setTimeout(() => {
        setShowWeeklyGraph(false);
        setFadeWeeklyGraph(false);
      }, 400); // match CSS transition
    }
    prevMode.current = selectedMode;
  }, [selectedMode]);

  // --- Weekly Spending Data for Chart ---
  const getWeeklySpendingData = () => {
    // Returns array of 7 numbers (Mon-Sun) for the selected week, using real expenses only
    if (!expenses.length || !weekDateRanges[selectedWeek]) {
      return Array(7).fill(0);
    }
    const { start, end } = weekDateRanges[selectedWeek];
    // Build array for each day of week (Mon=0, ..., Sun=6)
    const weekSpending = Array(7).fill(0);
    expenses.forEach((exp) => {
      const expDate = new Date(exp.date);
      const expISO = expDate.toISOString().slice(0, 10);
      if (expISO >= start && expISO <= end) {
        // Get day of week (Mon=0, ..., Sun=6)
        let dayIdx = expDate.getDay();
        dayIdx = dayIdx === 0 ? 6 : dayIdx - 1; // Sunday=6, Monday=0
        weekSpending[dayIdx] += Number(exp.amount) || 0;
      }
    });
    return weekSpending;
  };

  // --- Max Budget Per Day (from AI forecast) ---
  const [maxBudgetPerDay, setMaxBudgetPerDay] = useState<number>(1000);

  // Set maxBudgetPerDay from AI forecast
  useEffect(() => {
    if (forecastData && forecastData.forecast_per_day) {
      const vals = Object.values(forecastData.forecast_per_day).map(Number);
      if (vals.length > 0) {
        const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
        setMaxBudgetPerDay(avg);
      }
    }
  }, [forecastData]);

  if (loadingGoals || loadingStatisticsData) {
    return <DashboardPageSkeleton variant="statistics" />;
  }

  return (
    <>
      <div
        className="dashboard-container"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        {/* Info Card and Selectors */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            marginTop: "2.5rem",
            marginBottom: "1.5rem",
            width: "100%",
            maxWidth: 900,
          }}
        >
          {/* Info Card */}
          <div
            style={{
              width: "100%",
              maxWidth: 900,
              display: "flex",
              justifyContent: "center",
            }}
          >
            {selectedMode === "week" && weekDateRanges.length > 0 && (
              <div
                style={{
                  background:
                    currentWeekIdx === selectedWeek ? softBackground : modalBackground,
                  borderRadius: "16px",
                  boxShadow: "0 4px 24px 0 rgba(239, 138, 87, 0.10)",
                  padding: "1.2rem 2rem",
                  marginBottom: "0.7rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1.5rem",
                  fontSize: "1.15rem",
                  fontWeight: 600,
                  color: "var(--buck-ink)",
                  border:
                    currentWeekIdx === selectedWeek
                      ? "1px solid rgba(244,117,54,0.38)"
                      : "none",
                  width: "100%",
                  maxWidth: 900,
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    color: "var(--buck-orange)",
                    fontWeight: 700,
                    fontSize: "1.25rem",
                  }}
                >
                  Week {selectedWeek + 1}
                </span>
                <span
                  style={{
                    color: "var(--buck-muted)",
                    fontWeight: 500,
                    fontSize: "1.05rem",
                  }}
                >
                  {weekDateRanges[selectedWeek]?.start} to{" "}
                  {weekDateRanges[selectedWeek]?.end}
                </span>
                {currentWeekIdx === selectedWeek && (
                  <span
                    style={{
                      color: primaryButtonColor,
                      background: primaryButtonBackground,
                      borderRadius: "8px",
                      padding: "0.2rem 0.7rem",
                      marginLeft: "1rem",
                      fontWeight: 700,
                      fontSize: "1rem",
                    }}
                  >
                    Current
                  </span>
                )}
              </div>
            )}
            {selectedMode === "month" && monthDateRanges.length > 0 && (
              <div
                style={{
                  background: modalBackground,
                  borderRadius: "16px",
                  boxShadow: "0 4px 24px 0 rgba(239, 138, 87, 0.10)",
                  padding: "1.2rem 2rem",
                  marginBottom: "0.7rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1.5rem",
                  fontSize: "1.15rem",
                  fontWeight: 600,
                  color: "var(--buck-ink)",
                  width: "100%",
                  maxWidth: 900,
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    color: "var(--buck-orange)",
                    fontWeight: 700,
                    fontSize: "1.25rem",
                  }}
                >
                  {monthDateRanges[selectedMonth]?.label}
                </span>
                <span
                  style={{
                    color: "var(--buck-muted)",
                    fontWeight: 500,
                    fontSize: "1.05rem",
                  }}
                >
                  {monthDateRanges[selectedMonth]?.start} to{" "}
                  {monthDateRanges[selectedMonth]?.end}
                </span>
              </div>
            )}
            {selectedMode === "overall" && (
              <div
                style={{
                  background: modalBackground,
                  borderRadius: "16px",
                  boxShadow: "0 4px 24px 0 rgba(239, 138, 87, 0.10)",
                  padding: "1.2rem 2rem",
                  marginBottom: "0.7rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "1.5rem",
                  fontSize: "1.15rem",
                  fontWeight: 600,
                  color: "var(--buck-ink)",
                  justifyContent: "center",
                  width: "100%",
                  maxWidth: 900,
                }}
              >
                <span
                  style={{
                    color: "var(--buck-orange)",
                    fontWeight: 700,
                    fontSize: "1.25rem",
                  }}
                >
                  Overall
                </span>
                <span
                  style={{
                    color: "var(--buck-muted)",
                    fontWeight: 500,
                    fontSize: "1.05rem",
                  }}
                >
                  {goals.length > 0
                    ? `${weekDateRanges[0]?.start} to ${
                        weekDateRanges[weekDateRanges.length - 1]?.end
                      }`
                    : "No data"}
                </span>
              </div>
            )}
          </div>
          {/* Selectors Row */}
          <div
            style={{
              display: "flex",
              flexDirection: "row",
              alignItems: "center",
              gap: "1.5rem",
              width: "100%",
              maxWidth: 900,
              justifyContent: "center",
            }}
          >
            {/* View Mode Selector */}
            <div style={{ textAlign: "center" }}>
              <label
                style={{ fontWeight: 600, marginRight: 8, color: "var(--buck-ink)" }}
              >
                View Mode:
              </label>
              <select
                value={selectedMode}
                onChange={(e) =>
                  setSelectedMode(
                    e.target.value as "week" | "month" | "overall"
                  )
                }
                style={{
                  padding: "0.5rem 1.2rem",
                  borderRadius: "10px",
                  border: "1px solid rgba(244,117,54,0.38)",
                  background: softBackground,
                  color: "var(--buck-orange)",
                  fontWeight: 600,
                  fontSize: "1rem",
                  boxShadow: "0 2px 8px 0 rgba(239, 138, 87, 0.08)",
                  outline: "none",
                  cursor: "pointer",
                  transition: "border 0.2s",
                }}
              >
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="overall">Overall</option>
              </select>
            </div>
            {/* Week/Month Selector */}
            {selectedMode === "week" && weekDateRanges.length > 0 && (
              <div style={{ textAlign: "center" }}>
                <label
                  style={{ fontWeight: 600, marginRight: 8, color: "var(--buck-ink)" }}
                >
                  Select Week:
                </label>
                <select
                  value={selectedWeek}
                  onChange={(e) => setSelectedWeek(Number(e.target.value))}
                  style={{
                    padding: "0.5rem 1.2rem",
                    borderRadius: "10px",
                    border: "1px solid rgba(244,117,54,0.38)",
                    background: softBackground,
                    color: "var(--buck-orange)",
                    fontWeight: 600,
                    fontSize: "1rem",
                    boxShadow: "0 2px 8px 0 rgba(239, 138, 87, 0.08)",
                    outline: "none",
                    cursor: "pointer",
                    transition: "border 0.2s",
                  }}
                  disabled={weekDateRanges.length === 0}
                >
                  {weekDateRanges.map((range, idx) => (
                    <option key={idx} value={idx} style={{ color: "var(--buck-ink)" }}>
                      Week {idx + 1}: {range.start} to {range.end}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {selectedMode === "month" && monthDateRanges.length > 0 && (
              <div style={{ textAlign: "center" }}>
                <label
                  style={{ fontWeight: 600, marginRight: 8, color: "var(--buck-ink)" }}
                >
                  Select Month:
                </label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  style={{
                    padding: "0.5rem 1.2rem",
                    borderRadius: "10px",
                    border: "1px solid rgba(244,117,54,0.38)",
                    background: softBackground,
                    color: "var(--buck-orange)",
                    fontWeight: 600,
                    fontSize: "1rem",
                    boxShadow: "0 2px 8px 0 rgba(239, 138, 87, 0.08)",
                    outline: "none",
                    cursor: "pointer",
                    transition: "border 0.2s",
                  }}
                  disabled={monthDateRanges.length === 0}
                >
                  {monthDateRanges.map((range, idx) => (
                    <option key={idx} value={idx} style={{ color: "var(--buck-ink)" }}>
                      {range.label}: {range.start} to {range.end}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
        {/* Panels Container */}
        <div
          className="statistics-panels-container"
          style={{ width: "100%", maxWidth: 900, margin: "0 auto" }}
        >
          {goals.length === 0 ? (
            <div className="empty-goals-popup">
              <h2
                style={{
                  fontSize: "2rem",
                  fontWeight: 700,
                  color: "var(--buck-ink)",
                  marginBottom: "2rem",
                }}
              >
                What the Buck?!
                <br />
                You dont have any goals yet.
                <br />
                Would you like to create one?
              </h2>
              <button
                className="create-goal-button"
                onClick={() => router.push("/dashboard/goals/create")}
              >
                Create Goal
              </button>
            </div>
          ) : (
            <>
              {/* First row: Pie chart and Bar graph */}
              <div
                style={{
                  display: "flex",
                  flexDirection: "row",
                  justifyContent: "flex-start",
                  alignItems: "stretch",
                  margin: "2.5rem auto",
                  width: "100%",
                  maxWidth: 900,
                  boxSizing: "border-box",
                  background: "transparent",
                  gap: "2%",
                }}
              >
                <div
                  style={{
                    width: "36%",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 340,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <ExcessPie
                      mode={selectedMode}
                      weekIndex={selectedWeek}
                      monthIndex={selectedMonth}
                    />
                  </div>
                </div>
                <div
                  style={{
                    width: "62%",
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    height: 340,
                  }}
                >
                  <div
                    style={{
                      width: "100%",
                      height: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <SpendingBar
                      mode={selectedMode}
                      weekIndex={selectedWeek}
                      monthIndex={selectedMonth}
                      categories={dynamicCategoryList}
                      amounts={dynamicBarData}
                    />
                  </div>
                </div>
              </div>
              {/* Second row: Line graph (Weekly Spending Report) */}
              {showWeeklyGraph && (
                <div className="graph-row">
                  <div className="graph-panel weekly-graph-panel">
                    <div className="graph-panel-header">
                      Weekly Spending Report
                    </div>
                    {/* Y-Axis Max Control */}
                    <div style={{ marginBottom: "1rem", textAlign: "right" }}>
                      <label style={{ fontWeight: 500, marginRight: 8 }}>
                        Y Max:
                        <input
                          type="number"
                          value={yMax}
                          min={1}
                          step={1}
                          onChange={(e) =>
                            setYMax(Math.max(1, Number(e.target.value)))
                          }
                          style={{
                            marginLeft: 8,
                            width: 60,
                            padding: "0.2rem 0.5rem",
                            borderRadius: 6,
                            border: "1px solid rgba(244,117,54,0.32)",
                            fontSize: "1rem",
                          }}
                        />
                      </label>
                    </div>
                    <WeeklySpendingChart
                      mode={selectedMode}
                      weekIndex={selectedWeek}
                      monthIndex={selectedMonth}
                      spendingData={getWeeklySpendingData()}
                      maxBudgetPerDay={maxBudgetPerDay}
                      noData={
                        getWeeklySpendingData().every((v) => v === 0) &&
                        !expenses.some((exp) => {
                          const expDate = new Date(exp.date);
                          const expISO = expDate.toISOString().slice(0, 10);
                          const { start, end } = weekDateRanges[selectedWeek] || {};
                          return start && end && expISO >= start && expISO <= end;
                        })
                      }
                    />
                    {/* Custom Legend (now inside the panel) */}
                    <div className="graph-legend">
                      <div className="graph-legend-item">
                        <span className="graph-legend-color-saved"></span>
                        <span className="graph-legend-label">Saved</span>
                      </div>
                      <div className="graph-legend-item">
                        <span className="graph-legend-color-excess"></span>
                        <span className="graph-legend-label">Excess</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {/* Forecast/Actual Graph (AI) - use same container and width as weekly graph */}
              <div className="graph-row">
                <div
                  className="graph-panel weekly-graph-panel"
                  style={{ position: "relative", minHeight: 300 }}
                >
                  {forecastLoading ? (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "100%",
                        width: "100%",
                        position: "absolute",
                        top: 0,
                        left: 0,
                      }}
                    >
                      <div className="spinner"></div>
                      <div
                        style={{
                          fontSize: "1.1rem",
                          color: "var(--buck-orange)",
                          fontWeight: 600,
                          marginTop: 12,
                          textAlign: "center",
                        }}
                      >
                        Loading graph...
                      </div>
                    </div>
                  ) : (
                    <>
                      <div
                        className="graph-panel-header"
                        style={{
                          color: "var(--buck-orange)",
                          fontWeight: 700,
                          fontSize: "1.2rem",
                          marginBottom: 8,
                          textAlign: "center",
                        }}
                      >
                        Forecast vs Actual (AI)
                      </div>
                      {forecastError && (
                        <div style={{ color: "red" }}>{forecastError}</div>
                      )}
                      {chartData && (
                        <Line
                          data={chartData}
                          options={{
                            responsive: true,
                            plugins: {
                              legend: { display: true, position: "top" },
                              tooltip: {
                                callbacks: {
                                  label: function (context) {
                                    const value = Number(context.raw);
                                    return `${context.dataset.label}: ${formatCurrency(value)}`;
                                  },
                                },
                              },
                            },
                            scales: {
                              x: {
                                grid: { display: false },
                                ticks: {
                                  color: chartTextColor,
                                  font: { weight: 600 },
                                },
                              },
                              y: {
                                grid: { color: chartGridColor },
                                beginAtZero: true,
                                ticks: { color: chartTextColor },
                              },
                            },
                          }}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
        {/* Add Expense Button and Modal */}
        {showExpenseModal && (
          <div
            className="modal-backdrop"
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(0,0,0,0.4)",
              zIndex: 1000,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              transition: "background 0.3s",
            }}
          >
            <div
              className="modal expense-modal-animate"
              style={{
                background: modalBackground,
                borderRadius: 20,
                padding: 32,
                width: "100%",
                maxWidth: 540,
                minWidth: 320,
                boxShadow: "0 12px 48px rgba(239,138,87,0.18)",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                animation: "fadeInScale 0.35s",
                color: "var(--buck-ink)",
                fontSize: 17,
                maxHeight: "90vh",
                overflowY: "auto",
              }}
            >
              <button
                onClick={() => setShowExpenseModal(false)}
                style={{
                  position: "absolute",
                  top: 18,
                  right: 22,
                  background: "none",
                  border: "none",
                  fontSize: 26,
                  cursor: "pointer",
                  color: "var(--buck-orange)",
                  fontWeight: 700,
                  transition: "color 0.2s",
                }}
              >
                &times;
              </button>
              <h3
                style={{
                  marginTop: 0,
                  marginBottom: 18,
                  color: "var(--buck-orange)",
                  fontWeight: 800,
                  fontSize: 30,
                  letterSpacing: 1,
                }}
              >
                Add Expense
              </h3>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                style={{
                  width: "100%",
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 7,
                  border: "1px solid rgba(244,117,54,0.32)",
                  fontSize: 17,
                  boxSizing: "border-box",
                  display: "block",
                  color: "var(--buck-ink)",
                  background: fieldBackground,
                  transition: "border 0.2s",
                }}
              />
              <input
                type="number"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
                placeholder="Amount"
                style={{
                  width: "100%",
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 7,
                  border: "1px solid rgba(244,117,54,0.32)",
                  fontSize: 17,
                  boxSizing: "border-box",
                  display: "block",
                  color: "var(--buck-ink)",
                  background: fieldBackground,
                  transition: "border 0.2s",
                }}
              />
              <input
                type="text"
                value={expenseDesc}
                onChange={(e) => setExpenseDesc(e.target.value)}
                placeholder="Description"
                style={{
                  width: "100%",
                  marginBottom: 12,
                  padding: 12,
                  borderRadius: 7,
                  border: "1px solid rgba(244,117,54,0.32)",
                  fontSize: 17,
                  boxSizing: "border-box",
                  display: "block",
                  color: "var(--buck-ink)",
                  background: fieldBackground,
                  transition: "border 0.2s",
                }}
              />
              {/* Category Search Bar (moved above Manage Categories) */}
              <div style={{ width: "100%", margin: "0 0 10px 0" }}>
                <input
                  type="text"
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Search categories..."
                  style={{
                    width: "100%",
                    marginBottom: 8,
                    padding: 10,
                    borderRadius: 6,
                    border: "1px solid rgba(244,117,54,0.38)",
                    fontSize: 16,
                    color: "var(--buck-ink)",
                    background: softBackground,
                    boxSizing: "border-box",
                    display: "block",
                    transition: "border 0.2s",
                  }}
                />
                <div
                  style={{
                    fontWeight: 600,
                    color: "var(--buck-orange)",
                    marginBottom: 4,
                    fontSize: 16,
                  }}
                >
                  Manage Categories:
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    maxHeight: 120,
                    overflowY: "auto",
                    marginBottom: 8,
                  }}
                >
                  {categories
                    .filter((cat) =>
                      cat.name
                        .toLowerCase()
                        .includes(categorySearch.toLowerCase())
                    )
                    .map((cat) => (
                      <div
                        key={cat.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                        }}
                      >
                        {editingCategoryId === cat.id ? (
                          <>
                            <input
                              value={editCategoryName}
                              onChange={(e) =>
                                setEditCategoryName(e.target.value)
                              }
                              style={{
                                flex: 1,
                                padding: 7,
                                borderRadius: 5,
                                border: "1px solid rgba(244,117,54,0.32)",
                                fontSize: 16,
                                color: "var(--buck-ink)",
                                background: fieldBackground,
                              }}
                            />
                            <button
                              onClick={() =>
                                handleEditCategory(cat.id, editCategoryName)
                              }
                              style={{
                                background: primaryButtonBackground,
                                color: primaryButtonColor,
                                border: "none",
                                borderRadius: 5,
                                padding: "0.3rem 0.8rem",
                                fontWeight: 700,
                                fontSize: 15,
                                marginLeft: 4,
                                cursor: "pointer",
                                transition: "background 0.2s",
                              }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => {
                                setEditingCategoryId(null);
                                setEditCategoryName("");
                              }}
                              style={{
                                background: "none",
                                color: "var(--buck-orange)",
                                border: "none",
                                fontWeight: 700,
                                fontSize: 15,
                                marginLeft: 2,
                                cursor: "pointer",
                              }}
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <>
                            <span style={{ flex: 1 }}>{cat.name}</span>
                            <button
                              onClick={() => {
                                setEditingCategoryId(cat.id);
                                setEditCategoryName(cat.name);
                              }}
                              style={{
                                background: "none",
                                color: "var(--buck-orange)",
                                border: "none",
                                fontWeight: 700,
                                fontSize: 15,
                                marginLeft: 2,
                                cursor: "pointer",
                                transition: "color 0.2s",
                              }}
                            >
                              Edit
                            </button>
                            <button
                              onClick={() => handleRemoveCategory(cat.id)}
                              style={{
                                background: "none",
                                color: "var(--buck-coral)",
                                border: "none",
                                fontWeight: 700,
                                fontSize: 15,
                                marginLeft: 2,
                                cursor: "pointer",
                                transition: "color 0.2s",
                              }}
                            >
                              Remove
                            </button>
                          </>
                        )}
                      </div>
                    ))}
                </div>
              </div>
              <div style={{ marginBottom: 12, width: "100%" }}>
                <label
                  style={{
                    fontWeight: 700,
                    color: "var(--buck-orange)",
                    display: "block",
                    marginBottom: 4,
                  }}
                >
                  Category:
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  style={{
                    width: "100%",
                    padding: 12,
                    borderRadius: 7,
                    border: "1px solid rgba(244,117,54,0.32)",
                    fontSize: 17,
                    boxSizing: "border-box",
                    display: "block",
                    color: "var(--buck-ink)",
                    background: modalBackground,
                    transition: "border 0.2s",
                  }}
                >
                  <option value="">Select category</option>
                  {categories
                    .filter((cat) =>
                      cat.name
                        .toLowerCase()
                        .includes(categorySearch.toLowerCase())
                    )
                    .map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() => setAddingCategory(true)}
                  style={{
                    marginTop: 10,
                    background: "none",
                    color: "var(--buck-orange)",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 700,
                    fontSize: 16,
                    transition: "color 0.2s",
                  }}
                >
                  + Add Category
                </button>
              </div>
              {addingCategory && (
                <div
                  style={{
                    marginBottom: 14,
                    width: "100%",
                    animation: "fadeIn 0.2s",
                  }}
                >
                  <input
                    type="text"
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    placeholder="New category name"
                    style={{
                      width: "100%",
                      padding: 10,
                      borderRadius: 6,
                      border: "1px solid rgba(244,117,54,0.32)",
                      fontSize: 16,
                      color: "var(--buck-ink)",
                      background: fieldBackground,
                      boxSizing: "border-box",
                      display: "block",
                      transition: "border 0.2s",
                    }}
                  />
                  <button
                    onClick={handleAddCategory}
                    style={{
                      marginTop: 10,
                      background: primaryButtonBackground,
                      color: primaryButtonColor,
                      border: "none",
                      borderRadius: 6,
                      padding: "0.6rem 1.3rem",
                      fontWeight: 700,
                      fontSize: 16,
                      cursor: "pointer",
                      transition: "background 0.2s",
                    }}
                  >
                    Add
                  </button>
                </div>
              )}
              {expenseError && (
                <div style={{ color: "red", marginBottom: 12 }}>
                  {expenseError}
                </div>
              )}
              <button
                onClick={handleAddExpenseV2}
                disabled={expenseLoading}
                style={{
                  background: primaryButtonBackground,
                  color: primaryButtonColor,
                  border: "none",
                  borderRadius: 9,
                  padding: "1.1rem 1.7rem",
                  fontWeight: 800,
                  fontSize: 20,
                  cursor: "pointer",
                  width: "100%",
                  marginTop: 10,
                  boxShadow: "0 2px 8px rgba(239,138,87,0.08)",
                  transition: "background 0.2s",
                }}
              >
                {expenseLoading ? "Adding..." : "Add Expense"}
              </button>
            </div>
            <style>{`
              @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
              @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            `}</style>
          </div>
        )}
        {/* Recent Expenses Card */}
        {goals.length > 0 && (
          <div style={{ width: "100%", maxWidth: 900, margin: "2rem auto" }}>
            <div
              style={{
                background: modalBackground,
                borderRadius: 16,
                boxShadow: "0 4px 24px 0 rgba(239,138,87,0.10)",
                padding: "2rem 2.5rem",
                minHeight: 120,
                transition: "box-shadow 0.2s",
                position: "relative",
                display: "flex",
                flexDirection: "column",
                gap: 24,
              }}
            >
              {/* Add Expense Button inside card */}
              <button
                onClick={() => setShowExpenseModal(true)}
                style={{
                  background: primaryButtonBackground,
                  color: primaryButtonColor,
                  border: "none",
                  borderRadius: 8,
                  padding: "0.7rem 1.5rem",
                  fontWeight: 600,
                  fontSize: 16,
                  cursor: "pointer",
                  marginBottom: 0,
                  alignSelf: "flex-end",
                  marginTop: -10,
                  marginRight: -10,
                  boxShadow: "0 2px 8px rgba(239,138,87,0.08)",
                  transition: "background 0.2s",
                }}
              >
                + Add Expense
              </button>
              {/* Forecast Description inside card */}
              {forecastSummary && (
                <div
                  style={{
                    width: "100%",
                    background: softBackground,
                    borderRadius: 8,
                    padding: "1rem 2rem",
                    color: "var(--buck-orange)",
                    fontWeight: 600,
                    textAlign: "center",
                    marginLeft:"-4%",
                    fontSize: "1.1rem",
                    marginBottom: 0,
                  }}
                >
                  {forecastSummary}
                </div>
              )}
              <h3
                style={{
                  color: "var(--buck-ink)",
                  fontWeight: 800,
                  fontSize: "1.3rem",
                  marginBottom: 18,
                  letterSpacing: 0.5,
                }}
              >
                Recent Expenses
              </h3>
              <div
                style={{ display: "flex", flexDirection: "column", gap: 16 }}
              >
                {expenses
                  .slice()
                  .reverse()
                  .slice(0, 8)
                  .map((exp) => (
                    <div
                      key={exp.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        background: softBackground,
                        borderRadius: 10,
                        boxShadow: "0 2px 8px rgba(239,138,87,0.06)",
                        padding: "0.8rem 1.3rem",
                        gap: 18,
                        transition: "transform 0.2s",
                        position: "relative",
                      }}
                    >
                      <div
                        style={{ flex: 2, fontWeight: 700, color: "var(--buck-orange)" }}
                      >
                        {exp.category}
                      </div>
                      <div
                        style={{ flex: 3, color: "var(--buck-ink)", fontWeight: 500 }}
                      >
                        {exp.description}
                      </div>
                      <div
                        style={{
                          flex: 1,
                          color: "var(--buck-orange)",
                          fontWeight: 800,
                          fontSize: 17,
                        }}
                      >
                        {formatCurrency(exp.amount)}
                      </div>
                      <div style={{ flex: 1, color: "var(--buck-muted)", fontSize: 14 }}>
                        {exp.date}
                      </div>
                      <button
                        onClick={() => handleRemoveExpense(exp.id, exp.amount)}
                        style={{
                          background: modalBackground,
                          color: "var(--buck-orange)",
                          border: "1px solid rgba(244,117,54,0.38)",
                          borderRadius: 7,
                          padding: "0.4rem 1.1rem",
                          fontWeight: 700,
                          fontSize: 15,
                          cursor: "pointer",
                          marginLeft: 10,
                          transition:
                            "background 0.2s, color 0.2s, border 0.2s",
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.background = primaryButtonBackground;
                          e.currentTarget.style.color = primaryButtonColor;
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = modalBackground;
                          e.currentTarget.style.color = "var(--buck-orange)";
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                {expenses.length === 0 && (
                  <div
                    style={{
                      color: "var(--buck-muted)",
                      textAlign: "center",
                      padding: 24,
                      fontSize: 16,
                    }}
                  >
                    No expenses yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default Statistics;
