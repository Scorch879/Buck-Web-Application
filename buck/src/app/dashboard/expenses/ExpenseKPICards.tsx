"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import {
  FaWallet,
  FaReceipt,
  FaChartLine,
  FaCheckCircle,
  FaExclamationTriangle,
  FaInfoCircle,
  FaFireAlt,
} from "react-icons/fa";
import { formatCurrency, toNumber } from "@/utils/formatters";
import type { BuckExpense, BuckWallet } from "@/utils/supabaseData";

interface ExpenseKPICardsProps {
  walletBudget: number;
  totalTracked: number;
  averageExpense: number;
  activeWallet?: BuckWallet | null;
  expenses: BuckExpense[];
}

export default function ExpenseKPICards({
  walletBudget,
  totalTracked,
  averageExpense,
  activeWallet,
  expenses,
}: ExpenseKPICardsProps) {
  // 1. Compute Wallet Utilization Metrics
  const {
    spentFromWallet,
    totalWalletCapacity,
    percentRemaining,
    percentSpent,
    walletHealthStatus,
  } = useMemo(() => {
    // Deduce spending tied to active wallet or total if only 1 wallet exists
    const activeWalletId = activeWallet?.id;
    const walletExpenses = activeWalletId
      ? expenses.filter((e) => e.walletId === activeWalletId)
      : expenses;

    const spent = walletExpenses.reduce(
      (sum, e) => sum + toNumber(e.amount),
      0
    );
    const capacity = walletBudget + spent;

    let pctRemaining = 100;
    if (capacity > 0) {
      pctRemaining = Math.min(100, Math.max(0, Math.round((walletBudget / capacity) * 100)));
    } else if (walletBudget <= 0) {
      pctRemaining = 0;
    }

    const pctSpent = Math.max(0, 100 - pctRemaining);

    let status: {
      label: string;
      color: "safe" | "warning" | "danger" | "neutral";
      icon: React.ReactNode;
    } = {
      label: "Healthy",
      color: "safe",
      icon: <FaCheckCircle aria-hidden="true" />,
    };

    if (!activeWallet) {
      status = {
        label: "No Wallet Selected",
        color: "neutral",
        icon: <FaInfoCircle aria-hidden="true" />,
      };
    } else if (walletBudget <= 0) {
      status = {
        label: "Depleted",
        color: "danger",
        icon: <FaExclamationTriangle aria-hidden="true" />,
      };
    } else if (pctRemaining <= 15) {
      status = {
        label: "Critical (<15%)",
        color: "danger",
        icon: <FaExclamationTriangle aria-hidden="true" />,
      };
    } else if (pctRemaining <= 35) {
      status = {
        label: "Caution (<35%)",
        color: "warning",
        icon: <FaExclamationTriangle aria-hidden="true" />,
      };
    }

    return {
      spentFromWallet: spent,
      totalWalletCapacity: capacity,
      percentRemaining: pctRemaining,
      percentSpent: pctSpent,
      walletHealthStatus: status,
    };
  }, [activeWallet, expenses, walletBudget]);

  // 2. Compute 7-Day Spending Micro-Histogram & Monthly Velocity
  const { last7Days, maxDailySpend, weekTotal, monthTotal } = useMemo(() => {
    const today = new Date();
    today.setHours(23, 59, 59, 999);

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth();

    // Last 7 days array
    const days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (6 - i));
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const date = String(d.getDate()).padStart(2, "0");
      const dateStr = `${year}-${month}-${date}`;
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "narrow" }); // M, T, W, T, F, S, S

      const dayExpenses = expenses.filter((e) => e.date === dateStr);
      const dayAmount = dayExpenses.reduce(
        (sum, e) => sum + toNumber(e.amount),
        0
      );

      return {
        dateStr,
        dayLabel,
        dayAmount,
      };
    });

    const maxSpend = Math.max(...days.map((d) => d.dayAmount), 1);
    const sumWeek = days.reduce((sum, d) => sum + d.dayAmount, 0);

    // Month Total
    const sumMonth = expenses
      .filter((e) => {
        if (!e.date) return false;
        const d = new Date(e.date);
        return (
          !Number.isNaN(d.getTime()) &&
          d.getFullYear() === currentYear &&
          d.getMonth() === currentMonth
        );
      })
      .reduce((sum, e) => sum + toNumber(e.amount), 0);

    return {
      last7Days: days,
      maxDailySpend: maxSpend,
      weekTotal: sumWeek,
      monthTotal: sumMonth,
    };
  }, [expenses]);

  // 3. Compute Min / Max & Outlier Metrics for Average Card
  const { minExpense, maxExpense, maxExpenseItem, positionRatio } = useMemo(() => {
    if (!expenses.length) {
      return {
        minExpense: 0,
        maxExpense: 0,
        maxExpenseItem: null,
        positionRatio: 50,
      };
    }

    let min = Infinity;
    let max = -Infinity;
    let topItem: BuckExpense | null = null;

    for (const exp of expenses) {
      const amt = toNumber(exp.amount);
      if (amt < min) min = amt;
      if (amt > max) {
        max = amt;
        topItem = exp;
      }
    }

    const safeMin = Number.isFinite(min) ? min : 0;
    const safeMax = Number.isFinite(max) ? max : 0;
    const range = safeMax - safeMin;
    const ratio =
      range > 0
        ? Math.min(100, Math.max(5, ((averageExpense - safeMin) / range) * 100))
        : 50;

    return {
      minExpense: safeMin,
      maxExpense: safeMax,
      maxExpenseItem: topItem,
      positionRatio: ratio,
    };
  }, [averageExpense, expenses]);

  return (
    <section className="expenses-kpi-grid" aria-label="Expenses KPI and Data Visualizations">
      {/* ── CARD 1: WALLET BALANCE & UTILIZATION ── */}
      <article className="expenses-kpi-card expenses-kpi-card--wallet">
        <div className="expenses-kpi-header">
          <div className="expenses-kpi-icon-wrapper expenses-kpi-icon-wrapper--wallet">
            <FaWallet aria-hidden="true" />
          </div>
          <div className="expenses-kpi-title-block">
            <span className="expenses-kpi-subtitle">
              {activeWallet ? activeWallet.name : "Active Wallet"}
            </span>
            <h3 className="expenses-kpi-title">Wallet Balance</h3>
          </div>
          <span
            className={`expenses-kpi-badge expenses-kpi-badge--${walletHealthStatus.color}`}
          >
            {walletHealthStatus.icon}
            {walletHealthStatus.label}
          </span>
        </div>

        <div className="expenses-kpi-primary-val">
          <strong>{formatCurrency(walletBudget)}</strong>
          <span className="expenses-kpi-subtext">
            {percentRemaining}% remaining of initial capacity
          </span>
        </div>

        {/* Visual Progress Bar Meter */}
        <div className="expenses-kpi-visual">
          <div
            className="expenses-kpi-progress-track"
            role="progressbar"
            aria-valuenow={percentRemaining}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Wallet budget remaining capacity"
          >
            <motion.div
              className={`expenses-kpi-progress-fill expenses-kpi-progress-fill--${walletHealthStatus.color}`}
              initial={{ width: 0 }}
              animate={{ width: `${percentRemaining}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
            {/* Threshold Ticks */}
            <span className="expenses-kpi-tick" style={{ left: "25%" }} />
            <span className="expenses-kpi-tick" style={{ left: "50%" }} />
            <span className="expenses-kpi-tick" style={{ left: "75%" }} />
          </div>

          <div className="expenses-kpi-meta-split">
            <div className="expenses-kpi-meta-item">
              <span className="expenses-kpi-dot expenses-kpi-dot--gold" />
              <span>Available: <strong>{formatCurrency(walletBudget)}</strong></span>
            </div>
            <div className="expenses-kpi-meta-item">
              <span className="expenses-kpi-dot expenses-kpi-dot--spent" />
              <span>Spent: <strong>{formatCurrency(spentFromWallet)}</strong></span>
            </div>
          </div>
        </div>
      </article>

      {/* ── CARD 2: TOTAL TRACKED & 7-DAY VELOCITY ── */}
      <article className="expenses-kpi-card expenses-kpi-card--tracked">
        <div className="expenses-kpi-header">
          <div className="expenses-kpi-icon-wrapper expenses-kpi-icon-wrapper--tracked">
            <FaReceipt aria-hidden="true" />
          </div>
          <div className="expenses-kpi-title-block">
            <span className="expenses-kpi-subtitle">Cumulative Log</span>
            <h3 className="expenses-kpi-title">Total Tracked</h3>
          </div>
          <span className="expenses-kpi-badge expenses-kpi-badge--neutral">
            {expenses.length} {expenses.length === 1 ? "entry" : "entries"}
          </span>
        </div>

        <div className="expenses-kpi-primary-val">
          <strong>{formatCurrency(totalTracked)}</strong>
          <span className="expenses-kpi-subtext">
            7-Day spend: <strong>{formatCurrency(weekTotal)}</strong>
          </span>
        </div>

        {/* Visual 7-Day Micro-Bar Sparkline */}
        <div className="expenses-kpi-visual">
          <div
            className="expenses-kpi-sparkline"
            aria-label="7-day spending distribution sparkline"
          >
            {last7Days.map((d, index) => {
              const heightPct =
                d.dayAmount > 0
                  ? Math.max(18, Math.round((d.dayAmount / maxDailySpend) * 100))
                  : 10;
              const hasSpend = d.dayAmount > 0;

              return (
                <div
                  key={index}
                  className="expenses-kpi-spark-bar-wrapper"
                  title={`${d.dateStr}: ${formatCurrency(d.dayAmount)}`}
                >
                  <motion.div
                    className={`expenses-kpi-spark-bar ${
                      hasSpend ? "expenses-kpi-spark-bar--active" : "expenses-kpi-spark-bar--empty"
                    }`}
                    initial={{ height: 0 }}
                    animate={{ height: `${heightPct}%` }}
                    transition={{ duration: 0.5, delay: index * 0.06 }}
                  />
                  <span className="expenses-kpi-spark-label">{d.dayLabel}</span>
                </div>
              );
            })}
          </div>

          <div className="expenses-kpi-meta-split">
            <div className="expenses-kpi-meta-item">
              <span className="expenses-kpi-dot expenses-kpi-dot--orange" />
              <span>This Month: <strong>{formatCurrency(monthTotal)}</strong></span>
            </div>
            <div className="expenses-kpi-meta-item">
              <span className="expenses-kpi-micro-hint">Daily Average: {formatCurrency(weekTotal / 7)}</span>
            </div>
          </div>
        </div>
      </article>

      {/* ── CARD 3: AVERAGE EXPENSE & BENCHMARK RANGE ── */}
      <article className="expenses-kpi-card expenses-kpi-card--average">
        <div className="expenses-kpi-header">
          <div className="expenses-kpi-icon-wrapper expenses-kpi-icon-wrapper--average">
            <FaChartLine aria-hidden="true" />
          </div>
          <div className="expenses-kpi-title-block">
            <span className="expenses-kpi-subtitle">Per Transaction</span>
            <h3 className="expenses-kpi-title">Average Expense</h3>
          </div>
          <span className="expenses-kpi-badge expenses-kpi-badge--insight">
            <FaFireAlt aria-hidden="true" />
            Mean Velocity
          </span>
        </div>

        <div className="expenses-kpi-primary-val">
          <strong>{formatCurrency(averageExpense)}</strong>
          <span className="expenses-kpi-subtext">
            {expenses.length > 0
              ? `Range: ${formatCurrency(minExpense)} to ${formatCurrency(maxExpense)}`
              : "No transaction records"}
          </span>
        </div>

        {/* Visual Range Benchmark Track */}
        <div className="expenses-kpi-visual">
          <div
            className="expenses-kpi-range-track"
            aria-label="Average expense distribution marker between min and max"
          >
            <div className="expenses-kpi-range-line" />
            {expenses.length > 0 ? (
              <motion.div
                className="expenses-kpi-range-pin"
                style={{ left: `${positionRatio}%` }}
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ duration: 0.6, delay: 0.2 }}
                title={`Average: ${formatCurrency(averageExpense)}`}
              >
                <span className="expenses-kpi-range-pin-core" />
              </motion.div>
            ) : null}
          </div>

          <div className="expenses-kpi-meta-split">
            <div className="expenses-kpi-meta-item">
              <span>Min: <strong>{formatCurrency(minExpense)}</strong></span>
            </div>
            <div className="expenses-kpi-meta-item">
              {maxExpenseItem ? (
                <span>
                  Max: <strong>{formatCurrency(maxExpense)}</strong>{" "}
                  <span className="expenses-kpi-top-category">({maxExpenseItem.category})</span>
                </span>
              ) : (
                <span>Max: <strong>₱0.00</strong></span>
              )}
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}
