"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AuthGuard from "@/component/AuthGuard";
import DashboardHeader from "@/component/dashboardheader";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useOptionalDashboardUser } from "@/context/DashboardUserContext";
import { useFinancial } from "@/context/FinancialContext";
import FinancialProvider from "@/context/FinancialProvider";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import { FaWallet } from "react-icons/fa";
import type { BuckUser } from "@/utils/authUser";

function getSkeletonVariant(pathname: string | null) {
  if (pathname?.startsWith("/dashboard/settings")) {
    return "settings";
  }

  if (pathname?.startsWith("/dashboard/wallet")) {
    return "settings";
  }

  if (pathname?.startsWith("/dashboard/expenses")) {
    return "statistics";
  }

  if (pathname?.startsWith("/dashboard/financial-advisor")) {
    return "home";
  }

  if (pathname?.startsWith("/dashboard/goals")) {
    return "goals";
  }

  if (pathname?.startsWith("/dashboard/statistics")) {
    return "statistics";
  }

  return "home";
}

function getPageChrome(pathname: string | null) {
  if (pathname?.startsWith("/dashboard/wallet")) {
    return {
      title: "Wallets",
      eyebrow: "Wallet management",
      description: "Manage your active wallets and total budget.",
    };
  }

  if (pathname?.startsWith("/dashboard/expenses")) {
    return {
      title: "Expenses",
      eyebrow: "Track the money trail",
      description: "Log spending, review recent expenses, and keep the wallet honest.",
    };
  }

  if (pathname?.startsWith("/dashboard/financial-advisor")) {
    return {
      title: "Financial Advisor",
      eyebrow: "Buck's next-step notes",
      description: "Readable suggestions from your wallet, goals, and spending rhythm.",
    };
  }

  if (pathname?.startsWith("/dashboard/forecast")) {
    return {
      title: "Forecast",
      eyebrow: "Future planning",
      description: "Predict your financial future based on your current habits.",
    };
  }

  if (pathname?.startsWith("/dashboard/statistics")) {
    return {
      title: "Statistics",
      eyebrow: "Spending patterns",
      description: "Forecasts, category views, and weekly budget movement.",
    };
  }

  if (pathname?.startsWith("/dashboard/goals")) {
    return {
      title: "Goals",
      eyebrow: "Saving progress",
      description: "Keep your active goal visible before the week gets noisy.",
    };
  }

  if (pathname?.startsWith("/dashboard/settings")) {
    return {
      title: "Keep your Buck profile tidy.",
      eyebrow: "Account settings",
      description: "Manage your display name, profile picture, email, and account security from one protected place.",
    };
  }

  if (pathname?.startsWith("/dashboard/admin")) {
    return {
      title: "SuperAdmin Dashboard",
      eyebrow: "Admin tools",
      description: "Monitor feedback, logs, and deployments for Buck.",
    };
  }

  return {
    title: "Dashboard",
    eyebrow: "Home",
    description: "Your weekly budget, spending, and summary at a glance.",
  };
}

function DashboardShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const pageChrome = getPageChrome(pathname);
  const user = useOptionalDashboardUser();
  const { dashboardCache } = useFinancial();
  const userCache = dashboardCache.userId === user?.uid ? dashboardCache : {};
  const displayName =
    userCache.profile?.username ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Buck user";
  const isHomePage = pathname?.startsWith("/dashboard/home") ?? true;
  const topbarTitle = isHomePage
    ? `Welcome back, ${displayName}`
    : pageChrome.title;
  const topbarEyebrow = isHomePage ? "Home" : pageChrome.eyebrow;

  return (
    <div className="dashboard">
      <DashboardHeader />
      <main className="dashboard-main">
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
  const skeletonVariant = getSkeletonVariant(pathname);
  useAuthPageTheme();

  return (
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
      </FinancialProvider>
    </AuthGuard>
  );
}
