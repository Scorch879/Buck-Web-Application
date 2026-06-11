import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import {
  isSupabaseConfigured,
  supabaseAnonKey,
  supabaseCookieOptions,
  supabaseUrl,
} from "@/utils/supabaseConfig";

const avatarBucketName = "profile-avatars";
const fallbackAvatarPath = "/BuckMascot.png";
const avatarFileNamePattern = /^[A-Za-z0-9._-]+\.(?:jpe?g|png|webp)$/i;

function copyResponseCookies(source: NextResponse, target: NextResponse) {
  source.cookies.getAll().forEach((cookie) => {
    target.cookies.set(cookie);
  });

  return target;
}

function setNoStoreHeaders(response: NextResponse) {
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}

function createFallbackAvatarResponse(
  request: NextRequest,
  cookieSource: NextResponse
) {
  const fallbackUrl = new URL(fallbackAvatarPath, request.nextUrl.origin);
  const response = NextResponse.redirect(fallbackUrl);

  return setNoStoreHeaders(copyResponseCookies(cookieSource, response));
}

function getSafeAvatarPath(userId: string, avatarPath: unknown) {
  if (typeof avatarPath !== "string") {
    return null;
  }

  const trimmedPath = avatarPath.trim();
  const userPrefix = `${userId}/`;

  if (!trimmedPath.startsWith(userPrefix)) {
    return null;
  }

  const fileName = trimmedPath.slice(userPrefix.length);

  if (!avatarFileNamePattern.test(fileName)) {
    return null;
  }

  return trimmedPath;
}

function getSafeSignedAvatarUrl(value: string | undefined) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);

    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  let cookieResponse = NextResponse.next({ request });

  if (!isSupabaseConfigured) {
    return createFallbackAvatarResponse(request, cookieResponse);
  }

  const supabase = createServerClient(supabaseUrl!, supabaseAnonKey!, {
    cookieOptions: supabaseCookieOptions,
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieResponse.cookies.set(name, value, options);
        });
        Object.entries(headers).forEach(([key, value]) => {
          cookieResponse.headers.set(key, value);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return createFallbackAvatarResponse(request, cookieResponse);
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("avatar_path")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError) {
    console.warn("Avatar profile lookup failed:", profileError.message);

    return createFallbackAvatarResponse(request, cookieResponse);
  }

  const avatarPath = getSafeAvatarPath(user.id, profile?.avatar_path);

  if (!avatarPath) {
    return createFallbackAvatarResponse(request, cookieResponse);
  }

  const { data, error } = await supabase.storage
    .from(avatarBucketName)
    .createSignedUrl(avatarPath, 60);

  const signedAvatarUrl = getSafeSignedAvatarUrl(data?.signedUrl);

  if (error || !signedAvatarUrl) {
    if (error) {
      console.warn("Avatar signed URL failed:", error.message);
    }

    return createFallbackAvatarResponse(request, cookieResponse);
  }

  const response = NextResponse.redirect(signedAvatarUrl);

  return setNoStoreHeaders(copyResponseCookies(cookieResponse, response));
}
