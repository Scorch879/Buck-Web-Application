/**
 * Plain-math goal forecast for the Goals and Statistics charts. No AI: the
 * AI Forecaster (Buck_AI/BuckAI_Forecast) will build on this later.
 *
 * The trajectory spreads the remaining amount evenly over the days left; the
 * recommended saving is that pace per week (under 60 days) or per month,
 * scaled by the saving-attitude savings multiplier (1.0 / 1.15 / 1.30).
 */

const DAY_MS = 86_400_000;
const MAX_HORIZON_DAYS = 3650;
const SAVINGS_MULTIPLIER: Record<string, number> = { Normal: 1, Moderate: 1.15, Aggressive: 1.3 };

export interface GoalForecast {
  forecast: string;
  forecast_per_day: Record<string, number>;
  actual_per_day: Record<string, number>;
  days_left: number;
  saved: number;
  remaining: number;
  recommended_period: "week" | "month";
  ai_recommended_budget: number | null;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
const peso = (n: number) =>
  `₱${n.toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function computeGoalForecast(
  goal: { goalName: string; targetAmount: number; currentAmount: number; targetDate?: string; attitude?: string },
  today = new Date()
): GoalForecast {
  const saved = round2(Math.max(0, goal.currentAmount));
  const remaining = round2(Math.max(0, goal.targetAmount - goal.currentAmount));
  const start = new Date(`${dayKey(today)}T00:00:00Z`);
  const target = goal.targetDate ? new Date(`${goal.targetDate.slice(0, 10)}T00:00:00Z`) : null;
  const daysLeft =
    target && !Number.isNaN(target.getTime())
      ? Math.min(MAX_HORIZON_DAYS, Math.round((target.getTime() - start.getTime()) / DAY_MS))
      : 0;

  if (daysLeft <= 0) {
    return {
      forecast: goal.targetDate
        ? "The target date has passed. Set a new date to get a forecast."
        : "Add a target date to this goal to get a forecast.",
      forecast_per_day: {},
      actual_per_day: {},
      days_left: 0,
      saved,
      remaining,
      recommended_period: "month",
      ai_recommended_budget: null,
    };
  }

  const perDay = round2(remaining / daysLeft);
  const forecast_per_day: Record<string, number> = {};
  for (let i = 0; i < daysLeft; i++) {
    forecast_per_day[dayKey(new Date(start.getTime() + i * DAY_MS))] = perDay;
  }

  const period: "week" | "month" = daysLeft < 60 ? "week" : "month";
  const multiplier = SAVINGS_MULTIPLIER[goal.attitude ?? "Normal"] ?? 1;
  const recommended = round2(Math.min(remaining, perDay * (period === "week" ? 7 : 30) * multiplier));

  return {
    forecast: `Save about ${peso(recommended)} per ${period} to reach ${goal.goalName} in ${daysLeft} days.`,
    forecast_per_day,
    actual_per_day: {},
    days_left: daysLeft,
    saved,
    remaining,
    recommended_period: period,
    ai_recommended_budget: recommended > 0 ? recommended : null,
  };
}
