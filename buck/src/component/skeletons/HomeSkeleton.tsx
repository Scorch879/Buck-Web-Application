"use client";

import React from "react";
import "@/app/dashboard/home/style.css";
import "./skeletons.css";

const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const BAR_HEIGHTS = [38, 62, 84, 22, 55, 30, 46];
const LEGEND_NAMES = ["Transportation", "Entertainment", "Electronics", "Video Games", "Others"];

/**
 * 1:1 High-Fidelity Home Dashboard Skeleton
 * Renders the Home page's own layout classes with shimmer placeholders, so every
 * gap, padding, grid track, container query and breakpoint is identical by
 * construction (no duplicated geometry to drift):
 * 1. Category Breakdown card (.spending-card / .spending-pie-*) incl. timeframe toggle.
 * 2. Expenses by day card (.graph-card / .graph-container / .graph-col).
 * 3. Financial Summary (.summary-card / .summary-content / .summary-item).
 * 4. AI Financial Advisor card (.ai-advisor-card / .home-ai-*).
 * The page stylesheet is imported here because loading.tsx renders before
 * page.tsx (and its CSS) has loaded.
 */
export default function HomeSkeleton() {
  return (
    <div className="dashboard-container dashboard-skeleton" aria-busy="true" aria-label="Loading dashboard">
      <section className="dashboard-content" aria-label="Spending overview">
        {/* 1. Category Breakdown */}
        <article className="spending-card">
          <div className="spending-card-header">
            <div className="card-heading">
              <p className="card-eyebrow"><span className="skeleton-text">Category Spending</span></p>
              <h2 className="spending-card-title"><span className="skeleton-text">Category Breakdown</span></h2>
              <div className="pie-day-filter-slot" />
            </div>
            <div className="spending-timeframe-container">
              <div className="timeframe-toggle-group">
                {["All Time", "This Month", "This Week"].map((label) => (
                  <span key={label} className="timeframe-btn skeleton-text" style={{ borderRadius: 999 }}>
                    {label}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="spending-pie-layout">
            <div className="spending-pie-legend">
              <span className="spending-pie-legend-item spending-pie-legend-item--all">
                <span className="spending-pie-legend-dot skeleton-avatar" />
                <span className="spending-pie-legend-name skeleton-text">All</span>
              </span>
              {LEGEND_NAMES.map((name) => (
                <span key={name} className="spending-pie-legend-item">
                  <span className="spending-pie-legend-dot skeleton-avatar" />
                  <span className="spending-pie-legend-name skeleton-text">{name}</span>
                  <span className="spending-pie-legend-pct skeleton-text">00%</span>
                </span>
              ))}
            </div>
            <div className="spending-pie-canvas-box">
              <div
                className="spending-pie-canvas-inner"
                style={{ display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <span className="skeleton-circle" style={{ width: 210, height: 210, borderRadius: "50%" }} />
              </div>
              <div className="spending-pie-center-info">
                <span className="spending-pie-center-amount skeleton-text">₱00,000.00</span>
                <span className="spending-pie-center-label skeleton-text">Total this week</span>
              </div>
            </div>
          </div>
        </article>

        {/* 2. Expenses by day */}
        <article className="graph-card">
          <div className="card-heading-row">
            <div className="card-heading">
              <p className="card-eyebrow"><span className="skeleton-text">Weekly Summary</span></p>
              <div className="summary-title-row">
                <h2 className="graph-title"><span className="skeleton-text">Expenses by day</span></h2>
              </div>
            </div>
          </div>
          <div className="graph-container">
            <div className="graph-y-axis-wrap">
              <span className="graph-axis-title graph-axis-title--y">Amount (₱)</span>
              <div className="graph-axis">
                {["10,000", "8,000", "6,000", "4,000", "2,000", "0"].map((tick) => (
                  <span key={tick} className="skeleton-text">{tick}</span>
                ))}
              </div>
            </div>
            <div className="graph-body">
              <div className="graph-bars">
                <div className="graph-grid">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className="graph-grid-line" style={{ bottom: `${((5 - i) / 5) * 100}%` }} />
                  ))}
                </div>
                {WEEK_DAYS.map((day, i) => (
                  <div key={day} className="graph-col">
                    <span className="graph-bar" style={{ "--bar-height": `${BAR_HEIGHTS[i]}%` } as React.CSSProperties} />
                    <span className="graph-bar-label"><span className="skeleton-text">{day}</span></span>
                  </div>
                ))}
              </div>
              <div className="graph-x-axis-footer">
                <span className="graph-axis-title graph-axis-title--x">Day of the Week</span>
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* 3. Financial Summary */}
      <section className="summary-card">
        <div className="card-heading-row">
          <div className="card-heading">
            <p className="card-eyebrow"><span className="skeleton-text">Categories</span></p>
            <div className="summary-title-row">
              <h2 className="summary-title"><span className="skeleton-text">Financial Summary</span></h2>
            </div>
          </div>
        </div>
        <div className="summary-content">
          {Array.from({ length: 4 }, (_, i) => (
            <article key={i} className="summary-item">
              <div className="summary-item-value"><span className="skeleton-text">₱0,000.00</span></div>
              <div className="summary-item-label"><span className="skeleton-text">Category name</span></div>
              <p className="summary-item-description">
                <span className="skeleton-text">Short description of what this category covers.</span>
              </p>
            </article>
          ))}
        </div>
      </section>

      {/* 4. AI Financial Advisor */}
      <article className="interpretation-card ai-advisor-card">
        <div className="home-ai-header">
          <div className="home-ai-header-info">
            <div className="home-ai-eyebrow-row">
              <p className="card-eyebrow"><span className="skeleton-text">Financial Advisor</span></p>
            </div>
            <h2 className="home-ai-title"><span className="skeleton-text">Advice that sounds like a next step.</span></h2>
            <p className="home-ai-desc">
              <span className="skeleton-text">
                Buck turns your current wallet, expense rhythm, and active goal into plain recommendations you can act on today.
              </span>
            </p>
          </div>
          <div className="home-ai-header-actions">
            <span className="home-ai-link-btn skeleton-text">View Full Advisor →</span>
            <span className="advisor-score home-ai-score skeleton-circle" />
          </div>
        </div>
        <div className="home-ai-grid">
          {["What to do next", "Detailed Analysis"].map((title) => (
            <section key={title} className="home-ai-card">
              <div className="home-ai-card-icon-wrap">
                <span className="advisor-icon skeleton-avatar" />
              </div>
              <div className="home-ai-card-content">
                <p className="advisor-eyebrow"><span className="skeleton-text">AI Suggestion</span></p>
                <h3 className="home-ai-card-title"><span className="skeleton-text">{title}</span></h3>
                <p className="home-ai-card-text">
                  <span className="skeleton-text">Analyzing your financial data and preparing a recommendation…</span>
                </p>
              </div>
            </section>
          ))}
        </div>
      </article>
    </div>
  );
}
