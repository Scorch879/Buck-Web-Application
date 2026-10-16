import React, { createContext, useContext } from "react";
import type {
  AccountDeletionStatus,
  BuckCategory,
  BuckExpense,
  BuckGoal,
  BuckIncome,
  BuckProfile,
} from "@/utils/supabaseData";

/** One row of `/api/admin/supabase` (Supabase auth_logs). */
export type AdminSupabaseLog = {
  /** ISO string or epoch number (the analytics API returns microseconds). */
  timestamp: string | number;
  event_message?: string | null;
};

/** One deployment from `/api/admin/vercel` (Vercel v6 deployments API). */
export type AdminVercelDeployment = {
  uid: string;
  url?: string | null;
  state?: string | null;
  /** Epoch milliseconds. */
  created: number;
  meta?: { githubCommitRef?: string | null } | null;
};

export type DashboardDataCache = {
  userId?: string;
  profile?: BuckProfile;
  accountDeletionStatus?: AccountDeletionStatus | null;
  categories?: BuckCategory[];
  expenses?: BuckExpense[];
  /** `undefined` = not loaded yet, `null` = income not tracked (table missing). */
  incomes?: BuckIncome[] | null;
  goals?: BuckGoal[];
  wallets?: import("@/utils/supabaseData").BuckWallet[];
  activeWalletId?: string | null;
  activeWalletBudget?: number | null;
  aiInsights?: import("@/utils/advisorApi").AIAdvisorInsights;
  forecastInsights?: import("@/utils/forecastApi").AIForecastInsights;
  adminFeedback?: import("@/utils/supabaseData").BuckFeedback[];
  adminVercelDeployments?: AdminVercelDeployment[];
  adminSupabaseLogs?: AdminSupabaseLog[];
  adminVercelError?: string;
  adminSupabaseError?: string;
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
