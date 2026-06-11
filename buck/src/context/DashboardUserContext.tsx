"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { BuckUser } from "@/utils/authUser";

const DashboardUserContext = createContext<BuckUser | null>(null);

export function DashboardUserProvider({
  children,
  user,
}: {
  children: ReactNode;
  user: BuckUser;
}) {
  return (
    <DashboardUserContext.Provider value={user}>
      {children}
    </DashboardUserContext.Provider>
  );
}

export function useDashboardUser() {
  const user = useContext(DashboardUserContext);

  if (!user) {
    throw new Error("useDashboardUser must be used inside DashboardUserProvider.");
  }

  return { user };
}

export function useOptionalDashboardUser() {
  return useContext(DashboardUserContext);
}
