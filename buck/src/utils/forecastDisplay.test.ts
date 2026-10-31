import { describe, expect, it } from "vitest";
import type { BuckForecast, ForecastCategory } from "./forecastApi";
import {
  confidencePercent,
  cooldownRemainingMs,
  formatDateSpan,
  formatLongDate,
  formatMoneyBetween,
  formatShortDate,
  isRoughEstimate,
  splitForecastWarnings,
  topCategories,
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

  it("marks low data or confidence under 0.3 as a rough estimate", () => {
    expect(isRoughEstimate(model())).toBe(false);
    expect(isRoughEstimate(model({ confidence: 0.29 }))).toBe(true);
    expect(isRoughEstimate(model({ lowData: true }))).toBe(true);
    expect(confidencePercent(0.734)).toBe(73);
    expect(confidencePercent(1.4)).toBe(100);
  });

  it("counts down to cooldownUntil and ignores past or missing times", () => {
    const now = Date.parse("2026-10-31T06:00:00Z");
    expect(cooldownRemainingMs("2026-10-31T06:00:45Z", now)).toBe(45_000);
    expect(cooldownRemainingMs("2026-10-31T05:59:00Z", now)).toBe(0);
    expect(cooldownRemainingMs(null, now)).toBe(0);
    expect(cooldownRemainingMs("nope", now)).toBe(0);
  });

  it("keeps the five largest categories", () => {
    const cats = [10, 50, 30, 70, 20, 60].map(
      (expected, i) => ({ name: `c${i}`, expected }) as ForecastCategory
    );
    expect(topCategories(cats).map((c) => c.expected)).toEqual([70, 60, 50, 30, 20]);
  });

  it("pulls the logging-gap note out of the warnings", () => {
    const base = { warnings: ["Nothing logged for 19 days.", "Food is rising."] } as BuckForecast;
    expect(splitForecastWarnings({ ...base, model: model({ loggingGap: true }) })).toEqual({
      notice: "Nothing logged for 19 days.",
      risks: ["Food is rising."],
    });
    expect(splitForecastWarnings({ ...base, model: model({ loggingGap: false }) })).toEqual({
      notice: null,
      risks: ["Nothing logged for 19 days.", "Food is rising."],
    });
  });
});
