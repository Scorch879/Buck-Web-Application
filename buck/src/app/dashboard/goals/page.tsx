"use client";
import React, { useEffect, useState } from "react";
import "./style.css";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/component/dashboardheader";
import { useAuthGuard } from "@/utils/useAuthGuard";
import { db } from "@/utils/firebase";
import { collection, getDocs } from "firebase/firestore";
import CreateGoalModal from "./CreateGoalModal";


const GoalsPage = () => {
  const router = useRouter();
  const { user, loading } = useAuthGuard();
  const [goals, setGoals] = useState<any[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<any | null>(null);

  useEffect(() => {
    const fetchGoals = async () => {
      if (user) {
        setLoadingGoals(true);
        const goalsRef = collection(db, "goals", user.uid, "userGoals");
        const snapshot = await getDocs(goalsRef);
        setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoadingGoals(false);
      }
    };
    fetchGoals();
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
        <div className="dashboard-container goals-center">
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
            onGoalCreated={newGoal => {
              setShowModal(false);
              setGoals(prev => [...prev, newGoal]);
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
            <h2>Here are your Goals!</h2>
          </div>
          <button
            className="nav-button goals-create-btn"
            onClick={() => setShowModal(true)}
          >
            Create Goal
          </button>
          <div className="goals-list">
            {goals.filter(Boolean).map(goal => (
              <div
                className="goals-card"
                key={goal.id}
                onClick={() => setSelectedGoal(goal)}
                style={{ cursor: "pointer" }}
              >
                <h3>{goal.goalName}</h3>
                <p>Target Amount: {goal.targetAmount}</p>
                <p>
                  Created:{" "}
                  {goal.createdAt}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className="GoalsContainer">
          <div className="GoalsContainer">
            {selectedGoal ? (
              <div className="goal-details">
                <h2>Goal Details</h2>
                <p><strong>Name:</strong> {selectedGoal.goalName}</p>
                <p><strong>Target Amount:</strong> {selectedGoal.targetAmount}</p>
                <p><strong>Target Date:</strong> {selectedGoal.targetDate}</p>
                <p><strong>Created:</strong> {selectedGoal.createdAt}</p>
              </div>
            ) : (
              <div className="goal-details-placeholder">
                <p>Select a goal to see its details.</p>
              </div>
            )}
          </div>
        </div>
      </div>
      {showModal && (
        <CreateGoalModal
          onClose={() => setShowModal(false)}
          onGoalCreated={newGoal => {
            setShowModal(false);
            setGoals(prev => [...prev, newGoal]);
            setSelectedGoal(newGoal);
          }}
        />
      )}
    </div>
  );
};

export default GoalsPage;