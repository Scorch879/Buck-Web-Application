"use client";

import { useMemo } from "react";
import { useUserTable } from "@/hooks/useUserTable";
import { computeCashFlow } from "@/utils/cashFlow";
import type { BuckExpense } from "@/utils/supabaseData";

/**
 * Loads the user's incomes (cache-first, live via realtime) and derives the
 * monthly cash-flow figures shared with the mobile app.
 */
export function useIncomes(_userId: string, expenses: BuckExpense[]) {
  const { data: incomes, loading, refresh } = useUserTable("incomes");

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
    loaded: !loading || incomes !== undefined,
    tracked: incomes !== null,
    cashFlow,
    refresh,
  };
}
