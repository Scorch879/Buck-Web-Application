import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { isBearerAuthorized } from "@/utils/secureCompare";
import {
  fetchUserFinancialContext,
  generateForecastInsights,
} from "@/utils/aiInsightsGenerator";

export const maxDuration = 300;

const USER_BATCH_SIZE = 5;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: NextRequest) {
  return handleCronJob(req);
}

export async function POST(req: NextRequest) {
  return handleCronJob(req);
}

async function processUser(
  adminClient: ReturnType<typeof createSupabaseAdminClient>,
  userId: string
) {
  // Advice is generated on demand by Buck_AI's AI Financial Advisor (saved in
  // ai_advisories and refreshed when the data changes), so the cron only
  // refreshes the rule-based forecast.
  const context = await fetchUserFinancialContext(userId);
  const goalId = context.activeGoal?.id ?? null;

  const forecast = generateForecastInsights(context);
  const { error: forecastError } = await adminClient.from("ai_forecasts").insert({
    user_id: userId,
    goal_id: goalId,
    period_type: forecast.periodType,
    period_start: forecast.periodStart,
    period_end: forecast.periodEnd,
    projected_spending: forecast.projectedSpending,
    projected_savings: forecast.projectedSavings,
    ai_recommended_budget: forecast.aiRecommendedBudget,
    daily_forecast: forecast.dailyForecast,
    actual_spending_snapshot: forecast.actualSpendingSnapshot,
    summary: forecast.summary,
    warnings: forecast.warnings,
    confidence_score: forecast.confidenceScore,
    generated_by: "cron",
    metadata: forecast.metadata,
    expires_at: new Date(Date.now() + WEEK_MS).toISOString(),
  });

  if (forecastError) {
    throw new Error(`forecast insert: ${forecastError.message}`);
  }
}

async function handleCronJob(req: NextRequest) {
  // Fail closed: without CRON_SECRET the endpoint is never runnable.
  if (!isBearerAuthorized(req.headers.get("Authorization"), process.env.CRON_SECRET)) {
    return NextResponse.json({ error: "Unauthorized cron trigger." }, { status: 401 });
  }

  const startTime = Date.now();
  const adminClient = createSupabaseAdminClient();

  try {
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id");

    if (profilesError) {
      throw new Error(`Failed to list profiles for cron: ${profilesError.message}`);
    }

    const users = profiles || [];
    let succeeded = 0;
    let failed = 0;

    // Bounded parallelism: one user's failure never blocks the others.
    for (let i = 0; i < users.length; i += USER_BATCH_SIZE) {
      const batch = users.slice(i, i + USER_BATCH_SIZE);
      const results = await Promise.allSettled(
        batch.map((user) => processUser(adminClient, String(user.id)))
      );

      results.forEach((result, index) => {
        if (result.status === "fulfilled") {
          succeeded++;
          return;
        }

        failed++;
        console.error(
          `AI insights cron failed for user ${batch[index].id}:`,
          result.reason
        );
      });
    }

    return NextResponse.json({
      success: true,
      totalUsers: users.length,
      succeeded,
      failed,
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Critical error in AI insights cron job:", error);
    return NextResponse.json({ error: "Cron execution failed." }, { status: 500 });
  }
}
