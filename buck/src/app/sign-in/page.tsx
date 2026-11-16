"use client";
import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import {
  clearClientAuthStorage,
  resendSignUpConfirmation,
  resetClientSessionActivity,
  signInUser,
  signInWithGoogle,
  type AuthResult,
} from "@/component/authentication";
import { getSafeAppPath } from "@/utils/authUser";
import { useRedirectIfAuthenticated } from "@/utils/useAuthGuard";
import { OAUTH_CONSENT_PATH, createMfaVerifyPath } from "@/utils/mfa/assurance";
import { supabase } from "@/utils/supabase";
import {
  getEmailValidationMessage,
  normalizeEmailAddress,
} from "@/utils/emailValidation";
import { motion } from "framer-motion";
import { usePointerGradient } from "@/hooks/usePointerGradient";
import {
  getAuthButtonBackground,
  useAuthPageTheme,
} from "@/hooks/useAuthPageTheme";
import {
  FaArrowRight,
  FaChartLine,
  FaFingerprint,
  FaPiggyBank,
  FaWallet,
} from "react-icons/fa";
import type { IconType } from "react-icons";
import "./style.css";

type SignInHighlight = {
  icon: IconType;
  title: string;
  description: string;
};

const signInHighlights: SignInHighlight[] = [
  {
    icon: FaWallet,
    title: "Weekly wallet view",
    description: "See spending, budgets, and remaining room in one glance.",
  },
  {
    icon: FaPiggyBank,
    title: "Goal protection",
    description: "Keep saving targets visible before every expense decision.",
  },
  {
    icon: FaChartLine,
    title: "Friendly AI guidance",
    description: "Turn spending patterns into calm, practical next steps.",
  },
];

type ExtendedAuthResult = AuthResult & {
  errorCode?: string;
  providerConflict?: "google" | "email";
};

function getAuthNotice(reason: string | null) {
  switch (reason) {
    case "session-expired":
      return "You were signed out after a period of inactivity.";
    case "mfa-recovery-sign-in-required":
      return "Sign in to finish removing two-factor. Then open the e-mail link again.";
    case "password-updated":
      return "Password updated. Sign in with your new password.";
    case "email-verified":
      return "Email verified! Sign in to open your Buck dashboard.";
    case "account-deletion-scheduled":
      return "Account deletion scheduled for 10 days from now. Sign back in anytime during those 10 days to cancel it automatically.";
    case "account-deletion-sign-in-required":
      return "Sign in with this account to finish confirming account deletion.";
    case "account-deletion-invalid-link":
      return "That account deletion link is invalid or has already been used.";
    case "account-deletion-link-expired":
      return "That account deletion link has expired. Request a new one from Settings.";
    case "account-deletion-confirm-failed":
      return "Buck could not confirm account deletion right now. Please sign in and try again.";
    case "account-deletion-not-configured":
      return "Account deletion is not configured on the server.";
    default:
      return "";
  }
}

function getAuthError(
  error: string | null,
  errorCode?: string | null,
  errorDescription?: string | null
) {
  switch (error) {
    case "supabase-not-configured":
      return "Supabase authentication is not configured yet.";
    case "session-security-not-configured":
      return "Session security is not configured. Add SESSION_COOKIE_SECRET before using protected pages in production.";
    case "google-signin-failed":
      return "Buck could not finish Google sign in. Please try again.";
    case "email-verification-expired":
      return "That email verification link has expired. Request a new confirmation email below.";
    case "email-verification-failed":
      return "Buck could not verify that email link. Request a fresh confirmation email below.";
    case "recovery-not-available-for-google":
      return "This account signs in with Google, so password reset isn't available. Use Continue with Google below.";
    case "auth-callback-missing-code":
      return "The verification or sign-in link was incomplete. Please try again.";
    case "auth-callback-failed":
      return "That verification or sign-in link is invalid or has expired. Please try again.";
    case "access_denied":
      return errorCode === "otp_expired"
        ? "That verification link has expired. Please request a fresh confirmation email."
        : errorDescription || "Access was denied or the link has expired.";
    default:
      if (errorCode === "otp_expired") {
        return "That verification link has expired. Please request a fresh confirmation email.";
      }
      return "";
  }
}

const SignIn = () => {
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [message, setMsg] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/dashboard/home");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [passkeySupported, setPasskeySupported] = useState(false);
  const [unconfirmedEmail, setUnconfirmedEmail] = useState("");
  const [showVerificationLink, setShowVerificationLink] = useState(false);
  const [isResendingConfirmation, setIsResendingConfirmation] = useState(false);
  const isDarkTheme = useAuthPageTheme();
  const signInButton = usePointerGradient<HTMLButtonElement>();
  const isAuthBusy =
    isSigningIn || isGoogleLoading || isPasskeyLoading || isResendingConfirmation;

  const openAuthRedirect = (path: string) => {
    window.location.assign(path);
  };

  // ADR-048: a 2FA account signed in at aal1 goes to /verify-2fa first.
  const openPostSignInRedirect = async (path: string) => {
    try {
      const { data } = (await supabase?.auth.mfa.getAuthenticatorAssuranceLevel()) ?? {};

      if (data?.currentLevel === "aal1" && data.nextLevel === "aal2") {
        openAuthRedirect(createMfaVerifyPath(path));
        return;
      }
    } catch {
      // The middleware still sends unsatisfied sessions to /verify-2fa.
    }

    openAuthRedirect(path);
  };

  useEffect(() => {
    // A server-side idle logout redirects here without running the client
    // sign-out, so drop any cached financial data left in this tab.
    try {
      clearClientAuthStorage();
    } catch {
      // Storage may be unavailable; the cache is only a speed boost.
    }

    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash
    );

    setRedirectTo(
      getSafeAppPath(searchParams.get("redirectTo"), [
        OAUTH_CONSENT_PATH,
        "/account/delete/confirm",
      ])
    );

    const errorParam = searchParams.get("error") ?? hashParams.get("error");
    const errorCodeParam =
      searchParams.get("error_code") ?? hashParams.get("error_code");
    const errorDescriptionParam =
      searchParams.get("error_description") ??
      hashParams.get("error_description");
    const emailParam = searchParams.get("email")?.trim() ?? "";

    if (emailParam) {
      setEmail(emailParam);
    }

    if (
      errorParam === "email-verification-expired" ||
      errorParam === "email-verification-failed" ||
      errorCodeParam === "otp_expired"
    ) {
      setShowVerificationLink(true);
      if (emailParam) {
        setUnconfirmedEmail(emailParam);
      }
    }

    setMsg(getAuthNotice(searchParams.get("reason")));
    setError(getAuthError(errorParam, errorCodeParam, errorDescriptionParam));
    setPasskeySupported(Boolean(supabase && window.PublicKeyCredential));
  }, []);

  useRedirectIfAuthenticated(redirectTo);

  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (isAuthBusy) {
      return;
    }

    setError("");
    setMsg("");
    setUnconfirmedEmail("");
    setShowVerificationLink(false);
    const normalizedEmail = normalizeEmailAddress(email);

    if (!normalizedEmail || !pass) {
      setError("Please enter both email and password.");
      return;
    }
    const emailValidationMessage = getEmailValidationMessage(email);
    if (emailValidationMessage) {
      setError(emailValidationMessage);
      return;
    }
    if (pass.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsSigningIn(true);
    setMsg("Checking your account...");

    const result: ExtendedAuthResult = await signInUser(normalizedEmail, pass);

    if (result.success) {
      resetClientSessionActivity();
      setMsg("Sign in successful. Opening your dashboard...");
      await openPostSignInRedirect(redirectTo);
      return;
    } else {
      const isUnconfirmed =
        result.errorCode === "email_not_confirmed" ||
        /email not confirmed/i.test(result.message || "");

      if (isUnconfirmed) {
        setUnconfirmedEmail(normalizedEmail);
        setShowVerificationLink(true);
        setError(
          result.message ||
            "Please confirm your email address before signing in."
        );
      } else {
        setError(result.message || "Sign in failed.");
      }
      setMsg("");
      setIsSigningIn(false);
    }
  };

  const handleResendConfirmation = async () => {
    const targetEmail = normalizeEmailAddress(unconfirmedEmail || email);
    if (isAuthBusy || !targetEmail) {
      return;
    }

    setError("");
    setMsg("Sending confirmation email...");
    setIsResendingConfirmation(true);

    const result: ExtendedAuthResult = await resendSignUpConfirmation(targetEmail);
    setIsResendingConfirmation(false);

    if (result.success) {
      setMsg(result.message || "Confirmation email sent again. Check your inbox.");
      return;
    }

    setMsg("");
    setError(result.message || "Could not resend confirmation email.");
  };

  const handleGoogleSignIn = async () => {
    if (isAuthBusy) {
      return;
    }

    setError("");
    setMsg("Opening Google sign in...");
    setIsGoogleLoading(true);

    const result = await signInWithGoogle(redirectTo);

    if (result.success) {
      setMsg("Redirecting to Google...");

      if (!result.redirecting) {
        openAuthRedirect(redirectTo);
      }
    } else if (result.cancelled) {
      setMsg("");
      setIsGoogleLoading(false);
    } else {
      setError(result.message || "Google Sign-In failed.");
      setMsg("");
      setIsGoogleLoading(false);
    }
  };

  const handlePasskeySignIn = async () => {
    if (isAuthBusy || !supabase) {
      return;
    }

    setError("");
    setMsg("Waiting for your passkey...");
    setIsPasskeyLoading(true);

    try {
      resetClientSessionActivity();
      const { error: passkeyError } = await supabase.auth.signInWithPasskey();

      if (passkeyError) {
        throw passkeyError;
      }

      resetClientSessionActivity();
      setMsg("Sign in successful. Opening your dashboard...");
      await openPostSignInRedirect(redirectTo);
    } catch (passkeyError) {
      const name =
        passkeyError && typeof passkeyError === "object" && "name" in passkeyError
          ? String(passkeyError.name)
          : "";
      const text = passkeyError instanceof Error ? passkeyError.message : "";

      setMsg("");
      setIsPasskeyLoading(false);

      // Closing the browser prompt is not an error.
      if (name !== "NotAllowedError" && name !== "AbortError" && !/cancel|not allowed/i.test(text)) {
        setError(text || "Passkey sign in failed. Try your password instead.");
      }
    }
  };

  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    void audio.play();
  };

  const signInButtonStyle: CSSProperties = {
    background: getAuthButtonBackground(isDarkTheme, signInButton.pointer),
    transition: signInButton.pointer ? "background 0.1s" : "background 0.3s",
  };

  return (
    <div className="SI-Background">
      <motion.main
        className="SI-Page"
        initial={{ opacity: 0, y: 14, scale: 0.985, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <section className="SI-Story" aria-labelledby="sign-in-story-title">
          <Link href="/" className="SI-Brand" aria-label="Back to Buck home">
            <span className="SI-BrandMark">
              <Image
                src="/BuckMascot.png"
                alt=""
                width={58}
                height={74}
                className="SI-BrandMascot"
                priority
              />
            </span>
            <span>
              <strong>Buck</strong>
              <small>Budget Tracker</small>
            </span>
          </Link>

          <div className="SI-HeroCopy">
            <p className="SI-Kicker">Personal budgeting, minus the mess</p>
            <h1 id="sign-in-story-title">
              Pick up your budget exactly where you left it.
            </h1>
            <p className="SI-DesktopIntro">
              Sign back in to review your weekly spending, protect your goals,
              and get clear AI guidance before the week gets noisy.
            </p>
            <p className="SI-MobileIntro">
              Sign in and get back to your budget.
            </p>
          </div>

          <div className="SI-Highlights" aria-label="Buck sign in highlights">
            {signInHighlights.map((item) => {
              const HighlightIcon = item.icon;

              return (
                <div className="SI-Highlight" key={item.title}>
                  <span>
                    <HighlightIcon aria-hidden="true" />
                  </span>
                  <div>
                    <strong>{item.title}</strong>
                    <p>{item.description}</p>
                  </div>
                </div>
              );
            })}
          </div>

        </section>

        <section className="SI-AuthPanel" aria-labelledby="sign-in-title">
          <div className="SI-Container">
            <button
              className="SI-Mascot-Top"
              type="button"
              onClick={playQuack}
              aria-label="Play Buck mascot sound"
            >
              <span className="SI-Mascot-Circle">
                <Image
                  src="/BuckMascot.png"
                  alt="Buck Mascot"
                  width={70}
                  height={100}
                  className="SI-Mascot-Img"
                  priority
                />
              </span>
            </button>

            <div className="SI-PanelHeading">
              <p className="SI-Kicker">Welcome back</p>
              <h2 id="sign-in-title" className="SI-Title">
                Sign in to Buck
              </h2>
              <p>Track the week, check your goals, and keep moving steady.</p>
            </div>

            <button
              className="SI-Google-Btn"
              type="button"
              onClick={handleGoogleSignIn}
              disabled={isAuthBusy}
              aria-busy={isGoogleLoading}
            >
              {isGoogleLoading ? (
                <span className="auth-button-spinner" aria-hidden="true" />
              ) : (
                <Image
                  src="/Google.png"
                  alt=""
                  width={20}
                  height={20}
                  className="SI-Google-Icon"
                />
              )}
              {isGoogleLoading ? "Opening Google..." : "Continue with Google"}
            </button>

            {passkeySupported ? (
              <button
                className="SI-Google-Btn SI-Passkey-Btn"
                type="button"
                onClick={() => void handlePasskeySignIn()}
                disabled={isAuthBusy}
                aria-busy={isPasskeyLoading}
              >
                {isPasskeyLoading ? (
                  <span className="auth-button-spinner" aria-hidden="true" />
                ) : (
                  <FaFingerprint className="SI-Google-Icon" aria-hidden="true" />
                )}
                {isPasskeyLoading ? "Waiting for your passkey..." : "Sign in with a passkey"}
              </button>
            ) : null}

            <div className="SI-Divider">
              <span>or sign in with email</span>
            </div>

            <form className="SI-Form" onSubmit={handleSignIn}>
              <label htmlFor="username" className="SI-Label">
                Email address
              </label>
              <input
                id="username"
                className="SI-Input"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username webauthn"
                disabled={isAuthBusy}
              />

              <div className="SI-LabelRow">
                <label htmlFor="password" className="SI-Label">
                  Password
                </label>
                <Link href="/forgot-password" className="SI-Link">
                  Forgot password?
                </Link>
              </div>
              <div className="SI-InputWrapper">
                <input
                  id="password"
                  className="SI-Input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={pass}
                  onChange={(e) => setPass(e.target.value)}
                  autoComplete="current-password"
                  disabled={isAuthBusy}
                />
                <button
                  type="button"
                  className="SI-Eye-Btn"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  disabled={isAuthBusy}
                >
                  <Image
                    src={showPassword ? "/duck-eye.png" : "/duck-eye-closed.png"}
                    alt=""
                    width={24}
                    height={24}
                  />
                </button>
              </div>
              <Link
                href="/forgot-password"
                className="SI-Link SI-ForgotLinkMobile"
              >
                Forgot password?
              </Link>

              <motion.button
                ref={signInButton.ref}
                type="submit"
                className="SI-Btn"
                onMouseMove={signInButton.handlePointerMove}
                onMouseLeave={signInButton.handlePointerLeave}
                style={signInButtonStyle}
                whileHover={isAuthBusy ? undefined : { scale: 1.02 }}
                disabled={isAuthBusy}
                aria-busy={isSigningIn}
              >
                {isSigningIn ? (
                  <>
                    <span className="auth-button-spinner" aria-hidden="true" />
                    Signing in...
                  </>
                ) : (
                  <>
                    Sign In
                    <FaArrowRight aria-hidden="true" />
                  </>
                )}
              </motion.button>

              {message && (
                <div className="success-message" role="status">
                  {message}
                </div>
              )}
              {error ? (
                unconfirmedEmail || showVerificationLink ? (
                  <div className="SI-ErrorCard" role="alert">
                    <p>{error}</p>
                    <div className="SI-ErrorActions">
                      {unconfirmedEmail ? (
                        <button
                          type="button"
                          className="SI-InlineActionBtn"
                          onClick={() => void handleResendConfirmation()}
                          disabled={isAuthBusy}
                        >
                          {isResendingConfirmation
                            ? "Sending..."
                            : "Resend confirmation email"}
                        </button>
                      ) : null}
                      <Link
                        href={
                          unconfirmedEmail
                            ? `/check-email?email=${encodeURIComponent(unconfirmedEmail)}`
                            : "/check-email"
                        }
                        className="SI-Link"
                      >
                        Open verification page
                      </Link>
                    </div>
                  </div>
                ) : (
                  <div className="error-message" role="alert">
                    {error}
                  </div>
                )
              ) : null}
            </form>

            <div className="SI-Create">
              Don&apos;t have an account?{" "}
              <Link href="/create-account" className="SI-Link">
                Create Account
              </Link>
            </div>
          </div>
        </section>
      </motion.main>
    </div>
  );
};

export default SignIn;
