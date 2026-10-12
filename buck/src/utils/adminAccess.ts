import type { User } from "@supabase/supabase-js";

function getAdminEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() || "";
}

/**
 * Admin access: a confirmed account that either carries the server-managed
 * `app_metadata.role = 'admin'` claim (not user-editable; also what the RLS
 * policies check) or matches the ADMIN_EMAIL environment variable.
 * Fails closed: with neither configured, nobody is an admin.
 */
export function isAdminUser(
  user: Pick<User, "email" | "email_confirmed_at" | "app_metadata"> | null
) {
  if (!user || !user.email_confirmed_at) {
    return false;
  }

  if (user.app_metadata?.role === "admin") {
    return true;
  }

  const adminEmail = getAdminEmail();

  return Boolean(adminEmail) && user.email?.trim().toLowerCase() === adminEmail;
}
