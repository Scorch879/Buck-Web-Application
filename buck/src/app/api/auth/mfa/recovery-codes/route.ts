import { getRequestAuth, mfaRequiredResponse } from "@/utils/apiAuth";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/utils/supabase/admin";
import { hashClientIp, recordSecurityEvent } from "@/utils/authRateLimit";
import { generateRecoveryCodes, hashRecoveryCode, normalizeRecoveryCode } from "@/utils/mfa/recoveryCodes";
import { mfaJson } from "@/utils/mfa/server";

/**
 * POST /api/auth/mfa/recovery-codes: (re)generates the 10 backup codes and
 * returns them in plain text exactly once. Old codes stop working. Needs a
 * verified authenticator and a session that already passed 2FA.
 */
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return mfaJson({ error: "Two-factor settings are not configured on the server." }, { status: 500 });
  }

  const auth = await getRequestAuth(request);

  if (!auth) {
    return mfaJson({ error: "You need to sign in again first." }, { status: 401 });
  }

  if (!auth.mfa.hasVerifiedFactor) {
    return mfaJson({ error: "Turn on two-factor authentication first." }, { status: 400 });
  }

  if (!auth.mfa.satisfied) {
    return mfaRequiredResponse();
  }

  try {
    const admin = createSupabaseAdminClient();
    const userId = auth.user.id;
    const codes = generateRecoveryCodes();
    const rows = codes.map((code) => ({
      user_id: userId,
      code_hash: hashRecoveryCode(userId, normalizeRecoveryCode(code)!),
    }));

    const { error: deleteError } = await admin.from("mfa_recovery_codes").delete().eq("user_id", userId);

    if (deleteError) {
      throw new Error(deleteError.message);
    }

    const { error: insertError } = await admin.from("mfa_recovery_codes").insert(rows);

    if (insertError) {
      throw new Error(insertError.message);
    }

    await recordSecurityEvent(admin, {
      eventType: "mfa_recovery_codes_generated",
      outcome: "success",
      ipHash: hashClientIp(request),
      userId,
    });

    return mfaJson({
      codes,
      message: "Save these backup codes somewhere safe. Each one works once, and they will not be shown again.",
    });
  } catch (error) {
    console.error("Backup code generation failed:", error);
    return mfaJson({ error: "Could not create backup codes. Please try again." }, { status: 500 });
  }
}
