"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaTrash,
  FaSearch,
  FaTimes,
  FaPlus,
  FaExclamationTriangle,
  FaSortAmountDown,
  FaListUl,
} from "react-icons/fa";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import { useDashboardUser } from "@/context/DashboardUserContext";
import {
  mergeDashboardDataCache,
  useFinancial,
} from "@/context/FinancialContext";
import { formatCurrency, toNumber } from "@/utils/formatters";
import {
  addExpenseWithWalletDeduction,
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
import CustomSelect from "@/component/CustomSelect";
import CustomDatePicker from "@/component/CustomDatePicker";
import { useToast } from "@/component/toast/ToastContext";
import ExpenseKPICards from "./ExpenseKPICards";
import ExpenseCategoryVisualizer from "./ExpenseCategoryVisualizer";
import { getCategoryTheme } from "./categoryUtils";

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

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

  // Form states
  const [amount, setAmount] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [spentOn, setSpentOn] = useState("");
  const [loading, setLoading] = useState(() => !hasInitialExpensesData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hadInitialExpensesData = useRef(hasInitialExpensesData);

  // Filter & Search states
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;

    const loadCategories = async () => {
      const nextCategories = await ensureDefaultCategories(user.uid);

      if (!active) {
        return;
      }

      setCategories(nextCategories);
      setCategoryName((currentCategoryName) =>
        currentCategoryName || nextCategories[0]?.name || "Uncategorized"
      );
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

  const displayedExpenses = showAll
    ? filteredExpenses
    : filteredExpenses.slice(0, 8);

  const numAmount = Number(amount);
  const isOverBudget =
    Number.isFinite(numAmount) &&
    numAmount > 0 &&
    walletBudget > 0 &&
    numAmount > walletBudget;

  const handleQuickAdd = (preset: number) => {
    const current = Number(amount) || 0;
    setAmount((current + preset).toString());
  };

  const handleAddExpense = async (event: FormEvent) => {
    event.preventDefault();

    if (saving) {
      return;
    }

    const nextAmount = Number(amount);

    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      setError("Enter a valid expense amount.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await addExpenseWithWalletDeduction(user.uid, {
        amount: nextAmount,
        categoryName: categoryName || "Uncategorized",
        date: spentOn || new Date().toISOString().slice(0, 10),
        description: description.trim() || "Expense",
      });

      const [nextExpenses, nextActiveWallet] = await Promise.all([
        listExpenses(user.uid),
        getActiveWallet(user.uid),
      ]);
      const nextWalletBudget = nextActiveWallet?.budget ?? 0;

      setExpenses(nextExpenses);
      setActiveWallet(nextActiveWallet);
      setWalletBudget(nextWalletBudget);
      setAmount("");
      setDescription("");
      setSpentOn("");
      setDashboardCache((currentCache) =>
        mergeDashboardDataCache(currentCache, user.uid, {
          expenses: nextExpenses,
          activeWalletBudget: nextWalletBudget,
        })
      );
      toast("Expense added successfully", "success");
    } catch (nextError) {
      setError(
        nextError instanceof Error ? nextError.message : "Could not add expense."
      );
      toast(nextError instanceof Error ? nextError.message : "Could not add expense.", "error");
    } finally {
      setSaving(false);
    }
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

      {/* ── RICH DATA VISUALIZATION KPIS ── */}
      <ExpenseKPICards
        walletBudget={walletBudget}
        totalTracked={totalTracked}
        averageExpense={averageExpense}
        activeWallet={activeWallet}
        expenses={expenses}
      />

      {/* ── PROPORTIONAL CATEGORY VISUALIZER & FILTERS ── */}
      <ExpenseCategoryVisualizer
        expenses={expenses}
        selectedCategory={selectedCategory}
        onSelectCategory={setSelectedCategory}
      />

      {/* ── EXPENSES MAIN WORKSPACE LAYOUT ── */}
      <section className="expenses-layout">
        {/* ADD SPENDING FORM */}
        <form className="expenses-card expenses-form" onSubmit={handleAddExpense}>
          <div>
            <p className="expenses-eyebrow">New expense</p>
            <h2>Add spending</h2>
          </div>

          <label>
            Amount (PHP)
            <input
              value={amount}
              inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              disabled={saving}
            />
          </label>

          {/* Quick Amount Presets */}
          <div className="expenses-quick-amounts" aria-label="Quick amount shortcuts">
            <span className="expenses-quick-label">Quick add:</span>
            <div className="expenses-quick-chips">
              {QUICK_AMOUNTS.map((val) => (
                <button
                  key={val}
                  type="button"
                  className="expenses-quick-chip"
                  onClick={() => handleQuickAdd(val)}
                  disabled={saving}
                >
                  +{val}
                </button>
              ))}
              {amount ? (
                <button
                  type="button"
                  className="expenses-quick-chip expenses-quick-chip--clear"
                  onClick={() => setAmount("")}
                  disabled={saving}
                  title="Clear amount"
                >
                  Clear
                </button>
              ) : null}
            </div>
          </div>

          {/* Budget Warning Callout */}
          {isOverBudget ? (
            <motion.div
              className="expenses-overbudget-alert"
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <FaExclamationTriangle aria-hidden="true" />
              <span>
                Amount exceeds current wallet balance ({formatCurrency(walletBudget)}).
              </span>
            </motion.div>
          ) : null}

          <label>
            Category
            <CustomSelect
              value={categoryName}
              onChange={(val) => setCategoryName(val)}
              disabled={saving}
              options={[
                ...categories.map((c) => ({ value: c.name, label: c.name })),
                ...(!categories.some((c) => c.name === "Uncategorized")
                  ? [{ value: "Uncategorized", label: "Uncategorized" }]
                  : []),
              ]}
            />
          </label>

          <label>
            Date
            <CustomDatePicker
              value={spentOn}
              onChange={(val) => setSpentOn(val)}
            />
          </label>

          <label>
            Description
            <input
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Lunch, fare, grocery, coffee..."
              disabled={saving}
            />
          </label>

          <motion.button
            className="expenses-primary-button"
            type="submit"
            disabled={saving}
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
          >
            {saving ? (
              "Adding..."
            ) : (
              <span className="expenses-btn-content">
                <FaPlus aria-hidden="true" /> Add Expense
              </span>
            )}
          </motion.button>
        </form>

        {/* RECENT EXPENSE TRACKER */}
        <section className="expenses-card expenses-list">
          <div className="expenses-list-header">
            <div>
              <p className="expenses-eyebrow">Transaction Records</p>
              <h2>Expense tracker</h2>
            </div>
            <span className="expenses-list-count-badge">
              {filteredExpenses.length} {filteredExpenses.length === 1 ? "match" : "matches"}
            </span>
          </div>

          {/* Search & Sort Controls Toolbar */}
          <div className="expenses-list-toolbar">
            <div className="expenses-search-box">
              <FaSearch aria-hidden="true" className="expenses-search-icon" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search description or category..."
                aria-label="Search expenses"
              />
              {searchQuery ? (
                <button
                  type="button"
                  className="expenses-search-clear"
                  onClick={() => setSearchQuery("")}
                  aria-label="Clear search"
                >
                  <FaTimes aria-hidden="true" />
                </button>
              ) : null}
            </div>

            <div className="expenses-sort-box">
              <FaSortAmountDown aria-hidden="true" className="expenses-sort-icon" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                aria-label="Sort expenses"
                className="expenses-sort-select"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="highest">Highest amount</option>
                <option value="lowest">Lowest amount</option>
              </select>
            </div>
          </div>

          {/* List items */}
          {displayedExpenses.length ? (
            <div className="expenses-list-items">
              <AnimatePresence>
                {displayedExpenses.map((expense) => {
                  const theme = getCategoryTheme(expense.category);
                  const IconComp = theme.icon;

                  return (
                    <motion.article
                      key={expense.id}
                      className="expenses-list-item"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
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
                          onClick={() => void handleDeleteExpense(expense)}
                          disabled={saving}
                          aria-label={`Delete ${expense.description || "expense"}`}
                          className="expenses-list-delete-btn"
                        >
                          <FaTrash aria-hidden="true" />
                        </button>
                      </div>
                    </motion.article>
                  );
                })}
              </AnimatePresence>

              {/* Show more / Show less toggle */}
              {filteredExpenses.length > 8 ? (
                <div className="expenses-list-pagination">
                  <button
                    type="button"
                    className="expenses-pagination-toggle"
                    onClick={() => setShowAll((prev) => !prev)}
                  >
                    <FaListUl aria-hidden="true" />
                    <span>
                      {showAll
                        ? "Show recent (8)"
                        : `Show all (${filteredExpenses.length})`}
                    </span>
                  </button>
                </div>
              ) : null}
            </div>
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
                      setSelectedCategory(null);
                    }}
                  >
                    Clear Filters
                  </button>
                </div>
              ) : (
                <div className="expenses-empty-new">
                  <p>No expenses tracked yet.</p>
                  <span>Add your first spending above to visualize your cash flow!</span>
                </div>
              )}
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
