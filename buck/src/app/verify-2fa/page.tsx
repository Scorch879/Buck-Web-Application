"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { FaCheck, FaEnvelope, FaKey, FaLock, FaShieldAlt, FaSignOutAlt } from "react-icons/fa";
import CustomSelect from "@/component/CustomSelect";
import TotpCodeInput from "@/component/mfa/TotpCodeInput";
import { signOutUser } from "@/component/authentication";
import { useToast } from "@/component/toast";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import {
  MfaRequestError,
  completeEmailRecovery,
  describeAuthError,
  fetchMfaStatus,
  getSafeMfaRedirect,
  isCompleteRecoveryCode,
  redeemRecoveryCode,
  requestEmailRecovery,
  type MfaStatus,
} from "@/utils/mfa/client";
import { supabase } from "@/utils/supabase";
import "@/component/skeletons/skeletons.css";
import "./style.css";

/**
 * /verify-2fa (ADR-048): the authenticator-code step after sign-in. Middleware
 * only lets a signed-in session that has NOT passed 2FA in here, and sends a
 * satisfied one back to `redirectTo`.
 */

type Mode = "code" | "backup" | "email";

const SECURITY_SETUP_PATH = "/dashboard/settings?tab=security&enroll=2fa";

const EMAIL_RECOVERY_NOTICES: Record<string, { tone: "info" | "error"; text: string }> = {
  scheduled: {
    tone: "info",
    text: "Recovery confirmed. For your safety, two-factor can be removed after a 24-hour wait.",
  },
  "invalid-link": { tone: "error", text: "That recovery link isn't valid. Ask for a new one below." },
  "link-expired": { tone: "error", text: "That recovery link has expired. Ask for a new one below." },
  failed: { tone: "error", text: "We couldn't confirm that recovery link. Please try again." },
  "not-configured": { tone: "error", text: "Email recovery isn't set up on the server yet." },
};

function formatLocalTime(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

/** Supabase's verify errors, in plain words. */
function describeVerifyError(error: { message?: string; status?: number; code?: string }) {
  if (error.status === 429 || error.code === "over_request_rate_limit") {
    return "Too many tries. Wait a minute, then enter the newest code.";
  }

  if (/invalid|expired|mfa_verification_failed/i.test(`${error.code ?? ""} ${error.message ?? ""}`)) {
    return "That code didn't work. Enter the newest code from your app, and check your phone's clock is right.";
  }

  return error.message || "We couldn't check that code. Please try again.";
}

function Shell({ dark, busy = false, children }: { dark: boolean; busy?: boolean; children: ReactNode }) {
  return (
    <div className={`V2-Background${dark ? " V2-Dark" : ""}`}>
      <motion.main
        className="V2-Card"
        aria-busy={busy}
        initial={{ opacity: 0, y: 14, scale: 0.985 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      >
        <Link href="/" className="V2-Brand" aria-label="Buck home">
          <span className="V2-BrandMark">
            <Image src="/BuckMascot.png" alt="" width={40} height={52} priority />
          </span>
          <span>
            <strong>Buck</strong>
            <small>Two-factor check</small>
          </span>
        </Link>
        {children}
      </motion.main>
    </div>
  );
}

/** 1:1 with the code step below (ADR-012). */
function VerifySkeleton({ dark }: { dark: boolean }) {
  return (
    <Shell dark={dark} busy>
      <span className="V2-SrOnly" role="status">
        Loading two-factor check
      </span>
      <div className="V2-Head" aria-hidden="true">
        <span className="V2-HeadIcon skeleton-text">
          <FaShieldAlt />
        </span>
        <div>
          <h1 className="skeleton-text">Enter your code</h1>
          <p className="skeleton-text">Open your authenticator app and type the 6-digit code for Buck.</p>
        </div>
      </div>
      <div className="V2-Form" aria-hidden="true">
        <span className="V2-Label skeleton-text">Authenticator code</span>
        <span className="V2-Input V2-Input--code skeleton-text">123456</span>
        <span className="V2-Button V2-Button--primary skeleton-text">Verify</span>
      </div>
      <div className="V2-Links" aria-hidden="true">
        <span className="V2-LinkButton skeleton-text">Use a backup code</span>
        <span className="V2-LinkButton skeleton-text">Email me a recovery link</span>
        <span className="V2-LinkButton skeleton-text">Sign out</span>
      </div>
    </Shell>
  );
}

export default function VerifyTwoFactorPage() {
  const isDarkTheme = useAuthPageTheme();
  const { toast } = useToast();
  const codeRef = useRef<HTMLInputElement | null>(null);
  const backupRef = useRef<HTMLInputElement | null>(null);
  const submittingRef = useRef(false);
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [redirectTo, setRedirectTo] = useState("/dashboard/home");
  const [emailNotice, setEmailNotice] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("code");
  const [factorId, setFactorId] = useState("");
  const [code, setCode] = useState("");
  const [backupCode, setBackupCode] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [removed, setRemoved] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const loadStatus = useCallback(async () => {
    setLoadError("");

    try {
      const next = await fetchMfaStatus();
      setStatus(next);
      setFactorId((current) => current || next.factors[0]?.id || "");

      // Passed already (another tab) or 2FA is off: nothing to do here.
      if (next.satisfied) {
        setLeaving(true);
        window.location.replace(getSafeMfaRedirect(new URLSearchParams(window.location.search).get("redirectTo")));
      }
    } catch (loadFailure) {
      if (loadFailure instanceof MfaRequestError && loadFailure.status === 401) {
        setLeaving(true);
        window.location.replace("/sign-in");
        return;
      }

      setLoadError(describeAuthError(loadFailure, "Could not load your two-factor settings."));
    }
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setRedirectTo(getSafeMfaRedirect(params.get("redirectTo")));
    setEmailNotice(params.get("emailRecovery"));
    void loadStatus();
  }, [loadStatus]);

  const scheduledAt =
    status?.emailRecovery?.state === "scheduled" ? Date.parse(status.emailRecovery.availableAt) : null;
  const recoveryUnlocked = scheduledAt !== null && now >= scheduledAt;

  // Tick so "Finish recovery" enables itself when the wait is over.
  useEffect(() => {
    if (scheduledAt === null || recoveryUnlocked) {
      return;
    }

    const timer = window.setInterval(() => setNow(Date.now()), 15_000);
    return () => window.clearInterval(timer);
  }, [scheduledAt, recoveryUnlocked]);

  useEffect(() => {
    if (!status || removed) {
      return;
    }

    (mode === "backup" ? backupRef : codeRef).current?.focus();
  }, [mode, status, removed]);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError("");
    setInfo("");
  };

  /** 2FA was removed server-side: pick up the new session, then offer setup. */
  const finishRemoval = async (message: string) => {
    try {
      await supabase?.auth.refreshSession();
    } catch {
      // The next page load refreshes it anyway.
    }

    toast.success(message);
    setRemoved(true);
  };

  const verifyCode = async (value: string) => {
    if (submittingRef.current || !supabase) {
      return;
    }

    if (value.length !== 6) {
      setError("Enter the 6-digit code from your authenticator app.");
      return;
    }

    if (!factorId) {
      setError("No authenticator app is set up for this account.");
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setError("");

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({ factorId, code: value });

    if (verifyError) {
      setError(describeVerifyError(verifyError));
      setCode("");
      setBusy(false);
      submittingRef.current = false;
      codeRef.current?.focus();
      return;
    }

    setLeaving(true);
    window.location.replace(redirectTo);
  };

  const handleCodeSubmit = (event: FormEvent) => {
    event.preventDefault();
    void verifyCode(code);
  };

  const handleBackupSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (submittingRef.current) {
      return;
    }

    if (!isCompleteRecoveryCode(backupCode)) {
      setError("Backup codes look like ABCDE-12345.");
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setError("");

    try {
      const message = await redeemRecoveryCode(backupCode);
      setBackupCode("");
      await finishRemoval(message);
    } catch (redeemError) {
      setError(describeAuthError(redeemError, "That backup code didn't work."));
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };

  const handleEmailRecovery = async () => {
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setError("");
    setInfo("");

    try {
      const result = await requestEmailRecovery();
      setInfo(
        result.state === "scheduled" && result.availableAt
          ? `${result.message} You can finish at ${formatLocalTime(result.availableAt)}.`
          : result.message
      );
      await loadStatus();
    } catch (requestError) {
      setError(describeAuthError(requestError, "Could not send a recovery email."));
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };

  const handleFinishRecovery = async () => {
    if (submittingRef.current) {
      return;
    }

    submittingRef.current = true;
    setBusy(true);
    setError("");

    try {
      await finishRemoval(await completeEmailRecovery());
    } catch (completeError) {
      if (completeError instanceof MfaRequestError && completeError.availableAt) {
        setError(`Not yet. You can finish at ${formatLocalTime(completeError.availableAt)}.`);
      } else {
        setError(describeAuthError(completeError, "Could not finish the recovery."));
      }
    } finally {
      setBusy(false);
      submittingRef.current = false;
    }
  };

  const handleSignOut = async () => {
    setLeaving(true);
    await signOutUser();
    window.location.assign("/sign-in");
  };

  if (leaving) {
    return (
      <Shell dark={isDarkTheme} busy>
        <div className="V2-Status">
          <span className="auth-button-spinner V2-Spinner" aria-hidden="true" />
          <h1>One moment</h1>
          <p role="status">Taking you to your dashboard.</p>
        </div>
      </Shell>
    );
  }

  if (removed) {
    return (
      <Shell dark={isDarkTheme}>
        <div className="V2-Status">
          <span className="V2-StatusIcon V2-StatusIcon--ok" aria-hidden="true">
            <FaCheck />
          </span>
          <h1>Two-factor is off</h1>
          <p role="status">
            You&apos;re back in. Your old authenticator apps and backup codes no longer work, so set up two-factor
            again to keep your account protected.
          </p>
          <div className="V2-StatusActions">
            <button
              type="button"
              className="V2-Button V2-Button--primary"
              onClick={() => window.location.assign(SECURITY_SETUP_PATH)}
            >
              Set up two-factor again
            </button>
            <button
              type="button"
              className="V2-Button V2-Button--secondary"
              onClick={() => window.location.assign("/dashboard/home")}
            >
              Go to dashboard
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (loadError) {
    return (
      <Shell dark={isDarkTheme}>
        <div className="V2-Status">
          <span className="V2-StatusIcon" aria-hidden="true">
            <FaLock />
          </span>
          <h1>Something went wrong</h1>
          <p role="alert">{loadError}</p>
          <div className="V2-StatusActions">
            <button type="button" className="V2-Button V2-Button--primary" onClick={() => void loadStatus()}>
              Try again
            </button>
            <button type="button" className="V2-Button V2-Button--secondary" onClick={() => void handleSignOut()}>
              Sign out
            </button>
          </div>
        </div>
      </Shell>
    );
  }

  if (!status) {
    return <VerifySkeleton dark={isDarkTheme} />;
  }

  const notice = emailNotice ? EMAIL_RECOVERY_NOTICES[emailNotice] : undefined;
  const factorOptions = status.factors.map((factor, index) => ({
    value: factor.id,
    label: factor.friendlyName || `Authenticator app ${index + 1}`,
  }));

  return (
    <Shell dark={isDarkTheme} busy={busy}>
      <div className="V2-Head">
        <span className="V2-HeadIcon" aria-hidden="true">
          {mode === "code" ? <FaShieldAlt /> : mode === "backup" ? <FaKey /> : <FaEnvelope />}
        </span>
        <div>
          <h1>
            {mode === "code" ? "Enter your code" : mode === "backup" ? "Use a backup code" : "Recover by email"}
          </h1>
          <p>
            {mode === "code"
              ? "Open your authenticator app and type the 6-digit code for Buck."
              : mode === "backup"
                ? "Enter one of the 10 backup codes you saved. This turns two-factor off so you can set it up again."
                : "We'll email you a link. After you open it, two-factor can be removed after a 24-hour safety wait."}
          </p>
        </div>
      </div>

      {notice ? (
        <p className={`V2-Notice V2-Notice--${notice.tone}`} role={notice.tone === "error" ? "alert" : "status"}>
          {notice.text}
        </p>
      ) : null}

      {status.emailRecovery?.state === "scheduled" ? (
        <div className="V2-Recovery">
          <p>
            {recoveryUnlocked
              ? "Your recovery wait is over. You can remove two-factor now."
              : `Two-factor can be removed at ${formatLocalTime(status.emailRecovery.availableAt)}.`}
          </p>
          <button
            type="button"
            className="V2-Button V2-Button--secondary"
            onClick={() => void handleFinishRecovery()}
            disabled={!recoveryUnlocked || busy}
          >
            Finish recovery
          </button>
        </div>
      ) : null}

      {mode === "code" ? (
        <form className="V2-Form" onSubmit={handleCodeSubmit} noValidate>
          {factorOptions.length > 1 ? (
            <>
              <label className="V2-Label" htmlFor="verify-2fa-factor">
                Authenticator app
              </label>
              <CustomSelect
                id="verify-2fa-factor"
                value={factorId}
                onChange={setFactorId}
                options={factorOptions}
                disabled={busy}
              />
            </>
          ) : null}
          <label className="V2-Label" htmlFor="verify-2fa-code">
            Authenticator code
          </label>
          <TotpCodeInput
            ref={codeRef}
            id="verify-2fa-code"
            className="V2-Input V2-Input--code"
            value={code}
            onChange={(next) => {
              setCode(next);
              setError("");
            }}
            onComplete={(next) => void verifyCode(next)}
            disabled={busy}
            invalid={Boolean(error)}
            describedBy={error ? "verify-2fa-error" : undefined}
          />
          {error ? (
            <p id="verify-2fa-error" className="V2-Error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="V2-Button V2-Button--primary" disabled={busy} aria-busy={busy}>
            {busy ? "Checking..." : "Verify"}
          </button>
        </form>
      ) : null}

      {mode === "backup" ? (
        <form className="V2-Form" onSubmit={(event) => void handleBackupSubmit(event)} noValidate>
          <label className="V2-Label" htmlFor="verify-2fa-backup">
            Backup code
          </label>
          <input
            ref={backupRef}
            id="verify-2fa-backup"
            className="V2-Input V2-Input--backup"
            type="text"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="ABCDE-12345"
            value={backupCode}
            onChange={(event) => {
              setBackupCode(event.target.value.toUpperCase().slice(0, 13));
              setError("");
            }}
            disabled={busy}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={error ? "verify-2fa-error" : undefined}
          />
          {error ? (
            <p id="verify-2fa-error" className="V2-Error" role="alert">
              {error}
            </p>
          ) : null}
          <button type="submit" className="V2-Button V2-Button--primary" disabled={busy} aria-busy={busy}>
            {busy ? "Checking..." : "Use backup code"}
          </button>
        </form>
      ) : null}

      {mode === "email" ? (
        <div className="V2-Form">
          {info ? (
            <p className="V2-Notice V2-Notice--info" role="status">
              {info}
            </p>
          ) : null}
          {error ? (
            <p className="V2-Error" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="button"
            className="V2-Button V2-Button--primary"
            onClick={() => void handleEmailRecovery()}
            disabled={busy}
            aria-busy={busy}
          >
            {busy ? "Sending..." : "Email me a recovery link"}
          </button>
        </div>
      ) : null}

      <div className="V2-Links">
        {mode !== "code" ? (
          <button type="button" className="V2-LinkButton" onClick={() => switchMode("code")} disabled={busy}>
            Use my authenticator app
          </button>
        ) : null}
        {mode !== "backup" ? (
          <button type="button" className="V2-LinkButton" onClick={() => switchMode("backup")} disabled={busy}>
            Use a backup code
          </button>
        ) : null}
        {mode !== "email" ? (
          <button type="button" className="V2-LinkButton" onClick={() => switchMode("email")} disabled={busy}>
            Email me a recovery link
          </button>
        ) : null}
        <button type="button" className="V2-LinkButton" onClick={() => void handleSignOut()} disabled={busy}>
          <FaSignOutAlt aria-hidden="true" />
          Sign out
        </button>
      </div>
    </Shell>
  );
}
