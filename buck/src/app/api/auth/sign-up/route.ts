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
import { evaluatePasswordPolicy } from "@/utils/passwordPolicy";
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

type SignUpRequest = {
  username?: unknown;
  email?: unknown;
  password?: unknown;
};

const SIGN_UP_LIMITS: EmailActionRateLimitConfig = {
  eventType: "sign_up",
  ipWindowMs: 15 * 60 * 1000,
  ipLimit: 10,
  ipDayWindowMs: 24 * 60 * 60 * 1000,
  ipDayLimit: 40,
  emailWindowMs: 60 * 60 * 1000,
  emailLimit: 5,
  emailCooldownMs: 60 * 1000,
  cooldownOutcomes: ["sent"],
  actionNoun: "sign-up",
};

function getSignUpCallbackUrl(request: Request) {
  const params = new URLSearchParams({ next: "/dashboard/home" });
  return `${getSiteOrigin(request)}/auth/callback?${params.toString()}`;
}

async function readRequestBody(request: Request) {
  try {
    return (await request.json()) as SignUpRequest;
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
          "Sign-up verification is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
      },
      { status: 500 }
    );
  }

  const body = await readRequestBody(request);
  const username =
    typeof body?.username === "string" ? body.username.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim() : "";
  const password = typeof body?.password === "string" ? body.password : "";

  if (!username) {
    return createAuthJsonResponse(
      { success: false, message: "Please enter a username." },
      { status: 400 }
    );
  }

  const normalizedEmail = normalizeEmailAddress(email);
  const emailValidationMessage = getEmailValidationMessage(normalizedEmail);

  if (emailValidationMessage) {
    return createAuthJsonResponse(
      { success: false, message: emailValidationMessage },
      { status: 400 }
    );
  }

  const passwordPolicy = evaluatePasswordPolicy(password, {
    email: normalizedEmail,
    username,
  });

  if (!passwordPolicy.isValid) {
    return createAuthJsonResponse(
      {
        success: false,
        message: `Password is not secure enough: ${passwordPolicy.issues.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  let securityContext: EmailActionSecurityContext;
  const supabaseAdmin = createSupabaseAdminClient();

  try {
    securityContext = getEmailActionSecurityContext(request, normalizedEmail);
  } catch (error) {
    console.error("Sign-up throttling is not configured:", error);

    return createAuthJsonResponse(
      {
        success: false,
        message:
          "Sign-up security is not configured. Please contact support.",
      },
      { status: 500 }
    );
  }

  try {
    const rateLimit = await checkEmailActionRateLimit(
      supabaseAdmin,
      securityContext,
      SIGN_UP_LIMITS
    );

    if (rateLimit.limited) {
      await recordSecurityEvent(supabaseAdmin, {
        eventType: "sign_up",
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
    console.error("Sign-up rate limit failed:", error);

    return createAuthJsonResponse(
      {
        success: false,
        message:
          "Buck could not verify sign-up limits right now. Please try again later.",
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
    console.error("Sign-up account capability check failed:", error);
    await recordSecurityEvent(supabaseAdmin, {
      eventType: "sign_up",
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
      eventType: "sign_up",
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
          "This email is already registered with Continue with Google. Sign in with Google instead.",
      },
      { status: 409 }
    );
  }

  if (
    capabilities.exists &&
    (capabilities.hasEmailIdentity || capabilities.hasPassword) &&
    capabilities.emailConfirmed
  ) {
    await recordSecurityEvent(supabaseAdmin, {
      eventType: "sign_up",
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
          "An account with this email already exists. Sign in or reset your password instead.",
      },
      { status: 409 }
    );
  }

  const supabase = createSupabaseStatelessClient();
  const emailRedirectTo = getSignUpCallbackUrl(request);

  if (capabilities.exists && !capabilities.emailConfirmed) {
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: { emailRedirectTo },
    });

    if (error) {
      console.error("Sign-up resend confirmation failed:", error.message);
      await recordSecurityEvent(supabaseAdmin, {
        eventType: "sign_up",
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
            : "Buck could not send the confirmation email right now. Please try again later.",
        },
        { status: isProviderRateLimit ? 429 : 502 }
      );
    }

    await recordSecurityEvent(supabaseAdmin, {
      eventType: "sign_up",
      ipHash: securityContext.ipHash,
      emailHash: securityContext.emailHash,
      outcome: "sent",
    });

    return createAuthJsonResponse(
      {
        success: true,
        needsEmailConfirmation: true,
        message:
          "Account is awaiting verification. We sent a fresh confirmation email.",
      },
      { status: 200 }
    );
  }

  const { data, error } = await supabase.auth.signUp({
    email: normalizedEmail,
    password,
    options: {
      data: {
        username,
        full_name: username,
      },
      emailRedirectTo,
    },
  });

  if (error) {
    console.error("Sign-up failed:", error.message);
    await recordSecurityEvent(supabaseAdmin, {
      eventType: "sign_up",
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
          ? "Too many sign-up attempts right now. Please wait a moment and try again."
          : error.message || "Could not create your account.",
      },
      { status: isProviderRateLimit ? 429 : 400 }
    );
  }

  // Defense-in-depth: Supabase returns identities: [] when an email is already
  // registered and confirmed without returning an error.
  if (
    data.user &&
    Array.isArray(data.user.identities) &&
    data.user.identities.length === 0
  ) {
    await recordSecurityEvent(supabaseAdmin, {
      eventType: "sign_up",
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
          "An account with this email already exists. Sign in or reset your password instead.",
      },
      { status: 409 }
    );
  }

  await recordSecurityEvent(supabaseAdmin, {
    eventType: "sign_up",
    ipHash: securityContext.ipHash,
    emailHash: securityContext.emailHash,
    outcome: "sent",
  });

  return createAuthJsonResponse(
    {
      success: true,
      needsEmailConfirmation: Boolean(data.user && !data.session),
      message: "Account created! Check your email to verify your account.",
    },
    { status: 200 }
  );
}
