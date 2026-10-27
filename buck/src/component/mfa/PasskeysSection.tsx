"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { FaFingerprint, FaPen, FaPlus, FaRedo, FaTrash } from "react-icons/fa";
import type { PasskeyListItem } from "@supabase/supabase-js";
import DangerDeleteDialog from "@/component/DangerDeleteDialog";
import { useToast } from "@/component/toast";
import { describeAuthError } from "@/utils/mfa/client";
import { supabase } from "@/utils/supabase";
import "@/component/skeletons/skeletons.css";

/**
 * Settings › Security › Passkeys (ADR-048). Passkey sign-in is aal1, so a 2FA
 * user still enters their code after it. Hidden with a note when the browser
 * or the Supabase project doesn't support passkeys.
 */

type LoadState = "loading" | "ready" | "unavailable" | "error";

function isPasskeyUnavailable(message: string) {
  return /not enabled|disabled|not supported|experimental|passkey.*(off|unavailable)|404/i.test(message);
}

/** The user closed the browser prompt: not worth an error toast. */
function isUserCancel(error: unknown) {
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  const message = describeAuthError(error, "");
  return name === "NotAllowedError" || name === "AbortError" || /cancel|not allowed|timed out/i.test(message);
}

function formatDate(value: string | undefined) {
  if (!value) {
    return null;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(date);
}

function passkeyLabel(passkey: PasskeyListItem, index: number) {
  return passkey.friendly_name?.trim() || `Passkey ${index + 1}`;
}

/** 1:1 with one passkey row plus the Add button (ADR-012). */
function PasskeysSkeleton() {
  return (
    <div className="dashboard-skeleton settings-mfa-skeleton" aria-hidden="true">
      <ul className="settings-mfa-list">
        <li className="settings-mfa-row">
          <span className="settings-mfa-row-icon skeleton-text" />
          <div className="settings-mfa-row-info">
            <strong className="skeleton-text">This device</strong>
            <span className="skeleton-text">Added Oct 26, 2026</span>
          </div>
          <span className="settings-button settings-button--danger settings-mfa-remove skeleton-text">Delete</span>
        </li>
      </ul>
      <span className="settings-button settings-button--secondary settings-mfa-add skeleton-text">Add a passkey</span>
    </div>
  );
}

export default function PasskeysSection() {
  const { toast } = useToast();
  const [passkeys, setPasskeys] = useState<PasskeyListItem[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [adding, setAdding] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [deleting, setDeleting] = useState<{ passkey: PasskeyListItem; label: string } | null>(null);

  const load = useCallback(async () => {
    if (!supabase || typeof window === "undefined" || !window.PublicKeyCredential) {
      setLoadState("unavailable");
      return;
    }

    setLoadState("loading");
    setLoadError("");

    try {
      const { data, error } = await supabase.auth.passkey.list();

      if (error) {
        if (isPasskeyUnavailable(error.message)) {
          setLoadState("unavailable");
          return;
        }

        throw error;
      }

      setPasskeys(data ?? []);
      setLoadState("ready");
    } catch (error) {
      const message = describeAuthError(error, "Could not load your passkeys.");

      if (isPasskeyUnavailable(message)) {
        setLoadState("unavailable");
        return;
      }

      setLoadError(message);
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const addPasskey = async () => {
    if (!supabase || adding) {
      return;
    }

    setAdding(true);

    try {
      const { error } = await supabase.auth.registerPasskey();

      if (error) {
        throw error;
      }

      toast.success("Passkey added. You can use it next time you sign in.");
      await load();
    } catch (error) {
      if (!isUserCancel(error)) {
        toast.error(describeAuthError(error, "Could not add a passkey."));
      }
    } finally {
      setAdding(false);
    }
  };

  const startRename = (passkey: PasskeyListItem, label: string) => {
    setRenamingId(passkey.id);
    setRenameValue(label);
  };

  const saveRename = async (event: FormEvent) => {
    event.preventDefault();

    if (!supabase || !renamingId || savingName) {
      return;
    }

    const friendlyName = renameValue.trim();

    if (!friendlyName) {
      toast.warning("Give the passkey a name.");
      return;
    }

    setSavingName(true);

    try {
      const { error } = await supabase.auth.passkey.update({ passkeyId: renamingId, friendlyName });

      if (error) {
        throw error;
      }

      toast.success("Passkey renamed.");
      setRenamingId(null);
      await load();
    } catch (error) {
      toast.error(describeAuthError(error, "Could not rename this passkey."));
    } finally {
      setSavingName(false);
    }
  };

  const deletePasskey = async () => {
    if (!supabase || !deleting) {
      return;
    }

    try {
      const { error } = await supabase.auth.passkey.delete({ passkeyId: deleting.passkey.id });

      if (error) {
        throw error;
      }

      toast.success(`${deleting.label} was deleted.`);
      setDeleting(null);
      await load();
    } catch (error) {
      toast.error(describeAuthError(error, "Could not delete this passkey."));
    }
  };

  return (
    <section className="settings-section settings-section--passkeys" aria-labelledby="settings-passkeys-title">
      <div className="settings-section-heading">
        <FaFingerprint aria-hidden="true" />
        <div>
          <p className="settings-eyebrow">Security</p>
          <h3 id="settings-passkeys-title">Passkeys</h3>
        </div>
      </div>

      <p className="settings-connected-help">
        Passkeys let you sign in without a password. If two-factor is on, you&apos;ll still enter your code.
      </p>

      {loadState === "unavailable" ? (
        <p className="settings-connected-empty">
          Passkeys aren&apos;t available here yet. Your browser or Buck&apos;s sign-in service doesn&apos;t support them.
        </p>
      ) : null}

      {loadState === "loading" ? (
        <>
          <span className="settings-connected-sr" role="status">
            Loading passkeys
          </span>
          <PasskeysSkeleton />
        </>
      ) : null}

      {loadState === "error" ? (
        <div className="settings-connected-error" role="alert">
          <span>{loadError}</span>
          <button type="button" className="settings-button settings-button--ghost" onClick={() => void load()}>
            <FaRedo aria-hidden="true" />
            Try again
          </button>
        </div>
      ) : null}

      {loadState === "ready" && passkeys.length === 0 ? (
        <p className="settings-connected-empty">No passkeys yet.</p>
      ) : null}

      {loadState === "ready" && passkeys.length > 0 ? (
        <ul className="settings-mfa-list" aria-label="Passkeys">
          {passkeys.map((passkey, index) => {
            const label = passkeyLabel(passkey, index);
            const added = formatDate(passkey.created_at);
            const lastUsed = formatDate(passkey.last_used_at);
            const isRenaming = renamingId === passkey.id;

            return (
              <li key={passkey.id} className="settings-mfa-row">
                <span className="settings-mfa-row-icon" aria-hidden="true">
                  <FaFingerprint />
                </span>
                {isRenaming ? (
                  <form className="settings-mfa-rename" onSubmit={(event) => void saveRename(event)}>
                    <label className="settings-connected-sr" htmlFor={`settings-passkey-name-${passkey.id}`}>
                      Passkey name
                    </label>
                    <input
                      id={`settings-passkey-name-${passkey.id}`}
                      type="text"
                      maxLength={120}
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      disabled={savingName}
                      autoFocus
                    />
                    <button type="submit" className="settings-button settings-button--primary" disabled={savingName}>
                      {savingName ? "Saving..." : "Save"}
                    </button>
                    <button
                      type="button"
                      className="settings-button settings-button--ghost"
                      onClick={() => setRenamingId(null)}
                      disabled={savingName}
                    >
                      Cancel
                    </button>
                  </form>
                ) : (
                  <>
                    <div className="settings-mfa-row-info">
                      <strong>{label}</strong>
                      <span>
                        {added ? `Added ${added}` : "Added recently"}
                        {lastUsed ? ` · Last used ${lastUsed}` : ""}
                      </span>
                    </div>
                    <div className="settings-mfa-row-actions">
                      <button
                        type="button"
                        className="settings-button settings-button--ghost"
                        onClick={() => startRename(passkey, label)}
                        aria-label={`Rename ${label}`}
                      >
                        <FaPen aria-hidden="true" />
                        Rename
                      </button>
                      <button
                        type="button"
                        className="settings-button settings-button--danger settings-mfa-remove"
                        onClick={() => setDeleting({ passkey, label })}
                        aria-label={`Delete ${label}`}
                      >
                        <FaTrash aria-hidden="true" />
                        Delete
                      </button>
                    </div>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      ) : null}

      {loadState === "ready" ? (
        <button
          type="button"
          className="settings-button settings-button--secondary settings-mfa-add"
          onClick={() => void addPasskey()}
          disabled={adding}
        >
          <FaPlus aria-hidden="true" />
          {adding ? "Waiting for your device..." : "Add a passkey"}
        </button>
      ) : null}

      <DangerDeleteDialog
        open={Boolean(deleting)}
        itemType="passkey"
        itemName={deleting?.label ?? ""}
        consequences={["You can no longer sign in with this passkey.", "Your password and two-factor keep working."]}
        onCancel={() => setDeleting(null)}
        onConfirm={deletePasskey}
      />
    </section>
  );
}
