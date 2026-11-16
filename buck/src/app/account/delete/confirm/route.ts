import { NextResponse, type NextRequest } from "next/server";
import { setNoStoreHeaders } from "@/utils/httpResponse";
import { matchesSha256Hex } from "@/utils/secureCompare";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import { isSupabaseAdminConfigured } from "@/utils/supabaseConfig";

const RECOVERY_WINDOW_DAYS = 10;

function createSignInRedirect(
  request: NextRequest,
  reason: string,
  redirectTo?: string | null
) {
  const redirectUrl = new URL("/sign-in", request.nextUrl.origin);
  redirectUrl.searchParams.set("reason", reason);
  if (redirectTo) {
    redirectUrl.searchParams.set("redirectTo", redirectTo);
  }

  return redirectUrl;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderDeletionConfirmPage({
  requestId,
  token,
  email,
  nonce,
}: {
  requestId: string;
  token: string;
  email: string;
  nonce?: string | null;
}) {
  const safeNonce = nonce ? ` nonce="${escapeHtml(nonce)}"` : "";
  const safeRequestId = escapeHtml(requestId);
  const safeToken = escapeHtml(token);
  const safeEmail = escapeHtml(email);

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Confirm account deletion · Buck</title>
    <style${safeNonce}>
      :root { color-scheme: light dark; }
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        padding: 24px;
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        background: #fff7ed;
        color: #1f1712;
      }
      @media (prefers-color-scheme: dark) {
        body { background: #140f0c; color: #f8efe6; }
        .card { background: #23170f !important; border-color: rgba(255, 211, 154, 0.2) !important; }
        .muted { color: rgba(248, 239, 230, 0.78) !important; }
        .secondary { color: #f8efe6 !important; border-color: rgba(255, 211, 154, 0.25) !important; }
      }
      .card {
        width: min(480px, 100%);
        background: #ffffff;
        border: 1px solid rgba(177, 100, 38, 0.2);
        border-radius: 16px;
        padding: 28px;
        box-shadow: 0 20px 50px rgba(31, 23, 18, 0.14);
      }
      .badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 999px;
        background: rgba(220, 38, 38, 0.12);
        color: #dc2626;
        font-size: 12px;
        font-weight: 700;
        letter-spacing: 0.04em;
        text-transform: uppercase;
        margin-bottom: 12px;
      }
      h1 { margin: 0 0 10px; font-size: 22px; line-height: 1.25; }
      .muted { margin: 0 0 14px; font-size: 14px; line-height: 1.55; color: #5b483a; }
      .actions { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }
      button {
        flex: 1 1 220px;
        min-height: 44px;
        padding: 11px 16px;
        border: none;
        border-radius: 10px;
        background: #dc2626;
        color: #ffffff;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
      }
      .secondary {
        flex: 0 1 auto;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: 44px;
        padding: 11px 16px;
        border-radius: 10px;
        border: 1px solid rgba(177, 100, 38, 0.28);
        color: #1f1712;
        text-decoration: none;
        font-size: 14px;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <main class="card">
      <span class="badge">Step 4 of 4 · Final Confirmation</span>
      <h1>Confirm Buck account deletion</h1>
      <p class="muted">
        You are about to schedule permanent deletion for <strong>${safeEmail}</strong>.
      </p>
      <p class="muted">
        Once confirmed, deletion happens in <strong>10 days</strong>. Signing back into Buck during those 10 days will automatically cancel deletion and email you a confirmation.
      </p>
      <form method="POST" action="/account/delete/confirm">
        <input type="hidden" name="request" value="${safeRequestId}" />
        <input type="hidden" name="token" value="${safeToken}" />
        <div class="actions">
          <button type="submit">Schedule deletion in 10 days</button>
          <a class="secondary" href="/dashboard/settings">Keep my account</a>
        </div>
      </form>
    </main>
  </body>
</html>`;
}

async function validateDeletionRequest({
  request,
  requestId,
  token,
}: {
  request: NextRequest;
  requestId: string;
  token: string;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    const confirmPath = `/account/delete/confirm?${new URLSearchParams({
      request: requestId,
      token,
    }).toString()}`;
    return {
      ok: false as const,
      redirect: createSignInRedirect(
        request,
        "account-deletion-sign-in-required",
        confirmPath
      ),
    };
  }

  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("account_deletion_requests")
    .select("id, user_id, email, token_hash, confirmation_expires_at, confirmed_at")
    .eq("id", requestId)
    .eq("user_id", user.id)
    .is("canceled_at", null)
    .is("purge_started_at", null)
    .maybeSingle();

  if (error || !data?.token_hash) {
    return {
      ok: false as const,
      redirect: createSignInRedirect(request, "account-deletion-invalid-link"),
    };
  }

  const expiresAt = data.confirmation_expires_at
    ? new Date(data.confirmation_expires_at).getTime()
    : 0;

  if (!data.confirmed_at && (!expiresAt || Date.now() > expiresAt)) {
    return {
      ok: false as const,
      redirect: createSignInRedirect(request, "account-deletion-link-expired"),
    };
  }

  if (!matchesSha256Hex(token, data.token_hash)) {
    return {
      ok: false as const,
      redirect: createSignInRedirect(request, "account-deletion-invalid-link"),
    };
  }

  return {
    ok: true as const,
    supabase,
    admin,
    user,
    email: String(user.email || data.email || ""),
  };
}

export async function GET(request: NextRequest) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.redirect(
      createSignInRedirect(request, "account-deletion-not-configured")
    );
  }

  const requestId = request.nextUrl.searchParams.get("request")?.trim() ?? "";
  const token = request.nextUrl.searchParams.get("token")?.trim() ?? "";

  if (!requestId || !token) {
    return NextResponse.redirect(
      createSignInRedirect(request, "account-deletion-invalid-link")
    );
  }

  const check = await validateDeletionRequest({ request, requestId, token });
  if (!check.ok) {
    return NextResponse.redirect(check.redirect);
  }

  return setNoStoreHeaders(
    new NextResponse(
      renderDeletionConfirmPage({
        requestId,
        token,
        email: check.email,
        nonce: request.headers.get("x-nonce"),
      }),
      { headers: { "Content-Type": "text/html; charset=utf-8" } }
    )
  );
}

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured) {
    return NextResponse.redirect(
      createSignInRedirect(request, "account-deletion-not-configured"),
      303
    );
  }

  const formData = await request.formData().catch(() => null);
  const requestId = String(formData?.get("request") ?? "").trim();
  const token = String(formData?.get("token") ?? "").trim();

  if (!requestId || !token) {
    return NextResponse.redirect(
      createSignInRedirect(request, "account-deletion-invalid-link"),
      303
    );
  }

  const check = await validateDeletionRequest({ request, requestId, token });
  if (!check.ok) {
    return NextResponse.redirect(check.redirect, 303);
  }

  const now = new Date();
  const recoveryUntil = new Date(
    now.getTime() + RECOVERY_WINDOW_DAYS * 24 * 60 * 60 * 1000
  ).toISOString();

  const { error: updateError } = await check.admin
    .from("account_deletion_requests")
    .update({
      token_hash: null,
      confirmation_expires_at: null,
      confirmed_at: now.toISOString(),
      recovery_until: recoveryUntil,
      auto_canceled_on_login: false,
      auto_cancel_notice_dismissed_at: null,
      cancel_reason: null,
      cancellation_email_sent_at: null,
    })
    .eq("id", requestId)
    .eq("user_id", check.user.id)
    .is("confirmed_at", null)
    .is("canceled_at", null);

  if (updateError) {
    return NextResponse.redirect(
      createSignInRedirect(request, "account-deletion-confirm-failed"),
      303
    );
  }

  await check.supabase.auth.signOut();

  return NextResponse.redirect(
    createSignInRedirect(request, "account-deletion-scheduled"),
    303
  );
}
