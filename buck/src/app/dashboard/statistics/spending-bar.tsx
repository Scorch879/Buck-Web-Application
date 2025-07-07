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

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

// Temporary test data for amounts
const testAmounts = [120, 80, 50, 200];

// Example testCategories for the chart
const testCategories = ["Food", "Transport", "Entertainment", "Savings"];

// Example bar colors for the chart
const barColors = [
  "#FF6384",
  "#36A2EB",
  "#FFCE56",
  "#4BC0C0",
  "#9966FF",
  "#FF9F40",
  "#2ecc40",
];

const data = {
  labels: testCategories,
  datasets: [
    {
      label: "Spending",
      data: testAmounts,
      backgroundColor: barColors,
      borderColor: barColors,
      borderWidth: 2,
      borderRadius: 8,
      maxBarThickness: 36,
    },
  ],
};

const yMax = Math.max(200, ...testAmounts);

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

const SpendingBar: React.FC = () => {
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
