import { createSupabaseServerClient } from "@/utils/supabase/server";

/**
 * Resolves the authenticated user id from the SSR session cookie only.
 * Never accept a user id from the request body: route handlers use the
 * service-role client, which bypasses RLS.
 */
export async function getSessionUserId(): Promise<string | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    return error || !user ? null : user.id;
  } catch {
    return null;
  }
}
