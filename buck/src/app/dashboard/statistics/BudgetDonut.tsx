"use client";
import React from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import { formatCurrency } from "@/utils/formatters";

ChartJS.register(ArcElement, Tooltip);

export type BudgetLevel = "safe" | "caution" | "critical" | "none";

// SRS 3.7: amber at 80% of budget, crimson at 100%.
export function getBudgetLevel(spent: number, budget: number): BudgetLevel {
  if (budget <= 0) return "none";
  const ratio = spent / budget;
  if (ratio >= 1) return "critical";
  if (ratio >= 0.8) return "caution";
  return "safe";
}

const LEVEL_COLORS: Record<BudgetLevel, string> = {
  safe: "#f47536",
  caution: "#f59e0b",
  critical: "#ff3838",
  none: "#f47536",
};

interface BudgetDonutProps {
  spent: number;
  budget: number;
}

/** Spent vs remaining budget for the selected period. */
export default function BudgetDonut({ spent, budget }: BudgetDonutProps) {
  const isDarkTheme = useAuthPageTheme();
  const trackColor = isDarkTheme ? "rgba(255,211,154,0.14)" : "rgba(120,92,70,0.12)";
  const level = getBudgetLevel(spent, budget);
  const hasBudget = budget > 0;
  const usedPct = hasBudget ? (spent / budget) * 100 : 0;
  const remaining = Math.max(budget - spent, 0);

  const values = hasBudget ? [Math.min(spent, budget), remaining] : [spent || 1, 0];
  const data = {
    labels: ["Spent", "Remaining"],
    datasets: [
      {
        data: values,
        backgroundColor: [spent > 0 ? LEVEL_COLORS[level] : trackColor, trackColor],
        borderWidth: 0,
        hoverOffset: 4,
      },
    ],
  };

  return (
    <div className="stats-donut">
      <Doughnut
        data={data}
        options={{
          cutout: "74%",
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              enabled: hasBudget && spent > 0,
              callbacks: {
                label: (ctx) =>
                  ctx.dataIndex === 0
                    ? `Spent: ${formatCurrency(spent)}`
                    : `Remaining: ${formatCurrency(remaining)}`,
              },
            },
          },
        }}
      />
      <div className="stats-donut-center" aria-hidden="true">
        {hasBudget ? (
          <>
            <strong className={`stats-donut-value stats-level--${level}`}>
              {Math.round(usedPct)}%
            </strong>
            <span>of budget used</span>
          </>
        ) : (
          <>
            <strong className="stats-donut-value stats-donut-value--currency">
              {formatCurrency(spent)}
            </strong>
            <span>spent</span>
          </>
        )}
      </div>
    </div>
  );
}
