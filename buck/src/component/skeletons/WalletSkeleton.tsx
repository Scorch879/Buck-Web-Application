"use client";

import React from "react";
import CustomSelect from "@/component/CustomSelect";
import { MonthlyCashFlowCardSkeleton } from "@/component/income/MonthlyCashFlowCard";
import "@/app/dashboard/settings/style.css";
import "./skeletons.css";

const noop = () => {};

function IconPlaceholder() {
  return <span className="skeleton-avatar" style={{ display: "inline-block", width: "1em", height: "1em", borderRadius: 4 }} />;
}

function Toolbar({ placeholder, selectLabel }: { placeholder: string; selectLabel: string }) {
  return (
    <div className="wallet-toolbar">
      <div className="wallet-search-bar">
        <span className="wallet-search-icon"><IconPlaceholder /></span>
        <input className="wallet-search-input" placeholder={placeholder} disabled readOnly tabIndex={-1} aria-hidden="true" />
      </div>
      <div className="wallet-dropdown-container">
        <CustomSelect value="x" onChange={noop} disabled options={[{ value: "x", label: selectLabel }]} />
      </div>
    </div>
  );
}

const WALLETS = [
  { name: "Main wallet", share: 70, active: true },
  { name: "Savings", share: 30, active: false },
];

/**
 * 1:1 Wallet Tab Skeleton.
 * Renders the page's own classes: cash-flow KPI card, then "Your Wallets"
 * (summary strip, toolbar, compact .wallet-row items) beside the Log card
 * (.wallet-tabs with the Wallet history tab selected). The stylesheet is
 * imported because loading.tsx renders before page.tsx (and its CSS) loads.
 */
export default function WalletSkeleton() {
  return (
    <div className="settings-page wallet-page dashboard-skeleton" aria-busy="true" aria-label="Loading wallets">
      <MonthlyCashFlowCardSkeleton withAddButton={false} />

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

          <div className="wallet-summary">
            <span className="skeleton-text">Total balance</span>
            <strong className="skeleton-text">₱00,000.00</strong>
            <span className="wallet-summary-count skeleton-text">2 wallets</span>
          </div>

          <Toolbar placeholder="Search wallets..." selectLabel="Highest Budget" />

          <div className="settings-wallet-list">
            {WALLETS.map((w) => (
              <div key={w.name} className={`settings-action-panel wallet-row${w.active ? " wallet-row--active" : ""}`}>
                <div className="wallet-row-main">
                  <div className="wallet-row-title">
                    <strong className="settings-wallet-name"><span className="skeleton-text">{w.name}</span></strong>
                  </div>
                  <div className="wallet-row-share">
                    <span className="skeleton-line" style={{ width: `${w.share}%` }} />
                  </div>
                  <span className="wallet-row-share-label"><span className="skeleton-text">{w.share}% of total balance</span></span>
                </div>
                <div className="wallet-row-side">
                  <span className="settings-wallet-budget"><span className="skeleton-text">₱00,000.00</span></span>
                  <div className="wallet-row-actions">
                    {!w.active && <span className="settings-wallet-set-active-btn skeleton-text">Set Active</span>}
                    <span className="wallet-icon-btn skeleton-text" />
                    <span className="wallet-icon-btn skeleton-text" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* Log */}
        <article className="settings-card wallet-panel-card">
          <div className="wallet-card-header">
            <div className="wallet-card-title-group">
              <span className="wallet-card-header-icon" aria-hidden="true"><IconPlaceholder /></span>
              <div className="wallet-card-title-wrap">
                <p className="settings-eyebrow"><span className="skeleton-text">Log</span></p>
                <h2 className="wallet-card-title"><span className="skeleton-text">Activity history</span></h2>
              </div>
            </div>
          </div>

          <div className="wallet-tabs">
            <span className="wallet-tab" aria-selected="true"><span className="skeleton-text">Wallet history 0</span></span>
            <span className="wallet-tab"><span className="skeleton-text">Income history 0</span></span>
          </div>

          <div className="wallet-log-panel">
            <Toolbar placeholder="Search history..." selectLabel="All" />
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
          </div>
        </article>
      </div>
    </div>
  );
}
