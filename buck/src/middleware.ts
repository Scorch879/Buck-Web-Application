import { createServerClient } from "@supabase/ssr/dist/module/createServerClient";
import { NextResponse, type NextRequest } from "next/server";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseCookieOptions,
  supabaseUrl,
} from "@/utils/supabaseConfig";

const SESSION_ACTIVITY_COOKIE = "buck-session-activity";
const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;
const AUTH_ROUTES = new Set(["/sign-in", "/create-account", "/forgot-password"]);

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
  const redirectUrl = request.nextUrl.clone();
  const requestedRedirect = request.nextUrl.searchParams.get("redirectTo");

  redirectUrl.pathname = getSafeRedirectPath(requestedRedirect);
  redirectUrl.search = "";

  return redirectUrl;
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

    if (activity.sub !== userId || !Number.isFinite(activity.ts)) {
      return "invalid" as const;
    }

    return activity;
  } catch {
    return "invalid" as const;
  }
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
  const { pathname } = request.nextUrl;
  const isProtectedRoute = pathname.startsWith("/dashboard");
  const isAuthRoute = AUTH_ROUTES.has(pathname);
  const sessionCookieSecret = getSessionCookieSecret();
  const shouldEnforceServerIdle = Boolean(sessionCookieSecret);
  let response = NextResponse.next({ request });

  if (isRootAuthReturn(request)) {
    const redirectResponse = NextResponse.redirect(
      createAuthCallbackRedirect(request)
    );
    setNoStoreHeaders(redirectResponse);

    return redirectResponse;
  }

  if (!isProtectedRoute && !isAuthRoute) {
    return response;
  }

  setNoStoreHeaders(response);

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

  if (isProtectedRoute && (error || !user)) {
    const redirectResponse = NextResponse.redirect(
      createProtectedRedirect(request)
    );
    copyResponseCookies(response, redirectResponse);
    setNoStoreHeaders(redirectResponse);

    return redirectResponse;
  }

  if (pathname.startsWith("/dashboard/admin") && user?.email !== "buckthebudgettracker@gmail.com") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard/home";
    redirectUrl.search = "";
    const redirectResponse = NextResponse.redirect(redirectUrl);
    setNoStoreHeaders(redirectResponse);

    return redirectResponse;
  }

  if (isProtectedRoute && user && shouldEnforceServerIdle) {
    const activity = await readActivityCookie(request, user.id);
    const timeoutMs = getIdleTimeoutMs();
    const isExpired =
      activity === "invalid" ||
      (activity !== null && timeoutMs > 0 && Date.now() - activity.ts > timeoutMs);

    if (isExpired) {
      response = NextResponse.redirect(
        createProtectedRedirect(request, "session-expired")
      );
      try {
        await supabase.auth.signOut();
      } catch {
        // The redirect still clears Buck's server-side activity cookie.
      }
      clearActivityCookie(response);
      setNoStoreHeaders(response);

      return response;
    }

    await refreshActivityCookie(response, user.id);
  }

  if (isAuthRoute && user) {
    const isRecoveryMode =
      pathname === "/forgot-password" &&
      request.nextUrl.searchParams.get("type") === "recovery";

    if (!isRecoveryMode) {
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