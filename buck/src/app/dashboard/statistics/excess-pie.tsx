import React from "react";
import { Doughnut } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import styles from "./excess-pie.module.css";
import { statisticsTestData } from "./testData";

ChartJS.register(ArcElement, Tooltip, Legend);

interface ExcessPieProps { mode?: 'week' | 'month' | 'overall'; weekIndex?: number; monthIndex?: number; }
const ExcessPie: React.FC<ExcessPieProps> = ({ mode = 'week', weekIndex, monthIndex }) => {
  let spending = 0;
  let savings = 0;
  const maxBudgetPerDay = 1000;
  if (mode === 'week') {
    const idx = typeof weekIndex === 'number' ? weekIndex : statisticsTestData.weeklyCategorySpending.length - 1;
    spending = statisticsTestData.weeklyCategorySpending[idx].reduce((a, b) => a + b, 0);
    savings = statisticsTestData.weeklyCategorySpending[idx].reduce((sum, amt) => sum + (maxBudgetPerDay - amt), 0);
  } else if (mode === 'month') {
    const idx = typeof monthIndex === 'number' ? monthIndex : 0;
    let days: number[] = Array(7).fill(0);
    for (let w = idx * 4; w < (idx + 1) * 4 && w < statisticsTestData.weeklyCategorySpending.length; w++) {
      for (let d = 0; d < 7; d++) {
        days[d] += statisticsTestData.weeklyCategorySpending[w][d];
      }
    }
    spending = days.reduce((a, b) => a + b, 0);
    savings = days.reduce((sum, amt) => sum + (maxBudgetPerDay - amt), 0);
  } else if (mode === 'overall') {
    let days: number[] = Array(7).fill(0);
    for (let w = 0; w < statisticsTestData.weeklyCategorySpending.length; w++) {
      for (let d = 0; d < 7; d++) {
        days[d] += statisticsTestData.weeklyCategorySpending[w][d];
      }
    }
    spending = days.reduce((a, b) => a + b, 0);
    savings = days.reduce((sum, amt) => sum + (maxBudgetPerDay - amt), 0);
  }
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