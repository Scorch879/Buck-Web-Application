"use client";

import React, { useEffect, useRef, useState, type FormEvent } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FaPlus, FaTimes, FaExclamationTriangle } from "react-icons/fa";
import CustomSelect from "@/component/CustomSelect";
import CustomDatePicker from "@/component/CustomDatePicker";
import { useToast } from "@/component/toast/ToastContext";
import { toLocalDateString } from "@/utils/cashFlow";
import { addMoney, formatCurrency, parseMoneyInput } from "@/utils/formatters";
import {
  addExpenseWithWalletDeduction,
  type BuckCategory,
} from "@/utils/supabaseData";

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

interface AddExpenseModalProps {
  open: boolean;
  onClose: () => void;
  categories: BuckCategory[];
  walletBudget: number;
  userId: string;
  onExpenseAdded: () => Promise<void> | void;
}

export default function AddExpenseModal({
  open,
  onClose,
  categories,
  walletBudget,
  userId,
  onExpenseAdded,
}: AddExpenseModalProps) {
  const { toast } = useToast();
  const [portalReady, setPortalReady] = useState(false);

  const [amount, setAmount] = useState("");
  const [categoryName, setCategoryName] = useState("");
  const [description, setDescription] = useState("");
  const [spentOn, setSpentOn] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const amountInputRef = useRef<HTMLInputElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setPortalReady(true);
  }, []);

  // Reset fields only on the closed -> open transition so background category
  // refreshes never wipe what the user is typing.
  useEffect(() => {
    if (!open) return;
    returnFocusRef.current = document.activeElement as HTMLElement | null;
    setAmount("");
    setDescription("");
    setError("");
    setSpentOn(toLocalDateString(new Date()));
    setCategoryName(categories[0]?.name || "Uncategorized");
    const focusTimer = window.setTimeout(() => amountInputRef.current?.focus(), 0);
    return () => {
      window.clearTimeout(focusTimer);
      returnFocusRef.current?.focus?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Default the category once categories arrive, without touching a user's choice.
  useEffect(() => {
    if (!open) return;
    setCategoryName((current) => current || categories[0]?.name || "Uncategorized");
  }, [open, categories]);

  // Lock body scroll while open
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [open]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, saving, onClose]);

  const numAmount = parseMoneyInput(amount) ?? 0;
  const isOverBudget =
    Number.isFinite(numAmount) &&
    numAmount > 0 &&
    walletBudget > 0 &&
    numAmount > walletBudget;

  const handleQuickAdd = (preset: number) => {
    const current = parseMoneyInput(amount) ?? 0;
    setAmount(addMoney(current, preset).toString());
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;

    const nextAmount = parseMoneyInput(amount);
    if (nextAmount === null) {
      setError("Enter an amount greater than 0 with up to 2 decimals (e.g. 125.50).");
      return;
    }

    setSaving(true);
    setError("");

    try {
      await addExpenseWithWalletDeduction(userId, {
        amount: nextAmount,
        categoryName: categoryName || "Uncategorized",
        date: spentOn || toLocalDateString(new Date()),
        description: description.trim() || "Expense",
      });

      // The expense is saved from here on; a refresh failure must not look like a failed save.
      toast("Expense added successfully", "success");
      onClose();
      try {
        await onExpenseAdded();
      } catch {
        toast("Saved, but the list failed to refresh. Reload to see it.", "error");
      }
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not add expense.";
      setError(msg);
      toast(msg, "error");
    } finally {
      setSaving(false);
    }
  };

  if (!portalReady) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="expenses-modal-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving) {
              onClose();
            }
          }}
          role="presentation"
        >
          <motion.div
            className="expenses-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-expense-modal-title"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: "spring", stiffness: 420, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="expenses-modal-header">
              <div>
                <p className="expenses-eyebrow">New Expense</p>
                <h2 id="add-expense-modal-title">Add Spending</h2>
              </div>
              <button
                type="button"
                className="expenses-modal-close-btn"
                onClick={onClose}
                disabled={saving}
                aria-label="Close add spending dialog"
              >
                <FaTimes aria-hidden="true" />
              </button>
            </div>

            {/* Error callout */}
            {error && (
              <div className="expenses-modal-error" role="alert">
                <FaExclamationTriangle aria-hidden="true" />
                <span>{error}</span>
              </div>
            )}

            {/* Form */}
            <form onSubmit={handleSubmit} className="expenses-modal-form">
              {/* Amount */}
              <label>
                <span>Amount (PHP)</span>
                <input
                  type="text"
                  value={amount}
                  inputMode="decimal"
                  onChange={(e) => setAmount(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="0.00"
                  disabled={saving}
                  ref={amountInputRef}
                  maxLength={15}
                  pattern="\d{1,12}(\.\d{1,2})?"
                  title="Up to 12 digits and 2 decimals"
                />
              </label>

              {/* Quick Amount Presets */}
              <div className="expenses-quick-amounts" aria-label="Quick amount presets">
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

              {/* Budget Warning */}
              {isOverBudget && (
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
              )}

              {/* Category */}
              <label>
                <span>Category</span>
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

              {/* Date */}
              <label>
                <span>Date</span>
                <CustomDatePicker
                  value={spentOn}
                  onChange={(val) => setSpentOn(val)}
                />
              </label>

              {/* Description */}
              <label>
                <span>Description</span>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Lunch, fare, grocery, coffee..."
                  disabled={saving}
                />
              </label>

              {/* Footer Actions */}
              <div className="expenses-modal-footer">
                <button
                  type="button"
                  className="expenses-modal-cancel-btn"
                  onClick={onClose}
                  disabled={saving}
                >
                  Cancel
                </button>
                <motion.button
                  type="submit"
                  className="expenses-modal-submit-btn"
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
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}
