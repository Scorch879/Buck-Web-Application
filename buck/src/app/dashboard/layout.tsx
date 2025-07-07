"use client";
import FinancialProvider from "@/context/FinancialProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return <FinancialProvider>{children}</FinancialProvider>;
} 