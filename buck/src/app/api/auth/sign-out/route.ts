import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { clearAuthCookies, setNoStoreHeaders } from "@/utils/httpResponse";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseCookieOptions,
  supabaseUrl,
} from "@/utils/supabaseConfig";

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
