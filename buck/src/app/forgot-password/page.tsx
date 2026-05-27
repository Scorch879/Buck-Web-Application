"use client";
import { useState } from "react";
import Link from "next/link";
import { sendPasswordReset } from "@/component/authentication";
import { motion } from "framer-motion";
import "./style.css";
import Image from "next/image";
import { usePointerGradient } from "@/hooks/usePointerGradient";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const resetButton = usePointerGradient<HTMLButtonElement>();

  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    void audio.play();
  };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
      setError(result.message || "Failed to send password reset link. Please try again later.");
    }
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="forgot-password-page"
      >
        <div className="background">
          <div className="forgot-password-container">
            <div className="forgot-password-panel">
              <div className="SI-Mascot-Top">
                <div className="SI-Mascot-Circle">
                  <Image
                    src="/BuckMascot.png"
                    alt="Buck Mascot"
                    width={70}
                    height={100}
                    className="SI-Mascot-Img"
                    priority
                    onClick={playQuack} // <-- Add this line
                    style={{ cursor: "pointer" }}
                  />
                </div>
              </div>
              <h2>Forgot Password</h2>
              <p>Enter your email to receive a password reset link.</p>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="email-input"
                placeholder="Email Address"
              />
              <motion.button
                ref={resetButton.ref}
                type="submit"
                className="SI-Btn"
                onClick={handleResetPassword}
                onMouseMove={resetButton.handlePointerMove}
                onMouseLeave={resetButton.handlePointerLeave}
                style={{
                  background: resetButton.pointer
                    ? `radial-gradient(circle at ${resetButton.pointer.x}px ${resetButton.pointer.y}px, #fd523b 0%, #ef8a57 100%)`
                    : "linear-gradient(90deg, #ef8a57 60%, #fd523b 100%)",
                  transition: resetButton.pointer
                    ? "background 0.1s"
                    : "background 0.3s",
                }}
                whileHover={{
                  scale: 1.03,
                }}
              >
                Send Reset Link
              </motion.button>
              {message && <div className="forgot-message-card forgot-success">{message}</div>}
              {error && <div className="forgot-message-card forgot-error">{error}</div>}
              <Link href="/sign-in" className="FP-Link">
                Back to sign In
              </Link>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default ForgotPassword;
