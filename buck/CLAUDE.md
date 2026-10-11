# CLAUDE.md: Next.js & Microservices Development Guide

> **Claude Reference**: This file is mirrored from the repository root [`../Claude.md`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/Claude.md). Refer to [`../Claude.md`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/Claude.md) and [`../Agents.md`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/Agents.md) for full architecture and multi-agent roles.

---

## 1. Quick Commands

```bash
# In this directory (buck/):
npm run dev        # Next.js 15 App Router Turbopack dev server (port 3000)
npm run build      # Production typecheck & build
npm run lint       # Run Next.js linting

# BuckAI Backend (buck/BuckAI_Backend/):
python -m uvicorn main:app --reload --port 8000
```

---

## 2. Agent Roles (from `Agents.md`)

- **Senior QA & Documentation Engineer**: Ground truth, zero-hallucination policy, update markdown docs, log defects to [`QA_Report.md`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/QA_Report.md).
- **Frontend UI/UX Architect**: Next.js App Router, Framer Motion, [`FinancialContext.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/context/FinancialContext.tsx), responsive modal bounds (`width: min(880px, 100%)`, max-height `min(82dvh, 760px)`), and **1:1 Skeletal Loading Parity** in [`DashboardSkeletons.tsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/buck/src/component/DashboardSkeletons.tsx) for zero CLS.
- **Backend & ML Engineer**: FastAPI microservice (`BuckAI_Backend/main.py`), 17-category classification, 2-sentence saving advice, Prophet additive regression (80% CI), exclude `is_emergency=TRUE`.
- **Security & Data Auditor**: Supabase RLS (`auth.uid() = user_id`), SSR cookies in `middleware.ts`, 30-min session timeout with `BroadcastChannel` cross-tab sync, 10-day soft account deletion grace period.

---

## 3. Strict Domain Requirements

- **Currency**: Philippine Peso (`PHP` / `₱`), `numeric(14,2)` precision.
- **17 Standard Categories**: Food, Fare, Gas Money, Video Games, Shopping, Bills, Education, Electronics, Entertainment, Health, Home, Insurance, Social, Sport, Tax, Telephone, Transportation.
- **Brand Tokens**: Buck Orange (`#F47536`), Buck Gold (`#FFC547`), Buck Coral (`#FF3838`), Neutral Cream (`#FFF1D8`), Dark Roast Espresso (`#120D0A`).
- **Schedule**: Strict 9-Week project lifecycle cap ([`docs/Buck_Project_Schedule_Gantt_Chart.xlsx`](file:///d:/VS%20Code/Buck-Budget-Tracker/Buck-Web-Application/docs/Buck_Project_Schedule_Gantt_Chart.xlsx)).
