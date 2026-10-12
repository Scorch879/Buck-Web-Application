"use client";

import React, { useState, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FaSearch,
  FaTimes,
  FaSortAmountDown,
  FaFilter,
  FaChevronLeft,
  FaChevronRight,
} from "react-icons/fa";
import { formatCurrency } from "@/utils/formatters";
import CustomSelect, { type SelectOption } from "@/component/CustomSelect";

export type SummaryTableItem = {
  label: string;
  amount: number;
  description: string;
  count: number;
  percentage: number;
  color: string;
};

export type SummarySortOption =
  | "highest"
  | "lowest"
  | "name_asc"
  | "name_desc"
  | "most_txns"
  | "highest_share";

export type SummaryFilterOption =
  | "all"
  | "has_expenses"
  | "selected"
  | "top5";

interface FinancialSummaryTableProps {
  items: SummaryTableItem[];
  selectedCategory: string | null;
  selectedCategoryColor?: string;
  onSelectCategory: (category: string | null) => void;
  selectedDay?: string | null;
  fullDayNames?: Record<string, string>;
  onClearDay?: () => void;
  isSubCategoryOfOthers?: boolean;
}

const PAGE_SIZE = 5;

export default function FinancialSummaryTable({
  items,
  selectedCategory,
  selectedCategoryColor,
  onSelectCategory,
  selectedDay,
  fullDayNames = {},
  onClearDay,
  isSubCategoryOfOthers = false,
}: FinancialSummaryTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SummarySortOption>("highest");
  const [filterBy, setFilterBy] = useState<SummaryFilterOption>("all");
  const [currentPage, setCurrentPage] = useState(1);

  // If a category is selected and filter was set to "selected", reset filter if category deselected
  useEffect(() => {
    if (!selectedCategory && filterBy === "selected") {
      setFilterBy("all");
    }
  }, [selectedCategory, filterBy]);

  // Reset to page 1 on query, sort, or filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, sortBy, filterBy]);

  // Filter items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search query filter
    const query = searchQuery.trim().toLowerCase();
    if (query) {
      result = result.filter(
        (item) =>
          item.label.toLowerCase().includes(query) ||
          item.description.toLowerCase().includes(query)
      );
    }

    // Dropdown category filter
    if (filterBy === "has_expenses") {
      result = result.filter((item) => item.amount > 0);
    } else if (filterBy === "selected" && selectedCategory) {
      result = result.filter(
        (item) => item.label.toLowerCase() === selectedCategory.toLowerCase()
      );
    } else if (filterBy === "top5") {
      // Top 5 by amount
      const top5Labels = new Set(
        [...items]
          .sort((a, b) => b.amount - a.amount)
          .slice(0, 5)
          .map((i) => i.label)
      );
      result = result.filter((item) => top5Labels.has(item.label));
    }

    // Sort items
    result.sort((a, b) => {
      switch (sortBy) {
        case "lowest":
          return a.amount - b.amount;
        case "name_asc":
          return a.label.localeCompare(b.label);
        case "name_desc":
          return b.label.localeCompare(a.label);
        case "most_txns":
          return b.count - a.count;
        case "highest_share":
          return b.percentage - a.percentage;
        case "highest":
        default:
          return b.amount - a.amount;
      }
    });

    return result;
  }, [items, searchQuery, filterBy, selectedCategory, sortBy]);

  // Pagination calculation
  const totalItems = filteredItems.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / PAGE_SIZE));
  const safeCurrentPage = Math.min(Math.max(1, currentPage), totalPages);
  const startIndex = totalItems === 0 ? 0 : (safeCurrentPage - 1) * PAGE_SIZE;
  const endIndex = Math.min(startIndex + PAGE_SIZE, totalItems);
  const displayedItems = filteredItems.slice(startIndex, endIndex);

  // Custom select options adhering to Buck design system
  const filterOptions: SelectOption[] = useMemo(() => {
    const opts: SelectOption[] = [
      { value: "all", label: `All Categories (${items.length})` },
    ];
    if (selectedCategory) {
      opts.push({
        value: "selected",
        label: `Selected: ${selectedCategory}`,
      });
    }
    opts.push(
      { value: "top5", label: "Top 5 Spending" },
      { value: "has_expenses", label: "With Expenses (> ₱0)" }
    );
    return opts;
  }, [items.length, selectedCategory]);

  const sortOptions: SelectOption[] = useMemo(
    () => [
      { value: "highest", label: "Highest Amount" },
      { value: "lowest", label: "Lowest Amount" },
      { value: "name_asc", label: "Name (A–Z)" },
      { value: "name_desc", label: "Name (Z–A)" },
      { value: "most_txns", label: "Most Entries" },
      { value: "highest_share", label: "Highest Share %" },
    ],
    []
  );

  // If no summary data at all for current timeframe/day selection
  if (items.length === 0) {
    return (
      <div className="empty-summary-state">
        {selectedDay
          ? `No expense details available for ${
              fullDayNames[selectedDay] || selectedDay
            }`
          : "No summary data available for this selection"}
      </div>
    );
  }

  return (
    <div className="summary-table-container">
      {/* 1. Top Toolbar: search box | active chart-filter pills | filter + sort dropdowns */}
      <div className="summary-table-toolbar">
        {/* Search input with clear button (stretches to fill available space) */}
        <div className="summary-table-search-box">
          <FaSearch aria-hidden="true" className="summary-table-search-icon" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search category or description..."
            aria-label="Search categories"
            className="summary-table-search-input"
          />
          {searchQuery ? (
            <button
              type="button"
              className="summary-table-search-clear"
              onClick={() => setSearchQuery("")}
              aria-label="Clear search"
              title="Clear search"
            >
              <FaTimes aria-hidden="true" />
            </button>
          ) : null}
        </div>

        {/* Active pie/bar filters: between the search box and the dropdowns; the search box shrinks to make room */}
        <AnimatePresence initial={false}>
          {(selectedDay || selectedCategory) && (
            <motion.div
              className="summary-filter-pill-group summary-table-active-filters"
              role="status"
              aria-label="Active chart filters"
              initial={{ opacity: 0, scale: 0.9, x: 8 }}
              animate={{ opacity: 1, scale: 1, x: 0 }}
              exit={{ opacity: 0, scale: 0.9, x: 8 }}
              transition={{ duration: 0.18, ease: "easeOut" }}
            >
              {selectedDay && (
                <motion.div
                  className="summary-filter-pill-item"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.16 }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45rem",
                  }}
                >
                  <div
                    className="summary-filter-pill summary-filter-pill--active"
                    aria-label={`Filtered by day: ${
                      fullDayNames[selectedDay] || selectedDay
                    }`}
                  >
                    <span
                      className="summary-filter-pill-dot"
                      style={{ backgroundColor: "var(--buck-orange)" }}
                      aria-hidden="true"
                    />
                    <span className="summary-filter-pill-label">
                      <span className="summary-filter-pill-prefix">Day:</span>
                      <strong className="summary-filter-pill-category-name">
                        {fullDayNames[selectedDay] || selectedDay}
                      </strong>
                    </span>
                  </div>
                  {onClearDay && (
                    <button
                      type="button"
                      className="summary-filter-action-btn"
                      onClick={onClearDay}
                      title="Show all days"
                      aria-label="Show all days"
                    >
                      ✕ All Days
                    </button>
                  )}
                </motion.div>
              )}
              {selectedCategory && (
                <motion.div
                  className="summary-filter-pill-item"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.16 }}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.45rem",
                  }}
                >
                  <div
                    className="summary-filter-pill summary-filter-pill--active"
                    aria-label={`Filtered by category: ${selectedCategory}`}
                  >
                    <span
                      className="summary-filter-pill-dot"
                      style={{
                        backgroundColor:
                          selectedCategoryColor || "var(--buck-orange)",
                      }}
                      aria-hidden="true"
                    />
                    <span className="summary-filter-pill-label">
                      <span className="summary-filter-pill-prefix">Category:</span>
                      <strong className="summary-filter-pill-category-name">
                        {selectedCategory}
                      </strong>
                    </span>
                  </div>
                  <button
                    type="button"
                    className="summary-filter-action-btn"
                    onClick={() => onSelectCategory(null)}
                    title="Show all categories"
                    aria-label="Show all categories"
                  >
                    ✕ Show All
                  </button>
                  {isSubCategoryOfOthers && (
                    <button
                      type="button"
                      className="summary-filter-back-btn"
                      onClick={() => onSelectCategory("Others")}
                      title="Back to Others breakdown"
                      aria-label="Back to Others breakdown"
                    >
                      ← Others
                    </button>
                  )}
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Toolbar Dropdowns: Filter & Sort via CustomSelect */}
        <div className="summary-table-controls-group">
          <CustomSelect
            value={filterBy}
            onChange={(val) => setFilterBy(val as SummaryFilterOption)}
            options={filterOptions}
            icon={<FaFilter aria-hidden="true" />}
            size="sm"
            className="summary-table-custom-select summary-table-custom-select--filter"
          />

          <CustomSelect
            value={sortBy}
            onChange={(val) => setSortBy(val as SummarySortOption)}
            options={sortOptions}
            icon={<FaSortAmountDown aria-hidden="true" />}
            size="sm"
            className="summary-table-custom-select summary-table-custom-select--sort"
          />
        </div>
      </div>

      {/* 2. Tabular Presentation (Strictly Contained, No Vertical Stretch) */}
      {displayedItems.length > 0 ? (
        <div className="summary-table-wrapper">
          <table className="summary-table" role="table">
            <thead>
              <tr>
                <th scope="col" className="summary-th-category">
                  Category
                </th>
                <th scope="col" className="summary-th-desc">
                  Description
                </th>
                <th scope="col" className="summary-th-txns">
                  Entries
                </th>
                <th scope="col" className="summary-th-share">
                  Share %
                </th>
                <th scope="col" className="summary-th-amount">
                  Total Spent
                </th>
                <th scope="col" className="summary-th-action">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {displayedItems.map((item) => {
                const isSelected =
                  selectedCategory?.toLowerCase() === item.label.toLowerCase();

                return (
                  <tr
                    key={item.label}
                    className={`summary-table-row ${
                      isSelected ? "summary-table-row--selected" : ""
                    }`}
                    onClick={() =>
                      onSelectCategory(
                        isSelected
                          ? isSubCategoryOfOthers
                            ? "Others"
                            : null
                          : item.label
                      )
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        onSelectCategory(
                          isSelected
                            ? isSubCategoryOfOthers
                              ? "Others"
                              : null
                            : item.label
                        );
                      }
                    }}
                    aria-label={`Select category ${item.label}`}
                    aria-pressed={isSelected}
                  >
                    {/* Category Column */}
                    <td className="summary-td-category">
                      <div className="summary-cat-info">
                        <span
                          className="summary-cat-dot"
                          style={{
                            backgroundColor: item.color || "var(--buck-orange)",
                          }}
                          aria-hidden="true"
                        />
                        <span className="summary-cat-name">{item.label}</span>
                        {isSelected && (
                          <span className="summary-cat-active-pill">
                            Active
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Description Column */}
                    <td className="summary-td-desc">
                      <span
                        className="summary-desc-text"
                        title={item.description}
                      >
                        {item.description}
                      </span>
                    </td>

                    {/* Entries Count Column */}
                    <td className="summary-td-txns">
                      <span className="summary-txns-badge">
                        {item.count} {item.count === 1 ? "entry" : "entries"}
                      </span>
                    </td>

                    {/* Share % Column */}
                    <td className="summary-td-share">
                      <div className="summary-share-cell">
                        <div
                          className="summary-share-track"
                          title={`${item.percentage.toFixed(1)}% of total`}
                        >
                          <div
                            className="summary-share-fill"
                            style={{
                              width: `${Math.min(
                                100,
                                Math.max(0, item.percentage)
                              )}%`,
                              backgroundColor:
                                item.color || "var(--buck-orange)",
                            }}
                          />
                        </div>
                        <span className="summary-share-pct">
                          {item.percentage.toFixed(1)}%
                        </span>
                      </div>
                    </td>

                    {/* Total Spent Column */}
                    <td className="summary-td-amount">
                      <span className="summary-amount-value">
                        {formatCurrency(item.amount)}
                      </span>
                    </td>

                    {/* Action Column */}
                    <td className="summary-td-action">
                      <button
                        type="button"
                        className={`summary-row-action-btn ${
                          isSelected ? "summary-row-action-btn--selected" : ""
                        }`}
                        onClick={(e) => {
                          e.stopPropagation();
                          onSelectCategory(
                            isSelected
                              ? isSubCategoryOfOthers
                                ? "Others"
                                : null
                              : item.label
                          );
                        }}
                        title={
                          isSelected
                            ? `Clear filter for ${item.label}`
                            : `Filter by ${item.label}`
                        }
                        aria-label={
                          isSelected
                            ? `Clear filter for ${item.label}`
                            : `Filter by ${item.label}`
                        }
                      >
                        {isSelected ? "Active ✓" : "Filter"}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        /* Empty Search/Filter State */
        <div className="summary-table-empty">
          <p>
            No categories match your search{" "}
            {searchQuery && (
              <>
                for <strong>&ldquo;{searchQuery}&rdquo;</strong>
              </>
            )}
            .
          </p>
          <button
            type="button"
            className="summary-table-reset-btn"
            onClick={() => {
              setSearchQuery("");
              setFilterBy("all");
            }}
          >
            Clear Search &amp; Filters
          </button>
        </div>
      )}

      {/* 3. Pagination Controls (Bottom Bar) */}
      <div className="summary-table-pagination">
        <div className="summary-pagination-info">
          {totalItems > 0 ? (
            <>
              Showing <strong>{startIndex + 1}</strong>–
              <strong>{endIndex}</strong> of <strong>{totalItems}</strong>{" "}
              {totalItems === 1 ? "category" : "categories"}
            </>
          ) : (
            <>Showing 0 categories</>
          )}
        </div>

        {totalPages > 1 && (
          <div
            className="summary-pagination-nav"
            role="navigation"
            aria-label="Financial Summary Pagination"
          >
            {/* Previous Page Button */}
            <button
              type="button"
              className="summary-page-btn summary-page-btn--nav"
              onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
              aria-label="Previous page"
              title="Previous page"
            >
              <FaChevronLeft aria-hidden="true" />
              <span>Prev</span>
            </button>

            {/* Page Number Buttons */}
            <div className="summary-page-numbers">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (pageNum) => {
                  const isActive = pageNum === safeCurrentPage;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      className={`summary-page-btn ${
                        isActive ? "summary-page-btn--active" : ""
                      }`}
                      onClick={() => setCurrentPage(pageNum)}
                      aria-label={`Page ${pageNum}`}
                      aria-current={isActive ? "page" : undefined}
                    >
                      {pageNum}
                    </button>
                  );
                }
              )}
            </div>

            {/* Next Page Button */}
            <button
              type="button"
              className="summary-page-btn summary-page-btn--nav"
              onClick={() =>
                setCurrentPage((prev) => Math.min(totalPages, prev + 1))
              }
              disabled={safeCurrentPage >= totalPages}
              aria-label="Next page"
              title="Next page"
            >
              <span>Next</span>
              <FaChevronRight aria-hidden="true" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}