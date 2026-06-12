import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { isSupabaseAdminConfigured } from "@/utils/supabaseConfig";

const RECOVERY_WINDOW_DAYS = 10;

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function tokensMatch(token: string, hash: string) {
  const tokenHash = Buffer.from(hashToken(token), "hex");
  const expectedHash = Buffer.from(hash, "hex");

  return (
    tokenHash.length === expectedHash.length &&
    timingSafeEqual(tokenHash, expectedHash)
  );
}

function createSignInRedirect(request: NextRequest, reason: string) {
  const redirectUrl = new URL("/sign-in", request.nextUrl.origin);
  redirectUrl.searchParams.set("reason", reason);

  return redirectUrl;
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.redirect(
      createSignInRedirect(request, "account-deletion-not-configured")
    );
  }

  const requestId = request.nextUrl.searchParams.get("request");
  const token = request.nextUrl.searchParams.get("token");

  if (!requestId || !token) {
    return NextResponse.redirect(
      createSignInRedirect(request, "account-deletion-invalid-link")
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(
      createSignInRedirect(request, "account-deletion-sign-in-required")
    );
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("account_deletion_requests")
    .select("id, user_id, token_hash, confirmation_expires_at, confirmed_at")
    .eq("id", requestId)
    .eq("user_id", user.id)
    .is("canceled_at", null)
    .is("purge_started_at", null)
    .maybeSingle();

  if (error || !data?.token_hash) {
    return NextResponse.redirect(
      createSignInRedirect(request, "account-deletion-invalid-link")
    );
  }

  const expiresAt = data.confirmation_expires_at
    ? new Date(data.confirmation_expires_at).getTime()
    : 0;

  if (!data.confirmed_at && (!expiresAt || Date.now() > expiresAt)) {
    return NextResponse.redirect(
      createSignInRedirect(request, "account-deletion-link-expired")
    );
  }

  if (!tokensMatch(token, data.token_hash)) {
    return NextResponse.redirect(
      createSignInRedirect(request, "account-deletion-invalid-link")
    );
  }

  const now = new Date();
  const recoveryUntil = new Date(
    now.getTime() + RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();
  const { error: updateError } = await admin
    .from("account_deletion_requests")
    .update({
      token_hash: null,
      confirmation_expires_at: null,
      confirmed_at: now.toISOString(),
      recovery_until: recoveryUntil,
    })
    .eq("id", requestId)
    .eq("user_id", user.id);

  if (updateError) {
    return NextResponse.redirect(
      createSignInRedirect(request, "account-deletion-confirm-failed")
    );
  }

  await supabase.auth.signOut();

  return NextResponse.redirect(
    createSignInRedirect(request, "account-deletion-scheduled")
  );
}
