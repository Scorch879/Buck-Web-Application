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
            <div className="header-img">
              <Image
                src="/BuckMascot.png"
                alt="Buck Logo"
                width={60}
                height={75}
                className="buckLogo"
              />
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
        </div>
        <div className="section3">
        </div>
      </div>
    </>
  );
}
