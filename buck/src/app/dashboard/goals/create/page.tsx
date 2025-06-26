"use client";
import React, { use, useState } from "react";
import DashboardHeader from "@/component/dashboardheader";
import "../create/style.css";

const CreateGoalPage = () => {

  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);


  const [form, setForm] = useState({
    goalName: "",
    targetAmount: "",
    Attitude: "",
  });


  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.id]: e.target.value });
  };


  const handleGoalCreate = async (e: React.FormEvent) => {
     e.preventDefault(); 
    if (
      !form.goalName.trim() ||
      !form.Attitude.trim() ||
      !form.targetAmount.trim()
    ) {
      console.log("Fill in all fields")//someone change this to setError like signin/signup
      return;
    }
    console.log(form.goalName);
    console.log(form.targetAmount);
    console.log(form.Attitude);
  }

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
          <form onSubmit={handleGoalCreate} className="create-goal-form">
            <input
              id="goalName"
              type="text"
              placeholder="Goal Name"
              value={form.goalName}
              onChange={handleChange}
              required
              className="create-goal-input"
            />
            <input
              id="targetAmount"
              type="number"
              placeholder="Budget   "
              value={form.targetAmount}
              onChange={handleChange}
              required
              min={1}
              className="create-goal-input"
            />
            <input
              id="Attitude"
              type="text"
              placeholder="Spending Attitude    "
              value={form.Attitude}
              onChange={handleChange}
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
