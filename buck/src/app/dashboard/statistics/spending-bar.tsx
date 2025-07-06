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

const testCategories = [
  "Food",
  "Fare",
  "Gas Money",
  "Video Games",
  "Shopping",
  "Bills",
  "Other",
];
const testAmounts = [120, 60, 40, 90, 70, 110, 30];

const barColors = [
  "#ff4136", // Food - red
  "#2ecc40", // Fare - green
  "#0074d9", // Gas Money - blue
  "#b10dc9", // Video Games - purple
  "#ffb347", // Shopping - orange
  "#ef8a57", // Bills - coral
  "#ffd700", // Other - gold
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
      max: 200,
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