import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import type { Session } from "@supabase/supabase-js";
import {
  createMfaVerifyPath,
  EMAIL_RECOVERY_CONFIRM_PATH,
  getMfaState,
  OAUTH_CONSENT_PATH,
} from "@/utils/mfa/assurance";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseCookieOptions,
  supabaseUrl,
} from "@/utils/supabaseConfig";

function getSafeNextPath(value: string | null) {
  if (!value) return "/dashboard/home";

  try {
    // We use a dummy base URL strictly for parsing purposes to utilize the native URL object.
    // This ensures the value is a relative path. If the attacker provides an absolute URL 
    // (e.g. "https://evil.com"), the origin will NOT match the dummy base, and it will be rejected.
    // This works flawlessly in production because it only returns the relative pathname.
    const parsedUrl = new URL(value, "http://dummy.local");
    
    if (
      parsedUrl.origin === "http://dummy.local" && 
      (parsedUrl.pathname.startsWith("/dashboard") ||
        parsedUrl.pathname === "/forgot-password" ||
        // Account-deletion confirmation link (sent by /api/account/deletion/request).
        parsedUrl.pathname === "/account/delete/confirm" ||
        // 2FA email recovery link (sent by /api/auth/mfa/email-recovery).
        parsedUrl.pathname === EMAIL_RECOVERY_CONFIRM_PATH ||
        // Connected-app consent, after Google or magic-link sign-in (ADR-049).
        parsedUrl.pathname === OAUTH_CONSENT_PATH)
    ) {
      return parsedUrl.pathname + parsedUrl.search;
    }
  } catch {
    // If parsing fails, fall through to default
  }

  return "/dashboard/home";
}

function createAppRedirect(request: NextRequest, path: string) {
  return new URL(getSafeNextPath(path), request.nextUrl.origin);
}

function createSignInRedirect(request: NextRequest, error: string) {
  const redirectUrl = new URL("/sign-in", request.nextUrl.origin);
  redirectUrl.searchParams.set("error", error);

  return redirectUrl;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.redirect(
      createSignInRedirect(request, "supabase-not-configured")
    );
  }

  const code = request.nextUrl.searchParams.get("code");
  const token_hash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type") as "recovery" | "invite" | "signup" | "magiclink" | "email" | null;
  const nextPath = getSafeNextPath(request.nextUrl.searchParams.get("next"));
  const redirectResponse = NextResponse.redirect(
    createAppRedirect(request, nextPath)
  );

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          redirectResponse.cookies.set(name, value, options);
        });
      },
    },
  });

  if (!code && !token_hash) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      return redirectResponse;
    }

    // Fallback for implicit flow (hash fragment)
    // If the URL has a hash fragment, the server can't see it.
    // We return a small HTML page that checks the hash and either redirects to the nextPath or to sign-in.
    // To prevent XSS, we pass dynamic variables via safe HTML attributes instead of inline JS injection.
    const fallbackUrl = createSignInRedirect(request, "auth-callback-missing-code").toString();
    // The CSP (middleware.ts) only runs inline scripts that carry this request's nonce.
    const nonce = request.headers.get("x-nonce");

    // Basic HTML escaping for attributes
    const escapeHtml = (str: string) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    const nonceAttribute = nonce ? ` nonce="${escapeHtml(nonce)}"` : "";

    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <meta id="redirect-data" data-next="${escapeHtml(nextPath)}" data-fallback="${escapeHtml(fallbackUrl)}" />
          <script${nonceAttribute}>
            const meta = document.getElementById("redirect-data");
            const nextPath = meta.getAttribute("data-next");
            const fallbackPath = meta.getAttribute("data-fallback");
            
            if (window.location.hash && window.location.hash.includes("access_token")) {
              window.location.replace(nextPath + window.location.hash);
            } else {
              window.location.replace(fallbackPath);
            }
          </script>
        </head>
        <body>Redirecting...</body>
      </html>
      `,
      { headers: { "Content-Type": "text/html" } }
    );
  }

  if (token_hash && type) {
    const { data, error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) {
      console.error("Auth callback OTP verification failed:", error.message);
      return NextResponse.redirect(createSignInRedirect(request, "auth-callback-failed"));
    }
    return gateTwoFactor(request, redirectResponse, nextPath, data.session);
  }

  if (code) {
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback exchange failed:", error.message);

      return NextResponse.redirect(
        createSignInRedirect(request, "auth-callback-failed")
      );
    }

    return gateTwoFactor(request, redirectResponse, nextPath, data.session);
  }

  return redirectResponse;
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
  const isRecoveryLink = nextPath.startsWith(EMAIL_RECOVERY_CONFIRM_PATH);

  if (!session || isRecoveryLink || getMfaState(session.user, session.access_token).satisfied) {
    return redirectResponse;
  }

  redirectResponse.headers.set(
    "Location",
    new URL(createMfaVerifyPath(nextPath), request.nextUrl.origin).toString()
  );

  return redirectResponse;
}
