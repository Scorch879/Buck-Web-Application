import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/utils/supabase/admin";
import { mfaJson } from "@/utils/mfa/server";
import { requireConsentSession } from "@/utils/oauthApps";
import { fetchAppLogo } from "@/utils/appLogo";

const CLIENT_ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ONE_DAY_SECONDS = 60 * 60 * 24;

/**
 * GET /api/oauth/app-logo?client_id=<uuid>: a connected app's logo, fetched by
 * the server so the user's browser never contacts the app's host (ADR-051).
 * The URL comes from the app's registration, never from the query string.
 * Needs a signed-in web session that passed 2FA. Any refusal is a 404, and the
 * UI shows the app's initial instead.
 */
export async function GET(request: Request) {
  if (!isSupabaseAdminConfigured) {
    return mfaJson({ error: "Connected apps are not configured on the server." }, { status: 500 });
  }

  const session = await requireConsentSession(request);

  if ("response" in session) {
    return session.response;
  }

  const clientId = new URL(request.url).searchParams.get("client_id") ?? "";

  if (!CLIENT_ID_PATTERN.test(clientId)) {
    return mfaJson({ error: "This app id is not valid." }, { status: 400 });
  }

  const notFound = () => mfaJson({ error: "No logo for this app." }, { status: 404 });

  try {
    const { data, error } = await createSupabaseAdminClient().auth.admin.oauth.getClient(clientId);
    const logoUri = data?.logo_uri?.trim();

    if (error || !logoUri) {
      return notFound();
    }

    const logo = await fetchAppLogo(logoUri);

    if (!logo.ok) {
      console.warn(`Connected app logo refused (${clientId}): ${logo.reason}`);
      return notFound();
    }

    return new Response(Buffer.from(logo.body), {
      status: 200,
      headers: {
        "Content-Type": logo.contentType,
        "Content-Length": String(logo.body.byteLength),
        "X-Content-Type-Options": "nosniff",
        // Per user (session-gated), so private; a day is enough for a logo.
        "Cache-Control": `private, max-age=${ONE_DAY_SECONDS}`,
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Cross-Origin-Resource-Policy": "same-origin",
        "Content-Disposition": "inline",
      },
    });
  } catch (error) {
    console.error("Connected app logo failed:", error);
    return notFound();
  }
}
