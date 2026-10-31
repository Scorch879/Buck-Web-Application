"use client";

import React from "react";
import "@/app/dashboard/financial-advisor/style.css";
import "@/app/dashboard/forecast/style.css";
import "./skeletons.css";

const Line = ({ width, height = 13 }: { width: string | number; height?: number }) => (
  <span className="skeleton-line" style={{ width, height }} />
);

/**
 * 1:1 High-Fidelity AI Forecaster Tab Skeleton (ADR-012, ADR-052)
 * Renders the page's own layout classes (.forecast-hero toolbar, chart panel,
 * month panel, category and wallet grids, goal/habits row, explanation and
 * warnings cards) with shimmer placeholders.
 * Both stylesheets are imported because loading.tsx renders before page.tsx.
 */
export default function ForecastSkeleton() {
  return (
    <div className="forecast-page dashboard-skeleton" aria-busy="true" aria-label="Loading forecast">
      {/* Hero: eyebrow + chip, title, description | horizon toggle + Refresh */}
      <section className="forecast-hero">
        <div className="forecast-hero-copy">
          <div className="forecast-hero-meta">
            <p className="forecast-eyebrow">
              <span className="skeleton-text">Financial Forecast</span>
            </p>
          </div>
          <h2><span className="skeleton-text">Where your spending is likely heading.</span></h2>
          <p>
            <span className="skeleton-text">
              Buck studies your own spending history and gives likely ranges for the days ahead, not exact promises.
            </span>
          </p>
        </div>
        <div className="forecast-hero-actions">
          <span className="skeleton-button" style={{ width: 171, height: 46, borderRadius: 10 }} />
          <span className="skeleton-button" style={{ width: 105, height: 44, borderRadius: 10 }} />
        </div>
      </section>

      {/* Chart panel: header, legend + Daily/Cumulative toggle, chart */}
      <section className="forecast-panel">
        <header className="forecast-panel-head">
          <p className="forecast-eyebrow"><span className="skeleton-text">Daily forecast</span></p>
          <h3><span className="skeleton-text">Likely spending, next 30 days</span></h3>
          <p><span className="skeleton-text">Likely total ₱00,000, between ₱00,000 and ₱00,000 in 8 of 10 outcomes.</span></p>
        </header>
        <div className="forecast-chart-block">
          <div className="forecast-chart-toolbar">
            <div className="forecast-legend">
              <Line width={64} />
              <Line width={84} />
              <Line width={104} />
            </div>
            <span className="skeleton-button" style={{ width: 178, height: 46, borderRadius: 10 }} />
          </div>
          <div className="forecast-chart">
            <span className="skeleton-line" style={{ width: "100%", height: "100%", borderRadius: 8 }} />
          </div>
        </div>
      </section>

      {/* Month panel: 3 stats */}
      <section className="forecast-panel">
        <header className="forecast-panel-head">
          <p className="forecast-eyebrow"><span className="skeleton-text">This month</span></p>
          <h3><span className="skeleton-text">00 days left</span></h3>
        </header>
        <div className="forecast-month-grid">
          {["Spent so far", "Likely month total", "Likely left over"].map((label) => (
            <div key={label} className="forecast-stat">
              <span className="forecast-stat-label"><span className="skeleton-text">{label}</span></span>
              <strong><span className="skeleton-text">₱00,000</span></strong>
              <span className="forecast-stat-note"><span className="skeleton-text">Likely between ₱00,000 and ₱00,000</span></span>
            </div>
          ))}
        </div>
      </section>

      {/* Top 5 categories */}
      <section className="forecast-section">
        <header className="forecast-section-head">
          <p className="forecast-eyebrow"><span className="skeleton-text">Top categories</span></p>
          <h3><span className="skeleton-text">Where the next 30 days likely go</span></h3>
        </header>
        <div className="forecast-category-grid">
          {Array.from({ length: 5 }, (_, i) => (
            <article key={i} className="forecast-mini-card">
              <div className="forecast-mini-head">
                <Line width="45%" height={16} />
                <span className="skeleton-pill" style={{ width: 58, height: 22, borderRadius: 999 }} />
              </div>
              <strong className="forecast-mini-amount"><span className="skeleton-text">₱0,000</span></strong>
              <span className="skeleton-line" style={{ width: "100%", height: 6, borderRadius: 999 }} />
              <p><span className="skeleton-text">00% of spending · ₱0,000 for the rest of this month</span></p>
            </article>
          ))}
        </div>
      </section>

      {/* Wallet runway */}
      <section className="forecast-section">
        <header className="forecast-section-head">
          <p className="forecast-eyebrow"><span className="skeleton-text">Wallet runway</span></p>
          <h3><span className="skeleton-text">How long each wallet likely lasts</span></h3>
        </header>
        <div className="forecast-wallet-grid">
          {Array.from({ length: 3 }, (_, i) => (
            <article key={i} className="forecast-mini-card">
              <div className="forecast-mini-head">
                <Line width="50%" height={16} />
                <span className="skeleton-pill" style={{ width: 54, height: 22, borderRadius: 999 }} />
              </div>
              <strong className="forecast-mini-amount"><span className="skeleton-text">₱00,000</span></strong>
              <p><span className="skeleton-text">Likely spend ₱0,000 over 30 days (between ₱0,000 and ₱0,000).</span></p>
              <p className="forecast-runway"><span className="skeleton-text">Likely runs out around Nov 00 (Nov 00 – Nov 00).</span></p>
            </article>
          ))}
        </div>
      </section>

      {/* Goal | Habits */}
      <div className="forecast-two-col">
        {[
          ["Goal", "Savings goal"],
          ["Habits", "Patterns in your spending"],
        ].map(([eyebrow, title]) => (
          <section key={eyebrow} className="forecast-panel">
            <header className="forecast-panel-head forecast-panel-head--icon">
              <span className="forecast-icon skeleton-avatar" />
              <div>
                <p className="forecast-eyebrow"><span className="skeleton-text">{eyebrow}</span></p>
                <h3><span className="skeleton-text">{title}</span></h3>
              </div>
            </header>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Line width="100%" height={18} />
              <Line width="92%" height={18} />
              <Line width="70%" height={18} />
            </div>
          </section>
        ))}
      </div>

      {/* Explanation | Warnings */}
      <div className="forecast-ai-grid">
        {[
          ["AI Forecast explanation", "Your likely month"],
          ["AI Warnings", "Potential risks"],
        ].map(([eyebrow, title]) => (
          <section key={eyebrow} className="forecast-card forecast-card--wide">
            <span className="forecast-icon skeleton-avatar" />
            <div className="forecast-explanation-body">
              <div className="forecast-explanation-meta">
                <p className="forecast-eyebrow"><span className="skeleton-text">{eyebrow}</span></p>
              </div>
              <h3><span className="skeleton-text">{title}</span></h3>
              <div className="forecast-explanation-text" style={{ display: "flex", flexDirection: "column", gap: 10, minHeight: "6.4em" }}>
                <Line width="100%" />
                <Line width="92%" />
                <Line width="74%" />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
