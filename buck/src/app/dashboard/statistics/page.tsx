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
import { statisticsTestData } from './testData';
import { useFinancial } from "@/context/FinancialContext";
import { Line } from 'react-chartjs-2';


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

const Statistics = () => {
  const router = useRouter();
  const { user, loading } = useAuthGuard();
  const [yMax, setYMax] = useState(1000);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loadingGoals, setLoadingGoals] = useState(false);
  const [selectedMode, setSelectedMode] = useState<'week' | 'month' | 'overall'>('week');
  const [selectedWeek, setSelectedWeek] = useState(0);
  const [selectedMonth, setSelectedMonth] = useState(0);
  const { setTotalSaved } = useFinancial();
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expenseDate, setExpenseDate] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDesc, setExpenseDesc] = useState('');
  const [expenseLoading, setExpenseLoading] = useState(false);
  const [expenseError, setExpenseError] = useState('');
  const [forecastData, setForecastData] = useState<any>(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [forecastError, setForecastError] = useState('');

  // Dynamically generate week date ranges from goals (real calendar mapping)
  let weekDateRanges: { start: string; end: string }[] = [];
  let monthDateRanges: { start: string; end: string; label: string }[] = [];
  if (goals.length > 0) {
    // Find the earliest Monday on or before the earliest goal start
    const minStartRaw = new Date(Math.min(...goals.map(g => new Date(g.createdAt).getTime())));
    const minStart = new Date(minStartRaw);
    minStart.setDate(minStart.getDate() - ((minStart.getDay() + 6) % 7)); // Monday
    const maxEnd = new Date(Math.max(...goals.map(g => new Date(g.targetDate || g.createdAt).getTime())));
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
      const monthEnd = new Date(monthCursor.getFullYear(), monthCursor.getMonth() + 1, 0);
      monthDateRanges.push({
        start: monthStart.toISOString().slice(0, 10),
        end: monthEnd.toISOString().slice(0, 10),
        label: monthStart.toLocaleString('default', { month: 'long', year: 'numeric' })
      });
      monthCursor.setMonth(monthCursor.getMonth() + 1);
    }
  }
  // Find current week index
  let currentWeekIdx = -1;
  if (weekDateRanges.length > 0) {
    const today = new Date();
    currentWeekIdx = weekDateRanges.findIndex(range => {
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
        setGoals(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Goal)));
        setLoadingGoals(false);
      }
    };
    fetchGoals();
  }, [user]);

  // Calculate totalSaved for the user (use your real calculation here)
  let totalSaved = 0;
  // For demo: sum all savings for the selected mode
  if (selectedMode === 'week' && weekDateRanges.length > 0) {
    const idx = selectedWeek;
    const weekData = statisticsTestData.weeklyCategorySpending[idx] || Array(statisticsTestData.categories.length).fill(0);
    totalSaved = weekData.reduce((sum, amt) => sum + (statisticsTestData.maxBudgetPerDay - amt), 0);
  } else if (selectedMode === 'month' && monthDateRanges.length > 0) {
    const idx = selectedMonth;
    let days = Array(7).fill(0);
    for (let w = idx * 4; w < (idx + 1) * 4 && w < statisticsTestData.weeklyCategorySpending.length; w++) {
      for (let d = 0; d < 7; d++) {
        days[d] += statisticsTestData.weeklyCategorySpending[w][d];
      }
    }
    totalSaved = days.reduce((sum, amt) => sum + (statisticsTestData.maxBudgetPerDay - amt), 0);
  } else if (selectedMode === 'overall') {
    let days = Array(7).fill(0);
    for (let w = 0; w < statisticsTestData.weeklyCategorySpending.length; w++) {
      for (let d = 0; d < 7; d++) {
        days[d] += statisticsTestData.weeklyCategorySpending[w][d];
      }
    }
    totalSaved = days.reduce((sum, amt) => sum + (statisticsTestData.maxBudgetPerDay - amt), 0);
  }

  useEffect(() => {
    setTotalSaved(totalSaved);
  }, [totalSaved, setTotalSaved]);

  // Assume the first goal is selected for demo (replace with real selection logic)
  const selectedGoal = goals[0];

  // Fetch forecast/actual data
  useEffect(() => {
    const fetchForecast = async () => {
      if (!user || !selectedGoal) return;
      setForecastLoading(true);
      setForecastError('');
      try {
        const goalPayload = {
          id: selectedGoal.id,
          userId: user.uid,
          targetAmount: selectedGoal.targetAmount,
          targetDate: selectedGoal.targetDate,
          attitude: selectedGoal.attitude || "Normal"
        };
        const res = await fetch('https://buck-web-application-1.onrender.com/ai/forecast/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: goalPayload,
            budget: 0 // Optionally fetch wallet budget if needed
          })
        });
        if (!res.ok) throw new Error('Failed to fetch forecast');
        const data = await res.json();
        setForecastData(data);
      } catch (err: any) {
        setForecastError(err.message || 'Unknown error');
      } finally {
        setForecastLoading(false);
      }
    };
    fetchForecast();
  }, [user, selectedGoal]);

  // Add expense handler
  const handleAddExpense = async () => {
    if (!user || !selectedGoal) return;
    setExpenseLoading(true);
    setExpenseError('');
    try {
      const goalPayload = {
        id: selectedGoal.id,
        userId: user.uid,
        targetAmount: selectedGoal.targetAmount,
        targetDate: selectedGoal.targetDate,
        attitude: selectedGoal.attitude || "Normal"
      };
      const res = await fetch('https://buck-web-application-1.onrender.com/expenses/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: user.uid,
          goal_id: selectedGoal.id,
          date: expenseDate,
          amount: parseFloat(expenseAmount),
          description: expenseDesc
        })
      });
      if (!res.ok) throw new Error('Failed to add expense');
      setShowExpenseModal(false);
      setExpenseDate('');
      setExpenseAmount('');
      setExpenseDesc('');
      // Refresh forecast/actual data
      const fetchForecast = async () => {
        const res = await fetch('https://buck-web-application-1.onrender.com/ai/forecast/', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            goal: goalPayload,
            budget: 0
          })
        });
        if (res.ok) {
          const data = await res.json();
          setForecastData(data);
        }
      };
      fetchForecast();
    } catch (err: any) {
      setExpenseError(err.message || 'Unknown error');
    } finally {
      setExpenseLoading(false);
    }
  };

  // Prepare data for Chart.js
  let chartData = null;
  if (forecastData && forecastData.forecast_per_day) {
    const labels = Object.keys(forecastData.forecast_per_day);
    const forecastVals = labels.map(d => forecastData.forecast_per_day[d]);
    const actualVals = labels.map(d => (forecastData.actual_per_day && forecastData.actual_per_day[d]) || 0);
    chartData = {
      labels,
      datasets: [
        {
          label: 'Forecasted Daily Expense',
          data: forecastVals,
          borderColor: 'rgba(239,138,87,1)',
          backgroundColor: 'rgba(239,138,87,0.2)',
          fill: true,
          tension: 0.3
        },
        {
          label: 'Actual Daily Expense',
          data: actualVals,
          borderColor: 'rgba(52, 152, 219, 1)',
          backgroundColor: 'rgba(52, 152, 219, 0.2)',
          fill: true,
          tension: 0.3
        }
      ]
    };
  }

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
        {/* Info Card and Selectors */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: '2.5rem', marginBottom: '1.5rem' }}>
          {/* Info Card */}
          {selectedMode === 'week' && weekDateRanges.length > 0 && (
            <div style={{
              background: currentWeekIdx === selectedWeek ? '#ffe5c2' : '#fff',
              borderRadius: '16px',
              boxShadow: '0 4px 24px 0 rgba(239, 138, 87, 0.10)',
              padding: '1.2rem 2rem',
              marginBottom: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              fontSize: '1.15rem',
              fontWeight: 600,
              color: '#2c3e50',
              border: currentWeekIdx === selectedWeek ? '2px solid #ef8a57' : 'none',
            }}>
              <span style={{ color: '#ef8a57', fontWeight: 700, fontSize: '1.25rem' }}>
                Week {selectedWeek + 1}
              </span>
              <span style={{ color: '#6c757d', fontWeight: 500, fontSize: '1.05rem' }}>
                {weekDateRanges[selectedWeek]?.start} to {weekDateRanges[selectedWeek]?.end}
              </span>
              {currentWeekIdx === selectedWeek && (
                <span style={{ color: '#fff', background: '#ef8a57', borderRadius: '8px', padding: '0.2rem 0.7rem', marginLeft: '1rem', fontWeight: 700, fontSize: '1rem' }}>Current</span>
              )}
            </div>
          )}
          {selectedMode === 'month' && monthDateRanges.length > 0 && (
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              boxShadow: '0 4px 24px 0 rgba(239, 138, 87, 0.10)',
              padding: '1.2rem 2rem',
              marginBottom: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              fontSize: '1.15rem',
              fontWeight: 600,
              color: '#2c3e50',
            }}>
              <span style={{ color: '#ef8a57', fontWeight: 700, fontSize: '1.25rem' }}>
                {monthDateRanges[selectedMonth]?.label}
              </span>
              <span style={{ color: '#6c757d', fontWeight: 500, fontSize: '1.05rem' }}>
                {monthDateRanges[selectedMonth]?.start} to {monthDateRanges[selectedMonth]?.end}
              </span>
            </div>
          )}
          {selectedMode === 'overall' && (
            <div style={{
              background: '#fff',
              borderRadius: '16px',
              boxShadow: '0 4px 24px 0 rgba(239, 138, 87, 0.10)',
              padding: '1.2rem 2rem',
              marginBottom: '0.7rem',
              display: 'flex',
              alignItems: 'center',
              gap: '1.5rem',
              fontSize: '1.15rem',
              fontWeight: 600,
              color: '#2c3e50',
              justifyContent: 'center',
            }}>
              <span style={{ color: '#ef8a57', fontWeight: 700, fontSize: '1.25rem' }}>
                Overall
              </span>
              <span style={{ color: '#6c757d', fontWeight: 500, fontSize: '1.05rem' }}>
                {goals.length > 0 ? `${weekDateRanges[0]?.start} to ${weekDateRanges[weekDateRanges.length - 1]?.end}` : 'No data'}
              </span>
            </div>
          )}
          {/* Selectors Row */}
          <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '1.5rem' }}>
            {/* View Mode Selector */}
            <div style={{ textAlign: 'center' }}>
              <label style={{ fontWeight: 600, marginRight: 8, color: '#2c3e50' }}>View Mode:</label>
              <select
                value={selectedMode}
                onChange={e => setSelectedMode(e.target.value as 'week' | 'month' | 'overall')}
                style={{
                  padding: '0.5rem 1.2rem',
                  borderRadius: '10px',
                  border: '2px solid #ef8a57',
                  background: '#fff7f0',
                  color: '#ef8a57',
                  fontWeight: 600,
                  fontSize: '1rem',
                  boxShadow: '0 2px 8px 0 rgba(239, 138, 87, 0.08)',
                  outline: 'none',
                  cursor: 'pointer',
                  transition: 'border 0.2s',
                }}
              >
                <option value="week">Weekly</option>
                <option value="month">Monthly</option>
                <option value="overall">Overall</option>
              </select>
            </div>
            {/* Week/Month Selector */}
            {selectedMode === 'week' && weekDateRanges.length > 0 && (
              <div style={{ textAlign: 'center' }}>
                <label style={{ fontWeight: 600, marginRight: 8, color: '#2c3e50' }}>Select Week:</label>
                <select
                  value={selectedWeek}
                  onChange={e => setSelectedWeek(Number(e.target.value))}
                  style={{
                    padding: '0.5rem 1.2rem',
                    borderRadius: '10px',
                    border: '2px solid #ef8a57',
                    background: '#fff7f0',
                    color: '#ef8a57',
                    fontWeight: 600,
                    fontSize: '1rem',
                    boxShadow: '0 2px 8px 0 rgba(239, 138, 87, 0.08)',
                    outline: 'none',
                    cursor: 'pointer',
                    transition: 'border 0.2s',
                  }}
                  disabled={weekDateRanges.length === 0}
                >
                  {weekDateRanges.map((range, idx) => (
                    <option key={idx} value={idx} style={{ color: '#2c3e50' }}>
                      Week {idx + 1}: {range.start} to {range.end}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {selectedMode === 'month' && monthDateRanges.length > 0 && (
              <div style={{ textAlign: 'center' }}>
                <label style={{ fontWeight: 600, marginRight: 8, color: '#2c3e50' }}>Select Month:</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(Number(e.target.value))}
                  style={{
                    padding: '0.5rem 1.2rem',
                    borderRadius: '10px',
                    border: '2px solid #ef8a57',
                    background: '#fff7f0',
                    color: '#ef8a57',
                    fontWeight: 600,
                    fontSize: '1rem',
                    boxShadow: '0 2px 8px 0 rgba(239, 138, 87, 0.08)',
                    outline: 'none',
                    cursor: 'pointer',
                    transition: 'border 0.2s',
                  }}
                  disabled={monthDateRanges.length === 0}
                >
                  {monthDateRanges.map((range, idx) => (
                    <option key={idx} value={idx} style={{ color: '#2c3e50' }}>
                      {range.label}: {range.start} to {range.end}
                    </option>
                  ))}
                </select>
              </div>
            )}
          </div>
        </div>
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
              <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <ExcessPie mode={selectedMode} weekIndex={selectedWeek} monthIndex={selectedMonth} />
                </div>
                <SpendingBar mode={selectedMode} weekIndex={selectedWeek} monthIndex={selectedMonth} />
              </div>
              {/* Second row: Line graph */}
              <div style={{ display: "flex", gap: "2rem", alignItems: "flex-start", marginTop: "2rem" }}>
                <div className="graph-panel">
                  <div className="graph-panel-header">
                    Spending Report
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
                  <WeeklySpendingChart mode={selectedMode} weekIndex={selectedWeek} monthIndex={selectedMonth} />
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
        {/* Add Expense Button and Modal */}
        <div style={{ width: '100%', maxWidth: 600, margin: '2rem auto' }}>
          <button onClick={() => setShowExpenseModal(true)} style={{ background: '#ef8a57', color: '#fff', border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem', fontWeight: 600, fontSize: 16, cursor: 'pointer', marginBottom: 16 }}>
            + Add Expense
          </button>
          {showExpenseModal && (
            <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="modal" style={{ background: '#fff', borderRadius: 8, padding: 24, minWidth: 320, maxWidth: 400, boxShadow: '0 2px 16px rgba(0,0,0,0.2)', position: 'relative' }}>
                <button onClick={() => setShowExpenseModal(false)} style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', fontSize: 20, cursor: 'pointer' }}>&times;</button>
                <h3 style={{ marginTop: 0 }}>Add Expense</h3>
                <input type="date" value={expenseDate} onChange={e => setExpenseDate(e.target.value)} style={{ width: '100%', marginBottom: 12, padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
                <input type="number" value={expenseAmount} onChange={e => setExpenseAmount(e.target.value)} placeholder="Amount" style={{ width: '100%', marginBottom: 12, padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
                <input type="text" value={expenseDesc} onChange={e => setExpenseDesc(e.target.value)} placeholder="Description" style={{ width: '100%', marginBottom: 12, padding: 8, borderRadius: 4, border: '1px solid #ccc' }} />
                {expenseError && <div style={{ color: 'red', marginBottom: 8 }}>{expenseError}</div>}
                <button onClick={handleAddExpense} disabled={expenseLoading} style={{ background: '#ef8a57', color: '#fff', border: 'none', borderRadius: 8, padding: '0.7rem 1.5rem', fontWeight: 600, fontSize: 16, cursor: 'pointer', width: '100%' }}>
                  {expenseLoading ? 'Adding...' : 'Add Expense'}
                </button>
              </div>
            </div>
          )}
        </div>
        {/* Forecast/Actual Graph */}
        <div style={{ width: '100%', maxWidth: 800, margin: '2rem auto' }}>
          {forecastLoading && <div>Loading forecast...</div>}
          {forecastError && <div style={{ color: 'red' }}>{forecastError}</div>}
          {chartData && <Line data={chartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />}
          {forecastData && forecastData.forecast && <div style={{ marginTop: 16, fontWeight: 500, color: '#2c3e50' }}>{forecastData.forecast}</div>}
        </div>
      </div>
    </div>
  );
};

export default Statistics;
