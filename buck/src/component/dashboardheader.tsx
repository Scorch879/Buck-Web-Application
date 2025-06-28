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
      {/* Centered nav and right-aligned sign out */}
      <div
        style={{
          position: "relative",
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          className="dashboard-header-left"
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            height: "100%",
          }}
        >
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
          <h1 className="dashboard-title">Buck</h1>
        </div>
        <div
          className="dashboard-nav"
          style={{ justifyContent: "center", margin: "0 auto" }}
        >
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
            className={`nav-button ${
              activeNav === "statistics" ? "active" : ""
            }`}
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
        <div
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            height: "100%",
            gap: 8,
          }}
        >
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
        <WalletModal open={walletOpen} onClose={() => setWalletOpen(false)} />
      </div>
    </div>
  );
}
