/**
 * Pure display helpers for the Forecast page (ADR-052). They only format and
 * pick from the AI Forecaster payload; the numbers come from Buck_AI.
 */
import type { BuckForecast, ForecastCategory, ForecastDateRange, ForecastHabit } from "@/utils/forecastApi";
import { formatCurrency } from "@/utils/formatters";

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

/** Milliseconds until `cooldownUntil` (0 when it is null, invalid or past). */
export function cooldownRemainingMs(cooldownUntil: string | null | undefined, now: number): number {
  const until = cooldownUntil ? Date.parse(cooldownUntil) : NaN;
  return Number.isFinite(until) ? Math.max(0, until - now) : 0;
}

/** "2:14 PM" in the viewer's locale. */
export function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** How sure the forecast is, in words instead of a percentage. */
export function confidenceWords(confidence: number): "Pretty sure" | "Fair guess" | "Rough guess" {
  if (confidence >= 0.6) return "Pretty sure";
  if (confidence >= 0.3) return "Fair guess";
  return "Rough guess";
}

/**
 * Colour of the month's left-over figure: "good" when money is likely left,
 * "tight" when a little short (or the high end still breaks even), "short"
 * only for a real shortfall (Buck Coral).
 */
export function surplusTone(month: BuckForecast["month"]): "good" | "tight" | "short" {
  const { likely, high } = month.surplus;
  if (likely >= 0) return "good";
  const smallGap = Math.abs(likely) <= Math.max(month.surplusAgainst, 0) * 0.1;
  return high >= 0 || smallGap ? "tight" : "short";
}

/** Where the likely value sits between low and high, as 0–100 (50 when the range is flat). */
export function rangePosition(low: number, likely: number, high: number): number {
  if (high - low < 0.005) return 50;
  return Math.min(100, Math.max(0, ((likely - low) / (high - low)) * 100));
}

export interface CategorySlice {
  name: string;
  expected: number;
  share: number;
  trend: ForecastCategory["trend"] | null;
}

/** The four largest categories by expected spend, plus one "Others" row for the rest. */
export function categoriesWithOthers(categories: ForecastCategory[], limit = 4): CategorySlice[] {
  const sorted = [...categories].sort((a, b) => b.expected - a.expected);
  const top: CategorySlice[] = sorted
    .slice(0, limit)
    .map(({ name, expected, share, trend }) => ({ name, expected, share, trend }));
  const rest = sorted.slice(limit);
  if (rest.length === 0) return top;
  const sum = (key: "expected" | "share") => Math.round(rest.reduce((t, c) => t + c[key], 0) * 100) / 100;
  return [...top, { name: "Others", expected: sum("expected"), share: sum("share"), trend: null }];
}

export type HabitIcon = "weekday" | "payday" | "recurring" | "trend" | "rhythm";

const WEEKDAY_WORDS = /\b(mon|tues|wednes|thurs|fri|satur|sun)days?\b|\bweekends?\b|\bweekdays?\b/i;

/** Picks an icon for a habit: from its kind, or from the words of an AI note. */
export function habitIcon(text: string, kind?: ForecastHabit["kind"]): HabitIcon {
  if (kind) return kind;
  if (/pay ?day|salary|allowance|get paid/i.test(text)) return "payday";
  if (WEEKDAY_WORDS.test(text)) return "weekday";
  if (/\bevery\b|monthly|weekly|bill|subscription|recurring/i.test(text)) return "recurring";
  if (/\bup\b|\bdown\b|rising|falling|more than|less than|%/i.test(text)) return "trend";
  return "rhythm";
}

/** The habit chips: the AI's notes when it wrote some, otherwise the model's habits. */
export function habitChips(
  forecast: BuckForecast,
  habitNotes: string[] | undefined
): { text: string; icon: HabitIcon }[] {
  if (habitNotes && habitNotes.length > 0) {
    return habitNotes.map((text) => ({ text, icon: habitIcon(text) }));
  }
  return forecast.habits.map((h) => ({ text: h.text, icon: habitIcon(h.text, h.kind) }));
}

/** "Around Nov 12", "Empty" or "Past this period" for the active wallet; null without wallets. */
export function activeWalletRunway(forecast: BuckForecast): { name: string; text: string; empty: boolean } | null {
  const wallet = forecast.wallets.find((w) => w.active) ?? forecast.wallets[0];
  if (!wallet) return null;
  if (wallet.empty) return { name: wallet.name, text: "Empty", empty: true };
  const likely = wallet.runsOut?.likely;
  return { name: wallet.name, text: likely ? `Around ${formatShortDate(likely)}` : "Past this period", empty: false };
}

/**
 * At most two heads-up items. A logging gap comes first, as a friendly nudge
 * (Buck_AI puts its own logging-gap warning first; it is replaced here).
 */
export function headsUpItems(forecast: BuckForecast, limit = 2): string[] {
  const { model } = forecast;
  const items: string[] = [];
  let warnings = forecast.warnings;
  if (model.loggingGap) {
    const since = model.lastExpense ? ` since ${formatShortDate(model.lastExpense)}` : "";
    items.push(`Nothing logged${since}. If you've spent since then, add it and this forecast gets more accurate.`);
    warnings = warnings.slice(1);
  }
  return [...items, ...warnings].slice(0, limit);
}

export const TREND_LABELS: Record<ForecastCategory["trend"], string> = {
  rising: "Going up",
  falling: "Going down",
  steady: "Steady",
  new: "New",
};
