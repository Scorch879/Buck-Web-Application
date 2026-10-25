"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  FaCheck,
  FaDesktop,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaLink,
  FaRedo,
  FaShieldAlt,
} from "react-icons/fa";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import { createMfaVerifyPath } from "@/utils/mfa/assurance";
import type { ConsentDetails, ConsentRedirect } from "@/utils/oauthApps";
import {
  describeScope,
  getAppInitial,
  getWebsiteHost,
  isBuckLookalike,
  isLoopbackHost,
  isUnreviewedApp,
  toAppLogoSrc,
  toSafeHttpUrl,
} from "@/utils/connectedApps";
import "@/component/skeletons/skeletons.css";
import "./style.css";

/**
 * /oauth/consent (ADR-049): lets another app read the user's Buck data, or
 * says no. Middleware already made sure the user is signed in, passed 2FA and
 * is not idle. Decisions go through Buck's routes, never the browser SDK, so a
 * 2FA user's approval is recorded as verified.
 */

type Decision = "approve" | "deny";

type ViewState =
  | { kind: "loading" }
  | { kind: "consent"; details: ConsentDetails }
  | { kind: "redirecting" }
  | { kind: "invalid" }
  | { kind: "expired" }
  | { kind: "error"; message: string };

type ErrorBody = { error?: string };

const GENERIC_ERROR = "Something went wrong. Please try again.";

async function readBody<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as T & ErrorBody;
}

function AppLogo({ name, logoUrl }: { name: string; logoUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const src = toAppLogoSrc(logoUrl);

  if (!src || failed) {
    return (
      <span className="OC-Logo OC-Logo--initial" aria-hidden="true">
        {getAppInitial(name)}
      </span>
    );
  }

  return (
    // Buck's own logo proxy (ADR-051). A plain <img>: next/image would add its own optimiser hop.
    <img
      className="OC-Logo"
      src={src}
      alt=""
      width={56}
      height={56}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}

function CardShell({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  return (
    <motion.main
      className="OC-Card"
      aria-busy={busy}
      initial={{ opacity: 0, y: 14, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Link href="/" className="OC-Brand" aria-label="Buck home">
        <span className="OC-BrandMark">
          <Image src="/BuckMascot.png" alt="" width={40} height={52} className="OC-BrandMascot" priority />
        </span>
        <span>
          <strong>Buck</strong>
          <small>Connected apps</small>
        </span>
      </Link>
      {children}
    </motion.main>
  );
}

function StatusCard({
  icon,
  title,
  copy,
  action,
}: {
  icon: ReactNode;
  title: string;
  copy: string;
  action?: ReactNode;
}) {
  return (
    <CardShell>
      <div className="OC-Status">
        <span className="OC-StatusIcon" aria-hidden="true">
          {icon}
        </span>
        <h1>{title}</h1>
        <p role="alert">{copy}</p>
        {action ? <div className="OC-StatusAction">{action}</div> : null}
      </div>
    </CardShell>
  );
}

/** 1:1 with the consent card (ADR-012). */
function ConsentSkeleton() {
  return (
    <CardShell busy>
      <span className="OC-SrOnly" role="status">
        Loading app request
      </span>
      <div className="OC-AppHeader" aria-hidden="true">
        <span className="OC-Logo skeleton-text" />
        <div className="OC-AppText">
          <h1 className="skeleton-text">App name here</h1>
          <span className="OC-Website skeleton-text">example.com</span>
        </div>
      </div>
      <p className="OC-Lead skeleton-text" aria-hidden="true">
        wants to access your Buck account
      </p>
      <div className="OC-Section" aria-hidden="true">
        <p className="OC-SectionTitle skeleton-text">This app will be able to</p>
        <ul className="OC-Scopes">
          {["Confirm who you are", "See your email address"].map((label) => (
            <li key={label} className="skeleton-text">
              <FaCheck aria-hidden="true" />
              {label}
            </li>
          ))}
        </ul>
      </div>
      <div className="OC-Note skeleton-text" aria-hidden="true">
        <FaShieldAlt />
        <p>
          Read-only: this app can see your wallets, expenses, income, goals and budgets. It can&apos;t
          add, change or delete anything.
        </p>
      </div>
      <p className="OC-Redirect skeleton-text" aria-hidden="true">
        <FaExternalLinkAlt />
        You&apos;ll be sent to example.com
      </p>
      <div className="OC-Actions" aria-hidden="true">
        <span className="OC-Button skeleton-text">Deny</span>
        <span className="OC-Button skeleton-text">Allow</span>
      </div>
    </CardShell>
  );
}

function ConsentCard({
  details,
  submitting,
  error,
  onDecision,
}: {
  details: ConsentDetails;
  submitting: Decision | null;
  error: string;
  onDecision: (decision: Decision) => void;
}) {
  const { app, redirectHost, scopes } = details;
  const websiteHref = toSafeHttpUrl(app.website);
  const websiteHost = getWebsiteHost(websiteHref);
  const unreviewed = isUnreviewedApp(app.registration);
  const lookalike = isBuckLookalike(app.name, app.registration);
  const loopback = isLoopbackHost(redirectHost);
  const busy = submitting !== null;

  return (
    <CardShell busy={busy}>
      <div className="OC-AppHeader">
        <AppLogo name={app.name} logoUrl={app.logoUrl} />
        <div className="OC-AppText">
          <h1 id="consent-title">{app.name}</h1>
          {websiteHref && websiteHost ? (
            <a className="OC-Website" href={websiteHref} target="_blank" rel="noopener noreferrer nofollow">
              {websiteHost}
              <FaExternalLinkAlt aria-hidden="true" />
              <span className="OC-SrOnly"> (opens in a new tab)</span>
            </a>
          ) : null}
        </div>
      </div>
      <p className="OC-Lead">wants to access your Buck account</p>

      {lookalike ? (
        <div className="OC-Warning OC-Warning--danger" role="alert">
          <FaExclamationTriangle aria-hidden="true" />
          <p>
            <strong>This app calls itself &lsquo;{app.name}&rsquo;, but it isn&apos;t made by Buck.</strong>{" "}
            Buck hasn&apos;t reviewed this app. Only allow it if you trust it and started this yourself.
          </p>
        </div>
      ) : unreviewed ? (
        <div className="OC-Warning" role="note">
          <FaExclamationTriangle aria-hidden="true" />
          <p>Buck hasn&apos;t reviewed this app. Only allow it if you trust it and started this yourself.</p>
        </div>
      ) : null}

      {scopes.length > 0 ? (
        <div className="OC-Section">
          <p className="OC-SectionTitle" id="consent-scopes">
            This app will be able to
          </p>
          <ul className="OC-Scopes" aria-labelledby="consent-scopes">
            {scopes.map((scope) => (
              <li key={scope}>
                <FaCheck aria-hidden="true" />
                {describeScope(scope)}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="OC-Note">
        <FaShieldAlt aria-hidden="true" />
        <p>
          <strong>Read-only:</strong> this app can see your wallets, expenses, income, goals and budgets. It
          can&apos;t add, change or delete anything, and it can&apos;t use Buck AI.
        </p>
      </div>

      <p className="OC-Redirect">
        {loopback ? (
          <>
            <FaDesktop aria-hidden="true" />
            <span>You&apos;ll be sent back to an app running on this computer</span>
          </>
        ) : (
          <>
            <FaExternalLinkAlt aria-hidden="true" />
            <span>
              You&apos;ll be sent to <strong className="OC-Host">{redirectHost}</strong>
            </span>
          </>
        )}
      </p>

      {error ? (
        <p className="OC-Message" role="alert">
          {error}
        </p>
      ) : null}

      <div className="OC-Actions">
        <button
          type="button"
          className="OC-Button OC-Button--secondary"
          onClick={() => onDecision("deny")}
          disabled={busy}
          aria-busy={submitting === "deny"}
        >
          {submitting === "deny" ? "Denying..." : "Deny"}
        </button>
        <button
          type="button"
          className="OC-Button OC-Button--primary"
          onClick={() => onDecision("approve")}
          disabled={busy}
          aria-busy={submitting === "approve"}
        >
          {submitting === "approve" ? "Allowing..." : "Allow"}
        </button>
      </div>
    </CardShell>
  );
}

export default function OAuthConsentPage() {
  const isDarkTheme = useAuthPageTheme();
  const [authorizationId, setAuthorizationId] = useState<string | null>(null);
  const [view, setView] = useState<ViewState>({ kind: "loading" });
  const [submitting, setSubmitting] = useState<Decision | null>(null);
  const [submitError, setSubmitError] = useState("");
  // State updates are async, so two clicks in one tick would both pass a
  // state check. The ref makes sure only one decision is ever sent.
  const decisionInFlight = useRef(false);

  // Shared handling for statuses both routes return. True when handled.
  const handleFailure = useCallback((status: number, body: ErrorBody) => {
    if (status === 401) {
      if (body.error === "mfa_required") {
        window.location.assign(createMfaVerifyPath(window.location.pathname + window.location.search));
      } else {
        // Session changed in another tab: reload so middleware sorts it out.
        window.location.reload();
      }
      setView({ kind: "redirecting" });
      return true;
    }

    if (status === 400) {
      setView({ kind: "invalid" });
      return true;
    }

    if (status === 404) {
      setView({ kind: "expired" });
      return true;
    }

    return false;
  }, []);

  const load = useCallback(
    async (id: string) => {
      setView({ kind: "loading" });

      try {
        const response = await fetch(`/api/oauth/authorizations/${encodeURIComponent(id)}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        const body = await readBody<ConsentDetails | ConsentRedirect>(response);

        if (response.ok && body.state === "redirect") {
          setView({ kind: "redirecting" });
          window.location.assign(body.redirectUrl);
          return;
        }

        if (response.ok && body.state === "consent") {
          setView({ kind: "consent", details: body });
          return;
        }

        if (!handleFailure(response.status, body)) {
          setView({ kind: "error", message: body.error || GENERIC_ERROR });
        }
      } catch {
        setView({ kind: "error", message: "Couldn't reach Buck. Check your connection and try again." });
      }
    },
    [handleFailure]
  );

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("authorization_id")?.trim() ?? "";

    if (!id) {
      setView({ kind: "invalid" });
      return;
    }

    setAuthorizationId(id);
    void load(id);
  }, [load]);

  const decide = async (decision: Decision) => {
    if (!authorizationId || decisionInFlight.current) {
      return;
    }

    decisionInFlight.current = true;
    setSubmitting(decision);
    setSubmitError("");

    try {
      const response = await fetch(`/api/oauth/authorizations/${encodeURIComponent(authorizationId)}/consent`, {
        method: "POST",
        credentials: "same-origin",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const body = await readBody<{ redirectUrl?: string }>(response);

      if (response.ok && body.redirectUrl) {
        // Keep the buttons disabled: one decision only.
        setView({ kind: "redirecting" });
        window.location.assign(body.redirectUrl);
        return;
      }

      if (handleFailure(response.status, body)) {
        return;
      }

      setSubmitError(body.error || GENERIC_ERROR);
    } catch {
      setSubmitError("Couldn't reach Buck. Check your connection and try again.");
    }

    decisionInFlight.current = false;
    setSubmitting(null);
  };

  let content: ReactNode;

  switch (view.kind) {
    case "loading":
      content = <ConsentSkeleton />;
      break;
    case "consent":
      content = (
        <ConsentCard details={view.details} submitting={submitting} error={submitError} onDecision={decide} />
      );
      break;
    case "redirecting":
      content = (
        <CardShell busy>
          <div className="OC-Status">
            <span className="auth-button-spinner OC-Spinner" aria-hidden="true" />
            <h1>Taking you back to the app</h1>
            <p role="status">You can close this tab if nothing happens.</p>
          </div>
        </CardShell>
      );
      break;
    case "invalid":
      content = (
        <StatusCard
          icon={<FaLink />}
          title="This link isn't valid"
          copy="Open the app you were using and connect to Buck again."
          action={
            <Link href="/dashboard/home" className="OC-Button OC-Button--secondary">
              Go to dashboard
            </Link>
          }
        />
      );
      break;
    case "expired":
      content = (
        <StatusCard
          icon={<FaRedo />}
          title="Start again from the app"
          copy="This request has expired or was already used. Go back to the app and connect to Buck again."
          action={
            <Link href="/dashboard/home" className="OC-Button OC-Button--secondary">
              Go to dashboard
            </Link>
          }
        />
      );
      break;
    case "error":
      content = (
        <StatusCard
          icon={<FaExclamationTriangle />}
          title="Couldn't load this request"
          copy={view.message}
          action={
            authorizationId ? (
              <button
                type="button"
                className="OC-Button OC-Button--primary"
                onClick={() => void load(authorizationId)}
              >
                <FaRedo aria-hidden="true" />
                Try again
              </button>
            ) : null
          }
        />
      );
      break;
  }

  return <div className={`OC-Background${isDarkTheme ? " OC-Dark" : ""}`}>{content}</div>;
}
