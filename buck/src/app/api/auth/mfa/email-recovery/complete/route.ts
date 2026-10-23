import { getRequestAuth } from "@/utils/apiAuth";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/utils/supabase/admin";
import { hashClientIp, recordSecurityEvent } from "@/utils/authRateLimit";
import { getOpenEmailRecovery, mfaJson, removeTwoFactor, signOutOtherSessions } from "@/utils/mfa/server";

/**
 * POST /api/auth/mfa/email-recovery/complete: after the 24 h cool-off of a
 * confirmed email recovery, turns 2FA off (aal1 is enough) and signs out
 * every other session. The client then calls refreshSession().
 */
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return mfaJson({ error: "Two-factor settings are not configured on the server." }, { status: 500 });
  }

  const auth = await getRequestAuth(request);

  if (!auth) {
    return mfaJson({ error: "You need to sign in again first." }, { status: 401 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const open = await getOpenEmailRecovery(admin, auth.user.id);

    if (!open?.confirmed_at || !open.available_at) {
      return mfaJson({ error: "There is no confirmed recovery for this account." }, { status: 400 });
    }

    const availableAtMs = Date.parse(open.available_at);

    if (Date.now() < availableAtMs) {
      return mfaJson(
        {
          error: "Your recovery is still in its safety window.",
          availableAt: open.available_at,
        },
        { status: 409, retryAfterSeconds: Math.ceil((availableAtMs - Date.now()) / 1000) }
      );
    }

    await removeTwoFactor(admin, auth.user.id);
    await signOutOtherSessions(admin, auth.accessToken);
    await recordSecurityEvent(admin, {
      eventType: "mfa_email_recovery",
      outcome: "success",
      ipHash: hashClientIp(request),
      userId: auth.user.id,
    });

    return mfaJson({
      success: true,
      message: "Two-factor authentication is now off. Set it up again in Settings › Security.",
    });
  } catch (error) {
    console.error("2FA email recovery completion failed:", error);
    return mfaJson({ error: "Could not finish the recovery. Please try again." }, { status: 500 });
  }
}
