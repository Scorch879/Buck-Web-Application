"use client";
import React from "react";
import "./style.css";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/component/dashboardheader";
import { useAuthGuard } from "@/utils/useAuthGuard";

const GoalsPage = () => {
  const router = useRouter();

  const { user, loading } = useAuthGuard();
  if (loading || !user) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <div className="loading-text">Loading Buck...</div>
      </div>
    );
  }

  return (
    <div className="dashboard">
      {/* Sticky Header */}
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
};

export default GoalsPage;
