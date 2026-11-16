import { NextResponse } from "next/server";
import { getRequestAuth, mfaRequiredResponse } from "@/utils/apiAuth";
import {
  canAccountResetPassword,
  getAuthAccountCapabilitiesByUserId,
  getCapabilitiesFromUser,
} from "@/utils/authCapabilities";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/utils/supabase/admin";

function jsonNoStore(payload: Record<string, unknown>, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store, max-age=0" },
  });
}

/**
 * GET /api/auth/credentials: authoritative credential capabilities for the
 * signed-in user (password identity, Google identity, passkeys, and whether
 * password reset is allowed).
 */
export async function GET(request: Request) {
  const auth = await getRequestAuth(request);

  if (!auth) {
    return jsonNoStore({ error: "You need to sign in again first." }, 401);
  }

  if (!auth.mfa.satisfied) {
    return mfaRequiredResponse();
  }

  try {
    const capabilities = isSupabaseAdminConfigured
      ? await getAuthAccountCapabilitiesByUserId(
          createSupabaseAdminClient(),
          auth.user.id
        )
      : getCapabilitiesFromUser(auth.user);

    const isPasswordUser =
      capabilities.hasEmailIdentity || capabilities.hasPassword;
    const isGoogleOnlyUser =
      capabilities.hasGoogleIdentity && !isPasswordUser;
    const canResetPassword = canAccountResetPassword(capabilities);

    return jsonNoStore({
      isPasswordUser,
      isGoogleOnlyUser,
      hasEmailIdentity: capabilities.hasEmailIdentity,
      hasGoogleIdentity: capabilities.hasGoogleIdentity,
      hasPassword: capabilities.hasPassword,
      hasPasskey: capabilities.hasPasskey,
      canResetPassword,
    });
  } catch (error) {
    console.error("Auth credentials lookup failed:", error);
    return jsonNoStore(
      { error: "Could not load your account credential capabilities." },
      500
    );
  }
}
