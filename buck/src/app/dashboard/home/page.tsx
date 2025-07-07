"use client";
import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { auth } from "@/utils/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { signOutUser } from "@/component/authentication";
import { processExpense, ExpenseInput, AIResponse } from "@/utils/aiApi";
import "./style.css";
import DashboardHeader from "@/component/dashboardheader";
import { useAuthGuard } from "@/utils/useAuthGuard";
import { testCategories, testAmounts, barColors } from "../statistics/testData";
// Data interface for type safety
interface WeeklyData {
  day: string;
  amount: number;
  color: string;
}

interface SummaryData {
  label: string;
  value: string;
  color: string;
  description: string;
}

// Emoji and custom description mapping for categories
const categoryDetails: Record<string, { emoji: string; description: string }> = {
  Food: { emoji: "🍔", description: "Meals, snacks, and groceries." },
  Fare: { emoji: "🚌", description: "Public transport and commuting costs." },
  "Gas Money": { emoji: "⛽", description: "Fuel for your vehicle." },
  "Video Games": { emoji: "🎮", description: "Game purchases and in-game spending." },
  Shopping: { emoji: "🛍️", description: "Clothes, gadgets, and other shopping." },
  Bills: { emoji: "🧾", description: "Utilities, rent, and recurring payments." },
  Other: { emoji: "💡", description: "Miscellaneous expenses." },
};

const Dashboard = (): React.JSX.Element => {
  const router = useRouter();

  // State for active navigation
  const [activeNav, setActiveNav] = useState("home");

  // Empty data - ready for future implementation
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData[]>([]);
  const [spendingAmount, setSpendingAmount] = useState("");
  const { user, loading } = useAuthGuard();

  //Auth Guard Code Block
  // On mount, set sample data for demonstration
  useEffect(() => {
    setWeeklyData([
      { day: "Mon", amount: 0, color: "#ef8a57" },
      { day: "Tue", amount: 0, color: "#fd523b" },
      { day: "Wed", amount: 0, color: "#f6c390" },
      { day: "Thu", amount: 0, color: "#2c3e50" },
      { day: "Fri", amount: 0, color: "#6c757d" },
      { day: "Sat", amount: 0, color: "#ffd6b0" },
      { day: "Sun", amount: 0, color: "#efb857" },
    ]);
  }, []);

  // Populate summaryData with category spending on mount
  useEffect(() => {
    const summary = testCategories.map((category, idx) => ({
      label: category,
      value: `$${testAmounts[idx]}`,
      color: barColors[idx],
      description: `${categoryDetails[category]?.emoji || ''} ${categoryDetails[category]?.description || ''}`,
    }));
    setSummaryData(summary);
  }, []);

  if (loading || !user) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
        <div className="loading-text">Loading Buck...</div>
      </div>
    );
  }

  const handleSignOut = async () => {
    const result = await signOutUser();
    if (result.success) {
      router.push("/"); // Redirect to sign-in page
    } else {
      alert(result.message || "Sign out failed.");
    }
  };

  //Audio Method
  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    audio.play();
  };

  // Function to update weekly data (for future use)
  const updateWeeklyData = (newData: WeeklyData[]) => {
    setWeeklyData(newData);
  };

  // Function to update summary data (for future use)
  const updateSummaryData = (newData: SummaryData[]) => {
    setSummaryData(newData);
  };

  // Function to update spending amount (for future use)
  const updateSpendingAmount = (newAmount: string) => {
    setSpendingAmount(newAmount);
  };

  // Navigation button click handlers
  const handleNavClick = (navItem: string) => {
    setActiveNav(navItem);
    // Add your navigation logic here
    console.log(`Navigating to: ${navItem}`);
  };

  return (
    <div className="dashboard">
      {/* Sticky Header */}
      <DashboardHeader />
      <div className="dashboard-container">
        <div className="dashboard-welcome-card">
          <div className="dashboard-welcome-row">
            <img src="/BuckMascot.png" alt="Buck Mascot" className="dashboard-welcome-avatar" />
            <div>
              <div className="dashboard-welcome-greeting">
                Welcome, <span className="dashboard-welcome-name">{auth.currentUser?.displayName}!</span>
              </div>
            </div>
          </div>
        </div>
        {/* Main Content */}
        <div className="dashboard-content">
          {/* Spending Card */}
          <div className="spending-card">
            <h2 className="spending-title">Weekly Spending</h2>
            <div className="spending-circle">
              <div className="spending-amount">
                {spendingAmount || "No Data"}
              </div>
            </div>
            <p className="spending-label">Total spent this week</p>
          </div>

          {/* Graph Card */}
          <div className="graph-card">
            <h2 className="graph-title">Weekly Summary of Expenses</h2>
            {/* Dynamic max Y value */}
            {(() => {
              const maxAmount = Math.max(30, ...weeklyData.map(item => item.amount));
              // Generate Y-axis labels (5 steps)
              const steps = 6;
              const yLabels = Array.from({ length: steps + 1 }, (_, i) => Math.round(maxAmount - (maxAmount / steps) * i));
              return (
                <div
                  className="graph-container"
                  style={{
                    display: "flex",
                    flexDirection: "row",
                    alignItems: "flex-end",
                  }}
                >
                  {/* Y-Axis */}
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      height: "300px",
                      marginRight: "1rem",
                      fontSize: "0.9rem",
                      color: "#6c757d",
                      alignItems: "flex-end",
                      minWidth: "28px",
                    }}
                  >
                    {yLabels.map((num, idx) => (
                      <div
                        key={num}
                        style={{
                          height: idx !== yLabels.length - 1 ? "calc(300px / 6 - 1px)" : 0,
                        }}
                      >
                        {num}
                      </div>
                    ))}
                  </div>
                  {/* Bars */}
                  <div
                    style={{
                      flex: 1,
                      display: "flex",
                      alignItems: "flex-end",
                      height: "300px",
                      gap: "1rem",
                    }}
                  >
                    {weeklyData.length > 0 ? (
                      weeklyData.map((item, index) => (
                        <div
                          key={index}
                          className="graph-bar"
                          style={{
                            height: `${maxAmount === 0 ? 0 : (item.amount / maxAmount) * 100}%`,
                            background: item.color,
                          }}
                          title={`${item.day}: $${item.amount}`}
                        >
                          <div className="graph-bar-label">{item.day}</div>
                        </div>
                      ))
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          height: "100%",
                          color: "#666",
                          fontSize: "1.1rem",
                        }}
                      >
                        No data available
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>

        {/* Summary Card */}
        <div className="summary-card">
          <h2 className="summary-title">Financial Summary</h2>
          <div className="summary-content">
            {summaryData.length > 0 ? (
              summaryData.map((item, index) => (
                <div key={index} className="summary-item">
                  <div
                    className="summary-item-value"
                    style={{ color: item.color }}
                  >
                    {item.value}
                  </div>
                  <div className="summary-item-label">{item.label}</div>
                  <div className="summary-item-description" style={{ fontSize: '0.85rem', color: '#888', marginTop: '0.3rem' }}>{item.description}</div>
                </div>
              ))
            ) : (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "100%",
                  color: "#666",
                  fontSize: "1.1rem",
                  gridColumn: "1 / -1",
                }}
              >
                No summary data available
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
