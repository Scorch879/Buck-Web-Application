"use client";
import React from "react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { signOutUser } from "./authentication";
import { useRouter } from "next/navigation";
import "./dashboard.css"

export default function DashboardHeader({ initialActiveNav = "home" }: { initialActiveNav?: string } = {}) {
    const [activeNav, setActiveNav] = useState(initialActiveNav);
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
                <h1 className="dashboard-title">Buck</h1>
            </div>

            {/* Centered nav and right-aligned sign out */}
            <div style={{ display: 'flex', alignItems: 'center', flex: 1 }}>
                <div className="dashboard-nav" style={{ justifyContent: 'center', width: '100%' }}>
                    <button
                        className={`nav-button ${activeNav === "home" ? "active" : ""}`}
                        onClick={() => {
                            setActiveNav("home");
                            router.push("/dashboard");
                        }}
                    >
                        Home
                    </button>
                    <button
                        className={`nav-button ${activeNav === "statistics" ? "active" : ""}`}
                        onClick={() => {
                            setActiveNav("statistics");
                            router.push("/statistics");
                        }}
                    >
                        Statistics
                    </button>
                    <button
                        className={`nav-button ${activeNav === "goals" ? "active" : ""}`}
                        onClick={() => {
                            setActiveNav("goals");
                            router.push("/goals");
                        }}
                    >
                        Goals
                    </button>
                </div>
                <div style={{ marginLeft: 'auto' }}>
                    <button
                        className="nav-button"
                        onClick={handleSignOut}
                    >
                        Sign Out
                    </button>
                </div>
            </div>
        </div>

    )

}