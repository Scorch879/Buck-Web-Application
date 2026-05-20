import React from "react";
import { Bar } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Tooltip,
  Legend,
} from "chart.js";
import styles from "./spending-bar.module.css";
import { statisticsTestData } from "./testData";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

interface SpendingBarProps {
  mode?: 'week' | 'month' | 'overall';
  weekIndex?: number;
  monthIndex?: number;
  categories?: string[];
  amounts?: number[];
}
const SpendingBar: React.FC<SpendingBarProps> = ({ mode = 'week', weekIndex, monthIndex, categories, amounts }) => {
  const fallbackCategories = statisticsTestData.categories;
  const fallbackAmounts = (() => {
    if (mode === 'week') {
      const idx = typeof weekIndex === 'number' ? weekIndex : statisticsTestData.weeklyCategorySpending.length - 1;
      return statisticsTestData.weeklyCategorySpending[idx];
    } else if (mode === 'month') {
      const idx = typeof monthIndex === 'number' ? monthIndex : 0;
      const arr = Array(fallbackCategories.length).fill(0);
      for (let w = idx * 4; w < (idx + 1) * 4 && w < statisticsTestData.weeklyCategorySpending.length; w++) {
        for (let d = 0; d < fallbackCategories.length; d++) {
          arr[d] += statisticsTestData.weeklyCategorySpending[w][d];
        }
      }
      return arr;
    } else if (mode === 'overall') {
      const arr = Array(fallbackCategories.length).fill(0);
      for (let w = 0; w < statisticsTestData.weeklyCategorySpending.length; w++) {
        for (let d = 0; d < fallbackCategories.length; d++) {
          arr[d] += statisticsTestData.weeklyCategorySpending[w][d];
        }
      }
      return arr;
    }
    return Array(fallbackCategories.length).fill(0);
  })();
  const barColors = statisticsTestData.barColors;
  const usedCategories = categories && categories.length ? categories : fallbackCategories;
  const usedAmounts = amounts && amounts.length === usedCategories.length ? amounts : fallbackAmounts;

  const data = {
    labels: usedCategories,
    datasets: [
      {
        label: "Spending",
        data: usedAmounts,
        backgroundColor: barColors,
        borderColor: barColors,
        borderWidth: 2,
        borderRadius: 8,
        maxBarThickness: 36,
      },
    ],
  };

  const yMax = Math.max(200, ...usedAmounts);

  const options = {
    responsive: true,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            return `$${context.raw}`;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: { color: "#2c3e50", font: { weight: 600 } },
      },
      y: {
        beginAtZero: true,
        max: yMax,
        grid: { color: "#eee" },
        ticks: { color: "#2c3e50" },
      },
    },
  };

  return (
    <div className={styles.spendingBarCard}>
      <div className={styles.spendingBarTitle}>Spending by Category</div>
      <div className={styles.spendingBarChartContainer}>
        <Bar data={data} options={options} />
      </div>
    </div>
  );
};

export default SpendingBar; 