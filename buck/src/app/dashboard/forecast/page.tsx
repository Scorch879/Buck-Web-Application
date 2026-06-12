"use client";

import { useEffect, useState } from "react";
import { FaChartArea, FaExclamationTriangle, FaMagic } from "react-icons/fa";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { fetchAIForecastInsights, type AIForecastInsights } from "@/utils/forecastApi";
import "./style.css";

export default function ForecastPage() {
  const [insights, setInsights] = useState<AIForecastInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const loadForecast = async () => {
      try {
        setLoading(true);
        // Pass context if needed in the future
        const data = await fetchAIForecastInsights({});
        if (active) {
          setInsights(data);
        }
      } catch (err) {
        if (active) {
          setError("Failed to generate AI forecast.");
          console.error(err);
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadForecast();

    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <DashboardPageSkeleton variant="home" />;
  }

  return (
    <main className="forecast-page">
      {error && <div className="settings-message settings-message--error">{error}</div>}

      <section className="forecast-hero">
        <div>
          <p className="forecast-eyebrow">Financial Forecast</p>
          <h2>Predict your future spending.</h2>
          <p>
            Buck uses AI to study your past expenses and budgeting habits to give you a clear picture of where your money is heading next month.
          </p>
        </div>
        <div className="advisor-score" style={{ background: 'conic-gradient(var(--buck-purple, #9b51e0), var(--buck-blue, #2d9cdb), var(--buck-purple, #9b51e0))' }}>
          <span style={{ color: 'var(--buck-ink)' }}>Projected</span>
          <strong style={{ color: 'var(--buck-ink)' }}>AI</strong>
        </div>
      </section>

      <div className="forecast-ai-grid">
        <section className="forecast-card forecast-card--wide" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="forecast-icon">
            <FaMagic aria-hidden="true" />
          </span>
          <div>
            <p className="forecast-eyebrow">AI Forecast Summary</p>
            <h3>What to expect next month</h3>
            <p style={{ minHeight: '80px', marginTop: '1rem' }}>
              {insights?.summary}
            </p>
          </div>
        </section>

        <section className="forecast-card forecast-card--wide" style={{ display: 'flex', flexDirection: 'column' }}>
          <span className="forecast-icon" style={{ background: 'rgba(255, 56, 56, 0.14)', color: '#ff3838', borderColor: 'rgba(255, 56, 56, 0.24)' }}>
            <FaExclamationTriangle aria-hidden="true" />
          </span>
          <div>
            <p className="forecast-eyebrow" style={{ color: '#ff3838' }}>AI Warnings</p>
            <h3>Potential Risks</h3>
            <div style={{ minHeight: '80px', marginTop: '1rem' }}>
              {insights?.warnings && insights.warnings.length > 0 ? (
                <ul style={{ paddingLeft: '1.2rem', color: 'var(--buck-muted)', lineHeight: 1.6 }}>
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
    </main>
  );
}
