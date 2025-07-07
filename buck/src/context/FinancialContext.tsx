import React, { createContext, useContext } from "react";

interface FinancialContextType {
  totalSaved: number;
  setTotalSaved: (value: number) => void;
}

export const FinancialContext = createContext<FinancialContextType>({ totalSaved: 0, setTotalSaved: () => {} });
export const useFinancial = () => useContext(FinancialContext); 