"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  FaBullseye,
  FaCommentDots,
  FaLightbulb,
  FaReceipt,
  FaWallet,
  FaSyncAlt,
} from "react-icons/fa";
import InfoTip from "@/component/InfoTip";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useDashboardUser } from "@/context/DashboardUserContext";
import {
  mergeDashboardDataCache,
  useFinancial,
} from "@/context/FinancialContext";
import { toNumber } from "@/utils/formatters";
import {
  getActiveWalletId,
  listExpenses,
  listGoals,
  listWallets,
  subscribeUserTable,
  type BuckExpense,
  type BuckGoal,
  type BuckWallet,
} from "@/utils/supabaseData";
import { fetchAIAdvisorInsights, type AIAdvisorInsights } from "@/utils/advisorApi";
import { useToast } from "@/component/toast";
import "./style.css";

/** Opens the floating AI Advisor chat (AIChatBubble listens for it). */
const OPEN_AI_CHAT_EVENT = "open-ai-chat";

const pesoFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Every ₱ figure on this page shows exactly 2 decimals. */
function peso(value: number | string | null | undefined) {
  return `₱${pesoFormatter.format(toNumber(value))}`;
}

/** "YYYY-MM-DD" in local time (expense dates are calendar days, not instants). */
function dayKey(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function daysAgoKey(days: number) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dayKey(d);
}

/** Monday of the current week. */
function weekStartKey() {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return dayKey(d);
}

function totalSince(expenses: BuckExpense[], fromKey: string) {
  const today = dayKey(new Date());
  return expenses.reduce((sum, e) => {
    const key = e.date.slice(0, 10);
    return key >= fromKey && key <= today ? sum + toNumber(e.amount) : sum;
  }, 0);
}

function shortDate(key: string) {
  const d = new Date(`${key.slice(0, 10)}T00:00:00`);
  return Number.isNaN(d.getTime())
    ? key
    : d.toLocaleDateString("en-PH", { month: "short", day: "numeric" });
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
  const [wallets, setWallets] = useState<BuckWallet[]>(
    () => (userCache.wallets ?? []).filter((w) => !w.deletedAt)
  );
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  const [loading, setLoading] = useState(() => !hasInitialAdvisorData);
  const [error, setError] = useState("");
  const hadInitialAdvisorData = useRef(hasInitialAdvisorData);

  const [aiInsights, setAiInsights] = useState<AIAdvisorInsights | null>(
    () => userCache.aiInsights ?? null
  );
  const [loadingAi, setLoadingAi] = useState(() => !userCache.aiInsights);
  const [refreshingAi, setRefreshingAi] = useState(false);

  const loadAI = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshingAi(true);
    } else {
      if (!userCache.aiInsights) {
        setLoadingAi(true);
      }
    }
    try {
      const insights = await fetchAIAdvisorInsights({
        userId: user.uid,
        forceRefresh,
      });
      setAiInsights(insights);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          aiInsights: insights,
        })
      );
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
      const [allWallets, nextActiveId] = await Promise.all([
        listWallets(user.uid),
        getActiveWalletId(user.uid),
      ]);
      const liveWallets = allWallets.filter((w) => !w.deletedAt);
      const nextWalletBudget =
        liveWallets.find((w) => w.id === nextActiveId)?.budget ?? 0;

      if (!active) {
        return;
      }

      setWallets(liveWallets);
      setActiveWalletId(nextActiveId);
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
    // Subscribe once per user; loadAI is recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [setDashboardCache, user.uid]);

  const activeGoal = useMemo(
    () => goals.find((goal) => goal.isActive && !goal.completed) ?? goals[0],
    [goals]
  );
  const weekStart = weekStartKey();
  const weeklyTotal = useMemo(() => totalSince(expenses, weekStart), [expenses, weekStart]);
  const last7Total = useMemo(() => totalSince(expenses, daysAgoKey(6)), [expenses]);
  // Days counted so far this week (Monday = 1), for the daily average.
  const daysThisWeek = ((new Date().getDay() + 6) % 7) + 1;
  const weeklyDailyAverage = weeklyTotal / daysThisWeek;
  const goalProgress = getGoalProgress(activeGoal);
  const goalRemaining = activeGoal
    ? Math.max(0, activeGoal.targetAmount - activeGoal.currentAmount)
    : 0;
  // Largest expense in the last 30 days (not all time), with its date.
  const highestExpense = useMemo(() => {
    const from = daysAgoKey(29);
    return expenses
      .filter((e) => e.date.slice(0, 10) >= from)
      .reduce<BuckExpense | null>(
        (highest, e) => (!highest || e.amount > highest.amount ? e : highest),
        null
      );
  }, [expenses]);

  const activeWallet = wallets.find((w) => w.id === activeWalletId) ?? null;
  const otherWallets = wallets
    .filter((w) => w.id !== activeWalletId)
    .sort((a, b) => b.budget - a.budget);
  const totalBalance = wallets.reduce((sum, w) => sum + toNumber(w.budget), 0);

  const walletAdvice = useMemo(() => {
    if (aiInsights?.walletAdvice) return aiInsights.walletAdvice;
    if (wallets.length === 0) return "Add a wallet so Buck can track where your spending comes from.";
    if (!activeWallet) return "Pick an active wallet on the Wallet tab so daily spending comes from one place.";
    const keep = otherWallets[0];
    return keep
      ? `Spend day to day from ${activeWallet.name}. Keep ${keep.name} for savings or emergencies.`
      : `All spending comes from ${activeWallet.name}. Add a second wallet to keep savings separate.`;
  }, [aiInsights?.walletAdvice, wallets.length, activeWallet, otherWallets]);

  const analysisPeriod = aiInsights?.period
    ? `Figures cover ${shortDate(aiInsights.period.monthStart)}–${shortDate(aiInsights.period.asOf)} this month and your last 30 days of expenses.`
    : null;

  const goalAdvice = useMemo(() => {
    if (!activeGoal) {
      return "Add an active goal to connect your daily spending choices with a real target.";
    }

    const remaining = Math.max(0, activeGoal.targetAmount - activeGoal.currentAmount);

    if (remaining === 0) {
      return `${activeGoal.goalName} is fully funded. Time to lock in your next milestone.`;
    }

    return `${activeGoal.goalName} needs ${peso(
      remaining
    )} more. Keep discretionary spending steady to protect this target.`;
  }, [activeGoal]);

  if (loading) {
    return <DashboardPageSkeleton variant="financial-advisor" />;
  }

  const aiBusy = loadingAi || refreshingAi;

  return (
    <div className="advisor-page">
      {error ? <div className="advisor-message">{error}</div> : null}

      <section className="advisor-hero">
        <div className="advisor-hero__copy">
          <p className="advisor-eyebrow">Financial Advisor</p>
          <h2>Advice that sounds like a next step.</h2>
          <p className="advisor-hero__lead">
            Buck turns your current wallet, expense rhythm, and active goal into
            plain recommendations you can act on today.
          </p>
        </div>

        <div className="advisor-hero__side">
          <div className="advisor-hero__actions">
            {aiInsights?.createdAt ? (
              <span className="advisor-pill">
                {aiInsights.cached ? "Cached" : "Updated"}{" "}
                {new Date(aiInsights.createdAt).toLocaleDateString("en-PH", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            ) : null}
            <button
              type="button"
              className="advisor-refresh"
              onClick={() => void loadAI(true)}
              disabled={refreshingAi}
            >
              <FaSyncAlt
                aria-hidden="true"
                className={refreshingAi ? "advisor-spin" : undefined}
              />
              {refreshingAi ? "Analyzing..." : "Refresh Advice"}
            </button>
          </div>

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
        <article className="advisor-card advisor-stat">
          <header className="advisor-stat__head">
            <span className="advisor-icon">
              <FaWallet aria-hidden="true" />
            </span>
            <p className="advisor-eyebrow advisor-eyebrow--tip">
              Wallet room
              <InfoTip label="About wallet room">
                Balance of your active wallet (the one expenses are taken from). Other wallets are listed
                below; total is across all wallets. Switch the active wallet on the Wallet tab.
              </InfoTip>
            </p>
          </header>
          <h3 className="advisor-stat__value">{peso(walletBudget)}</h3>
          <p className="advisor-stat__meta">
            {activeWallet ? `Active: ${activeWallet.name}` : "No active wallet"}
            {wallets.length > 1 ? ` · Total ${peso(totalBalance)}` : ""}
          </p>
          {otherWallets.length > 0 ? (
            <ul className="advisor-sublist" aria-label="Other wallets">
              {otherWallets.slice(0, 3).map((w) => (
                <li key={w.id} className={toNumber(w.budget) <= 0 ? "is-empty" : undefined}>
                  <span>{w.name}</span>
                  <span>{peso(w.budget)}</span>
                </li>
              ))}
              {otherWallets.length > 3 ? (
                <li className="is-empty">
                  <span>+{otherWallets.length - 3} more on the Wallet tab</span>
                </li>
              ) : null}
            </ul>
          ) : null}
          <p className="advisor-stat__body">{walletAdvice}</p>
        </article>

        <article className="advisor-card advisor-stat">
          <header className="advisor-stat__head">
            <span className="advisor-icon">
              <FaReceipt aria-hidden="true" />
            </span>
            <p className="advisor-eyebrow advisor-eyebrow--tip">
              This week
              <InfoTip label="About this week">
                Total spent from Monday ({shortDate(weekStart)}) to today. Last 7 days counts the 7 days up to
                today, so it can include last week. Largest expense looks at the last 30 days.
              </InfoTip>
            </p>
          </header>
          <h3 className="advisor-stat__value">{peso(weeklyTotal)}</h3>
          <p className="advisor-stat__meta">Since Mon, {shortDate(weekStart)}</p>
          <ul className="advisor-sublist" aria-label="Weekly spending details">
            <li>
              <span>Last 7 days</span>
              <span>{peso(last7Total)}</span>
            </li>
            <li>
              <span>
                Daily average ({daysThisWeek} {daysThisWeek === 1 ? "day" : "days"})
              </span>
              <span>{peso(weeklyDailyAverage)}</span>
            </li>
          </ul>
          <p className="advisor-stat__body">
            {highestExpense
              ? `Largest in the last 30 days: ${highestExpense.description || highestExpense.category} at ${peso(highestExpense.amount)} on ${shortDate(highestExpense.date)}.`
              : "No expenses in the last 30 days. Add expenses so advice can sharpen."}
          </p>
        </article>

        <article className="advisor-card advisor-stat">
          <header className="advisor-stat__head">
            <span className="advisor-icon">
              <FaBullseye aria-hidden="true" />
            </span>
            <p className="advisor-eyebrow">Goal protection</p>
          </header>
          <h3 className="advisor-stat__value advisor-stat__value--name">
            {activeGoal?.goalName || "No active goal"}
          </h3>
          <p className="advisor-stat__meta">
            {activeGoal
              ? `${peso(activeGoal.currentAmount)} of ${peso(activeGoal.targetAmount)} saved`
              : "Set one on the Goals tab"}
          </p>
          {activeGoal ? (
            <>
              <div className="advisor-progress">
                <div
                  className="advisor-progress__track"
                  role="progressbar"
                  aria-label={`${activeGoal.goalName} progress`}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={goalProgress}
                >
                  <span style={{ width: `${goalProgress}%` }} />
                </div>
                <span className="advisor-progress__value">{goalProgress}%</span>
              </div>
              <ul className="advisor-sublist" aria-label="Goal details">
                <li>
                  <span>Remaining</span>
                  <span>{peso(goalRemaining)}</span>
                </li>
                {activeGoal.targetDate ? (
                  <li>
                    <span>Target date</span>
                    <span>{shortDate(activeGoal.targetDate)}</span>
                  </li>
                ) : null}
              </ul>
            </>
          ) : null}
          <p className="advisor-stat__body">{goalAdvice}</p>
        </article>
      </section>

      <div className="advisor-ai-grid">
        <section className="advisor-card advisor-next" aria-labelledby="advisor-next-title">
          <header className="advisor-stat__head">
            <span className="advisor-icon advisor-icon--solid">
              <FaLightbulb aria-hidden="true" />
            </span>
            <div>
              <p className="advisor-eyebrow">AI Suggestion</p>
              <h3 id="advisor-next-title">What to do next</h3>
            </div>
          </header>
          <p className="advisor-next__text">
            {aiBusy
              ? "Analyzing your financial data..."
              : aiInsights?.suggestion || "No suggestion yet. Refresh to generate one."}
          </p>
          <button
            type="button"
            className="advisor-next__ask"
            onClick={() => window.dispatchEvent(new Event(OPEN_AI_CHAT_EVENT))}
          >
            <FaCommentDots aria-hidden="true" />
            Ask the Advisor about this
          </button>
        </section>

        <section className="advisor-card advisor-analysis" aria-labelledby="advisor-analysis-title">
          <header className="advisor-stat__head">
            <span className="advisor-icon advisor-icon--gold">
              <FaReceipt aria-hidden="true" />
            </span>
            <div>
              <p className="advisor-eyebrow advisor-eyebrow--gold">AI Advice</p>
              <h3 id="advisor-analysis-title">Detailed Analysis</h3>
            </div>
          </header>
          <p className="advisor-analysis__text">
            {aiBusy ? "Generating deep-dive analysis..." : aiInsights?.advice}
          </p>
          {analysisPeriod && !aiBusy ? (
            <p className="advisor-footnote">{analysisPeriod}</p>
          ) : null}
        </section>
      </div>
    </div>
  );
}
