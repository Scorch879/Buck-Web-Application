"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import AIChatBubble from "@/component/AIChatBubble";
import AuthGuard from "@/component/AuthGuard";
import DashboardHeader from "@/component/dashboardheader";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import MfaRequiredWatcher from "@/component/mfa/MfaRequiredWatcher";
import { useOptionalDashboardUser } from "@/context/DashboardUserContext";
import { mergeDashboardDataCache, useFinancial } from "@/context/FinancialContext";
import FinancialProvider from "@/context/FinancialProvider";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import { FaWallet } from "react-icons/fa";
import type { BuckUser } from "@/utils/authUser";
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
  const { dashboardCache, setDashboardCache } = useFinancial();
  const userCache = dashboardCache.userId === user?.uid ? dashboardCache : {};
  const walletBudgetKnown = userCache.activeWalletBudget !== undefined;

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
                {new Intl.NumberFormat("en-PH", {
                  style: "currency",
                  currency: "PHP",
                }).format(userCache.activeWalletBudget || 0)}
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
