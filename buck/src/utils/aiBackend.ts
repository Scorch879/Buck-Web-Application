import { getSupabaseClient } from "@/utils/supabase";

// Single source for the FastAPI host (BUG-002). Falls back to the production instance.
export const AI_BACKEND_URL = (
  process.env.NEXT_PUBLIC_AI_BACKEND_URL?.trim() ||
  "https://buck-web-application-1.onrender.com"
).replace(/\/+$/, "");

/**
 * fetch() against the BuckAI FastAPI service with the caller's Supabase access
 * token. The service verifies the token and ignores any user id in the payload.
 */
export async function aiBackendFetch(path: string, init: RequestInit = {}) {
  const {
    data: { session },
  } = await getSupabaseClient().auth.getSession();

  if (!session?.access_token) {
    throw new Error("You need to sign in again first.");
  }

  const headers = new Headers(init.headers);
  headers.set("Authorization", `Bearer ${session.access_token}`);

  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  return fetch(`${AI_BACKEND_URL}${path}`, { ...init, headers });
}
