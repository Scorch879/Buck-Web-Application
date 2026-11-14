import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createInvalidatingFetch } from "@/utils/dataCache";
import {
  getSupabaseEnv,
  isSupabaseConfigured,
  supabaseConfigError,
  supabaseCookieOptions,
} from "@/utils/supabaseConfig";

export { isSupabaseConfigured, supabaseConfigError };

const supabaseEnv = isSupabaseConfigured ? getSupabaseEnv() : null;

export const supabase: SupabaseClient | null = supabaseEnv
  ? createBrowserClient(supabaseEnv.url, supabaseEnv.anonKey, {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "pkce",
        persistSession: true,
        // Passkey sign-in/registration (ADR-048). Experimental in supabase-js.
        experimental: { passkey: true },
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
