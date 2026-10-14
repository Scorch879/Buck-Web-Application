import { describe, expect, it } from "vitest";
import { computeGoalForecast } from "./goalForecast";

const today = new Date("2026-10-14T05:00:00Z");
const goal = { goalName: "Laptop", targetAmount: 50000, currentAmount: 10000, attitude: "Moderate" };

describe("computeGoalForecast", () => {
  it("spreads the remaining amount over the days left", () => {
    const f = computeGoalForecast({ ...goal, targetDate: "2026-12-13" }, today);
    expect(f.days_left).toBe(60);
    expect(Object.keys(f.forecast_per_day)).toHaveLength(60);
    expect(f.forecast_per_day["2026-10-14"]).toBeCloseTo(666.67, 2);
    expect(f.remaining).toBe(40000);
    expect(f.recommended_period).toBe("month");
    // ₱666.67/day x 30 days x 1.15 (Moderate savings multiplier)
    expect(f.ai_recommended_budget).toBeCloseTo(23000.12, 2);
  });

  it("uses weekly pace under 60 days and never recommends more than remains", () => {
    const f = computeGoalForecast({ ...goal, currentAmount: 49900, targetDate: "2026-10-20" }, today);
    expect(f.recommended_period).toBe("week");
    expect(f.ai_recommended_budget).toBe(100);
  });

  it("handles missing and past target dates", () => {
    expect(computeGoalForecast(goal, today).forecast).toMatch(/Add a target date/);
    const past = computeGoalForecast({ ...goal, targetDate: "2026-01-01" }, today);
    expect(past.forecast_per_day).toEqual({});
    expect(past.ai_recommended_budget).toBeNull();
  });
});
