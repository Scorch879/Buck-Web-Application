"use client";
import React, { useEffect, useState } from "react";
import "./style.css";
import "./progress-bar.css";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/component/dashboardheader";
import { useAuthGuard } from "@/utils/useAuthGuard";
import { db } from "@/utils/firebase";
import { collection, getDocs } from "firebase/firestore";
import CreateGoalModal from "./CreateGoalModal";
import { deleteGoal } from "@/component/goals";
import { getSavingTip } from "@/utils/aiApi";
import { updateGoalStatus, setOnlyGoalActive } from "@/component/goals";
import ProgressBarCard from "./ProgressBarCard";

const GoalsPage = () => {
  const router = useRouter();
  const { user, loading } = useAuthGuard();
  const [goals, setGoals] = useState<any[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);
  const [aiRecommendation, setAIRecommendation] = useState<string | null>(null);

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
        setGoals(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
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
      // Race the fetch and the timeout
      Promise.race([
        getSavingTip(
          selectedGoal.goalName,
          `Attitude: ${selectedGoal.attitude || "Normal"}, Target Amount: ${selectedGoal.targetAmount}`
        ),
        timeoutPromise
      ])
        .then((tip) => {
          if (!didCancel) setAIRecommendation(typeof tip === 'string' ? tip : "");
        })
        .catch((err) => {
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
                className={`goals-card ${
                  selectedGoal?.id === goal.id ? "selected" : ""
                }`}
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
                {selectedGoal && <ProgressBarCard goal={selectedGoal} />}
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
                <button className="goals-action-btn">See Forecast</button>
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
    </div>
  );
};

export default GoalsPage;
