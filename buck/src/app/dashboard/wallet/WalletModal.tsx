"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./WalletModal.module.css";
import { AnimatePresence, LayoutGroup, motion, useReducedMotion } from "framer-motion";
import {
  backdropMotion,
  DURATION,
  EASE_OUT,
  INSTANT,
  panelMotion,
  SPRING,
} from "@/utils/motion";
import { useOptionalDashboardUser } from "@/context/DashboardUserContext";
import { mergeDashboardDataCache, useFinancial } from "@/context/FinancialContext";
import { useEscapeKey } from "@/hooks/useEscapeKey";
import { useIsClient } from "@/hooks/useIsClient";
import { useUserTable } from "@/hooks/useUserTable";
import {
  formatCurrency,
  formatEditableBudget,
  parseBudgetInput,
  sanitizeBudgetInput,
} from "@/utils/formatters";
import DangerDeleteDialog from "@/component/DangerDeleteDialog";
import {
  addWallet,
  deleteWallet,
  setActiveWallet,
  updateWallet,
  type BuckWallet,
} from "@/utils/supabaseData";

export default function WalletModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [activatingId, setActivatingId] = useState<string | null>(null);
  const isClient = useIsClient();
  const prefersReducedMotion = useReducedMotion();

  const user = useOptionalDashboardUser();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const {
    data: walletsData,
    loading,
    refresh: refreshWallets,
  } = useUserTable("wallets");
  const wallets = walletsData ?? [];
  const activeWalletId =
    user && dashboardCache.userId === user.uid
      ? (dashboardCache.activeWalletId ?? null)
      : null;

  useEscapeKey(open && !confirmDeleteId, onClose);

  useEffect(() => {
    if (!open) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const parsedBudget = parseBudgetInput(budget);
    if (!name.trim() || parsedBudget === null) {
      setError("Please enter a valid name and a budget greater than 0.");
      return;
    }
    if (!user) return;
    try {
      await addWallet(user.uid, name.trim(), parsedBudget);
      setName("");
      setBudget("");
      await refreshWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add wallet");
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteWallet(user.uid, id);
      if (activeWalletId === id) {
        await setActiveWallet(user.uid, null);
        setDashboardCache((current) =>
          mergeDashboardDataCache(current, user.uid, {
            activeWalletId: null,
            activeWalletBudget: 0,
          })
        );
      }
      setConfirmDeleteId(null);
      await refreshWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete wallet");
    }
  };

  const handleEdit = (wallet: BuckWallet) => {
    setEditId(wallet.id);
    setEditName(wallet.name);
    setEditBudget(formatEditableBudget(wallet.budget));
  };

  const handleEditSave = async (id: string) => {
    if (!user) return;
    const parsedBudget = parseBudgetInput(editBudget);
    if (!editName.trim() || parsedBudget === null) {
      setError("Please enter a valid name and a budget greater than 0.");
      return;
    }
    try {
      await updateWallet(user.uid, id, {
        name: editName.trim(),
        budget: parsedBudget,
      });
      setEditId(null);
      setEditName("");
      setEditBudget("");
      setError("");
      await refreshWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update wallet");
    }
  };

  const handleEditCancel = () => {
    setEditId(null);
    setEditName("");
    setEditBudget("");
    setError("");
  };

  const handleSetActive = async (id: string) => {
    if (!user || activatingId) return;
    setError("");
    setActivatingId(id);
    try {
      await setActiveWallet(user.uid, id);
      const newActiveWallet = wallets.find((w) => w.id === id);
      setDashboardCache((current) =>
        mergeDashboardDataCache(current, user.uid, {
          activeWalletId: id,
          ...(newActiveWallet ? { activeWalletBudget: newActiveWallet.budget } : {}),
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to set active wallet");
    } finally {
      setActivatingId(null);
    }
  };

  const activeWallets = wallets.filter(w => !w.deletedAt);
  const totalBudget = activeWallets.reduce(
    (sum, w) => sum + (Number(w.budget) || 0),
    0
  );
  const sortedWallets = [
    ...activeWallets.filter((w) => w.id === activeWalletId),
    ...activeWallets.filter((w) => w.id !== activeWalletId),
  ];

  if (!isClient) return null;

  return createPortal(
    <>
      <AnimatePresence>
        {open && (
          <motion.div
            className={styles.backdrop}
            onClick={onClose}
            {...backdropMotion}
          >
            <motion.div
              className={`${styles.modal} buck-modal-panel buck-modal-accent`}
              role="dialog"
              aria-modal="true"
              aria-label="Manage wallets"
              onClick={(e) => e.stopPropagation()}
              {...panelMotion}
            >
              <div className={`${styles.modalBody} buck-modal-scroll`}>
                <h2 className={`${styles.title} buck-modal-title`}>Wallets</h2>
        <p className={`${styles.totalBudget} buck-modal-subtitle`}>
          Total budget: <span>{formatCurrency(totalBudget)}</span>
        </p>
        <form onSubmit={handleAddWallet} className={`${styles.form} buck-modal-form`}>
          <label className="buck-modal-field">
            <span>Wallet name</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Cash, GCash, BPI..."
              className={styles.input}
            />
          </label>
          <label className="buck-modal-field">
            <span>Budget (PHP)</span>
            <input
              value={budget}
              onChange={(e) => setBudget(sanitizeBudgetInput(e.target.value))}
              placeholder="0.00"
              type="text"
              inputMode="decimal"
              className={styles.input}
            />
          </label>
          {error && <div className={styles.error}>{error}</div>}
          <div className="buck-modal-actions">
            <button type="submit" className="buck-modal-btn buck-modal-btn--primary">
              Add wallet
            </button>
          </div>
        </form>
        <div className={styles.listSection}>
          {loading ? (
            <div className={styles.emptyState}>Loading...</div>
          ) : activeWallets.length === 0 ? (
            <div className={styles.emptyState}>No active wallets yet.</div>
          ) : (
            <LayoutGroup id="wallet-modal-list">
              <ul className={styles.list}>
                {sortedWallets.map((w) => {
                  const isActive = w.id === activeWalletId;
                  const isEditing = editId === w.id;
                  return (
                    <motion.li
                      key={w.id}
                      layout={!prefersReducedMotion}
                      transition={prefersReducedMotion ? INSTANT : { layout: SPRING }}
                      style={{ zIndex: isActive ? 2 : 1 }}
                      className={
                        isActive ? `${styles.listItem} ${styles.active}` : styles.listItem
                      }
                    >
                      <motion.span
                        aria-hidden="true"
                        className={styles.activeOverlay}
                        initial={false}
                        animate={{ opacity: isActive ? 1 : 0 }}
                        transition={
                          prefersReducedMotion
                            ? INSTANT
                            : { duration: DURATION.base, ease: EASE_OUT }
                        }
                      />
                      {isEditing ? (
                        <>
                          <motion.div
                            layout={prefersReducedMotion ? false : "position"}
                            className={styles.editFields}
                          >
                            <input
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              aria-label="Wallet name"
                              className={styles.editInput}
                            />
                            <input
                              value={editBudget}
                              onChange={(e) => setEditBudget(sanitizeBudgetInput(e.target.value))}
                              type="text"
                              inputMode="decimal"
                              aria-label="Budget (PHP)"
                              className={styles.editInput}
                            />
                          </motion.div>
                          <motion.div
                            layout={prefersReducedMotion ? false : "position"}
                            className={styles.actions}
                          >
                            <button
                              type="button"
                              onClick={() => handleEditSave(w.id)}
                              className={styles.saveBtn}
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={handleEditCancel}
                              className={styles.cancelBtn}
                            >
                              Cancel
                            </button>
                          </motion.div>
                        </>
                      ) : (
                        <>
                          <motion.span
                            layout={prefersReducedMotion ? false : "position"}
                            className={styles.nameBalance}
                          >
                            <span className={styles.name}>{w.name}</span>
                            <span aria-hidden="true"> - </span>
                            <span className={styles.balance}>
                              {formatCurrency(w.budget)}
                            </span>
                            {isActive && (
                              <motion.span
                                initial={prefersReducedMotion ? false : { opacity: 0 }}
                                animate={{ opacity: 1 }}
                                transition={
                                  prefersReducedMotion
                                    ? INSTANT
                                    : { duration: DURATION.fast, ease: EASE_OUT }
                                }
                                className={styles.activeLabel}
                              >
                                (Active)
                              </motion.span>
                            )}
                          </motion.span>
                          <motion.div
                            layout={prefersReducedMotion ? false : "position"}
                            className={`${styles.actions} ${styles.actionsMargin}`}
                          >
                            <button
                              type="button"
                              onClick={() => handleSetActive(w.id)}
                              className={styles.setActiveBtn}
                              disabled={isActive}
                              aria-busy={activatingId === w.id}
                            >
                              Set Active
                            </button>
                            <button
                              type="button"
                              onClick={() => handleEdit(w)}
                              className={styles.editBtn}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(w.id)}
                              className={styles.deleteBtn}
                              disabled={w.budget > 0}
                              title={w.budget > 0 ? "Empty wallet first to delete" : ""}
                            >
                              Delete
                            </button>
                          </motion.div>
                        </>
                      )}
                    </motion.li>
                  );
                })}
              </ul>
            </LayoutGroup>
          )}
        </div>
                <div className="buck-modal-actions">
                  <button
                    type="button"
                    onClick={onClose}
                    className="buck-modal-btn buck-modal-btn--secondary"
                  >
                    Close
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <DangerDeleteDialog
        open={Boolean(confirmDeleteId)}
        itemType="wallet"
        itemName={wallets.find((w) => w.id === confirmDeleteId)?.name ?? ""}
        consequences={["The wallet is archived and stays in Wallet history; it cannot be restored."]}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={async () => {
          if (confirmDeleteId) await handleDelete(confirmDeleteId);
        }}
      />
    </>,
    document.body
  );
}
