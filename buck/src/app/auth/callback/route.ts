import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseCookieOptions,
  supabaseUrl,
} from "@/utils/supabaseConfig";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard/home";
  }

  return value;
}

function escapeForInlineJsString(value: string) {
  // Produces a JavaScript-string-safe representation (without surrounding quotes).
  return JSON.stringify(value).slice(1, -1);
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
    const escapedNextPath = escapeForInlineJsString(nextPath);
    const escapedMissingCodeRedirect = escapeForInlineJsString(
      createSignInRedirect(request, "auth-callback-missing-code").toString()
    );

    return new NextResponse(
      `
      <!DOCTYPE html>
      <html>
        <head>
          <script>
            if (window.location.hash && window.location.hash.includes("access_token")) {
              window.location.replace("${escapedNextPath}" + window.location.hash);
            } else {
              window.location.replace("${escapedMissingCodeRedirect}");
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
