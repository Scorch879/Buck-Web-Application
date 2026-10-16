import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createInvalidatingFetch } from "@/utils/dataCache";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseConfigError,
  supabaseCookieOptions,
  supabaseUrl,
} from "@/utils/supabaseConfig";

export { isSupabaseConfigured, supabaseConfigError };

export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createBrowserClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        persistSession: true,
      },
      cookieOptions: supabaseCookieOptions,
      // Mutating requests invalidate the shared list cache (utils/dataCache.ts).
      global: { fetch: createInvalidatingFetch() },
    })
  : null;

export function getSupabaseClient() {
  if (!supabase) {
    throw new Error("Supabase is not configured.");
  }

  return supabase;
}
