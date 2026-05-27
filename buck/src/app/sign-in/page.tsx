"use client";
import { useEffect, useState } from "react";
import type { CSSProperties, FormEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { auth, isFirebaseConfigured } from "@/utils/firebase";
import { signInUser, signInWithGoogle } from "@/component/authentication";
import { motion } from "framer-motion";
import { usePointerGradient } from "@/hooks/usePointerGradient";
import {
  FaArrowRight,
  FaChartLine,
  FaPiggyBank,
  FaShieldAlt,
  FaWallet,
} from "react-icons/fa";
import type { IconType } from "react-icons";
import "./style.css";

type LandingTheme = "dark" | "light";

type PointerPosition = {
  x: number;
  y: number;
} | null;

type SignInHighlight = {
  icon: IconType;
  title: string;
  description: string;
};

const LANDING_THEME_STORAGE_KEY = "buck-landing-theme";
const DARK_SIGN_IN_BUTTON = "linear-gradient(135deg, #f47536 0%, #ff8d3d 100%)";
const LIGHT_SIGN_IN_BUTTON =
  "linear-gradient(135deg, #f47536 0%, #ff3838 100%)";

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

const getStoredLandingTheme = (): LandingTheme | null => {
  try {
    const savedTheme = window.localStorage.getItem(LANDING_THEME_STORAGE_KEY);

    return savedTheme === "dark" || savedTheme === "light"
      ? savedTheme
      : null;
  } catch {
    return null;
  }
};

const resolveLandingTheme = (
  mediaQuery: MediaQueryList | undefined
): LandingTheme =>
  getStoredLandingTheme() ?? (mediaQuery?.matches ? "dark" : "light");

const getSignInButtonBackground = (
  isDarkTheme: boolean,
  pointer: PointerPosition
) => {
  const baseGradient = isDarkTheme ? DARK_SIGN_IN_BUTTON : LIGHT_SIGN_IN_BUTTON;

  if (!pointer) {
    return baseGradient;
  }

  const glow = isDarkTheme
    ? "rgba(255, 232, 163, 0.58) 0%, rgba(255, 197, 71, 0.52) 22%, rgba(255, 197, 71, 0) 50%"
    : "rgba(255, 240, 200, 0.88) 0%, rgba(255, 197, 71, 0.68) 22%, rgba(255, 197, 71, 0) 48%";

  return `radial-gradient(circle at ${pointer.x}px ${pointer.y}px, ${glow}), ${baseGradient}`;
};

const SignIn = () => {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [message, setMsg] = useState("");
  const [error, setError] = useState("");
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const signInButton = usePointerGradient<HTMLButtonElement>();

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

    const updateThemeFromPreference = () => {
      setIsDarkTheme(resolveLandingTheme(mediaQuery) === "dark");
    };

    updateThemeFromPreference();
    window.addEventListener("storage", updateThemeFromPreference);
    mediaQuery?.addEventListener("change", updateThemeFromPreference);

    return () => {
      window.removeEventListener("storage", updateThemeFromPreference);
      mediaQuery?.removeEventListener("change", updateThemeFromPreference);
    };
  }, []);

  useEffect(() => {
    if (!isFirebaseConfigured) return;

    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        router.replace("/dashboard/home");
      }
    });
    return () => unsubscribe();
  }, [router]);

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
      router.push("/dashboard/home"); // Redirect to dashboard or home page
    } else {
      setError(result.message || "Sign in failed.");
    }
  };

  const handleGoogleSignIn = async () => {
    const result = await signInWithGoogle();
    if (result.success) {
      setMsg("Google Sign-In successful!");
      router.push("/dashboard/home"); // Redirect to dashboard or home page
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
    background: getSignInButtonBackground(isDarkTheme, signInButton.pointer),
    transition: signInButton.pointer ? "background 0.1s" : "background 0.3s",
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className={`SI-Background${
        isDarkTheme ? " SI-Background--dark" : " SI-Background--light"
      }`}
    >
      <main className="SI-Page">
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
            <p>
              Sign back in to review your weekly spending, protect your goals,
              and get clear AI guidance before the week gets noisy.
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

          <div className="SI-TrustCard">
            <div>
              <strong>PHP 4,280</strong>
              <span>tracked this week</span>
            </div>
            <div>
              <FaShieldAlt aria-hidden="true" />
              <span>Protected budget session</span>
            </div>
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
      </main>
    </motion.div>
  );
};

export default SignIn;
