/**
 * Pure display helpers for the Forecast page (ADR-052). They only format and
 * pick from the AI Forecaster payload; the numbers come from Buck_AI.
 */
import type { BuckForecast, ForecastCategory, ForecastDateRange } from "@/utils/forecastApi";
import { formatCurrency } from "@/utils/formatters";

/**
 * Fields Buck_AI sends that `BuckForecast` does not declare yet
 * (`Buck_AI/BuckAI_Forecast/forecast.py`). Optional so older payloads still type-check.
 */
export type ForecastModelExtras = BuckForecast["model"] & {
  loggingGap?: boolean;
  quietDays?: number | null;
  lastExpense?: string | null;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** Parses a `YYYY-MM-DD` date as a calendar day, ignoring the viewer's time zone. */
function parseDay(iso: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!match) return null;
  return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
}

/** "Nov 3" */
export function formatShortDate(iso: string | null | undefined): string {
  const day = iso ? parseDay(iso) : null;
  if (!day) return "";
  return `${MONTHS[day.getUTCMonth()]} ${day.getUTCDate()}`;
}

/** "Mon, Nov 3, 2026" */
export function formatLongDate(iso: string | null | undefined): string {
  const day = iso ? parseDay(iso) : null;
  if (!day) return "";
  return `${WEEKDAYS[day.getUTCDay()]}, ${MONTHS[day.getUTCMonth()]} ${day.getUTCDate()}, ${day.getUTCFullYear()}`;
}

/** formatCurrency with a leading minus for negatives: "−₱500". */
export function formatSignedCurrency(value: number): string {
  return value < 0 ? `−${formatCurrency(-value)}` : formatCurrency(value);
}

/** "between ₱1,200 and ₱1,800" (or one amount when both ends match). */
export function formatMoneyBetween(low: number, high: number): string {
  const a = Math.min(low, high);
  const b = Math.max(low, high);
  if (Math.abs(b - a) < 0.005) return formatSignedCurrency(a);
  return `between ${formatSignedCurrency(a)} and ${formatSignedCurrency(b)}`;
}

/** "Nov 3 – Nov 9" for the early–late range; null when neither end is known. */
export function formatDateSpan(range: ForecastDateRange | null | undefined): string | null {
  if (!range) return null;
  const early = formatShortDate(range.early);
  const late = formatShortDate(range.late);
  if (early && late) return early === late ? early : `${early} – ${late}`;
  if (early) return `from ${early}`;
  if (late) return `by ${late}`;
  return null;
}

/** Shows the "Rough estimate" chip: too little history or a weak backtest. */
export function isRoughEstimate(model: BuckForecast["model"]): boolean {
  return model.lowData || model.confidence < 0.3;
}

/** 0.734 → 73 */
export function confidencePercent(confidence: number): number {
  return Math.round(Math.min(1, Math.max(0, confidence)) * 100);
}

/** The five largest categories by expected spend over the horizon. */
export function topCategories(categories: ForecastCategory[], limit = 5): ForecastCategory[] {
  return [...categories].sort((a, b) => b.expected - a.expected).slice(0, limit);
}

/**
 * Buck_AI puts the logging-gap note first in `warnings` when `model.loggingGap`
 * is set. It is information (the forecast may run low), not a risk, so the
 * page shows it apart from the rest.
 */
export function splitForecastWarnings(forecast: BuckForecast): { notice: string | null; risks: string[] } {
  const model = forecast.model as ForecastModelExtras;
  const [first, ...rest] = forecast.warnings;
  if (model.loggingGap && first) return { notice: first, risks: rest };
  return { notice: null, risks: [...forecast.warnings] };
}

export const TREND_LABELS: Record<ForecastCategory["trend"], string> = {
  rising: "Rising",
  falling: "Falling",
  steady: "Steady",
  new: "New",
};
