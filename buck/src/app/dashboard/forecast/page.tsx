"use client";

import { useEffect, useRef, useState } from "react";
import {
  FaChartArea,
  FaExclamationTriangle,
  FaMagic,
  FaSyncAlt,
  FaPiggyBank,
  FaWallet,
} from "react-icons/fa";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useDashboardUser } from "@/context/DashboardUserContext";
import { mergeDashboardDataCache, useFinancial } from "@/context/FinancialContext";
import { fetchAIForecastInsights, type AIForecastInsights } from "@/utils/forecastApi";
import { formatCurrency } from "@/utils/formatters";
import { useToast } from "@/component/toast";
import "./style.css";

export default function ForecastPage() {
  const { user } = useDashboardUser();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const { toast } = useToast();
  const userCache = dashboardCache.userId === user.uid ? dashboardCache : {};
  const hasInitialForecastData = Boolean(userCache.forecastInsights);

  const [insights, setInsights] = useState<AIForecastInsights | null>(
    () => userCache.forecastInsights ?? null
  );
  const [loading, setLoading] = useState(() => !hasInitialForecastData);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const hadInitialForecastData = useRef(hasInitialForecastData);

  const loadForecast = async (forceRefresh = false) => {
    if (forceRefresh) {
      setRefreshing(true);
    } else if (!hadInitialForecastData.current) {
      setLoading(true);
    }

    try {
      setError("");
      const data = await fetchAIForecastInsights({
        userId: user.uid,
        forceRefresh,
      });

      setInsights(data);
      if (forceRefresh) {
        toast("Refreshed predictive financial forecast.", "success");
      }
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          forecastInsights: data,
        })
      );
    } catch (err) {
      const errMsg = "Failed to generate AI forecast.";
      setError(errMsg);
      if (forceRefresh) {
        toast(errMsg, "error");
      }
      console.error(err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    let active = true;

    void loadForecast(false);

    return () => {
      active = false;
    };
  }, [setDashboardCache, user.uid]);

  if (loading) {
    return <DashboardPageSkeleton variant="home" />;
  }

  return (
    <div className="forecast-page">
      {error && <div className="settings-message settings-message--error">{error}</div>}

      <section className="forecast-hero">
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <p className="forecast-eyebrow" style={{ margin: 0 }}>Financial Forecast</p>
            {insights?.createdAt && (
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "var(--buck-muted)",
                  background: "var(--buck-surface-soft, rgba(255,255,255,0.06))",
                  padding: "0.2rem 0.6rem",
                  borderRadius: "12px",
                }}
              >
                {insights.cached ? "Cached" : "Updated"}: {new Date(insights.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <h2>Predict your future spending.</h2>
          <p>
            Buck uses AI to study your past expenses and budgeting habits to give you a clear picture of where your money is heading this cycle.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
          <button
            type="button"
            onClick={() => void loadForecast(true)}
            disabled={refreshing}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.5rem",
              background: "var(--buck-surface-card, rgba(255, 197, 71, 0.12))",
              color: "var(--buck-orange, #f47536)",
              border: "1px solid rgba(244, 117, 54, 0.3)",
              padding: "0.6rem 1rem",
              borderRadius: "10px",
              cursor: refreshing ? "not-allowed" : "pointer",
              fontWeight: 600,
              fontSize: "0.9rem",
              transition: "all 0.2s ease",
            }}
          >
            <FaSyncAlt style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
            {refreshing ? "Updating..." : "Refresh Forecast"}
          </button>

          <div
            className="advisor-score"
            style={{
              background:
                "conic-gradient(var(--buck-purple, #9b51e0), var(--buck-blue, #2d9cdb), var(--buck-purple, #9b51e0))",
            }}
          >
            <span style={{ color: "var(--buck-ink)" }}>Projected</span>
            <strong style={{ color: "var(--buck-ink)" }}>AI</strong>
          </div>
        </div>
      </section>

      {/* Projections Row */}
      {insights && (
        <section className="advisor-grid" style={{ marginBottom: "1.5rem" }}>
          <article className="advisor-card">
            <span className="advisor-icon" style={{ background: "rgba(244,117,54,0.15)", color: "var(--buck-orange)" }}>
              <FaWallet aria-hidden="true" />
            </span>
            <p className="advisor-eyebrow">Projected Spending</p>
            <h3>{formatCurrency(insights.projectedSpending ?? 0)}</h3>
            <p>Estimated total expenditure by end of cycle.</p>
          </article>

          <article className="advisor-card">
            <span className="advisor-icon" style={{ background: "rgba(46, 204, 113, 0.15)", color: "#2ecc71" }}>
              <FaPiggyBank aria-hidden="true" />
            </span>
            <p className="advisor-eyebrow">Projected Savings</p>
            <h3 style={{ color: "#2ecc71" }}>{formatCurrency(insights.projectedSavings ?? 0)}</h3>
            <p>Net wallet headroom preserved if pace continues.</p>
          </article>

          <article className="advisor-card">
            <span className="advisor-icon" style={{ background: "rgba(155, 81, 224, 0.15)", color: "#9b51e0" }}>
              <FaChartArea aria-hidden="true" />
            </span>
            <p className="advisor-eyebrow">Recommended Budget</p>
            <h3>{formatCurrency(insights.aiRecommendedBudget ?? insights.projectedSpending ?? 0)}</h3>
            <p>Optimal target spend suggested by model.</p>
          </article>
        </section>
      )}

      <div className="forecast-ai-grid">
        <section className="forecast-card forecast-card--wide" style={{ display: "flex", flexDirection: "column" }}>
          <span className="forecast-icon">
            <FaMagic aria-hidden="true" />
          </span>
          <div>
            <p className="forecast-eyebrow">AI Forecast Summary</p>
            <h3>What to expect next month</h3>
            <p style={{ minHeight: "80px", marginTop: "1rem" }}>
              {insights?.summary}
            </p>
          </div>
        </section>

        <section className="forecast-card forecast-card--wide" style={{ display: "flex", flexDirection: "column" }}>
          <span
            className="forecast-icon"
            style={{
              background: "rgba(255, 56, 56, 0.14)",
              color: "#ff3838",
              borderColor: "rgba(255, 56, 56, 0.24)",
            }}
          >
            <FaExclamationTriangle aria-hidden="true" />
          </span>
          <div>
            <p className="forecast-eyebrow" style={{ color: "#ff3838" }}>AI Warnings</p>
            <h3>Potential Risks</h3>
            <div style={{ minHeight: "80px", marginTop: "1rem" }}>
              {insights?.warnings && insights.warnings.length > 0 ? (
                <ul style={{ paddingLeft: "1.2rem", color: "var(--buck-muted)", lineHeight: 1.6 }}>
                  {insights.warnings.map((warning, index) => (
                    <li key={index}>{warning}</li>
                  ))}
                </ul>
              ) : (
                <p>No risks detected in your current trajectory.</p>
              )}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
