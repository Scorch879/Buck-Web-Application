"use client";

import React from "react";
import "@/app/dashboard/forecast/style.css";
import "./skeletons.css";

const Line = ({ width, height = 13 }: { width: string | number; height?: number }) => (
  <span className="skeleton-line" style={{ width, height }} />
);

/**
 * 1:1 High-Fidelity AI Forecaster Tab Skeleton (ADR-012, ADR-052)
 * Renders the page's own layout classes (story card with toggle + Refresh,
 * three tiles, chart panel, heads-up and habits, categories and wallets,
 * goal strip, closed "How this forecast works") with shimmer placeholders.
 * The stylesheet is imported because loading.tsx renders before page.tsx.
 */
export default function ForecastSkeleton() {
  return (
    <div className="forecast-page dashboard-skeleton" aria-busy="true" aria-label="Loading forecast">
      {/* Story: greeting | horizon toggle + Refresh, headline + explanation, figure + ribbon, foot */}
      <section className="forecast-story">
        <div className="forecast-story-top">
          <h2 className="forecast-greeting"><span className="skeleton-text">Your next 30 days</span></h2>
          <div className="forecast-story-controls">
            <span className="skeleton-button" style={{ width: 171, height: 46, borderRadius: 10 }} />
            <span className="skeleton-button" style={{ width: 105, height: 44, borderRadius: 10 }} />
          </div>
        </div>
        <div className="forecast-story-text">
          <div className="forecast-shimmer">
            <span className="forecast-shimmer-line forecast-shimmer-line--headline" />
            <span className="forecast-shimmer-line" />
            <span className="forecast-shimmer-line" />
            <span className="forecast-shimmer-line forecast-shimmer-line--short" />
          </div>
        </div>
        <div className="forecast-figure">
          <p className="forecast-figure-line">
            <span className="forecast-figure-likely"><span className="skeleton-text">Likely ₱00,000</span></span>
            <span className="forecast-figure-range"><span className="skeleton-text">somewhere between ₱00,000 and ₱00,000</span></span>
          </p>
          <div className="forecast-ribbon">
            <span className="skeleton-line" style={{ position: "absolute", inset: "4px 0", height: "auto", borderRadius: 999 }} />
          </div>
          <div className="forecast-ribbon-labels">
            <span className="skeleton-text">Low ₱00,000</span>
            <span className="skeleton-text">High ₱00,000</span>
          </div>
        </div>
        <div className="forecast-story-foot">
          <span className="skeleton-pill" style={{ width: 84, height: 24, borderRadius: 999 }} />
          <span className="forecast-foot-note"><span className="skeleton-text">Written by AI from your Buck data. It can be wrong.</span></span>
        </div>
      </section>

      {/* Three tiles */}
      <section className="forecast-tiles">
        {["This month's likely total", "Likely left over", "Cash lasts until"].map((label) => (
          <article key={label} className="forecast-tile">
            <h3 className="forecast-tile-label"><span className="skeleton-text">{label}</span></h3>
            <strong className="forecast-tile-value"><span className="skeleton-text">₱00,000</span></strong>
            <p className="forecast-tile-note"><span className="skeleton-text">₱00,000 spent so far, 00 days left.</span></p>
          </article>
        ))}
      </section>

      {/* Chart panel: title + Running total/Day by day toggle, legend, chart */}
      <section className="forecast-panel forecast-chart-panel">
        <div className="forecast-chart-block">
          <div className="forecast-chart-toolbar">
            <h3 className="forecast-panel-title"><span className="skeleton-text">How your spending adds up</span></h3>
            <span className="skeleton-button" style={{ width: 234, height: 46, borderRadius: 10 }} />
          </div>
          <div className="forecast-legend">
            <Line width={56} />
            <Line width={84} />
            <Line width={104} />
          </div>
          <div className="forecast-chart">
            <span className="skeleton-line" style={{ width: "100%", height: "100%", borderRadius: 8 }} />
          </div>
        </div>
      </section>

      {/* Heads-up | Habits */}
      <div className="forecast-two-col">
        {["Heads-up", "Your habits"].map((title) => (
          <section key={title} className="forecast-panel">
            <h3 className="forecast-panel-title"><span className="skeleton-text">{title}</span></h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Line width="100%" height={18} />
              <Line width="80%" height={18} />
            </div>
          </section>
        ))}
      </div>

      {/* Top 4 categories + Others | Wallet rows */}
      <div className="forecast-two-col">
        <section className="forecast-panel">
          <h3 className="forecast-panel-title"><span className="skeleton-text">Where it likely goes</span></h3>
          <ul className="forecast-rows">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="forecast-row">
                <div className="forecast-row-main">
                  <span className="forecast-row-name"><span className="skeleton-text">Category</span></span>
                  <span className="forecast-row-amount"><span className="skeleton-text">₱0,000</span></span>
                </div>
                <span className="skeleton-line" style={{ width: "100%", height: 6, borderRadius: 999 }} />
              </li>
            ))}
          </ul>
        </section>
        <section className="forecast-panel">
          <h3 className="forecast-panel-title"><span className="skeleton-text">Your wallets</span></h3>
          <ul className="forecast-rows">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="forecast-row forecast-wallet-row">
                <div className="forecast-row-main">
                  <span className="forecast-row-name"><span className="skeleton-text">Wallet name</span></span>
                  <span className="forecast-row-amount"><span className="skeleton-text">₱00,000</span></span>
                </div>
                <p className="forecast-row-note"><span className="skeleton-text">Likely runs out around Nov 00.</span></p>
              </li>
            ))}
          </ul>
        </section>
      </div>

      {/* Goal strip */}
      <section className="forecast-goal">
        <span className="forecast-goal-icon skeleton-avatar" />
        <p className="forecast-goal-text">
          <span className="skeleton-text">Goal name: ₱00,000 to go. Likely reached around Nov 00.</span>
        </p>
      </section>

      {/* How this forecast works (closed) */}
      <div className="forecast-how">
        <div style={{ display: "flex", alignItems: "center", minHeight: 48 }}>
          <span className="skeleton-text">How this forecast works</span>
        </div>
      </div>
    </div>
  );
}
