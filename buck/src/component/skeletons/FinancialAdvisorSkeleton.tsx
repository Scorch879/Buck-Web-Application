"use client";

import React from "react";
import "@/app/dashboard/financial-advisor/style.css";
import "./skeletons.css";

const STAT_CARDS = [
  { eyebrow: "Wallet room", value: "₱00,000.00", meta: "Active: Wallet · Total ₱000,000.00", rows: 2, progress: false },
  { eyebrow: "This week", value: "₱0,000.00", meta: "Since Mon, Oct 00", rows: 2, progress: false },
  { eyebrow: "Goal protection", value: "Goal name", meta: "₱0,000.00 of ₱00,000.00 saved", rows: 2, progress: true },
];

/**
 * 1:1 High-Fidelity Financial Advisor Tab Skeleton
 * Renders the page's own layout classes (.advisor-hero, .advisor-grid,
 * .advisor-stat, .advisor-sublist, .advisor-ai-grid) with shimmer
 * placeholders, so padding, grid tracks and breakpoints are identical by
 * construction. The AI chat lives in the floating AIChatBubble, not here.
 * The page stylesheet is imported here because loading.tsx renders before
 * page.tsx (and its CSS) has loaded.
 */
export default function FinancialAdvisorSkeleton() {
  return (
    <div className="advisor-page dashboard-skeleton" aria-busy="true" aria-label="Loading financial advisor">
      {/* Hero: eyebrow + title + lead | (updated pill + refresh button) + health score */}
      <section className="advisor-hero">
        <div className="advisor-hero__copy">
          <p className="advisor-eyebrow">
            <span className="skeleton-text">Financial Advisor</span>
          </p>
          <h2><span className="skeleton-text">Advice that sounds like a next step.</span></h2>
          <p className="advisor-hero__lead">
            <span className="skeleton-text">
              Buck turns your current wallet, expense rhythm, and active goal into plain recommendations you can act on today.
            </span>
          </p>
        </div>
        <div className="advisor-hero__side">
          <div className="advisor-hero__actions">
            <span className="skeleton-pill" style={{ width: 132, height: 28, borderRadius: 999 }} />
            <span className="skeleton-button" style={{ width: 150, height: 40, borderRadius: 10 }} />
          </div>
          <span className="skeleton-circle advisor-score" style={{ borderRadius: "50%" }} />
        </div>
      </section>

      {/* 3 stat cards: head, value, meta, (progress), sub-list, body */}
      <section className="advisor-grid">
        {STAT_CARDS.map((card) => (
          <article key={card.eyebrow} className="advisor-card advisor-stat">
            <div className="advisor-stat__head">
              <span className="skeleton-avatar advisor-icon" />
              <p className="advisor-eyebrow"><span className="skeleton-text">{card.eyebrow}</span></p>
            </div>
            <h3 className="advisor-stat__value"><span className="skeleton-text">{card.value}</span></h3>
            <p className="advisor-stat__meta"><span className="skeleton-text">{card.meta}</span></p>
            {card.progress ? (
              <div className="advisor-progress">
                <span className="advisor-progress__track skeleton-line" />
                <span className="advisor-progress__value"><span className="skeleton-text">00%</span></span>
              </div>
            ) : null}
            <ul className="advisor-sublist" aria-hidden="true">
              {Array.from({ length: card.rows }, (_, i) => (
                <li key={i}>
                  <span><span className="skeleton-text">Detail label</span></span>
                  <span><span className="skeleton-text">₱0,000.00</span></span>
                </li>
              ))}
            </ul>
            <p className="advisor-stat__body">
              <span className="skeleton-text">Advice based on your wallet, spending rhythm and goal appears here.</span>
            </p>
          </article>
        ))}
      </section>

      {/* AI row: emphasised suggestion + detailed analysis */}
      <div className="advisor-ai-grid">
        <section className="advisor-card advisor-next">
          <div className="advisor-stat__head">
            <span className="skeleton-avatar advisor-icon" />
            <div>
              <p className="advisor-eyebrow"><span className="skeleton-text">AI Suggestion</span></p>
              <h3><span className="skeleton-text">What to do next</span></h3>
            </div>
          </div>
          <div className="advisor-next__text" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="skeleton-line" style={{ width: "100%", height: 16 }} />
            <span className="skeleton-line" style={{ width: "72%", height: 16 }} />
          </div>
          <span className="advisor-next__ask skeleton-button" style={{ width: 210 }} />
        </section>

        <section className="advisor-card advisor-analysis">
          <div className="advisor-stat__head">
            <span className="skeleton-avatar advisor-icon" />
            <div>
              <p className="advisor-eyebrow"><span className="skeleton-text">AI Advice</span></p>
              <h3><span className="skeleton-text">Detailed Analysis</span></h3>
            </div>
          </div>
          <div className="advisor-analysis__text" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <span className="skeleton-line" style={{ width: "100%", height: 13 }} />
            <span className="skeleton-line" style={{ width: "96%", height: 13 }} />
            <span className="skeleton-line" style={{ width: "98%", height: 13 }} />
            <span className="skeleton-line" style={{ width: "64%", height: 13 }} />
          </div>
          <p className="advisor-footnote">
            <span className="skeleton-text">Figures cover Oct 1–Oct 00 this month and your last 30 days of expenses.</span>
          </p>
        </section>
      </div>
    </div>
  );
}
