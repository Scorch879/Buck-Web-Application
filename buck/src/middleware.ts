import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseCookieOptions,
  supabaseUrl,
} from "@/utils/supabaseConfig";
import { isAdminUser } from "@/utils/adminAccess";
import { buildCsp, createNonce } from "@/utils/csp";
import {
  createMfaVerifyPath,
  getMfaState,
  MFA_VERIFY_PATH,
  OAUTH_CONSENT_PATH,
} from "@/utils/mfa/assurance";

const SESSION_ACTIVITY_COOKIE = "buck-session-activity";
const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;
const AUTH_ROUTES = new Set(["/sign-in", "/create-account", "/forgot-password"]);
// API routes that authenticate by other means (anonymous flow or bearer secret).
const NON_SESSION_API_PREFIXES = [
  "/api/auth/",
  "/api/cron/",
  "/api/account/deletion/purge",
  // Buck MCP server: connected-app bearer tokens only (ADR-050).
  "/api/mcp",
];
// Session API routes whose successful response sets its own private cache.
const PRIVATELY_CACHED_API_PATHS = new Set(["/api/oauth/app-logo"]);

type SessionActivity = {
  sub: string;
  ts: number;
};

function getPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

function getIdleTimeoutMs() {
  const minutes = getPositiveNumber(
    process.env.SESSION_IDLE_TIMEOUT_MINUTES ??
      process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES,
    DEFAULT_IDLE_TIMEOUT_MINUTES
  );

  // 0 disables the timeout; only tolerated outside production.
  if (minutes === 0 && process.env.NODE_ENV === "production") {
    return DEFAULT_IDLE_TIMEOUT_MINUTES * 60 * 1000;
  }

  return minutes * 60 * 1000;
}

function getSessionCookieSecret() {
  return process.env.SESSION_COOKIE_SECRET?.trim() ?? "";
}

function getSafeRedirectPath(path: string | null) {
  if (!path || !path.startsWith("/") || path.startsWith("//")) {
    return "/dashboard/home";
  }

  return path;
}

function createSignInUrl(
  request: NextRequest,
  params?: { error?: string; reason?: string }
) {
  const signInUrl = request.nextUrl.clone();
  signInUrl.pathname = "/sign-in";
  signInUrl.search = "";

  if (params?.error) {
    signInUrl.searchParams.set("error", params.error);
  }

  if (params?.reason) {
    signInUrl.searchParams.set("reason", params.reason);
  }

  return signInUrl;
}

function createProtectedRedirect(request: NextRequest, reason?: string) {
  const signInUrl = createSignInUrl(request, { reason });
  const redirectTo = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  signInUrl.searchParams.set("redirectTo", redirectTo);

  return signInUrl;
}

function createDashboardRedirect(request: NextRequest) {
  const requestedRedirect = request.nextUrl.searchParams.get("redirectTo");

  // Parsed as a URL so a target's own query (e.g. the consent page's
  // ?authorization_id=) survives. "/\evil.com" parses to another origin, so
  // anything that leaves Buck falls back to the dashboard.
  const target = new URL(getSafeRedirectPath(requestedRedirect), request.nextUrl.origin);

  return target.origin === request.nextUrl.origin
    ? target
    : new URL("/dashboard/home", request.nextUrl.origin);
}

function isAdminMfaRequired() {
  return process.env.ADMIN_REQUIRE_MFA?.trim().toLowerCase() === "true";
}

function createMfaRedirect(request: NextRequest) {
  return new URL(
    createMfaVerifyPath(`${request.nextUrl.pathname}${request.nextUrl.search}`),
    request.nextUrl.origin
  );
}

function isRootAuthReturn(request: NextRequest) {
  if (request.nextUrl.pathname !== "/") {
    return false;
  }

  const params = request.nextUrl.searchParams;

  return (
    params.has("code") ||
    params.has("error") ||
    params.has("error_code") ||
    params.has("error_description")
  );
}

function createAuthCallbackRedirect(request: NextRequest) {
  const redirectUrl = request.nextUrl.clone();

  redirectUrl.pathname = "/auth/callback";

  if (!redirectUrl.searchParams.has("next")) {
    redirectUrl.searchParams.set("next", "/dashboard/home");
  }

  return redirectUrl;
}

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });

  ["cache-control", "expires", "pragma"].forEach((header) => {
    const value = source.headers.get(header);

    if (value) {
      target.headers.set(header, value);
    }
  });
}

function setNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
}

function getCookieOptions() {
  return {
    httpOnly: true,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}

function base64UrlEncode(value: string | Uint8Array) {
  const bytes =
    typeof value === "string" ? new TextEncoder().encode(value) : value;
  let binary = "";

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary)
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

function base64UrlDecode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const base64 = padded.padEnd(
    padded.length + ((4 - (padded.length % 4)) % 4),
    "="
  );
  const binary = atob(base64);

  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function getSignature(payload: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(payload)
  );

  return base64UrlEncode(new Uint8Array(signature));
}

async function verifySignature(payload: string, signature: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"]
  );

  return crypto.subtle.verify(
    "HMAC",
    key,
    base64UrlDecode(signature),
    new TextEncoder().encode(payload)
  );
}

async function createActivityCookie(userId: string) {
  const secret = getSessionCookieSecret();
  const payload = base64UrlEncode(
    JSON.stringify({ sub: userId, ts: Date.now() } satisfies SessionActivity)
  );

  if (!secret) {
    return "";
  }

  return `${payload}.${await getSignature(payload, secret)}`;
}

async function readActivityCookie(request: NextRequest, userId: string) {
  const secret = getSessionCookieSecret();
  const cookieValue = request.cookies.get(SESSION_ACTIVITY_COOKIE)?.value;

  if (!secret || !cookieValue) {
    return null;
  }

  const [payload, signature] = cookieValue.split(".");

  if (!payload || !signature) {
    return "invalid" as const;
  }

  const isValid = await verifySignature(payload, signature, secret);

  if (!isValid) {
    return "invalid" as const;
  }

  try {
    const decoded = new TextDecoder().decode(base64UrlDecode(payload));
    const activity = JSON.parse(decoded) as SessionActivity;

    if (typeof activity.sub !== "string" || !Number.isFinite(activity.ts)) {
      return "invalid" as const;
    }

    if (activity.sub !== userId) {
      return "wrong-user" as const;
    }

    return activity;
  } catch {
    return "invalid" as const;
  }
}

async function isSessionIdleExpired(
  request: NextRequest,
  user: { id: string; last_sign_in_at?: string | null }
) {
  const activity = await readActivityCookie(request, user.id);

  if (activity === "invalid") {
    return true;
  }

  const timeoutMs = getIdleTimeoutMs();

  if (timeoutMs <= 0) {
    return false;
  }

  const now = Date.now();
  // A missing cookie (cleared, or dropped on browser restart) or a cookie left
  // over from a previous user/session is trusted while the current sign-in
  // itself is still inside the idle window; otherwise an old refresh token
  // could silently mint a fresh activity window.
  const lastSignInMs = user.last_sign_in_at
    ? Date.parse(user.last_sign_in_at)
    : Number.NaN;
  const hasRecentSignIn =
    Number.isFinite(lastSignInMs) && now - lastSignInMs <= timeoutMs;

  if (activity === null || activity === "wrong-user") {
    return !hasRecentSignIn;
  }

  const effectiveLastActivityMs = Number.isFinite(lastSignInMs)
    ? Math.max(activity.ts, lastSignInMs)
    : activity.ts;

  return now - effectiveLastActivityMs > timeoutMs;
}

async function refreshActivityCookie(response: NextResponse, userId: string) {
  const cookieValue = await createActivityCookie(userId);

  if (!cookieValue) {
    return;
  }

  response.cookies.set(
    SESSION_ACTIVITY_COOKIE,
    cookieValue,
    getCookieOptions()
  );
}

function clearActivityCookie(response: NextResponse) {
  response.cookies.set(SESSION_ACTIVITY_COOKIE, "", {
    ...getCookieOptions(),
    maxAge: 0,
  });
}

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    ...getCookieOptions(),
    maxAge: 0,
  });
}

function clearSupabaseAuthCookies(request: NextRequest, response: NextResponse) {
  clearActivityCookie(response);

  request.cookies.getAll().forEach(({ name }) => {
    const isSupabaseAuthCookie =
      name.startsWith("sb-") && name.includes("auth-token");

    if (isSupabaseAuthCookie) {
      clearCookie(response, name);
    }
  });
}

export async function middleware(request: NextRequest) {
  // Per-request CSP nonce: the CSP travels on the forwarded request headers so
  // Next can stamp its own scripts, and on the response for the browser.
  const nonce = createNonce();
  const csp = buildCsp(nonce, {
    isDev: process.env.NODE_ENV !== "production",
    supabaseUrl: supabaseUrl,
    // Same host the browser's AI calls use (utils/buckAi.ts).
    buckAiUrl: process.env.NEXT_PUBLIC_BUCK_AI_URL?.trim() || "http://localhost:8000",
  });
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("content-security-policy", csp);

  const response = await handleRequest(request, requestHeaders);
  response.headers.set("Content-Security-Policy", csp);

  return response;
}

async function handleRequest(request: NextRequest, requestHeaders: Headers) {
  const { pathname } = request.nextUrl;
  // The connected-app consent page needs a signed-in user who passed 2FA,
  // exactly like the dashboard (ADR-049).
  const isProtectedRoute =
    pathname.startsWith("/dashboard") || pathname === OAUTH_CONSENT_PATH;
  const isAuthRoute = AUTH_ROUTES.has(pathname);
  // The 2FA code page: needs a signed-in user, but one who has NOT passed 2FA.
  const isMfaRoute = pathname === MFA_VERIFY_PATH;
  const isSessionApiRoute =
    pathname.startsWith("/api/") &&
    !NON_SESSION_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
  const sessionCookieSecret = getSessionCookieSecret();
  const shouldEnforceServerIdle = Boolean(sessionCookieSecret);
  let response = NextResponse.next({ request: { headers: requestHeaders } });

  if (isRootAuthReturn(request)) {
    const redirectResponse = NextResponse.redirect(
      createAuthCallbackRedirect(request)
    );
    setNoStoreHeaders(redirectResponse);

    return redirectResponse;
  }

  if (!isProtectedRoute && !isAuthRoute && !isMfaRoute && !isSessionApiRoute) {
    return response;
  }

  // App logos keep the route's own private one-day cache (ADR-051); every
  // refusal below still gets no-store.
  if (!PRIVATELY_CACHED_API_PATHS.has(pathname)) {
    setNoStoreHeaders(response);
  }

  if (!isSupabaseConfigured) {
    if (isProtectedRoute) {
      const redirectResponse = NextResponse.redirect(
        createSignInUrl(request, { error: "supabase-not-configured" })
      );
      setNoStoreHeaders(redirectResponse);

      return redirectResponse;
    }

    return response;
  }

  if (
    process.env.NODE_ENV === "production" &&
    isProtectedRoute &&
    !shouldEnforceServerIdle
  ) {
    const redirectResponse = NextResponse.redirect(
      createSignInUrl(request, { error: "session-security-not-configured" })
    );
    clearSupabaseAuthCookies(request, redirectResponse);
    setNoStoreHeaders(redirectResponse);

    return redirectResponse;
  }

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        // Keep refreshed auth cookies visible to this request's server components.
        requestHeaders.set("cookie", request.headers.get("cookie") ?? "");
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
      },
    },
  });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if ((isProtectedRoute || isMfaRoute) && (error || !user)) {
    const redirectResponse = NextResponse.redirect(
      createProtectedRedirect(request)
    );
    copyResponseCookies(response, redirectResponse);
    clearActivityCookie(redirectResponse);
    setNoStoreHeaders(redirectResponse);

    return redirectResponse;
  }

  if (pathname.startsWith("/dashboard/admin") && !isAdminUser(user)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard/home";
    redirectUrl.search = "";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    copyResponseCookies(response, redirectResponse);
    setNoStoreHeaders(redirectResponse);

    return redirectResponse;
  }

  if (
    (isProtectedRoute || isMfaRoute || isSessionApiRoute) &&
    user &&
    shouldEnforceServerIdle
  ) {
    const isExpired = await isSessionIdleExpired(request, user);

    if (isExpired) {
      response =
        isProtectedRoute || isMfaRoute
          ? NextResponse.redirect(
              createProtectedRedirect(request, "session-expired")
            )
          : NextResponse.json({ error: "session-expired" }, { status: 401 });
      try {
        await supabase.auth.signOut();
      } catch {
        // The response still clears Buck's server-side activity cookie.
      }
      clearSupabaseAuthCookies(request, response);
      setNoStoreHeaders(response);

      return response;
    }

    // Only page navigations count as user activity; API calls (including
    // background polling) validate the window but never extend it.
    if (isProtectedRoute || isMfaRoute) {
      await refreshActivityCookie(response, user.id);
    }
  }

  // Two-factor gate (ADR-048). getUser() above verified the session's access
  // token, so its aal claim can be trusted. RLS enforces the same rule.
  if (user && (isProtectedRoute || isMfaRoute || isSessionApiRoute)) {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const mfa = getMfaState(user, session?.access_token);

    if (!mfa.satisfied && (isProtectedRoute || isSessionApiRoute)) {
      const mfaResponse = isProtectedRoute
        ? NextResponse.redirect(createMfaRedirect(request))
        : NextResponse.json(
            { error: "mfa_required", message: "Enter your two-factor code first." },
            { status: 401 }
          );
      copyResponseCookies(response, mfaResponse);
      setNoStoreHeaders(mfaResponse);

      return mfaResponse;
    }

    if (mfa.satisfied && isMfaRoute) {
      const redirectResponse = NextResponse.redirect(createDashboardRedirect(request));
      copyResponseCookies(response, redirectResponse);
      setNoStoreHeaders(redirectResponse);

      return redirectResponse;
    }

    const isAdminArea =
      pathname.startsWith("/dashboard/admin") || pathname.startsWith("/api/admin");

    if (isAdminArea && isAdminMfaRequired() && !mfa.hasVerifiedFactor) {
      const enrollUrl = new URL("/dashboard/settings", request.nextUrl.origin);
      enrollUrl.searchParams.set("tab", "security");
      enrollUrl.searchParams.set("enroll", "2fa");
      const enrollResponse = isProtectedRoute
        ? NextResponse.redirect(enrollUrl)
        : NextResponse.json(
            { error: "mfa_enrollment_required", message: "Admins must turn on two-factor authentication." },
            { status: 403 }
          );
      copyResponseCookies(response, enrollResponse);
      setNoStoreHeaders(enrollResponse);

      return enrollResponse;
    }
  }

  if (isAuthRoute) {
    if (!user || error) {
      if (request.cookies.get(SESSION_ACTIVITY_COOKIE)) {
        clearActivityCookie(response);
      }

      return response;
    }

    const isRecoveryMode =
      pathname === "/forgot-password" &&
      request.nextUrl.searchParams.get("type") === "recovery";

    if (!isRecoveryMode) {
      if (shouldEnforceServerIdle && (await isSessionIdleExpired(request, user))) {
        try {
          await supabase.auth.signOut();
        } catch {
          // The response still clears Buck's server-side activity cookie.
        }
        clearSupabaseAuthCookies(request, response);
        setNoStoreHeaders(response);

        return response;
      }

      const redirectResponse = NextResponse.redirect(
        createDashboardRedirect(request)
      );
      copyResponseCookies(response, redirectResponse);
      await refreshActivityCookie(redirectResponse, user.id);
      setNoStoreHeaders(redirectResponse);

      return redirectResponse;
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|map|txt|xml|mp3)$).*)",
  ],
};