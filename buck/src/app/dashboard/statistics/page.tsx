"use client";
import React, { useState } from "react";
import "./style.css";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/component/dashboardheader";
import { useAuthGuard } from "@/utils/useAuthGuard";
import WeeklySpendingChart from "./weekly-spending";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import ExcessPie from "./excess-pie";
import SpendingBar from "./spending-bar";


ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

const Statistics = () => {
  const router = useRouter();
  const { user, loading } = useAuthGuard();
  const [yMax, setYMax] = useState(1000);

  if (loading || !user) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <div className="loading-text">Loading Buck...</div>
      </div>
    );
  }

    //Test Variables
  let mon, tue, wed, thu, fri, sat, sun;

  mon = 1000; // Example value for Monday
  tue = 800; // Example value for Tuesday
  wed = 600; // Example value for Wednesday
  thu = 1200; // Example value for Thursday
  fri = 900; // Example value for Friday
  sat = 1100; // Example value for Saturday
  ///


  let maxBudgetPerDay = 1000;
  
  let totalExpenses = [mon, tue, wed, thu, fri, sat, sun]; // Example expenses for each day of the week

  const saved = [0, 0, 0, 0, 0, 0, 0];

  for (let i = 0; i < saved.length; i++) {
    const expense = totalExpenses[i];
    if (expense == undefined) {
      saved[i] = maxBudgetPerDay; // If no expense, assume full budget saved
      continue;
    }
    saved[i] = maxBudgetPerDay - expense;
  }

  let totalSpending = 0;
  let totalSavings = 0;
  for (let i = 0; i < saved.length; i++) {
    const expense = totalExpenses[i] ?? 0;
    totalSpending += expense;
    totalSavings += saved[i] ?? 0;
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
        {/* Panels Container */}
        <div className="statistics-panels-container">
          {/* First row: Pie chart and Bar graph */}
          <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
              <ExcessPie spending={totalSpending} savings={totalSavings} />
            </div>
            <SpendingBar />
          </div>

          {/* Second row: Line graph and Empty goals popup */}
          <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start", marginTop: "2rem" }}>
            <div className="graph-panel">
              <div className="graph-panel-header">
                Weekly Spending Report
              </div>
              {/* Y-Axis Max Control */}
              <div style={{ marginBottom: "1rem", textAlign: "right" }}>
                <label style={{ fontWeight: 500, marginRight: 8 }}>
                  <input
                    type="number"
                    value={yMax}
                    min={1}
                    step={1}
                    onChange={e => setYMax(Math.max(1, Number(e.target.value)))}
                    style={{
                      marginLeft: 8,
                      width: 60,
                      padding: "0.2rem 0.5rem",
                      borderRadius: 6,
                      border: "1px solid #ccc",
                      fontSize: "1rem",
                    }}
                  />
                </label>
              </div>
              <WeeklySpendingChart data={saved} yMax={yMax} />
              {/* Custom Legend (now inside the panel) */}
              <div className="graph-legend">
                <div className="graph-legend-item">
                  <span className="graph-legend-color-saved"></span>
                  <span className="graph-legend-label">Saved</span>
                </div>
                <div className="graph-legend-item">
                  <span className="graph-legend-color-excess"></span>
                  <span className="graph-legend-label">Excess</span>
                </div>
              </div>
            </div>
            <div className="empty-goals-popup">
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
                className="create-goal-button"
                onClick={() => router.push("/dashboard/goals/create")}
              >
                Create Goal
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Statistics;
