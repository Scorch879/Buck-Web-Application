"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { FaArrowRight, FaBars, FaTimes } from "react-icons/fa";
import {
  landingFeatures,
  landingHighlights,
  landingNavItems,
  landingPrinciples,
  landingStats,
  landingSteps,
  savingsIcon as SavingsIcon,
} from "@/constants/landing";
import { usePointerGradient } from "@/hooks/usePointerGradient";
import { useRedirectIfAuthenticated } from "@/utils/useAuthGuard";

const heroWords = ["Buck", "Budget", "Tracker"];

const wordVariants: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

const heroWordContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

export default function Home() {
  useRedirectIfAuthenticated();

  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const cta = usePointerGradient<HTMLButtonElement>();

  useEffect(() => {
    router.prefetch("/sign-in");
  }, [router]);

  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    void audio.play();
  };

  const scrollToSection = (targetId: string) => {
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const goToSignIn = () => {
    setMenuOpen(false);
    router.push("/sign-in");
  };

  const ctaStyle: CSSProperties = {
    background: cta.pointer
      ? `radial-gradient(circle at ${cta.pointer.x}px ${cta.pointer.y}px, #ffc547 0%, #f47536 42%, #ff3838 100%)`
      : "linear-gradient(135deg, #f47536 0%, #ff3838 100%)",
  };

  return (
    <div className="landing-page">
      <header className="site-header">
        <div className="site-header-inner">
          <button
            className="brand-mark"
            type="button"
            onClick={() => scrollToSection("home")}
            aria-label="Go to Buck home"
          >
            <span className="brand-mascot">
              <Image
                src="/BuckMascot.svg"
                alt=""
                width={58}
                height={70}
                className="brand-mascot-image"
                onClick={(event) => {
                  event.stopPropagation();
                  playQuack();
                }}
                priority
              />
            </span>
            <span className="brand-copy">
              <span className="brand-title">Buck</span>
              <span className="brand-subtitle">Budget Tracker</span>
            </span>
          </button>

          <nav className="desktop-nav" aria-label="Primary navigation">
            {landingNavItems.map((item) => (
              <button
                key={item.targetId}
                className="nav-link-button"
                type="button"
                onClick={() => scrollToSection(item.targetId)}
              >
                {item.label}
              </button>
            ))}
            <button className="nav-cta" type="button" onClick={goToSignIn}>
              Sign In
            </button>
          </nav>

          <button
            className="mobile-menu-btn"
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="mobile-menu"
            onClick={() => setMenuOpen((isOpen) => !isOpen)}
          >
            {menuOpen ? <FaTimes /> : <FaBars />}
          </button>
        </div>

        {menuOpen && (
          <nav
            id="mobile-menu"
            className="mobile-menu-dropdown"
            aria-label="Mobile navigation"
          >
            {landingNavItems.map((item) => (
              <button
                key={item.targetId}
                className="nav-link-button"
                type="button"
                onClick={() => scrollToSection(item.targetId)}
              >
                {item.label}
              </button>
            ))}
            <button className="nav-cta" type="button" onClick={goToSignIn}>
              Sign In / Sign Up
            </button>
          </nav>
        )}
      </header>

      <main>
        <section className="hero-section" id="home">
          <div className="hero-content">
            <div className="hero-copy">
              <p className="eyebrow">Personal budgeting, minus the mess</p>
              <motion.h1
                className="hero-title"
                variants={heroWordContainer}
                initial="hidden"
                animate="visible"
              >
                {heroWords.map((word) => (
                  <motion.span key={word} variants={wordVariants}>
                    {word}
                  </motion.span>
                ))}
              </motion.h1>
              <p className="hero-description">
                Buck helps you track expenses, protect your weekly budget, and
                move toward savings goals with friendly AI guidance.
              </p>
              <div className="hero-actions">
                <motion.button
                  ref={cta.ref}
                  className="primary-cta"
                  type="button"
                  style={ctaStyle}
                  onMouseMove={cta.handlePointerMove}
                  onMouseLeave={cta.handlePointerLeave}
                  onClick={goToSignIn}
                  whileHover={{ scale: 1.02 }}
                >
                  Get Started
                  <FaArrowRight aria-hidden="true" />
                </motion.button>
                <button
                  className="secondary-cta"
                  type="button"
                  onClick={() => scrollToSection("features")}
                >
                  Explore Features
                </button>
              </div>
              <div className="hero-stats" aria-label="Buck highlights">
                {landingStats.map((stat) => (
                  <div className="hero-stat" key={stat.label}>
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-visual" aria-label="Buck app preview">
              <div className="mascot-stage">
                <Image
                  src="/BuckMascot.png"
                  alt="Buck mascot"
                  width={260}
                  height={320}
                  priority
                  className="hero-mascot"
                  onClick={playQuack}
                />
              </div>
              <div className="preview-panel">
                <div className="preview-header">
                  <SavingsIcon aria-hidden="true" />
                  <span>This week</span>
                </div>
                <div className="preview-total">PHP 4,280</div>
                <div className="preview-bars" aria-hidden="true">
                  {[54, 72, 38, 82, 46, 64, 30].map((height, index) => (
                    <span key={index} style={{ height: `${height}%` }} />
                  ))}
                </div>
                <div className="preview-note">
                  On pace to save 18% more than last week.
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="feature-section" id="features">
          <div className="section-heading">
            <p className="eyebrow">What Buck keeps tidy</p>
            <h2>Everything important has a clear place.</h2>
          </div>
          <div className="feature-grid">
            {landingFeatures.map((feature) => {
              const FeatureIcon = feature.icon;

              return (
                <article className="feature-card" key={feature.title}>
                  <div className="feature-icon">
                    <FeatureIcon aria-hidden="true" />
                  </div>
                  <Image
                    src={feature.image}
                    alt=""
                    width={130}
                    height={150}
                    className="feature-image"
                  />
                  <h3>{feature.title}</h3>
                  <p>{feature.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="about-section" id="about">
          <div className="about-copy">
            <p className="eyebrow">About Buck</p>
            <h2>Budgeting should feel calm, visible, and doable.</h2>
            <p>
              Buck was built around a simple idea: when your expenses, goals,
              and forecasts live in one readable place, money decisions get less
              stressful. The app gives you a weekly view, goal progress, wallet
              tracking, and AI suggestions so you can spend with intention.
            </p>
            <div className="principle-grid">
              {landingPrinciples.map((principle) => (
                <article className="principle-card" key={principle.title}>
                  <h3>{principle.title}</h3>
                  <p>{principle.description}</p>
                </article>
              ))}
            </div>
          </div>

          <div className="workflow-panel">
            <h3>How it flows</h3>
            <ol>
              {landingSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
            <div className="highlight-list">
              {landingHighlights.map((highlight) => (
                <div className="highlight-item" key={highlight.title}>
                  <strong>{highlight.title}</strong>
                  <span>{highlight.description}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div>
          <strong>Buck Budget Tracker</strong>
          <span>Spend smarter. Save steadier.</span>
        </div>
        <div className="footer-links">
          <button type="button" onClick={() => scrollToSection("home")}>
            Home
          </button>
          <button type="button" onClick={() => scrollToSection("features")}>
            Features
          </button>
          <a href="mailto:BuckTheBudgetTracker@gmail.com">
            BuckTheBudgetTracker@gmail.com
          </a>
        </div>
        <p>&copy; 2026 Buck. All rights reserved.</p>
      </footer>
    </div>
  );
}
