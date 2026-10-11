"use client";

import React from "react";
import CustomSelect from "@/component/CustomSelect";
import CustomDatePicker from "@/component/CustomDatePicker";
import "@/app/dashboard/expenses/style.css";
import "./skeletons.css";

const noop = () => {};
const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

function IconPlaceholder() {
  return <span className="skeleton-avatar" style={{ display: "inline-block", width: "1em", height: "1em", borderRadius: 4 }} />;
}

function KpiHeader({ subtitle, title, badge }: { subtitle: string; title: string; badge?: string }) {
  return (
    <div className="expenses-kpi-header">
      <div className="expenses-kpi-icon-wrapper skeleton-avatar" />
      <div className="expenses-kpi-title-block">
        <span className="expenses-kpi-subtitle skeleton-text">{subtitle}</span>
        <h3 className="expenses-kpi-title"><span className="skeleton-text">{title}</span></h3>
      </div>
      {badge ? <span className="expenses-kpi-badge expenses-kpi-badge--neutral skeleton-text">{badge}</span> : null}
    </div>
  );
}

function KpiStatGrid({ labels }: { labels: [string, string] }) {
  return (
    <div className="expenses-kpi-visual">
      <div className="expenses-kpi-stat-grid">
        {labels.map((label) => (
          <div key={label} className="expenses-kpi-stat-box">
            <span className="expenses-kpi-stat-label skeleton-text">{label}</span>
            <strong className="expenses-kpi-stat-val skeleton-text">₱0,000.00</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * 1:1 High-Fidelity Expenses Tab Skeleton
 * Renders the page's own layout classes (ExpenseKPICards, ExpenseCategoryVisualizer,
 * .expenses-layout form + tracker) with shimmer placeholders. Real (disabled)
 * inputs, CustomSelect and CustomDatePicker keep form/toolbar geometry exact.
 * The stylesheet is imported because loading.tsx renders before page.tsx.
 */
export default function ExpensesSkeleton() {
  return (
    <div className="expenses-page dashboard-skeleton" aria-busy="true" aria-label="Loading expenses">
      {/* KPI cards */}
      <section className="expenses-kpi-grid">
        <article className="expenses-kpi-card expenses-kpi-card--wallet">
          <KpiHeader subtitle="Active Wallet" title="Wallet Balance" badge="Healthy" />
          <div className="expenses-kpi-primary-val">
            <strong className="skeleton-text">₱00,000.00</strong>
            <span className="expenses-kpi-subtext skeleton-text">00% remaining of initial capacity</span>
          </div>
          <div className="expenses-kpi-visual">
            <div className="expenses-kpi-progress-track" />
            <div className="expenses-kpi-meta-split">
              <div className="expenses-kpi-meta-item"><span className="skeleton-text">Available: ₱00,000.00</span></div>
              <div className="expenses-kpi-meta-item"><span className="skeleton-text">Spent: ₱0,000.00</span></div>
            </div>
          </div>
        </article>

        <article className="expenses-kpi-card expenses-kpi-card--tracked">
          <KpiHeader subtitle="Cumulative" title="Total Tracked" badge="00 entries" />
          <div className="expenses-kpi-primary-val">
            <strong className="skeleton-text">₱00,000.00</strong>
            <span className="expenses-kpi-subtext skeleton-text">Lifetime recorded across all wallets</span>
          </div>
          <KpiStatGrid labels={["This Month", "Daily Average"]} />
        </article>

        <article className="expenses-kpi-card expenses-kpi-card--average">
          <KpiHeader subtitle="Per Transaction" title="Average Expense" />
          <div className="expenses-kpi-primary-val">
            <strong className="skeleton-text">₱0,000.00</strong>
            <span className="expenses-kpi-subtext skeleton-text">Typical cost per individual transaction</span>
          </div>
          <KpiStatGrid labels={["Lowest Expense", "Highest Expense"]} />
        </article>
      </section>

      {/* Category allocation visualizer */}
      <section className="expenses-category-visualizer">
        <div className="expenses-category-vis-header">
          <div className="expenses-category-vis-title-group">
            <span className="expenses-category-vis-icon"><IconPlaceholder /></span>
            <div>
              <h3 className="expenses-category-vis-title"><span className="skeleton-text">Category Spending Allocation</span></h3>
              <span className="expenses-category-vis-subtitle skeleton-text">0 categories active across 00 expenses</span>
            </div>
          </div>
        </div>
        <div className="expenses-category-bar-track">
          {[34, 24, 18, 14, 10].map((w, i) => (
            <div key={i} className="expenses-category-bar-seg skeleton-bar-seg" style={{ width: `${w}%` }} />
          ))}
        </div>
        <div className="expenses-category-chips-row">
          {["All", "Food", "Transportation", "Shopping", "Bills"].map((name) => (
            <span key={name} className="expenses-category-chip">
              <span className="expenses-category-chip-dot skeleton-avatar" />
              <span className="skeleton-text">{name}</span>
              <span className="expenses-category-chip-badge skeleton-text">0 · ₱0,000.00</span>
            </span>
          ))}
        </div>
      </section>

      {/* Workspace: add form + tracker */}
      <section className="expenses-layout">
        <div className="expenses-card expenses-form">
          <div>
            <p className="expenses-eyebrow"><span className="skeleton-text">New expense</span></p>
            <h2><span className="skeleton-text">Add spending</span></h2>
          </div>
          <label>
            <span className="skeleton-text">Amount (PHP)</span>
            <input placeholder="0.00" disabled readOnly tabIndex={-1} aria-hidden="true" />
          </label>
          <div className="expenses-quick-amounts">
            <span className="expenses-quick-label skeleton-text">Quick add:</span>
            <div className="expenses-quick-chips">
              {QUICK_AMOUNTS.map((val) => (
                <span key={val} className="expenses-quick-chip skeleton-text">+{val}</span>
              ))}
            </div>
          </div>
          <label>
            <span className="skeleton-text">Category</span>
            <CustomSelect value="Food" onChange={noop} disabled options={[{ value: "Food", label: "Food" }]} />
          </label>
          <label>
            <span className="skeleton-text">Date</span>
            <CustomDatePicker value="" onChange={noop} />
          </label>
          <label>
            <span className="skeleton-text">Description</span>
            <input placeholder="Lunch, fare, grocery, coffee..." disabled readOnly tabIndex={-1} aria-hidden="true" />
          </label>
          <span className="expenses-primary-button skeleton-text">+ Add Expense</span>
        </div>

        <section className="expenses-card expenses-list">
          <div className="expenses-list-header">
            <div>
              <p className="expenses-eyebrow"><span className="skeleton-text">Transaction Records</span></p>
              <h2><span className="skeleton-text">Expense tracker</span></h2>
            </div>
            <span className="expenses-list-count-badge skeleton-text">00 matches</span>
          </div>

          <div className="expenses-list-toolbar">
            <div className="expenses-search-box">
              <span className="expenses-search-icon"><IconPlaceholder /></span>
              <input placeholder="Search description or category..." disabled readOnly tabIndex={-1} aria-hidden="true" />
            </div>
            <div className="expenses-sort-box">
              <span className="expenses-sort-icon"><IconPlaceholder /></span>
              <select className="expenses-sort-select" disabled tabIndex={-1} aria-hidden="true">
                <option>Newest first</option>
              </select>
            </div>
          </div>

          <div className="expenses-list-items">
            {Array.from({ length: 6 }, (_, i) => (
              <article key={i} className="expenses-list-item">
                <div className="expenses-list-item-main">
                  <span className="expenses-list-item-category-icon skeleton-avatar" />
                  <div className="expenses-list-item-details">
                    <strong className="expenses-list-item-title"><span className="skeleton-text">Expense description</span></strong>
                    <div className="expenses-list-item-sub">
                      <span className="expenses-list-item-pill skeleton-text">Category</span>
                      <span className="expenses-list-item-date skeleton-text">2026-01-01</span>
                    </div>
                  </div>
                </div>
                <div className="expenses-list-item-actions">
                  <strong className="expenses-list-item-amount skeleton-text">₱0,000.00</strong>
                  <span className="expenses-list-delete-btn skeleton-avatar" />
                </div>
              </article>
            ))}
          </div>
        </section>
      </section>
    </div>
  );
}
