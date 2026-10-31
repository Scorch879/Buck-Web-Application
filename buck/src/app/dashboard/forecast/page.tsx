"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  FaBullseye,
  FaCalendarAlt,
  FaChartArea,
  FaExclamationTriangle,
  FaInfoCircle,
  FaMagic,
  FaPiggyBank,
  FaSyncAlt,
  FaWallet,
} from "react-icons/fa";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useDashboardUser } from "@/context/DashboardUserContext";
import { mergeDashboardDataCache, useFinancial } from "@/context/FinancialContext";
import {
  explainAIForecast,
  fetchAIForecastInsights,
  type AIForecastInsights,
  type BuckForecast,
  type ForecastHorizon,
  type ForecastNarrative,
} from "@/utils/forecastApi";
import {
  TREND_LABELS,
  confidencePercent,
  formatDateSpan,
  formatMoneyBetween,
  formatShortDate,
  isRoughEstimate,
  splitForecastWarnings,
  topCategories,
} from "@/utils/forecastDisplay";
import { formatCurrency } from "@/utils/formatters";
import { useToast } from "@/component/toast";
import ForecastChart from "./ForecastChart";
// advisor-grid / advisor-card / advisor-icon live in the advisor stylesheet
import "../financial-advisor/style.css";
import "./style.css";

const HORIZONS: ForecastHorizon[] = [30, 60];

export default function ForecastPage() {
  const { user } = useDashboardUser();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const { toast } = useToast();
  const [horizon, setHorizon] = useState<ForecastHorizon>(30);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const byHorizon = dashboardCache.userId === user.uid ? dashboardCache.forecastByHorizon : undefined;
  const insights = byHorizon?.[horizon] ?? null;

  const store = useCallback(
    (h: ForecastHorizon, next: AIForecastInsights) => {
      setDashboardCache((current) =>
        mergeDashboardDataCache(current, user.uid, {
          forecastByHorizon: {
            ...(current.userId === user.uid ? current.forecastByHorizon : undefined),
            [h]: next,
          },
        })
      );
    },
    [setDashboardCache, user.uid]
  );

  const followUpExplanation = useCallback(
    (h: ForecastHorizon, data: AIForecastInsights) => {
      if (data.source !== "buck_ai" || !data.explanationPending) return;
      explainAIForecast(h)
        .then((next) => store(h, next))
        .catch((err) => console.warn("Forecast explanation unavailable.", err));
    },
    [store]
  );

  const loadForecast = useCallback(
    async (h: ForecastHorizon, forceRefresh = false) => {
      if (forceRefresh) setRefreshing(true);
      try {
        setError("");
        const data = await fetchAIForecastInsights({ userId: user.uid, forceRefresh, horizon: h });
        store(h, data);
        if (forceRefresh) {
          if (data.stale) {
            toast("Explanation was refreshed moments ago. A new one comes in a few minutes.", "info");
          } else {
            toast("Forecast refreshed.", "success");
          }
        }
        // Numbers are on screen; the Gemini explanation follows when it is ready.
        followUpExplanation(h, data);
      } catch (err) {
        const errMsg = "Failed to load the forecast.";
        setError(errMsg);
        if (forceRefresh) toast(errMsg, "error");
        console.error(err);
      } finally {
        setRefreshing(false);
      }
    },
    [followUpExplanation, store, toast, user.uid]
  );

  // Run once per user and horizon, not whenever the callbacks change identity.
  const actionsRef = useRef({ loadForecast, followUpExplanation });
  actionsRef.current = { loadForecast, followUpExplanation };

  // A cached forecast shows at once; the fresh one (no Gemini call, fast)
  // replaces it, and a pending explanation is asked for again (requests are shared).
  useEffect(() => {
    void actionsRef.current.loadForecast(horizon);
  }, [horizon, user.uid]);

  if (!insights && !error) {
    return <DashboardPageSkeleton variant="forecast" />;
  }

  const forecast = insights?.source === "buck_ai" ? insights.forecast : undefined;
  const isFallback = Boolean(insights) && !forecast;

  return (
    <div className="forecast-page">
      {error && <div className="settings-message settings-message--error">{error}</div>}

      <section className="forecast-hero">
        <div className="forecast-hero-copy">
          <div className="forecast-hero-meta">
            <p className="forecast-eyebrow">Financial Forecast</p>
            {insights?.createdAt && (
              <span className="forecast-chip">
                {insights.cached ? "Saved" : "Updated"} {new Date(insights.createdAt).toLocaleDateString()}
              </span>
            )}
          </div>
          <h2>Where your spending is likely heading.</h2>
          <p>
            Buck studies your own spending history and gives likely ranges for the days ahead, not exact promises.
          </p>
        </div>

        <div className="forecast-hero-actions">
          <div className="forecast-segmented" role="group" aria-label="Forecast horizon">
            {HORIZONS.map((h) => (
              <button
                key={h}
                type="button"
                className="forecast-segmented-btn"
                aria-pressed={horizon === h}
                disabled={isFallback && horizon !== h}
                title={isFallback && horizon !== h ? "Available when the AI Forecaster is reachable" : undefined}
                onClick={() => setHorizon(h)}
              >
                {h} days
              </button>
            ))}
          </div>
          <button
            type="button"
            className="forecast-refresh-btn"
            onClick={() => void loadForecast(horizon, true)}
            disabled={refreshing}
          >
            <FaSyncAlt aria-hidden="true" className={refreshing ? "forecast-spin" : undefined} />
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </section>

      {forecast && insights?.narrative ? (
        <RichForecast
          forecast={forecast}
          narrative={insights.narrative}
          pending={Boolean(insights.explanationPending)}
          stale={Boolean(insights.stale)}
        />
      ) : (
        insights && <FallbackForecast insights={insights} />
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AI Forecaster layout                                                */
/* ------------------------------------------------------------------ */

function RichForecast({
  forecast,
  narrative,
  pending,
  stale,
}: {
  forecast: BuckForecast;
  narrative: ForecastNarrative;
  pending: boolean;
  stale: boolean;
}) {
  const { month, model, goal } = forecast;
  const horizon = forecast.days.length;
  const shortfall = month.surplus.likely < 0;
  const categories = topCategories(forecast.categories);
  const { notice, risks } = splitForecastWarnings(forecast);
  const rough = isRoughEstimate(model);

  return (
    <>
      <section className="forecast-panel">
        <header className="forecast-panel-head">
          <p className="forecast-eyebrow">Daily forecast</p>
          <h3>Likely spending, next {horizon} days</h3>
          <p>
            Likely total {formatCurrency(forecast.total.p50)}, {formatMoneyBetween(forecast.total.p10, forecast.total.p90)} in 8
            of 10 outcomes.
          </p>
        </header>
        <ForecastChart forecast={forecast} />
      </section>

      <section className="forecast-panel">
        <header className="forecast-panel-head">
          <p className="forecast-eyebrow">This month</p>
          <h3>
            {month.daysLeft === 0
              ? "Last day of the month"
              : month.daysLeft === 1
                ? "1 day left"
                : `${month.daysLeft} days left`}
          </h3>
        </header>
        <div className="forecast-month-grid">
          <div className="forecast-stat">
            <span className="forecast-stat-label">Spent so far</span>
            <strong>{formatCurrency(month.spentSoFar)}</strong>
            <span className="forecast-stat-note">Logged since {formatShortDate(month.start)}</span>
          </div>
          <div className="forecast-stat">
            <span className="forecast-stat-label">Likely month total</span>
            <strong>{formatCurrency(month.projectedTotal.p50)}</strong>
            <span className="forecast-stat-note">
              Likely {formatMoneyBetween(month.projectedTotal.p10, month.projectedTotal.p90)}
            </span>
          </div>
          <div className={`forecast-stat${shortfall ? " forecast-stat--danger" : " forecast-stat--good"}`}>
            <span className="forecast-stat-label">{shortfall ? "Likely shortfall" : "Likely left over"}</span>
            <strong>{formatCurrency(Math.abs(month.surplus.likely))}</strong>
            <span className="forecast-stat-note">
              Likely {formatMoneyBetween(month.surplus.low, month.surplus.high)} against your{" "}
              {month.surplusBasis} ({formatCurrency(month.surplusAgainst)})
            </span>
          </div>
        </div>
      </section>

      <section className="forecast-section">
        <header className="forecast-section-head">
          <p className="forecast-eyebrow">Top categories</p>
          <h3>Where the next {horizon} days likely go</h3>
        </header>
        {categories.length > 0 ? (
          <div className="forecast-category-grid">
            {categories.map((c) => (
              <article key={c.name} className="forecast-mini-card">
                <div className="forecast-mini-head">
                  <h4>{c.name}</h4>
                  <span className={`forecast-trend forecast-trend--${c.trend}`}>{TREND_LABELS[c.trend]}</span>
                </div>
                <strong className="forecast-mini-amount">{formatCurrency(c.expected)}</strong>
                <div
                  className="forecast-share-track"
                  role="progressbar"
                  aria-label={`${c.name} share of forecast spending`}
                  aria-valuenow={Math.round(c.share)}
                  aria-valuemin={0}
                  aria-valuemax={100}
                >
                  <span style={{ width: `${Math.min(100, Math.max(0, c.share))}%` }} />
                </div>
                <p>
                  {c.share.toFixed(0)}% of spending
                  {month.daysLeft > 0 ? ` · ${formatCurrency(c.restOfMonth)} for the rest of this month` : ""}
                  {c.recurring ? " · recurring" : ""}
                </p>
              </article>
            ))}
          </div>
        ) : (
          <p className="forecast-empty">No category spending to forecast yet.</p>
        )}
      </section>

      <section className="forecast-section">
        <header className="forecast-section-head">
          <p className="forecast-eyebrow">Wallet runway</p>
          <h3>How long each wallet likely lasts</h3>
        </header>
        {forecast.wallets.length > 0 ? (
          <div className="forecast-wallet-grid">
            {forecast.wallets.map((w) => {
              const span = formatDateSpan(w.runsOut);
              const noSpend = !w.empty && w.projectedSpend.p90 <= 0;
              return (
                <article key={w.name} className="forecast-mini-card">
                  <div className="forecast-mini-head">
                    <h4>
                      <FaWallet aria-hidden="true" /> {w.name}
                    </h4>
                    <span className="forecast-badges">
                      {w.active && <span className="forecast-badge forecast-badge--active">Active</span>}
                      {w.empty && <span className="forecast-badge forecast-badge--empty">Empty</span>}
                    </span>
                  </div>
                  <strong className="forecast-mini-amount">{formatCurrency(w.balance)}</strong>
                  <p>
                    {noSpend
                      ? `No spending expected from this wallet over ${horizon} days.`
                      : `Likely spend ${formatCurrency(w.projectedSpend.p50)} over ${horizon} days (${formatMoneyBetween(w.projectedSpend.p10, w.projectedSpend.p90)}).`}
                  </p>
                  <p className="forecast-runway">
                    {noSpend
                      ? "Nothing to run out of."
                      : w.empty
                      ? "Balance is ₱0, but spending usually comes out of this wallet."
                      : w.runsOut?.likely
                        ? `Likely runs out around ${formatShortDate(w.runsOut.likely)}${span ? ` (${span})` : ""}.`
                        : "Likely lasts beyond this period."}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="forecast-empty">No wallets to forecast yet.</p>
        )}
      </section>

      <div className="forecast-two-col">
        <section className="forecast-panel">
          <header className="forecast-panel-head forecast-panel-head--icon">
            <span className="forecast-icon">
              <FaBullseye aria-hidden="true" />
            </span>
            <div>
              <p className="forecast-eyebrow">Goal</p>
              <h3>{goal ? goal.name : "No active goal"}</h3>
            </div>
            {goal && goal.onTrack !== null && (
              <span className={`forecast-chip ${goal.onTrack ? "forecast-chip--good" : "forecast-chip--warn"}`}>
                {goal.onTrack ? "On track" : "Behind pace"}
              </span>
            )}
          </header>
          {goal ? (
            <dl className="forecast-goal-list">
              <div>
                <dt>Remaining</dt>
                <dd>{formatCurrency(goal.remaining)}</dd>
              </div>
              <div>
                <dt>Needed per day</dt>
                <dd>
                  {goal.requiredPerDay !== null
                    ? `${formatCurrency(goal.requiredPerDay)}${goal.targetDate ? ` to finish by ${formatShortDate(goal.targetDate)}` : ""}`
                    : "No target date set"}
                </dd>
              </div>
              <div>
                <dt>Likely reached</dt>
                <dd>
                  {goal.reachBy?.likely
                    ? `Around ${formatShortDate(goal.reachBy.likely)}${formatDateSpan(goal.reachBy) ? ` (${formatDateSpan(goal.reachBy)})` : ""}`
                    : `Likely beyond the next ${horizon} days`}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="forecast-empty">Set an active goal on the Goals tab to see when you would likely reach it.</p>
          )}
        </section>

        <section className="forecast-panel">
          <header className="forecast-panel-head forecast-panel-head--icon">
            <span className="forecast-icon">
              <FaCalendarAlt aria-hidden="true" />
            </span>
            <div>
              <p className="forecast-eyebrow">Habits</p>
              <h3>Patterns in your spending</h3>
            </div>
          </header>
          {forecast.habits.length > 0 ? (
            <ul className="forecast-habits">
              {forecast.habits.map((h, i) => (
                <li key={`${h.kind}-${i}`} className="forecast-habit-chip">
                  {h.text}
                </li>
              ))}
            </ul>
          ) : (
            <p className="forecast-empty">No clear patterns yet.</p>
          )}
          <details className="forecast-excluded">
            <summary>Left out of the baseline ({forecast.excluded.length})</summary>
            {forecast.excluded.length > 0 ? (
              <ul>
                {forecast.excluded.map((e, i) => (
                  <li key={`${e.date}-${i}`}>
                    <span>
                      {formatShortDate(e.date)} · {e.category}
                      {e.label ? ` · ${e.label}` : ""}
                    </span>
                    <span>
                      {formatCurrency(e.amount)} <em>{e.reason === "emergency" ? "Emergency" : "One-off"}</em>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="forecast-empty">Nothing was left out.</p>
            )}
          </details>
        </section>
      </div>

      <div className="forecast-ai-grid">
        <section className="forecast-card forecast-card--wide forecast-explanation" aria-busy={pending}>
          <span className="forecast-icon">
            <FaMagic aria-hidden="true" />
          </span>
          <div className="forecast-explanation-body">
            <div className="forecast-explanation-meta">
              <p className="forecast-eyebrow">AI Forecast explanation</p>
              {rough && <span className="forecast-chip forecast-chip--warn">Rough estimate</span>}
              {pending ? (
                <span className="forecast-chip forecast-chip--quiet" role="status">
                  <span className="forecast-pulse" aria-hidden="true" />
                  Writing explanation…
                </span>
              ) : (
                stale && <span className="forecast-chip forecast-chip--quiet">Update coming shortly</span>
              )}
            </div>
            <h3 className="forecast-explanation-headline">{narrative.headline}</h3>
            <p className="forecast-explanation-text">{narrative.explanation}</p>
            {narrative.habitNotes.length > 0 && (
              <ul className="forecast-notes">
                {narrative.habitNotes.map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            )}
            {narrative.watchOut && (
              <p className="forecast-callout">
                <FaExclamationTriangle aria-hidden="true" />
                <span>{narrative.watchOut}</span>
              </p>
            )}
            <p className="forecast-footnote">
              Based on your last {model.windowDays} days · confidence {confidencePercent(model.confidence)}%
            </p>
          </div>
        </section>

        <WarningsCard notice={notice} risks={risks} />
      </div>
    </>
  );
}

function WarningsCard({ notice, risks }: { notice: string | null; risks: string[] }) {
  return (
    <section className="forecast-card forecast-card--wide">
      <span className="forecast-icon forecast-icon--danger">
        <FaExclamationTriangle aria-hidden="true" />
      </span>
      <div>
        <p className="forecast-eyebrow">AI Warnings</p>
        <h3>Potential risks</h3>
        {notice && (
          <p className="forecast-notice" role="note">
            <FaInfoCircle aria-hidden="true" />
            <span>{notice}</span>
          </p>
        )}
        {risks.length > 0 ? (
          <ul className="forecast-warnings">
            {risks.map((warning, index) => (
              <li key={index}>{warning}</li>
            ))}
          </ul>
        ) : (
          <p>No risks detected in your likely path.</p>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Rule-engine fallback (Buck_AI unreachable)                          */
/* ------------------------------------------------------------------ */

function FallbackForecast({ insights }: { insights: AIForecastInsights }) {
  return (
    <>
      <section className="advisor-grid">
        <article className="advisor-card">
          <span className="advisor-icon forecast-tint--orange">
            <FaWallet aria-hidden="true" />
          </span>
          <p className="advisor-eyebrow">Projected Spending</p>
          <h3>{formatCurrency(insights.projectedSpending ?? 0)}</h3>
          <p>Likely total spending by the end of this month.</p>
        </article>

        <article className="advisor-card">
          <span className="advisor-icon forecast-tint--green">
            <FaPiggyBank aria-hidden="true" />
          </span>
          <p className="advisor-eyebrow">Projected Savings</p>
          <h3 className="forecast-text--green">{formatCurrency(insights.projectedSavings ?? 0)}</h3>
          <p>Likely left over if your pace continues.</p>
        </article>

        <article className="advisor-card">
          <span className="advisor-icon forecast-tint--gold">
            <FaChartArea aria-hidden="true" />
          </span>
          <p className="advisor-eyebrow">Recommended Budget</p>
          <h3>{formatCurrency(insights.aiRecommendedBudget ?? insights.projectedSpending ?? 0)}</h3>
          <p>Target spend from the rule-based model.</p>
        </article>
      </section>

      <div className="forecast-ai-grid">
        <section className="forecast-card forecast-card--wide">
          <span className="forecast-icon">
            <FaMagic aria-hidden="true" />
          </span>
          <div>
            <p className="forecast-eyebrow">Forecast Summary</p>
            <h3>What to expect this month</h3>
            <p className="forecast-explanation-text">{insights.summary}</p>
          </div>
        </section>

        <WarningsCard notice={null} risks={insights.warnings ?? []} />
      </div>
    </>
  );
}
