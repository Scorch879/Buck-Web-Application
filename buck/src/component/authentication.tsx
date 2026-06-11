"use client";

import { useState } from "react";
import type { FormEvent } from "react";
import {
  getSupabaseClient,
  isSupabaseConfigured,
  supabaseConfigError,
} from "@/utils/supabase";
import { evaluatePasswordPolicy } from "@/utils/passwordPolicy";

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
) {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  try {
    const passwordPolicy = evaluatePasswordPolicy(password, { email, username });

    if (!passwordPolicy.isValid) {
      return {
        success: false,
        message: `Password is not secure enough: ${passwordPolicy.issues.join(", ")}.`,
      };
    }

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
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
) {
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

export async function sendMagicLink(
  email: string,
  redirectTo = "/dashboard/home"
) {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
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
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAuthCallbackUrl(redirectTo),
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

export async function resendSignUpConfirmation(
  email: string
) {
  if (!isSupabaseConfigured) {
    return getConfiguredAuthError();
  }

  try {
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.resend({
      type: "signup",
      email: email.trim(),
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
    const response = await fetch("/api/auth/password-reset", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email: email.trim() }),
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
    const supabase = getSupabaseClient();
    const { error } = await supabase.auth.updateUser(
      { email: email.trim() },
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
