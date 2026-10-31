# CLAUDE.md: Next.js & Microservices Development Guide

> **Claude Reference**: This file is mirrored from the repository root [`../Claude.md`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/Claude.md). Refer to [`../Claude.md`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/Claude.md) for the exhaustive System Overview, Multi-Tier Architecture diagrams, 10 Subsystems Decomposition, Entity Relationship Diagrams (ERD), and the ADR quick reference (full ADR-001 to ADR-051 in `docs/Design.md`).

---

## 1. Quick Development Commands

```bash
# In this directory (buck/):
npm run dev        # Next.js 15 App Router Turbopack dev server (port 3000)
npm run build      # Production typecheck & build
npm run lint       # ESLint 9 + Next + jsx-a11y (ADR-044); must stay at 0 errors / 0 warnings
npm run typecheck  # tsc --noEmit
npm test           # Vitest unit tests

# AI lives in ../Buck_AI (Python FastAPI + Gemini). Run it on :8000, then set
# NEXT_PUBLIC_BUCK_AI_URL=http://localhost:8000 in buck/.env.local (see ../Buck_AI/README.md)
```

---

## 2. Multi-Agent System Roles (from `Agents.md`)

- **Senior QA & Documentation Engineer**: Ground truth, zero-hallucination policy, sync markdown specs ([`Skills.md`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/docs/Skills.md), [`Design.md`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/docs/Design.md), [`Implementation.md`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/docs/Implementation.md)), catalog defects in [`QA_Report.md`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/docs/QA_Report.md).
- **Frontend UI/UX Architect**: Next.js App Router, Framer Motion, [`FinancialContext.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/context/FinancialContext.tsx) client cache layer, responsive modal bounds (`width: min(880px, 100%)`, max-height `min(82dvh, 760px)`), and **1:1 Skeletal Loading Parity** in [`DashboardSkeletons.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/DashboardSkeletons.tsx) for zero CLS.
  - **Dropdowns (ADR-040)**: `CustomSelect` only; options weight 400 (selected 500, colour not bold), trigger 600; toolbar filters use `fit` (no truncated labels, no fixed widths).
  - **Deletes (ADR-041)**: always `DangerDeleteDialog` (1. slide with warning, 2. red "I understand" or Cancel, 3. type the exact name); never `window.confirm`; destructive buttons red-tinted, at least 36px.
- **Backend & AI Engineer**: Next.js API routes and the Python `../Buck_AI` service (ADR-043). **AI Financial Advisor** = `BuckAI_Advisor` (live: saved advice refreshed when data changes, chat, goal tips, auto-categorize into the user's own categories; sourced PHP figures from `plan.py` with named periods, attitude multipliers). **AI Forecaster** = `BuckAI_Forecast` (live, ADR-052: per-user model fitted per request, P10/P50/P90 ranges, Gemini explains; `utils/forecastApi.ts` falls back to `/api/forecast`). Web and mobile call Buck_AI with the user's Supabase token; no app API keys.
- **Security & Data Auditor**: Supabase RLS (`auth.uid() = user_id`), SSR cookies in `middleware.ts`, 30-min session timeout with `BroadcastChannel` cross-tab sync, 10-day soft account deletion grace period.

---

## 3. Strict Domain Requirements

- **Currency**: Philippine Peso (`PHP` / `₱`), `numeric(14,2)` precision.
- **Categories (ADR-042)**: fully custom per user. Seeded with 17 default expense categories (Food, Fare, Gas Money, Video Games, Shopping, Bills, Education, Electronics, Entertainment, Health, Home, Insurance, Social, Sport, Tax, Telephone, Transportation) + `Uncategorized`, and 7 income categories (Salary, Allowance, Freelance, Business, Investment, Gift, `Other`). Managed on the Categories tab; AI must classify into the user's own categories.
- **Brand Tokens**: Buck Orange (`#F47536`), Buck Gold (`#FFC547`), Buck Coral (`#FF3838`), Neutral Cream (`#FFF1D8`), Dark Roast Espresso (`#120D0A`).
- **Schedule**: Strict 9-Week project lifecycle cap ([`docs/project/Buck_Project_Schedule_Gantt_Chart.xlsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/docs/project/Buck_Project_Schedule_Gantt_Chart.xlsx)).
