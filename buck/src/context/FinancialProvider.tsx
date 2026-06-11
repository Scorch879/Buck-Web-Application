"use client";
import React, { useState } from "react";
import {
  FinancialContext,
  type DashboardDataCache,
} from "./FinancialContext";

export default function FinancialProvider({ children }: { children: React.ReactNode }) {
  const [totalSaved, setTotalSaved] = useState(0);
  const [dashboardCache, setDashboardCache] = useState<DashboardDataCache>({});

  return (
    <FinancialContext.Provider
      value={{ totalSaved, setTotalSaved, dashboardCache, setDashboardCache }}
    >
      {children}
    </FinancialContext.Provider>
  );
}
