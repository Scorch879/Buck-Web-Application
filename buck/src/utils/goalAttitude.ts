/**
 * Saving attitude for goals, as detected by the AI Financial Advisor
 * (Buck_AI `shared/attitude.py`, `POST /advisor/attitude`) and planned with by
 * the AI Forecaster (`GET /forecast` → `forecast.goal.plan`).
 *
 * The attitude is the cut in usual spending a goal needs: none → Normal,
 * up to 20% → Moderate, more → Aggressive (realistic up to 40%). It is saved
 * on the goal (`goals.attitude`, with the figures in `goals.attitude_basis`).
 */

export type SavingAttitude = "Normal" | "Moderate" | "Aggressive";

export const SAVING_ATTITUDES: readonly SavingAttitude[] = ["Normal", "Moderate", "Aggressive"];

export interface PeriodAmounts {
  perDay: number;
  perWeek: number;
  /** 30 days. */
  perMonth: number;
}

/** Daily, weekly and monthly spending limit and saving for the detected attitude. */
export interface GoalPlan {
  attitude: SavingAttitude;
  spendMultiplier: number;
  saveMultiplier: number;
  /** Most to spend and still reach the goal (never below 0.60x usual spending). */
  spending: PeriodAmounts;
  /** What that leaves to set aside. */
  saving: PeriodAmounts;
  /** Saving the goal needs to land exactly on its target date. */
  required: PeriodAmounts;
  /** Days to reach the goal saving at `saving.perDay`; null when nothing is left over. */
  daysToGoal: number | null;
  reachesByTargetDate: boolean;
  basis: string;
}

/** The figures behind the attitude (also saved as `goals.attitude_basis`). */
export interface AttitudeBasis {
  asOf: string;
  remaining: number;
  daysLeft: number | null;
  typicalDailySpending: number;
  incomePerDay: number | null;
  /** No income logged: Buck assumes income equals usual spending. */
  assumesBreakEven: boolean;
  requiredSavingPerDay: number | null;
  /** Share of usual spending to cut (0.17 = 17%); negative means room to spare. */
  cutNeeded: number | null;
  /** False when the goal needs more than a 40% cut (or the date has passed). */
  feasible: boolean;
  spendAllowancePerDay?: number;
  /** One or two plain sentences for the user. */
  reason: string;
}

export interface GoalAttitude extends AttitudeBasis {
  attitude: SavingAttitude;
  goalId: string | null;
  plan: GoalPlan | null;
  window: { spendingDays: number; incomeDays: number | null };
}

export function isSavingAttitude(value: unknown): value is SavingAttitude {
  return typeof value === "string" && (SAVING_ATTITUDES as readonly string[]).includes(value);
}
