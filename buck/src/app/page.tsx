"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import "./globals.css";
import { useRedirectIfAuthenticated } from "@/utils/useAuthGuard";
import React from "react";
import { FaBars, FaTimes } from "react-icons/fa";

export default function Home() {
  useRedirectIfAuthenticated(); // Redirects if user is signed in
  const router = useRouter();
  const welcomeMsgRef = useRef<HTMLDivElement>(null);
  const [trailDots, setTrailDots] = useState<
    Array<{ id: number; x: number; y: number }>
  >([]);
  const nextDotId = useRef(0);
  const [btnMouse, setBtnMouse] = useState<{ x: number; y: number } | null>(
    null
  );
  const btnRef = React.useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    audio.play();
  };
  const text =
    "Need help in saving your money? Guess what, go BUCK yourself! Buck can help you manage your weekly spending with a press of a button!";
  const words = text.split(" ");

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: {
        staggerChildren: 0.05, // Stagger animation for each word
      },
    },
  };
  const aboutustext = "With Buck, we help you take control of your money with simple tools to track expenses, set goals, and plan ahead. Our mission is to make budgeting easy and empowering, so you can spend smarter, save more, and reach your financial goals with confidence. With Buck, we believe that everyone deserves to feel confident and in control of their finances. Our mission is simple: to help you make the most of your money by giving you clear, easy-to-use tools to track your expenses, set meaningful financial goals, and plan for the future.";
  const wordVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 },
    hover: { scale: 1.1, y: -5, transition: { duration: 0.2 } }, // Added hover effect
  };

  //Prefetching for optimization
  useEffect(() => {
    router.prefetch("/sign-in");
  }, [router]);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (welcomeMsgRef.current) {
      const rect = welcomeMsgRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      const newDot = {
        id: nextDotId.current++,
        x,
        y,
      };

      setTrailDots((prevDots) => {
        const updatedDots = [...prevDots, newDot];
        if (updatedDots.length > 50) {
          // Limit number of dots to prevent performance issues
          updatedDots.shift();
        }
        return updatedDots;
      });

      // Remove dot after a short delay to create fading effect
      setTimeout(() => {
        setTrailDots((prevDots) =>
          prevDots.filter((dot) => dot.id !== newDot.id)
        );
      }, 500); // Dot visible for 500ms
    }
  };

  // Close menu on navigation or click outside
  useEffect(() => {
    if (!menuOpen) return;
    const handleClick = (e: MouseEvent) => {
      const menu = document.getElementById("mobile-menu-dropdown");
      const btn = document.getElementById("mobile-menu-btn");
      if (
        menu &&
        !menu.contains(e.target as Node) &&
        btn &&
        !btn.contains(e.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <>
      <div className="landing-page">
        <div className="lp-header">
          <div className="lp-header-container">
            <div className="header-leftside">
              <div className="header-img">
                <Image
                  src="/BuckMascot.svg"
                  alt="Buck Logo"
                  width={60}
                  height={75}
                  className="buckLogo"
                  onClick={playQuack}
                />
              </div>
              <h1 onClick={() => document.getElementById('Home')?.scrollIntoView({ behavior: 'smooth' })}>Buck</h1>
            </div>
            {/* Desktop header buttons */}
            <div className="header-btns">
              <button className="header-button" onClick={() => document.getElementById('Home')?.scrollIntoView({ behavior: 'smooth' })}>
                Home
              </button>
              <button className="header-button" onClick={() => document.getElementById('About')?.scrollIntoView({ behavior: 'smooth' })}>
                About Us
              </button>
              <button className="header-button" onClick={() => router.push("/sign-in")}>Sign In/Sign Up</button>
            </div>
            {/* Mobile menu button */}
            <button
              id="mobile-menu-btn"
              className="mobile-menu-btn"
              aria-label={menuOpen ? "Close menu" : "Open menu"}
              aria-expanded={menuOpen}
              aria-controls="mobile-menu-dropdown"
              onClick={() => setMenuOpen((v) => !v)}
            >
              {menuOpen ? <FaTimes size={28} /> : <FaBars size={28} />}
            </button>
          </div>
          {/* Mobile dropdown menu */}
          {menuOpen && (
            <div
              id="mobile-menu-dropdown"
              className="mobile-menu-dropdown"
              role="menu"
              aria-label="Main navigation"
            >
              <button
                className="header-button"
                onClick={() => {
                  setMenuOpen(false);
                  document.getElementById('Home')?.scrollIntoView({ behavior: 'smooth' });
                }}
                role="menuitem"
              >
                Home
              </button>
              <button
                className="header-button"
                onClick={() => {
                  setMenuOpen(false);
                  document.getElementById('About')?.scrollIntoView({ behavior: 'smooth' });
                }}
                role="menuitem"
              >
                About Us
              </button>
              <button
                className="header-button"
                onClick={() => {
                  setMenuOpen(false);
                  router.push("/sign-in");
                }}
                role="menuitem"
              >
                Sign In/Sign Up
              </button>
            </div>
          )}
        </div>
        <div
          className="section1"
          id="Home"
          onMouseMove={handleMouseMove}
          ref={welcomeMsgRef}
        >
          <div className="section1-msg">
            <motion.p
              variants={containerVariants}
              initial="hidden"
              animate="visible"
              style={{
                display: "flex",
                flexWrap: "wrap",
                justifyContent: "center",
              }}
            >
              {words.map((word, index) => (
                <motion.span
                  key={index}
                  variants={wordVariants}
                  style={{ marginRight: "0.25em" }}
                >
                  {word}
                </motion.span>
              ))}
            </motion.p>
            {trailDots.map((dot) => (
              <div
                key={dot.id}
                className="mouse-trail-dot"
                style={{
                  left: `${dot.x}px`,
                  top: `${dot.y}px`,
                }}
              />
            ))}
          </div>
          <motion.button
            ref={btnRef}
            onClick={() => router.push("/sign-in")}
            type="submit"
            className="getstarted-btn"
            onMouseMove={(e) => {
              const rect = btnRef.current?.getBoundingClientRect();
              if (rect) {
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                setBtnMouse({ x, y });
              }
            }}
            onMouseLeave={() => setBtnMouse(null)}
            style={{
              background: btnMouse
                ? `radial-gradient(circle at ${btnMouse.x}px ${btnMouse.y}px, #fd523b 0%, #ef8a57 100%)`
                : "linear-gradient(90deg, #ef8a57 60%, #fd523b 100%)",
              transition: btnMouse ? "background 0.1s" : "background 0.3s",
            }}
            whileHover={{
              scale: 1.03,
            }}
          >
            Get Started
          </motion.button>
        </div>
        <div className="section2" id="About">
          <div className="s2-container">
            <div className="about-us">
              <h1>About Us</h1>
              <h3>{aboutustext}</h3>
            </div>
            <div className="card-container">
              <div className="s2-cards">
                <div className="card-svg-container" style={{ position: "relative", width: "100%", aspectRatio: "2/3", maxWidth: 120 }}>
                  <Image
                    src="/goaltracking.svg"
                    alt="goal tracking"
                    fill
                    style={{ objectFit: "contain" }}
                    sizes="(max-width: 600px) 100vw, 120px"
                    priority
                  />
                </div>
                <h1> Goal Tracking</h1>
                <div className="cardtext-container">
                  <h3>
                    Set clear financial goals and watch your progress in real time. Buck keeps you
                    motivated and on track toward what matters most.
                  </h3>
                </div>
              </div>
              <div className="s2-cards">
                <div className="card-svg-container" style={{ position: "relative", width: "100%", aspectRatio: "2/3", maxWidth: 120 }}>
                  <Image
                    src="/expensetracking.svg"
                    alt="expense tracking"
                    fill
                    style={{ objectFit: "contain" }}
                    sizes="(max-width: 600px) 100vw, 120px"
                    priority
                  />
                </div>
                <h1>Expense Tracking</h1>
                <div className="cardtext-container">
                  <h3>
                    Easily log and categorize your expenses to see where your money goes. Stay on
                    budget and cut unnecessary costs effortlessly.
                  </h3>
                </div>
              </div>
              <div className="s2-cards">
                <div className="card-svg-container" style={{ position: "relative", width: "100%", aspectRatio: "2/3", maxWidth: 120 }}>
                  <Image
                    src="/forecasting.svg"
                    alt="forecasting"
                    fill
                    style={{ objectFit: "contain" }}
                    sizes="(max-width: 600px) 100vw, 120px"
                    priority
                  />
                </div>
                <h1> Forecasting</h1>
                <div className="cardtext-container">
                  <h3>
                    Plan ahead with smart projections based on your spending
                    habits. See what's coming so you can make better financial decisions today.
                  </h3>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="footer">
          <div className="footersection">
            <div className="quicklinks">
              <h2>Quick Links</h2>
              <button className="footer-btn" onClick={() => document.getElementById('Home')?.scrollIntoView({ behavior: 'smooth' })}>
                Home
              </button>
              <button className="footer-btn" onClick={() => document.getElementById('About')?.scrollIntoView({ behavior: 'smooth' })}>
                About
              </button>
            </div>
            <div className="contact-us">
              <h2>Contact Us</h2>
              <p>BuckTheBudgetTracker@gmail.com</p>
            </div>
          </div>
          <div className="copyright-section">
            <div className="copyright-line"></div>
            <div className="copyright">
              <p>© 2025 Buck. All rights reserved</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
