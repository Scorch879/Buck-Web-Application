"use client";

import React from "react";
import CustomSelect from "@/component/CustomSelect";
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

/**
 * 1:1 High-Fidelity Wallet Tab Skeleton
 * Renders the page's own layout classes (.wallet-grid, .wallet-panel-card,
 * .wallet-card-header, .wallet-toolbar, .settings-wallet-item, ...) from
 * settings/style.css with shimmer placeholders. Real (disabled) search input and
 * CustomSelect keep the toolbar geometry exact. The stylesheet is imported
 * because loading.tsx renders before page.tsx (and its CSS) loads.
 */
export default function WalletSkeleton() {
  return (
    <div className="settings-page dashboard-skeleton" aria-busy="true" aria-label="Loading wallets">
      <div className="wallet-grid">
        {/* Left: active wallets */}
        <article className="settings-card wallet-panel-card">
          <div className="wallet-card-header">
            <div className="wallet-card-title-group">
              <span className="wallet-card-header-icon" aria-hidden="true"><IconPlaceholder /></span>
              <div className="wallet-card-title-wrap">
                <p className="settings-eyebrow"><span className="skeleton-text">Your Wallets</span></p>
                <h2 className="wallet-card-title"><span className="skeleton-text">Manage your active wallets</span></h2>
              </div>
            </div>
            <span className="settings-button settings-button--primary wallet-new-btn skeleton-text">+ New Wallet</span>
          </div>

          <Toolbar placeholder="Search wallets..." selectLabel="Highest Budget" />

          <div className="settings-wallet-list">
            {[true, false, false].map((isActive, i) => (
              <div key={i} className={`settings-action-panel settings-wallet-item${isActive ? " settings-wallet-item--active" : ""}`}>
                <div className="settings-wallet-header">
                  <div className="settings-wallet-info">
                    <strong className="settings-wallet-name"><span className="skeleton-text">{["Main wallet", "Savings", "E-wallet"][i]}</span></strong>
                    <span className="settings-wallet-budget"><span className="skeleton-text">₱00,000.00</span></span>
                  </div>
                  {isActive ? (
                    <span className="settings-wallet-active-badge skeleton-text">✓ Active</span>
                  ) : (
                    <span className="settings-wallet-set-active-btn skeleton-text">Set Active</span>
                  )}
                </div>
                <div className="settings-wallet-actions">
                  <span className="settings-button settings-button--secondary settings-wallet-btn-half skeleton-text">Edit</span>
                  <span className="settings-button settings-button--danger settings-wallet-btn-half skeleton-text">Delete</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        {/* Right: wallet history */}
        <article className="settings-card wallet-panel-card">
          <div className="wallet-card-header">
            <div className="wallet-card-title-group">
              <span className="wallet-card-header-icon" aria-hidden="true"><IconPlaceholder /></span>
              <div className="wallet-card-title-wrap">
                <p className="settings-eyebrow"><span className="skeleton-text">Log</span></p>
                <h2 className="wallet-card-title"><span className="skeleton-text">History of Wallets</span></h2>
              </div>
            </div>
          </div>

          <Toolbar placeholder="Search history..." selectLabel="All" />

          <div className="settings-wallet-list">
            {["Main wallet", "Savings", "Old wallet"].map((name) => (
              <div key={name} className="settings-action-panel settings-wallet-item settings-wallet-history-item">
                <div className="settings-wallet-info" style={{ width: "100%" }}>
                  <div className="settings-wallet-header">
                    <div className="settings-card-title" style={{ gap: "0.5rem", alignItems: "center" }}>
                      <strong><span className="skeleton-text">{name}</span></strong>
                    </div>
                    <span className="settings-wallet-budget"><span className="skeleton-text">₱00,000.00</span></span>
                  </div>
                  <span className="settings-wallet-history-dates">
                    <span className="skeleton-text">Added on January 1, 2026</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </article>
      </div>
    </div>
  );
}
