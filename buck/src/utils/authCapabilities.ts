import type { SupabaseClient, User } from "@supabase/supabase-js";
import { toBuckUser } from "@/utils/authUser";

export type AuthAccountCapabilities = {
  exists: boolean;
  emailConfirmed: boolean;
  hasEmailIdentity: boolean;
  hasGoogleIdentity: boolean;
  hasPassword: boolean;
  hasPasskey: boolean;
};

type RawAccountCapabilitiesRow = {
  exists?: unknown;
  email_confirmed?: unknown;
  has_email_identity?: unknown;
  has_google_identity?: unknown;
  has_password?: unknown;
  has_passkey?: unknown;
};

const EMPTY_CAPABILITIES: AuthAccountCapabilities = {
  exists: false,
  emailConfirmed: false,
  hasEmailIdentity: false,
  hasGoogleIdentity: false,
  hasPassword: false,
  hasPasskey: false,
};

function normalizeCapabilitiesRow(data: unknown): AuthAccountCapabilities {
  const row = (Array.isArray(data) ? data[0] : data) as
    | RawAccountCapabilitiesRow
    | null
    | undefined;

  if (!row || typeof row !== "object") {
    return { ...EMPTY_CAPABILITIES };
  }

  return {
    exists: row.exists === true,
    emailConfirmed: row.email_confirmed === true,
    hasEmailIdentity: row.has_email_identity === true,
    hasGoogleIdentity: row.has_google_identity === true,
    hasPassword: row.has_password === true,
    hasPasskey: row.has_passkey === true,
  };
}

/** Looks up authoritative auth capabilities for an email via the service-role RPC. */
export async function getAuthAccountCapabilitiesByEmail(
  supabaseAdmin: SupabaseClient,
  email: string
): Promise<AuthAccountCapabilities> {
  const { data, error } = await supabaseAdmin.rpc(
    "get_auth_account_capabilities",
    { p_email: email }
  );

  if (error) {
    throw error;
  }

  return normalizeCapabilitiesRow(data);
}

/** Looks up authoritative auth capabilities for a user id via the service-role RPC. */
export async function getAuthAccountCapabilitiesByUserId(
  supabaseAdmin: SupabaseClient,
  userId: string
): Promise<AuthAccountCapabilities> {
  const { data, error } = await supabaseAdmin.rpc(
    "get_auth_user_capabilities",
    { p_user_id: userId }
  );

  if (error) {
    throw error;
  }

  return normalizeCapabilitiesRow(data);
}

/**
 * Fallback capabilities derived strictly from the verified Supabase User object
 * when service-role RPCs are unavailable in an environment/test.
 */
export function getCapabilitiesFromUser(
  user: User | null | undefined
): AuthAccountCapabilities {
  const buckUser = toBuckUser(user ?? null);

  if (!buckUser) {
    return { ...EMPTY_CAPABILITIES };
  }

  const hasPasskey = Boolean(
    user?.factors?.some(
      (factor) =>
        factor.factor_type === "webauthn" && factor.status === "verified"
    )
  );

  return {
    exists: true,
    emailConfirmed: Boolean(buckUser.email_confirmed_at),
    hasEmailIdentity: buckUser.isPasswordUser,
    hasGoogleIdentity: buckUser.authProviders.includes("google"),
    hasPassword: buckUser.isPasswordUser,
    hasPasskey,
  };
}

/**
 * Password reset is allowed only for accounts that have an email identity, a
 * password hash, or a registered passkey. Google-only accounts without a
 * password or passkey cannot access password reset.
 */
export function canAccountResetPassword(
  capabilities: AuthAccountCapabilities
): boolean {
  return (
    capabilities.exists &&
    (capabilities.hasEmailIdentity ||
      capabilities.hasPassword ||
      capabilities.hasPasskey)
  );
}

export function isGoogleOnlyConflict(
  capabilities: AuthAccountCapabilities
): boolean {
  return (
    capabilities.exists &&
    capabilities.hasGoogleIdentity &&
    !capabilities.hasEmailIdentity &&
    !capabilities.hasPassword
  );
}
