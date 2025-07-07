"use client";
import React, { useState } from "react";
import { FinancialContext } from "./FinancialContext";

export default function FinancialProvider({ children }: { children: React.ReactNode }) {
  const [totalSaved, setTotalSaved] = useState(0);
  return (
    <FinancialContext.Provider value={{ totalSaved, setTotalSaved }}>
      {children}
    </FinancialContext.Provider>
  );
} 