// components/WeeklySpendingChart.tsx
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
  data: number[];
  yMax: number;
}

const WeeklySpendingChart: React.FC<WeeklySpendingChartProps> = ({ data, yMax }) => {
  const isDarkTheme = useAuthPageTheme();
  const chartText = isDarkTheme ? "#fff8ed" : "#2b2523";
  const chartGrid = isDarkTheme ? "rgba(255,211,154,0.16)" : "rgba(120,92,70,0.18)";

  return (
    <Line
      data={{
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [
          {
            label: "Progress",
            data: data,
            borderColor: function (context) {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return;
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, "#ffc547");
              gradient.addColorStop(1, "#ff3838");
              return gradient;
            },
            backgroundColor: function (context) {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return;
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0.5, "rgba(255,197,71,0.28)");
              gradient.addColorStop(0.5, "rgba(255,56,56,0.24)");
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#ffc547",
            pointBorderColor: "#ffc547",
            pointRadius: 5,
            pointHoverRadius: 7,
            borderWidth: 3,
          },
        ],
      }}
      options={{
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: chartText } },
          y: {
            grid: { color: chartGrid },
            beginAtZero: false,
            max: yMax,
            min: -yMax,
            ticks: { color: chartText },
          },
        },
      }}
    />
  );
};

export default WeeklySpendingChart;
