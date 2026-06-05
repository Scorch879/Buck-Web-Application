"use client";

import type { CSSProperties } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import type { Variants } from "framer-motion";
import { FaArrowRight, FaBars, FaMoon, FaSun, FaTimes } from "react-icons/fa";
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
import {
  applyDocumentTheme,
  resolveLandingTheme,
} from "@/hooks/useAuthPageTheme";

const heroWords = ["Buck", "Budget", "Tracker"];
const adviserRotationDelay = 6800;

const weeklyPreviewSnapshots = [
  {
    label: "This week",
    total: "PHP 4,280",
    note: "On pace to save 18% more than last week.",
    bars: [54, 72, 38, 82, 46, 64, 30],
  },
  {
    label: "Budget left",
    total: "PHP 1,740",
    note: "Food, transit, and bills are still inside your plan.",
    bars: [44, 58, 50, 66, 42, 36, 28],
  },
  {
    label: "Goal boost",
    total: "PHP 620",
    note: "A small transfer keeps your savings goal ahead.",
    bars: [30, 36, 48, 54, 68, 72, 82],
  },
  {
    label: "Forecast",
    total: "PHP 3,910",
    note: "Likely to finish 9% under your weekly budget.",
    bars: [62, 46, 70, 52, 64, 44, 36],
  },
];

const adviserSnapshots = [
  {
    focus: "Food spending",
    headline: "Trim PHP 480 this week",
    advice:
      "Lunch and snack spending climbed after Wednesday. Keep meals near PHP 170 per day and Buck can protect your weekend buffer.",
    primaryMetric: "PHP 170/day",
    primaryLabel: "Suggested food cap",
    secondaryMetric: "PHP 480",
    secondaryLabel: "Possible weekly save",
    confidence: "High confidence",
    progress: 74,
  },
  {
    focus: "Savings goal",
    headline: "Move PHP 300 safely",
    advice:
      "Your bills are covered and daily spending is under pace. Moving PHP 300 today keeps the goal ahead without tightening the week.",
    primaryMetric: "PHP 300",
    primaryLabel: "Safe goal transfer",
    secondaryMetric: "5 days",
    secondaryLabel: "Buffer remaining",
    confidence: "Good timing",
    progress: 62,
  },
  {
    focus: "Weekend forecast",
    headline: "Set aside PHP 850",
    advice:
      "Your weekend pattern usually runs higher. Reserve PHP 850 now and the weekly budget still lands below the limit.",
    primaryMetric: "PHP 850",
    primaryLabel: "Weekend envelope",
    secondaryMetric: "9%",
    secondaryLabel: "Under budget forecast",
    confidence: "Forecast ready",
    progress: 68,
  },
  {
    focus: "Subscriptions",
    headline: "Review PHP 399",
    advice:
      "A recurring charge is coming up before payday. Skip one nonessential renewal and your cash flow stays smoother.",
    primaryMetric: "PHP 399",
    primaryLabel: "Charge to review",
    secondaryMetric: "Low",
    secondaryLabel: "Cash-flow risk",
    confidence: "Heads up",
    progress: 52,
  },
];

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
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [isHeaderStuck, setIsHeaderStuck] = useState(false);
  const [activeSection, setActiveSection] = useState(
    landingNavItems[0]?.targetId ?? "home"
  );
  const [previewIndex, setPreviewIndex] = useState(0);
  const [adviserIndex, setAdviserIndex] = useState(0);
  const previewSnapshot = weeklyPreviewSnapshots[previewIndex];
  const adviserSnapshot = adviserSnapshots[adviserIndex];
  const [typedAdviserAdvice, setTypedAdviserAdvice] = useState(
    adviserSnapshot.advice
  );
  const cta = usePointerGradient<HTMLButtonElement>();

  useEffect(() => {
    router.prefetch("/sign-in");
  }, [router]);

  useEffect(() => {
    const sections = landingNavItems
      .map((item) => document.getElementById(item.targetId))
      .filter((section): section is HTMLElement => section !== null);

    if (sections.length === 0) {
      return;
    }

    let animationFrameId: number | null = null;

    const updateActiveSection = () => {
      const activationLine = Math.min(window.innerHeight * 0.35, 260);
      let currentSection = sections[0].id;

      setIsHeaderStuck(window.scrollY > 18);

      for (const section of sections) {
        const bounds = section.getBoundingClientRect();

        if (bounds.top <= activationLine && bounds.bottom > activationLine) {
          currentSection = section.id;
          break;
        }

        if (bounds.top <= activationLine) {
          currentSection = section.id;
        }
      }

      setActiveSection(currentSection);
      animationFrameId = null;
    };

    const requestActiveSectionUpdate = () => {
      if (animationFrameId === null) {
        animationFrameId = window.requestAnimationFrame(updateActiveSection);
      }
    };

    updateActiveSection();
    window.addEventListener("scroll", requestActiveSectionUpdate, {
      passive: true,
    });
    window.addEventListener("resize", requestActiveSectionUpdate);

    return () => {
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }

      window.removeEventListener("scroll", requestActiveSectionUpdate);
      window.removeEventListener("resize", requestActiveSectionUpdate);
    };
  }, []);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      return;
    }

    const previewIntervalId = window.setInterval(() => {
      setPreviewIndex(
        (currentIndex) => (currentIndex + 1) % weeklyPreviewSnapshots.length
      );
    }, 3600);

    const adviserIntervalId = window.setInterval(() => {
      setAdviserIndex(
        (currentIndex) => (currentIndex + 1) % adviserSnapshots.length
      );
    }, adviserRotationDelay);

    return () => {
      window.clearInterval(previewIntervalId);
      window.clearInterval(adviserIntervalId);
    };
  }, []);

  useEffect(() => {
    const advice = adviserSnapshot.advice;
    const prefersReducedMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)"
    ).matches;

    if (prefersReducedMotion) {
      setTypedAdviserAdvice(advice);
      return;
    }

    let currentCharacter = 0;
    let typingIntervalId: number | null = null;

    setTypedAdviserAdvice("");

    const typingDelayId = window.setTimeout(() => {
      typingIntervalId = window.setInterval(() => {
        currentCharacter += 1;
        setTypedAdviserAdvice(advice.slice(0, currentCharacter));

        if (currentCharacter >= advice.length && typingIntervalId !== null) {
          window.clearInterval(typingIntervalId);
        }
      }, 18);
    }, 160);

    return () => {
      window.clearTimeout(typingDelayId);

      if (typingIntervalId !== null) {
        window.clearInterval(typingIntervalId);
      }
    };
  }, [adviserSnapshot.advice]);

  useEffect(() => {
    const mediaQuery = window.matchMedia?.("(prefers-color-scheme: dark)");

    const syncThemeFromPreference = () => {
      const nextTheme = resolveLandingTheme(mediaQuery);

      applyDocumentTheme(nextTheme);
      setIsDarkTheme(nextTheme === "dark");
    };

    syncThemeFromPreference();
    window.addEventListener("storage", syncThemeFromPreference);
    mediaQuery?.addEventListener("change", syncThemeFromPreference);

    return () => {
      window.removeEventListener("storage", syncThemeFromPreference);
      mediaQuery?.removeEventListener("change", syncThemeFromPreference);
    };
  }, []);

  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    void audio.play();
  };

  const scrollToSection = (targetId: string) => {
    setActiveSection(targetId);
    document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth" });
    setMenuOpen(false);
  };

  const goToSignIn = () => {
    setMenuOpen(false);
    router.push("/sign-in");
  };

  const toggleTheme = () => {
    setIsDarkTheme((currentTheme) => {
      const nextTheme = !currentTheme;

      try {
        window.localStorage.setItem(
          "buck-landing-theme",
          nextTheme ? "dark" : "light"
        );
      } catch {
        // Theme still toggles for the current session if storage is unavailable.
      }

      applyDocumentTheme(nextTheme ? "dark" : "light");

      return nextTheme;
    });
  };

  const themeLabel = isDarkTheme
    ? "Switch to light mode"
    : "Switch to dark mode";

  const ctaGradient = isDarkTheme
    ? {
        base:
          "linear-gradient(135deg, #f47536 0%, #ff8d3d 100%)",
        hover: cta.pointer
          ? `radial-gradient(circle at ${cta.pointer.x}px ${cta.pointer.y}px, rgba(255, 240, 200, 0.92) 0%, rgba(255, 197, 71, 0.72) 20%, rgba(255, 197, 71, 0) 46%), linear-gradient(135deg, #f47536 0%, #ff8d3d 100%)`
          : "",
      }
    : {
        base: "linear-gradient(135deg, #f47536 0%, #ff3838 100%)",
        hover: cta.pointer
          ? `radial-gradient(circle at ${cta.pointer.x}px ${cta.pointer.y}px, rgba(255, 240, 200, 0.88) 0%, rgba(255, 197, 71, 0.68) 20%, rgba(255, 197, 71, 0) 46%), linear-gradient(135deg, #f47536 0%, #ff3838 100%)`
          : "",
      };

  const ctaStyle: CSSProperties = {
    background: cta.pointer ? ctaGradient.hover : ctaGradient.base,
  };

  const getNavButtonClassName = (targetId: string) =>
    `nav-link-button${
      activeSection === targetId ? " nav-link-button--active" : ""
    }`;

  return (
    <div
      className={`landing-page${isDarkTheme ? " landing-page--dark" : ""}`}
    >
      <header
        className={`site-header${isHeaderStuck ? " site-header--stuck" : ""}`}
      >
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
                className={getNavButtonClassName(item.targetId)}
                type="button"
                aria-current={
                  activeSection === item.targetId ? "location" : undefined
                }
                onClick={() => scrollToSection(item.targetId)}
              >
                {item.label}
              </button>
            ))}
            <button
              className="theme-toggle"
              type="button"
              aria-label={themeLabel}
              aria-pressed={isDarkTheme}
              onClick={toggleTheme}
            >
              {isDarkTheme ? (
                <FaSun aria-hidden="true" />
              ) : (
                <FaMoon aria-hidden="true" />
              )}
              <span>{isDarkTheme ? "Light" : "Dark"}</span>
            </button>
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
                className={getNavButtonClassName(item.targetId)}
                type="button"
                aria-current={
                  activeSection === item.targetId ? "location" : undefined
                }
                onClick={() => scrollToSection(item.targetId)}
              >
                {item.label}
              </button>
            ))}
            <button
              className="theme-toggle theme-toggle--mobile"
              type="button"
              aria-label={themeLabel}
              aria-pressed={isDarkTheme}
              onClick={toggleTheme}
            >
              {isDarkTheme ? (
                <FaSun aria-hidden="true" />
              ) : (
                <FaMoon aria-hidden="true" />
              )}
              <span>{isDarkTheme ? "Light mode" : "Dark mode"}</span>
            </button>
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
                  <span>Explore Features</span>
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
                  <motion.span
                    key={previewSnapshot.label}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.24 }}
                  >
                    {previewSnapshot.label}
                  </motion.span>
                </div>
                <motion.div
                  className="preview-total"
                  key={previewSnapshot.total}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.28 }}
                >
                  {previewSnapshot.total}
                </motion.div>
                <div className="preview-bars" aria-hidden="true">
                  {previewSnapshot.bars.map((height, index) => (
                    <span key={index} style={{ height: `${height}%` }} />
                  ))}
                </div>
                <motion.div
                  className="preview-note"
                  key={previewSnapshot.note}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.24 }}
                >
                  {previewSnapshot.note}
                </motion.div>
              </div>
            </div>
          </div>
        </section>

        <section className="feature-section" id="features">
          <div className="section-inner">
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
          </div>
        </section>

        <section className="adviser-section" aria-labelledby="adviser-heading">
          <div className="adviser-showcase">
            <div className="adviser-copy">
              <p className="eyebrow">Financial adviser</p>
              <h3 id="adviser-heading">Advice that sounds like a next step.</h3>
              <p>
                Buck turns the week&apos;s spending pattern into calm, practical
                guidance before the budget feels tight.
              </p>
            </div>

            <article className="adviser-card">
              <div className="adviser-card-header">
                <span className="adviser-badge">
                  <SavingsIcon aria-hidden="true" />
                  Financial adviser
                </span>
                <motion.span
                  className="adviser-confidence"
                  key={adviserSnapshot.confidence}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.22 }}
                >
                  {adviserSnapshot.confidence}
                </motion.span>
              </div>

              <motion.div
                className="adviser-output"
                key={adviserSnapshot.headline}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28 }}
              >
                <span className="adviser-focus">{adviserSnapshot.focus}</span>
                <strong>{adviserSnapshot.headline}</strong>
                <p
                  className="adviser-typing"
                  aria-label={adviserSnapshot.advice}
                >
                  <span aria-hidden="true">{typedAdviserAdvice}</span>
                  <span
                    className={`adviser-typing-cursor${
                      typedAdviserAdvice.length >= adviserSnapshot.advice.length
                        ? " adviser-typing-cursor--idle"
                        : ""
                    }`}
                    aria-hidden="true"
                  />
                </p>
              </motion.div>

              <div className="adviser-meter" aria-hidden="true">
                <span style={{ width: `${adviserSnapshot.progress}%` }} />
              </div>

              <div className="adviser-metrics">
                <div>
                  <strong>{adviserSnapshot.primaryMetric}</strong>
                  <span>{adviserSnapshot.primaryLabel}</span>
                </div>
                <div>
                  <strong>{adviserSnapshot.secondaryMetric}</strong>
                  <span>{adviserSnapshot.secondaryLabel}</span>
                </div>
              </div>
            </article>
          </div>
        </section>

        <section className="about-band" id="about">
          <div className="about-section">
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
