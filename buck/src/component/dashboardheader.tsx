"use client";

import { useEffect, useLayoutEffect, useState } from "react";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  AnimatePresence,
  type MotionStyle,
  animate,
  motion,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import {
  FaAngleDoubleLeft,
  FaBars,
  FaSignOutAlt,
  FaTimes,
} from "react-icons/fa";
import WalletModal from "@/app/dashboard/wallet/WalletModal";
import FadeInImage from "@/component/FadeInImage";
import { useOptionalDashboardUser } from "@/context/DashboardUserContext";
import { useFinancial } from "@/context/FinancialContext";
import { useToast } from "@/component/toast";
import {
  DASHBOARD_ROUTES,
  getDashboardDisplayName,
  type DashboardNavId,
  type DashboardRoute,
} from "@/utils/dashboardRoutes";
import { INSTANT, LABEL_EXIT, LABEL_TRANSITION, SPRING, popoverMotion } from "@/utils/motion";
import { signOutUser } from "./authentication";
import "./dashboard.css";

const SIDEBAR_STORAGE_KEY = "buck:sidebar-collapsed";
const DESKTOP_QUERY = "(min-width: 1025px)";

type DashboardHeaderProps = {
  initialActiveNav?: DashboardNavId;
};

function getInitials(value: string) {
  const parts = value
    .trim()
    .split(/\s+/)
    .filter(Boolean);

  if (parts.length === 0) {
    return "BU";
  }

  if (parts.length === 1) {
    return parts[0].slice(0, 2).toUpperCase();
  }

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

export default function DashboardHeader({
  initialActiveNav = "home",
}: DashboardHeaderProps) {
  const pathname = usePathname();
  const currentNav: DashboardNavId =
    DASHBOARD_ROUTES.find((item) => pathname?.startsWith(item.href))?.id ?? initialActiveNav;
  // Start on the route's own item so a hard load of /dashboard/goals never
  // paints Home as active first and then slides the highlight across.
  const [activeNav, setActiveNav] = useState<DashboardNavId>(currentNav);
  const [menuOpen, setMenuOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  // False until the saved sidebar state has been applied: the first sync is
  // instant so a collapsed rail never slides shut on page load.
  const [sidebarReady, setSidebarReady] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  // True while the width spring runs: the header drops its backdrop blur so
  // the browser doesn't repaint the blur on every frame (ADR-054).
  const [sidebarAnimating, setSidebarAnimating] = useState(false);
  // The rail width lives in a motion value so every toggle springs from the
  // width on screen. Reading it from the DOM instead made the first toggle
  // after a page load snap: <html data-buck-sidebar> flips first and the CSS
  // width is already at the target before the animation starts.
  const railWidth = useMotionValue(250);
  // Normalized 0 (expanded) -> 1 (collapsed) progress locked to railWidth so
  // every spatial transform and the account tray resize on the exact same
  // SPRING curve with zero CSS/layout-snapshot desync.
  const collapseProgress = useTransform(railWidth, [250, 80], [0, 1]);
  const prefersReducedMotion = useReducedMotion();
  const router = useRouter();
  const user = useOptionalDashboardUser();
  const { dashboardCache, setDashboardCache } = useFinancial();
  const { toast } = useToast();
  const userCache = dashboardCache.userId === user?.uid ? dashboardCache : {};
  const displayName = getDashboardDisplayName(userCache, user);
  const accountSubtitle = user?.email || "Signed in";

  const avatarSource = userCache.profile?.avatarPath
    ? `/api/profile/avatar${userCache.profile.avatarUpdatedAt ? `?v=${userCache.profile.avatarUpdatedAt}` : ""}`
    : null;

  useEffect(() => {
    setActiveNav(currentNav);
  }, [currentNav]);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = window.localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
      setSidebarCollapsed(saved);
      railWidth.set(saved ? 80 : 250);
      document.documentElement.dataset.buckSidebar = saved ? "collapsed" : "expanded";
    } catch {
      // Ignore storage access errors
    }

    const desktop = window.matchMedia(DESKTOP_QUERY);
    const syncDesktop = () => setIsDesktop(desktop.matches);
    syncDesktop();
    desktop.addEventListener("change", syncDesktop);

    // Two frames: let the instant first sync paint before springs turn on.
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => setSidebarReady(true));
    });

    return () => {
      cancelAnimationFrame(frame);
      desktop.removeEventListener("change", syncDesktop);
    };
    // railWidth is a stable motion value; this still runs once.
  }, [railWidth]);

  // The rail only collapses on desktop; the mobile bar always shows the brand.
  const railCollapsed = sidebarCollapsed && isDesktop;
  const shouldAnimate = sidebarReady && !prefersReducedMotion;
  const labelTransition = shouldAnimate ? LABEL_TRANSITION : INSTANT;
  // Labels leave faster than the rail closes, so no text lingers in it.
  const labelExit = shouldAnimate ? LABEL_EXIT : INSTANT;

  useEffect(() => {
    if (!mounted || !isDesktop) return;
    const target = railCollapsed ? 80 : 250;
    if (!shouldAnimate) {
      railWidth.set(target);
      setSidebarAnimating(false);
      return;
    }
    if (railWidth.get() === target) {
      setSidebarAnimating(false);
      return;
    }
    setSidebarAnimating(true);
    const controls = animate(railWidth, target, {
      ...SPRING,
      onComplete: () => setSidebarAnimating(false),
    });
    return () => controls.stop();
  }, [mounted, isDesktop, railCollapsed, shouldAnimate, railWidth]);

  // Flip <html data-buck-sidebar> after React commits, not inside the state
  // update. The collapsed tray layout is CSS keyed on that attribute; setting
  // it before the render let the layout change before Framer took its
  // "before" snapshot, so it saw no movement and the profile photo jumped
  // 38px in one frame instead of gliding.
  useLayoutEffect(() => {
    if (!mounted) return;
    document.documentElement.dataset.buckSidebar = sidebarCollapsed ? "collapsed" : "expanded";
  }, [mounted, sidebarCollapsed]);

  const toggleSidebar = () => {
    setSidebarAnimating(true);
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // Ignore storage access errors
      }
      return next;
    });
  };

  useEffect(() => {
    DASHBOARD_ROUTES.forEach((item) => {
      router.prefetch(item.href);
    });
  }, [router]);

  const playQuack = () => {
    const audio = new Audio("/quack.mp3");
    void audio.play();
  };

  useEffect(() => {
    const handleOpenWallet = () => {
      setActiveNav("wallet");
      setWalletOpen(true);
    };

    window.addEventListener("open-wallet-modal", handleOpenWallet);
    return () => {
      window.removeEventListener("open-wallet-modal", handleOpenWallet);
    };
  }, []);

  const navigateTo = (item: DashboardRoute) => {
    setActiveNav(item.id);
    setMenuOpen(false);

    if (pathname?.startsWith(item.href)) {
      return;
    }

    router.push(item.href);
  };

  const handleSignOut = async () => {
    if (isSigningOut) {
      return;
    }

    setIsSigningOut(true);
    const result = await signOutUser();

    if (result.success) {
      setDashboardCache({});
      router.replace("/");
      return;
    }

    setIsSigningOut(false);
    toast(result.message || "Sign out failed.", "error");
  };

  const renderNavItems = (isMobile = false) =>
    DASHBOARD_ROUTES
      .filter((item) => !item.adminOnly || user?.isAdmin)
      .map((item) => {
        const Icon = item.icon;
        const showLabel = isMobile || !railCollapsed;

        return (
          <button
            key={item.id}
            className={`nav-button ${activeNav === item.id ? "active" : ""}`}
            type="button"
            title={!isMobile && railCollapsed ? item.label : undefined}
            aria-label={item.label}
            onClick={() => navigateTo(item)}
            onFocus={() => router.prefetch(item.href)}
            onMouseEnter={() => router.prefetch(item.href)}
          >
            <Icon aria-hidden="true" className="nav-button-icon" />
            <AnimatePresence initial={false}>
              {showLabel && (
                <motion.span
                  key="nav-label"
                  className="nav-button-label"
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6, transition: labelExit }}
                  transition={labelTransition}
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        );
      });

  return (
    <motion.header
      className={`dashboard-header${
        railCollapsed ? " dashboard-header--collapsed" : ""
      }${sidebarReady ? " dashboard-header--ready" : ""}${
        sidebarAnimating ? " dashboard-header--animating" : ""
      }`}
      // No inline width until mounted: before that, CSS sizes the rail from
      // <html data-buck-sidebar>, set before first paint by the root layout.
      style={
        mounted && isDesktop
          ? ({
              width: railWidth,
              "--buck-collapse": collapseProgress,
            } as MotionStyle)
          : undefined
      }
    >
      <div className="dashboard-header-inner">
        <button
          className="dashboard-brand"
          type="button"
          onClick={() => navigateTo(DASHBOARD_ROUTES[0])}
          aria-label="Go to dashboard home"
          title={railCollapsed ? "Buck — Go to dashboard home" : undefined}
        >
          {/* Driven by --buck-collapse in CSS (dashboard.css) so the mascot
              glides on the exact same SPRING curve as railWidth. */}
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
          <AnimatePresence initial={false}>
            {!railCollapsed && (
              <motion.span
                key="brand-copy"
                className="dashboard-brand-copy"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8, transition: labelExit }}
                transition={labelTransition}
              >
                <span className="dashboard-title">Buck</span>
                <span className="dashboard-tagline">Go Buck yourself</span>
              </motion.span>
            )}
          </AnimatePresence>
        </button>

        <nav className="dashboard-nav" aria-label="Dashboard navigation">
          {renderNavItems(false)}
        </nav>

        <div className="dashboard-header-actions">
          {/* Desktop tray positions and height are driven in CSS from
              --buck-collapse (derived from railWidth) so the border, avatar,
              copy, and collapse button move on one curve with no layout-flip snap. */}
          <div
            className="dashboard-account-tray"
            role="group"
            aria-label="Profile and sidebar controls"
          >
            <span
              className="dashboard-account-avatar"
              aria-hidden="true"
              title={railCollapsed ? `${displayName} (${accountSubtitle})` : undefined}
            >
              {getInitials(displayName)}
              {mounted && avatarSource ? (
                <FadeInImage
                  src={avatarSource}
                  className="dashboard-avatar-img"
                  referrerPolicy="no-referrer"
                />
              ) : null}
            </span>
            <AnimatePresence initial={false}>
              {!railCollapsed && (
                <motion.span
                  key="account-copy"
                  className="dashboard-account-copy"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8, transition: labelExit }}
                  transition={labelTransition}
                >
                  <strong>{displayName}</strong>
                  <span>{accountSubtitle}</span>
                </motion.span>
              )}
            </AnimatePresence>
            <div className="dashboard-account-controls">
              <button
                type="button"
                className="dashboard-tray-btn dashboard-tray-btn--collapse"
                onClick={toggleSidebar}
                aria-expanded={!railCollapsed}
                aria-label={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
                title={railCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                <span className="dashboard-collapse-icon">
                  <FaAngleDoubleLeft aria-hidden="true" />
                </span>
              </button>
            </div>
          </div>
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

      <AnimatePresence>
        {menuOpen && (
        <motion.nav
          key="mobile-menu"
          id="dashboard-mobile-menu"
          className="mobile-dropdown"
          aria-label="Mobile dashboard navigation"
          style={{ transformOrigin: "top right" }}
          {...popoverMotion}
        >
          {renderNavItems(true)}
          <button
            className="dashboard-account-tray dashboard-account-tray--mobile"
            type="button"
            disabled={isSigningOut}
            aria-busy={isSigningOut}
            aria-label={isSigningOut ? "Signing out" : "Sign out"}
            onClick={() => {
              setMenuOpen(false);
              void handleSignOut();
            }}
          >
            <span className="dashboard-account-avatar" aria-hidden="true">
              {getInitials(displayName)}
              {mounted && avatarSource ? (
                <FadeInImage
                  src={avatarSource}
                  className="dashboard-avatar-img"
                  referrerPolicy="no-referrer"
                />
              ) : null}
            </span>
            <span className="dashboard-account-copy">
              <strong>{displayName}</strong>
              <span>{isSigningOut ? "Signing out..." : accountSubtitle}</span>
            </span>
            <span className="dashboard-tray-btn dashboard-tray-btn--signout" aria-hidden="true">
              {isSigningOut ? (
                <span className="dashboard-button-spinner" />
              ) : (
                <FaSignOutAlt />
              )}
            </span>
          </button>
        </motion.nav>
        )}
      </AnimatePresence>

      <WalletModal
        open={walletOpen}
        onClose={() => {
          setWalletOpen(false);
          setActiveNav(currentNav);
        }}
      />
    </motion.header>
  );
}
