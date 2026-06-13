import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
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
      (parsedUrl.pathname.startsWith("/dashboard") || parsedUrl.pathname === "/forgot-password")
    ) {
      return parsedUrl.pathname + parsedUrl.search;
    }
  } catch (e) {
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
    
    // Basic HTML escaping for attributes
    const escapeHtml = (str: string) => str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");

    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <meta id="redirect-data" data-next="${escapeHtml(nextPath)}" data-fallback="${escapeHtml(fallbackUrl)}" />
          <script>
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
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) {
      console.error("Auth callback OTP verification failed:", error.message);
      return NextResponse.redirect(createSignInRedirect(request, "auth-callback-failed"));
    }
    return redirectResponse;
  }

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error("Auth callback exchange failed:", error.message);

      return NextResponse.redirect(
        createSignInRedirect(request, "auth-callback-failed")
      );
    }
  }

  return redirectResponse;
}
