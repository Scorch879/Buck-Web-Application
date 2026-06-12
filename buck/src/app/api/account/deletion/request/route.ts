import { createHash, randomBytes, randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseAdminClient } from "@/utils/supabase/admin";
import { createSupabaseServerClient } from "@/utils/supabase/server";
import {
  isSupabaseAdminConfigured,
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseUrl,
} from "@/utils/supabaseConfig";

const CONFIRMATION_WINDOW_MINUTES = 60;
const DELETE_CONFIRM_TEXT = "DELETE";

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

function getOrigin(request: NextRequest) {
  if (process.env.NODE_ENV !== "development") {
    return process.env.NEXT_PUBLIC_SITE_URL?.trim() || request.nextUrl.origin;
  }
  return request.nextUrl.origin;
}

function getDeletionErrorMessage(error: unknown) {
  const message =
    error instanceof Error ? error.message : "Could not request account deletion.";

  if (
    message.includes("account_deletion_requests") ||
    message.includes("schema cache")
  ) {
    return "Run the account deletion Supabase migration before deleting accounts.";
  }

  return message;
}

async function verifyCurrentPassword(email: string, password: string) {
  if (!password) {
    return false;
  }

  const verifier = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
  const { error } = await verifier.auth.signInWithPassword({ email, password });

  return !error;
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { success: false, message: "Supabase authentication is not configured." },
      { status: 500 }
    );
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Account deletion needs SUPABASE_SERVICE_ROLE_KEY on the server.",
      },
      { status: 500 }
    );
  }

  const body = (await request.json().catch(() => ({}))) as {
    currentPassword?: string;
    confirmText?: string;
  };

  if (body.confirmText?.trim().toUpperCase() !== DELETE_CONFIRM_TEXT) {
    return NextResponse.json(
      { success: false, message: "Type DELETE to request account deletion." },
      { status: 400 }
    );
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user?.email) {
    return NextResponse.json(
      { success: false, message: "You need to sign in again first." },
      { status: 401 }
    );
  }

  const providers = new Set<string>();

  if (typeof user.app_metadata?.provider === "string") {
    providers.add(user.app_metadata.provider);
  }

  user.identities?.forEach((identity) => {
    if (identity.provider) {
      providers.add(identity.provider);
    }
  });

  if (providers.has("email")) {
    const passwordOk = await verifyCurrentPassword(
      user.email,
      body.currentPassword || ""
    );

    if (!passwordOk) {
      return NextResponse.json(
        { success: false, message: "Current password is incorrect." },
        { status: 403 }
      );
    }
  }

  try {
    const admin = createSupabaseAdminClient();
    const now = new Date();
    const existing = await admin
      .from("account_deletion_requests")
      .select("id, confirmed_at, recovery_until")
      .eq("user_id", user.id)
      .is("canceled_at", null)
      .is("purge_started_at", null)
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing.error) {
      throw new Error(existing.error.message);
    }

    if (existing.data?.confirmed_at && existing.data.recovery_until) {
      return NextResponse.json({
        success: true,
        message:
          "Account deletion is already scheduled. You can still recover it from Settings before the recovery window ends.",
      });
    }

    const requestId = existing.data?.id || randomUUID();
    const token = randomBytes(32).toString("base64url");
    const confirmationExpiresAt = new Date(
      now.getTime() + CONFIRMATION_WINDOW_MINUTES * 60 * 1000
    ).toISOString();
    const deletionRequest = {
      id: requestId,
      user_id: user.id,
      email: user.email,
      token_hash: hashToken(token),
      requested_at: now.toISOString(),
      confirmation_expires_at: confirmationExpiresAt,
      confirmed_at: null,
      recovery_until: null,
      canceled_at: null,
      purge_started_at: null,
    };

    const { error: upsertError } = await admin
      .from("account_deletion_requests")
      .upsert(deletionRequest, { onConflict: "id" });

    if (upsertError) {
      throw new Error(upsertError.message);
    }

    const origin = getOrigin(request);
    const nextPath = `/account/delete/confirm?request=${encodeURIComponent(
      requestId
    )}&token=${encodeURIComponent(token)}`;
    const callbackUrl = new URL("/auth/callback", origin);
    callbackUrl.searchParams.set("next", nextPath);

    const mailClient = createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    const { error: otpError } = await mailClient.auth.signInWithOtp({
      email: user.email,
      options: {
        emailRedirectTo: callbackUrl.toString(),
        shouldCreateUser: false,
      },
    });

    if (otpError) {
      throw new Error(otpError.message);
    }

    return NextResponse.json({
      success: true,
      message:
        "Confirmation email sent. Open it within 60 minutes to schedule deletion.",
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, message: getDeletionErrorMessage(error) },
      { status: 500 }
    );
  }
}
