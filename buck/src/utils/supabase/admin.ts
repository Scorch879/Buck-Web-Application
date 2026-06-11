import { createClient } from "@supabase/supabase-js";
import {
  isSupabaseAdminConfigured,
  supabaseServiceRoleKey,
  supabaseUrl,
} from "@/utils/supabaseConfig";

export { isSupabaseAdminConfigured };

export function createSupabaseAdminClient() {
  if (!isSupabaseAdminConfigured) {
    throw new Error(
      "Supabase admin actions are not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment."
    );
  }

  return createClient(supabaseUrl!, supabaseServiceRoleKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
