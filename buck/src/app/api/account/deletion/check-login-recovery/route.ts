import { NextResponse, type NextRequest } from "next/server";
import { getRequestAuth, mfaRequiredResponse } from "@/utils/apiAuth";
import { setNoStoreHeaders } from "@/utils/httpResponse";
import {
  dismissAutoCancelNotice,
  processLoginDeletionAutoCancel,
} from "@/utils/accountDeletion";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { isSupabaseAdminConfigured } from "@/utils/supabaseConfig";

export async function POST(request: NextRequest) {
  if (!isSupabaseAdminConfigured) {
    return setNoStoreHeaders(
      NextResponse.json({ autoCanceled: false, notice: null })
    );
  }

  const auth = await getRequestAuth(request);
  if (!auth) {
    return setNoStoreHeaders(
      NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    );
  }

  if (!auth.mfa.satisfied) {
    return setNoStoreHeaders(mfaRequiredResponse());
  }

  try {
    const admin = createSupabaseAdminClient();
    const result = await processLoginDeletionAutoCancel(admin, {
      userId: auth.user.id,
      email: auth.user.email,
      username:
        typeof auth.user.user_metadata?.username === "string"
          ? auth.user.user_metadata.username
          : typeof auth.user.user_metadata?.full_name === "string"
            ? auth.user.user_metadata.full_name
            : null,
    });

    return setNoStoreHeaders(NextResponse.json(result));
  } catch (error) {
    console.error("Login deletion recovery check failed:", error);
    return setNoStoreHeaders(
      NextResponse.json({ autoCanceled: false, notice: null })
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isSupabaseAdminConfigured) {
    return setNoStoreHeaders(NextResponse.json({ success: true }));
  }

  const auth = await getRequestAuth(request);
  if (!auth) {
    return setNoStoreHeaders(
      NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    );
  }

  if (!auth.mfa.satisfied) {
    return setNoStoreHeaders(mfaRequiredResponse());
  }

  const body = (await request.json().catch(() => ({}))) as {
    noticeId?: unknown;
  };
  const noticeId = typeof body.noticeId === "string" ? body.noticeId : null;

  try {
    const admin = createSupabaseAdminClient();
    await dismissAutoCancelNotice(admin, auth.user.id, noticeId);
    return setNoStoreHeaders(NextResponse.json({ success: true }));
  } catch (error) {
    console.error("Could not dismiss deletion notice:", error);
    return setNoStoreHeaders(
      NextResponse.json(
        { success: false, message: "Could not dismiss notice right now." },
        { status: 500 }
      )
    );
  }
}
