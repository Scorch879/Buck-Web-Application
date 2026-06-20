import { getSupabaseClient } from "@/utils/supabase";
import {
  designPreviewUserId,
  isDesignPreviewMode,
} from "@/utils/designPreview";

export type BuckCategory = {
  id: string;
  name: string;
};

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

type TableName = "wallets" | "categories" | "goals" | "expenses" | "profiles" | "feedback";

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
  };
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

export function subscribeUserTable(
  table: TableName,
  userId: string,
  onChange: () => void
) {
  if (isDesignPreviewMode) {
    return () => {};
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  const userColumn = table === "profiles" ? "id" : "user_id";
  const channel = supabase
    .channel(`${table}:${safeUserId}:${Math.random().toString(36).slice(2)}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table,
        filter: `${userColumn}=eq.${safeUserId}`,
      },
      onChange
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
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

export async function listCategories(userId: string) {
  if (isDesignPreviewMode) {
    return previewCategories;
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("categories")
    .select("id, name, sort_order")
    .eq("user_id", safeUserId)
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapCategory);
}

export async function addCategory(userId: string, name: string) {
  if (isDesignPreviewMode) {
    return {
      id: `preview-category-${name.toLowerCase().replace(/\s+/g, "-")}`,
      name: name.trim(),
    };
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("categories")
    .insert({ user_id: safeUserId, name: name.trim() })
    .select("id, name")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  return mapCategory(data);
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

export async function listExpenses(userId: string) {
  if (isDesignPreviewMode) {
    return previewExpenses;
  }

  const safeUserId = assertUuid(userId, "user id");
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from("expenses")
    .select(
      "id, user_id, wallet_id, goal_id, category_id, category_name, amount, description, spent_on, created_at"
    )
    .eq("user_id", safeUserId)
    .order("spent_on", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(error.message);
  }

  return (data ?? []).map(mapExpense);
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
      spent_on: expense.date || new Date().toISOString().slice(0, 10),
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

export async function listGoals(userId: string) {
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

export async function listWallets(userId: string) {
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

  const activeWallet = await getActiveWallet(userId);

  if (!activeWallet) {
    throw new Error("No active wallet. Please create or select a wallet first.");
  }

  if (expense.amount > activeWallet.budget) {
    throw new Error("Expense exceeds your wallet balance.");
  }

  const savedExpense = await addExpense(userId, {
    ...expense,
    walletId: activeWallet.id,
  });

  await updateWallet(userId, activeWallet.id, {
    budget: activeWallet.budget - expense.amount,
  });

  return savedExpense;
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
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Failed to fetch feedback:", error);
    throw new Error("Could not fetch feedback");
  }

  return data as BuckFeedback[];
}
