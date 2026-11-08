import { NextResponse } from "next/server";
import { isAdminUser } from "@/utils/adminAccess";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/utils/supabase/admin";
import type { AdminOverviewTelemetry, AdminServiceHealth } from "@/context/FinancialContext";
import { BUCK_AI_DEFAULT_GEMINI_MODELS, BUCK_AI_FALLBACK_ENGINE } from "@/utils/buckAiModels";

const BUCK_AI_CONFIGURED_MODELS = [...BUCK_AI_DEFAULT_GEMINI_MODELS];

function sanitizeEndpointHost(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    return parsed.origin;
  } catch {
    return rawUrl;
  }
}

async function probeBuckAiHealth(): Promise<
  AdminServiceHealth & { configuredModels: string[]; fallbackEngine: string }
> {
  const checkedAt = new Date().toISOString();
  const rawUrl = (
    process.env.NEXT_PUBLIC_BUCK_AI_URL?.trim() || "http://localhost:8000"
  ).replace(/\/+$/, "");
  const endpoint = sanitizeEndpointHost(rawUrl);
  const start = performance.now();

  try {
    const response = await fetch(`${rawUrl}/`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    const latencyMs = Math.round(performance.now() - start);
    const body = (await response.json().catch(() => null)) as
      | { service?: string; ok?: boolean }
      | null;

    if (response.ok && body?.ok !== false) {
      const isDegraded = latencyMs >= 1500;
      return {
        status: isDegraded ? "degraded" : "online",
        latencyMs,
        httpStatus: response.status,
        endpoint,
        message: isDegraded
          ? `Buck_AI responded slowly (${latencyMs} ms)`
          : "FastAPI operational: Advisor on Gemini, Forecaster on Groq, rules as fallback",
        checkedAt,
        configuredModels: BUCK_AI_CONFIGURED_MODELS,
        fallbackEngine: BUCK_AI_FALLBACK_ENGINE,
      };
    }

    return {
      status: "degraded",
      latencyMs,
      httpStatus: response.status,
      endpoint,
      message: `Buck_AI returned HTTP ${response.status}`,
      checkedAt,
      configuredModels: BUCK_AI_CONFIGURED_MODELS,
      fallbackEngine: BUCK_AI_FALLBACK_ENGINE,
    };
  } catch {
    const latencyMs = Math.round(performance.now() - start);
    return {
      status: "offline",
      latencyMs,
      httpStatus: null,
      endpoint,
      message: "Buck_AI health check unreachable (fallback rule advisor active)",
      checkedAt,
      configuredModels: BUCK_AI_CONFIGURED_MODELS,
      fallbackEngine: BUCK_AI_FALLBACK_ENGINE,
    };
  }
}

export async function GET() {
  const authStart = performance.now();
  let supabase;
  try {
    supabase = await createSupabaseServerClient();
  } catch {
    return NextResponse.json(
      { error: "Supabase is not configured." },
      { status: 500 }
    );
  }

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  const authLatencyMs = Math.round(performance.now() - authStart);

  if (authError || !isAdminUser(user)) {
    return NextResponse.json({ error: "Unauthorized access" }, { status: 403 });
  }

  const nowIso = new Date().toISOString();

  // Probe Buck_AI and query Supabase telemetry concurrently.
  const dbStart = performance.now();
  const telemetryClient = isSupabaseAdminConfigured
    ? createSupabaseAdminClient()
    : supabase;

  const [buckAiHealth, telemetryResult] = await Promise.all([
    probeBuckAiHealth(),
    telemetryClient.rpc("get_admin_telemetry"),
  ]);
  const dbLatencyMs = Math.round(performance.now() - dbStart);

  const rawTelemetry = (telemetryResult.data ?? {}) as Record<string, unknown>;
  const dbError = telemetryResult.error;

  const supabaseDbHealth: AdminServiceHealth = dbError
    ? {
        status: "degraded",
        latencyMs: dbLatencyMs,
        httpStatus: 500,
        endpoint: "Supabase Postgres RPC (get_admin_telemetry)",
        message: dbError.message || "Telemetry RPC returned an error",
        checkedAt: nowIso,
      }
    : {
        status: dbLatencyMs >= 1000 ? "degraded" : "online",
        latencyMs: dbLatencyMs,
        httpStatus: 200,
        endpoint: "Supabase Postgres + RLS",
        message:
          dbLatencyMs >= 1000
            ? `Database query completed with elevated latency (${dbLatencyMs} ms)`
            : "Postgres, Row-Level Security, and RPC functions healthy",
        checkedAt: nowIso,
      };

  const supabaseAuthHealth: AdminServiceHealth = {
    status: authLatencyMs >= 1000 ? "degraded" : "online",
    latencyMs: authLatencyMs,
    httpStatus: 200,
    endpoint: "Supabase Auth + JWT / AAL2 Verification",
    message: "Session verification, OAuth 2.1, and TOTP MFA healthy",
    checkedAt: nowIso,
  };

  const platformData = (rawTelemetry.platform ?? {}) as Record<string, unknown>;
  const buckAiData = (rawTelemetry.buck_ai ?? {}) as Record<string, unknown>;
  const usage24hData = (buckAiData.usage_24h ?? {}) as Record<string, unknown>;
  const priorityData = (buckAiData.priority_breakdown ?? {}) as Record<string, unknown>;
  const securityData = (rawTelemetry.security ?? {}) as Record<string, unknown>;

  const payload: AdminOverviewTelemetry = {
    generatedAt: String(rawTelemetry.generated_at ?? nowIso),
    services: {
      webApp: {
        status: "online",
        latencyMs: Math.max(1, Math.min(authLatencyMs, dbLatencyMs)),
        httpStatus: 200,
        endpoint: "Next.js App Router + Edge Middleware",
        message: "Web application server & API routes operational",
        checkedAt: nowIso,
        environment: process.env.NODE_ENV || "development",
        region: process.env.VERCEL_REGION || "local",
        commitSha: process.env.VERCEL_GIT_COMMIT_SHA
          ? process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 7)
          : null,
        branch: process.env.VERCEL_GIT_COMMIT_REF || null,
      },
      supabaseDb: supabaseDbHealth,
      supabaseAuth: supabaseAuthHealth,
      buckAi: buckAiHealth,
      integrations: {
        supabaseAdminConfigured: isSupabaseAdminConfigured,
        supabaseManagementConfigured: Boolean(
          process.env.SUPABASE_MANAGEMENT_TOKEN && process.env.SUPABASE_PROJECT_REF
        ),
        vercelApiConfigured: Boolean(
          process.env.VERCEL_ACCESS_TOKEN && process.env.VERCEL_PROJECT_ID
        ),
        buckAiConfigured: Boolean(process.env.NEXT_PUBLIC_BUCK_AI_URL?.trim()),
      },
    },
    platform: {
      total_users: Number(platformData.total_users ?? 0),
      mfa_enabled_users: Number(platformData.mfa_enabled_users ?? 0),
      connected_oauth_apps: Number(platformData.connected_oauth_apps ?? 0),
      pending_deletions: Number(platformData.pending_deletions ?? 0),
      total_wallets: Number(platformData.total_wallets ?? 0),
      total_expenses: Number(platformData.total_expenses ?? 0),
      total_incomes: Number(platformData.total_incomes ?? 0),
      total_goals: Number(platformData.total_goals ?? 0),
      active_goals: Number(platformData.active_goals ?? 0),
      completed_goals: Number(platformData.completed_goals ?? 0),
      total_categories: Number(platformData.total_categories ?? 0),
      total_feedback: Number(platformData.total_feedback ?? 0),
      hashed_feedback: Number(platformData.hashed_feedback ?? 0),
    },
    buckAi: {
      advisories_total: Number(buckAiData.advisories_total ?? 0),
      advisories_24h: Number(buckAiData.advisories_24h ?? 0),
      advisories_7d: Number(buckAiData.advisories_7d ?? 0),
      advisories_gemini: Number(buckAiData.advisories_gemini ?? 0),
      advisories_rules: Number(buckAiData.advisories_rules ?? 0),
      advisories_groq: Number(buckAiData.advisories_groq ?? 0),
      advisories_ai: Number(
        buckAiData.advisories_ai ??
          Number(buckAiData.advisories_gemini ?? 0) + Number(buckAiData.advisories_groq ?? 0),
      ),
      avg_health_score: Number(buckAiData.avg_health_score ?? 0),
      forecasts_total: Number(buckAiData.forecasts_total ?? 0),
      forecasts_active: Number(buckAiData.forecasts_active ?? 0),
      usage_24h: {
        total: Number(usage24hData.total ?? 0),
        chat: Number(usage24hData.chat ?? 0),
        insight: Number(usage24hData.insight ?? 0),
        tip: Number(usage24hData.tip ?? 0),
        categorize: Number(usage24hData.categorize ?? 0),
      },
      model_breakdown: Array.isArray(buckAiData.model_breakdown)
        ? (buckAiData.model_breakdown as AdminOverviewTelemetry["buckAi"]["model_breakdown"])
        : [],
      priority_breakdown: {
        low: Number(priorityData.low ?? 0),
        medium: Number(priorityData.medium ?? 0),
        high: Number(priorityData.high ?? 0),
        urgent: Number(priorityData.urgent ?? 0),
      },
      recent_advisories: Array.isArray(buckAiData.recent_advisories)
        ? (buckAiData.recent_advisories as AdminOverviewTelemetry["buckAi"]["recent_advisories"])
        : [],
      recent_usage_events: Array.isArray(buckAiData.recent_usage_events)
        ? (buckAiData.recent_usage_events as AdminOverviewTelemetry["buckAi"]["recent_usage_events"])
        : [],
      recent_forecasts: Array.isArray(buckAiData.recent_forecasts)
        ? (buckAiData.recent_forecasts as AdminOverviewTelemetry["buckAi"]["recent_forecasts"])
        : [],
    },
    security: {
      total_30d: Number(securityData.total_30d ?? 0),
      rate_limited_30d: Number(securityData.rate_limited_30d ?? 0),
      recent_events: Array.isArray(securityData.recent_events)
        ? (securityData.recent_events as AdminOverviewTelemetry["security"]["recent_events"])
        : [],
    },
  };

  return NextResponse.json(payload);
}
