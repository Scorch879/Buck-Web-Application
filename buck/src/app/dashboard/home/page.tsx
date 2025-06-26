"use client";
import { use, useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { auth } from "@/utils/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { signOutUser } from "@/component/authentication";
import "./style.css";
import DashboardHeader from "@/component/dashboardheader";
import { useAuthGuard } from "@/utils/useAuthGuard";

// Data interface for type safety
interface WeeklyData {
  day: string;
  amount: number;
  height: number;
  color: string;
}

interface SummaryData {
  label: string;
  value: string;
  color: string;
}

const Dashboard = (): React.JSX.Element => {
  const router = useRouter();

  // State for active navigation
  const [activeNav, setActiveNav] = useState("home");

  // Empty data - ready for future implementation
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);
  const [summaryData, setSummaryData] = useState<SummaryData[]>([]);
  const [spendingAmount, setSpendingAmount] = useState("");
  const { user, loading } = useAuthGuard();

  // On mount, set sample data for demonstration
  useEffect(() => {
    setWeeklyData([
      { day: "Mon", amount: 10, height: 20, color: "#ef8a57" },
      { day: "Tue", amount: 25, height: 50, color: "#fd523b" },
      { day: "Wed", amount: 15, height: 30, color: "#f6c390" },
      { day: "Thu", amount: 30, height: 60, color: "#2c3e50" },
      { day: "Fri", amount: 20, height: 40, color: "#6c757d" },
      { day: "Sat", amount: 35, height: 70, color: "#ffd6b0" },
      { day: "Sun", amount: 12, height: 25, color: "#efb857" },
    ]);
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
                {[30, 25, 20, 15, 10, 5, 0].map((num) => (
                  <div
                    key={num}
                    style={{
                      height: "1px",
                      marginBottom: num !== 0 ? "calc(300px / 7 - 1px)" : 0,
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
                        height: `${item.height}%`,
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
