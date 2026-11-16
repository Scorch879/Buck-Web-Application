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
} from "@/utils/authRateLimit";
import {
  canAccountResetPassword,
  getAuthAccountCapabilitiesByEmail,
} from "@/utils/authCapabilities";

type PasswordResetRequest = {
  email?: unknown;
};

// Identical for unknown addresses and ineligible Google-only accounts so the
// endpoint cannot be used to enumerate accounts or auth providers (SEC-020).
const resetRequestMessage =
  "If password reset is available for that email, a reset link is on its way. Check your inbox.";

const PASSWORD_RESET_LIMITS: EmailActionRateLimitConfig = {
  eventType: "password_reset",
  ipWindowMs: 15 * 60 * 1000,
  ipLimit: 8,
  ipDayWindowMs: 24 * 60 * 60 * 1000,
  ipDayLimit: 40,
  emailWindowMs: 60 * 60 * 1000,
  emailLimit: 5,
  emailCooldownMs: 60 * 1000,
  actionNoun: "reset",
};

function getPasswordResetRedirectUrl(request: Request) {
  const params = new URLSearchParams({
    next: "/forgot-password?type=recovery",
  });

  return `${getSiteOrigin(request)}/auth/callback?${params.toString()}`;
}

async function readRequestBody(request: Request) {
  try {
    return (await request.json()) as PasswordResetRequest;
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

  const body = await readRequestBody(request);
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const emailValidationMessage = getEmailValidationMessage(email);

  if (emailValidationMessage) {
    return createAuthJsonResponse(
      { success: false, message: emailValidationMessage },
      { status: 400 }
    );
  }

  if (!isSupabaseAdminConfigured) {
    return createAuthJsonResponse(
      {
        success: false,
        message:
          "Password reset lookup is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
      },
      { status: 500 }
    );
  }

  let securityContext: EmailActionSecurityContext;
  const supabaseAdmin = createSupabaseAdminClient();

  try {
    securityContext = getEmailActionSecurityContext(
      request,
      normalizeEmailAddress(email)
    );
  } catch (error) {
    console.error("Password reset throttling is not configured:", error);

    return createAuthJsonResponse(
      {
        success: false,
        message:
          "Password reset security is not configured. Please contact support.",
      },
      { status: 500 }
    );
  }

  try {
    const rateLimit = await checkEmailActionRateLimit(
      supabaseAdmin,
      securityContext,
      PASSWORD_RESET_LIMITS
    );

    if (rateLimit.limited) {
      await recordSecurityEvent(supabaseAdmin, {
        eventType: "password_reset",
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
    console.error("Password reset rate limit failed:", error);

    return createAuthJsonResponse(
      {
        success: false,
        message:
          "Buck could not verify reset limits right now. Please try again later.",
      },
      { status: 502 }
    );
  }

  try {
    const capabilities = await getAuthAccountCapabilitiesByEmail(
      supabaseAdmin,
      securityContext.normalizedEmail
    );

    if (!capabilities.exists) {
      await recordSecurityEvent(supabaseAdmin, {
        eventType: "password_reset",
        ipHash: securityContext.ipHash,
        emailHash: securityContext.emailHash,
        outcome: "not_found",
      });

      return createAuthJsonResponse(
        { success: true, message: resetRequestMessage },
        { status: 200 }
      );
    }

    if (!canAccountResetPassword(capabilities)) {
      await recordSecurityEvent(supabaseAdmin, {
        eventType: "password_reset",
        ipHash: securityContext.ipHash,
        emailHash: securityContext.emailHash,
        outcome: "blocked_provider",
      });

      return createAuthJsonResponse(
        { success: true, message: resetRequestMessage },
        { status: 200 }
      );
    }
  } catch (error) {
    console.error("Password reset account lookup failed:", error);
    await recordSecurityEvent(supabaseAdmin, {
      eventType: "password_reset",
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

  const supabase = createSupabaseStatelessClient();

  const { error } = await supabase.auth.resetPasswordForEmail(
    securityContext.normalizedEmail,
    {
      redirectTo: getPasswordResetRedirectUrl(request),
    }
  );

  if (error) {
    console.error("Password reset request failed:", error.message);
    await recordSecurityEvent(supabaseAdmin, {
      eventType: "password_reset",
      ipHash: securityContext.ipHash,
      emailHash: securityContext.emailHash,
      outcome: "provider_error",
    });

    // Only reachable for eligible accounts, so a distinct error would reveal
    // existence. Rate limits (429) are checked earlier and apply to every address.
    return createAuthJsonResponse(
      { success: true, message: resetRequestMessage },
      { status: 200 }
    );
  }

  await recordSecurityEvent(supabaseAdmin, {
    eventType: "password_reset",
    ipHash: securityContext.ipHash,
    emailHash: securityContext.emailHash,
    outcome: "sent",
  });

  return createAuthJsonResponse(
    {
      success: true,
      message: resetRequestMessage,
    },
    { status: 200 }
  );
}
