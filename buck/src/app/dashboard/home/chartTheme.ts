/**
 * Buck Budget Tracker - Home Dashboard Chart Theme & Color Palettes
 *
 * This configuration centralizes all color palettes used by the
 * Category Breakdown Pie Chart, Excel-style Data Callouts, and
 * Weekly Spending Bar Chart.
 *
 * You can easily customize or reorder colors by updating BUCK_PIE_PALETTE below.
 */

export interface ChartThemeConfig {
  /**
   * Slice color palette in descending order of category rank:
   * - Indices 0..3: Top 4 highest spending categories
   * - Index 4 (or last): Grouped "Others" category
   */
  palette: string[];

  /**
   * Fallback color for the "Others" category and its subcategories.
   */
  othersColor: string;

  /**
   * Theme accent colors for leader pointer lines and active highlights.
   */
  accents: {
    light: string;
    dark: string;
  };
}

/**
 * Standard Buck Warm Palette:
 * - 0: #f47536 -> Primary Buck Orange (Top category)
 * - 1: #ffc547 -> Warm Amber / Gold (2nd category)
 * - 2: #ff3838 -> Coral Red (3rd category)
 * - 3: #ffa15b -> Warm Peach / Apricot (4th category)
 * - 4: #8c7a6b -> Muted Slate Brown (Grouped "Others" category)
 */
export const BUCK_PIE_PALETTE: string[] = [
  "#f47536", // Primary Buck Orange
  "#ffc547", // Warm Amber / Gold
  "#ff3838", // Coral Red
  "#ffa15b", // Warm Peach / Apricot
  "#8c7a6b", // Muted Slate Brown for Others
];

export const CHART_THEME: ChartThemeConfig = {
  palette: BUCK_PIE_PALETTE,
  othersColor: "#8c7a6b",
  accents: {
    light: "#f47536",
    dark: "#ff8c42",
  },
};
