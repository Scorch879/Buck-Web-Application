"use client";

import type { ReactNode } from "react";
import { useAuthGuard } from "@/utils/useAuthGuard";

type AuthGuardProps = {
  children: ReactNode;
  fallback?: ReactNode;
};

export default function AuthGuard({ children, fallback }: AuthGuardProps) {
  const { user, loading } = useAuthGuard();

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

  return <>{children}</>;
}
