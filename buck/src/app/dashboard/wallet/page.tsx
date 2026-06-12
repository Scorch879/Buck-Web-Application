"use client";

import { useEffect, useState, useRef } from "react";
import { useOptionalDashboardUser } from "@/context/DashboardUserContext";
import { useFinancial, mergeDashboardDataCache } from "@/context/FinancialContext";
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
import { FaWallet, FaPlus, FaCheck, FaTrash, FaEdit, FaHistory } from "react-icons/fa";
import { motion } from "framer-motion";
import "../settings/style.css";
import WalletModal from "./WalletModal";

export default function WalletPage() {
  const user = useOptionalDashboardUser();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const userCache = user && dashboardCache.userId === user.uid ? dashboardCache : {};
  
  const hasInitialData = Boolean(userCache.wallets && userCache.activeWalletId !== undefined);
  const hadInitialData = useRef(hasInitialData);

  const [wallets, setWallets] = useState<BuckWallet[]>(() => userCache.wallets ?? []);
  const [name, setName] = useState("");
  const [budget, setBudget] = useState("");
  const [loading, setLoading] = useState(() => !hasInitialData);
  const [error, setError] = useState("");
  const [activeWalletId, setActiveWalletId] = useState<string | null>(() => userCache.activeWalletId ?? null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchWallets = async () => {
    if (!user) return;
    if (!hadInitialData.current && wallets.length === 0) setLoading(true);
    
    try {
      const walletsArr = await listWallets(user.uid);
      setWallets(walletsArr);
      setDashboardCache((current) => mergeDashboardDataCache(current, user.uid, { wallets: walletsArr }));
      
      if (walletsArr.length === 1 && !activeWalletId) {
        await setActiveWallet(user.uid, walletsArr[0].id);
        setActiveWalletId(walletsArr[0].id);
        setDashboardCache((current) => mergeDashboardDataCache(current, user.uid, { activeWalletId: walletsArr[0].id }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wallets.");
    } finally {
      setLoading(false);
    }
  };

  const fetchActiveWallet = async () => {
    if (!user) return;
    try {
      const id = await getActiveWalletId(user.uid);
      setActiveWalletId(id);
      setDashboardCache((current) => mergeDashboardDataCache(current, user.uid, { activeWalletId: id }));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!user) return;
    try {
      await deleteWallet(user.uid, id);
      if (activeWalletId === id) {
        await setActiveWallet(user.uid, null);
        setActiveWalletId(null);
        setDashboardCache((current) => mergeDashboardDataCache(current, user.uid, { activeWalletId: null }));
      }
      fetchWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete wallet.");
    }
  };

  const handleEdit = (wallet: BuckWallet) => {
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
    try {
      await updateWallet(user.uid, id, {
        name: editName,
        budget: Number(editBudget),
      });
      setEditId(null);
      setEditName("");
      setEditBudget("");
      setError("");
      fetchWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update wallet.");
    }
  };

  const handleEditCancel = () => {
    setEditId(null);
    setEditName("");
    setEditBudget("");
    setError("");
  };

  useEffect(() => {
    if (!user) return;
    fetchWallets();
    fetchActiveWallet();

    const unsubscribeWallets = subscribeUserTable("wallets", user.uid, () => {
      fetchWallets();
    });

    const unsubscribeProfile = subscribeUserTable("profiles", user.uid, () => {
      fetchActiveWallet();
    });

    return () => {
      unsubscribeWallets();
      unsubscribeProfile();
    };
  }, [user]);

  const handleAddWallet = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (!user) return;
    if (!name.trim() || !budget.trim() || isNaN(Number(budget)) || Number(budget) <= 0) {
      setError("Please enter a valid name and a budget greater than 0.");
      return;
    }
    try {
      await addWallet(user.uid, name.trim(), Number(budget));
      setName("");
      setBudget("");
      fetchWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add wallet");
    }
  };

  const handleSetActive = async (id: string) => {
    if (!user) return;
    await setActiveWallet(user.uid, id);
    setActiveWalletId(id);
  };

  const activeWallets = wallets.filter(w => !w.deletedAt);
  const totalBudget = activeWallets.reduce((sum, w) => sum + (Number(w.budget) || 0), 0);

  if (loading) {
    return <div className="settings-page">Loading wallets...</div>;
  }

  return (
    <main className="settings-page">
      {error && <div className="settings-message settings-message--error">{error}</div>}

      <div className="wallet-grid">
        <article className="settings-card">
          <div className="settings-card-heading" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <span aria-hidden="true">
                <FaWallet />
              </span>
              <div>
                <p className="settings-eyebrow">Your Wallets</p>
                <h2>Manage your active wallets</h2>
              </div>
            </div>
            <button 
              className="settings-button settings-button--primary"
              onClick={() => setIsModalOpen(true)}
              style={{ margin: 0 }}
            >
              <FaPlus aria-hidden="true" style={{ marginRight: '0.4rem' }} /> New Wallet
            </button>
          </div>
          <div className="settings-wallet-list">
            {activeWallets.length === 0 ? (
              <p className="settings-wallet-empty">No wallets yet. Create one by clicking New Wallet.</p>
            ) : (
              activeWallets.map((w) => (
                <div
                  key={w.id}
                  className={`settings-action-panel settings-wallet-item${w.id === activeWalletId ? " settings-wallet-item--active" : ""}`}
                >
                  {editId === w.id ? (
                    <>
                      <div className="settings-wallet-info" style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Wallet Name"
                          className="settings-form-input"
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "4px",
                            border: "1px solid var(--buck-line)",
                            background: "transparent",
                            color: "var(--buck-ink)"
                          }}
                        />
                        <input
                          type="number"
                          value={editBudget}
                          onChange={(e) => setEditBudget(e.target.value)}
                          placeholder="Budget"
                          min="0.01"
                          step="0.01"
                          className="settings-form-input"
                          style={{
                            width: "100%",
                            padding: "0.5rem",
                            borderRadius: "4px",
                            border: "1px solid var(--buck-line)",
                            background: "transparent",
                            color: "var(--buck-ink)"
                          }}
                        />
                      </div>
                      <div className="settings-wallet-actions" style={{ flexWrap: "wrap", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                        <button
                          className="settings-button settings-button--primary"
                          onClick={() => handleEditSave(w.id)}
                          type="button"
                        >
                          Save
                        </button>
                        <button
                          className="settings-button settings-button--secondary"
                          onClick={handleEditCancel}
                          type="button"
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="settings-wallet-info">
                        <strong>{w.name}</strong>
                        <span className="settings-wallet-budget">{formatCurrency(Number(w.budget))}</span>
                      </div>
                      <div className="settings-wallet-actions" style={{ flexWrap: "wrap", justifyContent: "flex-end", marginTop: "0.5rem" }}>
                        {w.id === activeWalletId ? (
                          <span className="settings-wallet-active-badge">
                            <FaCheck aria-hidden="true" /> Active
                          </span>
                        ) : (
                          <button
                            className="settings-button settings-button--secondary"
                            onClick={() => handleSetActive(w.id)}
                            type="button"
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          className="settings-button settings-button--secondary"
                          onClick={() => handleEdit(w)}
                          type="button"
                        >
                          <FaEdit aria-hidden="true" /> Edit
                        </button>
                        <button
                          className="settings-button settings-button--danger"
                          onClick={() => setConfirmDeleteId(w.id)}
                          type="button"
                        >
                          <FaTrash aria-hidden="true" /> Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </article>

        <article className="settings-card">
          <div className="settings-card-heading">
            <span aria-hidden="true">
              <FaHistory />
            </span>
            <div>
              <p className="settings-eyebrow">Log</p>
              <h2>History of Wallets</h2>
            </div>
          </div>
          <div className="settings-wallet-list">
            {wallets.length === 0 ? (
              <p className="settings-wallet-empty">No wallet history.</p>
            ) : (
              [...wallets].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((w) => (
                <div key={w.id} className="settings-action-panel settings-wallet-item" style={{ opacity: w.deletedAt ? 0.6 : 1 }}>
                  <div className="settings-wallet-info" style={{ width: '100%' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <strong style={{ textDecoration: w.deletedAt ? 'line-through' : 'none' }}>{w.name}</strong>
                        {w.deletedAt && (
                          <span style={{ fontSize: '0.7rem', background: 'var(--buck-surface)', color: 'var(--buck-muted)', padding: '0.1rem 0.4rem', borderRadius: '4px', border: '1px solid var(--buck-line)' }}>
                            Archived
                          </span>
                        )}
                      </div>
                      <span className="settings-wallet-budget">{formatCurrency(Number(w.budget))}</span>
                    </div>
                    <span style={{ fontSize: '0.8rem', color: 'var(--buck-muted)', marginTop: '0.4rem', display: 'block' }}>
                      Added on {new Date(w.createdAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                      {w.deletedAt && (
                        <> • Deleted on {new Date(w.deletedAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}</>
                      )}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>
        </article>


      </div>

      {confirmDeleteId && (
        <div className="settings-modal-backdrop" onClick={() => setConfirmDeleteId(null)}>
          <div className="settings-modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: "var(--buck-ink)" }}>Delete Wallet</h3>
            <p style={{ color: "var(--buck-muted)" }}>
              Are you sure you want to delete this wallet? This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", justifyContent: "flex-end", marginTop: "1.5rem" }}>
              <button
                className="settings-button settings-button--secondary"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancel
              </button>
              <button
                className="settings-button settings-button--danger"
                onClick={async () => {
                  await handleDelete(confirmDeleteId);
                  setConfirmDeleteId(null);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
      {isModalOpen && (
        <WalletModal
          open={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </main>
  );
}
