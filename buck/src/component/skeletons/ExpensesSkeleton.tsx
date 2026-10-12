"use client";

import React from "react";
import CustomSelect from "@/component/CustomSelect";
import "@/app/dashboard/expenses/style.css";
import "./skeletons.css";

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
 * Renders the page's 2-column layout (Left: ExpenseKPICards, Right: Expense Tracker Table)
 * with shimmer placeholders. Matches actual page DOM geometry 1:1 for zero CLS.
 */
export default function ExpensesSkeleton() {
  return (
    <div className="expenses-page dashboard-skeleton" aria-busy="true" aria-label="Loading expenses">
      {/* ── TOP KPI: CATEGORY ALLOCATION VISUALIZER SKELETON ── */}
      <section className="expenses-category-visualizer" aria-label="Loading category allocation">
        <div className="expenses-category-vis-header">
          <div className="expenses-category-vis-title-group">
            <span className="skeleton-avatar" style={{ width: "20px", height: "20px", borderRadius: "4px" }} />
            <div>
              <h3 className="expenses-category-vis-title"><span className="skeleton-text">Category Spending Allocation</span></h3>
              <span className="expenses-category-vis-subtitle skeleton-text">0 categories active · Total ₱00,000.00</span>
            </div>
          </div>
          <div className="expenses-category-vis-actions">
            <span className="skeleton-text" style={{ width: "140px", height: "14px", display: "inline-block" }} />
          </div>
        </div>

        {/* Thicker 24px Bar Track Skeleton */}
        <div className="expenses-category-bar-track" style={{ height: "24px" }}>
          <span className="skeleton-bar-seg" style={{ width: "35%", height: "100%", borderRadius: "4px" }} />
          <span className="skeleton-bar-seg" style={{ width: "25%", height: "100%", borderRadius: "4px" }} />
          <span className="skeleton-bar-seg" style={{ width: "18%", height: "100%", borderRadius: "4px" }} />
          <span className="skeleton-bar-seg" style={{ width: "14%", height: "100%", borderRadius: "4px" }} />
          <span className="skeleton-bar-seg" style={{ width: "8%", height: "100%", borderRadius: "4px" }} />
        </div>

        {/* Streamlined Legend Skeleton */}
        <div className="expenses-category-legend">
          {Array.from({ length: 6 }, (_, i) => (
            <div key={i} className="expenses-legend-item" style={{ pointerEvents: "none" }}>
              <span className="skeleton-avatar" style={{ width: "8px", height: "8px", borderRadius: "50%" }} />
              <span className="skeleton-text" style={{ width: "55px", height: "14px", display: "inline-block" }} />
              <span className="skeleton-text" style={{ width: "32px", height: "14px", display: "inline-block" }} />
            </div>
          ))}
        </div>
      </section>

      {/* ── LEFT COLUMN: KPI CARDS ── */}
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

      {/* ── RIGHT COLUMN: EXPENSE TRACKER TABLE ── */}
      <section className="expenses-card expenses-list">
        <div className="expenses-list-header">
          <div>
            <p className="expenses-eyebrow"><span className="skeleton-text">Transaction Records</span></p>
            <h2><span className="skeleton-text">Expense tracker</span></h2>
          </div>
          <div className="expenses-list-header-actions">
            <span className="expenses-list-count-badge skeleton-text">00 matches</span>
            <span
              className="expenses-add-trigger-btn skeleton-text"
              style={{ pointerEvents: "none", opacity: 0.8 }}
            >
              + Add Spending
            </span>
          </div>
        </div>

        <div className="expenses-list-toolbar">
          <div className="expenses-search-box">
            <span className="expenses-search-icon"><IconPlaceholder /></span>
            <input placeholder="Search description or category..." disabled readOnly tabIndex={-1} aria-hidden="true" />
          </div>
          <div className="expenses-sort-box">
            {/* Real disabled CustomSelect in fit mode with the page's labels: same width by construction */}
            <CustomSelect
              fit
              disabled
              size="sm"
              value="newest"
              onChange={() => {}}
              options={[
                { value: "newest", label: "Newest first" },
                { value: "oldest", label: "Oldest first" },
                { value: "highest", label: "Highest amount" },
                { value: "lowest", label: "Lowest amount" },
              ]}
              className="expenses-custom-select expenses-custom-select--sort"
            />
          </div>
        </div>

        <div className="expenses-list-items-container">
          <div className="expenses-list-items">
            {Array.from({ length: 8 }, (_, i) => (
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
        </div>

        {/* Skeleton Pagination */}
        <div className="expenses-pagination">
          <div className="expenses-pagination-spacer" aria-hidden="true" />
          <div className="expenses-pagination-nav">
            <span className="skeleton-button" style={{ width: "58px", height: "32px", borderRadius: "6px" }} />
            <div className="expenses-page-numbers" style={{ display: "inline-flex", gap: "0.35rem" }}>
              <span className="skeleton-button" style={{ width: "32px", height: "32px", borderRadius: "6px" }} />
              <span className="skeleton-button" style={{ width: "32px", height: "32px", borderRadius: "6px" }} />
              <span className="skeleton-button" style={{ width: "32px", height: "32px", borderRadius: "6px" }} />
            </div>
            <span className="skeleton-button" style={{ width: "58px", height: "32px", borderRadius: "6px" }} />
          </div>
          <div className="expenses-pagination-info">
            <span className="skeleton-text" style={{ width: "100px", height: "14px", display: "inline-block" }} />
          </div>
        </div>
      </section>
    </div>
  );
}
