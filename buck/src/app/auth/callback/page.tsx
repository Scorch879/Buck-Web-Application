"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FaArrowRight, FaShieldAlt } from "react-icons/fa";
import { isSupabaseConfigured, supabase } from "@/utils/supabase";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import "./style.css";

function getSafeNextPath(value: string | null) {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/dashboard/home";
  }

  return value;
}

export default function AuthCallbackPage() {
  const router = useRouter();
  const isDarkTheme = useAuthPageTheme();
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    const finishAuth = async () => {
      if (!isSupabaseConfigured || !supabase) {
        setError("Supabase authentication is not configured.");
        return;
      }

      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const nextPath = getSafeNextPath(params.get("next"));

      try {
        if (code) {
          const { error: exchangeError } =
            await supabase.auth.exchangeCodeForSession(code);

          if (exchangeError) {
            throw exchangeError;
          }
        } else {
          const { data, error: sessionError } = await supabase.auth.getSession();

          if (sessionError) {
            throw sessionError;
          }

          if (!data.session) {
            throw new Error("No authentication code was found in this link.");
          }
        }

        if (mounted) {
          router.replace(nextPath);
        }
      } catch (callbackError) {
        if (!mounted) {
          return;
        }

        setError(
          callbackError instanceof Error
            ? callbackError.message
            : "Could not complete authentication."
        );
      }
    };

    void finishAuth();

    return () => {
      mounted = false;
    };
  }, [router]);

  return (
    <main className={`AC-Background${isDarkTheme ? " AC-Dark" : ""}`}>
      <section className="AC-Card" aria-labelledby="auth-callback-title">
        <Link href="/" className="AC-Brand" aria-label="Back to Buck home">
          <span className="AC-BrandMark">
            <Image
              src="/BuckMascot.png"
              alt=""
              width={58}
              height={74}
              className="AC-BrandMascot"
              priority
            />
          </span>
          <span>
            <strong>Buck</strong>
            <small>Budget Tracker</small>
          </span>
        </Link>

        <div className="AC-Icon" aria-hidden="true">
          <FaShieldAlt />
        </div>

        <p className="AC-Kicker">Secure sign in</p>
        <h1 id="auth-callback-title">
          {error ? "Buck could not finish sign in." : "Buck is verifying your account."}
        </h1>
        <p className="AC-Copy">
          {error
            ? "The link may be expired or already used. You can return to sign in and request a fresh email."
            : "Please wait while we securely finish your Buck session."}
        </p>

        {error ? (
          <>
            <p className="AC-Message" role="alert">
              {error}
            </p>
            <Link href="/sign-in" className="AC-PrimaryAction">
              Back to Sign In
              <FaArrowRight aria-hidden="true" />
            </Link>
          </>
        ) : (
          <div className="AC-Loading" aria-label="Authenticating">
            <span />
            <span />
            <span />
          </div>
        )}
      </section>
    </main>
  );
}
