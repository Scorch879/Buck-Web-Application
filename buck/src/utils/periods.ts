// Calendar helpers shared by the Statistics and Goals tabs.
//
// Day keys are local "YYYY-MM-DD" strings. Do not build them with
// toISOString(): in UTC+8 local midnight is the previous day in UTC, which
// shifted every week start back to Sunday.

export type DateRange = { start: string; end: string };
export type MonthRange = DateRange & { label: string };

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Day key of a stored date ("2026-10-12" or a full timestamp). */
export function storedDayKey(value: string | null | undefined): string {
  if (!value) return "";
  if (/^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "" : toDayKey(parsed);
}

/** Parses a day key as local midnight. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function daysBetween(startKey: string, endKey: string): number {
  return (
    Math.round(
      (parseDayKey(endKey).getTime() - parseDayKey(startKey).getTime()) / DAY_MS
    ) + 1
  );
}

/** Monday-to-Sunday weeks covering [from, to]. */
export function buildWeekRanges(from: Date, to: Date): DateRange[] {
  const ranges: DateRange[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  cursor.setDate(cursor.getDate() - ((cursor.getDay() + 6) % 7));
  while (cursor <= to) {
    const end = new Date(cursor);
    end.setDate(end.getDate() + 6);
    ranges.push({ start: toDayKey(cursor), end: toDayKey(end) });
    cursor.setDate(cursor.getDate() + 7);
  }
  return ranges;
}

/** Calendar months covering [from, to]. */
export function buildMonthRanges(from: Date, to: Date): MonthRange[] {
  const ranges: MonthRange[] = [];
  const cursor = new Date(from.getFullYear(), from.getMonth(), 1);
  while (cursor <= to) {
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    ranges.push({
      start: toDayKey(cursor),
      end: toDayKey(end),
      label: cursor.toLocaleString("en-US", { month: "long", year: "numeric" }),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return ranges;
}

/** Index of the range containing today, else the last range (-1 if empty). */
export function findCurrentRangeIndex(ranges: DateRange[]): number {
  if (ranges.length === 0) return -1;
  const today = toDayKey(new Date());
  const idx = ranges.findIndex((r) => today >= r.start && today <= r.end);
  return idx === -1 ? ranges.length - 1 : idx;
}

export function isInRange(dayKey: string, range: DateRange | undefined) {
  return Boolean(range && dayKey && dayKey >= range.start && dayKey <= range.end);
}

/** "Oct 6" or "Oct 6, 2026". */
export function formatDayKey(key: string, withYear = false): string {
  if (!key) return "";
  return parseDayKey(key).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(withYear ? { year: "numeric" } : {}),
  });
}

/** "Oct 6 – Oct 12, 2026" (year shown once unless the range spans years). */
export function formatRangeLabel(range: DateRange): string {
  const sameYear = range.start.slice(0, 4) === range.end.slice(0, 4);
  return `${formatDayKey(range.start, !sameYear)} – ${formatDayKey(range.end, true)}`;
}
