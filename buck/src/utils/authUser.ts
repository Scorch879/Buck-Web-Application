import type { User as SupabaseUser } from "@supabase/supabase-js";

export const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;

/** Ensures internal post-auth redirects stay same-origin and never protocol-relative (`//`). */
export function getSafeRedirectPath(
  value: string | null | undefined,
  fallback = "/dashboard/home"
): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return fallback;
  }

  return value;
}

/**
 * Validates a relative app redirect against an explicit allowlist of exact paths and prefixes,
 * preserving pathname + search while dropping URL fragments and cross-origin URLs.
 */
export function getSafeAppPath(
  value: string | null | undefined,
  allowedPaths: readonly string[],
  allowedPrefixes: readonly string[] = ["/dashboard"],
  fallback = "/dashboard/home"
): string {
  if (!value) {
    return fallback;
  }

  try {
    const parsedUrl = new URL(value, "http://dummy.local");
    const matchesPrefix = allowedPrefixes.some((prefix) =>
      parsedUrl.pathname.startsWith(prefix)
    );
    const matchesExact = allowedPaths.includes(parsedUrl.pathname);

    if (parsedUrl.origin === "http://dummy.local" && (matchesPrefix || matchesExact)) {
      return parsedUrl.pathname + parsedUrl.search;
    }
  } catch {
    // Malformed redirect strings fall back to the dashboard home route.
  }

  return fallback;
}

export type BuckUser = SupabaseUser & {
  uid: string;
  displayName: string | null;
  authProviders: string[];
  isPasswordUser: boolean;
  isGoogleOnlyUser: boolean;
  /** Resolved server-side (isAdminUser). UI hint only; real checks stay on the server and in RLS. */
  isAdmin: boolean;
};

function getMetadataValue(user: SupabaseUser, key: string) {
  const value = user.user_metadata?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getAuthProviders(user: SupabaseUser) {
  const providers = new Set<string>();

  if (typeof user.app_metadata?.provider === "string") {
    providers.add(user.app_metadata.provider);
  }

  user.identities?.forEach((identity) => {
    if (identity.provider) {
      providers.add(identity.provider);
    }
  });

  return Array.from(providers);
}

function getUserDisplayName(user: SupabaseUser) {
  return (
    getMetadataValue(user, "username") ||
    getMetadataValue(user, "full_name") ||
    getMetadataValue(user, "name")
  );
}

export function toBuckUser(
  user: SupabaseUser | null,
  isAdminOverride?: boolean
): BuckUser | null {
  if (!user) {
    return null;
  }

  const authProviders = getAuthProviders(user);
  const isPasswordUser = authProviders.includes("email");

  return {
    ...user,
    uid: user.id,
    displayName: getUserDisplayName(user),
    authProviders,
    isPasswordUser,
    isGoogleOnlyUser: authProviders.includes("google") && !isPasswordUser,
    isAdmin:
      isAdminOverride ??
      (user as Partial<BuckUser>).isAdmin ??
      user.app_metadata?.role === "admin",
  };
}
