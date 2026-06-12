import React, { createContext, useContext } from "react";
import type {
  AccountDeletionStatus,
  BuckCategory,
  BuckExpense,
  BuckGoal,
  BuckProfile,
} from "@/utils/supabaseData";

export type DashboardDataCache = {
  userId?: string;
  profile?: BuckProfile;
  accountDeletionStatus?: AccountDeletionStatus | null;
  categories?: BuckCategory[];
  expenses?: BuckExpense[];
  goals?: BuckGoal[];
  wallets?: import("@/utils/supabaseData").BuckWallet[];
  activeWalletId?: string | null;
  activeWalletBudget?: number | null;
  updatedAt?: number;
};

interface FinancialContextType {
  totalSaved: number;
  setTotalSaved: (value: number) => void;
  dashboardCache: DashboardDataCache;
  setDashboardCache: React.Dispatch<React.SetStateAction<DashboardDataCache>>;
}

export function mergeDashboardDataCache(
  current: DashboardDataCache,
  userId: string,
  patch: Omit<DashboardDataCache, "userId" | "updatedAt">
) {
  const scopedCurrent = current.userId === userId ? current : {};

  return {
    ...scopedCurrent,
    ...patch,
    userId,
    updatedAt: Date.now(),
  } satisfies DashboardDataCache;
}

export const FinancialContext = createContext<FinancialContextType>({
  totalSaved: 0,
  setTotalSaved: () => {},
  dashboardCache: {},
  setDashboardCache: () => {},
});
export const useFinancial = () => useContext(FinancialContext);
