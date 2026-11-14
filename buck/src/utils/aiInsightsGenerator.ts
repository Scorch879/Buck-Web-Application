import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { formatCurrency, toNumber } from "@/utils/formatters";

export interface UserFinancialContext {
  userId: string;
  activeWalletBudget: number;
  /** Income received this calendar month (0 when not tracked). */
  monthIncome: number;
  /** `false` when the incomes table is unavailable. */
  incomeTracked: boolean;
  totalSpentThisPeriod: number;
  expensesByCategory: Record<string, number>;
  topCategory: { name: string; amount: number } | null;
  activeGoal: {
    id: string;
    name: string;
    targetAmount: number;
    currentAmount: number;
    targetDate?: string;
    attitude?: string;
  } | null;
  periodStart: string;
  periodEnd: string;
}

export async function fetchUserFinancialContext(
  userId: string
): Promise<UserFinancialContext> {
  const adminClient = createSupabaseAdminClient();

  const { data: profile } = await adminClient
    .from("profiles")
    .select("active_wallet_id")
    .eq("id", userId)
    .maybeSingle();

  let activeWalletBudget = 35000;
  if (profile?.active_wallet_id) {
    const { data: wallet } = await adminClient
      .from("wallets")
      .select("budget")
      .eq("id", profile.active_wallet_id)
      .maybeSingle();
    if (wallet && typeof wallet.budget === "number") {
      activeWalletBudget = Number(wallet.budget);
    }
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const periodStart = startOfMonth.toISOString().slice(0, 10);
  const periodEnd = endOfMonth.toISOString().slice(0, 10);

  const { data: expensesData } = await adminClient
    .from("expenses")
    .select("amount, category_name, spent_on")
    .eq("user_id", userId)
    .gte("spent_on", periodStart)
    .lte("spent_on", periodEnd);

  const expenses = expensesData || [];
  const expensesByCategory: Record<string, number> = {};
  let totalSpentThisPeriod = 0;

  for (const exp of expenses) {
    const amt = toNumber(exp.amount);
    const cat = String(exp.category_name || "Uncategorized");
    expensesByCategory[cat] = (expensesByCategory[cat] || 0) + amt;
    totalSpentThisPeriod += amt;
  }

  let topCategory: { name: string; amount: number } | null = null;
  for (const [name, amount] of Object.entries(expensesByCategory)) {
    if (!topCategory || amount > topCategory.amount) {
      topCategory = { name, amount };
    }
  }

  // A missing incomes table means income is simply not tracked yet.
  let monthIncome = 0;
  let incomeTracked = true;
  const { data: incomesData, error: incomesError } = await adminClient
    .from("incomes")
    .select("amount")
    .eq("user_id", userId)
    .gte("received_on", periodStart)
    .lte("received_on", periodEnd);

  if (incomesError) {
    incomeTracked = false;
  } else {
    for (const row of incomesData || []) {
      monthIncome += toNumber(row.amount);
    }
  }

  const { data: goalsData } = await adminClient
    .from("goals")
    .select("id, goal_name, target_amount, current_amount, target_date, attitude, is_active, completed")
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: false });

  const activeGoalRow =
    (goalsData || []).find((g) => g.is_active && !g.completed) ||
    (goalsData || [])[0] ||
    null;

  const activeGoal = activeGoalRow
    ? {
        id: String(activeGoalRow.id),
        name: String(activeGoalRow.goal_name),
        targetAmount: toNumber(activeGoalRow.target_amount),
        currentAmount: toNumber(activeGoalRow.current_amount),
        targetDate: activeGoalRow.target_date ? String(activeGoalRow.target_date) : undefined,
        attitude: activeGoalRow.attitude ? String(activeGoalRow.attitude) : "Normal",
      }
    : null;

  return {
    userId,
    activeWalletBudget,
    monthIncome,
    incomeTracked,
    totalSpentThisPeriod,
    expensesByCategory,
    topCategory,
    activeGoal,
    periodStart,
    periodEnd,
  };
}

/**
 * The amount this month's spending is measured against: real recorded income
 * when there is any, otherwise the wallet balance as before.
 */
export function getSpendingBase(context: UserFinancialContext) {
  return context.incomeTracked && context.monthIncome > 0
    ? context.monthIncome
    : context.activeWalletBudget;
}

export function generateForecastInsights(context: UserFinancialContext) {
  const { totalSpentThisPeriod, periodStart, periodEnd, activeGoal } = context;
  const spendingBase = getSpendingBase(context);
  const usesIncome = context.incomeTracked && context.monthIncome > 0;

  const now = new Date();
  const start = new Date(periodStart);
  const end = new Date(periodEnd);

  const totalDays = Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1
  );
  const daysPassed = Math.max(1, Math.min(totalDays, now.getDate()));
  const daysRemaining = Math.max(1, totalDays - daysPassed);

  const avgSpentPerDay = totalSpentThisPeriod / daysPassed;
  const projectedTotalSpending = Math.round(
    totalSpentThisPeriod + avgSpentPerDay * daysRemaining
  );
  const projectedSavings = Math.max(0, spendingBase - projectedTotalSpending);

  const dailyForecast: Record<string, number> = {};
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    dailyForecast[dateStr] = Math.round(avgSpentPerDay || spendingBase / totalDays);
  }

  const warnings: string[] = [];
  if (projectedTotalSpending > spendingBase) {
    const deficit = projectedTotalSpending - spendingBase;
    warnings.push(
      `At this pace you'll spend about ${formatCurrency(
        projectedTotalSpending
      )} this month, ${formatCurrency(deficit)} more than your ${
        usesIncome ? "income this month" : "wallet budget"
      }.`
    );
  }

  if (activeGoal && activeGoal.targetDate) {
    const targetDt = new Date(activeGoal.targetDate);
    if (targetDt > now) {
      const daysToGoal = Math.round(
        (targetDt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
      );
      const remainingGoalAmount = Math.max(
        0,
        activeGoal.targetAmount - activeGoal.currentAmount
      );
      const dailyNeeded = remainingGoalAmount / Math.max(1, daysToGoal);
      if (avgSpentPerDay > dailyNeeded * 3) {
        warnings.push(
          `Spending ${formatCurrency(
            avgSpentPerDay
          )} per day makes it hard to save for '${
            activeGoal.name
          }', which needs about ${formatCurrency(dailyNeeded)} per day.`
        );
      }
    }
  }

  const summary =
    warnings.length > 0
      ? `You're spending about ${formatCurrency(
          avgSpentPerDay
        )} per day, which adds up to about ${formatCurrency(
          projectedTotalSpending
        )} by month end. Spend carefully for the rest of the month.`
      : `Your spending is on track at about ${formatCurrency(
          avgSpentPerDay
        )} per day. You should have about ${formatCurrency(
          projectedSavings
        )} left from your ${
          usesIncome ? "income this month" : "wallet budget"
        } at month end.`;

  return {
    periodType: "monthly" as const,
    periodStart,
    periodEnd,
    projectedSpending: projectedTotalSpending,
    projectedSavings,
    aiRecommendedBudget: Math.round(spendingBase * 0.9),
    dailyForecast,
    actualSpendingSnapshot: totalSpentThisPeriod,
    summary,
    warnings,
    confidenceScore: 0.88,
    metadata: {
      avgSpentPerDay,
      daysPassed,
      daysRemaining,
      monthIncome: context.monthIncome,
      incomeTracked: context.incomeTracked,
    },
  };
}
