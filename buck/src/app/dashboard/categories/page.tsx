"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaCheck, FaEdit, FaMagic, FaPlus, FaSearch, FaTimes, FaTrash } from "react-icons/fa";
import { categorizeItems } from "@/utils/aiApi";
import "./style.css";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";
import DangerDeleteDialog from "@/component/DangerDeleteDialog";
import { useToast } from "@/component/toast/ToastContext";
import { useDashboardUser } from "@/context/DashboardUserContext";
import { mergeDashboardDataCache, useFinancial } from "@/context/FinancialContext";
import { formatCurrency } from "@/utils/formatters";
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


type Row = {
  category: BuckCategory;
  entries: number;
  total: number;
  share: number;
  isFallback: boolean;
};

/** Max items sent to the AI Advisor per "Auto-categorize" click (one request). */
const AUTO_CATEGORIZE_BATCH = 25;

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
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [autoRunning, setAutoRunning] = useState(false);
  const [autoResult, setAutoResult] = useState("");
  const [editName, setEditName] = useState("");
  const [pendingDelete, setPendingDelete] = useState<Row | null>(null);
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

  // Usage per category (by name: expenses.category_name / incomes.source).
  const rows: Row[] = useMemo(() => {
    const usage = new Map<string, { entries: number; total: number }>();
    const items =
      kind === "expense"
        ? expenses.map((e) => ({ name: e.category || UNCATEGORIZED_EXPENSE, amount: e.amount }))
        : incomes.map((i) => ({ name: i.source || UNCATEGORIZED_INCOME, amount: i.amount }));
    let grand = 0;
    items.forEach(({ name, amount }) => {
      const key = name.toLowerCase();
      const cur = usage.get(key) ?? { entries: 0, total: 0 };
      cur.entries += 1;
      cur.total += Number(amount) || 0;
      grand += Number(amount) || 0;
      usage.set(key, cur);
    });
    return categories.map((category) => {
      const u = usage.get(category.name.toLowerCase()) ?? { entries: 0, total: 0 };
      return {
        category,
        entries: u.entries,
        total: u.total,
        share: grand > 0 ? (u.total / grand) * 100 : 0,
        isFallback: category.name.toLowerCase() === fallbackName.toLowerCase(),
      };
    });
  }, [categories, expenses, fallbackName, incomes, kind]);

  const visibleRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => !q || r.category.name.toLowerCase().includes(q))
      .sort((a, b) => b.total - a.total || a.category.name.localeCompare(b.category.name));
  }, [query, rows]);

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
    setEditingId(null);
    setAutoResult("");
  };

  // AI Financial Advisor auto-categorize: one Buck_AI request per batch. The
  // service answers only with the user's own category names.
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
      setAutoResult(
        `AI filed ${filed} of ${batch.length} checked. ${left} still uncategorized` +
          (uncategorized.length > batch.length ? ` (runs ${AUTO_CATEGORIZE_BATCH} at a time).` : ".")
      );
    } catch (err) {
      setAutoResult(err instanceof Error ? err.message : "Auto-categorize failed.");
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

      {/* Uncategorized bucket + AI Advisor auto-categorize */}
      <section className="cat-card cat-uncat" aria-label="Uncategorized items">
        <div className="cat-uncat-text">
          <p className="cat-eyebrow">Needs a category</p>
          <h3>
            {uncategorized.length} uncategorized {noun}
            {uncategorized.length === 1 ? "" : kind === "expense" ? "s" : " entries"}
            {uncategorized.length > 0 && (
              <span className="cat-uncat-total"> · {formatCurrency(uncategorizedTotal)}</span>
            )}
          </h3>
          <p className="cat-muted">
            The AI Advisor files these into your own {noun} categories. Items it can&apos;t match
            stay in {fallbackName}.
          </p>
          {autoResult && <p className="cat-auto-result" role="status">{autoResult}</p>}
        </div>
        <button
          type="button"
          className="cat-primary-btn"
          onClick={handleAutoCategorize}
          disabled={autoRunning || uncategorized.length === 0 || !canEdit}
        >
          <FaMagic aria-hidden="true" /> {autoRunning ? "Categorizing…" : "Auto-categorize with AI"}
        </button>
      </section>

      <section className="cat-card cat-list">
        <div className="cat-toolbar">
          <div className="cat-search">
            <FaSearch aria-hidden="true" className="cat-search-icon" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Search ${noun} categories...`}
              aria-label={`Search ${noun} categories`}
            />
            {query && (
              <button type="button" className="cat-search-clear" onClick={() => setQuery("")} aria-label="Clear search">
                <FaTimes aria-hidden="true" />
              </button>
            )}
          </div>
          {canEdit && (
            <form className="cat-add" onSubmit={handleAdd}>
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder={`New ${noun} category`}
                aria-label={`New ${noun} category name`}
                maxLength={40}
              />
              <button type="submit" className="cat-primary-btn" disabled={!newName.trim() || adding}>
                <FaPlus aria-hidden="true" /> Add
              </button>
            </form>
          )}
        </div>

        <div className="cat-table-wrap">
          <table className="cat-table">
            <thead>
              <tr>
                <th scope="col">Category</th>
                <th scope="col" className="cat-num">Entries</th>
                <th scope="col" className="cat-num">Total</th>
                <th scope="col" className="cat-share-col">Share</th>
                <th scope="col" className="cat-actions-col">
                  <span className="cat-sr">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="cat-empty">
                    No categories match your search.
                  </td>
                </tr>
              ) : (
                visibleRows.map((row) => (
                  <tr key={row.category.id}>
                    <td>
                      {editingId === row.category.id ? (
                        <form
                          className="cat-rename"
                          onSubmit={(e) => {
                            e.preventDefault();
                            void handleRename(row);
                          }}
                        >
                          <input
                            value={editName}
                            onChange={(e) => setEditName(e.target.value)}
                            aria-label={`New name for ${row.category.name}`}
                            maxLength={40}
                            autoFocus
                          />
                          <button type="submit" className="cat-icon-btn" aria-label="Save name">
                            <FaCheck aria-hidden="true" />
                          </button>
                          <button
                            type="button"
                            className="cat-icon-btn"
                            aria-label="Cancel rename"
                            onClick={() => setEditingId(null)}
                          >
                            <FaTimes aria-hidden="true" />
                          </button>
                        </form>
                      ) : (
                        <span className="cat-name">
                          {row.category.name}
                          {row.isFallback && <span className="cat-badge">Fallback</span>}
                        </span>
                      )}
                    </td>
                    <td className="cat-num">{row.entries}</td>
                    <td className="cat-num cat-amount">{formatCurrency(row.total)}</td>
                    <td className="cat-share-col">
                      <span className="cat-share">
                        <span className="cat-share-track" aria-hidden="true">
                          <span style={{ width: `${row.share}%` }} />
                        </span>
                        {row.share.toFixed(0)}%
                      </span>
                    </td>
                    <td className="cat-actions-col">
                      {canEdit && !row.isFallback && editingId !== row.category.id && (
                        <div className="cat-actions">
                          <button
                            type="button"
                            className="cat-action-btn"
                            onClick={() => {
                              setEditingId(row.category.id);
                              setEditName(row.category.name);
                            }}
                            aria-label={`Rename ${row.category.name}`}
                          >
                            <FaEdit aria-hidden="true" /> Rename
                          </button>
                          <button
                            type="button"
                            className="cat-action-btn cat-action-btn--danger"
                            onClick={() => setPendingDelete(row)}
                            aria-label={`Delete ${row.category.name}`}
                          >
                            <FaTrash aria-hidden="true" /> Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <DangerDeleteDialog
        open={Boolean(pendingDelete)}
        itemType={`${noun} category`}
        itemName={pendingDelete?.category.name ?? ""}
        consequences={
          pendingDelete
            ? [
                pendingDelete.entries > 0
                  ? `${pendingDelete.entries} ${noun} ${pendingDelete.entries === 1 ? "entry" : "entries"} (${formatCurrency(pendingDelete.total)}) move to ${fallbackName}.`
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
