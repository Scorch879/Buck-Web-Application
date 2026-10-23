import { createClient, type User } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { isSupabaseConfigured, supabaseAnonKey, supabaseUrl } from "@/utils/supabaseConfig";
import { getMfaState, type MfaState } from "@/utils/mfa/assurance";

export type RequestAuth = {
  user: User;
  /** The verified Supabase access token (cookie session or mobile bearer). */
  accessToken: string;
  mfa: MfaState;
};

/**
 * Resolves the authenticated user id from the SSR session cookie only.
 * Never accept a user id from the request body: route handlers use the
 * service-role client, which bypasses RLS.
 */
export async function getSessionUserId(): Promise<string | null> {
  const auth = await getSessionAuth();
  return auth?.mfa.satisfied ? auth.user.id : null;
}

/** Returns the token from `Authorization: Bearer <token>`, or null. */
export function readBearerToken(header: string | null) {
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header ?? "");
  return match ? match[1] : null;
}

async function getSessionAuth(): Promise<RequestAuth | null> {
  try {
    const supabase = await createSupabaseServerClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return null;
    }

    // getUser() above verified this session's access token with Supabase Auth,
    // so its aal claim can be trusted.
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const accessToken = session?.access_token ?? "";

    return { user, accessToken, mfa: getMfaState(user, accessToken) };
  } catch {
    return null;
  }
}

/**
 * For routes shared by web and mobile. A request with
 * `Authorization: Bearer <Supabase access token>` (the Flutter app) is
 * verified against Supabase Auth, so expired, revoked and signed-out tokens
 * are rejected; it never falls back to cookies. Without the header the web
 * session cookie is used. Either way the id comes only from Supabase.
 *
 * Does NOT require 2FA: check `auth.mfa.satisfied` (or use getRequestUserId).
 */
export async function getRequestAuth(req: Request): Promise<RequestAuth | null> {
  const token = readBearerToken(req.headers.get("authorization"));
  if (!token) return getSessionAuth();
  if (!isSupabaseConfigured) return null;

  try {
    const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(token);
    return error || !user ? null : { user, accessToken: token, mfa: getMfaState(user, token) };
  } catch {
    return null;
  }
}

/** The caller's id, or null when signed out OR still owing the 2FA code. */
export async function getRequestUserId(req: Request): Promise<string | null> {
  const auth = await getRequestAuth(req);
  return auth?.mfa.satisfied ? auth.user.id : null;
}

/** 401 for a session that still owes its authenticator code. */
export function mfaRequiredResponse() {
  return NextResponse.json(
    { error: "mfa_required", message: "Enter your two-factor code first." },
    { status: 401, headers: { "Cache-Control": "no-store, max-age=0" } }
  );
}
