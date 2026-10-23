import { createSupabaseServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/utils/supabase/admin";
import { mfaJson } from "@/utils/mfa/server";
import { isValidAuthorizationId, requireConsentSession } from "@/utils/oauthApps";

type RouteContext = { params: Promise<{ id: string }> };

type ConsentBody = { decision?: unknown };

/**
 * POST /api/oauth/authorizations/[id]/consent `{ decision: "approve" | "deny" }`
 * (ADR-049). Returns `{ redirectUrl }`; the page sends the browser there.
 *
 * Approving goes through this route, not the SDK in the browser, so Buck can
 * record that it happened from a session that passed 2FA. RLS only lets a
 * 2FA user's connected app read data while that record matches the active
 * consent (record_oauth_app_grant / private.mfa_satisfied()).
 */
export async function POST(request: Request, { params }: RouteContext) {
  if (!isSupabaseAdminConfigured) {
    return mfaJson({ error: "Connected apps are not configured on the server." }, { status: 500 });
  }

  const { id } = await params;
  const body = (await request.json().catch(() => null)) as ConsentBody | null;
  const decision = body?.decision;

  if (!isValidAuthorizationId(id) || (decision !== "approve" && decision !== "deny")) {
    return mfaJson({ error: "Choose Allow or Deny." }, { status: 400 });
  }

  const session = await requireConsentSession(request);

  if ("response" in session) {
    return session.response;
  }

  const { auth } = session;

  try {
    const supabase = await createSupabaseServerClient();

    if (decision === "deny") {
      const { data, error } = await supabase.auth.oauth.denyAuthorization(id, { skipBrowserRedirect: true });

      if (error || !data) {
        return mfaJson({ error: "This app request has expired. Start again from the app." }, { status: 404 });
      }

      return mfaJson({ redirectUrl: data.redirect_url });
    }

    // The client id is needed to record the grant; it is only in the details.
    const { data: details, error: detailsError } = await supabase.auth.oauth.getAuthorizationDetails(id);

    if (detailsError || !details) {
      return mfaJson({ error: "This app request has expired. Start again from the app." }, { status: 404 });
    }

    if (!("authorization_id" in details)) {
      // Already approved earlier; nothing new to record.
      return mfaJson({ redirectUrl: details.redirect_url });
    }

    const { data, error } = await supabase.auth.oauth.approveAuthorization(id, { skipBrowserRedirect: true });

    if (error || !data) {
      return mfaJson({ error: "Could not approve this app. Start again from the app." }, { status: 502 });
    }

    const { error: recordError } = await createSupabaseAdminClient().rpc("record_oauth_app_grant", {
      p_user_id: auth.user.id,
      p_client_id: details.client.id,
      p_mfa_verified: auth.mfa.currentLevel === "aal2",
    });

    if (recordError) {
      console.error("Recording the connected app failed:", recordError.message);
      // Undo the approval so the app is not half-connected (it would see no
      // data for a 2FA user). The user can simply try again.
      await supabase.auth.oauth.revokeGrant({ clientId: details.client.id });
      return mfaJson({ error: "Could not connect this app. Please try again." }, { status: 500 });
    }

    return mfaJson({ redirectUrl: data.redirect_url });
  } catch (error) {
    console.error("Connected app consent failed:", error);
    return mfaJson({ error: "Could not finish this app request. Please try again." }, { status: 500 });
  }
}
