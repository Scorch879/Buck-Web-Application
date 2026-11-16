import React from "react";
import {
  FaUtensils,
  FaCar,
  FaShoppingBag,
  FaFileInvoiceDollar,
  FaBook,
  FaLaptop,
  FaCoins,
  FaHeartbeat,
  FaHome,
  FaShieldAlt,
  FaUsers,
  FaRunning,
  FaPhone,
  FaTag,
} from "react-icons/fa";

import { DEFAULT_CATEGORY_COLOR, getCategoryColor } from "@/utils/categoryUtils";

export interface CategoryTheme {
  color: string;
  bg: string;
  border: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace("#", "");
  const full =
    clean.length === 3
      ? clean
          .split("")
          .map((ch) => ch + ch)
          .join("")
      : clean;
  const r = Number.parseInt(full.slice(0, 2), 16);
  const g = Number.parseInt(full.slice(2, 4), 16);
  const b = Number.parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function buildTheme(
  name: string,
  icon: CategoryTheme["icon"],
  bgAlpha = 0.12,
  borderAlpha = 0.3
): CategoryTheme {
  const color = getCategoryColor(name);
  return {
    color,
    bg: hexToRgba(color, bgAlpha),
    border: hexToRgba(color, borderAlpha),
    icon,
  };
}

const CATEGORY_MAP: Record<string, CategoryTheme> = {
  Food: buildTheme("Food", FaUtensils),
  Transportation: buildTheme("Transportation", FaCar),
  Shopping: buildTheme("Shopping", FaShoppingBag),
  Bills: buildTheme("Bills", FaFileInvoiceDollar),
  Education: buildTheme("Education", FaBook),
  Electronics: buildTheme("Electronics", FaLaptop),
  Entertainment: buildTheme("Entertainment", FaCoins),
  Health: buildTheme("Health", FaHeartbeat),
  Home: buildTheme("Home", FaHome),
  Insurance: buildTheme("Insurance", FaShieldAlt),
  Social: buildTheme("Social", FaUsers),
  Sport: buildTheme("Sport", FaRunning),
  Telephone: buildTheme("Telephone", FaPhone),
  "Goal Transfer": buildTheme("Goal Transfer", FaCoins, 0.16, 0.35),
  Uncategorized: buildTheme("Uncategorized", FaTag, 0.12, 0.28),
};

const DEFAULT_THEME: CategoryTheme = {
  color: DEFAULT_CATEGORY_COLOR,
  bg: hexToRgba(DEFAULT_CATEGORY_COLOR, 0.12),
  border: hexToRgba(DEFAULT_CATEGORY_COLOR, 0.28),
  icon: FaTag,
};

export function getCategoryTheme(name?: string | null): CategoryTheme {
  if (!name) return DEFAULT_THEME;
  const trimmed = name.trim();
  // Direct match
  if (CATEGORY_MAP[trimmed]) return CATEGORY_MAP[trimmed];
  // Case-insensitive match
  const lower = trimmed.toLowerCase();
  for (const [key, val] of Object.entries(CATEGORY_MAP)) {
    if (key.toLowerCase() === lower) return val;
  }
  return DEFAULT_THEME;
}
