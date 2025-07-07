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
import { testCategories, testAmounts, barColors } from "./testData";

ChartJS.register(CategoryScale, LinearScale, BarElement, Tooltip, Legend);

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