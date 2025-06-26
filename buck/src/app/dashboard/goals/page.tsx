"use client";
import React, { useEffect, useState } from "react";
import "./style.css";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/component/dashboardheader";
import { useAuthGuard } from "@/utils/useAuthGuard";
import { isUserGoalsEmpty } from "@/component/goals";

const GoalsPage = () => {
  const router = useRouter();
  const { user, loading } = useAuthGuard();
  const [goalsEmpty, setGoalsEmpty] = useState<boolean | null>(null);

  useEffect(() => {
    if (user) {
      isUserGoalsEmpty().then(setGoalsEmpty);
    }
  }, [user]);

  if (loading || !user || goalsEmpty === null) {
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
            {/* Render your goals list here */}
          </div>
        </div>
      </div>
    );
  }
};

export default GoalsPage;