# Buck Documentation

This folder holds all of Buck's project documentation. Two files stay at the repo root on purpose:

- [`../Claude.md`](../Claude.md): the master engineering guide for AI agents (Claude Code loads it from the repo root).
- [`../Agents.md`](../Agents.md): agent roles and boundaries (agent tools look for it at the repo root).

READMEs about specific code stay next to that code (see the last table).

## Which doc do I open?

| I want to... | Open |
|---|---|
| Understand the architecture, database schema, data flows or a design decision (ADR-001 to ADR-051) | [`Design.md`](Design.md) |
| Find a function, API route, Buck_AI endpoint or hook, with its signature | [`Skills.md`](Skills.md) |
| Set up the project, see environment variables or module execution logic | [`Implementation.md`](Implementation.md) |
| Check known bugs, security findings and the test strategy | [`QA_Report.md`](QA_Report.md) |
| Read the formal requirements | [`requirements/`](requirements/) |
| See the 9-week schedule | [`project/Buck_Project_Schedule_Gantt_Chart.xlsx`](project/Buck_Project_Schedule_Gantt_Chart.xlsx) |
| Hand a task to another agent | [`handoffs/`](handoffs/) |

## Folder layout

```
docs/
├── README.md                 # This map
├── Design.md                 # Architecture, ERDs, data flows, ADR-001 to ADR-051
├── Skills.md                 # Function, API route, Buck_AI endpoint and hook catalog
├── Implementation.md         # Setup, environment variables, execution logic, constraints
├── QA_Report.md              # Defect backlog, security audit, test strategy
├── requirements/
│   ├── SRS.md                # Software Requirements Specification (Markdown)
│   ├── SRS_exact_aligned.md  # Alternate SRS draft (was exact_aligned_srs.md)
│   └── Buck_SRS.docx         # SRS, Word version
├── project/
│   └── Buck_Project_Schedule_Gantt_Chart.xlsx   # 9-week Gantt schedule
├── guides/
│   ├── frontend/             # Older UI change notes (see below)
│   └── supabase/
│       ├── SUPABASE_EMAIL_TEMPLATES.txt         # Auth e-mail templates to paste into Supabase
│       └── SUPABASE_AUTH_SETUP.md               # Local only (gitignored), not in the repo
└── handoffs/                 # Prompts written for other agents
    ├── ADR-048_Frontend_2FA_Prompt.md
    ├── ADR-049_Frontend_Connected_Apps_Prompt.md
    └── ADR-051_Frontend_App_Logo_Prompt.md
```

## Frontend change notes (`guides/frontend/`)

Short notes written when each change shipped. They describe the change at the time. Where they disagree with the code or with an ADR in [`Design.md`](Design.md), the code and the ADR win.

| Note | Topic |
|---|---|
| [`ui-motion-and-scroll-effects.md`](guides/frontend/ui-motion-and-scroll-effects.md) | Header scroll indicators, modal perimeter glow, hidden scrollbars |
| [`global-ui.md`](guides/frontend/global-ui.md) | Dropdown readability, button and form styling |
| [`universal-button-styling.md`](guides/frontend/universal-button-styling.md) | Gradient action buttons, wallet card action rows |
| [`wallet-layout.md`](guides/frontend/wallet-layout.md) | Wallet card layout |
| [`wallet-search.md`](guides/frontend/wallet-search.md) | Wallet search, sort and filters |
| [`hydration-fix.md`](guides/frontend/hydration-fix.md) | React hydration mismatch fix |
| [`admin-dashboard.md`](guides/frontend/admin-dashboard.md) | Admin dashboard tabs, filters, caching and access control |
| [`admin-backend-caching.md`](guides/frontend/admin-backend-caching.md) | Admin data cached in `FinancialContext` |

## READMEs next to the code

| File | Covers |
|---|---|
| [`../README.md`](../README.md) | Project overview and quick start |
| [`../buck/README.md`](../buck/README.md) | Next.js web app commands |
| [`../buck/CLAUDE.md`](../buck/CLAUDE.md) | Short agent guide for work inside `buck/` |
| [`../buck/supabase/README.md`](../buck/supabase/README.md) | Database migrations |
| [`../Buck_AI/README.md`](../Buck_AI/README.md) | Buck_AI service (Python FastAPI + Gemini) |
