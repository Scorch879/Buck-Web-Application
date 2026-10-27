"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { FaCopy, FaTimes } from "react-icons/fa";
import TotpCodeInput from "@/component/mfa/TotpCodeInput";
import RecoveryCodesPanel from "@/component/mfa/RecoveryCodesPanel";
import { useToast } from "@/component/toast";
import { describeAuthError, generateRecoveryCodes } from "@/utils/mfa/client";
import { supabase } from "@/utils/supabase";

/**
 * Settings › Security › Turn on / Add a second app (ADR-048):
 * name the app → scan the QR (or type the secret) → enter a code → for the
 * first app, save the 10 backup codes once.
 */

type Step = "name" | "scan" | "codes";

interface EnrollData {
  factorId: string;
  qrCode: string;
  secret: string;
}

interface TwoFactorEnrollModalProps {
  /** True when this is the account's first authenticator app. */
  isFirstFactor: boolean;
  onClose: () => void;
  /** Called once the app is verified (before the backup-code step). */
  onEnrolled: () => void;
}

function describeVerifyError(error: { message?: string; status?: number }) {
  if (error.status === 429) {
    return "Too many tries. Wait a minute, then enter the newest code.";
  }

  return /invalid|expired/i.test(error.message ?? "")
    ? "That code didn't work. Enter the newest code from your app, and check your phone's clock is right."
    : error.message || "We couldn't check that code. Please try again.";
}

/** Drops half-finished enrolments so a retry can reuse the name. */
async function removeUnverifiedFactors() {
  if (!supabase) {
    return;
  }

  const { data } = await supabase.auth.mfa.listFactors();
  const stale = (data?.all ?? []).filter((factor) => factor.status === "unverified");
  await Promise.all(stale.map((factor) => supabase!.auth.mfa.unenroll({ factorId: factor.id })));
}

export default function TwoFactorEnrollModal({ isFirstFactor: isFirstFactorProp, onClose, onEnrolled }: TwoFactorEnrollModalProps) {
  // Fixed for the whole flow: the parent's status flips to "on" mid-way.
  const [isFirstFactor] = useState(isFirstFactorProp);
  const { toast } = useToast();
  const nameRef = useRef<HTMLInputElement | null>(null);
  const codeRef = useRef<HTMLInputElement | null>(null);
  const verifyingRef = useRef(false);
  const [step, setStep] = useState<Step>("name");
  const [friendlyName, setFriendlyName] = useState(isFirstFactor ? "Authenticator app" : "Second authenticator app");
  const [enroll, setEnroll] = useState<EnrollData | null>(null);
  const [code, setCode] = useState("");
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [codesError, setCodesError] = useState("");
  const enrollRef = useRef<EnrollData | null>(null);
  const verifiedRef = useRef(false);

  useEffect(() => {
    enrollRef.current = enroll;
  }, [enroll]);

  const canClose = step !== "codes" && !busy;

  useEffect(() => {
    (step === "name" ? nameRef : codeRef).current?.focus();
  }, [step]);

  // Leaving before the code step finishes: remove the unverified factor.
  useEffect(
    () => () => {
      const pending = enrollRef.current;

      if (pending && !verifiedRef.current && supabase) {
        void supabase.auth.mfa.unenroll({ factorId: pending.factorId });
      }
    },
    []
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && canClose) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [canClose, onClose]);

  const startEnroll = async (event: FormEvent) => {
    event.preventDefault();

    if (busy || !supabase) {
      return;
    }

    const name = friendlyName.trim();

    if (!name) {
      setError("Give this app a name, like Aegis or Google Authenticator.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      await removeUnverifiedFactors();
      const { data, error: enrollError } = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: name });

      if (enrollError || !data) {
        setError(
          /already exists/i.test(enrollError?.message ?? "")
            ? "You already have an app with that name. Pick another name."
            : enrollError?.message || "Could not start the setup. Please try again."
        );
        return;
      }

      setEnroll({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
      setStep("scan");
    } catch (startError) {
      setError(describeAuthError(startError, "Could not start the setup. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const createCodes = async () => {
    setBusy(true);
    setCodesError("");

    try {
      setCodes((await generateRecoveryCodes()).codes);
    } catch (codesFailure) {
      setCodesError(describeAuthError(codesFailure, "Could not create backup codes."));
    } finally {
      setBusy(false);
    }
  };

  const verify = async (value: string) => {
    if (verifyingRef.current || !enroll || !supabase) {
      return;
    }

    if (value.length !== 6) {
      setError("Enter the 6-digit code from your app.");
      return;
    }

    verifyingRef.current = true;
    setBusy(true);
    setError("");

    const { error: verifyError } = await supabase.auth.mfa.challengeAndVerify({
      factorId: enroll.factorId,
      code: value,
    });

    if (verifyError) {
      setError(describeVerifyError(verifyError));
      setCode("");
      setBusy(false);
      verifyingRef.current = false;
      codeRef.current?.focus();
      return;
    }

    verifiedRef.current = true;
    verifyingRef.current = false;
    onEnrolled();

    if (!isFirstFactor) {
      toast.success(`${friendlyName.trim()} was added.`);
      setBusy(false);
      onClose();
      return;
    }

    toast.success("Two-factor authentication is on.");
    setStep("codes");
    await createCodes();
  };

  const copySecret = async () => {
    if (!enroll) {
      return;
    }

    try {
      await navigator.clipboard.writeText(enroll.secret);
      toast.success("Setup key copied.");
    } catch {
      toast("Couldn't copy. Select the key and copy it by hand.", "warning");
    }
  };

  return (
    <div
      className="settings-modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && canClose) {
          onClose();
        }
      }}
    >
      <section
        className="settings-modal settings-modal--wide"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-2fa-modal-title"
      >
        <div className="settings-modal-heading">
          <div>
            <p className="settings-eyebrow">
              Two-factor authentication · Step {step === "name" ? 1 : step === "scan" ? 2 : 3} of{" "}
              {isFirstFactor ? 3 : 2}
            </p>
            <h2 id="settings-2fa-modal-title">
              {step === "name"
                ? isFirstFactor
                  ? "Turn on two-factor"
                  : "Add a second app"
                : step === "scan"
                  ? "Scan and confirm"
                  : "Save your backup codes"}
            </h2>
            <p>
              {step === "name"
                ? "You'll need an authenticator app such as Aegis, Google Authenticator or 1Password."
                : step === "scan"
                  ? "Scan the QR code with your app, then type the 6-digit code it shows."
                  : "If you lose your phone, each code lets you in once. We only show them now."}
            </p>
          </div>
          {step !== "codes" ? (
            <button
              className="settings-modal-close"
              type="button"
              onClick={onClose}
              disabled={!canClose}
              aria-label="Close two-factor setup"
            >
              <FaTimes aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {step === "name" ? (
          <form className="settings-form settings-modal-form" onSubmit={(event) => void startEnroll(event)} noValidate>
            <div className="settings-field">
              <label htmlFor="settings-2fa-name">App name</label>
              <input
                ref={nameRef}
                id="settings-2fa-name"
                type="text"
                maxLength={60}
                value={friendlyName}
                onChange={(event) => {
                  setFriendlyName(event.target.value);
                  setError("");
                }}
                disabled={busy}
                aria-invalid={Boolean(error) || undefined}
                aria-describedby={error ? "settings-2fa-name-error" : "settings-2fa-name-help"}
              />
              <small id="settings-2fa-name-help" className="settings-mfa-help">
                Helps you tell your apps apart later.
              </small>
              {error ? (
                <p id="settings-2fa-name-error" className="settings-mfa-error" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <button className="settings-button settings-button--primary" type="submit" disabled={busy}>
              {busy ? "Starting..." : "Continue"}
            </button>
          </form>
        ) : null}

        {step === "scan" && enroll ? (
          <div className="settings-mfa-scan">
            <div className="settings-mfa-qr">
              {/* SVG data URL from Supabase; next/image can't optimise it. */}
              <img src={enroll.qrCode} alt="QR code to add Buck to your authenticator app" width={184} height={184} />
            </div>
            <form
              className="settings-form settings-mfa-scan-form"
              onSubmit={(event) => {
                event.preventDefault();
                void verify(code);
              }}
              noValidate
            >
              <div className="settings-field">
                <span className="settings-mfa-label" id="settings-2fa-secret-label">
                  Can&apos;t scan? Type this setup key
                </span>
                <div className="settings-mfa-secret">
                  <code aria-labelledby="settings-2fa-secret-label">{enroll.secret}</code>
                  <button
                    type="button"
                    className="settings-button settings-button--ghost"
                    onClick={() => void copySecret()}
                    aria-label="Copy setup key"
                  >
                    <FaCopy aria-hidden="true" />
                    Copy
                  </button>
                </div>
              </div>
              <div className="settings-field">
                <label htmlFor="settings-2fa-code">6-digit code</label>
                <TotpCodeInput
                  ref={codeRef}
                  id="settings-2fa-code"
                  className="settings-mfa-code"
                  value={code}
                  onChange={(next) => {
                    setCode(next);
                    setError("");
                  }}
                  onComplete={(next) => void verify(next)}
                  disabled={busy}
                  invalid={Boolean(error)}
                  describedBy={error ? "settings-2fa-code-error" : undefined}
                />
                {error ? (
                  <p id="settings-2fa-code-error" className="settings-mfa-error" role="alert">
                    {error}
                  </p>
                ) : null}
              </div>
              <button className="settings-button settings-button--primary" type="submit" disabled={busy}>
                {busy ? "Checking..." : "Verify and turn on"}
              </button>
            </form>
          </div>
        ) : null}

        {step === "codes" ? (
          <RecoveryCodesPanel
            codes={codes}
            loading={busy && codes.length === 0}
            error={codesError}
            onRetry={() => void createCodes()}
            onDone={onClose}
          />
        ) : null}
      </section>
    </div>
  );
}
