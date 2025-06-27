"use client";
import React from "react";
import "./style.css";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/component/dashboardheader";
import { useAuthGuard } from "@/utils/useAuthGuard";

const Statistics = () => {
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
      <DashboardHeader initialActiveNav="statistics" />
      <div
        className="dashboard-container"
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "18px",
            boxShadow: "0 6px 32px 0 rgba(239, 138, 87, 0.08)",
            border: "1.5px solid #ffd6b0",
            padding: "3rem 2rem",
            maxWidth: 500,
            textAlign: "center",
          }}
        >
          <h2
            style={{
              fontSize: "2rem",
              fontWeight: 700,
              color: "#2c3e50",
              marginBottom: "2rem",
            }}
          >
            What the Buck?!
            <br />
            You dont have any goals yet.
            <br />
            Would you like to create one?
          </h2>
          <button
            className="nav-button"
            style={{
              fontSize: "1.1rem",
              padding: "0.8rem 2.5rem",
              marginTop: "1.5rem",
              display: "block",
              marginLeft: "auto",
              marginRight: "auto",
            }}
            onClick={() => router.push("/dashboard/goals/create")}
          >
            Create Goal
          </button>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
