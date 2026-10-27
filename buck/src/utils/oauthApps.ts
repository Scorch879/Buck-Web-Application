import type { OAuthAuthorizationDetails, SupabaseClient } from "@supabase/supabase-js";
import { getRequestAuth, mfaRequiredResponse, type RequestAuth } from "@/utils/apiAuth";
import { mfaJson } from "@/utils/mfa/server";
import { appLogoPath } from "@/utils/connectedApps";

/**
 * Connected apps (Supabase OAuth 2.1 server, ADR-049): server helpers for the
 * consent routes. Apps get read-only data access through RLS; a user with 2FA
 * must have passed it when approving (see 202610240004_oauth_apps.sql).
 */

export type ConnectedAppRegistration = "manual" | "dynamic" | "unknown";

export type ConsentDetails = {
  state: "consent";
  authorizationId: string;
  app: {
    id: string;
    name: string;
    website: string | null;
    /** Buck's same-origin logo proxy (ADR-051), never the app's own URL. */
    logoUrl: string | null;
    /** "dynamic": the app registered itself, Buck has not reviewed it. */
    registration: ConnectedAppRegistration;
  };
  redirectUri: string;
  /** Host the user is sent back to; show it so look-alike apps stand out. */
  redirectHost: string;
  scopes: string[];
  /** Connected apps can only read; shown on the consent screen. */
  access: "read-only";
};

export type ConsentRedirect = { state: "redirect"; redirectUrl: string };

// Supabase builds `/oauth/authorizations/<id>` from this value, so only accept
// a plain token (no "/", "..", "?").
const AUTHORIZATION_ID_PATTERN = /^[A-Za-z0-9_-]{1,256}$/;

export function isValidAuthorizationId(value: string) {
  return AUTHORIZATION_ID_PATTERN.test(value);
}

function emptyToNull(value: string | null | undefined) {
  return value?.trim() ? value.trim() : null;
}

export function toConsentDetails(
  details: OAuthAuthorizationDetails,
  registration: ConnectedAppRegistration
): ConsentDetails {
  let redirectHost = "";

  try {
    redirectHost = new URL(details.redirect_uri).host;
  } catch {
    redirectHost = details.redirect_uri;
  }

  return {
    state: "consent",
    authorizationId: details.authorization_id,
    app: {
      id: details.client.id,
      name: details.client.name?.trim() || "Unnamed app",
      website: emptyToNull(details.client.uri),
      logoUrl: appLogoPath(details.client.id, details.client.logo_uri),
      registration,
    },
    redirectUri: details.redirect_uri,
    redirectHost,
    scopes: details.scope.split(" ").filter(Boolean),
    access: "read-only",
  };
}

export async function getAppRegistration(
  admin: SupabaseClient,
  clientId: string
): Promise<ConnectedAppRegistration> {
  const { data, error } = await admin.rpc("get_oauth_app_registration", { p_client_id: clientId });

  if (error) {
    console.error("Connected app lookup failed:", error.message);
    return "unknown";
  }

  return data === "manual" || data === "dynamic" ? data : "unknown";
}

/**
 * The consent routes run only for the web session cookie: approving an app is
 * a browser step, and a bearer token (mobile or another app) must not do it.
 * Returns the session, or the response to send instead.
 */
export async function requireConsentSession(
  request: Request
): Promise<{ auth: RequestAuth } | { response: Response }> {
  if (request.headers.get("authorization")) {
    return {
      response: mfaJson(
        { error: "Approve connected apps from the Buck website while signed in." },
        { status: 400 }
      ),
    };
  }

  const auth = await getRequestAuth(request);

  if (!auth) {
    return { response: mfaJson({ error: "You need to sign in again first." }, { status: 401 }) };
  }

  if (!auth.mfa.satisfied) {
    return { response: mfaRequiredResponse() };
  }

  return { auth };
}
