"use client";

import { useEffect, useState, useRef } from "react";
import { useOptionalDashboardUser } from "@/context/DashboardUserContext";
import { useFinancial, mergeDashboardDataCache } from "@/context/FinancialContext";
import { useToast } from "@/component/toast/ToastContext";
import AddIncomeModal from "@/component/income/AddIncomeModal";
import IncomeList from "@/component/income/IncomeList";
import MonthlyCashFlowCard from "@/component/income/MonthlyCashFlowCard";
import { useIncomes } from "@/hooks/useIncomes";
import { formatCurrency } from "@/utils/formatters";
import {
  deleteWallet,
  getActiveWalletId,
  listExpenses,
  listWallets,
  setActiveWallet,
  subscribeUserTable,
  updateWallet,
  type BuckWallet,
} from "@/utils/supabaseData";
import {
  FaWallet,
  FaPlus,
  FaCheck,
  FaTrash,
  FaEdit,
  FaHistory,
  FaSearch,
  FaTimes,
  FaMoneyBillWave,
  FaChevronLeft,
  FaChevronRight,
  FaSpinner,
} from "react-icons/fa";
import { AnimatePresence, motion } from "framer-motion";
import "../settings/style.css";
import WalletModal from "./WalletModal";
import DangerDeleteDialog from "@/component/DangerDeleteDialog";
import CustomSelect from "@/component/CustomSelect";
import { DashboardPageSkeleton } from "@/component/DashboardSkeletons";

const WALLETS_PAGE_SIZE = 4;
const HISTORY_PAGE_SIZE = 4;

function sanitizeBudgetInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.,]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, "")
  );
}

function parseBudgetInput(raw: string): number {
  return Number(raw.replace(/,/g, "").trim());
}

function formatEditableBudget(value: number): string {
  const num = Number(value) || 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: num % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

function getPaginationPages(
  current: number,
  total: number
): (number | "ellipsis-start" | "ellipsis-end")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }
  if (current <= 4) {
    return [1, 2, 3, 4, 5, "ellipsis-end", total];
  }
  if (current >= total - 3) {
    return [
      1,
      "ellipsis-start",
      total - 4,
      total - 3,
      total - 2,
      total - 1,
      total,
    ];
  }
  return [
    1,
    "ellipsis-start",
    current - 1,
    current,
    current + 1,
    "ellipsis-end",
    total,
  ];
}

function WalletPagination({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  ariaLabel,
}: {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  ariaLabel: string;
}) {
  if (totalItems === 0) return null;

  return (
    <div className="wallet-pagination" role="navigation" aria-label={ariaLabel}>
      <div className="wallet-pagination-spacer" aria-hidden="true" />

      <div className="wallet-pagination-nav">
        <motion.button
          type="button"
          className="wallet-page-btn wallet-page-btn--nav"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          title="Previous page"
          whileHover={currentPage <= 1 ? undefined : { scale: 1.03 }}
          whileTap={currentPage <= 1 ? undefined : { scale: 0.96 }}
        >
          <FaChevronLeft aria-hidden="true" />
          <span>Prev</span>
        </motion.button>

        <div className="wallet-page-numbers">
          {getPaginationPages(currentPage, totalPages).map((p, idx) => {
            if (typeof p === "string") {
              return (
                <span
                  key={`${p}-${idx}`}
                  className="wallet-page-ellipsis"
                  aria-hidden="true"
                >
                  …
                </span>
              );
            }
            const isActive = p === currentPage;
            return (
              <motion.button
                key={p}
                type="button"
                className={`wallet-page-btn ${
                  isActive ? "wallet-page-btn--active" : ""
                }`}
                onClick={() => onPageChange(p)}
                aria-label={`Page ${p}`}
                aria-current={isActive ? "page" : undefined}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {p}
              </motion.button>
            );
          })}
        </div>

        <motion.button
          type="button"
          className="wallet-page-btn wallet-page-btn--nav"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          title="Next page"
          whileHover={currentPage >= totalPages ? undefined : { scale: 1.03 }}
          whileTap={currentPage >= totalPages ? undefined : { scale: 0.96 }}
        >
          <span>Next</span>
          <FaChevronRight aria-hidden="true" />
        </motion.button>
      </div>

      <div className="wallet-pagination-info">
        <span className="wallet-pagination-info-full">
          Showing <strong>{startIndex + 1}</strong>–<strong>{endIndex}</strong> of{" "}
          <strong>{totalItems}</strong>
        </span>
        <span className="wallet-pagination-info-short">
          <strong>{startIndex + 1}</strong>–<strong>{endIndex}</strong> of{" "}
          <strong>{totalItems}</strong>
        </span>
      </div>
    </div>
  );
}

export default function WalletPage() {
  const user = useOptionalDashboardUser();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const { toast } = useToast();
  const userCache = user && dashboardCache.userId === user.uid ? dashboardCache : {};

  const hasInitialData = Boolean(userCache.wallets && userCache.activeWalletId !== undefined);
  const hadInitialData = useRef(hasInitialData);

  const [wallets, setWallets] = useState<BuckWallet[]>(() => userCache.wallets ?? []);
  const [loading, setLoading] = useState(() => !hasInitialData);
  const [error, setError] = useState("");
  const [activeWalletId, setActiveWalletId] = useState<string | null>(() => userCache.activeWalletId ?? null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editBudget, setEditBudget] = useState("");
  const [savingEditId, setSavingEditId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const {
    incomes,
    tracked: incomeTracked,
    cashFlow,
    refresh: refreshIncomes,
  } = useIncomes(user?.uid ?? "", userCache.expenses ?? []);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [view, setView] = useState<"wallets" | "income">("wallets");
  const [incomeSearchQuery, setIncomeSearchQuery] = useState("");

  // Search, Filter & Pagination States
  const [activeSearchQuery, setActiveSearchQuery] = useState("");
  const [activeSort, setActiveSort] = useState("Highest Budget");
  const [activePage, setActivePage] = useState(1);
  const [historySearchQuery, setHistorySearchQuery] = useState("");
  const [historyFilter, setHistoryFilter] = useState("All");
  const [historyPage, setHistoryPage] = useState(1);

  useEffect(() => {
    setActivePage(1);
  }, [activeSearchQuery, activeSort]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historySearchQuery, historyFilter]);

  const fetchWallets = async () => {
    if (!user) return;
    if (!hadInitialData.current && wallets.length === 0) setLoading(true);

    try {
      const walletsArr = await listWallets(user.uid);
      setWallets(walletsArr);

      const activeWalletsList = walletsArr.filter((w) => !w.deletedAt);
      let newActiveId = activeWalletId;

      if (activeWalletsList.length === 1 && !newActiveId) {
        newActiveId = activeWalletsList[0].id;
        await setActiveWallet(user.uid, newActiveId);
        setActiveWalletId(newActiveId);
      }

      const activeWallet = walletsArr.find((w) => w.id === newActiveId && !w.deletedAt);

      setDashboardCache((current) =>
        mergeDashboardDataCache(current, user.uid, {
          wallets: walletsArr,
          ...(newActiveId ? { activeWalletId: newActiveId } : {}),
          ...(activeWallet ? { activeWalletBudget: activeWallet.budget } : { activeWalletBudget: 0 }),
        })
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load wallets.");
      toast("Failed to load wallets", "error");
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
        setDashboardCache((current) =>
          mergeDashboardDataCache(current, user.uid, { activeWalletId: null, activeWalletBudget: 0 })
        );
      }
      toast("Wallet deleted successfully", "success");
      fetchWallets();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete wallet.");
      toast("Failed to delete wallet", "error");
    }
  };

  const handleEdit = (wallet: BuckWallet) => {
    setEditId(wallet.id);
    setEditName(wallet.name);
    setEditBudget(formatEditableBudget(wallet.budget));
  };

  const handleEditSave = async (id: string) => {
    if (!user || savingEditId) return;
    const parsedBudget = parseBudgetInput(editBudget);
    if (!editName.trim() || !editBudget.trim() || isNaN(parsedBudget) || parsedBudget <= 0) {
      setError("Please enter a valid name and a budget greater than 0.");
      toast("Please enter a valid name and a budget greater than 0.", "error");
      return;
    }
    setSavingEditId(id);
    const loadingToastId = toast.loading(`Updating "${editName.trim()}"…`);
    try {
      await updateWallet(user.uid, id, {
        name: editName.trim(),
        budget: parsedBudget,
      });
      setEditId(null);
      setEditName("");
      setEditBudget("");
      setError("");
      await fetchWallets();
      toast.dismiss(loadingToastId);
      toast("Wallet updated successfully", "success");
    } catch (err) {
      toast.dismiss(loadingToastId);
      setError(err instanceof Error ? err.message : "Failed to update wallet.");
      toast("Failed to update wallet", "error");
    } finally {
      setSavingEditId(null);
    }
  };

  const handleEditCancel = () => {
    setEditId(null);
    setEditName("");
    setEditBudget("");
    setError("");
  };

  // Cash-flow KPI needs expenses; load them when Wallet is the first tab visited.
  useEffect(() => {
    if (!user) return;
    const uid = user.uid;
    const fetchExpenses = async () => {
      try {
        const nextExpenses = await listExpenses(uid);
        setDashboardCache((current) =>
          mergeDashboardDataCache(current, uid, { expenses: nextExpenses })
        );
      } catch (err) {
        console.error("Failed to load expenses:", err);
      }
    };
    void fetchExpenses();
    return subscribeUserTable("expenses", uid, () => void fetchExpenses());
  }, [setDashboardCache, user]);

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
    // Subscribe once per user; the fetch helpers are recreated every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  const handleSetActive = async (id: string) => {
    if (!user) return;
    try {
      await setActiveWallet(user.uid, id);
      setActiveWalletId(id);

      const newActiveWallet = wallets.find((w) => w.id === id);
      setDashboardCache((current) =>
        mergeDashboardDataCache(current, user.uid, {
          activeWalletId: id,
          ...(newActiveWallet ? { activeWalletBudget: newActiveWallet.budget } : {}),
        })
      );
      toast("Active wallet updated", "success");
    } catch {
      toast("Failed to update active wallet", "error");
    }
  };

  const activeWallets = wallets.filter((w) => !w.deletedAt);
  const totalBudget = activeWallets.reduce((sum, w) => sum + (Number(w.budget) || 0), 0);
  const activeWallet = activeWallets.find((w) => w.id === activeWalletId);
  const archivedCount = wallets.length - activeWallets.length;
  const pendingDeleteWallet = wallets.find((w) => w.id === confirmDeleteId) ?? null;

  const filteredActiveWallets = activeWallets
    .filter((w) => w.name.toLowerCase().includes(activeSearchQuery.toLowerCase()))
    .sort((a, b) => {
      switch (activeSort) {
        case "Highest Budget":
          return Number(b.budget) - Number(a.budget);
        case "Lowest Budget":
          return Number(a.budget) - Number(b.budget);
        case "A-Z":
          return a.name.localeCompare(b.name);
        case "Newest - Oldest":
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        case "Oldest - Newest":
          return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
        default:
          return 0;
      }
    });

  const filteredHistoryWallets = [...wallets]
    .filter((w) => {
      if (historyFilter === "Active Only" && w.deletedAt) return false;
      if (historyFilter === "Archived Only" && !w.deletedAt) return false;
      return w.name.toLowerCase().includes(historySearchQuery.toLowerCase());
    })
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  // Pagination slices for Manage your wallets & Wallet history
  const activeTotalItems = filteredActiveWallets.length;
  const activeTotalPages = Math.max(1, Math.ceil(activeTotalItems / WALLETS_PAGE_SIZE));
  const safeActivePage = Math.min(Math.max(1, activePage), activeTotalPages);
  const activeStartIndex = activeTotalItems === 0 ? 0 : (safeActivePage - 1) * WALLETS_PAGE_SIZE;
  const activeEndIndex = Math.min(activeStartIndex + WALLETS_PAGE_SIZE, activeTotalItems);
  const paginatedActiveWallets = filteredActiveWallets.slice(activeStartIndex, activeEndIndex);

  const historyTotalItems = filteredHistoryWallets.length;
  const historyTotalPages = Math.max(1, Math.ceil(historyTotalItems / HISTORY_PAGE_SIZE));
  const safeHistoryPage = Math.min(Math.max(1, historyPage), historyTotalPages);
  const historyStartIndex = historyTotalItems === 0 ? 0 : (safeHistoryPage - 1) * HISTORY_PAGE_SIZE;
  const historyEndIndex = Math.min(historyStartIndex + HISTORY_PAGE_SIZE, historyTotalItems);
  const paginatedHistoryWallets = filteredHistoryWallets.slice(historyStartIndex, historyEndIndex);

  const handleActivePageChange = (nextPage: number) => {
    if (nextPage === safeActivePage || nextPage < 1 || nextPage > activeTotalPages) return;
    setEditId(null);
    setActivePage(nextPage);
  };

  const handleHistoryPageChange = (nextPage: number) => {
    if (nextPage === safeHistoryPage || nextPage < 1 || nextPage > historyTotalPages) return;
    setHistoryPage(nextPage);
  };

  const formatLongDate = (value: string) =>
    new Date(value).toLocaleDateString(undefined, {
      year: "numeric",
      month: "long",
      day: "numeric",
    });

  if (loading) {
    return <DashboardPageSkeleton variant="wallet" />;
  }

  return (
    <div className="settings-page wallet-page">
      {error && <div className="settings-message settings-message--error">{error}</div>}

      {/* Page header: title on the left, Wallets | Income navigator on the right
          (same pattern as the Statistics toolbar). The two views never mix. */}
      <header className="settings-card wallet-page-header">
        <div className="wallet-card-title-wrap">
          <p className="settings-eyebrow">Wallet</p>
          <h2 className="wallet-card-title">
            {view === "wallets" ? "Wallets & balances" : "Income & cash flow"}
          </h2>
        </div>
        <div className="wallet-view-nav" role="tablist" aria-label="Wallet sections">
          <button
            type="button"
            role="tab"
            id="wallet-view-tab-wallets"
            aria-selected={view === "wallets"}
            aria-controls="wallet-view-panel"
            className="wallet-view-tab"
            onClick={() => setView("wallets")}
          >
            <FaWallet aria-hidden="true" /> Wallets
            <span className="wallet-tab-count">{activeWallets.length}</span>
          </button>
          <button
            type="button"
            role="tab"
            id="wallet-view-tab-income"
            aria-selected={view === "income"}
            aria-controls="wallet-view-panel"
            className="wallet-view-tab"
            onClick={() => setView("income")}
          >
            <FaMoneyBillWave aria-hidden="true" /> Income
            <span className="wallet-tab-count">{incomes.length}</span>
          </button>
        </div>
      </header>

      <div
        id="wallet-view-panel"
        role="tabpanel"
        aria-labelledby={view === "wallets" ? "wallet-view-tab-wallets" : "wallet-view-tab-income"}
        className="wallet-view-panel"
      >
        {view === "wallets" ? (
          <>
            {/* KPI: wallet overview */}
            <section className="settings-card wallet-overview" aria-label="Wallet overview">
              <div className="wallet-overview-stat">
                <span className="wallet-overview-label">Total balance</span>
                <strong className="wallet-overview-value">{formatCurrency(totalBudget)}</strong>
                <span className="wallet-overview-sub">
                  Across {activeWallets.length} {activeWallets.length === 1 ? "wallet" : "wallets"}
                </span>
              </div>
              <div className="wallet-overview-stat">
                <span className="wallet-overview-label">Active wallet</span>
                <strong className="wallet-overview-value wallet-overview-value--accent">
                  {activeWallet ? formatCurrency(Number(activeWallet.budget)) : "—"}
                </strong>
                <span className="wallet-overview-sub" title={activeWallet?.name}>
                  {activeWallet ? activeWallet.name : "No active wallet"}
                </span>
              </div>
              <div className="wallet-overview-stat">
                <span className="wallet-overview-label">Archived</span>
                <strong className="wallet-overview-value">{archivedCount}</strong>
                <span className="wallet-overview-sub">
                  {archivedCount === 1 ? "wallet" : "wallets"} kept for history
                </span>
              </div>
            </section>

            <div className="wallet-grid">
              {/* Your wallets */}
              <article className="settings-card wallet-panel-card">
                <div className="wallet-card-header">
                  <div className="wallet-card-title-group">
                    <span className="wallet-card-header-icon" aria-hidden="true">
                      <FaWallet />
                    </span>
                    <div className="wallet-card-title-wrap">
                      <p className="settings-eyebrow">Your Wallets</p>
                      <h2 className="wallet-card-title">Manage your wallets</h2>
                    </div>
                  </div>

                  <button
                    className="settings-button settings-button--primary wallet-new-btn"
                    onClick={() => setIsModalOpen(true)}
                    type="button"
                  >
                    <FaPlus aria-hidden="true" /> New Wallet
                  </button>
                </div>

                <div className="wallet-toolbar">
                  <div className="wallet-search-bar">
                    <FaSearch className="wallet-search-icon" aria-hidden="true" />
                    <input
                      type="text"
                      className="wallet-search-input"
                      placeholder="Search wallets..."
                      value={activeSearchQuery}
                      onChange={(e) => setActiveSearchQuery(e.target.value)}
                      aria-label="Search wallets"
                    />
                    {activeSearchQuery && (
                      <button
                        type="button"
                        className="wallet-search-clear-btn"
                        onClick={() => setActiveSearchQuery("")}
                        aria-label="Clear search"
                      >
                        <FaTimes aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className="wallet-dropdown-container">
                    <CustomSelect
                      fit
                      value={activeSort}
                      onChange={(val) => setActiveSort(val)}
                      options={[
                        { value: "Highest Budget", label: "Highest Budget" },
                        { value: "Lowest Budget", label: "Lowest Budget" },
                        { value: "A-Z", label: "A-Z" },
                        { value: "Newest - Oldest", label: "Newest - Oldest" },
                        { value: "Oldest - Newest", label: "Oldest - Newest" },
                      ]}
                    />
                  </div>
                </div>

                <motion.div
                  key={`active-wallets-${safeActivePage}-${activeSort}-${activeSearchQuery.trim()}`}
                  className="settings-wallet-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  {paginatedActiveWallets.length === 0 ? (
                    <p className="settings-wallet-empty">
                      No wallets found matching your search or filters.
                    </p>
                  ) : (
                    paginatedActiveWallets.map((w) => {
                      const isActive = w.id === activeWalletId;
                      const isSavingEdit = savingEditId === w.id;
                      return editId === w.id ? (
                        <form
                          key={w.id}
                          className={`settings-action-panel wallet-row wallet-edit-row${
                            isActive ? " wallet-row--active" : ""
                          }`}
                          onSubmit={(e) => {
                            e.preventDefault();
                            void handleEditSave(w.id);
                          }}
                        >
                          <div className="wallet-edit-fields">
                            <input
                              type="text"
                              value={editName}
                              onChange={(e) => setEditName(e.target.value)}
                              placeholder="Wallet Name"
                              aria-label="Wallet Name"
                              className="wallet-edit-input"
                              disabled={isSavingEdit}
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === "Escape" && !isSavingEdit) {
                                  handleEditCancel();
                                }
                              }}
                            />
                            <span className="wallet-row-sep" aria-hidden="true">
                              |
                            </span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editBudget}
                              onChange={(e) =>
                                setEditBudget(sanitizeBudgetInput(e.target.value))
                              }
                              placeholder="Budget (e.g. 50,000)"
                              aria-label="Budget (PHP)"
                              className="wallet-edit-input wallet-edit-input--budget"
                              disabled={isSavingEdit}
                              onKeyDown={(e) => {
                                if (e.key === "Escape" && !isSavingEdit) {
                                  handleEditCancel();
                                }
                              }}
                            />
                          </div>
                          <div className="wallet-edit-actions">
                            <button
                              className="wallet-action-btn wallet-action-btn--save"
                              type="submit"
                              disabled={isSavingEdit}
                            >
                              {isSavingEdit ? (
                                <FaSpinner aria-hidden="true" className="wallet-spin" />
                              ) : (
                                <FaCheck aria-hidden="true" />
                              )}
                              {isSavingEdit ? "Saving…" : "Save"}
                            </button>
                            <button
                              className="wallet-action-btn wallet-action-btn--danger"
                              onClick={handleEditCancel}
                              type="button"
                              disabled={isSavingEdit}
                            >
                              <FaTimes aria-hidden="true" /> Cancel
                            </button>
                          </div>
                          {isSavingEdit && (
                            <span
                              className="wallet-edit-progress"
                              role="progressbar"
                              aria-label="Saving wallet changes"
                            />
                          )}
                        </form>
                      ) : (
                        <div
                          key={w.id}
                          className={`settings-action-panel wallet-row${
                            isActive ? " wallet-row--active" : ""
                          }`}
                        >
                          <div className="wallet-row-main">
                            <div className="wallet-row-title">
                              <strong className="settings-wallet-name" title={w.name}>
                                {w.name}
                              </strong>
                              <span className="wallet-row-sep" aria-hidden="true">
                                |
                              </span>
                              <span className="settings-wallet-budget">
                                {formatCurrency(Number(w.budget))}
                              </span>
                              {isActive && (
                                <span className="settings-wallet-active-badge">
                                  <FaCheck aria-hidden="true" /> Active
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="wallet-row-side">
                            <div className="wallet-row-actions">
                              {!isActive && (
                                <button
                                  className="wallet-action-btn wallet-action-btn--accent"
                                  onClick={() => handleSetActive(w.id)}
                                  type="button"
                                  aria-label={`Set ${w.name} as active wallet`}
                                >
                                  Set Active
                                </button>
                              )}
                              <button
                                className="wallet-action-btn"
                                onClick={() => handleEdit(w)}
                                type="button"
                                aria-label={`Edit ${w.name}`}
                              >
                                <FaEdit aria-hidden="true" /> Edit
                              </button>
                              <button
                                className="wallet-action-btn wallet-action-btn--danger"
                                onClick={() => setConfirmDeleteId(w.id)}
                                type="button"
                                aria-label={`Delete ${w.name}`}
                              >
                                <FaTrash aria-hidden="true" /> Delete
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </motion.div>

                <WalletPagination
                  currentPage={safeActivePage}
                  totalPages={activeTotalPages}
                  totalItems={activeTotalItems}
                  startIndex={activeStartIndex}
                  endIndex={activeEndIndex}
                  onPageChange={handleActivePageChange}
                  ariaLabel="Manage your wallets pagination"
                />
              </article>

              {/* Wallet history */}
              <article className="settings-card wallet-panel-card">
                <div className="wallet-card-header">
                  <div className="wallet-card-title-group">
                    <span className="wallet-card-header-icon" aria-hidden="true">
                      <FaHistory />
                    </span>
                    <div className="wallet-card-title-wrap">
                      <p className="settings-eyebrow">Log</p>
                      <h2 className="wallet-card-title">Wallet history</h2>
                    </div>
                  </div>
                </div>

                <div className="wallet-toolbar">
                  <div className="wallet-search-bar">
                    <FaSearch className="wallet-search-icon" aria-hidden="true" />
                    <input
                      type="text"
                      className="wallet-search-input"
                      placeholder="Search history..."
                      value={historySearchQuery}
                      onChange={(e) => setHistorySearchQuery(e.target.value)}
                      aria-label="Search wallet history"
                    />
                    {historySearchQuery && (
                      <button
                        type="button"
                        className="wallet-search-clear-btn"
                        onClick={() => setHistorySearchQuery("")}
                        aria-label="Clear search"
                      >
                        <FaTimes aria-hidden="true" />
                      </button>
                    )}
                  </div>

                  <div className="wallet-dropdown-container">
                    <CustomSelect
                      fit
                      value={historyFilter}
                      onChange={(val) => setHistoryFilter(val)}
                      options={[
                        { value: "All", label: "All" },
                        { value: "Active Only", label: "Active Only" },
                        { value: "Archived Only", label: "Archived Only" },
                      ]}
                    />
                  </div>
                </div>

                <motion.div
                  key={`history-wallets-${safeHistoryPage}-${historyFilter}-${historySearchQuery.trim()}`}
                  className="settings-wallet-list"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.18, ease: "easeOut" }}
                >
                  {paginatedHistoryWallets.length === 0 ? (
                    <p className="settings-wallet-empty">No wallet history found.</p>
                  ) : (
                    paginatedHistoryWallets.map((w) => (
                      <div
                        key={w.id}
                        className={`settings-action-panel wallet-history-row${
                          w.deletedAt ? " wallet-history-row--archived" : ""
                        }`}
                      >
                        <div className="wallet-row-main">
                          <div className="wallet-row-title">
                            <strong className="settings-wallet-name" title={w.name}>
                              {w.name}
                            </strong>
                            {w.deletedAt && (
                              <span className="settings-wallet-archived-badge">Archived</span>
                            )}
                          </div>
                          <span className="settings-wallet-history-dates">
                            Added {formatLongDate(w.createdAt)}
                            {w.deletedAt && <> • Deleted {formatLongDate(w.deletedAt)}</>}
                          </span>
                        </div>
                        <span className="settings-wallet-budget">
                          {formatCurrency(Number(w.budget))}
                        </span>
                      </div>
                    ))
                  )}
                </motion.div>

                <WalletPagination
                  currentPage={safeHistoryPage}
                  totalPages={historyTotalPages}
                  totalItems={historyTotalItems}
                  startIndex={historyStartIndex}
                  endIndex={historyEndIndex}
                  onPageChange={handleHistoryPageChange}
                  ariaLabel="Wallet history pagination"
                />
              </article>
            </div>
          </>
        ) : (
          <>
            {/* KPI: monthly cash flow (income vs expenses), shared formulas with the mobile app */}
            <MonthlyCashFlowCard cashFlow={cashFlow} />

            <article className="settings-card wallet-panel-card">
              <div className="wallet-card-header">
                <div className="wallet-card-title-group">
                  <span className="wallet-card-header-icon" aria-hidden="true">
                    <FaMoneyBillWave />
                  </span>
                  <div className="wallet-card-title-wrap">
                    <p className="settings-eyebrow">Income</p>
                    <h2 className="wallet-card-title">Income history</h2>
                  </div>
                </div>
                <button
                  className="settings-button settings-button--primary wallet-new-btn"
                  onClick={() => setIncomeModalOpen(true)}
                  type="button"
                  disabled={!incomeTracked}
                >
                  <FaPlus aria-hidden="true" /> Add Income
                </button>
              </div>

              <div className="wallet-toolbar">
                <div className="wallet-search-bar">
                  <FaSearch className="wallet-search-icon" aria-hidden="true" />
                  <input
                    type="text"
                    className="wallet-search-input"
                    placeholder="Search income..."
                    value={incomeSearchQuery}
                    onChange={(e) => setIncomeSearchQuery(e.target.value)}
                    aria-label="Search income history"
                  />
                  {incomeSearchQuery && (
                    <button
                      type="button"
                      className="wallet-search-clear-btn"
                      onClick={() => setIncomeSearchQuery("")}
                      aria-label="Clear search"
                    >
                      <FaTimes aria-hidden="true" />
                    </button>
                  )}
                </div>
              </div>
              {user && (
                <IncomeList
                  embedded
                  wallets={wallets}
                  query={incomeSearchQuery}
                  userId={user.uid}
                  incomes={incomes}
                  tracked={incomeTracked}
                  onAdd={() => setIncomeModalOpen(true)}
                  onChanged={() => {
                    void refreshIncomes();
                    void fetchWallets();
                  }}
                />
              )}
            </article>
          </>
        )}
      </div>

      {user && (
        <AddIncomeModal
          open={incomeModalOpen}
          userId={user.uid}
          onClose={() => setIncomeModalOpen(false)}
          onSaved={() => {
            void refreshIncomes();
            void fetchWallets();
          }}
        />
      )}

      <DangerDeleteDialog
        open={Boolean(pendingDeleteWallet)}
        itemType="wallet"
        itemName={pendingDeleteWallet?.name ?? ""}
        consequences={[
          "The wallet is archived and stays in Wallet history; it cannot be restored.",
          ...(pendingDeleteWallet && pendingDeleteWallet.id === activeWalletId
            ? ["It is your active wallet, so no wallet will be active afterwards."]
            : []),
        ]}
        onCancel={() => setConfirmDeleteId(null)}
        onConfirm={async () => {
          if (!confirmDeleteId) return;
          await handleDelete(confirmDeleteId);
          setConfirmDeleteId(null);
        }}
      />
      <AnimatePresence>
        {isModalOpen && (
          <WalletModal open={isModalOpen} onClose={() => setIsModalOpen(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
