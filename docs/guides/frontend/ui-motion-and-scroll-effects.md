# UI Motion, Custom Scrollbars & Modal Glow Effects

This document details the design system, architecture, and implementation of custom Framer Motion scroll indicators, unified header borders, and dynamic modal glow outlines across the Buck Web Application.

---

## 1. Design Overview & Philosophy

Traditional operating system scrollbars can introduce visual clutter, layout shifts, and aesthetic mismatches with dark/light themes. To provide a state-of-the-art UI/UX:
- **Traditional Scrollbars are Concealed:** Standard scrollbars are hidden cleanly using CSS properties (`scrollbar-width: none;`, `::-webkit-scrollbar { display: none; }`).
- **Dynamic Header Progress Track:** Real-time scroll progress is projected directly onto the bottom border of sticky headers.
- **Hardware-Accelerated Fluidity:** Framer Motion (`useScroll`, `useSpring`, `useTransform`) drives all scroll tracking on the GPU, avoiding React state re-render jitters.
- **Dynamic Modal Perimeter Glow:** Long scrollable dialogs (Terms of Use, Privacy Policy) trace an illuminated SVG outline as the user reads.

---

## 2. Header & Topbar Scroll Indicators

### 2.1 Landing Page Header (`src/app/page.tsx`, `src/app/globals.css`)
- **Initial Top State:** When the user is at the top of the landing page (`scrollY <= 18px`), the header is completely transparent, borderless, and trackless.
- **Sticky / Scrolled State:** When scrolled past threshold, the header morphs into frosted glass (`backdrop-filter: blur(18px)`).
- **Unified Border Integration:**
  - Instead of drawing a separate `1px` bottom border plus an overlay track (which creates double lines or height step mismatches), the `.site-header-scroll-track` serves as the header's crisp `2px` bottom border line.
  - The `.site-header-scroll-indicator` has `height: 100%`, filling the exact 2px track with a signature gradient:
    - **Light Mode:** `linear-gradient(90deg, var(--buck-gold) 0%, var(--buck-orange) 65%, var(--buck-coral) 100%)`
    - **Dark Mode:** `linear-gradient(90deg, #ffd78a 0%, var(--buck-orange) 60%, #ff4d4d 100%)`
  - Glow effects are applied using multi-layer box shadows (`box-shadow: 0 0 10px rgba(244, 117, 54, 0.75), 0 0 4px rgba(255, 197, 71, 0.9)`).
- **Motion Physics:**
  ```tsx
  const { scrollYProgress } = useScroll();
  const smoothHeaderProgress = useSpring(scrollYProgress, {
    stiffness: 280,
    damping: 30,
    mass: 0.4,
    restDelta: 0.0001,
  });
  const headerProgressOpacity = useTransform(smoothHeaderProgress, [0, 0.01, 1], [0, 1, 1]);
  ```

### 2.2 Dashboard Topbar (`src/component/DashboardClientLayout.tsx`, `src/component/dashboard.css`)
- **Container Tracking:** The dashboard topbar tracks the inner scrolling element (`<main className="dashboard-main" ref={mainRef}>`) using `useScroll({ container: mainRef })`.
- **Unified Bottom Track:** The static bottom border is replaced by `.dashboard-scroll-track` (`height: 2px; background: var(--buck-line)`), and the `.dashboard-scroll-indicator` smoothly expands across it as the user scrolls through dashboard pages.

---

## 3. Modal Perimeter Scroll Glow (`<ScrollGlowModalCard>`)

### 3.1 Motivation
Standard modals with heavy scrollbars break visual immersion. For long content like Terms of Service and Privacy Policies, an interactive glowing border that traces the card's perimeter provides intuitive progress feedback.

### 3.2 Component Architecture (`src/app/page.tsx`)
- **Component:** `<ScrollGlowModalCard>`
- **Sizing Constraints:**
  - Standard card width: `width: min(880px, 100%)`
  - Max dialog height: `max-height: min(82dvh, 760px)`
  - Prevents uncontrolled horizontal stretching on ultra-wide desktop displays.
- **Dynamic Geometry via `ResizeObserver`:**
  - Measures the modal dimensions in real-time (`modalDims = { width, height, radius }`).
  - Renders an SVG `<motion.rect>` positioned with exact pixel dimensions:
    ```tsx
    <svg className="modal-glow-svg" aria-hidden="true">
      <defs>
        <linearGradient id="modalGlowGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--buck-gold)" />
          <stop offset="50%" stopColor="var(--buck-orange)" />
          <stop offset="100%" stopColor="var(--buck-coral)" />
        </linearGradient>
      </defs>
      <motion.rect
        x="1.5"
        y="1.5"
        width={Math.max(0, modalDims.w - 3)}
        height={Math.max(0, modalDims.h - 3)}
        rx={modalDims.r}
        ry={modalDims.r}
        fill="none"
        stroke="url(#modalGlowGrad)"
        strokeWidth="2.5"
        style={{ pathLength: smoothProgress }}
      />
    </svg>
    ```
- **Scrollability Check:**
  - Only enables the glowing SVG path if the modal body content actually overflows (`scrollHeight > clientHeight + 10px`).
  - If content fits entirely on screen, the glow outline is omitted to preserve a clean static card.

---

## 4. Static Modal Isolation (Contact Us Modal)

Modals that do not require scrolling (e.g. "Contact Us" confirmation) are isolated from the `<ScrollGlowModalCard>` wrapper:
- Rendered with a dedicated `<motion.article className="legal-modal-card">`.
- Strict compact sizing: `maxWidth: 420px; textAlign: center; padding: 2.5rem 1.5rem;`.
- Instant, non-distracting popup animation (`initial={{ opacity: 0, y: 28, scale: 0.94 }}` with Framer Motion spring).

---

## 5. CSS Summary & Reference

| Class / Component | Purpose | Key Attributes |
|---|---|---|
| `.site-header-scroll-track` | Landing page header progress track | `position: absolute; bottom: 0; height: 2px;` |
| `.site-header-scroll-indicator` | Landing page gradient indicator | `height: 100%; box-shadow: 0 0 10px rgba(244, 117, 54, 0.75);` |
| `.dashboard-scroll-track` | Dashboard topbar progress track | `position: absolute; bottom: 0; height: 2px;` |
| `.dashboard-scroll-indicator` | Dashboard gradient indicator | `height: 100%; scaleX: smoothScroll;` |
| `.modal-glow-shell` | Wrapper for scroll-glow modals | `width: min(880px, 100%); max-height: min(82dvh, 760px);` |
| `<ScrollGlowModalCard>` | Dynamic SVG perimeter component | `useScroll({ container: bodyRef })` + `ResizeObserver` |
