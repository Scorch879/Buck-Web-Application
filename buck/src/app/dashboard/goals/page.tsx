"use client";
import React, { useEffect, useState, useRef } from "react";
import { useToast } from "@/component/toast/ToastContext";
import { motion, AnimatePresence } from "framer-motion";
import { backdropMotion, panelMotion } from "@/utils/motion";
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
import { buckChartColors, buckTooltip } from "@/utils/chartTheme";
import CreateGoalModal from "./CreateGoalModal";
import GoalPlanTable, { AttitudeChip } from "./GoalPlanTable";
import AddExpenseModal from "../expenses/AddExpenseModal";
import {
  addGoalProgress,
  deleteGoal,
  updateGoalStatus,
  setOnlyGoalActive,
  restoreGoal,
} from "@/component/goals";
import ProgressBarCard from "./ProgressBarCard";
import DangerDeleteDialog from "@/component/DangerDeleteDialog";
import { detectGoalAttitude, getGoalTip } from "@/utils/aiApi";
import { fetchAIForecastInsights, type ForecastDay } from "@/utils/forecastApi";
import type { GoalPlan, SavingAttitude } from "@/utils/goalAttitude";
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
import { daysBetween, formatDayKey, storedDayKey, toDayKey } from "@/utils/periods";
import {
  ensureDefaultCategories,
  getActiveWallet,
  listExpenses,
  listGoals,
  listDeletedGoals,
  subscribeUserTable,
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

/**
 * What the forecast dialog shows for the selected goal (ADR-055). The active
 * goal gets the AI Forecaster's plan and 30 days; any other goal gets the plan
 * from the AI Advisor's attitude check.
 */
type GoalForecastView =
  | { kind: "unavailable" }
  | {
      kind: "active" | "inactive";
      attitude: SavingAttitude;
      reason: string | null;
      feasible: boolean | null;
      /** Null when there is no spending history to plan from. */
      plan: GoalPlan | null;
      /** Active goal only: the Forecaster's expected spending per day. */
      forecastDailySpending: number | null;
      withinPlan: boolean | null;
      days: ForecastDay[];
    };

const RECENT_EXPENSE_LIMIT = 5;

const GoalsPage = () => {
  const router = useRouter();
  const { user } = useDashboardUser();
  const { toast } = useToast();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const userCache = dashboardCache.userId === user.uid ? dashboardCache : {};
  const hasInitialGoalsData = Boolean(userCache.goals);
  const isDarkTheme = useAuthPageTheme();
  const { text: chartTextColor, grid: chartGridColor } = buckChartColors(isDarkTheme);
  const [goals, setGoals] = useState<Goal[]>(() => userCache.goals ?? []);
  const [deletedGoals, setDeletedGoals] = useState<Goal[]>([]);
  const [showDeletedGoals, setShowDeletedGoals] = useState(false);
  const [restoringGoalId, setRestoringGoalId] = useState<string | null>(null);
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

  // Forecast dialog: the AI Forecaster's plan for the selected goal.
  const [forecastView, setForecastView] = useState<GoalForecastView | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastModalOpen, setForecastModalOpen] = useState(false);
  // Only the newest forecast request may write its answer.
  const forecastRequestRef = useRef(0);

  // Add Spending dialog (opened from the forecast dialog) and its categories.
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [categories, setCategories] = useState<BuckCategory[]>(
    () => userCache.categories ?? []
  );

  // Add state for expenses
  const [expenses, setExpenses] = useState<BuckExpense[]>(
    () => userCache.expenses ?? []
  );
  const hadInitialGoalsData = useRef(hasInitialGoalsData);

  // --- CRUD Handlers ---
  // Opened by the Delete button; the three-step dialog (ADR-041) calls handleDeleteGoal.
  const [confirmGoalDelete, setConfirmGoalDelete] = useState(false);

  const handleDeleteGoal = async () => {
    const goalToDelete = selectedGoal;
    if (!goalToDelete) return;

    const result = await deleteGoal(goalToDelete.id);
    if (result.success) {
      const nextGoals = goals.filter((goal) => goal.id !== goalToDelete.id);
      setGoals(nextGoals);
      setDeletedGoals((prev) => [
        { ...goalToDelete, isActive: false, deletedAt: new Date().toISOString() },
        ...prev.filter((g) => g.id !== goalToDelete.id),
      ]);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          goals: nextGoals,
        })
      );
      setSelectedGoal(nextGoals[0] ?? null);
      toast("Goal moved to Deleted Goals. You can restore it anytime.", "success");
    } else {
      toast(result.message || "Failed to delete goal.", "error");
    }
  };

  const handleRestoreGoal = async (goalToRestore: Goal) => {
    if (restoringGoalId) return;
    setRestoringGoalId(goalToRestore.id);
    try {
      const result = await restoreGoal(goalToRestore.id);
      if (result.success) {
        const restored: Goal = result.goal ?? {
          ...goalToRestore,
          isActive: false,
          deletedAt: null,
        };
        const nextGoals = [restored, ...goals.filter((g) => g.id !== restored.id)];
        setGoals(nextGoals);
        setDeletedGoals((prev) => prev.filter((g) => g.id !== goalToRestore.id));
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, user.uid, { goals: nextGoals })
        );
        setSelectedGoal(restored);
        toast(`Restored "${restored.goalName}"`, "success");
      } else {
        toast(result.message || "Failed to restore goal.", "error");
      }
    } catch (error) {
      console.error("Failed to restore goal:", error);
      toast("Failed to restore goal.", "error");
    } finally {
      setRestoringGoalId(null);
    }
  };

  const handleSetActive = async () => {
    if (!selectedGoal || !user) return;
    const applyToSelected = (patch: Partial<Goal>, deactivateOthers: boolean) => {
      const nextGoals = goals.map((goal) =>
        goal.id === selectedGoal.id
          ? { ...goal, ...patch }
          : deactivateOthers
            ? { ...goal, isActive: false }
            : goal
      );
      setGoals(nextGoals);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          goals: nextGoals,
        })
      );
      setSelectedGoal({ ...selectedGoal, ...patch });
    };

    if (selectedGoal.isActive) {
      const result = await updateGoalStatus(selectedGoal.id, false);
      if (result.success) {
        applyToSelected({ isActive: false }, false);
      } else {
        toast(result.message || "Failed to update goal status.", "error");
      }
      return;
    }

    // A goal that is already reached can't be active again; the database
    // refuses it too (set_active_goal).
    if (selectedGoal.completed) return;

    // Makes this the one active goal and re-detects its saving attitude.
    const result = await setOnlyGoalActive(selectedGoal.id);
    if (!result.success) {
      toast(result.message || "Failed to update goal status.", "error");
      return;
    }
    const detected = result.attitude ?? null;
    applyToSelected(
      detected
        ? {
            isActive: true,
            attitude: detected.attitude,
            attitudeBasis: detected,
            attitudeDetectedAt: new Date().toISOString(),
          }
        : { isActive: true },
      true
    );
    toast(
      `"${selectedGoal.goalName}" is now your active goal. Only one goal can be active, and Buck forecasts the active one.`,
      "success"
    );
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
    // The database adds the amount itself (add_goal_progress), so two quick
    // saves can't overwrite each other the way a browser-computed total could.
    const result = await addGoalProgress(progressGoal.id, amountToAdd);
    setProgressLoading(false);
    if (!result.success || !("currentAmount" in result)) {
      toast("Failed to update progress.", "error");
      return;
    }
    const patch = {
      currentAmount: result.currentAmount,
      completed: result.completed,
      // Reaching the target completes the goal and makes it inactive.
      isActive: result.isActive,
    };
    const nextGoals = goals.map((goal) =>
      goal.id === progressGoal.id ? { ...goal, ...patch } : goal
    );
    setGoals(nextGoals);
    setDashboardCache((currentCache) =>
      mergeDashboardDataCache(currentCache, user.uid, {
        goals: nextGoals,
      })
    );
    if (selectedGoal && selectedGoal.id === progressGoal.id) {
      setSelectedGoal({ ...selectedGoal, ...patch });
    }
    setShowProgressModal(false);
    toast(
      patch.completed
        ? "Congratulations! Goal completed!"
        : "Goal progress updated successfully",
      "success"
    );
  };

  const loadGoalForecast = async (goal: Goal): Promise<GoalForecastView> => {
    try {
      if (goal.isActive) {
        const insights = await fetchAIForecastInsights({ horizon: 30 });
        const forecastGoal = insights.forecast?.goal;
        // The rule-engine fallback carries no forecast, and so no goal plan.
        if (insights.source !== "buck_ai" || !insights.forecast || !forecastGoal) {
          return { kind: "unavailable" };
        }
        return {
          kind: "active",
          attitude: forecastGoal.attitude,
          reason: forecastGoal.attitudeReason,
          feasible: forecastGoal.feasible,
          plan: forecastGoal.plan,
          forecastDailySpending: forecastGoal.forecastDailySpending,
          withinPlan: forecastGoal.withinPlan,
          days: insights.forecast.days,
        };
      }
      // Only the active goal is forecast; any other goal gets its plan from
      // the AI Advisor's attitude check.
      const detected = await detectGoalAttitude({ goalId: goal.id });
      if (!detected) return { kind: "unavailable" };
      return {
        kind: "inactive",
        attitude: detected.attitude,
        reason: detected.reason,
        feasible: detected.feasible,
        plan: detected.plan,
        forecastDailySpending: null,
        withinPlan: null,
        days: [],
      };
    } catch {
      return { kind: "unavailable" };
    }
  };

  const refreshForecast = async (goal: Goal) => {
    const request = ++forecastRequestRef.current;
    setForecastLoading(true);
    const view = await loadGoalForecast(goal);
    if (request !== forecastRequestRef.current) return;
    setForecastView(view);
    setForecastLoading(false);
  };

  const handleSeeForecast = () => {
    if (!selectedGoal) return;
    setForecastView(null);
    setForecastModalOpen(true);
    void refreshForecast(selectedGoal);
  };

  // --- Effects ---
  useEffect(() => {
    setSelectedGoal((prev) => {
      if (goals.length === 0) {
        return null;
      }
      const currentMatch = prev ? goals.find((g) => g.id === prev.id) : null;
      if (currentMatch) {
        return currentMatch;
      }
      const activeGoal = goals.find((goal) => goal.isActive);
      if (activeGoal) {
        return activeGoal;
      }
      const storedGoalId = localStorage.getItem("selectedGoalId");
      if (storedGoalId) {
        const foundGoal = goals.find((goal) => goal.id === storedGoalId);
        return foundGoal || goals[0];
      }
      return goals[0];
    });
  }, [goals]);

  useEffect(() => {
    const fetchGoals = async () => {
      try {
        const [nextGoals, nextDeletedGoals] = await Promise.all([
          listGoals(user.uid),
          listDeletedGoals(user.uid),
        ]);
        setGoals(nextGoals);
        setDeletedGoals(nextDeletedGoals);
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
    // Keyed on user.uid: the user object itself is not referentially stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setDashboardCache, user.uid]);

  // Categories for the Add Spending dialog. Loaded when the forecast dialog
  // opens, so the category picker is ready before Add Spending is.
  useEffect(() => {
    if (!(forecastModalOpen || showExpenseModal) || categories.length > 0) return;
    let active = true;
    ensureDefaultCategories(user.uid)
      .then((cats) => {
        if (!active) return;
        const nextCategories = [...cats].sort((a, b) => a.name.localeCompare(b.name));
        setCategories(nextCategories);
        setDashboardCache((currentCache) =>
          mergeDashboardDataCache(currentCache, user.uid, {
            categories: nextCategories,
          })
        );
      })
      .catch((error) => console.error("Failed to load categories:", error));
    return () => {
      active = false;
    };
  }, [forecastModalOpen, showExpenseModal, categories.length, setDashboardCache, user.uid]);

  // After an expense is saved: refresh the wallet, and the plan if it's open.
  const handleExpenseAdded = async () => {
    const activeWallet = await getActiveWallet(user.uid);
    setWalletBudget(activeWallet?.budget ?? null);
    if (forecastModalOpen && selectedGoal) void refreshForecast(selectedGoal);
  };

  // Forecast chart: the Forecaster's likely running total for the next 30
  // days against the plan's spending limit added up day by day.
  const forecastPlan =
    forecastView && forecastView.kind !== "unavailable" ? forecastView.plan : null;
  const forecastDays = forecastView?.kind === "active" ? forecastView.days : [];
  const chartData =
    forecastPlan && forecastDays.length > 0
      ? {
          labels: forecastDays.map((day) => formatDayKey(day.date)),
          datasets: [
            {
              label: "Likely spending (running total)",
              data: forecastDays.map((day) => day.cumulative.p50),
              borderColor: "#f47536",
              backgroundColor: "rgba(244,117,54,0.16)",
              fill: true,
              tension: 0.3,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointBackgroundColor: "#f47536",
              borderWidth: 3,
            },
            {
              label: "Your spending limit (running total)",
              data: forecastDays.map((_, index) => forecastPlan.spending.perDay * (index + 1)),
              borderColor: "#ffc547",
              backgroundColor: "#ffc547",
              borderDash: [6, 4],
              fill: false,
              tension: 0,
              pointRadius: 0,
              pointHoverRadius: 5,
              pointBackgroundColor: "#ffc547",
              borderWidth: 2,
            },
          ],
        }
      : null;

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
    // Keyed on user.uid: the user object itself is not referentially stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setDashboardCache, selectedGoal, user.uid]);

  const renderDeletedGoalsSection = (forceExpanded = false) => {
    if (deletedGoals.length === 0) return null;
    const isExpanded = forceExpanded || showDeletedGoals;
    return (
      <div className="goals-deleted-section">
        <button
          type="button"
          className="goals-deleted-toggle"
          aria-expanded={isExpanded}
          onClick={() => setShowDeletedGoals((prev) => !prev)}
        >
          <span>Deleted goals</span>
          <span className="goals-count-badge">{deletedGoals.length}</span>
        </button>
        {isExpanded && (
          <div
            className="goals-deleted-list"
            role="region"
            aria-label="Deleted goals"
          >
            {deletedGoals.map((goal) => (
              <div key={goal.id} className="goals-deleted-item">
                <div className="goals-deleted-info">
                  <span className="goals-deleted-name" title={goal.goalName}>
                    {goal.goalName}
                  </span>
                  <span className="goals-deleted-meta">
                    {formatCurrency(goal.currentAmount || 0)} of{" "}
                    {formatCurrency(goal.targetAmount)}
                  </span>
                </div>
                <button
                  type="button"
                  className="goals-restore-btn"
                  onClick={() => void handleRestoreGoal(goal)}
                  disabled={restoringGoalId === goal.id}
                  aria-label={`Restore ${goal.goalName}`}
                >
                  {restoringGoalId === goal.id ? "Restoring…" : "Restore"}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

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
          {renderDeletedGoalsSection(true)}
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

  /** When the plan's saving reaches the goal, set against the target date. */
  const reachLine = (plan: GoalPlan) => {
    if (plan.daysToGoal === null) {
      return "This plan leaves nothing to save yet, so there is no reach date.";
    }
    const days = `${plan.daysToGoal} ${plan.daysToGoal === 1 ? "day" : "days"}`;
    const reach = `Saving ${formatCurrency(plan.saving.perDay)} per day, you reach this goal in ${days}.`;
    if (!detail?.dueKey) return reach;
    const due = formatDayKey(detail.dueKey, true);
    return plan.reachesByTargetDate
      ? `${reach} That is in time for your target date, ${due}.`
      : `${reach} That is after your target date, ${due}.`;
  };

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
          {renderDeletedGoalsSection()}
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
                  <button
                    type="button"
                    className="goals-ghost-btn"
                    onClick={handleSetActive}
                    disabled={detail.isComplete && !selectedGoal.isActive}
                    title={
                      selectedGoal.isActive
                        ? undefined
                        : detail.isComplete
                          ? "A goal you have reached can't be made active again."
                          : "Only one goal can be active. Buck forecasts the active goal."
                    }
                  >
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
                      {detail.isComplete
                        ? "—"
                        : detail.perDay !== null
                          ? formatCurrency(detail.perDay)
                          : detail.daysLeft !== null && detail.daysLeft < 0
                            ? "Set a new date"
                            : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt>Saving attitude</dt>
                    <dd>
                      {selectedGoal.attitude || "Normal"}
                      <span className="goal-fact-note">
                        {selectedGoal.attitudeBasis
                          ? "Detected by AI Advisor"
                          : "Not checked by AI Advisor yet"}
                      </span>
                    </dd>
                  </div>
                  <div className="goal-fact--wide">
                    <dt>Why this attitude</dt>
                    <dd className="goal-fact-reason">
                      {selectedGoal.attitudeBasis?.reason ??
                        "Your AI Advisor sets this from your spending once Buck's AI is reachable."}
                    </dd>
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
                  disabled={forecastLoading || detail.isComplete}
                  title={detail.isComplete ? "This goal is already reached." : undefined}
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

      {/* Forecast dialog: the AI Forecaster's plan for this goal (ADR-055) */}
      {forecastModalOpen && selectedGoal && (
        <div
          className="modal-backdrop"
          role="presentation"
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
                <p className="goals-eyebrow">AI Forecaster</p>
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

            {forecastLoading || !forecastView ? (
              <div className="goals-forecast-state goals-forecast-state--block" role="status">
                <div className="spinner" />
                <p>Loading your plan…</p>
              </div>
            ) : forecastView.kind === "unavailable" ? (
              <div className="goals-forecast-state goals-forecast-state--block">
                <p className="goals-forecast-state-title">AI Forecaster unavailable</p>
                <p>
                  Buck can&apos;t reach the AI Forecaster right now. Your goal and progress are
                  safe. Try again in a little while.
                </p>
              </div>
            ) : (
              <>
                <div
                  className={`goals-forecast-attitude${
                    forecastView.feasible === false ? " goals-forecast-attitude--warning" : ""
                  }`}
                >
                  <AttitudeChip attitude={forecastView.attitude} />
                  {forecastView.reason && <p>{forecastView.reason}</p>}
                </div>

                {forecastView.plan && (
                  <>
                    <GoalPlanTable
                      plan={forecastView.plan}
                      caption="Your plan to reach this goal"
                      showRequired
                    />
                    <ul className="goals-forecast-notes">
                      <li>{reachLine(forecastView.plan)}</li>
                      {forecastView.forecastDailySpending !== null && (
                        <li>
                          Forecast spending is {formatCurrency(forecastView.forecastDailySpending)} per
                          day
                          {forecastView.withinPlan === null
                            ? "."
                            : `, ${forecastView.withinPlan ? "within" : "over"} your plan of ${formatCurrency(
                                forecastView.plan.spending.perDay
                              )} per day.`}
                        </li>
                      )}
                      {forecastView.kind === "inactive" && (
                        <li>Set this goal active to see the full AI forecast.</li>
                      )}
                    </ul>
                  </>
                )}

                {chartData && (
                  <div className="goals-forecast-chart-block">
                    <h4>Next 30 days: likely spending against your limit</h4>
                    <div className="goals-forecast-chart">
                      <Line
                        data={chartData}
                        options={{
                          responsive: true,
                          maintainAspectRatio: false,
                          resizeDelay: 100,
                          interaction: { mode: "index", intersect: false },
                          plugins: {
                            legend: {
                              display: true,
                              position: "top",
                              align: "end",
                              labels: { color: chartTextColor, boxWidth: 12, boxHeight: 12 },
                            },
                            tooltip: {
                              ...buckTooltip(isDarkTheme),
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
                  </div>
                )}

                <p className="goals-forecast-disclaimer">
                  This comes from your expenses. AI might be inaccurate, so treat it as a guide.
                </p>
              </>
            )}

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
      {/* Add Spending (opened from the forecast dialog): the shared dialog,
          linked to this goal. */}
      <AddExpenseModal
        open={showExpenseModal && Boolean(selectedGoal)}
        onClose={() => setShowExpenseModal(false)}
        categories={categories}
        walletBudget={walletBudget ?? 0}
        userId={user.uid}
        goalId={selectedGoal?.id ?? null}
        onExpenseAdded={handleExpenseAdded}
      />
      <DangerDeleteDialog
        open={confirmGoalDelete && Boolean(selectedGoal)}
        itemType="goal"
        itemName={selectedGoal?.goalName ?? ""}
        consequences={[
          "The goal will be moved to Deleted Goals and deactivated.",
          "Its saved progress, AI recommendation, and linked expenses are kept so you can restore it anytime.",
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
            {...backdropMotion}
          >
            <motion.div
              className="modal"
              role="dialog"
              aria-modal="true"
              aria-label={`Add progress to ${progressGoal.goalName}`}
              {...panelMotion}
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
    </>
  );
};

export default GoalsPage;
