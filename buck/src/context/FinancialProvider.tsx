"use client";
import React, { useEffect, useMemo, useState } from "react";
import {
  FinancialContext,
  type DashboardDataCache,
} from "./FinancialContext";

const dashboardCacheStorageKey = "buck-dashboard-cache-v1";

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

    window.sessionStorage.setItem(
      dashboardCacheStorageKey,
      JSON.stringify(cache)
    );
  } catch {
    // Session storage is a speed boost only. The Supabase-backed data remains
    // the source of truth if storage is unavailable.
  }
}

export default function FinancialProvider({ children }: { children: React.ReactNode }) {
  const [totalSaved, setTotalSaved] = useState(0);
  const [dashboardCache, setDashboardCache] = useState<DashboardDataCache>(
    () => readStoredDashboardCache()
  );

  useEffect(() => {
    writeStoredDashboardCache(dashboardCache);
  }, [dashboardCache]);

  const financialValue = useMemo(
    () => ({ totalSaved, setTotalSaved, dashboardCache, setDashboardCache }),
    [dashboardCache, totalSaved]
  );

  return (
    <FinancialContext.Provider value={financialValue}>
      {children}
    </FinancialContext.Provider>
  );
}
