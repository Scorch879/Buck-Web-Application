"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import AuthGuard from "@/component/AuthGuard";
import DashboardHeader from "@/component/dashboardheader";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import FinancialProvider from "@/context/FinancialProvider";

function getSkeletonVariant(pathname: string | null) {
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
      {children}
    </div>
  );
}

export default function DashboardClientLayout({
  children,
}: {
  children: ReactNode;
}) {
  const pathname = usePathname();
  const skeletonVariant = getSkeletonVariant(pathname);

  return (
    <AuthGuard
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
