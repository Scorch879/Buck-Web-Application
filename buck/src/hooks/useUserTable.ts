"use client";

import { useCallback } from "react";
import {
  mergeDashboardDataCache,
  useFinancial,
  type DashboardDataCache,
  type UserTableName,
} from "@/context/FinancialContext";
import { useOptionalDashboardUser } from "@/context/DashboardUserContext";

export type UserTableDataMap = {
  expenses: NonNullable<DashboardDataCache["expenses"]>;
  incomes: Exclude<DashboardDataCache["incomes"], undefined>;
  goals: NonNullable<DashboardDataCache["goals"]>;
  categories: NonNullable<DashboardDataCache["categories"]>;
  wallets: NonNullable<DashboardDataCache["wallets"]>;
  profile: NonNullable<DashboardDataCache["profile"]>;
};

export interface UseUserTableResult<T extends UserTableName> {
  data: UserTableDataMap[T] | undefined;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  setData: (
    next:
      | UserTableDataMap[T]
      | ((current: UserTableDataMap[T] | undefined) => UserTableDataMap[T])
  ) => void;
}

/**
 * Reads a user-scoped Supabase table slice from `FinancialProvider`'s reactive cache
 * (pre-populated and kept live via `subscribeUserTable` inside `FinancialProvider`).
 */
export function useUserTable<T extends UserTableName>(table: T): UseUserTableResult<T> {
  const userId = useOptionalDashboardUser()?.uid ?? "";
  const { dashboardCache, setDashboardCache, tableErrors, refreshTable } = useFinancial();

  const scopedCache = userId && dashboardCache.userId === userId ? dashboardCache : undefined;
  const data = scopedCache?.[table] as UserTableDataMap[T] | undefined;
  const error = tableErrors[table] ?? null;
  const loading = Boolean(userId) && data === undefined && error === null;

  const refresh = useCallback(() => refreshTable(table), [refreshTable, table]);

  const setData = useCallback<UseUserTableResult<T>["setData"]>(
    (next) => {
      if (!userId) return;
      setDashboardCache((prev) => {
        const currentScoped = prev.userId === userId ? prev : undefined;
        const currentValue = currentScoped?.[table] as UserTableDataMap[T] | undefined;
        const resolvedValue =
          typeof next === "function"
            ? (next as (current: UserTableDataMap[T] | undefined) => UserTableDataMap[T])(
                currentValue
              )
            : next;

        const patch: Omit<DashboardDataCache, "userId" | "updatedAt"> = {
          [table]: resolvedValue,
        };
        if (table === "wallets" && Array.isArray(resolvedValue)) {
          const wallets = resolvedValue as UserTableDataMap["wallets"];
          const activeId = currentScoped?.activeWalletId;
          const activeWallet = activeId
            ? wallets.find((wallet) => !wallet.deletedAt && wallet.id === activeId) ?? null
            : null;
          patch.activeWalletBudget = activeWallet ? activeWallet.budget : null;
        }
        return mergeDashboardDataCache(prev, userId, patch);
      });
    },
    [setDashboardCache, table, userId]
  );

  return { data, loading, error, refresh, setData };
}
