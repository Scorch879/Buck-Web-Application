"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaArrowRight, FaEnvelope, FaShieldAlt } from "react-icons/fa";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import "./style.css";

export default function CheckEmailPage() {
  const [email, setEmail] = useState("");
  const isDarkTheme = useAuthPageTheme();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setEmail(params.get("email") ?? "");
  }, []);

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
          <Link href="/create-account" className="CE-SecondaryAction">
            Use another email
          </Link>
        </div>
      </motion.main>
    </div>
  );
}
