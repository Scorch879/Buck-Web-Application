"use client";

import React from "react";
import ExpensesSkeleton from "./ExpensesSkeleton";
import HomeSkeleton from "./HomeSkeleton";
import WalletSkeleton from "./WalletSkeleton";
import GoalsSkeleton from "./GoalsSkeleton";
import StatisticsSkeleton from "./StatisticsSkeleton";
import SettingsSkeleton from "./SettingsSkeleton";
import FinancialAdvisorSkeleton from "./FinancialAdvisorSkeleton";
import ForecastSkeleton from "./ForecastSkeleton";
import AdminSkeleton from "./AdminSkeleton";
import CategoriesSkeleton from "./CategoriesSkeleton";
import "./skeletons.css";

export type DashboardSkeletonVariant =
  | "home"
  | "goals"
  | "statistics"
  | "settings"
  | "expenses"
  | "wallet"
  | "financial-advisor"
  | "forecast"
  | "admin"
  | "categories";

export {
  ExpensesSkeleton,
  HomeSkeleton,
  WalletSkeleton,
  GoalsSkeleton,
  StatisticsSkeleton,
  SettingsSkeleton,
  FinancialAdvisorSkeleton,
  ForecastSkeleton,
  AdminSkeleton,
  CategoriesSkeleton,
};

/**
 * Universal Dashboard Page Skeleton Dispatcher
 * Selects the high-fidelity skeleton matching the active route variant.
 */
export function DashboardPageSkeleton({
  variant = "home",
}: {
  variant?: DashboardSkeletonVariant;
}) {
  switch (variant) {
    case "expenses":
      return <ExpensesSkeleton />;
    case "wallet":
      return <WalletSkeleton />;
    case "categories":
      return <CategoriesSkeleton />;
    case "goals":
      return <GoalsSkeleton />;
    case "statistics":
      return <StatisticsSkeleton />;
    case "settings":
      return <SettingsSkeleton />;
    case "financial-advisor":
      return <FinancialAdvisorSkeleton />;
    case "forecast":
      return <ForecastSkeleton />;
    case "admin":
      return <AdminSkeleton />;
    case "home":
    default:
      return <HomeSkeleton />;
  }
}
