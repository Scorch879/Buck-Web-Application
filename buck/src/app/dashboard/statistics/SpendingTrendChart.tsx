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

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

interface SpendingTrendChartProps {
  labels: string[];
  values: number[];
  /** Spending limit per bar; drawn as a dashed line. 0 hides it. */
  limit: number;
}

const OVER_COLOR = "#ff3838";
const UNDER_COLOR = "#f47536";

/** Spending per day/week/month with the per-bar limit as a dashed line. */
export default function SpendingTrendChart({ labels, values, limit }: SpendingTrendChartProps) {
  const isDarkTheme = useAuthPageTheme();
  const textColor = isDarkTheme ? "#d9c7b6" : "#756d68";
  const gridColor = isDarkTheme ? "rgba(255,211,154,0.12)" : "rgba(120,92,70,0.12)";
  const limitColor = isDarkTheme ? "#ffc547" : "#b8860b";

  const limitLine: Plugin<"bar"> = {
    id: "statsLimitLine",
    afterDatasetsDraw(chart) {
      if (limit <= 0) return;
      const { ctx, chartArea, scales } = chart;
      const y = scales.y.getPixelForValue(limit);
      if (y < chartArea.top || y > chartArea.bottom) return;
      ctx.save();
      ctx.strokeStyle = limitColor;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();
      ctx.restore();
    },
  };

  const suggestedMax = Math.max(limit * 1.15, ...values.map((v) => v * 1.1), 100);

  return (
    <div className="stats-trend-chart">
      <Bar
        data={{
          labels,
          datasets: [
            {
              label: "Spent",
              data: values,
              backgroundColor: values.map((v) =>
                limit > 0 && v > limit ? OVER_COLOR : UNDER_COLOR
              ),
              borderRadius: 6,
              maxBarThickness: 44,
            },
          ],
        }}
        plugins={[limitLine]}
        options={{
          maintainAspectRatio: false,
          animation: { duration: 300 },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (ctx) => {
                  const value = Number(ctx.raw);
                  if (limit <= 0) return `Spent: ${formatCurrency(value)}`;
                  const diff = limit - value;
                  return [
                    `Spent: ${formatCurrency(value)}`,
                    diff >= 0
                      ? `Under limit by ${formatCurrency(diff)}`
                      : `Over limit by ${formatCurrency(-diff)}`,
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
