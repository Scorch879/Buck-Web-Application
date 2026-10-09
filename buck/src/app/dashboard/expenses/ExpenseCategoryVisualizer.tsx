"use client";

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { FaFilter, FaTimes, FaLayerGroup } from "react-icons/fa";
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
      <div className="expenses-category-vis-header">
        <div className="expenses-category-vis-title-group">
          <FaLayerGroup aria-hidden="true" className="expenses-category-vis-icon" />
          <div>
            <h3 className="expenses-category-vis-title">Category Spending Allocation</h3>
            <span className="expenses-category-vis-subtitle">
              {categoryStats.length} {categoryStats.length === 1 ? "category" : "categories"} active across {expenses.length} expenses
            </span>
          </div>
        </div>

        {selectedCategory ? (
          <button
            type="button"
            className="expenses-category-clear-btn"
            onClick={() => onSelectCategory(null)}
            aria-label="Clear active category filter"
          >
            <FaTimes aria-hidden="true" />
            <span>Clear filter ({selectedCategory})</span>
          </button>
        ) : null}
      </div>

      {/* Proportional Segmented Progress Bar */}
      <div
        className="expenses-category-bar-track"
        role="progressbar"
        aria-label="Proportional spending by category"
      >
        {categoryStats.map((item, idx) => {
          const isSelected = selectedCategory === item.name;
          const isDimmed = selectedCategory !== null && !isSelected;

          return (
            <motion.div
              key={item.name}
              className={`expenses-category-bar-seg ${
                isSelected ? "expenses-category-bar-seg--selected" : ""
              } ${isDimmed ? "expenses-category-bar-seg--dimmed" : ""}`}
              style={{
                width: `${Math.max(1.5, item.percentage)}%`,
                backgroundColor: item.theme.color,
              }}
              title={`${item.name}: ${formatCurrency(item.total)} (${item.percentage.toFixed(1)}%)`}
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ duration: 0.5, delay: idx * 0.04 }}
              onClick={() =>
                onSelectCategory(selectedCategory === item.name ? null : item.name)
              }
            />
          );
        })}
      </div>

      {/* Interactive Category Filter Pills */}
      <div className="expenses-category-chips-row">
        <button
          type="button"
          className={`expenses-category-chip ${
            selectedCategory === null ? "expenses-category-chip--active" : ""
          }`}
          onClick={() => onSelectCategory(null)}
        >
          <span className="expenses-category-chip-dot expenses-category-chip-dot--all" />
          <span>All</span>
          <span className="expenses-category-chip-badge">{expenses.length}</span>
        </button>

        {categoryStats.map((cat) => {
          const isSelected = selectedCategory === cat.name;
          const IconComp = cat.theme.icon;

          return (
            <button
              key={cat.name}
              type="button"
              className={`expenses-category-chip ${
                isSelected ? "expenses-category-chip--active" : ""
              }`}
              onClick={() =>
                onSelectCategory(selectedCategory === cat.name ? null : cat.name)
              }
              style={{
                borderColor: isSelected ? cat.theme.color : undefined,
                backgroundColor: isSelected ? cat.theme.bg : undefined,
              }}
            >
              <span
                className="expenses-category-chip-dot"
                style={{ backgroundColor: cat.theme.color }}
              />
              <IconComp aria-hidden="true" className="expenses-category-chip-icon" />
              <span>{cat.name}</span>
              <span className="expenses-category-chip-badge">
                {cat.count} · {formatCurrency(cat.total)}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
