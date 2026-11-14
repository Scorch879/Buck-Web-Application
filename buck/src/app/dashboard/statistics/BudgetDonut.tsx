"use client";
import React from "react";
import { Doughnut } from "react-chartjs-2";
import { Chart as ChartJS, ArcElement, Tooltip } from "chart.js";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import {
  BUDGET_LEVEL_COLORS,
  getBudgetLevel,
  type BudgetLevel,
} from "@/utils/categoryUtils";
import { buckTooltip } from "@/utils/chartTheme";
import { formatCurrency } from "@/utils/formatters";

ChartJS.register(ArcElement, Tooltip);

export { getBudgetLevel, type BudgetLevel };

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
        backgroundColor: [spent > 0 ? BUDGET_LEVEL_COLORS[level] : trackColor, trackColor],
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
          resizeDelay: 100,
          // Room for the hover offset so the lifted arc is never clipped.
          layout: { padding: 6 },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...buckTooltip(isDarkTheme),
              enabled: hasBudget && spent > 0,
              callbacks: {
                // The label already names the slice; a title would repeat it.
                title: () => "",
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
