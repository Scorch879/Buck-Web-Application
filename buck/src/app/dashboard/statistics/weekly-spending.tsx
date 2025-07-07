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

import { statisticsTestData } from "./testData";

interface WeeklySpendingChartProps {
  mode?: 'week' | 'month' | 'overall';
  weekIndex?: number;
  monthIndex?: number;
}

const WeeklySpendingChart: React.FC<WeeklySpendingChartProps> = ({ mode = 'week', weekIndex, monthIndex }) => {
  let data: number[] = [];
  if (mode === 'week') {
    const idx = typeof weekIndex === 'number' ? weekIndex : statisticsTestData.weeklyCategorySpending.length - 1;
    data = statisticsTestData.weeklyCategorySpending[idx];
  } else if (mode === 'month') {
    // For demo: sum all weeks in the selected month (assuming 4 weeks per month)
    // In real use, you would map weeks to months by date
    const idx = typeof monthIndex === 'number' ? monthIndex : 0;
    // For now, just sum all weeks for the month
    data = Array(7).fill(0);
    for (let w = idx * 4; w < (idx + 1) * 4 && w < statisticsTestData.weeklyCategorySpending.length; w++) {
      for (let d = 0; d < 7; d++) {
        data[d] += statisticsTestData.weeklyCategorySpending[w][d];
      }
    }
  } else if (mode === 'overall') {
    data = Array(7).fill(0);
    for (let w = 0; w < statisticsTestData.weeklyCategorySpending.length; w++) {
      for (let d = 0; d < 7; d++) {
        data[d] += statisticsTestData.weeklyCategorySpending[w][d];
      }
    }
  }
  const yMax = Math.max(...data, 200);
  return (
    <Line
      data={{
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [
          {
            label: "Progress",
            data: data,
            borderColor: function(context) {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return;
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, "#2ecc40");
              gradient.addColorStop(1, "#ff4136");
              return gradient;
            },
            backgroundColor: function(context) {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return;
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0.5, "rgba(46,204,64,0.3)");
              gradient.addColorStop(0.5, "rgba(255,65,54,0.3)");
              return gradient;
            },
            fill: true,
            tension: 0.4,
            pointBackgroundColor: "#2ecc40",
            pointBorderColor: "#2ecc40",
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
          x: { grid: { display: false } },
          y: {
            grid: { color: "#888" },
            beginAtZero: false,
            max: yMax,
            min: -yMax,
          },
        },
      }}
    />
  );
};

export default WeeklySpendingChart;
