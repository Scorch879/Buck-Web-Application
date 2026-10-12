"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import {
  FaTrash,
  FaSearch,
  FaTimes,
  FaPlus,
  FaSortAmountDown,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useDashboardUser } from "@/context/DashboardUserContext";
import {
  mergeDashboardDataCache,
  useFinancial,
} from "@/context/FinancialContext";
import { formatCurrency, toNumber } from "@/utils/formatters";
import {
  deleteExpenseAndRestoreWallet,
  ensureDefaultCategories,
  getActiveWallet,
  listExpenses,
  subscribeUserTable,
  type BuckCategory,
  type BuckExpense,
  type BuckWallet,
} from "@/utils/supabaseData";
import "./style.css";
import { useToast } from "@/component/toast/ToastContext";
import CustomSelect, { type SelectOption } from "@/component/CustomSelect";
import ExpenseKPICards from "./ExpenseKPICards";
import ExpenseCategoryVisualizer from "./ExpenseCategoryVisualizer";
import { getCategoryTheme } from "./categoryUtils";
import AddExpenseModal from "./AddExpenseModal";
import DangerDeleteDialog from "@/component/DangerDeleteDialog";

const PAGE_SIZE = 8;

type SortKey = "newest" | "oldest" | "highest" | "lowest";

const SORT_OPTIONS: SelectOption[] = [
  { value: "newest", label: "Newest first" },
  { value: "oldest", label: "Oldest first" },
  { value: "highest", label: "Highest amount" },
  { value: "lowest", label: "Lowest amount" },
];

const PAGE_VARIANTS = {
  enter: (direction: number) => ({
    x: direction > 0 ? 18 : direction < 0 ? -18 : 0,
    y: direction === 0 ? 8 : 0,
    opacity: 0,
  }),
  center: {
    x: 0,
    y: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction > 0 ? -18 : direction < 0 ? 18 : 0,
    y: 0,
    opacity: 0,
  }),
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

export default function ExpensesPage() {
  const { user } = useDashboardUser();
  const { toast } = useToast();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const userCache = dashboardCache.userId === user.uid ? dashboardCache : {};
  const hasInitialExpensesData = Boolean(
    userCache.categories &&
      userCache.expenses &&
      userCache.activeWalletBudget !== undefined
  );
  const [categories, setCategories] = useState<BuckCategory[]>(
    () => userCache.categories ?? []
  );
  const [expenses, setExpenses] = useState<BuckExpense[]>(
    () => userCache.expenses ?? []
  );
  const [walletBudget, setWalletBudget] = useState(
    () => userCache.activeWalletBudget ?? 0
  );
  const [activeWallet, setActiveWallet] = useState<BuckWallet | null>(null);

  const [loading, setLoading] = useState(() => !hasInitialExpensesData);
  const [saving, setSaving] = useState(false);
  // Expense awaiting the three-step delete confirmation (ADR-041).
  const [pendingDeleteExpense, setPendingDeleteExpense] = useState<BuckExpense | null>(null);
  const [error, setError] = useState("");
  const hadInitialExpensesData = useRef(hasInitialExpensesData);

  // Modal overlay state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  // Filter & Search states
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortKey>("newest");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageDirection, setPageDirection] = useState<number>(0);
  const prefersReducedMotion = useReducedMotion();

  // Reset to page 1 from the handlers that change the result set (no extra render on mount).
  const resetToFirstPage = () => {
    setPageDirection(0);
    setCurrentPage(1);
  };
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
    resetToFirstPage();
  };
  const handleCategoryChange = (value: string | null) => {
    setSelectedCategory(value);
    resetToFirstPage();
  };
  const handleSortChange = (value: SortKey) => {
    setSortBy(value);
    resetToFirstPage();
  };

  const handlePageChange = (newPage: number) => {
    setPageDirection(newPage > currentPage ? 1 : -1);
    setCurrentPage(newPage);
  };

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      const nextCategories = await ensureDefaultCategories(user.uid);

      if (!active) {
        return;
      }

      setCategories(nextCategories);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          categories: nextCategories,
        })
      );
    };

    const loadExpenses = async () => {
      const nextExpenses = await listExpenses(user.uid);

      if (!active) {
        return;
      }

      setExpenses(nextExpenses);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          expenses: nextExpenses,
        })
      );
    };

    const loadWallet = async () => {
      const nextActiveWallet = await getActiveWallet(user.uid);
      const nextWalletBudget = nextActiveWallet?.budget ?? 0;

      if (!active) {
        return;
      }

      setActiveWallet(nextActiveWallet);
      setWalletBudget(nextWalletBudget);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          activeWalletBudget: nextWalletBudget,
        })
      );
    };

    const loadData = async () => {
      if (!hadInitialExpensesData.current) {
        setLoading(true);
      }

      try {
        await Promise.all([loadCategories(), loadExpenses(), loadWallet()]);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Could not load expenses."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    void loadData();

    const unsubscribeExpenses = subscribeUserTable(
      "expenses",
      user.uid,
      () => void loadExpenses()
    );
    const unsubscribeWallets = subscribeUserTable("wallets", user.uid, () => {
      void loadWallet();
    });

    return () => {
      active = false;
      unsubscribeExpenses();
      unsubscribeWallets();
    };
  }, [setDashboardCache, user.uid]);

  const totalTracked = useMemo(
    () => expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0),
    [expenses]
  );
  const averageExpense = expenses.length ? totalTracked / expenses.length : 0;

  // Filtered and sorted expenses
  const filteredExpenses = useMemo(() => {
    let list = expenses;

    if (selectedCategory) {
      list = list.filter(
        (e) => e.category?.toLowerCase() === selectedCategory.toLowerCase()
      );
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      list = list.filter(
        (e) =>
          e.description?.toLowerCase().includes(q) ||
          e.category?.toLowerCase().includes(q)
      );
    }

    return [...list].sort((a, b) => {
      if (sortBy === "highest") return toNumber(b.amount) - toNumber(a.amount);
      if (sortBy === "lowest") return toNumber(a.amount) - toNumber(b.amount);
      if (sortBy === "oldest") {
        const dateA = new Date(a.date || 0).getTime();
        const dateB = new Date(b.date || 0).getTime();
        return dateA - dateB;
      }
      // default "newest"
      const dateA = new Date(a.date || 0).getTime();
      const dateB = new Date(b.date || 0).getTime();
      return dateB - dateA;
    });
  }, [expenses, selectedCategory, searchQuery, sortBy]);

  const totalItems = filteredExpenses.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const displayedExpenses = filteredExpenses.slice(startIndex, endIndex);

  // Keep state in sync when the last item on the final page is deleted.
  useEffect(() => {
    if (currentPage !== safeCurrentPage) setCurrentPage(safeCurrentPage);
  }, [currentPage, safeCurrentPage]);

  const handleExpenseAdded = async () => {
    const [nextExpenses, nextActiveWallet] = await Promise.all([
      listExpenses(user.uid),
      getActiveWallet(user.uid),
    ]);
    const nextWalletBudget = nextActiveWallet?.budget ?? 0;

    setExpenses(nextExpenses);
    setActiveWallet(nextActiveWallet);
    setWalletBudget(nextWalletBudget);
    setDashboardCache((currentCache) =>
      mergeDashboardDataCache(currentCache, user.uid, {
        expenses: nextExpenses,
        activeWalletBudget: nextWalletBudget,
      })
    );
  };

  const handleDeleteExpense = async (expense: BuckExpense) => {
    if (saving) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await deleteExpenseAndRestoreWallet(user.uid, expense.id, expense.amount);
      const [nextExpenses, nextActiveWallet] = await Promise.all([
        listExpenses(user.uid),
        getActiveWallet(user.uid),
      ]);
      const nextWalletBudget = nextActiveWallet?.budget ?? 0;

      setExpenses(nextExpenses);
      setActiveWallet(nextActiveWallet);
      setWalletBudget(nextWalletBudget);
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          expenses: nextExpenses,
          activeWalletBudget: nextWalletBudget,
        })
      );
      toast("Expense deleted successfully", "success");
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Could not remove expense."
      );
      toast(nextError instanceof Error ? nextError.message : "Could not remove expense.", "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <DashboardPageSkeleton variant="expenses" />;
  }

  return (
    <div className="expenses-page">
      {error ? <div className="expenses-message">{error}</div> : null}

      {/* ── TOP KPI: CATEGORY SPENDING ALLOCATION BAR & LEGEND ── */}
      <ExpenseCategoryVisualizer
        expenses={expenses}
        selectedCategory={selectedCategory}
        onSelectCategory={handleCategoryChange}
      />

      {/* ── KPI CARDS ── */}
      <ExpenseKPICards
        walletBudget={walletBudget}
        totalTracked={totalTracked}
        averageExpense={averageExpense}
        activeWallet={activeWallet}
        expenses={expenses}
      />

      {/* ── EXPENSE TRACKER LIST ── */}
      <section className="expenses-card expenses-list">
        <div className="expenses-list-header">
          <div>
            <p className="expenses-eyebrow">Transaction Records</p>
            <h2>Expense tracker</h2>
          </div>
          <div className="expenses-list-header-actions">
            <span className="expenses-list-count-badge">
              {filteredExpenses.length} {filteredExpenses.length === 1 ? "match" : "matches"}
            </span>
            <motion.button
              type="button"
              className="expenses-add-trigger-btn"
              onClick={() => setIsAddModalOpen(true)}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              aria-label="Add new expense"
            >
              <FaPlus aria-hidden="true" />
              <span>Add Spending</span>
            </motion.button>
          </div>
        </div>

        {/* Search & Sort Controls Toolbar */}
        <div className="expenses-list-toolbar">
          <div className="expenses-search-box">
            <FaSearch aria-hidden="true" className="expenses-search-icon" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder="Search description or category..."
              aria-label="Search expenses"
            />
            {searchQuery ? (
              <button
                type="button"
                className="expenses-search-clear"
                onClick={() => handleSearchChange("")}
                aria-label="Clear search"
              >
                <FaTimes aria-hidden="true" />
              </button>
            ) : null}
          </div>

          <div className="expenses-sort-box">
            <CustomSelect
              fit
              value={sortBy}
              onChange={(val) =>
                handleSortChange(val as SortKey)
              }
              options={SORT_OPTIONS}
              icon={<FaSortAmountDown aria-hidden="true" />}
              size="sm"
              className="expenses-custom-select expenses-custom-select--sort"
            />
          </div>
        </div>

        {/* List items */}
        {displayedExpenses.length ? (
          <>
            <div className="expenses-list-items-container">
              <AnimatePresence mode="wait" initial={false} custom={pageDirection}>
                <motion.div
                  key={safeCurrentPage}
                  custom={pageDirection}
                  variants={PAGE_VARIANTS}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: prefersReducedMotion ? 0 : 0.16, ease: "easeOut" }}
                  className="expenses-list-items"
                >
                  {displayedExpenses.map((expense) => {
                    const theme = getCategoryTheme(expense.category);
                    const IconComp = theme.icon;

                    return (
                      <article
                        key={expense.id}
                        className="expenses-list-item"
                      >
                        <div className="expenses-list-item-main">
                          <span
                            className="expenses-list-item-category-icon"
                            style={{
                              backgroundColor: theme.bg,
                              color: theme.color,
                              borderColor: theme.border,
                            }}
                            aria-hidden="true"
                          >
                            <IconComp />
                          </span>

                          <div className="expenses-list-item-details">
                            <strong className="expenses-list-item-title">
                              {expense.description || expense.category}
                            </strong>
                            <div className="expenses-list-item-sub">
                              <span
                                className="expenses-list-item-pill"
                                style={{
                                  color: theme.color,
                                  backgroundColor: theme.bg,
                                  borderColor: theme.border,
                                }}
                              >
                                {expense.category}
                              </span>
                              <span className="expenses-list-item-date">
                                {expense.date}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="expenses-list-item-actions">
                          <strong className="expenses-list-item-amount">
                            {formatCurrency(expense.amount)}
                          </strong>
                          <button
                            type="button"
                            onClick={() => setPendingDeleteExpense(expense)}
                            disabled={saving}
                            aria-label={`Delete ${expense.description || "expense"}`}
                            className="expenses-list-delete-btn"
                          >
                            <FaTrash aria-hidden="true" />
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Centered Pagination Controls with Right-Aligned Showing Info */}
            {totalPages > 1 && (
              <div
                className="expenses-pagination"
                role="navigation"
                aria-label="Expense tracker pagination"
              >
                <div className="expenses-pagination-spacer" aria-hidden="true" />

                <div className="expenses-pagination-nav">
                  <button
                    type="button"
                    className="expenses-page-btn expenses-page-btn--nav"
                    onClick={() =>
                      handlePageChange(Math.max(1, safeCurrentPage - 1))
                    }
                    disabled={safeCurrentPage <= 1}
                    aria-label="Previous page"
                    title="Previous page"
                  >
                    <FaChevronLeft aria-hidden="true" />
                    <span>Prev</span>
                  </button>

                  <div className="expenses-page-numbers">
                    {getPaginationPages(safeCurrentPage, totalPages).map(
                      (p) => {
                        if (typeof p === "string") {
                          return (
                            <span
                              key={p}
                              className="expenses-page-ellipsis"
                              aria-hidden="true"
                            >
                              …
                            </span>
                          );
                        }

                        const isActive = p === safeCurrentPage;
                        return (
                          <button
                            key={p}
                            type="button"
                            className={`expenses-page-btn ${
                              isActive ? "expenses-page-btn--active" : ""
                            }`}
                            onClick={() => handlePageChange(p)}
                            aria-label={`Page ${p}`}
                            aria-current={isActive ? "page" : undefined}
                          >
                            {p}
                          </button>
                        );
                      }
                    )}
                  </div>

                  <button
                    type="button"
                    className="expenses-page-btn expenses-page-btn--nav"
                    onClick={() =>
                      handlePageChange(Math.min(totalPages, safeCurrentPage + 1))
                    }
                    disabled={safeCurrentPage >= totalPages}
                    aria-label="Next page"
                    title="Next page"
                  >
                    <span>Next</span>
                    <FaChevronRight aria-hidden="true" />
                  </button>
                </div>

                <div className="expenses-pagination-info">
                  <span className="expenses-pagination-info-full">
                    Showing <strong>{startIndex + 1}</strong>–<strong>{endIndex}</strong> of <strong>{totalItems}</strong>
                  </span>
                  <span className="expenses-pagination-info-short">
                    <strong>{startIndex + 1}</strong>–<strong>{endIndex}</strong> of <strong>{totalItems}</strong>
                  </span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="expenses-empty">
            {searchQuery || selectedCategory ? (
              <div className="expenses-empty-filtered">
                <p>No transactions match your search or filter criteria.</p>
                <button
                  type="button"
                  className="expenses-empty-clear-btn"
                  onClick={() => {
                    setSearchQuery("");
                    handleCategoryChange(null);
                  }}
                >
                  Clear Filters
                </button>
              </div>
            ) : (
              <div className="expenses-empty-new">
                <p>No expenses tracked yet.</p>
                <span>Add your first spending using the button above to visualize your cash flow!</span>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ── OVERLAY MODAL: ADD SPENDING ── */}
      <AddExpenseModal
        open={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        categories={categories}
        walletBudget={walletBudget}
        userId={user.uid}
        onExpenseAdded={handleExpenseAdded}
      />

      <DangerDeleteDialog
        open={Boolean(pendingDeleteExpense)}
        itemType="expense"
        itemName={pendingDeleteExpense?.description || pendingDeleteExpense?.category || "expense"}
        consequences={
          pendingDeleteExpense
            ? [
                `${formatCurrency(pendingDeleteExpense.amount)} (${pendingDeleteExpense.category}) is removed from your records.`,
                "The amount is returned to the wallet it was paid from.",
              ]
            : []
        }
        onCancel={() => setPendingDeleteExpense(null)}
        onConfirm={async () => {
          if (!pendingDeleteExpense) return;
          await handleDeleteExpense(pendingDeleteExpense);
          setPendingDeleteExpense(null);
        }}
      />
    </div>
  );
}
