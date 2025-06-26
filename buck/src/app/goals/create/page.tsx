"use client";
import React from "react";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/component/dashboardheader";
import "./style.css";

const CreateGoal = () => {
  const router = useRouter();
  return (
    <div className="create-goal-overlay">
      {/* Header stays unblurred */}
      <DashboardHeader initialActiveNav="goals" />
      {/* Blurred background except header */}
      <div className="create-goal-blur-bg" />
      {/* Centered white panel */}
      <div className="create-goal-panel">
        <button className="back-button" onClick={() => router.back()}>
          ← Back
        </button>
        <h2 style={{ marginTop: "1.5rem" }}>Create a New Goal</h2>
        {/* Add your form or content here */}
      </div>
    </div>
  );
};

export default CreateGoal;
