"use client";
import React from "react";
import "./style.css";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/component/dashboardheader";
import { useAuthGuard } from "@/utils/useAuthGuard";

const GoalsPage = () => {
  const router = useRouter();
  
  const { user, loading } = useAuthGuard();

  if (loading) return <div>Loading...</div>;
  if (!user) return <div>Redirecting...</div>;


  return (
    <div className="dashboard">
      {/* Sticky Header */}
      <DashboardHeader initialActiveNav="goals" />
      <div className="dashboard-container" style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <div style={{
          background: "#fff",
          borderRadius: "18px",
          boxShadow: "0 6px 32px 0 rgba(239, 138, 87, 0.08)",
          border: "1.5px solid #ffd6b0",
          padding: "3rem 2rem",
          maxWidth: 500,
          textAlign: "center"
        }}>
          <h2 style={{ fontSize: "2rem", fontWeight: 700, color: "#2c3e50", marginBottom: "2rem" }}>
            There are no goals been set.<br />Would you like to create one?
          </h2>
          <button
            className="nav-button"
            style={{ fontSize: "1.1rem", padding: "0.8rem 2.5rem", marginTop: "1.5rem", display: "block", marginLeft: "auto", marginRight: "auto" }}
            onClick={() => router.push("/goals/create")}
          >
            Create Goal
          </button>
        </div>
      </div>
    </div>
  );
};

export default GoalsPage;
