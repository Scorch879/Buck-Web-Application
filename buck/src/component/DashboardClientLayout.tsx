"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import AIChatBubble from "@/component/AIChatBubble";
import AuthGuard from "@/component/AuthGuard";
import DashboardHeader from "@/component/dashboardheader";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import MfaRequiredWatcher from "@/component/mfa/MfaRequiredWatcher";
import { useToast } from "@/component/toast";
import { useOptionalDashboardUser } from "@/context/DashboardUserContext";
import { mergeDashboardDataCache, useFinancial } from "@/context/FinancialContext";
import FinancialProvider from "@/context/FinancialProvider";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import { FaCheckCircle, FaTimes, FaWallet } from "react-icons/fa";
import type { BuckUser } from "@/utils/authUser";
import type { AccountDeletionAutoCancelNotice } from "@/utils/accountDeletion";
import { formatCurrency, formatMediumDateTime } from "@/utils/formatters";
import {
  getDashboardDisplayName,
  getDashboardPageChrome,
  getDashboardSkeletonVariant,
} from "@/utils/dashboardRoutes";
import { getActiveWallet } from "@/utils/supabaseData";

function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pageChrome = getDashboardPageChrome(pathname);
  const user = useOptionalDashboardUser();
  const { toast } = useToast();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const userCache = dashboardCache.userId === user?.uid ? dashboardCache : {};
  const walletBudgetKnown = userCache.activeWalletBudget !== undefined;
  const [deletionNotice, setDeletionNotice] =
    useState<AccountDeletionAutoCancelNotice | null>(null);
  const [dismissingNotice, setDismissingNotice] = useState(false);

  // Check if signing in automatically canceled a pending 10-day deletion
  // (email/password, Google OAuth, or passkey) and surface the dashboard note.
  useEffect(() => {
    const uid = user?.uid;
    if (!uid) return;
    let cancelled = false;

    fetch("/api/account/deletion/check-login-recovery", {
      method: "POST",
    })
      .then(async (response) => {
        if (!response.ok) return null;
        return (await response.json()) as {
          autoCanceled?: boolean;
          notice?: AccountDeletionAutoCancelNotice | null;
        };
      })
      .then((payload) => {
        if (cancelled || !payload?.notice) return;
        setDeletionNotice(payload.notice);
        if (payload.autoCanceled) {
          toast.success(
            "Scheduled account deletion was canceled automatically when you signed in."
          );
        }
      })
      .catch(() => {
        // Non-blocking notice check.
      });

    return () => {
      cancelled = true;
    };
  }, [user?.uid, toast]);

  const dismissDeletionNotice = async () => {
    if (!deletionNotice || dismissingNotice) return;
    setDismissingNotice(true);
    try {
      await fetch("/api/account/deletion/check-login-recovery", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ noticeId: deletionNotice.id }),
      });
      setDeletionNotice(null);
    } finally {
      setDismissingNotice(false);
    }
  };

  // The top-bar wallet pill belongs to the layout, so the layout loads the
  // active wallet itself. Only some tabs fill activeWalletBudget, so a hard
  // load straight into Forecast, Settings or Admin used to show "Wallet P0.00".
  useEffect(() => {
    const uid = user?.uid;
    if (!uid || walletBudgetKnown) return;
    let cancelled = false;
    getActiveWallet(uid)
      .then((wallet) => {
        if (cancelled) return;
        setDashboardCache((current) =>
          current.userId === uid && current.activeWalletBudget !== undefined
            ? current
            : mergeDashboardDataCache(current, uid, {
                activeWalletId: wallet?.id ?? null,
                activeWalletBudget: wallet?.budget ?? 0,
              })
        );
      })
      .catch(() => {
        // Leave the pill at its fallback; the wallet tab reports load errors.
      });
    return () => {
      cancelled = true;
    };
  }, [user?.uid, walletBudgetKnown, setDashboardCache]);
  const displayName = getDashboardDisplayName(userCache, user);
  const isHomePage = pathname?.startsWith("/dashboard/home") ?? true;
  // A brand-new account (under a day old) is welcomed, not "welcomed back".
  const createdAt = user?.created_at ? Date.parse(user.created_at) : NaN;
  const isNewAccount = Number.isFinite(createdAt) && Date.now() - createdAt < 24 * 60 * 60 * 1000;
  const topbarTitle = isHomePage
    ? `${isNewAccount ? "Welcome" : "Welcome back"}, ${displayName}`
    : pageChrome.title;
  const topbarEyebrow = isHomePage ? "Home" : pageChrome.eyebrow;

  const mainRef = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ container: mainRef });
  const smoothScroll = useSpring(scrollYProgress, {
    stiffness: 280,
    damping: 30,
    mass: 0.4,
    restDelta: 0.0001,
  });
  const scrollOpacity = useTransform(smoothScroll, [0, 0.01, 1], [0, 1, 1]);

  return (
    <div className="dashboard">
      <DashboardHeader />
      <main className="dashboard-main" ref={mainRef}>
        <header className={`dashboard-topbar${isHomePage ? " dashboard-topbar--welcome" : ""}`}>
          <div>
            <p>{topbarEyebrow}</p>
            <h1>{topbarTitle}</h1>
          </div>
          <div className="dashboard-topbar-actions">
            <span>{pageChrome.description}</span>
            <button
              className="dashboard-wallet-pill"
              onClick={() => window.dispatchEvent(new Event("open-wallet-modal"))}
              aria-label="Open wallet"
              type="button"
            >
              <FaWallet aria-hidden="true" />
              <strong>Wallet</strong>
              <span suppressHydrationWarning>
                {formatCurrency(userCache.activeWalletBudget || 0)}
              </span>
            </button>
          </div>
          <div
            className="dashboard-scroll-track"
            aria-hidden="true"
          >
            <motion.div
              className="dashboard-scroll-indicator"
              style={{
                scaleX: smoothScroll,
                opacity: scrollOpacity,
              }}
            />
          </div>
        </header>
        {deletionNotice ? (
          <aside
            className="dashboard-deletion-notice"
            role="status"
            aria-live="polite"
          >
            <FaCheckCircle
              className="dashboard-deletion-notice-icon"
              aria-hidden="true"
            />
            <div className="dashboard-deletion-notice-body">
              <strong>Account deletion canceled automatically</strong>
              <p>
                Signing back in on{" "}
                {formatMediumDateTime(deletionNotice.canceledAt) ?? "your last login"}{" "}
                canceled your scheduled 10-day deletion.{" "}
                {deletionNotice.emailSent
                  ? `A confirmation email was sent to ${user?.email || "your inbox"}.`
                  : "Your Buck account and financial data remain active."}
              </p>
            </div>
            <button
              type="button"
              className="dashboard-deletion-notice-dismiss"
              onClick={() => void dismissDeletionNotice()}
              disabled={dismissingNotice}
              aria-label="Dismiss account deletion cancellation notice"
            >
              <FaTimes aria-hidden="true" />
              <span>{dismissingNotice ? "Dismissing..." : "Dismiss"}</span>
            </button>
          </aside>
        ) : null}
        {children}
      </main>
    </div>
  );
}

export default function DashboardClientLayout({
  children,
  initialUser = null,
}: {
  children: ReactNode;
  initialUser?: BuckUser | null;
}) {
  const pathname = usePathname();
  const skeletonVariant = getDashboardSkeletonVariant(pathname);
  useAuthPageTheme();

  return (
    <>
      <MfaRequiredWatcher />
      <AuthGuard
        initialUser={initialUser}
        fallback={
          <DashboardShell>
            <DashboardPageSkeleton variant={skeletonVariant} />
          </DashboardShell>
        }
      >
        <FinancialProvider>
          <DashboardShell>{children}</DashboardShell>
          {/* Mounted once here (not per page) so the chat survives navigation. */}
          <AIChatBubble />
        </FinancialProvider>
      </AuthGuard>
    </>
  );
}
