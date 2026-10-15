"use client";
import React, { useEffect, useState, useRef } from "react";
import CustomSelect from "@/component/CustomSelect";
import CustomDatePicker from "@/component/CustomDatePicker";
import { useToast } from "@/component/toast/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import "./style.css";
import "./progress-bar.css";
import { useRouter } from "next/navigation";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useDashboardUser } from "@/context/DashboardUserContext";
import {
  mergeDashboardDataCache,
  useFinancial,
} from "@/context/FinancialContext";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import CreateGoalModal from "./CreateGoalModal";
import {
  deleteGoal,
  updateGoalStatus,
  setOnlyGoalActive,
} from "@/component/goals";
import ProgressBarCard from "./ProgressBarCard";
import DangerDeleteDialog from "@/component/DangerDeleteDialog";
import { getGoalTip, suggestCategory } from "@/utils/aiApi";
import { computeGoalForecast } from "@/utils/goalForecast";
import { Line } from "react-chartjs-2";
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
import { formatCurrency } from "@/utils/formatters";
import {
  buildMonthRanges,
  buildWeekRanges,
  daysBetween,
  findCurrentRangeIndex,
  formatDayKey,
  parseDayKey,
  storedDayKey,
  toDayKey,
  type DateRange,
  type MonthRange,
} from "@/utils/periods";
import {
  addExpenseWithWalletDeduction,
  getActiveWallet,
  listExpenses,
  listGoals,
  subscribeUserTable,
  updateGoalAiRecommendedBudget,
  updateGoalProgress,
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

const RECENT_EXPENSE_LIMIT = 5;

const GoalsPage = () => {
  const router = useRouter();
  const { user } = useDashboardUser();
  const { toast } = useToast();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const userCache = dashboardCache.userId === user.uid ? dashboardCache : {};
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
  const fieldBackground = isDarkTheme
    ? "rgba(255,197,71,0.08)"
    : "rgba(255,250,244,0.74)";
  const [goals, setGoals] = useState<Goal[]>(() => userCache.goals ?? []);
  const [loadingGoals, setLoadingGoals] = useState(
    () => !hasInitialGoalsData
  );
  const [showModal, setShowModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [aiRecommendation, setAIRecommendation] = useState<string | null>(null);
  const [walletBudget, setWalletBudget] = useState<number | null>(
    () => userCache.activeWalletBudget ?? null
  );
  
  // Progress modal state
  const [showProgressModal, setShowProgressModal] = useState(false);
  const [progressGoal, setProgressGoal] = useState<Goal | null>(null);
  const [progressInput, setProgressInput] = useState("");
  const [progressLoading, setProgressLoading] = useState(false);

  const [forecastData, setForecastData] = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const [forecastModalOpen, setForecastModalOpen] = useState(false);
  // --- Add Expense Modal state for goals page ---
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseDate, setExpenseDate] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState("");

  // Add state for expenses
  const [expenses, setExpenses] = useState<BuckExpense[]>(
    () => userCache.expenses ?? []
  );
  const hadInitialGoalsData = useRef(hasInitialGoalsData);

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState("");

  const [selectedMode, setSelectedMode] = useState<
    "week" | "month" | "overall"
  >("week");
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(0);

  // Week/month ranges spanning the selected goal (forecast modal selectors)
  let weekDateRanges: DateRange[] = [];
  let monthDateRanges: MonthRange[] = [];
  if (selectedGoal) {
    const from = parseDayKey(storedDayKey(selectedGoal.createdAt) || toDayKey(new Date()));
    const to = parseDayKey(
      storedDayKey(selectedGoal.targetDate || selectedGoal.createdAt) || toDayKey(new Date())
    );
    weekDateRanges = buildWeekRanges(from, to);
    monthDateRanges = buildMonthRanges(from, to);
  }
  const currentWeekIdx = findCurrentRangeIndex(weekDateRanges);
  const currentMonthIdx = findCurrentRangeIndex(monthDateRanges);

  const userSelectedWeekRef = useRef(false);
  const userSelectedMonthRef = useRef(false);

  useEffect(() => {
    if (!userSelectedWeekRef.current && currentWeekIdx >= 0) {
      setSelectedWeek(currentWeekIdx);
    }
  }, [currentWeekIdx]);

  useEffect(() => {
    if (!userSelectedMonthRef.current && currentMonthIdx >= 0) {
      setSelectedMonth(currentMonthIdx);
    }
  }, [currentMonthIdx]);

  // --- CRUD Handlers ---
  // Opened by the Delete button; the three-step dialog (ADR-041) calls handleDeleteGoal.
  const [confirmGoalDelete, setConfirmGoalDelete] = useState(false);

  const handleDeleteGoal = async () => {
    if (!selectedGoal) return;

    const result = await deleteGoal(selectedGoal.id);
    if (result.success) {
      const nextGoals = goals.filter((goal) => goal.id !== selectedGoal.id);
      setGoals(nextGoals);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          goals: nextGoals,
        })
      );
      setSelectedGoal(null);
      toast("Goal deleted successfully", "success");
    } else {
      toast(result.message || "Failed to delete goal.", "error");
    }
  };

  const handleSetActive = async () => {
    if (!selectedGoal || !user) return;
    if (selectedGoal.isActive) {
      // Deactivate the goal
      const result = await updateGoalStatus(selectedGoal.id, false);
      if (result.success) {
        const nextGoals = goals.map((goal) =>
          goal.id === selectedGoal.id ? { ...goal, isActive: false } : goal
        );
        setGoals(nextGoals);
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, user.uid, {
            goals: nextGoals,
          })
        );
        setSelectedGoal({ ...selectedGoal, isActive: false });
      } else {
        toast(result.message || "Failed to update goal status.", "error");
      }
    } else {
      // Activate only this goal, deactivate others
      const result = await setOnlyGoalActive(selectedGoal.id);
      if (result.success) {
        // No wallet allocation to goal! Just set active status.
        const nextGoals = goals.map((goal) =>
          goal.id === selectedGoal.id
            ? { ...goal, isActive: true }
            : { ...goal, isActive: false }
        );
        setGoals(nextGoals);
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, user.uid, {
            goals: nextGoals,
          })
        );
        setSelectedGoal({ ...selectedGoal, isActive: true });
      } else {
        toast(result.message || "Failed to update goal status.", "error");
      }
    }
  };

  // --- Progress Modal Handlers ---
  const handleOpenProgressModal = (goal: Goal) => {
    setProgressGoal(goal);
    setProgressInput("");
    setShowProgressModal(true);
  };

  const handleAddProgress = async () => {
    if (!progressGoal || !user) return;
    const amountToAdd = parseFloat(progressInput);
    if (isNaN(amountToAdd) || amountToAdd <= 0) {
      toast("Please enter a valid amount greater than 0.", "warning");
      return;
    }
    setProgressLoading(true);
    const newAmount = (progressGoal.currentAmount || 0) + amountToAdd;
    const isCompleted = newAmount >= progressGoal.targetAmount;
    try {
      await updateGoalProgress(
        user.uid,
        progressGoal.id,
        newAmount,
        isCompleted
      );
      // Update local state
      setGoals((currentGoals) => {
        const nextGoals = currentGoals.map((goal) =>
          goal.id === progressGoal.id
            ? { ...goal, currentAmount: newAmount, completed: isCompleted }
            : goal
        );
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, user.uid, {
            goals: nextGoals,
          })
        );
        return nextGoals;
      });
      // If the selected goal is the one updated, update it too
      if (selectedGoal && selectedGoal.id === progressGoal.id) {
        setSelectedGoal({
          ...selectedGoal,
          currentAmount: newAmount,
          completed: isCompleted,
        });
      }
      setShowProgressModal(false);
      toast(
        isCompleted
          ? "Congratulations! Goal completed!"
          : "Goal progress updated successfully",
        "success"
      );
    } catch (err) {
      toast("Failed to update progress.", "error");
    } finally {
      setProgressLoading(false);
    }
  };

  const handleSeeForecast = async () => {
    if (!selectedGoal || walletBudget == null || !user) {
      let missing = [];
      if (!selectedGoal) missing.push("goal");
      if (walletBudget == null) missing.push("wallet budget");
      if (!user) missing.push("user");
      setErrorModalMessage(
        `Cannot show forecast. Missing: ${missing.join(
          ", "
        )}. Please make sure you have selected a goal, are logged in, and have a wallet budget set.`
      );
      setShowErrorModal(true);
      return;
    }
    setForecastLoading(true);
    setForecastError(null);
    setForecastData(null);
    setForecastModalOpen(true);
    try {
      const data = computeGoalForecast(selectedGoal);
      setForecastData(data);
      if (data.ai_recommended_budget && selectedGoal && user) {
        await updateGoalAiRecommendedBudget(
          user.uid,
          selectedGoal.id,
          Number(data.ai_recommended_budget)
        );
      }
    } catch (err: any) {
      setForecastError(err.message || "Unknown error");
    } finally {
      setForecastLoading(false);
    }
  };

  // --- Effects ---
  useEffect(() => {
    if (goals.length === 0) {
      setSelectedGoal(null);
      return;
    }
    // Try to find an active goal
    const activeGoal = goals.find((goal) => goal.isActive);
    if (activeGoal) {
      setSelectedGoal(activeGoal);
      return;
    }
    // Fallback: use localStorage or first goal
    const storedGoalId = localStorage.getItem("selectedGoalId");
    if (storedGoalId) {
      const foundGoal = goals.find((goal) => goal.id === storedGoalId);
      setSelectedGoal(foundGoal || goals[0]);
    } else {
      setSelectedGoal(goals[0]);
    }
  }, [goals]);

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

  // AI Financial Advisor tip for the selected goal (read server-side by id).
  useEffect(() => {
    if (!selectedGoal) {
      setAIRecommendation(null);
      return;
    }
    let cancelled = false;
    setAIRecommendation("Loading AI recommendation...");
    void getGoalTip({ goalId: selectedGoal.id }).then((tip) => {
      if (!cancelled) setAIRecommendation(tip || null);
    });
    return () => {
      cancelled = true;
    };
  }, [selectedGoal]);

  useEffect(() => {
    const fetchWalletBudget = async () => {
      if (!user) return;
      const activeWallet = await getActiveWallet(user.uid);
      const nextWalletBudget = activeWallet?.budget ?? null;
      setWalletBudget(nextWalletBudget);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          activeWalletBudget: nextWalletBudget,
        })
      );
    };

    fetchWalletBudget();

    if (!user) {
      return;
    }

    const unsubscribeWallets = subscribeUserTable("wallets", user.uid, () => {
      void fetchWalletBudget();
    });

    return () => {
      unsubscribeWallets();
    };
  }, [setDashboardCache, user.uid]);

  useEffect(() => {
    if (!forecastModalOpen || !selectedGoal || !user) return;
    const fetchForecast = async () => {
      setForecastLoading(true);
      setForecastError(null);
      try {
        // Plain-math trajectory over the whole horizon (BuckAI_Forecast will
        // add AI on top later); the chart slices it to the selected week/month.
        const data = computeGoalForecast(selectedGoal);
        setForecastData(data);
        if (data.ai_recommended_budget && selectedGoal && user) {
          await updateGoalAiRecommendedBudget(
            user.uid,
            selectedGoal.id,
            Number(data.ai_recommended_budget)
          );
        }
      } catch (err: any) {
        setForecastError(err.message || "Unknown error");
      } finally {
        setForecastLoading(false);
      }
    };
    fetchForecast();
  }, [
    forecastModalOpen,
    selectedGoal,
    user,
    walletBudget,
    selectedMode,
    selectedWeek,
    selectedMonth,
  ]);

  // Add expense handler for modal
  const handleAddExpense = async () => {
    if (!user || !selectedGoal) return;
    const expenseValue = parseFloat(expenseAmount);
    if (isNaN(expenseValue) || expenseValue <= 0) {
      setExpenseError("Please enter a valid expense amount.");
      return;
    }
    if (walletBudget === null || walletBudget <= 0) {
      setExpenseError(
        "You have no money in your wallet. Please add funds before adding expenses."
      );
      return;
    }
    if (expenseValue > walletBudget) {
      setExpenseError(
        "Expense exceeds your wallet balance. Please enter a smaller amount."
      );
      return;
    }
    setExpenseLoading(true);
    setExpenseError("");
    try {
      // The AI Advisor files the expense under one of the user's own categories.
      const aiCategory = await suggestCategory("expense", expenseDesc);
      await addExpenseWithWalletDeduction(user.uid, {
        date: expenseDate,
        amount: expenseValue,
        description: expenseDesc,
        categoryName: aiCategory || "Uncategorized",
        goalId: selectedGoal.id,
      });
      const activeWallet = await getActiveWallet(user.uid);
      setWalletBudget(activeWallet?.budget ?? null);
      setShowExpenseModal(false);
      setExpenseDate("");
      setExpenseAmount("");
      setExpenseDesc("");
    } catch (err) {
      if (err instanceof Error) {
        setExpenseError(err.message);
      } else {
        setExpenseError("Unknown error");
      }
    } finally {
      setExpenseLoading(false);
    }
  };

  // Prepare data for Chart.js (Spending Report style)
  let chartData = null;
  if (forecastData && forecastData.forecast_per_day) {
    const labels = Object.keys(forecastData.forecast_per_day);
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
          borderColor: "#f47536",
          backgroundColor: "rgba(244,117,54,0.16)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#f47536",
          pointBorderColor: "#f47536",
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3,
        },
        {
          label: "Actual Daily Expense",
          data: actualVals,
          borderColor: "#ffc547",
          backgroundColor: "rgba(255,197,71,0.18)",
          fill: true,
          tension: 0.4,
          pointBackgroundColor: "#ffc547",
          pointBorderColor: "#ffc547",
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3,
        },
      ],
    };
  }

  // Fetch expenses for the selected goal
  useEffect(() => {
    if (!user || !selectedGoal) return;

    const fetchExpenses = () => {
      listExpenses(user.uid)
        .then((allExpenses) => {
          setDashboardCache((currentCache) =>
            mergeDashboardDataCache(currentCache, user.uid, {
              expenses: allExpenses,
            })
          );
          setExpenses(
            allExpenses.filter((expense) => expense.goalId === selectedGoal.id)
          );
        })
        .catch((error) => console.error("Failed to load expenses:", error));
    };

    fetchExpenses();

    const unsubscribeExpenses = subscribeUserTable(
      "expenses",
      user.uid,
      fetchExpenses
    );

    return () => {
      unsubscribeExpenses();
    };
  }, [setDashboardCache, selectedGoal, user.uid]);

  const chartRef = useRef<any>(null);

  if (loadingGoals) {
    return <DashboardPageSkeleton variant="goals" />;
  }

  if (goals.length === 0) {
    // No goals set
    return (
      <>
        <div className="emptyContainer">
          <div className="goals-card">
            <h2 className="goals-title">
              There are no goals yet
              <br />
              Would you like to create one?
            </h2>
            <button
              className="goals-create-btn"
              type="button"
              onClick={() => setShowModal(true)}
            >
              Create Goal
            </button>
          </div>
        </div>
        <AnimatePresence>
          {showModal && (
            <CreateGoalModal
              onClose={() => setShowModal(false)}
              onGoalCreated={(newGoal) => {
                setShowModal(false);
                setGoals((prev) => [...prev, newGoal]);
                setSelectedGoal(newGoal);
              }}
            />
          )}
        </AnimatePresence>
      </>
    );
  }

  // User has at least one goal
  const goalPercent = (goal: Goal) =>
    goal.targetAmount > 0
      ? Math.min(((goal.currentAmount || 0) / goal.targetAmount) * 100, 100)
      : 0;

  const detail = (() => {
    if (!selectedGoal) return null;
    const saved = selectedGoal.currentAmount || 0;
    const remaining = Math.max(selectedGoal.targetAmount - saved, 0);
    const isComplete = selectedGoal.completed || goalPercent(selectedGoal) >= 100;
    const dueKey = storedDayKey(selectedGoal.targetDate);
    const todayKey = toDayKey(new Date());
    // Days left including today; 0 = due today, negative = overdue.
    const daysLeft = dueKey
      ? dueKey >= todayKey
        ? daysBetween(todayKey, dueKey) - 1
        : -(daysBetween(dueKey, todayKey) - 1)
      : null;
    const perDay =
      daysLeft !== null && daysLeft >= 0 && remaining > 0
        ? remaining / Math.max(daysLeft, 1)
        : null;
    return { remaining, isComplete, dueKey, daysLeft, perDay };
  })();

  const statusLabel = !selectedGoal
    ? ""
    : detail?.isComplete
      ? "Completed"
      : selectedGoal.isActive
        ? "Active"
        : "Inactive";

  const recentGoalExpenses = [...expenses]
    .sort((a, b) => storedDayKey(b.date).localeCompare(storedDayKey(a.date)))
    .slice(0, RECENT_EXPENSE_LIMIT);

  return (
    <>
      <div className="GoalsPage">
        {/* Goal list */}
        <aside className="GoalsCard" aria-label="Your goals">
          <div className="goals-sidebar-header">
            <div>
              <p className="goals-eyebrow">Savings</p>
              <h2>Your goals</h2>
            </div>
            <span className="goals-count-badge">{goals.length}</span>
          </div>
          <button
            type="button"
            className="goals-create-btn goals-create-btn--block"
            onClick={() => setShowModal(true)}
          >
            + New goal
          </button>
          <div className="goals-list">
            {goals.filter(Boolean).map((goal) => {
              const pct = goalPercent(goal);
              const isSelected = selectedGoal?.id === goal.id;
              return (
                <button
                  type="button"
                  className={`goals-card${isSelected ? " selected" : ""}`}
                  key={goal.id}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedGoal(goal)}
                >
                  <span className="goals-card-top">
                    <span className="goals-card-name" title={goal.goalName}>
                      {goal.goalName}
                    </span>
                    {pct >= 100 || goal.completed ? (
                      <span className="goals-pill goals-pill--completed">Done</span>
                    ) : goal.isActive ? (
                      <span className="goals-pill goals-pill--active">Active</span>
                    ) : null}
                  </span>
                  <span className="goals-card-track" aria-hidden="true">
                    <span style={{ width: `${pct}%` }} />
                  </span>
                  <span className="goals-card-meta">
                    <span>
                      {formatCurrency(goal.currentAmount || 0)} of{" "}
                      {formatCurrency(goal.targetAmount)}
                    </span>
                    <span>{Math.round(pct)}%</span>
                  </span>
                  {goal.targetDate && (
                    <span className="goals-card-due">
                      Due {formatDayKey(storedDayKey(goal.targetDate), true)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>

        {/* Selected goal */}
        <section className="GoalsContainer">
          {selectedGoal && detail ? (
            <>
              <header className="goal-detail-header">
                <div className="goal-detail-title">
                  <p className="goals-eyebrow">Goal details</p>
                  <div className="goal-detail-name">
                    <h2 title={selectedGoal.goalName}>{selectedGoal.goalName}</h2>
                    <span className={`goals-pill goals-pill--${statusLabel.toLowerCase()}`}>
                      {statusLabel}
                    </span>
                  </div>
                </div>
                <div className="goal-detail-actions">
                  <button type="button" className="goals-ghost-btn" onClick={handleSetActive}>
                    {selectedGoal.isActive ? "Set as inactive" : "Set as active"}
                  </button>
                  <button
                    type="button"
                    className="goals-ghost-btn goals-ghost-btn--danger"
                    onClick={() => setConfirmGoalDelete(true)}
                  >
                    Delete
                  </button>
                </div>
              </header>

              <div className="goal-overview">
                <ProgressBarCard
                  goal={selectedGoal}
                  onAddProgress={() => handleOpenProgressModal(selectedGoal)}
                />
                <dl className="goal-facts">
                  <div>
                    <dt>Target date</dt>
                    <dd>{detail.dueKey ? formatDayKey(detail.dueKey, true) : "No deadline"}</dd>
                  </div>
                  <div>
                    <dt>Time left</dt>
                    <dd
                      className={
                        detail.daysLeft !== null && detail.daysLeft < 0 && !detail.isComplete
                          ? "goal-fact--alert"
                          : undefined
                      }
                    >
                      {detail.isComplete
                        ? "Reached"
                        : detail.daysLeft === null
                          ? "—"
                          : detail.daysLeft > 0
                            ? `${detail.daysLeft} ${detail.daysLeft === 1 ? "day" : "days"}`
                            : detail.daysLeft === 0
                              ? "Due today"
                              : `${-detail.daysLeft} ${detail.daysLeft === -1 ? "day" : "days"} overdue`}
                    </dd>
                  </div>
                  <div>
                    <dt>Save per day</dt>
                    <dd>
                      {detail.perDay !== null && !detail.isComplete
                        ? formatCurrency(detail.perDay)
                        : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Saving attitude</dt>
                    <dd>{selectedGoal.attitude || "Normal"}</dd>
                  </div>
                </dl>
              </div>

              {aiRecommendation && (
                <div className="ai-recommendation">
                  <strong>AI recommendation</strong>
                  <div className="ai-recommendation-content">{aiRecommendation}</div>
                </div>
              )}

              <div className="goals-bottom-buttons">
                <button
                  type="button"
                  className="goals-action-btn"
                  onClick={handleSeeForecast}
                  disabled={forecastLoading || walletBudget == null}
                >
                  See forecast
                </button>
                <button
                  type="button"
                  className="goals-ghost-btn"
                  onClick={() => router.push("/dashboard/statistics")}
                >
                  Open statistics
                </button>
              </div>

              <div className="goal-expenses">
                <div className="goal-expenses-header">
                  <h3>Linked expenses</h3>
                  <span className="goals-count-badge">{expenses.length}</span>
                </div>
                {expenses.length === 0 ? (
                  <p className="goal-expenses-empty">No expenses are linked to this goal yet.</p>
                ) : (
                  <ul className="goal-expenses-list">
                    {recentGoalExpenses.map((exp) => (
                      <li key={exp.id} className="goal-expense-row">
                        <span className="goal-expense-main">
                          <strong title={exp.description}>{exp.description || "Expense"}</strong>
                          <span>
                            {exp.category || "Uncategorized"}
                            {exp.date ? ` · ${formatDayKey(storedDayKey(exp.date))}` : ""}
                          </span>
                        </span>
                        <span className="goal-expense-amount">{formatCurrency(exp.amount)}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {expenses.length > RECENT_EXPENSE_LIMIT && (
                  <button
                    type="button"
                    className="goals-text-btn"
                    onClick={() => router.push("/dashboard/expenses")}
                  >
                    View all {expenses.length} in Expenses
                  </button>
                )}
              </div>
            </>
          ) : (
            <div className="goal-details-placeholder">
              <p>Select a goal to see its progress and AI recommendation.</p>
            </div>
          )}
        </section>
      </div>

      {/* Forecast dialog */}
      {forecastModalOpen && selectedGoal && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setForecastModalOpen(false);
          }}
        >
          <div
            className="goals-forecast-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="goals-forecast-title"
          >
            <div className="goals-modal-header">
              <div>
                <p className="goals-eyebrow">AI forecast</p>
                <h3 id="goals-forecast-title">{selectedGoal.goalName}</h3>
              </div>
              <button
                type="button"
                className="goals-modal-close"
                aria-label="Close forecast"
                onClick={() => setForecastModalOpen(false)}
              >
                &times;
              </button>
            </div>

            <div className="goals-forecast-controls">
              <div className="goals-segmented" role="group" aria-label="Forecast range">
                {(["week", "month", "overall"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    className="goals-segmented-btn"
                    aria-pressed={selectedMode === m}
                    onClick={() => setSelectedMode(m)}
                  >
                    {m === "week" ? "Week" : m === "month" ? "Month" : "Overall"}
                  </button>
                ))}
              </div>
              {selectedMode === "week" && weekDateRanges.length > 0 && (
                <CustomSelect
                  className="goals-forecast-select"
                  value={String(selectedWeek)}
                  onChange={(val) => {
                    userSelectedWeekRef.current = true;
                    setSelectedWeek(Number(val));
                  }}
                  options={weekDateRanges.map((range, idx) => ({
                    value: String(idx),
                    label: `Week ${idx + 1} · ${formatDayKey(range.start)} – ${formatDayKey(range.end)}`,
                  }))}
                />
              )}
              {selectedMode === "month" && monthDateRanges.length > 0 && (
                <CustomSelect
                  className="goals-forecast-select"
                  value={String(selectedMonth)}
                  onChange={(val) => {
                    userSelectedMonthRef.current = true;
                    setSelectedMonth(Number(val));
                  }}
                  options={monthDateRanges.map((range, idx) => ({
                    value: String(idx),
                    label: range.label,
                  }))}
                />
              )}
            </div>

            <div className="goals-forecast-progress">
              <div className="goals-forecast-progress-row">
                <span>Goal progress</span>
                <strong>
                  {formatCurrency(selectedGoal.currentAmount || 0)} /{" "}
                  {formatCurrency(selectedGoal.targetAmount)}
                </strong>
              </div>
              <div className="goals-card-track goals-card-track--lg" aria-hidden="true">
                <span style={{ width: `${goalPercent(selectedGoal)}%` }} />
              </div>
            </div>

            <div className="goals-forecast-chart">
              {forecastLoading ? (
                <div className="goals-forecast-state" role="status">
                  <div className="spinner" />
                  <p>Loading forecast…</p>
                </div>
              ) : forecastError ? (
                <p className="goals-forecast-state goals-forecast-state--error">
                  The forecast service is unavailable right now. Try again later.
                </p>
              ) : chartData ? (
                <Line
                  ref={chartRef}
                  data={chartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    interaction: { mode: "index", intersect: false },
                    plugins: {
                      legend: {
                        display: true,
                        position: "top",
                        align: "end",
                        labels: { color: chartTextColor, boxWidth: 12, boxHeight: 12 },
                      },
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
                        ticks: { color: chartTextColor, maxTicksLimit: 8 },
                      },
                      y: {
                        grid: { color: chartGridColor },
                        beginAtZero: true,
                        ticks: { color: chartTextColor, maxTicksLimit: 5 },
                      },
                    },
                  }}
                />
              ) : (
                <p className="goals-forecast-state">No forecast data for this range.</p>
              )}
            </div>

            <div className="goals-modal-footer">
              <button
                type="button"
                className="goals-ghost-btn"
                onClick={() => setForecastModalOpen(false)}
              >
                Close
              </button>
              <button
                type="button"
                className="goals-action-btn"
                onClick={() => setShowExpenseModal(true)}
              >
                + Add expense
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Add expense (opened from the forecast dialog) */}
      {showExpenseModal && (
        <div
            className="modal-backdrop"
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100vw",
            height: "100vh",
            background: "rgba(18,13,10,0.48)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            className="modal"
            role="dialog"
            aria-modal="true"
            aria-label="Add expense"
            style={{
              background: modalBackground,
              color: "var(--buck-ink)",
              border: "1px solid var(--buck-line)",
              borderRadius: 20,
              padding: 32,
              width: "min(540px, 100%)",
              boxSizing: "border-box",
              boxShadow: "0 12px 48px rgba(239,138,87,0.18)",
              position: "relative",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              animation: "fadeInScale 0.35s",
              fontSize: 17,
              maxHeight: "min(82dvh, 760px)",
              overflowY: "auto",
            }}
          >
            <button
              type="button"
              aria-label="Close dialog"
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
              <span aria-hidden="true">&times;</span>
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
            <CustomDatePicker
              value={expenseDate}
              onChange={(val) => setExpenseDate(val)}
              style={{
                width: "100%",
                marginBottom: 12,
                boxSizing: "border-box",
              }}
            />
            <input
              type="number"
              value={expenseAmount}
              onChange={(e) =>
                setExpenseAmount(e.target.value)
              }
              placeholder="Amount"
              style={{
                width: "100%",
                marginBottom: 12,
                padding: 12,
                borderRadius: 7,
                border: "1px solid rgba(244,117,54,0.32)",
                background: fieldBackground,
                fontSize: 17,
                boxSizing: "border-box",
                display: "block",
                color: "var(--buck-ink)",
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
                background: fieldBackground,
                fontSize: 17,
                boxSizing: "border-box",
                display: "block",
                color: "var(--buck-ink)",
                transition: "border 0.2s",
              }}
            />
            {expenseError && (
              <div style={{ color: "red", marginBottom: 12 }}>
                {expenseError}
              </div>
            )}
            <button
              onClick={handleAddExpense}
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
            <style>{`
              @keyframes fadeInScale { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
            `}</style>
          </div>
        </div>
      )}
      <DangerDeleteDialog
        open={confirmGoalDelete && Boolean(selectedGoal)}
        itemType="goal"
        itemName={selectedGoal?.goalName ?? ""}
        consequences={[
          "The goal, its progress and its AI recommendation are removed.",
          "Expenses linked to it are kept but no longer linked to a goal.",
        ]}
        onCancel={() => setConfirmGoalDelete(false)}
        onConfirm={async () => {
          await handleDeleteGoal();
          setConfirmGoalDelete(false);
        }}
      />
      <AnimatePresence>
        {showModal && (
          <CreateGoalModal
            onClose={() => setShowModal(false)}
            onGoalCreated={(newGoal) => {
              setShowModal(false);
              setGoals((prev) => [...prev, newGoal]);
              setSelectedGoal(newGoal);
            }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showProgressModal && progressGoal && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              className="modal"
              initial={{ y: 20, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 20, opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
            >
              <h3>Add Progress to {progressGoal.goalName}</h3>
              <input
                type="number"
                min="1"
                placeholder="Amount"
                value={progressInput}
                onChange={(e) => setProgressInput(e.target.value)}
                disabled={progressLoading}
                style={{ marginBottom: "1rem", width: "100%" }}
              />
              <div className="ProgressModal-btns">
                <button
                  className="addProgress-btn"
                  onClick={handleAddProgress}
                  disabled={progressLoading}
                >
                  {progressLoading ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  className="ProgressModal-cancel-btn"
                  onClick={() => setShowProgressModal(false)}
                  disabled={progressLoading}
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showErrorModal && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              width: "100vw",
              height: "100vh",
              background: "rgba(18,13,10,0.48)",
              zIndex: 1200,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <motion.div
                className="modal"
                role="alertdialog"
                aria-modal="true"
                aria-label="Action not allowed"
                initial={{ y: 20, opacity: 0, scale: 0.95 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                exit={{ y: 20, opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                style={{
              background: modalBackground,
              color: "var(--buck-ink)",
              border: "1px solid var(--buck-line)",
              borderRadius: 8,
              padding: 24,
              width: "min(400px, 100%)",
              boxSizing: "border-box",
              boxShadow: "var(--buck-shadow)",
              position: "relative",
              textAlign: "center",
            }}
          >
            <button
              type="button"
              aria-label="Close dialog"
              onClick={() => setShowErrorModal(false)}
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                background: "none",
                border: "none",
                fontSize: 20,
                cursor: "pointer",
              }}
            >
              <span aria-hidden="true">&times;</span>
            </button>
            <h3 style={{ marginTop: 0, color: "var(--buck-coral)" }}>
              Action Not Allowed
            </h3>
            <div
              style={{
                margin: "18px 0",
                fontWeight: 500,
                color: "var(--buck-ink)",
                fontSize: 17,
              }}
            >
              {errorModalMessage}
            </div>
            <button
              onClick={() => setShowErrorModal(false)}
              style={{
                background: primaryButtonBackground,
                color: primaryButtonColor,
                border: "none",
                borderRadius: 8,
                padding: "0.7rem 1.5rem",
                fontWeight: 600,
                fontSize: 16,
                cursor: "pointer",
                width: "100%",
              }}
            >
              Close
            </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default GoalsPage;
