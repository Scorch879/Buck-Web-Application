"use client";
import React, { useState, useEffect } from "react";
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
import { db } from "@/utils/firebase";
import { collection, getDocs } from "firebase/firestore";
import { statisticsTestData, testCategories } from "./testData";
import { useFinancial } from "@/context/FinancialContext";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface Goal {
  id: string;
  goalName: string;
  targetAmount: number;
  currentAmount?: number;
  targetDate?: string;
  createdAt: string;
  attitude?: string;
  isActive?: boolean;
}

// Ensure props match ExcessPieProps
type ExcessPieProps = {
  data: Array<{ category: string; amount: number }>;
};

const Statistics = () => {
  const router = useRouter();
  const { user, loading } = useAuthGuard();
  const [yMax, setYMax] = useState(1000);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);

  const [selectedMode, setSelectedMode] = useState<
    "week" | "month" | "overall"
  >("week");
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const { setTotalSaved } = useFinancial();

  // Dynamically generate week date ranges from goals (real calendar mapping)
  let weekDateRanges: { start: string; end: string }[] = [];
  let monthDateRanges: { start: string; end: string; label: string }[] = [];
  if (goals.length > 0) {
    // Find the earliest Monday on or before the earliest goal start
    const minStartRaw = new Date(
      Math.min(...goals.map((g) => new Date(g.createdAt).getTime()))
    );
    const minStart = new Date(minStartRaw);
    minStart.setDate(minStart.getDate() - ((minStart.getDay() + 6) % 7)); // Monday
    const maxEnd = new Date(
      Math.max(
        ...goals.map((g) => new Date(g.targetDate || g.createdAt).getTime())
      )
    );
    // Weeks (Monday to Sunday)
    let current = new Date(minStart);
    while (current <= maxEnd) {
      const weekStart = new Date(current);
      const weekEnd = new Date(current);
      weekEnd.setDate(weekEnd.getDate() + 6);
      weekDateRanges.push({
        start: weekStart.toISOString().slice(0, 10),
        end: weekEnd.toISOString().slice(0, 10),
      });
      current.setDate(current.getDate() + 7);
    }
    // Months (calendar months)
    let monthCursor = new Date(minStart.getFullYear(), minStart.getMonth(), 1);
    while (monthCursor <= maxEnd) {
      const monthStart = new Date(monthCursor);
      const monthEnd = new Date(
        monthCursor.getFullYear(),
        monthCursor.getMonth() + 1,
        0
      );
      monthDateRanges.push({
        start: monthStart.toISOString().slice(0, 10),
        end: monthEnd.toISOString().slice(0, 10),
        label: monthStart.toLocaleString("default", {
          month: "long",
          year: "numeric",
        }),
      });
      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }
  }
  // Find current week index
  let currentWeekIdx = -1;
  if (weekDateRanges.length > 0) {
    const today = new Date();
    currentWeekIdx = weekDateRanges.findIndex((range) => {
      const start = new Date(range.start);
      const end = new Date(range.end);
      return today >= start && today <= end;
    });
  }

  useEffect(() => {
    const fetchGoals = async () => {
      if (user) {
        setLoadingGoals(true);
        const goalsRef = collection(db, "goals", user.uid, "userGoals");
        const snapshot = await getDocs(goalsRef);
        setGoals(
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Goal))
        );
        setLoadingGoals(false);
      }
    };
    fetchGoals();
  }, [user]);

  // Calculate totalSaved for the user (use your real calculation here)
  let totalSaved = 0;
  // For demo: sum all savings for the selected mode
  if (selectedMode === "week" && weekDateRanges.length > 0) {
    const idx = selectedWeek;
    const weekData =
      statisticsTestData.weeklyCategorySpending[idx] ||
      Array(statisticsTestData.categories.length).fill(0);
    totalSaved = weekData.reduce(
      (sum, amt) => sum + (statisticsTestData.maxBudgetPerDay - amt),
      0
    );
  } else if (selectedMode === "month" && monthDateRanges.length > 0) {
    const idx = selectedMonth;
    let days = Array(7).fill(0);
    for (
      let w = idx * 4;
      w < (idx + 1) * 4 && w < statisticsTestData.weeklyCategorySpending.length;
      w++
    ) {
      for (let d = 0; d < 7; d++) {
        days[d] += statisticsTestData.weeklyCategorySpending[w][d];
      }
    }
    totalSaved = days.reduce(
      (sum, amt) => sum + (statisticsTestData.maxBudgetPerDay - amt),
      0
    );
  } else if (selectedMode === "overall") {
    let days = Array(7).fill(0);
    for (let w = 0; w < statisticsTestData.weeklyCategorySpending.length; w++) {
      for (let d = 0; d < 7; d++) {
        days[d] += statisticsTestData.weeklyCategorySpending[w][d];
      }
    }
    totalSaved = days.reduce(
      (sum, amt) => sum + (statisticsTestData.maxBudgetPerDay - amt),
      0
    );
  }

  useEffect(() => {
    setTotalSaved(totalSaved);
  }, [totalSaved, setTotalSaved]);

  if (loading || !user || loadingGoals) {
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
        {/* Panels Container */}
        <div className="statistics-panels-container">
          {goals.length === 0 ? (
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
          ) : (
            <>
              {/* First row: Pie chart and Bar graph */}
              <div
                style={{
                  display: "flex",
                  gap: "2rem",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                  }}
                >
                  <ExcessPie />
                </div>
                <SpendingBar />
              </div>
              {/* Second row: Line graph */}
              <div
                style={{
                  display: "flex",
                  gap: "2rem",
                  alignItems: "flex-start",
                  marginTop: "2rem",
                }}
              >
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
                        onChange={(e) =>
                          setYMax(Math.max(1, Number(e.target.value)))
                        }
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
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default Statistics;
