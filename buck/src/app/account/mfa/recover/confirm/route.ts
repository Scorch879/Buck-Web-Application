import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { isSupabaseAdminConfigured } from "@/utils/supabaseConfig";
import { hashClientIp, recordSecurityEvent } from "@/utils/authRateLimit";
import { MFA_VERIFY_PATH } from "@/utils/mfa/assurance";
import { getEmailRecoveryDelayMs, recoveryTokenMatches } from "@/utils/mfa/server";

/**
 * GET /account/mfa/recover/confirm?request=…&token=…: target of the 2FA
 * recovery email (via /auth/callback, which signs the user in at aal1 and
 * skips the 2FA step for this path only). Confirms the request and starts the
 * 24 h cool-off; nothing is removed here.
 */
function redirectToVerify(request: NextRequest, emailRecovery: string) {
  const url = new URL(MFA_VERIFY_PATH, request.nextUrl.origin);
  url.searchParams.set("emailRecovery", emailRecovery);

  return NextResponse.redirect(url);
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured) {
    return redirectToVerify(request, "not-configured");
  }

  const requestId = request.nextUrl.searchParams.get("request");
  const token = request.nextUrl.searchParams.get("token");

  if (!requestId || !token) {
    return redirectToVerify(request, "invalid-link");
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const signIn = new URL("/sign-in", request.nextUrl.origin);
    signIn.searchParams.set("reason", "mfa-recovery-sign-in-required");
    return NextResponse.redirect(signIn);
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("mfa_email_recovery_requests")
    .select("id, token_hash, confirmation_expires_at, confirmed_at")
    .eq("id", requestId)
    .eq("user_id", user.id)
    .is("completed_at", null)
    .is("canceled_at", null)
    .maybeSingle<{ id: string; token_hash: string; confirmation_expires_at: string; confirmed_at: string | null }>();

  if (error || !data || !recoveryTokenMatches(token, data.token_hash)) {
    return redirectToVerify(request, "invalid-link");
  }

  if (data.confirmed_at) {
    return redirectToVerify(request, "scheduled");
  }

  const ipHash = hashClientIp(request);

  if (Date.now() > Date.parse(data.confirmation_expires_at)) {
    await recordSecurityEvent(admin, { eventType: "mfa_email_recovery", outcome: "expired", ipHash, userId: user.id });
    return redirectToVerify(request, "link-expired");
  }

  const now = Date.now();
  const { error: updateError } = await admin
    .from("mfa_email_recovery_requests")
    .update({
      confirmed_at: new Date(now).toISOString(),
      available_at: new Date(now + getEmailRecoveryDelayMs()).toISOString(),
    })
    .eq("id", data.id)
    .is("confirmed_at", null);

  if (updateError) {
    console.error("2FA email recovery confirmation failed:", updateError.message);
    return redirectToVerify(request, "failed");
  }

  await recordSecurityEvent(admin, { eventType: "mfa_email_recovery", outcome: "confirmed", ipHash, userId: user.id });

  return redirectToVerify(request, "scheduled");
}
