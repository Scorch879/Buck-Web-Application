"use client";

import React from "react";
import "@/app/dashboard/financial-advisor/style.css";
import "@/app/dashboard/forecast/style.css";
import "./skeletons.css";

/**
 * 1:1 High-Fidelity Predictive Forecast Tab Skeleton
 * Renders the page's own layout classes (.forecast-hero, .advisor-grid,
 * .forecast-ai-grid, .forecast-card--wide) with shimmer placeholders.
 * Both stylesheets are imported because loading.tsx renders before page.tsx.
 */
export default function ForecastSkeleton() {
  return (
    <div className="forecast-page dashboard-skeleton" aria-busy="true" aria-label="Loading forecast">
      {/* Hero: eyebrow + title + description | refresh button + "Projected AI" badge */}
      <section className="forecast-hero">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="forecast-eyebrow" style={{ margin: 0 }}>
            <span className="skeleton-text">Financial Forecast</span>
          </p>
          <h2><span className="skeleton-text">Predict your future spending.</span></h2>
          <p>
            <span className="skeleton-text">
              Buck uses AI to study your past expenses and budgeting habits to give you a clear picture of where your money is heading this cycle.
            </span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span className="skeleton-button" style={{ width: 168, height: 40, borderRadius: 10 }} />
          <span className="advisor-score skeleton-circle" />
        </div>
      </section>

      {/* 3 projection cards */}
      <section className="advisor-grid" style={{ marginBottom: "1.5rem" }}>
        {[
          ["Projected Spending", "Estimated total expenditure by end of cycle."],
          ["Projected Savings", "Net wallet headroom preserved if pace continues."],
          ["Recommended Budget", "Optimal target spend suggested by model."],
        ].map(([eyebrow, text]) => (
          <article key={eyebrow} className="advisor-card">
            <span className="advisor-icon skeleton-avatar" />
            <p className="advisor-eyebrow"><span className="skeleton-text">{eyebrow}</span></p>
            <h3><span className="skeleton-text">₱00,000.00</span></h3>
            <p><span className="skeleton-text">{text}</span></p>
          </article>
        ))}
      </section>

      {/* 2 AI cards */}
      <div className="forecast-ai-grid">
        {[
          ["AI Forecast Summary", "What to expect next month"],
          ["AI Warnings", "Potential Risks"],
        ].map(([eyebrow, title]) => (
          <section key={eyebrow} className="forecast-card forecast-card--wide" style={{ display: "flex", flexDirection: "column" }}>
            <span className="forecast-icon skeleton-avatar" />
            <div>
              <p className="forecast-eyebrow"><span className="skeleton-text">{eyebrow}</span></p>
              <h3><span className="skeleton-text">{title}</span></h3>
              <div style={{ minHeight: 80, marginTop: "1rem", display: "flex", flexDirection: "column", gap: 10 }}>
                <span className="skeleton-line" style={{ width: "100%", height: 13 }} />
                <span className="skeleton-line" style={{ width: "92%", height: 13 }} />
                <span className="skeleton-line" style={{ width: "74%", height: 13 }} />
              </div>
            </div>
          </section>
        ))}
      </div>

    </div>
  );
}
