"use client";
import React, { useState } from "react";
import Link from "next/link";
import { sendPasswordResetEmail } from "firebase/auth";
import { auth } from "@/utils/firebase";
import { motion } from "framer-motion";
import { Header, Footer } from "@/component/HeaderFooter";
import "./style.css";

const ForgotPassword = (): React.JSX.Element => {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

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

    try 
    {
      await sendPasswordResetEmail(auth, email);
      setMessage("Password reset email sent! Check your inbox.");
    } catch (err: any) 
    {
      setError("Failed to send password reset link. Please try again later.");
    }
  };

  return (
    <>
      <Header />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.5 }}
        className="forgot-password-page"
      >
        <div className="forgot-password-container">
          <div className="BG-inner-rect" />
          <div className="BG-outer-rect" />
          <div className="forgot-password-panel">
            <h2>Forgot Password</h2>
            <p>Enter your email to receive a password reset link.</p>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="email-input"
              placeholder="Email Address"
            />
            <button onClick={handleResetPassword} className="reset-button">
              Send Reset Link
            </button>
            {message && <p className="success-message">{message}</p>}
            {error && <p className="error-message">{error}</p>}
            <Link href="/sign-in" className="back-to-signin">
              Back to Sign In
            </Link>
          </div>
        </div>
      </motion.div>
      <Footer />
    </>
  );
};

export default ForgotPassword; 