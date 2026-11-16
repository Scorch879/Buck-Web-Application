import { createClient } from "@supabase/supabase-js";
import { supabaseAnonKey, supabaseUrl } from "@/utils/supabaseConfig";

/** Stateless Supabase client (no cookie session or auto-refresh) for token verification, password checks, and OTP mailers. */
export function createSupabaseStatelessClient() {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
