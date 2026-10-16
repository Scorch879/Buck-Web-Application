"use client";

import React from "react";
import "@/app/dashboard/categories/style.css";
import "./skeletons.css";

const ROWS = ["Food", "Transportation", "Bills", "Shopping", "Health", "Uncategorized"];

/**
 * 1:1 Categories Tab Skeleton (default "Expense" view).
 * Renders the page's own .cat-* classes: header card with the Expense | Income
 * switch, the uncategorized/AI card, then the toolbar and category table.
 */
export default function CategoriesSkeleton() {
  return (
    <div className="cat-page dashboard-skeleton" aria-busy="true" aria-label="Loading categories">
      <header className="cat-card cat-header">
        <div className="cat-heading">
          <p className="cat-eyebrow"><span className="skeleton-text">Categories</span></p>
          <h2><span className="skeleton-text">Expense categories</span></h2>
        </div>
        <div className="cat-segmented">
          <span className="cat-segmented-btn" aria-selected="true"><span className="skeleton-text">Expense 18</span></span>
          <span className="cat-segmented-btn"><span className="skeleton-text">Income 7</span></span>
        </div>
      </header>

      <section className="cat-card cat-uncat">
        <div className="cat-uncat-text">
          <p className="cat-eyebrow"><span className="skeleton-text">Needs a category</span></p>
          <h3><span className="skeleton-text">0 uncategorized expenses · ₱0,000.00</span></h3>
          <p className="cat-muted"><span className="skeleton-text">The AI Advisor files these into your own expense categories.</span></p>
        </div>
        <span className="cat-primary-btn skeleton-text">Auto-categorize with AI</span>
      </section>

      <section className="cat-card cat-list">
        <div className="cat-toolbar">
          <div className="cat-search">
            <input placeholder="Search expense categories..." disabled readOnly tabIndex={-1} aria-hidden="true" />
          </div>
          <div className="cat-add">
            <input placeholder="New expense category" disabled readOnly tabIndex={-1} aria-hidden="true" />
            <span className="cat-primary-btn skeleton-text">+ Add</span>
          </div>
        </div>
        <div className="cat-table-wrap">
          <table className="cat-table">
            <thead>
              <tr>
                <th><span className="skeleton-text">Category</span></th>
                <th className="cat-num"><span className="skeleton-text">Entries</span></th>
                <th className="cat-num"><span className="skeleton-text">Total</span></th>
                <th className="cat-share-col"><span className="skeleton-text">Share</span></th>
                <th className="cat-actions-col" />
              </tr>
            </thead>
            <tbody>
              {ROWS.map((name) => (
                <tr key={name}>
                  <td><span className="cat-name"><span className="skeleton-text">{name}</span></span></td>
                  <td className="cat-num"><span className="skeleton-text">00</span></td>
                  <td className="cat-num"><span className="skeleton-text">₱0,000.00</span></td>
                  <td className="cat-share-col"><span className="skeleton-text">00%</span></td>
                  <td className="cat-actions-col">
                    <div className="cat-actions">
                      <span className="cat-action-btn skeleton-text">Rename</span>
                      <span className="cat-action-btn skeleton-text">Delete</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
