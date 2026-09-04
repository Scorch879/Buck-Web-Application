"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { FaReceipt, FaTrash, FaWallet } from "react-icons/fa";
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
} from "@/utils/supabaseData";
import "./style.css";
import CustomSelect from "@/component/CustomSelect";
import CustomDatePicker from "@/component/CustomDatePicker";
import { useToast } from "@/component/toast/ToastContext";

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
  const [amount, setAmount] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [spentOn, setSpentOn] = useState("");
  const [loading, setLoading] = useState(() => !hasInitialExpensesData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const hadInitialExpensesData = useRef(hasInitialExpensesData);

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
      const activeWallet = await getActiveWallet(user.uid);
      const nextWalletBudget = activeWallet?.budget ?? 0;

      if (!active) {
        return;
      }

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

  const recentExpenses = expenses.slice(0, 8);
  const totalTracked = useMemo(
    () => expenses.reduce((sum, expense) => sum + toNumber(expense.amount), 0),
    [expenses]
  );
  const averageExpense = expenses.length ? totalTracked / expenses.length : 0;

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

      const [nextExpenses, activeWallet] = await Promise.all([
        listExpenses(user.uid),
        getActiveWallet(user.uid),
      ]);
      const nextWalletBudget = activeWallet?.budget ?? 0;

      setExpenses(nextExpenses);
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
      const [nextExpenses, activeWallet] = await Promise.all([
        listExpenses(user.uid),
        getActiveWallet(user.uid),
      ]);
      const nextWalletBudget = activeWallet?.budget ?? 0;

      setExpenses(nextExpenses);
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

      <section className="expenses-stats">
        <article>
          <FaWallet aria-hidden="true" />
          <span>Wallet left</span>
          <strong>{formatCurrency(walletBudget)}</strong>
        </article>
        <article>
          <FaReceipt aria-hidden="true" />
          <span>Total tracked</span>
          <strong>{formatCurrency(totalTracked)}</strong>
        </article>
        <article>
          <FaReceipt aria-hidden="true" />
          <span>Average expense</span>
          <strong>{formatCurrency(averageExpense)}</strong>
        </article>
      </section>

      <section className="expenses-layout">
        <form className="expenses-card expenses-form" onSubmit={handleAddExpense}>
          <div>
            <p className="expenses-eyebrow">New expense</p>
            <h2>Add spending</h2>
          </div>

          <label>
            Amount
            <input
              value={amount}
              inputMode="decimal"
              onChange={(event) => setAmount(event.target.value)}
              placeholder="0.00"
              disabled={saving}
            />
          </label>

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
              placeholder="Lunch, fare, school supplies..."
              disabled={saving}
            />
          </label>

          <button className="expenses-primary-button" type="submit" disabled={saving}>
            {saving ? "Adding..." : "Add Expense"}
          </button>
        </form>

        <section className="expenses-card expenses-list">
          <div>
            <p className="expenses-eyebrow">Recent</p>
            <h2>Expense tracker</h2>
          </div>

          {recentExpenses.length ? (
            <div className="expenses-list-items">
              {recentExpenses.map((expense) => (
                <article key={expense.id} className="expenses-list-item">
                  <div>
                    <strong>{expense.description || expense.category}</strong>
                    <span>
                      {expense.category} · {expense.date}
                    </span>
                  </div>
                  <div className="expenses-list-item-actions">
                    <strong>{formatCurrency(expense.amount)}</strong>
                    <button
                      type="button"
                      onClick={() => void handleDeleteExpense(expense)}
                      disabled={saving}
                      aria-label={`Delete ${expense.description || "expense"}`}
                    >
                      <FaTrash aria-hidden="true" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="expenses-empty">No expenses yet.</div>
          )}
        </section>
      </section>
    </div>
  );
}
