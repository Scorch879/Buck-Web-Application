"use client";

import type { CSSProperties, ReactNode } from "react";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import type { TargetAndTransition, Variants } from "framer-motion";
import { FaArrowRight, FaBars, FaChevronRight, FaMoon, FaSun, FaTimes, FaEnvelope } from "react-icons/fa";
import {
  legalContentByType,
  type LegalModalType,
} from "@/constants/legal";
import {
  landingFeatures,
  landingBudgetRhythm,
  landingHighlights,
  landingNavItems,
  landingPrinciples,
  landingSecurityNotes,
  landingStats,
  landingSteps,
  savingsIcon as SavingsIcon,
} from "@/constants/landing";
import { usePointerGradient } from "@/hooks/usePointerGradient";
import {
  applyDocumentTheme,
  resolveLandingTheme,
} from "@/hooks/useAuthPageTheme";
import { isSupabaseConfigured, supabase } from "@/utils/supabase";

const heroWords = ["Buck", "Budget", "Tracker"];
const adviserRotationDelay = 6800;
const revealViewport = { once: true, amount: 0.2 };
const cardLiftHover: TargetAndTransition = {
  y: -8,
  transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] },
};

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

const weeklyRhythmSnapshots = [
  {
    label: "Steady week",
    budget: "PHP 5,000",
    used: "PHP 2,930 used",
    room: "41% room left",
    status: "Steady pace",
    statusTone: "safe",
    summary: "Daily spending is balanced, with room for one flexible weekend choice.",
    days: [
      { day: "Mon", amount: "PHP 420", height: 54, tone: "safe" },
      { day: "Tue", amount: "PHP 390", height: 48, tone: "safe" },
      { day: "Wed", amount: "PHP 510", height: 62, tone: "warm" },
      { day: "Thu", amount: "PHP 360", height: 44, tone: "safe" },
      { day: "Fri", amount: "PHP 610", height: 72, tone: "warm" },
      { day: "Sat", amount: "PHP 410", height: 52, tone: "safe" },
      { day: "Sun", amount: "PHP 230", height: 34, tone: "saved" },
    ],
  },
  {
    label: "Food spike",
    budget: "PHP 5,000",
    used: "PHP 3,740 used",
    room: "25% room left",
    status: "Watch Friday",
    statusTone: "warning",
    summary: "Food spending is climbing. Buck would suggest a smaller cap tomorrow.",
    days: [
      { day: "Mon", amount: "PHP 380", height: 46, tone: "safe" },
      { day: "Tue", amount: "PHP 520", height: 62, tone: "warm" },
      { day: "Wed", amount: "PHP 640", height: 76, tone: "warm" },
      { day: "Thu", amount: "PHP 890", height: 96, tone: "alert" },
      { day: "Fri", amount: "PHP 720", height: 82, tone: "alert" },
      { day: "Sat", amount: "PHP 430", height: 52, tone: "safe" },
      { day: "Sun", amount: "PHP 160", height: 30, tone: "saved" },
    ],
  },
  {
    label: "Goal protected",
    budget: "PHP 5,000",
    used: "PHP 2,520 used",
    room: "50% room left",
    status: "Save PHP 300",
    statusTone: "saved",
    summary: "The week is light enough to move money toward your savings goal.",
    days: [
      { day: "Mon", amount: "PHP 300", height: 38, tone: "safe" },
      { day: "Tue", amount: "PHP 280", height: 34, tone: "safe" },
      { day: "Wed", amount: "PHP 460", height: 56, tone: "safe" },
      { day: "Thu", amount: "PHP 390", height: 48, tone: "safe" },
      { day: "Fri", amount: "PHP 420", height: 52, tone: "safe" },
      { day: "Sat", amount: "PHP 510", height: 62, tone: "warm" },
      { day: "Sun", amount: "PHP 160", height: 30, tone: "saved" },
    ],
  },
  {
    label: "Weekend forecast",
    budget: "PHP 5,000",
    used: "PHP 3,180 used",
    room: "36% room left",
    status: "Forecast clear",
    statusTone: "forecast",
    summary: "Buck expects the week to finish under budget if weekend spending stays calm.",
    days: [
      { day: "Mon", amount: "PHP 410", height: 50, tone: "safe" },
      { day: "Tue", amount: "PHP 550", height: 66, tone: "warm" },
      { day: "Wed", amount: "PHP 310", height: 40, tone: "safe" },
      { day: "Thu", amount: "PHP 680", height: 80, tone: "warm" },
      { day: "Fri", amount: "PHP 450", height: 54, tone: "safe" },
      { day: "Sat", amount: "PHP 560", height: 68, tone: "warm" },
      { day: "Sun", amount: "PHP 220", height: 34, tone: "saved" },
    ],
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

const revealVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 28,
    filter: "blur(8px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.58,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

const revealGroupVariants: Variants = {
  hidden: { opacity: 1 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.09,
      delayChildren: 0.08,
    },
  },
};

const revealCardVariants: Variants = {
  hidden: {
    opacity: 0,
    y: 22,
    filter: "blur(6px)",
  },
  visible: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  },
};

function Reveal({
  children,
  className,
  delay = 0,
  hoverLift = false,
  scrollAnchor = false,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  hoverLift?: boolean;
  scrollAnchor?: boolean;
}) {
  return (
    <motion.div
      className={className}
      data-scroll-anchor={scrollAnchor ? "true" : undefined}
      variants={revealVariants}
      initial="hidden"
      whileInView="visible"
      whileHover={hoverLift ? cardLiftHover : undefined}
      viewport={revealViewport}
      transition={{ delay }}
    >
      {children}
    </motion.div>
  );
}

const getAnchorVisualGap = () => {
  if (window.innerWidth <= 600) {
    return 18;
  }

  if (window.innerWidth <= 900) {
    return 24;
  }

  return 34;
};

const getHeaderHeight = () =>
  document.querySelector(".site-header")?.getBoundingClientRect().height ?? 0;

const getSectionAnchor = (section: HTMLElement) =>
  section.querySelector<HTMLElement>("[data-scroll-anchor]") ?? section;

const getSectionScrollTop = (section: HTMLElement) => {
  const anchor = getSectionAnchor(section);
  const anchorTop = anchor.getBoundingClientRect().top + window.scrollY;
  const preferredAnchorTop = getHeaderHeight() + getAnchorVisualGap();

  return Math.max(anchorTop - preferredAnchorTop, 0);
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
  const [rhythmIndex, setRhythmIndex] = useState(0);
  const [legalModal, setLegalModal] = useState<LegalModalType | null>(null);
  const [contactModal, setContactModal] = useState(false);
  const previewSnapshot = weeklyPreviewSnapshots[previewIndex];
  const adviserSnapshot = adviserSnapshots[adviserIndex];
  const rhythmSnapshot = weeklyRhythmSnapshots[rhythmIndex];
  const activeLegalContent = legalModal ? legalContentByType[legalModal] : null;
  const [typedAdviserAdvice, setTypedAdviserAdvice] = useState(
    adviserSnapshot.advice
  );
  const cta = usePointerGradient<HTMLButtonElement>();

  useEffect(() => {
    router.prefetch("/sign-in");
    router.prefetch("/dashboard/home");
  }, [router]);

  useEffect(() => {
    if (!isSupabaseConfigured || !supabase) {
      return;
    }

    let isMounted = true;
    const authClient = supabase;

    const redirectAuthenticatedUser = async () => {
      const currentUrl = new URL(window.location.href);
      const hashParams = new URLSearchParams(
        currentUrl.hash.startsWith("#")
          ? currentUrl.hash.slice(1)
          : currentUrl.hash
      );
      const code = currentUrl.searchParams.get("code");
      const accessToken = hashParams.get("access_token");
      const refreshToken = hashParams.get("refresh_token");

      try {
        const { data: existingSession } = await authClient.auth.getSession();

        if (!existingSession.session && code) {
          await authClient.auth.exchangeCodeForSession(code);
        }

        if (!existingSession.session && accessToken && refreshToken) {
          await authClient.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
        }

        const {
          data: { user },
        } = await authClient.auth.getUser();

        if (!isMounted || !user) {
          return;
        }

        if (code || accessToken || currentUrl.hash) {
          window.history.replaceState(null, "", "/");
        }

        router.replace("/dashboard/home");
      } catch (error) {
        console.warn("Landing auth redirect failed:", error);
      }
    };

    void redirectAuthenticatedUser();

    const {
      data: { subscription },
    } = authClient.auth.onAuthStateChange((event, session) => {
      if ((event === "SIGNED_IN" || event === "TOKEN_REFRESHED") && session?.user) {
        router.replace("/dashboard/home");
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  useEffect(() => {
    const sections: HTMLElement[] = [];

    landingNavItems.forEach((item) => {
      const section = document.getElementById(item.targetId);

      if (section) {
        sections.push(section);
      }
    });

    if (sections.length === 0) {
      return;
    }

    let animationFrameId: number | null = null;

    const updateActiveSection = () => {
      const activationLine = getHeaderHeight() + getAnchorVisualGap() + 8;
      let currentSection = sections[0].id;

      setIsHeaderStuck(window.scrollY > 18);

      for (const section of sections) {
        const anchor = getSectionAnchor(section);
        const bounds = anchor.getBoundingClientRect();

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

    const rhythmIntervalId = window.setInterval(() => {
      setRhythmIndex(
        (currentIndex) => (currentIndex + 1) % weeklyRhythmSnapshots.length
      );
    }, 4200);

    return () => {
      window.clearInterval(previewIntervalId);
      window.clearInterval(adviserIntervalId);
      window.clearInterval(rhythmIntervalId);
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
    if (!legalModal && !contactModal) {
      return;
    }

    const previousOverflow = document.body.style.overflow;

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLegalModal(null);
        setContactModal(false);
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [legalModal, contactModal]);

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
    const targetSection = document.getElementById(targetId);

    if (targetSection) {
      window.scrollTo({
        top: targetId === "home" ? 0 : getSectionScrollTop(targetSection),
        behavior: "smooth",
      });
    }

    setMenuOpen(false);
  };

  const goToSignIn = () => {
    setMenuOpen(false);
    router.push("/sign-in");
  };

  const handleContactClick = () => {
    navigator.clipboard.writeText("buckthebudgettracker@gmail.com");
    setContactModal(true);
    setMenuOpen(false);
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
              className="nav-link-button"
              type="button"
              onClick={handleContactClick}
            >
              Contact Us
            </button>
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
              className="nav-link-button"
              type="button"
              onClick={handleContactClick}
            >
              Contact Us
            </button>
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
              Sign In
            </button>
          </nav>
        )}
      </header>

      <main>
        <section className="hero-section" id="home">
          <div className="hero-content">
            <div className="hero-copy" data-scroll-anchor="true">
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
              <motion.div
                className="hero-stats"
                aria-label="Buck highlights"
                variants={revealGroupVariants}
                initial="hidden"
                whileInView="visible"
                viewport={revealViewport}
              >
                {landingStats.map((stat) => (
                  <motion.div
                    className="hero-stat"
                    key={stat.label}
                    variants={revealCardVariants}
                    whileHover={cardLiftHover}
                  >
                    <strong>{stat.value}</strong>
                    <span>{stat.label}</span>
                  </motion.div>
                ))}
              </motion.div>
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
            <Reveal className="section-heading" scrollAnchor>
              <p className="eyebrow">What Buck keeps tidy</p>
              <h2>Everything important has a clear place.</h2>
            </Reveal>
            <motion.div
              className="feature-grid"
              variants={revealGroupVariants}
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
            >
              {landingFeatures.map((feature) => {
                const FeatureIcon = feature.icon;

                return (
                  <motion.article
                    className="feature-card"
                    key={feature.title}
                    variants={revealCardVariants}
                    whileHover={cardLiftHover}
                  >
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
                  </motion.article>
                );
              })}
            </motion.div>
          </div>
        </section>

        <section className="adviser-section" aria-labelledby="adviser-heading">
          <div className="adviser-showcase">
            <Reveal className="adviser-copy">
              <p className="eyebrow">Financial adviser</p>
              <h3 id="adviser-heading">Advice that sounds like a next step.</h3>
              <p>
                Buck turns the week&apos;s spending pattern into calm, practical
                guidance before the budget feels tight.
              </p>
            </Reveal>

            <motion.article
              className="adviser-card"
              variants={revealVariants}
              initial="hidden"
              whileInView="visible"
              whileHover={cardLiftHover}
              viewport={revealViewport}
            >
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
            </motion.article>
          </div>
        </section>

        <section className="rhythm-section" aria-labelledby="rhythm-heading">
          <div className="section-inner rhythm-layout">
            <Reveal className="rhythm-copy">
              <p className="eyebrow">Weekly rhythm</p>
              <h2 id="rhythm-heading">A budget that moves with your week.</h2>
              <p>
                Buck is built around the way money actually behaves: small daily
                spending, a few surprise expenses, and goals you still want to
                protect at the end of the week.
              </p>
            </Reveal>

            <motion.div
              className="rhythm-board"
              variants={revealVariants}
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
            >
              <div className="week-preview-card">
                <div className="week-preview-header">
                  <span>{rhythmSnapshot.label}</span>
                  <strong>{rhythmSnapshot.budget}</strong>
                </div>

                <AnimatePresence mode="wait">
                  <motion.p
                    className={`week-status-pill week-status-pill--${rhythmSnapshot.statusTone}`}
                    key={rhythmSnapshot.status}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.24 }}
                  >
                    {rhythmSnapshot.status}
                  </motion.p>
                </AnimatePresence>

                <div
                  className="week-timeline"
                  aria-label={`${rhythmSnapshot.label} spending status`}
                >
                  {rhythmSnapshot.days.map((day, index) => (
                    <span
                      key={day.day}
                      style={
                        {
                          "--bar-delay": `${index * 95}ms`,
                        } as CSSProperties
                      }
                      title={`${day.day}: ${day.amount}`}
                    >
                      <motion.i
                        className={`week-bar week-bar--${day.tone}`}
                        initial={false}
                        animate={{ height: day.height }}
                        transition={{
                          duration: 0.68,
                          delay: index * 0.045,
                          ease: [0.22, 1, 0.36, 1],
                        }}
                      />
                      <em>{day.day}</em>
                      <small>{day.amount}</small>
                    </span>
                  ))}
                </div>

                <AnimatePresence mode="wait">
                  <motion.div
                    className="week-preview-footer"
                    key={`${rhythmSnapshot.used}-${rhythmSnapshot.room}`}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.24 }}
                  >
                    <span>{rhythmSnapshot.used}</span>
                    <strong>{rhythmSnapshot.room}</strong>
                  </motion.div>
                </AnimatePresence>

                <AnimatePresence mode="wait">
                  <motion.p
                    className="week-preview-summary"
                    key={rhythmSnapshot.summary}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.24 }}
                  >
                    {rhythmSnapshot.summary}
                  </motion.p>
                </AnimatePresence>
              </div>

              <motion.div
                className="rhythm-card-grid"
                variants={revealGroupVariants}
                initial="hidden"
                whileInView="visible"
                viewport={revealViewport}
              >
                {landingBudgetRhythm.map((item) => {
                  const RhythmIcon = item.icon;

                  return (
                    <motion.article
                      className="rhythm-card"
                      key={item.title}
                      variants={revealCardVariants}
                      whileHover={cardLiftHover}
                    >
                      <span>
                        <RhythmIcon aria-hidden="true" />
                      </span>
                      <h3>{item.title}</h3>
                      <p>{item.description}</p>
                    </motion.article>
                  );
                })}
              </motion.div>
            </motion.div>
          </div>
        </section>

        <section className="trust-section" aria-labelledby="trust-heading">
          <div className="section-inner">
            <Reveal className="section-heading trust-heading">
              <p className="eyebrow">Privacy and session safety</p>
              <h2 id="trust-heading">Your budget should feel personal, not exposed.</h2>
              <p>
                Budget data is sensitive, so Buck keeps the design quiet and the
                account flow guarded with Supabase-backed authentication.
              </p>
            </Reveal>

            <motion.div
              className="trust-grid"
              variants={revealGroupVariants}
              initial="hidden"
              whileInView="visible"
              viewport={revealViewport}
            >
              {landingSecurityNotes.map((item) => {
                const SecurityIcon = item.icon;

                return (
                  <motion.article
                    className="trust-card"
                    key={item.title}
                    variants={revealCardVariants}
                    whileHover={cardLiftHover}
                  >
                    <span>
                      <SecurityIcon aria-hidden="true" />
                    </span>
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </motion.article>
                );
              })}
            </motion.div>
          </div>
        </section>

        <section className="about-band" id="about">
          <div className="about-section">
            <Reveal className="about-copy" scrollAnchor>
              <p className="eyebrow">About Buck</p>
              <h2>Budgeting should feel calm, visible, and doable.</h2>
              <p>
                Buck was built around a simple idea: when your expenses, goals,
                and forecasts live in one readable place, money decisions get less
                stressful. The app gives you a weekly view, goal progress, wallet
                tracking, and AI suggestions so you can spend with intention.
              </p>
              <motion.div
                className="principle-grid"
                variants={revealGroupVariants}
                initial="hidden"
                whileInView="visible"
                viewport={revealViewport}
              >
                {landingPrinciples.map((principle) => (
                  <motion.article
                    className="principle-card"
                    key={principle.title}
                    variants={revealCardVariants}
                    whileHover={cardLiftHover}
                  >
                    <h3>{principle.title}</h3>
                    <p>{principle.description}</p>
                  </motion.article>
                ))}
              </motion.div>
            </Reveal>

            <Reveal className="workflow-panel" hoverLift>
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
            </Reveal>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="landing-footer-main">
          <div className="landing-footer-brand">
            <div className="footer-brand-lockup">
              <span className="footer-brand-mark" aria-hidden="true">
                <Image
                  src="/BuckMascot.svg"
                  alt=""
                  width={52}
                  height={62}
                />
              </span>
              <div className="footer-brand-copy">
                <strong>Buck Budget Tracker</strong>
                <span>Spend smarter. Save steadier.</span>
              </div>
            </div>
            <p>
              A friendly personal budget tracker for weekly wallets, savings
              goals, and calmer money decisions.
            </p>
          </div>

          <nav className="footer-links" aria-label="Footer navigation">
            <button type="button" onClick={goToSignIn}>
              Log in
            </button>
            <Link href="/create-account">Register</Link>
            <button type="button" onClick={handleContactClick}>
              Contact Us
            </button>
            <button type="button" onClick={() => setLegalModal("terms")}>
              Terms
            </button>
            <button type="button" onClick={() => setLegalModal("privacy")}>
              Privacy
            </button>
          </nav>
        </div>

        <div className="landing-footer-divider" />

        <div className="landing-footer-bottom">
          <p>&copy; 2026 Buck. All rights reserved.</p>
          <p className="footer-disclaimer">
            NOT AFFILIATE TO ANY BANKS OR GOVERNMENT ENTITIES.
          </p>
        </div>
      </footer>

      <AnimatePresence>
        {activeLegalContent && (
          <motion.div
            className="legal-modal-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setLegalModal(null)}
          >
            <motion.article
              className="legal-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="legal-modal-title"
              initial={{ opacity: 0, y: 28, scale: 0.94, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 18, scale: 0.96, filter: "blur(6px)" }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                className="legal-modal-close"
                type="button"
                onClick={() => setLegalModal(null)}
                aria-label="Close legal information"
              >
                <FaTimes aria-hidden="true" />
              </button>

              <div className="legal-modal-hero">
                <p className="legal-modal-eyebrow">
                  {activeLegalContent.eyebrow}
                </p>
                <h2 id="legal-modal-title">
                  {activeLegalContent.title}{" "}
                  <span>{activeLegalContent.accent}</span>
                </h2>
                <p className="legal-modal-lede">{activeLegalContent.lede}</p>
                <p className="legal-modal-updated">
                  {activeLegalContent.updated}
                </p>
              </div>

              <div className="legal-modal-grid">
                {activeLegalContent.sections.map((section) => (
                  <section
                    className="legal-modal-section"
                    key={section.title}
                  >
                    <h3>{section.title}</h3>
                    <p>{section.body}</p>
                  </section>
                ))}
              </div>
            </motion.article>
          </motion.div>
        )}
        {contactModal && (
          <motion.div
            className="legal-modal-backdrop"
            role="presentation"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setContactModal(false)}
          >
            <motion.article
              className="legal-modal-card"
              role="dialog"
              aria-modal="true"
              aria-labelledby="contact-modal-title"
              initial={{ opacity: 0, y: 28, scale: 0.94, filter: "blur(8px)" }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: "blur(0px)" }}
              exit={{ opacity: 0, y: 18, scale: 0.96, filter: "blur(6px)" }}
              transition={{ duration: 0.34, ease: [0.22, 1, 0.36, 1] }}
              onClick={(event) => event.stopPropagation()}
              style={{ maxWidth: '420px', textAlign: 'center', padding: '2.5rem 1.5rem' }}
            >
              <button
                className="legal-modal-close"
                type="button"
                onClick={() => setContactModal(false)}
                aria-label="Close contact modal"
              >
                <FaTimes aria-hidden="true" />
              </button>

              <div style={{ marginBottom: '1rem' }}>
                <span style={{ display: 'inline-flex', padding: '1rem', borderRadius: '50%', background: 'rgba(244, 117, 54, 0.1)', color: 'var(--buck-orange)', fontSize: '1.5rem' }}>
                  <FaEnvelope />
                </span>
              </div>
              <h2 id="contact-modal-title" style={{ fontSize: '1.5rem', marginBottom: '0.8rem', color: 'var(--buck-ink)' }}>
                Email Copied!
              </h2>
              <p style={{ color: 'var(--buck-muted)', lineHeight: '1.6', marginBottom: '1.5rem' }}>
                If you have any questions or queries, feel free to contact us at <strong style={{ color: 'var(--buck-orange)' }}>buckthebudgettracker@gmail.com</strong>
              </p>
              <button className="nav-cta" onClick={() => setContactModal(false)} style={{ width: '100%', padding: '0.8rem' }}>
                Got it
              </button>
            </motion.article>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
