import { getSiteOrigin } from "@/utils/httpResponse";
import { createSupabaseStatelessClient } from "@/utils/supabase/stateless";
import {
  isSupabaseConfigured,
  supabaseConfigError,
} from "@/utils/supabaseConfig";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/utils/supabase/admin";
import {
  getEmailValidationMessage,
  normalizeEmailAddress,
} from "@/utils/emailValidation";
import {
  checkEmailActionRateLimit,
  createAuthJsonResponse,
  getEmailActionSecurityContext,
  recordSecurityEvent,
  type EmailActionRateLimitConfig,
  type EmailActionSecurityContext,
  type SecurityEventOutcome,
} from "@/utils/authRateLimit";
import {
  getAuthAccountCapabilitiesByEmail,
  isGoogleOnlyConflict,
} from "@/utils/authCapabilities";

type ResendConfirmationRequest = {
  email?: unknown;
};

const RESEND_CONFIRMATION_LIMITS: EmailActionRateLimitConfig = {
  eventType: "resend_confirmation",
  ipWindowMs: 15 * 60 * 1000,
  ipLimit: 8,
  ipDayWindowMs: 24 * 60 * 60 * 1000,
  ipDayLimit: 40,
  emailWindowMs: 60 * 60 * 1000,
  emailLimit: 5,
  emailCooldownMs: 60 * 1000,
  // Same cooldown whatever the account state, so a quick second try can't
  // tell an unverified account from an unknown or verified one (SEC-046).
  cooldownOutcomes: ["sent", "not_found", "already_exists", "blocked_provider", "provider_error"],
  actionNoun: "confirmation",
};

const RESEND_NEUTRAL_MESSAGE =
  "If an unverified Buck account exists for that email, a confirmation email is on its way.";

function getSignUpCallbackUrl(request: Request) {
  const params = new URLSearchParams({ next: "/dashboard/home" });
  return `${getSiteOrigin(request)}/auth/callback?${params.toString()}`;
}

async function readRequestBody(request: Request) {
  try {
    return (await request.json()) as ResendConfirmationRequest;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return createAuthJsonResponse(
      { success: false, message: supabaseConfigError },
      { status: 500 }
    );
  }

  if (!isSupabaseAdminConfigured) {
    return createAuthJsonResponse(
      {
        success: false,
        message:
          "Confirmation lookup is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
      },
      { status: 500 }
    );
  }

  const body = await readRequestBody(request);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const normalizedEmail = normalizeEmailAddress(email);
  const emailValidationMessage = getEmailValidationMessage(normalizedEmail);

  if (emailValidationMessage) {
    return createAuthJsonResponse(
      { success: false, message: emailValidationMessage },
      { status: 400 }
    );
  }

  let securityContext: EmailActionSecurityContext;
  const supabaseAdmin = createSupabaseAdminClient();

  try {
    securityContext = getEmailActionSecurityContext(request, normalizedEmail);
  } catch (error) {
    console.error("Resend confirmation throttling is not configured:", error);

    return createAuthJsonResponse(
      {
        success: false,
        message:
          "Confirmation throttling is not configured. Please contact support.",
      },
      { status: 500 }
    );
  }

  try {
    const rateLimit = await checkEmailActionRateLimit(
      supabaseAdmin,
      securityContext,
      RESEND_CONFIRMATION_LIMITS
    );

    if (rateLimit.limited) {
      await recordSecurityEvent(supabaseAdmin, {
        eventType: "resend_confirmation",
        ipHash: securityContext.ipHash,
        emailHash: securityContext.emailHash,
        outcome: "rate_limited",
      });

      return createAuthJsonResponse(
        {
          success: false,
          errorCode: "rate_limited",
          message: rateLimit.message,
        },
        {
          status: 429,
          retryAfterSeconds: rateLimit.retryAfterSeconds,
        }
      );
    }
  } catch (error) {
    console.error("Resend confirmation rate limit failed:", error);

    return createAuthJsonResponse(
      {
        success: false,
        message:
          "Buck could not verify confirmation limits right now. Please try again later.",
      },
      { status: 502 }
    );
  }

  let capabilities;
  try {
    capabilities = await getAuthAccountCapabilitiesByEmail(
      supabaseAdmin,
      normalizedEmail
    );
  } catch (error) {
    console.error("Resend confirmation lookup failed:", error);
    await recordSecurityEvent(supabaseAdmin, {
      eventType: "resend_confirmation",
      ipHash: securityContext.ipHash,
      emailHash: securityContext.emailHash,
      outcome: "lookup_error",
    });

    return createAuthJsonResponse(
      {
        success: false,
        message:
          "Buck could not verify that email right now. Please try again later.",
      },
      { status: 502 }
    );
  }

  // SEC-046: every account state below gets the same answer, so this route
  // can't be used to learn whether (or how) an address is registered.
  const record = (outcome: SecurityEventOutcome) =>
    recordSecurityEvent(supabaseAdmin, {
      eventType: "resend_confirmation",
      ipHash: securityContext.ipHash,
      emailHash: securityContext.emailHash,
      outcome,
    });

  if (isGoogleOnlyConflict(capabilities)) {
    await record("blocked_provider");
    return neutralResponse();
  }

  if (capabilities.exists && capabilities.emailConfirmed) {
    await record("already_exists");
    return neutralResponse();
  }

  if (!capabilities.exists) {
    await record("not_found");
    return neutralResponse();
  }

  const supabase = createSupabaseStatelessClient();
  const { error } = await supabase.auth.resend({
    type: "signup",
    email: normalizedEmail,
    options: {
      emailRedirectTo: getSignUpCallbackUrl(request),
    },
  });

  if (error) {
    console.error("Resend confirmation failed:", error.status ?? error.message);
    await record("provider_error");
    return neutralResponse();
  }

  await record("sent");
  return neutralResponse();
}

function neutralResponse() {
  return createAuthJsonResponse(
    { success: true, message: RESEND_NEUTRAL_MESSAGE },
    { status: 200 }
  );
}
