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
import { FaWallet, FaPlus, FaCheck, FaTrash, FaEdit, FaHistory, FaSearch } from "react-icons/fa";
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

  // Search & Filter States
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [activeSort, setActiveSort] = useState("Highest Budget");
  const [isSearchExpanded, setIsSearchExpanded] = useState(false);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyFilter, setHistoryFilter] = useState("All");

  const fetchWallets = async () => {
    if (!user) return;
    if (!hadInitialData.current && wallets.length === 0) setLoading(true);
    
    try {
      const walletsArr = await listWallets(user.uid);
      setWallets(walletsArr);
      
      const activeWalletsList = walletsArr.filter(w => !w.deletedAt);
      let newActiveId = activeWalletId;

      if (activeWalletsList.length === 1 && !newActiveId) {
        newActiveId = activeWalletsList[0].id;
        await setActiveWallet(user.uid, newActiveId);
        setActiveWalletId(newActiveId);
      }

      const activeWallet = walletsArr.find((w) => w.id === newActiveId && !w.deletedAt);

      setDashboardCache((current) => mergeDashboardDataCache(current, user.uid, { 
        wallets: walletsArr,
        ...(newActiveId ? { activeWalletId: newActiveId } : {}),
        ...(activeWallet ? { activeWalletBudget: activeWallet.budget } : { activeWalletBudget: 0 }),
      }));
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
        setDashboardCache((current) => mergeDashboardDataCache(current, user.uid, { activeWalletId: null, activeWalletBudget: 0 }));
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

    const newActiveWallet = wallets.find((w) => w.id === id);
    setDashboardCache((current) => mergeDashboardDataCache(current, user.uid, {
      activeWalletId: id,
      ...(newActiveWallet ? { activeWalletBudget: newActiveWallet.budget } : {}),
    }));
  };

  const activeWallets = wallets.filter(w => !w.deletedAt);
  const totalBudget = activeWallets.reduce((sum, w) => sum + (Number(w.budget) || 0), 0);

  const filteredActiveWallets = activeWallets.filter(w => 
    w.name.toLowerCase().includes(activeSearchQuery.toLowerCase())
  ).sort((a, b) => {
    switch (activeSort) {
      case "Highest Budget": return Number(b.budget) - Number(a.budget);
      case "Lowest Budget": return Number(a.budget) - Number(b.budget);
      case "A-Z": return a.name.localeCompare(b.name);
      case "Newest - Oldest": return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      case "Oldest - Newest": return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      default: return 0;
    }
  });

  const filteredHistoryWallets = [...wallets].filter(w => {
    if (historyFilter === "Active Only" && w.deletedAt) return false;
    if (historyFilter === "Archived Only" && !w.deletedAt) return false;
    return w.name.toLowerCase().includes(historySearchQuery.toLowerCase());
  }).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  if (loading) {
    return <div className="settings-page">Loading wallets...</div>;
  }

  return (
    <div className="settings-page">
      {error && <div className="settings-message settings-message--error">{error}</div>}

      <div className="wallet-grid">
        <article className="settings-card">
          <div className="settings-card-heading settings-card-header">
            <div className="settings-card-title">
              <span aria-hidden="true">
                <FaWallet />
              </span>
              <div>
                <p className="settings-eyebrow">Your Wallets</p>
                <h2>Manage your active wallets</h2>
              </div>
            </div>
            
            <div className="wallet-controls-container">
              <div 
                className={`wallet-search-wrapper ${isSearchExpanded ? 'wallet-search-wrapper--expanded' : 'wallet-search-wrapper--collapsed'}`}
                onClick={() => {
                  if (!isSearchExpanded) setIsSearchExpanded(true);
                }}
              >
                <button 
                  className="wallet-search-icon-btn" 
                  aria-label="Search"
                  onClick={(e) => {
                    if (isSearchExpanded) {
                      e.stopPropagation();
                      setIsSearchExpanded(false);
                      setActiveSearchQuery("");
                    }
                  }}
                >
                  <FaSearch />
                </button>
                {isSearchExpanded && (
                  <input 
                    type="text" 
                    className="wallet-search-input" 
                    placeholder="Search wallets..." 
                    value={activeSearchQuery}
                    onChange={(e) => setActiveSearchQuery(e.target.value)}
                    autoFocus
                  />
                )}
              </div>

              <select 
                className="wallet-filter-select"
                value={activeSort}
                onChange={(e) => setActiveSort(e.target.value)}
              >
                <option value="Highest Budget">Highest Budget</option>
                <option value="Lowest Budget">Lowest Budget</option>
                <option value="A-Z">A-Z</option>
                <option value="Newest - Oldest">Newest - Oldest</option>
                <option value="Oldest - Newest">Oldest - Newest</option>
              </select>

              <button 
                className="settings-button settings-button--primary"
                onClick={() => setIsModalOpen(true)}
                style={{ margin: 0 }}
              >
                <FaPlus aria-hidden="true" style={{ marginRight: '0.4rem' }} /> New Wallet
              </button>
            </div>
          </div>
          <div className="settings-wallet-list">
            {filteredActiveWallets.length === 0 ? (
              <p className="settings-wallet-empty">No wallets found matching your search or filters.</p>
            ) : (
              filteredActiveWallets.map((w) => (
                <div
                  key={w.id}
                  className={`settings-action-panel settings-wallet-item${w.id === activeWalletId ? " settings-wallet-item--active" : ""}`}
                >
                  {editId === w.id ? (
                    <>
                      <div className="settings-wallet-info settings-wallet-edit-grid">
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          placeholder="Wallet Name"
                          className="settings-form-input"
                        />
                        <input
                          type="number"
                          value={editBudget}
                          onChange={(e) => setEditBudget(e.target.value)}
                          placeholder="Budget"
                          min="0.01"
                          step="0.01"
                          className="settings-form-input"
                        />
                      </div>
                      <div className="settings-wallet-actions">
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
                      <div className="settings-wallet-header">
                        <div className="settings-wallet-info">
                          <strong>{w.name}</strong>
                          <span className="settings-wallet-budget">{formatCurrency(Number(w.budget))}</span>
                        </div>
                        {w.id === activeWalletId && (
                          <span className="settings-wallet-active-badge">
                            <FaCheck aria-hidden="true" /> Active
                          </span>
                        )}
                      </div>
                      <div className="settings-wallet-actions">
                        {w.id !== activeWalletId && (
                          <button
                            className="settings-button settings-button--secondary"
                            onClick={() => handleSetActive(w.id)}
                            type="button"
                            style={{ flex: 1, minWidth: "120px", margin: 0 }}
                          >
                            Set Active
                          </button>
                        )}
                        <button
                          className="settings-button settings-button--secondary"
                          onClick={() => handleEdit(w)}
                          type="button"
                          style={{ flex: 1, minWidth: "120px", margin: 0 }}
                        >
                          <FaEdit aria-hidden="true" /> Edit
                        </button>
                        <button
                          className="settings-button settings-button--danger"
                          onClick={() => setConfirmDeleteId(w.id)}
                          type="button"
                          style={{ flex: 1, minWidth: "120px", margin: 0 }}
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
          <div className="settings-card-heading settings-card-header">
            <div className="settings-card-title">
              <span aria-hidden="true">
                <FaHistory />
              </span>
              <div>
                <p className="settings-eyebrow">Log</p>
                <h2>History of Wallets</h2>
              </div>
            </div>

            <div className="wallet-controls-container">
              <div className="wallet-search-wrapper wallet-search-wrapper--permanent">
                <button className="wallet-search-icon-btn" aria-label="Search icon" style={{ cursor: 'default' }}>
                  <FaSearch />
                </button>
                <input 
                  type="text" 
                  className="wallet-search-input" 
                  placeholder="Search history..." 
                  value={historySearchQuery}
                  onChange={(e) => setHistorySearchQuery(e.target.value)}
                />
              </div>

              <select 
                className="wallet-filter-select"
                value={historyFilter}
                onChange={(e) => setHistoryFilter(e.target.value)}
              >
                <option value="All">All</option>
                <option value="Active Only">Active Only</option>
                <option value="Archived Only">Archived Only</option>
              </select>
            </div>
          </div>
          <div className="settings-wallet-list">
            {filteredHistoryWallets.length === 0 ? (
              <p className="settings-wallet-empty">No wallet history found.</p>
            ) : (
              filteredHistoryWallets.map((w) => (
                <div key={w.id} className="settings-action-panel settings-wallet-item" style={{ opacity: w.deletedAt ? 0.6 : 1 }}>
                  <div className="settings-wallet-info" style={{ width: '100%' }}>
                    <div className="settings-wallet-header">
                      <div className="settings-card-title" style={{ gap: '0.5rem' }}>
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
    </div>
  );
}
