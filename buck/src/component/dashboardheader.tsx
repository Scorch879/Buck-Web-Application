"use client";

import { useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { FaBars, FaTimes, FaWallet } from "react-icons/fa";
import WalletModal from "@/app/dashboard/wallet/WalletModal";
import { signOutUser } from "./authentication";
import "./dashboard.css";

const dashboardNavItems = [
  { id: "home", label: "Home", href: "/dashboard/home" },
  { id: "statistics", label: "Statistics", href: "/dashboard/statistics" },
  { id: "goals", label: "Goals", href: "/dashboard/goals" },
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
  const router = useRouter();

  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    void audio.play();
  };

  const navigateTo = (item: (typeof dashboardNavItems)[number]) => {
    setActiveNav(item.id);
    setMenuOpen(false);
    router.push(item.href);
  };

  const openWallet = () => {
    setWalletOpen(true);
    setMenuOpen(false);
  };

  const handleSignOut = async () => {
    const result = await signOutUser();

    if (result.success) {
      router.push("/");
      return;
    }

    alert(result.message || "Sign out failed.");
  };

  const renderNavItems = () =>
    dashboardNavItems.map((item) => (
      <button
        key={item.id}
        className={`nav-button ${activeNav === item.id ? "active" : ""}`}
        type="button"
        onClick={() => navigateTo(item)}
      >
        {item.label}
      </button>
    ));

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
          <button className="nav-button" type="button" onClick={openWallet}>
            <FaWallet aria-hidden="true" />
            Wallet
          </button>
          <button className="nav-button" type="button" onClick={handleSignOut}>
            Sign Out
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
          <button className="nav-button" type="button" onClick={openWallet}>
            <FaWallet aria-hidden="true" />
            Wallet
          </button>
          <button
            className="nav-button"
            type="button"
            onClick={() => {
              setMenuOpen(false);
              void handleSignOut();
            }}
          >
            Sign Out
          </button>
        </nav>
      )}

      <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
    </header>
  );
}
