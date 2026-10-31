import { buckAiError, buckAiFetch } from "@/utils/buckAi";

/** Low / likely / high: the 80% range (P10-P90) and the median. */
export interface ForecastBand {
  p10: number;
  p50: number;
  p90: number;
}

/** Earliest / likely / latest date (ISO); null when it does not happen in the horizon. */
export interface ForecastDateRange {
  early: string | null;
  likely: string | null;
  late: string | null;
}

export interface ForecastDay extends ForecastBand {
  date: string;
  /**
   * Mean of the simulations. Use it for the daily "expected" line: for someone
   * who spends on some days only, p50 is ₱0 on most days. It matches the band
   * and the attitude target, which is built from the mean. Cumulative lines use
   * `cumulative.p50`.
   */
  expected: number;
  cumulative: ForecastBand;
  /** Recurring items (bills, subscriptions) due that day. */
  recurring: string[];
}

export interface ForecastCategory {
  name: string;
  expected: number;
  share: number;
  restOfMonth: number;
  trend: "rising" | "falling" | "steady" | "new";
  recurring: boolean;
}

export interface ForecastWallet {
  name: string;
  active: boolean;
  balance: number;
  projectedSpend: ForecastBand;
  /** Null when the balance is zero (see `empty`). */
  runsOut: ForecastDateRange | null;
  /** Balance is zero but spending usually comes out of it. */
  empty: boolean;
}

export interface ForecastHabit {
  kind: "rhythm" | "weekday" | "payday" | "trend" | "recurring";
  /** Only on "rhythm": steady, weekly or monthly. */
  value?: string;
  text: string;
}

export interface ForecastRange {
  low: number;
  likely: number;
  high: number;
}

/** The AI Forecaster's numbers (Buck_AI `GET /forecast`). All amounts in PHP. */
export interface BuckForecast {
  today: string;
  horizonDays: ForecastHorizon;
  days: ForecastDay[];
  total: ForecastBand;
  month: {
    start: string;
    end: string;
    daysLeft: number;
    spentSoFar: number;
    restOfMonth: ForecastBand;
    projectedTotal: ForecastBand;
    /** Left over at month end (negative = overspend). */
    surplus: ForecastRange;
    surplusBasis: "income this month" | "current wallet balances";
    surplusAgainst: number;
  };
  categories: ForecastCategory[];
  wallets: ForecastWallet[];
  /** Saving-attitude target line: expected daily spend x spend multiplier. */
  target: {
    attitude: string;
    multiplier: number;
    expectedDaily: number;
    dailyTarget: number;
    /** expectedDaily - dailyTarget: what the attitude asks for, 0 when Normal. */
    gapPerDay: number;
    restOfMonthTarget: number;
  };
  goal: {
    name: string;
    remaining: number;
    targetDate: string | null;
    requiredPerDay: number | null;
    freeCashPerDay: ForecastRange | null;
    reachBy: ForecastDateRange | null;
    onTrack: boolean | null;
  } | null;
  habits: ForecastHabit[];
  recurring: { category: string; label: string; cadence: "weekly" | "monthly"; amount: number; nextDue: string }[];
  /** Emergencies and one-offs left out of the baseline (newest first, max 10). */
  excluded: { date: string; category: string; amount: number; label: string; reason: "emergency" | "one-off" }[];
  movingAverages: { d14: number; d30: number; d60: number };
  warnings: string[];
  model: {
    method: string;
    windowDays: number;
    observedDays: number;
    simulations: number;
    backtestDays: number;
    backtestError: number | null;
    bandCoverage: number | null;
    confidence: number;
    lowData: boolean;
    /** Date of the latest expense (ISO), or null with no history. */
    lastExpense: string | null;
    /** Days since `lastExpense`. */
    quietDays: number | null;
    /** Nothing logged for far longer than usual: the forecast probably runs low. */
    loggingGap: boolean;
  };
}

export interface ForecastNarrative {
  headline: string;
  explanation: string;
  habitNotes: string[];
  watchOut: string;
}

/** Buck_AI forecast response (`GET /forecast`, `POST /forecast/explain`). */
interface BuckForecastResponse {
  id: string | null;
  forecast: BuckForecast;
  narrative: ForecastNarrative;
  /** Who wrote the narrative: Groq (current), Gemini (older saved rows) or the rules. */
  generatedWith: "groq" | "gemini" | "rules";
  explanationPending: boolean;
  createdAt: string | null;
  cached: boolean;
  stale: boolean;
  cooldownUntil: string | null;
}

export type ForecastHorizon = 30 | 60;

/**
 * What the Forecast page renders. The flat fields are filled by both sources;
 * `forecast` and `narrative` only come from the AI Forecaster (Buck_AI).
 */
export interface AIForecastInsights {
  id?: string | null;
  summary: string;
  projectedSpending?: number;
  projectedSavings: number;
  aiRecommendedBudget?: number | null;
  warnings: string[];
  dailyForecast?: Record<string, number>;
  actualSpendingSnapshot?: number;
  periodStart?: string;
  periodEnd?: string;
  createdAt?: string;
  cached?: boolean;
  /** "buck_ai" = AI Forecaster; "rules" = the web rule engine fallback. */
  source?: "buck_ai" | "rules";
  forecast?: BuckForecast;
  narrative?: ForecastNarrative;
  generatedWith?: "groq" | "gemini" | "rules";
  /** The narrative is rule-written for now; call `explainAIForecast` for the AI one. */
  explanationPending?: boolean;
  /** The data changed but re-explaining is cooling down; a fresh one comes shortly. */
  stale?: boolean;
  /** A new explanation is held back until this ISO time (refresh or data-change cooldown). */
  cooldownUntil?: string | null;
}

function fromBuckAi(r: BuckForecastResponse): AIForecastInsights {
  const f = r.forecast;
  const { month } = f;
  return {
    id: r.id,
    summary: [r.narrative.headline, r.narrative.explanation].filter(Boolean).join(" "),
    // The flat fields describe this calendar month, like the rule engine's.
    projectedSpending: month.projectedTotal.p50,
    projectedSavings: Math.max(0, month.surplus.likely),
    aiRecommendedBudget: Math.round((month.spentSoFar + f.target.restOfMonthTarget) * 100) / 100,
    warnings: f.warnings,
    dailyForecast: Object.fromEntries(f.days.map((d) => [d.date, d.p50])),
    actualSpendingSnapshot: month.spentSoFar,
    periodStart: f.days[0]?.date,
    periodEnd: f.days[f.days.length - 1]?.date,
    createdAt: r.createdAt ?? undefined,
    cached: r.cached,
    source: "buck_ai",
    forecast: f,
    narrative: r.narrative,
    generatedWith: r.generatedWith,
    explanationPending: r.explanationPending,
    stale: r.stale,
    cooldownUntil: r.cooldownUntil,
  };
}

async function fromRuleEngine(forceRefresh: boolean): Promise<AIForecastInsights> {
  const response = await fetch("/api/forecast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ forceRefresh }),
  });
  if (!response.ok) {
    throw new Error("Failed to fetch AI forecast insights");
  }
  const data: AIForecastInsights = await response.json();
  return { ...data, source: "rules" };
}

/**
 * Reads the forecast. Buck_AI returns the numbers at once, with the saved
 * explanation or a rule-written one (`explanationPending`: follow up with
 * `explainAIForecast`). `forceRefresh` asks Buck_AI for a new explanation now,
 * subject to a short cooldown. If Buck_AI is unreachable the web rule engine
 * (`/api/forecast`) answers instead. `userId` is accepted for call-site
 * compatibility; the token identifies the user.
 */
export async function fetchAIForecastInsights(context: {
  userId?: string;
  forceRefresh?: boolean;
  horizon?: ForecastHorizon;
}): Promise<AIForecastInsights> {
  const horizon = context.horizon ?? 30;
  try {
    const response = context.forceRefresh
      ? await buckAiFetch(`/forecast/explain?horizon=${horizon}&refresh=true`, { method: "POST" })
      : await buckAiFetch(`/forecast?horizon=${horizon}`);
    if (!response.ok) {
      throw new Error(await buckAiError(response, "Failed to fetch AI forecast"));
    }
    return fromBuckAi(await response.json());
  } catch (err) {
    console.warn("AI Forecaster unavailable; using the rule-based forecast.", err);
    return fromRuleEngine(Boolean(context.forceRefresh));
  }
}

const explaining = new Map<ForecastHorizon, Promise<AIForecastInsights>>();

/**
 * Writes and saves the AI explanation (Groq; rule-written if it is
 * unavailable). Concurrent calls for the same horizon share one request.
 */
export function explainAIForecast(horizon: ForecastHorizon = 30): Promise<AIForecastInsights> {
  const pending = explaining.get(horizon);
  if (pending) return pending;
  const request = (async () => {
    const response = await buckAiFetch(`/forecast/explain?horizon=${horizon}`, { method: "POST" });
    if (!response.ok) {
      throw new Error(await buckAiError(response, "Failed to explain the forecast"));
    }
    return fromBuckAi(await response.json());
  })().finally(() => explaining.delete(horizon));
  explaining.set(horizon, request);
  return request;
}
