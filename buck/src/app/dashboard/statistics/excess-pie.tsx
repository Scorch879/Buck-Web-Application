import React from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import styles from "./excess-pie.module.css";

ChartJS.register(ArcElement, Tooltip, Legend);

interface ExcessPieProps {
  spending: number;
  savings: number;
}

const ExcessPie: React.FC<ExcessPieProps> = ({ spending, savings }) => {
  const total = spending + savings;
  const spendingPercent = total === 0 ? 0 : (spending / total) * 100;
  const savingsPercent = total === 0 ? 0 : (savings / total) * 100;
  const mainPercent = spending >= savings ? spendingPercent : savingsPercent;
  const mainLabel = spending >= savings ? "Spending" : "Savings";

  const data = {
    labels: ["Spending", "Savings"],
    datasets: [
      {
        data: [spending, savings],
        backgroundColor: ["#ff4136", "#2ecc40"],
        borderWidth: 2,
      },
    ],
  };

  const options = {
    cutout: "70%",
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: function (context: any) {
            const label = context.label || "";
            const value = context.raw;
            const percent = total === 0 ? 0 : ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percent}%)`;
          },
        },
      },
    },
    maintainAspectRatio: false,
  };

  return (
    <div className={styles.excessPieCard}>
      <div className={styles.excessPieTitle}>Total Excess Spending</div>
      <div style={{ position: "relative", width: 220, height: 220 }}>
        <Doughnut data={data} options={options} />
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <span style={{ fontSize: "2.2rem", fontWeight: 700, color: "#2c3e50" }}>
            {mainPercent.toFixed(0)}%
          </span>
          <span style={{ fontSize: "1.1rem", color: "#888" }}>{mainLabel}</span>
        </div>
      </div>
      <div className={styles.excessPieLegend}>
        <div className={styles.excessPieLegendItem}>
          <span className={styles.excessPieColorSavings}></span>
          Savings
        </div>
        <div className={styles.excessPieLegendItem}>
          <span className={styles.excessPieColorSpending}></span>
          Spending
        </div>
      </div>
    </div>
  );
};

export default ExcessPie; 