import { getSiteOrigin } from "@/utils/httpResponse";
import { isSmtpConfigured, sendExistingAccountSignUpEmail } from "@/utils/mailer";
import { createSupabaseStatelessClient } from "@/utils/supabase/stateless";

/** The one answer sign-up gives, whether or not the address already has an account (SEC-046). */
export const SIGN_UP_NEUTRAL_MESSAGE =
  "Check your email to finish creating your account.";

/**
 * Tells the owner of an existing account, by e-mail only, that someone tried
 * to sign up with their address. Buck's own e-mail goes out when SMTP is set;
 * otherwise Supabase's Magic Link e-mail ("Use this secure link to sign in to
 * your Buck account for ...") is the fallback, as in account deletion.
 * Never throws: a failed notice must not change what the caller answers.
 */
export async function notifyExistingAccountOwner(
  request: Request,
  {
    email,
    provider,
    username,
  }: { email: string; provider: "email" | "google"; username?: string | null }
): Promise<boolean> {
  const origin = getSiteOrigin(request);
  const callbackUrl = new URL("/auth/callback", origin);
  callbackUrl.searchParams.set("next", "/dashboard/home");

  if (isSmtpConfigured()) {
    try {
      const sent = await sendExistingAccountSignUpEmail({
        to: email,
        username,
        provider,
        signInUrl: new URL("/sign-in", origin).toString(),
        resetUrl: new URL("/forgot-password", origin).toString(),
        logoUrl: new URL("/Buck%20Logo.png", origin).toString(),
      });
      if (sent) {
        return true;
      }
    } catch (error) {
      console.warn("SMTP existing-account notice failed, falling back to the sign-in link:", error);
    }
  }

  try {
    const { error } = await createSupabaseStatelessClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: callbackUrl.toString(), shouldCreateUser: false },
    });
    if (error) {
      console.error("Existing-account notice could not be sent:", error.status ?? error.message);
      return false;
    }
    return true;
  } catch (error) {
    console.error("Existing-account notice could not be sent:", error);
    return false;
  }
}
