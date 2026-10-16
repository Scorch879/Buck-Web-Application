"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  FaCheck,
  FaChevronLeft,
  FaChevronRight,
  FaEdit,
  FaListUl,
  FaMagic,
  FaPlus,
  FaSearch,
  FaTimes,
  FaTrash,
} from "react-icons/fa";
import { categorizeItems } from "@/utils/aiApi";
import "./style.css";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import DangerDeleteDialog from "@/component/DangerDeleteDialog";
import { useToast } from "@/component/toast/ToastContext";
import { useDashboardUser } from "@/context/DashboardUserContext";
import { mergeDashboardDataCache, useFinancial } from "@/context/FinancialContext";
import { formatCurrency } from "@/utils/formatters";
import { getCategoryTheme } from "@/app/dashboard/expenses/categoryUtils";
import {
  addCategory,
  deleteCategoryAndReassign,
  ensureDefaultCategories,
  incomeSources,
  listExpenses,
  listIncomeCategories,
  listIncomes,
  renameCategory,
  setExpenseCategory,
  setIncomeCategory,
  UNCATEGORIZED_EXPENSE,
  UNCATEGORIZED_INCOME,
  type BuckCategory,
  type BuckExpense,
  type BuckIncome,
  type CategoryKind,
} from "@/utils/supabaseData";

type EntryItemSummary = {
  id: string;
  description: string;
  amount: number;
  date: string;
};

type Row = {
  category: BuckCategory;
  entries: number;
  total: number;
  avg: number;
  max: number;
  share: number;
  isFallback: boolean;
  recentEntries: EntryItemSummary[];
};

/** Max items sent to the AI Advisor per "Auto-categorize" click (one request). */
const AUTO_CATEGORIZE_BATCH = 25;

/** Categories per page to prevent long vertical scrolling. */
const PAGE_SIZE = 8;

const PAGE_VARIANTS = {
  enter: {
    opacity: 0,
  },
  center: {
    opacity: 1,
  },
  exit: {
    opacity: 0,
  },
};

function getPaginationPages(
  current: number,
  total: number
): (number | "ellipsis-start" | "ellipsis-end")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-end", total];
  }
  if (current >= total - 3) {
    return [
      1,
      "ellipsis-start",
      total - 4,
      total - 3,
      total - 2,
      total - 1,
      total,
    ];
  }
  return [
    1,
    "ellipsis-start",
    current - 1,
    current,
    current + 1,
    "ellipsis-end",
    total,
  ];
}

function getShareTier(share: number): {
  tier: "dominant" | "high" | "moderate" | "low" | "minimal" | "zero";
  gradient: string;
  textColor: string;
  trackBg: string;
} {
  if (share >= 20) {
    return {
      tier: "dominant",
      gradient: "linear-gradient(90deg, #ff7a45 0%, #ef4444 100%)",
      textColor: "#f87171",
      trackBg: "rgba(239, 68, 68, 0.14)",
    };
  }
  if (share >= 10) {
    return {
      tier: "high",
      gradient: "linear-gradient(90deg, #ffc547 0%, #f47536 100%)",
      textColor: "var(--buck-orange)",
      trackBg: "rgba(244, 117, 54, 0.14)",
    };
  }
  if (share >= 6) {
    return {
      tier: "moderate",
      gradient: "linear-gradient(90deg, #fde047 0%, #eab308 100%)",
      textColor: "#facc15",
      trackBg: "rgba(234, 179, 8, 0.14)",
    };
  }
  if (share >= 3) {
    return {
      tier: "low",
      gradient: "linear-gradient(90deg, #34d399 0%, #10b981 100%)",
      textColor: "#34d399",
      trackBg: "rgba(16, 185, 129, 0.14)",
    };
  }
  if (share > 0) {
    return {
      tier: "minimal",
      gradient: "linear-gradient(90deg, #38bdf8 0%, #0ea5e9 100%)",
      textColor: "#38bdf8",
      trackBg: "rgba(14, 165, 233, 0.14)",
    };
  }
  return {
    tier: "zero",
    gradient: "rgba(148, 163, 184, 0.25)",
    textColor: "var(--buck-muted)",
    trackBg: "rgba(148, 163, 184, 0.12)",
  };
}

export default function CategoriesPage() {
  const { user } = useDashboardUser();
  const { toast } = useToast();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const userCache = dashboardCache.userId === user.uid ? dashboardCache : {};

  const [kind, setKind] = useState<CategoryKind>("expense");
  const [expenseCategories, setExpenseCategories] = useState<BuckCategory[]>(
    () => userCache.categories ?? []
  );
  // null = income categories unavailable (migration 202610130002 not applied).
  const [incomeCategories, setIncomeCategories] = useState<BuckCategory[] | null>([]);
  const [expenses, setExpenses] = useState<BuckExpense[]>(() => userCache.expenses ?? []);
  const [incomes, setIncomes] = useState<BuckIncome[]>(() => userCache.incomes ?? []);
  const [loading, setLoading] = useState(
    () => !(userCache.categories && userCache.expenses)
  );

  const [query, setQuery] = useState("");
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoResult, setAutoResult] = useState("");
  const [showAiTooltip, setShowAiTooltip] = useState(false);
  const [hoveredEntriesId, setHoveredEntriesId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageDirection, setPageDirection] = useState(0);
  const hadCache = useRef(Boolean(userCache.categories && userCache.expenses));

  const load = useCallback(async () => {
    const [cats, incCats, exps, incs] = await Promise.all([
      ensureDefaultCategories(user.uid),
      listIncomeCategories(user.uid),
      listExpenses(user.uid),
      listIncomes(user.uid),
    ]);
    const sortedCats = [...cats].sort((a, b) => a.name.localeCompare(b.name));
    setExpenseCategories(sortedCats);
    setIncomeCategories(incCats);
    setExpenses(exps);
    setIncomes(incs ?? []);
    setDashboardCache((current) =>
      mergeDashboardDataCache(current, user.uid, {
        categories: sortedCats,
        expenses: exps,
        ...(incs !== null ? { incomes: incs } : {}),
      })
    );
  }, [setDashboardCache, user.uid]);

  useEffect(() => {
    let active = true;
    if (!hadCache.current) setLoading(true);
    load()
      .catch((err) => {
        console.error("Failed to load categories:", err);
        if (active) toast("Failed to load categories", "error");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [load, toast]);

  // Reset pagination to page 1 when search query or category kind changes
  useEffect(() => {
    setPageDirection(0);
    setCurrentPage(1);
  }, [query, kind]);

  const incomeSupported = incomeCategories !== null;
  // Before the migration, income "categories" are the fixed source list.
  const effectiveIncomeCategories: BuckCategory[] = useMemo(
    () =>
      incomeCategories ??
      incomeSources.map((name) => ({ id: `fixed-${name}`, name, kind: "income" as const })),
    [incomeCategories]
  );

  const categories = kind === "expense" ? expenseCategories : effectiveIncomeCategories;
  const fallbackName = kind === "expense" ? UNCATEGORIZED_EXPENSE : UNCATEGORIZED_INCOME;
  const canEdit = kind === "expense" || incomeSupported;

  // Usage per category (by name: expenses.category_name / incomes.source) + summarized entries.
  const rows: Row[] = useMemo(() => {
    const usage = new Map<
      string,
      {
        entries: number;
        total: number;
        max: number;
        items: EntryItemSummary[];
      }
    >();

    const rawItems =
      kind === "expense"
        ? expenses.map((e) => ({
            id: e.id,
            name: e.category || UNCATEGORIZED_EXPENSE,
            amount: Number(e.amount) || 0,
            description: e.description || e.category || UNCATEGORIZED_EXPENSE,
            date: e.date || "",
          }))
        : incomes.map((i) => ({
            id: i.id,
            name: i.source || UNCATEGORIZED_INCOME,
            amount: Number(i.amount) || 0,
            description: i.description || i.source || UNCATEGORIZED_INCOME,
            date: i.date || "",
          }));

    let grand = 0;
    rawItems.forEach(({ id, name, amount, description, date }) => {
      const key = name.toLowerCase();
      const cur = usage.get(key) ?? { entries: 0, total: 0, max: 0, items: [] };
      cur.entries += 1;
      cur.total += amount;
      if (amount > cur.max) cur.max = amount;
      cur.items.push({ id, description, amount, date });
      grand += amount;
      usage.set(key, cur);
    });

    return categories.map((category) => {
      const u = usage.get(category.name.toLowerCase()) ?? {
        entries: 0,
        total: 0,
        max: 0,
        items: [],
      };
      const sortedEntries = [...u.items]
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 4);

      return {
        category,
        entries: u.entries,
        total: u.total,
        avg: u.entries > 0 ? u.total / u.entries : 0,
        max: u.max,
        share: grand > 0 ? (u.total / grand) * 100 : 0,
        isFallback: category.name.toLowerCase() === fallbackName.toLowerCase(),
        recentEntries: sortedEntries,
      };
    });
  }, [categories, expenses, fallbackName, incomes, kind]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.category.name.toLowerCase().includes(q))
      .sort((a, b) => b.total - a.total || a.category.name.localeCompare(b.category.name));
  }, [query, rows]);

  // Pagination slice
  const totalItems = visibleRows.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const paginatedRows = visibleRows.slice(startIndex, endIndex);

  const handlePageChange = (nextPage: number) => {
    if (nextPage === safeCurrentPage || nextPage < 1 || nextPage > totalPages) return;
    setPageDirection(nextPage > safeCurrentPage ? 1 : -1);
    setEditingId(null);
    setHoveredEntriesId(null);
    setCurrentPage(nextPage);
  };

  // Items with no real category (AI auto-categorize input).
  const uncategorized = useMemo(() => {
    if (kind === "expense") {
      return expenses
        .filter((e) => !e.category || e.category === UNCATEGORIZED_EXPENSE)
        .map((e) => ({ id: e.id, text: e.description, amount: e.amount }));
    }
    const known = new Set(effectiveIncomeCategories.map((c) => c.name.toLowerCase()));
    return incomes
      .filter((i) => i.source === UNCATEGORIZED_INCOME || !known.has(i.source.toLowerCase()))
      .map((i) => ({ id: i.id, text: i.description || i.source, amount: i.amount }));
  }, [effectiveIncomeCategories, expenses, incomes, kind]);
  const uncategorizedTotal = uncategorized.reduce((s, u) => s + (Number(u.amount) || 0), 0);

  const switchKind = (next: CategoryKind) => {
    setKind(next);
    setQuery("");
    setIsAddOpen(false);
    setNewName("");
    setEditingId(null);
    setHoveredEntriesId(null);
    setAutoResult("");
  };

  // AI Financial Advisor auto-categorize: one Buck_AI request per batch.
  const handleAutoCategorize = async () => {
    if (autoRunning || uncategorized.length === 0) return;
    setAutoRunning(true);
    setAutoResult("");
    const batch = uncategorized.slice(0, AUTO_CATEGORIZE_BATCH);
    let filed = 0;
    try {
      const matches = await categorizeItems(kind, batch.map((item) => item.text ?? ""));
      for (const [index, item] of batch.entries()) {
        const match = matches[index];
        if (!match || match.toLowerCase() === fallbackName.toLowerCase()) continue;
        if (kind === "expense") {
          const cat = categories.find((c) => c.name.toLowerCase() === match.toLowerCase());
          if (!cat) continue;
          await setExpenseCategory(user.uid, item.id, cat);
        } else {
          await setIncomeCategory(user.uid, item.id, match);
        }
        filed += 1;
      }
      await load();
      const left = uncategorized.length - filed;
      const msg =
        `AI filed ${filed} of ${batch.length} checked. ${left} still uncategorized` +
        (uncategorized.length > batch.length ? ` (runs ${AUTO_CATEGORIZE_BATCH} at a time).` : ".");
      setAutoResult(msg);
      toast(msg, "success");
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : "Auto-categorize failed.";
      setAutoResult(errMsg);
      toast(errMsg, "error");
    } finally {
      setAutoRunning(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newName.trim();
    if (!name || adding) return;
    if (categories.some((c) => c.name.toLowerCase() === name.toLowerCase())) {
      toast(`"${name}" already exists`, "warning");
      return;
    }
    setAdding(true);
    try {
      await addCategory(user.uid, name, kind);
      setNewName("");
      setIsAddOpen(false);
      await load();
      toast(`Added "${name}"`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to add category", "error");
    } finally {
      setAdding(false);
    }
  };

  const handleRename = async (row: Row) => {
    const name = editName.trim();
    if (!name || name === row.category.name) {
      setEditingId(null);
      return;
    }
    try {
      await renameCategory(user.uid, { ...row.category, kind }, name);
      setEditingId(null);
      await load();
      toast(`Renamed to "${name}"`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to rename category", "error");
    }
  };

  const handleDelete = async (row: Row) => {
    const fallback = categories.find((c) => c.name.toLowerCase() === fallbackName.toLowerCase()) ?? null;
    try {
      const moved = await deleteCategoryAndReassign(user.uid, { ...row.category, kind }, fallback);
      setPendingDelete(null);
      await load();
      toast(
        moved > 0
          ? `Deleted "${row.category.name}"; ${moved} moved to ${fallbackName}`
          : `Deleted "${row.category.name}"`,
        "success"
      );
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete category", "error");
    }
  };

  if (loading) {
    return <DashboardPageSkeleton variant="categories" />;
  }

  const noun = kind === "expense" ? "expense" : "income";
  const nounCapitalized = kind === "expense" ? "Expense" : "Income";

  return (
    <div className="cat-page">
      <header className="cat-card cat-header">
        <div className="cat-heading">
          <p className="cat-eyebrow">Categories</p>
          <h2>{kind === "expense" ? "Expense categories" : "Income categories"}</h2>
        </div>
        <div className="cat-segmented" role="tablist" aria-label="Category type">
          <button
            type="button"
            role="tab"
            aria-selected={kind === "expense"}
            className="cat-segmented-btn"
            onClick={() => switchKind("expense")}
          >
            Expense <span className="cat-count">{expenseCategories.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={kind === "income"}
            className="cat-segmented-btn"
            onClick={() => switchKind("income")}
          >
            Income <span className="cat-count">{effectiveIncomeCategories.length}</span>
          </button>
        </div>
      </header>

      {kind === "income" && !incomeSupported && (
        <p className="cat-notice" role="status">
          Custom income categories need the database update{" "}
          <code>202610130002_income_categories.sql</code>. Until it is applied, income uses the
          built-in list below (read-only).
        </p>
      )}

      <section className="cat-card cat-list">
        {/* Toolbar: Search Bar (left) -> Add Category Button/Form (middle) -> Auto-categorize with AI + Hover Tooltip (right) */}
        <div className="cat-toolbar">
          <div className="cat-search">
            <FaSearch aria-hidden="true" className="cat-search-icon" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${noun} categories...`}
              aria-label={`Search ${noun} categories`}
            />
            <AnimatePresence initial={false}>
              {query && (
                <motion.button
                  type="button"
                  className="cat-search-clear"
                  onClick={() => setQuery("")}
                  aria-label="Clear search"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.14 }}
                >
                  <FaTimes aria-hidden="true" />
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <div className="cat-toolbar-actions">
            {canEdit && (
              <div className="cat-add-slot">
                {isAddOpen ? (
                  <motion.form
                    key="add-form"
                    className="cat-add-inline"
                    onSubmit={handleAdd}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  >
                    <input
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      placeholder={`New ${noun} category...`}
                      aria-label={`New ${noun} category name`}
                      maxLength={40}
                      autoFocus
                      onKeyDown={(e) => {
                        if (e.key === "Escape") {
                          setIsAddOpen(false);
                          setNewName("");
                        }
                      }}
                    />
                    <motion.button
                      type="submit"
                      className="cat-primary-btn cat-add-submit-btn"
                      disabled={!newName.trim() || adding}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <FaCheck aria-hidden="true" /> {adding ? "Adding…" : "Save"}
                    </motion.button>
                    <motion.button
                      type="button"
                      className="cat-icon-btn"
                      aria-label="Cancel adding category"
                      onClick={() => {
                        setIsAddOpen(false);
                        setNewName("");
                      }}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <FaTimes aria-hidden="true" />
                    </motion.button>
                  </motion.form>
                ) : (
                  <motion.button
                    key="add-trigger"
                    type="button"
                    className="cat-secondary-btn cat-add-trigger-btn"
                    onClick={() => setIsAddOpen(true)}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02, y: -1 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  >
                    <FaPlus aria-hidden="true" /> Add {nounCapitalized} Category
                  </motion.button>
                )}
              </div>
            )}

            {/* Auto-categorize with AI button + Framer Motion Hover Tooltip */}
            <div
              className="cat-ai-tooltip-wrap"
              onMouseEnter={() => setShowAiTooltip(true)}
              onMouseLeave={() => setShowAiTooltip(false)}
              onFocus={() => setShowAiTooltip(true)}
              onBlur={() => setShowAiTooltip(false)}
            >
              <motion.button
                type="button"
                className="cat-primary-btn cat-ai-btn"
                onClick={handleAutoCategorize}
                disabled={autoRunning || uncategorized.length === 0 || !canEdit}
                aria-describedby="cat-ai-tooltip"
                whileHover={
                  autoRunning || uncategorized.length === 0 || !canEdit
                    ? undefined
                    : { scale: 1.02, y: -1 }
                }
                whileTap={
                  autoRunning || uncategorized.length === 0 || !canEdit
                    ? undefined
                    : { scale: 0.97 }
                }
              >
                <FaMagic aria-hidden="true" />
                <span>{autoRunning ? "Categorizing…" : "Auto-categorize with AI"}</span>
                <span
                  className={`cat-ai-badge ${
                    uncategorized.length > 0 ? "cat-ai-badge--active" : ""
                  }`}
                >
                  {uncategorized.length}
                </span>
              </motion.button>

              <AnimatePresence>
                {showAiTooltip && (
                  <motion.div
                    id="cat-ai-tooltip"
                    role="tooltip"
                    className="cat-ai-tooltip"
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.96 }}
                    transition={{ type: "spring", stiffness: 420, damping: 28 }}
                  >
                    <p className="cat-ai-tooltip-eyebrow">Needs a category</p>
                    <p className="cat-ai-tooltip-title">
                      {uncategorized.length} uncategorized {noun}
                      {uncategorized.length === 1 ? "" : kind === "expense" ? "s" : " entries"}
                      {uncategorized.length > 0 && (
                        <span className="cat-ai-tooltip-total">
                          {" "}
                          · {formatCurrency(uncategorizedTotal)}
                        </span>
                      )}
                    </p>
                    <p className="cat-ai-tooltip-desc">
                      The AI Advisor files these into your own {noun} categories. Items it
                      can&apos;t match stay in <strong>{fallbackName}</strong>.
                    </p>
                    {autoResult && <p className="cat-ai-tooltip-result">{autoResult}</p>}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="cat-table-wrap">
          <table className="cat-table">
            <thead>
              <tr>
                <th scope="col" className="cat-col-category">
                  Category
                </th>
                <th scope="col" className="cat-col-entries">
                  Entries
                </th>
                <th scope="col" className="cat-col-total">
                  Total
                </th>
                <th scope="col" className="cat-col-share">
                  Share
                </th>
                <th scope="col" className="cat-col-actions">
                  <span className="cat-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <motion.tbody
              key={`${kind}-${safeCurrentPage}-${query.trim()}`}
              custom={pageDirection}
              variants={PAGE_VARIANTS}
              initial="enter"
              animate="center"
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="cat-empty">
                    No categories match your search.
                  </td>
                </tr>
              ) : (
                paginatedRows.map((row, rowIndex) => {
                  const theme = getCategoryTheme(row.category.name);
                  const IconComp = theme.icon;
                  const roundedShare =
                    row.share > 0 ? Math.max(1, Math.round(row.share)) : 0;
                  const shareTier = getShareTier(roundedShare);
                  const isHoveredEntries = hoveredEntriesId === row.category.id;
                  const isEditing = editingId === row.category.id;
                  // Top half of page (rows 1-4) opens downward; bottom half (rows 5-8) opens upward
                  const openPopoverDown = rowIndex < 4;
                  const rowClassName =
                    [
                      isEditing ? "cat-row--editing" : "",
                      isHoveredEntries ? "cat-row--hovered" : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined;

                  return (
                    <tr key={row.category.id} className={rowClassName}>
                      {/* 1. Category Column */}
                      <td className="cat-col-category">
                        <span className="cat-name-wrap">
                          <span
                            className="cat-category-icon"
                            style={{
                              color: theme.color,
                              backgroundColor: theme.bg,
                              borderColor: theme.border,
                            }}
                            aria-hidden="true"
                          >
                            <IconComp />
                          </span>
                          <span className="cat-name">
                            {isEditing
                              ? editName || row.category.name
                              : row.category.name}
                            {row.isFallback && (
                              <span className="cat-badge">Default</span>
                            )}
                          </span>
                        </span>
                      </td>

                      {/* 2. Detailed Entries Column with Hover Summary Popover */}
                      <td className="cat-col-entries">
                        <div
                          className="cat-entries-cell"
                          onMouseEnter={() =>
                            setHoveredEntriesId(row.category.id)
                          }
                          onMouseLeave={() =>
                            setHoveredEntriesId((curr) =>
                              curr === row.category.id ? null : curr
                            )
                          }
                        >
                          <button
                            type="button"
                            className={`cat-entries-pill ${
                              row.entries > 0 ? "cat-entries-pill--active" : ""
                            }`}
                            onFocus={() => setHoveredEntriesId(row.category.id)}
                            onBlur={() =>
                              setHoveredEntriesId((curr) =>
                                curr === row.category.id ? null : curr
                              )
                            }
                            aria-label={`${row.entries} ${
                              row.entries === 1 ? "entry" : "entries"
                            } in ${row.category.name}`}
                          >
                            <FaListUl
                              aria-hidden="true"
                              className="cat-entries-pill-icon"
                            />
                            <span className="cat-entries-pill-count">
                              {row.entries}{" "}
                              {row.entries === 1 ? "entry" : "entries"}
                            </span>
                            {row.entries > 0 && (
                              <span className="cat-entries-pill-sub">
                                · Avg {formatCurrency(row.avg)}
                              </span>
                            )}
                          </button>

                          {isHoveredEntries && (
                            <motion.div
                              className={`cat-entries-popover ${
                                openPopoverDown
                                  ? "cat-entries-popover--down"
                                  : "cat-entries-popover--up"
                              }`}
                              role="tooltip"
                              initial={{
                                opacity: 0,
                                y: openPopoverDown ? -6 : 6,
                                scale: 0.96,
                              }}
                              animate={{ opacity: 1, y: 0, scale: 1 }}
                              transition={{
                                type: "spring",
                                stiffness: 420,
                                damping: 28,
                              }}
                            >
                              <div className="cat-entries-popover-head">
                                <span className="cat-entries-popover-title">
                                  {row.category.name}
                                </span>
                                <span className="cat-entries-popover-badge">
                                  {row.entries}{" "}
                                  {row.entries === 1 ? "entry" : "entries"}
                                </span>
                              </div>

                              {row.entries > 0 ? (
                                <>
                                  <div className="cat-entries-popover-stats">
                                    <span>
                                      Total:{" "}
                                      <strong>
                                        {formatCurrency(row.total)}
                                      </strong>
                                    </span>
                                    <span>
                                      Max:{" "}
                                      <strong>{formatCurrency(row.max)}</strong>
                                    </span>
                                  </div>
                                  <ul className="cat-entries-popover-list">
                                    {row.recentEntries.map((item) => (
                                      <li
                                        key={item.id}
                                        className="cat-entries-popover-item"
                                      >
                                        <div className="cat-entries-popover-item-info">
                                          <span className="cat-entries-popover-item-desc">
                                            {item.description}
                                          </span>
                                          {item.date && (
                                            <span className="cat-entries-popover-item-date">
                                              {item.date}
                                            </span>
                                          )}
                                        </div>
                                        <span className="cat-entries-popover-item-amt">
                                          {formatCurrency(item.amount)}
                                        </span>
                                      </li>
                                    ))}
                                  </ul>
                                  {row.entries > row.recentEntries.length && (
                                    <p className="cat-entries-popover-more">
                                      +{row.entries - row.recentEntries.length}{" "}
                                      more{" "}
                                      {row.entries - row.recentEntries.length ===
                                      1
                                        ? "entry"
                                        : "entries"}{" "}
                                      in {row.category.name}
                                    </p>
                                  )}
                                </>
                              ) : (
                                <p className="cat-entries-popover-empty">
                                  No {noun} entries recorded in this category
                                  yet.
                                </p>
                              )}
                            </motion.div>
                          )}
                        </div>
                      </td>

                      {/* 3. Total Column (non-bold per design specification) */}
                      <td className="cat-col-total cat-amount">
                        {formatCurrency(row.total)}
                      </td>

                      {/* 4. Share Column (bigger bar, colorized based on share %) */}
                      <td className="cat-col-share">
                        <div className="cat-share">
                          <span
                            className="cat-share-track"
                            style={{ backgroundColor: shareTier.trackBg }}
                            aria-hidden="true"
                          >
                            <motion.span
                              className={`cat-share-fill cat-share-fill--${shareTier.tier}`}
                              style={{ background: shareTier.gradient }}
                              initial={{ width: 0 }}
                              animate={{
                                width: `${
                                  row.share > 0
                                    ? Math.min(
                                        100,
                                        Math.max(
                                          10,
                                          Math.pow(row.share / 100, 0.72) * 100
                                        )
                                      )
                                    : 0
                                }%`,
                              }}
                              transition={{ duration: 0.45, ease: "easeOut" }}
                            />
                          </span>
                          <span
                            className="cat-share-pct"
                            style={{ color: shareTier.textColor }}
                          >
                            {row.share.toFixed(0)}%
                          </span>
                        </div>
                      </td>

                      {/* 5. Actions Column: Bigger Rename/Delete buttons + Animated Rename Inline close to Rename button */}
                      <td className="cat-col-actions">
                        {canEdit && !row.isFallback && (
                          <div className="cat-actions">
                            {isEditing ? (
                              <motion.form
                                key="rename-form"
                                className="cat-rename"
                                onSubmit={(e) => {
                                  e.preventDefault();
                                  void handleRename(row);
                                }}
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{
                                  type: "spring",
                                  stiffness: 440,
                                  damping: 28,
                                }}
                              >
                                <input
                                  value={editName}
                                  onChange={(e) => setEditName(e.target.value)}
                                  aria-label={`New name for ${row.category.name}`}
                                  maxLength={40}
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === "Escape") {
                                      setEditingId(null);
                                    }
                                  }}
                                />
                                <motion.button
                                  type="submit"
                                  className="cat-icon-btn cat-icon-btn--save"
                                  aria-label="Save name"
                                  whileHover={{ scale: 1.06 }}
                                  whileTap={{ scale: 0.94 }}
                                >
                                  <FaCheck aria-hidden="true" />
                                </motion.button>
                                <motion.button
                                  type="button"
                                  className="cat-icon-btn"
                                  aria-label="Cancel rename"
                                  onClick={() => setEditingId(null)}
                                  whileHover={{ scale: 1.06 }}
                                  whileTap={{ scale: 0.94 }}
                                >
                                  <FaTimes aria-hidden="true" />
                                </motion.button>
                              </motion.form>
                            ) : (
                              <motion.div
                                key="action-buttons"
                                className="cat-actions-group"
                                initial={{ opacity: 0, scale: 0.96 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ duration: 0.15 }}
                              >
                                <motion.button
                                  type="button"
                                  className="cat-action-btn"
                                  onClick={() => {
                                    setEditingId(row.category.id);
                                    setEditName(row.category.name);
                                  }}
                                  aria-label={`Rename ${row.category.name}`}
                                  whileHover={{ scale: 1.02, y: -1 }}
                                  whileTap={{ scale: 0.97 }}
                                >
                                  <FaEdit aria-hidden="true" /> Rename
                                </motion.button>
                                <motion.button
                                  type="button"
                                  className="cat-action-btn cat-action-btn--danger"
                                  onClick={() => setPendingDelete(row)}
                                  aria-label={`Delete ${row.category.name}`}
                                  whileHover={{ scale: 1.02, y: -1 }}
                                  whileTap={{ scale: 0.97 }}
                                >
                                  <FaTrash aria-hidden="true" /> Delete
                                </motion.button>
                              </motion.div>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </motion.tbody>
          </table>
        </div>

        {/* Centered Windowed Pagination with Right-Aligned Range Info */}
        {totalItems > 0 && (
          <div
            className="cat-pagination"
            role="navigation"
            aria-label="Categories pagination"
          >
            <div className="cat-pagination-spacer" aria-hidden="true" />

            <div className="cat-pagination-nav">
              <motion.button
                type="button"
                className="cat-page-btn cat-page-btn--nav"
                onClick={() => handlePageChange(safeCurrentPage - 1)}
                disabled={safeCurrentPage <= 1}
                aria-label="Previous page"
                title="Previous page"
                whileHover={safeCurrentPage <= 1 ? undefined : { scale: 1.03 }}
                whileTap={safeCurrentPage <= 1 ? undefined : { scale: 0.96 }}
              >
                <FaChevronLeft aria-hidden="true" />
                <span>Prev</span>
              </motion.button>

              <div className="cat-page-numbers">
                {getPaginationPages(safeCurrentPage, totalPages).map((p, idx) => {
                  if (typeof p === "string") {
                    return (
                      <span
                        key={`${p}-${idx}`}
                        className="cat-page-ellipsis"
                        aria-hidden="true"
                      >
                        …
                      </span>
                    );
                  }
                  const isActive = p === safeCurrentPage;
                  return (
                    <motion.button
                      key={p}
                      type="button"
                      className={`cat-page-btn ${
                        isActive ? "cat-page-btn--active" : ""
                      }`}
                      onClick={() => handlePageChange(p)}
                      aria-label={`Page ${p}`}
                      aria-current={isActive ? "page" : undefined}
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {p}
                    </motion.button>
                  );
                })}
              </div>

              <motion.button
                type="button"
                className="cat-page-btn cat-page-btn--nav"
                onClick={() => handlePageChange(safeCurrentPage + 1)}
                disabled={safeCurrentPage >= totalPages}
                aria-label="Next page"
                title="Next page"
                whileHover={safeCurrentPage >= totalPages ? undefined : { scale: 1.03 }}
                whileTap={safeCurrentPage >= totalPages ? undefined : { scale: 0.96 }}
              >
                <span>Next</span>
                <FaChevronRight aria-hidden="true" />
              </motion.button>
            </div>

            <div className="cat-pagination-info">
              <span className="cat-pagination-info-full">
                Showing <strong>{startIndex + 1}</strong>–<strong>{endIndex}</strong> of{" "}
                <strong>{totalItems}</strong>
              </span>
              <span className="cat-pagination-info-short">
                <strong>{startIndex + 1}</strong>–<strong>{endIndex}</strong> of{" "}
                <strong>{totalItems}</strong>
              </span>
            </div>
          </div>
        )}
      </section>

      <DangerDeleteDialog
        open={Boolean(pendingDelete)}
        itemType={`${noun} category`}
        itemName={pendingDelete?.category.name ?? ""}
        consequences={
          pendingDelete
            ? [
                pendingDelete.entries > 0
                  ? `${pendingDelete.entries} ${noun} ${
                      pendingDelete.entries === 1 ? "entry" : "entries"
                    } (${formatCurrency(pendingDelete.total)}) move to ${fallbackName}.`
                  : `No ${noun} entries use it.`,
                "AI auto-categorize can re-file moved entries afterwards.",
              ]
            : []
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={async () => {
          if (pendingDelete) await handleDelete(pendingDelete);
        }}
      />
    </div>
  );
}
