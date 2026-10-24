import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

/** Shared by the /api/auth/mfa/* routes and /account/mfa/recover/confirm. */

export { EMAIL_RECOVERY_CONFIRM_PATH } from "@/utils/mfa/assurance";

const DEFAULT_EMAIL_RECOVERY_DELAY_HOURS = 24;
export const EMAIL_RECOVERY_CONFIRM_MINUTES = 30;

export type EmailRecoveryRow = {
  id: string;
  user_id: string;
  token_hash: string;
  requested_at: string;
  confirmation_expires_at: string;
  confirmed_at: string | null;
  available_at: string | null;
};

export function mfaJson(
  payload: Record<string, unknown>,
  init: { status?: number; retryAfterSeconds?: number } = {}
) {
  const response = NextResponse.json(payload, { status: init.status ?? 200 });
  response.headers.set("Cache-Control", "no-store, max-age=0");

  if (init.retryAfterSeconds) {
    response.headers.set("Retry-After", String(init.retryAfterSeconds));
  }

  return response;
}

/**
 * The cool-off between confirming an email recovery and 2FA being removed.
 * Production never goes below 24 h: without it, 2FA would be only as strong
 * as the e-mail inbox.
 */
export function getEmailRecoveryDelayMs() {
  const parsed = Number(process.env.MFA_EMAIL_RECOVERY_DELAY_HOURS);
  const hours = Number.isFinite(parsed) && parsed >= 0 ? parsed : DEFAULT_EMAIL_RECOVERY_DELAY_HOURS;
  const floor = process.env.NODE_ENV === "production" ? DEFAULT_EMAIL_RECOVERY_DELAY_HOURS : 0;

  return Math.max(hours, floor) * 60 * 60 * 1000;
}

export function hashRecoveryToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export function recoveryTokenMatches(token: string, expectedHash: string) {
  const actual = Buffer.from(hashRecoveryToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");

  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export function getSiteOrigin(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();

    if (configured) {
      try {
        return new URL(/^https?:\/\//i.test(configured) ? configured : `https://${configured}`).origin;
      } catch {
        console.warn("NEXT_PUBLIC_SITE_URL is not a valid URL.");
      }
    }
  }

  return new URL(request.url).origin;
}

/** The user's single open (not completed, not canceled) email recovery. */
export async function getOpenEmailRecovery(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin
    .from("mfa_email_recovery_requests")
    .select("id, user_id, token_hash, requested_at, confirmation_expires_at, confirmed_at, available_at")
    .eq("user_id", userId)
    .is("completed_at", null)
    .is("canceled_at", null)
    .maybeSingle<EmailRecoveryRow>();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export async function countUnusedRecoveryCodes(admin: SupabaseClient, userId: string) {
  const { count, error } = await admin
    .from("mfa_recovery_codes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("used_at", null);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

/**
 * Turns 2FA off for a user: deletes every TOTP factor (verified or not), all
 * backup codes, and closes any open email recovery. Passkeys are sign-in
 * methods, not factors, so they stay. Returns the number of factors removed.
 */
export async function removeTwoFactor(admin: SupabaseClient, userId: string) {
  const { data, error } = await admin.auth.admin.mfa.listFactors({ userId });

  if (error) {
    throw new Error(error.message);
  }

  const totpFactors = (data?.factors ?? []).filter((factor) => factor.factor_type === "totp");

  for (const factor of totpFactors) {
    const { error: deleteError } = await admin.auth.admin.mfa.deleteFactor({
      id: factor.id,
      userId,
    });

    if (deleteError) {
      throw new Error(deleteError.message);
    }
  }

  const { error: codesError } = await admin.from("mfa_recovery_codes").delete().eq("user_id", userId);

  if (codesError) {
    throw new Error(codesError.message);
  }

  const { error: recoveryError } = await admin
    .from("mfa_email_recovery_requests")
    .update({ completed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("completed_at", null)
    .is("canceled_at", null);

  if (recoveryError) {
    throw new Error(recoveryError.message);
  }

  return totpFactors.length;
}

/** Ends every other session of this user (best effort). */
export async function signOutOtherSessions(admin: SupabaseClient, accessToken: string) {
  if (!accessToken) {
    return;
  }

  const { error } = await admin.auth.admin.signOut(accessToken, "others");

  if (error) {
    console.warn("Could not sign out other sessions after 2FA recovery:", error.message);
  }
}
