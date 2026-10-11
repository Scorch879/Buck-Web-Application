# Implementation.md: Execution Details, Setup & Hardcoded Constraints

This document details runtime setup procedures, environment configurations, low-level execution logic for complex modules, edge cases, and hardcoded system constraints for the **Buck Budget Tracker Web Application**.

---

## 1. Environment Variable Specification

### 1.1 Next.js Frontend & Server Environment (`buck/.env.local`)

| Variable Name | Scope | Required | Default / Description |
|---|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Client & Server | **Yes** | HTTPS URL of the Supabase project instance. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client & Server | **Yes** | Public anonymous API key for client queries. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server Only | **Yes** | Admin service role key (bypasses RLS for account purging and password reset checks). |
| `SESSION_COOKIE_SECRET` | Server Only | **Yes** | Secret string used for HMAC-SHA256 signing of session activity cookies. |
| `AUTH_RATE_LIMIT_SECRET` | Server Only | Optional | Secret key for hashing IP and email in `auth_security_events`. (Falls back to `SESSION_COOKIE_SECRET`). |
| `NEXT_PUBLIC_SITE_URL` | Client & Server | Optional | Production canonical URL (e.g. `https://buck-app.vercel.app`) used for email redirects. |
| `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES` | Client & Server | Optional | Default: `30`. Minutes of inactivity before auto sign-out. |
| `NEXT_PUBLIC_SESSION_WARNING_SECONDS` | Client Only | Optional | Default: `60`. Seconds before timeout to display the session expiration countdown modal. |
| `ACCOUNT_PURGE_SECRET` | Server Only | Optional | Bearer token required to trigger `/api/account/deletion/purge`. |
| `CRON_SECRET` | Server Only | Optional | Bearer token required to trigger `/api/cron/generate-insights` from Vercel Cron. |
| `SUPABASE_MANAGEMENT_TOKEN` | Server Only | Optional | Access token for Supabase Management API (used in Admin logs). |
| `SUPABASE_PROJECT_REF` | Server Only | Optional | Project reference ID for Supabase logs endpoint. |
| `VERCEL_ACCESS_TOKEN` | Server Only | Optional | Vercel API token for deployment metrics. |
| `VERCEL_PROJECT_ID` | Server Only | Optional | Vercel project ID for deployment monitoring. |

### 1.2 Python FastAPI Microservice Environment (`buck/BuckAI_Backend/.env.local`)

| Variable Name | Scope | Required | Description |
|---|---|---|---|
| `TOGETHER_API_KEY` | Python Server | **Yes** | API key for Together AI inference (`meta-llama/Llama-3.3-70B-Instruct-Turbo-Free`). |

---

## 2. Step-by-Step Setup & Deployment

### 2.1 Next.js Frontend Application Setup

```bash
# 1. Navigate to the frontend directory
cd buck

# 2. Install dependencies (Node.js 18.18.0+)
npm install

# 3. Configure .env.local with Supabase credentials
cp .env.example .env.local  # or create manually

# 4. Start development server with Turbopack
npm run dev

# 5. Build for production deployment
npm run build
npm run start
```

### 2.2 Python FastAPI Backend Setup

```bash
# 1. Navigate to AI backend directory
cd buck/BuckAI_Backend

# 2. Create virtual environment
python -m venv venv
# On Windows:
.\venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# 3. Install required packages
pip install -r requirements.txt

# 4. Configure .env.local with TOGETHER_API_KEY
# 5. Run FastAPI development server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 2.3 Supabase Database Migration Setup

Execute SQL migrations located in [`buck/supabase/migrations/`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/supabase/migrations/) in sequential order:
1. `202606010001_initial_buck_schema.sql` (Core tables, triggers, RLS policies, realtime publication).
2. `202606100001_profile_avatars.sql` (Storage bucket `profile-avatars` and RLS policies).
3. `202606110001_account_deletion_requests.sql` (10-day recovery window table and indexes).
4. `202606110002_auth_security_events.sql` (Rate limit hash log table).
5. `202606120001_soft_delete_wallets.sql` (`deleted_at` column on `wallets`).
6. `202606130001_strict_deletions.sql` (Enforces deletion guards on non-empty wallets, funded goals, and active categories).
7. `202606140001_security_and_policy_hardening.sql` (Hardens function search paths, revokes direct execute on trigger/definer functions, consolidates duplicate RLS policies, fixes `auth_security_events` policy, optimizes initplans, and adds covering indexes).
8. `202610100001_ai_forecast_and_advisory_tables.sql` (Creates `ai_forecasts` and `ai_advisories` tables with relational ownership triggers, updated_at triggers, covering indexes, and user-isolated RLS policies).

---

## 3. Complex Module Execution Logic

### 3.1 Session Activity HMAC Signing & Verification ([`middleware.ts`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/middleware.ts#L171-L250))
- **Payload**: Base64URL-encoded JSON `{ sub: userId, ts: Date.now() }`.
- **Signing**: Uses Web Crypto API `crypto.subtle.importKey` with `HMAC-SHA256` and the server secret.
- **Verification**: On every dashboard request, extracts cookie `payload.signature`, performs `crypto.subtle.verify`, and calculates `Date.now() - activity.ts > timeoutMs`.

### 3.2 Password Policy Validation ([`passwordPolicy.ts`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/passwordPolicy.ts))
Enforces 5 discrete security criteria:
- Minimum length: $\ge 8$ characters.
- Lowercase letter: `/[a-z]/`.
- Uppercase letter: `/[A-Z]/`.
- Number: `/[0-9]/`.
- Special character: `/[^A-Za-z0-9]/`.
Returns a composite score (0 to 5) and localized validation messages.

### 3.3 Dynamic SVG Modal Perimeter Glow Math
- Uses Framer Motion's `useScroll` with `container` reference.
- Dynamic SVG `rect` uses `pathLength` mapped to `smoothProgress` with Spring physics (`damping: 24, stiffness: 220`).
- Incorporates `ResizeObserver` to evaluate whether modal content overflows viewport height before rendering glow borders.

### 3.4 Cross-Tab Session Synchronization ([`SessionManager.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/SessionManager.tsx#L100-L250))
- Employs a `BroadcastChannel("buck-session")` alongside `localStorage` event listeners.
- Throttles activity timestamps writes to once every 15,000 ms.
- If a user clicks "Stay Signed In" in any tab, an `activity` message wakes all sibling tabs.
- If a user logs out in one tab, a `signout` message terminates sessions globally across all open tabs.

### 3.5 Hybrid AI Forecast & Advisory Architecture ([`aiInsightsGenerator.ts`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/aiInsightsGenerator.ts))
- **Cache-First UI (< 50ms load)**: Frontend routes (`/dashboard/forecast`, `/dashboard/financial-advisor`) query Supabase for active unexpired records (`ai_forecasts`, `ai_advisories`).
- **On-Demand & Manual Refresh**: If no valid record exists or the user clicks "Refresh", route handlers recalculate trajectory in Philippine Peso (`PHP`, `₱`) and persist to Supabase.
- **Automated Vercel Cron (`/api/cron/generate-insights`)**: Executes every Sunday at 22:00 UTC (Monday 06:00 PHT) configured in `vercel.json`, batch processing active users with `CRON_SECRET` authentication.

### 3.6 Global Uniform Toaster Subsystem ([`ToastContext.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/toast/ToastContext.tsx), [`ToastItem.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/toast/ToastItem.tsx))
- **Queue & Stack Management**: Hard-capped at 4 concurrent notifications (`MAX_TOASTS = 4`) rendered through Framer Motion `popLayout`. When queue overflows, oldest toast is gracefully displaced.
- **Timer & Auto-Dismiss Lifecycles**: Default lifespan of 4,000 ms (`defaultDuration = 4000`), with infinite duration for `'loading'` state until programmatically dismissed or replaced.
- **Pause-on-Hover Engine**: Tracks elapsed time via `performance.now()`. Hovering over any toast pauses the countdown timer and freezes CSS progress bar animation; unhovering recalculates remaining duration precisely.
- **Dual Invocation Pipeline**: Supports functional calls `toast(message, type, options)` and fluent API `toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()`, `toast.loading()`, `toast.dismiss()`. Features a decoupled global event bus to dispatch toasts from non-React service utility files.

### 3.7 Streamlined KPI Visualizer & Typographic Hierarchy System ([`ExpenseKPICards.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/expenses/ExpenseKPICards.tsx), [`DashboardSkeletons.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/DashboardSkeletons.tsx))
- **High-Signal KPI Metrics**: In `ExpenseKPICards.tsx`, removed noisy 7-day sparkline histogram and benchmark line tracks in favor of a responsive 2-column `.expenses-kpi-stat-grid`. Card 2 pairs cumulative total with **This Month** and **Daily Average**; Card 3 pairs average transaction with **Lowest Expense** and **Highest Expense** with tooltip category metadata.
- **Vertical Spacing Normalization**: Encapsulated wallet headers in `.wallet-card-title-wrap` with scoped `gap: 0.15rem; margin: 0;`, neutralizing user-agent heading block margins and ensuring strict vertical centering with header icons.
- **Standardized Font-Weight Scale**: Replaced legacy `800`–`900` font weights with a calibrated scale:
  - `500` (Medium): Dropdown selects, search inputs, archived status badges.
  - `600` (Semi-bold): Form labels, quick preset chips, action buttons, category chips, list items, card badges.
  - `650` (Demi-bold): Eyebrow text, card titles, and secondary stat values.
  - `700` (Bold): Primary KPI hero numbers and transaction amounts.
- **Hydration Parity**: `ExpensesSkeleton` and `WalletSkeleton` directly employ `.expenses-kpi-stat-grid` and `.wallet-card-title-wrap` to eliminate Cumulative Layout Shift (CLS).

### 3.8 Home AI Advisor Component Parity & Cache Synchronization ([`AIAdvisorPlaceholderCard.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/AIAdvisorPlaceholderCard.tsx), [`financial-advisor/page.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/financial-advisor/page.tsx))
- **Faithful 1:1 Presentation**: Eliminated speculative telemetry chips (LLaMA model versions, Prophet chips, and calibration banners) from the Home dashboard. The card now mirrors the exact structure of the Financial Advisor tab itself:
  - Header with eyebrow `Financial Advisor`, dynamic timestamp badge, title `Advice that sounds like a next step.`, and subtitle.
  - Interactive `View Full Advisor →` link button alongside circular Financial Health Score radial meter.
  - Responsive 2-card grid for **AI Suggestion** ("What to do next" with `<FaLightbulb />`) and **AI Advice** ("Detailed Analysis" with `<FaReceipt />`).
  - Empty-state fidelity: When insights have not yet been generated, cards render clean and empty without fabricating mock metrics.
- **Client Cache Layer Synchronization**: Integrated `aiInsights` into `DashboardDataCache` via [`FinancialContext.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/context/FinancialContext.tsx). Cached advisory data loaded on either the Home page or Financial Advisor tab is immediately shared, eliminating redundant network calls across route transitions.
- **1:1 Skeletal Loading Parity**: Synchronized `HomeSkeleton` in [`DashboardSkeletons.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/DashboardSkeletons.tsx) with matching header button/score geometry and side-by-side advice card skeletons to completely eliminate Cumulative Layout Shift (CLS).

### 3.9 Financial Summary Eyebrow & "Others" Sub-Category Filtering Pipeline ([`home/page.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/page.tsx), [`WeeklyPieChart.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/WeeklyPieChart.tsx), [`style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css))
- **Title Row Architecture**: Restored `<p className="card-eyebrow">Categories</p>` directly above `<div className="summary-title-row">` containing `<h2 className="summary-title">Financial Summary</h2>`. When filtered, the interactive filter pillbox (`.summary-filter-pill`) renders beside the heading on the same row. When unfiltered, the header remains clean without redundant pillboxes.
- **"Others" Sub-Category Discovery & State Safety**: Fixed category existence validation in `useEffect` by checking against `pieExpenses` (confirming presence of expenses in active timeframe) rather than `categoryPieData.slices` (which is restricted to top-4 categories and `"Others"`). This prevents selection reset when clicking smaller/custom categories bundled under "Others" (e.g. Health, Entertainment, Electronics).
- **Sub-Category Pie Chart Coordination**:
  - Highlights the parent `"Others"` slice with active border and $10\text{px}$ offset when a subcategory of Others is selected, while dimming top-4 slices.
  - Updates center circle with the selected subcategory's name and exact amount via `selectedCategoryAmount`.
  - Reflects active selection in the "Others" legend pill (`Others: <SubCategory>`) and callout leader line (`Others (<SubCategory>)`).
  - Provides a dedicated `← Others` quick-return button in the title pillbox group.
- **1:1 Skeletal Loading Parity**: Synchronized `HomeSkeleton` in [`DashboardSkeletons.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/DashboardSkeletons.tsx) with the `Categories` eyebrow (`85px × 12px`) and `Financial Summary` heading (`175px × 22px`), maintaining zero CLS.

### 3.10 Dashboard Subroute Loading Boundaries & Skeletal Layout Parity ([`DashboardClientLayout.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/DashboardClientLayout.tsx), [`DashboardSkeletons.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/DashboardSkeletons.tsx))
- **Dedicated Route Loading Boundaries**: Created individual Next.js App Router `loading.tsx` boundary files for each dashboard subroute (`expenses/loading.tsx`, `wallet/loading.tsx`, `financial-advisor/loading.tsx`, `forecast/loading.tsx`, `admin/loading.tsx`), resolving the issue where absent route boundaries defaulted to the parent `/dashboard/loading.tsx` and flashed the `HomeSkeleton` on all tabs.
- **Client Layout Dispatch Alignment**: Fixed `getSkeletonVariant` in [`DashboardClientLayout.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/DashboardClientLayout.tsx) to map each path directly to its true variant (`expenses`, `wallet`, `financial-advisor`, `forecast`, `goals`, `statistics`, `settings`, `admin`, `home`), eliminating cross-tab layout misdirection.
- **1:1 Geometry Parity Across Skeletons**:
  - `HomeSkeleton`: Implemented `.graph-container` grid with `.graph-y-axis-wrap` (displaying "Amount (₱)" and 7 numeric tick line placeholders) and `.graph-x-axis-footer` ("Day of the Week"), matching `WeeklyBarChart` layout and eliminating shift upon hydration.
  - `FinancialAdvisorSkeleton`: Added circular `.advisor-score` badge ($128\text{px} \times 128\text{px}$) in `.advisor-hero`, 3 cards in `.advisor-grid`, and 2 wide cards in `.advisor-ai-grid`.
  - `ForecastSkeleton`: Synchronized with `.forecast-hero` score badge, 3 prediction metric cards in `.advisor-grid`, and 2 wide cards in `.forecast-ai-grid` (replacing the legacy inaccurate bar chart).
  - `AdminSkeleton`: Built 3-tab vertical navigation (`settings-tabs`), toolbar, and card list items matching `admin/page.tsx`.

### 3.11 Home Pie Legend Left-Alignment & Callout Anti-Clipping Typography Engine ([`WeeklyPieChart.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/WeeklyPieChart.tsx), [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css), [`DashboardSkeletons.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/DashboardSkeletons.tsx))
- **Left-Aligned Legend Architecture**: Transitioned `.spending-pie-layout` from centered alignment to `justify-content: flex-start; gap: clamp(1.25rem, 2.5vw, 3rem);`. Pinned the 6 category legend pills flush to the left card margin directly beneath the "Category Breakdown" heading, eliminating empty left margin and granting maximum width to the Chart.js canvas.
- **Enlarged Callout Typography Engine**:
  - Boosted category name typography to $13.5\text{px}$ (+2.5px, semi-bold `600`–`650`) and slice percentage typography to $14.5\text{px}$ (+3px, bold `750`–`850`) for clear instant readability.
  - Increased line-height separation (`endY - 8` for category name, `endY + 9` for percentage) and increased collision avoidance threshold `minVerticalGap = 32`.
- **Anti-Clipping Bounds Protection**:
  - Expanded `.spending-pie-canvas-inner` height to $290\text{px}$ and canvas layout padding to `top: 34, bottom: 34, left: 95, right: 95`.
  - Tightened leader line projection to $r + 10$ knee and $10\text{px}$ shelf, maximizing printable text width.
  - Implemented vertical boundary clamping (`minY = 22, maxY = height - 24`), preventing top callouts (e.g. "Others") and bottom callouts (e.g. "Bills") from clipping against canvas edges.
  - Implemented safe horizontal placement (`safeTextX`) and dynamic ellipsis truncation for outlier category names exceeding canvas margin width.
- **1:1 Skeletal Loading Parity**: Synchronized `HomeSkeleton` in [`DashboardSkeletons.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/DashboardSkeletons.tsx) with left-aligned legend and $290\text{px}$ canvas box geometry to eliminate CLS.

### 3.12 Sibling Filter Pill Architecture & Anti-Pill-in-Pill Decoupling ([`home/page.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/page.tsx), [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css))
- **Anti-Pill-in-Pill Decoupling**: Completely eliminated the nested pill anti-pattern where action buttons (`✕ Show All`, `✕ Clear`) were embedded inside parent category badges.
- **Financial Summary Title Row**:
  - Replaced single combined pill with two separate sibling pills inside `.summary-filter-pill-group`:
    1. **Category Indicator Badge** (`.summary-filter-pill--active`): Category dot + `Category:` prefix + bold category name. Stripped redundant `• All Time` label.
    2. **Standalone Action Pill** (`.summary-filter-action-btn`): Distinct `✕ Show All` button styled with orange background, hover elevation, and independent click hit target.
    3. **Subcategory Back Pill** (`.summary-filter-back-btn`): `← Others` button as a third sibling when drilled into an Others subcategory.
- **Bar Graph Card (Expenses by day)**:
  - Replaced nested `.chart-active-filter-badge` with `.chart-active-filter-group` housing two separate sibling pills:
    1. **Category Indicator Badge** (`.chart-active-filter-badge`): Category dot + `Category:` prefix + bold category name.
    2. **Standalone Action Pill** (`.filter-clear-btn`): Independent `✕ Clear` pill button outside the badge.
- **Typography & Whitespace**: Introduced dedicated `.filter-badge-prefix` / `.summary-filter-pill-prefix` styling and `gap: 0.38rem` between "Category:" and the category name for clean readability.

### 3.13 Modular Skeletal Loading Component System ([`src/component/skeletons/`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/))
- **Dedicated Skeletons Directory**: Modularized all page skeleton components into `buck/src/component/skeletons/`:
  - [`ExpensesSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/ExpensesSkeleton.tsx): 1:1 match of the loaded Expenses page (3 KPI cards, 7-segment category allocation bar, 8 filter chips, and 2-column form/tracker workspace).
  - [`HomeSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/HomeSkeleton.tsx): Left-aligned legend, 290px canvas container, bar chart with vertical Amount (₱) scale.
  - [`WalletSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/WalletSkeleton.tsx): 2-column grid with active wallet card (emerald status badge) and history panel.
  - [`GoalsSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/GoalsSkeleton.tsx), [`StatisticsSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/StatisticsSkeleton.tsx), [`SettingsSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/SettingsSkeleton.tsx), [`FinancialAdvisorSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/FinancialAdvisorSkeleton.tsx), [`ForecastSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/ForecastSkeleton.tsx), [`AdminSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/AdminSkeleton.tsx).
  - [`index.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/index.tsx): Central router dispatcher and component exports.
  - [`skeletons.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/skeletons.css): Dedicated stylesheet defining card containers, surface colors, borders, shadows, shimmer keyframes, and responsive grid layouts.
- **Root Proxy Compatibility**: Refactored [`DashboardSkeletons.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/DashboardSkeletons.tsx) to re-export all skeletons from `@/component/skeletons`, ensuring zero broken imports across Next.js route boundaries.

### 3.14 Pie Chart Dynamic Slice Zooming, Tooltip Color Authenticity & Anti-Clipping Callouts ([`WeeklyPieChart.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/WeeklyPieChart.tsx), [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css), [`HomeSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/HomeSkeleton.tsx), [`skeletons.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/skeletons.css))
- **Dynamic Slice Zoom Engine**:
  - Registered `PieController` in Chart.js and monkey-patched `PieController.prototype.updateElements` to support `outerRadiusMultipliers` on pie datasets.
  - Active slice receives `outerRadiusMultipliers: 1.02` (zoomed in / expanded) and `offset: 14` (popped outward).
  - Unselected slices receive `outerRadiusMultipliers: 0.85` (zoomed out / shrunk inward by 15%) and `offset: 0`.
  - Chart.js interpolates radius and offset values using its native animation system with duration $380\text{ms}$ and `easeOutQuart` cubic-bezier easing.
- **Authentic Tooltip Hover Color Box**:
  - Implemented `plugins.tooltip.callbacks.labelColor` returning `{ borderColor: slice.color, backgroundColor: slice.color, borderWidth: 1, borderRadius: 2 }`.
  - Guarantees the hover color square indicator always displays the true, vibrant category color even when unselected slices are dimmed on the chart canvas.
- **Bidirectional Anti-Clipping Callout Engine**:
  - **Vertical Bounds Clamping**: Set `minY = 30` and `maxY = chart.height - 30`, ensuring top category names (at $Y - 8$) and bottom percentages (at $Y + 9$) maintain $> 15\text{px}$ margin from the top and bottom canvas edges.
  - **Horizontal Bounds Clamping**:
    - Left callouts (`!isRight`): Measures `neededWidth = Math.max(textWidth, pctWidth)`. If `safeTextX - neededWidth < 8`, clamps `safeTextX = neededWidth + 8` and shifts shelf connection `endX = Math.min(kneeX, safeTextX + 6)`.
    - Right callouts (`isRight`): If `safeTextX + neededWidth > width - 8`, clamps `safeTextX = width - 8 - neededWidth` and shifts shelf connection `endX = Math.max(kneeX, safeTextX - 6)`.
  - **Universal Canvas 2D Fonts**: Standardized font declarations to `bold 13px system-ui, -apple-system, sans-serif` and `bold 15px system-ui, -apple-system, sans-serif`.
  - **1:1 Geometry Parity**: Expanded canvas box to $310\text{px}$ height and optimized legend width to $250\text{px}$ in both `home/style.css` and `HomeSkeleton.tsx` / `skeletons.css`.

### 3.15 Dashboard Card Grid Rebalance, Compact Legend Centering, & Bar Graph Axis Geometry ([`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css), [`HomeSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/HomeSkeleton.tsx), [`skeletons.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/skeletons.css))
- **Grid Rebalance**: Updated `.dashboard-content` and `.home-skeleton-content` to `minmax(0, 0.94fr) minmax(0, 1.06fr)`, shifting $60\text{px}$–$80\text{px}$ of width to the Bar Graph card.
- **Bar Graph Spacing & Lower Alignment**:
  - Set `.graph-card` to `display: flex; flex-direction: column; justify-content: space-between; gap: 1.25rem; min-height: 420px; padding: 1.5rem;` matching `.spending-card` and `.summary-card`.
  - Moved `.graph-container` lower in the card with `margin-top: auto; margin-bottom: 0.35rem;`, aligning the bottom axis footer horizontally with the pie chart's center summary baseline.
  - Increased Y-axis title spacing (`gap: 0.75rem; padding-right: 0.35rem;`).
  - Standardized height to $250\text{px}$ across `.graph-y-axis-wrap`, `.graph-axis`, and `.graph-bars`.
  - Removed excessive `.graph-bars` bottom padding (`padding: 0.5rem 0 0`) and tightened `.graph-x-axis-footer` to `margin-top: 1.75rem`, placing `Day of the Week` just $5\text{px}$–$7\text{px}$ below day tick abbreviations.
- **1:1 Skeleton Parity**: Synchronized `HomeSkeleton` and `skeletons.css` with identical $250\text{px}$ graph height, $0.75\text{rem}$ Y-axis gap, and lowered chart placement.

### 3.16 Leftmost Legend Container Spacing Parity & Full-Sized Pie Chart Preservation ([`WeeklyPieChart.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/WeeklyPieChart.tsx), [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css), [`HomeSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/HomeSkeleton.tsx), [`skeletons.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/skeletons.css))
- **Leftmost Legend Container Spacing Parity**:
  - Replaced `justify-content: center` with `justify-content: space-between; gap: clamp(1rem, 2vw, 2.25rem);` on `.spending-pie-layout` and `.home-skeleton-pie-layout`.
  - Pins the category filter pillbox stack (`.spending-pie-legend`) to the absolute leftmost edge of the card content box, flush with the card's `1.5rem` internal padding and vertically aligned directly under "CATEGORY SPENDING" and "Category Breakdown".
  - Restores uniform container padding parity across all dashboard cards (`.spending-card`, `.graph-card`, `.summary-card`, `.ai-advisor-card`).
- **Full-Sized Pie Chart Restoration (No Shrinking)**:
  - Re-calibrated `.dashboard-content` grid ratio to `minmax(0, 1.12fr) minmax(0, 1fr)`.
  - Expanded `.spending-pie-canvas-box` to `flex: 1 1 auto; width: 100%; max-width: 480px; min-height: 330px;` and `.spending-pie-canvas-inner` to `height: 320px;`.
  - Set `chartOptions.layout.padding` to `top: 32, bottom: 32, left: 65, right: 65` in `WeeklyPieChart.tsx`, restoring the pie chart to its full, prominent diameter (~230px–240px).
  - Expanded callout horizontal boundary buffers (`chart.width - endX - 10` and `endX - 8`) in `excelDataCalloutPlugin`, ensuring long labels like "Transportation 17%" render completely without clipping.
- **1:1 Skeletal Loading Parity**:
  - Updated `skeletons.css` (`1.12fr / 1fr` grid, `justify-content: space-between`, `max-width: 480px` canvas box) and `HomeSkeleton.tsx` ($220\text{px}$ skeleton circle) to guarantee zero CLS.

### 3.17 Bar Chart Fluid Morphing Transitions, Persistent DOM Nodes & Interactive Tooltips ([`home/page.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/page.tsx), [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css))
- **Hardware-Accelerated Height Transitions**:
  - Configured `.graph-bar` with `transition: height 420ms cubic-bezier(0.16, 1, 0.3, 1), background 350ms ease, background-color 350ms ease, opacity 350ms ease, box-shadow 180ms ease, transform 180ms ease;` and `will-change: height`.
  - When switching category filters, all 7 weekday bars smoothly glide up and down in synchronization with the Pie Chart's 380ms slice animation.
- **Persistent DOM Node Strategy**:
  - Updated `WeeklyBarChart` to keep all 7 day nodes permanently rendered regardless of whether `hasData` is true or false.
  - When filtering to a category with 0 expenses, bars smoothly morph down to 0% height (resting on the 4px baseline pill), preventing DOM destruction and maintaining the visible X-axis day abbreviations.
- **Empty State Overlay**:
  - Rendered `.graph-bars-empty-overlay` with a gentle fade-in animation (`fadeInEmpty 260ms ease-out forwards;`) over the resting bars, keeping the chart frame completely stable.
- **Interactive Floating Tooltips**:
  - Added `.graph-bar-tooltip` to each bar showing exact Philippine Peso amounts (`formatCurrency(item.amount)`), transitioning into view on hover with slight elevation (`translateY(-2px)`).
- **Active Filter Badge Entrance**:
  - Added `animation: fadeInFilterBadge 200ms cubic-bezier(0.16, 1, 0.3, 1)` to `.chart-active-filter-group`.

### 3.18 Y-Axis Header Alignment, Pie Graph Vertical Center Alignment & Callout Clearance Geometry ([`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css), [`WeeklyPieChart.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/WeeklyPieChart.tsx), [`HomeSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/HomeSkeleton.tsx), [`skeletons.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/skeletons.css))
- **Y-Axis Flush Header Alignment**:
  - Removed `padding-right: 0.35rem;` and applied `margin-left: -8px; padding: 0;` to `.graph-axis-title--y` in `home/style.css`.
  - Eliminates the 8px indent caused by rotated padding, bringing the vertical glyph boundary flush with `ALL-TIME SUMMARY` and `Expenses by day` ($X=28$).
  - Increased `.graph-y-axis-wrap` gap to `0.85rem` to preserve breathing room between `AMOUNT (₱)` and numeric scale values.
  - Mirrored `marginLeft: -8, padding: 0, gap: "0.85rem"` in `HomeSkeleton.tsx`.
- **Pie Graph Vertical Center Alignment**:
  - Set `.spending-pie-layout` to `align-items: flex-start;` and `.spending-pie-legend` to `height: 320px; justify-content: center;` in `home/style.css`.
  - Ensures the vertical midpoint of the leftmost pillbox filters ($Y=160\text{px}$) matches the exact center of the pie graph circle ($cy=160\text{px}$) inside `.spending-pie-canvas-inner` ($320\text{px}$ high).
  - Mirrored `.home-skeleton-pie-layout { align-items: flex-start; }` and `.home-skeleton-pie-legend { height: 320px; }` in `skeletons.css`.
- **Callout Clearance & Anti-Squish Engine**:
  - In `WeeklyPieChart.tsx`, increased `kneeDist` from $r + 10$ to $r + 24$ and `shelfLength` from $10$ to $14$.
  - Expanded `chartOptions.layout.padding` to `top: 44, bottom: 44, left: 70, right: 70` and boundary clamping to `minY = 26, maxY = chart.height - 26`.
  - Guarantees $\ge 15\text{px}$ to $44\text{px}$ clearance between slice borders and text, completely eliminating label squishing on top/bottom slices ("Others 5%", "Bills 32%").

### 3.19 Excel-Style Horizontal Broken Grid Lines ([`home/page.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/page.tsx), [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css), [`HomeSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/HomeSkeleton.tsx), [`skeletons.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/skeletons.css))
- **Dashed Grid Line Engine**:
  - Mounted `.graph-grid` (`position: absolute; top: 0.5rem; bottom: 0; left: 0; right: 0; pointer-events: none; z-index: 0;`) inside `.graph-bars`.
  - Rendered 6 horizontal dashed lines (`.graph-grid-line`) at `bottom: 100%`, `83.333%`, `66.667%`, `50%`, `33.333%`, and `16.667%`, precisely matching the Y-axis tick intervals while preserving the solid baseline at 0% (`border-bottom: 1px solid var(--buck-line)`).
  - Styled with `border-top: 1px dashed var(--buck-line); opacity: 0.8;` (dark mode: `border-top-color: rgba(255, 211, 154, 0.24); opacity: 0.9;`).
- **Layering & Interactive Stability**:
  - Configured `.graph-bar` with `position: relative; z-index: 1;` so bars render in front of the grid lines, allowing the broken lines to show through between bars and across empty days.
  - Assigned `.graph-bars-empty-overlay` with `z-index: 5;` and `.graph-bar-tooltip` with `z-index: 10;`.
- **1:1 Skeletal Loading Parity**:
  - Added matching `.graph-grid` container and 6 `.graph-grid-line` items inside `HomeSkeleton.tsx` along with border styles, and mirrored `.graph-grid` in `skeletons.css` to eliminate CLS.

### 3.20 Bar Chart Interactive Day Slicing, Cross-Card Breakdown Synchronization & Enlarged Tooltips ([`home/page.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/page.tsx), [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css))
- **Enlarged Tooltip Typography**:
  - Upgraded `.graph-bar-tooltip` to `font-size: 0.92rem; font-weight: 850; padding: 0.38rem 0.72rem; border-radius: 8px;`.
  - Added `.graph-bar-tooltip-amount` (`font-size: 0.92rem; font-weight: 850; letter-spacing: -0.01em; color: #ffffff;`), ensuring high-contrast legibility when inspecting daily spending.
- **Bar Interactive States & Visual Focus**:
  - Configured `.graph-bar` with `cursor: pointer; will-change: height, transform;` and keyboard event listeners (`Enter`, `Space`, `aria-pressed`, `aria-label`).
  - Implemented `.graph-bar--selected` providing a $4\text{px}$ elevation (`transform: translateY(-4px)`), double-ring outline with `var(--buck-orange)`, and elevated drop shadow.
  - Implemented `.graph-bar--dimmed` (`opacity: 0.42`) applied to non-selected bars when a day is focused.
- **Cross-Card Day Slicing Engine**:
  - Added `selectedDay` state in `Dashboard` (`home/page.tsx`).
  - Implemented `matchesDayFilter(expense, selectedDay, timeframe)` resolving calendar dates for `"week"` (using `getCurrentWeekRange()`) and weekday indices for `"month"` and `"all"` (using `jsDayToWeekDaysIndex`).
  - Derived `dayFilteredExpenses` memo: filters `pieExpenses` by `matchesDayFilter`.
  - Routed `dayFilteredExpenses` into `getCategoryPieData`, dynamically calculating category slices, totals, and percentages for that day in the "Category Breakdown" Pie Chart. Center label dynamically updates to `Total on [Day]`.
  - Routed `dayFilteredExpenses` into `summaryData`, providing category items and tailored day descriptions (`Spending under [Category] on [Day]`) in the "Financial Summary" card.
- **Sibling Filter Badges & Adjacent Title-Row Alignment (ADR-021 Compliance)**:
  - Enclosed `<h2 className="graph-title">Expenses by day</h2>` and the active filter badge group inside `<div className="summary-title-row">` inside `.card-heading`, positioning Category and Day filter badges directly adjacent to the title with a clean `0.75rem` gap matching Financial Summary.
  - Rendered clearable `Day: [DayName]` and `Category: [CategoryName]` badges as sibling elements in the Bar Chart card header, Category Breakdown card header, and Financial Summary card header (`chart-active-filter-badge` + `filter-clear-btn`, `summary-filter-pill` + `summary-filter-action-btn`).

### 3.21 Category-Only Pillbox Legend, Micro-Interaction Animation Engine & Interactive "All" State ([`WeeklyPieChart.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/WeeklyPieChart.tsx), [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css), [`HomeSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/HomeSkeleton.tsx), [`skeletons.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/skeletons.css))
- **Category-Only Content Streamlining**:
  - Removed amounts (`formatCurrency(displayAmount)`) and percentage badges from each pillbox in `WeeklyPieChart.tsx`.
  - Streamlined `.spending-pie-legend-item` to contain solely `.spending-pie-legend-dot` and `.spending-pie-legend-name`.
  - Slimmed `.spending-pie-legend` to `width: fit-content; min-width: 125px; max-width: 160px;`, freeing up ~80px of horizontal space for `.spending-pie-canvas-box` and eliminating callout label crowding.
- **Tactile UX Animations & Micro-Interactions**:
  - Added smooth transition engine: `transition: background 200ms ease, border-color 200ms ease, box-shadow 200ms ease, transform 180ms cubic-bezier(0.16, 1, 0.3, 1), opacity 200ms ease;`.
  - Hover state: delivers a subtle tactile slide (`transform: translateX(4px);`), glowing border (`var(--buck-orange)`), and soft drop shadow (`box-shadow: 0 3px 12px rgba(244, 117, 54, 0.2);`).
  - Active press: applies tactile compression (`transform: translateX(2px) scale(0.97);`) on click.
  - Selected state: holds an elevated position (`transform: translateX(4px)`), double-ring outline with `var(--buck-orange)`, bold typography (`font-weight: 700`), and dot glow (`box-shadow: 0 0 7px currentColor`).
  - Dimmed state: lowers unselected pill opacity to `0.45` with hover recovery to `0.88`.
- **Symmetric & Interactive "All" Option**:
  - Made the "All" pill button dynamically reactive: renders `.spending-pie-legend-item--selected` when `!selectedCategory`, and `.spending-pie-legend-item--dimmed` when a specific category is selected.
  - Clicking "All" calls `onSelectCategory?.(null)`, smoothly resetting pie slices and bar chart filters back to all categories.
- **1:1 Skeletal Loading Parity**:
  - Updated `HomeSkeleton.tsx` and `skeletons.css` to render streamlined single-line pill representations (`min-width: 125px; max-width: 160px;`) with matching 34px pill heights, ensuring zero layout shift.

### 3.22 Uniform Human-Friendly Y-Axis "Nice Scale" Engine for Bar Graph Data Visualization ([`home/page.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/page.tsx))
- **"Nice Numbers" Algorithm Engine (`computeNiceYAxis`)**:
  - Implemented `computeNiceYAxis(rawMax)` computing standard human-friendly scale intervals using candidate multipliers ($1, 2, 2.5, 5, 10 \times 10^{\text{magnitude}}$).
  - Evaluates tick counts targeting 4 to 7 intervals, guaranteeing every adjacent tick difference is strictly identical ($\text{tick}[i] - \text{tick}[i+1] \equiv \text{step}$) with zero decimal rounding jitter.
  - Automatically adapts across dataset scales (e.g., ₱61,590 $\rightarrow$ uniform ₱10k step up to ₱70k; ₱35,200 $\rightarrow$ uniform ₱10k step up to ₱40k; ₱18,400 $\rightarrow$ uniform ₱5k step up to ₱20k; ₱2,800 $\rightarrow$ uniform ₱500 step up to ₱3k).
- **Synchronized Grid Lines & Proportional Geometry**:
  - Dynamically renders `yAxis.count` horizontal dashed grid lines positioned at `bottom: ${((yAxis.count - i) / yAxis.count) * 100}%` directly matching each tick mark.

### 3.23 Unified Narrow Outer Edge Spacing & Screen-Size Optimization Architecture ([`dashboard.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/dashboard.css), [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css), [`expenses/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/expenses/style.css), [`settings/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/settings/style.css), [`goals/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/goals/style.css), [`statistics/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/statistics/style.css), [`financial-advisor/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/financial-advisor/style.css), [`forecast/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/forecast/style.css), [`admin/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/admin/style.css), [`skeletons.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/skeletons.css))
- **Standardized Fluid Outer Gutters (`clamp(0.75rem, 1.5vw, 1rem)`)**:
  - Replaced legacy `clamp(1rem, 2.6vw, 1.6rem)` outer padding with `clamp(0.75rem, 1.5vw, 1rem)` across **all 9 dashboard views** (`home`, `expenses`, `wallet`, `goals`, `statistics`, `settings`, `financial-advisor`, `forecast`, `admin`).
  - Sets outer margins to $12\text{px}$ on mobile ($\le 480\text{px}$) scaling smoothly to $16\text{px}$ on desktop ($\ge 1080\text{px}$), reducing outer gutters by 37.5% and expanding usable width for cards and charts.
- **Streamlined Topbar Geometry (`min-height: 58px`)**:
  - Reduced `.dashboard-topbar` minimum height from 76px to 58px and vertical padding to `clamp(0.5rem, 0.9vw, 0.65rem)` in `dashboard.css`.
  - Harmonized horizontal padding to `clamp(0.75rem, 1.5vw, 1rem)`, creating pixel-perfect flush alignment between topbar headers/pills and card bounds.
  - Slashed the vertical separation between topbar text and top cards from ~41.6px down to ~22px–26px.
- **Sidebar Proportions Optimization (`minmax(220px, 250px)`)**:
  - Refined `.dashboard` column grid to `minmax(220px, 250px) minmax(0, 1fr)`.
- **Statistics Tab Spacing Cleanup**:
  - Reduced `marginTop` above selectors in `statistics/page.tsx` from `2.5rem` (40px) to `0.5rem` (8px).
  - Defined explicit `.dashboard-container` class in `statistics/style.css` with unified padding and gap rules.
### 3.24 Category Breakdown Day Filter Placement Underneath Title, Timeframe Center Alignment & Zero-CLS Header Stabilization Architecture ([`home/page.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/page.tsx), [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css), [`HomeSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/HomeSkeleton.tsx), [`skeletons.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/skeletons.css))
- **Day Filter Placement Underneath Title (`.pie-day-filter-slot`)**:
  - Moved the active Day filter group (`chart-active-filter-group`) containing `.chart-active-filter-badge` and `.filter-clear-btn` out of the horizontal title row into a dedicated container (`.pie-day-filter-slot`) positioned directly underneath `<h2 className="spending-card-title">Category Breakdown</h2>` in [`home/page.tsx:806-833`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/page.tsx#L806-L833).
  - Styled `.pie-day-filter-slot` with `min-height: 28px; display: flex; align-items: center; margin-top: 0.35rem;` in [`home/style.css:198-203`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css#L198-L203).
- **Zero-CLS Fixed Header Height Stabilization (`min-height: 78px`)**:
  - Assigned `.spending-card-header .card-heading` an explicit `min-height: 78px; flex: 0 0 auto; min-width: 140px; max-width: 260px;` in [`home/style.css:187-196`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css#L187-L196).
  - Because 78px is reserved regardless of whether `selectedDay` is active or null, the header height is constant ($78\text{px} \equiv 78\text{px}$), completely eliminating the downward push/jump on the pie chart and achieving 0px Cumulative Layout Shift (CLS = 0).
- **Symmetric Center Alignment of Timeframe Toggle Above Pie Graph**:
  - Enclosed the timeframe pill buttons (`[All Time | This Month | This Week]`) in `.spending-timeframe-container` with `display: flex; align-items: center; justify-content: center; flex: 1 1 auto; max-width: 480px; min-height: 38px;` in [`home/style.css:205-211`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css#L205-L211).
  - Configured `.spending-card-header` with `display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: clamp(1rem, 2vw, 2.25rem); width: 100%;` in [`home/style.css:177-185`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css#L177-L185).
  - Matching the 480px max-width boundary of `.spending-pie-canvas-box` ensures the toggle group sits on the exact horizontal center-line ($X_{\text{toggle}} \equiv X_{\text{pie}}$) directly over the pie canvas circle.
- **Responsive Geometry at $\le 680\text{px}$**:
  - Configured `@media (max-width: 680px)` in [`home/style.css:432-449`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css#L432-L449) to stack `.spending-card-header` vertically (`flex-direction: column; align-items: stretch; gap: 1rem;`), reset `card-heading` to `min-height: auto; max-width: 100%;`, and center `.spending-timeframe-container` across 100% width, matching `.spending-pie-layout`'s mobile stacking.
- **1:1 Skeletal Loading Parity**:
  - Synchronized [`HomeSkeleton.tsx:20-33`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/HomeSkeleton.tsx#L20-L33) to use `.spending-card-header`, `.card-heading` with `.pie-day-filter-slot`, and `.spending-timeframe-container`.
  - Updated `.home-skeleton-content` in [`skeletons.css:315-320`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/skeletons.css#L315-L320) to `grid-template-columns: minmax(0, 0.94fr) minmax(0, 1.06fr);` matching `.dashboard-content`.

---

## 4. Hardcoded System Constraints & Edge Cases

| Area | Constraint / Boundary | Code Reference |
|---|---|---|
| **Admin Privilege** | Hardcoded to email `buckthebudgettracker@gmail.com` | [`middleware.ts:378`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/middleware.ts#L378), [`admin/supabase/route.ts:20`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/admin/supabase/route.ts#L20), [`admin/vercel/route.ts:20`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/admin/vercel/route.ts#L20) |
| **Avatar Uploads** | Maximum size: 2,097,152 bytes (2 MB); MIME types: `image/jpeg`, `image/png`, `image/webp` | [`supabaseData.ts:75`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L75) |
| **Account Recovery** | Fixed 10-day recovery window (`RECOVERY_WINDOW_DAYS = 10`) | [`account/delete/confirm/route.ts:7`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/account/delete/confirm/route.ts#L7) |
| **Deletion Confirm** | Strict uppercase string match `"DELETE"` | [`deletion/request/route.ts:14`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/account/deletion/request/route.ts#L14) |
| **Rate Limiting** | Max 8 password resets per IP per 15 min; 40 per IP per 24 hr; 5 per email per 1 hr; 60s email cooldown | [`password-reset/route.ts:45-51`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/auth/password-reset/route.ts#L45-L51) |
| **Modal Bounds** | Desktop max width: `min(880px, 100%)`, max height: `min(82dvh, 760px)` | [`globals.css:780`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/globals.css) |
| **Currency Token** | Hardcoded to Philippine Peso (`PHP`, `₱`) across UI formatters and AI prompts | [`formatters.ts:4`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/formatters.ts#L4), [`ai_models.py:123`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/BuckAI_Backend/ai_models.py#L123) |
| **Toast Queue** | Maximum 4 concurrent toasts; default duration 4,000ms; viewport offset top-right 24px (mobile top-center 16px) | [`ToastContext.tsx:14`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/toast/ToastContext.tsx#L14), [`toast.module.css:4-16`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/toast/toast.module.css#L4-L16) |
