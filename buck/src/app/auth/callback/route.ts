import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { EmailOtpType, Session, User } from "@supabase/supabase-js";
import { getSafeAppPath } from "@/utils/authUser";
import {
  canAccountResetPassword,
  getAuthAccountCapabilitiesByUserId,
  getCapabilitiesFromUser,
} from "@/utils/authCapabilities";
import {
  clearActivityCookie,
  clearAuthCookies,
  setNoStoreHeaders,
} from "@/utils/httpResponse";
import {
  createMfaVerifyPath,
  EMAIL_RECOVERY_CONFIRM_PATH,
  getMfaState,
  OAUTH_CONSENT_PATH,
} from "@/utils/mfa/assurance";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/utils/supabase/admin";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseCookieOptions,
  supabaseUrl,
} from "@/utils/supabaseConfig";

const CALLBACK_ALLOWED_PATHS = [
  "/forgot-password",
  "/check-email",
  // Account-deletion confirmation link (sent by /api/account/deletion/request).
  "/account/delete/confirm",
  // 2FA email recovery link (sent by /api/auth/mfa/email-recovery).
  EMAIL_RECOVERY_CONFIRM_PATH,
  // Connected-app consent, after Google or magic-link sign-in (ADR-049).
  OAUTH_CONSENT_PATH,
];

const ALLOWED_OTP_TYPES = new Set<EmailOtpType>([
  "recovery",
  "invite",
  "signup",
  "magiclink",
  "email",
]);

function parseOtpType(value: string | null): EmailOtpType | null {
  if (!value) {
    return null;
  }

  return ALLOWED_OTP_TYPES.has(value as EmailOtpType)
    ? (value as EmailOtpType)
    : null;
}

function getSafeNextPath(value: string | null) {
  return getSafeAppPath(value, CALLBACK_ALLOWED_PATHS);
}

function createAppRedirect(request: NextRequest, path: string) {
  return new URL(getSafeNextPath(path), request.nextUrl.origin);
}

function createSignInRedirect(
  request: NextRequest,
  params: { error?: string; reason?: string }
) {
  const redirectUrl = new URL("/sign-in", request.nextUrl.origin);
  if (params.error) {
    redirectUrl.searchParams.set("error", params.error);
  }
  if (params.reason) {
    redirectUrl.searchParams.set("reason", params.reason);
  }

  return redirectUrl;
}

function isRecoveryFlow(type: EmailOtpType | null, nextPath: string) {
  return type === "recovery" || nextPath.startsWith("/forgot-password");
}

function isEmailVerificationFlow(type: EmailOtpType | null) {
  return type === "signup" || type === "email";
}

function isExpiredAuthError(
  code: string | null | undefined,
  description: string | null | undefined
) {
  const combined = `${code ?? ""} ${description ?? ""}`;
  return /otp_expired|expired|invalid|already.*used|token.*not.*found/i.test(
    combined
  );
}

function createContextualErrorRedirect(
  request: NextRequest,
  options: {
    type: EmailOtpType | null;
    nextPath: string;
    expired?: boolean;
    missingCode?: boolean;
    errorCode?: string | null;
  }
) {
  if (isRecoveryFlow(options.type, options.nextPath)) {
    const url = new URL("/forgot-password", request.nextUrl.origin);
    url.searchParams.set(
      "error",
      options.expired ? "recovery-link-expired" : "recovery-link-failed"
    );
    return url;
  }

  if (
    isEmailVerificationFlow(options.type) ||
    options.nextPath.startsWith("/check-email") ||
    options.errorCode === "otp_expired"
  ) {
    const url = new URL("/check-email", request.nextUrl.origin);
    url.searchParams.set(
      "error",
      options.expired ? "email-verification-expired" : "email-verification-failed"
    );
    return url;
  }

  if (options.missingCode) {
    return createSignInRedirect(request, { error: "auth-callback-missing-code" });
  }

  return createSignInRedirect(request, { error: "google-signin-failed" });
}

function escapeHtml(str: string) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getNonceAttribute(request: NextRequest) {
  const nonce = request.headers.get("x-nonce");
  return nonce ? ` nonce="${escapeHtml(nonce)}"` : "";
}

function createCallbackSupabaseClient(
  request: NextRequest,
  response: NextResponse
) {
  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });
}

async function isUserAllowedPasswordRecovery(user: User | null | undefined) {
  if (!user) {
    return false;
  }

  if (isSupabaseAdminConfigured) {
    try {
      const capabilities = await getAuthAccountCapabilitiesByUserId(
        createSupabaseAdminClient(),
        user.id
      );
      return canAccountResetPassword(capabilities);
    } catch (error) {
      console.error("Recovery capability check failed:", error);
      return false;
    }
  }

  return canAccountResetPassword(getCapabilitiesFromUser(user));
}

function renderTokenConfirmationPage(
  request: NextRequest,
  params: {
    tokenHash: string;
    type: EmailOtpType;
    nextPath: string;
  }
) {
  const isRecovery = params.type === "recovery";
  const isSignup = params.type === "signup" || params.type === "email";

  const eyebrow = isRecovery
    ? "Password reset"
    : isSignup
      ? "Email verification"
      : "Account confirmation";
  const heading = isRecovery
    ? "Reset your Buck password"
    : isSignup
      ? "Confirm your Buck email"
      : "Continue to Buck";
  const copy = isRecovery
    ? "Click the button below to verify your reset request and choose a new password."
    : isSignup
      ? "Click the button below to verify your email address and activate your Buck account."
      : "Click the button below to finish signing in to your Buck account.";
  const buttonLabel = isRecovery
    ? "Continue to Reset Password"
    : isSignup
      ? "Confirm Email Address"
      : "Continue to Buck";
  const nonceAttribute = getNonceAttribute(request);

  const html = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(heading)} · Buck</title>
    <style${nonceAttribute}>
      :root {
        color-scheme: light dark;
        --bg: linear-gradient(155deg, #fffaf4 0%, #fff1dc 52%, #ffe3c4 100%);
        --card-bg: rgba(255, 250, 244, 0.94);
        --card-border: rgba(222, 210, 199, 0.92);
        --text: #2b2523;
        --muted: #756d68;
        --btn-bg: linear-gradient(135deg, #f47536, #ff3838);
        --btn-text: #ffffff;
      }
      @media (prefers-color-scheme: dark) {
        :root {
          --bg: linear-gradient(155deg, #1b120d 0%, #261912 52%, #19100c 100%);
          --card-bg: rgba(38, 25, 18, 0.92);
          --card-border: rgba(255, 211, 154, 0.22);
          --text: #fff8ed;
          --muted: #d9c7b6;
          --btn-bg: linear-gradient(135deg, #f47536, #ffc547);
          --btn-text: #241409;
        }
      }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        min-height: 100dvh;
        display: grid;
        place-items: center;
        padding: clamp(1rem, 4vw, 2rem);
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: var(--text);
        background: var(--bg);
      }
      main {
        width: min(520px, 100%);
        padding: clamp(1.5rem, 4vw, 2.25rem);
        background: var(--card-bg);
        border: 1px solid var(--card-border);
        border-radius: 12px;
        box-shadow: 0 22px 60px rgba(94, 59, 34, 0.18);
        text-align: center;
      }
      .brand {
        display: inline-flex;
        align-items: center;
        gap: 0.75rem;
        color: inherit;
        text-decoration: none;
        margin-bottom: 1.5rem;
      }
      .brand-mark {
        display: grid;
        place-items: center;
        width: 48px;
        height: 48px;
        border-radius: 999px;
        background: rgba(255, 197, 71, 0.18);
        border: 1px solid rgba(244, 117, 54, 0.28);
        overflow: hidden;
      }
      .brand-mark img {
        width: 36px;
        height: 48px;
        object-fit: contain;
      }
      .brand-text {
        text-align: left;
        line-height: 1.1;
      }
      .brand-text strong { display: block; font-size: 1.15rem; }
      .brand-text small { color: var(--muted); }
      .kicker {
        margin: 0;
        color: #f47536;
        font-size: 0.8rem;
        font-weight: 800;
        letter-spacing: 0.06em;
        text-transform: uppercase;
      }
      h1 {
        margin: 0.6rem auto 0;
        font-size: clamp(1.65rem, 4vw, 2.15rem);
        line-height: 1.12;
      }
      p.copy {
        margin: 0.9rem auto 1.6rem;
        color: var(--muted);
        line-height: 1.6;
        max-width: 400px;
      }
      button[type="submit"] {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        min-height: 48px;
        padding: 0.85rem 1.25rem;
        border: 0;
        border-radius: 8px;
        background: var(--btn-bg);
        color: var(--btn-text);
        font-size: 1rem;
        font-weight: 800;
        cursor: pointer;
        box-shadow: 0 12px 26px rgba(244, 117, 54, 0.24);
      }
      button[type="submit"]:hover { filter: brightness(1.03); }
      .secondary-link {
        display: inline-block;
        margin-top: 1.1rem;
        color: var(--muted);
        font-size: 0.92rem;
        text-decoration: underline;
      }
    </style>
  </head>
  <body>
    <main>
      <a href="/" class="brand">
        <span class="brand-mark">
          <img src="/BuckMascot.png" alt="" width="36" height="48" />
        </span>
        <span class="brand-text">
          <strong>Buck</strong>
          <small>Budget Tracker</small>
        </span>
      </a>
      <p class="kicker">${escapeHtml(eyebrow)}</p>
      <h1>${escapeHtml(heading)}</h1>
      <p class="copy">${escapeHtml(copy)}</p>
      <form method="POST" action="/auth/callback">
        <input type="hidden" name="token_hash" value="${escapeHtml(params.tokenHash)}" />
        <input type="hidden" name="type" value="${escapeHtml(params.type)}" />
        <input type="hidden" name="next" value="${escapeHtml(params.nextPath)}" />
        <button type="submit">${escapeHtml(buttonLabel)}</button>
      </form>
      <a class="secondary-link" href="/sign-in">Back to Sign In</a>
    </main>
  </body>
</html>`;

  const response = new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
  return setNoStoreHeaders(response);
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.redirect(
      createSignInRedirect(request, { error: "supabase-not-configured" })
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const rawType = request.nextUrl.searchParams.get("type");
  const type = parseOtpType(rawType);
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  const queryError = request.nextUrl.searchParams.get("error");
  const queryErrorCode = request.nextUrl.searchParams.get("error_code");
  const queryErrorDescription =
    request.nextUrl.searchParams.get("error_description");

  if (queryError || queryErrorCode || queryErrorDescription) {
    return setNoStoreHeaders(
      NextResponse.redirect(
        createContextualErrorRedirect(request, {
          type,
          nextPath,
          expired: isExpiredAuthError(queryErrorCode, queryErrorDescription),
          errorCode: queryErrorCode,
        })
      )
    );
  }

  // Scanner-safe verification: render an explicit POST confirmation form on GET
  // so email link prefetchers/scanners never consume single-use OTP tokens.
  if (token_hash) {
    if (!type) {
      return setNoStoreHeaders(
        NextResponse.redirect(
          createContextualErrorRedirect(request, {
            type: null,
            nextPath,
            expired: false,
          })
        )
      );
    }

    return renderTokenConfirmationPage(request, {
      tokenHash: token_hash,
      type,
      nextPath,
    });
  }

  const redirectResponse = NextResponse.redirect(
    createAppRedirect(request, nextPath)
  );
  const supabase = createCallbackSupabaseClient(request, redirectResponse);

  if (!code) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const shouldInspectHashEvenWithSession =
      isRecoveryFlow(type, nextPath) ||
      isEmailVerificationFlow(type) ||
      nextPath.startsWith("/forgot-password") ||
      nextPath.startsWith("/check-email");

    if (user && !shouldInspectHashEvenWithSession) {
      return setNoStoreHeaders(redirectResponse);
    }

    // Fallback for implicit flow (hash fragment): the server cannot read
    // window.location.hash, so serve a nonced HTML page that inspects it.
    const fallbackUrl = createContextualErrorRedirect(request, {
      type,
      nextPath,
      missingCode: true,
    }).toString();
    const expiredRedirectUrl = createContextualErrorRedirect(request, {
      type,
      nextPath,
      expired: true,
    }).toString();
    const failedRedirectUrl = createContextualErrorRedirect(request, {
      type,
      nextPath,
      expired: false,
    }).toString();
    const nonceAttribute = getNonceAttribute(request);

    return setNoStoreHeaders(
      new NextResponse(
        `
      <!DOCTYPE html>
      <html>
        <head>
          <meta id="redirect-data" data-next="${escapeHtml(nextPath)}" data-fallback="${escapeHtml(fallbackUrl)}" data-expired="${escapeHtml(expiredRedirectUrl)}" data-failed="${escapeHtml(failedRedirectUrl)}" data-authenticated="${user ? "true" : "false"}" />
          <script${nonceAttribute}>
            const meta = document.getElementById("redirect-data");
            const nextPath = meta.getAttribute("data-next");
            const fallbackPath = meta.getAttribute("data-fallback");
            const expiredPath = meta.getAttribute("data-expired");
            const failedPath = meta.getAttribute("data-failed");
            const isAuthenticated = meta.getAttribute("data-authenticated") === "true";
            const rawHash = window.location.hash || "";
            const hashParams = new URLSearchParams(rawHash.startsWith("#") ? rawHash.slice(1) : rawHash);
            const hashError = hashParams.get("error") || hashParams.get("error_code") || hashParams.get("error_description");

            if (hashError) {
              const combined = (hashParams.get("error_code") || "") + " " + (hashParams.get("error_description") || "");
              if (/otp_expired|expired|invalid|used/i.test(combined)) {
                window.location.replace(expiredPath);
              } else {
                window.location.replace(failedPath);
              }
            } else if (rawHash.includes("access_token")) {
              window.location.replace(nextPath + rawHash);
            } else if (isAuthenticated && !nextPath.startsWith("/forgot-password") && !nextPath.startsWith("/check-email")) {
              window.location.replace(nextPath);
            } else {
              window.location.replace(fallbackPath);
            }
          </script>
        </head>
        <body>Redirecting...</body>
      </html>
      `,
        { headers: { "Content-Type": "text/html" } }
      )
    );
  }

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback exchange failed:", error.message);

    return setNoStoreHeaders(
      NextResponse.redirect(
        createContextualErrorRedirect(request, {
          type,
          nextPath,
          expired: isExpiredAuthError(error.code, error.message),
          errorCode: error.code,
        })
      )
    );
  }

  if (isRecoveryFlow(type, nextPath)) {
    const allowed = await isUserAllowedPasswordRecovery(data.session?.user);
    if (!allowed) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Still clear cookies below.
      }
      const blockedResponse = NextResponse.redirect(
        createSignInRedirect(request, {
          error: "recovery-not-available-for-google",
        })
      );
      clearAuthCookies(request, blockedResponse, true);
      return setNoStoreHeaders(blockedResponse);
    }
  }

  return setNoStoreHeaders(
    gateTwoFactor(request, redirectResponse, nextPath, data.session)
  );
}

async function readPostCallbackParams(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const body = (await request.json().catch(() => null)) as {
      token_hash?: unknown;
      type?: unknown;
      next?: unknown;
    } | null;

    return {
      tokenHash: typeof body?.token_hash === "string" ? body.token_hash.trim() : "",
      type: parseOtpType(typeof body?.type === "string" ? body.type.trim() : null),
      nextPath: getSafeNextPath(
        typeof body?.next === "string" ? body.next : null
      ),
    };
  }

  const formData = await request.formData().catch(() => null);
  const tokenHashValue = formData?.get("token_hash");
  const typeValue = formData?.get("type");
  const nextValue = formData?.get("next");

  return {
    tokenHash: typeof tokenHashValue === "string" ? tokenHashValue.trim() : "",
    type: parseOtpType(typeof typeValue === "string" ? typeValue.trim() : null),
    nextPath: getSafeNextPath(
      typeof nextValue === "string" ? nextValue : null
    ),
  };
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.redirect(
      createSignInRedirect(request, { error: "supabase-not-configured" }),
      { status: 303 }
    );
  }

  const { tokenHash, type, nextPath } = await readPostCallbackParams(request);

  if (!tokenHash || !type) {
    return setNoStoreHeaders(
      NextResponse.redirect(
        createContextualErrorRedirect(request, {
          type,
          nextPath,
          missingCode: true,
        }),
        { status: 303 }
      )
    );
  }

  const redirectResponse = NextResponse.redirect(
    createAppRedirect(request, nextPath),
    { status: 303 }
  );
  const supabase = createCallbackSupabaseClient(request, redirectResponse);

  const { data, error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type,
  });

  if (error) {
    console.error("Auth callback OTP verification failed:", error.message);

    return setNoStoreHeaders(
      NextResponse.redirect(
        createContextualErrorRedirect(request, {
          type,
          nextPath,
          expired: isExpiredAuthError(error.code, error.message),
          errorCode: error.code,
        }),
        { status: 303 }
      )
    );
  }

  if (isRecoveryFlow(type, nextPath)) {
    const allowed = await isUserAllowedPasswordRecovery(
      data.session?.user ?? data.user
    );
    if (!allowed) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Still clear cookies below.
      }
      const blockedResponse = NextResponse.redirect(
        createSignInRedirect(request, {
          error: "recovery-not-available-for-google",
        }),
        { status: 303 }
      );
      clearAuthCookies(request, blockedResponse, true);
      return setNoStoreHeaders(blockedResponse);
    }
  }

  if (isEmailVerificationFlow(type) && !data.session) {
    clearActivityCookie(redirectResponse);
    redirectResponse.headers.set(
      "Location",
      createSignInRedirect(request, { reason: "email-verified" }).toString()
    );
    return setNoStoreHeaders(redirectResponse);
  }

  return setNoStoreHeaders(
    gateTwoFactor(request, redirectResponse, nextPath, data.session)
  );
}

/**
 * Magic links, Google and e-mail confirmation all land here at aal1. A user
 * with 2FA on is sent to the code page first (ADR-048); only the 2FA email
 * recovery link may continue without it, since it exists for users who lost
 * their authenticator.
 */
function gateTwoFactor(
  request: NextRequest,
  redirectResponse: NextResponse,
  nextPath: string,
  session: Session | null
) {
  clearActivityCookie(redirectResponse);

  const isRecoveryLink = nextPath.startsWith(EMAIL_RECOVERY_CONFIRM_PATH);

  if (
    !session ||
    isRecoveryLink ||
    getMfaState(session.user, session.access_token).satisfied
  ) {
    return redirectResponse;
  }

  redirectResponse.headers.set(
    "Location",
    new URL(createMfaVerifyPath(nextPath), request.nextUrl.origin).toString()
  );

  return redirectResponse;
}
