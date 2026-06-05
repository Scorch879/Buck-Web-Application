"use client";
import React from "react";
import { Line } from "react-chartjs-2";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from "chart.js";
import { formatCurrency } from "@/utils/formatters";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface WeeklySpendingChartProps {
  mode?: "week" | "month" | "overall";
  weekIndex?: number;
  monthIndex?: number;
  spendingData?: number[];
  maxBudgetPerDay?: number;
  noData?: boolean;
}

const WeeklySpendingChart: React.FC<WeeklySpendingChartProps> = ({
  mode = "week",
  weekIndex,
  monthIndex,
  spendingData,
  maxBudgetPerDay,
  noData = false,
}) => {
  const isDarkTheme = useAuthPageTheme();
  const chartText = isDarkTheme ? "#fff8ed" : "#2b2523";
  const chartGrid = isDarkTheme ? "rgba(255,211,154,0.16)" : "rgba(120,92,70,0.18)";
  const maxBudget = typeof maxBudgetPerDay === "number" && !isNaN(maxBudgetPerDay) ? maxBudgetPerDay : 0;
  let spending: number[] = [];
  if (spendingData) {
    spending = spendingData;
  } else {
    spending = Array(7).fill(0); // Default to zero if no data
  }
  const data = noData ? Array(7).fill(0) : spending.map((amt) => maxBudget - amt);
  const yMax = Math.max(...data.map(Math.abs), 200);

  return (
    <div style={{ position: "relative", width: "100%", minHeight: 320 }}>
      <Line
        data={{
          labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
          datasets: [
            {
              label: "Saved/Excess",
              data: data,
              borderColor: function (context) {
                const chart = context.chart;
                const { ctx, chartArea } = chart;
                if (!chartArea) return;
                const gradient = ctx.createLinearGradient(
                  0,
                  chartArea.top,
                  0,
                  chartArea.bottom
                );
                gradient.addColorStop(0, "#ffc547");
                gradient.addColorStop(1, "#ff3838");
                return gradient;
              },
              backgroundColor: function (context) {
                const chart = context.chart;
                const { ctx, chartArea } = chart;
                if (!chartArea) return;
                // Custom gradient: gold above zero, coral below zero.
                const { top, bottom } = chartArea;
                const zeroY = chart.scales.y.getPixelForValue(0);
                const grad = ctx.createLinearGradient(0, top, 0, bottom);
                grad.addColorStop(0, "rgba(255,197,71,0.28)");
                grad.addColorStop(
                  (zeroY - top) / (bottom - top),
                  "rgba(255,197,71,0.28)"
                );
                grad.addColorStop(
                  (zeroY - top) / (bottom - top),
                  "rgba(255,56,56,0.24)"
                );
                grad.addColorStop(1, "rgba(255,56,56,0.24)");
                return grad;
              },
              fill: true,
              tension: 0.4,
              pointBackgroundColor: data.map((v) =>
                v >= 0 ? "#ffc547" : "#ff3838"
              ),
              pointBorderColor: data.map((v) => (v >= 0 ? "#ffc547" : "#ff3838")),
              pointRadius: 5,
              pointHoverRadius: 7,
              borderWidth: 3,
            },
          ],
        }}
        options={{
          responsive: true,
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const value = Number(context.raw);
                  if (value >= 0) {
                    return `Saved: ${formatCurrency(value)}`;
                  } else {
                    return `Excess: ${formatCurrency(-value)}`;
                  }
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false }, ticks: { color: chartText } },
            y: {
              grid: { color: chartGrid },
              beginAtZero: true,
              max: yMax,
              min: -yMax,
              ticks: { color: chartText },
            },
          },
        }}
      />
      {noData && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: isDarkTheme
              ? "rgba(18,13,10,0.82)"
              : "rgba(255,250,244,0.86)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            fontSize: 24,
            fontWeight: 700,
            color: "#f47536",
            pointerEvents: "none",
          }}
        >
          No spending data for this week
        </div>
      )}
    </div>
  );
};

export default WeeklySpendingChart;
