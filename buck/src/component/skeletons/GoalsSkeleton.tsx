"use client";

import React from "react";
import "@/app/dashboard/goals/style.css";
import "@/app/dashboard/goals/progress-bar.css";
import "./skeletons.css";

/**
 * 1:1 High-Fidelity Goals Tab Skeleton
 * Renders the page's own layout classes (.GoalsPage, .GoalsCard, .goals-list,
 * .GoalsContainer, .goal-details, .goal-details-grid, .progress-card,
 * .goals-bottom-buttons) with shimmer placeholders. Both goal stylesheets are
 * imported because loading.tsx renders before page.tsx (and its CSS) loads.
 */
export default function GoalsSkeleton() {
  return (
    <div className="GoalsPage dashboard-skeleton" aria-busy="true" aria-label="Loading goals">
      {/* Left: goals list */}
      <div className="GoalsCard">
        <div className="goals-header">
          <h2><span className="skeleton-text">Your Goals</span></h2>
        </div>
        <div className="goal-buttons-container">
          <span className="goals-create-btn skeleton-text">+ Create New Goal</span>
          <span className="goals-create-btn skeleton-text">- Delete Goal</span>
        </div>
        <div className="goals-list">
          {["Emergency fund", "New laptop", "Holiday trip"].map((name, i) => (
            <div key={name} className={`goals-card ${i === 0 ? "selected" : ""}`}>
              <h3><span className="skeleton-text">{name}</span></h3>
              <p><span className="skeleton-text">Target: ₱00,000.00</span></p>
              <p><span className="skeleton-text">Created: 2026-01-01</span></p>
              <p><span className="skeleton-text">Due: 2026-12-31</span></p>
            </div>
          ))}
        </div>
      </div>

      {/* Right: goal details */}
      <div className="GoalsContainer">
        <div className="goal-details">
          <div className="goal-details-header">
            <span className="setActiveButton skeleton-text">Set as Inactive</span>
          </div>
          <h2><span className="skeleton-text">Goal Details</span></h2>
          <div className="goal-details-grid">
            {[
              "Name: Emergency fund",
              "Target Amount: ₱00,000.00",
              "Target Date: 2026-12-31",
              "Created: 2026-01-01",
              "Attitude: Normal",
              "Status: Active",
            ].map((row) => (
              <p key={row}><span className="skeleton-text">{row}</span></p>
            ))}
          </div>

          {/* ProgressBarCard */}
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
        </div>

        <div className="goals-bottom-buttons">
          <span className="goals-action-btn skeleton-text">See Forecast</span>
          <span className="goals-action-btn skeleton-text">See Statistics</span>
        </div>

        {/* Recent Expenses list (inline styles mirror page.tsx) */}
        <div style={{ marginTop: 32 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 12 }}>
            <span className="skeleton-text">Recent Expenses</span>
          </h3>
          {Array.from({ length: 3 }, (_, i) => (
            <div
              key={i}
              style={{
                marginBottom: 8,
                border: "1px solid var(--buck-line)",
                borderRadius: 10,
                padding: "10px 18px",
                display: "flex",
                alignItems: "center",
                gap: 16,
              }}
            >
              <span className="skeleton-text" style={{ fontWeight: 700, minWidth: 120 }}>Category</span>
              <span style={{ flex: 1 }}><span className="skeleton-text">Expense description</span></span>
              <span className="skeleton-text" style={{ fontWeight: 700, minWidth: 80 }}>₱0,000.00</span>
              <span className="skeleton-text" style={{ fontSize: 14, minWidth: 90 }}>2026-01-01</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
