# Universal Dashboard Button Styling & Wallet Refinements

## 1. Unified Gradient Action Buttons
The user requested that the signature gradient aesthetic of the homepage's "Get Started" button be applied universally to all action buttons across the dashboard and its internal sections (Settings, Wallets, Admin, etc.).

### Changes Implemented
- Scanned `globals.css` to extract the `.primary-cta` styling (`background: linear-gradient(135deg, var(--buck-orange) 0%, var(--buck-coral) 100%)`).
- Added a global override in `dashboard.css` using the `:is()` selector to target `.settings-button`, `.expenses-primary-button`, `.goals-create-btn`, and all other primary/secondary variants.
- Excluded destructive buttons using `:not(.settings-button--danger)` to ensure that "Delete" buttons properly retain their highly visible red aesthetic.
- **Theme Responsiveness:** Included the `.landing-page--dark` equivalent rules (converting text to `#241409` and maintaining the gold box-shadow glow) via the `html[data-buck-theme="dark"]` selector inside the dashboard.
- Updated the "Active" pill badge `.settings-wallet-active-badge` to use this exact gradient rather than the mismatched gold/orange one.

## 2. Wallet Card Dynamic Layout Fix
The previous iteration incorrectly pushed the "Set Active" button into the top right, separating it from the primary action row.

### Changes Implemented
- Restored the "Set Active" button into the bottom action bar (`<div className="settings-wallet-actions">`).
- When a wallet is *inactive*, the bottom row now dynamically shares the flex width perfectly in a 3-way split: **[ Set Active ] [ Edit ] [ Delete ]**.
- When a wallet is *active*, the bottom row dynamically shares the flex width perfectly in a 2-way split: **[ Edit ] [ Delete ]**.
- The "Active" pill indicator strictly lives standalone in the top-right corner.
