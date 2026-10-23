import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  OAuthError,
  OAuthErrorCode,
  getOAuthProtectedResourceMetadataUrl,
  type AuthInfo,
  type OAuthProtectedResourceMetadata,
  type OAuthTokenVerifier,
} from "@modelcontextprotocol/server";
import { readAccessTokenClaims } from "@/utils/mfa/assurance";
import { supabaseAnonKey, supabaseUrl } from "@/utils/supabaseConfig";

/**
 * Buck MCP server auth (ADR-050). Buck is the OAuth *resource server*;
 * Supabase's OAuth 2.1 server (ADR-049) is the authorization server. MCP
 * clients find it through the Protected Resource Metadata document (RFC 9728)
 * and come back with a Supabase access token issued to them as a connected app.
 */

export const MCP_PATH = "/api/mcp";

// What Supabase's OAuth server issues. Whatever is granted, apps only read.
export const MCP_SCOPES_SUPPORTED = ["openid", "email", "profile"];

export function getMcpResourceUrl(origin: string) {
  return new URL(MCP_PATH, origin);
}

export function getMcpResourceMetadataUrl(origin: string) {
  return getOAuthProtectedResourceMetadataUrl(getMcpResourceUrl(origin));
}

export function buildProtectedResourceMetadata(origin: string): OAuthProtectedResourceMetadata {
  return {
    resource: getMcpResourceUrl(origin).href,
    authorization_servers: [`${supabaseUrl}/auth/v1`],
    scopes_supported: MCP_SCOPES_SUPPORTED,
    bearer_methods_supported: ["header"],
    resource_name: "Buck",
  };
}

/** A Supabase client that sends the caller's token, so every query runs under RLS. */
export function createUserClient(token: string): SupabaseClient {
  return createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
}

function invalidToken(message: string) {
  return new OAuthError(OAuthErrorCode.InvalidToken, message);
}

/**
 * Accepts only connected-app tokens (a `client_id` claim). Buck's own web and
 * mobile sessions have no business here. Supabase Auth checks the signature,
 * expiry and revocation (a disconnected app's session is gone), so the claims
 * read afterwards can be trusted.
 */
export const connectedAppTokenVerifier: OAuthTokenVerifier = {
  async verifyAccessToken(token: string): Promise<AuthInfo> {
    const claims = readAccessTokenClaims(token);
    const clientId = claims?.client_id;

    if (typeof clientId !== "string" || !clientId) {
      throw invalidToken("Connect to Buck through your app's sign-in to get a token for this server.");
    }

    let userId: string | undefined;

    try {
      const { data, error } = await createUserClient(token).auth.getUser(token);
      userId = error ? undefined : data.user?.id;
    } catch {
      throw new OAuthError(OAuthErrorCode.ServerError, "Buck could not check this token. Try again.");
    }

    if (!userId) {
      throw invalidToken("This token has expired or the app was disconnected. Sign in again.");
    }

    if (typeof claims?.exp !== "number") {
      throw invalidToken("This token has no expiry.");
    }

    return {
      token,
      clientId,
      scopes: (claims.scope ?? "").split(" ").filter(Boolean),
      expiresAt: claims.exp,
      extra: { userId },
    };
  },
};
