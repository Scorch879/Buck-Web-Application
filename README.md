# Buck Web Application

<p align="center">
  <strong>Intelligent AI-Powered Budget & Expense Forecasting System</strong>
</p>

---

## 🌟 Overview

**Buck** is a modern, high-performance web application designed to help users take full control of their personal finances. Combining an intuitive, responsive frontend with machine learning forecasting models and real-time backend synchronization, Buck delivers actionable spending insights, multi-wallet management, goal tracking, and AI financial advisory services.

---

## 🛠️ Technology Stack

| Layer | Technologies |
|---|---|
| **Frontend Framework** | [Next.js 15](https://nextjs.org/) (App Router), [React 19](https://react.dev/), [TypeScript](https://www.typescriptlang.org/) |
| **Motion & Animations** | [Framer Motion](https://www.framer.com/motion/) (GPU-accelerated springs, path tracing, scroll linking) |
| **Styling & Design System** | Modern Vanilla CSS, CSS Variables, Theme Tokens (Dark & Light mode support) |
| **Authentication & Database** | [Supabase](https://supabase.com/) (SSR Client, Row-Level Security, PostgreSQL) |
| **AI Engine** | `Buck_AI/`: Python [FastAPI](https://fastapi.tiangolo.com/) on [Google Gemini](https://ai.google.dev/) Flash. AI Financial Advisor (live), AI Forecaster (planned) |
| **Icons & Media** | [React Icons](https://react-icons.github.io/react-icons/) (FontAwesome, HeroIcons) |

---

## ✨ Key Features & UI/UX Design System

### 1. Unified Header & Topbar Scroll Indicators
- **Traditional Scrollbar Concealment:** Native operating system scrollbars are concealed across scroll containers (`scrollbar-width: none;`, `::-webkit-scrollbar { display: none; }`) for a clean, distraction-free aesthetic.
- **Landing Page Header:** When scrolled, the header morphs into frosted glass (`backdrop-filter: blur(18px)`) while a warm gold/orange gradient progress indicator sweeps smoothly across the header's bottom border.
- **Dashboard Topbar:** Dynamically tracks inner dashboard content scrolling using Framer Motion `useScroll({ container: mainRef })` and `useSpring`.
- **Unified Border Integration:** The scroll track functions directly as the header's crisp `2px` bottom border line, preventing jagged step mismatches or double-line rendering artifacts.

### 2. Interactive Modal Perimeter Scroll Glow
- **Dynamic `<ScrollGlowModalCard>`:** For scrollable documents (e.g. Terms of Use, Privacy Policy), a dynamic SVG border `<motion.rect pathLength={smoothProgress}>` illuminates around the perimeter of the dialog as the user scrolls.
- **Content-Aware Scroll Detection:** Uses a `ResizeObserver` to evaluate whether content exceeds viewport boundaries, applying the SVG glow strictly when scrollable.
- **Desktop Bounds:** Modals are strictly bounded (`width: min(880px, 100%)`, max-height `min(82dvh, 760px)`) to ensure optimal readability across widescreen displays.
- **Isolated Static Dialogs:** Compact popups (e.g. Contact Us confirmation modal at `maxWidth: 420px`) maintain isolated static card layouts.

### 3. Comprehensive Financial Management
- **Multi-Wallet Budgeting:** Manage multiple accounts (Cash, Bank, Credit Card, Savings) with dedicated budget limits and active wallet selection.
- **Expense Categorization:** Instant logging with auto-categorization powered by AI embeddings.
- **Financial Goals & Multipliers:** Set savings goals with Normal, Moderate, or Aggressive pace profiles.
- **Expense Forecasting:** Time-series spending projections adapting to historical trends and lifestyle adjustments.
- **AI Financial Advisor:** Contextual financial tips, spending analysis, and actionable budgeting recommendations.
- **Admin Dashboard:** Platform monitoring, database cache inspection, and maintenance tools.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.18.0 or higher
- **npm** / **pnpm** / **yarn**

### 1. Clone the Repository
```bash
git clone https://github.com/Scorch879/Buck-Web-Application.git
cd Buck-Web-Application/buck
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env.local` file inside the `buck/` directory:
```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

### 4. Run the Development Server
```bash
npm run dev
```
Open [http://localhost:3000](http://localhost:3000) in your browser.

### 5. Production Build
```bash
npm run build
npm run start
```

---

## 📚 Documentation

Start at [**`docs/README.md`**](./docs/README.md). It maps every document and says which one answers what.

| File | Purpose |
|---|---|
| [`Claude.md`](./Claude.md) | Master engineering guide for AI agents (architecture, rules, standards) |
| [`Agents.md`](./Agents.md) | Agent roles and boundaries |
| [`docs/Design.md`](./docs/Design.md) | Architecture, schemas, data flows and ADRs |
| [`docs/Skills.md`](./docs/Skills.md) | Function, API route, Buck_AI endpoint and hook catalog |
| [`docs/Implementation.md`](./docs/Implementation.md) | Setup, environment variables and execution logic |
| [`docs/QA_Report.md`](./docs/QA_Report.md) | Defect backlog, security audit and test strategy |
| [`docs/requirements/`](./docs/requirements/) | Software Requirements Specification |
| [`Buck_AI/README.md`](./Buck_AI/README.md) | AI service (Python FastAPI + Gemini) |
