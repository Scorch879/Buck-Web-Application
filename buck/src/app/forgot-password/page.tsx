"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendPasswordReset, updatePassword } from "@/component/authentication";
import { toBuckUser } from "@/utils/authUser";
import { supabase } from "@/utils/supabase";
import { evaluatePasswordPolicy } from "@/utils/passwordPolicy";
import { getEmailValidationMessage } from "@/utils/emailValidation";
import { motion } from "framer-motion";
import { usePointerGradient } from "@/hooks/usePointerGradient";
import {
  getAuthButtonBackground,
  useAuthPageTheme,
} from "@/hooks/useAuthPageTheme";
import {
  FaArrowRight,
  FaEnvelope,
  FaShieldAlt,
  FaWallet,
} from "react-icons/fa";
import type { IconType } from "react-icons";
import "./style.css";

type ForgotPasswordHighlight = {
  icon: IconType;
  title: string;
  description: string;
};

const forgotPasswordHighlights: ForgotPasswordHighlight[] = [
  {
    icon: FaEnvelope,
    title: "Reset by email",
    description: "Send a recovery link to the address connected to Buck.",
  },
  {
    icon: FaShieldAlt,
    title: "Protected access",
    description: "Your budget stays behind the same authentication flow.",
  },
  {
    icon: FaWallet,
    title: "Return to tracking",
    description: "Get back to the weekly wallet once your password is reset.",
  },
];

function getRecoveryUrlError(
  searchParams: URLSearchParams,
  hashParams: URLSearchParams
) {
  const errorParam = searchParams.get("error") ?? hashParams.get("error");
  const errorCodeParam =
    searchParams.get("error_code") ?? hashParams.get("error_code");
  const errorDescriptionParam =
    searchParams.get("error_description") ??
    hashParams.get("error_description");

  if (!errorParam && !errorCodeParam) {
    return "";
  }

  if (
    errorParam === "recovery-link-expired" ||
    errorCodeParam === "otp_expired"
  ) {
    return "This password reset link has expired. Enter your email below to request a new one.";
  }

  if (errorParam === "recovery-link-failed" || errorParam === "access_denied") {
    return (
      errorDescriptionParam ||
      "This password reset link is invalid or has already been used. Enter your email below to request a new one."
    );
  }

  return (
    errorDescriptionParam ||
    "This password reset link is invalid or has expired. Enter your email below to request a new one."
  );
}

async function canSessionResetPassword(sessionUser: NonNullable<ReturnType<typeof toBuckUser>>) {
  if (sessionUser.isPasswordUser) {
    return true;
  }

  try {
    const response = await fetch("/api/auth/credentials", { cache: "no-store" });
    if (response.ok) {
      const payload = (await response.json()) as {
        canResetPassword?: boolean;
        hasPasskey?: boolean;
        isPasswordUser?: boolean;
      };
      return Boolean(
        payload.canResetPassword ?? (payload.isPasswordUser || payload.hasPasskey)
      );
    }
  } catch {
    // Fallback to client user check when endpoint is unreachable.
  }

  return !sessionUser.isGoogleOnlyUser;
}

const ForgotPassword = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [recoveryEmail, setRecoveryEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [checkingRecoverySession, setCheckingRecoverySession] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isDarkTheme = useAuthPageTheme();
  const resetButton = usePointerGradient<HTMLButtonElement>();
  const passwordPolicy = evaluatePasswordPolicy(newPassword, {
    email: recoveryEmail || email,
  });
  const passwordProgress = Math.min(100, Math.max(8, passwordPolicy.score * 20));
  const confirmStatus =
    confirmPassword.length === 0
      ? ""
      : newPassword === confirmPassword
        ? "Passwords match."
        : "Passwords do not match yet.";

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash
    );

    const urlError = getRecoveryUrlError(searchParams, hashParams);
    if (urlError) {
      setIsRecoveryMode(false);
      setCheckingRecoverySession(false);
      setError(urlError);
      return;
    }

    const hasRecoveryToken =
      searchParams.get("type") === "recovery" ||
      hashParams.get("type") === "recovery" ||
      hashParams.has("access_token");

    if (!supabase || !hasRecoveryToken) {
      return;
    }

    const activeSupabase = supabase;
    let mounted = true;
    setCheckingRecoverySession(true);

    const applyRecoveryUser = async (
      user: Parameters<typeof toBuckUser>[0]
    ) => {
      if (!mounted || !user) {
        return false;
      }

      const buckUser = toBuckUser(user);
      if (buckUser && !(await canSessionResetPassword(buckUser))) {
        await activeSupabase.auth.signOut().catch(() => undefined);
        if (!mounted) {
          return true;
        }
        setIsRecoveryMode(false);
        setCheckingRecoverySession(false);
        setError(
          "This account signs in with Google, so password reset is not available. Use Continue with Google on the sign-in page."
        );
        return true;
      }

      if (!mounted) {
        return true;
      }

      setRecoveryEmail(user.email ?? "");
      setIsRecoveryMode(true);
      setError("");
      setCheckingRecoverySession(false);
      return true;
    };

    const resolveSession = async () => {
      try {
        const {
          data: { session },
        } = await activeSupabase.auth.getSession();

        if (session?.user) {
          await applyRecoveryUser(session.user);
          return;
        }

        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");

        if (accessToken && refreshToken) {
          const { data, error: sessionError } =
            await activeSupabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });

          if (!mounted) {
            return;
          }

          if (!sessionError && data.session?.user) {
            window.history.replaceState(
              null,
              "",
              `${window.location.pathname}?type=recovery`
            );
            await applyRecoveryUser(data.session.user);
            return;
          }
        }

        if (mounted) {
          setIsRecoveryMode(false);
          setCheckingRecoverySession(false);
          setError(
            "This password reset link is invalid or has expired. Enter your email below to request a new one."
          );
        }
      } catch {
        if (mounted) {
          setIsRecoveryMode(false);
          setCheckingRecoverySession(false);
          setError(
            "This password reset link is invalid or has expired. Enter your email below to request a new one."
          );
        }
      }
    };

    const {
      data: { subscription },
    } = activeSupabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) {
        return;
      }

      if (
        (event === "PASSWORD_RECOVERY" ||
          event === "SIGNED_IN" ||
          event === "INITIAL_SESSION") &&
        session?.user
      ) {
        void applyRecoveryUser(session.user);
      }
    });

    void resolveSession();

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, []);

  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    void audio.play();
  };

  const handleUpdatePassword = async () => {
    if (isSubmitting || checkingRecoverySession) {
      return;
    }

    setMessage("");
    setError("");

    if (!newPassword || !confirmPassword) {
      setError("Please fill in both password fields.");
      return;
    }

    if (!passwordPolicy.isValid) {
      setError(
        `Password is not secure enough: ${passwordPolicy.issues.join(", ")}.`
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsSubmitting(true);
    setMessage("Updating your password...");

    const result = await updatePassword(newPassword);

    if (result.success) {
      setMessage("Password updated. Redirecting to sign in...");
      window.setTimeout(
        () => router.push("/sign-in?reason=password-updated"),
        900
      );
      return;
    }

    setError(result.message || "Failed to update password.");
    setMessage("");
    setIsSubmitting(false);
  };

  const handleResetPassword = async () => {
    if (isSubmitting || checkingRecoverySession) {
      return;
    }

    setMessage("");
    setError("");
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    const emailValidationMessage = getEmailValidationMessage(email);
    if (emailValidationMessage) {
      setError(emailValidationMessage);
      return;
    }

    setIsSubmitting(true);
    setMessage("Sending reset link...");

    const result = await sendPasswordReset(email);

    if (result.success) {
      setMessage(
        result.message ||
          "If password reset is available for that email, a reset link is on its way. Check your inbox."
      );
      setIsSubmitting(false);
    } else {
      setError(
        result.message ||
          "Failed to send password reset link. Please try again later."
      );
      setMessage("");
      setIsSubmitting(false);
    }
  };

  const resetButtonStyle: CSSProperties = {
    background: getAuthButtonBackground(isDarkTheme, resetButton.pointer),
    transition: resetButton.pointer ? "background 0.1s" : "background 0.3s",
  };

  return (
    <div className="FP-Background">
      <motion.main
        className="FP-Page"
        initial={{ opacity: 0, y: 14, scale: 0.985, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <section className="FP-Story" aria-labelledby="forgot-story-title">
          <Link href="/" className="FP-Brand" aria-label="Back to Buck home">
            <span className="FP-BrandMark">
              <Image
                src="/BuckMascot.png"
                alt=""
                width={58}
                height={74}
                className="FP-BrandMascot"
                priority
              />
            </span>
            <span>
              <strong>Buck</strong>
              <small>Budget Tracker</small>
            </span>
          </Link>

          <div className="FP-HeroCopy">
            <p className="FP-Kicker">Account recovery, still calm</p>
            <h1 id="forgot-story-title">
              Get back to your budget without the scramble.
            </h1>
            <p className="FP-DesktopIntro">
              Send yourself a reset link, update your password, and return to
              your weekly plan when you are ready.
            </p>
            <p className="FP-MobileIntro">
              Send a reset link and return when ready.
            </p>
          </div>

          <div className="FP-Highlights" aria-label="Password reset details">
            {forgotPasswordHighlights.map((item) => {
              const HighlightIcon = item.icon;

              return (
                <div className="FP-Highlight" key={item.title}>
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

        <section
          className="FP-AuthPanel"
          aria-labelledby="forgot-password-title"
        >
          <div className="FP-Container">
            <button
              className="FP-Mascot-Top"
              type="button"
              onClick={playQuack}
              aria-label="Play Buck mascot sound"
            >
              <span className="FP-Mascot-Circle">
                <Image
                  src="/BuckMascot.png"
                  alt="Buck Mascot"
                  width={70}
                  height={100}
                  className="FP-Mascot-Img"
                  priority
                />
              </span>
            </button>

            <div className="FP-PanelHeading">
              <p className="FP-Kicker">Need a new key?</p>
              <h2 id="forgot-password-title" className="FP-Title">
                {checkingRecoverySession
                  ? "Verifying reset link"
                  : isRecoveryMode
                    ? "Create new password"
                    : "Reset password"}
              </h2>
              <p>
                {checkingRecoverySession
                  ? "Checking your recovery session..."
                  : isRecoveryMode
                    ? "Choose a new password for your Buck account."
                    : "Enter the email connected to your Buck password account."}
              </p>
            </div>

            {checkingRecoverySession ? (
              <div className="FP-Verifying" role="status" aria-live="polite">
                <span className="auth-button-spinner" aria-hidden="true" />
                <span>Verifying your recovery link...</span>
              </div>
            ) : (
              <form
                className="FP-Form"
                onSubmit={(event) => {
                  event.preventDefault();
                  if (isRecoveryMode) {
                    void handleUpdatePassword();
                    return;
                  }

                  void handleResetPassword();
                }}
              >
                {isRecoveryMode ? (
                  <>
                    <label htmlFor="new-password" className="FP-Label">
                      New password
                    </label>
                    <div className="FP-InputWrapper">
                      <input
                        id="new-password"
                        type={showNewPassword ? "text" : "password"}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="FP-Input"
                        placeholder="Create a new password"
                        autoComplete="new-password"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        className="FP-Eye-Btn"
                        tabIndex={-1}
                        onClick={() => setShowNewPassword((v) => !v)}
                        aria-label={
                          showNewPassword ? "Hide password" : "Show password"
                        }
                        disabled={isSubmitting}
                      >
                        <Image
                          src={
                            showNewPassword
                              ? "/duck-eye.png"
                              : "/duck-eye-closed.png"
                          }
                          alt=""
                          width={24}
                          height={24}
                        />
                      </button>
                    </div>
                    {newPassword ? (
                      <div
                        className={`FP-PasswordFeedback FP-PasswordFeedback--${passwordPolicy.strength}`}
                        aria-live="polite"
                      >
                        <div className="FP-PasswordSummary">
                          <strong>{passwordPolicy.label}</strong>
                          <span>{passwordPolicy.score}/5 checks</span>
                        </div>
                        <div className="FP-PasswordMeter" aria-hidden="true">
                          <span style={{ width: `${passwordProgress}%` }} />
                        </div>
                        {passwordPolicy.issues.length > 0 ? (
                          <ul>
                            {passwordPolicy.issues.map((issue) => (
                              <li key={issue}>{issue}</li>
                            ))}
                          </ul>
                        ) : (
                          <p>
                            Your password meets Buck&apos;s security
                            requirements.
                          </p>
                        )}
                      </div>
                    ) : null}

                    <label htmlFor="confirm-password" className="FP-Label">
                      Confirm password
                    </label>
                    <div className="FP-InputWrapper">
                      <input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="FP-Input"
                        placeholder="Confirm your new password"
                        autoComplete="new-password"
                        disabled={isSubmitting}
                      />
                      <button
                        type="button"
                        className="FP-Eye-Btn"
                        tabIndex={-1}
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={
                          showConfirmPassword
                            ? "Hide password"
                            : "Show password"
                        }
                        disabled={isSubmitting}
                      >
                        <Image
                          src={
                            showConfirmPassword
                              ? "/duck-eye.png"
                              : "/duck-eye-closed.png"
                          }
                          alt=""
                          width={24}
                          height={24}
                        />
                      </button>
                    </div>
                    {confirmStatus ? (
                      <p
                        className={`FP-ConfirmHint${
                          newPassword === confirmPassword
                            ? " FP-ConfirmHint--match"
                            : ""
                        }`}
                        aria-live="polite"
                      >
                        {confirmStatus}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <>
                    <label htmlFor="forgot-email" className="FP-Label">
                      Email address
                    </label>
                    <input
                      id="forgot-email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="FP-Input"
                      placeholder="you@example.com"
                      autoComplete="email"
                      disabled={isSubmitting}
                    />
                  </>
                )}

                <motion.button
                  ref={resetButton.ref}
                  type="submit"
                  className="FP-Btn"
                  onMouseMove={resetButton.handlePointerMove}
                  onMouseLeave={resetButton.handlePointerLeave}
                  style={resetButtonStyle}
                  whileHover={isSubmitting ? undefined : { scale: 1.02 }}
                  disabled={isSubmitting}
                  aria-busy={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <span
                        className="auth-button-spinner"
                        aria-hidden="true"
                      />
                      {isRecoveryMode
                        ? "Updating password..."
                        : "Sending link..."}
                    </>
                  ) : (
                    <>
                      {isRecoveryMode ? "Update Password" : "Send Reset Link"}
                      <FaArrowRight aria-hidden="true" />
                    </>
                  )}
                </motion.button>

                {message && (
                  <div
                    className="forgot-message-card forgot-success"
                    role="status"
                  >
                    {message}
                  </div>
                )}
                {error && (
                  <div
                    className="forgot-message-card forgot-error"
                    role="alert"
                  >
                    {error}
                  </div>
                )}
              </form>
            )}

            {!isRecoveryMode && !checkingRecoverySession ? (
              <p className="FP-ProviderHint">
                Signed up with Google?{" "}
                <Link href="/sign-in" className="FP-Link">
                  Use Continue with Google
                </Link>{" "}
                instead.
              </p>
            ) : null}

            <div className="FP-Footer">
              Remembered it?{" "}
              <Link href="/sign-in" className="FP-Link">
                Back to Sign In
              </Link>
            </div>
          </div>
        </section>
      </motion.main>
    </div>
  );
};

export default ForgotPassword;
