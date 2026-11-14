import fs from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import {
  DASHBOARD_ROUTES,
  findDashboardRoute,
  getDashboardDisplayName,
  getDashboardPageChrome,
  getDashboardSkeletonVariant,
  type DashboardNavId,
} from "@/utils/dashboardRoutes";
import {
  BUDGET_CAUTION_RATIO,
  BUDGET_CRITICAL_RATIO,
  BUDGET_LEVEL_COLORS,
  BUDGET_LEVEL_HOVER_COLORS,
  BUDGET_WARNING_REMAINING_PCT,
  CATEGORY_COLORS,
  DEFAULT_CATEGORY_COLOR,
  getBudgetLevel,
  getCategoryColor,
  getShareTier,
} from "@/utils/categoryUtils";
import {
  addMoney,
  formatCurrency,
  parseBudgetInput,
  parseMoneyInput,
  sanitizeBudgetInput,
  toNumber,
} from "@/utils/formatters";
import { computeGoalForecast } from "@/utils/goalForecast";
import { describeVerifyError } from "@/utils/mfa/client";
import {
  mergeDashboardDataCache,
  type DashboardDataCache,
} from "@/context/FinancialContext";

const EXPECTED_ROUTE_ORDER: ReadonlyArray<{
  id: DashboardNavId;
  href: string;
  skeletonVariant: string;
  adminOnly?: boolean;
}> = [
  { id: "home", href: "/dashboard/home", skeletonVariant: "home" },
  { id: "expenses", href: "/dashboard/expenses", skeletonVariant: "expenses" },
  { id: "wallet", href: "/dashboard/wallet", skeletonVariant: "wallet" },
  { id: "categories", href: "/dashboard/categories", skeletonVariant: "categories" },
  {
    id: "advisor",
    href: "/dashboard/financial-advisor",
    skeletonVariant: "financial-advisor",
  },
  { id: "forecast", href: "/dashboard/forecast", skeletonVariant: "forecast" },
  { id: "statistics", href: "/dashboard/statistics", skeletonVariant: "statistics" },
  { id: "goals", href: "/dashboard/goals", skeletonVariant: "goals" },
  {
    id: "admin",
    href: "/dashboard/admin",
    skeletonVariant: "admin",
    adminOnly: true,
  },
  { id: "settings", href: "/dashboard/settings", skeletonVariant: "settings" },
];

describe("dashboardRoutes untangled contract (F5)", () => {
  it("defines all 10 dashboard routes with unique ids, hrefs, variants, and non-empty chrome", () => {
    expect(DASHBOARD_ROUTES).toHaveLength(10);

    const ids = new Set<string>();
    const hrefs = new Set<string>();
    const variants = new Set<string>();

    DASHBOARD_ROUTES.forEach((route, idx) => {
      const expected = EXPECTED_ROUTE_ORDER[idx];
      expect(route.id).toBe(expected.id);
      expect(route.href).toBe(expected.href);
      expect(route.skeletonVariant).toBe(expected.skeletonVariant);
      expect(Boolean(route.adminOnly)).toBe(Boolean(expected.adminOnly));
      expect(route.label.trim().length).toBeGreaterThan(0);
      expect(typeof route.icon).toBe("function");
      expect(route.chrome.title.trim().length).toBeGreaterThan(0);
      expect(route.chrome.eyebrow.trim().length).toBeGreaterThan(0);
      expect(route.chrome.description.trim().length).toBeGreaterThan(0);

      ids.add(route.id);
      hrefs.add(route.href);
      variants.add(route.skeletonVariant);
    });

    expect(ids.size).toBe(10);
    expect(hrefs.size).toBe(10);
    expect(variants.size).toBe(10);
  });

  it("resolves skeleton variants and page chrome across all 10 routes and nested paths", () => {
    for (const route of DASHBOARD_ROUTES) {
      expect(findDashboardRoute(route.href)).toBe(route);
      expect(getDashboardSkeletonVariant(route.href)).toBe(route.skeletonVariant);
      expect(getDashboardPageChrome(route.href)).toEqual(route.chrome);

      const nested = `${route.href}/detail?view=expanded`;
      expect(getDashboardSkeletonVariant(nested)).toBe(route.skeletonVariant);
      expect(getDashboardPageChrome(nested)).toEqual(route.chrome);
    }
  });

  it("falls back cleanly to home for null or unknown dashboard paths", () => {
    const home = DASHBOARD_ROUTES[0];
    for (const unknown of [null, "", "/", "/dashboard", "/dashboard/nonexistent"]) {
      expect(findDashboardRoute(unknown)).toBe(home);
      expect(getDashboardSkeletonVariant(unknown)).toBe("home");
      expect(getDashboardPageChrome(unknown)).toEqual(home.chrome);
    }
  });

  it("resolves display name with profile username -> displayName -> email local-part -> Buck user fallback", () => {
    expect(
      getDashboardDisplayName(
        { profile: { username: "jules_ph" } },
        { displayName: "Jules", email: "jules@example.com" }
      )
    ).toBe("jules_ph");

    expect(
      getDashboardDisplayName(
        { profile: { username: "" } },
        { displayName: "Jules", email: "jules@example.com" }
      )
    ).toBe("Jules");

    expect(
      getDashboardDisplayName(
        {},
        { displayName: null, email: "jules.budget@example.com" }
      )
    ).toBe("jules.budget");

    expect(getDashboardDisplayName({}, { displayName: null, email: null })).toBe(
      "Buck user"
    );
    expect(getDashboardDisplayName({}, undefined)).toBe("Buck user");
  });
});

describe("formatters & wallet budget input helpers (F6)", () => {
  it("sanitizes budget input keeping digits, commas, and at most one decimal point", () => {
    expect(sanitizeBudgetInput("₱12,345.67")).toBe("12,345.67");
    expect(sanitizeBudgetInput("1,200.50.99abc")).toBe("1,200.5099");
    expect(sanitizeBudgetInput("-500.25")).toBe("500.25");
    expect(sanitizeBudgetInput("abc!@#")).toBe("");
    expect(sanitizeBudgetInput("10000")).toBe("10000");
  });

  it("parses valid comma-formatted PHP budgets and rejects non-positive or malformed inputs", () => {
    expect(parseBudgetInput("12,345.67")).toBe(12345.67);
    expect(parseBudgetInput("1,000")).toBe(1000);
    expect(parseBudgetInput("  500.5 ")).toBe(500.5);
    expect(parseBudgetInput("999999999999.99")).toBe(999999999999.99);

    expect(parseBudgetInput("")).toBeNull();
    expect(parseBudgetInput("0")).toBeNull();
    expect(parseBudgetInput("0.00")).toBeNull();
    expect(parseBudgetInput("-100")).toBeNull();
    expect(parseBudgetInput("12.345")).toBeNull();
    expect(parseBudgetInput("1000000000000")).toBeNull();
    expect(parseBudgetInput("not-a-number")).toBeNull();
  });

  it("enforces numeric(14,2) money parsing, centavo addition, and PHP formatting", () => {
    expect(parseMoneyInput("250.5")).toBe(250.5);
    expect(parseMoneyInput("250.555")).toBeNull();
    expect(addMoney(0.1, 0.2)).toBe(0.3);
    expect(toNumber("42.5")).toBe(42.5);
    expect(toNumber(Number.NaN)).toBe(0);
    expect(formatCurrency(75000)).toBe("₱75,000");
    expect(formatCurrency(13222.7)).toBe("₱13,222.70");
    expect(formatCurrency(null)).toBe("₱0");
  });
});

describe("categoryUtils thresholds, colors, and share tiers (F7)", () => {
  it("resolves every built-in category color case-insensitively and falls back safely", () => {
    for (const [name, color] of Object.entries(CATEGORY_COLORS)) {
      expect(getCategoryColor(name)).toBe(color);
      expect(getCategoryColor(`  ${name.toUpperCase()}  `)).toBe(color);
    }
    expect(getCategoryColor("")).toBe(DEFAULT_CATEGORY_COLOR);
    expect(getCategoryColor(undefined)).toBe(DEFAULT_CATEGORY_COLOR);
    expect(getCategoryColor("Unknown Category")).toBe(DEFAULT_CATEGORY_COLOR);
  });

  it("classifies budget levels using exact 80% caution and 100% critical constants", () => {
    expect(BUDGET_CAUTION_RATIO).toBe(0.8);
    expect(BUDGET_CRITICAL_RATIO).toBe(1);
    expect(BUDGET_WARNING_REMAINING_PCT).toBe(20);
    expect(Object.keys(BUDGET_LEVEL_COLORS)).toEqual(["safe", "caution", "critical", "none"]);
    expect(Object.keys(BUDGET_LEVEL_HOVER_COLORS)).toEqual(["safe", "caution", "critical", "none"]);

    expect(getBudgetLevel(100, 0)).toBe("none");
    expect(getBudgetLevel(100, -50)).toBe("none");
    expect(getBudgetLevel(0, 1000)).toBe("safe");
    expect(getBudgetLevel(799.99, 1000)).toBe("safe");
    expect(getBudgetLevel(800, 1000)).toBe("caution");
    expect(getBudgetLevel(999.99, 1000)).toBe("caution");
    expect(getBudgetLevel(1000, 1000)).toBe("critical");
    expect(getBudgetLevel(1500, 1000)).toBe("critical");
  });

  it("maps boundary share percentages across all 6 ShareTier buckets", () => {
    expect(getShareTier(20).tier).toBe("dominant");
    expect(getShareTier(19.99).tier).toBe("high");
    expect(getShareTier(10).tier).toBe("high");
    expect(getShareTier(9.99).tier).toBe("moderate");
    expect(getShareTier(6).tier).toBe("moderate");
    expect(getShareTier(5.99).tier).toBe("low");
    expect(getShareTier(3).tier).toBe("low");
    expect(getShareTier(2.99).tier).toBe("minimal");
    expect(getShareTier(0.01).tier).toBe("minimal");
    expect(getShareTier(0).tier).toBe("zero");
    expect(getShareTier(-3).tier).toBe("zero");
  });
});

type PaginationPage = number | "ellipsis-start" | "ellipsis-end";

function loadGetPaginationPages(): (current: number, total: number) => PaginationPage[] {
  const filePath = path.resolve(process.cwd(), "src/component/Pagination.tsx");
  const source = fs.readFileSync(filePath, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  });
  const mod: { exports: { getPaginationPages?: (c: number, t: number) => PaginationPage[] } } = {
    exports: {},
  };
  const stubRequire = (id: string) => {
    if (id === "framer-motion") return { motion: {} };
    if (id === "react-icons/fa") return { FaChevronLeft: () => null, FaChevronRight: () => null };
    if (id === "react/jsx-runtime") return { jsx: () => null, jsxs: () => null };
    throw new Error(`Unexpected import in Pagination.tsx: ${id}`);
  };
  const fn = new Function("exports", "require", "module", outputText);
  fn(mod.exports, stubRequire, mod);
  if (!mod.exports.getPaginationPages) {
    throw new Error("getPaginationPages export missing from Pagination.tsx");
  }
  return mod.exports.getPaginationPages;
}

describe("Pagination, Skeletons & MFA error helpers (F8)", () => {
  it("computes compact pagination sequences with leading/trailing ellipses", () => {
    const getPaginationPages = loadGetPaginationPages();
    expect(getPaginationPages(1, 1)).toEqual([1]);
    expect(getPaginationPages(3, 7)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(getPaginationPages(1, 12)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 12]);
    expect(getPaginationPages(4, 12)).toEqual([1, 2, 3, 4, 5, "ellipsis-end", 12]);
    expect(getPaginationPages(5, 12)).toEqual([
      1,
      "ellipsis-start",
      4,
      5,
      6,
      "ellipsis-end",
      12,
    ]);
    expect(getPaginationPages(9, 12)).toEqual([
      1,
      "ellipsis-start",
      8,
      9,
      10,
      11,
      12,
    ]);
    expect(getPaginationPages(12, 12)).toEqual([
      1,
      "ellipsis-start",
      8,
      9,
      10,
      11,
      12,
    ]);
  });

  it("maps every DASHBOARD_ROUTES skeletonVariant to an explicit case in DashboardSkeletons", () => {
    const skeletonsIndex = fs.readFileSync(
      path.resolve(process.cwd(), "src/component/skeletons/index.tsx"),
      "utf8"
    );
    for (const route of DASHBOARD_ROUTES) {
      expect(skeletonsIndex).toContain(`case "${route.skeletonVariant}":`);
    }
  });

  it("maps Supabase MFA verification errors to user-friendly messages", () => {
    expect(describeVerifyError(null)).toBe("We couldn't check that code. Please try again.");
    expect(describeVerifyError(undefined)).toBe("We couldn't check that code. Please try again.");
    expect(describeVerifyError({ status: 429 })).toContain("Too many tries");
    expect(describeVerifyError({ code: "over_request_rate_limit" })).toContain("Too many tries");
    expect(describeVerifyError({ code: "mfa_verification_failed" })).toContain(
      "That code didn't work"
    );
    expect(describeVerifyError({ message: "Token has expired" })).toContain(
      "That code didn't work"
    );
    expect(describeVerifyError({ message: "Invalid TOTP code" })).toContain(
      "That code didn't work"
    );
    expect(describeVerifyError({ message: "Service unavailable" })).toBe("Service unavailable");
    expect(describeVerifyError({})).toBe("We couldn't check that code. Please try again.");
  });
});

describe("mergeDashboardDataCache Object.is referential stability (F1)", () => {
  it("returns the exact same reference when userId matches and all patched values are Object.is equal", () => {
    const expenses = [] as NonNullable<DashboardDataCache["expenses"]>;
    const initial: DashboardDataCache = {
      userId: "user-1",
      expenses,
      activeWalletId: null,
      activeWalletBudget: Number.NaN,
      updatedAt: 1234567890,
    };

    const unchanged = mergeDashboardDataCache(initial, "user-1", {
      expenses,
      activeWalletId: null,
      activeWalletBudget: Number.NaN,
    });

    expect(Object.is(unchanged, initial)).toBe(true);
    expect(unchanged.updatedAt).toBe(1234567890);
  });

  it("returns a new object with updatedAt when any patched key changes by Object.is", () => {
    const prevExpenses = [] as NonNullable<DashboardDataCache["expenses"]>;
    const nextExpenses = [] as NonNullable<DashboardDataCache["expenses"]>;
    const initial: DashboardDataCache = {
      userId: "user-1",
      expenses: prevExpenses,
      activeWalletBudget: 5000,
      updatedAt: 1000,
    };

    const updated = mergeDashboardDataCache(initial, "user-1", {
      expenses: nextExpenses,
    });

    expect(updated).not.toBe(initial);
    expect(updated.userId).toBe("user-1");
    expect(updated.expenses).toBe(nextExpenses);
    expect(updated.activeWalletBudget).toBe(5000);
    expect(updated.updatedAt).toBeGreaterThanOrEqual(1000);
  });

  it("resets cached slices from a previous user when userId changes", () => {
    const user1Cache: DashboardDataCache = {
      userId: "user-1",
      activeWalletId: "wallet-1",
      activeWalletBudget: 8000,
      updatedAt: 1000,
    };

    const user2Cache = mergeDashboardDataCache(user1Cache, "user-2", {
      activeWalletBudget: 2500,
    });

    expect(user2Cache).not.toBe(user1Cache);
    expect(user2Cache.userId).toBe("user-2");
    expect(user2Cache.activeWalletBudget).toBe(2500);
    expect(user2Cache.activeWalletId).toBeUndefined();
  });
});

describe("goalForecast integration invariants", () => {
  it("applies Normal/Moderate/Aggressive attitude multipliers and caps horizon at 3650 days", () => {
    const today = new Date("2026-10-14T00:00:00");
    const base = {
      goalName: "Emergency Fund",
      targetAmount: 100000,
      currentAmount: 10000,
      targetDate: "2027-01-12", // 90 days -> monthly period
    };

    const normal = computeGoalForecast({ ...base, attitude: "Normal" }, today);
    const moderate = computeGoalForecast({ ...base, attitude: "Moderate" }, today);
    const aggressive = computeGoalForecast({ ...base, attitude: "Aggressive" }, today);

    expect(normal.days_left).toBe(90);
    expect(normal.recommended_period).toBe("month");
    expect(normal.ai_recommended_budget).toBe(30000);
    expect(moderate.ai_recommended_budget).toBe(34500);
    expect(aggressive.ai_recommended_budget).toBe(39000);

    const farFuture = computeGoalForecast(
      { ...base, targetDate: "2040-10-14" },
      today
    );
    expect(farFuture.days_left).toBe(3650);

    const completed = computeGoalForecast(
      { ...base, currentAmount: 120000, targetDate: "2026-12-01" },
      today
    );
    expect(completed.remaining).toBe(0);
    expect(completed.ai_recommended_budget).toBeNull();
  });
});
