import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { isSupabaseAdminConfigured } from "@/utils/supabaseConfig";

function isAuthorized(request: NextRequest) {
  const expectedSecret = process.env.ACCOUNT_PURGE_SECRET?.trim();
  const authorization = request.headers.get("authorization") || "";

  return (
    expectedSecret &&
    authorization === `Bearer ${expectedSecret}`
  );
}

async function removeAvatarFolder(userId: string, avatarPath?: string | null) {
  const admin = createSupabaseAdminClient();
  const paths = new Set<string>();

  if (avatarPath) {
    paths.add(avatarPath);
  }

  const { data } = await admin.storage.from("profile-avatars").list(userId);

  data?.forEach((file) => {
    paths.add(`${userId}/${file.name}`);
  });

  if (paths.size) {
    await admin.storage.from("profile-avatars").remove(Array.from(paths));
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { success: false, message: "Not authorized." },
      { status: 401 }
    );
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Account purge needs SUPABASE_SERVICE_ROLE_KEY on the server.",
      },
      { status: 500 }
    );
  }

  const admin = createSupabaseAdminClient();
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("account_deletion_requests")
    .select("id, user_id")
    .not("confirmed_at", "is", null)
    .is("canceled_at", null)
    .is("purge_started_at", null)
    .lte("recovery_until", now)
    .limit(25);

  if (error) {
    return NextResponse.json(
      { success: false, message: error.message },
      { status: 500 }
    );
  }

  const purgedUserIds: string[] = [];

  for (const requestRow of data || []) {
    const userId = String(requestRow.user_id);

    await admin
      .from("account_deletion_requests")
      .update({ purge_started_at: now })
      .eq("id", requestRow.id);

    const { data: profile } = await admin
      .from("profiles")
      .select("avatar_path")
      .eq("id", userId)
      .maybeSingle();

    await removeAvatarFolder(
      userId,
      profile && typeof profile.avatar_path === "string" ? profile.avatar_path : null
    );

    const { error: deleteError } = await admin.auth.admin.deleteUser(userId);

    if (!deleteError) {
      purgedUserIds.push(userId);
    }
  }

  return NextResponse.json({
    success: true,
    purged: purgedUserIds.length,
    purgedUserIds,
  });
}
