"use client";

import React from "react";
import CustomSelect from "@/component/CustomSelect";
import "@/app/dashboard/settings/style.css";
import "@/app/dashboard/admin/style.css";
import "./skeletons.css";

const noop = () => {};

function IconPlaceholder() {
  return (
    <span
      className="skeleton-avatar"
      style={{
        display: "inline-block",
        width: "1em",
        height: "1em",
        borderRadius: 4,
      }}
    />
  );
}

/**
 * 1:1 High-Fidelity SuperAdmin Tab Skeleton (default "User Feedback" tab)
 * Renders the page's own layout classes (.admin-page, .settings-shell,
 * .settings-tabs, .admin-stretch-card, .admin-kpi-grid, .admin-toolbar,
 * .admin-feedback-*) with shimmer placeholders.
 */
export default function AdminSkeleton() {
  return (
    <div
      className="admin-page dashboard-skeleton"
      aria-busy="true"
      aria-label="Loading admin dashboard"
    >
      <section className="settings-shell" style={{ flex: 1, minHeight: 0 }}>
        <nav
          className="settings-tabs"
          aria-hidden="true"
          style={{
            position: "sticky",
            top: "clamp(0.78rem, 1.35vw, 0.95rem)",
          }}
        >
          {[
            "User Feedback",
            "Buck_AI Status & Logs",
            "Website Health & Analytics",
            "Supabase Logs",
            "Vercel Deployments",
          ].map((label, i) => (
            <span
              key={label}
              className={`settings-tab${
                i === 0 ? " settings-tab--active" : ""
              }`}
            >
              <IconPlaceholder />
              <span className="skeleton-text">{label}</span>
            </span>
          ))}
        </nav>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "clamp(0.7rem, 1.4vw, 0.95rem)",
            flex: 1,
            minHeight: 0,
            alignSelf: "stretch",
          }}
        >
          <article className="settings-card settings-card--panel admin-stretch-card">
            <div className="admin-card-header-row">
              <div className="settings-card-heading settings-card-heading--wide">
                <span aria-hidden="true">
                  <IconPlaceholder />
                </span>
                <div>
                  <h2>
                    <span className="skeleton-text">User Feedback</span>
                  </h2>
                  <p>
                    <span className="skeleton-text">
                      Anonymous user feedback with SHA-256 hashed identity
                      verification.
                    </span>
                  </p>
                </div>
              </div>

              <span className="admin-refresh-btn skeleton-text">Refresh</span>
            </div>

            <div className="admin-kpi-grid admin-kpi-grid--compact">
              {[
                { label: "Total Feedback", sub: "100% SHA-256 hashed in DB" },
                { label: "Bug Reports", sub: "Issues & defect reports" },
                { label: "Feature Ideas", sub: "User enhancement requests" },
                { label: "AI & General Notes", sub: "0 AI advisor reports" },
              ].map((card) => (
                <div key={card.label} className="admin-kpi-card">
                  <div className="admin-kpi-top">
                    <span className="admin-kpi-label skeleton-text">
                      {card.label}
                    </span>
                    <span className="admin-kpi-icon">
                      <IconPlaceholder />
                    </span>
                  </div>
                  <div className="admin-kpi-value">
                    <span className="skeleton-text">00</span>
                  </div>
                  <div className="admin-kpi-sub">
                    <span className="skeleton-text">{card.sub}</span>
                  </div>
                </div>
              ))}
            </div>

            <div className="admin-toolbar">
              <span className="admin-search-input skeleton-text">
                Search feedback title, details, or category...
              </span>
              <CustomSelect
                fit
                value="all"
                onChange={noop}
                disabled
                className="admin-filter-select"
                options={[{ value: "all", label: "All Categories" }]}
              />
              <CustomSelect
                fit
                value="newest"
                onChange={noop}
                disabled
                className="admin-filter-select"
                options={[{ value: "newest", label: "Newest First" }]}
              />
            </div>

            <div className="admin-feedback-list">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="admin-feedback-item">
                  <div className="admin-feedback-meta">
                    <div className="admin-feedback-badges">
                      <span className="admin-feedback-category skeleton-text">
                        Feature
                      </span>
                      <span className="admin-anon-badge skeleton-text">
                        Anonymous · SHA-256 Verified
                      </span>
                    </div>
                    <span className="skeleton-text">
                      Jan 1, 2026, 12:00 PM
                    </span>
                  </div>
                  <h3 className="admin-feedback-title">
                    <span className="skeleton-text">
                      Feedback title goes here
                    </span>
                  </h3>
                  <p className="admin-feedback-details">
                    <span className="skeleton-text">
                      Details of the anonymous feedback message submitted by the
                      user appear here.
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
