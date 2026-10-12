"use client";

import React from "react";
import "@/app/dashboard/financial-advisor/style.css";
import "./skeletons.css";

/**
 * 1:1 High-Fidelity Financial Advisor Tab Skeleton
 * Renders the page's own layout classes (.advisor-hero, .advisor-grid,
 * .advisor-ai-grid, .advisor-card) with shimmer placeholders, so padding,
 * grid tracks and breakpoints are identical by construction.
 * The page stylesheet is imported here because loading.tsx renders before
 * page.tsx (and its CSS) has loaded.
 */
export default function FinancialAdvisorSkeleton() {
  return (
    <div className="advisor-page dashboard-skeleton" aria-busy="true" aria-label="Loading financial advisor">
      {/* Hero: eyebrow + title + 2-line description | refresh button + health score */}
      <section className="advisor-hero">
        <div style={{ flex: 1, minWidth: 0 }}>
          <p className="advisor-eyebrow" style={{ margin: 0 }}>
            <span className="skeleton-text">Financial Advisor</span>
          </p>
          <h2><span className="skeleton-text">Advice that sounds like a next step.</span></h2>
          <p>
            <span className="skeleton-text">
              Buck turns your current wallet, expense rhythm, and active goal into plain recommendations you can act on today.
            </span>
          </p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <span className="skeleton-button" style={{ width: 150, height: 40, borderRadius: 10 }} />
          <span className="skeleton-circle advisor-score" style={{ borderRadius: "50%" }} />
        </div>
      </section>

      {/* 3 metric cards */}
      <section className="advisor-grid">
        {["Wallet room", "This week", "Goal protection"].map((eyebrow) => (
          <article key={eyebrow} className="advisor-card">
            <span className="skeleton-avatar advisor-icon" />
            <p className="advisor-eyebrow"><span className="skeleton-text">{eyebrow}</span></p>
            <h3><span className="skeleton-text">₱00,000.00</span></h3>
            <p>
              <span className="skeleton-text">Advice based on your wallet, spending rhythm and goal appears here.</span>
            </p>
          </article>
        ))}
      </section>

      {/* 2 AI cards */}
      <div className="advisor-ai-grid">
        {[
          ["AI Suggestion", "What to do next"],
          ["AI Advice", "Detailed Analysis"],
        ].map(([eyebrow, title]) => (
          <section key={eyebrow} className="advisor-card advisor-card--wide" style={{ display: "flex", flexDirection: "column" }}>
            <span className="skeleton-avatar advisor-icon" />
            <div>
              <p className="advisor-eyebrow"><span className="skeleton-text">{eyebrow}</span></p>
              <h3><span className="skeleton-text">{title}</span></h3>
              <div style={{ minHeight: 80, marginTop: "1rem", display: "flex", flexDirection: "column", gap: 10 }}>
                <span className="skeleton-line" style={{ width: "100%", height: 13 }} />
                <span className="skeleton-line" style={{ width: "94%", height: 13 }} />
                <span className="skeleton-line" style={{ width: "78%", height: 13 }} />
              </div>
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
