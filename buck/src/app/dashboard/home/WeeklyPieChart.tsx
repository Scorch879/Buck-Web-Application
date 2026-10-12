"use client";

import React, { useEffect, useState } from "react";
import { Pie } from "react-chartjs-2";
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  PieController,
  type Plugin,
} from "chart.js";
import { formatCurrency } from "@/utils/formatters";
import { useAuthPageTheme } from "@/hooks/useAuthPageTheme";

ChartJS.register(ArcElement, Tooltip, Legend, PieController);

// Ensure PieController smoothly animates per-slice outerRadius zoom transitions
if (typeof window !== "undefined" || typeof global !== "undefined") {
  const originalUpdateElements = PieController.prototype.updateElements;
  if (!(PieController.prototype as any)._hasOuterRadiusZoomPatch) {
    PieController.prototype.updateElements = function (arcs: any, start: number, count: number, mode: any) {
      originalUpdateElements.call(this, arcs, start, count, mode);
      const dataset = this.getDataset();
      if (dataset && Array.isArray((dataset as any).outerRadiusMultipliers)) {
        const mults = (dataset as any).outerRadiusMultipliers;
        const baseR = this.outerRadius;
        for (let i = start; i < start + count; ++i) {
          const mult = mults[i] !== undefined ? mults[i] : 1;
          const arc = arcs[i];
          if (arc) {
            this.updateElement(arc, i, { outerRadius: baseR * mult }, mode);
          }
        }
      }
    };
    (PieController.prototype as any)._hasOuterRadiusZoomPatch = true;
  }
}

export type WeeklyPieSlice = {
  category: string;
  amount: number;
  percentage: number;
  color: string;
};

interface WeeklyPieChartProps {
  slices: WeeklyPieSlice[];
  total: number;
  centerLabel?: string;
  emptyMessage?: string;
  selectedCategory?: string | null;
  onSelectCategory?: (category: string | null) => void;
  selectedCategoryAmount?: number;
}

function getMutedColor(color: string): string {
  if (color.startsWith("#") && color.length === 7) {
    return `${color}35`;
  }
  return "rgba(140, 122, 107, 0.25)";
}

// Callout typography & geometry (shared by the draw plugin and the layout padding)
const CALLOUT_CAT_FONT = "600 12.5px system-ui, -apple-system, sans-serif";
const CALLOUT_CAT_FONT_SELECTED = "bold 13px system-ui, -apple-system, sans-serif";
const CALLOUT_PCT_FONT = "bold 13.5px system-ui, -apple-system, sans-serif";
const CALLOUT_PCT_FONT_SELECTED = "bold 15px system-ui, -apple-system, sans-serif";
const CALLOUT_LINE_HEIGHT = 15;
const CALLOUT_KNEE = 24;
const CALLOUT_SHELF = 14;
const CALLOUT_TEXT_GAP = 6;
const CALLOUT_EDGE_MARGIN = 6;
const CALLOUT_MAX_NAME_WIDTH = 104;
/** Below this canvas width, callouts show only the % (names live in the legend). */
const CALLOUT_NAMES_MIN_WIDTH = 480;

/**
 * Word-wraps a category name onto at most 2 lines within maxWidth.
 * Only a single word that still cannot fit is ellipsized (last resort).
 */
function wrapCalloutName(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text];

  // "Others (Gas Money)" breaks before the parenthesis, keeping the child name whole
  const parenSplit = text.match(/^(.+?) (\(.+\))$/);
  const words = parenSplit ? [parenSplit[1], parenSplit[2]] : text.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || (!parenSplit && ctx.measureText(candidate).width <= maxWidth)) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);

  const fitted = lines.length > 2 ? [lines[0], lines.slice(1).join(" ")] : lines;
  return fitted.map((line) => {
    if (ctx.measureText(line).width <= maxWidth) return line;
    let cut = line;
    while (cut.length > 3 && ctx.measureText(cut + "…").width > maxWidth) {
      cut = cut.slice(0, -1);
    }
    return cut + "…";
  });
}

/**
 * Resolves the label text for one slice (handles the "Others" child selection).
 */
function getCalloutText(
  slice: WeeklyPieSlice,
  opts: { isOthersChild?: boolean; selectedCategory?: string | null; selectedCategoryAmount?: number; total: number }
): { catName: string; pctText: string } {
  const isOthersAndChild = Boolean(opts.isOthersChild && slice.category === "Others" && opts.selectedCategory);
  const catName = isOthersAndChild ? `Others (${opts.selectedCategory})` : slice.category;
  const pctText =
    isOthersAndChild && opts.selectedCategoryAmount !== undefined && opts.total > 0
      ? `${((opts.selectedCategoryAmount / opts.total) * 100).toFixed(0)}%`
      : `${slice.percentage.toFixed(0)}%`;
  return { catName, pctText };
}

/**
 * Horizontal room each side of the pie must reserve so the widest callout
 * (leader knee + shelf + text) is never clipped by the canvas edge.
 */
function getCalloutSidePadding(
  ctx: CanvasRenderingContext2D,
  chartWidth: number,
  texts: { catName: string; pctText: string }[]
): number {
  const showNames = chartWidth >= CALLOUT_NAMES_MIN_WIDTH;
  ctx.save();
  let widest = 0;
  for (const { catName, pctText } of texts) {
    ctx.font = CALLOUT_PCT_FONT_SELECTED;
    widest = Math.max(widest, ctx.measureText(pctText).width);
    if (showNames) {
      ctx.font = CALLOUT_CAT_FONT_SELECTED;
      for (const line of wrapCalloutName(ctx, catName, CALLOUT_MAX_NAME_WIDTH)) {
        widest = Math.max(widest, ctx.measureText(line).width);
      }
    }
  }
  ctx.restore();
  const needed = widest + CALLOUT_KNEE + CALLOUT_SHELF + CALLOUT_TEXT_GAP + CALLOUT_EDGE_MARGIN;
  return Math.round(Math.min(Math.max(needed, 48), chartWidth * 0.32));
}

/**
 * Excel-Style Callout Data Labels Plugin
 * Draws leader pointer lines extending from each pie slice perimeter
 * to an outside category label and percentage, with collision avoidance.
 */
const excelDataCalloutPlugin: Plugin<"pie"> = {
  id: "excelDataCallout",
  afterDatasetsDraw(chart, _args, pluginOptions: any) {
    const {
      slices,
      selectedCategory,
      isDarkTheme,
      total,
      isOthersChild,
      selectedCategoryAmount,
    } = pluginOptions || {};
    if (!slices || slices.length === 0 || !total) return;

    const meta = chart.getDatasetMeta(0);
    if (!meta || !meta.data || meta.data.length === 0) return;

    const ctx = chart.ctx;

    interface LabelCallout {
      slice: WeeklyPieSlice;
      index: number;
      isSelected: boolean;
      isDimmed: boolean;
      edgeX: number;
      edgeY: number;
      kneeX: number;
      kneeY: number;
      endX: number;
      endY: number;
      isRight: boolean;
      catLines: string[];
      pctText: string;
      blockHeight: number;
    }

    const showNames = chart.width >= CALLOUT_NAMES_MIN_WIDTH;
    const labelItems: LabelCallout[] = [];

    for (let i = 0; i < meta.data.length; i++) {
      const arc: any = meta.data[i];
      const slice = slices[i];
      if (!arc || !slice || slice.amount <= 0 || slice.percentage < 1) continue;

      const isSelected = selectedCategory
        ? slice.category.toLowerCase() === selectedCategory.toLowerCase() ||
          (Boolean(isOthersChild) && slice.category === "Others")
        : false;
      const isDimmed = Boolean(selectedCategory && !isSelected);

      const angle = (arc.startAngle + arc.endAngle) / 2;
      const cx = arc.x;
      const cy = arc.y;
      const r = arc.outerRadius;

      // 1. Point on the slice perimeter
      const edgeX = cx + Math.cos(angle) * (r - 1);
      const edgeY = cy + Math.sin(angle) * (r - 1);

      // 2. Elbow knee point outward (increased clearance moves labels cleanly away from slice border)
      const kneeDist = r + CALLOUT_KNEE;
      const kneeX = cx + Math.cos(angle) * kneeDist;
      const kneeY = cy + Math.sin(angle) * kneeDist;

      // 3. Horizontal shelf extension
      const isRight = Math.cos(angle) >= 0;
      const endX = kneeX + (isRight ? CALLOUT_SHELF : -CALLOUT_SHELF);
      const endY = kneeY;

      // 4. Label text: name wraps to max 2 lines (names hidden on narrow canvases)
      const { catName, pctText } = getCalloutText(slice, {
        isOthersChild,
        selectedCategory,
        selectedCategoryAmount,
        total,
      });
      ctx.font = isSelected ? CALLOUT_CAT_FONT_SELECTED : CALLOUT_CAT_FONT;
      const catLines = showNames ? wrapCalloutName(ctx, catName, CALLOUT_MAX_NAME_WIDTH) : [];
      const blockHeight = (catLines.length + 1) * CALLOUT_LINE_HEIGHT + 2;

      labelItems.push({
        slice,
        index: i,
        isSelected,
        isDimmed,
        edgeX,
        edgeY,
        kneeX,
        kneeY,
        endX,
        endY,
        isRight,
        catLines,
        pctText,
        blockHeight,
      });
    }

    if (labelItems.length === 0) return;

    // Resolve vertical overlaps on both sides
    const rightLabels = labelItems.filter((l) => l.isRight).sort((a, b) => a.endY - b.endY);
    const leftLabels = labelItems.filter((l) => !l.isRight).sort((a, b) => a.endY - b.endY);

    const resolveCollisions = (list: LabelCallout[]) => {
      for (let pass = 0; pass < 4; pass++) {
        for (let k = 1; k < list.length; k++) {
          const prev = list[k - 1];
          const curr = list[k];
          const diff = curr.endY - prev.endY;
          // Gap scales with each label's line count so wrapped labels never overlap
          const minVerticalGap = (prev.blockHeight + curr.blockHeight) / 2 + 4;
          if (diff < minVerticalGap) {
            const overlap = minVerticalGap - diff;
            prev.endY -= overlap * 0.5;
            prev.kneeY -= overlap * 0.35;
            curr.endY += overlap * 0.5;
            curr.kneeY += overlap * 0.35;
          }
        }
      }
    };

    resolveCollisions(rightLabels);
    resolveCollisions(leftLabels);

    // Vertical boundary clamping so callouts near top/bottom (like Others and Bills) are never cut off
    for (const item of labelItems) {
      const minY = item.blockHeight / 2 + 4;
      const maxY = chart.height - item.blockHeight / 2 - 4;
      if (item.endY < minY) {
        item.endY = minY;
        item.kneeY = Math.max(minY - 4, item.kneeY);
      } else if (item.endY > maxY) {
        item.endY = maxY;
        item.kneeY = Math.min(maxY + 4, item.kneeY);
      }
    }

    ctx.save();

    for (const item of labelItems) {
      const { slice, isSelected, isDimmed, edgeX, edgeY, kneeX, kneeY, isRight } = item;
      let { endX, endY } = item;

      const lineColor = isSelected
        ? isDarkTheme ? "#ff8c42" : "#f47536"
        : isDimmed
        ? isDarkTheme ? "rgba(140, 122, 107, 0.35)" : "rgba(180, 160, 150, 0.45)"
        : slice.color;

      // Format Label Text
      ctx.textAlign = isRight ? "left" : "right";
      ctx.textBaseline = "middle";

      const { catLines, pctText, blockHeight } = item;

      const textColor = isSelected
        ? isDarkTheme ? "#ffffff" : "#1e0600"
        : isDimmed
        ? isDarkTheme ? "rgba(255, 255, 255, 0.4)" : "rgba(30, 6, 0, 0.4)"
        : isDarkTheme ? "#f3e8df" : "#2d1c12";

      const pctColor = isDimmed
        ? isDarkTheme ? "rgba(244, 117, 54, 0.4)" : "rgba(244, 117, 54, 0.4)"
        : isSelected
        ? isDarkTheme ? "#ff8c42" : "#f47536"
        : slice.color;

      // Universally supported CSS font strings in Canvas 2D
      const catFont = isSelected ? CALLOUT_CAT_FONT_SELECTED : CALLOUT_CAT_FONT;
      const pctFont = isSelected ? CALLOUT_PCT_FONT_SELECTED : CALLOUT_PCT_FONT;

      ctx.font = catFont;
      const textWidth = catLines.reduce((w, line) => Math.max(w, ctx.measureText(line).width), 0);
      ctx.font = pctFont;
      const pctWidth = ctx.measureText(pctText).width;
      const neededWidth = Math.max(textWidth, pctWidth);

      // Horizontal boundaries: layout padding reserves room for the widest label,
      // so this clamp only nudges text inward on extreme slice angles.
      let safeTextX: number;
      if (isRight) {
        safeTextX = endX + CALLOUT_TEXT_GAP;
        if (safeTextX + neededWidth > chart.width - CALLOUT_EDGE_MARGIN) {
          safeTextX = chart.width - CALLOUT_EDGE_MARGIN - neededWidth;
          endX = Math.max(kneeX, safeTextX - CALLOUT_TEXT_GAP);
        }
      } else {
        safeTextX = endX - CALLOUT_TEXT_GAP;
        if (safeTextX - neededWidth < CALLOUT_EDGE_MARGIN) {
          safeTextX = neededWidth + CALLOUT_EDGE_MARGIN;
          endX = Math.min(kneeX, safeTextX + CALLOUT_TEXT_GAP);
        }
      }

      // 1. Draw Leader Line (Slice edge -> Knee -> Shelf)
      ctx.beginPath();
      ctx.moveTo(edgeX, edgeY);
      ctx.lineTo(kneeX, kneeY);
      ctx.lineTo(endX, endY);
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = isSelected ? 2 : 1.25;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.stroke();

      // 2. Small anchor dot on slice perimeter
      ctx.beginPath();
      ctx.arc(edgeX, edgeY, isSelected ? 2.5 : 2, 0, Math.PI * 2);
      ctx.fillStyle = lineColor;
      ctx.fill();

      // 3. Category label (top line(s)), block vertically centred on the shelf
      const firstLineY = endY - blockHeight / 2 + CALLOUT_LINE_HEIGHT / 2 + 1;
      ctx.font = catFont;
      ctx.fillStyle = textColor;
      catLines.forEach((line, lineIndex) => {
        ctx.fillText(line, safeTextX, firstLineY + lineIndex * CALLOUT_LINE_HEIGHT);
      });

      // 4. Percentage label (bottom line)
      ctx.font = pctFont;
      ctx.fillStyle = pctColor;
      ctx.fillText(pctText, safeTextX, firstLineY + catLines.length * CALLOUT_LINE_HEIGHT + 1);
    }

    ctx.restore();
  },
};

export default function WeeklyPieChart({
  slices,
  total,
  centerLabel = "Total this week",
  emptyMessage = "No expenses recorded in this period",
  selectedCategory = null,
  onSelectCategory,
  selectedCategoryAmount,
}: WeeklyPieChartProps) {
  const [mounted, setMounted] = useState(false);
  const isDarkTheme = useAuthPageTheme();

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDirectSliceMatch = Boolean(
    selectedCategory &&
      slices.some(
        (s) => s.category.toLowerCase() === selectedCategory.toLowerCase()
      )
  );

  const isOthersChild = Boolean(
    selectedCategory &&
      selectedCategory.toLowerCase() !== "others" &&
      !isDirectSliceMatch
  );

  const isSliceActive = (sliceCategory: string): boolean => {
    if (!selectedCategory) return false;
    if (sliceCategory.toLowerCase() === selectedCategory.toLowerCase()) return true;
    if (isOthersChild && sliceCategory === "Others") return true;
    return false;
  };

  const activeSlice = isDirectSliceMatch
    ? slices.find(
        (s) => s.category.toLowerCase() === selectedCategory?.toLowerCase()
      )
    : isOthersChild
    ? slices.find((s) => s.category === "Others")
    : null;

  if (!mounted) {
    return (
      <div className="spending-pie-loading" aria-hidden="true">
        <div className="spending-pie-placeholder" />
      </div>
    );
  }

  if (total === 0 || slices.length === 0) {
    return (
      <div className="spending-pie-empty-wrapper">
        <div className="spending-circle">
          <div className="spending-amount">₱0.00</div>
        </div>
        <p className="spending-label">{emptyMessage}</p>
      </div>
    );
  }

  const chartData = {
    labels: slices.map((s) => s.category),
    datasets: [
      {
        data: slices.map((s) => s.amount),
        backgroundColor: slices.map((s) =>
          selectedCategory
            ? isSliceActive(s.category)
              ? s.color
              : getMutedColor(s.color)
            : s.color
        ),
        borderColor: slices.map((s) =>
          selectedCategory && isSliceActive(s.category)
            ? isDarkTheme ? "#ffffff" : "#1e0600"
            : isDarkTheme ? "rgba(30, 6, 0, 0.95)" : "#fffaf6"
        ),
        borderWidth: slices.map((s) =>
          selectedCategory && isSliceActive(s.category) ? 3 : 2
        ),
        offset: slices.map((s) =>
          selectedCategory && isSliceActive(s.category) ? 14 : 0
        ),
        hoverOffset: slices.map((s) =>
          selectedCategory && isSliceActive(s.category) ? 16 : 8
        ),
        ...({
          outerRadiusMultipliers: slices.map((s) =>
            selectedCategory
              ? isSliceActive(s.category)
                ? 1.02
                : 0.85
              : 1.0
          ),
        } as any),
      },
    ],
  };

  const calloutTexts = slices
    .filter((s) => s.amount > 0 && s.percentage >= 1)
    .map((s) =>
      getCalloutText(s, { isOthersChild, selectedCategory, selectedCategoryAmount, total })
    );

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      // Sized from the measured callout labels so the pie keeps the largest radius
      // that still leaves room for every label (replaces fixed 70px / 44px padding).
      padding: (context: { chart: ChartJS }) => {
        const side = getCalloutSidePadding(context.chart.ctx, context.chart.width, calloutTexts);
        return { top: 38, bottom: 38, left: side, right: side };
      },
    },
    onClick: (_event: any, elements: any[]) => {
      if (elements && elements.length > 0 && onSelectCategory) {
        const index = elements[0].index;
        const clickedSlice = slices[index];
        if (clickedSlice) {
          if (isSliceActive(clickedSlice.category)) {
            onSelectCategory(null);
          } else {
            onSelectCategory(clickedSlice.category);
          }
        }
      }
    },
    onHover: (event: any, chartElement: any[]) => {
      if (event?.native?.target) {
        (event.native.target as HTMLElement).style.cursor =
          chartElement && chartElement.length > 0 ? "pointer" : "default";
      }
    },
    plugins: {
      legend: {
        display: false,
      },
      excelDataCallout: {
        slices,
        selectedCategory,
        isDarkTheme,
        total,
        isOthersChild,
        selectedCategoryAmount,
      },
      tooltip: {
        backgroundColor: isDarkTheme ? "rgba(30, 6, 0, 0.96)" : "rgba(43, 37, 35, 0.96)",
        titleColor: "#fff8ed",
        bodyColor: "#fff8ed",
        borderColor: "rgba(244, 117, 54, 0.45)",
        borderWidth: 1,
        padding: 10,
        cornerRadius: 8,
        displayColors: true,
        boxPadding: 4,
        callbacks: {
          labelColor: function (context: any) {
            const slice = slices[context.dataIndex];
            const sliceColor = slice?.color || "#f47536";
            return {
              borderColor: sliceColor,
              backgroundColor: sliceColor,
              borderWidth: 1,
              borderRadius: 2,
            };
          },
          label: function (context: any) {
            const label = context.label || "";
            const value = Number(context.raw) || 0;
            const pct = total > 0 ? ((value / total) * 100).toFixed(1) : "0";
            return ` ${label}: ${formatCurrency(value)} (${pct}%)`;
          },
        },
      },
    },
    animation: {
      duration: 380,
      easing: "easeOutQuart" as const,
    },
  };

  const centerAmount = selectedCategory
    ? isOthersChild && selectedCategoryAmount !== undefined
      ? selectedCategoryAmount
      : activeSlice
      ? activeSlice.amount
      : total
    : total;

  const centerDisplayLabel = selectedCategory
    ? isOthersChild
      ? `${selectedCategory} (${
          total > 0 && selectedCategoryAmount !== undefined
            ? ((selectedCategoryAmount / total) * 100).toFixed(0)
            : "0"
        }%)`
      : activeSlice
      ? `${activeSlice.category} (${activeSlice.percentage.toFixed(0)}%)`
      : centerLabel
    : centerLabel;

  const isAllSelected = !selectedCategory;
  const isAllDimmed = Boolean(selectedCategory);

  return (
    <div className="spending-pie-layout">
      {/* 1. Left side: Pill Boxes / Legend Filter List */}
      <div className="spending-pie-legend" role="list" aria-label="Category spending breakdown">
        <button
          type="button"
          className={`spending-pie-legend-item spending-pie-legend-item--all ${
            isAllSelected ? "spending-pie-legend-item--selected" : ""
          } ${isAllDimmed ? "spending-pie-legend-item--dimmed" : ""}`}
          onClick={() => onSelectCategory?.(null)}
          aria-pressed={isAllSelected}
          title="View all categories"
        >
          <span className="spending-pie-legend-dot spending-pie-legend-dot--all" aria-hidden="true" />
          <span className="spending-pie-legend-name">All</span>
        </button>

        {slices.map((slice) => {
          const isSelected = isSliceActive(slice.category);
          const isDimmed = Boolean(selectedCategory && !isSelected);

          const isOthersAndChildActive = isOthersChild && slice.category === "Others";
          const displayName = isOthersAndChildActive
            ? `Others: ${selectedCategory}`
            : slice.category;

          return (
            <button
              key={slice.category}
              type="button"
              className={`spending-pie-legend-item ${
                isSelected ? "spending-pie-legend-item--selected" : ""
              } ${isDimmed ? "spending-pie-legend-item--dimmed" : ""}`}
              onClick={() => {
                if (isSelected) {
                  onSelectCategory?.(null);
                } else {
                  onSelectCategory?.(slice.category);
                }
              }}
              aria-pressed={isSelected}
              title={`Filter by ${displayName}`}
            >
              <span
                className="spending-pie-legend-dot"
                style={{ backgroundColor: slice.color }}
                aria-hidden="true"
              />
              <span className="spending-pie-legend-name" title={displayName}>
                {displayName}
              </span>
              <span className="spending-pie-legend-pct">
                {getCalloutText(slice, { isOthersChild, selectedCategory, selectedCategoryAmount, total }).pctText}
              </span>
            </button>
          );
        })}
      </div>

      {/* 2. Right side: Pie Chart Canvas & Center Info */}
      <div className="spending-pie-canvas-box">
        <div className="spending-pie-canvas-inner">
          <Pie data={chartData} options={chartOptions} plugins={[excelDataCalloutPlugin]} />
        </div>
        <div className="spending-pie-center-info">
          <span className="spending-pie-center-amount">{formatCurrency(centerAmount)}</span>
          <span className="spending-pie-center-label">{centerDisplayLabel}</span>
        </div>
      </div>
    </div>
  );
}
