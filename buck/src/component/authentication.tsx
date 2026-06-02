"use client";

import { useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { getSupabaseClient, isSupabaseConfigured } from "@/utils/supabase";

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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong.";
}

function getSiteUrl() {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_SITE_URL ?? "";
  }

  return window.location.origin;
}

function getSafeRedirectPath(redirectTo: string) {
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "/dashboard/home";
  }

  return redirectTo;
}

function getConfiguredAuthError(): AuthResult {
  return {
    success: false,
    message:
      "Supabase authentication is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.",
  };
}

export function SignInSignUp() {
  const [form, setForm] = useState<AuthFormData>({
    username: "",
    pass: "",
    confirm: "",
    email: "",
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.id]: e.target.value });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (form.username === "" || form.pass === "" || form.email === "") {
      alert("Please fill in all fields");
      return;
    }

    if (form.pass !== form.confirm) {
      alert("Passwords do not match");
      return;
    }

    if (!emailRegex.test(form.email)) {
      alert("Please enter a valid email address");
      return;
    }

    const result = await signUpUser(form.email, form.pass, form.username);

    if (!result.success) {
      alert(result.message || "Sign up failed.");
      return;
    }

    alert(
      result.needsEmailConfirmation
        ? "Account created. Please check your email to confirm your account."
        : "Sign up successful!"
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
): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  try {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          username: username.trim(),
          full_name: username.trim(),
        },
        emailRedirectTo: `${getSiteUrl()}/dashboard/home`,
      },
    });

    if (error) {
      return { success: false, message: error.message };
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
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (error) {
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getSiteUrl()}${getSafeRedirectPath(redirectTo)}`,
      },
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, redirecting: true };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function sendPasswordReset(email: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${getSiteUrl()}/forgot-password`,
    });

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true, message: "Password reset email sent!" };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
}

export async function updatePassword(password: string): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  try {
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

export async function signOutUser(): Promise<AuthResult> {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signOut();

    if (error) {
      return { success: false, message: error.message };
    }

    return { success: true };
  } catch (error) {
    return { success: false, message: getErrorMessage(error) };
  }
}
