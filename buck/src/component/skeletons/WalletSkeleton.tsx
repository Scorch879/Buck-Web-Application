"use client";

import React from "react";
import CustomSelect, { type SelectOption } from "@/component/CustomSelect";
import "@/app/dashboard/settings/style.css";
import "./skeletons.css";

const noop = () => {};

const SORT_OPTIONS: SelectOption[] = [
  { value: "Highest Budget", label: "Highest Budget" },
  { value: "Lowest Budget", label: "Lowest Budget" },
  { value: "A-Z", label: "A-Z" },
  { value: "Newest - Oldest", label: "Newest - Oldest" },
  { value: "Oldest - Newest", label: "Oldest - Newest" },
];

const HISTORY_OPTIONS: SelectOption[] = [
  { value: "All", label: "All" },
  { value: "Active Only", label: "Active Only" },
  { value: "Archived Only", label: "Archived Only" },
];

function IconPlaceholder() {
  return <span className="skeleton-avatar" style={{ display: "inline-block", width: "1em", height: "1em", borderRadius: 4 }} />;
}

function Toolbar({ placeholder, options }: { placeholder: string; options: SelectOption[] }) {
  return (
    <div className="wallet-toolbar">
      <div className="wallet-search-bar">
        <span className="wallet-search-icon"><IconPlaceholder /></span>
        <input className="wallet-search-input" placeholder={placeholder} disabled readOnly tabIndex={-1} aria-hidden="true" />
      </div>
      <div className="wallet-dropdown-container">
        {/* Same options + fit mode as the page, so the width matches exactly */}
        <CustomSelect fit value={options[0].value} onChange={noop} disabled options={options} />
      </div>
    </div>
  );
}

const WALLETS = [
  { name: "Main wallet", active: true },
  { name: "Savings", active: false },
];

/**
 * 1:1 Wallet Tab Skeleton (default "Wallets" view).
 * Renders the page's own classes: the header card with the Wallets | Income navigator, the wallet
 * overview KPI, then "Your Wallets" (toolbar, compact .wallet-row items) beside
 * "Wallet history". The stylesheet is imported because loading.tsx renders
 * before page.tsx (and its CSS) loads.
 */
export default function WalletSkeleton() {
  return (
    <div className="settings-page wallet-page dashboard-skeleton" aria-busy="true" aria-label="Loading wallets">
      <header className="settings-card wallet-page-header">
        <div className="wallet-card-title-wrap">
          <p className="settings-eyebrow"><span className="skeleton-text">Wallet</span></p>
          <h2 className="wallet-card-title"><span className="skeleton-text">Wallets &amp; balances</span></h2>
        </div>
        <div className="wallet-view-nav">
          <span className="wallet-view-tab" aria-selected="true">
            <span className="skeleton-text">Wallets 0</span>
          </span>
          <span className="wallet-view-tab">
            <span className="skeleton-text">Income 0</span>
          </span>
        </div>
      </header>

      <div className="wallet-view-panel">
        <section className="settings-card wallet-overview">
          {[
            ["Total balance", "₱00,000.00", "Across 2 wallets"],
            ["Active wallet", "₱00,000.00", "Main wallet"],
            ["Archived", "0", "wallets kept for history"],
          ].map(([label, value, sub]) => (
            <div key={label} className="wallet-overview-stat">
              <span className="wallet-overview-label"><span className="skeleton-text">{label}</span></span>
              <strong className="wallet-overview-value"><span className="skeleton-text">{value}</span></strong>
              <span className="wallet-overview-sub"><span className="skeleton-text">{sub}</span></span>
            </div>
          ))}
        </section>

        <div className="wallet-grid">
          {/* Your wallets */}
          <article className="settings-card wallet-panel-card">
            <div className="wallet-card-header">
              <div className="wallet-card-title-group">
                <span className="wallet-card-header-icon" aria-hidden="true"><IconPlaceholder /></span>
                <div className="wallet-card-title-wrap">
                  <p className="settings-eyebrow"><span className="skeleton-text">Your Wallets</span></p>
                  <h2 className="wallet-card-title"><span className="skeleton-text">Manage your wallets</span></h2>
                </div>
              </div>
              <span className="settings-button settings-button--primary wallet-new-btn skeleton-text">+ New Wallet</span>
            </div>

            <Toolbar placeholder="Search wallets..." options={SORT_OPTIONS} />

            <div className="settings-wallet-list">
              {WALLETS.map((w) => (
                <div key={w.name} className={`settings-action-panel wallet-row${w.active ? " wallet-row--active" : ""}`}>
                  <div className="wallet-row-main">
                    <div className="wallet-row-title">
                      <strong className="settings-wallet-name"><span className="skeleton-text">{w.name}</span></strong>
                    </div>
                  </div>
                  <div className="wallet-row-side">
                    <span className="settings-wallet-budget"><span className="skeleton-text">₱00,000.00</span></span>
                    <div className="wallet-row-actions">
                      {!w.active && <span className="wallet-action-btn skeleton-text">Set Active</span>}
                      <span className="wallet-action-btn skeleton-text">✎ Edit</span>
                      <span className="wallet-action-btn skeleton-text">🗑 Delete</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </article>

          {/* Wallet history */}
          <article className="settings-card wallet-panel-card">
            <div className="wallet-card-header">
              <div className="wallet-card-title-group">
                <span className="wallet-card-header-icon" aria-hidden="true"><IconPlaceholder /></span>
                <div className="wallet-card-title-wrap">
                  <p className="settings-eyebrow"><span className="skeleton-text">Log</span></p>
                  <h2 className="wallet-card-title"><span className="skeleton-text">Wallet history</span></h2>
                </div>
              </div>
            </div>

            <Toolbar placeholder="Search history..." options={HISTORY_OPTIONS} />
            <div className="settings-wallet-list">
              {["Main wallet", "Savings", "Old wallet"].map((name) => (
                <div key={name} className="settings-action-panel wallet-history-row">
                  <div className="wallet-row-main">
                    <div className="wallet-row-title">
                      <strong className="settings-wallet-name"><span className="skeleton-text">{name}</span></strong>
                    </div>
                    <span className="settings-wallet-history-dates"><span className="skeleton-text">Added January 1, 2026</span></span>
                  </div>
                  <span className="settings-wallet-budget"><span className="skeleton-text">₱00,000.00</span></span>
                </div>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}
