import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import {
  fetchUserFinancialContext,
  generateAdvisoryInsights,
  generateForecastInsights,
} from "@/utils/aiInsightsGenerator";

export async function GET(req: NextRequest) {
  return handleCronJob(req);
}

export async function POST(req: NextRequest) {
  return handleCronJob(req);
}

async function handleCronJob(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("Authorization");

  // In production, enforce CRON_SECRET verification
  if (cronSecret) {
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json({ error: "Unauthorized cron trigger." }, { status: 401 });
    }
  }

  const startTime = Date.now();
  const adminClient = createSupabaseAdminClient();

  try {
    // 1. Fetch users from profiles
    const { data: profiles, error: profilesError } = await adminClient
      .from("profiles")
      .select("id, username, email");

    if (profilesError) {
      throw new Error(`Failed to list profiles for cron: ${profilesError.message}`);
    }

    const users = profiles || [];
    let succeeded = 0;
    let failed = 0;
    const errors: Array<{ userId: string; error: string }> = [];

    // 2. Process each user
    for (const user of users) {
      try {
        const context = await fetchUserFinancialContext(user.id);

        // A. Generate and save Advisory
        const advisory = generateAdvisoryInsights(context);
        await adminClient.from("ai_advisories").insert({
          user_id: user.id,
          goal_id: context.activeGoal?.id ?? null,
          advisory_type: "weekly_review",
          title: advisory.title,
          suggestion: advisory.suggestion,
          advice: advisory.advice,
          financial_health_score: advisory.financialHealthScore,
          priority: advisory.priority,
          metadata: advisory.metadata,
          generated_by: "cron",
          valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        // B. Generate and save Forecast
        const forecast = generateForecastInsights(context);
        await adminClient.from("ai_forecasts").insert({
          user_id: user.id,
          goal_id: context.activeGoal?.id ?? null,
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
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        succeeded++;
      } catch (userErr: any) {
        failed++;
        errors.push({
          userId: user.id,
          error: userErr?.message || "Unknown error processing user",
        });
      }
    }

    return NextResponse.json({
      success: true,
      totalUsers: users.length,
      succeeded,
      failed,
      errors: errors.slice(0, 5), // Return first 5 errors if any
      durationMs: Date.now() - startTime,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("Critical error in AI insights cron job:", error);
    return NextResponse.json(
      { error: error?.message || "Cron execution failed." },
      { status: 500 }
    );
  }
}
