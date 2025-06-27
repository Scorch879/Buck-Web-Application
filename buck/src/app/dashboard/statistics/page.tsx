"use client";
import React, { useState } from "react";
import "./style.css";
import { useRouter } from "next/navigation";
import DashboardHeader from "@/component/dashboardheader";
import { useAuthGuard } from "@/utils/useAuthGuard";
import WeeklySpendingChart from "@/component/line-graph";
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
  const [yMax, setYMax] = useState(10);

  if (loading || !user) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <div className="loading-text">Loading Buck...</div>
      </div>
    );
  }

    //Test Variables (remove when AI is used)
  let mon, tue, wed, thu, fri, sat, sun;

  mon = 1000; // Example value for Monday
  tue = 800; // Example value for Tuesday
  wed = 600; // Example value for Wednesday
  thu = 1200; // Example value for Thursday
  fri = 900; // Example value for Friday
  sat = 1100; // Example value for Saturday
  ///


  let maxBudgetPerDay = 1000; //Test variable (This is supposed to be forecasted from the AI itself)
  
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
        {/* Y-Axis Max Control */}
        <div style={{ marginBottom: "1rem", textAlign: "right", width: 500 }}>
          <label style={{ fontWeight: 500, marginRight: 8 }}>
            Y-Axis Max:
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
        {/* Line Graph */}
        <div
          style={{
            width: 500,
            marginBottom: "2rem",
            background: "#fff",
            borderRadius: "18px",
            boxShadow: "0 6px 32px 0 rgba(239, 138, 87, 0.08)",
            border: "1.5px solid #ffd6b0",
            padding: "2rem 1.5rem",
          }}
        >
          <div style={{ fontWeight: 700, fontSize: "1.3rem", color: "#2c3e50", marginBottom: "1.2rem", textAlign: "center" }}>
            Weekly Spending Report
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
