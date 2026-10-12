import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { isSupabaseAdminConfigured } from "@/utils/supabaseConfig";
import { isBearerAuthorized } from "@/utils/secureCompare";

// Vercel Cron authenticates with CRON_SECRET; manual runs use ACCOUNT_PURGE_SECRET.
function isAuthorized(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  return (
    isBearerAuthorized(authorization, process.env.CRON_SECRET) ||
    isBearerAuthorized(authorization, process.env.ACCOUNT_PURGE_SECRET)
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

export const maxDuration = 300;

// Vercel Cron issues GET requests.
export async function GET(request: NextRequest) {
  return POST(request);
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
    console.error("Account purge lookup failed:", error.message);
    return NextResponse.json(
      { success: false, message: "Could not list accounts to purge." },
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

    if (deleteError) {
      // Release the claim so the next run retries instead of orphaning the row.
      console.error("Account purge failed:", userId, deleteError.message);
      await admin
        .from("account_deletion_requests")
        .update({ purge_started_at: null })
        .eq("id", requestRow.id);
      continue;
    }

    purgedUserIds.push(userId);
  }

  return NextResponse.json({
    success: true,
    purged: purgedUserIds.length,
    purgedUserIds,
  });
}
