"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { sendPasswordReset } from "@/component/authentication";
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

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const isDarkTheme = useAuthPageTheme();
  const resetButton = usePointerGradient<HTMLButtonElement>();

  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    void audio.play();
  };

  const handleResetPassword = async () => {
    setMessage("");
    setError("");
    if (!email) {
      setError("Please enter your email address.");
      return;
    }
    if (!emailRegex.test(email)) {
      setError("Please enter a valid email address.");
      return;
    }
    const result = await sendPasswordReset(email);

    if (result.success) {
      setMessage("Password reset email sent! Check your inbox.");
    } else {
      setError(
        result.message || "Failed to send password reset link. Please try again later."
      );
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
                Reset password
              </h2>
              <p>Enter the email connected to your Buck account.</p>
            </div>

            <form
              className="FP-Form"
              onSubmit={(event) => {
                event.preventDefault();
                handleResetPassword();
              }}
            >
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
              />

              <motion.button
                ref={resetButton.ref}
                type="submit"
                className="FP-Btn"
                onMouseMove={resetButton.handlePointerMove}
                onMouseLeave={resetButton.handlePointerLeave}
                style={resetButtonStyle}
                whileHover={{
                  scale: 1.02,
                }}
              >
                Send Reset Link
                <FaArrowRight aria-hidden="true" />
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
