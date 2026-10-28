import React from "react";
import { formatCurrency } from "@/utils/formatters";

export type CategoryTotal = { name: string; amount: number };

const MAX_ROWS = 5;
const CATEGORY_BAR_COLORS = [
  "linear-gradient(90deg, var(--buck-gold), var(--buck-orange))",
  "#f47536",
  "#ff8c42",
  "#f59e0b",
  "#d97706",
  "#8c7a6b",
];
const CATEGORY_DOT_COLORS = [
  "#f47536",
  "#ff8c42",
  "#ffc547",
  "#f59e0b",
  "#d97706",
  "#8c7a6b",
];

/** Groups everything past the top categories into one "Others" row. */
export function topCategories(totals: CategoryTotal[], maxRows = MAX_ROWS) {
  const sorted = totals.filter((t) => t.amount > 0).sort((a, b) => b.amount - a.amount);
  if (sorted.length <= maxRows + 1) return sorted;
  const rest = sorted.slice(maxRows);
  return [
    ...sorted.slice(0, maxRows),
    {
      name: `Others (${rest.length})`,
      amount: rest.reduce((sum, t) => sum + t.amount, 0),
    },
  ];
}

interface CategoryBreakdownProps {
  totals: CategoryTotal[];
}

/** Ranked horizontal bars: readable at any width, unlike 17 vertical bars. */
export default function CategoryBreakdown({ totals }: CategoryBreakdownProps) {
  const rows = topCategories(totals);
  const total = rows.reduce((sum, r) => sum + r.amount, 0);
  const largest = rows[0]?.amount ?? 0;

  if (rows.length === 0) {
    return <p className="stats-empty">No spending recorded in this period.</p>;
  }

  return (
    <ol className="stats-category-list">
      {rows.map((row, i) => {
        const share = total > 0 ? (row.amount / total) * 100 : 0;
        const barBg = CATEGORY_BAR_COLORS[i % CATEGORY_BAR_COLORS.length];
        const dotColor = CATEGORY_DOT_COLORS[i % CATEGORY_DOT_COLORS.length];
        return (
          <li key={row.name} className="stats-category-row">
            <div className="stats-category-meta">
              <span className="stats-category-name" title={row.name}>
                <span
                  className="stats-category-dot"
                  style={{ backgroundColor: dotColor }}
                  aria-hidden="true"
                />
                {row.name}
              </span>
              <span className="stats-category-amount">
                {formatCurrency(row.amount)}
                <span className="stats-category-share">{share.toFixed(0)}%</span>
              </span>
            </div>
            <div className="stats-category-track" aria-hidden="true">
              <span
                className={`stats-category-fill${i === 0 ? " stats-category-fill--top" : ""}`}
                style={{
                  width: `${largest > 0 ? (row.amount / largest) * 100 : 0}%`,
                  background: barBg,
                }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}
