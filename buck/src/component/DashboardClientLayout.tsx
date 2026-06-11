"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AuthGuard from "@/component/AuthGuard";
import DashboardHeader from "@/component/dashboardheader";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import FinancialProvider from "@/context/FinancialProvider";
import type { BuckUser } from "@/utils/authUser";

function getSkeletonVariant(pathname: string | null) {
  if (pathname?.startsWith("/dashboard/settings")) {
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
      title: "Settings",
      eyebrow: "Account control",
      description: "Profile, security, appearance, and account recovery options.",
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

  return (
    <div className="dashboard">
      <DashboardHeader />
      <main className="dashboard-main">
        <header className="dashboard-topbar">
          <div>
            <p>{pageChrome.eyebrow}</p>
            <h1>{pageChrome.title}</h1>
          </div>
          <span>{pageChrome.description}</span>
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
