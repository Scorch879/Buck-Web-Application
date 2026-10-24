# Wallet Layout Update

## Issue Overview
The layout inside the wallet card components in the `Wallet` dashboard (`src/app/dashboard/wallet/page.tsx`) was unstructured. The "Active" badge, the "Edit" button, and the "Delete" button were all bunched together in a single row at the bottom of the card, leading to poor spacing and an unbalanced aesthetic.

## Modifications
We implemented a split-level flexbox design to distribute the card components beautifully across the space.

### 1. Relocated the "Active" State
- **Change:** Moved the `Active` checkmark badge (and the `Set Active` button for inactive wallets) out of the bottom action bar.
- **Positioning:** Placed it inline with the wallet's Title and Budget (`.settings-wallet-info`) using a `flex` container with `justify-content: space-between` and `align-items: flex-start`.
- **Result:** The Active indicator is now cleanly positioned in the top-right corner of the card, making the wallet's state instantly scannable without digging through the action buttons.

### 2. Equal-Width Action Buttons
- **Change:** Restructured the bottom action bar for the "Edit" and "Delete" buttons.
- **Styling:** Applied `display: flex`, `gap: 0.5rem`, and assigned `flex: 1` to both buttons.
- **Result:** The Edit and Delete buttons now stretch equally to share 100% of the horizontal space across the bottom of the card. This creates a much more modern, tap-friendly interface resembling native mobile apps.
- **Consistency:** Applied the exact same equal-width logic to the `Save` and `Cancel` buttons when the card is toggled into Editing Mode.

## 3. Mobile Responsiveness Fixes
- **Card Layout Container:** Changed the main wallet card container (`.settings-wallet-item`) from a wrapped flex row to a strict `flex-direction: column` with `align-items: stretch`. This ensures that all child elements strictly obey the card's boundaries and cannot spill out horizontally on either desktop or mobile views.
- **Action Buttons Wrapping:** Added `width: "100%"`, `flexWrap: "wrap"` and a `minWidth: "120px"` to the bottom action buttons inside `.settings-wallet-actions`. Previously, the buttons would shrink infinitely and clip off the screen, or overflow the entire card. Now, the `minWidth` forces them to cleanly wrap to a new line when they run out of space, ensuring the Delete button is never cut off.
- **Active Wallet Pill (Header):** Increased the size of the `.dashboard-wallet-pill` on mobile devices (`max-width: 520px`). Additionally, updated the `.dashboard-topbar` mobile layout (`max-width: 980px`) from a stacked column to a `flex-direction: row` with `justify-content: space-between`. This prevents the wallet pill from getting squashed under the title, explicitly placing it on the far right side of the header for optimal mobile space usage.
