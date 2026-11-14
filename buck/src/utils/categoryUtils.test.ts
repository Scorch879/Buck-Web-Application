import { describe, expect, it } from "vitest";
import {
  DEFAULT_CATEGORY_COLOR,
  getBudgetLevel,
  getCategoryColor,
  getShareTier,
} from "./categoryUtils";

describe("categoryUtils", () => {
  it("resolves category colors case-insensitively and falls back to default", () => {
    expect(getCategoryColor("Food")).toBe("#f47536");
    expect(getCategoryColor("  transportation ")).toBe("#3b82f6");
    expect(getCategoryColor("Fare")).toBe("#3b82f6");
    expect(getCategoryColor("Custom Bucket")).toBe(DEFAULT_CATEGORY_COLOR);
    expect(getCategoryColor(null)).toBe(DEFAULT_CATEGORY_COLOR);
  });

  it("classifies budget spending at 80% caution and 100% critical thresholds", () => {
    expect(getBudgetLevel(500, 0)).toBe("none");
    expect(getBudgetLevel(799.99, 1000)).toBe("safe");
    expect(getBudgetLevel(800, 1000)).toBe("caution");
    expect(getBudgetLevel(999.99, 1000)).toBe("caution");
    expect(getBudgetLevel(1000, 1000)).toBe("critical");
    expect(getBudgetLevel(1200, 1000)).toBe("critical");
  });

  it("maps category share percentages to display tiers", () => {
    expect(getShareTier(25).tier).toBe("dominant");
    expect(getShareTier(10).tier).toBe("high");
    expect(getShareTier(6).tier).toBe("moderate");
    expect(getShareTier(3).tier).toBe("low");
    expect(getShareTier(1).tier).toBe("minimal");
    expect(getShareTier(0).tier).toBe("zero");
  });
});
