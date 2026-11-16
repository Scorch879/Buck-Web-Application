import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared throttling for auth routes (password reset, sign-up, resend
 * confirmation, 2FA recovery). Every identifier is stored as an HMAC in
 * public.auth_security_events, so the log never keeps raw email or IP
 * addresses.
 */

export type SecurityEventType =
  | "password_reset"
  | "sign_up"
  | "resend_confirmation"
  | "mfa_recovery_code"
  | "mfa_recovery_codes_generated"
  | "mfa_email_recovery"
  | "mfa_reset_admin";

export type SecurityEventOutcome =
  | "sent"
  | "not_found"
  | "rate_limited"
  | "provider_error"
  | "lookup_error"
  | "success"
  | "invalid"
  | "expired"
  | "confirmed"
  | "canceled"
  | "blocked_provider"
  | "already_exists";

export type EmailActionSecurityContext = {
  emailHash: string;
  ipHash: string;
  normalizedEmail: string;
};

export type EmailActionRateLimitConfig = {
  eventType: Extract<
    SecurityEventType,
    "password_reset" | "sign_up" | "resend_confirmation"
  >;
  ipWindowMs: number;
  ipLimit: number;
  ipDayWindowMs: number;
  ipDayLimit: number;
  emailWindowMs: number;
  emailLimit: number;
  emailCooldownMs: number;
  cooldownOutcomes?: SecurityEventOutcome[];
  actionNoun?: string;
};

export type RateLimitDecision =
  | { limited: false }
  | { limited: true; message: string; retryAfterSeconds: number };

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const candidate =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";

  return candidate.slice(0, 128);
}

function getRateLimitSecret() {
  const secret =
    process.env.AUTH_RATE_LIMIT_SECRET?.trim() ||
    process.env.SESSION_COOKIE_SECRET?.trim();

  if (secret) {
    return secret;
  }

  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "Auth throttling needs AUTH_RATE_LIMIT_SECRET or SESSION_COOKIE_SECRET."
    );
  }

  return "buck-local-password-reset-rate-limit";
}

export function hashIdentifier(value: string) {
  return createHmac("sha256", getRateLimitSecret())
    .update(value)
    .digest("hex");
}

export function hashClientIp(request: Request) {
  return hashIdentifier(`ip:${getClientIp(request)}`);
}

export function getEmailActionSecurityContext(
  request: Request,
  normalizedEmail: string
): EmailActionSecurityContext {
  return {
    normalizedEmail,
    emailHash: hashIdentifier(`email:${normalizedEmail}`),
    ipHash: hashClientIp(request),
  };
}

export function toIsoDate(millisecondsAgo: number) {
  return new Date(Date.now() - millisecondsAgo).toISOString();
}

export function getRetryAfterSeconds(milliseconds: number) {
  return Math.max(1, Math.ceil(milliseconds / 1000));
}

export function createAuthJsonResponse<T extends Record<string, unknown>>(
  payload: T,
  init: { status: number; retryAfterSeconds?: number }
) {
  const response = NextResponse.json(payload, { status: init.status });

  response.headers.set("Cache-Control", "no-store, max-age=0");

  if (init.retryAfterSeconds) {
    response.headers.set("Retry-After", String(init.retryAfterSeconds));
  }

  return response;
}

/** Counts events in a window; filters combine with AND. */
export async function countSecurityEvents(
  supabaseAdmin: SupabaseClient,
  filters: {
    eventType: SecurityEventType;
    since: string;
    userId?: string;
    ipHash?: string;
    emailHash?: string;
    outcomes?: SecurityEventOutcome[];
    excludeOutcomes?: SecurityEventOutcome[];
  }
) {
  let query = supabaseAdmin
    .from("auth_security_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", filters.eventType)
    .gte("created_at", filters.since);

  if (filters.userId) {
    query = query.eq("user_id", filters.userId);
  }

  if (filters.ipHash) {
    query = query.eq("ip_hash", filters.ipHash);
  }

  if (filters.emailHash) {
    query = query.eq("email_hash", filters.emailHash);
  }

  if (filters.outcomes?.length) {
    query = query.in("outcome", filters.outcomes);
  }

  if (filters.excludeOutcomes?.length) {
    for (const outcome of filters.excludeOutcomes) {
      query = query.neq("outcome", outcome);
    }
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

export async function getLatestEmailSecurityEventMs(
  supabaseAdmin: SupabaseClient,
  filters: {
    eventType: SecurityEventType;
    emailHash: string;
    since: string;
    outcomes?: SecurityEventOutcome[];
    excludeOutcomes?: SecurityEventOutcome[];
  }
) {
  let query = supabaseAdmin
    .from("auth_security_events")
    .select("created_at")
    .eq("event_type", filters.eventType)
    .eq("email_hash", filters.emailHash)
    .gte("created_at", filters.since);

  if (filters.outcomes?.length) {
    query = query.in("outcome", filters.outcomes);
  }

  if (filters.excludeOutcomes?.length) {
    for (const outcome of filters.excludeOutcomes) {
      query = query.neq("outcome", outcome);
    }
  }

  const { data, error } = await query
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const latestAttempt = data?.[0]?.created_at;

  return typeof latestAttempt === "string" ? Date.parse(latestAttempt) : null;
}

function getCooldownLimitMessage(minutes: number, noun: string) {
  return `Too many ${noun} attempts. Please wait about ${minutes} minute${
    minutes === 1 ? "" : "s"
  } and try again.`;
}

export async function checkEmailActionRateLimit(
  supabaseAdmin: SupabaseClient,
  context: EmailActionSecurityContext,
  config: EmailActionRateLimitConfig
): Promise<RateLimitDecision> {
  const noun = config.actionNoun ?? "auth";
  const [ipWindowCount, ipDayCount, emailWindowCount, latestEmailAttemptMs] =
    await Promise.all([
      countSecurityEvents(supabaseAdmin, {
        eventType: config.eventType,
        ipHash: context.ipHash,
        since: toIsoDate(config.ipWindowMs),
        excludeOutcomes: ["rate_limited"],
      }),
      countSecurityEvents(supabaseAdmin, {
        eventType: config.eventType,
        ipHash: context.ipHash,
        since: toIsoDate(config.ipDayWindowMs),
        excludeOutcomes: ["rate_limited"],
      }),
      countSecurityEvents(supabaseAdmin, {
        eventType: config.eventType,
        emailHash: context.emailHash,
        since: toIsoDate(config.emailWindowMs),
        excludeOutcomes: ["rate_limited"],
      }),
      getLatestEmailSecurityEventMs(supabaseAdmin, {
        eventType: config.eventType,
        emailHash: context.emailHash,
        since: toIsoDate(config.emailCooldownMs),
        ...(config.cooldownOutcomes?.length
          ? { outcomes: config.cooldownOutcomes }
          : { excludeOutcomes: ["rate_limited"] }),
      }),
    ]);

  if (ipDayCount >= config.ipDayLimit) {
    return {
      limited: true,
      message: `Too many ${noun} attempts today. Please try again tomorrow.`,
      retryAfterSeconds: getRetryAfterSeconds(config.ipDayWindowMs),
    };
  }

  if (ipWindowCount >= config.ipLimit) {
    return {
      limited: true,
      message: getCooldownLimitMessage(
        Math.max(1, Math.round(config.ipWindowMs / 60000)),
        noun
      ),
      retryAfterSeconds: getRetryAfterSeconds(config.ipWindowMs),
    };
  }

  if (emailWindowCount >= config.emailLimit) {
    return {
      limited: true,
      message: getCooldownLimitMessage(
        Math.max(1, Math.round(config.emailWindowMs / 60000)),
        noun
      ),
      retryAfterSeconds: getRetryAfterSeconds(config.emailWindowMs),
    };
  }

  if (latestEmailAttemptMs) {
    const cooldownRemaining =
      config.emailCooldownMs - (Date.now() - latestEmailAttemptMs);

    if (cooldownRemaining > 0) {
      return {
        limited: true,
        message: getCooldownLimitMessage(1, noun),
        retryAfterSeconds: getRetryAfterSeconds(cooldownRemaining),
      };
    }
  }

  return { limited: false };
}

/** Best effort: a failed write is logged, never surfaced to the caller. */
export async function recordSecurityEvent(
  supabaseAdmin: SupabaseClient,
  event: {
    eventType: SecurityEventType;
    outcome: SecurityEventOutcome;
    ipHash: string;
    userId?: string;
    emailHash?: string;
  }
) {
  const { error } = await supabaseAdmin.from("auth_security_events").insert({
    event_type: event.eventType,
    outcome: event.outcome,
    ip_hash: event.ipHash,
    user_id: event.userId ?? null,
    email_hash: event.emailHash ?? null,
  });

  if (error) {
    console.warn(`Could not record ${event.eventType} security event:`, error.message);
  }
}
