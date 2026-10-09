"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { FaBullseye, FaLightbulb, FaReceipt, FaWallet, FaSyncAlt } from "react-icons/fa";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useDashboardUser } from "@/context/DashboardUserContext";
import {
  mergeDashboardDataCache,
  useFinancial,
} from "@/context/FinancialContext";
import { formatCurrency, toNumber } from "@/utils/formatters";
import {
  getActiveWallet,
  listExpenses,
  listGoals,
  subscribeUserTable,
  type BuckExpense,
  type BuckGoal,
} from "@/utils/supabaseData";
import { fetchAIAdvisorInsights, type AIAdvisorInsights } from "@/utils/advisorApi";
import { useToast } from "@/component/toast";
import "./style.css";

function getCurrentWeekStart() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);

  return start;
}

function getWeeklyTotal(expenses: BuckExpense[]) {
  const weekStart = getCurrentWeekStart();

  return expenses.reduce((sum, expense) => {
    const date = new Date(expense.date);

    if (Number.isNaN(date.getTime()) || date < weekStart) {
      return sum;
    }

    return sum + toNumber(expense.amount);
  }, 0);
}

function getGoalProgress(goal: BuckGoal | undefined) {
  if (!goal || goal.targetAmount <= 0) {
    return 0;
  }

  return Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100));
}

export default function FinancialAdvisorPage() {
  const { user } = useDashboardUser();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const { toast } = useToast();
  const userCache = dashboardCache.userId === user.uid ? dashboardCache : {};
  const hasInitialAdvisorData = Boolean(
    userCache.expenses &&
      userCache.goals &&
      userCache.activeWalletBudget !== undefined
  );
  const [expenses, setExpenses] = useState<BuckExpense[]>(
    () => userCache.expenses ?? []
  );
  const [goals, setGoals] = useState<BuckGoal[]>(() => userCache.goals ?? []);
  const [walletBudget, setWalletBudget] = useState(
    () => userCache.activeWalletBudget ?? 0
  );
  const [loading, setLoading] = useState(() => !hasInitialAdvisorData);
  const [error, setError] = useState("");
  const hadInitialAdvisorData = useRef(hasInitialAdvisorData);

  const [aiInsights, setAiInsights] = useState<AIAdvisorInsights | null>(null);
  const [loadingAi, setLoadingAi] = useState(true);
  const [refreshingAi, setRefreshingAi] = useState(false);

  const loadAI = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshingAi(true);
    } else {
      setLoadingAi(true);
    }
    try {
      const insights = await fetchAIAdvisorInsights({
        userId: user.uid,
        forceRefresh,
      });
      setAiInsights(insights);
      if (forceRefresh) {
        toast("Refreshed AI advisory insights.", "success");
      }
    } catch (err) {
      console.error("Failed to fetch AI insights:", err);
      if (forceRefresh) {
        toast("Could not refresh AI insights.", "error");
      }
    } finally {
      setLoadingAi(false);
      setRefreshingAi(false);
    }
  };

  useEffect(() => {
    let active = true;

    const loadExpenses = async () => {
      const nextExpenses = await listExpenses(user.uid);

      if (!active) {
        return;
      }

      setExpenses(nextExpenses);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          expenses: nextExpenses,
        })
      );
    };

    const loadGoals = async () => {
      const nextGoals = await listGoals(user.uid);

      if (!active) {
        return;
      }

      setGoals(nextGoals);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          goals: nextGoals,
        })
      );
    };

    const loadWallet = async () => {
      const activeWallet = await getActiveWallet(user.uid);
      const nextWalletBudget = activeWallet?.budget ?? 0;

      if (!active) {
        return;
      }

      setWalletBudget(nextWalletBudget);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          activeWalletBudget: nextWalletBudget,
        })
      );
    };

    const loadData = async () => {
      if (!hadInitialAdvisorData.current) {
        setLoading(true);
      }

      try {
        await Promise.all([loadExpenses(), loadGoals(), loadWallet()]);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Could not load advisor notes."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadData();
    void loadAI(false);

    const unsubscribeExpenses = subscribeUserTable(
      "expenses",
      user.uid,
      () => void loadExpenses()
    );
    const unsubscribeGoals = subscribeUserTable("goals", user.uid, () =>
      void loadGoals()
    );
    const unsubscribeWallets = subscribeUserTable("wallets", user.uid, () => {
      void loadWallet();
    });

    return () => {
      active = false;
      unsubscribeExpenses();
      unsubscribeGoals();
      unsubscribeWallets();
    };
  }, [setDashboardCache, user.uid]);

  const activeGoal = useMemo(
    () => goals.find((goal) => goal.isActive && !goal.completed) ?? goals[0],
    [goals]
  );
  const weeklyTotal = useMemo(() => getWeeklyTotal(expenses), [expenses]);
  const goalProgress = getGoalProgress(activeGoal);
  const highestExpense = useMemo(
    () =>
      expenses.reduce<BuckExpense | null>(
        (highest, expense) =>
          !highest || expense.amount > highest.amount ? expense : highest,
        null
      ),
    [expenses]
  );

  const walletAdvice = useMemo(() => {
    if (walletBudget <= 0) {
      return "No wallet limit is set yet. Establish a budget to unlock pacing signals.";
    }

    if (weeklyTotal > walletBudget) {
      return `Spending is pacing ${formatCurrency(
        weeklyTotal - walletBudget
      )} ahead of your weekly baseline. Pause non-essential purchases.`;
    }

    return `You have ${formatCurrency(
      walletBudget - weeklyTotal
    )} in safe room left inside this cycle.`;
  }, [walletBudget, weeklyTotal]);

  const goalAdvice = useMemo(() => {
    if (!activeGoal) {
      return "Add an active goal to connect your daily spending choices with a real target.";
    }

    const remaining = Math.max(0, activeGoal.targetAmount - activeGoal.currentAmount);

    if (remaining === 0) {
      return `${activeGoal.goalName} is fully funded. Time to lock in your next milestone.`;
    }

    return `${activeGoal.goalName} needs ${formatCurrency(
      remaining
    )} more. Keep discretionary spending steady to protect this target.`;
  }, [activeGoal]);

  if (loading) {
    return <DashboardPageSkeleton variant="financial-advisor" />;
  }

  return (
    <div className="advisor-page">
      {error ? <div className="advisor-message">{error}</div> : null}

      <section className="advisor-hero">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <p className="advisor-eyebrow" style={{ margin: 0 }}>Financial Advisor</p>
            {aiInsights?.createdAt && (
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "var(--buck-muted)",
                  background: "var(--buck-surface-soft, rgba(255,255,255,0.06))",
                  padding: "0.2rem 0.6rem",
                  borderRadius: "12px",
                }}
              >
                {aiInsights.cached ? "Cached" : "Updated"}: {new Date(aiInsights.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <h2>Advice that sounds like a next step.</h2>
          <p>
            Buck turns your current wallet, expense rhythm, and active goal into
            plain recommendations you can act on today.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            type="button"
            onClick={() => void loadAI(true)}
            disabled={refreshingAi}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--buck-surface-card, rgba(255, 197, 71, 0.12))",
              color: "var(--buck-orange, #f47536)",
              border: "1px solid rgba(244, 117, 54, 0.3)",
              padding: "0.6rem 1rem",
              borderRadius: "10px",
              cursor: refreshingAi ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
              transition: "all 0.2s ease",
            }}
          >
            <FaSyncAlt style={{ animation: refreshingAi ? "spin 1s linear infinite" : "none" }} />
            {refreshingAi ? "Analyzing..." : "Refresh Advice"}
          </button>

          <div className="advisor-score">
            <span>Health Score</span>
            <strong>
              {aiInsights?.financialHealthScore !== null &&
              aiInsights?.financialHealthScore !== undefined
                ? `${aiInsights.financialHealthScore}`
                : `${goalProgress}%`}
            </strong>
          </div>
        </div>
      </section>

      <section className="advisor-grid">
        <article className="advisor-card">
          <span className="advisor-icon">
            <FaWallet aria-hidden="true" />
          </span>
          <p className="advisor-eyebrow">Wallet room</p>
          <h3>{formatCurrency(walletBudget)}</h3>
          <p>{walletAdvice}</p>
        </article>

        <article className="advisor-card">
          <span className="advisor-icon">
            <FaReceipt aria-hidden="true" />
          </span>
          <p className="advisor-eyebrow">This week</p>
          <h3>{formatCurrency(weeklyTotal)}</h3>
          <p>
            {highestExpense
              ? `Largest recent expense: ${highestExpense.description || highestExpense.category} at ${formatCurrency(highestExpense.amount)}.`
              : "No recent spending yet. Add expenses so advice can sharpen."}
          </p>
        </article>

        <article className="advisor-card">
          <span className="advisor-icon">
            <FaBullseye aria-hidden="true" />
          </span>
          <p className="advisor-eyebrow">Goal protection</p>
          <h3>{activeGoal?.goalName || "No active goal"}</h3>
          <p>{goalAdvice}</p>
        </article>
      </section>

      <div className="advisor-ai-grid">
        <section className="advisor-card advisor-card--wide" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="advisor-icon">
            <FaLightbulb aria-hidden="true" />
          </span>
          <div>
            <p className="advisor-eyebrow">AI Suggestion</p>
            <h3>What to do next</h3>
            <p style={{ minHeight: '80px', marginTop: '1rem' }}>
              {loadingAi || refreshingAi ? "Analyzing your financial data..." : aiInsights?.suggestion}
            </p>
          </div>
        </section>

        <section className="advisor-card advisor-card--wide" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="advisor-icon" style={{ background: 'var(--buck-gold)', color: 'var(--buck-ink)' }}>
            <FaReceipt aria-hidden="true" />
          </span>
          <div>
            <p className="advisor-eyebrow" style={{ color: 'var(--buck-gold)' }}>AI Advice</p>
            <h3>Detailed Analysis</h3>
            <p style={{ minHeight: '80px', marginTop: '1rem' }}>
              {loadingAi || refreshingAi ? "Generating deep-dive analysis..." : aiInsights?.advice}
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
