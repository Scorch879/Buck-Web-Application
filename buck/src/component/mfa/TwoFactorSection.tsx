"use client";

import { useCallback, useEffect, useState } from "react";
import { FaExclamationTriangle, FaMobileAlt, FaPlus, FaRedo, FaShieldAlt, FaTimes, FaTrash } from "react-icons/fa";
import DangerDeleteDialog from "@/component/DangerDeleteDialog";
import RecoveryCodesPanel from "@/component/mfa/RecoveryCodesPanel";
import TwoFactorEnrollModal from "@/component/mfa/TwoFactorEnrollModal";
import { useToast } from "@/component/toast";
import {
  LOW_RECOVERY_CODES,
  MAX_TOTP_FACTORS,
  cancelEmailRecovery,
  describeAuthError,
  fetchMfaStatus,
  generateRecoveryCodes,
  type MfaFactorSummary,
  type MfaStatus,
} from "@/utils/mfa/client";
import { supabase } from "@/utils/supabase";
import "@/component/skeletons/skeletons.css";

/**
 * Settings › Security › Two-factor authentication (ADR-048): turn on with an
 * authenticator app, add a second app, manage backup codes, remove apps with
 * the three-step dialog (ADR-041), and cancel an e-mail recovery.
 */

interface TwoFactorSectionProps {
  /** Open the enroll flow on load (`?tab=security&enroll=2fa`). */
  autoStartEnroll?: boolean;
  onAutoStartHandled?: () => void;
}

function formatDate(value: string, withTime = false) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "recently";
  }

  return new Intl.DateTimeFormat(undefined, withTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(date);
}

function factorLabel(factor: MfaFactorSummary, index: number) {
  return factor.friendlyName || `Authenticator app ${index + 1}`;
}

/** 1:1 with the "off" panel (ADR-012). */
function TwoFactorSkeleton() {
  return (
    <div className="settings-action-panel dashboard-skeleton" aria-hidden="true">
      <div>
        <strong className="skeleton-text">Two-factor is off</strong>
        <p className="skeleton-text">Add a 6-digit code from an authenticator app when you sign in.</p>
      </div>
      <span className="settings-button settings-button--primary skeleton-text">Turn on</span>
    </div>
  );
}

export default function TwoFactorSection({ autoStartEnroll = false, onAutoStartHandled }: TwoFactorSectionProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loadError, setLoadError] = useState("");
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [removing, setRemoving] = useState<{ factor: MfaFactorSummary; label: string } | null>(null);
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenCodes, setRegenCodes] = useState<string[]>([]);
  const [regenBusy, setRegenBusy] = useState(false);
  const [regenError, setRegenError] = useState("");
  const [canceling, setCanceling] = useState(false);

  const load = useCallback(async () => {
    setLoadError("");

    try {
      setStatus(await fetchMfaStatus());
    } catch (error) {
      setLoadError(describeAuthError(error, "Could not load your two-factor settings."));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // `?enroll=2fa`: start setup once the status is known (and only if room).
  useEffect(() => {
    if (!autoStartEnroll || !status) {
      return;
    }

    if (status.factors.length < MAX_TOTP_FACTORS) {
      setEnrollOpen(true);
    }

    onAutoStartHandled?.();
  }, [autoStartEnroll, onAutoStartHandled, status]);

  const removeFactor = async () => {
    if (!removing || !supabase) {
      return;
    }

    const { error } = await supabase.auth.mfa.unenroll({ factorId: removing.factor.id });

    if (error) {
      toast.error(
        /aal2|assurance/i.test(error.message)
          ? "Enter your two-factor code again before removing an app. Sign out and back in, then try again."
          : error.message || "Could not remove this app."
      );
      return;
    }

    try {
      await supabase.auth.refreshSession();
    } catch {
      // The status reload below still shows the change.
    }

    toast.success(`${removing.label} was removed.`);
    setRemoving(null);
    await load();
  };

  const createNewCodes = async () => {
    setRegenBusy(true);
    setRegenError("");

    try {
      setRegenCodes((await generateRecoveryCodes()).codes);
      await load();
    } catch (error) {
      setRegenError(describeAuthError(error, "Could not create backup codes."));
    } finally {
      setRegenBusy(false);
    }
  };

  const closeRegen = useCallback(() => {
    setRegenOpen(false);
    setRegenCodes([]);
    setRegenError("");
  }, []);

  const handleCancelRecovery = async () => {
    setCanceling(true);

    try {
      toast.success(await cancelEmailRecovery());
      await load();
    } catch (error) {
      toast.error(describeAuthError(error, "Could not cancel the recovery."));
    } finally {
      setCanceling(false);
    }
  };

  // Escape closes the regenerate dialog unless it is busy or showing codes.
  useEffect(() => {
    if (!regenOpen) {
      return;
    }

    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !regenBusy && regenCodes.length === 0) {
        closeRegen();
      }
    };

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [closeRegen, regenBusy, regenCodes.length, regenOpen]);

  const factors = status?.factors ?? [];
  const isLastFactor = factors.length === 1;
  const lowCodes = Boolean(status?.enabled) && (status?.recoveryCodesLeft ?? 0) <= LOW_RECOVERY_CODES;

  return (
    <section className="settings-section settings-section--mfa" aria-labelledby="settings-2fa-title">
      <div className="settings-section-heading">
        <FaShieldAlt aria-hidden="true" />
        <div>
          <p className="settings-eyebrow">Security</p>
          <h3 id="settings-2fa-title">Two-factor authentication</h3>
        </div>
      </div>

      {status?.emailRecovery ? (
        <div className="settings-mfa-banner" role="alert">
          <FaExclamationTriangle aria-hidden="true" />
          <div>
            <strong>Someone asked to remove two-factor by email.</strong>
            <p>
              {status.emailRecovery.state === "scheduled"
                ? `It will be removed at ${formatDate(status.emailRecovery.availableAt, true)}.`
                : `If the email link is opened before ${formatDate(status.emailRecovery.expiresAt, true)}, it will be removed 24 hours later.`}{" "}
              If this wasn&apos;t you, cancel it.
            </p>
          </div>
          <button
            type="button"
            className="settings-button settings-button--danger"
            onClick={() => void handleCancelRecovery()}
            disabled={canceling}
          >
            <FaTimes aria-hidden="true" />
            {canceling ? "Canceling..." : "Cancel recovery"}
          </button>
        </div>
      ) : null}

      {!status && !loadError ? (
        <>
          <span className="settings-connected-sr" role="status">
            Loading two-factor settings
          </span>
          <TwoFactorSkeleton />
        </>
      ) : null}

      {loadError ? (
        <div className="settings-connected-error" role="alert">
          <span>{loadError}</span>
          <button type="button" className="settings-button settings-button--ghost" onClick={() => void load()}>
            <FaRedo aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : null}

      {status && !status.enabled ? (
        <div className="settings-action-panel">
          <div>
            <strong>Two-factor is off</strong>
            <p>Add a 6-digit code from an authenticator app when you sign in.</p>
          </div>
          <button className="settings-button settings-button--primary" type="button" onClick={() => setEnrollOpen(true)}>
            Turn on
          </button>
        </div>
      ) : null}

      {status?.enabled ? (
        <>
          <ul className="settings-mfa-list" aria-label="Authenticator apps">
            {factors.map((factor, index) => {
              const label = factorLabel(factor, index);

              return (
                <li key={factor.id} className="settings-mfa-row">
                  <span className="settings-mfa-row-icon" aria-hidden="true">
                    <FaMobileAlt />
                  </span>
                  <div className="settings-mfa-row-info">
                    <strong>{label}</strong>
                    <span>Added {formatDate(factor.createdAt)}</span>
                  </div>
                  <button
                    type="button"
                    className="settings-button settings-button--danger settings-mfa-remove"
                    onClick={() => setRemoving({ factor, label })}
                    aria-label={`Remove ${label}`}
                  >
                    <FaTrash aria-hidden="true" />
                    Remove
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="settings-mfa-codes-row">
            <div>
              <strong>
                {status.recoveryCodesLeft} backup code{status.recoveryCodesLeft === 1 ? "" : "s"} left
              </strong>
              <p className={lowCodes ? "settings-mfa-warning" : undefined}>
                {lowCodes
                  ? "You're running low. Create new codes so you don't get locked out."
                  : "Use one if you can't reach your authenticator app."}
              </p>
            </div>
            <div className="settings-mfa-codes-buttons">
              {factors.length < MAX_TOTP_FACTORS ? (
                <button
                  className="settings-button settings-button--secondary"
                  type="button"
                  onClick={() => setEnrollOpen(true)}
                >
                  <FaPlus aria-hidden="true" />
                  Add a second app
                </button>
              ) : null}
              <button
                className={`settings-button ${lowCodes ? "settings-button--primary" : "settings-button--secondary"}`}
                type="button"
                onClick={() => setRegenOpen(true)}
              >
                <FaRedo aria-hidden="true" />
                Regenerate codes
              </button>
            </div>
          </div>
        </>
      ) : null}

      {enrollOpen && status ? (
        <TwoFactorEnrollModal
          isFirstFactor={!status.enabled}
          onEnrolled={() => void load()}
          onClose={() => {
            setEnrollOpen(false);
            void load();
          }}
        />
      ) : null}

      {regenOpen ? (
        <div
          className="settings-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !regenBusy && regenCodes.length === 0) {
              closeRegen();
            }
          }}
        >
          <section
            className="settings-modal settings-modal--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="settings-2fa-regen-title"
          >
            <div className="settings-modal-heading">
              <div>
                <p className="settings-eyebrow">Two-factor authentication</p>
                <h2 id="settings-2fa-regen-title">
                  {regenCodes.length > 0 ? "Save your new backup codes" : "Regenerate backup codes"}
                </h2>
                <p>
                  {regenCodes.length > 0
                    ? "Your old codes no longer work. We only show these now."
                    : "You'll get 10 new codes and all of your old codes will stop working."}
                </p>
              </div>
              {regenCodes.length === 0 ? (
                <button
                  className="settings-modal-close"
                  type="button"
                  onClick={closeRegen}
                  disabled={regenBusy}
                  aria-label="Close backup codes dialog"
                >
                  <FaTimes aria-hidden="true" />
                </button>
              ) : null}
            </div>

            {regenCodes.length > 0 || regenError ? (
              <RecoveryCodesPanel
                codes={regenCodes}
                error={regenError}
                onRetry={() => void createNewCodes()}
                onDone={closeRegen}
              />
            ) : (
              <button
                type="button"
                className="settings-button settings-button--primary"
                onClick={() => void createNewCodes()}
                disabled={regenBusy}
              >
                {regenBusy ? "Creating..." : "Create new codes"}
              </button>
            )}
          </section>
        </div>
      ) : null}

      <DangerDeleteDialog
        open={Boolean(removing)}
        itemType="authenticator app"
        itemName={removing?.label ?? ""}
        verb="Remove"
        verbing="Removing"
        consequences={
          isLastFactor
            ? [
                "This is your only authenticator app, so two-factor will turn OFF.",
                "Your backup codes will stop protecting your account.",
                "You can turn two-factor on again any time.",
              ]
            : ["Codes from this app will stop working.", "Your other authenticator app keeps two-factor on."]
        }
        onCancel={() => setRemoving(null)}
        onConfirm={removeFactor}
      />
    </section>
  );
}
