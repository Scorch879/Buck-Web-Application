import { getRequestAuth } from "@/utils/apiAuth";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/utils/supabase/admin";
import { countUnusedRecoveryCodes, getOpenEmailRecovery, mfaJson } from "@/utils/mfa/server";

/**
 * GET /api/auth/mfa/status: everything the Security settings and the
 * /verify-2fa page need. Works before the 2FA step (aal1), so the verify page
 * can offer the right recovery options.
 */
export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return mfaJson({ error: "Two-factor settings are not configured on the server." }, { status: 500 });
  }

  const auth = await getRequestAuth(request);

  if (!auth) {
    return mfaJson({ error: "You need to sign in again first." }, { status: 401 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const [recoveryCodesLeft, emailRecovery] = await Promise.all([
      countUnusedRecoveryCodes(admin, auth.user.id),
      getOpenEmailRecovery(admin, auth.user.id),
    ]);
    const confirmationExpired =
      emailRecovery &&
      !emailRecovery.confirmed_at &&
      Date.parse(emailRecovery.confirmation_expires_at) < Date.now();

    return mfaJson({
      currentLevel: auth.mfa.currentLevel,
      satisfied: auth.mfa.satisfied,
      enabled: auth.mfa.hasVerifiedFactor,
      factors: (auth.user.factors ?? [])
        .filter((factor) => factor.factor_type === "totp" && factor.status === "verified")
        .map((factor) => ({
          id: factor.id,
          friendlyName: factor.friendly_name ?? null,
          createdAt: factor.created_at,
        })),
      recoveryCodesLeft,
      emailRecovery:
        !emailRecovery || confirmationExpired
          ? null
          : emailRecovery.confirmed_at
            ? { state: "scheduled", availableAt: emailRecovery.available_at }
            : { state: "awaiting_email", expiresAt: emailRecovery.confirmation_expires_at },
    });
  } catch (error) {
    console.error("2FA status lookup failed:", error);
    return mfaJson({ error: "Could not load your two-factor settings." }, { status: 500 });
  }
}
