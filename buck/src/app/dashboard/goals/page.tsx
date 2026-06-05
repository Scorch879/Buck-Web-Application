"use client";
import React, { useEffect, useState, useRef } from "react";
import "./style.css";
import "./progress-bar.css";
import { useRouter } from "next/navigation";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import { useAuthGuard } from "@/utils/useAuthGuard";
import CreateGoalModal from "./CreateGoalModal";
import {
  deleteGoal,
  updateGoalStatus,
  setOnlyGoalActive,
} from "@/component/goals";
import ProgressBarCard from "./ProgressBarCard";
import { getSavingTip } from "@/utils/aiApi";
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

const GoalsPage = () => {
  const router = useRouter();
  const { user, loading } = useAuthGuard();
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
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<Goal | null>(null);
  const [aiRecommendation, setAIRecommendation] = useState<string | null>(null);
  const [walletBudget, setWalletBudget] = useState<number | null>(null);
  
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
  const [expenses, setExpenses] = useState<BuckExpense[]>([]);

  // --- AI category suggestion for goals page ---
  async function getSuggestedCategory(
    description: string
  ): Promise<string | null> {
    try {
      const response = await fetch(
        "https://buck-web-application-1.onrender.com/ai/categorize_expense/",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ description }),
        }
      );
      const data = await response.json();
      return data.category || null;
    } catch {
      return null;
    }
  }

  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState("");

  const [selectedMode, setSelectedMode] = useState<
    "week" | "month" | "overall"
  >("week");
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(0);

  // Generate week/month ranges for the selected goal
  let weekDateRanges: { start: string; end: string }[] = [];
  let monthDateRanges: { start: string; end: string; label: string }[] = [];
  if (selectedGoal) {
    const minStartRaw = new Date(selectedGoal.createdAt);
    const minStart = new Date(minStartRaw);
    minStart.setDate(minStart.getDate() - ((minStart.getDay() + 6) % 7)); // Monday
    const maxEnd = new Date(selectedGoal.targetDate || selectedGoal.createdAt);
    let current = new Date(minStart);
    while (current <= maxEnd) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(current.getDate() + 6);
      weekDateRanges.push({
        start: weekStart.toISOString().slice(0, 10),
        end: weekEnd.toISOString().slice(0, 10),
      });
      current.setDate(current.getDate() + 7);
    }
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

  // --- CRUD Handlers ---
  const handleDeleteGoal = async () => {
    if (!selectedGoal) return;
    const confirmDelete = window.confirm(
      `Are you sure you want to delete the goal "${selectedGoal.goalName}"?`
    );
    if (!confirmDelete) return;

    const result = await deleteGoal(selectedGoal.id);
    if (result.success) {
      setGoals(goals.filter((goal) => goal.id !== selectedGoal.id));
      setSelectedGoal(null);
    } else {
      alert(result.message || "Failed to delete goal.");
    }
  };

  const handleSetActive = async () => {
    if (!selectedGoal || !user) return;
    if (selectedGoal.isActive) {
      // Deactivate the goal
      const result = await updateGoalStatus(selectedGoal.id, false);
      if (result.success) {
        setGoals(
          goals.map((goal) =>
            goal.id === selectedGoal.id ? { ...goal, isActive: false } : goal
          )
        );
        setSelectedGoal({ ...selectedGoal, isActive: false });
      } else {
        alert(result.message || "Failed to update goal status.");
      }
    } else {
      // Activate only this goal, deactivate others
      const result = await setOnlyGoalActive(selectedGoal.id);
      if (result.success) {
        // No wallet allocation to goal! Just set active status.
        setGoals(
          goals.map((goal) =>
            goal.id === selectedGoal.id
              ? { ...goal, isActive: true }
              : { ...goal, isActive: false }
          )
        );
        setSelectedGoal({ ...selectedGoal, isActive: true });
      } else {
        alert(result.message || "Failed to update goal status.");
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
      alert("Please enter a valid amount.");
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
      setGoals((goals) =>
        goals.map((goal) =>
          goal.id === progressGoal.id
            ? { ...goal, currentAmount: newAmount, completed: isCompleted }
            : goal
        )
      );
      // If the selected goal is the one updated, update it too
      if (selectedGoal && selectedGoal.id === progressGoal.id) {
        setSelectedGoal({
          ...selectedGoal,
          currentAmount: newAmount,
          completed: isCompleted,
        });
      }
      setShowProgressModal(false);
    } catch (err) {
      alert("Failed to update progress.");
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
            budget: walletBudget,
          }),
        }
      );
      if (!res.ok) throw new Error("Failed to fetch forecast");
      const data = await res.json();
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
      if (user) {
        setLoadingGoals(true);
        try {
          setGoals(await listGoals(user.uid));
        } catch (error) {
          console.error("Failed to load goals:", error);
        } finally {
          setLoadingGoals(false);
        }
      }
    };

    fetchGoals();

    if (!user) {
      return;
    }

    const unsubscribeGoals = subscribeUserTable("goals", user.uid, () => {
      void fetchGoals();
    });

    return () => {
      unsubscribeGoals();
    };
  }, [user]);

  useEffect(() => {
    let didCancel = false;
    let timeoutId: NodeJS.Timeout;
    let retryTimeoutId: NodeJS.Timeout;
    let startTime = Date.now();
    const MAX_TIMEOUT = 30000; // 30 seconds
    const MAX_BACKOFF = 4000; // max 4s between retries

    async function fetchWithRetry(backoff = 1000) {
      if (didCancel) return;
      try {
        setAIRecommendation("Loading AI recommendation...");
        const attitude = selectedGoal?.attitude || "Normal";
        let multiplier = 1.0;
        if (attitude === "Moderate") multiplier = 0.8;
        if (attitude === "Aggressive") multiplier = 0.6;
        const userContext = `Attitude: ${attitude} (multiplier: ${multiplier}), Target Amount: ${selectedGoal?.targetAmount}`;
        const tip = await Promise.race([
          getSavingTip(
            selectedGoal?.goalName || "",
            userContext,
            selectedGoal?.targetDate,
            selectedGoal?.createdAt
          ),
          new Promise((_, reject) => {
            timeoutId = setTimeout(
              () => reject(new Error("timeout")),
              MAX_TIMEOUT - (Date.now() - startTime)
            );
          }),
        ]);
        if (!didCancel) setAIRecommendation(typeof tip === "string" ? tip : "");
      } catch (err) {
        if (didCancel) return;
        if (Date.now() - startTime < MAX_TIMEOUT) {
          // Retry with exponential backoff
          retryTimeoutId = setTimeout(
            () => fetchWithRetry(Math.min(backoff * 2, MAX_BACKOFF)),
            backoff
          );
        } else {
          setAIRecommendation(null); // Don't show error, just leave blank
        }
      } finally {
        clearTimeout(timeoutId);
      }
    }

    if (selectedGoal) {
      fetchWithRetry();
    } else {
      setAIRecommendation(null);
    }
    return () => {
      didCancel = true;
      clearTimeout(timeoutId);
      clearTimeout(retryTimeoutId);
    };
  }, [selectedGoal]);

  useEffect(() => {
    const fetchWalletBudget = async () => {
      if (!user) return;
      const activeWallet = await getActiveWallet(user.uid);
      setWalletBudget(activeWallet?.budget ?? null);
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
  }, [user]);

  useEffect(() => {
    if (!forecastModalOpen || !selectedGoal || !user) return;
    const fetchForecast = async () => {
      setForecastLoading(true);
      setForecastError(null);
      try {
        const goalPayload = {
          id: selectedGoal.id,
          userId: user.uid,
          targetAmount: selectedGoal.targetAmount,
          targetDate: selectedGoal.targetDate,
          attitude: selectedGoal.attitude || "Normal",
        };
        let range = {};
        if (selectedMode === "week" && weekDateRanges[selectedWeek]) {
          range = {
            start: weekDateRanges[selectedWeek].start,
            end: weekDateRanges[selectedWeek].end,
          };
        } else if (selectedMode === "month" && monthDateRanges[selectedMonth]) {
          range = {
            start: monthDateRanges[selectedMonth].start,
            end: monthDateRanges[selectedMonth].end,
          };
        }
        const res = await fetch(
          "https://buck-web-application-1.onrender.com/ai/forecast/",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              goal: goalPayload,
              budget: walletBudget || 0,
              mode: selectedMode,
              ...range,
            }),
          }
        );
        if (!res.ok) throw new Error("Failed to fetch forecast");
        const data = await res.json();
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
      const aiCategory = await getSuggestedCategory(expenseDesc);
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
        .then((allExpenses) =>
          setExpenses(
            allExpenses.filter((expense) => expense.goalId === selectedGoal.id)
          )
        )
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
  }, [user, selectedGoal]);

  const chartRef = useRef<any>(null);

  if (loading || !user || loadingGoals) {
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
              className="nav-button goals-create-btn"
              onClick={() => setShowModal(true)}
            >
              Create Goal
            </button>
          </div>
        </div>
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
      </>
    );
  }

  // User has at least one goal
  return (
    <>
      <div className="GoalsPage">
        <div className="GoalsCard">
          <div className="goals-header">
            <h2>Your Goals</h2>
          </div>
          <div className="goal-buttons-container">
            <button
              className="goals-create-btn"
              onClick={() => setShowModal(true)}
            >
              + Create New Goal
            </button>
            <button className="goals-create-btn" onClick={handleDeleteGoal}>
              - Delete Goal
            </button>
          </div>
          <div className="goals-list">
            {goals.filter(Boolean).map((goal) => (
              <div
                className={`goals-card ${
                  selectedGoal?.id === goal.id ? "selected" : ""
                }`}
                key={goal.id}
                onClick={() => setSelectedGoal(goal)}
                style={{ cursor: "pointer" }}
              >
                <h3>{goal.goalName}</h3>
                <p>
                  <strong>Target:</strong> {formatCurrency(goal.targetAmount)}
                </p>
                <p>
                  <strong>Created:</strong> {goal.createdAt}
                </p>
                {goal.targetDate && (
                  <p>
                    <strong>Due:</strong> {goal.targetDate}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
        <div className="GoalsContainer">
          {selectedGoal ? (
            <>
              <div className="goal-details">
                <div className="goal-details-header">
                  <button className="setActiveButton" onClick={handleSetActive}>
                    {selectedGoal.isActive
                      ? "Set as Inactive"
                      : "Set as Active"}
                  </button>
                </div>
                <h2>Goal Details</h2>
                <div className="goal-details-grid">
                  <p>
                    <strong>Name:</strong> {selectedGoal.goalName}
                  </p>
                  <p>
                    <strong>Target Amount:</strong>{" "}
                    {formatCurrency(selectedGoal.targetAmount)}
                  </p>
                  {selectedGoal.targetDate && (
                    <p>
                      <strong>Target Date:</strong> {selectedGoal.targetDate}
                    </p>
                  )}
                  <p>
                    <strong>Created:</strong> {selectedGoal.createdAt}
                  </p>
                  <p>
                    <strong>Attitude:</strong>{" "}
                    {selectedGoal.attitude || "Normal"}
                  </p>
                  <p>
                    <strong>Status:</strong>
                    {(() => {
                      const currentAmount = selectedGoal.currentAmount || 0;
                      const progressPercentage = Math.min(
                        (currentAmount / selectedGoal.targetAmount) * 100,
                        100
                      );
                      if (progressPercentage >= 100) {
                        return (
                          <span
                            style={{
                              color: "#ffc547",
                              fontWeight: "600",
                              marginLeft: "0.5rem",
                            }}
                          >
                            Completed
                          </span>
                        );
                      } else {
                        return (
                          <span
                            style={{
                              color: selectedGoal.isActive
                                ? "#f47536"
                                : "#ff3838",
                              fontWeight: "600",
                              marginLeft: "0.5rem",
                            }}
                          >
                            {selectedGoal.isActive ? "Active" : "Inactive"}
                          </span>
                        );
                      }
                    })()}
                  </p>
                </div>
                <ProgressBarCard
                  goal={{
                    ...selectedGoal,
                    currentAmount: Math.min(
                      walletBudget || 0,
                      selectedGoal.targetAmount
                    ),
                  }}
                  onAddProgress={() => handleOpenProgressModal(selectedGoal)}
                />
                {aiRecommendation && (
                  <div className="ai-recommendation">
                    <strong>AI Recommendation</strong>
                    <div className="ai-recommendation-content">
                      {aiRecommendation}
                    </div>
                  </div>
                )}
              </div>
              {/* Bottom Button Group outside the card */}
              <div className="goals-bottom-buttons">
                <button
                  className="goals-action-btn"
                  onClick={handleSeeForecast}
                  disabled={
                    forecastLoading || walletBudget == null || !selectedGoal
                  }
                >
                  See Forecast
                </button>
                {forecastModalOpen && (
                  <div
                      className="modal-backdrop"
                      style={{
                      position: "fixed",
                      top: 0,
                      left: 0,
                      width: "100vw",
                      height: "100vh",
                        background: "rgba(18,13,10,0.48)",
                      zIndex: 1000,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <div
                      className="modal"
                      style={{
                        background: modalBackground,
                        color: "var(--buck-ink)",
                        border: "1px solid var(--buck-line)",
                        borderRadius: 8,
                        padding: 24,
                        minWidth: 400,
                        maxWidth: 600,
                        boxShadow: "var(--buck-shadow)",
                        position: "relative",
                      }}
                    >
                      <button
                        onClick={() => setForecastModalOpen(false)}
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
                        &times;
                      </button>
                      <h3
                        style={{
                          marginTop: 0,
                          color: "var(--buck-orange)",
                          textAlign: "center",
                        }}
                      >
                        Forecast
                      </h3>
                      {/* Mode Selector */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "center",
                          gap: 12,
                          marginBottom: 16,
                        }}
                      >
                        <button
                          onClick={() => setSelectedMode("week")}
                          style={{
                            background:
                              selectedMode === "week"
                                ? primaryButtonBackground
                                : softBackground,
                            color:
                              selectedMode === "week"
                                ? primaryButtonColor
                                : "var(--buck-ink)",
                            border: "1px solid var(--buck-line)",
                            borderRadius: 6,
                            padding: "0.5rem 1.2rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Week
                        </button>
                        <button
                          onClick={() => setSelectedMode("month")}
                          style={{
                            background:
                              selectedMode === "month"
                                ? primaryButtonBackground
                                : softBackground,
                            color:
                              selectedMode === "month"
                                ? primaryButtonColor
                                : "var(--buck-ink)",
                            border: "1px solid var(--buck-line)",
                            borderRadius: 6,
                            padding: "0.5rem 1.2rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Month
                        </button>
                        <button
                          onClick={() => setSelectedMode("overall")}
                          style={{
                            background:
                              selectedMode === "overall"
                                ? primaryButtonBackground
                                : softBackground,
                            color:
                              selectedMode === "overall"
                                ? primaryButtonColor
                                : "var(--buck-ink)",
                            border: "1px solid var(--buck-line)",
                            borderRadius: 6,
                            padding: "0.5rem 1.2rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Overall
                        </button>
                      </div>
                      {/* Range Selector */}
                      {selectedMode === "week" && weekDateRanges.length > 0 && (
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "center",
                            gap: 8,
                            marginBottom: 12,
                          }}
                        >
                          <select
                            value={selectedWeek}
                            onChange={(e) =>
                              setSelectedWeek(Number(e.target.value))
                            }
                            style={{
                              padding: "0.3rem 0.7rem",
                              borderRadius: 6,
                              color: "var(--buck-ink)",
                              background: fieldBackground,
                              border: "1px solid rgba(244,117,54,0.32)",
                            }}
                          >
                            {weekDateRanges.map((range, idx) => (
                              <option key={idx} value={idx}>
                                Week {idx + 1}: {range.start} to {range.end}
                              </option>
                            ))}
                          </select>
                        </div>
                      )}
                      {selectedMode === "month" &&
                        monthDateRanges.length > 0 && (
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "center",
                              gap: 8,
                              marginBottom: 12,
                            }}
                          >
                            <select
                              value={selectedMonth}
                              onChange={(e) =>
                                setSelectedMonth(Number(e.target.value))
                              }
                              style={{
                                padding: "0.3rem 0.7rem",
                                borderRadius: 6,
                                color: "var(--buck-ink)",
                                background: fieldBackground,
                                border: "1px solid rgba(244,117,54,0.32)",
                              }}
                            >
                              {monthDateRanges.map((range, idx) => (
                                <option key={idx} value={idx}>
                                  {range.label}: {range.start} to {range.end}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      {/* Progress Bar for Goal */}
                      {selectedGoal && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>
                            Goal Progress
                          </div>
                          <div
                            style={{
                              background: "rgba(244,117,54,0.12)",
                              borderRadius: 8,
                              height: 18,
                              width: "100%",
                              marginBottom: 4,
                            }}
                          >
                            <div
                              style={{
                                background:
                                  "linear-gradient(90deg, #ffc547, #f47536, #ff3838)",
                                height: "100%",
                                borderRadius: 8,
                                width: `${Math.min(
                                  100,
                                  (Math.min(
                                    walletBudget || 0,
                                    selectedGoal.targetAmount
                                  ) /
                                    selectedGoal.targetAmount) *
                                    100
                                )}%`,
                                transition: "width 0.5s",
                              }}
                            ></div>
                          </div>
                          <div style={{ fontSize: 14, color: "var(--buck-muted)" }}>
                            Saved:{" "}
                            {formatCurrency(
                              Math.min(
                                walletBudget || 0,
                                selectedGoal.targetAmount
                              )
                            )}{" "}
                            / {formatCurrency(selectedGoal.targetAmount)}
                          </div>
                        </div>
                      )}
                      {/* AI Forecast Text */}
                      {forecastLoading && <div>Loading forecast...</div>}
                      {forecastError && (
                        <div style={{ color: "red" }}>{forecastError}</div>
                      )}
                      {/* Forecast/Actual Graph */}
                      <div
                        style={{
                          width: "100%",
                          maxWidth: 500,
                          margin: "1rem auto",
                          minHeight: 300,
                          position: "relative",
                        }}
                      >
                        {forecastLoading ? (
                          <div
                            style={{
                              textAlign: "center",
                              color: "var(--buck-orange)",
                              fontWeight: 600,
                            }}
                          >
                            Loading forecast...
                          </div>
                        ) : forecastError ? (
                          <div style={{ color: "red", textAlign: "center" }}>
                            {forecastError}
                          </div>
                        ) : (
                          chartData && (
                            <Line
                              ref={chartRef}
                              data={chartData}
                              options={{
                                responsive: true,
                                maintainAspectRatio: false,
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
                                animation: {
                                  onComplete: () => {
                                    if (chartRef.current) {
                                      chartRef.current.resize();
                                    }
                                  },
                                },
                              }}
                              redraw
                              height={300}
                            />
                          )
                        )}
                      </div>
                      {/* Add Expense Button and Modal */}
                      <div
                        style={{
                          width: "100%",
                          maxWidth: 400,
                          margin: "1rem auto",
                        }}
                      >
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
                            marginBottom: 16,
                            width: "100%",
                          }}
                        >
                          + Add Expense
                        </button>
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
                            }}
                          >
                            <div
                              className="modal"
                              style={{
                                background: modalBackground,
                                color: "var(--buck-ink)",
                                border: "1px solid var(--buck-line)",
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
                                  background: fieldBackground,
                                  fontSize: 17,
                                  boxSizing: "border-box",
                                  display: "block",
                                  color: "var(--buck-ink)",
                                  transition: "border 0.2s",
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
                      </div>
                    </div>
                  </div>
                )}
                <button
                  className="goals-action-btn"
                  onClick={() => {
                    // Use shallow routing to avoid full reload if already on dashboard
                    router.push("/dashboard/statistics");
                  }}
                  aria-label="Go to Statistics"
                >
                  See Statistics
                </button>
              </div>
              {/* Render Recent Expenses */}
              <div style={{ marginTop: 32 }}>
                <h3
                  style={{
                    fontWeight: 700,
                    color: "var(--buck-ink)",
                    marginBottom: 12,
                  }}
                >
                  Recent Expenses
                </h3>
                {expenses.length === 0 ? (
                  <div style={{ color: "var(--buck-muted)" }}>No expenses yet.</div>
                ) : (
                  expenses.map((exp) => (
                    <div
                      key={exp.id}
                      style={{
                        marginBottom: 8,
                        background: softBackground,
                        color: "var(--buck-ink)",
                        border: "1px solid var(--buck-line)",
                        borderRadius: 10,
                        padding: "10px 18px",
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                      }}
                    >
                      <span
                        style={{
                          color: "var(--buck-orange)",
                          fontWeight: 700,
                          minWidth: 120,
                        }}
                      >
                        {exp.category || "Uncategorized"}
                      </span>
                      <span style={{ flex: 1 }}>{exp.description}</span>
                      <span
                        style={{
                          fontWeight: 700,
                          color: "var(--buck-orange)",
                          minWidth: 80,
                        }}
                      >
                        {formatCurrency(exp.amount)}
                      </span>
                      {exp.date && (
                        <span
                          style={{ color: "var(--buck-muted)", fontSize: 14, minWidth: 90 }}
                        >
                          {exp.date}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </>
          ) : (
            <div className="goal-details-placeholder">
              <p>
                Select a goal from the list to see its details and AI
                recommendations
              </p>
            </div>
          )}
        </div>
      </div>
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
      {showProgressModal && progressGoal && (
        <div className="modal-backdrop">
          <div className="modal">
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
                style={{ marginLeft: 8 }}
                onClick={() => setShowProgressModal(false)}
                disabled={progressLoading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {showErrorModal && (
        <div
          className="modal-backdrop"
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
          <div
              className="modal"
              style={{
              background: modalBackground,
              color: "var(--buck-ink)",
              border: "1px solid var(--buck-line)",
              borderRadius: 8,
              padding: 24,
              minWidth: 320,
              maxWidth: 400,
              boxShadow: "var(--buck-shadow)",
              position: "relative",
              textAlign: "center",
            }}
          >
            <button
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
              &times;
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
          </div>
        </div>
      )}
    </>
  );
};

export default GoalsPage;
