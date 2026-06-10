import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseCookieOptions,
  supabaseUrl,
} from "@/utils/supabaseConfig";

export { isSupabaseConfigured as isSupabaseServerConfigured };

export async function createSupabaseServerClient() {
  if (!isSupabaseConfigured) {
    throw new Error("Supabase is not configured.");
  }

  const cookieStore = await cookies();

  return createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server components cannot always write cookies. Middleware performs
          // the refresh/write path before rendering protected pages.
        }
      },
    },
  });
}
