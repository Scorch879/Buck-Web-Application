import type { SupabaseClient } from "@supabase/supabase-js";
import { McpServer, type CallToolResult } from "@modelcontextprotocol/server";
import * as z from "zod/v4";
import {
  McpDataError,
  canReadData,
  getCategories,
  getExpenses,
  getGoals,
  getIncomes,
  getProfile,
  getSavedAdvice,
  getWallets,
  type ExpenseRow,
  type GoalRow,
  type IncomeRow,
  type WalletRow,
} from "@/utils/mcp/buckData";
import { addDays, daysInclusive, isDayKey, manilaToday, monthStart } from "@/utils/mcp/dates";

/**
 * The Buck MCP server (ADR-050): read-only tools over the signed-in user's
 * own data for AI agents the user connected (Claude, ChatGPT, Cursor, ...).
 * No tool writes, and none calls Gemini: Buck_AI stays for Buck's own apps.
 */

export const MCP_SERVER_INFO = { name: "buck", title: "Buck", version: "1.0.0" };

const MAX_RANGE_DAYS = 731;

export const RECONNECT_MESSAGE =
  "This app can't read Buck data yet: the account has two-factor authentication on, and the app " +
  "was connected without it. In Buck, open Settings > Connected apps, disconnect this app, then " +
  "connect it again and enter the 2FA code when asked.";

const INSTRUCTIONS = [
  "Buck is a personal budget tracker from the Philippines. All amounts are Philippine pesos (PHP, ₱).",
  "Dates are Philippine calendar days (YYYY-MM-DD). Access is read-only: you cannot add, change or delete anything.",
  "Start with get_overview. Use list_wallets / list_categories to find ids and names for filters.",
  "A wallet's balance is the money currently in it.",
].join(" ");

const round2 = (value: number) => Math.round(value * 100) / 100;
const percent = (part: number, whole: number) => (whole > 0 ? round2((part / whole) * 100) : 0);

// ---------------------------------------------------------------------------
// Pure helpers (unit-tested)

export type Period = { from: string; to: string };

/** Validates a requested period, defaulting to `fallback`. Throws McpDataError. */
export function resolvePeriod(from: string | undefined, to: string | undefined, fallback: Period): Period {
  const period = { from: from ?? fallback.from, to: to ?? fallback.to };

  if (!isDayKey(period.from) || !isDayKey(period.to)) {
    throw new McpDataError("Dates must be real calendar days written as YYYY-MM-DD.");
  }
  if (period.from > period.to) {
    throw new McpDataError("`from` must be on or before `to`.");
  }
  if (daysInclusive(period.from, period.to) > MAX_RANGE_DAYS) {
    throw new McpDataError("Ask for at most two years at a time.");
  }

  return period;
}

export type GroupBy = "category" | "wallet" | "month" | "day";

export type SpendingGroup = { key: string; spent: number; sharePercent: number; count: number };

export function groupSpending(
  expenses: ExpenseRow[],
  groupBy: GroupBy,
  names: { wallets: Map<string, string>; categories: Map<string, string> }
): SpendingGroup[] {
  const groups = new Map<string, { spent: number; count: number }>();
  const total = expenses.reduce((sum, row) => sum + row.amount, 0);

  for (const row of expenses) {
    const key =
      groupBy === "category"
        ? row.categoryName || (row.categoryId && names.categories.get(row.categoryId)) || "Uncategorized"
        : groupBy === "wallet"
          ? (row.walletId && names.wallets.get(row.walletId)) || "No wallet"
          : groupBy === "month"
            ? row.date.slice(0, 7)
            : row.date;
    const group = groups.get(key) ?? { spent: 0, count: 0 };
    group.spent += row.amount;
    group.count += 1;
    groups.set(key, group);
  }

  const result = [...groups].map(([key, group]) => ({
    key,
    spent: round2(group.spent),
    sharePercent: percent(group.spent, total),
    count: group.count,
  }));

  // Time groups read in order; the others biggest first.
  return groupBy === "month" || groupBy === "day"
    ? result.sort((a, b) => a.key.localeCompare(b.key))
    : result.sort((a, b) => b.spent - a.spent || a.key.localeCompare(b.key));
}

export function describeGoal(goal: GoalRow, today: string) {
  const remaining = round2(Math.max(goal.target - goal.saved, 0));
  const daysLeft = goal.targetDate ? daysInclusive(today, goal.targetDate) - 1 : null;
  const open = !goal.completed && remaining > 0;

  return {
    name: goal.name,
    status: goal.completed ? "completed" : goal.isActive ? "active" : "inactive",
    target: round2(goal.target),
    saved: round2(goal.saved),
    remaining,
    progressPercent: Math.min(percent(goal.saved, goal.target), 100),
    targetDate: goal.targetDate,
    daysLeft,
    // Plain pace: what is left spread over the weeks left (at least one).
    neededPerWeek:
      open && daysLeft !== null && daysLeft > 0 ? round2(remaining / Math.max(daysLeft / 7, 1)) : null,
    overdue: open && daysLeft !== null && daysLeft < 0,
    savingAttitude: goal.attitude,
  };
}

export function mergeTransactions(
  expenses: ExpenseRow[],
  incomes: IncomeRow[],
  names: { wallets: Map<string, string>; categories: Map<string, string> },
  limit: number
) {
  const rows = [
    ...expenses.map((row) => ({
      type: "expense" as const,
      date: row.date,
      amount: round2(row.amount),
      category: row.categoryName || (row.categoryId && names.categories.get(row.categoryId)) || "Uncategorized",
      wallet: (row.walletId && names.wallets.get(row.walletId)) || null,
      description: row.description || null,
      id: row.id,
    })),
    ...incomes.map((row) => ({
      type: "income" as const,
      date: row.date,
      amount: round2(row.amount),
      category: (row.categoryId && names.categories.get(row.categoryId)) || row.source || "Other",
      wallet: (row.walletId && names.wallets.get(row.walletId)) || null,
      description: row.description || null,
      id: row.id,
    })),
  ];

  // Same-day rows keep each table's newest-first order.
  rows.sort((a, b) => b.date.localeCompare(a.date));
  return { transactions: rows.slice(0, limit), hasMore: rows.length > limit };
}

function nameMaps(wallets: WalletRow[], categories: { id: string; name: string }[]) {
  return {
    wallets: new Map(wallets.map((wallet) => [wallet.id, wallet.name])),
    categories: new Map(categories.map((category) => [category.id, category.name])),
  };
}

// ---------------------------------------------------------------------------
// Server

function ok(value: object): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify({ currency: "PHP", ...value }, null, 2) }] };
}

function toolError(message: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text: message }] };
}

const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

const dayKey = z.string().describe("A day as YYYY-MM-DD (Philippine calendar).");
const walletId = z.string().uuid().describe("A wallet id from list_wallets.");

export function createBuckMcpServer(db: SupabaseClient, now = new Date()): McpServer {
  const server = new McpServer(MCP_SERVER_INFO, { instructions: INSTRUCTIONS });
  const today = manilaToday(now);
  const thisMonth = { from: monthStart(today), to: today };
  let access: Promise<boolean> | null = null;

  // Every tool: check the 2FA rule once per request, then run; data errors
  // become tool errors the agent can relay.
  const run = async (body: () => Promise<CallToolResult>): Promise<CallToolResult> => {
    try {
      access ??= canReadData(db);
      if (!(await access)) return toolError(RECONNECT_MESSAGE);
      return await body();
    } catch (error) {
      if (error instanceof McpDataError) return toolError(error.message);
      console.error("MCP tool failed:", error);
      return toolError("Something went wrong in Buck. Try again.");
    }
  };

  server.registerTool(
    "get_overview",
    {
      title: "Buck overview",
      description:
        "Snapshot of the user's finances: wallets and total balance, this month's spending and income so far, " +
        "top spending categories this month, and the active savings goal.",
      annotations: READ_ONLY,
    },
    () =>
      run(async () => {
        const [profile, wallets, categories, goals, expenses, incomes] = await Promise.all([
          getProfile(db),
          getWallets(db),
          getCategories(db),
          getGoals(db),
          getExpenses(db, thisMonth),
          getIncomes(db, thisMonth),
        ]);
        const names = nameMaps(wallets, categories);
        const open = wallets.filter((wallet) => !wallet.archived);
        const spent = expenses.rows.reduce((sum, row) => sum + row.amount, 0);
        const earned = incomes.rows.reduce((sum, row) => sum + row.amount, 0);
        const activeGoal = goals.find((goal) => goal.isActive && !goal.completed);

        return ok({
          today,
          username: profile.username,
          totalBalance: round2(open.reduce((sum, wallet) => sum + wallet.balance, 0)),
          activeWallet: (profile.activeWalletId && names.wallets.get(profile.activeWalletId)) || null,
          wallets: open.map((wallet) => ({ name: wallet.name, balance: round2(wallet.balance) })),
          thisMonth: {
            ...thisMonth,
            spent: round2(spent),
            income: round2(earned),
            net: round2(earned - spent),
            expenseCount: expenses.rows.length,
            topCategories: groupSpending(expenses.rows, "category", names).slice(0, 5),
          },
          activeGoal: activeGoal ? describeGoal(activeGoal, today) : null,
        });
      })
  );

  server.registerTool(
    "list_wallets",
    {
      title: "List wallets",
      description: "The user's wallets (cash, bank, e-wallet) with their current balances and ids.",
      inputSchema: z.object({
        includeArchived: z.boolean().optional().describe("Also list deleted (archived) wallets. Default false."),
      }),
      annotations: READ_ONLY,
    },
    ({ includeArchived }) =>
      run(async () => {
        const wallets = (await getWallets(db)).filter((wallet) => includeArchived || !wallet.archived);
        return ok({
          wallets: wallets.map((wallet) => ({ ...wallet, balance: round2(wallet.balance) })),
          totalBalance: round2(wallets.filter((w) => !w.archived).reduce((sum, w) => sum + w.balance, 0)),
        });
      })
  );

  server.registerTool(
    "list_categories",
    {
      title: "List categories",
      description: "The user's own expense and income categories (names are user-defined).",
      annotations: READ_ONLY,
    },
    () =>
      run(async () => {
        const categories = await getCategories(db);
        return ok({
          expense: categories.filter((c) => c.kind === "expense").map((c) => c.name),
          income: categories.filter((c) => c.kind === "income").map((c) => c.name),
        });
      })
  );

  server.registerTool(
    "list_transactions",
    {
      title: "List transactions",
      description:
        "Expenses and/or income, newest first. Defaults to the last 30 days. Filter by wallet, category name " +
        "or a word in the description. Returns at most `limit` rows and says whether there are more.",
      inputSchema: z.object({
        type: z.enum(["all", "expense", "income"]).optional().describe("Default all."),
        from: dayKey.optional(),
        to: dayKey.optional(),
        walletId: walletId.optional(),
        category: z.string().trim().min(1).max(80).optional().describe("Category name, any case."),
        search: z.string().trim().min(1).max(80).optional().describe("Text to find in descriptions."),
        limit: z.number().int().min(1).max(100).optional().describe("Default 50, max 100."),
      }),
      annotations: READ_ONLY,
    },
    (args) =>
      run(async () => {
        const period = resolvePeriod(args.from, args.to, { from: addDays(today, -29), to: today });
        const limit = args.limit ?? 50;
        const type = args.type ?? "all";
        const [wallets, categories] = await Promise.all([getWallets(db), getCategories(db)]);
        const names = nameMaps(wallets, categories);
        const category = args.category?.toLowerCase();
        const incomeCategoryIds = category
          ? categories.filter((c) => c.kind === "income" && c.name.toLowerCase() === category).map((c) => c.id)
          : undefined;
        const base = { ...period, walletId: args.walletId, search: args.search };

        const [expenses, incomes] = await Promise.all([
          type === "income" ? null : getExpenses(db, { ...base, categoryName: args.category }, limit + 1),
          type === "expense" || incomeCategoryIds?.length === 0
            ? null
            : getIncomes(db, { ...base, categoryIds: incomeCategoryIds }, limit + 1),
        ]);

        return ok({
          period,
          ...mergeTransactions(expenses?.rows ?? [], incomes?.rows ?? [], names, limit),
        });
      })
  );

  server.registerTool(
    "spending_summary",
    {
      title: "Spending summary",
      description:
        "Totals for a period (default: this month so far): spending, income, net, daily average, and spending " +
        "grouped by category, wallet, month or day.",
      inputSchema: z.object({
        from: dayKey.optional(),
        to: dayKey.optional(),
        walletId: walletId.optional(),
        groupBy: z.enum(["category", "wallet", "month", "day"]).optional().describe("Default category."),
      }),
      annotations: READ_ONLY,
    },
    (args) =>
      run(async () => {
        const period = resolvePeriod(args.from, args.to, thisMonth);
        const filter = { ...period, walletId: args.walletId };
        const [wallets, categories, expenses, incomes] = await Promise.all([
          getWallets(db),
          getCategories(db),
          getExpenses(db, filter),
          getIncomes(db, filter),
        ]);
        const spent = expenses.rows.reduce((sum, row) => sum + row.amount, 0);
        const earned = incomes.rows.reduce((sum, row) => sum + row.amount, 0);

        return ok({
          period,
          days: daysInclusive(period.from, period.to),
          spent: round2(spent),
          income: round2(earned),
          net: round2(earned - spent),
          dailyAverageSpent: round2(spent / daysInclusive(period.from, period.to)),
          expenseCount: expenses.rows.length,
          incomeCount: incomes.rows.length,
          groupBy: args.groupBy ?? "category",
          groups: groupSpending(expenses.rows, args.groupBy ?? "category", nameMaps(wallets, categories)),
          ...(expenses.truncated || incomes.truncated
            ? { note: "Too many transactions: only the newest 10,000 of each kind were counted. Use a shorter period." }
            : {}),
        });
      })
  );

  server.registerTool(
    "list_goals",
    {
      title: "List savings goals",
      description:
        "The user's savings goals with progress, days left and the plain weekly amount still needed to finish on time.",
      annotations: READ_ONLY,
    },
    () =>
      run(async () => {
        const goals = await getGoals(db);
        return ok({ today, goals: goals.map((goal) => describeGoal(goal, today)) });
      })
  );

  server.registerTool(
    "get_saved_advice",
    {
      title: "Buck AI advice",
      description:
        "The latest advice Buck's AI Financial Advisor already saved for the user (not dismissed). " +
        "Read-only: this does not generate new advice.",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(10).optional().describe("Default 3."),
      }),
      annotations: READ_ONLY,
    },
    ({ limit }) => run(async () => ok({ advice: await getSavedAdvice(db, limit ?? 3) }))
  );

  return server;
}
