"use client";
import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signInUser, signInWithGoogle } from "@/component/authentication";
import { useRedirectIfAuthenticated } from "@/utils/useAuthGuard";
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

function getSafeRedirectPath(redirectTo: string | null) {
  if (!redirectTo || !redirectTo.startsWith("/") || redirectTo.startsWith("//")) {
    return "/dashboard/home";
  }

  return redirectTo;
}

function getAuthNotice(reason: string | null) {
  switch (reason) {
    case "session-expired":
      return "You were signed out after a period of inactivity.";
    default:
      return "";
  }
}

function getAuthError(error: string | null) {
  switch (error) {
    case "supabase-not-configured":
      return "Supabase authentication is not configured yet.";
    case "session-security-not-configured":
      return "Session security is not configured. Add SESSION_COOKIE_SECRET before using protected pages in production.";
    case "auth-callback-missing-code":
      return "The sign-in link was missing an auth code. Please try signing in again.";
    case "auth-callback-failed":
      return "Buck could not finish Google sign in. Please try again.";
    default:
      return "";
  }
}

const SignIn = () => {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [message, setMsg] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/dashboard/home");
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const isDarkTheme = useAuthPageTheme();
  const signInButton = usePointerGradient<HTMLButtonElement>();
  const isAuthBusy = isSigningIn || isGoogleLoading;

  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);

    setRedirectTo(getSafeRedirectPath(searchParams.get("redirectTo")));

    setMsg(getAuthNotice(searchParams.get("reason")));
    setError(getAuthError(searchParams.get("error")));
  }, []);

  useRedirectIfAuthenticated(redirectTo);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    if (isAuthBusy) {
      return;
    }

    setError("");
    setMsg("");

    if (!email || !pass) {
      setError("Please enter both email and password.");
      return;
    }
    if (!validateEmail(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    if (pass.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    setIsSigningIn(true);
    setMsg("Checking your account...");

    const result = await signInUser(email, pass);

    if (result.success) {
      setMsg("Sign in successful. Opening your dashboard...");
      router.push(redirectTo);
      return;
    } else {
      setError(result.message || "Sign in failed.");
      setMsg("");
      setIsSigningIn(false);
    }
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
        router.push(redirectTo);
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
                autoComplete="email"
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

              {message && <div className="success-message">{message}</div>}
              {error && <div className="error-message">{error}</div>}
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
