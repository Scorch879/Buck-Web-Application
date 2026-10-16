"use client";

import React from "react";
import "@/app/dashboard/categories/style.css";
import "./skeletons.css";

const ROWS = [
  "Shopping",
  "Insurance",
  "Bills",
  "Education",
  "Tax",
  "Social",
  "Gas Money",
  "Uncategorized",
];

/**
 * 1:1 Categories Tab Skeleton (default "Expense" view).
 * Renders the page's own .cat-* classes: header card with the Expense | Income
 * switch, then the consolidated toolbar (Search + Add Category + Auto-categorize AI),
 * 8-row paginated table, and 3-column pagination footer.
 */
export default function CategoriesSkeleton() {
  return (
    <div className="cat-page dashboard-skeleton" aria-busy="true" aria-label="Loading categories">
      <header className="cat-card cat-header">
        <div className="cat-heading">
          <p className="cat-eyebrow">
            <span className="skeleton-text">Categories</span>
          </p>
          <h2>
            <span className="skeleton-text">Expense categories</span>
          </h2>
        </div>
        <div className="cat-segmented">
          <span className="cat-segmented-btn" aria-selected="true">
            <span className="skeleton-text">Expense 18</span>
          </span>
          <span className="cat-segmented-btn">
            <span className="skeleton-text">Income 7</span>
          </span>
        </div>
      </header>

      <section className="cat-card cat-list">
        <div className="cat-toolbar">
          <div className="cat-search">
            <input
              placeholder="Search expense categories..."
              disabled
              readOnly
              tabIndex={-1}
              aria-hidden="true"
            />
          </div>
          <div className="cat-toolbar-actions">
            <span className="cat-secondary-btn skeleton-text">+ Add Expense Category</span>
            <span className="cat-primary-btn skeleton-text">Auto-categorize with AI 0</span>
          </div>
        </div>

        <div className="cat-table-wrap">
          <table className="cat-table">
            <thead>
              <tr>
                <th className="cat-col-category">
                  <span className="skeleton-text">Category</span>
                </th>
                <th className="cat-col-entries">
                  <span className="skeleton-text">Entries</span>
                </th>
                <th className="cat-col-total">
                  <span className="skeleton-text">Total</span>
                </th>
                <th className="cat-col-share">
                  <span className="skeleton-text">Share</span>
                </th>
                <th className="cat-col-actions" />
              </tr>
            </thead>
            <tbody>
              {ROWS.map((name) => (
                <tr key={name}>
                  <td className="cat-col-category">
                    <span className="cat-name-wrap">
                      <span className="cat-category-icon skeleton-avatar" />
                      <span className="cat-name">
                        <span className="skeleton-text">{name}</span>
                      </span>
                    </span>
                  </td>
                  <td className="cat-col-entries">
                    <span className="cat-entries-pill">
                      <span className="skeleton-text">00 entries · Avg ₱0,000</span>
                    </span>
                  </td>
                  <td className="cat-col-total cat-amount">
                    <span className="skeleton-text">₱0,000.00</span>
                  </td>
                  <td className="cat-col-share">
                    <div className="cat-share">
                      <span className="cat-share-track skeleton-bar" />
                      <span className="cat-share-pct">
                        <span className="skeleton-text">00%</span>
                      </span>
                    </div>
                  </td>
                  <td className="cat-col-actions">
                    <div className="cat-actions">
                      <div className="cat-actions-group">
                        <span className="cat-action-btn skeleton-text">Rename</span>
                        <span className="cat-action-btn skeleton-text">Delete</span>
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="cat-pagination">
          <div className="cat-pagination-spacer" aria-hidden="true" />
          <div className="cat-pagination-nav">
            <span
              className="skeleton-button"
              style={{ width: "58px", height: "32px", borderRadius: "6px" }}
            />
            <div className="cat-page-numbers">
              <span
                className="skeleton-button"
                style={{ width: "32px", height: "32px", borderRadius: "6px" }}
              />
              <span
                className="skeleton-button"
                style={{ width: "32px", height: "32px", borderRadius: "6px" }}
              />
              <span
                className="skeleton-button"
                style={{ width: "32px", height: "32px", borderRadius: "6px" }}
              />
            </div>
            <span
              className="skeleton-button"
              style={{ width: "58px", height: "32px", borderRadius: "6px" }}
            />
          </div>
          <div className="cat-pagination-info">
            <span
              className="skeleton-text"
              style={{ width: "96px", height: "14px", display: "inline-block" }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
