"use client";

import React from "react";
import CustomSelect from "@/component/CustomSelect";
import "@/app/dashboard/statistics/style.css";
import "./skeletons.css";

const noop = () => {};

/**
 * 1:1 High-Fidelity Statistics Tab Skeleton (default "Weekly" mode)
 * Mirrors page.tsx's inline layout (900px column, info card, selector row,
 * 36% / 62% chart row at 340px) and reuses its classes (.statistics-panels-container,
 * .graph-row, .graph-panel, .graph-panel-header, .graph-legend). The real
 * CustomSelect is rendered (disabled) so selector geometry is exact.
 */
export default function StatisticsSkeleton() {
  return (
    <div
      className="dashboard-container dashboard-skeleton"
      aria-busy="true"
      aria-label="Loading statistics"
      style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}
    >
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginTop: "0.5rem", marginBottom: "1rem", width: "100%", maxWidth: 900 }}>
        {/* Week info card */}
        <div style={{ width: "100%", maxWidth: 900, display: "flex", justifyContent: "center" }}>
          <div
            style={{
              borderRadius: 16,
              border: "1px solid var(--buck-line)",
              padding: "1.2rem 2rem",
              marginBottom: "0.7rem",
              display: "flex",
              alignItems: "center",
              gap: "1.5rem",
              fontSize: "1.15rem",
              fontWeight: 600,
              width: "100%",
              maxWidth: 900,
              justifyContent: "center",
            }}
          >
            <span className="skeleton-text" style={{ fontWeight: 700, fontSize: "1.25rem" }}>Week 1</span>
            <span className="skeleton-text" style={{ fontWeight: 500, fontSize: "1.05rem" }}>2026-01-01 to 2026-01-07</span>
          </div>
        </div>

        {/* Selectors row */}
        <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: "1.5rem", width: "100%", maxWidth: 900, justifyContent: "center" }}>
          <div style={{ textAlign: "center" }}>
            <label style={{ fontWeight: 600, marginRight: 8 }}>
              <span className="skeleton-text">View Mode:</span>
            </label>
            <CustomSelect value="week" onChange={noop} disabled options={[{ value: "week", label: "Weekly" }]} />
          </div>
          <div style={{ textAlign: "center" }}>
            <label style={{ fontWeight: 600, marginRight: 8 }}>
              <span className="skeleton-text">Select Week:</span>
            </label>
            <CustomSelect
              value="0"
              onChange={noop}
              disabled
              options={[{ value: "0", label: "Week 1: 2026-01-01 to 2026-01-07" }]}
            />
          </div>
        </div>
      </div>

      <div className="statistics-panels-container" style={{ width: "100%", maxWidth: 900, margin: "0 auto" }}>
        {/* Row 1: ExcessPie (36%) + SpendingBar (62%) */}
        <div style={{ display: "flex", flexDirection: "row", alignItems: "stretch", margin: "2.5rem auto", width: "100%", maxWidth: 900, gap: "2%" }}>
          <div style={{ width: "36%", display: "flex", alignItems: "center", justifyContent: "center", height: 340 }}>
            <span className="skeleton-circle" style={{ width: "min(240px, 90%)", aspectRatio: "1", borderRadius: "50%" }} />
          </div>
          <div style={{ width: "62%", display: "flex", alignItems: "flex-end", gap: "0.75rem", height: 340, padding: "1.5rem 0.5rem" }}>
            {[55, 80, 35, 65, 45, 25].map((h, i) => (
              <span key={i} className="skeleton-line" style={{ flex: 1, height: `${h}%`, borderRadius: "6px 6px 2px 2px" }} />
            ))}
          </div>
        </div>

        {/* Row 2: Weekly Spending Report */}
        <div className="graph-row">
          <div className="graph-panel weekly-graph-panel">
            <div className="graph-panel-header"><span className="skeleton-text">Weekly Spending Report</span></div>
            <div style={{ marginBottom: "1rem", textAlign: "right" }}>
              <span className="skeleton-text" style={{ fontWeight: 500 }}>Y Max: 0000</span>
            </div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.5rem", height: 280 }}>
              {[40, 62, 35, 75, 50, 30, 58].map((h, i) => (
                <span key={i} className="skeleton-line" style={{ flex: 1, height: `${h}%`, borderRadius: "4px 4px 0 0" }} />
              ))}
            </div>
            <div className="graph-legend">
              {["Saved", "Excess"].map((label) => (
                <div key={label} className="graph-legend-item">
                  <span className="skeleton-avatar" style={{ width: 18, height: 12, borderRadius: 3 }} />
                  <span className="graph-legend-label skeleton-text">{label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Row 3: Forecast vs Actual (AI) */}
        <div className="graph-row">
          <div className="graph-panel weekly-graph-panel" style={{ position: "relative", minHeight: 300 }}>
            <div className="graph-panel-header" style={{ fontSize: "1.2rem", marginBottom: 8, textAlign: "center" }}>
              <span className="skeleton-text">Forecast vs Actual (AI)</span>
            </div>
            <span className="skeleton-line" style={{ width: "100%", height: 220, borderRadius: 8 }} />
          </div>
        </div>
      </div>
    </div>
  );
}
