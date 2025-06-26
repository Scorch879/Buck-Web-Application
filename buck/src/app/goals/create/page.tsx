"use client";
import React from "react";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/component/dashboardheader";

const CreateGoalPage = () => {
  const router = useRouter();

  return (
    <div className="dashboard">
      <DashboardHeader />
      <div style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        minHeight: "80vh",
        background: "linear-gradient(135deg, #f9c390 0%, #f6a96b 100%)"
      }}>
        <div style={{
          background: "#fff",
          borderRadius: "18px",
          boxShadow: "0 6px 32px 0 rgba(239, 138, 87, 0.08)",
          border: "1.5px solid #ffd6b0",
          padding: "3rem 2rem",
          maxWidth: 600,
          width: "90%",
          textAlign: "center"
        }}>
          <h2 style={{ fontSize: "2rem", fontWeight: 700, color: "#2c3e50", marginBottom: "2rem" }}>
            Create New Goal
          </h2>
          {/* Content for creating a goal would go here */}
          <p>This is where you can create your new goal.</p>
          <button
            className="nav-button"
            style={{ fontSize: "1.1rem", padding: "0.8rem 2.5rem", marginTop: "1.5rem", display: "block", marginLeft: "auto", marginRight: "auto" }}
            onClick={() => router.push("/dashboard/goals")}
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
};

export default CreateGoalPage; 