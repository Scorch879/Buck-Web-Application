import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import {
  getSupabaseEnv,
  isSupabaseConfigured,
  supabaseCookieOptions,
} from "@/utils/supabaseConfig";

export { isSupabaseConfigured as isSupabaseServerConfigured };

export async function createSupabaseServerClient() {
  const { url, anonKey } = getSupabaseEnv();

  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
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
