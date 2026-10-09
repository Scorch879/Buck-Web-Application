import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { formatCurrency, toNumber } from "@/utils/formatters";

export interface UserFinancialContext {
  userId: string;
  activeWalletBudget: number;
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

  // 1. Get active wallet
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

  // 2. Determine current calendar month boundaries
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const periodStart = startOfMonth.toISOString().slice(0, 10);
  const periodEnd = endOfMonth.toISOString().slice(0, 10);

  // 3. Fetch expenses for the current month
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

  // 4. Fetch active goal
  const { data: goalsData } = await adminClient
    .from("goals")
    .select("id, goal_name, target_amount, current_amount, target_date, attitude, is_active, completed")
    .eq("user_id", userId)
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
    totalSpentThisPeriod,
    expensesByCategory,
    topCategory,
    activeGoal,
    periodStart,
    periodEnd,
  };
}

export function generateAdvisoryInsights(context: UserFinancialContext) {
  const {
    activeWalletBudget,
    totalSpentThisPeriod,
    topCategory,
    activeGoal,
  } = context;

  // Calculate financial health score (0 - 100)
  const remainingBudget = Math.max(0, activeWalletBudget - totalSpentThisPeriod);
  const spendRatio =
    activeWalletBudget > 0 ? totalSpentThisPeriod / activeWalletBudget : 0.5;

  let healthScore = 75;
  if (spendRatio < 0.5) {
    healthScore = 90;
  } else if (spendRatio < 0.8) {
    healthScore = 78;
  } else if (spendRatio <= 1.0) {
    healthScore = 62;
  } else {
    healthScore = Math.max(20, Math.round(50 - (spendRatio - 1.0) * 40));
  }

  // Multiplier from attitude
  const attitude = activeGoal?.attitude || "Normal";
  const multiplier =
    attitude === "Aggressive" ? 0.6 : attitude === "Moderate" ? 0.8 : 1.0;

  // Construct suggestion & advice
  let title = "Monthly Budget Assessment";
  let suggestion = "Maintain your current spending discipline to protect your wallet buffer.";
  let advice = `You have remaining wallet room of ${formatCurrency(
    remainingBudget
  )}. Allocate at least 15% towards your savings reserve before discretionary shopping.`;
  let priority: "low" | "medium" | "high" | "urgent" = "medium";

  if (spendRatio > 0.9) {
    priority = spendRatio > 1.0 ? "urgent" : "high";
    title = "Budget Threshold Alert";
    suggestion = `Critical: You have utilized ${Math.round(
      spendRatio * 100
    )}% of your monthly budget. Pause all non-essential purchases immediately.`;
    advice = `Your current burn rate exceeds sustainable limits for this period. Freeze discretionary spending on ${
      topCategory?.name || "entertainment and leisure"
    } to avoid deficit borrowing.`;
  } else if (topCategory && topCategory.amount > activeWalletBudget * 0.35) {
    priority = "high";
    title = `High Expenditure on ${topCategory.name}`;
    suggestion = `Your highest expense driver is ${topCategory.name} at ${formatCurrency(
      topCategory.amount
    )}. Target a 15% reduction next week.`;
    const recommendedCap = Math.round(topCategory.amount * multiplier * 0.8);
    advice = `Based on your ${attitude} saving profile, limit ${topCategory.name} spending to ${formatCurrency(
      recommendedCap
    )} for the remainder of this cycle to ensure your primary goal stays funded.`;
  } else if (activeGoal) {
    title = `Goal Progress: ${activeGoal.name}`;
    const needed = Math.max(0, activeGoal.targetAmount - activeGoal.currentAmount);
    suggestion = `To hit '${activeGoal.name}', you have ${formatCurrency(
      needed
    )} remaining to reach your target.`;
    advice = `Transferring ${formatCurrency(
      Math.round((needed / 4) * multiplier)
    )} weekly into your dedicated goal allocation will keep you on track without straining your daily living allowance.`;
  }

  return {
    title,
    suggestion,
    advice,
    financialHealthScore: healthScore,
    priority,
    metadata: {
      spendRatio,
      multiplier,
      topCategory: topCategory?.name ?? null,
      remainingBudget,
    },
  };
}

export function generateForecastInsights(context: UserFinancialContext) {
  const {
    activeWalletBudget,
    totalSpentThisPeriod,
    periodStart,
    periodEnd,
    activeGoal,
  } = context;

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
  const projectedSavings = Math.max(0, activeWalletBudget - projectedTotalSpending);

  // Daily forecast distribution
  const dailyForecast: Record<string, number> = {};
  for (let i = 0; i < totalDays; i++) {
    const d = new Date(start);
    d.setDate(d.getDate() + i);
    const dateStr = d.toISOString().slice(0, 10);
    // Baseline projected daily expense
    dailyForecast[dateStr] = Math.round(avgSpentPerDay || activeWalletBudget / totalDays);
  }

  const warnings: string[] = [];
  if (projectedTotalSpending > activeWalletBudget) {
    const deficit = projectedTotalSpending - activeWalletBudget;
    warnings.push(
      `Projected monthly expenditure (${formatCurrency(
        projectedTotalSpending
      )}) will exceed your wallet budget by ${formatCurrency(deficit)}.`
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
          `Current daily spend of ${formatCurrency(
            avgSpentPerDay
          )} reduces savings speed required for '${activeGoal.name}'.`
        );
      }
    }
  }

  const summary =
    warnings.length > 0
      ? `Based on your average burn rate of ${formatCurrency(
          avgSpentPerDay
        )} per day, your projected month-end spending is ${formatCurrency(
          projectedTotalSpending
        )}. Exercise cautious budgeting to prevent budget overruns.`
      : `Your spending pace is healthy at ${formatCurrency(
          avgSpentPerDay
        )} per day. You are on track to preserve ${formatCurrency(
          projectedSavings
        )} in net wallet savings by month-end.`;

  return {
    periodType: "monthly" as const,
    periodStart,
    periodEnd,
    projectedSpending: projectedTotalSpending,
    projectedSavings,
    aiRecommendedBudget: Math.round(activeWalletBudget * 0.9),
    dailyForecast,
    actualSpendingSnapshot: totalSpentThisPeriod,
    summary,
    warnings,
    confidenceScore: 0.88,
    metadata: {
      avgSpentPerDay,
      daysPassed,
      daysRemaining,
    },
  };
}
