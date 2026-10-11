"use client";

import type { CSSProperties } from "react";
import { useMemo } from "react";
import { formatCurrency } from "@/utils/formatters";

export type WeeklyDatum = {
  day: string;
  amount: number;
};

export const fullDayNames: Record<string, string> = {
  Mon: "Monday",
  Tue: "Tuesday",
  Wed: "Wednesday",
  Thu: "Thursday",
  Fri: "Friday",
  Sat: "Saturday",
  Sun: "Sunday",
};
function computeNiceYAxis(rawMax: number): {
  step: number;
  count: number;
  yMax: number;
  labels: number[];
} {
  if (rawMax <= 0) {
    const defaultStep = 100;
    const defaultCount = 5;
    return {
      step: defaultStep,
      count: defaultCount,
      yMax: defaultStep * defaultCount,
      labels: Array.from(
        { length: defaultCount + 1 },
        (_, i) => (defaultCount - i) * defaultStep
      ),
    };
  }

  // Target 5 intervals by default (clean readability for 250px chart)
  const targetCount = 5;
  const roughStep = rawMax / targetCount;
  const power = Math.floor(Math.log10(roughStep));
  const magnitude = Math.pow(10, power);

  // Standard human-friendly step multipliers: 1, 2, 2.5, 5, 10
  const candidateMultipliers = [1, 2, 2.5, 5, 10];
  let bestStep = 10 * magnitude;
  let bestCount = Math.ceil(rawMax / bestStep);

  for (const mult of candidateMultipliers) {
    const candidateStep = mult * magnitude;
    const count = Math.ceil(rawMax / candidateStep);
    // Find first multiplier that yields a clean interval count between 4 and 7
    if (count >= 4 && count <= 7) {
      bestStep = candidateStep;
      bestCount = count;
      break;
    }
  }

  const yMax = bestStep * bestCount;
  // Uniform tick labels from top (yMax) down to 0
  const labels = Array.from(
    { length: bestCount + 1 },
    (_, i) => (bestCount - i) * bestStep
  );

  return {
    step: bestStep,
    count: bestCount,
    yMax,
    labels,
  };
}

export default function WeeklyBarChart({
  data,
  categoryColor,
  selectedDay,
  onSelectDay,
}: {
  data: WeeklyDatum[];
  categoryColor?: string;
  selectedDay?: string | null;
  onSelectDay?: (day: string) => void;
}) {
  const rawMax = Math.max(0, ...data.map((item) => item.amount));
  const hasData = data.some((item) => item.amount > 0);
  const yAxis = useMemo(() => computeNiceYAxis(rawMax), [rawMax]);
  const isAnyDaySelected = Boolean(selectedDay);

  return (
    <div className="graph-container">
      {/* Y-Axis Column: Vertical Axis Label + Tick Values */}
      <div className="graph-y-axis-wrap">
        <span className="graph-axis-title graph-axis-title--y" aria-hidden="true">
          Amount (₱)
        </span>
        <div className="graph-axis" aria-hidden="true">
          {yAxis.labels.map((label, idx) => (
            <span key={`${label}-${idx}`}>{label.toLocaleString()}</span>
          ))}
        </div>
      </div>

      {/* Main Chart Body: Bars Grid + X-Axis Label */}
      <div className="graph-body">
        <div className="graph-bars">
          {/* Background Horizontal Broken/Dashed Grid Lines (Excel-Style) */}
          <div className="graph-grid" aria-hidden="true">
            {Array.from({ length: yAxis.count }, (_, i) => (
              <div
                key={i}
                className="graph-grid-line"
                style={{ bottom: `${((yAxis.count - i) / yAxis.count) * 100}%` }}
              />
            ))}
          </div>

          {data.map((item) => {
            const height =
              yAxis.yMax === 0 || !hasData
                ? 0
                : Math.min(100, Math.round((item.amount / yAxis.yMax) * 1000) / 10);
            const isSelected = selectedDay === item.day;
            const isEmpty = !hasData || item.amount === 0;
            const barStyle = {
              "--bar-height": `${height}%`,
              ...(categoryColor
                ? {
                    background: `linear-gradient(180deg, ${categoryColor}, rgba(244, 117, 54, 0.45))`,
                  }
                : {}),
            } as CSSProperties;

            // The whole day column (full chart height + day label) is the hit target,
            // so tiny or zero bars stay easy to click/tap.
            return (
              <button
                key={item.day}
                type="button"
                className={`graph-col ${isSelected ? "graph-col--selected" : ""} ${
                  isAnyDaySelected && !isSelected ? "graph-col--dimmed" : ""
                }`}
                onClick={() => onSelectDay?.(item.day)}
                // ₱0 days have nothing to break down. Selecting one used to render a
                // filtered frame that the page immediately reverted (visible jitter).
                disabled={isEmpty && !isSelected}
                aria-pressed={isSelected}
                aria-label={`${fullDayNames[item.day] || item.day}: ${formatCurrency(item.amount)}${
                  isSelected ? " (Selected)" : ""
                }`}
                title={
                  isEmpty
                    ? `${fullDayNames[item.day] || item.day}: no expenses recorded`
                    : `${item.day}: ${formatCurrency(item.amount)} (Click to view breakdown for ${
                        fullDayNames[item.day] || item.day
                      })`
                }
              >
                <span
                  className={`graph-bar ${isEmpty ? "graph-bar--empty" : ""}`}
                  style={barStyle}
                >
                  {!isEmpty && (
                    <span className="graph-bar-tooltip" aria-hidden="true">
                      <span className="graph-bar-tooltip-amount">
                        {formatCurrency(item.amount)}
                      </span>
                    </span>
                  )}
                </span>
                <span className="graph-bar-label">{item.day}</span>
              </button>
            );
          })}
          {!hasData && (
            <div className="graph-bars-empty-overlay" aria-live="polite">
              <span>No expenses recorded for this selection</span>
            </div>
          )}
        </div>
        <div className="graph-x-axis-footer" aria-hidden="true">
          <span className="graph-axis-title graph-axis-title--x">
            Day of the Week
          </span>
        </div>
      </div>
    </div>
  );
}
