"use client";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FinancialContext,
  mergeDashboardDataCache,
  type DashboardDataCache,
  type UserTableName,
} from "./FinancialContext";
import { useOptionalDashboardUser } from "./DashboardUserContext";
import {
  ensureDefaultCategories,
  getActiveWalletId,
  getUserProfile,
  listExpenses,
  listGoals,
  listIncomes,
  listWallets,
  setActiveWallet,
  subscribeUserTable,
} from "@/utils/supabaseData";

const dashboardCacheStorageKey = "buck-dashboard-cache-v1";
const ALL_USER_TABLES: readonly UserTableName[] = [
  "profile",
  "categories",
  "expenses",
  "incomes",
  "goals",
  "wallets",
];

function readStoredDashboardCache(): DashboardDataCache {
  if (typeof window === "undefined") {
    return {};
  }

  try {
    const storedCache = window.sessionStorage.getItem(dashboardCacheStorageKey);

    if (!storedCache) {
      return {};
    }

    const parsedCache = JSON.parse(storedCache) as DashboardDataCache;
    return parsedCache && typeof parsedCache === "object" ? parsedCache : {};
  } catch {
    return {};
  }
}

function writeStoredDashboardCache(cache: DashboardDataCache) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    if (!cache.userId) {
      window.sessionStorage.removeItem(dashboardCacheStorageKey);
      return;
    }

    // Admin data (feedback, infra logs, telemetry) is sensitive and cheap to
    // refetch: keep it in memory only, never in sessionStorage.
    const {
      adminFeedback: _adminFeedback,
      adminVercelDeployments: _adminVercelDeployments,
      adminSupabaseLogs: _adminSupabaseLogs,
      adminTelemetry: _adminTelemetry,
      adminVercelError: _adminVercelError,
      adminSupabaseError: _adminSupabaseError,
      adminTelemetryError: _adminTelemetryError,
      ...persistable
    } = cache;

    window.sessionStorage.setItem(
      dashboardCacheStorageKey,
      JSON.stringify(persistable)
    );
  } catch {
    // Session storage is a speed boost only. The Supabase-backed data remains
    // the source of truth if storage is unavailable.
  }
}

async function loadTablePatch(
  userId: string,
  table: UserTableName
): Promise<Omit<DashboardDataCache, "userId" | "updatedAt">> {
  switch (table) {
    case "expenses":
      return { expenses: await listExpenses(userId) };
    case "incomes":
      return { incomes: await listIncomes(userId) };
    case "goals":
      return { goals: await listGoals(userId) };
    case "categories":
      return { categories: await ensureDefaultCategories(userId) };
    case "profile":
      return { profile: await getUserProfile(userId) };
    case "wallets": {
      const [wallets, rawActiveWalletId] = await Promise.all([
        listWallets(userId),
        getActiveWalletId(userId),
      ]);
      const liveWallets = wallets.filter((wallet) => !wallet.deletedAt);
      let activeWalletId = rawActiveWalletId;
      if (!activeWalletId && liveWallets.length === 1) {
        activeWalletId = liveWallets[0].id;
        await setActiveWallet(userId, activeWalletId);
      }
      const activeWallet = activeWalletId
        ? liveWallets.find((wallet) => wallet.id === activeWalletId) ?? null
        : null;
      return {
        wallets,
        activeWalletId,
        activeWalletBudget: activeWallet ? activeWallet.budget : null,
      };
    }
  }
}

export default function FinancialProvider({ children }: { children: React.ReactNode }) {
  const userId = useOptionalDashboardUser()?.uid ?? "";
  const [dashboardCache, setDashboardCache] = useState<DashboardDataCache>(
    () => readStoredDashboardCache()
  );
  const [tableErrorsState, setTableErrorsState] = useState<{
    userId: string;
    errors: Partial<Record<UserTableName, string>>;
  }>({ userId: "", errors: {} });
  const activeUserIdRef = useRef(userId);
  const inFlightRef = useRef(new Map<string, Promise<void>>());

  const refreshTable = useCallback(async (table: UserTableName) => {
    const targetUserId = activeUserIdRef.current;
    if (!targetUserId) {
      return;
    }

    const flightKey = `${targetUserId}:${table}`;
    const existing = inFlightRef.current.get(flightKey);
    if (existing) {
      return existing;
    }

    const run = (async () => {
      try {
        const patch = await loadTablePatch(targetUserId, table);
        if (activeUserIdRef.current !== targetUserId) {
          return;
        }
        setDashboardCache((prev) => mergeDashboardDataCache(prev, targetUserId, patch));
        setTableErrorsState((prev) => {
          const prevErrors = prev.userId === targetUserId ? prev.errors : {};
          if (!(table in prevErrors)) return prev.userId === targetUserId ? prev : { userId: targetUserId, errors: {} };
          const next = { ...prevErrors };
          delete next[table];
          return { userId: targetUserId, errors: next };
        });
      } catch (err) {
        if (activeUserIdRef.current !== targetUserId) {
          return;
        }
        const message = err instanceof Error ? err.message : `Failed to load ${table}.`;
        setTableErrorsState((prev) => {
          const prevErrors = prev.userId === targetUserId ? prev.errors : {};
          if (prev.userId === targetUserId && prevErrors[table] === message) {
            return prev;
          }
          return { userId: targetUserId, errors: { ...prevErrors, [table]: message } };
        });
      } finally {
        inFlightRef.current.delete(flightKey);
      }
    })();

    inFlightRef.current.set(flightKey, run);
    return run;
  }, []);

  useEffect(() => {
    activeUserIdRef.current = userId;
    if (!userId) {
      return;
    }

    ALL_USER_TABLES.forEach((table) => {
      void refreshTable(table);
    });

    const unsubs = [
      subscribeUserTable("expenses", userId, () => {
        void refreshTable("expenses");
      }),
      subscribeUserTable("incomes", userId, () => {
        void refreshTable("incomes");
      }),
      subscribeUserTable("goals", userId, () => {
        void refreshTable("goals");
      }),
      subscribeUserTable("categories", userId, () => {
        void refreshTable("categories");
      }),
      subscribeUserTable("wallets", userId, () => {
        void refreshTable("wallets");
      }),
      subscribeUserTable("profiles", userId, () => {
        void refreshTable("profile");
        void refreshTable("wallets");
      }),
    ];

    return () => {
      unsubs.forEach((unsub) => unsub());
    };
  }, [refreshTable, userId]);

  useEffect(() => {
    writeStoredDashboardCache(dashboardCache);
  }, [dashboardCache]);

  const tableErrors = useMemo(
    () => (tableErrorsState.userId === userId ? tableErrorsState.errors : {}),
    [tableErrorsState, userId]
  );

  const financialValue = useMemo(
    () => ({ dashboardCache, setDashboardCache, tableErrors, refreshTable }),
    [dashboardCache, refreshTable, tableErrors]
  );

  return (
    <FinancialContext.Provider value={financialValue}>
      {children}
    </FinancialContext.Provider>
  );
}
