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

  if (pathname?.startsWith("/dashboard/goals")) {
    return "goals";
  }

  if (pathname?.startsWith("/dashboard/statistics")) {
    return "statistics";
  }

  return "home";
}

function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <div className="dashboard">
      <DashboardHeader />
      <main className="dashboard-main">{children}</main>
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
