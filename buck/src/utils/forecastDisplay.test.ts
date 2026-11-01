import { describe, expect, it } from "vitest";
import type { BuckForecast, ForecastCategory, ForecastWallet } from "./forecastApi";
import {
  activeWalletRunway,
  categoriesWithOthers,
  confidenceWords,
  cooldownRemainingMs,
  formatDateSpan,
  formatLongDate,
  formatMoneyBetween,
  formatShortDate,
  habitChips,
  habitIcon,
  headsUpItems,
  rangePosition,
  surplusTone,
} from "./forecastDisplay";

const model = (over: Partial<BuckForecast["model"]> = {}) =>
  ({
    method: "m",
    windowDays: 30,
    observedDays: 90,
    simulations: 1000,
    backtestDays: 14,
    backtestError: 0.14,
    bandCoverage: 0.9,
    confidence: 0.7,
    lowData: false,
    lastExpense: "2026-10-30",
    quietDays: 1,
    loggingGap: false,
    ...over,
  }) satisfies BuckForecast["model"];

const month = (likely: number, high: number, against = 10_000) =>
  ({ surplus: { low: likely - 500, likely, high }, surplusAgainst: against }) as BuckForecast["month"];

const wallet = (over: Partial<ForecastWallet>): ForecastWallet => ({
  name: "Cash",
  active: false,
  balance: 1000,
  projectedSpend: { p10: 0, p50: 0, p90: 0 },
  runsOut: null,
  empty: false,
  ...over,
});

describe("forecastDisplay", () => {
  it("formats calendar days without shifting by time zone", () => {
    expect(formatShortDate("2026-11-01")).toBe("Nov 1");
    expect(formatLongDate("2026-11-01")).toBe("Sun, Nov 1, 2026");
    expect(formatShortDate(null)).toBe("");
    expect(formatShortDate("not a date")).toBe("");
  });

  it("says 'between' for a range and one amount when the ends match", () => {
    expect(formatMoneyBetween(1800, 1200.5)).toBe("between ₱1,200.50 and ₱1,800");
    expect(formatMoneyBetween(50, 50)).toBe("₱50");
    expect(formatMoneyBetween(200, -500)).toBe("between −₱500 and ₱200");
  });

  it("formats an early–late date span", () => {
    expect(formatDateSpan({ early: "2026-11-03", likely: "2026-11-05", late: "2026-11-09" })).toBe(
      "Nov 3 – Nov 9"
    );
    expect(formatDateSpan({ early: "2026-11-03", likely: null, late: null })).toBe("from Nov 3");
    expect(formatDateSpan({ early: null, likely: null, late: null })).toBeNull();
    expect(formatDateSpan(null)).toBeNull();
  });

  it("counts down to cooldownUntil and ignores past or missing times", () => {
    const now = Date.parse("2026-10-31T06:00:00Z");
    expect(cooldownRemainingMs("2026-10-31T06:00:45Z", now)).toBe(45_000);
    expect(cooldownRemainingMs("2026-10-31T05:59:00Z", now)).toBe(0);
    expect(cooldownRemainingMs(null, now)).toBe(0);
    expect(cooldownRemainingMs("nope", now)).toBe(0);
  });

  it("puts confidence into words", () => {
    expect(confidenceWords(0.6)).toBe("Pretty sure");
    expect(confidenceWords(0.45)).toBe("Fair guess");
    expect(confidenceWords(0.29)).toBe("Rough guess");
  });

  it("is crimson only for a real shortfall", () => {
    expect(surplusTone(month(200, 900))).toBe("good");
    expect(surplusTone(month(-300, 400))).toBe("tight"); // high end still breaks even
    expect(surplusTone(month(-800, -100))).toBe("tight"); // within 10% of ₱10,000
    expect(surplusTone(month(-3000, -1500))).toBe("short");
  });

  it("places the likely marker between low and high", () => {
    expect(rangePosition(0, 50, 200)).toBe(25);
    expect(rangePosition(100, 100, 100)).toBe(50);
    expect(rangePosition(0, 300, 200)).toBe(100);
  });

  it("keeps four categories and folds the rest into Others", () => {
    const cats = [10, 50, 30, 70, 20, 60].map(
      (expected, i) => ({ name: `c${i}`, expected, share: expected / 2.4, trend: "steady" }) as ForecastCategory
    );
    const slices = categoriesWithOthers(cats);
    expect(slices.map((c) => c.expected)).toEqual([70, 60, 50, 30, 30]);
    expect(slices[4]).toMatchObject({ name: "Others", trend: null });
    expect(categoriesWithOthers(cats.slice(0, 3))).toHaveLength(3);
  });

  it("picks habit icons from the kind or the words", () => {
    expect(habitIcon("anything", "payday")).toBe("payday");
    expect(habitIcon("You spend more on Fridays and weekends")).toBe("weekday");
    expect(habitIcon("Spending jumps right after payday")).toBe("payday");
    expect(habitIcon("Netflix every month")).toBe("recurring");
    expect(habitIcon("Food is up 20%")).toBe("trend");
  });

  it("prefers the AI's habit notes over the model's habits", () => {
    const f = { habits: [{ kind: "weekday", text: "Weekend spender" }] } as BuckForecast;
    expect(habitChips(f, ["Bills land early in the month"])).toEqual([
      { text: "Bills land early in the month", icon: "recurring" },
    ]);
    expect(habitChips(f, [])).toEqual([{ text: "Weekend spender", icon: "weekday" }]);
  });

  it("describes the active wallet's runway", () => {
    const f = (wallets: ForecastWallet[]) => ({ wallets }) as BuckForecast;
    expect(activeWalletRunway(f([]))).toBeNull();
    expect(
      activeWalletRunway(f([wallet({}), wallet({ name: "GCash", active: true, runsOut: { early: null, likely: "2026-11-12", late: null } })]))
    ).toEqual({ name: "GCash", text: "Around Nov 12", empty: false });
    expect(activeWalletRunway(f([wallet({ active: true, empty: true })]))?.text).toBe("Empty");
    expect(activeWalletRunway(f([wallet({ active: true })]))?.text).toBe("Past this period");
  });

  it("puts a friendly logging nudge first and shows at most two heads-ups", () => {
    const warnings = ["Nothing logged for 19 days.", "Food is rising.", "GCash is empty."];
    expect(headsUpItems({ warnings, model: model({ loggingGap: true, lastExpense: "2026-10-11" }) } as BuckForecast)).toEqual([
      "Nothing logged since Oct 11. If you've spent since then, add it and this forecast gets more accurate.",
      "Food is rising.",
    ]);
    expect(headsUpItems({ warnings, model: model() } as BuckForecast)).toEqual([
      "Nothing logged for 19 days.",
      "Food is rising.",
    ]);
  });
});
