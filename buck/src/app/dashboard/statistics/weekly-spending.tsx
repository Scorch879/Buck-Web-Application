"use client";
import React from "react";
import { Line } from "react-chartjs-2";
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
                gradient.addColorStop(0, "#2ecc40"); // green
                gradient.addColorStop(1, "#ff4136"); // red
                return gradient;
              },
              backgroundColor: function (context) {
                const chart = context.chart;
                const { ctx, chartArea } = chart;
                if (!chartArea) return;
                // Custom gradient: green above zero, red below zero
                const { top, bottom } = chartArea;
                const zeroY = chart.scales.y.getPixelForValue(0);
                const grad = ctx.createLinearGradient(0, top, 0, bottom);
                grad.addColorStop(0, "rgba(46,204,64,0.3)"); // green
                grad.addColorStop(
                  (zeroY - top) / (bottom - top),
                  "rgba(46,204,64,0.3)"
                );
                grad.addColorStop(
                  (zeroY - top) / (bottom - top),
                  "rgba(255,65,54,0.3)"
                );
                grad.addColorStop(1, "rgba(255,65,54,0.3)"); // red
                return grad;
              },
              fill: true,
              tension: 0.4,
              pointBackgroundColor: data.map((v) =>
                v >= 0 ? "#2ecc40" : "#ff4136"
              ),
              pointBorderColor: data.map((v) => (v >= 0 ? "#2ecc40" : "#ff4136")),
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
                    return `Saved: ${value}`;
                  } else {
                    return `Excess: ${-value}`;
                  }
                },
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              grid: { color: "#888" },
              beginAtZero: true,
              max: yMax,
              min: -yMax,
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
            background: "rgba(255,255,255,0.85)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10,
            fontSize: 24,
            fontWeight: 700,
            color: "#ef8a57",
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
