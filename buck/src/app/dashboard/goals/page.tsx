"use client";
import React, { useEffect, useState } from "react";
import "./style.css";
import "./progress-bar.css";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/component/dashboardheader";
import { useAuthGuard } from "@/utils/useAuthGuard";
import { db } from "@/utils/firebase";
import { collection, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import CreateGoalModal from "./CreateGoalModal";
import { deleteGoal, updateGoalStatus, setOnlyGoalActive } from "@/component/goals";
import ProgressBarCard from "./ProgressBarCard";
import { getSavingTip } from "@/utils/aiApi";
import { Line } from 'react-chartjs-2';
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

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

// --- Goal interface for type safety ---
interface Goal {
  id: string;
  goalName: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string;
  createdAt: string;
  attitude?: string;
  isActive?: boolean;
}

const GoalsPage = () => {
  const router = useRouter();
  const { user, loading } = useAuthGuard();
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
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorModalMessage, setErrorModalMessage] = useState("");

  const [selectedMode, setSelectedMode] = useState<'week' | 'month' | 'overall'>('week');
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
      const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
      monthDateRanges.push({
        start: monthStart.toISOString().slice(0, 10),
        end: monthEnd.toISOString().slice(0, 10),
        label: monthStart.toLocaleString('default', { month: 'long', year: 'numeric' })
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
        // Allocate wallet budget to this goal
        try {
          // Fetch active wallet ID from user doc
          const userDocRef = doc(db, "users", user.uid);
          const userDocSnap = await getDoc(userDocRef);
          if (!userDocSnap.exists()) throw new Error("User doc not found");
          const activeWalletId = userDocSnap.data().activeWallet;
          if (!activeWalletId) throw new Error("No active wallet");
          const walletDocRef = doc(db, "wallets", user.uid, "userWallets", activeWalletId);
          const walletDocSnap = await getDoc(walletDocRef);
          if (!walletDocSnap.exists()) throw new Error("Wallet doc not found");
          const walletAmount = walletDocSnap.data().budget || 0;
          // Update goal's currentAmount, but cap at targetAmount
          const goalTarget = selectedGoal.targetAmount;
          const amountToAllocate = Math.min(walletAmount, goalTarget);
          const goalRef = doc(db, "goals", user.uid, "userGoals", selectedGoal.id);
          await updateDoc(goalRef, { currentAmount: amountToAllocate });
          // Subtract only the allocated amount from wallet
          const newWalletAmount = walletAmount - amountToAllocate;
          await updateDoc(walletDocRef, { budget: newWalletAmount });
          setWalletBudget(newWalletAmount);
          setGoals(
            goals.map((goal) =>
              goal.id === selectedGoal.id
                ? { ...goal, isActive: true, currentAmount: amountToAllocate }
                : { ...goal, isActive: false }
            )
          );
          setSelectedGoal({ ...selectedGoal, isActive: true, currentAmount: amountToAllocate });
        } catch (err) {
          if (err instanceof Error) {
            alert("Failed to allocate wallet to goal: " + err.message);
          } else {
            alert("Failed to allocate wallet to goal: Unknown error");
          }
        }
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
    try {
      const goalRef = doc(db, "goals", user.uid, "userGoals", progressGoal.id);
      await updateDoc(goalRef, { currentAmount: newAmount });
      // Update local state
      setGoals(goals =>
        goals.map(goal =>
          goal.id === progressGoal.id
            ? { ...goal, currentAmount: newAmount }
            : goal
        )
      );
      // If the selected goal is the one updated, update it too
      if (selectedGoal && selectedGoal.id === progressGoal.id) {
        setSelectedGoal({ ...selectedGoal, currentAmount: newAmount });
      }
      setShowProgressModal(false);
    } catch (err) {
      alert("Failed to update progress.");
    } finally {
      setProgressLoading(false);
    }
  };

  const handleSeeForecast = async () => {
    if (!selectedGoal || walletBudget == null || !user) return;
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
        attitude: selectedGoal.attitude || "Normal"
      };
      const res = await fetch("https://buck-web-application-1.onrender.com/ai/forecast/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: goalPayload,
          budget: walletBudget,
        }),
      });
      if (!res.ok) throw new Error("Failed to fetch forecast");
      const data = await res.json();
      setForecastData(data);
      // Save AI recommended budget to Firestore if present
      if (data. ai_recommended_budget && selectedGoal && user) {
        const goalRef = doc(db, "goals", user.uid, "userGoals", selectedGoal.id);
        await updateDoc(goalRef, { aiRecommendedBudget: data.ai_recommended_budget });
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
        const goalsRef = collection(db, "goals", user.uid, "userGoals");
        const snapshot = await getDocs(goalsRef);
        setGoals(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Goal)));
        setLoadingGoals(false);
      }
    };
    fetchGoals();
  }, [user]);

  useEffect(() => {
    let didCancel = false;
    let timeoutId: NodeJS.Timeout;
    if (selectedGoal) {
      setAIRecommendation("Loading AI recommendation...");
      // Timeout promise
      const timeoutPromise = new Promise<string>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("timeout")), 15000); // 15 seconds
      });
      // Add multiplier to user_context
      const attitude = selectedGoal.attitude || "Normal";
      let multiplier = 1.0;
      if (attitude === "Moderate") multiplier = 0.8;
      if (attitude === "Aggressive") multiplier = 0.6;
      const userContext = `Attitude: ${attitude} (multiplier: ${multiplier}), Target Amount: ${selectedGoal.targetAmount}`;
      // Race the fetch and the timeout
      Promise.race([
        getSavingTip(
          selectedGoal.goalName,
          userContext,
          selectedGoal.targetDate,
          selectedGoal.createdAt
        ),
        timeoutPromise
      ])
        .then((tip) => {
          if (!didCancel) setAIRecommendation(typeof tip === 'string' ? tip : "");
        })
        .catch(() => {
          if (!didCancel) setAIRecommendation("Failed to fetch AI recommendation.");
        })
        .finally(() => {
          clearTimeout(timeoutId);
        });
    } else {
      setAIRecommendation(null);
    }
    return () => {
      didCancel = true;
      clearTimeout(timeoutId);
    };
  }, [selectedGoal]);

  useEffect(() => {
    const fetchWalletBudget = async () => {
      if (!user) return;
      // Fetch active wallet ID from user doc
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) return;
      const activeWalletId = userDocSnap.data().activeWallet;
      if (!activeWalletId) return;
      // Fetch wallet doc
      const walletDocRef = doc(db, "wallets", user.uid, "userWallets", activeWalletId);
      const walletDocSnap = await getDoc(walletDocRef);
      if (!walletDocSnap.exists()) return;
      setWalletBudget(walletDocSnap.data().budget || null);
    };
    fetchWalletBudget();
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
          attitude: selectedGoal.attitude || "Normal"
        };
        let range = {};
        if (selectedMode === 'week' && weekDateRanges[selectedWeek]) {
          range = { start: weekDateRanges[selectedWeek].start, end: weekDateRanges[selectedWeek].end };
        } else if (selectedMode === 'month' && monthDateRanges[selectedMonth]) {
          range = { start: monthDateRanges[selectedMonth].start, end: monthDateRanges[selectedMonth].end };
        }
        const res = await fetch('https://buck-web-application-1.onrender.com/ai/forecast/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: goalPayload,
            budget: walletBudget || 0,
            mode: selectedMode,
            ...range
          })
        });
        if (!res.ok) throw new Error('Failed to fetch forecast');
        const data = await res.json();
        setForecastData(data);
        // Save AI recommended budget to Firestore if present
        if (data.ai_recommended_budget && selectedGoal && user) {
          const goalRef = doc(db, "goals", user.uid, "userGoals", selectedGoal.id);
          await updateDoc(goalRef, { aiRecommendedBudget: data.ai_recommended_budget });
        }
      } catch (err: any) {
        setForecastError(err.message || 'Unknown error');
      } finally {
        setForecastLoading(false);
      }
    };
    fetchForecast();
  }, [forecastModalOpen, selectedGoal, user, walletBudget, selectedMode, selectedWeek, selectedMonth]);

  // Add expense handler for modal
  const handleAddExpense = async () => {
    if (!user || !selectedGoal) return;
    const expenseValue = parseFloat(expenseAmount);
    if (isNaN(expenseValue) || expenseValue <= 0) {
      setErrorModalMessage('Please enter a valid expense amount.');
      setShowErrorModal(true);
      return;
    }
    if (walletBudget === null || walletBudget <= 0) {
      setErrorModalMessage('You have no money in your wallet. Please add funds before adding expenses.');
      setShowErrorModal(true);
      return;
    }
    if (expenseValue > walletBudget) {
      setErrorModalMessage('Expense exceeds your wallet balance. Please enter a smaller amount.');
      setShowErrorModal(true);
      return;
    }
    setExpenseLoading(true);
    setExpenseError('');
    try {
      const res = await fetch('https://buck-web-application-1.onrender.com/expenses/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.uid,
          goal_id: selectedGoal.id,
          date: expenseDate,
          amount: expenseValue,
          description: expenseDesc
        })
      });
      if (!res.ok) throw new Error('Failed to add expense');
      // Subtract from wallet in Firestore
      // Fetch active wallet ID from user doc
      const userDocRef = doc(db, "users", user.uid);
      const userDocSnap = await getDoc(userDocRef);
      if (!userDocSnap.exists()) throw new Error("User doc not found");
      const activeWalletId = userDocSnap.data().activeWallet;
      if (!activeWalletId) throw new Error("No active wallet");
      const walletDocRef = doc(db, "wallets", user.uid, "userWallets", activeWalletId);
      const walletDocSnap = await getDoc(walletDocRef);
      if (!walletDocSnap.exists()) throw new Error("Wallet doc not found");
      const walletAmount = walletDocSnap.data().budget || 0;
      const newWalletAmount = walletAmount - expenseValue;
      await updateDoc(walletDocRef, { budget: newWalletAmount });
      setWalletBudget(newWalletAmount);
      setShowExpenseModal(false);
      setExpenseDate('');
      setExpenseAmount('');
      setExpenseDesc('');
      // Refresh forecast/actual data
      const goalPayload = {
        id: selectedGoal.id,
        userId: user.uid,
        targetAmount: selectedGoal.targetAmount,
        targetDate: selectedGoal.targetDate,
        attitude: selectedGoal.attitude || "Normal"
      };
      const fetchForecast = async () => {
        const res = await fetch('https://buck-web-application-1.onrender.com/ai/forecast/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: goalPayload,
            budget: newWalletAmount || 0
          })
        });
        if (res.ok) {
          const data = await res.json();
          setForecastData(data);
        }
      };
      fetchForecast();
    } catch (err) {
      if (err instanceof Error) {
        setExpenseError(err.message);
      } else {
        setExpenseError('Unknown error');
      }
    } finally {
      setExpenseLoading(false);
    }
  };

  // Prepare data for Chart.js (Spending Report style)
  let chartData = null;
  if (forecastData && forecastData.forecast_per_day) {
    const labels = Object.keys(forecastData.forecast_per_day);
    const forecastVals = labels.map(d => forecastData.forecast_per_day[d]);
    const actualVals = labels.map(d => (forecastData.actual_per_day && forecastData.actual_per_day[d]) || 0);
    chartData = {
      labels,
      datasets: [
        {
          label: 'Forecasted Daily Expense',
          data: forecastVals,
          borderColor: '#ef8a57',
          backgroundColor: 'rgba(239,138,87,0.15)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#ef8a57',
          pointBorderColor: '#ef8a57',
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3,
        },
        {
          label: 'Actual Daily Expense',
          data: actualVals,
          borderColor: '#3498db',
          backgroundColor: 'rgba(52,152,219,0.15)',
          fill: true,
          tension: 0.4,
          pointBackgroundColor: '#3498db',
          pointBorderColor: '#3498db',
          pointRadius: 4,
          pointHoverRadius: 6,
          borderWidth: 3,
        }
      ]
    };
  }

  if (loading || !user || loadingGoals) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <div className="loading-text">Loading Buck...</div>
      </div>
    );
  }

  if (goals.length === 0) {
    // No goals set
    return (
      <div className="dashboard">
        <DashboardHeader initialActiveNav="goals" />
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
      </div>
    );
  }

  // User has at least one goal
  return (
    <div className="dashboard">
      <DashboardHeader initialActiveNav="goals" />
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
                className={`goals-card ${selectedGoal?.id === goal.id ? "selected" : ""}`}
                key={goal.id}
                onClick={() => setSelectedGoal(goal)}
                style={{ cursor: "pointer" }}
              >
                <h3>{goal.goalName}</h3>
                <p>
                  <strong>Target:</strong> ${goal.targetAmount}
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
                    {selectedGoal.isActive ? "Set as Inactive" : "Set as Active"}
                  </button>
                </div>
                <h2>Goal Details</h2>
                <div className="goal-details-grid">
                  <p>
                    <strong>Name:</strong> {selectedGoal.goalName}
                  </p>
                  <p>
                    <strong>Target Amount:</strong> ${selectedGoal.targetAmount}
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
                    <strong>Attitude:</strong> {selectedGoal.attitude || "Normal"}
                  </p>
                  <p>
                    <strong>Status:</strong>
                    <span
                      style={{
                        color: selectedGoal.isActive ? "#27ae60" : "#e74c3c",
                        fontWeight: "600",
                        marginLeft: "0.5rem",
                      }}
                    >
                      {selectedGoal.isActive ? "Active" : "Inactive"}
                    </span>
                  </p>
                </div>
                <ProgressBarCard
                  goal={selectedGoal}
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
                <button className="goals-action-btn" onClick={handleSeeForecast} disabled={forecastLoading || walletBudget == null || !selectedGoal}>
                  See Forecast
                </button>
                {forecastModalOpen && (
                  <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal" style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 400, maxWidth: 600, boxShadow: '0 2px 16px rgba(0,0,0,0.2)', position: 'relative' }}>
                      <button onClick={() => setForecastModalOpen(false)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>&times;</button>
                      <h3 style={{ marginTop: 0, color: '#ef8a57', textAlign: 'center' }}>Forecast</h3>
                      {/* Mode Selector */}
                      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 16 }}>
                        <button onClick={() => setSelectedMode('week')} style={{ background: selectedMode === 'week' ? '#ef8a57' : '#eee', color: selectedMode === 'week' ? '#fff' : '#333', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Week</button>
                        <button onClick={() => setSelectedMode('month')} style={{ background: selectedMode === 'month' ? '#ef8a57' : '#eee', color: selectedMode === 'month' ? '#fff' : '#333', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Month</button>
                        <button onClick={() => setSelectedMode('overall')} style={{ background: selectedMode === 'overall' ? '#ef8a57' : '#eee', color: selectedMode === 'overall' ? '#fff' : '#333', border: 'none', borderRadius: 6, padding: '0.5rem 1.2rem', fontWeight: 600, cursor: 'pointer' }}>Overall</button>
                      </div>
                      {/* Range Selector */}
                      {selectedMode === 'week' && weekDateRanges.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                          <select value={selectedWeek} onChange={e => setSelectedWeek(Number(e.target.value))} style={{ padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #ccc' }}>
                            {weekDateRanges.map((range, idx) => (
                              <option key={idx} value={idx}>Week {idx + 1}: {range.start} to {range.end}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {selectedMode === 'month' && monthDateRanges.length > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 12 }}>
                          <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))} style={{ padding: '0.3rem 0.7rem', borderRadius: 6, border: '1px solid #ccc' }}>
                            {monthDateRanges.map((range, idx) => (
                              <option key={idx} value={idx}>{range.label}: {range.start} to {range.end}</option>
                            ))}
                          </select>
                        </div>
                      )}
                      {/* Progress Bar for Goal */}
                      {selectedGoal && (
                        <div style={{ marginBottom: 16 }}>
                          <div style={{ fontWeight: 600, marginBottom: 4 }}>Goal Progress</div>
                          <div style={{ background: '#eee', borderRadius: 8, height: 18, width: '100%', marginBottom: 4 }}>
                            <div style={{ background: '#ef8a57', height: '100%', borderRadius: 8, width: `${Math.min(100, ((selectedGoal.currentAmount || 0) / selectedGoal.targetAmount) * 100)}%`, transition: 'width 0.5s' }}></div>
                          </div>
                          <div style={{ fontSize: 14, color: '#555' }}>Saved: ₱{selectedGoal.currentAmount || 0} / ₱{selectedGoal.targetAmount}</div>
                        </div>
                      )}
                      {/* AI Forecast Text */}
                      {forecastLoading && <div>Loading forecast...</div>}
                      {forecastError && <div style={{ color: 'red' }}>{forecastError}</div>}
                      {forecastData && forecastData.forecast && <div style={{ margin: '12px 0', fontWeight: 500, color: '#2c3e50', textAlign: 'center' }}>{forecastData.forecast}</div>}
                      {/* Forecast/Actual Graph */}
                      <div style={{ width: '100%', maxWidth: 500, margin: '1rem auto' }}>
                        {chartData && <Line data={chartData} options={{
                          responsive: true,
                          plugins: {
                            legend: { display: true, position: 'top' },
                            tooltip: {
                              callbacks: {
                                label: function(context) {
                                  const value = Number(context.raw);
                                  return `${context.dataset.label}: ${value}`;
                                }
                              }
                            }
                          },
                          scales: {
                            x: { grid: { display: false }, ticks: { color: '#2c3e50', font: { weight: 600 } } },
                            y: {
                              grid: { color: '#eee' },
                              beginAtZero: true,
                              ticks: { color: '#2c3e50' },
                            },
                          },
                        }} />}
                      </div>
                      {/* Add Expense Button and Modal */}
                      <div style={{ width: '100%', maxWidth: 400, margin: '1rem auto' }}>
                        <button onClick={() => setShowExpenseModal(true)} style={{ background: '#ef8a57', color: '#fff', border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem', fontWeight: 600, fontSize: 16, cursor: 'pointer', marginBottom: 16, width: '100%' }}>
                          + Add Expense
                        </button>
                        {showExpenseModal && (
                          <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <div className="modal" style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 320, maxWidth: 400, boxShadow: '0 2px 16px rgba(0,0,0,0.2)', position: 'relative' }}>
                              <button onClick={() => setShowExpenseModal(false)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>&times;</button>
                              <h3 style={{ marginTop: 0 }}>Add Expense</h3>
                              <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} style={{ width: '100%', marginBottom: 12, padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
                              <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="Amount" style={{ width: '100%', marginBottom: 12, padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
                              <input type="text" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} placeholder="Description" style={{ width: '100%', marginBottom: 12, padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
                              {expenseError && <div style={{ color: 'red', marginBottom: 8 }}>{expenseError}</div>}
                              <button onClick={handleAddExpense} disabled={expenseLoading} style={{ background: '#ef8a57', color: '#fff', border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem', fontWeight: 600, fontSize: 16, cursor: 'pointer', width: '100%' }}>
                                {expenseLoading ? 'Adding...' : 'Add Expense'}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <button className="goals-action-btn">See Statistics</button>
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
              onChange={e => setProgressInput(e.target.value)}
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
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal" style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 320, maxWidth: 400, boxShadow: '0 2px 16px rgba(0,0,0,0.2)', position: 'relative', textAlign: 'center' }}>
            <button onClick={() => setShowErrorModal(false)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>&times;</button>
            <h3 style={{ marginTop: 0, color: '#e74c3c' }}>Action Not Allowed</h3>
            <div style={{ margin: '18px 0', fontWeight: 500, color: '#2c3e50', fontSize: 17 }}>{errorModalMessage}</div>
            <button onClick={() => setShowErrorModal(false)} style={{ background: '#ef8a57', color: '#fff', border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem', fontWeight: 600, fontSize: 16, cursor: 'pointer', width: '100%' }}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoalsPage;