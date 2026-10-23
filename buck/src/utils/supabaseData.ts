import { getSupabaseClient } from "@/utils/supabase";
import { bumpDataEpoch, cachedRead, copyList } from "@/utils/dataCache";
import { toLocalDateString } from "@/utils/cashFlow";
import {
  designPreviewUserId,
  isDesignPreviewMode,
} from "@/utils/designPreview";

/** Expense and income categories share one table (Design.md ADR-042). */
export type CategoryKind = "expense" | "income";

export type BuckCategory = {
  id: string;
  name: string;
  kind?: CategoryKind;
};

/**
 * Bucket used when no category fits. The AI categorizer (and the
 * add_expense_atomic RPC) fall back to it, so it cannot be renamed or deleted.
 */
export const UNCATEGORIZED_EXPENSE = "Uncategorized";
/** Income fallback; income rows default to it when no source is given. */
export const UNCATEGORIZED_INCOME = "Other";

export type BuckExpense = {
  id: string;
  amount: number;
  category: string;
  categoryId?: string | null;
  date: string;
  description: string;
  goalId?: string | null;
  walletId?: string | null;
  userId: string;
};

export type BuckIncome = {
  id: string;
  walletId?: string | null;
  source: string;
  amount: number;
  description: string;
  /** `received_on` as a `YYYY-MM-DD` calendar date. */
  date: string;
  createdAt: string;
};

/** Income sources shared with the Buck mobile app. */
export const incomeSources = [
  "Salary",
  "Allowance",
  "Freelance",
  "Business",
  "Investment",
  "Gift",
  "Other",
] as const;

export type IncomeSource = (typeof incomeSources)[number];

export type AddIncomeResult = {
  incomeId: string;
  walletId: string;
  amount: number;
  walletBalance: number;
};

export type BuckGoal = {
  id: string;
  goalName: string;
  targetAmount: number;
  currentAmount: number;
  targetDate?: string;
  createdAt: string;
  attitude?: string;
  isActive: boolean;
  completed: boolean;
  aiRecommendation?: string;
  aiRecommendedBudget?: number | null;
};

export type BuckWallet = {
  id: string;
  name: string;
  budget: number;
  createdAt: string;
  deletedAt: string | null;
};

export type BuckProfile = {
  id: string;
  username: string;
  email: string;
  avatarPath: string | null;
  avatarUpdatedAt: string | null;
};

export type AccountDeletionStatus = {
  id: string;
  requestedAt: string;
  confirmationExpiresAt: string | null;
  confirmedAt: string | null;
  recoveryUntil: string | null;
  canceledAt: string | null;
};

export type BuckFeedback = {
  id: string;
  user_email: string;
  category: string;
  title: string;
  details: string;
  created_at: string;
};

export type BuckAIForecast = {
  id: string;
  userId: string;
  goalId?: string | null;
  walletId?: string | null;
  periodType: "weekly" | "monthly" | "quarterly" | "custom";
  periodStart: string;
  periodEnd: string;
  projectedSpending: number;
  projectedSavings: number;
  aiRecommendedBudget?: number | null;
  dailyForecast: Record<string, number>;
  actualSpendingSnapshot: number;
  summary: string;
  warnings: string[];
  confidenceScore?: number | null;
  modelName: string;
  generatedBy: "on_demand" | "cron" | "system";
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  expiresAt?: string | null;
};

export type BuckAIAdvisory = {
  id: string;
  userId: string;
  walletId?: string | null;
  goalId?: string | null;
  categoryId?: string | null;
  advisoryType:
    | "daily_tip"
    | "weekly_review"
    | "monthly_strategy"
    | "category_alert"
    | "goal_recommendation"
    | "emergency_warning";
  title: string;
  suggestion: string;
  advice: string;
  financialHealthScore?: number | null;
  priority: "low" | "medium" | "high" | "urgent";
  isRead: boolean;
  isDismissed: boolean;
  modelName: string;
  generatedBy: "on_demand" | "cron" | "system";
  metadata?: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  validUntil?: string | null;
};

type TableName =
  | "wallets"
  | "categories"
  | "goals"
  | "expenses"
  | "incomes"
  | "profiles"
  | "feedback"
  | "ai_forecasts"
  | "ai_advisories";

const avatarBucketName = "profile-avatars";
const maxAvatarSizeBytes = 2 * 1024 * 1024;
const avatarMimeExtensions: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const defaultCategoryNames = [
  "Food",
  "Fare",
  "Gas Money",
  "Video Games",
  "Shopping",
  "Bills",
  "Education",
  "Electronics",
  "Entertainment",
  "Health",
  "Home",
  "Insurance",
  "Social",
  "Sport",
  "Tax",
  "Telephone",
  "Transportation",
  "Uncategorized",
];

const previewIncomeCategories: BuckCategory[] = incomeSources.map((name) => ({
  id: `preview-income-category-${name.toLowerCase()}`,
  name,
  kind: "income",
}));

const previewCategories: BuckCategory[] = [
  { id: "preview-category-food", name: "Food" },
  { id: "preview-category-transport", name: "Transportation" },
  { id: "preview-category-shopping", name: "Shopping" },
  { id: "preview-category-bills", name: "Bills" },
  { id: "preview-category-goals", name: "Goal Transfer" },
];

const previewWallets: BuckWallet[] = [
  { id: "preview-wallet-main", name: "Weekly Wallet", budget: 4280, createdAt: "2026-06-01T00:00:00.000Z", deletedAt: null },
  { id: "preview-wallet-savings", name: "Savings Buffer", budget: 1850, createdAt: "2026-06-01T00:00:00.000Z", deletedAt: null },
];

const previewGoals: BuckGoal[] = [
  {
    id: "preview-goal-emergency",
    goalName: "Emergency Fund",
    targetAmount: 12000,
    currentAmount: 5280,
    targetDate: "2026-08-31",
    createdAt: "2026-06-01T00:00:00.000Z",
    attitude: "Moderate",
    isActive: true,
    completed: false,
    aiRecommendation:
      "Keep a PHP 850 weekend envelope and move PHP 300 to savings after bills clear.",
    aiRecommendedBudget: 850,
  },
  {
    id: "preview-goal-laptop",
    goalName: "Laptop Upgrade",
    targetAmount: 35000,
    currentAmount: 8600,
    targetDate: "2026-12-15",
    createdAt: "2026-05-15T00:00:00.000Z",
    attitude: "Normal",
    isActive: false,
    completed: false,
    aiRecommendation:
      "Hold nonessential shopping below PHP 900 this week to keep the goal moving.",
    aiRecommendedBudget: 900,
  },
];

const previewExpenses: BuckExpense[] = [
  {
    id: "preview-expense-1",
    amount: 220,
    category: "Food",
    categoryId: "preview-category-food",
    date: "2026-06-01",
    description: "Lunch and coffee",
    goalId: "preview-goal-emergency",
    walletId: "preview-wallet-main",
    userId: designPreviewUserId,
  },
  {
    id: "preview-expense-2",
    amount: 180,
    category: "Transportation",
    categoryId: "preview-category-transport",
    date: "2026-06-02",
    description: "Commute fare",
    goalId: "preview-goal-emergency",
    walletId: "preview-wallet-main",
    userId: designPreviewUserId,
  },
  {
    id: "preview-expense-3",
    amount: 640,
    category: "Bills",
    categoryId: "preview-category-bills",
    date: "2026-06-03",
    description: "Internet bill",
    goalId: "preview-goal-emergency",
    walletId: "preview-wallet-main",
    userId: designPreviewUserId,
  },
  {
    id: "preview-expense-4",
    amount: 399,
    category: "Shopping",
    categoryId: "preview-category-shopping",
    date: "2026-06-05",
    description: "Subscription renewal",
    goalId: "preview-goal-laptop",
    walletId: "preview-wallet-main",
    userId: designPreviewUserId,
  },
];

function toNumber(value: unknown) {
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : 0;
}

function assertUuid(value: string, label: string) {
  if (!uuidRegex.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }

  return value;
}

function escapeIlikePattern(value: string) {
  return value.trim().replace(/[\\%_]/g, (match) => `\\${match}`);
}

function mapCategory(row: Record<string, unknown>): BuckCategory {
  return {
    id: String(row.id),
    name: String(row.name || "Unnamed category"),
    kind: row.kind === "income" ? "income" : "expense",
  };
}

// Postgres "undefined column": the income-categories migration
// (202610130002) has not been applied yet, so `categories.kind` is missing.
function isMissingColumnError(error: { code?: string } | null) {
  return error?.code === "42703";
}

function mapExpense(row: Record<string, unknown>): BuckExpense {
  return {
    id: String(row.id),
    amount: toNumber(row.amount),
    category: String(row.category_name || "Uncategorized"),
    categoryId: row.category_id ? String(row.category_id) : null,
    date: String(row.spent_on || row.created_at || ""),
    description: String(row.description || ""),
    goalId: row.goal_id ? String(row.goal_id) : null,
    walletId: row.wallet_id ? String(row.wallet_id) : null,
    userId: String(row.user_id),
  };
}

function mapIncome(row: Record<string, unknown>): BuckIncome {
  return {
    id: String(row.id),
    walletId: row.wallet_id ? String(row.wallet_id) : null,
    source: String(row.source || "Other"),
    amount: toNumber(row.amount),
    description: String(row.description || ""),
    date: String(row.received_on || row.created_at || ""),
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
  };
}

function mapGoal(row: Record<string, unknown>): BuckGoal {
  return {
    id: String(row.id),
    goalName: String(row.goal_name || "Untitled goal"),
    targetAmount: toNumber(row.target_amount),
    currentAmount: toNumber(row.current_amount),
    targetDate: row.target_date ? String(row.target_date) : undefined,
    createdAt: String(row.created_at || new Date().toISOString()),
    attitude: row.attitude ? String(row.attitude) : undefined,
    isActive: Boolean(row.is_active),
    completed: Boolean(row.completed),
    aiRecommendation: row.ai_recommendation
      ? String(row.ai_recommendation)
      : undefined,
    aiRecommendedBudget:
      row.ai_recommended_budget === null || row.ai_recommended_budget === undefined
        ? null
        : toNumber(row.ai_recommended_budget),
  };
}

function mapWallet(row: Record<string, unknown>): BuckWallet {
  return {
    id: String(row.id),
    name: String(row.name || "Wallet"),
    budget: toNumber(row.budget),
    createdAt: row.created_at ? String(row.created_at) : new Date().toISOString(),
    deletedAt: row.deleted_at ? String(row.deleted_at) : null,
  };
}

function mapProfile(row: Record<string, unknown>): BuckProfile {
  return {
    id: String(row.id),
    username: String(row.username || ""),
    email: String(row.email || ""),
    avatarPath: row.avatar_path ? String(row.avatar_path) : null,
    avatarUpdatedAt: row.avatar_updated_at
      ? String(row.avatar_updated_at)
      : null,
  };
}

function mapAccountDeletionStatus(
  row: Record<string, unknown>
): AccountDeletionStatus {
  return {
    id: String(row.id),
    requestedAt: String(row.requested_at || ""),
    confirmationExpiresAt: row.confirmation_expires_at
      ? String(row.confirmation_expires_at)
      : null,
    confirmedAt: row.confirmed_at ? String(row.confirmed_at) : null,
    recoveryUntil: row.recovery_until ? String(row.recovery_until) : null,
    canceledAt: row.canceled_at ? String(row.canceled_at) : null,
  };
}

function mapAIForecast(row: Record<string, unknown>): BuckAIForecast {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    goalId: row.goal_id ? String(row.goal_id) : null,
    walletId: row.wallet_id ? String(row.wallet_id) : null,
    periodType: (row.period_type as BuckAIForecast["periodType"]) || "monthly",
    periodStart: String(row.period_start || ""),
    periodEnd: String(row.period_end || ""),
    projectedSpending: toNumber(row.projected_spending),
    projectedSavings: toNumber(row.projected_savings),
    aiRecommendedBudget:
      row.ai_recommended_budget !== null && row.ai_recommended_budget !== undefined
        ? toNumber(row.ai_recommended_budget)
        : null,
    dailyForecast: (row.daily_forecast as Record<string, number>) || {},
    actualSpendingSnapshot: toNumber(row.actual_spending_snapshot),
    summary: String(row.summary || ""),
    warnings: Array.isArray(row.warnings) ? (row.warnings as string[]) : [],
    confidenceScore:
      row.confidence_score !== null && row.confidence_score !== undefined
        ? toNumber(row.confidence_score)
        : null,
    modelName: String(row.model_name || "meta-llama/Llama-3.3-70B-Instruct-Turbo"),
    generatedBy: (row.generated_by as BuckAIForecast["generatedBy"]) || "on_demand",
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
    expiresAt: row.expires_at ? String(row.expires_at) : null,
  };
}

function mapAIAdvisory(row: Record<string, unknown>): BuckAIAdvisory {
  return {
    id: String(row.id),
    userId: String(row.user_id),
    walletId: row.wallet_id ? String(row.wallet_id) : null,
    goalId: row.goal_id ? String(row.goal_id) : null,
    categoryId: row.category_id ? String(row.category_id) : null,
    advisoryType: (row.advisory_type as BuckAIAdvisory["advisoryType"]) || "daily_tip",
    title: String(row.title || "Financial Advisory"),
    suggestion: String(row.suggestion || ""),
    advice: String(row.advice || ""),
    financialHealthScore:
      row.financial_health_score !== null && row.financial_health_score !== undefined
        ? Number(row.financial_health_score)
        : null,
    priority: (row.priority as BuckAIAdvisory["priority"]) || "medium",
    isRead: Boolean(row.is_read),
    isDismissed: Boolean(row.is_dismissed),
    modelName: String(row.model_name || "meta-llama/Llama-3.3-70B-Instruct-Turbo"),
    generatedBy: (row.generated_by as BuckAIAdvisory["generatedBy"]) || "on_demand",
    metadata: (row.metadata as Record<string, unknown>) || {},
    createdAt: String(row.created_at || new Date().toISOString()),
    updatedAt: String(row.updated_at || new Date().toISOString()),
    validUntil: row.valid_until ? String(row.valid_until) : null,
  };
}

function assertAvatarFile(file: File) {
  const extension = avatarMimeExtensions[file.type];

  if (!extension) {
    throw new Error("Upload a JPG, PNG, or WebP profile picture.");
  }

  if (file.size > maxAvatarSizeBytes) {
    throw new Error("Profile picture must be 2 MB or smaller.");
  }

  return extension;
}

function assertUserAvatarPath(userId: string, avatarPath: string) {
  const safeUserId = assertUuid(userId, "user id");

  if (!avatarPath.startsWith(`${safeUserId}/`)) {
    throw new Error("Avatar path does not belong to this user.");
  }

  return avatarPath;
}

async function getCurrentUserId() {
  if (isDesignPreviewMode) {
    return designPreviewUserId;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new Error("User not authenticated");
  }

  return assertUuid(data.user.id, "user session");
}

export async function getUserProfile(userId: string) {
  if (isDesignPreviewMode) {
    return {
      id: designPreviewUserId,
      username: "Design Preview",
      email: "preview@buck.local",
      avatarPath: null,
      avatarUpdatedAt: null,
    } satisfies BuckProfile;
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, email, avatar_path, avatar_updated_at")
    .eq("id", safeUserId)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes("avatar_path") ||
      error.message.includes("avatar_updated_at")
    ) {
      const { data: fallbackData, error: fallbackError } = await supabase
        .from("profiles")
        .select("id, username, email")
        .eq("id", safeUserId)
        .maybeSingle();

      if (fallbackError) {
        throw new Error(fallbackError.message);
      }

      if (fallbackData) {
        return {
          ...mapProfile(fallbackData),
          avatarPath: null,
          avatarUpdatedAt: null,
        };
      }
    }

    throw new Error(error.message);
  }

  if (!data) {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      throw new Error("User not authenticated");
    }

    return {
      id: safeUserId,
      username:
        typeof user.user_metadata?.username === "string"
          ? user.user_metadata.username
          : "",
      email: user.email ?? "",
      avatarPath: null,
      avatarUpdatedAt: null,
    };
  }

  return mapProfile(data);
}

export async function getAccountDeletionStatus(userId: string) {
  if (isDesignPreviewMode) {
    return null;
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const { data, error } = await supabase
    .from("account_deletion_requests")
    .select(
      "id, requested_at, confirmation_expires_at, confirmed_at, recovery_until, canceled_at"
    )
    .eq("user_id", safeUserId)
    .is("canceled_at", null)
    .is("purge_started_at", null)
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (
      error.message.includes("account_deletion_requests") ||
      error.message.includes("schema cache")
    ) {
      return null;
    }

    throw new Error(error.message);
  }

  return data ? mapAccountDeletionStatus(data) : null;
}

export async function updateUserProfileName(userId: string, username: string) {
  if (isDesignPreviewMode) {
    return {
      id: designPreviewUserId,
      username: username.trim(),
      email: "preview@buck.local",
      avatarPath: null,
      avatarUpdatedAt: null,
    } satisfies BuckProfile;
  }

  const trimmedUsername = username.trim();

  if (trimmedUsername.length < 2) {
    throw new Error("Display name must be at least 2 characters.");
  }

  if (trimmedUsername.length > 60) {
    throw new Error("Display name must be 60 characters or fewer.");
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: safeUserId,
        username: trimmedUsername,
      },
      { onConflict: "id" }
    );

  if (profileError) {
    throw new Error(profileError.message);
  }

  const { error: authError } = await supabase.auth.updateUser({
    data: {
      full_name: trimmedUsername,
      username: trimmedUsername,
    },
  });

  if (authError) {
    throw new Error(authError.message);
  }

  return getUserProfile(safeUserId);
}

export async function getUserAvatarSignedUrl(
  avatarPath: string | null | undefined,
  expiresInSeconds = 3600
) {
  if (!avatarPath || isDesignPreviewMode) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage
    .from(avatarBucketName)
    .createSignedUrl(avatarPath, expiresInSeconds);

  if (error) {
    throw new Error(error.message);
  }

  return data.signedUrl;
}

export async function replaceUserAvatar(
  userId: string,
  file: File,
  previousAvatarPath?: string | null
) {
  if (isDesignPreviewMode) {
    return getUserProfile(designPreviewUserId);
  }

  const safeUserId = assertUuid(userId, "user id");
  const extension = assertAvatarFile(file);
  const supabase = getSupabaseClient();
  const avatarPath = `${safeUserId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage
    .from(avatarBucketName)
    .upload(avatarPath, file, {
      cacheControl: "3600",
      contentType: file.type,
      upsert: false,
    });

  if (uploadError) {
    throw new Error(uploadError.message);
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .upsert(
      {
        id: safeUserId,
        avatar_path: avatarPath,
        avatar_updated_at: new Date().toISOString(),
      },
      { onConflict: "id" }
    );

  if (profileError) {
    await supabase.storage.from(avatarBucketName).remove([avatarPath]);
    throw new Error(profileError.message);
  }

  if (previousAvatarPath && previousAvatarPath !== avatarPath) {
    try {
      await supabase.storage
        .from(avatarBucketName)
        .remove([assertUserAvatarPath(safeUserId, previousAvatarPath)]);
    } catch (error) {
      console.warn("Failed to remove previous avatar:", error);
    }
  }

  return getUserProfile(safeUserId);
}

export async function removeUserAvatar(userId: string, avatarPath: string | null) {
  if (isDesignPreviewMode) {
    return getUserProfile(designPreviewUserId);
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      avatar_path: null,
      avatar_updated_at: new Date().toISOString(),
    })
    .eq("id", safeUserId);

  if (profileError) {
    throw new Error(profileError.message);
  }

  if (avatarPath) {
    const { error: storageError } = await supabase.storage
      .from(avatarBucketName)
      .remove([assertUserAvatarPath(safeUserId, avatarPath)]);

    if (storageError) {
      throw new Error(storageError.message);
    }
  }

  return getUserProfile(safeUserId);
}

// One realtime channel per (table, user), shared by every subscriber (OPT-003).
// Each page used to open its own channel for the same rows.
type SharedChannel = {
  listeners: Set<() => void>;
  timer: ReturnType<typeof setTimeout> | null;
  teardown: () => void;
};
const sharedChannels = new Map<string, SharedChannel>();

export function subscribeUserTable(
  table: TableName,
  userId: string,
  onChange: () => void
) {
  if (isDesignPreviewMode) {
    return () => {};
  }

  const safeUserId = assertUuid(userId, "user id");
  const key = `${table}:${safeUserId}`;
  let shared = sharedChannels.get(key);

  if (!shared) {
    const supabase = getSupabaseClient();
    const userColumn = table === "profiles" ? "id" : "user_id";
    const created: SharedChannel = {
      listeners: new Set(),
      timer: null,
      teardown: () => {},
    };

    // A change from another tab or the mobile app invalidates cached reads at
    // once; the fan-out is coalesced because a bulk write fires one event per row.
    const notify = () => {
      bumpDataEpoch();
      if (created.timer) clearTimeout(created.timer);
      created.timer = setTimeout(() => {
        created.timer = null;
        created.listeners.forEach((listener) => listener());
      }, 300);
    };

    const channel = supabase
      .channel(`${key}:${Math.random().toString(36).slice(2)}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `${userColumn}=eq.${safeUserId}`,
        },
        notify
      )
      .subscribe();

    created.teardown = () => {
      if (created.timer) clearTimeout(created.timer);
      void supabase.removeChannel(channel);
    };
    sharedChannels.set(key, created);
    shared = created;
  }

  const active = shared;
  active.listeners.add(onChange);

  return () => {
    active.listeners.delete(onChange);
    if (active.listeners.size === 0) {
      active.teardown();
      sharedChannels.delete(key);
    }
  };
}

export async function ensureDefaultCategories(userId: string) {
  if (isDesignPreviewMode) {
    return previewCategories;
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  const existingCategories = await listCategories(safeUserId);

  if (existingCategories.length > 0) {
    return existingCategories;
  }

  const { error } = await supabase.from("categories").insert(
    defaultCategoryNames.map((name, index) => ({
      user_id: safeUserId,
      name,
      sort_order: (index + 1) * 10,
    }))
  );

  if (error) {
    throw new Error(error.message);
  }

  return listCategories(safeUserId);
}

async function fetchListCategories(userId: string) {
  if (isDesignPreviewMode) {
    return previewCategories;
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, kind, sort_order")
    .eq("user_id", safeUserId)
    .eq("kind", "expense")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    if (isMissingColumnError(error)) {
      // Before 202610130002 every category is an expense category.
      const legacy = await supabase
        .from("categories")
        .select("id, name, sort_order")
        .eq("user_id", safeUserId)
        .order("sort_order", { ascending: true })
        .order("name", { ascending: true });
      if (legacy.error) throw new Error(legacy.error.message);
      return (legacy.data ?? []).map(mapCategory);
    }
    throw new Error(error.message);
  }

  return (data ?? []).map(mapCategory);
}

/**
 * The user's income categories, seeding the defaults on first use. Returns
 * `null` when income categories are unavailable (migration 202610130002 not
 * applied); callers then fall back to the fixed `incomeSources` list.
 */
export async function listIncomeCategories(userId: string): Promise<BuckCategory[] | null> {
  if (isDesignPreviewMode) {
    return previewIncomeCategories;
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  const select = () =>
    supabase
      .from("categories")
      .select("id, name, kind, sort_order")
      .eq("user_id", safeUserId)
      .eq("kind", "income")
      .order("sort_order", { ascending: true })
      .order("name", { ascending: true });

  const { data, error } = await select();
  if (error) {
    if (isMissingColumnError(error)) return null;
    throw new Error(error.message);
  }
  if (data && data.length > 0) return data.map(mapCategory);

  const { error: seedError } = await supabase.from("categories").insert(
    incomeSources.map((name, index) => ({
      user_id: safeUserId,
      name,
      kind: "income",
      sort_order: (index + 1) * 10,
    }))
  );
  if (seedError && seedError.code !== "23505") throw new Error(seedError.message);

  const seeded = await select();
  if (seeded.error) throw new Error(seeded.error.message);
  return (seeded.data ?? []).map(mapCategory);
}

/** Expenses still in the Uncategorized bucket (input for AI auto-categorize). */
export async function listUncategorizedExpenses(userId: string) {
  const expenses = await listExpenses(userId);
  return expenses.filter(
    (e) => !e.category || e.category === UNCATEGORIZED_EXPENSE
  );
}

/**
 * Incomes without a real category: source "Other", or a source that no longer
 * matches any of the user's income categories (input for AI auto-categorize).
 */
export async function listUncategorizedIncomes(
  userId: string,
  incomeCategories: BuckCategory[]
): Promise<BuckIncome[]> {
  const incomes = (await listIncomes(userId)) ?? [];
  const known = new Set(incomeCategories.map((c) => c.name.toLowerCase()));
  return incomes.filter(
    (i) => i.source === UNCATEGORIZED_INCOME || !known.has(i.source.toLowerCase())
  );
}

/** Re-files an expense under a category (keeps category_name in sync). */
export async function setExpenseCategory(
  userId: string,
  expenseId: string,
  category: BuckCategory
) {
  if (isDesignPreviewMode) return;

  const safeUserId = assertUuid(userId, "user id");
  const safeExpenseId = assertUuid(expenseId, "expense id");
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("expenses")
    .update({
      category_id: assertUuid(category.id, "category id"),
      category_name: category.name,
    })
    .eq("id", safeExpenseId)
    .eq("user_id", safeUserId);

  if (error) throw new Error(error.message);
}

/**
 * Re-files an income under a category by name. After 202610130002 a trigger
 * also sets incomes.category_id from the name.
 */
export async function setIncomeCategory(
  userId: string,
  incomeId: string,
  categoryName: string
) {
  if (isDesignPreviewMode) return;

  const safeUserId = assertUuid(userId, "user id");
  const safeIncomeId = assertUuid(incomeId, "income id");
  const name = categoryName.trim();
  if (!name) throw new Error("Category name is required.");

  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("incomes")
    .update({ source: name })
    .eq("id", safeIncomeId)
    .eq("user_id", safeUserId);

  if (error) throw new Error(error.message);
}

export async function addCategory(
  userId: string,
  name: string,
  kind: CategoryKind = "expense"
) {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error("Category name is required.");
  }

  if (isDesignPreviewMode) {
    return {
      id: `preview-category-${kind}-${trimmed.toLowerCase().replace(/\s+/g, "-")}`,
      name: trimmed,
      kind,
    };
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  // `kind` is only sent for income so expense inserts keep working before
  // migration 202610130002 (the column defaults to 'expense').
  const row: Record<string, string> = { user_id: safeUserId, name: trimmed };
  if (kind === "income") row.kind = kind;
  const { data, error } = await supabase
    .from("categories")
    .insert(row)
    .select("id, name")
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new Error(`A category named "${trimmed}" already exists.`);
    }
    throw new Error(error.message);
  }

  return { ...mapCategory(data), kind };
}

export async function updateCategoryName(
  userId: string,
  categoryId: string,
  name: string
) {
  if (isDesignPreviewMode) {
    return;
  }

  const safeUserId = assertUuid(userId, "user id");
  const safeCategoryId = assertUuid(categoryId, "category id");
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("categories")
    .update({ name: name.trim() })
    .eq("id", safeCategoryId)
    .eq("user_id", safeUserId);

  if (error) {
    throw new Error(error.message);
  }
}

/**
 * Renames a category and copies the new name onto the items filed under it
 * (expenses.category_name / incomes.source). Migration 202610130002 adds a
 * trigger that does the same; doing it here too keeps history correct before
 * that migration is applied.
 */
export async function renameCategory(
  userId: string,
  category: BuckCategory,
  newName: string
) {
  const name = newName.trim();
  if (!name) throw new Error("Category name is required.");
  if (isDesignPreviewMode) return;

  const safeUserId = assertUuid(userId, "user id");
  const safeCategoryId = assertUuid(category.id, "category id");
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from("categories")
    .update({ name })
    .eq("id", safeCategoryId)
    .eq("user_id", safeUserId);
  if (error) {
    if (error.code === "23505") throw new Error(`A category named "${name}" already exists.`);
    throw new Error(error.message);
  }

  if (category.kind === "income") {
    const { error: syncError } = await supabase
      .from("incomes")
      .update({ source: name })
      .eq("user_id", safeUserId)
      .eq("source", category.name);
    if (syncError) throw new Error(syncError.message);
  } else {
    const { error: syncError } = await supabase
      .from("expenses")
      .update({ category_name: name })
      .eq("user_id", safeUserId)
      .eq("category_id", safeCategoryId);
    if (syncError) throw new Error(syncError.message);
  }
}

/**
 * Deletes a category after moving its items to the fallback bucket
 * (expenses -> "Uncategorized", incomes -> "Other"), so nothing is left
 * pointing at a category that no longer exists. Moved items then show up for
 * AI auto-categorize. Returns how many items were moved.
 */
export async function deleteCategoryAndReassign(
  userId: string,
  category: BuckCategory,
  fallback: BuckCategory | null
): Promise<number> {
  if (isDesignPreviewMode) return 0;

  const safeUserId = assertUuid(userId, "user id");
  const safeCategoryId = assertUuid(category.id, "category id");
  const supabase = getSupabaseClient();
  let moved = 0;

  if (category.kind === "income") {
    const { data, error } = await supabase
      .from("incomes")
      .update({ source: fallback?.name ?? UNCATEGORIZED_INCOME })
      .eq("user_id", safeUserId)
      .eq("source", category.name)
      .select("id");
    if (error) throw new Error(error.message);
    moved = data?.length ?? 0;
  } else {
    const { data, error } = await supabase
      .from("expenses")
      .update({
        category_id: fallback ? assertUuid(fallback.id, "category id") : null,
        category_name: fallback?.name ?? UNCATEGORIZED_EXPENSE,
      })
      .eq("user_id", safeUserId)
      .eq("category_id", safeCategoryId)
      .select("id");
    if (error) throw new Error(error.message);
    moved = data?.length ?? 0;

    // Older rows may carry only the name (category_id null).
    const legacy = await supabase
      .from("expenses")
      .update({
        category_id: fallback ? assertUuid(fallback.id, "category id") : null,
        category_name: fallback?.name ?? UNCATEGORIZED_EXPENSE,
      })
      .eq("user_id", safeUserId)
      .is("category_id", null)
      .eq("category_name", category.name)
      .select("id");
    if (legacy.error) throw new Error(legacy.error.message);
    moved += legacy.data?.length ?? 0;
  }

  await deleteCategory(safeUserId, safeCategoryId);
  return moved;
}

export async function deleteCategory(userId: string, categoryId: string) {
  if (isDesignPreviewMode) {
    return;
  }

  const safeUserId = assertUuid(userId, "user id");
  const safeCategoryId = assertUuid(categoryId, "category id");
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", safeCategoryId)
    .eq("user_id", safeUserId);

  if (error) {
    throw new Error(error.message);
  }
}

async function fetchListExpenses(userId: string) {
  if (isDesignPreviewMode) {
    return previewExpenses;
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  // PostgREST returns at most 1,000 rows per request, so a single query would
  // silently drop older expenses. Page until a short page comes back.
  const pageSize = 1000;
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("expenses")
      .select(
        "id, user_id, wallet_id, goal_id, category_id, category_name, amount, description, spent_on, created_at"
      )
      .eq("user_id", safeUserId)
      .order("spent_on", { ascending: false })
      .order("created_at", { ascending: false })
      .order("id", { ascending: true })
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) {
      break;
    }
  }

  return rows.map(mapExpense);
}

async function getCategoryByName(userId: string, categoryName: string) {
  if (isDesignPreviewMode) {
    return (
      previewCategories.find(
        (category) =>
          category.name.toLowerCase() === categoryName.toLowerCase()
      ) ?? null
    );
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name")
    .eq("user_id", safeUserId)
    .ilike("name", escapeIlikePattern(categoryName))
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapCategory(data) : null;
}

export async function addExpense(
  userId: string,
  expense: {
    amount: number;
    categoryName?: string;
    categoryId?: string | null;
    date: string;
    description: string;
    goalId?: string | null;
    walletId?: string | null;
  }
) {
  if (isDesignPreviewMode) {
    return {
      id: `preview-expense-${Date.now()}`,
      amount: expense.amount,
      category: expense.categoryName || "Uncategorized",
      categoryId: expense.categoryId ?? null,
      date: expense.date,
      description: expense.description,
      goalId: expense.goalId ?? null,
      walletId: expense.walletId ?? "preview-wallet-main",
      userId,
    };
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const safeCategoryId = expense.categoryId
    ? assertUuid(expense.categoryId, "category id")
    : null;
  const safeGoalId = expense.goalId
    ? assertUuid(expense.goalId, "goal id")
    : null;
  const safeWalletId = expense.walletId
    ? assertUuid(expense.walletId, "wallet id")
    : null;
  const categoryName = expense.categoryName?.trim() || "Uncategorized";
  const category =
    safeCategoryId || categoryName === "Uncategorized"
      ? null
      : await getCategoryByName(safeUserId, categoryName);

  const { data, error } = await supabase
    .from("expenses")
    .insert({
      user_id: safeUserId,
      wallet_id: safeWalletId,
      goal_id: safeGoalId,
      category_id: safeCategoryId ?? category?.id ?? null,
      category_name: category?.name ?? categoryName,
      amount: expense.amount,
      description: expense.description,
      spent_on: expense.date || toLocalDateString(new Date()),
    })
    .select(
      "id, user_id, wallet_id, goal_id, category_id, category_name, amount, description, spent_on, created_at"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapExpense(data);
}

export async function deleteExpense(userId: string, expenseId: string) {
  if (isDesignPreviewMode) {
    return;
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const safeExpenseId = assertUuid(expenseId, "expense id");
  const { error } = await supabase
    .from("expenses")
    .delete()
    .eq("id", safeExpenseId)
    .eq("user_id", safeUserId);

  if (error) {
    throw new Error(error.message);
  }
}

async function fetchListGoals(userId: string) {
  if (isDesignPreviewMode) {
    return previewGoals;
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const { data, error } = await supabase
    .from("goals")
    .select(
      "id, goal_name, target_amount, current_amount, target_date, created_at, attitude, is_active, completed, ai_recommendation, ai_recommended_budget"
    )
    .eq("user_id", safeUserId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapGoal);
}

export async function createGoalRecord(
  goalName: string,
  targetAmount: string,
  attitude: string,
  targetDate: string,
  aiRecommendation = ""
) {
  if (isDesignPreviewMode) {
    return {
      id: `preview-goal-${Date.now()}`,
      goalName,
      targetAmount: Number(targetAmount),
      currentAmount: 0,
      targetDate,
      createdAt: new Date().toISOString(),
      attitude,
      isActive: false,
      completed: false,
      aiRecommendation,
      aiRecommendedBudget: null,
    };
  }

  const userId = await getCurrentUserId();
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("goals")
    .insert({
      user_id: userId,
      goal_name: goalName,
      target_amount: Number(targetAmount),
      attitude,
      target_date: targetDate,
      is_active: false,
      ai_recommendation: aiRecommendation,
    })
    .select(
      "id, goal_name, target_amount, current_amount, target_date, created_at, attitude, is_active, completed, ai_recommendation, ai_recommended_budget"
    )
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapGoal(data);
}

export async function deleteGoalRecord(goalId: string) {
  if (isDesignPreviewMode) {
    return;
  }

  const userId = await getCurrentUserId();
  const safeGoalId = assertUuid(goalId, "goal id");
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("goals")
    .delete()
    .eq("id", safeGoalId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateGoalStatusRecord(goalId: string, isActive: boolean) {
  if (isDesignPreviewMode) {
    return;
  }

  const userId = await getCurrentUserId();
  const safeGoalId = assertUuid(goalId, "goal id");
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("goals")
    .update({ is_active: isActive })
    .eq("id", safeGoalId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function setOnlyGoalActiveRecord(goalId: string) {
  if (isDesignPreviewMode) {
    return;
  }

  const userId = await getCurrentUserId();
  const safeGoalId = assertUuid(goalId, "goal id");
  const supabase = getSupabaseClient();
  const { error: deactivateError } = await supabase
    .from("goals")
    .update({ is_active: false })
    .eq("user_id", userId);

  if (deactivateError) {
    throw new Error(deactivateError.message);
  }

  const { error: activateError } = await supabase
    .from("goals")
    .update({ is_active: true })
    .eq("id", safeGoalId)
    .eq("user_id", userId);

  if (activateError) {
    throw new Error(activateError.message);
  }
}

export async function updateGoalRecord(
  goalId: string,
  goalName: string,
  targetAmount: string,
  attitude: string,
  targetDate: string,
  aiRecommendation = ""
) {
  if (isDesignPreviewMode) {
    return;
  }

  const userId = await getCurrentUserId();
  const safeGoalId = assertUuid(goalId, "goal id");
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("goals")
    .update({
      goal_name: goalName,
      target_amount: Number(targetAmount),
      attitude,
      target_date: targetDate,
      ai_recommendation: aiRecommendation,
    })
    .eq("id", safeGoalId)
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateGoalProgress(
  userId: string,
  goalId: string,
  currentAmount: number,
  completed: boolean
) {
  if (isDesignPreviewMode) {
    return;
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const safeGoalId = assertUuid(goalId, "goal id");
  const { error } = await supabase
    .from("goals")
    .update({
      current_amount: currentAmount,
      completed,
    })
    .eq("id", safeGoalId)
    .eq("user_id", safeUserId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function updateGoalAiRecommendedBudget(
  userId: string,
  goalId: string,
  aiRecommendedBudget: number
) {
  if (isDesignPreviewMode) {
    return;
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const safeGoalId = assertUuid(goalId, "goal id");
  const { error } = await supabase
    .from("goals")
    .update({ ai_recommended_budget: aiRecommendedBudget })
    .eq("id", safeGoalId)
    .eq("user_id", safeUserId);

  if (error) {
    throw new Error(error.message);
  }
}

async function fetchListWallets(userId: string) {
  if (isDesignPreviewMode) {
    return previewWallets;
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const { data, error } = await supabase
    .from("wallets")
    .select("id, name, budget, created_at, deleted_at")
    .eq("user_id", safeUserId)
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapWallet);
}

export async function getActiveWalletId(userId: string) {
  if (isDesignPreviewMode) {
    return previewWallets[0]?.id ?? null;
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const { data, error } = await supabase
    .from("profiles")
    .select("active_wallet_id")
    .eq("id", safeUserId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data?.active_wallet_id ? String(data.active_wallet_id) : null;
}

export async function setActiveWallet(userId: string, walletId: string | null) {
  if (isDesignPreviewMode) {
    return;
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const safeWalletId = walletId ? assertUuid(walletId, "wallet id") : null;
  const { error } = await supabase
    .from("profiles")
    .upsert(
      {
        id: safeUserId,
        active_wallet_id: safeWalletId,
      },
      { onConflict: "id" }
    );

  if (error) {
    throw new Error(error.message);
  }
}

export async function getActiveWallet(userId: string) {
  if (isDesignPreviewMode) {
    return previewWallets[0] ?? null;
  }

  const safeUserId = assertUuid(userId, "user id");
  const allWallets = await listWallets(safeUserId);
  const wallets = allWallets.filter(w => !w.deletedAt);
  let activeWalletId = await getActiveWalletId(safeUserId);

  if (!activeWalletId && wallets.length === 1) {
    activeWalletId = wallets[0].id;
    await setActiveWallet(safeUserId, activeWalletId);
  }

  if (!activeWalletId) {
    return null;
  }

  return wallets.find((wallet) => wallet.id === activeWalletId) ?? null;
}

export async function addWallet(userId: string, name: string, budget: number) {
  if (isDesignPreviewMode) {
    return {
      id: `preview-wallet-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name: name.trim(),
      budget,
    };
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const { data, error } = await supabase
    .from("wallets")
    .insert({
      user_id: safeUserId,
      name: name.trim(),
      budget,
    })
    .select("id, name, budget")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const wallet = mapWallet(data);
  const wallets = await listWallets(safeUserId);

  if (wallets.length === 1) {
    await setActiveWallet(safeUserId, wallet.id);
  }

  return wallet;
}

export async function updateWallet(
  userId: string,
  walletId: string,
  values: { name?: string; budget?: number }
) {
  if (isDesignPreviewMode) {
    return;
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const safeWalletId = assertUuid(walletId, "wallet id");
  const { error } = await supabase
    .from("wallets")
    .update({
      ...(values.name !== undefined ? { name: values.name.trim() } : {}),
      ...(values.budget !== undefined ? { budget: values.budget } : {}),
    })
    .eq("id", safeWalletId)
    .eq("user_id", safeUserId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteWallet(userId: string, walletId: string) {
  if (isDesignPreviewMode) {
    return;
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const safeWalletId = assertUuid(walletId, "wallet id");
  const { error } = await supabase
    .from("wallets")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", safeWalletId)
    .eq("user_id", safeUserId);

  if (error) {
    throw new Error(error.message);
  }
}

export async function addExpenseWithWalletDeduction(
  userId: string,
  expense: {
    amount: number;
    categoryName?: string;
    date: string;
    description: string;
    goalId?: string | null;
  }
) {
  if (isDesignPreviewMode) {
    return addExpense(userId, {
      ...expense,
      walletId: previewWallets[0]?.id ?? null,
    });
  }

  const supabase = getSupabaseClient();
  const safeUserId = assertUuid(userId, "user id");
  const activeWallet = await getActiveWallet(safeUserId);

  if (!activeWallet) {
    throw new Error("No active wallet. Please create or select a wallet first.");
  }

  const safeGoalId = expense.goalId
    ? assertUuid(expense.goalId, "goal id")
    : null;
  const categoryName = expense.categoryName?.trim() || "Uncategorized";
  const category =
    categoryName === "Uncategorized"
      ? null
      : await getCategoryByName(safeUserId, categoryName);

  // Single transaction: conditional wallet debit + expense insert (see add_expense_atomic).
  const { data, error } = await supabase.rpc("add_expense_atomic", {
    p_wallet_id: activeWallet.id,
    p_amount: expense.amount,
    p_category_id: category?.id ?? null,
    p_category_name: category?.name ?? categoryName,
    p_spent_on: expense.date || null,
    p_description: expense.description,
    p_goal_id: safeGoalId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return mapExpense(data as Record<string, unknown>);
}

export async function deleteExpenseAndRestoreWallet(
  userId: string,
  expenseId: string,
  amount: number
) {
  if (isDesignPreviewMode) {
    return;
  }

  const expenses = await listExpenses(userId);
  const expense = expenses.find((item) => item.id === expenseId);
  await deleteExpense(userId, expenseId);

  const walletId = expense?.walletId;
  if (!walletId) {
    const activeWallet = await getActiveWallet(userId);

    if (!activeWallet) {
      return;
    }

    await updateWallet(userId, activeWallet.id, {
      budget: activeWallet.budget + amount,
    });
    return;
  }

  const wallets = await listWallets(userId);
  const wallet = wallets.find((item) => item.id === walletId);

  if (wallet) {
    await updateWallet(userId, wallet.id, {
      budget: wallet.budget + amount,
    });
  }
}

// PostgREST codes for a missing table / function (and Postgres undefined
// table/function). Income is then reported as "not tracked" instead of failing.
const incomeMissingCodes = new Set(["PGRST205", "PGRST202", "42P01", "42883"]);

function isIncomeMissingError(error: { code?: string } | null) {
  return Boolean(error?.code && incomeMissingCodes.has(error.code));
}

function buildPreviewIncomes(): BuckIncome[] {
  const now = new Date();
  const dateOf = (monthOffset: number, day: number) =>
    toLocalDateString(
      new Date(now.getFullYear(), now.getMonth() + monthOffset, day)
    );

  return [
    {
      id: "preview-income-1",
      walletId: "preview-wallet-main",
      source: "Salary",
      amount: 25000,
      description: "Monthly salary",
      date: dateOf(0, 1),
      createdAt: `${dateOf(0, 1)}T08:00:00.000Z`,
    },
    {
      id: "preview-income-2",
      walletId: "preview-wallet-main",
      source: "Freelance",
      amount: 4500,
      description: "Logo design",
      date: dateOf(0, 2),
      createdAt: `${dateOf(0, 2)}T08:00:00.000Z`,
    },
    {
      id: "preview-income-3",
      walletId: "preview-wallet-main",
      source: "Salary",
      amount: 25000,
      description: "Monthly salary",
      date: dateOf(-1, 1),
      createdAt: `${dateOf(-1, 1)}T08:00:00.000Z`,
    },
  ];
}

/**
 * Lists the user's incomes, newest first. Returns `null` when income tracking
 * is unavailable (table missing), so callers can show "Not tracked yet".
 */
async function fetchListIncomes(
  userId: string,
  options: { since?: string } = {}
): Promise<BuckIncome[] | null> {
  if (isDesignPreviewMode) {
    return buildPreviewIncomes();
  }

  const safeUserId = assertUuid(userId, "user id");
  const since = options.since;
  if (since !== undefined && !/^\d{4}-\d{2}-\d{2}$/.test(since)) {
    throw new Error("Invalid since date.");
  }

  const supabase = getSupabaseClient();
  const pageSize = 1000;
  const rows: Record<string, unknown>[] = [];

  for (let from = 0; ; from += pageSize) {
    let query = supabase
      .from("incomes")
      .select("id, wallet_id, source, amount, description, received_on, created_at")
      .eq("user_id", safeUserId)
      .order("received_on", { ascending: false })
      .order("created_at", { ascending: false })
      .range(from, from + pageSize - 1);

    if (since) {
      query = query.gte("received_on", since);
    }

    const { data, error } = await query;

    if (error) {
      if (isIncomeMissingError(error)) {
        return null;
      }
      throw new Error(error.message);
    }

    rows.push(...(data ?? []));
    if (!data || data.length < pageSize) {
      break;
    }
  }

  return rows.map(mapIncome);
}

/**
 * Records an income and credits the wallet in one transaction via
 * `add_income_atomic`. Never insert into `incomes` directly.
 */
export async function addIncome(
  userId: string,
  income: {
    walletId: string;
    amount: number;
    source: string;
    description?: string;
    date: string;
  }
): Promise<AddIncomeResult> {
  if (isDesignPreviewMode) {
    return {
      incomeId: `preview-income-${Date.now()}`,
      walletId: income.walletId,
      amount: income.amount,
      walletBalance: 0,
    };
  }

  assertUuid(userId, "user id");
  const safeWalletId = assertUuid(income.walletId, "wallet id");
  const amount = Math.round(income.amount * 100) / 100;

  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error("Income amount must be greater than 0.");
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(income.date)) {
    throw new Error("Invalid income date.");
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc("add_income_atomic", {
    p_wallet_id: safeWalletId,
    p_amount: amount,
    p_source: income.source.trim() || "Other",
    p_description: income.description?.trim() ?? "",
    p_received_on: income.date,
  });

  if (error) {
    if (isIncomeMissingError(error)) {
      throw new Error("Income tracking is not available yet.");
    }
    throw new Error(error.message);
  }

  const result = (data ?? {}) as Record<string, unknown>;
  return {
    incomeId: String(result.income_id ?? ""),
    walletId: String(result.wallet_id ?? safeWalletId),
    amount: toNumber(result.amount),
    walletBalance: toNumber(result.wallet_balance),
  };
}

/** Deletes an income and removes its amount from the wallet (never below 0). */
export async function deleteIncome(userId: string, incomeId: string) {
  if (isDesignPreviewMode) {
    return;
  }

  assertUuid(userId, "user id");
  const safeIncomeId = assertUuid(incomeId, "income id");
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc("delete_income_atomic", {
    p_income_id: safeIncomeId,
  });

  if (error) {
    if (isIncomeMissingError(error)) {
      throw new Error("Income tracking is not available yet.");
    }
    throw new Error(error.message);
  }
}

export async function submitFeedback(
  userEmail: string,
  category: string,
  title: string,
  details: string
) {
  if (isDesignPreviewMode) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.from("feedback").insert({
    user_email: userEmail,
    category,
    title,
    details,
  });

  if (error) {
    console.error("Failed to submit feedback:", error);
    throw new Error("Could not submit feedback");
  }
}

export async function getAdminFeedback(): Promise<BuckFeedback[]> {
  if (isDesignPreviewMode) {
    return [];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("feedback")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    console.error("Failed to fetch feedback:", error);
    throw new Error("Could not fetch feedback");
  }

  return data as BuckFeedback[];
}

export async function getLatestAIForecast(
  userId: string,
  periodType: "weekly" | "monthly" | "quarterly" | "custom" = "monthly"
): Promise<BuckAIForecast | null> {
  if (isDesignPreviewMode) {
    return null;
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ai_forecasts")
    .select("*")
    .eq("user_id", safeUserId)
    .eq("period_type", periodType)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch latest AI forecast:", error);
    throw new Error(error.message);
  }

  return data ? mapAIForecast(data as Record<string, unknown>) : null;
}

export async function saveAIForecast(
  userId: string,
  forecast: {
    goalId?: string | null;
    walletId?: string | null;
    periodType: "weekly" | "monthly" | "quarterly" | "custom";
    periodStart: string;
    periodEnd: string;
    projectedSpending: number;
    projectedSavings: number;
    aiRecommendedBudget?: number | null;
    dailyForecast?: Record<string, number>;
    actualSpendingSnapshot?: number;
    summary: string;
    warnings?: string[];
    confidenceScore?: number | null;
    modelName?: string;
    generatedBy?: "on_demand" | "cron" | "system";
    metadata?: Record<string, unknown>;
    expiresAt?: string | null;
  }
): Promise<BuckAIForecast> {
  if (isDesignPreviewMode) {
    throw new Error("Cannot save forecast in design preview mode");
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  const payload = {
    user_id: safeUserId,
    goal_id: forecast.goalId ?? null,
    wallet_id: forecast.walletId ?? null,
    period_type: forecast.periodType,
    period_start: forecast.periodStart,
    period_end: forecast.periodEnd,
    projected_spending: forecast.projectedSpending,
    projected_savings: forecast.projectedSavings,
    ai_recommended_budget: forecast.aiRecommendedBudget ?? null,
    daily_forecast: forecast.dailyForecast ?? {},
    actual_spending_snapshot: forecast.actualSpendingSnapshot ?? 0,
    summary: forecast.summary,
    warnings: forecast.warnings ?? [],
    confidence_score: forecast.confidenceScore ?? null,
    model_name: forecast.modelName ?? "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    generated_by: forecast.generatedBy ?? "on_demand",
    metadata: forecast.metadata ?? {},
    expires_at: forecast.expiresAt ?? null,
  };

  const { data, error } = await supabase
    .from("ai_forecasts")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to save AI forecast:", error);
    throw new Error(error.message);
  }

  return mapAIForecast(data as Record<string, unknown>);
}

export async function getLatestAIAdvisories(
  userId: string,
  limit = 10
): Promise<BuckAIAdvisory[]> {
  if (isDesignPreviewMode) {
    return [];
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("ai_advisories")
    .select("*")
    .eq("user_id", safeUserId)
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    console.error("Failed to fetch AI advisories:", error);
    throw new Error(error.message);
  }

  return (data || []).map((row) => mapAIAdvisory(row as Record<string, unknown>));
}

export async function saveAIAdvisory(
  userId: string,
  advisory: {
    walletId?: string | null;
    goalId?: string | null;
    categoryId?: string | null;
    advisoryType: BuckAIAdvisory["advisoryType"];
    title: string;
    suggestion: string;
    advice: string;
    financialHealthScore?: number | null;
    priority?: BuckAIAdvisory["priority"];
    modelName?: string;
    generatedBy?: "on_demand" | "cron" | "system";
    metadata?: Record<string, unknown>;
    validUntil?: string | null;
  }
): Promise<BuckAIAdvisory> {
  if (isDesignPreviewMode) {
    throw new Error("Cannot save advisory in design preview mode");
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  const payload = {
    user_id: safeUserId,
    wallet_id: advisory.walletId ?? null,
    goal_id: advisory.goalId ?? null,
    category_id: advisory.categoryId ?? null,
    advisory_type: advisory.advisoryType,
    title: advisory.title,
    suggestion: advisory.suggestion,
    advice: advisory.advice,
    financial_health_score: advisory.financialHealthScore ?? null,
    priority: advisory.priority ?? "medium",
    is_read: false,
    is_dismissed: false,
    model_name: advisory.modelName ?? "meta-llama/Llama-3.3-70B-Instruct-Turbo",
    generated_by: advisory.generatedBy ?? "on_demand",
    metadata: advisory.metadata ?? {},
    valid_until: advisory.validUntil ?? null,
  };

  const { data, error } = await supabase
    .from("ai_advisories")
    .insert(payload)
    .select("*")
    .single();

  if (error) {
    console.error("Failed to save AI advisory:", error);
    throw new Error(error.message);
  }

  return mapAIAdvisory(data as Record<string, unknown>);
}

export async function markAIAdvisoryRead(
  userId: string,
  advisoryId: string
): Promise<void> {
  if (isDesignPreviewMode) return;

  const safeUserId = assertUuid(userId, "user id");
  const safeAdvisoryId = assertUuid(advisoryId, "advisory id");
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("ai_advisories")
    .update({ is_read: true })
    .eq("id", safeAdvisoryId)
    .eq("user_id", safeUserId);

  if (error) {
    console.error("Failed to mark advisory as read:", error);
    throw new Error(error.message);
  }
}

export async function dismissAIAdvisory(
  userId: string,
  advisoryId: string
): Promise<void> {
  if (isDesignPreviewMode) return;

  const safeUserId = assertUuid(userId, "user id");
  const safeAdvisoryId = assertUuid(advisoryId, "advisory id");
  const supabase = getSupabaseClient();
  const { error } = await supabase
    .from("ai_advisories")
    .update({ is_dismissed: true })
    .eq("id", safeAdvisoryId)
    .eq("user_id", safeUserId);

  if (error) {
    console.error("Failed to dismiss advisory:", error);
    throw new Error(error.message);
  }
}

// Cached, write-aware wrappers (utils/dataCache.ts). Internals above do the fetch.
export function listExpenses(userId: string) {
  return cachedRead(`expenses:${userId}`, () => fetchListExpenses(userId)).then(copyList);
}

export function listGoals(userId: string) {
  return cachedRead(`goals:${userId}`, () => fetchListGoals(userId)).then(copyList);
}

export function listWallets(userId: string) {
  return cachedRead(`wallets:${userId}`, () => fetchListWallets(userId)).then(copyList);
}

export function listCategories(userId: string) {
  return cachedRead(`categories:${userId}`, () => fetchListCategories(userId)).then(copyList);
}

export async function listIncomes(
  userId: string,
  options: { since?: string } = {}
): Promise<BuckIncome[] | null> {
  const list = await cachedRead(
    `incomes:${userId}:${options.since ?? ""}`,
    () => fetchListIncomes(userId, options)
  );

  return list ? copyList(list) : list;
}

// Connected apps (ADR-049): grants live in Supabase Auth, not a table, so these
// use the auth API. Revoking stops the app at once; a trigger clears Buck's record.
export type ConnectedAppGrant = {
  clientId: string;
  name: string;
  website: string | null;
  logoUrl: string | null;
  scopes: string[];
  grantedAt: string;
};

export async function listConnectedApps(): Promise<ConnectedAppGrant[]> {
  if (isDesignPreviewMode) {
    return [];
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.oauth.listGrants();

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map((grant) => ({
    clientId: grant.client.id,
    name: grant.client.name?.trim() || "Unnamed app",
    website: grant.client.uri?.trim() || null,
    logoUrl: grant.client.logo_uri?.trim() || null,
    scopes: grant.scopes ?? [],
    grantedAt: grant.granted_at,
  }));
}

export async function disconnectConnectedApp(clientId: string) {
  if (isDesignPreviewMode) {
    return;
  }

  const supabase = getSupabaseClient();
  const { error } = await supabase.auth.oauth.revokeGrant({ clientId });

  if (error) {
    throw new Error(error.message);
  }
}
