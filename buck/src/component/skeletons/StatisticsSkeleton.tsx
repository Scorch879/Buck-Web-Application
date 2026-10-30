"use client";

import React from "react";
import { MonthlyCashFlowCardSkeleton } from "@/component/income/MonthlyCashFlowCard";
import "@/app/dashboard/statistics/style.css";
import "./skeletons.css";

const TREND_BARS = [40, 62, 35, 75, 50, 30, 58];
const CATEGORY_ROWS = [
  { name: "Food", width: 100 },
  { name: "Transportation", width: 72 },
  { name: "Bills", width: 55 },
  { name: "Shopping", width: 38 },
  { name: "Others (4)", width: 22 },
];

/**
 * 1:1 Statistics Tab Skeleton (default "Weekly" mode).
 * Renders the page's own .stats-* classes: cash-flow card, period toolbar,
 * then Budget | Categories, Trend | Latest expenses, Forecast.
 */
export default function StatisticsSkeleton() {
  return (
    <div className="stats-page dashboard-skeleton" aria-busy="true" aria-label="Loading statistics">
      <MonthlyCashFlowCardSkeleton withAddButton={false} />

      <header className="stats-card stats-toolbar">
        <div className="stats-heading">
          <p className="stats-eyebrow"><span className="skeleton-text">Statistics</span></p>
          <h2><span className="skeleton-text">Spending breakdown</span></h2>
        </div>
        <div className="stats-period">
          <div className="stats-segmented">
            {["Weekly", "Monthly", "Overall"].map((label) => (
              <span key={label} className="stats-segmented-btn">
                <span className="skeleton-text">{label}</span>
              </span>
            ))}
          </div>
          <div className="stats-stepper">
            <span className="stats-icon-btn skeleton-text" />
            <div className="stats-stepper-label">
              <strong><span className="skeleton-text">This week</span></strong>
              <span><span className="skeleton-text">Oct 6 – Oct 12, 2026</span></span>
            </div>
            <span className="stats-icon-btn skeleton-text" />
          </div>
        </div>
      </header>

      <div className="stats-grid">
        <section className="stats-card stats-budget">
          <div className="stats-card-header">
            <div>
              <p className="stats-eyebrow"><span className="skeleton-text">Budget</span></p>
              <h3><span className="skeleton-text">Spent vs budget</span></h3>
            </div>
          </div>
          <div className="stats-donut">
            <span className="skeleton-circle" style={{ display: "block", width: "100%", height: "100%", borderRadius: "50%" }} />
          </div>
          <dl className="stats-figures">
            {["Spent", "Remaining", "Daily average", "Transactions"].map((label) => (
              <div key={label}>
                <dt><span className="skeleton-text">{label}</span></dt>
                <dd><span className="skeleton-text">₱0,000.00</span></dd>
              </div>
            ))}
          </dl>
          <p className="stats-note"><span className="skeleton-text">Weekly budget ₱0,000 = ¼ of your active wallet (₱0,000).</span></p>
        </section>

        <section className="stats-card stats-categories">
          <div className="stats-card-header">
            <div>
              <p className="stats-eyebrow"><span className="skeleton-text">Categories</span></p>
              <h3><span className="skeleton-text">Where your money went</span></h3>
            </div>
            <span className="stats-badge skeleton-text">5 categories</span>
          </div>
          <ol className="stats-category-list">
            {CATEGORY_ROWS.map((row) => (
              <li key={row.name} className="stats-category-row">
                <div className="stats-category-meta">
                  <span className="stats-category-name">
                    <span className="stats-category-dot skeleton-avatar" />
                    <span className="skeleton-text">{row.name}</span>
                  </span>
                  <span className="stats-category-amount"><span className="skeleton-text">₱0,000.00 00%</span></span>
                </div>
                <div className="stats-category-track">
                  <span className="stats-category-fill skeleton-line" style={{ width: `${row.width}%` }} />
                </div>
              </li>
            ))}
          </ol>
          <p className="stats-category-total">
            <span className="skeleton-text">Total spent</span>
            <strong className="skeleton-text">₱0,000.00</strong>
          </p>
        </section>

        <section className="stats-card stats-trend">
          <div className="stats-card-header">
            <div>
              <p className="stats-eyebrow"><span className="skeleton-text">Trend</span></p>
              <h3><span className="skeleton-text">Daily spending</span></h3>
            </div>
            <ul className="stats-legend">
              <li><span className="skeleton-text">Within budget · 80%+ of budget · Over budget · Budget</span></li>
            </ul>
          </div>
          <div className="stats-trend-chart" style={{ display: "flex", alignItems: "flex-end", gap: "0.75rem", padding: "0 0.5rem 1.5rem 2.5rem", boxSizing: "border-box" }}>
            {TREND_BARS.map((h, i) => (
              <span key={i} className="skeleton-line" style={{ flex: 1, height: `${h}%`, borderRadius: 6 }} />
            ))}
          </div>
          <p className="stats-chart-caption"><span className="skeleton-text">Dashed line: your budget per day, spread evenly from ¼ of your active wallet.</span></p>
        </section>

        <section className="stats-card stats-recent">
          <div className="stats-card-header">
            <div>
              <p className="stats-eyebrow"><span className="skeleton-text">Activity</span></p>
              <h3><span className="skeleton-text">Latest expenses</span></h3>
            </div>
            <span className="stats-add-btn skeleton-text">+ Add</span>
          </div>
          <ul className="stats-recent-list">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="stats-recent-item">
                <div className="stats-recent-main">
                  <strong><span className="skeleton-text">Expense description</span></strong>
                  <span><span className="skeleton-text">Category · Oct 12</span></span>
                </div>
                <span className="stats-recent-amount"><span className="skeleton-text">₱000.00</span></span>
              </li>
            ))}
          </ul>
          <span className="stats-link"><span className="skeleton-text">View all expenses</span></span>
        </section>

        <section className="stats-card stats-forecast">
          <div className="stats-card-header">
            <div>
              <p className="stats-eyebrow"><span className="skeleton-text">AI forecast</span></p>
              <h3><span className="skeleton-text">Forecast vs actual</span></h3>
            </div>
          </div>
          <div className="stats-forecast-body">
            <span className="stats-forecast-chart skeleton-line" style={{ display: "block", borderRadius: 8 }} />
            <p className="stats-forecast-summary"><span className="skeleton-text">To stay on track, keep daily spending under ₱000.00.</span></p>
          </div>
        </section>
      </div>
    </div>
  );
}
