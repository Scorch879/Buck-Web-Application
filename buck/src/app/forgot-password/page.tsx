"use client";
import React, { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/utils/firebase";
import { motion } from "framer-motion";
import "./style.css";
import Image from "next/image";

const ForgotPassword = (): React.JSX.Element => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [btnMouse, setBtnMouse] = useState<{ x: number; y: number } | null>(
    null
  );

  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    audio.play();
  };

  const btnRef = React.useRef<HTMLButtonElement>(null);

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
    try {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! Check your inbox.");
    } catch (err: any) {
      setError("Failed to send password reset link. Please try again later.");
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
                ref={btnRef}
                type="submit"
                className="SI-Btn"
                onClick={handleResetPassword}
                onMouseMove={(e) => {
                  const rect = btnRef.current?.getBoundingClientRect();
                  if (rect) {
                    const x = e.clientX - rect.left;
                    const y = e.clientY - rect.top;
                    setBtnMouse({ x, y });
                  }
                }}
                onMouseLeave={() => setBtnMouse(null)}
                style={{
                  background: btnMouse
                    ? `radial-gradient(circle at ${btnMouse.x}px ${btnMouse.y}px, #fd523b 0%, #ef8a57 100%)`
                    : "linear-gradient(90deg, #ef8a57 60%, #fd523b 100%)",
                  transition: btnMouse ? "background 0.1s" : "background 0.3s",
                }}
                whileHover={{
                  scale: 1.03,
                }}
              >
                Send Reset Link
              </motion.button>
              {message && <div className="forgot-message-card forgot-success">{message}</div>}
              {error && <div className="forgot-message-card forgot-error">{error}</div>}
              <a href="/sign-in" className="FP-Link">
                Back to sign In
              </a>
            </div>
          </div>
        </div>
      </motion.div>
    </>
  );
};

export default ForgotPassword;
