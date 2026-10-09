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

export interface CategoryTheme {
  color: string;
  bg: string;
  border: string;
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>;
}

const CATEGORY_MAP: Record<string, CategoryTheme> = {
  Food: {
    color: "#f47536",
    bg: "rgba(244, 117, 54, 0.12)",
    border: "rgba(244, 117, 54, 0.3)",
    icon: FaUtensils,
  },
  Transportation: {
    color: "#3b82f6",
    bg: "rgba(59, 130, 246, 0.12)",
    border: "rgba(59, 130, 246, 0.3)",
    icon: FaCar,
  },
  Shopping: {
    color: "#ec4899",
    bg: "rgba(236, 72, 153, 0.12)",
    border: "rgba(236, 72, 153, 0.3)",
    icon: FaShoppingBag,
  },
  Bills: {
    color: "#eab308",
    bg: "rgba(234, 179, 8, 0.12)",
    border: "rgba(234, 179, 8, 0.3)",
    icon: FaFileInvoiceDollar,
  },
  Education: {
    color: "#8b5cf6",
    bg: "rgba(139, 92, 246, 0.12)",
    border: "rgba(139, 92, 246, 0.3)",
    icon: FaBook,
  },
  Electronics: {
    color: "#06b6d4",
    bg: "rgba(6, 182, 212, 0.12)",
    border: "rgba(6, 182, 212, 0.3)",
    icon: FaLaptop,
  },
  Entertainment: {
    color: "#f97316",
    bg: "rgba(249, 115, 22, 0.12)",
    border: "rgba(249, 115, 22, 0.3)",
    icon: FaCoins,
  },
  Health: {
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.12)",
    border: "rgba(239, 68, 68, 0.3)",
    icon: FaHeartbeat,
  },
  Home: {
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.12)",
    border: "rgba(16, 185, 129, 0.3)",
    icon: FaHome,
  },
  Insurance: {
    color: "#6366f1",
    bg: "rgba(99, 102, 241, 0.12)",
    border: "rgba(99, 102, 241, 0.3)",
    icon: FaShieldAlt,
  },
  Social: {
    color: "#14b8a6",
    bg: "rgba(20, 184, 166, 0.12)",
    border: "rgba(20, 184, 166, 0.3)",
    icon: FaUsers,
  },
  Sport: {
    color: "#84cc16",
    bg: "rgba(132, 204, 22, 0.12)",
    border: "rgba(132, 204, 22, 0.3)",
    icon: FaRunning,
  },
  Telephone: {
    color: "#0ea5e9",
    bg: "rgba(14, 165, 233, 0.12)",
    border: "rgba(14, 165, 233, 0.3)",
    icon: FaPhone,
  },
  "Goal Transfer": {
    color: "#ffc547",
    bg: "rgba(255, 197, 71, 0.16)",
    border: "rgba(255, 197, 71, 0.35)",
    icon: FaCoins,
  },
  Uncategorized: {
    color: "#a8a29e",
    bg: "rgba(168, 162, 158, 0.12)",
    border: "rgba(168, 162, 158, 0.28)",
    icon: FaTag,
  },
};

const DEFAULT_THEME: CategoryTheme = {
  color: "#f47536",
  bg: "rgba(244, 117, 54, 0.12)",
  border: "rgba(244, 117, 54, 0.28)",
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
