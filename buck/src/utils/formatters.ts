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
