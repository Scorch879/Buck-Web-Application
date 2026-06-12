"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaArrowRight, FaEnvelope, FaShieldAlt } from "react-icons/fa";
import { resendSignUpConfirmation } from "@/component/authentication";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import "./style.css";

export default function CheckEmailPage() {
  const [email, setEmail] = useState("");
  const [resendStatus, setResendStatus] = useState("");
  const [resendError, setResendError] = useState("");
  const [resending, setResending] = useState(false);
  const isDarkTheme = useAuthPageTheme();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") ?? "");
  }, []);

  const handleResendConfirmation = async () => {
    setResendStatus("");
    setResendError("");

    if (!email) {
      setResendError("Open this page from account creation so Buck knows where to resend.");
      return;
    }

    setResending(true);
    const result = await resendSignUpConfirmation(email);
    setResending(false);

    if (result.success) {
      setResendStatus(result.message || "Confirmation email sent again.");
      return;
    }

    setResendError(result.message || "Could not resend confirmation email.");
  };

  return (
    <div className={`CE-Background${isDarkTheme ? " CE-Dark" : ""}`}>
      <motion.main
        className="CE-Card"
        initial={{ opacity: 0, y: 14, scale: 0.985, filter: "blur(8px)" }}
        animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link href="/" className="CE-Brand" aria-label="Back to Buck home">
          <span className="CE-BrandMark">
            <Image
              src="/BuckMascot.png"
              alt=""
              width={58}
              height={74}
              className="CE-BrandMascot"
              priority
            />
          </span>
          <span>
            <strong>Buck</strong>
            <small>Budget Tracker</small>
          </span>
        </Link>

        <div className="CE-Icon" aria-hidden="true">
          <FaEnvelope />
        </div>

        <p className="CE-Kicker">Account created</p>
        <h1>Check your email to activate Buck.</h1>
        <p className="CE-Copy">
          We sent a confirmation link{email ? ` to ${email}` : ""}. Open it to
          verify your account, then you can sign in and start tracking your
          budget.
        </p>

        <div className="CE-Note">
          <FaShieldAlt aria-hidden="true" />
          <span>
            This keeps your wallet, goals, and spending history protected behind
            your verified account.
          </span>
        </div>

        <div className="CE-Actions">
          <Link href="/sign-in" className="CE-PrimaryAction">
            Back to Sign In
            <FaArrowRight aria-hidden="true" />
          </Link>
          <button
            className="CE-SecondaryAction"
            type="button"
            onClick={handleResendConfirmation}
            disabled={resending}
          >
            {resending ? "Sending..." : "Resend email"}
          </button>
          <Link href="/create-account" className="CE-SecondaryAction">
            Use another email
          </Link>
        </div>

        {resendStatus ? (
          <p className="CE-Message CE-Message--success" role="status">
            {resendStatus}
          </p>
        ) : null}
        {resendError ? (
          <p className="CE-Message CE-Message--error" role="alert">
            {resendError}
          </p>
        ) : null}
      </motion.main>
    </div>
  );
}
