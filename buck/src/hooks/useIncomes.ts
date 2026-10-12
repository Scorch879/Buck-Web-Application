"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  mergeDashboardDataCache,
  useFinancial,
} from "@/context/FinancialContext";
import { computeCashFlow } from "@/utils/cashFlow";
import {
  getActiveWalletId,
  listIncomes,
  listWallets,
  subscribeUserTable,
  type BuckExpense,
  type BuckIncome,
} from "@/utils/supabaseData";

/**
 * Loads the user's incomes (cache-first, live via realtime) and derives the
 * monthly cash-flow figures shared with the mobile app.
 */
export function useIncomes(userId: string, expenses: BuckExpense[]) {
  const { dashboardCache, setDashboardCache } = useFinancial();
  const cachedIncomes =
    dashboardCache.userId === userId ? dashboardCache.incomes : undefined;
  const [incomes, setIncomes] = useState<BuckIncome[] | null | undefined>(
    cachedIncomes
  );

  const refresh = useCallback(async () => {
    if (!userId) return;

    try {
      const next = await listIncomes(userId);
      setIncomes(next);
      setDashboardCache((current) =>
        mergeDashboardDataCache(current, userId, { incomes: next })
      );
    } catch (error) {
      console.error("Failed to load incomes:", error);
    }
  }, [setDashboardCache, userId]);

  useEffect(() => {
    if (!userId) return;

    void refresh();
    const unsubscribe = subscribeUserTable("incomes", userId, () => {
      void refresh();
    });
    return unsubscribe;
  }, [refresh, userId]);

  const cashFlow = useMemo(
    () =>
      computeCashFlow(
        incomes === null ? null : (incomes ?? []),
        expenses
      ),
    [incomes, expenses]
  );

  return {
    /** Loaded incomes (empty while loading or when not tracked). */
    incomes: incomes ?? [],
    loaded: incomes !== undefined,
    tracked: incomes !== null,
    cashFlow,
    refresh,
  };
}

/**
 * Re-reads wallets after an income was added or deleted so the cached wallet
 * balance (`wallets.budget`) shown across the dashboard is up to date.
 */
export async function refreshWalletCache(
  userId: string,
  setDashboardCache: ReturnType<typeof useFinancial>["setDashboardCache"]
) {
  const [wallets, activeWalletId] = await Promise.all([
    listWallets(userId),
    getActiveWalletId(userId),
  ]);
  const activeWallet = wallets.find(
    (wallet) => wallet.id === activeWalletId && !wallet.deletedAt
  );

  setDashboardCache((current) =>
    mergeDashboardDataCache(current, userId, {
      wallets,
      activeWalletId,
      activeWalletBudget: activeWallet ? Number(activeWallet.budget) : 0,
    })
  );
}
