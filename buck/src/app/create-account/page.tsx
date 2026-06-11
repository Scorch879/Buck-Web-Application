"use client";

import { useState } from "react";
import type { ChangeEvent, CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInWithGoogle, signUpUser } from "@/component/authentication";
import { useRedirectIfAuthenticated } from "@/utils/useAuthGuard";
import { evaluatePasswordPolicy } from "@/utils/passwordPolicy";
import { motion } from "framer-motion";
import { usePointerGradient } from "@/hooks/usePointerGradient";
import {
  getAuthButtonBackground,
  useAuthPageTheme,
} from "@/hooks/useAuthPageTheme";
import {
  FaArrowRight,
  FaChartLine,
  FaPiggyBank,
  FaWallet,
} from "react-icons/fa";
import type { IconType } from "react-icons";
import "./style.css";

type CreateAccountHighlight = {
  icon: IconType;
  title: string;
  description: string;
};

const createAccountHighlights: CreateAccountHighlight[] = [
  {
    icon: FaWallet,
    title: "Set your weekly wallet",
    description: "Start with a clear budget that is easy to check every day.",
  },
  {
    icon: FaPiggyBank,
    title: "Protect saving goals",
    description: "Give future-you a target before daily spending gets loud.",
  },
  {
    icon: FaChartLine,
    title: "Plan with AI guidance",
    description: "Let Buck turn new patterns into practical next steps.",
  },
];

const CreateAccount = () => {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirm: "",
  });
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const isDarkTheme = useAuthPageTheme();
  const createButton = usePointerGradient<HTMLButtonElement>();
  const isAuthBusy = isCreatingAccount || isGoogleLoading;
  const passwordPolicy = evaluatePasswordPolicy(form.password, {
    email: form.email,
    username: form.username,
  });
  const passwordScore = Math.min(5, Math.max(0, passwordPolicy.score));
  const passwordProgress = form.password.length === 0 ? 0 : passwordScore * 20;
  const passwordHint =
    form.password.length === 0
      ? "Use 10+ characters, mixed letters, a number, and a symbol."
      : passwordPolicy.isValid
        ? "Your password meets Buck's security requirements."
        : passwordPolicy.issues[0];
  const confirmStatus =
    form.confirm.length === 0
      ? ""
      : form.password === form.confirm
        ? "Passwords match."
        : "Passwords do not match yet.";
  useRedirectIfAuthenticated();

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.id]: e.target.value });
  };

  const handleCreateAccount = async () => {
    if (isAuthBusy) {
      return;
    }

    setError("");
    setMessage("");

    if (
      !form.username.trim() ||
      !form.email.trim() ||
      !form.password.trim() ||
      !form.confirm.trim()
    ) {
      setError("Please fill in all fields.");
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (form.password !== form.confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (!passwordPolicy.isValid) {
      setError(
        `Password is not secure enough: ${passwordPolicy.issues.join(", ")}.`
      );
      return;
    }

    setIsCreatingAccount(true);
    setMessage("Creating your Buck account...");

    const result = await signUpUser(form.email, form.password, form.username);

    if (result.success) {
      setForm({ username: "", email: "", password: "", confirm: "" });

      if (result.needsEmailConfirmation) {
        router.push(`/check-email?email=${encodeURIComponent(form.email)}`);
        return;
      }

      setMessage("Account created! Redirecting to your dashboard...");
      router.push("/dashboard/home");
    } else {
      setError(result.message || "Account creation failed.");
      setMessage("");
      setIsCreatingAccount(false);
    }
  };

  const handleGoogleSignIn = async () => {
    if (isAuthBusy) {
      return;
    }

    setError("");
    setMessage("Opening Google sign in...");
    setIsGoogleLoading(true);

    const result = await signInWithGoogle();

    if (result.success) {
      if (!result.redirecting) {
        router.push("/dashboard/home");
      }
    } else if (result.cancelled) {
      setMessage("");
      setIsGoogleLoading(false);
    } else {
      setError(result.message || "Google Sign-In failed.");
      setMessage("");
      setIsGoogleLoading(false);
    }
  };

  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    void audio.play();
  };

  const createButtonStyle: CSSProperties = {
    background: getAuthButtonBackground(isDarkTheme, createButton.pointer),
    transition: createButton.pointer ? "background 0.1s" : "background 0.3s",
  };

  return (
    <div className="CA-Background">
      <motion.main
        className="CA-Page"
        initial={{ opacity: 0, y: 14, scale: 0.985, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <section className="CA-Story" aria-labelledby="create-story-title">
          <Link href="/" className="CA-Brand" aria-label="Back to Buck home">
            <span className="CA-BrandMark">
              <Image
                src="/BuckMascot.png"
                alt=""
                width={58}
                height={74}
                className="CA-BrandMascot"
                priority
              />
            </span>
            <span>
              <strong>Buck</strong>
              <small>Budget Tracker</small>
            </span>
          </Link>

          <div className="CA-HeroCopy">
            <p className="CA-Kicker">Start budgeting without the mess</p>
            <h1 id="create-story-title">
              Build a budget home that keeps up with you.
            </h1>
            <p className="CA-DesktopIntro">
              Create your Buck account to track spending, protect goals, and
              keep your weekly plan visible from the first day.
            </p>
            <p className="CA-MobileIntro">
              Create your tracker and start clean.
            </p>
          </div>

          <div className="CA-Highlights" aria-label="Create account benefits">
            {createAccountHighlights.map((item) => {
              const HighlightIcon = item.icon;

              return (
                <div className="CA-Highlight" key={item.title}>
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

        <section className="CA-AuthPanel" aria-labelledby="create-account-title">
          <div className="CA-Container">
            <button
              className="CA-Mascot-Top"
              type="button"
              onClick={playQuack}
              aria-label="Play Buck mascot sound"
            >
              <span className="CA-Mascot-Circle">
                <Image
                  src="/BuckMascot.png"
                  alt="Buck Mascot"
                  width={70}
                  height={100}
                  className="CA-Mascot-Img"
                  priority
                />
              </span>
            </button>

            <div className="CA-PanelHeading">
              <p className="CA-Kicker">New to Buck?</p>
              <h2 id="create-account-title" className="CA-Title">
                Create account
              </h2>
              <p>Set up your tracker and start keeping the week visible.</p>
            </div>

            <button
              className="CA-Google-Btn"
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
                  className="CA-Google-Icon"
                />
              )}
              {isGoogleLoading ? "Opening Google..." : "Continue with Google"}
            </button>

            <div className="CA-Divider">
              <span>or create with email</span>
            </div>

            <form
              className="CA-Form"
              onSubmit={(e) => {
                e.preventDefault();
                handleCreateAccount();
              }}
            >
              <label htmlFor="username" className="CA-Label">
                Username
              </label>
              <input
                id="username"
                className="CA-Input"
                type="text"
                placeholder="Your display name"
                value={form.username}
                onChange={handleChange}
                autoComplete="username"
                disabled={isAuthBusy}
              />

              <label htmlFor="email" className="CA-Label">
                Email address
              </label>
              <input
                id="email"
                className="CA-Input"
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
                disabled={isAuthBusy}
              />

              <label htmlFor="password" className="CA-Label">
                Password
              </label>
              <div className="CA-InputWrapper">
                <input
                  id="password"
                  className="CA-Input"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={form.password}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={isAuthBusy}
                />
                <button
                  type="button"
                  className="CA-Eye-Btn"
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
              <div
                className={`CA-PasswordFeedback CA-PasswordFeedback--${passwordPolicy.strength}${
                  form.password.length === 0 ? " CA-PasswordFeedback--idle" : ""
                }`}
                aria-live="polite"
              >
                <div className="CA-PasswordMeter" aria-hidden="true">
                  <span style={{ width: `${passwordProgress}%` }} />
                </div>
                <div className="CA-PasswordSummary">
                  <strong>{passwordPolicy.label}</strong>
                  <span>{passwordScore}/5 checks</span>
                </div>
                <p className="CA-PasswordHint">{passwordHint}</p>
              </div>

              <label htmlFor="confirm" className="CA-Label">
                Confirm password
              </label>
              <div className="CA-InputWrapper">
                <input
                  id="confirm"
                  className="CA-Input"
                  type={showConfirm ? "text" : "password"}
                  placeholder="Confirm your password"
                  value={form.confirm}
                  onChange={handleChange}
                  autoComplete="new-password"
                  disabled={isAuthBusy}
                />
                <button
                  type="button"
                  className="CA-Eye-Btn"
                  tabIndex={-1}
                  onClick={() => setShowConfirm((v) => !v)}
                  aria-label={showConfirm ? "Hide password" : "Show password"}
                  disabled={isAuthBusy}
                >
                  <Image
                    src={showConfirm ? "/duck-eye.png" : "/duck-eye-closed.png"}
                    alt=""
                    width={24}
                    height={24}
                  />
                </button>
              </div>
              <p
                className={`CA-ConfirmHint${
                  form.password === form.confirm && confirmStatus
                    ? " CA-ConfirmHint--match"
                    : ""
                }${confirmStatus ? "" : " CA-ConfirmHint--empty"}`}
                aria-live="polite"
              >
                {confirmStatus || "Password confirmation status."}
              </p>

              <motion.button
                ref={createButton.ref}
                type="submit"
                className="CA-Btn"
                onMouseMove={createButton.handlePointerMove}
                onMouseLeave={createButton.handlePointerLeave}
                style={createButtonStyle}
                whileHover={isAuthBusy ? undefined : { scale: 1.02 }}
                disabled={isAuthBusy}
                aria-busy={isCreatingAccount}
              >
                {isCreatingAccount ? (
                  <>
                    <span className="auth-button-spinner" aria-hidden="true" />
                    Creating account...
                  </>
                ) : (
                  <>
                    Create Account
                    <FaArrowRight aria-hidden="true" />
                  </>
                )}
              </motion.button>

              {message && <div className="success-message">{message}</div>}
              {error && <div className="error-message">{error}</div>}
            </form>

            <div className="CA-Footer">
              Already have an account?{" "}
              <Link href="/sign-in" className="CA-Link">
                Sign In
              </Link>
            </div>
          </div>
        </section>
      </motion.main>
    </div>
  );
};

export default CreateAccount;
