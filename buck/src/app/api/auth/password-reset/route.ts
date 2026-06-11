import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseConfigError,
  supabaseUrl,
} from "@/utils/supabaseConfig";
import {
  createSupabaseAdminClient,
  isSupabaseAdminConfigured,
} from "@/utils/supabase/admin";

type PasswordResetRequest = {
  email?: unknown;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const accountNotFoundMessage =
  "No Buck account exists for that email address.";
const resetRequestMessage = "Password reset link sent. Check your email.";

function normalizeOrigin(value: string) {
  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return new URL(withProtocol).origin;
}

function getSiteOrigin(request: Request) {
  const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();

  if (configuredSiteUrl) {
    try {
      return normalizeOrigin(configuredSiteUrl);
    } catch {
      console.warn("NEXT_PUBLIC_SITE_URL is not a valid URL.");
    }
  }

  return new URL(request.url).origin;
}

function getPasswordResetRedirectUrl(request: Request) {
  const params = new URLSearchParams({
    next: "/forgot-password?type=recovery",
  });

  return `${getSiteOrigin(request)}/auth/callback?${params.toString()}`;
}

function getPublicResetError(message: string) {
  const normalizedMessage = message.toLowerCase();

  if (
    normalizedMessage.includes("rate") ||
    normalizedMessage.includes("too many")
  ) {
    return "Too many reset attempts. Please wait a little while and try again.";
  }

  return "Buck could not send the reset email right now. Please try again later.";
}

async function readRequestBody(request: Request) {
  try {
    return (await request.json()) as PasswordResetRequest;
  } catch {
    return null;
  }
}

async function findBuckAccountByEmail(email: string) {
  const supabaseAdmin = createSupabaseAdminClient();
  const normalizedEmail = email.toLowerCase();
  const emailCandidates = Array.from(new Set([email, normalizedEmail]));
  const { data, error } = await supabaseAdmin
    .from("profiles")
    .select("id")
    .in("email", emailCandidates)
    .limit(1);

  if (error) {
    throw error;
  }

  return Boolean(data?.length);
}

export async function POST(request: Request) {
  if (!isSupabaseConfigured) {
    return NextResponse.json(
      { success: false, message: supabaseConfigError },
      { status: 500 }
    );
  }

  const body = await readRequestBody(request);
  const email = typeof body?.email === "string" ? body.email.trim() : "";

  if (!emailRegex.test(email)) {
    return NextResponse.json(
      { success: false, message: "Please enter a valid email address." },
      { status: 400 }
    );
  }

  if (!isSupabaseAdminConfigured) {
    return NextResponse.json(
      {
        success: false,
        message:
          "Password reset lookup is not configured. Add SUPABASE_SERVICE_ROLE_KEY to the server environment.",
      },
      { status: 500 }
    );
  }

  try {
    const accountExists = await findBuckAccountByEmail(email);

    if (!accountExists) {
      return NextResponse.json(
        { success: false, message: accountNotFoundMessage },
        { status: 404 }
      );
    }
  } catch (error) {
    console.error("Password reset account lookup failed:", error);

    return NextResponse.json(
      {
        success: false,
        message:
          "Buck could not verify that email right now. Please try again later.",
      },
      { status: 502 }
    );
  }

  const supabase = createClient(supabaseUrl!, supabaseAnonKey!, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: getPasswordResetRedirectUrl(request),
  });

  if (error) {
    console.error("Password reset request failed:", error.message);

    return NextResponse.json(
      { success: false, message: getPublicResetError(error.message) },
      { status: 502 }
    );
  }

  return NextResponse.json({
    success: true,
    message: resetRequestMessage,
  });
}
