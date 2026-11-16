import { NextResponse, type NextRequest } from "next/server";

export const SESSION_ACTIVITY_COOKIE = "buck-session-activity";

/** Clears the HMAC activity cookie immediately (e.g. when idle expiry or session mismatch triggers). */
export function clearActivityCookie(response: NextResponse) {
  response.cookies.set(SESSION_ACTIVITY_COOKIE, "", {
    path: "/",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

/** Clears the session activity cookie and every `sb-*-auth-token*` cookie present on the request. */
export function clearAuthCookies(
  request: NextRequest,
  response: NextResponse,
  httpOnlySupabase = false
) {
  clearActivityCookie(response);

  request.cookies.getAll().forEach(({ name }) => {
    if (name.startsWith("sb-") && name.includes("auth-token")) {
      response.cookies.set(name, "", {
        path: "/",
        httpOnly: httpOnlySupabase,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 0,
      });
    }
  });
}

/** Applies strict no-store cache headers to sensitive SSR / API responses. */
export function setNoStoreHeaders<T extends NextResponse>(response: T): T {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
  return response;
}

/** Propagates cookies and cache headers accumulated on a Supabase helper response onto a redirect/error response. */
export function copyResponseCookies(source: NextResponse, target: NextResponse): NextResponse {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });

  ["cache-control", "expires", "pragma"].forEach((header) => {
    const value = source.headers.get(header);
    if (value) {
      target.headers.set(header, value);
    }
  });

  return target;
}

/** Resolves the public origin for confirmation/reset email redirects (prefers NEXT_PUBLIC_SITE_URL outside development). */
export function getSiteOrigin(request: Request): string {
  if (process.env.NODE_ENV !== "development") {
    const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
    if (configured) {
      try {
        return new URL(/^https?:\/\//i.test(configured) ? configured : `https://${configured}`).origin;
      } catch {
        console.warn("NEXT_PUBLIC_SITE_URL is not a valid URL.");
      }
    }
  }

  return new URL(request.url).origin;
}
