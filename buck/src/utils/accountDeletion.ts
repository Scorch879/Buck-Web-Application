import type { SupabaseClient } from "@supabase/supabase-js";
import { sendAccountDeletionAutoCanceledEmail } from "@/utils/mailer";

export type AccountDeletionAutoCancelNotice = {
  id: string;
  canceledAt: string;
  previousRecoveryUntil: string | null;
  emailSent: boolean;
};

type ScheduledDeletionRow = {
  id: string;
  email: string;
  recovery_until: string | null;
  canceled_at: string | null;
  cancellation_email_sent_at: string | null;
};

export async function getPendingAutoCancelNotice(
  admin: SupabaseClient,
  userId: string
): Promise<AccountDeletionAutoCancelNotice | null> {
  const { data, error } = await admin
    .from("account_deletion_requests")
    .select("id, canceled_at, recovery_until, cancellation_email_sent_at")
    .eq("user_id", userId)
    .eq("auto_canceled_on_login", true)
    .is("auto_cancel_notice_dismissed_at", null)
    .not("canceled_at", "is", null)
    .order("canceled_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.canceled_at) {
    return null;
  }

  return {
    id: String(data.id),
    canceledAt: String(data.canceled_at),
    previousRecoveryUntil: data.recovery_until
      ? String(data.recovery_until)
      : null,
    emailSent: Boolean(data.cancellation_email_sent_at),
  };
}

export async function dismissAutoCancelNotice(
  admin: SupabaseClient,
  userId: string,
  noticeId?: string | null
) {
  let query = admin
    .from("account_deletion_requests")
    .update({ auto_cancel_notice_dismissed_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("auto_canceled_on_login", true)
    .is("auto_cancel_notice_dismissed_at", null);

  if (noticeId) {
    query = query.eq("id", noticeId);
  }

  const { error } = await query;
  if (error) {
    throw new Error(error.message);
  }
}

export async function processLoginDeletionAutoCancel(
  admin: SupabaseClient,
  {
    userId,
    email,
    username,
  }: {
    userId: string;
    email?: string | null;
    username?: string | null;
  }
): Promise<{
  autoCanceled: boolean;
  notice: AccountDeletionAutoCancelNotice | null;
}> {
  if (typeof admin?.from !== "function") {
    return { autoCanceled: false, notice: null };
  }

  const { data: scheduled, error: lookupError } = await admin
    .from("account_deletion_requests")
    .select("id, email, recovery_until, canceled_at, cancellation_email_sent_at")
    .eq("user_id", userId)
    .not("confirmed_at", "is", null)
    .is("canceled_at", null)
    .is("purge_started_at", null)
    .order("confirmed_at", { ascending: false })
    .limit(1)
    .maybeSingle<ScheduledDeletionRow>();

  if (lookupError || !scheduled?.recovery_until) {
    const existingNotice = await getPendingAutoCancelNotice(admin, userId);
    return { autoCanceled: false, notice: existingNotice };
  }

  const recoveryMs = Date.parse(scheduled.recovery_until);
  if (!Number.isFinite(recoveryMs) || Date.now() > recoveryMs) {
    const existingNotice = await getPendingAutoCancelNotice(admin, userId);
    return { autoCanceled: false, notice: existingNotice };
  }

  const nowIso = new Date().toISOString();
  const { data: updated, error: updateError } = await admin
    .from("account_deletion_requests")
    .update({
      canceled_at: nowIso,
      auto_canceled_on_login: true,
      auto_cancel_notice_dismissed_at: null,
      cancel_reason: "user_login",
    })
    .eq("id", scheduled.id)
    .eq("user_id", userId)
    .is("canceled_at", null)
    .select("id, email, recovery_until, canceled_at")
    .maybeSingle<ScheduledDeletionRow>();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (!updated?.canceled_at) {
    // Another concurrent login call won the race.
    const existingNotice = await getPendingAutoCancelNotice(admin, userId);
    return { autoCanceled: false, notice: existingNotice };
  }

  let emailSent = false;
  const targetEmail = (email || updated.email || "").trim();

  if (targetEmail) {
    try {
      emailSent = await sendAccountDeletionAutoCanceledEmail({
        to: targetEmail,
        username,
        canceledAtIso: updated.canceled_at,
        scheduledPurgeIso: updated.recovery_until || updated.canceled_at,
      });

      if (emailSent) {
        await admin
          .from("account_deletion_requests")
          .update({ cancellation_email_sent_at: new Date().toISOString() })
          .eq("id", updated.id);
      }
    } catch (mailError) {
      console.warn(
        "Could not send account deletion auto-cancel email:",
        mailError
      );
    }
  }

  return {
    autoCanceled: true,
    notice: {
      id: String(updated.id),
      canceledAt: String(updated.canceled_at),
      previousRecoveryUntil: updated.recovery_until
        ? String(updated.recovery_until)
        : null,
      emailSent,
    },
  };
}
