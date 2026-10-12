"use client";

import React from "react";
import "@/app/dashboard/goals/style.css";
import "@/app/dashboard/goals/progress-bar.css";
import "./skeletons.css";

const GOALS = [
  { name: "Emergency fund", pct: 64 },
  { name: "New laptop", pct: 28 },
  { name: "Holiday trip", pct: 82 },
];

/**
 * 1:1 Goals Tab Skeleton.
 * Renders the page's own classes: goal list (.GoalsCard / .goals-card) and the
 * selected-goal panel (.goal-detail-header, .goal-overview with the progress
 * card + .goal-facts, AI card, actions, .goal-expenses). Both goal stylesheets
 * are imported because loading.tsx renders before page.tsx (and its CSS) loads.
 */
export default function GoalsSkeleton() {
  return (
    <div className="GoalsPage dashboard-skeleton" aria-busy="true" aria-label="Loading goals">
      <aside className="GoalsCard">
        <div className="goals-sidebar-header">
          <div>
            <p className="goals-eyebrow"><span className="skeleton-text">Savings</span></p>
            <h2><span className="skeleton-text">Your goals</span></h2>
          </div>
          <span className="goals-count-badge skeleton-text">3</span>
        </div>
        <span className="goals-create-btn goals-create-btn--block skeleton-text">+ New goal</span>
        <div className="goals-list">
          {GOALS.map((goal, i) => (
            <div key={goal.name} className={`goals-card${i === 0 ? " selected" : ""}`}>
              <span className="goals-card-top">
                <span className="goals-card-name"><span className="skeleton-text">{goal.name}</span></span>
              </span>
              <span className="goals-card-track">
                <span className="skeleton-line" style={{ width: `${goal.pct}%` }} />
              </span>
              <span className="goals-card-meta">
                <span className="skeleton-text">₱00,000.00 of ₱00,000.00</span>
                <span className="skeleton-text">00%</span>
              </span>
              <span className="goals-card-due"><span className="skeleton-text">Due Dec 31, 2026</span></span>
            </div>
          ))}
        </div>
      </aside>

      <section className="GoalsContainer">
        <header className="goal-detail-header">
          <div className="goal-detail-title">
            <p className="goals-eyebrow"><span className="skeleton-text">Goal details</span></p>
            <div className="goal-detail-name">
              <h2><span className="skeleton-text">Emergency fund</span></h2>
              <span className="goals-pill skeleton-text">Active</span>
            </div>
          </div>
          <div className="goal-detail-actions">
            <span className="goals-ghost-btn skeleton-text">Set as inactive</span>
            <span className="goals-ghost-btn skeleton-text">Delete</span>
          </div>
        </header>

        <div className="goal-overview">
          <div className="progress-card">
            <div className="progress-ring-layout">
              <div className="progress-liquid-container skeleton-circle" />
              <div className="progress-info">
                <h3 className="progress-title"><span className="skeleton-text">Goal Progress</span></h3>
                <div className="progress-stats">
                  <span className="progress-amount skeleton-text">Saved: ₱00,000.00</span>
                  <span className="progress-remaining skeleton-text">Remaining: ₱00,000.00</span>
                  <span className="progress-target skeleton-text">Target: ₱00,000.00</span>
                </div>
                <span className="progress-add-btn skeleton-text">+ Add Progress</span>
              </div>
            </div>
          </div>
          <dl className="goal-facts">
            {[
              ["Target date", "Dec 31, 2026"],
              ["Time left", "000 days"],
              ["Save per day", "₱000.00"],
              ["Saving attitude", "Normal"],
            ].map(([label, value]) => (
              <div key={label}>
                <dt><span className="skeleton-text">{label}</span></dt>
                <dd><span className="skeleton-text">{value}</span></dd>
              </div>
            ))}
          </dl>
        </div>

        {/* The page shows this card (with a loading message) as soon as a goal is selected */}
        <div className="ai-recommendation">
          <strong><span className="skeleton-text">AI recommendation</span></strong>
          <div className="ai-recommendation-content"><span className="skeleton-text">Loading AI recommendation...</span></div>
        </div>

        <div className="goals-bottom-buttons">
          <span className="goals-action-btn skeleton-text">See forecast</span>
          <span className="goals-ghost-btn skeleton-text">Open statistics</span>
        </div>

        <div className="goal-expenses">
          <div className="goal-expenses-header">
            <h3><span className="skeleton-text">Linked expenses</span></h3>
          </div>
          <ul className="goal-expenses-list">
            {Array.from({ length: 3 }, (_, i) => (
              <li key={i} className="goal-expense-row">
                <span className="goal-expense-main">
                  <strong><span className="skeleton-text">Expense description</span></strong>
                  <span><span className="skeleton-text">Category · Oct 12</span></span>
                </span>
                <span className="goal-expense-amount"><span className="skeleton-text">₱000.00</span></span>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
