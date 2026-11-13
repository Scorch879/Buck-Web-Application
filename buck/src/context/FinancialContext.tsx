import React, { createContext, useContext } from "react";
import type {
  AccountDeletionStatus,
  BuckCategory,
  BuckExpense,
  BuckGoal,
  BuckIncome,
  BuckProfile,
} from "@/utils/supabaseData";

/** One row of `/api/admin/supabase` (Supabase auth_logs). */
export type AdminSupabaseLog = {
  /** ISO string or epoch number (the analytics API returns microseconds). */
  timestamp: string | number;
  event_message?: string | null;
};

/** One deployment from `/api/admin/vercel` (Vercel v6 deployments API). */
export type AdminVercelDeployment = {
  uid: string;
  url?: string | null;
  state?: string | null;
  /** Epoch milliseconds. */
  created: number;
  meta?: { githubCommitRef?: string | null } | null;
};

export type AdminServiceHealth = {
  status: "online" | "degraded" | "offline";
  latencyMs: number | null;
  message: string;
  endpoint?: string | null;
  httpStatus?: number | null;
  checkedAt: string;
};

export type AdminModelBreakdownItem = {
  model_name: string;
  count: number;
  last_used_at: string;
};

export type AdminAdvisoryLogItem = {
  id: string;
  advisory_type: string;
  priority: string;
  model_name: string;
  generated_by: string;
  generated_with: "gemini" | "rules" | string;
  focus: string;
  financial_health_score: number | null;
  user_hash: string;
  created_at: string;
};

export type AdminUsageEventLogItem = {
  id: number;
  bucket: "chat" | "insight" | "tip" | "categorize" | string;
  user_hash: string;
  created_at: string;
};

export type AdminForecastLogItem = {
  id: string;
  period_type: string;
  model_name: string;
  generated_by: string;
  confidence_score: number | null;
  user_hash: string;
  created_at: string;
};

export type AdminSecurityEventLogItem = {
  id: string;
  event_type: string;
  outcome: string;
  ip_hash: string;
  actor_hash: string;
  created_at: string;
};

/** Full response from `/api/admin/overview`. */
export type AdminOverviewTelemetry = {
  generatedAt: string;
  services: {
    webApp: AdminServiceHealth & {
      environment: string;
      region: string;
      commitSha: string | null;
      branch: string | null;
    };
    supabaseDb: AdminServiceHealth;
    supabaseAuth: AdminServiceHealth;
    buckAi: AdminServiceHealth & {
      configuredModels: string[];
      fallbackEngine: string;
    };
    integrations: {
      supabaseAdminConfigured: boolean;
      supabaseManagementConfigured: boolean;
      vercelApiConfigured: boolean;
      buckAiConfigured: boolean;
    };
  };
  platform: {
    total_users: number;
    mfa_enabled_users: number;
    connected_oauth_apps: number;
    pending_deletions: number;
    total_wallets: number;
    total_expenses: number;
    total_incomes: number;
    total_goals: number;
    active_goals: number;
    completed_goals: number;
    total_categories: number;
    total_feedback: number;
    hashed_feedback: number;
  };
  buckAi: {
    advisories_total: number;
    advisories_24h: number;
    advisories_7d: number;
    advisories_gemini: number;
    advisories_rules: number;
    /** Advice written by the Groq fallback (metadata.generated_with = 'groq'). */
    advisories_groq: number;
    /** Older advice from a model that is neither Gemini nor Groq (e.g. the earlier Llama provider). */
    advisories_other: number;
    /** Advice written by any AI model: everything that is not fixed rules. */
    advisories_ai: number;
    forecasts_total: number;
    forecasts_active: number;
    usage_24h: {
      total: number;
      chat: number;
      insight: number;
      tip: number;
      categorize: number;
    };
    model_breakdown: AdminModelBreakdownItem[];
    priority_breakdown: {
      low: number;
      medium: number;
      high: number;
      urgent: number;
    };
    recent_advisories: AdminAdvisoryLogItem[];
    recent_usage_events: AdminUsageEventLogItem[];
    recent_forecasts: AdminForecastLogItem[];
  };
  security: {
    total_30d: number;
    rate_limited_30d: number;
    recent_events: AdminSecurityEventLogItem[];
  };
};

export type DashboardDataCache = {
  userId?: string;
  profile?: BuckProfile;
  accountDeletionStatus?: AccountDeletionStatus | null;
  categories?: BuckCategory[];
  expenses?: BuckExpense[];
  /** `undefined` = not loaded yet, `null` = income not tracked (table missing). */
  incomes?: BuckIncome[] | null;
  goals?: BuckGoal[];
  wallets?: import("@/utils/supabaseData").BuckWallet[];
  activeWalletId?: string | null;
  activeWalletBudget?: number | null;
  aiInsights?: import("@/utils/advisorApi").AIAdvisorInsights;
  /** One forecast per horizon, so switching 30 ↔ 60 days is instant. */
  forecastByHorizon?: Partial<
    Record<import("@/utils/forecastApi").ForecastHorizon, import("@/utils/forecastApi").AIForecastInsights>
  >;
  adminFeedback?: import("@/utils/supabaseData").BuckFeedback[];
  adminVercelDeployments?: AdminVercelDeployment[];
  adminSupabaseLogs?: AdminSupabaseLog[];
  adminTelemetry?: AdminOverviewTelemetry;
  adminVercelError?: string;
  adminSupabaseError?: string;
  adminTelemetryError?: string;
  updatedAt?: number;
};

interface FinancialContextType {
  totalSaved: number;
  setTotalSaved: (value: number) => void;
  dashboardCache: DashboardDataCache;
  setDashboardCache: React.Dispatch<React.SetStateAction<DashboardDataCache>>;
}

export function mergeDashboardDataCache(
  current: DashboardDataCache,
  userId: string,
  patch: Omit<DashboardDataCache, "userId" | "updatedAt">
) {
  const scopedCurrent = current.userId === userId ? current : {};

  return {
    ...scopedCurrent,
    ...patch,
    userId,
    updatedAt: Date.now(),
  } satisfies DashboardDataCache;
}

export const FinancialContext = createContext<FinancialContextType>({
  totalSaved: 0,
  setTotalSaved: () => {},
  dashboardCache: {},
  setDashboardCache: () => {},
});
export const useFinancial = () => useContext(FinancialContext);
