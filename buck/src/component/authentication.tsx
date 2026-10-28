"use client";

import { useState } from "react";
import type { FormEvent } from "react";
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
import { toast } from "@/component/toast";

type AuthFormData = {
  username: string;
  pass: string;
  confirm: string;
  email: string;
};

type AuthResult = {
  success: boolean;
  message?: string;
  cancelled?: boolean;
  redirecting?: boolean;
  needsEmailConfirmation?: boolean;
};

type AuthFormInputEvent = {
  target: HTMLInputElement;
};

const CLIENT_AUTH_STORAGE_KEYS = [
  "buck-dashboard-cache-v1",
  "buck-session-last-activity",
  "buck-session-force-signout",
  "selectedGoalId",
];

const DEFAULT_IDLE_TIMEOUT_MINUTES = 30;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function getClientIdleTimeoutMs() {
  const parsed = Number(process.env.NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES);
  const minutes =
    Number.isFinite(parsed) && parsed >= 0
      ? parsed
      : DEFAULT_IDLE_TIMEOUT_MINUTES;

  return minutes * 60 * 1000;
}

export function clearClientAuthStorage() {
  if (typeof window === "undefined") {
    return;
  }

  CLIENT_AUTH_STORAGE_KEYS.forEach((key) => {
    try {
      window.localStorage.removeItem(key);
    } catch {
      // Local storage cleanup is best-effort.
    }

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

  const now = String(Date.now());

  try {
    window.localStorage.setItem("buck-session-last-activity", now);
    window.localStorage.removeItem("buck-session-force-signout");
  } catch {
    // Local storage write is best-effort.
  }

  try {
    window.sessionStorage.removeItem("buck-dashboard-cache-v1");
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

  let storedActivity = 0;

  try {
    const raw = window.localStorage.getItem("buck-session-last-activity");
    const parsed = raw ? Number(raw) : 0;
    storedActivity = Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    storedActivity = 0;
  }

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

export function SignInSignUp() {
  const initialFormState: AuthFormData = {
    username: "",
    pass: "",
    confirm: "",
    email: "",
  };
  const [form, setForm] = useState(initialFormState);

  const handleChange = (e: AuthFormInputEvent) => {
    setForm({ ...form, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (form.username === "" || form.pass === "" || form.email === "") {
      toast("Please fill in all fields", "warning");
      return;
    }

    if (form.pass !== form.confirm) {
      toast("Passwords do not match", "error");
      return;
    }

    const emailValidationMessage = getEmailValidationMessage(form.email);
    if (emailValidationMessage) {
      toast(emailValidationMessage, "error");
      return;
    }

    const result = await signUpUser(
      normalizeEmailAddress(form.email),
      form.pass,
      form.username
    );

    if (!result.success) {
      toast(result.message || "Sign up failed.", "error");
      return;
    }

    toast(
      result.needsEmailConfirmation
        ? "Account created. Please check your email to confirm your account."
        : "Sign up successful!",
      "success"
    );
  };

  return {
    form,
    handleChange,
    handleSubmit,
  };
}

export async function signUpUser(
  email: string,
  password: string,
  username: string
) {
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
) {
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

export async function sendMagicLink(
  email: string,
  redirectTo = "/dashboard/home"
) {
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
    clearClientAuthStorage();
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        emailRedirectTo: getAuthCallbackUrl(redirectTo),
      },
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: "Magic link sent. Check your email." };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function signInWithGoogle(
  redirectTo = "/dashboard/home"
) {
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
) {
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

export async function sendPasswordReset(email: string) {
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

export async function updatePassword(password: string) {
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

export async function verifyCurrentPassword(currentPassword: string) {
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

export async function updateEmailAddress(email: string) {
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

export async function signOutUser() {
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
