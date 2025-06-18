"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { auth } from "@/utils/firebase";
import { onAuthStateChanged, User } from "firebase/auth";
import { signOutUser } from "@/component/authentication";
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
            <span className="nav-button-icon"></span>
            Button1
          </button>
          <button
            className={`nav-button ${activeNav === "button2" ? "active" : ""}`}
            onClick={() => handleNavClick("button2")}
          >
            <span className="nav-button-icon"></span>
            Button2
          </button>
          <button
            className={`nav-button ${activeNav === "button3" ? "active" : ""}`}
            onClick={() => handleNavClick("button3")}
          >
            <span className="nav-button-icon"></span>
            Button3
          </button>
          <button
            className={`nav-button ${activeNav === "button4" ? "active" : ""}`}
            onClick={handleSignOut}
          >
            <span className="nav-button-icon"></span>
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
      </div>
    </div>
  );
};

export default Dashboard;
