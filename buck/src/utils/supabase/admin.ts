import { createClient } from "@supabase/supabase-js";
import {
  getSupabaseAdminEnv,
  isSupabaseAdminConfigured,
} from "@/utils/supabaseConfig";

export { isSupabaseAdminConfigured };

export function createSupabaseAdminClient() {
  const { url, serviceRoleKey } = getSupabaseAdminEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
