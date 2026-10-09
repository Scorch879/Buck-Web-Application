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
  centerLabel?: string;
  emptyMessage?: string;
  selectedCategory?: string | null;
  onSelectCategory?: (category: string | null) => void;
}

function getMutedColor(color: string): string {
  if (color.startsWith("#") && color.length === 7) {
    return `${color}35`;
  }
  return "rgba(140, 122, 107, 0.25)";
}

export default function WeeklyPieChart({
  slices,
  total,
  centerLabel = "Total this week",
  emptyMessage = "No expenses recorded in this period",
  selectedCategory = null,
  onSelectCategory,
}: WeeklyPieChartProps) {
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
        <p className="spending-label">{emptyMessage}</p>
      </div>
    );
  }

  const chartData = {
    labels: slices.map((s) => s.category),
    datasets: [
      {
        data: slices.map((s) => s.amount),
        backgroundColor: slices.map((s) =>
          selectedCategory
            ? s.category === selectedCategory
              ? s.color
              : getMutedColor(s.color)
            : s.color
        ),
        borderColor: slices.map((s) =>
          selectedCategory && s.category === selectedCategory
            ? isDarkTheme ? "#ffffff" : "#1e0600"
            : isDarkTheme ? "rgba(30, 6, 0, 0.95)" : "#fffaf6"
        ),
        borderWidth: slices.map((s) =>
          selectedCategory && s.category === selectedCategory ? 3 : 2
        ),
        offset: slices.map((s) =>
          selectedCategory && s.category === selectedCategory ? 10 : 0
        ),
        hoverOffset: 6,
      },
    ],
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event: any, elements: any[]) => {
      if (elements && elements.length > 0 && onSelectCategory) {
        const index = elements[0].index;
        const clickedSlice = slices[index];
        if (clickedSlice) {
          if (selectedCategory === clickedSlice.category) {
            onSelectCategory(null);
          } else {
            onSelectCategory(clickedSlice.category);
          }
        }
      }
    },
    onHover: (event: any, chartElement: any[]) => {
      if (event?.native?.target) {
        (event.native.target as HTMLElement).style.cursor =
          chartElement && chartElement.length > 0 ? "pointer" : "default";
      }
    },
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
      duration: 350,
    },
  };

  const activeSlice = slices.find((s) => s.category === selectedCategory);
  const centerAmount = activeSlice ? activeSlice.amount : total;
  const centerDisplayLabel = activeSlice
    ? `${activeSlice.category} (${activeSlice.percentage.toFixed(0)}%)`
    : centerLabel;

  return (
    <div className="spending-pie-layout">
      <div className="spending-pie-canvas-box">
        <div className="spending-pie-canvas-inner">
          <Pie data={chartData} options={chartOptions} />
        </div>
        <div className="spending-pie-center-info">
          <span className="spending-pie-center-amount">{formatCurrency(centerAmount)}</span>
          <span className="spending-pie-center-label">{centerDisplayLabel}</span>
        </div>
      </div>

      <div className="spending-pie-legend" role="list" aria-label="Category spending breakdown">
        <button
          type="button"
          className={`spending-pie-legend-item spending-pie-legend-item--all ${
            !selectedCategory ? "spending-pie-legend-item--selected" : ""
          }`}
          onClick={() => onSelectCategory?.(null)}
          aria-pressed={!selectedCategory}
          title="View all categories"
        >
          <span className="spending-pie-legend-dot spending-pie-legend-dot--all" aria-hidden="true" />
          <span className="spending-pie-legend-name">All</span>
          <span className="spending-pie-legend-amt">{formatCurrency(total)}</span>
        </button>

        {slices.map((slice) => {
          const isSelected = selectedCategory === slice.category;
          const isDimmed = Boolean(selectedCategory && !isSelected);

          return (
            <button
              key={slice.category}
              type="button"
              className={`spending-pie-legend-item ${
                isSelected ? "spending-pie-legend-item--selected" : ""
              } ${isDimmed ? "spending-pie-legend-item--dimmed" : ""}`}
              onClick={() => onSelectCategory?.(isSelected ? null : slice.category)}
              aria-pressed={isSelected}
              title={`Filter by ${slice.category}: ${formatCurrency(slice.amount)} (${slice.percentage.toFixed(0)}%)`}
            >
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
            </button>
          );
        })}
      </div>
    </div>
  );
}
