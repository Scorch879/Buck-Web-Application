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
  data: number[];
  yMax: number;
}

const WeeklySpendingChart: React.FC<WeeklySpendingChartProps> = ({ mode = 'week', weekIndex, monthIndex }) => {
  const maxBudgetPerDay = statisticsTestData.maxBudgetPerDay;
  let spending: number[] = [];
  if (mode === 'week') {
    const idx = typeof weekIndex === 'number' ? weekIndex : statisticsTestData.weeklyCategorySpending.length - 1;
    spending = statisticsTestData.weeklyCategorySpending[idx];
  } else if (mode === 'month') {
    const idx = typeof monthIndex === 'number' ? monthIndex : 0;
    spending = Array(7).fill(0);
    for (let w = idx * 4; w < (idx + 1) * 4 && w < statisticsTestData.weeklyCategorySpending.length; w++) {
      for (let d = 0; d < 7; d++) {
        spending[d] += statisticsTestData.weeklyCategorySpending[w][d];
      }
    }
  } else if (mode === 'overall') {
    spending = Array(7).fill(0);
    for (let w = 0; w < statisticsTestData.weeklyCategorySpending.length; w++) {
      for (let d = 0; d < 7; d++) {
        spending[d] += statisticsTestData.weeklyCategorySpending[w][d];
      }
    }
  }
  const data = spending.map(amt => maxBudgetPerDay - amt);
  const yMax = Math.max(maxBudgetPerDay, ...data.map(Math.abs), 200);
  return (
    <Line
      data={{
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
        datasets: [
          {
            label: "Saved/Excess",
            data: data,
            borderColor: function(context) {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return;
              const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              gradient.addColorStop(0, "#2ecc40"); // green
              gradient.addColorStop(1, "#ff4136"); // red
              return gradient;
            },
            backgroundColor: function(context) {
              const chart = context.chart;
              const { ctx, chartArea } = chart;
              if (!chartArea) return;
              // Custom gradient: green above zero, red below zero
              const { top, bottom } = chartArea;
              const zeroY = chart.scales.y.getPixelForValue(0);
              const grad = ctx.createLinearGradient(0, top, 0, bottom);
              grad.addColorStop(0, "rgba(46,204,64,0.3)"); // green
              grad.addColorStop((zeroY - top) / (bottom - top), "rgba(46,204,64,0.3)");
              grad.addColorStop((zeroY - top) / (bottom - top), "rgba(255,65,54,0.3)");
              grad.addColorStop(1, "rgba(255,65,54,0.3)"); // red
              return grad;
            },
            fill: true,
            tension: 0.4,
            pointBackgroundColor: data.map(v => v >= 0 ? "#2ecc40" : "#ff4136"),
            pointBorderColor: data.map(v => v >= 0 ? "#2ecc40" : "#ff4136"),
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
              label: function(context) {
                const value = Number(context.raw);
                if (value >= 0) {
                  return `Saved: ${value}`;
                } else {
                  return `Excess: ${-value}`;
                }
              }
            }
          }
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
  );
};

export default WeeklySpendingChart;
