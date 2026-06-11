"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  FaBars,
  FaBullseye,
  FaChartLine,
  FaCog,
  FaHome,
  FaReceipt,
  FaRobot,
  FaSignOutAlt,
  FaTimes,
  FaWallet,
} from "react-icons/fa";
import WalletModal from "@/app/dashboard/wallet/WalletModal";
import { useOptionalDashboardUser } from "@/context/DashboardUserContext";
import { useFinancial } from "@/context/FinancialContext";
import { signOutUser } from "./authentication";
import "./dashboard.css";

const dashboardNavItems = [
  { id: "home", label: "Home", href: "/dashboard/home", icon: FaHome },
  {
    id: "expenses",
    label: "Expenses",
    href: "/dashboard/expenses",
    icon: FaReceipt,
  },
  { id: "wallet", label: "Wallet", action: "wallet", icon: FaWallet },
  {
    id: "advisor",
    label: "Financial Advisor",
    href: "/dashboard/financial-advisor",
    icon: FaRobot,
  },
  {
    id: "statistics",
    label: "Statistics",
    href: "/dashboard/statistics",
    icon: FaChartLine,
  },
  { id: "goals", label: "Goals", href: "/dashboard/goals", icon: FaBullseye },
  { id: "settings", label: "Settings", href: "/dashboard/settings", icon: FaCog },
] as const;

type DashboardNavId = (typeof dashboardNavItems)[number]["id"];
type DashboardNavItem = (typeof dashboardNavItems)[number];

type DashboardHeaderProps = {
  initialActiveNav?: DashboardNavId;
};

export default function DashboardHeader({
  initialActiveNav = "home",
}: DashboardHeaderProps) {
  const [activeNav, setActiveNav] = useState<DashboardNavId>(initialActiveNav);
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const user = useOptionalDashboardUser();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const userCache = dashboardCache.userId === user?.uid ? dashboardCache : {};
  const displayName =
    userCache.profile?.username ||
    user?.displayName ||
    user?.email?.split("@")[0] ||
    "Buck user";

  const currentNav =
    dashboardNavItems.find(
      (item) => "href" in item && pathname?.startsWith(item.href)
    )?.id ??
    initialActiveNav;

  useEffect(() => {
    setActiveNav(currentNav);
  }, [currentNav]);

  useEffect(() => {
    dashboardNavItems.forEach((item) => {
      if ("href" in item) {
        router.prefetch(item.href);
      }
    });
  }, [router]);

  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    void audio.play();
  };

  const navigateTo = (item: DashboardNavItem) => {
    setActiveNav(item.id);
    setMenuOpen(false);

    if ("action" in item && item.action === "wallet") {
      setWalletOpen(true);
      return;
    }

    if (!("href" in item)) {
      return;
    }

    if (pathname?.startsWith(item.href)) {
      return;
    }

    router.push(item.href);
  };

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    const result = await signOutUser();

    if (result.success) {
      setDashboardCache({});
      router.replace("/");
      router.refresh();
      return;
    }

    setIsSigningOut(false);
    alert(result.message || "Sign out failed.");
  };

  const renderNavItems = () =>
    dashboardNavItems.map((item) => {
      const Icon = item.icon;

      return (
        <button
          key={item.id}
          className={`nav-button ${activeNav === item.id ? "active" : ""}`}
          type="button"
          onClick={() => navigateTo(item)}
          onFocus={() => {
            if ("href" in item) {
              router.prefetch(item.href);
            }
          }}
          onMouseEnter={() => {
            if ("href" in item) {
              router.prefetch(item.href);
            }
          }}
        >
          <Icon aria-hidden="true" />
          {item.label}
        </button>
      );
    });

  return (
    <header className="dashboard-header">
      <div className="dashboard-header-inner">
        <button
          className="dashboard-brand"
          type="button"
          onClick={() => navigateTo(dashboardNavItems[0])}
          aria-label="Go to dashboard home"
        >
          <span className="dashboard-mascot">
            <Image
              src="/BuckMascot.png"
              alt=""
              width={50}
              height={70}
              className="dashboard-mascot-img"
              priority
              onClick={(event) => {
                event.stopPropagation();
                playQuack();
              }}
            />
          </span>
          <span className="dashboard-brand-copy">
            <span className="dashboard-title">Buck</span>
            <span className="dashboard-tagline">Go Buck yourself</span>
            {user ? (
              <span className="dashboard-user-greeting">
                Welcome back, <strong>{displayName}</strong>
              </span>
            ) : null}
          </span>
        </button>

        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          {renderNavItems()}
        </nav>

        <div className="dashboard-header-actions">
          <button
            className="nav-button dashboard-signout-button"
            type="button"
            onClick={handleSignOut}
            disabled={isSigningOut}
            aria-busy={isSigningOut}
          >
            {isSigningOut ? (
              <span className="dashboard-button-spinner" aria-hidden="true" />
            ) : (
              <FaSignOutAlt aria-hidden="true" />
            )}
            <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
          </button>
        </div>

        <button
          className="burger-menu"
          type="button"
          aria-label={menuOpen ? "Close dashboard menu" : "Open dashboard menu"}
          aria-expanded={menuOpen}
          aria-controls="dashboard-mobile-menu"
          onClick={() => setMenuOpen((isOpen) => !isOpen)}
        >
          {menuOpen ? <FaTimes /> : <FaBars />}
        </button>
      </div>

      {menuOpen && (
        <nav
          id="dashboard-mobile-menu"
          className="mobile-dropdown"
          aria-label="Mobile dashboard navigation"
        >
          {renderNavItems()}
          <button
            className="nav-button dashboard-signout-button"
            type="button"
            disabled={isSigningOut}
            aria-busy={isSigningOut}
            onClick={() => {
              setMenuOpen(false);
              void handleSignOut();
            }}
          >
            {isSigningOut ? (
              <span className="dashboard-button-spinner" aria-hidden="true" />
            ) : (
              <FaSignOutAlt aria-hidden="true" />
            )}
            <span>{isSigningOut ? "Signing out..." : "Sign Out"}</span>
          </button>
        </nav>
      )}

      <WalletModal
        open={walletOpen}
        onClose={() => {
          setWalletOpen(false);
          setActiveNav(currentNav);
        }}
      />
    </header>
  );
}
