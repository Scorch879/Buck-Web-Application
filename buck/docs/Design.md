# Design.md: System Architecture, Data Models & ADRs

This document defines the high-level architecture, database schemas, interaction workflows, directory structure, and Architectural Decision Records (ADRs) for the **Buck Budget Tracker Web Application**.

---

## 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph ClientLayer ["Client Layer (Browser)"]
        LandingPage["Landing Page & Auth\n(React 19 / Next.js 15)"]
        Dashboard["Dashboard Subsystem\n(Home, Expenses, Goals, Wallets, Statistics, Settings, Admin)"]
        SessionMgr["SessionManager\n(Idle Timer + BroadcastChannel)"]
        FramerMotion["Framer Motion Motion & UI Tokens"]
    end

    subgraph AppServer ["Next.js Server Layer (Vercel / Node.js)"]
        Middleware["Next.js Middleware\n(SSR Auth Guard, HMAC Activity Cookie)"]
        RouteHandlers["API Route Handlers\n(/api/auth, /api/account, /api/admin, /api/advisor, /api/forecast)"]
        SSRClient["@supabase/ssr Server Client"]
    end

    subgraph DataLayer ["Supabase Backend (PostgreSQL + Auth + Storage)"]
        PgDB[(PostgreSQL 15 Database\nRLS Protected Tables)]
        SupaAuth[Supabase Auth Engine]
        SupaStorage[Storage Bucket: profile-avatars]
        SupaRealtime[Realtime Replication Channel]
    end

    subgraph AIMicroservice ["AI Microservice (FastAPI on Render)"]
        FastAPIServer[FastAPI Server Engine]
        TogetherAI["Together AI API\n(LLaMA 3.3 70B Turbo)"]
        ProphetModel[Facebook Prophet Time-Series]
        XGBoostMap[Attitude Multiplier Logic]
    end

    ClientLayer <-->|HTTP / SSR Cookies / JSON| AppServer
    ClientLayer <-->|Realtime WebSockets| SupaRealtime
    AppServer <-->|SQL / PostgREST / Admin Service Role| PgDB
    AppServer <-->|JWT / Auth Tokens| SupaAuth
    AppServer <-->|Private Object Stream| SupaStorage
    ClientLayer -.->|Direct AI Invocations| AIMicroservice
    AIMicroservice <-->|Inference Requests| TogetherAI
```

---

## 2. Database Schemas & Entity Relationships

```mermaid
erDiagram
    AUTH_USERS ||--|| PROFILES : "1:1 owns"
    AUTH_USERS ||--o{ WALLETS : "1:N owns"
    AUTH_USERS ||--o{ CATEGORIES : "1:N owns"
    AUTH_USERS ||--o{ GOALS : "1:N owns"
    AUTH_USERS ||--o{ EXPENSES : "1:N owns"
    AUTH_USERS ||--o{ ACCOUNT_DELETION_REQUESTS : "1:N requests"
    
    PROFILES }o--|| WALLETS : "active_wallet_id references"
    EXPENSES }o--o| WALLETS : "wallet_id references"
    EXPENSES }o--o| GOALS : "goal_id references"
    EXPENSES }o--o| CATEGORIES : "category_id references"

    PROFILES {
        uuid id PK
        text username
        text email
        uuid active_wallet_id FK
        text avatar_path
        timestamptz avatar_updated_at
        timestamptz created_at
        timestamptz updated_at
    }

    WALLETS {
        uuid id PK
        uuid user_id FK
        text name
        numeric budget
        timestamptz deleted_at
        timestamptz created_at
        timestamptz updated_at
    }

    CATEGORIES {
        uuid id PK
        uuid user_id FK
        text name
        text color
        text icon
        integer sort_order
        timestamptz created_at
        timestamptz updated_at
    }

    GOALS {
        uuid id PK
        uuid user_id FK
        text goal_name
        numeric target_amount
        numeric current_amount
        text attitude
        date target_date
        boolean is_active
        boolean completed
        text ai_recommendation
        numeric ai_recommended_budget
        timestamptz created_at
        timestamptz updated_at
    }

    EXPENSES {
        uuid id PK
        uuid user_id FK
        uuid wallet_id FK
        uuid goal_id FK
        uuid category_id FK
        text category_name
        numeric amount
        text description
        date spent_on
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
    }

    ACCOUNT_DELETION_REQUESTS {
        uuid id PK
        uuid user_id FK
        text email
        text token_hash
        timestamptz requested_at
        timestamptz confirmation_expires_at
        timestamptz confirmed_at
        timestamptz recovery_until
        timestamptz canceled_at
        timestamptz purge_started_at
        timestamptz created_at
        timestamptz updated_at
    }

    AUTH_SECURITY_EVENTS {
        uuid id PK
        text event_type
        text ip_hash
        text email_hash
        text outcome
        timestamptz created_at
    }

    FEEDBACK {
        uuid id PK
        text user_email
        text category
        text title
        text details
        timestamptz created_at
    }

    AI_FORECASTS {
        uuid id PK
        uuid user_id FK
        uuid goal_id FK
        uuid wallet_id FK
        text period_type
        date period_start
        date period_end
        numeric projected_spending
        numeric projected_savings
        numeric ai_recommended_budget
        jsonb daily_forecast
        numeric actual_spending_snapshot
        text summary
        jsonb warnings
        numeric confidence_score
        text model_name
        text generated_by
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
        timestamptz expires_at
    }

    AI_ADVISORIES {
        uuid id PK
        uuid user_id FK
        uuid wallet_id FK
        uuid goal_id FK
        uuid category_id FK
        text advisory_type
        text title
        text suggestion
        text advice
        integer financial_health_score
        text priority
        boolean is_read
        boolean is_dismissed
        text model_name
        text generated_by
        jsonb metadata
        timestamptz created_at
        timestamptz updated_at
        timestamptz valid_until
    }
```

### Table Definitions & Constraints

1. **`public.profiles`**:
   - `id`: Primary key referencing `auth.users(id)` `ON DELETE CASCADE`.
   - `active_wallet_id`: Foreign key to `public.wallets(id)` `ON DELETE SET NULL`.
   - Trigger `ensure_profile_active_wallet_owner`: Verifies assigned wallet belongs to profile owner.
2. **`public.wallets`**:
   - `budget`: `numeric(14, 2) check (budget >= 0)`.
   - `deleted_at`: Supports soft deletion without violating historical expense foreign keys.
3. **`public.categories`**:
   - Unique index `categories_user_id_lower_name_key` prevents duplicate category names per user.
4. **`public.goals`**:
   - Partial unique index `goals_one_active_goal_per_user_idx` ensures only one goal per user has `is_active = true`.
5. **`public.expenses`**:
   - Trigger `ensure_expense_relations_owner`: Enforces that `wallet_id`, `goal_id`, and `category_id` belong to the same `user_id`.
6. **`public.account_deletion_requests`**:
   - Enforces 10-day recovery window with email confirmation token. Partial index `account_deletion_one_open_request_per_user_idx`.
7. **`public.auth_security_events`**:
   - Private logging table with zero raw IP or email storage. Access revoked from `anon` and `authenticated`.
8. **`public.ai_forecasts`**:
   - Trigger `ensure_ai_forecast_relations_owner`: Enforces that referenced `goal_id` and `wallet_id` belong to the same `user_id`.
   - Stores time-series daily breakdown and projected savings under strict RLS isolation.
9. **`public.ai_advisories`**:
   - Trigger `ensure_ai_advisory_relations_owner`: Enforces that referenced `goal_id`, `wallet_id`, and `category_id` belong to the same `user_id`.
   - Tracks actionable advice, financial health scores, priority levels, and unread/dismissed state under strict RLS isolation.

---

## 3. Core System Data Flows

### 3.1 Authentication & Session Security Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser
    participant Middleware as Next.js Middleware
    participant SupaAuth as Supabase Auth
    participant SM as SessionManager

    User->>Browser: Access /dashboard/*
    Browser->>Middleware: GET /dashboard/home (with Cookies)
    Middleware->>SupaAuth: getUser() with SSR client
    alt Invalid Session / No User
        SupaAuth-->>Middleware: null / error
        Middleware-->>Browser: 307 Redirect to /sign-in?redirectTo=/dashboard/home
    else Valid User
        Middleware->>Middleware: Verify buck-session-activity HMAC
        alt Session Idle > 30 mins
            Middleware-->>Browser: 307 Redirect to /sign-in?reason=session-expired
        else Active Session
            Middleware->>Middleware: Refresh buck-session-activity cookie
            Middleware-->>Browser: 200 OK + Dashboard HTML
            Browser->>SM: Initialize idle timer & BroadcastChannel
        end
    end
```

### 3.2 Expense Logging & Wallet Deduction Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant ExpensesPage as Expenses Page
    participant SupaData as supabaseData.ts
    participant Postgres as Supabase Postgres
    participant Realtime as Supabase Realtime

    User->>ExpensesPage: Submit Expense (Amount: 500, Category: Food)
    ExpensesPage->>SupaData: addExpenseWithWalletDeduction(userId, expense, walletId, currentBudget)
    SupaData->>Postgres: INSERT INTO expenses (user_id, amount, category_id, wallet_id)
    Postgres-->>SupaData: Expense Record Created
    SupaData->>Postgres: UPDATE wallets SET budget = budget - 500 WHERE id = walletId
    Postgres-->>SupaData: Wallet Updated
    Postgres->>Realtime: Broadcast 'INSERT' on expenses & 'UPDATE' on wallets
    Realtime-->>ExpensesPage: Realtime subscription triggers state refresh
    ExpensesPage-->>User: UI updates balance & transaction list instantly
```

---

## 4. Directory Structure

```
Buck-Web-Application/
├── Agents.md                   # AI agent roles and collaboration boundaries
├── Skills.md                   # Machine-readable function and API catalog
├── Design.md                   # Architecture, schemas, flows, and ADRs
├── Implementation.md           # Setup, runtime configs, and execution logic
├── QA_Report.md                # Quality audit, defects, and security tracking
├── README.md                   # Repository overview and entry guide
├── buck/                       # Next.js 15 Web Application
│   ├── BuckAI_Backend/         # Python FastAPI AI microservice
│   │   ├── ai_models.py        # Together AI, Prophet, XGBoost models
│   │   ├── main.py             # FastAPI routing and endpoints
│   │   └── requirements.txt    # Python dependencies
│   ├── docs/                   # Domain-specific UI/Auth documentation
│   ├── public/                 # Static assets (images, SVGs, audio)
│   ├── supabase/
│   │   └── migrations/         # PostgreSQL schema migrations
│   ├── src/
│   │   ├── app/                # Next.js App Router (pages & API routes)
│   │   │   ├── api/            # Server Route Handlers
│   │   │   ├── dashboard/      # Authenticated views (home, expenses, goals, etc.)
│   │   │   ├── globals.css     # Global CSS design tokens
│   │   │   ├── layout.tsx      # Root layout
│   │   │   └── page.tsx        # Public landing page
│   │   ├── component/          # Shared components (AuthGuard, SessionManager, Header)
│   │   ├── constants/          # Static copy and legal text
│   │   ├── context/            # Global React state (FinancialContext, UserContext)
│   │   ├── hooks/              # Reusable React hooks
│   │   ├── middleware.ts       # SSR authentication and session HMAC gatekeeper
│   │   └── utils/              # Data services, Supabase clients, formatters
│   └── package.json            # Node.js dependencies and scripts
```

---

## 5. Architectural Decision Records (ADRs)

### ADR-001: Supabase SSR Authentication with HMAC-Signed Activity Cookies
- **Context**: The app requires robust authentication across server components, route handlers, and client pages while enforcing strict idle timeouts.
- **Decision**: Implemented `@supabase/ssr` with Next.js `middleware.ts`. Session freshness is validated via an HMAC-SHA256 signed `buck-session-activity` cookie.
- **Consequences**: Provides seamless server-side route protection without relying on client hydration, preventing unauthorized content flashing.

### ADR-002: In-Memory Client State Caching via `FinancialContext`
- **Context**: Switching between dashboard tabs previously triggered repeated full-table queries, causing skeleton flashes and latency.
- **Decision**: Implemented `DashboardDataCache` in `FinancialContext.tsx` with timestamps. Data is held in memory during the session and updated in background via Supabase Realtime subscriptions.
- **Consequences**: Instantaneous navigation between tabs. Memory is securely cleared upon browser reload or logout.

### ADR-003: Soft-Deletion for Multi-Wallet Management
- **Context**: Hard deleting a wallet deletes or nullifies associated historical expense records, corrupting financial reporting.
- **Decision**: Added `deleted_at timestamptz` to `public.wallets`. The UI hides soft-deleted wallets from active selectors while preserving them in history.
- **Consequences**: Maintains full referential integrity and historical reporting accuracy across all expense records.

### ADR-004: Decoupled FastAPI Microservice for AI & ML Inference
- **Context**: Running complex Python time-series models (Prophet) and LLM prompt orchestrations directly in Node.js serverless functions is computationally heavy.
- **Decision**: Decoupled AI inference into a dedicated Python FastAPI service running on Render.
- **Consequences**: Enables Python ML library execution; however, requires rigorous cross-service contract synchronization (see [`QA_Report.md`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/QA_Report.md)).

### ADR-005: Zero-Knowledge Password Reset Rate Limiting
- **Context**: Reset endpoints must prevent brute-force attacks without storing plaintext user emails or IP addresses.
- **Decision**: Implemented `auth_security_events` table storing SHA-256 HMAC hashes derived from server-side secrets.
- **Consequences**: Complies with privacy standards while effectively enforcing sliding-window rate limits.

### ADR-006: Database Policy Consolidation & Function Security Hardening
- **Context**: Multiple legacy RLS policies led to duplicate evaluations, sub-optimal auth function queries per row, and trigger functions were exposed to unauthenticated public RPC calls.
- **Decision**: Applied migration `202606140001_security_and_policy_hardening.sql`: revoked direct execute on trigger/definer functions from `PUBLIC, anon, authenticated`, fixed function `search_path = public`, consolidated duplicate RLS policies with `(select auth.uid())` initplan caching, and added covering indexes on foreign keys.
- **Consequences**: Eliminates database linter security advisories, prevents unauthorized RPC trigger execution, and enhances query throughput at scale.

### ADR-007: Home Dashboard Weekly Spending Pie Graph with Top-4 + Others Cap & Interpretation Card
- **Context**: The previous Weekly Spending widget only presented an aggregate total in an orange ring, providing no categorical breakdown of where weekly funds were deployed.
- **Decision**: Replaced the static ring with `WeeklyPieChart.tsx` displaying category shares capped at a maximum of 5 elements (Top 4 categories + an aggregated 5th "Others" slice). Introduced a dedicated `WeeklyInterpretationCard.tsx` directly beneath the weekly overview that algorithmically analyzes category concentration, daily pacing, and wallet utilization in Philippine Peso (PHP).
- **Consequences**: Delivers instant categorical visibility, limits chart clutter to exactly 5 slices per UI/UX principles, and provides contextual, actionable financial interpretation for the user.

### ADR-008: Expenses Tab KPI Data Visualization & Category Allocation UX Overhaul
- **Context**: The Expenses page previously rendered static typography for top KPI metrics (Wallet left, Total tracked, Average expense) without graphical progress indicators, spending velocity metrics, or category filtering controls.
- **Decision**: Overhauled the Expenses dashboard (`app/dashboard/expenses/page.tsx`):
  1. Replaced static stats with `ExpenseKPICards.tsx` featuring:
     - **Wallet Balance**: Dynamic multi-stage capacity progress bar (`percentRemaining`), health badges (Healthy, Caution, Critical, Depleted), and available vs. spent breakdown.
     - **Total Tracked**: 7-day micro-bar sparkline histogram displaying daily spend distribution alongside monthly velocity.
     - **Average Expense**: Range benchmark track locating the average pin between minimum and maximum transaction extremes with top single expense highlights.
  2. Implemented `ExpenseCategoryVisualizer.tsx`: A proportional multi-segmented category allocation bar and interactive category filter chips.
  3. Upgraded the transaction workflow: Quick amount preset chips (+50, +100, +200, +500, +1000), overbudget warning indicators, a search and sorting toolbar, color-coded category theme badges with icons, and Framer Motion animated list transitions.
  4. Synchronized `DashboardSkeletons.tsx` (`ExpensesSkeleton`) for zero layout shift during hydration.
### ADR-009: Wallet Screen Dropdown Repair, Toolbar Alignment & Symmetrical Card Refactor
- **Context**: The Wallet screen (`app/dashboard/wallet/page.tsx`) suffered from UI styling defects: nested rectangular border artifacts on sort/filter dropdowns due to conflicting `.wallet-filter-select` CSS wrappers, search inputs floating out of order or hidden behind collapsing triggers, and asymmetric card button layouts (inactive wallets displayed 3 bottom buttons while active wallets displayed 2). The solid orange active badge was visually indistinguishable from action buttons.
- **Decision**: Refactored the Wallet page and styles (`buck/src/app/dashboard/settings/style.css`):
  1. **Repaired Dropdown UI & Toolbar**: Eliminated double-border nesting artifacts by removing conflicting outer container classes on `CustomSelect`. Aligned the search bar with its left-integrated `FaSearch` icon directly to the left of the dropdown across both Active Wallets and History panels (`[Search Bar] [Dropdown]`).
  2. **Uniform Card Structure**:
     - **Top-Right Header**: Inactive wallets feature a dedicated `Set Active` outline pill button, while the active wallet renders an **Active Status Pillbox**.
     - **Bottom Actions**: Standardized across ALL cards to strictly two 50%/50% symmetrical buttons (`[Edit]` and `[Delete]`), eliminating the previous 3-vs-2 button asymmetry.
  3. **Distinct Active Pillbox Palette**: Styled the active status pillbox in a subtle emerald-mint tint (`rgba(16, 185, 129, 0.14)` border & background with `#047857` / `#34d399` text) to clearly signify non-clickable active status while adhering to the app's established health palette.
  4. **Skeletal Loading Synchronization**: Updated `DashboardSkeletons.tsx` (`WalletSkeleton`) to match the new toolbar and symmetrical card structure.
- **Consequences**: Resolves all visual clipping and layout defects, provides predictable symmetric card interactions, and achieves uniform scaling across desktop and mobile.

### ADR-010: Home Dashboard Category Breakdown Timeframe Filter, Layout Reordering & AI Financial Advisor Placeholder Card
- **Context**: The Category Breakdown pie graph previously filtered solely on `getWeeklyExpenses()`, causing it to collapse into a single category ("Food" 100%) when expenses recorded within the 7-day calendar week were only food, despite the user having rich historical data across Bills, Shopping, Transportation, etc. Card ordering had Financial Summary below the rule-based interpretation card. Furthermore, the user emphasized that insights should be AI-driven, requesting an AI Financial Advisor placeholder card until the ML backend is fully coupled.
- **Decision**:
  1. **Timeframe Filter on Category Breakdown**: Added segmented pill buttons (`[All Time] [This Month] [This Week]`) directly in the card header, defaulting to `All Time`. This immediately surfaces the user's full multi-category distribution with 5 elements (Top 4 categories + an aggregated 5th "Others" slice), while allowing one-click inspection of monthly and weekly scopes. Normalized date parsing to midday local time to eliminate timezone boundary shifts.
  2. **Section Reordering**: Reorganized the Home dashboard layout:
     - **Row 1**: Category Breakdown Pie Graph (`.spending-card`) & Weekly Expenses by Day Bar Graph (`.graph-card`).
     - **Row 2**: Categories Financial Summary (`.summary-card`) - moved directly beneath the graph cards.
     - **Row 3**: AI Financial Advisor Card (`AIAdvisorPlaceholderCard.tsx`).
  3. **AI Financial Advisor Placeholder Card**: Designed and implemented `AIAdvisorPlaceholderCard.tsx` featuring:
     - Architectural telemetry chips showcasing LLaMA 3.3 70B Turbo, Prophet Time-Series, and PHP currency heuristics.
     - 3 preview capability cards: Runaway Category Alerts, Autonomous Goal Contribution Pacing, and Concise 2-Sentence Micro-Advisories.
     - Shimmering Generative AI calibration banner with a pulsing status indicator displaying ingested telemetry event counts.
  4. **Skeleton Hierarchy Sync**: Updated `HomeSkeleton` in `DashboardSkeletons.tsx` to maintain exact layout parity during data loading.
- **Consequences**: Eliminates single-category pie chart collapse, ensures correct visual representation of the 5-slice cap, positions Financial Summary logically above the AI section, and provides a sleek generative AI experience for future ML model coupling.

### ADR-011: Global Toaster Architecture, System-Wide Status Reporting & Project Design Uniformity
- **Context**: Feedback mechanisms across the application were fragmented. Critical user actions frequently relied on disruptive, synchronous browser `alert()` popups (e.g., in `authentication.tsx`, `dashboardheader.tsx`, `goals/page.tsx`) or silent failures/logs (in `settings/page.tsx`), harming UX and mobile responsiveness. Furthermore, previous notifications lacked visual consistency with the core Buck design language (`globals.css` / `dashboard.css`), missing smooth countdown progress bars, dark/light theme elevation, and flexible stacking controls.
- **Decision**:
  1. **Modular Global Architecture (`buck/src/component/toast/`)**: Built a unified, self-contained toast notification subsystem:
     - `toast.module.css`: Token-driven styling conforming to `--buck-surface`, `--buck-ink`, `--buck-line`, signature top gradient accents (emerald for success, ruby for error, amber for warning, orange-gold for info, shimmering violet for loading), glassmorphism (`backdrop-filter: blur(16px)`), elevated drop shadows, and responsive top-center realignment on mobile (`max-width: calc(100vw - 32px)`).
     - `ToastItem.tsx`: Framer Motion spring physics entrance/exit, status-tinted circular icons (`FaCheckCircle`, `FaExclamationCircle`, `FaExclamationTriangle`, `FaInfoCircle`, `FaSpinner`), pause-on-hover interaction with elapsed time tracking, and animated countdown progress bar.
     - `Toaster.tsx`: Dedicated viewport container using Framer Motion `popLayout` with a configurable stack limit (max 4 concurrent notifications) to avoid screen clutter.
     - `ToastContext.tsx` & `index.ts`: Central provider and hooks supporting dual dispatch styles: traditional `toast(message, type, options)` and fluent API `toast.success()`, `toast.error()`, `toast.warning()`, `toast.info()`, `toast.loading()`, `toast.dismiss()`, alongside an event bus for calling toasts outside React render trees.
  2. **Complete Native Alert Elimination**:
     - Removed all 5 synchronous browser `alert()` popups in `authentication.tsx` during validation and sign-up submission, replacing them with formatted error and warning toasts.
     - Replaced the sign-out error alert in `dashboardheader.tsx` with a toast error notification.
     - Replaced all 4 goal progress, status toggling, and input validation `alert()` calls in `goals/page.tsx` with contextual toasts, adding an animated celebratory success toast upon goal completion.
  3. **Universal Status Reporting Across Critical Views**:
     - `settings/page.tsx`: Integrated toasts across profile updates, avatar replacements/removals, avatar file size validation errors, email update confirmations, password change submissions, account deletion requests, account recovery actions, and feedback submissions.
     - `financial-advisor/page.tsx` & `forecast/page.tsx`: Hooked into AI advisor and forecast generation endpoints for success and failure notifications.
- **Consequences**: Delivers a seamless, non-blocking, accessible feedback system across the entire application that adheres strictly to Buck design tokens, works flawlessly across dark and light modes, and completely eliminates archaic browser alert dialogs.

### ADR-012: High-Fidelity Skeletal Loading Architecture & 1:1 Layout Parity Standard
- **Context**: Loading skeletons previously exhibited severe geometric drift from actual page implementations, creating jarring visual flashes and Cumulative Layout Shift (CLS) upon data resolution. Most notably, the **Expenses** tab rendered generic rectangular cards missing the top 3 KPI data visualizers (wallet capacity progress bar, 7-day sparkline bar histogram, and range benchmark pin) and the expense tracker toolbar. The **Wallet** tab rendered outdated card actions, missing the left-aligned search toolbar, active emerald pillbox, and symmetrical 50%/50% action buttons. Other tabs (Home, Settings, Goals, Statistics, Financial Advisor, Forecast) similarly featured layout mismatches or incorrect fallback variants.
- **Decision**:
  1. Overhauled [`DashboardSkeletons.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/DashboardSkeletons.tsx) to establish a strict 1:1 layout fidelity standard across all dashboard tabs:
     - **Expenses Tab (`ExpensesSkeleton`)**: Complete anatomical parity with `ExpenseKPICards.tsx` (Card 1: wallet utilization progress meter with threshold ticks; Card 2: 7-day sparkline bar histogram with weekday labels; Card 3: range benchmark track with center pin), `ExpenseCategoryVisualizer.tsx` (proportional multi-segmented allocation bar and 6 filter chip pills), and the 2-column layout (Add Expense form inputs/presets and Expense Tracker search toolbar and transaction items with circular category icons and action buttons).
     - **Wallet Tab (`WalletSkeleton`)**: Full architectural parity with `WalletPage` (2-column desktop grid with search-to-left and dropdown-to-right toolbars, top-right active emerald pillbox and "Set Active" pills, symmetrical 50%/50% edit/delete buttons, and archived history list with date stamps).
     - **Home Tab (`HomeSkeleton`)**: Donut chart with inner label and 5 category legend pills, 7-day expenses bar chart, summary card items, and the AI Financial Advisor placeholder card structure.
     - **Goals Tab (`GoalsSkeleton`)**: Left goal list aside, right details panel with metadata grid, `ProgressBarCard` geometry, and "See Forecast" action button.
     - **Statistics Tab (`StatisticsSkeleton`)**: Mode selector header, Row 1 (ExcessPie 36% + SpendingBar 62%), and Row 2 full-width line chart.
     - **Settings Tab (`SettingsSkeleton`)**: 5-tab navigation sidebar, account identity card, and settings panel with avatar and profile fields (eliminating deprecated hero section).
     - **Dedicated AI Views**: Implemented specialized `FinancialAdvisorSkeleton` and `ForecastSkeleton` variants, eliminating incorrect fallback to the Home skeleton.
  2. Codified the **1:1 Skeletal Loading Parity Policy** into [`AGENTS.md`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/AGENTS.md) as a mandatory architectural constraint for all future UI modifications.
- **Consequences**: Zero Cumulative Layout Shift (CLS) across all route transitions, smooth visual perceived performance, and uniform design language consistency across light and dark modes.

### ADR-013: Expenses KPI Simplification, Typographic Hierarchy Audit & Title Spacing Normalization
- **Context**:
  1. **Title/Subtitle Spacing**: The Wallet screen (`app/dashboard/wallet/page.tsx`) suffered from excessive vertical gaps between the eyebrow (`YOUR WALLETS`, `LOG`) and section heading (`Manage your active wallets`, `History of Wallets`) due to unstyled user-agent heading block margins (`0.83em`). This pushed the icon and heading down, leaving the eyebrow orphaned above.
  2. **Over-Bolding & Typographic Fatigue**: Extensive hardcoded `font-weight: 800`, `850`, and `900` definitions across `settings/style.css` and `expenses/style.css` flattened visual hierarchy, making body labels, button text, search inputs, and chips compete with primary KPI numbers.
  3. **Overwhelming KPI Visuals**: In `ExpenseKPICards.tsx`, Card 2 featured a micro-histogram sparkline that duplicated the primary dashboard bar chart, and Card 3 featured an unnecessary "Mean Velocity" pillbox badge and a misaligned benchmark range track that crowded the cards.
- **Decision**:
  1. **Compact Title Grouping**: Wrapped eyebrow and title elements in `.wallet-card-title-wrap` with scoped flex direction, `gap: 0.15rem`, and normalized `margin: 0`, restoring immediate proximity and centering with the card icon.
  2. **Global Font-Weight Audit & Softening**: Refactored font weights across `settings/style.css` and `expenses/style.css`:
     - Eyebrows: Softened from `900` to `650` with `0.4px` letter-spacing.
     - Card & panel headings: Softened from `850`/`800` to `650`.
     - Action buttons and pills: Softened from `800` to `600`.
     - Form inputs, search boxes, and dropdown selects: Softened from `750`/`700` to `500`.
     - Primary metric values: Balanced to `700` (from `900`).
     - Form labels, category chips, badges, and list subtitles: Balanced to `600`.
  3. **Expenses KPI Streamlining (`ExpenseKPICards.tsx`)**:
     - **Card 2 ("Total Tracked")**: Renamed title to "Total Tracked" (subtitle "Cumulative"). Replaced the sparkline histogram with a clean dual-stat grid showcasing **This Month** and **Daily Average**.
     - **Card 3 ("Average Expense")**: Removed the "Mean Velocity" badge and removed the misaligned horizontal range line track. Replaced with a clean dual-stat grid showcasing **Lowest Expense** and **Highest Expense** (annotated with category).
  4. **1:1 Skeletal Loading Parity Synchronization**:
     - Updated `ExpensesSkeleton` in [`DashboardSkeletons.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/DashboardSkeletons.tsx) to mirror the dual stat grid structure in Cards 2 and 3 and removed Card 3's badge skeleton.
     - Updated `WalletSkeleton` to use `.wallet-card-title-wrap` for exact vertical geometry parity.
- **Consequences**: Restores clean typographic hierarchy, eliminates cluttered micro-visualizations in favor of high-signal metrics, and maintains strict CLS elimination during hydration.

### ADR-014: Home Category Breakdown Left-Aligned Legend, Excel-Style Callouts, Dynamic Filter Pill & AI Advisor 1:1 Parity
- **Context**:
  1. **Category Breakdown Legend Proportions & Active Filter**: Category legend items were previously spreading across the entire card width ($>550\text{px}$) with excessive empty space. Furthermore, the "All" pill was visually styled with active border/glow by default, making it appear slightly bigger than normal pills before any filter was clicked. The user requested containing the pill boxes so they do not spread too far to the right, normalizing "All" to match the rest of the pills, and strictly reserving active filter highlighting for the specific category clicked.
  2. **Excel-Style Data Callout Labels on Pie Chart**: The pie chart only showed plain colored wedges without slice labels or percentages. The user instructed that each slice must display its percentage with a label pointing directly to it, matching the behavior of Excel pie chart data callouts.
  3. **Financial Summary Dynamic Eyebrow**: Consolidated static text into an interactive, readable, clickable filter pill atop "Financial Summary".
  4. **AI Financial Advisor Card on Home**: Replaced speculative telemetry with the exact 2-card structure and Health Score from `financial-advisor/page.tsx`, caching insights across views.
- **Decision**:
  1. **Compact Legend Width & Active Filter Reservation (`WeeklyPieChart.tsx`, `style.css`)**:
     - Constrained `.spending-pie-legend` to `width: min(290px, 100%); max-width: 290px; flex: 0 0 auto;`.
     - Standardized `.spending-pie-legend-item` to explicit `height: 34px`, `box-sizing: border-box`, and identical font sizing.
     - Removed default selection from "All". Active filter styling (`spending-pie-legend-item--selected`) is strictly reserved for the category currently clicked.
     - Redesigned active filter highlight using `outline: 1.5px solid var(--buck-orange); outline-offset: -1px;` to preserve exact geometric bounds without popping or expanding.
  2. **Excel-Style Callout Data Labels Plugin (`excelDataCalloutPlugin`)**:
     - Custom Chart.js v4 plugin executing in `afterDatasetsDraw`.
     - Calculates mid-arc angle $\theta$ for each slice: anchors a dot on the slice perimeter, draws a leader line extending outward $14\text{px}$ to an elbow knee, and projects a horizontal shelf to the label.
     - Employs a multi-pass vertical collision relaxation algorithm on left and right sides (minimum $26\text{px}$ vertical gap) to prevent label overlaps on adjacent slices.
     - Renders category name on top line ($11\text{px}$ semi-bold) and bold slice percentage on bottom line ($12\text{px}$ bold, color-coded to slice). When a slice is clicked, active leader line and label highlight while non-selected slices gently dim.
     - Added $55\text{px}$ horizontal canvas layout padding (`layout.padding`) so leader lines and callout text never clip.
  3. **Interactive Eyebrow Filter Pill (`home/page.tsx`)**: Replaced static eyebrow with `.summary-filter-pill-wrap` displaying `[ (•) Category: <Name> • <Timeframe> ✕ Show All ]`.
  4. **Faithful AI Advisor Card (`AIAdvisorPlaceholderCard.tsx`)**: Mirrored Financial Advisor tab with 2 cards (**AI Suggestion** & **AI Advice**), Health Score meter, and `View Full Advisor →` link.
  5. **1:1 Skeletal Loading Parity (`DashboardSkeletons.tsx`)**: Updated `HomeSkeleton` to mirror the $290\text{px}$ legend pills ($34\text{px}$ height), the callout canvas box geometry, and the AI Advisor cards.
- **Consequences**: Eliminates stretched pills, provides instant Excel-grade visual clarity on pie slices with leader lines, eliminates CLS during hydration, and maintains clean typographic and geometric stability.

### ADR-015: Financial Summary Title Row Restructure, Eyebrow Restoration & "Others" Sub-Category Filtering Fix
- **Context**:
  1. **Header Layout & Aesthetics**: The filter pillbox stacked vertically on top of the "Financial Summary" heading was visually awkward and cluttered when unfiltered. The user requested returning to the classic eyebrow title `Categories` with `Financial Summary` heading directly below it, and positioning the interactive filter pillbox **beside the title** on the same row.
  2. **"Others" Sub-Category Click Bug**: When users clicked "Others" on the Pie Chart, the Financial Summary displayed the cards grouped under "Others" (e.g. Health, Entertainment, Electronics). However, clicking any of those cards from the Financial Summary failed to display properly: an aggressive `useEffect` hook in `page.tsx` was validating `selectedCategory` strictly against `categoryPieData.slices` (which only contains the top 4 categories and `"Others"`). Because "Health" was not in the top 4 slices, the effect immediately wiped `selectedCategory` back to `null`, instantly canceling the user's selection. Furthermore, `WeeklyPieChart` dimmed all slices and failed to calculate center values for sub-categories of "Others".
- **Decision**:
  1. **Eyebrow & Title Row Restructure (`home/page.tsx`, `home/style.css`)**:
     - Restored `<p className="card-eyebrow">Categories</p>` on top.
     - Positioned `<h2 className="summary-title">Financial Summary</h2>` directly below it in a flex `.summary-title-row` with `gap: 0.75rem`.
     - When a category filter is active, `.summary-filter-pill-group` renders horizontally beside the heading (`[ Category: <Name> • <Timeframe> ✕ Show All ]`). When no category is selected, the title row remains clean and uncrowded.
  2. **"Others" Sub-Category Support & Existence Validation Fix (`home/page.tsx`)**:
     - Fixed `useEffect` to validate category existence against `pieExpenses` (confirming actual recorded expenses in the active timeframe) rather than `categoryPieData.slices`.
     - Added `isSubCategoryOfOthers` logic detecting when the selected category belongs to the bundled "Others" slice.
     - Added `selectedCategoryAmount` prop passed to `WeeklyPieChart` to compute the category's accurate proportion and center metrics.
     - Added `← Others` quick-action button in `.summary-filter-pill-group` when a subcategory of Others is active, enabling one-click return to the Others breakdown.
  3. **Pie Chart Sub-Category Coordination (`WeeklyPieChart.tsx`)**:
     - Updated slice highlight predicate `isSliceActive` to keep the "Others" slice vibrant and offset by $10\text{px}$ when a subcategory of Others (e.g. "Health") is selected, while cleanly dimming unrelated top-4 slices.
     - Center display shows the selected subcategory name, exact amount, and percentage of total (`Health (6%)` and `₱800.00`).
     - Legend pill for "Others" dynamically updates to show `Others: Health`, its amount, and active highlight.
     - `excelDataCalloutPlugin` highlights the Others callout leader line pointing to the slice with `Others (Health)`.
  4. **1:1 Skeletal Loading Parity Synchronization (`DashboardSkeletons.tsx`)**:
     - Updated `HomeSkeleton` to mirror the restored `Categories` eyebrow (`width: 85, height: 12`) and `Financial Summary` heading (`width: 175, height: 22, marginTop: 4`), maintaining zero CLS.
- **Consequences**: Restores clean, professional layout spacing; enables seamless deep-dive into long-tail expense categories bundled under "Others" without navigation traps or state resets.

### ADR-016: Bar Graph Dual-Axis Labeling & Centralized Pie Palette Architecture
- **Context**:
  1. **Unlabeled Bar Graph Axes**: The Weekly Expenses by Day bar chart displayed numeric tick values ($0$ to $61,590$) and day abbreviations (`Mon`–`Sun`) without explicit axis titles, leaving users uncertain about the unit of measurement and aggregation domain.
  2. **Color Palette Modularity**: The pie chart colors were previously hardcoded in an internal variable in `page.tsx` and lacked a modular, developer-friendly interface for theming, reordering, or customizing colors.
- **Decision**:
  1. **Dual-Axis Labels (`home/page.tsx`, `home/style.css`)**:
     - **Y-Axis Label (`AMOUNT (₱)`)**: Wrapped the Y-axis column in `.graph-y-axis-wrap` with an uppercase, rotated axis title (`writing-mode: vertical-rl; transform: rotate(180deg)`) centered vertically along the tick scale.
     - **X-Axis Label (`DAY OF THE WEEK`)**: Added `.graph-x-axis-footer` beneath the day tick labels with an uppercase, centered axis title.
     - Formatted Y-axis ticks with locale digit grouping (`toLocaleString()`).
  2. **Centralized Chart Theme Module ([`chartTheme.ts`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/chartTheme.ts))**:
     - Extracted all slice colors into an exported `BUCK_PIE_PALETTE` array and `CHART_THEME` configuration object.
     - Developers and designers can now customize the entire chart color theme in a single file with zero deep code refactoring.
  3. **1:1 Skeletal Loading Parity (`DashboardSkeletons.tsx`)**:
     - Added matching x-axis title skeleton line (`95px × 10px`) below the bar skeletons in `HomeSkeleton`, ensuring zero CLS.
### ADR-017: Comprehensive Dashboard Tab Skeletal Loading Parity & Route Boundary Architecture
- **Context**:
  1. **Next.js App Router Route Boundary Fallback Leak**: When navigating between dashboard subroutes (`/dashboard/expenses`, `/dashboard/wallet`, `/dashboard/financial-advisor`, `/dashboard/forecast`, `/dashboard/admin`), the subdirectories lacked dedicated `loading.tsx` boundary files. Next.js App Router fell back to the parent route boundary `buck/src/app/dashboard/loading.tsx`, which unconditionally rendered `<DashboardPageSkeleton />` (defaulting to `"home"`). Users thus saw the Home dashboard skeleton flash across every non-home tab during page loads and transitions.
  2. **Client Layout Route Dispatch Mismatch (`DashboardClientLayout.tsx`)**: In `DashboardClientLayout.tsx`, `getSkeletonVariant` contained mismatched mappings: `/dashboard/wallet` was hardcoded to `"settings"`, `/dashboard/expenses` was hardcoded to `"statistics"`, while `/dashboard/financial-advisor` and `/dashboard/forecast` were not mapped and fell through to `"home"`.
  3. **Visual Inaccuracies within Skeletons**:
     - `HomeSkeleton`: Bar chart lacked the newly added `.graph-y-axis-wrap` column (with "Amount (₱)" title and numeric tick scale placeholders), creating CLS when data hydrated.
     - `FinancialAdvisorSkeleton`: Missing the circular `.advisor-score` health score meter in the hero header, and used generic un-styled containers instead of the real `.advisor-grid` and `.advisor-ai-grid` CSS classes.
     - `ForecastSkeleton`: Rendered an inaccurate 14-bar chart instead of the 3 prediction cards and 2 wide forecast cards (`.forecast-ai-grid`), causing major layout shift.
     - `AdminSkeleton`: Did not exist, forcing admin page loads into a home fallback.
- **Decision**:
  1. **Comprehensive Subroute Loading Boundaries**:
     - Created dedicated `loading.tsx` files for every subroute:
       - `buck/src/app/dashboard/expenses/loading.tsx` (`variant="expenses"`)
       - `buck/src/app/dashboard/wallet/loading.tsx` (`variant="wallet"`)
       - `buck/src/app/dashboard/financial-advisor/loading.tsx` (`variant="financial-advisor"`)
       - `buck/src/app/dashboard/forecast/loading.tsx` (`variant="forecast"`)
       - `buck/src/app/dashboard/admin/loading.tsx` (`variant="admin"`)
     - Ensures Next.js App Router renders the exact skeleton matching the destination route during any server suspense or client transition.
  2. **Accurate Client Layout Routing (`DashboardClientLayout.tsx`)**:
     - Fixed `getSkeletonVariant(pathname)` to map every route directly to its corresponding variant: `expenses`, `wallet`, `financial-advisor`, `forecast`, `goals`, `statistics`, `settings`, `admin`, and `home`.
  3. **High-Fidelity Skeleton Synchronizations (`DashboardSkeletons.tsx`)**:
     - **Home**: Added `.graph-container` with `.graph-y-axis-wrap` (showing "Amount (₱)" axis title and 7 tick placeholders) and `.graph-x-axis-footer` ("Day of the Week"), achieving 1:1 layout match with `WeeklyBarChart`.
     - **Financial Advisor**: Added button line + circular `.advisor-score` badge ($128\text{px} \times 128\text{px}$) in `.advisor-hero`, 3 cards in `.advisor-grid`, and 2 wide cards in `.advisor-ai-grid`.
     - **Forecast**: Added button line + circular score badge ($128\text{px} \times 128\text{px}$) in `.forecast-hero`, 3 projection cards in `.advisor-grid`, and 2 wide forecast cards in `.forecast-ai-grid`.
     - **Admin**: Added `AdminSkeleton` matching the 3-tab vertical navigation (`settings-tabs`), toolbar, and card list items.
- **Consequences**: Completely eliminates mismatched skeleton flashing across all dashboard tabs, guarantees instant 1:1 visual parity with target page layouts, and prevents Cumulative Layout Shift (CLS).

### ADR-018: Pie Chart Legend Left-Alignment, Callout Typography Scaling (+2.5px), and Anti-Clipping Geometry
- **Context**:
  1. **Legend Inward Offset**: In `.spending-pie-layout`, `justify-content: center` was clustering the category filter pills ("All", "Food", "Bills", "Transportation", "Shopping", "Others") and the Pie Chart in the center of `.spending-card`, leaving ~150px of empty dead space on the left and squeezing the Pie Chart toward the right.
  2. **Callout Text Clipping on Canvas Boundaries**: Chart labels ("Transportation", "Others", "Bills") were getting cut off along the edges because:
     - The canvas container (`.spending-pie-canvas-inner`) was restricted to $250\text{px}$ height and narrow width, with only $20\text{px}$ top/bottom and $55\text{px}$ left/right padding.
     - Long words (such as "Transportation" at $\approx 88\text{px}$ wide) extended beyond $X = 0$, causing the browser canvas to clip the leading characters ("Trans" was cut, leaving only "portation").
     - Top labels ("Others 5%") and bottom labels ("Bills 32%") exceeded the top and bottom $Y$ limits ($0$ and $250\text{px}$).
  3. **Callout Font Legibility**: The default font size ($11\text{px}$ category, $11.5\text{px}$ percentage) was too small and strained readability.
- **Decision**:
  1. **Legend Left-Alignment & Layout Expansion (`home/style.css`)**:
     - Updated `.spending-pie-layout` to `justify-content: flex-start; gap: clamp(1.25rem, 2.5vw, 3rem); width: 100%;`.
     - Pinned `.spending-pie-legend` flush to the left boundary of `.spending-card` under the title heading.
     - Expanded `.spending-pie-canvas-box` to `flex: 1; max-width: 480px; min-height: 310px;` and `.spending-pie-canvas-inner` to `height: 290px;`.
  2. **Callout Typography Scaling & Anti-Clipping Engine (`WeeklyPieChart.tsx`)**:
     - **Font Size Scaling**: Increased category name font from $11\text{px} \rightarrow 13.5\text{px}$ (+2.5px, semi-bold `600`–`650`) and percentage font from $11.5\text{px} \rightarrow 14.5\text{px}$ (+3px, bold `750`–`850`).
     - **Canvas Padding**: Increased Chart.js layout padding to `top: 34, bottom: 34, left: 95, right: 95`.
     - **Compact Elbow/Shelf**: Decreased knee projection from $r + 14 \rightarrow r + 10$ and shelf from $14 \rightarrow 10\text{px}$, leaving maximum horizontal canvas space for text.
     - **Vertical Clamping**: Clamped `endY` between $Y = 22$ and $Y = \text{height} - 24$, guaranteeing top and bottom labels never breach canvas bounds.
     - **Safe Horizontal Text Placement & Smart Truncation**: Enforced `safeTextX` bounds ($X \ge \text{width} + 6$ on left, $X \le \text{chart.width} - \text{width} - 6$ on right). Added automatic ellipsis truncation for outlier labels exceeding maximum allowable margin width.
  3. **1:1 Skeletal Loading Parity (`DashboardSkeletons.tsx`)**:
     - Synchronized `HomeSkeleton` with `justify-content: flex-start` layout and $290\text{px}$ canvas box geometry to eliminate CLS upon hydration.
- **Consequences**: Restores clean left-aligned visual balance under the category card title, provides crystal-clear readability with larger callout typography, and guarantees that no label is ever clipped by canvas edges.

### ADR-019: Anti-Pill-in-Pill Architecture & Sibling Filter Badge Principles
- **Context**:
  1. **Nested Pill-in-a-Pill Anti-Pattern**: Previously, active filter indicators in the Category Breakdown / Financial Summary header and the Bar Chart header nested interactive button pills (`✕ Show All` or `✕ Clear`) directly inside the outer badge pill. This created an ambiguous visual and accessibility anti-pattern: an interactive pill nested inside another pill, confusing user click targets and creating visual clutter.
  2. **Information Overload in Filter Pill**: The Category filter pill bundled redundant timeframe information (`• All Time`), cluttering the pill when the section header already provides timeframe context.
  3. **Cramped Typography**: The label prefix `Category:` was crowded directly against the category name without breathing room.
- **Decision**:
  1. **Strict Design System Rule — Zero Nested Pills ("No Pill-in-a-Pill")**:
     - Informational filter badges and dismissal/action triggers must **never** be nested inside one another.
     - They must always be rendered as discrete, standalone **sibling pill components** within a flex container (`gap: 0.5rem`).
  2. **Sibling Filter Pill Architecture (`home/page.tsx`, [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css))**:
     - **Financial Summary**:
       - **Category Indicator Badge**: `<div className="summary-filter-pill summary-filter-pill--active">` containing the category dot, muted `Category:` prefix, and bold category name with `gap: 0.38rem` spacing. Redundant `• All Time` text is completely removed.
       - **Action Pill Button**: `<button className="summary-filter-action-btn">✕ Show All</button>` rendered as an independent orange sibling pill beside the badge.
       - **Back Pill**: If viewing an "Others" subcategory, `<button className="summary-filter-back-btn">← Others</button>` renders as another sibling pill.
     - **Bar Graph Card (Expenses by day)**:
       - Transformed into `.chart-active-filter-group` containing two separate sibling pills:
         - **Category Indicator Badge**: `<div className="chart-active-filter-badge">` showing the category dot, muted `Category:` prefix, and bold category name with clean spacing.
         - **Action Pill Button**: `<button className="filter-clear-btn">✕ Clear</button>` rendered as an independent sibling pill outside the badge.
- **Consequences**: Completely eliminates ambiguous nested click targets, establishes an intuitive and accessible UI hierarchy, enhances typographic clarity with dedicated spacing, and guarantees uniform filter pill behavior across all dashboard cards.

### ADR-020: Modular Skeletal Loading Architecture & 1:1 Loaded-State Geometry Parity
- **Context**:
  1. **Monolithic Skeleton Failure & CSS Chunk Isolation**: Previously, skeletal loading components were clustered in a single file (`DashboardSkeletons.tsx`) relying on page-specific CSS classes (such as `.expenses-kpi-grid`, `.expenses-card`, `.expenses-layout`). Because Next.js App Router route boundaries (`loading.tsx`) render *before* the target page's CSS bundle chunk finishes loading, all container grid and card classes lacked CSS rules in the DOM. This caused the skeleton to collapse into a vertical stack of loose lines clinging to the left boundary—a jarring "day and night" divergence from the real loaded page.
  2. **Monolithic Code Sprawl**: Consolidating all 9 dashboard page skeletons into a single 1,000+ line file made isolated maintenance and layout matching across complex pages (like Expenses, Wallets, and Statistics) difficult to audit.
- **Decision**:
  1. **Modular Skeletons Folder Architecture (`src/component/skeletons/`)**:
     - Decomposed all skeletons into dedicated modular files per dashboard page:
       - [`ExpensesSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/ExpensesSkeleton.tsx)
       - [`HomeSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/HomeSkeleton.tsx)
       - [`WalletSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/WalletSkeleton.tsx)
       - [`GoalsSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/GoalsSkeleton.tsx)
       - [`StatisticsSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/StatisticsSkeleton.tsx)
       - [`SettingsSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/SettingsSkeleton.tsx)
       - [`FinancialAdvisorSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/FinancialAdvisorSkeleton.tsx)
       - [`ForecastSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/ForecastSkeleton.tsx)
       - [`AdminSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/AdminSkeleton.tsx)
       - [`index.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/index.tsx) (central dispatcher & exports)
       - [`skeletons.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/skeletons.css) (self-contained layout & card styling)
     - Preserved backward compatibility in [`DashboardSkeletons.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/DashboardSkeletons.tsx) via seamless re-exports.
  2. **Self-Contained Skeleton CSS (`skeletons.css`)**:
     - Guarantees card backgrounds (`var(--buck-surface)`), card borders (`var(--buck-line)`), border-radius (`10px`), shadows, and responsive grid layouts (`repeat(3, 1fr)`, `minmax(320px, 390px) minmax(0, 1fr)`) are active immediately during hydration without waiting for page-level CSS chunks.
  3. **1:1 Expenses Skeleton Geometry**:
     - **3 KPI Cards**: Wallet Balance with emerald health status badge, progress meter, and Available/Spent split; Total Tracked with entries count badge and 2-box stat grid; Average Expense with 2-box min/max stat grid.
     - **Category Spending Allocation Card**: Title group, 7 proportional segment allocation bar, 8 realistic filter chip pills.
     - **Main Workspace (2 Columns)**: Add Spending form card (inputs, quick add pills, submit button) on left; Expense tracker list (search/sort toolbar, transaction rows with icons and delete buttons) on right.
- **Consequences**: Completely eliminates layout collapse and Cumulative Layout Shift (CLS), ensuring the skeleton matches the loaded page geometry with 1:1 precision.

### ADR-021: Pie Chart Dynamic Slice Zooming, Tooltip Authenticity & Bidirectional Anti-Clipping Engine
- **Context**:
  1. **Callout Label Clipping on Category Focus**: When a slice was selected, Chart.js applied an outward offset ($14\text{px}$) and expanded typography, pushing edge callout labels against canvas boundaries. Labels near the top edge (e.g., "Others 5%") had top character baselines clipped off-screen; labels on the left edge (e.g., "Transportation 17%") had leading characters ("Tr") truncated by the left canvas boundary; labels near the bottom edge (e.g., "Bills 32%") crowded the container border.
  2. **Washed-Out Tooltip Color Indicators**: When a category was active, unselected slices had dimmed/muted background colors in the dataset. Default Chart.js tooltips inherited this muted color for the hover box indicator, rendering as washed-out white/gray squares rather than the true category color.
  3. **Lack of Contrast & Visual Hierarchy in Pie Slices**: Slices had uniform radial scales when selected, lacking clear depth of field and zoom separation between the focused category and background categories.
- **Decision**:
  1. **Dynamic Per-Slice Outer Radius Zooming (`WeeklyPieChart.tsx`)**:
     - Extended `PieController.prototype.updateElements` to support `outerRadiusMultipliers` on pie datasets, hooking directly into Chart.js's native `_resolveAnimations(index, mode).update(element, properties)` pipeline.
     - **Focused Slice ("Zoom In")**: Retains full scale (`1.02` multiplier) with prominent outward offset ($14\text{px}$) and vibrant border styling.
     - **Unselected Slices ("Zoom Out")**: Scale down smoothly to `0.85` multiplier ($85\%$ radius) with zero offset and dimmed background fill.
     - **Deselection Transition**: Smoothly re-expands all slices back to $1.0$ multiplier and $0$ offset over $380\text{ms}$ with `easeOutQuart` cubic-bezier easing.
  2. **Vibrant True-Color Tooltip Indicators (`labelColor` callback)**:
     - Configured `plugins.tooltip.callbacks.labelColor` to explicitly retrieve the slice's true color (`slice.color`) from the category palette.
     - Guarantees the hover color box always renders the 100% opaque, authentic category color (e.g., vibrant amber for Shopping, warm orange for Food) even when the slice is dimmed on the canvas.
  3. **Bidirectional Anti-Clipping Callout Placement Engine (`excelDataCalloutPlugin`)**:
     - **Headroom & Footroom Clamping**: Enforced vertical clamping boundaries (`minY = 30`, `maxY = height - 30`), guaranteeing top category names at $Y - 8$ and bottom percentages at $Y + 9$ maintain $> 15\text{px}$ clearance from canvas borders.
     - **Horizontal Inward Shifting & Shelf Alignment**:
       - Left callouts (`!isRight`): Evaluates `contentWidth = Math.max(textWidth, pctWidth)`. If `safeTextX - contentWidth < 8`, smoothly shifts `safeTextX` rightward to `contentWidth + 8` and attaches the shelf line at `safeTextX + 6`.
       - Right callouts (`isRight`): If `safeTextX + contentWidth > width - 8`, shifts `safeTextX` leftward to `width - 8 - contentWidth` and adjusts the shelf line.
     - **Universal Canvas 2D Font Specification**: Replaced non-standard font weights (`850`, `750`) with universal standard font strings (`bold 13px system-ui, -apple-system, sans-serif`, `bold 15px system-ui, -apple-system, sans-serif`).
     - **Canvas Dimensions & Skeletons**: Increased `.spending-pie-canvas-inner` height to $310\text{px}$, optimized legend width to $250\text{px}$, and synchronized `HomeSkeleton` and `skeletons.css` with 1:1 geometry.
- **Consequences**: Completely eliminates label clipping at all four canvas edges, ensures rich and vibrant hover tooltips, and provides clear, fluid visual zoom distinction when focusing on expense categories.

### ADR-022: Dashboard Card Grid Rebalance, Compact Legend Centering, & Bar Graph Axis Geometry
- **Context**:
  1. **Disproportionate Dashboard Grid Columns**: The dashboard grid previously allocated `minmax(0, 1.15fr)` to the left Pie Chart card and `1fr` to the right Bar Graph card. This squeezed the Bar Graph card horizontally, crowding the vertical Y-axis title `AMOUNT (₱)` against numeric tick marks and the left card margin.
  2. **Legend Filter Pillbox Left Stacking**: The Pie Chart's filter pillboxes were pinned flush to the far left margin, creating dead space between the pills and the pie chart.
  3. **Excessive X-Axis Spacing & Vertical Graph Misalignment**: The Bar Graph was positioned too high up under the card title with an empty void at the bottom. Furthermore, `.graph-bars` padding-bottom ($2\text{rem}$) combined with `.graph-x-axis-footer` margin-top ($1.85\text{rem}$) created a massive $\sim 50\text{px}$ void between the day tick abbreviations (`Mon`–`Sun`) and the `DAY OF THE WEEK` axis title.
- **Decision**:
  1. **Rebalanced Grid Ratio (`home/style.css`, `skeletons.css`)**:
     - Updated `.dashboard-content` and `.home-skeleton-content` from `1.15fr / 1fr` to `minmax(0, 0.94fr) minmax(0, 1.06fr)`.
     - Grants the Bar Graph card an extra $60\text{px}$–$80\text{px}$ of horizontal breathing room.
  2. **Centering the Filter Pillboxes to the Pie Chart (`.spending-pie-layout`)**:
     - Updated `.spending-pie-layout` to `justify-content: center; align-items: center; margin: auto 0; gap: clamp(0.75rem, 1.8vw, 1.85rem);`.
     - Compacted `.spending-pie-legend` to `width: min(215px, 100%); max-width: 220px;` with $32\text{px}$ pills and $0.78\text{rem}$ typography.
     - Pillboxes and pie chart form a unified, horizontally and vertically centered block within the card.
  3. **Bar Graph Spacing & Lower Positioning (`.graph-container`, `.graph-card`)**:
     - Configured `.graph-card` as a flex column: `display: flex; flex-direction: column; justify-content: space-between; gap: 1.25rem; min-height: 420px; padding: 1.5rem;` matching `.spending-card` and `.summary-card`.
     - Moved `.graph-container` lower into the card using `margin-top: auto; margin-bottom: 0.35rem;`, aligning the bottom axis footer with the pie chart's center summary baseline.
     - Positioned Y-axis title `AMOUNT (₱)` with `gap: 0.75rem` and `padding-right: 0.35rem` from tick labels.
     - Calibrated height to $250\text{px}$ across `.graph-y-axis-wrap`, `.graph-axis`, and `.graph-bars`.
     - Removed excessive bottom padding in `.graph-bars` (`padding: 0.5rem 0 0`) and tightened `.graph-x-axis-footer` to `margin-top: 1.75rem`, placing `DAY OF THE WEEK` just $5\text{px}$–$7\text{px}$ below day tick abbreviations.
  4. **1:1 Skeletal Loading Parity (`HomeSkeleton.tsx`, `skeletons.css`)**:
     - Synchronized `HomeSkeleton` and `skeletons.css` with the `0.94fr / 1.06fr` grid, centered pie layout, and $250\text{px}$ bar graph height to ensure zero CLS.
- **Consequences**: Restores uniform card padding and spacing throughout the dashboard, gives the Y-axis label comfortable room, eliminates the empty void under the X-axis line, and creates visual balance across both dashboard cards.

---

### ADR-023: Leftmost Legend Container Alignment & Full-Sized Pie Chart Preservation

- **Status**: Implemented
- **Context**: In ADR-022, centering `.spending-pie-layout` caused the filter pillboxes to drift inward by ~55px away from the card's inner content boundary, breaking container spacing parity with all other dashboard cards and detaching visually from the "Category Breakdown" card heading. In addition, constraining the card grid and capping the canvas box container to 340px resulted in the pie chart shrinking to a small ~158px circle with truncated callouts ("Transport...").
- **Decision**:
  1. **Leftmost Legend Container Spacing Parity**:
     - Configured `.spending-pie-layout` to `justify-content: space-between; gap: clamp(1rem, 2vw, 2.25rem);` so `.spending-pie-legend` sits on the absolute leftmost edge of the card's content box, starting flush at the card's `1.5rem` internal padding.
     - Vertically aligns the pillbox stack directly beneath "CATEGORY SPENDING" and "Category Breakdown", maintaining 1:1 container spacing consistency with `.graph-card`, `.summary-card`, and `.ai-advisor-card`.
  2. **Full-Sized Pie Chart Restoration (No Shrinking)**:
     - Set `.dashboard-content` grid columns to `minmax(0, 1.12fr) minmax(0, 1fr)`, giving the Pie Chart card ample width while maintaining generous space ($> 550\text{px}$ on desktop) for the Bar Graph card.
     - Expanded `.spending-pie-canvas-box` to `flex: 1 1 auto; width: 100%; max-width: 480px; min-height: 330px;` and `.spending-pie-canvas-inner` to `height: 320px;`.
     - Calibrated `chartOptions.layout.padding` to `top: 32, bottom: 32, left: 65, right: 65` in `WeeklyPieChart.tsx`, restoring the pie chart to its full, prominent diameter (~230px–240px) and ensuring leader lines and full category names ("Transportation 17%") render without truncation.
  3. **1:1 Skeletal Loading Parity (`HomeSkeleton.tsx`, `skeletons.css`)**:
     - Mirrored the `1.12fr / 1fr` grid, `justify-content: space-between` layout, leftmost legend pills, and $220\text{px}$ skeleton circle in `skeletons.css` and `HomeSkeleton.tsx` to eliminate CLS.
- **Consequences**: Pillboxes align naturally with the card boundary matching the rest of the application, and the pie chart is displayed at its full, prominent scale with unclipped labels and zero layout shifting.

---

### ADR-024: Bar Chart Fluid Morphing Transitions, Persistent DOM Nodes & Interactive Tooltips

- **Status**: Implemented
- **Context**: When filtering by category on the Home dashboard, the Pie Chart exhibited smooth 380ms animations (slice zooming and dimming), while the Bar Chart (`Expenses by day`) snapped instantly to new heights because `height` was omitted from `.graph-bar`'s CSS `transition` definition. In addition, selecting a category with zero expenses unmounted the 7 weekday bars and replaced them with an empty box, abruptly destroying the day labels ("Mon"–"Sun") and preventing CSS height transitions from running on category switches.
- **Decision**:
  1. **Fluid Height Morphing & GPU Acceleration**:
     - Added `height 420ms cubic-bezier(0.16, 1, 0.3, 1)`, `background 350ms ease`, `opacity 350ms ease`, and `will-change: height` to `.graph-bar` in `home/style.css`.
     - Bars smoothly glide up and down in synchronization with the Pie Chart's 380ms animation.
  2. **Persistent DOM Architecture for Zero DOM Tearing**:
     - Updated `WeeklyBarChart` in `home/page.tsx` so all 7 weekday bar nodes remain permanently mounted in the DOM across all category filters and timeframes.
     - When switching to a category with no expenses, bars smoothly morph down to 0% height (resting on the 4px baseline pill) while the day abbreviations ("Mon"–"Sun") remain stable and legible.
  3. **Non-Intrusive Empty State Overlay**:
     - Introduced `.graph-bars-empty-overlay` with a gentle fade-in animation (`animation: fadeInEmpty 260ms ease-out forwards;`) positioned over the resting bars when a selection has zero expenses, avoiding unmounting the chart body.
  4. **Floating Hover Tooltips & Active Filter Entrance**:
     - Added `.graph-bar-tooltip` to each bar showing formatted currency (`₱...`), smoothly fading and sliding into view on hover.
     - Added `fadeInFilterBadge` entrance animation to `.chart-active-filter-group`.
---

### ADR-025: Y-Axis Header Alignment, Pie Graph Vertical Center Alignment & Callout Clearance Geometry

- **Status**: Implemented
- **Context**:
  1. **Bar Graph Y-Axis Misalignment**: The vertical Y-axis title `AMOUNT (₱)` was indented rightward by ~8px ($X=36$ vs $X=28$) relative to the card eyebrow and title (`ALL-TIME SUMMARY` / `Expenses by day`) because `padding-right: 0.35rem` rotated 180° into a visual left padding, compounded by rotated text bounding box centering.
  2. **Pillbox Vertical Offset**: The Category Breakdown filter pillboxes on the left were centered relative to the entire canvas container (`.spending-pie-canvas-box`, height $382\text{px}$ including the bottom `₱... TOTAL ALL-TIME` footer) rather than the pie graph circle itself (`.spending-pie-canvas-inner`, height $320\text{px}$), causing the pillboxes to sit ~31px lower than the pie graph's vertical center.
  3. **Pie Callout Squishing**: Leader lines and callout labels were squished against the slice perimeter (e.g., "Bills" colliding with the yellow slice border at $cy + r + 2$, and "Others 5%" touching the slice border at $cy - r - 1$) because the leader elbow knee distance was only $r + 10\text{px}$ and shelf length was $10\text{px}$.
- **Decision**:
  1. **Y-Axis Flush Header Alignment**:
     - Removed `padding-right` and applied `margin-left: -8px; padding: 0;` to `.graph-axis-title--y` in `home/style.css`, shifting the vertical text leftward so its glyph boundary starts flush at $X=28$, perfectly aligned in a straight line with the card header.
     - Increased `.graph-y-axis-wrap` gap to `0.85rem` to maintain comfortable breathing room between the axis title and numeric tick values.
     - Mirrored `marginLeft: -8, padding: 0, gap: "0.85rem"` in `HomeSkeleton.tsx`.
  2. **Pie Graph Vertical Center Alignment**:
     - Configured `.spending-pie-layout` with `align-items: flex-start;` and `.spending-pie-legend` with `height: 320px; justify-content: center;`.
     - Because both the legend container and the pie canvas inner share an identical $320\text{px}$ height from the top edge, the pillboxes are centered at $Y = 160\text{px}$, matching the exact vertical center of the pie graph circle ($cy = 160\text{px}$).
     - Mirrored in `skeletons.css` (`.home-skeleton-pie-layout { align-items: flex-start; }` and `.home-skeleton-pie-legend { height: 320px; }`) to maintain 1:1 Skeletal Loading Parity and 0 CLS.
  3. **Callout Clearance & Anti-Squish Engine**:
     - Increased `kneeDist` from $r + 10$ to $r + 24$ and `shelfLength` from $10$ to $14$ in `WeeklyPieChart.tsx`.
     - Calibrated `chartOptions.layout.padding` to `top: 44, bottom: 44, left: 70, right: 70` and boundary clamping to `minY = 26, maxY = chart.height - 26`.
     - Ensures all labels maintain at least $15\text{px}$ to $44\text{px}$ of clearance away from the slice borders, eliminating collision and ensuring crystal-clear readability.
- **Consequences**: Y-axis title aligns flush with the card heading, pillboxes align vertically with the pie circle center, and pie callout labels have spacious clearance without slice clipping.

---

### ADR-026: Excel-Style Horizontal Broken Grid Lines Architecture

- **Status**: Implemented
- **Context**: In financial reporting and spreadsheet tools like Microsoft Excel, bar charts feature horizontal grid lines extending across the plot area from each vertical tick mark to facilitate accurate value tracing. Previously, the "Expenses by day" Bar Chart only rendered a solid left axis and solid bottom baseline border, leaving the plot area blank behind the bars. The user requested horizontal broken/dashed grid lines across the chart area behind the bars, matching Excel's reference layout.
- **Decision**:
  1. **Background Broken Grid Layer**:
     - Introduced `.graph-grid` positioned absolutely across the content bounds (`top: 0.5rem; bottom: 0; left: 0; right: 0; pointer-events: none; z-index: 0;`) inside `.graph-bars`.
     - Rendered 6 dashed horizontal grid lines (`.graph-grid-line`) at exact intervals corresponding to the Y-axis tick values: `bottom: 100%`, `83.333%`, `66.667%`, `50%`, `33.333%`, and `16.667%`.
     - Styled with `border-top: 1px dashed var(--buck-line); opacity: 0.8;` in light mode, and `border-top-color: rgba(255, 211, 154, 0.24); opacity: 0.9;` in dark mode.
     - Kept the bottom baseline at 0% solid (`border-bottom: 1px solid var(--buck-line)`).
  2. **Layering & Interactive Stability**:
     - Configured `.graph-bar` with `position: relative; z-index: 1;` so bars render in front of the grid lines, allowing dashed lines to show naturally through inter-bar gaps and zero-data sections.
     - Configured `.graph-bars-empty-overlay` with `z-index: 5;` and `.graph-bar-tooltip` with `z-index: 10;`, guaranteeing tooltips and alerts remain unobstructed.
  3. **1:1 Skeletal Loading Parity**:
     - Added `.graph-grid` and 6 `.graph-grid-line` elements inside `HomeSkeleton.tsx` along with border styles (`borderLeft: 1px solid var(--buck-line)`, `borderBottom: 1px solid var(--buck-line)`).
     - Mirrored grid line styling in `skeletons.css` to completely eliminate CLS during initial load.
- **Consequences**: Enables immediate visual value scanning across weekday bars, maintains Excel aesthetic parity, preserves smooth bar animations, and ensures 1:1 skeleton parity.

---

### ADR-027: Bar Chart Interactive Day Slicing, Cross-Card Breakdown Synchronization & Enlarged Tooltips

- **Status**: Implemented
- **Context**:
  Users analyzing the Home dashboard's "Expenses by day" Bar Chart needed greater legibility and deeper analytical capability:
  1. **Tooltip Legibility**: The formatted currency amount displayed on bar hover was small and difficult to read quickly against varying screen sizes and backgrounds.
  2. **Interactive Day Slicing (Click-to-Filter)**: When clicking a weekday bar (e.g., Thursday), the user required the rest of the dashboard to synchronize with that day:
     - The "Category Breakdown" Pie Chart must dynamically update its slices and percentages to show the category spending distribution specifically for that day.
     - The "Financial Summary" card directly below must update its category items, amounts, and item descriptions to reflect expenses recorded specifically for that day.
     - Clicking the active bar toggles the day filter off, returning to the full timeframe overview.
     - Sibling filter badges (`Day: [DayName] [✕ Clear]`) must appear in the card headers to make the filter state explicit without creating nested pill structures (ADR-021).
- **Decision**:
  1. **Enlarged Tooltip Typography**:
     - Enlarged `.graph-bar-tooltip` in `home/style.css` (`font-size: 0.92rem; font-weight: 850; padding: 0.38rem 0.72rem; border-radius: 8px;`).
     - Added `.graph-bar-tooltip-amount` with `font-size: 0.92rem; font-weight: 850; letter-spacing: -0.01em; color: #ffffff;` ensuring immediate readability.
  2. **Interactive Bar Visual States & Keyboard Accessibility**:
     - Enabled interactive cursor (`cursor: pointer; will-change: height, transform;`) and click / keyboard listeners (`Enter`, `Space`, `aria-pressed`, `aria-label`).
     - Added `.graph-bar--selected` providing a 4px upward elevation (`transform: translateY(-4px)`), double-ring outline with `var(--buck-orange)`, and elevated drop shadow.
     - Added `.graph-bar--dimmed` (`opacity: 0.42`) to non-selected bars when a day is focused.
  3. **Cross-Card Data Synchronization Engine**:
     - Introduced `selectedDay` state (`string | null`) in `Dashboard` (`home/page.tsx`).
     - Implemented `matchesDayFilter(expense, selectedDay, timeframe)`:
       - For `"week"` timeframe: matches calendar date in the current week range (`getCurrentWeekRange()`).
       - For `"month"` and `"all"` timeframes: matches by day of the week using `jsDayToWeekDaysIndex`.
     - Memoized `dayFilteredExpenses`: filters `pieExpenses` by `matchesDayFilter`.
     - Powered `categoryPieData` with `dayFilteredExpenses`, dynamically recalculating slice amounts, total, and percentages for the selected day.
     - Updated `WeeklyPieChart` center label to `Total on [Day]` and empty state text to `No expenses recorded on [Day]`.
     - Powered `summaryData` with `dayFilteredExpenses`, providing custom day descriptions (e.g., `Spending under [Category] on [Day]`) and filtering out zero-spending categories for that day.
  4. **Sibling Filter Badges & Adjacent Title-Row Alignment (ADR-021 Compliance)**:
     - Enclosed `<h2 className="graph-title">Expenses by day</h2>` and the active filter badge group inside `<div className="summary-title-row">` inside `.card-heading`, positioning Category and Day filter badges directly next to the title with a clean `0.75rem` gap matching the layout of the Financial Summary card.
     - Rendered clearable `Day: [DayName]` and `Category: [CategoryName]` badges as sibling elements (`chart-active-filter-badge` + `filter-clear-btn`, `summary-filter-pill` + `summary-filter-action-btn`).
     - Avoided any pill-in-a-pill nesting.
- **Consequences**:
  Enables seamless multidimensional drill-down across day and category dimensions on the Home dashboard, eliminates wide visual separation between the Bar Chart title and its active filter badges, enhances accessibility and readability, and maintains strict design system consistency.

---

### ADR-028: Category-Only Pillbox Legend, Micro-Interaction Animation Engine & Interactive "All" State

- **Status**: Implemented
- **Context**:
  In the Category Breakdown card on `/dashboard/home`, the left-hand legend pillboxes previously rendered three pieces of data per row: the category dot and name on the left, plus the formatted currency amount (`₱...`) and percentage badge (`...%`) on the right. Because both the amounts and percentages are already prominently displayed by the pie slice callouts ("Transportation 17%") and the center info card below the pie, duplicating this information inside the pillboxes consumed excessive horizontal space ($230\text{px}$ width), constraining the pie canvas area. Additionally, the "All" pillbox lacked active state styling, hover motion, and symmetric dimming behavior.
- **Decision**:
  1. **Category-Only Pillbox Simplification**:
     - Removed amounts and percentage badges from `.spending-pie-legend-item` in `WeeklyPieChart.tsx`.
     - Pillboxes now display solely the colored dot indicator (`.spending-pie-legend-dot`) and the category name (`.spending-pie-legend-name`), freeing up ~80px of horizontal breathing room for the pie chart canvas and exterior callout labels.
     - Reduced `.spending-pie-legend` width from `min(225px, 100%)` to `fit-content; min-width: 125px; max-width: 160px;`.
  2. **Tactile Micro-Interaction & UX Animation Suite**:
     - **Hover Elevation**: Added `transform: translateX(4px);`, `background: rgba(255, 197, 71, 0.18);`, `border-color: var(--buck-orange);`, and `box-shadow: 0 3px 12px rgba(244, 117, 54, 0.2);` for responsive tactile feedback.
     - **Click / Active Compression**: Added `:active` state with `transform: translateX(2px) scale(0.97);` over an 80ms transition.
     - **Active / Selected State**: Active pill maintains elevated position (`transform: translateX(4px)`), bold typography (`font-weight: 700`), double-ring outline, vibrant orange wash, and dot glow (`box-shadow: 0 0 7px currentColor`).
     - **Dimmed State**: Unselected pills dim to `opacity: 0.45`, restoring to `0.88` with a gentle `translateX(2px)` slide on hover.
  3. **Symmetric & Fully Interactive "All" State**:
     - "All" pillbox now dynamically reflects active state: receives `.spending-pie-legend-item--selected` when no category is filtered (`!selectedCategory`), and `.spending-pie-legend-item--dimmed` when a specific category is active.
     - Clicking "All" triggers `onSelectCategory?.(null)`, smoothly restoring all pie slices to 100% outer radius and resetting the category filter.
  4. **1:1 Skeletal Loading Parity (`HomeSkeleton.tsx`, `skeletons.css`)**:
     - Updated `.home-skeleton-pie-legend` to `min-width: 125px; max-width: 160px;` and `.home-skeleton-legend-pill` to render a single category name skeleton line next to the dot avatar, preserving 1:1 geometry and preventing CLS.
- **Consequences**:
  Significantly maximizes visual space for the pie chart and outside callout labels, introduces delightful, tactile micro-interactions, and establishes full symmetry across all filter pill options.

---

### ADR-029: Uniform Human-Friendly Y-Axis "Nice Scale" Engine for Bar Graph Data Visualization

- **Status**: Implemented
- **Context**:
  In the Home dashboard "Expenses by day" Bar Chart, Y-axis scale values were previously generated by taking the raw highest expense in the active dataset (`maxAmount`, e.g. ₱61,590) and dividing it by 6: `Math.round(maxAmount - (maxAmount / 6) * index)`. This approach caused severe data visualization defects:
  1. **Non-Standard & Unfriendly Tick Increments**: Axis ticks jumped by non-human numbers like ₱10,265 (e.g. ₱61,590, ₱51,325, ₱41,060...) rather than clean round increments (e.g. ₱10,000, ₱20,000, ₱5,000).
  2. **Varying / Fluctuating Intervals**: Because of decimal rounding across integer ticks, intervals between adjacent labels frequently fluctuated (e.g. ₱3,908 then ₱3,909, or 16 then 17), breaking mathematical uniformity.
  3. **Zero Headroom**: Pinning the top scale mark exactly to the maximum expense forced the tallest bar to press directly against the 100% chart ceiling without top padding.
- **Decision**:
  1. **"Nice Numbers" Scale Generator (`computeNiceYAxis`)**:
     - Implemented `computeNiceYAxis(rawMax)` using standard data visualization scale algorithms ($1, 2, 2.5, 5, 10 \times 10^{\text{magnitude}}$).
     - Targets 4 to 7 clean intervals (optimizing for the $250\text{px}$ chart height) with uniform step intervals:
       - ₱61,590 $\rightarrow$ step ₱10,000, max ₱70,000 (ticks: 70k, 60k, 50k, 40k, 30k, 20k, 10k, 0; exact uniform 10k interval).
       - ₱35,200 $\rightarrow$ step ₱10,000, max ₱40,000 (ticks: 40k, 30k, 20k, 10k, 0).
       - ₱18,400 $\rightarrow$ step ₱5,000, max ₱20,000 (ticks: 20k, 15k, 10k, 5k, 0).
       - ₱2,800 $\rightarrow$ step ₱500, max ₱3,000 (ticks: 3k, 2.5k, 2k, 1.5k, 1k, 500, 0).
     - Guarantees $\text{tick}[i] - \text{tick}[i+1] \equiv \text{step}$ with $0$ rounding variance across all datasets.
  2. **Dynamic Grid Line Synchronization**:
     - Updated `.graph-grid` to dynamically render `yAxis.count` dashed lines positioned at `bottom: ${((yAxis.count - i) / yAxis.count) * 100}%`, ensuring every dashed line aligns 1:1 with its corresponding Y-axis tick mark.
  3. **Proportional Bar Geometry**:
     - Plotted bar heights against `yAxis.yMax`: `(item.amount / yAxis.yMax) * 100%`.
     - Bars accurately trace their values against the clean horizontal dashed lines (e.g. ₱61,590 sits at 88%, cleanly between the ₱60k line at 85.7% and the ₱70k ceiling at 100%).
- **Consequences**:
  Restores standard professional financial charting principles, guarantees 100% uniform intervals, eliminates rounding jitter, and ensures accurate, effortless visual data interpretation.

---

### ADR-030: Unified Narrow Outer Edge Spacing & Screen-Size Optimization Architecture

- **Status**: Implemented
- **Context**:
  Across the application, the outer gutters surrounding dashboard cards were overly spacious on desktop screens:
  1. **Header and Cards Below**: The sticky `.dashboard-topbar` had a large `min-height: 76px` with vertical padding up to `1rem` (16px), combined with page containers having a top padding of `clamp(1rem, 2.6vw, 1.6rem)` (25.6px). This created an excessive ~41.6px vertical void between the header text and the top edge of the cards. In the Statistics tab, an additional `marginTop: "2.5rem"` (40px) pushed controls even farther down.
  2. **Sidebar and Cards Beside**: The left outer padding was `clamp(1rem, 2.6vw, 1.6rem)` (25.6px), creating a wide gutter between the sidebar dividing border and the cards.
  3. **Right Outer Edge**: The right outer padding was also `clamp(1rem, 2.6vw, 1.6rem)` (25.6px), wasting desktop viewport width.
  4. **Cross-Tab Inconsistencies & Skeleton Drift**: While Home, Expenses, Goals, Statistics, Advisor, and Forecast used `1rem–1.6rem`, Settings and Admin used `0.65rem–0.95rem`, yet their skeletons had hardcoded `1.6rem` padding, introducing visual jitter.
- **Decision**:
  1. **Standardized Fluid Outer Gutters (`clamp(0.75rem, 1.5vw, 1rem)`)**:
     - Standardized outer container padding across **all 9 dashboard views** (`home`, `expenses`, `wallet`, `goals`, `statistics`, `settings`, `financial-advisor`, `forecast`, `admin`) to `clamp(0.75rem, 1.5vw, 1rem)`:
       - 12px (`0.75rem`) on mobile screens ($\le 480\text{px}$).
       - Scales smoothly up to 16px (`1rem`) on desktop screens ($\ge 1080\text{px}$).
     - Reduces outer gutters by 37.5% (from 25.6px down to 16px), unlocking significant horizontal display width while preserving room for elevation shadows (`var(--buck-shadow)`).
  2. **Streamlined Topbar Geometry (`min-height: 58px`)**:
     - Reduced `.dashboard-topbar` minimum height from 76px to 58px.
     - Reduced vertical padding to `clamp(0.5rem, 0.9vw, 0.65rem)` while matching horizontal padding to `clamp(0.75rem, 1.5vw, 1rem)`.
     - Matching horizontal padding guarantees that the topbar title on the left and the active wallet pill on the right align flush with the card edges directly beneath them.
     - Reduced the vertical void between header content and the first cards from ~41.6px down to ~22px–26px.
  3. **Sidebar Proportions Optimization (`minmax(220px, 250px)`)**:
     - Refined `.dashboard` column layout to `minmax(220px, 250px) minmax(0, 1fr)`.
  4. **Statistics Spacing Cleanup**:
     - Reduced `marginTop` above selectors in `statistics/page.tsx` from `2.5rem` (40px) to `0.5rem` (8px).
     - Defined explicit `.dashboard-container` class in `statistics/style.css` with unified padding and gap rules.
  5. **1:1 Skeletal Loading Parity Across All 9 Routes (Zero CLS)**:
     - Synchronized `.expenses-skeleton-page`, `.home-skeleton-page`, and `.wallet-skeleton-page` in `skeletons.css` to `padding: clamp(0.75rem, 1.5vw, 1rem); gap: clamp(0.75rem, 1.5vw, 1rem);`.
     - Synchronized `.dashboard-skeleton.dashboard-container`, `.dashboard-skeleton.settings-page`, and `.dashboard-skeleton.GoalsPage` in `dashboard.css`.
     - Updated inline styles in `AdminSkeleton.tsx`, `FinancialAdvisorSkeleton.tsx`, `ForecastSkeleton.tsx`, `GoalsSkeleton.tsx`, `SettingsSkeleton.tsx`, and `StatisticsSkeleton.tsx` to `clamp(0.75rem, 1.5vw, 1rem)`.
- **Consequences**:
  Significantly maximizes usable viewport real estate, creates a sleek and unified visual rhythm across all sections of the application, achieves strict horizontal alignment between header chrome and cards, and maintains 1:1 skeleton layout parity with zero Cumulative Layout Shift.

---

### ADR-031: Category Breakdown Day Filter Placement Underneath Title, Timeframe Center Alignment & Zero-CLS Header Stabilization

- **Status**: Implemented
- **Context**:
  In the Home dashboard (`/dashboard/home`), clicking a weekday bar on the "Expenses by day" Bar Chart applies day filtering across the dashboard. Previously, when a day was selected (e.g. "Monday"):
  1. **Horizontal Header Cramming & Multi-Line Wrap Shift**: The active day filter badge (`• Day: Monday [✕ All Days]`) was rendered horizontally inline next to `<h2 className="spending-card-title">Category Breakdown</h2>` inside a flex-wrapping title row. Because the title, filter badge, and clear button together occupied ~440px of width, available horizontal space on desktop was exhausted, forcing the `[All Time | This Month | This Week]` timeframe toggle group to wrap onto a second line.
  2. **Severe Vertical Layout Jump (Cumulative Layout Shift)**: Wrapping onto a second line increased the card header height from ~45px to ~90px. Because `.spending-pie-layout` is positioned with `margin: auto 0` inside a flex container with `justify-content: space-between`, this 45px header expansion pushed the entire pie chart and legend downward, causing a jarring visual jump whenever a day bar was clicked or unclicked.
  3. **Displaced Timeframe Toggle Alignment**: On the wrapped second line, the timeframe toggle group defaulted to left-alignment, awkwardly sitting above the category legend pills (`• All`, `• Food`, `• Bills`) on the far left rather than being centered over the pie chart circle on the right side of the card.
- **Decision**:
  1. **Dedicated Day Filter Placement Underneath Title (`.pie-day-filter-slot`)**:
     - Moved the Day active filter group (`chart-active-filter-group`) out of the horizontal title row and placed it into a dedicated container (`.pie-day-filter-slot`) directly underneath `<h2 className="spending-card-title">Category Breakdown</h2>` in [`home/page.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/page.tsx#L806-L833).
     - Styled `.pie-day-filter-slot` with `min-height: 28px; display: flex; align-items: center; margin-top: 0.35rem;` in [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css#L198-L203).
  2. **Zero-CLS Header Height Reservation (`min-height: 78px`)**:
     - Configured `.spending-card-header .card-heading` with `display: flex; flex-direction: column; gap: 0.25rem; margin-bottom: 0; flex: 0 0 auto; min-width: 140px; max-width: 260px; min-height: 78px;` in [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css#L187-L196).
     - Because the 78px height is permanently reserved whether `selectedDay` is active or null, the header dimensions remain strictly constant ($78\text{px} \equiv 78\text{px}$), completely eliminating vertical movement of the pie chart and achieving 0px Cumulative Layout Shift (CLS = 0).
  3. **Mathematical Center Alignment of Timeframe Toggle Relative to Pie Graph**:
     - Wrapped `.timeframe-toggle-group` in `.spending-timeframe-container` with `display: flex; align-items: center; justify-content: center; flex: 1 1 auto; max-width: 480px; min-height: 38px;` in [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css#L205-L211).
     - Styled `.spending-card-header` with `display: flex; flex-direction: row; align-items: flex-start; justify-content: space-between; gap: clamp(1rem, 2vw, 2.25rem); width: 100%;` matching `.spending-pie-layout`.
     - Because `.spending-timeframe-container` shares the identical right-hand column width bounds (`max-width: 480px`) and `justify-content: center` as `.spending-pie-canvas-box`, the timeframe toggle sits at the exact horizontal center-line ($X_{\text{toggle}} \equiv X_{\text{pie}}$) directly above the pie canvas circle.
  4. **Responsive Stacking at $\le 680\text{px}$**:
     - Configured `@media (max-width: 680px)` in [`home/style.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/app/dashboard/home/style.css#L432-L449) to stack `.spending-card-header` vertically (`flex-direction: column; align-items: stretch; gap: 1rem;`), reset heading `min-height: auto; max-width: 100%;`, and expand `.spending-timeframe-container` to `width: 100%; justify-content: center;`, harmonizing with `.spending-pie-layout`'s column-reverse stacking.
  5. **1:1 Skeletal Loading Parity**:
     - Updated [`HomeSkeleton.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/HomeSkeleton.tsx#L20-L33) to mirror `.spending-card-header`, `.card-heading` with `.pie-day-filter-slot`, and `.spending-timeframe-container`.
     - Synchronized `.home-skeleton-content` in [`skeletons.css`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/skeletons/skeletons.css#L315-L320) with `.dashboard-content` grid columns `minmax(0, 0.94fr) minmax(0, 1.06fr)`.
- **Consequences**:
  Completely eliminates the disruptive vertical layout shift when clicking or clearing weekday bars in the bar chart, keeps the Day filter badge organized and legible directly underneath the Category Breakdown heading, ensures the timeframe pillbox toggle remains reliably centered over the pie graph circle, and preserves strict 1:1 skeleton hydration parity.













