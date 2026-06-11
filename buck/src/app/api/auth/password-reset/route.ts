import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseConfigError,
  supabaseUrl,
} from "@/utils/supabaseConfig";

type PasswordResetRequest = {
  email?: unknown;
};

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const resetRequestMessage =
  "If that email is registered with Buck, a password reset link will arrive shortly.";

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
