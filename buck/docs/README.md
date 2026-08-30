# Buck Documentation & Engineering Knowledge Base

Welcome to the centralized technical documentation repository for the **Buck Budget Tracker Web Application**. This directory contains the complete architectural specifications, AI agent guidelines, API catalogs, security policies, UI/UX design standards, and defect tracking reports.

---

## 🧭 Master Documentation Index

```
buck/docs/
├── 🤖 Core AI-First Source of Truth
│   ├── Agents.md                      # AI agent personas, system scopes & execution boundaries
│   ├── Skills.md                      # Function, API, endpoint & hook catalog
│   ├── Design.md                      # Architecture, database schemas, flows & ADRs
│   ├── Implementation.md              # Runtime execution, setup & hardcoded constraints
│   └── QA_Report.md                   # Defect backlog, security audit & test strategies
│
├── 🔐 Authentication, Security & Database
│   ├── SUPABASE_AUTH_SETUP.md         # SSR Auth setup, RLS policies & reset flow
│   └── SUPABASE_EMAIL_TEMPLATES.txt   # Supabase transactional email templates
│
├── 🎨 UI/UX, Motion & Design System
│   ├── ui-motion-and-scroll-effects.md # Header scroll tracker & modal SVG perimeter glow
│   ├── global-ui.md                   # Button standards, dropdown accessibility & tokens
│   ├── universal-button-styling.md    # Gradient buttons & wallet card action rows
│   ├── wallet-layout.md               # Multi-wallet flexbox layouts & responsiveness
│   ├── wallet-search.md               # Real-time search, sorting & history filters
│   └── hydration-fix.md               # React 19 SSR hydration mismatch prevention
│
└── 🛠️ Administration & Performance Caching
    ├── admin-dashboard.md             # Admin portal redesign & log inspection
    └── admin-backend-caching.md       # Global context caching & non-blocking fetches
```

---

## 1. 🤖 Core AI-First Source of Truth

These documents form the machine-readable foundation for autonomous AI agents and human engineers:

| Document | Description |
|---|---|
| [**`Agents.md`**](./Agents.md) | Defines multi-agent roles (**QA/Doc Engineer**, **Frontend Architect**, **Backend & ML Engineer**, **Security Auditor**), boundaries, and coordination workflows. |
| [**`Skills.md`**](./Skills.md) | Exhaustive catalog of all Supabase CRUD & Realtime functions, Next.js server route handlers, Python FastAPI endpoints, and client hooks with types and signatures. |
| [**`Design.md`**](./Design.md) | High-level system architecture (Mermaid), full PostgreSQL schemas & RLS policies, end-to-end data flows, and Architectural Decision Records (ADRs 001–005). |
| [**`Implementation.md`**](./Implementation.md) | Execution logic, environment variable matrix, step-by-step setup guides for Next.js & FastAPI, and hardcoded system constraints. |
| [**`QA_Report.md`**](./QA_Report.md) | Continuous quality assurance, defect backlog categorized by severity, security compliance audit, and automated/manual testing strategy. |

---

## 2. 🔐 Authentication, Security & Database

| Document | Description |
|---|---|
| [**`SUPABASE_AUTH_SETUP.md`**](./SUPABASE_AUTH_SETUP.md) | Complete guide for Supabase SSR client authentication, cookie exchange, password reset recovery, and RLS validation. |
| [**`SUPABASE_EMAIL_TEMPLATES.txt`**](./SUPABASE_EMAIL_TEMPLATES.txt) | Raw HTML/text templates for magic links, email confirmations, password reset requests, and account deletion confirmation OTPs. |

---

## 3. 🎨 UI/UX, Motion & Design System

| Document | Description |
|---|---|
| [**`ui-motion-and-scroll-effects.md`**](./ui-motion-and-scroll-effects.md) | Framer Motion integration for header scroll progress borders, `<ScrollGlowModalCard>` dynamic SVG glow, and scrollbar concealment rules. |
| [**`global-ui.md`**](./global-ui.md) | Design token standardization, button hover micro-interactions, dropdown accessibility, and form styling. |
| [**`universal-button-styling.md`**](./universal-button-styling.md) | Universal action button gradient specifications and wallet card action row layout patterns. |
| [**`wallet-layout.md`**](./wallet-layout.md) | Responsive flexbox structure for multi-wallet views, preventing double scrollbars and layout shifting. |
| [**`wallet-search.md`**](./wallet-search.md) | Real-time client-side search, filtering, and sorting architecture for active and historical wallets. |
| [**`hydration-fix.md`**](./hydration-fix.md) | Strategies for eliminating React 19 SSR hydration mismatches across theme detection and authenticated contexts. |

---

## 4. 🛠️ Administration & Performance Caching

| Document | Description |
|---|---|
| [**`admin-dashboard.md`**](./admin-dashboard.md) | System monitoring portal architecture, log filtering, and Vercel deployment tracking for platform administrators. |
| [**`admin-backend-caching.md`**](./admin-backend-caching.md) | Memory-only caching layer within `FinancialContext` preventing redundant API requests during dashboard navigation. |
