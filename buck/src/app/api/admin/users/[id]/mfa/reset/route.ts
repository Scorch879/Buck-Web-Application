import { getRequestAuth, mfaRequiredResponse } from "@/utils/apiAuth";
import { isAdminUser } from "@/utils/adminAccess";
import { createSupabaseAdminClient, isSupabaseAdminConfigured } from "@/utils/supabase/admin";
import { hashClientIp, recordSecurityEvent } from "@/utils/authRateLimit";
import { mfaJson, removeTwoFactor } from "@/utils/mfa/server";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * POST /api/admin/users/:id/mfa/reset: last-resort support reset when a user
 * lost every authenticator, every backup code and their e-mail. Admin only,
 * and the admin's own session must have passed 2FA. Logged as mfa_reset_admin.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  if (!isSupabaseAdminConfigured) {
    return mfaJson({ error: "Two-factor settings are not configured on the server." }, { status: 500 });
  }

  const auth = await getRequestAuth(request);

  if (!auth || !isAdminUser(auth.user)) {
    return mfaJson({ error: "Unauthorized access" }, { status: 403 });
  }

  if (!auth.mfa.satisfied) {
    return mfaRequiredResponse();
  }

  const { id } = await params;

  if (!UUID_PATTERN.test(id)) {
    return mfaJson({ error: "Invalid user id." }, { status: 400 });
  }

  try {
    const admin = createSupabaseAdminClient();
    const removed = await removeTwoFactor(admin, id);
    // Their sessions keep working; the next sign-in simply has no 2FA step.
    await recordSecurityEvent(admin, {
      eventType: "mfa_reset_admin",
      outcome: "success",
      ipHash: hashClientIp(request),
      userId: id,
    });

    return mfaJson({ success: true, removedFactors: removed });
  } catch (error) {
    console.error("Admin 2FA reset failed:", error);
    return mfaJson({ error: "Could not reset two-factor authentication." }, { status: 500 });
  }
}
