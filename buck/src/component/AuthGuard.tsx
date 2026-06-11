"use client";

import type { ReactNode } from "react";
import { DashboardUserProvider } from "@/context/DashboardUserContext";
import type { BuckUser } from "@/utils/authUser";
import { useAuthGuard } from "@/utils/useAuthGuard";

type AuthGuardProps = {
  children: ReactNode;
  fallback?: ReactNode;
  initialUser?: BuckUser | null;
};

export default function AuthGuard({
  children,
  fallback,
  initialUser = null,
}: AuthGuardProps) {
  const { user, loading } = useAuthGuard(initialUser);

  if (loading || !user) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="loading-spinner">
        <div className="spinner" />
        <div className="loading-text">Loading Buck...</div>
      </div>
    );
  }

  return <DashboardUserProvider user={user}>{children}</DashboardUserProvider>;
}
