import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { getRequestAuth, mfaRequiredResponse } from "@/utils/apiAuth";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/utils/supabase/admin";
import { supabaseAnonKey, supabaseUrl } from "@/utils/supabaseConfig";
import {
  countSecurityEvents,
  getRetryAfterSeconds,
  hashClientIp,
  recordSecurityEvent,
  toIsoDate,
} from "@/utils/authRateLimit";
import {
  EMAIL_RECOVERY_CONFIRM_MINUTES,
  EMAIL_RECOVERY_CONFIRM_PATH,
  getEmailRecoveryDelayMs,
  getOpenEmailRecovery,
  getSiteOrigin,
  hashRecoveryToken,
  mfaJson,
} from "@/utils/mfa/server";

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_LIMIT = 3;

function formatDelay() {
  const hours = Math.round(getEmailRecoveryDelayMs() / (60 * 60 * 1000));
  return `${hours} hour${hours === 1 ? "" : "s"}`;
}

/**
 * POST /api/auth/mfa/email-recovery: "email me a recovery link" from
 * /verify-2fa (aal1, password only). Sends a sign-in link; opening it within
 * 30 minutes schedules 2FA removal for 24 hours later
 * (/account/mfa/recover/confirm, then POST ./complete). The real owner can
 * cancel during that window with DELETE.
 */
export async function POST(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return mfaJson({ error: "Two-factor settings are not configured on the server." }, { status: 500 });
  }

  const auth = await getRequestAuth(request);

  if (!auth?.user.email) {
    return mfaJson({ error: "You need to sign in again first." }, { status: 401 });
  }

  if (!auth.mfa.hasVerifiedFactor) {
    return mfaJson({ error: "Two-factor authentication is not on for this account." }, { status: 400 });
  }

  const userId = auth.user.id;
  const ipHash = hashClientIp(request);

  try {
    const admin = createSupabaseAdminClient();
    const open = await getOpenEmailRecovery(admin, userId);

    if (open?.confirmed_at) {
      return mfaJson({
        success: true,
        state: "scheduled",
        availableAt: open.available_at,
        message: "A recovery is already scheduled for this account.",
      });
    }

    const sentToday = await countSecurityEvents(admin, {
      eventType: "mfa_email_recovery",
      since: toIsoDate(DAY_MS),
      userId,
      outcomes: ["sent"],
    });

    if (sentToday >= DAILY_LIMIT) {
      await recordSecurityEvent(admin, { eventType: "mfa_email_recovery", outcome: "rate_limited", ipHash, userId });
      return mfaJson(
        { error: "Too many recovery emails today. Please try again tomorrow." },
        { status: 429, retryAfterSeconds: getRetryAfterSeconds(DAY_MS) }
      );
    }

    // An unconfirmed earlier link is replaced by the new one.
    if (open) {
      const { error: cancelError } = await admin
        .from("mfa_email_recovery_requests")
        .update({ canceled_at: new Date().toISOString() })
        .eq("id", open.id);

      if (cancelError) {
        throw new Error(cancelError.message);
      }
    }

    const token = randomBytes(32).toString("base64url");
    const { data: created, error: insertError } = await admin
      .from("mfa_email_recovery_requests")
      .insert({
        user_id: userId,
        token_hash: hashRecoveryToken(token),
        confirmation_expires_at: new Date(Date.now() + EMAIL_RECOVERY_CONFIRM_MINUTES * 60 * 1000).toISOString(),
      })
      .select("id")
      .single<{ id: string }>();

    if (insertError || !created) {
      throw new Error(insertError?.message ?? "Recovery request was not created.");
    }

    const confirmPath = `${EMAIL_RECOVERY_CONFIRM_PATH}?${new URLSearchParams({
      request: created.id,
      token,
    }).toString()}`;
    const callbackUrl = new URL("/auth/callback", getSiteOrigin(request));
    callbackUrl.searchParams.set("next", confirmPath);

    const mailClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { error: otpError } = await mailClient.auth.signInWithOtp({
      email: auth.user.email,
      options: { emailRedirectTo: callbackUrl.toString(), shouldCreateUser: false },
    });

    if (otpError) {
      await recordSecurityEvent(admin, { eventType: "mfa_email_recovery", outcome: "provider_error", ipHash, userId });
      throw new Error(otpError.message);
    }

    await recordSecurityEvent(admin, { eventType: "mfa_email_recovery", outcome: "sent", ipHash, userId });

    return mfaJson({
      success: true,
      state: "awaiting_email",
      message: `Recovery link sent. Open it within ${EMAIL_RECOVERY_CONFIRM_MINUTES} minutes. For your safety, two-factor authentication is removed ${formatDelay()} after you confirm.`,
    });
  } catch (error) {
    console.error("2FA email recovery request failed:", error);
    return mfaJson({ error: "Could not send a recovery email right now. Please try again later." }, { status: 500 });
  }
}

/**
 * DELETE /api/auth/mfa/email-recovery: cancels a pending recovery. Needs a
 * session that passed 2FA, so only someone holding the authenticator can stop
 * it, which is the point of the 24 h window.
 */
export async function DELETE(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return mfaJson({ error: "Two-factor settings are not configured on the server." }, { status: 500 });
  }

  const auth = await getRequestAuth(request);

  if (!auth) {
    return mfaJson({ error: "You need to sign in again first." }, { status: 401 });
  }

  if (!auth.mfa.satisfied) {
    return mfaRequiredResponse();
  }

  try {
    const admin = createSupabaseAdminClient();
    const { data, error } = await admin
      .from("mfa_email_recovery_requests")
      .update({ canceled_at: new Date().toISOString() })
      .eq("user_id", auth.user.id)
      .is("completed_at", null)
      .is("canceled_at", null)
      .select("id");

    if (error) {
      throw new Error(error.message);
    }

    if (data?.length) {
      await recordSecurityEvent(admin, {
        eventType: "mfa_email_recovery",
        outcome: "canceled",
        ipHash: hashClientIp(request),
        userId: auth.user.id,
      });
    }

    return mfaJson({
      success: true,
      canceled: Boolean(data?.length),
      message: data?.length ? "Recovery canceled. Your two-factor authentication stays on." : "There was no recovery to cancel.",
    });
  } catch (error) {
    console.error("2FA email recovery cancel failed:", error);
    return mfaJson({ error: "Could not cancel the recovery. Please try again." }, { status: 500 });
  }
}
