"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { motion } from "framer-motion";
import "./globals.css";
import { useRedirectIfAuthenticated } from "@/utils/useAuthGuard";
import React from "react";

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

  return (
    <>
      <div className="landing-page">
        <div className="lp-header">
          <div className="lp-header-container">
            <div className="header-btns">
              <button className="header-button" onClick={() => document.getElementById('Home')?.scrollIntoView({ behavior: 'smooth' })}>
                Home
              </button>
              <button className="header-button" onClick={() => document.getElementById('About')?.scrollIntoView({ behavior: 'smooth' })}>
                About Us
              </button>
              <button className="header-button" onClick={() => router.push("/sign-in")}>
                Sign In/Sign Up
              </button>
            </div>
            <div className="header-leftside">
              <h1>Buck The Budget Tracker</h1>
              <div className="header-img">
                <Image
                  src="/BuckMascot.png"
                  alt="Buck Logo"
                  width={60}
                  height={75}
                  className="buckLogo"
                  onClick={playQuack}
                />
              </div>
            </div>
          </div>
        </div>
        <div className="section1" id="Home">
          <div className="welcomeSign">
            <div className="buckmsg">
              <p id="name">Buck</p>
              <div className="smoothLine"></div>
              <p id="desc">The Budget Tracker</p>
            </div>
            <div className="buckmascot">
              <Image
                src="/BuckMascot.png"
                alt="Buck Logo"
                fill
                className="buckmascotImg"
                priority
                style={{ objectFit: "contain" }}
              ></Image>
            </div>
          </div>
          <div
            className="welcomeMsg"
            onMouseMove={handleMouseMove}
            ref={welcomeMsgRef}
          >
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
        </div>
        <div className="section2" id="About">
          <div className="s2-container">
            <div className="about-us">
              <h1>About Us</h1>
              <h3>{aboutustext}</h3>
              it does this by
            </div>
            <div className="card-container">
              <div className="s2-cards">
                <div style={{ position: "relative", width: "100%", aspectRatio: "2/3", maxWidth: 120 }}>
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
                    Stay motivated by setting and achieving your
                    financial goals. Whether it’s saving for a vacation, paying off debt, or building an emergency fund,
                    Buck helps you create specific, trackable goals and monitor your progress every step of the way.
                  </h3>
                </div>
              </div>
              <div className="s2-cards">
                <div style={{ position: "relative", width: "100%", aspectRatio: "2/3", maxWidth: 120 }}>
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
                    Take control of your money by keeping an eye on where it goes. Easily log and categorize your daily
                    expenses to see exactly how much you’re spending and on what. Buck makes it simple to stick to your
                    budget and cut unnecessary costs.
                  </h3>
                </div>
              </div>
              <div className="s2-cards">
                <div style={{ position: "relative", width: "100%", aspectRatio: "2/3", maxWidth: 120 }}>
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
                    Plan ahead with confidence. Buck analyzes your spending patterns and projects your future cash flow,
                    helping you anticipate upcoming expenses and identify potential savings opportunities. Make smarter decisions
                    today for a better tomorrow.
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
              <p>© 2025 Buck: The budget Tracker. All rights reserved</p>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
