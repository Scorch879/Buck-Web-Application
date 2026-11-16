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
  cooldownOutcomes: ["sent"],
  actionNoun: "confirmation",
};

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

  if (isGoogleOnlyConflict(capabilities)) {
    await recordSecurityEvent(supabaseAdmin, {
      eventType: "resend_confirmation",
      ipHash: securityContext.ipHash,
      emailHash: securityContext.emailHash,
      outcome: "blocked_provider",
    });

    return createAuthJsonResponse(
      {
        success: false,
        errorCode: "google_account_exists",
        providerConflict: "google",
        message:
          "This email uses Continue with Google and does not need email confirmation. Sign in with Google instead.",
      },
      { status: 409 }
    );
  }

  if (capabilities.exists && capabilities.emailConfirmed) {
    await recordSecurityEvent(supabaseAdmin, {
      eventType: "resend_confirmation",
      ipHash: securityContext.ipHash,
      emailHash: securityContext.emailHash,
      outcome: "already_exists",
    });

    return createAuthJsonResponse(
      {
        success: false,
        errorCode: "email_account_exists",
        providerConflict: "email",
        message:
          "This email is already verified. Sign in to your account instead.",
      },
      { status: 409 }
    );
  }

  if (!capabilities.exists) {
    await recordSecurityEvent(supabaseAdmin, {
      eventType: "resend_confirmation",
      ipHash: securityContext.ipHash,
      emailHash: securityContext.emailHash,
      outcome: "not_found",
    });

    return createAuthJsonResponse(
      {
        success: true,
        message:
          "If an unverified Buck account exists for that email, a confirmation email is on its way.",
      },
      { status: 200 }
    );
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
    console.error("Resend confirmation failed:", error.message);
    await recordSecurityEvent(supabaseAdmin, {
      eventType: "resend_confirmation",
      ipHash: securityContext.ipHash,
      emailHash: securityContext.emailHash,
      outcome: "provider_error",
    });

    const isProviderRateLimit =
      error.status === 429 || /rate limit|too many/i.test(error.message);

    return createAuthJsonResponse(
      {
        success: false,
        ...(isProviderRateLimit ? { errorCode: "rate_limited" } : {}),
        message: isProviderRateLimit
          ? "Too many confirmation emails sent. Please wait a moment and try again."
          : "Could not resend confirmation email right now. Please try again later.",
      },
      { status: isProviderRateLimit ? 429 : 502 }
    );
  }

  await recordSecurityEvent(supabaseAdmin, {
    eventType: "resend_confirmation",
    ipHash: securityContext.ipHash,
    emailHash: securityContext.emailHash,
    outcome: "sent",
  });

  return createAuthJsonResponse(
    {
      success: true,
      message: "Confirmation email sent again. Check your inbox.",
    },
    { status: 200 }
  );
}
