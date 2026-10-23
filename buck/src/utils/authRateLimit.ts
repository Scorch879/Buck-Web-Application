import { createHmac } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Shared throttling for auth routes (password reset, 2FA recovery). Every
 * identifier is stored as an HMAC in public.auth_security_events, so the log
 * never keeps raw e-mail or IP addresses.
 */

export type SecurityEventType =
  | "password_reset"
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
  | "canceled";

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const candidate =
    forwardedFor?.split(",")[0]?.trim() ||
    request.headers.get("cf-connecting-ip")?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "unknown";

  return candidate.slice(0, 128);
}

export function getRateLimitSecret() {
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

export function toIsoDate(millisecondsAgo: number) {
  return new Date(Date.now() - millisecondsAgo).toISOString();
}

export function getRetryAfterSeconds(milliseconds: number) {
  return Math.max(1, Math.ceil(milliseconds / 1000));
}

/** Counts events in a window; filters combine with AND. */
export async function countSecurityEvents(
  supabaseAdmin: SupabaseClient,
  filters: {
    eventType: SecurityEventType;
    since: string;
    userId?: string;
    ipHash?: string;
    outcomes?: SecurityEventOutcome[];
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

  if (filters.outcomes?.length) {
    query = query.in("outcome", filters.outcomes);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
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
