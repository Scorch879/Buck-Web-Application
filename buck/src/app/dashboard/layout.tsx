"use client";

import AuthGuard from "@/component/AuthGuard";
import FinancialProvider from "@/context/FinancialProvider";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <FinancialProvider>{children}</FinancialProvider>
    </AuthGuard>
  );
}
