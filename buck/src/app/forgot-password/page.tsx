"use client";

import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { sendPasswordReset, updatePassword } from "@/component/authentication";
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

const ForgotPassword = () => {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const isDarkTheme = useAuthPageTheme();
  const resetButton = usePointerGradient<HTMLButtonElement>();
  const passwordPolicy = evaluatePasswordPolicy(newPassword, { email });
  const passwordProgress = Math.min(100, Math.max(8, passwordPolicy.score * 20));
  const confirmStatus =
    confirmPassword.length === 0
      ? ""
      : newPassword === confirmPassword
        ? "Passwords match."
        : "Passwords do not match yet.";

  useEffect(() => {
    const hasRecoveryToken =
      window.location.hash.includes("type=recovery") ||
      window.location.search.includes("type=recovery");

    if (!supabase) return;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") {
        if (hasRecoveryToken) {
          if (session) {
            setIsRecoveryMode(true);
          } else if (window.location.hash.includes("access_token")) {
            // Fallback for older implicit flow email templates
            const hashParams = new URLSearchParams(window.location.hash.substring(1));
            const access_token = hashParams.get("access_token");
            const refresh_token = hashParams.get("refresh_token");

            if (access_token && refresh_token) {
              supabase.auth.setSession({ access_token, refresh_token }).then(({ data, error }) => {
                if (!error && data.session) {
                  setIsRecoveryMode(true);
                  setError("");
                  window.history.replaceState(null, "", window.location.pathname + "?type=recovery");
                } else {
                  setError("This password reset link is invalid or has expired.");
                }
              });
            } else {
              setError("This password reset link is invalid or has expired.");
            }
          } else {
            setError("This password reset link is invalid or has expired.");
          }
        }
      } else if (event === "PASSWORD_RECOVERY" || (hasRecoveryToken && session)) {
        setIsRecoveryMode(true);
        setError("");
      }
    });

    return () => {
      subscription?.unsubscribe();
    };
  }, []);

  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    void audio.play();
  };

  const handleUpdatePassword = async () => {
    if (isSubmitting) {
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
      window.setTimeout(() => router.push("/sign-in"), 900);
      return;
    }

    setError(result.message || "Failed to update password.");
    setMessage("");
    setIsSubmitting(false);
  };

  const handleResetPassword = async () => {
    if (isSubmitting) {
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
        result.message || "Password reset link sent. Check your email."
      );
      setIsSubmitting(false);
    } else {
      setError(
        result.message || "Failed to send password reset link. Please try again later."
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

        <section className="FP-AuthPanel" aria-labelledby="forgot-password-title">
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
                {isRecoveryMode ? "Create new password" : "Reset password"}
              </h2>
              <p>
                {isRecoveryMode
                  ? "Choose a new password for your Buck account."
                  : "Enter the email connected to your Buck account."}
              </p>
            </div>

            <form
              className="FP-Form"
              onSubmit={(event) => {
                event.preventDefault();
                if (isRecoveryMode) {
                  handleUpdatePassword();
                  return;
                }

                handleResetPassword();
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
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                      disabled={isSubmitting}
                    >
                      <Image
                        src={showNewPassword ? "/duck-eye.png" : "/duck-eye-closed.png"}
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
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      disabled={isSubmitting}
                    >
                      <Image
                        src={showConfirmPassword ? "/duck-eye.png" : "/duck-eye-closed.png"}
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
                    <span className="auth-button-spinner" aria-hidden="true" />
                    {isRecoveryMode ? "Updating password..." : "Sending link..."}
                  </>
                ) : (
                  <>
                    {isRecoveryMode ? "Update Password" : "Send Reset Link"}
                    <FaArrowRight aria-hidden="true" />
                  </>
                )}
              </motion.button>

              {message && (
                <div className="forgot-message-card forgot-success">
                  {message}
                </div>
              )}
              {error && (
                <div className="forgot-message-card forgot-error">{error}</div>
              )}
            </form>

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
