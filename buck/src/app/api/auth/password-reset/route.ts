import { createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseConfigError,
  supabaseUrl,
} from "@/utils/supabaseConfig";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/utils/supabase/admin";
import {
  getEmailValidationMessage,
  normalizeEmailAddress,
} from "@/utils/emailValidation";

type PasswordResetRequest = {
  email?: unknown;
};

type PasswordResetOutcome =
  | "sent"
  | "not_found"
  | "rate_limited"
  | "provider_error"
  | "lookup_error";

type PasswordResetSecurityContext = {
  emailHash: string;
  ipHash: string;
  normalizedEmail: string;
};

type RateLimitDecision =
  | { limited: false }
  | { limited: true; message: string; retryAfterSeconds: number };

const accountNotFoundMessage =
  "No Buck account exists for that email address.";
const resetRequestMessage = "Password reset link sent. Check your email.";
const passwordResetEventType = "password_reset";
const passwordResetIpWindowMs = 15 * 60 * 1000;
const passwordResetIpLimit = 8;
const passwordResetIpDayWindowMs = 24 * 60 * 60 * 1000;
const passwordResetIpDayLimit = 40;
const passwordResetEmailWindowMs = 60 * 60 * 1000;
const passwordResetEmailLimit = 5;
const passwordResetEmailCooldownMs = 60 * 1000;

function normalizeOrigin(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).origin;
}

function getSiteOrigin(request: Request) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSiteUrl) {
    try {
      return normalizeOrigin(configuredSiteUrl);
    } catch {
      console.warn("NEXT_PUBLIC_SITE_URL is not a valid URL.");
    }
  }

  return new URL(request.url).origin;
}

function getPasswordResetRedirectUrl(request: Request) {
  const params = new URLSearchParams({
    next: "/forgot-password?type=recovery",
  });

  return `${getSiteOrigin(request)}/auth/callback?${params.toString()}`;
}

function getPublicResetError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("rate") ||
    normalizedMessage.includes("too many")
  ) {
    return "Too many reset attempts. Please wait a little while and try again.";
  }

  return "Buck could not send the reset email right now. Please try again later.";
}

function createPasswordResetResponse(
  payload: { success: boolean; message: string },
  init: { status: number; retryAfterSeconds?: number }
) {
  const response = NextResponse.json(payload, { status: init.status });

  response.headers.set("Cache-Control", "no-store, max-age=0");

  if (init.retryAfterSeconds) {
    response.headers.set("Retry-After", String(init.retryAfterSeconds));
  }

  return response;
}

async function readRequestBody(request: Request) {
  try {
    return (await request.json()) as PasswordResetRequest;
  } catch {
    return null;
  }
}

function getClientIp(request: Request) {
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
      "Password reset throttling needs AUTH_RATE_LIMIT_SECRET or SESSION_COOKIE_SECRET."
    );
  }

  return "buck-local-password-reset-rate-limit";
}

function hashIdentifier(value: string) {
  return createHmac("sha256", getRateLimitSecret())
    .update(value)
    .digest("hex");
}

function getPasswordResetSecurityContext(
  request: Request,
  email: string
): PasswordResetSecurityContext {
  const normalizedEmail = normalizeEmailAddress(email);

  return {
    normalizedEmail,
    emailHash: hashIdentifier(`email:${normalizedEmail}`),
    ipHash: hashIdentifier(`ip:${getClientIp(request)}`),
  };
}

function toIsoDate(millisecondsAgo: number) {
  return new Date(Date.now() - millisecondsAgo).toISOString();
}

function getResetLimitMessage(minutes: number) {
  return `Too many reset attempts. Please wait about ${minutes} minute${
    minutes === 1 ? "" : "s"
  } and try again.`;
}

function getRetryAfterSeconds(milliseconds: number) {
  return Math.max(1, Math.ceil(milliseconds / 1000));
}

async function countPasswordResetEvents(
  supabaseAdmin: SupabaseClient,
  filters: { since: string; ipHash?: string; emailHash?: string }
) {
  let query = supabaseAdmin
    .from("auth_security_events")
    .select("id", { count: "exact", head: true })
    .eq("event_type", passwordResetEventType)
    .gte("created_at", filters.since)
    .neq("outcome", "rate_limited");

  if (filters.ipHash) {
    query = query.eq("ip_hash", filters.ipHash);
  }

  if (filters.emailHash) {
    query = query.eq("email_hash", filters.emailHash);
  }

  const { count, error } = await query;

  if (error) {
    throw error;
  }

  return count ?? 0;
}

async function getLatestEmailResetAttemptMs(
  supabaseAdmin: SupabaseClient,
  emailHash: string
) {
  const { data, error } = await supabaseAdmin
    .from("auth_security_events")
    .select("created_at")
    .eq("event_type", passwordResetEventType)
    .eq("email_hash", emailHash)
    .gte("created_at", toIsoDate(passwordResetEmailCooldownMs))
    .neq("outcome", "rate_limited")
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const latestAttempt = data?.[0]?.created_at;

  return typeof latestAttempt === "string" ? Date.parse(latestAttempt) : null;
}

async function getPasswordResetRateLimit(
  supabaseAdmin: SupabaseClient,
  context: PasswordResetSecurityContext
): Promise<RateLimitDecision> {
  const [ipWindowCount, ipDayCount, emailWindowCount, latestEmailAttemptMs] =
    await Promise.all([
      countPasswordResetEvents(supabaseAdmin, {
        ipHash: context.ipHash,
        since: toIsoDate(passwordResetIpWindowMs),
      }),
      countPasswordResetEvents(supabaseAdmin, {
        ipHash: context.ipHash,
        since: toIsoDate(passwordResetIpDayWindowMs),
      }),
      countPasswordResetEvents(supabaseAdmin, {
        emailHash: context.emailHash,
        since: toIsoDate(passwordResetEmailWindowMs),
      }),
      getLatestEmailResetAttemptMs(supabaseAdmin, context.emailHash),
    ]);

  if (ipDayCount >= passwordResetIpDayLimit) {
    return {
      limited: true,
      message: "Too many reset attempts today. Please try again tomorrow.",
      retryAfterSeconds: getRetryAfterSeconds(passwordResetIpDayWindowMs),
    };
  }

  if (ipWindowCount >= passwordResetIpLimit) {
    return {
      limited: true,
      message: getResetLimitMessage(15),
      retryAfterSeconds: getRetryAfterSeconds(passwordResetIpWindowMs),
    };
  }

  if (emailWindowCount >= passwordResetEmailLimit) {
    return {
      limited: true,
      message: getResetLimitMessage(60),
      retryAfterSeconds: getRetryAfterSeconds(passwordResetEmailWindowMs),
    };
  }

  if (latestEmailAttemptMs) {
    const cooldownRemaining =
      passwordResetEmailCooldownMs - (Date.now() - latestEmailAttemptMs);

    if (cooldownRemaining > 0) {
      return {
        limited: true,
        message: getResetLimitMessage(1),
        retryAfterSeconds: getRetryAfterSeconds(cooldownRemaining),
      };
    }
  }

  return { limited: false };
}

async function recordPasswordResetEvent(
  supabaseAdmin: SupabaseClient,
  context: PasswordResetSecurityContext,
  outcome: PasswordResetOutcome
) {
  const { error } = await supabaseAdmin.from("auth_security_events").insert({
    event_type: passwordResetEventType,
    ip_hash: context.ipHash,
    email_hash: context.emailHash,
    outcome,
  });

  if (error) {
    console.warn(
      "Could not record password reset security event:",
      error.message
    );
  }
}

async function findBuckAccountByEmail(
  supabaseAdmin: SupabaseClient,
  email: string
) {
  const normalizedEmail = normalizeEmailAddress(email);
  const emailCandidates = Array.from(new Set([email, normalizedEmail]));
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("email", emailCandidates)
    .limit(1);

  if (error) {
    throw error;
  }

  return Boolean(data?.length);
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return createPasswordResetResponse(
      { success: false, message: supabaseConfigError },
      { status: 500 }
    );
  }

  const body = await readRequestBody(request);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const emailValidationMessage = getEmailValidationMessage(email);

  if (emailValidationMessage) {
    return createPasswordResetResponse(
      { success: false, message: emailValidationMessage },
      { status: 400 }
    );
  }

  if (!isSupabaseAdminConfigured) {
    return createPasswordResetResponse(
      {
        success: false,
        message:
          "Password reset lookup is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
      },
      { status: 500 }
    );
  }

  let securityContext: PasswordResetSecurityContext;
  const supabaseAdmin = createSupabaseAdminClient();

  try {
    securityContext = getPasswordResetSecurityContext(request, email);
  } catch (error) {
    console.error("Password reset throttling is not configured:", error);

    return createPasswordResetResponse(
      {
        success: false,
        message:
          "Password reset security is not configured. Please contact support.",
      },
      { status: 500 }
    );
  }

  try {
    const rateLimit = await getPasswordResetRateLimit(
      supabaseAdmin,
      securityContext
    );

    if (rateLimit.limited) {
      await recordPasswordResetEvent(
        supabaseAdmin,
        securityContext,
        "rate_limited"
      );

      return createPasswordResetResponse(
        { success: false, message: rateLimit.message },
        {
          status: 429,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        }
      );
    }
  } catch (error) {
    console.error("Password reset rate limit failed:", error);

    return createPasswordResetResponse(
      {
        success: false,
        message:
          "Buck could not verify reset limits right now. Please try again later.",
      },
      { status: 502 }
    );
  }

  try {
    const accountExists = await findBuckAccountByEmail(
      supabaseAdmin,
      securityContext.normalizedEmail
    );

    if (!accountExists) {
      await recordPasswordResetEvent(
        supabaseAdmin,
        securityContext,
        "not_found"
      );

      return createPasswordResetResponse(
        { success: false, message: accountNotFoundMessage },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Password reset account lookup failed:", error);
    await recordPasswordResetEvent(
      supabaseAdmin,
      securityContext,
      "lookup_error"
    );

    return createPasswordResetResponse(
      {
        success: false,
        message:
          "Buck could not verify that email right now. Please try again later.",
      },
      { status: 502 }
    );
  }

  const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(
    securityContext.normalizedEmail,
    {
      redirectTo: getPasswordResetRedirectUrl(request),
    }
  );

  if (error) {
    console.error("Password reset request failed:", error.message);
    await recordPasswordResetEvent(
      supabaseAdmin,
      securityContext,
      "provider_error"
    );

    return createPasswordResetResponse(
      { success: false, message: getPublicResetError(error.message) },
      { status: 502 }
    );
  }

  await recordPasswordResetEvent(supabaseAdmin, securityContext, "sent");

  return createPasswordResetResponse(
    {
      success: true,
      message: resetRequestMessage,
    },
    { status: 200 }
  );
}
