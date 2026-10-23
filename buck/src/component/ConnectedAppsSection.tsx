"use client";

import { useCallback, useEffect, useState } from "react";
import { FaPlug, FaRedo, FaUnlink } from "react-icons/fa";
import DangerDeleteDialog from "@/component/DangerDeleteDialog";
import { useToast } from "@/component/toast";
import {
  describeScope,
  getAppInitial,
  getWebsiteHost,
  toSafeHttpUrl,
} from "@/utils/connectedApps";
import {
  disconnectConnectedApp,
  listConnectedApps,
  type ConnectedAppGrant,
} from "@/utils/supabaseData";
import "@/component/skeletons/skeletons.css";

/**
 * Settings › Security › Connected apps (ADR-049): apps the user allowed to
 * read their Buck data, each with a three-step Disconnect (ADR-041).
 */

type LoadState = "loading" | "ready" | "error";

function formatGrantedAt(value: string) {
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "recently"
    : date.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function ConnectedAppLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const src = toSafeHttpUrl(logoUrl);

  if (!src || failed) {
    return (
      <span className="settings-connected-logo settings-connected-logo--initial" aria-hidden="true">
        {getAppInitial(name)}
      </span>
    );
  }

  return (
    // Third-party logo from any host, so a plain <img> rather than next/image.
    <img
      className="settings-connected-logo"
      src={src}
      alt=""
      width={40}
      height={40}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

/** 1:1 with the rows below (ADR-012). */
function ConnectedAppsSkeleton() {
  return (
    <ul className="settings-connected-list dashboard-skeleton" aria-hidden="true">
      {[0, 1].map((index) => (
        <li key={index} className="settings-connected-row">
          <span className="settings-connected-logo skeleton-text" />
          <div className="settings-connected-info">
            <strong className="skeleton-text">Connected app</strong>
            <span className="settings-connected-meta skeleton-text">claude.ai · Connected Oct 24, 2026</span>
            <span className="settings-connected-scopes">
              <span className="settings-connected-scope skeleton-text">Confirm who you are</span>
              <span className="settings-connected-scope skeleton-text">See your email address</span>
            </span>
          </div>
          <span className="settings-button settings-button--danger settings-connected-disconnect skeleton-text">
            <FaUnlink aria-hidden="true" />
            Disconnect
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function ConnectedAppsSection() {
  const { toast } = useToast();
  const [apps, setApps] = useState<ConnectedAppGrant[]>([]);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState<ConnectedAppGrant | null>(null);

  const load = useCallback(async () => {
    setLoadState("loading");
    setLoadError("");

    try {
      setApps(await listConnectedApps());
      setLoadState("ready");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load connected apps.");
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleDisconnect = async () => {
    if (!pending) {
      return;
    }

    try {
      await disconnectConnectedApp(pending.clientId);
      toast.success(`${pending.name} was disconnected.`);
      setPending(null);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not disconnect this app.");
    }
  };

  return (
    <section className="settings-section settings-section--connected" aria-labelledby="connected-apps-title">
      <div className="settings-section-heading">
        <FaPlug aria-hidden="true" />
        <div>
          <p className="settings-eyebrow">Security</p>
          <h3 id="connected-apps-title">Connected apps</h3>
        </div>
      </div>

      <p className="settings-connected-help">
        Connected apps can only read your Buck data. If you turn on two-factor authentication, reconnect your
        apps so they keep working.
      </p>

      {loadState === "loading" ? (
        <>
          <span className="settings-connected-sr" role="status">
            Loading connected apps
          </span>
          <ConnectedAppsSkeleton />
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

      {loadState === "ready" && apps.length === 0 ? (
        <p className="settings-connected-empty">
          No apps connected. Apps you allow to read your Buck data will show here.
        </p>
      ) : null}

      {loadState === "ready" && apps.length > 0 ? (
        <ul className="settings-connected-list">
          {apps.map((app) => {
            const host = getWebsiteHost(toSafeHttpUrl(app.website));

            return (
              <li key={app.clientId} className="settings-connected-row">
                <ConnectedAppLogo name={app.name} logoUrl={app.logoUrl} />
                <div className="settings-connected-info">
                  <strong>{app.name}</strong>
                  <span className="settings-connected-meta">
                    {host ? `${host} · ` : ""}Connected {formatGrantedAt(app.grantedAt)}
                  </span>
                  {app.scopes.length > 0 ? (
                    <span className="settings-connected-scopes" aria-label="Access">
                      {app.scopes.map((scope) => (
                        <span key={scope} className="settings-connected-scope">
                          {describeScope(scope)}
                        </span>
                      ))}
                    </span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className="settings-button settings-button--danger settings-connected-disconnect"
                  onClick={() => setPending(app)}
                  aria-label={`Disconnect ${app.name}`}
                >
                  <FaUnlink aria-hidden="true" />
                  Disconnect
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}

      <DangerDeleteDialog
        open={Boolean(pending)}
        itemType="connected app"
        itemName={pending?.name ?? ""}
        verb="Disconnect"
        verbing="Disconnecting"
        consequences={[
          "The app stops being able to read your Buck data straight away.",
          "To use it again, connect it from the app and allow it here.",
        ]}
        onCancel={() => setPending(null)}
        onConfirm={handleDisconnect}
      />
    </section>
  );
}
