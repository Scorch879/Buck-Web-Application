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

  if (!code) {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) {
      return redirectResponse;
    }

    return NextResponse.redirect(
      createSignInRedirect(request, "auth-callback-missing-code")
    );
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    console.error("Auth callback exchange failed:", error.message);

    return NextResponse.redirect(
      createSignInRedirect(request, "auth-callback-failed")
    );
  }

  return redirectResponse;
}
