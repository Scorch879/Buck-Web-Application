"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaArrowRight, FaEnvelope, FaExclamationTriangle, FaShieldAlt } from "react-icons/fa";
import { resendSignUpConfirmation, type AuthResult } from "@/component/authentication";
import {
  getEmailValidationMessage,
  normalizeEmailAddress,
} from "@/utils/emailValidation";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import "./style.css";

const PENDING_CONFIRMATION_EMAIL_KEY = "buck-pending-confirmation-email";

function getLinkErrorBanner(
  errorParam: string | null,
  errorCodeParam: string | null,
  errorDescriptionParam: string | null
) {
  if (
    errorParam === "email-verification-expired" ||
    errorCodeParam === "otp_expired"
  ) {
    return {
      isExpired: true,
      message:
        "Your verification link has expired. Enter your email below and request a fresh confirmation link.",
    };
  }

  if (
    errorParam === "email-verification-failed" ||
    errorParam === "access_denied" ||
    errorCodeParam
  ) {
    return {
      isExpired: false,
      message:
        errorDescriptionParam ||
        "We could not verify that confirmation link. Request a fresh confirmation email below.",
    };
  }

  return null;
}

export default function CheckEmailPage() {
  const [email, setEmail] = useState("");
  const [hasUrlEmail, setHasUrlEmail] = useState(false);
  const [linkError, setLinkError] = useState<{
    isExpired: boolean;
    message: string;
  } | null>(null);
  const [resendStatus, setResendStatus] = useState("");
  const [resendError, setResendError] = useState("");
  const [resending, setResending] = useState(false);
  const isDarkTheme = useAuthPageTheme();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hashParams = new URLSearchParams(
      window.location.hash.startsWith("#")
        ? window.location.hash.slice(1)
        : window.location.hash
    );

    const queryEmail = params.get("email")?.trim() ?? "";
    let resolvedEmail = queryEmail;
    if (!resolvedEmail) {
      try {
        resolvedEmail =
          window.sessionStorage.getItem(PENDING_CONFIRMATION_EMAIL_KEY)?.trim() ??
          "";
      } catch {
        resolvedEmail = "";
      }
    }

    setEmail(resolvedEmail);
    setHasUrlEmail(Boolean(queryEmail));

    const banner = getLinkErrorBanner(
      params.get("error") ?? hashParams.get("error"),
      params.get("error_code") ?? hashParams.get("error_code"),
      params.get("error_description") ?? hashParams.get("error_description")
    );
    setLinkError(banner);
  }, []);

  const handleResendConfirmation = async () => {
    if (resending) {
      return;
    }

    setResendStatus("");
    setResendError("");

    const normalizedEmail = normalizeEmailAddress(email);
    if (!normalizedEmail) {
      setResendError("Enter your email address so Buck knows where to resend.");
      return;
    }

    const emailValidationMessage = getEmailValidationMessage(normalizedEmail);
    if (emailValidationMessage) {
      setResendError(emailValidationMessage);
      return;
    }

    setResending(true);
    const result: AuthResult = await resendSignUpConfirmation(normalizedEmail);
    setResending(false);

    if (result.success) {
      try {
        window.sessionStorage.setItem(
          PENDING_CONFIRMATION_EMAIL_KEY,
          normalizedEmail
        );
      } catch {
        // Session storage fallback is optional.
      }
      setLinkError(null);
      setResendStatus(
        result.message || "If that email needs confirming, a new link is on its way."
      );
      return;
    }

    setResendError(result.message || "Could not resend confirmation email.");
  };

  const showEmailInput = !hasUrlEmail || Boolean(linkError);

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

        <div className={`CE-Icon${linkError ? " CE-Icon--warning" : ""}`} aria-hidden="true">
          {linkError ? <FaExclamationTriangle /> : <FaEnvelope />}
        </div>

        <p className="CE-Kicker">
          {linkError?.isExpired
            ? "Verification link expired"
            : linkError
              ? "Verification issue"
              : "Almost there"}
        </p>
        <h1>
          {linkError?.isExpired
            ? "Request a fresh confirmation link."
            : linkError
              ? "Verify your email to activate Buck."
              : "Check your email to activate Buck."}
        </h1>
        <p className="CE-Copy">
          {linkError
            ? linkError.message
            : `We sent an email${email ? ` to ${email}` : ""}. Open the link inside to finish setting up, then sign in and start tracking your budget.`}
        </p>

        {showEmailInput ? (
          <div className="CE-EmailField">
            <label htmlFor="check-email-input" className="CE-EmailLabel">
              Email address
            </label>
            <input
              id="check-email-input"
              type="email"
              className="CE-EmailInput"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              disabled={resending}
            />
          </div>
        ) : null}

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
          <div className="CE-Message CE-Message--error" role="alert">
            <p>{resendError}</p>
          </div>
        ) : null}
      </motion.main>
    </div>
  );
}
