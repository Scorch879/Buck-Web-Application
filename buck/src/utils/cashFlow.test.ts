import { describe, expect, it } from "vitest";
import {
  computeCashFlow,
  formatDeltaVsLastMonth,
  parseLocalDate,
  toLocalDateString,
} from "./cashFlow";

// Thursday 15 Oct 2026, local time.
const now = new Date(2026, 9, 15, 13, 30);

const item = (date: string, amount: number) => ({ date, amount });

describe("parseLocalDate", () => {
  it("parses YYYY-MM-DD as a local calendar date", () => {
    const parsed = parseLocalDate("2026-10-01");
    expect(parsed?.getFullYear()).toBe(2026);
    expect(parsed?.getMonth()).toBe(9);
    expect(parsed?.getDate()).toBe(1);
    expect(parsed?.getHours()).toBe(0);
  });

  it("returns null for empty or invalid input", () => {
    expect(parseLocalDate("")).toBeNull();
    expect(parseLocalDate("not a date")).toBeNull();
  });

  it("round-trips through toLocalDateString", () => {
    expect(toLocalDateString(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});

describe("computeCashFlow", () => {
  it("includes the first and last day of the month and excludes neighbours", () => {
    const flow = computeCashFlow(
      [
        item("2026-09-30", 1000), // last month
        item("2026-10-01", 2000), // first day: this month
        item("2026-10-31", 3000), // last day: this month
        item("2026-11-01", 9999), // next month: ignored
      ],
      [],
      now
    );

    expect(flow.monthIncome).toBe(5000);
    expect(flow.lastMonthIncome).toBe(1000);
    expect(flow.incomeDelta).toBe(4000);
  });

  it("computes net savings and saved rate", () => {
    const flow = computeCashFlow(
      [item("2026-10-02", 10000)],
      [item("2026-10-03", 2500), item("2026-09-10", 400)],
      now
    );

    expect(flow.monthExpenses).toBe(2500);
    expect(flow.lastMonthExpenses).toBe(400);
    expect(flow.netSavings).toBe(7500);
    expect(flow.savedRate).toBeCloseTo(0.75);
    expect(flow.expensesDelta).toBe(2100);
  });

  it("allows a negative net and clamps the saved rate to 0", () => {
    const flow = computeCashFlow(
      [item("2026-10-02", 1000)],
      [item("2026-10-03", 4000)],
      now
    );

    expect(flow.netSavings).toBe(-3000);
    expect(flow.savedRate).toBe(0);
  });

  it("has a saved rate of 0 with no income and a negative net", () => {
    const flow = computeCashFlow([], [item("2026-10-03", 500)], now);

    expect(flow.tracked).toBe(true);
    expect(flow.monthIncome).toBe(0);
    expect(flow.netSavings).toBe(-500);
    expect(flow.savedRate).toBe(0);
  });

  it("reports untracked income as zero with a neutral state", () => {
    const flow = computeCashFlow(null, [item("2026-10-03", 500)], now);

    expect(flow.tracked).toBe(false);
    expect(flow.monthIncome).toBe(0);
    expect(flow.lastMonthIncome).toBe(0);
    expect(flow.savedRate).toBe(0);
    expect(flow.monthExpenses).toBe(500);
  });

  it("handles the December to January boundary", () => {
    const january = new Date(2027, 0, 10);
    const flow = computeCashFlow(
      [item("2026-12-20", 700), item("2027-01-02", 300)],
      [item("2026-12-31", 100)],
      january
    );

    expect(flow.lastMonthIncome).toBe(700);
    expect(flow.monthIncome).toBe(300);
    expect(flow.lastMonthExpenses).toBe(100);
  });

  it("ignores rows with unparseable dates or non-finite amounts", () => {
    const flow = computeCashFlow(
      [item("", 500), item("2026-10-05", Number.NaN), item("2026-10-06", 250)],
      [],
      now
    );

    expect(flow.monthIncome).toBe(250);
  });
});

describe("formatDeltaVsLastMonth", () => {
  it("formats positive and negative deltas", () => {
    expect(formatDeltaVsLastMonth(5000)).toBe("+₱5,000 vs last mo.");
    expect(formatDeltaVsLastMonth(-2100)).toBe("-₱2,100 vs last mo.");
    expect(formatDeltaVsLastMonth(0)).toBe("+₱0 vs last mo.");
  });
});
