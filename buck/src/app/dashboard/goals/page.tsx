"use client";
import React, { useEffect, useState } from "react";
import "./style.css";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/component/dashboardheader";
import { useAuthGuard } from "@/utils/useAuthGuard";
import { isUserGoalsEmpty } from "@/component/goals";
import { db } from "@/utils/firebase";
import { collection, getDocs } from "firebase/firestore";

const GoalsPage = () => {
  const router = useRouter();
  const { user, loading } = useAuthGuard();
  const [goalsEmpty, setGoalsEmpty] = useState<boolean | null>(null);
  const [goals, setGoals] = useState<any[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);

  useEffect(() => {
    if (user) {
      isUserGoalsEmpty().then(setGoalsEmpty);
    }
  }, [user]);

  useEffect(() => {
    const fetchGoals = async () => {
      if (user && goalsEmpty === false) {
        setLoadingGoals(true);
        const goalsRef = collection(db, "goals", user.uid, "userGoals");
        const snapshot = await getDocs(goalsRef);
        setGoals(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoadingGoals(false);
      }
    };
    fetchGoals();
  }, [user, goalsEmpty]);

  if (loading || !user || goalsEmpty === null || (goalsEmpty === false && loadingGoals)) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <div className="loading-text">Loading Buck...</div>
      </div>
    );
  }

  if (goalsEmpty) {
    // No goals set
    return (
      <div className="dashboard">
        <DashboardHeader initialActiveNav="goals" />
        <div className="dashboard-container goals-center">
          <div className="goals-card">
            <h2 className="goals-title">
              There are no goals been set.
              <br />
              Would you like to create one?
            </h2>
            <button
              className="nav-button goals-create-btn"
              onClick={() => router.push("/dashboard/goals/create")}
            >
              Create Goal
            </button>
          </div>
        </div>
      </div>
    );
  } else {
    // User has at least one goal
    return (
      <div className="dashboard">
        <DashboardHeader initialActiveNav="goals" />
        <div className="dashboard-container goals-center">
          <div className="goals-card">
            <h2 className="goals-title">
              Here are your goals!
            </h2>
            <div className="goals-list">
              {goals.map(goal => (
                <div className="goals-card" key={goal.id}>
                  <h3>{goal.goalName}</h3>
                  <p>Target Amount: {goal.targetAmount}</p>
                  <p>
                    Created:{" "}
                    {goal.createdAt?.toDate
                      ? goal.createdAt.toDate().toLocaleString()
                      : String(goal.createdAt)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }
};

export default GoalsPage;