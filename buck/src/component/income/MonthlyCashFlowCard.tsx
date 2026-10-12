"use client";

import { FaPlus } from "react-icons/fa";
import { formatDeltaVsLastMonth, type CashFlow } from "@/utils/cashFlow";
import { formatCurrency } from "@/utils/formatters";
import styles from "./income.module.css";

/** Loading twin of the card: same classes and anatomy for zero layout shift. */
export function MonthlyCashFlowCardSkeleton({
  withAddButton = true,
}: {
  withAddButton?: boolean;
}) {
  return (
    <section className={styles.flowCard} aria-hidden="true">
      <div className={styles.flowHeader}>
        <div>
          <p className={styles.eyebrow}>
            <span className="skeleton-text">This month</span>
          </p>
          <h2 className={styles.listTitle}>
            <span className="skeleton-text">Monthly cash flow</span>
          </h2>
        </div>
        {withAddButton && (
          <span className={`${styles.primaryBtn} skeleton-text`}>+ Add Income</span>
        )}
      </div>

      <div className={styles.flowGrid}>
        {["Income", "Expenses", "Net savings"].map((label) => (
          <div key={label} className={styles.flowStat}>
            <span className={styles.flowLabel}>
              <span className="skeleton-text">{label}</span>
            </span>
            <span className={styles.flowValue}>
              <span className="skeleton-text">₱00,000</span>
            </span>
            <span className={styles.flowDelta}>
              <span className="skeleton-text">+₱0,000 vs last mo.</span>
            </span>
          </div>
        ))}
      </div>

      <div>
        <div className={styles.savedBar} />
        <span className={styles.savedCaption}>
          <span className="skeleton-text">00% of income saved</span>
        </span>
      </div>
    </section>
  );
}

export default function MonthlyCashFlowCard({
  cashFlow,
  onAddIncome,
}: {
  cashFlow: CashFlow;
  onAddIncome?: () => void;
}) {
  const { tracked } = cashFlow;
  const netIsNegative = cashFlow.netSavings < 0;
  const savedPercent = Math.round(cashFlow.savedRate * 100);

  return (
    <section className={styles.flowCard} aria-label="Monthly cash flow">
      <div className={styles.flowHeader}>
        <div>
          <p className={styles.eyebrow}>This month</p>
          <h2 className={styles.listTitle}>Monthly cash flow</h2>
        </div>
        {onAddIncome && (
          <button
            type="button"
            className={styles.primaryBtn}
            onClick={onAddIncome}
            disabled={!tracked}
          >
            <FaPlus aria-hidden="true" /> Add Income
          </button>
        )}
      </div>

      <div className={styles.flowGrid}>
        <div className={styles.flowStat}>
          <span className={styles.flowLabel}>Income</span>
          <span className={`${styles.flowValue} ${styles.flowValueIncome}`}>
            {formatCurrency(tracked ? cashFlow.monthIncome : 0)}
          </span>
          <span className={styles.flowDelta}>
            {tracked ? formatDeltaVsLastMonth(cashFlow.incomeDelta) : "Not tracked yet"}
          </span>
        </div>

        <div className={styles.flowStat}>
          <span className={styles.flowLabel}>Expenses</span>
          <span className={`${styles.flowValue} ${styles.flowValueExpense}`}>
            {formatCurrency(cashFlow.monthExpenses)}
          </span>
          <span className={styles.flowDelta}>
            {formatDeltaVsLastMonth(cashFlow.expensesDelta)}
          </span>
        </div>

        <div className={styles.flowStat}>
          <span className={styles.flowLabel}>Net savings</span>
          <span
            className={`${styles.flowValue} ${
              netIsNegative ? styles.flowValueExpense : ""
            }`}
          >
            {tracked
              ? `${netIsNegative ? "-" : ""}${formatCurrency(Math.abs(cashFlow.netSavings))}`
              : formatCurrency(0)}
          </span>
          <span className={styles.flowDelta}>
            {tracked ? formatDeltaVsLastMonth(cashFlow.netSavingsDelta) : "Not tracked yet"}
          </span>
        </div>
      </div>

      <div>
        <div
          className={styles.savedBar}
          role="progressbar"
          aria-label="Share of income saved this month"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={tracked ? savedPercent : 0}
        >
          <div
            className={`${styles.savedBarFill} ${tracked ? "" : styles.savedBarNeutral}`}
            style={{ width: tracked ? `${savedPercent}%` : "0%" }}
          />
        </div>
        <span className={styles.savedCaption}>
          {tracked ? `${savedPercent}% of income saved` : "Savings rate unavailable"}
        </span>
      </div>
    </section>
  );
}
