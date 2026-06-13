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
