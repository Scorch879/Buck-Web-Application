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

const SignIn = () => {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [message, setMsg] = useState("");
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/dashboard/home");
  const isDarkTheme = useAuthPageTheme();
  const signInButton = usePointerGradient<HTMLButtonElement>();

  useEffect(() => {
    setRedirectTo(
      getSafeRedirectPath(
        new URLSearchParams(window.location.search).get("redirectTo")
      )
    );
  }, []);

  useRedirectIfAuthenticated(redirectTo);

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };
  const handleSignIn = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
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
    const result = await signInUser(email, pass);
    if (result.success) {
      setMsg("Sign in successful!");
      router.push(redirectTo);
    } else {
      setError(result.message || "Sign in failed.");
    }
  };

  const handleGoogleSignIn = async () => {
    const result = await signInWithGoogle(redirectTo);
    if (result.success) {
      setMsg("Redirecting to Google...");

      if (!result.redirecting) {
        router.push(redirectTo);
      }
    } else if (result.cancelled) {
      // Do nothing, user cancelled
    } else {
      setError(result.message || "Google Sign-In failed.");
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
            >
              <Image
                src="/Google.png"
                alt=""
                width={20}
                height={20}
                className="SI-Google-Icon"
              />
              Continue with Google
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
                />
                <button
                  type="button"
                  className="SI-Eye-Btn"
                  tabIndex={-1}
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
                whileHover={{
                  scale: 1.02,
                }}
              >
                Sign In
                <FaArrowRight aria-hidden="true" />
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
