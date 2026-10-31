"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { IconType } from "react-icons";
import {
  FaBullseye,
  FaCalendarWeek,
  FaChartLine,
  FaMoneyBillWave,
  FaRedoAlt,
  FaRegBell,
  FaRegClock,
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
  activeWalletRunway,
  categoriesWithOthers,
  confidenceWords,
  cooldownRemainingMs,
  formatClockTime,
  formatMoneyBetween,
  formatShortDate,
  habitChips,
  headsUpItems,
  rangePosition,
  surplusTone,
  type HabitIcon,
} from "@/utils/forecastDisplay";
import { formatCurrency } from "@/utils/formatters";
import { useToast } from "@/component/toast";
import ForecastChart from "./ForecastChart";
import "./style.css";

const HORIZONS: ForecastHorizon[] = [30, 60];

const AI_NOTE = "Written by AI from your Buck data. It can be wrong.";

const HABIT_ICONS: Record<HabitIcon, IconType> = {
  weekday: FaCalendarWeek,
  payday: FaMoneyBillWave,
  recurring: FaRedoAlt,
  trend: FaChartLine,
  rhythm: FaRegClock,
};

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
          if (data.cooldownUntil && cooldownRemainingMs(data.cooldownUntil, Date.now()) > 0) {
            toast(
              `Numbers are up to date. A new explanation is held back until ${formatClockTime(data.cooldownUntil)}.`,
              "info"
            );
          } else {
            toast("Forecast refreshed.", "success");
          }
        }
        // Numbers are on screen; the written explanation follows when it is ready.
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

  // A cached forecast shows at once; the fresh numbers (fast, no AI call)
  // replace it, and a pending explanation is asked for again (requests are shared).
  useEffect(() => {
    void actionsRef.current.loadForecast(horizon);
  }, [horizon, user.uid]);

  // Refresh waits out Buck_AI's explanation cooldown; the timer re-enables it.
  const cooldownUntil = insights?.cooldownUntil ?? null;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!cooldownUntil) return;
    const timer = window.setTimeout(
      () => setNow(Date.now()),
      cooldownRemainingMs(cooldownUntil, Date.now()) + 250
    );
    return () => window.clearTimeout(timer);
  }, [cooldownUntil]);
  const coolingDown = cooldownRemainingMs(cooldownUntil, now) > 0;

  if (!insights && !error) {
    return <DashboardPageSkeleton variant="forecast" />;
  }

  const forecast = insights?.source === "buck_ai" ? insights.forecast : undefined;
  const isFallback = Boolean(insights) && !forecast;

  const controls = (
    <div className="forecast-story-controls">
      <div className="forecast-segmented" role="group" aria-label="Forecast length">
        {HORIZONS.map((h) => (
          <button
            key={h}
            type="button"
            className="forecast-segmented-btn"
            aria-pressed={horizon === h}
            disabled={isFallback && horizon !== h}
            title={isFallback && horizon !== h ? "Available when the full forecast is reachable" : undefined}
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
        disabled={refreshing || coolingDown}
        title={
          coolingDown && cooldownUntil
            ? `A new explanation is held back. You can refresh again at ${formatClockTime(cooldownUntil)}.`
            : undefined
        }
      >
        <FaSyncAlt aria-hidden="true" className={refreshing ? "forecast-spin" : undefined} />
        {refreshing
          ? "Refreshing…"
          : coolingDown && cooldownUntil
            ? `Refresh at ${formatClockTime(cooldownUntil)}`
            : "Refresh"}
      </button>
    </div>
  );

  return (
    <div className="forecast-page">
      {error && <div className="settings-message settings-message--error">{error}</div>}

      {forecast && insights?.narrative ? (
        <RichForecast
          forecast={forecast}
          narrative={insights.narrative}
          pending={Boolean(insights.explanationPending)}
          stale={Boolean(insights.stale)}
          aiWritten={insights.generatedWith !== "rules"}
          controls={controls}
        />
      ) : insights ? (
        <FallbackForecast insights={insights} controls={controls} />
      ) : (
        <section className="forecast-story">
          <div className="forecast-story-top">
            <h2 className="forecast-greeting">Your next {horizon} days</h2>
            {controls}
          </div>
        </section>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* AI Forecaster layout: the story first, details on demand            */
/* ------------------------------------------------------------------ */

function RichForecast({
  forecast,
  narrative,
  pending,
  stale,
  aiWritten,
  controls,
}: {
  forecast: BuckForecast;
  narrative: ForecastNarrative;
  pending: boolean;
  stale: boolean;
  aiWritten: boolean;
  controls: ReactNode;
}) {
  const { month, model, goal, total } = forecast;
  const horizon = forecast.days.length;
  const tone = surplusTone(month);
  const runway = activeWalletRunway(forecast);
  const activeWallet = forecast.wallets.find((w) => w.active) ?? forecast.wallets[0];
  const headsUp = headsUpItems(forecast);
  const habits = habitChips(forecast, pending ? undefined : narrative.habitNotes);
  const categories = categoriesWithOthers(forecast.categories);
  const marker = rangePosition(total.p10, total.p50, total.p90);

  return (
    <>
      <section className="forecast-story" aria-labelledby="forecast-greeting">
        <div className="forecast-story-top">
          <h2 id="forecast-greeting" className="forecast-greeting">
            Your next {horizon} days
          </h2>
          {controls}
        </div>

        <div className="forecast-story-text" aria-busy={pending}>
          {pending ? (
            <div className="forecast-shimmer" role="status" aria-label="Writing your forecast">
              <span className="forecast-shimmer-line forecast-shimmer-line--headline" />
              <span className="forecast-shimmer-line" />
              <span className="forecast-shimmer-line" />
              <span className="forecast-shimmer-line forecast-shimmer-line--short" />
            </div>
          ) : (
            <>
              <p className="forecast-headline">{narrative.headline}</p>
              <p className="forecast-explanation">{narrative.explanation}</p>
            </>
          )}
        </div>

        <div className="forecast-figure">
          <p className="forecast-figure-line">
            <span className="forecast-figure-likely">Likely {formatCurrency(total.p50)}</span>
            <span className="forecast-figure-range">somewhere {formatMoneyBetween(total.p10, total.p90)}</span>
          </p>
          <div className="forecast-ribbon" aria-hidden="true">
            <span className="forecast-ribbon-track" />
            <span className="forecast-ribbon-marker" style={{ left: `${marker}%` }} />
          </div>
          <div className="forecast-ribbon-labels" aria-hidden="true">
            <span>Low {formatCurrency(total.p10)}</span>
            <span>High {formatCurrency(total.p90)}</span>
          </div>
        </div>

        <div className="forecast-story-foot">
          <span className="forecast-chip">{confidenceWords(model.confidence)}</span>
          {stale && !pending && <span className="forecast-chip forecast-chip--quiet">Update coming shortly</span>}
          {model.lowData && <span className="forecast-foot-note">Log a few more days and this gets sharper.</span>}
          {aiWritten && <span className="forecast-foot-note forecast-foot-note--ai">{AI_NOTE}</span>}
        </div>
      </section>

      <section className="forecast-tiles" aria-label="This month at a glance">
        <article className="forecast-tile">
          <h3 className="forecast-tile-label">This month&apos;s likely total</h3>
          <strong className="forecast-tile-value">{formatCurrency(month.projectedTotal.p50)}</strong>
          <p className="forecast-tile-note">
            {formatCurrency(month.spentSoFar)} spent so far,{" "}
            {month.daysLeft === 0 ? "last day of the month" : `${month.daysLeft} ${month.daysLeft === 1 ? "day" : "days"} left`}.
          </p>
        </article>

        <article className={`forecast-tile forecast-tile--${tone}`}>
          <h3 className="forecast-tile-label">{month.surplus.likely >= 0 ? "Likely left over" : "Likely short"}</h3>
          <strong className="forecast-tile-value">{formatCurrency(Math.abs(month.surplus.likely))}</strong>
          <p className="forecast-tile-note">
            Against your {month.surplusBasis} of {formatCurrency(month.surplusAgainst)}.
          </p>
        </article>

        <article className={`forecast-tile${runway?.empty ? " forecast-tile--tight" : ""}`}>
          <h3 className="forecast-tile-label">{runway ? `${runway.name} lasts until` : "Active wallet lasts until"}</h3>
          <strong className="forecast-tile-value">{runway ? runway.text : "No wallet yet"}</strong>
          <p className="forecast-tile-note">
            {activeWallet ? `Balance ${formatCurrency(activeWallet.balance)}.` : "Add a wallet to see how long it lasts."}
          </p>
        </article>
      </section>

      <section className="forecast-panel forecast-chart-panel">
        <ForecastChart forecast={forecast} />
      </section>

      <div className="forecast-two-col">
        <section className="forecast-panel forecast-headsup" aria-labelledby="forecast-headsup-title">
          <h3 id="forecast-headsup-title" className="forecast-panel-title">
            <FaRegBell aria-hidden="true" /> Heads-up
          </h3>
          {headsUp.length > 0 ? (
            <ul className="forecast-headsup-list">
              {headsUp.map((item, i) => (
                <li key={i}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="forecast-empty">Nothing to flag right now.</p>
          )}
        </section>

        <section className="forecast-panel" aria-labelledby="forecast-habits-title">
          <h3 id="forecast-habits-title" className="forecast-panel-title">
            Your habits
          </h3>
          {habits.length > 0 ? (
            <ul className="forecast-habits">
              {habits.map((h, i) => {
                const Icon = HABIT_ICONS[h.icon];
                return (
                  <li key={i} className="forecast-habit-chip">
                    <Icon aria-hidden="true" />
                    <span>{h.text}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="forecast-empty">No clear patterns yet.</p>
          )}
        </section>
      </div>

      <div className="forecast-two-col">
        <section className="forecast-panel" aria-labelledby="forecast-categories-title">
          <h3 id="forecast-categories-title" className="forecast-panel-title">
            Where it likely goes
          </h3>
          {categories.length > 0 ? (
            <ul className="forecast-rows">
              {categories.map((c) => (
                <li key={c.name} className="forecast-row">
                  <div className="forecast-row-main">
                    <span className="forecast-row-name">{c.name}</span>
                    {c.trend && c.trend !== "steady" && (
                      <span className={`forecast-trend forecast-trend--${c.trend}`}>{TREND_LABELS[c.trend]}</span>
                    )}
                    <span className="forecast-row-amount">{formatCurrency(c.expected)}</span>
                  </div>
                  <div
                    className="forecast-share-track"
                    role="progressbar"
                    aria-label={`${c.name} share of likely spending`}
                    aria-valuenow={Math.round(c.share)}
                    aria-valuemin={0}
                    aria-valuemax={100}
                  >
                    <span style={{ width: `${Math.min(100, Math.max(0, c.share))}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="forecast-empty">No category spending to forecast yet.</p>
          )}
        </section>

        <section className="forecast-panel" aria-labelledby="forecast-wallets-title">
          <h3 id="forecast-wallets-title" className="forecast-panel-title">
            Your wallets
          </h3>
          {forecast.wallets.length > 0 ? (
            <ul className="forecast-rows">
              {forecast.wallets.map((w) => (
                <li key={w.name} className="forecast-row forecast-wallet-row">
                  <div className="forecast-row-main">
                    <span className="forecast-row-name">
                      <FaWallet aria-hidden="true" /> {w.name}
                    </span>
                    {w.active && <span className="forecast-badge forecast-badge--active">Active</span>}
                    <span className="forecast-row-amount">{formatCurrency(w.balance)}</span>
                  </div>
                  <p className="forecast-row-note">
                    {w.empty
                      ? "Empty, but spending usually comes out of this wallet."
                      : w.projectedSpend.p90 <= 0
                        ? "No spending expected here."
                        : w.runsOut?.likely
                          ? `Likely runs out around ${formatShortDate(w.runsOut.likely)}.`
                          : `Likely lasts past the next ${horizon} days.`}
                  </p>
                </li>
              ))}
            </ul>
          ) : (
            <p className="forecast-empty">No wallets to forecast yet.</p>
          )}
        </section>
      </div>

      <section className="forecast-goal" aria-label="Goal">
        <span className="forecast-goal-icon">
          <FaBullseye aria-hidden="true" />
        </span>
        {goal ? (
          <p className="forecast-goal-text">
            <strong>{goal.name}</strong>: {formatCurrency(goal.remaining)} to go.{" "}
            {goal.reachBy?.likely
              ? `Likely reached around ${formatShortDate(goal.reachBy.likely)}.`
              : `Likely past the next ${horizon} days.`}
            {goal.requiredPerDay !== null && goal.targetDate
              ? ` Save ${formatCurrency(goal.requiredPerDay)} a day to finish by ${formatShortDate(goal.targetDate)}.`
              : ""}
          </p>
        ) : (
          <p className="forecast-goal-text">No active goal yet. Set one on the Goals tab to see when you would likely reach it.</p>
        )}
        {goal && goal.onTrack !== null && (
          <span className={`forecast-chip ${goal.onTrack ? "forecast-chip--good" : "forecast-chip--warn"}`}>
            {goal.onTrack ? "On track" : "Behind pace"}
          </span>
        )}
      </section>

      <details className="forecast-how">
        <summary>How this forecast works</summary>
        <div className="forecast-how-body">
          <p>
            Buck looked at your last {model.windowDays} days of spending ({model.observedDays} days of history in
            all) and played out many possible months to find a low, likely and high amount. Your weekday rhythm,
            paydays and repeating bills are part of it.
          </p>
          <p>
            Average daily spending: {formatCurrency(forecast.movingAverages.d14)} over 14 days,{" "}
            {formatCurrency(forecast.movingAverages.d30)} over 30 days and {formatCurrency(forecast.movingAverages.d60)}{" "}
            over 60 days.
          </p>
          {forecast.target.multiplier !== 1 && (
            <p>
              Your {forecast.target.attitude} saving attitude sets a target of{" "}
              {formatCurrency(forecast.target.dailyTarget)} a day.
            </p>
          )}
          <h4>Left out as one-offs ({forecast.excluded.length})</h4>
          {forecast.excluded.length > 0 ? (
            <ul className="forecast-excluded">
              {forecast.excluded.map((e, i) => (
                <li key={`${e.date}-${i}`}>
                  <span>
                    {formatShortDate(e.date)}, {e.category}
                    {e.label ? `: ${e.label}` : ""}
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
          {aiWritten && <p className="forecast-foot-note forecast-foot-note--ai">{AI_NOTE} The numbers come from Buck.</p>}
        </div>
      </details>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Rule-engine fallback (Buck_AI unreachable)                          */
/* ------------------------------------------------------------------ */

function FallbackForecast({ insights, controls }: { insights: AIForecastInsights; controls: ReactNode }) {
  const warnings = (insights.warnings ?? []).slice(0, 2);
  const savings = insights.projectedSavings ?? 0;
  return (
    <>
      <section className="forecast-story" aria-labelledby="forecast-greeting">
        <div className="forecast-story-top">
          <h2 id="forecast-greeting" className="forecast-greeting">
            This month
          </h2>
          {controls}
        </div>
        <div className="forecast-story-text forecast-story-text--plain">
          <p className="forecast-explanation">{insights.summary}</p>
        </div>
        <div className="forecast-figure">
          <p className="forecast-figure-line">
            <span className="forecast-figure-likely">Likely {formatCurrency(insights.projectedSpending ?? 0)}</span>
            <span className="forecast-figure-range">
              by month end, with {formatCurrency(Math.abs(savings))} {savings >= 0 ? "likely left over" : "likely short"}
            </span>
          </p>
        </div>
        <div className="forecast-story-foot">
          <span className="forecast-foot-note">
            The detailed forecast is unavailable right now, so this is a quick estimate from your recent pace.
          </span>
        </div>
      </section>

      <section className="forecast-panel forecast-headsup" aria-labelledby="forecast-headsup-title">
        <h3 id="forecast-headsup-title" className="forecast-panel-title">
          <FaRegBell aria-hidden="true" /> Heads-up
        </h3>
        {warnings.length > 0 ? (
          <ul className="forecast-headsup-list">
            {warnings.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        ) : (
          <p className="forecast-empty">Nothing to flag right now.</p>
        )}
      </section>
    </>
  );
}
