"use client";

import React from "react";
import "@/app/dashboard/settings/style.css";
import "./skeletons.css";

const TABS = ["Profile & Account", "Security", "Appearance", "Danger Zone", "Feedback"];

function IconPlaceholder() {
  return <span className="skeleton-avatar" style={{ display: "inline-block", width: "1em", height: "1em", borderRadius: 4 }} />;
}

/**
 * 1:1 High-Fidelity Settings Tab Skeleton (default "Profile & Account" tab)
 * Renders the page's own layout classes (.settings-shell, .settings-tabs,
 * .settings-account-card, .settings-card--panel, .settings-tab-panel,
 * .settings-section--*) with shimmer placeholders. The page stylesheet is
 * imported because loading.tsx renders before page.tsx (and its CSS) loads.
 */
export default function SettingsSkeleton() {
  return (
    <div className="settings-page dashboard-skeleton" aria-busy="true" aria-label="Loading settings">
      <section className="settings-shell">
        <div className="settings-sidebar-col">
          <nav className="settings-tabs" aria-hidden="true">
            {TABS.map((label, i) => (
              <span key={label} className={`settings-tab${i === 0 ? " settings-tab--active" : ""}`}>
                <IconPlaceholder />
                <span className="skeleton-text">{label}</span>
              </span>
            ))}
          </nav>

          <div className="settings-signout-card" aria-hidden="true">
            <span className="settings-signout-btn">
              <IconPlaceholder />
              <span className="skeleton-text">Sign Out</span>
            </span>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(0.7rem, 1.4vw, 0.95rem)" }}>
          <div className="settings-account-card">
            <span className="settings-account-icon skeleton-avatar" />
            <div>
              <strong><span className="skeleton-text">Email account</span></strong>
              <span><span className="skeleton-text">name@example.com</span></span>
            </div>
          </div>

          <article className="settings-card settings-card--panel">
            <div className="settings-card-heading settings-card-heading--wide">
              <span aria-hidden="true"><IconPlaceholder /></span>
              <div>
                <p className="settings-eyebrow"><span className="skeleton-text">Profile &amp; Account</span></p>
                <h2><span className="skeleton-text">Avatar, display name, and account status.</span></h2>
              </div>
            </div>

            <div className="settings-tab-panel">
              <section className="settings-section settings-section--avatar">
                <div className="settings-section-heading">
                  <IconPlaceholder />
                  <div>
                    <p className="settings-eyebrow"><span className="skeleton-text">Profile picture</span></p>
                    <h3><span className="skeleton-text">Avatar</span></h3>
                  </div>
                </div>
                <div className="settings-avatar-panel">
                  <span className="settings-avatar skeleton-circle" style={{ borderRadius: "50%" }} />
                  <div>
                    <strong><span className="skeleton-text">Buck user</span></strong>
                    <p><span className="skeleton-text">JPG, PNG, or WebP. Maximum size is 2 MB.</span></p>
                    <div className="settings-avatar-actions">
                      <span className="settings-button settings-button--secondary skeleton-text">Upload image</span>
                      <span className="settings-button settings-button--ghost skeleton-text">Remove</span>
                    </div>
                  </div>
                </div>
              </section>

              <section className="settings-section settings-section--identity">
                <div className="settings-section-heading">
                  <IconPlaceholder />
                  <div>
                    <p className="settings-eyebrow"><span className="skeleton-text">Profile</span></p>
                    <h3><span className="skeleton-text">Display information</span></h3>
                  </div>
                </div>
                <div className="settings-form">
                  <div className="settings-field">
                    {/* <label> keeps `.settings-form label` styling for 1:1 parity; nothing to label in a skeleton. */}
                    {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                    <label><span className="skeleton-text">Display name</span></label>
                    {/* real input: 0.72rem×2 padding + 1rem text + 2px border */}
                    <span className="skeleton-input" style={{ height: "calc(1.44rem + 1.2em + 2px)", borderRadius: 8 }} />
                  </div>
                  <span className="settings-button settings-button--primary skeleton-text">Save profile</span>
                </div>
              </section>

              <section className="settings-section settings-section--status">
                <div className="settings-section-heading">
                  <IconPlaceholder />
                  <div>
                    <p className="settings-eyebrow"><span className="skeleton-text">Status</span></p>
                    <h3><span className="skeleton-text">Security summary</span></h3>
                  </div>
                </div>
                <dl className="settings-status-list">
                  {[
                    ["Provider", "Email account"],
                    ["Email confirmation", "Confirmed"],
                    ["Profile storage", "Default avatar"],
                    ["Deletion", "Not scheduled"],
                  ].map(([term, value]) => (
                    <div key={term}>
                      <dt><span className="skeleton-text">{term}</span></dt>
                      <dd><span className="skeleton-text">{value}</span></dd>
                    </div>
                  ))}
                </dl>
              </section>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
