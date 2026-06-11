"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useDashboardUser } from "@/context/DashboardUserContext";
import { formatCurrency, toNumber } from "@/utils/formatters";
import {
  ensureDefaultCategories,
  getUserAvatarSignedUrl,
  getUserProfile,
  listExpenses,
  subscribeUserTable,
  type BuckCategory,
  type BuckExpense,
  type BuckProfile,
} from "@/utils/supabaseData";
import "./style.css";

type Category = BuckCategory;
type Expense = BuckExpense;

type WeeklyDatum = {
  day: string;
  amount: number;
};

type SummaryItem = {
  label: string;
  amount: number;
  description: string;
};

const weekDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const categoryDescriptions: Record<string, string> = {
  Food: "Meals, snacks, and groceries.",
  Fare: "Public transport and commuting costs.",
  "Gas Money": "Fuel and vehicle costs.",
  "Video Games": "Game purchases and in-game spending.",
  Shopping: "Clothes, gadgets, and personal shopping.",
  Bills: "Utilities, rent, and recurring payments.",
  Other: "Miscellaneous expenses.",
};

function getCurrentWeekRange() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(today.getDate() - ((today.getDay() + 6) % 7));
  start.setHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);

  return { start, end };
}

function parseExpenseDate(expense: Expense) {
  if (!expense.date) return null;

  const date = new Date(expense.date);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isSameCalendarDate(first: Date, second: Date) {
  return (
    first.getDate() === second.getDate() &&
    first.getMonth() === second.getMonth() &&
    first.getFullYear() === second.getFullYear()
  );
}

function getWeeklyExpenses(expenses: Expense[]) {
  const { start, end } = getCurrentWeekRange();

  return expenses.filter((expense) => {
    const expenseDate = parseExpenseDate(expense);
    return expenseDate ? expenseDate >= start && expenseDate <= end : false;
  });
}

function getWeeklyData(weeklyExpenses: Expense[]) {
  const { start } = getCurrentWeekRange();

  return weekDays.map((day, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);

    const amount = weeklyExpenses
      .filter((expense) => {
        const expenseDate = parseExpenseDate(expense);
        return expenseDate ? isSameCalendarDate(expenseDate, date) : false;
      })
      .reduce((sum, expense) => sum + toNumber(expense.amount), 0);

    return { day, amount };
  });
}

function getSummaryData(categories: Category[], expenses: Expense[]) {
  return categories
    .map<SummaryItem>((category) => {
      const amount = expenses
        .filter((expense) => expense.category === category.name)
        .reduce((sum, expense) => sum + toNumber(expense.amount), 0);

      return {
        label: category.name,
        amount,
        description:
          categoryDescriptions[category.name] || "Custom budget category.",
      };
    })
    .filter((item) => item.amount > 0);
}

function WeeklyBarChart({ data }: { data: WeeklyDatum[] }) {
  const maxAmount = Math.max(30, ...data.map((item) => item.amount));
  const yLabels = Array.from({ length: 7 }, (_, index) =>
    Math.round(maxAmount - (maxAmount / 6) * index)
  );
  const hasData = data.some((item) => item.amount > 0);

  return (
    <div className="graph-container">
      <div className="graph-axis" aria-hidden="true">
        {yLabels.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>

      <div className="graph-bars">
        {hasData ? (
          data.map((item) => {
            const height = maxAmount === 0 ? 0 : (item.amount / maxAmount) * 100;
            const barStyle = { "--bar-height": `${height}%` } as CSSProperties;

            return (
              <div
                key={item.day}
                className="graph-bar"
                style={barStyle}
                title={`${item.day}: ${formatCurrency(item.amount)}`}
              >
                <span className="graph-bar-label">{item.day}</span>
              </div>
            );
          })
        ) : (
          <div className="empty-chart-state">No data available</div>
        )}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user } = useDashboardUser();
  const [categories, setCategories] = useState<Category[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [profile, setProfile] = useState<BuckProfile | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loadingDashboardData, setLoadingDashboardData] = useState(true);

  useEffect(() => {
    let active = true;

    const loadProfile = async () => {
      const loadedProfile = await getUserProfile(user.uid);
      const signedAvatarUrl = await getUserAvatarSignedUrl(
        loadedProfile.avatarPath
      );

      if (active) {
        setProfile(loadedProfile);
        setAvatarUrl(signedAvatarUrl);
      }
    };

    const loadCategories = async () => {
      const nextCategories = await ensureDefaultCategories(user.uid);

      if (active) {
        setCategories(nextCategories);
      }
    };

    const loadExpenses = async () => {
      const nextExpenses = await listExpenses(user.uid);

      if (active) {
        setExpenses(nextExpenses);
      }
    };

    const loadInitialData = async () => {
      setLoadingDashboardData(true);

      try {
        await Promise.all([loadProfile(), loadCategories(), loadExpenses()]);
      } catch (error) {
        console.error("Failed to load dashboard:", error);
      } finally {
        if (active) {
          setLoadingDashboardData(false);
        }
      }
    };

    void loadInitialData();

    const unsubscribeCategories = subscribeUserTable(
      "categories",
      user.uid,
      () => void loadCategories()
    );
    const unsubscribeExpenses = subscribeUserTable(
      "expenses",
      user.uid,
      () => void loadExpenses()
    );
    const unsubscribeProfile = subscribeUserTable(
      "profiles",
      user.uid,
      () => void loadProfile()
    );

    return () => {
      active = false;
      unsubscribeCategories();
      unsubscribeExpenses();
      unsubscribeProfile();
    };
  }, [user]);

  const weeklyExpenses = useMemo(() => getWeeklyExpenses(expenses), [expenses]);
  const weeklyData = useMemo(
    () => getWeeklyData(weeklyExpenses),
    [weeklyExpenses]
  );
  const totalWeeklySpending = useMemo(
    () =>
      weeklyExpenses.reduce(
        (sum, expense) => sum + toNumber(expense.amount),
        0
      ),
    [weeklyExpenses]
  );
  const summaryData = useMemo(
    () => getSummaryData(categories, expenses),
    [categories, expenses]
  );

  if (loadingDashboardData) {
    return <DashboardPageSkeleton variant="home" />;
  }

  const displayName =
    profile?.username || user.displayName || user.email || "friend";

  return (
    <div className="dashboard-container">
        <section className="dashboard-welcome-card">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="dashboard-welcome-avatar" />
          ) : (
            <Image
              src="/BuckMascot.png"
              alt=""
              width={64}
              height={64}
              className="dashboard-welcome-avatar dashboard-welcome-avatar--fallback"
              priority
            />
          )}
          <div>
            <p className="dashboard-welcome-kicker">Welcome back</p>
            <h1 className="dashboard-welcome-greeting">{displayName}</h1>
          </div>
        </section>

        <section className="dashboard-content" aria-label="Weekly overview">
          <article className="spending-card">
            <p className="card-eyebrow">Weekly Spending</p>
            <div className="spending-circle">
              <div className="spending-amount">
                {totalWeeklySpending > 0
                  ? formatCurrency(totalWeeklySpending)
                  : "No Data"}
              </div>
            </div>
            <p className="spending-label">Total spent this week</p>
          </article>

          <article className="graph-card">
            <div className="card-heading">
              <p className="card-eyebrow">Weekly Summary</p>
              <h2 className="graph-title">Expenses by day</h2>
            </div>
            <WeeklyBarChart data={weeklyData} />
          </article>
        </section>

        <section className="summary-card">
          <div className="card-heading">
            <p className="card-eyebrow">Categories</p>
            <h2 className="summary-title">Financial Summary</h2>
          </div>
          <div className="summary-content">
            {summaryData.length > 0 ? (
              summaryData.map((item) => (
                <article key={item.label} className="summary-item">
                  <div className="summary-item-value">
                    {formatCurrency(item.amount)}
                  </div>
                  <div className="summary-item-label">{item.label}</div>
                  <p className="summary-item-description">
                    {item.description}
                  </p>
                </article>
              ))
            ) : (
              <div className="empty-summary-state">
                No summary data available
              </div>
            )}
          </div>
        </section>
    </div>
  );
}
