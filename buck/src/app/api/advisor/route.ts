import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import {
  fetchUserFinancialContext,
  generateAdvisoryInsights,
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
        { error: "User ID is required to fetch or generate advisory insights." },
        { status: 400 }
      );
    }

    const forceRefresh = Boolean(body.forceRefresh);
    const adminClient = createSupabaseAdminClient();

    // 1. Check cache if not forcing refresh
    if (!forceRefresh) {
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
        const maxAgeMs = 7 * 24 * 60 * 60 * 1000; // 7 days
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
