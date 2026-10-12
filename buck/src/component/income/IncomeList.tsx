"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { FaPlus, FaTrash } from "react-icons/fa";
import { useToast } from "@/component/toast/ToastContext";
import { useFinancial } from "@/context/FinancialContext";
import { refreshWalletCache } from "@/hooks/useIncomes";
import { parseLocalDate } from "@/utils/cashFlow";
import { formatCurrency } from "@/utils/formatters";
import { deleteIncome, type BuckIncome } from "@/utils/supabaseData";
import styles from "./income.module.css";

const visibleIncomeCount = 20;

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

/** Loading twin of the list: same classes and row anatomy for zero layout shift. */
export function IncomeListSkeleton({ embedded = false }: { embedded?: boolean } = {}) {
  return (
    <section aria-hidden="true">
      {!embedded && (
      <div className={styles.listHeader}>
        <div>
          <p className={styles.eyebrow}>
            <span className="skeleton-text">Income</span>
          </p>
          <h2 className={styles.listTitle}>
            <span className="skeleton-text">Recent income</span>
          </h2>
        </div>
        <span className={`${styles.primaryBtn} skeleton-text`}>+ Add Income</span>
      </div>
      )}
      <ul className={styles.list}>
        {[0, 1, 2].map((row) => (
          <li key={row} className={styles.item}>
            <div className={styles.itemMain}>
              <span className={styles.itemSource}>
                <span className="skeleton-text">Salary</span>
              </span>
              <span className={styles.itemMeta}>
                <span className="skeleton-text">Jan 1, 2026 • Monthly salary</span>
              </span>
            </div>
            <div className={styles.itemSide}>
              <span className={styles.amount}>
                <span className="skeleton-text">+₱00,000</span>
              </span>
              <span className={styles.deleteBtn}>
                <span className="skeleton-avatar" style={{ width: "1em", height: "1em" }} />
              </span>
            </div>
          </li>
        ))}
      </ul>
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
}: {
  userId: string;
  incomes: BuckIncome[];
  tracked: boolean;
  onAdd: () => void;
  onChanged: () => void;
  /** Hide the card header (the host card supplies its own title and Add button). */
  embedded?: boolean;
  /** Case-insensitive filter on source and description. */
  query?: string;
}) {
  const { toast } = useToast();
  const { setDashboardCache } = useFinancial();
  const [pendingDelete, setPendingDelete] = useState<BuckIncome | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const needle = query.trim().toLowerCase();
  const matching = needle
    ? incomes.filter(
        (income) =>
          income.source.toLowerCase().includes(needle) ||
          (income.description ?? "").toLowerCase().includes(needle)
      )
    : incomes;
  const visible = showAll ? matching : matching.slice(0, visibleIncomeCount);

  const confirmDelete = async () => {
    if (!pendingDelete) return;

    setDeleting(true);
    try {
      await deleteIncome(userId, pendingDelete.id);
      await refreshWalletCache(userId, setDashboardCache);
      toast("Income deleted", "success");
      setPendingDelete(null);
      onChanged();
    } catch (err) {
      toast(err instanceof Error ? err.message : "Failed to delete income", "error");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <section aria-label="Income history">
      {!embedded && (
      <div className={styles.listHeader}>
        <div>
          <p className={styles.eyebrow}>Income</p>
          <h2 className={styles.listTitle}>Recent income</h2>
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
      ) : matching.length === 0 ? (
        <p className={styles.empty}>No income matches your search.</p>
      ) : (
        <ul className={styles.list}>
          {visible.map((income) => (
            <li key={income.id} className={styles.item}>
              <div className={styles.itemMain}>
                <span className={styles.itemSource}>{income.source}</span>
                <span className={styles.itemMeta}>
                  {formatIncomeDate(income.date)}
                  {income.description ? ` • ${income.description}` : ""}
                </span>
              </div>
              <div className={styles.itemSide}>
                <span className={styles.amount}>+{formatCurrency(income.amount)}</span>
                <button
                  type="button"
                  className={styles.deleteBtn}
                  onClick={() => setPendingDelete(income)}
                  aria-label={`Delete ${income.source} income of ${formatCurrency(income.amount)}`}
                >
                  <FaTrash aria-hidden="true" />
                </button>
              </div>
            </li>
          ))}
        </ul>
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

      {pendingDelete &&
        createPortal(
          <div
            className={`${styles.backdrop} ${styles.confirmBackdrop}`}
            onClick={() => !deleting && setPendingDelete(null)}
          >
            <div
              className={styles.confirmModal}
              role="alertdialog"
              aria-modal="true"
              aria-label="Delete income"
              onClick={(event) => event.stopPropagation()}
            >
              <h3>Delete income?</h3>
              <p>
                This removes {formatCurrency(pendingDelete.amount)} from your wallet
                balance. The balance never goes below {formatCurrency(0)}.
              </p>
              <div className={styles.actions}>
                <button
                  type="button"
                  className={styles.secondaryBtn}
                  onClick={() => setPendingDelete(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={styles.dangerBtn}
                  onClick={confirmDelete}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete"}
                </button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </section>
  );
}
