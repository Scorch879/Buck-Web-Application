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
import WeeklySpendingChart from "../statistics/weekly-spending";
import LineGraph from "@/component/line-graph";
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

interface ForecastResult {
  forecast: string;
  recommendation: string;
  [key: string]: any;
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

  const [forecastResult, setForecastResult] = useState<ForecastResult | null>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState<string | null>(null);

  const [forecastModalOpen, setForecastModalOpen] = useState(false);

  const [userWeeklyData, setUserWeeklyData] = useState<number[]>([0,0,0,0,0,0,0]);

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
    if (!selectedGoal) return;
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
    setForecastResult(null);
    setForecastModalOpen(true);
    // Fetch actual user weekly data (example: from 'weeklyData' collection)
    let weeklyData: number[] = [0,0,0,0,0,0,0];
    try {
      const weeklyRef = collection(db, "users", user.uid, "weeklyData");
      const snapshot = await getDocs(weeklyRef);
      if (!snapshot.empty) {
        // Assume each doc has a 'week' field (0-6) and 'amount' field
        snapshot.forEach(doc => {
          const d = doc.data();
          if (typeof d.week === 'number' && typeof d.amount === 'number') {
            weeklyData[d.week] = d.amount;
          }
        });
      }
      setUserWeeklyData(weeklyData);
      // Pass weekly data as history to backend
      const res = await fetch("https://buck-web-application-1.onrender.com/ai/forecast/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          goal: selectedGoal,
          budget: walletBudget,
          history: weeklyData,
        }),
      });
      if (!res.ok) throw new Error("Failed to fetch forecast");
      const data = await res.json();
      setForecastResult(data as ForecastResult);
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
                    <div className="modal" style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 320, maxWidth: 500, boxShadow: '0 2px 16px rgba(0,0,0,0.2)', position: 'relative' }}>
                      <button onClick={() => setForecastModalOpen(false)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>&times;</button>
                      <h3 style={{ marginTop: 0 }}>Forecast</h3>
                      <div style={{ marginBottom: 16 }}>
                        <ProgressBarCard goal={selectedGoal!} onAddProgress={handleOpenProgressModal} />
                      </div>
                      <div style={{ marginBottom: 16 }}>
                        <LineGraph data={userWeeklyData} yMax={Math.max(...userWeeklyData, 200)} />
                      </div>
                      {forecastLoading && <div>Loading...</div>}
                      {forecastError && <div style={{ color: 'red' }}>{forecastError}</div>}
                      {forecastResult && (
                        <>
                          <div style={{ marginTop: 12, marginBottom: 8 }}><strong>AI Forecast:</strong><br />{forecastResult.forecast}</div>
                          <div style={{ marginTop: 8, color: '#555' }}><strong>Recommendation:</strong><br />{forecastResult.recommendation}</div>
                        </>
                      )}
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
    </div>
  );
};

export default GoalsPage;