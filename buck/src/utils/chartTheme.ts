/**
 * One look for every Chart.js chart (Home, Statistics, Goals): the same axis
 * and grid colours and the same Buck tooltip as Home's bar chart, so hovering
 * feels identical on every tab.
 */

export interface BuckChartColors {
  /** Axis ticks and legend text. */
  text: string;
  /** Horizontal grid lines and axis borders. */
  grid: string;
}

export function buckChartColors(isDarkTheme: boolean): BuckChartColors {
  return {
    text: isDarkTheme ? "#d9c7b6" : "#756d68",
    grid: isDarkTheme ? "rgba(255,211,154,0.12)" : "rgba(120,92,70,0.12)",
  };
}

const TOOLTIP_FONT = "system-ui, -apple-system, Segoe UI, sans-serif";

/**
 * Espresso tooltip with a Buck Orange edge (matches `.graph-bar-tooltip` on
 * Home). Spread it into `options.plugins.tooltip` and add your own `callbacks`.
 */
export function buckTooltip(isDarkTheme: boolean) {
  return {
    backgroundColor: isDarkTheme ? "rgba(30, 16, 10, 0.96)" : "rgba(43, 37, 35, 0.96)",
    titleColor: "#fff8ed",
    bodyColor: "#fff8ed",
    footerColor: "rgba(255, 248, 237, 0.72)",
    borderColor: isDarkTheme ? "rgba(244, 117, 54, 0.55)" : "rgba(244, 117, 54, 0.45)",
    borderWidth: 1,
    cornerRadius: 8,
    padding: { top: 9, right: 12, bottom: 9, left: 12 },
    titleFont: { family: TOOLTIP_FONT, size: 12.5, weight: 600 as const },
    bodyFont: { family: TOOLTIP_FONT, size: 13, weight: 500 as const },
    titleMarginBottom: 6,
    bodySpacing: 4,
    boxPadding: 5,
    caretSize: 6,
    displayColors: true,
    usePointStyle: false,
  };
}
