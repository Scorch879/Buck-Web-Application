import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseCookieOptions,
  supabaseUrl,
} from "@/utils/supabaseConfig";

const SESSION_ACTIVITY_COOKIE = "buck-session-activity";

function setNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");
}

function clearCookie(response: NextResponse, name: string) {
  response.cookies.set(name, "", {
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 0,
  });
}

function clearAuthCookies(request: NextRequest, response: NextResponse) {
  clearCookie(response, SESSION_ACTIVITY_COOKIE);

  request.cookies.getAll().forEach(({ name }) => {
    const isSupabaseAuthCookie =
      name.startsWith("sb-") && name.includes("auth-token");

    if (isSupabaseAuthCookie) {
      clearCookie(response, name);
    }
  });
}

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  setNoStoreHeaders(response);

  if (!isSupabaseConfigured) {
    clearAuthCookies(request, response);
    return response;
  }

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
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

  try {
    await supabase.auth.signOut();
  } catch {
    // Still clear local cookies so this browser cannot reuse a stale session.
  }

  clearAuthCookies(request, response);

  return response;
}
