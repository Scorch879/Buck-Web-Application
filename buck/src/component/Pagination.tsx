"use client";

import { motion } from "framer-motion";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";

export type PaginationPage = number | "ellipsis-start" | "ellipsis-end";

export function getPaginationPages(
  current: number,
  total: number
): PaginationPage[] {
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

export type PaginationClassNames = {
  root?: string;
  spacer?: string;
  nav?: string;
  navButton?: string;
  numbers?: string;
  pageButton?: string;
  activePageButton?: string;
  ellipsis?: string;
  info?: string;
  infoFull?: string;
  infoShort?: string;
};

const DEFAULT_CLASSES: Required<PaginationClassNames> = {
  root: "cat-pagination",
  spacer: "cat-pagination-spacer",
  nav: "cat-pagination-nav",
  navButton: "cat-page-btn cat-page-btn--nav",
  numbers: "cat-page-numbers",
  pageButton: "cat-page-btn",
  activePageButton: "cat-page-btn--active",
  ellipsis: "cat-page-ellipsis",
  info: "cat-pagination-info",
  infoFull: "cat-pagination-info-full",
  infoShort: "cat-pagination-info-short",
};

interface PaginationProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  startIndex: number;
  endIndex: number;
  onPageChange: (page: number) => void;
  ariaLabel?: string;
  classNames?: PaginationClassNames;
}

export default function Pagination({
  currentPage,
  totalPages,
  totalItems,
  startIndex,
  endIndex,
  onPageChange,
  ariaLabel = "Pagination",
  classNames,
}: PaginationProps) {
  if (totalItems <= 0) return null;

  const cls = { ...DEFAULT_CLASSES, ...classNames };

  return (
    <div className={cls.root} role="navigation" aria-label={ariaLabel}>
      <div className={cls.spacer} aria-hidden="true" />

      <div className={cls.nav}>
        <motion.button
          type="button"
          className={cls.navButton}
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
          aria-label="Previous page"
          title="Previous page"
          whileHover={currentPage <= 1 ? undefined : { scale: 1.03 }}
          whileTap={currentPage <= 1 ? undefined : { scale: 0.98 }}
        >
          <FaChevronLeft aria-hidden="true" />
          <span>Prev</span>
        </motion.button>

        <div className={cls.numbers}>
          {getPaginationPages(currentPage, totalPages).map((p, idx) => {
            if (typeof p === "string") {
              return (
                <span key={`${p}-${idx}`} className={cls.ellipsis} aria-hidden="true">
                  …
                </span>
              );
            }
            const isActive = p === currentPage;
            return (
              <motion.button
                key={p}
                type="button"
                className={`${cls.pageButton}${isActive ? ` ${cls.activePageButton}` : ""}`}
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
          className={cls.navButton}
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
          aria-label="Next page"
          title="Next page"
          whileHover={currentPage >= totalPages ? undefined : { scale: 1.03 }}
          whileTap={currentPage >= totalPages ? undefined : { scale: 0.98 }}
        >
          <span>Next</span>
          <FaChevronRight aria-hidden="true" />
        </motion.button>
      </div>

      <div className={cls.info}>
        <span className={cls.infoFull}>
          Showing <strong>{startIndex + 1}</strong>–<strong>{endIndex}</strong> of{" "}
          <strong>{totalItems}</strong>
        </span>
        <span className={cls.infoShort}>
          <strong>{startIndex + 1}</strong>–<strong>{endIndex}</strong> of{" "}
          <strong>{totalItems}</strong>
        </span>
      </div>
    </div>
  );
}
