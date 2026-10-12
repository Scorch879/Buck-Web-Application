import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { getSessionUserId } from "@/utils/apiAuth";
import {
  fetchUserFinancialContext,
  generateAdvisoryInsights,
} from "@/utils/aiInsightsGenerator";

const REFRESH_COOLDOWN_MS = 60 * 1000;

type RequestBody = {
  forceRefresh?: unknown;
};

export async function POST(req: NextRequest) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "You need to sign in again first." },
        { status: 401 }
      );
    }

    let body: RequestBody = {};
    try {
      const parsed: unknown = await req.json();
      if (parsed && typeof parsed === "object") {
        body = parsed as RequestBody;
      }
    } catch {
      // Empty body is fine; the session identifies the user.
    }

    const forceRefresh = Boolean(body.forceRefresh);
    const adminClient = createSupabaseAdminClient();

    // 1. Check cache. A forced refresh still reuses anything younger than the
    // cooldown so the endpoint cannot be used to flood the table.
    {
      const { data: cached } = await adminClient
        .from("ai_advisories")
        .select("*")
        .eq("user_id", userId)
        .eq("is_dismissed", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cached) {
        const ageMs = Date.now() - new Date(cached.created_at).getTime();
        const maxAgeMs = forceRefresh ? REFRESH_COOLDOWN_MS : 7 * 24 * 60 * 60 * 1000;
        if (ageMs < maxAgeMs) {
          return NextResponse.json({
            id: cached.id,
            title: cached.title,
            suggestion: cached.suggestion,
            advice: cached.advice,
            financialHealthScore: cached.financial_health_score,
            priority: cached.priority,
            createdAt: cached.created_at,
            cached: true,
          });
        }
      }
    }

    // 2. Generate fresh insight
    const context = await fetchUserFinancialContext(userId);
    const insights = generateAdvisoryInsights(context);

    // 3. Persist to ai_advisories
    const { data: saved, error: insertError } = await adminClient
      .from("ai_advisories")
      .insert({
        user_id: userId,
        goal_id: context.activeGoal?.id ?? null,
        advisory_type: "monthly_strategy",
        title: insights.title,
        suggestion: insights.suggestion,
        advice: insights.advice,
        financial_health_score: insights.financialHealthScore,
        priority: insights.priority,
        metadata: insights.metadata,
        generated_by: "on_demand",
        valid_until: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
      })
      .select("*")
      .single();

    if (insertError) {
      console.warn("Could not persist advisory to database:", insertError.message);
    }

    return NextResponse.json({
      id: saved?.id ?? null,
      title: insights.title,
      suggestion: insights.suggestion,
      advice: insights.advice,
      financialHealthScore: insights.financialHealthScore,
      priority: insights.priority,
      createdAt: saved?.created_at ?? new Date().toISOString(),
      cached: false,
    });
  } catch (error) {
    console.error("Error generating AI advice:", error);
    return NextResponse.json(
      { error: "Failed to generate AI advice." },
      { status: 500 }
    );
  }
}
