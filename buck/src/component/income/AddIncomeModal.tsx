"use client";

import { useEffect, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import CustomDatePicker from "@/component/CustomDatePicker";
import CustomSelect from "@/component/CustomSelect";
import { useToast } from "@/component/toast/ToastContext";
import { useFinancial } from "@/context/FinancialContext";
import { refreshWalletCache } from "@/hooks/useIncomes";
import { toLocalDateString } from "@/utils/cashFlow";
import { formatCurrency } from "@/utils/formatters";
import {
  addIncome,
  getActiveWallet,
  incomeSources,
  listIncomeCategories,
  type BuckWallet,
} from "@/utils/supabaseData";
import styles from "./income.module.css";

export default function AddIncomeModal({
  open,
  userId,
  onClose,
  onSaved,
}: {
  open: boolean;
  userId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const { toast } = useToast();
  const { setDashboardCache } = useFinancial();
  const [portalReady, setPortalReady] = useState(false);
  const [wallet, setWallet] = useState<BuckWallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [source, setSource] = useState<string>("");
  // The user's income categories (ADR-042); the fixed list until migration
  // 202610130002 is applied or while loading.
  const [categoryNames, setCategoryNames] = useState<string[]>([...incomeSources]);
  const [date, setDate] = useState(() => toLocalDateString(new Date()));
  const [description, setDescription] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  useEffect(() => {
    if (!open) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    let active = true;
    setAmount("");
    setSource("");
    setDescription("");
    setError("");
    setDate(toLocalDateString(new Date()));
    setWalletLoading(true);

    listIncomeCategories(userId)
      .then((cats) => {
        if (active && cats && cats.length > 0) setCategoryNames(cats.map((c) => c.name));
      })
      .catch(() => {
        /* keep the fixed list */
      });

    getActiveWallet(userId)
      .then((activeWallet) => {
        if (active) setWallet(activeWallet);
      })
      .catch(() => {
        if (active) setWallet(null);
      })
      .finally(() => {
        if (active) setWalletLoading(false);
      });

    return () => {
      active = false;
    };
  }, [open, userId]);

  const today = toLocalDateString(new Date());

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");

    if (!wallet) {
      setError("Create or select a wallet first to add income.");
      return;
    }

    const value = Number(amount);
    if (!amount.trim() || !Number.isFinite(value) || value <= 0) {
      setError("Enter an amount greater than 0.");
      return;
    }
    if (!source) {
      setError("Choose an income category.");
      return;
    }
    if (!date || date > today) {
      setError("Choose today or an earlier date.");
      return;
    }

    setSaving(true);
    try {
      await addIncome(userId, {
        walletId: wallet.id,
        amount: value,
        source,
        description,
        date,
      });
      await refreshWalletCache(userId, setDashboardCache);
      toast(`Added ${formatCurrency(value)} to ${wallet.name}`, "success");
      onSaved?.();
      onClose();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to add income.";
      setError(message);
      toast("Failed to add income", "error");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !portalReady) return null;

  return createPortal(
    <motion.div
      className={styles.backdrop}
      onClick={onClose}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
    >
      <motion.div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Add income"
        onClick={(event) => event.stopPropagation()}
        initial={{ y: 20, opacity: 0, scale: 0.95 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 20, opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
      >
        <h2 className={styles.title}>Add Income</h2>
        <p className={styles.subtitle}>
          {wallet
            ? `Credits ${wallet.name} (${formatCurrency(wallet.budget)})`
            : walletLoading
            ? "Loading your active wallet..."
            : "No active wallet"}
        </p>

        {!walletLoading && !wallet ? (
          <>
            <div className={styles.notice}>
              Create or select a wallet first to add income.
            </div>
            <div className={styles.actions}>
              <button type="button" className={styles.secondaryBtn} onClick={onClose}>
                Close
              </button>
            </div>
          </>
        ) : (
          <form className={styles.form} onSubmit={handleSubmit} noValidate>
            <label className={styles.field}>
              Amount (PHP)
              <input
                className={styles.input}
                type="number"
                inputMode="decimal"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                autoFocus
                required
              />
            </label>

            <div className={styles.field}>
              Category
              <CustomSelect
                value={source}
                onChange={setSource}
                options={[
                  { value: "", label: "Select a category" },
                  ...categoryNames.map((item) => ({ value: item, label: item })),
                ]}
              />
            </div>

            <div className={styles.field}>
              Date
              <CustomDatePicker value={date} onChange={setDate} max={today} required />
            </div>

            <label className={styles.field}>
              Description (optional)
              <input
                className={styles.input}
                type="text"
                maxLength={120}
                placeholder="e.g. October salary"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>

            {error && <div className={styles.error}>{error}</div>}

            <div className={styles.actions}>
              <button type="button" className={styles.secondaryBtn} onClick={onClose}>
                Cancel
              </button>
              <button
                type="submit"
                className={styles.primaryBtn}
                disabled={saving || walletLoading}
              >
                {saving ? "Adding..." : "Add Income"}
              </button>
            </div>
          </form>
        )}
      </motion.div>
    </motion.div>,
    document.body
  );
}
