// Calendar days for the MCP server. Buck's dates (spent_on, received_on) are
// Philippine calendar days, but the server runs in UTC, so "today" is taken in
// Asia/Manila. Day keys are "YYYY-MM-DD".

const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const manilaFormat = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Manila",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function manilaToday(now = new Date()): string {
  return manilaFormat.format(now);
}

function toUtcMs(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

export function isDayKey(value: string): boolean {
  if (!DAY_KEY.test(value)) return false;
  return new Date(toUtcMs(value)).toISOString().slice(0, 10) === value;
}

export function addDays(key: string, days: number): string {
  return new Date(toUtcMs(key) + days * DAY_MS).toISOString().slice(0, 10);
}

export function monthStart(key: string): string {
  return `${key.slice(0, 7)}-01`;
}

/** Days from `from` to `to`, both included. */
export function daysInclusive(from: string, to: string): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / DAY_MS) + 1;
}
