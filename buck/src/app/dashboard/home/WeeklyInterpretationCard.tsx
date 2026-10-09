"use client";

import React from "react";
import { formatCurrency } from "@/utils/formatters";
import { FaChartPie, FaLightbulb, FaFireAlt, FaCalendarCheck } from "react-icons/fa";
import type { WeeklyPieSlice } from "./WeeklyPieChart";

interface WeeklyInterpretationCardProps {
  slices: WeeklyPieSlice[];
  total: number;
  weeklyExpensesCount: number;
  activeWalletBudget?: number | null;
}

export default function WeeklyInterpretationCard({
  slices,
  total,
  weeklyExpensesCount,
  activeWalletBudget,
}: WeeklyInterpretationCardProps) {
  if (total === 0 || slices.length === 0) {
    return (
      <article className="interpretation-card" aria-label="Weekly spending interpretation">
        <div className="card-heading">
          <p className="card-eyebrow">Weekly Insights</p>
          <div className="interpretation-title-row">
            <h2 className="interpretation-title">Spending Interpretation</h2>
            <span className="interpretation-badge interpretation-badge--empty">
              <FaCalendarCheck aria-hidden="true" /> Awaiting Expenses
            </span>
          </div>
        </div>
        <div className="empty-interpretation-state">
          <p>
            No expenses have been logged for the current week yet. Once transactions are recorded,
            this card will dynamically interpret your category distribution, identify spending
            concentrations, and highlight opportunities to optimize your cash flow.
          </p>
        </div>
      </article>
    );
  }

  const topSlice = slices[0];
  const othersSlice = slices.find((s) => s.category === "Others");
  const secondSlice = slices.length > 1 && slices[1].category !== "Others" ? slices[1] : null;
  const dailyAverage = total / 7;

  // Concentration level analysis
  const isHighConcentration = topSlice.percentage >= 50;
  const isModerateConcentration = topSlice.percentage >= 35 && topSlice.percentage < 50;
  const hasSignificantOthers = othersSlice && othersSlice.percentage >= 15;

  let concentrationVerdict = "Balanced Spending";
  if (isHighConcentration) {
    concentrationVerdict = "High Concentration";
  } else if (isModerateConcentration) {
    concentrationVerdict = "Moderate Concentration";
  }

  return (
    <article className="interpretation-card" aria-label="Weekly spending interpretation">
      <div className="card-heading">
        <p className="card-eyebrow">Weekly Insights</p>
        <div className="interpretation-title-row">
          <h2 className="interpretation-title">Spending Interpretation</h2>
          <span className="interpretation-badge">
            <FaChartPie aria-hidden="true" />
            {slices.length} {slices.length === 1 ? "Category" : "Categories"} Active
          </span>
        </div>
      </div>

      {/* 4 Stat Metric Pills */}
      <div className="interpretation-metrics-grid">
        <div className="interpretation-metric-item">
          <span className="interpretation-metric-label">Top Expense Category</span>
          <div className="interpretation-metric-val-row">
            <span
              className="interpretation-metric-bullet"
              style={{ backgroundColor: topSlice.color }}
              aria-hidden="true"
            />
            <strong className="interpretation-metric-val">{topSlice.category}</strong>
          </div>
          <span className="interpretation-metric-sub">
            {formatCurrency(topSlice.amount)} ({topSlice.percentage.toFixed(1)}%)
          </span>
        </div>

        <div className="interpretation-metric-item">
          <span className="interpretation-metric-label">Weekly Total Spent</span>
          <strong className="interpretation-metric-val interpretation-metric-val--orange">
            {formatCurrency(total)}
          </strong>
          <span className="interpretation-metric-sub">
            Across {weeklyExpensesCount} {weeklyExpensesCount === 1 ? "transaction" : "transactions"}
          </span>
        </div>

        <div className="interpretation-metric-item">
          <span className="interpretation-metric-label">Daily Average Burn</span>
          <strong className="interpretation-metric-val">
            {formatCurrency(dailyAverage)}
          </strong>
          <span className="interpretation-metric-sub">Per day average pace</span>
        </div>

        <div className="interpretation-metric-item">
          <span className="interpretation-metric-label">Distribution Profile</span>
          <strong className="interpretation-metric-val">{concentrationVerdict}</strong>
          <span className="interpretation-metric-sub">
            {othersSlice ? "Top 4 + Others" : `${slices.length} distinct slices`}
          </span>
        </div>
      </div>

      {/* Proportional Segmented Visual Bar */}
      <div className="interpretation-distribution-block">
        <div className="interpretation-distribution-header">
          <span>Proportional Category Share</span>
          <span>{slices.length} items (Max 5)</span>
        </div>
        <div
          className="interpretation-bar"
          role="progressbar"
          aria-label="Category spending distribution meter"
        >
          {slices.map((slice) => (
            <div
              key={slice.category}
              className="interpretation-bar-segment"
              style={{
                width: `${slice.percentage}%`,
                backgroundColor: slice.color,
              }}
              title={`${slice.category}: ${formatCurrency(slice.amount)} (${slice.percentage.toFixed(1)}%)`}
            />
          ))}
        </div>
      </div>

      {/* Narrative Insights Box */}
      <div className="interpretation-narrative-box">
        <div className="interpretation-narrative-icon" aria-hidden="true">
          <FaLightbulb />
        </div>
        <div className="interpretation-narrative-text">
          <p>
            {isHighConcentration ? (
              <>
                Your weekly expenditures are heavily driven by{" "}
                <strong>{topSlice.category}</strong>, accounting for{" "}
                <strong>{topSlice.percentage.toFixed(1)}%</strong> ({formatCurrency(topSlice.amount)})
                of your total budget. Focusing your saving efforts on this dominant category will produce
                the most significant financial relief.
              </>
            ) : isModerateConcentration ? (
              <>
                <strong>{topSlice.category}</strong> represents your leading expense at{" "}
                <strong>{topSlice.percentage.toFixed(1)}%</strong> ({formatCurrency(topSlice.amount)})
                {secondSlice ? (
                  <>, followed closely by <strong>{secondSlice.category}</strong> at{" "}
                  <strong>{secondSlice.percentage.toFixed(1)}%</strong> ({formatCurrency(secondSlice.amount)})</>
                ) : null}
                . Your spending is moderately distributed across your active categories.
              </>
            ) : (
              <>
                Your expenses are well-diversified across {slices.length} active categories this week,
                led by <strong>{topSlice.category}</strong> ({topSlice.percentage.toFixed(1)}%).
                A balanced category distribution prevents unexpected cash flow shortfalls.
              </>
            )}
          </p>

          {hasSignificantOthers && othersSlice && (
            <p className="interpretation-secondary-note">
              <FaFireAlt className="inline-icon" aria-hidden="true" />
              <span>
                <strong>Others</strong> pools together{" "}
                <strong>{othersSlice.percentage.toFixed(1)}%</strong> ({formatCurrency(othersSlice.amount)})
                of your spending across secondary categories. Tracking or grouping these into primary
                budgets will enhance your predictive AI forecast accuracy.
              </span>
            </p>
          )}

          {activeWalletBudget !== null && activeWalletBudget !== undefined && activeWalletBudget > 0 && (
            <p className="interpretation-budget-note">
              <span>
                Compared against your active wallet budget of{" "}
                <strong>{formatCurrency(activeWalletBudget)}</strong>, you have utilized{" "}
                <strong>{((total / activeWalletBudget) * 100).toFixed(1)}%</strong> of available funds this week.
              </span>
            </p>
          )}
        </div>
      </div>
    </article>
  );
}
