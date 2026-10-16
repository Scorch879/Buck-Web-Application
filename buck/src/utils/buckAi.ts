import { getSupabaseClient } from "@/utils/supabase";

/**
 * Browser client for the Buck_AI service (Python + Gemini, deployed as its
 * own Vercel project). The web app and the mobile app call the same API with
 * the signed-in user's Supabase access token; no API key ever ships to a
 * client. Set NEXT_PUBLIC_BUCK_AI_URL to the service URL (public, not secret).
 */
export const BUCK_AI_URL = (
  process.env.NEXT_PUBLIC_BUCK_AI_URL?.trim() || "http://localhost:8000"
).replace(/\/+$/, "");

export async function buckAiFetch(path: string, init: RequestInit = {}) {
  const {
    data: { session },
  } = await getSupabaseClient().auth.getSession();
  if (!session?.access_token) throw new Error("You need to sign in again first.");

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  return fetch(`${BUCK_AI_URL}${path}`, { ...init, headers });
}

/** FastAPI error body (`{ detail }`) or a friendly default. */
export async function buckAiError(response: Response, fallback: string) {
  try {
    const data: { detail?: unknown } = await response.json();
    if (typeof data.detail === "string") return data.detail;
  } catch {
    // Non-JSON body.
  }
  return fallback;
}
