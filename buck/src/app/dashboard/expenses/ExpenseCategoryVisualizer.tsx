"use client";

import React, { useMemo } from "react";
import { FaLayerGroup, FaTimes } from "react-icons/fa";
import { formatCurrency, toNumber } from "@/utils/formatters";
import type { BuckExpense } from "@/utils/supabaseData";
import { getCategoryTheme } from "./categoryUtils";

interface ExpenseCategoryVisualizerProps {
  expenses: BuckExpense[];
  selectedCategory: string | null;
  onSelectCategory: (category: string | null) => void;
}

export default function ExpenseCategoryVisualizer({
  expenses,
  selectedCategory,
  onSelectCategory,
}: ExpenseCategoryVisualizerProps) {
  // Aggregate category metrics
  const { categoryStats, totalAmount } = useMemo(() => {
    const totals: Record<string, { count: number; total: number }> = {};
    let overall = 0;

    for (const exp of expenses) {
      const cat = exp.category?.trim() || "Uncategorized";
      const amt = toNumber(exp.amount);
      if (!totals[cat]) {
        totals[cat] = { count: 0, total: 0 };
      }
      totals[cat].count += 1;
      totals[cat].total += amt;
      overall += amt;
    }

    const sorted = Object.entries(totals)
      .map(([name, data]) => ({
        name,
        count: data.count,
        total: data.total,
        percentage: overall > 0 ? (data.total / overall) * 100 : 0,
        theme: getCategoryTheme(name),
      }))
      .sort((a, b) => b.total - a.total);

    return { categoryStats: sorted, totalAmount: overall };
  }, [expenses]);

  if (!expenses.length) {
    return null;
  }

  return (
    <section
      className="expenses-category-visualizer"
      aria-label="Category spending breakdown and filters"
    >
      {/* Header */}
      <div className="expenses-category-vis-header">
        <div className="expenses-category-vis-title-group">
          <FaLayerGroup aria-hidden="true" className="expenses-category-vis-icon" />
          <div>
            <h3 className="expenses-category-vis-title">Category Spending Allocation</h3>
            <span className="expenses-category-vis-subtitle">
              {categoryStats.length} {categoryStats.length === 1 ? "category" : "categories"} active · Total {formatCurrency(totalAmount)}
            </span>
          </div>
        </div>

        <div className="expenses-category-vis-actions">
          {selectedCategory ? (
            <button
              type="button"
              className="expenses-category-clear-btn"
              onClick={() => onSelectCategory(null)}
              aria-label={`Clear active category filter: ${selectedCategory}`}
            >
              <FaTimes aria-hidden="true" />
              <span>Clear filter ({selectedCategory})</span>
            </button>
          ) : (
            <span className="expenses-category-vis-hint">
              Click bar or legend to filter
            </span>
          )}
        </div>
      </div>

      {/* Proportional Segmented Progress Bar (Thicker 24px and Clickable) */}
      <div
        className="expenses-category-bar-track"
        role="group"
        aria-label="Proportional spending allocation bar"
      >
        {categoryStats.map((item) => {
          const isSelected =
            selectedCategory?.toLowerCase() === item.name.toLowerCase();
          const isDimmed = selectedCategory !== null && !isSelected;

          return (
            <button
              key={item.name}
              type="button"
              className={`expenses-category-bar-seg ${
                isSelected ? "expenses-category-bar-seg--selected" : ""
              } ${isDimmed ? "expenses-category-bar-seg--dimmed" : ""}`}
              style={{
                width: `${Math.max(2, item.percentage)}%`,
                backgroundColor: item.theme.color,
              }}
              onClick={() =>
                onSelectCategory(isSelected ? null : item.name)
              }
              aria-label={`${item.name}: ${formatCurrency(item.total)} (${item.percentage.toFixed(1)}%)`}
              aria-pressed={isSelected}
              title={`${item.name}: ${formatCurrency(item.total)} (${item.percentage.toFixed(1)}%) - Click to filter`}
            />
          );
        })}
      </div>

      {/* Streamlined Chart Legend (Replaces Heavy Pillbox Filters) */}
      <div
        className="expenses-category-legend"
        role="group"
        aria-label="Category spending breakdown legend"
      >
        {categoryStats.map((cat) => {
          const isSelected =
            selectedCategory?.toLowerCase() === cat.name.toLowerCase();
          const isDimmed = selectedCategory !== null && !isSelected;

          return (
            <button
              key={cat.name}
              type="button"
              className={`expenses-legend-item ${
                isSelected ? "expenses-legend-item--selected" : ""
              } ${isDimmed ? "expenses-legend-item--dimmed" : ""}`}
              onClick={() =>
                onSelectCategory(isSelected ? null : cat.name)
              }
              aria-pressed={isSelected}
              title={`Filter by ${cat.name}: ${formatCurrency(cat.total)} (${cat.percentage.toFixed(1)}%)`}
            >
              <span
                className="expenses-legend-dot"
                style={{ backgroundColor: cat.theme.color }}
              />
              <span className="expenses-legend-name">{cat.name}</span>
              <span className="expenses-legend-pct">
                {cat.percentage.toFixed(1)}%
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
