import { getRequestAuth } from "@/utils/apiAuth";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/utils/supabase/admin";
import {
  countSecurityEvents,
  getRetryAfterSeconds,
  hashClientIp,
  recordSecurityEvent,
  toIsoDate,
} from "@/utils/authRateLimit";
import { hashRecoveryCode, normalizeRecoveryCode } from "@/utils/mfa/recoveryCodes";
import { mfaJson, removeTwoFactor, signOutOtherSessions } from "@/utils/mfa/server";

const WINDOW_MS = 15 * 60 * 1000;
const USER_FAILURE_LIMIT = 5;
const IP_FAILURE_LIMIT = 20;
const INVALID_MESSAGE = "That backup code is not valid or was already used.";

/**
 * POST /api/auth/mfa/recovery-codes/redeem { code }: the "lost my phone"
 * path from /verify-2fa. Runs at aal1 (password only). A valid unused code
 * turns 2FA off (authenticators and remaining codes are removed), signs out
 * every other session, and the client then calls refreshSession() and is
 * asked to set 2FA up again. Supabase cannot mint aal2 for us, so removing
 * the factors is the only way to let the user in.
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
    return mfaJson({ error: "Two-factor authentication is not on for this account." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as { code?: unknown } | null;
  const code = normalizeRecoveryCode(body?.code);
  const userId = auth.user.id;
  const ipHash = hashClientIp(request);

  try {
    const admin = createSupabaseAdminClient();
    const since = toIsoDate(WINDOW_MS);
    const [userFailures, ipFailures] = await Promise.all([
      countSecurityEvents(admin, { eventType: "mfa_recovery_code", since, userId, outcomes: ["invalid"] }),
      countSecurityEvents(admin, { eventType: "mfa_recovery_code", since, ipHash, outcomes: ["invalid"] }),
    ]);

    if (userFailures >= USER_FAILURE_LIMIT || ipFailures >= IP_FAILURE_LIMIT) {
      await recordSecurityEvent(admin, { eventType: "mfa_recovery_code", outcome: "rate_limited", ipHash, userId });
      return mfaJson(
        { error: "Too many wrong backup codes. Please wait 15 minutes and try again." },
        { status: 429, retryAfterSeconds: getRetryAfterSeconds(WINDOW_MS) }
      );
    }

    if (!code) {
      await recordSecurityEvent(admin, { eventType: "mfa_recovery_code", outcome: "invalid", ipHash, userId });
      return mfaJson({ error: INVALID_MESSAGE }, { status: 400 });
    }

    // Atomic single use: only one request can flip used_at on this row.
    const { data: used, error: useError } = await admin
      .from("mfa_recovery_codes")
      .update({ used_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("code_hash", hashRecoveryCode(userId, code))
      .is("used_at", null)
      .select("id");

    if (useError) {
      throw new Error(useError.message);
    }

    if (!used?.length) {
      await recordSecurityEvent(admin, { eventType: "mfa_recovery_code", outcome: "invalid", ipHash, userId });
      return mfaJson({ error: INVALID_MESSAGE }, { status: 400 });
    }

    await removeTwoFactor(admin, userId);
    await signOutOtherSessions(admin, auth.accessToken);
    await recordSecurityEvent(admin, { eventType: "mfa_recovery_code", outcome: "success", ipHash, userId });

    return mfaJson({
      success: true,
      message: "Backup code accepted. Two-factor authentication is now off. Set it up again in Settings › Security.",
    });
  } catch (error) {
    console.error("Backup code redemption failed:", error);
    return mfaJson({ error: "Could not check that backup code. Please try again." }, { status: 500 });
  }
}
