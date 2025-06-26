"use client";
import React, { useState } from "react";
import DashboardHeader from "@/component/dashboardheader";
import "../create/style.css";

const CreateGoalPage = () => {
  const [goalName, setGoalName] = useState("");
  const [targetAmount, setTargetAmount] = useState("");
  const [Attitude, setAttitude] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    // Simulate API call
    setTimeout(() => {
      setSubmitting(false);
      setSuccess(true);
      setGoalName("");
      setTargetAmount("");
      setAttitude("");
    }, 1200);
  };

  return (
    <div className="dashboard">
      <DashboardHeader initialActiveNav="goals" />
      <div className="dashboard-container create-goal-center">
        <div className="create-goal-container">
          <h2 className="create-goal-title">
            Create a New Goal
          </h2>
          {success && (
            <div className="create-goal-success">
              Goal created successfully!
            </div>
          )}
          <form onSubmit={handleSubmit} className="create-goal-form">
            <input
              type="text"
              placeholder="Goal Name"
              value={goalName}
              onChange={e => setGoalName(e.target.value)}
              required
              className="create-goal-input"
            />
            <input
              type="number"
              placeholder="Budget   "
              value={targetAmount}
              onChange={e => setTargetAmount(e.target.value)}
              required
              min={1}
              className="create-goal-input"
            />
            <input 
              type="text" 
              placeholder="Spending Attitude    "
              value={Attitude}
              onChange={e => setAttitude(e.target.value)}
              required
              className="create-goal-input"
            />
            <button
              type="submit"
              className={`nav-button create-goal-button${submitting ? ' create-goal-button-disabled' : ''}`}
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Goal"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateGoalPage;
