import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import {
  fetchUserFinancialContext,
  generateForecastInsights,
} from "@/utils/aiInsightsGenerator";

export async function POST(req: NextRequest) {
  try {
    let body: any = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is okay if session exists
    }

    let userId = body.userId;
    if (!userId) {
      try {
        const supabase = await createSupabaseServerClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          userId = user.id;
        }
      } catch {
        // Fallback to body or unauthenticated
      }
    }

    if (!userId) {
      return NextResponse.json(
        { error: "User ID is required to fetch or generate forecast insights." },
        { status: 400 }
      );
    }

    const forceRefresh = Boolean(body.forceRefresh);
    const periodType = body.periodType || "monthly";
    const adminClient = createSupabaseAdminClient();

    // 1. Check cache if not forcing refresh
    if (!forceRefresh) {
      const { data: cached } = await adminClient
        .from("ai_forecasts")
        .select("*")
        .eq("user_id", userId)
        .eq("period_type", periodType)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        const ageMs = Date.now() - new Date(cached.created_at).getTime();
        const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
        if (ageMs < maxAgeMs) {
          return NextResponse.json({
            id: cached.id,
            summary: cached.summary,
            projectedSpending: Number(cached.projected_spending),
            projectedSavings: Number(cached.projected_savings),
            aiRecommendedBudget: cached.ai_recommended_budget
              ? Number(cached.ai_recommended_budget)
              : null,
            warnings: Array.isArray(cached.warnings) ? cached.warnings : [],
            dailyForecast: cached.daily_forecast || {},
            actualSpendingSnapshot: Number(cached.actual_spending_snapshot),
            periodStart: cached.period_start,
            periodEnd: cached.period_end,
            createdAt: cached.created_at,
            cached: true,
          });
        }
      }
    }

    // 2. Generate fresh forecast
    const context = await fetchUserFinancialContext(userId);
    const forecast = generateForecastInsights(context);

    // 3. Persist to ai_forecasts
    const { data: saved, error: insertError } = await adminClient
      .from("ai_forecasts")
      .insert({
        user_id: userId,
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
        generated_by: "on_demand",
        metadata: forecast.metadata,
        expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("*")
      .single();

    if (insertError) {
      console.warn("Could not persist forecast to database:", insertError.message);
    }

    return NextResponse.json({
      id: saved?.id ?? null,
      summary: forecast.summary,
      projectedSpending: forecast.projectedSpending,
      projectedSavings: forecast.projectedSavings,
      aiRecommendedBudget: forecast.aiRecommendedBudget,
      warnings: forecast.warnings,
      dailyForecast: forecast.dailyForecast,
      actualSpendingSnapshot: forecast.actualSpendingSnapshot,
      periodStart: forecast.periodStart,
      periodEnd: forecast.periodEnd,
      createdAt: saved?.created_at ?? new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error("Error generating AI forecast:", error);
    return NextResponse.json(
      { error: "Failed to generate AI forecast." },
      { status: 500 }
    );
  }
}
