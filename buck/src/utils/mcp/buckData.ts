import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Read-only queries for the Buck MCP server (ADR-050). Every query runs with
 * the connected app's own token, so RLS limits it to that user's rows and the
 * read-only policies (ADR-049) would refuse any write anyway.
 */

/** Shown to the AI agent; details go to the server log only. */
export class McpDataError extends Error {}

const PAGE_SIZE = 1000; // PostgREST's default max rows per request
export const MAX_SUMMARY_ROWS = 10_000;

export type WalletRow = { id: string; name: string; balance: number; archived: boolean };
export type CategoryRow = { id: string; name: string; kind: "expense" | "income" };
export type ExpenseRow = {
  id: string;
  amount: number;
  categoryId: string | null;
  categoryName: string | null;
  walletId: string | null;
  description: string | null;
  date: string;
};
export type IncomeRow = {
  id: string;
  amount: number;
  categoryId: string | null;
  source: string | null;
  walletId: string | null;
  description: string | null;
  date: string;
};
export type GoalRow = {
  name: string;
  target: number;
  saved: number;
  targetDate: string | null;
  isActive: boolean;
  completed: boolean;
  attitude: string | null;
  createdAt: string;
};
export type AdviceRow = {
  type: string | null;
  title: string | null;
  suggestion: string | null;
  advice: string | null;
  priority: string | null;
  healthScore: number | null;
  createdAt: string;
  validUntil: string | null;
};

type QueryResult<T> = { data: T[] | null; error: { message: string } | null };

function fail(what: string, error: { message: string }): never {
  console.error(`MCP: reading ${what} failed:`, error.message);
  throw new McpDataError(`Buck couldn't read your ${what} right now. Try again.`);
}

const toNumber = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Pages through a query until it runs out or hits `max` rows. */
async function fetchAllRows<T>(
  what: string,
  page: (from: number, to: number) => PromiseLike<QueryResult<T>>,
  max = MAX_SUMMARY_ROWS
): Promise<{ rows: T[]; truncated: boolean }> {
  const rows: T[] = [];

  for (let from = 0; from < max; from += PAGE_SIZE) {
    const { data, error } = await page(from, Math.min(from + PAGE_SIZE, max) - 1);
    if (error) fail(what, error);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { rows, truncated: false };
  }

  return { rows, truncated: true };
}

/** `%` and `_` are wildcards in ILIKE; match them literally. */
export function escapeLike(value: string) {
  return value.replace(/[\\%_]/g, (character) => `\\${character}`);
}

export async function canReadData(db: SupabaseClient): Promise<boolean> {
  const { data, error } = await db.rpc("current_session_can_read");
  if (error) fail("account access", error);
  return data === true;
}

export async function getProfile(db: SupabaseClient) {
  const { data, error } = await db
    .from("profiles")
    .select("username, active_wallet_id")
    .maybeSingle<{ username: string | null; active_wallet_id: string | null }>();
  if (error) fail("profile", error);
  return { username: data?.username ?? null, activeWalletId: data?.active_wallet_id ?? null };
}

export async function getWallets(db: SupabaseClient): Promise<WalletRow[]> {
  const { data, error } = await db
    .from("wallets")
    .select("id, name, budget, deleted_at")
    .order("created_at", { ascending: true });
  if (error) fail("wallets", error);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    balance: toNumber(row.budget),
    archived: Boolean(row.deleted_at),
  }));
}

export async function getCategories(db: SupabaseClient): Promise<CategoryRow[]> {
  const { data, error } = await db
    .from("categories")
    .select("id, name, kind")
    .order("sort_order", { ascending: true });
  if (error) fail("categories", error);
  return (data ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    kind: row.kind === "income" ? "income" : "expense",
  }));
}

export type TransactionFilter = {
  from: string;
  to: string;
  walletId?: string;
  /** Expense category name, matched case-insensitively. */
  categoryName?: string;
  /** Category ids, for income (which has no category name column). */
  categoryIds?: string[];
  search?: string;
};

function mapExpense(row: Record<string, unknown>): ExpenseRow {
  return {
    id: String(row.id),
    amount: toNumber(row.amount),
    categoryId: (row.category_id as string | null) ?? null,
    categoryName: (row.category_name as string | null) ?? null,
    walletId: (row.wallet_id as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    date: String(row.spent_on),
  };
}

function mapIncome(row: Record<string, unknown>): IncomeRow {
  return {
    id: String(row.id),
    amount: toNumber(row.amount),
    categoryId: (row.category_id as string | null) ?? null,
    source: (row.source as string | null) ?? null,
    walletId: (row.wallet_id as string | null) ?? null,
    description: (row.description as string | null) ?? null,
    date: String(row.received_on),
  };
}

function expenseQuery(db: SupabaseClient, filter: TransactionFilter) {
  let query = db
    .from("expenses")
    .select("id, amount, category_id, category_name, wallet_id, description, spent_on")
    .gte("spent_on", filter.from)
    .lte("spent_on", filter.to);
  if (filter.walletId) query = query.eq("wallet_id", filter.walletId);
  if (filter.categoryName) query = query.ilike("category_name", escapeLike(filter.categoryName));
  if (filter.search) query = query.ilike("description", `%${escapeLike(filter.search)}%`);
  return query.order("spent_on", { ascending: false }).order("created_at", { ascending: false });
}

function incomeQuery(db: SupabaseClient, filter: TransactionFilter) {
  let query = db
    .from("incomes")
    .select("id, amount, category_id, source, wallet_id, description, received_on")
    .gte("received_on", filter.from)
    .lte("received_on", filter.to);
  if (filter.walletId) query = query.eq("wallet_id", filter.walletId);
  if (filter.categoryIds) query = query.in("category_id", filter.categoryIds);
  if (filter.search) query = query.ilike("description", `%${escapeLike(filter.search)}%`);
  return query.order("received_on", { ascending: false }).order("created_at", { ascending: false });
}

export async function getExpenses(db: SupabaseClient, filter: TransactionFilter, limit?: number) {
  const { rows, truncated } = await fetchAllRows<Record<string, unknown>>(
    "expenses",
    (from, to) => expenseQuery(db, filter).range(from, to),
    limit ?? MAX_SUMMARY_ROWS
  );
  return { rows: rows.map(mapExpense), truncated };
}

export async function getIncomes(db: SupabaseClient, filter: TransactionFilter, limit?: number) {
  const { rows, truncated } = await fetchAllRows<Record<string, unknown>>(
    "income",
    (from, to) => incomeQuery(db, filter).range(from, to),
    limit ?? MAX_SUMMARY_ROWS
  );
  return { rows: rows.map(mapIncome), truncated };
}

export async function getGoals(db: SupabaseClient): Promise<GoalRow[]> {
  const { data, error } = await db
    .from("goals")
    .select("goal_name, target_amount, current_amount, target_date, is_active, completed, attitude, created_at")
    .order("created_at", { ascending: false });
  if (error) fail("goals", error);
  return (data ?? []).map((row) => ({
    name: row.goal_name,
    target: toNumber(row.target_amount),
    saved: toNumber(row.current_amount),
    targetDate: row.target_date ?? null,
    isActive: Boolean(row.is_active),
    completed: Boolean(row.completed),
    attitude: row.attitude ?? null,
    createdAt: row.created_at,
  }));
}

export async function getSavedAdvice(db: SupabaseClient, limit: number): Promise<AdviceRow[]> {
  const { data, error } = await db
    .from("ai_advisories")
    .select("advisory_type, title, suggestion, advice, priority, financial_health_score, created_at, valid_until")
    .eq("is_dismissed", false)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) fail("saved advice", error);
  return (data ?? []).map((row) => ({
    type: row.advisory_type ?? null,
    title: row.title ?? null,
    suggestion: row.suggestion ?? null,
    advice: row.advice ?? null,
    priority: row.priority ?? null,
    healthScore: row.financial_health_score ?? null,
    createdAt: row.created_at,
    validUntil: row.valid_until ?? null,
  }));
}
