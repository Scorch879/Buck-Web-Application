import { createSupabaseServerClient } from "@/utils/supabase/server";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/utils/supabase/admin";
import { mfaJson } from "@/utils/mfa/server";
import {
  getAppRegistration,
  isValidAuthorizationId,
  requireConsentSession,
  toConsentDetails,
  type ConsentRedirect,
} from "@/utils/oauthApps";

type RouteContext = { params: Promise<{ id: string }> };

/**
 * GET /api/oauth/authorizations/[id]: what the consent page shows (ADR-049).
 * Returns `{ state: "consent", app, scopes, redirectHost, ... }`, or
 * `{ state: "redirect", redirectUrl }` when the user already approved this app.
 * Needs a signed-in web session that passed 2FA.
 */
export async function GET(request: Request, { params }: RouteContext) {
  if (!isSupabaseAdminConfigured) {
    return mfaJson({ error: "Connected apps are not configured on the server." }, { status: 500 });
  }

  const { id } = await params;

  if (!isValidAuthorizationId(id)) {
    return mfaJson({ error: "This app request link is not valid." }, { status: 400 });
  }

  const session = await requireConsentSession(request);

  if ("response" in session) {
    return session.response;
  }

  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);

    if (error || !data) {
      return mfaJson(
        { error: "This app request has expired or was already used. Start again from the app." },
        { status: 404 }
      );
    }

    if (!("authorization_id" in data)) {
      const redirect: ConsentRedirect = { state: "redirect", redirectUrl: data.redirect_url };
      return mfaJson(redirect);
    }

    const registration = await getAppRegistration(createSupabaseAdminClient(), data.client.id);

    return mfaJson(toConsentDetails(data, registration));
  } catch (error) {
    console.error("Connected app details failed:", error);
    return mfaJson({ error: "Could not load this app request. Please try again." }, { status: 500 });
  }
}
