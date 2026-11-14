export type BudgetLevel = "safe" | "caution" | "critical" | "none";

export const BUDGET_CAUTION_RATIO = 0.8;
export const BUDGET_CRITICAL_RATIO = 1;
export const BUDGET_WARNING_REMAINING_PCT = Math.round(
  (1 - BUDGET_CAUTION_RATIO) * 100
);

export const BUDGET_LEVEL_COLORS: Record<BudgetLevel, string> = {
  safe: "#f47536",
  caution: "#f59e0b",
  critical: "#ff3838",
  none: "#f47536",
};

export const BUDGET_LEVEL_HOVER_COLORS: Record<BudgetLevel, string> = {
  safe: "#ff8547",
  caution: "#fbbf24",
  critical: "#ff5252",
  none: "#ff8547",
};

/** Classifies spending against a budget using SRS 3.7 thresholds (80% caution, 100% critical). */
export function getBudgetLevel(spent: number, budget: number): BudgetLevel {
  if (budget <= 0) return "none";
  const ratio = spent / budget;
  if (ratio >= BUDGET_CRITICAL_RATIO) return "critical";
  if (ratio >= BUDGET_CAUTION_RATIO) return "caution";
  return "safe";
}

export const DEFAULT_CATEGORY_COLOR = "#f47536";

export const CATEGORY_COLORS: Record<string, string> = {
  Food: "#f47536",
  Transportation: "#3b82f6",
  Shopping: "#ec4899",
  Bills: "#eab308",
  Education: "#8b5cf6",
  Electronics: "#06b6d4",
  Entertainment: "#f97316",
  Health: "#ef4444",
  Home: "#10b981",
  Insurance: "#6366f1",
  Social: "#14b8a6",
  Sport: "#84cc16",
  Telephone: "#0ea5e9",
  Fare: "#3b82f6",
  "Gas Money": "#eab308",
  "Video Games": "#f97316",
  Tax: "#6366f1",
  "Goal Transfer": "#ffc547",
  Uncategorized: "#a8a29e",
};

const LOWER_CATEGORY_COLORS = new Map(
  Object.entries(CATEGORY_COLORS).map(([key, color]) => [
    key.toLowerCase(),
    color,
  ])
);

export function getCategoryColor(name?: string | null): string {
  if (!name) return DEFAULT_CATEGORY_COLOR;
  return (
    LOWER_CATEGORY_COLORS.get(name.trim().toLowerCase()) ??
    DEFAULT_CATEGORY_COLOR
  );
}

export type ShareTier = {
  tier: "dominant" | "high" | "moderate" | "low" | "minimal" | "zero";
  gradient: string;
  textColor: string;
  trackBg: string;
};

export function getShareTier(share: number): ShareTier {
  if (share >= 20) {
    return {
      tier: "dominant",
      gradient: "linear-gradient(90deg, #ff7a45 0%, #ef4444 100%)",
      textColor: "#f87171",
      trackBg: "rgba(239, 68, 68, 0.14)",
    };
  }
  if (share >= 10) {
    return {
      tier: "high",
      gradient: "linear-gradient(90deg, #ffc547 0%, #f47536 100%)",
      textColor: "var(--buck-orange)",
      trackBg: "rgba(244, 117, 54, 0.14)",
    };
  }
  if (share >= 6) {
    return {
      tier: "moderate",
      gradient: "linear-gradient(90deg, #fde047 0%, #eab308 100%)",
      textColor: "#facc15",
      trackBg: "rgba(234, 179, 8, 0.14)",
    };
  }
  if (share >= 3) {
    return {
      tier: "low",
      gradient: "linear-gradient(90deg, #34d399 0%, #10b981 100%)",
      textColor: "#34d399",
      trackBg: "rgba(16, 185, 129, 0.14)",
    };
  }
  if (share > 0) {
    return {
      tier: "minimal",
      gradient: "linear-gradient(90deg, #38bdf8 0%, #0ea5e9 100%)",
      textColor: "#38bdf8",
      trackBg: "rgba(14, 165, 233, 0.14)",
    };
  }
  return {
    tier: "zero",
    gradient: "rgba(148, 163, 184, 0.25)",
    textColor: "var(--buck-muted)",
    trackBg: "rgba(148, 163, 184, 0.12)",
  };
}
