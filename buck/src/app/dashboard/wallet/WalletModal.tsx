"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import styles from "./WalletModal.module.css";
import { motion } from "framer-motion";
import { useOptionalDashboardUser } from "@/context/DashboardUserContext";
import { usePointerGradient } from "@/hooks/usePointerGradient";
import { formatCurrency } from "@/utils/formatters";
import {
  addWallet,
  deleteWallet,
  getActiveWalletId,
  listWallets,
  setActiveWallet,
  subscribeUserTable,
  updateWallet,
  type BuckWallet,
} from "@/utils/supabaseData";

type Wallet = BuckWallet;

export default function WalletModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [activeWalletId, setActiveWalletId] = useState<string | null>(null);
  const addButton = usePointerGradient<HTMLButtonElement>();
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [justActivatedId, setJustActivatedId] = useState<string | null>(null);
  const [portalReady, setPortalReady] = useState(false);

  const user = useOptionalDashboardUser();

  useEffect(() => {
    setPortalReady(true);
  }, []);

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

  const fetchWallets = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const walletsArr = await listWallets(user.uid);
      setWallets(walletsArr);

      if (walletsArr.length === 1) {
        await setActiveWallet(user.uid, walletsArr[0].id);
        setActiveWalletId(walletsArr[0].id);
      }
    } catch (error) {
      setError(error instanceof Error ? error.message : "Failed to load wallets.");
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveWallet = async () => {
    if (!user) return;
    try {
      setActiveWalletId(await getActiveWalletId(user.uid));
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Failed to load active wallet."
      );
    }
  };

  useEffect(() => {
    if (!open || !user) {
      return;
    }

    fetchWallets();
    fetchActiveWallet();

    const unsubscribeWallets = subscribeUserTable("wallets", user.uid, () => {
      void fetchWallets();
    });

    return () => {
      unsubscribeWallets();
    };
  }, [open, user]);

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!name.trim() || !budget.trim() || isNaN(Number(budget)) || Number(budget) <= 0) {
      setError("Please enter a valid name and a budget greater than 0.");
      return;
    }
    if (!user) return;
    await addWallet(user.uid, name, Number(budget));
    setName("");
    setBudget("");
    fetchWallets();
    fetchActiveWallet();
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    await deleteWallet(user.uid, id);
    if (activeWalletId === id) {
      await setActiveWallet(user.uid, null);
      setActiveWalletId(null);
    }
    fetchWallets();
    fetchActiveWallet();
  };

  const handleEdit = (wallet: Wallet) => {
    setEditId(wallet.id);
    setEditName(wallet.name);
    setEditBudget(wallet.budget.toString());
  };

  const handleEditSave = async (id: string) => {
    if (!user) return;
    if (!editName.trim() || !editBudget.trim() || isNaN(Number(editBudget)) || Number(editBudget) <= 0) {
      setError("Please enter a valid name and a budget greater than 0.");
      return;
    }
    await updateWallet(user.uid, id, {
      name: editName,
      budget: Number(editBudget),
    });
    setEditId(null);
    setEditName("");
    setEditBudget("");
    setError("");
    fetchWallets();
  };

  const handleEditCancel = () => {
    setEditId(null);
    setEditName("");
    setEditBudget("");
    setError("");
  };

  const handleSetActive = async (id: string) => {
    if (!user) return;
    await setActiveWallet(user.uid, id);
    setActiveWalletId(id);
    setJustActivatedId(id);
    setTimeout(() => setJustActivatedId(null), 900);
  };

  const totalBudget = wallets.reduce(
    (sum, w) => sum + (Number(w.budget) || 0),
    0
  );
  const sortedWallets = [
    ...wallets.filter((w) => w.id === activeWalletId),
    ...wallets.filter((w) => w.id !== activeWalletId),
  ];

  if (!open || !portalReady) return null;

  return createPortal(
    <div className={styles.backdrop} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>Wallets</h2>
        <div className={styles.totalBudget}>
          Total Budget: <span>{formatCurrency(totalBudget)}</span>
        </div>
        <form onSubmit={handleAddWallet} className={styles.form}>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Wallet Name"
            className={styles.input}
          />
          <input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Budget"
            type="number"
            min="0"
            className={styles.input}
          />
          <motion.button
            ref={addButton.ref}
            type="submit"
            className={styles.addBtn}
            onMouseMove={addButton.handlePointerMove}
            onMouseLeave={addButton.handlePointerLeave}
            style={{
              background: addButton.pointer
                ? `radial-gradient(circle at ${addButton.pointer.x}px ${addButton.pointer.y}px, var(--buck-gold) 0%, var(--buck-orange) 48%, var(--buck-coral) 100%)`
                : "linear-gradient(135deg, var(--buck-orange), var(--buck-coral))",
              transition: addButton.pointer ? "background 0.1s" : "background 0.3s",
            }}
            whileHover={{ scale: 1.03 }}
          >
            Add Wallet
          </motion.button>
          {error && <div className={styles.error}>{error}</div>}
        </form>
        <div className={styles.listSection}>
          {loading ? (
            <div>Loading...</div>
          ) : wallets.length === 0 ? (
            <div>No wallets yet.</div>
          ) : (
            <ul className={styles.list}>
              {sortedWallets.map((w) => (
                <li
                  key={w.id}
                  className={
                    w.id === activeWalletId
                      ? `${styles.listItem} ${styles.active} ${justActivatedId === w.id ? styles.justActivated : ''}`
                      : styles.listItem
                  }
                >
                  {editId === w.id ? (
                    <>
                      <input
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        className={styles.editInput}
                      />
                      <input
                        value={editBudget}
                        onChange={(e) => setEditBudget(e.target.value)}
                        type="number"
                        min="0"
                        className={styles.editInput}
                      />
                      <div className={styles.actions}>
                        <button
                          onClick={() => handleEditSave(w.id)}
                          className={styles.saveBtn}
                        >
                          Save
                        </button>
                        <button
                          onClick={handleEditCancel}
                          className={styles.cancelBtn}
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <span className={styles.nameBalance}>
                        <span className={styles.name}>{w.name}</span> -{" "}
                        <span className={styles.balance}>
                          {formatCurrency(w.budget)}
                        </span>
                        {w.id === activeWalletId && (
                          <span className={styles.activeLabel}>(Active)</span>
                        )}
                      </span>
                      <div className={`${styles.actions} ${styles.actionsMargin}`}>
                        <button
                          onClick={() => handleSetActive(w.id)}
                          className={styles.setActiveBtn}
                          disabled={w.id === activeWalletId}
                        >
                          Set Active
                        </button>
                        <button
                          onClick={() => handleEdit(w)}
                          className={styles.editBtn}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(w.id)}
                          className={styles.deleteBtn}
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <button onClick={onClose} className={styles.closeBtn}>
          Close
        </button>
        {confirmDeleteId && (
          <div className={styles.confirmBackdrop}>
            <div className={styles.confirmModal}>
              <div className={styles.confirmText}>
                Are you sure you want to delete this wallet? This action cannot be undone.
              </div>
              <div className={styles.confirmActions}>
                <button
                  className={styles.deleteBtn}
                  onClick={async () => {
                    await handleDelete(confirmDeleteId);
                    setConfirmDeleteId(null);
                  }}
                >
                  Delete
                </button>
                <button
                  className={styles.cancelBtn}
                  onClick={() => setConfirmDeleteId(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
