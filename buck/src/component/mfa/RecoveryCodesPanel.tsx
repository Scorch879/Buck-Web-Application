"use client";

import { useId, useState } from "react";
import { FaCopy, FaDownload, FaRedo } from "react-icons/fa";
import { useToast } from "@/component/toast";

/**
 * Shows the 10 backup codes once (ADR-048), with Copy, Download .txt and an
 * "I saved these" check before Done. Codes live only in component state.
 */

interface RecoveryCodesPanelProps {
  codes: string[];
  loading?: boolean;
  error?: string;
  onRetry?: () => void;
  onDone: () => void;
}

function codesAsText(codes: string[]) {
  return [
    "Buck backup codes",
    "Each code works once. Keep them somewhere safe and private.",
    "",
    ...codes,
    "",
  ].join("\n");
}

export default function RecoveryCodesPanel({ codes, loading = false, error = "", onRetry, onDone }: RecoveryCodesPanelProps) {
  const { toast } = useToast();
  const checkboxId = useId();
  const [saved, setSaved] = useState(false);

  const copyCodes = async () => {
    try {
      await navigator.clipboard.writeText(codes.join("\n"));
      toast.success("Backup codes copied.");
    } catch {
      toast("Couldn't copy. Download them instead.", "warning");
    }
  };

  const downloadCodes = () => {
    const url = URL.createObjectURL(new Blob([codesAsText(codes)], { type: "text/plain" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "buck-backup-codes.txt";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  if (error) {
    return (
      <div className="settings-mfa-codes">
        <p className="settings-mfa-error" role="alert">
          {error} Two-factor is still on. You can create codes later from Security settings.
        </p>
        <div className="settings-mfa-codes-actions">
          {onRetry ? (
            <button type="button" className="settings-button settings-button--primary" onClick={onRetry}>
              <FaRedo aria-hidden="true" />
              Try again
            </button>
          ) : null}
          <button type="button" className="settings-button settings-button--secondary" onClick={onDone}>
            Close
          </button>
        </div>
      </div>
    );
  }

  if (loading || codes.length === 0) {
    return (
      <div className="settings-mfa-codes" aria-busy="true">
        <span className="settings-connected-sr" role="status">
          Creating backup codes
        </span>
        <ol className="settings-mfa-code-list dashboard-skeleton" aria-hidden="true">
          {Array.from({ length: 10 }, (_, index) => (
            <li key={index} className="skeleton-text">
              ABCDE-12345
            </li>
          ))}
        </ol>
      </div>
    );
  }

  return (
    <div className="settings-mfa-codes">
      <ol className="settings-mfa-code-list" aria-label="Backup codes">
        {codes.map((code) => (
          <li key={code}>{code}</li>
        ))}
      </ol>
      <div className="settings-mfa-codes-actions">
        <button type="button" className="settings-button settings-button--secondary" onClick={() => void copyCodes()}>
          <FaCopy aria-hidden="true" />
          Copy
        </button>
        <button type="button" className="settings-button settings-button--secondary" onClick={downloadCodes}>
          <FaDownload aria-hidden="true" />
          Download .txt
        </button>
      </div>
      <label className="settings-mfa-check" htmlFor={checkboxId}>
        <input id={checkboxId} type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} />
        I saved these codes somewhere safe
      </label>
      <button type="button" className="settings-button settings-button--primary" onClick={onDone} disabled={!saved}>
        Done
      </button>
    </div>
  );
}
