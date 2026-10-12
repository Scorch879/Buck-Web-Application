import { formatCurrency } from "@/utils/formatters";

/**
 * Monthly cash-flow figures. The formulas mirror the Buck mobile app's
 * `FinanceSnapshot` so both clients show identical numbers.
 */

export type DatedAmount = {
  amount: number;
  date: string;
};

export type CashFlow = {
  /** `false` when the incomes table is unavailable (income not tracked yet). */
  tracked: boolean;
  monthIncome: number;
  lastMonthIncome: number;
  monthExpenses: number;
  lastMonthExpenses: number;
  /** `monthIncome - monthExpenses`; may be negative. */
  netSavings: number;
  lastMonthNetSavings: number;
  /** Share of this month's income saved, clamped to 0..1; 0 without income. */
  savedRate: number;
  netSavingsDelta: number;
  incomeDelta: number;
  expensesDelta: number;
};

/** Parses `YYYY-MM-DD[...]` as a local calendar date (local midnight). */
export function parseLocalDate(value: string): Date | null {
  if (!value) return null;

  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (match) {
    return new Date(
      parseInt(match[1], 10),
      parseInt(match[2], 10) - 1,
      parseInt(match[3], 10)
    );
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Local `YYYY-MM-DD` for a date (never goes through UTC). */
export function toLocalDateString(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

function sumInRange(
  items: DatedAmount[],
  start: Date,
  endExclusive: Date
): number {
  let total = 0;
  for (const item of items) {
    const date = parseLocalDate(item.date);
    if (date && date >= start && date < endExclusive) {
      total += Number.isFinite(item.amount) ? item.amount : 0;
    }
  }
  return total;
}

export function computeCashFlow(
  incomes: DatedAmount[] | null,
  expenses: DatedAmount[],
  now: Date = new Date()
): CashFlow {
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const monthExpenses = sumInRange(expenses, monthStart, nextMonth);
  const lastMonthExpenses = sumInRange(expenses, lastMonthStart, monthStart);
  const tracked = incomes !== null;
  const monthIncome = incomes ? sumInRange(incomes, monthStart, nextMonth) : 0;
  const lastMonthIncome = incomes
    ? sumInRange(incomes, lastMonthStart, monthStart)
    : 0;

  const netSavings = monthIncome - monthExpenses;
  const lastMonthNetSavings = lastMonthIncome - lastMonthExpenses;
  const savedRate =
    monthIncome > 0
      ? Math.min(1, Math.max(0, (monthIncome - monthExpenses) / monthIncome))
      : 0;

  return {
    tracked,
    monthIncome,
    lastMonthIncome,
    monthExpenses,
    lastMonthExpenses,
    netSavings,
    lastMonthNetSavings,
    savedRate,
    netSavingsDelta: netSavings - lastMonthNetSavings,
    incomeDelta: monthIncome - lastMonthIncome,
    expensesDelta: monthExpenses - lastMonthExpenses,
  };
}

/** `+₱5,000 vs last mo.` / `-₱2,100 vs last mo.` */
export function formatDeltaVsLastMonth(delta: number) {
  const sign = delta < 0 ? "-" : "+";
  return `${sign}${formatCurrency(Math.abs(delta))} vs last mo.`;
}
