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
