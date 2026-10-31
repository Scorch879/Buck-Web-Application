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
| `MFA_RECOVERY_SECRET` | Server Only | **Yes (production)** | HMAC key for 2FA backup-code hashes (ADR-048). Changing it invalidates every issued backup code. |
| `MFA_EMAIL_RECOVERY_DELAY_HOURS` | Server Only | Optional | Default: `24`. Cool-off between confirming a 2FA email recovery and 2FA removal; production never goes below 24. |
| `ADMIN_REQUIRE_MFA` | Server Only | Optional | `true` forces admins to enroll 2FA before `/dashboard/admin` and `/api/admin/*`. Default off. |
| `NEXT_PUBLIC_SESSION_IDLE_TIMEOUT_MINUTES` | Client & Server | Optional | Default: `30`. Minutes of inactivity before auto sign-out. |
| `NEXT_PUBLIC_SESSION_WARNING_SECONDS` | Client Only | Optional | Default: `60`. Seconds before timeout to display the session expiration countdown modal. |
| `ACCOUNT_PURGE_SECRET` | Server Only | Optional | Bearer token required to trigger `/api/account/deletion/purge`. |
| `CRON_SECRET` | Server Only | Optional | Bearer token required to trigger `/api/cron/generate-insights` from Vercel Cron. |
| `SUPABASE_MANAGEMENT_TOKEN` | Server Only | Optional | Access token for Supabase Management API (used in Admin logs). |
| `SUPABASE_PROJECT_REF` | Server Only | Optional | Project reference ID for Supabase logs endpoint. |
| `VERCEL_ACCESS_TOKEN` | Server Only | Optional | Vercel API token for deployment metrics. |
| `VERCEL_PROJECT_ID` | Server Only | Optional | Vercel project ID for deployment monitoring. |

### 1.2 Buck_AI Service (`Buck_AI/.env`, or Vercel project settings)

| Variable Name | Scope | Required | Description |
|---|---|---|---|
| `GEMINI_API_KEY` | Buck_AI only | **Yes** for AI | Google AI Studio key. Without it the Advisor serves rule-based advice. |
| `GEMINI_MODEL` | Buck_AI only | Optional | Default `gemini-3.8-flash`. |
| `GEMINI_MODELS` | Buck_AI only | Optional | Comma-separated chain (overrides `GEMINI_MODEL`). Leave unset for the built-in 11-model chain in `Buck_AI/shared/config.py` (9 Gemini Flash models, then 2 Gemma). On 404/429/500/503/504 or no answer within 8 s Buck_AI tries the next model; each has its own capacity and free quota (about 20 requests a day). Models out of daily quota are skipped until their retry delay passes (max 1 h per instance). A single model gets one retry. |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Buck_AI only | **Yes** | Same public values as the web app; queries run as the user under RLS. |
| `ALLOWED_ORIGINS` | Buck_AI only | **Yes** in prod | Comma-separated web origins for CORS (mobile needs none). |
| `NEXT_PUBLIC_BUCK_AI_URL` | Web (public) | **Yes** in prod | Buck_AI base URL; default `http://localhost:8000`. Also added to the CSP. |

Zero cost: Gemini API free tier with no billing account (over-quota calls get 429 and the Advisor serves rule-based advice), Vercel Hobby for both projects, Supabase Free. On the free tier Google may use prompts to improve its products; Buck_AI sends only PII-scrubbed numbers.

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

### 2.2 Buck_AI Setup

```bash
cd Buck_AI
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements-dev.txt
copy .env.example .env
uvicorn main:app --reload --port 8000
```

Deploy: create a second Vercel project from this repo with Root Directory `Buck_AI`, set its env vars, then set `NEXT_PUBLIC_BUCK_AI_URL` on the web project.

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
  - `ForecastSkeleton` (ADR-052 page): `.forecast-hero` with the 30/60-day toggle and Refresh, the chart panel (legend, Daily/Cumulative toggle, chart box), the month panel (3 stats), 5 category cards, 3 wallet cards, the goal and habits panels, and the explanation and warnings cards in `.forecast-ai-grid`. The rule-engine fallback (Buck_AI unreachable) still renders the 3 `.advisor-grid` cards and 2 wide cards.
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

### 3.25 Dashboard Topbar Bottom Spacing Relaxation & Typography Clearance Architecture ([`dashboard.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/dashboard.css))
- **Relaxed Asymmetric Padding Engine**:
  - Replaced tight `padding: clamp(0.5rem, 0.9vw, 0.65rem) clamp(0.75rem, 1.5vw, 1rem)` with `clamp(0.7rem, 1.1vw, 0.85rem) clamp(0.75rem, 1.5vw, 1rem) clamp(0.95rem, 1.5vw, 1.25rem)` in [`dashboard.css:158`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/dashboard.css#L158).
  - Bottom padding expands to $20\text{px}$ (`1.25rem`) on desktop, unlocking generous breathing room beneath font descenders and the active wallet pill.
  - Horizontal padding remains locked to `clamp(0.75rem, 1.5vw, 1rem)`, preserving flush alignment with all card containers below.
- **Structural Height Stabilization (`min-height: 68px`)**:
  - Increased `.dashboard-topbar` `min-height` from $58\text{px}$ to $68\text{px}$ in [`dashboard.css:157`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/dashboard.css#L157), accommodating relaxed padding and eliminating layout compression.
- **Typographic Clearance & Vertical Flow**:
  - Added `display: flex; flex-direction: column; gap: 0.18rem;` to `.dashboard-topbar > div:first-child` in [`dashboard.css:192-197`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/dashboard.css#L192-L197), creating ~3px of intentional separation between uppercase eyebrow `<p>` and heading `<h1>`.
  - Relaxed `h1` `line-height` from $1.1$ to $1.18$ in [`dashboard.css:206`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/dashboard.css#L206), eliminating line-box clipping on letters with descenders ('p', 'g', 'y', 'q').
- **Responsive Tablet & Mobile Rules**:
  - Synchronized tablet `@media (max-width: 980px)` to `padding: 0.75rem clamp(0.75rem, 1.5vw, 1rem) 1rem;` in [`dashboard.css:587`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/dashboard.css#L587).
  - Synchronized mobile `@media (max-width: 680px)` to `padding: 0.65rem 0.75rem 0.85rem;` in [`dashboard.css:673`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/dashboard.css#L673).

### 3.26 Financial Summary Tabular Format with Stretched Search, Active Pills, & CustomSelect ([`FinancialSummaryTable.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/FinancialSummaryTable.tsx), [`CustomSelect.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/CustomSelect.tsx), [`home/page.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/page.tsx), [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css), [`HomeSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/HomeSkeleton.tsx))
- **Tabular Category Presentation Component (`FinancialSummaryTable.tsx`)**:
  - Replaced the card-grid (`.summary-content > .summary-item`) with a contained, semantic data table (`<table>`) wrapped in `.summary-table-wrapper` with horizontal scroll capability (`min-width: 660px`).
  - Columns:
    - **Category**: Category color indicator dot, category name, and an active badge when filtered.
    - **Description**: Human-readable spending description for the category.
    - **Entries**: Transaction count badge (`{count} entries`).
    - **Share %**: Horizontal progress track (`.summary-share-track`) with fill percentage and formatted percentage label (`{percentage.toFixed(1)}%`).
    - **Total Spent**: Right-aligned, formatted currency (`formatCurrency(item.amount)`) in bold tabular numbers.
    - **Action**: Interactive button toggling category selection (`Filter` / `Active ✓`).
- **Contained Height & Client-Side Pagination (`PAGE_SIZE = 5`)**:
  - Enforced a 5-item page size to keep table height strictly bounded (~260px–290px), completely preventing vertical dashboard elongation even with 20+ user categories.
  - Rendered pagination controls in `.summary-table-pagination` with entry range counter (`Showing 1–5 of 16 categories`), `‹ Prev` button, individual numeric page buttons, and `Next ›` button.
- **Top Toolbar: Stretched Search, Active Filter Pills, & Design-System CustomSelect**:
  - **Stretched Search Input**: Removed arbitrary `max-width: 420px;` constraint (`flex: 1 1 200px; min-width: 180px;`), stretching the search input to reach the pills and dropdowns and eliminating dead space.
  - **Active Filter Pills Beside Search Bar**: Placed active Day and Category filter pill groups (`• Day: [Name] [✕ All Days]`, `• Category: [Name] [✕ Show All]`) directly in `.summary-table-toolbar` beside the search input, keeping the card header clean.
  - **CustomSelect Dropdowns**: Replaced native browser `<select>` elements with [`CustomSelect.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/CustomSelect.tsx) (`size="sm"`) featuring leading icons (`FaFilter`, `FaSortAmountDown`) and rotating chevrons, eliminating OS-native white-popup styling in dark mode.
  - Filter dropdown (`All Categories`, `Selected Only`, `Top 5 Spending`, `With Expenses Only`).
  - Sort dropdown (`Highest Amount`, `Lowest Amount`, `Name A–Z`, `Name Z–A`, `Most Entries`, `Highest Share %`).
  - Automatic page-reset to 1 on any query or filter transition.
- **Interactive Two-Way Chart Synchronization**:
  - Row click toggles `selectedCategory`, immediately updating `WeeklyPieChart` (zoom/highlight) and `WeeklyBarChart` (daily breakdown) without collapsing the other categories in the table.
  - Sibling header badges (`Category: [Name] [✕ Show All]`, `Day: [Day] [✕ All Days]`) render directly in the table toolbar beside the search input.
- **Clean Active Filter Micro-Interactions & Spring Transitions**:
  - **Framer Motion PopLayout (`AnimatePresence mode="popLayout"`)**: Mounted filter pills render with `<motion.div initial={{ opacity: 0, scale: 0.88, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.88, y: -4 }} transition={{ type: "spring", stiffness: 480, damping: 28 }}>`, ensuring spring-loaded pop entrances and smooth layout reflow of adjacent search and dropdown controls.
  - **Clean Static Accent Styling**: Active filter pills utilize crisp, solid accent borders (`1px solid rgba(244, 117, 54, 0.42)`) and translucent orange backgrounds (`rgba(244, 117, 54, 0.12)` light / `0.16` dark) with a solid, sharp 8px color indicator dot, avoiding distracting looping/blinking animations or neon halos.
  - **Tactile Clear Button Micro-Physics**: Sibling clear buttons (`.summary-filter-action-btn`) feature an orange gradient, hover lift (`translateY(-1.5px) scale(1.02)`), and active click compression (`scale(0.95)`).
- **1:1 Skeletal Loading Parity (`HomeSkeleton.tsx`)**:
  - Replaced 4-card skeleton with matching tabular structure (stretched search box skeleton, dropdown skeletons, 5 table row skeletons, and pagination skeleton), guaranteeing 0px Cumulative Layout Shift (CLS = 0).

### 3.27 Goal Progress Gauge Dual-Layer Liquid Wave Effect Architecture ([`ProgressBarCard.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/goals/ProgressBarCard.tsx), [`progress-bar.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/goals/progress-bar.css))
- **Mathematical Seamless Sine Wave Generation**:
  - Constructed two 2-period repeating sine wave paths across a 280px ribbon (140px wavelength matching the 140px porthole diameter):
    - **Front Wave** (`d="M 0 0 C 20 -6, 50 -6, 70 0 C 90 6, 120 6, 140 0 C 160 -6, 190 -6, 210 0 C 230 6, 260 6, 280 0 L 280 180 L 0 180 Z"`): Fills with warm linear gradient (`#ffb03a` $\rightarrow$ `#f47536` $\rightarrow$ `#d9381e`).
    - **Back Wave** (`d="M 0 -2 C 25 3, 45 3, 70 -2 C 95 -7, 115 -7, 140 -2 C 165 3, 185 3, 210 -2 C 235 -7, 255 -7, 280 -2 L 280 180 L 0 180 Z"`): Offset phase with translucent coral fill (`rgba(244, 117, 54, 0.45)` $\rightarrow$ `rgba(168, 40, 15, 0.7)`).
    - **Surface Gleam Line** (`d="M 0 0 C 20 -6, 50 -6, 70 0 C 90 6, 120 6, 140 0 C 160 -6, 190 -6, 210 0 C 230 6, 260 6, 280 0"`): Renders a 1.5px semi-transparent white curve (`rgba(255, 255, 255, 0.45)`) simulating fluid surface tension.
- **Framer Motion Dynamic Liquid Level Transition**:
  - Encapsulated liquid paths in `<motion.g animate={{ y: targetY }} transition={{ type: "spring", stiffness: 65, damping: 16, mass: 0.9 }}>`.
  - Calculates $Y = 148 - (progressPercentage / 100) \times 156$, accurately mapping $0\%$ to $Y = 148$ (empty), $50\%$ to $Y = 70$ (exact geometric center), and $100\%$ to $Y = -8$ (completely filled).
  - Integrates `useReducedMotion()` to safely lock wave sloshing when reduced motion is preferred by the user.
- **Continuous Hardware-Accelerated Parallax Sloshing**:
  - Front wave translates horizontally `0px` $\rightarrow$ `-140px` over 3.1s linear infinite (`will-change: transform`).
  - Back wave translates horizontally `-140px` $\rightarrow$ `0px` over 4.6s linear infinite, creating rich volumetric depth without layout reflows.
- **Visual Depth & Typography Parity**:
  - Bound within SVG `<clipPath>` (`r=66`) with an outer ring border (`strokeWidth=4`) and inner shadow (`box-shadow: inset 0 3px 12px rgba(0,0,0,0.4)`).
  - Floating centered typography displays "SAVED" and percentage with multi-tier drop shadows, and automatic high-contrast fallback (`.progress-liquid-text--low-progress`) in light mode.

### 3.28 Expenses Dashboard 2-Column Asymmetric Layout & Overlay Modal Architecture ([`page.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/expenses/page.tsx), [`AddExpenseModal.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/expenses/AddExpenseModal.tsx), [`style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/expenses/style.css), [`ExpensesSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/ExpensesSkeleton.tsx))
- **Asymmetric 2-Column Grid Geometry**:
  - Reorganized `.expenses-page` to `display: grid; grid-template-columns: minmax(320px, 360px) minmax(0, 1fr); gap: var(--space-4, 1rem); align-items: start;`.
  - Column 1 (Left): `<ExpenseKPICards />` (`display: flex; flex-direction: column; width: 100%; gap: var(--space-4, 1rem);`) rendering Active Wallet Balance with status badge/progress meter, Cumulative Total Tracked with monthly and daily stat grid, and Average Expense card with min/max values.
  - Column 2 (Right): `<section className="expenses-card expenses-list">` occupying all remaining space, housing the header, search/sort toolbar, transaction rows, pagination controls, and empty state handlers.
  - Responsive Breakpoint: Mobile/tablet `@media (max-width: 980px)` collapses grid to `grid-template-columns: 1fr;`.
- **Standalone Add Expense Overlay Modal (`AddExpenseModal.tsx`)**:
  - Extracted the inline expense form into a dedicated modal rendered via React portal (`createPortal`) on `document.body` with body scroll locking.
  - Features backdrop blur (`rgba(0, 0, 0, 0.65)`, `backdrop-filter: blur(8px)`), accessible `Escape` key dismiss listener, and backdrop click handler.
  - Framer Motion animation (`initial={{ opacity: 0, scale: 0.94, y: 16 }}`).
  - Form controls: amount input with quick-add chips (`+50`, `+100`, `+200`, `+500`, `+1000`), budget exhaustion warning (`Budget will be depleted by ₱...`), [`CustomSelect`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/CustomSelect.tsx) category picker, [`CustomDatePicker`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/CustomDatePicker.tsx), and description input.
  - Records the expense and debits the active wallet in one transaction via `addExpenseWithWalletDeduction`, which calls the `add_expense_atomic` RPC ([`202610130001_add_expense_atomic.sql`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/supabase/migrations/202610130001_add_expense_atomic.sql); conditional `UPDATE ... WHERE budget >= amount` row-locks the wallet). The modal resets its fields only on open, validates amounts with `parseMoneyInput` (max 12 digits, 2 decimals, quick-add in 2-decimal rounding), uses local-time dates (`toLocalDateString`), moves focus to the amount field and restores it on close. The success toast and `onClose` fire before `onExpenseAdded`, so a failed list refresh shows a separate "Saved, but the list failed to refresh" toast instead of a false save error. Page changes animate via `pageDirection` and honour `prefers-reduced-motion`.
- **Top Header Trigger Button (`.expenses-add-trigger-btn`)**:
  - Integrated into `.expenses-list-header-actions` alongside `.expenses-list-count-badge`.
  - Styled with Buck primary orange/coral gradient (`linear-gradient(135deg, var(--buck-orange), #ff9858)`), subtle box shadow, and tactile micro-interactions (`whileHover={{ scale: 1.02 }}`, `whileTap={{ scale: 0.97 }}`).
- **Category Spending Allocation Visualizer (`ExpenseCategoryVisualizer.tsx`) as Top Primary KPI**:
  - Re-anchored `<ExpenseCategoryVisualizer />` at the very top of `.expenses-page` spanning full-width (`grid-column: 1 / -1; width: 100%`) as the primary top KPI card above both the left KPI cards column and right Expense Tracker column.
  - **Thicker Clickable Segmented Bar Track**: Increased bar track height from 10px to 24px (`height: 24px; border-radius: 8px; padding: 2px;`) providing an accessible click and touch target. Each segment has tactile hover feedback (`transform: scaleY(1.08); filter: brightness(1.15)`), active focus highlights (`box-shadow: 0 0 0 2px var(--buck-surface), 0 0 0 4px var(--buck-orange)`), and dimming of unselected slices (`opacity: 0.32; filter: grayscale(30%)`). Segments implement full keyboard accessibility (`role="button"`, `tabIndex={0}`, `aria-label`, `aria-pressed`).
  - **Streamlined Chart Legend (`.expenses-category-legend`)**: Replaced bulky pillbox buttons and counter badges with an elegant chart legend. Each item (`.expenses-legend-item`) features a category color dot (`.expenses-legend-dot`), category label (`.expenses-legend-name`), and percentage share (`.expenses-legend-pct`).
  - **Interactive Cross-Filtering**: Clicking either a bar segment or a legend item toggles category filtering in the Expense Tracker table below (`onSelectCategory`). When active, an inline clear button (`.expenses-category-clear-btn`, `Clear filter ({category})`) appears in the visualizer header, and clicking the active item again resets the filter.
- **Design System CustomSelect Integration**:
  - Replaced native browser `<select>` in `.expenses-sort-box` with [`CustomSelect.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/CustomSelect.tsx) (`size="sm"`), equipped with leading `FaSortAmountDown` icon, animated chevron indicator, and dark-mode aware popover (`#17100c` dark / `#fffaf6` light background, `rgba(244, 117, 54, 0.18)` selection highlight).
- **Centered Windowed Pagination System (`.expenses-pagination`)**:
  - Replaced the previous "Show all" expand button with a centered pagination navigation system.
  - Enforces a fixed page size of 8 items (`PAGE_SIZE = 8`) to maintain card height stability.
  - Implemented dynamic page-number windowing with ellipses (`getPaginationPages`) when total pages exceed 7 (e.g. 43 pages for 344 entries):
    - Close to start ($N \le 4$): `[1, 2, 3, 4, 5, "...", totalPages]`
    - Close to end ($N \ge \text{total} - 3$): `[1, "...", total-4, total-3, total-2, total-1, total]`
    - Middle: `[1, "...", N-1, N, N+1, "...", total]`
  - Renders left (`FaChevronLeft`) and right (`FaChevronRight`) navigation arrow buttons with disabled boundary states.
  - Formatted into a responsive 3-column grid (`display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.5rem;`) with an invisible left balancing spacer (`.expenses-pagination-spacer`) keeping navigation buttons dead-center. Displays `Showing {start}–{end} of {total}` on wide screens and compact `{start}–{end} of {total}` on medium screens without overlapping navigation controls.
  - Automatically resets `currentPage` to 1 and `pageDirection` to 0 whenever `searchQuery`, `selectedCategory`, or `sortBy` transitions.
- **Directional Page-Shift Animation & Snug Whitespace Elimination (`.expenses-list-items-container` & `.expenses-pagination`)**:
  - Encapsulated list items within `.expenses-list-items-container` (`overflow: hidden; width: 100%; position: relative;`) with `AnimatePresence mode="wait"` to permanently eradicate the jarring vertical push-up glitch caused by unkeyed item stacking during pagination.
  - Eliminated excessive whitespace chasm beneath the last transaction item by removing the artificial `min-height: 674px` constraint and tightening `.expenses-pagination` (`margin-top: 0.35rem; padding-top: 0.55rem; min-height: 34px;`), elevating the pagination bar cleanly and snugly below the items (~19.2px total gap).
  - Isolated pagination outside the items grid into a dedicated card footer, preventing vertical layout jumping.
  - Re-anchored Framer Motion `<AnimatePresence mode="wait" initial={false} custom={pageDirection}>` to the page container with directional physics (`PAGE_VARIANTS`):
    - Forward page shift ($D = 1$): previous page exits left (`x: -18, opacity: 0`), incoming page slides in from right (`x: 18 -> 0, opacity: 0 -> 1`) in 160ms.
    - Backward page shift ($D = -1$): previous page exits right (`x: 18, opacity: 0`), incoming page slides in from left (`x: -18 -> 0, opacity: 0 -> 1`) in 160ms.
    - Filter/search reset ($D = 0$): clean in-place fade up (`y: 8 -> 0, opacity: 0 -> 1`).
- **1:1 Skeletal Loading Parity (`ExpensesSkeleton.tsx`)**:
  - Updated skeleton DOM with top visualizer placeholder (header, 24px segmented shimmer bar track, and 6-item legend shimmer row), along with the left 3 stacked KPI card skeletons and right tracker table skeleton with Add Spending trigger button placeholder, search/sort toolbar (using `skeleton-input` with exact 175px/38px bounds), `.expenses-list-items-container` wrapper with 8 list item skeletons, and 3-column pagination skeleton (matching Prev/Next buttons, page number blocks, spacer, and range text).
  - Guarantees 0px Cumulative Layout Shift (CLS = 0) during route transitions and hydration.


### 3.29 Buck_AI: AI Financial Advisor on Gemini ([`Buck_AI/`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/Buck_AI/), [`AIChat.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/AIChat.tsx))
- Rationale: Design.md ADR-043. Service guide: `Buck_AI/README.md`.
- **Buck_AI**: `main.py` (FastAPI, CORS, health); `shared/` (`config`, `auth`, `http`, `supabase`, `gemini`, `safety`, `rate_limit`); `BuckAI_Advisor/` (`snapshot`, `fingerprint`, `rules`, `prompts`, `tools`, `service`, `categorize`, `router`); `BuckAI_Forecast/` (placeholder).
- **Web**:
  - New `utils/buckAi.ts`; `advisorApi.ts` and `aiApi.ts` now call Buck_AI.
  - `AIChat` is Advisor-only, with `AIChatSkeleton` for parity.
  - New `utils/goalForecast.ts` (plain math) for the Goals and Statistics charts.
  - CSP allows the Buck_AI origin.
  - Auto-categorize now calls the Advisor (`/advisor/categorize`) from the Categories tab (one batched request of up to 25), Add Expense and the Goals expense modal.
  - `/api/forecast` and the cron are rule-engine only.
- **Removed**: `buck/src/server/ai/`, `/api/ai/*`, `/api/advisor`, `@google/genai`, and the Forecaster chat on the Forecast tab.
- **Verification (2026-10-14)**:
  - Buck_AI: `python -m unittest` 19/19. The tests cover auth, every query sent with the user's token, saving, reuse while data is unchanged, regeneration with the previous advice, small-change tolerance, cooldown, rules fallback, auto-categorize (no invented categories, fallback never offered, AI-down nulls, batch limit), chat SSE and its fallback, validation, rate limits, the tool loop and thought signatures.
  - Web: `vitest` 44/44 and `tsc` clean.
  - Live local run: health OK. Missing and forged tokens get 401 on all Advisor routes; the forged token was rejected by the real Supabase Auth. CORS allows `localhost:3000` and refuses unknown origins.
  - Not yet run with a real `GEMINI_API_KEY` or a signed-in user.

### 3.30 Categories Table Redesign: Windowed Pagination, Consolidated Toolbar with AI Tooltip, Hover Entry Summary, Colorized Share Bars & Animated Inline Rename ([`categories/page.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/categories/page.tsx), [`categories/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/categories/style.css), [`CategoriesSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/CategoriesSkeleton.tsx))
- **Consolidated Toolbar & AI Hover Tooltip**:
  - Removed the standalone `.cat-ai-card` ("Needs a category") card and integrated its action into `.cat-toolbar` inside `.cat-list`.
  - Ordered toolbar controls left-to-right: `.cat-search` (left), animated `+ Add Expense/Income Category` button that morphs into an inline form `.cat-add-inline` via Framer Motion `<AnimatePresence mode="wait">` (middle), and `Auto-categorize with AI` button `.cat-ai-btn` wrapped in `.cat-ai-tooltip-wrap` with count badge `.cat-ai-badge` and Framer Motion hover tooltip `.cat-ai-tooltip` (right).
- **Left-Shifted Column Proportions & Detailed Hover Entries**:
  - Proportioned `.cat-table` columns (`table-layout: fixed`) as `.cat-col-category` (`20%`), `.cat-col-entries` (`19%`), `.cat-col-total` (`11%`), `.cat-col-share` (`24%`, `padding-right: 2.25rem`), and `.cat-col-actions` (`26%`) so `Entries` sits close to `Category` and `Rename` / `Delete` buttons have room to be larger (`min-height: 38px; padding: 0 1rem; font-size: 0.85rem`).
  - Upgraded the `Entries` cell to render `.cat-entries-pill` (`{entries} entries · Avg ₱{avg}`) and a Framer Motion hover summary popover (`.cat-entries-popover`) showing category total, max entry, and up to 4 recent entries with description, date, and amount. Rows 1–2 open the popover downward (`top: calc(100% + 0.5rem)`) to prevent header clipping; rows 3–8 open upward.
- **Non-Bold Total, Share Bar Colorization & Default Badge**:
  - Styled `.cat-amount` with `font-weight: 400` (non-bold).
  - Enlarged `.cat-share-track` (`height: 11px; border-radius: 6px;`) and colorized `.cat-share-fill` and `.cat-share-pct` dynamically via `getShareTier` (`>=20%` dominant coral-red, `>=10%` high orange, `>=6%` moderate amber-gold, `>=3%` low emerald, `>0%` minimal sky-teal, `0%` muted neutral), animated with Framer Motion.
  - Replaced the `"Fallback"` badge on `Uncategorized` / `Other` with `"Default"`.
- **Animated Inline Rename & Centered Windowed Pagination**:
  - Clicking `Rename` animates `.cat-rename` (`input` + Save `✓` + Cancel `✕`) via Framer Motion `<AnimatePresence mode="wait">` directly inside `.cat-actions` where the `Rename` button resides.
  - Added client-side pagination (`PAGE_SIZE = 8`, `getPaginationPages`, `PAGE_VARIANTS`) with a 3-column `.cat-pagination` footer (centered `< Prev`, page buttons, `Next >`, and right-aligned `Showing X–Y of Z`).
  - Updated [`CategoriesSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/CategoriesSkeleton.tsx) to match the consolidated toolbar, 8-row table, and pagination footer 1:1.


### 3.31 Two-Factor Web UI: Enrol, Verify, Step-Up ([`component/mfa/`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/mfa/), [`verify-2fa/page.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/verify-2fa/page.tsx), ADR-048)
- **Enrol**: remove any `unverified` factors, then `mfa.enroll({ factorType: "totp", friendlyName })`. The QR is an SVG data URL; the CSP `img-src` already allows `data:`. `challengeAndVerify` on the code makes the session aal2. For the first factor only, `POST /api/auth/mfa/recovery-codes` creates the 10 codes. Closing the modal before verifying unenrols the pending factor.
- **Sign-in routing**: after `signInUser` or `signInWithPasskey`, `getAuthenticatorAssuranceLevel()` decides between `redirectTo` and `createMfaVerifyPath(redirectTo)`. The middleware still enforces the same rule if the client check fails.
- **Recovery**: a redeemed backup code or completed e-mail recovery removes every factor on the server. The page then calls `refreshSession()` so the next request is not seen as an old aal1 session with factors.
- **Step-up**: `readActionResponse` in Settings keeps the `error` field. On `403 mfa_step_up_required` the delete form shows `TotpCodeInput`, verifies against the first verified TOTP factor, and resends the same request.
- **Global 401/403**: `MfaRequiredWatcher` patches `window.fetch` once (module flag), only reads a response body for 401s, and redirects once per page load. It does nothing on `/verify-2fa`.
- **Mobile layout**: modals use `.settings-modal--wide` (`min(880px,100%)` × `min(82dvh,760px)`). Rows stack below 560px, the QR stacks above the form below 640px, and every code input uses a 16px+ font so iOS does not zoom.

---

## 4. Hardcoded System Constraints & Edge Cases

| Area | Constraint / Boundary | Code Reference |
|---|---|---|
| **Admin Privilege** | Confirmed account with JWT `app_metadata.role = 'admin'` or email equal to the `ADMIN_EMAIL` env var (fails closed if neither); `feedback` RLS checks the role claim only. The sidebar shows the Admin tab only when the server-resolved `isAdmin` flag is true; the page is gated by middleware, `dashboard/admin/layout.tsx` and the API routes | [`adminAccess.ts`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/adminAccess.ts), [`middleware.ts`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/middleware.ts), [`admin/layout.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/admin/layout.tsx), [`202610120002_admin_rls_role_claim.sql`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/supabase/migrations/202610120002_admin_rls_role_claim.sql) |
| **Avatar Uploads** | Maximum size: 2,097,152 bytes (2 MB); MIME types: `image/jpeg`, `image/png`, `image/webp` | [`supabaseData.ts:75`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/supabaseData.ts#L75) |
| **Account Recovery** | Fixed 10-day recovery window (`RECOVERY_WINDOW_DAYS = 10`) | [`account/delete/confirm/route.ts:7`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/account/delete/confirm/route.ts#L7) |
| **Deletion Confirm** | Strict uppercase string match `"DELETE"` | [`deletion/request/route.ts:14`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/account/deletion/request/route.ts#L14) |
| **Rate Limiting** | Max 8 password resets per IP per 15 min; 40 per IP per 24 hr; 5 per email per 1 hr; 60s email cooldown | [`password-reset/route.ts:45-51`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/api/auth/password-reset/route.ts#L45-L51) |
| **Modal Bounds** | Desktop max width: `min(880px, 100%)`, max height: `min(82dvh, 760px)` | [`globals.css:780`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/globals.css) |
| **Currency Token** | Hardcoded to Philippine Peso (`PHP`, `₱`) across UI formatters and AI prompts | [`formatters.ts:4`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/utils/formatters.ts#L4), [`ai_models.py:123`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/BuckAI_Backend/ai_models.py#L123) |
| **Toast Queue** | Maximum 4 concurrent toasts; default duration 4,000ms; viewport offset top-right 24px (mobile top-center 16px) | [`ToastContext.tsx:14`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/toast/ToastContext.tsx#L14), [`toast.module.css:4-16`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/toast/toast.module.css#L4-L16) |
