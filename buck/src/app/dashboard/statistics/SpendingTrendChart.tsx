"use client";
import React, { useRef } from "react";
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
import { buckChartColors, buckTooltip } from "@/utils/chartTheme";
import { formatCurrency } from "@/utils/formatters";
import { getBudgetLevel } from "./BudgetDonut";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

interface SpendingTrendChartProps {
  labels: string[];
  tooltipTitles?: string[];
  values: number[];
  /**
   * Budget for each bar (same length as `values`).
   * All zeros hides the budget marker.
   */
  budgets: number[];
  /** Unit shown in the marker label, e.g. "day", "week", "month", or "year". */
  unit: string;
}

// SRS 3.7 thresholds: amber from 80% of the bar's budget, crimson above 100%.
const LEVEL_COLORS = {
  safe: "#f47536",
  caution: "#f59e0b",
  critical: "#ff3838",
  none: "#f47536",
} as const;

const UNIT_ADJECTIVES: Record<string, string> = {
  day: "Daily",
  week: "Weekly",
  month: "Monthly",
  year: "Yearly",
};

const LEVEL_HOVER_COLORS = {
  safe: "#ff8547",
  caution: "#fbbf24",
  critical: "#ff5252",
  none: "#ff8547",
} as const;

/**
 * Spending per day / week / month / year. The budget is drawn *behind* the
 * bars as a dashed marker with an inline label, so it reads as a reference
 * line rather than a stray line floating across the chart.
 */
export default function SpendingTrendChart({
  labels,
  tooltipTitles,
  values,
  budgets,
  unit,
}: SpendingTrendChartProps) {
  const isDarkTheme = useAuthPageTheme();
  const { text: textColor, grid: gridColor } = buckChartColors(isDarkTheme);
  const zeroBarTrack = isDarkTheme ? "rgba(255,211,154,0.1)" : "rgba(120,92,70,0.1)";
  const markerColor = isDarkTheme ? "#ffc547" : "#b8860b";
  const labelBg = isDarkTheme ? "rgba(38,25,18,0.94)" : "rgba(255,250,246,0.96)";

  const hasBudget = budgets.some((b) => b > 0);
  const uniformBudget =
    hasBudget && budgets.every((b) => Math.abs(b - budgets[0]) < 0.005) ? budgets[0] : null;

  // react-chartjs-2 reads `plugins` only when the chart is created, so the
  // plugin draws from a ref that always holds this render's values (theme,
  // data, budgets). Otherwise the pill keeps the first render's colours.
  const latest = {
    labels, values, budgets, unit, hasBudget, uniformBudget,
    zeroBarTrack, markerColor, labelBg,
  };
  const latestRef = useRef(latest);
  latestRef.current = latest;

  const budgetMarker = useRef<Plugin<"bar">>({
    id: "statsBudgetMarker",
    // Before the bars, so bars sit on top of the reference line and zero-value slots have a subtle base tick.
    beforeDatasetsDraw(chart) {
      const { labels, values, budgets, hasBudget, uniformBudget, zeroBarTrack, markerColor } =
        latestRef.current;
      const { ctx, chartArea, scales } = chart;
      const xScale = scales.x;
      const yScale = scales.y;

      // Subtle baseline stub for ₱0 bars so empty days/weeks still anchor visually to their label
      ctx.save();
      ctx.fillStyle = zeroBarTrack;
      const slotWidth = (chartArea.right - chartArea.left) / Math.max(labels.length, 1);
      const stubWidth = Math.min(36, slotWidth * 0.52);
      values.forEach((v, i) => {
        if (v > 0) return;
        const cx = xScale.getPixelForValue(i);
        ctx.beginPath();
        ctx.roundRect(cx - stubWidth / 2, chartArea.bottom - 3, stubWidth, 3, 2);
        ctx.fill();
      });
      ctx.restore();

      if (!hasBudget) return;
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
      const { budgets, unit, hasBudget, uniformBudget, markerColor, labelBg } = latestRef.current;
      if (!hasBudget) return;
      const { ctx, chartArea, scales } = chart;
      const value = uniformBudget ?? Math.max(...budgets);
      const y = scales.y.getPixelForValue(value);
      const adjective = UNIT_ADJECTIVES[unit];
      const text = adjective
        ? `${adjective} budget ${formatCurrency(value)}`
        : `Budget ${formatCurrency(value)}/${unit}`;
      const rightEdge = chartArea.right - 4;
      ctx.save();
      // Match the card's body text so the pill reads at a glance.
      const narrow = chartArea.right - chartArea.left < 420;
      ctx.font = `600 ${narrow ? 12 : 13}px system-ui, -apple-system, Segoe UI, sans-serif`;
      const padX = narrow ? 9 : 11;
      const w = ctx.measureText(text).width + padX * 2;
      const h = narrow ? 24 : 26;
      const x = Math.max(chartArea.left + 4, rightEdge - w);
      let top = y - h - 6;
      if (top < chartArea.top + 2) top = y + 6;
      ctx.fillStyle = labelBg;
      ctx.strokeStyle = markerColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.roundRect(x, top, w, h, 999);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = markerColor;
      ctx.textBaseline = "middle";
      ctx.fillText(text, x + padX, top + h / 2);
      ctx.restore();
    },
  }).current;

  const peak = Math.max(...values, ...budgets, 0);
  // Generous headroom so the inline budget pill fits cleanly above the dashed reference line.
  const suggestedMax = Math.max(peak * 1.28, (uniformBudget ?? 0) * 1.32, 100);

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
              hoverBackgroundColor: values.map(
                (v, i) => LEVEL_HOVER_COLORS[getBudgetLevel(v, budgets[i] ?? 0)]
              ),
              borderRadius: { topLeft: 6, topRight: 6, bottomLeft: 2, bottomRight: 2 },
              borderSkipped: false,
              maxBarThickness: 44,
              categoryPercentage: 0.72,
              barPercentage: 0.85,
            },
          ],
        }}
        plugins={[budgetMarker]}
        options={{
          maintainAspectRatio: false,
          animation: { duration: 300 },
          layout: { padding: { top: 10, right: 4, left: 0, bottom: 0 } },
          plugins: {
            legend: { display: false },
            tooltip: {
              ...buckTooltip(isDarkTheme),
              callbacks: {
                labelColor: (ctx) => {
                  const color =
                    LEVEL_COLORS[getBudgetLevel(Number(ctx.raw), budgets[ctx.dataIndex] ?? 0)];
                  return { borderColor: color, backgroundColor: color, borderWidth: 1, borderRadius: 2 };
                },
                title: (items) => {
                  const idx = items[0]?.dataIndex;
                  if (idx !== undefined && tooltipTitles?.[idx]) {
                    return tooltipTitles[idx];
                  }
                  return items[0]?.label ?? "";
                },
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
              border: { color: gridColor },
              ticks: {
                color: textColor,
                font: { weight: 600, size: 11.5 },
                autoSkip: false,
                maxRotation: 0,
              },
            },
            y: {
              beginAtZero: true,
              suggestedMax,
              border: { display: false },
              grid: { color: gridColor },
              ticks: {
                color: textColor,
                font: { size: 11.5 },
                maxTicksLimit: 6,
                callback: (v) => `₱${Number(v).toLocaleString("en-US")}`,
              },
            },
          },
        }}
      />
    </div>
  );
}
