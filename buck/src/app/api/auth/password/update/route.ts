import { getRequestAuth, mfaRequiredResponse } from "@/utils/apiAuth";
import {
  countSecurityEvents,
  createAuthJsonResponse,
  getRetryAfterSeconds,
  hashClientIp,
  recordSecurityEvent,
  toIsoDate,
} from "@/utils/authRateLimit";
import { evaluatePasswordPolicy } from "@/utils/passwordPolicy";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/utils/supabase/admin";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseConfigError,
  supabaseUrl,
} from "@/utils/supabaseConfig";

const WINDOW_MS = 15 * 60 * 1000;
const USER_LIMIT = 5;
const IP_LIMIT = 20;

type GoTrueError = {
  code?: unknown;
  error_code?: unknown;
  msg?: unknown;
  message?: unknown;
  weak_password?: { reasons?: unknown };
};

function getUsername(metadata: Record<string, unknown> | undefined) {
  const value = metadata?.username ?? metadata?.full_name;
  return typeof value === "string" ? value : undefined;
}

/** Turns a Supabase Auth refusal into Buck's response (status, code, message). */
function mapGoTrueError(status: number, body: GoTrueError | null) {
  const code = String(body?.error_code ?? body?.code ?? "");
  const reasons = Array.isArray(body?.weak_password?.reasons)
    ? (body?.weak_password?.reasons as unknown[]).map(String)
    : [];

  if (code === "weak_password") {
    return {
      status: 400,
      errorCode: "weak_password",
      outcome: "invalid" as const,
      message: reasons.includes("pwned")
        ? "This password has appeared in a known data breach. Choose a different one."
        : "Password is not secure enough. Choose a longer password with upper and lower case letters, a number and a symbol.",
    };
  }

  if (code === "same_password") {
    return {
      status: 400,
      errorCode: "same_password",
      outcome: "invalid" as const,
      message: "Choose a password different from your current one.",
    };
  }

  if (code === "reauthentication_needed" || code === "reauthentication_not_valid") {
    return {
      status: 401,
      errorCode: "reauthentication_needed",
      outcome: "invalid" as const,
      message: "For your security, sign in again (or confirm the code we e-mailed you) before changing your password.",
    };
  }

  if (code === "insufficient_aal") {
    return null;
  }

  if (status === 429 || code === "over_request_rate_limit") {
    return {
      status: 429,
      errorCode: "rate_limited",
      outcome: "rate_limited" as const,
      message: "Too many password changes right now. Please wait a moment and try again.",
    };
  }

  return {
    status: 502,
    errorCode: "provider_error",
    outcome: "provider_error" as const,
    message: "Buck could not update your password right now. Please try again later.",
  };
}

/**
 * POST /api/auth/password/update { password, nonce? }: the only way Buck's
 * clients set a new password (reset link and Settings › Change password).
 * The policy runs here, not just in the browser (SEC-045). The update itself
 * goes to Supabase Auth as the user (PUT /auth/v1/user with their token), so
 * Supabase's own rules (requirements, leaked-password check, secure password
 * change nonce, aal) still apply on top. Cookie or mobile bearer; 2FA rule
 * per ADR-048; rate-limited per user and IP (ADR-005).
 */
export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return createAuthJsonResponse({ success: false, message: supabaseConfigError }, { status: 500 });
  }

  if (!isSupabaseAdminConfigured) {
    return createAuthJsonResponse(
      { success: false, message: "Password security is not configured. Please contact support." },
      { status: 500 }
    );
  }

  const auth = await getRequestAuth(request);

  if (!auth || !auth.accessToken) {
    return createAuthJsonResponse(
      { success: false, message: "Your session has expired. Please sign in again." },
      { status: 401 }
    );
  }

  if (!auth.mfa.satisfied) {
    return mfaRequiredResponse();
  }

  const body = (await request.json().catch(() => null)) as
    | { password?: unknown; nonce?: unknown }
    | null;
  const password = typeof body?.password === "string" ? body.password : "";
  const nonce = typeof body?.nonce === "string" && body.nonce.trim() ? body.nonce.trim() : undefined;
  const userId = auth.user.id;
  const admin = createSupabaseAdminClient();
  let ipHash: string;

  try {
    ipHash = hashClientIp(request);
    const since = toIsoDate(WINDOW_MS);
    const [userAttempts, ipAttempts] = await Promise.all([
      countSecurityEvents(admin, { eventType: "password_change", since, userId, excludeOutcomes: ["rate_limited"] }),
      countSecurityEvents(admin, { eventType: "password_change", since, ipHash, excludeOutcomes: ["rate_limited"] }),
    ]);

    if (userAttempts >= USER_LIMIT || ipAttempts >= IP_LIMIT) {
      await recordSecurityEvent(admin, { eventType: "password_change", outcome: "rate_limited", ipHash, userId });
      return createAuthJsonResponse(
        {
          success: false,
          errorCode: "rate_limited",
          message: "Too many password change attempts. Please wait 15 minutes and try again.",
        },
        { status: 429, retryAfterSeconds: getRetryAfterSeconds(WINDOW_MS) }
      );
    }
  } catch (error) {
    console.error("Password change rate limit failed:", error);
    return createAuthJsonResponse(
      { success: false, message: "Buck could not verify password change limits right now. Please try again later." },
      { status: 502 }
    );
  }

  const policy = evaluatePasswordPolicy(password, {
    email: auth.user.email,
    username: getUsername(auth.user.user_metadata),
  });

  if (!policy.isValid) {
    await recordSecurityEvent(admin, { eventType: "password_change", outcome: "invalid", ipHash, userId });
    return createAuthJsonResponse(
      {
        success: false,
        errorCode: "weak_password",
        issues: policy.issues,
        message: `Password is not secure enough: ${policy.issues.join(", ")}.`,
      },
      { status: 400 }
    );
  }

  let response: Response;

  try {
    response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: supabaseAnonKey!,
        Authorization: `Bearer ${auth.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(nonce ? { password, nonce } : { password }),
      cache: "no-store",
    });
  } catch (error) {
    console.error("Password change request failed:", error);
    await recordSecurityEvent(admin, { eventType: "password_change", outcome: "provider_error", ipHash, userId });
    return createAuthJsonResponse(
      { success: false, message: "Buck could not update your password right now. Please try again later." },
      { status: 502 }
    );
  }

  if (!response.ok) {
    const errorBody = (await response.json().catch(() => null)) as GoTrueError | null;
    const mapped = mapGoTrueError(response.status, errorBody);

    if (!mapped) {
      return mfaRequiredResponse();
    }

    if (mapped.outcome === "provider_error") {
      console.error("Password change refused by Supabase Auth:", response.status, errorBody?.error_code ?? errorBody?.code);
    }

    await recordSecurityEvent(admin, { eventType: "password_change", outcome: mapped.outcome, ipHash, userId });
    return createAuthJsonResponse(
      {
        success: false,
        errorCode: mapped.errorCode,
        message: mapped.message,
      },
      { status: mapped.status }
    );
  }

  await recordSecurityEvent(admin, { eventType: "password_change", outcome: "success", ipHash, userId });
  return createAuthJsonResponse(
    { success: true, message: "Password updated successfully." },
    { status: 200 }
  );
}
