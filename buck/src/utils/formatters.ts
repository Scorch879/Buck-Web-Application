const currencyFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function formatCurrency(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);
  return `\u20B1${currencyFormatter.format(numericValue)}`;
}

export function formatDateRange(start: string, end: string) {
  return `${start} - ${end}`;
}

export function toNumber(value: unknown) {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) ? numericValue : 0;
}

/** Parses a user-typed PHP amount; returns null unless it fits numeric(14,2) and is > 0. */
export function parseMoneyInput(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d{1,12}(\.\d{1,2})?$/.test(trimmed)) return null;
  const parsed = Number(trimmed);
  return parsed > 0 ? parsed : null;
}

/** Adds two PHP amounts in integer centavos to avoid float drift. */
export function addMoney(a: number, b: number) {
  return Math.round((a + b) * 100) / 100;
}
