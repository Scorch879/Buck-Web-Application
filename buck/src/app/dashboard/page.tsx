"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { auth } from "@/utils/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { signOutUser } from "@/component/authentication";
import { processExpense, ExpenseInput, AIResponse } from "@/utils/aiApi";
import "./style.css";

// Data interface for type safety
interface WeeklyData {
  day: string;
  amount: number;
  height: number;
}

interface SummaryData {
  label: string;
  value: string;
  color: string;
}

const Dashboard = (): React.JSX.Element => {
  // State for active navigation
  const [activeNav, setActiveNav] = useState("button1");

  // Empty data - ready for future implementation
  const [weeklyData, setWeeklyData] = useState<WeeklyData[]>([]);

  const [summaryData, setSummaryData] = useState<SummaryData[]>([]);

  const [spendingAmount, setSpendingAmount] = useState("");

  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<User | null>(null);
  // Add all other useState hooks here, not inside any if/else
  // State for AI form inputs and results
  const [aiText, setAiText] = useState("");
  const [aiPastExpenses, setAiPastExpenses] = useState(""); // comma-separated string
  const [aiAttitude, setAiAttitude] = useState<"Normal" | "Moderate" | "Aggressive">("Normal");
  const [aiResult, setAiResult] = useState<AIResponse | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  
  //Auth Guard Code Block
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        router.replace("/sign-in");
      } else {
        setUser(firebaseUser);
        setLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return <div>Loading...</div>;
  }

  // Only render dashboard if user is authenticated
  if (!user) {
    return <div>Redirecting...</div>;
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
      <div className="dashboard-header">
        <div className="dashboard-header-left">
          <div className="dashboard-mascot">
            <Image
              src="/BuckMascot.png"
              alt="Buck Mascot"
              width={50}
              height={70}
              className="dashboard-mascot-img"
              priority
              onClick={playQuack}
            />
          </div>
          <h1 className="dashboard-title">Dashboard</h1>
        </div>

        <div className="dashboard-nav">
          <button
            className={`nav-button ${activeNav === "button1" ? "active" : ""}`}
            onClick={() => handleNavClick("button1")}
          >
            Button1
          </button>
          <button
            className={`nav-button ${activeNav === "button2" ? "active" : ""}`}
            onClick={() => handleNavClick("button2")}
          >
            Button2
          </button>
          <button
            className={`nav-button ${activeNav === "button3" ? "active" : ""}`}
            onClick={() => handleNavClick("button3")}
          >
            Button3
          </button>
          <button
            className={`nav-button ${activeNav === "button4" ? "active" : ""}`}
            onClick={handleSignOut}
          >
            Sign Out
          </button>
        </div>
      </div>

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
            <div className="graph-container">
              {weeklyData.length > 0 ? (
                weeklyData.map((item, index) => (
                  <div
                    key={index}
                    className="graph-bar"
                    style={{ height: `${item.height}%` }}
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

        {/* AI Expense Analysis Form */}
        <div className="ai-form-card" style={{ marginBottom: 32, padding: 24, background: '#fff', borderRadius: 12, boxShadow: '0 2px 8px #eee' }}>
          <h2>AI Expense Analysis</h2>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAiError(null);
              setAiResult(null);
              setAiLoading(true);
              try {
                // Convert comma-separated string to number array
                const pastExpensesArr = aiPastExpenses
                  .split(",")
                  .map((v) => v.trim())
                  .filter((v) => v.length > 0)
                  .map(Number)
                  .filter((n) => !isNaN(n));
                const input: ExpenseInput = {
                  text: aiText,
                  past_expenses: pastExpensesArr,
                  saving_attitude: aiAttitude,
                };
                const result = await processExpense(input);
                setAiResult(result);
              } catch (err: any) {
                setAiError(err.message || "Something went wrong");
              } finally {
                setAiLoading(false);
              }
            }}
            style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 400 }}
          >
            <label>
              Expense Description:
              <input
                type="text"
                value={aiText}
                onChange={(e) => setAiText(e.target.value)}
                required
                placeholder="e.g. Lunch at cafe"
                style={{ width: '100%', padding: 6, marginTop: 4 }}
              />
            </label>
            <label>
              Past Expenses (comma-separated):
              <input
                type="text"
                value={aiPastExpenses}
                onChange={(e) => setAiPastExpenses(e.target.value)}
                required
                placeholder="e.g. 12.5, 8, 15, 20"
                style={{ width: '100%', padding: 6, marginTop: 4 }}
              />
            </label>
            <label>
              Saving Attitude:
              <select
                value={aiAttitude}
                onChange={(e) => setAiAttitude(e.target.value as any)}
                style={{ width: '100%', padding: 6, marginTop: 4 }}
              >
                <option value="Normal">Normal</option>
                <option value="Moderate">Moderate</option>
                <option value="Aggressive">Aggressive</option>
              </select>
            </label>
            <button type="submit" disabled={aiLoading} style={{ padding: 8, marginTop: 8 }}>
              {aiLoading ? "Analyzing..." : "Analyze Expense"}
            </button>
          </form>
          {/* Display AI results or errors */}
          {aiError && <div style={{ color: 'red', marginTop: 12 }}>{aiError}</div>}
          {aiResult && (
            <div style={{ marginTop: 16, background: '#f6f6f6', padding: 16, borderRadius: 8 }}>
              <div><strong>Category:</strong> {aiResult.category}</div>
              <div><strong>Base Forecast:</strong> ${aiResult.base_forecast.toFixed(2)}</div>
              <div><strong>Adjusted Forecast:</strong> ${aiResult.adjusted_forecast.toFixed(2)}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
