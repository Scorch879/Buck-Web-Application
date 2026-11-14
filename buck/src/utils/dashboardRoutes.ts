import type { IconType } from "react-icons";
import {
  FaBullseye,
  FaChartArea,
  FaChartLine,
  FaCog,
  FaHome,
  FaReceipt,
  FaRobot,
  FaTags,
  FaWallet,
} from "react-icons/fa";
import type { DashboardSkeletonVariant } from "@/component/DashboardSkeletons";

export interface DashboardPageChrome {
  title: string;
  eyebrow: string;
  description: string;
}

export interface DashboardRoute {
  id: DashboardNavId;
  label: string;
  href: string;
  icon: IconType;
  skeletonVariant: DashboardSkeletonVariant;
  chrome: DashboardPageChrome;
  adminOnly?: boolean;
}

export type DashboardNavId =
  | "home"
  | "expenses"
  | "wallet"
  | "categories"
  | "advisor"
  | "forecast"
  | "statistics"
  | "goals"
  | "admin"
  | "settings";

/**
 * Single route config driving sidebar nav, topbar chrome, and loading skeletons.
 * Keeping home first lets `findDashboardRoute` fall back to it cleanly.
 */
export const DASHBOARD_ROUTES: readonly DashboardRoute[] = [
  {
    id: "home",
    label: "Home",
    href: "/dashboard/home",
    icon: FaHome,
    skeletonVariant: "home",
    chrome: {
      title: "Dashboard",
      eyebrow: "Home",
      description: "Your weekly budget, spending, and summary at a glance.",
    },
  },
  {
    id: "expenses",
    label: "Expenses",
    href: "/dashboard/expenses",
    icon: FaReceipt,
    skeletonVariant: "expenses",
    chrome: {
      title: "Expenses",
      eyebrow: "Track the money trail",
      description: "Log spending, review recent expenses, and keep the wallet honest.",
    },
  },
  {
    id: "wallet",
    label: "Wallet",
    href: "/dashboard/wallet",
    icon: FaWallet,
    skeletonVariant: "wallet",
    chrome: {
      title: "Wallets",
      eyebrow: "Wallet management",
      description: "Manage your active wallets and total budget.",
    },
  },
  {
    id: "categories",
    label: "Categories",
    href: "/dashboard/categories",
    icon: FaTags,
    skeletonVariant: "categories",
    chrome: {
      title: "Categories",
      eyebrow: "Organize your money",
      description: "Create, rename, and clean up your expense and income categories.",
    },
  },
  {
    id: "advisor",
    label: "Financial Advisor",
    href: "/dashboard/financial-advisor",
    icon: FaRobot,
    skeletonVariant: "financial-advisor",
    chrome: {
      title: "Financial Advisor",
      eyebrow: "Buck's next-step notes",
      description: "Readable suggestions from your wallet, goals, and spending rhythm.",
    },
  },
  {
    id: "forecast",
    label: "Forecast",
    href: "/dashboard/forecast",
    icon: FaChartArea,
    skeletonVariant: "forecast",
    chrome: {
      title: "Forecast",
      eyebrow: "Future planning",
      description: "Predict your financial future based on your current habits.",
    },
  },
  {
    id: "statistics",
    label: "Statistics",
    href: "/dashboard/statistics",
    icon: FaChartLine,
    skeletonVariant: "statistics",
    chrome: {
      title: "Statistics",
      eyebrow: "Spending patterns",
      description: "Forecasts, category views, and weekly budget movement.",
    },
  },
  {
    id: "goals",
    label: "Goals",
    href: "/dashboard/goals",
    icon: FaBullseye,
    skeletonVariant: "goals",
    chrome: {
      title: "Goals",
      eyebrow: "Saving progress",
      description: "Keep your active goal visible before the week gets noisy.",
    },
  },
  {
    id: "admin",
    label: "Admin",
    href: "/dashboard/admin",
    icon: FaRobot,
    skeletonVariant: "admin",
    adminOnly: true,
    chrome: {
      title: "SuperAdmin Dashboard",
      eyebrow: "Admin tools",
      description: "Monitor feedback, logs, and deployments for Buck.",
    },
  },
  {
    id: "settings",
    label: "Settings",
    href: "/dashboard/settings",
    icon: FaCog,
    skeletonVariant: "settings",
    chrome: {
      title: "Keep your Buck profile tidy.",
      eyebrow: "Account settings",
      description:
        "Manage your display name, profile picture, email, and account security from one protected place.",
    },
  },
];

export function findDashboardRoute(pathname: string | null): DashboardRoute {
  if (pathname) {
    const match = DASHBOARD_ROUTES.find((route) => pathname.startsWith(route.href));
    if (match) {
      return match;
    }
  }

  return DASHBOARD_ROUTES[0];
}

export function getDashboardSkeletonVariant(pathname: string | null): DashboardSkeletonVariant {
  return findDashboardRoute(pathname).skeletonVariant;
}

export function getDashboardPageChrome(pathname: string | null): DashboardPageChrome {
  return findDashboardRoute(pathname).chrome;
}

export function getDashboardDisplayName(
  userCache: { profile?: { username?: string | null } },
  user: { displayName?: string | null; email?: string | null } | null | undefined
) {
  return (
    userCache.profile?.username ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Buck user"
  );
}
