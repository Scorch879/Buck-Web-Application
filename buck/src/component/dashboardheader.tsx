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
  FaMoon,
  FaSignOutAlt,
  FaSun,
  FaTimes,
  FaWallet,
} from "react-icons/fa";
import WalletModal from "@/app/dashboard/wallet/WalletModal";
import { useFinancial } from "@/context/FinancialContext";
import { applyDocumentTheme, useAuthPageTheme } from "@/hooks/useAuthPageTheme";
import { signOutUser } from "./authentication";
import "./dashboard.css";

const dashboardNavItems = [
  { id: "home", label: "Home", href: "/dashboard/home", icon: FaHome },
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
  const documentThemeIsDark = useAuthPageTheme();
  const [isDarkTheme, setIsDarkTheme] = useState(documentThemeIsDark);
  const router = useRouter();
  const pathname = usePathname();
  const { setDashboardCache } = useFinancial();

  const currentNav =
    dashboardNavItems.find((item) => pathname?.startsWith(item.href))?.id ??
    initialActiveNav;

  useEffect(() => {
    setActiveNav(currentNav);
  }, [currentNav]);

  useEffect(() => {
    setIsDarkTheme(documentThemeIsDark);
  }, [documentThemeIsDark]);

  useEffect(() => {
    dashboardNavItems.forEach((item) => {
      router.prefetch(item.href);
    });
  }, [router]);

  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    void audio.play();
  };

  const navigateTo = (item: (typeof dashboardNavItems)[number]) => {
    setActiveNav(item.id);
    setMenuOpen(false);

    if (pathname?.startsWith(item.href)) {
      return;
    }

    router.push(item.href);
  };

  const openWallet = () => {
    setWalletOpen(true);
    setMenuOpen(false);
  };

  const toggleTheme = () => {
    setIsDarkTheme((currentThemeIsDark) => {
      const nextTheme = currentThemeIsDark ? "light" : "dark";

      try {
        window.localStorage.setItem("buck-landing-theme", nextTheme);
      } catch {
        // Theme preference is cosmetic, so private storage failures can be ignored.
      }

      applyDocumentTheme(nextTheme);
      return !currentThemeIsDark;
    });
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
          onFocus={() => router.prefetch(item.href)}
          onMouseEnter={() => router.prefetch(item.href)}
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
          <span className="dashboard-title">Buck</span>
        </button>

        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          {renderNavItems()}
        </nav>

        <div className="dashboard-header-actions">
          <button
            className="nav-button dashboard-theme-toggle"
            type="button"
            onClick={toggleTheme}
            aria-label={`Switch to ${isDarkTheme ? "light" : "dark"} mode`}
          >
            {isDarkTheme ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
            {isDarkTheme ? "Light" : "Dark"}
          </button>
          <button className="nav-button" type="button" onClick={openWallet}>
            <FaWallet aria-hidden="true" />
            Wallet
          </button>
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
            {isSigningOut ? "Signing out..." : "Sign Out"}
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
            className="nav-button dashboard-theme-toggle"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              toggleTheme();
            }}
          >
            {isDarkTheme ? <FaSun aria-hidden="true" /> : <FaMoon aria-hidden="true" />}
            {isDarkTheme ? "Light mode" : "Dark mode"}
          </button>
          <button className="nav-button" type="button" onClick={openWallet}>
            <FaWallet aria-hidden="true" />
            Wallet
          </button>
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
            {isSigningOut ? "Signing out..." : "Sign Out"}
          </button>
        </nav>
      )}

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </header>
  );
}
