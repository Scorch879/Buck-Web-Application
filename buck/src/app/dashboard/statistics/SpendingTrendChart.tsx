"use client";
import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type Plugin,
} from "chart.js";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import { formatCurrency } from "@/utils/formatters";
import { getBudgetLevel } from "./BudgetDonut";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

interface SpendingTrendChartProps {
  labels: string[];
  values: number[];
  /**
   * Budget for each bar (same length as `values`). Bars covering fewer days
   * (e.g. the last 2-day block of a month) get a proportionally smaller budget.
   * All zeros hides the budget marker.
   */
  budgets: number[];
  /** Unit shown in the marker label, e.g. "day" or "week". */
  unit: string;
}

// SRS 3.7 thresholds: amber from 80% of the bar's budget, crimson above 100%.
const LEVEL_COLORS = {
  safe: "#f47536",
  caution: "#f59e0b",
  critical: "#ff3838",
  none: "#f47536",
} as const;

/**
 * Spending per day / 7-day block / month. The budget is drawn *behind* the
 * bars as a dashed marker with an inline label, so it reads as a reference
 * line rather than a stray line floating across the chart.
 */
export default function SpendingTrendChart({
  labels,
  values,
  budgets,
  unit,
}: SpendingTrendChartProps) {
  const isDarkTheme = useAuthPageTheme();
  const textColor = isDarkTheme ? "#d9c7b6" : "#756d68";
  const gridColor = isDarkTheme ? "rgba(255,211,154,0.12)" : "rgba(120,92,70,0.12)";
  const markerColor = isDarkTheme ? "#ffc547" : "#b8860b";
  const labelBg = isDarkTheme ? "rgba(38,25,18,0.92)" : "rgba(255,250,246,0.95)";

  const hasBudget = budgets.some((b) => b > 0);
  const uniformBudget =
    hasBudget && budgets.every((b) => Math.abs(b - budgets[0]) < 0.005) ? budgets[0] : null;

  const budgetMarker: Plugin<"bar"> = {
    id: "statsBudgetMarker",
    // Before the bars, so bars sit on top of the reference line.
    beforeDatasetsDraw(chart) {
      if (!hasBudget) return;
      const { ctx, chartArea, scales } = chart;
      const xScale = scales.x;
      const yScale = scales.y;
      ctx.save();
      ctx.strokeStyle = markerColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);

      if (uniformBudget !== null) {
        const y = yScale.getPixelForValue(uniformBudget);
        ctx.beginPath();
        ctx.moveTo(chartArea.left, y);
        ctx.lineTo(chartArea.right, y);
        ctx.stroke();
      } else {
        // Per-bar budgets: a dashed segment across each bar's slot.
        const slot = (chartArea.right - chartArea.left) / Math.max(labels.length, 1);
        budgets.forEach((b, i) => {
          if (b <= 0) return;
          const cx = xScale.getPixelForValue(i);
          const y = yScale.getPixelForValue(b);
          ctx.beginPath();
          ctx.moveTo(cx - slot * 0.38, y);
          ctx.lineTo(cx + slot * 0.38, y);
          ctx.stroke();
        });
      }
      ctx.restore();
    },
    // Label drawn last so bars never cover it.
    afterDatasetsDraw(chart) {
      if (!hasBudget) return;
      const { ctx, chartArea, scales } = chart;
      // Label the full-length budget (per-bar budgets only shrink for short blocks),
      // right-aligned to the end of the last segment that carries it.
      const value = uniformBudget ?? Math.max(...budgets);
      const y = scales.y.getPixelForValue(value);
      const text = `Budget ${formatCurrency(value)}/${unit}`;
      let rightEdge = chartArea.right;
      if (uniformBudget === null) {
        const slot = (chartArea.right - chartArea.left) / Math.max(labels.length, 1);
        const lastFull = budgets.reduce(
          (acc, b, i) => (Math.abs(b - value) < 0.005 ? i : acc),
          budgets.length - 1
        );
        rightEdge = scales.x.getPixelForValue(lastFull) + slot * 0.38;
      }
      ctx.save();
      ctx.font = "600 11px system-ui, -apple-system, Segoe UI, sans-serif";
      const padX = 6;
      const w = ctx.measureText(text).width + padX * 2;
      const h = 18;
      const x = Math.max(chartArea.left, rightEdge - w);
      // Sit just above the line; flip below if it would leave the chart area.
      let top = y - h - 4;
      if (top < chartArea.top) top = y + 4;
      ctx.fillStyle = labelBg;
      ctx.strokeStyle = markerColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.roundRect(x, top, w, h, 4);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = markerColor;
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + padX, top + h / 2);
      ctx.restore();
    },
  };

  const peak = Math.max(...values, ...budgets, 0);
  // Headroom so the inline budget label fits above the line.
  const suggestedMax = Math.max(peak * 1.2, 100);

  return (
    <div className="stats-trend-chart">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: "Spent",
              data: values,
              backgroundColor: values.map(
                (v, i) => LEVEL_COLORS[getBudgetLevel(v, budgets[i] ?? 0)]
              ),
              borderRadius: 6,
              maxBarThickness: 44,
            },
          ],
        }}
        plugins={[budgetMarker]}
        options={{
          maintainAspectRatio: false,
          animation: { duration: 300 },
          layout: { padding: { top: 4 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const value = Number(ctx.raw);
                  const budget = budgets[ctx.dataIndex] ?? 0;
                  if (budget <= 0) return `Spent: ${formatCurrency(value)}`;
                  const diff = budget - value;
                  return [
                    `Spent: ${formatCurrency(value)}`,
                    `Budget: ${formatCurrency(budget)}`,
                    diff >= 0
                      ? `${formatCurrency(diff)} under budget`
                      : `${formatCurrency(-diff)} over budget`,
                  ];
                },
              },
            },
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: { color: textColor, font: { weight: 600 } },
            },
            y: {
              beginAtZero: true,
              suggestedMax,
              border: { display: false },
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                maxTicksLimit: 5,
                callback: (v) => `₱${Number(v).toLocaleString("en-US")}`,
              },
            },
          },
        }}
      />
    </div>
  );
}
