"use client";

import { useEffect, useState, type ReactNode } from "react";
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
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  if (!isHydrated || loading || !user) {
    const isRedirectingOut = isHydrated && !loading && !user;

    if (fallback && !isRedirectingOut) {
      return <>{fallback}</>;
    }

    return (
      <div className="loading-spinner" style={isRedirectingOut ? { minHeight: "100vh" } : undefined}>
        <div className="spinner" />
        <div className="loading-text">
          {isRedirectingOut ? "Redirecting..." : "Loading Buck..."}
        </div>
      </div>
    );
  }

  return <DashboardUserProvider user={user}>{children}</DashboardUserProvider>;
}
