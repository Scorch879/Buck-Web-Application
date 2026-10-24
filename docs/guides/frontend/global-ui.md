# Global UI Standardizations

## 1. Unified Dropdown Box Styling
Fixed an accessibility and aesthetics issue where default `<select>` and `<option>` dropdown menus were unreadable across different themes (especially in dark mode).
- **Global CSS Rules:** Added custom styling to `src/app/globals.css` specifically for `select` elements globally.
- **Theme Responses:** 
  - Standard light mode: High-contrast ink text.
  - Dark mode (`html[data-buck-theme="dark"]`): Light contrasting text with dark slate background for options.
- **Removed Redundancy:** Removed isolated dropdown styles that were previously hardcoded in various section styles (like `admin/style.css` and `settings/style.css`) to enforce the global rules instead.

## 2. Unified Primary Button Hover Effects
Consolidated all primary dashboard buttons to share the same dynamic, premium hover effect as the "Get Started" homepage button.
- **Targeted Buttons:** Added global selectors in `src/component/dashboard.css` targeting `.settings-button`, `.goals-create-btn`, `.expenses-primary-button`, `.admin-setup-button`, etc.
- **Typography:** Enforced `font-weight: 700` and `font-family: inherit` globally across primary buttons.
- **Animation Details:**
  - `transform: translateY(-1px) scale(1.02)` on hover.
  - Light mode: Orange shadow glow `box-shadow: 0 12px 24px rgba(253, 82, 59, 0.24)`.
  - Dark mode: Gold shadow glow `box-shadow: 0 16px 34px rgba(255, 197, 71, 0.24)`.
- **Result:** Consistent micro-animations across the entire Dashboard without requiring separate CSS updates in different components.

## 3. Unified Header Scroll Indicators & Scrollbar Concealment
Replaced traditional OS scrollbars with fluid, hardware-accelerated progress indicators attached directly to the header and topbar borders.
- **Scrollbar Concealment:** Concealed native scrollbars globally on scroll containers (`scrollbar-width: none;`, `::-webkit-scrollbar { display: none; }`).
- **Landing Page Header:** When scrolled past threshold, `.site-header-scroll-track` serves as the header's crisp `2px` bottom border, filled seamlessly by `.site-header-scroll-indicator` using Framer Motion `useScroll` + `useSpring`.
- **Dashboard Topbar:** Tracks inner dashboard content scrolling with Framer Motion `useScroll({ container: mainRef })`, projecting a glowing progress indicator across the topbar's bottom border.
- **Unified Border Integration:** Eliminates double borders or jagged height offset artifacts between indicators and container outlines.

## 4. Modal Scroll Glow & Layout Boundaries
- **Dynamic Perimeter SVG:** Implemented `<ScrollGlowModalCard>` which uses a `ResizeObserver` and Framer Motion `<motion.rect pathLength={smoothProgress}>` to illuminate the modal outline as the user scrolls.
- **Scrollability Exclusivity:** The SVG glow effect is conditionally rendered only when modal content exceeds viewport boundaries (`scrollHeight > clientHeight + 10px`).
- **Strict Sizing Constraints:** Modal widths are constrained to `width: min(880px, 100%)` to avoid stretching across ultra-wide desktop screens.
- **Contact Us Isolation:** Static compact dialogs (e.g., Contact Us modal at `maxWidth: 420px`) are isolated from scroll glow wrappers to maintain optimal lightweight layout.
