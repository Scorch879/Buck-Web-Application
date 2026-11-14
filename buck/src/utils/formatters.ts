const wholeCurrencyFormatter = new Intl.NumberFormat("en-PH", {
  maximumFractionDigits: 0,
});
const centsCurrencyFormatter = new Intl.NumberFormat("en-PH", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

// Whole pesos stay short (\u20B175,000); any centavos always show two digits
// (\u20B113,222.70, never \u20B113,222.7).
export function formatCurrency(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);
  const cents = Math.round(numericValue * 100);
  const formatter = cents % 100 === 0 ? wholeCurrencyFormatter : centsCurrencyFormatter;
  return `\u20B1${formatter.format(cents / 100)}`;
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

/** Strips non-numeric characters from a wallet budget input while keeping one decimal point. */
export function sanitizeBudgetInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.,]/g, "");
  const firstDot = cleaned.indexOf(".");
  if (firstDot === -1) return cleaned;
  return (
    cleaned.slice(0, firstDot + 1) +
    cleaned.slice(firstDot + 1).replace(/\./g, "")
  );
}

/** Parses a formatted wallet budget string (allowing commas) using numeric(14,2) validation. */
export function parseBudgetInput(raw: string): number | null {
  return parseMoneyInput(raw.replace(/,/g, ""));
}

/** Adds two PHP amounts in integer centavos to avoid float drift. */
export function addMoney(a: number, b: number) {
  return Math.round((a + b) * 100) / 100;
}

/** Formats a numeric wallet budget into an editable comma-grouped string. */
export function formatEditableBudget(value: number): string {
  const num = Number(value) || 0;
  return num.toLocaleString("en-US", {
    minimumFractionDigits: num % 1 !== 0 ? 2 : 0,
    maximumFractionDigits: 2,
  });
}

/** Formats an ISO/date string with medium date style (and optional short time), returning null if missing or invalid. */
export function formatMediumDateTime(
  value: string | null | undefined,
  includeTime = true
): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat(
    undefined,
    includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }
  ).format(date);
}
