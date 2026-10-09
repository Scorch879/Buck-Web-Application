"use client";

import React, { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
} from "chart.js";
import { formatCurrency } from "@/utils/formatters";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";

ChartJS.register(ArcElement, Tooltip, Legend);

export type WeeklyPieSlice = {
  category: string;
  amount: number;
  percentage: number;
  color: string;
};

interface WeeklyPieChartProps {
  slices: WeeklyPieSlice[];
  total: number;
}

export default function WeeklyPieChart({ slices, total }: WeeklyPieChartProps) {
  const [mounted, setMounted] = useState(false);
  const isDarkTheme = useAuthPageTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div className="spending-pie-loading" aria-hidden="true">
        <div className="spending-pie-placeholder" />
      </div>
    );
  }

  if (total === 0 || slices.length === 0) {
    return (
      <div className="spending-pie-empty-wrapper">
        <div className="spending-circle">
          <div className="spending-amount">₱0.00</div>
        </div>
        <p className="spending-label">No expenses recorded this week</p>
      </div>
    );
  }

  const chartData = {
    labels: slices.map((s) => s.category),
    datasets: [
      {
        data: slices.map((s) => s.amount),
        backgroundColor: slices.map((s) => s.color),
        borderColor: isDarkTheme ? "rgba(30, 6, 0, 0.95)" : "#fffaf6",
        borderWidth: 2,
        hoverOffset: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false, // We render our accessible, beautifully styled HTML legend below
      },
      tooltip: {
        backgroundColor: isDarkTheme ? "rgba(30, 6, 0, 0.96)" : "rgba(43, 37, 35, 0.96)",
        titleColor: "#fff8ed",
        bodyColor: "#fff8ed",
        borderColor: "rgba(244, 117, 54, 0.45)",
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 4,
        callbacks: {
          label: function (context: any) {
            const label = context.label || "";
            const value = Number(context.raw) || 0;
            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
            return ` ${label}: ${formatCurrency(value)} (${pct}%)`;
          },
        },
      },
    },
    animation: {
      duration: 500,
    },
  };

  return (
    <div className="spending-pie-layout">
      <div className="spending-pie-canvas-box">
        <div className="spending-pie-canvas-inner">
          <Pie data={chartData} options={chartOptions} />
        </div>
        <div className="spending-pie-center-info">
          <span className="spending-pie-center-amount">{formatCurrency(total)}</span>
          <span className="spending-pie-center-label">Total this week</span>
        </div>
      </div>

      <div className="spending-pie-legend" role="list" aria-label="Category spending breakdown">
        {slices.map((slice) => (
          <div key={slice.category} className="spending-pie-legend-item" role="listitem">
            <span
              className="spending-pie-legend-dot"
              style={{ backgroundColor: slice.color }}
              aria-hidden="true"
            />
            <span className="spending-pie-legend-name" title={slice.category}>
              {slice.category}
            </span>
            <span className="spending-pie-legend-amt">
              {formatCurrency(slice.amount)}
            </span>
            <span
              className="spending-pie-legend-pct"
              style={{ backgroundColor: `${slice.color}22`, color: slice.color }}
            >
              {slice.percentage.toFixed(0)}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
