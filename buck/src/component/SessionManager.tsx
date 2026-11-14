"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Session } from "@supabase/supabase-js";
import {
  SESSION_FORCE_SIGN_OUT_KEY,
  SESSION_LAST_ACTIVITY_KEY,
  getClientIdleTimeoutMs,
  getPositiveNumber,
  readStoredTimestamp,
  removeStoredValue,
  signOutUser,
  writeStoredValue,
} from "@/component/authentication";
import { isSupabaseConfigured, supabase } from "@/utils/supabase";

const SESSION_CHANNEL = "buck-session";
const DEFAULT_WARNING_SECONDS = 60;
const ACTIVITY_WRITE_THROTTLE_MS = 15_000;
const PASSIVE_ACTIVITY_EVENTS = [
  "pointerdown",
  "mousemove",
  "scroll",
  "touchstart",
] as const;

type SessionBroadcastMessage =
  | { type: "activity"; timestamp: number }
  | { type: "signout"; timestamp: number };

function getSessionBroadcastMessage(value: unknown) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const message = value as { type?: unknown; timestamp?: unknown };

  if (
    (message.type === "activity" || message.type === "signout") &&
    typeof message.timestamp === "number" &&
    Number.isFinite(message.timestamp)
  ) {
    return message as SessionBroadcastMessage;
  }

  return null;
}

function getWarningMs(timeoutMs: number) {
  const seconds = getPositiveNumber(
    process.env.NEXT_PUBLIC_SESSION_WARNING_SECONDS,
    DEFAULT_WARNING_SECONDS
  );
  const requestedMs = seconds * 1000;

  return Math.min(requestedMs, Math.max(timeoutMs - 1000, 0));
}

export default function SessionManager() {
  const router = useRouter();
  const timeoutMs = getClientIdleTimeoutMs();
  const warningMs = getWarningMs(timeoutMs);

  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  const authenticatedRef = useRef(false);
  const signingOutRef = useRef(false);
  const lastActivityRef = useRef(0);
  const lastWriteRef = useRef(0);
  const warningTimerRef = useRef<number | null>(null);
  const signOutTimerRef = useRef<number | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const broadcastRef = useRef<BroadcastChannel | null>(null);

  const clearTimers = useCallback(() => {
    if (warningTimerRef.current) {
      window.clearTimeout(warningTimerRef.current);
      warningTimerRef.current = null;
    }

    if (signOutTimerRef.current) {
      window.clearTimeout(signOutTimerRef.current);
      signOutTimerRef.current = null;
    }

    if (countdownTimerRef.current) {
      window.clearTimeout(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
  }, []);

  const readLastActivity = useCallback(() => {
    const storedActivity = readStoredTimestamp(SESSION_LAST_ACTIVITY_KEY);

    return storedActivity || lastActivityRef.current || Date.now();
  }, []);

  const publishSessionMessage = useCallback(
    (message: SessionBroadcastMessage) => {
      try {
        broadcastRef.current?.postMessage(message);
      } catch {
        // BroadcastChannel is best-effort; localStorage still syncs tabs.
      }
    },
    []
  );

  const signOutForInactivity = useCallback(
    async (notifyTabs = true) => {
      if (!supabase || signingOutRef.current) {
        return;
      }

      signingOutRef.current = true;
      authenticatedRef.current = false;
      lastActivityRef.current = 0;
      lastWriteRef.current = 0;
      setIsAuthenticated(false);
      setShowWarning(false);
      setSecondsLeft(0);
      clearTimers();
      removeStoredValue(SESSION_LAST_ACTIVITY_KEY);

      if (notifyTabs) {
        const timestamp = String(Date.now());
        writeStoredValue(SESSION_FORCE_SIGN_OUT_KEY, timestamp);
        publishSessionMessage({ type: "signout", timestamp: Number(timestamp) });
      }

      try {
        const result = await signOutUser();

        if (!result.success) {
          await supabase.auth.signOut({ scope: "local" });
        }
      } catch {
        try {
          await supabase.auth.signOut({ scope: "local" });
        } catch {
          // The UI state and stored session have already been cleared.
        }
      } finally {
        const currentPathname =
          typeof window !== "undefined" ? window.location.pathname : "";

        if (
          currentPathname !== "/sign-in" &&
          currentPathname !== "/create-account"
        ) {
          router.replace("/sign-in?reason=session-expired");
        }
      }
    },
    [clearTimers, publishSessionMessage, router]
  );

  const scheduleTimers = useCallback(() => {
    clearTimers();

    if (!authenticatedRef.current || timeoutMs <= 0) {
      return;
    }

    const getRemainingMs = () =>
      timeoutMs - Math.max(Date.now() - readLastActivity(), 0);
    const remainingMs = getRemainingMs();

    if (remainingMs <= 0) {
      void signOutForInactivity();
      return;
    }

    warningTimerRef.current = window.setTimeout(() => {
      const updateCountdown = () => {
        const remainingSeconds = Math.max(
          Math.ceil(getRemainingMs() / 1000),
          0
        );

        setSecondsLeft(remainingSeconds);
        setShowWarning(true);

        if (remainingSeconds <= 0) {
          void signOutForInactivity();
          return;
        }

        countdownTimerRef.current = window.setTimeout(updateCountdown, 1000);
      };

      updateCountdown();
    }, Math.max(remainingMs - warningMs, 0));

    signOutTimerRef.current = window.setTimeout(() => {
      void signOutForInactivity();
    }, remainingMs);
  }, [
    clearTimers,
    readLastActivity,
    signOutForInactivity,
    timeoutMs,
    warningMs,
  ]);

  const recordActivity = useCallback(
    (force = false) => {
      if (!authenticatedRef.current || timeoutMs <= 0 || signingOutRef.current) {
        return;
      }

      const now = Date.now();
      const lastActivity = readLastActivity();

      if (now - lastActivity >= timeoutMs) {
        void signOutForInactivity();
        return;
      }

      if (!force && now - lastWriteRef.current < ACTIVITY_WRITE_THROTTLE_MS) {
        return;
      }

      lastActivityRef.current = now;
      lastWriteRef.current = now;
      writeStoredValue(SESSION_LAST_ACTIVITY_KEY, String(now));
      publishSessionMessage({ type: "activity", timestamp: now });
      setShowWarning(false);
      setSecondsLeft(0);
      scheduleTimers();
    },
    [
      publishSessionMessage,
      readLastActivity,
      scheduleTimers,
      signOutForInactivity,
      timeoutMs,
    ]
  );

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || timeoutMs <= 0) {
      return;
    }

    let isMounted = true;

    const startTracking = (
      session?: Session | null,
      isFreshSignIn = false
    ) => {
      const now = Date.now();
      const storedActivity = readStoredTimestamp(SESSION_LAST_ACTIVITY_KEY);
      const lastSignInMs = session?.user?.last_sign_in_at
        ? Date.parse(session.user.last_sign_in_at)
        : Number.NaN;
      const hasNewerSignIn =
        Number.isFinite(lastSignInMs) &&
        lastSignInMs > 0 &&
        now - lastSignInMs < timeoutMs &&
        lastSignInMs > storedActivity;
      const shouldResetActivity =
        isFreshSignIn || hasNewerSignIn || !storedActivity;
      const activityTimestamp = shouldResetActivity ? now : storedActivity;

      signingOutRef.current = false;
      authenticatedRef.current = true;
      lastActivityRef.current = activityTimestamp;
      lastWriteRef.current = activityTimestamp;
      setIsAuthenticated(true);

      if (shouldResetActivity) {
        writeStoredValue(SESSION_LAST_ACTIVITY_KEY, String(now));
        removeStoredValue(SESSION_FORCE_SIGN_OUT_KEY);
      }

      if (now - activityTimestamp >= timeoutMs) {
        void signOutForInactivity();
        return;
      }

      scheduleTimers();
    };

    const stopTracking = () => {
      authenticatedRef.current = false;
      lastActivityRef.current = 0;
      lastWriteRef.current = 0;
      setIsAuthenticated(false);
      setShowWarning(false);
      setSecondsLeft(0);
      clearTimers();
      removeStoredValue(SESSION_LAST_ACTIVITY_KEY);
    };

    void supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) {
        return;
      }

      if (data.session) {
        startTracking(data.session, false);
      } else {
        stopTracking();
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (session) {
          startTracking(session, event === "SIGNED_IN");
        } else {
          stopTracking();
        }
      }
    );

    return () => {
      isMounted = false;
      authListener.subscription.unsubscribe();
      clearTimers();
    };
  }, [clearTimers, scheduleTimers, signOutForInactivity, timeoutMs]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase || timeoutMs <= 0) {
      return;
    }

    const handleActivity = () => recordActivity();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        recordActivity(true);
      }
    };
    const handleStorage = (event: StorageEvent) => {
      if (event.key === SESSION_FORCE_SIGN_OUT_KEY && event.newValue) {
        void signOutForInactivity(false);
      }

      if (event.key === SESSION_LAST_ACTIVITY_KEY && event.newValue) {
        const timestamp = Number(event.newValue);

        if (Number.isFinite(timestamp) && timestamp > 0) {
          lastActivityRef.current = timestamp;
          lastWriteRef.current = timestamp;
          setShowWarning(false);
          scheduleTimers();
        }
      }
    };

    PASSIVE_ACTIVITY_EVENTS.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity, { passive: true });
    });
    window.addEventListener("keydown", handleActivity);
    window.addEventListener("storage", handleStorage);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    if (typeof window.BroadcastChannel !== "undefined") {
      broadcastRef.current = new BroadcastChannel(SESSION_CHANNEL);
      broadcastRef.current.onmessage = (event: MessageEvent) => {
        const message = getSessionBroadcastMessage(event.data);

        if (!message) {
          return;
        }

        if (message.type === "signout") {
          void signOutForInactivity(false);
          return;
        }

        lastActivityRef.current = message.timestamp;
        lastWriteRef.current = message.timestamp;
        setShowWarning(false);
        scheduleTimers();
      };
    }

    return () => {
      PASSIVE_ACTIVITY_EVENTS.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      window.removeEventListener("keydown", handleActivity);
      window.removeEventListener("storage", handleStorage);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      broadcastRef.current?.close();
      broadcastRef.current = null;
    };
  }, [recordActivity, scheduleTimers, signOutForInactivity, timeoutMs]);

  const handleStaySignedIn = async () => {
    recordActivity(true);

    if (!supabase) {
      return;
    }

    try {
      const { error } = await supabase.auth.refreshSession();

      if (!error) {
        return;
      }
    } catch {
      // Fall through to a clean sign-out when the refresh token is invalid.
    }

    if (authenticatedRef.current) {
      void signOutForInactivity();
    }
  };

  const handleSignOutNow = () => {
    void signOutForInactivity();
  };

  if (timeoutMs <= 0 || !isAuthenticated || !showWarning) {
    return null;
  }

  return (
    <aside
      className="session-timeout-warning"
      role="status"
      aria-live="polite"
    >
      <div className="session-timeout-card">
        <p className="session-timeout-kicker">Session safety</p>
        <h2>Still budgeting?</h2>
        <p>
          Buck will sign you out in <strong>{secondsLeft}</strong> seconds after
          inactivity.
        </p>
        <div className="session-timeout-actions">
          <button type="button" onClick={handleStaySignedIn}>
            Stay signed in
          </button>
          <button type="button" onClick={handleSignOutNow}>
            Sign out now
          </button>
        </div>
      </div>
    </aside>
  );
}
