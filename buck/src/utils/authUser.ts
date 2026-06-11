import type { User as SupabaseUser } from "@supabase/supabase-js";

export type BuckUser = SupabaseUser & {
  uid: string;
  displayName: string | null;
  authProviders: string[];
  isPasswordUser: boolean;
  isGoogleOnlyUser: boolean;
};

function getMetadataValue(user: SupabaseUser, key: string) {
  const value = user.user_metadata?.[key];

  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getAuthProviders(user: SupabaseUser) {
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

export function getUserDisplayName(user: SupabaseUser) {
  return (
    getMetadataValue(user, "username") ||
    getMetadataValue(user, "full_name") ||
    getMetadataValue(user, "name")
  );
}

export function toBuckUser(user: SupabaseUser | null): BuckUser | null {
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
  };
}
