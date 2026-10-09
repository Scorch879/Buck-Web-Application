"use client";

import React from "react";

export type DashboardSkeletonVariant =
  | "home"
  | "goals"
  | "statistics"
  | "settings"
  | "expenses"
  | "wallet"
  | "financial-advisor"
  | "forecast";

function SkeletonBlock({
  className = "",
  rows = 1,
  style,
}: {
  className?: string;
  rows?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div className={`dashboard-skeleton-block ${className}`} style={style}>
      {Array.from({ length: rows }, (_, index) => (
        <span key={index} className="dashboard-skeleton-line" />
      ))}
    </div>
  );
}

/**
 * High-Fidelity Home Dashboard Skeleton
 * Matches: Category Breakdown Donut Pie + Timeframe Pills, Weekly Expenses by Day Bar Chart,
 * Categories Financial Summary, and AI Financial Advisor Card.
 */
function HomeSkeleton() {
  return (
    <div className="dashboard-container dashboard-skeleton" aria-label="Loading dashboard">
      {/* 1. Category Breakdown Pie & Weekly Bar Chart */}
      <section className="dashboard-content" aria-label="Spending overview">
        {/* Category Breakdown Pie Card */}
        <article className="spending-card dashboard-skeleton-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div className="card-heading-row" style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", width: "100%" }}>
            <div className="card-heading">
              <span className="dashboard-skeleton-line" style={{ width: 110, height: 11 }} />
              <span className="dashboard-skeleton-line" style={{ width: 170, height: 22, marginTop: 5 }} />
            </div>
            {/* Timeframe Pill Buttons */}
            <div style={{ display: "flex", gap: 4, background: "rgba(244, 117, 54, 0.08)", padding: 4, borderRadius: 20 }}>
              <span className="dashboard-skeleton-line" style={{ width: 58, height: 22, borderRadius: 16 }} />
              <span className="dashboard-skeleton-line" style={{ width: 70, height: 22, borderRadius: 16 }} />
              <span className="dashboard-skeleton-line" style={{ width: 62, height: 22, borderRadius: 16 }} />
            </div>
          </div>

          {/* Donut Circle Area */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "1rem", margin: "1rem 0" }}>
            <div style={{ position: "relative", width: 180, height: 180, display: "grid", placeItems: "center" }}>
              <span className="dashboard-skeleton-circle" style={{ width: 180, height: 180 }} />
              <div
                style={{
                  position: "absolute",
                  width: 106,
                  height: 106,
                  borderRadius: "50%",
                  background: "var(--buck-surface)",
                  border: "1px solid var(--buck-line)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                }}
              >
                <span className="dashboard-skeleton-line" style={{ width: 54, height: 10 }} />
                <span className="dashboard-skeleton-line" style={{ width: 68, height: 16 }} />
              </div>
            </div>

            {/* 5 Legend Pills Underneath */}
            <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "0.45rem", maxWidth: 380 }}>
              {Array.from({ length: 5 }, (_, i) => (
                <span key={i} className="dashboard-skeleton-line" style={{ width: 85 + ((i * 14) % 35), height: 24, borderRadius: 12 }} />
              ))}
            </div>
          </div>
        </article>

        {/* Weekly Expenses by Day Bar Chart Card */}
        <article className="graph-card dashboard-skeleton-card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div className="card-heading">
            <span className="dashboard-skeleton-line" style={{ width: 105, height: 11 }} />
            <span className="dashboard-skeleton-line" style={{ width: 155, height: 22, marginTop: 5 }} />
          </div>
          <div className="dashboard-skeleton-bars" aria-hidden="true" style={{ minHeight: 250, paddingBottom: 0 }}>
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day, index) => (
              <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                <span style={{ width: "100%", height: `${32 + ((index * 17) % 55)}%`, borderRadius: "6px 6px 2px 2px" }} />
                <span className="dashboard-skeleton-line" style={{ width: 24, height: 10 }} />
              </div>
            ))}
          </div>
        </article>
      </section>

      {/* 2. Categories Financial Summary */}
      <section className="summary-card dashboard-skeleton-card" aria-label="Categories financial summary">
        <div className="card-heading">
          <span className="dashboard-skeleton-line" style={{ width: 80, height: 11 }} />
          <span className="dashboard-skeleton-line" style={{ width: 160, height: 22, marginTop: 5 }} />
        </div>
        <div className="summary-content" style={{ marginTop: "1rem" }}>
          {Array.from({ length: 4 }, (_, index) => (
            <article key={index} className="summary-item dashboard-skeleton-card" style={{ padding: "0.85rem", display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="dashboard-skeleton-line" style={{ width: 90, height: 22 }} />
              <span className="dashboard-skeleton-line" style={{ width: 115, height: 14 }} />
              <span className="dashboard-skeleton-line" style={{ width: "95%", height: 11 }} />
            </article>
          ))}
        </div>
      </section>

      {/* 3. AI Financial Advisor Placeholder Card */}
      <article
        className="ai-advisor-card dashboard-skeleton-card"
        style={{
          padding: "clamp(1.2rem, 2vw, 1.6rem)",
          border: "1px solid var(--buck-line)",
          borderRadius: 12,
          background: "var(--buck-surface)",
          display: "flex",
          flexDirection: "column",
          gap: "1.2rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "0.75rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span className="dashboard-skeleton-avatar" style={{ width: 42, height: 42, borderRadius: 10 }} />
            <div>
              <span className="dashboard-skeleton-line" style={{ width: 165, height: 20 }} />
              <span className="dashboard-skeleton-line" style={{ width: 230, height: 12, marginTop: 4 }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: "0.4rem" }}>
            <span className="dashboard-skeleton-line" style={{ width: 95, height: 24, borderRadius: 12 }} />
            <span className="dashboard-skeleton-line" style={{ width: 115, height: 24, borderRadius: 12 }} />
          </div>
        </div>

        {/* Shimmering Calibration Banner */}
        <div
          style={{
            height: 48,
            borderRadius: 8,
            background: "rgba(244, 117, 54, 0.08)",
            border: "1px solid var(--buck-line)",
            display: "flex",
            alignItems: "center",
            padding: "0 1rem",
            gap: "0.75rem",
          }}
        >
          <span className="dashboard-skeleton-avatar" style={{ width: 18, height: 18 }} />
          <span className="dashboard-skeleton-line" style={{ flex: 1, height: 14 }} />
        </div>

        {/* 3 Capability Preview Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.85rem" }}>
          {Array.from({ length: 3 }, (_, i) => (
            <div key={i} style={{ padding: "1rem", borderRadius: 8, border: "1px solid var(--buck-line)", background: "rgba(255, 197, 71, 0.04)" }}>
              <span className="dashboard-skeleton-line" style={{ width: 120, height: 16 }} />
              <span className="dashboard-skeleton-line" style={{ width: "100%", height: 12, marginTop: 6 }} />
              <span className="dashboard-skeleton-line" style={{ width: "80%", height: 12, marginTop: 4 }} />
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}

/**
 * High-Fidelity Expenses Tab Skeleton
 * Matches: 3 distinct KPI cards (Wallet Balance progress meter, Total Tracked 7-day sparkline,
 * Average Expense range benchmark), Proportional Category Visualizer & Chips, and
 * 2-column layout (Add Expense Form + Expense Tracker List & Search Toolbar).
 */
function ExpensesSkeleton() {
  return (
    <div className="expenses-page dashboard-skeleton" aria-label="Loading expenses">
      {/* ── 1. TOP 3 KPI DATA VISUALIZATIONS ── */}
      <section className="expenses-kpi-grid">
        {/* Card 1: Wallet Balance & Utilization Progress */}
        <article className="expenses-kpi-card dashboard-skeleton-card">
          <div className="expenses-kpi-header">
            <div className="expenses-kpi-icon-wrapper expenses-kpi-icon-wrapper--wallet">
              <span className="dashboard-skeleton-avatar" style={{ width: 22, height: 22 }} />
            </div>
            <div className="expenses-kpi-title-block">
              <span className="dashboard-skeleton-line" style={{ width: 75, height: 10 }} />
              <span className="dashboard-skeleton-line" style={{ width: 110, height: 15, marginTop: 4 }} />
            </div>
            <span className="dashboard-skeleton-line" style={{ width: 68, height: 22, borderRadius: 20 }} />
          </div>

          <div className="expenses-kpi-primary-val">
            <span className="dashboard-skeleton-line" style={{ width: 145, height: 30 }} />
            <span className="dashboard-skeleton-line" style={{ width: 185, height: 12, marginTop: 6 }} />
          </div>

          <div className="expenses-kpi-visual">
            <div className="expenses-kpi-progress-track">
              <span className="dashboard-skeleton-line" style={{ width: "68%", height: "100%", borderRadius: 6 }} />
            </div>
            <div className="expenses-kpi-meta-split">
              <span className="dashboard-skeleton-line" style={{ width: 95, height: 12 }} />
              <span className="dashboard-skeleton-line" style={{ width: 85, height: 12 }} />
            </div>
          </div>
        </article>

        {/* Card 2: Total Tracked & Dual Stat Grid */}
        <article className="expenses-kpi-card dashboard-skeleton-card">
          <div className="expenses-kpi-header">
            <div className="expenses-kpi-icon-wrapper expenses-kpi-icon-wrapper--tracked">
              <span className="dashboard-skeleton-avatar" style={{ width: 22, height: 22 }} />
            </div>
            <div className="expenses-kpi-title-block">
              <span className="dashboard-skeleton-line" style={{ width: 85, height: 10 }} />
              <span className="dashboard-skeleton-line" style={{ width: 105, height: 15, marginTop: 4 }} />
            </div>
            <span className="dashboard-skeleton-line" style={{ width: 60, height: 22, borderRadius: 20 }} />
          </div>

          <div className="expenses-kpi-primary-val">
            <span className="dashboard-skeleton-line" style={{ width: 135, height: 30 }} />
            <span className="dashboard-skeleton-line" style={{ width: 150, height: 12, marginTop: 6 }} />
          </div>

          <div className="expenses-kpi-visual">
            <div className="expenses-kpi-stat-grid">
              <div className="expenses-kpi-stat-box">
                <span className="dashboard-skeleton-line" style={{ width: 60, height: 10 }} />
                <span className="dashboard-skeleton-line" style={{ width: 75, height: 14, marginTop: 4 }} />
              </div>
              <div className="expenses-kpi-stat-box">
                <span className="dashboard-skeleton-line" style={{ width: 65, height: 10 }} />
                <span className="dashboard-skeleton-line" style={{ width: 70, height: 14, marginTop: 4 }} />
              </div>
            </div>
          </div>
        </article>

        {/* Card 3: Average Expense & Dual Stat Grid */}
        <article className="expenses-kpi-card dashboard-skeleton-card">
          <div className="expenses-kpi-header">
            <div className="expenses-kpi-icon-wrapper expenses-kpi-icon-wrapper--average">
              <span className="dashboard-skeleton-avatar" style={{ width: 22, height: 22 }} />
            </div>
            <div className="expenses-kpi-title-block">
              <span className="dashboard-skeleton-line" style={{ width: 90, height: 10 }} />
              <span className="dashboard-skeleton-line" style={{ width: 125, height: 15, marginTop: 4 }} />
            </div>
          </div>

          <div className="expenses-kpi-primary-val">
            <span className="dashboard-skeleton-line" style={{ width: 125, height: 30 }} />
            <span className="dashboard-skeleton-line" style={{ width: 175, height: 12, marginTop: 6 }} />
          </div>

          <div className="expenses-kpi-visual">
            <div className="expenses-kpi-stat-grid">
              <div className="expenses-kpi-stat-box">
                <span className="dashboard-skeleton-line" style={{ width: 70, height: 10 }} />
                <span className="dashboard-skeleton-line" style={{ width: 75, height: 14, marginTop: 4 }} />
              </div>
              <div className="expenses-kpi-stat-box">
                <span className="dashboard-skeleton-line" style={{ width: 75, height: 10 }} />
                <span className="dashboard-skeleton-line" style={{ width: 85, height: 14, marginTop: 4 }} />
              </div>
            </div>
          </div>
        </article>
      </section>

      {/* ── 2. PROPORTIONAL CATEGORY VISUALIZER & CHIPS ── */}
      <section className="expenses-category-visualizer dashboard-skeleton-card">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
            <span className="dashboard-skeleton-avatar" style={{ width: 22, height: 22 }} />
            <div>
              <span className="dashboard-skeleton-line" style={{ width: 230, height: 14 }} />
              <span className="dashboard-skeleton-line" style={{ width: 150, height: 10, marginTop: 4 }} />
            </div>
          </div>
          <span className="dashboard-skeleton-line" style={{ width: 70, height: 20, borderRadius: 12 }} />
        </div>

        {/* Proportional Multi-Segment Allocation Bar */}
        <div style={{ display: "flex", gap: 3, height: 12, borderRadius: 6, overflow: "hidden" }}>
          <span className="dashboard-skeleton-line" style={{ width: "36%", height: "100%", borderRadius: 0 }} />
          <span className="dashboard-skeleton-line" style={{ width: "24%", height: "100%", borderRadius: 0 }} />
          <span className="dashboard-skeleton-line" style={{ width: "18%", height: "100%", borderRadius: 0 }} />
          <span className="dashboard-skeleton-line" style={{ width: "14%", height: "100%", borderRadius: 0 }} />
          <span className="dashboard-skeleton-line" style={{ width: "8%", height: "100%", borderRadius: 0 }} />
        </div>

        {/* Filter Chips Row */}
        <div className="expenses-category-chips-row">
          {Array.from({ length: 6 }, (_, i) => (
            <span
              key={i}
              className="dashboard-skeleton-line"
              style={{ width: 85 + ((i * 12) % 32), height: 28, borderRadius: 20 }}
            />
          ))}
        </div>
      </section>

      {/* ── 3. MAIN WORKSPACE: FORM & TRACKER ── */}
      <section className="expenses-layout">
        {/* Left: Add Spending Form Card */}
        <div className="expenses-card expenses-form dashboard-skeleton-card">
          <div>
            <span className="dashboard-skeleton-line" style={{ width: 85, height: 12 }} />
            <span className="dashboard-skeleton-line" style={{ width: 135, height: 20, marginTop: 4 }} />
          </div>

          {/* Amount field */}
          <div style={{ display: "grid", gap: "0.34rem" }}>
            <span className="dashboard-skeleton-line" style={{ width: 95, height: 12 }} />
            <span className="dashboard-skeleton-line" style={{ width: "100%", height: 42, borderRadius: 8 }} />
          </div>

          {/* Quick preset chips */}
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", margin: "0.2rem 0" }}>
            {Array.from({ length: 5 }, (_, i) => (
              <span key={i} className="dashboard-skeleton-line" style={{ width: 44, height: 26, borderRadius: 16 }} />
            ))}
          </div>

          {/* Category selector */}
          <div style={{ display: "grid", gap: "0.34rem" }}>
            <span className="dashboard-skeleton-line" style={{ width: 75, height: 12 }} />
            <span className="dashboard-skeleton-line" style={{ width: "100%", height: 42, borderRadius: 8 }} />
          </div>

          {/* Date picker */}
          <div style={{ display: "grid", gap: "0.34rem" }}>
            <span className="dashboard-skeleton-line" style={{ width: 50, height: 12 }} />
            <span className="dashboard-skeleton-line" style={{ width: "100%", height: 42, borderRadius: 8 }} />
          </div>

          {/* Description field */}
          <div style={{ display: "grid", gap: "0.34rem" }}>
            <span className="dashboard-skeleton-line" style={{ width: 85, height: 12 }} />
            <span className="dashboard-skeleton-line" style={{ width: "100%", height: 42, borderRadius: 8 }} />
          </div>

          {/* Primary Action Button */}
          <span className="dashboard-skeleton-line" style={{ width: "100%", height: 44, borderRadius: 8, marginTop: 6 }} />
        </div>

        {/* Right: Expense Tracker List Card */}
        <div className="expenses-card expenses-list dashboard-skeleton-card">
          <div className="expenses-list-header">
            <div>
              <span className="dashboard-skeleton-line" style={{ width: 120, height: 12 }} />
              <span className="dashboard-skeleton-line" style={{ width: 145, height: 20, marginTop: 4 }} />
            </div>
            <span className="dashboard-skeleton-line" style={{ width: 70, height: 22, borderRadius: 12 }} />
          </div>

          {/* Search Bar + Sort Dropdown Toolbar */}
          <div className="expenses-list-toolbar">
            <span className="dashboard-skeleton-line" style={{ flex: 1, height: 38, borderRadius: 8 }} />
            <span className="dashboard-skeleton-line" style={{ width: 140, height: 38, borderRadius: 8 }} />
          </div>

          {/* List Items */}
          <div className="expenses-list-items">
            {Array.from({ length: 5 }, (_, i) => (
              <div
                key={i}
                className="expenses-list-item"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "0.75rem 0.85rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flex: 1 }}>
                  <span className="dashboard-skeleton-avatar" style={{ width: 38, height: 38, borderRadius: 8 }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, flex: 1 }}>
                    <span className="dashboard-skeleton-line" style={{ width: 120 + ((i * 24) % 60), height: 14 }} />
                    <span className="dashboard-skeleton-line" style={{ width: 68, height: 18, borderRadius: 10 }} />
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                  <span className="dashboard-skeleton-line" style={{ width: 75, height: 18 }} />
                  <span className="dashboard-skeleton-avatar" style={{ width: 28, height: 28, borderRadius: 6 }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * High-Fidelity Wallet Tab Skeleton
 * Matches: 2-column grid (Active Wallets on left, Wallet History on right),
 * Search & Sort toolbars, distinct Emerald Active Pillbox, and Symmetrical 50%/50% action buttons.
 */
function WalletSkeleton() {
  return (
    <div className="settings-page dashboard-skeleton" aria-label="Loading wallets">
      <div className="wallet-grid">
        {/* ── LEFT COLUMN: ACTIVE WALLETS CARD ── */}
        <article className="settings-card wallet-panel-card dashboard-skeleton-card">
          <div className="wallet-card-header">
            <div className="wallet-card-title-group">
              <span className="dashboard-skeleton-avatar wallet-card-header-icon" style={{ width: 40, height: 40 }} />
              <div className="wallet-card-title-wrap">
                <span className="dashboard-skeleton-line" style={{ width: 85, height: 12 }} />
                <span className="dashboard-skeleton-line" style={{ width: 185, height: 20 }} />
              </div>
            </div>
            <span className="dashboard-skeleton-line wallet-new-btn" style={{ width: 120, height: 38, borderRadius: 8 }} />
          </div>

          {/* Search + Sort Toolbar */}
          <div className="wallet-toolbar">
            <div className="wallet-search-bar" style={{ flex: 1 }}>
              <span className="dashboard-skeleton-line" style={{ width: "100%", height: 38, borderRadius: 8 }} />
            </div>
            <div className="wallet-dropdown-container">
              <span className="dashboard-skeleton-line" style={{ width: 165, height: 38, borderRadius: 8 }} />
            </div>
          </div>

          {/* Wallet List */}
          <div className="settings-wallet-list">
            {/* Card 0: Active Wallet Item */}
            <div
              className="settings-action-panel settings-wallet-item settings-wallet-item--active"
              style={{ padding: "1.05rem" }}
            >
              <div className="settings-wallet-header">
                <div className="settings-wallet-info">
                  <span className="dashboard-skeleton-line" style={{ width: 130, height: 18 }} />
                  <span className="dashboard-skeleton-line" style={{ width: 110, height: 22, marginTop: 4 }} />
                </div>
                {/* Active Pillbox Status in emerald tint */}
                <span
                  className="dashboard-skeleton-line"
                  style={{
                    width: 82,
                    height: 28,
                    borderRadius: 999,
                    background: "rgba(16, 185, 129, 0.18)",
                    borderColor: "rgba(16, 185, 129, 0.35)",
                  }}
                />
              </div>
              {/* Symmetrical Action Buttons (50% / 50%) */}
              <div className="settings-wallet-actions" style={{ display: "flex", gap: "0.65rem", marginTop: "0.5rem" }}>
                <span className="dashboard-skeleton-line settings-wallet-btn-half" style={{ flex: 1, height: 38, borderRadius: 8 }} />
                <span className="dashboard-skeleton-line settings-wallet-btn-half" style={{ flex: 1, height: 38, borderRadius: 8 }} />
              </div>
            </div>

            {/* Cards 1 & 2: Inactive Wallet Items */}
            {Array.from({ length: 2 }, (_, i) => (
              <div
                key={i}
                className="settings-action-panel settings-wallet-item"
                style={{ padding: "1.05rem" }}
              >
                <div className="settings-wallet-header">
                  <div className="settings-wallet-info">
                    <span className="dashboard-skeleton-line" style={{ width: 115 + i * 20, height: 18 }} />
                    <span className="dashboard-skeleton-line" style={{ width: 95, height: 22, marginTop: 4 }} />
                  </div>
                  {/* Set Active outline pill button */}
                  <span className="dashboard-skeleton-line" style={{ width: 88, height: 30, borderRadius: 999 }} />
                </div>
                {/* Symmetrical Action Buttons (50% / 50%) */}
                <div className="settings-wallet-actions" style={{ display: "flex", gap: "0.65rem", marginTop: "0.5rem" }}>
                  <span className="dashboard-skeleton-line settings-wallet-btn-half" style={{ flex: 1, height: 38, borderRadius: 8 }} />
                  <span className="dashboard-skeleton-line settings-wallet-btn-half" style={{ flex: 1, height: 38, borderRadius: 8 }} />
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* ── RIGHT COLUMN: WALLET HISTORY CARD ── */}
        <article className="settings-card wallet-panel-card dashboard-skeleton-card">
          <div className="wallet-card-header">
            <div className="wallet-card-title-group">
              <span className="dashboard-skeleton-avatar wallet-card-header-icon" style={{ width: 40, height: 40 }} />
              <div className="wallet-card-title-wrap">
                <span className="dashboard-skeleton-line" style={{ width: 50, height: 12 }} />
                <span className="dashboard-skeleton-line" style={{ width: 165, height: 20 }} />
              </div>
            </div>
          </div>

          {/* Search + Filter Toolbar */}
          <div className="wallet-toolbar">
            <div className="wallet-search-bar" style={{ flex: 1 }}>
              <span className="dashboard-skeleton-line" style={{ width: "100%", height: 38, borderRadius: 8 }} />
            </div>
            <div className="wallet-dropdown-container">
              <span className="dashboard-skeleton-line" style={{ width: 165, height: 38, borderRadius: 8 }} />
            </div>
          </div>

          {/* History List */}
          <div className="settings-wallet-list">
            {Array.from({ length: 3 }, (_, i) => (
              <div
                key={i}
                className="settings-action-panel settings-wallet-item settings-wallet-history-item"
                style={{ padding: "0.95rem 1.05rem" }}
              >
                <div className="settings-wallet-info" style={{ width: "100%" }}>
                  <div className="settings-wallet-header">
                    <span className="dashboard-skeleton-line" style={{ width: 110 + i * 15, height: 16 }} />
                    <span className="dashboard-skeleton-line" style={{ width: 85, height: 18 }} />
                  </div>
                  <span className="dashboard-skeleton-line" style={{ width: 190, height: 12, marginTop: 6 }} />
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}

/**
 * High-Fidelity Goals Tab Skeleton
 * Matches: Left Goals list aside with action buttons, Right Goal details card with
 * metadata grid, ProgressBarCard geometry, and "See Forecast" button.
 */
function GoalsSkeleton() {
  return (
    <div className="GoalsPage dashboard-skeleton" aria-label="Loading goals">
      {/* Left Column: Goals List Aside */}
      <aside className="GoalsCard dashboard-skeleton-card">
        <div className="goals-header">
          <span className="dashboard-skeleton-line" style={{ width: 120, height: 22 }} />
        </div>
        <div className="goal-buttons-container" style={{ display: "flex", gap: "0.5rem" }}>
          <span className="dashboard-skeleton-line goals-create-btn" style={{ flex: 1, height: 40, borderRadius: 8 }} />
          <span className="dashboard-skeleton-line goals-create-btn" style={{ flex: 1, height: 40, borderRadius: 8 }} />
        </div>
        <div className="goals-list" style={{ marginTop: "1rem" }}>
          {Array.from({ length: 3 }, (_, index) => (
            <article key={index} className="goals-card dashboard-skeleton-card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="dashboard-skeleton-line" style={{ width: 130, height: 18 }} />
              <span className="dashboard-skeleton-line" style={{ width: 105, height: 14 }} />
              <span className="dashboard-skeleton-line" style={{ width: 140, height: 12 }} />
              <span className="dashboard-skeleton-line" style={{ width: 120, height: 12 }} />
            </article>
          ))}
        </div>
      </aside>

      {/* Right Column: Goal Details Container */}
      <section className="GoalsContainer dashboard-skeleton-card">
        <div className="goal-details">
          <div className="goal-details-header" style={{ display: "flex", justifyContent: "flex-end" }}>
            <span className="dashboard-skeleton-line setActiveButton" style={{ width: 125, height: 34, borderRadius: 8 }} />
          </div>
          <span className="dashboard-skeleton-line" style={{ width: 140, height: 24, marginBottom: "1rem" }} />
          <div className="goal-details-grid">
            {Array.from({ length: 6 }, (_, index) => (
              <div key={index} style={{ padding: "0.5rem 0" }}>
                <span className="dashboard-skeleton-line" style={{ width: 80, height: 12 }} />
                <span className="dashboard-skeleton-line" style={{ width: 110, height: 16, marginTop: 4 }} />
              </div>
            ))}
          </div>

          {/* ProgressBarCard Geometry */}
          <div className="progress-bar-card dashboard-skeleton-card" style={{ padding: "1.2rem", marginTop: "1rem", borderRadius: 10, border: "1px solid var(--buck-line)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="dashboard-skeleton-line" style={{ width: 115, height: 16 }} />
              <span className="dashboard-skeleton-line" style={{ width: 55, height: 20, borderRadius: 10 }} />
            </div>
            <div style={{ height: 14, borderRadius: 7, background: "rgba(244, 117, 54, 0.12)", margin: "0.85rem 0" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="dashboard-skeleton-line" style={{ width: 145, height: 14 }} />
              <span className="dashboard-skeleton-line" style={{ width: 110, height: 36, borderRadius: 8 }} />
            </div>
          </div>
        </div>

        {/* Bottom Button Group */}
        <div className="goals-bottom-buttons" style={{ marginTop: "1.5rem" }}>
          <span className="dashboard-skeleton-line goals-action-btn" style={{ width: 140, height: 42, borderRadius: 8 }} />
        </div>
      </section>
    </div>
  );
}

/**
 * High-Fidelity Statistics Tab Skeleton
 * Matches: View Mode Selectors Header, Row 1 (Donut Pie 36% + Bar Chart 62%),
 * and Row 2 (Full Width Spending Line Chart).
 */
function StatisticsSkeleton() {
  return (
    <div className="dashboard-container dashboard-skeleton statistics-skeleton" aria-label="Loading statistics">
      {/* Mode Selector Header */}
      <section
        className="statistics-mode-skeleton dashboard-skeleton-card"
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "0.75rem",
          padding: "1rem",
          width: "min(900px, 100%)",
          margin: "0 auto",
        }}
      >
        <span className="dashboard-skeleton-line" style={{ width: 220, height: 20 }} />
        <div style={{ display: "flex", gap: "1rem" }}>
          <span className="dashboard-skeleton-line" style={{ width: 140, height: 38, borderRadius: 8 }} />
          <span className="dashboard-skeleton-line" style={{ width: 180, height: 38, borderRadius: 8 }} />
        </div>
      </section>

      {/* Row 1: Donut Pie (36%) + Bar Chart (62%) */}
      <div style={{ display: "flex", gap: "2%", width: "100%", maxWidth: 900, margin: "1.5rem auto 0", height: 340 }}>
        {/* ExcessPie Card */}
        <div
          className="dashboard-skeleton-card"
          style={{
            width: "36%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "1.2rem",
            borderRadius: 10,
            border: "1px solid var(--buck-line)",
          }}
        >
          <span className="dashboard-skeleton-circle" style={{ width: 160, height: 160 }} />
          <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem" }}>
            <span className="dashboard-skeleton-line" style={{ width: 60, height: 16, borderRadius: 8 }} />
            <span className="dashboard-skeleton-line" style={{ width: 60, height: 16, borderRadius: 8 }} />
          </div>
        </div>

        {/* SpendingBar Card */}
        <div
          className="dashboard-skeleton-card"
          style={{
            width: "62%",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "1.2rem",
            borderRadius: 10,
            border: "1px solid var(--buck-line)",
          }}
        >
          <span className="dashboard-skeleton-line" style={{ width: 140, height: 18 }} />
          <div className="dashboard-skeleton-bars" style={{ minHeight: 200, padding: 0 }}>
            {Array.from({ length: 6 }, (_, index) => (
              <span key={index} style={{ height: `${30 + ((index * 23) % 60)}%` }} />
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span className="dashboard-skeleton-line" style={{ width: 80, height: 12 }} />
            <span className="dashboard-skeleton-line" style={{ width: 80, height: 12 }} />
          </div>
        </div>
      </div>

      {/* Row 2: Full Width Line Chart Card */}
      <section
        className="graph-panel statistics-chart-skeleton dashboard-skeleton-card"
        style={{
          width: "min(900px, 100%)",
          margin: "1.5rem auto 0",
          padding: "1.2rem",
          borderRadius: 10,
          border: "1px solid var(--buck-line)",
        }}
      >
        <span className="dashboard-skeleton-line" style={{ width: 180, height: 20, marginBottom: "1rem" }} />
        <div className="dashboard-skeleton-bars dashboard-skeleton-bars--wide" style={{ minHeight: 240 }}>
          {Array.from({ length: 12 }, (_, index) => (
            <span key={index} style={{ height: `${25 + ((index * 19) % 65)}%` }} />
          ))}
        </div>
      </section>
    </div>
  );
}

/**
 * High-Fidelity Settings Tab Skeleton
 * Matches: 5-Tab Vertical Sidebar, Account Profile Card with Avatar & Provider,
 * and Settings Panel with Avatar upload and Profile Name fields.
 */
function SettingsSkeleton() {
  return (
    <div className="settings-page dashboard-skeleton" aria-label="Loading settings">
      <section className="settings-shell">
        {/* Left Navigation: 5 Real Tabs */}
        <nav className="settings-tabs dashboard-skeleton-card" aria-hidden="true" style={{ padding: "0.5rem" }}>
          {Array.from({ length: 5 }, (_, index) => (
            <div
              key={index}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                padding: "0.65rem 0.85rem",
                borderRadius: 8,
                background: index === 0 ? "rgba(244, 117, 54, 0.12)" : "transparent",
              }}
            >
              <span className="dashboard-skeleton-avatar" style={{ width: 16, height: 16 }} />
              <span className="dashboard-skeleton-line" style={{ width: 90 + ((index * 10) % 30), height: 14 }} />
            </div>
          ))}
        </nav>

        {/* Right Content Area */}
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.7rem, 1.4vw, 0.95rem)" }}>
          {/* Account Identity Card */}
          <div className="settings-account-card dashboard-skeleton-card" style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "1rem" }}>
            <span className="dashboard-skeleton-avatar" style={{ width: 48, height: 48 }} />
            <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
              <span className="dashboard-skeleton-line" style={{ width: 120, height: 16 }} />
              <span className="dashboard-skeleton-line" style={{ width: 180, height: 12 }} />
            </div>
          </div>

          {/* Panel Card */}
          <article className="settings-card settings-card--panel dashboard-skeleton-card" style={{ padding: "clamp(1rem, 2vw, 1.4rem)" }}>
            <div className="settings-card-heading settings-card-heading--wide" style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "1.2rem" }}>
              <span className="dashboard-skeleton-avatar" style={{ width: 32, height: 32 }} />
              <div>
                <span className="dashboard-skeleton-line" style={{ width: 110, height: 12 }} />
                <span className="dashboard-skeleton-line" style={{ width: 220, height: 20, marginTop: 4 }} />
              </div>
            </div>

            <div className="settings-tab-panel">
              {/* Avatar Section */}
              <section className="settings-section settings-section--avatar dashboard-skeleton-card" style={{ padding: "1rem", display: "flex", alignItems: "center", gap: "1rem" }}>
                <span className="dashboard-skeleton-avatar" style={{ width: 72, height: 72 }} />
                <div style={{ display: "flex", flexDirection: "column", gap: 6, flex: 1 }}>
                  <span className="dashboard-skeleton-line" style={{ width: 130, height: 16 }} />
                  <span className="dashboard-skeleton-line" style={{ width: 180, height: 12 }} />
                  <div style={{ display: "flex", gap: "0.5rem", marginTop: 4 }}>
                    <span className="dashboard-skeleton-line" style={{ width: 90, height: 32, borderRadius: 6 }} />
                    <span className="dashboard-skeleton-line" style={{ width: 75, height: 32, borderRadius: 6 }} />
                  </div>
                </div>
              </section>

              {/* Display Name Section */}
              <section className="settings-section dashboard-skeleton-card" style={{ padding: "1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <span className="dashboard-skeleton-line" style={{ width: 100, height: 14 }} />
                <span className="dashboard-skeleton-line" style={{ width: "100%", height: 38, borderRadius: 8, marginTop: 4 }} />
                <span className="dashboard-skeleton-line" style={{ width: 110, height: 36, borderRadius: 8, marginTop: 4 }} />
              </section>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}

/**
 * Dedicated Financial Advisor Tab Skeleton
 * Matches: Advisor Hero header, 3 KPI metrics grid, 2 Pacing advice cards,
 * and Actionable Checklist card.
 */
function FinancialAdvisorSkeleton() {
  return (
    <div className="advisor-page dashboard-skeleton" aria-label="Loading financial advisor">
      {/* Hero Header */}
      <section className="advisor-hero dashboard-skeleton-card" style={{ padding: "1.5rem", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <span className="dashboard-skeleton-line" style={{ width: 120, height: 12 }} />
            <span className="dashboard-skeleton-line" style={{ width: 280, height: 26, marginTop: 6 }} />
            <span className="dashboard-skeleton-line" style={{ width: "100%", maxWidth: 520, height: 14, marginTop: 8 }} />
          </div>
          <span className="dashboard-skeleton-line" style={{ width: 130, height: 40, borderRadius: 8 }} />
        </div>
      </section>

      {/* 3 Metric Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", margin: "1.2rem 0" }}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="dashboard-skeleton-card" style={{ padding: "1.2rem", borderRadius: 10, border: "1px solid var(--buck-line)" }}>
            <span className="dashboard-skeleton-line" style={{ width: 100, height: 12 }} />
            <span className="dashboard-skeleton-line" style={{ width: 140, height: 26, marginTop: 6 }} />
            <span className="dashboard-skeleton-line" style={{ width: 180, height: 12, marginTop: 6 }} />
          </div>
        ))}
      </div>

      {/* 2 Advice Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "1rem" }}>
        {Array.from({ length: 2 }, (_, i) => (
          <div key={i} className="dashboard-skeleton-card" style={{ padding: "1.2rem", borderRadius: 10, border: "1px solid var(--buck-line)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginBottom: "0.85rem" }}>
              <span className="dashboard-skeleton-avatar" style={{ width: 32, height: 32 }} />
              <span className="dashboard-skeleton-line" style={{ width: 140, height: 16 }} />
            </div>
            <SkeletonBlock rows={3} />
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Dedicated Predictive Forecast Tab Skeleton
 * Matches: Forecast Hero header, 3 KPI metric summary cards,
 * Trajectory projection chart, and Model recommendation card.
 */
function ForecastSkeleton() {
  return (
    <div className="forecast-page dashboard-skeleton" aria-label="Loading forecast">
      {/* Hero Header */}
      <section className="forecast-hero dashboard-skeleton-card" style={{ padding: "1.5rem", borderRadius: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
          <div>
            <span className="dashboard-skeleton-line" style={{ width: 120, height: 12 }} />
            <span className="dashboard-skeleton-line" style={{ width: 280, height: 26, marginTop: 6 }} />
            <span className="dashboard-skeleton-line" style={{ width: "100%", maxWidth: 540, height: 14, marginTop: 8 }} />
          </div>
          <span className="dashboard-skeleton-line" style={{ width: 130, height: 40, borderRadius: 8 }} />
        </div>
      </section>

      {/* 3 KPI Forecast Metric Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem", margin: "1.2rem 0" }}>
        {Array.from({ length: 3 }, (_, i) => (
          <div key={i} className="dashboard-skeleton-card" style={{ padding: "1.2rem", borderRadius: 10, border: "1px solid var(--buck-line)" }}>
            <span className="dashboard-skeleton-line" style={{ width: 110, height: 12 }} />
            <span className="dashboard-skeleton-line" style={{ width: 150, height: 26, marginTop: 6 }} />
            <span className="dashboard-skeleton-line" style={{ width: 190, height: 12, marginTop: 6 }} />
          </div>
        ))}
      </div>

      {/* Trajectory Breakdown Chart Card */}
      <article className="dashboard-skeleton-card" style={{ padding: "1.5rem", borderRadius: 12, border: "1px solid var(--buck-line)" }}>
        <span className="dashboard-skeleton-line" style={{ width: 180, height: 20 }} />
        <span className="dashboard-skeleton-line" style={{ width: 260, height: 12, marginTop: 4, marginBottom: "1.5rem" }} />
        <div className="dashboard-skeleton-bars" style={{ minHeight: 220 }}>
          {Array.from({ length: 14 }, (_, index) => (
            <span key={index} style={{ height: `${20 + ((index * 13) % 70)}%` }} />
          ))}
        </div>
      </article>
    </div>
  );
}

/**
 * Universal Dashboard Page Skeleton Dispatcher
 */
export function DashboardPageSkeleton({
  variant = "home",
}: {
  variant?: DashboardSkeletonVariant;
}) {
  switch (variant) {
    case "expenses":
      return <ExpensesSkeleton />;
    case "wallet":
      return <WalletSkeleton />;
    case "goals":
      return <GoalsSkeleton />;
    case "statistics":
      return <StatisticsSkeleton />;
    case "settings":
      return <SettingsSkeleton />;
    case "financial-advisor":
      return <FinancialAdvisorSkeleton />;
    case "forecast":
      return <ForecastSkeleton />;
    case "home":
    default:
      return <HomeSkeleton />;
  }
}
