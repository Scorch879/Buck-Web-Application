"use client";
import React from "react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { signOutUser } from "./authentication";
import { useRouter } from "next/navigation";
import "./dashboard.css";
import WalletModal from "@/app/dashboard/wallet/WalletModal";

export default function DashboardHeader({
  initialActiveNav = "home",
}: { initialActiveNav?: string } = {}) {
  const [activeNav, setActiveNav] = useState(initialActiveNav);
  const [walletOpen, setWalletOpen] = useState(false);
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 600);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    audio.play();
  };
  const handleSignOut = async () => {
    const result = await signOutUser();
    if (result.success) {
      router.push("/"); // Redirect to sign-in page
    } else {
      alert(result.message || "Sign out failed.");
    }
  };
  const handleNavClick = (navItem: string) => {
    setActiveNav(navItem);
    // Add your navigation logic here
    console.log(`Navigating to: ${navItem}`);
  };
  return (
    <div className="dashboard-header">
      <div className="dashboard-header-inner">
        <>
          {!isMobile && (
            <div className="dashboard-header-left">
              <div className="dashboard-mascot">
                <Image
                  src="/BuckMascot.png"
                  alt="Buck Mascot"
                  width={50}
                  height={70}
                  className="dashboard-mascot-img"
                  priority
                  onClick={playQuack}
                />
              </div>
              <h1 className="dashboard-title" onClick={() => {
                setActiveNav("home");
                router.push("/dashboard/home");
              }}>Buck</h1>
            </div>
          )}
          <div className="dashboard-header-row-mobile">
            <div className="dashboard-header-left">
              <div className="dashboard-mascot">
                <Image
                  src="/BuckMascot.png"
                  alt="Buck Mascot"
                  width={50}
                  height={70}
                  className="dashboard-mascot-img"
                  priority
                  onClick={playQuack}
                />
              </div>
              <h1 className="dashboard-title" onClick={() => {
                setActiveNav("home");
                router.push("/dashboard/home");
              }}>Buck</h1>
            </div>
            {isMobile && (
              <button className="burger-menu" onClick={() => setMenuOpen(!menuOpen)}>
                <span className="burger-bar"></span>
                <span className="burger-bar"></span>
                <span className="burger-bar"></span>
              </button>
            )}
          </div>
          {isMobile ? (
            <React.Fragment>
              {menuOpen && (
                <div className="mobile-dropdown">
                  <button
                    className={`nav-button ${activeNav === "home" ? "active" : ""}`}
                    onClick={() => {
                      setActiveNav("home");
                      router.push("/dashboard/home");
                      setMenuOpen(false);
                    }}
                  >
                    Home
                  </button>
                  <button
                    className={`nav-button ${activeNav === "statistics" ? "active" : ""}`}
                    onClick={() => {
                      setActiveNav("statistics");
                      router.push("/dashboard/statistics");
                      setMenuOpen(false);
                    }}
                  >
                    Statistics
                  </button>
                  <button
                    className={`nav-button ${activeNav === "goals" ? "active" : ""}`}
                    onClick={() => {
                      setActiveNav("goals");
                      router.push("/dashboard/goals");
                      setMenuOpen(false);
                    }}
                  >
                    Goals
                  </button>
                  <button
                    className="nav-button"
                    onClick={() => {
                      setWalletOpen(true);
                      setMenuOpen(false);
                    }}
                    title="Wallet"
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    Wallet
                  </button>
                  <button className="nav-button" onClick={() => { handleSignOut(); setMenuOpen(false); }}>
                    Sign Out
                  </button>
                </div>
              )}
            </React.Fragment>
          ) : (
            <>
              <div className="dashboard-nav">
                <button
                  className={`nav-button ${activeNav === "home" ? "active" : ""}`}
                  onClick={() => {
                    setActiveNav("home");
                    router.push("/dashboard/home");
                  }}
                >
                  Home
                </button>
                <button
                  className={`nav-button ${activeNav === "statistics" ? "active" : ""}`}
                  onClick={() => {
                    setActiveNav("statistics");
                    router.push("/dashboard/statistics");
                  }}
                >
                  Statistics
                </button>
                <button
                  className={`nav-button ${activeNav === "goals" ? "active" : ""}`}
                  onClick={() => {
                    setActiveNav("goals");
                    router.push("/dashboard/goals");
                  }}
                >
                  Goals
                </button>
              </div>
              <div className="dashboard-header-right">
                <button
                  className="nav-button"
                  onClick={() => setWalletOpen(true)}
                  title="Wallet"
                  style={{ display: "flex", alignItems: "center", gap: 4 }}
                >
                  Wallet
                </button>
                <button className="nav-button" onClick={handleSignOut}>
                  Sign Out
                </button>
              </div>
            </>
          )}
          <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
        </>
      </div>
    </div>
  );
}
