import { createClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/utils/supabaseConfig";

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

/** Returns the token from `Authorization: Bearer <token>`, or null. */
export function readBearerToken(header: string | null) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return match ? match[1] : null;
}

/**
 * For routes shared by web and mobile. A request with
 * `Authorization: Bearer <Supabase access token>` (the Flutter app) is
 * verified against Supabase Auth, so expired, revoked and signed-out tokens
 * are rejected; it never falls back to cookies. Without the header the web
 * session cookie is used. Either way the id comes only from Supabase.
 */
export async function getRequestUserId(req: Request): Promise<string | null> {
  const token = readBearerToken(req.headers.get("authorization"));
  if (!token) return getSessionUserId();
  if (!isSupabaseConfigured) return null;

  try {
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    return error || !user ? null : user.id;
  } catch {
    return null;
  }
}
