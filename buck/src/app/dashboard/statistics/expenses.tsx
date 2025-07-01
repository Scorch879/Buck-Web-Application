"use client";
import React, { useRef, useState } from "react";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import "./expenses_style.css";

ChartJS.register(ArcElement, Tooltip, Legend);

const savings = 2500; // Example value
const expenses = 4300; // Example value
const total = savings + expenses;

const data = {
  labels: ["Savings", "Expenses"],
  datasets: [
    {
      data: [savings, expenses],
      backgroundColor: ["#2ecc40", "#ff4136"],
      borderColor: ["#1e9c30", "#b92a1d"],
      borderWidth: 2,
    },
  ],
};

const options = {
  responsive: true,
  plugins: {
    legend: {
      display: true,
      position: "bottom" as const,
      labels: {
        font: { size: 16 },
        color: "#2c3e50",
      },
    },
    tooltip: {
      callbacks: {
        label: function(context: any) {
          const label = context.label || "";
          const value = context.parsed || 0;
          const percent = total ? ((value / total) * 100).toFixed(1) : 0;
          return `${label}: $${value} (${percent}%)`;
        },
      },
    },
  },
  cutout: "70%", // Make it a doughnut for center label
  onHover: (event: any, elements: any[], chart: any) => {}, // Placeholder
};

const categoryList = [
  { label: "Savings", color: "#2ecc40" },
  { label: "Expenses", color: "#ff4136" },
];

const ExpensesPieCard = () => {
  const [selected, setSelected] = useState(0); // 0: Savings, 1: Expenses
  const [hovered, setHovered] = useState<number | null>(null);
  const chartRef = useRef<any>(null);

  // Calculate percentages
  const percentages = [
    total ? (savings / total) * 100 : 0,
    total ? (expenses / total) * 100 : 0,
  ];

  // Center label logic
  let displayIndex: number | null = null;
  if (hovered !== null) {
    displayIndex = hovered;
  } else if (selected !== null) {
    displayIndex = selected;
  }
  const displayPercent = displayIndex !== null ? percentages[displayIndex].toFixed(1) : "";
  const displayLabel = displayIndex !== null ? data.labels[displayIndex] : "";
  const displayColor = displayIndex !== null ? categoryList[displayIndex].color : "#2c3e50";

  // Custom plugin for center label
  const centerLabelPlugin = {
    id: "centerLabel",
    afterDraw: (chart: any) => {
      const { ctx, chartArea } = chart;
      if (!ctx || !chartArea) return;
      const centerX = (chartArea.left + chartArea.right) / 2;
      const centerY = (chartArea.top + chartArea.bottom) / 2;
      // Draw white circle
      ctx.save();
      ctx.beginPath();
      ctx.arc(centerX, centerY, 70, 0, 2 * Math.PI);
      ctx.fillStyle = "#fff";
      ctx.shadowColor = "rgba(0,0,0,0.04)";
      ctx.shadowBlur = 4;
      ctx.fill();
      ctx.restore();
      // Draw percentage if a category is selected or hovered
      if (displayIndex !== null) {
        ctx.save();
        ctx.font = "bold 2rem Segoe UI, Arial";
        ctx.fillStyle = displayColor;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${displayPercent}%`, centerX, centerY);
        ctx.font = "500 1rem Segoe UI, Arial";
        ctx.fillStyle = "#2c3e50";
        ctx.fillText(displayLabel, centerX, centerY + 28);
        ctx.restore();
      }
    },
  };

  // Pie hover logic
  const pieOptions = {
    ...options,
    onHover: (event: any, elements: any[], chart: any) => {
      if (elements && elements.length > 0) {
        setHovered(elements[0].index);
      } else {
        setHovered(null);
      }
    },
    plugins: {
      ...options.plugins,
      centerLabel: centerLabelPlugin,
    },
  };

  return (
    <div className="graph-panel" style={{ maxWidth: 400, margin: "0 auto" }}>
      <div className="graph-panel-header">Savings vs Expenses</div>
      <Pie
        ref={chartRef}
        data={data}
        options={pieOptions}
        plugins={[centerLabelPlugin]}
      />
      <div style={{ display: "flex", justifyContent: "center", gap: 16, marginTop: 24 }}>
        {categoryList.map((cat, idx) => (
          <button
            key={cat.label}
            onClick={() => setSelected(idx)}
            style={{
              background: selected === idx ? cat.color : "#fff",
              color: selected === idx ? "#fff" : cat.color,
              border: `2px solid ${cat.color}`,
              borderRadius: 8,
              fontWeight: 600,
              fontSize: "1rem",
              padding: "0.5rem 1.5rem",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
          >
            {cat.label} %
          </button>
        ))}
      </div>
    </div>
  );
};

export default ExpensesPieCard;
