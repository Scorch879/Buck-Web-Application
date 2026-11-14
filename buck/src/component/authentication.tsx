"use client";

import {
  getSupabaseClient,
  isSupabaseConfigured,
  supabaseConfigError,
} from "@/utils/supabase";
import { evaluatePasswordPolicy } from "@/utils/passwordPolicy";
import {
  getEmailValidationMessage,
  normalizeEmailAddress,
} from "@/utils/emailValidation";

export type AuthResult = {
  success: boolean;
  message?: string;
  cancelled?: boolean;
  redirecting?: boolean;
  needsEmailConfirmation?: boolean;
};

export const SESSION_LAST_ACTIVITY_KEY = "buck-session-last-activity";
export const SESSION_FORCE_SIGN_OUT_KEY = "buck-session-force-signout";
const DASHBOARD_CACHE_KEY = "buck-dashboard-cache-v1";
export const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;

const CLIENT_AUTH_STORAGE_KEYS = [
  DASHBOARD_CACHE_KEY,
  SESSION_LAST_ACTIVITY_KEY,
  SESSION_FORCE_SIGN_OUT_KEY,
  "selectedGoalId",
];

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

export function getPositiveNumber(value: string | undefined, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 0) {
    return fallback;
  }

  return parsed;
}

export function getClientIdleTimeoutMs() {
  const minutes = getPositiveNumber(
    process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES,
    DEFAULT_IDLE_TIMEOUT_MINUTES
  );

  return minutes * 60 * 1000;
}

export function readStoredTimestamp(key: string) {
  try {
    const value = window.localStorage.getItem(key);
    const parsed = value ? Number(value) : 0;

    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function writeStoredValue(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage can be unavailable in strict privacy modes. Timers still protect
    // the current tab.
  }
}

export function removeStoredValue(key: string) {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage cleanup failures for browsers with restricted storage.
  }
}

export function clearClientAuthStorage() {
  if (typeof window === "undefined") {
    return;
  }

  CLIENT_AUTH_STORAGE_KEYS.forEach((key) => {
    removeStoredValue(key);

    try {
      window.sessionStorage.removeItem(key);
    } catch {
      // Session storage cleanup is best-effort.
    }
  });
}

export function resetClientSessionActivity() {
  if (typeof window === "undefined") {
    return;
  }

  writeStoredValue(SESSION_LAST_ACTIVITY_KEY, String(Date.now()));
  removeStoredValue(SESSION_FORCE_SIGN_OUT_KEY);

  try {
    window.sessionStorage.removeItem(DASHBOARD_CACHE_KEY);
  } catch {
    // Session storage cleanup is best-effort.
  }
}

export function isClientSessionIdleExpired(
  user: { last_sign_in_at?: string | null } | null | undefined
) {
  if (!user || typeof window === "undefined") {
    return false;
  }

  const timeoutMs = getClientIdleTimeoutMs();

  if (timeoutMs <= 0) {
    return false;
  }

  const storedActivity = readStoredTimestamp(SESSION_LAST_ACTIVITY_KEY);
  const lastSignInMs = user.last_sign_in_at
    ? Date.parse(user.last_sign_in_at)
    : Number.NaN;
  const validLastSignInMs =
    Number.isFinite(lastSignInMs) && lastSignInMs > 0 ? lastSignInMs : 0;
  const effectiveLastActivity = Math.max(storedActivity, validLastSignInMs);

  if (effectiveLastActivity <= 0) {
    return true;
  }

  return Date.now() - effectiveLastActivity >= timeoutMs;
}

function getSiteUrl() {
  if (typeof window === "undefined") {
    if (process.env.NODE_ENV !== "development") {
      return process.env.NEXT_PUBLIC_SITE_URL ?? "";
    }
    return "http://localhost:3000";
  }

  return window.location.origin;
}

function getSafeRedirectPath(redirectTo: string) {
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "/dashboard/home";
  }

  return redirectTo;
}

function getAuthCallbackUrl(redirectTo = "/dashboard/home") {
  const params = new URLSearchParams({
    next: getSafeRedirectPath(redirectTo),
  });

  return `${getSiteUrl()}/auth/callback?${params.toString()}`;
}

function getConfiguredAuthError(): AuthResult {
  return {
    success: false,
    message: supabaseConfigError,
  };
}

export async function signUpUser(
  email: string,
  password: string,
  username: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  try {
    const normalizedEmail = normalizeEmailAddress(email);
    const emailValidationMessage = getEmailValidationMessage(normalizedEmail);

    if (emailValidationMessage) {
      return { success: false, message: emailValidationMessage };
    }

    const passwordPolicy = evaluatePasswordPolicy(password, {
      email: normalizedEmail,
      username,
    });

    if (!passwordPolicy.isValid) {
      return {
        success: false,
        message: `Password is not secure enough: ${passwordPolicy.issues.join(", ")}.`,
      };
    }

    const supabase = getSupabaseClient();
    resetClientSessionActivity();
    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: {
          username: username.trim(),
          full_name: username.trim(),
        },
        emailRedirectTo: getAuthCallbackUrl("/dashboard/home"),
      },
    });

    if (error) {
      clearClientAuthStorage();
      return { success: false, message: error.message };
    }

    if (data.session) {
      resetClientSessionActivity();
    } else {
      clearClientAuthStorage();
    }

    return {
      success: true,
      needsEmailConfirmation: Boolean(data.user && !data.session),
    };
  } catch (error) {
    console.error("Sign up error:", error);
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function signInUser(
  email: string,
  password: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  try {
    const normalizedEmail = normalizeEmailAddress(email);
    const emailValidationMessage = getEmailValidationMessage(normalizedEmail);

    if (emailValidationMessage) {
      return { success: false, message: emailValidationMessage };
    }

    const supabase = getSupabaseClient();
    resetClientSessionActivity();
    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error) {
      clearClientAuthStorage();
      return { success: false, message: error.message };
    }

    resetClientSessionActivity();

    return { success: true };
  } catch (error) {
    clearClientAuthStorage();
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function signInWithGoogle(
  redirectTo = "/dashboard/home"
): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  try {
    const supabase = getSupabaseClient();
    resetClientSessionActivity();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthCallbackUrl(redirectTo),
      },
    });

    if (error) {
      clearClientAuthStorage();
      return { success: false, message: error.message };
    }

    return { success: true, redirecting: true };
  } catch (error) {
    clearClientAuthStorage();
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function resendSignUpConfirmation(
  email: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  try {
    const normalizedEmail = normalizeEmailAddress(email);
    const emailValidationMessage = getEmailValidationMessage(normalizedEmail);

    if (emailValidationMessage) {
      return { success: false, message: emailValidationMessage };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: {
        emailRedirectTo: getAuthCallbackUrl("/dashboard/home"),
      },
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: true,
      message: "Confirmation email sent again. Check your inbox.",
    };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  try {
    const normalizedEmail = normalizeEmailAddress(email);
    const emailValidationMessage = getEmailValidationMessage(normalizedEmail);

    if (emailValidationMessage) {
      return { success: false, message: emailValidationMessage };
    }

    const response = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: normalizedEmail }),
    });
    const result = (await response.json().catch(() => null)) as AuthResult | null;

    if (!response.ok || !result?.success) {
      return {
        success: false,
        message:
          result?.message ||
          "Failed to send password reset link. Please try again later.",
      };
    }

    return { success: true, message: result.message };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function updatePassword(password: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  try {
    const passwordPolicy = evaluatePasswordPolicy(password);

    if (!passwordPolicy.isValid) {
      return {
        success: false,
        message: `Password is not secure enough: ${passwordPolicy.issues.join(", ")}.`,
      };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      return { success: false, message: error.message };
    }

    await supabase.auth.signOut();

    return { success: true, message: "Password updated successfully." };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function verifyCurrentPassword(
  currentPassword: string
): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  if (!currentPassword) {
    return { success: false, message: "Enter your current password first." };
  }

  try {
    const supabase = getSupabaseClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user?.email) {
      return {
        success: false,
        message: "Buck could not verify your current session.",
      };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (error) {
      return {
        success: false,
        message: "Current password is incorrect.",
      };
    }

    return { success: true };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function updateEmailAddress(email: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  try {
    const normalizedEmail = normalizeEmailAddress(email);
    const emailValidationMessage = getEmailValidationMessage(normalizedEmail);

    if (emailValidationMessage) {
      return { success: false, message: emailValidationMessage };
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser(
      { email: normalizedEmail },
      {
        emailRedirectTo: getAuthCallbackUrl("/dashboard/home"),
      }
    );

    if (error) {
      return { success: false, message: error.message };
    }

    return {
      success: true,
      message: "Email change confirmation sent. Check your inbox.",
    };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function signOutUser(): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    clearClientAuthStorage();
    return getConfiguredAuthError();
  }

  try {
    const supabase = getSupabaseClient();
    clearClientAuthStorage();

    const response = await fetch("/api/auth/sign-out", {
      method: "POST",
      cache: "no-store",
      credentials: "include",
    });

    if (!response.ok) {
      const { error } = await supabase.auth.signOut();

      if (error) {
        return { success: false, message: error.message };
      }

      return { success: true };
    }

    try {
      await supabase.auth.signOut({ scope: "local" });
    } catch {
      // Server cookies were already cleared; local cleanup is best-effort.
    }

    clearClientAuthStorage();

    return { success: true };
  } catch (error) {
    try {
      const supabase = getSupabaseClient();
      clearClientAuthStorage();
      const { error: signOutError } = await supabase.auth.signOut();

      if (signOutError) {
        return { success: false, message: signOutError.message };
      }

      return { success: true };
    } catch {
      clearClientAuthStorage();
      return { success: false, message: getErrorMessage(error) };
    }
  }
}
