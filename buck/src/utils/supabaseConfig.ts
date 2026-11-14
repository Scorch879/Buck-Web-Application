import type { CookieOptionsWithName } from "@supabase/ssr";

export const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
export const supabaseAnonKey =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
export const supabaseServiceRoleKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);
export const isSupabaseAdminConfigured = Boolean(
  supabaseUrl && supabaseServiceRoleKey
);

export const supabaseConfigError = isSupabaseConfigured
  ? ""
  : "Supabase authentication is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your environment, then redeploy.";

export function getSupabaseEnv(): { url: string; anonKey: string } {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error("Supabase is not configured.");
  }
  return { url: supabaseUrl, anonKey: supabaseAnonKey };
}

export function getSupabaseAdminEnv(): { url: string; serviceRoleKey: string } {
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    throw new Error(
      "Supabase admin actions are not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment."
    );
  }
  return { url: supabaseUrl, serviceRoleKey: supabaseServiceRoleKey };
}

export const supabaseCookieOptions: CookieOptionsWithName = {
  path: "/",
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
};
