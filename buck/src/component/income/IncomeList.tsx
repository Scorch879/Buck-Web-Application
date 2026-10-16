"use client";

import { useMemo, useState } from "react";
import { FaPlus, FaSort, FaSortDown, FaSortUp, FaTrash } from "react-icons/fa";
import { useToast } from "@/component/toast/ToastContext";
import { useFinancial } from "@/context/FinancialContext";
import { refreshWalletCache } from "@/hooks/useIncomes";
import { parseLocalDate } from "@/utils/cashFlow";
import { formatCurrency } from "@/utils/formatters";
import { deleteIncome, type BuckIncome } from "@/utils/supabaseData";
import styles from "./income.module.css";
import DangerDeleteDialog from "@/component/DangerDeleteDialog";

const visibleIncomeCount = 20;

type SortKey = "date" | "category" | "amount";
type SortDir = "asc" | "desc";

export type IncomeWalletRef = { id: string; name: string; deletedAt?: string | null };

function formatIncomeDate(value: string) {
  const date = parseLocalDate(value);
  return date
    ? date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      })
    : value;
}

const COLUMNS: { key: SortKey | null; label: string; className?: string }[] = [
  { key: "date", label: "Date" },
  { key: "category", label: "Category" },
  { key: null, label: "Description", className: styles.colDesc },
  { key: null, label: "Wallet", className: styles.colWallet },
  { key: "amount", label: "Amount", className: styles.colAmount },
];

/** Loading twin of the table: same classes and row anatomy for zero layout shift. */
export function IncomeListSkeleton({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <section aria-hidden="true" className={styles.incomeSection}>
      {!embedded && (
        <div className={styles.listHeader}>
          <div>
            <p className={styles.eyebrow}>
              <span className="skeleton-text">Income</span>
            </p>
            <h2 className={styles.listTitle}>
              <span className="skeleton-text">Income history</span>
            </h2>
          </div>
          <span className={`${styles.primaryBtn} skeleton-text`}>+ Add Income</span>
        </div>
      )}
      <div className={styles.summary}>
        {["Entries", "Total", "Average", "Largest"].map((label) => (
          <div key={label} className={styles.summaryStat}>
            <span className={styles.summaryLabel}><span className="skeleton-text">{label}</span></span>
            <span className={styles.summaryValue}><span className="skeleton-text">₱00,000</span></span>
          </div>
        ))}
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              {COLUMNS.map((c) => (
                <th key={c.label} className={c.className}>
                  <span className="skeleton-text">{c.label}</span>
                </th>
              ))}
              <th className={styles.colAction} />
            </tr>
          </thead>
          <tbody>
            {[0, 1, 2, 3].map((row) => (
              <tr key={row}>
                <td><span className="skeleton-text">Oct 1, 2026</span></td>
                <td><span className={`${styles.categoryPill} skeleton-text`}>Salary</span></td>
                <td className={styles.colDesc}><span className="skeleton-text">Salary payout</span></td>
                <td className={styles.colWallet}><span className="skeleton-text">Main wallet</span></td>
                <td className={styles.colAmount}><span className="skeleton-text">+₱00,000.00</span></td>
                <td className={styles.colAction}><span className={`${styles.deleteBtn} skeleton-text`} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function IncomeList({
  userId,
  incomes,
  tracked,
  onAdd,
  onChanged,
  embedded = false,
  query = "",
  wallets = [],
}: {
  userId: string;
  incomes: BuckIncome[];
  tracked: boolean;
  onAdd: () => void;
  onChanged: () => void;
  /** Hide the card header (the host card supplies its own title and Add button). */
  embedded?: boolean;
  /** Case-insensitive filter on category, description and wallet. */
  query?: string;
  /** Wallets, to show which wallet each income was credited to. */
  wallets?: IncomeWalletRef[];
}) {
  const { toast } = useToast();
  const { setDashboardCache } = useFinancial();
  const [pendingDelete, setPendingDelete] = useState<BuckIncome | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const walletName = useMemo(() => {
    const map = new Map(wallets.map((w) => [w.id, w]));
    return (id?: string | null) => {
      if (!id) return "—";
      const w = map.get(id);
      if (!w) return "—";
      return w.deletedAt ? `${w.name} (archived)` : w.name;
    };
  }, [wallets]);

  const matching = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? incomes.filter(
          (income) =>
            income.source.toLowerCase().includes(needle) ||
            (income.description ?? "").toLowerCase().includes(needle) ||
            walletName(income.walletId).toLowerCase().includes(needle)
        )
      : incomes;
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      if (sortKey === "amount") return (a.amount - b.amount) * dir;
      if (sortKey === "category") return a.source.localeCompare(b.source) * dir;
      return (a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt)) * dir;
    });
  }, [incomes, query, sortDir, sortKey, walletName]);

  const visible = showAll ? matching : matching.slice(0, visibleIncomeCount);
  const total = matching.reduce((sum, i) => sum + (Number(i.amount) || 0), 0);
  const largest = matching.reduce((max, i) => Math.max(max, Number(i.amount) || 0), 0);
  const average = matching.length > 0 ? total / matching.length : 0;

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir(key === "category" ? "asc" : "desc");
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    try {
      await deleteIncome(userId, pendingDelete.id);
      await refreshWalletCache(userId, setDashboardCache);
      toast("Income deleted", "success");
      setPendingDelete(null);
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete income", "error");
    }
  };

  return (
    <section aria-label="Income history" className={styles.incomeSection}>
      {!embedded && (
        <div className={styles.listHeader}>
          <div>
            <p className={styles.eyebrow}>Income</p>
            <h2 className={styles.listTitle}>Income history</h2>
          </div>
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={onAdd}
            disabled={!tracked}
          >
            <FaPlus aria-hidden="true" /> Add Income
          </button>
        </div>
      )}

      {!tracked ? (
        <p className={styles.empty}>Income tracking is not available yet.</p>
      ) : incomes.length === 0 ? (
        <p className={styles.empty}>No income recorded yet.</p>
      ) : (
        <>
          {/* Summary of the rows currently shown by the search */}
          <div className={styles.summary} aria-label="Income summary">
            <div className={styles.summaryStat}>
              <span className={styles.summaryLabel}>Entries</span>
              <span className={styles.summaryValue}>{matching.length}</span>
            </div>
            <div className={styles.summaryStat}>
              <span className={styles.summaryLabel}>Total</span>
              <span className={`${styles.summaryValue} ${styles.summaryValueIncome}`}>
                {formatCurrency(total)}
              </span>
            </div>
            <div className={styles.summaryStat}>
              <span className={styles.summaryLabel}>Average</span>
              <span className={styles.summaryValue}>{formatCurrency(average)}</span>
            </div>
            <div className={styles.summaryStat}>
              <span className={styles.summaryLabel}>Largest</span>
              <span className={styles.summaryValue}>{formatCurrency(largest)}</span>
            </div>
          </div>

          {matching.length === 0 ? (
            <p className={styles.empty}>No income matches your search.</p>
          ) : (
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    {COLUMNS.map((col) => (
                      <th
                        key={col.label}
                        className={col.className}
                        scope="col"
                        aria-sort={
                          col.key && col.key === sortKey
                            ? sortDir === "asc"
                              ? "ascending"
                              : "descending"
                            : undefined
                        }
                      >
                        {col.key ? (
                          <button
                            type="button"
                            className={styles.sortBtn}
                            onClick={() => toggleSort(col.key as SortKey)}
                          >
                            {col.label}
                            {col.key === sortKey ? (
                              sortDir === "asc" ? (
                                <FaSortUp aria-hidden="true" />
                              ) : (
                                <FaSortDown aria-hidden="true" />
                              )
                            ) : (
                              <FaSort aria-hidden="true" className={styles.sortIdle} />
                            )}
                          </button>
                        ) : (
                          col.label
                        )}
                      </th>
                    ))}
                    <th scope="col" className={styles.colAction}>
                      <span className={styles.srOnly}>Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((income) => (
                    <tr key={income.id}>
                      <td className={styles.colDate}>{formatIncomeDate(income.date)}</td>
                      <td>
                        <span className={styles.categoryPill}>{income.source}</span>
                      </td>
                      <td className={styles.colDesc} title={income.description}>
                        {income.description || <span className={styles.muted}>—</span>}
                      </td>
                      <td className={styles.colWallet}>{walletName(income.walletId)}</td>
                      <td className={`${styles.colAmount} ${styles.amount}`}>
                        +{formatCurrency(income.amount)}
                      </td>
                      <td className={styles.colAction}>
                        <button
                          type="button"
                          className={styles.deleteBtn}
                          onClick={() => setPendingDelete(income)}
                          aria-label={`Delete ${income.source} income of ${formatCurrency(income.amount)}`}
                        >
                          <FaTrash aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {matching.length > visibleIncomeCount && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.secondaryBtn}
            onClick={() => setShowAll((current) => !current)}
          >
            {showAll ? "Show less" : `Show all (${matching.length})`}
          </button>
        </div>
      )}

      <DangerDeleteDialog
        open={Boolean(pendingDelete)}
        itemType="income"
        itemName={pendingDelete?.source ?? ""}
        consequences={
          pendingDelete
            ? [
                `${formatCurrency(pendingDelete.amount)} received ${formatIncomeDate(pendingDelete.date)} is removed from your history.`,
                `That amount is taken back out of your wallet balance (never below ${formatCurrency(0)}).`,
              ]
            : []
        }
        onCancel={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}
